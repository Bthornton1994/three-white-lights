/**
 * gymHostPersistence.ts — host-owned durable I/O around Empire save/load.
 *
 * This file is the host. It is not Empire.
 *
 *   EMPIRE (sync, no I/O): encodeFacilitySave, loadFacilitySave, restoreGymViewState
 *   HOST  (async I/O):     await/read durable bytes, call Empire, await/write bytes
 *
 * Encode/decode stay synchronous. They do not become async because storage
 * I/O is async. Platform storage APIs and DOM globals live in
 * gymDurableStore.ts, if at all — not here.
 *
 * The durable value is a host record, not raw Empire bytes:
 *   kind, schemaVersion, savedThroughMs, facilityBytes
 * facilityBytes is exactly encodeFacilitySave(...). Empire knows nothing
 * about the wrapper. savedThroughMs is wall-clock milliseconds through which
 * elapsed time has been applied or waived. It is not LadderState.collectedAt
 * and the two numbers must never be compared as if they were one clock.
 *
 * Bootstrap statuses:
 *   LOADING — durable read has not settled; player mutations are refused
 *   LOADED  — restoreGymViewState from decoded bytes, once, then one offline
 *             advance-clock for genuine process downtime
 *   EMPTY   — store had no bytes; createGymViewState once. Empty is empty,
 *             not a silent pretence that a save existed
 *   REFUSED — corrupt / unknown / unsupported / incoherent bytes. Stays
 *             refused. Does not overwrite the bad bytes with an opening gym
 *   READ_FAILED — storage get() rejected. Not treated as a new player
 *
 * Clock, process downtime:
 *   bootStartedMs is read before awaiting storage.
 *   offlineGapMs = max(0, bootStartedMs - savedThroughMs)
 *   Storage-read duration is not in that gap. After restore + optional
 *   offline advance-clock, realtimeAnchorMs = clock.now() and the host
 *   record is rewritten with that new savedThroughMs so the waived read
 *   is not paid later.
 *
 * Write order: a serialized queue plus a monotonic generation. An older
 * write cannot remain the durable bytes after a newer committed state.
 * Every durable write is one host record (savedThroughMs + facilityBytes)
 * so state and wall mark cannot tear across two keys.
 *
 * Ordinary non-clock mutations reuse the current accounted-through anchor.
 * They do not stamp a fresh wall time, which would drop unprocessed elapsed
 * time between the anchor and the mutation.
 *
 * Reset: `reset-gym` persists opening Empire truth plus the current
 * accounted-through wall mark. Remount must not resurrect the pre-reset gym.
 *
 * AppState / OS-background durability is not claimed here. In-app away/back
 * keeps the same in-memory session (GymHost stays mounted). A new
 * GymHostSession against the same store is the remount boundary this file
 * actually executes.
 */

import {
  encodeFacilitySave,
  loadFacilitySave,
  persistableGymTruthFromGymView,
  restoreGymViewState,
  type FacilityLoadRefuseReason,
} from '../empire/facilityPersistence';
import { EMPIRE_TUNING } from '../empire/empireTuning';
import { type EarningsMode } from '../empire/ladder';
import {
  createGymViewState,
  gymViewReduce,
  type GymViewAction,
  type GymViewState,
} from '../empire/ladderView';

export const GYM_HOST_SAVE_KIND = 'gym-empire-host' as const;
export const GYM_HOST_SAVE_SCHEMA_VERSION = 1 as const;

const HOST_SAVE_FIELDS = Object.freeze([
  'kind',
  'schemaVersion',
  'savedThroughMs',
  'facilityBytes',
] as const);

export interface GymHostSaveV1 {
  readonly kind: typeof GYM_HOST_SAVE_KIND;
  readonly schemaVersion: typeof GYM_HOST_SAVE_SCHEMA_VERSION;
  readonly savedThroughMs: number;
  readonly facilityBytes: string;
}

export type GymHostLoadResult =
  | { readonly kind: 'loaded'; readonly record: GymHostSaveV1 }
  | { readonly kind: 'empty' }
  | { readonly kind: 'refused'; readonly reason: FacilityLoadRefuseReason };

export interface DurableByteStore {
  readonly get: () => Promise<string | null>;
  readonly set: (bytes: string) => Promise<void>;
}

export interface HostClock {
  readonly now: () => number;
}

export type GymHostWriteStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'pending'; readonly generation: number }
  | { readonly kind: 'ok'; readonly generation: number }
  | { readonly kind: 'failed'; readonly generation: number; readonly message: string };

export type GymHostBootstrap =
  | { readonly status: 'LOADING' }
  | { readonly status: 'LOADED'; readonly state: GymViewState }
  | { readonly status: 'EMPTY'; readonly state: GymViewState }
  | { readonly status: 'REFUSED'; readonly reason: FacilityLoadRefuseReason }
  | { readonly status: 'READ_FAILED'; readonly message: string };

export interface GymHostSnapshot {
  readonly bootstrap: GymHostBootstrap;
  readonly write: GymHostWriteStatus;
  readonly realtimeAnchorMs: number | null;
}

export interface MemoryDurableStore extends DurableByteStore {
  readonly inspect: () => string | null;
}

export interface GymHostSession {
  readonly snapshot: () => GymHostSnapshot;
  readonly bootstrap: () => Promise<GymHostSnapshot>;
  readonly dispatch: (action: GymViewAction) => GymHostSnapshot | null;
  readonly catchUp: (mode: EarningsMode) => GymHostSnapshot | null;
  readonly flushWrites: () => Promise<GymHostSnapshot>;
  readonly playableState: () => GymViewState | null;
}

export function memoryDurableStore(initial: string | null = null): MemoryDurableStore {
  let bytes: string | null = initial;
  return {
    get: async () => bytes,
    set: async (next) => {
      bytes = next;
    },
    inspect: () => bytes,
  };
}

export function encodeGymView(state: GymViewState): string {
  return encodeFacilitySave(persistableGymTruthFromGymView(state));
}

export function encodeHostSave(state: GymViewState, savedThroughMs: number): string {
  return encodeHostRecord(savedThroughMs, encodeGymView(state));
}

export function encodeHostRecord(savedThroughMs: number, facilityBytes: string): string {
  if (!Number.isSafeInteger(savedThroughMs) || savedThroughMs < 0) {
    throw new RangeError(
      `host savedThroughMs must be a non-negative safe integer, received ${savedThroughMs}`,
    );
  }
  if (facilityBytes.length === 0) {
    throw new RangeError('host facilityBytes must not be empty');
  }
  const record: GymHostSaveV1 = Object.freeze({
    kind: GYM_HOST_SAVE_KIND,
    schemaVersion: GYM_HOST_SAVE_SCHEMA_VERSION,
    savedThroughMs,
    facilityBytes,
  });
  return JSON.stringify(record);
}

export function decodeHostSave(bytes: string | null): GymHostLoadResult {
  if (bytes === null || bytes.length === 0) {
    return Object.freeze({ kind: 'empty' });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes) as unknown;
  } catch {
    return Object.freeze({ kind: 'refused', reason: 'corrupt-json' });
  }
  if (!isRecord(parsed)) {
    return Object.freeze({ kind: 'refused', reason: 'corrupt-json' });
  }
  if (parsed.kind !== GYM_HOST_SAVE_KIND) {
    return Object.freeze({ kind: 'refused', reason: 'unknown-kind' });
  }
  if (parsed.schemaVersion !== GYM_HOST_SAVE_SCHEMA_VERSION) {
    return Object.freeze({ kind: 'refused', reason: 'unsupported-version' });
  }
  if (!exactKeys(parsed, HOST_SAVE_FIELDS)) {
    return Object.freeze({ kind: 'refused', reason: 'incoherent' });
  }
  if (!isSavedThroughMs(parsed.savedThroughMs) || typeof parsed.facilityBytes !== 'string') {
    return Object.freeze({ kind: 'refused', reason: 'incoherent' });
  }
  if (parsed.facilityBytes.length === 0) {
    return Object.freeze({ kind: 'refused', reason: 'incoherent' });
  }
  const facility = loadFacilitySave(parsed.facilityBytes);
  if (facility.kind !== 'loaded') {
    return Object.freeze({
      kind: 'refused',
      reason: facility.kind === 'empty' ? 'incoherent' : facility.reason,
    });
  }
  return Object.freeze({
    kind: 'loaded',
    record: Object.freeze({
      kind: GYM_HOST_SAVE_KIND,
      schemaVersion: GYM_HOST_SAVE_SCHEMA_VERSION,
      savedThroughMs: parsed.savedThroughMs,
      facilityBytes: parsed.facilityBytes,
    }),
  });
}

/** Wall-clock gap the host may hand to existing advance-clock. Storage wait is not an input. */
export function hostOfflineGapSeconds(bootStartedMs: number, savedThroughMs: number): number {
  const gapMs = Math.max(0, bootStartedMs - savedThroughMs);
  return Math.floor(gapMs / EMPIRE_TUNING.MILLISECONDS_PER_SECOND);
}

function isSavedThroughMs(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, fields: readonly string[]): boolean {
  const keys = Object.keys(value);
  if (keys.length !== fields.length) return false;
  return fields.every((field) => Object.prototype.hasOwnProperty.call(value, field));
}

function playableStatus(
  bootstrap: GymHostBootstrap,
): bootstrap is
  | { readonly status: 'LOADED'; readonly state: GymViewState }
  | { readonly status: 'EMPTY'; readonly state: GymViewState } {
  return bootstrap.status === 'LOADED' || bootstrap.status === 'EMPTY';
}

function writeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return 'gym durable write failed';
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return 'gym durable read failed';
}

function freezeSnapshot(snapshot: GymHostSnapshot): GymHostSnapshot {
  return Object.freeze({
    bootstrap: Object.freeze(snapshot.bootstrap),
    write: Object.freeze(snapshot.write),
    realtimeAnchorMs: snapshot.realtimeAnchorMs,
  });
}

function applyOfflineProcessGap(state: GymViewState, bootStartedMs: number, savedThroughMs: number): GymViewState {
  const gapSeconds = hostOfflineGapSeconds(bootStartedMs, savedThroughMs);
  if (gapSeconds < EMPIRE_TUNING.TICK_SECONDS) return state;
  return gymViewReduce(state, {
    kind: 'advance-clock',
    gapSeconds,
    mode: 'offline',
  });
}

export function createGymHostSession(args: {
  readonly store: DurableByteStore;
  readonly clock: HostClock;
}): GymHostSession {
  const { store, clock } = args;

  let bootstrap: GymHostBootstrap = Object.freeze({ status: 'LOADING' });
  let write: GymHostWriteStatus = Object.freeze({ kind: 'idle' });
  let realtimeAnchorMs: number | null = null;
  let bootPromise: Promise<GymHostSnapshot> | null = null;

  let generation = 0;
  let latestBytes: string | null = null;
  let latestGeneration = 0;
  let writing = false;
  let chain: Promise<void> = Promise.resolve();

  const snapshot = (): GymHostSnapshot =>
    freezeSnapshot({
      bootstrap,
      write,
      realtimeAnchorMs,
    });

  const replacePlayableState = (state: GymViewState): void => {
    if (bootstrap.status === 'LOADED') {
      bootstrap = Object.freeze({ status: 'LOADED', state });
      return;
    }
    if (bootstrap.status === 'EMPTY') {
      bootstrap = Object.freeze({ status: 'EMPTY', state });
    }
  };

  const enqueueWrite = (bytes: string): void => {
    generation += 1;
    latestBytes = bytes;
    latestGeneration = generation;
    write = Object.freeze({ kind: 'pending', generation });
    chain = chain.then(drainWrites, drainWrites);
  };

  const drainWrites = async (): Promise<void> => {
    if (writing) return;
    writing = true;
    try {
      while (latestBytes !== null && latestGeneration > 0) {
        const jobGeneration = latestGeneration;
        const jobBytes = latestBytes;
        latestBytes = null;
        try {
          await store.set(jobBytes);
          if (jobGeneration === generation) {
            write = Object.freeze({ kind: 'ok', generation: jobGeneration });
          }
        } catch (error) {
          if (jobGeneration === generation) {
            write = Object.freeze({
              kind: 'failed',
              generation: jobGeneration,
              message: writeErrorMessage(error),
            });
          }
        }
      }
    } finally {
      writing = false;
    }
  };

  const persistPlayable = (state: GymViewState): void => {
    if (realtimeAnchorMs === null) return;
    enqueueWrite(encodeHostSave(state, realtimeAnchorMs));
  };

  const commitAction = (action: GymViewAction): GymHostSnapshot | null => {
    if (!playableStatus(bootstrap)) return null;
    const next = gymViewReduce(bootstrap.state, action);
    replacePlayableState(next);
    persistPlayable(next);
    return snapshot();
  };

  const settlePlayable = async (
    status: 'LOADED' | 'EMPTY',
    state: GymViewState,
  ): Promise<GymHostSnapshot> => {
    bootstrap = Object.freeze({ status, state });
    realtimeAnchorMs = clock.now();
    persistPlayable(state);
    await chain;
    return snapshot();
  };

  const runBootstrap = async (): Promise<GymHostSnapshot> => {
    if (bootstrap.status !== 'LOADING') return snapshot();
    const bootStartedMs = clock.now();
    let bytes: string | null;
    try {
      bytes = await store.get();
    } catch (error) {
      bootstrap = Object.freeze({
        status: 'READ_FAILED',
        message: readErrorMessage(error),
      });
      realtimeAnchorMs = null;
      return snapshot();
    }
    const loaded = decodeHostSave(bytes);
    if (loaded.kind === 'empty') {
      return settlePlayable('EMPTY', createGymViewState());
    }
    if (loaded.kind === 'refused') {
      bootstrap = Object.freeze({ status: 'REFUSED', reason: loaded.reason });
      realtimeAnchorMs = null;
      return snapshot();
    }
    const restored = restoreGymViewStateFromBytes(loaded.record.facilityBytes);
    const withGap = applyOfflineProcessGap(restored, bootStartedMs, loaded.record.savedThroughMs);
    return settlePlayable('LOADED', withGap);
  };

  return {
    snapshot,
    bootstrap: () => {
      if (bootPromise === null) {
        bootPromise = runBootstrap();
      }
      return bootPromise;
    },
    dispatch: commitAction,
    catchUp: (mode) => {
      if (!playableStatus(bootstrap) || realtimeAnchorMs === null) return null;
      const nowMs = clock.now();
      const gapSeconds = Math.floor(
        (nowMs - realtimeAnchorMs) / EMPIRE_TUNING.MILLISECONDS_PER_SECOND,
      );
      if (gapSeconds < EMPIRE_TUNING.TICK_SECONDS) return snapshot();
      realtimeAnchorMs = nowMs;
      return commitAction({ kind: 'advance-clock', gapSeconds, mode });
    },
    flushWrites: async () => {
      await chain;
      if (latestBytes !== null) {
        chain = chain.then(drainWrites, drainWrites);
        await chain;
      }
      return snapshot();
    },
    playableState: () => (playableStatus(bootstrap) ? bootstrap.state : null),
  };
}

function restoreGymViewStateFromBytes(facilityBytes: string): GymViewState {
  const loaded = loadFacilitySave(facilityBytes);
  if (loaded.kind !== 'loaded') {
    throw new RangeError('host record facilityBytes did not decode after host-level acceptance');
  }
  return restoreGymViewState(loaded.envelope.truth);
}
