/**
 * livingMemberSeason.integration.test.ts — G2-ATHLETE-SEASON-01 through the
 * living roster writer and gym-clock reducer: leave/return, reserved seats,
 * occupancy, observation guard, and FloorSim identity.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { EMPIRE_TUNING } from './empireTuning';
import { createFloorState } from './floor';
import {
  createFloorSimState,
  reconcileFloorSimPopulation,
  type FloorSimContext,
  type FloorSimServiceObservation,
} from './floorSim';
import { createGymViewState, gymViewReduce, type GymViewState } from './ladderView';
import {
  lastLivingMemberDuesSettlement,
  livingMemberDailyDuesGymBucks,
  livingMemberDuesForWindow,
} from './livingMemberDues';
import {
  lastLivingMemberReputationSettlement,
  livingMemberDailyReputation,
  livingMemberReputationForWindow,
} from './livingMemberReputation';
import { lastLivingMemberSeasonEvent, playerFacingSeasonLine } from './livingMemberSeason';
import {
  applyLivingMemberDues,
  applyLivingMemberReputation,
  applyLivingMemberSeason,
  applyServiceObservations,
  createLivingMemberRoster,
  floorSimPopulationFromRoster,
  livingMemberById,
  reconcileLivingMemberRosterOnRelocation,
  settleLivingMemberClock,
  type LivingGymMember,
  type LivingMemberRoster,
} from './livingMembers';
import type { MemberType } from './members';
import type { SessionEquipmentItem } from './sessions';
import { stockStationCapability } from './stationCapability';

const T = EMPIRE_TUNING;
const KIT = Object.freeze([...T.LADDER_STARTING_EQUIPMENT]);
const WEEK = T.DAYS_PER_TRAINING_WEEK * T.SECONDS_PER_DAY;
const DAY = T.SECONDS_PER_DAY;
const LEAVE_AT = WEEK * T.ATHLETE_SEASON.firstInSeasonWeek;
const RETURN_AT = LEAVE_AT + WEEK * T.ATHLETE_SEASON.inSeasonWeeks;
const HERE = dirname(fileURLToPath(import.meta.url));

function opening(): LivingMemberRoster {
  return createLivingMemberRoster('garage', KIT, Object.freeze([]), 0, T.FLOOR_SIM_RENDER_SEED);
}

function requireMember(roster: LivingMemberRoster, index: number): LivingGymMember {
  const member = roster.members[index];
  if (member === undefined) throw new Error(`missing member at ${index}`);
  return member;
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

function withAthletes(roster: LivingMemberRoster, indexes: readonly number[]): LivingMemberRoster {
  let next = roster;
  for (const index of indexes) {
    next = withType(next, index, 'athlete');
  }
  return next;
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
  arrival: { readonly sessionOwned: readonly SessionEquipmentItem[]; readonly joinedAtSeconds: number } | null = null,
): LivingMemberRoster {
  let next = roster;
  const firstTick =
    (livingMemberById(roster, member.id)?.recentVisits.at(-1)?.observedAtTick ?? 0) + 1;
  for (let offset = 0; offset < count; offset += 1) {
    const current = livingMemberById(next, member.id);
    if (current === null) throw new Error(`lost ${member.id}`);
    next = applyServiceObservations(
      next,
      [factory(current, firstTick + offset)],
      undefined,
      arrival,
    );
  }
  return next;
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

function identityOf(member: LivingGymMember): {
  readonly id: string;
  readonly displayName: string;
  readonly type: MemberType;
  readonly joinedAtSeconds: number;
  readonly recentVisits: LivingGymMember['recentVisits'];
  readonly stayState: LivingGymMember['stayState'];
} {
  return Object.freeze({
    id: member.id,
    displayName: member.displayName,
    type: member.type,
    joinedAtSeconds: member.joinedAtSeconds,
    recentVisits: member.recentVisits,
    stayState: member.stayState,
  });
}

function withAthleteState(state: GymViewState, index = 0): GymViewState {
  return Object.freeze({
    ...state,
    livingMembers: withType(state.livingMembers, index, 'athlete'),
  });
}

describe('G2-ATHLETE-SEASON-01 — no Athletes stays today's clock', () => {
  it('matches dues+reputation composition across two season boundaries', () => {
    const roster = opening();
    expect(roster.members.every((member) => member.type !== 'athlete')).toBe(true);
    const mark = RETURN_AT + DAY;
    const composed = applyLivingMemberReputation(applyLivingMemberDues(roster, mark), mark);
    const settled = settleLivingMemberClock(roster, mark);
    expect(settled.dues).toEqual(composed.dues);
    expect(settled.reputation).toEqual(composed.reputation);
    expect(settled.members).toEqual(composed.members);
    expect(settled.departures).toEqual(composed.departures);
    expect(settled.arrivals).toEqual(composed.arrivals);
    expect(settled.nextOrdinal).toBe(composed.nextOrdinal);
    expect(settled.season.onLeave).toEqual([]);
    expect(settled.season.returns).toEqual([]);
    expect(settled.season.settledAtSeconds).toBe(mark);
  });
});

describe('G2-ATHLETE-SEASON-01 — leave at the in-season start', () => {
  it('parks the Athlete on onLeave, holds archives, and bills only through the boundary', () => {
    const roster = withType(opening(), 0, 'athlete');
    const athlete = requireMember(roster, 0);
    const beforeIds = roster.members.map((member) => member.id);
    const mark = LEAVE_AT + DAY;
    const left = settleLivingMemberClock(roster, mark);
    expect(livingMemberById(left, athlete.id)).toBeNull();
    expect(left.season.onLeave).toHaveLength(1);
    expect(left.season.onLeave[0]?.member.id).toBe(athlete.id);
    expect(left.season.onLeave[0]?.member).toBe(athlete);
    expect(left.season.onLeave[0]?.leftAtSeconds).toBe(LEAVE_AT);
    expect(left.departures).toEqual([]);
    expect(left.arrivals).toEqual([]);
    expect(left.nextOrdinal).toBe(roster.nextOrdinal);
    expect(left.duesLeftAtSeconds).toEqual({});
    expect(left.members.map((member) => member.id)).toEqual(beforeIds.filter((id) => id !== athlete.id));
    expect(left.dues.settlements).toHaveLength(2);
    expect(left.dues.settlements[0]?.fromSeconds).toBe(0);
    expect(left.dues.settlements[0]?.toSeconds).toBe(LEAVE_AT);
    expect(left.dues.settlements[1]?.fromSeconds).toBe(LEAVE_AT);
    expect(left.dues.settlements[1]?.toSeconds).toBe(mark);
    const athleteRate = livingMemberDailyDuesGymBucks(athlete).gymBucksPerDay;
    expect(athleteRate).toBe(T.MEMBER_DUES_GYM_BUCKS_PER_DAY.athlete);
    const firstWithout = livingMemberDuesForWindow(
      roster.members.filter((member) => member.id !== athlete.id),
      0,
      LEAVE_AT,
    );
    expect(left.dues.settlements[0]?.gymBucks).toBe(firstWithout + athleteRate * (LEAVE_AT / DAY));
    const secondWithout = livingMemberDuesForWindow(left.members, LEAVE_AT, mark);
    expect(left.dues.settlements[1]?.gymBucks).toBe(secondWithout);
    const repRate = livingMemberDailyReputation(athlete);
    expect(repRate).toBe(T.MEMBER_TYPE_REPUTATION_PER_MEMBER_PER_DAY.athlete);
    const firstRepWithout = livingMemberReputationForWindow(
      roster.members.filter((member) => member.id !== athlete.id),
      0,
      LEAVE_AT,
    );
    expect(left.reputation.settlements[0]?.reputation).toBe(firstRepWithout + repRate * (LEAVE_AT / DAY));
    expect(left.reputation.settlements[1]?.reputation).toBe(
      livingMemberReputationForWindow(left.members, LEAVE_AT, mark),
    );
    const event = lastLivingMemberSeasonEvent(left.season);
    expect(event?.kind).toBe('leave');
    expect(playerFacingSeasonLine(event!)).toBe(`${athlete.displayName} is away for the season.`);
  });
});

describe('G2-ATHLETE-SEASON-01 — return at the in-season end', () => {
  it('reinserts the same identity and bills only from the return mark', () => {
    const roster = withType(opening(), 0, 'athlete');
    const athlete = requireMember(roster, 0);
    const snapshot = identityOf(athlete);
    const left = settleLivingMemberClock(roster, LEAVE_AT + DAY);
    const back = settleLivingMemberClock(left, RETURN_AT + DAY);
    const returned = livingMemberById(back, athlete.id);
    expect(returned).not.toBeNull();
    expect(identityOf(returned as LivingGymMember)).toEqual(snapshot);
    expect(returned).toBe(left.season.onLeave[0]?.member);
    expect(back.season.onLeave).toEqual([]);
    expect(back.season.returns).toHaveLength(1);
    expect(back.season.returns[0]?.returnedAtSeconds).toBe(RETURN_AT);
    expect(back.season.returns[0]?.member.id).toBe(athlete.id);
    expect(back.departures).toEqual([]);
    expect(back.arrivals).toEqual([]);
    expect(back.nextOrdinal).toBe(roster.nextOrdinal);
    const last = lastLivingMemberDuesSettlement(back.dues.settlements);
    expect(last?.fromSeconds).toBe(RETURN_AT);
    expect(last?.toSeconds).toBe(RETURN_AT + DAY);
    const others = back.members.filter((member) => member.id !== athlete.id);
    expect(last?.gymBucks).toBe(
      livingMemberDuesForWindow(others, RETURN_AT, RETURN_AT + DAY) +
        livingMemberDailyDuesGymBucks(athlete).gymBucksPerDay,
    );
    const lastRep = lastLivingMemberReputationSettlement(back.reputation.settlements);
    expect(lastRep?.reputation).toBe(
      livingMemberReputationForWindow(others, RETURN_AT, RETURN_AT + DAY) +
        livingMemberDailyReputation(athlete),
    );
    expect(playerFacingSeasonLine(lastLivingMemberSeasonEvent(back.season)!)).toBe(
      `${athlete.displayName} is back from the season.`,
    );
  });
});

describe('G2-ATHLETE-SEASON-01 — one advance spanning leave and return', () => {
  it('produces three settlements and both transitions', () => {
    const roster = withType(opening(), 0, 'athlete');
    const athlete = requireMember(roster, 0);
    const jumped = settleLivingMemberClock(roster, RETURN_AT + DAY);
    expect(jumped.dues.settlements).toHaveLength(3);
    expect(jumped.dues.settlements.map((row) => [row.fromSeconds, row.toSeconds])).toEqual([
      [0, LEAVE_AT],
      [LEAVE_AT, RETURN_AT],
      [RETURN_AT, RETURN_AT + DAY],
    ]);
    expect(livingMemberById(jumped, athlete.id)).not.toBeNull();
    expect(jumped.season.onLeave).toEqual([]);
    expect(jumped.season.returns).toHaveLength(1);
    const segmented = settleLivingMemberClock(
      settleLivingMemberClock(roster, LEAVE_AT + DAY),
      RETURN_AT + DAY,
    );
    expect(jumped.dues.creditedGymBucks).toBe(segmented.dues.creditedGymBucks);
    expect(jumped.reputation.creditedReputation).toBe(segmented.reputation.creditedReputation);
    expect(jumped.members.map((member) => member.id).sort()).toEqual(
      segmented.members.map((member) => member.id).sort(),
    );
  });
});

describe('G2-ATHLETE-SEASON-01 — idempotence and fail-closed', () => {
  it('replays the same mark as identity and refuses earlier or non-finite marks', () => {
    const roster = withType(opening(), 0, 'athlete');
    const settled = settleLivingMemberClock(roster, LEAVE_AT);
    expect(settleLivingMemberClock(settled, LEAVE_AT)).toBe(settled);
    expect(applyLivingMemberSeason(settled, LEAVE_AT)).toBe(settled);
    expect(() => settleLivingMemberClock(settled, LEAVE_AT - 1)).toThrow(/earlier than last settled/);
    expect(() => applyLivingMemberSeason(roster, Number.NaN)).toThrow(/non-negative/);
    expect(() => applyLivingMemberSeason(roster, -1)).toThrow(/non-negative/);
  });

  it('refuses a dues/reputation ledger split', () => {
    const roster = opening();
    const duesOnly = applyLivingMemberDues(roster, DAY);
    expect(() => settleLivingMemberClock(duesOnly, DAY * 2)).toThrow(/out of sync/);
  });
});

describe('G2-ATHLETE-SEASON-01 — vacancy and relocation hold the seat', () => {
  it('does not mint into a reserved seat, and a real vacancy still fills', () => {
    const roster = withType(opening(), 0, 'athlete');
    const leftover = requireMember(roster, 1);
    const left = settleLivingMemberClock(roster, LEAVE_AT);
    expect(left.members.length + left.season.onLeave.length).toBe(
      T.AMBIENT_MEMBER_COUNT_BY_RUNG.garage,
    );
    const arrival = Object.freeze({
      sessionOwned: Object.freeze([]) as readonly SessionEquipmentItem[],
      joinedAtSeconds: LEAVE_AT,
    });
    const attracted = applyServiceObservations(left, [stable(leftover, 1)], undefined, arrival);
    expect(attracted.members.length).toBe(left.members.length);
    expect(attracted.arrivals).toEqual([]);
    const departed = applyAll(left, leftover, 10, adverse);
    expect(livingMemberById(departed, leftover.id)).toBeNull();
    const server = requireMember(departed, 0);
    const filled = applyServiceObservations(
      departed,
      [stable(server, 20)],
      undefined,
      arrival,
    );
    expect(filled.arrivals).toHaveLength(1);
    const back = settleLivingMemberClock(filled, RETURN_AT);
    expect(back.members.length).toBeLessThanOrEqual(T.AMBIENT_MEMBER_COUNT_BY_RUNG.garage);
    expect(back.members.length + back.season.onLeave.length).toBeLessThanOrEqual(
      T.AMBIENT_MEMBER_COUNT_BY_RUNG.garage,
    );
    const context = contextWithRoster(back);
    const started = createFloorSimState(contextWithRoster(filled), T.FLOOR_SIM_RENDER_SEED);
    expect(() => reconcileFloorSimPopulation(started, context)).not.toThrow();
    expect(reconcileFloorSimPopulation(started, context).members.map((row) => row.memberId)).toEqual(
      back.members.map((member) => member.id),
    );
  });

  it('relocation appends cap minus active minus onLeave', () => {
    const roster = withType(opening(), 0, 'athlete');
    const left = settleLivingMemberClock(roster, LEAVE_AT);
    const occupied = left.members.length + left.season.onLeave.length;
    const moved = reconcileLivingMemberRosterOnRelocation(
      left,
      'storage-unit',
      Object.freeze([]),
      LEAVE_AT,
    );
    expect(moved.season.onLeave).toEqual(left.season.onLeave);
    expect(moved.members.length).toBe(T.AMBIENT_MEMBER_COUNT_BY_RUNG['storage-unit'] - left.season.onLeave.length);
    expect(moved.members.length + moved.season.onLeave.length).toBe(
      T.AMBIENT_MEMBER_COUNT_BY_RUNG['storage-unit'],
    );
    expect(occupied).toBe(T.AMBIENT_MEMBER_COUNT_BY_RUNG.garage);
  });
});

describe('G2-ATHLETE-SEASON-01 — non-Athletes and C2 after a season', () => {
  it('never parks a non-Athlete on onLeave', () => {
    const roster = opening();
    const crossed = settleLivingMemberClock(roster, RETURN_AT);
    expect(crossed.season.onLeave).toEqual([]);
    expect(crossed.members.map((member) => member.type)).not.toContain('athlete');
  });

  it('lets a still-eligible Athlete depart through C2 after return', () => {
    const roster = withType(opening(), 0, 'athlete');
    const athlete = requireMember(roster, 0);
    const eligible = applyAll(roster, athlete, 9, adverse);
    expect(livingMemberById(eligible, athlete.id)?.stayState.status).toBe('departure-eligible');
    const back = settleLivingMemberClock(eligible, RETURN_AT);
    const returned = livingMemberById(back, athlete.id);
    expect(returned?.stayState.status).toBe('departure-eligible');
    const gone = applyServiceObservations(back, [adverse(returned as LivingGymMember, 20)]);
    expect(livingMemberById(gone, athlete.id)).toBeNull();
    expect(gone.departures[0]?.member.id).toBe(athlete.id);
    expect(gone.season.onLeave.some((record) => record.member.id === athlete.id)).toBe(false);
  });
});

describe('G2-ATHLETE-SEASON-01 — observation guard and FloorSim', () => {
  it('replays the latest on-leave visit and refuses any other', () => {
    const roster = withType(opening(), 0, 'athlete');
    const athlete = requireMember(roster, 0);
    const visited = applyServiceObservations(roster, [stable(athlete, 3)]);
    const current = livingMemberById(visited, athlete.id) as LivingGymMember;
    const left = settleLivingMemberClock(visited, LEAVE_AT);
    const replay = applyServiceObservations(left, [stable(current, 3)]);
    expect(replay).toBe(left);
    expect(() => applyServiceObservations(left, [stable(current, 4)])).toThrow(
      /names member on season leave/,
    );
    expect(() => applyServiceObservations(left, [stable(current, 4)])).not.toThrow(
      /unknown member/,
    );
  });

  it('drops the FloorSim body on leave and restores the same id on return', () => {
    const roster = withType(opening(), 0, 'athlete');
    const athlete = requireMember(roster, 0);
    const leftover = requireMember(roster, 1);
    const started = createFloorSimState(contextWithRoster(roster), T.FLOOR_SIM_RENDER_SEED);
    const left = settleLivingMemberClock(roster, LEAVE_AT);
    const afterLeave = reconcileFloorSimPopulation(started, contextWithRoster(left));
    expect(afterLeave.members.some((row) => row.memberId === athlete.id)).toBe(false);
    const leftoverBefore = started.members.find((row) => row.memberId === leftover.id);
    const leftoverAfter = afterLeave.members.find((row) => row.memberId === leftover.id);
    expect(leftoverAfter?.cell).toEqual(leftoverBefore?.cell);
    expect(leftoverAfter?.state).toBe(leftoverBefore?.state);
    const back = settleLivingMemberClock(left, RETURN_AT);
    const afterReturn = reconcileFloorSimPopulation(afterLeave, contextWithRoster(back));
    expect(afterReturn.members.some((row) => row.memberId === athlete.id)).toBe(true);
    expect(afterReturn.members.find((row) => row.memberId === athlete.id)?.state).toBe('seeking');
  });

  it('clock-then-observation and observation-then-clock both fail closed on an away id', () => {
    const opened = withAthleteState(createGymViewState());
    const athlete = requireMember(opened.livingMembers, 0);
    const visited = gymViewReduce(opened, {
      kind: 'apply-living-member-observations',
      observations: [stable(athlete, 1)],
    });
    const current = livingMemberById(visited.livingMembers, athlete.id) as LivingGymMember;
    const clockFirst = gymViewReduce(visited, { kind: 'advance-clock', gapSeconds: LEAVE_AT });
    expect(livingMemberById(clockFirst.livingMembers, athlete.id)).toBeNull();
    expect(() =>
      gymViewReduce(clockFirst, {
        kind: 'apply-living-member-observations',
        observations: [stable(current, 2)],
      }),
    ).toThrow(/names member on season leave/);
    const observeFirst = gymViewReduce(visited, {
      kind: 'apply-living-member-observations',
      observations: [stable(current, 2)],
    });
    const thenClock = gymViewReduce(observeFirst, { kind: 'advance-clock', gapSeconds: LEAVE_AT });
    expect(livingMemberById(thenClock.livingMembers, athlete.id)).toBeNull();
    expect(thenClock.lastRefusal).toBeNull();
  });
});

describe('G2-ATHLETE-SEASON-01 — reducer purse and modes', () => {
  it('credits exactly the dues delta on advance-clock across a leave boundary', () => {
    const opened = withAthleteState(createGymViewState());
    const next = gymViewReduce(opened, { kind: 'advance-clock', gapSeconds: LEAVE_AT, mode: 'offline' });
    expect(next.lastRefusal).toBeNull();
    expect(next.livingMembers.season.onLeave).toHaveLength(1);
    const writer = settleLivingMemberClock(opened.livingMembers, next.managed.gym.ladder.collectedAt);
    expect(next.livingMembers.dues.creditedGymBucks).toBe(writer.dues.creditedGymBucks);
    expect(next.livingMembers.dues.creditedGymBucks).toBeGreaterThan(0);
    const online = gymViewReduce(opened, { kind: 'advance-clock', gapSeconds: LEAVE_AT, mode: 'online' });
    expect(online.livingMembers.season).toEqual(next.livingMembers.season);
    expect(online.livingMembers.members.map((member) => member.id)).toEqual(
      next.livingMembers.members.map((member) => member.id),
    );
  });

  it('reset-gym clears the season ledger', () => {
    const opened = withAthleteState(createGymViewState());
    const left = gymViewReduce(opened, { kind: 'advance-clock', gapSeconds: LEAVE_AT });
    expect(left.livingMembers.season.onLeave.length).toBeGreaterThan(0);
    const reset = gymViewReduce(left, { kind: 'reset-gym' });
    expect(reset.livingMembers.season.onLeave).toEqual([]);
    expect(reset.livingMembers.season.returns).toEqual([]);
    expect(reset.livingMembers.season.settledAtSeconds).toBe(0);
  });

  it('keeps experience and pressure frozen across an away spell', () => {
    const roster = withType(opening(), 0, 'athlete');
    const athlete = requireMember(roster, 0);
    const visited = applyServiceObservations(roster, [stable(athlete, 1)]);
    const before = livingMemberById(visited, athlete.id) as LivingGymMember;
    const back = settleLivingMemberClock(visited, RETURN_AT);
    const after = livingMemberById(back, athlete.id) as LivingGymMember;
    expect(after.recentVisits).toEqual(before.recentVisits);
    expect(after.stayState).toEqual(before.stayState);
  });
});

describe('G2-ATHLETE-SEASON-01 — zero, one, and several Athletes', () => {
  it('leaves and returns every Athlete together and never a Casual', () => {
    const roster = withAthletes(opening(), [0, 1]);
    const third = requireMember(roster, 2);
    const left = settleLivingMemberClock(roster, LEAVE_AT);
    expect(left.season.onLeave).toHaveLength(2);
    expect(left.members).toHaveLength(1);
    expect(left.members[0]?.id).toBe(third.id);
    const back = settleLivingMemberClock(left, RETURN_AT);
    expect(back.season.onLeave).toEqual([]);
    expect(back.members).toHaveLength(3);
  });

  it('keeps a mid-season mint until the next leave boundary', () => {
    const roster = withType(opening(), 0, 'athlete');
    const leftover = requireMember(roster, 1);
    const left = settleLivingMemberClock(roster, LEAVE_AT);
    const departed = applyAll(left, leftover, 10, adverse);
    const server = requireMember(departed, 0);
    const filled = applyServiceObservations(
      departed,
      [stable(server, 20)],
      undefined,
      Object.freeze({
        sessionOwned: Object.freeze(['sled', 'bike', 'treadmill', 'rower']) as readonly SessionEquipmentItem[],
        joinedAtSeconds: LEAVE_AT + DAY,
      }),
    );
    const minted = filled.members[filled.members.length - 1];
    expect(minted).toBeDefined();
    const stillIn = settleLivingMemberClock(filled, LEAVE_AT + WEEK);
    if (minted !== undefined && minted.type === 'athlete') {
      expect(livingMemberById(stillIn, minted.id)).not.toBeNull();
    }
    const nextLeave = settleLivingMemberClock(filled, WEEK * 10);
    if (minted !== undefined && minted.type === 'athlete') {
      expect(livingMemberById(nextLeave, minted.id)).toBeNull();
      expect(nextLeave.season.onLeave.some((record) => record.member.id === minted.id)).toBe(true);
    }
  });
});

describe('G2-ATHLETE-SEASON-01 — FloorGrid notice wiring', () => {
  it('names the last season event on the floor without countdown copy', () => {
    const source = readFileSync(join(HERE, 'FloorGrid.tsx'), 'utf8');
    expect(source).toMatch(/floorgrid-season-notice/);
    expect(source).toMatch(/playerFacingSeasonLine/);
    expect(source).toMatch(/lastLivingMemberSeasonEvent/);
    expect(source).not.toMatch(/g2f-/);
    expect(source).not.toMatch(/back in \d/);
  });
});
