/**
 * livingMemberReputation.integration.test.ts — Stage G.2E causal-chain
 * reputation settlement through the living roster writer: replay, fail-closed,
 * join pro-rate, time-weighted departure occupancy, clock production path,
 * and high-paying vacancy gating (writer mint for Athlete and Serious Lifter,
 * plus gymViewReduce apply-living-member-observations after advance-clock).
 */

import { describe, expect, it } from 'vitest';

import { EMPIRE_TUNING } from './empireTuning';
import type { FloorSimServiceObservation } from './floorSim';
import { gymViewReduce, createGymViewState, type GymViewState } from './ladderView';
import { withUpdatedGym } from './management';
import {
  lastLivingMemberReputationSettlement,
  livingMemberDailyReputation,
  livingMemberReputationForInterval,
  livingMemberReputationForWindow,
  playerFacingReputationLine,
} from './livingMemberReputation';
import { livingMemberDuesOccupancyUntilSeconds } from './livingMemberDues';
import {
  applyLivingMemberReputation,
  applyServiceObservations,
  createLivingMemberRoster,
  livingMemberById,
  reconcileLivingMemberRosterOnRelocation,
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

const SERIOUS_OWNED: readonly SessionEquipmentItem[] = Object.freeze([
  'foam-rollers',
  'sauna',
  'belts',
  'sleeves',
  'wrist-wraps',
  'machines',
]);

const HIGH_PAYING_KITS = Object.freeze([
  Object.freeze({ type: 'athlete' as const, owned: ATHLETE_OWNED, label: 'Athlete' }),
  Object.freeze({
    type: 'serious-lifter' as const,
    owned: SERIOUS_OWNED,
    label: 'Serious Lifter',
  }),
]);

/** GymState lists session equipment in the published item order. */
function sessionOwnedOnGym(
  owned: readonly SessionEquipmentItem[],
): readonly SessionEquipmentItem[] {
  return Object.freeze(T.SESSION_EQUIPMENT_ITEMS.filter((item) => owned.includes(item)));
}

function withSessionOwned(
  state: GymViewState,
  owned: readonly SessionEquipmentItem[],
): GymViewState {
  return Object.freeze({
    ...state,
    managed: withUpdatedGym(
      state.managed,
      Object.freeze({
        ...state.managed.gym,
        sessionEquipment: sessionOwnedOnGym(owned),
      }),
    ),
  });
}

function departInteriorOnGym(state: GymViewState): {
  readonly state: GymViewState;
  readonly leftover: LivingGymMember;
} {
  const gone = requireMember(state.livingMembers, 1);
  const leftoverId = requireMember(state.livingMembers, 0).id;
  let next = state;
  for (let tick = 1; tick <= 10; tick += 1) {
    const current = livingMemberById(next.livingMembers, gone.id) ?? gone;
    next = gymViewReduce(next, {
      kind: 'apply-living-member-observations',
      observations: [adverse(current, tick)],
    });
  }
  const leftover = livingMemberById(next.livingMembers, leftoverId);
  if (leftover === null) throw new Error(`lost leftover ${leftoverId}`);
  return { state: next, leftover };
}

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

  it('credits a leave stamped on the settle mark for the open GymHost tick on the writer', () => {
    const roster = opening();
    const gone = requireMember(roster, 1);
    const departed = applyServiceObservations(
      applyAll(roster, gone, 9, adverse),
      [adverse(gone, 10)],
      undefined,
      null,
      0,
    );
    expect(departed.duesLeftAtSeconds[gone.id]).toBe(0);
    expect(departed.reputation.settledAtSeconds).toBe(0);
    const snapshot = requireDeparture(departed, 0);
    const stubUntil = livingMemberDuesOccupancyUntilSeconds(0, 0, DAY);
    expect(stubUntil).toBe(T.WALL_CLOCK_TICK_INTERVAL_SECONDS);
    const stub = livingMemberReputationForInterval(snapshot, 0, DAY, stubUntil);
    expect(stub).toBeGreaterThan(0);
    const settled = applyLivingMemberReputation(departed, DAY);
    expect(settled.reputation.creditedReputation).toBe(
      livingMemberReputationForWindow(
        departed.members,
        0,
        DAY,
        Object.freeze([{ member: snapshot, departedAtSeconds: 0 }]),
      ),
    );
    expect(settled.reputation.creditedReputation).toBeCloseTo(
      livingMemberReputationForWindow(departed.members, 0, DAY) + stub,
      10,
    );
    expect(settled.reputation.creditedReputation).not.toBe(
      livingMemberReputationForWindow(departed.members, 0, DAY),
    );
  });

  it('pro-rates a mid-window relocation arrival from joinedAtSeconds on the writer', () => {
    const roster = opening();
    const moved = reconcileLivingMemberRosterOnRelocation(
      roster,
      'storage-unit',
      Object.freeze([]),
      DAY / 2,
    );
    const newcomers = moved.members.slice(roster.members.length);
    expect(newcomers.length).toBeGreaterThan(0);
    expect(newcomers.every((member) => member.joinedAtSeconds === DAY / 2)).toBe(true);
    const settled = applyLivingMemberReputation(moved, DAY);
    expect(settled.reputation.creditedReputation).toBe(
      livingMemberReputationForWindow(moved.members, 0, DAY),
    );
    expect(settled.reputation.creditedReputation).toBeGreaterThan(
      livingMemberReputationForWindow(roster.members, 0, DAY),
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

  it('credits a played leave for the open GymHost tick of the following settle', () => {
    let state = createGymViewState();
    const gone = requireMember(state.livingMembers, 1);
    const openingMembers = state.livingMembers.members;
    for (let tick = 1; tick <= 10; tick += 1) {
      const current = livingMemberById(state.livingMembers, gone.id) ?? gone;
      state = gymViewReduce(state, {
        kind: 'apply-living-member-observations',
        observations: [adverse(current, tick)],
      });
    }
    expect(livingMemberById(state.livingMembers, gone.id)).toBeNull();
    expect(state.livingMembers.reputation.creditedReputation).toBe(0);
    expect(state.livingMembers.duesLeftAtSeconds[gone.id]).toBe(
      state.managed.gym.ladder.collectedAt,
    );
    const snapshot = requireDeparture(state.livingMembers, 0);
    const leftAt = state.livingMembers.duesLeftAtSeconds[gone.id];
    expect(leftAt).toBe(0);
    if (leftAt === undefined) throw new Error('expected gym-clock occupancy mark');
    const stubUntil = livingMemberDuesOccupancyUntilSeconds(leftAt, 0, DAY);
    expect(stubUntil).toBe(T.WALL_CLOCK_TICK_INTERVAL_SECONDS);
    const stub = livingMemberReputationForInterval(snapshot, 0, DAY, stubUntil);
    expect(stub).toBeGreaterThan(0);
    const next = gymViewReduce(state, { kind: 'advance-clock', gapSeconds: DAY, mode: 'online' });
    expect(next.livingMembers.reputation.creditedReputation).toBe(
      livingMemberReputationForWindow(
        next.livingMembers.members,
        0,
        DAY,
        Object.freeze([{ member: snapshot, departedAtSeconds: leftAt }]),
      ),
    );
    expect(next.livingMembers.reputation.creditedReputation).toBeCloseTo(
      livingMemberReputationForWindow(next.livingMembers.members, 0, DAY) + stub,
      10,
    );
    expect(next.livingMembers.reputation.creditedReputation).toBeGreaterThan(
      livingMemberReputationForWindow(next.livingMembers.members, 0, DAY),
    );
    expect(next.livingMembers.reputation.creditedReputation).toBeLessThan(
      livingMemberReputationForWindow(openingMembers, 0, DAY),
    );
    const archived = gymViewReduce(next, { kind: 'advance-clock', gapSeconds: DAY, mode: 'online' });
    expect(
      lastLivingMemberReputationSettlement(archived.livingMembers.reputation.settlements)
        ?.reputation,
    ).toBe(livingMemberReputationForWindow(next.livingMembers.members, DAY, DAY * 2));
    const replay = gymViewReduce(archived, { kind: 'advance-clock', gapSeconds: 0, mode: 'online' });
    expect(replay.livingMembers).toBe(archived.livingMembers);
  });
});

describe('Stage G.2E — high-paying vacancy gate', () => {
  it('pins the Athlete kit so the next vacancy type is Athlete', () => {
    expect(equipmentBiasedMemberTypes(ATHLETE_OWNED)).toEqual(['athlete']);
    expect(equipmentBiasedMemberTypes(sessionOwnedOnGym(ATHLETE_OWNED))).toEqual(['athlete']);
  });

  it('pins the Serious Lifter kit so the next vacancy type is Serious Lifter', () => {
    expect(equipmentBiasedMemberTypes(SERIOUS_OWNED)).toEqual(['serious-lifter']);
    expect(equipmentBiasedMemberTypes(sessionOwnedOnGym(SERIOUS_OWNED))).toEqual(['serious-lifter']);
  });

  for (const spec of HIGH_PAYING_KITS) {
    it(`does not mint a ${spec.label} into a vacancy while credited reputation is below the threshold`, () => {
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
        Object.freeze({ sessionOwned: spec.owned, joinedAtSeconds: 40 }),
      );
      expect(held.members.length).toBe(departed.members.length);
      expect(held.arrivals).toEqual([]);
    });

    it(`mints a ${spec.label} on recovery once credited reputation meets the threshold, and replay is a no-op`, () => {
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
        Object.freeze({ sessionOwned: spec.owned, joinedAtSeconds: 40 }),
      );
      expect(arrived.members.length).toBe(departed.members.length + 1);
      expect(arrived.members[arrived.members.length - 1]?.type).toBe(spec.type);
      const replay = applyServiceObservations(
        arrived,
        [tenth],
        undefined,
        Object.freeze({ sessionOwned: spec.owned, joinedAtSeconds: 40 }),
      );
      expect(replay).toBe(arrived);
    });
  }
});

describe('Stage G.2E — high-paying mint through gymViewReduce', () => {
  for (const spec of HIGH_PAYING_KITS) {
    it(`does not mint a ${spec.label} through apply-living-member-observations before advance-clock`, () => {
      const opened = withSessionOwned(createGymViewState(), spec.owned);
      expect(equipmentBiasedMemberTypes(opened.managed.gym.sessionEquipment)).toEqual([spec.type]);
      expect(opened.livingMembers.reputation.creditedReputation).toBe(0);
      const { state: departed, leftover } = departInteriorOnGym(opened);
      expect(departed.livingMembers.reputation.creditedReputation).toBe(0);
      const held = gymViewReduce(departed, {
        kind: 'apply-living-member-observations',
        observations: [stable(leftover, 11)],
      });
      expect(held.livingMembers.members.length).toBe(departed.livingMembers.members.length);
      expect(held.livingMembers.arrivals).toEqual([]);
      expect(held.livingMembers.members.some((member) => member.type === spec.type)).toBe(false);
    });

    it(`mints a ${spec.label} through apply-living-member-observations after advance-clock meets the gate`, () => {
      let state = withSessionOwned(createGymViewState(), spec.owned);
      expect(equipmentBiasedMemberTypes(state.managed.gym.sessionEquipment)).toEqual([spec.type]);
      state = gymViewReduce(state, { kind: 'advance-clock', gapSeconds: DAY * 3, mode: 'online' });
      expect(state.livingMembers.reputation.creditedReputation).toBeGreaterThanOrEqual(GATE);
      expect(state.livingMembers.reputation.settledAtSeconds).toBe(DAY * 3);
      const { state: departed, leftover } = departInteriorOnGym(state);
      expect(departed.livingMembers.reputation.creditedReputation).toBe(
        state.livingMembers.reputation.creditedReputation,
      );
      const attracting = stable(leftover, 11);
      const arrived = gymViewReduce(departed, {
        kind: 'apply-living-member-observations',
        observations: [attracting],
      });
      expect(arrived.livingMembers.members.length).toBe(departed.livingMembers.members.length + 1);
      expect(arrived.livingMembers.members[arrived.livingMembers.members.length - 1]?.type).toBe(
        spec.type,
      );
      const replay = gymViewReduce(arrived, {
        kind: 'apply-living-member-observations',
        observations: [attracting],
      });
      expect(replay.livingMembers).toBe(arrived.livingMembers);
    });
  }
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
