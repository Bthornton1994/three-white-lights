/**
 * lifterSurface.test.ts — Create / My Lifter presentation facts.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { CAREER_COPY, LIFTER_IDENTITY } from '../career/careerTuning';
import { applyFederationChoice } from '../game/careerServer';
import { totalKgFromCache } from '../game/lifterClient';
import { createLifterProfile } from '../game/lifterProfile';
import { encodeSavedGame } from '../game/saveGame';
import { openingCache } from '../game/sessionClient';
import { newServerRecord } from '../game/sessionServer';
import { SESSION_BOUNDARY } from '../game/sessionTuning';
import { localSessionServer } from '../session/localSessionServer';
import {
  federationIdForCreate,
  lifterCardFacts,
  lifterConfirmedFederation,
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

describe('v1-already-chosen Create does not offer a chooser', () => {
  it('an unchosen seed still needs a draft pick', () => {
    const port = localSessionServer({
      latencyMs: 0,
      sleep: async () => undefined,
      record: newServerRecord(SESSION_BOUNDARY.LOCAL_SERVER_SIGNUP_DAY),
    });
    const cache = openingCache(port);
    expect(lifterConfirmedFederation(cache)).toBeNull();
    expect(federationIdForCreate(cache, null)).toBeNull();
    expect(federationIdForCreate(cache, 'ironline')).toBe('ironline');
  });

  it('a chosen Meridian row shows as confirmed and ignores an Ironline draft', () => {
    const chosen = applyFederationChoice(
      newServerRecord(SESSION_BOUNDARY.LOCAL_SERVER_SIGNUP_DAY),
      { kind: 'choose-federation', report: { federationId: 'meridian' } },
      'surface-chosen',
    );
    if (!chosen.ok) throw new Error(chosen.error.message);
    const port = localSessionServer({
      latencyMs: 0,
      sleep: async () => undefined,
      record: chosen.value.record,
    });
    const cache = openingCache(port);
    const confirmed = lifterConfirmedFederation(cache);
    expect(confirmed).toEqual({
      id: 'meridian',
      name: 'Meridian Barbell Union',
      rulesetText: 'RAW / TESTED',
    });
    expect(federationIdForCreate(cache, 'ironline')).toBe('meridian');
    expect(federationIdForCreate(cache, null)).toBe('meridian');
  });

  it('a v1 save with Meridian chosen opens Create as confirmed, not as a chooser', () => {
    const chosen = applyFederationChoice(
      newServerRecord(SESSION_BOUNDARY.LOCAL_SERVER_SIGNUP_DAY),
      { kind: 'choose-federation', report: { federationId: 'meridian' } },
      'v1-surface-chosen',
    );
    if (!chosen.ok) throw new Error(chosen.error.message);
    const parsed = JSON.parse(
      encodeSavedGame(chosen.value.record, '2026-08-19T00:00:00.000Z'),
    ) as { version: number; profile?: unknown };
    parsed.version = 1;
    delete parsed.profile;
    const text = JSON.stringify(parsed);
    const port = localSessionServer({
      latencyMs: 0,
      sleep: async () => undefined,
      store: {
        load: () => text,
        save: () => undefined,
      },
    });
    expect(port.openingProfile()).toBeNull();
    const cache = openingCache(port);
    expect(lifterConfirmedFederation(cache)?.id).toBe('meridian');
    expect(federationIdForCreate(cache, 'ironline')).toBe('meridian');
  });

  it('LifterScreen only mounts the chooser when nothing is confirmed', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(path.join(here, 'LifterScreen.tsx'), 'utf8');
    expect(source).toMatch(/loop\.confirmedFederation === null \? \(/);
    expect(source).toMatch(/testID="lifter-create-federation-confirmed"/);
    expect(source).toMatch(/CAREER_COPY\.LIFTER_FEDERATION_LOCKED/);
    expect(source).toMatch(/onPress=\{\(\) => loop\.setFederationDraft\(option\.id\)\}/);
    const chooserPress = source.indexOf('onPress={() => loop.setFederationDraft(option.id)}');
    const confirmedBranch = source.indexOf('testID="lifter-create-federation-confirmed"');
    expect(chooserPress).toBeGreaterThan(-1);
    expect(confirmedBranch).toBeGreaterThan(chooserPress);
  });
});
