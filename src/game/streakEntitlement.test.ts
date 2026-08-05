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
  grantCoveredDays,
  resolveEntitlement,
  windowIndexOf,
  windowStartDay,
  type EntitlementState,
  type EntitlementTuning,
} from './streakEntitlement';
import { RECOVERY_DAY_GUARDRAILS } from './streak';
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
    entitlement = grantCoveredDays(tuning, entitlement, windowAt(day), 1).state;
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
    const bought = grantCoveredDays(RECOVERY_ENTITLEMENT, freshEntitlement(RECOVERY_ENTITLEMENT, 0), 0, 1).state;
    const after = afterSession(RECOVERY_ENTITLEMENT, bought, 0, 1);
    expect(after.coveredDaysLeft).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW - 1);
    expect(after.purchasedDaysLeft).toBe(1);
  });

  it('expires a purchased covered day with its window — nothing accumulates', () => {
    // The property that makes a purchase monotone-safe where a purchased
    // Recovery Day was not, and the thing store copy has to say out loud.
    const bought = grantCoveredDays(RECOVERY_ENTITLEMENT, freshEntitlement(RECOVERY_ENTITLEMENT, 0), 0, 3).state;
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
    for (let i = 0; i < 10; i += 1) state = grantCoveredDays(RECOVERY_ENTITLEMENT, state, 0, 1).state;
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
    expect(() => grantCoveredDays(RECOVERY_ENTITLEMENT, state, 0, 0)).toThrow(RangeError);
    expect(() => grantCoveredDays(RECOVERY_ENTITLEMENT, state, 0, 1.5)).toThrow(RangeError);
  });

  it('never mutates the state it is given', () => {
    const state = freshEntitlement(RECOVERY_ENTITLEMENT, 0);
    const copy = { ...state };
    resolveEntitlement(RECOVERY_ENTITLEMENT, state, 3, 2);
    afterSession(RECOVERY_ENTITLEMENT, state, 3, 2);
    grantCoveredDays(RECOVERY_ENTITLEMENT, state, 3, 2);
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
