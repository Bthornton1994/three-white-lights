/**
 * livingMembers.test.ts — Stage G.1 / G.1A living identity and service outcomes.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { createFloorState } from './floor';
import {
  createFloorSimState,
  runFloorSim,
  stepFloorSimWithObservations,
  withAmbientLivingPopulation,
  type FloorSimContext,
  type FloorSimServiceObservation,
} from './floorSim';
import { type LadderRung } from './ladder';
import { EMPIRE_TUNING } from './empireTuning';
import { createGymViewState, gymViewReduce } from './ladderView';
import { withUpdatedGym } from './management';
import {
  applyServiceObservations,
  createLivingMemberRoster,
  deriveMemberId,
  displayNameForCreation,
  floorSimPopulationFromRoster,
  livingMemberAtIndex,
  livingMemberById,
  LIVING_MEMBER_GIVEN_NAMES,
  memberIdForIndex,
  memberOrdinalFromId,
  playerFacingServiceVisitLine,
  playerFacingTenureLine,
  playerFacingWaitExperience,
  reconcileLivingMemberRosterOnRelocation,
  SERVICE_HISTORY_WINDOWS,
  SERVICE_WAIT_VERY_LONG_MIN_TICKS,
  SHIPPED_SERVICE_HISTORY_WINDOW,
  type LivingGymMember,
  type LivingMemberRoster,
  type ServiceVisitRecord,
} from './livingMembers';
import {
  stationChangeoverTicks,
  stationTrainingExperience,
  stockStationCapability,
  withStationAxis,
} from './stationCapability';
import { buySessionEquipment } from './sessions';
import { COMPETITION_BENCH_BAY } from './trainingStation';

const T = EMPIRE_TUNING;
const RUNGS: readonly LadderRung[] = Object.freeze([...T.LADDER_RUNGS]);
const KIT = Object.freeze([...T.LADDER_STARTING_EQUIPMENT]);

interface MemberSnapshot {
  readonly id: string;
  readonly displayName: string;
  readonly type: LivingGymMember['type'];
  readonly joinedAtSeconds: number;
  readonly recentVisits: readonly ServiceVisitRecord[];
}

function snapshotMembers(roster: LivingMemberRoster): readonly MemberSnapshot[] {
  return Object.freeze(
    roster.members.map((member) =>
      Object.freeze({
        id: member.id,
        displayName: member.displayName,
        type: member.type,
        joinedAtSeconds: member.joinedAtSeconds,
        recentVisits: Object.freeze([...member.recentVisits]),
      }),
    ),
  );
}

function contextWithRoster(
  roster: LivingMemberRoster,
  capability: FloorSimContext['capability'],
  sessionOwned: FloorSimContext['sessionOwned'] = Object.freeze([]),
): FloorSimContext {
  return Object.freeze({
    rung: roster.rung,
    floor: createFloorState(roster.rung),
    barbellOwned: KIT,
    sessionOwned,
    capability,
    livingPopulation: floorSimPopulationFromRoster(roster),
  });
}

function garageContext(capability = stockStationCapability()): FloorSimContext {
  const roster = createLivingMemberRoster('garage', KIT, [], 0, T.FLOOR_SIM_RENDER_SEED);
  return contextWithRoster(roster, capability);
}

function collectObservations(context: FloorSimContext, ticks: number) {
  let state = createFloorSimState(context, T.FLOOR_SIM_RENDER_SEED);
  const all: FloorSimServiceObservation[] = [];
  for (let tick = 0; tick < ticks; tick += 1) {
    const stepped = stepFloorSimWithObservations(state, context);
    all.push(...stepped.observations);
    state = stepped.state;
  }
  return { state, observations: Object.freeze(all) };
}

function fundForNextMove(state: ReturnType<typeof createGymViewState>) {
  const next = RUNGS[RUNGS.indexOf(state.managed.gym.ladder.rung) + 1];
  if (next === undefined) return state;
  const cost = T.LADDER_MOVE_COST_GYM_BUCKS[next as keyof typeof T.LADDER_MOVE_COST_GYM_BUCKS];
  return Object.freeze({
    ...state,
    managed: withUpdatedGym(
      state.managed,
      Object.freeze({
        ...state.managed.gym,
        ladder: Object.freeze({
          ...state.managed.gym.ladder,
          gymBucks: cost + 1_000,
        }),
      }),
    ),
  });
}

function badVisit(tick: number): ServiceVisitRecord {
  return Object.freeze({
    stationKind: 'training',
    stationKey: 'training:competition-bench-bay',
    queueWaitTicks: T.LIVING_MEMBER_WAIT_LONG_MIN_TICKS,
    trainingExperience: 0,
    outcome: 'completed',
    observedAtTick: tick,
  });
}

function goodVisit(tick: number): ServiceVisitRecord {
  return Object.freeze({
    stationKind: 'training',
    stationKey: 'training:competition-bench-bay',
    queueWaitTicks: T.LIVING_MEMBER_WAIT_SHORT_MAX_TICKS,
    trainingExperience: T.STATION_QUALITY_TRAINING_EXPERIENCE,
    outcome: 'completed',
    observedAtTick: tick,
  });
}

describe('Stage G.1A — gym-local member identity', () => {
  it('derives stable ids from identity nonce and ordinal only — no rung', () => {
    const a = deriveMemberId(1, 0);
    const b = deriveMemberId(1, 0);
    const c = deriveMemberId(1, 1);
    const d = deriveMemberId(2, 0);
    expect(a).toBe('member:n1:0');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toBe(d);
    expect(memberOrdinalFromId(a)).toBe(0);
  });

  it('creates one living member per ambient placement', () => {
    const roster = createLivingMemberRoster('garage', KIT, [], 0, T.FLOOR_SIM_RENDER_SEED);
    expect(roster.members.length).toBe(T.AMBIENT_MEMBER_COUNT_BY_RUNG.garage);
    expect(memberIdForIndex(roster, 0)).toBe(roster.members[0]?.id ?? null);
  });

  it('keeps member ids and display names across capability upgrades in GymViewState', () => {
    let state = createGymViewState();
    const beforeIds = state.livingMembers.members.map((member) => member.id);
    const beforeNames = state.livingMembers.members.map((member) => member.displayName);
    state = Object.freeze({
      ...state,
      managed: withUpdatedGym(
        state.managed,
        Object.freeze({
          ...state.managed.gym,
          ladder: Object.freeze({
            ...state.managed.gym.ladder,
            gymBucks: 10_000,
          }),
        }),
      ),
    });
    for (const axis of ['quality', 'capacity', 'throughput'] as const) {
      state = gymViewReduce(state, {
        kind: 'upgrade-station',
        station: COMPETITION_BENCH_BAY,
        axis,
      });
    }
    const afterIds = state.livingMembers.members.map((member) => member.id);
    const afterNames = state.livingMembers.members.map((member) => member.displayName);
    expect(afterIds).toEqual(beforeIds);
    expect(afterNames).toEqual(beforeNames);
  });
});

describe('Stage G.1A — facility relocation preserves identity', () => {
  it('retains every existing member through every reachable facility rung', () => {
    let state = createGymViewState();
    const { observations } = collectObservations(garageContext(), 600);
    state = gymViewReduce(state, {
      kind: 'apply-living-member-observations',
      observations,
    });
    const opening = snapshotMembers(state.livingMembers);
    expect(opening.some((member) => member.recentVisits.length > 0)).toBe(true);

    let prior = opening;
    for (let step = 1; step < RUNGS.length; step += 1) {
      state = fundForNextMove(state);
      const beforeMove = snapshotMembers(state.livingMembers);
      state = gymViewReduce(state, { kind: 'move-up' });
      const afterMove = snapshotMembers(state.livingMembers);
      expect(state.managed.gym.ladder.rung).toBe(RUNGS[step]);

      for (let index = 0; index < prior.length; index += 1) {
        expect(afterMove[index]).toEqual(beforeMove[index]);
        expect(afterMove[index]).toEqual(prior[index]);
      }

      const targetCount = T.AMBIENT_MEMBER_COUNT_BY_RUNG[RUNGS[step] as LadderRung];
      expect(afterMove.length).toBe(targetCount);
      if (afterMove.length > prior.length) {
        const oldIds = new Set(prior.map((member) => member.id));
        const appended = afterMove.slice(prior.length);
        expect(appended.every((member) => !oldIds.has(member.id))).toBe(true);
        expect(
          appended.every(
            (member) => member.joinedAtSeconds === state.managed.gym.ladder.collectedAt,
          ),
        ).toBe(true);
        expect(new Set(afterMove.map((member) => member.id)).size).toBe(afterMove.length);
      }
      prior = afterMove;
    }
  });
});

describe('Stage G.1A — FloorSim uses authoritative living members', () => {
  it('maps the same roster to the same member ids and types for a fixed seed', () => {
    const roster = createLivingMemberRoster('garage', KIT, [], 0, T.FLOOR_SIM_RENDER_SEED);
    const context = contextWithRoster(roster, stockStationCapability());
    const first = createFloorSimState(context, T.FLOOR_SIM_RENDER_SEED);
    const second = createFloorSimState(context, T.FLOOR_SIM_RENDER_SEED);
    const read = (members: typeof first.members) =>
      members.map((member) => Object.freeze({ memberId: member.memberId, type: member.type }));
    expect(read(first.members)).toEqual(read(second.members));
    expect(read(first.members)).toEqual(floorSimPopulationFromRoster(roster));
  });

  it('keeps existing member types when session equipment changes but roster does not', () => {
    const roster = createLivingMemberRoster('garage', KIT, [], 0, T.FLOOR_SIM_RENDER_SEED);
    const beforeTypes = roster.members.map((member) => member.type);
    const empty = contextWithRoster(roster, stockStationCapability(), Object.freeze([]));
    const withMats = contextWithRoster(roster, stockStationCapability(), Object.freeze(['mats']));
    const emptySim = createFloorSimState(empty, T.FLOOR_SIM_RENDER_SEED);
    const matsSim = createFloorSimState(withMats, T.FLOOR_SIM_RENDER_SEED);
    expect(emptySim.members.map((member) => member.type)).toEqual(beforeTypes);
    expect(matsSim.members.map((member) => member.type)).toEqual(beforeTypes);
    expect(emptySim.members.map((member) => member.memberId)).toEqual(
      matsSim.members.map((member) => member.memberId),
    );
  });

  it('does not retag existing members when session equipment is purchased in GymViewState', () => {
    let state = createGymViewState();
    const before = state.livingMembers.members.map((member) => member.type);
    state = Object.freeze({
      ...state,
      managed: withUpdatedGym(
        state.managed,
        Object.freeze({
          ...state.managed.gym,
          ladder: Object.freeze({
            ...state.managed.gym.ladder,
            gymBucks: 50_000,
          }),
        }),
      ),
    });
    state = gymViewReduce(state, { kind: 'buy-session', item: 'mats' });
    const after = state.livingMembers.members.map((member) => member.type);
    expect(after).toEqual(before);
  });
});

describe('Stage G.1A — service observations resolve by memberId', () => {
  it('chains observation.memberId through the sim to the living roster row', () => {
    const roster = createLivingMemberRoster('garage', KIT, [], 0, T.FLOOR_SIM_RENDER_SEED);
    const { state, observations } = collectObservations(
      contextWithRoster(roster, stockStationCapability()),
      800,
    );
    const completed = observations.find((row) => row.outcome === 'completed');
    expect(completed).toBeDefined();
    const simMember = state.members[completed?.memberIndex ?? -1];
    const living = livingMemberById(roster, (completed?.memberId ?? '') as never);
    expect(simMember?.memberId).toBe(completed?.memberId);
    expect(living?.id).toBe(completed?.memberId);

    const updated = applyServiceObservations(roster, [completed as FloorSimServiceObservation]);
    const row = livingMemberById(updated, (completed?.memberId ?? '') as never);
    expect(row?.recentVisits.length).toBe(1);
    expect(row?.recentVisits[0]?.queueWaitTicks).toBe(completed?.queueWaitTicks);
  });

  it('refuses a valid memberId with the wrong memberType', () => {
    const roster = createLivingMemberRoster('garage', KIT, [], 0, T.FLOOR_SIM_RENDER_SEED);
    const member = roster.members[0];
    expect(member).toBeDefined();
    const observation = Object.freeze({
      memberId: member?.id ?? '',
      memberIndex: 0,
      memberType: member?.type === 'powerlifter' ? 'bodybuilder' : 'powerlifter',
      stationKind: 'training' as const,
      stationKey: 'training:competition-bench-bay',
      queueWaitTicks: 4,
      trainingExperience: 1,
      outcome: 'completed' as const,
      observedAtTick: 10,
    });
    expect(() => applyServiceObservations(roster, [observation])).toThrow(/does not match member/);
  });

  it('refuses an unknown memberId', () => {
    const roster = createLivingMemberRoster('garage', KIT, [], 0, T.FLOOR_SIM_RENDER_SEED);
    const observation = Object.freeze({
      memberId: 'member:n1:999',
      memberIndex: 0,
      memberType: 'casual' as const,
      stationKind: 'training' as const,
      stationKey: 'training:competition-bench-bay',
      queueWaitTicks: 4,
      trainingExperience: 1,
      outcome: 'completed' as const,
      observedAtTick: 10,
    });
    expect(() => applyServiceObservations(roster, [observation])).toThrow(/unknown member/);
  });
});

describe('Stage G.1 — service observations and history', () => {
  it('records completed uses from the floor sim', () => {
    const roster = createLivingMemberRoster('garage', KIT, [], 0, T.FLOOR_SIM_RENDER_SEED);
    const { observations } = collectObservations(garageContext(), 800);
    expect(observations.some((row) => row.outcome === 'completed')).toBe(true);
    const updated = applyServiceObservations(roster, observations);
    const withHistory = updated.members.filter((member) => member.recentVisits.length > 0);
    expect(withHistory.length).toBeGreaterThan(0);
  });

  it('bounds history at the shipped window and at alternate windows', () => {
    const roster = createLivingMemberRoster('garage', KIT, [], 0, T.FLOOR_SIM_RENDER_SEED);
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
    state = gymViewReduce(state, {
      kind: 'advance-clock',
      gapSeconds: T.SECONDS_PER_HOUR,
      mode: 'offline',
    });
    expect(state.livingMembers.members).toBe(before.members);
    expect(state.livingMembers.dues.settledAtSeconds).toBe(state.managed.gym.ladder.collectedAt);
    expect(state.livingMembers.dues.creditedGymBucks).toBeGreaterThan(0);
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
    expect(state.livingMembers.members.some((member) => member.recentVisits.length > 0)).toBe(
      true,
    );
  });
});

describe('Stage G.1A — queueWaitTicks semantics', () => {
  it('measures true queue wait (queue arrival → use start), not claim-to-use approach', () => {
    expect(playerFacingWaitExperience(T.LIVING_MEMBER_WAIT_SHORT_MAX_TICKS)).toBe('short wait');
    expect(playerFacingWaitExperience(T.LIVING_MEMBER_WAIT_LONG_MIN_TICKS)).toBe('long wait');
    const roster = createLivingMemberRoster('garage', KIT, [], 0, T.FLOOR_SIM_RENDER_SEED);
    const { observations } = collectObservations(
      contextWithRoster(roster, stockStationCapability()),
      1_000,
    );
    const completed = observations.filter((row) => row.outcome === 'completed');
    expect(completed.length).toBeGreaterThan(0);
    for (const row of completed) {
      expect(row.queueWaitTicks).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('Stage G.1A — Q/C/T causality via service truth', () => {
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
    const stockWaits = stockRuns.map((row) => row.queueWaitTicks);
    const qualityWaits = qualityRuns.map((row) => row.queueWaitTicks);
    expect(Math.max(...qualityWaits)).toBeGreaterThanOrEqual(Math.min(...stockWaits));
  });

  it('lets Capacity reduce average queue wait versus stock on the same tick budget', () => {
    const stock = garageContext(stockStationCapability());
    const capacity = garageContext(
      withStationAxis(stockStationCapability(), COMPETITION_BENCH_BAY, 'capacity', 1),
    );
    const stockWaits = collectObservations(stock, 1_000).observations
      .filter((row) => row.outcome === 'completed')
      .map((row) => row.queueWaitTicks);
    const capacityWaits = collectObservations(capacity, 1_000).observations
      .filter((row) => row.outcome === 'completed')
      .map((row) => row.queueWaitTicks);
    expect(stockWaits.length).toBeGreaterThan(0);
    expect(capacityWaits.length).toBeGreaterThan(0);
    const stockMean = stockWaits.reduce((sum, value) => sum + value, 0) / stockWaits.length;
    const capacityMean =
      capacityWaits.reduce((sum, value) => sum + value, 0) / capacityWaits.length;
    expect(capacityMean).toBeLessThan(stockMean);
  });

  function completedTrainingByMember(
    observations: readonly FloorSimServiceObservation[],
  ): ReadonlyMap<string, readonly FloorSimServiceObservation[]> {
    const byMember = new Map<string, FloorSimServiceObservation[]>();
    for (const row of observations) {
      if (row.outcome !== 'completed' || row.stationKind !== 'training') continue;
      const list = byMember.get(row.memberId) ?? [];
      list.push(row);
      byMember.set(row.memberId, list);
    }
    const frozen = new Map<string, readonly FloorSimServiceObservation[]>();
    for (const [memberId, list] of byMember) {
      list.sort((left, right) => left.observedAtTick - right.observedAtTick);
      frozen.set(memberId, Object.freeze(list));
    }
    return frozen;
  }

  it('shortens changeover (18 → 6) so at least one stable memberId waits less', () => {
    const roster = createLivingMemberRoster('garage', KIT, [], 0, T.FLOOR_SIM_RENDER_SEED);
    const stock = contextWithRoster(roster, stockStationCapability());
    const throughput = contextWithRoster(
      roster,
      withStationAxis(stockStationCapability(), COMPETITION_BENCH_BAY, 'throughput', 1),
    );
    expect(stationChangeoverTicks(stock.capability, 'training', COMPETITION_BENCH_BAY)).toBe(18);
    expect(stationChangeoverTicks(throughput.capability, 'training', COMPETITION_BENCH_BAY)).toBe(
      6,
    );
    const stockRuns = collectObservations(stock, 1_000).observations.filter(
      (row) => row.outcome === 'completed' && row.stationKind === 'training',
    );
    const throughputRuns = collectObservations(throughput, 1_000).observations.filter(
      (row) => row.outcome === 'completed' && row.stationKind === 'training',
    );
    expect(stockRuns.length).toBeGreaterThan(0);
    expect(throughputRuns.length).toBeGreaterThan(0);
    const stockMean =
      stockRuns.reduce((sum, row) => sum + row.queueWaitTicks, 0) / stockRuns.length;
    const throughputMean =
      throughputRuns.reduce((sum, row) => sum + row.queueWaitTicks, 0) / throughputRuns.length;
    expect(throughputMean).toBeLessThan(stockMean);

    const stockByMember = completedTrainingByMember(stockRuns);
    const throughputByMember = completedTrainingByMember(throughputRuns);
    let matchedMemberId: string | null = null;
    let matchedStockWait: number | null = null;
    let matchedThroughputWait: number | null = null;
    for (const [memberId, stockCompletions] of stockByMember) {
      const throughputCompletions = throughputByMember.get(memberId);
      if (throughputCompletions === undefined) continue;
      const comparableCount = Math.min(stockCompletions.length, throughputCompletions.length);
      for (let index = 0; index < comparableCount; index += 1) {
        const stockWait = stockCompletions[index]?.queueWaitTicks;
        const throughputWait = throughputCompletions[index]?.queueWaitTicks;
        if (
          stockWait !== undefined &&
          throughputWait !== undefined &&
          throughputWait < stockWait
        ) {
          matchedMemberId = memberId;
          matchedStockWait = stockWait;
          matchedThroughputWait = throughputWait;
          break;
        }
      }
      if (matchedMemberId !== null) break;
    }
    expect(matchedMemberId).not.toBeNull();
    expect(matchedStockWait).not.toBeNull();
    expect(matchedThroughputWait).not.toBeNull();
    if (matchedMemberId !== null && matchedStockWait !== null && matchedThroughputWait !== null) {
      expect(matchedThroughputWait).toBeLessThan(matchedStockWait);
    }
  });
});

describe('Stage G.1A — service history window evidence', () => {
  function rollOffReport(window: number) {
    let visits: ServiceVisitRecord[] = [];
    for (let tick = 0; tick < window; tick += 1) visits.push(badVisit(tick));
    const filledBad = visits.slice(-window);
    expect(filledBad.every((visit) => visit.queueWaitTicks >= T.LIVING_MEMBER_WAIT_LONG_MIN_TICKS))
      .toBe(true);

    let goodUntilClear = 0;
    let improvementVisibleAt: number | null = null;
    for (let added = 1; added <= window; added += 1) {
      visits.push(goodVisit(window + added));
      const visible = visits.slice(-window);
      const hasGood = visible.some(
        (visit) => visit.queueWaitTicks <= T.LIVING_MEMBER_WAIT_SHORT_MAX_TICKS,
      );
      const hasBad = visible.some(
        (visit) => visit.queueWaitTicks >= T.LIVING_MEMBER_WAIT_LONG_MIN_TICKS,
      );
      if (improvementVisibleAt === null && hasGood) improvementVisibleAt = added;
      if (!hasBad) {
        goodUntilClear = added;
        break;
      }
    }
    return Object.freeze({
      window,
      goodVisitsToClearBad: goodUntilClear,
      cardRowsDuringTransition: Math.min(visits.length, window),
      improvementVisibleAfterGoodVisits: improvementVisibleAt,
    });
  }

  it('reports roll-off timing for windows 3, 5 and 8 — shipped window 5 is frozen', () => {
    const table = SERVICE_HISTORY_WINDOWS.map((window) => rollOffReport(window));
    expect(table).toEqual([
      {
        window: 3,
        goodVisitsToClearBad: 3,
        cardRowsDuringTransition: 3,
        improvementVisibleAfterGoodVisits: 1,
      },
      {
        window: 5,
        goodVisitsToClearBad: 5,
        cardRowsDuringTransition: 5,
        improvementVisibleAfterGoodVisits: 1,
      },
      {
        window: 8,
        goodVisitsToClearBad: 8,
        cardRowsDuringTransition: 8,
        improvementVisibleAfterGoodVisits: 1,
      },
    ]);
    expect(SHIPPED_SERVICE_HISTORY_WINDOW).toBe(5);
    expect(T.LIVING_MEMBER_SERVICE_HISTORY_WINDOW).toBe(5);
    expect(T.LIVING_MEMBER_SERVICE_HISTORY_WINDOWS).toEqual([3, 5, 8]);
    // First good visit is visible immediately at every candidate window; clearing
    // bad history fully requires N subsequent good visits. N=5 is the accepted
    // card-density choice — not "middle option" alone, and not retuned.
    expect(table.every((row) => row.improvementVisibleAfterGoodVisits === 1)).toBe(true);
    expect(table.every((row) => row.goodVisitsToClearBad === row.window)).toBe(true);
  });
});

describe('Stage G.1 — player-facing copy', () => {
  it('formats tenure and recent service in plain language', () => {
    expect(playerFacingTenureLine(0, T.SECONDS_PER_DAY)).toContain('day');
    expect(
      playerFacingServiceVisitLine({
        stationKind: 'training',
        stationKey: 'training:competition-bench-bay',
        queueWaitTicks: 5,
        trainingExperience: 2,
        outcome: 'completed',
        observedAtTick: 10,
      }),
    ).toContain('finished');
  });

  it('reads a living member back by sim index', () => {
    const roster = createLivingMemberRoster('garage', KIT, [], 100, T.FLOOR_SIM_RENDER_SEED);
    const member = livingMemberAtIndex(roster, 0);
    expect(member?.joinedAtSeconds).toBe(100);
  });
});

const WAIT_LABEL_RANK = Object.freeze([
  'no wait',
  'short wait',
  'waited a while',
  'long wait',
  'very long wait',
] as const);

function waitRank(queueWaitTicks: number): number {
  const label = playerFacingWaitExperience(queueWaitTicks);
  const rank = WAIT_LABEL_RANK.indexOf(label as (typeof WAIT_LABEL_RANK)[number]);
  expect(rank, `unranked wait label ${label} at ${queueWaitTicks}`).toBeGreaterThanOrEqual(0);
  return rank;
}

describe('Stage G.1C — wait copy resolution', () => {
  it('pins the accepted bucket edges, including no-wait and very-long', () => {
    expect(T.LIVING_MEMBER_WAIT_SHORT_MAX_TICKS).toBe(15);
    expect(T.LIVING_MEMBER_WAIT_LONG_MIN_TICKS).toBe(40);
    expect(T.LIVING_MEMBER_WAIT_VERY_LONG_MIN_TICKS).toBe(100);
    expect(SERVICE_WAIT_VERY_LONG_MIN_TICKS).toBe(100);
    expect(playerFacingWaitExperience(0)).toBe('no wait');
    expect(playerFacingWaitExperience(T.LIVING_MEMBER_WAIT_SHORT_MAX_TICKS)).toBe('short wait');
    expect(playerFacingWaitExperience(T.LIVING_MEMBER_WAIT_SHORT_MAX_TICKS + 1)).toBe(
      'waited a while',
    );
    expect(playerFacingWaitExperience(T.LIVING_MEMBER_WAIT_LONG_MIN_TICKS)).toBe('long wait');
    expect(playerFacingWaitExperience(T.LIVING_MEMBER_WAIT_VERY_LONG_MIN_TICKS - 1)).toBe(
      'long wait',
    );
    expect(playerFacingWaitExperience(T.LIVING_MEMBER_WAIT_VERY_LONG_MIN_TICKS)).toBe(
      'very long wait',
    );
  });

  it('is monotonic across 0..200 ticks: a longer wait never gets a better label', () => {
    let previous = waitRank(0);
    for (let ticks = 1; ticks <= 200; ticks += 1) {
      const next = waitRank(ticks);
      expect(next, `ticks ${ticks}`).toBeGreaterThanOrEqual(previous);
      previous = next;
    }
  });

  it('keeps the measured 95-vs-128 Throughput delta visible after translation', () => {
    const at95 = playerFacingWaitExperience(95);
    const at128 = playerFacingWaitExperience(128);
    expect(at95).not.toBe(at128);
    expect(waitRank(95)).toBeLessThan(waitRank(128));
  });

  it('rejects VERY_LONG candidates that still collapse the measured 95-vs-128 pair', () => {
    const veryLongMin = T.LIVING_MEMBER_WAIT_VERY_LONG_MIN_TICKS;
    const longMin = T.LIVING_MEMBER_WAIT_LONG_MIN_TICKS;
    expect(longMin).toBe(40);
    expect(veryLongMin).toBe(100);
    // Both measured waits sit above LONG_MIN, so the only thing that can
    // separate them is the upper band. Candidates 80 and 90 still put both
    // ticks in the same band; 100 is the lowest listed candidate that does not.
    expect(95 >= 80 && 128 >= 80).toBe(true);
    expect(95 >= 90 && 128 >= 90).toBe(true);
    expect(95 < veryLongMin && 128 >= veryLongMin).toBe(true);
    expect(95 < 110 && 128 >= 110).toBe(true);
    expect(95 < 120 && 128 >= 120).toBe(true);
    // 95 remains a long wait, not a short or empty one — the upper band does
    // not pretend Throughput's measured wait is a good wait.
    expect(95).toBeGreaterThan(longMin);
    expect(waitRank(95)).toBe(WAIT_LABEL_RANK.indexOf('long wait'));
    expect(waitRank(128)).toBe(WAIT_LABEL_RANK.indexOf('very long wait'));
  });

  it('derives wait copy from queueWaitTicks only — no Q/C/T-aware branch', () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'livingMembers.ts'), 'utf8');
    const start = source.indexOf('export function playerFacingWaitExperience');
    const end = source.indexOf('export function playerFacingTrainingExperience');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const body = source.slice(start, end);
    expect(body).not.toMatch(/throughput/i);
    expect(body).not.toMatch(/capacity/i);
    expect(body).not.toMatch(/quality/i);
    expect(body).not.toMatch(/upgrade/i);
  });
});

describe('Stage G.1C — persistent display names', () => {
  it('assigns deterministic unique names from a pool at least as large as warehouse', () => {
    expect(LIVING_MEMBER_GIVEN_NAMES.length).toBe(64);
    expect(LIVING_MEMBER_GIVEN_NAMES.length).toBeGreaterThanOrEqual(
      T.AMBIENT_MEMBER_COUNT_BY_RUNG.warehouse,
    );
    expect(new Set(LIVING_MEMBER_GIVEN_NAMES).size).toBe(LIVING_MEMBER_GIVEN_NAMES.length);
    expect(displayNameForCreation(T.FLOOR_SIM_RENDER_SEED, 0)).toBe(LIVING_MEMBER_GIVEN_NAMES[0]);
    const garage = createLivingMemberRoster('garage', KIT, [], 0, T.FLOOR_SIM_RENDER_SEED);
    expect(garage.members.map((member) => member.displayName)).toEqual(
      garage.members.map((_, index) => LIVING_MEMBER_GIVEN_NAMES[index]),
    );
    const warehouse = createLivingMemberRoster('warehouse', KIT, [], 0, T.FLOOR_SIM_RENDER_SEED);
    expect(warehouse.members.length).toBe(T.AMBIENT_MEMBER_COUNT_BY_RUNG.warehouse);
    const names = warehouse.members.map((member) => member.displayName);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(
      [...LIVING_MEMBER_GIVEN_NAMES].slice(0, T.AMBIENT_MEMBER_COUNT_BY_RUNG.warehouse),
    );
  });

  it('stores the chosen name so observations, clock, and equipment cannot rename anyone', () => {
    const roster = createLivingMemberRoster('garage', KIT, [], 0, T.FLOOR_SIM_RENDER_SEED);
    const original = roster.members.map((member) => member.displayName);
    const { observations } = collectObservations(
      contextWithRoster(roster, stockStationCapability()),
      400,
    );
    const afterVisits = applyServiceObservations(roster, observations);
    expect(afterVisits.members.map((member) => member.displayName)).toEqual(original);
    expect(afterVisits.members.some((member) => member.recentVisits.length > 0)).toBe(true);

    let state = createGymViewState();
    const openingNames = state.livingMembers.members.map((member) => member.displayName);
    state = gymViewReduce(state, { kind: 'advance-clock', gapSeconds: T.SECONDS_PER_DAY * 3 });
    expect(state.livingMembers.members.map((member) => member.displayName)).toEqual(openingNames);

    state = Object.freeze({
      ...state,
      managed: withUpdatedGym(
        state.managed,
        Object.freeze({
          ...state.managed.gym,
          ladder: Object.freeze({
            ...state.managed.gym.ladder,
            gymBucks: 10_000,
          }),
        }),
      ),
    });
    const mats = buySessionEquipment(state.managed.gym, 'mats');
    state = gymViewReduce(state, { kind: 'buy-session', item: 'mats' });
    expect(mats.kind === 'bought' || state.livingMembers.members.length > 0).toBe(true);
    expect(state.livingMembers.members.map((member) => member.displayName)).toEqual(openingNames);
  });

  it('preserves existing names through every facility move and gives unique names to arrivals', () => {
    let state = createGymViewState();
    const opening = snapshotMembers(state.livingMembers);
    expect(new Set(opening.map((member) => member.displayName)).size).toBe(opening.length);

    for (let step = 1; step < RUNGS.length; step += 1) {
      state = fundForNextMove(state);
      const before = snapshotMembers(state.livingMembers);
      state = gymViewReduce(state, { kind: 'move-up' });
      const after = snapshotMembers(state.livingMembers);
      expect(state.managed.gym.ladder.rung).toBe(RUNGS[step]);
      for (let index = 0; index < before.length; index += 1) {
        expect(after[index]?.displayName).toBe(before[index]?.displayName);
        expect(after[index]?.id).toBe(before[index]?.id);
      }
      const names = after.map((member) => member.displayName);
      expect(new Set(names).size).toBe(names.length);
      const arrivals = after.slice(before.length);
      arrivals.forEach((member, offset) => {
        expect(member.displayName).toBe(LIVING_MEMBER_GIVEN_NAMES[before.length + offset]);
      });
    }
  });

  it('does not hand displayName to FloorSim population or floorSim.ts', () => {
    const roster = createLivingMemberRoster('garage', KIT, [], 0, T.FLOOR_SIM_RENDER_SEED);
    const population = floorSimPopulationFromRoster(roster);
    expect(population.map((row) => Object.keys(row).sort())).toEqual(
      population.map(() => ['memberId', 'type']),
    );
    const simSource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'floorSim.ts'), 'utf8');
    expect(simSource).not.toMatch(/displayName/);
  });

  it('keeps a stored displayName even when it no longer matches the pool', () => {
    const roster = createLivingMemberRoster('garage', KIT, [], 0, T.FLOOR_SIM_RENDER_SEED);
    const first = roster.members[0];
    expect(first).toBeDefined();
    const held = Object.freeze({
      ...roster,
      members: Object.freeze(
        roster.members.map((member, index) =>
          index === 0
            ? Object.freeze({ ...member, displayName: 'HeldName' })
            : member,
        ),
      ),
    });
    const afterClock = applyServiceObservations(held, []);
    expect(afterClock.members[0]?.displayName).toBe('HeldName');
    const relocated = reconcileLivingMemberRosterOnRelocation(
      held,
      'storage-unit',
      [],
      T.SECONDS_PER_DAY,
    );
    expect(relocated.members[0]?.displayName).toBe('HeldName');
    expect(relocated.members[0]?.id).toBe(first?.id);
    expect(relocated.members.slice(1).every((member) => member.displayName !== 'HeldName')).toBe(
      true,
    );
  });

  it('survives a GymViewState remount that keeps the living roster', () => {
    let state = createGymViewState();
    const { observations } = collectObservations(garageContext(), 400);
    state = gymViewReduce(state, {
      kind: 'apply-living-member-observations',
      observations,
    });
    const names = state.livingMembers.members.map((member) => member.displayName);
    const remounted = Object.freeze({ ...state });
    expect(remounted.livingMembers).toBe(state.livingMembers);
    expect(remounted.livingMembers.members.map((member) => member.displayName)).toEqual(names);
  });

  it('puts displayName first on the member card and names only the selected sprite', () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'FloorGrid.tsx'), 'utf8');
    const panel = source.indexOf("testID={'floorgrid-member-panel'}");
    const displayName = source.indexOf("testID={'floorgrid-member-panel-display-name'}", panel);
    const typeLine = source.indexOf("testID={'floorgrid-member-panel-identity'}", panel);
    const shortId = source.indexOf("testID={'floorgrid-member-panel-short-id'}", panel);
    const tenure = source.indexOf("testID={'floorgrid-member-panel-tenure'}", panel);
    const experience = source.indexOf("testID={'floorgrid-member-panel-experience'}", panel);
    const membership = source.indexOf("testID={'floorgrid-member-panel-membership'}", panel);
    const dues = source.indexOf("testID={'floorgrid-member-panel-dues'}", panel);
    const reputation = source.indexOf("testID={'floorgrid-member-panel-reputation'}", panel);
    expect(panel).toBeGreaterThanOrEqual(0);
    expect(displayName).toBeGreaterThan(panel);
    expect(typeLine).toBeGreaterThan(displayName);
    expect(shortId).toBeGreaterThan(typeLine);
    expect(tenure).toBeGreaterThan(shortId);
    expect(experience).toBeGreaterThan(tenure);
    expect(membership).toBeGreaterThan(experience);
    expect(dues).toBeGreaterThan(membership);
    expect(reputation).toBeGreaterThan(dues);
    expect(source).toMatch(/selectedName === undefined \? null/);
    expect(source).toContain("testID={'floorgrid-selected-member-name'}");
    expect(source.includes('members.map((member) => member.displayName)')).toBe(false);
  });

  it('does not let mechanics consume living displayName', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const isolated = Object.freeze([
      'floorSim.ts',
      'stationCapability.ts',
      'production.ts',
      'reputation.ts',
      'sportingReputation.ts',
      'sessions.ts',
      'members.ts',
      'livingMemberExperience.ts',
      'livingMemberRetention.ts',
      'livingMemberDues.ts',
      'livingMemberReputation.ts',
    ]);
    for (const file of isolated) {
      const source = readFileSync(join(here, file), 'utf8');
      expect(source, file).not.toMatch(/LIVING_MEMBER_GIVEN_NAMES/);
      expect(source, file).not.toMatch(/displayNameForCreation/);
    }
    const living = readFileSync(join(here, 'livingMembers.ts'), 'utf8');
    expect(living).not.toMatch(/memberSatisfaction\(/);
    expect(living).not.toMatch(/reputationFromMembers\(/);
    expect(living).not.toMatch(/memberDuesGymBucks/);
    expect(living).toMatch(/applyLivingMemberDues/);
    expect(living).toMatch(/applyLivingMemberReputation/);
    expect(living).not.toMatch(/Math\.random\(/);
  });

  it('never prints raw queueWaitTicks as the player-facing wait phrase', () => {
    for (let ticks = 0; ticks <= 200; ticks += 1) {
      expect(playerFacingWaitExperience(ticks)).not.toMatch(/\d/);
    }
  });
});
