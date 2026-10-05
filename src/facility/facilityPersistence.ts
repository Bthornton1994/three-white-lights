/**
 * facilityPersistence.ts — Session B facility save/load.
 *
 * Pure module: zero React, zero I/O, no clock, no randomness. This file does
 * not name `localStorage`, `window`, `document`, or `process`. Bytes leave
 * as a string. Tests (and later a host) supply the durable medium by writing
 * those bytes through a store they own. Encode/decode stay synchronous.
 *
 * WHAT THIS MODULE IS. Application persistence around a versioned envelope.
 * `PersistableFacilityTruth` remains the facility/layout subset. The v2
 * body is `FacilitySaveTruthV2`: facility plus clock, management, week, and
 * living-member history. Host wiring of those bytes is `src/shell/`, not
 * this file.
 *
 * WHAT THIS MODULE DELIBERATELY DOES NOT DO.
 *   - It does not persist FloorSim pose, queues, timers, or changeovers.
 *     Those are TRANSIENT. A load creates a fresh sim from restored truth.
 *   - It does not expand `PresentationWorld`. Save-only facts live here.
 *   - It does not re-run purchases. Restore writes saved capability, purse,
 *     condition, strikes, and week plan. Loading is not gameplay.
 *   - It does not touch FloorGrid / GymScreen / progression.ts.
 *   - Host I/O lives in `src/shell/gymHostPersistence.ts`. This file does
 *     not call a store. Date.now() stays in the host. This file persists
 *     the watermark that makes that calculation correct.
 *
 * FIELD CLASSIFICATION (authoritative GymViewState graph):
 *
 *   DURABLE — player-owned game truth that a restart must not lose:
 *     facility: rung, purses, equipment, placements, furniture, capability,
 *       identityNonce, memberCount
 *     clock: collectedAt, bankedOperationSeconds, checkInsTaken
 *     management: condition, manager, strikes, neglected, promptDismissals,
 *       recoveries
 *     week: allocation, allocationSetThisWeek, weekLog
 *     living: per-member type, joinedAtSeconds, recentVisits
 *
 *   DERIVED ON LOAD — reconstructed from durable facts:
 *     weekIndex from collectedAt; failurePhase from strikes; GymMemberId
 *     and displayName from nonce+ordinal; stations/seats/occupancy; Q/C/T
 *     readout; grid size; fresh FloorSimState
 *
 *   TRANSIENT PRESENTATION — lastAccrual, lastRefusal, lastManagementReport,
 *     Play/Build surface
 *
 *   TRANSIENT SIMULATION — FloorSim pose, queues, timers, tick, changeovers
 */

import { refuseWith } from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';
import {
  requireFloorState,
  type FloorState,
  type FloorPosition,
  type OrientedFloorPosition,
  type FloorLayoutEdit,
  type FloorEditTarget,
  orientedFloorPosition,
  isFloorRotation,
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
  deriveMemberId,
  displayNameForCreation,
  floorSimPopulationFromRoster,
  memberOrdinalFromId,
  type LivingGymMember,
  type LivingMemberRoster,
  type ServiceVisitRecord,
} from './livingMembers';
import {
  COUNTED_DECISIONS,
  createManagedGym,
  ownedItemsOf,
  requireManagedGym,
  withUpdatedGym,
  type ConditionByItem,
  type CountedDecision,
  type CountedDecisionRecord,
  type ManagedEquipmentItem,
  type ManagedGym,
  type ManagerState,
  type ManagerTier,
} from './management';
import {
  presentationWorld,
  type PersistableFacilityTruth,
  type PresentationWorldInput,
} from './presentationState';
import {
  requireGymState,
  requireWeekAllocation,
  trainingWeekIndexAt,
  type FlexibleSlot,
  type GymWeekReport,
  type SessionEquipmentItem,
  type SlotOutcome,
  type SlotRequirement,
  type WeekAllocation,
  type WeeklyAttributeEffects,
} from './sessions';
import {
  isStationUpgradeSlice,
  stationLevels,
  type StationAxisLevels,
  type StationCapabilityState,
} from './stationCapability';
import { COMPETITION_BENCH_BAY, competitionBenchBay } from './trainingStation';

export const FACILITY_SAVE_KIND = 'gym-empire-facility' as const;
export const FACILITY_SAVE_SCHEMA_VERSION = EMPIRE_TUNING.FLOOR_SAVE_SCHEMA_VERSION;

/** Keys of `PersistableFacilityTruth`. A new durable facility field must join this list. */
export const DURABLE_FACILITY_TRUTH_FIELDS = Object.freeze([
  'rung',
  'gymBucks',
  'acceleratedGymBucks',
  'sessionEquipment',
  'ladderEquipment',
  'placements',
  'furniture',
  'layoutRevision',
  'lastLayoutEdit',
  'capability',
  'identityNonce',
  'memberCount',
] as const);

const LEGACY_DURABLE_FACILITY_TRUTH_FIELDS = DURABLE_FACILITY_TRUTH_FIELDS.filter(field => field !== 'layoutRevision' && field !== 'lastLayoutEdit');
const POSITION_FIELDS = Object.freeze(['x', 'y', 'rotation'] as const);
const LEGACY_POSITION_FIELDS = Object.freeze(['x', 'y'] as const);
const LAYOUT_EDIT_FIELDS = Object.freeze(['target', 'previous', 'current', 'appliedRevision'] as const);
const LAYOUT_TARGET_FIELDS = Object.freeze(['kind', 'item'] as const);

/** Top-level domains of the versioned save body. */
export const FACILITY_SAVE_TRUTH_DOMAINS = Object.freeze([
  'facility',
  'clock',
  'management',
  'week',
  'living',
] as const);

const CLOCK_FIELDS = Object.freeze([
  'collectedAt',
  'bankedOperationSeconds',
  'checkInsTaken',
] as const);

const MANAGEMENT_FIELDS = Object.freeze([
  'condition',
  'manager',
  'strikes',
  'neglected',
  'promptDismissals',
  'recoveries',
] as const);

const WEEK_FIELDS = Object.freeze([
  'allocation',
  'allocationSetThisWeek',
  'weekLog',
] as const);

const LIVING_FIELDS = Object.freeze(['members'] as const);

const LIVING_MEMBER_FIELDS = Object.freeze([
  'ordinal',
  'type',
  'joinedAtSeconds',
  'recentVisits',
] as const);

const VISIT_FIELDS = Object.freeze([
  'stationKind',
  'stationKey',
  'queueWaitTicks',
  'trainingExperience',
  'outcome',
  'observedAtTick',
] as const);

const STRIKE_FIELDS = Object.freeze([
  'decision',
  'atSeconds',
  'shownCostGymBucks',
] as const);

const MANAGER_FIELDS = Object.freeze(['tier', 'hiredUnderWarning'] as const);

const WEEK_REPORT_FIELDS = Object.freeze([
  'weekIndex',
  'allocation',
  'slots',
  'effects',
] as const);

const EFFECT_FIELDS = Object.freeze([
  'residualCarryMultiplier',
  'injuryChanceMultiplier',
  'techniqueQualityBonus',
  'ceilingGrowthPerWeek',
] as const);

const STATION_KINDS = Object.freeze(['training', 'fixed', 'session'] as const);
const VISIT_OUTCOMES = Object.freeze(['completed', 'interrupted'] as const);
const SLOT_OUTCOME_KINDS = Object.freeze(['trained', 'rested', 'unequipped'] as const);
const RESTED_SLOT_FIELDS = Object.freeze(['kind'] as const);
const TRAINED_SLOT_FIELDS = Object.freeze(['kind', 'activity'] as const);
const UNEQUIPPED_SLOT_FIELDS = Object.freeze(['kind', 'activity', 'requires'] as const);

const ENVELOPE_FIELDS = Object.freeze(['kind', 'schemaVersion', 'truth'] as const);

export type DurableFacilityTruthField = (typeof DURABLE_FACILITY_TRUTH_FIELDS)[number];
export type FacilitySaveTruthDomain = (typeof FACILITY_SAVE_TRUTH_DOMAINS)[number];

export interface PersistableLivingMember {
  readonly ordinal: number;
  readonly type: LivingGymMember['type'];
  readonly joinedAtSeconds: number;
  readonly recentVisits: readonly ServiceVisitRecord[];
}

export interface FacilitySaveTruthV2 {
  readonly facility: PersistableFacilityTruth;
  readonly clock: {
    readonly collectedAt: number;
    readonly bankedOperationSeconds: number;
    readonly checkInsTaken: number;
  };
  readonly management: {
    readonly condition: ConditionByItem;
    readonly manager: ManagerState | null;
    readonly strikes: readonly CountedDecisionRecord[];
    readonly neglected: readonly ManagedEquipmentItem[];
    readonly promptDismissals: number;
    readonly recoveries: number;
  };
  readonly week: {
    readonly allocation: WeekAllocation;
    readonly allocationSetThisWeek: boolean;
    readonly weekLog: readonly GymWeekReport[];
  };
  readonly living: {
    readonly members: readonly PersistableLivingMember[];
  };
}

export type FacilitySaveTruthV1 = Omit<FacilitySaveTruthV2, 'facility'> & {
  readonly facility: Omit<PersistableFacilityTruth, 'layoutRevision' | 'lastLayoutEdit' | 'placements' | 'furniture'> & {
    readonly placements: Readonly<Partial<Record<SessionEquipmentItem, GridPosition>>>;
    readonly furniture: Readonly<Partial<Record<LadderEquipmentItem, GridPosition>>>;
  };
};

export interface FacilitySaveEnvelope {
  readonly kind: typeof FACILITY_SAVE_KIND;
  readonly schemaVersion: typeof FACILITY_SAVE_SCHEMA_VERSION;
  readonly truth: FacilitySaveTruthV2;
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
  readonly week: FacilitySaveTruthV2['week'];
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

function isManagedItem(value: unknown): value is ManagedEquipmentItem {
  return isSessionItem(value) || isLadderItem(value);
}

function isMemberType(value: unknown): value is LivingGymMember['type'] {
  return (
    typeof value === 'string' &&
    (EMPIRE_TUNING.MEMBER_TYPES as readonly string[]).includes(value)
  );
}

function isManagerTier(value: unknown): value is ManagerTier {
  return (
    typeof value === 'string' &&
    (EMPIRE_TUNING.MANAGER_TIERS as readonly string[]).includes(value)
  );
}

function isCountedDecision(value: unknown): value is CountedDecision {
  return typeof value === 'string' && (COUNTED_DECISIONS as readonly string[]).includes(value);
}

function isFlexibleSlot(value: unknown): value is FlexibleSlot {
  if (value === 'rest') return true;
  return (
    typeof value === 'string' &&
    (EMPIRE_TUNING.FLEXIBLE_ACTIVITIES as readonly string[]).includes(value)
  );
}

function isSlotRequirement(value: unknown): value is SlotRequirement {
  if (value === 'advanced-recovery') return true;
  return (
    typeof value === 'string' &&
    (EMPIRE_TUNING.SESSION_ACTIVITY_GROUPS as readonly string[]).includes(value)
  );
}

function isWholeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isNonNegativeWhole(value: unknown): value is number {
  return isWholeNumber(value) && value >= 0;
}

function isUnitInterval(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function exactKeys(value: Record<string, unknown>, fields: readonly string[]): boolean {
  const keys = Object.keys(value);
  if (keys.length !== fields.length) return false;
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    if (field === undefined) continue;
    if (!keys.includes(field)) return false;
  }
  return true;
}

function freezeCell(cell: FloorPosition): OrientedFloorPosition {
  return orientedFloorPosition(cell);
}

function sortedKeys(record: Readonly<Record<string, unknown>>): readonly string[] {
  return Object.freeze([...Object.keys(record)].sort());
}

function freezePositionMap<K extends string>(
  record: Readonly<Partial<Record<K, FloorPosition>>>,
): Readonly<Partial<Record<K, FloorPosition>>> {
  const next: Partial<Record<K, FloorPosition>> = {};
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

function freezeCondition(condition: ConditionByItem): ConditionByItem {
  const next: Partial<Record<ManagedEquipmentItem, number>> = {};
  const keys = sortedKeys(condition as Readonly<Record<string, unknown>>);
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if (key === undefined) continue;
    if (!isManagedItem(key)) continue;
    const amount = condition[key];
    if (amount === undefined) continue;
    next[key] = amount;
  }
  return Object.freeze(next);
}

function canonicalLayoutEdit(edit: FloorLayoutEdit | null): FloorLayoutEdit | null {
  return edit === null ? null : Object.freeze({ target: Object.freeze({ ...edit.target }), previous: edit.previous === null ? null : freezeCell(edit.previous), current: edit.current === null ? null : freezeCell(edit.current), appliedRevision: edit.appliedRevision });
}

function canonicalFacility(truth: PersistableFacilityTruth): PersistableFacilityTruth {
  return Object.freeze({
    rung: truth.rung,
    gymBucks: truth.gymBucks,
    acceleratedGymBucks: truth.acceleratedGymBucks,
    sessionEquipment: Object.freeze([...truth.sessionEquipment]),
    ladderEquipment: Object.freeze([...truth.ladderEquipment]),
    placements: freezePositionMap(truth.placements),
    furniture: freezePositionMap(truth.furniture),
    layoutRevision: truth.layoutRevision,
    lastLayoutEdit: canonicalLayoutEdit(truth.lastLayoutEdit),
    capability: freezeCapability(truth.capability),
    identityNonce: truth.identityNonce,
    memberCount: truth.memberCount,
  });
}

function canonicalVisit(visit: ServiceVisitRecord): ServiceVisitRecord {
  return Object.freeze({
    stationKind: visit.stationKind,
    stationKey: visit.stationKey,
    queueWaitTicks: visit.queueWaitTicks,
    trainingExperience: visit.trainingExperience,
    outcome: visit.outcome,
    observedAtTick: visit.observedAtTick,
  });
}

function canonicalLivingMember(member: PersistableLivingMember): PersistableLivingMember {
  const visits: ServiceVisitRecord[] = [];
  for (let index = 0; index < member.recentVisits.length; index += 1) {
    const visit = member.recentVisits[index];
    if (visit === undefined) continue;
    visits.push(canonicalVisit(visit));
  }
  return Object.freeze({
    ordinal: member.ordinal,
    type: member.type,
    joinedAtSeconds: member.joinedAtSeconds,
    recentVisits: Object.freeze(visits),
  });
}

function canonicalStrike(record: CountedDecisionRecord): CountedDecisionRecord {
  return Object.freeze({
    decision: record.decision,
    atSeconds: record.atSeconds,
    shownCostGymBucks: record.shownCostGymBucks,
  });
}

function canonicalSlot(outcome: SlotOutcome): SlotOutcome {
  if (outcome.kind === 'trained') {
    return Object.freeze({ kind: 'trained', activity: outcome.activity });
  }
  if (outcome.kind === 'rested') {
    return Object.freeze({ kind: 'rested' });
  }
  return Object.freeze({
    kind: 'unequipped',
    activity: outcome.activity,
    requires: outcome.requires,
  });
}

function canonicalEffects(effects: WeeklyAttributeEffects): WeeklyAttributeEffects {
  return Object.freeze({
    residualCarryMultiplier: effects.residualCarryMultiplier,
    injuryChanceMultiplier: effects.injuryChanceMultiplier,
    techniqueQualityBonus: effects.techniqueQualityBonus,
    ceilingGrowthPerWeek: effects.ceilingGrowthPerWeek,
  });
}

function canonicalWeekReport(report: GymWeekReport): GymWeekReport {
  return Object.freeze({
    weekIndex: report.weekIndex,
    allocation: Object.freeze([
      report.allocation[0],
      report.allocation[1],
      report.allocation[2],
    ]) as WeekAllocation,
    slots: Object.freeze([
      canonicalSlot(report.slots[0]),
      canonicalSlot(report.slots[1]),
      canonicalSlot(report.slots[2]),
    ]) as GymWeekReport['slots'],
    effects: canonicalEffects(report.effects),
  });
}

function canonicalGymTruth(truth: FacilitySaveTruthV2): FacilitySaveTruthV2 {
  const strikes: CountedDecisionRecord[] = [];
  for (let index = 0; index < truth.management.strikes.length; index += 1) {
    const row = truth.management.strikes[index];
    if (row === undefined) continue;
    strikes.push(canonicalStrike(row));
  }
  const neglected: ManagedEquipmentItem[] = [];
  for (let index = 0; index < truth.management.neglected.length; index += 1) {
    const item = truth.management.neglected[index];
    if (item === undefined) continue;
    neglected.push(item);
  }
  const weekLog: GymWeekReport[] = [];
  for (let index = 0; index < truth.week.weekLog.length; index += 1) {
    const report = truth.week.weekLog[index];
    if (report === undefined) continue;
    weekLog.push(canonicalWeekReport(report));
  }
  const members: PersistableLivingMember[] = [];
  for (let index = 0; index < truth.living.members.length; index += 1) {
    const member = truth.living.members[index];
    if (member === undefined) continue;
    members.push(canonicalLivingMember(member));
  }
  const manager =
    truth.management.manager === null
      ? null
      : Object.freeze({
          tier: truth.management.manager.tier,
          hiredUnderWarning: truth.management.manager.hiredUnderWarning,
        });
  return Object.freeze({
    facility: canonicalFacility(truth.facility),
    clock: Object.freeze({
      collectedAt: truth.clock.collectedAt,
      bankedOperationSeconds: truth.clock.bankedOperationSeconds,
      checkInsTaken: truth.clock.checkInsTaken,
    }),
    management: Object.freeze({
      condition: freezeCondition(truth.management.condition),
      manager,
      strikes: Object.freeze(strikes),
      neglected: Object.freeze(neglected),
      promptDismissals: truth.management.promptDismissals,
      recoveries: truth.management.recoveries,
    }),
    week: Object.freeze({
      allocation: Object.freeze([
        truth.week.allocation[0],
        truth.week.allocation[1],
        truth.week.allocation[2],
      ]) as WeekAllocation,
      allocationSetThisWeek: truth.week.allocationSetThisWeek,
      weekLog: Object.freeze(weekLog),
    }),
    living: Object.freeze({
      members: Object.freeze(members),
    }),
  });
}
function readCell(value: unknown, legacy = false): OrientedFloorPosition | null {
  if (!isRecord(value) || !exactKeys(value, legacy ? LEGACY_POSITION_FIELDS : POSITION_FIELDS)) return null;
  if (!Number.isSafeInteger(value.x) || !Number.isSafeInteger(value.y) || (value.x as number) < 0 || (value.y as number) < 0) return null;
  if (!legacy && !isFloorRotation(value.rotation)) return null;
  return freezeCell({ x: value.x as number, y: value.y as number, rotation: legacy ? EMPIRE_TUNING.FLOOR_ROTATIONS[0] : value.rotation as OrientedFloorPosition['rotation'] });
}
function readLayoutEdit(value: unknown): FloorLayoutEdit | null | undefined {
  if (value === null) return null;
  if (!isRecord(value) || !exactKeys(value, LAYOUT_EDIT_FIELDS) || !isRecord(value.target) || !exactKeys(value.target, LAYOUT_TARGET_FIELDS)) return undefined;
  if (!Number.isSafeInteger(value.appliedRevision) || (value.appliedRevision as number) <= EMPIRE_TUNING.FLOOR_LAYOUT_INITIAL_REVISION) return undefined;
  let target: FloorEditTarget;
  if (value.target.kind === 'session' && isSessionItem(value.target.item)) target = { kind: 'session', item: value.target.item };
  else if (value.target.kind === 'furniture' && isLadderItem(value.target.item)) target = { kind: 'furniture', item: value.target.item };
  else return undefined;
  const previous = value.previous === null ? null : readCell(value.previous);
  const current = value.current === null ? null : readCell(value.current);
  if ((previous === null && value.previous !== null) || (current === null && value.current !== null)) return undefined;
  return canonicalLayoutEdit({ target, previous, current, appliedRevision: value.appliedRevision as number });
}

function readSessionPlacements(
  value: unknown, legacy = false,
): Readonly<Partial<Record<SessionEquipmentItem, FloorPosition>>> | null {
  if (!isRecord(value)) return null;
  const next: Partial<Record<SessionEquipmentItem, FloorPosition>> = {};
  const keys = Object.keys(value);
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if (key === undefined) continue;
    if (!isSessionItem(key)) return null;
    const cell = readCell(value[key], legacy);
    if (cell === null) return null;
    next[key] = cell;
  }
  return freezePositionMap(next);
}

function readFurnitureMap(
  value: unknown, legacy = false,
): Readonly<Partial<Record<LadderEquipmentItem, FloorPosition>>> | null {
  if (!isRecord(value)) return null;
  const next: Partial<Record<LadderEquipmentItem, FloorPosition>> = {};
  const keys = Object.keys(value);
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if (key === undefined) continue;
    if (!isLadderItem(key) || (legacy && !(EMPIRE_TUNING.LADDER_STARTING_EQUIPMENT as readonly string[]).includes(key))) return null;
    const cell = readCell(value[key], legacy);
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

function readFacility(value: unknown, legacy = false): PersistableFacilityTruth | null {
  if (!isRecord(value)) return null;
  if (!exactKeys(value, legacy ? LEGACY_DURABLE_FACILITY_TRUTH_FIELDS : DURABLE_FACILITY_TRUTH_FIELDS)) return null;
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
  const placements = readSessionPlacements(value.placements, legacy);
  const furniture = readFurnitureMap(value.furniture, legacy);
  if (placements === null || furniture === null) return null;
  const layoutRevision = legacy ? EMPIRE_TUNING.FLOOR_LAYOUT_INITIAL_REVISION : value.layoutRevision;
  if (!Number.isSafeInteger(layoutRevision) || (layoutRevision as number) < 0) return null;
  const lastLayoutEdit = legacy ? null : readLayoutEdit(value.lastLayoutEdit);
  if (lastLayoutEdit === undefined) return null;
  const capability = readCapability(value.capability);
  if (capability === null) return null;
  if (!isNonNegativeWhole(value.identityNonce)) return null;
  if (!isNonNegativeWhole(value.memberCount)) return null;
  return canonicalFacility(
    Object.freeze({
      rung: value.rung,
      gymBucks: value.gymBucks,
      acceleratedGymBucks: value.acceleratedGymBucks,
      sessionEquipment,
      ladderEquipment,
      placements,
      furniture,
      layoutRevision: layoutRevision as number,
      lastLayoutEdit,
      capability,
      identityNonce: value.identityNonce,
      memberCount: value.memberCount,
    }),
  );
}

function readClock(value: unknown): FacilitySaveTruthV2['clock'] | null {
  if (!isRecord(value)) return null;
  if (!exactKeys(value, CLOCK_FIELDS)) return null;
  if (!isNonNegativeWhole(value.collectedAt)) return null;
  if (!isNonNegativeNumber(value.bankedOperationSeconds)) return null;
  if (!isNonNegativeWhole(value.checkInsTaken)) return null;
  return Object.freeze({
    collectedAt: value.collectedAt,
    bankedOperationSeconds: value.bankedOperationSeconds,
    checkInsTaken: value.checkInsTaken,
  });
}

function readCondition(value: unknown, owned: readonly ManagedEquipmentItem[]): ConditionByItem | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value);
  if (keys.length !== owned.length) return null;
  const next: Partial<Record<ManagedEquipmentItem, number>> = {};
  for (let index = 0; index < owned.length; index += 1) {
    const item = owned[index];
    if (item === undefined) continue;
    if (!keys.includes(item)) return null;
    const amount = value[item];
    if (!isUnitInterval(amount)) return null;
    next[item] = amount;
  }
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if (key === undefined) continue;
    if (!isManagedItem(key)) return null;
  }
  return freezeCondition(next);
}

function readManager(value: unknown): ManagerState | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  if (!exactKeys(value, MANAGER_FIELDS)) return undefined;
  if (!isManagerTier(value.tier)) return undefined;
  if (typeof value.hiredUnderWarning !== 'boolean') return undefined;
  return Object.freeze({ tier: value.tier, hiredUnderWarning: value.hiredUnderWarning });
}

function readStrike(value: unknown): CountedDecisionRecord | null {
  if (!isRecord(value)) return null;
  if (!exactKeys(value, STRIKE_FIELDS)) return null;
  if (!isCountedDecision(value.decision)) return null;
  if (!isNonNegativeNumber(value.atSeconds)) return null;
  if (!isNonNegativeNumber(value.shownCostGymBucks)) return null;
  return canonicalStrike(
    Object.freeze({
      decision: value.decision,
      atSeconds: value.atSeconds,
      shownCostGymBucks: value.shownCostGymBucks,
    }),
  );
}

function readNeglected(value: unknown): readonly ManagedEquipmentItem[] | null {
  if (!Array.isArray(value)) return null;
  const items: ManagedEquipmentItem[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (!isManagedItem(item)) return null;
    if (seen.has(item)) return null;
    seen.add(item);
    items.push(item);
  }
  return Object.freeze(items);
}

function readAllocation(value: unknown): WeekAllocation | null {
  if (!Array.isArray(value) || value.length !== EMPIRE_TUNING.FLEXIBLE_SESSIONS_PER_WEEK) {
    return null;
  }
  const slots: FlexibleSlot[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const slot = value[index];
    if (!isFlexibleSlot(slot)) return null;
    slots.push(slot);
  }
  return Object.freeze([slots[0], slots[1], slots[2]]) as WeekAllocation;
}

function readSlotOutcome(value: unknown): SlotOutcome | null {
  if (!isRecord(value) || typeof value.kind !== 'string') return null;
  if (!(SLOT_OUTCOME_KINDS as readonly string[]).includes(value.kind)) return null;
  if (value.kind === 'rested') {
    if (!exactKeys(value, RESTED_SLOT_FIELDS)) return null;
    return Object.freeze({ kind: 'rested' });
  }
  if (value.kind === 'trained') {
    if (!isFlexibleSlot(value.activity) || value.activity === 'rest') return null;
    if (!exactKeys(value, TRAINED_SLOT_FIELDS)) return null;
    return Object.freeze({ kind: 'trained', activity: value.activity });
  }
  if (!isFlexibleSlot(value.activity) || value.activity === 'rest') return null;
  if (!isSlotRequirement(value.requires)) return null;
  if (!exactKeys(value, UNEQUIPPED_SLOT_FIELDS)) return null;
  return Object.freeze({
    kind: 'unequipped',
    activity: value.activity,
    requires: value.requires,
  });
}

function readEffects(value: unknown): WeeklyAttributeEffects | null {
  if (!isRecord(value)) return null;
  if (!exactKeys(value, EFFECT_FIELDS)) return null;
  if (!isNonNegativeNumber(value.residualCarryMultiplier) || value.residualCarryMultiplier > 1) {
    return null;
  }
  if (!isNonNegativeNumber(value.injuryChanceMultiplier) || value.injuryChanceMultiplier > 1) {
    return null;
  }
  if (!isNonNegativeNumber(value.techniqueQualityBonus)) return null;
  if (!isNonNegativeNumber(value.ceilingGrowthPerWeek)) return null;
  return Object.freeze({
    residualCarryMultiplier: value.residualCarryMultiplier,
    injuryChanceMultiplier: value.injuryChanceMultiplier,
    techniqueQualityBonus: value.techniqueQualityBonus,
    ceilingGrowthPerWeek: value.ceilingGrowthPerWeek,
  }) as WeeklyAttributeEffects;
}

function readWeekReport(value: unknown): GymWeekReport | null {
  if (!isRecord(value)) return null;
  if (!exactKeys(value, WEEK_REPORT_FIELDS)) return null;
  if (!isNonNegativeWhole(value.weekIndex)) return null;
  const allocation = readAllocation(value.allocation);
  if (allocation === null) return null;
  if (
    !Array.isArray(value.slots) ||
    value.slots.length !== EMPIRE_TUNING.FLEXIBLE_SESSIONS_PER_WEEK
  ) {
    return null;
  }
  const first = readSlotOutcome(value.slots[0]);
  const second = readSlotOutcome(value.slots[1]);
  const third = readSlotOutcome(value.slots[2]);
  if (first === null || second === null || third === null) return null;
  const effects = readEffects(value.effects);
  if (effects === null) return null;
  return canonicalWeekReport(
    Object.freeze({
      weekIndex: value.weekIndex,
      allocation,
      slots: Object.freeze([first, second, third]) as GymWeekReport['slots'],
      effects,
    }),
  );
}

function readVisit(value: unknown): ServiceVisitRecord | null {
  if (!isRecord(value)) return null;
  if (!exactKeys(value, VISIT_FIELDS)) return null;
  if (typeof value.stationKind !== 'string') return null;
  if (!(STATION_KINDS as readonly string[]).includes(value.stationKind)) return null;
  if (typeof value.stationKey !== 'string') return null;
  if (!isNonNegativeWhole(value.queueWaitTicks)) return null;
  if (!isNonNegativeNumber(value.trainingExperience)) return null;
  if (typeof value.outcome !== 'string') return null;
  if (!(VISIT_OUTCOMES as readonly string[]).includes(value.outcome)) return null;
  if (!isNonNegativeWhole(value.observedAtTick)) return null;
  return canonicalVisit(
    Object.freeze({
      stationKind: value.stationKind as ServiceVisitRecord['stationKind'],
      stationKey: value.stationKey,
      queueWaitTicks: value.queueWaitTicks,
      trainingExperience: value.trainingExperience,
      outcome: value.outcome as ServiceVisitRecord['outcome'],
      observedAtTick: value.observedAtTick,
    }),
  );
}

function readLivingMember(value: unknown, expectedOrdinal: number): PersistableLivingMember | null {
  if (!isRecord(value)) return null;
  if (!exactKeys(value, LIVING_MEMBER_FIELDS)) return null;
  if (value.ordinal !== expectedOrdinal) return null;
  if (!isNonNegativeWhole(value.ordinal)) return null;
  if (!isMemberType(value.type)) return null;
  if (!isNonNegativeNumber(value.joinedAtSeconds)) return null;
  if (!Array.isArray(value.recentVisits)) return null;
  if (value.recentVisits.length > EMPIRE_TUNING.LIVING_MEMBER_SERVICE_HISTORY_WINDOW) return null;
  const visits: ServiceVisitRecord[] = [];
  for (let index = 0; index < value.recentVisits.length; index += 1) {
    const visit = readVisit(value.recentVisits[index]);
    if (visit === null) return null;
    visits.push(visit);
  }
  return canonicalLivingMember(
    Object.freeze({
      ordinal: value.ordinal,
      type: value.type,
      joinedAtSeconds: value.joinedAtSeconds,
      recentVisits: Object.freeze(visits),
    }),
  );
}

function readManagement(
  value: unknown,
  owned: readonly ManagedEquipmentItem[],
): FacilitySaveTruthV2['management'] | null {
  if (!isRecord(value)) return null;
  if (!exactKeys(value, MANAGEMENT_FIELDS)) return null;
  const condition = readCondition(value.condition, owned);
  if (condition === null) return null;
  const manager = readManager(value.manager);
  if (manager === undefined) return null;
  if (!Array.isArray(value.strikes)) return null;
  const strikes: CountedDecisionRecord[] = [];
  for (let index = 0; index < value.strikes.length; index += 1) {
    const row = readStrike(value.strikes[index]);
    if (row === null) return null;
    strikes.push(row);
  }
  const neglected = readNeglected(value.neglected);
  if (neglected === null) return null;
  if (!isNonNegativeWhole(value.promptDismissals)) return null;
  if (!isNonNegativeWhole(value.recoveries)) return null;
  return Object.freeze({
    condition,
    manager,
    strikes: Object.freeze(strikes),
    neglected,
    promptDismissals: value.promptDismissals,
    recoveries: value.recoveries,
  });
}

function readWeek(value: unknown): FacilitySaveTruthV2['week'] | null {
  if (!isRecord(value)) return null;
  if (!exactKeys(value, WEEK_FIELDS)) return null;
  const allocation = readAllocation(value.allocation);
  if (allocation === null) return null;
  if (typeof value.allocationSetThisWeek !== 'boolean') return null;
  if (!Array.isArray(value.weekLog)) return null;
  const weekLog: GymWeekReport[] = [];
  for (let index = 0; index < value.weekLog.length; index += 1) {
    const report = readWeekReport(value.weekLog[index]);
    if (report === null) return null;
    weekLog.push(report);
  }
  return Object.freeze({
    allocation,
    allocationSetThisWeek: value.allocationSetThisWeek,
    weekLog: Object.freeze(weekLog),
  });
}

function readLiving(
  value: unknown,
  memberCount: number,
): FacilitySaveTruthV2['living'] | null {
  if (!isRecord(value)) return null;
  if (!exactKeys(value, LIVING_FIELDS)) return null;
  if (!Array.isArray(value.members)) return null;
  if (value.members.length !== memberCount) return null;
  const members: PersistableLivingMember[] = [];
  for (let index = 0; index < value.members.length; index += 1) {
    const member = readLivingMember(value.members[index], index);
    if (member === null) return null;
    members.push(member);
  }
  return Object.freeze({ members: Object.freeze(members) });
}

function ownedFromFacility(facility: PersistableFacilityTruth): readonly ManagedEquipmentItem[] {
  return Object.freeze([...facility.ladderEquipment, ...facility.sessionEquipment]);
}

function readGymTruth(value: unknown, legacy = false): FacilitySaveTruthV2 | null {
  if (!isRecord(value)) return null;
  if (!exactKeys(value, FACILITY_SAVE_TRUTH_DOMAINS)) return null;
  const facility = readFacility(value.facility, legacy);
  if (facility === null) return null;
  const clock = readClock(value.clock);
  if (clock === null) return null;
  const management = readManagement(value.management, ownedFromFacility(facility));
  if (management === null) return null;
  const week = readWeek(value.week);
  if (week === null) return null;
  const living = readLiving(value.living, facility.memberCount);
  if (living === null) return null;
  return canonicalGymTruth(
    Object.freeze({
      facility,
      clock,
      management,
      week,
      living,
    }),
  );
}
function livingFromRoster(roster: LivingMemberRoster): FacilitySaveTruthV2['living'] {
  const members: PersistableLivingMember[] = [];
  for (let index = 0; index < roster.members.length; index += 1) {
    const member = roster.members[index];
    if (member === undefined) continue;
    members.push(
      canonicalLivingMember(
        Object.freeze({
          ordinal: memberOrdinalFromId(member.id),
          type: member.type,
          joinedAtSeconds: member.joinedAtSeconds,
          recentVisits: member.recentVisits,
        }),
      ),
    );
  }
  return Object.freeze({ members: Object.freeze(members) });
}

/** Pull the versioned save body off a live gym. Does not call upgrade or buy paths. */
export function persistableGymTruthFromGymView(state: GymViewState): FacilitySaveTruthV2 {
  requireManagedGym(state.managed);
  requireFloorState(state.floor, state.managed.gym.sessionEquipment);
  requireWeekAllocation(state.allocation);
  const gym = state.managed.gym;
  if (state.floor.rung !== gym.ladder.rung) {
    refuseWith('facility save floor rung does not match managed gym rung');
  }
  if (state.livingMembers.rung !== gym.ladder.rung) {
    refuseWith('facility save living roster rung does not match managed gym rung');
  }
  if (state.livingMembers.identityNonce < 0) {
    refuseWith('facility save identity nonce is negative');
  }
  if (state.weekIndex !== trainingWeekIndexAt(gym.ladder.collectedAt)) {
    refuseWith('facility save weekIndex does not match collectedAt');
  }
  const facility = canonicalFacility(
    Object.freeze({
      rung: gym.ladder.rung,
      gymBucks: gym.ladder.gymBucks,
      acceleratedGymBucks: gym.acceleratedGymBucks,
      sessionEquipment: gym.sessionEquipment,
      ladderEquipment: gym.ladder.equipment,
      placements: state.floor.placements,
      furniture: state.floor.furniture,
      layoutRevision: state.floor.layoutRevision,
      lastLayoutEdit: state.floor.lastLayoutEdit,
      capability: state.capability,
      identityNonce: state.livingMembers.identityNonce,
      memberCount: state.livingMembers.members.length,
    }),
  );
  return canonicalGymTruth(
    Object.freeze({
      facility,
      clock: Object.freeze({
        collectedAt: gym.ladder.collectedAt,
        bankedOperationSeconds: state.managed.bankedOperationSeconds,
        checkInsTaken: state.managed.checkInsTaken,
      }),
      management: Object.freeze({
        condition: state.managed.condition,
        manager: state.managed.manager,
        strikes: state.managed.strikes,
        neglected: state.managed.neglected,
        promptDismissals: state.managed.promptDismissals,
        recoveries: state.managed.recoveries,
      }),
      week: Object.freeze({
        allocation: state.allocation,
        allocationSetThisWeek: state.allocationSetThisWeek,
        weekLog: state.weekLog,
      }),
      living: livingFromRoster(state.livingMembers),
    }),
  );
}

export function persistableTruthFromGymView(state: GymViewState): PersistableFacilityTruth {
  return persistableGymTruthFromGymView(state).facility;
}

/** Deterministic JSON for the v2 envelope. Same truth, same bytes. */
export function encodeFacilitySave(truth: FacilitySaveTruthV2): string {
  const envelope: FacilitySaveEnvelope = Object.freeze({
    kind: FACILITY_SAVE_KIND,
    schemaVersion: FACILITY_SAVE_SCHEMA_VERSION,
    truth: canonicalGymTruth(truth),
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
  if (parsed.schemaVersion !== FACILITY_SAVE_SCHEMA_VERSION && parsed.schemaVersion !== EMPIRE_TUNING.FLOOR_SAVE_LEGACY_SCHEMA_VERSION) {
    return Object.freeze({ kind: 'refused', reason: 'unsupported-version' });
  }
  if (!exactKeys(parsed, ENVELOPE_FIELDS)) {
    return Object.freeze({ kind: 'refused', reason: 'incoherent' });
  }
  const truth = readGymTruth(parsed.truth, parsed.schemaVersion === EMPIRE_TUNING.FLOOR_SAVE_LEGACY_SCHEMA_VERSION);
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

function rosterFromLiving(
  facility: PersistableFacilityTruth,
  living: FacilitySaveTruthV2['living'],
): LivingMemberRoster {
  const members: LivingGymMember[] = [];
  for (let index = 0; index < living.members.length; index += 1) {
    const row = living.members[index];
    if (row === undefined) {
      refuseWith('facility save living member row is missing');
    }
    if (row.ordinal !== index) {
      refuseWith('facility save living member ordinals are not dense');
    }
    members.push(
      Object.freeze({
        id: deriveMemberId(facility.identityNonce, row.ordinal),
        displayName: displayNameForCreation(facility.identityNonce, row.ordinal),
        type: row.type,
        joinedAtSeconds: row.joinedAtSeconds,
        recentVisits: row.recentVisits,
      }),
    );
  }
  if (members.length !== facility.memberCount) {
    refuseWith(
      `facility save memberCount ${facility.memberCount} does not match restored roster ${members.length}`,
    );
  }
  return Object.freeze({
    rung: facility.rung,
    identityNonce: facility.identityNonce,
    members: Object.freeze(members),
  });
}

/**
 * Rebuild floor + managed gym + capability + roster from durable truth.
 * Does not call `upgradeStation` or any buy path. Writes saved collectedAt
 * rather than zeroing the idle clock.
 */
export function restoreDurableFacility(truth: FacilitySaveTruthV2): RestoredFacility {
  const facility = truth.facility;
  const ladder = requireLadderState(
    Object.freeze({
      rung: facility.rung,
      gymBucks: facility.gymBucks,
      equipment: facility.ladderEquipment,
      collectedAt: truth.clock.collectedAt,
    }),
  );
  const gym = requireGymState(
    Object.freeze({
      ladder,
      acceleratedGymBucks: facility.acceleratedGymBucks,
      sessionEquipment: facility.sessionEquipment,
    }),
  );
  const seated = withUpdatedGym(createManagedGym(), gym);
  const managed = requireManagedGym(
    Object.freeze({
      gym: seated.gym,
      condition: freezeCondition(truth.management.condition),
      manager: truth.management.manager,
      strikes: truth.management.strikes,
      neglected: truth.management.neglected,
      promptDismissals: truth.management.promptDismissals,
      bankedOperationSeconds: truth.clock.bankedOperationSeconds,
      checkInsTaken: truth.clock.checkInsTaken,
      recoveries: truth.management.recoveries,
    }),
  );
  const floor = requireFloorState(
    Object.freeze({
      rung: facility.rung,
      placements: freezePositionMap(facility.placements),
      furniture: freezePositionMap(facility.furniture),
      layoutRevision: facility.layoutRevision,
      lastLayoutEdit: canonicalLayoutEdit(facility.lastLayoutEdit),
    }),
    facility.sessionEquipment,
    facility.ladderEquipment,
  );
  const bay = competitionBenchBay(floor, facility.ladderEquipment, stationLevels(facility.capability, COMPETITION_BENCH_BAY).capacity);
  if (stationLevels(facility.capability, COMPETITION_BENCH_BAY).capacity > 0 && bay.complete && bay.expansion === null) refuseWith('facility save capacity has no second physical bench position');
  const roster = rosterFromLiving(facility, truth.living);
  if (roster.identityNonce !== facility.identityNonce) {
    refuseWith('facility save identity nonce did not survive restore');
  }
  const owned = ownedItemsOf(managed.gym);
  const conditionKeys = Object.keys(managed.condition);
  if (conditionKeys.length !== owned.length) {
    refuseWith('facility save condition map does not match owned equipment');
  }
  const capability = freezeCapability(facility.capability);
  return Object.freeze({
    floor,
    managed,
    capability,
    roster,
    week: truth.week,
  });
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

export function restoreGymViewState(truth: FacilitySaveTruthV2): GymViewState {
  const restored = restoreDurableFacility(truth);
  const opening = createGymViewState();
  requireWeekAllocation(restored.week.allocation);
  return Object.freeze({
    ...opening,
    managed: restored.managed,
    floor: restored.floor,
    capability: restored.capability,
    livingMembers: restored.roster,
    weekIndex: trainingWeekIndexAt(restored.managed.gym.ladder.collectedAt),
    allocation: restored.week.allocation,
    allocationSetThisWeek: restored.week.allocationSetThisWeek,
    weekLog: restored.week.weekLog,
    lastAccrual: null,
    lastManagementReport: null,
    lastRefusal: null,
    surface: opening.surface,
  });
}

export function bayAxisLevels(capability: StationCapabilityState): StationAxisLevels {
  return stationLevels(capability, COMPETITION_BENCH_BAY);
}

export function restoredPresentationWorld(truth: FacilitySaveTruthV2) {
  return presentationWorld(presentationInputFromRestored(restoreDurableFacility(truth)));
}
