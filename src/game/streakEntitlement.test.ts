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
import { describe, expect, it } from 'vitest';
import * as entitlementModule from './streakEntitlement';
import {
  COVERAGE_SOURCES,
  COVERAGE_SOURCE_COUNTER,
  ENTITLEMENT_FACT_KEYS,
  MAX_COVERED_DAYS_ONE_ABSENCE_MAY_DRAW,
  PURCHASED_DAY_TOUCHING_FUNCTIONS,
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
  let entitlement = freshEntitlement(tuning, 0);
  let currentStreak = 0;
  let longestStreak = 0;
  let lastTrainedDay: number | null = null;
  let sessions = 0;
  let consumedTotal = 0;
  let bought = 0;
  let peakPurchased = 0;

  const resolveAt = (today: number): { daysMissed: number; chargeable: number; covers: boolean; consumed: number } => {
    const anchor = lastTrainedDay ?? 0;
    const daysMissed = Math.max(0, today - anchor - 1);
    const chargeable = Math.max(0, daysMissed - GRACE);
    const outcome = resolveEntitlement(tuning, entitlement, windowAt(today), chargeable);
    return {
      daysMissed,
      chargeable,
      covers: outcome.covers,
      consumed: outcome.covers ? outcome.consumed : burnOnDoom ? outcome.consumed : 0,
    };
  };

  const addCoveredDay = (day: number): void => {
    entitlement = creditCoveredDays(tuning, entitlement, windowAt(day), 1, 'window-entitlement').state;
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
    if (purchaseDays.length > 0) {
      for (let k = 0; k < purchaseDays.length; k += 1) {
        if (purchaseDays[k] !== i) continue;
        const amount = COVERED_DAY_PURCHASE_SWEEP.COVERED_DAYS_PER_ORDER;
        entitlement = creditCoveredDays(tuning, entitlement, windowAt(i), amount, 'purchase').state;
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
    entitlement = afterSession(tuning, entitlement, windowAt(i), r.consumed);
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
  return { currentStreak, longestStreak, consumed: consumedTotal, bought, peakPurchased };
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
      });
      if (!applied.ok) throw new Error(`streak engine refused a purchase on day ${i}: ${applied.error.code}`);
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
  return { currentStreak, longestStreak, consumed, bought, peakPurchased };
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

  it('is credited by EXACTLY ONE source, and that source is the purchase', () => {
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

describe('nothing can award a purchased covered day, and that is enforced rather than absent', () => {
  const read = (file: string): string => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const source: string = require('node:fs').readFileSync(
      require('node:path').join(__dirname, file),
      'utf8',
    );
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
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

  it('THE ALLOWLIST IS EXACT: every declaration that can name a purchased day is listed', () => {
    // THE GUARD THAT DOES NOT DEPEND ON WHAT A FUNCTION IS CALLED. The obvious
    // version of this test is a blocklist on `grant`, `credit`, `buy`, `award` —
    // and `streak.test.ts` carried exactly that until this round. It cannot
    // catch `markStreakMilestone` handing out a purchased day, because the
    // mutant uses none of those words. This keys on the FIELD: any declaration
    // that so much as names the purchased counter or the `'purchase'` source has
    // to appear in `PURCHASED_DAY_TOUCHING_FUNCTIONS`, whatever it is called.
    //
    // EXACT IN BOTH DIRECTIONS, so a stale entry fails too — an allowlist that
    // can only grow is one nobody prunes and eventually one that permits
    // everything.
    //
    // THE SCAN READS THREE FILES NOW. `currencyProvenance.ts` decides who may
    // buy a covered day, which is where the laundered path went — an
    // achievement pays Chalk, Chalk buys a covered day, and neither of the
    // other two files ever sees an achievement. Leaving it unscanned would
    // leave the exact edit this allowlist exists to surface — a new tender —
    // invisible to it.
    const found: string[] = [];
    for (const file of ['streakEntitlement.ts', 'streak.ts', 'currencyProvenance.ts']) {
      for (const [name, body] of declarations(read(file))) {
        if (/purchas/i.test(body)) found.push(name);
      }
    }
    expect(found.sort()).toEqual([...PURCHASED_DAY_TOUCHING_FUNCTIONS].sort());
  });

  it('AND THE SCAN CAN SEE A NEW ONE: it is not matching nothing', () => {
    // ANTI-VACUITY FOR THE SCANNER ITSELF. The test above is a set equality, and
    // a `declarations` that returned an empty list would satisfy it against an
    // empty allowlist while proving nothing. This drives the same scanner over a
    // synthetic module containing exactly the mutant condition 3 forbids.
    const mutant = [
      'export function ordinaryHelper(a: number): number {',
      '  return a + 1;',
      '}',
      'export function markStreakMilestone(state: EntitlementState): EntitlementState {',
      '  return { ...state, purchasedDaysLeft: state.purchasedDaysLeft + 1 };',
      '}',
    ].join('\n');
    const names = declarations(mutant)
      .filter(([, body]) => /purchas/i.test(body))
      .map(([name]) => name);
    expect(names).toEqual(['markStreakMilestone']);
    expect(PURCHASED_DAY_TOUCHING_FUNCTIONS).not.toContain('markStreakMilestone');
    // The allowlist is non-empty, so the equality above is not two empty sets.
    expect(PURCHASED_DAY_TOUCHING_FUNCTIONS.length).toBeGreaterThan(0);
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

  it('EXHAUSTIVE: every calendar of 8 to 16 days, both fields', () => {
    for (const length of MONOTONICITY_SWEEP.EXHAUSTIVE_LENGTHS) {
      expectClean(`exhaustive L=${length}`, judge(exhaustivePairs(length), DEFAULT));
    }
  });

  it('SAMPLED: 40, 60, 80 and 100 days — including the LIFETIME BEST', () => {
    // The stock design measured 13 / 122 / 142 / 74 `currentStreak` inversions
    // here and 14 / 150 / 276 / 221 lifetime-best inversions. The lifetime-best
    // row is the one that had never been measured past 16 days at all, and it
    // is the half that does not heal, so it is asserted at every length rather
    // than sampled at one.
    for (const length of ENTITLEMENT_VERIFICATION.LENGTHS) {
      expectClean(`sampled L=${length}`, judge(sampledPairs(length), DEFAULT));
    }
  });

  it('MAGNITUDE AT LONG HORIZONS: 200 and 400 days', () => {
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

  it('EVERY TUNING IN THE GRID: a playtester must not be able to turn the property off', () => {
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

  it('THE FREE GRANT PATH cannot itself create a violation', () => {
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

  it('EVERY FUNDABLE TENDER, EVERY HORIZON: 0 violations across the whole legal funding surface', () => {
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
        expectClean(`${tender} purchases L=${length}`, verdict);
        // NOT VACUOUS IN THE WAY THAT MATTERS HERE: covered days were bought,
        // and the purchased counter really carried them. A sweep that bought
        // nothing would satisfy every assertion above and mean nothing.
        expect(verdict.boughtByLazy, `${tender} L=${length}: nothing was bought`).toBeGreaterThan(0);
        expect(
          verdict.peakPurchased,
          `${tender} L=${length}: purchasedDaysLeft never left zero`,
        ).toBeGreaterThan(0);
        // "CLEAN BY CONSTRUCTION", CHECKED RATHER THAN CLAIMED. For a legal
        // tender the diligent member's recomputation returns the lazy member's
        // day list, so the `responsive` and `frozen` treatments must agree BIT
        // FOR BIT. This is a much sharper instrument than the zero above: it
        // goes red the moment a legal tender's purse becomes sensitive to
        // training, which is strictly earlier than the moment that sensitivity
        // happens to produce a violation at one of these four lengths.
        expect(
          JSON.stringify(judgePurchaseArm(length, tender, 'frozen')),
          `${tender} L=${length}: a legal tender's purchase day moved with training`,
        ).toBe(JSON.stringify(verdict));
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

  it('A BANKABLE purchase is ALSO safe — expiry is a product choice, not a safety property', () => {
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
    // and dropping it measures 1051 violating pairs at 60 days.
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
