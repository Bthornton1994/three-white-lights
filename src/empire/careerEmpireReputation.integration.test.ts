/**
 * careerEmpireReputation.integration.test.ts — CAREER-EMPIRE-REP-01
 * through gymViewReduce: credit, replay identity, fail-closed unknown
 * meet, clock carry, relocation, reset, and G.2E gate isolation.
 */

import { describe, expect, it } from 'vitest';

import { EMPIRE_TUNING } from './empireTuning';
import type { FloorSimServiceObservation } from './floorSim';
import { institutionalReputation } from './institutionalReputation';
import { gymViewReduce, createGymViewState, type GymViewState } from './ladderView';
import { withUpdatedGym } from './management';
import { MEET_LOCAL } from '../game/meetTuning';
import { livingMemberById, type LivingGymMember } from './livingMembers';
import { equipmentBiasedMemberTypes } from './members';
import type { SessionEquipmentItem } from './sessions';
import type { PlayedMeetFacts } from './sportingReputationLedger';

const T = EMPIRE_TUNING;
const DAY = T.SECONDS_PER_DAY;
const GATE = T.HIGH_PAYING_MEMBER_ARRIVAL_REPUTATION_THRESHOLD;

const FIRST_OF_SIXTEEN_PR: PlayedMeetFacts = Object.freeze({
  totalKg: 600,
  isTotalPr: true,
  placing: Object.freeze({ place: 1, fieldSize: 16 }),
});

function creditLocal(state: GymViewState, facts: PlayedMeetFacts = FIRST_OF_SIXTEEN_PR) {
  return gymViewReduce(state, {
    kind: 'credit-sporting-result',
    meetId: MEET_LOCAL.id,
    facts,
  });
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

function requireMember(state: GymViewState, index: number): LivingGymMember {
  const member = state.livingMembers.members[index];
  if (member === undefined) throw new Error(`missing member at ${index}`);
  return member;
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
  const gone = requireMember(state, 1);
  const leftoverId = requireMember(state, 0).id;
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

describe('CAREER-EMPIRE-REP-01 — credit through gymViewReduce', () => {
  it('credits first-of-16 plus PR as +40 stamped on the gym clock', () => {
    const opened = createGymViewState();
    const credited = creditLocal(opened);
    expect(credited.sportingReputation.creditedReputation).toBe(40);
    expect(credited.sportingReputation.entries[0]?.atSeconds).toBe(
      opened.managed.gym.ladder.collectedAt,
    );
    expect(credited.lastSportingCredit?.kind).toBe('credited');
    expect(credited.lastSportingCredit && credited.lastSportingCredit.kind === 'credited'
      ? credited.lastSportingCredit.reasons.map((row) => row.kind)
      : []).toEqual(['placing', 'total-pr']);
  });

  it('replays the same credit as a state identity no-op', () => {
    const credited = creditLocal(createGymViewState());
    const replay = creditLocal(credited);
    expect(replay).toBe(credited);
  });

  it('fails closed on an unknown meetId and leaves the ledger identical', () => {
    const opened = createGymViewState();
    const refused = gymViewReduce(opened, {
      kind: 'credit-sporting-result',
      meetId: 'not-a-meet',
      facts: FIRST_OF_SIXTEEN_PR,
    });
    expect(refused.lastSportingCredit).toEqual({
      kind: 'not-creditable',
      meetId: 'not-a-meet',
      reason: 'unknown-meet',
    });
    expect(refused.sportingReputation).toBe(opened.sportingReputation);
  });

  it('keeps the sporting ledger across advance-clock and composes with the member half', () => {
    const credited = creditLocal(createGymViewState());
    const advanced = gymViewReduce(credited, {
      kind: 'advance-clock',
      gapSeconds: DAY,
      mode: 'online',
    });
    expect(advanced.sportingReputation).toBe(credited.sportingReputation);
    const reading = institutionalReputation(
      advanced.livingMembers.reputation,
      advanced.sportingReputation,
    );
    expect(reading.fromSporting).toBe(40);
    expect(reading.fromMembers).toBe(advanced.livingMembers.reputation.creditedReputation);
    expect(reading.points).toBe(reading.fromMembers + reading.fromSporting);
    expect(reading.asOfSeconds).toBe(advanced.livingMembers.reputation.settledAtSeconds);
  });

  it('carries the sporting ledger on move-up and clears it on reset-gym', () => {
    const credited = creditLocal(createGymViewState());
    const moved = gymViewReduce(credited, { kind: 'move-up' });
    expect(moved.sportingReputation).toBe(credited.sportingReputation);
    const reset = gymViewReduce(moved, { kind: 'reset-gym' });
    expect(reset.sportingReputation).toEqual(createGymViewState().sportingReputation);
    expect(reset.lastSportingCredit).toBeNull();
  });
});

describe('CAREER-EMPIRE-REP-01 — G.2E gate stays member-only', () => {
  for (const spec of HIGH_PAYING_KITS) {
    it(`does not mint a ${spec.label} from sporting credit alone`, () => {
      const opened = withSessionOwned(createGymViewState(), spec.owned);
      expect(equipmentBiasedMemberTypes(opened.managed.gym.sessionEquipment)).toEqual([spec.type]);
      expect(opened.livingMembers.reputation.creditedReputation).toBe(0);
      const credited = creditLocal(opened);
      expect(credited.sportingReputation.creditedReputation).toBeGreaterThanOrEqual(1);
      expect(credited.livingMembers.reputation.creditedReputation).toBe(0);
      const { state: departed, leftover } = departInteriorOnGym(credited);
      const held = gymViewReduce(departed, {
        kind: 'apply-living-member-observations',
        observations: [stable(leftover, 11)],
      });
      expect(held.livingMembers.members.length).toBe(departed.livingMembers.members.length);
      expect(held.livingMembers.arrivals).toEqual([]);
      expect(held.livingMembers.members.some((member) => member.type === spec.type)).toBe(false);
    });

    it(`still mints a ${spec.label} once member credit meets the gate`, () => {
      let state = withSessionOwned(createGymViewState(), spec.owned);
      state = gymViewReduce(state, { kind: 'advance-clock', gapSeconds: DAY * 3, mode: 'online' });
      expect(state.livingMembers.reputation.creditedReputation).toBeGreaterThanOrEqual(GATE);
      const { state: departed, leftover } = departInteriorOnGym(state);
      const arrived = gymViewReduce(departed, {
        kind: 'apply-living-member-observations',
        observations: [stable(leftover, 11)],
      });
      expect(arrived.livingMembers.members.length).toBe(departed.livingMembers.members.length + 1);
      expect(arrived.livingMembers.members[arrived.livingMembers.members.length - 1]?.type).toBe(
        spec.type,
      );
    });
  }
});
