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
 * Bootstrap statuses:
 *   LOADING — durable read has not settled; player mutations are refused
 *   LOADED  — restoreGymViewState from decoded bytes, once
 *   EMPTY   — store had no bytes; createGymViewState once. Empty is empty,
 *             not a silent pretence that a save existed
 *   REFUSED — corrupt / unknown / unsupported / incoherent bytes. Stays
 *             refused. Does not overwrite the bad bytes with an opening gym
 *   READ_FAILED — storage get() rejected. Not treated as a new player
 *
 * Write order: a serialized queue plus a monotonic generation. An older
 * write cannot remain the durable bytes after a newer committed state.
 *
 * Clock: the restored collectedAt watermark is authoritative. The real-time
 * Date.now anchor is established only after bootstrap settles. A slow
 * storage read is not player absence and is not dispatched as advance-clock.
 *
 * Reset: `reset-gym` persists the new opening gym. Remount must not
 * resurrect the pre-reset gym.
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
    enqueueWrite(encodeGymView(state));
  };

  const commitAction = (action: GymViewAction): GymHostSnapshot | null => {
    if (!playableStatus(bootstrap)) return null;
    const next = gymViewReduce(bootstrap.state, action);
    replacePlayableState(next);
    persistPlayable(next);
    return snapshot();
  };

  const runBootstrap = async (): Promise<GymHostSnapshot> => {
    if (bootstrap.status !== 'LOADING') return snapshot();
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
    const loaded = loadFacilitySave(bytes);
    if (loaded.kind === 'empty') {
      const state = createGymViewState();
      bootstrap = Object.freeze({ status: 'EMPTY', state });
      realtimeAnchorMs = clock.now();
      persistPlayable(state);
      await chain;
      return snapshot();
    }
    if (loaded.kind === 'refused') {
      bootstrap = Object.freeze({ status: 'REFUSED', reason: loaded.reason });
      realtimeAnchorMs = null;
      return snapshot();
    }
    const state = restoreGymViewState(loaded.envelope.truth);
    bootstrap = Object.freeze({ status: 'LOADED', state });
    realtimeAnchorMs = clock.now();
    return snapshot();
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
