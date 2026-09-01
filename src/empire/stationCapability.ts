/**
 * stationCapability.ts — GDD §5.14 Stage D / §5.15 Living Gym Q/C/T.
 *
 * Pure module (CLAUDE.md, "Pure logic is separate from UI"): zero React, zero
 * side effects, zero I/O, no clock, no randomness. Its imports are
 * `./empireCore` (`refuseWith`), `./empireTuning` and `./ladder` (the Barbell
 * item vocabulary). It does not import `floorSim.ts` — capacity and throughput
 * are quoted here as numbers the sim applies; the sim remains the only writer
 * of occupancy, queues and use duration.
 *
 * ===========================================================================
 * 1. Three axes, three different mechanisms, not one "better station" scalar
 * ===========================================================================
 *
 * GDD §5.15: Quality, Capacity and Throughput must be causally distinct.
 *
 *   Quality     — training-experience value of a completed use, AND extra
 *                 appeal (`stationQualityAffinityBonus`) so members prefer
 *                 the upgraded station when they have a choice. Does not add
 *                 a simultaneous slot and does not shorten service duration.
 *   Capacity    — simultaneous usable slots the floor sim actually seats.
 *                 Default 1; one upgrade adds `STATION_CAPACITY_BONUS_SLOTS`.
 *   Throughput  — a multiplier on `FLOOR_SIM_USE_TICKS_BY_TYPE` service
 *                 duration. One station slot remains one station slot.
 *
 * Stage D is a vertical slice, not a catalog. Only
 * `STATION_UPGRADE_SLICE` (the three starting Barbell pieces) can be
 * upgraded. Session equipment stays at stock. Levels are 0 or 1 — one
 * upgrade per axis, no tree. D2 tunes the numbers; this file proves the
 * mechanisms.
 *
 * Quality does not raise the Career player's e1RM, Total, or meet
 * performance (GDD §8.1). It does not credit Gym Bucks. The experience
 * value is a seam Stage E's reputation loop can read later without a
 * generic income multiplier standing in for it now. Stage D's own causal
 * reader is the affinity bonus: members prefer a Quality station.
 *
 * ===========================================================================
 * 2. Why this state lives beside the floor, not inside `ManagedGym`
 * ===========================================================================
 *
 * Wear, wages, repair and failure stay on `ManagedGym`. Putting Q/C/T there
 * would re-key those paths for a mechanic that does not yet touch them.
 * `GymViewState.capability` is the store; this module is the algebra.
 */

import { refuseWith } from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';
import { type LadderEquipmentItem } from './ladder';

/** The three Stage D axes, in the order the station panel names them. */
export type StationUpgradeAxis = (typeof EMPIRE_TUNING.STATION_UPGRADE_AXES)[number];

/** One station's purchased levels. Missing item / missing field = stock (0). */
export interface StationAxisLevels {
  readonly quality: number;
  readonly capacity: number;
  readonly throughput: number;
}

/**
 * Per-item Q/C/T levels for the Stage D slice. Absence is stock. Never a
 * second ownership list — an item not in `LadderState.equipment` has no
 * business here, and the reducer refuses that before it writes.
 */
export type StationCapabilityState = Readonly<
  Partial<Record<LadderEquipmentItem, StationAxisLevels>>
>;

const STOCK_LEVELS: StationAxisLevels = Object.freeze({
  quality: 0,
  capacity: 0,
  throughput: 0,
});

/** Empty map: every station at stock. The opening gym's capability. */
export function stockStationCapability(): StationCapabilityState {
  return Object.freeze({});
}

/** Whether `item` is in the Stage D upgrade slice. */
export function isStationUpgradeSlice(item: string): item is LadderEquipmentItem {
  return (EMPIRE_TUNING.STATION_UPGRADE_SLICE as readonly string[]).includes(item);
}

/** `item`'s levels in `capability`, stock if absent. */
export function stationLevels(
  capability: StationCapabilityState | null | undefined,
  item: LadderEquipmentItem,
): StationAxisLevels {
  if (capability == null) return STOCK_LEVELS;
  const stored = capability[item];
  if (stored === undefined) return STOCK_LEVELS;
  return stored;
}

/** Gym Bucks to buy one axis on a stock station. */
export function stationUpgradeCostGymBucks(axis: StationUpgradeAxis): number {
  const cost = EMPIRE_TUNING.STATION_UPGRADE_COST_GYM_BUCKS[axis];
  if (cost === undefined) refuseWith(`${axis} has no registered station-upgrade cost`);
  return cost;
}

/**
 * Simultaneous usable slots `ref` should have, given purchased capacity.
 * Session stations and non-slice Barbell stay at 1. The floor sim may
 * realise fewer slots than this if the station has too few approach cells —
 * that is a physical consequence, not a silent clamp in this function.
 */
export function stationCapacitySlots(
  capability: StationCapabilityState,
  kind: 'fixed' | 'session',
  item: string,
): number {
  if (kind !== 'fixed' || !isStationUpgradeSlice(item)) return 1;
  const level = stationLevels(capability, item).capacity;
  return 1 + level * EMPIRE_TUNING.STATION_CAPACITY_BONUS_SLOTS;
}

/**
 * Multiplier on a member's use-tick duration at this station. Stock and
 * non-slice stations return 1. Throughput never changes slot count.
 */
export function stationUseTicksFactor(
  capability: StationCapabilityState,
  kind: 'fixed' | 'session',
  item: string,
): number {
  if (kind !== 'fixed' || !isStationUpgradeSlice(item)) return 1;
  if (stationLevels(capability, item).throughput <= 0) return 1;
  return EMPIRE_TUNING.STATION_THROUGHPUT_USE_TICKS_FACTOR;
}

/**
 * Training-experience value of one completed use. Quality raises this.
 * Quality does not change slots or service duration. Not Gym Bucks.
 * Stage E reads this; Stage D's live causal reader is the affinity bonus.
 */
export function stationTrainingExperience(
  capability: StationCapabilityState,
  kind: 'fixed' | 'session',
  item: string,
): number {
  if (kind !== 'fixed' || !isStationUpgradeSlice(item)) {
    return EMPIRE_TUNING.STATION_STOCK_TRAINING_EXPERIENCE;
  }
  if (stationLevels(capability, item).quality <= 0) {
    return EMPIRE_TUNING.STATION_STOCK_TRAINING_EXPERIENCE;
  }
  return EMPIRE_TUNING.STATION_QUALITY_TRAINING_EXPERIENCE;
}

/**
 * Extra affinity a Quality station adds on top of the published type tables.
 * Stock, session, and non-slice stations return 0. The floor sim adds this
 * inside `affinityFor`; it is how Quality is visible as demand, not as a
 * shorter hold or a second seat.
 */
export function stationQualityAffinityBonus(
  capability: StationCapabilityState,
  kind: 'fixed' | 'session',
  item: string,
): number {
  if (kind !== 'fixed' || !isStationUpgradeSlice(item)) return 0;
  if (stationLevels(capability, item).quality <= 0) return 0;
  return EMPIRE_TUNING.STATION_QUALITY_AFFINITY_BONUS;
}

/**
 * Write one axis level without a purse or placement check. The reducer uses
 * this to preview Capacity's realised slots; `upgradeStation` remains the
 * only purchase path.
 */
export function withStationAxis(
  capability: StationCapabilityState,
  item: LadderEquipmentItem,
  axis: StationUpgradeAxis,
  level: number,
): StationCapabilityState {
  if (!Number.isInteger(level) || level < 0 || level > EMPIRE_TUNING.STATION_UPGRADE_LEVEL_MAX) {
    refuseWith(
      `station axis level ${level} is outside 0..${EMPIRE_TUNING.STATION_UPGRADE_LEVEL_MAX}`,
    );
  }
  const current = stationLevels(capability, item);
  return Object.freeze({
    ...capability,
    [item]: Object.freeze({
      quality: axis === 'quality' ? level : current.quality,
      capacity: axis === 'capacity' ? level : current.capacity,
      throughput: axis === 'throughput' ? level : current.throughput,
    }),
  });
}

export type StationUpgradeRefuseReason =
  | 'not-upgradable'
  | 'already-upgraded'
  | 'not-enough-gym-bucks'
  | 'not-placed'
  | 'no-second-position';

export type StationUpgradeResult =
  | {
      readonly kind: 'upgraded';
      readonly capability: StationCapabilityState;
      readonly costGymBucks: number;
    }
  | {
      readonly kind: 'refused';
      readonly reason: StationUpgradeRefuseReason;
      readonly capability: StationCapabilityState;
      readonly costGymBucks: number;
    };

/**
 * Apply one axis upgrade if the purse, slice membership and current level
 * allow it. Placement and realised-capacity checks are the reducer's: this
 * module does not import the floor sim.
 *
 * `alreadyPlaced` is the reducer's reading of `FloorState.furniture`.
 * `realizesCapacity` is the reducer's reading of the sim after a preview
 * upgrade — only consulted on the capacity axis.
 */
export function upgradeStation(
  capability: StationCapabilityState,
  item: LadderEquipmentItem,
  axis: StationUpgradeAxis,
  gymBucks: number,
  alreadyPlaced: boolean,
  realizesCapacity: boolean,
): StationUpgradeResult {
  if (!isStationUpgradeSlice(item)) {
    return Object.freeze({
      kind: 'refused',
      reason: 'not-upgradable',
      capability,
      costGymBucks: 0,
    });
  }
  const current = stationLevels(capability, item);
  const level = current[axis];
  if (level >= EMPIRE_TUNING.STATION_UPGRADE_LEVEL_MAX) {
    return Object.freeze({
      kind: 'refused',
      reason: 'already-upgraded',
      capability,
      costGymBucks: stationUpgradeCostGymBucks(axis),
    });
  }
  if (!alreadyPlaced) {
    return Object.freeze({
      kind: 'refused',
      reason: 'not-placed',
      capability,
      costGymBucks: stationUpgradeCostGymBucks(axis),
    });
  }
  if (axis === 'capacity' && !realizesCapacity) {
    return Object.freeze({
      kind: 'refused',
      reason: 'no-second-position',
      capability,
      costGymBucks: stationUpgradeCostGymBucks(axis),
    });
  }
  const costGymBucks = stationUpgradeCostGymBucks(axis);
  if (gymBucks < costGymBucks) {
    return Object.freeze({
      kind: 'refused',
      reason: 'not-enough-gym-bucks',
      capability,
      costGymBucks,
    });
  }
  const nextLevels: StationAxisLevels = Object.freeze({
    quality: axis === 'quality' ? 1 : current.quality,
    capacity: axis === 'capacity' ? 1 : current.capacity,
    throughput: axis === 'throughput' ? 1 : current.throughput,
  });
  return Object.freeze({
    kind: 'upgraded',
    capability: Object.freeze({ ...capability, [item]: nextLevels }),
    costGymBucks,
  });
}
