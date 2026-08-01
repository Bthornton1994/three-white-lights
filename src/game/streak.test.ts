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

  /** History lengths the exhaustive maximisation sweeps. All 2^L of each. */
  EXHAUSTIVE_LENGTHS: [8, 9, 10, 11, 12, 13, 14],

  /**
   * Largest `currentStreak` deficit one extra training day can cause, over
   * every history of each length above, counting only pairs where both players
   * spent the SAME number of Recovery Days. Found by search, not derived.
   */
  WORST_DELTA_BY_LENGTH: [3, 4, 5, 5, 6, 7, 8],

  /**
   * Run lengths the constructive family below is instantiated at. None of them
   * is a milestone or one day short of one — `inversionHistories` refuses those
   * and says why.
   */
  FAMILY_RUN_LENGTHS: [8, 19, 31, 50, 101, 365, 1000],
} as const;

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

  /** Violating pairs when something opens the day every day (a nightly job). */
  VIOLATIONS_OPENING_DAILY: 1948,

  /** Violating pairs when only the player's own sessions open the day. */
  VIOLATIONS_OPENING_ON_TRAINING_DAYS: 4250,

  /**
   * Largest `currentStreak` deficit found at this calendar length. The same
   * pair is worst under both opening models.
   */
  WORST_DEFICIT: 6,

  /**
   * Violations of the invariant the user asked for — a player who spent
   * Recovery Days against one who trained fewer days and spent NONE. Zero, and
   * not by luck; see the regression-guard test for why it is structural.
   */
  VIOLATIONS_AGAINST_A_ZERO_SPEND_COMPARATOR: 0,
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
 * Single missed days are then placed to draw both banks down — one immediately,
 * and one after each milestone payout that lands inside the run — until the
 * lazy player holds exactly one Recovery Day and the diligent player holds
 * none. The next single missed day is covered for the lazy player and fatal for
 * the diligent one.
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
  lazy.push(false); // day 0 — the one divergent day; the diligent player trains it
  lazy.push(false); // day 1 — the gap only the diligent player is offered a save for
  lazy.push(true); // both start (or restart) their run here
  let lazyStreak = 1;
  lazy.push(false); // first draw-down gap: lazy balance 2 -> 1, diligent 1 -> 0

  for (const milestone of STREAK_MILESTONE_DAYS) {
    if (milestone > runLost) break;
    while (lazyStreak < milestone) {
      lazy.push(true);
      lazyStreak += 1;
    }
    lazy.push(false); // draw down the milestone payout that just landed for both
    // Every gap in this family is exactly one day long, which is what lets the
    // family rule out "charge per gap rather than per missed day" as a fix.
    // That needs a trained day between consecutive gaps, including between the
    // last draw-down and the fatal gap.
    lazy.push(true);
    lazyStreak += 1;
  }

  while (lazyStreak < runLost) {
    lazy.push(true);
    lazyStreak += 1;
  }
  lazy.push(false); // the fatal gap: covered for the lazy player, uncoverable for the other
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

  it('KNOWN GAP, MINIMAL CASE: a player who accepts every offer can be left worse off by training more', () => {
    // NOT a passing property dressed up as a caveat. This is a real hole in the
    // strong form of "daily engagement is never worse than skipping", pinned as
    // a test so it is visible and cannot change silently. A human has to decide
    // whether to accept it; nothing in this module fixes it.
    //
    // THIS IS THE SMALLEST CASE THAT EXISTS, NOT A REPRESENTATIVE ONE. Read it
    // on its own and a best streak of 2 against 1 looks like a rounding
    // artifact of an eleven-day toy history. It is not: the three tests that
    // follow take the same mechanism to 37 against 18, then to 2001 against
    // 1001, then search for a ceiling and fail to find one.
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
    expect(lazy.recoveryDaysSpent).toBe(3);
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

      // Backs a claim in the `streak.ts` header: charging one Recovery Day per
      // GAP instead of per missed day would change nothing about this family,
      // because every gap in it is already exactly one day long. Checked here
      // rather than asserted in prose.
      const firstTrainedDay = lazyHistory.indexOf(true);
      let idleRun = 0;
      for (let i = firstTrainedDay; i < lazyHistory.length; i += 1) {
        idleRun = lazyHistory[i] === true ? 0 : idleRun + 1;
        expect(idleRun).toBeLessThanOrEqual(1);
      }
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
    // Swept over every 13-day calendar A, every sub-calendar B of A (B trains a
    // strict subset of A's days), keeping only the pairs where B spent nothing,
    // at every starting balance from 0 to the hold cap so that every N from 0
    // to HOLD_CAP is actually exercised rather than assumed.
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
    // "For all N up to the hold cap" is only meaningful if the sweep reached
    // every N. Asserted rather than hoped for.
    for (let n = 0; n <= RECOVERY_DAY_GUARDRAILS.HOLD_CAP; n += 1) {
      expect(spendCountsExercised.has(n)).toBe(true);
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

  it('KNOWN GAP, MEASURED: how many 13-day calendars an extra training day makes worse, under both app-opening models', () => {
    // The general monotonicity property, driven over the whole calendar space
    // rather than one pattern, with the count pinned so the size of the defect
    // is on the record and cannot drift silently.
    //
    // ROOT CAUSE. Idle days BEFORE a run exists are free — `lastCoveredDay` is
    // null, so `daysMissedBefore` returns 0 and no offer is made. Idle days
    // INSIDE a live run cost Recovery Days. An extra training day converts the
    // first kind into the second, drains a finite pool, and leaves a later gap
    // uncoverable, so a run dies that would otherwise have survived.
    const initial = createStreakState();
    const LENGTH = MONOTONICITY_MEASUREMENT.CALENDAR_LENGTH;
    const noGrants = Array.from({ length: LENGTH }, () => false);
    const counts: number[] = [];
    let worstDeficit = 0;
    let violationsAgainstZeroSpend = 0;

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
          if (lazy.recoveryDaysSpent === 0) violationsAgainstZeroSpend += 1;
        }
      }
      counts.push(violations);
    }

    expect(counts).toEqual([
      MONOTONICITY_MEASUREMENT.VIOLATIONS_OPENING_DAILY,
      MONOTONICITY_MEASUREMENT.VIOLATIONS_OPENING_ON_TRAINING_DAYS,
    ]);
    expect(worstDeficit).toBe(MONOTONICITY_MEASUREMENT.WORST_DEFICIT);
    // Every violation involves a comparator that ALSO spent. None of them
    // reach the invariant the user asked for, which is why that one passes.
    expect(violationsAgainstZeroSpend).toBe(
      MONOTONICITY_MEASUREMENT.VIOLATIONS_AGAINST_A_ZERO_SPEND_COMPARATOR,
    );
  });

  it('A STREAK READ OFF AN UNOPENED STATE IS STALE, so two states settled to different days must not be compared', () => {
    // This test exists because the defect above is easy to over-count. A run
    // that has already died stays on the state, at full length, until somebody
    // opens the day and settles it. Read `currentStreak` off a state nobody has
    // opened since the last session and it reports a streak the player does not
    // have.
    //
    // The pair below looks like a monotonicity violation — the player who
    // trained MORE reads 1 while the one who trained less reads 3 — and is not
    // one. Both runs are equally dead; only one of them has been told.
    const initial = createStreakState();
    const parse = (pattern: string): boolean[] => [...pattern].map((c) => c === 'T');
    const trainedMore = parse('T..T.T.T.....');
    const trainedLess = parse('...T.T.T.....');
    const noGrants = Array.from({ length: trainedMore.length }, () => false);

    const staleMore = simulate(trainedMore, noGrants, 'accept', initial, 'on-training-days', false);
    const staleLess = simulate(trainedLess, noGrants, 'accept', initial, 'on-training-days', false);
    expect(staleMore.state.currentStreak).toBe(1);
    expect(staleLess.state.currentStreak).toBe(3);

    // Both last trained on day 7 of a 13-day calendar, so both have missed far
    // more than the guardrails can cover. Open the day and the difference goes.
    expect(staleMore.state.lastTrainedDay).toBe(staleLess.state.lastTrainedDay);
    const settledMore = simulate(trainedMore, noGrants, 'accept', initial, 'on-training-days', true);
    const settledLess = simulate(trainedLess, noGrants, 'accept', initial, 'on-training-days', true);
    expect(settledMore.state.currentStreak).toBe(0);
    expect(settledLess.state.currentStreak).toBe(0);
    expect(settledMore.state.lastTrainedDay).toBeNull();
    expect(settledLess.state.lastTrainedDay).toBeNull();
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
