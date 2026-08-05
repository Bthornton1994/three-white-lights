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
import {
  ENTITLEMENT_FACT_KEYS,
  MAX_COVERED_DAYS_ONE_ABSENCE_MAY_DRAW,
  RECOVERY_ENTITLEMENT,
  afterSession,
  coveredDaysAvailable,
  freshEntitlement,
  creditCoveredDays,
  resolveEntitlement,
  windowIndexOf,
  windowStartDay,
  type EntitlementState,
  type EntitlementTuning,
} from './streakEntitlement';
import {
  RECOVERY_DAY_GUARDRAILS,
  asStreakDay,
  createStreakState,
  openDay,
  recordTrainingDay,
  settleBrokenStreak,
  type StreakState,
} from './streak';
import {
  ENTITLEMENT_VERIFICATION,
  MONOTONICITY_SWEEP,
  exhaustiveCalendar,
  exhaustiveCalendarCount,
  fixedRateSchedules,
  renderSchedule,
  seededSchedules,
  singleDaySupersets,
  type TrainingSchedule,
} from './streakSweep';
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
}

interface RunResult {
  readonly currentStreak: number;
  readonly longestStreak: number;
  readonly consumed: number;
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
  const { tuning, grant, burnOnDoom } = options;
  const windowAt = (day: number): number => windowIndexOf(tuning, 0, day);
  let entitlement = freshEntitlement(tuning, 0);
  let currentStreak = 0;
  let longestStreak = 0;
  let lastTrainedDay: number | null = null;
  let sessions = 0;
  let consumedTotal = 0;

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
  return { currentStreak, longestStreak, consumed: consumedTotal };
}

const DEFAULT: RunOptions = { tuning: RECOVERY_ENTITLEMENT, grant: { kind: 'none' }, burnOnDoom: true };

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
function driveThroughStreakEngine(schedule: TrainingSchedule): RunResult {
  let state: StreakState = createStreakState(asStreakDay(0));
  let consumed = 0;

  for (let i = 0; i < schedule.length; i += 1) {
    const day = asStreakDay(i);
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
  return { currentStreak: state.currentStreak, longestStreak: state.longestStreak, consumed };
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

  it('THE PURCHASE PATH cannot itself create a violation', () => {
    // GDD §8.2's purchase path, checked against the rule it exists under. A
    // covered day granted on a fixed calendar day — including one landing
    // exactly on a window boundary — leaves the property intact on all four
    // figures. This is the measured basis for the §8.3 proposal, not a claim
    // about it.
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
    const tuning = RECOVERY_ENTITLEMENT;
    const windowAt = (day: number): number => windowIndexOf(tuning, 0, day);

    const driveBankable = (schedule: TrainingSchedule, buyDays: readonly number[]): RunResult => {
      let entitlement = freshEntitlement(tuning, 0);
      let bank = 0;
      let currentStreak = 0;
      let longestStreak = 0;
      let lastTrainedDay: number | null = null;
      let consumed = 0;
      const resolveAt = (today: number): { missed: number; covers: boolean; take: number } => {
        const missed = Math.max(0, today - (lastTrainedDay ?? 0) - 1);
        const chargeable = Math.max(0, missed - GRACE);
        const available = coveredDaysAvailable(tuning, entitlement, windowAt(today)) + bank;
        const covers = chargeable <= Math.min(available, tuning.MAX_COVERED_DAYS_PER_ABSENCE);
        return { missed, covers, take: covers ? chargeable : available };
      };
      for (let i = 0; i < schedule.length; i += 1) {
        if (buyDays.includes(i)) bank += 1;
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
      return { currentStreak, longestStreak, consumed };
    };

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
