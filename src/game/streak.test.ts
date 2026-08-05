import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  LONGEST_REPAIRABLE_ABSENCE_DAYS,
  RECOVERY_DAY_ECONOMY,
  RECOVERY_DAY_GRANT_AMOUNT,
  RECOVERY_DAY_GUARDRAILS,
  RECOVERY_DAY_OUTCOME_KEYS,
  RECOVERY_DAY_PROTECTION,
  RECOVERY_DAY_SOURCES,
  STREAK_DAY_BOUNDARY,
  STREAK_FACT_KEYS,
  STREAK_MILESTONE_DAYS,
  absenceAnchorDay,
  absenceOutcome,
  adoptSignupDay,
  addDays,
  armedGapDays,
  asStreakDay,
  chargeableDaysBefore,
  chargeableGapDays,
  civilDateFromStreakDay,
  coverableGapDays,
  createStreakState,
  daysBetween,
  daysMissedBefore,
  grantRecoveryDays,
  lastDayStreakCanBeSaved,
  openDay,
  recordTrainingDay,
  recoveryDayCapacity,
  recoveryDayGrantAmount,
  setRecoveryDayProtection,
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

/**
 * The day every fixture in this file pretends the account was created on.
 *
 * DAY_ZERO ITSELF, so a lifter who trains on the first day of a simulated
 * calendar has missed nothing, and a lifter who does not is inside a chargeable
 * absence from day one — which is the whole of the signup-day rule (`streak.ts`
 * §1b) and the thing the monotonicity sweeps below are measuring.
 *
 * `stateWithRun` and friends hand this to states whose `lastTrainedDay` is
 * DAY_ZERO or later, so the signup day is never after a recorded session.
 */
const SIGNUP_DAY: StreakDay = DAY_ZERO;

/** A fresh lifter created on `SIGNUP_DAY`. */
function freshState(): StreakState {
  return createStreakState(SIGNUP_DAY);
}

/** GDD §4.4: absences of this many days or fewer cost nothing at all. */
const GRACE = RECOVERY_DAY_GUARDRAILS.FREE_GRACE_GAP_DAYS;

/**
 * The shortest absence that costs a Recovery Day — one day past the free grace.
 *
 * Derived rather than hard-coded, so retuning `FREE_GRACE_GAP_DAYS` moves every
 * test in this file that means "an absence you have to pay for" instead of
 * silently turning them into tests of the free path.
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

/**
 * A state with a live `streakLength`-day run ending on `lastDay`, a set balance,
 * and that balance ARMED — which is what a real session leaves behind.
 *
 * The arming matters: a hand-built state with `armedRecoveryDays: 0` would be a
 * player who trained while holding nothing, and every Recovery Day test built
 * on it would quietly pass by never spending anything.
 */
function stateWithRun(streakLength: number, lastDay: StreakDay, balance: number): StreakState {
  return {
    signupDay: SIGNUP_DAY,
    currentStreak: streakLength,
    longestStreak: streakLength,
    lastTrainedDay: lastDay,
    armedRecoveryDays: balance,
    recoveryDayBalance: balance,
    recoveryDayProtectionEnabled: true,
    hasBankedFirstRecoveryDaySave: false,
  };
}

/**
 * The same, for a player who has declined protection in settings.
 *
 * BUILT THROUGH `setRecoveryDayProtection` RATHER THAN BY HAND, so a test using
 * it exercises the toggle instead of asserting against a state literal that
 * already has the answer written into it.
 */
function unprotectedStateWithRun(streakLength: number, lastDay: StreakDay, balance: number): StreakState {
  return setRecoveryDayProtection(stateWithRun(streakLength, lastDay, balance), false).state;
}

function clone(state: StreakState): StreakState {
  return { ...state };
}

/** Deterministic PRNG (mulberry32) so the property sweeps are reproducible. */
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
    expect(code).toContain('export function absenceOutcome');
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

  it('exposes no manual accept/decline path, because auto-protect replaced it', () => {
    // THE INVERSE OF THE TEST THAT USED TO BE HERE. Before the GDD §4.2 ruling
    // this scan banned `autoApply`; the ruling made auto-protection the default
    // and deleted the prompt, so what must not come back is the prompt.
    //
    // Kept as a source scan rather than a behavioural check because a
    // reintroduced offer flow would be ADDITIVE — every behavioural test here
    // would still pass beside it, and only a scan notices a second path.
    expect(code).not.toMatch(/acceptRecoveryDay|declineRecoveryDay/);
    expect(code).not.toMatch(/RecoveryDayOffer|currentRecoveryDayOffer/);
    expect(code).not.toMatch(/RECOVERY_DECISION_PENDING|OFFER_DOES_NOT_MATCH_STATE/);
  });

  it('resolves an absence from the armed count, never from the live balance', () => {
    // The one-line reason the outcome cannot depend on when the app is opened:
    // a Recovery Day that arrives DURING an absence raises `recoveryDayBalance`,
    // and `absenceOutcome` must not be able to see it. Scanned because the
    // difference is invisible to any test that does not grant mid-absence.
    const body = code.slice(code.indexOf('export function absenceOutcome'));
    const fn = body.slice(0, body.indexOf('\n}\n') + 1);
    expect(fn).toContain('armedGapDays');
    expect(fn).not.toContain('recoveryDayBalance');
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
      expect(civilDateFromStreakDay(asStreakDay(expected))).toEqual({ year, month, day });
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
    for (let i = 0; i < 3653; i += 1) {
      const day = addDays(start, i);
      expect(streakDayFromCivilDate(civilDateFromStreakDay(day))).toBe(day);
    }
  });

  it('consecutive calendar dates are always exactly one day apart', () => {
    // Includes both DST transitions in every year swept, which is the case
    // millisecond division gets wrong.
    const start = streakDayFromCivilDate({ year: 2024, month: 1, day: 1 });
    for (let i = 0; i < 1000; i += 1) {
      const a = addDays(start, i);
      const b = addDays(start, i + 1);
      expect(daysBetween(a, b)).toBe(1);
    }
  });

  it('accepts real leap days and rejects fake ones', () => {
    expect(() => streakDayFromCivilDate({ year: 2024, month: 2, day: 29 })).not.toThrow();
    expect(() => streakDayFromCivilDate({ year: 2000, month: 2, day: 29 })).not.toThrow();
    expect(() => streakDayFromCivilDate({ year: 1900, month: 2, day: 29 })).toThrow(RangeError);
    expect(() => streakDayFromCivilDate({ year: 2023, month: 2, day: 29 })).toThrow(RangeError);
  });

  it('rejects impossible dates', () => {
    expect(() => streakDayFromCivilDate({ year: 2026, month: 13, day: 1 })).toThrow(RangeError);
    expect(() => streakDayFromCivilDate({ year: 2026, month: 0, day: 1 })).toThrow(RangeError);
    expect(() => streakDayFromCivilDate({ year: 2026, month: 4, day: 31 })).toThrow(RangeError);
    expect(() => streakDayFromCivilDate({ year: 2026, month: 1, day: 1.5 })).toThrow(RangeError);
  });

  it('rejects non-integer day indices and offsets', () => {
    expect(() => asStreakDay(1.5)).toThrow(RangeError);
    expect(() => asStreakDay(Number.NaN)).toThrow(RangeError);
    expect(() => addDays(DAY_ZERO, 0.5)).toThrow(RangeError);
  });
});

describe('the day boundary', () => {
  const ROLLOVER = STREAK_DAY_BOUNDARY.ROLLOVER_HOUR_LOCAL;
  const DATE = { year: 2026, month: 8, day: 3 };

  it('puts an hour before the rollover in the previous streak day', () => {
    const late = streakDayFromLocalWallClock({ ...DATE, hour: ROLLOVER - 1 });
    expect(late).toBe(addDays(streakDayFromCivilDate(DATE), -1));
  });

  it('puts the rollover hour itself in the new streak day', () => {
    expect(streakDayFromLocalWallClock({ ...DATE, hour: ROLLOVER })).toBe(streakDayFromCivilDate(DATE));
    expect(streakDayFromLocalWallClock({ ...DATE, hour: 23 })).toBe(streakDayFromCivilDate(DATE));
  });

  it('keeps a whole 24-hour span inside exactly two streak days', () => {
    const seen = new Set<number>();
    for (let hour = 0; hour <= 23; hour += 1) {
      seen.add(streakDayFromLocalWallClock({ ...DATE, hour }));
    }
    expect(seen.size).toBe(2);
  });

  it('rejects hours outside 0-23', () => {
    expect(() => streakDayFromLocalWallClock({ ...DATE, hour: 24 })).toThrow(RangeError);
    expect(() => streakDayFromLocalWallClock({ ...DATE, hour: -1 })).toThrow(RangeError);
    expect(() => streakDayFromLocalWallClock({ ...DATE, hour: 9.5 })).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

describe('tunable constants sit inside the ranges GDD §4.2 specifies', () => {
  const source = readFileSync(fileURLToPath(new URL('./streak.ts', import.meta.url)), 'utf8');

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

  it('defines the free grace and the consecutive-use limit as two independent literals', () => {
    // A HUMAN REQUIRED THESE TO STAY SEPARATE (GDD §4.2, §4.4), and the old
    // version of this test could not tell whether they were: it checked only
    // that the grace was a whole number in range, so
    // `FREE_GRACE_GAP_DAYS: MAX_CONSECUTIVE_USES` would have sailed through it,
    // and so would any other definition of one in terms of the other.
    //
    // NO BEHAVIOURAL TEST CAN CATCH THAT, which is why this one reads the
    // source. The two constants are both 2 today, so a build where one IS the
    // other behaves identically in every respect — the difference is only
    // visible in the text, and only becomes behavioural the day somebody
    // retunes one of them and silently moves the other.
    const block = source.slice(
      source.indexOf('export const RECOVERY_DAY_GUARDRAILS'),
      source.indexOf('export const RECOVERY_DAY_PROTECTION'),
    );
    const literal = (name: string): string => {
      const match = new RegExp(`\\n  ${name}:\\s*([^,\\n]+),`).exec(block);
      if (match === null) throw new Error(`could not find ${name} in RECOVERY_DAY_GUARDRAILS`);
      return (match[1] as string).trim();
    };
    expect(literal('FREE_GRACE_GAP_DAYS')).toMatch(/^\d+$/);
    expect(literal('MAX_CONSECUTIVE_USES')).toMatch(/^\d+$/);

    // ...and the shape checks the old test did keep, since they are still true
    // and still worth failing on.
    expect(Number.isInteger(GRACE)).toBe(true);
    expect(GRACE).toBeGreaterThanOrEqual(0);
    expect(GRACE).toBeLessThan(RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    expect(RECOVERY_DAY_GUARDRAILS.MAX_CONSECUTIVE_USES).toBeGreaterThanOrEqual(1);
  });

  it('gives the two constants different jobs, checked by behaviour as well as by text', () => {
    // The grace is what a player with NOTHING ARMED still gets; the
    // consecutive-use limit is what caps what an armed player can buy. Holding
    // the armed count at 0 isolates the first, holding it at the hold cap
    // isolates the second.
    const bare = { ...stateWithRun(9, DAY_ZERO, 0), armedRecoveryDays: 0 };
    expect(coverableGapDays(bare)).toBe(GRACE);
    expect(openDay(bare, dayAfterGap(DAY_ZERO, GRACE)).kind).toBe('gap-covered-by-grace');
    expect(openDay(bare, dayAfterGap(DAY_ZERO, GRACE + 1)).kind).toBe('streak-broken');

    const armed = stateWithRun(9, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    expect(armedGapDays(armed)).toBe(RECOVERY_DAY_GUARDRAILS.MAX_CONSECUTIVE_USES);
    expect(coverableGapDays(armed)).toBe(GRACE + RECOVERY_DAY_GUARDRAILS.MAX_CONSECUTIVE_USES);
  });

  it('sets the longest repairable absence to the grace plus the consecutive-use limit', () => {
    expect(LONGEST_REPAIRABLE_ABSENCE_DAYS).toBe(GRACE + RECOVERY_DAY_GUARDRAILS.MAX_CONSECUTIVE_USES);
    const state = stateWithRun(50, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    expect(coverableGapDays(state)).toBe(LONGEST_REPAIRABLE_ABSENCE_DAYS);
    expect(openDay(state, dayAfterGap(DAY_ZERO, LONGEST_REPAIRABLE_ABSENCE_DAYS)).kind).toBe(
      'gap-covered-by-recovery-days',
    );
    expect(openDay(state, dayAfterGap(DAY_ZERO, LONGEST_REPAIRABLE_ABSENCE_DAYS + 1)).kind).toBe(
      'streak-broken',
    );
    // A week away is the thing the consecutive-use guardrail exists to refuse.
    expect(LONGEST_REPAIRABLE_ABSENCE_DAYS).toBeLessThan(7);
  });

  it('charges only the days past the grace', () => {
    for (let gap = 0; gap <= GRACE; gap += 1) {
      expect(chargeableGapDays(gap)).toBe(0);
    }
    for (let extra = 1; extra <= 5; extra += 1) {
      expect(chargeableGapDays(GRACE + extra)).toBe(extra);
    }
  });

  it('gives every absence its own full grace, because nothing is banked between them', () => {
    // The per-absence rule GDD §4.4 asked for, now structural rather than
    // maintained: there is no coverage marker to measure a partly-spent grace
    // from, so the only thing that can vary is the length of the absence.
    const fresh = stateWithRun(9, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    expect(chargeableDaysBefore(fresh, dayAfterGap(DAY_ZERO, GRACE))).toBe(0);
    expect(chargeableDaysBefore(fresh, dayAfterGap(DAY_ZERO, GRACE + 1))).toBe(1);

    // Bank a save, then train: the next absence gets the whole grace again.
    const backOn = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    const afterSave = unwrap(recordTrainingDay(fresh, backOn));
    expect(afterSave.recoveryDaySave?.recoveryDaysSpent).toBe(1);
    expect(chargeableDaysBefore(afterSave.state, dayAfterGap(backOn, GRACE))).toBe(0);
  });

  it('defaults Recovery Day protection to on', () => {
    // GDD §4.2's ruling: holding at least one Recovery Day means protected, with
    // no arming step before each individual miss.
    expect(RECOVERY_DAY_PROTECTION.DEFAULT_ENABLED).toBe(true);
    expect(freshState().recoveryDayProtectionEnabled).toBe(true);
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
  it('starts with no run, the signup grant credited, protection on AND ARMED', () => {
    const state = freshState();
    expect(state.signupDay).toBe(SIGNUP_DAY);
    expect(state.currentStreak).toBe(0);
    expect(state.longestStreak).toBe(0);
    expect(state.lastTrainedDay).toBeNull();
    expect(state.recoveryDayBalance).toBe(RECOVERY_DAY_ECONOMY.SIGNUP_GRANT);
    expect(state.recoveryDayProtectionEnabled).toBe(true);
    // ARMED, WHERE THIS USED TO ASSERT `null`. The signup day is an anchor like
    // any other, so the absence after it is chargeable like any other, so the
    // signup grant has to be armed against it. `streak.ts` §1b and §6.
    expect(state.armedRecoveryDays).toBe(RECOVERY_DAY_ECONOMY.SIGNUP_GRANT);
    expect(state.hasBankedFirstRecoveryDaySave).toBe(false);
  });

  it('shows "no active streak" until the first session', () => {
    expect(openDay(freshState(), DAY_ZERO)).toEqual({ kind: 'no-active-streak', longestStreak: 0 });
  });

  it('is inside a chargeable absence from the signup day, not outside the system', () => {
    // THE HEART OF THE SIGNUP-DAY RULE. Idle days before a lifter's first
    // session used to be free — `daysMissedBefore` returned 0 with no
    // `lastTrainedDay` to measure from — and that free lunch is what let a
    // player who trained one MORE day end on a shorter streak (§6).
    const state = freshState();
    expect(absenceAnchorDay(state)).toBe(SIGNUP_DAY);
    expect(daysMissedBefore(state, addDays(SIGNUP_DAY, 400))).toBe(399);
    expect(absenceOutcome(state, addDays(SIGNUP_DAY, 400)).protectionHolds).toBe(false);

    // The grace still applies to it, so a lifter who starts within a few days of
    // signing up pays nothing.
    expect(chargeableDaysBefore(state, addDays(SIGNUP_DAY, GRACE + 1))).toBe(0);
    expect(absenceOutcome(state, addDays(SIGNUP_DAY, GRACE + 1)).recoveryDaysConsumed).toBe(0);
  });

  it('has no run to break and therefore no deadline, even though the absence is real', () => {
    const state = freshState();
    // These read a RUN, and there is not one. They are keyed on `lastTrainedDay`
    // rather than the anchor on purpose: "train by here or the streak ends" is
    // a sentence about a streak that exists.
    expect(streakDeadlineDay(state)).toBeNull();
    expect(lastDayStreakCanBeSaved(state)).toBeNull();
    expect(errorCodeOf(settleBrokenStreak(state, addDays(SIGNUP_DAY, 400)))).toBe('NOTHING_TO_SETTLE');
  });

  it('MIGRATION: adoptSignupDay writes the anchor, and refuses one that postdates a session', () => {
    // Accounts created before the field existed do not carry a signup day, and
    // `StreakState.signupDay` is deliberately non-nullable so that an
    // un-backfilled account cannot silently keep the old free-lunch behaviour.
    // This is the one door a backfill goes through.
    const migrated = unwrap(adoptSignupDay(stateWithRun(9, addDays(DAY_ZERO, 30), 2), DAY_ZERO));
    expect(migrated.signupDay).toBe(DAY_ZERO);
    // Nothing else moved. A migration is not a transition.
    expect({ ...migrated, signupDay: SIGNUP_DAY }).toEqual(stateWithRun(9, addDays(DAY_ZERO, 30), 2));

    // AN ACCOUNT CANNOT HAVE BEEN CREATED AFTER A SESSION WAS RECORDED ON IT.
    // The trained day would win the anchor, so the stored value would be a lie
    // nobody ever reads — which is worse than a refusal, not better.
    const late = adoptSignupDay(stateWithRun(9, DAY_ZERO, 2), addDays(DAY_ZERO, 1));
    expect(errorCodeOf(late)).toBe('SIGNUP_DAY_AFTER_TRAINING');

    // The same day as the last session is fine: a lifter who trained on the day
    // they signed up.
    expect(unwrap(adoptSignupDay(stateWithRun(9, DAY_ZERO, 2), DAY_ZERO)).signupDay).toBe(DAY_ZERO);
    // And a lifter with no run can be anchored anywhere, because there is no
    // session for the day to contradict.
    const noRun = unwrap(adoptSignupDay(freshState(), addDays(DAY_ZERO, 900)));
    expect(noRun.signupDay).toBe(addDays(DAY_ZERO, 900));
  });

  it('MIGRATION: the adopted day is what the absence is then measured from', () => {
    // The point of backfilling at all. A state anchored late has a short
    // absence behind it; the same state anchored early has a long one, and the
    // difference is exactly what the lifter is charged for.
    const legacy = freshState();
    const today = addDays(DAY_ZERO, 10);

    const anchoredEarly = unwrap(adoptSignupDay(legacy, DAY_ZERO));
    const anchoredLate = unwrap(adoptSignupDay(legacy, addDays(DAY_ZERO, 9)));

    expect(daysMissedBefore(anchoredEarly, today)).toBe(9);
    expect(daysMissedBefore(anchoredLate, today)).toBe(0);
    expect(absenceOutcome(anchoredEarly, today).protectionHolds).toBe(false);
    expect(absenceOutcome(anchoredLate, today).protectionHolds).toBe(true);
  });

  it('loses the signup grant to an absence that outran it, and reports the loss', () => {
    // The visible cost of charging both sides, pinned rather than left for a
    // player to discover: sign up, do not train for longer than the ceiling,
    // and the signup Recovery Days are gone when you finally do.
    const late = dayAfterGap(SIGNUP_DAY, LONGEST_REPAIRABLE_ABSENCE_DAYS + 1);
    const outcome = unwrap(recordTrainingDay(freshState(), late));
    expect(outcome.recoveryDaysLostToTheAbsence).toBe(RECOVERY_DAY_ECONOMY.SIGNUP_GRANT);
    expect(outcome.state.recoveryDayBalance).toBe(0);
    expect(outcome.recoveryDaySave).toBeNull();
    // No run died — there was not one — so nothing claims one did.
    expect(outcome.endedRunLength).toBe(0);
    expect(outcome.streakAfter).toBe(1);

    // ...and a lifter who starts inside the ceiling keeps everything.
    const prompt = dayAfterGap(SIGNUP_DAY, LONGEST_REPAIRABLE_ABSENCE_DAYS);
    const kept = unwrap(recordTrainingDay(freshState(), prompt));
    expect(kept.recoveryDaysLostToTheAbsence).toBe(0);
    expect(kept.state.recoveryDayBalance).toBe(
      RECOVERY_DAY_ECONOMY.SIGNUP_GRANT - RECOVERY_DAY_GUARDRAILS.MAX_CONSECUTIVE_USES,
    );
  });

  it('arms whatever is held at the first session', () => {
    const outcome = unwrap(recordTrainingDay(freshState(), DAY_ZERO));
    expect(outcome.armedForNextAbsence).toBe(RECOVERY_DAY_ECONOMY.SIGNUP_GRANT);
    expect(outcome.state.armedRecoveryDays).toBe(RECOVERY_DAY_ECONOMY.SIGNUP_GRANT);
  });
});

describe('streak increments', () => {
  it('counts 1 on the first training day', () => {
    const outcome = unwrap(recordTrainingDay(freshState(), DAY_ZERO));
    expect(outcome.streakAfter).toBe(1);
    expect(outcome.state.currentStreak).toBe(1);
    expect(outcome.state.longestStreak).toBe(1);
    expect(outcome.isNewLongestStreak).toBe(true);
    expect(outcome.previousRunEnded).toBe(false);
    expect(outcome.recoveryDaySave).toBeNull();
  });

  it('increments by exactly one per consecutive day', () => {
    let state: StreakState = freshState();
    for (let i = 0; i < 40; i += 1) {
      state = unwrap(recordTrainingDay(state, addDays(DAY_ZERO, i))).state;
      expect(state.currentStreak).toBe(i + 1);
      expect(state.longestStreak).toBe(i + 1);
    }
  });

  it('reports the run as alive on the next day, with the deadline', () => {
    const state = trainConsecutively(freshState(), DAY_ZERO, 5);
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
    const state = trainConsecutively(freshState(), DAY_ZERO, 3);
    expect(errorCodeOf(recordTrainingDay(state, addDays(DAY_ZERO, 2)))).toBe('ALREADY_TRAINED_TODAY');
    expect(openDay(state, addDays(DAY_ZERO, 2))).toEqual({ kind: 'already-trained-today', currentStreak: 3 });
  });

  it('refuses a day already accounted for', () => {
    const state = trainConsecutively(freshState(), DAY_ZERO, 3);
    expect(errorCodeOf(recordTrainingDay(state, addDays(DAY_ZERO, 1)))).toBe('DAY_IN_PAST');
    expect(openDay(state, addDays(DAY_ZERO, 1))).toEqual({
      kind: 'day-in-past',
      requestedDay: addDays(DAY_ZERO, 1),
      lastTrainedDay: addDays(DAY_ZERO, 2),
    });
  });
});

describe('streak breaks', () => {
  it('breaks on a chargeable absence when nothing is armed', () => {
    const state = { ...stateWithRun(6, addDays(DAY_ZERO, 5), 0), armedRecoveryDays: 0 };
    const opening = openDay(state, dayAfterGap(addDays(DAY_ZERO, 5), SHORTEST_PAID_GAP));
    expect(opening).toEqual({
      kind: 'streak-broken',
      brokenRunLength: 6,
      daysMissed: SHORTEST_PAID_GAP,
      reason: 'not-enough-recovery-days-armed',
      recoveryDayBalance: 0,
      recoveryDaysCommittedToTheAbsence: 0,
    });
  });

  it('starts a new run at 1 when training after an uncoverable absence', () => {
    const state = { ...stateWithRun(6, addDays(DAY_ZERO, 5), 0), armedRecoveryDays: 0 };
    const outcome = unwrap(
      recordTrainingDay(state, dayAfterGap(addDays(DAY_ZERO, 5), SHORTEST_PAID_GAP)),
    );
    expect(outcome.previousRunEnded).toBe(true);
    expect(outcome.endedRunLength).toBe(6);
    expect(outcome.endedRunReason).toBe('not-enough-recovery-days-armed');
    expect(outcome.streakAfter).toBe(1);
    expect(outcome.state.currentStreak).toBe(1);
    expect(outcome.state.longestStreak).toBe(6);
    expect(outcome.state.recoveryDayBalance).toBe(0);
    expect(outcome.recoveryDaySave).toBeNull();
  });

  it('CHARGES the armed Recovery Days for an absence that ended the run, and calls it a loss not a save', () => {
    // THIS TEST USED TO ASSERT THE OPPOSITE — that a break took nothing — and
    // the reversal is measured rather than preferred. A doomed absence that
    // costs nothing is a free absence, and an extra training day inside one
    // splits it into two absences that are NOT free, so the player who trained
    // more paid more. `streak.ts` §5 and §6.
    const state = stateWithRun(20, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    const outcome = unwrap(recordTrainingDay(state, addDays(DAY_ZERO, 10)));
    expect(outcome.previousRunEnded).toBe(true);
    expect(outcome.recoveryDaysLostToTheAbsence).toBe(RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    expect(outcome.state.recoveryDayBalance).toBe(0);
    expect(outcome.state.currentStreak).toBe(1);
    // A LOSS IS NOT A SAVE. Nothing was saved, so no save is reported and the
    // GDD §4.3 teaching moment is not burned on it.
    expect(outcome.recoveryDaySave).toBeNull();
    expect(outcome.state.hasBankedFirstRecoveryDaySave).toBe(false);
  });

  it('charges nothing for a doomed absence when nothing was armed against it', () => {
    const state = { ...stateWithRun(20, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP), armedRecoveryDays: 0 };
    const outcome = unwrap(recordTrainingDay(state, addDays(DAY_ZERO, 10)));
    expect(outcome.previousRunEnded).toBe(true);
    expect(outcome.recoveryDaysLostToTheAbsence).toBe(0);
    expect(outcome.state.recoveryDayBalance).toBe(RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
  });

  it('charges nothing for a doomed absence when the player declined protection', () => {
    // The GDD §4.2 toggle still means "no Recovery Day of mine is ever spent",
    // and that has to survive the charge-on-doom rule or the toggle is a lie.
    const state = unprotectedStateWithRun(20, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    const outcome = unwrap(recordTrainingDay(state, addDays(DAY_ZERO, 10)));
    expect(outcome.previousRunEnded).toBe(true);
    expect(outcome.recoveryDaysLostToTheAbsence).toBe(0);
    expect(outcome.state.recoveryDayBalance).toBe(RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
  });

  it('charges the doomed absence exactly once, however many times it is settled first', () => {
    // The debit lives on the training day that ends the absence, NOT on the
    // settle, so settling early, late, repeatedly or never cannot move it.
    const state = stateWithRun(20, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    const back = addDays(DAY_ZERO, 10);

    let settled: StreakState = state;
    for (let offset = SHORTEST_PAID_GAP + 1; offset < 10; offset += 1) {
      const result = settleBrokenStreak(settled, addDays(DAY_ZERO, offset));
      if (result.ok) settled = result.value.state;
    }
    // Settling moved no balance and kept the commitment.
    expect(settled.recoveryDayBalance).toBe(RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    expect(settled.armedRecoveryDays).toBe(RECOVERY_DAY_GUARDRAILS.HOLD_CAP);

    const never = unwrap(recordTrainingDay(state, back));
    const early = unwrap(recordTrainingDay(settled, back));
    expect(early.state).toEqual(never.state);
    expect(early.recoveryDaysLostToTheAbsence).toBe(never.recoveryDaysLostToTheAbsence);
  });

  it('settles a break without waiting for the next session, and takes nothing for it', () => {
    const state = { ...stateWithRun(20, DAY_ZERO, 0), armedRecoveryDays: 0 };
    const outcome = unwrap(settleBrokenStreak(state, dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP)));
    expect(outcome.endedRunLength).toBe(20);
    expect(outcome.daysMissed).toBe(SHORTEST_PAID_GAP);
    expect(outcome.balanceAfter).toBe(0);
    expect(outcome.reason).toBe('not-enough-recovery-days-armed');
    expect(outcome.state.currentStreak).toBe(0);
    expect(outcome.state.lastTrainedDay).toBeNull();
    expect(outcome.state.longestStreak).toBe(20);
  });

  it('refuses to settle an intact run', () => {
    const state = stateWithRun(4, DAY_ZERO, 0);
    expect(errorCodeOf(settleBrokenStreak(state, addDays(DAY_ZERO, 1)))).toBe('NOTHING_TO_SETTLE');
    expect(errorCodeOf(settleBrokenStreak(state, DAY_ZERO))).toBe('NOTHING_TO_SETTLE');
  });

  it('refuses to settle an absence the free grace covers, even with an empty balance', () => {
    const state = { ...stateWithRun(4, DAY_ZERO, 0), armedRecoveryDays: 0 };
    for (let gap = 1; gap <= GRACE; gap += 1) {
      expect(errorCodeOf(settleBrokenStreak(state, dayAfterGap(DAY_ZERO, gap)))).toBe('NOTHING_TO_SETTLE');
    }
    expect(errorCodeOf(settleBrokenStreak(state, dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP)))).toBe('OK');
  });

  it('refuses to settle an absence Recovery Days are holding open', () => {
    // The mirror of the old "do not auto-decline" rule: a run the armed Recovery
    // Days are covering is not broken, so settling it would end a run the player
    // still has.
    const state = stateWithRun(4, DAY_ZERO, 2);
    expect(errorCodeOf(settleBrokenStreak(state, dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP)))).toBe(
      'NOTHING_TO_SETTLE',
    );
  });

  it('keeps the longest streak across a break', () => {
    let state: StreakState = {
      ...trainConsecutively(freshState(), DAY_ZERO, 12),
      recoveryDayBalance: 0,
      armedRecoveryDays: 0,
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
  it('keeps a run alive across a short absence without touching the balance', () => {
    // Nothing armed, so nothing but the grace can be doing the work. If the
    // grace were removed this run would be dead at every absence length below.
    for (let gap = 1; gap <= GRACE; gap += 1) {
      const state = { ...stateWithRun(9, DAY_ZERO, 0), armedRecoveryDays: 0 };
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
      expect(outcome.recoveryDaySave).toBeNull();
    }
  });

  it('spends nothing for an absence it covers, at any balance', () => {
    for (let balance = 0; balance <= RECOVERY_DAY_GUARDRAILS.HOLD_CAP; balance += 1) {
      for (let gap = 1; gap <= GRACE; gap += 1) {
        const state = stateWithRun(9, DAY_ZERO, balance);
        const backOn = dayAfterGap(DAY_ZERO, gap);
        expect(openDay(state, backOn).kind).toBe('gap-covered-by-grace');
        const outcome = unwrap(recordTrainingDay(state, backOn));
        expect(outcome.recoveryDaySave).toBeNull();
        expect(outcome.state.recoveryDayBalance).toBe(balance);
      }
    }
  });

  it('applies even to a player who has declined Recovery Day protection', () => {
    // The toggle declines SPENDING. The grace spends nothing, so there is
    // nothing in it to decline and GDD §4.4's ruling stands on its own.
    for (let gap = 1; gap <= GRACE; gap += 1) {
      const declined = unprotectedStateWithRun(9, DAY_ZERO, 3);
      const backOn = dayAfterGap(DAY_ZERO, gap);
      expect(openDay(declined, backOn).kind).toBe('gap-covered-by-grace');
      expect(unwrap(recordTrainingDay(declined, backOn)).streakAfter).toBe(10);
    }
  });

  it('does not consume the first-save moment, because nothing was saved', () => {
    // GDD §4.3 fires on the first save the player is actually given. An absence
    // that cost nothing is not that moment, so the flag must survive it.
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    const trained = unwrap(recordTrainingDay(state, dayAfterGap(DAY_ZERO, GRACE))).state;
    expect(trained.hasBankedFirstRecoveryDaySave).toBe(false);
    const later = openDay(trained, dayAfterGap(trained.lastTrainedDay as StreakDay, SHORTEST_PAID_GAP));
    if (later.kind !== 'gap-covered-by-recovery-days') throw new Error('expected a Recovery Day save');
    expect(later.isFirstRecoveryDaySave).toBe(true);
  });

  it('stops exactly one day past the grace, where the first Recovery Day is charged', () => {
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    expect(openDay(state, dayAfterGap(DAY_ZERO, GRACE)).kind).toBe('gap-covered-by-grace');

    const opening = openDay(state, dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP));
    if (opening.kind !== 'gap-covered-by-recovery-days') throw new Error('expected a Recovery Day save');
    expect(opening.recoveryDaysHolding).toBe(1);
    expect(opening.daysCoveredFreeByGrace).toBe(GRACE);
    expect(opening.daysMissed).toBe(SHORTEST_PAID_GAP);
    expect(opening.balanceIfBankedToday).toBe(RECOVERY_DAY_GUARDRAILS.HOLD_CAP - 1);
  });

  it('is recomputed from the absence rather than banked, so it never runs out', () => {
    // The grace is not a consumable and has no counter. A player who trains one
    // day in every GRACE + 1 holds a run open forever, spending nothing. This is
    // the accepted cost of the §4.4 ruling, pinned so it is on the record rather
    // than discovered in playtesting.
    const CYCLES = 40;
    let state: StreakState = { ...freshState(), recoveryDayBalance: 0 };
    let day = DAY_ZERO;
    let trainedDays = 0;

    for (let cycle = 0; cycle < CYCLES; cycle += 1) {
      const opening = openDay(state, day);
      expect(opening.kind).not.toBe('streak-broken');
      expect(opening.kind).not.toBe('gap-covered-by-recovery-days');
      state = unwrap(recordTrainingDay(state, day)).state;
      trainedDays += 1;
      day = addDays(day, SHORTEST_PAID_GAP);
    }

    expect(state.currentStreak).toBe(trainedDays);
    expect(state.recoveryDayBalance).toBe(
      STREAK_MILESTONE_DAYS.filter((m) => m <= trainedDays).length *
        RECOVERY_DAY_ECONOMY.STREAK_MILESTONE_GRANT,
    );
  });

  it('extends the run without extending the count — a covered day is not a trained day', () => {
    let state: StreakState = { ...freshState(), recoveryDayBalance: 0 };
    let day = DAY_ZERO;
    let sessions = 0;
    let milestoneAtSessions = -1;
    while (milestoneAtSessions < 0 && sessions < 40) {
      const outcome = unwrap(recordTrainingDay(state, day));
      state = outcome.state;
      sessions += 1;
      if (outcome.milestonesReached.includes(7)) milestoneAtSessions = sessions;
      day = addDays(day, GRACE + 1);
    }
    expect(milestoneAtSessions).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// GDD §4.2 — auto-protection and the return-visit reveal
// ---------------------------------------------------------------------------

describe('Recovery Day protection: armed ahead, revealed on return', () => {
  it('reveals the save on the return visit, describing the whole thing', () => {
    const state = stateWithRun(9, DAY_ZERO, 3);
    const day = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    // AN EXHAUSTIVE `toEqual`, so a field added to the reveal without a decision
    // about whether the screen should show it fails here rather than shipping.
    expect(openDay(state, day)).toEqual({
      kind: 'gap-covered-by-recovery-days',
      currentStreak: 9,
      streakIfTrainedToday: 10,
      daysMissed: SHORTEST_PAID_GAP,
      daysCoveredFreeByGrace: GRACE,
      recoveryDaysHolding: 1,
      balanceIfBankedToday: 2,
      lastDayStreakCanBeSaved: addDays(DAY_ZERO, 1 + coverableGapDays(state)),
      isFirstRecoveryDaySave: true,
    });
  });

  it('is news, not a question: nothing is pending and nothing can be answered', () => {
    // The structural half of GDD §4.2's ruling. Reading the reveal changes
    // nothing, and — unlike the prompt it replaced — a session can be recorded
    // straight through it without answering anything first.
    const state = stateWithRun(9, DAY_ZERO, 3);
    const before = clone(state);
    const day = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    for (let i = 0; i < 5; i += 1) {
      expect(openDay(state, day).kind).toBe('gap-covered-by-recovery-days');
    }
    expect(state).toEqual(before);
    expect(errorCodeOf(recordTrainingDay(state, day))).toBe('OK');
  });

  it('says the same thing on every day of the absence, however late the player looks', () => {
    // The reveal is the same news whether they open on the first chargeable day
    // or on the last one it can still be told: the run protected, the runway,
    // and the fact that Recovery Days are holding it. Only the day count moves.
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    const runway = lastDayStreakCanBeSaved(state) as StreakDay;
    let revealsSeen = 0;
    for (let gap = SHORTEST_PAID_GAP; gap <= LONGEST_REPAIRABLE_ABSENCE_DAYS; gap += 1) {
      const opening = openDay(state, dayAfterGap(DAY_ZERO, gap));
      if (opening.kind !== 'gap-covered-by-recovery-days') throw new Error(`no reveal at gap ${gap}`);
      revealsSeen += 1;
      expect(opening.currentStreak).toBe(9);
      expect(opening.daysMissed).toBe(gap);
      expect(opening.daysCoveredFreeByGrace).toBe(GRACE);
      expect(opening.recoveryDaysHolding).toBe(gap - GRACE);
      expect(opening.lastDayStreakCanBeSaved).toBe(runway);
    }
    expect(revealsSeen).toBe(RECOVERY_DAY_GUARDRAILS.MAX_CONSECUTIVE_USES);
  });

  it('banks the save on the training day, spending exactly what was holding the run', () => {
    const state = stateWithRun(9, DAY_ZERO, 3);
    const day = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    const outcome = unwrap(recordTrainingDay(state, day));
    expect(outcome.recoveryDaySave).toEqual({
      coveredDays: Array.from({ length: SHORTEST_PAID_GAP }, (_, i) => addDays(DAY_ZERO, i + 1)),
      daysCoveredFreeByGrace: GRACE,
      recoveryDaysSpent: 1,
      balanceAfter: 2,
      streakProtected: 9,
      wasFirstRecoveryDaySave: true,
    });
    expect(outcome.streakAfter).toBe(10);
    expect(outcome.previousRunEnded).toBe(false);
    expect(outcome.state.recoveryDayBalance).toBe(2);
    // ...and the next absence is armed with what is left, not with what was held.
    expect(outcome.state.armedRecoveryDays).toBe(2);
  });

  it('covers a longer absence in one go, charging only the days past the grace', () => {
    const state = stateWithRun(9, DAY_ZERO, 5);
    const gap = GRACE + 2;
    const outcome = unwrap(recordTrainingDay(state, dayAfterGap(DAY_ZERO, gap)));
    expect(outcome.recoveryDaySave?.recoveryDaysSpent).toBe(2);
    expect(outcome.recoveryDaySave?.daysCoveredFreeByGrace).toBe(GRACE);
    expect(outcome.recoveryDaySave?.coveredDays).toEqual(
      Array.from({ length: gap }, (_, i) => addDays(DAY_ZERO, i + 1)),
    );
  });

  it('never covers PART of an absence: too long means the run ends, and the armed Recovery Days go with it', () => {
    // GDD §4.2's all-or-nothing, which is about COVERAGE and still holds: there
    // is no half-saved run. The CHARGE is no longer all-or-nothing, and §5 of
    // `streak.ts` says why it had to stop being.
    //
    // Armed 1, chargeable 2. The run ends — one Recovery Day was never going to
    // buy two days — and the Recovery Day that was armed against the absence is
    // spent, because it was committed to it.
    const state = stateWithRun(9, DAY_ZERO, 1);
    const gap = GRACE + 2;
    const day = dayAfterGap(DAY_ZERO, gap);
    expect(openDay(state, day)).toEqual({
      kind: 'streak-broken',
      brokenRunLength: 9,
      daysMissed: gap,
      reason: 'not-enough-recovery-days-armed',
      // Held right now: the break itself moves nothing.
      recoveryDayBalance: 1,
      // ...and what the next session will take for it.
      recoveryDaysCommittedToTheAbsence: 1,
    });
    const outcome = unwrap(recordTrainingDay(state, day));
    // NO SAVE, because nothing was saved. The distinction is the whole reason
    // `recoveryDaysLostToTheAbsence` is a separate field.
    expect(outcome.recoveryDaySave).toBeNull();
    expect(outcome.recoveryDaysLostToTheAbsence).toBe(1);
    expect(outcome.state.recoveryDayBalance).toBe(0);
    expect(outcome.streakAfter).toBe(1);
  });

  it('cannot be armed by a Recovery Day that arrives during the absence', () => {
    // "ARM AHEAD" IN ONE TEST, and the reason the outcome cannot depend on when
    // the player opens the app: a GDD §4.2 Gym Empire drop lands on a check-in,
    // so a grant that armed would be coverage bought by looking.
    const broke = { ...stateWithRun(9, DAY_ZERO, 0), armedRecoveryDays: 0 };
    const day = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    expect(openDay(broke, day).kind).toBe('streak-broken');

    const toppedUp = unwrap(grantRecoveryDays(broke, { source: 'gym-empire' })).state;
    expect(toppedUp.recoveryDayBalance).toBe(1);
    expect(toppedUp.armedRecoveryDays).toBe(0);
    expect(openDay(toppedUp, day).kind).toBe('streak-broken');

    // It arms the NEXT absence, which is what makes it worth having.
    const restarted = unwrap(recordTrainingDay(toppedUp, day)).state;
    expect(restarted.armedRecoveryDays).toBe(1);
    expect(openDay(restarted, dayAfterGap(day, SHORTEST_PAID_GAP)).kind).toBe(
      'gap-covered-by-recovery-days',
    );
  });

  it('keeps the runway fixed for the whole absence, so reminder copy cannot change its mind', () => {
    let sweptStates = 0;
    for (let balance = 0; balance <= RECOVERY_DAY_GUARDRAILS.HOLD_CAP; balance += 1) {
      const state = stateWithRun(9, DAY_ZERO, balance);
      const runway = lastDayStreakCanBeSaved(state) as StreakDay;
      // Ground truth: the last day `openDay` does NOT report a break.
      let lastAlive = DAY_ZERO;
      for (let offset = 1; offset <= 20; offset += 1) {
        const day = addDays(DAY_ZERO, offset);
        if (openDay(state, day).kind === 'streak-broken') break;
        lastAlive = day;
      }
      expect(runway).toBe(lastAlive);
      expect(coverableGapDays(state)).toBe(daysBetween(DAY_ZERO, lastAlive) - 1);
      sweptStates += 1;
    }
    expect(sweptStates).toBe(RECOVERY_DAY_GUARDRAILS.HOLD_CAP + 1);
  });
});

// ---------------------------------------------------------------------------
// GDD §4.2 — the settings toggle, where the real choice lives now
// ---------------------------------------------------------------------------

describe('the Recovery Day protection toggle', () => {
  it('PREVENTS A SPEND, over the whole flow, measured against the identical calendar with it on', () => {
    // THE POINT OF THE TOGGLE, checked as a difference rather than asserted in a
    // comment, and driven through the REAL API from a fresh player: train, flip
    // the setting, train again (which is where arming happens), then be away.
    //
    // Building the declined player as a state literal instead would test that
    // `armedRecoveryDays: null` spends nothing — true, and nearly tautological.
    // It would say nothing about whether the toggle produces that state, or
    // whether the next session quietly re-arms in spite of it.
    const play = (declineOnDayOne: boolean): {
      readonly spent: number;
      readonly streak: number;
      readonly balance: number;
      readonly reason: string | null;
    } => {
      let state: StreakState = { ...freshState(), recoveryDayBalance: 3 };
      state = unwrap(recordTrainingDay(state, DAY_ZERO)).state;
      if (declineOnDayOne) state = setRecoveryDayProtection(state, false).state;
      // A second session, so the arming path runs again after the setting moved.
      state = unwrap(recordTrainingDay(state, addDays(DAY_ZERO, 1))).state;
      const backOn = dayAfterGap(addDays(DAY_ZERO, 1), SHORTEST_PAID_GAP);
      const outcome = unwrap(recordTrainingDay(state, backOn));
      return {
        spent: outcome.recoveryDaySave?.recoveryDaysSpent ?? 0,
        streak: outcome.streakAfter,
        balance: outcome.state.recoveryDayBalance,
        reason: outcome.endedRunReason,
      };
    };

    const kept = play(false);
    expect(kept.spent).toBe(1);
    expect(kept.streak).toBe(3);
    expect(kept.balance).toBe(2);
    expect(kept.reason).toBeNull();

    const declined = play(true);
    // NOT ONE RECOVERY DAY TAKEN. This is the assertion the human's ruling asked
    // for in as many words.
    expect(declined.spent).toBe(0);
    expect(declined.balance).toBe(3);
    expect(declined.streak).toBe(1);
    expect(declined.reason).toBe('recovery-day-protection-declined');
  });

  it('spends nothing at any balance or absence length while it is off', () => {
    let brokenRuns = 0;
    for (let balance = 0; balance <= RECOVERY_DAY_GUARDRAILS.HOLD_CAP; balance += 1) {
      for (let gap = 1; gap <= LONGEST_REPAIRABLE_ABSENCE_DAYS + 2; gap += 1) {
        const state = unprotectedStateWithRun(9, DAY_ZERO, balance);
        const outcome = unwrap(recordTrainingDay(state, dayAfterGap(DAY_ZERO, gap)));
        expect(outcome.recoveryDaySave).toBeNull();
        expect(outcome.state.recoveryDayBalance).toBe(balance);
        if (gap > GRACE) {
          expect(outcome.previousRunEnded).toBe(true);
          brokenRuns += 1;
        } else {
          expect(outcome.previousRunEnded).toBe(false);
        }
      }
    }
    // The sweep is worthless if the toggle never actually ended a run.
    expect(brokenRuns).toBeGreaterThan(0);
  });

  it('says so in the break reason, and only where protection would have helped', () => {
    // A UI that says "you could have kept this" when nothing could have kept it
    // is worse than one that says nothing, so the declined reason is reported
    // only inside the range protection could have covered.
    const declined = unprotectedStateWithRun(9, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    const saveable = openDay(declined, dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP));
    if (saveable.kind !== 'streak-broken') throw new Error('expected a break');
    expect(saveable.reason).toBe('recovery-day-protection-declined');

    const hopeless = openDay(declined, dayAfterGap(DAY_ZERO, LONGEST_REPAIRABLE_ABSENCE_DAYS + 1));
    if (hopeless.kind !== 'streak-broken') throw new Error('expected a break');
    expect(hopeless.reason).toBe('absence-longer-than-consecutive-limit');
  });

  it('turning it OFF reaches the absence already in progress', () => {
    // The safe direction: it can only end a run early, never rescue one, so it
    // applies immediately and a player who declines cannot be charged for the
    // absence they are standing in.
    const state = stateWithRun(9, DAY_ZERO, 3);
    const day = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    expect(openDay(state, day).kind).toBe('gap-covered-by-recovery-days');

    const off = setRecoveryDayProtection(state, false);
    expect(off.appliesToTheAbsenceInProgress).toBe(true);
    expect(off.armedRecoveryDays).toBeNull();
    expect(off.state.recoveryDayBalance).toBe(3);
    expect(openDay(off.state, day).kind).toBe('streak-broken');
    expect(unwrap(recordTrainingDay(off.state, day)).state.recoveryDayBalance).toBe(3);
  });

  it('turning it ON applies from the next session, and says so', () => {
    // The unsafe direction. Arming mid-absence would let a toggle resurrect a run
    // the calendar had already ended, which is the "outcome depends on when you
    // act" defect in a different costume.
    const declined = unprotectedStateWithRun(9, DAY_ZERO, 3);
    const day = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    expect(openDay(declined, day).kind).toBe('streak-broken');

    const on = setRecoveryDayProtection(declined, true);
    expect(on.appliesToTheAbsenceInProgress).toBe(false);
    expect(on.armedRecoveryDays).toBeNull();
    expect(on.state.recoveryDayProtectionEnabled).toBe(true);
    expect(openDay(on.state, day).kind).toBe('streak-broken');

    // ...and the session after it arms normally.
    const trained = unwrap(recordTrainingDay(on.state, day));
    expect(trained.armedForNextAbsence).toBe(3);
    expect(openDay(trained.state, dayAfterGap(day, SHORTEST_PAID_GAP)).kind).toBe(
      'gap-covered-by-recovery-days',
    );
  });

  it('changes nothing else about the state', () => {
    const state = stateWithRun(9, DAY_ZERO, 3);
    const off = setRecoveryDayProtection(state, false).state;
    const changed = STREAK_FACT_KEYS.filter((key) => off[key] !== state[key]);
    expect([...changed].sort()).toEqual(['armedRecoveryDays', 'recoveryDayProtectionEnabled']);
    expect(setRecoveryDayProtection(state, true).state).toEqual(state);
  });
});

// ---------------------------------------------------------------------------
// The paid path preserves the streak exactly
// ---------------------------------------------------------------------------

describe('a Recovery Day save preserves the streak exactly', () => {
  /**
   * THE REQUIREMENT THIS BLOCK EXISTS FOR. There are two ways through
   * `recordTrainingDay` that keep a run alive — the free grace and an armed
   * save — and the risk is that the PAID one quietly starts doing something
   * different to the streak while the free one keeps every assertion elsewhere
   * green.
   *
   * So every test here asserts two things at once:
   *   (a) the streak is preserved EXACTLY, with `toBe`, not `toBeGreaterThan`;
   *   (b) the path taken was the paid one — at least one Recovery Day left the
   *       balance. Without (b) these would pass on a state that never spent
   *       anything, which is precisely the blind test this is guarding against.
   */
  function assertPaidPath(
    before: StreakState,
    outcome: {
      readonly state: StreakState;
      readonly recoveryDaySave: { readonly recoveryDaysSpent: number } | null;
      readonly recoveryDaysGranted: number;
    },
  ): number {
    const save = outcome.recoveryDaySave;
    if (save === null) throw new Error('expected the paid path, got a free one');
    expect(save.recoveryDaysSpent).toBeGreaterThanOrEqual(1);
    // The balance moved by the save and by any milestone the session paid, and
    // by nothing else. Written as an equation rather than "went down", because a
    // session that crosses a milestone can spend one and earn one back.
    expect(outcome.state.recoveryDayBalance).toBe(
      before.recoveryDayBalance - save.recoveryDaysSpent + outcome.recoveryDaysGranted,
    );
    return save.recoveryDaysSpent;
  }

  it('leaves currentStreak and longestStreak untouched, at every chargeable absence length', () => {
    for (let chargeable = 1; chargeable <= RECOVERY_DAY_GUARDRAILS.MAX_CONSECUTIVE_USES; chargeable += 1) {
      for (const streak of [1, 2, 6, 8, 29, 31, 99, 365]) {
        const before = stateWithRun(streak, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
        const day = dayAfterGap(DAY_ZERO, GRACE + chargeable);
        const outcome = unwrap(recordTrainingDay(before, day));

        expect(assertPaidPath(before, outcome)).toBe(chargeable);
        // The run continued: exactly one more than it was. Not "at least" — a
        // partial reset that left the streak above zero would slip past a >=.
        expect(outcome.streakAfter).toBe(streak + 1);
        expect(outcome.state.currentStreak).toBe(streak + 1);
        expect(outcome.recoveryDaySave?.streakProtected).toBe(streak);
        expect(outcome.previousRunEnded).toBe(false);
        expect(outcome.state.longestStreak).toBe(Math.max(before.longestStreak, streak + 1));
      }
    }
  });

  it('changes only the fields a save is allowed to change', () => {
    // A field-by-field diff rather than a list of assertions about the ones
    // someone remembered.
    const before = stateWithRun(42, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    const day = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    const outcome = unwrap(recordTrainingDay(before, day));
    assertPaidPath(before, outcome);

    const changed = STREAK_FACT_KEYS.filter((key) => outcome.state[key] !== before[key]);
    expect([...changed].sort()).toEqual(
      [
        'armedRecoveryDays',
        'currentStreak',
        'hasBankedFirstRecoveryDaySave',
        'lastTrainedDay',
        'longestStreak',
        'recoveryDayBalance',
      ].sort(),
    );
  });

  it('is a DIFFERENT path from the free grace, and the free path is the one that spends nothing', () => {
    const state = stateWithRun(11, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);

    const graceDay = dayAfterGap(DAY_ZERO, GRACE);
    expect(openDay(state, graceDay).kind).toBe('gap-covered-by-grace');
    const throughGrace = unwrap(recordTrainingDay(state, graceDay));
    expect(throughGrace.recoveryDaySave).toBeNull();
    expect(throughGrace.state.recoveryDayBalance).toBe(state.recoveryDayBalance);
    expect(throughGrace.streakAfter).toBe(12);

    const paidDay = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    expect(openDay(state, paidDay).kind).toBe('gap-covered-by-recovery-days');
    const throughSpend = unwrap(recordTrainingDay(state, paidDay));
    assertPaidPath(state, throughSpend);
    expect(throughSpend.streakAfter).toBe(12);
  });

  it('holds across a long history in which every absence is paid for', () => {
    let state: StreakState = stateWithRun(5, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    let day = DAY_ZERO;
    let saves = 0;
    for (let cycle = 0; cycle < 12; cycle += 1) {
      day = dayAfterGap(day, SHORTEST_PAID_GAP);
      const streakBefore = state.currentStreak;
      const opening = openDay(state, day);
      const outcome = unwrap(recordTrainingDay(state, day));
      if (opening.kind === 'gap-covered-by-recovery-days') {
        saves += 1;
        expect(outcome.recoveryDaySave?.streakProtected).toBe(streakBefore);
        expect(outcome.streakAfter).toBe(streakBefore + 1);
      }
      state = outcome.state;
    }
    expect(saves).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Guardrail: the hold cap
// ---------------------------------------------------------------------------

describe('the hold cap', () => {
  it('clips a grant and reports what was lost', () => {
    const state = { ...freshState(), recoveryDayBalance: RECOVERY_DAY_GUARDRAILS.HOLD_CAP - 1 };
    const outcome = unwrap(grantRecoveryDays(state, { source: 'purchase-chalk', amount: 4 }));
    expect(outcome.credited).toBe(1);
    expect(outcome.wastedToHoldCap).toBe(3);
    expect(outcome.balanceAfter).toBe(RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    expect(outcome.state.recoveryDayBalance).toBe(RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
  });

  it('never exceeds the cap, whatever is granted', () => {
    let state: StreakState = freshState();
    for (let i = 0; i < 25; i += 1) {
      state = unwrap(grantRecoveryDays(state, { source: 'achievement' })).state;
      expect(state.recoveryDayBalance).toBeLessThanOrEqual(RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    }
    expect(state.recoveryDayBalance).toBe(RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    expect(recoveryDayCapacity(state)).toBe(0);
  });

  it('clips a milestone reward too, and says so', () => {
    const state = {
      ...trainConsecutively(freshState(), DAY_ZERO, 6),
      recoveryDayBalance: RECOVERY_DAY_GUARDRAILS.HOLD_CAP,
    };
    const outcome = unwrap(recordTrainingDay(state, addDays(DAY_ZERO, 6)));
    expect(outcome.milestonesReached).toEqual([7]);
    expect(outcome.recoveryDaysGranted).toBe(0);
    expect(outcome.recoveryDaysWastedToHoldCap).toBe(RECOVERY_DAY_ECONOMY.STREAK_MILESTONE_GRANT);
    expect(outcome.state.recoveryDayBalance).toBe(RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
  });

  it('rejects a nonsense grant amount', () => {
    const state = freshState();
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
    expect(armedGapDays(state)).toBe(RECOVERY_DAY_GUARDRAILS.MAX_CONSECUTIVE_USES);
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

  it('bounds the CHARGEABLE days of an absence, not the whole absence', () => {
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    const outcome = unwrap(recordTrainingDay(state, dayAfterGap(DAY_ZERO, GRACE + LIMIT)));
    expect(outcome.recoveryDaySave?.recoveryDaysSpent).toBe(LIMIT);
    expect(outcome.recoveryDaySave?.coveredDays).toHaveLength(GRACE + LIMIT);
  });

  it('refuses an absence one day past the limit, even at full balance', () => {
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    const tooLong = dayAfterGap(DAY_ZERO, GRACE + LIMIT + 1);
    expect(openDay(state, tooLong)).toEqual({
      kind: 'streak-broken',
      brokenRunLength: 9,
      daysMissed: GRACE + LIMIT + 1,
      reason: 'absence-longer-than-consecutive-limit',
      recoveryDayBalance: RECOVERY_DAY_GUARDRAILS.HOLD_CAP,
      recoveryDaysCommittedToTheAbsence: RECOVERY_DAY_GUARDRAILS.HOLD_CAP,
    });
    // The guardrail bit rather than the balance — that is what the REASON says —
    // but the Recovery Days that were armed against this absence are still
    // spent on it. §5: an absence is charged whether or not it saved anything.
    expect(unwrap(recordTrainingDay(state, tooLong)).state.recoveryDayBalance).toBe(0);
  });

  it('binds before the balance does, which is the whole reason it exists', () => {
    // With a hold cap of 5 a player could otherwise afford the chargeable days
    // of a much longer absence. The limit is what stops a week away being
    // buyable, so it has to bite while Recovery Days are still in the bank.
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    expect(RECOVERY_DAY_GUARDRAILS.HOLD_CAP).toBeGreaterThan(LIMIT);
    const opening = openDay(state, dayAfterGap(DAY_ZERO, GRACE + LIMIT + 1));
    if (opening.kind !== 'streak-broken') throw new Error('expected a break');
    expect(opening.reason).toBe('absence-longer-than-consecutive-limit');
    expect(opening.recoveryDayBalance).toBeGreaterThan(0);
  });

  it('does NOT stop an alternating pattern of one trained day per chargeable absence', () => {
    // The module header claims this out loud rather than implying a guard it
    // does not have. Here it is: every trained day re-arms, so a player who
    // trains one day after each shortest chargeable absence spends one Recovery
    // Day per absence until the bank is empty, and only then breaks.
    const STARTING_BALANCE = 3;
    let state: StreakState = stateWithRun(1, DAY_ZERO, STARTING_BALANCE);
    let spent = 0;
    let day = DAY_ZERO;
    let brokeAfter = -1;

    for (let cycle = 0; cycle < STARTING_BALANCE + 2 && brokeAfter < 0; cycle += 1) {
      day = dayAfterGap(day, SHORTEST_PAID_GAP);
      const outcome = unwrap(recordTrainingDay(state, day));
      spent += outcome.recoveryDaySave?.recoveryDaysSpent ?? 0;
      if (outcome.previousRunEnded) brokeAfter = cycle;
      state = outcome.state;
    }

    expect(spent).toBe(STARTING_BALANCE);
    expect(state.recoveryDayBalance).toBe(0);
    expect(brokeAfter).toBe(STARTING_BALANCE);
  });

  it('is re-armed by any training day', () => {
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    const day = dayAfterGap(DAY_ZERO, GRACE + LIMIT);
    const saved = unwrap(recordTrainingDay(state, day));
    expect(saved.recoveryDaySave?.recoveryDaysSpent).toBe(LIMIT);
    // The very next absence gets the full allowance again, capped by what is
    // left in the bank.
    expect(armedGapDays(saved.state)).toBe(
      Math.min(saved.state.recoveryDayBalance, LIMIT),
    );
    expect(coverableGapDays(saved.state)).toBe(GRACE + Math.min(saved.state.recoveryDayBalance, LIMIT));
  });
});

// ---------------------------------------------------------------------------
// A long absence
// ---------------------------------------------------------------------------

/**
 * Plays out an absence of `awayDays` missed days from a live `streakLength`-day
 * run, opening the app on the days in `openOn`, and training on the day of
 * return.
 *
 * `openOn` is the axis that used to matter and no longer can. It is kept — and
 * swept — precisely because "it makes no difference" is a claim that has to be
 * measured rather than assumed.
 */
interface PlayedAbsence {
  readonly survived: boolean;
  readonly spent: number;
  readonly streakOnReturn: number;
  readonly balanceOnReturn: number;
  readonly revealsSeen: number;
  readonly state: StreakState;
}

function playAbsence(
  awayDays: number,
  balance: number,
  openOn: (offset: number) => boolean,
  streakLength = 50,
): PlayedAbsence {
  let state: StreakState = stateWithRun(streakLength, DAY_ZERO, balance);
  let revealsSeen = 0;
  const returnDay = awayDays + 1;

  for (let offset = 1; offset <= returnDay; offset += 1) {
    if (!openOn(offset)) continue;
    const day = addDays(DAY_ZERO, offset);
    const opening = openDay(state, day);
    if (opening.kind === 'gap-covered-by-recovery-days') revealsSeen += 1;
    if (opening.kind === 'streak-broken') state = unwrap(settleBrokenStreak(state, day)).state;
  }

  const trained = unwrap(recordTrainingDay(state, addDays(DAY_ZERO, returnDay)));
  return {
    survived: trained.streakAfter === streakLength + 1,
    spent: (trained.recoveryDaySave?.recoveryDaysSpent ?? 0) + trained.recoveryDaysLostToTheAbsence,
    streakOnReturn: trained.streakAfter,
    balanceOnReturn: trained.state.recoveryDayBalance,
    revealsSeen,
    state: trained.state,
  };
}

const OPENS_EVERY_DAY = (): boolean => true;
const OPENS_ON_RETURN_ONLY = (offset: number): ((o: number) => boolean) => (o) => o === offset;

describe('a long absence', () => {
  const AWAY_DAYS = 7;

  it('cannot be repaired on the day the player comes back, even holding a full bank', () => {
    const state = stateWithRun(50, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    const backOn = addDays(DAY_ZERO, AWAY_DAYS + 1);
    expect(daysMissedBefore(state, backOn)).toBe(AWAY_DAYS);
    expect(AWAY_DAYS).toBeGreaterThan(coverableGapDays(state));
    expect(openDay(state, backOn)).toEqual({
      kind: 'streak-broken',
      brokenRunLength: 50,
      daysMissed: AWAY_DAYS,
      reason: 'absence-longer-than-consecutive-limit',
      recoveryDayBalance: RECOVERY_DAY_GUARDRAILS.HOLD_CAP,
      recoveryDaysCommittedToTheAbsence: RECOVERY_DAY_GUARDRAILS.HOLD_CAP,
    });
  });

  it('takes the armed Recovery Days with it — WHERE THIS ONCE ASSERTED THE BANK SURVIVED', () => {
    // REVERSED, NOT DELETED. This test used to be called "leaves the bank
    // untouched rather than quietly draining it" and it is the single clearest
    // statement of the rule that had to go. §5 of `streak.ts` has the argument;
    // §6 has the measurement. Nothing about it is quiet: the debit is reported
    // on `recoveryDaysLostToTheAbsence` and on the break's read model.
    const state = stateWithRun(50, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    const outcome = unwrap(recordTrainingDay(state, addDays(DAY_ZERO, AWAY_DAYS + 1)));
    expect(outcome.recoveryDaysLostToTheAbsence).toBe(RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    expect(outcome.state.recoveryDayBalance).toBe(0);
    expect(outcome.state.currentStreak).toBe(1);
    expect(outcome.state.longestStreak).toBe(50);
  });

  it('THE ABSENCE-LENGTH TABLE: identical whether the app is opened daily or once on the way back', () => {
    // THE TEST THIS BLOCK EXISTS FOR. An earlier design let a player who checked
    // in daily hold a run across EIGHT days against four for the same absence
    // answered once on the way back, and a one-sided version of this test stayed
    // green throughout. The whole table is built under both behaviours and
    // asserted identical, cell by cell, at every balance from empty to the hold
    // cap — including the BALANCE, which is what the old design could not match.
    const LONGEST_SWEPT = 2 * LONGEST_REPAIRABLE_ABSENCE_DAYS + 4;
    const rows: string[] = [];

    for (let balance = 0; balance <= RECOVERY_DAY_GUARDRAILS.HOLD_CAP; balance += 1) {
      for (let away = 1; away <= LONGEST_SWEPT; away += 1) {
        const walked = playAbsence(away, balance, OPENS_EVERY_DAY);
        const returned = playAbsence(away, balance, OPENS_ON_RETURN_ONLY(away + 1));
        if (
          walked.survived !== returned.survived ||
          walked.spent !== returned.spent ||
          walked.streakOnReturn !== returned.streakOnReturn ||
          walked.balanceOnReturn !== returned.balanceOnReturn
        ) {
          rows.push(
            `away=${away} balance=${balance}: walked ${JSON.stringify(walked.state)} ` +
              `returned ${JSON.stringify(returned.state)}`,
          );
        }
      }
    }
    expect(rows).toEqual([]);

    // THE TABLE ITSELF, spelled out rather than left implicit in the loop, at a
    // balance that can afford everything the guardrail permits.
    const survivalAtFullBank = Array.from({ length: LONGEST_SWEPT }, (_, i) =>
      playAbsence(i + 1, RECOVERY_DAY_GUARDRAILS.HOLD_CAP, OPENS_ON_RETURN_ONLY(i + 2)).survived,
    );
    expect(survivalAtFullBank).toEqual(
      Array.from({ length: LONGEST_SWEPT }, (_, i) => i + 1 <= LONGEST_REPAIRABLE_ABSENCE_DAYS),
    );

    // A WEEK AWAY FAILS AT EVERY BALANCE, which is the specific promise
    // `MAX_CONSECUTIVE_USES` carries in its own comment.
    expect(AWAY_DAYS).toBe(7);
    expect(LONGEST_SWEPT).toBeGreaterThan(AWAY_DAYS);
    for (let balance = 0; balance <= RECOVERY_DAY_GUARDRAILS.HOLD_CAP; balance += 1) {
      expect(playAbsence(AWAY_DAYS, balance, OPENS_EVERY_DAY).survived).toBe(false);
      expect(playAbsence(AWAY_DAYS, balance, OPENS_ON_RETURN_ONLY(AWAY_DAYS + 1)).survived).toBe(false);
      expect(playAbsence(AWAY_DAYS, balance, OPENS_EVERY_DAY).streakOnReturn).toBe(1);
    }
  });

  it('costs the same whether the player checked in during it or not', () => {
    const walked = playAbsence(
      LONGEST_REPAIRABLE_ABSENCE_DAYS,
      RECOVERY_DAY_GUARDRAILS.HOLD_CAP,
      OPENS_EVERY_DAY,
    );
    const returned = playAbsence(
      LONGEST_REPAIRABLE_ABSENCE_DAYS,
      RECOVERY_DAY_GUARDRAILS.HOLD_CAP,
      OPENS_ON_RETURN_ONLY(LONGEST_REPAIRABLE_ABSENCE_DAYS + 1),
    );
    expect(walked.survived).toBe(true);
    expect(returned.survived).toBe(true);
    expect(walked.spent).toBe(RECOVERY_DAY_GUARDRAILS.MAX_CONSECUTIVE_USES);
    expect(returned.spent).toBe(walked.spent);
    // The number of REVEALS differs — that is the one thing that legitimately
    // does, and it is why the walk-through has to be simulated separately. If it
    // did not differ, the two simulations would not be distinguishable at all
    // and the equality above would be a comparison of a thing with itself.
    expect(walked.revealsSeen).toBeGreaterThan(returned.revealsSeen);
    expect(returned.revealsSeen).toBe(1);
  });

  it('THE RESIDUE THE OLD DESIGN HAD, GONE: a spend can no longer be wasted by looking', () => {
    // BEFORE THE REWORK this was pinned as a known cost: a player who could not
    // afford a whole absence, opened the app inside it, and accepted the prompt,
    // paid for part of an absence that ended the run anyway — and ended poorer
    // than one who never looked. THE RESIDUE WAS THE ASYMMETRY, NOT THE SPEND,
    // and the spend has since come back on purpose (§5). What matters, and what
    // this test now pins, is that the two behaviours cost exactly the same: the
    // debit is the ARMED COUNT, which does not move while the player is away.
    const POOR_BALANCE = 1;
    const away = LONGEST_REPAIRABLE_ABSENCE_DAYS;
    const walked = playAbsence(away, POOR_BALANCE, OPENS_EVERY_DAY);
    const returned = playAbsence(away, POOR_BALANCE, OPENS_ON_RETURN_ONLY(away + 1));

    expect(walked.survived).toBe(false);
    expect(returned.survived).toBe(false);
    expect(walked.spent).toBe(POOR_BALANCE);
    expect(returned.spent).toBe(walked.spent);
    expect(walked.balanceOnReturn).toBe(0);
    expect(returned.balanceOnReturn).toBe(walked.balanceOnReturn);
    expect(walked.state).toEqual(returned.state);

    // NOT VACUOUS: the same absence at a balance that CAN afford it does spend,
    // and spends the same either way. Without this the test above would pass on
    // a build where Recovery Days did nothing at all.
    const affordable = playAbsence(away, RECOVERY_DAY_GUARDRAILS.HOLD_CAP, OPENS_EVERY_DAY);
    expect(affordable.survived).toBe(true);
    expect(affordable.spent).toBe(RECOVERY_DAY_GUARDRAILS.MAX_CONSECUTIVE_USES);
  });

  it('does not let a purchase repair it either', () => {
    let state: StreakState = { ...stateWithRun(50, DAY_ZERO, 0), armedRecoveryDays: 0 };
    for (let i = 0; i < 10; i += 1) {
      state = unwrap(grantRecoveryDays(state, { source: 'purchase-chalk', amount: 5 })).state;
    }
    expect(state.recoveryDayBalance).toBe(RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    expect(openDay(state, addDays(DAY_ZERO, AWAY_DAYS + 1)).kind).toBe('streak-broken');
  });
});

// ---------------------------------------------------------------------------
// GDD §4.3 — the first save, taught once
// ---------------------------------------------------------------------------

describe('the first-save moment', () => {
  it('does NOT fire on any miss — only on an absence past the free grace', () => {
    let state: StreakState = stateWithRun(9, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    for (let gap = 1; gap <= GRACE; gap += 1) {
      const day = dayAfterGap(state.lastTrainedDay as StreakDay, gap);
      expect(openDay(state, day).kind).toBe('gap-covered-by-grace');
      state = unwrap(recordTrainingDay(state, day)).state;
      expect(state.hasBankedFirstRecoveryDaySave).toBe(false);
    }
    const paid = openDay(state, dayAfterGap(state.lastTrainedDay as StreakDay, SHORTEST_PAID_GAP));
    if (paid.kind !== 'gap-covered-by-recovery-days') throw new Error('expected a save');
    expect(paid.isFirstRecoveryDaySave).toBe(true);
  });

  it('is flagged on the reveal and consumed by the session that banks it', () => {
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP);
    const dayOne = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    const first = openDay(state, dayOne);
    if (first.kind !== 'gap-covered-by-recovery-days') throw new Error('expected a save');
    expect(first.isFirstRecoveryDaySave).toBe(true);

    const banked = unwrap(recordTrainingDay(state, dayOne));
    expect(banked.recoveryDaySave?.wasFirstRecoveryDaySave).toBe(true);
    expect(banked.state.hasBankedFirstRecoveryDaySave).toBe(true);

    const second = unwrap(recordTrainingDay(banked.state, dayAfterGap(dayOne, SHORTEST_PAID_GAP)));
    expect(second.recoveryDaySave?.recoveryDaysSpent).toBe(1);
    expect(second.recoveryDaySave?.wasFirstRecoveryDaySave).toBe(false);
  });

  it('is not consumed by merely looking, so closing the app re-shows it', () => {
    const state = stateWithRun(9, DAY_ZERO, 3);
    const day = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    for (let i = 0; i < 5; i += 1) {
      const opening = openDay(state, day);
      if (opening.kind !== 'gap-covered-by-recovery-days') throw new Error('expected a save');
      expect(opening.isFirstRecoveryDaySave).toBe(true);
    }
    expect(state.hasBankedFirstRecoveryDaySave).toBe(false);
  });

  it('is not burned by a break that could never have been saved', () => {
    const broke = { ...stateWithRun(9, DAY_ZERO, 0), armedRecoveryDays: 0 };
    const brokeOn = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    const settled = unwrap(settleBrokenStreak(broke, brokeOn));
    expect(settled.state.hasBankedFirstRecoveryDaySave).toBe(false);

    const restarted = trainConsecutively(
      { ...settled.state, recoveryDayBalance: 3 },
      addDays(brokeOn, 1),
      4,
    );
    const opening = openDay(restarted, dayAfterGap(addDays(brokeOn, 4), SHORTEST_PAID_GAP));
    if (opening.kind !== 'gap-covered-by-recovery-days') throw new Error('expected a save');
    expect(opening.isFirstRecoveryDaySave).toBe(true);
  });

  it('fires exactly once across a long simulated history', () => {
    let state: StreakState = {
      ...freshState(),
      recoveryDayBalance: RECOVERY_DAY_GUARDRAILS.HOLD_CAP,
    };
    let firstSaves = 0;
    let savesSeen = 0;
    let day = DAY_ZERO;
    const CYCLE = SHORTEST_PAID_GAP + 1;
    for (let i = 0; i < 120; i += 1) {
      if (i % CYCLE === 0) {
        const outcome = unwrap(recordTrainingDay(state, day));
        if (outcome.recoveryDaySave !== null) {
          savesSeen += 1;
          if (outcome.recoveryDaySave.wasFirstRecoveryDaySave) firstSaves += 1;
        }
        state = outcome.state;
      }
      day = addDays(day, 1);
    }
    // The history has to contain several saves for "exactly one first" to mean
    // anything; if the grace swallowed them all this would read 0 and the
    // assertion below would pass for the wrong reason.
    expect(savesSeen).toBeGreaterThan(1);
    expect(firstSaves).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

describe('streak milestones', () => {
  it('pays out at 7, 30 and 100 trained days, once each', () => {
    let state: StreakState = { ...freshState(), recoveryDayBalance: 0 };
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
    // Broke and started again with nothing: `armedRecoveryDays` matches the
    // balance, or the state would be one no session could have produced.
    let state: StreakState = { ...freshState(), recoveryDayBalance: 0, armedRecoveryDays: 0 };
    state = trainConsecutively(state, DAY_ZERO, 7);
    expect(state.recoveryDayBalance).toBe(1);

    // The fourteen-day absence ends the run AND takes the Recovery Day the
    // milestone paid, because it was armed against that absence (§5).
    const back = unwrap(recordTrainingDay(state, addDays(DAY_ZERO, 20)));
    expect(back.recoveryDaysLostToTheAbsence).toBe(1);
    state = back.state;
    state = trainConsecutively(state, addDays(DAY_ZERO, 21), 6);
    expect(state.currentStreak).toBe(7);
    // Still 0: reaching seven a SECOND time pays nothing, which is the point.
    expect(state.recoveryDayBalance).toBe(0);
  });

  it('still pays a milestone the first time a rebuilt run passes the previous best', () => {
    let state: StreakState = { ...freshState(), recoveryDayBalance: 0, armedRecoveryDays: 0 };
    state = trainConsecutively(state, DAY_ZERO, 7);
    state = unwrap(recordTrainingDay(state, addDays(DAY_ZERO, 20))).state;
    state = trainConsecutively(state, addDays(DAY_ZERO, 21), 29);
    expect(state.currentStreak).toBe(30);
    expect(state.longestStreak).toBe(30);
    // One, not two: the seven-day payout was lost to the absence that ended the
    // first run, and only the thirty-day payout is in hand.
    expect(state.recoveryDayBalance).toBe(1);
  });

  it('cannot be reached faster by spending Recovery Days', () => {
    // A Recovery Day keeps the run alive but is not a training day, so the
    // seventh milestone still costs seven sessions. This is what stops bought
    // Recovery Days from earning more Recovery Days.
    let state: StreakState = {
      ...freshState(),
      recoveryDayBalance: RECOVERY_DAY_GUARDRAILS.HOLD_CAP,
    };
    let sessions = 0;
    let milestoneAtSessions = -1;
    let recoveryDaysUsed = 0;
    const TRAIN_BLOCK = 3;
    const CYCLE = TRAIN_BLOCK + SHORTEST_PAID_GAP;

    for (let i = 0; i < CYCLE * 4 && milestoneAtSessions < 0; i += 1) {
      const day = addDays(DAY_ZERO, i);
      expect(openDay(state, day).kind).not.toBe('streak-broken');
      if (i % CYCLE < TRAIN_BLOCK) {
        const outcome = unwrap(recordTrainingDay(state, day));
        recoveryDaysUsed += outcome.recoveryDaySave?.recoveryDaysSpent ?? 0;
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
    const outcome = unwrap(recordTrainingDay(state, dayAfterGap(DAY_ZERO, GRACE + 2)));
    expect(outcome.recoveryDaySave?.recoveryDaysSpent).toBe(2);
    expect(outcome.streakAfter).toBe(10);
    expect(outcome.recoveryDaySave?.streakProtected).toBe(9);
  });
});

// ---------------------------------------------------------------------------
// GDD §8.1 / §12.3 — the pay-to-win boundary
// ---------------------------------------------------------------------------

describe('what a purchased Recovery Day can reach', () => {
  it('persists nothing outside the declared streak-fact allowlist', () => {
    const states: StreakState[] = [
      freshState(),
      stateWithRun(9, DAY_ZERO, 3),
      trainConsecutively(freshState(), DAY_ZERO, 8),
      unwrap(recordTrainingDay(stateWithRun(9, DAY_ZERO, 3), dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP))).state,
      unwrap(grantRecoveryDays(freshState(), { source: 'purchase-chalk', amount: 2 })).state,
      setRecoveryDayProtection(stateWithRun(9, DAY_ZERO, 3), false).state,
    ];
    for (const state of states) {
      expect(Object.keys(state).sort()).toEqual([...STREAK_FACT_KEYS].sort());
    }
  });

  it('reports nothing outside the declared spend allowlist', () => {
    const outcome = unwrap(
      recordTrainingDay(stateWithRun(9, DAY_ZERO, 3), dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP)),
    );
    expect(outcome.recoveryDaySave).not.toBeNull();
    expect(Object.keys(outcome.recoveryDaySave as object).sort()).toEqual(
      [...RECOVERY_DAY_OUTCOME_KEYS].sort(),
    );
  });

  it('has no field anywhere whose name suggests it touches Total, e1RM or pace', () => {
    const forbidden = /total|e1rm|1rm|weight|load|pace|multiplier|bonus|boost|iq|fatigue|readiness|attempt/i;
    const state = stateWithRun(9, DAY_ZERO, 3);
    const day = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    const outcome = unwrap(recordTrainingDay(state, day));
    const opening = openDay(state, day);
    for (const key of [
      ...Object.keys(state),
      ...Object.keys(outcome),
      ...Object.keys(outcome.recoveryDaySave as object),
      ...Object.keys(opening),
    ]) {
      expect(key).not.toMatch(forbidden);
    }
  });

  it('makes a bought Recovery Day literally identical to an earned one', () => {
    const base = { ...freshState(), recoveryDayBalance: 0 };
    const grants: readonly RecoveryDayGrant[] = RECOVERY_DAY_SOURCES.map((source) =>
      source === 'season-pass' || source === 'purchase-chalk' || source === 'purchase-gym-bucks'
        ? { source, amount: 1 }
        : { source },
    );
    const states = grants.map((grant) => {
      const amount = recoveryDayGrantAmount(grant);
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
    // THE PROPERTY THAT SURVIVED THE REWORK, and got stronger doing it: the only
    // function that can debit the balance is `recordTrainingDay(state, day)`,
    // which has no parameter a source could travel on. There is no longer even a
    // spend entry point that could take one.
    const run = { ...stateWithRun(9, DAY_ZERO, 0), armedRecoveryDays: 0 };
    const bought = unwrap(grantRecoveryDays(run, { source: 'purchase-chalk', amount: 1 })).state;
    const earned = unwrap(grantRecoveryDays(run, { source: 'achievement' })).state;
    expect(bought).toEqual(earned);

    // Both arm identically at the next session, and both spend identically after.
    const boughtArmed = unwrap(recordTrainingDay(bought, addDays(DAY_ZERO, 1))).state;
    const earnedArmed = unwrap(recordTrainingDay(earned, addDays(DAY_ZERO, 1))).state;
    expect(boughtArmed).toEqual(earnedArmed);
    const boughtSpend = unwrap(recordTrainingDay(boughtArmed, dayAfterGap(addDays(DAY_ZERO, 1), SHORTEST_PAID_GAP)));
    const earnedSpend = unwrap(recordTrainingDay(earnedArmed, dayAfterGap(addDays(DAY_ZERO, 1), SHORTEST_PAID_GAP)));
    expect(boughtSpend.recoveryDaySave?.recoveryDaysSpent).toBe(1);
    expect(boughtSpend).toEqual(earnedSpend);
  });

  it('does not record where a Recovery Day came from', () => {
    const state = unwrap(grantRecoveryDays(freshState(), { source: 'purchase-gym-bucks', amount: 1 }))
      .state;
    expect(JSON.stringify(state)).not.toContain('purchase');
    expect(JSON.stringify(state)).not.toContain('chalk');
    expect(JSON.stringify(state)).not.toContain('source');
  });

  it('cannot buy a longer streak, only a surviving one', () => {
    let state: StreakState = { ...freshState(), recoveryDayBalance: 0 };
    state = unwrap(grantRecoveryDays(state, { source: 'purchase-chalk', amount: 99 })).state;
    let trainedDays = 0;
    let spent = 0;
    let day = DAY_ZERO;
    const TRAIN_BLOCK = 2;
    const CYCLE = TRAIN_BLOCK + SHORTEST_PAID_GAP;
    for (let i = 0; i < CYCLE * 8; i += 1) {
      if (i % CYCLE < TRAIN_BLOCK) {
        const outcome = unwrap(recordTrainingDay(state, day));
        spent += outcome.recoveryDaySave?.recoveryDaysSpent ?? 0;
        state = outcome.state;
        trainedDays += 1;
      }
      day = addDays(day, 1);
      expect(state.currentStreak).toBeLessThanOrEqual(trainedDays);
    }
    expect(spent).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// The simulation harness the property sweeps share
// ---------------------------------------------------------------------------

interface SimResult {
  readonly state: StreakState;
  /** Recovery Days actually debited across the history. */
  readonly recoveryDaysSpent: number;
  /** Return-visit reveals the simulated player was shown. */
  readonly revealsSeen: number;
}

/**
 * WHEN THE APP IS OPENED. This used to be the axis that decided outcomes; the
 * whole point of the rework is that it no longer can, so it is still swept and
 * the sweeps assert equality across it.
 *
 * `'daily'` is what a server-side nightly job does; `'on-training-days'` is a
 * pure client with nothing behind it; `'never'` is a player who is never seen
 * between sessions at all.
 */
type OpeningSchedule = 'daily' | 'on-training-days' | 'never' | 'every-third-day' | 'first-day-only';

function opensOn(schedule: OpeningSchedule, index: number, trained: boolean): boolean {
  switch (schedule) {
    case 'daily':
      return true;
    case 'on-training-days':
      return trained;
    case 'never':
      return false;
    case 'every-third-day':
      return index % 3 === 0;
    case 'first-day-only':
      return index === 0;
  }
}

/**
 * Replays a history of consecutive days. `attend[i]` is whether the player
 * trained on day i; `grantOn[i]` whether a one-Recovery-Day grant lands that
 * morning. Breaks are settled on any day the app is opened, exactly as an app
 * would.
 *
 * `settleAtEnd` opens the final day one last time so the returned state is
 * settled rather than stale — see the staleness test for what that is worth.
 */
function simulate(
  attend: readonly boolean[],
  grantOn: readonly boolean[],
  initial: StreakState,
  opens: OpeningSchedule = 'daily',
  settleAtEnd = false,
): SimResult {
  let state = initial;
  let spent = 0;
  let revealsSeen = 0;

  const open = (from: StreakState, day: StreakDay, count: boolean): StreakState => {
    const opening = openDay(from, day);
    if (count && opening.kind === 'gap-covered-by-recovery-days') revealsSeen += 1;
    if (opening.kind === 'streak-broken') return unwrap(settleBrokenStreak(from, day)).state;
    return from;
  };

  for (let i = 0; i < attend.length; i += 1) {
    const day = addDays(DAY_ZERO, i);
    if (grantOn[i] === true) {
      state = unwrap(grantRecoveryDays(state, { source: 'purchase-chalk', amount: 1 })).state;
    }
    if (opensOn(opens, i, attend[i] === true)) state = open(state, day, true);
    if (attend[i] === true) {
      const before = state.recoveryDayBalance;
      const outcome = unwrap(recordTrainingDay(state, day));
      // Local invariants, checked on every recorded session in every simulation
      // in this file. A bare throw rather than `expect`: the exhaustive sweeps
      // run this a few million times and `expect` is expensive enough to turn a
      // half-second test into a half-minute one.
      const saved = outcome.recoveryDaySave?.recoveryDaysSpent ?? 0;
      const lost = outcome.recoveryDaysLostToTheAbsence;
      const debited = saved + lost;
      if (outcome.state.recoveryDayBalance !== before - debited + outcome.recoveryDaysGranted) {
        throw new Error(`day ${i}: balance moved by something other than the absence and the milestone`);
      }
      // A SAVE AND A LOSS ARE MUTUALLY EXCLUSIVE. Both are debits, and they are
      // reported separately precisely so a UI cannot confuse "your run held" with
      // "your run did not, and here is what it cost".
      if (saved > 0 && lost > 0) {
        throw new Error(`day ${i}: reported a save and a loss for one absence`);
      }
      if (saved > 0 && outcome.previousRunEnded) {
        throw new Error(`day ${i}: a SAVE was reported for an absence that ended the run`);
      }
      if (lost > 0 && !outcome.previousRunEnded) {
        throw new Error(`day ${i}: a LOSS was reported for an absence that did not end a run`);
      }
      if ((outcome.state.armedRecoveryDays ?? 0) > outcome.state.recoveryDayBalance) {
        throw new Error(`day ${i}: armed ${outcome.state.armedRecoveryDays} exceeds the balance`);
      }
      if (outcome.streakAfter < 1) throw new Error(`day ${i}: streak ${outcome.streakAfter}`);
      spent += debited;
      state = outcome.state;
    }
  }
  if (settleAtEnd && attend.length > 0) {
    // The settling open is bookkeeping the harness does, not a visit the
    // simulated player made, so it does not count as a reveal they were shown.
    state = open(state, addDays(DAY_ZERO, attend.length - 1), false);
  }
  return { state, recoveryDaysSpent: spent, revealsSeen };
}

/**
 * Recovery Days a state has COMMITTED as of `today`: banked plus whatever is
 * holding an absence still in progress.
 *
 * NEEDED BECAUSE THE DEBIT IS DEFERRED. A player standing in an absence has not
 * been charged yet — the training day that ends it does that — so a comparison
 * that reads only the banked figure would call them a zero-spend player and
 * compare them against someone who has already paid. That is a measurement
 * artefact, not a property of the design, and this closes it.
 *
 * IT COUNTS DOOMED ABSENCES TOO, since the signup-day rework: `recoveryDays
 * Consumed` is what the absence in flight will cost whether or not it saved the
 * run, where the old version read `recoveryDaysHolding` and therefore counted a
 * doomed absence as free. Reading the old field here would under-count exactly
 * the player the comparison exists to be fair to.
 */
function committedRecoveryDays(result: SimResult, today: StreakDay): number {
  const absence = absenceOutcome(result.state, today);
  return result.recoveryDaysSpent + absence.recoveryDaysConsumed;
}

const trainedDayCount = (history: readonly boolean[]): number => history.filter(Boolean).length;

/** `T` trained, `.` idle — so a failing case names itself in the error. */
const renderCalendar = (history: readonly boolean[]): string =>
  history.map((trained) => (trained ? 'T' : '.')).join('');

// ---------------------------------------------------------------------------
// THE DECISIVE INVARIANT: the outcome does not depend on when the player looks
// ---------------------------------------------------------------------------

describe('the outcome does not depend on when the player opens the app', () => {
  it('OPEN-DAY OFFSET: identical final state whether they return the next day, in three days, in ten, or never', () => {
    // THE INVARIANT THE REWORK EXISTS FOR, in its most direct form. Same
    // training history, same armed state; the only thing that varies is which
    // days the app is opened on between the miss and the return.
    //
    // A player trains for a week, misses days, and comes back. Sweep every
    // subset-ish schedule of mid-absence opens against no opens at all, at every
    // absence length either side of the ceiling and every balance.
    const rows: string[] = [];
    let casesChecked = 0;
    let coveredCases = 0;
    let brokenCases = 0;

    for (let balance = 0; balance <= RECOVERY_DAY_GUARDRAILS.HOLD_CAP; balance += 1) {
      for (let away = 1; away <= LONGEST_REPAIRABLE_ABSENCE_DAYS + 6; away += 1) {
        const returnDay = away + 1;
        const schedules: readonly ((offset: number) => boolean)[] = [
          () => false, // never looked until the day they trained
          (o) => o === 1, // looked the very next day
          (o) => o === 3, // three days later
          (o) => o === 10, // ten days later (past the end, on short absences)
          () => true, // looked every single day
          (o) => o % 2 === 0, // looked every other day
          (o) => o === returnDay, // looked only on the day they came back
        ];
        const baseline = playAbsence(away, balance, schedules[0] as (o: number) => boolean);
        if (baseline.survived) coveredCases += 1;
        else brokenCases += 1;
        for (const schedule of schedules.slice(1)) {
          const played = playAbsence(away, balance, schedule);
          casesChecked += 1;
          if (
            played.survived !== baseline.survived ||
            played.spent !== baseline.spent ||
            played.streakOnReturn !== baseline.streakOnReturn ||
            played.balanceOnReturn !== baseline.balanceOnReturn ||
            JSON.stringify(played.state) !== JSON.stringify(baseline.state)
          ) {
            rows.push(
              `away=${away} balance=${balance}: ${JSON.stringify(played.state)} vs ` +
                `${JSON.stringify(baseline.state)} (spent ${played.spent} vs ${baseline.spent})`,
            );
          }
        }
      }
    }
    expect(rows).toEqual([]);
    // ANTI-VACUITY. The sweep must have reached both sides of the ceiling, or
    // "identical" would be a statement about absences nothing ever happened in.
    expect(casesChecked).toBeGreaterThan(200);
    expect(coveredCases).toBeGreaterThan(0);
    expect(brokenCases).toBeGreaterThan(0);
  });

  it('OPEN-DAY SCHEDULE, EXHAUSTIVE: every 13-day calendar ends identically under five opening schedules', () => {
    // The same invariant over whole calendars rather than one absence, so that
    // multiple absences, milestone payouts and rebuilt runs are all inside it.
    // FULL STATE EQUALITY — streak, longest, balance, armed count, the lot —
    // plus the number of Recovery Days actually debited.
    const LENGTH = 13;
    const initial = freshState();
    const noGrants = Array.from({ length: LENGTH }, () => false);
    const schedules: readonly OpeningSchedule[] = [
      'daily',
      'on-training-days',
      'never',
      'every-third-day',
      'first-day-only',
    ];
    const rows: string[] = [];
    let revealsUnderDaily = 0;
    let revealsUnderNever = 0;

    for (let mask = 0; mask < 1 << LENGTH; mask += 1) {
      const attend = Array.from({ length: LENGTH }, (_, i) => (mask & (1 << i)) !== 0);
      const baseline = simulate(attend, noGrants, initial, 'daily', true);
      revealsUnderDaily += baseline.revealsSeen;
      for (const schedule of schedules.slice(1)) {
        const other = simulate(attend, noGrants, initial, schedule, true);
        if (schedule === 'never') revealsUnderNever += other.revealsSeen;
        if (
          JSON.stringify(other.state) !== JSON.stringify(baseline.state) ||
          other.recoveryDaysSpent !== baseline.recoveryDaysSpent
        ) {
          rows.push(
            `${renderCalendar(attend)} under ${schedule}: ${JSON.stringify(other.state)} ` +
              `(spent ${other.recoveryDaysSpent}) vs daily ${JSON.stringify(baseline.state)} ` +
              `(spent ${baseline.recoveryDaysSpent})`,
          );
        }
      }
    }
    expect(rows).toEqual([]);

    // ANTI-VACUITY, and it needs both halves. The schedules have to have been
    // genuinely different — a player who opens daily is shown many reveals and
    // one who never opens is shown none — or this is an equality between five
    // copies of the same simulation.
    expect(revealsUnderDaily).toBeGreaterThan(0);
    expect(revealsUnderNever).toBe(0);
  });

  it('OPEN-DAY SCHEDULE, WITH GRANTS AND LONG RANDOM CALENDARS', () => {
    // Grants landing mid-history are the case the armed snapshot exists for: a
    // Recovery Day that arrives during an absence must not rescue it, or the
    // GDD §4.2 Gym Empire drop (which lands on a check-in) would make coverage
    // depend on opening the app.
    const rng = mulberry32(0x09e2_31f5);
    const initial = freshState();
    let trials = 0;
    let grantsLanded = 0;

    for (let trial = 0; trial < 300; trial += 1) {
      const length = 20 + Math.floor(rng() * 40);
      const attendance = 0.2 + rng() * 0.7;
      const attend = Array.from({ length }, () => rng() < attendance);
      const grantOn = Array.from({ length }, () => rng() < 0.15);
      grantsLanded += grantOn.filter(Boolean).length;
      const baseline = simulate(attend, grantOn, initial, 'never', true);
      for (const schedule of ['daily', 'on-training-days', 'every-third-day'] as const) {
        const other = simulate(attend, grantOn, initial, schedule, true);
        expect(other.state).toEqual(baseline.state);
        expect(other.recoveryDaysSpent).toBe(baseline.recoveryDaysSpent);
      }
      trials += 1;
    }
    expect(trials).toBe(300);
    expect(grantsLanded).toBeGreaterThan(100);
  });

  it('settling a break is a recording, not a decision: doing it early, late, twice or never is the same', () => {
    // `settleBrokenStreak` is the only state change an app-open can trigger.
    // If it could change an outcome, the invariant above would be luck.
    const state: StreakState = { ...stateWithRun(30, DAY_ZERO, 1), armedRecoveryDays: 1 };
    const brokenOn = dayAfterGap(DAY_ZERO, LONGEST_REPAIRABLE_ABSENCE_DAYS + 3);

    const never = unwrap(recordTrainingDay(state, brokenOn));

    let early: StreakState = state;
    for (let offset = GRACE + 2; offset < daysBetween(DAY_ZERO, brokenOn); offset += 1) {
      const result = settleBrokenStreak(early, addDays(DAY_ZERO, offset));
      if (result.ok) early = result.value.state;
    }
    const afterEarly = unwrap(recordTrainingDay(early, brokenOn));

    expect(afterEarly.state).toEqual(never.state);
    expect(afterEarly.streakAfter).toBe(never.streakAfter);
    // Not vacuous: the run really did end, and settling really did happen.
    expect(never.previousRunEnded).toBe(true);
    expect(early.lastTrainedDay).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// "Never punish daily engagement"
// ---------------------------------------------------------------------------

/**
 * THE MONOTONICITY MEASUREMENT: what "training one more day never costs you
 * anything" is worth as a number, at the tunables `streak.ts` currently ships.
 *
 * A VIOLATION is a pair of calendars identical except that one has one extra
 * trained day, where the player who trained MORE ends on a strictly LOWER
 * `currentStreak`. Both members of a pair are SETTLED to the same final day
 * before they are compared — see the staleness test for why comparing unsettled
 * states gets the answer wrong in both directions.
 *
 * EVERY NUMBER HERE WAS MEASURED, none was derived, and they all move if
 * `RECOVERY_DAY_GUARDRAILS` or `STREAK_MILESTONE_DAYS` move. That is the point
 * of pinning them: retuning changes how badly a player can be punished for
 * training more, so it should break this file and make somebody read the new
 * number rather than change it quietly.
 */
const MONOTONICITY_MEASUREMENT = {
  /**
   * Calendar lengths swept EXHAUSTIVELY — all 2^L calendars of each length, and
   * every way of turning one skipped day into a trained one.
   *
   * The range starts below the length at which the defect used to first appear,
   * so a sweep that "passes" by starting above the interesting length is not
   * what is happening here.
   */
  EXHAUSTIVE_LENGTHS: [8, 9, 10, 11, 12, 13, 14, 15, 16],

  /**
   * Violating pairs at each of those lengths. ZERO, everywhere.
   *
   * WHAT IT WAS, so the change is a measurement rather than a claim: before the
   * signup-day rework this file pinned 36 violating pairs at 13 days (worst
   * deficit 3) and 384 at 15 days (worst deficit 5), with the worst deficit
   * climbing 0,0,0,1,2,3,4,5,6 across exactly the lengths above.
   */
  VIOLATIONS_BY_LENGTH: [0, 0, 0, 0, 0, 0, 0, 0, 0],

  /** Worst `currentStreak` deficit at each length. Zero, because there are none. */
  WORST_DEFICIT_BY_LENGTH: [0, 0, 0, 0, 0, 0, 0, 0, 0],

  /**
   * The same, for `longestStreak` — a lifter's lifetime best, which the old
   * defect also inverted (5 pairs at 13 days, 66 at 15).
   */
  LONGEST_STREAK_INVERSIONS_BY_LENGTH: [0, 0, 0, 0, 0, 0, 0, 0, 0],

  /**
   * THE TWO LENGTHS THIS FILE USED TO PIN, kept by name so the before/after can
   * be read without reconstructing it from the arrays above.
   */
  WAS_AT_13: { VIOLATIONS: 36, WORST_DEFICIT: 3 },
  WAS_AT_15: { VIOLATIONS: 384, WORST_DEFICIT: 5 },

  /**
   * NEITHER HALF OF THE FIX WORKS ALONE, at 13 days. Measured on a standalone
   * model of this engine that reproduces the committed before-numbers exactly
   * (36 and 384 pairs, worst 3 and 5), with one half of the fix switched off at
   * a time:
   *
   *   - signup-day anchor only, doomed absences still free ....... 32 pairs
   *   - doomed absences charged only, no signup anchor ............ 24 pairs
   *   - both ..................................................... 0 pairs
   *
   * THESE TWO ARE HISTORY RATHER THAN ASSERTIONS — the shipped engine cannot be
   * run with half the fix, so nothing here can check them. They are recorded
   * because "the ruled mechanism was not sufficient on its own" is the single
   * most important thing a future reader needs to know about this rework.
   */
  ANCHOR_ALONE_VIOLATIONS_AT_13: 32,
  DOOM_CHARGE_ALONE_VIOLATIONS_AT_13: 24,
} as const;

/**
 * The seeded 40-day sweep: the measurement the human asked for by name, because
 * the exhaustive lengths stop at 16 and forty days is a real training block.
 *
 * `mulberry32` is deterministic and the seeds are written down, so these numbers
 * are reproducible rather than "a random sample looked fine".
 */
const FORTY_DAY_SWEEP = {
  LENGTH: 40,
  SCHEDULES_PER_SEED: 400,

  /**
   * Attendance is drawn once per schedule and then applied per day, so the
   * sweep contains near-daily lifters and near-absent ones rather than 400
   * copies of the same density.
   */
  MIN_ATTENDANCE: 0.2,
  ATTENDANCE_SPREAD: 0.7,

  SEEDS: [0x5eed_1eaf, 0x09e2_31f5, 1, 0xc0ffee, 0xdead_beef],

  /**
   * Violating PAIRS per seed, in the order above.
   *
   * THE FIRST SEED WAS 36 VIOLATING SCHEDULES / 100 VIOLATING PAIRS / WORST
   * DEFICIT 16 before the rework, which is the measurement that opened this
   * piece. It is 0 now, and 13 pairs remain across all five seeds put together.
   * Every one of those 13 has the same cause: see `MILESTONE_INCOME_RESIDUE`,
   * which measures it rather than asserting it.
   *
   * PINNED RATHER THAN BOUNDED, deliberately. `toBeLessThan(20)` would let this
   * drift back up to 19 without anybody noticing.
   */
  VIOLATING_PAIRS_BY_SEED: [0, 0, 11, 2, 0],

  /** Worst `currentStreak` deficit per seed. */
  WORST_DEFICIT_BY_SEED: [0, 0, 7, 13, 0],

  /** What the first seed returned before the rework, for the side-by-side. */
  WAS_AT_FIRST_SEED: { VIOLATING_SCHEDULES: 36, VIOLATING_PAIRS: 100, WORST_DEFICIT: 16 },
} as const;

/**
 * THE RESIDUE'S CAUSE, MEASURED. Streak-milestone income is paid once per
 * lifetime and its arrival is timed by the streak, so the player who trains
 * more banks a Recovery Day EARLIER and can lose it to a doomed absence that
 * the lazier player — whose identical payout has not arrived yet — walks away
 * from with the Recovery Day still in hand.
 *
 * The counterfactual runs against the REAL engine rather than a model: a lifter
 * whose `longestStreak` already exceeds the largest milestone can never reach
 * one again, so `milestonesReached` is empty for every session and the
 * streak-milestone income path is off. With it off the sweep is clean at 40 AND
 * 60 days at every seed, which is what makes "milestone timing is the cause" a
 * measurement instead of a story.
 *
 * NOBODY HAS RULED ON IT. Both obvious fixes — paying milestones on a schedule
 * that is not the streak, or protecting income from a doomed absence — change
 * GDD §4.2's earning table, which is a monetisation decision rather than a
 * streak one.
 */
const MILESTONE_INCOME_RESIDUE = {
  /** Lengths the counterfactual sweeps. 60 as well as 40: the residue grows. */
  LENGTHS: [40, 60],
  /** Violating pairs with milestone income unreachable. Zero at every seed. */
  VIOLATING_PAIRS: 0,
} as const;

/**
 * Recovery Days both lifters in the constructive family below start on.
 *
 * Two rather than the signup grant, because the family is a machine for
 * draining a bank and it has to start from a known one. It is ARMED as well as
 * held, since a hand-built state with nothing armed is a lifter who trained
 * while holding nothing and every Recovery Day case built on it would pass by
 * never spending anything.
 */
const FAMILY_STARTING_BALANCE = 2;

/**
 * Run lengths the constructive family is instantiated at. None of them is a
 * milestone or one day short of one — `inversionHistories` refuses those and
 * says why.
 */
const FAMILY_RUN_LENGTHS: readonly number[] = [8, 19, 31, 50, 101, 365, 1000];

/**
 * Builds the two histories of the inversion family. They are identical except
 * that the diligent player ALSO trains on day 0 — one extra session, nothing
 * else.
 *
 * `runLost` is the streak the lazy player is carrying when the diligent
 * player's run dies (the diligent player's own run is one longer, since it
 * includes day 0). `runRebuilt` is how many days both then train afterwards.
 *
 * THE SHAPE. The diligent player trains day 0, and the absence that follows is
 * covered by the Recovery Days they armed there — coverage the lazy player,
 * holding no live run, never pays for. From then on the histories are
 * identical, so the diligent player is simply one Recovery Day poorer, forever.
 * Chargeable absences are then placed to draw both banks down — one
 * immediately, and one after each milestone payout that lands inside the run —
 * until the lazy player holds exactly one Recovery Day and the diligent player
 * holds none. The next chargeable absence is covered for the lazy player and
 * fatal for the diligent one.
 *
 * IT SURVIVED THE REMOVAL OF THE PROMPT UNCHANGED, which is the finding that
 * matters: the family was built when Recovery Days were spent by answering a
 * prompt, and it produces the same numbers now that they are spent by the
 * calendar.
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
        'the trained day that keeps the draw-down absence and the fatal absence from running together',
    );
  }

  const lazy: boolean[] = [];
  /** One chargeable absence: the shortest a Recovery Day is charged for. */
  const pushGap = (): void => {
    for (let i = 0; i < SHORTEST_PAID_GAP; i += 1) lazy.push(false);
  };

  lazy.push(false); // day 0 — the one divergent day; the diligent player trains it
  pushGap(); // the absence only the diligent player pays to survive
  lazy.push(true); // both start (or restart) their run here
  let lazyStreak = 1;
  pushGap(); // first draw-down: lazy balance 2 -> 1, diligent 1 -> 0

  for (const milestone of STREAK_MILESTONE_DAYS) {
    if (milestone > runLost) break;
    while (lazyStreak < milestone) {
      lazy.push(true);
      lazyStreak += 1;
    }
    pushGap(); // draw down the milestone payout that just landed for both
    // A trained day between consecutive absences, so two draw-downs never run
    // together into one longer (and therefore more expensive) absence.
    lazy.push(true);
    lazyStreak += 1;
  }

  while (lazyStreak < runLost) {
    lazy.push(true);
    lazyStreak += 1;
  }
  pushGap(); // the fatal absence: covered for the lazy player, not for the other
  for (let i = 0; i < runRebuilt; i += 1) lazy.push(true);

  return { lazy, diligent: lazy.map((trained, i) => (i === 0 ? true : trained)) };
}

describe('daily engagement is never worse than skipping — where that holds, and where it does not', () => {
  it('training today beats skipping today, step by step, from any live state', () => {
    for (const streak of [1, 6, 7, 29, 30, 99]) {
      for (let balance = 0; balance <= RECOVERY_DAY_GUARDRAILS.HOLD_CAP; balance += 1) {
        const state = stateWithRun(streak, DAY_ZERO, balance);
        const today = addDays(DAY_ZERO, 1);
        const trained = unwrap(recordTrainingDay(state, today)).state;

        expect(trained.currentStreak).toBe(streak + 1);
        expect(trained.currentStreak).toBeGreaterThan(state.currentStreak);
        expect(trained.longestStreak).toBeGreaterThanOrEqual(state.longestStreak);
        expect(trained.recoveryDayBalance).toBeGreaterThanOrEqual(state.recoveryDayBalance);
        expect(coverableGapDays(trained)).toBeGreaterThanOrEqual(coverableGapDays(state));
      }
    }
  });

  it('showing up 365 days running never breaks, never costs, and never errors', () => {
    let state: StreakState = freshState();
    for (let i = 0; i < 365; i += 1) {
      const day = addDays(DAY_ZERO, i);
      expect(openDay(state, day).kind).toBe(i === 0 ? 'no-active-streak' : 'streak-alive');
      const outcome = unwrap(recordTrainingDay(state, day));
      expect(outcome.previousRunEnded).toBe(false);
      expect(outcome.recoveryDaySave).toBeNull();
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

  it('PROPERTY, EXHAUSTIVE, PROTECTION DECLINED: training an extra day never loses ground', () => {
    // The streak mechanic on its own, with the GDD §4.2 toggle off so no
    // Recovery Day is ever spent. Nothing but showing up moves the numbers, and
    // showing up more must never move them down — over ALL 2^10 attendance
    // patterns rather than a sample.
    //
    // THE NAME SAYS "PROTECTION DECLINED" BECAUSE THAT IS THE WHOLE OF WHAT IS
    // CHECKED. With protection on this property is FALSE, by an unbounded
    // margin — see the tests below.
    const LENGTH = 10;
    const initial: StreakState = {
      ...freshState(),
      recoveryDayBalance: 2,
      recoveryDayProtectionEnabled: false,
      armedRecoveryDays: null,
    };
    const noGrants = Array.from({ length: LENGTH }, () => false);
    let casesChecked = 0;

    for (let mask = 0; mask < 1 << LENGTH; mask += 1) {
      const attend = Array.from({ length: LENGTH }, (_, i) => (mask & (1 << i)) !== 0);
      for (let flip = 0; flip < LENGTH; flip += 1) {
        if (attend[flip] === true) continue;
        const attendMore = attend.map((trained, i) => (i === flip ? true : trained));
        const lazy = simulate(attend, noGrants, initial, 'daily', true);
        const diligent = simulate(attendMore, noGrants, initial, 'daily', true);
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

  it('PROPERTY, PROTECTION DECLINED: holds over long randomised histories with grants landing mid-run', () => {
    const random = mulberry32(0x5eed_1eaf);
    const initial: StreakState = {
      ...freshState(),
      recoveryDayBalance: 2,
      recoveryDayProtectionEnabled: false,
      armedRecoveryDays: null,
    };
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

      const lazy = simulate(attend, grantOn, initial, 'daily', true);
      const diligent = simulate(attendMore, grantOn, initial, 'daily', true);
      casesChecked += 1;

      expect(diligent.state.currentStreak).toBeGreaterThanOrEqual(lazy.state.currentStreak);
      expect(diligent.state.longestStreak).toBeGreaterThanOrEqual(lazy.state.longestStreak);
      expect(diligent.state.recoveryDayBalance).toBeGreaterThanOrEqual(lazy.state.recoveryDayBalance);
    }
    expect(casesChecked).toBeGreaterThan(350);
  });

  it('THE OLD MINIMAL CASE IS STILL FIXED: single missed days cost nothing, so they cannot invert', () => {
    // KEPT, NOT DELETED, because it is the before/after of the GDD §4.4 ruling.
    // These two eleven-day histories used to end on best streaks of 2 and 1 —
    // the player who trained MORE ending lower. With every gap here one day
    // long, the free grace covers them all and the inversion is gone.
    const initial: StreakState = { ...freshState(), recoveryDayBalance: 2 };
    const parse = (pattern: string): boolean[] => [...pattern].map((c) => c === 'T');
    const noGrants = Array.from({ length: 11 }, () => false);

    const lazy = simulate(parse('....T.T....'), noGrants, initial, 'daily', true);
    const diligent = simulate(parse('T...T.T....'), noGrants, initial, 'daily', true);

    expect(diligent.state.currentStreak).toBeGreaterThan(lazy.state.currentStreak);
    expect(diligent.state.longestStreak).toBeGreaterThan(lazy.state.longestStreak);
  });

  it('THE NAMED MINIMAL PAIR IS FIXED: {5,6,7} and {0,5,6,7} now end level, and the extra day is never worse', () => {
    // THE PAIR THE RULING WAS WRITTEN AROUND, converted from a defect pin to a
    // regression guard. Before the signup-day rework: `{5,6,7}` ended on a live
    // streak of 3 with the day-12 gap covered and 3 Recovery Days in hand, and
    // `{0,5,6,7}` — one extra session, nothing else different — ended on 0 with
    // the gap uncovered, because training day 0 opened an absence that ate two
    // Recovery Days the lazier history never paid for.
    //
    // The idle days 1-4 are now charged to BOTH lifters, because both are
    // anchored at their signup day, so there is nothing for the extra session to
    // convert from free into charged.
    const initial = freshState();
    const mask = (days: readonly number[]): boolean[] =>
      Array.from({ length: 13 }, (_, i) => days.includes(i));
    const noGrants = Array.from({ length: 13 }, () => false);

    const lazyHistory = mask([5, 6, 7]);
    const diligentHistory = mask([0, 5, 6, 7]);
    expect(trainedDayCount(diligentHistory)).toBe(trainedDayCount(lazyHistory) + 1);

    for (const schedule of ['daily', 'on-training-days', 'never'] as const) {
      const lazy = simulate(lazyHistory, noGrants, initial, schedule, true);
      const diligent = simulate(diligentHistory, noGrants, initial, schedule, true);

      // NOT WORSE on the live streak, and STRICTLY BETTER on the lifetime best.
      expect(diligent.state.currentStreak).toBeGreaterThanOrEqual(lazy.state.currentStreak);
      expect(diligent.state.longestStreak).toBeGreaterThan(lazy.state.longestStreak);
      // Both pay the same, which is what "charge both sides" means as a number.
      expect(diligent.recoveryDaysSpent).toBe(lazy.recoveryDaysSpent);
      expect(diligent.state.recoveryDayBalance).toBe(lazy.state.recoveryDayBalance);
    }

    // THE EXACT FIGURES, so a retune has to re-read them rather than move them
    // silently. Both runs are dead by day 12 — a four-day gap outruns the one
    // Recovery Day either lifter has left — and the diligent lifter's lifetime
    // best is 4 against 3.
    const lazy = simulate(lazyHistory, noGrants, initial, 'daily', true);
    const diligent = simulate(diligentHistory, noGrants, initial, 'daily', true);
    expect(lazy.state.currentStreak).toBe(0);
    expect(diligent.state.currentStreak).toBe(0);
    expect(lazy.state.longestStreak).toBe(3);
    expect(diligent.state.longestStreak).toBe(4);
    expect(lazy.recoveryDaysSpent).toBe(2);
    expect(diligent.recoveryDaysSpent).toBe(2);
  });

  it('WAS "37 TRAINED DAYS END ON 37, 38 END ON 18": the constructive family no longer inverts', () => {
    // THE HEADLINE THE HUMAN QUOTED WHEN ORDERING THIS PIECE. `inversionHistories`
    // is kept exactly as it was — it is a machine for building the worst case the
    // old engine had — and run against the new one. Six weeks of training, one
    // extra session, and the diligent lifter is no longer nineteen days down.
    //
    // THIS FAMILY IS ALSO WHAT REFUTED THE OLD DIAGNOSIS. GDD §4.4 blamed the
    // manual Recovery Day prompt, citing the Duolingo freeze as an armed-ahead
    // design with no such residue. Deleting the prompt was run as a clean test
    // of that claim and this family did not move by a single day.
    const initial: StreakState = {
      ...freshState(),
      recoveryDayBalance: FAMILY_STARTING_BALANCE,
      armedRecoveryDays: FAMILY_STARTING_BALANCE,
    };
    const { lazy: lazyHistory, diligent: diligentHistory } = inversionHistories(19, 18);
    const noGrants = Array.from({ length: lazyHistory.length }, () => false);

    const lazy = simulate(lazyHistory, noGrants, initial, 'daily', true);
    const diligent = simulate(diligentHistory, noGrants, initial, 'daily', true);

    expect(trainedDayCount(lazyHistory)).toBe(37);
    expect(trainedDayCount(diligentHistory)).toBe(38);
    expect(diligentHistory.filter((trained, i) => trained !== lazyHistory[i])).toEqual([true]);

    // WAS 37 against 18. Both end on 18 now — the family's absences cost both
    // lifters the same, so both runs die in the same place — and the diligent
    // lifter's lifetime best is HIGHER rather than seventeen days lower.
    expect(lazy.state.currentStreak).toBe(18);
    expect(diligent.state.currentStreak).toBe(18);
    expect(lazy.state.longestStreak).toBe(19);
    expect(diligent.state.longestStreak).toBe(20);
    expect(diligent.recoveryDaysSpent).toBe(lazy.recoveryDaysSpent);

    // AND IT IS THE SAME UNDER EVERY OPENING SCHEDULE.
    for (const schedule of ['on-training-days', 'never', 'every-third-day'] as const) {
      expect(simulate(diligentHistory, noGrants, initial, schedule, true).state).toEqual(diligent.state);
      expect(simulate(lazyHistory, noGrants, initial, schedule, true).state).toEqual(lazy.state);
    }
  });

  it('WAS "THE DEFICIT HAS NO CEILING": the same family is level at every run length up to 1000', () => {
    // The old version of this test proved the deficit was exactly the length of
    // the run that died, at any run length — one day, or a thousand. The machine
    // that built those cases is unchanged; what it produces now is two lifters
    // who end on the same streak, the same lifetime best and the same spend.
    const initial: StreakState = {
      ...freshState(),
      recoveryDayBalance: FAMILY_STARTING_BALANCE,
      armedRecoveryDays: FAMILY_STARTING_BALANCE,
    };
    const lifetimeFreeIncome = FAMILY_STARTING_BALANCE + STREAK_MILESTONE_DAYS.length;

    for (const runLost of FAMILY_RUN_LENGTHS) {
      const runRebuilt = runLost + 1;
      const { lazy: lazyHistory, diligent: diligentHistory } = inversionHistories(runLost, runRebuilt);
      const noGrants = Array.from({ length: lazyHistory.length }, () => false);

      const lazy = simulate(lazyHistory, noGrants, initial, 'daily', true);
      const diligent = simulate(diligentHistory, noGrants, initial, 'daily', true);

      expect(trainedDayCount(diligentHistory)).toBe(trainedDayCount(lazyHistory) + 1);
      // The lazy lifter's final run is the rebuild, because the fatal absence is
      // now fatal for both of them rather than for the diligent one alone.
      expect(lazy.state.currentStreak).toBe(runRebuilt);
      expect(diligent.state.currentStreak).toBe(runRebuilt);
      expect(diligent.state.longestStreak).toBeGreaterThanOrEqual(lazy.state.longestStreak);
      expect(diligent.recoveryDaysSpent).toBe(lazy.recoveryDaysSpent);
      expect(lazy.recoveryDaysSpent).toBeLessThanOrEqual(lifetimeFreeIncome);

      // STRUCTURAL FACT THE FAMILY DEPENDS ON, checked rather than asserted in
      // prose: inside the live run every absence is exactly SHORTEST_PAID_GAP
      // days long. One day shorter and the free grace covers it for nothing.
      const firstTrainedDay = lazyHistory.indexOf(true);
      let idleRun = 0;
      for (let i = firstTrainedDay; i < lazyHistory.length; i += 1) {
        idleRun = lazyHistory[i] === true ? 0 : idleRun + 1;
        expect(idleRun).toBeLessThanOrEqual(SHORTEST_PAID_GAP);
      }
      expect(SHORTEST_PAID_GAP).toBeGreaterThan(GRACE);
    }

    expect(Math.max(...FAMILY_RUN_LENGTHS)).toBe(1000);
  });

  it('MONOTONICITY, EXHAUSTIVE: over every calendar of 8 to 16 days, one more trained day never loses ground', () => {
    // THE MEASUREMENT THIS PIECE EXISTS FOR, and the instrument is the same one
    // that recorded the defect — all 2^L calendars at each length, every way of
    // turning one skipped day into a trained one, both members settled to the
    // same final day before they are compared.
    //
    // WAS 36 violating pairs at 13 days (worst deficit 3) and 384 at 15 (worst
    // 5), with the worst deficit climbing 0,0,0,1,2,3,4,5,6 across exactly these
    // lengths. It is now zero everywhere, on `currentStreak` AND on the lifetime
    // best. `MONOTONICITY_MEASUREMENT` above has the before-and-after side by
    // side and says which halves of the fix were needed.
    const initial = freshState();
    const violationsByLength: number[] = [];
    const worstByLength: number[] = [];
    const longestInversionsByLength: number[] = [];
    let pairsChecked = 0;
    let deadRunsSeen = 0;
    let savesSeen = 0;

    for (const length of MONOTONICITY_MEASUREMENT.EXHAUSTIVE_LENGTHS) {
      const noGrants = Array.from({ length }, () => false);
      const results: SimResult[] = [];
      for (let mask = 0; mask < 1 << length; mask += 1) {
        const attend = Array.from({ length }, (_, i) => (mask & (1 << i)) !== 0);
        const result = simulate(attend, noGrants, initial, 'daily', true);
        results.push(result);
        if (result.state.currentStreak === 0) deadRunsSeen += 1;
        savesSeen += result.recoveryDaysSpent;
      }

      let violations = 0;
      let worst = 0;
      let longestInversions = 0;
      for (let mask = 0; mask < 1 << length; mask += 1) {
        const lazy = results[mask] as SimResult;
        for (let flip = 0; flip < length; flip += 1) {
          if ((mask & (1 << flip)) !== 0) continue;
          const diligent = results[mask | (1 << flip)] as SimResult;
          pairsChecked += 1;
          const deficit = lazy.state.currentStreak - diligent.state.currentStreak;
          if (deficit > 0) {
            violations += 1;
            worst = Math.max(worst, deficit);
          }
          if (diligent.state.longestStreak < lazy.state.longestStreak) longestInversions += 1;
        }
      }
      violationsByLength.push(violations);
      worstByLength.push(worst);
      longestInversionsByLength.push(longestInversions);
    }

    expect(violationsByLength).toEqual([...MONOTONICITY_MEASUREMENT.VIOLATIONS_BY_LENGTH]);
    expect(worstByLength).toEqual([...MONOTONICITY_MEASUREMENT.WORST_DEFICIT_BY_LENGTH]);
    expect(longestInversionsByLength).toEqual([
      ...MONOTONICITY_MEASUREMENT.LONGEST_STREAK_INVERSIONS_BY_LENGTH,
    ]);

    // ANTI-VACUITY, and a zero result needs it more than a non-zero one did. A
    // sweep in which no run ever died and no Recovery Day was ever spent would
    // report zero violations while proving nothing at all.
    expect(pairsChecked).toBeGreaterThan(400_000);
    expect(deadRunsSeen).toBeGreaterThan(0);
    expect(savesSeen).toBeGreaterThan(0);

    // BOTH APP-OPENING MODELS, at the length GDD §4.4's table is written for.
    // The table has a column per model because they used to disagree (24 against
    // 36); this measures the second one directly rather than deriving it from
    // the purity invariant, so the published table is checked rather than
    // reasoned about.
    const LENGTH = 13;
    const noGrants = Array.from({ length: LENGTH }, () => false);
    const onTrainingDays: SimResult[] = [];
    for (let mask = 0; mask < 1 << LENGTH; mask += 1) {
      const attend = Array.from({ length: LENGTH }, (_, i) => (mask & (1 << i)) !== 0);
      onTrainingDays.push(simulate(attend, noGrants, initial, 'on-training-days', true));
    }
    let violationsUnderTheOtherModel = 0;
    for (let mask = 0; mask < 1 << LENGTH; mask += 1) {
      const lazy = onTrainingDays[mask] as SimResult;
      for (let flip = 0; flip < LENGTH; flip += 1) {
        if ((mask & (1 << flip)) !== 0) continue;
        const diligent = onTrainingDays[mask | (1 << flip)] as SimResult;
        if (lazy.state.currentStreak > diligent.state.currentStreak) violationsUnderTheOtherModel += 1;
      }
    }
    expect(violationsUnderTheOtherModel).toBe(0);

    // The lengths that used to fail are inside the sweep, and their old numbers
    // are on the record beside the new ones.
    expect(MONOTONICITY_MEASUREMENT.EXHAUSTIVE_LENGTHS).toContain(13);
    expect(MONOTONICITY_MEASUREMENT.EXHAUSTIVE_LENGTHS).toContain(15);
    expect(MONOTONICITY_MEASUREMENT.WAS_AT_13.VIOLATIONS).toBeGreaterThan(0);
    expect(MONOTONICITY_MEASUREMENT.WAS_AT_15.VIOLATIONS).toBeGreaterThan(
      MONOTONICITY_MEASUREMENT.WAS_AT_13.VIOLATIONS,
    );
  });

  it('MONOTONICITY, 40-DAY SEEDED SWEEP: 2000 calendars against every single-day superset', () => {
    // THE SWEEP THE HUMAN ASKED FOR BY NAME, because sixteen days of exhaustive
    // calendar is not a training block and forty is. Five written-down seeds,
    // 400 schedules each, every untrained day of every schedule flipped.
    //
    // BEFORE: 36 of the first seed's 400 schedules ended on a WORSE streak when
    // one more day was trained — 100 violating pairs, worst deficit 16.
    // AFTER: 0 on that seed, and 13 pairs across all five seeds put together.
    // The 13 are pinned rather than bounded, and the test below this one
    // measures their cause rather than describing it.
    const initial = freshState();
    const pairsBySeed: number[] = [];
    const worstBySeed: number[] = [];
    let schedulesSwept = 0;
    let deadRunsSeen = 0;

    for (const seed of FORTY_DAY_SWEEP.SEEDS) {
      const random = mulberry32(seed);
      let violations = 0;
      let worst = 0;
      for (let trial = 0; trial < FORTY_DAY_SWEEP.SCHEDULES_PER_SEED; trial += 1) {
        const attendance =
          FORTY_DAY_SWEEP.MIN_ATTENDANCE + random() * FORTY_DAY_SWEEP.ATTENDANCE_SPREAD;
        const attend = Array.from({ length: FORTY_DAY_SWEEP.LENGTH }, () => random() < attendance);
        const noGrants = Array.from({ length: FORTY_DAY_SWEEP.LENGTH }, () => false);
        const lazy = simulate(attend, noGrants, initial, 'daily', true);
        schedulesSwept += 1;
        if (lazy.state.currentStreak === 0) deadRunsSeen += 1;
        for (let flip = 0; flip < FORTY_DAY_SWEEP.LENGTH; flip += 1) {
          if (attend[flip] === true) continue;
          const attendMore = attend.map((trained, i) => (i === flip ? true : trained));
          const diligent = simulate(attendMore, noGrants, initial, 'daily', true);
          const deficit = lazy.state.currentStreak - diligent.state.currentStreak;
          if (deficit > 0) {
            violations += 1;
            worst = Math.max(worst, deficit);
          }
        }
      }
      pairsBySeed.push(violations);
      worstBySeed.push(worst);
    }

    expect(pairsBySeed).toEqual([...FORTY_DAY_SWEEP.VIOLATING_PAIRS_BY_SEED]);
    expect(worstBySeed).toEqual([...FORTY_DAY_SWEEP.WORST_DEFICIT_BY_SEED]);
    // The seed the defect was first measured on is clean.
    expect(pairsBySeed[0]).toBe(0);
    expect(FORTY_DAY_SWEEP.WAS_AT_FIRST_SEED.VIOLATING_PAIRS).toBe(100);
    expect(FORTY_DAY_SWEEP.WAS_AT_FIRST_SEED.WORST_DEFICIT).toBe(16);

    // ANTI-VACUITY: the sweep really ran, and it really reached lifters whose
    // runs died — a sweep of unbroken streaks cannot invert anything.
    expect(schedulesSwept).toBe(FORTY_DAY_SWEEP.SEEDS.length * FORTY_DAY_SWEEP.SCHEDULES_PER_SEED);
    expect(deadRunsSeen).toBeGreaterThan(0);
  });

  it('THE RESIDUE IS MILESTONE INCOME TIMING, and here is the counterfactual that says so', () => {
    // The 13 remaining pairs above are not "noise" and they are not the
    // asymmetry this piece closed. They come from streak-milestone income:
    // paid once per lifetime, timed by the streak, so the lifter who trains more
    // banks it EARLIER and can lose it to a doomed absence the lazier lifter
    // reaches with the payout still ahead of them.
    //
    // THE COUNTERFACTUAL RUNS ON THE REAL ENGINE, not a model. A lifter whose
    // `longestStreak` is already past the largest milestone can never reach one
    // again, so `milestonesReached` is empty at every session and the income path
    // is off. Same seeds, same comparator, 40 days AND 60.
    const beyondEveryMilestone: StreakState = {
      ...freshState(),
      longestStreak: Math.max(...STREAK_MILESTONE_DAYS) + 1,
    };
    let milestonesPaid = 0;
    let violations = 0;

    for (const length of MILESTONE_INCOME_RESIDUE.LENGTHS) {
      const noGrants = Array.from({ length }, () => false);
      for (const seed of FORTY_DAY_SWEEP.SEEDS) {
        const random = mulberry32(seed);
        for (let trial = 0; trial < FORTY_DAY_SWEEP.SCHEDULES_PER_SEED; trial += 1) {
          const attendance =
            FORTY_DAY_SWEEP.MIN_ATTENDANCE + random() * FORTY_DAY_SWEEP.ATTENDANCE_SPREAD;
          const attend = Array.from({ length }, () => random() < attendance);
          const lazy = simulate(attend, noGrants, beyondEveryMilestone, 'daily', true);
          for (let flip = 0; flip < length; flip += 1) {
            if (attend[flip] === true) continue;
            const attendMore = attend.map((trained, i) => (i === flip ? true : trained));
            const diligent = simulate(attendMore, noGrants, beyondEveryMilestone, 'daily', true);
            if (lazy.state.currentStreak > diligent.state.currentStreak) violations += 1;
          }
        }
      }
    }

    expect(violations).toBe(MILESTONE_INCOME_RESIDUE.VIOLATING_PAIRS);

    // NOT VACUOUS. The counterfactual has to actually switch the income off, or
    // it is the same sweep twice. A lifter at streak 1 with a lifetime best past
    // every milestone collects nothing; a fresh one collects at seven.
    const suppressed = unwrap(recordTrainingDay(beyondEveryMilestone, DAY_ZERO));
    expect(suppressed.milestonesReached).toEqual([]);
    let normal: StreakState = { ...freshState(), recoveryDayBalance: 0, armedRecoveryDays: 0 };
    const firstMilestone = STREAK_MILESTONE_DAYS[0] as number;
    for (let i = 0; i < firstMilestone; i += 1) {
      const outcome = unwrap(recordTrainingDay(normal, addDays(DAY_ZERO, i)));
      milestonesPaid += outcome.milestonesReached.length;
      normal = outcome.state;
    }
    expect(milestonesPaid).toBe(1);
  });

  it('SUBSET MONOTONICITY: training a superset of another lifter\'s days never ends below them', () => {
    // THE STRONGER FORM OF THE PROPERTY, and it replaces a weaker one that the
    // signup-day rework made VACUOUS rather than false.
    //
    // WHAT THIS USED TO BE: "N Recovery Days used never ends below a player who
    // trained fewer days and COMMITTED NONE". That comparator class has almost
    // ceased to exist. Idle days are now charged from the signup day, so a
    // lifter who trains rarely is committing Recovery Days to the absences
    // between their sessions like everybody else — and a lifter who trains
    // nothing at all commits their whole armed bank to the one long absence.
    // Filtering to zero-commitment comparators now filters to nothing, and a
    // guard that checks nothing is worse than no guard.
    //
    // WHAT IT IS NOW: for EVERY pair of calendars where one lifter trained a
    // superset of the other's days, the superset lifter never ends on a lower
    // `currentStreak`. That implies the old property wherever the old property
    // had any content, and it does not depend on a comparator class that can
    // empty out. Both members are settled to the same final day first.
    const LENGTH = 11;
    const noGrants = Array.from({ length: LENGTH }, () => false);
    const lastDay = addDays(DAY_ZERO, LENGTH - 1);
    const spendCountsExercised = new Set<number>();
    let pairsChecked = 0;
    let violations = 0;
    let comparatorsWhoCommitted = 0;

    for (let balance = 0; balance <= RECOVERY_DAY_GUARDRAILS.HOLD_CAP; balance += 1) {
      const initial: StreakState = {
        ...freshState(),
        recoveryDayBalance: balance,
        armedRecoveryDays: balance,
      };
      const results: SimResult[] = [];
      for (let mask = 0; mask < 1 << LENGTH; mask += 1) {
        const attend = Array.from({ length: LENGTH }, (_, i) => (mask & (1 << i)) !== 0);
        const result = simulate(attend, noGrants, initial, 'daily', true);
        results.push(result);
        spendCountsExercised.add(result.recoveryDaysSpent);
      }

      for (let mask = 0; mask < 1 << LENGTH; mask += 1) {
        const superset = results[mask] as SimResult;
        // Every proper submask: a lifter who trained a strict subset of A's days.
        for (let sub = (mask - 1) & mask; sub > 0; sub = (sub - 1) & mask) {
          const subset = results[sub] as SimResult;
          pairsChecked += 1;
          if (committedRecoveryDays(subset, lastDay) > 0) comparatorsWhoCommitted += 1;
          if (superset.state.currentStreak < subset.state.currentStreak) violations += 1;
        }
      }
    }

    expect(violations).toBe(0);
    expect(pairsChecked).toBeGreaterThan(100_000);

    // ANTI-VACUITY. Recovery Days really were spent across the sweep, and the
    // comparators really were committing them too — which is exactly the
    // population the old zero-commitment filter threw away.
    expect(comparatorsWhoCommitted).toBeGreaterThan(0);

    // WAS `[0, 1, 2, 3, 4]`, with a note that eleven days was not enough calendar
    // to spend the whole hold cap. It is now enough, because a doomed absence
    // takes the whole armed bank in one go (§5 of `streak.ts`).
    expect([...spendCountsExercised].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(Math.max(...spendCountsExercised)).toBe(RECOVERY_DAY_GUARDRAILS.HOLD_CAP);

    // PART TWO — DEPTH. A constructed history that spends exactly N Recovery
    // Days, for every N up to the hold cap, checked against every comparator who
    // trained a subset of its days. Kept because part one's calendars are short
    // and this one names the spend it is exercising.
    for (let n = 0; n <= RECOVERY_DAY_GUARDRAILS.HOLD_CAP; n += 1) {
      const history: boolean[] = [];
      for (let cycle = 0; cycle < n; cycle += 1) {
        history.push(true);
        for (let idle = 0; idle < SHORTEST_PAID_GAP; idle += 1) history.push(false);
      }
      history.push(true);
      const grants = Array.from({ length: history.length }, () => false);
      const initial: StreakState = {
        ...freshState(),
        recoveryDayBalance: RECOVERY_DAY_GUARDRAILS.HOLD_CAP,
        armedRecoveryDays: RECOVERY_DAY_GUARDRAILS.HOLD_CAP,
      };
      const spender = simulate(history, grants, initial, 'daily', true);
      // The construction has to actually spend N, or the loop proves nothing.
      expect(spender.recoveryDaysSpent).toBe(n);

      const trainedIndices = history.flatMap((trained, i) => (trained ? [i] : []));
      let comparatorsChecked = 0;
      for (let sub = 0; sub < 1 << trainedIndices.length; sub += 1) {
        const comparator = history.map(() => false);
        trainedIndices.forEach((dayIndex, bit) => {
          if ((sub & (1 << bit)) !== 0) comparator[dayIndex] = true;
        });
        const subset = simulate(comparator, grants, initial, 'daily', true);
        comparatorsChecked += 1;
        expect(spender.state.currentStreak).toBeGreaterThanOrEqual(subset.state.currentStreak);
      }
      expect(comparatorsChecked).toBeGreaterThan(0);
    }
  });

  it('A STREAK READ OFF AN UNOPENED STATE IS STALE, so two states settled to different days must not be compared', () => {
    // This test exists because the sweeps above are easy to get wrong. A run
    // that has already died stays on the state, at full length, until somebody
    // opens the day and settles it — so a state nobody has opened since the last
    // session reports a streak the lifter does not have.
    //
    // IT IS A READING ARTEFACT, NOT A BEHAVIOURAL ONE: the run died on the day
    // the calendar says it died. But a comparison between one settled state and
    // one stale state gets the answer wrong, which is why every sweep in this
    // file passes `settleAtEnd`.
    const initial = freshState();
    const parse = (pattern: string): boolean[] => [...pattern].map((c) => c === 'T');
    const noGrants = Array.from({ length: 13 }, () => false);
    const stale = (pattern: string): number =>
      simulate(parse(pattern), noGrants, initial, 'on-training-days', false).state.currentStreak;
    const settled = (pattern: string): number =>
      simulate(parse(pattern), noGrants, initial, 'on-training-days', true).state.currentStreak;

    // Each of these lifters trained a block and then vanished for the rest of
    // the calendar. Unsettled, every one of them still reads as a live run.
    const abandoned = ['TT...........', 'TTT..........', 'TTTT.........', '..TTT........'];
    for (const pattern of abandoned) {
      expect(stale(pattern)).toBe(trainedDayCount(parse(pattern)));
      expect(settled(pattern)).toBe(0);
    }

    // AND THE SIZE OF THE LIE GROWS WITH THE RUN, so a comparison of two stale
    // states is wrong by different amounts for each of them.
    expect(stale('TTTT.........') - stale('TT...........')).toBe(2);
    expect(settled('TTTT.........') - settled('TT...........')).toBe(0);

    // NOT VACUOUS: a lifter who is genuinely still alive reads the same either
    // way, so `settleAtEnd` is not simply zeroing everything it touches.
    expect(stale('TTTTTTTTTTTTT')).toBe(13);
    expect(settled('TTTTTTTTTTTTT')).toBe(13);
  });

  it('training debits exactly what the absence it closes consumes, and nothing else', () => {
    // The invariant that holds everywhere, restated for the charge-on-doom rule.
    // `recordTrainingDay` cannot take a Recovery Day for anything except the
    // absence it is closing, and cannot take one at all when nothing was missed.
    // What changed is the amount for a DOOMED absence: it used to be zero, and
    // it is now whatever was armed against it (§5 of `streak.ts`).
    let doomedCasesSeen = 0;
    let savedCasesSeen = 0;

    for (const streak of [0, 1, 6, 7, 29, 30, 99]) {
      for (let balance = 0; balance <= RECOVERY_DAY_GUARDRAILS.HOLD_CAP; balance += 1) {
        for (const gap of [0, 1, 2, 3, 9]) {
          const base = streak === 0 ? freshState() : stateWithRun(streak, DAY_ZERO, balance);
          const state = { ...base, recoveryDayBalance: balance, armedRecoveryDays: balance };
          const day = addDays(DAY_ZERO, gap + 1);
          const outcome = unwrap(recordTrainingDay(state, day));
          const saved = outcome.recoveryDaySave?.recoveryDaysSpent ?? 0;
          const lost = outcome.recoveryDaysLostToTheAbsence;

          // The absence is now anchored at the signup day even with no live run,
          // so `chargeableGapDays(gap)` is the right expectation for BOTH cases —
          // `stateWithRun` and `freshState` both anchor on `DAY_ZERO`.
          const chargeable = chargeableGapDays(gap);
          const covered = chargeable <= armedGapDays(state);
          expect(saved).toBe(covered ? chargeable : 0);
          expect(lost).toBe(covered ? 0 : Math.max(0, state.armedRecoveryDays ?? 0));
          expect(saved + lost).toBe(absenceOutcome(state, day).recoveryDaysConsumed);
          expect(outcome.state.recoveryDayBalance).toBe(
            balance - saved - lost + outcome.recoveryDaysGranted,
          );
          if (!covered) doomedCasesSeen += 1;
          if (saved > 0) savedCasesSeen += 1;
        }
      }
    }
    // Both branches were actually reached, or the equalities above are about a
    // table with one column.
    expect(doomedCasesSeen).toBeGreaterThan(0);
    expect(savedCasesSeen).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Read models and immutability
// ---------------------------------------------------------------------------

describe('read models', () => {
  it('never mutate the state they are handed', () => {
    const states: StreakState[] = [
      freshState(),
      stateWithRun(9, DAY_ZERO, 3),
      stateWithRun(50, DAY_ZERO, RECOVERY_DAY_GUARDRAILS.HOLD_CAP),
      unprotectedStateWithRun(9, DAY_ZERO, 3),
    ];
    for (const state of states) {
      const before = clone(state);
      for (let offset = 0; offset < 10; offset += 1) {
        const day = addDays(DAY_ZERO, offset);
        openDay(state, day);
        absenceOutcome(state, day);
        daysMissedBefore(state, day);
      }
      coverableGapDays(state);
      armedGapDays(state);
      chargeableDaysBefore(state, addDays(DAY_ZERO, 9));
      recoveryDayCapacity(state);
      streakDeadlineDay(state);
      lastDayStreakCanBeSaved(state);
      expect(state).toEqual(before);
    }
  });

  it('never mutate the state a transition is handed', () => {
    const state = stateWithRun(9, DAY_ZERO, 3);
    const before = clone(state);
    grantRecoveryDays(state, { source: 'achievement' });
    recordTrainingDay(state, addDays(DAY_ZERO, 1));
    recordTrainingDay(state, dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP));
    settleBrokenStreak(state, addDays(DAY_ZERO, 9));
    setRecoveryDayProtection(state, false);
    expect(state).toEqual(before);
  });

  it('agree with each other about what an absence does, across every balance and length', () => {
    const kindsSeen = new Set<string>();
    for (let balance = 0; balance <= RECOVERY_DAY_GUARDRAILS.HOLD_CAP; balance += 1) {
      for (let gap = 0; gap <= LONGEST_REPAIRABLE_ABSENCE_DAYS + 3; gap += 1) {
        const state = stateWithRun(9, DAY_ZERO, balance);
        const day = dayAfterGap(DAY_ZERO, gap);
        const opening = openDay(state, day);
        const absence = absenceOutcome(state, day);
        kindsSeen.add(opening.kind);

        expect(opening.kind === 'streak-broken').toBe(!absence.protectionHolds);
        expect(opening.kind === 'gap-covered-by-recovery-days').toBe(
          absence.protectionHolds && absence.recoveryDaysHolding > 0,
        );
        expect(absence.daysMissed).toBe(daysMissedBefore(state, day));

        // A gap inside the grace is alive and free, at EVERY balance — that is
        // the whole of the §4.4 change, read off the two models together.
        if (gap >= 1 && gap <= GRACE) {
          expect(opening.kind).toBe('gap-covered-by-grace');
          expect(absence.recoveryDaysHolding).toBe(0);
        }

        if (opening.kind === 'gap-covered-by-recovery-days') {
          expect(opening.recoveryDaysHolding).toBe(chargeableGapDays(gap));
          expect(opening.recoveryDaysHolding).toBe(chargeableDaysBefore(state, day));
          expect(opening.recoveryDaysHolding).toBeGreaterThanOrEqual(1);
          expect(opening.daysCoveredFreeByGrace).toBe(GRACE);
          expect(opening.recoveryDaysHolding).toBeLessThanOrEqual(armedGapDays(state));
          expect(day).toBeLessThanOrEqual(lastDayStreakCanBeSaved(state) as StreakDay);
        }
        if (gap > 0 && opening.kind === 'streak-broken') {
          expect(day).toBeGreaterThan(lastDayStreakCanBeSaved(state) as StreakDay);
          expect(absence.recoveryDaysHolding).toBe(0);
        }
      }
    }
    // The sweep is only worth anything if it reached all four shapes.
    expect(kindsSeen).toEqual(
      new Set([
        'streak-alive',
        'gap-covered-by-grace',
        'gap-covered-by-recovery-days',
        'streak-broken',
      ]),
    );
  });
});
