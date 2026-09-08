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
import {
  createFloorState,
  floorFurnitureLayout,
  floorGridSize,
  floorLayout,
  placeFloorItem,
  type GridPosition,
} from './floor';
import {
  claimantsOf,
  createFloorSimState,
  floorStations,
  seatChangeoverTicks,
  stepFloorSim,
  withAmbientLivingPopulation,
  type FloorSimContext,
  type FloorSimMember,
  type FloorSimState,
  type FloorStation,
  type FloorStationRef,
} from './floorSim';
import { type LadderRung } from './ladder';
import { createLivingMemberRoster, floorSimPopulationFromRoster } from './livingMembers';
import { createManagedGym } from './management';
import { presentationWorld, type PresentationWorldInput } from './presentationState';
import { type SessionEquipmentItem } from './sessions';
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
  readonly kind:
    | 'occupied-seat'
    | 'changeover-seat'
    | 'empty-foreign-pad'
    | 'leaving-foreign'
    | 'wander-use'
    | 'furniture';
}

function refsMatch(left: FloorStationRef, right: FloorStationRef): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === 'training' && right.kind === 'training') return left.station === right.station;
  if (left.kind === 'fixed' && right.kind === 'fixed') return left.item === right.item;
  if (left.kind === 'session' && right.kind === 'session') return left.item === right.item;
  return false;
}

function reservedUseCells(
  station: FloorStation,
  members: readonly FloorSimMember[],
  changeovers: FloorSimState['changeovers'],
): ReadonlySet<string> {
  const reserved = new Set<string>();
  let ghosts = 0;
  for (const member of members) {
    if (member.state !== 'using') continue;
    if (member.target === null || !refsMatch(member.target, station.ref)) continue;
    let onSeat = false;
    for (const cell of station.useCells) {
      if (!sameCell(cell, member.cell)) continue;
      reserved.add(`${cell.x},${cell.y}`);
      onSeat = true;
      break;
    }
    if (!onSeat) ghosts += 1;
  }
  for (const cell of station.useCells) {
    if (seatChangeoverTicks(changeovers, station.ref, cell) <= 0) continue;
    reserved.add(`${cell.x},${cell.y}`);
  }
  for (let i = 0; i < ghosts; i += 1) {
    for (const cell of station.useCells) {
      const key = `${cell.x},${cell.y}`;
      if (reserved.has(key)) continue;
      reserved.add(key);
      break;
    }
  }
  return reserved;
}

function assignedSeatOf(member: FloorSimMember, input: PresentationWorldInput): GridPosition | null {
  if (member.target === null) return null;
  if (member.state !== 'seeking' && member.state !== 'queuing') return null;
  const station = floorStations(contextFrom(input)).find((row) => refsMatch(row.ref, member.target as FloorStationRef));
  if (station === undefined) return null;
  const claimed = claimantsOf(input.sim.members, member.target);
  const order = claimed.findIndex((row) => row.index === member.index);
  const reserved = reservedUseCells(station, input.sim.members, input.sim.changeovers);
  const remaining: GridPosition[] = [];
  for (const cell of station.useCells) {
    if (reserved.has(`${cell.x},${cell.y}`)) continue;
    remaining.push(cell);
  }
  if (order < 0 || order >= remaining.length) return null;
  return remaining[order] as GridPosition;
}

function allUseCells(input: PresentationWorldInput): readonly { readonly cell: GridPosition; readonly station: FloorStation }[] {
  const rows: { readonly cell: GridPosition; readonly station: FloorStation }[] = [];
  for (const station of floorStations(contextFrom(input))) {
    for (const cell of station.useCells) rows.push({ cell, station });
  }
  return rows;
}

function isGhostReserveSnapshot(input: PresentationWorldInput): boolean {
  const using = input.sim.members.filter((member) => member.state === 'using');
  if (using.length === 0) return false;
  const pads = allUseCells(input);
  return using.every((member) => !pads.some((row) => sameCell(row.cell, member.cell)));
}

function collectHits(input: PresentationWorldInput): readonly TransitHit[] {
  const hits: TransitHit[] = [];
  const blocked = furnitureBlocked(input);
  const ghost = isGhostReserveSnapshot(input);
  const pads = allUseCells(input);
  for (const member of input.sim.members) {
    if (
      member.next !== null &&
      blocked.has(`${member.next.x},${member.next.y}`) &&
      (member.state === 'seeking' || member.state === 'queuing' || member.state === 'leaving')
    ) {
      hits.push({
        tick: input.sim.tick,
        walkerId: member.memberId,
        walkerState: member.state,
        seat: `${member.next.x},${member.next.y}`,
        kind: 'furniture',
      });
    }
    for (const { cell, station } of pads) {
      if (!occupies(member, cell)) continue;
      const seatKey = `${cell.x},${cell.y}`;
      const assigned = assignedSeatOf(member, input);
      const ownAssigned = assigned !== null && sameCell(assigned, cell);
      const ownFormer =
        member.state === 'leaving' && member.awayFrom !== null && sameCell(member.awayFrom, cell);
      if (member.state === 'using') continue;
      if (member.state === 'leaving') {
        if (member.next !== null && sameCell(member.next, cell) && !ownFormer) {
          hits.push({
            tick: input.sim.tick,
            walkerId: member.memberId,
            walkerState: member.state,
            seat: seatKey,
            kind: 'leaving-foreign',
          });
        }
        continue;
      }
      if (member.state !== 'seeking' && member.state !== 'queuing') continue;
      if (ownAssigned) continue;
      if (ghost && member.next !== null && sameCell(member.next, cell) && !sameCell(member.cell, cell)) {
        continue;
      }
      if (member.target === null) {
        if (member.next !== null && sameCell(member.next, cell)) {
          hits.push({
            tick: input.sim.tick,
            walkerId: member.memberId,
            walkerState: member.state,
            seat: seatKey,
            kind: 'wander-use',
          });
        }
        continue;
      }
      const occupier = input.sim.members.find(
        (row) => row.state === 'using' && row.target !== null && refsMatch(row.target, station.ref) && sameCell(row.cell, cell),
      );
      if (occupier !== undefined && occupier.memberId !== member.memberId) {
        hits.push({
          tick: input.sim.tick,
          walkerId: member.memberId,
          walkerState: member.state,
          seat: seatKey,
          kind: 'occupied-seat',
        });
      } else if (seatChangeoverTicks(input.sim.changeovers, station.ref, cell) > 0) {
        hits.push({
          tick: input.sim.tick,
          walkerId: member.memberId,
          walkerState: member.state,
          seat: seatKey,
          kind: 'changeover-seat',
        });
      } else {
        hits.push({
          tick: input.sim.tick,
          walkerId: member.memberId,
          walkerState: member.state,
          seat: seatKey,
          kind: 'empty-foreign-pad',
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

const STEPS: readonly GridPosition[] = Object.freeze([
  Object.freeze({ x: 0, y: -1 }),
  Object.freeze({ x: 1, y: 0 }),
  Object.freeze({ x: 0, y: 1 }),
  Object.freeze({ x: -1, y: 0 }),
]);

function rungContext(
  rung: LadderRung,
  floor = createFloorState(rung),
  capability = stockStationCapability(),
): FloorSimContext {
  const sessionOwned = Object.keys(floor.placements) as SessionEquipmentItem[];
  return withAmbientLivingPopulation({
    rung,
    floor,
    barbellOwned: [...T.LADDER_STARTING_EQUIPMENT],
    sessionOwned,
    capability,
  });
}

function capabilityWithCapacity() {
  const bought = upgradeStation(stockStationCapability(), 'competition-bench-bay', 'capacity', 10_000, true, true);
  if (bought.kind !== 'upgraded') throw new Error('capacity buy failed');
  return bought.capability;
}

function blockedKeys(context: FloorSimContext): ReadonlySet<string> {
  const grid = floorGridSize(context.rung);
  const blocked = new Set<string>();
  const furniture = floorFurnitureLayout(context.floor, context.barbellOwned);
  const placed = floorLayout(context.floor);
  const bay = competitionBenchBay(
    context.floor,
    context.barbellOwned,
    stationLevels(context.capability, 'competition-bench-bay').capacity,
  );
  const rows = [...furniture, ...placed, ...(bay.expansion === null ? [] : [bay.expansion])];
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

function useKeys(stations: readonly FloorStation[]): ReadonlySet<string> {
  const cells = new Set<string>();
  for (const station of stations) {
    for (const cell of station.useCells) cells.add(`${cell.x},${cell.y}`);
  }
  return cells;
}

/** Walkable cells whose only walkable neighbours are use cells — the pick(true) domain. */
function boxedCells(context: FloorSimContext): readonly {
  readonly cell: GridPosition;
  readonly onUse: boolean;
  readonly useNeighbors: readonly string[];
}[] {
  const grid = floorGridSize(context.rung);
  const stations = floorStations(context);
  const blocked = blockedKeys(context);
  const uses = useKeys(stations);
  const found: { readonly cell: GridPosition; readonly onUse: boolean; readonly useNeighbors: readonly string[] }[] = [];
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const key = `${x},${y}`;
      if (blocked.has(key)) continue;
      const useNeighbors: string[] = [];
      let nonUse = 0;
      for (const step of STEPS) {
        const nx = x + step.x;
        const ny = y + step.y;
        if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
        const nkey = `${nx},${ny}`;
        if (blocked.has(nkey)) continue;
        if (uses.has(nkey)) useNeighbors.push(nkey);
        else nonUse += 1;
      }
      if (useNeighbors.length > 0 && nonUse === 0) {
        found.push({ cell: { x, y }, onUse: uses.has(key), useNeighbors });
      }
    }
  }
  return found;
}

function memberAt(
  index: number,
  cell: GridPosition,
  extras: Partial<FloorSimMember> = {},
): FloorSimMember {
  return Object.freeze({
    memberId: `member:n0:${index}`,
    index,
    type: 'casual',
    state: 'seeking',
    cell,
    next: null,
    progress: 0,
    target: null,
    targetPosition: null,
    claimedAt: null,
    queuedAt: null,
    queueArrivedAt: null,
    timer: 0,
    interruptedBy: null,
    awayFrom: null,
    strandedAt: null,
    usingStartedAt: null,
    ...extras,
  });
}

function stateOf(members: readonly FloorSimMember[]): FloorSimState {
  return Object.freeze({
    tick: 0,
    seed: 1,
    members: Object.freeze([...members]),
    changeovers: Object.freeze({}),
  });
}

function garageWraps(at: GridPosition, capacity: boolean): FloorSimContext {
  const placed = placeFloorItem(createFloorState('garage'), ['wrist-wraps'], 'wrist-wraps', at);
  if (placed.kind !== 'placed') throw new Error(`wraps at ${at.x},${at.y} refused as ${placed.reason}`);
  return rungContext('garage', placed.state, capacity ? capabilityWithCapacity() : stockStationCapability());
}

describe('use-cell liveness fallback is not a corridor', () => {
  it('pick(true) is reachable on a legal garage: wraps at (1,3) + Capacity boxes the wraps pad against (2,2)', () => {
    const context = garageWraps({ x: 1, y: 3 }, true);
    const boxed = boxedCells(context);
    const leave = boxed.find((row) => row.onUse && row.cell.x === 1 && row.cell.y === 2);
    expect(leave, JSON.stringify(boxed)).toBeDefined();
    expect(leave?.useNeighbors).toEqual(['2,2']);
    const stations = floorStations(context);
    const wraps = stations.find((station) => station.ref.kind === 'session' && station.ref.item === 'wrist-wraps');
    const bay = stations.find((station) => station.ref.kind === 'training');
    expect(wraps?.useCell).toEqual({ x: 1, y: 2 });
    expect(bay?.useCells.some((cell) => cell.x === 2 && cell.y === 2)).toBe(true);
  });

  it('leaving a boxed pad stands rather than stepping onto a foreign pad', () => {
    const context = garageWraps({ x: 1, y: 3 }, true);
    const pad: GridPosition = { x: 1, y: 2 };
    const foreign: GridPosition = { x: 2, y: 2 };
    let at = stateOf([
      memberAt(0, pad, {
        state: 'leaving',
        timer: T.FLOOR_SIM_LEAVING_TICKS,
        awayFrom: pad,
      }),
    ]);
    at = stepFloorSim(at, context);
    const member = at.members[0] as FloorSimMember;
    expect(member.cell).toEqual(pad);
    expect(member.next).toBeNull();
    expect(occupies(member, foreign)).toBe(false);
  });

  it('empty foreign pad is still illegal: wander from (7,1) with wraps at (7,2) + Capacity does not step onto (7,0)', () => {
    const context = garageWraps({ x: 7, y: 2 }, true);
    const boxed = boxedCells(context);
    const aisle = boxed.find((row) => !row.onUse && row.cell.x === 7 && row.cell.y === 1);
    expect(aisle, JSON.stringify(boxed)).toBeDefined();
    expect(aisle?.useNeighbors).toContain('7,0');
    let at = stateOf([memberAt(0, { x: 7, y: 1 })]);
    for (let i = 0; i < 20; i += 1) {
      at = stepFloorSim(at, context);
      const member = at.members[0] as FloorSimMember;
      expect(occupies(member, { x: 7, y: 0 }), `tick ${at.tick}`).toBe(false);
      for (const station of floorStations(context)) {
        for (const cell of station.useCells) {
          expect(occupies(member, cell), `tick ${at.tick} use ${cell.x},${cell.y}`).toBe(false);
        }
      }
    }
  });

  it('opening stock/capacity on every rung never steps wander or leave onto a foreign pad', () => {
    const hits: string[] = [];
    for (const rung of T.LADDER_RUNGS) {
      for (const capacity of [false, true]) {
        const context = rungContext(rung, createFloorState(rung), capacity ? capabilityWithCapacity() : stockStationCapability());
        const stations = floorStations(context);
        const uses = useKeys(stations);
        let at = createFloorSimState(context, T.FLOOR_SIM_RENDER_SEED);
        for (let i = 0; i < 80; i += 1) {
          at = stepFloorSim(at, context);
          for (const member of at.members) {
            if (member.state === 'using') continue;
            const ownFormer =
              member.state === 'leaving' && member.awayFrom !== null
                ? `${member.awayFrom.x},${member.awayFrom.y}`
                : null;
            const standing = `${member.cell.x},${member.cell.y}`;
            const next = member.next === null ? null : `${member.next.x},${member.next.y}`;
            if (member.state === 'leaving') {
              if (next !== null && uses.has(next) && next !== ownFormer) {
                hits.push(`${rung}/c${capacity ? 1 : 0} t${at.tick} ${member.memberId} leave-next ${next}`);
              }
            } else if (member.state === 'seeking' || member.state === 'queuing') {
              if (uses.has(standing) && standing !== ownFormer) {
                // assigned-seat entry is legal; only flag when not using that pad as goal.
                // Opening roster will enter assigned seats — skip cell occupancy here.
              }
              if (next !== null && uses.has(next)) {
                const assigned =
                  member.target === null
                    ? null
                    : (() => {
                        const station = stations.find((row) => member.target !== null && refsMatch(row.ref, member.target));
                        if (station === undefined) return null;
                        const claimed = claimantsOf(at.members, member.target);
                        const order = claimed.findIndex((row) => row.index === member.index);
                        const reserved = reservedUseCells(station, at.members, at.changeovers);
                        const remaining = station.useCells.filter((cell) => !reserved.has(`${cell.x},${cell.y}`));
                        return remaining[order] ?? null;
                      })();
                if (assigned === null || `${assigned.x},${assigned.y}` !== next) {
                  hits.push(`${rung}/c${capacity ? 1 : 0} t${at.tick} ${member.memberId} ${member.state} next-use ${next}`);
                }
              }
            }
          }
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it('boxed leave on wraps@(1,3) never uses the Capacity pad as the exit step across the leaving timer', () => {
    const context = garageWraps({ x: 1, y: 3 }, true);
    let at = stateOf([
      memberAt(0, { x: 1, y: 2 }, {
        state: 'leaving',
        timer: T.FLOOR_SIM_LEAVING_TICKS,
        awayFrom: { x: 1, y: 2 },
      }),
    ]);
    for (let i = 0; i < T.FLOOR_SIM_LEAVING_TICKS + 2; i += 1) {
      at = stepFloorSim(at, context);
      const member = at.members[0] as FloorSimMember;
      expect(occupies(member, { x: 2, y: 2 }), `tick ${at.tick} state ${member.state}`).toBe(false);
    }
  });
});
