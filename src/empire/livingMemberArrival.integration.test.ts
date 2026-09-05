/**
 * livingMemberArrival.integration.test.ts — Stage G.2C3 causal-chain vacancy
 * arrival, identity continuity, FloorSim minting, and replay/fail-closed.
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
import {
  lastLivingMemberArrival,
  livingMemberShouldArrive,
  playerFacingArrivalLine,
  type LivingMemberArrivalContext,
} from './livingMemberArrival';
import { lastLivingMemberDeparture } from './livingMemberDeparture';
import { livingMemberExperience } from './livingMemberExperience';
import { livingMemberRetentionPressure } from './livingMemberRetention';
import { livingMemberStayEvidence } from './livingMemberStay';
import {
  advanceLivingMemberTenure,
  applyServiceObservations,
  createLivingMemberRoster,
  deriveMemberId,
  floorSimPopulationFromRoster,
  livingMemberById,
  LIVING_MEMBER_GIVEN_NAMES,
  memberOrdinalFromId,
  type GymMemberId,
  type LivingGymMember,
  type LivingMemberRoster,
  type ServiceVisitRecord,
} from './livingMembers';
import { equipmentBiasedMemberTypes, type MemberType } from './members';
import type { SessionEquipmentItem } from './sessions';
import { stockStationCapability } from './stationCapability';

const T = EMPIRE_TUNING;
const KIT = Object.freeze([...T.LADDER_STARTING_EQUIPMENT]);
const HERE = dirname(fileURLToPath(import.meta.url));

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

/**
 * Stock-completed wait that independently classifies as G.2B Watching without
 * a wait reason (Manageable wait, service-only reasons). queueWaitTicks 20 is
 * Easy / Stable / recovery — too good to prove formed-neutral attraction.
 * The type-treatment test re-derives G.2A → G.2B → G.2C1 on the visit rather
 * than trusting this number.
 */
const WATCHING_WITHOUT_WAIT_TICKS = 70;

function watchingNoWait(member: LivingGymMember, tick: number): FloorSimServiceObservation {
  return observation(member, tick, {
    queueWaitTicks: WATCHING_WITHOUT_WAIT_TICKS,
    trainingExperience: T.STATION_STOCK_TRAINING_EXPERIENCE,
    outcome: 'completed',
  });
}

function visitFromObservation(observation: FloorSimServiceObservation): ServiceVisitRecord {
  return Object.freeze({
    stationKind: observation.stationKind,
    stationKey: observation.stationKey,
    queueWaitTicks: observation.queueWaitTicks,
    trainingExperience: observation.trainingExperience,
    outcome: observation.outcome,
    observedAtTick: observation.observedAtTick,
  });
}

function independentVisitClassification(
  memberType: MemberType,
  serving: FloorSimServiceObservation,
) {
  const experience = livingMemberExperience(Object.freeze([visitFromObservation(serving)]));
  const retention = livingMemberRetentionPressure(experience);
  const evidence = livingMemberStayEvidence(memberType, retention);
  return { experience, retention, evidence };
}

const STOCK_ARRIVAL: LivingMemberArrivalContext = Object.freeze({
  sessionOwned: Object.freeze([]),
  joinedAtSeconds: 40,
});

function applyAll(
  roster: LivingMemberRoster,
  member: LivingGymMember,
  count: number,
  factory: (member: LivingGymMember, tick: number) => FloorSimServiceObservation,
  firstTick: number = 1,
  arrival: LivingMemberArrivalContext | null = null,
): LivingMemberRoster {
  let next = roster;
  for (let offset = 0; offset < count; offset += 1) {
    const current = livingMemberById(next, member.id) ?? member;
    next = applyServiceObservations(next, [factory(current, firstTick + offset)], undefined, arrival);
  }
  return next;
}

function departInterior(roster: LivingMemberRoster): {
  readonly departed: LivingMemberRoster;
  readonly leftover: LivingGymMember;
  readonly gone: LivingGymMember;
} {
  const gone = requireMember(roster, 1);
  const leftover = requireMember(roster, 0);
  const departed = applyServiceObservations(applyAll(roster, gone, 9, adverse), [adverse(gone, 10)]);
  return { departed, leftover: livingMemberById(departed, leftover.id) ?? leftover, gone };
}

function nextArrivalType(
  roster: LivingMemberRoster,
  sessionOwned: readonly SessionEquipmentItem[],
) {
  const biased = equipmentBiasedMemberTypes(sessionOwned);
  return biased[roster.members.length % biased.length];
}

function idsOf(roster: LivingMemberRoster): readonly string[] {
  return roster.members.map((member) => member.id);
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

describe('Stage G.2C3 — vacancy arrival execution', () => {
  it('does not mint without arrival context, even on Stable service in a vacancy', () => {
    const { departed, leftover } = departInterior(opening());
    expect(departed.members.length).toBe(T.AMBIENT_MEMBER_COUNT_BY_RUNG.garage - 1);
    const after = applyServiceObservations(departed, [stable(leftover, 11)]);
    expect(after.members.length).toBe(departed.members.length);
    expect(after.arrivals).toEqual([]);
    expect(after.nextOrdinal).toBe(departed.nextOrdinal);
  });

  it('does not mint from the observation that executes a departure', () => {
    const roster = opening();
    const gone = requireMember(roster, 1);
    const eligible = applyAll(roster, gone, 9, adverse, 1, STOCK_ARRIVAL);
    expect(eligible.members.length).toBe(3);
    const left = applyServiceObservations(eligible, [adverse(gone, 10)], undefined, STOCK_ARRIVAL);
    expect(livingMemberById(left, gone.id)).toBeNull();
    expect(left.members.length).toBe(2);
    expect(left.arrivals).toEqual([]);
    expect(lastLivingMemberDeparture(left.departures)?.member.id).toBe(gone.id);
  });

  it('mints one member into a vacancy after a later attraction-qualifying visit', () => {
    const { departed, leftover } = departInterior(opening());
    const expectedType = nextArrivalType(departed, STOCK_ARRIVAL.sessionOwned);
    const after = applyServiceObservations(departed, [stable(leftover, 11)], undefined, STOCK_ARRIVAL);
    expect(after.members.length).toBe(departed.members.length + 1);
    expect(after.nextOrdinal).toBe(departed.nextOrdinal + 1);
    const joined = after.members[after.members.length - 1];
    expect(joined).toBeDefined();
    if (joined === undefined) return;
    expect(joined.id).toBe(deriveMemberId(departed.identityNonce, departed.nextOrdinal));
    expect(joined.displayName).toBe(LIVING_MEMBER_GIVEN_NAMES[departed.nextOrdinal]);
    expect(joined.type).toBe(expectedType);
    expect(joined.joinedAtSeconds).toBe(STOCK_ARRIVAL.joinedAtSeconds);
    expect(joined.recentVisits).toEqual([]);
    expect(joined.stayState.status).toBe('forming');
    expect(memberOrdinalFromId(joined.id)).toBe(departed.nextOrdinal);
    expect(after.departures.map((record) => record.member.id)).toEqual(
      departed.departures.map((record) => record.member.id),
    );
    const record = lastLivingMemberArrival(after.arrivals);
    expect(record?.member.id).toBe(joined.id);
    expect(record?.attractedById).toBe(leftover.id);
    expect(record?.arrivedAtTick).toBe(11);
    expect(playerFacingArrivalLine(record!)).toBe(`${joined.displayName} joined the gym.`);
  });

  it('exact replay of the attracting observation is a full roster no-op', () => {
    const { departed, leftover } = departInterior(opening());
    const tenth = stable(leftover, 11);
    const arrived = applyServiceObservations(departed, [tenth], undefined, STOCK_ARRIVAL);
    const replay = applyServiceObservations(arrived, [tenth], undefined, STOCK_ARRIVAL);
    expect(replay).toBe(arrived);
    expect(replay.members.length).toBe(arrived.members.length);
    expect(replay.nextOrdinal).toBe(arrived.nextOrdinal);
    expect(replay.arrivals.length).toBe(1);
  });

  it('same-tick conflict on the attracting observation fails closed', () => {
    const { departed, leftover } = departInterior(opening());
    const tenth = stable(leftover, 11);
    const arrived = applyServiceObservations(departed, [tenth], undefined, STOCK_ARRIVAL);
    expect(() =>
      applyServiceObservations(
        arrived,
        [
          observation(leftover, 11, {
            queueWaitTicks: 1,
            trainingExperience: T.STATION_QUALITY_TRAINING_EXPERIENCE,
            outcome: 'completed',
          }),
        ],
        undefined,
        STOCK_ARRIVAL,
      ),
    ).toThrow(/conflicts with member/);
  });

  it('strained service in a vacancy does not mint', () => {
    const { departed, leftover } = departInterior(opening());
    const after = applyServiceObservations(departed, [adverse(leftover, 11)], undefined, STOCK_ARRIVAL);
    expect(after.members.length).toBe(departed.members.length);
    expect(after.arrivals).toEqual([]);
  });

  it('does not mint past the ambient cap', () => {
    const roster = opening();
    const leftover = requireMember(roster, 0);
    const after = applyServiceObservations(roster, [stable(leftover, 1)], undefined, STOCK_ARRIVAL);
    expect(after.members.length).toBe(T.AMBIENT_MEMBER_COUNT_BY_RUNG.garage);
    expect(after.arrivals).toEqual([]);
  });

  it('does not reuse a departed ordinal', () => {
    const { departed, leftover, gone } = departInterior(opening());
    const after = applyServiceObservations(departed, [stable(leftover, 11)], undefined, STOCK_ARRIVAL);
    const joined = after.members[after.members.length - 1];
    expect(joined?.id).not.toBe(gone.id);
    expect(memberOrdinalFromId(joined!.id)).toBeGreaterThan(memberOrdinalFromId(gone.id));
    expect(idsOf(after)).not.toContain(gone.id);
  });

  it('offline clock advance does not mint', () => {
    const { departed } = departInterior(opening());
    expect(advanceLivingMemberTenure(departed, 86_400)).toBe(departed);
  });

  it('fails closed on invalid arrival join-clock', () => {
    const { departed, leftover } = departInterior(opening());
    expect(() =>
      applyServiceObservations(departed, [stable(leftover, 11)], undefined, {
        sessionOwned: Object.freeze([]),
        joinedAtSeconds: Number.NaN,
      }),
    ).toThrow(/joinedAtSeconds/);
  });
});

describe('Stage G.2C3 — type treatment at the arrival boundary', () => {
  const CASUAL_OWNED: readonly SessionEquipmentItem[] = Object.freeze([
    'bike',
    'treadmill',
    'rower',
    'machines',
    'mats',
  ]);
  const SERIOUS_OWNED: readonly SessionEquipmentItem[] = Object.freeze([
    'foam-rollers',
    'sauna',
    'belts',
    'sleeves',
    'wrist-wraps',
    'machines',
  ]);

  it('pins the Casual kit so the next vacancy type is Casual', () => {
    expect(equipmentBiasedMemberTypes(CASUAL_OWNED)).toEqual(['casual']);
  });

  it('pins the Serious Lifter kit so the next vacancy type is Serious Lifter', () => {
    expect(equipmentBiasedMemberTypes(SERIOUS_OWNED)).toEqual(['serious-lifter']);
  });

  it('lets Casual join on independently classified formed-neutral Watching without wait, and does not let Serious Lifter', () => {
    const { departed, leftover } = departInterior(opening());
    const serving = watchingNoWait(leftover, 11);
    const { retention, evidence } = independentVisitClassification(leftover.type, serving);
    expect(retention.label).toBe('Watching');
    expect(retention.reasons.some((reason) => reason.kind === 'wait')).toBe(false);
    expect(evidence).toBe('neutral');
    expect(livingMemberShouldArrive(1, 'casual', evidence)).toBe(true);
    expect(livingMemberShouldArrive(1, 'serious-lifter', evidence)).toBe(false);

    expect(nextArrivalType(departed, CASUAL_OWNED)).toBe('casual');
    const casualArrival: LivingMemberArrivalContext = Object.freeze({
      sessionOwned: CASUAL_OWNED,
      joinedAtSeconds: 40,
    });
    const casualJoined = applyServiceObservations(departed, [serving], undefined, casualArrival);
    expect(casualJoined.members.length).toBe(departed.members.length + 1);
    expect(casualJoined.members[casualJoined.members.length - 1]?.type).toBe('casual');

    expect(nextArrivalType(departed, SERIOUS_OWNED)).toBe('serious-lifter');
    const seriousArrival: LivingMemberArrivalContext = Object.freeze({
      sessionOwned: SERIOUS_OWNED,
      joinedAtSeconds: 40,
    });
    const seriousHeld = applyServiceObservations(departed, [serving], undefined, seriousArrival);
    expect(seriousHeld.members.length).toBe(departed.members.length);
    expect(seriousHeld.arrivals).toEqual([]);
  });

  it('does not substitute a different type when attraction is not met', () => {
    const { departed, leftover } = departInterior(opening());
    const arrival: LivingMemberArrivalContext = Object.freeze({
      sessionOwned: CASUAL_OWNED,
      joinedAtSeconds: 40,
    });
    const strained = applyServiceObservations(departed, [adverse(leftover, 11)], undefined, arrival);
    expect(strained.members.length).toBe(departed.members.length);
    expect(strained.arrivals).toEqual([]);
    expect(nextArrivalType(strained, CASUAL_OWNED)).toBe('casual');
  });
});

describe('Stage G.2C3 — FloorSim mint and FloorGrid notice', () => {
  it('reconcile mints a seeking body for the arrived id and keeps survivors', () => {
    const roster = opening();
    const { departed, leftover } = departInterior(roster);
    const context = contextWithRoster(departed);
    const started = createFloorSimState(context, T.FLOOR_SIM_RENDER_SEED);
    const arrived = applyServiceObservations(departed, [stable(leftover, 11)], undefined, STOCK_ARRIVAL);
    const joined = arrived.members[arrived.members.length - 1];
    expect(joined).toBeDefined();
    const afterContext = contextWithRoster(arrived);
    const minted = reconcileFloorSimPopulation(started, afterContext);
    expect(minted.members.map((member) => member.memberId)).toEqual(idsOf(arrived));
    expect(minted.members.find((member) => member.memberId === joined?.id)?.state).toBe('seeking');
    const leftoverBefore = started.members.find((member) => member.memberId === leftover.id);
    const leftoverAfter = minted.members.find((member) => member.memberId === leftover.id);
    expect(leftoverAfter?.cell).toEqual(leftoverBefore?.cell);
    expect(leftoverAfter?.state).toBe(leftoverBefore?.state);
  });

  it('FloorGrid arrival notice is keyed off the last G.2C3 record', () => {
    const source = readFileSync(join(HERE, 'FloorGrid.tsx'), 'utf8');
    expect(source).toMatch(/floorgrid-arrival-notice/);
    expect(source).toMatch(/playerFacingArrivalLine/);
    expect(source).toMatch(/lastLivingMemberArrival/);
    expect(source).not.toMatch(/leaveProbability|churnChance|% joined/);
  });
});
