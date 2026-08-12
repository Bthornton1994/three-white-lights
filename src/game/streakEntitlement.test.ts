/**
 * streakEntitlement.test.ts — unit tests for the rolling entitlement, and the
 * VERIFICATION BATTERY that GDD §4.2's Option 1 ruling is conditional on.
 *
 * "ZERO VIOLATIONS" IS TREATED HERE AS A HYPOTHESIS, NOT AS A RESULT. This
 * module has now had two "this closes it" claims fail under deeper tracing, and
 * both failed in a way a single sweep could not see: the first because the
 * sweep only compared `currentStreak`, the second because the only
 * counterfactual available could not separate the cause from its vehicle. So
 * the battery below is built out of the specific failure classes those two
 * produced, and it carries NEGATIVE CONTROLS — grant schedules that must show
 * violations — because a harness that only ever prints zero cannot tell a
 * property that holds from a harness that is not looking.
 *
 * Every parameter it runs on is in `streakSweep.ts`
 * (`ENTITLEMENT_VERIFICATION`), so every number here is re-derivable from the
 * repository and from nothing else.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { budgetFrom } from '../../tools/testBudget.mjs';
import * as entitlementModule from './streakEntitlement';
import {
  COVERAGE_SOURCES,
  COVERAGE_SOURCE_COUNTER,
  ENTITLEMENT_FACT_KEYS,
  MAX_COVERED_DAYS_ONE_ABSENCE_MAY_DRAW,
  COVERED_DAY_TOUCHING_FUNCTIONS,
  RECOVERY_ENTITLEMENT,
  SOURCES_THAT_CREDIT_A_PURCHASED_DAY,
  afterSession,
  coveredDaysAvailable,
  freshEntitlement,
  creditCoveredDays,
  resolveEntitlement,
  windowIndexOf,
  windowStartDay,
  type CoverageSource,
  type EntitlementState,
  type EntitlementTuning,
} from './streakEntitlement';
import {
  RECOVERY_DAY_GUARDRAILS,
  absenceOutcome,
  applySettledCoveredDayPurchase,
  asStreakDay,
  createStreakState,
  openDay,
  recordTrainingDay,
  settleBrokenStreak,
  type StreakState,
} from './streak';
import {
  COVERED_DAY_PURCHASE_SWEEP,
  DOOMED_BURN_COUNTERFACTUAL,
  ENTITLEMENT_VERIFICATION,
  MONOTONICITY_SWEEP,
  coveredDayPurchaseDays,
  exhaustiveCalendar,
  exhaustiveCalendarCount,
  fixedRateSchedules,
  purchaseArrivalOf,
  renderSchedule,
  seededSchedules,
  singleDaySupersets,
  type TrainingSchedule,
} from './streakSweep';
import {
  NON_TRAINING_GATED_TENDERS,
  TRAINING_GATED_TENDERS,
  type CoveredDayTender,
} from './currencyProvenance';
import { nextRandom, seedState } from './prng';

/** The free grace belongs to `streak.ts`; the entitlement composes with it. */
const GRACE = RECOVERY_DAY_GUARDRAILS.FREE_GRACE_GAP_DAYS;

// ---------------------------------------------------------------------------
// The composed rule, driven over a calendar
// ---------------------------------------------------------------------------

/**
 * How a covered day may be added during a run. The three shapes matter because
 * two of them are measured to reopen the defect.
 */
type GrantShape =
  | { readonly kind: 'none' }
  /** Fixed positions on the calendar. Neither lifter's training can move them. */
  | { readonly kind: 'calendar'; readonly days: readonly number[] }
  /** Keyed to the streak reaching a length. NEGATIVE CONTROL — must violate. */
  | { readonly kind: 'streak'; readonly at: number }
  /** Keyed to the Nth session ever. NEGATIVE CONTROL — must violate. */
  | { readonly kind: 'session'; readonly every: number };

interface RunOptions {
  readonly tuning: EntitlementTuning;
  readonly grant: GrantShape;
  /** Off reproduces "a doomed absence consumes nothing" — must violate. */
  readonly burnOnDoom: boolean;
  /**
   * Days an Extra Covered Day (GDD §8.3E) is BOUGHT on, credited through
   * `'purchase'` so it lands in `purchasedDaysLeft` rather than in the free
   * entitlement. This is the human's condition 2: the invariants below are
   * re-run with the purchased field actually populated, not structurally
   * present and zeroed.
   *
   * It is a DAY LIST rather than a rule on purpose — the whole matched design
   * turns on being able to hand the diligent lifter the lazy one's schedule.
   * `streakSweep.coveredDayPurchaseDays` is what computes one.
   */
  readonly purchaseDays: readonly number[];
}

interface RunResult {
  readonly currentStreak: number;
  readonly longestStreak: number;
  readonly consumed: number;
  /** Covered days bought. Zero means the purchase arms proved nothing. */
  readonly bought: number;
  /** Peak `purchasedDaysLeft` reached, so "populated" is checked not assumed. */
  readonly peakPurchased: number;
  /**
   * Orders the store refused because the absence was already doomed.
   *
   * PART OF THE PINNED RESULT, not a diagnostic. Both engines have to agree
   * about which buy days they turned away, or the §8.3E table transfers from a
   * composition that bought on days the shipped engine will not sell on.
   */
  readonly refusedPurchases: number;
}

/**
 * Replays a calendar through the REAL entitlement module. Day 0 is the signup
 * day, so idle days before the first session are anchored and charged exactly
 * as GDD §4.2 RULE 1 requires — the rule this rework does not touch.
 *
 * It is the reference composition of grace + entitlement, and `streak.ts` has
 * to agree with it when the two are wired together.
 */
function drive(schedule: TrainingSchedule, options: RunOptions): RunResult {
  const { tuning, grant, burnOnDoom, purchaseDays } = options;
  const windowAt = (day: number): number => windowIndexOf(tuning, 0, day);
  // THE LIVE BALANCE, and separately THE ARMED SNAPSHOT the absence in progress
  // resolves against (GDD §4.2: "A Recovery Day that arrives during an absence
  // does not cover it. Buying or earning one mid-absence tops up the balance and
  // arms the *next* absence"). `armedOnDay` is the day the snapshot was taken —
  // day 0 is signup, which arms like a session — and it is what decides whether
  // a credit landed before the absence or during it.
  //
  // THIS USED TO BE ONE VARIABLE, and that is precisely the defect the shipped
  // engine had: a settled purchase applied during a doomed absence rescued the
  // run, but only when nothing had settled the break first. This composition
  // could not see it, because it resolves and credits in a fixed order within
  // each day — which is the same reason every other harness in the repo was
  // green on it.
  let entitlement = freshEntitlement(tuning, 0);
  let armed = freshEntitlement(tuning, 0);
  let armedOnDay = 0;
  let currentStreak = 0;
  let longestStreak = 0;
  let lastTrainedDay: number | null = null;
  let sessions = 0;
  let consumedTotal = 0;
  let bought = 0;
  let peakPurchased = 0;
  let refusedPurchases = 0;

  const resolveAt = (today: number): { daysMissed: number; chargeable: number; covers: boolean; consumed: number } => {
    const anchor = lastTrainedDay ?? 0;
    const daysMissed = Math.max(0, today - anchor - 1);
    const chargeable = Math.max(0, daysMissed - GRACE);
    // COVERS IS DECIDED BY THE ARMED SNAPSHOT; THE DOOMED BURN IS READ OFF THE
    // LIVE BALANCE. See `streak.ts`'s `absenceOutcome` for why the two halves
    // read different fields — a mid-absence arrival may not rescue the absence
    // and may not be spared by it either, and the second half is what keeps the
    // doomed consumption idempotent under splitting.
    const outcome = resolveEntitlement(tuning, armed, windowAt(today), chargeable);
    const burn = resolveEntitlement(tuning, entitlement, windowAt(today), chargeable);
    return {
      daysMissed,
      chargeable,
      covers: outcome.covers,
      consumed: outcome.covers ? outcome.consumed : burnOnDoom ? burn.availableBefore : 0,
    };
  };

  /**
   * Credits `amount` covered days, from `source`, on `day`.
   *
   * IT ALWAYS RAISES THE LIVE BALANCE and reaches the armed snapshot only when
   * the credit is dated on or before the day that snapshot was taken. That is
   * one rule for both sources, which is what GDD §4.2 says — "buying OR
   * EARNING" — so the free grant path is fenced by exactly the same sentence
   * the purchase path is.
   */
  const credit = (day: number, amount: number, source: 'window-entitlement' | 'purchase'): void => {
    const w = windowAt(day);
    entitlement = creditCoveredDays(tuning, entitlement, w, amount, source).state;
    if (day <= armedOnDay) {
      armed = creditCoveredDays(tuning, armed, w, amount, source).state;
    }
  };

  const addCoveredDay = (day: number): void => {
    credit(day, 1, 'window-entitlement');
  };

  for (let i = 0; i < schedule.length; i += 1) {
    if (grant.kind === 'calendar' && grant.days.includes(i)) addCoveredDay(i);

    // THE PURCHASE, THROUGH THE REAL CREDIT PATH AND INTO THE REAL FIELD. A day
    // may appear more than once when the purse can afford two at once, so this
    // counts rather than tests membership.
    //
    // INDEXED AND LENGTH-GUARDED rather than `for...of`, which is not style: the
    // no-purchase arms run this loop tens of millions of times and a `for...of`
    // over an empty array still allocates an iterator every day of every
    // calendar. Written the obvious way it added twenty seconds to this file.
    //
    // AND THE STORE REFUSES DURING AN ALREADY-DOOMED ABSENCE, which this
    // composition has to model or the §8.3E pin stops transferring. The shipped
    // `applySettledCoveredDayPurchase` asks `absenceOutcome(...).protectionHolds`
    // and returns `ABSENCE_ALREADY_DOOMED` when it is false; `resolveAt(i).covers`
    // is the identical arithmetic here, off the identical armed snapshot. A buy
    // day the store would refuse therefore credits nothing on either side.
    if (purchaseDays.length > 0) {
      for (let k = 0; k < purchaseDays.length; k += 1) {
        if (purchaseDays[k] !== i) continue;
        if (!resolveAt(i).covers) {
          refusedPurchases += 1;
          continue;
        }
        const amount = COVERED_DAY_PURCHASE_SWEEP.COVERED_DAYS_PER_ORDER;
        credit(i, amount, 'purchase');
        bought += amount;
        peakPurchased = Math.max(peakPurchased, entitlement.purchasedDaysLeft);
      }
    }

    // The daily open, which settles a run the calendar has already ended.
    if (lastTrainedDay !== null && i > lastTrainedDay) {
      const r = resolveAt(i);
      if (r.daysMissed > 0 && !r.covers) {
        currentStreak = 0;
        lastTrainedDay = null;
      }
    }

    if (schedule[i] !== true) continue;

    const r = resolveAt(i);
    if (!r.covers) {
      currentStreak = 0;
      lastTrainedDay = null;
    }
    // THE SESSION DEBITS THE LIVE BALANCE BY WHAT THE ARMED SNAPSHOT COST, and
    // then re-arms with whatever is left. A covered day bought during the
    // absence is in `entitlement` but was not in `armed`, so it neither covered
    // the absence nor was burned by it — and from here it arms the next one.
    entitlement = afterSession(tuning, entitlement, windowAt(i), r.consumed);
    armed = entitlement;
    armedOnDay = i;
    consumedTotal += r.consumed;
    currentStreak += 1;
    longestStreak = Math.max(longestStreak, currentStreak);
    lastTrainedDay = i;
    sessions += 1;

    if (grant.kind === 'streak' && currentStreak === grant.at) addCoveredDay(i);
    if (grant.kind === 'session' && sessions % grant.every === 0) addCoveredDay(i);
  }

  // Settle at the end, so two states are never compared at different staleness.
  const last = schedule.length - 1;
  if (lastTrainedDay !== null && last > lastTrainedDay) {
    const r = resolveAt(last);
    if (r.daysMissed > 0 && !r.covers) currentStreak = 0;
  }
  return { currentStreak, longestStreak, consumed: consumedTotal, bought, peakPurchased, refusedPurchases };
}

const DEFAULT: RunOptions = {
  tuning: RECOVERY_ENTITLEMENT,
  grant: { kind: 'none' },
  burnOnDoom: true,
  purchaseDays: [],
};

/**
 * THE SAME CALENDAR, THROUGH THE SHIPPED ENGINE.
 *
 * WHY THIS EXISTS, and it is the thing the whole battery below rests on.
 * `drive` is a REFERENCE COMPOSITION of the free grace and the entitlement — it
 * calls the real `streakEntitlement.ts` but it re-implements the streak
 * bookkeeping around it in twenty lines. Every attack in this file grades
 * `drive`. If `drive` and `src/game/streak.ts` disagree by so much as one day,
 * every one of those attacks is a statement about a program nobody ships and
 * the verification GDD §4.2's ruling was made on transfers to nothing.
 *
 * So the two are PINNED EQUAL, byte for byte, on the same calendars the battery
 * uses — see 'the shipped engine is the composition this battery graded'.
 *
 * SIGNUP DAY IS DAY 0 in both, so the window grids coincide. `drive` hardcodes
 * that (`windowIndexOf(tuning, 0, day)`); this passes it explicitly.
 *
 * WHAT THE PIN CANNOT COVER, said plainly rather than left to be assumed:
 * `streak.ts` reads `RECOVERY_ENTITLEMENT` as a module constant, so it can only
 * be driven at the SHIPPED tuning. The battery's window-length and
 * entitlement-size grids, its purchase paths and its negative controls are all
 * `drive`-only, and they transfer to the shipped engine only through the
 * shipped tuning being one point in each grid — which `streak.test.ts` asserts
 * directly ('ships a tuning the verification battery actually covers').
 */
function driveThroughStreakEngine(
  schedule: TrainingSchedule,
  purchaseDays: readonly number[] = [],
): RunResult {
  let state: StreakState = createStreakState(asStreakDay(0));
  let consumed = 0;
  let bought = 0;
  let peakPurchased = 0;
  let refusedPurchases = 0;

  for (let i = 0; i < schedule.length; i += 1) {
    const day = asStreakDay(i);
    // GDD §8.3E's purchase, through the SHIPPED entry point rather than through
    // `streakEntitlement` directly — so the pin below covers the purchase path
    // and not only the absence path.
    for (let k = 0; purchaseDays.length > 0 && k < purchaseDays.length; k += 1) {
      if (purchaseDays[k] !== i) continue;
      const amount = COVERED_DAY_PURCHASE_SWEEP.COVERED_DAYS_PER_ORDER;
      const applied = applySettledCoveredDayPurchase(state, day, {
        orderId: `sweep-${i}-${bought}`,
        coveredDays: amount,
        tender: 'chalk-purchased',
        // THE SCREEN A STORE GATED ON `protectionHolds` WOULD HAVE DRAWN, on
        // the day the order lands. One device, no render/complete gap — this
        // battery is about the entitlement arithmetic, not about the store's
        // copy, and `streak.test.ts` owns the render-day axis.
        renderedOffer: { day, offered: absenceOutcome(state, day).protectionHolds },
      });
      // A DOOMED-ABSENCE REFUSAL IS AN EXPECTED ANSWER AND IS COUNTED; anything
      // else is a harness bug and still throws, so a malformed order or a
      // rejected tender cannot hide inside this branch.
      if (!applied.ok) {
        if (applied.error.code !== 'ABSENCE_ALREADY_DOOMED') {
          throw new Error(`streak engine refused a purchase on day ${i}: ${applied.error.code}`);
        }
        refusedPurchases += 1;
        continue;
      }
      state = applied.value.state;
      bought += amount;
      peakPurchased = Math.max(peakPurchased, state.entitlement.purchasedDaysLeft);
    }
    // The daily open, which settles a run the calendar has already ended. This
    // is `drive`'s `if (lastTrainedDay !== null && i > lastTrainedDay)` branch:
    // `openDay` reports `'streak-broken'` on exactly that condition.
    if (openDay(state, day).kind === 'streak-broken') {
      const settled = settleBrokenStreak(state, day);
      if (settled.ok) state = settled.value.state;
    }
    if (schedule[i] !== true) continue;

    const outcome = recordTrainingDay(state, day);
    if (!outcome.ok) throw new Error(`streak engine refused day ${i}: ${outcome.error.code}`);
    consumed +=
      (outcome.value.recoveryDaySave?.recoveryDaysSpent ?? 0) + outcome.value.recoveryDaysLostToTheAbsence;
    state = outcome.value.state;
  }

  // Settle at the end, so two states are never compared at different staleness.
  const last = asStreakDay(schedule.length - 1);
  if (openDay(state, last).kind === 'streak-broken') {
    const settled = settleBrokenStreak(state, last);
    if (settled.ok) state = settled.value.state;
  }
  return {
    currentStreak: state.currentStreak,
    longestStreak: state.longestStreak,
    consumed,
    bought,
    peakPurchased,
    refusedPurchases,
  };
}

// ---------------------------------------------------------------------------
// The judge
// ---------------------------------------------------------------------------

interface Verdict {
  /** Pairs where the lifter who trained MORE ended on a lower `currentStreak`. */
  readonly currentInversions: number;
  /** The same for `longestStreak` — the half that does not heal. */
  readonly longestInversions: number;
  /** Largest `currentStreak` deficit seen. MAGNITUDE, not just frequency. */
  readonly worstCurrentDeficit: number;
  readonly worstLongestDeficit: number;
  readonly pairsChecked: number;
  /** Covered days actually consumed, so a clean sweep cannot be a silent one. */
  readonly consumed: number;
  /** A failing pair, rendered, so a red test names itself. */
  readonly witness: string | null;
}

function judge(pairs: Iterable<readonly [TrainingSchedule, TrainingSchedule]>, options: RunOptions): Verdict {
  let currentInversions = 0;
  let longestInversions = 0;
  let worstCurrentDeficit = 0;
  let worstLongestDeficit = 0;
  let pairsChecked = 0;
  let consumed = 0;
  let witness: string | null = null;

  for (const [lazySchedule, diligentSchedule] of pairs) {
    const lazy = drive(lazySchedule, options);
    const diligent = drive(diligentSchedule, options);
    pairsChecked += 1;
    consumed += lazy.consumed;
    const currentDeficit = lazy.currentStreak - diligent.currentStreak;
    const longestDeficit = lazy.longestStreak - diligent.longestStreak;
    if (currentDeficit > 0) {
      currentInversions += 1;
      if (currentDeficit > worstCurrentDeficit) {
        worstCurrentDeficit = currentDeficit;
        witness =
          `${renderSchedule(lazySchedule)} (${lazy.currentStreak}) beats ` +
          `${renderSchedule(diligentSchedule)} (${diligent.currentStreak})`;
      }
    }
    if (longestDeficit > 0) {
      longestInversions += 1;
      worstLongestDeficit = Math.max(worstLongestDeficit, longestDeficit);
    }
  }
  return {
    currentInversions,
    longestInversions,
    worstCurrentDeficit,
    worstLongestDeficit,
    pairsChecked,
    consumed,
    witness,
  };
}

/** Asserts a verdict is clean on ALL FOUR figures, and was not vacuous. */
function expectClean(label: string, verdict: Verdict): void {
  expect(verdict.pairsChecked, `${label}: no pairs were compared`).toBeGreaterThan(0);
  expect(verdict.consumed, `${label}: no covered day was ever consumed, so this proves nothing`).toBeGreaterThan(0);
  expect(verdict.currentInversions, `${label}: ${verdict.witness ?? ''}`).toBe(0);
  expect(verdict.longestInversions, `${label}: lifetime best inverted`).toBe(0);
  expect(verdict.worstCurrentDeficit, `${label}: worst currentStreak deficit`).toBe(0);
  expect(verdict.worstLongestDeficit, `${label}: worst longestStreak deficit`).toBe(0);
}

function* sampledPairs(length: number, perSeed?: number): Generator<readonly [TrainingSchedule, TrainingSchedule]> {
  for (const seed of MONOTONICITY_SWEEP.SEEDS) {
    const schedules = seededSchedules(seed, length);
    const take = perSeed ?? schedules.length;
    for (let i = 0; i < take; i += 1) {
      const schedule = schedules[i] as TrainingSchedule;
      for (const superset of singleDaySupersets(schedule)) yield [schedule, superset] as const;
    }
  }
}

// ---------------------------------------------------------------------------
// GDD §8.3E — the matched purchase judge
// ---------------------------------------------------------------------------

/**
 * THE TREATMENT APPLIED TO THE DILIGENT MEMBER OF A PAIR — the one axis, now
 * that the funding source is the other one.
 *
 * WHAT CHANGED AND WHY. This used to be a three-member type where one member
 * (`'calendar'`) was really a funding source and the other two were really
 * treatments, which meant the calendar arm and the frozen arm differed in TWO
 * things at once and only the comment said which one mattered. Splitting them
 * lets the sweep run every tender under the same treatment, which is what
 * "0 violations across all funding sources" has to mean to be worth anything.
 *
 *   - `'responsive'`: the diligent member's purchase days are recomputed from
 *     THEIR OWN schedule. The honest question — can training move the day the
 *     purchase lands? For a calendar or player-chosen tender the recomputation
 *     returns the identical list, so the arm is clean BY CONSTRUCTION rather
 *     than by luck, and the sweep proves the construction rather than assuming.
 *   - `'frozen'`: the diligent member is handed the LAZY member's purchase
 *     days. Same rule, same purse, same price; training simply cannot move the
 *     schedule. The matched control that isolates the keying from the size of
 *     the bank — see `COVERED_DAY_PURCHASE_SWEEP` for the unmatched cut that
 *     read the wrong way round.
 */
type PurchaseTreatment = 'frozen' | 'responsive';

interface PurchaseVerdict extends Verdict {
  /** Covered days the lazy members bought, summed over schedules. */
  readonly boughtByLazy: number;
  /** Covered days the diligent members bought, summed over PAIRS. */
  readonly boughtByDiligent: number;
  /** Highest `purchasedDaysLeft` any run reached. The "populated" check. */
  readonly peakPurchased: number;
}

/**
 * Judges one TENDER under one TREATMENT at one calendar length.
 *
 * THE LAZY MEMBER IS IDENTICAL ACROSS THE TWO TREATMENTS by construction: both
 * compute its purchase days from the same rule on the same schedule. So
 * `boughtByLazy` is a control that must come out equal between them, and the
 * callers assert exactly that rather than trusting the description.
 *
 * THE FUNDING RULE COMES FROM `purchaseArrivalOf`, so this function does not
 * know which tenders are training-keyed and cannot disagree with
 * `currencyProvenance.ts` about it.
 */
function judgePurchaseArm(
  length: number,
  tender: CoveredDayTender,
  treatment: PurchaseTreatment,
  options: RunOptions = DEFAULT,
): PurchaseVerdict {
  const arrival = purchaseArrivalOf(tender);
  let currentInversions = 0;
  let longestInversions = 0;
  let worstCurrentDeficit = 0;
  let worstLongestDeficit = 0;
  let pairsChecked = 0;
  let consumed = 0;
  let boughtByLazy = 0;
  let boughtByDiligent = 0;
  let peakPurchased = 0;
  let witness: string | null = null;

  for (const seed of MONOTONICITY_SWEEP.SEEDS) {
    const schedules = seededSchedules(seed, length).slice(0, COVERED_DAY_PURCHASE_SWEEP.SCHEDULES_PER_SEED);
    for (const schedule of schedules) {
      const lazyBuys = coveredDayPurchaseDays(schedule, arrival);
      const lazy = drive(schedule, { ...options, purchaseDays: lazyBuys });
      consumed += lazy.consumed;
      boughtByLazy += lazy.bought;
      peakPurchased = Math.max(peakPurchased, lazy.peakPurchased);
      for (const superset of singleDaySupersets(schedule)) {
        // THE ONE LINE THE WHOLE MEASUREMENT TURNS ON.
        const buys = treatment === 'responsive' ? coveredDayPurchaseDays(superset, arrival) : lazyBuys;
        const diligent = drive(superset, { ...options, purchaseDays: buys });
        pairsChecked += 1;
        boughtByDiligent += diligent.bought;
        peakPurchased = Math.max(peakPurchased, diligent.peakPurchased);
        const currentDeficit = lazy.currentStreak - diligent.currentStreak;
        const longestDeficit = lazy.longestStreak - diligent.longestStreak;
        if (currentDeficit > 0) {
          currentInversions += 1;
          if (currentDeficit > worstCurrentDeficit) {
            worstCurrentDeficit = currentDeficit;
            witness =
              `${renderSchedule(schedule)} (${lazy.currentStreak}, bought ${lazy.bought}) beats ` +
              `${renderSchedule(superset)} (${diligent.currentStreak}, bought ${diligent.bought})`;
          }
        }
        if (longestDeficit > 0) {
          longestInversions += 1;
          worstLongestDeficit = Math.max(worstLongestDeficit, longestDeficit);
        }
      }
    }
  }
  return {
    currentInversions,
    longestInversions,
    worstCurrentDeficit,
    worstLongestDeficit,
    pairsChecked,
    consumed,
    witness,
    boughtByLazy,
    boughtByDiligent,
    peakPurchased,
  };
}

/**
 * THE ALTERNATIVE PRODUCT: a purchased covered day that does NOT expire with its
 * window but accumulates — the hoard the old Recovery Day defect was made of.
 *
 * Modelled here rather than implemented, because the shipped module expires and
 * GDD §8.2 records the switch as a human's call. It keeps a `bank` beside the
 * real entitlement and spends the entitlement first, which is the same order
 * `afterSession` uses.
 */
function driveBankable(schedule: TrainingSchedule, buyDays: readonly number[]): RunResult {
  const tuning = RECOVERY_ENTITLEMENT;
  const windowAt = (day: number): number => windowIndexOf(tuning, 0, day);
  let entitlement = freshEntitlement(tuning, 0);
  let bank = 0;
  let currentStreak = 0;
  let longestStreak = 0;
  let lastTrainedDay: number | null = null;
  let consumed = 0;
  let bought = 0;
  let peakPurchased = 0;
  let refusedPurchases = 0;
  const resolveAt = (today: number): { missed: number; covers: boolean; take: number } => {
    const missed = Math.max(0, today - (lastTrainedDay ?? 0) - 1);
    const chargeable = Math.max(0, missed - GRACE);
    const available = coveredDaysAvailable(tuning, entitlement, windowAt(today)) + bank;
    const covers = chargeable <= Math.min(available, tuning.MAX_COVERED_DAYS_PER_ABSENCE);
    return { missed, covers, take: covers ? chargeable : available };
  };
  for (let i = 0; i < schedule.length; i += 1) {
    for (let k = 0; buyDays.length > 0 && k < buyDays.length; k += 1) {
      if (buyDays[k] !== i) continue;
      // THE STORE RULE APPLIES TO THIS PRODUCT TOO, or the two products are no
      // longer being compared like for like: one of them would be refusing sales
      // the other took, and the difference in the table would be the store rather
      // than the banking. This model has no armed snapshot, so its `covers` is
      // its own — which is the point, since it is a model of a different product.
      if (!resolveAt(i).covers) {
        refusedPurchases += 1;
        continue;
      }
      bank += COVERED_DAY_PURCHASE_SWEEP.COVERED_DAYS_PER_ORDER;
      bought += COVERED_DAY_PURCHASE_SWEEP.COVERED_DAYS_PER_ORDER;
      peakPurchased = Math.max(peakPurchased, bank);
    }
    if (lastTrainedDay !== null && i > lastTrainedDay) {
      const r = resolveAt(i);
      if (r.missed > 0 && !r.covers) {
        currentStreak = 0;
        lastTrainedDay = null;
      }
    }
    if (schedule[i] !== true) continue;
    const r = resolveAt(i);
    if (!r.covers) {
      currentStreak = 0;
      lastTrainedDay = null;
    }
    const base = coveredDaysAvailable(tuning, entitlement, windowAt(i));
    const fromBase = Math.min(base, r.take);
    bank -= r.take - fromBase;
    entitlement = afterSession(tuning, entitlement, windowAt(i), fromBase);
    consumed += r.take;
    currentStreak += 1;
    longestStreak = Math.max(longestStreak, currentStreak);
    lastTrainedDay = i;
  }
  const last = schedule.length - 1;
  if (lastTrainedDay !== null && last > lastTrainedDay) {
    const r = resolveAt(last);
    if (r.missed > 0 && !r.covers) currentStreak = 0;
  }
  return { currentStreak, longestStreak, consumed, bought, peakPurchased, refusedPurchases };
}

/** `judgePurchaseArm`, over the bankable product. Same axes, same matching. */
function judgeBankablePurchaseArm(
  length: number,
  tender: CoveredDayTender,
  treatment: PurchaseTreatment,
): PurchaseVerdict {
  const arrival = purchaseArrivalOf(tender);
  let currentInversions = 0;
  let longestInversions = 0;
  let worstCurrentDeficit = 0;
  let worstLongestDeficit = 0;
  let pairsChecked = 0;
  let consumed = 0;
  let boughtByLazy = 0;
  let boughtByDiligent = 0;
  let peakPurchased = 0;
  let witness: string | null = null;

  for (const seed of MONOTONICITY_SWEEP.SEEDS) {
    const schedules = seededSchedules(seed, length).slice(0, COVERED_DAY_PURCHASE_SWEEP.SCHEDULES_PER_SEED);
    for (const schedule of schedules) {
      const lazyBuys = coveredDayPurchaseDays(schedule, arrival);
      const lazy = driveBankable(schedule, lazyBuys);
      consumed += lazy.consumed;
      boughtByLazy += lazy.bought;
      peakPurchased = Math.max(peakPurchased, lazy.peakPurchased);
      for (const superset of singleDaySupersets(schedule)) {
        const buys = treatment === 'responsive' ? coveredDayPurchaseDays(superset, arrival) : lazyBuys;
        const diligent = driveBankable(superset, buys);
        pairsChecked += 1;
        boughtByDiligent += diligent.bought;
        const currentDeficit = lazy.currentStreak - diligent.currentStreak;
        const longestDeficit = lazy.longestStreak - diligent.longestStreak;
        if (currentDeficit > 0) {
          currentInversions += 1;
          if (currentDeficit > worstCurrentDeficit) {
            worstCurrentDeficit = currentDeficit;
            witness = `${renderSchedule(schedule)} beats ${renderSchedule(superset)}`;
          }
        }
        if (longestDeficit > 0) {
          longestInversions += 1;
          worstLongestDeficit = Math.max(worstLongestDeficit, longestDeficit);
        }
      }
    }
  }
  return {
    currentInversions,
    longestInversions,
    worstCurrentDeficit,
    worstLongestDeficit,
    pairsChecked,
    consumed,
    witness,
    boughtByLazy,
    boughtByDiligent,
    peakPurchased,
  };
}

function* exhaustivePairs(length: number): Generator<readonly [TrainingSchedule, TrainingSchedule]> {
  const count = exhaustiveCalendarCount(length);
  for (let mask = 0; mask < count; mask += 1) {
    const lazy = exhaustiveCalendar(mask, length);
    for (let flip = 0; flip < length; flip += 1) {
      if ((mask & (1 << flip)) !== 0) continue;
      yield [lazy, exhaustiveCalendar(mask | (1 << flip), length)] as const;
    }
  }
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe('the rolling entitlement', () => {
  it('is a pure module: no clock, no randomness, no React', () => {
    // Same mechanism `streak.test.ts` uses on `streak.ts`: read the source and
    // check the claim rather than believing the header.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const source: string = require('node:fs').readFileSync(
      require('node:path').join(__dirname, 'streakEntitlement.ts'),
      'utf8',
    );
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const banned of ['Date', 'Math.random', 'performance.now', 'react', 'window.', 'localStorage']) {
      expect(code.includes(banned), `streakEntitlement.ts must not reference ${banned}`).toBe(false);
    }
  });

  it('has exactly the fields the allowlist names', () => {
    const state = freshEntitlement(RECOVERY_ENTITLEMENT, 0);
    expect(Object.keys(state).sort()).toEqual([...ENTITLEMENT_FACT_KEYS].sort());
  });

  it('anchors its windows at the signup day, not at a calendar month', () => {
    const signup = 20_000;
    const W = RECOVERY_ENTITLEMENT.WINDOW_DAYS;
    expect(windowIndexOf(RECOVERY_ENTITLEMENT, signup, signup)).toBe(0);
    expect(windowIndexOf(RECOVERY_ENTITLEMENT, signup, signup + W - 1)).toBe(0);
    expect(windowIndexOf(RECOVERY_ENTITLEMENT, signup, signup + W)).toBe(1);
    expect(windowStartDay(RECOVERY_ENTITLEMENT, signup, signup + W + 3)).toBe(signup + W);
    // A different signup day moves the whole grid with it.
    expect(windowIndexOf(RECOVERY_ENTITLEMENT, signup + 1, signup + W)).toBe(0);
  });

  it('gives every lifter the same entitlement at the start of every window', () => {
    // THE WHOLE POINT OF THE REWORK, as an assertion. A lifter who spent
    // everything and one who spent nothing are identical once the window turns.
    const spent: EntitlementState = { windowIndex: 0, coveredDaysLeft: 0, purchasedDaysLeft: 0 };
    const untouched = freshEntitlement(RECOVERY_ENTITLEMENT, 0);
    expect(coveredDaysAvailable(RECOVERY_ENTITLEMENT, spent, 0)).toBe(0);
    expect(coveredDaysAvailable(RECOVERY_ENTITLEMENT, untouched, 0)).toBe(
      RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW,
    );
    expect(coveredDaysAvailable(RECOVERY_ENTITLEMENT, spent, 1)).toBe(
      coveredDaysAvailable(RECOVERY_ENTITLEMENT, untouched, 1),
    );
  });

  it('covers an absence it can afford and consumes exactly the chargeable days', () => {
    const state = freshEntitlement(RECOVERY_ENTITLEMENT, 0);
    const outcome = resolveEntitlement(RECOVERY_ENTITLEMENT, state, 0, 1);
    expect(outcome.covers).toBe(true);
    expect(outcome.consumed).toBe(1);
    expect(outcome.availableAfter).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW - 1);
  });

  it('BURNS THE REST OF THE WINDOW on an absence it cannot afford', () => {
    // GDD §4.2 RULE 2, carried into the new mechanic. The battery below
    // measures what happens when this is removed: 673 violating pairs.
    const state = freshEntitlement(RECOVERY_ENTITLEMENT, 0);
    const doomed = resolveEntitlement(RECOVERY_ENTITLEMENT, state, 0, 99);
    expect(doomed.covers).toBe(false);
    expect(doomed.consumed).toBe(state.coveredDaysLeft);
    expect(doomed.availableAfter).toBe(0);
  });

  it('caps what ONE absence may draw, separately from the window rate', () => {
    const rich: EntitlementTuning = { ...RECOVERY_ENTITLEMENT, COVERED_DAYS_PER_WINDOW: 9 };
    const state = freshEntitlement(rich, 0);
    const outcome = resolveEntitlement(rich, state, 0, rich.MAX_COVERED_DAYS_PER_ABSENCE + 1);
    expect(outcome.availableBefore).toBe(9);
    expect(outcome.drawableByThisAbsence).toBe(rich.MAX_COVERED_DAYS_PER_ABSENCE);
    expect(outcome.covers, 'a week away must not be affordable however wide the window is').toBe(false);
    expect(MAX_COVERED_DAYS_ONE_ABSENCE_MAY_DRAW).toBeLessThanOrEqual(
      RECOVERY_ENTITLEMENT.MAX_COVERED_DAYS_PER_ABSENCE,
    );
  });

  it('spends the granted entitlement before the purchased one', () => {
    const bought = creditCoveredDays(RECOVERY_ENTITLEMENT, freshEntitlement(RECOVERY_ENTITLEMENT, 0), 0, 1, 'purchase').state;
    const after = afterSession(RECOVERY_ENTITLEMENT, bought, 0, 1);
    expect(after.coveredDaysLeft).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW - 1);
    expect(after.purchasedDaysLeft).toBe(1);
  });

  it('expires a purchased covered day with its window — nothing accumulates', () => {
    // The property that makes a purchase monotone-safe where a purchased
    // Recovery Day was not, and the thing store copy has to say out loud.
    const bought = creditCoveredDays(RECOVERY_ENTITLEMENT, freshEntitlement(RECOVERY_ENTITLEMENT, 0), 0, 3, 'purchase').state;
    expect(coveredDaysAvailable(RECOVERY_ENTITLEMENT, bought, 0)).toBe(
      RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW + 3,
    );
    expect(coveredDaysAvailable(RECOVERY_ENTITLEMENT, bought, 1)).toBe(
      RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW,
    );
    expect(afterSession(RECOVERY_ENTITLEMENT, bought, 1, 0).purchasedDaysLeft).toBe(0);
  });

  it('a purchase can never buy through the per-absence ceiling', () => {
    // THE PAY-TO-WIN LINE, in the one place money touches the mechanic. Buying
    // ten covered days does not make a week away survivable, because the
    // ceiling is per absence and money cannot reach it.
    let state = freshEntitlement(RECOVERY_ENTITLEMENT, 0);
    for (let i = 0; i < 10; i += 1) state = creditCoveredDays(RECOVERY_ENTITLEMENT, state, 0, 1, 'purchase').state;
    const outcome = resolveEntitlement(
      RECOVERY_ENTITLEMENT,
      state,
      0,
      RECOVERY_ENTITLEMENT.MAX_COVERED_DAYS_PER_ABSENCE + 1,
    );
    expect(outcome.availableBefore).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW + 10);
    expect(outcome.covers).toBe(false);
  });

  it('refuses nonsense rather than absorbing it', () => {
    const state = freshEntitlement(RECOVERY_ENTITLEMENT, 0);
    expect(() => resolveEntitlement(RECOVERY_ENTITLEMENT, state, 0, -1)).toThrow(RangeError);
    expect(() => resolveEntitlement(RECOVERY_ENTITLEMENT, state, 0, 1.5)).toThrow(RangeError);
    expect(() => afterSession(RECOVERY_ENTITLEMENT, state, 0, -1)).toThrow(RangeError);
    expect(() => creditCoveredDays(RECOVERY_ENTITLEMENT, state, 0, 0, 'purchase')).toThrow(RangeError);
    expect(() => creditCoveredDays(RECOVERY_ENTITLEMENT, state, 0, 1.5, 'purchase')).toThrow(RangeError);
  });

  it('never mutates the state it is given', () => {
    const state = freshEntitlement(RECOVERY_ENTITLEMENT, 0);
    const copy = { ...state };
    resolveEntitlement(RECOVERY_ENTITLEMENT, state, 3, 2);
    afterSession(RECOVERY_ENTITLEMENT, state, 3, 2);
    creditCoveredDays(RECOVERY_ENTITLEMENT, state, 3, 2, 'purchase');
    expect(state).toEqual(copy);
  });
});

// ---------------------------------------------------------------------------
// GDD §8.3E CONDITION 1 — a purchased day is a genuinely distinct source
// ---------------------------------------------------------------------------

describe('a purchased covered day has a provenance, and the provenance is on the CREDIT only', () => {
  it('lands in a different counter from a free covered day, and that is the provenance', () => {
    // NOT "the same number arriving under two names". The two sources write two
    // different fields, so a state carrying a bought day and a state carrying a
    // free one are DISTINGUISHABLE — which is the thing the previous design
    // could not do and the thing condition 3 needs in order to be statable.
    const fresh = freshEntitlement(RECOVERY_ENTITLEMENT, 0);
    const free = creditCoveredDays(RECOVERY_ENTITLEMENT, fresh, 0, 1, 'window-entitlement');
    const bought = creditCoveredDays(RECOVERY_ENTITLEMENT, fresh, 0, 1, 'purchase');

    expect(free.state).not.toEqual(bought.state);
    expect(free.state.coveredDaysLeft).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW + 1);
    expect(free.state.purchasedDaysLeft).toBe(0);
    expect(bought.state.coveredDaysLeft).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    expect(bought.state.purchasedDaysLeft).toBe(1);

    // And the source is REPORTED rather than only used — GDD §12.3's "reported,
    // never silent" applied to the credit as well as to the spend.
    expect(free.source).toBe('window-entitlement');
    expect(bought.source).toBe('purchase');
  });

  it('[one-source-credits-a-purchased-day] is credited by EXACTLY ONE source, and that source is the purchase', () => {
    // Condition 3, at the level of the map rather than of the code. Re-point
    // `'window-entitlement'` at `purchasedDaysLeft` — which is what "an earned
    // day is really a purchased day" would look like as a diff — and this stops
    // being a single source.
    expect(SOURCES_THAT_CREDIT_A_PURCHASED_DAY).toEqual(['purchase']);
    expect(COVERAGE_SOURCE_COUNTER['window-entitlement']).toBe('coveredDaysLeft');
    expect(COVERAGE_SOURCE_COUNTER.purchase).toBe('purchasedDaysLeft');
    // Every source has to name a real field, or the map is a spelling exercise.
    for (const source of COVERAGE_SOURCES) {
      expect(ENTITLEMENT_FACT_KEYS).toContain(COVERAGE_SOURCE_COUNTER[source]);
    }
    // No source may be added without a decision: the map is exhaustive over the
    // list, and the list is exhaustive over the map.
    expect(Object.keys(COVERAGE_SOURCE_COUNTER).sort()).toEqual([...COVERAGE_SOURCES].sort());
  });

  it('refuses a source that is not one of the two, rather than defaulting to the free side', () => {
    const state = freshEntitlement(RECOVERY_ENTITLEMENT, 0);
    // A caller reaching this module from untyped JSON — a server payload, a
    // migration — must not have "unknown source" silently mean "free".
    expect(() =>
      creditCoveredDays(RECOVERY_ENTITLEMENT, state, 0, 1, 'achievement' as CoverageSource),
    ).toThrow(RangeError);
    expect(() => creditCoveredDays(RECOVERY_ENTITLEMENT, state, 0, 1, '' as CoverageSource)).toThrow(RangeError);
  });

  it('SPENDS IDENTICALLY: the split is invisible to every decision, at every split of every sum', () => {
    // THE RESOLUTION OF THE TENSION §4(c) OF `streak.ts` USED TO HOLD. That
    // paragraph banned provenance because a bought covered day must not behave
    // differently from a free one. The ban was about the SPEND path, and this is
    // what makes it true rather than promised: for the shipped EXPIRING product,
    // `(b, p)` and `(b + p, 0)` are indistinguishable forever.
    //
    // PROVED OVER THE SPLITS RATHER THAN ARGUED, because "nothing reads it" is
    // exactly the kind of claim that stops being true one refactor later.
    let checked = 0;
    for (let total = 0; total <= 8; total += 1) {
      for (let purchased = 0; purchased <= total; purchased += 1) {
        const split: EntitlementState = {
          windowIndex: 3,
          coveredDaysLeft: total - purchased,
          purchasedDaysLeft: purchased,
        };
        const merged: EntitlementState = { windowIndex: 3, coveredDaysLeft: total, purchasedDaysLeft: 0 };
        for (const windowNow of [3, 4]) {
          expect(coveredDaysAvailable(RECOVERY_ENTITLEMENT, split, windowNow)).toBe(
            coveredDaysAvailable(RECOVERY_ENTITLEMENT, merged, windowNow),
          );
          for (let chargeable = 0; chargeable <= 6; chargeable += 1) {
            expect(resolveEntitlement(RECOVERY_ENTITLEMENT, split, windowNow, chargeable)).toEqual(
              resolveEntitlement(RECOVERY_ENTITLEMENT, merged, windowNow, chargeable),
            );
            // And the states they leave behind are equivalent under the same
            // relation, so the equivalence survives arbitrarily many sessions
            // rather than holding for one.
            const afterSplit = afterSession(RECOVERY_ENTITLEMENT, split, windowNow, chargeable);
            const afterMerged = afterSession(RECOVERY_ENTITLEMENT, merged, windowNow, chargeable);
            expect(afterSplit.windowIndex).toBe(afterMerged.windowIndex);
            expect(afterSplit.coveredDaysLeft + afterSplit.purchasedDaysLeft).toBe(
              afterMerged.coveredDaysLeft + afterMerged.purchasedDaysLeft,
            );
            checked += 1;
          }
        }
      }
    }
    expect(checked).toBe(45 * 2 * 7);
  });

  it('AND `resolveEntitlement` HAS NOWHERE TO PUT A SOURCE — three arguments, and the state is one', () => {
    // The structural half of the test above. A behavioural proof that nothing
    // reads the split cannot stop a fourth parameter being added tomorrow; this
    // fails the moment one is.
    expect(resolveEntitlement).toHaveLength(4); // tuning, state, windowNow, chargeableDays
    expect(afterSession).toHaveLength(4); // tuning, state, windowNow, consumed
    expect(coveredDaysAvailable).toHaveLength(3); // tuning, state, windowNow
    // The credit path is the one that grew a source, and only it.
    expect(creditCoveredDays).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// GDD §8.3E CONDITION 3 — never grantable, earnable or awarded. ENFORCED.
// ---------------------------------------------------------------------------

/**
 * THE SCAN'S PARAMETERS, IN ONE PLACE — CLAUDE.md's "keep every such value as a
 * named constant in one place", applied to a guard's knobs. The root, the
 * predicate, the predicate that was weighed against it and the two figures the
 * scan pins are named here rather than written inline in the tests below.
 *
 * The counts are MEASURED, at the commit that derived the file set. They are
 * pinned where a stale one would make a test blind and left unpinned where a
 * pin would only churn — each field says which, and why.
 */
const PURCHASED_DAY_SCAN = {
  /**
   * `src/`, the whole tree — and that is the change this constant exists to
   * record.
   *
   * The scan used to read a HARDCODED LIST OF THREE FILENAMES joined against
   * `__dirname`, which is `src/game/`. Two things followed, and the second is
   * the one that made the guard weaker than it read:
   *
   *   - a module in any other directory was unreachable BY CONSTRUCTION, not by
   *     omission — no edit to the list could have reached `src/shell/`, because
   *     the reader could not leave `src/game/`; and
   *   - the list's own comment argued that a THIRD file had to be added because
   *     the laundered path was invisible to the other two. That argument
   *     generalises to a fourth file and nothing derived it, so the set that
   *     was scanned and the set that mattered had already come apart: at the
   *     commit this was written on, `progression.ts` named the purchased
   *     counter and was NOT scanned, while `currencyProvenance.ts` was scanned
   *     and named neither the counter nor the source.
   *
   * Deriving the set from the tree is what makes "whatever it is called" in
   * `COVERED_DAY_TOUCHING_FUNCTIONS`'s header also mean "wherever it is
   * written".
   */
  ROOT: path.join(__dirname, '..'),

  /**
   * WHAT MAKES A DECLARATION INTERESTING: two WORDS — a purchase, or a covered
   * day — rather than the identifiers that carry either.
   *
   * THE SECOND ALTERNATIVE IS THIS ROUND'S FIX, AND THE FIRST ALONE WAS A
   * MEASURED HOLE. `/purchas/i` was what shipped, and the rule it stands in
   * front of is not about purchases: CLAUDE.md says *"no grant of COVERED days
   * may be keyed to anything the lifter does"*, and `COVERAGE_SOURCES` declares
   * two sources of which `'window-entitlement'` is the free side. A declaration
   * that grants coverage through that source contains no form of the word
   * "purchase", so the guard could not see it — the same shape as the
   * `__dirname` ceiling the previous round removed, one axis over.
   *
   * CHOSEN BY MEASUREMENT, and every losing option is pinned as a live value
   * below so the choice is re-runnable rather than a claim in prose. On this
   * tree: narrow 18/3, purchase-word-only 57/7, credit-token 58/7, this one
   * 88/7. THE FILE SET DOES NOT GROW — the widening costs 31 allowlist entries
   * and reaches no new module, so `FILES_THAT_NAME_A_COVERED_DAY` keeps every
   * bit of the signal it had.
   *
   * WHAT IT COSTS, said plainly: 31 more names, and most of them cannot grant
   * anything — `openDay`, `settleBrokenStreak` and `resolveEntitlement` are
   * spend-side, `currencyProvenance.ts`'s ten are the tender partition, and
   * `RECOVERY_ENTITLEMENT` is a frozen tuning block. The allowlist is now
   * mostly things that merely SAY "covered day". That is the deliberate trade
   * this codebase has already made once in the same place: a larger honest
   * allowlist over a narrower one with a known hole in it.
   *
   * THE THIRD ALTERNATIVE COSTS NOTHING AND IS NOT REDUNDANT. `covered.?day`
   * does NOT match the bare source literal `'window-entitlement'` — measured,
   * after an earlier draft of this file asserted it did and went red. Adding
   * the literal admits 0 further declarations on this tree and 0 further
   * files, and it is what makes `CREDIT_PATH_TOKENS` a subset of this by
   * CONSTRUCTION rather than by tree-accident: every token in that predicate
   * (`purchas`, `creditCoveredDays`, `window-entitlement`, `coveredDaysLeft`)
   * is matched here. A free alternative that closes a real token gap.
   */
  NAMES_A_COVERED_DAY_OR_A_PURCHASE: /purchas|covered.?day|window-entitlement/i,

  /**
   * THE PREDICATE THAT SHIPPED BEFORE THIS ROUND, kept as a live value rather
   * than described, because it is what makes the widening demonstrably
   * non-vacuous: `AND THE SCAN CAN SEE A NEW ONE` drives a synthetic
   * covered-day granter through BOTH and asserts this one misses it. Without
   * that, nothing would distinguish the new alternative from decoration.
   */
  PURCHASE_WORD_ONLY: /purchas/i,

  /**
   * THE TEMPTING FIX, AND IT IS HERE BECAUSE IT IS MEASURABLY NOT ENOUGH.
   *
   * The obvious way to close the `'window-entitlement'` hole is to add the
   * tokens on the credit path — the one credit function, the free source, the
   * free counter. It does catch the probe. It is BLIND TO THE SIBLING MUTANT:
   * a widener that fabricates an `EntitlementTuning` with
   * `COVERED_DAYS_PER_WINDOW` keyed to a session count never calls
   * `creditCoveredDays`, never names the source and never touches
   * `coveredDaysLeft`. Measured: with that mutant in the tree this predicate
   * reports the same 58 declarations in the same 7 files it reports on a clean
   * one, while `NAMES_A_COVERED_DAY_OR_A_PURCHASE` goes to 89 in 8.
   *
   * That is the rejected narrow predicate's failure repeating one level out —
   * a list of tokens somebody thought of, walked around by a mutant using a
   * token they did not. It is pinned so the argument is re-runnable.
   */
  CREDIT_PATH_TOKENS: /purchas|creditCoveredDays|window-entitlement|coveredDaysLeft/i,

  /**
   * The narrowest predicate, weighed and rejected a round before this one. Kept
   * as a live value, not a sentence, so `THE PREDICATE WAS CHOSEN BY
   * MEASUREMENT` can re-derive the comparison instead of quoting it.
   *
   * ITS SECOND ALTERNATIVE IS A TEXTUAL MATCH, NOT A TYPE, and that is not a
   * detail: `'purchase'` is the `CoverageSource` this module cares about AND a
   * `ProposalOriginKind` in `progression.ts`, spelled identically. Four of the
   * six declarations the narrow predicate finds in that file are the origin
   * kind, not the coverage source. So even the "narrow" option is looser than
   * its name suggests, which is a further reason not to trust it as the
   * precise-looking alternative — measured, because the first draft of the
   * comment on the allowlist's `progression.ts` section read those four as
   * covered-day code and said so.
   */
  NAMES_THE_COUNTER_OR_THE_SOURCE: /purchasedDaysLeft|'purchase'/,

  /**
   * Immediate subdirectories of `src/`. PINNED, and pinned on purpose despite
   * the churn: a new top-level directory is the one tree change that can
   * introduce a whole region the walk has never been shown to reach, and the
   * cheapest way to make somebody look at it is to make it a red line here.
   *
   * It is also the anti-vacuity floor for the reach test. Without it, a
   * `readdirSync` that returned nothing would leave that test comparing two
   * empty sets — CLAUDE.md's "an empty domain" shape, exactly.
   */
  SOURCE_DIRECTORIES: 12,

  /**
   * The files that currently contain at least one matching declaration, as
   * paths relative to `src/`.
   *
   * THIS IS THE OLD HARDCODED LIST, INVERTED FROM AN INPUT INTO AN OUTPUT, and
   * the inversion is the whole point. As an input it SCOPED the scan, so a file
   * missing from it was invisible. As an output it is ASSERTED, so a file
   * missing from it is a red test naming the file — and a reviewer still gets
   * the file-level signal that the wider allowlist would otherwise dilute.
   *
   * NOT pinned as a bare count: the set is what carries the information, and a
   * count would pass while two files swapped places.
   */
  FILES_THAT_NAME_A_COVERED_DAY: [
    'empire/empireCore.ts',
    'empire/empireInvariant.ts',
    'empire/engagement.ts',
    'empire/expansion.ts',
    'empire/reputation.ts',
    'game/currencyProvenance.ts',
    'game/progression.ts',
    'game/streak.ts',
    'game/streakEntitlement.ts',
    'game/streakSweep.ts',
    'tuning/audit.ts',
  ] as readonly string[],

  /**
   * What each candidate predicate found when the choice was made, as
   * `[declarations, files]`. Pinned so that narrowing the predicate on the
   * belief that it is equivalent fails with the numbers next to it.
   *
   * READ THE FILE COLUMN. Widening from the purchase word to the covered day
   * costs 31 declarations and reaches NO new file — the hole it closed was
   * inside modules the scan was already reading, which is why nothing about the
   * file-level pin caught it. (36 and one file at the counts below, which moved
   * when GDD §5's day anchor added five declarations to `empire/engagement.ts`,
   * a file the purchase word had not previously reached.)
   */
  COVERAGE_FOUND: [99, 11] as readonly [number, number],
  PURCHASE_WORD_FOUND: [68, 11] as readonly [number, number],
  CREDIT_PATH_FOUND: [69, 11] as readonly [number, number],
  NARROW_FOUND: [18, 3] as readonly [number, number],
} as const;

/**
 * THE SYMBOL-RESOLVED PASS'S PARAMETERS, IN ONE PLACE — the same discipline
 * `PURCHASED_DAY_SCAN` above applies to the textual scan, applied to the pass
 * that stands beside it.
 *
 * WHY THERE ARE TWO PASSES AND NOT ONE REPLACING THE OTHER. The textual scan
 * finds 94 declarations in 10 files; this one finds 32 in 2. Neither is a subset
 * of the other and each is blind exactly where the other looks:
 *
 *   - The textual scan reads WORDS, so it sees `EMPIRE_FORBIDDEN_OUTPUTS`
 *     naming `'covered-day'` as a forbidden idle-layer output, the tender
 *     partition in `currencyProvenance.ts`, and `RECOVERY_ENTITLEMENT`'s frozen
 *     tuning block — none of which CALL anything. A checker pass keyed on
 *     "reaches the credit path" resolves no identifier in any of them and would
 *     drop all 88 down to 32, which is why replacing was rejected.
 *   - This pass reads SYMBOLS, so an identifier that reaches the covered-day
 *     machinery under any spelling is seen. That is the hole the textual scan's
 *     own comment pinned as unclosable by any predicate it could carry.
 *
 * THE HOLE WAS EXECUTED, NOT REASONED ABOUT, and the executed version is not
 * the one that was written down. The limit as recorded read
 * `import { creditCoveredDays as credit }` alone — but a body that still spells
 * the source `'window-entitlement'` is caught by the shipped predicate's third
 * alternative, and planting exactly that mutant reddened three tests. The
 * evasion needs BOTH ends aliased: the function AND the source. Appended to
 * `src/shell/appServer.ts`:
 *
 *     import {
 *       creditCoveredDays as credit,
 *       COVERAGE_SOURCES as SOURCES,
 *       RECOVERY_ENTITLEMENT,
 *       type EntitlementState,
 *     } from '../game/streakEntitlement';
 *
 *     export function widenForTenSessions(
 *       state: EntitlementState, w: number, sessions: number,
 *     ): EntitlementState {
 *       return credit(RECOVERY_ENTITLEMENT, state, w, sessions, SOURCES[0]).state;
 *     }
 *
 * That grants a covered day per training session — CLAUDE.md measures the
 * every-N-sessions shape at **1156 violating pairs** against 0 on a fixed
 * calendar day. With it in the tree `streakEntitlement.test.ts`,
 * `tuning/audit.test.ts` and `guaranteeTags.test.ts` ran **105 tests, all
 * green**, and `tsc --noEmit` exited 0. It would have shipped.
 *
 * A LOCALLY DECLARED SOURCE DOES NOT EVADE, and that is why the mutant imports
 * `COVERAGE_SOURCES` rather than writing `const SRC = 'window-entitlement'`:
 * such a const is itself a top-level declaration whose own body carries the
 * literal, so the textual scan reddens on `SRC`. The literal has to come from
 * somewhere else entirely, which is precisely what an import is.
 */
const COVERED_DAY_SYMBOL_SCAN = {
  /**
   * The module whose exports are the covered-day machinery. Every export of it
   * is guarded — the set is asked of the CHECKER via `getExportsOfModule`, not
   * listed here, because a hand-list is "the tokens somebody thought of" and
   * that is the failure mode `CREDIT_PATH_TOKENS` above is pinned to record.
   * Adding an export to `streakEntitlement.ts` widens this pass automatically.
   */
  GUARDED_MODULE: 'game/streakEntitlement.ts',

  /**
   * How many symbols that module exports. PINNED as the anti-vacuity floor for
   * the whole pass: if `getExportsOfModule` ever returns an empty set — a
   * mis-resolved path, a program built with no root files — every declaration
   * would resolve to nothing, the pass would find nothing, and its set equality
   * would pass against an empty expectation. This is the line that reddens
   * instead.
   */
  GUARDED_EXPORTS: 21,

  /**
   * `[declarations, files]` this pass finds on a clean tree. Counts, not
   * bounds. The file column is the one that moves when a granter appears in a
   * module that has never touched the entitlement before — which is exactly
   * what the aliased mutant does, taking it to 3.
   */
  SYMBOL_FOUND: [32, 2] as readonly [number, number],

  /**
   * The declarations THIS PASS FINDS AND THE TEXTUAL SCAN CANNOT — the measured
   * value of adding it, pinned as names rather than as a count so a swap is
   * visible. Nine, and none of them says `purchas`, `covered day` or
   * `window-entitlement` anywhere in its body; each reaches the entitlement
   * through an identifier instead.
   *
   * NON-EMPTY IS THE POINT. If this list were empty the pass would be
   * decoration: everything it found would already be found by a regex.
   */
  SYMBOL_ONLY_NAMES: [
    'CoverageSource',
    'ENTITLEMENT_REACH_IS_COVERAGE_ONLY',
    'EntitlementFactKey',
    'EntitlementOutcome',
    'StreakState',
    'createStreakState',
    'entitlementWindowFor',
    'windowIndexOf',
    'windowStartDay',
  ] as readonly string[],

  /**
   * Declarations reached ONLY by following an import alias — i.e. the resolved
   * symbol's own file is not the file the identifier is written in. PINNED
   * NON-ZERO because this is the single line that reddens if
   * `getAliasedSymbol` stops being called: without alias-following every
   * cross-module reference resolves to the local import binding instead of the
   * export, `streak.ts` drops out entirely, and the pass silently shrinks to
   * "declarations inside streakEntitlement.ts itself".
   *
   * `cutInWiring.test.ts` records a builder having broken exactly that call by
   * hand and reverted it. This is the same failure, made loud here.
   */
  CROSS_MODULE_FOUND: 11,

  /**
   * The union of both passes, which is what `COVERED_DAY_TOUCHING_FUNCTIONS` is
   * asserted equal to. 88 textual + 9 symbol-only = 97.
   */
  UNION_FOUND: 108,

  /**
   * WHAT THIS PASS STILL DOES NOT SEE, pinned as a red line rather than implied
   * away, the way the textual scan's own limit was.
   *
   * A declaration that reaches the entitlement through a value the checker
   * cannot follow to an export — `const f: unknown = mod['creditCoveredDays']`,
   * a dynamic `await import()`, a `Function` constructor — resolves to no
   * guarded symbol and is invisible here. So is a granter written INSIDE a
   * declaration that is already on the allowlist, which is the floor-not-ceiling
   * limit the allowlist header already states and which `streak.test.ts`'s
   * behavioural drive is what actually covers.
   *
   * WHAT IT DOES SEE, ALSO MEASURED: the re-alias shape
   * `import * as E from '...'; E.creditCoveredDays(...)`. The property name in
   * a `PropertyAccessExpression` is an identifier the checker resolves straight
   * to the export, so the namespace spelling is caught by this pass — and it is
   * additionally caught by the TEXTUAL scan, because `E.creditCoveredDays`
   * contains the substring `CoveredDay`. Both are asserted below rather than
   * assumed.
   */
  DYNAMIC_ACCESS_IS_NOT_COVERED: true,
} as const;

/**
 * Files the scan reads: every non-test `.ts`/`.tsx` under `dir`, recursively.
 *
 * THE THIRD COPY OF THIS WALKER IN THE TREE, said rather than hidden — the
 * other two are in `guaranteeTags.test.ts` and `spriteMarks.test.ts` and are
 * byte-identical to each other. It is not extracted to a shared home because
 * that home would have to be a new fs-touching module and `src/game/` is
 * pure-logic-only; the honest consequence is that a future exclusion added to
 * one copy does not reach this one. That direction is the safe one — this copy
 * would scan MORE files, which fails loud, never silent — but it is a real
 * drift surface and it is recorded here rather than left for a reader to find.
 *
 * Test files are excluded because they discuss the counter constantly and
 * cannot award anything: nothing a test declares ships.
 */
function scannedFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      out.push(...scannedFilesUnder(full));
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out.sort();
}

describe('nothing can award a purchased covered day, and that is enforced rather than absent', () => {
  const stripComments = (source: string): string =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  const read = (absolutePath: string): string => stripComments(readFileSync(absolutePath, 'utf8'));

  /** Every scanned file as `[pathRelativeToSrc, commentStrippedSource]`. */
  const scannedSources = (): readonly (readonly [string, string])[] =>
    scannedFilesUnder(PURCHASED_DAY_SCAN.ROOT).map(
      (file) =>
        [path.relative(PURCHASED_DAY_SCAN.ROOT, file).split(path.sep).join('/'), read(file)] as const,
    );

  /**
   * Every declaration in the tree matching `predicate`, as `file::name`. The
   * two predicates share this so a change to the scan cannot move one and leave
   * the other measuring something else.
   */
  const matchesIn = (predicate: RegExp): { qualified: string[]; names: string[]; files: string[] } => {
    const qualified: string[] = [];
    const names = new Set<string>();
    const files = new Set<string>();
    for (const [rel, source] of scannedSources()) {
      for (const [name, body] of declarations(source)) {
        if (!predicate.test(body)) continue;
        qualified.push(`${rel}::${name}`);
        names.add(name);
        files.add(rel);
      }
    }
    return { qualified, names: [...names].sort(), files: [...files].sort() };
  };

  /**
   * Every TOP-LEVEL DECLARATION in a module, as `[name, body]`. Functions and
   * consts both, because a const holding an arrow function is a function and a
   * guard that only looked at `function` keywords would be walked around by one.
   */
  const declarations = (code: string): readonly (readonly [string, string])[] => {
    const pattern = /^(?:export )?(?:declare )?(?:async )?(?:function|const|let|class|interface|type)\s+(\w+)/gm;
    const starts: { name: string; at: number }[] = [];
    for (const match of code.matchAll(pattern)) {
      starts.push({ name: match[1] as string, at: match.index as number });
    }
    return starts.map(({ name, at }, index) => {
      const end = index + 1 < starts.length ? (starts[index + 1] as { at: number }).at : code.length;
      return [name, code.slice(at, end)] as const;
    });
  };

  /**
   * THE SYMBOL-RESOLVED PASS. Every top-level declaration under `src/` that
   * mentions an identifier resolving — THROUGH IMPORT ALIASES AND RE-EXPORTS —
   * to an export of `streakEntitlement.ts`.
   *
   * BUILT ONCE AND MEMOISED. A `ts.Program` over `tsconfig.json`'s 185 files
   * costs ~3.6s and the walk ~1.5s; three tests read it, and building three
   * programs would be three resolutions of the same types that could disagree.
   */
  interface SymbolPass {
    readonly qualified: readonly string[];
    readonly names: readonly string[];
    readonly files: readonly string[];
    readonly guardedExports: readonly string[];
    /** Qualified names reached only by following an import alias out of the file. */
    readonly crossModule: readonly string[];
  }
  let symbolPassMemo: SymbolPass | null = null;

  /**
   * The pass, over a program that may carry ONE SYNTHETIC MODULE that is not on
   * disk.
   *
   * THE SYNTHETIC ARM IS WHY THIS TAKES A PARAMETER, and it is what gives this
   * pass the tripwire the textual scan already has in `AND THE SCAN CAN SEE A
   * NEW ONE`. Without it the pass's every assertion is a statement about a tree
   * that contains no granter, so a pass that had quietly stopped resolving
   * anything would satisfy all of them — CLAUDE.md's "an empty domain",
   * exactly. The probe below plants the two evasions in a module the checker
   * compiles for real, so the resolution being asserted is the same resolution
   * the shipped arm runs.
   */
  const runPass = (synthetic?: { readonly rel: string; readonly text: string }): SymbolPass => {
    const repoRoot = path.join(PURCHASED_DAY_SCAN.ROOT, '..');
    const configPath = path.join(repoRoot, 'tsconfig.json');
    const config = ts.readConfigFile(configPath, ts.sys.readFile).config as unknown;
    const parsed = ts.parseJsonConfigFileContent(config, ts.sys, repoRoot);
    if (parsed.fileNames.length === 0) {
      throw new Error('tsconfig.json resolved to no files — the symbol pass would find nothing');
    }
    const options = { ...parsed.options, noEmit: true, skipLibCheck: true };
    const roots = [...parsed.fileNames];

    let host: ts.CompilerHost | undefined;
    if (synthetic !== undefined) {
      const syntheticPath = path.join(PURCHASED_DAY_SCAN.ROOT, synthetic.rel);
      if (roots.includes(syntheticPath)) {
        throw new Error(`${synthetic.rel} exists on disk — the probe would grade a real file`);
      }
      roots.push(syntheticPath);
      const base = ts.createCompilerHost(options);
      const readFileBase = base.readFile.bind(base);
      const getSourceFileBase = base.getSourceFile.bind(base);
      const fileExistsBase = base.fileExists.bind(base);
      host = {
        ...base,
        fileExists: (fileName) => fileName === syntheticPath || fileExistsBase(fileName),
        readFile: (fileName) =>
          fileName === syntheticPath ? synthetic.text : readFileBase(fileName),
        getSourceFile: (fileName, languageVersion, onError, shouldCreate) =>
          fileName === syntheticPath
            ? ts.createSourceFile(syntheticPath, synthetic.text, languageVersion, true)
            : getSourceFileBase(fileName, languageVersion, onError, shouldCreate),
      };
    }

    const program = ts.createProgram(roots, options, host);
    const checker = program.getTypeChecker();

    const guardedFile = path.join(PURCHASED_DAY_SCAN.ROOT, COVERED_DAY_SYMBOL_SCAN.GUARDED_MODULE);
    const guardedSource = program.getSourceFile(guardedFile);
    if (guardedSource === undefined) {
      throw new Error(`${COVERED_DAY_SYMBOL_SCAN.GUARDED_MODULE} is not in the program`);
    }
    const guardedModuleSymbol = checker.getSymbolAtLocation(guardedSource);
    if (guardedModuleSymbol === undefined) {
      throw new Error(`${COVERED_DAY_SYMBOL_SCAN.GUARDED_MODULE} has no module symbol`);
    }
    const guardedSymbols = checker.getExportsOfModule(guardedModuleSymbol);
    const guarded = new Set(guardedSymbols);

    /*
     * WHERE AN IDENTIFIER IS DECLARED, ASKED OF THE CHECKER RATHER THAN OF ITS
     * SPELLING. `SymbolFlags.Alias` is what an imported binding is, so following
     * it turns "a local thing spelled `credit`" into "streakEntitlement.ts's
     * exported `creditCoveredDays`". `getAliasedSymbol` follows a whole
     * re-export chain, so a barrel between caller and declaration resolves the
     * same way.
     *
     * THIS IS THE THIRD COPY OF THESE FOUR LINES IN THE TREE, SAID PLAINLY
     * RATHER THAN LEFT FOR A READER TO FIND. The others are
     * `progression.test.ts`'s `resolvedSymbolOf` and `cutInWiring.test.ts`'s
     * two. CLAUDE.md's "a twin guard must READ the sibling's list, not copy it"
     * is about LISTS, and this pass does read its list from the checker rather
     * than copying one — but the RESOLVER is duplicated, and that is the same
     * drift surface one level down. It is not extracted because the only home
     * both a `src/game/` test and a `src/cutin/` test could import is a new
     * non-test module under `src/`, which would itself be scanned by the pass
     * above and by `guaranteeTags.test.ts`, and `src/game/` is pure-logic-only.
     * `THE THREE RESOLVERS DO NOT DRIFT` below is what stands in for extraction:
     * it pins the idiom's occurrence count in all three files, so deleting the
     * alias step from any one of them is red.
     */
    const resolvedSymbolOf = (identifier: ts.Identifier): ts.Symbol | undefined => {
      const symbol = checker.getSymbolAtLocation(identifier);
      return symbol !== undefined && (symbol.flags & ts.SymbolFlags.Alias) !== 0
        ? checker.getAliasedSymbol(symbol)
        : symbol;
    };

    const qualified: string[] = [];
    const crossModule: string[] = [];
    const names = new Set<string>();
    const files = new Set<string>();

    for (const source of program.getSourceFiles()) {
      if (source.isDeclarationFile) continue;
      const rel = path
        .relative(PURCHASED_DAY_SCAN.ROOT, source.fileName)
        .split(path.sep)
        .join('/');
      // Same exclusions as the textual scan: inside `src/`, and not a test.
      if (rel.startsWith('..') || path.isAbsolute(rel)) continue;
      if (/\.test\.tsx?$/.test(rel)) continue;

      source.forEachChild((node) => {
        // The same declaration kinds the textual scan's regex matches.
        const declared: string[] = [];
        if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) {
          declared.push(node.name.text);
        } else if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
          declared.push(node.name.text);
        } else if (ts.isVariableStatement(node)) {
          for (const one of node.declarationList.declarations) {
            if (ts.isIdentifier(one.name)) declared.push(one.name.text);
          }
        }
        if (declared.length === 0) return;

        let hit = false;
        let viaAlias = false;
        const visit = (child: ts.Node): void => {
          if (ts.isIdentifier(child)) {
            const resolved = resolvedSymbolOf(child);
            if (resolved !== undefined && guarded.has(resolved)) {
              hit = true;
              // Declared elsewhere than where it is written: only an alias got
              // us here. This is what makes `getAliasedSymbol` load-bearing.
              const declaringFile = resolved.declarations?.[0]?.getSourceFile().fileName;
              if (declaringFile !== undefined && declaringFile !== source.fileName) viaAlias = true;
            }
          }
          child.forEachChild(visit);
        };
        visit(node);
        if (!hit) return;

        files.add(rel);
        for (const name of declared) {
          names.add(name);
          qualified.push(`${rel}::${name}`);
          if (viaAlias) crossModule.push(`${rel}::${name}`);
        }
      });
    }

    return {
      qualified,
      names: [...names].sort(),
      files: [...files].sort(),
      guardedExports: guardedSymbols.map((symbol) => symbol.getName()).sort(),
      crossModule,
    };
  };

  /** The shipped arm: the real tree, nothing planted. Memoised; three tests read it. */
  const symbolPass = (): SymbolPass => {
    if (symbolPassMemo === null) symbolPassMemo = runPass();
    return symbolPassMemo;
  };

  /**
   * THE TRIPWIRE, and it is the sibling of `AND THE SCAN CAN SEE A NEW ONE`.
   * Both evasions in one synthetic module the checker compiles for real:
   * `widenByAlias` renames the function AND imports the source so no literal
   * appears, and `widenByNamespace` reaches the same two through a namespace
   * import. `ordinaryHelper` is what stops a pass that matched EVERYTHING from
   * satisfying this.
   */
  const ALIAS_PROBE = {
    rel: 'game/__aliasProbe.ts',
    text: [
      "import { creditCoveredDays as credit, COVERAGE_SOURCES as SOURCES } from './streakEntitlement';",
      "import { RECOVERY_ENTITLEMENT, type EntitlementState } from './streakEntitlement';",
      "import * as E from './streakEntitlement';",
      '',
      'export function ordinaryHelper(a: number): number {',
      '  return a + 1;',
      '}',
      '',
      'export function widenByAlias(s: EntitlementState, w: number, n: number): EntitlementState {',
      '  return credit(RECOVERY_ENTITLEMENT, s, w, n, SOURCES[0]).state;',
      '}',
      '',
      'export function widenByNamespace(s: E.EntitlementState, w: number, n: number): E.EntitlementState {',
      '  return E.creditCoveredDays(E.RECOVERY_ENTITLEMENT, s, w, n, E.COVERAGE_SOURCES[0]).state;',
      '}',
      '',
    ].join('\n'),
  } as const;

  it('[the-covered-day-scan-reads-the-whole-tree] THE ALLOWLIST IS EXACT: every declaration that can name a covered day is listed, from anywhere under src/', { timeout: budgetFrom(8_711) }, () => {
    // THE GUARD THAT DOES NOT DEPEND ON WHAT A FUNCTION IS CALLED. The obvious
    // version of this test is a blocklist on `grant`, `credit`, `buy`, `award` —
    // and `streak.test.ts` carried exactly that until this round. It cannot
    // catch `markStreakMilestone` handing out a purchased day, because the
    // mutant uses none of those words.
    //
    // WHAT IT KEYS ON IS TWO WORDS — `purchas` OR a covered day — and the
    // second one is this round's fix. The predicate was `/purchas/i` alone,
    // which is not the rule: CLAUDE.md forbids a grant of COVERED days keyed to
    // training, and `COVERAGE_SOURCES` has TWO members. A function granting
    // coverage through `'window-entitlement'` says nothing resembling
    // "purchase", so it was invisible here — verified by planting one in
    // `src/shell/appServer.ts` and watching this file run 43 green tests over
    // it with `tsc --noEmit` clean. Any declaration whose body says `purchas`
    // or names a covered day, under any name and in any directory, has to
    // appear in `COVERED_DAY_TOUCHING_FUNCTIONS`.
    //
    // THE COUNTS ARE PINNED IN `THE PREDICATE WAS CHOSEN BY MEASUREMENT` below
    // rather than asserted in prose here: 18 / 57 / 58 / 88 declarations for
    // the narrow, purchase-word, credit-token and shipped predicates.
    //
    // EXACT IN BOTH DIRECTIONS, so a stale entry fails too — an allowlist that
    // can only grow is one nobody prunes and eventually one that permits
    // everything.
    //
    // THE SCAN READS THE WHOLE TREE NOW, AND THAT REPLACED A HARDCODED LIST OF
    // THREE FILENAMES. The reason the third file was added generalises: it was
    // added because the laundered path — an achievement pays Chalk, Chalk buys
    // a covered day — was invisible to the other two. The identical argument
    // reaches a fourth file, and nothing derived it. Worse, the reader it used
    // joined its argument against `__dirname`, so `src/game/` was a hard
    // ceiling: no entry could have named a module in another directory.
    //
    // The set had already come apart from the set that matters. At the commit
    // this was rewritten on, `progression.ts` named the purchased counter in
    // six declarations and was not scanned, while `currencyProvenance.ts` was
    // scanned and named neither the counter nor the source.
    //
    // The list of files is now an OUTPUT — see `FILES_THAT_NAME_A_COVERED_DAY`,
    // asserted in the test below — instead of the input that scoped the search.
    // BOTH PASSES, UNIONED INTO THE ONE ALLOWLIST. The textual scan below is
    // unchanged and its counts are still pinned; the symbol-resolved pass is
    // added beside it rather than replacing it, because neither is a subset of
    // the other — see `COVERED_DAY_SYMBOL_SCAN`'s header for the measurement
    // (88 textual / 32 symbol / 97 union) and for why replacing loses 65
    // declarations that merely SAY "covered day" and call nothing.
    //
    // ONE ALLOWLIST AND NOT TWO, deliberately: a second list is a second thing
    // to go stale, and the both-directions equality is what makes a removed
    // declaration red. A name is on this list if EITHER pass finds it.
    const textual = matchesIn(PURCHASED_DAY_SCAN.NAMES_A_COVERED_DAY_OR_A_PURCHASE);
    const symbols = symbolPass();
    const found = {
      qualified: [...textual.qualified, ...symbols.qualified],
      names: [...new Set([...textual.names, ...symbols.names])].sort(),
    };
    const allowed = new Set(COVERED_DAY_TOUCHING_FUNCTIONS);
    const seen = new Set(found.names);

    // A USEFUL RED, not just a red. CLAUDE.md: "a check that bites but fails
    // uselessly is half a check" — a bare set diff over 97 strings makes a
    // reader go and find which file grew a declaration, so the message carries
    // the qualified name and the allowlist carries only the bare one.
    const unlisted = found.qualified.filter((q) => !allowed.has(q.split('::')[1] as string));
    const stale = [...allowed].filter((name) => !seen.has(name)).sort();
    const drift = [
      unlisted.length > 0
        ? `declarations naming a covered day that COVERED_DAY_TOUCHING_FUNCTIONS does not list: ${unlisted.join(', ')}`
        : '',
      stale.length > 0 ? `allowlist entries no declaration matches any more: ${stale.join(', ')}` : '',
    ]
      .filter((line) => line !== '')
      .join(' | ');

    expect(found.names, drift).toEqual([...COVERED_DAY_TOUCHING_FUNCTIONS].sort());
    // THE ALLOWLIST ITSELF HAS NO DUPLICATES. `found.names` is deduplicated —
    // it has to be, because the list is of bare names and two files may legally
    // declare the same one — so without this a doubled entry would be a
    // permanent red nobody could satisfy, and a reader would reach for a
    // `Set` on both sides and lose the staleness half.
    expect([...new Set(COVERED_DAY_TOUCHING_FUNCTIONS)].length).toBe(
      COVERED_DAY_TOUCHING_FUNCTIONS.length,
    );
  });

  it('[the-covered-day-scan-follows-aliases] AN ALIASED IMPORT NO LONGER HIDES A GRANTER: identifiers are resolved through the checker', () => {
    const symbols = symbolPass();

    // NON-VACUITY FIRST, AND IN THE ORDER THAT MATTERS. Everything below is a
    // statement about a set the checker produced; if the checker produced an
    // empty set, every one of them would pass while measuring nothing. This is
    // the line that reddens on a mis-resolved path or a program with no roots.
    expect(
      symbols.guardedExports.length,
      `guarded exports of ${COVERED_DAY_SYMBOL_SCAN.GUARDED_MODULE}: ${symbols.guardedExports.join(', ')}`,
    ).toBe(COVERED_DAY_SYMBOL_SCAN.GUARDED_EXPORTS);

    // AND THE ALIAS STEP IS LOAD-BEARING, PINNED NON-ZERO. Delete
    // `getAliasedSymbol` from the resolver and every cross-module reference
    // resolves to the local import binding instead of the export: `streak.ts`
    // drops out of the pass entirely and this count goes to 0. A builder has
    // already broken that exact call by hand once — `cutInWiring.test.ts`
    // records it — so it is measured here rather than trusted.
    expect(
      symbols.crossModule.length,
      'no declaration was reached by following an import alias — getAliasedSymbol is not doing anything',
    ).toBe(COVERED_DAY_SYMBOL_SCAN.CROSS_MODULE_FOUND);

    // COUNTS, NOT BOUNDS. The file column moves to 3 the moment a granter
    // appears in a module that has never touched the entitlement, which is
    // exactly what the aliased mutant in this block's header does.
    expect([symbols.names.length, symbols.files.length]).toEqual([
      ...COVERED_DAY_SYMBOL_SCAN.SYMBOL_FOUND,
    ]);

    // THE MEASURED VALUE OF THE PASS, and the assertion that stops it being
    // decoration: nine declarations it finds that the textual predicate
    // provably cannot, pinned as names so a swap is visible. If this ever went
    // empty, every symbol match would already be a textual match and the pass
    // would be costing 5s to duplicate a regex.
    const textualNames = new Set(matchesIn(PURCHASED_DAY_SCAN.NAMES_A_COVERED_DAY_OR_A_PURCHASE).names);
    const symbolOnly = symbols.names.filter((name) => !textualNames.has(name)).sort();
    expect(symbolOnly).toEqual([...COVERED_DAY_SYMBOL_SCAN.SYMBOL_ONLY_NAMES]);
    expect(COVERED_DAY_SYMBOL_SCAN.SYMBOL_ONLY_NAMES.length).toBeGreaterThan(0);
    expect(textualNames.size + symbolOnly.length).toBe(COVERED_DAY_SYMBOL_SCAN.UNION_FOUND);

    // THE BAR THIS TEST EXISTS FOR. A declaration that reaches the covered-day
    // machinery through an ALIASED identifier says nothing the textual scan can
    // match, so before this pass it was invisible in both directions: not on
    // the allowlist, and not found by anything that would notice. The mutant in
    // the header ran 105 green tests with `tsc --noEmit` clean.
    //
    // The message carries the QUALIFIED name so the red names the file and the
    // declaration rather than a bare count.
    const allowed = new Set(COVERED_DAY_TOUCHING_FUNCTIONS);
    const unlisted = symbols.qualified
      .filter((q) => !allowed.has(q.split('::')[1] as string))
      .sort();
    expect(
      unlisted,
      'a declaration reaches the covered-day machinery through an identifier the textual scan cannot see, and is not on COVERED_DAY_TOUCHING_FUNCTIONS',
    ).toEqual([]);
  });

  it('THE RE-ALIAS SHAPE IS CAUGHT TOO, and the shape that is NOT is a declared limit', { timeout: budgetFrom(8_016) }, () => {
    // `import * as E from '...'; E.creditCoveredDays(...)` is the second
    // spelling of the same evasion, and the brief that asked for this fix left
    // open whether it was covered. Measured, both ways:
    //
    //   - THE TEXTUAL SCAN ALREADY CATCHES IT, because the property access
    //     writes the real export name in the body and `covered.?day` matches
    //     the `CoveredDay` inside `creditCoveredDays`. That is luck rather than
    //     design — it holds for this export's NAME, not for the shape — so it
    //     is asserted rather than relied on quietly.
    const reAlias = [
      'export function widenByNamespace(s: EntitlementState, w: number, n: number): EntitlementState {',
      '  return E.creditCoveredDays(RECOVERY_ENTITLEMENT, s, w, n, E.COVERAGE_SOURCES[0]).state;',
      '}',
    ].join('\n');
    expect(
      PURCHASED_DAY_SCAN.NAMES_A_COVERED_DAY_OR_A_PURCHASE.test(reAlias),
      'the textual scan should see the namespace spelling, which writes the export name out in full',
    ).toBe(true);

    //   - AND THE SYMBOL PASS CATCHES IT INDEPENDENTLY, because the property
    //     name in a `PropertyAccessExpression` is an identifier that resolves
    //     straight to the export. That is the half that does NOT depend on what
    //     the export happens to be called: rename `creditCoveredDays` to `bump`
    //     and the textual assertion above stops holding while this one does not.
    //
    // DRIVEN THROUGH THE REAL CHECKER, NOT ASSERTED ABOUT. An earlier draft of
    // this test discharged the sentence above with
    // `expect(symbolPass().crossModule.length).toBeGreaterThan(0)` — true on
    // the tree, and about the wrong thing: it says some cross-module alias
    // resolves somewhere, and no version of the NAMESPACE handling would have
    // made it red. That is a prose guarantee with nothing behind it, which is
    // the failure CLAUDE.md opens with. The probe is compiled instead.
    const probe = runPass(ALIAS_PROBE);
    const probeFound = probe.qualified
      .filter((q) => q.startsWith(`${ALIAS_PROBE.rel}::`))
      .map((q) => q.split('::')[1] as string)
      .sort();
    expect(
      probeFound,
      'the symbol pass must see BOTH evasions in the probe and leave the innocent helper alone',
    ).toEqual(['widenByAlias', 'widenByNamespace']);

    // AND THE TEXTUAL SCAN IS BLIND TO THE ALIASED ONE, which is what makes the
    // symbol pass load-bearing rather than a second opinion. Same probe text,
    // same declaration splitter, the shipped predicate.
    const textualOnProbe = declarations(stripComments(ALIAS_PROBE.text))
      .filter(([, body]) => PURCHASED_DAY_SCAN.NAMES_A_COVERED_DAY_OR_A_PURCHASE.test(body))
      .map(([name]) => name)
      .sort();
    expect(
      textualOnProbe,
      'the textual scan should see only the namespace spelling, which writes the export name out in full',
    ).toEqual(['widenByNamespace']);

    // THE LIMIT, PINNED AS A RED LINE THE WAY THE TEXTUAL SCAN'S WAS. An
    // identifier the checker cannot follow to an export resolves to no guarded
    // symbol and is invisible to this pass: an index signature read off a
    // namespace object, a dynamic `await import()`, a `Function` constructor.
    // The textual scan is what covers the first of those, and only when the
    // string it indexes with is written out.
    expect(COVERED_DAY_SYMBOL_SCAN.DYNAMIC_ACCESS_IS_NOT_COVERED).toBe(true);
    const dynamicEvasion = [
      'export function widenDynamically(s: EntitlementState, w: number, n: number): EntitlementState {',
      '  const f = lookup(KEY) as (...a: never[]) => { state: EntitlementState };',
      '  return f(RECOVERY_ENTITLEMENT, s, w, n, SOURCE).state;',
      '}',
    ].join('\n');
    expect(
      PURCHASED_DAY_SCAN.NAMES_A_COVERED_DAY_OR_A_PURCHASE.test(dynamicEvasion),
      'the dynamic shape is outside BOTH passes — this is the declared limit, not a claim of completeness',
    ).toBe(false);
  });

  it('THE THREE RESOLVERS DO NOT DRIFT: the alias step is present in every file that resolves a symbol', () => {
    // WHAT STANDS IN FOR EXTRACTING THE RESOLVER, and it is second best. The
    // four lines that follow an import alias are written out in three test
    // files — `symbolPass` above, `progression.test.ts`'s `resolvedSymbolOf`,
    // and `cutInWiring.test.ts`'s two. They cannot share a home: the only one
    // both `src/game/` and `src/cutin/` could import is a new non-test module
    // under `src/`, which the pass above would then scan.
    //
    // CLAUDE.md's finding is that duplicated guards diverge, and that the
    // distance keeps shrinking — instance three was twelve lines inside ONE
    // function, where the seal check matched a callee by identifier text while
    // its sibling resolved through the checker. So the copies are counted here:
    // deleting the alias step from any one of the three is red, which is the
    // property extraction would have given for free.
    //
    // OCCURRENCE COUNTS, NOT PRESENCE. CLAUDE.md: "a textual pin whose pattern
    // has more than one witness in the file" survives the mutation that breaks
    // one of them. `cutInWiring.test.ts` genuinely resolves symbols twice, so
    // presence alone would stay green after one of its two was gutted.
    const repoRoot = path.join(PURCHASED_DAY_SCAN.ROOT, '..');
    const ALIAS_STEP = /checker\.getAliasedSymbol\(\s*symbol\s*\)/g;
    const RESOLVER_FILES: readonly (readonly [string, number])[] = [
      ['src/game/streakEntitlement.test.ts', 1],
      ['src/game/progression.test.ts', 1],
      ['src/cutin/cutInWiring.test.ts', 2],
    ];
    for (const [file, expected] of RESOLVER_FILES) {
      const source = readFileSync(path.join(repoRoot, file), 'utf8');
      expect(
        [...source.matchAll(ALIAS_STEP)].length,
        `${file} no longer follows import aliases exactly ${expected} time(s)`,
      ).toBe(expected);
    }
    // The list is not empty and names this file among them, so the check cannot
    // pass by looking at nothing.
    expect(RESOLVER_FILES.length).toBe(3);
  });

  it('AND THE SCAN LEAVES src/game/ — every directory under src/ is reached, and the matching files are pinned', () => {
    // THE HALF THE ALLOWLIST EQUALITY CANNOT COVER, and the reason this is a
    // separate test rather than two more lines in the one above.
    //
    // The equality above bites hard when the walk breaks in a way that LOSES a
    // match: an empty walk, a skipped `src/empire`, a dead predicate all shrink
    // `found.names` below a 57-entry allowlist. What it cannot see is a walk
    // that never descends into a directory holding ZERO matches today —
    // `src/shell/`, `src/meet/`, `src/session/`. Those contribute nothing to
    // the set equality, so the equality is green whether they were read or not,
    // and the day one of them grows a declaration that awards a purchased day
    // the guard is silently blind. That is precisely the failure the old
    // `__dirname`-bound reader had, so shipping the fix without a check on it
    // would be replacing a structural hole with an unmeasured one.
    const files = scannedFilesUnder(PURCHASED_DAY_SCAN.ROOT).map((file) =>
      path.relative(PURCHASED_DAY_SCAN.ROOT, file).split(path.sep).join('/'),
    );
    const reached = new Set(files.map((rel) => rel.split('/')[0] as string));

    // The oracle is a ONE-LEVEL `readdirSync`, deliberately a different shape
    // from the recursive walk it grades, so a bug in the recursion does not
    // also produce the expectation. Both read the same disk — that is the fact
    // they are supposed to share.
    const onDisk = readdirSync(PURCHASED_DAY_SCAN.ROOT, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => entry.name)
      .sort();

    // NON-VACUITY FIRST: two empty sets compare equal. This is the pinned count
    // that makes the comparison below mean something, and it is the line a new
    // top-level directory has to come and edit.
    expect(onDisk.length, `top-level directories under src/: ${onDisk.join(', ')}`).toBe(
      PURCHASED_DAY_SCAN.SOURCE_DIRECTORIES,
    );
    expect([...reached].sort(), 'a directory under src/ that the scan never read').toEqual(onDisk);

    // AND THE FILE SET IS PINNED, which is what makes a new module naming a
    // covered day a VISIBLE diff at file granularity and not only a bare name
    // appended to an 88-entry list.
    //
    // WORTH KNOWING WHAT THIS PIN DID NOT CATCH: widening the predicate from
    // the purchase word to the covered day added 31 declarations and NOT ONE
    // FILE. The hole was entirely inside modules already being read, so a
    // file-level pin was green throughout and could never have been the thing
    // that found it. Recorded because it is the same lesson as the directory
    // ceiling — a pin is only as wide as the axis it is taken on.
    expect(matchesIn(PURCHASED_DAY_SCAN.NAMES_A_COVERED_DAY_OR_A_PURCHASE).files).toEqual([
      ...PURCHASED_DAY_SCAN.FILES_THAT_NAME_A_COVERED_DAY,
    ]);
  });

  it('THE PREDICATE WAS CHOSEN BY MEASUREMENT: four candidates, and the two that look sufficient are not', () => {
    // ALL FOUR OPTIONS, MEASURED AND PINNED, because the choice between them is
    // the load-bearing decision in this scan and prose would not survive
    // somebody deciding a narrower one is obviously equivalent. Each is a
    // strict subset of the one below it, so every declaration a narrowing loses
    // is a coverage regression rather than a tightening.
    const coverage = matchesIn(PURCHASED_DAY_SCAN.NAMES_A_COVERED_DAY_OR_A_PURCHASE);
    const purchaseWord = matchesIn(PURCHASED_DAY_SCAN.PURCHASE_WORD_ONLY);
    const creditPath = matchesIn(PURCHASED_DAY_SCAN.CREDIT_PATH_TOKENS);
    const narrow = matchesIn(PURCHASED_DAY_SCAN.NAMES_THE_COUNTER_OR_THE_SOURCE);

    expect([coverage.names.length, coverage.files.length]).toEqual([
      ...PURCHASED_DAY_SCAN.COVERAGE_FOUND,
    ]);
    expect([purchaseWord.names.length, purchaseWord.files.length]).toEqual([
      ...PURCHASED_DAY_SCAN.PURCHASE_WORD_FOUND,
    ]);
    expect([creditPath.names.length, creditPath.files.length]).toEqual([
      ...PURCHASED_DAY_SCAN.CREDIT_PATH_FOUND,
    ]);
    expect([narrow.names.length, narrow.files.length]).toEqual([...PURCHASED_DAY_SCAN.NARROW_FOUND]);

    // THEY REALLY ARE NESTED, asserted rather than asserted-about. If a future
    // edit makes one of these merely DIFFERENT from its neighbour rather than
    // wider, the counts above could still be satisfied while the "every
    // narrowing is a regression" argument silently stopped being true. The
    // outermost containment is by construction — every token in
    // `CREDIT_PATH_TOKENS` is an alternative in the shipped predicate — and it
    // only became so once `'window-entitlement'` was added there; before that
    // it held on this tree by accident, which is exactly the kind of green this
    // codebase has been burned by.
    const subset = (inner: typeof narrow, outer: typeof coverage): string[] =>
      inner.qualified.filter((q) => !outer.qualified.includes(q));
    expect(subset(narrow, creditPath), 'narrow is not inside credit-path').toEqual([]);
    expect(subset(purchaseWord, creditPath), 'purchase-word is not inside credit-path').toEqual([]);
    expect(subset(creditPath, coverage), 'credit-path is not inside coverage').toEqual([]);

    // THE FILES THE NARROW PREDICATE LOSES. `currencyProvenance.ts` is the file
    // the three-file scan was widened to reach, and the narrow predicate does
    // not match a single declaration in it — so narrowing would silently undo
    // that round's fix. The other three are files the tree-wide scan gained.
    const lostFiles = coverage.files.filter((file) => !narrow.files.includes(file));
    expect(lostFiles).toEqual([
      'empire/empireCore.ts',
      'empire/empireInvariant.ts',
      'empire/engagement.ts',
      'empire/expansion.ts',
      'empire/reputation.ts',
      'game/currencyProvenance.ts',
      'game/streakSweep.ts',
      'tuning/audit.ts',
    ]);

    // THE HOLE THAT DECIDED THE PREVIOUS ROUND. The shipped entry point money
    // arrives on contains neither narrow token in its name, so a declaration
    // elsewhere in the tree that only CALLS it matches on the word and not on
    // the identifiers.
    expect(
      PURCHASED_DAY_SCAN.NAMES_A_COVERED_DAY_OR_A_PURCHASE.test('applySettledCoveredDayPurchase'),
    ).toBe(true);
    expect(
      PURCHASED_DAY_SCAN.NAMES_THE_COUNTER_OR_THE_SOURCE.test('applySettledCoveredDayPurchase'),
    ).toBe(false);

    // AND THE HOLE THAT DECIDED THIS ONE. `'window-entitlement'` is the other
    // half of `COVERAGE_SOURCES`, and a credit through it is a grant of covered
    // days with no purchase anywhere in it. The purchase-word predicate cannot
    // see the call, the source, or the counter it lands in. This is the §12.3
    // mutant — coverage granted for training — and it is why the purchase-only
    // scope had to go.
    //
    // THE THREE TOKENS ARE ASSERTED INDIVIDUALLY, and one of them corrected a
    // false claim in this test's own first draft: `covered.?day` does NOT match
    // `'window-entitlement'`, which is why that literal is a separate
    // alternative in the shipped predicate rather than assumed to be covered.
    for (const token of ['creditCoveredDays', "'window-entitlement'", 'coveredDaysLeft']) {
      expect(
        PURCHASED_DAY_SCAN.PURCHASE_WORD_ONLY.test(token),
        `the purchase-word predicate should have been blind to ${token}`,
      ).toBe(false);
      expect(
        PURCHASED_DAY_SCAN.NAMES_A_COVERED_DAY_OR_A_PURCHASE.test(token),
        `the shipped predicate must see ${token}`,
      ).toBe(true);
    }

    // WHAT NONE OF THEM SEE, RECORDED RATHER THAN GLOSSED. Every predicate here
    // is a TEXTUAL match on a declaration body, so an aliased import defeats
    // all four: `import { creditCoveredDays as credit }` sits above the first
    // declaration and is therefore in no declaration's body at all. This is the
    // "floor and not a ceiling" limit the allowlist's header states, and it is
    // the same class as `progression.test.ts`'s seal check matching a callee by
    // identifier text while its sibling twelve lines down resolved symbols
    // through the checker. Closing it needs a type-aware pass, which this scan
    // is not. Pinned so the limit is a red line if somebody believes otherwise.
    const aliasedEvasion = [
      'export function widen(s: EntitlementState, w: number, n: number): EntitlementState {',
      '  return credit(RECOVERY_ENTITLEMENT, s, w, Math.floor(n / 10), SRC).state;',
      '}',
    ].join('\n');
    expect(
      PURCHASED_DAY_SCAN.NAMES_A_COVERED_DAY_OR_A_PURCHASE.test(aliasedEvasion),
      'an aliased import still defeats every textual predicate here — see the comment above',
    ).toBe(false);

    // AND WHY THE CREDIT-TOKEN OPTION WAS NOT ENOUGH EITHER, which is the part
    // that would have been easy to get wrong: it catches the probe, so it looks
    // like the fix. The SIBLING mutant fabricates a tuning instead —
    // `COVERED_DAYS_PER_WINDOW` keyed to a session count — and calls nothing on
    // the credit path. CLAUDE.md: "when you fix a check, the next thing to look
    // at is the branch immediately below it."
    const tuningWidener = [
      'export function tuningForTenSessions(sessionsDone: number): EntitlementTuning {',
      '  return {',
      '    ...RECOVERY_ENTITLEMENT,',
      '    COVERED_DAYS_PER_WINDOW:',
      '      RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW + Math.floor(sessionsDone / 10),',
      '  };',
      '}',
    ].join('\n');
    expect(
      PURCHASED_DAY_SCAN.CREDIT_PATH_TOKENS.test(tuningWidener),
      'the credit-token predicate is blind to a tuning-keyed widener',
    ).toBe(false);
    expect(
      PURCHASED_DAY_SCAN.NAMES_A_COVERED_DAY_OR_A_PURCHASE.test(tuningWidener),
      'the shipped predicate must catch a tuning-keyed widener',
    ).toBe(true);
  });

  it('AND THE SCAN CAN SEE A NEW ONE: it is not matching nothing, on BOTH halves of the predicate', () => {
    // ANTI-VACUITY FOR THE SCANNER ITSELF. The test above is a set equality, and
    // a `declarations` that returned an empty list would satisfy it against an
    // empty allowlist while proving nothing. This drives the same scanner over
    // synthetic modules containing exactly the mutants §12.3 forbids.
    //
    // THREE DECLARATIONS, NOT ONE, AND THAT IS THIS ROUND'S REPAIR. The version
    // before this had a single synthetic that awarded a `purchasedDaysLeft`, so
    // it exercised the `purchas` half only. Adding `covered.?day` to the
    // predicate while this test kept probing a purchase would have left the new
    // alternative UNEXERCISED HERE — matched by nothing the test writes, and so
    // decoration by CLAUDE.md's own definition. `grantsCoverageForTraining`
    // below is the probe that motivated the widening, reduced to its shape.
    const mutant = [
      'export function ordinaryHelper(a: number): number {',
      '  return a + 1;',
      '}',
      'export function markStreakMilestone(state: EntitlementState): EntitlementState {',
      '  return { ...state, purchasedDaysLeft: state.purchasedDaysLeft + 1 };',
      '}',
      'export function grantsCoverageForTraining(',
      '  state: EntitlementState,',
      '  windowNow: number,',
      '  sessionsDone: number,',
      '): EntitlementState {',
      "  return creditCoveredDays(RECOVERY_ENTITLEMENT, state, windowNow, Math.floor(sessionsDone / 10), 'window-entitlement').state;",
      '}',
    ].join('\n');
    //
    // IT READS THE SHARED PREDICATE RATHER THAN A COPY OF IT. This line used to
    // spell `/purchas/i` inline, one screen below the scan that spelled the
    // same regex — CLAUDE.md's "a twin guard must READ the sibling's list, not
    // copy it". Narrowing the scan's predicate while this one kept the old
    // literal would leave the anti-vacuity check green about a predicate the
    // scan no longer uses, which is the exact shape of a check that cannot fail.
    const foundBy = (predicate: RegExp): string[] =>
      declarations(mutant)
        .filter(([, body]) => predicate.test(body))
        .map(([name]) => name);

    // BOTH GRANTERS ARE SEEN AND THE INNOCENT HELPER IS NOT. `ordinaryHelper`
    // is what stops this being satisfied by a predicate that matches
    // everything — without it, `/(?:)/` would pass.
    expect(foundBy(PURCHASED_DAY_SCAN.NAMES_A_COVERED_DAY_OR_A_PURCHASE)).toEqual([
      'markStreakMilestone',
      'grantsCoverageForTraining',
    ]);

    // AND THE PREDICATE THAT SHIPPED BEFORE THIS ROUND MISSES THE SECOND ONE.
    // This is the assertion that makes the widening non-vacuous rather than
    // merely present: it pins that the coverage half does work the purchase
    // half provably could not, on the exact mutant that was planted in
    // `src/shell/appServer.ts` and ran 43 green tests.
    expect(
      foundBy(PURCHASED_DAY_SCAN.PURCHASE_WORD_ONLY),
      'the purchase-word predicate must be blind to a window-entitlement grant',
    ).toEqual(['markStreakMilestone']);

    expect(COVERED_DAY_TOUCHING_FUNCTIONS).not.toContain('markStreakMilestone');
    expect(COVERED_DAY_TOUCHING_FUNCTIONS).not.toContain('grantsCoverageForTraining');
    // The allowlist is non-empty, so the equality above is not two empty sets.
    expect(COVERED_DAY_TOUCHING_FUNCTIONS.length).toBeGreaterThan(0);
  });

  it('the entitlement module exports no way to earn one — the only credit needs a source', () => {
    // Vocabulary-based and stated as such: it is a floor under the scan above,
    // not the guarantee. The guarantee is that a source is MANDATORY, so there
    // is no argument list by which a covered day arrives anonymously and lands
    // in the bought counter by default.
    const crediting = Object.keys(entitlementModule).filter((name) =>
      /grant|credit|buy|award|earn/i.test(name),
    );
    // Two, and the second is the constant that says the first has exactly one
    // source for the bought counter. There is no third — in particular nothing
    // named for granting, awarding or earning a covered day.
    expect(crediting.sort()).toEqual(['SOURCES_THAT_CREDIT_A_PURCHASED_DAY', 'creditCoveredDays']);
    expect(crediting.filter((name) => /grant|buy|award|earn/i.test(name))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// THE VERIFICATION BATTERY
// ---------------------------------------------------------------------------

describe('never punish daily engagement — the entitlement under attack', () => {
  it('NEGATIVE CONTROLS: the harness can see a violation when there is one', () => {
    // RUN FIRST, DELIBERATELY. Every other test in this block asserts a zero,
    // and a zero from a harness that cannot detect a violation is worthless.
    // These three configurations are known to break the property, and each one
    // is also a design rule stated as a measurement: what may add a covered
    // day, and what a doomed absence must cost.
    const length = ENTITLEMENT_VERIFICATION.LENGTHS[1] as number;

    const doomedFree = judge(sampledPairs(length), { ...DEFAULT, burnOnDoom: false });
    expect(doomedFree.currentInversions, 'a doomed absence that costs nothing must break this').toBeGreaterThan(0);
    expect(doomedFree.longestInversions).toBeGreaterThan(0);

    const streakKeyed = judge(sampledPairs(length), {
      ...DEFAULT,
      grant: { kind: 'streak', at: ENTITLEMENT_VERIFICATION.STREAK_KEYED_GRANT_AT },
    });
    expect(streakKeyed.currentInversions, 'a grant keyed to the streak must break this').toBeGreaterThan(0);

    const sessionKeyed = judge(sampledPairs(length), {
      ...DEFAULT,
      grant: { kind: 'session', every: ENTITLEMENT_VERIFICATION.SESSION_KEYED_GRANT_EVERY },
    });
    expect(sessionKeyed.currentInversions, 'a grant keyed to session count must break this').toBeGreaterThan(0);

    // AND THE SESSION-KEYED SHAPE IS THE WORST OF THE THREE, which is the
    // finding that constrains GDD §8.3C: a season pass whose tiers unlock by
    // play cannot pay covered days at a tier. It has to pay them in a week.
    expect(sessionKeyed.currentInversions).toBeGreaterThan(streakKeyed.currentInversions);
  });

  it('[dropping-the-doomed-burn-measures-worse] DROPPING THE DOOMED BURN, RE-TAKEN AND PINNED AT EVERY LENGTH', { timeout: budgetFrom(32_464) }, () => {
    // WHAT THIS CLOSES. The sentence "dropping the burn measures 1051 violating
    // pairs at 60 days and 673 at 100" was restated in `streak.ts`,
    // `streakEntitlement.ts`, a comment in this file and GDD §4.4 — and the
    // 100-day half was pinned by NO ASSERTION ANYWHERE IN `src`. The 60-day
    // half was carried by a comment inside `streak.test.ts`'s named test, which
    // the numeric half of the `@guarantee` rule accepts and which that rule's
    // own header calls a soft floor. Four confident restatements of one figure
    // nothing re-derived.
    //
    // IT REPRODUCED, WHICH IS THE LESS INTERESTING OF THE TWO POSSIBLE ANSWERS
    // AND IS RECORDED AS THE ONE THAT HAPPENED. 60 gives 1051 and 100 gives
    // 673, at the parameters this repository already had written down.
    //
    // WHAT MAKES THIS AN ASSERTION RATHER THAN A RESTATEMENT: every measured
    // row below comes out of `judge`, which runs `drive`, which calls the real
    // `streakEntitlement.ts`. Nothing measured here is compared against itself.
    // Two mutants are recorded for this tag in `guaranteeTags.test.ts`, one per
    // direction, because the link check and the measurement fail on different
    // edits and one witness would say nothing about the other.
    //
    // A THIRD MUTANT WAS TRIED FIRST AND STAYED GREEN, which is worth the line
    // it costs. Dropping the `Math.min` from `drawableByThisAbsence` looks like
    // a coverage-rule mutation and is a NO-OP at the shipped tuning:
    // `COVERED_DAYS_PER_WINDOW` and `MAX_COVERED_DAYS_PER_ABSENCE` are both 2
    // and this sweep buys nothing, so the min never binds. A mutant that does
    // not change behaviour is not evidence that a test cannot bite.
    //
    // THE COST, STATED. Both arms at all four lengths is about fifteen seconds.
    // The clean arm is also run by the SAMPLED test below and is deliberately
    // re-run here, so the two rows of the published table are taken on ONE
    // domain in ONE place rather than inferred across two tests that could
    // drift onto different grids.
    const lengths = DOOMED_BURN_COUNTERFACTUAL.LENGTHS;

    // THE GRID IS THE BATTERY'S, NOT A LOCAL ONE. Asserted rather than assumed:
    // a length added to ENTITLEMENT_VERIFICATION moves the rows below and must
    // redden them rather than silently leaving a four-entry table describing a
    // grid that grew.
    expect(lengths).toEqual([40, 60, 80, 100]);

    // (1) THE PROSE'S OWN NUMERALS, WRITTEN OUT, AND IT RUNS FIRST ON PURPOSE.
    //     This is a LINK CHECK and is labelled as one: it compares the shared
    //     constant against the figures the four sentences quote, so it reddens
    //     when somebody re-takes the measurement and edits the constant without
    //     touching the prose. That is the exact drift that produced this test.
    //     It is NOT the check aimed at the engine — (2) is — and it is placed
    //     above the sweeps so the two have separate mutation witnesses: an edit
    //     to `streakSweep.ts`'s row reddens here, an edit to the entitlement
    //     arithmetic reddens there, and neither witness can stand in for the
    //     other.
    expect(
      [...DOOMED_BURN_COUNTERFACTUAL.VIOLATING_PAIRS_BY_LENGTH],
      'the sentence in streak.ts, streakEntitlement.ts and GDD §4.4 says 1051 at 60 and 673 at 100',
    ).toEqual([561, 1051, 710, 673]);

    const dropped = lengths.map((length) => judge(sampledPairs(length), { ...DEFAULT, burnOnDoom: false }));
    const kept = lengths.map((length) => judge(sampledPairs(length), DEFAULT));

    // (2) THE PUBLISHED FIGURES, MEASURED. Pinned exactly, not bounded — a
    //     bound lets the counterfactual drift and still read as evidence, and
    //     the whole defect this test closes was a figure nobody could
    //     re-derive.
    expect(
      dropped.map((verdict) => verdict.currentInversions),
      'GDD §4.4 doomed-burn control row, currentStreak inversions',
    ).toEqual([...DOOMED_BURN_COUNTERFACTUAL.VIOLATING_PAIRS_BY_LENGTH]);
    expect(
      dropped.map((verdict) => verdict.longestInversions),
      'the lifetime-best row — the half that does not heal',
    ).toEqual([...DOOMED_BURN_COUNTERFACTUAL.LONGEST_INVERSIONS_BY_LENGTH]);
    expect(
      dropped.map((verdict) => verdict.worstCurrentDeficit),
      'MAGNITUDE, not frequency',
    ).toEqual([...DOOMED_BURN_COUNTERFACTUAL.WORST_DEFICIT_BY_LENGTH]);

    // (3) THE SHIPPED RULE IS ZERO ON THE SAME DOMAIN. Without this row the
    //     figures above are a number with nothing to be worse than.
    expect(kept.map((verdict) => verdict.currentInversions)).toEqual([0, 0, 0, 0]);
    expect(kept.map((verdict) => verdict.longestInversions)).toEqual([0, 0, 0, 0]);

    // (4) THE DIRECTION SURVIVES INDEPENDENTLY OF THE MAGNITUDES, AND IT IS
    //     THE HALF THAT MATTERS FOR §12.3. Every length is worse without the
    //     burn on all three fields — frequency, lifetime best, and the size of
    //     the worst deficit — asserted as inequalities on the MEASURED
    //     verdicts rather than read off the pinned table, so it stays true if a
    //     retune moves all four figures. If the counts above ever have to be
    //     re-pinned, this is the claim that should still hold, and re-pinning
    //     the counts must not be allowed to quietly weaken it.
    for (let i = 0; i < lengths.length; i += 1) {
      const without = dropped[i] as Verdict;
      const with_ = kept[i] as Verdict;
      expect(
        without.currentInversions > with_.currentInversions,
        `L=${lengths[i]}: dropping the burn was not worse on currentStreak`,
      ).toBe(true);
      expect(
        without.longestInversions > with_.longestInversions,
        `L=${lengths[i]}: dropping the burn was not worse on the lifetime best`,
      ).toBe(true);
      expect(
        without.worstCurrentDeficit > with_.worstCurrentDeficit,
        `L=${lengths[i]}: dropping the burn cost no streak days here`,
      ).toBe(true);
    }

    // (5) ANTI-VACUITY, PINNED AS COUNTS. The domain is the same on both arms
    //     and it is not empty; the broken variant really did still consume
    //     covered days, so it is "the burn dropped" and not "a lifter with no
    //     coverage at all"; and dropping the burn strictly REDUCES consumption
    //     at every length, which is the only direction the edit can move it.
    expect(dropped.map((verdict) => verdict.pairsChecked)).toEqual([
      ...DOOMED_BURN_COUNTERFACTUAL.PAIRS_CHECKED_BY_LENGTH,
    ]);
    expect(kept.map((verdict) => verdict.pairsChecked)).toEqual([
      ...DOOMED_BURN_COUNTERFACTUAL.PAIRS_CHECKED_BY_LENGTH,
    ]);
    expect(dropped.map((verdict) => verdict.consumed)).toEqual([...DOOMED_BURN_COUNTERFACTUAL.CONSUMED_BY_LENGTH]);
    expect(kept.map((verdict) => verdict.consumed)).toEqual([
      ...DOOMED_BURN_COUNTERFACTUAL.CONSUMED_WITH_THE_BURN_BY_LENGTH,
    ]);
    for (let i = 0; i < lengths.length; i += 1) {
      expect((dropped[i] as Verdict).consumed).toBeGreaterThan(0);
      expect((dropped[i] as Verdict).consumed).toBeLessThan((kept[i] as Verdict).consumed);
    }
  });

  it('EXHAUSTIVE: every calendar of 8 to 16 days, both fields', { timeout: budgetFrom(9_440) }, () => {
    for (const length of MONOTONICITY_SWEEP.EXHAUSTIVE_LENGTHS) {
      expectClean(`exhaustive L=${length}`, judge(exhaustivePairs(length), DEFAULT));
    }
  });

  it('EXHAUSTIVE, ACROSS A WINDOW BOUNDARY: the same calendars at a 7-day window', { timeout: budgetFrom(19_891) }, () => {
    // RESIDUAL THE PREVIOUS ROUND LEFT OPEN, and it is a gap in the only
    // proof-grade sweep in the repository. The shipped `WINDOW_DAYS` is 30 and
    // every exhaustive fixture anchors signup at day 0, so the sweep above runs
    // entirely INSIDE WINDOW 0. It cannot see the refill, cannot see two
    // lifters re-converge at a boundary, and cannot see a purchased day expire
    // -- the three things the entitlement design rests on. It proved the
    // property for the sub-mechanism that was never in doubt.
    //
    // The fix costs seconds: run the same judge over the same calendars at
    // `MONOTONICITY_SWEEP.BOUNDARY_CROSSING_WINDOW_DAYS`, where every one of
    // them straddles at least one boundary and the longest straddles two.
    //
    // THIS IS `drive`-ONLY, and the pin is what carries it. `streak.ts` reads
    // `RECOVERY_ENTITLEMENT` as a module constant, so the shipped engine cannot
    // be driven at another window length; 'the shipped engine is the
    // composition this battery graded' is what makes a `drive` result a
    // statement about the shipped program at the shipped tuning.
    const tuning: EntitlementTuning = {
      ...RECOVERY_ENTITLEMENT,
      WINDOW_DAYS: MONOTONICITY_SWEEP.BOUNDARY_CROSSING_WINDOW_DAYS,
    };
    // THE PREMISE, ASSERTED RATHER THAN ASSUMED: the window really is shorter
    // than the shortest calendar, or this is the sweep above under a new name.
    expect(tuning.WINDOW_DAYS).toBeLessThan(Math.min(...MONOTONICITY_SWEEP.EXHAUSTIVE_LENGTHS));
    expect(tuning.WINDOW_DAYS).toBeLessThan(RECOVERY_ENTITLEMENT.WINDOW_DAYS);

    let consumedWithout = 0;
    let consumedWith = 0;
    for (const length of MONOTONICITY_SWEEP.EXHAUSTIVE_LENGTHS) {
      // ARM 1 -- no purchases. The refill and the re-convergence.
      const plain = judge(exhaustivePairs(length), { ...DEFAULT, tuning });
      expectClean(`boundary W=${tuning.WINDOW_DAYS} L=${length}`, plain);
      consumedWithout += plain.consumed;

      // ARM 2 -- purchased days in the field, on fixed calendar days, so a
      // purchased day is credited in one window and expires in the next.
      const purchaseDays = MONOTONICITY_SWEEP.BOUNDARY_CROSSING_PURCHASE_DAYS.filter((d) => d < length);
      expect(purchaseDays.length, `L=${length} bought nothing`).toBeGreaterThan(0);
      // The buys really do span more than one window, or nothing expires.
      const windowsBoughtIn = new Set(purchaseDays.map((d) => windowIndexOf(tuning, 0, d)));
      expect(windowsBoughtIn.size, `L=${length} bought inside one window only`).toBeGreaterThan(1);

      const bought = judge(exhaustivePairs(length), { ...DEFAULT, tuning, purchaseDays });
      expectClean(`boundary W=${tuning.WINDOW_DAYS} L=${length} with purchases`, bought);
      consumedWith += bought.consumed;
    }

    // THE PUBLISHED NUMBERS, PINNED. GDD 4.4 prints this table; pinning the
    // totals here is what stops the two drifting apart, and a total that moves
    // is a sweep that is measuring something else.
    //
    // THE WITH-PURCHASE ROW FELL FROM 1 414 748 WHEN THE DOOMED-SALE RULING
    // LANDED, and it fell for the reason the ruling exists: some of these fixed
    // buy days sit inside an absence that has already ended the run, the store
    // will not sell into one, and a covered day that is never bought is never
    // burned. The no-purchase row is untouched, which is the check that the drop
    // is the store and not the absence rule. Both arms are still clean.
    expect(consumedWithout, 'GDD 4.4 boundary table, no-purchase row total').toBe(1_125_456);
    expect(consumedWith, 'GDD 4.4 boundary table, with-purchase row total').toBe(1_315_660);

    // ANTI-VACUITY, AND IT IS THE CHECK THIS SWEEP FAILED ON ITS FIRST RUN. The
    // first version funded the purchase arm through `coveredDayPurchaseDays`,
    // which at this purse buys NOTHING inside sixteen days -- so both arms
    // consumed byte-identical amounts and the purchase arm was the no-purchase
    // arm with a longer name. Fixed calendar days, and the two arms must differ.
    expect(consumedWithout, 'nothing was ever consumed').toBeGreaterThan(0);
    expect(consumedWith, 'the purchase arm consumed no more than the arm with no purchases').toBeGreaterThan(
      consumedWithout,
    );
  });

  it('SAMPLED: 40, 60, 80 and 100 days — including the LIFETIME BEST', { timeout: budgetFrom(7_719) }, () => {
    // The stock design measured 13 / 122 / 142 / 74 `currentStreak` inversions
    // here and 14 / 150 / 276 / 221 lifetime-best inversions. The lifetime-best
    // row is the one that had never been measured past 16 days at all, and it
    // is the half that does not heal, so it is asserted at every length rather
    // than sampled at one.
    for (const length of ENTITLEMENT_VERIFICATION.LENGTHS) {
      expectClean(`sampled L=${length}`, judge(sampledPairs(length), DEFAULT));
    }
  });

  it('MAGNITUDE AT LONG HORIZONS: 200 and 400 days', { timeout: budgetFrom(19_176) }, () => {
    // Frequency saturating while magnitude grows is the exact shape the stock
    // design had — its worst deficit reached 189 days at 400 — so the long
    // horizons are checked on the deficit, not only on the count.
    for (const length of ENTITLEMENT_VERIFICATION.LONG_LENGTHS) {
      expectClean(
        `long L=${length}`,
        judge(sampledPairs(length, ENTITLEMENT_VERIFICATION.LONG_SCHEDULES_PER_SEED), DEFAULT),
      );
    }
  });

  it('POPULATIONS the seeded generator does not reach', () => {
    // `seededSchedules` draws its rate from [0.2, 0.9], so it contains almost
    // no near-perfect attenders and nobody below 0.2. Both tails are where a
    // streak mechanic behaves least like the middle.
    //
    // THE TOP TAIL CONSUMES NOTHING, AND THAT IS A FACT ABOUT THE POPULATION
    // RATHER THAN A HOLE IN THE TEST. A lifter at 0.95 attendance essentially
    // never has an absence longer than the free grace, so no covered day is
    // ever drawn and the entitlement is not exercised at all. The anti-vacuity
    // guard is what noticed; rather than lower it everywhere, the consumption
    // requirement is asserted where a chargeable absence is actually reachable
    // and the near-perfect tail is checked for inversions only. It is still
    // worth running: it is the population in which the streak is longest and a
    // deficit would therefore be largest.
    const consumedByRate = new Map<number, number>();
    for (const rate of ENTITLEMENT_VERIFICATION.FIXED_ATTENDANCE_RATES) {
      const schedules = fixedRateSchedules(
        ENTITLEMENT_VERIFICATION.FIXED_ATTENDANCE_SEED,
        ENTITLEMENT_VERIFICATION.FIXED_ATTENDANCE_LENGTH,
        rate,
        ENTITLEMENT_VERIFICATION.FIXED_ATTENDANCE_SCHEDULES,
      );
      const pairs = function* (): Generator<readonly [TrainingSchedule, TrainingSchedule]> {
        for (const schedule of schedules) {
          for (const superset of singleDaySupersets(schedule)) yield [schedule, superset] as const;
        }
      };
      const verdict = judge(pairs(), DEFAULT);
      consumedByRate.set(rate, verdict.consumed);
      expect(verdict.pairsChecked, `attendance ${rate}: no pairs compared`).toBeGreaterThan(0);
      expect(verdict.currentInversions, `attendance ${rate}: ${verdict.witness ?? ''}`).toBe(0);
      expect(verdict.longestInversions, `attendance ${rate}: lifetime best inverted`).toBe(0);
      expect(verdict.worstCurrentDeficit, `attendance ${rate}: worst deficit`).toBe(0);
      expect(verdict.worstLongestDeficit, `attendance ${rate}: worst lifetime-best deficit`).toBe(0);
    }

    // The rates that CAN reach a chargeable absence must have reached one, or
    // this whole test is a sweep of runs that never touched the mechanic.
    for (const rate of ENTITLEMENT_VERIFICATION.FIXED_ATTENDANCE_RATES) {
      if (rate > 0.9) continue;
      expect(consumedByRate.get(rate) ?? 0, `attendance ${rate} consumed nothing`).toBeGreaterThan(0);
    }
    // And the near-perfect tail really is the one that consumes nothing, which
    // is the claim the exception above rests on rather than an assumption.
    expect(consumedByRate.get(0.95)).toBe(0);
  });

  it('EVERY TUNING IN THE GRID: a playtester must not be able to turn the property off', { timeout: budgetFrom(15_894) }, () => {
    // One model is how the last two claims survived longer than they should
    // have. The window length and the per-window entitlement are both UNTUNED
    // values that will move by hand, so the property is checked across the
    // grid rather than at the shipped point.
    const length = ENTITLEMENT_VERIFICATION.LENGTHS[1] as number;
    for (const windowDays of ENTITLEMENT_VERIFICATION.WINDOW_DAYS_GRID) {
      const tuning: EntitlementTuning = { ...RECOVERY_ENTITLEMENT, WINDOW_DAYS: windowDays };
      expectClean(`W=${windowDays}`, judge(sampledPairs(length), { ...DEFAULT, tuning }));
    }
    for (const perWindow of ENTITLEMENT_VERIFICATION.PER_WINDOW_GRID) {
      const tuning: EntitlementTuning = {
        ...RECOVERY_ENTITLEMENT,
        COVERED_DAYS_PER_WINDOW: perWindow,
        MAX_COVERED_DAYS_PER_ABSENCE: Math.max(1, perWindow),
      };
      const verdict = judge(sampledPairs(length), { ...DEFAULT, tuning });
      // N=0 is a legitimate tuning — grace only — and consumes nothing, so it
      // cannot meet the anti-vacuity bar. It is still checked for inversions.
      expect(verdict.currentInversions, `N=${perWindow}`).toBe(0);
      expect(verdict.longestInversions, `N=${perWindow}`).toBe(0);
      if (perWindow > 0) expect(verdict.consumed, `N=${perWindow} consumed nothing`).toBeGreaterThan(0);
    }
  });

  it('THE FREE GRANT PATH cannot itself create a violation', { timeout: budgetFrom(12_311) }, () => {
    // GDD §8.3C's season-pass grant, checked against the rule it exists under. A
    // covered day granted on a fixed calendar day — including one landing
    // exactly on a window boundary — leaves the property intact on all four
    // figures.
    //
    // THIS IS THE `'window-entitlement'` SOURCE, NOT THE PURCHASE. The two were
    // one path until GDD §8.3E was ruled in and they were split; the purchase
    // arms are below and are measured separately, because "a pass pays a covered
    // day in week 3" and "a player buys one" are different events even though
    // the mechanic is the same.
    const length = ENTITLEMENT_VERIFICATION.LENGTHS[3] as number;
    for (const days of ENTITLEMENT_VERIFICATION.CALENDAR_GRANT_DAYS) {
      expectClean(`grant on ${JSON.stringify(days)}`, judge(sampledPairs(length), {
        ...DEFAULT,
        grant: { kind: 'calendar', days },
      }));
    }
    // One of the grant days is a window boundary at the shipped tuning, which
    // is the awkward case and is in the fixture for that reason.
    expect(
      ENTITLEMENT_VERIFICATION.CALENDAR_GRANT_DAYS.some((days) =>
        days.some((d) => d % RECOVERY_ENTITLEMENT.WINDOW_DAYS === 0),
      ),
    ).toBe(true);
  });

  it('EVERY FUNDABLE TENDER, EVERY HORIZON: 0 violations across the whole legal funding surface', { timeout: budgetFrom(17_228) }, () => {
    // GDD §8.3E CONDITION 2 AND THE HUMAN'S BAR ON THE PROVENANCE FIX, in one
    // sweep. Condition 2 asks that the invariants hold with `purchasedDaysLeft`
    // ACTUALLY POPULATED rather than structurally present and zeroed. The bar
    // asks for zero violations across all funding sources and horizons.
    //
    // SO THE TABLE IS EVERY TENDER `applySettledCoveredDayPurchase` WILL ACCEPT,
    // enumerated from `NON_TRAINING_GATED_TENDERS` rather than listed here — a
    // tender added to `currencyProvenance.ts` and tagged non-training-gated
    // appears in this sweep without anybody remembering to add it.
    //
    // AND THE TREATMENT IS `'responsive'` FOR ALL OF THEM, which is the strong
    // form. Every diligent member recomputes their own purchase days from their
    // own schedule. For a calendar or player-chosen arrival that recomputation
    // returns an identical list, so the arm is clean by construction — and this
    // sweep is what turns "by construction" from a claim into a measurement.
    const seen: Record<string, PurchaseVerdict> = {};
    for (const tender of NON_TRAINING_GATED_TENDERS) {
      for (const length of ENTITLEMENT_VERIFICATION.LENGTHS) {
        const verdict = judgePurchaseArm(length, tender, 'responsive');
        // THE TWO TREATMENTS AGREE, CHECKED FIRST AND ON PURPOSE. For a legal
        // tender the diligent member's recomputation returns the lazy member's
        // day list, so `responsive` and `frozen` must produce the same verdict.
        // It reports the CAUSE where the zero below reports the symptom, so it
        // is asserted first.
        //
        // IT IS SHARPER THAN THE ZERO AND IT IS NOT THE SHARPEST — measured,
        // not assumed. A mutation that gave a calendar tender a tiny training
        // sensitivity (one extra Chalk on a lifter's 60th session) moved 2362
        // of 34338 purchase-day lists at 100 days and changed NO aggregate in
        // this verdict, so it walked straight past this line. The assertion
        // that caught it is the day-list one in the next test, and it is there
        // because this one was written claiming to do its job.
        expect(
          JSON.stringify(judgePurchaseArm(length, tender, 'frozen')),
          `${tender} L=${length}: a legal tender's purchase moved an OUTCOME with training`,
        ).toBe(JSON.stringify(verdict));
        expectClean(`${tender} purchases L=${length}`, verdict);
        // NOT VACUOUS IN THE WAY THAT MATTERS HERE: covered days were bought,
        // and the purchased counter really carried them. A sweep that bought
        // nothing would satisfy every assertion above and mean nothing.
        expect(verdict.boughtByLazy, `${tender} L=${length}: nothing was bought`).toBeGreaterThan(0);
        expect(
          verdict.peakPurchased,
          `${tender} L=${length}: purchasedDaysLeft never left zero`,
        ).toBeGreaterThan(0);
        seen[`${tender}-${length}`] = verdict;
      }
    }
    // THE TABLE IS NOT ONE MEASUREMENT REPEATED. Player-chosen and calendar
    // arrivals are modelled identically ON PURPOSE (see `coveredDayPurchase
    // Days`), so those rows SHOULD coincide — what must not coincide is this
    // whole block with the training-keyed control below, and the next test
    // asserts the purses differ.
    expect(Object.keys(seen).length).toBe(
      NON_TRAINING_GATED_TENDERS.length * ENTITLEMENT_VERIFICATION.LENGTHS.length,
    );
  });

  it('STRUCTURALLY, NOT EMPIRICALLY: a legal tender\'s purchase DAYS do not move when a lifter trains more', () => {
    // THE SHARPEST INSTRUMENT IN THIS FILE, AND THE ONE THAT ACTUALLY STATES
    // THE PROPERTY. Everything else here measures OUTCOMES — violating pairs,
    // final streaks, verdict equality — and an outcome is downstream of the
    // thing the rule is about. The rule is: *a lifter's own training must not
    // move the day their covered day arrives.* That is a statement about the
    // purchase-day list, and this asserts it on the purchase-day list.
    //
    // WHY IT IS NOT REDUNDANT WITH THE SWEEP ABOVE, measured rather than
    // argued. A mutation giving `'calendar'` a tiny training sensitivity — one
    // extra Chalk on the lifter's 60th session — moved **2362 of 34338**
    // purchase-day lists at 100 days, produced **zero** violations at 40 / 60 /
    // 80 / 100, and left every aggregate in the verdict identical. The sweep
    // was green. This is the assertion that goes red, and it goes red on the
    // sensitivity itself rather than on the day a sensitivity happens to matter.
    //
    // That is the difference between "structurally unable" and "empirically
    // clean at the lengths we happened to test", which is the distinction this
    // whole round exists to make.
    let comparisons = 0;
    for (const tender of NON_TRAINING_GATED_TENDERS) {
      const arrival = purchaseArrivalOf(tender);
      for (const length of ENTITLEMENT_VERIFICATION.LENGTHS) {
        for (const seed of MONOTONICITY_SWEEP.SEEDS) {
          const schedules = seededSchedules(seed, length).slice(
            0,
            COVERED_DAY_PURCHASE_SWEEP.SCHEDULES_PER_SEED,
          );
          for (const schedule of schedules) {
            const lazyBuys = JSON.stringify(coveredDayPurchaseDays(schedule, arrival));
            for (const superset of singleDaySupersets(schedule)) {
              comparisons += 1;
              if (JSON.stringify(coveredDayPurchaseDays(superset, arrival)) !== lazyBuys) {
                throw new Error(
                  `${tender} L=${length}: training one more day moved the purchase day — ` +
                    `${renderSchedule(schedule)} buys ${lazyBuys}, ${renderSchedule(superset)} buys ` +
                    JSON.stringify(coveredDayPurchaseDays(superset, arrival)),
                );
              }
            }
          }
        }
      }
    }
    expect(comparisons, 'no pair was compared, so this proves nothing').toBeGreaterThan(0);

    // AND THE INSTRUMENT CAN SEE A MOVE WHEN THERE IS ONE. A banned tender's
    // days really do move with training, on this same population — so the
    // equality above is a property of the legal tenders and not of the
    // comparison.
    let moved = 0;
    let looked = 0;
    const bannedArrival = purchaseArrivalOf(TRAINING_GATED_TENDERS[0] as CoveredDayTender);
    for (const seed of MONOTONICITY_SWEEP.SEEDS) {
      for (const schedule of seededSchedules(seed, 60).slice(0, 40)) {
        const lazyBuys = JSON.stringify(coveredDayPurchaseDays(schedule, bannedArrival));
        for (const superset of singleDaySupersets(schedule)) {
          looked += 1;
          if (JSON.stringify(coveredDayPurchaseDays(superset, bannedArrival)) !== lazyBuys) moved += 1;
        }
      }
    }
    expect(looked).toBeGreaterThan(0);
    expect(moved, 'the comparison cannot detect a purchase day moving at all').toBeGreaterThan(0);
  });

  it('NEGATIVE CONTROL, MATCHED: the SAME purse violates once training can move the purchase day', () => {
    // THE HAZARD GDD §8.2 CREATES AND §8.3C DOES NOT CLOSE. Chalk is earned in
    // part from achievements, achievements are reached by playing, and Chalk
    // buys Extra Covered Days — so a buy-when-affordable player has a
    // covered-day arrival their own training shifts. §8.3C re-keyed the pass's
    // covered days to the WEEK, which closes the one-hop path; it says nothing
    // about the pass's CHALK, and this is the two-hop version.
    //
    // THIS ARM IS NOW UNREACHABLE THROUGH THE SHIPPED ENTRY POINT, and that is
    // the whole of what changed. `applySettledCoveredDayPurchase` will not take
    // a training-gated tender — `streak.test.ts` proves the runtime refusal and
    // the type proves the compile-time one. The measurement is kept anyway,
    // driven through `streakEntitlement` directly, because a restriction whose
    // justification nobody re-derives is a restriction somebody eventually
    // relaxes. This is the number that says what relaxing it costs.
    //
    // MATCHED AGAINST `frozen` AND NOTHING ELSE. Same rule, same price, same
    // purse, same seeds, same schedules, and a bit-identical lazy member. The
    // only difference is whether the diligent member's purchase days are frozen
    // from the lazy run or recomputed from their own training.
    //
    // AN EARLIER CUT OF THIS MEASUREMENT COMPARED A CALENDAR MODEL AGAINST A
    // RESPONSIVE ONE AND FOUND THE RESPONSIVE ONE LOOKING BETTER. That was an
    // artifact of the calendar model buying roughly twice as many covered days;
    // a bigger bank hides violations for reasons that have nothing to do with
    // keying. Hence the frozen arm.
    expect(TRAINING_GATED_TENDERS.length, 'nothing is restricted, so nothing is measured').toBeGreaterThan(0);
    const banned = TRAINING_GATED_TENDERS[0] as CoveredDayTender;
    const legal = NON_TRAINING_GATED_TENDERS[0] as CoveredDayTender;
    for (const length of ENTITLEMENT_VERIFICATION.LENGTHS) {
      const frozen = judgePurchaseArm(length, banned, 'frozen');
      const responsive = judgePurchaseArm(length, banned, 'responsive');

      // THE CONTROL: the lazy side is identical, so the arms differ in exactly
      // the intended place. If this ever fails the comparison below is void.
      expect(frozen.boughtByLazy, `L=${length}: the arms must share a lazy member`).toBe(
        responsive.boughtByLazy,
      );
      expect(frozen.pairsChecked).toBe(responsive.pairsChecked);
      expect(frozen.consumed).toBe(responsive.consumed);

      // AND THE DILIGENT LIFTER BUYS MORE, NOT LESS. This is what kills the
      // "they just had a smaller bank" reading: the player who is beaten more
      // often is also the player who bought more coverage.
      expect(responsive.boughtByDiligent, `L=${length}`).toBeGreaterThan(frozen.boughtByDiligent);

      expect(frozen.currentInversions, `L=${length}: frozen must be clean`).toBe(0);
      expect(
        responsive.currentInversions,
        `L=${length}: a training-keyed purchase must break this, or the arm is not measuring`,
      ).toBeGreaterThan(0);
      expect(responsive.longestInversions, `L=${length}: lifetime best`).toBeGreaterThan(0);
      expect(responsive.worstCurrentDeficit, `L=${length}: worst deficit`).toBeGreaterThan(0);
    }
    // AND THE BANNED ARM IS NOT THE LEGAL ARM UNDER ANOTHER NAME: the purses
    // genuinely differ, so the clean table above is not this measurement with a
    // different label on it.
    const bannedPurse = judgePurchaseArm(40, banned, 'frozen').boughtByLazy;
    const legalPurse = judgePurchaseArm(40, legal, 'frozen').boughtByLazy;
    expect(bannedPurse).not.toBe(legalPurse);
  });

  it('AND EVERY BANNED TENDER VIOLATES, so the restriction is drawn where the hazard is', () => {
    // THE LINE IS IN THE RIGHT PLACE, CHECKED FROM BOTH SIDES. The sweep above
    // says every LEGAL tender is clean. On its own that is satisfiable by a
    // restriction that banned far too much — banning all of Chalk, which is the
    // fix a human rejected as too broad. This says every BANNED tender is
    // actually a hazard, so nothing is on the wrong side of the line.
    //
    // Run at one length rather than four: it is the same arm the test above
    // measures at all four, and the point here is coverage of the TENDER list,
    // not of the horizon.
    const length = ENTITLEMENT_VERIFICATION.LENGTHS[1] as number;
    for (const tender of TRAINING_GATED_TENDERS) {
      const responsive = judgePurchaseArm(length, tender, 'responsive');
      expect(
        responsive.currentInversions,
        `${tender} is banned but does not violate — the restriction is too broad`,
      ).toBeGreaterThan(0);
    }
  });

  it('A BANKABLE purchase is training-keyed-unsafe in the same way, so the choice is still a product one', () => {
    // GDD §8.2 records that a BANKABLE purchased day — one that survives its
    // window — is monotone-safe, and that the burn rather than the expiry is
    // what makes a purchase safe. That finding SURVIVES the purchase path going
    // live, and so does its limit: bankable is clean exactly where expiring is
    // clean and violates exactly where expiring violates.
    //
    // WHICH SETTLES SOMETHING AND NOT SOMETHING ELSE. It settles that switching
    // the product does not buy safety and does not cost any. It does not settle
    // the product question, which is about whether a lifter who buys a covered
    // day and does not miss a day has wasted their money.
    //
    // Run at one length rather than four, and that is a suite-time trade rather
    // than a claim: the full table at all four lengths is in GDD §8.3E.
    const length = ENTITLEMENT_VERIFICATION.LENGTHS[3] as number;
    const banned = TRAINING_GATED_TENDERS[0] as CoveredDayTender;
    const frozen = judgeBankablePurchaseArm(length, banned, 'frozen');
    const responsive = judgeBankablePurchaseArm(length, banned, 'responsive');
    expect(frozen.boughtByLazy).toBe(responsive.boughtByLazy);
    expect(frozen.boughtByLazy).toBeGreaterThan(0);
    expect(frozen.currentInversions, 'bankable, frozen').toBe(0);
    expect(frozen.longestInversions, 'bankable, frozen: lifetime best').toBe(0);
    expect(frozen.worstCurrentDeficit, 'bankable, frozen: worst deficit').toBe(0);
    expect(responsive.currentInversions, 'bankable, responsive').toBeGreaterThan(0);
  });

  it('A BANKABLE purchase is ALSO safe — expiry is a product choice, not a safety property', { timeout: budgetFrom(9_617) }, () => {
    // CORRECTING A CLAIM THIS BRANCH MADE AND DID NOT CHECK. `grantCoveredDays`
    // expires a purchased day with its window, and the first version of GDD
    // §8.2 justified that by saying "nothing accumulates, so there is no wealth
    // for a doomed absence to be proportional to" — which reads as "a bankable
    // purchase would reopen the defect". Measured, it would not.
    //
    // THE BURN IS WHAT MAKES IT SAFE, NOT THE EXPIRY. A doomed absence takes
    // everything available including the bank, so two lifters holding different
    // banks are both left on zero, and the base entitlement refreshes them
    // identically at the next boundary. The bank re-converges for the same
    // reason the entitlement does.
    //
    // WHY THIS MATTERS RATHER THAN BEING A FOOTNOTE: §8.3E flags that an
    // expiring consumable is a weaker product than a bankable one, and this is
    // the measurement that says the better product is available. The module
    // still expires, because that is the shipped choice until a human rules;
    // this models the alternative rather than implementing it.
    const length = ENTITLEMENT_VERIFICATION.LENGTHS[3] as number;
    for (const buyDays of ENTITLEMENT_VERIFICATION.BANKABLE_PURCHASE_DAYS) {
      let currentInversions = 0;
      let longestInversions = 0;
      let worst = 0;
      let consumed = 0;
      let pairs = 0;
      for (const seed of MONOTONICITY_SWEEP.SEEDS) {
        for (const schedule of seededSchedules(seed, length)) {
          const lazy = driveBankable(schedule, buyDays);
          consumed += lazy.consumed;
          for (const superset of singleDaySupersets(schedule)) {
            const diligent = driveBankable(superset, buyDays);
            pairs += 1;
            const deficit = lazy.currentStreak - diligent.currentStreak;
            if (deficit > 0) {
              currentInversions += 1;
              worst = Math.max(worst, deficit);
            }
            if (diligent.longestStreak < lazy.longestStreak) longestInversions += 1;
          }
        }
      }
      const label = `bankable purchase on ${JSON.stringify(buyDays)}`;
      expect(pairs, label).toBeGreaterThan(0);
      expect(consumed, `${label}: nothing consumed`).toBeGreaterThan(0);
      expect(currentInversions, label).toBe(0);
      expect(longestInversions, `${label}: lifetime best`).toBe(0);
      expect(worst, `${label}: worst deficit`).toBe(0);
    }
  });

  it('ADVERSARIAL SEARCH: hill-climbs towards a violation instead of waiting for one', () => {
    // Every other test here samples and hopes. This one optimises: random
    // restarts, then repeatedly accept any single-day mutation that does not
    // reduce the largest deficit found over the calendar's supersets. If a
    // violation exists anywhere near this population, a climb finds it far
    // faster than a sweep stumbles onto it.
    const { LENGTH, RESTARTS, STEPS, SEED } = ENTITLEMENT_VERIFICATION.ADVERSARIAL;
    let prng = seedState(SEED);
    const rand = (): number => {
      const draw = nextRandom(prng);
      prng = draw.state;
      return draw.value;
    };
    const scoreOf = (base: TrainingSchedule): number => {
      const lazy = drive(base, DEFAULT);
      let best = 0;
      for (const superset of singleDaySupersets(base)) {
        const diligent = drive(superset, DEFAULT);
        best = Math.max(
          best,
          lazy.currentStreak - diligent.currentStreak,
          lazy.longestStreak - diligent.longestStreak,
        );
      }
      return best;
    };

    let bestFound = 0;
    let bestCalendar = '';
    let calendarsEvaluated = 0;
    for (let restart = 0; restart < RESTARTS; restart += 1) {
      const rate = 0.15 + rand() * 0.75;
      let base: boolean[] = Array.from({ length: LENGTH }, () => rand() < rate);
      let score = scoreOf(base);
      calendarsEvaluated += 1;
      for (let step = 0; step < STEPS; step += 1) {
        const flip = Math.floor(rand() * LENGTH);
        const candidate = base.map((trained, i) => (i === flip ? !trained : trained));
        const candidateScore = scoreOf(candidate);
        calendarsEvaluated += 1;
        if (candidateScore >= score) {
          base = candidate;
          score = candidateScore;
        }
      }
      if (score > bestFound) {
        bestFound = score;
        bestCalendar = renderSchedule(base);
      }
    }
    expect(calendarsEvaluated).toBe(RESTARTS * (STEPS + 1));
    expect(bestFound, `hill-climb found a violating calendar: ${bestCalendar}`).toBe(0);

    // AND THE CLIMB CAN CLIMB. Pointed at the doomed-absence-is-free variant it
    // must find a violation, or the search above proved nothing about the
    // search, only about the sweep.
    const broken: RunOptions = { ...DEFAULT, burnOnDoom: false };
    const brokenScore = (base: TrainingSchedule): number => {
      const lazy = drive(base, broken);
      let best = 0;
      for (const superset of singleDaySupersets(base)) {
        best = Math.max(best, lazy.currentStreak - drive(superset, broken).currentStreak);
      }
      return best;
    };
    let foundOnBroken = 0;
    let brokenPrng = seedState(SEED);
    for (let restart = 0; restart < RESTARTS && foundOnBroken === 0; restart += 1) {
      const draw = nextRandom(brokenPrng);
      brokenPrng = draw.state;
      const rate = 0.15 + draw.value * 0.75;
      let base: boolean[] = [];
      for (let i = 0; i < LENGTH; i += 1) {
        const d = nextRandom(brokenPrng);
        brokenPrng = d.state;
        base.push(d.value < rate);
      }
      let score = brokenScore(base);
      for (let step = 0; step < STEPS && score === 0; step += 1) {
        const d = nextRandom(brokenPrng);
        brokenPrng = d.state;
        const flip = Math.floor(d.value * LENGTH);
        const candidate = base.map((trained, i) => (i === flip ? !trained : trained));
        const candidateScore = brokenScore(candidate);
        if (candidateScore >= score) {
          base = candidate;
          score = candidateScore;
        }
      }
      foundOnBroken = Math.max(foundOnBroken, score);
    }
    expect(foundOnBroken, 'the search must be able to find a violation that is there').toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// The pin: everything above grades `drive`, and `drive` has to BE the engine
// ---------------------------------------------------------------------------

describe('the shipped engine is the composition this battery graded', () => {
  /**
   * Compares the reference composition against `src/game/streak.ts` on one
   * calendar, and reports the first field that differs.
   */
  const disagreement = (schedule: TrainingSchedule): string | null => {
    const reference = drive(schedule, DEFAULT);
    const shipped = driveThroughStreakEngine(schedule);
    if (JSON.stringify(reference) === JSON.stringify(shipped)) return null;
    return `${renderSchedule(schedule)}: reference ${JSON.stringify(reference)} vs shipped ${JSON.stringify(shipped)}`;
  };

  /**
   * Runs the pin over a set of calendars and fails on the first disagreement.
   *
   * Returns how many calendars were compared and how many covered days the
   * reference drew across them. The second is the anti-vacuity number and it is
   * accumulated by the CALLER rather than asserted here, because some
   * populations legitimately never draw one — at an attendance rate of 0.95
   * almost every absence is inside the free grace, and that population is in
   * the battery precisely because the seeded generator does not reach it.
   */
  const pin = (
    label: string,
    schedules: Iterable<TrainingSchedule>,
  ): { checked: number; consumed: number } => {
    let checked = 0;
    let consumed = 0;
    for (const schedule of schedules) {
      const rows = disagreement(schedule);
      expect(rows, `${label}: ${rows ?? ''}`).toBeNull();
      consumed += drive(schedule, DEFAULT).consumed;
      checked += 1;
    }
    expect(checked, `${label}: no calendars were compared`).toBeGreaterThan(0);
    return { checked, consumed };
  };

  it('agrees EXHAUSTIVELY on every calendar of 8 to 13 days', () => {
    // Every calendar of these lengths, not every PAIR — the pin is about the
    // two implementations agreeing, and a pair of calendars is two calendars.
    // 13 rather than 16 because the pin costs two engines per calendar and 2^16
    // of those is most of this file's time budget for one number.
    let checked = 0;
    let consumed = 0;
    for (const length of [8, 9, 10, 11, 12, 13]) {
      const count = exhaustiveCalendarCount(length);
      const calendars: TrainingSchedule[] = [];
      for (let mask = 0; mask < count; mask += 1) calendars.push(exhaustiveCalendar(mask, length));
      const run = pin(`exhaustive ${length}`, calendars);
      checked += run.checked;
      consumed += run.consumed;
    }
    expect(checked).toBe([8, 9, 10, 11, 12, 13].reduce((total, l) => total + 2 ** l, 0));
    expect(consumed, 'no covered day was ever drawn').toBeGreaterThan(0);
  });

  it('agrees on the sampled calendars the battery is scored on, at every length', () => {
    // THE LENGTHS THAT MATTER MOST, because they are the ones the exhaustive
    // sweep cannot reach and the ones the stock design failed at. Every seed,
    // a slice of the schedules per seed — enough to cross several window
    // boundaries at every length.
    const PER_SEED = 60;
    let checked = 0;
    let consumed = 0;
    for (const length of ENTITLEMENT_VERIFICATION.LENGTHS) {
      expect(length).toBeGreaterThan(RECOVERY_ENTITLEMENT.WINDOW_DAYS);
      const calendars: TrainingSchedule[] = [];
      for (const seed of MONOTONICITY_SWEEP.SEEDS) {
        calendars.push(...seededSchedules(seed, length).slice(0, PER_SEED));
      }
      const run = pin(`sampled ${length}`, calendars);
      checked += run.checked;
      consumed += run.consumed;
    }
    expect(checked).toBe(
      ENTITLEMENT_VERIFICATION.LENGTHS.length * MONOTONICITY_SWEEP.SEEDS.length * PER_SEED,
    );
    expect(consumed, 'no covered day was ever drawn').toBeGreaterThan(0);
  });

  it('agrees at long horizons and at attendance rates the seeded generator does not reach', () => {
    // The two populations the battery adds on purpose: 200- and 400-day
    // calendars, where the stock's worst deficit reached 189, and the fixed
    // attendance rates at both tails — 0.1 is a lifter whose absences almost
    // always outrun the ceiling, 0.95 is one who almost never misses.
    let checked = 0;
    let consumed = 0;
    for (const length of ENTITLEMENT_VERIFICATION.LONG_LENGTHS) {
      const calendars: TrainingSchedule[] = [];
      for (const seed of MONOTONICITY_SWEEP.SEEDS) {
        calendars.push(...seededSchedules(seed, length).slice(0, 12));
      }
      const run = pin(`long ${length}`, calendars);
      checked += run.checked;
      consumed += run.consumed;
    }
    let drawnAtSomeRate = 0;
    for (const rate of ENTITLEMENT_VERIFICATION.FIXED_ATTENDANCE_RATES) {
      const run = pin(
        `attendance ${rate}`,
        fixedRateSchedules(
          ENTITLEMENT_VERIFICATION.FIXED_ATTENDANCE_SEED,
          ENTITLEMENT_VERIFICATION.FIXED_ATTENDANCE_LENGTH,
          rate,
          30,
        ),
      );
      checked += run.checked;
      drawnAtSomeRate += run.consumed;
    }
    expect(checked).toBe(
      ENTITLEMENT_VERIFICATION.LONG_LENGTHS.length * MONOTONICITY_SWEEP.SEEDS.length * 12 +
        ENTITLEMENT_VERIFICATION.FIXED_ATTENDANCE_RATES.length * 30,
    );
    expect(consumed, 'the long horizons never drew a covered day').toBeGreaterThan(0);
    expect(drawnAtSomeRate, 'no fixed-rate population ever drew a covered day').toBeGreaterThan(0);
  });

  it('agrees on the shapes a calendar generator does not produce', () => {
    // HAND-BUILT EDGE CASES, because the generators above are Bernoulli and a
    // Bernoulli draw at 0.2 will not reliably produce "never trains at all" or
    // "trains only on a window boundary". Each of these is a case where the two
    // implementations could plausibly have been written differently.
    const W = RECOVERY_ENTITLEMENT.WINDOW_DAYS;
    const at = (length: number, days: readonly number[]): TrainingSchedule =>
      Array.from({ length }, (_, i) => days.includes(i));

    const cases: readonly TrainingSchedule[] = [
      at(W * 3, []), // never trains: the signup absence, resolved by nobody
      at(W * 3, [0]), // trains once, on the signup day, then vanishes
      at(W * 3, [W * 3 - 1]), // trains once, on the last day, after a huge absence
      at(W * 3, [W - 1, W]), // either side of a window boundary
      at(W * 3, [W - 1, W + GRACE + 1]), // an absence that STRADDLES a boundary
      at(W * 3, [0, W, W * 2]), // one session per window, absences of a window each
      Array.from({ length: W * 2 }, () => true), // trains every single day
      Array.from({ length: W * 2 }, (_, i) => i % (GRACE + 1) === 0), // the free-grace treadmill
      Array.from({ length: W * 2 }, (_, i) => i % (GRACE + 2) === 0), // one covered day per absence
    ];
    for (const [index, schedule] of cases.entries()) {
      expect(disagreement(schedule), `hand-built case ${index}`).toBeNull();
    }
    // Not vacuous: at least one of them really did draw on the entitlement, and
    // at least one really did end with a dead run.
    expect(cases.some((schedule) => drive(schedule, DEFAULT).consumed > 0)).toBe(true);
    expect(cases.some((schedule) => drive(schedule, DEFAULT).currentStreak === 0)).toBe(true);
  });

  it('agrees WITH PURCHASES IN THE FIELD, which is what makes §8.3E\'s table transfer', () => {
    // THE GAP THIS CLOSES, and it would have been easy to leave open. Every pin
    // above drives both engines with NO purchases, so the moment `drive` grew a
    // purchase path the §8.3E table became a statement about the reference
    // composition and not about `src/game/streak.ts`. GDD §4.4 says in terms
    // that the pin is what makes these tables mean anything about the shipped
    // game; a purchase table with no purchase pin under it would mean nothing.
    //
    // Both arms are pinned, not just the safe one: the reference and the engine
    // have to agree about the violating case too, or the negative control is a
    // control on a program nobody ships.
    //
    // THE DAY PATTERNS COME FROM BOTH ARRIVALS AND THE TENDER IS LEGAL IN BOTH,
    // which is not a contradiction and is worth stating. Legality is about who
    // may buy; this pin is about whether the two engines do the same ARITHMETIC
    // given a list of buy days. Feeding it the session-keyed day pattern is
    // strictly more coverage — those calendars are lumpier — and says nothing
    // about whether that pattern is purchasable.
    let checked = 0;
    let purchasedSeen = 0;
    let differedFromNoPurchase = 0;
    for (const arrival of ['calendar', 'session-count'] as const) {
      for (const length of ENTITLEMENT_VERIFICATION.LENGTHS) {
        for (const seed of MONOTONICITY_SWEEP.SEEDS) {
          for (const schedule of seededSchedules(seed, length).slice(0, 12)) {
            const buys = coveredDayPurchaseDays(schedule, arrival);
            const reference = drive(schedule, { ...DEFAULT, purchaseDays: buys });
            const shipped = driveThroughStreakEngine(schedule, buys);
            expect(
              JSON.stringify(shipped),
              `arrival=${arrival} ${renderSchedule(schedule)}: reference ${JSON.stringify(reference)}`,
            ).toBe(JSON.stringify(reference));
            purchasedSeen += reference.peakPurchased;
            if (
              JSON.stringify(drive(schedule, DEFAULT)) !==
              JSON.stringify({ ...reference, bought: 0, peakPurchased: 0 })
            ) {
              differedFromNoPurchase += 1;
            }
            checked += 1;
          }
        }
      }
    }
    expect(checked).toBe(2 * ENTITLEMENT_VERIFICATION.LENGTHS.length * MONOTONICITY_SWEEP.SEEDS.length * 12);
    // NOT VACUOUS TWICE OVER: purchased days really were in the field, and
    // buying really did change some outcome — so this is not the zero-purchase
    // pin above under a different name.
    expect(purchasedSeen, 'no run ever held a purchased day').toBeGreaterThan(0);
    expect(differedFromNoPurchase, 'buying changed no outcome anywhere').toBeGreaterThan(0);
  });

  it('DETECTS A DIFFERENCE: the pin is not comparing two copies of one engine', () => {
    // THE ANTI-VACUITY FOR THE PIN ITSELF, and it needs its own test because
    // every assertion above is "these are equal". A comparator that could not
    // tell the two apart would pass all of them while proving nothing — which
    // is precisely the failure mode this module has had twice.
    //
    // `burnOnDoom: false` is the one variant of `drive` that is known to differ
    // from the shipped rule, and it is the negative control the battery already
    // relies on: GDD §4.2 RULE 2 says a doomed absence consumes what was armed,
    // and what dropping it measures is pinned by
    // `[dropping-the-doomed-burn-measures-worse]` rather than restated here.
    const withoutTheBurn: RunOptions = { ...DEFAULT, burnOnDoom: false };
    let disagreements = 0;
    let compared = 0;
    for (const seed of MONOTONICITY_SWEEP.SEEDS) {
      for (const schedule of seededSchedules(seed, 60).slice(0, 40)) {
        const shipped = driveThroughStreakEngine(schedule);
        const variant = drive(schedule, withoutTheBurn);
        compared += 1;
        if (JSON.stringify(shipped) !== JSON.stringify(variant)) disagreements += 1;
      }
    }
    expect(compared).toBe(MONOTONICITY_SWEEP.SEEDS.length * 40);
    expect(disagreements, 'the comparator cannot see a rule change').toBeGreaterThan(0);
  });

});
