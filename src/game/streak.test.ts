import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  DOOMED_SALE_REFUSAL_MESSAGE,
  LONGEST_REPAIRABLE_ABSENCE_DAYS,
  RECOVERY_DAY_GUARDRAILS,
  RECOVERY_DAY_OUTCOME_KEYS,
  RECOVERY_DAY_PROTECTION,
  STREAK_DAY_BOUNDARY,
  STREAK_FACT_KEYS,
  STREAK_MILESTONE_DAYS,
  absenceAnchorDay,
  absenceOutcome,
  adoptSignupDay,
  addDays,
  applySettledCoveredDayPurchase,
  armedGapDays,
  asStreakDay,
  chargeableDaysBefore,
  chargeableGapDays,
  civilDateFromStreakDay,
  coverableGapDays,
  createStreakState,
  daysBetween,
  coveredDaysArmed,
  coveredDaysLeftInWindow,
  daysMissedBefore,
  entitlementWindowFor,
  lastDayStreakCanBeSaved,
  migrateFromRecoveryDayBalance,
  openDay,
  recordTrainingDay,
  setRecoveryDayProtection,
  settleBrokenStreak,
  settledStateAsOf,
  streakDayFromCivilDate,
  streakDayFromLocalWallClock,
  streakDeadlineDay,
  type DayOpening,
  type LegacyStreakStateWithBalance,
  type RenderedStoreOffer,
  type SettledCoveredDayPurchase,
  type StreakDay,
  type StreakResult,
  type StreakState,
} from './streak';
import * as streakModule from './streak';
import {
  COVERED_DAY_TENDERS,
  NON_TRAINING_GATED_TENDERS,
  TENDER_ARRIVAL,
  TENDER_ARRIVALS,
  TENDER_CURRENCY,
  TRAINING_GATED_TENDERS,
  type NonTrainingGatedTender,
} from './currencyProvenance';
import {
  MAX_COVERED_DAYS_ONE_ABSENCE_MAY_DRAW,
  RECOVERY_ENTITLEMENT,
  coveredDaysAvailable,
  freshEntitlement,
  type EntitlementState,
} from './streakEntitlement';
import {
  DOOMED_SALE_SWEEP,
  ENTITLEMENT_VERIFICATION,
  MONOTONICITY_SWEEP,
  RESIDUE_SWEEP,
  STORE_VERDICT_DIVERGENCE,
  exhaustiveCalendar,
  exhaustiveCalendarCount,
  renderSchedule,
  seededSchedules,
  singleDaySupersets,
  trainedDayCount,
} from './streakSweep';

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

/** The refusal sentence, so a test can pin the COPY and not only the code. */
function errorMessageOf<T>(result: StreakResult<T>): string {
  return result.ok ? 'OK' : result.error.message;
}

const DAY_ZERO: StreakDay = asStreakDay(20000);

/**
 * The day the read-only helpers are evaluated at when a test does not care.
 *
 * `armedGapDays`, `coverableGapDays` and `lastDayStreakCanBeSaved` all take a
 * day now, because the entitlement they read refreshes on the calendar. DAY_ZERO
 * is the account's own signup day and therefore window 0, which is where every
 * hand-built fixture in this file lives.
 */
const TODAY_FOR_READS: StreakDay = DAY_ZERO;


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
/**
 * An account as it was stored before GDD §4.2's Option 1 ruling: holding a
 * Recovery Day balance, with some of it armed.
 *
 * Typed as `LegacyStreakStateWithBalance` and NOT as `StreakState`, which is
 * the point — the new state has no balance field, so a stored balance is not
 * something the running game can express. `migrateFromRecoveryDayBalance` is
 * the only way across.
 */
const LEGACY_WITH_BALANCE: LegacyStreakStateWithBalance = {
  signupDay: SIGNUP_DAY,
  currentStreak: 9,
  longestStreak: 12,
  lastTrainedDay: DAY_ZERO,
  armedRecoveryDays: 4,
  recoveryDayBalance: 4,
  recoveryDayProtectionEnabled: true,
  hasBankedFirstRecoveryDaySave: true,
};

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
 * The arming matters: a hand-built state with `entitlementArmed: true` would be a
 * player who trained while holding nothing, and every Recovery Day test built
 * on it would quietly pass by never spending anything.
 */
function stateWithRun(streakLength: number, lastDay: StreakDay, balance: number): StreakState {
  return {
    signupDay: SIGNUP_DAY,
    currentStreak: streakLength,
    longestStreak: streakLength,
    lastTrainedDay: lastDay,
    entitlement: withCoveredDays(balance, windowOf(lastDay)),
    // ARMED WITH EXACTLY WHAT IS HELD, and armed on the last training day —
    // which is what a real session leaves behind. A fixture whose armed
    // snapshot differed from its live entitlement would be a lifter who had
    // bought a covered day mid-absence, and that is a case tests ask for by
    // name rather than one every fixture should quietly be in.
    armedEntitlement: withCoveredDays(balance, windowOf(lastDay)),
    entitlementArmed: true,
    recoveryDayProtectionEnabled: true,
    hasBankedFirstRecoveryDaySave: false,
  };
}

/**
 * The offer a store screen gated on `protectionHolds` would have drawn off
 * `state` for `day` — the most charitable client there is: one device, one
 * state, screen drawn and order completed on the same streak day.
 *
 * It is the default every call site below uses when the render/complete gap is
 * not what that test is about. Two things make it the right default rather than
 * a convenience:
 *
 * - it is what a real store would do, so the fixtures describe a shipping UI
 *   rather than a hypothetical one; and
 * - it is the shape the boundary-revival attack lives in. That attack needs no
 *   gap, no second device and no background job — so a suite that only ever used
 *   this helper would still be able to express it, and does, below.
 *
 * The render-day-lags-completion axis is a deliberate variation ON this, not a
 * replacement for it: see `DOOMED_SALE_SWEEP.RENDER_DAY_LAGS`.
 */
function offerAsRenderedOn(state: StreakState, day: StreakDay): RenderedStoreOffer {
  return { day, offered: absenceOutcome(state, day).protectionHolds };
}

/**
 * The entitlement window a day falls in, for an account created on `signupDay`.
 *
 * IT TAKES THE ANCHOR because the window grid is anchored at signup, and the
 * sweeps below deliberately vary that anchor to move a window boundary INSIDE a
 * short calendar. A fixture that could only ever be anchored at `SIGNUP_DAY`
 * cannot reach a boundary at ten days, which is how a stale-snapshot comparison
 * survived in the exhaustive sweep for as long as it did.
 */
function windowIndexFor(signupDay: StreakDay, day: StreakDay): number {
  return Math.floor((day - signupDay) / RECOVERY_ENTITLEMENT.WINDOW_DAYS);
}

/** The same, for the fixtures anchored at `SIGNUP_DAY` — which is most of them. */
function windowOf(day: StreakDay): number {
  return windowIndexFor(SIGNUP_DAY, day);
}

/**
 * An entitlement snapshot with exactly `coveredDaysLeft` covered days left in
 * `windowIndex`.
 *
 * THE HEIR OF "a hand-built state with a balance of N". It is a snapshot rather
 * than a stock, so a fixture that asks for more than a window holds is asking
 * for something the game cannot produce — and this refuses rather than
 * silently building it, because a test that runs on an impossible state proves
 * nothing about a reachable one.
 */
function withCoveredDays(coveredDaysLeft: number, windowIndex = 0): EntitlementState {
  if (coveredDaysLeft > RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW) {
    throw new Error(
      `withCoveredDays: a window holds at most ${RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW} covered days, asked for ${coveredDaysLeft}`,
    );
  }
  return { windowIndex, coveredDaysLeft, purchasedDaysLeft: 0 };
}

/**
 * `state`, holding `entitlement` AND ARMED WITH IT — the shape a real session
 * leaves behind.
 *
 * WHY THIS EXISTS RATHER THAN `{ ...state, entitlement }`, which is what every
 * fixture here used to write. Since the armed snapshot split off from the live
 * balance (GDD §4.2: a covered day arriving mid-absence does not cover it), an
 * override that writes one and not the other builds a lifter ARMED WITH MORE
 * THAN THEY HOLD. No entry point in `streak.ts` can produce that state, so
 * every invariant checked on it is a statement about a program nobody ships —
 * and four sweeps in this file were in exactly that shape the moment the field
 * was added, which is how it was found.
 *
 */
function holding(state: StreakState, entitlement: EntitlementState): StreakState {
  return {
    ...state,
    entitlement,
    armedEntitlement: entitlement,
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

/**
 * COVERAGE THE WINDOW `day` FALLS IN HAS AVAILABLE TO THIS STATE — the quantity
 * "reported, never silent" is a statement about, and the one a session's
 * arithmetic is closed over.
 *
 * THREE READINGS EXIST AND ONLY THIS ONE BALANCES THE BOOKS. `coveredDays
 * LeftInWindow` reports the SNAPSHOT, which is stale the moment the window
 * turns over, so a session on the first day of a new window looks like a silent
 * credit against it. `coveredDaysArmed` reports what the ABSENCE MAY DRAW,
 * which is 0 for a lifter who has declined protection in settings — so a
 * session of theirs looks like a silent credit of the entire window against
 * that. This reads what the DAY has, regardless of arming, which is exactly
 * what `recordTrainingDay` starts from: `afterSession` refreshes the window
 * first and then subtracts what the outcome reported.
 *
 * An earlier version of the sweeps below used `coveredDaysArmed` here, and the
 * protection-declined sweeps failed on it with "coverage moved by -2, reported
 * 0" — a false alarm, but a false alarm produced by the invariant being written
 * about the wrong number.
 */
function coverageAvailableOn(state: StreakState, day: StreakDay): number {
  return coveredDaysAvailable(RECOVERY_ENTITLEMENT, state.entitlement, entitlementWindowFor(state, day));
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

  it('imports only sibling pure modules, so it cannot import React or reach a host API', () => {
    // THIS USED TO READ "imports nothing at all". That was a proxy for purity
    // and it stopped being true honestly rather than sloppily: GDD §4.2's
    // Option 1 ruling put the entitlement in its own module, and this one has
    // to reach it. So the check is now an ALLOWLIST of what may be imported
    // rather than a ban on importing, for the same reason `STREAK_FACT_KEYS` is
    // an allowlist: a ban on `react` is guessable around (`react-native`,
    // `expo-haptics`, `node:fs`) and an allowlist is not.
    //
    // EVERY ENTRY HAS TO BE A SIBLING PURE MODULE — one that is itself under a
    // purity scan of its own. `streakEntitlement.test.ts` scans
    // `streakEntitlement.ts` the same way this scans `streak.ts`, so the
    // guarantee composes instead of stopping at the import.
    //
    // `./currencyProvenance` joined it with the tender-provenance fix, and it
    // qualifies on the same terms: it is a LEAF (it imports nothing at all) and
    // `currencyProvenance.test.ts` scans it for the same host reaches this
    // block scans `streak.ts` for.
    const PURE_SIBLINGS: readonly string[] = ['./currencyProvenance', './streakEntitlement'];

    const specifiers = [...code.matchAll(/^\s*import[\s\S]*?from\s*['"]([^'"]+)['"]/gm)].map(
      (match) => match[1] as string,
    );
    // The scan has to have found the import that exists, or an allowlist of one
    // entry proves nothing about a file it failed to parse.
    expect(specifiers).toEqual([...PURE_SIBLINGS]);
    for (const specifier of specifiers) {
      expect(PURE_SIBLINGS, `streak.ts imports ${specifier}`).toContain(specifier);
    }
    // Side-effect imports (`import './x'`) have no `from` and would slip past
    // the scan above, so they are banned outright — this module has no reason
    // for one and a side-effect import is precisely what a purity claim cannot
    // survive.
    expect(code).not.toMatch(/^\s*import\s+['"]/m);
    expect(code).not.toMatch(/\brequire\s*\(/);
    expect(code).not.toMatch(/\bimport\s*\(/);
  });

  it('[never-reads-a-clock] never reads a clock', () => {
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

  it('[no-accept-decline-path] exposes no manual accept/decline path, because auto-protect replaced it', () => {
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

  it('the header does not claim coverage is unreachable while a function reaches it', () => {
    // FOUR COMMENTS IN THIS MODULE ASSERTED THE OPPOSITE OF WHAT IT DID, and
    // all four said it in the reassuring direction. They are the reason the
    // defect survived a round of grading: a reader checking whether a purchase
    // could arm an absence found a paragraph saying nothing could arrive at
    // all, and stopped.
    //
    // WHAT THIS CHECKS IS A CONDITIONAL, not a wordlist. IF the module exports
    // something that credits coverage, THEN it may not also carry the sentences
    // that were true only while nothing did. Delete
    // `applySettledCoveredDayPurchase` and the retracted claims become sayable
    // again, which is correct — they would be true again.
    const credits = Object.keys(streakModule).filter(
      (name) =>
        typeof (streakModule as Record<string, unknown>)[name] === 'function' &&
        /credit|buy|purchase/i.test(name),
    );
    expect(credits, 'the premise of this test').toEqual(['applySettledCoveredDayPurchase']);

    // The exact retracted sentences, in the source INCLUDING comments — this is
    // the one scan in the file that must not strip them, because comments are
    // the artifact under test.
    const retracted = [
      // §3 of the header, false since GDD §8.3E was ruled in.
      /NOTHING CAN CREDIT COVERAGE AT ALL/,
      /no exported name matches/,
      // §5 of the header, contradicted by §4 on the same page.
      /Nothing can arrive\s*\n?\s*\*?\s*any more/,
      // The `entitlement` field docstring, which described a live field as a
      // snapshot and is the sentence the whole defect rested on.
      /IT IS A SNAPSHOT TAKEN AT A SESSION, not a live figure/,
      // The purchase docstring's list of untouched fields, which used to omit
      // the one field that matters.
      /GDD §8.3E is PROPOSED AND NOT RULED/,
    ];
    for (const claim of retracted) {
      expect(source, `a retracted claim is back in streak.ts: ${String(claim)}`).not.toMatch(claim);
    }

    // AND THE REPLACEMENT CLAIMS ARE PRESENT, so this cannot be satisfied by
    // deleting the paragraphs rather than correcting them.
    expect(source).toMatch(/EXACTLY ONE THING CAN CREDIT COVERAGE/);
    expect(source).toMatch(/COVERAGE ARRIVING DURING AN ABSENCE DOES NOT COVER IT — and coverage CAN/);
  });

  it('[absence-reads-the-armed-snapshot] resolves an absence from the ENTITLEMENT SNAPSHOT and the calendar, and from nothing else', () => {
    // The one-line reason the outcome cannot depend on when the app is opened.
    // Under the Recovery Day stock the danger was a grant landing mid-absence
    // and raising `recoveryDayBalance` where `absenceOutcome` could see it.
    //
    // THAT DANGER IS BACK, AND THIS TEST USED TO SAY IT WAS NOT. It said "GDD
    // §4.2's Option 1 ruling deleted the grant path, so the danger is now the
    // shape rather than the name", and it asserted that a purchased day is
    // "mentioned exactly once, as the literal zero that says none of one
    // reaches this resolution (GDD §8.3E is not ruled)". §8.3E IS ruled,
    // `applySettledCoveredDayPurchase` credits coverage, and that literal zero
    // was only the DISARMED branch — the armed branch passed the whole live
    // entitlement straight through. So the scan was green while the function it
    // scanned was reading exactly the field the comment promised it did not.
    //
    // DRIVEN NOW, NOT SCANNED, and that is the repair rather than a rewording.
    // A source scan of this function was never able to fail on the thing it
    // claimed, because the claim was about WHICH FIELD, and both fields are
    // spelled `state.entitlement...`. The property is behavioural and is
    // asserted behaviourally: moving the LIVE entitlement, by any amount,
    // cannot move the absence's verdict or what it holds open.
    for (const gap of [0, 1, GRACE, GRACE + 1, GRACE + 2, LONGEST_REPAIRABLE_ABSENCE_DAYS + 1]) {
      for (let balance = 0; balance <= RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW; balance += 1) {
        const base = stateWithRun(5, DAY_ZERO, balance);
        const day = dayAfterGap(DAY_ZERO, gap);
        // The same lifter, holding a fortune they did not have at their last
        // session. Only `entitlement` moves; `armedEntitlement` does not.
        const rich: StreakState = {
          ...base,
          entitlement: { windowIndex: windowOf(DAY_ZERO), coveredDaysLeft: 99, purchasedDaysLeft: 99 },
        };
        const label = `gap ${gap} balance ${balance}`;
        expect(absenceOutcome(rich, day).protectionHolds, label).toBe(
          absenceOutcome(base, day).protectionHolds,
        );
        expect(absenceOutcome(rich, day).recoveryDaysHolding, label).toBe(
          absenceOutcome(base, day).recoveryDaysHolding,
        );
        expect(absenceOutcome(rich, day).breakReason, label).toBe(absenceOutcome(base, day).breakReason);
        expect(openDay(rich, day).kind, label).toBe(openDay(base, day).kind);
      }
    }

    // AND THE SCAN IS KEPT FOR WHAT A SCAN IS ACTUALLY GOOD AT: names that must
    // not come back, and an argument list that must not grow.
    const body = code.slice(code.indexOf('export function absenceOutcome'));
    const fn = body.slice(0, body.indexOf('\n}\n') + 1);
    expect(fn).toContain('entitlementWindowFor(state, today)');
    expect(fn).toContain('resolveEntitlement');
    // The COVERS decision reads the armed snapshot and nothing else.
    expect(fn).toContain('state.armedEntitlement');
    // The stock's names cannot come back under the old spelling...
    expect(fn).not.toContain('recoveryDayBalance');
    expect(fn).not.toContain('armedRecoveryDays');
    // ...and nothing may CREDIT a figure here; this function only reads.
    expect(fn).not.toMatch(/creditCoveredDays|\bgrant\w/i);
    // Two parameters, and there is nowhere for a third to hide.
    expect(streakModule.absenceOutcome).toHaveLength(2);
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
  const entitlementSource = readFileSync(
    fileURLToPath(new URL('./streakEntitlement.ts', import.meta.url)),
    'utf8',
  );

  it('funds coverage from a window entitlement, which is what the 3-5 hold cap became', () => {
    // WHAT THIS USED TO CHECK, and why the check had to change rather than be
    // re-pointed: GDD §4.2's "Hold cap of 3-5 tokens" is a guardrail on a
    // STOCK, and the Option 1 ruling in the same section deleted the stock —
    // "no balance to hoard and nothing to lose by using them". Re-pointing the
    // 3-5 range at `COVERED_DAYS_PER_WINDOW` is what the wiring did, and it is
    // wrong in a way that matters: the entitlement is 2 precisely so that the
    // ceiling GDD §4.2 promises stays at four days, so the old range would
    // forbid the tuning the ruling requires.
    //
    // WHAT SURVIVES IS THE SHAPE, not the numbers. Coverage has to exist
    // (at least one covered day per window, or nothing is ever protected) and
    // it has to arrive on a window of whole days.
    expect(Number.isInteger(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW)).toBe(true);
    expect(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(RECOVERY_ENTITLEMENT.WINDOW_DAYS)).toBe(true);
    expect(RECOVERY_ENTITLEMENT.WINDOW_DAYS).toBeGreaterThanOrEqual(1);
  });

  it('ships a tuning the verification battery actually covers', () => {
    // THE HEIR OF "sits inside the range the GDD specifies", and it is a
    // stronger question than the one it replaces. GDD §4.2's Option 1 ruling is
    // conditional on `streakEntitlement.test.ts`'s battery, and that battery
    // runs over a GRID of window lengths and entitlement sizes
    // (`ENTITLEMENT_VERIFICATION`). A retune to a value outside the grid would
    // ship a tuning nothing has ever checked the monotonicity property at —
    // which is exactly how the last two "this closes it" claims got out.
    //
    // So the range that binds is not a number in a document. It is the set of
    // points the property has been measured at.
    expect([...ENTITLEMENT_VERIFICATION.PER_WINDOW_GRID]).toContain(
      RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW,
    );
    expect([...ENTITLEMENT_VERIFICATION.WINDOW_DAYS_GRID]).toContain(RECOVERY_ENTITLEMENT.WINDOW_DAYS);
  });

  it('has a per-absence ceiling of at least 1, combined with the window rate by MIN and not by rank', () => {
    // The direct heir of `MAX_CONSECUTIVE_USES`, and the half of the old
    // assertion that survives is the `>= 1`. The other half — "and below the
    // hold cap" — does not: `streakEntitlement.ts` says in as many words that
    // the two are "2 and 2 today by coincidence of tuning" and that raising the
    // window rate to 5 without raising this one must still leave a week away
    // unbuyable. An assertion that one is strictly below the other would forbid
    // the shipped tuning and would encode a rank the design explicitly refuses.
    expect(Number.isInteger(RECOVERY_ENTITLEMENT.MAX_COVERED_DAYS_PER_ABSENCE)).toBe(true);
    expect(RECOVERY_ENTITLEMENT.MAX_COVERED_DAYS_PER_ABSENCE).toBeGreaterThanOrEqual(1);

    // WHAT REPLACES THE RANK: the two are composed by `min`, so neither
    // ordering is assumed and neither can be raised into a longer repairable
    // absence on its own. Checked at both orderings, not only the shipped one.
    expect(MAX_COVERED_DAYS_ONE_ABSENCE_MAY_DRAW).toBe(
      Math.min(
        RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW,
        RECOVERY_ENTITLEMENT.MAX_COVERED_DAYS_PER_ABSENCE,
      ),
    );
    // AND THE GUARDRAIL THE LIMIT EXISTS FOR: a week away ends a run, at every
    // entitlement the grid permits.
    for (const perWindow of ENTITLEMENT_VERIFICATION.PER_WINDOW_GRID) {
      const ceiling = GRACE + Math.min(perWindow, RECOVERY_ENTITLEMENT.MAX_COVERED_DAYS_PER_ABSENCE);
      expect(ceiling, `a week is buyable at ${perWindow} covered days per window`).toBeLessThan(7);
    }
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
    //
    // THEY NOW LIVE IN TWO FILES, which makes collapsing them harder to do by
    // accident and this scan harder to write: `MAX_CONSECUTIVE_USES` became
    // `RECOVERY_ENTITLEMENT.MAX_COVERED_DAYS_PER_ABSENCE` in
    // `streakEntitlement.ts` under GDD §4.2's Option 1 ruling, and the grace
    // stayed here because it is the one part of coverage that is a pure
    // function of the absence. The human's requirement did not move with it, so
    // neither did this test — it reads both blocks.
    const literalIn = (block: string, name: string, where: string): string => {
      const match = new RegExp(`\\n  ${name}:\\s*([^,\\n]+),`).exec(block);
      if (match === null) throw new Error(`could not find ${name} in ${where}`);
      return (match[1] as string).trim();
    };
    const graceBlock = source.slice(
      source.indexOf('export const RECOVERY_DAY_GUARDRAILS'),
      source.indexOf('export const RECOVERY_DAY_PROTECTION'),
    );
    const entitlementBlock = entitlementSource.slice(
      entitlementSource.indexOf('export const RECOVERY_ENTITLEMENT'),
      entitlementSource.indexOf('export const MAX_COVERED_DAYS_ONE_ABSENCE_MAY_DRAW'),
    );
    expect(literalIn(graceBlock, 'FREE_GRACE_GAP_DAYS', 'RECOVERY_DAY_GUARDRAILS')).toMatch(/^\d+$/);
    expect(literalIn(entitlementBlock, 'MAX_COVERED_DAYS_PER_ABSENCE', 'RECOVERY_ENTITLEMENT')).toMatch(
      /^\d+$/,
    );
    // The window rate is the third of the three and is just as capable of being
    // written as one of the others — `COVERED_DAYS_PER_WINDOW:
    // MAX_COVERED_DAYS_PER_ABSENCE` would behave identically today.
    expect(literalIn(entitlementBlock, 'COVERED_DAYS_PER_WINDOW', 'RECOVERY_ENTITLEMENT')).toMatch(/^\d+$/);

    // AND NEITHER BLOCK MENTIONS THE OTHER'S NAME, so one cannot be defined in
    // terms of the other across the file boundary either.
    expect(graceBlock).not.toContain('MAX_COVERED_DAYS_PER_ABSENCE');
    expect(graceBlock).not.toContain('COVERED_DAYS_PER_WINDOW');
    expect(entitlementBlock).not.toContain('FREE_GRACE_GAP_DAYS');

    // ...and the shape checks the old test did keep, since they are still true
    // and still worth failing on. The `GRACE < HOLD_CAP` line that used to sit
    // here went with the hold cap: the grace is a length of absence and the
    // entitlement is a count of covered days, so there was never a reason for
    // one to bound the other beyond both happening to be small.
    expect(Number.isInteger(GRACE)).toBe(true);
    expect(GRACE).toBeGreaterThanOrEqual(0);
    expect(RECOVERY_ENTITLEMENT.MAX_COVERED_DAYS_PER_ABSENCE).toBeGreaterThanOrEqual(1);
  });

  it('gives the two constants different jobs, checked by behaviour as well as by text', () => {
    // The grace is what a player with NOTHING ARMED still gets; the
    // consecutive-use limit is what caps what an armed player can buy. Holding
    // the armed count at 0 isolates the first, holding it at the hold cap
    // isolates the second.
    const bare = { ...stateWithRun(9, DAY_ZERO, 0), entitlementArmed: true };
    expect(coverableGapDays(bare, TODAY_FOR_READS)).toBe(GRACE);
    expect(openDay(bare, dayAfterGap(DAY_ZERO, GRACE)).kind).toBe('gap-covered-by-grace');
    expect(openDay(bare, dayAfterGap(DAY_ZERO, GRACE + 1)).kind).toBe('streak-broken');

    const armed = stateWithRun(9, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    expect(armedGapDays(armed, TODAY_FOR_READS)).toBe(RECOVERY_ENTITLEMENT.MAX_COVERED_DAYS_PER_ABSENCE);
    expect(coverableGapDays(armed, TODAY_FOR_READS)).toBe(GRACE + RECOVERY_ENTITLEMENT.MAX_COVERED_DAYS_PER_ABSENCE);
  });

  it('sets the longest repairable absence to the grace plus the consecutive-use limit', () => {
    expect(LONGEST_REPAIRABLE_ABSENCE_DAYS).toBe(GRACE + RECOVERY_ENTITLEMENT.MAX_COVERED_DAYS_PER_ABSENCE);
    const state = stateWithRun(50, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    expect(coverableGapDays(state, TODAY_FOR_READS)).toBe(LONGEST_REPAIRABLE_ABSENCE_DAYS);
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
    const fresh = stateWithRun(9, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
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

  it('[milestones-pay-nothing] MARKS milestones at 7 / 30 / 100 days and PAYS NOTHING FOR THEM', () => {
    // GDD §4.2's Option 1 ruling deleted the earning table, and this is the
    // measurement that keeps it deleted rather than the comment that asks
    // nicely. A covered day granted at a streak length gives 54 violating pairs
    // and 239 lifetime-best inversions at 100 days — a grant whose arrival day
    // the lifter's own training can move is the defect GDD §4.4 traces.
    expect(STREAK_MILESTONE_DAYS).toEqual([7, 30, 100]);

    const milestone = STREAK_MILESTONE_DAYS[0] as number;
    // THE WINDOW STARTS EMPTY, AND THAT IS NOT INCIDENTAL. Run from a fresh
    // account the window is already full, so a payout of one covered day is
    // clipped to a full window and this test cannot see it — mutation-tested:
    // a build that pays a covered day at a milestone passed here and was caught
    // only by the sweeps. From empty, a payout has somewhere to go.
    let state: StreakState = holding(freshState(), withCoveredDays(0));
    let sawTheMilestone = false;
    for (let i = 0; i < milestone; i += 1) {
      const outcome = unwrap(recordTrainingDay(state, addDays(DAY_ZERO, i)));
      // Nothing was granted, on the day it was reached or on any other day.
      expect(outcome.recoveryDaysGranted).toBe(0);
      // AND THE ENTITLEMENT DID NOT MOVE, on any day of the run — not only on
      // the milestone day. A session that missed nothing has nothing to pay for
      // and nothing to be paid.
      expect(outcome.state.entitlement).toEqual(state.entitlement);
      expect(coveredDaysLeftInWindow(outcome.state)).toBe(0);
      if (outcome.milestonesReached.length > 0) {
        sawTheMilestone = true;
        expect(outcome.milestonesReached).toEqual([milestone]);
      }
      state = outcome.state;
    }
    expect(sawTheMilestone, 'the sweep never reached the milestone').toBe(true);
  });

  it('puts the day rollover on a whole hour of the clock', () => {
    expect(Number.isInteger(STREAK_DAY_BOUNDARY.ROLLOVER_HOUR_LOCAL)).toBe(true);
    expect(STREAK_DAY_BOUNDARY.ROLLOVER_HOUR_LOCAL).toBeGreaterThanOrEqual(0);
    expect(STREAK_DAY_BOUNDARY.ROLLOVER_HOUR_LOCAL).toBeLessThanOrEqual(23);
  });

  it('reads free-path grant amounts off the economy table, not off the caller', () => {
// THE EARNING TABLE IS GONE, AND ITS ABSENCE IS THE ASSERTION. GDD §4.2's
    // Option 1 ruling replaced the Recovery Day stock with an entitlement, so
    // there is no grant amount to check and nothing that can credit one. What
    // is checked instead is that the entitlement composes the ceiling the GDD
    // still promises.
    expect(LONGEST_REPAIRABLE_ABSENCE_DAYS).toBe(
      GRACE + Math.min(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW, RECOVERY_ENTITLEMENT.MAX_COVERED_DAYS_PER_ABSENCE),
    );
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
    expect(coveredDaysLeftInWindow(state)).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    expect(state.recoveryDayProtectionEnabled).toBe(true);
    // ARMED, WHERE THIS USED TO ASSERT `null`. The signup day is an anchor like
    // any other, so the absence after it is chargeable like any other, so the
    // signup grant has to be armed against it. `streak.ts` §1b and §6.
    expect(coveredDaysArmed(state, TODAY_FOR_READS)).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    expect(state.hasBankedFirstRecoveryDaySave).toBe(false);
  });

  it('shows "no active streak" until the first session — and what the absence will cost', () => {
    // The kind is unchanged; what it carries is not. A lifter who has never
    // trained is inside a chargeable absence from their signup day, so this was
    // the one opening from which a pending consumption used to be invisible.
    expect(openDay(freshState(), DAY_ZERO)).toEqual({
      kind: 'no-active-streak',
      longestStreak: 0,
      recoveryDaysCommittedToTheAbsence: 0,
      coveredDaysAvailable: RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW,
    });

    // ...and once the signup absence has outrun the grace plus what is armed,
    // it says so, before the session that takes it.
    const lapsed = openDay(freshState(), dayAfterGap(SIGNUP_DAY, LONGEST_REPAIRABLE_ABSENCE_DAYS + 1));
    expect(lapsed).toEqual({
      kind: 'no-active-streak',
      longestStreak: 0,
      recoveryDaysCommittedToTheAbsence: RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW,
      coveredDaysAvailable: RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW,
    });
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
    expect(lastDayStreakCanBeSaved(state, TODAY_FOR_READS)).toBeNull();
    expect(errorCodeOf(settleBrokenStreak(state, addDays(SIGNUP_DAY, 400)))).toBe('NOTHING_TO_SETTLE');
  });

  it('MIGRATION: adoptSignupDay writes the anchor, and refuses one that postdates a session', () => {
    // Accounts created before the field existed do not carry a signup day, and
    // `StreakState.signupDay` is deliberately non-nullable so that an
    // un-backfilled account cannot silently keep the old free-lunch behaviour.
    // This is the one door a backfill goes through.
    const migrated = unwrap(adoptSignupDay(stateWithRun(9, addDays(DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW), 2), DAY_ZERO));
    expect(migrated.signupDay).toBe(DAY_ZERO);
    // Nothing else moved. A migration is not a transition.
    expect({ ...migrated, signupDay: SIGNUP_DAY }).toEqual(stateWithRun(9, addDays(DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW), 2));

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
    expect(outcome.recoveryDaysLostToTheAbsence).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    expect(coveredDaysLeftInWindow(outcome.state)).toBe(0);
    expect(outcome.recoveryDaySave).toBeNull();
    // No run died — there was not one — so nothing claims one did.
    expect(outcome.endedRunLength).toBe(0);
    expect(outcome.streakAfter).toBe(1);

    // ...and a lifter who starts inside the ceiling keeps everything.
    const prompt = dayAfterGap(SIGNUP_DAY, LONGEST_REPAIRABLE_ABSENCE_DAYS);
    const kept = unwrap(recordTrainingDay(freshState(), prompt));
    expect(kept.recoveryDaysLostToTheAbsence).toBe(0);
    expect(coveredDaysLeftInWindow(kept.state)).toBe(
      RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW - RECOVERY_ENTITLEMENT.MAX_COVERED_DAYS_PER_ABSENCE,
    );
  });

  it('arms whatever is held at the first session', () => {
    const outcome = unwrap(recordTrainingDay(freshState(), DAY_ZERO));
    expect(outcome.armedForNextAbsence).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    expect(coveredDaysArmed(outcome.state, TODAY_FOR_READS)).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
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
      lastDayStreakCanBeSaved: addDays(DAY_ZERO, 5 + coverableGapDays(state, TODAY_FOR_READS)),
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
    // The run ends on day 5; the sixth day of the run is DAY_ZERO + 5. That
    // offset is a POSITION IN THE CALENDAR and has nothing to do with any
    // tunable — the wiring had replaced it with `COVERED_DAYS_PER_WINDOW`,
    // which silently moved the absence three days longer and made this a test
    // of the per-absence ceiling instead of a test of an empty window.
    const state = stateWithRun(6, addDays(DAY_ZERO, 5), 0);
    const opening = openDay(state, dayAfterGap(addDays(DAY_ZERO, 5), SHORTEST_PAID_GAP));
    expect(opening).toEqual({
      kind: 'streak-broken',
      brokenRunLength: 6,
      daysMissed: SHORTEST_PAID_GAP,
      reason: 'not-enough-recovery-days-armed',
      coveredDaysAvailable: 0,
      recoveryDaysCommittedToTheAbsence: 0,
    });
  });

  it('starts a new run at 1 when training after an uncoverable absence', () => {
    const state = stateWithRun(6, addDays(DAY_ZERO, 5), 0);
    const outcome = unwrap(
      recordTrainingDay(state, dayAfterGap(addDays(DAY_ZERO, 5), SHORTEST_PAID_GAP)),
    );
    expect(outcome.previousRunEnded).toBe(true);
    expect(outcome.endedRunLength).toBe(6);
    expect(outcome.endedRunReason).toBe('not-enough-recovery-days-armed');
    expect(outcome.streakAfter).toBe(1);
    expect(outcome.state.currentStreak).toBe(1);
    expect(outcome.state.longestStreak).toBe(6);
    expect(coveredDaysLeftInWindow(outcome.state)).toBe(0);
    expect(outcome.recoveryDaySave).toBeNull();
  });

  it('CHARGES the armed Recovery Days for an absence that ended the run, and calls it a loss not a save', () => {
    // THIS TEST USED TO ASSERT THE OPPOSITE — that a break took nothing — and
    // the reversal is measured rather than preferred. A doomed absence that
    // costs nothing is a free absence, and an extra training day inside one
    // splits it into two absences that are NOT free, so the player who trained
    // more paid more. `streak.ts` §5 and §6.
    const state = stateWithRun(20, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    const outcome = unwrap(recordTrainingDay(state, addDays(DAY_ZERO, 10)));
    expect(outcome.previousRunEnded).toBe(true);
    expect(outcome.recoveryDaysLostToTheAbsence).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    expect(coveredDaysLeftInWindow(outcome.state)).toBe(0);
    expect(outcome.state.currentStreak).toBe(1);
    // A LOSS IS NOT A SAVE. Nothing was saved, so no save is reported and the
    // GDD §4.3 teaching moment is not burned on it.
    expect(outcome.recoveryDaySave).toBeNull();
    expect(outcome.state.hasBankedFirstRecoveryDaySave).toBe(false);
  });

  it('charges nothing for a doomed absence when the window had nothing left to take', () => {
    // A CASE THAT CHANGED SHAPE RATHER THAN GOING AWAY, and it is worth being
    // explicit about which. Under the Recovery Day stock this state was "held
    // five, armed none" — a hoard that survived a doomed absence because none
    // of it had been armed at the last session. THAT STATE IS NOW
    // UNREPRESENTABLE: `entitlementArmed` is a boolean and what an absence may
    // draw is the window itself, so there is no way to hold coverage and have
    // none of it armed. Deleting the hoard deleted the case.
    //
    // What survives is the other way of arriving at "nothing to take": the
    // window is empty. The burn takes everything left, and everything left is
    // nothing.
    const state = stateWithRun(20, DAY_ZERO, 0);
    const outcome = unwrap(recordTrainingDay(state, addDays(DAY_ZERO, 10)));
    expect(outcome.previousRunEnded).toBe(true);
    expect(outcome.recoveryDaysLostToTheAbsence).toBe(0);
    expect(coveredDaysLeftInWindow(outcome.state)).toBe(0);
  });

  it('charges nothing for a doomed absence when the player declined protection', () => {
    // The GDD §4.2 toggle still means "no Recovery Day of mine is ever spent",
    // and that has to survive the charge-on-doom rule or the toggle is a lie.
    const state = unprotectedStateWithRun(20, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    const outcome = unwrap(recordTrainingDay(state, addDays(DAY_ZERO, 10)));
    expect(outcome.previousRunEnded).toBe(true);
    expect(outcome.recoveryDaysLostToTheAbsence).toBe(0);
    expect(coveredDaysLeftInWindow(outcome.state)).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
  });

  it('charges the doomed absence exactly once, however many times it is settled first', () => {
    // The debit lives on the training day that ends the absence, NOT on the
    // settle, so settling early, late, repeatedly or never cannot move it.
    const state = stateWithRun(20, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    const back = addDays(DAY_ZERO, 10);

    let settled: StreakState = state;
    for (let offset = SHORTEST_PAID_GAP + 1; offset < 10; offset += 1) {
      const result = settleBrokenStreak(settled, addDays(DAY_ZERO, offset));
      if (result.ok) settled = result.value.state;
    }
    // Settling moved no balance and kept the commitment.
    expect(coveredDaysLeftInWindow(settled)).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    expect(coveredDaysArmed(settled, TODAY_FOR_READS)).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);

    const never = unwrap(recordTrainingDay(state, back));
    const early = unwrap(recordTrainingDay(settled, back));
    expect(early.state).toEqual(never.state);
    expect(early.recoveryDaysLostToTheAbsence).toBe(never.recoveryDaysLostToTheAbsence);
  });

  it('settles a break without waiting for the next session, and takes nothing for it', () => {
    const state = { ...stateWithRun(20, DAY_ZERO, 0), entitlementArmed: true };
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
    const state = { ...stateWithRun(4, DAY_ZERO, 0), entitlementArmed: true };
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
    let state: StreakState = holding(
      { ...trainConsecutively(freshState(), DAY_ZERO, 12), entitlementArmed: true },
      withCoveredDays(0),
    );
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
      const state = { ...stateWithRun(9, DAY_ZERO, 0), entitlementArmed: true };
      const backOn = dayAfterGap(DAY_ZERO, gap);
      expect(daysMissedBefore(state, backOn)).toBe(gap);
      expect(openDay(state, backOn)).toEqual({
        kind: 'gap-covered-by-grace',
        currentStreak: 9,
        streakIfTrainedToday: 10,
        daysMissed: gap,
        lastDayStreakCanBeSaved: dayAfterGap(DAY_ZERO, coverableGapDays(state, TODAY_FOR_READS)),
      });

      const outcome = unwrap(recordTrainingDay(state, backOn));
      expect(outcome.previousRunEnded).toBe(false);
      expect(outcome.endedRunLength).toBe(0);
      expect(outcome.streakAfter).toBe(10);
      expect(coveredDaysLeftInWindow(outcome.state)).toBe(0);
      expect(outcome.recoveryDaySave).toBeNull();
    }
  });

  it('spends nothing for an absence it covers, at any balance', () => {
    for (let balance = 0; balance <= RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW; balance += 1) {
      for (let gap = 1; gap <= GRACE; gap += 1) {
        const state = stateWithRun(9, DAY_ZERO, balance);
        const backOn = dayAfterGap(DAY_ZERO, gap);
        expect(openDay(state, backOn).kind).toBe('gap-covered-by-grace');
        const outcome = unwrap(recordTrainingDay(state, backOn));
        expect(outcome.recoveryDaySave).toBeNull();
        expect(coveredDaysLeftInWindow(outcome.state)).toBe(balance);
      }
    }
  });

  it('applies even to a player who has declined Recovery Day protection', () => {
    // The toggle declines SPENDING. The grace spends nothing, so there is
    // nothing in it to decline and GDD §4.4's ruling stands on its own.
    for (let gap = 1; gap <= GRACE; gap += 1) {
      const declined = unprotectedStateWithRun(9, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
      const backOn = dayAfterGap(DAY_ZERO, gap);
      expect(openDay(declined, backOn).kind).toBe('gap-covered-by-grace');
      expect(unwrap(recordTrainingDay(declined, backOn)).streakAfter).toBe(10);
    }
  });

  it('does not consume the first-save moment, because nothing was saved', () => {
    // GDD §4.3 fires on the first save the player is actually given. An absence
    // that cost nothing is not that moment, so the flag must survive it.
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    const trained = unwrap(recordTrainingDay(state, dayAfterGap(DAY_ZERO, GRACE))).state;
    expect(trained.hasBankedFirstRecoveryDaySave).toBe(false);
    const later = openDay(trained, dayAfterGap(trained.lastTrainedDay as StreakDay, SHORTEST_PAID_GAP));
    if (later.kind !== 'gap-covered-by-recovery-days') throw new Error('expected a Recovery Day save');
    expect(later.isFirstRecoveryDaySave).toBe(true);
  });

  it('stops exactly one day past the grace, where the first Recovery Day is charged', () => {
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    expect(openDay(state, dayAfterGap(DAY_ZERO, GRACE)).kind).toBe('gap-covered-by-grace');

    const opening = openDay(state, dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP));
    if (opening.kind !== 'gap-covered-by-recovery-days') throw new Error('expected a Recovery Day save');
    expect(opening.recoveryDaysHolding).toBe(1);
    expect(opening.daysCoveredFreeByGrace).toBe(GRACE);
    expect(opening.daysMissed).toBe(SHORTEST_PAID_GAP);
    expect(opening.balanceIfBankedToday).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW - 1);
  });

  it('[grace-is-recomputed-not-banked] is recomputed from the absence rather than banked, so it never runs out', () => {
    // The grace is not a consumable and has no counter. A player who trains one
    // day in every GRACE + 1 holds a run open forever, spending nothing. This is
    // the accepted cost of the §4.4 ruling, pinned so it is on the record rather
    // than discovered in playtesting.
    const CYCLES = 40;
    let state: StreakState = holding(freshState(), withCoveredDays(0));
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
    // NO INCOME ACCUMULATED, however many milestones went by. Under the stock
    // this asserted a balance equal to the milestones passed; under the
    // entitlement there is nothing to accumulate, which is the whole point.
    expect(coveredDaysLeftInWindow(state)).toBeLessThanOrEqual(
      RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW,
    );
  });

  it('extends the run without extending the count — a covered day is not a trained day', () => {
    let state: StreakState = holding(freshState(), withCoveredDays(0));
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
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
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
      // ONE COVERED DAY OUT OF THE WINDOW, not "two left out of the old signup
      // grant of three". Derived rather than written as a literal so a retune
      // moves it instead of quietly making this a test of a different tuning.
      balanceIfBankedToday: RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW - 1,
      lastDayStreakCanBeSaved: addDays(DAY_ZERO, 1 + coverableGapDays(state, TODAY_FOR_READS)),
      isFirstRecoveryDaySave: true,
    });
  });

  it('is news, not a question: nothing is pending and nothing can be answered', () => {
    // The structural half of GDD §4.2's ruling. Reading the reveal changes
    // nothing, and — unlike the prompt it replaced — a session can be recorded
    // straight through it without answering anything first.
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
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
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    const runway = lastDayStreakCanBeSaved(state, TODAY_FOR_READS) as StreakDay;
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
    expect(revealsSeen).toBe(RECOVERY_ENTITLEMENT.MAX_COVERED_DAYS_PER_ABSENCE);
  });

  it('banks the save on the training day, spending exactly what was holding the run', () => {
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    const day = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    const outcome = unwrap(recordTrainingDay(state, day));
    expect(outcome.recoveryDaySave).toEqual({
      coveredDays: Array.from({ length: SHORTEST_PAID_GAP }, (_, i) => addDays(DAY_ZERO, i + 1)),
      daysCoveredFreeByGrace: GRACE,
      recoveryDaysSpent: 1,
      balanceAfter: RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW - 1,
      streakProtected: 9,
      wasFirstRecoveryDaySave: true,
    });
    expect(outcome.streakAfter).toBe(10);
    expect(outcome.previousRunEnded).toBe(false);
    expect(coveredDaysLeftInWindow(outcome.state)).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW - 1);
    // ...and the next absence is armed with what is left of the WINDOW, not
    // with what the lifter was holding — there is nothing to hold.
    expect(coveredDaysArmed(outcome.state, day)).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW - 1);
  });

  it('covers a longer absence in one go, charging only the days past the grace', () => {
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
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
      // Available right now: the break itself moves nothing.
      coveredDaysAvailable: 1,
      // ...and what the next session will take for it.
      recoveryDaysCommittedToTheAbsence: 1,
    });
    const outcome = unwrap(recordTrainingDay(state, day));
    // NO SAVE, because nothing was saved. The distinction is the whole reason
    // `recoveryDaysLostToTheAbsence` is a separate field.
    expect(outcome.recoveryDaySave).toBeNull();
    expect(outcome.recoveryDaysLostToTheAbsence).toBe(1);
    expect(coveredDaysLeftInWindow(outcome.state)).toBe(0);
    expect(outcome.streakAfter).toBe(1);
  });

  it('[mid-absence-arrival-cannot-arm] cannot be armed by a Recovery Day that arrives during the absence', () => {
    // "ARM AHEAD" IN ONE TEST, and the reason the outcome cannot depend on when
    // the player opens the app: a GDD §4.2 Gym Empire drop lands on a check-in,
    // so a grant that armed would be coverage bought by looking.
    const broke = { ...stateWithRun(9, DAY_ZERO, 0), entitlementArmed: true };
    const day = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    expect(openDay(broke, day).kind).toBe('streak-broken');

    // NOTHING CAN ARRIVE MID-ABSENCE ANY MORE. Under the stock this test
    // granted a Recovery Day during the absence and checked it did not arm.
    // GDD §4.2's Option 1 ruling removed every grant path, so the only thing
    // that can change coverage mid-absence is the calendar — and it changes it
    // identically whether or not anybody looks.
    const nextWindow = addDays(DAY_ZERO, RECOVERY_ENTITLEMENT.WINDOW_DAYS);
    expect(coveredDaysArmed(broke, nextWindow)).toBe(
      RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW,
    );
    // The absence in progress is still doomed: the window it resolves in has
    // nothing left, and a later window's entitlement does not reach back.
    expect(openDay(broke, day).kind).toBe('streak-broken');

    // And the session that ends it arms whatever its own window holds.
    const restarted = unwrap(recordTrainingDay(broke, day)).state;
    expect(coveredDaysArmed(restarted, day)).toBe(0);

    // A PURCHASE ARRIVING MID-ABSENCE STILL CANNOT ARM IT, and this half was
    // missing — which is the point of the tag on the comment that claims it.
    // Everything above is about the CALENDAR; §8.3E put a second thing back
    // that can change coverage mid-absence, and pointing a purchase at
    // `armedEntitlement` left every assertion above green.
    //
    // IT HAS TO BE A SALVAGEABLE ABSENCE, because the store will not sell into a
    // doomed one at all — so the case worth testing is the one that is still
    // alive, where a rescue would actually be a rescue.
    const covered = stateWithRun(9, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    const midAbsence = addDays(DAY_ZERO, GRACE);
    expect(absenceOutcome(covered, midAbsence).protectionHolds, 'still sellable').toBe(true);
    const armedBefore = coveredDaysArmed(covered, midAbsence);
    const afterBuying = unwrap(
      applySettledCoveredDayPurchase(covered, midAbsence, {
        orderId: 'mid-absence',
        coveredDays: 1,
        tender: 'chalk-purchased',
        renderedOffer: offerAsRenderedOn(covered, midAbsence),
      }),
    ).state;
    // The balance rose...
    expect(coveredDaysLeftInWindow(afterBuying)).toBe(coveredDaysLeftInWindow(covered) + 1);
    // ...and what the absence in progress may draw did not.
    expect(coveredDaysArmed(afterBuying, midAbsence), 'the purchase armed this absence').toBe(
      armedBefore,
    );
    expect(afterBuying.armedEntitlement, 'the snapshot moved').toEqual(covered.armedEntitlement);
  });

  it('keeps the runway fixed for the whole absence, so reminder copy cannot change its mind', () => {
    let sweptStates = 0;
    for (let balance = 0; balance <= RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW; balance += 1) {
      const state = stateWithRun(9, DAY_ZERO, balance);
      const runway = lastDayStreakCanBeSaved(state, TODAY_FOR_READS) as StreakDay;
      // Ground truth: the last day `openDay` does NOT report a break.
      let lastAlive = DAY_ZERO;
      for (let offset = 1; offset <= 20; offset += 1) {
        const day = addDays(DAY_ZERO, offset);
        if (openDay(state, day).kind === 'streak-broken') break;
        lastAlive = day;
      }
      expect(runway).toBe(lastAlive);
      expect(coverableGapDays(state, TODAY_FOR_READS)).toBe(daysBetween(DAY_ZERO, lastAlive) - 1);
      sweptStates += 1;
    }
    expect(sweptStates).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW + 1);
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
    // `entitlementArmed: false` spends nothing — true, and nearly tautological.
    // It would say nothing about whether the toggle produces that state, or
    // whether the next session quietly re-arms in spite of it.
    const play = (declineOnDayOne: boolean): {
      readonly spent: number;
      readonly streak: number;
      readonly balance: number;
      readonly reason: string | null;
    } => {
      let state: StreakState = holding(freshState(), withCoveredDays(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW));
      state = unwrap(recordTrainingDay(state, DAY_ZERO)).state;
      if (declineOnDayOne) state = setRecoveryDayProtection(state, false).state;
      // A second session, so the arming path runs again after the setting moved.
      state = unwrap(recordTrainingDay(state, addDays(DAY_ZERO, 1))).state;
      const backOn = dayAfterGap(addDays(DAY_ZERO, 1), SHORTEST_PAID_GAP);
      const outcome = unwrap(recordTrainingDay(state, backOn));
      return {
        spent: outcome.recoveryDaySave?.recoveryDaysSpent ?? 0,
        streak: outcome.streakAfter,
        balance: coveredDaysLeftInWindow(outcome.state),
        reason: outcome.endedRunReason,
      };
    };

    const kept = play(false);
    expect(kept.spent).toBe(1);
    expect(kept.streak).toBe(3);
    // ONE COVERED DAY OUT OF THE WINDOW. Written as a subtraction from the
    // window rather than as the literal 2 it used to be, which was the old
    // signup grant of three minus the one this absence spent.
    expect(kept.balance).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW - 1);
    expect(kept.reason).toBeNull();

    const declined = play(true);
    // NOT ONE RECOVERY DAY TAKEN. This is the assertion the human's ruling asked
    // for in as many words.
    expect(declined.spent).toBe(0);
    expect(declined.balance).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    expect(declined.streak).toBe(1);
    expect(declined.reason).toBe('recovery-day-protection-declined');
  });

  it('spends nothing at any balance or absence length while it is off', () => {
    let brokenRuns = 0;
    for (let balance = 0; balance <= RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW; balance += 1) {
      for (let gap = 1; gap <= LONGEST_REPAIRABLE_ABSENCE_DAYS + 2; gap += 1) {
        const state = unprotectedStateWithRun(9, DAY_ZERO, balance);
        const outcome = unwrap(recordTrainingDay(state, dayAfterGap(DAY_ZERO, gap)));
        expect(outcome.recoveryDaySave).toBeNull();
        expect(coveredDaysLeftInWindow(outcome.state)).toBe(balance);
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
    const declined = unprotectedStateWithRun(9, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    const saveable = openDay(declined, dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP));
    if (saveable.kind !== 'streak-broken') throw new Error('expected a break');
    expect(saveable.reason).toBe('recovery-day-protection-declined');

    const hopeless = openDay(declined, dayAfterGap(DAY_ZERO, LONGEST_REPAIRABLE_ABSENCE_DAYS + 1));
    if (hopeless.kind !== 'streak-broken') throw new Error('expected a break');
    expect(hopeless.reason).toBe('absence-longer-than-consecutive-limit');
  });

  it('[protection-toggle-is-not-a-refill] turning it OFF reaches the absence already in progress', () => {
    // The safe direction: it can only end a run early, never rescue one, so it
    // applies immediately and a player who declines cannot be charged for the
    // absence they are standing in.
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    const day = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    expect(openDay(state, day).kind).toBe('gap-covered-by-recovery-days');

    const off = setRecoveryDayProtection(state, false);
    expect(off.appliesToTheAbsenceInProgress).toBe(true);
    expect(off.armedRecoveryDays).toBeNull();
    // THE ENTITLEMENT ITSELF IS NEVER CLEARED — only the arming is. That is what
    // stops off-then-on-then-train being a free refill, so the window still
    // reads full here even though nothing can draw on it.
    expect(coveredDaysLeftInWindow(off.state)).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    expect(openDay(off.state, day).kind).toBe('streak-broken');
    expect(coveredDaysLeftInWindow(unwrap(recordTrainingDay(off.state, day)).state)).toBe(
      RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW,
    );

    // ...AND IT IS CHECKED ON A PARTLY-SPENT WINDOW, which is the only place
    // "never cleared" is observable. The fixture above starts at a FULL window,
    // so a mutant that refreshed the entitlement on the way out of the toggle
    // left every line above green — the refill and the real value were the same
    // number. Found by mutation, not by reading.
    const partlySpent = stateWithRun(9, DAY_ZERO, 1);
    expect(coveredDaysLeftInWindow(partlySpent), 'the premise: not a full window').toBeLessThan(
      RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW,
    );
    const offAgain = setRecoveryDayProtection(partlySpent, false).state;
    expect(coveredDaysLeftInWindow(offAgain), 'turning protection off refilled the window').toBe(1);
    // And back on, then a session: still one, not a fresh window.
    const backOn = setRecoveryDayProtection(offAgain, true).state;
    expect(coveredDaysLeftInWindow(backOn), 'turning protection on refilled the window').toBe(1);
    expect(
      coveredDaysLeftInWindow(unwrap(recordTrainingDay(backOn, addDays(DAY_ZERO, 1))).state),
      'off-then-on-then-train was a free refill',
    ).toBe(1);
  });

  it('turning it ON applies from the next session, and says so', () => {
    // The unsafe direction. Arming mid-absence would let a toggle resurrect a run
    // the calendar had already ended, which is the "outcome depends on when you
    // act" defect in a different costume.
    const declined = unprotectedStateWithRun(9, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    const day = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    expect(openDay(declined, day).kind).toBe('streak-broken');

    const on = setRecoveryDayProtection(declined, true);
    expect(on.appliesToTheAbsenceInProgress).toBe(false);
    expect(on.armedRecoveryDays).toBeNull();
    expect(on.state.recoveryDayProtectionEnabled).toBe(true);
    expect(openDay(on.state, day).kind).toBe('streak-broken');

    // ...and the session after it arms normally.
    const trained = unwrap(recordTrainingDay(on.state, day));
    expect(trained.armedForNextAbsence).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    expect(openDay(trained.state, dayAfterGap(day, SHORTEST_PAID_GAP)).kind).toBe(
      'gap-covered-by-recovery-days',
    );
  });

  it('changes nothing else about the state', () => {
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    const off = setRecoveryDayProtection(state, false).state;
    const changed = STREAK_FACT_KEYS.filter((key) => off[key] !== state[key]);
    // `entitlementArmed` is the heir of `armedRecoveryDays`: the toggle disarms,
    // and it must not touch the entitlement itself.
    expect([...changed].sort()).toEqual(['entitlementArmed', 'recoveryDayProtectionEnabled']);
    expect(off.entitlement).toBe(state.entitlement);
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
    expect(coveredDaysLeftInWindow(outcome.state)).toBe(
      coveredDaysLeftInWindow(before) - save.recoveryDaysSpent + outcome.recoveryDaysGranted,
    );
    return save.recoveryDaysSpent;
  }

  it('leaves currentStreak and longestStreak untouched, at every chargeable absence length', () => {
    for (let chargeable = 1; chargeable <= RECOVERY_ENTITLEMENT.MAX_COVERED_DAYS_PER_ABSENCE; chargeable += 1) {
      for (const streak of [1, 2, 6, 8, 29, 31, 99, 365]) {
        const before = stateWithRun(streak, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
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
    const before = stateWithRun(42, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    const day = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    const outcome = unwrap(recordTrainingDay(before, day));
    assertPaidPath(before, outcome);

    const changed = STREAK_FACT_KEYS.filter((key) => outcome.state[key] !== before[key]);
    expect([...changed].sort()).toEqual(
      [
        'currentStreak',
        // The two stock fields — `recoveryDayBalance` and `armedRecoveryDays` —
        // collapsed into this one snapshot. `entitlementArmed` is NOT in the
        // list, and that is the observable half of the collapse: a save moves
        // what the window has left, and re-arming is no longer a number that
        // has to move with it.
        'entitlement',
        // A SESSION RE-ARMS, so the snapshot the NEXT absence will resolve
        // against moves too — both what it holds and the day it was taken on.
        // This is the one entry point that may move it unconditionally;
        // `applySettledCoveredDayPurchase` moves it only for a purchase dated
        // on or before the arming day, and the sweeps below check that.
        'armedEntitlement',
        'hasBankedFirstRecoveryDaySave',
        'lastTrainedDay',
        'longestStreak',
      ].sort(),
    );
    expect(outcome.state.entitlementArmed).toBe(before.entitlementArmed);
  });

  it('is a DIFFERENT path from the free grace, and the free path is the one that spends nothing', () => {
    const state = stateWithRun(11, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);

    const graceDay = dayAfterGap(DAY_ZERO, GRACE);
    expect(openDay(state, graceDay).kind).toBe('gap-covered-by-grace');
    const throughGrace = unwrap(recordTrainingDay(state, graceDay));
    expect(throughGrace.recoveryDaySave).toBeNull();
    expect(coveredDaysLeftInWindow(throughGrace.state)).toBe(coveredDaysLeftInWindow(state));
    expect(throughGrace.streakAfter).toBe(12);

    const paidDay = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    expect(openDay(state, paidDay).kind).toBe('gap-covered-by-recovery-days');
    const throughSpend = unwrap(recordTrainingDay(state, paidDay));
    assertPaidPath(state, throughSpend);
    expect(throughSpend.streakAfter).toBe(12);
  });

  it('holds across a long history in which every absence is paid for', () => {
    let state: StreakState = stateWithRun(5, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
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
// What replaced the hold cap: a window that refills, and cannot be hoarded
// ---------------------------------------------------------------------------

describe('the window entitlement', () => {
  it('CANNOT BE HOARDED: no amount of training banks more than one window holds', () => {
    // THE HOLD CAP'S REPLACEMENT, and the reason the cap is gone. A cap exists
    // to bound a hoard; an entitlement has no hoard to bound. Train every day
    // for four windows and the most that is ever available is one window's
    // worth — which is what makes the doomed-absence debit independent of how
    // much the lifter has, and that independence is the whole of GDD §4.2's
    // Option 1 ruling.
    let state: StreakState = freshState();
    let mostSeen = 0;
    const days = RECOVERY_ENTITLEMENT.WINDOW_DAYS * 4;
    for (let i = 0; i < days; i += 1) {
      state = unwrap(recordTrainingDay(state, addDays(DAY_ZERO, i))).state;
      mostSeen = Math.max(mostSeen, coveredDaysLeftInWindow(state));
    }
    expect(mostSeen).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    expect(state.currentStreak).toBe(days);
  });

  it('REFILLS at the window boundary, without anybody opening the app', () => {
    // A lifter who spent their whole entitlement gets it back when the window
    // turns, and the turn is a function of the calendar rather than of a visit.
    // This is what a stock never did: the two lifters re-converge.
    const spent: StreakState = holding(stateWithRun(9, DAY_ZERO, 0), withCoveredDays(0, 0));
    expect(coveredDaysArmed(spent, DAY_ZERO)).toBe(0);
    const nextWindow = addDays(DAY_ZERO, RECOVERY_ENTITLEMENT.WINDOW_DAYS);
    expect(coveredDaysArmed(spent, nextWindow)).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    expect(entitlementWindowFor(spent, nextWindow)).toBe(1);
  });

  it('[doomed-absence-takes-what-is-left] A DOOMED ABSENCE TAKES WHAT IS LEFT, AND NO MORE THAN A WINDOW HOLDS', () => {
    // GDD §4.2 RULE 2, carried over. Dropping the burn measures 1051 violating
    // pairs at 60 days — worse than the stock it replaced — because it is the
    // only consumption idempotent under splitting an absence.
    const full = stateWithRun(9, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    const doomed = addDays(DAY_ZERO, LONGEST_REPAIRABLE_ABSENCE_DAYS + 2);
    const outcome = unwrap(recordTrainingDay(full, doomed));
    expect(outcome.previousRunEnded).toBe(true);
    expect(outcome.recoveryDaysLostToTheAbsence).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    expect(coveredDaysLeftInWindow(outcome.state)).toBe(0);
  });

  it('[nothing-in-game-awards-a-purchased-day] NOTHING IN THE GAME AWARDS A PURCHASED DAY — every other entry point, driven, from a state that HAS some', () => {
    // GDD §8.3E CONDITION 3, behaviourally. `applySettledCoveredDayPurchase` is
    // the one function that may raise `purchasedDaysLeft`; this drives a long,
    // varied history through every OTHER transition and asserts the field never
    // goes up.
    //
    // IT STARTS FROM A STATE THAT ALREADY HOLDS PURCHASED DAYS, which the
    // version of this test that pinned the field at zero could not do. A sweep
    // that begins on zero and asserts zero is satisfied by an engine that
    // cannot represent the number at all; this one can watch the count fall as
    // absences draw on it and would see it rise.
    const bought = unwrap(
      applySettledCoveredDayPurchase(freshState(), DAY_ZERO, {
        orderId: 'order-1',
        coveredDays: 5,
        tender: 'chalk-purchased',
        renderedOffer: offerAsRenderedOn(freshState(), DAY_ZERO),
      }),
    );
    let state: StreakState = bought.state;
    expect(state.entitlement.purchasedDaysLeft).toBe(5);

    let highWater = state.entitlement.purchasedDaysLeft;
    let everFell = false;
    for (let i = 0; i < 90; i += 1) {
      const before = state.entitlement.purchasedDaysLeft;
      if (i % 5 !== 0) {
        const outcome = recordTrainingDay(state, addDays(DAY_ZERO, i));
        if (outcome.ok) state = outcome.value.state;
      }
      const settled = settleBrokenStreak(state, addDays(DAY_ZERO, i));
      if (settled.ok) state = settled.value.state;
      state = setRecoveryDayProtection(state, i % 7 !== 0).state;
      const adopted = adoptSignupDay(state, DAY_ZERO);
      if (adopted.ok) state = adopted.value;
      // Read models too: none of them returns a state, but all of them are
      // handed one, and a read model that mutated its argument would show here.
      openDay(state, addDays(DAY_ZERO, i));
      absenceOutcome(state, addDays(DAY_ZERO, i));
      coveredDaysArmed(state, addDays(DAY_ZERO, i));

      const after = state.entitlement.purchasedDaysLeft;
      expect(after, `day ${i}: a purchased covered day was awarded by a game action`).toBeLessThanOrEqual(
        before,
      );
      if (after < before) everFell = true;
      highWater = Math.max(highWater, after);
    }
    // NOT VACUOUS: the count really did move, so "it never rose" is a statement
    // about a live number rather than about an untouched one.
    expect(everFell, 'no purchased day was ever spent, so this history proves nothing').toBe(true);
    expect(highWater).toBe(5);
  });

  it('[export-surface-exhaustive] AND EXHAUSTIVELY OVER THE EXPORT SURFACE: every exported function, called every way it can be', () => {
    // THE GUARD THAT DOES NOT DEPEND ON THIS TEST REMEMBERING A FUNCTION. The
    // drive above names its transitions, so a NEW exported transition that
    // awards a purchased day would slip past it. This one enumerates the
    // module's exports at runtime, calls each with every plausible argument
    // tuple, and deep-scans whatever comes back for an entitlement whose
    // purchased count is higher than the one it was handed.
    //
    // Throws are ignored on purpose: most of these calls are type-nonsense and
    // the ones that refuse are refusing correctly. What is not ignored is a
    // function that ACCEPTS nonsense and hands back extra coverage.
    const seed = unwrap(
      applySettledCoveredDayPurchase(freshState(), DAY_ZERO, {
        orderId: 'order-1',
        coveredDays: 3,
        tender: 'chalk-purchased',
        renderedOffer: offerAsRenderedOn(freshState(), DAY_ZERO),
      }),
    ).state;
    const held = seed.entitlement.purchasedDaysLeft;

    const purchasedIn = (value: unknown, depth = 0): number => {
      if (depth > 6 || value === null || typeof value !== 'object') return 0;
      const record = value as Record<string, unknown>;
      let worst = 0;
      if (typeof record.purchasedDaysLeft === 'number') worst = record.purchasedDaysLeft;
      for (const key of Object.keys(record)) worst = Math.max(worst, purchasedIn(record[key], depth + 1));
      return worst;
    };

    const day = addDays(DAY_ZERO, 40);
    const tuples: readonly unknown[][] = [
      [seed],
      [seed, day],
      [seed, DAY_ZERO],
      [seed, true],
      [seed, false],
      [seed, 99],
      [day],
      [99],
      [seed, day, { orderId: '', coveredDays: 99, tender: 'chalk-purchased' }],
      [seed, day, { orderId: 'x', coveredDays: 99, tender: 'milestone' }],
      [seed, day, { orderId: 'x', coveredDays: 99 }],
    ];

    const exemptFromTheCeiling = 'applySettledCoveredDayPurchase';
    let called = 0;
    let observed = 0;
    for (const [name, exported] of Object.entries(streakModule)) {
      if (typeof exported !== 'function') continue;
      if (name === exemptFromTheCeiling) continue;
      for (const args of tuples) {
        let result: unknown;
        try {
          result = (exported as (...a: unknown[]) => unknown)(...args);
        } catch {
          continue;
        }
        called += 1;
        const reached = purchasedIn(result);
        if (reached > 0) observed += 1;
        expect(
          reached,
          `${name}(${args.length} args) produced ${reached} purchased days from ${held}`,
        ).toBeLessThanOrEqual(held);
      }
    }
    // The harness really ran, and really saw the field: a scan that never found
    // a `purchasedDaysLeft` anywhere would pass this while checking nothing.
    expect(called).toBeGreaterThan(20);
    expect(observed, 'no call ever returned a state carrying purchased days').toBeGreaterThan(0);

    // AND THE EXEMPT ONE IS EXEMPT FOR A REASON: it is the only export that can
    // raise the count, and it needs a settled order to do it. Handed the same
    // nonsense tuples as everything else, it refuses.
    for (const args of tuples.slice(-3)) {
      const outcome = applySettledCoveredDayPurchase(
        args[0] as StreakState,
        args[1] as StreakDay,
        args[2] as Parameters<typeof applySettledCoveredDayPurchase>[2],
      );
      expect(outcome.ok, 'a malformed order must be refused, not absorbed').toBe(false);
    }
  });

  it('NO PAY-TO-WIN, END TO END: ten purchased days do not make a five-day absence survivable', () => {
    // THE ASSERTION GDD §8.3E'S FIRST RULE RESTS ON, driven through the shipped
    // engine now that the purchase is real. `streakEntitlement.test.ts` makes
    // the same check against the entitlement in isolation; this one buys through
    // `applySettledCoveredDayPurchase` and then walks a lifter into an absence.
    //
    // IT HAD TO BE WRITTEN, NOT JUST KEPT. The `streak.ts`-level ceiling test
    // this sits beside runs on a fixture whose purchased count is zero, so a
    // mutant that raised the per-absence draw for anyone holding a purchased day
    // — pay-to-win in one line — left it green. This is the version that bites.
    let state: StreakState = freshState();
    for (let i = 0; i < 10; i += 1) {
      state = unwrap(
        applySettledCoveredDayPurchase(state, DAY_ZERO, {
          orderId: `order-${i}`,
          coveredDays: 1,
          tender: 'chalk-purchased',
          renderedOffer: offerAsRenderedOn(state, DAY_ZERO),
        }),
      ).state;
    }
    state = unwrap(recordTrainingDay(state, DAY_ZERO)).state;
    expect(state.entitlement.purchasedDaysLeft).toBe(10);
    expect(coveredDaysLeftInWindow(state)).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW + 10);

    // The ceiling is `LONGEST_REPAIRABLE_ABSENCE_DAYS`, and money does not move
    // it. One day past is dead however much was bought.
    const survivable = dayAfterGap(DAY_ZERO, LONGEST_REPAIRABLE_ABSENCE_DAYS);
    const doomed = dayAfterGap(DAY_ZERO, LONGEST_REPAIRABLE_ABSENCE_DAYS + 1);
    expect(absenceOutcome(state, survivable).protectionHolds).toBe(true);
    expect(
      absenceOutcome(state, doomed).protectionHolds,
      'ten purchased days must not buy through the per-absence ceiling',
    ).toBe(false);
    expect(absenceOutcome(state, doomed).breakReason).toBe('absence-longer-than-consecutive-limit');

    const returned = unwrap(recordTrainingDay(state, doomed));
    expect(returned.previousRunEnded).toBe(true);
    expect(returned.streakAfter).toBe(1);
    // AND THE PURCHASE IS BURNED WITH THE REST, not spared for having been paid
    // for. A bought covered day is not a better covered day.
    expect(returned.recoveryDaysLostToTheAbsence).toBe(
      RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW + 10,
    );
    expect(coveredDaysLeftInWindow(returned.state)).toBe(0);

    // AND IT NEVER ADDS TO A RUN. The purchase itself moves neither figure, and
    // says so on the outcome rather than leaving it to be checked.
    const bought = unwrap(
      applySettledCoveredDayPurchase(stateWithRun(9, DAY_ZERO, 1), DAY_ZERO, {
        orderId: 'order-x',
        coveredDays: 4,
        tender: 'real-money',
        renderedOffer: offerAsRenderedOn(stateWithRun(9, DAY_ZERO, 1), DAY_ZERO),
      }),
    );
    expect(bought.state.currentStreak).toBe(9);
    expect(bought.state.longestStreak).toBe(stateWithRun(9, DAY_ZERO, 1).longestStreak);
    expect(bought.currentStreakUnchanged).toBe(9);
    expect(bought.longestStreakUnchanged).toBe(bought.state.longestStreak);
  });

  it('[no-tender-arrives-by-training] NO TENDER ARRIVES BY TRAINING — AT RUNTIME, for the callers the compiler never sees', () => {
    // THE SECOND LINE OF THE PROVENANCE FIX, and this test exists BECAUSE the
    // first line cannot be tested from TypeScript: `tender` is typed
    // `NonTrainingGatedTender`, so the honest way to write the illegal call
    // does not compile at all. `currencyProvenance.test.ts` owns the structural
    // half; this one casts past the type on purpose, exactly as a JSON payload
    // decoded from an Edge Function response does.
    //
    // WHAT THE OLD VERSION OF THIS TEST CHECKED AND WHY IT WAS NOT ENOUGH. It
    // asserted that every tender declares an arrival and that no arrival is
    // NAMED after something training reaches. Both were true of the shipped
    // code while the shipped code accepted achievement Chalk, because the
    // tender was `'chalk'` and its declared arrival was `'calendar-or-payment'`
    // — a true-sounding claim about a currency, made where the fact lives on
    // the individual units. The measurement that fell out of that hole is
    // 105 / 305 / 733 / 785 violating pairs.
    type Wire = Parameters<typeof applySettledCoveredDayPurchase>[2];
    const asWire = (tender: string): Wire =>
      ({
        orderId: 'order-1',
        coveredDays: 1,
        tender,
        renderedOffer: offerAsRenderedOn(freshState(), DAY_ZERO),
      } as unknown as Wire);

    // EVERY TRAINING-GATED TENDER IS REFUSED, enumerated from the derived list
    // rather than spelled out, so a tender re-tagged in `TENDER_ARRIVAL` is
    // covered here without anybody editing this test.
    expect(TRAINING_GATED_TENDERS.length, 'a partition with an empty side restricts nothing').toBeGreaterThan(0);
    for (const tender of TRAINING_GATED_TENDERS) {
      const outcome = applySettledCoveredDayPurchase(freshState(), DAY_ZERO, asWire(tender));
      expect(outcome.ok, `${tender} must not be able to buy a covered day`).toBe(false);
      // A DISTINCT CODE, not `INVALID_PURCHASE`. This is a real balance being
      // refused for one purchase while staying valid for every other, and a
      // store that says "invalid purchase" to that is lying to the player.
      if (!outcome.ok) expect(outcome.error.code).toBe('TRAINING_FUNDED_TENDER');
    }
    // AND SOMETHING THAT IS NOT A TENDER AT ALL IS A DIFFERENT REFUSAL.
    for (const notATender of ['milestone', 'achievement', 'streak', 'free', 'chalk', '']) {
      const outcome = applySettledCoveredDayPurchase(freshState(), DAY_ZERO, asWire(notATender));
      expect(outcome.ok, `${notATender} must not be a way to obtain a covered day`).toBe(false);
      if (!outcome.ok) expect(outcome.error.code).toBe('INVALID_PURCHASE');
    }
    // `'chalk'` IS IN THAT LIST DELIBERATELY. It was the shipped tender one
    // commit ago and it is now a refusal, because "Chalk" is not an answer to
    // "where did this money come from".

    // AND EVERY NON-TRAINING-GATED TENDER WORKS, so the refusals above are not
    // refusing everything — and the receipt reports the provenance it was paid
    // with, not just the currency.
    expect(NON_TRAINING_GATED_TENDERS.length).toBeGreaterThan(0);
    for (const tender of NON_TRAINING_GATED_TENDERS) {
      const outcome = applySettledCoveredDayPurchase(freshState(), DAY_ZERO, {
        orderId: 'order-1',
        coveredDays: 1,
        tender,
        renderedOffer: offerAsRenderedOn(freshState(), DAY_ZERO),
      });
      expect(outcome.ok, `${tender} must be a way to buy one`).toBe(true);
      if (outcome.ok) {
        expect(outcome.value.tender).toBe(tender);
        expect(outcome.value.currency).toBe(TENDER_CURRENCY[tender]);
      }
    }
    // The two halves really are the whole list, so "every tender is checked
    // above" is a fact rather than a hope.
    expect([...NON_TRAINING_GATED_TENDERS, ...TRAINING_GATED_TENDERS].sort()).toEqual(
      [...COVERED_DAY_TENDERS].sort(),
    );
  });

  it('THE ESCALATION A TRAINING-KEYED TENDER WOULD HAVE TO WALK, walked rather than assumed', () => {
    // GDD §8.3E's condition 3 asks for enforcement rather than absence, and the
    // honest way to check enforcement is to ask what it costs to break it.
    //
    //   1. A NEW TENDER fails `tsc` at `TENDER_CURRENCY` and at `TENDER_ARRIVAL`
    //      until it declares both. Neither map has a default.
    //   2. DECLARING `'session-count'` makes it a `TrainingGatedTender` by
    //      construction, so `SettledCoveredDayPurchase.tender` rejects it and
    //      the runtime refuses it. Nothing else has to be edited for that to
    //      happen, and nothing else CAN be edited to stop it.
    //   3. THE ONLY WIDENING EDIT is re-tagging an arrival in `ARRIVAL_GATING`,
    //      which is one word — and it is one word in a table with the
    //      measurement printed above it, which fails this test.
    //
    // Step 1 and step 2 are `tsc`'s to enforce and are demonstrated by the
    // module compiling at all. This is step 3.
    expect(TENDER_ARRIVALS).toContain('session-count');
    for (const tender of COVERED_DAY_TENDERS) {
      const arrival = TENDER_ARRIVAL[tender];
      // A TENDER WHOSE NAME SAYS TRAINING MUST ARRIVE BY `'session-count'`.
      // A floor and not a ceiling — a tender called `'chalk-q7'` paid on
      // achievements satisfies it — but it catches the honest mistake, which is
      // adding `'chalk-milestone'` and tagging it `'calendar'` by copy-paste.
      if (/streak|session|milestone|achiev|tier|progress|earn/i.test(tender)) {
        expect(arrival, `${tender} names something training reaches`).toBe('session-count');
      }
    }
    // AND THE VERDICT ON THAT ARRIVAL IS THE ONE THE MEASUREMENT SUPPORTS.
    // Flipping it is the single edit that reopens 105 / 305 / 733 / 785
    // violating pairs, and this is the assertion that goes red when somebody
    // does.
    for (const tender of TRAINING_GATED_TENDERS) {
      expect(TENDER_ARRIVAL[tender]).toBe('session-count');
    }
    for (const tender of NON_TRAINING_GATED_TENDERS) {
      expect(TENDER_ARRIVAL[tender]).not.toBe('session-count');
    }
  });

  it('AND THE EXEMPTION IS NOT A HOLE: the purchase credits the ORDER, and never a day more', () => {
    // THE GAP THE TWO GUARDS ABOVE LEFT, CLOSED. Both of them let the one
    // exempt entry point do whatever it likes — the declaration allowlist
    // because `applySettledCoveredDayPurchase` is on it, the export-surface
    // sweep because it is skipped. So a training-keyed bonus written INSIDE it
    //
    //     purchase.coveredDays + (state.currentStreak >= 7 ? 1 : 0)
    //
    // passed every test in this file and in `streakEntitlement.test.ts`. That
    // mutant is a covered day awarded for a streak, which is exactly what GDD
    // §8.3E condition 3 forbids and exactly the shape §4.4 traces as the defect.
    //
    // What closes it is not another allowlist but an EXACT arithmetic: the
    // coverage this function adds equals what the order says, over states that
    // differ in every field a bonus could plausibly key off.
    //
    // THE STORE NOW REFUSES SOME OF THIS GRID, and the sweep asserts on both
    // sides of the door rather than shrinking to the sellable corner. Where it
    // sells, the credit is exactly the order; where it refuses, it credits
    // nothing at all — which is the same property read the other way, and the
    // half a `streak >= 7 ? 1 : 0` mutant could otherwise hide in.
    const orders = [1, 2, 5];
    let checked = 0;
    let sold = 0;
    let refused = 0;
    for (const streak of [0, 1, 6, 7, 30, 100]) {
      for (const armed of [true, false]) {
        for (const gapDays of [0, 3, 40]) {
          for (const coveredDays of orders) {
            const base: StreakState = {
              ...stateWithRun(streak, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW),
              entitlementArmed: armed,
              recoveryDayProtectionEnabled: armed,
            };
            const day = addDays(DAY_ZERO, gapDays);
            const before = coveredDaysLeftInWindow(base);
            const label = `streak ${streak}, armed ${armed}, gap ${gapDays}`;
            const result = applySettledCoveredDayPurchase(base, day, {
              orderId: `order-${checked}`,
              coveredDays,
              tender: 'chalk-purchased',
              renderedOffer: offerAsRenderedOn(base, day),
            });
            if (result.ok) {
              sold += 1;
              const outcome = result.value;
              const grew =
                outcome.state.entitlement.purchasedDaysLeft - base.entitlement.purchasedDaysLeft;
              expect(grew, label).toBe(coveredDays);
              expect(outcome.coveredDaysCredited).toBe(coveredDays);
              // And the free side is untouched, except where the window turned
              // over on its own — which is the calendar, not the purchase.
              const turnedOver = entitlementWindowFor(base, day) > base.entitlement.windowIndex;
              if (!turnedOver) {
                expect(outcome.state.entitlement.coveredDaysLeft).toBe(
                  base.entitlement.coveredDaysLeft,
                );
                expect(coveredDaysLeftInWindow(outcome.state)).toBe(before + coveredDays);
              }
            } else {
              refused += 1;
              // A REFUSAL CREDITS NOTHING, at any streak length. A bonus written
              // into the refused branch would be just as much a covered day
              // awarded for a streak as one written into the sold branch.
              expect(errorCodeOf(result), label).toBe('ABSENCE_ALREADY_DOOMED');
              expect(absenceOutcome(base, day).protectionHolds, label).toBe(false);
            }
            checked += 1;
          }
        }
      }
    }
    expect(checked).toBe(6 * 2 * 3 * 3);
    // BOTH SIDES REACHED, or one of the two branches above is asserting over an
    // empty column.
    expect(sold, 'orders the store took').toBeGreaterThan(0);
    expect(refused, 'orders the store refused').toBeGreaterThan(0);
    expect(sold + refused).toBe(checked);
    // AND THE SOLD SIDE STILL VARIES THE STREAK, which is what makes the exact
    // arithmetic above a test of the mutant rather than of one streak length.
    const streaksThatSold = new Set<number>();
    for (const streak of [0, 1, 6, 7, 30, 100]) {
      const base: StreakState = stateWithRun(
        streak,
        DAY_ZERO,
        RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW,
      );
      const result = applySettledCoveredDayPurchase(base, DAY_ZERO, {
        orderId: `vary-${streak}`,
        coveredDays: 1,
        tender: 'chalk-purchased',
        renderedOffer: offerAsRenderedOn(base, DAY_ZERO),
      });
      if (result.ok) streaksThatSold.add(streak);
    }
    expect(streaksThatSold, 'the sold side spans the streak lengths a bonus could key off').toEqual(
      new Set([0, 1, 6, 7, 30, 100]),
    );
  });

  it('caps how far back a run can be rescued, whatever the balance', () => {
    const state = stateWithRun(50, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    expect(armedGapDays(state, TODAY_FOR_READS)).toBe(RECOVERY_ENTITLEMENT.MAX_COVERED_DAYS_PER_ABSENCE);
    expect(coverableGapDays(state, TODAY_FOR_READS)).toBe(GRACE + RECOVERY_ENTITLEMENT.MAX_COVERED_DAYS_PER_ABSENCE);
    expect(lastDayStreakCanBeSaved(state, TODAY_FOR_READS)).toBe(
      addDays(DAY_ZERO, 1 + GRACE + RECOVERY_ENTITLEMENT.MAX_COVERED_DAYS_PER_ABSENCE),
    );
  });
});

// ---------------------------------------------------------------------------
// Guardrail: consecutive uses
// ---------------------------------------------------------------------------

describe('the consecutive-use limit', () => {
  const LIMIT = RECOVERY_ENTITLEMENT.MAX_COVERED_DAYS_PER_ABSENCE;

  it('bounds the CHARGEABLE days of an absence, not the whole absence', () => {
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    const outcome = unwrap(recordTrainingDay(state, dayAfterGap(DAY_ZERO, GRACE + LIMIT)));
    expect(outcome.recoveryDaySave?.recoveryDaysSpent).toBe(LIMIT);
    expect(outcome.recoveryDaySave?.coveredDays).toHaveLength(GRACE + LIMIT);
  });

  it('refuses an absence one day past the limit, even at full balance', () => {
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    const tooLong = dayAfterGap(DAY_ZERO, GRACE + LIMIT + 1);
    expect(openDay(state, tooLong)).toEqual({
      kind: 'streak-broken',
      brokenRunLength: 9,
      daysMissed: GRACE + LIMIT + 1,
      reason: 'absence-longer-than-consecutive-limit',
      coveredDaysAvailable: RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW,
      recoveryDaysCommittedToTheAbsence: RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW,
    });
    // The guardrail bit rather than the balance — that is what the REASON says —
    // but the Recovery Days that were armed against this absence are still
    // spent on it. §5: an absence is charged whether or not it saved anything.
    expect(coveredDaysLeftInWindow(unwrap(recordTrainingDay(state, tooLong)).state)).toBe(0);
  });

  it('ends the run with coverage still unspent, which is the whole reason it exists', () => {
    // WHAT THIS USED TO ASSERT, and why it cannot: `HOLD_CAP > MAX_CONSECUTIVE
    // _USES`. The hold cap went with the stock, and `streakEntitlement.ts`
    // states outright that the window rate and the per-absence ceiling are "2
    // and 2 today by coincidence of tuning" and that raising the rate to 5
    // without raising the ceiling must still leave a week away unbuyable. A
    // strict inequality between them encodes a rank the design refuses, and at
    // the shipped tuning it is simply false.
    //
    // THE BEHAVIOUR IT WAS A PROXY FOR IS UNCHANGED and is what is checked now:
    // the run ends because the absence outran the CEILING, while the window
    // still has covered days in it. That is the difference between "you could
    // not afford this" and "this was never for sale", and it is what the reason
    // code has to get right.
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    const opening = openDay(state, dayAfterGap(DAY_ZERO, GRACE + LIMIT + 1));
    if (opening.kind !== 'streak-broken') throw new Error('expected a break');
    expect(opening.reason).toBe('absence-longer-than-consecutive-limit');
    expect(opening.coveredDaysAvailable).toBeGreaterThan(0);
    // ...and it bit at the ceiling rather than at the window: the lifter could
    // draw exactly LIMIT days and no more, holding a full window.
    expect(armedGapDays(state, TODAY_FOR_READS)).toBe(LIMIT);
    expect(openDay(state, dayAfterGap(DAY_ZERO, GRACE + LIMIT)).kind).toBe(
      'gap-covered-by-recovery-days',
    );
  });

  it('does NOT stop an alternating pattern of one trained day per chargeable absence', () => {
    // The module header claims this out loud rather than implying a guard it
    // does not have. Here it is: every trained day re-arms, so a player who
    // trains one day after each shortest chargeable absence spends one covered
    // day per absence until the WINDOW is empty, and only then breaks.
    //
    // THE BOUND CHANGED FROM A HOLD CAP TO A WINDOW, and that is the only thing
    // about this test that moved. The starting balance used to be a hand-picked
    // 3 — more than the window can now hold, which is why `withCoveredDays`
    // refuses it. It is the window rate now, and the pattern has to stay inside
    // ONE window or the refill would rescue it, which the arithmetic below
    // checks rather than assumes.
    const STARTING_BALANCE = RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW;
    const CYCLES = STARTING_BALANCE + 2;
    expect((CYCLES + 1) * (SHORTEST_PAID_GAP + 1)).toBeLessThan(RECOVERY_ENTITLEMENT.WINDOW_DAYS);

    let state: StreakState = stateWithRun(1, DAY_ZERO, STARTING_BALANCE);
    let spent = 0;
    let day = DAY_ZERO;
    let brokeAfter = -1;

    for (let cycle = 0; cycle < CYCLES && brokeAfter < 0; cycle += 1) {
      day = dayAfterGap(day, SHORTEST_PAID_GAP);
      const outcome = unwrap(recordTrainingDay(state, day));
      spent += outcome.recoveryDaySave?.recoveryDaysSpent ?? 0;
      if (outcome.previousRunEnded) brokeAfter = cycle;
      state = outcome.state;
    }

    expect(spent).toBe(STARTING_BALANCE);
    expect(coveredDaysLeftInWindow(state)).toBe(0);
    expect(brokeAfter).toBe(STARTING_BALANCE);
    // Every day of the pattern really was inside window 0, so the break is the
    // window running out and not the pattern outrunning the calendar.
    expect(entitlementWindowFor(state, day)).toBe(0);
  });

  it('is re-armed by any training day', () => {
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    const day = dayAfterGap(DAY_ZERO, GRACE + LIMIT);
    const saved = unwrap(recordTrainingDay(state, day));
    expect(saved.recoveryDaySave?.recoveryDaysSpent).toBe(LIMIT);
    // The very next absence gets the full allowance again, capped by what is
    // left in the bank.
    expect(armedGapDays(saved.state, TODAY_FOR_READS)).toBe(
      Math.min(coveredDaysLeftInWindow(saved.state), LIMIT),
    );
    expect(coverableGapDays(saved.state, TODAY_FOR_READS)).toBe(GRACE + Math.min(coveredDaysLeftInWindow(saved.state), LIMIT));
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
    balanceOnReturn: coveredDaysLeftInWindow(trained.state),
    revealsSeen,
    state: trained.state,
  };
}

const OPENS_EVERY_DAY = (): boolean => true;
const OPENS_ON_RETURN_ONLY = (offset: number): ((o: number) => boolean) => (o) => o === offset;

describe('a long absence', () => {
  const AWAY_DAYS = 7;

  it('cannot be repaired on the day the player comes back, even holding a full bank', () => {
    const state = stateWithRun(50, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    const backOn = addDays(DAY_ZERO, AWAY_DAYS + 1);
    expect(daysMissedBefore(state, backOn)).toBe(AWAY_DAYS);
    expect(AWAY_DAYS).toBeGreaterThan(coverableGapDays(state, TODAY_FOR_READS));
    expect(openDay(state, backOn)).toEqual({
      kind: 'streak-broken',
      brokenRunLength: 50,
      daysMissed: AWAY_DAYS,
      reason: 'absence-longer-than-consecutive-limit',
      coveredDaysAvailable: RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW,
      recoveryDaysCommittedToTheAbsence: RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW,
    });
  });

  it('takes the armed Recovery Days with it — WHERE THIS ONCE ASSERTED THE BANK SURVIVED', () => {
    // REVERSED, NOT DELETED. This test used to be called "leaves the bank
    // untouched rather than quietly draining it" and it is the single clearest
    // statement of the rule that had to go. §5 of `streak.ts` has the argument;
    // §6 has the measurement. Nothing about it is quiet: the debit is reported
    // on `recoveryDaysLostToTheAbsence` and on the break's read model.
    const state = stateWithRun(50, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    const outcome = unwrap(recordTrainingDay(state, addDays(DAY_ZERO, AWAY_DAYS + 1)));
    expect(outcome.recoveryDaysLostToTheAbsence).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    expect(coveredDaysLeftInWindow(outcome.state)).toBe(0);
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

    for (let balance = 0; balance <= RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW; balance += 1) {
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
      playAbsence(i + 1, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW, OPENS_ON_RETURN_ONLY(i + 2)).survived,
    );
    expect(survivalAtFullBank).toEqual(
      Array.from({ length: LONGEST_SWEPT }, (_, i) => i + 1 <= LONGEST_REPAIRABLE_ABSENCE_DAYS),
    );

    // A WEEK AWAY FAILS AT EVERY BALANCE, which is the specific promise
    // `MAX_CONSECUTIVE_USES` carries in its own comment.
    expect(AWAY_DAYS).toBe(7);
    expect(LONGEST_SWEPT).toBeGreaterThan(AWAY_DAYS);
    for (let balance = 0; balance <= RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW; balance += 1) {
      expect(playAbsence(AWAY_DAYS, balance, OPENS_EVERY_DAY).survived).toBe(false);
      expect(playAbsence(AWAY_DAYS, balance, OPENS_ON_RETURN_ONLY(AWAY_DAYS + 1)).survived).toBe(false);
      expect(playAbsence(AWAY_DAYS, balance, OPENS_EVERY_DAY).streakOnReturn).toBe(1);
    }
  });

  it('costs the same whether the player checked in during it or not', () => {
    const walked = playAbsence(
      LONGEST_REPAIRABLE_ABSENCE_DAYS,
      RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW,
      OPENS_EVERY_DAY,
    );
    const returned = playAbsence(
      LONGEST_REPAIRABLE_ABSENCE_DAYS,
      RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW,
      OPENS_ON_RETURN_ONLY(LONGEST_REPAIRABLE_ABSENCE_DAYS + 1),
    );
    expect(walked.survived).toBe(true);
    expect(returned.survived).toBe(true);
    expect(walked.spent).toBe(RECOVERY_ENTITLEMENT.MAX_COVERED_DAYS_PER_ABSENCE);
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
    const affordable = playAbsence(away, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW, OPENS_EVERY_DAY);
    expect(affordable.survived).toBe(true);
    expect(affordable.spent).toBe(RECOVERY_ENTITLEMENT.MAX_COVERED_DAYS_PER_ABSENCE);
  });

  it('does not let a FULL WINDOW repair it either', () => {
    // There is no purchase left to try (GDD §8.3E is not ruled), so the
    // strongest case available is a lifter on a completely untouched
    // entitlement. A week away still ends the run — the promise §4.2 makes and
    // the one money was never allowed to buy out of.
    const state = stateWithRun(50, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    expect(coveredDaysLeftInWindow(state)).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    expect(openDay(state, addDays(DAY_ZERO, AWAY_DAYS + 1)).kind).toBe('streak-broken');
  });
});

// ---------------------------------------------------------------------------
// GDD §4.3 — the first save, taught once
// ---------------------------------------------------------------------------

describe('the first-save moment', () => {
  it('does NOT fire on any miss — only on an absence past the free grace', () => {
    let state: StreakState = stateWithRun(9, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
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
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
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
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    const day = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    for (let i = 0; i < 5; i += 1) {
      const opening = openDay(state, day);
      if (opening.kind !== 'gap-covered-by-recovery-days') throw new Error('expected a save');
      expect(opening.isFirstRecoveryDaySave).toBe(true);
    }
    expect(state.hasBankedFirstRecoveryDaySave).toBe(false);
  });

  it('is not burned by a break that could never have been saved', () => {
    // NOTHING IS HAND-BUILT AFTER THE FIRST STATE, and that is the change the
    // entitlement forced. This used to refill the bank between the break and
    // the later save by writing a balance onto the state; under a window there
    // is no balance to write, and refilling by hand would be asserting against
    // a state no calendar produces. So the refill is the real one: the lifter
    // trains through to the end of their first window and the save lands in the
    // second.
    const broke = stateWithRun(9, DAY_ZERO, 0);
    const brokeOn = dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP);
    const settled = unwrap(settleBrokenStreak(broke, brokeOn));
    // THE PROPERTY UNDER TEST: a break nothing could have held is not the
    // teaching moment, so it must not consume it.
    expect(settled.state.hasBankedFirstRecoveryDaySave).toBe(false);

    // Rebuild from the day of the break to the last day of window 0. The first
    // of those sessions closes a doomed absence and takes what the window has,
    // which is nothing — so no save is banked anywhere in here either.
    const lastDayOfWindowZero = addDays(DAY_ZERO, RECOVERY_ENTITLEMENT.WINDOW_DAYS - 1);
    const restarted = trainConsecutively(
      settled.state,
      brokeOn,
      daysBetween(brokeOn, lastDayOfWindowZero) + 1,
    );
    expect(restarted.lastTrainedDay).toBe(lastDayOfWindowZero);
    expect(restarted.hasBankedFirstRecoveryDaySave).toBe(false);
    expect(coveredDaysLeftInWindow(restarted)).toBe(0);

    // The next window refills on the calendar, so the first chargeable absence
    // that resolves inside it is covered — and it is still the FIRST save.
    const backOn = dayAfterGap(lastDayOfWindowZero, SHORTEST_PAID_GAP);
    expect(entitlementWindowFor(restarted, backOn)).toBe(1);
    const opening = openDay(restarted, backOn);
    if (opening.kind !== 'gap-covered-by-recovery-days') throw new Error('expected a save');
    expect(opening.isFirstRecoveryDaySave).toBe(true);
  });

  it('fires exactly once across a long simulated history', () => {
    let state: StreakState = holding(freshState(), withCoveredDays(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW));
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
    let state: StreakState = holding(freshState(), withCoveredDays(0));
    const paidOn: number[] = [];
    for (let i = 0; i < 120; i += 1) {
      const outcome = unwrap(recordTrainingDay(state, addDays(DAY_ZERO, i)));
      if (outcome.milestonesReached.length > 0) paidOn.push(outcome.streakAfter);
      state = outcome.state;
    }
    expect(paidOn).toEqual([...STREAK_MILESTONE_DAYS]);
    // MARKED, NOT PAID. Three milestones went by and nothing was credited.
    expect(coveredDaysLeftInWindow(state)).toBeLessThanOrEqual(
      RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW,
    );
  });

  it('marks each milestone once in a lifetime, so breaking and rebuilding cannot farm them', () => {
    // THE FARMING GUARD, AND WHAT IT IS A GUARD ON NOW. Under the Recovery Day
    // stock a milestone paid a token, so this test read the balance: reach
    // seven, break, reach seven again, and the balance must not have gone up
    // twice. GDD §4.2's Option 1 ruling pays nothing for a milestone at all
    // (`STREAK_MILESTONE_DAYS` carries the measurement that forbids it), so a
    // balance assertion cannot tell a once-per-lifetime ledger from a ledger
    // that is not there.
    //
    // WHAT IS STILL REAL, AND IS WHAT THIS CHECKS: the milestone EVENT is once
    // per lifetime, read off `longestStreak`. It is what a UI marks and what
    // any future reward would be hung on, so the ledger has to be right whether
    // or not anything currently hangs on it.
    const milestone = STREAK_MILESTONE_DAYS[0] as number;
    let state: StreakState = freshState();

    const firstRun: number[][] = [];
    for (let i = 0; i < milestone; i += 1) {
      const outcome = unwrap(recordTrainingDay(state, addDays(DAY_ZERO, i)));
      firstRun.push([...outcome.milestonesReached]);
      state = outcome.state;
    }
    // Reached exactly once, on the day it was reached.
    expect(firstRun.flat()).toEqual([milestone]);
    expect(firstRun[milestone - 1]).toEqual([milestone]);

    // A fourteen-day absence ends the run AND takes everything the window has,
    // because it was armed against that absence (§5 of `streak.ts`). Under the
    // stock that confiscated the milestone's payout; under the entitlement it
    // confiscates the window, which the next one restores.
    const back = unwrap(recordTrainingDay(state, addDays(DAY_ZERO, 20)));
    expect(back.previousRunEnded).toBe(true);
    expect(back.recoveryDaysLostToTheAbsence).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    expect(back.milestonesReached).toEqual([]);
    state = back.state;

    const secondRun: number[][] = [];
    for (let i = 0; i < milestone - 1; i += 1) {
      const outcome = unwrap(recordTrainingDay(state, addDays(DAY_ZERO, 21 + i)));
      secondRun.push([...outcome.milestonesReached]);
      state = outcome.state;
    }
    expect(state.currentStreak).toBe(milestone);
    // NOTHING THE SECOND TIME. Reaching seven again is not a milestone, and it
    // is not one whether or not a milestone pays anything.
    expect(secondRun.flat()).toEqual([]);
  });

  it('still marks a milestone the first time a rebuilt run passes the previous best', () => {
    const first = STREAK_MILESTONE_DAYS[0] as number;
    const second = STREAK_MILESTONE_DAYS[1] as number;
    let state: StreakState = freshState();
    state = trainConsecutively(state, DAY_ZERO, first);
    state = unwrap(recordTrainingDay(state, addDays(DAY_ZERO, 20))).state;

    const reached: number[][] = [];
    let credited = 0;
    for (let i = 0; i < second - 1; i += 1) {
      const outcome = unwrap(recordTrainingDay(state, addDays(DAY_ZERO, 21 + i)));
      reached.push([...outcome.milestonesReached]);
      credited += outcome.recoveryDaysGranted;
      state = outcome.state;
    }
    expect(state.currentStreak).toBe(second);
    expect(state.longestStreak).toBe(second);
    // The thirty-day milestone is marked once, on the day the rebuilt run
    // passes the previous best — and the seven-day one is NOT marked again.
    expect(reached.flat()).toEqual([second]);
    // AND NOTHING WAS PAID FOR EITHER OF THEM, across the whole rebuild.
    expect(credited).toBe(0);
  });

  it('cannot be reached faster by spending Recovery Days', () => {
    // A Recovery Day keeps the run alive but is not a training day, so the
    // seventh milestone still costs seven sessions. This is what stops bought
    // Recovery Days from earning more Recovery Days.
    let state: StreakState = holding(freshState(), withCoveredDays(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW));
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
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
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
      stateWithRun(9, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW),
      trainConsecutively(freshState(), DAY_ZERO, 8),
      unwrap(recordTrainingDay(stateWithRun(9, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW), dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP))).state,
      migrateFromRecoveryDayBalance(LEGACY_WITH_BALANCE, DAY_ZERO).state,
      setRecoveryDayProtection(stateWithRun(9, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW), false).state,
    ];
    for (const state of states) {
      expect(Object.keys(state).sort()).toEqual([...STREAK_FACT_KEYS].sort());
    }
  });

  it('reports nothing outside the declared spend allowlist', () => {
    const outcome = unwrap(
      recordTrainingDay(stateWithRun(9, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW), dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP)),
    );
    expect(outcome.recoveryDaySave).not.toBeNull();
    expect(Object.keys(outcome.recoveryDaySave as object).sort()).toEqual(
      [...RECOVERY_DAY_OUTCOME_KEYS].sort(),
    );
  });

  it('has no field anywhere whose name suggests it touches Total, e1RM or pace', () => {
    const forbidden = /total|e1rm|1rm|weight|load|pace|multiplier|bonus|boost|iq|fatigue|readiness|attempt/i;
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
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

  it('HAS a source, and a bought covered day still does exactly what a free one does', () => {
    // WHAT THIS TEST USED TO BE, TWICE OVER. First a sweep over every
    // `RecoveryDaySource` asserting a bought Recovery Day and an earned one
    // produced identical states; then, after GDD §4.2's Option 1 ruling deleted
    // the grant path, the assertion that there was no source at all.
    //
    // GDD §8.3E IS RULED IN AND THERE IS A SOURCE AGAIN, so the second version
    // is retired rather than quietly loosened. What replaces it is the FIRST
    // version's claim, restated for the mechanic that exists now and checked
    // through the shipped engine rather than through a table of sources: a
    // covered day bought with money and a covered day the window handed over
    // for free protect exactly the same absences.
    //
    // The provenance lives on the credit and not on the spend
    // (`streakEntitlement.ts` §3b), and `streakEntitlement.test.ts` proves the
    // split is invisible to every decision at every split of every sum. This is
    // the end-to-end version of that, at the one place a player would feel it.
    // THE PURCHASE IS ARMED BY A SESSION BEFORE THE COMPARISON, and that step
    // is not incidental. Only a session arms (GDD §4.2), so a state that has
    // bought two covered days and not trained since is armed with what it held
    // BEFORE the purchase — comparing that against a free state holding the
    // same total would be comparing two different armed counts and calling the
    // difference a provenance effect. Train once, then compare.
    const justBought = unwrap(
      applySettledCoveredDayPurchase(freshState(), DAY_ZERO, {
        orderId: 'order-1',
        coveredDays: 2,
        tender: 'chalk-purchased',
        renderedOffer: offerAsRenderedOn(freshState(), DAY_ZERO),
      }),
    ).state;
    expect(justBought.entitlement.purchasedDaysLeft, 'the order landed').toBe(2);
    expect(coveredDaysArmed(justBought, DAY_ZERO), 'and it is held, not armed').toBe(
      RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW,
    );
    const boughtState = unwrap(recordTrainingDay(justBought, DAY_ZERO)).state;
    // The comparator: a lifter with the same TOTAL coverage, all of it free —
    // held AND armed, so the only difference between the two states is which
    // counter the covered days sit in.
    const freeState: StreakState = holding(boughtState, {
      windowIndex: boughtState.entitlement.windowIndex,
      coveredDaysLeft:
        boughtState.entitlement.coveredDaysLeft + boughtState.entitlement.purchasedDaysLeft,
      purchasedDaysLeft: 0,
    });
    expect(boughtState.entitlement.purchasedDaysLeft).toBe(2);
    expect(coveredDaysLeftInWindow(boughtState)).toBe(coveredDaysLeftInWindow(freeState));
    expect(coveredDaysArmed(boughtState, DAY_ZERO)).toBe(coveredDaysArmed(freeState, DAY_ZERO));

    for (let gap = 0; gap <= 8; gap += 1) {
      const day = dayAfterGap(DAY_ZERO, gap);
      expect(absenceOutcome(boughtState, day), `gap ${gap}`).toEqual(absenceOutcome(freeState, day));
      expect(openDay(boughtState, day), `gap ${gap}`).toEqual(openDay(freeState, day));
      expect(coveredDaysArmed(boughtState, day), `gap ${gap}`).toBe(coveredDaysArmed(freeState, day));
      const fromBought = recordTrainingDay(boughtState, day);
      const fromFree = recordTrainingDay(freeState, day);
      expect(fromBought.ok).toBe(fromFree.ok);
      if (fromBought.ok && fromFree.ok) {
        // Everything except the entitlement's internal split is identical, and
        // the split itself sums to the same number.
        expect({ ...fromBought.value, state: null }, `gap ${gap}`).toEqual({
          ...fromFree.value,
          state: null,
        });
        expect(coveredDaysLeftInWindow(fromBought.value.state), `gap ${gap}`).toBe(
          coveredDaysLeftInWindow(fromFree.value.state),
        );
      }
    }

    // The deleted names stay deleted.
    const exported = Object.keys(streakModule);
    expect(exported).not.toContain('grantRecoveryDays');
    expect(exported).not.toContain('recoveryDayCapacity');
    // And the CALLABLE surface's only concession to money is the one entry
    // point. Restricted to functions on purpose: the allowlist constants that
    // fence that entry point in are named for it and would otherwise read as
    // four more ways to buy something.
    const callable = exported.filter(
      (name) => typeof (streakModule as Record<string, unknown>)[name] === 'function',
    );
    expect(callable.filter((name) => /grant|credit|buy|purchase|award|earn/i.test(name))).toEqual([
      'applySettledCoveredDayPurchase',
    ]);
  });

  it('has no spend entry point that could take a provenance', () => {
    // THE PROPERTY THAT SURVIVED THE REWORK AND GOT STRONGER. It used to be
    // "a bought Recovery Day spends identically to an earned one", swept over
    // every source. There is no source now: `recordTrainingDay(state, day)` is
    // still the only function that can draw on coverage, and coverage itself is
    // a window every account has on the same terms.
    const run = stateWithRun(9, DAY_ZERO, 0);
    expect(streakModule.recordTrainingDay).toHaveLength(2);
    expect(JSON.stringify(run)).not.toContain('source');
    expect(JSON.stringify(run)).not.toContain('chalk');
    expect(JSON.stringify(run)).not.toContain('gymBucks');

    // ONE HONEST EXCEPTION, NAMED RATHER THAN SCANNED AROUND. The state does
    // carry `purchasedDaysLeft`, and a blanket ban on the string "purchase"
    // would fail on it. It is not a provenance in the sense this test is about
    // — nothing branches on where a covered day came from in `streak.ts` — but
    // it is not nothing either: `streakEntitlement.afterSession` spends the
    // granted entitlement BEFORE the purchased one, so the two are told apart
    // by one line in the sibling module.
    //
    // WHAT MAKES THAT SAFE HERE, and this paragraph used to say something that
    // stopped being true: it said "GDD §8.3E is PROPOSED AND NOT RULED, nothing
    // exported can credit one". §8.3E is RULED IN and
    // `applySettledCoveredDayPurchase` credits one. What is still true — and is
    // the property this test is actually about — is that nothing on the SPEND
    // side can see where a covered day came from. `recordTrainingDay(state,
    // day)` takes two arguments, `coveredDaysAvailable` sums the two counters,
    // and no branch anywhere in `streak.ts` asks which counter paid.
    //
    // TWICE, NOT ONCE, and the second one is the fix for the app-opening defect
    // rather than a duplicate: the state carries a LIVE entitlement and the
    // ARMED SNAPSHOT an absence resolves against, and each has a purchased
    // half. A state serialising only one of them would be a state that had lost
    // either the balance the player was shown or the number their run depends
    // on.
    const purchaseMentions = [...JSON.stringify(run).matchAll(/"(\w*[Pp]urchas\w*)"/g)].map(
      (match) => match[1],
    );
    expect(purchaseMentions).toEqual(['purchasedDaysLeft', 'purchasedDaysLeft']);
    expect(run.entitlement.purchasedDaysLeft).toBe(0);
    expect(run.armedEntitlement.purchasedDaysLeft).toBe(0);
    // Two lifters in the same window, one who has trained far more than the
    // other, draw on exactly the same coverage.
    const busy = trainConsecutively(freshState(), DAY_ZERO, 20);
    const idle = freshState();
    expect(coveredDaysArmed(busy, addDays(DAY_ZERO, 21))).toBe(
      coveredDaysArmed(idle, addDays(DAY_ZERO, 21)),
    );
  });

  it('[coverage-protects-never-adds] cannot draw a longer streak out of coverage, only a surviving one', () => {
    // Under the stock this bought 99 Recovery Days first. There is nothing to
    // buy now, so the strongest case is a lifter whose window is always full —
    // which the loop below re-establishes every window anyway.
    let state: StreakState = freshState();
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
  /**
   * Covered-day orders the store refused because the absence was already doomed.
   *
   * REPORTED SO A SWEEP CAN PROVE ITS BUYING CALENDAR REACHED THE REFUSAL, and
   * so the training-keyed-arrival hazard the refusal introduces is visible in
   * the harness rather than only in `streak.ts`.
   */
  readonly refusedPurchases: number;
  /**
   * Of those, the ones where this client's OWN SCREEN had shown the offer —
   * `ABSENCE_ENDED_BEFORE_OFFER`, completion re-validation refusing an order the
   * client had legitimately drawn a button for.
   *
   * IT USED TO BE NAMED FOR STALENESS, and the rename is the point. The code it
   * counts used to be `ABSENCE_SETTLED_WHILE_AWAY`, which asserted that
   * something had been settled elsewhere. Nothing here settles elsewhere: this
   * harness is one client with one state, and it still reaches the branch,
   * because a window boundary refills the armed snapshot and revives an absence
   * with nobody's help.
   *
   * CARRIED SEPARATELY SO THE SWEEP CAN SEE THE PATH FIRE. `refusedPurchases`
   * going up is not evidence re-validation ran; this is. A client that opens
   * daily settles as it goes and can never draw this code, so a sweep in which
   * it is zero everywhere is a sweep that never reached the case.
   */
  readonly refusedAfterOfferingIt: number;
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
 *
 * `grantSize` is how many Recovery Days a grant day drops. One by default. It
 * is a parameter only because the residue counterfactuals need a drop large
 * enough to keep the balance pinned at the hold cap every day, which is how
 * "the stock never runs out" is expressed without editing `streak.ts`.
 */
function simulate(
  attend: readonly boolean[],
  grantOn: readonly boolean[],
  initial: StreakState,
  opens: OpeningSchedule = 'daily',
  settleAtEnd = false,
  grantSize = 1,
): SimResult {
  let state = initial;
  let spent = 0;
  let revealsSeen = 0;
  let refusedPurchases = 0;
  let refusedAfterOfferingIt = 0;

  const open = (from: StreakState, day: StreakDay, count: boolean): StreakState => {
    const opening = openDay(from, day);
    if (count && opening.kind === 'gap-covered-by-recovery-days') revealsSeen += 1;
    if (opening.kind === 'streak-broken') return unwrap(settleBrokenStreak(from, day)).state;
    return from;
  };

  for (let i = 0; i < attend.length; i += 1) {
    const day = addDays(DAY_ZERO, i);
    // THE GRANT HOOK IS BACK, AS A PURCHASE (GDD §8.3E, ruled in). It was a
    // documented no-op for the whole of the Option 1 rework, because nothing
    // could add coverage to a state; `applySettledCoveredDayPurchase` can, so
    // every simulation in this file that passes a `grantOn` now drives real
    // purchased days through the field rather than through a `void`.
    //
    // THAT IS THE POINT OF RE-WIRING IT rather than leaving the sweeps on zero:
    // every invariant below — the app-opening purity, the reported-consumption
    // sweeps, the monotonicity properties — was proved against a
    // `purchasedDaysLeft` that could not be anything but zero.
    //
    // THE BUY DAYS COME FROM THE CALLER'S ARRAY AND NOT FROM THE RUN, which is
    // the safe keying: `grantOn` is a fixed calendar, so both members of any
    // monotonicity pair buy on the same days and training cannot move the
    // arrival. `streakEntitlement.test.ts` measures what happens when it can.
    //
    // A SIMULATED PURCHASE MAY NOW BE REFUSED, and the harness records it rather
    // than throwing. Since the doomed-sale ruling the store will not sell into
    // an absence that has already ended the run, so a fixed buying calendar no
    // longer implies a fixed set of covered days that ARRIVE — the lifter's own
    // training decides which of their buy days the store is open on.
    //
    // THAT IS A TRAINING-KEYED ARRIVAL AND IT IS THE HAZARD GDD §4.4 TRACES, so
    // it is measured rather than reasoned about: `refusedPurchases` is carried
    // out on the result, and the monotonicity sweeps below re-derive their pinned
    // zeros with this live.
    //
    // TWO REFUSALS ARE WELL-FORMED FOR THIS HARNESS, not one and not three.
    // `ABSENCE_ALREADY_DOOMED` is this client's own screen saying the run is
    // over; `ABSENCE_ENDED_BEFORE_OFFER` is completion re-validation refusing an
    // order this client's screen had offered. Both count as refusals; the second
    // is counted again on its own, because it is the only direct evidence a
    // sweep has that re-validation ran at all.
    //
    // `ABSENCE_ENDED_AFTER_OFFER` IS UNREACHABLE FROM HERE, and that is a fact
    // about this harness rather than about the module: it renders and completes
    // on the same day, and the walk can only ever record a break on a day at or
    // before the one it is asked about. The doomed-sale sweep varies the render
    // day and is where that third code lives. Anything else is a harness bug and
    // still throws.
    if (grantOn[i] === true) {
      const bought = applySettledCoveredDayPurchase(state, day, {
        orderId: `sim-${i}`,
        coveredDays: grantSize,
        tender: 'chalk-purchased',
        renderedOffer: offerAsRenderedOn(state, day),
      });
      if (bought.ok) {
        state = bought.value.state;
      } else if (bought.error.code === 'ABSENCE_ALREADY_DOOMED') {
        refusedPurchases += 1;
      } else if (bought.error.code === 'ABSENCE_ENDED_BEFORE_OFFER') {
        refusedPurchases += 1;
        refusedAfterOfferingIt += 1;
      } else {
        throw new Error(`day ${i}: the simulated purchase was refused (${bought.error.code})`);
      }
    }
    if (opensOn(opens, i, attend[i] === true)) state = open(state, day, true);
    if (attend[i] === true) {
      // WHAT THE DAY HAS AVAILABLE — see `coverageAvailableOn` for why it is
      // neither the snapshot nor the armed count. The entitlement refreshes at
      // a window boundary, so a session on the first day of a new window
      // legitimately starts from a full window and an invariant written against
      // the snapshot would call that a silent credit; and a lifter who has
      // declined protection still HAS their window, they simply cannot draw on
      // it, so an invariant written against the armed count would call their
      // every session a silent credit of the whole thing.
      const before = coverageAvailableOn(state, day);
      const outcome = unwrap(recordTrainingDay(state, day));
      // Local invariants, checked on every recorded session in every simulation
      // in this file. A bare throw rather than `expect`: the exhaustive sweeps
      // run this a few million times and `expect` is expensive enough to turn a
      // half-second test into a half-minute one.
      const saved = outcome.recoveryDaySave?.recoveryDaysSpent ?? 0;
      const lost = outcome.recoveryDaysLostToTheAbsence;
      const debited = saved + lost;
      // REPORTED, NEVER SILENT, restated for the entitlement: what this session
      // leaves in its own window is exactly what the day had available minus
      // what the outcome says it took. Nothing else may move it, and nothing
      // may credit it — `recoveryDaysGranted` is pinned at 0 because GDD §4.2's
      // Option 1 ruling removed every earning path.
      if (outcome.recoveryDaysGranted !== 0) {
        throw new Error(`day ${i}: something credited coverage, and nothing may`);
      }
      if (coveredDaysLeftInWindow(outcome.state) !== before - debited) {
        throw new Error(
          `day ${i}: coverage moved by ${before - coveredDaysLeftInWindow(outcome.state)}, reported ${debited}`,
        );
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
      // WHAT IS ARMED IS NEVER MORE THAN WHAT EXISTS, read on the day of the
      // session rather than at a fixed day: a state whose window has turned
      // over reads a full window on its own day and a stale snapshot on
      // DAY_ZERO, so the fixed-day version of this check compared two different
      // windows and could not fail.
      if (coveredDaysArmed(outcome.state, day) > coverageAvailableOn(outcome.state, day)) {
        throw new Error(
          `day ${i}: armed ${coveredDaysArmed(outcome.state, day)} exceeds the ${coverageAvailableOn(outcome.state, day)} the window has`,
        );
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
  return { state, recoveryDaysSpent: spent, revealsSeen, refusedPurchases, refusedAfterOfferingIt };
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

    for (let balance = 0; balance <= RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW; balance += 1) {
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

    // ANTI-VACUITY, DERIVED FROM THE LOOPS RATHER THAN READ OFF A RUN. The
    // sweep must have reached both sides of the ceiling, or "identical" would
    // be a statement about absences nothing ever happened in.
    //
    // THIS NUMBER USED TO BE A BOUND — `> 200` under the Recovery Day stock,
    // then `> 150` when the balance dimension shrank from 0..5 to 0..2 and the
    // actual count fell below 200. Both were read off what the sweep happened
    // to produce, and a threshold read off a run is a threshold that passes
    // anything: at `> 150` this sweep could lose a whole balance (60 cases) and
    // still be green. It is an EQUALITY now, composed from the three loop
    // bounds directly above, so removing any dimension fails here rather than
    // sliding under a bound.
    //
    //   balances  = COVERED_DAYS_PER_WINDOW + 1     (0 .. full window)   = 3
    //   lengths   = LONGEST_REPAIRABLE_ABSENCE_DAYS + 6                  = 10
    //   schedules = every schedule but the baseline                      = 6
    //                                                                    ---
    //                                                       3 x 10 x 6 =  180
    const BALANCES_SWEPT = RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW + 1;
    const ABSENCE_LENGTHS_SWEPT = LONGEST_REPAIRABLE_ABSENCE_DAYS + 6;
    const SCHEDULES_COMPARED = 6;
    expect(casesChecked).toBe(BALANCES_SWEPT * ABSENCE_LENGTHS_SWEPT * SCHEDULES_COMPARED);
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

  it('OPEN-DAY SCHEDULE, WITH PURCHASES AND LONG RANDOM CALENDARS', () => {
    // Coverage landing mid-history is the case the armed snapshot exists for: a
    // covered day that arrives during an absence must not rescue it, or the
    // purchase would make an absence's fate depend on the moment somebody
    // opened a store.
    //
    // THESE ARE REAL PURCHASES NOW (GDD §8.3E). The hook was a documented no-op
    // for the whole of the Option 1 rework, so this test — the app-opening
    // purity invariant, in full JSON-state equality — was passing over a
    // `purchasedDaysLeft` that could not be anything but zero. It is re-run here
    // with the field populated, which is what makes the equality mean
    // something: the states compared now DIFFER from the empty case, and still
    // agree with each other across four opening schedules.
    const rng = mulberry32(0x09e2_31f5);
    const initial = freshState();
    let trials = 0;
    let purchasesLanded = 0;
    let purchasedDaysSeen = 0;
    let differedFromNoPurchase = 0;
    let storeVerdictDivergedInPairs = 0;
    let offerRefusalsUnderNever = 0;
    let offerRefusalsUnderDaily = 0;

    for (let trial = 0; trial < 300; trial += 1) {
      const length = 20 + Math.floor(rng() * 40);
      const attendance = 0.2 + rng() * 0.7;
      const attend = Array.from({ length }, () => rng() < attendance);
      const buyOn = Array.from({ length }, () => rng() < 0.15);
      const never = Array.from({ length }, () => false);
      purchasesLanded += buyOn.filter(Boolean).length;
      const baseline = simulate(attend, buyOn, initial, 'never', true);
      purchasedDaysSeen += baseline.state.entitlement.purchasedDaysLeft;
      offerRefusalsUnderNever += baseline.refusedAfterOfferingIt;
      for (const schedule of ['daily', 'on-training-days', 'every-third-day'] as const) {
        const other = simulate(attend, buyOn, initial, schedule, true);
        if (schedule === 'daily') offerRefusalsUnderDaily += other.refusedAfterOfferingIt;
        // FULL JSON-STATE EQUALITY across opening schedules, purchases included.
        expect(JSON.stringify(other.state)).toBe(JSON.stringify(baseline.state));
        expect(other.state).toEqual(baseline.state);
        // THE SPEND EQUALITY IS UNCONDITIONAL AGAIN.
        //
        // It was weakened for one round to "wherever the store made the same
        // decision", with the exceptions counted into
        // `storeVerdictDivergedInPairs` and pinned at 1. That condition is gone:
        // completion re-validates against settled state, so the store takes the
        // same orders from a client that never opens the app as from one that
        // settles every night, and the spend that follows is the same number.
        //
        // THE COUNTER IS KEPT AND PINNED AT ZERO rather than deleted with the
        // condition. A count that must be zero fails loudly and names the pair; a
        // deleted count cannot come back to tell anybody the gap reopened.
        expect(other.recoveryDaysSpent).toBe(baseline.recoveryDaysSpent);
        if (other.refusedPurchases !== baseline.refusedPurchases) {
          storeVerdictDivergedInPairs += 1;
        }
      }
      // NOT VACUOUS: buying really did change the outcome somewhere, so the
      // equality above is over histories the purchase actually reached.
      const withoutBuying = simulate(attend, never, initial, 'never', true);
      if (JSON.stringify(withoutBuying.state) !== JSON.stringify(baseline.state)) {
        differedFromNoPurchase += 1;
      }
      trials += 1;
    }
    expect(trials).toBe(300);
    expect(purchasesLanded).toBeGreaterThan(100);
    expect(purchasedDaysSeen, 'no run ever ended holding a purchased day').toBeGreaterThan(0);
    expect(
      differedFromNoPurchase,
      'buying changed nothing anywhere, so this sweep is the zero-purchase sweep again',
    ).toBeGreaterThan(0);
    // PINNED EXACTLY, NOT BOUNDED. `toBe`, so the number moves the day the
    // mechanism does and somebody has to read it.
    expect(storeVerdictDivergedInPairs, 'store-verdict divergences').toBe(
      STORE_VERDICT_DIVERGENCE.PAIRS_IN_THIS_SWEEP,
    );
    expect(STORE_VERDICT_DIVERGENCE.PAIRS_IN_THIS_SWEEP, 'the exception count is zero').toBe(0);

    // AND THE ZERO IS NOT A ZERO BECAUSE NOTHING HAPPENED. Re-validation fired in
    // this sweep, on the client that never opens the app and therefore holds the
    // stale state — and it fired on NO other, because a client that settles every
    // night has nothing left for re-validation to find. Both halves are needed:
    // the first says the path is reachable, the second says the fix landed on the
    // stale client rather than on everyone.
    expect(
      offerRefusalsUnderNever,
      'completion re-validation never fired, so the zero above is vacuous',
    ).toBeGreaterThan(0);
    expect(
      offerRefusalsUnderDaily,
      'a nightly-settling client should have nothing left to re-validate',
    ).toBe(0);
  });

  it('[settling-is-terminal][a-sale-never-follows-a-settle][the-decision-ignores-the-rendered-offer][every-refusal-sentence-is-true-of-its-screen] THE DOOMED-SALE DOOR, SWEPT IN BOTH DIRECTIONS over every calendar of 10 days, at six placements against the window boundary and three render-day lags', () => {
    // THE HUMAN'S RULING, MEASURED. Two halves, and the second is the one that
    // hides a bug: the store must refuse an already-doomed absence, AND it must
    // not refuse any absence that is still salvageable. A store that answers
    // "no" to everything passes the first half perfectly.
    //
    // SO THE ASSERTION IS AN EQUIVALENCE, NOT AN IMPLICATION. For every state
    // the engine can produce and every day it can be asked about, the store sells
    // exactly when the absence holds. Make the refusal one day too eager and the
    // salvageable side goes red; drop it and the doomed side does.
    //
    // THE ORACLE IS THE ABSENCE'S OWN ARITHMETIC — `absenceOutcome(state, day)
    // .protectionHolds`, the same call `recordTrainingDay` branches on. See
    // `DOOMED_SALE_SWEEP` for why it is that and not a re-derivation, and for why
    // asking the same function is not circular.
    //
    // AND IT IS ASKED OF THE STATE A NIGHTLY SETTLE JOB WOULD HAVE LEFT, which is
    // the human's ruling on `STORE_VERDICT_DIVERGENCE` carried onto this domain
    // rather than into a test of its own. `nightly` below is built by offering
    // EVERY day the account has existed to `settleBrokenStreak` — the real
    // function, driven the way a server job drives it. It is deliberately NOT
    // `settledStateAsOf`: the subject calls that helper, so an oracle that called
    // it too would agree with the subject by construction.
    //
    // THREE STATE SHAPES, because the refusal reads two fields and one of them is
    // the protection toggle: protection on, protection declined, and a state
    // carrying a covered day bought legally while the absence was still
    // salvageable — which is the only way `purchasedDaysLeft` can be non-zero
    // inside a doomed absence now.
    //
    // AND SIX CALENDAR PLACEMENTS, because with only the signup-anchored one the
    // whole domain could not express a run that ends and comes back — see
    // `DOOMED_SALE_SWEEP.CALENDAR_START_OFFSETS`. That is the honest reading of
    // the old 98,304-decision green: the store was checked exhaustively over
    // states in which the question this test now asks had exactly one answer.
    const order = {
      coveredDays: DOOMED_SALE_SWEEP.COVERED_DAYS_PER_ORDER,
      tender: 'chalk-purchased',
    } as const;
    const length = DOOMED_SALE_SWEEP.EXHAUSTIVE_LENGTH;

    // THE BAND IS RE-DERIVED FROM THE TUNING CONSTANTS rather than trusted. An
    // offset puts the calendar's last day at `WINDOW_DAYS - 1 - k`; the placements
    // that matter are `k` from 0 to `LONGEST_REPAIRABLE_ABSENCE_DAYS`, which is
    // exactly the range over which an absence can still be covered when it
    // reaches the boundary. Retune the window and this fails rather than quietly
    // sweeping the wrong six days.
    const straddleBand = Array.from(
      { length: LONGEST_REPAIRABLE_ABSENCE_DAYS + 1 },
      (_, k) => RECOVERY_ENTITLEMENT.WINDOW_DAYS - length - k,
    );
    expect([...DOOMED_SALE_SWEEP.CALENDAR_START_OFFSETS].sort((a, b) => a - b)).toEqual(
      [0, ...straddleBand].sort((a, b) => a - b),
    );

    let sellable = 0;
    let refused = 0;
    let probes = 0;
    let statesWithAPurchasedDay = 0;
    let refusalsInsideARefilledWindow = 0;
    let staleVerdicts = 0;
    let completionDivergences = 0;
    let secondSettles = 0;
    // ---- the render-day axis's own counters ---------------------------------
    /** Probes drawn at each render-day lag, so the rotation is not a claim. */
    const lagsDrawn: Record<number, number> = {};
    /** Refusals by code. Every one of the three must be reached. */
    const refusalsByCode: Record<string, number> = {};
    /** Refusals where inverting the client's claim changed the SENTENCE. */
    let sentencesThatMovedWithTheScreen = 0;
    /**
     * Refusals where the walk to the completion day recorded no break at all.
     *
     * These are states with no run to record — a lifter who never trained, or
     * one already settled — so there is no day to compare a render day against.
     * Counted because the routing treats them as "not alive when drawn", and a
     * count of zero would mean that branch is untested rather than safe.
     */
    let refusalsWithNoRecordedEnd = 0;

    for (const startOffset of DOOMED_SALE_SWEEP.CALENDAR_START_OFFSETS) {
    for (let mask = 0; mask < exhaustiveCalendarCount(length); mask += 1) {
      const schedule = exhaustiveCalendar(mask, length);
      let trained: StreakState = freshState();
      let lastTrainedIndex = -1;
      for (let i = 0; i < length; i += 1) {
        if (schedule[i] !== true) continue;
        trained = unwrap(recordTrainingDay(trained, addDays(DAY_ZERO, startOffset + i))).state;
        lastTrainedIndex = i;
      }

      const declined = setRecoveryDayProtection(trained, false).state;
      // A LEGAL PURCHASE, ON THE LAST SESSION'S OWN DAY — nothing missed, so the
      // absence holds and the store sells. Skipped for a lifter who never
      // trained, who has no such day.
      //
      // ON THE SESSION'S DAY AND NOT THE DAY AFTER, which it used to be. With the
      // calendar anchored at signup those two were interchangeable; with the
      // straddle offsets they are not, because the day after the last session can
      // fall in the NEXT entitlement window while the first probe day is still in
      // this one. The store refuses to sell into a window that has already passed
      // — a separate, deliberate refusal with its own test — and this shape was
      // handing it that case and reading the result as a doomed-sale verdict.
      // Buying on the session day keeps the shape's entitlement window at or
      // before every day it is probed on.
      let carrying = trained;
      if (lastTrainedIndex >= 0) {
        const buyDay = addDays(DAY_ZERO, startOffset + lastTrainedIndex);
        const bought = applySettledCoveredDayPurchase(trained, buyDay, {
          ...order,
          renderedOffer: offerAsRenderedOn(trained, buyDay),
          orderId: `carry-${mask}`,
        });
        if (bought.ok) {
          carrying = bought.value.state;
          statesWithAPurchasedDay += 1;
        }
      }

      for (const [shape, state] of [
        ['armed', trained],
        ['declined', declined],
        ['carrying', carrying],
      ] as const) {
        // THE NIGHTLY-SETTLED TWIN. Carried across the probe loop and advanced one
        // day at a time from the day after signup, so by the time the loop reaches
        // a probe day it holds exactly what a client that opened and settled every
        // night would hold. Days before the last session cannot settle anything —
        // `settleBrokenStreak` measures from the anchor and finds no missed days —
        // so starting at signup costs a few refusals and assumes nothing about
        // where the breaks are.
        let nightly = state;
        let nightlySettledOn: StreakDay | null = null;
        for (let d = 1; d < startOffset + length; d += 1) {
          const settledEarly = settleBrokenStreak(nightly, addDays(DAY_ZERO, d));
          if (settledEarly.ok) {
            nightly = settledEarly.value.state;
            nightlySettledOn = addDays(DAY_ZERO, d);
          }
        }
        for (let offset = 0; offset <= DOOMED_SALE_SWEEP.PROBE_HORIZON_DAYS; offset += 1) {
          const day = addDays(DAY_ZERO, startOffset + length - 1 + offset);
          const settledToday = settleBrokenStreak(nightly, day);
          if (settledToday.ok) {
            // SETTLING IS TERMINAL: once a break is recorded, no later day may
            // record a second one. Counted rather than assumed, because
            // `settledStateAsOf` returns at the first settle and that shortcut is
            // only sound if this is true.
            if (nightlySettledOn !== null) secondSettles += 1;
            nightly = settledToday.value.state;
            nightlySettledOn = day;
          }

          // THE RENDER DAY, WHICH IS NOT ALWAYS THE COMPLETION DAY. Rotated
          // across the probe grid rather than multiplied into it: every state
          // meets every lag as `offset` walks its horizon, and `mask` shifts the
          // phase so a lag is not pinned to a fixed distance from the calendar.
          // Costs no probes; the count drawn at each lag is pinned below.
          const lags = DOOMED_SALE_SWEEP.RENDER_DAY_LAGS;
          const lag = lags[(offset + mask) % lags.length] as number;
          const renderDay = addDays(day, -lag);
          lagsDrawn[lag] = (lagsDrawn[lag] ?? 0) + 1;

          const holds = absenceOutcome(state, day).protectionHolds;
          // THE AUTHORITATIVE VERDICT: the same call, asked of the settled twin.
          const settledHolds = absenceOutcome(nightly, day).protectionHolds;
          // WHAT THE CLIENT'S SCREEN SHOWED, computed by the TEST off the render
          // day and handed to the subject as an input. The subject does not
          // re-derive it — that re-derivation is the defect this axis exists to
          // catch.
          const renderedOffer = offerAsRenderedOn(state, renderDay);
          const result = applySettledCoveredDayPurchase(state, day, {
            ...order,
            renderedOffer,
            orderId: `probe-${mask}-${shape}-${offset}`,
          });
          const settledResult = applySettledCoveredDayPurchase(nightly, day, {
            ...order,
            renderedOffer: offerAsRenderedOn(nightly, renderDay),
            orderId: `probe-${mask}-${shape}-${offset}`,
          });
          // THE DECISION IGNORES THE CLIENT'S CLAIM — swept, not argued. The
          // same order with the screen's answer inverted must complete or refuse
          // identically; only the SENTENCE may move. This is what keeps a field
          // the client fills in from being a lever on whether money lands.
          const flipped = applySettledCoveredDayPurchase(state, day, {
            ...order,
            renderedOffer: { day: renderDay, offered: !renderedOffer.offered },
            orderId: `probe-${mask}-${shape}-${offset}`,
          });
          if (flipped.ok !== result.ok) {
            throw new Error(
              `offset ${startOffset} ${shape} mask ${mask} day +${offset}: the rendered offer moved the decision`,
            );
          }
          if (!flipped.ok && !result.ok && flipped.error.code !== result.error.code) {
            sentencesThatMovedWithTheScreen += 1;
          }
          // BARE THROWS RATHER THAN `expect` IN THIS LOOP, which is the same
          // call `simulate` makes and for the same reason: half a million probes
          // through `expect` turn a three-second test into a two-minute one. The
          // aggregates below are `expect`s.
          const label = `offset ${startOffset} ${shape} mask ${mask} day +${offset}`;
          const opening = openDay(state, day).kind;

          if (holds !== settledHolds) staleVerdicts += 1;

          // THE EQUIVALENCE, AGAINST SETTLED STATE. This used to compare against
          // `holds` — the raw state's own reading — and that is exactly what the
          // ruling forbids finalising on.
          if (result.ok !== settledHolds) {
            throw new Error(`${label}: store sold=${result.ok}, settled absence holds=${settledHolds}`);
          }
          // AND THE AXIS THE RULING ASKED FOR, STATED DIRECTLY: an unsettled
          // client and a settled one complete identically. Implied by the line
          // above, counted separately anyway, because "the two clients agree" is
          // the sentence a reader needs and an implication is not one.
          if (result.ok !== settledResult.ok) {
            completionDivergences += 1;
          }

          const revalidated = settledStateAsOf(state, day);

          if (result.ok) {
            sellable += 1;
            // AND THE SECOND ORACLE. A day the store sold on may not be a day
            // the read model calls the run broken — that would be the store and
            // the screen disagreeing about the same absence.
            if (opening === 'streak-broken') {
              throw new Error(`${label}: sold on a day the read model calls broken`);
            }
            // A SALE NEVER FOLLOWS A SETTLE, so the credit the sale applies lands
            // on the state re-validation approved and not on a different one.
            if (revalidated.runRecordedAsEndedOn !== null) {
              throw new Error(`${label}: sold on a day whose run had already ended`);
            }
          } else {
            refused += 1;
            const code = errorCodeOf(result);
            // THREE REFUSALS, AND THE ORACLE FOR WHICH ONE IS NOT A COPY OF THE
            // IMPLEMENTATION. This assertion used to read
            //
            //     holds ? 'ABSENCE_SETTLED_WHILE_AWAY' : 'ABSENCE_ALREADY_DOOMED'
            //
            // off the same `absenceOutcome(state, day)` call the subject made,
            // character for character — so it could not disagree with the code
            // it graded, and it graded a routing that was inverted for every
            // client whose order completed a day after its screen was drawn.
            //
            // WHAT IT READS NOW. Two things the subject does not compute this
            // way:
            //
            //   - `renderedOffer.offered`, an INPUT the test built off the
            //     render day. The subject never re-derives it.
            //   - A NIGHTLY-SETTLED TWIN BUILT BY THIS TEST, advanced to the
            //     RENDER day with a hand loop over the real `settleBrokenStreak`
            //     — the same construction the `nightly` twin above uses, and for
            //     the same stated reason: an oracle that called
            //     `settledStateAsOf` would agree with the subject by
            //     construction and measure nothing.
            //
            // AND THE FIRST VERSION OF THIS ORACLE WAS NOT INDEPENDENT ENOUGH,
            // which is worth recording because it was green. It asked whether
            // the walk had RECORDED a break by the render day — the same shape
            // the subject then used — so both shared one blind spot:
            // `settleBrokenStreak` refuses a state with no `lastTrainedDay`, so
            // a lifter who never trained never gets a break recorded, while
            // their signup absence still runs out of coverage on a definite day.
            // Oracle and subject agreed, and both were wrong. Reading the
            // ABSENCE rather than the recording has no such hole.
            const renderAnchor = absenceAnchorDay(state);
            let settledAtRender = state;
            for (let probe = 1; addDays(renderAnchor, probe) <= renderDay; probe += 1) {
              const settledThen = settleBrokenStreak(settledAtRender, addDays(renderAnchor, probe));
              if (settledThen.ok) {
                settledAtRender = settledThen.value.state;
                break;
              }
            }
            const authorisedWhenDrawn = absenceOutcome(settledAtRender, renderDay).protectionHolds;
            if (revalidated.runRecordedAsEndedOn === null) refusalsWithNoRecordedEnd += 1;
            const expectedCode = !renderedOffer.offered
              ? 'ABSENCE_ALREADY_DOOMED'
              : authorisedWhenDrawn
                ? 'ABSENCE_ENDED_AFTER_OFFER'
                : 'ABSENCE_ENDED_BEFORE_OFFER';
            if (code !== expectedCode) {
              throw new Error(`${label}: refused as ${code}, expected ${expectedCode} (lag ${lag})`);
            }
            refusalsByCode[code] = (refusalsByCode[code] ?? 0) + 1;
            // AND THE SENTENCE MATCHES THE CODE, checked against the exported
            // copy rather than against a string in this file — a refusal whose
            // code and sentence disagreed would tell the player one thing and
            // the log another.
            const expectedSentence =
              code === 'ABSENCE_ENDED_BEFORE_OFFER'
                ? DOOMED_SALE_REFUSAL_MESSAGE.endedBeforeOffer
                : code === 'ABSENCE_ENDED_AFTER_OFFER'
                  ? DOOMED_SALE_REFUSAL_MESSAGE.endedAfterOffer
                  : state.entitlementArmed
                    ? DOOMED_SALE_REFUSAL_MESSAGE.armed
                    : DOOMED_SALE_REFUSAL_MESSAGE.protectionDeclined;
            if (errorMessageOf(result) !== expectedSentence) {
              throw new Error(`${label}: refused as ${code} with the wrong sentence`);
            }
            // THERE IS DELIBERATELY NO SECOND "HONESTY" CHECK HERE. Two were
            // written — "never says the offer was good when it was already
            // dead", "never tells a client its own offer should not have been
            // shown" — and both were deleted once it was clear they restate the
            // expectation above and can never fire first. A pile of assertions
            // that cannot fail is the defect this file is full of warnings
            // about, wearing the costume of defence in depth. The oracle IS the
            // honesty check: it is built from the client's reported screen and
            // from a twin this test settles by hand, so agreeing with it is the
            // property, not a proxy for it.
            // A refusal only ever happens where there is no run left to protect —
            // read off the SETTLED state, which is the one the refusal is about.
            const settledOpening = openDay(nightly, day).kind;
            if (settledOpening !== 'streak-broken' && settledOpening !== 'no-active-streak') {
              throw new Error(`${label}: refused while the read model says ${settledOpening}`);
            }
            if (entitlementWindowFor(state, day) > state.armedEntitlement.windowIndex) {
              refusalsInsideARefilledWindow += 1;
            }
          }
          probes += 1;
        }
      }
    }
    }

    // NON-VACUITY, AND IT IS THE GUARD THE FALSE-POSITIVE HALF NEEDS. A domain
    // containing only doomed absences would let a store that always refuses pass
    // the equivalence; a domain containing only live ones would let a store that
    // never refuses pass it. Both sides are counted and both are pinned exactly,
    // so shrinking the domain to one answer is a red test rather than a silence.
    expect(probes, 'store decisions swept').toBe(
      exhaustiveCalendarCount(length) *
        3 *
        (DOOMED_SALE_SWEEP.PROBE_HORIZON_DAYS + 1) *
        DOOMED_SALE_SWEEP.CALENDAR_START_OFFSETS.length,
    );
    expect(sellable + refused).toBe(probes);
    expect(sellable, 'salvageable absences the store sold to').toBe(71_912);
    expect(refused, 'doomed absences the store refused').toBe(517_912);
    // Neither side is a rounding error against the other.
    expect(sellable / probes, 'the sellable side is a real fraction of the domain').toBeGreaterThan(
      0.05,
    );
    // AND THE DOMAIN REACHED THE THINGS IT WAS BUILT TO REACH: states actually
    // carrying a bought covered day, and probes on the far side of a window
    // boundary where the armed snapshot has refilled.
    expect(statesWithAPurchasedDay, 'states carrying a legally bought covered day').toBeGreaterThan(
      500,
    );
    expect(
      refusalsInsideARefilledWindow,
      'the sweep never probed past a window boundary',
    ).toBeGreaterThan(0);

    // ---- the completion-re-validation axis ---------------------------------

    // THE RESULT: an unsettled client and a nightly-settled one complete
    // identically, everywhere in the domain. Pinned at zero, not bounded.
    expect(completionDivergences, 'unsettled and settled clients completed differently').toBe(0);

    // AND THE ZERO IS NOT VACUOUS, which is the whole reason the offset axis
    // exists. The two states genuinely disagree about the absence on 1344 of
    // these probes — they are two different, both-correct readings of two
    // different states — and the store refuses to let that difference decide a
    // completed sale. Pinned exactly: if this ever reads 0, the domain has stopped
    // containing the case and the equality above is measuring nothing.
    expect(staleVerdicts, 'raw and settled states never disagreed, so the zero above is empty').toBe(
      STORE_VERDICT_DIVERGENCE.STALE_VERDICTS_IN_THE_DOOMED_SALE_SWEEP,
    );
    expect(staleVerdicts).toBeGreaterThan(0);

    // SETTLING IS TERMINAL, swept rather than argued: across every calendar,
    // shape and day, no nightly job ever recorded a second break after the first.
    // This is what makes `settledStateAsOf`'s early return sound.
    expect(secondSettles, 'a settled run was settled again').toBe(0);

    // ---- the render-day axis ------------------------------------------------

    // THE AXIS IS IN THE DOMAIN, pinned per lag rather than asserted as present.
    // The rotation is arithmetic over `offset` and `mask`, and arithmetic that
    // quietly collapsed to a single lag would leave every check above green
    // while testing the one case that was already covered.
    expect(Object.keys(lagsDrawn).map(Number).sort((a, b) => a - b)).toEqual(
      [...DOOMED_SALE_SWEEP.RENDER_DAY_LAGS].sort((a, b) => a - b),
    );
    for (const lag of DOOMED_SALE_SWEEP.RENDER_DAY_LAGS) {
      expect(lagsDrawn[lag] ?? 0, `probes drawn at render-day lag ${lag}`).toBeGreaterThan(
        probes / (DOOMED_SALE_SWEEP.RENDER_DAY_LAGS.length * 2),
      );
    }
    expect(
      Object.values(lagsDrawn).reduce((a, b) => a + b, 0),
      'every probe drew exactly one lag',
    ).toBe(probes);

    // ALL THREE REFUSAL CODES ARE REACHED, and the third one is the whole point
    // of the axis: `ABSENCE_ENDED_AFTER_OFFER` is UNREACHABLE at lag 0, because
    // the walk can only ever record a break on a day at or before the one it is
    // asked about. Before this axis existed the domain could not produce it at
    // all, so the routing that is now three-way was graded as two-way — and the
    // client that should have been told "your screen was right" was told "the
    // offer should never have been on screen".
    expect(Object.keys(refusalsByCode).sort(), 'refusal codes the sweep reached').toEqual([
      'ABSENCE_ALREADY_DOOMED',
      'ABSENCE_ENDED_AFTER_OFFER',
      'ABSENCE_ENDED_BEFORE_OFFER',
    ]);
    for (const [code, count] of Object.entries(refusalsByCode)) {
      expect(count, `${code} is a rounding error in this domain`).toBeGreaterThan(100);
    }
    expect(Object.values(refusalsByCode).reduce((a, b) => a + b, 0)).toBe(refused);

    // AND THE BRANCH WITH NO RECORDED END IS REACHED TOO — a lifter with no run
    // for the walk to settle. It routes as "not alive when the screen was
    // drawn", which is the conservative direction, and a zero here would mean
    // that branch was reasoned about rather than exercised.
    expect(refusalsWithNoRecordedEnd, 'no refusal ever came from a state with no run').toBeGreaterThan(
      0,
    );

    // THE SENTENCE MOVES WITH THE SCREEN AND THE DECISION DOES NOT. The throw
    // inside the loop is the decision half — it fires the moment inverting the
    // client's claim changes whether the order completes. This is the other
    // half, and it is the anti-vacuity guard for it: if inverting the claim
    // never changed anything at all, the decision half would be green against a
    // field nothing reads.
    expect(
      sentencesThatMovedWithTheScreen,
      'inverting the rendered offer never changed the sentence, so the field is inert',
    ).toBeGreaterThan(0);
  });

  it('[completion-revalidates-against-settled-state][the-copy-reads-the-clients-screen] THE STORE VERDICT AT A WINDOW BOUNDARY, AND THE TWO WAYS THE COPY USED TO LIE ABOUT IT', () => {
    // THE DIVERGENCE THIS PIECE WAS REWORKED FOR, on the calendar the sweep
    // found it on, kept as a reproduction rather than only as a count — because a
    // defect with no reproduction gets re-derived from scratch by the next
    // person, and because the two behaviours that produce it are still here.
    //
    // TWO PINNED BEHAVIOURS MEET AND THE STORE IS WHERE THEY LAND.
    //
    // (1) `settleBrokenStreak` nulls `lastTrainedDay`, so the anchor drops to
    //     the signup day and the absence gets LONGER. Documented, deliberate,
    //     and harmless to the STATE — every equality above still holds.
    //
    // (2) The armed snapshot REFILLS at a window boundary. `coveredDaysAvailable`
    //     returns a full window whenever the day asked about is past the
    //     snapshot's window, so an absence that was doomed on the last day of a
    //     window can be COVERED again on the first day of the next one. That is
    //     GDD §4.2's "refills without anybody opening the app", pinned by its own
    //     test, and it is not this piece's to change.
    //
    // Put together: on the revival day, an unsettled state reports a live run and
    // a settled state reports a 29-day absence from signup. NEITHER OF THOSE HAS
    // CHANGED — the two states still disagree, and both readings are still right
    // for the state they are read from.
    //
    // WHAT CHANGED IS THAT COMPLETING A SALE NO LONGER TRUSTS THE STALE ONE.
    // `applySettledCoveredDayPurchase` settles first, through `settledStateAsOf`,
    // and asks the same `absenceOutcome(...).protectionHolds` call it always
    // asked. So both clients are refused, and the one whose screen had offered
    // the sale is told which of the two things happened.
    const attend = [...'1.......1..11.......1.1..1.....11......'].map((c) => c === '1');
    const buyOn = [...'.B....BB...B........B.....B...B.B......'].map((c) => c === 'B');
    const initial = freshState();
    const never = simulate(attend, buyOn, initial, 'never', true);
    const daily = simulate(attend, buyOn, initial, 'daily', true);

    // THE STATE IS IDENTICAL, which is the §12.3 property and was true before the
    // fix as well — this was never a monotonicity defect.
    expect(JSON.stringify(daily.state)).toBe(JSON.stringify(never.state));
    // AND SO IS THE STORE'S BEHAVIOUR NOW. Before completion re-validation these
    // were 3 against 4 refusals and 7 against 6 Recovery Days spent, decided by
    // nothing but whether a nightly job had run.
    expect(never.refusedPurchases, 'the client that never opens').toBe(4);
    expect(daily.refusedPurchases, 'the client that settles nightly').toBe(4);
    expect(never.recoveryDaysSpent).toBe(6);
    expect(daily.recoveryDaysSpent).toBe(6);
    // The extra refusal the never-opening client now takes is the re-validation,
    // and it is the only client that can draw it.
    expect(never.refusedAfterOfferingIt, 'the stale client is the one re-validation caught').toBe(1);
    expect(daily.refusedAfterOfferingIt, 'a settled client has nothing to re-validate').toBe(0);

    // AND THE MECHANISM, ISOLATED. Day 29 is the last day of window 0 and day 30
    // the first of window 1, for an account created on DAY_ZERO.
    const lastTrained = addDays(DAY_ZERO, 25);
    const drained: StreakState = {
      ...stateWithRun(3, lastTrained, 0),
      entitlement: withCoveredDays(0, windowOf(lastTrained)),
      armedEntitlement: withCoveredDays(0, windowOf(lastTrained)),
    };
    const lastDayOfWindow = addDays(DAY_ZERO, RECOVERY_ENTITLEMENT.WINDOW_DAYS - 1);
    const firstDayOfNextWindow = addDays(DAY_ZERO, RECOVERY_ENTITLEMENT.WINDOW_DAYS);
    expect(entitlementWindowFor(drained, lastDayOfWindow)).toBe(0);
    expect(entitlementWindowFor(drained, firstDayOfNextWindow)).toBe(1);

    // Doomed on the last day of the window...
    expect(absenceOutcome(drained, lastDayOfWindow).protectionHolds).toBe(false);
    // ...and COVERED again on the first day of the next one, because the armed
    // snapshot reads a full window once the window has turned over. STILL TRUE:
    // the fix did not touch either behaviour, and a rendered store screen built
    // on this state legitimately shows the offer.
    expect(
      absenceOutcome(drained, firstDayOfNextWindow).protectionHolds,
      'the window boundary revives the absence',
    ).toBe(true);

    const order = {
      orderId: 'revived',
      coveredDays: 1,
      tender: 'chalk-purchased',
      renderedOffer: offerAsRenderedOn(drained, firstDayOfNextWindow),
    } as const;
    const settled = unwrap(settleBrokenStreak(drained, lastDayOfWindow)).state;

    // A SINGLE SETTLE AT THE COMPLETION DAY WOULD NOT HAVE CLOSED THIS, and that
    // is worth pinning because it is the obvious reading of "settle, then
    // validate" and it is measurably the wrong one. On the revival day the
    // absence holds, so `settleBrokenStreak` has nothing to record and the
    // revived run walks straight through.
    expect(
      errorCodeOf(settleBrokenStreak(drained, firstDayOfNextWindow)),
      'settling AT the completion day sees a live run and records nothing',
    ).toBe('NOTHING_TO_SETTLE');

    // SO THE WALK IS WHAT CLOSES IT: the break is found on day 29, where it
    // actually happened, and re-validation refuses the sale on day 30.
    const revalidated = settledStateAsOf(drained, firstDayOfNextWindow);
    expect(revalidated.runRecordedAsEndedOn, 'the day the run actually ended').toBe(lastDayOfWindow);
    expect(JSON.stringify(revalidated.state), 'and it lands on the settled state').toBe(
      JSON.stringify(settled),
    );

    // BOTH CLIENTS ARE NOW REFUSED. The one whose screen offered the sale is told
    // its screen was drawn over a run that had already ended; the one whose
    // screen said no is told they already agree.
    const staleSale = applySettledCoveredDayPurchase(drained, firstDayOfNextWindow, order);
    expect(errorCodeOf(staleSale)).toBe('ABSENCE_ENDED_BEFORE_OFFER');
    expect(errorMessageOf(staleSale)).toBe(DOOMED_SALE_REFUSAL_MESSAGE.endedBeforeOffer);

    const settledSale = applySettledCoveredDayPurchase(settled, firstDayOfNextWindow, {
      ...order,
      renderedOffer: offerAsRenderedOn(settled, firstDayOfNextWindow),
    });
    expect(errorCodeOf(settledSale)).toBe('ABSENCE_ALREADY_DOOMED');
    expect(errorMessageOf(settledSale)).toBe(DOOMED_SALE_REFUSAL_MESSAGE.armed);

    // ---- ATTACK 1: THE SENTENCE USED TO BE A LIE, ON THIS EXACT FIXTURE -----
    //
    // ONE CLIENT, ONE DEVICE, ONE STATE, NO BACKGROUND JOB, AND NO SECOND
    // SCREEN. The refusal above is reached with NOTHING having been settled by
    // anybody: `drained` is byte-identical to what every client and the server
    // hold, and the only thing that happened between the two renders is that a
    // day passed. The old code called this `ABSENCE_SETTLED_WHILE_AWAY` and told
    // the player "your break was already recorded while you were away — this
    // screen was still showing your account as it stood earlier". Both clauses
    // were false. That is what the rename and the re-keying fix.
    expect(
      settledStateAsOf(drained, lastDayOfWindow).runRecordedAsEndedOn,
      'the walk finds the break itself — nothing else recorded it',
    ).toBe(lastDayOfWindow);
    // The proof that no external recording is involved: the state handed in is
    // the same object that rendered "refused" a day earlier, unmodified.
    expect(drained.lastTrainedDay, 'the state still carries a live run').toBe(lastTrained);
    expect(drained.currentStreak).toBe(3);
    // And the sentence the player now sees claims no recording event at all.
    expect(DOOMED_SALE_REFUSAL_MESSAGE.endedBeforeOffer).not.toContain('while you were away');
    expect(DOOMED_SALE_REFUSAL_MESSAGE.endedBeforeOffer).not.toContain('recorded');

    // ---- ATTACK 2: THE 03:00 ROLLOVER, WHERE COMPLETION LANDS A DAY LATE ----
    //
    // NOT AN EXOTIC CASE — IT IS THIS MODULE'S OWN DAY BOUNDARY. A tap at 02:50
    // and a settlement at 03:10 are two different streak days by
    // `STREAK_DAY_BOUNDARY.ROLLOVER_HOUR_LOCAL`, so a player on the last day
    // their absence is covered can tap a live offer and have the order land on
    // the day it stopped being one. Derived from the constant rather than
    // hardcoded, so retuning the rollover moves this rather than stranding it.
    const tapHour = STREAK_DAY_BOUNDARY.ROLLOVER_HOUR_LOCAL - 1;
    const settleHour = STREAK_DAY_BOUNDARY.ROLLOVER_HOUR_LOCAL;
    const wallClock = { year: 2024, month: 6, day: 10 } as const;
    const tapDay = streakDayFromLocalWallClock({ ...wallClock, hour: tapHour });
    const settlementDay = streakDayFromLocalWallClock({ ...wallClock, hour: settleHour });
    expect(settlementDay, 'the rollover puts the tap and the settlement a day apart').toBe(
      addDays(tapDay, 1),
    );

    // A run whose coverage runs out exactly one day after the screen was drawn.
    // The screen day is READ OFF THE READ MODEL rather than counted by hand, so
    // retuning the grace or the per-absence ceiling moves this fixture with them
    // instead of stranding it on a day that is no longer the last one.
    const rollover = unwrap(recordTrainingDay(freshState(), DAY_ZERO)).state;
    const drawnOn = lastDayStreakCanBeSaved(rollover, DAY_ZERO);
    // Null would mean this lifter has no savable run at all, which would make
    // every assertion below vacuous rather than merely wrong.
    if (drawnOn === null) throw new Error('the rollover fixture has no savable run');
    const landedOn = addDays(drawnOn, 1);
    expect(absenceOutcome(rollover, drawnOn).protectionHolds, 'the offer was good when drawn').toBe(
      true,
    );
    expect(absenceOutcome(rollover, landedOn).protectionHolds, 'and dead when it landed').toBe(false);

    const lateOrder = {
      orderId: 'tapped-at-0250',
      coveredDays: 1,
      tender: 'chalk-purchased',
      renderedOffer: offerAsRenderedOn(rollover, drawnOn),
    } as const;
    expect(lateOrder.renderedOffer.offered, 'the client really did draw an offer').toBe(true);
    const lateSale = applySettledCoveredDayPurchase(rollover, landedOn, lateOrder);
    // THE ROUTING USED TO BE EXACTLY INVERTED HERE. This client was told
    // `ABSENCE_ALREADY_DOOMED`, whose meaning is "the store and this device
    // agree the run is over, so the offer should never have been on screen" —
    // and the device is the thing that offered it.
    expect(errorCodeOf(lateSale)).toBe('ABSENCE_ENDED_AFTER_OFFER');
    expect(errorMessageOf(lateSale)).toBe(DOOMED_SALE_REFUSAL_MESSAGE.endedAfterOffer);
    expect(
      DOOMED_SALE_REFUSAL_MESSAGE.endedAfterOffer,
      'the one sentence that must tell the player their screen was right',
    ).toContain('good when you saw it');

    // AND THE SAME ORDER, WITH THE SCREEN CLAIMED A DAY LATER, IS A DIFFERENT
    // SENTENCE AND THE SAME DECISION. This is the render-day axis in one pair:
    // move only `renderedOffer.day`, and the copy moves while the refusal does
    // not.
    const claimedLater = applySettledCoveredDayPurchase(rollover, landedOn, {
      ...lateOrder,
      renderedOffer: { day: landedOn, offered: true },
    });
    expect(errorCodeOf(claimedLater)).toBe('ABSENCE_ENDED_BEFORE_OFFER');
    expect(claimedLater.ok, 'the render day must not move the decision').toBe(lateSale.ok);

    // AND THE FOUR SENTENCES ARE FOUR SENTENCES. A refusal the player cannot
    // tell apart from another refusal is the greyed-out button the ruling
    // forbids, one layer in.
    expect(
      new Set(Object.values(DOOMED_SALE_REFUSAL_MESSAGE)).size,
      'two refusals share a sentence',
    ).toBe(4);
  });

  it('THE RENDERED OFFER IS VALIDATED LIKE ANY OTHER FIELD ON THE ORDER, not treated as a calendar refusal', () => {
    // A SETTLED ORDER ARRIVES AS JSON AND JSON HAS NO TYPES, which is the same
    // reason `tender` is re-checked at runtime after being typed. A malformed
    // `renderedOffer` is a BUG IN THE CALLER and must report as one: answering
    // "your streak already ended" to a missing field would hide a defect behind
    // a design rule, and the player would be told something about their account
    // that is not about their account.
    type Wire = Parameters<typeof applySettledCoveredDayPurchase>[2];
    const state = stateWithRun(5, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    const day = addDays(DAY_ZERO, 2);
    const wire = (renderedOffer: unknown): Wire =>
      ({ orderId: 'o', coveredDays: 1, tender: 'chalk-purchased', renderedOffer } as unknown as Wire);

    // The control: this order, well formed, is SOLD. Without it every refusal
    // below could be a refusal for some other reason entirely.
    expect(
      applySettledCoveredDayPurchase(state, day, wire({ day, offered: true })).ok,
      'the well-formed control must sell, or the refusals below prove nothing',
    ).toBe(true);

    for (const [what, renderedOffer] of [
      ['missing', undefined],
      ['null', null],
      ['not an object', 'yes'],
      ['no offered flag', { day }],
      ['offered is not a boolean', { day, offered: 'true' }],
      ['no day', { offered: true }],
      // IN RANGE AND FRACTIONAL, DELIBERATELY. The first draft of this row used
      // `1.5`, which is also before the signup day — so it was refused by the
      // account-existed check and stayed green when the whole-number check was
      // weakened away. A fixture that passes for the wrong reason is the hazard
      // this file is full of warnings about, and it was found by mutating.
      ['day is not a whole number', { day: day - 0.5, offered: true }],
    ] as const) {
      const result = applySettledCoveredDayPurchase(state, day, wire(renderedOffer));
      expect(errorCodeOf(result), `a ${what} rendered offer`).toBe('INVALID_PURCHASE');
    }

    // A SCREEN DRAWN AFTER THE ORDER SETTLED IS REFUSED RATHER THAN CLAMPED. A
    // clamp would silently answer for a day the player never saw, which is the
    // guessing this field exists to stop.
    expect(
      errorCodeOf(
        applySettledCoveredDayPurchase(state, day, wire({ day: addDays(day, 1), offered: true })),
      ),
      'a screen drawn after the order it belongs to',
    ).toBe('INVALID_PURCHASE');
    // ...and one drawn before the account existed, same call, same reason.
    expect(
      errorCodeOf(
        applySettledCoveredDayPurchase(state, day, wire({ day: addDays(SIGNUP_DAY, -1), offered: true })),
      ),
      'a screen drawn before the account existed',
    ).toBe('INVALID_PURCHASE');
    // The boundary itself is legal: drawn on the day it settled.
    expect(applySettledCoveredDayPurchase(state, day, wire({ day, offered: true })).ok).toBe(true);

    // STRUCTURE IS CHECKED BEFORE THE CALENDAR, and this is the assertion that
    // says so rather than the ordering of two `if`s saying it. On a day where
    // the absence is doomed — a real `ABSENCE_ALREADY_DOOMED` — a malformed
    // rendered offer still reports as malformed.
    const doomed = addDays(DAY_ZERO, LONGEST_REPAIRABLE_ABSENCE_DAYS + 3);
    expect(absenceOutcome(state, doomed).protectionHolds, 'the day really is doomed').toBe(false);
    expect(
      errorCodeOf(applySettledCoveredDayPurchase(state, doomed, wire({ day: doomed, offered: false }))),
      'well formed on a doomed day: the calendar refusal',
    ).toBe('ABSENCE_ALREADY_DOOMED');
    expect(
      errorCodeOf(applySettledCoveredDayPurchase(state, doomed, wire(undefined))),
      'malformed on a doomed day: still the malformed-order refusal',
    ).toBe('INVALID_PURCHASE');
  });

  it('A LIFTER WITH NO RUN TO RECORD STILL GETS THE RIGHT SENTENCE — the hole the first fix had', () => {
    // FOUND BY MEASURING THE FIX, NOT BY REVIEWING IT, and kept because the
    // first version of this rework shipped it and the sweep was green on it.
    //
    // THE HOLE. The routing asked whether the settle walk had RECORDED a break
    // by the render day. `settleBrokenStreak` refuses a state whose
    // `lastTrainedDay` is null, so a lifter who has NEVER TRAINED never gets a
    // break recorded at any horizon — while their signup absence still runs out
    // of coverage on a definite day (§1b: the signup day is an anchor like any
    // other). `runRecordedAsEndedOn` is null for them forever, "null means it
    // ended earlier" fired, and a player whose coverage ran out the day AFTER
    // their screen was drawn was told the screen had been wrong.
    //
    // WHY THE SWEEP DID NOT CATCH IT. The oracle asked the same question in the
    // same shape, so it shared the blind spot exactly. Two computations that are
    // independent in FORM can still be dependent in the FACT they read, and that
    // is the mirror hazard one level subtler than the one this round started on.
    //
    // WHAT FIXED IT: asking whether the SALE WOULD HAVE BEEN AUTHORISED, at the
    // render day and at the completion day — one predicate, two horizons. It
    // reads the absence, which this lifter has, rather than a recording, which
    // they never will.
    const fresh = createStreakState(SIGNUP_DAY);
    expect(fresh.lastTrainedDay, 'the premise: no session, so nothing to record').toBe(null);

    let drawnOn: StreakDay | null = null;
    for (let d = 1; d <= RECOVERY_ENTITLEMENT.WINDOW_DAYS && drawnOn === null; d += 1) {
      const here = addDays(SIGNUP_DAY, d);
      if (
        absenceOutcome(fresh, here).protectionHolds &&
        !absenceOutcome(fresh, addDays(here, 1)).protectionHolds
      ) {
        drawnOn = here;
      }
    }
    if (drawnOn === null) throw new Error('no day where this account stops being covered');
    const landedOn = addDays(drawnOn, 1);

    // Nothing is ever recorded for this account, at either horizon. That is the
    // premise the old routing tripped over, asserted rather than described.
    expect(settledStateAsOf(fresh, drawnOn).runRecordedAsEndedOn).toBe(null);
    expect(settledStateAsOf(fresh, landedOn).runRecordedAsEndedOn).toBe(null);

    const result = applySettledCoveredDayPurchase(fresh, landedOn, {
      orderId: 'never-trained',
      coveredDays: 1,
      tender: 'chalk-purchased',
      renderedOffer: offerAsRenderedOn(fresh, drawnOn),
    });
    expect(offerAsRenderedOn(fresh, drawnOn).offered, 'the screen really did offer it').toBe(true);
    // THE SENTENCE THAT WOULD BE A LIE IS THE ONE THIS USED TO GIVE.
    expect(errorCodeOf(result)).toBe('ABSENCE_ENDED_AFTER_OFFER');
    expect(errorMessageOf(result)).toBe(DOOMED_SALE_REFUSAL_MESSAGE.endedAfterOffer);

    // And the same account, drawn on the day it landed, is the other sentence —
    // so this is a routing that moves, not one that answers AFTER to everything.
    const sameDay = applySettledCoveredDayPurchase(fresh, landedOn, {
      orderId: 'never-trained',
      coveredDays: 1,
      tender: 'chalk-purchased',
      renderedOffer: { day: landedOn, offered: true },
    });
    expect(errorCodeOf(sameDay)).toBe('ABSENCE_ENDED_BEFORE_OFFER');
  });

  it('TWO RULINGS THIS MODULE MAKES AND DOES NOT ENFORCE: retrying an order, and a player holding two devices', () => {
    // BOTH OF THESE WERE RAISED AS OPEN QUESTIONS AND BOTH ARE ANSWERED HERE
    // RATHER THAN IN A REPORT, because a ruling that lives only in prose is the
    // thing this file exists to stop. Neither is a defect being papered over:
    // each is a real limit of a pure module that is handed one state and one
    // order, and each is pinned so that a future change to it is a red test.
    const lastTrained = addDays(DAY_ZERO, 25);
    const drained: StreakState = {
      ...stateWithRun(3, lastTrained, 0),
      entitlement: withCoveredDays(0, windowOf(lastTrained)),
      armedEntitlement: withCoveredDays(0, windowOf(lastTrained)),
    };
    const revivalDay = addDays(DAY_ZERO, RECOVERY_ENTITLEMENT.WINDOW_DAYS);
    const order = {
      orderId: 'one-payment',
      coveredDays: 1,
      tender: 'chalk-purchased',
      renderedOffer: offerAsRenderedOn(drained, revivalDay),
    } as const;
    expect(order.renderedOffer.offered, 'the screen really did offer the sale').toBe(true);

    // ---- RULING 1: NO IDEMPOTENCY KEY, AND THE CALLER OWNS DE-DUPLICATION ---
    //
    // A REFUSAL COSTS NOTHING, which is what makes retrying a refused order safe
    // and is the half the module CAN guarantee: every failure path returns an
    // error and no state, so there is nothing to apply twice.
    const first = applySettledCoveredDayPurchase(drained, revivalDay, order);
    expect(errorCodeOf(first)).toBe('ABSENCE_ENDED_BEFORE_OFFER');
    const retried = applySettledCoveredDayPurchase(drained, revivalDay, order);
    expect(retried, 'the same order against the same state is the same answer').toEqual(first);

    // AND THE HALF IT CANNOT: an ACCEPTED order applied twice credits twice.
    // Measured rather than promised, because the docstring tells a caller not to
    // do it and an untested "do not do this" is indistinguishable from a
    // guarantee that it is handled.
    const live = stateWithRun(5, DAY_ZERO, 0);
    const buyDay = addDays(DAY_ZERO, 1);
    const once = unwrap(
      applySettledCoveredDayPurchase(live, buyDay, {
        ...order,
        renderedOffer: offerAsRenderedOn(live, buyDay),
      }),
    ).state;
    const twice = unwrap(
      applySettledCoveredDayPurchase(once, buyDay, {
        ...order,
        renderedOffer: offerAsRenderedOn(once, buyDay),
      }),
    ).state;
    expect(once.entitlement.purchasedDaysLeft, 'one application of one order').toBe(1);
    expect(
      twice.entitlement.purchasedDaysLeft,
      'the module does not de-duplicate: the caller that settled the order must',
    ).toBe(2);

    // WHY IT IS NOT FIXED HERE, as a checkable fact and not an argument: there is
    // nowhere to put an order ledger. `StreakState` is exactly `STREAK_FACT_KEYS`
    // and every §12.3 sweep compares whole states, so a growing list of order ids
    // would make "the two lifters ended identically" depend on what they bought.
    expect(
      STREAK_FACT_KEYS.some((key) => key.toLowerCase().includes('order')),
      'the state holds no order ledger, and that is the ruling',
    ).toBe(false);

    // ---- RULING 2: TWO DEVICES ARE OUT OF THIS MODULE'S REACH, HONESTLY -----
    //
    // The tablet has refreshed and holds settled state; the phone is behind and
    // still shows the offer. One player, two screens, one run.
    const tablet = unwrap(
      settleBrokenStreak(drained, addDays(DAY_ZERO, RECOVERY_ENTITLEMENT.WINDOW_DAYS - 1)),
    ).state;
    const phone = drained;

    const fromTheTablet = applySettledCoveredDayPurchase(tablet, revivalDay, {
      ...order,
      renderedOffer: offerAsRenderedOn(tablet, revivalDay),
    });
    const fromThePhone = applySettledCoveredDayPurchase(phone, revivalDay, order);

    // THE PLAYER IS GIVEN TWO SENTENCES, AND THE OLD CLAIM THAT THIS CANNOT
    // HAPPEN IS THE ONE THAT WAS DELETED. What is asserted instead is that each
    // sentence is true of the screen it answers.
    expect(errorCodeOf(fromTheTablet)).toBe('ABSENCE_ALREADY_DOOMED');
    expect(errorCodeOf(fromThePhone)).toBe('ABSENCE_ENDED_BEFORE_OFFER');
    expect(errorMessageOf(fromTheTablet)).not.toBe(errorMessageOf(fromThePhone));

    // The tablet's screen said no — so "we both already know" is true of it.
    expect(
      offerAsRenderedOn(tablet, revivalDay).offered,
      'the tablet drew no offer, so its sentence is the one for a screen that said no',
    ).toBe(false);
    // The phone's screen said yes, and the run had ended before it was drawn —
    // so "this screen was drawn over a run that had already ended" is true of it.
    expect(
      settledStateAsOf(phone, revivalDay).runRecordedAsEndedOn,
      'the run ended before the day the phone drew its screen',
    ).toBeLessThan(revivalDay);

    // AND THE DECISION IS THE SAME ON BOTH DEVICES, which is the §12.3 property
    // and the one that is NOT out of reach. Two screens may produce two
    // sentences; they may never produce two outcomes.
    expect(fromTheTablet.ok, 'both devices are refused').toBe(false);
    expect(fromThePhone.ok, 'both devices are refused').toBe(false);

    // THE PHONE'S SENTENCE FOLLOWS THE PHONE'S SCREEN AND NOT THE PHONE'S STATE,
    // and this pair is what says so. Same state, same day, same order — only the
    // client's report of what it drew changes, and the sentence changes with it.
    //
    // IT WAS ADDED BECAUSE MUTATING FOUND THE TEST WITHOUT IT TOO WEAK. Replacing
    // the read of `renderedOffer.offered` with a re-derivation off the completion
    // day left every other assertion in this test green, because in this fixture
    // the honest phone's screen and the re-derivation agree. They disagree here.
    const phoneThatRedrewAndSaidNo = applySettledCoveredDayPurchase(phone, revivalDay, {
      ...order,
      renderedOffer: { day: revivalDay, offered: false },
    });
    expect(
      absenceOutcome(phone, revivalDay).protectionHolds,
      'a re-derivation off this state and day would say the offer was live',
    ).toBe(true);
    expect(
      errorCodeOf(phoneThatRedrewAndSaidNo),
      'the sentence must follow the reported screen, not a re-derivation',
    ).toBe('ABSENCE_ALREADY_DOOMED');
    expect(
      phoneThatRedrewAndSaidNo.ok,
      'and changing the reported screen must not change the decision',
    ).toBe(fromThePhone.ok);
  });

  it('[purchase-cannot-rescue-a-doomed-run] THE 11-VERSUS-1 SCENARIO: a purchase during an absence cannot rescue it, in any intra-day order', () => {
    // THE DEFECT THIS PIECE WAS REWORKED FOR, reproduced as its own test rather
    // than left to a sweep — because it was a sweep's blind spot that hid it.
    //
    // A ten-day run, the window drained, armed, and an absence of three missed
    // days: one day past the free grace, nothing left to pay it, run dead.
    // `absenceOutcome` used to resolve against the LIVE entitlement, so a
    // settled covered-day purchase applied on the return day covered that
    // three-day absence — but only if nothing had called `settleBrokenStreak`
    // first, because settling moves the anchor back to the signup day and makes
    // the absence twelve days long instead. Same calendar, same money, final
    // `currentStreak` 11 or 1 depending on whether a nightly job had run.
    //
    // WHY NOTHING IN THE REPO WENT RED ON IT: every harness fixes the safe
    // intra-day order. `simulate` buys and then opens; `drive` buys and then
    // opens; `driveThroughStreakEngine` buys and then opens. The app-opening
    // purity sweep varies WHICH DAYS the app is opened and never the order
    // within one. So the property it is named for was not the property it
    // checked, and it was green for an unrelated reason.
    const drained: StreakState = {
      ...stateWithRun(10, addDays(SIGNUP_DAY, 9), 0),
      currentStreak: 10,
      longestStreak: 10,
    };
    const returnDay = addDays(SIGNUP_DAY, 13);
    // THE LAST DAY THE GRACE STILL COVERS THIS ABSENCE, hoisted because both
    // orders below need a screen day at or before the day they complete on.
    const lastSellableDay = addDays(SIGNUP_DAY, 12);
    // TWO ORDERS, BECAUSE THEY COME FROM TWO DIFFERENT SCREENS. The sale that
    // succeeds was tapped from a screen on the day it lands; the sale that is
    // refused was tapped from a screen on the return day, where an honest client
    // gating on `protectionHolds` draws no button at all. Sharing one literal
    // between them would mean a screen drawn AFTER the order it belongs to,
    // which is a malformed order and refused as one.
    const order = {
      orderId: 'the-11-versus-1-order',
      coveredDays: 1,
      tender: 'chalk-purchased',
      renderedOffer: { day: lastSellableDay, offered: true },
    } as const;
    const orderFromTheReturnDay = {
      ...order,
      renderedOffer: { day: returnDay, offered: false },
    } as const;

    // The absence is one chargeable day and there is nothing armed to pay it.
    expect(daysMissedBefore(drained, returnDay)).toBe(3);
    expect(chargeableDaysBefore(drained, returnDay)).toBe(1);
    expect(coveredDaysArmed(drained, returnDay)).toBe(0);
    expect(openDay(drained, returnDay).kind).toBe('streak-broken');

    const settleIfBroken = (state: StreakState): StreakState => {
      const settled = settleBrokenStreak(state, returnDay);
      return settled.ok ? settled.value.state : state;
    };

    // SINCE THE DOOMED-SALE RULING, THIS EXACT SALE IS REFUSED AT THE DOOR. The
    // scenario is kept rather than retired, because the refusal has to be
    // app-open neutral for the same reason the outcome did, and this is the
    // calendar that proves it.
    //
    // THE REFUSAL IS BYTE-IDENTICAL WHETHER OR NOT A NIGHTLY JOB SETTLED FIRST,
    // and that is a real assertion rather than a formality: settling nulls
    // `lastTrainedDay`, so the anchor drops to the signup day and this absence
    // grows from 3 days to 13. `breakReasonFor` is ordered hardest-first, so the
    // REASON flips from `'not-enough-recovery-days-armed'` to
    // `'absence-longer-than-consecutive-limit'` across that line — and the first
    // draft of this refusal keyed its message to the reason, which reproduced
    // 11-versus-1 in the copy. Compare the whole error, not the code.
    const refusedDirect = applySettledCoveredDayPurchase(drained, returnDay, orderFromTheReturnDay);
    const refusedAfterSettle = applySettledCoveredDayPurchase(
      settleIfBroken(drained),
      returnDay,
      orderFromTheReturnDay,
    );
    expect(errorCodeOf(refusedDirect), 'the store refuses a doomed absence').toBe(
      'ABSENCE_ALREADY_DOOMED',
    );
    expect(refusedAfterSettle, 'same money, same day, same sentence').toEqual(refusedDirect);
    // The premise of that comparison: the reason really does drift underneath it.
    expect(absenceOutcome(drained, returnDay).breakReason).toBe('not-enough-recovery-days-armed');
    expect(absenceOutcome(settleIfBroken(drained), returnDay).breakReason).toBe(
      'absence-longer-than-consecutive-limit',
    );

    // AND THE RESCUE PROPERTY IS RE-DRIVEN WITH A PURCHASE THE STORE DOES SELL.
    // The ruling closes the door on buying INTO a doomed absence; it does not
    // close the door on an absence going doomed AFTER a legal purchase, which is
    // the case that keeps the covers/burn asymmetry load-bearing. Bought on the
    // last day the grace still covered this absence, then carried into a break.
    expect(absenceOutcome(drained, lastSellableDay).protectionHolds, 'still salvageable').toBe(true);
    const carried = unwrap(
      applySettledCoveredDayPurchase(drained, lastSellableDay, order),
    ).state;
    expect(coveredDaysLeftInWindow(carried), 'the legal purchase landed').toBe(1);
    // It raised the LIVE balance and not the armed snapshot, so the absence it
    // was bought during still cannot draw on it.
    expect(coveredDaysArmed(carried, returnDay)).toBe(0);
    expect(absenceOutcome(carried, returnDay).protectionHolds, 'and it did not rescue').toBe(false);

    const buy = (state: StreakState): StreakState =>
      unwrap(applySettledCoveredDayPurchase(state, lastSellableDay, order)).state;

    // ORDER 1 — buy, then let the app open and settle, then train. This is the
    // order that used to end on 11.
    const buyThenSettle = unwrap(recordTrainingDay(settleIfBroken(buy(drained)), returnDay));
    // ORDER 2 — the app opens and settles first, then the store, then train.
    // This is the order that used to end on 1, for the same money. Settling on
    // the SELLING day, so the store still sees a salvageable absence.
    const settledFirst = (): StreakState => {
      const settled = settleBrokenStreak(drained, lastSellableDay);
      return settled.ok ? settled.value.state : drained;
    };
    const settleThenBuy = unwrap(recordTrainingDay(buy(settledFirst()), returnDay));
    // ORDER 3 — never settle at all. `recordTrainingDay` settles the same break.
    const buyThenTrain = unwrap(recordTrainingDay(buy(drained), returnDay));

    // THE RUN IS DEAD IN ALL THREE, and the purchase did not rescue it.
    expect(buyThenSettle.state.currentStreak, 'buy-then-settle').toBe(1);
    expect(settleThenBuy.state.currentStreak, 'settle-then-buy').toBe(1);
    expect(buyThenTrain.state.currentStreak, 'never settle').toBe(1);
    expect(buyThenSettle.previousRunEnded).toBe(true);

    // AND THE WHOLE STATE AGREES, not only the streak — the strong form, which
    // is the one an app-open cannot be neutral without.
    expect(buyThenSettle.state, 'settling before or after the purchase').toEqual(settleThenBuy.state);
    expect(buyThenTrain.state, 'settling early or not at all').toEqual(settleThenBuy.state);

    // THE DOOMED BURN STILL TAKES A PURCHASED DAY, which is the measurement that
    // says the covers/burn asymmetry survived this ruling rather than being
    // quietly made moot by it. Whether the run SURVIVES read the armed snapshot
    // and said no; what the break COSTS reads the live balance and takes the day
    // the lifter bought while it was still salvageable.
    expect(buyThenTrain.recoveryDaysLostToTheAbsence, 'the live purchased day burned').toBe(1);
    expect(coveredDaysLeftInWindow(buyThenTrain.state)).toBe(0);

    // NOT VACUOUS: the purchase really did land, and the store really did tell
    // the player they now hold a covered day. It arms the NEXT absence — GDD
    // §4.2 — which is a different promise from rescuing this one.
    const bought = unwrap(applySettledCoveredDayPurchase(drained, lastSellableDay, order));
    expect(bought.coveredDaysCredited).toBe(1);
    expect(coveredDaysLeftInWindow(bought.state)).toBe(1);
    // ...and it is still not drawable by the absence in progress.
    expect(coveredDaysArmed(bought.state, returnDay)).toBe(0);
    expect(openDay(bought.state, returnDay).kind).toBe('streak-broken');
    // The pay-to-win receipt: no streak moved.
    expect(bought.currentStreakUnchanged).toBe(10);
    expect(bought.longestStreakUnchanged).toBe(10);
  });

  it('SETTLING IS NEUTRAL EVEN WHEN A PURCHASE LANDS THE SAME DAY — swept, not argued', () => {
    // THE ASSERTION WHOSE ABSENCE HID THE DEFECT. The sweep above this one
    // varies which days the app is opened; this one fixes the calendar and
    // varies THE ORDER WITHIN A DAY of the two things an app-open can do
    // (`openDay`, and the `settleBrokenStreak` it triggers) against the one
    // thing a store can do.
    //
    // WHAT IS ASSERTED IS FULL STATE EQUALITY, because an app-open is not an
    // input to anything: a player whose client settles on launch must end
    // exactly where one who ignored the app ends. That is CLAUDE.md's "never
    // punish daily engagement" in its plainest form.
    // THE PURCHASE DAY IS SWEPT SEPARATELY FROM THE DAY THE APP OPENS, and the
    // two being the same day is the easy case rather than the interesting one.
    // A settled order carries the day IT settled on; the server may apply it
    // later, when a webhook lands or a client reconnects. So the sweep includes
    // an order dated back on the lifter's last training day and applied on the
    // return day — which is exactly the pair that separates "did this arrive
    // before the arming" from "did this arrive before the anchor", and the
    // anchor is the thing `settleBrokenStreak` moves.
    //
    // SINCE THE DOOMED-SALE RULING THE STORE REFUSES SOME OF THESE, so the sweep
    // carries a second property of the same shape: WHETHER THE SALE HAPPENS AT
    // ALL must also be independent of the order within the day, and so must the
    // sentence the refusal carries. A refusal that depended on whether a nightly
    // job had run would be the original defect relocated into the store.
    let cases = 0;
    let brokenSeen = 0;
    let coveredSeen = 0;
    let sold = 0;
    let refused = 0;
    let purchasesThatRaisedTheBalance = 0;
    const order = { orderId: 'sweep', coveredDays: 1, tender: 'chalk-purchased' } as const;

    for (let runLength = 1; runLength <= 4; runLength += 1) {
      for (let balance = 0; balance <= RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW; balance += 1) {
        for (let gap = 0; gap <= LONGEST_REPAIRABLE_ABSENCE_DAYS + 2; gap += 1) {
          for (const armed of [true, false]) {
            const base: StreakState = {
              ...stateWithRun(runLength, DAY_ZERO, balance),
              entitlementArmed: armed,
            };
            const day = dayAfterGap(DAY_ZERO, gap);
            if (openDay(base, day).kind === 'streak-broken') brokenSeen += 1;
            if (openDay(base, day).kind === 'gap-covered-by-recovery-days') coveredSeen += 1;

            // `DAY_ZERO` is this fixture's last training day and therefore the
            // day its coverage was armed on. `day` is the return day.
            for (const purchaseDay of [DAY_ZERO, day]) {
              // THE STORE MAY REFUSE, AND A REFUSAL IS AN ANSWER RATHER THAN AN
              // ERROR HERE. `attempt` carries the whole result so the sweep can
              // compare the refusals to each other, not only the states.
              // ONE SCREEN, HELD FIXED ACROSS EVERY ORDERING BELOW. The screen
              // is now an input rather than something the module re-derives, so
              // the app-open axis and the what-did-the-client-draw axis are
              // separable — and this sweep is about the first one. Letting the
              // screen move with the state under test would fold the two
              // together and the equalities below would be measuring both.
              const screen = offerAsRenderedOn(base, purchaseDay);
              const attempt = (
                state: StreakState,
              ): { readonly state: StreakState; readonly result: StreakResult<unknown> } => {
                const result = applySettledCoveredDayPurchase(state, purchaseDay, {
                  ...order,
                  renderedOffer: screen,
                });
                return { state: result.ok ? result.value.state : state, result };
              };
              const buy = (state: StreakState): StreakState => attempt(state).state;
              const settle = (state: StreakState): StreakState => {
                const result = settleBrokenStreak(state, day);
                return result.ok ? result.value.state : state;
              };
              const label = `run ${runLength} balance ${balance} gap ${gap} armed ${armed} bought on ${
                purchaseDay === DAY_ZERO ? 'the arming day' : 'the return day'
              }`;

              // NO PURCHASE, AT ANY DATE, RAISES WHAT THE ABSENCE MAY DRAW —
              // and where the store sells, it raises the balance every time, so
              // the order really did land. This pair is the property and its own
              // anti-vacuity: "nothing changed" and "nothing was bought" produce
              // the same first line and are told apart by the second.
              const direct = attempt(base);
              expect(coveredDaysArmed(direct.state, day), `armed after buying on ${purchaseDay}`).toBe(
                coveredDaysArmed(base, day),
              );
              if (direct.result.ok) {
                sold += 1;
                expect(coveredDaysLeftInWindow(direct.state), label).toBeGreaterThan(
                  coveredDaysLeftInWindow(base),
                );
                purchasesThatRaisedTheBalance += 1;
              } else {
                refused += 1;
                expect(errorCodeOf(direct.result), label).toBe('ABSENCE_ALREADY_DOOMED');
              }

              // THE SALE DECISION AND ITS SENTENCE ARE THE SAME IN EVERY ORDER.
              // Settling before the store is asked must not change whether it
              // sells, nor — when it refuses — one character of what it says.
              //
              // THE VERDICT AND THE REFUSAL, NOT THE WHOLE SUCCESS OUTCOME, and
              // the difference was found by asserting too much: a successful
              // outcome reports `currentStreakUnchanged`, and after settling
              // that is honestly 0 rather than the pre-break length, because the
              // run really has ended. Pinning the receipt would be pinning the
              // settle rather than the sale.
              const settledFirst = attempt(settle(base)).result;
              expect(settledFirst.ok, `${label}: settled first, sold?`).toBe(direct.result.ok);
              if (!settledFirst.ok && !direct.result.ok) {
                expect(settledFirst.error, `${label}: settled first, sentence`).toEqual(
                  direct.result.error,
                );
              }

              // Buy first, then the app opens. Then the app opens, then buy.
              // Then the app never opens at all. Three orders, one calendar,
              // one order id, and `recordTrainingDay` closes the absence in each.
              const buyThenSettle = unwrap(recordTrainingDay(settle(buy(base)), day)).state;
              const settleThenBuy = unwrap(recordTrainingDay(buy(settle(base)), day)).state;
              const neverSettle = unwrap(recordTrainingDay(buy(base), day)).state;

              expect(buyThenSettle, label).toEqual(settleThenBuy);
              expect(neverSettle, label).toEqual(settleThenBuy);
              cases += 1;
            }
          }
        }
      }
    }

    // ANTI-VACUITY: the sweep reached both the case where the run died and the
    // case where coverage held it, or it is an equality over one column.
    expect(cases).toBeGreaterThan(200);
    expect(brokenSeen).toBeGreaterThan(0);
    expect(coveredSeen).toBeGreaterThan(0);
    // AND THE SWEEP REACHED BOTH SIDES OF THE STORE'S DOOR. All-sold makes the
    // refusal comparison vacuous; all-refused makes the landing assertion
    // vacuous. Neither is allowed to be the whole column.
    expect(sold, 'sales the store allowed').toBeGreaterThan(0);
    expect(refused, 'sales the store refused as doomed').toBeGreaterThan(0);
    expect(sold + refused).toBe(cases);
    // AND EVERY ONE OF THE PURCHASES THAT LANDED REALLY LANDED, or "the absence
    // could draw no more afterwards" is a statement about an order that did
    // nothing.
    expect(purchasesThatRaisedTheBalance, 'a sale that raised nothing').toBe(sold);
  });

  it('A PURCHASE BEFORE A SESSION AND ONE AFTER IT DIFFER, and here is exactly where', () => {
    // THE RESIDUAL, MEASURED AND PINNED RATHER THAN LEFT FOR A CRITIC. The two
    // app-open orders above are identical; the two orders around a SESSION are
    // not, and pretending otherwise would be the same kind of comment this
    // rework existed to delete.
    //
    // WHERE IT COMES FROM, and there are two mechanisms, not one.
    //
    // (1) A doomed absence consumes everything the window holds LIVE, which it
    //     must — that is the only doomed consumption that is idempotent under
    //     splitting, and charging the armed count instead measures 3 violating
    //     pairs on `real-money` at 40 days (see `absenceOutcome`). So a covered
    //     day bought BEFORE the session that closes a doomed absence is in the
    //     window when the burn happens and is taken.
    //
    // (2) ONLY A SESSION ARMS. So a covered day bought AFTER a session is held
    //     but not armed until the NEXT one — which is GDD §4.2 read exactly as
    //     written, because the absence that session started had already begun.
    //
    // WHY THIS IS NOT THE DEFECT ABOVE. Nothing here depends on an APP-OPEN.
    // The player chose when to spend money; the two orders are two different
    // player actions, not one action seen from two clients.
    //
    // ONE OF THE TWO FIXES THIS PARAGRAPH USED TO NAME AS UNBUILT IS NOW BUILT,
    // and the note is corrected rather than left to read as a to-do somebody
    // else owns. A human ruled the server-side refusal in: the store no longer
    // sells into an already-doomed absence, so mechanism (1) can no longer be
    // entered by buying INTO a break. It is still reachable — buy while the
    // absence is salvageable, then let it go doomed — and part (3) below drives
    // exactly that, because a mechanism that survives the fix has to keep being
    // measured rather than assumed gone.
    //
    // THE REMAINING DIFFERENCE IS THE SAME-DAY PURCHASE-TIMING RULE, and it is
    // an intentional rule now rather than a residual: a covered day bought
    // BEFORE a session is armed by that session; one bought AFTER it arms at the
    // next. GDD §4.2 and §8.3E carry it. Part (1) pins both orders so the
    // documented rule is enforced rather than described.
    const drained: StreakState = {
      ...stateWithRun(10, addDays(SIGNUP_DAY, 9), 0),
      currentStreak: 10,
      longestStreak: 10,
    };
    const order = { orderId: 'residual', coveredDays: 1, tender: 'chalk-purchased' } as const;

    // ---------------------------------------------------------------------
    // (1) THE SAME-DAY PURCHASE-TIMING RULE, BOTH ORDERS, ON A LIVE RUN.
    // ---------------------------------------------------------------------
    // A session the day after the last one: nothing missed, nothing doomed, so
    // the store sells in both orders and the only variable is the clock time of
    // the purchase against the clock time of the session.
    const sessionDay = addDays(SIGNUP_DAY, 10);
    const buyOn = (state: StreakState, day: StreakDay): StreakState =>
      unwrap(
        applySettledCoveredDayPurchase(state, day, {
          ...order,
          renderedOffer: offerAsRenderedOn(state, day),
        }),
      ).state;

    const boughtBeforeSession = unwrap(
      recordTrainingDay(buyOn(drained, sessionDay), sessionDay),
    ).state;
    const boughtAfterSession = buyOn(
      unwrap(recordTrainingDay(drained, sessionDay)).state,
      sessionDay,
    );

    // BEFORE THE SESSION: armed by that same session. The session arms whatever
    // the window holds when it runs, and the purchase was already in it.
    expect(
      coveredDaysArmed(boughtBeforeSession, sessionDay),
      'bought before the session: armed the same session',
    ).toBe(1);

    // AFTER THE SESSION: held, and armed by the NEXT one. Not by this one, and
    // not never.
    expect(
      coveredDaysLeftInWindow(boughtAfterSession),
      'bought after the session: held',
    ).toBe(1);
    expect(
      coveredDaysArmed(boughtAfterSession, sessionDay),
      'bought after the session: not armed yet',
    ).toBe(0);
    const nextSession = unwrap(recordTrainingDay(boughtAfterSession, addDays(sessionDay, 1))).state;
    expect(
      coveredDaysArmed(nextSession, addDays(sessionDay, 1)),
      'bought after the session: armed by the next session',
    ).toBe(1);

    // AND THE RUN IS UNTOUCHED BY EITHER ORDER — the pay-to-win line, which is
    // the part that is not allowed to be a residual.
    expect(boughtBeforeSession.currentStreak).toBe(11);
    expect(boughtAfterSession.currentStreak).toBe(11);
    expect(boughtBeforeSession.longestStreak).toBe(boughtAfterSession.longestStreak);

    // ---------------------------------------------------------------------
    // (2) BUYING INTO A DOOMED ABSENCE IS REFUSED, so the old route into
    //     mechanism (1) is closed at the door.
    // ---------------------------------------------------------------------
    const returnDay = addDays(SIGNUP_DAY, 13);
    expect(absenceOutcome(drained, returnDay).protectionHolds).toBe(false);
    expect(
      errorCodeOf(
        applySettledCoveredDayPurchase(drained, returnDay, {
          ...order,
          renderedOffer: offerAsRenderedOn(drained, returnDay),
        }),
      ),
      'the store refuses to sell into the break',
    ).toBe('ABSENCE_ALREADY_DOOMED');

    // ---------------------------------------------------------------------
    // (3) MECHANISM (1) IS STILL REACHABLE, and still burns. Bought on the last
    //     day the absence was salvageable, then carried into a doomed one.
    // ---------------------------------------------------------------------
    const lastSellableDay = addDays(SIGNUP_DAY, 12);
    expect(absenceOutcome(drained, lastSellableDay).protectionHolds).toBe(true);
    const before = unwrap(
      recordTrainingDay(buyOn(drained, lastSellableDay), returnDay),
    ).state;
    expect(coveredDaysLeftInWindow(before), 'the doomed burn took the purchased day').toBe(0);
    expect(coveredDaysArmed(before, returnDay), 'nothing left to arm').toBe(0);
    expect(before.currentStreak, 'and it never rescued the run').toBe(1);

    // ARMED IS NEVER MORE THAN HELD, in any of them. A state where a lifter is
    // armed with more than they hold is one no entry point can produce, and it
    // is the shape every invariant in this file would quietly stop meaning.
    for (const state of [boughtBeforeSession, boughtAfterSession, nextSession, before]) {
      expect(coveredDaysArmed(state, addDays(returnDay, 1))).toBeLessThanOrEqual(
        coveredDaysLeftInWindow(state),
      );
    }
  });

  it('[settling-is-a-recording] doing it early, late, twice or never is the same', () => {
    // `settleBrokenStreak` is the only state change an app-open can trigger.
    // If it could change an outcome, the invariant above would be luck.
    const state: StreakState = { ...stateWithRun(30, DAY_ZERO, 1), entitlementArmed: true };
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

    // AND THE TWO REASONS IT HOLDS, ASSERTED SEPARATELY, because the docstring
    // on `settleBrokenStreak` states them as the mechanism and stating a
    // mechanism nothing checks is how the wrong one survived a round there.
    // (It used to say the doomed burn was "the armed amount". It is the LIVE
    // amount; what makes it settling-proof is that it is not a function of the
    // absence's LENGTH at all.)
    //
    // REASON 1: a longer absence on the SAME DAY is still doomed. Settling
    // raises `chargeable` and leaves what is drawable alone, so the verdict can
    // only go covered -> doomed and never back.
    //
    // ITS FIXTURE TRAINS AWAY FROM THE SIGNUP DAY ON PURPOSE. `state` above has
    // `lastTrainedDay === signupDay`, so settling moves the anchor NOWHERE and
    // the premise of this bullet is unobservable on it — found by writing the
    // assertion and watching it read 6 against 6.
    const laterAnchor: StreakState = {
      ...stateWithRun(30, addDays(DAY_ZERO, 5), 1),
      entitlementArmed: true,
    };
    const probeDay = addDays(DAY_ZERO, 5 + LONGEST_REPAIRABLE_ABSENCE_DAYS + 2);
    const settledOnce = unwrap(settleBrokenStreak(laterAnchor, probeDay)).state;
    expect(
      absenceOutcome(laterAnchor, probeDay).daysMissed,
      'the premise: settling really does lengthen the absence',
    ).toBeLessThan(absenceOutcome(settledOnce, probeDay).daysMissed);
    expect(absenceOutcome(laterAnchor, probeDay).protectionHolds).toBe(false);
    expect(absenceOutcome(settledOnce, probeDay).protectionHolds).toBe(false);

    // REASON 2: the doomed burn is not a function of the absence's length. Same
    // state, same window, four different absence lengths — one figure.
    const burns = new Set<number>();
    for (let extra = 0; extra < 4; extra += 1) {
      const day = addDays(brokenOn, extra);
      const outcome = absenceOutcome(state, day);
      expect(outcome.protectionHolds, `doomed at +${extra}`).toBe(false);
      burns.add(outcome.recoveryDaysConsumed);
    }
    expect(burns.size, 'the burn moved with the absence length').toBe(1);
    // ...and it is the LIVE figure, not the armed one. Built by buying while the
    // absence was still salvageable, so the two really differ.
    const salvageable = addDays(DAY_ZERO, GRACE);
    expect(absenceOutcome(state, salvageable).protectionHolds, 'still sellable').toBe(true);
    const carrying = unwrap(
      applySettledCoveredDayPurchase(state, salvageable, {
        orderId: 'burn-reads-live',
        coveredDays: 1,
        tender: 'chalk-purchased',
        renderedOffer: offerAsRenderedOn(state, salvageable),
      }),
    ).state;
    expect(coveredDaysArmed(carrying, brokenOn), 'the armed snapshot did not move').toBe(1);
    expect(coveredDaysLeftInWindow(carrying), 'the live balance did').toBe(2);
    expect(
      absenceOutcome(carrying, brokenOn).recoveryDaysConsumed,
      'the burn is the LIVE balance, not the armed one',
    ).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// "Never punish daily engagement"
// ---------------------------------------------------------------------------

/**
 * WHAT THE MONOTONICITY SWEEP RETURNED, on the calendars `streakSweep.ts`
 * generates. The INPUTS live there, as named constants and a deterministic
 * generator; only the RESULTS live here.
 *
 * That split is the whole point. The first version of this measurement was
 * published with its seeds unstated, and could not afterwards be reproduced by
 * anyone — the same sweep at six plausible parameterisations gave six different
 * numbers. Every figure below can now be re-derived from the repository alone:
 * `MONOTONICITY_SWEEP` says which calendars, this says what they returned.
 *
 * A VIOLATION is a pair of calendars identical except that one has one extra
 * trained day, where the lifter who trained MORE ends on a strictly LOWER
 * `currentStreak`. Both members are SETTLED to the same final day before being
 * compared — see the staleness test for why comparing unsettled states gets the
 * answer wrong in both directions.
 *
 * EVERY NUMBER HERE WAS MEASURED. They all move if `RECOVERY_DAY_GUARDRAILS`,
 * `STREAK_MILESTONE_DAYS` or `MONOTONICITY_SWEEP` move, which is the point of
 * pinning them: a retune should break this file and make somebody read the new
 * number rather than change it quietly.
 */
const MONOTONICITY_MEASUREMENT = {
  /**
   * Violating pairs at each of `MONOTONICITY_SWEEP.EXHAUSTIVE_LENGTHS`
   * (8..16 days, all 2^L calendars of each, every single-day superset of each).
   * ZERO, everywhere.
   */
  VIOLATIONS_BY_LENGTH: [0, 0, 0, 0, 0, 0, 0, 0, 0],

  /** Worst `currentStreak` deficit at each length. Zero, because there are none. */
  WORST_DEFICIT_BY_LENGTH: [0, 0, 0, 0, 0, 0, 0, 0, 0],

  /** The same for `longestStreak` — a lifter's lifetime best. */
  LONGEST_STREAK_INVERSIONS_BY_LENGTH: [0, 0, 0, 0, 0, 0, 0, 0, 0],

  /**
   * THE SAME SWEEP AGAINST THE PRE-REWORK ENGINE, so the before and after are
   * one table rather than a claim about a build nobody can run any more. Taken
   * by replaying `streakSweep.ts`'s calendars through the engine as it stood at
   * `claude/agent-config-setup-m2r6ny`, with the same comparator and the same
   * settling.
   *
   * NOTE THE COMPARATOR. These are ALL violating pairs. The figure this file
   * used to pin (`[0,0,0,1,2,3,4,5,6]`) counted only pairs where both lifters
   * spent the SAME number of Recovery Days, which is a narrower question and is
   * why its tail reads 6 where the unfiltered worst deficit is 5.
   */
  WAS_VIOLATIONS_BY_LENGTH: [0, 0, 0, 2, 10, 36, 124, 384, 1096],
  WAS_WORST_DEFICIT_BY_LENGTH: [0, 0, 0, 1, 2, 3, 4, 5, 5],
  WAS_LONGEST_STREAK_INVERSIONS_BY_LENGTH: [0, 0, 0, 0, 1, 5, 19, 66, 211],

  /**
   * NEITHER HALF OF THE FIX WORKS ALONE, at 13 days. Measured on a standalone
   * model of this engine that reproduces the before-numbers above exactly, with
   * one half of the fix switched off at a time:
   *
   *   - signup-day anchor only, doomed absences still free ....... 32 pairs
   *   - doomed absences charged only, no signup anchor ............ 24 pairs
   *   - both ..................................................... 0 pairs
   *
   * HISTORY RATHER THAN ASSERTIONS — the shipped engine cannot be run with half
   * the fix, so nothing here can check them. They are recorded because "the
   * ruled mechanism was not sufficient on its own" is the single most important
   * thing a future reader needs to know about this rework.
   */
  ANCHOR_ALONE_VIOLATIONS_AT_13: 32,
  DOOM_CHARGE_ALONE_VIOLATIONS_AT_13: 24,
} as const;

/**
 * The SAMPLED sweep — `MONOTONICITY_SWEEP.SCHEDULES_PER_SEED` calendars per
 * seed, at each of `MONOTONICITY_SWEEP.SAMPLED_LENGTHS`, against every
 * single-day superset. Forty days is a training block; sixty reaches the second
 * streak milestone.
 *
 * Rows are per seed, in `MONOTONICITY_SWEEP.SEEDS` order.
 */
const SAMPLED_MEASUREMENT = {
  /**
   * Violating pairs per seed at 40 days. WAS `[100, 148, 116, 121, 178]`, worst
   * deficits `[16, 14, 15, 15, 12]`, on 36/33/30/29/36 violating schedules.
   *
   * THE REMAINING 13 ARE A RECORDED RESIDUAL, NOT A REGRESSION THAT SLIPPED IN.
   * `RESIDUE_MEASUREMENT` below has what they are — the doomed-absence debit
   * being proportional to what the lifter holds — with the three
   * counterfactuals that pin it down and the two that refute the cause this
   * comment used to name. If this array moves, those counterfactuals are the
   * instrument for telling the known residue from something new.
   *
   * PINNED RATHER THAN BOUNDED, deliberately. `toBeLessThan(20)` would let this
   * drift back up to 19 without anybody noticing.
   */
  VIOLATING_PAIRS_AT_40: [0, 0, 0, 0, 0],
  WORST_DEFICIT_AT_40: [0, 0, 0, 0, 0],
  WAS_VIOLATING_PAIRS_AT_40: [100, 148, 116, 121, 178],
  WAS_WORST_DEFICIT_AT_40: [16, 14, 15, 15, 12],

  /**
   * Sixty days, where the residue is an order of magnitude larger than at
   * forty. NOT because a second milestone lands inside the calendar, which is
   * what this comment used to say: it is because a longer calendar gives more
   * room for a doomed absence to fall between the two lifters' banks and for
   * the difference to still be decisive on the last day. `RESIDUE_GROWTH` has
   * the trend with its denominator, which is what makes that readable.
   *
   * WAS `[203, 299, 235, 236, 296]`, worst deficits `[24, 21, 23, 25, 22]`.
   */
  VIOLATING_PAIRS_AT_60: [0, 0, 0, 0, 0],
  WORST_DEFICIT_AT_60: [0, 0, 0, 0, 0],
  WAS_VIOLATING_PAIRS_AT_60: [203, 299, 235, 236, 296],

  /**
   * THE LIFETIME BEST, AT THE SAMPLED LENGTHS — AND IT IS NOT ZERO.
   *
   * This file pins `longestStreak` inversions at zero over every exhaustive
   * calendar of 8 to 16 days, and GDD §4.4 publishes that row. Nobody had ever
   * measured the same quantity on the 40- and 60-day sweeps, which ran the
   * `currentStreak` comparison only. They are 14 and 150.
   *
   * WHY IT IS THE MORE SERIOUS HALF, said plainly. A `currentStreak` deficit
   * heals: train again and the run rebuilds. `longestStreak` is a permanent
   * record, it is what a profile displays, and — because milestones are paid
   * once per lifetime off it — a lifter whose lifetime best is inverted has
   * also lost the milestone income attached to the streak they did not get
   * credit for, permanently. `THE RESIDUE, REPRODUCED BY HAND` is exactly that
   * case, in 23 days.
   */
  LONGEST_STREAK_INVERSIONS_AT_40: [0, 0, 0, 0, 0],
  LONGEST_STREAK_INVERSIONS_AT_60: [0, 0, 0, 0, 0],

  /**
   * Pairs compared at each sampled length — the denominator the counts above
   * are counts OUT OF. Pinned because `RESIDUE_GROWTH`'s answer to "does it
   * terminate" is a comparison of rates, and a rate quoted without its
   * denominator is how a count that only grew because the sweep grew gets read
   * as a defect getting worse.
   */
  PAIRS_CHECKED_AT_40: 36_820,
  PAIRS_CHECKED_AT_60: 53_872,
} as const;

/**
 * DOES IT TERMINATE? The residue at `RESIDUE_SWEEP.LENGTHS`, so that "122 at 60
 * days" can be read as a trend rather than as a number.
 *
 * IT MATTERS MORE THAN THE COUNT AT ANY ONE LENGTH. A streak game is played for
 * years. A defect whose RATE climbs with the calendar is live at real-world
 * timescales however small it looks at sixty days; one that plateaus is bounded
 * and can be described.
 *
 * WHAT THE NUMBERS SAY. Violating pairs per seed swing wildly — a seed that
 * gives 68 at 80 days gives 26 at 100, and two seeds that give 32 and 27 at 80
 * give 0 at 100 — because a violation needs the balance difference to still be
 * decisive on the calendar's last day, and where the last day falls is
 * arbitrary. THE RATE DOES NOT CLIMB: 3.5e-4 at 40, 2.3e-3 at 60, 2.0e-3 at 80,
 * 8.1e-4 at 100. Measured by hand off the same generator at lengths this suite
 * does not pin, and recorded as unpinned observations because no test
 * re-derives them: 7.4e-4 at 150, 6.5e-4 at 200, 3.0e-4 at 300, 9.9e-5 at 400.
 *
 * THE WORST DEFICIT DOES NOT PLATEAU, and that is the part that should worry a
 * reader. It is 13 at 40 days, 25 at 80, and — unpinned, same generator — 61 at
 * 150, 86 at 200, 189 at 400, where the lazier lifter ended on 189 and the
 * lifter who trained one day more ended on 0. The FREQUENCY saturates; the
 * MAGNITUDE scales with how long the lifter has been playing, because the
 * deficit is bounded by the streak that was available to lose.
 *
 * The `longestStreak` inversion RATE is the steadier signal and it plateaus
 * too: 3.8e-4 at 40, 2.8e-3 at 60, 3.8e-3 at 80, 2.4e-3 at 100, and — unpinned
 * — 5.0e-3 at 200 and 2.3e-3 at 400.
 */
const RESIDUE_GROWTH = {
  /**
   * ALL ZERO SINCE THE ENTITLEMENT WAS WIRED IN. These arrays used to record a
   * defect growing with the calendar; they now record its absence at the same
   * lengths, measured through the same fixture. The stock's numbers are kept in
   * the doc comment above rather than deleted, because "it used to be 68 here"
   * is the only thing that makes a zero mean anything.
   */
  /** Violating pairs per seed at `RESIDUE_SWEEP.LENGTHS[0]` (80 days). */
  VIOLATING_PAIRS_AT_80: [0, 0, 0, 0, 0],
  WORST_DEFICIT_AT_80: [0, 0, 0, 0, 0],
  LONGEST_STREAK_INVERSIONS_AT_80: [0, 0, 0, 0, 0],

  /** And at `RESIDUE_SWEEP.LENGTHS[1]` (100 days). */
  VIOLATING_PAIRS_AT_100: [0, 0, 0, 0, 0],
  WORST_DEFICIT_AT_100: [0, 0, 0, 0, 0],
  LONGEST_STREAK_INVERSIONS_AT_100: [0, 0, 0, 0, 0],

  /**
   * Pairs compared at each length. Pinned because a rate is meaningless without
   * its denominator, and because the denominator grows with the calendar (a
   * longer calendar has more idle days, so more single-day supersets) — which
   * is on its own enough to make a raw count rise without anything getting
   * worse.
   */
  /** The same sweep against the Recovery Day stock, before the wiring. */
  WAS_VIOLATING_PAIRS_AT_80: [68, 0, 15, 32, 27],
  WAS_VIOLATING_PAIRS_AT_100: [26, 21, 0, 0, 27],
  WAS_LONGEST_STREAK_INVERSIONS_AT_80: [121, 24, 38, 54, 39],

  PAIRS_CHECKED_AT_80: 72_680,
  PAIRS_CHECKED_AT_100: 91_091,
} as const;

/**
 * THE RESIDUE'S CAUSE, TRACED AND THEN MEASURED — AND IT IS NOT THE ONE THIS
 * FILE USED TO NAME.
 *
 * WHAT THIS BLOCK USED TO SAY: "streak-milestone income is paid once per
 * lifetime and its arrival is timed by the streak, so the lifter who trains
 * more banks a Recovery Day earlier and loses it", supported by ONE
 * counterfactual — milestone income switched off, sweep goes to 0. That
 * counterfactual is sound and it still passes (`NO_INCOME_VIOLATING_PAIRS`
 * below). It does not support the conclusion that was drawn from it, because
 * MILESTONE INCOME IS THE ONLY INCOME THIS SWEEP HAS after the signup grant.
 * Switching it off does not switch off "income timed by the streak"; it
 * switches off income. Two further counterfactuals separate them, and both say
 * the published cause is wrong:
 *
 *   - INCOME WHOSE ARRIVAL DAY THE SCHEDULE CANNOT MOVE still violates.
 *     Milestones unreachable, one Recovery Day dropped on each of
 *     `RESIDUE_SWEEP.FIXED_INCOME_DAYS` — fixed points on the calendar both
 *     members of a pair reach identically. 81 violating pairs, worst deficit
 *     11. So streak-keyed timing is not necessary.
 *   - A STOCK THAT CAN NEVER RUN OUT still violates, and violates MORE. Topped
 *     to the hold cap every single day, so coverage can never be limited by
 *     what the lifter can afford. 194 violating pairs. So scarcity is not
 *     necessary either.
 *
 * WHAT THE TRACE SHOWS INSTEAD, and `THE RESIDUE, REPRODUCED BY HAND` below
 * pins it as a 23-day calendar rather than a story: the doomed-absence debit of
 * GDD §4.2 RULE 2 is THE WHOLE ARMED COUNT, so it is INCREASING IN HOW MUCH THE
 * LIFTER HOLDS. Training one more day makes a lifter hold MORE at a given
 * calendar day — either because the extra day spared them a save, or because it
 * carried them to a milestone sooner — so the extra day makes the next doomed
 * absence CONFISCATE MORE. The lifter who trained more comes out of it poorer
 * and dies at a later absence the lazier lifter survives.
 *
 * IT IS NOT THE FREE-ABSENCE SHAPE, and that is measurable rather than a
 * matter of taste: in 110 of the 122 pairs at 60 days the two lifters spend
 * EXACTLY THE SAME NUMBER of Recovery Days in total. No charge is created. The
 * same budget is committed at a different moment, and the doomed branch buys
 * nothing with it.
 *
 * WHY THAT MATTERS FOR THE RULING NOBODY HAS MADE YET: the two fixes GDD §4.4
 * offered the human — pay milestones off the streak, or protect income from a
 * doomed absence — are aimed at the cause this block used to name. The first is
 * measured above and does NOT close it. Bringing either one forward as "the
 * fix" would have spent a monetisation ruling on the wrong mechanism.
 */
const RESIDUE_MEASUREMENT = {
  /**
   * Violating pairs at 60 days with no income at all after the signup grant —
   * a lifter whose `longestStreak` is already past every milestone can never
   * reach one again. Zero, at every seed. This is the ONE counterfactual this
   * file used to carry, and it is kept because it is true and load-bearing: the
   * residue does need a balance that moves.
   */
  NO_INCOME_VIOLATING_PAIRS: [0, 0, 0, 0, 0],

  /**
   * The same sweep with income restored on FIXED CALENDAR DAYS — same amount,
   * arrival day identical for both members of every pair. If streak-keyed
   * timing were the cause this would be zero. It is not.
   */
  FIXED_DAY_INCOME_VIOLATING_PAIRS: [30, 2, 5, 37, 7],
  FIXED_DAY_INCOME_WORST_DEFICIT: [11, 7, 7, 7, 8],

  /**
   * The same sweep with the balance topped to the hold cap every day, so the
   * stock is inexhaustible and coverage is limited only by
   * `MAX_CONSECUTIVE_USES`. MORE violations than the shipped economy, not
   * fewer — because a lifter who is always rich always loses the maximum to a
   * doomed absence, and the extra trained day decides who is standing in one.
   *
   * The deficits are all 1 here rather than the shipped economy's 9-14: an
   * inexhaustible stock produces many small inversions where the real one
   * produces few large ones.
   */
  NEVER_EXHAUSTED_VIOLATING_PAIRS: [25, 79, 19, 51, 20],
  NEVER_EXHAUSTED_WORST_DEFICIT: [1, 1, 1, 1, 1],
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
 * WHAT THE CONSTRUCTIVE FAMILY DOES TO THE ENTITLEMENT, MEASURED — one row per
 * entry of `FAMILY_RUN_LENGTHS`, at `runRebuilt = runLost + 1`.
 *
 * THE FAMILY NO LONGER BREAKS ANYBODY, and that is a bigger change than the
 * inversion going away. It is a machine for draining a bank: it places one
 * chargeable absence immediately, one after each milestone payout, and one
 * "fatal" absence timed for the moment the lazy lifter holds exactly one
 * Recovery Day and the diligent lifter holds none. Under a stock that worked,
 * because the bank was refilled once per lifetime. Under a rolling entitlement
 * the fatal absence lands in whichever window it lands in, that window is full
 * again, and it covers BOTH lifters — so the runs run on and the final streak
 * is much longer than the rebuild the family was sized for.
 *
 * PINNED RATHER THAN DERIVED, because a derivation would restate the
 * implementation. These are what the engine returned; a retune moves them and
 * somebody has to read the new numbers.
 */
const FAMILY_MEASUREMENT = {
  /** `currentStreak` both lifters end on. Identical, which is the property. */
  FINAL_STREAK: [9, 32, 56, 94, 196, 724, 1994],
  /** Covered days each of them consumed across the whole calendar. */
  CONSUMED: [2, 3, 4, 4, 5, 5, 5],
  /**
   * WAS: the diligent lifter ended on 0 and the lazy one on `runLost`, at every
   * length — that is what "the deficit has no ceiling" meant. The whole vector
   * is equal now, on both fields and on the spend.
   */
  WAS_DILIGENT_ENDED_ON: 0,
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
      for (let balance = 0; balance <= RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW; balance += 1) {
        const state = stateWithRun(streak, DAY_ZERO, balance);
        const today = addDays(DAY_ZERO, 1);
        const trained = unwrap(recordTrainingDay(state, today)).state;

        expect(trained.currentStreak).toBe(streak + 1);
        expect(trained.currentStreak).toBeGreaterThan(state.currentStreak);
        expect(trained.longestStreak).toBeGreaterThanOrEqual(state.longestStreak);
        expect(coveredDaysLeftInWindow(trained)).toBeGreaterThanOrEqual(coveredDaysLeftInWindow(state));
        expect(coverableGapDays(trained, TODAY_FOR_READS)).toBeGreaterThanOrEqual(coverableGapDays(state, TODAY_FOR_READS));
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
    expect(coveredDaysLeftInWindow(state)).toBe(
      Math.min(
        RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW,
        RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW + STREAK_MILESTONE_DAYS.length,
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
    //
    // RUN TWICE, AT TWO PLACEMENTS ON THE WINDOW GRID, and the second placement
    // is the fix to a real defect rather than extra credit. This sweep used to
    // run once, at a signup day that put all ten calendar days inside window 0,
    // and to compare coverage on `coveredDaysLeftInWindow` — the SNAPSHOT. A
    // snapshot is stale the moment its window turns over, so that comparison is
    // only sound while no pair can straddle a boundary. It could not, at this
    // length and that anchor, so the sweep was clean for a reason that had
    // nothing to do with the property: "empirically clean at the lengths we
    // happened to test", which is the shape that hid two defects on this module
    // already. The `straddling` arm makes the boundary reachable, `withBuys`
    // puts real purchased days in the field for it to be stale ABOUT, and the
    // comparison now reads what the DAY has.
    const LENGTH = 10;
    const BOUNDARY_AT = 5;
    const placements = [
      { label: 'interior', signupDay: SIGNUP_DAY },
      // Signing up 25 days before day 0 puts the window boundary on day 5 of a
      // ten-day calendar, at the shipped `WINDOW_DAYS` of 30.
      {
        label: 'straddling',
        signupDay: asStreakDay(SIGNUP_DAY - (RECOVERY_ENTITLEMENT.WINDOW_DAYS - BOUNDARY_AT)),
      },
    ] as const;
    const noGrants = Array.from({ length: LENGTH }, () => false);
    // Two purchases inside the FIRST window, so the counter is populated before
    // any pair can cross the boundary. A sweep with nothing in the bought
    // counter cannot see a reading go stale about it.
    const withBuys = Array.from({ length: LENGTH }, (_, i) => i === 1 || i === 3);
    let casesChecked = 0;
    let straddled = 0;

    for (const placement of placements) {
      for (const buys of [noGrants, withBuys]) {
        const initial: StreakState = holding({
          ...createStreakState(placement.signupDay),
          recoveryDayProtectionEnabled: false,
          entitlementArmed: false,
        }, withCoveredDays(2, windowIndexFor(placement.signupDay, DAY_ZERO)));
        for (let mask = 0; mask < 1 << LENGTH; mask += 1) {
          const attend = Array.from({ length: LENGTH }, (_, i) => (mask & (1 << i)) !== 0);
          for (let flip = 0; flip < LENGTH; flip += 1) {
            if (attend[flip] === true) continue;
            const attendMore = attend.map((trained, i) => (i === flip ? true : trained));
            const lazy = simulate(attend, buys, initial, 'daily', true);
            const diligent = simulate(attendMore, buys, initial, 'daily', true);
            casesChecked += 1;
            if (
              lazy.state.entitlement.windowIndex !== diligent.state.entitlement.windowIndex
            ) {
              straddled += 1;
            }

            expect(diligent.state.currentStreak).toBeGreaterThanOrEqual(lazy.state.currentStreak);
            expect(diligent.state.longestStreak).toBeGreaterThanOrEqual(lazy.state.longestStreak);
            // COMPARED ON THE DAY, NOT ON THE SNAPSHOT. See `coverageAvailableOn`.
            const lastDay = addDays(DAY_ZERO, LENGTH - 1);
            expect(coverageAvailableOn(diligent.state, lastDay)).toBeGreaterThanOrEqual(
              coverageAvailableOn(lazy.state, lastDay),
            );
            expect(diligent.recoveryDaysSpent).toBe(0);
            expect(lazy.recoveryDaysSpent).toBe(0);
          }
        }
      }
    }
    expect(casesChecked).toBe(5120 * 4);
    // NOT VACUOUS: the two members of a pair really do end up snapshotted in
    // different windows in this population. Without this the `straddling` arm
    // could be a copy of the `interior` one under another name, which is
    // exactly the failure the arm was added to prevent.
    expect(straddled, 'no pair ever straddled a window boundary, so the second arm adds nothing').toBeGreaterThan(0);
  });

  it('THE STALE SNAPSHOT, PINNED: `coveredDaysLeftInWindow` inverts at a boundary and the day reading does not', () => {
    // THE DEFECT THE PURCHASES EXPOSED, as its own named case rather than as a
    // comment on the line that works around it.
    //
    // WHAT IT IS. `coveredDaysLeftInWindow(state)` reports the snapshot: what
    // was left in the window the lifter's LAST EVENT fell in. It takes no day
    // and cannot take one. So when two lifters' last events fall in different
    // windows, the two numbers are not comparable — the earlier one has not had
    // its window refreshed yet, and the later one has. Comparing them is
    // comparing a September balance against an October one.
    //
    // WHY NOTHING CAUGHT IT FOR SO LONG. Until GDD §8.3E was ruled in, nothing
    // could put a number into `purchasedDaysLeft`, and the free counter refills
    // to the same value in every window — so the stale number and the fresh one
    // were equal and the bug was invisible. A purchase makes the two windows
    // hold different amounts, and the sweep failed with "2 against 5".
    //
    // IT IS PINNED IN BOTH DIRECTIONS. The stale reading really does invert
    // (so the workaround is necessary), and the day reading really does not (so
    // the workaround is sufficient). A test that only asserted the second would
    // pass if somebody "fixed" `coveredDaysLeftInWindow` to take a day, and the
    // reader would never learn why the sweep is written the way it is.
    const WINDOW = RECOVERY_ENTITLEMENT.WINDOW_DAYS;
    const signupDay = asStreakDay(DAY_ZERO - WINDOW);
    const inFirstWindow = asStreakDay(DAY_ZERO - 1);
    const inSecondWindow = DAY_ZERO;
    expect(windowIndexFor(signupDay, inFirstWindow)).toBe(0);
    expect(windowIndexFor(signupDay, inSecondWindow)).toBe(1);

    // One lifter, three bought covered days, snapshotted at the end of window 0.
    //
    // PROTECTION DECLINED, THROUGH THE TOGGLE, so nothing is ever debited and
    // the only thing moving these numbers is the window turning over. With
    // protection ON the 29-day absence before the first session is doomed and
    // burns the window, which would make this test about the burn rule instead
    // of about the reading.
    //
    // AND THE LIFTER TRAINS THE DAY BEFORE BUYING, which is new and is the
    // doomed-sale ruling reaching this fixture. The 29-day absence from signup
    // is doomed whatever the toggle says, so the store will not sell into it —
    // one session the day before puts the buyer inside a salvageable absence
    // without changing anything the test is about. With protection declined that
    // session debits nothing, so the entitlement it arms is a full window and
    // the three bought days land on top of it exactly as before.
    const base: StreakState = setRecoveryDayProtection(createStreakState(signupDay), false).state;
    const dayBefore = addDays(inFirstWindow, -1);
    expect(windowIndexFor(signupDay, dayBefore), 'the warm-up session is in window 0').toBe(0);
    const warmedUp = unwrap(recordTrainingDay(base, dayBefore));
    expect(warmedUp.recoveryDaysLostToTheAbsence, 'protection declined: nothing was burned').toBe(0);
    const bought = unwrap(
      applySettledCoveredDayPurchase(warmedUp.state, inFirstWindow, {
        orderId: 'order-1',
        coveredDays: 3,
        tender: 'chalk-purchased',
        renderedOffer: offerAsRenderedOn(warmedUp.state, inFirstWindow),
      }),
    ).state;
    const staleInWindowZero = unwrap(recordTrainingDay(bought, inFirstWindow)).state;
    // The same lifter, one extra trained day, so their snapshot is in window 1.
    const freshInWindowOne = unwrap(recordTrainingDay(staleInWindowZero, inSecondWindow)).state;

    // THE STALE READING INVERTS. The lifter who trained MORE reads LOWER,
    // because their snapshot is a fresh window and the other's is a window with
    // three purchased days still sitting in it. Neither number is wrong; the
    // COMPARISON is, because the two are about different windows.
    expect(coveredDaysLeftInWindow(staleInWindowZero)).toBe(
      RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW + 3,
    );
    expect(coveredDaysLeftInWindow(freshInWindowOne)).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    expect(
      coveredDaysLeftInWindow(freshInWindowOne),
      'if this stops inverting the sweeps may read the snapshot again — and the comment saying why they may not is wrong',
    ).toBeLessThan(coveredDaysLeftInWindow(staleInWindowZero));

    // THE DAY READING DOES NOT. Asked what each state has available ON THE SAME
    // DAY, both refresh to the same window and the lifter who trained more is
    // never behind. This is the reading every sweep in this file uses.
    expect(coverageAvailableOn(staleInWindowZero, inSecondWindow)).toBe(
      RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW,
    );
    expect(coverageAvailableOn(freshInWindowOne, inSecondWindow)).toBe(
      RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW,
    );
    expect(coverageAvailableOn(freshInWindowOne, inSecondWindow)).toBeGreaterThanOrEqual(
      coverageAvailableOn(staleInWindowZero, inSecondWindow),
    );

    // AND THE STALENESS IS EXACTLY THE WINDOW TURNOVER, not something about
    // purchases: read on a day inside its OWN window, the snapshot agrees with
    // the day reading. So the rule is "a snapshot is comparable only to a
    // snapshot in the same window", which is what the sweeps encode.
    expect(coverageAvailableOn(staleInWindowZero, inFirstWindow)).toBe(
      coveredDaysLeftInWindow(staleInWindowZero),
    );
    expect(coverageAvailableOn(freshInWindowOne, inSecondWindow)).toBe(
      coveredDaysLeftInWindow(freshInWindowOne),
    );
  });

  it('PROPERTY, PROTECTION DECLINED: holds over long randomised histories with grants landing mid-run', () => {
    const random = mulberry32(0x5eed_1eaf);
    const initial: StreakState = holding({
      ...freshState(),
      recoveryDayProtectionEnabled: false,
      entitlementArmed: false,
    }, withCoveredDays(2));
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
      // COMPARED ON THE DAY, NOT ON THE SNAPSHOT, and the change is forced
      // rather than cosmetic. `grantOn` became a real purchase when GDD §8.3E
      // was ruled in, and with purchased days actually in the field this line
      // failed reading `coveredDaysLeftInWindow` — 2 against 5 — because a
      // snapshot is stale at a window boundary and the two lifters' last events
      // fall in different windows. That is the reading CLAUDE.md already names
      // as the one that does not balance; it went unnoticed for as long as
      // nothing could put a number in the field for it to be stale about.
      //
      // THE PROPERTY IS UNCHANGED AND IS NOT WEAKENED BY THE FIX: measured on
      // the same 400 trials, what a day HAS AVAILABLE in its window is never
      // lower for the lifter who trained more.
      const lastDay = addDays(DAY_ZERO, length - 1);
      expect(coverageAvailableOn(diligent.state, lastDay)).toBeGreaterThanOrEqual(
        coverageAvailableOn(lazy.state, lastDay),
      );
    }
    expect(casesChecked).toBeGreaterThan(350);
  });

  it('THE OLD MINIMAL CASE IS STILL FIXED: single missed days cost nothing, so they cannot invert', () => {
    // KEPT, NOT DELETED, because it is the before/after of the GDD §4.4 ruling.
    // These two eleven-day histories used to end on best streaks of 2 and 1 —
    // the player who trained MORE ending lower. With every gap here one day
    // long, the free grace covers them all and the inversion is gone.
    const initial: StreakState = holding(freshState(), withCoveredDays(2));
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
      expect(coveredDaysLeftInWindow(diligent.state)).toBe(coveredDaysLeftInWindow(lazy.state));
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
    const initial: StreakState = holding({
      ...freshState(),
      entitlementArmed: true,
    }, withCoveredDays(FAMILY_STARTING_BALANCE));
    const { lazy: lazyHistory, diligent: diligentHistory } = inversionHistories(19, 18);
    const noGrants = Array.from({ length: lazyHistory.length }, () => false);

    const lazy = simulate(lazyHistory, noGrants, initial, 'daily', true);
    const diligent = simulate(diligentHistory, noGrants, initial, 'daily', true);

    expect(trainedDayCount(lazyHistory)).toBe(37);
    expect(trainedDayCount(diligentHistory)).toBe(38);
    expect(diligentHistory.filter((trained, i) => trained !== lazyHistory[i])).toEqual([true]);

    // THE PROPERTY, FIRST AND IN ITS OWN RIGHT: one extra trained day is never
    // worse, on either field. Written as inequalities so it is the thing that
    // fails if the family starts inverting again, rather than a literal that
    // could be edited to match whatever came out.
    expect(diligent.state.currentStreak).toBeGreaterThanOrEqual(lazy.state.currentStreak);
    expect(diligent.state.longestStreak).toBeGreaterThanOrEqual(lazy.state.longestStreak);
    expect(diligent.recoveryDaysSpent).toBe(lazy.recoveryDaysSpent);

    // AND THE MEASUREMENT, so a retune has to re-read it. WAS 37 against 18.
    // Both lifters now end on the SAME streak — and it is 30 rather than 18,
    // because the fatal absence this family is built around is no longer fatal:
    // it lands in a window that has refilled, and covers both of them. See
    // `FAMILY_MEASUREMENT` for what that says about the machine.
    expect(lazy.state.currentStreak).toBe(30);
    expect(diligent.state.currentStreak).toBe(30);
    expect(lazy.state.longestStreak).toBe(30);
    expect(diligent.state.longestStreak).toBe(30);
    // NOT VACUOUS: coverage really was drawn on, by both of them.
    expect(lazy.recoveryDaysSpent).toBeGreaterThan(0);

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
    const initial: StreakState = holding({
      ...freshState(),
      entitlementArmed: true,
    }, withCoveredDays(FAMILY_STARTING_BALANCE));
    for (const [index, runLost] of FAMILY_RUN_LENGTHS.entries()) {
      const runRebuilt = runLost + 1;
      const { lazy: lazyHistory, diligent: diligentHistory } = inversionHistories(runLost, runRebuilt);
      const noGrants = Array.from({ length: lazyHistory.length }, () => false);

      const lazy = simulate(lazyHistory, noGrants, initial, 'daily', true);
      const diligent = simulate(diligentHistory, noGrants, initial, 'daily', true);

      expect(trainedDayCount(diligentHistory)).toBe(trainedDayCount(lazyHistory) + 1);
      // THE PROPERTY: level on the live streak, never behind on the lifetime
      // best, and the same spend — at one day of run and at a thousand.
      expect(diligent.state.currentStreak).toBe(lazy.state.currentStreak);
      expect(diligent.state.longestStreak).toBeGreaterThanOrEqual(lazy.state.longestStreak);
      expect(diligent.recoveryDaysSpent).toBe(lazy.recoveryDaysSpent);

      // AND THE MEASUREMENT, pinned rather than derived — see
      // `FAMILY_MEASUREMENT` for why the numbers are far above `runRebuilt`
      // now, which is what the old version of this loop asserted.
      expect(lazy.state.currentStreak).toBe(FAMILY_MEASUREMENT.FINAL_STREAK[index]);
      expect(lazy.recoveryDaysSpent).toBe(FAMILY_MEASUREMENT.CONSUMED[index]);
      expect(diligent.state.currentStreak).toBeGreaterThan(FAMILY_MEASUREMENT.WAS_DILIGENT_ENDED_ON);

      // THE BOUND THAT REPLACED "lifetime free income". Under the stock the
      // whole calendar could only ever spend the signup grant plus three
      // milestone payouts, because that was all the income there was. Under a
      // rolling entitlement the bound is a RATE: no calendar can consume more
      // than one window's entitlement per window it spans. That is the
      // "cannot be hoarded" property seen from the spending side, and it is
      // tight at the short lengths (2 of 2 at `runLost` = 8).
      const windowsSpanned = Math.ceil(lazyHistory.length / RECOVERY_ENTITLEMENT.WINDOW_DAYS);
      expect(lazy.recoveryDaysSpent).toBeLessThanOrEqual(
        windowsSpanned * RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW,
      );

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

  it('[monotonicity-exhaustive] MONOTONICITY, EXHAUSTIVE: over every calendar of 8 to 16 days, one more trained day never loses ground', () => {
    // THE MEASUREMENT THIS PIECE EXISTS FOR. The calendars come from
    // `streakSweep.ts` — all 2^L at each length, every single-day superset of
    // each — so the inputs are in the repository rather than in a helper here,
    // and both members are settled to the same final day before comparison.
    //
    // WAS `[0,0,0,2,10,36,124,384,1096]` violating pairs across these lengths,
    // worst deficit rising to 5, with the lifetime best inverted 211 times at
    // 16 days. It is now zero everywhere on all three.
    const initial = freshState();
    const violationsByLength: number[] = [];
    const worstByLength: number[] = [];
    const longestInversionsByLength: number[] = [];
    let pairsChecked = 0;
    let deadRunsSeen = 0;
    let recoveryDaysConsumed = 0;

    for (const length of MONOTONICITY_SWEEP.EXHAUSTIVE_LENGTHS) {
      const noGrants = Array.from({ length }, () => false);
      const count = exhaustiveCalendarCount(length);
      const results: SimResult[] = [];
      for (let mask = 0; mask < count; mask += 1) {
        const result = simulate(exhaustiveCalendar(mask, length), noGrants, initial, 'daily', true);
        results.push(result);
        if (result.state.currentStreak === 0) deadRunsSeen += 1;
        recoveryDaysConsumed += result.recoveryDaysSpent;
      }

      let violations = 0;
      let worst = 0;
      let longestInversions = 0;
      for (let mask = 0; mask < count; mask += 1) {
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
    // sweep in which no run ever died and no Recovery Day was ever consumed
    // would report zero violations while proving nothing at all.
    expect(pairsChecked).toBeGreaterThan(400_000);
    expect(deadRunsSeen).toBeGreaterThan(0);
    expect(recoveryDaysConsumed).toBeGreaterThan(0);

    // BOTH APP-OPENING MODELS, at the length GDD §4.4's table is written for.
    // That table has a column per model because they used to disagree (24
    // against 36); this measures the second directly rather than deriving it
    // from the purity invariant, so the published table is checked.
    const LENGTH = 13;
    const noGrants = Array.from({ length: LENGTH }, () => false);
    const onTrainingDays: SimResult[] = [];
    for (let mask = 0; mask < exhaustiveCalendarCount(LENGTH); mask += 1) {
      onTrainingDays.push(
        simulate(exhaustiveCalendar(mask, LENGTH), noGrants, initial, 'on-training-days', true),
      );
    }
    let violationsUnderTheOtherModel = 0;
    for (let mask = 0; mask < exhaustiveCalendarCount(LENGTH); mask += 1) {
      const lazy = onTrainingDays[mask] as SimResult;
      for (let flip = 0; flip < LENGTH; flip += 1) {
        if ((mask & (1 << flip)) !== 0) continue;
        const diligent = onTrainingDays[mask | (1 << flip)] as SimResult;
        if (lazy.state.currentStreak > diligent.state.currentStreak) violationsUnderTheOtherModel += 1;
      }
    }
    expect(violationsUnderTheOtherModel).toBe(0);

    // The before-numbers are a real table, not a decoration: the defect grew
    // with the calendar, and the lengths that failed are inside this sweep.
    expect(MONOTONICITY_SWEEP.EXHAUSTIVE_LENGTHS).toContain(13);
    expect(MONOTONICITY_SWEEP.EXHAUSTIVE_LENGTHS).toContain(15);
    expect(MONOTONICITY_MEASUREMENT.WAS_VIOLATIONS_BY_LENGTH.at(-1)).toBeGreaterThan(
      MONOTONICITY_MEASUREMENT.WAS_VIOLATIONS_BY_LENGTH[0] as number,
    );
  });

  it('MONOTONICITY, SAMPLED: 2000 forty-day and 2000 sixty-day calendars, every single-day superset', () => {
    // THE SWEEP THE HUMAN ASKED FOR BY NAME, because sixteen days of exhaustive
    // calendar is not a training block and forty is. The schedules come from
    // `streakSweep.ts` — five written-down seeds, 400 each, one attendance rate
    // per schedule — so every number below is re-derivable from the repository.
    //
    // BEFORE, at 40 days: [100, 148, 116, 121, 178] violating pairs by seed,
    // worst deficits [16, 14, 15, 15, 12]. AFTER: [0, 0, 11, 2, 0]. What remains
    // is the residue the next three tests characterise.
    //
    // THE LIFETIME BEST IS COUNTED HERE TOO, and it had never been. This sweep
    // compared `currentStreak` only, while the exhaustive sweep above compared
    // both — so the one row GDD §4.4 publishes as zero everywhere was only ever
    // measured on calendars of 16 days or fewer. It is not zero at 40.
    const initial = freshState();
    const measured: Record<
      number,
      { pairs: number[]; worst: number[]; longest: number[]; checked: number }
    > = {};
    let schedulesSwept = 0;
    let deadRunsSeen = 0;

    for (const length of MONOTONICITY_SWEEP.SAMPLED_LENGTHS) {
      const noGrants = Array.from({ length }, () => false);
      const pairs: number[] = [];
      const worst: number[] = [];
      const longest: number[] = [];
      let checked = 0;
      for (const seed of MONOTONICITY_SWEEP.SEEDS) {
        let violations = 0;
        let worstHere = 0;
        let longestHere = 0;
        for (const schedule of seededSchedules(seed, length)) {
          const lazy = simulate(schedule, noGrants, initial, 'daily', true);
          schedulesSwept += 1;
          if (lazy.state.currentStreak === 0) deadRunsSeen += 1;
          for (const superset of singleDaySupersets(schedule)) {
            const diligent = simulate(superset, noGrants, initial, 'daily', true);
            checked += 1;
            const deficit = lazy.state.currentStreak - diligent.state.currentStreak;
            if (deficit > 0) {
              violations += 1;
              worstHere = Math.max(worstHere, deficit);
            }
            if (diligent.state.longestStreak < lazy.state.longestStreak) longestHere += 1;
          }
        }
        pairs.push(violations);
        worst.push(worstHere);
        longest.push(longestHere);
      }
      measured[length] = { pairs, worst, longest, checked };
    }

    expect(measured[40]?.pairs).toEqual([...SAMPLED_MEASUREMENT.VIOLATING_PAIRS_AT_40]);
    expect(measured[40]?.worst).toEqual([...SAMPLED_MEASUREMENT.WORST_DEFICIT_AT_40]);
    expect(measured[60]?.pairs).toEqual([...SAMPLED_MEASUREMENT.VIOLATING_PAIRS_AT_60]);
    expect(measured[60]?.worst).toEqual([...SAMPLED_MEASUREMENT.WORST_DEFICIT_AT_60]);
    expect(measured[40]?.longest).toEqual([
      ...SAMPLED_MEASUREMENT.LONGEST_STREAK_INVERSIONS_AT_40,
    ]);
    expect(measured[60]?.longest).toEqual([
      ...SAMPLED_MEASUREMENT.LONGEST_STREAK_INVERSIONS_AT_60,
    ]);
    expect(measured[40]?.checked).toBe(SAMPLED_MEASUREMENT.PAIRS_CHECKED_AT_40);
    expect(measured[60]?.checked).toBe(SAMPLED_MEASUREMENT.PAIRS_CHECKED_AT_60);

    // ALL FIVE SEEDS ARE CLEAN AT 40 DAYS, AND NONE OF THEM WAS. This line used
    // to read "three of five", which was a true and useful sentence about the
    // stock's residue and is now just a restatement of the all-zero pin above.
    // What is NOT a restatement is the other half of the comparison: every seed
    // violated before, so the zeros are not five lucky draws.
    expect(measured[40]?.pairs.filter((n) => n === 0).length).toBe(
      MONOTONICITY_SWEEP.SEEDS.length,
    );
    const wasAt = (xs: readonly number[]): readonly number[] => xs;
    expect(wasAt(SAMPLED_MEASUREMENT.WAS_VIOLATING_PAIRS_AT_40).filter((n) => n === 0).length).toBe(0);
    expect(wasAt(SAMPLED_MEASUREMENT.WAS_VIOLATING_PAIRS_AT_60).filter((n) => n === 0).length).toBe(0);

    // AND THE MEASUREMENT REALLY SHRANK, every seed, both lengths. This is what
    // stops the pins above from being read as "some numbers".
    for (let i = 0; i < MONOTONICITY_SWEEP.SEEDS.length; i += 1) {
      expect(measured[40]?.pairs[i] as number).toBeLessThan(
        SAMPLED_MEASUREMENT.WAS_VIOLATING_PAIRS_AT_40[i] as number,
      );
      expect(measured[60]?.pairs[i] as number).toBeLessThan(
        SAMPLED_MEASUREMENT.WAS_VIOLATING_PAIRS_AT_60[i] as number,
      );
    }

    // ANTI-VACUITY: the sweep really ran, and it really reached lifters whose
    // runs died — a sweep of unbroken streaks cannot invert anything.
    expect(schedulesSwept).toBe(
      MONOTONICITY_SWEEP.SEEDS.length *
        MONOTONICITY_SWEEP.SCHEDULES_PER_SEED *
        MONOTONICITY_SWEEP.SAMPLED_LENGTHS.length,
    );
    expect(deadRunsSeen).toBeGreaterThan(0);
  });

  it('WAS "THE RESIDUE IS NOT MILESTONE TIMING": the cause is gone, so the counterfactuals cannot be run', () => {
    // WHAT THIS TEST USED TO BE, AND WHY IT COULD NOT SURVIVE INTACT. It ran
    // three counterfactuals over the same 60-day sweep — no income at all,
    // income on FIXED CALENDAR DAYS, and a stock topped to the hold cap every
    // day — to show that the residue was caused neither by the streak-keyed
    // TIMING of milestone income nor by the SCARCITY of the stock. Its results
    // were 0, 81 and 194 violating pairs, and the two non-zeros were the whole
    // point: they refuted the cause GDD §4.4 had published twice.
    //
    // ALL THREE COUNTERFACTUALS ARE VARIATIONS ON A STOCK, and GDD §4.2's
    // Option 1 ruling deleted the stock. There is no income to re-time, no hold
    // cap to top up, and — deliberately — no exported function anywhere in
    // `streak.ts` that can add coverage to a state, so the harness cannot
    // inject one either. Run against today's engine the three are literally the
    // same simulation, and a test whose three arms are one arm reports zero for
    // a reason that has nothing to do with the property.
    //
    // The findings themselves are history now and are kept as history, in
    // `RESIDUE_MEASUREMENT` above and in GDD §4.4. What is measured HERE is the
    // mechanism that replaced them, which nothing measured before: the traced
    // cause was that a doomed absence confiscated THE WHOLE ARMED HOLDING, so
    // the debit was increasing in wealth. Two things had to become true for
    // that to stop, and both are checked below over the same seeded sweep, at
    // the same length, with the same comparator.
    const LENGTH = RESIDUE_SWEEP.COUNTERFACTUAL_LENGTH;
    const noGrants = Array.from({ length: LENGTH }, () => false);
    const initial = freshState();

    let pairsChecked = 0;
    let confiscationsSeen = 0;
    let worstConfiscation = 0;
    /** Pairs whose coverage differed at some point inside a window. */
    let divergedInsideAWindow = 0;
    /** Pairs whose coverage differed at a window boundary. Must stay 0. */
    let divergedAtABoundary = 0;
    /** Pairs where the two lifters confiscated different totals. Must stay 0. */
    let unequalConfiscation = 0;
    let worstConfiscationGap = 0;

    const lastDay = addDays(DAY_ZERO, LENGTH - 1);
    expect(LENGTH).toBeGreaterThan(RECOVERY_ENTITLEMENT.WINDOW_DAYS);

    /**
     * Replays a calendar and reports the largest single confiscation, the total
     * confiscated, and what coverage the lifter would have on a given day.
     */
    const play = (
      schedule: readonly boolean[],
    ): { readonly state: StreakState; readonly confiscated: number; readonly worst: number } => {
      let state = initial;
      let confiscated = 0;
      let worst = 0;
      for (let i = 0; i < schedule.length; i += 1) {
        const day = addDays(DAY_ZERO, i);
        if (openDay(state, day).kind === 'streak-broken') {
          state = unwrap(settleBrokenStreak(state, day)).state;
        }
        if (schedule[i] !== true) continue;
        const outcome = unwrap(recordTrainingDay(state, day));
        confiscated += outcome.recoveryDaysLostToTheAbsence;
        worst = Math.max(worst, outcome.recoveryDaysLostToTheAbsence);
        state = outcome.state;
      }
      return { state, confiscated, worst };
    };

    for (const seed of MONOTONICITY_SWEEP.SEEDS) {
      for (const schedule of seededSchedules(seed, LENGTH)) {
        const lazy = play(schedule);
        for (const superset of singleDaySupersets(schedule)) {
          const diligent = play(superset);
          pairsChecked += 1;
          if (lazy.worst > 0) confiscationsSeen += 1;
          worstConfiscation = Math.max(worstConfiscation, lazy.worst, diligent.worst);
          if (lazy.confiscated !== diligent.confiscated) unequalConfiscation += 1;
          worstConfiscationGap = Math.max(worstConfiscationGap, Math.abs(lazy.confiscated - diligent.confiscated));

          // (1) THE BLAST RADIUS IS ONE WINDOW. A doomed absence still takes
          //     everything — RULE 2 survives, and dropping it measures 1051
          //     violating pairs at this very length — but "everything" is now
          //     bounded by what a window holds rather than by what a lifter has
          //     hoarded. That is the difference between the two designs stated
          //     as a number, and it is what makes the debit stop being
          //     increasing in wealth: there is no wealth.
          if (lazy.worst > RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW) {
            throw new Error(`${renderSchedule(schedule)} confiscated ${lazy.worst} in one absence`);
          }

          // (2) THE TWO RE-CONVERGE AT THE FIRST BOUNDARY PAST BOTH OF THEM.
          //     This is the sentence GDD §4.2 leans on and nothing measured it:
          //     a stock never re-converged, because the income that refilled it
          //     was paid once per lifetime, so a difference opened by one extra
          //     trained day was PERMANENT and every later doomed absence
          //     confiscated a different amount from each lifter. Inside a
          //     window the two may differ — `divergedInsideAWindow` insists
          //     that they do — and at the start of the next window that neither
          //     of their last sessions falls in, they are the same lifter
          //     again. Checked at three consecutive boundaries, because a
          //     snapshot that leaked forward would re-open at a later one.
          const laterWindow = Math.max(
            entitlementWindowFor(lazy.state, lastDay),
            entitlementWindowFor(diligent.state, lastDay),
            lazy.state.entitlement.windowIndex,
            diligent.state.entitlement.windowIndex,
          );
          for (let ahead = 1; ahead <= 3; ahead += 1) {
            const boundary = addDays(SIGNUP_DAY, (laterWindow + ahead) * RECOVERY_ENTITLEMENT.WINDOW_DAYS);
            if (coveredDaysArmed(lazy.state, boundary) !== coveredDaysArmed(diligent.state, boundary)) {
              divergedAtABoundary += 1;
            }
          }
          if (coveredDaysArmed(lazy.state, lastDay) !== coveredDaysArmed(diligent.state, lastDay)) {
            divergedInsideAWindow += 1;
          }
        }
      }
    }

    expect(divergedAtABoundary).toBe(0);

    // (3) WHAT THE EXTRA TRAINED DAY CAN STILL CHANGE, MEASURED — AND IT IS NOT
    //     ZERO. The first draft of this test asserted that the two lifters
    //     confiscate the same TOTAL across the calendar, which is what the
    //     23-day hand-built case does. It is false in general and the sweep
    //     said so: 6,462 of 53,872 pairs confiscate different totals. The extra
    //     trained day splits an absence, and a split can move which window a
    //     doomed absence resolves in.
    //
    //     WHAT IS BOUNDED IS THE SIZE OF THE DIFFERENCE. It is at most one
    //     window's entitlement, and that is the whole of the fix: under the
    //     stock the difference was whatever the lifter had accumulated and it
    //     was PERMANENT, because a confiscated milestone payout was never
    //     re-earned. Here it is bounded by a rate and erased at (2).
    expect(unequalConfiscation).toBe(6_462);
    expect(worstConfiscationGap).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    expect(worstConfiscationGap).toBeLessThanOrEqual(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);

    // ANTI-VACUITY, AND IT IS DOING MORE WORK THAN USUAL HERE, because two of
    // the three assertions above are zeros. Confiscations really happened; they
    // really were bounded by a window rather than being trivially small; and
    // the two lifters really did hold different coverage at some point inside a
    // window, which is the only thing that makes "they re-converge at the
    // boundary" a claim rather than a tautology.
    expect(pairsChecked).toBeGreaterThan(10_000);
    expect(confiscationsSeen).toBeGreaterThan(0);
    expect(worstConfiscation).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    expect(divergedInsideAWindow).toBe(1_954);

    // AND THE HISTORY IS NOT QUIETLY DELETED. The three counterfactuals'
    // results stay pinned as constants so the argument they settled can still
    // be read, and the two non-zero ones are what made them worth running.
    const asNumbers = (xs: readonly number[]): readonly number[] => xs;
    expect(asNumbers(RESIDUE_MEASUREMENT.NO_INCOME_VIOLATING_PAIRS).every((n) => n === 0)).toBe(true);
    expect(asNumbers(RESIDUE_MEASUREMENT.FIXED_DAY_INCOME_VIOLATING_PAIRS).some((n) => n > 0)).toBe(true);
    expect(asNumbers(RESIDUE_MEASUREMENT.NEVER_EXHAUSTED_VIOLATING_PAIRS).some((n) => n > 0)).toBe(true);
    // A lifter past every milestone still collects nothing and a fresh one
    // still reaches seven — the switch the first counterfactual was built on is
    // still there, it simply no longer switches any income.
    const beyondEveryMilestone: StreakState = {
      ...freshState(),
      longestStreak: Math.max(...STREAK_MILESTONE_DAYS) + 1,
    };
    expect(unwrap(recordTrainingDay(beyondEveryMilestone, DAY_ZERO)).milestonesReached).toEqual([]);
    expect(noGrants.every((granted) => !granted)).toBe(true);
  });

  it('WAS "THE RESIDUE, REPRODUCED BY HAND": the 23-day case is level on both fields', () => {
    // THE MECHANISM, AS A CALENDAR RATHER THAN AS A CAUSE. Every sweep above is
    // a count; this is the thing being counted, small enough to read, built out
    // of the named guardrails so a retune moves the calendar instead of
    // silently invalidating the case.
    //
    // WHAT IT USED TO SHOW, and it is the case the human quoted when ordering
    // the rework. The doomed-absence debit of GDD §4.2 RULE 2 is THE WHOLE
    // ARMED COUNT, so under a stock it was increasing in how much the lifter
    // held. The extra trained day carried the diligent lifter to the first
    // streak milestone, which paid a Recovery Day — so when the absence that
    // nothing can hold arrived, the diligent lifter had MORE to lose and lost
    // it. Both rebuilt to exactly the milestone, but milestones are once per
    // LIFETIME: the lazy lifter was reaching it for the first time and was
    // paid, the diligent lifter was not, and that single Recovery Day covered
    // the lazy lifter's last absence while the diligent lifter's run died.
    // TRAINING ONE MORE DAY COST SEVEN DAYS OF STREAK AND ONE DAY OF LIFETIME
    // BEST: **8 and 8 against 1 and 7**.
    //
    // WHAT IT SHOWS NOW, AND WHY THE CALENDAR IS KEPT UNCHANGED. Both lifters
    // end on **1 and 7** — the diligent lifter's old numbers, reached by both.
    // Note which way that went: the LAZY lifter lost their eight-day run,
    // rather than the diligent lifter keeping theirs. That is the entitlement
    // being stricter here, not more generous, and it is worth saying out loud
    // because "the inversion is gone" is true in two very different ways and
    // this is the less flattering one.
    //
    // THE CAUSE IS GONE TOO, AND THAT IS THE ASSERTION THAT MATTERS: the two
    // confiscations are now EQUAL. Under the stock the diligent lifter's was
    // strictly larger, because they were strictly richer when it landed. There
    // is nothing to be richer in.
    const grace = RECOVERY_DAY_GUARDRAILS.FREE_GRACE_GAP_DAYS;
    const maxUses = RECOVERY_ENTITLEMENT.MAX_COVERED_DAYS_PER_ABSENCE;
    const milestone = STREAK_MILESTONE_DAYS[0] as number;

    const lazyDays: boolean[] = [];
    const diligentDays: boolean[] = [];
    const both = (trained: boolean): void => {
      lazyDays.push(trained);
      diligentDays.push(trained);
    };
    // THE ONE EXTRA DAY, and it is the only difference between the two.
    lazyDays.push(false);
    diligentDays.push(true);
    // Enough more to put the diligent lifter exactly on the milestone and the
    // lazy lifter exactly one short of it.
    for (let i = 0; i < milestone - 1; i += 1) both(true);
    // An absence one day longer than anything can hold, so both runs die and
    // both armed banks are confiscated — by different amounts.
    for (let i = 0; i < grace + maxUses + 1; i += 1) both(false);
    // Both rebuild to exactly the milestone. Only one of them is paid for it.
    for (let i = 0; i < milestone; i += 1) both(true);
    // An absence costing exactly one Recovery Day. One of them can afford it.
    for (let i = 0; i < grace + 1; i += 1) both(false);
    both(true);

    const noGrants = lazyDays.map(() => false);
    const lazy = simulate(lazyDays, noGrants, freshState(), 'daily', true);
    const diligent = simulate(diligentDays, noGrants, freshState(), 'daily', true);

    // The two calendars differ in exactly one day, and it is a trained one.
    expect(diligentDays.length).toBe(lazyDays.length);
    expect(trainedDayCount(diligentDays)).toBe(trainedDayCount(lazyDays) + 1);
    expect(singleDaySupersets(lazyDays).map(renderSchedule)).toContain(renderSchedule(diligentDays));

    // NO INVERSION, on either field, from the extra session.
    expect(diligent.state.currentStreak).toBeGreaterThanOrEqual(lazy.state.currentStreak);
    expect(diligent.state.longestStreak).toBeGreaterThanOrEqual(lazy.state.longestStreak);
    // WAS 8 and 8 for the lazy lifter against 1 and 7 for the diligent one.
    expect(lazy.state.currentStreak).toBe(1);
    expect(diligent.state.currentStreak).toBe(1);
    expect(lazy.state.longestStreak).toBe(milestone);
    expect(diligent.state.longestStreak).toBe(milestone);

    // AND THE REASON, not just the result. Under the stock the diligent
    // lifter's confiscation was STRICTLY LARGER, because they were strictly
    // richer when it landed — that is the whole traced cause, and this line
    // used to be `toBeGreaterThan`. It is `toBe` now: the confiscation is one
    // window's entitlement for whoever is standing in the absence, and the
    // extra trained day cannot make anybody hold more of one.
    const confiscated = (days: readonly boolean[]): number => {
      let state = freshState();
      let lost = 0;
      for (let i = 0; i < days.length; i += 1) {
        const day = addDays(DAY_ZERO, i);
        if (openDay(state, day).kind === 'streak-broken') {
          state = unwrap(settleBrokenStreak(state, day)).state;
        }
        if (days[i] === true) {
          const outcome = unwrap(recordTrainingDay(state, day));
          lost += outcome.recoveryDaysLostToTheAbsence;
          state = outcome.state;
        }
      }
      return lost;
    };
    expect(confiscated(diligentDays)).toBe(confiscated(lazyDays));
    // NOT VACUOUS: a confiscation really happened, and it is bounded by one
    // window rather than by a hoard.
    expect(confiscated(lazyDays)).toBeGreaterThan(0);
    expect(confiscated(lazyDays)).toBeLessThanOrEqual(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    expect(diligent.recoveryDaysSpent).toBe(lazy.recoveryDaysSpent);

    // IT IS SHORTER THAN THE SHORTEST SWEEP THAT COULD HAVE FOUND IT. The
    // exhaustive sweep stops at 16 days for time reasons, and this needs 23 —
    // which is why a defect a new lifter could hit in their first month was
    // invisible to a proof over every calendar of 16.
    expect(lazyDays.length).toBeGreaterThan(Math.max(...MONOTONICITY_SWEEP.EXHAUSTIVE_LENGTHS));
    expect(lazyDays.length).toBeLessThan(MONOTONICITY_SWEEP.SAMPLED_LENGTHS[0] as number);
  });

  it('DOES IT TERMINATE: the residue at 80 and 100 days, with its denominator', () => {
    // 40 days gives 13 violating pairs, 60 gives 122. Read alone that is a
    // defect doubling with the calendar, which at a real player's timescale
    // would matter more than any count at one length. It is not: the count
    // includes a denominator that grows on its own, because a longer calendar
    // has more idle days and therefore more single-day supersets to compare.
    //
    // See `RESIDUE_GROWTH` for the rates, including the lengths past 100 that
    // are measured off this same generator but not pinned here because they
    // cost more suite time than they are worth.
    const initial = freshState();
    const measured: Record<
      number,
      { pairs: number[]; worst: number[]; longest: number[]; checked: number }
    > = {};

    for (const length of RESIDUE_SWEEP.LENGTHS) {
      const noGrants = Array.from({ length }, () => false);
      const pairs: number[] = [];
      const worst: number[] = [];
      const longest: number[] = [];
      let checked = 0;
      for (const seed of MONOTONICITY_SWEEP.SEEDS) {
        let violations = 0;
        let worstHere = 0;
        let longestHere = 0;
        for (const schedule of seededSchedules(seed, length)) {
          const lazy = simulate(schedule, noGrants, initial, 'daily', true);
          for (const superset of singleDaySupersets(schedule)) {
            const diligent = simulate(superset, noGrants, initial, 'daily', true);
            checked += 1;
            const deficit = lazy.state.currentStreak - diligent.state.currentStreak;
            if (deficit > 0) {
              violations += 1;
              worstHere = Math.max(worstHere, deficit);
            }
            if (diligent.state.longestStreak < lazy.state.longestStreak) longestHere += 1;
          }
        }
        pairs.push(violations);
        worst.push(worstHere);
        longest.push(longestHere);
      }
      measured[length] = { pairs, worst, longest, checked };
    }

    expect(measured[80]?.pairs).toEqual([...RESIDUE_GROWTH.VIOLATING_PAIRS_AT_80]);
    expect(measured[80]?.worst).toEqual([...RESIDUE_GROWTH.WORST_DEFICIT_AT_80]);
    expect(measured[80]?.longest).toEqual([...RESIDUE_GROWTH.LONGEST_STREAK_INVERSIONS_AT_80]);
    expect(measured[80]?.checked).toBe(RESIDUE_GROWTH.PAIRS_CHECKED_AT_80);

    expect(measured[100]?.pairs).toEqual([...RESIDUE_GROWTH.VIOLATING_PAIRS_AT_100]);
    expect(measured[100]?.worst).toEqual([...RESIDUE_GROWTH.WORST_DEFICIT_AT_100]);
    expect(measured[100]?.longest).toEqual([...RESIDUE_GROWTH.LONGEST_STREAK_INVERSIONS_AT_100]);
    expect(measured[100]?.checked).toBe(RESIDUE_GROWTH.PAIRS_CHECKED_AT_100);

    // THE ANSWER, AS AN ASSERTION RATHER THAN AS PROSE. The rate at 100 days is
    // below the rate at 60, so the defect does not grow with the calendar —
    // this is what "it terminates" means, and it is the half of the question
    // that a count at one length cannot answer.
    // THE QUESTION HAS CHANGED SHAPE. Under the stock this compared rates at
    // 60 and 100 days to establish that the defect did not grow with the
    // calendar. There is no rate to compare now — both are zero — so what is
    // asserted is the stronger thing directly: nothing at any length, on
    // either field, at any magnitude.
    const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);
    for (const length of RESIDUE_SWEEP.LENGTHS) {
      expect(sum(measured[length]?.pairs ?? [1])).toBe(0);
      expect(sum(measured[length]?.longest ?? [1])).toBe(0);
      expect(Math.max(...(measured[length]?.worst ?? [1]))).toBe(0);
    }

    // AND THE HALF THAT DOES NOT TERMINATE, pinned so it is not mistaken for
    // the good news above: the worst deficit keeps climbing, because the
    // deficit is bounded by the streak that was there to lose and that grows
    // with the calendar. 13 at 40 days, 14 at 60, 25 at 80.
    // AND THE STOCK'S NUMBERS ARE STILL HERE, as the thing the zeros are
    // zero against: 68 violating pairs at 80 days with a worst deficit of 25,
    // against 0 and 0 now.
    expect(RESIDUE_GROWTH.WAS_VIOLATING_PAIRS_AT_80.reduce<number>((a, b) => a + b, 0)).toBeGreaterThan(0);
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

    for (let balance = 0; balance <= RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW; balance += 1) {
      const initial: StreakState = holding({
        ...freshState(),
        entitlementArmed: true,
      }, withCoveredDays(balance));
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

    // ANTI-VACUITY, RE-DERIVED RATHER THAN RE-READ. This used to assert
    // `[0, 1, 2, 3, 4, 5]` — every spend up to the hold cap of five. The
    // reachable set is now decided by arithmetic and not by a hold cap: an
    // eleven-day calendar sits entirely inside window 0
    // (11 < WINDOW_DAYS), so the most any history in this sweep can consume is
    // one window's entitlement, and every count from 0 to it is reachable.
    // Written as that derivation so a retune of either constant moves it.
    expect(LENGTH).toBeLessThan(RECOVERY_ENTITLEMENT.WINDOW_DAYS);
    const reachableSpends = Array.from(
      { length: RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW + 1 },
      (_, n) => n,
    );
    expect([...spendCountsExercised].sort((a, b) => a - b)).toEqual(reachableSpends);
    expect(Math.max(...spendCountsExercised)).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);

    // PART TWO — DEPTH. A constructed history that spends exactly N Recovery
    // Days, for every N up to the hold cap, checked against every comparator who
    // trained a subset of its days. Kept because part one's calendars are short
    // and this one names the spend it is exercising.
    for (let n = 0; n <= RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW; n += 1) {
      const history: boolean[] = [];
      for (let cycle = 0; cycle < n; cycle += 1) {
        history.push(true);
        for (let idle = 0; idle < SHORTEST_PAID_GAP; idle += 1) history.push(false);
      }
      history.push(true);
      const grants = Array.from({ length: history.length }, () => false);
      const initial: StreakState = holding({
        ...freshState(),
        entitlementArmed: true,
      }, withCoveredDays(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW));
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

  it('EVERY CONSUMPTION IS REPORTED — exhaustively, both events, no silent debit anywhere', () => {
    // THE GENERAL PROPERTY, not two examples of it. GDD §4.2 promises the loss
    // is "reported, never silent"; this is what makes that a fact.
    //
    // Two things must hold on every reachable input:
    //
    //   (1) the balance never moves by more than what the outcome REPORTS, and
    //       any drop at all comes with a non-zero report;
    //   (2) the report is one KIND or the other and never both — a save is
    //       "your run held", a loss is "it did not, and here is what it cost",
    //       and a UI that confused them would tell the player the opposite of
    //       what happened.
    //
    // Driven over every 12-day calendar, day by day, at every starting balance
    // up to the hold cap, under BOTH settling behaviours: 4096 calendars x 6
    // balances x 2. Not a grid of hand-built states — a stream of states the
    // engine actually produced. The second settling behaviour is not padding:
    // settling nulls `lastTrainedDay`, so a sweep that always settles never
    // reaches a doomed absence resolved from a live run.
    const LENGTH = 12;
    let sessionsChecked = 0;
    let savesSeen = 0;
    let signupGrantExpiriesSeen = 0;
    let deadRunLossesSeen = 0;

    for (const settleOnOpen of [true, false]) {
      for (let balance = 0; balance <= RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW; balance += 1) {
        const initial: StreakState = holding({
          ...freshState(),
          entitlementArmed: true,
        }, withCoveredDays(balance));
        for (let mask = 0; mask < exhaustiveCalendarCount(LENGTH); mask += 1) {
          const schedule = exhaustiveCalendar(mask, LENGTH);
          let state = initial;
          for (let i = 0; i < LENGTH; i += 1) {
            const day = addDays(DAY_ZERO, i);
            if (settleOnOpen && openDay(state, day).kind === 'streak-broken') {
              state = unwrap(settleBrokenStreak(state, day)).state;
            }
            if (schedule[i] !== true) continue;

            const before = state;
            const outcome = unwrap(recordTrainingDay(before, day));
            const saved = outcome.recoveryDaySave?.recoveryDaysSpent ?? 0;
            const lost = outcome.recoveryDaysLostToTheAbsence;
            sessionsChecked += 1;

            // (1) NOTHING MOVES UNREPORTED. What the window holds after the
            // session is exactly what THE DAY had available, minus what was
            // reported, plus what was granted. `coverageAvailableOn` rather
            // than the snapshot or the armed count — see its comment for why
            // the other two readings do not balance.
            expect(coveredDaysLeftInWindow(outcome.state)).toBe(
              coverageAvailableOn(before, day) - (saved + lost) + outcome.recoveryDaysGranted,
            );
            if (
              coveredDaysLeftInWindow(outcome.state) - outcome.recoveryDaysGranted <
              coverageAvailableOn(before, day)
            ) {
              expect(saved + lost).toBeGreaterThan(0);
            }

            // (2) ONE KIND OR THE OTHER, NEVER BOTH, AND THE RIGHT ONE.
            expect(saved > 0 && lost > 0).toBe(false);
            expect(lost > 0).toBe(outcome.previousRunEnded && coveredDaysArmed(before, day) > 0);
            expect(saved > 0).toBe(!outcome.previousRunEnded && outcome.recoveryDaySave !== null);

            if (saved > 0) savesSeen += 1;
            if (lost > 0) {
              // THE TWO CONSUMPTION EVENTS THE HUMAN NAMED, told apart by
              // whether this lifter has ever trained. NOT by `lastTrainedDay`:
              // settling a break nulls that, so it would file every dead-run
              // loss as a signup-grant expiry and leave the other event at zero
              // — which is exactly what the first version of this test did.
              const hasEverTrained = before.longestStreak > 0;
              if (hasEverTrained) deadRunLossesSeen += 1;
              else signupGrantExpiriesSeen += 1;
            }
            state = outcome.state;
          }
        }
      }
    }

    // ANTI-VACUITY, and it is the whole reason this test counts three things.
    // "Every consumption is reported" is trivially true in a sweep with no
    // consumption in it, and the human named BOTH events, so both have to be
    // demonstrably present.
    //
    // THE SESSION COUNT IS DERIVED, NOT READ OFF A RUN. It was `> 200_000`
    // under the stock and was lowered to `> 140_000` when the balance
    // dimension shrank from 0..5 to 0..2 — a number chosen because it was under
    // what the sweep now returns, which is exactly how a threshold stops
    // checking anything. The count is exact and composable:
    //
    //   settling behaviours .................................... 2
    //   balances = COVERED_DAYS_PER_WINDOW + 1 ................. 3
    //   sessions across all 2^L calendars of L days = L x 2^(L-1)
    //     (each of the L days is trained in half of them) ...... 12 x 2048
    //                                                          ------------
    //                                            2 x 3 x 24_576 =    147_456
    const SETTLING_BEHAVIOURS = 2;
    const BALANCES_SWEPT = RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW + 1;
    const SESSIONS_PER_BALANCE = LENGTH * 2 ** (LENGTH - 1);
    expect(sessionsChecked).toBe(SETTLING_BEHAVIOURS * BALANCES_SWEPT * SESSIONS_PER_BALANCE);
    expect(savesSeen).toBeGreaterThan(0);
    expect(signupGrantExpiriesSeen).toBeGreaterThan(0);
    expect(deadRunLossesSeen).toBeGreaterThan(0);
  });

  it('A PURCHASED DAY BEING CONSUMED IS A CONSUMPTION — reported, never silent, exhaustively', () => {
    // GDD §12.3's "reported, never silent", extended to the field GDD §8.3E
    // made live. The sweep above runs at `purchasedDaysLeft: 0` in every state
    // it visits, so its balance equation has never once had to account for a
    // bought covered day leaving the window.
    //
    // THE CASE THAT ONLY EXISTS WITH PURCHASES IN THE FIELD. A COVERING absence
    // can draw at most `MAX_COVERED_DAYS_PER_ABSENCE`, which the free window
    // alone can pay at the shipped tuning — so the free and bought counters are
    // only ever spent together by a DOOMED absence, which burns everything left.
    // That is the case a player would most notice going unreported: they paid
    // for coverage, the run died anyway, and the purchase went with it.
    //
    // LENGTH 10 RATHER THAN 12, AND THAT IS A SUITE-TIME TRADE STATED RATHER
    // THAN HIDDEN. The sweep above costs about seven seconds; adding a
    // purchased-days axis to it would have doubled that. Ten days is still
    // exhaustive over its own length — every one of the 1024 calendars — and it
    // is long enough to reach a doomed absence from a live run, which the
    // counters below prove rather than assume.
    const LENGTH = 10;
    const STARTS: readonly (readonly [number, number])[] = [
      [0, 1], // nothing free, one bought — the purchase alone holds the run
      [1, 2], // both counters live, so a burn has to span them
      [RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW, 3], // a full window plus a bundle
    ];
    let sessionsChecked = 0;
    let burnsSpanningBothCounters = 0;
    let savesDrawingOnAPurchase = 0;

    for (const settleOnOpen of [true, false]) {
      for (const [free, purchased] of STARTS) {
        const initial: StreakState = holding({
          ...freshState(),
          entitlementArmed: true,
        }, { windowIndex: 0, coveredDaysLeft: free, purchasedDaysLeft: purchased });
        for (let mask = 0; mask < exhaustiveCalendarCount(LENGTH); mask += 1) {
          const schedule = exhaustiveCalendar(mask, LENGTH);
          let state = initial;
          for (let i = 0; i < LENGTH; i += 1) {
            const day = addDays(DAY_ZERO, i);
            if (settleOnOpen && openDay(state, day).kind === 'streak-broken') {
              state = unwrap(settleBrokenStreak(state, day)).state;
            }
            if (schedule[i] !== true) continue;

            const before = state;
            const purchasedBefore = before.entitlement.purchasedDaysLeft;
            const outcome = unwrap(recordTrainingDay(before, day));
            const saved = outcome.recoveryDaySave?.recoveryDaysSpent ?? 0;
            const lost = outcome.recoveryDaysLostToTheAbsence;
            sessionsChecked += 1;

            // THE SAME BALANCE EQUATION, now over a window that holds bought
            // days as well as free ones. It is stated on the SUM because that is
            // what a lifter has; the split is reported separately below.
            expect(coveredDaysLeftInWindow(outcome.state)).toBe(
              coverageAvailableOn(before, day) - (saved + lost) + outcome.recoveryDaysGranted,
            );

            // AND NO BOUGHT DAY LEAVES WITHOUT A REPORT. The purchased counter
            // can fall for exactly two reasons — it was spent, in which case the
            // outcome says so, or its window turned over, which is the calendar
            // and is announced by `expiresAfterDay` at the point of sale.
            const purchasedAfter = outcome.state.entitlement.purchasedDaysLeft;
            const windowTurned = entitlementWindowFor(before, day) > before.entitlement.windowIndex;
            if (purchasedAfter < purchasedBefore && !windowTurned) {
              expect(
                saved + lost,
                `day ${i}: purchased fell ${purchasedBefore} -> ${purchasedAfter} with nothing reported`,
              ).toBeGreaterThan(0);
              // The drop can never exceed what was reported in total.
              expect(purchasedBefore - purchasedAfter).toBeLessThanOrEqual(saved + lost);
              if (lost > 0) burnsSpanningBothCounters += 1;
              if (saved > 0) savesDrawingOnAPurchase += 1;
            }
            state = outcome.state;
          }
        }
      }
    }

    const SESSIONS_PER_START = LENGTH * 2 ** (LENGTH - 1);
    expect(sessionsChecked).toBe(2 * STARTS.length * SESSIONS_PER_START);
    // ANTI-VACUITY, and it is the reason for the `[0, 1]` starting state: with
    // nothing free in the window, a covering absence has to draw on the
    // purchase, so both consumption kinds really reach the bought counter.
    expect(burnsSpanningBothCounters, 'no doomed absence ever burned a purchased day').toBeGreaterThan(0);
    expect(savesDrawingOnAPurchase, 'no save ever drew on a purchased day').toBeGreaterThan(0);
  });

  it('EVERY PENDING CONSUMPTION IS ANNOUNCED BEFORE IT HAPPENS, on every opening kind', () => {
    // The other half of "reported, never silent": the read model a screen
    // renders has to say what the next session will cost BEFORE it costs it, or
    // the player watches a number drop for no visible reason.
    //
    // `announced` is an EXHAUSTIVE SWITCH over `DayOpening`. That is the
    // structural half of this test: a new opening kind fails to compile here
    // until somebody says what it reports, so a future screen cannot be added
    // with a silent consumption behind it.
    const announced = (opening: DayOpening): number => {
      switch (opening.kind) {
        case 'no-active-streak':
          return opening.recoveryDaysCommittedToTheAbsence;
        case 'streak-broken':
          return opening.recoveryDaysCommittedToTheAbsence;
        case 'gap-covered-by-recovery-days':
          return opening.recoveryDaysHolding;
        // Nothing is pending on these: the run is intact and the absence, if
        // there is one, is inside the free grace.
        case 'already-trained-today':
        case 'streak-alive':
        case 'gap-covered-by-grace':
          return 0;
        // Not an opening at all — clock skew or a bad caller.
        case 'day-in-past':
          return 0;
      }
    };

    const LENGTH = 12;
    let openingsChecked = 0;
    const kindsSeen = new Set<string>();
    let announcedNonZero = 0;

    for (let balance = 0; balance <= RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW; balance += 1) {
      const initial: StreakState = holding({
        ...freshState(),
        entitlementArmed: true,
      }, withCoveredDays(balance));
      for (let mask = 0; mask < exhaustiveCalendarCount(LENGTH); mask += 1) {
        const schedule = exhaustiveCalendar(mask, LENGTH);
        let state = initial;
        for (let i = 0; i < LENGTH; i += 1) {
          const day = addDays(DAY_ZERO, i);
          const opening = openDay(state, day);
          kindsSeen.add(opening.kind);
          openingsChecked += 1;

          // WHAT IS ANNOUNCED IS WHAT WILL BE TAKEN. Not an estimate, not a
          // rounded figure: the same number the session will debit.
          const willBeTaken = absenceOutcome(state, day).recoveryDaysConsumed;
          if (opening.kind !== 'day-in-past') {
            expect(announced(opening), `${opening.kind} on day ${i}`).toBe(willBeTaken);
            if (willBeTaken > 0) announcedNonZero += 1;
          }

          // ...and if the lifter does train, that is exactly what they pay.
          if (schedule[i] === true) {
            const outcome = unwrap(recordTrainingDay(state, day));
            const paid = (outcome.recoveryDaySave?.recoveryDaysSpent ?? 0) + outcome.recoveryDaysLostToTheAbsence;
            expect(paid).toBe(willBeTaken);
            state = outcome.state;
            // AND THE SCREEN AFTER THE SESSION ANNOUNCES NOTHING PENDING. This
            // re-open is what a real app does — train, then re-render — and it
            // is the only way `'already-trained-today'` is reachable at all, so
            // without it that opening kind would go unchecked.
            const afterTraining = openDay(state, day);
            kindsSeen.add(afterTraining.kind);
            openingsChecked += 1;
            expect(afterTraining.kind).toBe('already-trained-today');
            expect(announced(afterTraining)).toBe(absenceOutcome(state, day).recoveryDaysConsumed);
            expect(announced(afterTraining)).toBe(0);
          } else if (opening.kind === 'streak-broken') {
            const settled = unwrap(settleBrokenStreak(state, day));
            // The settle screen says the same number, and takes none of it.
            expect(settled.recoveryDaysCommittedToTheAbsence).toBe(willBeTaken);
            expect(settled.balanceAfter).toBe(coveredDaysLeftInWindow(state));
            state = settled.state;
          }
        }
      }
    }

    // ANTI-VACUITY: every opening kind a lifter can actually reach was seen,
    // and the announcement was non-zero often enough to be doing work.
    expect(openingsChecked).toBeGreaterThan(100_000);
    expect(kindsSeen).toEqual(
      new Set([
        'no-active-streak',
        'already-trained-today',
        'streak-alive',
        'gap-covered-by-grace',
        'gap-covered-by-recovery-days',
        'streak-broken',
      ]),
    );
    expect(announcedNonZero).toBeGreaterThan(0);
  });

  it('[training-is-the-only-debit] training debits exactly what the absence it closes consumes, and nothing else', () => {
    // The invariant that holds everywhere, restated for the charge-on-doom rule.
    // `recordTrainingDay` cannot take a Recovery Day for anything except the
    // absence it is closing, and cannot take one at all when nothing was missed.
    // What changed is the amount for a DOOMED absence: it used to be zero, and
    // it is now whatever was armed against it (§5 of `streak.ts`).
    let doomedCasesSeen = 0;
    let savedCasesSeen = 0;

    for (const streak of [0, 1, 6, 7, 29, 30, 99]) {
      for (let balance = 0; balance <= RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW; balance += 1) {
        for (const gap of [0, 1, 2, 3, 9]) {
          const base = streak === 0 ? freshState() : stateWithRun(streak, DAY_ZERO, balance);
          const state = holding({ ...base, entitlementArmed: true }, withCoveredDays(balance));
          const day = addDays(DAY_ZERO, gap + 1);
          const outcome = unwrap(recordTrainingDay(state, day));
          const saved = outcome.recoveryDaySave?.recoveryDaysSpent ?? 0;
          const lost = outcome.recoveryDaysLostToTheAbsence;

          // The absence is now anchored at the signup day even with no live run,
          // so `chargeableGapDays(gap)` is the right expectation for BOTH cases —
          // `stateWithRun` and `freshState` both anchor on `DAY_ZERO`.
          const chargeable = chargeableGapDays(gap);
          const covered = chargeable <= armedGapDays(state, TODAY_FOR_READS);
          expect(saved).toBe(covered ? chargeable : 0);
          expect(lost).toBe(covered ? 0 : Math.max(0, coveredDaysArmed(state, TODAY_FOR_READS) ?? 0));
          expect(saved + lost).toBe(absenceOutcome(state, day).recoveryDaysConsumed);
          expect(coveredDaysLeftInWindow(outcome.state)).toBe(
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
      stateWithRun(9, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW),
      stateWithRun(50, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW),
      unprotectedStateWithRun(9, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW),
    ];
    for (const state of states) {
      const before = clone(state);
      for (let offset = 0; offset < 10; offset += 1) {
        const day = addDays(DAY_ZERO, offset);
        openDay(state, day);
        absenceOutcome(state, day);
        daysMissedBefore(state, day);
      }
      coverableGapDays(state, TODAY_FOR_READS);
      armedGapDays(state, TODAY_FOR_READS);
      chargeableDaysBefore(state, addDays(DAY_ZERO, 9));
      coveredDaysLeftInWindow(state);
      streakDeadlineDay(state);
      lastDayStreakCanBeSaved(state, TODAY_FOR_READS);
      expect(state).toEqual(before);
    }
  });

  it('never mutate the state a transition is handed', () => {
    const state = stateWithRun(9, DAY_ZERO, RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
    const before = clone(state);
    recordTrainingDay(state, addDays(DAY_ZERO, 1));
    recordTrainingDay(state, dayAfterGap(DAY_ZERO, SHORTEST_PAID_GAP));
    settleBrokenStreak(state, addDays(DAY_ZERO, 9));
    setRecoveryDayProtection(state, false);
    expect(state).toEqual(before);
  });

  it('agree with each other about what an absence does, across every balance and length', () => {
    const kindsSeen = new Set<string>();
    for (let balance = 0; balance <= RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW; balance += 1) {
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
          expect(opening.recoveryDaysHolding).toBeLessThanOrEqual(armedGapDays(state, TODAY_FOR_READS));
          expect(day).toBeLessThanOrEqual(lastDayStreakCanBeSaved(state, TODAY_FOR_READS) as StreakDay);
        }
        if (gap > 0 && opening.kind === 'streak-broken') {
          expect(day).toBeGreaterThan(lastDayStreakCanBeSaved(state, TODAY_FOR_READS) as StreakDay);
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
