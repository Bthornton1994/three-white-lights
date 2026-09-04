/**
 * stationCapability.test.ts — GDD §5.18 Stage D.1 Q/C/T on the Competition
 * Bench Bay, not on equipment SKUs.
 *
 * Proves the three axes are distinct mechanisms, not one "better station"
 * scalar. The bottleneck experiment runs the opening garage / complete bay /
 * three powerlifters under stock, Quality-only, Capacity-only and
 * Throughput-only. D2-TRUTH-01: unplaced owned equipment does not wear on
 * the played composition; the management module without a floor still wears
 * all owned when `inService` is omitted.
 */

import { describe, expect, it } from 'vitest';

import { EMPIRE_TUNING } from './empireTuning';
import { createFloorState, placeFloorItem, placedOwnedItems, type FloorState } from './floor';
import {
  createGymViewState,
  gymViewReduce,
} from './ladderView';
import {
  createFloorSimState,
  floorStations,
  stationOccupancy,
  stepFloorSim,
  withAmbientLivingPopulation,
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
  stationChangeoverTicks,
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
  return withAmbientLivingPopulation({
    rung: 'garage',
    floor: createFloorState('garage'),
    barbellOwned: OWNED,
    sessionOwned: [],
    capability,
  });
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
    expect(stationUpgradeCostGymBucks('throughput')).toBe(30);
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

  it('Throughput shortens plate changeover and does not add a slot, raise experience, or shorten a set', () => {
    const throughput = capabilityWith('throughput');
    const stock = stockStationCapability();
    expect(stationCapacitySlots(throughput, 'training', BAY)).toBe(1);
    expect(stationUseTicksFactor(throughput, 'training', BAY)).toBe(1);
    expect(stationUseTicksFactor(stock, 'training', BAY)).toBe(1);
    expect(stationChangeoverTicks(stock, 'training', BAY)).toBe(
      T.FLOOR_SIM_STATION_CHANGEOVER_TICKS,
    );
    expect(stationChangeoverTicks(throughput, 'training', BAY)).toBe(
      T.STATION_THROUGHPUT_CHANGEOVER_TICKS,
    );
    expect(T.STATION_THROUGHPUT_CHANGEOVER_TICKS).toBeLessThan(
      T.FLOOR_SIM_STATION_CHANGEOVER_TICKS,
    );
    expect(T.STATION_THROUGHPUT_CHANGEOVER_TICKS).toBeGreaterThan(0);
    expect(stationChangeoverTicks(stock, 'session', 'mats')).toBe(0);
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
    expect(capacity.maxQueue).toBeLessThanOrEqual(baseline.maxQueue);
    expect(stationUseTicksFactor(capabilityWith('capacity'), 'training', BAY)).toBe(1);
    expect(capacity.meanUseTicks).toBeGreaterThan(
      T.FLOOR_SIM_USE_TICKS_BY_TYPE.powerlifter - 1,
    );
    expect(capacity.experience / capacity.completions).toBe(
      T.STATION_STOCK_TRAINING_EXPERIENCE,
    );
  });

  it('Throughput shortens plate changeover without adding a bench or shortening a use', () => {
    expect(throughput.physicalBays).toBe(1);
    expect(throughput.usablePositions).toBe(1);
    expect(throughput.floorCellsOccupied).toBe(8);
    expect(throughput.maxUsing).toBe(1);
    expect(Math.abs(throughput.meanUseTicks - baseline.meanUseTicks)).toBeLessThan(1);
    expect(throughput.completions).toBeGreaterThan(baseline.completions);
    expect(throughput.maxQueue).toBeLessThanOrEqual(baseline.maxQueue);
    expect(throughput.experience / throughput.completions).toBe(
      T.STATION_STOCK_TRAINING_EXPERIENCE,
    );
  });

  it('Capacity and Throughput relieve the queue by different physical means', () => {
    expect(capacity.maxUsing).toBeGreaterThan(throughput.maxUsing);
    expect(Math.abs(throughput.meanUseTicks - capacity.meanUseTicks)).toBeLessThan(
      Math.abs(capacity.meanUseTicks) + 1,
    );
    expect(capacity.physicalBays).toBeGreaterThan(throughput.physicalBays);
    expect(capacity.floorCellsOccupied).toBeGreaterThan(throughput.floorCellsOccupied);
    expect(
      stationChangeoverTicks(capabilityWith('throughput'), 'training', BAY),
    ).toBeLessThan(stationChangeoverTicks(stockStationCapability(), 'training', BAY));
  });

  it('records the four reports for the GDD Stage D.1 experiment', () => {
    expect({ baseline, quality, capacity, throughput }).toEqual({
      baseline: {
        physicalBays: 1,
        usablePositions: 1,
        floorCellsOccupied: 8,
        completions: 4,
        maxQueue: 3,
        maxUsing: 1,
        meanUseTicks: 36.5,
        experience: 4,
        targetDemand: 692,
      },
      quality: {
        physicalBays: 1,
        usablePositions: 1,
        floorCellsOccupied: 8,
        completions: 4,
        maxQueue: 3,
        maxUsing: 1,
        meanUseTicks: 36.5,
        experience: 8,
        targetDemand: 692,
      },
      capacity: {
        physicalBays: 2,
        usablePositions: 2,
        floorCellsOccupied: 16,
        completions: 5,
        maxQueue: 3,
        maxUsing: 2,
        meanUseTicks: 34,
        experience: 5,
        targetDemand: 685,
      },
      throughput: {
        physicalBays: 1,
        usablePositions: 1,
        floorCellsOccupied: 8,
        completions: 5,
        maxQueue: 3,
        maxUsing: 1,
        meanUseTicks: 36.6,
        experience: 5,
        targetDemand: 685,
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
    return withAmbientLivingPopulation({
      rung: 'garage',
      floor: withBars(),
      barbellOwned: OWNED,
      sessionOwned: ['specialty-bars'],
      capability,
    });
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
      bayCompletions: 4,
      barCompletions: 5,
      bayTargetTicks: 212,
      barTargetTicks: 445,
    });
    expect(quality).toEqual({
      bayCompletions: 4,
      barCompletions: 5,
      bayTargetTicks: 257,
      barTargetTicks: 400,
    });
  });
});

describe('Stage D2-TRUTH-01 — stored / unplaced equipment does not wear like placed', () => {
  it('management module without a floor still wears every owned item when inService is omitted', () => {
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
    expect('floor' in after.state).toBe(false);
  });

  it('unplaced equipment does not wear when inService is the placed set, and mats are not special-cased', () => {
    const opening = createManagedGym();
    const richGym = withLadder(
      opening.gym,
      Object.freeze({ ...opening.gym.ladder, gymBucks: 100000 }),
    );
    const bought = buySessionEquipment(richGym, 'mats');
    if (bought.kind !== 'bought') throw new Error('fixture could not buy mats');
    const owned = withUpdatedGym(opening, bought.state);
    const floor = createFloorState('garage');
    const inService = placedOwnedItems(floor, owned.gym.ladder.equipment, owned.gym.sessionEquipment);
    expect(inService).toContain('flat-bench');
    expect(inService).not.toContain('mats');
    const after = managedCheckIn(owned, owned.gym.ladder.collectedAt + 3600, 'online', inService);
    expect(itemCondition(after.state, 'mats')).toBe(1);
    expect(itemCondition(after.state, 'flat-bench')).toBeLessThan(1);
    const benchOff = Object.freeze({
      ...floor,
      furniture: Object.freeze({
        'power-bar': floor.furniture['power-bar'],
        'comp-plates': floor.furniture['comp-plates'],
      }),
    });
    const withoutBench = placedOwnedItems(
      benchOff,
      owned.gym.ladder.equipment,
      owned.gym.sessionEquipment,
    );
    expect(withoutBench).not.toContain('flat-bench');
    expect(withoutBench).not.toContain('mats');
    const afterBenchOff = managedCheckIn(
      owned,
      owned.gym.ladder.collectedAt + 3600,
      'online',
      withoutBench,
    );
    expect(itemCondition(afterBenchOff.state, 'flat-bench')).toBe(1);
    expect(itemCondition(afterBenchOff.state, 'mats')).toBe(1);
    expect(itemCondition(afterBenchOff.state, 'power-bar')).toBeLessThan(1);
  });

  it('gymViewReduce advance-clock wears placed kit and spares unplaced mats', () => {
    const opened = createGymViewState();
    const funded = Object.freeze({
      ...opened,
      managed: withUpdatedGym(
        opened.managed,
        withLadder(
          opened.managed.gym,
          Object.freeze({ ...opened.managed.gym.ladder, gymBucks: 100000 }),
        ),
      ),
    });
    const state = gymViewReduce(funded, { kind: 'buy-session', item: 'mats' });
    expect(state.lastRefusal).toBeNull();
    expect(state.managed.gym.sessionEquipment).toContain('mats');
    expect(state.floor.placements.mats).toBeUndefined();
    const beforeMats = itemCondition(state.managed, 'mats');
    const beforeBench = itemCondition(state.managed, 'flat-bench');
    const advanced = gymViewReduce(state, {
      kind: 'advance-clock',
      gapSeconds: 3600,
      mode: 'online',
    });
    expect(itemCondition(advanced.managed, 'mats')).toBe(beforeMats);
    expect(itemCondition(advanced.managed, 'flat-bench')).toBeLessThan(beforeBench);
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

describe('Stage D2.1A — live Capacity transition vs cold Capacity', () => {
  const LIVE_UPGRADE_TIMEOUT_TICKS = 80;

  function bayStationOf(context: FloorSimContext) {
    return floorStations(context).find(
      (row) => row.ref.kind === 'training' && row.ref.station === BAY,
    );
  }

  function occupancySnapshot(state: FloorSimState) {
    let using = 0;
    let waiting = 0;
    for (const member of state.members) {
      if (member.target === null || member.target.kind !== 'training') continue;
      if (member.state === 'using') using += 1;
      if (member.state === 'seeking' || member.state === 'queuing') waiting += 1;
    }
    return Object.freeze({ tick: state.tick, using, waiting });
  }

  function cellsOf(cells: readonly { readonly x: number; readonly y: number }[]) {
    return cells.map((cell) => `${cell.x},${cell.y}`);
  }

  function stepUntilStockQueue(
    stock: FloorSimContext,
  ): { readonly state: FloorSimState; readonly foundAt: number } | null {
    let state = asPowerlifters(createFloorSimState(stock, EXPERIMENT_SEED));
    for (let i = 0; i < 240; i += 1) {
      state = asPowerlifters(stepFloorSim(state, stock));
      const snap = occupancySnapshot(state);
      if (snap.using === 1 && snap.waiting >= 2) {
        return Object.freeze({ state, foundAt: state.tick });
      }
    }
    return null;
  }

  it('stock opening garage reaches 1 using / 2 waiting before a live Capacity buy', () => {
    const stock = openingContext(stockStationCapability());
    const queued = stepUntilStockQueue(stock);
    expect(queued).not.toBeNull();
    if (queued === null) return;
    const snap = occupancySnapshot(queued.state);
    expect(snap.using).toBe(1);
    expect(snap.waiting).toBeGreaterThanOrEqual(2);
    expect(queued.state.members).toHaveLength(3);
  });

  it('stock queue → buy Capacity live → second seat becomes occupied', () => {
    const stock = openingContext(stockStationCapability());
    const capacity = openingContext(capabilityWith('capacity'));
    const queued = stepUntilStockQueue(stock);
    expect(queued).not.toBeNull();
    if (queued === null) return;
    const beforeStation = bayStationOf(stock);
    const afterStation = bayStationOf(capacity);
    expect(beforeStation).toBeDefined();
    expect(afterStation).toBeDefined();
    if (beforeStation === undefined || afterStation === undefined) return;

    const purchaseTick = queued.state.tick;
    const purchaseWaiting = occupancySnapshot(queued.state).waiting;
    const originalUser = queued.state.members.find((member) => member.state === 'using');
    expect(originalUser).toBeDefined();
    let state = queued.state;
    let dualAt: number | null = null;
    let queueFellAt: number | null = null;
    let secondUser: number | null = null;
    let maxUsing = occupancySnapshot(state).using;
    let interrupted = 0;
    for (let i = 0; i < LIVE_UPGRADE_TIMEOUT_TICKS; i += 1) {
      state = asPowerlifters(stepFloorSim(state, capacity));
      const snap = occupancySnapshot(state);
      maxUsing = Math.max(maxUsing, snap.using);
      for (const member of state.members) {
        if (member.state === 'interrupted') interrupted += 1;
      }
      if (dualAt === null && snap.using >= 2) {
        dualAt = state.tick;
        for (const member of state.members) {
          const previous = queued.state.members[member.index];
          if (
            member.state === 'using' &&
            previous !== undefined &&
            previous.state !== 'using' &&
            member.target !== null &&
            member.target.kind === 'training'
          ) {
            secondUser = member.index;
            break;
          }
        }
      }
      if (queueFellAt === null && snap.waiting < purchaseWaiting) queueFellAt = state.tick;
      if (dualAt !== null && queueFellAt !== null) break;
    }

    let onSeat = 0;
    for (const member of state.members) {
      if (member.state !== 'using') continue;
      if (afterStation.useCells.some((cell) => cell.x === member.cell.x && cell.y === member.cell.y)) {
        onSeat += 1;
      }
    }

    const ticksToDual = dualAt === null ? null : dualAt - purchaseTick;
    const ticksToQueueFall = queueFellAt === null ? null : queueFellAt - purchaseTick;
    const originalStillUsing =
      dualAt !== null &&
      originalUser !== undefined &&
      ticksToDual !== null &&
      ticksToDual < originalUser.timer;

    expect({
      purchaseTick,
      beforeUseCells: cellsOf(beforeStation.useCells),
      afterUseCells: cellsOf(afterStation.useCells),
      stationPositionUnchanged: afterStation.position,
      ticksToDual,
      ticksToQueueFall,
      secondUser,
      maxUsing,
      onSeat,
      interrupted,
      originalStillUsing,
    }).toEqual({
      purchaseTick: 1,
      beforeUseCells: ['5,0'],
      afterUseCells: ['2,2', '7,0'],
      stationPositionUnchanged: { x: 3, y: 0 },
      ticksToDual: 4,
      ticksToQueueFall: 4,
      secondUser: 1,
      maxUsing: 2,
      onSeat: 2,
      interrupted: 0,
      originalStillUsing: true,
    });
  });

  it('compares cold Capacity against live-upgrade Capacity over 240 ticks', () => {
    const stock = openingContext(stockStationCapability());
    const capacity = openingContext(capabilityWith('capacity'));
    const queued = stepUntilStockQueue(stock);
    expect(queued).not.toBeNull();
    if (queued === null) return;

    function horizonFrom(start: FloorSimState, context: FloorSimContext, ticks: number) {
      let state = start;
      let dualAt: number | null = null;
      let dualOccupancyTicks = 0;
      let completions = 0;
      let maxQueue = 0;
      let queueSum = 0;
      let maxUsing = 0;
      let usingSum = 0;
      let interruptions = 0;
      let emptySeatWhileWaitTicks = 0;
      const station = bayStationOf(context);
      const seats = station === undefined ? 1 : station.useCells.length;
      for (let i = 0; i < ticks; i += 1) {
        const next = asPowerlifters(stepFloorSim(state, context));
        const snap = occupancySnapshot(next);
        if (dualAt === null && snap.using >= 2) dualAt = next.tick;
        if (snap.using >= 2) dualOccupancyTicks += 1;
        maxQueue = Math.max(maxQueue, snap.waiting);
        queueSum += snap.waiting;
        maxUsing = Math.max(maxUsing, snap.using);
        usingSum += snap.using;
        if (snap.waiting > 0 && snap.using < seats) emptySeatWhileWaitTicks += 1;
        for (const member of next.members) {
          if (member.state === 'interrupted') interruptions += 1;
          const previous = state.members[member.index];
          if (previous === undefined) continue;
          if (previous.state === 'using' && member.state !== 'using') completions += 1;
        }
        state = next;
      }
      return Object.freeze({
        dualAt,
        dualOccupancyTicks,
        completions,
        maxQueue,
        meanQueue: queueSum / ticks,
        maxUsing,
        meanUsing: usingSum / ticks,
        interruptions,
        emptySeatWhileWaitTicks,
      });
    }

    const live = horizonFrom(queued.state, capacity, EXPERIMENT_TICKS);
    const cold = horizonFrom(
      asPowerlifters(createFloorSimState(capacity, EXPERIMENT_SEED)),
      capacity,
      EXPERIMENT_TICKS,
    );
    const stockHorizon = horizonFrom(queued.state, stock, EXPERIMENT_TICKS);
    const throughputLive = horizonFrom(
      queued.state,
      openingContext(capabilityWith('throughput')),
      EXPERIMENT_TICKS,
    );

    // Cold-from-tick-zero is the D.1 proof and must stay a two-seat machine.
    // D2.1B stock changeover (18 ticks) moved cold completions 9 → 5; dual
    // occupancy and the 4-tick live fill are the D2.1A regression, not the
    // completion count.
    expect(cold.maxUsing).toBe(2);
    expect(cold.completions).toBe(5);
    // Live upgrade is the played path. Before the fix, dual occupancy waited
    // 31 ticks (a long walk to the far rebuilt seat) and completions matched
    // stock (6). After: second seat fills in 4 ticks, both bodies on use
    // cells, completions beat stock, occupancy never exceeds two.
    expect(live.maxUsing).toBe(2);
    expect(live.dualAt).toBe(5);
    expect(live.dualOccupancyTicks).toBe(77);
    expect(live.completions).toBe(5);
    expect(live.completions).toBeGreaterThan(stockHorizon.completions);
    expect(live.interruptions).toBe(0);
    expect(throughputLive.maxUsing).toBe(1);
    expect(stockHorizon.maxUsing).toBe(1);
  });
});
