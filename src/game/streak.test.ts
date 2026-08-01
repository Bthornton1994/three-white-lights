import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  RECOVERY_DAY_ECONOMY,
  RECOVERY_DAY_GRANT_AMOUNT,
  RECOVERY_DAY_GUARDRAILS,
  RECOVERY_DAY_OUTCOME_KEYS,
  RECOVERY_DAY_SOURCES,
  STREAK_DAY_BOUNDARY,
  STREAK_FACT_KEYS,
  STREAK_MILESTONE_DAYS,
  acceptRecoveryDayOffer,
  addDays,
  asStreakDay,
  chargeableGapDays,
  civilDateFromStreakDay,
  coverableGapDays,
  createStreakState,
  currentRecoveryDayOffer,
  daysBetween,
  daysMissedBefore,
  declineRecoveryDayOffer,
  grantRecoveryDays,
  lastCoveredDay,
  lastDayStreakCanBeSaved,
  openDay,
  payableGapDays,
  recordTrainingDay,
  recoveryDayCapacity,
  recoveryDayGrantAmount,
  settleBrokenStreak,
  streakDayFromCivilDate,
  streakDayFromLocalWallClock,
  streakDeadlineDay,
  type RecoveryDayGrant,
  type StreakDay,
  type StreakResult,
  type StreakState,
} from './streak';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Unwraps a successful result, failing loudly with the error code if not. */
function unwrap<T>(result: StreakResult<T>): T {
  if (!result.ok) {
    throw new Error(`expected ok, got ${result.error.code}: ${result.error.message}`);
  }
  return result.value;
}

function errorCodeOf<T>(result: StreakResult<T>): string {
  return result.ok ? 'OK' : result.error.code;
}

const DAY_ZERO: StreakDay = asStreakDay(20000);

/** GDD §4.4: gaps of this many days or fewer cost nothing at all. */
const GRACE = RECOVERY_DAY_GUARDRAILS.FREE_GRACE_GAP_DAYS;

/**
 * The shortest gap that costs a Recovery Day — one day past the free grace, and
 * therefore the shortest gap that produces an offer at all.
 *
 * Derived rather than hard-coded, so retuning `FREE_GRACE_GAP_DAYS` moves every
 * test in this file that means "a gap you have to pay for" instead of silently
 * turning them into tests of the free path.
 */
const SHORTEST_PAID_GAP = GRACE + 1;

/** The day the app is opened after `gapDays` missed days following `lastDay`. */
function dayAfterGap(lastDay: StreakDay, gapDays: number): StreakDay {
  return addDays(lastDay, gapDays + 1);
}

/** Trains on `count` consecutive days starting at `from`. Asserts each succeeds. */
function trainConsecutively(state: StreakState, from: StreakDay, count: number): StreakState {
  let next = state;
  for (let i = 0; i < count; i += 1) {
    next = unwrap(recordTrainingDay(next, addDays(from, i))).state;
  }
  return next;
}

/** A state with a live `streakLength`-day run ending on `lastDay`, and a set balance. */
function stateWithRun(streakLength: number, lastDay: StreakDay, balance: number): StreakState {
  return {
    currentStreak: streakLength,
    longestStreak: streakLength,
    lastTrainedDay: lastDay,
    recoveredThroughDay: null,
    consecutiveRecoveryDaysUsed: 0,
    recoveryDayBalance: balance,
    hasResolvedFirstBreakOffer: false,
  };
}

function clone(state: StreakState): StreakState {
  return { ...state };
}

/** Deterministic PRNG (mulberry32) so the property sweep is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Purity — the module's own source is the artifact under test here
// ---------------------------------------------------------------------------

describe('purity contract', () => {
  const source = readFileSync(fileURLToPath(new URL('./streak.ts', import.meta.url)), 'utf8');
  // Comments are stripped so the header's own prose about `Date.now` does not
  // trip the scan. The sanity assertion below proves the strip left real code.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('strips comments without destroying the code (sanity check for the scans below)', () => {
    expect(code).toContain('export function recordTrainingDay');
    expect(code).toContain('export function acceptRecoveryDayOffer');
    expect(code).not.toContain('Howard Hinnant');
  });

  it('imports nothing at all, so it cannot import React', () => {
    expect(code).not.toMatch(/^\s*import\s/m);
    expect(code).not.toMatch(/\brequire\s*\(/);
  });

  it('never reads a clock', () => {
    expect(code).not.toMatch(/\bDate\b/);
    expect(code).not.toMatch(/\bperformance\s*\./);
    expect(code).not.toMatch(/\bhrtime\b/);
  });

  it('never uses randomness', () => {
    expect(code).not.toMatch(/Math\s*\.\s*random/);
    expect(code).not.toMatch(/crypto/);
  });

  it('has no ambient side-effect surface (no process, no globalThis)', () => {
    expect(code).not.toMatch(/\bprocess\s*\./);
    expect(code).not.toMatch(/\bglobalThis\b/);
    expect(code).not.toMatch(/console\s*\./);
  });

  it('calls a Recovery Day a Recovery Day — no "token", "freeze", "shield" or "save" API', () => {
    // GDD §4.2: the flavour is load-bearing, and the naming carries it.
    expect(code).not.toMatch(/[Tt]oken/);
    expect(code).not.toMatch(/[Ff]reeze/);
    expect(code).not.toMatch(/[Ss]hield/);
    expect(code).not.toMatch(/streakSave|StreakSave/);
  });

  it('exposes no auto-apply path', () => {
    expect(code).not.toMatch(/autoApply|autoUse|autoSpend|applyAutomatically/i);
  });
});

// ---------------------------------------------------------------------------
// Days
// ---------------------------------------------------------------------------

describe('civil day arithmetic', () => {
  // Reference values come from `Date.UTC` — an implementation completely
  // independent of the `days_from_civil` arithmetic in the module.
  const REFERENCE: readonly (readonly [number, number, number, number])[] = [
    [1970, 1, 1, 0],
    [1970, 1, 2, 1],
    [1969, 12, 31, -1],
    [2000, 1, 1, 10957],
    [2000, 2, 29, 11016],
    [2000, 3, 1, 11017],
    [2024, 2, 29, 19782],
    [2026, 8, 1, 20666],
    [2026, 12, 31, 20818],
    [1900, 3, 1, -25508],
    [2100, 1, 1, 47482],
  ];

  it('matches an independent reference implementation on known dates', () => {
    for (const [year, month, day, expected] of REFERENCE) {
      expect(streakDayFromCivilDate({ year, month, day })).toBe(expected);
    }
  });

  it('agrees with Date.UTC across three centuries of month starts', () => {
    for (let year = 1900; year <= 2200; year += 1) {
      for (let month = 1; month <= 12; month += 1) {
        const expected = Math.round(Date.UTC(year, month - 1, 1) / 86_400_000);
        expect(streakDayFromCivilDate({ year, month, day: 1 })).toBe(expected);
      }
    }
  });

  it('round-trips every day across a decade', () => {
    const start = streakDayFromCivilDate({ year: 2020, month: 1, day: 1 });
    for (let offset = 0; offset < 3653; offset += 1) {
      const day = addDays(start, offset);
      expect(streakDayFromCivilDate(civilDateFromStreakDay(day))).toBe(day);
    }
  });

  it('consecutive calendar dates are always exactly one day apart', () => {
    // The reason for civil-day arithmetic rather than epoch-millisecond
    // division: a 23- or 25-hour DST day is still one day.
    const start = streakDayFromCivilDate({ year: 2026, month: 3, day: 1 });
    for (let offset = 0; offset < 400; offset += 1) {
      const a = addDays(start, offset);
      const b = addDays(start, offset + 1);
      expect(daysBetween(a, b)).toBe(1);
    }
  });

  it('accepts real leap days and rejects fake ones', () => {
    expect(() => streakDayFromCivilDate({ year: 2024, month: 2, day: 29 })).not.toThrow();
    expect(() => streakDayFromCivilDate({ year: 2000, month: 2, day: 29 })).not.toThrow();
    expect(() => streakDayFromCivilDate({ year: 1900, month: 2, day: 29 })).toThrow(RangeError);
    expect(() => streakDayFromCivilDate({ year: 2026, month: 2, day: 29 })).toThrow(RangeError);
  });

  it('rejects impossible dates', () => {
    expect(() => streakDayFromCivilDate({ year: 2026, month: 13, day: 1 })).toThrow(RangeError);
    expect(() => streakDayFromCivilDate({ year: 2026, month: 0, day: 1 })).toThrow(RangeError);
    expect(() => streakDayFromCivilDate({ year: 2026, month: 4, day: 31 })).toThrow(RangeError);
    expect(() => streakDayFromCivilDate({ year: 2026, month: 1, day: 0 })).toThrow(RangeError);
    expect(() => streakDayFromCivilDate({ year: 2026.5, month: 1, day: 1 })).toThrow(RangeError);
  });

  it('rejects non-integer day indices and offsets', () => {
    expect(() => asStreakDay(1.5)).toThrow(RangeError);
    expect(() => asStreakDay(Number.NaN)).toThrow(RangeError);
    expect(() => addDays(DAY_ZERO, 0.5)).toThrow(RangeError);
  });
});

describe('the day boundary', () => {
  const date = { year: 2026, month: 8, day: 1 } as const;
  const civilDay = streakDayFromCivilDate(date);

  it('puts an hour before the rollover in the previous streak day', () => {
    const beforeRollover = STREAK_DAY_BOUNDARY.ROLLOVER_HOUR_LOCAL - 1;
    expect(streakDayFromLocalWallClock({ ...date, hour: beforeRollover })).toBe(addDays(civilDay, -1));
  });

  it('puts the rollover hour itself in the new streak day', () => {
    expect(streakDayFromLocalWallClock({ ...date, hour: STREAK_DAY_BOUNDARY.ROLLOVER_HOUR_LOCAL })).toBe(
      civilDay,
    );
  });

  it('keeps a whole 24-hour span inside exactly two streak days', () => {
    const days = new Set<number>();
    for (let hour = 0; hour <= 23; hour += 1) {
      days.add(streakDayFromLocalWallClock({ ...date, hour }));
    }
    const rollover: number = STREAK_DAY_BOUNDARY.ROLLOVER_HOUR_LOCAL;
    expect(days.size).toBe(rollover === 0 ? 1 : 2);
  });

  it('rejects hours outside 0-23', () => {
    expect(() => streakDayFromLocalWallClock({ ...date, hour: 24 })).toThrow(RangeError);
    expect(() => streakDayFromLocalWallClock({ ...date, hour: -1 })).toThrow(RangeError);
    expect(() => streakDayFromLocalWallClock({ ...date, hour: 1.5 })).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// Constants — pinned against GDD §4.2's stated ranges
// ---------------------------------------------------------------------------

describe('tunable constants sit inside the ranges GDD §4.2 specifies', () => {
  it('holds 3-5 Recovery Days', () => {
    expect(RECOVERY_DAY_GUARDRAILS.HOLD_CAP).toBeGreaterThanOrEqual(3);
    expect(RECOVERY_DAY_GUARDRAILS.HOLD_CAP).toBeLessThanOrEqual(5);
  });

  it('grants 2-3 at signup, and never more than the hold cap', () => {
    expect(RECOVERY_DAY_ECONOMY.SIGNUP_GRANT).toBeGreaterThanOrEqual(2);
    expect(RECOVERY_DAY_ECONOMY.SIGNUP_GRANT).toBeLessThanOrEqual(3);
    expect(RECOVERY_DAY_ECONOMY.SIGNUP_GRANT).toBeLessThanOrEqual(RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
  });

  it('has a consecutive-use limit of at least 1 and below the hold cap', () => {
    expect(RECOVERY_DAY_GUARDRAILS.MAX_CONSECUTIVE_USES).toBeGreaterThanOrEqual(1);
    expect(RECOVERY_DAY_GUARDRAILS.MAX_CONSECUTIVE_USES).toBeLessThan(RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
  });

  it('has a free-grace length that is a separate constant from the consecutive-use limit', () => {
    // GDD §4.4. These two are 2 and 2 today, which is exactly why the human who
    // ruled on §4.4 asked for them to stay separate: one is how much absence is
    // FREE, the other is how many Recovery Days may be SPENT in a row. This test
    // pins the shape of each — a whole non-negative number, and a spend limit of
    // at least one so Recovery Days are still spendable — without asserting they
    // are equal, because their being equal is a coincidence of tuning.
    expect(Number.isInteger(GRACE)).toBe(true);
    expect(GRACE).toBeGreaterThanOrEqual(0);
    expect(GRACE).toBeLessThan(RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    // If the grace ever swallowed every gap the guardrail allows, Recovery Days
    // would become unspendable — earned, purchasable (GDD §4.2, §8.2) and dead.
    expect(RECOVERY_DAY_GUARDRAILS.MAX_CONSECUTIVE_USES).toBeGreaterThanOrEqual(1);
  });

  it('sets the longest repairable absence to the grace plus the consecutive-use limit', () => {
    // The two constants compose rather than compete: a full-balance, freshly
    // trained state can survive exactly this many missed days and no more.
    const state = stateWithRun(50, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    expect(coverableGapDays(state)).toBe(GRACE + RECOVERY_DAY_GUARDRAILS.MAX_CONSECUTIVE_USES);
    expect(currentRecoveryDayOffer(state, dayAfterGap(DAY_ZERO, coverableGapDays(state)))).not.toBeNull();
    expect(currentRecoveryDayOffer(state, dayAfterGap(DAY_ZERO, coverableGapDays(state) + 1))).toBeNull();
  });

  it('charges only the days past the grace', () => {
    for (let gap = 0; gap <= GRACE; gap += 1) {
      expect(chargeableGapDays(gap)).toBe(0);
    }
    for (let extra = 1; extra <= 5; extra += 1) {
      expect(chargeableGapDays(GRACE + extra)).toBe(extra);
    }
  });

  it('pays milestones at 7 / 30 / 100 days, 1 each', () => {
    expect(STREAK_MILESTONE_DAYS).toEqual([7, 30, 100]);
    expect(RECOVERY_DAY_ECONOMY.STREAK_MILESTONE_GRANT).toBe(1);
  });

  it('pays 1 per achievement', () => {
    expect(RECOVERY_DAY_ECONOMY.ACHIEVEMENT_GRANT).toBe(1);
  });

  it('keeps the Gym Empire drop chance a probability, even though this module never rolls it', () => {
    expect(RECOVERY_DAY_ECONOMY.GYM_EMPIRE_DROP_CHANCE_PER_COLLECTION).toBeGreaterThan(0);
    expect(RECOVERY_DAY_ECONOMY.GYM_EMPIRE_DROP_CHANCE_PER_COLLECTION).toBeLessThan(1);
  });

  it('puts the day rollover on a whole hour of the clock', () => {
    expect(Number.isInteger(STREAK_DAY_BOUNDARY.ROLLOVER_HOUR_LOCAL)).toBe(true);
    expect(STREAK_DAY_BOUNDARY.ROLLOVER_HOUR_LOCAL).toBeGreaterThanOrEqual(0);
    expect(STREAK_DAY_BOUNDARY.ROLLOVER_HOUR_LOCAL).toBeLessThanOrEqual(23);
  });

  it('reads free-path grant amounts off the economy table, not off the caller', () => {
    expect(RECOVERY_DAY_GRANT_AMOUNT).toEqual({
      signup: RECOVERY_DAY_ECONOMY.SIGNUP_GRANT,
      'streak-milestone': RECOVERY_DAY_ECONOMY.STREAK_MILESTONE_GRANT,
      achievement: RECOVERY_DAY_ECONOMY.ACHIEVEMENT_GRANT,
      'gym-empire': RECOVERY_DAY_ECONOMY.GYM_EMPIRE_DROP_GRANT,
    });
    expect(recoveryDayGrantAmount({ source: 'achievement' })).toBe(RECOVERY_DAY_ECONOMY.ACHIEVEMENT_GRANT);
    expect(recoveryDayGrantAmount({ source: 'purchase-chalk', amount: 4 })).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// The streak itself
// ---------------------------------------------------------------------------

describe('a new lifter', () => {
  it('starts with no run and the signup grant already credited', () => {
    const state = createStreakState();
    expect(state.currentStreak).toBe(0);
    expect(state.longestStreak).toBe(0);
    expect(state.lastTrainedDay).toBeNull();
    expect(state.recoveryDayBalance).toBe(RECOVERY_DAY_ECONOMY.SIGNUP_GRANT);
    expect(state.hasResolvedFirstBreakOffer).toBe(false);
  });

  it('shows "no active streak" until the first session', () => {
    expect(openDay(createStreakState(), DAY_ZERO)).toEqual({ kind: 'no-active-streak', longestStreak: 0 });
  });

  it('has no offer and no deadline before the first session', () => {
    const state = createStreakState();
    expect(currentRecoveryDayOffer(state, DAY_ZERO)).toBeNull();
    expect(streakDeadlineDay(state)).toBeNull();
    expect(lastDayStreakCanBeSaved(state)).toBeNull();
    expect(lastCoveredDay(state)).toBeNull();
    expect(daysMissedBefore(state, addDays(DAY_ZERO, 400))).toBe(0);
  });
});

describe('streak increments', () => {
  it('counts 1 on the first training day', () => {
    const outcome = unwrap(recordTrainingDay(createStreakState(), DAY_ZERO));
    expect(outcome.streakAfter).toBe(1);
    expect(outcome.state.currentStreak).toBe(1);
    expect(outcome.state.longestStreak).toBe(1);
    expect(outcome.isNewLongestStreak).toBe(true);
    expect(outcome.previousRunEnded).toBe(false);
  });

  it('increments by exactly one per consecutive day', () => {
    let state: StreakState = createStreakState();
    for (let i = 0; i < 40; i += 1) {
      state = unwrap(recordTrainingDay(state, addDays(DAY_ZERO, i))).state;
      expect(state.currentStreak).toBe(i + 1);
      expect(state.longestStreak).toBe(i + 1);
    }
  });

  it('reports the run as alive on the next day, with the deadline', () => {
    const state = trainConsecutively(createStreakState(), DAY_ZERO, 5);
    const opening = openDay(state, addDays(DAY_ZERO, 5));
    expect(opening).toEqual({
      kind: 'streak-alive',
      currentStreak: 5,
      streakIfTrainedToday: 6,
      lastDayStreakCanBeSaved: addDays(DAY_ZERO, 5 + coverableGapDays(state)),
    });
    expect(streakDeadlineDay(state)).toBe(addDays(DAY_ZERO, 5));
  });

  it('refuses a second session on the same day', () => {
    const state = trainConsecutively(createStreakState(), DAY_ZERO, 3);
    expect(errorCodeOf(recordTrainingDay(state, addDays(DAY_ZERO, 2)))).toBe('ALREADY_TRAINED_TODAY');
    expect(openDay(state, addDays(DAY_ZERO, 2))).toEqual({ kind: 'already-trained-today', currentStreak: 3 });
  });

  it('refuses a day already accounted for', () => {
    const state = trainConsecutively(createStreakState(), DAY_ZERO, 3);
    expect(errorCodeOf(recordTrainingDay(state, addDays(DAY_ZERO, 1)))).toBe('DAY_IN_PAST');
    expect(openDay(state, addDays(DAY_ZERO, 1))).toEqual({
      kind: 'day-in-past',
      requestedDay: addDays(DAY_ZERO, 1),
      lastCoveredDay: addDays(DAY_ZERO, 2),
    });
  });
});

describe('streak breaks', () => {
  it('breaks on a chargeable gap when nothing can cover it', () => {
    // The gap is one day past the free grace, so it costs exactly one Recovery
    // Day — and the player holds none.
    const state = { ...trainConsecutively(createStreakState(), DAY_ZERO, 6), recoveryDayBalance: 0 };
    const opening = openDay(state, dayAfterGap(addDays(DAY_ZERO, 5), SHORTEST_PAID_GAP));
    expect(opening).toEqual({
      kind: 'streak-broken',
      brokenRunLength: 6,
      daysMissed: SHORTEST_PAID_GAP,
      reason: 'not-enough-recovery-days',
    });
  });

  it('starts a new run at 1 when training after an uncoverable gap', () => {
    const state = { ...trainConsecutively(createStreakState(), DAY_ZERO, 6), recoveryDayBalance: 0 };
    const outcome = unwrap(
      recordTrainingDay(state, dayAfterGap(addDays(DAY_ZERO, 5), SHORTEST_PAID_GAP)),
    );
    expect(outcome.previousRunEnded).toBe(true);
    expect(outcome.endedRunLength).toBe(6);
    expect(outcome.streakAfter).toBe(1);
    expect(outcome.state.currentStreak).toBe(1);
    expect(outcome.state.longestStreak).toBe(6);
    expect(outcome.state.recoveryDayBalance).toBe(0);
  });

  it('never spends a Recovery Day to settle a break by itself', () => {
    const state = stateWithRun(20, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    const outcome = unwrap(recordTrainingDay(state, addDays(DAY_ZERO, 10)));
    expect(outcome.state.recoveryDayBalance).toBe(RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    expect(outcome.state.currentStreak).toBe(1);
  });

  it('settles an uncoverable break without waiting for the next session', () => {
    const state = stateWithRun(20, DAY_ZERO, 0);
    const outcome = unwrap(settleBrokenStreak(state, dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP)));
    expect(outcome.endedRunLength).toBe(20);
    expect(outcome.daysMissed).toBe(SHORTEST_PAID_GAP);
    expect(outcome.balanceAfter).toBe(0);
    expect(outcome.state.currentStreak).toBe(0);
    expect(outcome.state.lastTrainedDay).toBeNull();
    expect(outcome.state.longestStreak).toBe(20);
  });

  it('refuses to settle an intact run', () => {
    const state = stateWithRun(4, DAY_ZERO, 0);
    expect(errorCodeOf(settleBrokenStreak(state, addDays(DAY_ZERO, 1)))).toBe('NOTHING_TO_SETTLE');
    expect(errorCodeOf(settleBrokenStreak(state, DAY_ZERO))).toBe('NOTHING_TO_SETTLE');
  });

  it('refuses to settle a gap the free grace covers, even with an empty balance', () => {
    // Settling a grace-covered gap would end a run the player still has. Balance
    // 0 so nothing but the grace can possibly be keeping it alive.
    const state = stateWithRun(4, DAY_ZERO, 0);
    for (let gap = 1; gap <= GRACE; gap += 1) {
      expect(errorCodeOf(settleBrokenStreak(state, dayAfterGap(DAY_ZERO, gap)))).toBe('NOTHING_TO_SETTLE');
    }
    expect(errorCodeOf(settleBrokenStreak(state, dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP)))).toBe('OK');
  });

  it('refuses to settle a break the player could still be offered a Recovery Day for', () => {
    // Settling here would be a silent auto-decline, the mirror of auto-apply.
    const state = stateWithRun(4, DAY_ZERO, 2);
    expect(errorCodeOf(settleBrokenStreak(state, dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP)))).toBe(
      'RECOVERY_DECISION_PENDING',
    );
  });

  it('keeps the longest streak across a break', () => {
    let state: StreakState = {
      ...trainConsecutively(createStreakState(), DAY_ZERO, 12),
      recoveryDayBalance: 0,
    };
    state = unwrap(recordTrainingDay(state, addDays(DAY_ZERO, 20))).state;
    expect(state.currentStreak).toBe(1);
    expect(state.longestStreak).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// GDD §4.4 — the free grace period
// ---------------------------------------------------------------------------

describe('the free grace period (GDD §4.4)', () => {
  it('keeps a run alive across a short gap without touching the balance', () => {
    // Balance 0, so nothing but the grace can be doing the work. If the grace
    // were removed this run would be dead at every gap length below.
    for (let gap = 1; gap <= GRACE; gap += 1) {
      const state = stateWithRun(9, DAY_ZERO, 0);
      const backOn = dayAfterGap(DAY_ZERO, gap);
      expect(daysMissedBefore(state, backOn)).toBe(gap);
      expect(openDay(state, backOn)).toEqual({
        kind: 'gap-covered-by-grace',
        currentStreak: 9,
        streakIfTrainedToday: 10,
        daysMissed: gap,
        lastDayStreakCanBeSaved: dayAfterGap(DAY_ZERO, coverableGapDays(state)),
      });

      const outcome = unwrap(recordTrainingDay(state, backOn));
      expect(outcome.previousRunEnded).toBe(false);
      expect(outcome.endedRunLength).toBe(0);
      expect(outcome.streakAfter).toBe(10);
      expect(outcome.state.recoveryDayBalance).toBe(0);
      expect(outcome.state.consecutiveRecoveryDaysUsed).toBe(0);
    }
  });

  it('makes no offer for a gap it covers, at any balance', () => {
    // The read-model half of "nothing is spent": there is no prompt, because
    // there is no decision. Swept across every balance so this cannot be an
    // accident of holding zero.
    for (let balance = 0; balance <= RECOVERY_DAY_GUARDRAILS.HOLD_CAP; balance += 1) {
      for (let gap = 1; gap <= GRACE; gap += 1) {
        const state = stateWithRun(9, DAY_ZERO, balance);
        const backOn = dayAfterGap(DAY_ZERO, gap);
        expect(currentRecoveryDayOffer(state, backOn)).toBeNull();
        expect(openDay(state, backOn).kind).toBe('gap-covered-by-grace');
        // ...and training straight through it is allowed, not blocked on a
        // decision that does not exist.
        expect(errorCodeOf(recordTrainingDay(state, backOn))).toBe('OK');
      }
    }
  });

  it('does not consume the first-break tutorial, because nothing was saved', () => {
    // GDD §4.3 fires on the first break the player can be SAVED from. A gap that
    // cost nothing is not that moment, so the flag must survive it.
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    const trained = unwrap(recordTrainingDay(state, dayAfterGap(DAY_ZERO, GRACE))).state;
    expect(trained.hasResolvedFirstBreakOffer).toBe(false);
    const laterOffer = currentRecoveryDayOffer(
      trained,
      dayAfterGap(trained.lastTrainedDay as StreakDay, SHORTEST_PAID_GAP),
    );
    expect(laterOffer?.isFirstBreakTutorial).toBe(true);
  });

  it('stops exactly one day past the grace, where the first Recovery Day is charged', () => {
    // The boundary in one place. At GRACE the run is free; at GRACE + 1 it costs
    // exactly one Recovery Day and the grace still covers the rest of the gap.
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    expect(currentRecoveryDayOffer(state, dayAfterGap(DAY_ZERO, GRACE))).toBeNull();

    const offer = currentRecoveryDayOffer(state, dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP));
    expect(offer?.cost).toBe(1);
    expect(offer?.daysCoveredFreeByGrace).toBe(GRACE);
    expect(offer?.missedDays).toHaveLength(SHORTEST_PAID_GAP);
    expect(offer?.balanceAfter).toBe(RECOVERY_DAY_GUARDRAILS.HOLD_CAP - 1);
  });

  it('is recomputed from the gap rather than banked, so it never runs out', () => {
    // The grace is not a consumable and has no counter. A player who trains one
    // day in every GRACE + 1 holds a run open forever, spending nothing. This is
    // the accepted cost of the §4.4 ruling, pinned so it is on the record rather
    // than discovered in playtesting.
    const CYCLES = 40;
    let state: StreakState = { ...createStreakState(), recoveryDayBalance: 0 };
    let day = DAY_ZERO;
    let trainedDays = 0;

    for (let cycle = 0; cycle < CYCLES; cycle += 1) {
      const opening = openDay(state, day);
      expect(opening.kind).not.toBe('streak-broken');
      expect(opening.kind).not.toBe('recovery-day-offered');
      state = unwrap(recordTrainingDay(state, day)).state;
      trainedDays += 1;
      day = addDays(day, SHORTEST_PAID_GAP);
    }

    expect(state.currentStreak).toBe(trainedDays);
    expect(state.recoveryDayBalance).toBe(
      STREAK_MILESTONE_DAYS.filter((m) => m <= trainedDays).length *
        RECOVERY_DAY_ECONOMY.STREAK_MILESTONE_GRANT,
    );
    expect(state.consecutiveRecoveryDaysUsed).toBe(0);
  });

  it('extends the run without extending the count — a covered day is not a trained day', () => {
    // Same rule the paid path obeys (§2 of the module header), checked on the
    // free path: grace keeps the run alive and adds nothing to the streak, so it
    // cannot shortcut a milestone either.
    let state: StreakState = { ...createStreakState(), recoveryDayBalance: 0 };
    let day = DAY_ZERO;
    let sessions = 0;
    let milestoneAtSessions = -1;
    while (milestoneAtSessions < 0 && sessions < 40) {
      const outcome = unwrap(recordTrainingDay(state, day));
      state = outcome.state;
      sessions += 1;
      if (outcome.milestonesReached.includes(7)) milestoneAtSessions = sessions;
      // A grace-length gap every time, so seven calendar days would arrive far
      // sooner than seven sessions if covered days counted.
      day = addDays(day, GRACE + 1);
    }
    expect(milestoneAtSessions).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// Recovery Days — offer, accept, decline
// ---------------------------------------------------------------------------

describe('the Recovery Day offer', () => {
  it('appears for the shortest chargeable gap and describes the whole decision', () => {
    const state = stateWithRun(9, DAY_ZERO, 3);
    const day = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    const offer = currentRecoveryDayOffer(state, day);
    expect(offer).toEqual({
      offeredOnDay: day,
      missedDays: Array.from({ length: SHORTEST_PAID_GAP }, (_, i) => addDays(DAY_ZERO, i + 1)),
      daysCoveredFreeByGrace: GRACE,
      cost: 1,
      balanceBefore: 3,
      balanceAfter: 2,
      streakProtected: 9,
      consecutiveRecoveryDaysUsedAfter: 1,
      isFirstBreakTutorial: true,
    });
  });

  it('is surfaced by openDay rather than applied', () => {
    const state = stateWithRun(9, DAY_ZERO, 3);
    const before = clone(state);
    const opening = openDay(state, dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP));
    expect(opening.kind).toBe('recovery-day-offered');
    // openDay is a read model: the state it was handed is untouched.
    expect(state).toEqual(before);
    expect(state.recoveryDayBalance).toBe(3);
    expect(state.currentStreak).toBe(9);
  });

  it('keeps the run alive when accepted, and spends exactly the offered cost', () => {
    const state = stateWithRun(9, DAY_ZERO, 3);
    const day = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    const offer = currentRecoveryDayOffer(state, day);
    expect(offer).not.toBeNull();
    const outcome = unwrap(acceptRecoveryDayOffer(state, offer as NonNullable<typeof offer>));
    expect(outcome.recoveryDaysSpent).toBe(1);
    expect(outcome.daysCoveredFreeByGrace).toBe(GRACE);
    expect(outcome.balanceAfter).toBe(2);
    expect(outcome.state.recoveryDayBalance).toBe(2);
    expect(outcome.state.currentStreak).toBe(9);
    expect(outcome.state.recoveredThroughDay).toBe(addDays(DAY_ZERO, SHORTEST_PAID_GAP));
    expect(outcome.coveredDays).toHaveLength(SHORTEST_PAID_GAP);
    // ...and the run continues from today.
    expect(openDay(outcome.state, day)).toEqual({
      kind: 'streak-alive',
      currentStreak: 9,
      streakIfTrainedToday: 10,
      lastDayStreakCanBeSaved: addDays(day, coverableGapDays(outcome.state)),
    });
    expect(unwrap(recordTrainingDay(outcome.state, day)).streakAfter).toBe(10);
  });

  it('covers a longer gap in one offer, charging only the days past the grace', () => {
    const state = stateWithRun(9, DAY_ZERO, 5);
    const gap = GRACE + 2;
    const offer = currentRecoveryDayOffer(state, dayAfterGap(DAY_ZERO, gap)) as NonNullable<
      ReturnType<typeof currentRecoveryDayOffer>
    >;
    expect(offer.cost).toBe(2);
    expect(offer.daysCoveredFreeByGrace).toBe(GRACE);
    expect(offer.missedDays).toEqual(Array.from({ length: gap }, (_, i) => addDays(DAY_ZERO, i + 1)));
    // The offer still keeps the run alive across the WHOLE gap. Charging for
    // part of it is not the same thing as covering part of it.
    expect(offer.missedDays).toHaveLength(offer.cost + offer.daysCoveredFreeByGrace);
  });

  it('never offers partial coverage of a gap it cannot close', () => {
    // Balance 1, chargeable 2: paying for one chargeable day would take a
    // Recovery Day and still leave the run broken, so there is no offer at all.
    const state = stateWithRun(9, DAY_ZERO, 1);
    const gap = GRACE + 2;
    expect(currentRecoveryDayOffer(state, dayAfterGap(DAY_ZERO, gap))).toBeNull();
    expect(openDay(state, dayAfterGap(DAY_ZERO, gap))).toEqual({
      kind: 'streak-broken',
      brokenRunLength: 9,
      daysMissed: gap,
      reason: 'not-enough-recovery-days',
    });
  });

  it('refuses to record a session while an offer is outstanding', () => {
    // GDD §4.2 "manual use, not auto-apply": the decision cannot be skipped.
    const state = stateWithRun(9, DAY_ZERO, 3);
    expect(errorCodeOf(recordTrainingDay(state, dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP)))).toBe(
      'RECOVERY_DECISION_PENDING',
    );
  });

  it('rejects a stale or fabricated offer instead of trusting it', () => {
    const state = stateWithRun(9, DAY_ZERO, 3);
    const day = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    const real = currentRecoveryDayOffer(state, day) as NonNullable<
      ReturnType<typeof currentRecoveryDayOffer>
    >;

    const cheaper = { ...real, cost: 0, balanceAfter: 3 };
    expect(errorCodeOf(acceptRecoveryDayOffer(state, cheaper))).toBe('OFFER_DOES_NOT_MATCH_STATE');

    // Claiming the grace covered more of the gap than it did is the §4.4 version
    // of claiming a lower price, so it has to be rejected the same way.
    const inflatedGrace = { ...real, daysCoveredFreeByGrace: GRACE + 1 };
    expect(errorCodeOf(acceptRecoveryDayOffer(state, inflatedGrace))).toBe('OFFER_DOES_NOT_MATCH_STATE');

    const widerCoverage = { ...real, missedDays: [...real.missedDays, addDays(DAY_ZERO, 50)] };
    expect(errorCodeOf(acceptRecoveryDayOffer(state, widerCoverage))).toBe('OFFER_DOES_NOT_MATCH_STATE');

    const inflatedStreak = { ...real, streakProtected: 99 };
    expect(errorCodeOf(acceptRecoveryDayOffer(state, inflatedStreak))).toBe('OFFER_DOES_NOT_MATCH_STATE');

    const alreadySpent = unwrap(acceptRecoveryDayOffer(state, real)).state;
    expect(errorCodeOf(acceptRecoveryDayOffer(alreadySpent, real))).toBe('NO_RECOVERY_DAY_OFFER');
  });

  it('has nothing to accept when the gap is intact or merely grace-covered', () => {
    const state = stateWithRun(9, DAY_ZERO, 3);
    const offer = currentRecoveryDayOffer(state, dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP)) as NonNullable<
      ReturnType<typeof currentRecoveryDayOffer>
    >;
    const intact = { ...offer, offeredOnDay: addDays(DAY_ZERO, 1) };
    expect(errorCodeOf(acceptRecoveryDayOffer(state, intact))).toBe('NO_RECOVERY_DAY_OFFER');
    expect(errorCodeOf(declineRecoveryDayOffer(state, intact))).toBe('NO_RECOVERY_DAY_OFFER');

    // A grace-covered gap cannot be talked into a spend by handing in an offer.
    const graceDay = dayAfterGap(DAY_ZERO, GRACE);
    const fabricated = { ...offer, offeredOnDay: graceDay };
    expect(errorCodeOf(acceptRecoveryDayOffer(state, fabricated))).toBe('NO_RECOVERY_DAY_OFFER');
    expect(errorCodeOf(declineRecoveryDayOffer(state, fabricated))).toBe('NO_RECOVERY_DAY_OFFER');
  });
});

// ---------------------------------------------------------------------------
// The long-gap path preserves the streak exactly
// ---------------------------------------------------------------------------

describe('spending a Recovery Day on a long gap preserves the streak exactly', () => {
  /**
   * THE REQUIREMENT THIS BLOCK EXISTS FOR. Adding the free-grace branch put a
   * second way through `openDay` and `recordTrainingDay`, and the risk it
   * introduces is that the PAID branch quietly starts doing something different
   * to the streak — resetting it, halving it, restarting it at 1 — while the
   * free branch keeps every assertion elsewhere green.
   *
   * So every test here asserts two things at once:
   *   (a) the streak is preserved EXACTLY, with `toBe`, not `toBeGreaterThan`;
   *   (b) the path taken was the paid one — at least one Recovery Day left the
   *       balance. Without (b) these would pass on a state that never spent
   *       anything, which is precisely the blind test this is guarding against.
   */
  function assertPaidPath(before: StreakState, outcome: {
    readonly state: StreakState;
    readonly recoveryDaysSpent: number;
    readonly balanceAfter: number;
  }): void {
    expect(outcome.recoveryDaysSpent).toBeGreaterThanOrEqual(1);
    expect(outcome.balanceAfter).toBe(before.recoveryDayBalance - outcome.recoveryDaysSpent);
    expect(outcome.balanceAfter).toBeLessThan(before.recoveryDayBalance);
  }

  it('leaves currentStreak and longestStreak untouched, at every chargeable gap length', () => {
    for (let chargeable = 1; chargeable <= RECOVERY_DAY_GUARDRAILS.MAX_CONSECUTIVE_USES; chargeable += 1) {
      for (const streak of [1, 2, 6, 7, 29, 30, 99, 365]) {
        const before = stateWithRun(streak, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
        const day = dayAfterGap(DAY_ZERO, GRACE + chargeable);
        const offer = currentRecoveryDayOffer(before, day) as NonNullable<
          ReturnType<typeof currentRecoveryDayOffer>
        >;
        expect(offer).not.toBeNull();
        const outcome = unwrap(acceptRecoveryDayOffer(before, offer));

        assertPaidPath(before, outcome);
        expect(outcome.recoveryDaysSpent).toBe(chargeable);

        // Exactly preserved. Not "at least" — a partial reset that left the
        // streak higher than zero would slip past a >= assertion.
        expect(outcome.state.currentStreak).toBe(streak);
        expect(outcome.state.longestStreak).toBe(before.longestStreak);
        expect(outcome.streakProtected).toBe(streak);
        expect(outcome.state.lastTrainedDay).toBe(before.lastTrainedDay);
        // ...and the run genuinely continues: the next session is streak + 1.
        expect(unwrap(recordTrainingDay(outcome.state, day)).streakAfter).toBe(streak + 1);
      }
    }
  });

  it('changes only the four fields a spend is allowed to change', () => {
    // A field-by-field diff rather than a list of assertions about the ones
    // someone remembered. Anything else moving — the streak above all — fails
    // here even if no other test happens to look at it.
    const before = stateWithRun(42, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    const day = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    const offer = currentRecoveryDayOffer(before, day) as NonNullable<
      ReturnType<typeof currentRecoveryDayOffer>
    >;
    const outcome = unwrap(acceptRecoveryDayOffer(before, offer));
    assertPaidPath(before, outcome);

    const changed = STREAK_FACT_KEYS.filter((key) => outcome.state[key] !== before[key]);
    expect([...changed].sort()).toEqual(
      ['consecutiveRecoveryDaysUsed', 'hasResolvedFirstBreakOffer', 'recoveredThroughDay', 'recoveryDayBalance'].sort(),
    );
  });

  it('is a DIFFERENT path from the free grace, and the free path is the one that spends nothing', () => {
    // The distinguishing test. If the two branches were accidentally the same
    // code — or if the paid branch were unreachable because the grace swallowed
    // every gap — the block above would still be green and would mean nothing.
    const state = stateWithRun(11, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);

    const graceDay = dayAfterGap(DAY_ZERO, GRACE);
    expect(openDay(state, graceDay).kind).toBe('gap-covered-by-grace');
    expect(currentRecoveryDayOffer(state, graceDay)).toBeNull();
    const throughGrace = unwrap(recordTrainingDay(state, graceDay));
    expect(throughGrace.state.recoveryDayBalance).toBe(state.recoveryDayBalance);
    expect(throughGrace.streakAfter).toBe(12);

    const paidDay = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    expect(openDay(state, paidDay).kind).toBe('recovery-day-offered');
    const offer = currentRecoveryDayOffer(state, paidDay) as NonNullable<
      ReturnType<typeof currentRecoveryDayOffer>
    >;
    const throughSpend = unwrap(acceptRecoveryDayOffer(state, offer));
    assertPaidPath(state, throughSpend);

    // Both preserved the run. Only one of them cost anything — that is what
    // makes this a real distinction and not two names for the same branch.
    expect(throughSpend.state.currentStreak).toBe(11);
    expect(throughSpend.state.recoveryDayBalance).toBeLessThan(state.recoveryDayBalance);
    expect(throughGrace.state.recoveryDayBalance).toBe(state.recoveryDayBalance);
    expect(unwrap(recordTrainingDay(throughSpend.state, paidDay)).streakAfter).toBe(12);
  });

  it('holds across a long history in which every gap is paid for', () => {
    // The property under repetition rather than at one point: every accept in
    // this history is on a chargeable gap, and after each one the streak is
    // exactly what it was before the accept.
    let state: StreakState = stateWithRun(5, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    let day = DAY_ZERO;
    let spends = 0;
    for (let cycle = 0; cycle < 12; cycle += 1) {
      day = dayAfterGap(day, SHORTEST_PAID_GAP);
      const opening = openDay(state, day);
      if (opening.kind === 'recovery-day-offered') {
        const streakBefore = state.currentStreak;
        const longestBefore = state.longestStreak;
        const outcome = unwrap(acceptRecoveryDayOffer(state, opening.offer));
        assertPaidPath(state, outcome);
        expect(outcome.state.currentStreak).toBe(streakBefore);
        expect(outcome.state.longestStreak).toBe(longestBefore);
        spends += 1;
        state = outcome.state;
      } else if (opening.kind === 'streak-broken') {
        state = unwrap(settleBrokenStreak(state, day)).state;
      }
      state = unwrap(recordTrainingDay(state, day)).state;
    }
    expect(spends).toBeGreaterThanOrEqual(3);
  });
});

describe('declining a Recovery Day offer', () => {
  it('really breaks the streak, and really leaves the balance alone', () => {
    const state = stateWithRun(23, DAY_ZERO, 4);
    const day = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    const offer = currentRecoveryDayOffer(state, day) as NonNullable<
      ReturnType<typeof currentRecoveryDayOffer>
    >;
    const outcome = unwrap(declineRecoveryDayOffer(state, offer));

    expect(outcome.endedRunLength).toBe(23);
    expect(outcome.state.currentStreak).toBe(0);
    expect(outcome.state.lastTrainedDay).toBeNull();
    expect(outcome.state.recoveredThroughDay).toBeNull();
    expect(outcome.state.longestStreak).toBe(23);
    expect(outcome.balanceAfter).toBe(4);
    expect(outcome.state.recoveryDayBalance).toBe(4);
    expect(openDay(outcome.state, day)).toEqual({ kind: 'no-active-streak', longestStreak: 23 });
  });

  it('does not re-offer the same break after a decline', () => {
    const state = stateWithRun(23, DAY_ZERO, 4);
    const day = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    const offer = currentRecoveryDayOffer(state, day) as NonNullable<
      ReturnType<typeof currentRecoveryDayOffer>
    >;
    const declined = unwrap(declineRecoveryDayOffer(state, offer)).state;
    expect(currentRecoveryDayOffer(declined, day)).toBeNull();
    expect(currentRecoveryDayOffer(declined, addDays(day, 1))).toBeNull();
  });

  it('lets a new run start immediately', () => {
    const state = stateWithRun(23, DAY_ZERO, 4);
    const day = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    const offer = currentRecoveryDayOffer(state, day) as NonNullable<
      ReturnType<typeof currentRecoveryDayOffer>
    >;
    const declined = unwrap(declineRecoveryDayOffer(state, offer)).state;
    const outcome = unwrap(recordTrainingDay(declined, day));
    expect(outcome.streakAfter).toBe(1);
    expect(outcome.state.recoveryDayBalance).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Guardrail: the hold cap
// ---------------------------------------------------------------------------

describe('the hold cap', () => {
  it('clips a grant and reports what was lost', () => {
    const state = { ...createStreakState(), recoveryDayBalance: RECOVERY_DAY_GUARDRAILS.HOLD_CAP - 1 };
    const outcome = unwrap(grantRecoveryDays(state, { source: 'purchase-chalk', amount: 4 }));
    expect(outcome.credited).toBe(1);
    expect(outcome.wastedToHoldCap).toBe(3);
    expect(outcome.balanceAfter).toBe(RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    expect(outcome.state.recoveryDayBalance).toBe(RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
  });

  it('never exceeds the cap, whatever is granted', () => {
    let state: StreakState = createStreakState();
    for (let i = 0; i < 25; i += 1) {
      state = unwrap(grantRecoveryDays(state, { source: 'achievement' })).state;
      expect(state.recoveryDayBalance).toBeLessThanOrEqual(RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    }
    expect(state.recoveryDayBalance).toBe(RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    expect(recoveryDayCapacity(state)).toBe(0);
  });

  it('clips a milestone reward too, and says so', () => {
    const state = {
      ...trainConsecutively(createStreakState(), DAY_ZERO, 6),
      recoveryDayBalance: RECOVERY_DAY_GUARDRAILS.HOLD_CAP,
    };
    const outcome = unwrap(recordTrainingDay(state, addDays(DAY_ZERO, 6)));
    expect(outcome.milestonesReached).toEqual([7]);
    expect(outcome.recoveryDaysGranted).toBe(0);
    expect(outcome.recoveryDaysWastedToHoldCap).toBe(RECOVERY_DAY_ECONOMY.STREAK_MILESTONE_GRANT);
    expect(outcome.state.recoveryDayBalance).toBe(RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
  });

  it('rejects a nonsense grant amount', () => {
    const state = createStreakState();
    expect(errorCodeOf(grantRecoveryDays(state, { source: 'purchase-chalk', amount: 0 }))).toBe(
      'INVALID_GRANT',
    );
    expect(errorCodeOf(grantRecoveryDays(state, { source: 'purchase-chalk', amount: -3 }))).toBe(
      'INVALID_GRANT',
    );
    expect(errorCodeOf(grantRecoveryDays(state, { source: 'purchase-chalk', amount: 1.5 }))).toBe(
      'INVALID_GRANT',
    );
  });

  it('caps how far back a run can be rescued, whatever the balance', () => {
    const state = stateWithRun(50, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    expect(payableGapDays(state)).toBe(RECOVERY_DAY_GUARDRAILS.MAX_CONSECUTIVE_USES);
    expect(coverableGapDays(state)).toBe(GRACE + RECOVERY_DAY_GUARDRAILS.MAX_CONSECUTIVE_USES);
    expect(lastDayStreakCanBeSaved(state)).toBe(
      addDays(DAY_ZERO, 1 + GRACE + RECOVERY_DAY_GUARDRAILS.MAX_CONSECUTIVE_USES),
    );
  });
});

// ---------------------------------------------------------------------------
// Guardrail: consecutive uses
// ---------------------------------------------------------------------------

describe('the consecutive-use limit', () => {
  const LIMIT = RECOVERY_DAY_GUARDRAILS.MAX_CONSECUTIVE_USES;

  it('bounds the CHARGEABLE days of a gap, not the whole gap', () => {
    // The distinction §4.4 introduced, in one assertion: the longest gap this
    // limit permits is GRACE longer than the limit itself, because the grace
    // days it covers were never charged to it.
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    const offer = currentRecoveryDayOffer(state, dayAfterGap(DAY_ZERO, GRACE + LIMIT));
    expect(offer?.cost).toBe(LIMIT);
    expect(offer?.missedDays).toHaveLength(GRACE + LIMIT);
    expect(offer?.consecutiveRecoveryDaysUsedAfter).toBe(LIMIT);
  });

  it('refuses a gap one day past the limit, even at full balance', () => {
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    const tooLong = dayAfterGap(DAY_ZERO, GRACE + LIMIT + 1);
    expect(currentRecoveryDayOffer(state, tooLong)).toBeNull();
    expect(openDay(state, tooLong)).toEqual({
      kind: 'streak-broken',
      brokenRunLength: 9,
      daysMissed: GRACE + LIMIT + 1,
      reason: 'gap-longer-than-consecutive-limit',
    });
  });

  it('counts uses across separate offers with no training in between', () => {
    // Accepting moves `recoveredThroughDay` to the end of the gap, which starts
    // a fresh grace window. So the next Recovery Day is not chargeable until
    // another SHORTEST_PAID_GAP days have gone by with no session.
    let state: StreakState = stateWithRun(9, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    for (let used = 1; used <= LIMIT; used += 1) {
      const day = dayAfterGap(lastCoveredDay(state) as StreakDay, SHORTEST_PAID_GAP);
      const offer = currentRecoveryDayOffer(state, day);
      expect(offer?.cost).toBe(1);
      state = unwrap(acceptRecoveryDayOffer(state, offer as NonNullable<typeof offer>)).state;
      expect(state.consecutiveRecoveryDaysUsed).toBe(used);
    }
    // One more chargeable gap with no session in between: the run ends, and it
    // ends with Recovery Days still in the bank.
    const pastLimit = dayAfterGap(lastCoveredDay(state) as StreakDay, SHORTEST_PAID_GAP);
    expect(currentRecoveryDayOffer(state, pastLimit)).toBeNull();
    expect(state.recoveryDayBalance).toBeGreaterThan(0);
    expect(openDay(state, pastLimit)).toEqual({
      kind: 'streak-broken',
      brokenRunLength: 9,
      daysMissed: SHORTEST_PAID_GAP,
      reason: 'consecutive-use-limit-reached',
    });
  });

  it('does NOT stop an alternating pattern of one trained day per chargeable gap', () => {
    // The module header claims this out loud rather than implying a guard it
    // does not have. Here it is, demonstrated: because every trained day resets
    // the consecutive count, a player who trains one day after each shortest
    // chargeable gap spends one Recovery Day per gap until the bank is empty,
    // and only then breaks.
    const STARTING_BALANCE = 3;
    const CYCLE = SHORTEST_PAID_GAP + 1;
    let state: StreakState = stateWithRun(1, DAY_ZERO, STARTING_BALANCE);
    let spent = 0;
    let brokeOnDay: StreakDay | null = null;

    for (let i = 1; i <= CYCLE * (STARTING_BALANCE + 2) && brokeOnDay === null; i += 1) {
      const day = addDays(DAY_ZERO, i);
      const opening = openDay(state, day);
      if (opening.kind === 'streak-broken') {
        brokeOnDay = day;
        break;
      }
      if (opening.kind === 'recovery-day-offered') {
        const outcome = unwrap(acceptRecoveryDayOffer(state, opening.offer));
        spent += outcome.recoveryDaysSpent;
        state = outcome.state;
      }
      if (i % CYCLE === 0) state = unwrap(recordTrainingDay(state, day)).state;
    }

    expect(spent).toBe(STARTING_BALANCE);
    expect(state.recoveryDayBalance).toBe(0);
    expect(state.currentStreak).toBe(1 + STARTING_BALANCE);
    // Last session was on day CYCLE * STARTING_BALANCE; the run then survives
    // the grace and dies on the first chargeable day after it, with nothing
    // left to pay.
    expect(state.lastTrainedDay).toBe(addDays(DAY_ZERO, CYCLE * STARTING_BALANCE));
    expect(brokeOnDay).toBe(dayAfterGap(state.lastTrainedDay as StreakDay, SHORTEST_PAID_GAP));
  });

  it('resets the count on any training day', () => {
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    const day = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    const offer = currentRecoveryDayOffer(state, day) as NonNullable<
      ReturnType<typeof currentRecoveryDayOffer>
    >;
    const saved = unwrap(acceptRecoveryDayOffer(state, offer)).state;
    expect(saved.consecutiveRecoveryDaysUsed).toBe(1);
    const trained = unwrap(recordTrainingDay(saved, day)).state;
    expect(trained.consecutiveRecoveryDaysUsed).toBe(0);
    expect(trained.recoveredThroughDay).toBeNull();
    expect(payableGapDays(trained)).toBe(Math.min(trained.recoveryDayBalance, LIMIT));
  });
});

// ---------------------------------------------------------------------------
// A long absence
// ---------------------------------------------------------------------------

describe('a long absence', () => {
  const AWAY_DAYS = 7;

  /**
   * The longest absence a player can hold a run across by opening the app on
   * every day of it and paying each time it asks.
   *
   * Each accept spends one Recovery Day AND consumes the free grace with it,
   * because `recoveredThroughDay` jumps to the end of the covered gap and the
   * next grace window starts from there. So each spend buys `GRACE + 1` days,
   * `MAX_CONSECUTIVE_USES` spends are allowed with no session in between, and a
   * final unspent grace window is free on top.
   */
  const WALKED_BACK_LIMIT = SHORTEST_PAID_GAP * RECOVERY_DAY_GUARDRAILS.MAX_CONSECUTIVE_USES + GRACE;

  it('cannot be repaired on the day the player comes back, even holding a full bank', () => {
    const state = stateWithRun(50, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    const backOn = addDays(DAY_ZERO, AWAY_DAYS + 1);
    expect(daysMissedBefore(state, backOn)).toBe(AWAY_DAYS);
    expect(AWAY_DAYS).toBeGreaterThan(coverableGapDays(state));
    expect(currentRecoveryDayOffer(state, backOn)).toBeNull();
    expect(openDay(state, backOn)).toEqual({
      kind: 'streak-broken',
      brokenRunLength: 50,
      daysMissed: AWAY_DAYS,
      reason: 'gap-longer-than-consecutive-limit',
    });
  });

  it('leaves the bank untouched rather than quietly draining it', () => {
    const state = stateWithRun(50, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    const outcome = unwrap(recordTrainingDay(state, addDays(DAY_ZERO, AWAY_DAYS + 1)));
    expect(outcome.state.recoveryDayBalance).toBe(RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    expect(outcome.state.currentStreak).toBe(1);
    expect(outcome.state.longestStreak).toBe(50);
  });

  it('CAN be held together by opening the app through it and paying each time — and that bound is exact', () => {
    // STATED RATHER THAN HIDDEN, because it is a real consequence of GDD §4.4
    // and it weakens what §4.2's "prevents saving a 50-day streak after a week
    // away" used to mean. Before §4.4 the walk-back bought nothing over opening
    // once (both stopped at MAX_CONSECUTIVE_USES days). Now each spend also
    // re-arms the grace, so a player who keeps checking in during their absence
    // and keeps paying holds the run for WALKED_BACK_LIMIT days — longer than
    // the `coverableGapDays` a single return can repair.
    //
    // It is not free and it is not automatic: every one of those days costs a
    // Recovery Day the player chose to spend at a prompt.
    const walkThrough = (away: number, balance: number): boolean => {
      let state: StreakState = stateWithRun(50, DAY_ZERO, balance);
      for (let offset = 1; offset <= away + 1; offset += 1) {
        const opening = openDay(state, addDays(DAY_ZERO, offset));
        if (opening.kind === 'streak-broken') return false;
        if (opening.kind === 'recovery-day-offered') {
          state = unwrap(acceptRecoveryDayOffer(state, opening.offer)).state;
        }
      }
      return true;
    };

    expect(WALKED_BACK_LIMIT).toBeGreaterThan(coverableGapDays(stateWithRun(50, DAY_ZERO, 5)));
    expect(walkThrough(WALKED_BACK_LIMIT, RECOVERY_DAY_GUARDRAILS.HOLD_CAP)).toBe(true);
    expect(walkThrough(WALKED_BACK_LIMIT + 1, RECOVERY_DAY_GUARDRAILS.HOLD_CAP)).toBe(false);

    // The bound is set by the consecutive-use guardrail, not by the balance:
    // holding more than MAX_CONSECUTIVE_USES buys nothing more.
    expect(walkThrough(WALKED_BACK_LIMIT, RECOVERY_DAY_GUARDRAILS.MAX_CONSECUTIVE_USES)).toBe(true);
    // ...and a player who cannot pay gets the grace and nothing else.
    expect(walkThrough(GRACE, 0)).toBe(true);
    expect(walkThrough(GRACE + 1, 0)).toBe(false);
  });

  it('is still beyond the walk-back once it is long enough', () => {
    let state: StreakState = stateWithRun(50, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    const away = WALKED_BACK_LIMIT + 1;
    let spent = 0;
    let broke = false;
    for (let offset = 1; offset <= away + 1; offset += 1) {
      const opening = openDay(state, addDays(DAY_ZERO, offset));
      if (opening.kind === 'streak-broken') {
        broke = true;
        break;
      }
      if (opening.kind === 'recovery-day-offered') {
        const outcome = unwrap(acceptRecoveryDayOffer(state, opening.offer));
        spent += outcome.recoveryDaysSpent;
        state = outcome.state;
      }
    }
    expect(broke).toBe(true);
    expect(spent).toBe(RECOVERY_DAY_GUARDRAILS.MAX_CONSECUTIVE_USES);
    // The run ends with Recovery Days still in the bank: the guardrail bit, not
    // the balance.
    expect(state.recoveryDayBalance).toBeGreaterThan(0);
    expect(unwrap(recordTrainingDay(state, addDays(DAY_ZERO, away + 1))).state.currentStreak).toBe(1);
  });

  it('does not let a purchase repair it either', () => {
    let state: StreakState = stateWithRun(50, DAY_ZERO, 0);
    for (let i = 0; i < 10; i += 1) {
      state = unwrap(grantRecoveryDays(state, { source: 'purchase-chalk', amount: 5 })).state;
    }
    expect(state.recoveryDayBalance).toBe(RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    expect(currentRecoveryDayOffer(state, addDays(DAY_ZERO, AWAY_DAYS + 1))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// GDD §4.3 — the first-break tutorial
// ---------------------------------------------------------------------------

describe('the first-break tutorial moment', () => {
  function firstOffer(state: StreakState, day: StreakDay) {
    const offer = currentRecoveryDayOffer(state, day);
    expect(offer).not.toBeNull();
    return offer as NonNullable<typeof offer>;
  }

  it('does NOT fire on any miss — only on a gap past the free grace', () => {
    // GDD §4.3, as amended by §4.4. Before the ruling this moment fired the
    // first time a player missed a single day. It now waits for a gap of
    // SHORTEST_PAID_GAP days, because a shorter one costs nothing and there is
    // no save to explain.
    let state: StreakState = stateWithRun(9, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    for (let gap = 1; gap <= GRACE; gap += 1) {
      const day = dayAfterGap(lastCoveredDay(state) as StreakDay, gap);
      expect(openDay(state, day).kind).toBe('gap-covered-by-grace');
      expect(currentRecoveryDayOffer(state, day)).toBeNull();
      state = unwrap(recordTrainingDay(state, day)).state;
      expect(state.hasResolvedFirstBreakOffer).toBe(false);
    }
    const paid = dayAfterGap(lastCoveredDay(state) as StreakDay, SHORTEST_PAID_GAP);
    expect(firstOffer(state, paid).isFirstBreakTutorial).toBe(true);
  });

  it('flags the first offer, and only the first — accepted', () => {
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    const dayOne = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    const first = firstOffer(state, dayOne);
    expect(first.isFirstBreakTutorial).toBe(true);

    const outcome = unwrap(acceptRecoveryDayOffer(state, first));
    expect(outcome.wasFirstBreakTutorial).toBe(true);
    expect(outcome.state.hasResolvedFirstBreakOffer).toBe(true);

    // A later break, after training resets the consecutive count.
    const trained = trainConsecutively(outcome.state, dayOne, 3);
    const second = firstOffer(trained, dayAfterGap(addDays(dayOne, 2), SHORTEST_PAID_GAP));
    expect(second.isFirstBreakTutorial).toBe(false);
    expect(unwrap(acceptRecoveryDayOffer(trained, second)).wasFirstBreakTutorial).toBe(false);
  });

  it('flags the first offer, and only the first — declined', () => {
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    const dayOne = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    const first = firstOffer(state, dayOne);
    const declined = unwrap(declineRecoveryDayOffer(state, first));
    expect(declined.wasFirstBreakTutorial).toBe(true);
    expect(declined.state.hasResolvedFirstBreakOffer).toBe(true);

    const trained = trainConsecutively(declined.state, dayOne, 3);
    expect(
      firstOffer(trained, dayAfterGap(addDays(dayOne, 2), SHORTEST_PAID_GAP)).isFirstBreakTutorial,
    ).toBe(false);
  });

  it('is an offer, not an auto-save: the state is unchanged until it is answered', () => {
    const state = stateWithRun(9, DAY_ZERO, 3);
    const before = clone(state);
    const day = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    for (let i = 0; i < 5; i += 1) {
      const opening = openDay(state, day);
      expect(opening.kind).toBe('recovery-day-offered');
    }
    expect(state).toEqual(before);
    expect(state.hasResolvedFirstBreakOffer).toBe(false);
  });

  it('is not burned by a break that could never have been saved', () => {
    // No Recovery Days held, so no offer, so the tutorial has not happened.
    // It must still fire at the first break the player can actually be saved
    // from, or the moment GDD §4.3 describes is silently skipped.
    const broke = stateWithRun(9, DAY_ZERO, 0);
    const brokeOn = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    expect(currentRecoveryDayOffer(broke, brokeOn)).toBeNull();
    const settled = unwrap(settleBrokenStreak(broke, brokeOn));
    expect(settled.wasFirstBreakTutorial).toBe(false);
    expect(settled.state.hasResolvedFirstBreakOffer).toBe(false);

    const restarted = trainConsecutively(
      { ...settled.state, recoveryDayBalance: 3 },
      addDays(brokeOn, 1),
      4,
    );
    const offer = currentRecoveryDayOffer(
      restarted,
      dayAfterGap(addDays(brokeOn, 4), SHORTEST_PAID_GAP),
    );
    expect(offer?.isFirstBreakTutorial).toBe(true);
  });

  it('fires exactly once across a long simulated history', () => {
    // Counts the offers that were *resolved as* the tutorial, across a history
    // with several breaks. Must be exactly one.
    let state: StreakState = {
      ...createStreakState(),
      recoveryDayBalance: RECOVERY_DAY_GUARDRAILS.HOLD_CAP,
    };
    let tutorials = 0;
    let offersSeen = 0;
    let day = DAY_ZERO;
    const CYCLE = SHORTEST_PAID_GAP + 1;
    for (let i = 0; i < 120; i += 1) {
      const skip = i % CYCLE !== 0;
      const opening = openDay(state, day);
      if (opening.kind === 'recovery-day-offered') {
        offersSeen += 1;
        const outcome = unwrap(acceptRecoveryDayOffer(state, opening.offer));
        if (outcome.wasFirstBreakTutorial) tutorials += 1;
        state = outcome.state;
      } else if (opening.kind === 'streak-broken') {
        state = unwrap(settleBrokenStreak(state, day)).state;
      }
      if (!skip) state = unwrap(recordTrainingDay(state, day)).state;
      day = addDays(day, 1);
    }
    // The history has to contain several offers for "exactly one tutorial" to
    // mean anything; if the grace swallowed them all this would read 0 and the
    // assertion below would pass for the wrong reason.
    expect(offersSeen).toBeGreaterThan(1);
    expect(tutorials).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

describe('streak milestones', () => {
  it('pays out at 7, 30 and 100 trained days, once each', () => {
    let state: StreakState = { ...createStreakState(), recoveryDayBalance: 0 };
    const paidOn: number[] = [];
    for (let i = 0; i < 120; i += 1) {
      const outcome = unwrap(recordTrainingDay(state, addDays(DAY_ZERO, i)));
      if (outcome.milestonesReached.length > 0) paidOn.push(outcome.streakAfter);
      state = outcome.state;
    }
    expect(paidOn).toEqual([...STREAK_MILESTONE_DAYS]);
    expect(state.recoveryDayBalance).toBe(
      STREAK_MILESTONE_DAYS.length * RECOVERY_DAY_ECONOMY.STREAK_MILESTONE_GRANT,
    );
  });

  it('pays each milestone once in a lifetime, so breaking and rebuilding cannot farm them', () => {
    // Re-arming per run would make deliberately breaking a streak the best free
    // income in the game — one Recovery Day per seven sessions, against nothing
    // at all between day 7 and day 30 on an unbroken run. That is "the player
    // who trained more ends up with less", which GDD §12.3 refuses.
    let state: StreakState = { ...createStreakState(), recoveryDayBalance: 0 };
    state = trainConsecutively(state, DAY_ZERO, 7);
    expect(state.recoveryDayBalance).toBe(1);

    state = unwrap(recordTrainingDay(state, addDays(DAY_ZERO, 20))).state;
    state = trainConsecutively(state, addDays(DAY_ZERO, 21), 6);
    expect(state.currentStreak).toBe(7);
    expect(state.recoveryDayBalance).toBe(1);
  });

  it('still pays a milestone the first time a rebuilt run passes the previous best', () => {
    let state: StreakState = { ...createStreakState(), recoveryDayBalance: 0 };
    state = trainConsecutively(state, DAY_ZERO, 7);
    state = unwrap(recordTrainingDay(state, addDays(DAY_ZERO, 20))).state;
    state = trainConsecutively(state, addDays(DAY_ZERO, 21), 29);
    expect(state.currentStreak).toBe(30);
    expect(state.longestStreak).toBe(30);
    expect(state.recoveryDayBalance).toBe(2);
  });

  it('cannot be reached faster by spending Recovery Days', () => {
    // A Recovery Day keeps the run alive but is not a training day, so the
    // seventh milestone still costs seven sessions. This is what stops bought
    // Recovery Days from earning more Recovery Days.
    //
    // The pattern is one trained day per SHORTEST_PAID_GAP idle days, so every
    // gap costs a Recovery Day rather than falling inside the free grace — the
    // test would say nothing about SPENDING otherwise.
    let state: StreakState = {
      ...createStreakState(),
      recoveryDayBalance: RECOVERY_DAY_GUARDRAILS.HOLD_CAP,
    };
    let sessions = 0;
    let milestoneAtSessions = -1;
    let recoveryDaysUsed = 0;
    const TRAIN_BLOCK = 3;
    const CYCLE = TRAIN_BLOCK + SHORTEST_PAID_GAP;

    for (let i = 0; i < CYCLE * 4 && milestoneAtSessions < 0; i += 1) {
      const day = addDays(DAY_ZERO, i);
      const opening = openDay(state, day);
      expect(opening.kind).not.toBe('streak-broken');
      if (opening.kind === 'recovery-day-offered') {
        const outcome = unwrap(acceptRecoveryDayOffer(state, opening.offer));
        recoveryDaysUsed += outcome.recoveryDaysSpent;
        state = outcome.state;
      }
      if (i % CYCLE < TRAIN_BLOCK) {
        const outcome = unwrap(recordTrainingDay(state, day));
        state = outcome.state;
        sessions += 1;
        if (outcome.milestonesReached.includes(7)) milestoneAtSessions = sessions;
      }
    }
    // The calendar reached the seventh milestone days before the seventh
    // session did, and the covered days did not close the difference.
    expect(recoveryDaysUsed).toBeGreaterThan(0);
    expect(milestoneAtSessions).toBe(7);
  });

  it('never counts a Recovery Day as a training day', () => {
    const state = stateWithRun(9, DAY_ZERO, 4);
    const offer = currentRecoveryDayOffer(
      state,
      dayAfterGap(DAY_ZERO, GRACE + 2),
    ) as NonNullable<ReturnType<typeof currentRecoveryDayOffer>>;
    const outcome = unwrap(acceptRecoveryDayOffer(state, offer));
    expect(outcome.recoveryDaysSpent).toBe(2);
    expect(outcome.state.currentStreak).toBe(9);
    expect(outcome.state.longestStreak).toBe(9);
    expect(outcome.streakProtected).toBe(9);
  });
});

// ---------------------------------------------------------------------------
// GDD §8.1 / §12.3 — the pay-to-win boundary
// ---------------------------------------------------------------------------

describe('what a purchased Recovery Day can reach', () => {
  it('persists nothing outside the declared streak-fact allowlist', () => {
    // The compile-time assertion lives in the module
    // (`RECOVERY_DAY_REACH_IS_STREAK_ONLY`). This is the runtime half: the live
    // object's keys are exactly the allowlist, so there is nowhere for a
    // Total / e1RM / pace effect to be stored.
    const states: StreakState[] = [
      createStreakState(),
      stateWithRun(9, DAY_ZERO, 3),
      trainConsecutively(createStreakState(), DAY_ZERO, 8),
    ];
    const offer = currentRecoveryDayOffer(
      states[1] as StreakState,
      dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP),
    );
    states.push(unwrap(acceptRecoveryDayOffer(states[1] as StreakState, offer as NonNullable<typeof offer>)).state);
    states.push(unwrap(grantRecoveryDays(createStreakState(), { source: 'purchase-chalk', amount: 2 })).state);

    for (const state of states) {
      expect(Object.keys(state).sort()).toEqual([...STREAK_FACT_KEYS].sort());
    }
  });

  it('reports nothing outside the declared spend allowlist', () => {
    const state = stateWithRun(9, DAY_ZERO, 3);
    const offer = currentRecoveryDayOffer(
      state,
      dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP),
    ) as NonNullable<ReturnType<typeof currentRecoveryDayOffer>>;
    const outcome = unwrap(acceptRecoveryDayOffer(state, offer));
    expect(Object.keys(outcome).sort()).toEqual([...RECOVERY_DAY_OUTCOME_KEYS].sort());
  });

  it('has no field anywhere whose name suggests it touches Total, e1RM or pace', () => {
    // A blocklist is weaker than the allowlist above; it is here as a second,
    // independent reading of the same question, on both the state and the
    // outcome objects.
    const forbidden = /total|e1rm|1rm|weight|load|pace|multiplier|bonus|boost|iq|fatigue|readiness|attempt/i;
    const state = stateWithRun(9, DAY_ZERO, 3);
    const offer = currentRecoveryDayOffer(
      state,
      dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP),
    ) as NonNullable<ReturnType<typeof currentRecoveryDayOffer>>;
    const outcome = unwrap(acceptRecoveryDayOffer(state, offer));
    for (const key of [...Object.keys(state), ...Object.keys(outcome), ...Object.keys(offer)]) {
      expect(key).not.toMatch(forbidden);
    }
  });

  it('makes a bought Recovery Day literally identical to an earned one', () => {
    // Every source, same amount, same resulting state. Nothing downstream can
    // tell them apart because nothing downstream is told.
    const base = { ...createStreakState(), recoveryDayBalance: 0 };
    const grants: readonly RecoveryDayGrant[] = RECOVERY_DAY_SOURCES.map((source) =>
      source === 'season-pass' || source === 'purchase-chalk' || source === 'purchase-gym-bucks'
        ? { source, amount: 1 }
        : { source },
    );
    const states = grants.map((grant) => {
      const amount = recoveryDayGrantAmount(grant);
      // Normalise the signup grant's larger amount away by topping the others
      // up to the same number, so the comparison is about the SOURCE only.
      let state = unwrap(grantRecoveryDays(base, grant)).state;
      if (amount < RECOVERY_DAY_ECONOMY.SIGNUP_GRANT) {
        for (let i = amount; i < RECOVERY_DAY_ECONOMY.SIGNUP_GRANT; i += 1) {
          state = unwrap(grantRecoveryDays(state, { source: 'purchase-chalk', amount: 1 })).state;
        }
      }
      return state;
    });
    for (const state of states) {
      expect(state).toEqual(states[0]);
    }
  });

  it('spends a purchased Recovery Day to exactly the same effect as an earned one', () => {
    const run = stateWithRun(9, DAY_ZERO, 0);
    const day = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    const bought = unwrap(grantRecoveryDays(run, { source: 'purchase-chalk', amount: 1 })).state;
    const earned = unwrap(grantRecoveryDays(run, { source: 'achievement' })).state;
    expect(bought).toEqual(earned);

    const boughtOffer = currentRecoveryDayOffer(bought, day);
    const earnedOffer = currentRecoveryDayOffer(earned, day);
    expect(boughtOffer).not.toBeNull();
    expect(boughtOffer).toEqual(earnedOffer);
    expect(unwrap(acceptRecoveryDayOffer(bought, boughtOffer as NonNullable<typeof boughtOffer>))).toEqual(
      unwrap(acceptRecoveryDayOffer(earned, earnedOffer as NonNullable<typeof earnedOffer>)),
    );
  });

  it('does not record where a Recovery Day came from', () => {
    const state = unwrap(grantRecoveryDays(createStreakState(), { source: 'purchase-gym-bucks', amount: 1 }))
      .state;
    expect(JSON.stringify(state)).not.toContain('purchase');
    expect(JSON.stringify(state)).not.toContain('chalk');
    expect(JSON.stringify(state)).not.toContain('source');
  });

  it('cannot buy a longer streak, only a surviving one', () => {
    // Buying the maximum and spending it all still leaves the streak count at
    // exactly the number of days actually trained.
    //
    // The idle blocks are SHORTEST_PAID_GAP long so the purchased Recovery Days
    // are actually spent; with shorter ones the free grace would carry the run
    // and the test would prove nothing about buying.
    let state: StreakState = { ...createStreakState(), recoveryDayBalance: 0 };
    state = unwrap(grantRecoveryDays(state, { source: 'purchase-chalk', amount: 99 })).state;
    let trainedDays = 0;
    let spent = 0;
    let day = DAY_ZERO;
    const TRAIN_BLOCK = 2;
    const CYCLE = TRAIN_BLOCK + SHORTEST_PAID_GAP;
    for (let i = 0; i < CYCLE * 8; i += 1) {
      const opening = openDay(state, day);
      if (opening.kind === 'recovery-day-offered') {
        const outcome = unwrap(acceptRecoveryDayOffer(state, opening.offer));
        spent += outcome.recoveryDaysSpent;
        state = outcome.state;
      } else if (opening.kind === 'streak-broken') {
        state = unwrap(settleBrokenStreak(state, day)).state;
      }
      if (i % CYCLE < TRAIN_BLOCK) {
        state = unwrap(recordTrainingDay(state, day)).state;
        trainedDays += 1;
      }
      day = addDays(day, 1);
      expect(state.currentStreak).toBeLessThanOrEqual(trainedDays);
    }
    expect(spent).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// "Never punish daily engagement"
// ---------------------------------------------------------------------------

/** Which way the simulated player answers every offer. */
type OfferPolicy = 'accept' | 'decline';

interface SimResult {
  readonly state: StreakState;
  readonly recoveryDaysSpent: number;
}

/**
 * WHEN THE STREAK GETS LOOKED AT. This is not a cosmetic detail of the harness:
 * `currentStreak` is only correct as of the last day someone opened the day on
 * it, because a run that has already died stays on the state until `openDay`
 * plus `settleBrokenStreak` records the fact. Comparing two states settled to
 * different days compares a live number against a stale one.
 *
 *   - `'daily'` — something opens every day, which is what a server-side
 *     nightly job does. The state is always settled to the current day.
 *   - `'on-training-days'` — the state is only ever looked at when the player
 *     turns up to train, which is what a pure client with no job behind it
 *     does. Between sessions the streak on the state is arbitrarily stale.
 */
type AppOpeningModel = 'daily' | 'on-training-days';

/**
 * Replays a history of consecutive days. `attend[i]` is whether the player
 * trained on day i; `grantOn[i]` whether a one-Recovery-Day grant lands that
 * morning. Breaks with no possible save are settled, exactly as an app would.
 *
 * `opens` defaults to `'daily'`. `settleAtEnd` opens the final day one last
 * time so the returned state is settled rather than stale — see
 * `AppOpeningModel`, and the staleness test that shows what it is worth.
 */
function simulate(
  attend: readonly boolean[],
  grantOn: readonly boolean[],
  policy: OfferPolicy,
  initial: StreakState,
  opens: AppOpeningModel = 'daily',
  settleAtEnd = false,
): SimResult {
  let state = initial;
  let spent = 0;
  const openAndResolve = (from: StreakState, day: StreakDay): StreakState => {
    const opening = openDay(from, day);
    if (opening.kind === 'recovery-day-offered') {
      if (policy === 'accept') {
        const outcome = unwrap(acceptRecoveryDayOffer(from, opening.offer));
        spent += outcome.recoveryDaysSpent;
        return outcome.state;
      }
      return unwrap(declineRecoveryDayOffer(from, opening.offer)).state;
    }
    if (opening.kind === 'streak-broken') {
      return unwrap(settleBrokenStreak(from, day)).state;
    }
    return from;
  };

  for (let i = 0; i < attend.length; i += 1) {
    const day = addDays(DAY_ZERO, i);
    if (grantOn[i] === true) {
      state = unwrap(grantRecoveryDays(state, { source: 'purchase-chalk', amount: 1 })).state;
    }
    if (opens === 'daily' || attend[i] === true) {
      state = openAndResolve(state, day);
    }
    if (attend[i] === true) {
      const before = state.recoveryDayBalance;
      const outcome = unwrap(recordTrainingDay(state, day));
      // Local invariant, checked on every single recorded session in every
      // simulation below: showing up never costs a Recovery Day.
      //
      // A bare throw rather than `expect`, and the reason is not style: the
      // exhaustive maximisation sweep runs this line a few million times, and
      // `expect` is expensive enough to turn that test from half a second into
      // half a minute. A thrown Error fails just as loudly.
      if (outcome.state.recoveryDayBalance < before) {
        throw new Error(
          `training on day ${i} reduced the Recovery Day balance from ${before} to ${outcome.state.recoveryDayBalance}`,
        );
      }
      if (outcome.streakAfter < 1) {
        throw new Error(`training on day ${i} left a streak of ${outcome.streakAfter}`);
      }
      state = outcome.state;
    }
  }
  if (settleAtEnd && attend.length > 0) {
    state = openAndResolve(state, addDays(DAY_ZERO, attend.length - 1));
  }
  return { state, recoveryDaysSpent: spent };
}

/**
 * Parameters of the search for the accept-policy inversion below, and the
 * figures that search returned. They are not game feel — they describe how hard
 * this file looks for the worst case, and what it found at the tunables
 * `streak.ts` currently ships.
 *
 * EVERY NUMBER IN `WORST_DELTA_BY_LENGTH` MOVES IF `RECOVERY_DAY_GUARDRAILS` OR
 * `STREAK_MILESTONE_DAYS` MOVE, and that is deliberate. Retuning the guardrails
 * changes how badly an accepting player can be punished for training more, so
 * it should break this test and force someone to re-read the new number rather
 * than change it quietly.
 */
const INVERSION_SEARCH = {
  /** Recovery Days both simulated players start on. */
  STARTING_BALANCE: 2,

  /**
   * History lengths the exhaustive maximisation sweeps. All 2^L of each.
   *
   * MOVED UP BY TWO SINCE GDD §4.4. The free grace means the shortest gap that
   * costs anything is `FREE_GRACE_GAP_DAYS + 1` days, so an inversion needs a
   * longer calendar to fit into: at the old range's low end there is now
   * nothing to find, and stopping there would read as "fixed" when it is not.
   */
  EXHAUSTIVE_LENGTHS: [10, 11, 12, 13, 14, 15, 16],

  /**
   * Largest `currentStreak` deficit one extra training day can cause, over
   * every history of each length above, counting only pairs where both players
   * spent the SAME number of Recovery Days. Found by search, not derived.
   *
   * The leading zeros are the §4.4 improvement, and the tail is the part that
   * did not go away.
   */
  WORST_DELTA_BY_LENGTH: [0, 0, 1, 2, 3, 4, 5],

  /**
   * Run lengths the constructive family below is instantiated at. None of them
   * is a milestone or one day short of one — `inversionHistories` refuses those
   * and says why.
   */
  FAMILY_RUN_LENGTHS: [8, 19, 31, 50, 101, 365, 1000],

  /**
   * Recovery Days each player in the constructive family spends. Both spend
   * exactly this many, whatever the run length, which is what stops the deficit
   * being explained away as "the diligent player used more of the bank".
   */
  FAMILY_SPEND: 3,
} as const;

const FAMILY_SPEND = INVERSION_SEARCH.FAMILY_SPEND;

/**
 * The measured size of the monotonicity defect, over every 13-day calendar,
 * from a state built by `createStreakState()`.
 *
 * A "violation" is a pair of calendars identical except that one has one extra
 * trained day, where the player who trained MORE ends on a strictly LOWER
 * `currentStreak`, under a player who accepts every offer.
 *
 * BOTH APP-OPENING MODELS ARE MEASURED because the count depends on which one
 * you use, and a measurement that does not say which is not reproducible. Both
 * settle the final day before comparing; see the staleness test for what
 * happens if you do not.
 *
 * THESE COUNTS MOVE IF THE TUNABLES MOVE. That is the point of pinning them.
 */
const MONOTONICITY_MEASUREMENT = {
  /** Calendar length swept exhaustively — all 2^13 of them. */
  CALENDAR_LENGTH: 13,

  /**
   * Violating pairs when something opens the day every day (a nightly job).
   *
   * WAS 1948 BEFORE GDD §4.4. Zero here is a real improvement and NOT a fix:
   * see `LONGER_CALENDAR_LENGTH` below, where the same model violates again as
   * soon as the calendar is long enough to hold two chargeable gaps.
   */
  VIOLATIONS_OPENING_DAILY: 0,

  /**
   * Violating pairs when only the player's own sessions open the day.
   * Was 4250 before GDD §4.4.
   */
  VIOLATIONS_OPENING_ON_TRAINING_DAYS: 36,

  /**
   * Largest `currentStreak` deficit found at this calendar length, across both
   * models. Was 6 before GDD §4.4. Only the on-training-days model reaches it
   * now, so this is no longer "the same pair under both models".
   */
  WORST_DEFICIT: 3,

  /**
   * Violations of the invariant the user asked for — a player who spent
   * Recovery Days against one who trained fewer days and spent NONE. Zero, and
   * not by luck; see the regression-guard test for why it is structural.
   */
  VIOLATIONS_AGAINST_A_ZERO_SPEND_COMPARATOR: 0,

  /**
   * A SECOND LENGTH, MEASURED SO THE ZERO ABOVE CANNOT BE MISREAD.
   *
   * At 13 days the daily model shows no violations, which invites the
   * conclusion that §4.4 closed the defect under a nightly job. It did not. Two
   * more days of calendar are enough to fit two chargeable gaps, and the same
   * mechanism reappears. Pinned here so the improvement and its limit are on
   * the record together.
   */
  LONGER_CALENDAR_LENGTH: 15,
  VIOLATIONS_OPENING_DAILY_AT_LONGER_LENGTH: 2,
  VIOLATIONS_OPENING_ON_TRAINING_DAYS_AT_LONGER_LENGTH: 384,
  WORST_DEFICIT_AT_LONGER_LENGTH: 5,
} as const;

/**
 * Builds the two histories of the inversion family. They are identical except
 * that the diligent player ALSO trains on day 0 — one extra session, nothing
 * else.
 *
 * `runLost` is the streak the lazy player is carrying when the diligent
 * player's run dies (the diligent player's own run is one longer, since it
 * includes day 0). `runRebuilt` is how many days both then train afterwards.
 *
 * THE SHAPE. The diligent player trains day 0 and is offered a Recovery Day for
 * the gap that follows — an offer the lazy player, holding no live run, is
 * never shown. Accepting it is the only decision the two players make
 * differently, and from there the histories are identical, so every later offer
 * goes to both: the diligent player is simply one Recovery Day poorer, forever.
 * Chargeable gaps are then placed to draw both banks down — one immediately,
 * and one after each milestone payout that lands inside the run — until the
 * lazy player holds exactly one Recovery Day and the diligent player holds
 * none. The next chargeable gap is covered for the lazy player and fatal for
 * the diligent one.
 *
 * EVERY GAP IS EXACTLY `SHORTEST_PAID_GAP` DAYS since GDD §4.4 — the shortest
 * absence that costs anything. Shorter gaps are free now, so a family built out
 * of single missed days (which is what this was before the ruling) produces no
 * spending at all and no deficit. The construction survived the ruling; its gap
 * length did not.
 */
function inversionHistories(
  runLost: number,
  runRebuilt: number,
): { readonly lazy: boolean[]; readonly diligent: boolean[] } {
  if (runLost < 2 || runRebuilt < 1) {
    throw new Error('inversionHistories: runLost must be at least 2 and runRebuilt at least 1');
  }
  if (STREAK_MILESTONE_DAYS.includes(runLost + 1)) {
    throw new Error(
      `inversionHistories: a run of ${runLost} stops one day short of a milestone, so the ` +
        'diligent player collects a payout the lazy player does not and the deficit cancels',
    );
  }
  if (STREAK_MILESTONE_DAYS.includes(runLost)) {
    throw new Error(
      `inversionHistories: a run of exactly ${runLost} ends on a milestone, leaving no room for ` +
        'the trained day that keeps the draw-down gap and the fatal gap from running together',
    );
  }

  const lazy: boolean[] = [];
  /** One chargeable gap: the shortest absence a Recovery Day is charged for. */
  const pushGap = (): void => {
    for (let i = 0; i < SHORTEST_PAID_GAP; i += 1) lazy.push(false);
  };

  lazy.push(false); // day 0 — the one divergent day; the diligent player trains it
  pushGap(); // the gap only the diligent player is offered a save for
  lazy.push(true); // both start (or restart) their run here
  let lazyStreak = 1;
  pushGap(); // first draw-down gap: lazy balance 2 -> 1, diligent 1 -> 0

  for (const milestone of STREAK_MILESTONE_DAYS) {
    if (milestone > runLost) break;
    while (lazyStreak < milestone) {
      lazy.push(true);
      lazyStreak += 1;
    }
    pushGap(); // draw down the milestone payout that just landed for both
    // A trained day between consecutive gaps, so two draw-downs never run
    // together into one longer (and therefore more expensive) absence.
    lazy.push(true);
    lazyStreak += 1;
  }

  while (lazyStreak < runLost) {
    lazy.push(true);
    lazyStreak += 1;
  }
  pushGap(); // the fatal gap: covered for the lazy player, uncoverable for the other
  for (let i = 0; i < runRebuilt; i += 1) lazy.push(true);

  return { lazy, diligent: lazy.map((trained, i) => (i === 0 ? true : trained)) };
}

const trainedDayCount = (history: readonly boolean[]): number => history.filter(Boolean).length;

/** `T` trained, `.` idle — so a failing case names itself in the error. */
const renderCalendar = (history: readonly boolean[]): string =>
  history.map((trained) => (trained ? 'T' : '.')).join('');

describe('daily engagement is never worse than skipping — where that holds, and where it does not', () => {
  it('training today beats skipping today, step by step, from any live state', () => {
    // The local form of the rule: at a single decision point, training
    // dominates not-training on every field that matters.
    for (const streak of [1, 6, 7, 29, 30, 99]) {
      for (let balance = 0; balance <= RECOVERY_DAY_GUARDRAILS.HOLD_CAP; balance += 1) {
        const state = stateWithRun(streak, DAY_ZERO, balance);
        const today = addDays(DAY_ZERO, 1);
        const trained = unwrap(recordTrainingDay(state, today)).state;

        expect(trained.currentStreak).toBe(streak + 1);
        expect(trained.currentStreak).toBeGreaterThan(state.currentStreak);
        expect(trained.longestStreak).toBeGreaterThanOrEqual(state.longestStreak);
        expect(trained.recoveryDayBalance).toBeGreaterThanOrEqual(state.recoveryDayBalance);
        expect(trained.consecutiveRecoveryDaysUsed).toBeLessThanOrEqual(state.consecutiveRecoveryDaysUsed);
        expect(coverableGapDays(trained)).toBeGreaterThanOrEqual(coverableGapDays(state));
      }
    }
  });

  it('showing up 365 days running never breaks, never costs, and never errors', () => {
    let state: StreakState = createStreakState();
    for (let i = 0; i < 365; i += 1) {
      const day = addDays(DAY_ZERO, i);
      expect(openDay(state, day).kind).toBe(i === 0 ? 'no-active-streak' : 'streak-alive');
      const outcome = unwrap(recordTrainingDay(state, day));
      expect(outcome.previousRunEnded).toBe(false);
      state = outcome.state;
    }
    expect(state.currentStreak).toBe(365);
    expect(state.recoveryDayBalance).toBe(
      Math.min(
        RECOVERY_DAY_GUARDRAILS.HOLD_CAP,
        RECOVERY_DAY_ECONOMY.SIGNUP_GRANT + STREAK_MILESTONE_DAYS.length,
      ),
    );
  });

  it('PROPERTY, EXHAUSTIVE, DECLINE-ONLY: over every 10-day history in which no offer is ever accepted, training an extra day never loses ground', () => {
    // The strong form, checked over ALL 2^10 attendance patterns rather than a
    // sample, with the player never spending a Recovery Day. This is the
    // streak mechanic on its own: no spending, so nothing but showing up moves
    // the numbers, and showing up more must never move them down.
    //
    // THE NAME SAYS "DECLINE-ONLY" BECAUSE THAT IS THE WHOLE OF WHAT IS
    // CHECKED. Under the accept policy this property is FALSE, by an unbounded
    // margin — see the KNOWN GAP tests below.
    const LENGTH = 10;
    const initial: StreakState = { ...createStreakState(), recoveryDayBalance: 2 };
    const noGrants = Array.from({ length: LENGTH }, () => false);
    let casesChecked = 0;

    for (let mask = 0; mask < 1 << LENGTH; mask += 1) {
      const attend = Array.from({ length: LENGTH }, (_, i) => (mask & (1 << i)) !== 0);
      for (let flip = 0; flip < LENGTH; flip += 1) {
        if (attend[flip] === true) continue;
        const attendMore = attend.map((trained, i) => (i === flip ? true : trained));
        const lazy = simulate(attend, noGrants, 'decline', initial);
        const diligent = simulate(attendMore, noGrants, 'decline', initial);
        casesChecked += 1;

        expect(diligent.state.currentStreak).toBeGreaterThanOrEqual(lazy.state.currentStreak);
        expect(diligent.state.longestStreak).toBeGreaterThanOrEqual(lazy.state.longestStreak);
        expect(diligent.state.recoveryDayBalance).toBeGreaterThanOrEqual(lazy.state.recoveryDayBalance);
        expect(diligent.recoveryDaysSpent).toBe(0);
        expect(lazy.recoveryDaysSpent).toBe(0);
      }
    }
    expect(casesChecked).toBe(5120);
  });

  it('PROPERTY, DECLINE-ONLY: holds over long randomised histories with grants landing mid-run', () => {
    // Same policy restriction as the sweep above, and for the same reason: this
    // simulates a player who declines every offer. Nothing here says anything
    // about a player who accepts.
    const random = mulberry32(0x5eed_1eaf);
    const initial: StreakState = { ...createStreakState(), recoveryDayBalance: 2 };
    let casesChecked = 0;

    for (let trial = 0; trial < 400; trial += 1) {
      const length = 12 + Math.floor(random() * 30);
      const attendance = Math.max(0.15, random());
      const attend = Array.from({ length }, () => random() < attendance);
      const grantOn = Array.from({ length }, () => random() < 0.12);

      const skipped: number[] = [];
      attend.forEach((trained, i) => {
        if (!trained) skipped.push(i);
      });
      if (skipped.length === 0) continue;
      const flip = skipped[Math.floor(random() * skipped.length)] as number;
      const attendMore = attend.map((trained, i) => (i === flip ? true : trained));

      const lazy = simulate(attend, grantOn, 'decline', initial);
      const diligent = simulate(attendMore, grantOn, 'decline', initial);
      casesChecked += 1;

      expect(diligent.state.currentStreak).toBeGreaterThanOrEqual(lazy.state.currentStreak);
      expect(diligent.state.longestStreak).toBeGreaterThanOrEqual(lazy.state.longestStreak);
      expect(diligent.state.recoveryDayBalance).toBeGreaterThanOrEqual(lazy.state.recoveryDayBalance);
    }
    expect(casesChecked).toBeGreaterThan(350);
  });

  it('THE OLD MINIMAL CASE IS FIXED: single missed days no longer cost anything, so it cannot happen', () => {
    // KEPT, NOT DELETED, because it is the before/after of the GDD §4.4 ruling.
    // These two eleven-day histories used to end on best streaks of 2 and 1 —
    // the player who trained MORE ending lower — and the claim attached to them
    // was "no threshold fixes this, the same construction exists at any
    // threshold". THAT CLAIM WAS WRONG AT THIS SCALE and is deleted rather than
    // softened: with every gap here one day long, the free grace covers them
    // all, neither player spends anything, and the inversion is gone.
    //
    // WHAT WAS RIGHT ABOUT IT is that the construction reappears one gap-length
    // up. See the tests below, which rebuild it out of SHORTEST_PAID_GAP gaps
    // and find the same unbounded deficit.
    const initial: StreakState = { ...createStreakState(), recoveryDayBalance: 2 };
    const parse = (pattern: string): boolean[] => [...pattern].map((c) => c === 'T');
    const noGrants = Array.from({ length: 11 }, () => false);

    const lazy = simulate(parse('....T.T....'), noGrants, 'accept', initial);
    const diligent = simulate(parse('T...T.T....'), noGrants, 'accept', initial);

    // Was 2 against 1, the wrong way round. Now the extra session buys exactly
    // what it should: one more day of streak, both current and best.
    expect(lazy.state.currentStreak).toBe(2);
    expect(diligent.state.currentStreak).toBe(3);
    expect(lazy.state.longestStreak).toBe(2);
    expect(diligent.state.longestStreak).toBe(3);
    expect(diligent.state.currentStreak).toBeGreaterThan(lazy.state.currentStreak);

    // Both still spend — the trailing idle block at the end of the calendar is
    // long enough to be chargeable — so this is not "the grace made everything
    // free", it is the single-day gaps in the middle no longer costing.
    expect(lazy.recoveryDaysSpent).toBe(1);
    expect(diligent.recoveryDaysSpent).toBe(2);
  });

  it('KNOWN GAP, MINIMAL CASE: a player who accepts every offer can still be left worse off by training more', () => {
    // NOT a passing property dressed up as a caveat. This is a real hole in the
    // strong form of "daily engagement is never worse than skipping", pinned as
    // a test so it is visible and cannot change silently.
    //
    // GDD §4.4 SHRANK IT AND DID NOT CLOSE IT. The free grace removes every
    // instance built out of short gaps, which is most of them — see the
    // before/after counts in the MEASURED test below. What survives is the same
    // mechanism at gap length SHORTEST_PAID_GAP.
    //
    // MECHANISM, unchanged. Recovery Days are finite and only a LIVE run
    // generates offers. Training an extra day early keeps a run alive that the
    // lazier history had already lost, so the diligent player is *offered*
    // Recovery Days sooner — and a player who accepts every offer spends them on
    // a short run that dies anyway, leaving nothing for a longer run later. It
    // is the accepting, not the training, that costs. What GDD §4.2 offers
    // against it is agency: `RecoveryDayOffer.streakProtected` and
    // `.balanceAfter` are on the offer so the prompt can say what a yes is
    // worth today. Nothing on it can say what a yes costs later.
    //
    // Found by exhaustive search over all 2^12 histories at a starting balance
    // of 2 — the shortest length at which any inversion survives §4.4.
    const initial: StreakState = { ...createStreakState(), recoveryDayBalance: 2 };
    const parse = (pattern: string): boolean[] => [...pattern].map((c) => c === 'T');
    const noGrants = Array.from({ length: 12 }, () => false);

    const lazy = simulate(parse('....T.......'), noGrants, 'accept', initial);
    const diligent = simulate(parse('T...T.......'), noGrants, 'accept', initial);

    expect(lazy.state.currentStreak).toBe(1);
    expect(diligent.state.currentStreak).toBe(0);
    expect(diligent.recoveryDaysSpent).toBe(lazy.recoveryDaysSpent);
    expect(lazy.recoveryDaysSpent).toBeGreaterThan(0);
    // The diligent player trained on strictly more days and ended with a
    // strictly shorter live streak. Recorded, not excused.
    expect(diligent.state.currentStreak).toBeLessThan(lazy.state.currentStreak);
  });

  it('KNOWN GAP AT REALISTIC SCALE: 37 trained days end on a 37-day streak, 38 end on an 18-day one', () => {
    // The same mechanism as the minimal case, at a scale a player would
    // actually reach. Six weeks of training, one extra session, both players
    // accepting every offer and spending exactly the same number of Recovery
    // Days — and nineteen days' difference on the home-screen counter.
    const initial: StreakState = {
      ...createStreakState(),
      recoveryDayBalance: INVERSION_SEARCH.STARTING_BALANCE,
    };
    const { lazy: lazyHistory, diligent: diligentHistory } = inversionHistories(19, 18);
    const noGrants = Array.from({ length: lazyHistory.length }, () => false);

    const lazy = simulate(lazyHistory, noGrants, 'accept', initial);
    const diligent = simulate(diligentHistory, noGrants, 'accept', initial);

    // One extra session, and nothing else different about the two histories.
    expect(trainedDayCount(lazyHistory)).toBe(37);
    expect(trainedDayCount(diligentHistory)).toBe(38);
    expect(diligentHistory.filter((trained, i) => trained !== lazyHistory[i])).toEqual([true]);

    expect(lazy.state.currentStreak).toBe(37);
    expect(diligent.state.currentStreak).toBe(18);
    expect(lazy.state.longestStreak).toBe(37);
    expect(diligent.state.longestStreak).toBe(20);

    // Not explained by the diligent player having used more of the bank: the
    // two spend the same, and it is WHEN the diligent player was able to spend
    // — on a one-day streak nobody would decline — that costs them.
    expect(diligent.recoveryDaysSpent).toBe(lazy.recoveryDaysSpent);
    expect(lazy.recoveryDaysSpent).toBe(FAMILY_SPEND);
    expect(FAMILY_SPEND).toBeGreaterThan(0);
  });

  it('KNOWN GAP HAS NO CEILING: the deficit is exactly the run the diligent player loses, at any run length', () => {
    // The answer to "how much shorter can it get" is: as short as you like.
    // The deficit equals the length of the run that dies, so it scales with how
    // long the player has been training, while the Recovery Days that buy it
    // stay capped by what the module can ever grant.
    const initial: StreakState = {
      ...createStreakState(),
      recoveryDayBalance: INVERSION_SEARCH.STARTING_BALANCE,
    };
    const lifetimeFreeIncome = INVERSION_SEARCH.STARTING_BALANCE + STREAK_MILESTONE_DAYS.length;

    for (const runLost of INVERSION_SEARCH.FAMILY_RUN_LENGTHS) {
      const runRebuilt = runLost + 1;
      const { lazy: lazyHistory, diligent: diligentHistory } = inversionHistories(runLost, runRebuilt);
      const noGrants = Array.from({ length: lazyHistory.length }, () => false);

      const lazy = simulate(lazyHistory, noGrants, 'accept', initial);
      const diligent = simulate(diligentHistory, noGrants, 'accept', initial);

      expect(trainedDayCount(diligentHistory)).toBe(trainedDayCount(lazyHistory) + 1);
      // The lazy player's run never breaks, so every session they logged is in
      // the streak they finish on. This is what makes the table in the
      // `streak.ts` header read "trains 101 days -> streak 101" and be exact.
      expect(trainedDayCount(lazyHistory)).toBe(lazy.state.currentStreak);
      expect(lazy.state.currentStreak).toBe(runLost + runRebuilt);
      expect(diligent.state.currentStreak).toBe(runRebuilt);
      expect(lazy.state.currentStreak - diligent.state.currentStreak).toBe(runLost);
      expect(lazy.state.longestStreak - diligent.state.longestStreak).toBe(runLost);

      // The cost is bounded even though the damage is not: both players spend
      // the same, and neither spends more than the whole free-path income this
      // module hands out in a lifetime.
      expect(diligent.recoveryDaysSpent).toBe(lazy.recoveryDaysSpent);
      expect(lazy.recoveryDaysSpent).toBeLessThanOrEqual(lifetimeFreeIncome);

      // STRUCTURAL FACT THE FAMILY DEPENDS ON, checked rather than asserted in
      // prose: inside the live run every gap is exactly SHORTEST_PAID_GAP days
      // long. One day shorter and the free grace covers it for nothing, so no
      // Recovery Day is spent and there is no deficit to find; one day longer
      // and each gap costs two, which changes the draw-down arithmetic.
      const firstTrainedDay = lazyHistory.indexOf(true);
      let idleRun = 0;
      for (let i = firstTrainedDay; i < lazyHistory.length; i += 1) {
        idleRun = lazyHistory[i] === true ? 0 : idleRun + 1;
        expect(idleRun).toBeLessThanOrEqual(SHORTEST_PAID_GAP);
      }
      expect(SHORTEST_PAID_GAP).toBeGreaterThan(GRACE);
    }

    // Stated as a claim rather than left implicit in the loop: the largest
    // deficit this file demonstrates is a thousand days, and nothing about the
    // construction stops at a thousand.
    expect(Math.max(...INVERSION_SEARCH.FAMILY_RUN_LENGTHS)).toBe(1000);
  });

  it('KNOWN GAP, EXHAUSTIVE MAXIMISATION: the worst deficit grows with the length of the history rather than settling', () => {
    // The same machinery that found the minimal case, run the other way. Over
    // ALL 2^L histories at each length, and every way of turning one skipped
    // day into a trained one, this is the largest `currentStreak` deficit an
    // accepting player can suffer for the extra session.
    //
    // Pairs where the two players spent different numbers of Recovery Days are
    // skipped, so nothing counted here is explained away as "they used more of
    // the bank". The figures are pinned in INVERSION_SEARCH.
    const initial: StreakState = {
      ...createStreakState(),
      recoveryDayBalance: INVERSION_SEARCH.STARTING_BALANCE,
    };
    const worstByLength: number[] = [];

    for (const length of INVERSION_SEARCH.EXHAUSTIVE_LENGTHS) {
      const noGrants = Array.from({ length }, () => false);
      let worst = 0;
      for (let mask = 0; mask < 1 << length; mask += 1) {
        const attend = Array.from({ length }, (_, i) => (mask & (1 << i)) !== 0);
        const lazy = simulate(attend, noGrants, 'accept', initial);
        for (let flip = 0; flip < length; flip += 1) {
          if (attend[flip] === true) continue;
          const attendMore = attend.map((trained, i) => (i === flip ? true : trained));
          const diligent = simulate(attendMore, noGrants, 'accept', initial);
          if (diligent.recoveryDaysSpent !== lazy.recoveryDaysSpent) continue;
          worst = Math.max(worst, lazy.state.currentStreak - diligent.state.currentStreak);
        }
      }
      worstByLength.push(worst);
    }

    expect(worstByLength).toEqual([...INVERSION_SEARCH.WORST_DELTA_BY_LENGTH]);
    // Six more days of history, five more days of deficit. There is no ceiling
    // in this range, which is what the constructive family above then confirms
    // has no ceiling at all.
    const first = worstByLength[0] as number;
    const last = worstByLength[worstByLength.length - 1] as number;
    expect(last - first).toBe(5);
  });

  it('REGRESSION GUARD (this already passes): N Recovery Days used never ends below a player who trained fewer days and used none', () => {
    // THE INVARIANT AS ASKED FOR, AND IT HOLDS TODAY. This is a guard against a
    // future change, not a reproduction of a bug — nothing here is currently
    // broken and the test is not contrived to look otherwise.
    //
    // WHY IT HOLDS, so the guard is understood rather than merely green: the
    // comparator spends nothing, so the comparator's run is exactly its own
    // trailing block of consecutive trained days. The player being compared
    // trained every one of those days too, and Recovery Days only ever EXTEND a
    // run backwards across a gap — `acceptRecoveryDayOffer` never touches
    // `currentStreak`, it only sets `recoveredThroughDay`. So their live run
    // contains the comparator's, and cannot be shorter.
    //
    // PART ONE — BREADTH. Every 11-day calendar A, every sub-calendar B of A
    // (B trains a strict subset of A's days), keeping only the pairs where B
    // spent nothing, at every starting balance from 0 to the hold cap.
    const LENGTH = 11;
    const noGrants = Array.from({ length: LENGTH }, () => false);
    const spendCountsExercised = new Set<number>();
    let pairsChecked = 0;
    let violations = 0;

    for (let balance = 0; balance <= RECOVERY_DAY_GUARDRAILS.HOLD_CAP; balance += 1) {
      const initial: StreakState = { ...createStreakState(), recoveryDayBalance: balance };
      const results: SimResult[] = [];
      for (let mask = 0; mask < 1 << LENGTH; mask += 1) {
        const attend = Array.from({ length: LENGTH }, (_, i) => (mask & (1 << i)) !== 0);
        const result = simulate(attend, noGrants, 'accept', initial, 'daily', true);
        results.push(result);
        spendCountsExercised.add(result.recoveryDaysSpent);
      }

      for (let mask = 0; mask < 1 << LENGTH; mask += 1) {
        const usedRecoveryDays = results[mask] as SimResult;
        // Every proper submask: a player who trained a strict subset of A's days.
        for (let sub = (mask - 1) & mask; sub > 0; sub = (sub - 1) & mask) {
          const usedNone = results[sub] as SimResult;
          if (usedNone.recoveryDaysSpent !== 0) continue;
          pairsChecked += 1;
          if (usedRecoveryDays.state.currentStreak < usedNone.state.currentStreak) violations += 1;
        }
      }
    }

    expect(violations).toBe(0);
    expect(pairsChecked).toBeGreaterThan(100_000);

    // PART TWO — DEPTH, and it exists because part one no longer reaches every
    // N. Since GDD §4.4 the cheapest spend needs a SHORTEST_PAID_GAP-day
    // absence, so eleven days cannot fit more than two of them and the sweep
    // above only ever exercises N = 0, 1, 2. Asserting "for all N up to the
    // hold cap" off that would be a claim the test does not check.
    //
    // So the deeper spend counts are constructed rather than searched for: N
    // repetitions of [train, then a chargeable gap] spends exactly N.
    expect([...spendCountsExercised].sort((a, b) => a - b)).toEqual([0, 1, 2]);

    for (let n = 0; n <= RECOVERY_DAY_GUARDRAILS.HOLD_CAP; n += 1) {
      const history: boolean[] = [];
      for (let cycle = 0; cycle < n; cycle += 1) {
        history.push(true);
        for (let idle = 0; idle < SHORTEST_PAID_GAP; idle += 1) history.push(false);
      }
      history.push(true);
      const grants = Array.from({ length: history.length }, () => false);
      const initial: StreakState = {
        ...createStreakState(),
        recoveryDayBalance: RECOVERY_DAY_GUARDRAILS.HOLD_CAP,
      };
      const spender = simulate(history, grants, 'accept', initial, 'daily', true);
      // The construction has to actually spend N, or the loop proves nothing.
      expect(spender.recoveryDaysSpent).toBe(n);

      // Every comparator who trained a subset of those days and spent nothing.
      const trainedIndices = history.flatMap((trained, i) => (trained ? [i] : []));
      let comparatorsChecked = 0;
      for (let sub = 0; sub < 1 << trainedIndices.length; sub += 1) {
        const comparator = history.map(() => false);
        trainedIndices.forEach((dayIndex, bit) => {
          if ((sub & (1 << bit)) !== 0) comparator[dayIndex] = true;
        });
        const usedNone = simulate(comparator, grants, 'accept', initial, 'daily', true);
        if (usedNone.recoveryDaysSpent !== 0) continue;
        comparatorsChecked += 1;
        expect(spender.state.currentStreak).toBeGreaterThanOrEqual(usedNone.state.currentStreak);
      }
      expect(comparatorsChecked).toBeGreaterThan(0);
    }
  });

  it('BOUND THAT DOES HOLD: on your own calendar, accepting every offer is never worse than declining every offer', () => {
    // The practically meaningful guarantee, and the closest thing to the
    // requested property that is actually true. A player cannot be punished for
    // saying yes to the prompt GDD §4.2 shows them: for a FIXED calendar,
    // always-accept never ends on a lower current or longest streak than
    // always-decline. Exhaustive over every 13-day calendar, under both
    // app-opening models, then over long randomised ones.
    //
    // What this does NOT say is that training an extra day is safe — that is
    // the KNOWN GAP above, and it is a comparison between two DIFFERENT
    // calendars, not between two answers to the same prompt.
    const initial = createStreakState();
    const LENGTH = MONOTONICITY_MEASUREMENT.CALENDAR_LENGTH;
    const noGrants = Array.from({ length: LENGTH }, () => false);
    let checked = 0;

    for (const opens of ['daily', 'on-training-days'] as const) {
      for (let mask = 0; mask < 1 << LENGTH; mask += 1) {
        const attend = Array.from({ length: LENGTH }, (_, i) => (mask & (1 << i)) !== 0);
        const accepting = simulate(attend, noGrants, 'accept', initial, opens, true);
        const declining = simulate(attend, noGrants, 'decline', initial, opens, true);
        checked += 1;
        if (accepting.state.currentStreak < declining.state.currentStreak) {
          throw new Error(`accepting lost ground on ${renderCalendar(attend)} (opens=${opens})`);
        }
        if (accepting.state.longestStreak < declining.state.longestStreak) {
          throw new Error(`accepting lost best streak on ${renderCalendar(attend)} (opens=${opens})`);
        }
      }
    }
    expect(checked).toBe(2 * (1 << LENGTH));

    const random = mulberry32(0xacce_9701);
    for (let trial = 0; trial < 500; trial += 1) {
      const length = 35 + Math.floor(random() * 26);
      const attendance = 0.2 + random() * 0.75;
      const attend = Array.from({ length }, () => random() < attendance);
      const grants = Array.from({ length }, () => false);
      const accepting = simulate(attend, grants, 'accept', initial, 'daily', true);
      const declining = simulate(attend, grants, 'decline', initial, 'daily', true);
      expect(accepting.state.currentStreak).toBeGreaterThanOrEqual(declining.state.currentStreak);
      expect(accepting.state.longestStreak).toBeGreaterThanOrEqual(declining.state.longestStreak);
    }
  });

  it('KNOWN GAP, MEASURED: how many calendars an extra training day makes worse, under both app-opening models', () => {
    // The general monotonicity property, driven over the whole calendar space
    // rather than one pattern, with the count pinned so the size of the defect
    // is on the record and cannot drift silently.
    //
    // ROOT CAUSE, UNCHANGED BY GDD §4.4. Idle days BEFORE a run exists are free
    // — `lastCoveredDay` is null, so `daysMissedBefore` returns 0 and no offer
    // is made. Idle days INSIDE a live run past the free grace cost Recovery
    // Days. An extra training day converts the first kind into the second,
    // drains a finite pool, and leaves a later gap uncoverable, so a run dies
    // that would otherwise have survived. What §4.4 changed is the SIZE of the
    // absence that triggers it, not the asymmetry itself.
    const initial = createStreakState();
    const measureAt = (
      LENGTH: number,
    ): { counts: number[]; worstDeficit: number; zeroSpend: number } => {
      const noGrants = Array.from({ length: LENGTH }, () => false);
      const counts: number[] = [];
      let worstDeficit = 0;
      let zeroSpend = 0;

      for (const opens of ['daily', 'on-training-days'] as const) {
        const results: SimResult[] = [];
        for (let mask = 0; mask < 1 << LENGTH; mask += 1) {
          const attend = Array.from({ length: LENGTH }, (_, i) => (mask & (1 << i)) !== 0);
          results.push(simulate(attend, noGrants, 'accept', initial, opens, true));
        }

        let violations = 0;
        for (let mask = 0; mask < 1 << LENGTH; mask += 1) {
          const lazy = results[mask] as SimResult;
          for (let flip = 0; flip < LENGTH; flip += 1) {
            if ((mask & (1 << flip)) !== 0) continue;
            const diligent = results[mask | (1 << flip)] as SimResult;
            const deficit = lazy.state.currentStreak - diligent.state.currentStreak;
            if (deficit <= 0) continue;
            violations += 1;
            worstDeficit = Math.max(worstDeficit, deficit);
            if (lazy.recoveryDaysSpent === 0) zeroSpend += 1;
          }
        }
        counts.push(violations);
      }
      return { counts, worstDeficit, zeroSpend };
    };

    const short = measureAt(MONOTONICITY_MEASUREMENT.CALENDAR_LENGTH);
    expect(short.counts).toEqual([
      MONOTONICITY_MEASUREMENT.VIOLATIONS_OPENING_DAILY,
      MONOTONICITY_MEASUREMENT.VIOLATIONS_OPENING_ON_TRAINING_DAYS,
    ]);
    expect(short.worstDeficit).toBe(MONOTONICITY_MEASUREMENT.WORST_DEFICIT);
    // Every violation involves a comparator that ALSO spent. None of them
    // reach the invariant the user asked for, which is why that one passes.
    expect(short.zeroSpend).toBe(MONOTONICITY_MEASUREMENT.VIOLATIONS_AGAINST_A_ZERO_SPEND_COMPARATOR);

    // THE SECOND LENGTH IS THE POINT OF THIS TEST, not a bonus. Reading the
    // zero above on its own says the nightly-job model is clean. It is not: two
    // more days of calendar and it violates too.
    const long = measureAt(MONOTONICITY_MEASUREMENT.LONGER_CALENDAR_LENGTH);
    expect(long.counts).toEqual([
      MONOTONICITY_MEASUREMENT.VIOLATIONS_OPENING_DAILY_AT_LONGER_LENGTH,
      MONOTONICITY_MEASUREMENT.VIOLATIONS_OPENING_ON_TRAINING_DAYS_AT_LONGER_LENGTH,
    ]);
    expect(long.worstDeficit).toBe(MONOTONICITY_MEASUREMENT.WORST_DEFICIT_AT_LONGER_LENGTH);
    expect(long.zeroSpend).toBe(MONOTONICITY_MEASUREMENT.VIOLATIONS_AGAINST_A_ZERO_SPEND_COMPARATOR);
    expect(MONOTONICITY_MEASUREMENT.VIOLATIONS_OPENING_DAILY_AT_LONGER_LENGTH).toBeGreaterThan(
      MONOTONICITY_MEASUREMENT.VIOLATIONS_OPENING_DAILY,
    );
  });

  it('A STREAK READ OFF AN UNOPENED STATE IS STALE, so two states settled to different days must not be compared', () => {
    // This test exists because the defect above is easy to over-count. A run
    // that has already died stays on the state, at full length, until somebody
    // opens the day and settles it. Read `currentStreak` off a state nobody has
    // opened since the last session and it reports a streak the player does not
    // have.
    //
    // IT GETS THE ANSWER WRONG IN BOTH DIRECTIONS, which is why this is two
    // pairs and not one.
    const initial = createStreakState();
    const parse = (pattern: string): boolean[] => [...pattern].map((c) => c === 'T');
    const noGrants = Array.from({ length: 13 }, () => false);
    const stale = (pattern: string): SimResult =>
      simulate(parse(pattern), noGrants, 'accept', initial, 'on-training-days', false);
    const settled = (pattern: string): SimResult =>
      simulate(parse(pattern), noGrants, 'accept', initial, 'on-training-days', true);

    // (a) A VIOLATION THAT IS NOT THERE. Read unsettled, the player who trained
    // an extra day reads 1 against 2 — an apparent monotonicity failure. It is
    // not one: the 2 belongs to a run that ended days ago and has not been told.
    expect(stale('TT.....T.....').state.currentStreak).toBe(1);
    expect(stale('TT...........').state.currentStreak).toBe(2);
    expect(settled('TT.....T.....').state.currentStreak).toBe(1);
    expect(settled('TT...........').state.currentStreak).toBe(0);

    // (b) A VIOLATION THAT IS THERE AND HIDDEN. The same staleness conceals the
    // real defect: unsettled, the extra training day reads 4 against 3 and looks
    // fine; settled, it reads 0 against 3. This is the worst pair the measured
    // sweep below finds, so the two tests are looking at the same case.
    expect(stale('T....TTT.....').state.currentStreak).toBe(4);
    expect(stale('.....TTT.....').state.currentStreak).toBe(3);
    expect(settled('T....TTT.....').state.currentStreak).toBe(0);
    expect(settled('.....TTT.....').state.currentStreak).toBe(3);
    expect(
      settled('.....TTT.....').state.currentStreak - settled('T....TTT.....').state.currentStreak,
    ).toBe(MONOTONICITY_MEASUREMENT.WORST_DEFICIT);
  });

  it('but training itself never costs a Recovery Day, in any history', () => {
    // The invariant that DOES hold everywhere, and the reason the gap above is
    // about spending rather than about showing up: `recordTrainingDay` cannot
    // reduce the balance. `simulate` asserts it on every recorded session, so
    // every simulation in this file is also a check of this; here it is stated
    // once directly, across every reachable shape of state.
    for (const streak of [0, 1, 6, 7, 29, 30, 99]) {
      for (let balance = 0; balance <= RECOVERY_DAY_GUARDRAILS.HOLD_CAP; balance += 1) {
        for (const gap of [1, 2, 3, 9]) {
          const base = streak === 0 ? createStreakState() : stateWithRun(streak, DAY_ZERO, balance);
          const state = { ...base, recoveryDayBalance: balance };
          const day = addDays(DAY_ZERO, gap);
          const result = recordTrainingDay(state, day);
          if (!result.ok) {
            expect(result.error.code).toBe('RECOVERY_DECISION_PENDING');
            continue;
          }
          expect(result.value.state.recoveryDayBalance).toBeGreaterThanOrEqual(balance);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Read models and immutability
// ---------------------------------------------------------------------------

describe('read models', () => {
  it('never mutate the state they are handed', () => {
    const states: StreakState[] = [
      createStreakState(),
      stateWithRun(9, DAY_ZERO, 3),
      stateWithRun(50, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP),
    ];
    for (const state of states) {
      const before = clone(state);
      for (let offset = 0; offset < 10; offset += 1) {
        const day = addDays(DAY_ZERO, offset);
        openDay(state, day);
        currentRecoveryDayOffer(state, day);
        daysMissedBefore(state, day);
      }
      coverableGapDays(state);
      payableGapDays(state);
      recoveryDayCapacity(state);
      streakDeadlineDay(state);
      lastDayStreakCanBeSaved(state);
      lastCoveredDay(state);
      expect(state).toEqual(before);
    }
  });

  it('never mutate the state a transition is handed', () => {
    const state = stateWithRun(9, DAY_ZERO, 3);
    const before = clone(state);
    const day = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    const offer = currentRecoveryDayOffer(state, day) as NonNullable<
      ReturnType<typeof currentRecoveryDayOffer>
    >;
    acceptRecoveryDayOffer(state, offer);
    declineRecoveryDayOffer(state, offer);
    grantRecoveryDays(state, { source: 'achievement' });
    recordTrainingDay(state, addDays(DAY_ZERO, 1));
    settleBrokenStreak(state, addDays(DAY_ZERO, 9));
    expect(state).toEqual(before);
  });

  it('agree with each other about whether an offer exists, and about the grace', () => {
    const kindsSeen = new Set<string>();
    for (let balance = 0; balance <= RECOVERY_DAY_GUARDRAILS.HOLD_CAP; balance += 1) {
      for (let gap = 0; gap <= GRACE + RECOVERY_DAY_GUARDRAILS.MAX_CONSECUTIVE_USES + 3; gap += 1) {
        const state = stateWithRun(9, DAY_ZERO, balance);
        const day = dayAfterGap(DAY_ZERO, gap);
        const offer = currentRecoveryDayOffer(state, day);
        const opening = openDay(state, day);
        kindsSeen.add(opening.kind);
        expect(opening.kind === 'recovery-day-offered').toBe(offer !== null);

        // A gap inside the grace is alive and free, at EVERY balance — that is
        // the whole of the §4.4 change, read off the two models together.
        if (gap >= 1 && gap <= GRACE) {
          expect(opening.kind).toBe('gap-covered-by-grace');
          expect(offer).toBeNull();
        }

        if (offer !== null) {
          expect(offer.cost).toBe(chargeableGapDays(gap));
          expect(offer.cost).toBeGreaterThanOrEqual(1);
          expect(offer.daysCoveredFreeByGrace).toBe(GRACE);
          expect(offer.cost).toBeLessThanOrEqual(payableGapDays(state));
          expect(day).toBeLessThanOrEqual(lastDayStreakCanBeSaved(state) as StreakDay);
        }
        if (gap > 0 && offer === null && opening.kind === 'streak-broken') {
          expect(day).toBeGreaterThan(lastDayStreakCanBeSaved(state) as StreakDay);
        }
      }
    }
    // The sweep is only worth anything if it reached all three shapes.
    expect(kindsSeen).toEqual(
      new Set(['streak-alive', 'gap-covered-by-grace', 'recovery-day-offered', 'streak-broken']),
    );
  });
});
