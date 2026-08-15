import { describe, expect, it } from 'vitest';

import { CAREER_FEDERATIONS, MEET_TIER_ORDER, type CareerFederationId, type CareerMeetTier } from './careerTuning';
import {
  CAREER_FEDERATION_IDS,
  entryTier,
  federationById,
  federationsWithRuleset,
  isSameRuleset,
  rulesetLabel,
  rulesetOf,
  tierIndex,
  tiersLowestFirst,
} from './federation';

describe('looking a federation up', () => {
  it('lists every id in the order the picker shows them', () => {
    expect([...CAREER_FEDERATION_IDS]).toEqual(CAREER_FEDERATIONS.map((f) => f.id));
    expect(CAREER_FEDERATION_IDS).toHaveLength(4);
  });

  it('finds each one by id', () => {
    for (const federation of CAREER_FEDERATIONS) {
      expect(federationById(federation.id)).toBe(federation);
      expect(rulesetOf(federation.id)).toEqual(federation.ruleset);
    }
  });

  it('throws rather than defaulting on an id that does not exist', () => {
    // A career whose federation does not resolve has no calendar. Returning the
    // first federation instead would give that lifter somebody else's meets.
    expect(() => federationById('meridian-2' as CareerFederationId)).toThrow(RangeError);
  });
});

describe('rulesets', () => {
  it('are two axes, and both have to agree', () => {
    const raw = { equipment: 'raw', testing: 'tested' } as const;
    expect(isSameRuleset(raw, { equipment: 'raw', testing: 'tested' })).toBe(true);
    expect(isSameRuleset(raw, { equipment: 'raw', testing: 'untested' })).toBe(false);
    expect(isSameRuleset(raw, { equipment: 'equipped', testing: 'tested' })).toBe(false);
  });

  it('have exactly one federation each', () => {
    for (const federation of CAREER_FEDERATIONS) {
      expect(federationsWithRuleset(federation.ruleset)).toEqual([federation]);
    }
  });

  it('read as both axes on screen', () => {
    expect(rulesetLabel({ equipment: 'raw', testing: 'tested' })).toBe('RAW / TESTED');
    expect(rulesetLabel({ equipment: 'equipped', testing: 'untested' })).toBe('EQUIPPED / UNTESTED');
    // Four rulesets, four labels: a picker cannot show two federations under
    // one line.
    expect(new Set(CAREER_FEDERATIONS.map((f) => rulesetLabel(f.ruleset))).size).toBe(4);
  });
});

describe('the tier ladder', () => {
  it('indexes lowest first', () => {
    expect(MEET_TIER_ORDER.map((tier) => tierIndex(tier))).toEqual([0, 1, 2, 3, 4]);
    expect(tiersLowestFirst()).toEqual([...MEET_TIER_ORDER]);
  });

  it('orders the two summits by their gate and by nothing else', () => {
    // WHAT `tierIndex` DOES AND DOES NOT CLAIM once the summit is two tiers.
    // GDD §6.6 makes campaign worlds and competitive worlds two separate
    // achievements, not two rungs of one climb, so a reader is entitled to ask
    // why one has a lower index at all. The answer, from `careerTuning.ts`'s
    // tier block: the order is an order on the QUALIFYING GATE, and the ruling
    // puts the campaign gate lower.
    expect(tierIndex('campaign-worlds')).toBeLessThan(tierIndex('competitive-worlds'));
    // And it is not a prerequisite chain. The check that says so is that
    // eligibility never reads the order: a lifter carrying only a campaign
    // summit's total qualifies for neither more nor less than the same total
    // earned anywhere else, because `qualifiesFor` compares against the meet's
    // own bar. `eligibility.test.ts`'s axis A drives that over the whole
    // strength grid; here it is the ladder's own statement of it.
    expect(tiersLowestFirst().indexOf('campaign-worlds')).toBe(3);
    expect(tiersLowestFirst().indexOf('competitive-worlds')).toBe(4);
  });

  it('throws on a tier that is not on it', () => {
    expect(() => tierIndex('continental' as CareerMeetTier)).toThrow(RangeError);
  });

  it('starts at local', () => {
    expect(entryTier()).toBe('local');
    expect(tierIndex(entryTier())).toBe(0);
  });
});
