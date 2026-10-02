/**
 * lifterProfile.ts — persistent athlete identity (A2 My Lifter).
 *
 * Profile owns who the athlete is. It does not own Total, e1RM, lot,
 * equipment, division, or federation membership.
 *
 * Federation membership is the existing protected `ConfirmedFederation` on
 * the server row. Lot is meet-local. Equipment is derived from the
 * federation ruleset at the meet-entry seam. Division stays Open at that
 * seam until a real age-class system exists.
 *
 * Purity: no React, no I/O, no clock. The caller supplies entropy for ids.
 */

import { LIFTER_IDENTITY } from '../career/careerTuning';
import {
  isBodyweightInDotsDomain,
  type DotsSex,
  type KilogramBodyweight,
} from './dots';

export const LIFTER_PROFILE_KEYS = ['id', 'name', 'sex', 'bodyweight'] as const;
export type LifterProfileKey = (typeof LIFTER_PROFILE_KEYS)[number];

const FORBIDDEN_PROFILE_KEYS = [
  'lot',
  'totalKg',
  'bestE1rmKg',
  'wallet',
  'e1rm',
  'federationId',
  'division',
  'equipment',
] as const;

export const LIFTER_REFUSAL_CODES = [
  'BLANK_NAME',
  'NAME_TOO_LONG',
  'NAME_INVALID',
  'BODYWEIGHT_MALFORMED',
  'BODYWEIGHT_OUT_OF_DOMAIN',
  'SEX_UNKNOWN',
  'PROFILE_CORRUPT',
  'FEDERATION_UNKNOWN',
] as const;
export type LifterRefusalCode = (typeof LIFTER_REFUSAL_CODES)[number];

export interface LifterProfile {
  readonly id: string;
  readonly name: string;
  readonly sex: DotsSex;
  readonly bodyweight: KilogramBodyweight;
}

export interface LifterDraft {
  readonly name: string;
  readonly sex: DotsSex;
  readonly bodyweightKgText: string;
}

export interface LifterNamePatch {
  readonly name: string;
}

export interface LifterBodyweightPatch {
  readonly bodyweightKgText: string;
}

export type LifterRefusal = {
  readonly ok: false;
  readonly code: LifterRefusalCode;
  readonly detail: string;
};

export type LifterDecodeResult =
  | { readonly ok: true; readonly profile: LifterProfile }
  | LifterRefusal;

function refused(code: LifterRefusalCode, detail: string): LifterRefusal {
  return { ok: false, code, detail };
}

const NAME_CHAR = /^[A-Za-z .'-]+$/;
const DOTS_SEXES: readonly DotsSex[] = ['male', 'female'];

export function normalizePlatformName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

export function platformNameRefusal(raw: string): LifterDecodeResult | null {
  const name = normalizePlatformName(raw);
  if (name.length === 0) {
    return refused('BLANK_NAME', 'platform name is blank');
  }
  if (name.length > LIFTER_IDENTITY.NAME_MAX_CHARS) {
    return refused('NAME_TOO_LONG', `platform name longer than ${String(LIFTER_IDENTITY.NAME_MAX_CHARS)} characters`);
  }
  if (!NAME_CHAR.test(name)) {
    return refused('NAME_INVALID', 'platform name uses characters the board cannot carry');
  }
  return null;
}

function parseKilogramBodyweight(
  text: string,
  sex: DotsSex,
): { readonly ok: true; readonly bodyweight: KilogramBodyweight } | LifterRefusal {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return refused('BODYWEIGHT_MALFORMED', 'bodyweight is blank');
  }
  const kilograms = Number(trimmed);
  if (!Number.isFinite(kilograms) || kilograms <= 0) {
    return refused('BODYWEIGHT_MALFORMED', `bodyweight is not a kilogram number: ${JSON.stringify(text)}`);
  }
  if (!isBodyweightInDotsDomain(sex, kilograms)) {
    return refused('BODYWEIGHT_OUT_OF_DOMAIN', 'bodyweight is outside the published DOTS domain');
  }
  return { ok: true, bodyweight: { unit: 'kg', kilograms } };
}

function isDotsSex(value: unknown): value is DotsSex {
  return value === 'male' || value === 'female';
}

function hexFingerprint(entropy: string): string {
  let hash: number = LIFTER_IDENTITY.ID_HASH_SEED;
  for (let index = 0; index < entropy.length; index += 1) {
    const code = entropy.charCodeAt(index);
    hash = Math.imul(hash, LIFTER_IDENTITY.ID_HASH_MUL) ^ code;
  }
  const unsigned = hash >>> 0;
  return unsigned.toString(LIFTER_IDENTITY.ID_HEX_RADIX).padStart(LIFTER_IDENTITY.ID_HEX_LENGTH, '0');
}

export function mintLifterId(entropy: string): string {
  const material = entropy.length === 0 ? 'lifter' : entropy;
  return `${LIFTER_IDENTITY.ID_PREFIX}${hexFingerprint(material)}`;
}

export function createLifterProfile(draft: LifterDraft, entropy: string): LifterDecodeResult {
  if (!isDotsSex(draft.sex)) {
    return refused('SEX_UNKNOWN', `sex is not a DOTS sex: ${JSON.stringify(draft.sex)}`);
  }
  const nameError = platformNameRefusal(draft.name);
  if (nameError !== null) return nameError;
  const bodyweight = parseKilogramBodyweight(draft.bodyweightKgText, draft.sex);
  if (!bodyweight.ok) return bodyweight;
  return {
    ok: true,
    profile: {
      id: mintLifterId(entropy),
      name: normalizePlatformName(draft.name),
      sex: draft.sex,
      bodyweight: bodyweight.bodyweight,
    },
  };
}

export function editLifterName(profile: LifterProfile, patch: LifterNamePatch): LifterDecodeResult {
  const nameError = platformNameRefusal(patch.name);
  if (nameError !== null) return nameError;
  return {
    ok: true,
    profile: {
      id: profile.id,
      name: normalizePlatformName(patch.name),
      sex: profile.sex,
      bodyweight: profile.bodyweight,
    },
  };
}

export function editLifterBodyweight(profile: LifterProfile, patch: LifterBodyweightPatch): LifterDecodeResult {
  const bodyweight = parseKilogramBodyweight(patch.bodyweightKgText, profile.sex);
  if (!bodyweight.ok) return bodyweight;
  return {
    ok: true,
    profile: {
      id: profile.id,
      name: profile.name,
      sex: profile.sex,
      bodyweight: bodyweight.bodyweight,
    },
  };
}

export function decodeLifterProfile(value: unknown): LifterDecodeResult {
  if (value === null || value === undefined) {
    return refused('PROFILE_CORRUPT', 'profile is missing');
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return refused('PROFILE_CORRUPT', `profile must be an object, received a ${Array.isArray(value) ? 'array' : typeof value}`);
  }
  const shape = value as Record<string, unknown>;
  for (const key of FORBIDDEN_PROFILE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(shape, key)) {
      return refused('PROFILE_CORRUPT', `profile must not carry ${key}`);
    }
  }
  if (typeof shape.id !== 'string' || !shape.id.startsWith(LIFTER_IDENTITY.ID_PREFIX) || shape.id.length <= LIFTER_IDENTITY.ID_PREFIX.length) {
    return refused('PROFILE_CORRUPT', 'profile.id is not a lifter id');
  }
  if (typeof shape.name !== 'string') {
    return refused('PROFILE_CORRUPT', 'profile.name must be a string');
  }
  if (!isDotsSex(shape.sex)) {
    return refused('SEX_UNKNOWN', `profile.sex is not a DOTS sex: ${JSON.stringify(shape.sex)}`);
  }
  const nameError = platformNameRefusal(shape.name);
  if (nameError !== null) return nameError;
  const reading = shape.bodyweight;
  if (typeof reading !== 'object' || reading === null || Array.isArray(reading)) {
    return refused('BODYWEIGHT_MALFORMED', 'profile.bodyweight must be a tagged kilogram reading');
  }
  const tagged = reading as { unit?: unknown; kilograms?: unknown; pounds?: unknown };
  if (tagged.unit !== 'kg' || typeof tagged.kilograms !== 'number') {
    return refused('BODYWEIGHT_MALFORMED', 'profile.bodyweight is not a kilogram reading');
  }
  if (tagged.pounds !== undefined) {
    return refused('BODYWEIGHT_MALFORMED', 'profile.bodyweight carries a pound field');
  }
  const bodyweight = parseKilogramBodyweight(String(tagged.kilograms), shape.sex);
  if (!bodyweight.ok) return bodyweight;
  return {
    ok: true,
    profile: {
      id: shape.id,
      name: normalizePlatformName(shape.name),
      sex: shape.sex,
      bodyweight: bodyweight.bodyweight,
    },
  };
}

export const DOTS_SEX_OPTIONS: readonly DotsSex[] = DOTS_SEXES;
