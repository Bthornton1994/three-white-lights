/**
 * careerMeet.ts — the `CareerMeet → MeetDefinition` seam (Sprint 1c).
 *
 * `src/career/calendar.ts` schedules meets and says so in its own header: its
 * `CareerMeet` carries what a calendar needs — federation, tier, date, gate —
 * and deliberately not what a meet needs to be RUN. `meetTuning.ts`'s
 * `MeetDefinition` is the runnable shape: loading rules, a ghost field, a
 * venue. This module is the one place the two meet, which is exactly where
 * `calendar.ts` said the decision of "where a scheduled meet is held" belongs.
 *
 * THE ID CROSSES VERBATIM, AND THAT IDENTITY IS THE CALENDAR'S MEMORY. The
 * definition's `id` becomes `MeetResultReport.meetId` when the meet banks
 * (`meetDay.ts`'s `meetIdFor` reads it), the server stores it on the row,
 * `careerServer.ts`'s fold turns the stored meets into `enteredMeetIds`, and
 * `eligibility.ts` refuses re-entry on exactly that list. So a played calendar
 * meet marks itself ALREADY_ENTERED with no second bookkeeping path — but only
 * while this mapping never invents, prefixes or normalises the id. The test
 * beside this file asserts the round trip through `meetIdFor` itself, not
 * through a copy of it. `@guarantee career-meet-id-crosses-verbatim`
 *
 * THE RULES ARE A REFERENCE, NEVER A COPY — the same constraint
 * `MeetDefinition.rules` documents for `MEET_LOCAL`: one `MeetLoadingRules`
 * object in the app, so two parts of a meet can never disagree about what a
 * legal bar weight is. `@guarantee career-meet-rules-are-a-reference`
 *
 * Everything tunable here lives in `CAREER_TUNING` (ghost fields, venues);
 * this module holds no numbers of its own and decides nothing a screen could
 * disagree with — it is a projection, and `careerMeet.test.ts` pins it as one.
 */

import type { CareerMeet } from '../career/calendar';
import { CAREER_TUNING } from '../career/careerTuning';
import { DEFAULT_MEET_RULES } from './meet';
import type { MeetDefinition } from './meetTuning';

/** The runnable meet a scheduled one becomes when the player enters it. */
export function meetDefinitionFor(meet: CareerMeet): MeetDefinition {
  const venue = CAREER_TUNING.VENUES[meet.tier];
  return {
    id: meet.id,
    federation: meet.federationName,
    name: meet.name,
    dateIso: meet.dateIso,
    town: venue.town,
    state: venue.state,
    country: venue.country,
    rules: DEFAULT_MEET_RULES,
    ghostTotalsKg: CAREER_TUNING.GHOST_TOTALS_KG[meet.tier],
  };
}
