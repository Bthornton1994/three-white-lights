/**
 * worldView.test.ts — living-world projector: sim truth to world occupancy.
 *
 * TECHNICAL PASS only. These checks prove the mapping, the no-teleport walk,
 * and one-member/one-station occupancy. They do not prove the gym feels alive.
 */

import { describe, expect, it } from 'vitest';

import { EMPIRE_TUNING } from './empireTuning';
import {
  createFloorState,
  type GridPosition,
} from './floor';
import {
  createFloorSimState,
  floorStations,
  stepFloorSim,
  type FloorSimContext,
  type FloorSimMember,
  type FloorSimMemberState,
  type FloorSimState,
  type FloorStation,
  type FloorStationRef,
} from './floorSim';
import { type LadderEquipmentItem } from './ladder';
import {
  createLivingMemberRoster,
  floorSimPopulationFromRoster,
} from './livingMembers';
import { stockStationCapability } from './stationCapability';
import {
  WORLD_MEMBER_ACTIVITIES,
  WORLD_STATION_OCCUPANCIES,
  memberWorldActivity,
  memberWorldPoint,
  worldFrame,
  worldMemberView,
  worldStationView,
} from './worldView';

const T = EMPIRE_TUNING;
const KIT: readonly LadderEquipmentItem[] = Object.freeze([...T.LADDER_STARTING_EQUIPMENT]);
const BENCH: FloorStationRef = Object.freeze({
  kind: 'training',
  station: 'competition-bench-bay',
});

function memberAt(
  index: number,
  state: FloorSimMemberState,
  target: FloorStationRef | null,
  cell: GridPosition = Object.freeze({ x: 0, y: 0 }),
  extras: Partial<FloorSimMember> = {},
): FloorSimMember {
  return Object.freeze({
    memberId: `member:n0:${index}`,
    index,
    type: 'powerlifter',
    state,
    cell,
    next: extras.next ?? null,
    progress: extras.progress ?? 0,
    target,
    targetPosition: target === null ? null : Object.freeze({ x: 0, y: 0 }),
    claimedAt: target === null ? null : 0,
    queuedAt: extras.queuedAt ?? null,
    queueArrivedAt: extras.queueArrivedAt ?? null,
    timer: extras.timer ?? 0,
    interruptedBy: extras.interruptedBy ?? null,
    awayFrom: extras.awayFrom ?? null,
    strandedAt: extras.strandedAt ?? null,
    usingStartedAt: extras.usingStartedAt ?? null,
  });
}

function garageContext(): FloorSimContext {
  const roster = createLivingMemberRoster('garage', KIT, [], 0, T.FLOOR_SIM_RENDER_SEED);
  return Object.freeze({
    rung: 'garage',
    floor: createFloorState('garage'),
    barbellOwned: KIT,
    sessionOwned: Object.freeze([]),
    capability: stockStationCapability(),
    livingPopulation: floorSimPopulationFromRoster(roster),
  });
}

function stationAt(
  ref: FloorStationRef,
  position: GridPosition,
  useCell: GridPosition,
  queueCells: readonly GridPosition[],
): FloorStation {
  return Object.freeze({
    ref,
    position,
    footprint: Object.freeze({ width: 2, height: 1 }),
    useCell,
    useCells: Object.freeze([useCell]),
    queueCells: Object.freeze(queueCells),
  });
}

describe('worldView.ts — living gym projector', () => {
  it('keeps the world activity and occupancy vocabularies closed', () => {
    expect([...WORLD_MEMBER_ACTIVITIES]).toEqual([
      'walking',
      'waiting',
      'using',
      'leaving',
      'interrupted',
      'stranded',
    ]);
    expect([...WORLD_STATION_OCCUPANCIES]).toEqual([
      'available',
      'approaching',
      'queued',
      'occupied',
      'changeover',
    ]);
  });

  it('lerps a walking member between cell and next rather than snapping', () => {
    const member = memberAt(0, 'seeking', BENCH, Object.freeze({ x: 1, y: 2 }), {
      next: Object.freeze({ x: 2, y: 2 }),
      progress: 0.5,
    });
    expect(memberWorldPoint(member)).toEqual({ x: 1.5, y: 2 });
    expect(memberWorldActivity(member)).toBe('walking');
  });

  it('stands still on the cell when no step is in flight', () => {
    const member = memberAt(0, 'using', BENCH, Object.freeze({ x: 3, y: 1 }));
    expect(memberWorldPoint(member)).toEqual({ x: 3, y: 1 });
    expect(memberWorldActivity(member)).toBe('using');
  });

  it('names waiting, leaving, interrupted, and stranded from sim state', () => {
    expect(memberWorldActivity(memberAt(0, 'queuing', BENCH))).toBe('waiting');
    expect(memberWorldActivity(memberAt(0, 'leaving', BENCH))).toBe('leaving');
    expect(
      memberWorldActivity(
        memberAt(0, 'interrupted', null, Object.freeze({ x: 0, y: 0 }), {
          interruptedBy: 'target-moved',
        }),
      ),
    ).toBe('interrupted');
    expect(
      memberWorldActivity(
        memberAt(0, 'seeking', null, Object.freeze({ x: 0, y: 0 }), { strandedAt: 4 }),
      ),
    ).toBe('stranded');
  });

  it('marks a station occupied when a member is using it', () => {
    const queueCell = Object.freeze({ x: 4, y: 1 });
    const station = stationAt(BENCH, Object.freeze({ x: 3, y: 0 }), Object.freeze({ x: 3, y: 1 }), [
      queueCell,
    ]);
    const user = memberAt(0, 'using', BENCH, Object.freeze({ x: 3, y: 1 }));
    const view = worldStationView(station, [user], {});
    expect(view.occupancy).toBe('occupied');
    expect(view.usingCount).toBe(1);
    expect(view.queueLength).toBe(0);
    expect(view.occupiedQueueCells).toEqual([]);
  });

  it('marks queue cells from waiting members and keeps occupancy queued when empty of users', () => {
    const queueCell = Object.freeze({ x: 4, y: 1 });
    const station = stationAt(BENCH, Object.freeze({ x: 3, y: 0 }), Object.freeze({ x: 3, y: 1 }), [
      queueCell,
    ]);
    const waiter = memberAt(1, 'queuing', BENCH, queueCell, { queuedAt: 2 });
    const view = worldStationView(station, [waiter], {});
    expect(view.occupancy).toBe('queued');
    expect(view.queueLength).toBe(1);
    expect(view.occupiedQueueCells).toEqual([queueCell]);
    expect(worldMemberView(waiter, [station]).queueSlot).toBe(0);
  });

  it('keeps occupancy occupied when a user and a waiter share the station', () => {
    const queueCell = Object.freeze({ x: 4, y: 1 });
    const station = stationAt(BENCH, Object.freeze({ x: 3, y: 0 }), Object.freeze({ x: 3, y: 1 }), [
      queueCell,
    ]);
    const user = memberAt(0, 'using', BENCH, Object.freeze({ x: 3, y: 1 }));
    const waiter = memberAt(1, 'queuing', BENCH, queueCell, { queuedAt: 2 });
    const view = worldStationView(station, [user, waiter], {});
    expect(view.occupancy).toBe('occupied');
    expect(view.usingCount).toBe(1);
    expect(view.queueLength).toBe(1);
    expect(view.occupiedQueueCells).toEqual([queueCell]);
  });

  it('marks a claimed empty seat as approaching', () => {
    const station = stationAt(BENCH, Object.freeze({ x: 3, y: 0 }), Object.freeze({ x: 3, y: 1 }), [
      Object.freeze({ x: 4, y: 1 }),
    ]);
    const walker = memberAt(0, 'seeking', BENCH, Object.freeze({ x: 0, y: 5 }), {
      next: Object.freeze({ x: 0, y: 4 }),
      progress: 0.2,
    });
    const view = worldStationView(station, [walker], {});
    expect(view.occupancy).toBe('approaching');
    expect(view.approachingCount).toBe(1);
  });

  it('marks changeover when plates are loading and nobody is using', () => {
    const useCell = Object.freeze({ x: 3, y: 1 });
    const station = stationAt(BENCH, Object.freeze({ x: 3, y: 0 }), useCell, [
      Object.freeze({ x: 4, y: 1 }),
    ]);
    const view = worldStationView(station, [], { 'training:competition-bench-bay:3,1': 6 });
    expect(view.occupancy).toBe('changeover');
    expect(view.changeoverSeats).toBe(1);
  });

  it('drives one garage member onto the bench without teleporting', () => {
    const context = garageContext();
    const stations = floorStations(context);
    const bench = stations.find((station) => station.ref.kind === 'training');
    expect(bench, 'garage ships the competition bench bay').toBeDefined();
    let state: FloorSimState = createFloorSimState(context, T.FLOOR_SIM_RENDER_SEED);
    let sawWalking = false;
    let usingIndex: number | null = null;
    let previous: { readonly x: number; readonly y: number }[] = [];
    const horizon = 240;
    for (let tick = 0; tick < horizon; tick += 1) {
      const frame = worldFrame(state, stations);
      expect(frame.tick).toBe(state.tick);
      expect(frame.members.length).toBe(state.members.length);
      if (previous.length === 0) {
        previous = frame.members.map((member) => ({ x: member.tile.x, y: member.tile.y }));
      } else {
        for (let index = 0; index < frame.members.length; index += 1) {
          const member = frame.members[index];
          const last = previous[index];
          if (member === undefined || last === undefined) continue;
          const dx = member.tile.x - last.x;
          const dy = member.tile.y - last.y;
          expect(Math.hypot(dx, dy), `teleport at tick ${state.tick} member ${index}`).toBeLessThanOrEqual(
            1,
          );
        }
        previous = frame.members.map((member) => ({ x: member.tile.x, y: member.tile.y }));
      }
      for (const member of frame.members) {
        if (member.activity === 'walking') sawWalking = true;
        if (member.activity === 'using' && usingIndex === null) usingIndex = member.index;
      }
      if (sawWalking && usingIndex !== null) break;
      state = stepFloorSim(state, context);
    }
    expect(sawWalking).toBe(true);
    expect(usingIndex).not.toBeNull();
    const frame = worldFrame(state, stations);
    const user = frame.members.find((member) => member.index === usingIndex);
    expect(user?.activity).toBe('using');
    expect(user?.target).toEqual(BENCH);
    const worldBench = frame.stations.find((station) => station.ref.kind === 'training');
    expect(worldBench?.occupancy).toBe('occupied');
    expect(worldBench?.usingCount).toBeGreaterThan(0);
  });
});
