/**
 * careerCalendarPlaceholder.ts — TEMPORARY SCAFFOLDING. DELETE WITH GDD §6.1.
 *
 * ===========================================================================
 * WHAT THIS IS, AND WHY IT IS NOT A FEATURE
 * ===========================================================================
 * Meet day and the daily session share one `ServerRecord` behind one port. That
 * made `MEET_ALREADY_RECORDED` reachable for the first time: `meetIdFor` reads
 * the DEFINITION's id, `MEET_LOCAL` is a single dated event, so the second meet
 * of an app run reports the id the row already carries and the server refuses
 * it. Measured on the tree this landed against: meet 1 banks 612.5 kg under
 * `local-open-2026`; meet 2 is refused with "meetServer: this lifter already has
 * a result for local-open-2026."
 *
 * THE VERDICT IS CORRECT — banking one competition twice is exactly what the
 * guard is for. What was wrong was the screen. `useMeetDay` sets `applied` only
 * on success and derives `recap` from it, so the player took nine attempts and
 * got a bare eyebrow. The beat is still `'recap'`, so the shell drew BACK TO
 * TRAINING over it and nobody was stranded — but a blank recap with a way out
 * is still a blank recap.
 *
 * THE REAL FIX IS THE CAREER CALENDAR (GDD §6.1): a meet is entered from a
 * calendar gated by qualifying totals, and a calendar knows which meets a lifter
 * has already competed at. That is a different piece of work, and inventing an
 * entry gate here would be inventing calendar authority. So this is a ruled
 * stopgap: one screen, one line, one way out, and a bound on what it may become.
 *
 * ===========================================================================
 * THE TWO-WAY PIN
 * ===========================================================================
 * `CAREER_CALENDAR_GATE` below is written into `docs/GDD.md` §6.1's TODO block
 * as well. `careerCalendarPlaceholder.test.ts` asserts it occurs in BOTH, so
 * deleting either end reddens the suite. The idiom is `realIp.ts`'s
 * `REVIEWABLE_CITATIONS`: a pinned row naming a file and what must be found in
 * it, so an inventory cannot silently stop covering the thing it names. This is
 * the same shape with two rows, not a third dialect.
 *
 * The point of the pin is FORGETTING. A placeholder nobody can find from the
 * document that owes it is a placeholder that ships.
 *
 * ===========================================================================
 * THE BOUND, AND WHY IT IS THE SHAPE IT IS
 * ===========================================================================
 * The other failure is QUIET EXPANSION: a future pass grows this into real
 * calendar logic and leaves the word "temporary" on it. The bound the test
 * enforces is structural rather than a promise —
 *
 *   THIS MODULE IMPORTS ONLY TYPES. Every `import` here is `import type`, so
 *   nothing in this file can call anything. A module that can call nothing
 *   cannot read a clock, cannot read the row, cannot read meet history and
 *   cannot schedule. That is not a rule about intent; it is a rule about what
 *   the file is capable of.
 *
 *   THE VIEW TAKES NO PROPS. `CareerCalendarPlaceholderView` is `()` — nothing
 *   can be handed to it, so no caller can feed it a date, an eligibility
 *   verdict or a meet history to render.
 *
 * `@guarantee placeholder-cannot-grow-calendar-authority`
 *
 * WHAT THE BOUND CANNOT DO, stated because a bound that implies completeness is
 * worse than a narrow one:
 *
 *   - IT DOES NOT REACH `MeetScreen.tsx`. The gate below is called from there
 *     with arguments that file computes. `hasRecap` is a `boolean` and this
 *     module cannot check where it came from. Scheduling logic written in
 *     `MeetScreen` and funnelled through that boolean is invisible here.
 *   - IT CANNOT STOP DELETION. Any test can be deleted along with the thing it
 *     guards. The pin makes that a two-file diff with this comment in it,
 *     which is the most a test can do.
 *   - IT SAYS NOTHING ABOUT WHETHER THE COPY IS TRUE. See the note on `LINE`.
 *   - COMMENTS ARE NOT CHECKED AT ALL. A comment here promising future
 *     scheduling passes, and so does a variable name that sounds like one. Only
 *     the import forms and the view's parameter list are enforced.
 */

import type { MeetServerErrorCode } from '../game/meetServer';
import type { MeetDayPhaseId } from '../game/meetDay';

/**
 * THE PIN. Occurs here and in `docs/GDD.md` §6.1, and in nothing else.
 *
 * A bare id rather than a sentence, for the reason `guaranteeTags.test.ts` gives
 * about its own ids: a description invites a second description somewhere else.
 */
export const CAREER_CALENDAR_GATE = 'career-calendar-placeholder';

/**
 * The refusal this screen exists for, named rather than inlined.
 *
 * ONLY THIS ONE. The other refusals `applyMeetResult` can return —
 * `MEET_REPLAY_REFUSED`, `MEET_INCOMPLETE`, `MEET_OVERRUN`, `MEET_ID_MISMATCH`,
 * `UNSUPPORTED_MEET_UNIT`, `MALFORMED_READING`, `BAD_DAY` — are bugs, not a
 * missing calendar, and telling a player their meet was recorded when a replay
 * was refused would be a lie. They keep the bare eyebrow they already had.
 */
export const PLACEHOLDER_REFUSAL: MeetServerErrorCode = 'MEET_ALREADY_RECORDED';

/**
 * The beat this screen may appear on. `'recap'` and nothing else, because
 * `SHELL_NAV.MEET_PHASES` draws BACK TO TRAINING over exactly that beat and the
 * way out is the shell's, not a second button of this screen's own.
 */
export const PLACEHOLDER_PHASE: MeetDayPhaseId = 'recap';

/**
 * THE COPY, VERBATIM AS RULED.
 *
 * A HUMAN RULED THIS SENTENCE AND IT IS SHIPPED UNEDITED. Recorded here because
 * it is worth a second look and not a builder's call to make: the meet the
 * player just lifted was NOT recorded — it was refused, and the result on the
 * row is the EARLIER meet's. "Meet recorded" is true of the row and arguably
 * misleading about the nine attempts the player just took. Changing it is a
 * copy decision for the human who wrote it; flagging it is this comment's job.
 */
export const CAREER_CALENDAR_PLACEHOLDER_COPY = Object.freeze({
  LINE: 'Meet recorded — Career calendar coming soon',
});

/**
 * Whether the placeholder is the screen, given what the meet loop ended up with.
 *
 * A PURE PREDICATE OVER PRIMITIVES, deliberately. It takes a phase, a boolean
 * and an error code — never the state, never the cache, never the port — so the
 * gate itself cannot become a place that reads meet history. `MeetScreen` calls
 * it and renders; it decides nothing else.
 */
export function showsCareerCalendarPlaceholder(
  phase: MeetDayPhaseId,
  hasRecap: boolean,
  refusedWith: MeetServerErrorCode | null,
): boolean {
  return phase === PLACEHOLDER_PHASE && !hasRecap && refusedWith === PLACEHOLDER_REFUSAL;
}
