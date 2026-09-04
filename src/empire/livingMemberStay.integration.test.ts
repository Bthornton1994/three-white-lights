/**
 * livingMemberStay.integration.test.ts — Stage G.2C1 causal-chain integration.
 *
 * This file drives the authoritative living roster with the real
 * `FloorSimServiceObservation` contract. It proves the new state is not a dead
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

/**
 * A structurally valid stock-training visit with enough true queue wait plus
 * interruption to put accepted G.2A/G.2B into At risk. Training experience is
 * the real stock station value rather than an impossible zero-value workout.
 */
function adverse(member: LivingGymMember, memberIndex: number, tick: number): FloorSimServiceObservation {
  return Object.freeze({
    memberId: member.id,
    memberIndex,
    memberType: member.type,
    stationKind: 'training',
    stationKey: 'training:competition-bench-bay',
    queueWaitTicks: 200,
    trainingExperience: T.STATION_STOCK_TRAINING_EXPERIENCE,
    outcome: 'interrupted',
    observedAtTick: tick,
  });
}

function opening(): LivingMemberRoster {
  return createLivingMemberRoster('garage', KIT, Object.freeze([]), 0, T.FLOOR_SIM_RENDER_SEED);
}

function requireOpeningTarget(roster: LivingMemberRoster): LivingGymMember {
  const target = roster.members[0];
  if (target === undefined) throw new Error('opening living-member roster has no member 0');
  return target;
}

describe('Stage G.2C1 — living-roster integration', () => {
  it('starts every living member forming with no roster consequence', () => {
    const roster = opening();
    expect(roster.members.length).toBe(T.AMBIENT_MEMBER_COUNT_BY_RUNG.garage);
    expect(roster.members.every((member) => member.stayState.status === 'forming')).toBe(true);
    expect(roster.members.every((member) => member.stayState.lastEvaluatedVisitTick === null)).toBe(true);
    expect(roster.members.every((member) => member.stayState.confirmations === 0)).toBe(true);
  });

  it('requires nine qualifying service observations before eligibility and removes nobody', () => {
    let roster = opening();
    const openingIds = roster.members.map((member) => member.id);
    const target = requireOpeningTarget(roster);

    for (let tick = 1; tick <= 9; tick += 1) {
      roster = applyServiceObservations(roster, [adverse(target, 0, tick)]);
      const updated = livingMemberById(roster, target.id);
      expect(updated).not.toBeNull();
      expect(roster.members.map((member) => member.id)).toEqual(openingIds);

      if (tick === 2) {
        expect(updated?.stayState.status).toBe('staying');
        expect(updated?.stayState.confirmations).toBe(2);
      }
      if (tick === 3) {
        expect(updated?.stayState.status).toBe('unsettled');
        expect(updated?.stayState.confirmations).toBe(0);
      }
      if (tick === 6) expect(updated?.stayState.status).toBe('considering-exit');
      if (tick === 9) expect(updated?.stayState.status).toBe('departure-eligible');
    }

    const updated = livingMemberById(roster, target.id);
    expect(updated?.recentVisits.length).toBe(T.LIVING_MEMBER_SERVICE_HISTORY_WINDOW);
    expect(roster.members.map((member) => member.id)).toEqual(openingIds);
    expect(roster.members.length).toBe(openingIds.length);
  });

  it('changes only the observed member and leaves other members forming', () => {
    const before = opening();
    const target = requireOpeningTarget(before);
    const after = applyServiceObservations(before, [adverse(target, 0, 1)]);

    expect(after.members[0]?.stayState.status).toBe('staying');
    expect(after.members[0]?.stayState.pendingDirection).toBe('strain');
    expect(after.members[0]?.stayState.confirmations).toBe(1);
    for (const member of after.members.slice(1)) {
      expect(member.stayState.status).toBe('forming');
      expect(member.recentVisits).toEqual([]);
    }
  });

  it('does not change stay response on offline tenure advance', () => {
    let roster = opening();
    const target = requireOpeningTarget(roster);
    roster = applyServiceObservations(roster, [adverse(target, 0, 1)]);
    const before = roster.members[0]?.stayState;
    const advanced = advanceLivingMemberTenure(roster, T.SECONDS_PER_HOUR);
    expect(advanced).toBe(roster);
    expect(advanced.members[0]?.stayState).toBe(before);
  });

  it('preserves existing stay response on relocation and initializes appended members forming', () => {
    let roster = opening();
    const target = requireOpeningTarget(roster);
    roster = applyServiceObservations(roster, [adverse(target, 0, 1)]);
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
      expect(member.stayState.confirmations).toBe(0);
    }
  });

  it('treats an exact replay of the latest observation as a full roster no-op', () => {
    const roster = opening();
    const target = requireOpeningTarget(roster);
    const observation = adverse(target, 0, 1);
    const once = applyServiceObservations(roster, [observation]);
    const replay = applyServiceObservations(once, [observation]);
    expect(replay).toBe(once);
  });
});
