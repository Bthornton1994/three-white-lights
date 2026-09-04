/**
 * lifterEntry.ts — the A2 seam from persistent identity to a Career Meet entry.
 *
 * persistent lifter profile + current federation + meet-local lot
 *   → KilogramMeetEntry
 *
 * This is the authority for a normal Career Meet. MEET_ENTRY remains the
 * explicit fixture for tests and debug preview only.
 *
 * Lot is passed in. It is never read off the profile.
 * Equipment is the federation ruleset's equipment label.
 * Division is the current accepted Open behaviour.
 */

import { LIFTER_IDENTITY } from '../career/careerTuning';
import { federationById, rulesetLabel, rulesetOf } from '../career/federation';
import type { CareerFederationId } from '../career/careerTuning';
import { CAREER_COPY } from '../career/careerTuning';
import type { KilogramMeetEntry } from './meetTuning';
import type { LifterProfile } from './lifterProfile';

export function kilogramMeetEntryFrom(
  profile: LifterProfile,
  federationId: CareerFederationId,
  lot: number,
): KilogramMeetEntry {
  const federation = federationById(federationId);
  const ruleset = rulesetOf(federation.id);
  return {
    name: profile.name,
    sex: profile.sex,
    bodyweight: profile.bodyweight,
    division: LIFTER_IDENTITY.OPEN_DIVISION,
    equipment: CAREER_COPY.EQUIPMENT_LABEL[ruleset.equipment],
    lot,
  };
}

export function federationRulesetText(federationId: CareerFederationId): string {
  return rulesetLabel(rulesetOf(federationId));
}

export function federationName(federationId: CareerFederationId): string {
  return federationById(federationId).name;
}
