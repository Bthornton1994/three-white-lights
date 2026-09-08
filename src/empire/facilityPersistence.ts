/**
 * facilityPersistence.ts — Session B facility save/load, first wired slice.
 *
 * Pure module: zero React, zero I/O, no clock, no randomness. This file does
 * not name `localStorage`, `window`, `document`, or `process`. Bytes leave
 * as a string. Tests (and later a host) supply the durable medium by writing
 * those bytes through a `FacilitySaveStore` they own.
 *
 * WHAT THIS MODULE IS. `persistableFacilityTruth` is the serialization
 * shape. This file is the application persistence boundary around it:
 * a versioned envelope, deterministic encode, fail-closed decode, restore
 * of durable facility truth into `GymViewState` / `presentationWorld`.
 *
 * WHAT THIS MODULE DELIBERATELY DOES NOT DO.
 *   - It does not persist FloorSim pose, queues, timers, or changeovers.
 *     Those are TRANSIENT. A load creates a fresh sim from restored truth.
 *   - It does not expand `PersistableFacilityTruth`. Missing durable facts
 *     (manager, condition, strikes, visit history, clock, week plan) are
 *     gaps, not silent new fields.
 *   - It does not re-run purchases. Restore writes the saved capability
 *     and purse. A second Capacity buy after load is `already-upgraded`.
 *   - It does not touch FloorGrid / GymScreen / AppShell / progression.ts.
 *
 * FIELD CLASSIFICATION (this slice's envelope):
 *
 *   DURABLE FACILITY TRUTH — `PersistableFacilityTruth` keys:
 *     rung, gymBucks, acceleratedGymBucks, sessionEquipment,
 *     ladderEquipment, placements, furniture, capability,
 *     identityNonce, memberCount.
 *
 *   DERIVED ON LOAD — stations, seats, occupancy, GymMemberId strings,
 *     displayName, Q/C/T readout, grid size, fresh FloorSimState.
 *
 *   TRANSIENT SIMULATION STATE — FloorSim members/queues/timers/tick,
 *     lastAccrual / lastRefusal / lastManagementReport, Play/Build surface.
 *
 *   NOT IN THIS ENVELOPE (remaining gaps): manager, condition, strikes,
 *     collectedAt, week allocation, living-member visit history.
 */

import { refuseWith } from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';
import {
  requireFloorState,
  type FloorState,
  type GridPosition,
} from './floor';
import {
  createFloorSimState,
  type FloorSimContext,
} from './floorSim';
import {
  requireLadderState,
  type LadderEquipmentItem,
  type LadderRung,
} from './ladder';
import {
  createGymViewState,
  type GymViewState,
} from './ladderView';
import {
  createLivingMemberRoster,
  floorSimPopulationFromRoster,
  type LivingMemberRoster,
} from './livingMembers';
import { createManagedGym, withUpdatedGym, type ManagedGym } from './management';
import {
  persistableFacilityTruth,
  presentationWorld,
  type PersistableFacilityTruth,
  type PresentationWorldInput,
} from './presentationState';
import {
  requireGymState,
  type SessionEquipmentItem,
} from './sessions';
import {
  isStationUpgradeSlice,
  stationLevels,
  type StationAxisLevels,
  type StationCapabilityState,
} from './stationCapability';
import { COMPETITION_BENCH_BAY } from './trainingStation';

export const FACILITY_SAVE_KIND = 'gym-empire-facility' as const;
export const FACILITY_SAVE_SCHEMA_VERSION = 1 as const;

/** Keys of `PersistableFacilityTruth`. A new durable field must join this list. */
export const DURABLE_FACILITY_TRUTH_FIELDS = Object.freeze([
  'rung',
  'gymBucks',
  'acceleratedGymBucks',
  'sessionEquipment',
  'ladderEquipment',
  'placements',
  'furniture',
  'capability',
  'identityNonce',
  'memberCount',
] as const);

export type DurableFacilityTruthField = (typeof DURABLE_FACILITY_TRUTH_FIELDS)[number];

export interface FacilitySaveEnvelope {
  readonly kind: typeof FACILITY_SAVE_KIND;
  readonly schemaVersion: typeof FACILITY_SAVE_SCHEMA_VERSION;
  readonly truth: PersistableFacilityTruth;
}

/**
 * Host-supplied durable medium. The empire directory never chooses the
 * backing store. A file, a test Map, or a later shell adapter all fit.
 */
export interface FacilitySaveStore {
  readonly read: () => string | null;
  readonly write: (bytes: string) => void;
}

export type FacilityLoadRefuseReason =
  | 'corrupt-json'
  | 'unknown-kind'
  | 'unsupported-version'
  | 'incoherent';

export type FacilityLoadResult =
  | { readonly kind: 'loaded'; readonly envelope: FacilitySaveEnvelope }
  | { readonly kind: 'empty' }
  | { readonly kind: 'refused'; readonly reason: FacilityLoadRefuseReason };

/** Durable pieces a load reconstructs. FloorSim is not among them. */
export interface RestoredFacility {
  readonly floor: FloorState;
  readonly managed: ManagedGym;
  readonly capability: StationCapabilityState;
  readonly roster: LivingMemberRoster;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isLadderRung(value: unknown): value is LadderRung {
  return (
    typeof value === 'string' &&
    (EMPIRE_TUNING.LADDER_RUNGS as readonly string[]).includes(value)
  );
}

function isSessionItem(value: unknown): value is SessionEquipmentItem {
  return (
    typeof value === 'string' &&
    (EMPIRE_TUNING.SESSION_EQUIPMENT_ITEMS as readonly string[]).includes(value)
  );
}

function isLadderItem(value: unknown): value is LadderEquipmentItem {
  return (
    typeof value === 'string' &&
    (EMPIRE_TUNING.LADDER_EQUIPMENT_ITEMS as readonly string[]).includes(value)
  );
}

function isWholeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function freezeCell(cell: GridPosition): GridPosition {
  return Object.freeze({ x: cell.x, y: cell.y });
}

function sortedKeys(record: Readonly<Record<string, unknown>>): readonly string[] {
  return Object.freeze([...Object.keys(record)].sort());
}

function freezePositionMap<K extends string>(
  record: Readonly<Partial<Record<K, GridPosition>>>,
): Readonly<Partial<Record<K, GridPosition>>> {
  const next: Partial<Record<K, GridPosition>> = {};
  const keys = sortedKeys(record as Readonly<Record<string, unknown>>);
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if (key === undefined) continue;
    const cell = record[key as K];
    if (cell === undefined) continue;
    next[key as K] = freezeCell(cell);
  }
  return Object.freeze(next);
}

function freezeCapability(capability: StationCapabilityState): StationCapabilityState {
  const next: Partial<Record<string, StationAxisLevels>> = {};
  const keys = sortedKeys(capability as Readonly<Record<string, unknown>>);
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if (key === undefined) continue;
    const levels = capability[key as keyof StationCapabilityState];
    if (levels === undefined) continue;
    next[key] = Object.freeze({
      quality: levels.quality,
      capacity: levels.capacity,
      throughput: levels.throughput,
    });
  }
  return Object.freeze(next) as StationCapabilityState;
}

function canonicalTruth(truth: PersistableFacilityTruth): PersistableFacilityTruth {
  return Object.freeze({
    rung: truth.rung,
    gymBucks: truth.gymBucks,
    acceleratedGymBucks: truth.acceleratedGymBucks,
    sessionEquipment: Object.freeze([...truth.sessionEquipment]),
    ladderEquipment: Object.freeze([...truth.ladderEquipment]),
    placements: freezePositionMap(truth.placements),
    furniture: freezePositionMap(truth.furniture),
    capability: freezeCapability(truth.capability),
    identityNonce: truth.identityNonce,
    memberCount: truth.memberCount,
  });
}

function readCell(value: unknown): GridPosition | null {
  if (!isRecord(value)) return null;
  if (!isWholeNumber(value.x) || !isWholeNumber(value.y)) return null;
  if (value.x < 0 || value.y < 0) return null;
  return freezeCell({ x: value.x, y: value.y });
}

function readSessionPlacements(
  value: unknown,
): Readonly<Partial<Record<SessionEquipmentItem, GridPosition>>> | null {
  if (!isRecord(value)) return null;
  const next: Partial<Record<SessionEquipmentItem, GridPosition>> = {};
  const keys = Object.keys(value);
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if (key === undefined) continue;
    if (!isSessionItem(key)) return null;
    const cell = readCell(value[key]);
    if (cell === null) return null;
    next[key] = cell;
  }
  return freezePositionMap(next);
}

function readFurnitureMap(
  value: unknown,
): Readonly<Partial<Record<LadderEquipmentItem, GridPosition>>> | null {
  if (!isRecord(value)) return null;
  const next: Partial<Record<LadderEquipmentItem, GridPosition>> = {};
  const keys = Object.keys(value);
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if (key === undefined) continue;
    if (!isLadderItem(key)) return null;
    const cell = readCell(value[key]);
    if (cell === null) return null;
    next[key] = cell;
  }
  return freezePositionMap(next);
}

function readAxisLevel(value: unknown): number | null {
  if (!isWholeNumber(value)) return null;
  if (value < 0 || value > EMPIRE_TUNING.STATION_UPGRADE_LEVEL_MAX) return null;
  return value;
}

function readCapability(value: unknown): StationCapabilityState | null {
  if (!isRecord(value)) return null;
  const next: Partial<Record<string, StationAxisLevels>> = {};
  const keys = Object.keys(value);
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if (key === undefined) continue;
    if (!isStationUpgradeSlice(key)) return null;
    const row = value[key];
    if (!isRecord(row)) return null;
    const quality = readAxisLevel(row.quality);
    const capacity = readAxisLevel(row.capacity);
    const throughput = readAxisLevel(row.throughput);
    if (quality === null || capacity === null || throughput === null) return null;
    const fields = Object.keys(row);
    for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex += 1) {
      const field = fields[fieldIndex];
      if (field === undefined) continue;
      if (field !== 'quality' && field !== 'capacity' && field !== 'throughput') return null;
    }
    next[key] = Object.freeze({ quality, capacity, throughput });
  }
  return freezeCapability(next as StationCapabilityState);
}

function readSessionEquipment(value: unknown): readonly SessionEquipmentItem[] | null {
  if (!Array.isArray(value)) return null;
  const items: SessionEquipmentItem[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (!isSessionItem(item)) return null;
    if (seen.has(item)) return null;
    seen.add(item);
    items.push(item);
  }
  return Object.freeze(items);
}

function readLadderEquipment(value: unknown): readonly LadderEquipmentItem[] | null {
  if (!Array.isArray(value)) return null;
  const items: LadderEquipmentItem[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (!isLadderItem(item)) return null;
    if (seen.has(item)) return null;
    seen.add(item);
    items.push(item);
  }
  return Object.freeze(items);
}

function readTruth(value: unknown): PersistableFacilityTruth | null {
  if (!isRecord(value)) return null;
  if (!isLadderRung(value.rung)) return null;
  if (!isNonNegativeNumber(value.gymBucks)) return null;
  if (!isNonNegativeNumber(value.acceleratedGymBucks)) return null;
  const sessionEquipment = readSessionEquipment(value.sessionEquipment);
  const ladderEquipment = readLadderEquipment(value.ladderEquipment);
  if (sessionEquipment === null || ladderEquipment === null) return null;
  for (let index = 0; index < EMPIRE_TUNING.LADDER_STARTING_EQUIPMENT.length; index += 1) {
    const item = EMPIRE_TUNING.LADDER_STARTING_EQUIPMENT[index];
    if (item === undefined) continue;
    if (!ladderEquipment.includes(item)) return null;
  }
  const placements = readSessionPlacements(value.placements);
  const furniture = readFurnitureMap(value.furniture);
  if (placements === null || furniture === null) return null;
  const capability = readCapability(value.capability);
  if (capability === null) return null;
  if (!isWholeNumber(value.identityNonce) || value.identityNonce < 0) return null;
  if (!isWholeNumber(value.memberCount) || value.memberCount < 0) return null;
  const keys = Object.keys(value);
  if (keys.length !== DURABLE_FACILITY_TRUTH_FIELDS.length) return null;
  for (let index = 0; index < DURABLE_FACILITY_TRUTH_FIELDS.length; index += 1) {
    const field = DURABLE_FACILITY_TRUTH_FIELDS[index];
    if (field === undefined) continue;
    if (!keys.includes(field)) return null;
  }
  return canonicalTruth(
    Object.freeze({
      rung: value.rung,
      gymBucks: value.gymBucks,
      acceleratedGymBucks: value.acceleratedGymBucks,
      sessionEquipment,
      ladderEquipment,
      placements,
      furniture,
      capability,
      identityNonce: value.identityNonce,
      memberCount: value.memberCount,
    }),
  );
}

/** Deterministic JSON for the v1 envelope. Same truth, same bytes. */
export function encodeFacilitySave(truth: PersistableFacilityTruth): string {
  const envelope: FacilitySaveEnvelope = Object.freeze({
    kind: FACILITY_SAVE_KIND,
    schemaVersion: FACILITY_SAVE_SCHEMA_VERSION,
    truth: canonicalTruth(truth),
  });
  return JSON.stringify(envelope);
}

/** Fail closed. Never silently reinterpret unknown bytes. */
export function decodeFacilitySave(bytes: string): FacilityLoadResult {
  if (bytes.length === 0) {
    return Object.freeze({ kind: 'empty' });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes) as unknown;
  } catch {
    return Object.freeze({ kind: 'refused', reason: 'corrupt-json' });
  }
  if (!isRecord(parsed)) {
    return Object.freeze({ kind: 'refused', reason: 'corrupt-json' });
  }
  if (parsed.kind !== FACILITY_SAVE_KIND) {
    return Object.freeze({ kind: 'refused', reason: 'unknown-kind' });
  }
  if (parsed.schemaVersion !== FACILITY_SAVE_SCHEMA_VERSION) {
    return Object.freeze({ kind: 'refused', reason: 'unsupported-version' });
  }
  const truth = readTruth(parsed.truth);
  if (truth === null) {
    return Object.freeze({ kind: 'refused', reason: 'incoherent' });
  }
  try {
    restoreDurableFacility(truth);
  } catch {
    return Object.freeze({ kind: 'refused', reason: 'incoherent' });
  }
  return Object.freeze({
    kind: 'loaded',
    envelope: Object.freeze({
      kind: FACILITY_SAVE_KIND,
      schemaVersion: FACILITY_SAVE_SCHEMA_VERSION,
      truth,
    }),
  });
}

/** Empty bytes are empty, not a silent new gym. Hosts pass `store.read()`. */
export function loadFacilitySave(bytes: string | null): FacilityLoadResult {
  if (bytes === null || bytes.length === 0) {
    return Object.freeze({ kind: 'empty' });
  }
  return decodeFacilitySave(bytes);
}

/**
 * Rebuild floor + managed gym + capability + roster from durable truth.
 * Does not call `upgradeStation` or any buy path.
 */
export function restoreDurableFacility(truth: PersistableFacilityTruth): RestoredFacility {
  const ladder = requireLadderState(
    Object.freeze({
      rung: truth.rung,
      gymBucks: truth.gymBucks,
      equipment: truth.ladderEquipment,
      collectedAt: 0,
    }),
  );
  const gym = requireGymState(
    Object.freeze({
      ladder,
      acceleratedGymBucks: truth.acceleratedGymBucks,
      sessionEquipment: truth.sessionEquipment,
    }),
  );
  const managed = withUpdatedGym(createManagedGym(), gym);
  const floor = requireFloorState(
    Object.freeze({
      rung: truth.rung,
      placements: freezePositionMap(truth.placements),
      furniture: freezePositionMap(truth.furniture),
    }),
    truth.sessionEquipment,
  );
  const roster = createLivingMemberRoster(
    truth.rung,
    truth.ladderEquipment,
    truth.sessionEquipment,
    0,
    truth.identityNonce,
  );
  if (roster.members.length !== truth.memberCount) {
    refuseWith(
      `facility save memberCount ${truth.memberCount} does not match restored roster ${roster.members.length}`,
    );
  }
  if (roster.identityNonce !== truth.identityNonce) {
    refuseWith('facility save identity nonce did not survive restore');
  }
  const capability = freezeCapability(truth.capability);
  return Object.freeze({ floor, managed, capability, roster });
}

function simContextOf(restored: RestoredFacility): FloorSimContext {
  return Object.freeze({
    rung: restored.floor.rung,
    floor: restored.floor,
    barbellOwned: restored.managed.gym.ladder.equipment,
    sessionOwned: restored.managed.gym.sessionEquipment,
    capability: restored.capability,
    livingPopulation: floorSimPopulationFromRoster(restored.roster),
  });
}

/** Fresh sim from restored truth. Pose is not a save field. */
export function presentationInputFromRestored(
  restored: RestoredFacility,
): PresentationWorldInput {
  const context = simContextOf(restored);
  const sim = createFloorSimState(context, EMPIRE_TUNING.FLOOR_SIM_RENDER_SEED);
  return Object.freeze({
    sim,
    floor: restored.floor,
    roster: restored.roster,
    managed: restored.managed,
    capability: restored.capability,
  });
}

export function restoreGymViewState(truth: PersistableFacilityTruth): GymViewState {
  const restored = restoreDurableFacility(truth);
  const opening = createGymViewState();
  return Object.freeze({
    ...opening,
    managed: restored.managed,
    floor: restored.floor,
    capability: restored.capability,
    livingMembers: restored.roster,
  });
}

export function persistableTruthFromGymView(state: GymViewState): PersistableFacilityTruth {
  const input = presentationInputFromRestored(
    Object.freeze({
      floor: state.floor,
      managed: state.managed,
      capability: state.capability,
      roster: state.livingMembers,
    }),
  );
  return persistableFacilityTruth(input);
}

export function bayAxisLevels(capability: StationCapabilityState): StationAxisLevels {
  return stationLevels(capability, COMPETITION_BENCH_BAY);
}

export function restoredPresentationWorld(truth: PersistableFacilityTruth) {
  return presentationWorld(presentationInputFromRestored(restoreDurableFacility(truth)));
}
