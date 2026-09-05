/**
 * livingMemberReputation.integration.test.ts — Stage G.2E causal-chain
 * reputation settlement through the living roster writer: replay, fail-closed,
 * join pro-rate, time-weighted departure occupancy, clock production path,
 * and high-paying vacancy gating.
 */

import { describe, expect, it } from 'vitest';

import { EMPIRE_TUNING } from './empireTuning';
import type { FloorSimServiceObservation } from './floorSim';
import { gymViewReduce, createGymViewState } from './ladderView';
import {
  lastLivingMemberReputationSettlement,
  livingMemberDailyReputation,
  livingMemberReputationForInterval,
  livingMemberReputationForWindow,
  playerFacingReputationLine,
} from './livingMemberReputation';
import {
  applyLivingMemberReputation,
  applyServiceObservations,
  createLivingMemberRoster,
  livingMemberById,
  type LivingGymMember,
  type LivingMemberRoster,
} from './livingMembers';
import { equipmentBiasedMemberTypes, memberReputationPerDay } from './members';
import type { SessionEquipmentItem } from './sessions';

const T = EMPIRE_TUNING;
const KIT = Object.freeze([...T.LADDER_STARTING_EQUIPMENT]);
const DAY = T.SECONDS_PER_DAY;
const GATE = T.HIGH_PAYING_MEMBER_ARRIVAL_REPUTATION_THRESHOLD;

function opening(): LivingMemberRoster {
  return createLivingMemberRoster('garage', KIT, Object.freeze([]), 0, T.FLOOR_SIM_RENDER_SEED);
}

function requireMember(roster: LivingMemberRoster, index: number): LivingGymMember {
  const member = roster.members[index];
  if (member === undefined) throw new Error(`missing member at ${index}`);
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

function applyAll(
  roster: LivingMemberRoster,
  member: LivingGymMember,
  count: number,
  factory: (current: LivingGymMember, tick: number) => FloorSimServiceObservation,
): LivingMemberRoster {
  let next = roster;
  const firstTick = (livingMemberById(roster, member.id)?.recentVisits.at(-1)?.observedAtTick ?? 0) + 1;
  for (let offset = 0; offset < count; offset += 1) {
    const current = livingMemberById(next, member.id);
    if (current === null) throw new Error(`lost ${member.id}`);
    next = applyServiceObservations(next, [factory(current, firstTick + offset)]);
  }
  return next;
}

function requireDeparture(roster: LivingMemberRoster, index: number): LivingGymMember {
  const record = roster.departures[index];
  if (record === undefined) throw new Error(`missing departure at ${index}`);
  return record.member;
}

const ATHLETE_OWNED: readonly SessionEquipmentItem[] = Object.freeze([
  'sled',
  'bike',
  'treadmill',
  'rower',
]);

describe('Stage G.2E — opening ledger', () => {
  it('starts settled at join time with nothing credited', () => {
    const roster = opening();
    expect(roster.reputation.settledAtSeconds).toBe(0);
    expect(roster.reputation.creditedReputation).toBe(0);
    expect(roster.reputation.settlements).toEqual([]);
    expect(lastLivingMemberReputationSettlement(roster.reputation.settlements)).toBeNull();
  });
});

describe('Stage G.2E — writer settlement', () => {
  it('credits published type rates for a one-day window on the opening garage roster', () => {
    const roster = opening();
    const expected = livingMemberReputationForWindow(roster.members, 0, DAY);
    expect(expected).toBeGreaterThan(0);
    const settled = applyLivingMemberReputation(roster, DAY);
    expect(settled).not.toBe(roster);
    expect(settled.reputation.settledAtSeconds).toBe(DAY);
    expect(settled.reputation.creditedReputation).toBe(expected);
    expect(settled.members).toBe(roster.members);
    expect(settled.departures).toBe(roster.departures);
    expect(settled.dues).toBe(roster.dues);
    const record = lastLivingMemberReputationSettlement(settled.reputation.settlements);
    expect(record).not.toBeNull();
    expect(record?.fromSeconds).toBe(0);
    expect(record?.toSeconds).toBe(DAY);
    expect(record?.reputation).toBe(expected);
  });

  it('is a full roster no-op on exact replay of the same settle mark', () => {
    const settled = applyLivingMemberReputation(opening(), DAY);
    const replay = applyLivingMemberReputation(settled, DAY);
    expect(replay).toBe(settled);
    expect(replay.reputation.settlements.length).toBe(1);
    expect(replay.reputation.creditedReputation).toBe(settled.reputation.creditedReputation);
  });

  it('refuses a clock that runs backward', () => {
    const settled = applyLivingMemberReputation(opening(), DAY);
    expect(() => applyLivingMemberReputation(settled, DAY - 1)).toThrow(/earlier than last settled/);
  });

  it('refuses a non-finite or negative settle mark', () => {
    const roster = opening();
    expect(() => applyLivingMemberReputation(roster, Number.NaN)).toThrow(/non-negative/);
    expect(() => applyLivingMemberReputation(roster, -1)).toThrow(/non-negative/);
  });

  it('refuses the same from/to with a conflicting amount while the mark has not advanced', () => {
    const roster = opening();
    const expected = livingMemberReputationForWindow(roster.members, 0, DAY);
    const conflicting: LivingMemberRoster = Object.freeze({
      ...roster,
      reputation: Object.freeze({
        settledAtSeconds: 0,
        creditedReputation: expected + 1,
        settlements: Object.freeze([createConflict(expected + 1)]),
      }),
    });
    expect(() => applyLivingMemberReputation(conflicting, DAY)).toThrow(/conflicts/);
  });

  it('refuses an invalid join clock on a contributing member', () => {
    const roster = opening();
    const broken = requireMember(roster, 0);
    const invalid: LivingMemberRoster = Object.freeze({
      ...roster,
      members: Object.freeze([
        Object.freeze({ ...broken, joinedAtSeconds: Number.NaN }),
        ...roster.members.slice(1),
      ]),
    });
    expect(() => applyLivingMemberReputation(invalid, DAY)).toThrow(/joinedAtSeconds/);
  });

  it('accumulates contiguous windows without double-counting the first', () => {
    const first = applyLivingMemberReputation(opening(), DAY);
    const second = applyLivingMemberReputation(first, DAY * 2);
    expect(second.reputation.settledAtSeconds).toBe(DAY * 2);
    expect(second.reputation.settlements.length).toBe(2);
    expect(second.reputation.creditedReputation).toBe(first.reputation.creditedReputation * 2);
    expect(lastLivingMemberReputationSettlement(second.reputation.settlements)?.fromSeconds).toBe(
      DAY,
    );
  });
});

function createConflict(reputation: number) {
  return Object.freeze({
    fromSeconds: 0,
    toSeconds: DAY,
    reputation,
  });
}

describe('Stage G.2E — occupancy during the settle window', () => {
  it('does not invent credit when a leave has no gym-clock occupancy mark', () => {
    const roster = opening();
    const gone = requireMember(roster, 1);
    const departed = applyServiceObservations(applyAll(roster, gone, 9, adverse), [adverse(gone, 10)]);
    expect(departed.duesLeftAtSeconds[gone.id]).toBeUndefined();
    const settled = applyLivingMemberReputation(departed, DAY);
    expect(settled.reputation.creditedReputation).toBe(
      livingMemberReputationForWindow(departed.members, 0, DAY),
    );
    expect(settled.reputation.creditedReputation).toBeLessThan(
      livingMemberReputationForWindow(roster.members, 0, DAY),
    );
  });

  it('credits a mid-window departure for the stub that member was still active', () => {
    const roster = opening();
    const gone = requireMember(roster, 1);
    const departed = applyServiceObservations(
      applyAll(roster, gone, 9, adverse),
      [adverse(gone, 10)],
      undefined,
      null,
      DAY / 2,
    );
    expect(departed.duesLeftAtSeconds[gone.id]).toBe(DAY / 2);
    const snapshot = requireDeparture(departed, 0);
    const stub = livingMemberReputationForInterval(snapshot, 0, DAY, DAY / 2);
    expect(stub).toBeGreaterThan(0);
    const settled = applyLivingMemberReputation(departed, DAY);
    expect(settled.reputation.creditedReputation).toBe(
      livingMemberReputationForWindow(departed.members, 0, DAY) + stub,
    );
  });
});

describe('Stage G.2E — production clock path', () => {
  it('settles the reputation ledger on advance-clock and is a no-op on replay of the same mark', () => {
    const opened = createGymViewState();
    const expected = livingMemberReputationForWindow(opened.livingMembers.members, 0, DAY);
    const next = gymViewReduce(opened, { kind: 'advance-clock', gapSeconds: DAY, mode: 'online' });
    expect(next.livingMembers.reputation.settledAtSeconds).toBe(DAY);
    expect(next.livingMembers.reputation.creditedReputation).toBe(expected);
    expect(next.livingMembers.dues.settledAtSeconds).toBe(DAY);
    const replay = gymViewReduce(next, { kind: 'advance-clock', gapSeconds: 0, mode: 'online' });
    expect(replay.livingMembers).toBe(next.livingMembers);
  });

  it('does not settle reputation through apply-living-member-observations', () => {
    const opened = createGymViewState();
    const target = requireMember(opened.livingMembers, 0);
    const next = gymViewReduce(opened, {
      kind: 'apply-living-member-observations',
      observations: [stable(target, 1)],
    });
    expect(next.livingMembers.reputation).toBe(opened.livingMembers.reputation);
    expect(next.livingMembers.reputation.creditedReputation).toBe(0);
  });
});

describe('Stage G.2E — high-paying vacancy gate', () => {
  it('pins the Athlete kit so the next vacancy type is Athlete', () => {
    expect(equipmentBiasedMemberTypes(ATHLETE_OWNED)).toEqual(['athlete']);
  });
  it('does not mint an Athlete into a vacancy while credited reputation is below the threshold', () => {
    const roster = opening();
    const gone = requireMember(roster, 1);
    const leftover = requireMember(roster, 0);
    const departed = applyServiceObservations(applyAll(roster, gone, 9, adverse), [
      adverse(gone, 10),
    ]);
    expect(departed.reputation.creditedReputation).toBe(0);
    const held = applyServiceObservations(
      departed,
      [stable(leftover, 11)],
      undefined,
      Object.freeze({ sessionOwned: ATHLETE_OWNED, joinedAtSeconds: 40 }),
    );
    expect(held.members.length).toBe(departed.members.length);
    expect(held.arrivals).toEqual([]);
  });

  it('mints an Athlete on recovery once credited reputation meets the threshold, and replay is a no-op', () => {
    const roster = applyLivingMemberReputation(opening(), DAY * 3);
    expect(roster.reputation.creditedReputation).toBeGreaterThanOrEqual(GATE);
    const gone = requireMember(roster, 1);
    const leftover = requireMember(roster, 0);
    const departed = applyServiceObservations(applyAll(roster, gone, 9, adverse), [
      adverse(gone, 10),
    ]);
    const tenth = stable(leftover, 11);
    const arrived = applyServiceObservations(
      departed,
      [tenth],
      undefined,
      Object.freeze({ sessionOwned: ATHLETE_OWNED, joinedAtSeconds: 40 }),
    );
    expect(arrived.members.length).toBe(departed.members.length + 1);
    expect(arrived.members[arrived.members.length - 1]?.type).toBe('athlete');
    const replay = applyServiceObservations(
      arrived,
      [tenth],
      undefined,
      Object.freeze({ sessionOwned: ATHLETE_OWNED, joinedAtSeconds: 40 }),
    );
    expect(replay).toBe(arrived);
  });
});

describe('Stage G.2E — player-facing line is the current type rate', () => {
  it('matches the daily function for an opening powerlifter', () => {
    const member = requireMember(opening(), 0);
    const rate = livingMemberDailyReputation(member);
    expect(rate).toBe(memberReputationPerDay(member.type));
    expect(playerFacingReputationLine(rate)).toContain('REP');
    expect(playerFacingReputationLine(rate)).toContain('a day');
  });
});
