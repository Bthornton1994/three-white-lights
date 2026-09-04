/**
 * lifterSurface.test.ts — Create / My Lifter presentation facts.
 */

import { describe, expect, it } from 'vitest';

import { CAREER_COPY, LIFTER_IDENTITY } from '../career/careerTuning';
import { totalKgFromCache } from '../game/lifterClient';
import { createLifterProfile } from '../game/lifterProfile';
import { openingCache } from '../game/sessionClient';
import { localSessionServer } from '../session/localSessionServer';
import {
  lifterCardFacts,
  lifterFederationOptions,
  lifterRefusalCopy,
  nameFitsBoard,
  sexLabelFor,
} from './lifterSurface';

function athlete() {
  const result = createLifterProfile(
    { name: 'W. MONTGOMERY-LEES', sex: 'female', bodyweightKgText: '72' },
    'surface-entropy',
  );
  if (!result.ok) throw new Error(result.detail);
  return result.profile;
}

describe('23 my-lifter-card', () => {
  it('shows identity and existing progression facts, and does not invent a Total', () => {
    const port = localSessionServer({ latencyMs: 0, sleep: async () => undefined });
    const cache = openingCache(port);
    const facts = lifterCardFacts(athlete(), cache);
    expect(facts).not.toBeNull();
    if (facts === null) return;
    expect(facts.name).toBe('W. MONTGOMERY-LEES');
    expect(facts.sexLabel).toBe(CAREER_COPY.LIFTER_SEX_FEMALE);
    expect(facts.bodyweightKg).toBe(72);
    expect(facts.federationName.length).toBeGreaterThan(0);
    expect(facts.rulesetText.length).toBeGreaterThan(0);
    expect(facts.totalKg).toBeNull();
    expect(totalKgFromCache(cache)).toBeNull();
    expect(facts.federationLocked).toBe(true);
    expect(facts.e1rmKg.squat).not.toBeNull();
  });
});

describe('24 no-silent-truncation / 31 longest-name-surfaces', () => {
  it('the longest legal name is stored whole and is at the board ceiling', () => {
    const name = 'W. MONTGOMERY-LEES';
    expect(name.length).toBe(LIFTER_IDENTITY.NAME_MAX_CHARS);
    expect(nameFitsBoard(name)).toBe(true);
    expect(nameFitsBoard(`${name}X`)).toBe(false);
    expect(athlete().name).toBe(name);
  });
});

describe('refusal copy is keyed, not parsed', () => {
  it('every refusal code has a player-facing sentence', () => {
    expect(lifterRefusalCopy('BLANK_NAME')).toBe(CAREER_COPY.LIFTER_NAME_BLANK);
    expect(lifterRefusalCopy('NAME_TOO_LONG')).toBe(CAREER_COPY.LIFTER_NAME_TOO_LONG);
    expect(lifterRefusalCopy('NAME_INVALID')).toBe(CAREER_COPY.LIFTER_NAME_INVALID);
    expect(lifterRefusalCopy('BODYWEIGHT_MALFORMED')).toBe(CAREER_COPY.LIFTER_BODYWEIGHT_MALFORMED);
    expect(lifterRefusalCopy('BODYWEIGHT_OUT_OF_DOMAIN')).toBe(CAREER_COPY.LIFTER_BODYWEIGHT_DOMAIN);
    expect(lifterRefusalCopy('SEX_UNKNOWN')).toBe(CAREER_COPY.LIFTER_SEX_UNKNOWN);
    expect(lifterRefusalCopy('FEDERATION_UNKNOWN')).toBe(CAREER_COPY.LIFTER_FEDERATION_UNKNOWN);
  });

  it('sex labels are the copy block, not a second spelling', () => {
    expect(sexLabelFor('male')).toBe(CAREER_COPY.LIFTER_SEX_MALE);
    expect(sexLabelFor('female')).toBe(CAREER_COPY.LIFTER_SEX_FEMALE);
  });

  it('the chooser offers every fictional federation, once each', () => {
    const options = lifterFederationOptions();
    expect(options.map((option) => option.id).sort()).toEqual(
      ['anvil-coast', 'grandhall', 'ironline', 'meridian'],
    );
  });
});
