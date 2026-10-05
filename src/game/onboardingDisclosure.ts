/**
 * onboardingDisclosure.ts — the two things a lifter is told before their first
 * session, and the rule for when to tell them (GDD §4.2).
 *
 * ---------------------------------------------------------------------------
 * What this is, and the much larger thing it is not
 * ---------------------------------------------------------------------------
 * It is two sentences attached to a screen that already exists. There is no
 * tutorial here, no flow, no carousel and no step sequence, and adding one is
 * a separate design question that GDD §10.0's beta scope has not answered.
 * Bench and deadlift are out of it too: the disclosures are scoped to the
 * squat first run by `FIRST_RUN_DISCLOSURE_LIFT`, and widening that is an edit
 * somebody makes deliberately rather than a default that spreads.
 *
 * ---------------------------------------------------------------------------
 * Why it exists at all, given that the engine is already right
 * ---------------------------------------------------------------------------
 * Both facts below are implemented, correct, and measured. Neither is spoken.
 * A player therefore meets each of them the same way — by losing something and
 * working out afterwards what happened — and the GDD names that as the defect
 * in its own words, twice:
 *
 *   - §4.2's no-free-absences ruling, on the signup anchor: "a lifter who
 *     creates an account and does not train for longer than the §4.2 ceiling
 *     loses the signup grant to that absence. Onboarding copy has to say so."
 *   - §4.2's rolling-entitlement ruling, on carry-over: "The cost, stated
 *     rather than discovered: unused entitlement does not carry over... store
 *     and onboarding copy have to say it plainly."
 *
 * ---------------------------------------------------------------------------
 * Where the copy appears, and that this was a judgement call
 * ---------------------------------------------------------------------------
 * The GDD asks for onboarding copy and does not say which screen carries it.
 * The screen chosen is the readiness check-in, below its three question rows,
 * on the squat first run. The reasoning, recorded so it can be argued with:
 *
 *   1. It is the one screen a first-run player is certain to reach. The
 *      briefing sits behind three taps and the close-out behind a whole
 *      session, so a player who opens the app, reads nothing and leaves — the
 *      exact player the signup disclosure is about — never sees either.
 *   2. The signup fact is only useful before the gap opens. Said on the
 *      close-out it is a report on something the player can no longer change,
 *      because `recordTrainingDay` has already moved the anchor off the signup
 *      day by then.
 *   3. `SessionScreen.tsx`'s own header holds this screen to GDD §12.2's
 *      time-to-first-input bar: "no splash, no home screen, no start-session
 *      button". Text set below the questions costs no tap and no navigation,
 *      so it spends none of that budget. A separate screen in front would.
 *
 * ---------------------------------------------------------------------------
 * The predicate for "has never trained", which is the subtle part
 * ---------------------------------------------------------------------------
 * `lastTrainedDay === null` looks like the test for a lifter with no history
 * and is not one. `streak.ts`'s `endRun` nulls that field when a run dies, so
 * a lapsed lifter returning after a long absence carries exactly the same null
 * as somebody who has never trained a day. Telling that returning lifter "days
 * off before your first session count" is a false sentence on their screen,
 * which is the failure this piece is written against rather than an edge case
 * of it.
 *
 * `longestStreak` is what separates them, and it separates them exactly.
 * `recordTrainingDay` writes `Math.max(base.longestStreak, streakAfter)` where
 * `streakAfter` is at least one, and `endRun` leaves the field alone. So a
 * non-zero `longestStreak` means a session was recorded at some point, and a
 * zero one means none ever was. `onboardingDisclosure.test.ts` drives both
 * transitions rather than taking that from the two comments above.
 *
 * Purity: zero React, zero I/O, zero side effects.
 */

import {
  ONBOARDING_DISCLOSURE_IDS,
  SESSION_COPY,
  type OnboardingDisclosureId,
} from './sessionTuning';
import type { StreakState } from './streak';
import type { LiftKind } from './meet';

/**
 * The lift whose first run carries the disclosures.
 *
 * Squat, because it is the lift the rotation opens on and the one the training
 * feel was built and re-tested against. Bench and deadlift are deliberately
 * out: a three-lift onboarding is a design question nobody has answered, and
 * building one now would teach squat and then be rewritten once the other two
 * are on device.
 */
export const FIRST_RUN_DISCLOSURE_LIFT: LiftKind = 'squat';

/** One disclosure, with the sentence that goes on the screen beside its id. */
export interface OnboardingDisclosure {
  readonly id: OnboardingDisclosureId;
  /**
   * The rendered sentence, carried rather than looked up again downstream.
   *
   * Same shape and same reason as `SettledCoveredDayPurchase.renderedOffer`:
   * the words travel with the decision, so what a test asserts is the sentence
   * the screen was handed. A screen that re-derived the line from the id could
   * render one sentence while a test asserted another and both would pass.
   */
  readonly line: string;
}

/**
 * Whether this lifter has ever recorded a training day.
 *
 * See the header for why this reads `longestStreak` and not `lastTrainedDay`:
 * a run that has ended nulls the trained day, so the trained day alone reports
 * a lapsed lifter as a brand-new one.
 */
export function hasNeverTrained(state: StreakState): boolean {
  return state.lastTrainedDay === null && state.longestStreak === 0;
}

/**
 * The disclosures a given screen shows: both of them on the squat first run,
 * and none anywhere else.
 *
 * `streak` is nullable because the client may render before a snapshot has
 * landed, and an unknown history is treated as "say nothing" rather than as a
 * first run. Guessing the other way would put a first-run sentence in front of
 * a lifter mid-career every time a read was slow, which is the same false
 * sentence the header is about, arriving by a different route.
 */
export function firstRunDisclosuresFor(
  streak: StreakState | null,
  lift: LiftKind,
): readonly OnboardingDisclosure[] {
  if (streak === null) return [];
  if (lift !== FIRST_RUN_DISCLOSURE_LIFT) return [];
  if (!hasNeverTrained(streak)) return [];
  return ONBOARDING_DISCLOSURE_IDS.map((id) => ({
    id,
    line: SESSION_COPY.FIRST_RUN_DISCLOSURE[id],
  }));
}
