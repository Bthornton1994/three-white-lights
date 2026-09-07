/**
 * worldView.ts — simulation-to-rendering projector for the living gym world.
 *
 * Pure module (CLAUDE.md, "Pure logic is separate from UI"): zero React, zero
 * side effects, zero I/O, no clock, no randomness, no pixels. Its one import
 * is `./floorSim` — the machine this file reads, never writes.
 *
 * WHY THIS FILE EXISTS. FloorGrid already lerps members and FloorSim already
 * walks, queues, uses, and leaves. Play still treated occupancy as HUD cards
 * and hid the station outlines, so the gym read as a static room image with
 * numbers on top. This module is the named mapping the living-world slice
 * needs:
 *
 *   member simulation state  ->  WorldMemberView
 *   station simulation state ->  WorldStationView
 *   queue state              ->  occupied queue cells on the station
 *
 * FloorGrid.tsx is the renderer that draws these views. It does not become a
 * second source of gameplay truth. GymState gains no field.
 *
 * WHAT THIS SLICE DOES NOT DO. It does not invent staff AI, persistent NPCs,
 * arrivals, dues, or a new pathfinder. Staff remain a management surface
 * until a later authorised slice gives them world presence. Equipment already
 * exists as persistent `FloorStation` objects; this file only names how they
 * occupy. Queue *capacity upgrades* are the second proof, not this one.
 */

import {
  floorStationRefKey,
  seatChangeoverTicks,
  type FloorSimMember,
  type FloorSimState,
  type FloorStation,
  type FloorStationRef,
} from './floorSim';

/** World-facing member activity. Renderer-only; the sim keeps `FLOOR_SIM_MEMBER_STATES`. */
export const WORLD_MEMBER_ACTIVITIES = Object.freeze([
  'walking',
  'waiting',
  'using',
  'leaving',
  'interrupted',
  'stranded',
] as const);
export type WorldMemberActivity = (typeof WORLD_MEMBER_ACTIVITIES)[number];

/**
 * How a persistent station reads on the floor, in priority order:
 * occupied, then changeover, then queued, then approaching, then available.
 */
export const WORLD_STATION_OCCUPANCIES = Object.freeze([
  'available',
  'approaching',
  'queued',
  'occupied',
  'changeover',
] as const);
export type WorldStationOccupancy = (typeof WORLD_STATION_OCCUPANCIES)[number];

/** Interpolated tile position. Fractional while a step is in flight. */
export interface WorldTilePoint {
  readonly x: number;
  readonly y: number;
}

/** One persistent member as the renderer should understand them this instant. */
export interface WorldMemberView {
  readonly index: number;
  readonly activity: WorldMemberActivity;
  readonly tile: WorldTilePoint;
  readonly target: FloorStationRef | null;
  /** Index into the target station's `queueCells` while waiting on it, else null. */
  readonly queueSlot: number | null;
}

/** One persistent station as the renderer should understand it this instant. */
export interface WorldStationView {
  readonly ref: FloorStationRef;
  readonly occupancy: WorldStationOccupancy;
  readonly usingCount: number;
  readonly queueLength: number;
  readonly approachingCount: number;
  readonly changeoverSeats: number;
  readonly occupiedQueueCells: readonly WorldTilePoint[];
}

/** One frame of the living gym world, derived from sim truth. */
export interface WorldFrame {
  readonly tick: number;
  readonly members: readonly WorldMemberView[];
  readonly stations: readonly WorldStationView[];
}

function refsMatch(left: FloorStationRef, right: FloorStationRef): boolean {
  return floorStationRefKey(left) === floorStationRefKey(right);
}

function cellsMatch(left: WorldTilePoint, right: WorldTilePoint): boolean {
  return left.x === right.x && left.y === right.y;
}

/**
 * Where a member stands this instant, in tiles. Linear interpolation between
 * `cell` and `next` by `progress` — the contract `floorSim.ts` documents and
 * the renderer must not re-derive.
 */
export function memberWorldPoint(member: FloorSimMember): WorldTilePoint {
  if (member.next === null) {
    return Object.freeze({ x: member.cell.x, y: member.cell.y });
  }
  return Object.freeze({
    x: member.cell.x + (member.next.x - member.cell.x) * member.progress,
    y: member.cell.y + (member.next.y - member.cell.y) * member.progress,
  });
}

/**
 * World activity for one member. Stranded wins because a sealed pocket still
 * walks, and "still moving" would otherwise hide the operational problem.
 */
export function memberWorldActivity(member: FloorSimMember): WorldMemberActivity {
  if (member.strandedAt !== null) return 'stranded';
  if (member.state === 'interrupted') return 'interrupted';
  if (member.state === 'using') return 'using';
  if (member.state === 'queuing') return 'waiting';
  if (member.state === 'leaving') return 'leaving';
  return 'walking';
}

function queueSlotOf(member: FloorSimMember, station: FloorStation): number | null {
  if (member.target === null || !refsMatch(member.target, station.ref)) return null;
  if (member.state !== 'queuing') return null;
  for (let index = 0; index < station.queueCells.length; index += 1) {
    const cell = station.queueCells[index];
    if (cell !== undefined && cellsMatch(member.cell, cell)) return index;
  }
  return null;
}

function countsForStation(
  members: readonly FloorSimMember[],
  ref: FloorStationRef,
): { usingCount: number; queueLength: number; approachingCount: number } {
  let usingCount = 0;
  let queueLength = 0;
  let approachingCount = 0;
  for (let index = 0; index < members.length; index += 1) {
    const member = members[index];
    if (member === undefined || member.target === null) continue;
    if (!refsMatch(member.target, ref)) continue;
    if (member.state === 'using') usingCount += 1;
    else if (member.state === 'queuing') queueLength += 1;
    else if (member.state === 'seeking') approachingCount += 1;
  }
  return { usingCount, queueLength, approachingCount };
}

function occupancyOf(
  usingCount: number,
  changeoverSeats: number,
  queueLength: number,
  approachingCount: number,
): WorldStationOccupancy {
  if (usingCount > 0) return 'occupied';
  if (changeoverSeats > 0) return 'changeover';
  if (queueLength > 0) return 'queued';
  if (approachingCount > 0) return 'approaching';
  return 'available';
}

function occupiedQueueCellsOf(
  members: readonly FloorSimMember[],
  station: FloorStation,
): readonly WorldTilePoint[] {
  const occupied: WorldTilePoint[] = [];
  for (let index = 0; index < station.queueCells.length; index += 1) {
    const cell = station.queueCells[index];
    if (cell === undefined) continue;
    let taken = false;
    for (let memberIndex = 0; memberIndex < members.length; memberIndex += 1) {
      const member = members[memberIndex];
      if (member === undefined) continue;
      if (member.state !== 'queuing') continue;
      if (member.target === null || !refsMatch(member.target, station.ref)) continue;
      if (!cellsMatch(member.cell, cell)) continue;
      taken = true;
      break;
    }
    if (taken) occupied.push(Object.freeze({ x: cell.x, y: cell.y }));
  }
  return Object.freeze(occupied);
}

function changeoverSeatCount(
  changeovers: Readonly<Record<string, number>>,
  station: FloorStation,
): number {
  let count = 0;
  for (let index = 0; index < station.useCells.length; index += 1) {
    const cell = station.useCells[index];
    if (cell === undefined) continue;
    if (seatChangeoverTicks(changeovers, station.ref, cell) > 0) count += 1;
  }
  return count;
}

/** One station's world occupancy, derived from current members and changeovers. */
export function worldStationView(
  station: FloorStation,
  members: readonly FloorSimMember[],
  changeovers: Readonly<Record<string, number>>,
): WorldStationView {
  const counts = countsForStation(members, station.ref);
  const changeoverSeats = changeoverSeatCount(changeovers, station);
  return Object.freeze({
    ref: station.ref,
    occupancy: occupancyOf(
      counts.usingCount,
      changeoverSeats,
      counts.queueLength,
      counts.approachingCount,
    ),
    usingCount: counts.usingCount,
    queueLength: counts.queueLength,
    approachingCount: counts.approachingCount,
    changeoverSeats,
    occupiedQueueCells: occupiedQueueCellsOf(members, station),
  });
}

/** One member's world view. `stations` supplies queue-slot identity only. */
export function worldMemberView(
  member: FloorSimMember,
  stations: readonly FloorStation[],
): WorldMemberView {
  let queueSlot: number | null = null;
  if (member.target !== null) {
    for (let index = 0; index < stations.length; index += 1) {
      const station = stations[index];
      if (station === undefined) continue;
      if (!refsMatch(member.target, station.ref)) continue;
      queueSlot = queueSlotOf(member, station);
      break;
    }
  }
  return Object.freeze({
    index: member.index,
    activity: memberWorldActivity(member),
    tile: memberWorldPoint(member),
    target: member.target,
    queueSlot,
  });
}

/**
 * The living-world frame for this sim tick. Renderer input, not gameplay
 * state — `FloorGrid.tsx` draws it and writes nothing back.
 */
export function worldFrame(
  state: FloorSimState,
  stations: readonly FloorStation[],
): WorldFrame {
  const members: WorldMemberView[] = [];
  for (let index = 0; index < state.members.length; index += 1) {
    const member = state.members[index];
    if (member === undefined) continue;
    members.push(worldMemberView(member, stations));
  }
  const worldStations: WorldStationView[] = [];
  for (let index = 0; index < stations.length; index += 1) {
    const station = stations[index];
    if (station === undefined) continue;
    worldStations.push(worldStationView(station, state.members, state.changeovers));
  }
  return Object.freeze({
    tick: state.tick,
    members: Object.freeze(members),
    stations: Object.freeze(worldStations),
  });
}
