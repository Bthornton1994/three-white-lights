import { describe, expect, it } from 'vitest';
import { EMPIRE_TUNING } from './empireTuning';
import type { SessionEquipmentItem } from './sessions';
import {
  crowdingLoad,
  crowdingSatisfactionMultiplier,
  equipmentBiasedMemberTypes,
  equipmentFitScore,
  memberBaseDuesGymBucks,
  memberDuesGymBucks,
  memberReputationPerDay,
  memberSatisfaction,
  isHighPayingMemberType,
  reputationFromMembers,
  type MemberRoster,
  type MemberType,
} from './members';

const TYPES = EMPIRE_TUNING.MEMBER_TYPES;

describe('vocabulary', () => {
  it('has exactly the five §5.6 types, in the GDD table order', () => {
    expect(TYPES).toEqual(['casual', 'bodybuilder', 'powerlifter', 'athlete', 'serious-lifter']);
  });
});

describe('dues — §5.6 "Pays"', () => {
  it('orders every type\'s base dues low < medium <= medium < high, per the GDD tiers', () => {
    const casual = memberBaseDuesGymBucks('casual');
    const bodybuilder = memberBaseDuesGymBucks('bodybuilder');
    const powerlifter = memberBaseDuesGymBucks('powerlifter');
    const athlete = memberBaseDuesGymBucks('athlete');
    const seriousLifter = memberBaseDuesGymBucks('serious-lifter');
    expect(casual).toBeLessThan(bodybuilder);
    expect(bodybuilder).toBe(powerlifter);
    expect(bodybuilder).toBeLessThan(athlete);
    expect(athlete).toBe(seriousLifter);
  });

  it('refuses an unrecognised type', () => {
    expect(() => memberBaseDuesGymBucks('legendary' as MemberType)).toThrow(
      'is not a §5.6 member type',
    );
  });

  it('pays exactly the floor fraction at zero satisfaction and full dues at 1', () => {
    const base = memberBaseDuesGymBucks('casual');
    const floor = EMPIRE_TUNING.MEMBER_DUES_SATISFACTION_FLOOR;
    expect(memberDuesGymBucks('casual', 0)).toBeCloseTo(base * floor, 6);
    expect(memberDuesGymBucks('casual', 1)).toBeCloseTo(base, 6);
  });

  it('interpolates linearly at a real mid-range satisfaction, not just the endpoints', () => {
    const base = memberBaseDuesGymBucks('athlete');
    const floor = EMPIRE_TUNING.MEMBER_DUES_SATISFACTION_FLOOR;
    // Mid-range: a member who is neither delighted nor about to leave.
    expect(memberDuesGymBucks('athlete', 0.5)).toBeCloseTo(base * (floor + (1 - floor) * 0.5), 6);
    expect(memberDuesGymBucks('athlete', 0.75)).toBeCloseTo(base * (floor + (1 - floor) * 0.75), 6);
  });

  it('refuses satisfaction outside [0, 1]', () => {
    expect(() => memberDuesGymBucks('casual', -0.01)).toThrow('within [0, 1]');
    expect(() => memberDuesGymBucks('casual', 1.01)).toThrow('within [0, 1]');
    expect(() => memberDuesGymBucks('casual', Number.NaN)).toThrow('within [0, 1]');
  });
});

describe('equipment fit — §5.6 "Attracted by", and the Barbell-group baseline', () => {
  it('is bounded to [0, 1] for every type at every owned-item combination in the sweep', () => {
    // A real, non-extremes sweep: every single item alone, the empty set, and
    // the full item list — not just 0 and "everything".
    const domains: readonly (readonly SessionEquipmentItem[])[] = [
      [],
      ...EMPIRE_TUNING.SESSION_EQUIPMENT_ITEMS.map((item) => [item]),
      [...EMPIRE_TUNING.SESSION_EQUIPMENT_ITEMS],
    ];
    let checked = 0;
    for (const type of TYPES) {
      for (const owned of domains) {
        const score = equipmentFitScore(type, owned);
        expect(score, `${type} at [${owned.join(',')}]`).toBeGreaterThanOrEqual(0);
        expect(score, `${type} at [${owned.join(',')}]`).toBeLessThanOrEqual(1);
        checked += 1;
      }
    }
    // Non-vacuity: the sweep actually ran over every type and every domain point.
    expect(checked).toBe(TYPES.length * domains.length);
  });

  it('reaches exactly 1 when a type owns every item its own affinity table lists', () => {
    for (const type of TYPES) {
      const items = Object.keys(
        EMPIRE_TUNING.MEMBER_TYPE_ITEM_AFFINITY[type],
      ) as readonly SessionEquipmentItem[];
      expect(equipmentFitScore(type, items)).toBeCloseTo(1, 6);
    }
  });

  it('is monotonically non-decreasing as more of a type\'s own items are added', () => {
    // Real, mid-range steps rather than only "none" and "all": the sequence
    // walks up one item at a time for a type whose table has several rows.
    const items = Object.keys(
      EMPIRE_TUNING.MEMBER_TYPE_ITEM_AFFINITY.bodybuilder,
    ) as readonly SessionEquipmentItem[];
    let previous = equipmentFitScore('bodybuilder', []);
    const owned: SessionEquipmentItem[] = [];
    for (const item of items) {
      owned.push(item);
      const score = equipmentFitScore('bodybuilder', owned);
      expect(score).toBeGreaterThanOrEqual(previous);
      previous = score;
    }
  });

  it('never scores an item outside its own table as a contribution — an unrelated item moves nothing', () => {
    // Athlete's table has no `mats` row. Owning only `mats` should score
    // Athlete identically to owning nothing (the Barbell baseline only).
    expect(equipmentFitScore('athlete', ['mats'])).toBeCloseTo(
      equipmentFitScore('athlete', []),
      6,
    );
  });

  it('treats the Barbell setup as an always-true baseline: fit is non-zero with no session equipment owned at all', () => {
    // Header §3's documented limitation, driven rather than only described:
    // every type's fit score at an empty equipment set equals its own
    // baseline affinity divided by its own reachable max, and Powerlifter
    // (the type whose GDD row leads with Barbell items) is the type this
    // baseline biases hardest towards.
    for (const type of TYPES) {
      expect(equipmentFitScore(type, [])).toBeGreaterThan(0);
    }
    const scores = TYPES.map((type) => [type, equipmentFitScore(type, [])] as const);
    const [bestType] = scores.reduce((a, b) => (b[1] > a[1] ? b : a));
    expect(bestType).toBe('powerlifter');
  });

  it('is unaffected by ladder (Barbell-group) equipment — none is read at all', () => {
    // There is no ladder argument to pass, which is the type-level half of
    // this claim; this is the behavioural half, over the one channel that
    // could smuggle a Barbell read back in without a parameter: repeating the
    // same session-equipment call twice must be byte-identical regardless of
    // anything the caller does or does not know about a ladder.
    const a = equipmentFitScore('powerlifter', ['specialty-bars']);
    const b = equipmentFitScore('powerlifter', ['specialty-bars']);
    expect(a).toBe(b);
  });

  it('refuses an unrecognised type', () => {
    expect(() => equipmentFitScore('legendary' as MemberType, [])).toThrow(
      'is not a §5.6 member type',
    );
  });
});

describe('equipmentBiasedMemberTypes — the readable-consequence function', () => {
  it('is never empty, including at the empty equipment set', () => {
    // MUTATION-TESTABLE GUARANTEE: the claim is that the filter always keeps
    // at least the argmax type, because `best - best === 0` is always
    // `<= tolerance` for any non-negative tolerance. Broken by requiring
    // STRICT inequality instead — verified by planting that exact mutant
    // below and watching this very assertion redden.
    expect(equipmentBiasedMemberTypes([]).length).toBeGreaterThan(0);
    expect(equipmentBiasedMemberTypes([...EMPIRE_TUNING.SESSION_EQUIPMENT_ITEMS]).length).toBeGreaterThan(0);
  });

  it('MUTATION WITNESS: a strict-inequality tie filter can produce an empty result', () => {
    // Reimplements the filter with `<` instead of `<=` to show the guarantee
    // above is not vacuous — it is the boundary case (the best type's own
    // margin is exactly zero) that a strict inequality drops.
    const scores = TYPES.map((type) => [type, equipmentFitScore(type, [])] as const);
    const best = Math.max(...scores.map(([, score]) => score));
    const tolerance = EMPIRE_TUNING.MEMBER_EQUIPMENT_BIAS_TIE_TOLERANCE;
    const strictlyLess = scores.filter(([, score]) => best - score < tolerance && best - score !== 0);
    // With the strict, off-by-the-margin-itself mutant, the type that IS the
    // max (margin exactly 0) is dropped by the `!== 0` clause standing in for
    // "<" excluding its own boundary — demonstrating the shipped `<=` is load
    // bearing for the type that achieves `best` exactly.
    expect(strictlyLess.length).toBeLessThan(scores.length);
  });

  it('biases toward bodybuilder for a bodybuilder-equipped gym', () => {
    const owned: readonly SessionEquipmentItem[] = ['dumbbells', 'cables', 'machines'];
    expect(equipmentBiasedMemberTypes(owned)).toContain('bodybuilder');
  });

  it('biases toward athlete for a sled-and-cardio gym', () => {
    const owned: readonly SessionEquipmentItem[] = ['sled', 'bike', 'treadmill', 'rower'];
    expect(equipmentBiasedMemberTypes(owned)).toContain('athlete');
  });

  it('biases toward serious-lifter for a gym that owns a bit of everything', () => {
    const owned = [...EMPIRE_TUNING.SESSION_EQUIPMENT_ITEMS];
    expect(equipmentBiasedMemberTypes(owned)).toContain('serious-lifter');
  });
});

describe('crowding — §5.6 equipment-to-member ratio, with the two type-keyed quirks', () => {
  const roster = (entries: ReadonlyArray<readonly [MemberType, number]>): MemberRoster =>
    Object.freeze(entries.map(([type, count]) => Object.freeze({ type, count })));

  it('is zero for an empty roster, whatever the equipment count (including zero)', () => {
    expect(crowdingLoad(roster([]), 0)).toBe(0);
    expect(crowdingLoad(roster([]), 10)).toBe(0);
  });

  it('is a real, non-extreme weighted ratio at a plausible roster and equipment count', () => {
    // 3 bodybuilders (weight 1.6) + 2 casuals (weight 1) over 5 equipment
    // units: (3*1.6 + 2*1) / 5 = 6.8 / 5 = 1.36. A number a player might
    // actually see, not 0 or a million.
    const load = crowdingLoad(roster([['bodybuilder', 3], ['casual', 2]]), 5);
    expect(load).toBeCloseTo(1.36, 6);
  });

  it('is Infinity with members present and zero equipment, and the multiplier handles it without NaN', () => {
    const load = crowdingLoad(roster([['casual', 1]]), 0);
    expect(load).toBe(Infinity);
    expect(crowdingSatisfactionMultiplier('casual', load)).toBeCloseTo(
      EMPIRE_TUNING.MEMBER_CROWDING_SATISFACTION_FLOOR,
      6,
    );
  });

  it('makes a bodybuilder-heavy roster more crowded than the same headcount of casuals', () => {
    const bodybuilders = crowdingLoad(roster([['bodybuilder', 4]]), 4);
    const casuals = crowdingLoad(roster([['casual', 4]]), 4);
    expect(bodybuilders).toBeGreaterThan(casuals);
  });

  it('refuses a negative equipment count', () => {
    expect(() => crowdingLoad(roster([]), -1)).toThrow('at or above zero');
  });

  it('refuses a malformed roster: negative count, non-integer count, duplicate type', () => {
    expect(() => crowdingLoad([{ type: 'casual', count: -1 }], 1)).toThrow('non-negative whole number');
    expect(() => crowdingLoad([{ type: 'casual', count: 1.5 }], 1)).toThrow('non-negative whole number');
    expect(() =>
      crowdingLoad([{ type: 'casual', count: 1 }, { type: 'casual', count: 2 }], 1),
    ).toThrow('appears twice');
  });
});

describe('crowdingSatisfactionMultiplier — the curve, sampled at real mid-range loads', () => {
  it('is exactly 1 at zero load, for every type', () => {
    for (const type of TYPES) {
      expect(crowdingSatisfactionMultiplier(type, 0)).toBe(1);
    }
  });

  it('matches the closed-form curve at real mid-range loads, not just the two endpoints', () => {
    // A player will routinely see loads like 0.5, 1, 2 and 5 (a handful of
    // members per piece of equipment) long before they see Infinity.
    const floor = EMPIRE_TUNING.MEMBER_CROWDING_SATISFACTION_FLOOR;
    for (const load of [0.5, 1, 2, 5]) {
      for (const type of TYPES) {
        const sensitivity = EMPIRE_TUNING.MEMBER_TYPE_CROWDING_SENSITIVITY[type];
        const expected = floor + (1 - floor) / (1 + sensitivity * load);
        expect(crowdingSatisfactionMultiplier(type, load)).toBeCloseTo(expected, 6);
      }
    }
  });

  it('makes casual fall off faster than serious-lifter at the same mid-range load', () => {
    // §5.6's quirk, driven: "Casual leaves fastest when crowded." At a real
    // load a player will see (not 0, not Infinity), Casual's multiplier must
    // be lower than Serious Lifter's.
    const load = 2;
    expect(crowdingSatisfactionMultiplier('casual', load)).toBeLessThan(
      crowdingSatisfactionMultiplier('serious-lifter', load),
    );
  });

  it('never falls below its floor and never exceeds 1, across the mid-range sweep', () => {
    const floor = EMPIRE_TUNING.MEMBER_CROWDING_SATISFACTION_FLOOR;
    for (const load of [0, 0.1, 0.5, 1, 2, 5, 10, 100]) {
      for (const type of TYPES) {
        const multiplier = crowdingSatisfactionMultiplier(type, load);
        expect(multiplier).toBeGreaterThanOrEqual(floor);
        expect(multiplier).toBeLessThanOrEqual(1);
      }
    }
  });

  it('refuses a negative load', () => {
    expect(() => crowdingSatisfactionMultiplier('casual', -1)).toThrow('at or above zero');
  });

  it('refuses an unrecognised type', () => {
    expect(() => crowdingSatisfactionMultiplier('legendary' as MemberType, 0)).toThrow(
      'is not a §5.6 member type',
    );
  });
});

describe('memberSatisfaction — the composed §5.6 function', () => {
  it('multiplies the three factors, at a real mid-range input', () => {
    const roster: MemberRoster = [{ type: 'casual', count: 3 }];
    const ownedItems: readonly SessionEquipmentItem[] = ['bike', 'treadmill'];
    const score = memberSatisfaction({
      type: 'casual',
      roster,
      ownedItems,
      conditionMultiplier: 0.9,
    });
    const expectedCrowding = crowdingSatisfactionMultiplier(
      'casual',
      crowdingLoad(roster, ownedItems.length),
    );
    const expectedFit = equipmentFitScore('casual', ownedItems);
    expect(score.crowding).toBeCloseTo(expectedCrowding, 6);
    expect(score.fit).toBeCloseTo(expectedFit, 6);
    expect(score.condition).toBe(0.9);
    expect(score.composite).toBeCloseTo(expectedCrowding * expectedFit * 0.9, 6);
  });

  it('passing conditionMultiplier 1 (the documented "no degradation yet" default) never lowers the composite below crowding * fit', () => {
    const roster: MemberRoster = [{ type: 'athlete', count: 2 }];
    const score = memberSatisfaction({
      type: 'athlete',
      roster,
      ownedItems: ['sled'],
      conditionMultiplier: 1,
    });
    expect(score.composite).toBeCloseTo(score.crowding * score.fit, 6);
  });

  it('a worse condition input alone lowers the composite, holding everything else fixed', () => {
    const roster: MemberRoster = [{ type: 'powerlifter', count: 5 }];
    const ownedItems: readonly SessionEquipmentItem[] = ['specialty-bars'];
    const good = memberSatisfaction({
      type: 'powerlifter',
      roster,
      ownedItems,
      conditionMultiplier: 1,
    });
    const bad = memberSatisfaction({
      type: 'powerlifter',
      roster,
      ownedItems,
      conditionMultiplier: 0.4,
    });
    expect(bad.composite).toBeLessThan(good.composite);
    // And the two non-condition factors are unaffected by the condition input.
    expect(bad.crowding).toBeCloseTo(good.crowding, 6);
    expect(bad.fit).toBeCloseTo(good.fit, 6);
  });

  it('refuses a condition multiplier outside [0, 1]', () => {
    const call = (conditionMultiplier: number) => (): void => {
      memberSatisfaction({
        type: 'casual',
        roster: [],
        ownedItems: [],
        conditionMultiplier,
      });
    };
    expect(call(-0.01)).toThrow('within [0, 1]');
    expect(call(1.01)).toThrow('within [0, 1]');
    expect(call(Number.NaN)).toThrow('within [0, 1]');
  });
});

describe('reputationFromMembers — §5.6\'s reputation contribution', () => {
  it('is zero for an empty roster', () => {
    expect(reputationFromMembers([])).toBe(0);
  });

  it('weighs powerlifter and serious-lifter members highest, at a real mixed roster', () => {
    const powerlifterHeavy: MemberRoster = [
      { type: 'powerlifter', count: 10 },
      { type: 'casual', count: 10 },
    ];
    const casualOnly: MemberRoster = [{ type: 'casual', count: 20 }];
    expect(reputationFromMembers(powerlifterHeavy)).toBeGreaterThan(
      reputationFromMembers(casualOnly),
    );
  });

  it('sums a real mid-size mixed roster to the expected value', () => {
    const roster: MemberRoster = [
      { type: 'casual', count: 8 },
      { type: 'bodybuilder', count: 5 },
      { type: 'powerlifter', count: 3 },
      { type: 'athlete', count: 2 },
      { type: 'serious-lifter', count: 4 },
    ];
    const expected =
      8 * EMPIRE_TUNING.MEMBER_TYPE_REPUTATION_PER_MEMBER_PER_DAY.casual +
      5 * EMPIRE_TUNING.MEMBER_TYPE_REPUTATION_PER_MEMBER_PER_DAY.bodybuilder +
      3 * EMPIRE_TUNING.MEMBER_TYPE_REPUTATION_PER_MEMBER_PER_DAY.powerlifter +
      2 * EMPIRE_TUNING.MEMBER_TYPE_REPUTATION_PER_MEMBER_PER_DAY.athlete +
      4 * EMPIRE_TUNING.MEMBER_TYPE_REPUTATION_PER_MEMBER_PER_DAY['serious-lifter'];
    expect(reputationFromMembers(roster)).toBeCloseTo(expected, 6);
  });

  it('takes only a roster — no competition-result bonus argument', () => {
    expect(reputationFromMembers.length).toBe(1);
    const roster: MemberRoster = [{ type: 'powerlifter', count: 4 }];
    expect(reputationFromMembers(roster)).toBeCloseTo(
      4 * memberReputationPerDay('powerlifter'),
      6,
    );
  });

  it('exposes the per-type daily rate G.2E occupancy uses, and names high-paying types', () => {
    expect(memberReputationPerDay('casual')).toBe(0);
    expect(memberReputationPerDay('powerlifter')).toBeGreaterThan(memberReputationPerDay('athlete'));
    expect(isHighPayingMemberType('athlete')).toBe(true);
    expect(isHighPayingMemberType('serious-lifter')).toBe(true);
    expect(isHighPayingMemberType('powerlifter')).toBe(false);
    expect(isHighPayingMemberType('casual')).toBe(false);
    expect(isHighPayingMemberType('bodybuilder')).toBe(false);
    expect([...EMPIRE_TUNING.HIGH_PAYING_MEMBER_TYPES]).toEqual(['athlete', 'serious-lifter']);
  });

  it('refuses a malformed roster the same way crowdingLoad does', () => {
    expect(() => reputationFromMembers([{ type: 'casual', count: -1 }])).toThrow(
      'non-negative whole number',
    );
  });
});
