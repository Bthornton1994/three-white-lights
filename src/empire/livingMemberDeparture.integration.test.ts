/**
 * livingMemberDeparture.integration.test.ts — Stage G.2C2 causal-chain
 * departure execution, identity continuity, FloorSim reconciliation, and
 * relocation after an interior leave.
 */

import { describe, expect, it } from 'vitest';

import { EMPIRE_TUNING } from './empireTuning';
import { createFloorState } from './floor';
import {
  createFloorSimState,
  reconcileFloorSimPopulation,
  runFloorSim,
  stepFloorSimWithObservations,
  type FloorSimContext,
  type FloorSimServiceObservation,
} from './floorSim';
import type { LadderRung } from './ladder';
import { createGymViewState, gymViewReduce } from './ladderView';
import { lastLivingMemberDeparture, playerFacingDepartureLine } from './livingMemberDeparture';
import { livingMemberExperience } from './livingMemberExperience';
import { livingMemberRetentionPressure } from './livingMemberRetention';
import { livingMemberStayEvidence } from './livingMemberStay';
import {
  advanceLivingMemberTenure,
  applyServiceObservations,
  createLivingMemberRoster,
  departedMemberById,
  deriveMemberId,
  floorSimPopulationFromRoster,
  livingMemberById,
  LIVING_MEMBER_GIVEN_NAMES,
  memberOrdinalFromId,
  reconcileLivingMemberRosterOnRelocation,
  type GymMemberId,
  type LivingGymMember,
  type LivingMemberRoster,
} from './livingMembers';
import type { MemberType } from './members';
import { stockStationCapability } from './stationCapability';

const T = EMPIRE_TUNING;
const KIT = Object.freeze([...T.LADDER_STARTING_EQUIPMENT]);
const NEXT_RUNG = T.LADDER_RUNGS[1] as LadderRung;

function opening(): LivingMemberRoster {
  return createLivingMemberRoster('garage', KIT, Object.freeze([]), 0, T.FLOOR_SIM_RENDER_SEED);
}

function requireMember(roster: LivingMemberRoster, index: number): LivingGymMember {
  const member = roster.members[index];
  if (member === undefined) throw new Error(`opening roster has no member ${index}`);
  return member;
}

function observation(
  member: LivingGymMember,
  tick: number,
  facts: Partial<FloorSimServiceObservation> = {},
): FloorSimServiceObservation {
  return Object.freeze({
    memberId: member.id,
    memberIndex: 0,
    memberType: member.type,
    stationKind: 'training',
    stationKey: 'training:competition-bench-bay',
    queueWaitTicks: 200,
    trainingExperience: T.STATION_STOCK_TRAINING_EXPERIENCE,
    outcome: 'interrupted',
    observedAtTick: tick,
    ...facts,
  });
}

function adverse(member: LivingGymMember, tick: number): FloorSimServiceObservation {
  return observation(member, tick);
}

function stable(member: LivingGymMember, tick: number): FloorSimServiceObservation {
  return observation(member, tick, {
    queueWaitTicks: 0,
    trainingExperience: T.STATION_QUALITY_TRAINING_EXPERIENCE,
    outcome: 'completed',
  });
}

function watchingWait(member: LivingGymMember, tick: number): FloorSimServiceObservation {
  return observation(member, tick, {
    queueWaitTicks: 128,
    trainingExperience: T.STATION_STOCK_TRAINING_EXPERIENCE,
    outcome: 'completed',
  });
}

function watchingNoWait(member: LivingGymMember, tick: number): FloorSimServiceObservation {
  return observation(member, tick, {
    queueWaitTicks: 20,
    trainingExperience: T.STATION_STOCK_TRAINING_EXPERIENCE,
    outcome: 'completed',
  });
}

function strained(member: LivingGymMember, tick: number): FloorSimServiceObservation {
  return observation(member, tick, {
    queueWaitTicks: 180,
    trainingExperience: T.STATION_STOCK_TRAINING_EXPERIENCE,
    outcome: 'completed',
  });
}

function applyAll(
  roster: LivingMemberRoster,
  member: LivingGymMember,
  count: number,
  factory: (member: LivingGymMember, tick: number) => FloorSimServiceObservation,
  firstTick: number = 1,
): LivingMemberRoster {
  let next = roster;
  for (let offset = 0; offset < count; offset += 1) {
    const current = livingMemberById(next, member.id) ?? member;
    next = applyServiceObservations(next, [factory(current, firstTick + offset)]);
  }
  return next;
}

function withType(roster: LivingMemberRoster, index: number, type: MemberType): LivingMemberRoster {
  return Object.freeze({
    ...roster,
    members: Object.freeze(
      roster.members.map((member, memberIndex) =>
        memberIndex === index ? Object.freeze({ ...member, type }) : member,
      ),
    ),
  });
}

function contextWithRoster(roster: LivingMemberRoster): FloorSimContext {
  return Object.freeze({
    rung: roster.rung,
    floor: createFloorState(roster.rung),
    barbellOwned: KIT,
    sessionOwned: Object.freeze([]),
    capability: stockStationCapability(),
    livingPopulation: floorSimPopulationFromRoster(roster),
  });
}

function idsOf(roster: LivingMemberRoster): readonly string[] {
  return roster.members.map((member) => member.id);
}

function otherType(type: MemberType): MemberType {
  return type === 'casual' ? 'powerlifter' : 'casual';
}

/**
 * FloorGrid.tsx member-card resolution, as a test-only harness.
 *
 * FloorGrid holds `selectedMemberId` (not an array index), draws
 * `reconcileFloorSimPopulation` when the living ids are a subset of the sim,
 * then:
 *   selectedMember = drawnSim.members.find((m) => m.memberId === selectedMemberId) ?? null
 *   the card is omitted when selectedMember === null
 *   the name is livingMemberById(livingMembers, selectedMember.memberId)
 *
 * This is not a production export and not a force-departure control. It is
 * the same lookup FloorGrid runs, driven against a real post-departure
 * roster+sim so an index-based selection cannot hide behind a source grep.
 */
function floorGridSelectedMemberCard(
  selectedMemberId: GymMemberId | null,
  livingMembers: LivingMemberRoster,
  drawnSim: {
    readonly members: readonly { readonly memberId: string; readonly index: number }[];
  },
): {
  readonly open: boolean;
  readonly memberId: string | null;
  readonly displayName: string | null;
  readonly simIndex: number | null;
} {
  const selectedMember =
    selectedMemberId === null
      ? null
      : (drawnSim.members.find((member) => member.memberId === selectedMemberId) ?? null);
  if (selectedMember === null) {
    return { open: false, memberId: null, displayName: null, simIndex: null };
  }
  const living = livingMemberById(livingMembers, selectedMember.memberId as GymMemberId);
  return {
    open: true,
    memberId: selectedMember.memberId,
    displayName: living?.displayName ?? null,
    simIndex: selectedMember.index,
  };
}

describe('Stage G.2C2 — eligibility is not departure', () => {
  it('keeps the member active through nine qualifying observations', () => {
    let roster = opening();
    const openingIds = idsOf(roster);
    const target = requireMember(roster, 0);

    for (let tick = 1; tick <= 8; tick += 1) {
      roster = applyServiceObservations(roster, [adverse(target, tick)]);
      expect(livingMemberById(roster, target.id)).not.toBeNull();
      expect(idsOf(roster)).toEqual(openingIds);
      expect(roster.departures).toEqual([]);
    }
    expect(livingMemberById(roster, target.id)?.stayState.status).not.toBe('departure-eligible');

    roster = applyServiceObservations(roster, [adverse(target, 9)]);
    const eligible = livingMemberById(roster, target.id);
    expect(eligible).not.toBeNull();
    expect(eligible?.stayState.status).toBe('departure-eligible');
    expect(idsOf(roster)).toEqual(openingIds);
    expect(roster.departures).toEqual([]);
    expect(lastLivingMemberDeparture(roster.departures)).toBeNull();
  });
});

describe('Stage G.2C2 — tenth qualifying strain executes departure', () => {
  it('removes only that member and archives one departure record', () => {
    const roster = opening();
    const target = requireMember(roster, 1);
    const survivorA = requireMember(roster, 0);
    const survivorB = requireMember(roster, 2);
    const afterNine = applyAll(roster, target, 9, adverse);
    expect(livingMemberById(afterNine, target.id)?.stayState.status).toBe('departure-eligible');
    expect(afterNine.departures).toEqual([]);

    const afterTen = applyServiceObservations(afterNine, [adverse(target, 10)]);
    expect(livingMemberById(afterTen, target.id)).toBeNull();
    expect(afterTen.members.map((member) => member.id)).toEqual([survivorA.id, survivorB.id]);
    expect(afterTen.departures.length).toBe(1);
    const record = afterTen.departures[0];
    expect(record?.member.id).toBe(target.id);
    expect(record?.member.displayName).toBe(target.displayName);
    expect(record?.member.type).toBe(target.type);
    expect(record?.member.joinedAtSeconds).toBe(target.joinedAtSeconds);
    expect(record?.departedAtTick).toBe(10);
    expect(record?.member.stayState.status).toBe('departure-eligible');
    expect(record).not.toHaveProperty('probability');
    expect(record).not.toHaveProperty('chance');
    expect(JSON.stringify(record)).not.toMatch(/dues|reputation|churnPercentage/);
    expect(playerFacingDepartureLine(record as NonNullable<typeof record>)).toBe(
      `${target.displayName} left the gym. ${record?.reasonText}`,
    );
    expect(playerFacingDepartureLine(record as NonNullable<typeof record>)).not.toMatch(/%/);

    const leftA = livingMemberById(afterTen, survivorA.id);
    const leftB = livingMemberById(afterTen, survivorB.id);
    expect(leftA).toEqual(afterNine.members[0]);
    expect(leftB).toEqual(afterNine.members[2]);
    expect(afterTen.nextOrdinal).toBe(roster.nextOrdinal);
  });
});

describe('Stage G.2C2 — recovery from eligibility remains real', () => {
  it('does not depart on Stable service and recovers one state after sustained Stable windows', () => {
    const roster = withType(opening(), 0, 'powerlifter');
    const target = requireMember(roster, 0);
    let next = applyAll(roster, target, 9, adverse);
    expect(livingMemberById(next, target.id)?.stayState.status).toBe('departure-eligible');

    next = applyServiceObservations(next, [stable(target, 10)]);
    expect(livingMemberById(next, target.id)?.stayState.status).toBe('departure-eligible');
    expect(next.departures).toEqual([]);

    next = applyServiceObservations(next, [stable(target, 11)]);
    expect(livingMemberById(next, target.id)?.stayState.status).toBe('departure-eligible');
    expect(next.departures).toEqual([]);

    next = applyServiceObservations(next, [stable(target, 12)]);
    expect(livingMemberById(next, target.id)).not.toBeNull();
    expect(next.departures).toEqual([]);

    let tick = 13;
    while (livingMemberById(next, target.id)?.stayState.status === 'departure-eligible') {
      expect(tick, 'Stable recovery should leave eligibility without a departure').toBeLessThan(30);
      next = applyServiceObservations(next, [stable(target, tick)]);
      expect(livingMemberById(next, target.id)).not.toBeNull();
      expect(next.departures).toEqual([]);
      tick += 1;
    }
    expect(livingMemberById(next, target.id)?.stayState.status).toBe('considering-exit');
    expect(livingMemberById(next, target.id)?.stayState.confirmations).toBe(0);

    next = applyServiceObservations(next, [adverse(target, tick)]);
    expect(livingMemberById(next, target.id)?.stayState.status).toBe('considering-exit');
    expect(next.departures).toEqual([]);
  });
});

describe('Stage G.2C2 — neutral while eligible does not depart', () => {
  it('keeps a common-path Watching observation active and resets the streak', () => {
    const roster = withType(opening(), 0, 'powerlifter');
    const target = requireMember(roster, 0);
    let next = applyAll(roster, target, 9, adverse);
    expect(livingMemberById(next, target.id)?.stayState.status).toBe('departure-eligible');

    next = applyServiceObservations(next, [watchingWait(target, 10)]);
    const current = livingMemberById(next, target.id);
    expect(current).not.toBeNull();
    expect(current?.stayState.status).toBe('departure-eligible');
    expect(current?.stayState.pendingDirection).toBeNull();
    expect(current?.stayState.confirmations).toBe(0);
    expect(next.departures).toEqual([]);
    const latest = current?.recentVisits[current.recentVisits.length - 1];
    expect(latest).toBeDefined();
    const visitEvidence = livingMemberStayEvidence(
      current?.type as MemberType,
      livingMemberRetentionPressure(livingMemberExperience(Object.freeze([latest!]))),
    );
    expect(visitEvidence).toBe('neutral');
  });
});

describe('Stage G.2C2 — frozen type boundary', () => {
  it('lets Casual Watching+wait become the departure-confirming event', () => {
    const roster = withType(opening(), 0, 'casual');
    const target = requireMember(roster, 0);
    const afterNine = applyAll(roster, target, 9, watchingWait);
    expect(livingMemberById(afterNine, target.id)?.stayState.status).toBe('departure-eligible');
    expect(afterNine.departures).toEqual([]);
    const afterTen = applyServiceObservations(afterNine, [watchingWait(target, 10)]);
    expect(livingMemberById(afterTen, target.id)).toBeNull();
    expect(afterTen.departures.length).toBe(1);
  });

  it('does not let Casual Watching without wait confirm a departure', () => {
    const roster = withType(opening(), 0, 'casual');
    const target = requireMember(roster, 0);
    const afterNine = applyAll(roster, target, 9, watchingWait);
    const afterTen = applyServiceObservations(afterNine, [watchingNoWait(target, 10)]);
    expect(livingMemberById(afterTen, target.id)?.stayState.status).toBe('departure-eligible');
    expect(afterTen.departures).toEqual([]);
  });

  it('keeps Bodybuilder, Powerlifter, and Athlete on the common strain path', () => {
    const types: readonly MemberType[] = ['bodybuilder', 'powerlifter', 'athlete'];
    for (const type of types) {
      const roster = withType(opening(), 0, type);
      const target = requireMember(roster, 0);
      const watching = applyAll(roster, target, 9, watchingWait);
      expect(livingMemberById(watching, target.id)?.stayState.status, type).not.toBe(
        'departure-eligible',
      );
      const common = applyAll(roster, target, 9, adverse);
      expect(livingMemberById(common, target.id)?.stayState.status, type).toBe('departure-eligible');
      const departed = applyServiceObservations(common, [adverse(target, 10)]);
      expect(livingMemberById(departed, target.id), type).toBeNull();
    }
  });

  it('does not let Serious Lifter leave from Strained, and does from At risk', () => {
    const roster = withType(opening(), 0, 'serious-lifter');
    const target = requireMember(roster, 0);
    const fromStrained = applyAll(roster, target, 10, strained);
    expect(livingMemberById(fromStrained, target.id)).not.toBeNull();
    expect(fromStrained.departures).toEqual([]);
    expect(livingMemberById(fromStrained, target.id)?.stayState.status).not.toBe(
      'departure-eligible',
    );

    const eligible = applyAll(roster, target, 9, adverse);
    expect(livingMemberById(eligible, target.id)?.stayState.status).toBe('departure-eligible');
    const departed = applyServiceObservations(eligible, [adverse(target, 10)]);
    expect(livingMemberById(departed, target.id)).toBeNull();
    expect(departed.departures.length).toBe(1);
  });
});

describe('Stage G.2C2 — replay safety after departure', () => {
  it('treats an exact replay of the departure observation as a full roster no-op', () => {
    const roster = opening();
    const target = requireMember(roster, 0);
    const tenth = adverse(target, 10);
    const departed = applyServiceObservations(applyAll(roster, target, 9, adverse), [tenth]);
    expect(departed.departures.length).toBe(1);
    const replay = applyServiceObservations(departed, [tenth]);
    expect(replay).toBe(departed);
    expect(replay.departures.length).toBe(1);
  });

  it('refuses the same departed member at the same tick with conflicting facts', () => {
    const roster = opening();
    const target = requireMember(roster, 0);
    const tenth = adverse(target, 10);
    const departed = applyServiceObservations(applyAll(roster, target, 9, adverse), [tenth]);
    const conflicting = observation(target, 10, { queueWaitTicks: 50, outcome: 'completed' });
    expect(() => applyServiceObservations(departed, [conflicting])).toThrow(
      /conflicts with departed member/,
    );
  });

  it('refuses a same-tick tombstone replay whose only conflict is memberType', () => {
    const roster = opening();
    const target = requireMember(roster, 0);
    const tenth = adverse(target, 10);
    const departed = applyServiceObservations(applyAll(roster, target, 9, adverse), [tenth]);
    expect(departed.departures[0]?.member.type).toBe(target.type);
    const typeConflict = observation(target, 10, { memberType: otherType(target.type) });
    expect(typeConflict.memberId).toBe(tenth.memberId);
    expect(typeConflict.observedAtTick).toBe(tenth.observedAtTick);
    expect(typeConflict.stationKind).toBe(tenth.stationKind);
    expect(typeConflict.stationKey).toBe(tenth.stationKey);
    expect(typeConflict.queueWaitTicks).toBe(tenth.queueWaitTicks);
    expect(typeConflict.trainingExperience).toBe(tenth.trainingExperience);
    expect(typeConflict.outcome).toBe(tenth.outcome);
    expect(typeConflict.memberType).not.toBe(tenth.memberType);
    expect(() => applyServiceObservations(departed, [typeConflict])).toThrow(
      /does not match departed member/,
    );
    const replay = applyServiceObservations(departed, [tenth]);
    expect(replay).toBe(departed);
    expect(livingMemberById(replay, target.id)).toBeNull();
    expect(replay.departures.length).toBe(1);
  });

  it('refuses a later observation for a departed member', () => {
    const roster = opening();
    const target = requireMember(roster, 0);
    const departed = applyServiceObservations(applyAll(roster, target, 9, adverse), [
      adverse(target, 10),
    ]);
    expect(() => applyServiceObservations(departed, [adverse(target, 11)])).toThrow(
      /names departed member/,
    );
  });
});

describe('Stage G.2C2 — identity allocator never reuses a departed ordinal', () => {
  it('mints relocation identities above every previously used ordinal', () => {
    const roster = opening();
    expect(roster.nextOrdinal).toBe(3);
    const interior = requireMember(roster, 1);
    const departed = applyServiceObservations(applyAll(roster, interior, 9, adverse), [
      adverse(interior, 10),
    ]);
    expect(departed.nextOrdinal).toBe(3);
    expect(departed.members.map((member) => memberOrdinalFromId(member.id))).toEqual([0, 2]);

    const moved = reconcileLivingMemberRosterOnRelocation(
      departed,
      NEXT_RUNG,
      Object.freeze([]),
      T.SECONDS_PER_HOUR,
    );
    expect(moved.members.slice(0, 2).map((member) => member.id)).toEqual(idsOf(departed));
    expect(moved.members[0]?.displayName).toBe(departed.members[0]?.displayName);
    expect(moved.members[1]?.displayName).toBe(departed.members[1]?.displayName);
    const arrivals = moved.members.slice(2);
    expect(arrivals.length).toBe(T.AMBIENT_MEMBER_COUNT_BY_RUNG[NEXT_RUNG] - 2);
    const used = new Set(moved.members.map((member) => member.id));
    used.add(interior.id);
    expect(used.size).toBe(moved.members.length + 1);
    expect(arrivals.every((member) => memberOrdinalFromId(member.id) >= 3)).toBe(true);
    expect(moved.members.some((member) => member.id === interior.id)).toBe(false);
    expect(departedMemberById(moved, interior.id)?.member.id).toBe(interior.id);
    arrivals.forEach((member, offset) => {
      expect(member.displayName).toBe(LIVING_MEMBER_GIVEN_NAMES[3 + offset]);
      expect(member.id).toBe(deriveMemberId(roster.identityNonce, 3 + offset));
    });
    expect(moved.nextOrdinal).toBe(3 + arrivals.length);
  });
});

describe('Stage G.2C2 — FloorSim population continuity', () => {
  it('drops the departed body, keeps survivors, and fails closed on unknown ids', () => {
    const roster = opening();
    const interior = requireMember(roster, 1);
    const context = contextWithRoster(roster);
    const started = createFloorSimState(context, T.FLOOR_SIM_RENDER_SEED);
    const before = runFloorSim(started, context, 40);
    const survivorBefore = before.members.find((member) => member.memberId === roster.members[0]?.id);
    const laterBefore = before.members.find((member) => member.memberId === roster.members[2]?.id);
    expect(survivorBefore).toBeDefined();
    expect(laterBefore).toBeDefined();

    const departedRoster = applyServiceObservations(applyAll(roster, interior, 9, adverse), [
      adverse(interior, 10),
    ]);
    const afterContext = contextWithRoster(departedRoster);
    const reconciled = reconcileFloorSimPopulation(before, afterContext);

    expect(reconciled.members.map((member) => member.memberId)).toEqual(idsOf(departedRoster));
    expect(reconciled.members.some((member) => member.memberId === interior.id)).toBe(false);
    expect(reconciled.tick).toBe(before.tick);
    expect(reconciled.seed).toBe(before.seed);
    const survivorAfter = reconciled.members.find((member) => member.memberId === survivorBefore?.memberId);
    const laterAfter = reconciled.members.find((member) => member.memberId === laterBefore?.memberId);
    expect(survivorAfter?.cell).toEqual(survivorBefore?.cell);
    expect(survivorAfter?.state).toBe(survivorBefore?.state);
    expect(survivorAfter?.target).toEqual(survivorBefore?.target);
    expect(survivorAfter?.timer).toBe(survivorBefore?.timer);
    expect(laterAfter?.cell).toEqual(laterBefore?.cell);
    expect(laterAfter?.index).toBe(1);

    const smaller = createFloorSimState(afterContext, T.FLOOR_SIM_RENDER_SEED);
    expect(smaller.members.length).toBe(2);
    expect(smaller.members.length).toBeLessThan(T.AMBIENT_MEMBER_COUNT_BY_RUNG.garage);

    expect(() =>
      reconcileFloorSimPopulation(reconciled, {
        ...afterContext,
        livingPopulation: Object.freeze([
          ...afterContext.livingPopulation,
          Object.freeze({ memberId: 'member:n1:99', type: 'casual' as const }),
        ]),
      }),
    ).toThrow(/unknown simulator member/);

    const stepped = stepFloorSimWithObservations(reconciled, afterContext);
    expect(stepped.observations.every((row) => row.memberId !== interior.id)).toBe(true);
    expect(stepped.state.members.some((member) => member.memberId === interior.id)).toBe(false);
  });

  it('refuses a living population larger than the facility placement count', () => {
    const roster = opening();
    const context = contextWithRoster(roster);
    const extra = Object.freeze({
      ...context,
      livingPopulation: Object.freeze([
        ...context.livingPopulation,
        Object.freeze({ memberId: 'member:n1:99', type: 'casual' as const }),
      ]),
    });
    expect(() => createFloorSimState(extra, T.FLOOR_SIM_RENDER_SEED)).toThrow(/exceeds ambient placement/);
  });
});

describe('Stage G.2C2 — relocation after departures and offline clock', () => {
  it('preserves remaining members and does not return departed identities', () => {
    const roster = opening();
    const first = requireMember(roster, 0);
    const departed = applyServiceObservations(applyAll(roster, first, 9, adverse), [
      adverse(first, 10),
    ]);
    const moved = reconcileLivingMemberRosterOnRelocation(
      departed,
      NEXT_RUNG,
      Object.freeze([]),
      T.SECONDS_PER_DAY,
    );
    expect(moved.members[0]?.id).toBe(departed.members[0]?.id);
    expect(moved.members.some((member) => member.id === first.id)).toBe(false);
    expect(moved.departures.map((record) => record.member.id)).toEqual([first.id]);
    expect(moved.members.length).toBe(T.AMBIENT_MEMBER_COUNT_BY_RUNG[NEXT_RUNG]);
  });

  it('does not depart, append visits, or advance stay from offline clock', () => {
    const roster = opening();
    const target = requireMember(roster, 0);
    const eligible = applyAll(roster, target, 9, adverse);
    const advancedEligible = advanceLivingMemberTenure(eligible, T.SECONDS_PER_DAY);
    expect(advancedEligible).toBe(eligible);
    expect(advancedEligible.departures).toEqual([]);
    expect(livingMemberById(advancedEligible, target.id)?.recentVisits).toEqual(
      livingMemberById(eligible, target.id)?.recentVisits,
    );

    const departed = applyServiceObservations(eligible, [adverse(target, 10)]);
    expect(advanceLivingMemberTenure(departed, T.SECONDS_PER_DAY)).toBe(departed);
  });
});

describe('Stage G.2C2 — FloorGrid selection is identity across departure', () => {
  it('keeps C selected when B leaves and the roster compacts A/B/C → A/C', () => {
    const openingState = createGymViewState();
    const roster = openingState.livingMembers;
    expect(roster.members.length).toBeGreaterThanOrEqual(3);
    const memberA = requireMember(roster, 0);
    const memberB = requireMember(roster, 1);
    const memberC = requireMember(roster, 2);
    const context = contextWithRoster(roster);
    const started = createFloorSimState(context, T.FLOOR_SIM_RENDER_SEED);
    const before = runFloorSim(started, context, 20);
    expect(before.members.map((member) => member.memberId)).toEqual(idsOf(roster));

    const selectedMemberId = memberC.id;
    const beforeCard = floorGridSelectedMemberCard(selectedMemberId, roster, before);
    expect(beforeCard.open).toBe(true);
    expect(beforeCard.memberId).toBe(memberC.id);
    expect(beforeCard.displayName).toBe(memberC.displayName);
    expect(beforeCard.simIndex).toBe(2);

    let state = openingState;
    for (let tick = 1; tick <= 9; tick += 1) {
      const current = livingMemberById(state.livingMembers, memberB.id) ?? memberB;
      state = gymViewReduce(state, {
        kind: 'apply-living-member-observations',
        observations: [adverse(current, tick)],
      });
    }
    expect(livingMemberById(state.livingMembers, memberB.id)?.stayState.status).toBe(
      'departure-eligible',
    );
    state = gymViewReduce(state, {
      kind: 'apply-living-member-observations',
      observations: [adverse(memberB, 10)],
    });
    expect(livingMemberById(state.livingMembers, memberB.id)).toBeNull();
    expect(state.livingMembers.members.map((member) => member.id)).toEqual([
      memberA.id,
      memberC.id,
    ]);

    const drawnSim = reconcileFloorSimPopulation(before, contextWithRoster(state.livingMembers));
    expect(drawnSim.members[2]).toBeUndefined();
    expect(drawnSim.members[1]?.memberId).toBe(memberC.id);

    const card = floorGridSelectedMemberCard(selectedMemberId, state.livingMembers, drawnSim);
    expect(card.open).toBe(true);
    expect(card.memberId).toBe(memberC.id);
    expect(card.displayName).toBe(memberC.displayName);
    expect(card.displayName).not.toBe(memberA.displayName);
    expect(card.simIndex).toBe(1);
    expect(livingMemberById(state.livingMembers, memberC.id)?.displayName).toBe(memberC.displayName);
  });

  it('closes the member card when the selected member departs, and does not retarget', () => {
    const openingState = createGymViewState();
    const roster = openingState.livingMembers;
    const memberA = requireMember(roster, 0);
    const memberB = requireMember(roster, 1);
    const memberC = requireMember(roster, 2);
    const context = contextWithRoster(roster);
    const started = createFloorSimState(context, T.FLOOR_SIM_RENDER_SEED);
    const before = runFloorSim(started, context, 20);

    const selectedMemberId = memberB.id;
    expect(floorGridSelectedMemberCard(selectedMemberId, roster, before).open).toBe(true);

    let state = openingState;
    for (let tick = 1; tick <= 9; tick += 1) {
      const current = livingMemberById(state.livingMembers, memberB.id) ?? memberB;
      state = gymViewReduce(state, {
        kind: 'apply-living-member-observations',
        observations: [adverse(current, tick)],
      });
    }
    state = gymViewReduce(state, {
      kind: 'apply-living-member-observations',
      observations: [adverse(memberB, 10)],
    });
    expect(livingMemberById(state.livingMembers, memberB.id)).toBeNull();

    const drawnSim = reconcileFloorSimPopulation(before, contextWithRoster(state.livingMembers));
    expect(drawnSim.members[1]?.memberId).toBe(memberC.id);

    const card = floorGridSelectedMemberCard(selectedMemberId, state.livingMembers, drawnSim);
    expect(card.open).toBe(false);
    expect(card.memberId).toBeNull();
    expect(card.displayName).toBeNull();
    expect(card.displayName).not.toBe(memberA.displayName);
    expect(card.displayName).not.toBe(memberC.displayName);
    expect(lastLivingMemberDeparture(state.livingMembers.departures)?.member.id).toBe(memberB.id);
  });
});
