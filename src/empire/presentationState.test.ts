/**
 * presentationState.test.ts — Session B presentation-state contract.
 *
 * SIMULATION / CONTRACT / QUEUE / ECONOMY / PERSISTENCE proofs. These do
 * not claim Visual, Animation, or Soft-Feel PASS.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { EMPIRE_TUNING } from './empireTuning';
import {
  createFloorState,
  placeFloorFurniture,
  placeFloorItem,
  type GridPosition,
} from './floor';
import {
  claimantsOf,
  createFloorSimState,
  floorStations,
  stepFloorSim,
  type FloorSimContext,
  type FloorSimState,
  type FloorStationRef,
} from './floorSim';
import { createLadderState, type LadderEquipmentItem } from './ladder';
import { createLivingMemberRoster, deriveMemberId, floorSimPopulationFromRoster } from './livingMembers';
import { createManagedGym, hireManager, withUpdatedGym } from './management';
import {
  buySessionEquipment,
  createGymState,
  sessionEquipmentCost,
  type GymState,
} from './sessions';
import { stockStationCapability } from './stationCapability';
import {
  persistableFacilityTruth,
  presentationStepProgressPerTick,
  presentationTickIntervalMs,
  presentationWorld,
  type PresentationWorldInput,
} from './presentationState';

const T = EMPIRE_TUNING;
const KIT: readonly LadderEquipmentItem[] = Object.freeze([...T.LADDER_STARTING_EQUIPMENT]);
const BENCH: FloorStationRef = Object.freeze({
  kind: 'training',
  station: 'competition-bench-bay',
});
const MATS_CELL: GridPosition = Object.freeze({ x: 5, y: 3 });
const BAR_A: GridPosition = Object.freeze({ x: 6, y: 0 });
const BAR_B: GridPosition = Object.freeze({ x: 5, y: 2 });
const BAR_C: GridPosition = Object.freeze({ x: 0, y: 3 });
const BAR_D: GridPosition = Object.freeze({ x: 7, y: 0 });

function garageRoster() {
  return createLivingMemberRoster('garage', KIT, [], 0, T.FLOOR_SIM_RENDER_SEED);
}

function garageInput(
  overrides: Partial<PresentationWorldInput> = {},
): PresentationWorldInput {
  const roster = overrides.roster ?? garageRoster();
  const floor = overrides.floor ?? createFloorState('garage');
  const managed = overrides.managed ?? createManagedGym();
  const capability = overrides.capability ?? stockStationCapability();
  const context: FloorSimContext = Object.freeze({
    rung: floor.rung,
    floor,
    barbellOwned: managed.gym.ladder.equipment,
    sessionOwned: managed.gym.sessionEquipment,
    capability,
    livingPopulation: floorSimPopulationFromRoster(roster),
  });
  const sim = overrides.sim ?? createFloorSimState(context, T.FLOOR_SIM_RENDER_SEED);
  return Object.freeze({
    sim,
    floor,
    roster,
    managed,
    capability,
  });
}

function contextFrom(input: PresentationWorldInput): FloorSimContext {
  return Object.freeze({
    rung: input.floor.rung,
    floor: input.floor,
    barbellOwned: input.managed.gym.ladder.equipment,
    sessionOwned: input.managed.gym.sessionEquipment,
    capability: input.capability,
    livingPopulation: floorSimPopulationFromRoster(input.roster),
  });
}

function gymWithSettledPurse(gymBucks: number): GymState {
  return Object.freeze({
    ...createGymState(),
    ladder: Object.freeze({ ...createLadderState(), gymBucks }),
  });
}

describe('presentationState.ts — cadence and identity', () => {
  it('publishes tick cadence from tuning, not a visual clock', () => {
    expect(presentationTickIntervalMs()).toBe(T.FLOOR_SIM_TICK_INTERVAL_MS);
    expect(presentationStepProgressPerTick()).toBe(T.FLOOR_SIM_STEP_PROGRESS_PER_TICK);
    expect(presentationStepProgressPerTick()).toBeGreaterThan(0);
    expect(presentationStepProgressPerTick()).toBeLessThanOrEqual(1);
  });

  it('keys members by GymMemberId, not array index', () => {
    const input = garageInput();
    const world = presentationWorld(input);
    expect(world.members.length).toBe(input.sim.members.length);
    for (let index = 0; index < world.members.length; index += 1) {
      const row = world.members[index];
      const living = input.roster.members[index];
      expect(row?.id).toBe(living?.id);
      expect(row?.id).toBe(deriveMemberId(input.roster.identityNonce, index));
      expect(row?.lifecycle).toBe('seeking');
      expect(row?.experienceStatus).toBe('forming');
      expect(row?.experienceComposite).toBeNull();
    }
    const ids = world.members.map((member) => member.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keys stations by FloorStationRef and equipment by SKU', () => {
    const world = presentationWorld(garageInput());
    const bench = world.stations.find((station) => station.ref.kind === 'training');
    expect(bench?.ref).toEqual(BENCH);
    expect(bench?.capacity).toBe(1);
    expect(bench?.occupancy).toBe('available');
    const furniture = world.equipment.filter((row) => row.kind === 'furniture');
    expect(furniture.map((row) => row.item)).toEqual([...KIT]);
    for (const row of furniture) {
      expect(row.placed).toBe(true);
      expect(row.position).not.toBeNull();
    }
  });

  it('reports the hired manager without inventing a floor location', () => {
    const opened = garageInput();
    expect(presentationWorld(opened).staff.hired).toBe(false);
    const cost = T.MANAGER_HIRE_COST_GYM_BUCKS[T.MANAGER_TIERS[0]];
    const hired = hireManager(
      withUpdatedGym(opened.managed, gymWithSettledPurse(cost)),
      T.MANAGER_TIERS[0],
      0,
    );
    expect(hired.kind).toBe('hired');
    if (hired.kind !== 'hired') return;
    const world = presentationWorld(garageInput({ managed: hired.state }));
    expect(world.staff).toEqual(
      Object.freeze({
        hired: true,
        tier: T.MANAGER_TIERS[0],
        hiredUnderWarning: false,
      }),
    );
    expect(world.staff).not.toHaveProperty('cell');
    expect(world.staff).not.toHaveProperty('sprite');
  });
});

describe('presentationState.ts — one member, one station lifecycle', () => {
  it('walks a garage member onto the bench, occupies, uses, and releases', () => {
    let input = garageInput();
    const context = contextFrom(input);
    let sawSeeking = false;
    let userId: ReturnType<typeof deriveMemberId> | null = null;
    let occupiedTick = -1;
    let released = false;
    const horizon = 360;
    for (let tick = 0; tick < horizon; tick += 1) {
      const world = presentationWorld(input);
      expect(world.facility.tick).toBe(input.sim.tick);
      for (let index = 0; index < world.members.length; index += 1) {
        const member = world.members[index];
        if (member === undefined) continue;
        if (member.lifecycle === 'seeking' && member.target !== null) sawSeeking = true;
        if (member.lifecycle === 'using' && userId === null) {
          userId = member.id;
          occupiedTick = world.facility.tick;
          expect(member.target).toEqual(BENCH);
          expect(member.progress).toBeGreaterThanOrEqual(0);
          expect(member.progress).toBeLessThan(1);
        }
        if (userId !== null && member.id === userId && member.lifecycle === 'leaving') {
          released = true;
        }
      }
      const bench = world.stations.find((station) => station.ref.kind === 'training');
      if (userId !== null && occupiedTick === world.facility.tick) {
        expect(bench?.occupancy).toBe('occupied');
        expect(bench?.usingIds).toEqual([userId]);
      }
      if (released) break;
      const stepped: FloorSimState = stepFloorSim(input.sim, context);
      input = Object.freeze({ ...input, sim: stepped });
    }
    expect(sawSeeking).toBe(true);
    expect(userId).not.toBeNull();
    expect(released).toBe(true);
    const world = presentationWorld(input);
    const user = world.members.find((member) => member.id === userId);
    expect(user?.lifecycle).toBe('leaving');
    expect(user?.target).toBeNull();
    const bench = world.stations.find((station) => station.ref.kind === 'training');
    expect(bench?.usingIds).not.toContain(userId);
  });
});

describe('presentationState.ts — constrained queue', () => {
  it('forms a FIFO queue on the stock bay and serves the head after release', () => {
    let input = garageInput();
    const context = contextFrom(input);
    expect(presentationWorld(input).business.capacitySeats).toBe(1);
    let queuedIds: readonly string[] = [];
    let userId: string | null = null;
    let servedHead: string | null = null;
    const horizon = 480;
    for (let tick = 0; tick < horizon; tick += 1) {
      const world = presentationWorld(input);
      const bench = world.stations.find((station) => station.ref.kind === 'training');
      if (bench !== undefined && bench.usingIds.length === 1 && bench.queueIds.length > 0 && userId === null) {
        userId = bench.usingIds[0] ?? null;
        queuedIds = bench.queueIds;
        expect(queuedIds.length).toBeGreaterThan(0);
        const head = world.members.find((member) => member.id === queuedIds[0]);
        expect(head?.lifecycle).toBe('queuing');
        expect(head?.queueRank).toBe(0);
        expect(head?.waitTicks).not.toBeNull();
        expect(head?.waitTicks ?? -1).toBeGreaterThanOrEqual(0);
        expect(bench.occupancy).toBe('occupied');
      }
      if (userId !== null && bench !== undefined && bench.usingIds.length === 1) {
        const current = bench.usingIds[0];
        if (current !== userId && servedHead === null) {
          servedHead = current ?? null;
          expect(servedHead).toBe(queuedIds[0]);
          break;
        }
      }
      input = Object.freeze({ ...input, sim: stepFloorSim(input.sim, context) });
    }
    expect(userId).not.toBeNull();
    expect(queuedIds.length).toBeGreaterThan(0);
    expect(servedHead).toBe(queuedIds[0]);
    expect(servedHead).not.toBe(userId);
  });
});

describe('presentationState.ts — repeated movement and persistence', () => {
  it('moves the same furniture SKU four times without duplicating it', () => {
    const opened = createFloorState('garage');
    const first = placeFloorFurniture(opened, KIT, 'power-bar', BAR_A);
    expect(first.kind).toBe('placed');
    if (first.kind !== 'placed') return;
    const second = placeFloorFurniture(first.state, KIT, 'power-bar', BAR_B);
    expect(second.kind).toBe('placed');
    if (second.kind !== 'placed') return;
    const third = placeFloorFurniture(second.state, KIT, 'power-bar', BAR_C);
    expect(third.kind).toBe('placed');
    if (third.kind !== 'placed') return;
    const fourth = placeFloorFurniture(third.state, KIT, 'power-bar', BAR_D);
    expect(fourth.kind).toBe('placed');
    if (fourth.kind !== 'placed') return;
    expect(fourth.state.furniture['power-bar']).toEqual(BAR_D);
    expect(Object.keys(fourth.state.furniture).sort()).toEqual([...KIT].sort());
    const world = presentationWorld(garageInput({ floor: fourth.state }));
    const bars = world.equipment.filter((row) => row.item === 'power-bar');
    expect(bars.length).toBe(1);
    expect(bars[0]?.position).toEqual(BAR_D);
    expect(bars[0]?.placed).toBe(true);
  });

  it('JSON-round-trips persistable truth without changing SKU identity or member ids', () => {
    const moved = placeFloorFurniture(createFloorState('garage'), KIT, 'power-bar', BAR_A);
    expect(moved.kind).toBe('placed');
    if (moved.kind !== 'placed') return;
    const input = garageInput({ floor: moved.state });
    const snap = persistableFacilityTruth(input);
    const restored = JSON.parse(JSON.stringify(snap)) as typeof snap;
    expect(restored.furniture['power-bar']).toEqual(BAR_A);
    expect(restored.ladderEquipment).toEqual([...KIT]);
    expect(restored.memberCount).toBe(input.roster.members.length);
    expect(restored.identityNonce).toBe(input.roster.identityNonce);
    for (let index = 0; index < restored.memberCount; index += 1) {
      expect(deriveMemberId(restored.identityNonce, index)).toBe(input.roster.members[index]?.id);
    }
    const world = presentationWorld(input);
    expect(world.equipment.filter((row) => row.item === 'power-bar')).toHaveLength(1);
  });
});

describe('presentationState.ts — purchase, ownership, placement, operational effect', () => {
  it('buys mats, leaves them unplaced, then places them as a session station', () => {
    const cost = sessionEquipmentCost('mats');
    const bought = buySessionEquipment(gymWithSettledPurse(cost), 'mats');
    expect(bought.kind).toBe('bought');
    if (bought.kind !== 'bought') return;
    expect(bought.state.sessionEquipment).toEqual(['mats']);
    const managed = withUpdatedGym(createManagedGym(), bought.state);
    const unplaced = garageInput({ managed });
    const before = presentationWorld(unplaced);
    const matsBefore = before.equipment.find((row) => row.item === 'mats');
    expect(matsBefore?.kind).toBe('session');
    expect(matsBefore?.placed).toBe(false);
    expect(matsBefore?.position).toBeNull();
    expect(before.stations.some((station) => station.ref.kind === 'session' && station.ref.item === 'mats')).toBe(
      false,
    );

    const placed = placeFloorItem(unplaced.floor, bought.state.sessionEquipment, 'mats', MATS_CELL);
    expect(placed.kind).toBe('placed');
    if (placed.kind !== 'placed') return;
    const afterInput = garageInput({ managed, floor: placed.state });
    const after = presentationWorld(afterInput);
    const matsAfter = after.equipment.find((row) => row.item === 'mats');
    expect(matsAfter?.placed).toBe(true);
    expect(matsAfter?.position).toEqual(MATS_CELL);
    expect(
      after.stations.some((station) => station.ref.kind === 'session' && station.ref.item === 'mats'),
    ).toBe(true);
    expect(after.equipment.filter((row) => row.item === 'mats')).toHaveLength(1);

    const snap = persistableFacilityTruth(afterInput);
    const restored = JSON.parse(JSON.stringify(snap)) as typeof snap;
    expect(restored.sessionEquipment).toEqual(['mats']);
    expect(restored.placements.mats).toEqual(MATS_CELL);
    expect(restored.gymBucks).toBe(bought.state.ladder.gymBucks);
  });
});

describe('presentationState.ts — canonical queue order and snapshot coherence', () => {
  it('does not reimplement claimantsOf; sim and contract share one order', () => {
    const source = readFileSync(new URL('./presentationState.ts', import.meta.url), 'utf8');
    expect(source).not.toContain('function claimantsOf');
    expect(source).not.toContain('compareClaimants');
    expect(source).toContain("claimantsOf,");
  });

  it('queueIds and queueRank match floorSim claimantsOf, not a claim-tick-only sort', () => {
    const input = garageInput();
    const context = contextFrom(input);
    const stations = floorStations(context);
    const bench = stations.find((station) => station.ref.kind === 'training');
    expect(bench).toBeDefined();
    if (bench === undefined) return;
    const first = input.sim.members[0];
    const second = input.sim.members[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (first === undefined || second === undefined) return;
    const walker = Object.freeze({
      ...first,
      state: 'seeking' as const,
      target: bench.ref,
      claimedAt: 1,
      queuedAt: null,
      queueArrivedAt: null,
    });
    const arriver = Object.freeze({
      ...second,
      state: 'queuing' as const,
      target: bench.ref,
      claimedAt: 10,
      queuedAt: 5,
      queueArrivedAt: 5,
    });
    const planted = garageInput({
      sim: Object.freeze({
        ...input.sim,
        members: Object.freeze([walker, arriver]),
      }),
    });
    const canonical = claimantsOf(planted.sim.members, bench.ref);
    expect(canonical.map((member) => member.index)).toEqual([1, 0]);
    const claimTickOnly = [...planted.sim.members].sort((left, right) => {
      const leftAt = left.claimedAt ?? 0;
      const rightAt = right.claimedAt ?? 0;
      if (leftAt !== rightAt) return leftAt - rightAt;
      return left.index - right.index;
    });
    expect(claimTickOnly.map((member) => member.index)).toEqual([0, 1]);
    expect(canonical.map((member) => member.index)).not.toEqual(
      claimTickOnly.map((member) => member.index),
    );
    const world = presentationWorld(planted);
    const view = world.stations.find((station) => station.ref.kind === 'training');
    expect(view?.queueIds).toEqual([world.members[1]?.id]);
    expect(view?.approachingIds).toEqual([world.members[0]?.id]);
    expect(world.members[1]?.queueRank).toBe(0);
    expect(world.members[0]?.queueRank).toBe(1);
  });

  it('world input has no stations field; a smuggled list is refused', () => {
    const input = garageInput();
    expect(Object.keys(input).sort()).toEqual(['capability', 'floor', 'managed', 'roster', 'sim']);
    expect(Object.prototype.hasOwnProperty.call(input, 'stations')).toBe(false);
    expect(() =>
      presentationWorld({
        ...input,
        stations: [],
      } as PresentationWorldInput),
    ).toThrow(/second station list/);
  });
});
