/**
 * gymHostPersistence.test.ts — host-owned save/load path.
 *
 * Empire encode/load/restore stay the authority for facility bytes. These
 * tests drive the HOST session: host envelope, savedThroughMs, async store,
 * bootstrap statuses, write queue, process-downtime catch-up, reset, remount.
 * They do not mount GymScreen and they do not import AsyncStorage.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  bayAxisLevels,
  decodeFacilitySave,
  persistableGymTruthFromGymView,
  presentationInputFromRestored,
  restoreDurableFacility,
  restoredPresentationWorld,
} from '../empire/facilityPersistence';
import { EMPIRE_TUNING } from '../empire/empireTuning';
import { stepFloorSim } from '../empire/floorSim';
import {
  createGymViewState,
  gymViewReduce,
  type GymViewAction,
  type GymViewState,
} from '../empire/ladderView';
import { livingMemberExperience } from '../empire/livingMemberExperience';
import { livingMemberRetentionPressure } from '../empire/livingMemberRetention';
import { failurePhase } from '../empire/management';
import { presentationWorld } from '../empire/presentationState';
import { sessionEquipmentCost } from '../empire/sessions';
import { COMPETITION_BENCH_BAY } from '../empire/trainingStation';
import {
  createGymHostSession,
  decodeHostSave,
  encodeGymView,
  encodeHostSave,
  GYM_HOST_SAVE_KIND,
  GYM_HOST_SAVE_SCHEMA_VERSION,
  hostOfflineGapSeconds,
  memoryDurableStore,
  type DurableByteStore,
  type GymHostSaveV1,
  type GymHostSession,
  type HostClock,
} from './gymHostPersistence';
import { createKeyValueDurableStore, GYM_HOST_SAVE_KEY } from './gymDurableStore';

const T = EMPIRE_TUNING;
const BAY = COMPETITION_BENCH_BAY;
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const EIGHT_HOURS_MS = 8 * T.SECONDS_PER_HOUR * T.MILLISECONDS_PER_SECOND;
const EIGHT_HOURS_SECONDS = 8 * T.SECONDS_PER_HOUR;
const READ_HOLD_MS = 45 * T.MILLISECONDS_PER_SECOND;

function source(relPath: string): string {
  return readFileSync(join(ROOT, relPath), 'utf8');
}

function fakeClock(startMs: number): HostClock & {
  readonly add: (deltaMs: number) => void;
  readonly read: () => number;
} {
  let ms = startMs;
  return {
    now: () => ms,
    add: (deltaMs) => {
      ms += deltaMs;
    },
    read: () => ms,
  };
}

function requirePlayable(session: GymHostSession): GymViewState {
  const state = session.playableState();
  if (state === null) {
    throw new Error(`expected playable gym, got ${session.snapshot().bootstrap.status}`);
  }
  return state;
}

function projection(state: GymViewState): unknown {
  return persistableGymTruthFromGymView(state);
}

function requireHostRecord(bytes: string | null): GymHostSaveV1 {
  const loaded = decodeHostSave(bytes);
  if (loaded.kind !== 'loaded') {
    throw new Error(`expected host record, got ${loaded.kind}`);
  }
  return loaded.record;
}

function offlineAdvance(state: GymViewState, gapSeconds: number): GymViewState {
  return gymViewReduce(state, {
    kind: 'advance-clock',
    gapSeconds,
    mode: 'offline',
  });
}

function createHoldableStore(initial: string | null = null): {
  readonly store: DurableByteStore;
  readonly inspect: () => string | null;
  readonly holdNextGet: () => void;
  readonly releaseGet: () => void;
  readonly rejectGet: (error: unknown) => void;
} {
  const inner = memoryDurableStore(initial);
  let getWait: Promise<void> = Promise.resolve();
  let release: (() => void) | null = null;
  let rejector: ((error: unknown) => void) | null = null;
  return {
    store: {
      get: async () => {
        await getWait;
        return inner.get();
      },
      set: (bytes) => inner.set(bytes),
    },
    inspect: inner.inspect,
    holdNextGet: () => {
      getWait = new Promise<void>((resolve, reject) => {
        release = resolve;
        rejector = reject;
      });
    },
    releaseGet: () => {
      release?.();
      release = null;
      rejector = null;
    },
    rejectGet: (error) => {
      rejector?.(error);
      release = null;
      rejector = null;
    },
  };
}

function createReleaseQueueStore(initial: string | null = null): {
  readonly store: DurableByteStore;
  readonly inspect: () => string | null;
  readonly pendingCount: () => number;
  readonly resolveNext: () => void;
  readonly rejectNext: (error: unknown) => void;
} {
  let bytes = initial;
  const waiting: Array<{
    readonly resolve: () => void;
    readonly reject: (error: unknown) => void;
  }> = [];
  return {
    store: {
      get: () =>
        new Promise<string | null>((resolve, reject) => {
          waiting.push({
            resolve: () => resolve(bytes),
            reject,
          });
        }),
      set: (next) =>
        new Promise<void>((resolve, reject) => {
          waiting.push({
            resolve: () => {
              bytes = next;
              resolve();
            },
            reject,
          });
        }),
    },
    inspect: () => bytes,
    pendingCount: () => waiting.length,
    resolveNext: () => {
      const job = waiting.shift();
      if (job === undefined) {
        throw new Error('no pending host io');
      }
      job.resolve();
    },
    rejectNext: (error) => {
      const job = waiting.shift();
      if (job === undefined) {
        throw new Error('no pending host io');
      }
      job.reject(error);
    },
  };
}

async function waitForPending(
  queued: { readonly pendingCount: () => number },
  label: string,
): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (queued.pendingCount() > 0) return;
    await Promise.resolve();
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function resolveQueuedUntilIdle(
  queued: {
    readonly pendingCount: () => number;
    readonly resolveNext: () => void;
  },
): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (queued.pendingCount() > 0) {
      queued.resolveNext();
    }
    await Promise.resolve();
  }
}

function applyVisit(session: GymHostSession): void {
  const member = requirePlayable(session).livingMembers.members[0];
  if (member === undefined) {
    throw new Error('opening gym has no living members');
  }
  const result = session.dispatch({
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
  expect(result).not.toBeNull();
}

async function playNonDefaultGym(session: GymHostSession): Promise<GymViewState> {
  const hours = T.DAYS_PER_TRAINING_WEEK * 24 + 12;
  expect(
    session.dispatch({
      kind: 'advance-clock',
      gapSeconds: hours * T.SECONDS_PER_HOUR,
      mode: 'online',
    }),
  ).not.toBeNull();
  const funded = requirePlayable(session);
  expect(funded.managed.gym.ladder.gymBucks).toBeGreaterThan(0);
  const spentBefore = funded.managed.gym.ladder.gymBucks;
  expect(session.dispatch({ kind: 'buy-session', item: 'mats' })).not.toBeNull();
  expect(requirePlayable(session).lastRefusal).toBeNull();
  expect(requirePlayable(session).managed.gym.ladder.gymBucks).toBeLessThan(spentBefore);
  expect(
    session.dispatch({
      kind: 'floor-place',
      item: 'mats',
      position: Object.freeze({ x: 0, y: 3 }),
    }),
  ).not.toBeNull();
  expect(requirePlayable(session).lastRefusal).toBeNull();
  expect(
    session.dispatch({
      kind: 'upgrade-station',
      station: BAY,
      axis: 'capacity',
    }),
  ).not.toBeNull();
  expect(requirePlayable(session).lastRefusal).toBeNull();
  expect(session.dispatch({ kind: 'hire-manager', tier: 'novice' })).not.toBeNull();
  expect(requirePlayable(session).lastRefusal).toBeNull();
  expect(
    session.dispatch({
      kind: 'set-allocation-slot',
      slotIndex: 0,
      slot: 'cardio',
    }),
  ).not.toBeNull();
  expect(
    session.dispatch({
      kind: 'set-allocation-slot',
      slotIndex: 1,
      slot: 'hypertrophy',
    }),
  ).not.toBeNull();
  applyVisit(session);
  const declined = session.dispatch({ kind: 'decline-repair', item: 'flat-bench' });
  expect(declined).not.toBeNull();
  await session.flushWrites();
  return requirePlayable(session);
}

async function savedOpeningAt(startMs: number): Promise<{
  readonly store: ReturnType<typeof memoryDurableStore>;
  readonly played: GymViewState;
}> {
  const store = memoryDurableStore();
  const session = createGymHostSession({ store, clock: fakeClock(startMs) });
  await session.bootstrap();
  expect(
    session.dispatch({
      kind: 'advance-clock',
      gapSeconds: 2 * T.SECONDS_PER_HOUR,
      mode: 'online',
    }),
  ).not.toBeNull();
  await session.flushWrites();
  return Object.freeze({ store, played: requirePlayable(session) });
}

describe('gymHostPersistence.ts — host/empire boundary', () => {
  it('host persistence names no platform storage APIs, and empire still does not', () => {
    const host = source('src/shell/gymHostPersistence.ts');
    const empire = source('src/empire/facilityPersistence.ts');
    const adapter = source('src/shell/gymDurableStore.ts');
    for (const banned of ['localStorage', 'AsyncStorage', 'react-native', 'expo-file-system']) {
      expect(host).not.toContain(banned);
    }
    expect(empire).not.toMatch(/from ['"]@react-native-async-storage/);
    expect(empire).not.toMatch(/from ['"]expo-file-system/);
    expect(empire).not.toContain(GYM_HOST_SAVE_KIND);
    expect(empire).not.toContain('savedThroughMs');
    expect(adapter).toContain('@react-native-async-storage/async-storage');
    expect(adapter).not.toMatch(/\blocalStorage\b/);
    expect(adapter).toContain(GYM_HOST_SAVE_KEY);
    expect(hostOfflineGapSeconds(8, 0)).toBe(0);
  });
});

describe('gymHostPersistence.ts — host envelope', () => {
  it('wraps exact Empire facility bytes and refuses a raw facility envelope', () => {
    const state = createGymViewState();
    const facilityBytes = encodeGymView(state);
    const wrapped = encodeHostSave(state, 1_000_000);
    const loaded = decodeHostSave(wrapped);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;
    expect(loaded.record.kind).toBe(GYM_HOST_SAVE_KIND);
    expect(loaded.record.schemaVersion).toBe(GYM_HOST_SAVE_SCHEMA_VERSION);
    expect(loaded.record.savedThroughMs).toBe(1_000_000);
    expect(loaded.record.facilityBytes).toBe(facilityBytes);
    expect(decodeFacilitySave(loaded.record.facilityBytes).kind).toBe('loaded');
    expect(decodeHostSave(facilityBytes)).toEqual({ kind: 'refused', reason: 'unknown-kind' });
  });

  it('refuses corrupt, unsupported, and incoherent host records', () => {
    expect(decodeHostSave('{')).toEqual({ kind: 'refused', reason: 'corrupt-json' });
    expect(decodeHostSave(JSON.stringify({ kind: 'other', schemaVersion: 1 }))).toEqual({
      kind: 'refused',
      reason: 'unknown-kind',
    });
    const state = createGymViewState();
    expect(
      decodeHostSave(
        JSON.stringify({
          kind: GYM_HOST_SAVE_KIND,
          schemaVersion: 2,
          savedThroughMs: 1,
          facilityBytes: encodeGymView(state),
        }),
      ),
    ).toEqual({ kind: 'refused', reason: 'unsupported-version' });
    expect(
      decodeHostSave(
        JSON.stringify({
          kind: GYM_HOST_SAVE_KIND,
          schemaVersion: 1,
          savedThroughMs: 1,
          facilityBytes: encodeGymView(state),
          extra: true,
        }),
      ),
    ).toEqual({ kind: 'refused', reason: 'incoherent' });
    expect(
      decodeHostSave(
        JSON.stringify({
          kind: GYM_HOST_SAVE_KIND,
          schemaVersion: 1,
          savedThroughMs: -1,
          facilityBytes: encodeGymView(state),
        }),
      ),
    ).toEqual({ kind: 'refused', reason: 'incoherent' });
    expect(
      decodeHostSave(
        JSON.stringify({
          kind: GYM_HOST_SAVE_KIND,
          schemaVersion: 1,
          savedThroughMs: 1.5,
          facilityBytes: encodeGymView(state),
        }),
      ),
    ).toEqual({ kind: 'refused', reason: 'incoherent' });
    expect(
      decodeHostSave(
        JSON.stringify({
          kind: GYM_HOST_SAVE_KIND,
          schemaVersion: 1,
          savedThroughMs: 1,
          facilityBytes: '{',
        }),
      ),
    ).toEqual({ kind: 'refused', reason: 'corrupt-json' });
  });
});

describe('gymHostPersistence.ts — bootstrap', () => {
  it('empty store is EMPTY, not a silent loaded gym, and then persists opening host bytes', async () => {
    const store = memoryDurableStore();
    const session = createGymHostSession({ store, clock: fakeClock(1_000_000) });
    expect(session.snapshot().bootstrap.status).toBe('LOADING');
    expect(session.dispatch({ kind: 'reset-gym' })).toBeNull();
    expect(session.catchUp('offline')).toBeNull();
    const booted = await session.bootstrap();
    expect(booted.bootstrap.status).toBe('EMPTY');
    if (booted.bootstrap.status !== 'EMPTY') return;
    expect(projection(booted.bootstrap.state)).toEqual(projection(createGymViewState()));
    await session.flushWrites();
    expect(store.inspect()).toBe(encodeHostSave(createGymViewState(), 1_000_000));
    const remount = createGymHostSession({ store, clock: fakeClock(1_000_000) });
    const again = await remount.bootstrap();
    expect(again.bootstrap.status).toBe('LOADED');
    if (again.bootstrap.status !== 'LOADED') return;
    expect(projection(again.bootstrap.state)).toEqual(projection(createGymViewState()));
    expect(again.bootstrap.state.lastAccrual).toBeNull();
  });

  it('valid store restores LOADED from restoreGymViewState', async () => {
    const opening = createGymViewState();
    const funded = createGymHostSession({
      store: memoryDurableStore(),
      clock: fakeClock(1_000_000),
    });
    await funded.bootstrap();
    expect(
      funded.dispatch({
        kind: 'advance-clock',
        gapSeconds: 4 * T.SECONDS_PER_HOUR,
        mode: 'online',
      }),
    ).not.toBeNull();
    await funded.flushWrites();
    const played = requirePlayable(funded);
    const store = memoryDurableStore(encodeHostSave(played, 3_000_000));
    const session = createGymHostSession({ store, clock: fakeClock(3_000_000) });
    const booted = await session.bootstrap();
    expect(booted.bootstrap.status).toBe('LOADED');
    if (booted.bootstrap.status !== 'LOADED') return;
    expect(projection(booted.bootstrap.state)).toEqual(projection(played));
    expect(projection(booted.bootstrap.state)).not.toEqual(projection(opening));
  });

  it('corrupt bytes are REFUSED and are not overwritten', async () => {
    const store = memoryDurableStore('{');
    const session = createGymHostSession({ store, clock: fakeClock(1_000_000) });
    const booted = await session.bootstrap();
    expect(booted.bootstrap.status).toBe('REFUSED');
    if (booted.bootstrap.status !== 'REFUSED') return;
    expect(booted.bootstrap.reason).toBe('corrupt-json');
    expect(session.playableState()).toBeNull();
    expect(session.dispatch({ kind: 'hire-manager', tier: 'novice' })).toBeNull();
    await session.flushWrites();
    expect(store.inspect()).toBe('{');
  });

  it('unsupported version is REFUSED and does not mint an opening gym', async () => {
    const bytes = JSON.stringify({
      kind: GYM_HOST_SAVE_KIND,
      schemaVersion: 2,
      savedThroughMs: 1,
      facilityBytes: encodeGymView(createGymViewState()),
    });
    const store = memoryDurableStore(bytes);
    const session = createGymHostSession({ store, clock: fakeClock(1_000_000) });
    const booted = await session.bootstrap();
    expect(booted.bootstrap).toEqual(
      Object.freeze({ status: 'REFUSED', reason: 'unsupported-version' }),
    );
    expect(store.inspect()).toBe(bytes);
    expect(session.playableState()).toBeNull();
  });

  it('read failure is READ_FAILED, not EMPTY', async () => {
    const store: DurableByteStore = {
      get: async () => {
        throw new Error('permission denied');
      },
      set: async () => {
        throw new Error('should not write');
      },
    };
    const session = createGymHostSession({ store, clock: fakeClock(1_000_000) });
    const booted = await session.bootstrap();
    expect(booted.bootstrap.status).toBe('READ_FAILED');
    if (booted.bootstrap.status !== 'READ_FAILED') return;
    expect(booted.bootstrap.message).toBe('permission denied');
    expect(session.playableState()).toBeNull();
    expect(session.dispatch({ kind: 'reset-gym' })).toBeNull();
  });

  it('bootstrap is idempotent and does not re-read into a second gym', async () => {
    const store = memoryDurableStore();
    const session = createGymHostSession({ store, clock: fakeClock(1_000_000) });
    const first = await session.bootstrap();
    const second = await session.bootstrap();
    expect(second).toBe(first);
    expect(session.snapshot().bootstrap.status).toBe('EMPTY');
  });
});

describe('gymHostPersistence.ts — clock ordering', () => {
  it('a slow storage read does not mint idle accrual on top of restored collectedAt', async () => {
    const prep = createGymHostSession({
      store: memoryDurableStore(),
      clock: fakeClock(0),
    });
    await prep.bootstrap();
    expect(
      prep.dispatch({
        kind: 'advance-clock',
        gapSeconds: 6 * T.SECONDS_PER_HOUR,
        mode: 'online',
      }),
    ).not.toBeNull();
    await prep.flushWrites();
    const played = requirePlayable(prep);
    const mark = played.managed.gym.ladder.collectedAt;
    expect(mark).toBeGreaterThan(0);

    const held = createHoldableStore(encodeHostSave(played, 10_000_000));
    const clock = fakeClock(10_000_000);
    held.holdNextGet();
    const session = createGymHostSession({ store: held.store, clock });
    const pending = session.bootstrap();
    expect(session.snapshot().bootstrap.status).toBe('LOADING');
    expect(session.catchUp('offline')).toBeNull();
    clock.add(READ_HOLD_MS);
    held.releaseGet();
    const booted = await pending;
    expect(booted.bootstrap.status).toBe('LOADED');
    if (booted.bootstrap.status !== 'LOADED') return;
    expect(booted.bootstrap.state.managed.gym.ladder.collectedAt).toBe(mark);
    expect(booted.realtimeAnchorMs).toBe(10_000_000 + READ_HOLD_MS);
    const zero = session.catchUp('offline');
    expect(zero).not.toBeNull();
    expect(requirePlayable(session).managed.gym.ladder.collectedAt).toBe(mark);
    clock.add(5 * T.MILLISECONDS_PER_SECOND);
    const later = session.catchUp('offline');
    expect(later).not.toBeNull();
    expect(requirePlayable(session).managed.gym.ladder.collectedAt).toBe(mark + 5);
  });
});

describe('gymHostPersistence.ts — cold-start elapsed continuity', () => {
  it('8h process downtime is paid once as offline, and 45s storage latency is not', async () => {
    const startMs = 50_000_000;
    const { store, played } = await savedOpeningAt(startMs);
    const mark = played.managed.gym.ladder.collectedAt;
    const saved = requireHostRecord(store.inspect());
    expect(saved.savedThroughMs).toBe(startMs);
    expect(saved.facilityBytes).toBe(encodeGymView(played));
    expect(mark).not.toBe(saved.savedThroughMs);

    const held = createHoldableStore(store.inspect());
    const clock = fakeClock(startMs + EIGHT_HOURS_MS);
    held.holdNextGet();
    const session = createGymHostSession({ store: held.store, clock });
    const pending = session.bootstrap();
    expect(hostOfflineGapSeconds(clock.read(), saved.savedThroughMs)).toBe(EIGHT_HOURS_SECONDS);
    clock.add(READ_HOLD_MS);
    held.releaseGet();
    const booted = await pending;
    expect(booted.bootstrap.status).toBe('LOADED');
    if (booted.bootstrap.status !== 'LOADED') return;
    const expected = offlineAdvance(played, EIGHT_HOURS_SECONDS);
    expect(booted.bootstrap.state.managed.gym.ladder.collectedAt).toBe(mark + EIGHT_HOURS_SECONDS);
    expect(projection(booted.bootstrap.state)).toEqual(projection(expected));
    expect(booted.bootstrap.state.lastAccrual).toEqual(expected.lastAccrual);
    expect(booted.bootstrap.state.lastAccrual?.secondsElapsed).toBe(EIGHT_HOURS_SECONDS);
    expect(booted.bootstrap.state.lastAccrual?.secondsBanked).toBe(EIGHT_HOURS_SECONDS);
    expect(booted.bootstrap.state.lastAccrual?.secondsDiscarded).toBe(0);
    expect(booted.bootstrap.state.managed.gym.ladder.gymBucks).toBe(
      expected.managed.gym.ladder.gymBucks,
    );
    expect(booted.bootstrap.state.managed.condition).toEqual(expected.managed.condition);
    expect(booted.realtimeAnchorMs).toBe(startMs + EIGHT_HOURS_MS + READ_HOLD_MS);
    const durable = requireHostRecord(held.inspect());
    expect(durable.savedThroughMs).toBe(startMs + EIGHT_HOURS_MS + READ_HOLD_MS);
    expect(durable.facilityBytes).toBe(encodeGymView(booted.bootstrap.state));
    expect(session.catchUp('offline')).not.toBeNull();
    expect(requirePlayable(session).managed.gym.ladder.collectedAt).toBe(mark + EIGHT_HOURS_SECONDS);
  });

  it('immediate remount with elapsed 0 mints nothing', async () => {
    const startMs = 7_000_000;
    const { store, played } = await savedOpeningAt(startMs);
    const remount = createGymHostSession({ store, clock: fakeClock(startMs) });
    const booted = await remount.bootstrap();
    expect(booted.bootstrap.status).toBe('LOADED');
    if (booted.bootstrap.status !== 'LOADED') return;
    expect(projection(booted.bootstrap.state)).toEqual(projection(played));
    expect(booted.bootstrap.state.lastAccrual).toBeNull();
    expect(booted.bootstrap.state.managed.gym.ladder.collectedAt).toBe(
      played.managed.gym.ladder.collectedAt,
    );
  });

  it('a long absence reports the full elapsed gap and banks only the existing offline cap', async () => {
    const startMs = 8_000_000;
    const { store, played } = await savedOpeningAt(startMs);
    const elapsedHours = T.OFFLINE_EARNINGS_CAP_HOURS + 8;
    const elapsedSeconds = elapsedHours * T.SECONDS_PER_HOUR;
    const remount = createGymHostSession({
      store,
      clock: fakeClock(startMs + elapsedSeconds * T.MILLISECONDS_PER_SECOND),
    });
    const booted = await remount.bootstrap();
    expect(booted.bootstrap.status).toBe('LOADED');
    if (booted.bootstrap.status !== 'LOADED') return;
    const expected = offlineAdvance(played, elapsedSeconds);
    expect(booted.bootstrap.state.lastAccrual).toEqual(expected.lastAccrual);
    expect(booted.bootstrap.state.lastAccrual?.secondsElapsed).toBe(elapsedSeconds);
    expect(booted.bootstrap.state.lastAccrual?.secondsBanked).toBe(
      T.OFFLINE_EARNINGS_CAP_HOURS * T.SECONDS_PER_HOUR,
    );
    expect(booted.bootstrap.state.lastAccrual?.secondsDiscarded).toBe(EIGHT_HOURS_SECONDS);
    expect(booted.bootstrap.state.managed.gym.ladder.collectedAt).toBe(
      played.managed.gym.ladder.collectedAt + elapsedSeconds,
    );
    expect(booted.bootstrap.state.managed.gym.ladder.gymBucks).toBe(
      expected.managed.gym.ladder.gymBucks,
    );
    expect(projection(booted.bootstrap.state)).toEqual(projection(expected));
  });

  it('a wall clock moving backwards yields no gap and does not refuse the save', async () => {
    const startMs = 9_000_000;
    const { store, played } = await savedOpeningAt(startMs);
    const remount = createGymHostSession({ store, clock: fakeClock(startMs - 10_000) });
    const booted = await remount.bootstrap();
    expect(booted.bootstrap.status).toBe('LOADED');
    if (booted.bootstrap.status !== 'LOADED') return;
    expect(projection(booted.bootstrap.state)).toEqual(projection(played));
    expect(booted.bootstrap.state.lastAccrual).toBeNull();
    expect(sessionEquipmentCost('mats')).toBeGreaterThan(0);
  });

  it('repeated boot cannot pay the same elapsed real time twice', async () => {
    const startMs = 11_000_000;
    const { store, played } = await savedOpeningAt(startMs);
    const first = createGymHostSession({
      store,
      clock: fakeClock(startMs + EIGHT_HOURS_MS),
    });
    const once = await first.bootstrap();
    expect(once.bootstrap.status).toBe('LOADED');
    if (once.bootstrap.status !== 'LOADED') return;
    const afterOnce = once.bootstrap.state.managed.gym.ladder.collectedAt;
    expect(afterOnce).toBe(played.managed.gym.ladder.collectedAt + EIGHT_HOURS_SECONDS);
    const second = createGymHostSession({
      store,
      clock: fakeClock(requireHostRecord(store.inspect()).savedThroughMs),
    });
    const twice = await second.bootstrap();
    expect(twice.bootstrap.status).toBe('LOADED');
    if (twice.bootstrap.status !== 'LOADED') return;
    expect(twice.bootstrap.state.managed.gym.ladder.collectedAt).toBe(afterOnce);
    expect(twice.bootstrap.state.lastAccrual).toBeNull();
  });
});

describe('gymHostPersistence.ts — writes', () => {
  it('write failure keeps in-memory mutation and does not claim success', async () => {
    let failWrite = false;
    const inner = memoryDurableStore();
    const store: DurableByteStore = {
      get: () => inner.get(),
      set: async (bytes) => {
        if (failWrite) throw new Error('disk full');
        await inner.set(bytes);
      },
    };
    const session = createGymHostSession({ store, clock: fakeClock(1_000_000) });
    await session.bootstrap();
    failWrite = true;
    const before = requirePlayable(session).managed.gym.ladder.gymBucks;
    expect(
      session.dispatch({
        kind: 'advance-clock',
        gapSeconds: 4 * T.SECONDS_PER_HOUR,
        mode: 'online',
      }),
    ).not.toBeNull();
    const flushed = await session.flushWrites();
    expect(flushed.write.kind).toBe('failed');
    if (flushed.write.kind !== 'failed') return;
    expect(flushed.write.message).toBe('disk full');
    expect(requirePlayable(session).managed.gym.ladder.gymBucks).toBeGreaterThan(before);
    expect(inner.inspect()).toBe(encodeHostSave(createGymViewState(), 1_000_000));
  });

  it('a failed catch-up write leaves the previous coherent host pair durable', async () => {
    const startMs = 12_000_000;
    const { store: inner, played } = await savedOpeningAt(startMs);
    const original = inner.inspect();
    const store: DurableByteStore = {
      get: () => inner.get(),
      set: async () => {
        throw new Error('disk full');
      },
    };
    const failed = createGymHostSession({
      store,
      clock: fakeClock(startMs + EIGHT_HOURS_MS),
    });
    const booted = await failed.bootstrap();
    expect(booted.bootstrap.status).toBe('LOADED');
    if (booted.bootstrap.status !== 'LOADED') return;
    expect(booted.write.kind).toBe('failed');
    expect(booted.bootstrap.state.managed.gym.ladder.collectedAt).toBe(
      played.managed.gym.ladder.collectedAt + EIGHT_HOURS_SECONDS,
    );
    expect(inner.inspect()).toBe(original);
    expect(requireHostRecord(inner.inspect()).savedThroughMs).toBe(startMs);
    expect(requireHostRecord(inner.inspect()).facilityBytes).toBe(encodeGymView(played));

    const recovered = createGymHostSession({
      store: inner,
      clock: fakeClock(startMs + EIGHT_HOURS_MS),
    });
    const again = await recovered.bootstrap();
    expect(again.bootstrap.status).toBe('LOADED');
    if (again.bootstrap.status !== 'LOADED') return;
    expect(again.bootstrap.state.managed.gym.ladder.collectedAt).toBe(
      played.managed.gym.ladder.collectedAt + EIGHT_HOURS_SECONDS,
    );
    const durable = requireHostRecord(inner.inspect());
    expect(durable.savedThroughMs).toBe(startMs + EIGHT_HOURS_MS);
    expect(durable.facilityBytes).toBe(encodeGymView(again.bootstrap.state));
  });

  it('a newer committed state wins even if the older write is still in flight', async () => {
    const queued = createReleaseQueueStore();
    const clock = fakeClock(1_000_000);
    const session = createGymHostSession({ store: queued.store, clock });
    const boot = session.bootstrap();
    await waitForPending(queued, 'bootstrap get');
    queued.resolveNext();
    await waitForPending(queued, 'opening persist');
    queued.resolveNext();
    await boot;
    await resolveQueuedUntilIdle(queued);
    await session.flushWrites();

    const actionA: GymViewAction = {
      kind: 'advance-clock',
      gapSeconds: 2 * T.SECONDS_PER_HOUR,
      mode: 'online',
    };
    const actionB: GymViewAction = {
      kind: 'advance-clock',
      gapSeconds: 3 * T.SECONDS_PER_HOUR,
      mode: 'online',
    };
    expect(session.dispatch(actionA)).not.toBeNull();
    const afterA = encodeHostSave(requirePlayable(session), 1_000_000);
    expect(session.dispatch(actionB)).not.toBeNull();
    const afterB = encodeHostSave(requirePlayable(session), 1_000_000);
    expect(afterB).not.toBe(afterA);
    await resolveQueuedUntilIdle(queued);
    await session.flushWrites();
    expect(queued.inspect()).toBe(afterB);
    const loaded = decodeHostSave(queued.inspect());
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;
    expect(loaded.record.savedThroughMs).toBe(1_000_000);
    expect(decodeFacilitySave(loaded.record.facilityBytes).kind).toBe('loaded');
    expect(loaded.record.facilityBytes).toBe(encodeGymView(requirePlayable(session)));
  });
});

describe('gymHostPersistence.ts — reset', () => {
  it('reset-gym replaces durable bytes with the opening gym so remount cannot resurrect the old one', async () => {
    const store = memoryDurableStore();
    const session = createGymHostSession({ store, clock: fakeClock(1_000_000) });
    await session.bootstrap();
    const played = await playNonDefaultGym(session);
    expect(projection(played)).not.toEqual(projection(createGymViewState()));
    expect(store.inspect()).toBe(encodeHostSave(played, 1_000_000));
    expect(session.dispatch({ kind: 'reset-gym' })).not.toBeNull();
    await session.flushWrites();
    const openingBytes = encodeHostSave(createGymViewState(), 1_000_000);
    expect(store.inspect()).toBe(openingBytes);
    expect(projection(requirePlayable(session))).toEqual(projection(createGymViewState()));
    const remount = createGymHostSession({ store, clock: fakeClock(1_000_000) });
    const booted = await remount.bootstrap();
    expect(booted.bootstrap.status).toBe('LOADED');
    if (booted.bootstrap.status !== 'LOADED') return;
    expect(projection(booted.bootstrap.state)).toEqual(projection(createGymViewState()));
    expect(booted.bootstrap.state.managed.manager).toBeNull();
    expect(bayAxisLevels(booted.bootstrap.state.capability).capacity).toBe(0);

    const later = createGymHostSession({
      store,
      clock: fakeClock(1_000_000 + EIGHT_HOURS_MS),
    });
    const laterBoot = await later.bootstrap();
    expect(laterBoot.bootstrap.status).toBe('LOADED');
    if (laterBoot.bootstrap.status !== 'LOADED') return;
    expect(laterBoot.bootstrap.state.managed.manager).toBeNull();
    expect(laterBoot.bootstrap.state.managed.gym.sessionEquipment).toEqual([]);
    expect(laterBoot.bootstrap.state.managed.gym.ladder.collectedAt).toBe(EIGHT_HOURS_SECONDS);
  });
});

describe('gymHostPersistence.ts — remount of a non-default gym', () => {
  it('survives a real host remount and then accepts a new action', async () => {
    const store = memoryDurableStore();
    const first = createGymHostSession({ store, clock: fakeClock(1_000_000) });
    await first.bootstrap();
    const played = await playNonDefaultGym(first);
    expect(played.managed.gym.sessionEquipment).toEqual(['mats']);
    expect(played.floor.placements.mats).toEqual({ x: 0, y: 3 });
    expect(bayAxisLevels(played.capability)).toEqual(
      Object.freeze({ quality: 0, capacity: 1, throughput: 0 }),
    );
    expect(played.managed.manager?.tier).toBe('novice');
    expect(played.allocationSetThisWeek).toBe(true);
    expect(played.allocation[0]).toBe('cardio');
    expect(played.weekIndex).toBeGreaterThan(0);
    const member = played.livingMembers.members[0];
    expect(member).toBeDefined();
    if (member === undefined) return;
    expect(member.recentVisits.length).toBeGreaterThan(0);
    const beforeExperience = livingMemberExperience(member.recentVisits);
    const beforeRetention = livingMemberRetentionPressure(beforeExperience);
    const savedThroughMs = requireHostRecord(store.inspect()).savedThroughMs;
    expect(store.inspect()).toBe(encodeHostSave(played, savedThroughMs));

    const remount = createGymHostSession({ store, clock: fakeClock(savedThroughMs) });
    const booted = await remount.bootstrap();
    expect(booted.bootstrap.status).toBe('LOADED');
    if (booted.bootstrap.status !== 'LOADED') return;
    const restored = booted.bootstrap.state;
    expect(projection(restored)).toEqual(projection(played));
    expect(bayAxisLevels(restored.capability)).toEqual(bayAxisLevels(played.capability));
    expect(restored.managed.manager).toEqual(played.managed.manager);
    expect(restored.allocation).toEqual(played.allocation);
    expect(restored.weekLog).toEqual(played.weekLog);
    const restoredMember = restored.livingMembers.members[0];
    expect(restoredMember).toBeDefined();
    if (restoredMember === undefined) return;
    expect(restoredMember.recentVisits).toEqual(member.recentVisits);
    expect(livingMemberExperience(restoredMember.recentVisits)).toEqual(beforeExperience);
    expect(livingMemberRetentionPressure(livingMemberExperience(restoredMember.recentVisits))).toEqual(
      beforeRetention,
    );
    expect(restored.surface).toBe('play');
    expect(failurePhase(restored.managed)).toBe(failurePhase(played.managed));

    const restoredFacility = restoreDurableFacility(persistableGymTruthFromGymView(restored));
    const input = presentationInputFromRestored(restoredFacility);
    expect(input.sim.tick).toBe(0);
    expect(input.sim.members.every((body) => body.state === 'seeking')).toBe(true);
    let sim = input.sim;
    const context = Object.freeze({
      rung: restoredFacility.floor.rung,
      floor: restoredFacility.floor,
      barbellOwned: restoredFacility.managed.gym.ladder.equipment,
      sessionOwned: restoredFacility.managed.gym.sessionEquipment,
      capability: restoredFacility.capability,
      livingPopulation: input.sim.members.map((body) =>
        Object.freeze({ memberId: body.memberId, type: body.type }),
      ),
    });
    for (let tick = 0; tick < 240; tick += 1) {
      sim = stepFloorSim(sim, context);
    }
    expect(sim.tick).toBe(240);
    const world = presentationWorld(
      Object.freeze({
        sim,
        floor: restoredFacility.floor,
        roster: restoredFacility.roster,
        managed: restoredFacility.managed,
        capability: restoredFacility.capability,
      }),
    );
    const openingWorld = restoredPresentationWorld(persistableGymTruthFromGymView(restored));
    expect(openingWorld.business.usingCount).toBe(0);
    for (const station of [...openingWorld.stations, ...world.stations]) {
      expect(station.usingIds.length).toBeLessThanOrEqual(station.capacity);
    }

    const bucksBefore = restored.managed.gym.ladder.gymBucks;
    expect(
      remount.dispatch({
        kind: 'advance-clock',
        gapSeconds: 2 * T.SECONDS_PER_HOUR,
        mode: 'online',
      }),
    ).not.toBeNull();
    await remount.flushWrites();
    const continued = requirePlayable(remount);
    expect(continued.managed.gym.ladder.gymBucks).toBeGreaterThan(bucksBefore);
    expect(continued.managed.gym.ladder.collectedAt).toBeGreaterThan(
      restored.managed.gym.ladder.collectedAt,
    );
    const continuedThrough = requireHostRecord(store.inspect()).savedThroughMs;
    expect(store.inspect()).toBe(encodeHostSave(continued, continuedThrough));

    const third = createGymHostSession({ store, clock: fakeClock(continuedThrough) });
    const again = await third.bootstrap();
    expect(again.bootstrap.status).toBe('LOADED');
    if (again.bootstrap.status !== 'LOADED') return;
    expect(projection(again.bootstrap.state)).toEqual(projection(continued));
  });

  it('in-app continuation uses the same session and does not re-bootstrap from bytes', async () => {
    const store = memoryDurableStore();
    const session = createGymHostSession({ store, clock: fakeClock(1_000_000) });
    await session.bootstrap();
    expect(
      session.dispatch({
        kind: 'advance-clock',
        gapSeconds: T.SECONDS_PER_HOUR,
        mode: 'online',
      }),
    ).not.toBeNull();
    const inMemory = requirePlayable(session).managed.gym.ladder.gymBucks;
    await session.flushWrites();
    expect(session.snapshot().bootstrap.status).toBe('EMPTY');
    expect(requirePlayable(session).managed.gym.ladder.gymBucks).toBe(inMemory);
  });
});

describe('gymDurableStore.ts — injected key-value adapter', () => {
  it('reads and writes the gym-empire host key and nothing else', async () => {
    const table = new Map<string, string>();
    const storage = {
      getItem: async (key: string) => table.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        table.set(key, value);
      },
    };
    const store = createKeyValueDurableStore(storage);
    expect(await store.get()).toBeNull();
    const bytes = encodeHostSave(createGymViewState(), 1);
    await store.set(bytes);
    expect(table.get(GYM_HOST_SAVE_KEY)).toBe(bytes);
    expect(table.size).toBe(1);
    expect(await store.get()).toBe(bytes);
    expect(sessionEquipmentCost('mats')).toBeGreaterThan(0);
  });
});
