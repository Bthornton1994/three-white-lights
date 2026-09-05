/**
 * livingMemberDues.integration.test.ts — Stage G.2D causal-chain dues
 * settlement through the living roster writer: replay, fail-closed, join
 * pro-rate, departure exclusion, clock production path, and frozen C1–C3
 * membership behaviour.
 */

import { describe, expect, it } from 'vitest';

import { EMPIRE_TUNING } from './empireTuning';
import { placedOwnedItems } from './floor';
import type { FloorSimServiceObservation } from './floorSim';
import { gymViewReduce, createGymViewState } from './ladderView';
import { managedCheckIn } from './management';
import {
  createLivingMemberDuesSettlement,
  creditLivingMemberDuesGymBucks,
  lastLivingMemberDuesSettlement,
  livingMemberDailyDuesGymBucks,
  livingMemberDuesForWindow,
  playerFacingDuesLine,
} from './livingMemberDues';
import { livingMemberExperience } from './livingMemberExperience';
import {
  advanceLivingMemberTenure,
  applyLivingMemberDues,
  applyServiceObservations,
  createLivingMemberRoster,
  livingMemberById,
  reconcileLivingMemberRosterOnRelocation,
  type LivingGymMember,
  type LivingMemberRoster,
} from './livingMembers';
import { memberBaseDuesGymBucks, memberDuesGymBucks } from './members';

const T = EMPIRE_TUNING;
const KIT = Object.freeze([...T.LADDER_STARTING_EQUIPMENT]);
const DAY = T.SECONDS_PER_DAY;

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
  overrides: Partial<Pick<FloorSimServiceObservation, 'queueWaitTicks' | 'trainingExperience' | 'outcome'>> = {},
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
    ...overrides,
  });
}

function adverse(member: LivingGymMember, tick: number): FloorSimServiceObservation {
  return observation(member, tick);
}

function stock(member: LivingGymMember, tick: number): FloorSimServiceObservation {
  return observation(member, tick, {
    queueWaitTicks: 70,
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

describe('Stage G.2D — opening ledger', () => {
  it('starts settled at join time with nothing credited', () => {
    const roster = opening();
    expect(roster.dues.settledAtSeconds).toBe(0);
    expect(roster.dues.creditedGymBucks).toBe(0);
    expect(roster.dues.settlements).toEqual([]);
    expect(lastLivingMemberDuesSettlement(roster.dues.settlements)).toBeNull();
  });
});

describe('Stage G.2D — writer settlement', () => {
  it('credits forming bases for a one-day window on the opening garage roster', () => {
    const roster = opening();
    const expected = livingMemberDuesForWindow(roster.members, 0, DAY);
    expect(expected).toBeGreaterThan(0);
    const settled = applyLivingMemberDues(roster, DAY);
    expect(settled).not.toBe(roster);
    expect(settled.dues.settledAtSeconds).toBe(DAY);
    expect(settled.dues.creditedGymBucks).toBe(expected);
    expect(settled.members).toBe(roster.members);
    expect(settled.departures).toBe(roster.departures);
    expect(settled.arrivals).toBe(roster.arrivals);
    const record = lastLivingMemberDuesSettlement(settled.dues.settlements);
    expect(record).not.toBeNull();
    expect(record?.fromSeconds).toBe(0);
    expect(record?.toSeconds).toBe(DAY);
    expect(record?.gymBucks).toBe(expected);
  });

  it('is a full roster no-op on exact replay of the same settle mark', () => {
    const settled = applyLivingMemberDues(opening(), DAY);
    const replay = applyLivingMemberDues(settled, DAY);
    expect(replay).toBe(settled);
    expect(replay.dues.settlements.length).toBe(1);
    expect(replay.dues.creditedGymBucks).toBe(settled.dues.creditedGymBucks);
  });

  it('refuses a clock that runs backward', () => {
    const settled = applyLivingMemberDues(opening(), DAY);
    expect(() => applyLivingMemberDues(settled, DAY - 1)).toThrow(/earlier than last settled/);
  });

  it('refuses a non-finite or negative settle mark', () => {
    const roster = opening();
    expect(() => applyLivingMemberDues(roster, Number.NaN)).toThrow(/non-negative/);
    expect(() => applyLivingMemberDues(roster, -1)).toThrow(/non-negative/);
  });

  it('refuses the same from/to with a conflicting amount while the mark has not advanced', () => {
    const roster = opening();
    const expected = livingMemberDuesForWindow(roster.members, 0, DAY);
    const conflicting: LivingMemberRoster = Object.freeze({
      ...roster,
      dues: Object.freeze({
        settledAtSeconds: 0,
        creditedGymBucks: expected + 1,
        settlements: Object.freeze([createLivingMemberDuesSettlement(0, DAY, expected + 1)]),
      }),
    });
    expect(() => applyLivingMemberDues(conflicting, DAY)).toThrow(/conflicts/);
  });

  it('refuses an invalid join clock on a paying member', () => {
    const roster = opening();
    const broken = requireMember(roster, 0);
    const invalid: LivingMemberRoster = Object.freeze({
      ...roster,
      members: Object.freeze([
        Object.freeze({ ...broken, joinedAtSeconds: Number.NaN }),
        ...roster.members.slice(1),
      ]),
    });
    expect(() => applyLivingMemberDues(invalid, DAY)).toThrow(/joinedAtSeconds/);
  });

  it('accumulates contiguous windows without double-counting the first', () => {
    const first = applyLivingMemberDues(opening(), DAY);
    const second = applyLivingMemberDues(first, DAY * 2);
    expect(second.dues.settledAtSeconds).toBe(DAY * 2);
    expect(second.dues.settlements.length).toBe(2);
    expect(second.dues.creditedGymBucks).toBe(first.dues.creditedGymBucks * 2);
    expect(lastLivingMemberDuesSettlement(second.dues.settlements)?.fromSeconds).toBe(DAY);
  });
});

describe('Stage G.2D — formed experience changes what the next window pays', () => {
  it('does not rewrite already-settled forming dues when later service forms experience', () => {
    const roster = opening();
    const target = requireMember(roster, 0);
    const formingDay = applyLivingMemberDues(roster, DAY);
    const formed = applyServiceObservations(formingDay, [stock(target, 1)]);
    const experience = livingMemberExperience(formed.members[0]?.recentVisits ?? []);
    expect(experience.status).toBe('formed');
    expect(experience.composite).not.toBeNull();
    const nextDay = applyLivingMemberDues(formed, DAY * 2);
    const formedDaily = livingMemberDailyDuesGymBucks(requireMember(nextDay, 0));
    expect(formedDaily.status).toBe('formed');
    expect(formedDaily.gymBucksPerDay).toBe(
      memberDuesGymBucks(target.type, experience.composite as number),
    );
    const second = lastLivingMemberDuesSettlement(nextDay.dues.settlements);
    expect(formingDay.dues.creditedGymBucks).toBe(
      livingMemberDuesForWindow(roster.members, 0, DAY),
    );
    expect(second?.gymBucks).not.toBe(formingDay.dues.creditedGymBucks);
  });
});

describe('Stage G.2D — occupancy at the settle mark', () => {
  it('does not charge a member who already departed', () => {
    const roster = opening();
    const gone = requireMember(roster, 1);
    const departed = applyServiceObservations(applyAll(roster, gone, 9, adverse), [adverse(gone, 10)]);
    expect(departed.members.length).toBe(roster.members.length - 1);
    expect(livingMemberById(departed, gone.id)).toBeNull();
    const settled = applyLivingMemberDues(departed, DAY);
    expect(settled.dues.creditedGymBucks).toBe(
      livingMemberDuesForWindow(departed.members, 0, DAY),
    );
    expect(settled.dues.creditedGymBucks).toBeLessThan(
      livingMemberDuesForWindow(roster.members, 0, DAY),
    );
  });

  it('pro-rates a mid-window relocation arrival from joinedAtSeconds', () => {
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
    const settled = applyLivingMemberDues(moved, DAY);
    expect(settled.dues.creditedGymBucks).toBe(livingMemberDuesForWindow(moved.members, 0, DAY));
    expect(settled.dues.creditedGymBucks).toBeGreaterThan(
      livingMemberDuesForWindow(roster.members, 0, DAY),
    );
  });
});

describe('Stage G.2D — tenure advance still does not settle, mutate stay, or mint', () => {
  it('leaves dues and membership untouched', () => {
    const roster = opening();
    const advanced = advanceLivingMemberTenure(roster, DAY);
    expect(advanced).toBe(roster);
    expect(advanced.dues).toBe(roster.dues);
  });
});

describe('Stage G.2D — gymViewReduce clock is the production writer', () => {
  it('settles dues on advance-clock and credits that amount onto the spendable ladder purse', () => {
    const opened = createGymViewState();
    const purseBefore = opened.managed.gym.ladder.gymBucks;
    const next = gymViewReduce(opened, { kind: 'advance-clock', gapSeconds: DAY, mode: 'online' });
    expect(next.livingMembers.dues.settledAtSeconds).toBe(next.managed.gym.ladder.collectedAt);
    expect(next.livingMembers.dues.creditedGymBucks).toBe(
      livingMemberDuesForWindow(
        opened.livingMembers.members,
        0,
        next.managed.gym.ladder.collectedAt,
      ),
    );
    const inService = placedOwnedItems(
      opened.floor,
      opened.managed.gym.ladder.equipment,
      opened.managed.gym.sessionEquipment,
    );
    const independentlyChecked = managedCheckIn(
      opened.managed,
      opened.managed.gym.ladder.collectedAt + DAY,
      'online',
      inService,
    );
    expect(next.lastAccrual).toEqual(independentlyChecked.accrual);
    expect(next.managed.gym.ladder.gymBucks).toBe(
      creditLivingMemberDuesGymBucks(
        independentlyChecked.state.gym.ladder.gymBucks,
        next.livingMembers.dues.creditedGymBucks,
      ),
    );
    const ladderGain = next.managed.gym.ladder.gymBucks - purseBefore;
    const facilityGain =
      independentlyChecked.state.gym.ladder.gymBucks - purseBefore;
    expect(next.livingMembers.dues.creditedGymBucks).toBeGreaterThan(0);
    expect(facilityGain).toBeGreaterThan(0);
    expect(ladderGain).toBeGreaterThan(facilityGain);
    expect(ladderGain).not.toBe(next.livingMembers.dues.creditedGymBucks);
    const replay = gymViewReduce(next, { kind: 'advance-clock', gapSeconds: 0, mode: 'online' });
    expect(replay.livingMembers).toBe(next.livingMembers);
    expect(replay.managed.gym.ladder.gymBucks).toBe(next.managed.gym.ladder.gymBucks);
  });

  it('does not settle dues through apply-living-member-observations', () => {
    const opened = createGymViewState();
    const target = requireMember(opened.livingMembers, 0);
    const next = gymViewReduce(opened, {
      kind: 'apply-living-member-observations',
      observations: [stock(target, 1)],
    });
    expect(next.livingMembers.dues).toBe(opened.livingMembers.dues);
    expect(next.livingMembers.dues.creditedGymBucks).toBe(0);
  });
});

describe('Stage G.2D — player-facing line is the current rate', () => {
  it('matches the daily function for a formed member', () => {
    const roster = applyServiceObservations(opening(), [stock(requireMember(opening(), 0), 1)]);
    const member = requireMember(roster, 0);
    const daily = livingMemberDailyDuesGymBucks(member);
    expect(playerFacingDuesLine(daily)).toContain('DUES');
    expect(playerFacingDuesLine(daily)).toContain('gym bucks a day');
    expect(daily.gymBucksPerDay).not.toBe(memberBaseDuesGymBucks(member.type));
  });
});
