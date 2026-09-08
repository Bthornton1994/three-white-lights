/**
 * facilityPersistence.test.ts — Session B facility save/load.
 *
 * SERIALIZATION SHAPE was already proven. These tests prove PERSISTENCE:
 * durable truth -> store -> destroy the process-side objects -> load ->
 * equivalent authoritative gym truth. FloorSim pose is not restored.
 *
 * The v1 body is FacilitySaveTruthV1, amended in place: PR #53 is draft,
 * GymHost is unwired, and no external schemaVersion 1 bytes exist.
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
  FACILITY_SAVE_TRUTH_DOMAINS,
  bayAxisLevels,
  decodeFacilitySave,
  encodeFacilitySave,
  loadFacilitySave,
  persistableGymTruthFromGymView,
  persistableTruthFromGymView,
  presentationInputFromRestored,
  restoreDurableFacility,
  restoreGymViewState,
  restoredPresentationWorld,
  type FacilitySaveStore,
  type FacilitySaveTruthV1,
} from './facilityPersistence';
import { stepFloorSim } from './floorSim';
import {
  createGymViewState,
  gymViewReduce,
  type GymViewAction,
  type GymViewState,
} from './ladderView';
import { livingMemberExperience } from './livingMemberExperience';
import { livingMemberRetentionPressure } from './livingMemberRetention';
import { deriveMemberId, memberOrdinalFromId } from './livingMembers';
import {
  failurePhase,
  repairCostGymBucks,
  requireManagedGym,
  type CountedDecisionRecord,
  type ManagedGym,
} from './management';
import { persistableFacilityTruth, presentationWorld } from './presentationState';
import { createRestAllocation, sessionEquipmentCost } from './sessions';
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
  readonly truth: FacilitySaveTruthV1;
} {
  const truth = persistableGymTruthFromGymView(state);
  const bytes = encodeFacilitySave(truth);
  return Object.freeze({ bytes, truth });
}

function reload(state: GymViewState): GymViewState {
  const saved = saveAndDestroy(state);
  const loaded = decodeFacilitySave(saved.bytes);
  expect(loaded.kind).toBe('loaded');
  if (loaded.kind !== 'loaded') {
    throw new Error('reload expected loaded envelope');
  }
  return restoreGymViewState(loaded.envelope.truth);
}

const GYM_VIEW_DISPOSITION = Object.freeze({
  managed: 'durable-container',
  lastAccrual: 'transient-presentation',
  lastManagementReport: 'transient-presentation',
  lastRefusal: 'transient-presentation',
  weekIndex: 'derived-on-load',
  allocation: 'durable',
  allocationSetThisWeek: 'durable',
  weekLog: 'durable',
  floor: 'durable-container',
  surface: 'transient-presentation',
  capability: 'durable',
  livingMembers: 'durable-container',
});

const MANAGED_GYM_DISPOSITION = Object.freeze({
  gym: 'durable-container',
  condition: 'durable',
  manager: 'durable',
  strikes: 'durable',
  neglected: 'durable',
  promptDismissals: 'durable',
  bankedOperationSeconds: 'durable',
  checkInsTaken: 'durable',
  recoveries: 'durable',
});

const GYM_STATE_DISPOSITION = Object.freeze({
  ladder: 'durable-container',
  acceleratedGymBucks: 'durable',
  sessionEquipment: 'durable',
});

const LADDER_STATE_DISPOSITION = Object.freeze({
  rung: 'durable',
  gymBucks: 'durable',
  equipment: 'durable',
  collectedAt: 'durable',
});

const FLOOR_STATE_DISPOSITION = Object.freeze({
  rung: 'durable',
  placements: 'durable',
  furniture: 'durable',
});

const ROSTER_DISPOSITION = Object.freeze({
  rung: 'derived-on-load',
  identityNonce: 'durable',
  members: 'durable-container',
});

const LIVING_MEMBER_DISPOSITION = Object.freeze({
  id: 'derived-on-load',
  displayName: 'derived-on-load',
  type: 'durable',
  joinedAtSeconds: 'durable',
  recentVisits: 'durable',
});

const VISIT_DISPOSITION = Object.freeze({
  stationKind: 'durable',
  stationKey: 'durable',
  queueWaitTicks: 'durable',
  trainingExperience: 'durable',
  outcome: 'durable',
  observedAtTick: 'durable',
});

const WEEK_REPORT_DISPOSITION = Object.freeze({
  weekIndex: 'durable',
  allocation: 'durable',
  slots: 'durable',
  effects: 'durable',
});

const MANAGER_DISPOSITION = Object.freeze({
  tier: 'durable',
  hiredUnderWarning: 'durable',
});

const STRIKE_DISPOSITION = Object.freeze({
  decision: 'durable',
  atSeconds: 'durable',
  shownCostGymBucks: 'durable',
});

const SAVE_BODY_DISPOSITION = Object.freeze({
  facility: 'durable',
  clock: 'durable',
  management: 'durable',
  week: 'durable',
  living: 'durable',
});

function keysOf(value: object): readonly string[] {
  return Object.freeze([...Object.keys(value)].sort());
}

function dispositionKeys(disposition: Readonly<Record<string, string>>): readonly string[] {
  return Object.freeze([...Object.keys(disposition)].sort());
}

/**
 * Live durable/derived projection. Reads GymViewState, not the encoder
 * allowlist, so a newly added durable field fails this comparison until
 * restore writes it back.
 */
function durableSemanticProjection(state: GymViewState): unknown {
  return Object.freeze({
    gym: state.managed.gym,
    condition: state.managed.condition,
    manager: state.managed.manager,
    strikes: state.managed.strikes,
    neglected: state.managed.neglected,
    promptDismissals: state.managed.promptDismissals,
    bankedOperationSeconds: state.managed.bankedOperationSeconds,
    checkInsTaken: state.managed.checkInsTaken,
    recoveries: state.managed.recoveries,
    weekIndex: state.weekIndex,
    allocation: state.allocation,
    allocationSetThisWeek: state.allocationSetThisWeek,
    weekLog: state.weekLog,
    floor: state.floor,
    capability: state.capability,
    livingMembers: Object.freeze({
      rung: state.livingMembers.rung,
      identityNonce: state.livingMembers.identityNonce,
      members: Object.freeze(
        state.livingMembers.members.map((member) =>
          Object.freeze({
            id: member.id,
            displayName: member.displayName,
            type: member.type,
            joinedAtSeconds: member.joinedAtSeconds,
            recentVisits: member.recentVisits,
          }),
        ),
      ),
    }),
  });
}

function withLedger(
  state: GymViewState,
  patch: Partial<
    Pick<
      ManagedGym,
      'strikes' | 'neglected' | 'promptDismissals' | 'recoveries' | 'manager'
    >
  >,
): GymViewState {
  return Object.freeze({
    ...state,
    managed: requireManagedGym(Object.freeze({ ...state.managed, ...patch })),
  });
}

function withJoinedTenure(state: GymViewState, joinedAtSeconds: number): GymViewState {
  const members = state.livingMembers.members.map((member, index) =>
    index === 0 ? Object.freeze({ ...member, joinedAtSeconds }) : member,
  );
  return Object.freeze({
    ...state,
    livingMembers: Object.freeze({
      ...state.livingMembers,
      members: Object.freeze(members),
    }),
  });
}

function applyVisit(state: GymViewState): GymViewState {
  const member = state.livingMembers.members[0];
  if (member === undefined) {
    throw new Error('opening gym has no living members');
  }
  return dispatch(state, {
    kind: 'apply-living-member-observations',
    observations: Object.freeze([
      Object.freeze({
        memberId: member.id,
        memberIndex: 0,
        memberType: member.type,
        stationKind: 'training' as const,
        stationKey: BAY,
        queueWaitTicks: 40,
        trainingExperience: T.STATION_STOCK_TRAINING_EXPERIENCE,
        outcome: 'completed' as const,
        observedAtTick: 18,
      }),
    ]),
  });
}

/** Deliberately ugly non-default gym: every durable domain off opening values. */
function uglyGymViewState(): GymViewState {
  let state = createGymViewState();
  const openingProjection = durableSemanticProjection(state);
  state = withOnlineHours(state, T.DAYS_PER_TRAINING_WEEK * 24 + 12);
  expect(state.weekIndex).toBeGreaterThan(0);
  expect(state.weekLog.length).toBeGreaterThan(0);
  expect(state.allocationSetThisWeek).toBe(false);

  const cost = sessionEquipmentCost('mats');
  expect(state.managed.gym.ladder.gymBucks).toBeGreaterThanOrEqual(cost);
  state = dispatch(state, { kind: 'buy-session', item: 'mats' });
  expect(state.lastRefusal).toBeNull();
  state = dispatch(state, {
    kind: 'upgrade-station',
    station: BAY,
    axis: 'capacity',
  });
  expect(state.lastRefusal).toBeNull();
  state = dispatch(state, {
    kind: 'floor-place',
    item: 'mats',
    position: Object.freeze({ x: 0, y: 3 }),
  });
  expect(state.lastRefusal).toBeNull();
  state = dispatch(state, { kind: 'hire-manager', tier: 'novice' });
  expect(state.lastRefusal).toBeNull();
  expect(state.managed.manager?.tier).toBe('novice');
  state = dispatch(state, {
    kind: 'set-allocation-slot',
    slotIndex: 0,
    slot: 'cardio',
  });
  state = dispatch(state, {
    kind: 'set-allocation-slot',
    slotIndex: 1,
    slot: 'hypertrophy',
  });
  expect(state.allocationSetThisWeek).toBe(true);
  expect(state.allocation).not.toEqual(createRestAllocation());
  state = applyVisit(state);
  state = withJoinedTenure(state, T.SECONDS_PER_DAY);
  state = dispatch(state, { kind: 'set-gym-surface', surface: 'build' });
  const mark = state.managed.gym.ladder.collectedAt;
  const strikes: readonly CountedDecisionRecord[] = Object.freeze([
    Object.freeze({
      decision: 'repair-declined' as const,
      atSeconds: Math.max(0, mark - T.SECONDS_PER_DAY),
      shownCostGymBucks: 12,
    }),
    Object.freeze({
      decision: 'prompt-dismissed-again' as const,
      atSeconds: mark,
      shownCostGymBucks: 12,
    }),
  ]);
  state = withLedger(state, {
    strikes,
    neglected: Object.freeze(['flat-bench']),
    promptDismissals: 1,
    recoveries: 1,
  });
  expect(failurePhase(state.managed)).toBe('warned');
  expect(state.surface).toBe('build');
  expect(durableSemanticProjection(state)).not.toEqual(openingProjection);
  return state;
}

describe('facilityPersistence.ts — classification and envelope', () => {
  it('facility subset keys stay PersistableFacilityTruth, and the v1 body has five domains', () => {
    const opened = createGymViewState();
    const facility = persistableTruthFromGymView(opened);
    const body = persistableGymTruthFromGymView(opened);
    expect(keysOf(facility)).toEqual([...DURABLE_FACILITY_TRUTH_FIELDS].sort());
    expect(DURABLE_FACILITY_TRUTH_FIELDS).toHaveLength(10);
    expect(keysOf(body)).toEqual(dispositionKeys(SAVE_BODY_DISPOSITION));
    expect(keysOf(body)).toEqual([...FACILITY_SAVE_TRUTH_DOMAINS].sort());
    expect(FACILITY_SAVE_SCHEMA_VERSION).toBe(1);
  });

  it('every GymViewState graph field has a persistence disposition', () => {
    const state = uglyGymViewState();
    expect(keysOf(state)).toEqual(dispositionKeys(GYM_VIEW_DISPOSITION));
    expect(keysOf(state.managed)).toEqual(dispositionKeys(MANAGED_GYM_DISPOSITION));
    expect(keysOf(state.managed.gym)).toEqual(dispositionKeys(GYM_STATE_DISPOSITION));
    expect(keysOf(state.managed.gym.ladder)).toEqual(dispositionKeys(LADDER_STATE_DISPOSITION));
    expect(keysOf(state.floor)).toEqual(dispositionKeys(FLOOR_STATE_DISPOSITION));
    expect(keysOf(state.livingMembers)).toEqual(dispositionKeys(ROSTER_DISPOSITION));
    const member = state.livingMembers.members[0];
    expect(member).toBeDefined();
    if (member === undefined) return;
    expect(keysOf(member)).toEqual(dispositionKeys(LIVING_MEMBER_DISPOSITION));
    const visit = member.recentVisits[0];
    expect(visit).toBeDefined();
    if (visit === undefined) return;
    expect(keysOf(visit)).toEqual(dispositionKeys(VISIT_DISPOSITION));
    const report = state.weekLog[0];
    expect(report).toBeDefined();
    if (report === undefined) return;
    expect(keysOf(report)).toEqual(dispositionKeys(WEEK_REPORT_DISPOSITION));
    const manager = state.managed.manager;
    expect(manager).not.toBeNull();
    if (manager === null) return;
    expect(keysOf(manager)).toEqual(dispositionKeys(MANAGER_DISPOSITION));
    const strike = state.managed.strikes[0];
    expect(strike).toBeDefined();
    if (strike === undefined) return;
    expect(keysOf(strike)).toEqual(dispositionKeys(STRIKE_DISPOSITION));
  });

  it('encode is deterministic and decode round-trips the envelope', () => {
    const state = buyAxis(createGymViewState(), 'capacity');
    const truth = persistableGymTruthFromGymView(state);
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
    const before = persistableGymTruthFromGymView(played);
    expect(before.facility.capability[BAY]?.capacity).toBe(1);
    expect(before.facility.capability[BAY]?.quality).toBe(0);
    expect(before.facility.capability[BAY]?.throughput).toBe(0);
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
    expect(stationChangeoverTicks(loaded.envelope.truth.facility.capability, 'training', BAY)).toBe(
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
    expect(stationChangeoverTicks(loaded.envelope.truth.facility.capability, 'training', BAY)).toBe(
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
    expect(loaded.envelope.truth.facility.identityNonce).toBe(opened.livingMembers.identityNonce);
    expect(loaded.envelope.truth.facility.memberCount).toBe(3);
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
        persistableGymTruthFromGymView(createGymViewState()),
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
    const opened = persistableGymTruthFromGymView(createGymViewState());
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
          truth: {
            ...opened,
            facility: { ...opened.facility, gymBucks: -1 },
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
            facility: {
              ...opened.facility,
              capability: { [BAY]: { quality: 0, capacity: 2, throughput: 0 } },
            },
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
            facility: {
              ...opened.facility,
              capability: { [BAY]: { quality: 1, capacity: 1, throughput: 0 } },
            },
          },
        }),
      ).kind,
    ).toBe('loaded');
    expect(
      decodeFacilitySave(
        JSON.stringify({
          kind: FACILITY_SAVE_KIND,
          schemaVersion: 1,
          truth: {
            ...opened,
            facility: { ...opened.facility, memberCount: 99 },
          },
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

  it('refuses wrong enums, impossible numbers, missing domains, unknown fields, and cross-domain lies', () => {
    const opened = persistableGymTruthFromGymView(uglyGymViewState());
    expect(
      decodeFacilitySave(
        JSON.stringify({
          kind: FACILITY_SAVE_KIND,
          schemaVersion: 1,
          truth: opened,
          extra: true,
        }),
      ),
    ).toEqual({ kind: 'refused', reason: 'incoherent' });
    expect(
      decodeFacilitySave(
        JSON.stringify({
          kind: FACILITY_SAVE_KIND,
          schemaVersion: 1,
          truth: persistableTruthFromGymView(createGymViewState()),
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
            management: {
              ...opened.management,
              manager: { tier: 'overlord', hiredUnderWarning: false },
            },
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
            management: {
              ...opened.management,
              strikes: [{ decision: 'ignored-the-bills', atSeconds: 0, shownCostGymBucks: 1 }],
            },
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
            week: { ...opened.week, allocation: ['cardio', 'rest', 'wizard'] },
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
            living: {
              members: opened.living.members.map((member, index) =>
                index === 0 ? { ...member, type: 'ghost' } : member,
              ),
            },
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
            clock: { ...opened.clock, collectedAt: -1 },
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
            management: { ...opened.management, promptDismissals: -1 },
          },
        }),
      ),
    ).toEqual({ kind: 'refused', reason: 'incoherent' });
    const conditionKeys = Object.keys(opened.management.condition);
    const firstItem = conditionKeys[0];
    expect(firstItem).toBeDefined();
    if (firstItem === undefined) return;
    expect(
      decodeFacilitySave(
        JSON.stringify({
          kind: FACILITY_SAVE_KIND,
          schemaVersion: 1,
          truth: {
            ...opened,
            management: {
              ...opened.management,
              condition: { ...opened.management.condition, [firstItem]: 1.4 },
            },
          },
        }),
      ),
    ).toEqual({ kind: 'refused', reason: 'incoherent' });
    const { clock: _clock, ...withoutClock } = opened;
    expect(
      decodeFacilitySave(
        JSON.stringify({
          kind: FACILITY_SAVE_KIND,
          schemaVersion: 1,
          truth: withoutClock,
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
            management: { ...opened.management, extra: true },
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
            management: {
              ...opened.management,
              neglected: ['sauna'],
            },
          },
        }),
      ),
    ).toEqual({ kind: 'refused', reason: 'incoherent' });
  });
});

describe('facilityPersistence.ts — FloorSim pose is not restored', () => {
  it('load starts a fresh sim; mid-activity pose is not claimed; occupancy stays legal', () => {
    const played = uglyGymViewState();
    const saved = saveAndDestroy(played);
    const loaded = decodeFacilitySave(saved.bytes);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;
    const restored = restoreDurableFacility(loaded.envelope.truth);
    const input = presentationInputFromRestored(restored);
    expect(input.sim.tick).toBe(0);
    expect(input.sim.members.every((member) => member.state === 'seeking')).toBe(true);
    expect(JSON.stringify(input.sim)).not.toContain('"using"');
    expect(Object.keys(input.sim.changeovers)).toHaveLength(0);

    const context = Object.freeze({
      rung: restored.floor.rung,
      floor: restored.floor,
      barbellOwned: restored.managed.gym.ladder.equipment,
      sessionOwned: restored.managed.gym.sessionEquipment,
      capability: restored.capability,
      livingPopulation: input.sim.members.map((member) =>
        Object.freeze({ memberId: member.memberId, type: member.type }),
      ),
    });
    let sim = input.sim;
    for (let tick = 0; tick < 240; tick += 1) {
      sim = stepFloorSim(sim, context);
    }
    expect(sim.tick).toBe(240);
    const world = presentationWorld(
      Object.freeze({
        sim,
        floor: restored.floor,
        roster: restored.roster,
        managed: restored.managed,
        capability: restored.capability,
      }),
    );
    const openingWorld = restoredPresentationWorld(loaded.envelope.truth);
    expect(openingWorld.business.usingCount).toBe(0);
    for (const station of [...openingWorld.stations, ...world.stations]) {
      expect(station.usingIds.length).toBeLessThanOrEqual(station.capacity);
      const seated = station.seats.map((seat) => seat.usingId).filter((id) => id !== null);
      expect(new Set(seated).size).toBe(seated.length);
      expect(seated.length).toBeLessThanOrEqual(station.capacity);
    }
  });

  it('a restored complete bay can be occupied from a fresh sim', () => {
    const played = buyAxis(createGymViewState(), 'capacity');
    const restored = restoreDurableFacility(persistableGymTruthFromGymView(played));
    const input = presentationInputFromRestored(restored);
    const context = Object.freeze({
      rung: restored.floor.rung,
      floor: restored.floor,
      barbellOwned: restored.managed.gym.ladder.equipment,
      sessionOwned: restored.managed.gym.sessionEquipment,
      capability: restored.capability,
      livingPopulation: input.sim.members.map((member) =>
        Object.freeze({ memberId: member.memberId, type: member.type }),
      ),
    });
    let sim = input.sim;
    for (let tick = 0; tick < 400; tick += 1) {
      sim = stepFloorSim(sim, context);
      if (sim.members.some((member) => member.state === 'using')) break;
    }
    expect(sim.members.some((member) => member.state === 'using' || member.state === 'queuing')).toBe(
      true,
    );
    const world = presentationWorld(
      Object.freeze({
        sim,
        floor: restored.floor,
        roster: restored.roster,
        managed: restored.managed,
        capability: restored.capability,
      }),
    );
    const bay = world.stations.find((station) => station.ref.kind === 'training');
    expect(bay?.capacity).toBe(2);
    expect((bay?.usingIds.length ?? 0) + (bay?.queueIds.length ?? 0)).toBeGreaterThan(0);
    expect(bay?.usingIds.length ?? 0).toBeLessThanOrEqual(bay?.capacity ?? 0);
  });
});

describe('facilityPersistence.ts — clock watermark', () => {
  it('reload at T mints no idle accrual; only a genuine later gap is eligible', () => {
    const played = withOnlineHours(createGymViewState(), 6);
    const mark = played.managed.gym.ladder.collectedAt;
    expect(mark).toBeGreaterThan(0);
    const restored = reload(played);
    expect(restored.managed.gym.ladder.collectedAt).toBe(mark);
    expect(restored.managed.bankedOperationSeconds).toBe(played.managed.bankedOperationSeconds);
    expect(restored.managed.checkInsTaken).toBe(played.managed.checkInsTaken);
    expect(restored.managed.gym.ladder.gymBucks).toBe(played.managed.gym.ladder.gymBucks);
    expect(restored.managed.condition).toEqual(played.managed.condition);

    const zero = dispatch(restored, { kind: 'advance-clock', gapSeconds: 0, mode: 'online' });
    expect(zero.managed.gym.ladder.collectedAt).toBe(mark);
    expect(zero.managed.gym.ladder.gymBucks).toBe(restored.managed.gym.ladder.gymBucks);
    expect(zero.managed.condition).toEqual(restored.managed.condition);
    expect(zero.managed.bankedOperationSeconds).toBe(restored.managed.bankedOperationSeconds);
    expect(zero.managed.strikes).toEqual(restored.managed.strikes);

    const gap = 2 * T.SECONDS_PER_HOUR;
    const afterLoad = dispatch(restored, { kind: 'advance-clock', gapSeconds: gap, mode: 'online' });
    const afterOriginal = dispatch(played, {
      kind: 'advance-clock',
      gapSeconds: gap,
      mode: 'online',
    });
    expect(afterLoad.managed.gym.ladder.gymBucks).toBeGreaterThan(restored.managed.gym.ladder.gymBucks);
    expect(durableSemanticProjection(afterLoad)).toEqual(durableSemanticProjection(afterOriginal));
  });
});

describe('facilityPersistence.ts — management round-trip', () => {
  it('hired manager, worn kit, strikes, and neglected orders keep future decisions', () => {
    const played = uglyGymViewState();
    expect(played.managed.manager?.tier).toBe('novice');
    expect(failurePhase(played.managed)).toBe('warned');
    expect(played.managed.condition['flat-bench']).toBeLessThan(1);
    expect(played.managed.neglected).toContain('flat-bench');
    expect(played.managed.promptDismissals).toBe(1);
    expect(played.managed.recoveries).toBe(1);
    const repairQuote = repairCostGymBucks(played.managed, 'flat-bench');
    expect(repairQuote).toBeGreaterThan(0);

    const restored = reload(played);
    expect(restored.managed.manager).toEqual(played.managed.manager);
    expect(failurePhase(restored.managed)).toBe('warned');
    expect(restored.managed.condition).toEqual(played.managed.condition);
    expect(restored.managed.strikes).toEqual(played.managed.strikes);
    expect(restored.managed.neglected).toEqual(played.managed.neglected);
    expect(restored.managed.promptDismissals).toBe(1);
    expect(restored.managed.recoveries).toBe(1);
    expect(repairCostGymBucks(restored.managed, 'flat-bench')).toBe(repairQuote);

    const hiredAgain = dispatch(restored, { kind: 'hire-manager', tier: 'novice' });
    expect(hiredAgain.lastRefusal).toBe('already-staffed');
    expect(hiredAgain.managed.strikes).toEqual(restored.managed.strikes);
    expect(hiredAgain.managed.gym.ladder.gymBucks).toBe(restored.managed.gym.ladder.gymBucks);

    const repairedOriginal = dispatch(played, { kind: 'repair-item', item: 'flat-bench' });
    const repairedRestored = dispatch(restored, { kind: 'repair-item', item: 'flat-bench' });
    expect(repairedRestored.lastRefusal).toBeNull();
    expect(repairedRestored.managed.condition['flat-bench']).toBe(1);
    expect(repairedRestored.managed.gym.ladder.gymBucks).toBe(
      repairedOriginal.managed.gym.ladder.gymBucks,
    );
    expect(repairedRestored.managed.neglected).toEqual(repairedOriginal.managed.neglected);
  });
});

describe('facilityPersistence.ts — week and allocation round-trip', () => {
  it('edited allocation, the weekly flag, and completed week history survive', () => {
    const played = uglyGymViewState();
    expect(played.allocation).toEqual(Object.freeze(['cardio', 'hypertrophy', 'rest']));
    expect(played.allocationSetThisWeek).toBe(true);
    expect(played.weekIndex).toBeGreaterThan(0);
    expect(played.weekLog.length).toBeGreaterThan(0);
    expect(played.weekLog[0]?.allocation).toEqual(createRestAllocation());

    const restored = reload(played);
    expect(restored.allocation).toEqual(played.allocation);
    expect(restored.allocationSetThisWeek).toBe(true);
    expect(restored.weekIndex).toBe(played.weekIndex);
    expect(restored.weekIndex).toBe(
      Math.floor(restored.managed.gym.ladder.collectedAt / (T.DAYS_PER_TRAINING_WEEK * T.SECONDS_PER_DAY)),
    );
    expect(restored.weekLog).toEqual(played.weekLog);

    const advancedOriginal = dispatch(played, { kind: 'advance-to-next-week' });
    const advancedRestored = dispatch(restored, { kind: 'advance-to-next-week' });
    expect(advancedRestored.weekIndex).toBe(advancedOriginal.weekIndex);
    expect(advancedRestored.allocationSetThisWeek).toBe(false);
    expect(advancedRestored.weekLog).toEqual(advancedOriginal.weekLog);
    const last = advancedRestored.weekLog[advancedRestored.weekLog.length - 1];
    expect(last?.allocation).toEqual(Object.freeze(['cardio', 'hypertrophy', 'rest']));
  });
});

describe('facilityPersistence.ts — living-member history', () => {
  it('persists type, tenure, and visits that feed experience; names and ids are re-derived', () => {
    const played = uglyGymViewState();
    const member = played.livingMembers.members[0];
    expect(member).toBeDefined();
    if (member === undefined) return;
    expect(member.recentVisits).toHaveLength(1);
    expect(member.joinedAtSeconds).toBe(T.SECONDS_PER_DAY);
    const experience = livingMemberExperience(member.recentVisits);
    expect(experience.status).toBe('formed');
    expect(livingMemberExperience([]).status).toBe('forming');
    const retention = livingMemberRetentionPressure(experience);
    expect(retention.status).toBe('formed');

    const restored = reload(played);
    const restoredMember = restored.livingMembers.members[0];
    expect(restoredMember).toBeDefined();
    if (restoredMember === undefined) return;
    expect(restoredMember.id).toBe(member.id);
    expect(restoredMember.displayName).toBe(member.displayName);
    expect(restoredMember.type).toBe(member.type);
    expect(restoredMember.joinedAtSeconds).toBe(member.joinedAtSeconds);
    expect(restoredMember.recentVisits).toEqual(member.recentVisits);
    expect(livingMemberExperience(restoredMember.recentVisits)).toEqual(experience);
    expect(livingMemberRetentionPressure(livingMemberExperience(restoredMember.recentVisits))).toEqual(
      retention,
    );
    expect(deriveMemberId(restored.livingMembers.identityNonce, 0)).toBe(restoredMember.id);
    expect(memberOrdinalFromId(restoredMember.id)).toBe(0);

    const doubled = applyVisit(restored);
    expect(doubled.livingMembers.members[0]?.recentVisits).toHaveLength(2);
    expect(reload(played).livingMembers.members[0]?.recentVisits).toHaveLength(1);
  });

  it('proves visits are not yet a reducer departure mechanic', () => {
    const played = uglyGymViewState();
    const restored = reload(played);
    const afterClock = dispatch(restored, {
      kind: 'advance-clock',
      gapSeconds: T.SECONDS_PER_DAY,
      mode: 'online',
    });
    expect(afterClock.livingMembers.members.map((member) => member.id)).toEqual(
      restored.livingMembers.members.map((member) => member.id),
    );
    expect(afterClock.livingMembers.members.map((member) => member.recentVisits)).toEqual(
      restored.livingMembers.members.map((member) => member.recentVisits),
    );
  });
});

describe('facilityPersistence.ts — semantic save-loss and idempotence', () => {
  it('ugly gym round-trips the durable projection across a destroyed process', () => {
    const played = uglyGymViewState();
    expect(played.surface).toBe('build');
    expect(played.lastAccrual).not.toBeNull();
    const restored = reload(played);
    expect(restored.surface).toBe('play');
    expect(restored.lastAccrual).toBeNull();
    expect(restored.lastRefusal).toBeNull();
    expect(restored.lastManagementReport).toBeNull();
    expect(durableSemanticProjection(restored)).toEqual(durableSemanticProjection(played));
  });

  it('encode -> load -> encode is byte-identical; load is not gameplay', () => {
    const played = uglyGymViewState();
    const first = encodeFacilitySave(persistableGymTruthFromGymView(played));
    const loaded = decodeFacilitySave(first);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;
    const restored = restoreGymViewState(loaded.envelope.truth);
    const second = encodeFacilitySave(persistableGymTruthFromGymView(restored));
    expect(second).toBe(first);
    const reloaded = restoreGymViewState(
      decodeFacilitySave(second).kind === 'loaded'
        ? (decodeFacilitySave(second) as { readonly kind: 'loaded'; readonly envelope: { readonly truth: FacilitySaveTruthV1 } }).envelope.truth
        : persistableGymTruthFromGymView(createGymViewState()),
    );
    expect(durableSemanticProjection(reloaded)).toEqual(durableSemanticProjection(played));

    const again = dispatch(restored, { kind: 'buy-session', item: 'mats' });
    expect(again.lastRefusal).toBe('already-owned');
    const hired = dispatch(restored, { kind: 'hire-manager', tier: 'novice' });
    expect(hired.lastRefusal).toBe('already-staffed');
    const upgraded = dispatch(restored, {
      kind: 'upgrade-station',
      station: BAY,
      axis: 'capacity',
    });
    expect(upgraded.lastRefusal).toBe('already-upgraded');
    expect(restored.managed.strikes).toHaveLength(played.managed.strikes.length);
    expect(restored.weekIndex).toBe(played.weekIndex);
    expect(restored.managed.gym.ladder.collectedAt).toBe(played.managed.gym.ladder.collectedAt);
    expect(restored.capability).toEqual(played.capability);
    expect(restored.livingMembers.members[0]?.recentVisits).toHaveLength(1);
  });
});
