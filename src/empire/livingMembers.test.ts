/**
 * livingMembers.test.ts — Stage G.1 living identity and service outcomes.
 */

import { describe, expect, it } from 'vitest';

import { createFloorState } from './floor';
import {
  createFloorSimState,
  runFloorSim,
  stepFloorSimWithObservations,
  type FloorSimContext,
} from './floorSim';
import { EMPIRE_TUNING } from './empireTuning';
import { createGymViewState, gymViewReduce } from './ladderView';
import {
  applyServiceObservations,
  createLivingMemberRoster,
  deriveMemberId,
  livingMemberAtIndex,
  memberIdForIndex,
  playerFacingServiceVisitLine,
  playerFacingTenureLine,
  SERVICE_HISTORY_WINDOWS,
  SHIPPED_SERVICE_HISTORY_WINDOW,
} from './livingMembers';
import {
  stationTrainingExperience,
  stockStationCapability,
  withStationAxis,
} from './stationCapability';
import { COMPETITION_BENCH_BAY } from './trainingStation';

const T = EMPIRE_TUNING;

function garageContext(capability = stockStationCapability()): FloorSimContext {
  return Object.freeze({
    rung: 'garage',
    floor: createFloorState('garage'),
    barbellOwned: [...T.LADDER_STARTING_EQUIPMENT],
    sessionOwned: Object.freeze([]) as FloorSimContext['sessionOwned'],
    capability,
  });
}

function collectObservations(context: FloorSimContext, ticks: number) {
  let state = createFloorSimState(context, T.FLOOR_SIM_RENDER_SEED);
  const all = [];
  for (let tick = 0; tick < ticks; tick += 1) {
    const stepped = stepFloorSimWithObservations(state, context);
    all.push(...stepped.observations);
    state = stepped.state;
  }
  return { state, observations: all };
}

describe('Stage G.1 — living member identity', () => {
  it('derives stable ids from rung, index and seed', () => {
    const a = deriveMemberId('garage', 0, 1);
    const b = deriveMemberId('garage', 0, 1);
    const c = deriveMemberId('garage', 1, 1);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('creates one living member per ambient placement', () => {
    const roster = createLivingMemberRoster('garage', [...T.LADDER_STARTING_EQUIPMENT], [], 0, 1);
    expect(roster.members.length).toBe(T.AMBIENT_MEMBER_COUNT_BY_RUNG.garage);
    expect(memberIdForIndex(roster, 0)).toBe(roster.members[0]?.id ?? null);
  });

  it('keeps member ids across capability upgrades in GymViewState', () => {
    let state = createGymViewState();
    const before = state.livingMembers.members.map((member) => member.id);
    state = Object.freeze({
      ...state,
      managed: Object.freeze({
        ...state.managed,
        gym: Object.freeze({
          ...state.managed.gym,
          ladder: Object.freeze({
            ...state.managed.gym.ladder,
            gymBucks: 10_000,
          }),
        }),
      }),
    });
    state = gymViewReduce(state, {
      kind: 'upgrade-station',
      station: COMPETITION_BENCH_BAY,
      axis: 'quality',
    });
    const after = state.livingMembers.members.map((member) => member.id);
    expect(after).toEqual(before);
  });
});

describe('Stage G.1 — service observations and history', () => {
  it('records completed uses from the floor sim', () => {
    const roster = createLivingMemberRoster('garage', [...T.LADDER_STARTING_EQUIPMENT], [], 0, 1);
    const { observations } = collectObservations(garageContext(), 800);
    expect(observations.some((row) => row.outcome === 'completed')).toBe(true);
    const updated = applyServiceObservations(roster, observations);
    const withHistory = updated.members.filter((member) => member.recentVisits.length > 0);
    expect(withHistory.length).toBeGreaterThan(0);
  });

  it('bounds history at the shipped window and at alternate windows', () => {
    const roster = createLivingMemberRoster('garage', [...T.LADDER_STARTING_EQUIPMENT], [], 0, 1);
    const { observations } = collectObservations(garageContext(), 2_000);
    for (const window of SERVICE_HISTORY_WINDOWS) {
      const updated = applyServiceObservations(roster, observations, window);
      for (const member of updated.members) {
        expect(member.recentVisits.length).toBeLessThanOrEqual(window);
      }
    }
    expect(SHIPPED_SERVICE_HISTORY_WINDOW).toBe(5);
  });

  it('does not fabricate visits on offline clock advance', () => {
    let state = createGymViewState();
    const before = state.livingMembers;
    state = gymViewReduce(state, { kind: 'advance-clock', gapSeconds: T.SECONDS_PER_HOUR, mode: 'offline' });
    expect(state.livingMembers).toBe(before);
    for (const member of state.livingMembers.members) {
      expect(member.recentVisits.length).toBe(0);
    }
  });

  it('applies reducer observations without touching sporting reputation', () => {
    let state = createGymViewState();
    const { observations } = collectObservations(garageContext(), 400);
    state = gymViewReduce(state, {
      kind: 'apply-living-member-observations',
      observations,
    });
    expect(state.livingMembers.members.some((member) => member.recentVisits.length > 0)).toBe(true);
  });
});

describe('Stage G.1 — Q/C/T causality via service truth', () => {
  it('raises training experience on completed uses when Quality is purchased, not wait alone', () => {
    const stock = garageContext(stockStationCapability());
    const quality = garageContext(
      withStationAxis(stockStationCapability(), COMPETITION_BENCH_BAY, 'quality', 1),
    );
    const stockRuns = collectObservations(stock, 1_200).observations.filter(
      (row) => row.outcome === 'completed' && row.stationKind === 'training',
    );
    const qualityRuns = collectObservations(quality, 1_200).observations.filter(
      (row) => row.outcome === 'completed' && row.stationKind === 'training',
    );
    expect(stockRuns.length).toBeGreaterThan(0);
    expect(qualityRuns.length).toBeGreaterThan(0);
    expect(
      qualityRuns.some(
        (row) =>
          row.trainingExperience ===
          stationTrainingExperience(quality.capability, 'training', COMPETITION_BENCH_BAY),
      ),
    ).toBe(true);
    expect(
      stockRuns.every(
        (row) =>
          row.trainingExperience ===
          stationTrainingExperience(stock.capability, 'training', COMPETITION_BENCH_BAY),
      ),
    ).toBe(true);
    const stockWaits = stockRuns.map((row) => row.waitTicks);
    const qualityWaits = qualityRuns.map((row) => row.waitTicks);
    expect(Math.max(...qualityWaits)).toBeGreaterThanOrEqual(Math.min(...stockWaits));
  });

  it('lets Capacity reduce average wait versus stock on the same tick budget', () => {
    const stock = garageContext(stockStationCapability());
    const capacity = garageContext(
      withStationAxis(stockStationCapability(), COMPETITION_BENCH_BAY, 'capacity', 1),
    );
    const stockWaits = collectObservations(stock, 1_000).observations
      .filter((row) => row.outcome === 'completed')
      .map((row) => row.waitTicks);
    const capacityWaits = collectObservations(capacity, 1_000).observations
      .filter((row) => row.outcome === 'completed')
      .map((row) => row.waitTicks);
    expect(stockWaits.length).toBeGreaterThan(0);
    expect(capacityWaits.length).toBeGreaterThan(0);
    const stockMean = stockWaits.reduce((sum, value) => sum + value, 0) / stockWaits.length;
    const capacityMean = capacityWaits.reduce((sum, value) => sum + value, 0) / capacityWaits.length;
    expect(capacityMean).toBeLessThan(stockMean);
  });
});

describe('Stage G.1 — player-facing copy', () => {
  it('formats tenure and recent service in plain language', () => {
    expect(playerFacingTenureLine(0, T.SECONDS_PER_DAY)).toContain('day');
    expect(
      playerFacingServiceVisitLine({
        stationKind: 'training',
        stationKey: 'training:competition-bench-bay',
        waitTicks: 5,
        trainingExperience: 2,
        outcome: 'completed',
        observedAtTick: 10,
      }),
    ).toContain('finished');
  });

  it('reads a living member back by sim index', () => {
    const roster = createLivingMemberRoster('garage', [...T.LADDER_STARTING_EQUIPMENT], [], 100, 1);
    const member = livingMemberAtIndex(roster, 0);
    expect(member?.joinedAtSeconds).toBe(100);
  });
});
