/**
 * facilityPersistence.test.ts — first wired Session B facility save/load.
 *
 * SERIALIZATION SHAPE was already proven. These tests prove PERSISTENCE:
 * durable truth -> store -> destroy the process-side objects -> load ->
 * equivalent authoritative facility truth. FloorSim pose is not restored.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { EMPIRE_TUNING } from './empireTuning';
import {
  DURABLE_FACILITY_TRUTH_FIELDS,
  FACILITY_SAVE_KIND,
  FACILITY_SAVE_SCHEMA_VERSION,
  bayAxisLevels,
  decodeFacilitySave,
  encodeFacilitySave,
  loadFacilitySave,
  persistableTruthFromGymView,
  presentationInputFromRestored,
  restoreDurableFacility,
  restoreGymViewState,
  restoredPresentationWorld,
  type FacilitySaveStore,
} from './facilityPersistence';
import {
  createGymViewState,
  gymViewReduce,
  type GymViewAction,
  type GymViewState,
} from './ladderView';
import { persistableFacilityTruth } from './presentationState';
import { sessionEquipmentCost } from './sessions';
import { stationChangeoverTicks } from './stationCapability';
import { COMPETITION_BENCH_BAY } from './trainingStation';

const T = EMPIRE_TUNING;
const BAY = COMPETITION_BENCH_BAY;

function memoryStore(initial: string | null = null): FacilitySaveStore {
  let bytes = initial;
  return {
    read: () => bytes,
    write: (next) => {
      bytes = next;
    },
  };
}

function fileStore(path: string): FacilitySaveStore {
  return {
    read: () => (existsSync(path) ? readFileSync(path, 'utf8') : null),
    write: (bytes) => {
      writeFileSync(path, bytes, 'utf8');
    },
  };
}

function dispatch(state: GymViewState, action: GymViewAction): GymViewState {
  return gymViewReduce(state, action);
}

function withOnlineHours(state: GymViewState, hours: number): GymViewState {
  return dispatch(state, {
    kind: 'advance-clock',
    gapSeconds: hours * T.SECONDS_PER_HOUR,
    mode: 'online',
  });
}

function buyAxis(state: GymViewState, axis: 'quality' | 'capacity' | 'throughput'): GymViewState {
  const funded = withOnlineHours(state, 4);
  const next = dispatch(funded, {
    kind: 'upgrade-station',
    station: BAY,
    axis,
  });
  expect(next.lastRefusal).toBeNull();
  expect(bayAxisLevels(next.capability)[axis]).toBe(1);
  return next;
}

function saveAndDestroy(state: GymViewState): {
  readonly bytes: string;
  readonly truth: ReturnType<typeof persistableTruthFromGymView>;
} {
  const truth = persistableTruthFromGymView(state);
  const bytes = encodeFacilitySave(truth);
  return Object.freeze({ bytes, truth });
}

describe('facilityPersistence.ts — classification and envelope', () => {
  it('durable fields are exactly PersistableFacilityTruth keys', () => {
    const truth = persistableTruthFromGymView(createGymViewState());
    expect(Object.keys(truth).sort()).toEqual([...DURABLE_FACILITY_TRUTH_FIELDS].sort());
    expect(DURABLE_FACILITY_TRUTH_FIELDS).toHaveLength(10);
  });

  it('encode is deterministic and decode round-trips the envelope', () => {
    const state = buyAxis(createGymViewState(), 'capacity');
    const truth = persistableTruthFromGymView(state);
    const first = encodeFacilitySave(truth);
    const second = encodeFacilitySave(truth);
    expect(first).toBe(second);
    const loaded = decodeFacilitySave(first);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;
    expect(loaded.envelope.kind).toBe(FACILITY_SAVE_KIND);
    expect(loaded.envelope.schemaVersion).toBe(FACILITY_SAVE_SCHEMA_VERSION);
    expect(loaded.envelope.truth).toEqual(truth);
    expect(encodeFacilitySave(loaded.envelope.truth)).toBe(first);
  });
});

describe('facilityPersistence.ts — Q/C/T survive a new process', () => {
  it('live Capacity save/load keeps two seats and does not alias Throughput or Quality', () => {
    const played = buyAxis(createGymViewState(), 'capacity');
    const before = persistableTruthFromGymView(played);
    expect(before.capability[BAY]?.capacity).toBe(1);
    expect(before.capability[BAY]?.quality).toBe(0);
    expect(before.capability[BAY]?.throughput).toBe(0);
    const purse = played.managed.gym.ladder.gymBucks;
    expect(purse).toBeGreaterThan(0);
    expect(purse).toBeLessThan(T.LADDER_INCOME_GYM_BUCKS_PER_HOUR.garage * 4);

    const dir = mkdtempSync(join(tmpdir(), 'empire-facility-'));
    const path = join(dir, 'facility.json');
    try {
      const bytes = encodeFacilitySave(before);
      writeFileSync(path, bytes, 'utf8');
      const loaded = loadFacilitySave(fileStore(path).read());
      expect(loaded.kind).toBe('loaded');
      if (loaded.kind !== 'loaded') return;
      const restoredView = restoreGymViewState(loaded.envelope.truth);
      const world = restoredPresentationWorld(loaded.envelope.truth);
      const bay = world.stations.find((station) => station.ref.kind === 'training');
      expect(restoredView.managed.gym.ladder.rung).toBe('garage');
      expect(restoredView.managed.gym.ladder.gymBucks).toBe(purse);
      expect(restoredView.capability).toEqual(played.capability);
      expect(world.business.bayCapacity).toBe(1);
      expect(world.business.bayQuality).toBe(0);
      expect(world.business.bayThroughput).toBe(0);
      expect(bay?.capacity).toBe(2);
      expect(bay?.seats).toHaveLength(2);
      expect(stationChangeoverTicks(restoredView.capability, 'training', BAY)).toBe(
        T.FLOOR_SIM_STATION_CHANGEOVER_TICKS,
      );
      const replay = dispatch(restoredView, {
        kind: 'upgrade-station',
        station: BAY,
        axis: 'capacity',
      });
      expect(replay.lastRefusal).toBe('already-upgraded');
      expect(replay.managed.gym.ladder.gymBucks).toBe(purse);
      expect(readFileSync(path, 'utf8')).toBe(bytes);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('live Quality save/load keeps one seat and does not grant Capacity or Throughput', () => {
    const played = buyAxis(createGymViewState(), 'quality');
    const saved = saveAndDestroy(played);
    const loaded = decodeFacilitySave(saved.bytes);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;
    const world = restoredPresentationWorld(loaded.envelope.truth);
    const bay = world.stations.find((station) => station.ref.kind === 'training');
    expect(world.business.bayQuality).toBe(1);
    expect(world.business.bayCapacity).toBe(0);
    expect(world.business.bayThroughput).toBe(0);
    expect(bay?.capacity).toBe(1);
    expect(bay?.seats).toHaveLength(1);
    expect(stationChangeoverTicks(loaded.envelope.truth.capability, 'training', BAY)).toBe(
      T.FLOOR_SIM_STATION_CHANGEOVER_TICKS,
    );
  });

  it('live Throughput save/load keeps one seat and shortens changeover, not Capacity', () => {
    const played = buyAxis(createGymViewState(), 'throughput');
    const saved = saveAndDestroy(played);
    const loaded = decodeFacilitySave(saved.bytes);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;
    const world = restoredPresentationWorld(loaded.envelope.truth);
    const bay = world.stations.find((station) => station.ref.kind === 'training');
    expect(world.business.bayThroughput).toBe(1);
    expect(world.business.bayCapacity).toBe(0);
    expect(world.business.bayQuality).toBe(0);
    expect(bay?.capacity).toBe(1);
    expect(bay?.seats).toHaveLength(1);
    expect(stationChangeoverTicks(loaded.envelope.truth.capability, 'training', BAY)).toBe(
      T.STATION_THROUGHPUT_CHANGEOVER_TICKS,
    );
  });
});

describe('facilityPersistence.ts — placement, ownership, economy, identity', () => {
  it('session ownership and placement survive save/load', () => {
    const cost = sessionEquipmentCost('mats');
    const funded = withOnlineHours(createGymViewState(), 4);
    expect(funded.managed.gym.ladder.gymBucks).toBeGreaterThanOrEqual(cost);
    const bought = dispatch(funded, { kind: 'buy-session', item: 'mats' });
    expect(bought.lastRefusal).toBeNull();
    expect(bought.managed.gym.sessionEquipment).toEqual(['mats']);
    const placed = dispatch(bought, {
      kind: 'floor-place',
      item: 'mats',
      position: Object.freeze({ x: 5, y: 3 }),
    });
    expect(placed.lastRefusal).toBeNull();
    expect(placed.floor.placements.mats).toEqual({ x: 5, y: 3 });
    const saved = saveAndDestroy(placed);
    const loaded = decodeFacilitySave(saved.bytes);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;
    const restored = restoreGymViewState(loaded.envelope.truth);
    expect(restored.managed.gym.sessionEquipment).toEqual(['mats']);
    expect(restored.floor.placements.mats).toEqual({ x: 5, y: 3 });
    expect(restored.floor.furniture['flat-bench']).toEqual(placed.floor.furniture['flat-bench']);
    const world = restoredPresentationWorld(loaded.envelope.truth);
    expect(
      world.stations.some((station) => station.ref.kind === 'session' && station.ref.item === 'mats'),
    ).toBe(true);
    const again = dispatch(restored, { kind: 'buy-session', item: 'mats' });
    expect(again.lastRefusal).toBe('already-owned');
  });

  it('identity nonce restores the same GymMemberIds without duplicates', () => {
    const opened = createGymViewState();
    const originalIds = opened.livingMembers.members.map((member) => member.id);
    expect(originalIds).toHaveLength(3);
    expect(new Set(originalIds).size).toBe(3);
    const saved = saveAndDestroy(opened);
    const loaded = decodeFacilitySave(saved.bytes);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;
    expect(loaded.envelope.truth.identityNonce).toBe(opened.livingMembers.identityNonce);
    expect(loaded.envelope.truth.memberCount).toBe(3);
    const restored = restoreDurableFacility(loaded.envelope.truth);
    const restoredIds = restored.roster.members.map((member) => member.id);
    expect(restoredIds).toEqual(originalIds);
    expect(new Set(restoredIds).size).toBe(3);
    expect(restored.roster.identityNonce).toBe(opened.livingMembers.identityNonce);
    const input = presentationInputFromRestored(restored);
    expect(persistableFacilityTruth(input).identityNonce).toBe(opened.livingMembers.identityNonce);
  });

  it('an empty store is empty, not a silent new gym', () => {
    expect(loadFacilitySave(memoryStore().read()).kind).toBe('empty');
    const dir = mkdtempSync(join(tmpdir(), 'empire-facility-empty-'));
    const path = join(dir, 'missing.json');
    try {
      expect(loadFacilitySave(fileStore(path).read()).kind).toBe('empty');
      const emptyBytes = encodeFacilitySave(
        persistableTruthFromGymView(createGymViewState()),
      ).slice(0, 0);
      expect(loadFacilitySave(emptyBytes).kind).toBe('empty');
      expect(decodeFacilitySave(emptyBytes).kind).toBe('empty');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('facilityPersistence.ts — corrupt and unsupported bytes fail closed', () => {
  it('refuses corrupt JSON, unknown kind, unsupported version, and incoherent truth', () => {
    expect(decodeFacilitySave('{').kind).toBe('refused');
    expect(decodeFacilitySave('{')).toEqual({ kind: 'refused', reason: 'corrupt-json' });
    expect(decodeFacilitySave('null')).toEqual({ kind: 'refused', reason: 'corrupt-json' });
    expect(decodeFacilitySave('[]')).toEqual({ kind: 'refused', reason: 'corrupt-json' });
    expect(
      decodeFacilitySave(JSON.stringify({ kind: 'other', schemaVersion: 1, truth: {} })),
    ).toEqual({ kind: 'refused', reason: 'unknown-kind' });
    const opened = persistableTruthFromGymView(createGymViewState());
    expect(
      decodeFacilitySave(
        JSON.stringify({
          kind: FACILITY_SAVE_KIND,
          schemaVersion: 2,
          truth: opened,
        }),
      ),
    ).toEqual({ kind: 'refused', reason: 'unsupported-version' });
    expect(
      decodeFacilitySave(
        JSON.stringify({
          kind: FACILITY_SAVE_KIND,
          schemaVersion: 0,
          truth: opened,
        }),
      ),
    ).toEqual({ kind: 'refused', reason: 'unsupported-version' });
    expect(
      decodeFacilitySave(
        JSON.stringify({
          kind: FACILITY_SAVE_KIND,
          schemaVersion: 1,
          truth: { ...opened, gymBucks: -1 },
        }),
      ),
    ).toEqual({ kind: 'refused', reason: 'incoherent' });
    expect(
      decodeFacilitySave(
        JSON.stringify({
          kind: FACILITY_SAVE_KIND,
          schemaVersion: 1,
          truth: {
            ...opened,
            capability: { [BAY]: { quality: 0, capacity: 2, throughput: 0 } },
          },
        }),
      ),
    ).toEqual({ kind: 'refused', reason: 'incoherent' });
    expect(
      decodeFacilitySave(
        JSON.stringify({
          kind: FACILITY_SAVE_KIND,
          schemaVersion: 1,
          truth: {
            ...opened,
            capability: { [BAY]: { quality: 1, capacity: 1, throughput: 0 } },
          },
        }),
      ).kind,
    ).toBe('loaded');
    expect(
      decodeFacilitySave(
        JSON.stringify({
          kind: FACILITY_SAVE_KIND,
          schemaVersion: 1,
          truth: { ...opened, memberCount: 99 },
        }),
      ),
    ).toEqual({ kind: 'refused', reason: 'incoherent' });
    expect(
      decodeFacilitySave(
        JSON.stringify({
          kind: FACILITY_SAVE_KIND,
          schemaVersion: 1,
          truth: { ...opened, extra: true },
        }),
      ),
    ).toEqual({ kind: 'refused', reason: 'incoherent' });
  });
});

describe('facilityPersistence.ts — FloorSim pose is not restored', () => {
  it('load starts a fresh sim; mid-activity pose is not claimed', () => {
    const played = buyAxis(createGymViewState(), 'capacity');
    const saved = saveAndDestroy(played);
    const loaded = decodeFacilitySave(saved.bytes);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;
    const input = presentationInputFromRestored(restoreDurableFacility(loaded.envelope.truth));
    expect(input.sim.tick).toBe(0);
    expect(input.sim.members.every((member) => member.state === 'seeking')).toBe(true);
    expect(JSON.stringify(input.sim)).not.toContain('"using"');
  });
});
