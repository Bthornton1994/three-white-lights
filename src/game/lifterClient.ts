/**
 * lifterClient.ts — the CLIENT half of persistent athlete identity.
 *
 * Profile is local identity. Total / e1RM stay progression facts read
 * through `progression.ts`. This module never mints a Total.
 */

import type { CareerFederationId } from '../career/careerTuning';
import type { LiftKind } from './meet';
import {
  readBestE1rmKg,
  readFederation,
  readTotalKg,
  readingValue,
  type ProgressionCache,
  type ProgressionSnapshotWire,
} from './progression';
import type { LifterDraft, LifterProfile, LifterRefusalCode } from './lifterProfile';

export type LifterServerResponse =
  | { readonly kind: 'saved'; readonly profile: LifterProfile }
  | { readonly kind: 'refused'; readonly code: LifterRefusalCode; readonly detail: string };

export interface LifterServerPort {
  readonly openingSnapshot: () => ProgressionSnapshotWire;
  readonly openingProfile: () => LifterProfile | null;
  readonly createProfile: (draft: LifterDraft, federationId: CareerFederationId) => Promise<LifterServerResponse>;
  readonly editProfileName: (name: string) => Promise<LifterServerResponse>;
  readonly editProfileBodyweight: (bodyweightKgText: string) => Promise<LifterServerResponse>;
}

export function totalKgFromCache(cache: ProgressionCache): number | null {
  const reading = readingValue(readTotalKg(cache));
  return typeof reading === 'number' ? reading : null;
}

export function e1rmFromCache(cache: ProgressionCache, lift: LiftKind): number | null {
  const reading = readingValue(readBestE1rmKg(cache, lift));
  return typeof reading === 'number' ? reading : null;
}

export function chosenFederationIdFromCache(cache: ProgressionCache): CareerFederationId | null {
  const federation = readingValue(readFederation(cache));
  if (federation === null || federation === undefined || !federation.chosen) return null;
  return federation.id;
}

export function currentFederationIdFromCache(cache: ProgressionCache): CareerFederationId | null {
  const federation = readingValue(readFederation(cache));
  if (federation === null || federation === undefined) return null;
  return federation.id;
}
