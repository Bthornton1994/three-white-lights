/**
 * lifterProfile.test.ts — A2 persistent identity, as a domain.
 *
 * Profile owns who the athlete is. These tests fail if identity grows
 * a Total, a lot, a wallet, or a federation id, or if the one name
 * function starts meaning two things.
 */

import { describe, expect, it } from 'vitest';

import { LIFTER_IDENTITY } from '../career/careerTuning';
import { DOTS_BODYWEIGHT_DOMAIN_KG } from './dots';
import {
  LIFTER_PROFILE_KEYS,
  LIFTER_REFUSAL_CODES,
  createLifterProfile,
  decodeLifterProfile,
  editLifterBodyweight,
  editLifterName,
  mintLifterId,
  normalizePlatformName,
  type LifterDraft,
  type LifterProfile,
} from './lifterProfile';

const DRAFT: LifterDraft = {
  name: 'R. VELLUM',
  sex: 'male',
  bodyweightKgText: '83.5',
};

/** 18 characters, the board/card/weigh-in ceiling. */
const LONGEST = 'W. MONTGOMERY-LEES';

function created(draft: LifterDraft = DRAFT, entropy = 'entropy-1'): LifterProfile {
  const result = createLifterProfile(draft, entropy);
  if (!result.ok) throw new Error(`fixture: create refused ${result.code} ${result.detail}`);
  return result.profile;
}

describe('1 create-lifter', () => {
  it('mints a stable id, a platform name, a DOTS sex, and a tagged kilogram bodyweight', () => {
    const profile = created();
    expect(profile.id.startsWith(LIFTER_IDENTITY.ID_PREFIX)).toBe(true);
    expect(profile.id.length).toBe(LIFTER_IDENTITY.ID_PREFIX.length + LIFTER_IDENTITY.ID_HEX_LENGTH);
    expect(profile.name).toBe('R. VELLUM');
    expect(profile.sex).toBe('male');
    expect(profile.bodyweight).toEqual({ unit: 'kg', kilograms: 83.5 });
    expect(Object.keys(profile).sort()).toEqual([...LIFTER_PROFILE_KEYS].sort());
  });

  it('the same entropy mints the same id; a different entropy does not remint the first', () => {
    const a = created(DRAFT, 'same-entropy');
    const b = created(DRAFT, 'same-entropy');
    const c = created(DRAFT, 'other-entropy');
    expect(a.id).toBe(b.id);
    expect(c.id).not.toBe(a.id);
    expect(mintLifterId('same-entropy')).toBe(a.id);
  });
});

describe('2 persist-identity', () => {
  it('decode(encode-shape) keeps the stored id rather than reminting one', () => {
    const profile = created(DRAFT, 'keep-me');
    const decoded = decodeLifterProfile({
      id: profile.id,
      name: profile.name,
      sex: profile.sex,
      bodyweight: profile.bodyweight,
    });
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.profile.id).toBe(profile.id);
    expect(decoded.profile).toEqual(profile);
  });
});

describe('3 identity-not-performance', () => {
  it('a profile that carries Total, e1RM, lot, wallet, or federation is corrupt', () => {
    const profile = created();
    for (const key of ['lot', 'totalKg', 'bestE1rmKg', 'wallet', 'e1rm', 'federationId', 'division', 'equipment'] as const) {
      const decoded = decodeLifterProfile({ ...profile, [key]: 1 });
      expect(decoded.ok, key).toBe(false);
      if (!decoded.ok) expect(decoded.code, key).toBe('PROFILE_CORRUPT');
    }
  });

  it('the profile key set is exactly id, name, sex, bodyweight', () => {
    expect([...LIFTER_PROFILE_KEYS]).toEqual(['id', 'name', 'sex', 'bodyweight']);
  });
});

describe('4 name-validation', () => {
  it('one normalize, one max, one alphabet — blank, long, and illegal names refuse', () => {
    expect(LONGEST.length).toBe(LIFTER_IDENTITY.NAME_MAX_CHARS);
    expect(normalizePlatformName('  R.   VELLUM  ')).toBe('R. VELLUM');
    expect(createLifterProfile({ ...DRAFT, name: '   ' }, 'e').ok).toBe(false);
    const blank = createLifterProfile({ ...DRAFT, name: '' }, 'e');
    expect(blank.ok).toBe(false);
    if (!blank.ok) expect(blank.code).toBe('BLANK_NAME');
    const long = createLifterProfile({ ...DRAFT, name: `${LONGEST}X` }, 'e');
    expect(long.ok).toBe(false);
    if (!long.ok) expect(long.code).toBe('NAME_TOO_LONG');
    const illegal = createLifterProfile({ ...DRAFT, name: 'R. VELLUM 9' }, 'e');
    expect(illegal.ok).toBe(false);
    if (!illegal.ok) expect(illegal.code).toBe('NAME_INVALID');
    const bang = createLifterProfile({ ...DRAFT, name: "O'QUILL-LEE." }, 'e');
    expect(bang.ok).toBe(true);
    const atCap = createLifterProfile({ ...DRAFT, name: LONGEST }, 'e');
    expect(atCap.ok).toBe(true);
    if (atCap.ok) expect(atCap.profile.name).toBe(LONGEST);
  });

  it('edit name keeps id, sex, and bodyweight', () => {
    const profile = created();
    const edited = editLifterName(profile, { name: 'S. QUILL' });
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.profile.id).toBe(profile.id);
    expect(edited.profile.sex).toBe(profile.sex);
    expect(edited.profile.bodyweight).toEqual(profile.bodyweight);
    expect(edited.profile.name).toBe('S. QUILL');
  });
});

describe('5 sex-domain', () => {
  it('male and female are the only DOTS sexes a profile can carry', () => {
    expect(createLifterProfile({ ...DRAFT, sex: 'male' }, 'e').ok).toBe(true);
    expect(createLifterProfile({ ...DRAFT, sex: 'female' }, 'e').ok).toBe(true);
    const unknown = createLifterProfile({ ...DRAFT, sex: 'other' as LifterDraft['sex'] }, 'e');
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.code).toBe('SEX_UNKNOWN');
    const decoded = decodeLifterProfile({ ...created(), sex: 'unspecified' });
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.code).toBe('SEX_UNKNOWN');
  });
});

describe('6 bodyweight-domain', () => {
  it('tagged kilograms inside the published DOTS domain pass; outside, malformed, or pounds refuse', () => {
    const maleMax = String(DOTS_BODYWEIGHT_DOMAIN_KG.male.max);
    const maleMin = String(DOTS_BODYWEIGHT_DOMAIN_KG.male.min);
    expect(createLifterProfile({ ...DRAFT, bodyweightKgText: maleMin }, 'e').ok).toBe(true);
    expect(createLifterProfile({ ...DRAFT, bodyweightKgText: maleMax }, 'e').ok).toBe(true);
    const heavy = createLifterProfile({ ...DRAFT, bodyweightKgText: String(DOTS_BODYWEIGHT_DOMAIN_KG.male.max + 1) }, 'e');
    expect(heavy.ok).toBe(false);
    if (!heavy.ok) expect(heavy.code).toBe('BODYWEIGHT_OUT_OF_DOMAIN');
    const light = createLifterProfile({ ...DRAFT, bodyweightKgText: String(DOTS_BODYWEIGHT_DOMAIN_KG.male.min - 1) }, 'e');
    expect(light.ok).toBe(false);
    if (!light.ok) expect(light.code).toBe('BODYWEIGHT_OUT_OF_DOMAIN');
    const femaleHeavy = createLifterProfile(
      { name: 'S. QUILL', sex: 'female', bodyweightKgText: String(DOTS_BODYWEIGHT_DOMAIN_KG.female.max + 1) },
      'e',
    );
    expect(femaleHeavy.ok).toBe(false);
    if (!femaleHeavy.ok) expect(femaleHeavy.code).toBe('BODYWEIGHT_OUT_OF_DOMAIN');
    const blank = createLifterProfile({ ...DRAFT, bodyweightKgText: '' }, 'e');
    expect(blank.ok).toBe(false);
    if (!blank.ok) expect(blank.code).toBe('BODYWEIGHT_MALFORMED');
    const words = createLifterProfile({ ...DRAFT, bodyweightKgText: 'ninety' }, 'e');
    expect(words.ok).toBe(false);
    if (!words.ok) expect(words.code).toBe('BODYWEIGHT_MALFORMED');
    const pounds = decodeLifterProfile({
      ...created(),
      bodyweight: { unit: 'lb', kilograms: 83.5 },
    });
    expect(pounds.ok).toBe(false);
    if (!pounds.ok) expect(pounds.code).toBe('BODYWEIGHT_MALFORMED');
    const mixed = decodeLifterProfile({
      ...created(),
      bodyweight: { unit: 'kg', kilograms: 83.5, pounds: 184 },
    });
    expect(mixed.ok).toBe(false);
    if (!mixed.ok) expect(mixed.code).toBe('BODYWEIGHT_MALFORMED');
  });

  it('edit bodyweight keeps id, name, and sex', () => {
    const profile = created();
    const edited = editLifterBodyweight(profile, { bodyweightKgText: '90.0' });
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.profile.id).toBe(profile.id);
    expect(edited.profile.name).toBe(profile.name);
    expect(edited.profile.sex).toBe(profile.sex);
    expect(edited.profile.bodyweight.kilograms).toBe(90);
  });
});

describe('7 federation-once', () => {
  it('the refusal set names an unknown federation without storing one on the profile', () => {
    expect([...LIFTER_REFUSAL_CODES]).toContain('FEDERATION_UNKNOWN');
    const profile = created();
    expect(Object.prototype.hasOwnProperty.call(profile, 'federationId')).toBe(false);
  });
});
