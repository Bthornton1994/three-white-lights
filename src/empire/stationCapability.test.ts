/**
 * stationCapability.test.ts — GDD §5.14 Stage D / §5.15 Living Gym Q/C/T.
 *
 * Proves the three axes are distinct mechanisms, not one "better station"
 * scalar. The bottleneck experiment runs the same garage / one-bench /
 * three-powerlifter demand under stock, Quality-only, Capacity-only and
 * Throughput-only. Wear-on-unplaced is reproduced here as D-DEBT, not fixed.
 */

import { describe, expect, it } from 'vitest';

import { EMPIRE_TUNING } from './empireTuning';
import {
  createFloorState,
  type FloorState,
} from './floor';
import {
  createFloorSimState,
  floorStations,
  stationOccupancy,
  stepFloorSim,
  type FloorSimContext,
  type FloorStationRef,
} from './floorSim';
import { type LadderEquipmentItem } from './ladder';
import {
  createManagedGym,
  itemCondition,
  managedCheckIn,
  ownedItemsOf,
  withUpdatedGym,
} from './management';
import { buySessionEquipment, withLadder } from './sessions';
import {
  isStationUpgradeSlice,
  stationCapacitySlots,
  stationLevels,
  stationQualityAffinityBonus,
  stationTrainingExperience,
  stationUpgradeCostGymBucks,
  stationUseTicksFactor,
  stockStationCapability,
  upgradeStation,
  withStationAxis,
  type StationCapabilityState,
  type StationUpgradeAxis,
} from './stationCapability';

const T = EMPIRE_TUNING;
const BENCH: LadderEquipmentItem = 'flat-bench';
const BENCH_REF: FloorStationRef = Object.freeze({ kind: 'fixed', item: BENCH });
const EXPERIMENT_TICKS = 240;
const EXPERIMENT_SEED = 1;

/** Garage with only the flat bench on the floor — one obvious bottleneck. */
function benchOnlyFloor(): FloorState {
  const opening = createFloorState('garage');
  return Object.freeze({
    ...opening,
    furniture: Object.freeze({ [BENCH]: opening.furniture[BENCH] }),
  });
}

function contextWith(capability: StationCapabilityState): FloorSimContext {
  return {
    rung: 'garage',
    floor: benchOnlyFloor(),
    barbellOwned: [...T.LADDER_STARTING_EQUIPMENT],
    sessionOwned: [],
    capability,
  };
}

function capabilityWith(
  axis: StationUpgradeAxis,
): StationCapabilityState {
  const preview = upgradeStation(
    stockStationCapability(),
    BENCH,
    axis,
    10_000,
    true,
    true,
  );
  if (preview.kind !== 'upgraded') {
    throw new Error(`fixture could not purchase ${axis}`);
  }
  return preview.capability;
}

interface BottleneckReport {
  readonly slots: number;
  readonly completions: number;
  readonly maxQueue: number;
  readonly maxUsing: number;
  readonly meanUseTicks: number;
  readonly experience: number;
}

function runBottleneck(capability: StationCapabilityState): BottleneckReport {
  const context = contextWith(capability);
  const stations = floorStations(context);
  const bench = stations.find(
    (row) => row.ref.kind === 'fixed' && row.ref.item === BENCH,
  );
  if (bench === undefined) throw new Error('fixture lost the flat bench');
  let state = createFloorSimState(context, EXPERIMENT_SEED);
  let completions = 0;
  let maxQueue = 0;
  let maxUsing = 0;
  let useTicksSum = 0;
  let useTicksCount = 0;
  const opened = new Map<number, number>();
  for (let i = 0; i < EXPERIMENT_TICKS; i += 1) {
    const next = stepFloorSim(state, context);
    for (const member of next.members) {
      const previous = state.members[member.index];
      if (previous === undefined) continue;
      if (member.state === 'using' && previous.state !== 'using') {
        opened.set(member.index, member.timer);
      }
      if (previous.state === 'using' && member.state !== 'using') {
        completions += 1;
        const started = opened.get(member.index);
        if (started !== undefined) {
          useTicksSum += started;
          useTicksCount += 1;
        }
      }
    }
    maxUsing = Math.max(maxUsing, stationOccupancy(next.members, BENCH_REF));
    let standing = 0;
    for (const member of next.members) {
      if (member.state !== 'queuing') continue;
      if (member.target === null || member.target.kind !== 'fixed') continue;
      if (member.target.item !== BENCH) continue;
      standing += 1;
    }
    maxQueue = Math.max(maxQueue, standing);
    state = next;
  }
  return Object.freeze({
    slots: bench.useCells.length,
    completions,
    maxQueue,
    maxUsing,
    meanUseTicks: useTicksCount === 0 ? 0 : useTicksSum / useTicksCount,
    experience: completions * stationTrainingExperience(capability, 'fixed', BENCH),
  });
}

describe('stationCapability.ts — GDD §5.14 Stage D algebra', () => {
  it('opens at stock: empty map, one slot, identity duration, stock experience', () => {
    const stock = stockStationCapability();
    expect(stock).toEqual({});
    expect(stationLevels(stock, BENCH)).toEqual({
      quality: 0,
      capacity: 0,
      throughput: 0,
    });
    expect(stationCapacitySlots(stock, 'fixed', BENCH)).toBe(1);
    expect(stationUseTicksFactor(stock, 'fixed', BENCH)).toBe(1);
    expect(stationTrainingExperience(stock, 'fixed', BENCH)).toBe(
      T.STATION_STOCK_TRAINING_EXPERIENCE,
    );
  });

  it('the Stage D slice is exactly the three starting Barbell pieces', () => {
    expect([...T.STATION_UPGRADE_SLICE]).toEqual([...T.LADDER_STARTING_EQUIPMENT]);
    for (const item of T.STATION_UPGRADE_SLICE) {
      expect(isStationUpgradeSlice(item)).toBe(true);
    }
    expect(isStationUpgradeSlice('squat-rack')).toBe(false);
    expect(isStationUpgradeSlice('mats')).toBe(false);
  });

  it('session stations and non-slice Barbell stay at stock even if a map is handed in', () => {
    const quality = capabilityWith('quality');
    expect(stationCapacitySlots(quality, 'session', 'mats')).toBe(1);
    expect(stationUseTicksFactor(quality, 'session', 'mats')).toBe(1);
    expect(stationTrainingExperience(quality, 'session', 'mats')).toBe(
      T.STATION_STOCK_TRAINING_EXPERIENCE,
    );
    expect(stationQualityAffinityBonus(quality, 'session', 'mats')).toBe(0);
    expect(stationCapacitySlots(quality, 'fixed', 'squat-rack')).toBe(1);
    expect(stationUseTicksFactor(quality, 'fixed', 'squat-rack')).toBe(1);
    expect(stationTrainingExperience(quality, 'fixed', 'squat-rack')).toBe(
      T.STATION_STOCK_TRAINING_EXPERIENCE,
    );
    expect(stationQualityAffinityBonus(quality, 'fixed', 'squat-rack')).toBe(0);
  });

  it('each axis has a distinct first-pass Gym Bucks cost, not a retune of existing SKUs', () => {
    expect(stationUpgradeCostGymBucks('quality')).toBe(120);
    expect(stationUpgradeCostGymBucks('capacity')).toBe(180);
    expect(stationUpgradeCostGymBucks('throughput')).toBe(150);
    for (const axis of T.STATION_UPGRADE_AXES) {
      const cost = stationUpgradeCostGymBucks(axis);
      expect(Object.values(T.LADDER_EQUIPMENT_COST_GYM_BUCKS)).not.toContain(cost);
      expect(Object.values(T.SESSION_EQUIPMENT_COST_GYM_BUCKS)).not.toContain(cost);
    }
  });

  it('Quality raises experience and does not add a slot or shorten duration', () => {
    const quality = capabilityWith('quality');
    expect(stationCapacitySlots(quality, 'fixed', BENCH)).toBe(1);
    expect(stationUseTicksFactor(quality, 'fixed', BENCH)).toBe(1);
    expect(stationTrainingExperience(quality, 'fixed', BENCH)).toBe(
      T.STATION_QUALITY_TRAINING_EXPERIENCE,
    );
    expect(T.STATION_QUALITY_TRAINING_EXPERIENCE).toBeGreaterThan(
      T.STATION_STOCK_TRAINING_EXPERIENCE,
    );
  });

  it('Capacity adds a real simultaneous slot and does not change duration or experience', () => {
    const capacity = capabilityWith('capacity');
    expect(stationCapacitySlots(capacity, 'fixed', BENCH)).toBe(
      1 + T.STATION_CAPACITY_BONUS_SLOTS,
    );
    expect(stationUseTicksFactor(capacity, 'fixed', BENCH)).toBe(1);
    expect(stationTrainingExperience(capacity, 'fixed', BENCH)).toBe(
      T.STATION_STOCK_TRAINING_EXPERIENCE,
    );
  });

  it('Throughput shortens real service duration and does not add a slot or raise experience', () => {
    const throughput = capabilityWith('throughput');
    expect(stationCapacitySlots(throughput, 'fixed', BENCH)).toBe(1);
    expect(stationUseTicksFactor(throughput, 'fixed', BENCH)).toBe(
      T.STATION_THROUGHPUT_USE_TICKS_FACTOR,
    );
    expect(T.STATION_THROUGHPUT_USE_TICKS_FACTOR).toBeLessThan(1);
    expect(T.STATION_THROUGHPUT_USE_TICKS_FACTOR).toBeGreaterThan(0);
    expect(stationTrainingExperience(throughput, 'fixed', BENCH)).toBe(
      T.STATION_STOCK_TRAINING_EXPERIENCE,
    );
  });

  it('upgradeStation grants the axis when the purse, placement and realised capacity allow it', () => {
    const outcome = upgradeStation(
      stockStationCapability(),
      BENCH,
      'quality',
      120,
      true,
      true,
    );
    expect(outcome.kind).toBe('upgraded');
    if (outcome.kind !== 'upgraded') return;
    expect(outcome.costGymBucks).toBe(120);
    expect(stationLevels(outcome.capability, BENCH).quality).toBe(1);
    expect(stationLevels(outcome.capability, BENCH).capacity).toBe(0);
    expect(stationLevels(outcome.capability, BENCH).throughput).toBe(0);
  });

  it('refuses a non-slice item, a second purchase, an unplaced station, an unrealised second position, and a short purse', () => {
    const notSlice = upgradeStation(
      stockStationCapability(),
      'squat-rack',
      'quality',
      10_000,
      true,
      true,
    );
    expect(notSlice.kind).toBe('refused');
    if (notSlice.kind === 'refused') expect(notSlice.reason).toBe('not-upgradable');

    const once = upgradeStation(
      stockStationCapability(),
      BENCH,
      'quality',
      10_000,
      true,
      true,
    );
    expect(once.kind).toBe('upgraded');
    if (once.kind !== 'upgraded') return;
    const twice = upgradeStation(once.capability, BENCH, 'quality', 10_000, true, true);
    expect(twice.kind).toBe('refused');
    if (twice.kind === 'refused') expect(twice.reason).toBe('already-upgraded');

    const unplaced = upgradeStation(
      stockStationCapability(),
      BENCH,
      'quality',
      10_000,
      false,
      true,
    );
    expect(unplaced.kind).toBe('refused');
    if (unplaced.kind === 'refused') expect(unplaced.reason).toBe('not-placed');

    const boxed = upgradeStation(
      stockStationCapability(),
      BENCH,
      'capacity',
      10_000,
      true,
      false,
    );
    expect(boxed.kind).toBe('refused');
    if (boxed.kind === 'refused') expect(boxed.reason).toBe('no-second-position');

    const broke = upgradeStation(
      stockStationCapability(),
      BENCH,
      'quality',
      119,
      true,
      true,
    );
    expect(broke.kind).toBe('refused');
    if (broke.kind === 'refused') expect(broke.reason).toBe('not-enough-gym-bucks');
  });
});

describe('Stage D living-gym bottleneck — Quality vs Capacity vs Throughput vs stock', () => {
  const baseline = runBottleneck(stockStationCapability());
  const quality = runBottleneck(capabilityWith('quality'));
  const capacity = runBottleneck(capabilityWith('capacity'));
  const throughput = runBottleneck(capabilityWith('throughput'));

  it('stock is a real queue: one slot, somebody waiting, uses completing', () => {
    expect(baseline.slots).toBe(1);
    expect(baseline.maxUsing).toBe(1);
    expect(baseline.maxQueue).toBeGreaterThan(0);
    expect(baseline.completions).toBeGreaterThan(0);
    expect(baseline.meanUseTicks).toBeGreaterThan(0);
  });

  it('Quality matches stock on queue, occupancy, duration and completions, and doubles experience', () => {
    expect(quality.slots).toBe(baseline.slots);
    expect(quality.maxUsing).toBe(baseline.maxUsing);
    expect(quality.maxQueue).toBe(baseline.maxQueue);
    expect(quality.completions).toBe(baseline.completions);
    expect(quality.meanUseTicks).toBe(baseline.meanUseTicks);
    expect(quality.experience).toBe(
      baseline.experience *
        (T.STATION_QUALITY_TRAINING_EXPERIENCE / T.STATION_STOCK_TRAINING_EXPERIENCE),
    );
    expect(quality.experience).toBeGreaterThan(baseline.experience);
  });

  it('Capacity adds a real second seat, raises peak occupancy, and does not shorten a use', () => {
    expect(capacity.slots).toBe(2);
    expect(capacity.maxUsing).toBe(2);
    expect(capacity.maxUsing).toBeGreaterThan(baseline.maxUsing);
    expect(capacity.completions).toBeGreaterThan(baseline.completions);
    expect(capacity.maxQueue).toBeLessThan(baseline.maxQueue);
    // Start-tick hash spread moves a little when two seats fill on different
    // ticks; Capacity does not apply the throughput factor. The mean stays
    // near stock and far from Throughput's shortened service.
    expect(stationUseTicksFactor(capabilityWith('capacity'), 'fixed', BENCH)).toBe(1);
    expect(Math.abs(capacity.meanUseTicks - baseline.meanUseTicks)).toBeLessThan(
      (baseline.meanUseTicks - throughput.meanUseTicks) / 2,
    );
    expect(capacity.experience / capacity.completions).toBe(
      T.STATION_STOCK_TRAINING_EXPERIENCE,
    );
  });

  it('Throughput shortens real service time without adding a seat', () => {
    expect(throughput.slots).toBe(1);
    expect(throughput.maxUsing).toBe(1);
    expect(throughput.meanUseTicks).toBeLessThan(baseline.meanUseTicks);
    expect(throughput.completions).toBeGreaterThan(baseline.completions);
    expect(throughput.maxQueue).toBeLessThanOrEqual(baseline.maxQueue);
    expect(throughput.experience / throughput.completions).toBe(
      T.STATION_STOCK_TRAINING_EXPERIENCE,
    );
  });

  it('Capacity and Throughput relieve the queue by different physical means', () => {
    expect(capacity.maxUsing).toBeGreaterThan(throughput.maxUsing);
    expect(throughput.meanUseTicks).toBeLessThan(capacity.meanUseTicks);
    expect(capacity.slots).toBeGreaterThan(throughput.slots);
  });

  it('records the four reports for the GDD Stage D experiment', () => {
    expect({ baseline, quality, capacity, throughput }).toEqual({
      baseline: {
        slots: 1,
        completions: 5,
        maxQueue: 2,
        maxUsing: 1,
        meanUseTicks: 35.8,
        experience: 5,
      },
      quality: {
        slots: 1,
        completions: 5,
        maxQueue: 2,
        maxUsing: 1,
        meanUseTicks: 35.8,
        experience: 10,
      },
      capacity: {
        slots: 2,
        completions: 8,
        maxQueue: 1,
        maxUsing: 2,
        meanUseTicks: 35.125,
        experience: 8,
      },
      throughput: {
        slots: 1,
        completions: 8,
        maxQueue: 2,
        maxUsing: 1,
        meanUseTicks: 24.25,
        experience: 8,
      },
    });
  });
});

describe('Stage D Quality appeal — demand shifts when another station exists', () => {
  function twoStationFloor(): FloorState {
    return Object.freeze({
      rung: 'garage' as const,
      placements: Object.freeze({}),
      furniture: Object.freeze({
        'flat-bench': Object.freeze({ x: 6, y: 0 }),
        'power-bar': Object.freeze({ x: 0, y: 3 }),
      }),
    });
  }

  function twoStationContext(capability: StationCapabilityState): FloorSimContext {
    return {
      rung: 'garage',
      floor: twoStationFloor(),
      barbellOwned: [...T.LADDER_STARTING_EQUIPMENT],
      sessionOwned: [],
      capability,
    };
  }

  function demandByStation(capability: StationCapabilityState): {
    readonly benchCompletions: number;
    readonly barCompletions: number;
    readonly benchTargetTicks: number;
    readonly barTargetTicks: number;
  } {
    const context = twoStationContext(capability);
    let state = createFloorSimState(context, EXPERIMENT_SEED);
    let benchCompletions = 0;
    let barCompletions = 0;
    let benchTargetTicks = 0;
    let barTargetTicks = 0;
    for (let i = 0; i < EXPERIMENT_TICKS; i += 1) {
      const next = stepFloorSim(state, context);
      for (const member of next.members) {
        if (member.target !== null && member.target.kind === 'fixed') {
          if (member.target.item === BENCH) benchTargetTicks += 1;
          if (member.target.item === 'power-bar') barTargetTicks += 1;
        }
        const previous = state.members[member.index];
        if (previous === undefined || previous.target === null) continue;
        if (previous.state !== 'using' || member.state === 'using') continue;
        if (previous.target.kind !== 'fixed') continue;
        if (previous.target.item === BENCH) benchCompletions += 1;
        if (previous.target.item === 'power-bar') barCompletions += 1;
      }
      state = next;
    }
    return Object.freeze({
      benchCompletions,
      barCompletions,
      benchTargetTicks,
      barTargetTicks,
    });
  }

  it('Quality on the far bench pulls demand onto the bench without adding a seat', () => {
    const stock = demandByStation(stockStationCapability());
    const quality = demandByStation(capabilityWith('quality'));
    expect(stationCapacitySlots(capabilityWith('quality'), 'fixed', BENCH)).toBe(1);
    expect(stationUseTicksFactor(capabilityWith('quality'), 'fixed', BENCH)).toBe(1);
    expect(stock.barTargetTicks).toBeGreaterThan(0);
    expect(quality.benchTargetTicks).toBeGreaterThan(stock.benchTargetTicks);
    expect({ stock, quality }).toEqual({
      stock: {
        benchCompletions: 5,
        barCompletions: 6,
        benchTargetTicks: 205,
        barTargetTicks: 440,
      },
      quality: {
        benchCompletions: 6,
        barCompletions: 5,
        benchTargetTicks: 440,
        barTargetTicks: 205,
      },
    });
    expect(quality.benchCompletions + quality.barCompletions).toBeGreaterThan(0);
  });
});

describe('Stage D D-DEBT — stored / unplaced equipment currently wears', () => {
  it('withWear keys off ownership, not placement: the management model never sees the floor', () => {
    const opening = createManagedGym();
    const richGym = withLadder(
      opening.gym,
      Object.freeze({ ...opening.gym.ladder, gymBucks: 100000 }),
    );
    const bought = buySessionEquipment(richGym, 'mats');
    if (bought.kind !== 'bought') throw new Error('fixture could not buy mats');
    const owned = withUpdatedGym(opening, bought.state);
    expect(ownedItemsOf(owned.gym)).toContain('mats');
    expect(ownedItemsOf(owned.gym)).toContain('flat-bench');
    const beforeMats = itemCondition(owned, 'mats');
    const beforeBench = itemCondition(owned, 'flat-bench');
    expect(beforeMats).toBe(1);
    expect(beforeBench).toBe(1);
    const after = managedCheckIn(owned, owned.gym.ladder.collectedAt + 3600, 'online');
    const matDelta = beforeMats - itemCondition(after.state, 'mats');
    const benchDelta = beforeBench - itemCondition(after.state, 'flat-bench');
    expect(matDelta).toBeGreaterThan(0);
    expect(benchDelta).toBeGreaterThan(0);
    expect(matDelta).toBeCloseTo(benchDelta);
    // ManagedGym has no FloorState field. Unplaced session gear cannot be
    // spared, because wear never asks whether the item is on the floor.
    expect('floor' in after.state).toBe(false);
  });
});
