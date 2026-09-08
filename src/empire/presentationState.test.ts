/**
 * presentationState.test.ts — Session B presentation-state contract.
 *
 * SIMULATION / CONTRACT / QUEUE / ECONOMY / SERIALIZATION SHAPE proofs.
 * PERSISTENCE is not wired. These do not claim Visual, Animation, or
 * Soft-Feel PASS.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { EMPIRE_TUNING } from './empireTuning';
import {
  createFloorState,
  placeFloorFurniture,
  placeFloorItem,
  type GridPosition,
} from './floor';
import {
  createFloorSimState,
  claimantsOf,
  stepFloorSim,
  type FloorSimContext,
  type FloorSimMember,
  type FloorSimState,
  type FloorStationRef,
} from './floorSim';
import { createLadderState, type LadderEquipmentItem } from './ladder';
import { createLivingMemberRoster, deriveMemberId, floorSimPopulationFromRoster, memberIdForIndex } from './livingMembers';
import { createManagedGym, hireManager, withUpdatedGym } from './management';
import {
  buySessionEquipment,
  createGymState,
  sessionEquipmentCost,
  type GymState,
} from './sessions';
import { stockStationCapability, stationChangeoverTicks, upgradeStation } from './stationCapability';
import {
  persistableFacilityTruth,
  presentationStepProgressPerTick,
  presentationTickIntervalMs,
  presentationWorld,
  type PresentationStation,
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
    rung: 'garage',
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
    expect(input).not.toHaveProperty('stations');
  });

  it('keys stations by FloorStationRef and equipment by SKU', () => {
    const world = presentationWorld(garageInput());
    const bench = world.stations.find((station) => station.ref.kind === 'training');
    expect(bench?.ref).toEqual(BENCH);
    expect(bench?.capacity).toBe(1);
    expect(bench?.occupancy).toBe('available');
    expect(bench?.seats).toHaveLength(1);
    expect(bench?.seats[0]?.usingId).toBeNull();
    expect(bench?.seats[0]?.changeoverTicks).toBe(0);
    expect(bench).not.toHaveProperty('queueCells');
    expect(bench).not.toHaveProperty('occupiedQueueCells');
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

  it('queueIds and queueRank are floorSim.claimantsOf order, filtered to queuing', () => {
    let input = garageInput();
    const context = contextFrom(input);
    let matched = false;
    for (let tick = 0; tick < 480; tick += 1) {
      const world = presentationWorld(input);
      const bench = world.stations.find((station) => station.ref.kind === 'training');
      if (bench !== undefined && bench.queueIds.length > 0) {
        const order = claimantsOf(input.sim.members, BENCH);
        const queued = order.filter((member) => member.state === 'queuing');
        const expectedIds = queued.map((member) => memberIdForIndex(input.roster, member.index));
        expect(bench.queueIds).toEqual(expectedIds);
        for (let rank = 0; rank < order.length; rank += 1) {
          const claimant = order[rank];
          if (claimant === undefined) continue;
          const row = world.members.find((member) => member.id === memberIdForIndex(input.roster, claimant.index));
          expect(row?.queueRank).toBe(rank);
        }
        matched = true;
        break;
      }
      input = Object.freeze({ ...input, sim: stepFloorSim(input.sim, context) });
    }
    expect(matched).toBe(true);
  });

  it('pins arriver-before-claimer ranks so a claimantsOf mutation reddens this proof', () => {
    const input = garageInput();
    const walker = input.sim.members[0];
    const arriver = input.sim.members[1];
    const spare = input.sim.members[2];
    expect(walker).toBeDefined();
    expect(arriver).toBeDefined();
    expect(spare).toBeDefined();
    if (walker === undefined || arriver === undefined || spare === undefined) return;
    const queued = Object.freeze({
      ...arriver,
      state: 'queuing' as const,
      target: BENCH,
      targetPosition: { x: 3, y: 0 },
      claimedAt: 10,
      queuedAt: 3,
      queueArrivedAt: 3,
    });
    const walking = Object.freeze({
      ...walker,
      state: 'seeking' as const,
      target: BENCH,
      targetPosition: { x: 3, y: 0 },
      claimedAt: 1,
      queuedAt: null,
      queueArrivedAt: null,
    });
    const idle = Object.freeze({
      ...spare,
      state: 'seeking' as const,
      target: null,
      claimedAt: null,
      queuedAt: null,
    });
    const sim: FloorSimState = Object.freeze({
      ...input.sim,
      members: Object.freeze([walking, queued, idle]),
    });
    const world = presentationWorld(Object.freeze({ ...input, sim }));
    const walkerId = memberIdForIndex(input.roster, 0);
    const arriverId = memberIdForIndex(input.roster, 1);
    expect(world.members.find((member) => member.id === arriverId)?.queueRank).toBe(0);
    expect(world.members.find((member) => member.id === walkerId)?.queueRank).toBe(1);
    const bench = world.stations.find((station) => station.ref.kind === 'training');
    expect(bench?.queueIds).toEqual([arriverId]);
    expect(claimantsOf(sim.members, BENCH).map((member) => member.index)).toEqual([1, 0]);
  });

  it('does not encode the four-key fairness formula; floorSim.claimantsOf is the only copy', () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'presentationState.ts'), 'utf8');
    expect(source).not.toMatch(/queuedAt \?\? .*claimedAt/);
    expect(source).not.toMatch(/function claimantsOf/);
    expect(source).not.toMatch(/function compareClaimants/);
    expect(source).toMatch(/claimantsOf\(/);
  });
});

describe('presentationState.ts — live capacity throughput', () => {
  function trainingBay(world: ReturnType<typeof presentationWorld>) {
    return world.stations.find((station) => station.ref.kind === 'training');
  }

  function buyCapacity(input: PresentationWorldInput): PresentationWorldInput {
    const bought = upgradeStation(
      input.capability,
      'competition-bench-bay',
      'capacity',
      10_000,
      true,
      true,
    );
    expect(bought.kind).toBe('upgraded');
    if (bought.kind !== 'upgraded') return input;
    return Object.freeze({ ...input, capability: bought.capability });
  }

  it('stock capacity 1 queues FIFO, wait accumulates, then live Capacity seats a second member', () => {
    let input = garageInput();
    const rosterIds = input.roster.members.map((member) => member.id);
    expect(rosterIds).toHaveLength(3);
    expect(presentationWorld(input).business.bayCapacity).toBe(0);
    expect(trainingBay(presentationWorld(input))?.capacity).toBe(1);

    let queuedAt: {
      readonly tick: number;
      readonly usingId: string;
      readonly queueIds: readonly string[];
      readonly waitTicks: number;
      readonly occupantSeat: string | null;
    } | null = null;
    let waitGrew = false;
    for (let tick = 0; tick < 480; tick += 1) {
      const world = presentationWorld(input);
      const bay = trainingBay(world);
      expect(bay?.ref).toEqual(BENCH);
      expect(bay?.seats.length).toBe(bay?.capacity);
      if (
        queuedAt === null &&
        bay !== undefined &&
        bay.usingIds.length === 1 &&
        bay.queueIds.length >= 1
      ) {
        const usingId = bay.usingIds[0];
        const head = world.members.find((member) => member.id === bay.queueIds[0]);
        expect(usingId).toBeDefined();
        expect(head?.lifecycle).toBe('queuing');
        expect(head?.queueRank).toBe(0);
        expect(head?.waitTicks).not.toBeNull();
        if (usingId === undefined || head?.waitTicks === null || head.waitTicks === undefined) {
          break;
        }
        expect(bay.seats[0]?.usingId).toBe(usingId);
        expect(rosterIds).toContain(usingId);
        expect(rosterIds).toContain(head.id);
        queuedAt = Object.freeze({
          tick: world.facility.tick,
          usingId,
          queueIds: bay.queueIds,
          waitTicks: head.waitTicks,
          occupantSeat: bay.seats[0]?.usingId ?? null,
        });
      } else if (queuedAt !== null) {
        const head = world.members.find((member) => member.id === queuedAt.queueIds[0]);
        if (head?.lifecycle === 'queuing' && head.waitTicks !== null) {
          if (head.waitTicks > queuedAt.waitTicks) waitGrew = true;
        }
        break;
      }
      input = Object.freeze({ ...input, sim: stepFloorSim(input.sim, contextFrom(input)) });
    }
    expect(queuedAt).not.toBeNull();
    expect(waitGrew).toBe(true);
    if (queuedAt === null) return;

    const idsBefore = presentationWorld(input).members.map((member) => member.id);
    input = buyCapacity(input);
    const afterBuy = presentationWorld(input);
    expect(afterBuy.business.bayCapacity).toBe(1);
    expect(afterBuy.business.bayThroughput).toBe(0);
    expect(trainingBay(afterBuy)?.capacity).toBe(2);
    expect(trainingBay(afterBuy)?.seats).toHaveLength(2);
    expect(afterBuy.members.map((member) => member.id)).toEqual(idsBefore);
    expect(afterBuy.members.some((member) => member.lifecycle === 'interrupted')).toBe(false);

    const purchaseQueueHead = queuedAt.queueIds[0];
    const originalUser = queuedAt.usingId;
    let dualAt: {
      readonly tick: number;
      readonly usingIds: readonly string[];
      readonly queueIds: readonly string[];
      readonly occupiedSeats: number;
      readonly secondUser: string | null;
    } | null = null;
    for (let tick = 0; tick < 240; tick += 1) {
      input = Object.freeze({ ...input, sim: stepFloorSim(input.sim, contextFrom(input)) });
      const world = presentationWorld(input);
      const bay = trainingBay(world);
      expect(world.members.map((member) => member.id)).toEqual(idsBefore);
      expect(world.members.some((member) => member.lifecycle === 'interrupted')).toBe(false);
      if (bay === undefined) continue;
      expect(bay.capacity).toBe(2);
      expect(bay.seats).toHaveLength(2);
      const occupiedSeats = bay.seats.filter((seat) => seat.usingId !== null).length;
      for (const seat of bay.seats) {
        if (seat.usingId !== null) expect(bay.usingIds).toContain(seat.usingId);
      }
      if (bay.usingIds.length >= 2 && dualAt === null) {
        const secondUser = bay.usingIds.find((id) => id !== originalUser) ?? null;
        dualAt = Object.freeze({
          tick: world.facility.tick,
          usingIds: bay.usingIds,
          queueIds: bay.queueIds,
          occupiedSeats,
          secondUser,
        });
        break;
      }
    }
    expect(dualAt).not.toBeNull();
    if (dualAt === null) return;
    expect(dualAt.usingIds).toHaveLength(2);
    expect(dualAt.usingIds).toContain(originalUser);
    expect(dualAt.secondUser).toBe(purchaseQueueHead);
    expect(dualAt.queueIds.length).toBeLessThan(queuedAt.queueIds.length);
    expect(dualAt.occupiedSeats).toBe(2);
    expect(dualAt.usingIds.every((id) => rosterIds.includes(id))).toBe(true);
  });
});

describe('presentationState.ts — live Capacity red team', () => {
  function trainingBay(world: ReturnType<typeof presentationWorld>) {
    return world.stations.find((station) => station.ref.kind === 'training');
  }

  function buyAxis(
    input: PresentationWorldInput,
    axis: 'capacity' | 'throughput' | 'quality',
    realizesCapacity: boolean,
  ): ReturnType<typeof upgradeStation> {
    return upgradeStation(
      input.capability,
      'competition-bench-bay',
      axis,
      10_000,
      true,
      realizesCapacity,
    );
  }

  function buyCapacity(input: PresentationWorldInput): PresentationWorldInput {
    const bought = buyAxis(input, 'capacity', true);
    expect(bought.kind).toBe('upgraded');
    if (bought.kind !== 'upgraded') return input;
    return Object.freeze({ ...input, capability: bought.capability });
  }

  function cellKey(cell: { readonly x: number; readonly y: number }): string {
    return `${cell.x},${cell.y}`;
  }

  function ghostIds(bay: PresentationStation): readonly string[] {
    const seated = new Set(
      bay.seats.map((seat) => seat.usingId).filter((id): id is string => id !== null),
    );
    return bay.usingIds.filter((id) => !seated.has(id));
  }

  function assertSeatInvariants(bay: PresentationStation): void {
    expect(bay.seats.length).toBe(bay.capacity);
    const cells = bay.seats.map((seat) => cellKey(seat.cell));
    expect(new Set(cells).size).toBe(cells.length);
    const occupied: string[] = [];
    for (const seat of bay.seats) {
      expect(seat.changeoverTicks).toBeGreaterThanOrEqual(0);
      if (seat.usingId === null) continue;
      expect(bay.usingIds).toContain(seat.usingId);
      occupied.push(seat.usingId);
    }
    expect(new Set(occupied).size).toBe(occupied.length);
  }

  function assertStableRoster(
    world: ReturnType<typeof presentationWorld>,
    rosterIds: readonly string[],
  ): void {
    const ids = world.members.map((member) => member.id);
    expect(ids).toEqual(rosterIds);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(3);
  }

  function driveUntilQueue(start: PresentationWorldInput): PresentationWorldInput {
    let input = start;
    for (let tick = 0; tick < 480; tick += 1) {
      const bay = trainingBay(presentationWorld(input));
      if (bay !== undefined && bay.usingIds.length === 1 && bay.queueIds.length >= 1) {
        return input;
      }
      input = Object.freeze({ ...input, sim: stepFloorSim(input.sim, contextFrom(input)) });
    }
    return input;
  }

  it('ghost-reserve is a bounded stale-snapshot window, not a persistent occupancy bug', () => {
    let input = driveUntilQueue(garageInput());
    const rosterIds = input.roster.members.map((member) => member.id);
    const before = presentationWorld(input);
    const beforeBay = trainingBay(before);
    expect(beforeBay).toBeDefined();
    if (beforeBay === undefined) return;
    assertSeatInvariants(beforeBay);
    expect(before.business.bayCapacity).toBe(0);
    expect(before.business.bayThroughput).toBe(0);
    expect(beforeBay.capacity).toBe(1);
    expect(beforeBay.seats).toHaveLength(1);
    const originalUser = beforeBay.usingIds[0];
    const purchaseQueueHead = beforeBay.queueIds[0];
    const purchaseQueue = beforeBay.queueIds;
    const originalCell = before.members.find((member) => member.id === originalUser)?.cell;
    expect(originalUser).toBeDefined();
    expect(purchaseQueueHead).toBeDefined();
    expect(originalCell).toBeDefined();
    if (originalUser === undefined || purchaseQueueHead === undefined || originalCell === undefined) {
      return;
    }
    expect(beforeBay.seats[0]?.usingId).toBe(originalUser);
    expect(claimantsOf(input.sim.members, BENCH).filter((member) => member.state === 'queuing').map((member) => memberIdForIndex(input.roster, member.index))).toEqual(
      purchaseQueue,
    );

    const idsBefore = before.members.map((member) => member.id);
    const nonceBefore = input.roster.identityNonce;
    input = buyCapacity(input);
    const ghostWorld = presentationWorld(input);
    const ghostBay = trainingBay(ghostWorld);
    expect(ghostBay).toBeDefined();
    if (ghostBay === undefined) return;
    assertSeatInvariants(ghostBay);
    assertStableRoster(ghostWorld, rosterIds);
    expect(ghostWorld.facility.tick).toBe(before.facility.tick);
    expect(ghostWorld.business.bayCapacity).toBe(1);
    expect(ghostWorld.business.bayThroughput).toBe(0);
    expect(ghostWorld.business.capacitySeats).toBe(2);
    expect(ghostBay.capacity).toBe(2);
    expect(ghostBay.seats).toHaveLength(2);
    expect(ghostWorld.members.some((member) => member.lifecycle === 'interrupted')).toBe(false);
    expect(input.roster.identityNonce).toBe(nonceBefore);
    expect(input.roster.members).toHaveLength(3);
    expect(ghostWorld.members.map((member) => member.id)).toEqual(idsBefore);

    const occupant = ghostWorld.members.find((member) => member.id === originalUser);
    expect(occupant?.lifecycle).toBe('using');
    expect(occupant?.cell).toEqual(originalCell);
    const seatKeys = ghostBay.seats.map((seat) => cellKey(seat.cell));
    expect(seatKeys).not.toContain(cellKey(originalCell));
    expect(ghostBay.usingIds).toEqual([originalUser]);
    expect(ghostBay.seats.map((seat) => seat.usingId)).toEqual([null, null]);
    expect(ghostIds(ghostBay)).toEqual([originalUser]);
    expect(ghostBay.queueIds).toEqual(purchaseQueue);
    const headStillQueued = ghostWorld.members.find((member) => member.id === purchaseQueueHead);
    expect(headStillQueued?.lifecycle).toBe('queuing');
    expect(headStillQueued?.queueRank).toBe(0);

    let ghostTicks = 0;
    let dualAt: {
      readonly tick: number;
      readonly usingIds: readonly string[];
      readonly queueIds: readonly string[];
      readonly occupiedSeats: number;
      readonly originalSeat: string | null;
      readonly secondSeat: string | null;
      readonly ghostStillPresent: boolean;
    } | null = null;
    let originalLandedAt: number | null = null;
    let originalLandedSeat: string | null = null;
    let persistentGhost = false;
    for (let tick = 0; tick < 240; tick += 1) {
      input = Object.freeze({ ...input, sim: stepFloorSim(input.sim, contextFrom(input)) });
      const world = presentationWorld(input);
      const bay = trainingBay(world);
      expect(bay).toBeDefined();
      if (bay === undefined) continue;
      assertSeatInvariants(bay);
      assertStableRoster(world, rosterIds);
      expect(world.members.some((member) => member.lifecycle === 'interrupted')).toBe(false);
      expect(world.business.bayThroughput).toBe(0);
      expect(world.business.bayCapacity).toBe(1);
      expect(bay.capacity).toBe(2);
      const order = claimantsOf(input.sim.members, BENCH);
      const queued = order.filter((member) => member.state === 'queuing');
      expect(bay.queueIds).toEqual(queued.map((member) => memberIdForIndex(input.roster, member.index)));
      const ghosts = ghostIds(bay);
      if (ghosts.length > 0) {
        ghostTicks += 1;
        expect(ghosts).toContain(originalUser);
        const stillUsing = world.members.find((member) => member.id === originalUser);
        if (stillUsing?.lifecycle !== 'using') persistentGhost = true;
      } else if (originalLandedAt === null) {
        const seat = bay.seats.find((row) => row.usingId === originalUser);
        originalLandedAt = world.facility.tick;
        originalLandedSeat = seat === undefined ? null : cellKey(seat.cell);
      }
      if (bay.usingIds.length >= 2 && dualAt === null) {
        const originalSeat = bay.seats.find((seat) => seat.usingId === originalUser);
        const secondSeat = bay.seats.find((seat) => seat.usingId === purchaseQueueHead);
        dualAt = Object.freeze({
          tick: world.facility.tick,
          usingIds: bay.usingIds,
          queueIds: bay.queueIds,
          occupiedSeats: bay.seats.filter((seat) => seat.usingId !== null).length,
          originalSeat: originalSeat === undefined ? null : cellKey(originalSeat.cell),
          secondSeat: secondSeat === undefined ? null : cellKey(secondSeat.cell),
          ghostStillPresent: ghosts.length > 0,
        });
        break;
      }
    }

    expect(persistentGhost).toBe(false);
    expect(dualAt).not.toBeNull();
    if (dualAt === null) return;
    expect(originalLandedAt).not.toBeNull();
    expect(ghostTicks).toBeGreaterThanOrEqual(0);
    expect(ghostTicks).toBeLessThan(dualAt.tick - before.facility.tick + 1);
    expect(dualAt.usingIds).toEqual(expect.arrayContaining([originalUser, purchaseQueueHead]));
    expect(dualAt.usingIds).toHaveLength(2);
    expect(dualAt.occupiedSeats).toBe(2);
    expect(dualAt.ghostStillPresent).toBe(false);
    expect(dualAt.queueIds.length).toBeLessThan(purchaseQueue.length);
    expect(dualAt.queueIds).not.toContain(purchaseQueueHead);
    expect(dualAt.originalSeat).not.toBeNull();
    expect(dualAt.secondSeat).not.toBeNull();
    expect(dualAt.originalSeat).not.toBe(dualAt.secondSeat);
    expect(seatKeys).toEqual(expect.arrayContaining([dualAt.originalSeat, dualAt.secondSeat]));
    expect({
      useCellsAfter: seatKeys,
      originalCellAtPurchase: cellKey(originalCell),
      ghostOccupiedSeats: 0,
      ghostUsing: 1,
      queueUnchangedAtPurchase: true,
      bayThroughputStaysZero: true,
      ghostTicksAfterFirstStep: ghostTicks,
      dualDelay: dualAt.tick - before.facility.tick,
      originalLandedSeat,
      secondSeat: dualAt.secondSeat,
      originalSeatAtDual: dualAt.originalSeat,
    }).toEqual({
      useCellsAfter: ['2,2', '7,0'],
      originalCellAtPurchase: '5,0',
      ghostOccupiedSeats: 0,
      ghostUsing: 1,
      queueUnchangedAtPurchase: true,
      bayThroughputStaysZero: true,
      ghostTicksAfterFirstStep: 0,
      dualDelay: 4,
      originalLandedSeat: '2,2',
      secondSeat: '7,0',
      originalSeatAtDual: '2,2',
    });
  });

  it('live Capacity never resets the roster or mints a duplicate member', () => {
    let input = driveUntilQueue(garageInput());
    const rosterIds = input.roster.members.map((member) => member.id);
    const nonce = input.roster.identityNonce;
    input = buyCapacity(input);
    for (let tick = 0; tick < 120; tick += 1) {
      const world = presentationWorld(input);
      assertStableRoster(world, rosterIds);
      expect(input.roster.identityNonce).toBe(nonce);
      expect(input.roster.members.map((member) => member.id)).toEqual(rosterIds);
      const bay = trainingBay(world);
      if (bay !== undefined) assertSeatInvariants(bay);
      input = Object.freeze({ ...input, sim: stepFloorSim(input.sim, contextFrom(input)) });
    }
  });

  it('a refused Capacity purchase leaves one seat and does not interrupt', () => {
    const queued = driveUntilQueue(garageInput());
    const before = presentationWorld(queued);
    const refused = buyAxis(queued, 'capacity', false);
    expect(refused).toEqual(
      expect.objectContaining({
        kind: 'refused',
        reason: 'no-second-position',
      }),
    );
    if (refused.kind !== 'refused') return;
    const world = presentationWorld(Object.freeze({ ...queued, capability: refused.capability }));
    const bay = trainingBay(world);
    expect(bay?.capacity).toBe(1);
    expect(bay?.seats).toHaveLength(1);
    expect(world.business.bayCapacity).toBe(0);
    expect(world.business.bayThroughput).toBe(0);
    expect(world.members.map((member) => member.id)).toEqual(before.members.map((member) => member.id));
    expect(world.members.some((member) => member.lifecycle === 'interrupted')).toBe(false);
  });

  it('live Throughput does not add a seat and does not serve a second member', () => {
    let input = driveUntilQueue(garageInput());
    const rosterIds = input.roster.members.map((member) => member.id);
    const beforeBay = trainingBay(presentationWorld(input));
    expect(beforeBay?.capacity).toBe(1);
    const bought = buyAxis(input, 'throughput', true);
    expect(bought.kind).toBe('upgraded');
    if (bought.kind !== 'upgraded') return;
    input = Object.freeze({ ...input, capability: bought.capability });
    const afterBuy = presentationWorld(input);
    expect(afterBuy.business.bayThroughput).toBe(1);
    expect(afterBuy.business.bayCapacity).toBe(0);
    expect(trainingBay(afterBuy)?.capacity).toBe(1);
    expect(trainingBay(afterBuy)?.seats).toHaveLength(1);
    expect(stationChangeoverTicks(input.capability, 'training', 'competition-bench-bay')).toBe(
      T.STATION_THROUGHPUT_CHANGEOVER_TICKS,
    );
    expect(stationChangeoverTicks(stockStationCapability(), 'training', 'competition-bench-bay')).toBe(
      T.FLOOR_SIM_STATION_CHANGEOVER_TICKS,
    );
    let maxUsing = trainingBay(afterBuy)?.usingIds.length ?? 0;
    let maxSeats = trainingBay(afterBuy)?.capacity ?? 0;
    for (let tick = 0; tick < 240; tick += 1) {
      input = Object.freeze({ ...input, sim: stepFloorSim(input.sim, contextFrom(input)) });
      const world = presentationWorld(input);
      const bay = trainingBay(world);
      expect(bay).toBeDefined();
      if (bay === undefined) continue;
      assertSeatInvariants(bay);
      assertStableRoster(world, rosterIds);
      expect(world.business.bayThroughput).toBe(1);
      expect(world.business.bayCapacity).toBe(0);
      expect(bay.capacity).toBe(1);
      expect(bay.seats).toHaveLength(1);
      maxUsing = Math.max(maxUsing, bay.usingIds.length);
      maxSeats = Math.max(maxSeats, bay.capacity);
      expect(world.members.some((member) => member.lifecycle === 'interrupted')).toBe(false);
    }
    expect(maxUsing).toBe(1);
    expect(maxSeats).toBe(1);
  });

  it('live Quality does not add a seat and does not change Throughput', () => {
    let input = driveUntilQueue(garageInput());
    const rosterIds = input.roster.members.map((member) => member.id);
    const bought = buyAxis(input, 'quality', true);
    expect(bought.kind).toBe('upgraded');
    if (bought.kind !== 'upgraded') return;
    input = Object.freeze({ ...input, capability: bought.capability });
    const afterBuy = presentationWorld(input);
    expect(afterBuy.business.bayQuality).toBe(1);
    expect(afterBuy.business.bayCapacity).toBe(0);
    expect(afterBuy.business.bayThroughput).toBe(0);
    expect(trainingBay(afterBuy)?.capacity).toBe(1);
    expect(trainingBay(afterBuy)?.seats).toHaveLength(1);
    expect(stationChangeoverTicks(input.capability, 'training', 'competition-bench-bay')).toBe(
      T.FLOOR_SIM_STATION_CHANGEOVER_TICKS,
    );
    let maxUsing = trainingBay(afterBuy)?.usingIds.length ?? 0;
    for (let tick = 0; tick < 240; tick += 1) {
      input = Object.freeze({ ...input, sim: stepFloorSim(input.sim, contextFrom(input)) });
      const world = presentationWorld(input);
      const bay = trainingBay(world);
      expect(bay).toBeDefined();
      if (bay === undefined) continue;
      assertSeatInvariants(bay);
      assertStableRoster(world, rosterIds);
      expect(world.business.bayQuality).toBe(1);
      expect(world.business.bayCapacity).toBe(0);
      expect(world.business.bayThroughput).toBe(0);
      expect(bay.capacity).toBe(1);
      maxUsing = Math.max(maxUsing, bay.usingIds.length);
      expect(world.members.some((member) => member.lifecycle === 'interrupted')).toBe(false);
    }
    expect(maxUsing).toBe(1);
  });

  it('stock changeover remains 18 after live Capacity; dual occupancy still loads plates', () => {
    let input = driveUntilQueue(garageInput());
    const rosterIds = input.roster.members.map((member) => member.id);
    input = buyCapacity(input);
    expect(stationChangeoverTicks(input.capability, 'training', 'competition-bench-bay')).toBe(
      T.FLOOR_SIM_STATION_CHANGEOVER_TICKS,
    );
    let sawDual = false;
    let loading: {
      readonly changeoverTicks: number;
      readonly usingId: string | null;
      readonly bayThroughput: number;
      readonly capacity: number;
    } | null = null;
    for (let tick = 0; tick < 720; tick += 1) {
      input = Object.freeze({ ...input, sim: stepFloorSim(input.sim, contextFrom(input)) });
      const world = presentationWorld(input);
      const bay = trainingBay(world);
      expect(bay).toBeDefined();
      if (bay === undefined) continue;
      assertSeatInvariants(bay);
      assertStableRoster(world, rosterIds);
      expect(world.business.bayThroughput).toBe(0);
      expect(world.business.bayCapacity).toBe(1);
      if (bay.usingIds.length >= 2) sawDual = true;
      if (loading === null) {
        const loadingSeat = bay.seats.find((seat) => seat.changeoverTicks > 0);
        if (loadingSeat !== undefined) {
          loading = Object.freeze({
            changeoverTicks: loadingSeat.changeoverTicks,
            usingId: loadingSeat.usingId,
            bayThroughput: world.business.bayThroughput,
            capacity: bay.capacity,
          });
          break;
        }
      }
    }
    expect(sawDual).toBe(true);
    expect(loading).not.toBeNull();
    if (loading === null) return;
    expect(loading.usingId).toBeNull();
    expect(loading.bayThroughput).toBe(0);
    expect(loading.capacity).toBe(2);
    expect(loading.changeoverTicks).toBeGreaterThan(0);
    expect(loading.changeoverTicks).toBeLessThanOrEqual(T.FLOOR_SIM_STATION_CHANGEOVER_TICKS);
    expect(loading.changeoverTicks).not.toBe(T.STATION_THROUGHPUT_CHANGEOVER_TICKS);
  });

  it('persistableFacilityTruth round-trips live Capacity without restoring the sim', () => {
    const queued = driveUntilQueue(garageInput());
    const bought = buyCapacity(queued);
    const snap = persistableFacilityTruth(bought);
    const restored = JSON.parse(JSON.stringify(snap)) as typeof snap;
    expect(restored.capability).toEqual(bought.capability);
    expect(restored.identityNonce).toBe(bought.roster.identityNonce);
    expect(restored.memberCount).toBe(3);
    expect(restored).not.toHaveProperty('sim');
    expect(restored).not.toHaveProperty('members');
    expect(restored).not.toHaveProperty('stations');
    const world = presentationWorld(bought);
    expect(world.business.bayCapacity).toBe(1);
    expect(world.business.bayThroughput).toBe(0);
    expect(trainingBay(world)?.seats).toHaveLength(2);
  });

  it('seat, FIFO, and identity invariants hold for 720 ticks after live Capacity', () => {
    let input = driveUntilQueue(garageInput());
    const rosterIds = input.roster.members.map((member) => member.id);
    const purchaseQueue = trainingBay(presentationWorld(input))?.queueIds ?? [];
    expect(purchaseQueue.length).toBeGreaterThan(0);
    input = buyCapacity(input);
    let sawDual = false;
    let minQueueAfterDual = purchaseQueue.length;
    let interrupted = 0;
    let maxUsing = 0;
    let maxOccupiedSeats = 0;
    let ghostAfterFirstStep = 0;
    for (let tick = 0; tick < 720; tick += 1) {
      input = Object.freeze({ ...input, sim: stepFloorSim(input.sim, contextFrom(input)) });
      const world = presentationWorld(input);
      const bay = trainingBay(world);
      expect(bay).toBeDefined();
      if (bay === undefined) continue;
      assertSeatInvariants(bay);
      assertStableRoster(world, rosterIds);
      expect(world.business.bayCapacity).toBe(1);
      expect(world.business.bayThroughput).toBe(0);
      expect(bay.capacity).toBe(2);
      const queued = claimantsOf(input.sim.members, BENCH).filter((member) => member.state === 'queuing');
      expect(bay.queueIds).toEqual(queued.map((member) => memberIdForIndex(input.roster, member.index)));
      for (const member of world.members) {
        if (member.lifecycle === 'interrupted') interrupted += 1;
        if (member.lifecycle !== 'seeking' && member.lifecycle !== 'queuing') continue;
        for (const seat of bay.seats) {
          const onSeat =
            (member.cell.x === seat.cell.x && member.cell.y === seat.cell.y) ||
            (member.next !== null &&
              member.next.x === seat.cell.x &&
              member.next.y === seat.cell.y);
          if (!onSeat) continue;
          expect(
            seat.usingId === null || seat.usingId === member.id,
            `${member.id} ${member.lifecycle} transited occupied ${cellKey(seat.cell)}`,
          ).toBe(true);
          expect(
            seat.changeoverTicks === 0,
            `${member.id} ${member.lifecycle} transited changeover ${cellKey(seat.cell)}`,
          ).toBe(true);
        }
      }
      const ghosts = ghostIds(bay);
      if (ghosts.length > 0) ghostAfterFirstStep += 1;
      maxUsing = Math.max(maxUsing, bay.usingIds.length);
      maxOccupiedSeats = Math.max(maxOccupiedSeats, bay.seats.filter((seat) => seat.usingId !== null).length);
      if (bay.usingIds.length >= 2) {
        sawDual = true;
        minQueueAfterDual = Math.min(minQueueAfterDual, bay.queueIds.length);
      }
    }
    expect(interrupted).toBe(0);
    expect(sawDual).toBe(true);
    expect(maxUsing).toBe(2);
    expect(maxOccupiedSeats).toBe(2);
    expect(minQueueAfterDual).toBeLessThan(purchaseQueue.length);
    expect(ghostAfterFirstStep).toBe(0);
  });
});

describe('presentationState.ts — snapshot coherence', () => {
  it('refuses a floor whose rung is not the managed gym rung', () => {
    const input = garageInput();
    expect(input.managed.gym.ladder.rung).toBe('garage');
    expect(() =>
      presentationWorld(Object.freeze({ ...input, floor: createFloorState('warehouse') })),
    ).toThrow(/floor rung does not match managed gym rung/);
  });

  it('refuses a sim whose member ids are not the roster ids', () => {
    const input = garageInput();
    const first = input.sim.members[0];
    expect(first).toBeDefined();
    if (first === undefined) return;
    const swapped: FloorSimMember = Object.freeze({ ...first, memberId: 'member:n0:99' });
    const rest = input.sim.members.slice(1);
    const sim: FloorSimState = Object.freeze({
      ...input.sim,
      members: Object.freeze([swapped, ...rest]),
    });
    expect(() => presentationWorld(Object.freeze({ ...input, sim }))).toThrow(
      /roster id does not match sim member/,
    );
  });

  it('does not accept a stations field; stations are derived from the bundle', () => {
    const input = garageInput();
    expect(input).not.toHaveProperty('stations');
    const world = presentationWorld(input);
    expect(world.stations.some((station) => station.ref.kind === 'training')).toBe(true);
  });
});

describe('presentationState.ts — repeated movement and serialization shape', () => {
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

  it('JSON-round-trips the serialization payload without changing SKU identity or member ids', () => {
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
