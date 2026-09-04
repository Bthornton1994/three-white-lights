/**
 * livingMemberStay.integration.test.ts — Stage G.2C1 causal-chain integration.
 *
 * This file drives the authoritative living roster with real
 * `FloorSimServiceObservation` records. It proves the new state is not a dead
 * side module: service history is the only input path into G.2A → G.2B → stay
 * response, while identity and roster membership remain intact.
 */

import { describe, expect, it } from 'vitest';

import { EMPIRE_TUNING } from './empireTuning';
import type { FloorSimServiceObservation } from './floorSim';
import type { LadderRung } from './ladder';
import {
  advanceLivingMemberTenure,
  applyServiceObservations,
  createLivingMemberRoster,
  livingMemberById,
  reconcileLivingMemberRosterOnRelocation,
  type LivingGymMember,
  type LivingMemberRoster,
} from './livingMembers';

const T = EMPIRE_TUNING;
const KIT = Object.freeze([...T.LADDER_STARTING_EQUIPMENT]);

function catastrophic(member: LivingGymMember, memberIndex: number, tick: number): FloorSimServiceObservation {
  return Object.freeze({
    memberId: member.id,
    memberIndex,
    memberType: member.type,
    stationKind: 'training',
    stationKey: 'training:competition-bench-bay',
    queueWaitTicks: 10_000,
    trainingExperience: 0,
    outcome: 'interrupted',
    observedAtTick: tick,
  });
}

function opening(): LivingMemberRoster {
  return createLivingMemberRoster('garage', KIT, Object.freeze([]), 0, T.FLOOR_SIM_RENDER_SEED);
}

describe('Stage G.2C1 — living-roster integration', () => {
  it('starts every living member forming with no roster consequence', () => {
    const roster = opening();
    expect(roster.members.length).toBe(T.AMBIENT_MEMBER_COUNT_BY_RUNG.garage);
    expect(roster.members.every((member) => member.stayState.status === 'forming')).toBe(true);
    expect(roster.members.every((member) => member.stayState.lastEvaluatedVisitTick === null)).toBe(true);
  });

  it('requires three real catastrophic service observations before eligibility and removes nobody', () => {
    let roster = opening();
    const openingIds = roster.members.map((member) => member.id);
    const target = roster.members[0];
    expect(target).toBeDefined();

    roster = applyServiceObservations(roster, [catastrophic(target as LivingGymMember, 0, 1)]);
    let updated = livingMemberById(roster, target?.id as never);
    expect(updated?.recentVisits.length).toBe(1);
    expect(updated?.stayState.status).toBe('unsettled');
    expect(roster.members.map((member) => member.id)).toEqual(openingIds);

    roster = applyServiceObservations(roster, [catastrophic(target as LivingGymMember, 0, 2)]);
    updated = livingMemberById(roster, target?.id as never);
    expect(updated?.recentVisits.length).toBe(2);
    expect(updated?.stayState.status).toBe('considering-exit');
    expect(roster.members.map((member) => member.id)).toEqual(openingIds);

    roster = applyServiceObservations(roster, [catastrophic(target as LivingGymMember, 0, 3)]);
    updated = livingMemberById(roster, target?.id as never);
    expect(updated?.recentVisits.length).toBe(3);
    expect(updated?.stayState.status).toBe('departure-eligible');
    expect(roster.members.map((member) => member.id)).toEqual(openingIds);
    expect(roster.members.length).toBe(openingIds.length);
  });

  it('changes only the observed member and leaves other members forming', () => {
    const before = opening();
    const target = before.members[0] as LivingGymMember;
    const after = applyServiceObservations(before, [catastrophic(target, 0, 1)]);

    expect(after.members[0]?.stayState.status).toBe('unsettled');
    for (const member of after.members.slice(1)) {
      expect(member.stayState.status).toBe('forming');
      expect(member.recentVisits).toEqual([]);
    }
  });

  it('does not change stay response on offline tenure advance', () => {
    let roster = opening();
    const target = roster.members[0] as LivingGymMember;
    roster = applyServiceObservations(roster, [catastrophic(target, 0, 1)]);
    const before = roster.members[0]?.stayState;
    const advanced = advanceLivingMemberTenure(roster, T.SECONDS_PER_HOUR);
    expect(advanced).toBe(roster);
    expect(advanced.members[0]?.stayState).toBe(before);
  });

  it('preserves existing stay response on relocation and initializes appended members forming', () => {
    let roster = opening();
    const target = roster.members[0] as LivingGymMember;
    roster = applyServiceObservations(roster, [catastrophic(target, 0, 1)]);
    const before = roster.members[0]?.stayState;
    const nextRung = T.LADDER_RUNGS[1] as LadderRung;
    const moved = reconcileLivingMemberRosterOnRelocation(
      roster,
      nextRung,
      Object.freeze([]),
      T.SECONDS_PER_HOUR,
    );

    expect(moved.members[0]?.id).toBe(target.id);
    expect(moved.members[0]?.stayState).toBe(before);
    for (const member of moved.members.slice(roster.members.length)) {
      expect(member.stayState.status).toBe('forming');
    }
  });

  it('treats an exact replay of the latest observation as a full roster no-op', () => {
    const roster = opening();
    const target = roster.members[0] as LivingGymMember;
    const observation = catastrophic(target, 0, 1);
    const once = applyServiceObservations(roster, [observation]);
    const replay = applyServiceObservations(once, [observation]);
    expect(replay).toBe(once);
  });
});
