/**
 * floorSim.occupiedPathing.test.ts — VL-2B occupied-cell pathing red team.
 *
 * Working pads (`useCells`) are not transit corridors. Seeking / queuing
 * members may not occupy or step into a seat another member is using, or a
 * changeover pad they are not leaving. Furniture footprints stay impassable.
 * Aisle tiles may still be shared — members do not block each other.
 *
 * Pure tests: step the sim, read presentationWorld. No renderer.
 */

import { describe, expect, it } from 'vitest';

import { EMPIRE_TUNING } from './empireTuning';
import { createFloorState, floorFurnitureLayout, floorGridSize, floorLayout } from './floor';
import {
  createFloorSimState,
  floorStations,
  stepFloorSim,
  type FloorSimContext,
  type FloorSimMember,
  type FloorStationRef,
} from './floorSim';
import { createLivingMemberRoster, floorSimPopulationFromRoster } from './livingMembers';
import { createManagedGym } from './management';
import { presentationWorld, type PresentationWorldInput } from './presentationState';
import { stationLevels, stockStationCapability, upgradeStation } from './stationCapability';
import { competitionBenchBay } from './trainingStation';

const T = EMPIRE_TUNING;
const BENCH: FloorStationRef = Object.freeze({
  kind: 'training',
  station: 'competition-bench-bay',
});

function garageRoster() {
  return createLivingMemberRoster('garage', T.LADDER_STARTING_EQUIPMENT, [], 0, T.FLOOR_SIM_RENDER_SEED);
}

function garageInput(overrides: Partial<PresentationWorldInput> = {}): PresentationWorldInput {
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
  return Object.freeze({ sim, floor, roster, managed, capability });
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

function buyAxis(
  input: PresentationWorldInput,
  axis: 'capacity' | 'throughput' | 'quality',
): PresentationWorldInput {
  const bought = upgradeStation(
    input.capability,
    'competition-bench-bay',
    axis,
    10_000,
    true,
    axis === 'capacity',
  );
  if (bought.kind !== 'upgraded') throw new Error(`buy ${axis} failed: ${bought.kind}`);
  return Object.freeze({ ...input, capability: bought.capability });
}

function sameCell(
  left: { readonly x: number; readonly y: number },
  right: { readonly x: number; readonly y: number },
): boolean {
  return left.x === right.x && left.y === right.y;
}

function occupies(
  member: FloorSimMember,
  cell: { readonly x: number; readonly y: number },
): boolean {
  if (sameCell(member.cell, cell)) return true;
  if (member.next !== null && sameCell(member.next, cell)) return true;
  return false;
}

function furnitureBlocked(input: PresentationWorldInput): ReadonlySet<string> {
  const grid = floorGridSize(input.floor.rung);
  const blocked = new Set<string>();
  const furniture = floorFurnitureLayout(input.floor, input.managed.gym.ladder.equipment);
  const placed = floorLayout(input.floor);
  const bay = competitionBenchBay(
    input.floor,
    input.managed.gym.ladder.equipment,
    stationLevels(input.capability, 'competition-bench-bay').capacity,
  );
  const rows = [
    ...furniture,
    ...placed,
    ...(bay.expansion === null ? [] : [bay.expansion]),
  ];
  for (const row of rows) {
    for (let dy = 0; dy < row.footprint.height; dy += 1) {
      for (let dx = 0; dx < row.footprint.width; dx += 1) {
        const x = row.position.x + dx;
        const y = row.position.y + dy;
        if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) continue;
        blocked.add(`${x},${y}`);
      }
    }
  }
  return blocked;
}

interface TransitHit {
  readonly tick: number;
  readonly walkerId: string;
  readonly walkerState: FloorSimMember['state'];
  readonly seat: string;
  readonly kind: 'occupied-seat' | 'changeover-seat' | 'furniture';
}

function collectHits(input: PresentationWorldInput): readonly TransitHit[] {
  const hits: TransitHit[] = [];
  const world = presentationWorld(input);
  const bay = world.stations.find((station) => station.ref.kind === 'training');
  const blocked = furnitureBlocked(input);
  for (const member of input.sim.members) {
    // Pathing into furniture (next) is a defect. Standing on a newly blocked
    // cell with next=null is the live-Capacity ghost snapshot; the next
    // advance relocates via nearestWalkable.
    if (
      member.next !== null &&
      blocked.has(`${member.next.x},${member.next.y}`) &&
      (member.state === 'seeking' || member.state === 'queuing')
    ) {
      hits.push({
        tick: input.sim.tick,
        walkerId: member.memberId,
        walkerState: member.state,
        seat: `${member.next.x},${member.next.y}`,
        kind: 'furniture',
      });
    }
    if (member.state !== 'seeking' && member.state !== 'queuing') continue;
    if (bay === undefined) continue;
    for (const seat of bay.seats) {
      if (!occupies(member, seat.cell)) continue;
      if (seat.usingId !== null && seat.usingId !== member.memberId) {
        hits.push({
          tick: input.sim.tick,
          walkerId: member.memberId,
          walkerState: member.state,
          seat: `${seat.cell.x},${seat.cell.y}`,
          kind: 'occupied-seat',
        });
      } else if (seat.usingId === null && seat.changeoverTicks > 0) {
        hits.push({
          tick: input.sim.tick,
          walkerId: member.memberId,
          walkerState: member.state,
          seat: `${seat.cell.x},${seat.cell.y}`,
          kind: 'changeover-seat',
        });
      }
    }
  }
  return hits;
}

function standingOnFurnitureAfterStep(input: PresentationWorldInput): readonly TransitHit[] {
  const blocked = furnitureBlocked(input);
  const hits: TransitHit[] = [];
  for (const member of input.sim.members) {
    const standing = `${member.cell.x},${member.cell.y}`;
    if (!blocked.has(standing)) continue;
    hits.push({
      tick: input.sim.tick,
      walkerId: member.memberId,
      walkerState: member.state,
      seat: standing,
      kind: 'furniture',
    });
  }
  return hits;
}

function drive(
  start: PresentationWorldInput,
  ticks: number,
  purchaseAtQueue: 'capacity' | 'throughput' | 'quality' | null,
): { input: PresentationWorldInput; hits: TransitHit[]; boughtAt: number | null } {
  let input = start;
  const hits: TransitHit[] = [];
  let boughtAt: number | null = null;
  for (let i = 0; i < ticks; i += 1) {
    hits.push(...collectHits(input));
    if (purchaseAtQueue !== null && boughtAt === null) {
      const world = presentationWorld(input);
      const bay = world.stations.find((station) => station.ref.kind === 'training');
      if (bay !== undefined && bay.usingIds.length >= 1 && bay.queueIds.length >= 1) {
        input = buyAxis(input, purchaseAtQueue);
        boughtAt = input.sim.tick;
        hits.push(...collectHits(input));
      }
    }
    input = Object.freeze({ ...input, sim: stepFloorSim(input.sim, contextFrom(input)) });
    hits.push(...standingOnFurnitureAfterStep(input));
  }
  hits.push(...collectHits(input));
  return { input, hits, boughtAt };
}

describe('occupied-cell pathing red team', () => {
  it('1. stock capacity: seekers do not transit the occupied primary pad', () => {
    const { hits, boughtAt } = drive(garageInput(), 120, null);
    expect(boughtAt).toBeNull();
    expect(hits).toEqual([]);
  });

  it('2. live Capacity: VL-2B seeker does not transit relocated user at (2,2)', () => {
    const { hits, boughtAt, input } = drive(garageInput(), 80, 'capacity');
    expect(boughtAt).not.toBeNull();
    const world = presentationWorld(input);
    const bay = world.stations.find((station) => station.ref.kind === 'training');
    expect(bay?.capacity).toBe(2);
    expect(bay?.seats.some((seat) => seat.cell.x === 2 && seat.cell.y === 2)).toBe(true);
    expect(hits).toEqual([]);
  });

  it('3. Throughput purchase does not open a pad as an aisle', () => {
    const { hits, boughtAt } = drive(garageInput(), 80, 'throughput');
    expect(boughtAt).not.toBeNull();
    expect(hits).toEqual([]);
  });

  it('4. Quality purchase does not open a pad as an aisle', () => {
    const { hits, boughtAt } = drive(garageInput(), 80, 'quality');
    expect(boughtAt).not.toBeNull();
    expect(hits).toEqual([]);
  });

  it('5–9. queue pressure, changeover, ghost-reserve, leaving, multiple walkers', () => {
    const { hits, boughtAt, input } = drive(garageInput(), 160, 'capacity');
    expect(boughtAt).not.toBeNull();
    expect(hits).toEqual([]);

    let sawQueue = false;
    let sawChangeover = false;
    let sawLeaving = false;
    let sawDualWalkers = false;
    let sawDualUse = false;
    let replay = garageInput();
    for (let i = 0; i < 160; i += 1) {
      const world = presentationWorld(replay);
      const bay = world.stations.find((station) => station.ref.kind === 'training');
      if (bay !== undefined && bay.usingIds.length >= 1 && bay.queueIds.length >= 1 && world.business.bayCapacity === 0) {
        replay = buyAxis(replay, 'capacity');
      }
      const after = presentationWorld(replay);
      const afterBay = after.stations.find((station) => station.ref.kind === 'training');
      if ((afterBay?.queueIds.length ?? 0) >= 1) sawQueue = true;
      if (afterBay?.seats.some((seat) => seat.changeoverTicks > 0) === true) sawChangeover = true;
      if (replay.sim.members.some((member) => member.state === 'leaving')) sawLeaving = true;
      const walkers = replay.sim.members.filter(
        (member) => member.state === 'seeking' || member.state === 'queuing',
      );
      if (walkers.length >= 2) sawDualWalkers = true;
      if ((afterBay?.usingIds.length ?? 0) >= 2) sawDualUse = true;
      replay = Object.freeze({ ...replay, sim: stepFloorSim(replay.sim, contextFrom(replay)) });
    }
    expect(sawQueue).toBe(true);
    expect(sawChangeover).toBe(true);
    expect(sawLeaving).toBe(true);
    expect(sawDualWalkers).toBe(true);
    expect(sawDualUse).toBe(true);
    expect(input.sim.members).toHaveLength(3);
  });

  it('FIFO and assigned-seat entry still work: a claimant may occupy their own empty pad', () => {
    let input = garageInput();
    input = buyAxis(input, 'capacity');
    let enteredOwnSeat = false;
    for (let i = 0; i < 40; i += 1) {
      const world = presentationWorld(input);
      const bay = world.stations.find((station) => station.ref.kind === 'training');
      if (bay !== undefined) {
        for (const seat of bay.seats) {
          if (seat.usingId === null) continue;
          const user = input.sim.members.find((member) => member.memberId === seat.usingId);
          if (user !== undefined && occupies(user, seat.cell) && user.state === 'using') {
            enteredOwnSeat = true;
          }
        }
      }
      input = Object.freeze({ ...input, sim: stepFloorSim(input.sim, contextFrom(input)) });
    }
    expect(enteredOwnSeat).toBe(true);
    const stations = floorStations(contextFrom(input));
    const bay = stations.find((station) => station.ref.kind === 'training');
    expect(bay?.useCells.length).toBe(2);
    expect(BENCH.kind).toBe('training');
  });
});
