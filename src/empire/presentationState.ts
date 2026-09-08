/**
 * presentationState.ts — Session B presentation-state contract.
 *
 * Pure module (CLAUDE.md, "Pure logic is separate from UI"): zero React, zero
 * side effects, zero I/O, no clock, no randomness, no pixels. This file is the
 * renderer-independent world snapshot Claude Code reads. It does not draw.
 * FloorGrid.tsx and GymScreen.tsx remain the visual owners.
 *
 * WHY THIS FILE EXISTS. floorSim.ts already walks, queues, uses, and leaves.
 * livingMembers.ts already holds stable GymMemberId values. floor.ts already
 * places and moves SKU-keyed equipment. worldView.ts already names occupancy
 * for FloorGrid. This file is the single public contract Claude reads.
 * Queue order comes from `floorSim.claimantsOf` — not a second formula.
 *
 * WHAT THIS MODULE IS. A pure read of sim + floor + roster + managed gym +
 * capability. Stations are derived internally from that same bundle via
 * `floorStations`. GymState gains no field. FloorSimState is not stored here.
 * Interpolation, easing, gait, sprites, lighting, and camera stay out.
 *
 * WHAT THIS MODULE DELIBERATELY DOES NOT DO.
 *   - It does not invent equipment instance UUIDs. Ownership is one-of-each
 *     SKU (`already-owned`); the SKU is the entity id.
 *   - It does not invent staff AI or a floor location for the hired manager.
 *   - It does not lift FloorSimState onto GymViewState. The live tick still
 *     lives where the renderer steps it; this contract snapshots that tick.
 *   - It does not write localStorage. PersistableFacilityTruth is a
 *     serialization-shape candidate, not wired save/load.
 *   - It does not put animation clip names, sprite ids, glows, or camera
 *     shake into simulation state.
 *   - It does not re-encode queue fairness. `claimantsOf` in floorSim.ts is
 *     the only service-order implementation.
 *   - It does not copy queue-cell geometry. `worldView.occupiedQueueCells`
 *     remains the FloorGrid occupancy convenience. Service order is queueIds.
 */

import { refuseWith } from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';
import {
  floorFurnitureLayout,
  floorGridSize,
  floorLayout,
  furnitureItemFootprint,
  sessionItemFootprint,
  unplacedOwnedFloorItems,
  unplacedOwnedFurnitureItems,
  type FloorState,
  type GridPosition,
  type GridSize,
} from './floor';
import {
  claimantsOf,
  floorStationRefKey,
  floorStations,
  seatChangeoverTicks,
  type FloorSimContext,
  type FloorSimInterruption,
  type FloorSimMember,
  type FloorSimMemberState,
  type FloorSimState,
  type FloorStation,
  type FloorStationRef,
} from './floorSim';
import { type LadderEquipmentItem, type LadderRung } from './ladder';
import { livingMemberExperience, type LivingMemberExperienceStatus } from './livingMemberExperience';
import {
  floorSimPopulationFromRoster,
  livingMemberAtIndex,
  memberIdForIndex,
  type GymMemberId,
  type LivingMemberRoster,
} from './livingMembers';
import {
  itemCondition,
  meanCondition,
  type ManagedEquipmentItem,
  type ManagedGym,
  type ManagerTier,
} from './management';
import { type MemberType } from './members';
import { type SessionEquipmentItem } from './sessions';
import { stationLevels, type StationCapabilityState } from './stationCapability';
import { COMPETITION_BENCH_BAY } from './trainingStation';
import { worldStationView, type WorldStationOccupancy } from './worldView';

/** Wall-clock milliseconds between FloorGrid sim ticks. Renderer cadence, not a sim input. */
export function presentationTickIntervalMs(): number {
  return EMPIRE_TUNING.FLOOR_SIM_TICK_INTERVAL_MS;
}

/** Sim progress toward `next` added each tick. Cell commits when progress reaches 1. */
export function presentationStepProgressPerTick(): number {
  return EMPIRE_TUNING.FLOOR_SIM_STEP_PROGRESS_PER_TICK;
}

/**
 * Inputs the contract reads. Stations are not a caller-supplied array;
 * they are derived from this floor + capability + ownership bundle.
 * Rung, roster-size, and member-id mismatches are refused. Sim may be stale.
 */
export interface PresentationWorldInput {
  readonly sim: FloorSimState;
  readonly floor: FloorState;
  readonly roster: LivingMemberRoster;
  readonly managed: ManagedGym;
  readonly capability: StationCapabilityState;
}

/** Discrete grid cell. Claude interpolates between `cell` and `next` using `progress`. */
export interface PresentationCell {
  readonly x: number;
  readonly y: number;
}

/**
 * One living member. `id` is GymMemberId from the roster, not the sim index.
 * `lifecycle` is the actual floor-sim alphabet — not invented travel names.
 */
export interface PresentationMember {
  readonly id: GymMemberId;
  readonly type: MemberType;
  readonly lifecycle: FloorSimMemberState;
  readonly stranded: boolean;
  readonly cell: PresentationCell;
  readonly next: PresentationCell | null;
  readonly progress: number;
  readonly target: FloorStationRef | null;
  readonly queueRank: number | null;
  readonly waitTicks: number | null;
  readonly timer: number;
  readonly interruptedBy: FloorSimInterruption | null;
  readonly experienceStatus: LivingMemberExperienceStatus;
  readonly experienceWait: number | null;
  readonly experienceTraining: number | null;
  readonly experienceComposite: number | null;
}

/**
 * One realised seat. Capacity 2 is two of these on one bay, not two bays.
 * `usingId` is who occupies this cell; a lifecycle-using member may briefly
 * sit on no seat during a live Capacity rebuild (ghost-reserve).
 * `changeoverTicks` is remaining plate-change on this cell, else 0.
 */
export interface PresentationSeat {
  readonly cell: PresentationCell;
  readonly usingId: GymMemberId | null;
  readonly changeoverTicks: number;
}

/** One derived station. Identity is FloorStationRef (SKU-kind), not array order. */
export interface PresentationStation {
  readonly ref: FloorStationRef;
  readonly position: PresentationCell;
  readonly footprint: GridSize;
  readonly capacity: number;
  readonly occupancy: WorldStationOccupancy;
  readonly usingIds: readonly GymMemberId[];
  readonly queueIds: readonly GymMemberId[];
  readonly approachingIds: readonly GymMemberId[];
  readonly changeoverSeats: number;
  readonly seats: readonly PresentationSeat[];
}

/** One owned SKU. Presence in `item` is identity; at most one of each exists. */
export interface PresentationEquipment {
  readonly item: LadderEquipmentItem | SessionEquipmentItem;
  readonly kind: 'furniture' | 'session';
  readonly placed: boolean;
  readonly position: PresentationCell | null;
  readonly footprint: GridSize;
  readonly condition: number;
}

/** Hired manager, gym-wide. No floor cell and no station assignment in this build. */
export interface PresentationStaff {
  readonly hired: boolean;
  readonly tier: ManagerTier | null;
  readonly hiredUnderWarning: boolean;
}

/** Instantaneous operational and economy facts. Not a horizon report. */
export interface PresentationBusiness {
  readonly gymBucks: number;
  readonly acceleratedGymBucks: number;
  readonly usingCount: number;
  readonly queueCount: number;
  readonly approachingCount: number;
  readonly capacitySeats: number;
  readonly bayQuality: number;
  readonly bayCapacity: number;
  readonly bayThroughput: number;
  readonly meanCondition: number;
}

export interface PresentationFacility {
  readonly rung: LadderRung;
  readonly grid: GridSize;
  readonly tick: number;
  readonly seed: number;
}

/** One renderer-independent world frame. Claude draws this; Grok writes the sim. */
export interface PresentationWorld {
  readonly facility: PresentationFacility;
  readonly members: readonly PresentationMember[];
  readonly stations: readonly PresentationStation[];
  readonly equipment: readonly PresentationEquipment[];
  readonly staff: PresentationStaff;
  readonly business: PresentationBusiness;
}

/**
 * In-process serialization-shape candidate. JSON-round-trippable. Not a file
 * format, not localStorage, and not wired save/load — empire modules must not
 * touch that API. PERSISTENCE remains OWNER_BLOCKED until a writer restores
 * application state from this payload.
 */
export interface PersistableFacilityTruth {
  readonly rung: LadderRung;
  readonly gymBucks: number;
  readonly acceleratedGymBucks: number;
  readonly sessionEquipment: readonly SessionEquipmentItem[];
  readonly ladderEquipment: readonly LadderEquipmentItem[];
  readonly placements: FloorState['placements'];
  readonly furniture: FloorState['furniture'];
  readonly capability: StationCapabilityState;
  readonly identityNonce: number;
  readonly memberCount: number;
}

function freezeCell(cell: GridPosition): PresentationCell {
  return Object.freeze({ x: cell.x, y: cell.y });
}

function refsMatch(left: FloorStationRef, right: FloorStationRef): boolean {
  return floorStationRefKey(left) === floorStationRefKey(right);
}

function requireMemberId(roster: LivingMemberRoster, index: number): GymMemberId {
  const id = memberIdForIndex(roster, index);
  if (id === null) {
    refuseWith(`presentation world has no living member at index ${index}`);
  }
  return id;
}

function requireCoherentSnapshot(input: PresentationWorldInput): void {
  if (input.floor.rung !== input.managed.gym.ladder.rung) {
    refuseWith('presentation world floor rung does not match managed gym rung');
  }
  if (input.roster.members.length !== input.sim.members.length) {
    refuseWith('presentation world roster size does not match sim members');
  }
  for (let index = 0; index < input.sim.members.length; index += 1) {
    const member = input.sim.members[index];
    const living = input.roster.members[index];
    if (member === undefined || living === undefined) {
      refuseWith(`presentation world has no living member at index ${index}`);
    }
    if (member.memberId !== living.id) {
      refuseWith('presentation world roster id does not match sim member');
    }
  }
}

function simContextOf(input: PresentationWorldInput): FloorSimContext {
  return Object.freeze({
    rung: input.floor.rung,
    floor: input.floor,
    barbellOwned: input.managed.gym.ladder.equipment,
    sessionOwned: input.managed.gym.sessionEquipment,
    capability: input.capability,
    livingPopulation: floorSimPopulationFromRoster(input.roster),
  });
}

function idsOf(
  members: readonly FloorSimMember[],
  roster: LivingMemberRoster,
): readonly GymMemberId[] {
  const ids: GymMemberId[] = [];
  for (let index = 0; index < members.length; index += 1) {
    const member = members[index];
    if (member === undefined) continue;
    ids.push(requireMemberId(roster, member.index));
  }
  return Object.freeze(ids);
}

function waitTicksOf(member: FloorSimMember, tick: number): number | null {
  if (member.queueArrivedAt === null) return null;
  if (member.usingStartedAt !== null) return member.usingStartedAt - member.queueArrivedAt;
  return tick - member.queueArrivedAt;
}

function queueRankOf(
  member: FloorSimMember,
  members: readonly FloorSimMember[],
): number | null {
  if (member.target === null) return null;
  if (member.state !== 'seeking' && member.state !== 'queuing') return null;
  const order = claimantsOf(members, member.target);
  for (let rank = 0; rank < order.length; rank += 1) {
    const claimant = order[rank];
    if (claimant !== undefined && claimant.index === member.index) return rank;
  }
  return null;
}

function presentationMember(
  member: FloorSimMember,
  sim: FloorSimState,
  roster: LivingMemberRoster,
): PresentationMember {
  const living = livingMemberAtIndex(roster, member.index);
  const experience = livingMemberExperience(living === null ? [] : living.recentVisits);
  const components = experience.components;
  return Object.freeze({
    id: requireMemberId(roster, member.index),
    type: member.type,
    lifecycle: member.state,
    stranded: member.strandedAt !== null,
    cell: freezeCell(member.cell),
    next: member.next === null ? null : freezeCell(member.next),
    progress: member.progress,
    target: member.target,
    queueRank: queueRankOf(member, sim.members),
    waitTicks: waitTicksOf(member, sim.tick),
    timer: member.timer,
    interruptedBy: member.interruptedBy,
    experienceStatus: experience.status,
    experienceWait: components === null ? null : components.wait,
    experienceTraining: components === null ? null : components.training,
    experienceComposite: experience.composite,
  });
}

function usingMembersOf(
  members: readonly FloorSimMember[],
  ref: FloorStationRef,
): readonly FloorSimMember[] {
  const using: FloorSimMember[] = [];
  for (let index = 0; index < members.length; index += 1) {
    const member = members[index];
    if (member === undefined) continue;
    if (member.state !== 'using') continue;
    if (member.target === null) continue;
    if (!refsMatch(member.target, ref)) continue;
    using.push(member);
  }
  return using;
}

function approachingOf(
  members: readonly FloorSimMember[],
  ref: FloorStationRef,
): readonly FloorSimMember[] {
  const approaching: FloorSimMember[] = [];
  for (let index = 0; index < members.length; index += 1) {
    const member = members[index];
    if (member === undefined) continue;
    if (member.state !== 'seeking') continue;
    if (member.target === null) continue;
    if (!refsMatch(member.target, ref)) continue;
    approaching.push(member);
  }
  return approaching;
}

function queuedOnly(
  members: readonly FloorSimMember[],
  ref: FloorStationRef,
): readonly FloorSimMember[] {
  const queued: FloorSimMember[] = [];
  const order = claimantsOf(members, ref);
  for (let index = 0; index < order.length; index += 1) {
    const member = order[index];
    if (member === undefined) continue;
    if (member.state !== 'queuing') continue;
    queued.push(member);
  }
  return queued;
}

function presentationSeats(
  station: FloorStation,
  sim: FloorSimState,
  roster: LivingMemberRoster,
): readonly PresentationSeat[] {
  const seats: PresentationSeat[] = [];
  for (let index = 0; index < station.useCells.length; index += 1) {
    const cell = station.useCells[index];
    if (cell === undefined) continue;
    let usingId: GymMemberId | null = null;
    for (let memberIndex = 0; memberIndex < sim.members.length; memberIndex += 1) {
      const member = sim.members[memberIndex];
      if (member === undefined) continue;
      if (member.state !== 'using') continue;
      if (member.target === null || !refsMatch(member.target, station.ref)) continue;
      if (member.cell.x !== cell.x || member.cell.y !== cell.y) continue;
      usingId = requireMemberId(roster, member.index);
      break;
    }
    seats.push(
      Object.freeze({
        cell: freezeCell(cell),
        usingId,
        changeoverTicks: seatChangeoverTicks(sim.changeovers, station.ref, cell),
      }),
    );
  }
  return Object.freeze(seats);
}

function presentationStation(
  station: FloorStation,
  sim: FloorSimState,
  roster: LivingMemberRoster,
): PresentationStation {
  const view = worldStationView(station, sim.members, sim.changeovers);
  return Object.freeze({
    ref: station.ref,
    position: freezeCell(station.position),
    footprint: station.footprint,
    capacity: station.useCells.length,
    occupancy: view.occupancy,
    usingIds: idsOf(usingMembersOf(sim.members, station.ref), roster),
    queueIds: idsOf(queuedOnly(sim.members, station.ref), roster),
    approachingIds: idsOf(approachingOf(sim.members, station.ref), roster),
    changeoverSeats: view.changeoverSeats,
    seats: presentationSeats(station, sim, roster),
  });
}

function furnitureRows(
  floor: FloorState,
  managed: ManagedGym,
): readonly PresentationEquipment[] {
  const owned = managed.gym.ladder.equipment;
  const placed = floorFurnitureLayout(floor, owned);
  const rows: PresentationEquipment[] = [];
  for (let index = 0; index < placed.length; index += 1) {
    const row = placed[index];
    if (row === undefined) continue;
    rows.push(
      Object.freeze({
        item: row.item,
        kind: 'furniture',
        placed: true,
        position: freezeCell(row.position),
        footprint: row.footprint,
        condition: itemCondition(managed, row.item as ManagedEquipmentItem),
      }),
    );
  }
  const tray = unplacedOwnedFurnitureItems(floor, owned);
  for (let index = 0; index < tray.length; index += 1) {
    const item = tray[index];
    if (item === undefined) continue;
    rows.push(
      Object.freeze({
        item,
        kind: 'furniture',
        placed: false,
        position: null,
        footprint: furnitureItemFootprint(item),
        condition: itemCondition(managed, item as ManagedEquipmentItem),
      }),
    );
  }
  return Object.freeze(rows);
}

function sessionRows(
  floor: FloorState,
  managed: ManagedGym,
): readonly PresentationEquipment[] {
  const owned = managed.gym.sessionEquipment;
  const placed = floorLayout(floor);
  const rows: PresentationEquipment[] = [];
  for (let index = 0; index < placed.length; index += 1) {
    const row = placed[index];
    if (row === undefined) continue;
    rows.push(
      Object.freeze({
        item: row.item,
        kind: 'session',
        placed: true,
        position: freezeCell(row.position),
        footprint: row.footprint,
        condition: itemCondition(managed, row.item as ManagedEquipmentItem),
      }),
    );
  }
  const tray = unplacedOwnedFloorItems(floor, owned);
  for (let index = 0; index < tray.length; index += 1) {
    const item = tray[index];
    if (item === undefined) continue;
    rows.push(
      Object.freeze({
        item,
        kind: 'session',
        placed: false,
        position: null,
        footprint: sessionItemFootprint(item),
        condition: itemCondition(managed, item as ManagedEquipmentItem),
      }),
    );
  }
  return Object.freeze(rows);
}

function presentationStaffOf(managed: ManagedGym): PresentationStaff {
  const manager = managed.manager;
  if (manager === null) {
    return Object.freeze({ hired: false, tier: null, hiredUnderWarning: false });
  }
  return Object.freeze({
    hired: true,
    tier: manager.tier,
    hiredUnderWarning: manager.hiredUnderWarning,
  });
}

function presentationBusinessOf(
  sim: FloorSimState,
  stations: readonly FloorStation[],
  managed: ManagedGym,
  capability: StationCapabilityState,
): PresentationBusiness {
  let usingCount = 0;
  let queueCount = 0;
  let approachingCount = 0;
  for (let index = 0; index < sim.members.length; index += 1) {
    const member = sim.members[index];
    if (member === undefined) continue;
    if (member.state === 'using') usingCount += 1;
    else if (member.state === 'queuing') queueCount += 1;
    else if (member.state === 'seeking' && member.target !== null) approachingCount += 1;
  }
  let capacitySeats = 0;
  for (let index = 0; index < stations.length; index += 1) {
    const station = stations[index];
    if (station === undefined) continue;
    capacitySeats += station.useCells.length;
  }
  const levels = stationLevels(capability, COMPETITION_BENCH_BAY);
  return Object.freeze({
    gymBucks: managed.gym.ladder.gymBucks,
    acceleratedGymBucks: managed.gym.acceleratedGymBucks,
    usingCount,
    queueCount,
    approachingCount,
    capacitySeats,
    bayQuality: levels.quality,
    bayCapacity: levels.capacity,
    bayThroughput: levels.throughput,
    meanCondition: meanCondition(managed),
  });
}

/** Snapshot Claude may read this tick. Pure. Does not step the sim. */
export function presentationWorld(input: PresentationWorldInput): PresentationWorld {
  requireCoherentSnapshot(input);
  const stations = floorStations(simContextOf(input));
  const members: PresentationMember[] = [];
  for (let index = 0; index < input.sim.members.length; index += 1) {
    const member = input.sim.members[index];
    if (member === undefined) continue;
    members.push(presentationMember(member, input.sim, input.roster));
  }
  const projected: PresentationStation[] = [];
  for (let index = 0; index < stations.length; index += 1) {
    const station = stations[index];
    if (station === undefined) continue;
    projected.push(presentationStation(station, input.sim, input.roster));
  }
  const furniture = furnitureRows(input.floor, input.managed);
  const session = sessionRows(input.floor, input.managed);
  const equipment: PresentationEquipment[] = [];
  for (let index = 0; index < furniture.length; index += 1) {
    const row = furniture[index];
    if (row !== undefined) equipment.push(row);
  }
  for (let index = 0; index < session.length; index += 1) {
    const row = session[index];
    if (row !== undefined) equipment.push(row);
  }
  return Object.freeze({
    facility: Object.freeze({
      rung: input.floor.rung,
      grid: floorGridSize(input.floor.rung),
      tick: input.sim.tick,
      seed: input.sim.seed,
    }),
    members: Object.freeze(members),
    stations: Object.freeze(projected),
    equipment: Object.freeze(equipment),
    staff: presentationStaffOf(input.managed),
    business: presentationBusinessOf(input.sim, stations, input.managed, input.capability),
  });
}

/** Serialization-shape candidate. Same SKU, same cell, same ids after JSON round-trip. Not wired save/load. */
export function persistableFacilityTruth(input: PresentationWorldInput): PersistableFacilityTruth {
  requireCoherentSnapshot(input);
  return Object.freeze({
    rung: input.floor.rung,
    gymBucks: input.managed.gym.ladder.gymBucks,
    acceleratedGymBucks: input.managed.gym.acceleratedGymBucks,
    sessionEquipment: input.managed.gym.sessionEquipment,
    ladderEquipment: input.managed.gym.ladder.equipment,
    placements: input.floor.placements,
    furniture: input.floor.furniture,
    capability: input.capability,
    identityNonce: input.roster.identityNonce,
    memberCount: input.roster.members.length,
  });
}
