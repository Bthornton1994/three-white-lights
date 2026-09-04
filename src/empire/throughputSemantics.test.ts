/**
 * throughputSemantics.test.ts — GDD §5.18 Stage D2.1B.
 *
 * Throughput is a station-level plate changeover, not a shorter set.
 * This file is the closed-loop visibility, live-purchase, C-vs-T
 * distinction, and opening-agency catcher. Quality numbers stay closed.
 */

import { describe, expect, it } from 'vitest';

import { EMPIRE_TUNING } from './empireTuning';
import { createFloorState } from './floor';
import {
  createFloorSimState,
  floorStations,
  seatChangeoverTicks,
  stationChangeoverSeats,
  stepFloorSim,
  withAmbientLivingPopulation,
  type FloorSimContext,
  type FloorSimMember,
  type FloorSimState,
  type FloorStationRef,
} from './floorSim';
import {
  stationChangeoverTicks,
  stationUpgradeCostGymBucks,
  stationUseTicksFactor,
  stockStationCapability,
  upgradeStation,
  type StationCapabilityState,
  type StationUpgradeAxis,
} from './stationCapability';
import { COMPETITION_BENCH_BAY } from './trainingStation';

const T = EMPIRE_TUNING;
const BAY = COMPETITION_BENCH_BAY;
const BAY_REF: FloorStationRef = Object.freeze({ kind: 'training', station: BAY });
const HORIZON = 240;
const SEED = 1;
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

function purchased(axis: StationUpgradeAxis): StationCapabilityState {
  const preview = upgradeStation(stockStationCapability(), BAY, axis, 10_000, true, true);
  if (preview.kind !== 'upgraded') throw new Error(`fixture could not purchase ${axis}`);
  return preview.capability;
}

function asPowerlifters(state: FloorSimState): FloorSimState {
  const members: FloorSimMember[] = [];
  for (const member of state.members) {
    members.push(Object.freeze({ ...member, type: 'powerlifter' }));
  }
  return Object.freeze({ ...state, members: Object.freeze(members) });
}

interface HorizonReport {
  readonly completions: number;
  readonly usesStarted: number;
  readonly usesFinished: number;
  readonly meanUseTicks: number;
  readonly meanWaitTicks: number;
  readonly waitingPersonTicks: number;
  readonly queueCountSum: number;
  readonly idleTicks: number;
  readonly loadingTicks: number;
  readonly maxUsing: number;
  readonly maxQueue: number;
  readonly maxLoading: number;
  readonly dualUsingTicks: number;
}

function horizon(capability: StationCapabilityState): HorizonReport {
  const context = openingContext(capability);
  const station = floorStations(context).find(
    (row) => row.ref.kind === 'training' && row.ref.station === BAY,
  );
  if (station === undefined) throw new Error('fixture lost the bay');
  let state = asPowerlifters(createFloorSimState(context, SEED));
  let completions = 0;
  let usesStarted = 0;
  let usesFinished = 0;
  let useTicksSum = 0;
  let useTicksCount = 0;
  let waitTicksSum = 0;
  let waitVisits = 0;
  let waitingPersonTicks = 0;
  let queueCountSum = 0;
  let idleTicks = 0;
  let loadingTicks = 0;
  let maxUsing = 0;
  let maxQueue = 0;
  let maxLoading = 0;
  let dualUsingTicks = 0;
  const opened = new Map<number, number>();
  const waitOpened = new Map<number, number>();
  for (let i = 0; i < HORIZON; i += 1) {
    const next = asPowerlifters(stepFloorSim(state, context));
    let using = 0;
    let waiting = 0;
    for (const member of next.members) {
      const previous = state.members[member.index];
      if (previous === undefined) continue;
      if (member.state === 'using' && previous.state !== 'using') {
        usesStarted += 1;
        opened.set(member.index, member.timer);
        const waited = waitOpened.get(member.index);
        if (waited !== undefined) {
          waitTicksSum += next.tick - waited;
          waitVisits += 1;
          waitOpened.delete(member.index);
        }
      }
      if (previous.state === 'using' && member.state !== 'using') {
        usesFinished += 1;
        completions += 1;
        const started = opened.get(member.index);
        if (started !== undefined) {
          useTicksSum += started;
          useTicksCount += 1;
        }
      }
      if (
        (member.state === 'seeking' || member.state === 'queuing') &&
        member.target !== null &&
        previous.target === null
      ) {
        waitOpened.set(member.index, next.tick);
      }
      if (member.target !== null && member.target.kind === 'training') {
        if (member.state === 'using') using += 1;
        if (member.state === 'seeking' || member.state === 'queuing') waiting += 1;
      }
    }
    const loading = stationChangeoverSeats(next.changeovers, BAY_REF, station.useCells);
    waitingPersonTicks += waiting;
    queueCountSum += waiting;
    maxUsing = Math.max(maxUsing, using);
    maxQueue = Math.max(maxQueue, waiting);
    maxLoading = Math.max(maxLoading, loading);
    if (using >= 2) dualUsingTicks += 1;
    if (using === 0 && loading === 0) idleTicks += 1;
    if (loading > 0) loadingTicks += 1;
    state = next;
  }
  return Object.freeze({
    completions,
    usesStarted,
    usesFinished,
    meanUseTicks: useTicksCount === 0 ? 0 : useTicksSum / useTicksCount,
    meanWaitTicks: waitVisits === 0 ? 0 : waitTicksSum / waitVisits,
    waitingPersonTicks,
    queueCountSum,
    idleTicks,
    loadingTicks,
    maxUsing,
    maxQueue,
    maxLoading,
    dualUsingTicks,
  });
}

describe('D2.1B Throughput is plate changeover, not a shorter set', () => {
  it('stock changeover is 18, plate tree is 6, use factor stays 1', () => {
    const stock = stockStationCapability();
    const tree = purchased('throughput');
    expect(stationUseTicksFactor(stock, 'training', BAY)).toBe(1);
    expect(stationUseTicksFactor(tree, 'training', BAY)).toBe(1);
    expect(stationChangeoverTicks(stock, 'training', BAY)).toBe(18);
    expect(stationChangeoverTicks(tree, 'training', BAY)).toBe(6);
    expect(stationChangeoverTicks(stock, 'session', 'mats')).toBe(0);
    expect(T.FLOOR_SIM_STATION_CHANGEOVER_TICKS).toBe(18);
    expect(T.STATION_THROUGHPUT_CHANGEOVER_TICKS).toBe(6);
  });

  it('Throughput costs 30, Capacity 180, Quality 120 — first queue action is 30 watched minutes', () => {
    const rate = T.LADDER_INCOME_GYM_BUCKS_PER_HOUR.garage;
    expect(rate).toBe(60);
    expect(stationUpgradeCostGymBucks('throughput')).toBe(30);
    expect(stationUpgradeCostGymBucks('capacity')).toBe(180);
    expect(stationUpgradeCostGymBucks('quality')).toBe(120);
    const watcherMinutesT = (30 / rate) * 60;
    const watcherMinutesC = (180 / rate) * 60;
    const watcherMinutesQ = (120 / rate) * 60;
    expect(watcherMinutesT).toBe(30);
    expect(watcherMinutesC).toBe(180);
    expect(watcherMinutesQ).toBe(120);
    expect(watcherMinutesT).toBeLessThan(watcherMinutesQ);
    expect(watcherMinutesT).toBeLessThan(watcherMinutesC);
    const plusOneHour = T.LADDER_DEV_TIME_STEPS_SECONDS[0] / T.SECONDS_PER_HOUR;
    expect(plusOneHour * rate).toBeGreaterThanOrEqual(30);
    expect(plusOneHour * rate).toBeLessThan(180);
  });
});

describe('D2.1B closed loop and C-vs-T on the opening garage', () => {
  const stock = horizon(stockStationCapability());
  const tree = horizon(purchased('throughput'));
  const capacity = horizon(purchased('capacity'));

  it('stock still reads as one trainer and a queue — changeover does not add a seat', () => {
    expect(stock.maxUsing).toBe(1);
    expect(stock.maxQueue).toBeGreaterThanOrEqual(2);
    expect(stock.dualUsingTicks).toBe(0);
    expect(stock.loadingTicks).toBeGreaterThan(0);
    expect(stock.maxLoading).toBe(1);
  });

  it('Throughput keeps one seat, shortens loading, does not shorten the set', () => {
    expect(tree.maxUsing).toBe(1);
    expect(tree.dualUsingTicks).toBe(0);
    expect(Math.abs(tree.meanUseTicks - stock.meanUseTicks)).toBeLessThan(1);
    expect(tree.loadingTicks).toBeLessThan(stock.loadingTicks);
    expect(tree.completions).toBeGreaterThan(stock.completions);
    expect(tree.waitingPersonTicks).toBeLessThan(stock.waitingPersonTicks);
  });

  it('Capacity is the second body; Throughput is not', () => {
    expect(capacity.maxUsing).toBe(2);
    expect(capacity.dualUsingTicks).toBeGreaterThan(0);
    expect(tree.maxUsing).toBe(1);
    expect(capacity.completions).toBeGreaterThanOrEqual(tree.completions);
    expect(capacity.waitingPersonTicks).toBeLessThan(tree.waitingPersonTicks);
  });

  it('pins the 240-tick opening-garage reports so a retune reddens', () => {
    expect({ stock, tree, capacity }).toEqual({
      stock: {
        completions: 4,
        usesStarted: 5,
        usesFinished: 4,
        meanUseTicks: 36.5,
        meanWaitTicks: 109.25,
        waitingPersonTicks: 540,
        queueCountSum: 540,
        idleTicks: 16,
        loadingTicks: 72,
        maxUsing: 1,
        maxQueue: 3,
        maxLoading: 1,
        dualUsingTicks: 0,
      },
      tree: {
        completions: 5,
        usesStarted: 6,
        usesFinished: 5,
        meanUseTicks: 36.6,
        meanWaitTicks: 85.2,
        waitingPersonTicks: 495,
        queueCountSum: 495,
        idleTicks: 20,
        loadingTicks: 30,
        maxUsing: 1,
        maxQueue: 3,
        maxLoading: 1,
        dualUsingTicks: 0,
      },
      capacity: {
        completions: 5,
        usesStarted: 7,
        usesFinished: 5,
        meanUseTicks: 34,
        meanWaitTicks: 53.142857142857146,
        waitingPersonTicks: 448,
        queueCountSum: 448,
        idleTicks: 38,
        loadingTicks: 78,
        maxUsing: 2,
        maxQueue: 3,
        maxLoading: 2,
        dualUsingTicks: 72,
      },
    });
  });
});

describe('D2.1B live Throughput purchase', () => {
  function untilUsing(context: FloorSimContext): FloorSimState {
    let state = asPowerlifters(createFloorSimState(context, SEED));
    for (let i = 0; i < 120; i += 1) {
      state = asPowerlifters(stepFloorSim(state, context));
      if (state.members.some((member) => member.state === 'using')) return state;
    }
    throw new Error('nobody started using');
  }

  function untilChangeover(context: FloorSimContext): FloorSimState {
    let state = asPowerlifters(createFloorSimState(context, SEED));
    for (let i = 0; i < 200; i += 1) {
      state = asPowerlifters(stepFloorSim(state, context));
      if (Object.keys(state.changeovers).length > 0) return state;
    }
    throw new Error('no changeover armed');
  }

  it('buying Throughput mid-set does not shorten the current user timer', () => {
    const stock = openingContext(stockStationCapability());
    const tree = openingContext(purchased('throughput'));
    const using = untilUsing(stock);
    const user = using.members.find((member) => member.state === 'using');
    if (user === undefined) throw new Error('lost the user');
    const next = asPowerlifters(stepFloorSim(using, tree));
    const after = next.members.find((member) => member.index === user.index);
    if (after === undefined) throw new Error('lost the user after purchase');
    expect(after.state).toBe('using');
    expect(after.timer).toBe(user.timer - 1);
  });

  it('the next physically relevant beat after a live buy is a 6-tick changeover', () => {
    const stock = openingContext(stockStationCapability());
    const tree = openingContext(purchased('throughput'));
    const using = untilUsing(stock);
    let state = using;
    let armed: number | null = null;
    for (let i = 0; i < 80; i += 1) {
      const next = asPowerlifters(stepFloorSim(state, tree));
      const keys = Object.keys(next.changeovers);
      if (keys.length > 0 && Object.keys(state.changeovers).length === 0) {
        armed = next.changeovers[keys[0] as string] as number;
        break;
      }
      state = next;
    }
    expect(armed).toBe(T.STATION_THROUGHPUT_CHANGEOVER_TICKS);
  });

  it('an in-flight stock changeover is capped at the plate-tree duration', () => {
    const stock = openingContext(stockStationCapability());
    const tree = openingContext(purchased('throughput'));
    const loading = untilChangeover(stock);
    const before = Object.values(loading.changeovers)[0] as number;
    expect(before).toBeGreaterThan(T.STATION_THROUGHPUT_CHANGEOVER_TICKS);
    const next = asPowerlifters(stepFloorSim(loading, tree));
    const after = Object.values(next.changeovers)[0] as number | undefined;
    expect(after).toBe(T.STATION_THROUGHPUT_CHANGEOVER_TICKS);
  });

  it('stock changeover arms at 18 and the seat is reserved while it runs', () => {
    const stock = openingContext(stockStationCapability());
    const loading = untilChangeover(stock);
    const remaining = Object.values(loading.changeovers)[0] as number;
    expect(remaining).toBe(T.FLOOR_SIM_STATION_CHANGEOVER_TICKS);
    const station = floorStations(stock).find(
      (row) => row.ref.kind === 'training' && row.ref.station === BAY,
    );
    if (station === undefined) throw new Error('lost the bay');
    expect(stationChangeoverSeats(loading.changeovers, BAY_REF, station.useCells)).toBe(1);
    const primary = station.useCells[0];
    if (primary === undefined) throw new Error('lost the seat');
    expect(seatChangeoverTicks(loading.changeovers, BAY_REF, primary)).toBe(18);
    const usingDuring = loading.members.filter((member) => member.state === 'using').length;
    expect(usingDuring).toBe(0);
  });
});
