/**
 * lifterSurface.ts — read models for Create Your Lifter and My Lifter.
 *
 * Presentation only. Identity is `lifterProfile.ts`. Progression numbers
 * arrive already read. Federation labels come from the federation authority.
 */

import {
  CAREER_COPY,
  CAREER_FEDERATIONS,
  LIFTER_IDENTITY,
  type CareerFederationId,
} from '../career/careerTuning';
import { federationById, rulesetLabel, rulesetOf } from '../career/federation';
import {
  chosenFederationIdFromCache,
  currentFederationIdFromCache,
  e1rmFromCache,
  totalKgFromCache,
} from '../game/lifterClient';
import type { LifterProfile, LifterRefusalCode } from '../game/lifterProfile';
import type { LiftKind } from '../game/meet';
import type { ProgressionCache } from '../game/progression';

export type LifterSurfacePhase = 'creating' | 'card' | 'editing-name' | 'editing-bodyweight';

export interface LifterFederationOption {
  readonly id: CareerFederationId;
  readonly name: string;
  readonly rulesetText: string;
}

export interface LifterCardFacts {
  readonly id: string;
  readonly name: string;
  readonly sexLabel: string;
  readonly bodyweightKg: number;
  readonly federationName: string;
  readonly rulesetText: string;
  readonly totalKg: number | null;
  readonly e1rmKg: { readonly squat: number | null; readonly bench: number | null; readonly deadlift: number | null };
  readonly federationLocked: true;
}

function federationOption(id: CareerFederationId): LifterFederationOption {
  const federation = federationById(id);
  return {
    id: federation.id,
    name: federation.name,
    rulesetText: rulesetLabel(federation.ruleset),
  };
}

export function lifterFederationOptions(): readonly LifterFederationOption[] {
  return CAREER_FEDERATIONS.map((federation) => federationOption(federation.id));
}

/**
 * The federation Create may show as already decided.
 *
 * A v1 save, or an A1 `choose-federation` before identity existed, can
 * already carry `chosen: true` with no profile. That choice is locked
 * (GDD §2.1 / CLAUDE: chosen once; no transfer). Create must not offer
 * a picker that cannot apply.
 */
export function lifterConfirmedFederation(
  cache: ProgressionCache,
): LifterFederationOption | null {
  const id = chosenFederationIdFromCache(cache);
  if (id === null) return null;
  return federationOption(id);
}

/**
 * Which federation Create submits.
 *
 * Already-chosen wins. A draft of a different federation is ignored so
 * Create cannot pretend to re-pick on the A1→A2 completion path.
 */
export function federationIdForCreate(
  cache: ProgressionCache,
  draft: CareerFederationId | null,
): CareerFederationId | null {
  return chosenFederationIdFromCache(cache) ?? draft;
}

export function lifterRefusalCopy(code: LifterRefusalCode): string {
  switch (code) {
    case 'BLANK_NAME':
      return CAREER_COPY.LIFTER_NAME_BLANK;
    case 'NAME_TOO_LONG':
      return CAREER_COPY.LIFTER_NAME_TOO_LONG;
    case 'NAME_INVALID':
      return CAREER_COPY.LIFTER_NAME_INVALID;
    case 'BODYWEIGHT_MALFORMED':
      return CAREER_COPY.LIFTER_BODYWEIGHT_MALFORMED;
    case 'BODYWEIGHT_OUT_OF_DOMAIN':
      return CAREER_COPY.LIFTER_BODYWEIGHT_DOMAIN;
    case 'SEX_UNKNOWN':
      return CAREER_COPY.LIFTER_SEX_UNKNOWN;
    case 'FEDERATION_UNKNOWN':
      return CAREER_COPY.LIFTER_FEDERATION_UNKNOWN;
    case 'PROFILE_CORRUPT':
      return CAREER_COPY.LIFTER_CREATE_LEAD;
  }
}

export function sexLabelFor(sex: LifterProfile['sex']): string {
  return sex === 'male' ? CAREER_COPY.LIFTER_SEX_MALE : CAREER_COPY.LIFTER_SEX_FEMALE;
}

function e1rmOf(cache: ProgressionCache, lift: LiftKind): number | null {
  return e1rmFromCache(cache, lift);
}

export function lifterCardFacts(profile: LifterProfile, cache: ProgressionCache): LifterCardFacts | null {
  const federationId = currentFederationIdFromCache(cache);
  if (federationId === null) return null;
  const federation = federationById(federationId);
  return {
    id: profile.id,
    name: profile.name,
    sexLabel: sexLabelFor(profile.sex),
    bodyweightKg: profile.bodyweight.kilograms,
    federationName: federation.name,
    rulesetText: rulesetLabel(rulesetOf(federation.id)),
    totalKg: totalKgFromCache(cache),
    e1rmKg: {
      squat: e1rmOf(cache, 'squat'),
      bench: e1rmOf(cache, 'bench'),
      deadlift: e1rmOf(cache, 'deadlift'),
    },
    federationLocked: true,
  };
}

export function nameFitsBoard(name: string): boolean {
  return name.length > 0 && name.length <= LIFTER_IDENTITY.NAME_MAX_CHARS;
}
