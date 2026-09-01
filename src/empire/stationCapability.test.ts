/**
 * stationCapability.test.ts — GDD §5.18 Stage D.1 Q/C/T on the Competition
 * Bench Bay, not on equipment SKUs.
 *
 * Proves the three axes are distinct mechanisms, not one "better station"
 * scalar. The bottleneck experiment runs the opening garage / complete bay /
 * three powerlifters under stock, Quality-only, Capacity-only and
 * Throughput-only. Wear-on-unplaced is reproduced here as D-DEBT, not fixed.
 */

import { describe, expect, it } from 'vitest';

import { EMPIRE_TUNING } from './empireTuning';
import { createFloorState, placeFloorItem, type FloorState } from './floor';
import {
  createFloorSimState,
  floorStations,
  stationOccupancy,
  stepFloorSim,
  type FloorSimContext,
  type FloorSimMember,
  type FloorSimState,
  type FloorStationRef,
} from './floorSim';
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
import {
  COMPETITION_BENCH_BAY,
  bayOccupiedCells,
  competitionBenchBay,
} from './trainingStation';

const T = EMPIRE_TUNING;
const BAY = COMPETITION_BENCH_BAY;
const BAY_REF: FloorStationRef = Object.freeze({ kind: 'training', station: BAY });
const EXPERIMENT_TICKS = 240;
const EXPERIMENT_SEED = 1;
const OWNED = Object.freeze([...T.LADDER_STARTING_EQUIPMENT]);

function openingContext(capability: StationCapabilityState): FloorSimContext {
  return {
    rung: 'garage',
    floor: createFloorState('garage'),
    barbellOwned: OWNED,
    sessionOwned: [],
    capability,
  };
}

function capabilityWith(axis: StationUpgradeAxis): StationCapabilityState {
  const preview = upgradeStation(
    stockStationCapability(),
    BAY,
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

function asPowerlifters(state: FloorSimState): FloorSimState {
  const members: FloorSimMember[] = [];
  for (const member of state.members) {
    members.push(Object.freeze({ ...member, type: 'powerlifter' }));
  }
  return Object.freeze({ ...state, members: Object.freeze(members) });
}

interface BottleneckReport {
  readonly physicalBays: number;
  readonly usablePositions: number;
  readonly floorCellsOccupied: number;
  readonly completions: number;
  readonly maxQueue: number;
  readonly maxUsing: number;
  readonly meanUseTicks: number;
  readonly experience: number;
  readonly targetDemand: number;
}

function runBottleneck(capability: StationCapabilityState): BottleneckReport {
  const context = openingContext(capability);
  const stations = floorStations(context);
  const bayStation = stations.find(
    (row) => row.ref.kind === 'training' && row.ref.station === BAY,
  );
  if (bayStation === undefined) throw new Error('fixture lost the Competition Bench Bay');
  const bay = competitionBenchBay(
    context.floor,
    context.barbellOwned,
    stationLevels(capability, BAY).capacity,
  );
  let state = asPowerlifters(createFloorSimState(context, EXPERIMENT_SEED));
  let completions = 0;
  let maxQueue = 0;
  let maxUsing = 0;
  let useTicksSum = 0;
  let useTicksCount = 0;
  let targetDemand = 0;
  const opened = new Map<number, number>();
  for (let i = 0; i < EXPERIMENT_TICKS; i += 1) {
    const next = asPowerlifters(stepFloorSim(state, context));
    for (const member of next.members) {
      if (member.target !== null && member.target.kind === 'training') targetDemand += 1;
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
    maxUsing = Math.max(maxUsing, stationOccupancy(next.members, BAY_REF));
    let standing = 0;
    for (const member of next.members) {
      if (member.state !== 'queuing') continue;
      if (member.target === null || member.target.kind !== 'training') continue;
      standing += 1;
    }
    maxQueue = Math.max(maxQueue, standing);
    state = next;
  }
  return Object.freeze({
    physicalBays: bay.benches.length,
    usablePositions: bayStation.useCells.length,
    floorCellsOccupied: bayOccupiedCells(bay),
    completions,
    maxQueue,
    maxUsing,
    meanUseTicks: useTicksCount === 0 ? 0 : useTicksSum / useTicksCount,
    experience: completions * stationTrainingExperience(capability, 'training', BAY),
    targetDemand,
  });
}

describe('stationCapability.ts — GDD §5.18 Stage D.1 algebra', () => {
  it('opens at stock: empty map, one slot, identity duration, stock experience', () => {
    const stock = stockStationCapability();
    expect(stock).toEqual({});
    expect(stationLevels(stock, BAY)).toEqual({
      quality: 0,
      capacity: 0,
      throughput: 0,
    });
    expect(stationCapacitySlots(stock, 'training', BAY)).toBe(1);
    expect(stationUseTicksFactor(stock, 'training', BAY)).toBe(1);
    expect(stationTrainingExperience(stock, 'training', BAY)).toBe(
      T.STATION_STOCK_TRAINING_EXPERIENCE,
    );
  });

  it('the Stage D.1 slice is the Competition Bench Bay, not the starting SKUs', () => {
    expect([...T.STATION_UPGRADE_SLICE]).toEqual([BAY]);
    expect(isStationUpgradeSlice(BAY)).toBe(true);
    expect(isStationUpgradeSlice('flat-bench')).toBe(false);
    expect(isStationUpgradeSlice('power-bar')).toBe(false);
    expect(isStationUpgradeSlice('comp-plates')).toBe(false);
    expect(isStationUpgradeSlice('squat-rack')).toBe(false);
    expect(isStationUpgradeSlice('mats')).toBe(false);
  });

  it('session stations and leftover Barbell stay at stock even if a map is handed in', () => {
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
    expect(stationCapacitySlots(quality, 'fixed', 'flat-bench')).toBe(1);
    expect(stationQualityAffinityBonus(quality, 'fixed', 'flat-bench')).toBe(0);
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
    expect(stationCapacitySlots(quality, 'training', BAY)).toBe(1);
    expect(stationUseTicksFactor(quality, 'training', BAY)).toBe(1);
    expect(stationTrainingExperience(quality, 'training', BAY)).toBe(
      T.STATION_QUALITY_TRAINING_EXPERIENCE,
    );
    expect(T.STATION_QUALITY_TRAINING_EXPERIENCE).toBeGreaterThan(
      T.STATION_STOCK_TRAINING_EXPERIENCE,
    );
  });

  it('Capacity adds a real simultaneous slot and does not change duration or experience', () => {
    const capacity = capabilityWith('capacity');
    expect(stationCapacitySlots(capacity, 'training', BAY)).toBe(
      1 + T.STATION_CAPACITY_BONUS_SLOTS,
    );
    expect(stationUseTicksFactor(capacity, 'training', BAY)).toBe(1);
    expect(stationTrainingExperience(capacity, 'training', BAY)).toBe(
      T.STATION_STOCK_TRAINING_EXPERIENCE,
    );
  });

  it('Throughput shortens real service duration and does not add a slot or raise experience', () => {
    const throughput = capabilityWith('throughput');
    expect(stationCapacitySlots(throughput, 'training', BAY)).toBe(1);
    expect(stationUseTicksFactor(throughput, 'training', BAY)).toBe(
      T.STATION_THROUGHPUT_USE_TICKS_FACTOR,
    );
    expect(T.STATION_THROUGHPUT_USE_TICKS_FACTOR).toBeLessThan(1);
    expect(T.STATION_THROUGHPUT_USE_TICKS_FACTOR).toBeGreaterThan(0);
    expect(stationTrainingExperience(throughput, 'training', BAY)).toBe(
      T.STATION_STOCK_TRAINING_EXPERIENCE,
    );
  });

  it('upgradeStation grants the axis when the purse, placement and realised capacity allow it', () => {
    const outcome = upgradeStation(
      stockStationCapability(),
      BAY,
      'quality',
      120,
      true,
      true,
    );
    expect(outcome.kind).toBe('upgraded');
    if (outcome.kind !== 'upgraded') return;
    expect(outcome.costGymBucks).toBe(120);
    expect(stationLevels(outcome.capability, BAY).quality).toBe(1);
    expect(stationLevels(outcome.capability, BAY).capacity).toBe(0);
    expect(stationLevels(outcome.capability, BAY).throughput).toBe(0);
  });

  it('refuses a non-slice item, a second purchase, an unplaced station, an unrealised second bench, and a short purse', () => {
    const notSlice = upgradeStation(
      stockStationCapability(),
      'flat-bench',
      'quality',
      10_000,
      true,
      true,
    );
    expect(notSlice.kind).toBe('refused');
    if (notSlice.kind === 'refused') expect(notSlice.reason).toBe('not-upgradable');

    const once = upgradeStation(
      stockStationCapability(),
      BAY,
      'quality',
      10_000,
      true,
      true,
    );
    expect(once.kind).toBe('upgraded');
    if (once.kind !== 'upgraded') return;
    const twice = upgradeStation(once.capability, BAY, 'quality', 10_000, true, true);
    expect(twice.kind).toBe('refused');
    if (twice.kind === 'refused') expect(twice.reason).toBe('already-upgraded');

    const unplaced = upgradeStation(
      stockStationCapability(),
      BAY,
      'quality',
      10_000,
      false,
      true,
    );
    expect(unplaced.kind).toBe('refused');
    if (unplaced.kind === 'refused') expect(unplaced.reason).toBe('not-placed');

    const boxed = upgradeStation(
      stockStationCapability(),
      BAY,
      'capacity',
      10_000,
      true,
      false,
    );
    expect(boxed.kind).toBe('refused');
    if (boxed.kind === 'refused') expect(boxed.reason).toBe('no-second-position');

    const broke = upgradeStation(
      stockStationCapability(),
      BAY,
      'quality',
      119,
      true,
      true,
    );
    expect(broke.kind).toBe('refused');
    if (broke.kind === 'refused') expect(broke.reason).toBe('not-enough-gym-bucks');
  });
});

describe('Stage D.1 living-gym bottleneck — Quality vs Capacity vs Throughput vs stock', () => {
  const baseline = runBottleneck(stockStationCapability());
  const quality = runBottleneck(capabilityWith('quality'));
  const capacity = runBottleneck(capabilityWith('capacity'));
  const throughput = runBottleneck(capabilityWith('throughput'));

  it('stock is a real queue: one bay, one position, somebody waiting, uses completing', () => {
    expect(baseline.physicalBays).toBe(1);
    expect(baseline.usablePositions).toBe(1);
    expect(baseline.floorCellsOccupied).toBe(8);
    expect(baseline.maxUsing).toBe(1);
    expect(baseline.maxQueue).toBeGreaterThan(0);
    expect(baseline.completions).toBeGreaterThan(0);
    expect(baseline.meanUseTicks).toBeGreaterThan(0);
  });

  it('Quality matches stock on bays, occupancy, duration and completions, and doubles experience', () => {
    expect(quality.physicalBays).toBe(baseline.physicalBays);
    expect(quality.usablePositions).toBe(baseline.usablePositions);
    expect(quality.floorCellsOccupied).toBe(baseline.floorCellsOccupied);
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

  it('Capacity adds a real second bench, raises peak occupancy, and does not shorten a use', () => {
    expect(capacity.physicalBays).toBe(2);
    expect(capacity.usablePositions).toBe(2);
    expect(capacity.floorCellsOccupied).toBe(16);
    expect(capacity.maxUsing).toBe(2);
    expect(capacity.maxUsing).toBeGreaterThan(baseline.maxUsing);
    expect(capacity.completions).toBeGreaterThan(baseline.completions);
    expect(capacity.maxQueue).toBeLessThan(baseline.maxQueue);
    expect(stationUseTicksFactor(capabilityWith('capacity'), 'training', BAY)).toBe(1);
    expect(Math.abs(capacity.meanUseTicks - baseline.meanUseTicks)).toBeLessThan(
      (baseline.meanUseTicks - throughput.meanUseTicks) / 2,
    );
    expect(capacity.experience / capacity.completions).toBe(
      T.STATION_STOCK_TRAINING_EXPERIENCE,
    );
  });

  it('Throughput shortens real service time without adding a bench', () => {
    expect(throughput.physicalBays).toBe(1);
    expect(throughput.usablePositions).toBe(1);
    expect(throughput.floorCellsOccupied).toBe(8);
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
    expect(capacity.physicalBays).toBeGreaterThan(throughput.physicalBays);
    expect(capacity.floorCellsOccupied).toBeGreaterThan(throughput.floorCellsOccupied);
  });

  it('records the four reports for the GDD Stage D.1 experiment', () => {
    expect({ baseline, quality, capacity, throughput }).toEqual({
      baseline: {
        physicalBays: 1,
        usablePositions: 1,
        floorCellsOccupied: 8,
        completions: 6,
        maxQueue: 2,
        maxUsing: 1,
        meanUseTicks: 35.666666666666664,
        experience: 6,
        targetDemand: 679,
      },
      quality: {
        physicalBays: 1,
        usablePositions: 1,
        floorCellsOccupied: 8,
        completions: 6,
        maxQueue: 2,
        maxUsing: 1,
        meanUseTicks: 35.666666666666664,
        experience: 12,
        targetDemand: 679,
      },
      capacity: {
        physicalBays: 2,
        usablePositions: 2,
        floorCellsOccupied: 16,
        completions: 9,
        maxQueue: 1,
        maxUsing: 2,
        meanUseTicks: 37.111111111111114,
        experience: 9,
        targetDemand: 657,
      },
      throughput: {
        physicalBays: 1,
        usablePositions: 1,
        floorCellsOccupied: 8,
        completions: 9,
        maxQueue: 2,
        maxUsing: 1,
        meanUseTicks: 23,
        experience: 9,
        targetDemand: 663,
      },
    });
  });
});

describe('Stage D.1 Quality appeal — demand shifts when another station exists', () => {
  function withBars(): FloorState {
    const opening = createFloorState('garage');
    const placed = placeFloorItem(opening, ['specialty-bars'], 'specialty-bars', { x: 7, y: 3 });
    if (placed.kind !== 'placed') throw new Error('fixture could not place specialty-bars');
    return placed.state;
  }

  function barsContext(capability: StationCapabilityState): FloorSimContext {
    return {
      rung: 'garage',
      floor: withBars(),
      barbellOwned: OWNED,
      sessionOwned: ['specialty-bars'],
      capability,
    };
  }

  function demandByStation(capability: StationCapabilityState): {
    readonly bayCompletions: number;
    readonly barCompletions: number;
    readonly bayTargetTicks: number;
    readonly barTargetTicks: number;
  } {
    const context = barsContext(capability);
    let state = asPowerlifters(createFloorSimState(context, EXPERIMENT_SEED));
    let bayCompletions = 0;
    let barCompletions = 0;
    let bayTargetTicks = 0;
    let barTargetTicks = 0;
    for (let i = 0; i < EXPERIMENT_TICKS; i += 1) {
      const next = asPowerlifters(stepFloorSim(state, context));
      for (const member of next.members) {
        if (member.target !== null && member.target.kind === 'training') bayTargetTicks += 1;
        if (
          member.target !== null &&
          member.target.kind === 'session' &&
          member.target.item === 'specialty-bars'
        ) {
          barTargetTicks += 1;
        }
        const previous = state.members[member.index];
        if (previous === undefined || previous.target === null) continue;
        if (previous.state !== 'using' || member.state === 'using') continue;
        if (previous.target.kind === 'training') bayCompletions += 1;
        if (previous.target.kind === 'session' && previous.target.item === 'specialty-bars') {
          barCompletions += 1;
        }
      }
      state = next;
    }
    return Object.freeze({
      bayCompletions,
      barCompletions,
      bayTargetTicks,
      barTargetTicks,
    });
  }

  it('Quality on the bay pulls demand onto the bay without adding a bench', () => {
    const stock = demandByStation(stockStationCapability());
    const quality = demandByStation(capabilityWith('quality'));
    expect(stationCapacitySlots(capabilityWith('quality'), 'training', BAY)).toBe(1);
    expect(stationUseTicksFactor(capabilityWith('quality'), 'training', BAY)).toBe(1);
    expect(stock.barTargetTicks).toBeGreaterThan(0);
    expect(quality.bayTargetTicks).toBeGreaterThan(stock.bayTargetTicks);
    expect(quality.bayCompletions + quality.barCompletions).toBeGreaterThan(0);
    expect(stock).toEqual({
      bayCompletions: 5,
      barCompletions: 5,
      bayTargetTicks: 205,
      barTargetTicks: 445,
    });
    expect(quality).toEqual({
      bayCompletions: 6,
      barCompletions: 4,
      bayTargetTicks: 440,
      barTargetTicks: 212,
    });
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

describe('Stage D.1 incomplete bay — members interrupt honestly', () => {
  it('removing a required component drops the bay and interrupts anyone targeting it', () => {
    const complete = openingContext(stockStationCapability());
    let state = asPowerlifters(createFloorSimState(complete, EXPERIMENT_SEED));
    for (let i = 0; i < 80; i += 1) {
      state = asPowerlifters(stepFloorSim(state, complete));
    }
    const targeting = state.members.some(
      (member) => member.target !== null && member.target.kind === 'training',
    );
    expect(targeting).toBe(true);
    const opening = complete.floor;
    const incompleteFloor: FloorState = Object.freeze({
      ...opening,
      furniture: Object.freeze({
        'flat-bench': opening.furniture['flat-bench'],
        'power-bar': opening.furniture['power-bar'],
      }),
    });
    const incomplete: FloorSimContext = {
      ...complete,
      floor: incompleteFloor,
    };
    expect(floorStations(incomplete).some((row) => row.ref.kind === 'training')).toBe(false);
    const next = asPowerlifters(stepFloorSim(state, incomplete));
    const interrupted = next.members.filter((member) => member.state === 'interrupted');
    expect(interrupted.length).toBeGreaterThan(0);
    expect(interrupted.some((member) => member.interruptedBy === 'target-removed')).toBe(true);
  });
});
