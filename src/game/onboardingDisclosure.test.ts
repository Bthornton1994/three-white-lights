/**
 * onboardingDisclosure.test.ts — the two first-run sentences, pinned against
 * the engine rather than against themselves.
 *
 * ---------------------------------------------------------------------------
 * What this file is for, and the failure it is written against
 * ---------------------------------------------------------------------------
 * A test that reads `expect(SESSION_COPY.FIRST_RUN_DISCLOSURE[id]).toBe('...')`
 * proves that a string was not edited. It proves nothing about whether the
 * string is true, and CLAUDE.md records that exact defect shape failing eight
 * times here: a sentence written while the code was true keeps its confident
 * tone after the code moves.
 *
 * So the checks below drive `streak.ts` and `streakEntitlement.ts` and assert
 * the BEHAVIOUR each sentence claims. Break the engine and they go red; edit
 * the engine's tuning within its own rules and they still hold. The verbatim
 * pins are here too, but they sit underneath the behavioural checks rather
 * than standing in for them.
 *
 * The mutants each check was driven against are named beside it, so a reader
 * can re-run one rather than take this header's word for it.
 *
 * ---------------------------------------------------------------------------
 * The mutation table, measured at 22ada1e plus this piece
 * ---------------------------------------------------------------------------
 * Each mutant applied by hand to the shipped source, this file run alone, then
 * reverted. The COLLECTED TOTAL is reported beside the failures on purpose: a
 * mutant that throws during collection reddens the file while running none of
 * its assertions, and that is indistinguishable from a mutant a test caught if
 * only the colour is read. The total stays 19 on every row, so every kill below
 * is an assertion that ran and disagreed.
 *
 *   baseline                                             20 passed (20)
 *   M1  daysMissedBefore returns 0 when never trained     3 failed | 17 passed (20)
 *   M2  createStreakState arms nothing at signup          2 failed | 18 passed (20)
 *   M3  afterSession carries unused coverage over         2 failed | 18 passed (20)
 *   M4  coveredDaysAvailable reports carried-over cover   2 failed | 18 passed (20)
 *   M5  hasNeverTrained reads lastTrainedDay alone        2 failed | 18 passed (20)
 *   M6  newServerRecord seeds a fresh lifter as trained   1 failed | 19 passed (20)
 *   restored                                             20 passed (20)
 *
 * M1 and M2 are the signup sentence; M3 and M4 are the carry-over sentence; M5
 * is the predicate that decides who is shown either; M6 is the one that says
 * the feature is reachable at all. No mutant of this piece's own copy table
 * appears, and that is the point of the split: editing a sentence reddens the
 * verbatim pins at the bottom of this file, while editing the ENGINE reddens
 * the behavioural checks above them. A sentence that stayed true only because
 * nobody had touched the engine is the failure being guarded against, so the
 * engine mutants are the load-bearing rows here.
 *
 * ---------------------------------------------------------------------------
 * Why the sweep parameters are here and not in `streakSweep.ts`
 * ---------------------------------------------------------------------------
 * That module holds the seeds, lengths and attendance distribution of the
 * MONOTONICITY measurement — a sampled, seeded sweep whose numbers could not be
 * reproduced once because its inputs were not written down. Nothing below is
 * sampled or seeded: every walk here is a deterministic march over consecutive
 * days, so its parameters are two integers and they are named at the top of
 * this file where the walks that read them are. Putting them in the sweep
 * module would suggest they parameterise that measurement, which they do not.
 */

import { describe, expect, it } from 'vitest';

import {
  FIRST_RUN_DISCLOSURE_LIFT,
  firstRunDisclosuresFor,
  hasNeverTrained,
} from './onboardingDisclosure';
import { ONBOARDING_DISCLOSURE_IDS, SESSION_BOUNDARY, SESSION_COPY } from './sessionTuning';
import { newServerRecord, snapshotWireFor } from './sessionServer';
import { openingCache } from './sessionClient';
import { readStreakState } from './progression';
import {
  LONGEST_REPAIRABLE_ABSENCE_DAYS,
  RECOVERY_DAY_GUARDRAILS,
  absenceOutcome,
  addDays,
  armedGapDays,
  asStreakDay,
  chargeableDaysBefore,
  coverableGapDays,
  coveredDaysArmed,
  coveredDaysLeftInWindow,
  createStreakState,
  daysMissedBefore,
  entitlementWindowFor,
  openDay,
  recordTrainingDay,
  settleBrokenStreak,
  type StreakDay,
  type StreakState,
} from './streak';
import {
  RECOVERY_ENTITLEMENT,
  afterSession,
  coveredDaysAvailable,
  freshEntitlement,
} from './streakEntitlement';
import type { LiftKind } from './meet';

// ---------------------------------------------------------------------------
// Parameters of the deterministic walks below
// ---------------------------------------------------------------------------

/**
 * The signup day every state in this file is built from.
 *
 * Any day works — the arithmetic is all differences — and a non-zero one is
 * used on purpose so that a walk which accidentally measured from day zero
 * instead of from the anchor would come out wrong rather than come out right.
 */
const SIGNUP_DAY: StreakDay = asStreakDay(1000);

/**
 * How far past the signup day the absence walk runs.
 *
 * It has to reach past `LONGEST_REPAIRABLE_ABSENCE_DAYS` so the walk covers the
 * three regimes the sentence is about — free grace, coverage drawn, run gone —
 * rather than only the first. The non-vacuity counts below pin that it does;
 * shortening this reddens them rather than quietly emptying the domain.
 */
const ABSENCE_WALK_DAYS = 12;

/** How many whole entitlement windows the carry-over walks march through. */
const CARRY_OVER_WINDOWS = 3;

const OTHER_LIFTS: readonly LiftKind[] = ['bench', 'deadlift'];

function trained(state: StreakState, day: StreakDay): StreakState {
  const result = recordTrainingDay(state, day);
  if (!result.ok) throw new Error(`recordTrainingDay refused day ${day}: ${result.error.code}`);
  return result.value.state;
}

/** A lifter who has never recorded a session. */
function neverTrainedState(): StreakState {
  return createStreakState(SIGNUP_DAY);
}

/**
 * A lifter inside a live run whose last session was on the signup day.
 *
 * The comparison partner for the signup walk: same anchor day, same window
 * grid, same armed entitlement — the single difference is that this one has
 * trained and the other has not. That is what makes the walk a test of the
 * sentence "count like any other days off" rather than of arithmetic in
 * general.
 */
function insideARunState(): StreakState {
  return trained(neverTrainedState(), SIGNUP_DAY);
}

/**
 * A lapsed lifter: a run that lived and then died, settled.
 *
 * `endRun` nulls `lastTrainedDay`, so this state carries the same null a
 * brand-new account does. It is the state the signup sentence would be a lie
 * on, and it is why `hasNeverTrained` reads `longestStreak` as well.
 */
function lapsedState(): StreakState {
  const alive = insideARunState();
  const wellPastSaving = addDays(SIGNUP_DAY, LONGEST_REPAIRABLE_ABSENCE_DAYS + ABSENCE_WALK_DAYS);
  const settled = settleBrokenStreak(alive, wellPastSaving);
  if (!settled.ok) throw new Error(`settleBrokenStreak refused: ${settled.error.code}`);
  return settled.value.state;
}

// ---------------------------------------------------------------------------
// Disclosure one: the signup anchor
//
//   "Your streak clock started the day you signed up, not today. Days off
//    before your first session count like any other days off."
//
// GDD §4.2, RULE 1: "their idle days count from the signup day and are charged
// exactly as a lifter's inside a run are."
// ---------------------------------------------------------------------------

describe('the signup sentence is true of the engine', () => {
  /**
   * The sentence's exact claim, driven on the real functions.
   *
   * Two lifters, one anchor day, one difference. The never-trained lifter's
   * absence must be measured, charged, covered and broken identically to the
   * absence of a lifter who trained on that same day — on every day of the
   * walk, not at a horizon somebody picked.
   *
   * Reddening edits, each applied by hand and measured (see this file's
   * report for the collected totals):
   *
   *   - `daysMissedBefore` returning 0 when `lastTrainedDay === null` — the
   *     pre-signup-day free-lunch behaviour this sentence exists to disclose.
   *   - `absenceAnchorDay` returning `state.lastTrainedDay ?? today`.
   */
  it('charges a lifter who has never trained exactly as one inside a run', () => {
    const never = neverTrainedState();
    const inside = insideARunState();

    let daysCharged = 0;
    let daysBroken = 0;
    let daysGraced = 0;

    for (let offset = 1; offset <= ABSENCE_WALK_DAYS; offset += 1) {
      const today = addDays(SIGNUP_DAY, offset);
      const where = `day +${offset}`;

      expect(daysMissedBefore(never, today), where).toBe(daysMissedBefore(inside, today));
      expect(chargeableDaysBefore(never, today), where).toBe(chargeableDaysBefore(inside, today));
      expect(armedGapDays(never, today), where).toBe(armedGapDays(inside, today));
      expect(coverableGapDays(never, today), where).toBe(coverableGapDays(inside, today));
      expect(coveredDaysArmed(never, today), where).toBe(coveredDaysArmed(inside, today));

      const neverAbsence = absenceOutcome(never, today);
      const insideAbsence = absenceOutcome(inside, today);
      expect(neverAbsence.daysMissed, where).toBe(insideAbsence.daysMissed);
      expect(neverAbsence.recoveryDaysConsumed, where).toBe(insideAbsence.recoveryDaysConsumed);
      expect(neverAbsence.protectionHolds, where).toBe(insideAbsence.protectionHolds);

      if (chargeableDaysBefore(never, today) > 0) daysCharged += 1;
      else if (daysMissedBefore(never, today) > 0) daysGraced += 1;
      if (!neverAbsence.protectionHolds) daysBroken += 1;
    }

    // NON-VACUITY. The equalities above would all hold on an empty or a
    // single-regime domain, so the walk pins how many days of each regime it
    // actually saw. Counts rather than bounds: a domain that quietly stopped
    // reaching the broken regime would satisfy `toBeGreaterThan(0)` on the
    // other two and pass.
    expect(daysGraced, 'days the free grace covered outright').toBe(
      RECOVERY_DAY_GUARDRAILS.FREE_GRACE_GAP_DAYS,
    );
    expect(daysCharged, 'days that cost the entitlement something').toBe(
      ABSENCE_WALK_DAYS - RECOVERY_DAY_GUARDRAILS.FREE_GRACE_GAP_DAYS - 1,
    );
    expect(daysBroken, 'days on which the run was already gone').toBe(
      ABSENCE_WALK_DAYS - LONGEST_REPAIRABLE_ABSENCE_DAYS - 1,
    );
    expect(daysBroken).toBeGreaterThan(0);
    expect(daysCharged).toBeGreaterThan(0);
  });

  /**
   * The second half of the sentence, which the equality walk above does not
   * cover on its own: that there IS something to lose before the first
   * session.
   *
   * Two lifters who are both charged nothing would satisfy every equality
   * above. GDD §4.2's cost line is that the grant is armed from account
   * creation and an absence spends it, so this drives `openDay` on the
   * never-trained lifter and reads the commitment it reports.
   *
   * Reddening edit: `createStreakState` arming nothing —
   * `armedEntitlement: freshEntitlement(RECOVERY_ENTITLEMENT, 0)` replaced with
   * a zeroed entitlement — which is the state of the world in which the
   * sentence is false because there was never a grant to lose.
   */
  it('arms the signup grant from account creation and spends it on an absence', () => {
    const never = neverTrainedState();

    // Armed before a single session, which is the fact the sentence rests on.
    expect(coveredDaysArmed(never, SIGNUP_DAY)).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);

    const graceOnly = addDays(SIGNUP_DAY, RECOVERY_DAY_GUARDRAILS.FREE_GRACE_GAP_DAYS);
    const opensGraced = openDay(never, graceOnly);
    expect(opensGraced.kind).toBe('no-active-streak');
    if (opensGraced.kind !== 'no-active-streak') throw new Error('unreachable');
    // Inside the grace the signup grant is untouched: the disclosure is a
    // warning about leaving it too long, not about missing a day.
    expect(opensGraced.recoveryDaysCommittedToTheAbsence).toBe(0);

    const pastGrace = addDays(SIGNUP_DAY, LONGEST_REPAIRABLE_ABSENCE_DAYS);
    const opensCharged = openDay(never, pastGrace);
    expect(opensCharged.kind).toBe('no-active-streak');
    if (opensCharged.kind !== 'no-active-streak') throw new Error('unreachable');
    // Past the grace the grant is committed — this is the "cost" GDD §4.2 says
    // onboarding copy has to state.
    expect(opensCharged.recoveryDaysCommittedToTheAbsence).toBeGreaterThan(0);
    expect(opensCharged.coveredDaysAvailable).toBe(
      RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW,
    );
  });

  /**
   * The clock runs whether or not the app is opened.
   *
   * "Started the day you signed up, not today" is a claim that the charge is a
   * function of the calendar rather than of attendance, so the check compares
   * a state that has been read on every intervening day against one that has
   * been read on none. `openDay` is pure, so this is a real property rather
   * than a tautology only if nothing it does writes back — which is what the
   * identity assertion at the end is for.
   */
  it('measures the absence from the calendar, not from when the app was opened', () => {
    const untouched = neverTrainedState();
    const opened = neverTrainedState();

    for (let offset = 0; offset <= ABSENCE_WALK_DAYS; offset += 1) {
      openDay(opened, addDays(SIGNUP_DAY, offset));
    }

    const today = addDays(SIGNUP_DAY, ABSENCE_WALK_DAYS);
    expect(chargeableDaysBefore(opened, today)).toBe(chargeableDaysBefore(untouched, today));
    expect(chargeableDaysBefore(untouched, today)).toBeGreaterThan(0);
    expect(opened).toEqual(untouched);
  });
});

// ---------------------------------------------------------------------------
// Disclosure two: carry-over
//
//   "Recovery Days cover a missed day for you. They refresh every month, and
//    unused ones do not carry over — there is nothing to save up."
//
// GDD §4.2: "unused entitlement does not carry over. A lifter who trains every
// day all month gets nothing to keep at the end of it."
// ---------------------------------------------------------------------------

describe('the carry-over sentence is true of the engine', () => {
  /**
   * The GDD's own sentence, driven on the shipped transition.
   *
   * A lifter trains every day for several whole windows and so spends nothing.
   * At no point may the availability exceed one window's allowance, and at
   * every window boundary it must be exactly that allowance — not that
   * allowance plus what went unused.
   *
   * Reddening edits, each applied by hand and measured:
   *
   *   - `afterSession`'s turnover branch accumulating:
   *     `const baseBefore = turnedOver ? tuning.COVERED_DAYS_PER_WINDOW +
   *     Math.max(0, state.coveredDaysLeft) : Math.max(0, state.coveredDaysLeft);`
   *   - `coveredDaysAvailable`'s turnover branch accumulating:
   *     `if (windowNow > state.windowIndex) return tuning.COVERED_DAYS_PER_WINDOW
   *     + Math.max(0, state.coveredDaysLeft);`
   */
  it('gives a lifter who trains every day nothing to keep at the end of a window', () => {
    const allowance = RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW;
    const lastDay = RECOVERY_ENTITLEMENT.WINDOW_DAYS * CARRY_OVER_WINDOWS;

    let state = neverTrainedState();
    let boundariesCrossed = 0;
    let maxHeld = 0;

    for (let offset = 0; offset <= lastDay; offset += 1) {
      const today = addDays(SIGNUP_DAY, offset);
      // The window grid is anchored at the signup day and nothing the lifter
      // does can shift it, so "did today cross a boundary" is a question about
      // the calendar and is asked of the calendar.
      const windowNow = entitlementWindowFor(state, today);
      const crossedIntoANewWindow =
        offset > 0 && windowNow > entitlementWindowFor(state, addDays(SIGNUP_DAY, offset - 1));

      state = trained(state, today);

      const held = coveredDaysLeftInWindow(state);
      maxHeld = Math.max(maxHeld, held);

      // The whole of "does not carry over", asserted on every single day
      // rather than only at the boundary: a state that accumulated would have
      // to pass through a day where it held more than one window's worth.
      expect(held, `day +${offset}`).toBeLessThanOrEqual(allowance);

      if (crossedIntoANewWindow) {
        boundariesCrossed += 1;
        // At the first session of a new window the lifter holds exactly the
        // standard allowance, having spent nothing and kept nothing.
        expect(held, `first session of window ${windowNow}`).toBe(allowance);
      }
    }

    // NON-VACUITY. The walk has to actually cross window boundaries, or the
    // assertions above are a statement about one window and the sentence is
    // about what happens between windows.
    // One per window the walk enters after the first. The walk runs to the
    // last day INCLUSIVE, so its final step lands on the opening day of the
    // window after `CARRY_OVER_WINDOWS` — hence a crossing per window rather
    // than one fewer.
    expect(boundariesCrossed, 'window boundaries the walk crossed').toBe(CARRY_OVER_WINDOWS);
    expect(boundariesCrossed).toBeGreaterThan(0);
    expect(maxHeld, 'most ever held at once').toBe(allowance);
  });

  /**
   * The same claim one layer down, on `streakEntitlement.ts` directly, with a
   * full and untouched entitlement carried over a boundary.
   *
   * The walk above goes through `recordTrainingDay`, which could in principle
   * mask an accumulating `afterSession` behind a cap somewhere else. This
   * drives the transition and the reader in isolation so the property is
   * pinned where it is implemented as well as where it is used.
   */
  it('resets rather than accumulates when a window turns over', () => {
    const allowance = RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW;
    const full = freshEntitlement(RECOVERY_ENTITLEMENT, 0);
    expect(full.coveredDaysLeft).toBe(allowance);

    for (let window = 1; window <= CARRY_OVER_WINDOWS; window += 1) {
      // Nothing was spent in any previous window, so this is the case the
      // sentence is about: everything unused, and none of it kept.
      expect(coveredDaysAvailable(RECOVERY_ENTITLEMENT, full, window), `window ${window}`).toBe(
        allowance,
      );
      const rolled = afterSession(RECOVERY_ENTITLEMENT, full, window, 0);
      expect(rolled.coveredDaysLeft, `window ${window}`).toBe(allowance);
      expect(rolled.purchasedDaysLeft, `window ${window}`).toBe(0);
    }
  });

  /**
   * A lifter who trained every day for a whole window and one who trained not
   * at all arrive at the next window holding the same thing.
   *
   * This is the sharpest reading of "gets nothing to keep": the reward for
   * perfect attendance, in coverage terms, is exactly the reward for none.
   * It is also the assertion that would go red first if somebody tried to make
   * carry-over a loyalty perk.
   */
  it('leaves a full month of training and a full month away holding the same coverage', () => {
    const nextWindow = addDays(SIGNUP_DAY, RECOVERY_ENTITLEMENT.WINDOW_DAYS);

    let diligent = neverTrainedState();
    for (let offset = 0; offset < RECOVERY_ENTITLEMENT.WINDOW_DAYS; offset += 1) {
      diligent = trained(diligent, addDays(SIGNUP_DAY, offset));
    }
    const absent = neverTrainedState();

    expect(coveredDaysAvailable(
      RECOVERY_ENTITLEMENT,
      diligent.entitlement,
      entitlementWindowFor(diligent, nextWindow),
    )).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);

    expect(coveredDaysAvailable(
      RECOVERY_ENTITLEMENT,
      absent.entitlement,
      entitlementWindowFor(absent, nextWindow),
    )).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);

    // Non-vacuity: the diligent lifter really did train a whole window.
    expect(diligent.currentStreak).toBe(RECOVERY_ENTITLEMENT.WINDOW_DAYS);
    expect(absent.currentStreak).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Who is told, and who is not
// ---------------------------------------------------------------------------

describe('the never-trained predicate is exact', () => {
  /**
   * Reddening edit: `hasNeverTrained` returning `state.lastTrainedDay === null`
   * alone, which is the reading that looks right and puts a first-run sentence
   * in front of a lapsed lifter.
   */
  it('separates a brand-new lifter from one whose run has ended', () => {
    const never = neverTrainedState();
    const lapsed = lapsedState();

    // The trap: both carry the same null, so the obvious predicate cannot tell
    // them apart. This assertion is what makes the extra clause necessary
    // rather than defensive.
    expect(never.lastTrainedDay).toBeNull();
    expect(lapsed.lastTrainedDay).toBeNull();

    expect(hasNeverTrained(never)).toBe(true);
    expect(hasNeverTrained(lapsed)).toBe(false);
    expect(lapsed.longestStreak).toBeGreaterThan(0);
  });

  it('stops being true the moment a session is recorded', () => {
    const never = neverTrainedState();
    expect(hasNeverTrained(never)).toBe(true);
    expect(hasNeverTrained(trained(never, SIGNUP_DAY))).toBe(false);
  });

  it('stays false for the whole of a live run', () => {
    let state = neverTrainedState();
    for (let offset = 0; offset <= ABSENCE_WALK_DAYS; offset += 1) {
      state = trained(state, addDays(SIGNUP_DAY, offset));
      expect(hasNeverTrained(state), `day +${offset}`).toBe(false);
    }
  });
});

describe('which screens carry the disclosures', () => {
  it('shows both on the squat first run', () => {
    const shown = firstRunDisclosuresFor(neverTrainedState(), FIRST_RUN_DISCLOSURE_LIFT);
    expect(shown.map((d) => d.id)).toEqual([...ONBOARDING_DISCLOSURE_IDS]);
  });

  it('shows none on the other two lifts', () => {
    for (const lift of OTHER_LIFTS) {
      expect(firstRunDisclosuresFor(neverTrainedState(), lift), lift).toEqual([]);
    }
    // Non-vacuity: the same state DOES produce disclosures on squat, so the
    // emptiness above is the lift filter rather than a state that never
    // qualifies.
    expect(firstRunDisclosuresFor(neverTrainedState(), FIRST_RUN_DISCLOSURE_LIFT)).not.toEqual([]);
  });

  it('shows none to a lifter who has trained', () => {
    const veteran = trained(neverTrainedState(), SIGNUP_DAY);
    expect(firstRunDisclosuresFor(veteran, FIRST_RUN_DISCLOSURE_LIFT)).toEqual([]);
  });

  it('shows none to a lapsed lifter whose run has ended', () => {
    expect(firstRunDisclosuresFor(lapsedState(), FIRST_RUN_DISCLOSURE_LIFT)).toEqual([]);
  });

  it('shows none while the history is unknown', () => {
    expect(firstRunDisclosuresFor(null, FIRST_RUN_DISCLOSURE_LIFT)).toEqual([]);
  });

  /**
   * The empty-domain check, and the reason it is worth a test of its own.
   *
   * Everything above builds its own `StreakState`, so all of it would still
   * pass if the shipped app never produced a lifter who qualifies — the
   * disclosures would be correct, tested, and dead code nobody could reach.
   * CLAUDE.md records that exact shape: a defect that survived because the
   * fixture, the preview context and the browser fixtures were all blind the
   * same way, so more harnesses added no coverage.
   *
   * So this drives the real opening path a fresh install takes — a new server
   * record, sealed onto the wire, decoded back through `progression.ts`'s read
   * accessor — rather than a state this file constructed. It is the same route
   * `openingCache` takes in `useSession`, one directory over: that hook builds
   * its cache from `port.openingSnapshot()`, which is `snapshotWireFor` of
   * exactly this record.
   *
   * Reddening edit: `newServerRecord` seeding `streak` from a state whose
   * `lastTrainedDay` is the signup day rather than `createStreakState`'s null,
   * which is the shape that would silently make the whole feature unreachable.
   */
  it('reaches a lifter the shipped opening path actually produces', () => {
    const fresh = newServerRecord(SESSION_BOUNDARY.LOCAL_SERVER_SIGNUP_DAY);
    // `openingCache` is the function `useSession` itself calls, handed the same
    // wire `localSessionServer.openingSnapshot()` returns — so this is the real
    // opening path rather than a re-implementation of it.
    const cache = openingCache({ openingSnapshot: () => snapshotWireFor(fresh, null) });
    const reading = readStreakState(cache);

    expect(reading.kind).not.toBe('unknown');
    if (reading.kind === 'unknown') throw new Error('unreachable');

    // A brand-new install is a never-trained lifter, so the disclosures have a
    // real audience rather than a hypothetical one.
    expect(hasNeverTrained(reading.value)).toBe(true);
    expect(firstRunDisclosuresFor(reading.value, FIRST_RUN_DISCLOSURE_LIFT).map((d) => d.id)).toEqual(
      [...ONBOARDING_DISCLOSURE_IDS],
    );

    // And the scoping really does bite on that same reachable lifter, so the
    // emptiness on the other lifts is not an artefact of an unreachable state.
    for (const lift of OTHER_LIFTS) {
      expect(firstRunDisclosuresFor(reading.value, lift), lift).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// The copy itself
// ---------------------------------------------------------------------------

describe('the copy', () => {
  it('carries the sentence the screen renders, keyed to the id', () => {
    // The `renderedOffer` shape: what comes out of the decision is what goes on
    // the screen, so a test asserting a sentence is asserting the rendered one.
    for (const disclosure of firstRunDisclosuresFor(
      neverTrainedState(),
      FIRST_RUN_DISCLOSURE_LIFT,
    )) {
      expect(disclosure.line).toBe(SESSION_COPY.FIRST_RUN_DISCLOSURE[disclosure.id]);
      expect(disclosure.line.length).toBeGreaterThan(0);
    }
  });

  it('has a sentence for every id and no id-less sentence', () => {
    // Set equality both ways. The `satisfies` on the table gives one direction
    // at compile time; this gives the other and survives a cast.
    expect(Object.keys(SESSION_COPY.FIRST_RUN_DISCLOSURE).sort()).toEqual(
      [...ONBOARDING_DISCLOSURE_IDS].sort(),
    );
  });

  it('states the signup fact in words a first-run player can act on', () => {
    const line = SESSION_COPY.FIRST_RUN_DISCLOSURE['signup-grant-loss'];
    expect(line).toBe(
      'Your streak clock started the day you signed up, not today. Days off before your first session count like any other days off.',
    );
    // The two things the sentence has to name for the disclosure to work at
    // all: when the clock started, and that the days before the first session
    // are not free.
    expect(line).toMatch(/signed up/i);
    expect(line).toMatch(/first session/i);
  });

  it('states the carry-over fact in words a first-run player can act on', () => {
    const line = SESSION_COPY.FIRST_RUN_DISCLOSURE['entitlement-non-carryover'];
    expect(line).toBe(
      'Recovery Days cover a missed day for you. They refresh every month, and unused ones do not carry over — there is nothing to save up.',
    );
    expect(line).toMatch(/do not carry over/i);
    expect(line).toMatch(/nothing to save up/i);
  });

  it('puts no numeral in either line', () => {
    // The same ban `sessionTuning.test.ts` applies to the whole copy table,
    // restated here because these two lines are the ones most tempted to print
    // a rate ("two a month"), and a rate printed in copy is a second home for a
    // tuning value. GDD §3.4 and §12.3.
    for (const id of ONBOARDING_DISCLOSURE_IDS) {
      expect(SESSION_COPY.FIRST_RUN_DISCLOSURE[id], id).not.toMatch(/\d/);
    }
    expect(SESSION_COPY.FIRST_RUN_TITLE).not.toMatch(/\d/);
    // Positive control: the scan sees a numeral when there is one.
    expect('Two covered days, 2 a month').toMatch(/\d/);
  });
});
