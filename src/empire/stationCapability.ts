/**
 * stationCapability.ts — GDD §5.14 Stage D / §5.15 Living Gym Q/C/T,
 * retargeted by GDD §5.18 Stage D.1 onto a training station, not an item.
 *
 * Pure module (CLAUDE.md, "Pure logic is separate from UI"): zero React, zero
 * side effects, zero I/O, no clock, no randomness. Its imports are
 * `./empireCore` (`refuseWith`), `./empireTuning` and `./trainingStation`
 * (the functional-station vocabulary). It does not import `floorSim.ts` —
 * capacity and throughput are quoted here as numbers the sim applies; the
 * sim remains the only writer of occupancy, queues and use duration.
 *
 * ===========================================================================
 * 1. Three axes, three different mechanisms, not one "better station" scalar
 * ===========================================================================
 *
 * GDD §5.15: Quality, Capacity and Throughput must be causally distinct.
 * GDD §5.18: they attach to a TRAINING STATION, not to a piece of equipment.
 *
 *   Quality     — training-experience value of a completed use, AND extra
 *                 appeal (`stationQualityAffinityBonus`) so members prefer
 *                 the upgraded bay when they have a choice. Does not add
 *                 a simultaneous slot and does not shorten service duration.
 *   Capacity    — simultaneous usable slots the floor sim actually seats.
 *                 Default 1; one upgrade adds `STATION_CAPACITY_BONUS_SLOTS`.
 *                 Stage D.1 realises the extra slot as a second physical
 *                 bench, not as two approach cells around one bench.
 *   Throughput  — ticks the bay holds a seat empty between users while
 *                 plates are changed. Stock is
 *                 `FLOOR_SIM_STATION_CHANGEOVER_TICKS`; a purchased plate
 *                 tree writes `STATION_THROUGHPUT_CHANGEOVER_TICKS`. The
 *                 lifter's set duration is unchanged. One slot remains one
 *                 slot. D2.1B: this used to shorten `useTicksFor`; that
 *                 made training itself shorter and was not a changeover.
 *
 * Stage D.1 is a vertical slice, not a catalog. Only
 * `STATION_UPGRADE_SLICE` (`competition-bench-bay`) can be upgraded.
 * Session equipment stays at stock. Levels are 0 or 1 — one upgrade per
 * axis, no tree. D2 tunes the numbers; this file proves the mechanisms.
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
 * Keys are `TrainingStationKind`, not `LadderEquipmentItem`.
 */

import { refuseWith } from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';
import {
  type TrainingStationKind,
  isTrainingStationKind,
} from './trainingStation';

/** The three Stage D axes, in the order the station panel names them. */
export type StationUpgradeAxis = (typeof EMPIRE_TUNING.STATION_UPGRADE_AXES)[number];

/** One station's purchased levels. Missing station / missing field = stock (0). */
export interface StationAxisLevels {
  readonly quality: number;
  readonly capacity: number;
  readonly throughput: number;
}

/**
 * Per-training-station Q/C/T levels for the Stage D.1 slice. Absence is
 * stock. Never a second ownership list — a station whose bay is not on
 * the floor is refused by the reducer before this map is written.
 */
export type StationCapabilityState = Readonly<
  Partial<Record<TrainingStationKind, StationAxisLevels>>
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

/** Whether `value` is in the Stage D.1 upgrade slice. */
export function isStationUpgradeSlice(value: string): value is TrainingStationKind {
  return (EMPIRE_TUNING.STATION_UPGRADE_SLICE as readonly string[]).includes(value);
}

/** `station`'s levels in `capability`, stock if absent. */
export function stationLevels(
  capability: StationCapabilityState | null | undefined,
  station: TrainingStationKind,
): StationAxisLevels {
  if (capability == null) return STOCK_LEVELS;
  const stored = capability[station];
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
 * Simultaneous usable slots `kind`/`key` should have, given purchased
 * capacity. Training stations in the slice read the purchased level;
 * session stations, leftover Barbell, and unknown keys stay at 1. The
 * floor sim may realise fewer slots than this if the second bench has
 * nowhere to stand — that is a physical consequence, not a silent clamp
 * in this function.
 *
 * `kind` is the FloorStationRef kind; `key` is the station kind for
 * `training` and the item id otherwise. This module does not import
 * `floorSim.ts`, so the pair is passed as two strings.
 */
export function stationCapacitySlots(
  capability: StationCapabilityState,
  kind: 'training' | 'fixed' | 'session',
  key: string,
): number {
  if (kind !== 'training' || !isStationUpgradeSlice(key)) return 1;
  const level = stationLevels(capability, key).capacity;
  return 1 + level * EMPIRE_TUNING.STATION_CAPACITY_BONUS_SLOTS;
}

/**
 * Multiplier on a member's use-tick duration at this station. Stock, Quality,
 * Capacity, and Throughput all return 1. D2.1B: a plate tree does not
 * shorten the set. Use duration is the lifter's. Throughput shortens
 * `stationChangeoverTicks`.
 */
export function stationUseTicksFactor(
  capability: StationCapabilityState,
  kind: 'training' | 'fixed' | 'session',
  key: string,
): number {
  if (kind !== 'training' || !isStationUpgradeSlice(key)) return 1;
  // Throughput used to return a shorter-set factor here. D2.1B: the plate
  // tree does not shorten the set. Both arms return 1; the level is read so
  // a mutant that restores a shorter-set branch has a live input.
  if (stationLevels(capability, key).throughput <= 0) return 1;
  return 1;
}

/**
 * Ticks a seat stays empty after a completed use, while plates are changed.
 * Non-slice stations (mats, leftover Barbell) have no plate changeover.
 * Stock slice stations use `FLOOR_SIM_STATION_CHANGEOVER_TICKS`. A purchased
 * plate tree uses `STATION_THROUGHPUT_CHANGEOVER_TICKS`.
 */
export function stationChangeoverTicks(
  capability: StationCapabilityState,
  kind: 'training' | 'fixed' | 'session',
  key: string,
): number {
  if (kind !== 'training' || !isStationUpgradeSlice(key)) return 0;
  if (stationLevels(capability, key).throughput <= 0) {
    return EMPIRE_TUNING.FLOOR_SIM_STATION_CHANGEOVER_TICKS;
  }
  return EMPIRE_TUNING.STATION_THROUGHPUT_CHANGEOVER_TICKS;
}

/**
 * Training-experience value of one completed use. Quality raises this.
 * Quality does not change slots or service duration. Not Gym Bucks.
 * Stage E reads this; Stage D's live causal reader is the affinity bonus.
 */
export function stationTrainingExperience(
  capability: StationCapabilityState,
  kind: 'training' | 'fixed' | 'session',
  key: string,
): number {
  if (kind !== 'training' || !isStationUpgradeSlice(key)) {
    return EMPIRE_TUNING.STATION_STOCK_TRAINING_EXPERIENCE;
  }
  if (stationLevels(capability, key).quality <= 0) {
    return EMPIRE_TUNING.STATION_STOCK_TRAINING_EXPERIENCE;
  }
  return EMPIRE_TUNING.STATION_QUALITY_TRAINING_EXPERIENCE;
}

/**
 * Extra affinity a Quality station adds on top of the published type tables.
 * Stock, session, leftover Barbell, and non-slice stations return 0. The
 * floor sim adds this inside `affinityFor`; it is how Quality is visible
 * as demand, not as a shorter hold or a second seat.
 */
export function stationQualityAffinityBonus(
  capability: StationCapabilityState,
  kind: 'training' | 'fixed' | 'session',
  key: string,
): number {
  if (kind !== 'training' || !isStationUpgradeSlice(key)) return 0;
  if (stationLevels(capability, key).quality <= 0) return 0;
  return EMPIRE_TUNING.STATION_QUALITY_AFFINITY_BONUS;
}

/**
 * Write one axis level without a purse or placement check. The reducer uses
 * this to preview Capacity's realised benches; `upgradeStation` remains the
 * only purchase path.
 */
export function withStationAxis(
  capability: StationCapabilityState,
  station: TrainingStationKind,
  axis: StationUpgradeAxis,
  level: number,
): StationCapabilityState {
  if (!Number.isInteger(level) || level < 0 || level > EMPIRE_TUNING.STATION_UPGRADE_LEVEL_MAX) {
    refuseWith(
      `station axis level ${level} is outside 0..${EMPIRE_TUNING.STATION_UPGRADE_LEVEL_MAX}`,
    );
  }
  if (!isTrainingStationKind(station)) {
    refuseWith(`${station} is not a training station`);
  }
  const current = stationLevels(capability, station);
  return Object.freeze({
    ...capability,
    [station]: Object.freeze({
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
 * `alreadyPlaced` is the reducer's reading of bay completeness — all
 * required equipment currently on the floor. `realizesCapacity` is the
 * reducer's reading of the derived bay after a preview upgrade — only
 * consulted on the capacity axis, and it means a second physical bench
 * actually fits, not that two approach cells exist around one bench.
 */
export function upgradeStation(
  capability: StationCapabilityState,
  station: TrainingStationKind | string,
  axis: StationUpgradeAxis,
  gymBucks: number,
  alreadyPlaced: boolean,
  realizesCapacity: boolean,
): StationUpgradeResult {
  if (!isStationUpgradeSlice(station)) {
    return Object.freeze({
      kind: 'refused',
      reason: 'not-upgradable',
      capability,
      costGymBucks: 0,
    });
  }
  const current = stationLevels(capability, station);
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
    capability: Object.freeze({ ...capability, [station]: nextLevels }),
    costGymBucks,
  });
}
