import { describe, expect, it } from 'vitest';

import { careerMeetFor, seasonAnchorDay } from '../career/calendar';
import { CAREER_FEDERATIONS, CAREER_TUNING, MEET_TIER_ORDER } from '../career/careerTuning';
import { meetDefinitionFor } from './careerMeet';
import { DEFAULT_MEET_RULES } from './meet';
import { meetIdFor } from './meetDay';
import { addDays } from './streak';

/**
 * A real scheduled meet for every tier, built by the calendar's own
 * constructor rather than a hand-rolled object, so these tests cannot pass
 * against a `CareerMeet` shape the calendar has stopped producing.
 */
const scheduled = MEET_TIER_ORDER.map((tier) =>
  careerMeetFor('meridian', tier, addDays(seasonAnchorDay(), CAREER_TUNING.PHASE_DAYS[tier])),
);

describe('meetDefinitionFor — the CareerMeet → MeetDefinition seam', () => {
  it('carries the id VERBATIM through to what the server will store [career-meet-id-crosses-verbatim]', () => {
    // The whole ALREADY_ENTERED wiring hangs on this identity: the banked
    // result's meetId is read by `meetIdFor` off the DEFINITION, the fold
    // turns stored meets into `enteredMeetIds`, and eligibility refuses on the
    // calendar's own id. Asserted through `meetIdFor` itself — the real
    // consumer — so a prefix, suffix or normalisation anywhere in the mapping
    // reddens here, not in a browser three layers up.
    for (const meet of scheduled) {
      expect(String(meetIdFor(meetDefinitionFor(meet)))).toBe(meet.id);
    }
  });

  it('hands every meet THE loading rules, by reference and never a copy [career-meet-rules-are-a-reference]', () => {
    // `MeetDefinition.rules` documents this constraint for `MEET_LOCAL`; the
    // adapter inherits it. `toBe`, not `toEqual`: an equal copy is exactly the
    // defect — two rule objects that can drift apart.
    for (const meet of scheduled) {
      expect(
        meetDefinitionFor(meet).rules,
        `${meet.id} carries a COPY of the loading rules — a copy can drift from the app's one set`,
      ).toBe(DEFAULT_MEET_RULES);
    }
  });

  it('fields each tier’s own NPCs, by reference to the tuning list', () => {
    for (const meet of scheduled) {
      expect(meetDefinitionFor(meet).ghostTotalsKg).toBe(CAREER_TUNING.GHOST_TOTALS_KG[meet.tier]);
      expect(meetDefinitionFor(meet).qualifyingTotalKg).toBe(
        CAREER_TUNING.QUALIFYING_TOTAL_KG[meet.tier],
      );
    }
  });

  it('holds the meet where the tier’s venue says, and prints the calendar’s own date and name', () => {
    for (const meet of scheduled) {
      const definition = meetDefinitionFor(meet);
      const venue = CAREER_TUNING.VENUES[meet.tier];
      expect(definition.town).toBe(venue.town);
      expect(definition.state).toBe(venue.state);
      expect(definition.country).toBe(venue.country);
      expect(definition.dateIso).toBe(meet.dateIso);
      expect(definition.name).toBe(meet.name);
      expect(definition.federation).toBe(meet.federationName);
    }
  });

  it('is total over every federation and tier, and two meets never share an id', () => {
    // The adapter must not carry a beta clause: locked tiers are gated one
    // place, in `careerSurface.ts`'s `enterable`, and the mapping stays total
    // so that gate is the ONLY gate. Distinct ids are what keep one entered
    // meet from marking another ALREADY_ENTERED.
    const ids = new Set<string>();
    for (const federation of CAREER_FEDERATIONS) {
      for (const tier of MEET_TIER_ORDER) {
        const meet = careerMeetFor(
          federation.id,
          tier,
          addDays(seasonAnchorDay(), CAREER_TUNING.PHASE_DAYS[tier]),
        );
        const definition = meetDefinitionFor(meet);
        expect(definition.ghostTotalsKg.length).toBeGreaterThan(0);
        ids.add(definition.id);
      }
    }
    expect(ids.size).toBe(CAREER_FEDERATIONS.length * MEET_TIER_ORDER.length);
  });
});
