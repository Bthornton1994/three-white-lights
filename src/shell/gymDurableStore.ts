/**
 * gymDurableStore.ts — production durable-bytes adapter for Gym Empire.
 *
 * Host I/O, not Empire. Empire never imports this file.
 *
 * Production backend is `@react-native-async-storage/async-storage`:
 *   native (Android/iOS) — SQLite
 *   web                 — IndexedDB
 * That is not a browser-only web-storage production backend. The web
 * platform storage object is not imported here. GymHost binds this adapter;
 * tests inject a memory store and do not have to call
 * getProductionGymDurableStore.
 *
 * AsyncStorage is loaded on first get/set so a node test that only
 * constructs createKeyValueDurableStore(fake) never evaluates the native
 * module.
 */

import { type DurableByteStore } from './gymHostPersistence';

export const GYM_EMPIRE_SAVE_KEY = 'gym-empire.facility.v1';

export interface AsyncStorageLike {
  readonly getItem: (key: string) => Promise<string | null>;
  readonly setItem: (key: string, value: string) => Promise<void>;
}

export function createKeyValueDurableStore(storage: AsyncStorageLike): DurableByteStore {
  return {
    get: () => storage.getItem(GYM_EMPIRE_SAVE_KEY),
    set: (bytes) => storage.setItem(GYM_EMPIRE_SAVE_KEY, bytes),
  };
}

let productionStore: DurableByteStore | null = null;

export function getProductionGymDurableStore(): DurableByteStore {
  if (productionStore === null) {
    productionStore = createLazyAsyncStorageStore();
  }
  return productionStore;
}

function createLazyAsyncStorageStore(): DurableByteStore {
  let storagePromise: Promise<AsyncStorageLike> | null = null;
  const storage = (): Promise<AsyncStorageLike> => {
    if (storagePromise === null) {
      storagePromise = import('@react-native-async-storage/async-storage').then(
        (loaded) => loaded.default,
      );
    }
    return storagePromise;
  };
  return {
    get: async () => {
      const backend = await storage();
      return backend.getItem(GYM_EMPIRE_SAVE_KEY);
    },
    set: async (bytes) => {
      const backend = await storage();
      await backend.setItem(GYM_EMPIRE_SAVE_KEY, bytes);
    },
  };
}
