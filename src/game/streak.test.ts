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
  it('breaks on a missed day when nothing can cover it', () => {
    const state = { ...trainConsecutively(createStreakState(), DAY_ZERO, 6), recoveryDayBalance: 0 };
    const opening = openDay(state, addDays(DAY_ZERO, 7));
    expect(opening).toEqual({
      kind: 'streak-broken',
      brokenRunLength: 6,
      daysMissed: 1,
      reason: 'not-enough-recovery-days',
    });
  });

  it('starts a new run at 1 when training after an uncoverable gap', () => {
    const state = { ...trainConsecutively(createStreakState(), DAY_ZERO, 6), recoveryDayBalance: 0 };
    const outcome = unwrap(recordTrainingDay(state, addDays(DAY_ZERO, 7)));
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
    const outcome = unwrap(settleBrokenStreak(state, addDays(DAY_ZERO, 2)));
    expect(outcome.endedRunLength).toBe(20);
    expect(outcome.daysMissed).toBe(1);
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

  it('refuses to settle a break the player could still be offered a Recovery Day for', () => {
    // Settling here would be a silent auto-decline, the mirror of auto-apply.
    const state = stateWithRun(4, DAY_ZERO, 2);
    expect(errorCodeOf(settleBrokenStreak(state, addDays(DAY_ZERO, 2)))).toBe('RECOVERY_DECISION_PENDING');
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
// Recovery Days — offer, accept, decline
// ---------------------------------------------------------------------------

describe('the Recovery Day offer', () => {
  it('appears for a single missed day and describes the whole decision', () => {
    const state = stateWithRun(9, DAY_ZERO, 3);
    const offer = currentRecoveryDayOffer(state, addDays(DAY_ZERO, 2));
    expect(offer).toEqual({
      offeredOnDay: addDays(DAY_ZERO, 2),
      missedDays: [addDays(DAY_ZERO, 1)],
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
    const opening = openDay(state, addDays(DAY_ZERO, 2));
    expect(opening.kind).toBe('recovery-day-offered');
    // openDay is a read model: the state it was handed is untouched.
    expect(state).toEqual(before);
    expect(state.recoveryDayBalance).toBe(3);
    expect(state.currentStreak).toBe(9);
  });

  it('keeps the run alive when accepted, and spends exactly the offered cost', () => {
    const state = stateWithRun(9, DAY_ZERO, 3);
    const day = addDays(DAY_ZERO, 2);
    const offer = currentRecoveryDayOffer(state, day);
    expect(offer).not.toBeNull();
    const outcome = unwrap(acceptRecoveryDayOffer(state, offer as NonNullable<typeof offer>));
    expect(outcome.recoveryDaysSpent).toBe(1);
    expect(outcome.balanceAfter).toBe(2);
    expect(outcome.state.recoveryDayBalance).toBe(2);
    expect(outcome.state.currentStreak).toBe(9);
    expect(outcome.state.recoveredThroughDay).toBe(addDays(DAY_ZERO, 1));
    expect(outcome.coveredDays).toEqual([addDays(DAY_ZERO, 1)]);
    // ...and the run continues from today.
    expect(openDay(outcome.state, day)).toEqual({
      kind: 'streak-alive',
      currentStreak: 9,
      streakIfTrainedToday: 10,
      lastDayStreakCanBeSaved: addDays(day, coverableGapDays(outcome.state)),
    });
    expect(unwrap(recordTrainingDay(outcome.state, day)).streakAfter).toBe(10);
  });

  it('covers a two-day gap in one offer, or none at all', () => {
    const state = stateWithRun(9, DAY_ZERO, 5);
    const offer = currentRecoveryDayOffer(state, addDays(DAY_ZERO, 3));
    expect(offer?.cost).toBe(2);
    expect(offer?.missedDays).toEqual([addDays(DAY_ZERO, 1), addDays(DAY_ZERO, 2)]);
  });

  it('never offers partial coverage of a gap it cannot close', () => {
    // Balance 1, gap 2: covering one day would take a Recovery Day and still
    // leave the run broken, so there is no offer at all.
    const state = stateWithRun(9, DAY_ZERO, 1);
    expect(currentRecoveryDayOffer(state, addDays(DAY_ZERO, 3))).toBeNull();
    expect(openDay(state, addDays(DAY_ZERO, 3))).toEqual({
      kind: 'streak-broken',
      brokenRunLength: 9,
      daysMissed: 2,
      reason: 'not-enough-recovery-days',
    });
  });

  it('refuses to record a session while an offer is outstanding', () => {
    // GDD §4.2 "manual use, not auto-apply": the decision cannot be skipped.
    const state = stateWithRun(9, DAY_ZERO, 3);
    expect(errorCodeOf(recordTrainingDay(state, addDays(DAY_ZERO, 2)))).toBe('RECOVERY_DECISION_PENDING');
  });

  it('rejects a stale or fabricated offer instead of trusting it', () => {
    const state = stateWithRun(9, DAY_ZERO, 3);
    const day = addDays(DAY_ZERO, 2);
    const real = currentRecoveryDayOffer(state, day) as NonNullable<
      ReturnType<typeof currentRecoveryDayOffer>
    >;

    const cheaper = { ...real, cost: 0, balanceAfter: 3 };
    expect(errorCodeOf(acceptRecoveryDayOffer(state, cheaper))).toBe('OFFER_DOES_NOT_MATCH_STATE');

    const widerCoverage = { ...real, missedDays: [...real.missedDays, addDays(DAY_ZERO, 5)] };
    expect(errorCodeOf(acceptRecoveryDayOffer(state, widerCoverage))).toBe('OFFER_DOES_NOT_MATCH_STATE');

    const inflatedStreak = { ...real, streakProtected: 99 };
    expect(errorCodeOf(acceptRecoveryDayOffer(state, inflatedStreak))).toBe('OFFER_DOES_NOT_MATCH_STATE');

    const alreadySpent = unwrap(acceptRecoveryDayOffer(state, real)).state;
    expect(errorCodeOf(acceptRecoveryDayOffer(alreadySpent, real))).toBe('NO_RECOVERY_DAY_OFFER');
  });

  it('has nothing to accept when the run is intact', () => {
    const state = stateWithRun(9, DAY_ZERO, 3);
    const offer = currentRecoveryDayOffer(state, addDays(DAY_ZERO, 2)) as NonNullable<
      ReturnType<typeof currentRecoveryDayOffer>
    >;
    const intact = { ...offer, offeredOnDay: addDays(DAY_ZERO, 1) };
    expect(errorCodeOf(acceptRecoveryDayOffer(state, intact))).toBe('NO_RECOVERY_DAY_OFFER');
    expect(errorCodeOf(declineRecoveryDayOffer(state, intact))).toBe('NO_RECOVERY_DAY_OFFER');
  });
});

describe('declining a Recovery Day offer', () => {
  it('really breaks the streak, and really leaves the balance alone', () => {
    const state = stateWithRun(23, DAY_ZERO, 4);
    const day = addDays(DAY_ZERO, 2);
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
    const day = addDays(DAY_ZERO, 2);
    const offer = currentRecoveryDayOffer(state, day) as NonNullable<
      ReturnType<typeof currentRecoveryDayOffer>
    >;
    const declined = unwrap(declineRecoveryDayOffer(state, offer)).state;
    expect(currentRecoveryDayOffer(declined, day)).toBeNull();
    expect(currentRecoveryDayOffer(declined, addDays(day, 1))).toBeNull();
  });

  it('lets a new run start immediately', () => {
    const state = stateWithRun(23, DAY_ZERO, 4);
    const day = addDays(DAY_ZERO, 2);
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
    expect(coverableGapDays(state)).toBe(RECOVERY_DAY_GUARDRAILS.MAX_CONSECUTIVE_USES);
    expect(lastDayStreakCanBeSaved(state)).toBe(
      addDays(DAY_ZERO, 1 + RECOVERY_DAY_GUARDRAILS.MAX_CONSECUTIVE_USES),
    );
  });
});

// ---------------------------------------------------------------------------
// Guardrail: consecutive uses
// ---------------------------------------------------------------------------

describe('the consecutive-use limit', () => {
  const LIMIT = RECOVERY_DAY_GUARDRAILS.MAX_CONSECUTIVE_USES;

  it('covers a gap exactly at the limit', () => {
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    const offer = currentRecoveryDayOffer(state, addDays(DAY_ZERO, LIMIT + 1));
    expect(offer?.cost).toBe(LIMIT);
    expect(offer?.consecutiveRecoveryDaysUsedAfter).toBe(LIMIT);
  });

  it('refuses a gap one day past the limit, even at full balance', () => {
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    expect(currentRecoveryDayOffer(state, addDays(DAY_ZERO, LIMIT + 2))).toBeNull();
    expect(openDay(state, addDays(DAY_ZERO, LIMIT + 2))).toEqual({
      kind: 'streak-broken',
      brokenRunLength: 9,
      daysMissed: LIMIT + 1,
      reason: 'gap-longer-than-consecutive-limit',
    });
  });

  it('counts uses across separate offers with no training in between', () => {
    let state: StreakState = stateWithRun(9, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    for (let used = 1; used <= LIMIT; used += 1) {
      const day = addDays(DAY_ZERO, used + 1);
      const offer = currentRecoveryDayOffer(state, day);
      expect(offer?.cost).toBe(1);
      state = unwrap(acceptRecoveryDayOffer(state, offer as NonNullable<typeof offer>)).state;
      expect(state.consecutiveRecoveryDaysUsed).toBe(used);
    }
    // One more missed day with no session in between: the run ends, and it ends
    // with Recovery Days still in the bank.
    const pastLimit = addDays(DAY_ZERO, LIMIT + 2);
    expect(currentRecoveryDayOffer(state, pastLimit)).toBeNull();
    expect(state.recoveryDayBalance).toBeGreaterThan(0);
    expect(openDay(state, pastLimit)).toEqual({
      kind: 'streak-broken',
      brokenRunLength: 9,
      daysMissed: 1,
      reason: 'consecutive-use-limit-reached',
    });
  });

  it('does NOT stop an alternating train / miss pattern — there is no cooldown', () => {
    // The module header claims this out loud rather than implying a guard it
    // does not have. Here it is, demonstrated: because every trained day resets
    // the consecutive count, a player who trains every other day spends one
    // Recovery Day per missed day until the bank is empty, and only then breaks.
    const STARTING_BALANCE = 3;
    let state: StreakState = stateWithRun(1, DAY_ZERO, STARTING_BALANCE);
    let spent = 0;
    let brokeOnDay: StreakDay | null = null;

    for (let i = 1; i <= 10 && brokeOnDay === null; i += 1) {
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
      if (i % 2 === 0) state = unwrap(recordTrainingDay(state, day)).state;
    }

    expect(spent).toBe(STARTING_BALANCE);
    expect(state.recoveryDayBalance).toBe(0);
    expect(state.currentStreak).toBe(1 + STARTING_BALANCE);
    expect(brokeOnDay).toBe(addDays(DAY_ZERO, 2 * STARTING_BALANCE + 2));
  });

  it('resets the count on any training day', () => {
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    const day = addDays(DAY_ZERO, 2);
    const offer = currentRecoveryDayOffer(state, day) as NonNullable<
      ReturnType<typeof currentRecoveryDayOffer>
    >;
    const saved = unwrap(acceptRecoveryDayOffer(state, offer)).state;
    expect(saved.consecutiveRecoveryDaysUsed).toBe(1);
    const trained = unwrap(recordTrainingDay(saved, day)).state;
    expect(trained.consecutiveRecoveryDaysUsed).toBe(0);
    expect(trained.recoveredThroughDay).toBeNull();
    expect(coverableGapDays(trained)).toBe(Math.min(trained.recoveryDayBalance, LIMIT));
  });
});

// ---------------------------------------------------------------------------
// A long absence
// ---------------------------------------------------------------------------

describe('a long absence', () => {
  const AWAY_DAYS = 7;

  it('cannot be repaired, even holding a full bank', () => {
    const state = stateWithRun(50, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    const backOn = addDays(DAY_ZERO, AWAY_DAYS + 1);
    expect(daysMissedBefore(state, backOn)).toBe(AWAY_DAYS);
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

  it('cannot be walked back day by day either', () => {
    // The module has no clock, so a caller could try to replay the missed days
    // one at a time and accept an offer on each. The consecutive-use guardrail
    // is what stops that, and it stops it after MAX_CONSECUTIVE_USES days.
    let state: StreakState = stateWithRun(50, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    let accepted = 0;
    for (let offset = 2; offset <= AWAY_DAYS + 1; offset += 1) {
      const offer = currentRecoveryDayOffer(state, addDays(DAY_ZERO, offset));
      if (offer === null) break;
      state = unwrap(acceptRecoveryDayOffer(state, offer)).state;
      accepted += 1;
    }
    expect(accepted).toBe(RECOVERY_DAY_GUARDRAILS.MAX_CONSECUTIVE_USES);
    expect(openDay(state, addDays(DAY_ZERO, AWAY_DAYS + 1)).kind).toBe('streak-broken');
    expect(unwrap(recordTrainingDay(state, addDays(DAY_ZERO, AWAY_DAYS + 1))).state.currentStreak).toBe(1);
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

  it('flags the first offer, and only the first — accepted', () => {
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    const dayOne = addDays(DAY_ZERO, 2);
    const first = firstOffer(state, dayOne);
    expect(first.isFirstBreakTutorial).toBe(true);

    const outcome = unwrap(acceptRecoveryDayOffer(state, first));
    expect(outcome.wasFirstBreakTutorial).toBe(true);
    expect(outcome.state.hasResolvedFirstBreakOffer).toBe(true);

    // A later break, after training resets the consecutive count.
    const trained = trainConsecutively(outcome.state, dayOne, 3);
    const second = firstOffer(trained, addDays(dayOne, 4));
    expect(second.isFirstBreakTutorial).toBe(false);
    expect(unwrap(acceptRecoveryDayOffer(trained, second)).wasFirstBreakTutorial).toBe(false);
  });

  it('flags the first offer, and only the first — declined', () => {
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    const dayOne = addDays(DAY_ZERO, 2);
    const first = firstOffer(state, dayOne);
    const declined = unwrap(declineRecoveryDayOffer(state, first));
    expect(declined.wasFirstBreakTutorial).toBe(true);
    expect(declined.state.hasResolvedFirstBreakOffer).toBe(true);

    const trained = trainConsecutively(declined.state, dayOne, 3);
    expect(firstOffer(trained, addDays(dayOne, 4)).isFirstBreakTutorial).toBe(false);
  });

  it('is an offer, not an auto-save: the state is unchanged until it is answered', () => {
    const state = stateWithRun(9, DAY_ZERO, 3);
    const before = clone(state);
    const day = addDays(DAY_ZERO, 2);
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
    expect(currentRecoveryDayOffer(broke, addDays(DAY_ZERO, 2))).toBeNull();
    const settled = unwrap(settleBrokenStreak(broke, addDays(DAY_ZERO, 2)));
    expect(settled.wasFirstBreakTutorial).toBe(false);
    expect(settled.state.hasResolvedFirstBreakOffer).toBe(false);

    const restarted = trainConsecutively(
      { ...settled.state, recoveryDayBalance: 3 },
      addDays(DAY_ZERO, 5),
      4,
    );
    const offer = currentRecoveryDayOffer(restarted, addDays(DAY_ZERO, 10));
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
    let day = DAY_ZERO;
    for (let i = 0; i < 60; i += 1) {
      const skip = i % 5 === 3;
      const opening = openDay(state, day);
      if (opening.kind === 'recovery-day-offered') {
        const outcome = unwrap(acceptRecoveryDayOffer(state, opening.offer));
        if (outcome.wasFirstBreakTutorial) tutorials += 1;
        state = outcome.state;
      } else if (opening.kind === 'streak-broken') {
        state = unwrap(settleBrokenStreak(state, day)).state;
      }
      if (!skip) state = unwrap(recordTrainingDay(state, day)).state;
      day = addDays(day, 1);
    }
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
    let state: StreakState = {
      ...createStreakState(),
      recoveryDayBalance: RECOVERY_DAY_GUARDRAILS.HOLD_CAP,
    };
    let sessions = 0;
    let milestoneAtSessions = -1;
    let recoveryDaysUsed = 0;
    // Train, train, skip — the skipped day is covered every time, so the run
    // never breaks and 7 calendar days' worth of streak arrives after only 5
    // sessions if a Recovery Day were to count. It must not.
    for (let i = 0; i < 12 && milestoneAtSessions < 0; i += 1) {
      const day = addDays(DAY_ZERO, i);
      const opening = openDay(state, day);
      expect(opening.kind).not.toBe('streak-broken');
      if (opening.kind === 'recovery-day-offered') {
        const outcome = unwrap(acceptRecoveryDayOffer(state, opening.offer));
        recoveryDaysUsed += outcome.recoveryDaysSpent;
        state = outcome.state;
      }
      if (i % 3 !== 2) {
        const outcome = unwrap(recordTrainingDay(state, day));
        state = outcome.state;
        sessions += 1;
        if (outcome.milestonesReached.includes(7)) milestoneAtSessions = sessions;
      }
    }
    expect(recoveryDaysUsed).toBeGreaterThan(0);
    expect(milestoneAtSessions).toBe(7);
  });

  it('never counts a Recovery Day as a training day', () => {
    const state = stateWithRun(9, DAY_ZERO, 4);
    const offer = currentRecoveryDayOffer(state, addDays(DAY_ZERO, 3)) as NonNullable<
      ReturnType<typeof currentRecoveryDayOffer>
    >;
    const outcome = unwrap(acceptRecoveryDayOffer(state, offer));
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
    const offer = currentRecoveryDayOffer(states[1] as StreakState, addDays(DAY_ZERO, 2));
    states.push(unwrap(acceptRecoveryDayOffer(states[1] as StreakState, offer as NonNullable<typeof offer>)).state);
    states.push(unwrap(grantRecoveryDays(createStreakState(), { source: 'purchase-chalk', amount: 2 })).state);

    for (const state of states) {
      expect(Object.keys(state).sort()).toEqual([...STREAK_FACT_KEYS].sort());
    }
  });

  it('reports nothing outside the declared spend allowlist', () => {
    const state = stateWithRun(9, DAY_ZERO, 3);
    const offer = currentRecoveryDayOffer(state, addDays(DAY_ZERO, 2)) as NonNullable<
      ReturnType<typeof currentRecoveryDayOffer>
    >;
    const outcome = unwrap(acceptRecoveryDayOffer(state, offer));
    expect(Object.keys(outcome).sort()).toEqual([...RECOVERY_DAY_OUTCOME_KEYS].sort());
  });

  it('has no field anywhere whose name suggests it touches Total, e1RM or pace', () => {
    // A blocklist is weaker than the allowlist above; it is here as a second,
    // independent reading of the same question, on both the state and the
    // outcome objects.
    const forbidden = /total|e1rm|1rm|weight|load|pace|multiplier|bonus|boost|iq|fatigue|readiness|attempt/i;
    const state = stateWithRun(9, DAY_ZERO, 3);
    const offer = currentRecoveryDayOffer(state, addDays(DAY_ZERO, 2)) as NonNullable<
      ReturnType<typeof currentRecoveryDayOffer>
    >;
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
    const day = addDays(DAY_ZERO, 2);
    const bought = unwrap(grantRecoveryDays(run, { source: 'purchase-chalk', amount: 1 })).state;
    const earned = unwrap(grantRecoveryDays(run, { source: 'achievement' })).state;
    expect(bought).toEqual(earned);

    const boughtOffer = currentRecoveryDayOffer(bought, day);
    const earnedOffer = currentRecoveryDayOffer(earned, day);
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
    let state: StreakState = { ...createStreakState(), recoveryDayBalance: 0 };
    state = unwrap(grantRecoveryDays(state, { source: 'purchase-chalk', amount: 99 })).state;
    let trainedDays = 0;
    let day = DAY_ZERO;
    for (let i = 0; i < 40; i += 1) {
      const opening = openDay(state, day);
      if (opening.kind === 'recovery-day-offered') {
        state = unwrap(acceptRecoveryDayOffer(state, opening.offer)).state;
      } else if (opening.kind === 'streak-broken') {
        state = unwrap(settleBrokenStreak(state, day)).state;
      }
      if (i % 3 !== 1) {
        state = unwrap(recordTrainingDay(state, day)).state;
        trainedDays += 1;
      }
      day = addDays(day, 1);
      expect(state.currentStreak).toBeLessThanOrEqual(trainedDays);
    }
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
 * Replays a history of consecutive days. `attend[i]` is whether the player
 * trained on day i; `grantOn[i]` whether a one-Recovery-Day grant lands that
 * morning. Breaks with no possible save are settled, exactly as an app would.
 */
function simulate(
  attend: readonly boolean[],
  grantOn: readonly boolean[],
  policy: OfferPolicy,
  initial: StreakState,
): SimResult {
  let state = initial;
  let spent = 0;
  for (let i = 0; i < attend.length; i += 1) {
    const day = addDays(DAY_ZERO, i);
    if (grantOn[i] === true) {
      state = unwrap(grantRecoveryDays(state, { source: 'purchase-chalk', amount: 1 })).state;
    }
    const opening = openDay(state, day);
    if (opening.kind === 'recovery-day-offered') {
      if (policy === 'accept') {
        const outcome = unwrap(acceptRecoveryDayOffer(state, opening.offer));
        spent += outcome.recoveryDaysSpent;
        state = outcome.state;
      } else {
        state = unwrap(declineRecoveryDayOffer(state, opening.offer)).state;
      }
    } else if (opening.kind === 'streak-broken') {
      state = unwrap(settleBrokenStreak(state, day)).state;
    }
    if (attend[i] === true) {
      const before = state.recoveryDayBalance;
      const outcome = unwrap(recordTrainingDay(state, day));
      // Local invariant, checked on every single recorded session in every
      // simulation below: showing up never costs a Recovery Day.
      expect(outcome.state.recoveryDayBalance).toBeGreaterThanOrEqual(before);
      expect(outcome.streakAfter).toBeGreaterThanOrEqual(1);
      state = outcome.state;
    }
  }
  return { state, recoveryDaysSpent: spent };
}

describe('daily engagement is never worse than skipping', () => {
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

  it('PROPERTY, EXHAUSTIVE: over every 10-day history, training an extra day never loses ground', () => {
    // The strong form, checked over ALL 2^10 attendance patterns rather than a
    // sample, with the player never spending a Recovery Day. This is the
    // streak mechanic on its own: no spending, so nothing but showing up moves
    // the numbers, and showing up more must never move them down.
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

  it('PROPERTY: holds over long randomised histories with grants landing mid-run', () => {
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

  it('KNOWN GAP: a player who accepts every offer can be left worse off by training more', () => {
    // NOT a passing property dressed up as a caveat. This is a real hole in the
    // strong form of "daily engagement is never worse than skipping", pinned as
    // a test so it is visible and cannot change silently. A human has to decide
    // whether to accept it; nothing in this module fixes it.
    //
    // MECHANISM. Recovery Days are finite and only a LIVE run generates offers.
    // Training an extra day early keeps a run alive that the lazier history had
    // already lost, so the diligent player is *offered* Recovery Days sooner —
    // and a player who accepts every offer spends them on a short run that dies
    // anyway, leaving nothing for a longer run later. It is the accepting, not
    // the training, that costs: no threshold fixes it, because the same
    // construction exists at any threshold. What GDD §4.2 offers against it is
    // agency — `RecoveryDayOffer.streakProtected` and `.balanceAfter` are on
    // the offer precisely so the prompt can tell the player what a yes is worth.
    //
    // These exact numbers were found by exhaustive search over all 2^11
    // histories at a starting balance of 2.
    const initial: StreakState = { ...createStreakState(), recoveryDayBalance: 2 };
    const parse = (pattern: string): boolean[] => [...pattern].map((c) => c === 'T');
    const noGrants = Array.from({ length: 11 }, () => false);

    const lazy = simulate(parse('....T.T....'), noGrants, 'accept', initial);
    const diligent = simulate(parse('T...T.T....'), noGrants, 'accept', initial);

    expect(lazy.state.longestStreak).toBe(2);
    expect(diligent.state.longestStreak).toBe(1);
    expect(diligent.recoveryDaysSpent).toBe(lazy.recoveryDaysSpent);
    // The diligent player trained on strictly more days and ended with a
    // strictly shorter best streak. Recorded, not excused.
    expect(diligent.state.longestStreak).toBeLessThan(lazy.state.longestStreak);
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
    const day = addDays(DAY_ZERO, 2);
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

  it('agree with each other about whether an offer exists', () => {
    for (let balance = 0; balance <= RECOVERY_DAY_GUARDRAILS.HOLD_CAP; balance += 1) {
      for (let gap = 0; gap <= 6; gap += 1) {
        const state = stateWithRun(9, DAY_ZERO, balance);
        const day = addDays(DAY_ZERO, gap + 1);
        const offer = currentRecoveryDayOffer(state, day);
        const opening = openDay(state, day);
        expect(opening.kind === 'recovery-day-offered').toBe(offer !== null);
        if (offer !== null) {
          expect(offer.cost).toBe(gap);
          expect(offer.cost).toBeLessThanOrEqual(coverableGapDays(state));
          expect(day).toBeLessThanOrEqual(lastDayStreakCanBeSaved(state) as StreakDay);
        }
        if (gap > 0 && offer === null) {
          expect(day).toBeGreaterThan(lastDayStreakCanBeSaved(state) as StreakDay);
        }
      }
    }
  });
});
