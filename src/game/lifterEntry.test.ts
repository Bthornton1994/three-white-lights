/**
 * lifterEntry.test.ts — the A2 Career Meet seam.
 *
 * persistent profile + federation + meet-local lot → KilogramMeetEntry
 * MEET_ENTRY remains the explicit fixture. A Career Meet does not read it
 * as player authority.
 */

import { describe, expect, it } from 'vitest';

import { CAREER_COPY, LIFTER_IDENTITY } from '../career/careerTuning';
import { rulesetOf } from '../career/federation';
import { kilogramMeetEntryFrom } from './lifterEntry';
import { createLifterProfile, type LifterProfile } from './lifterProfile';
import { MEET_ENTRY } from './meetTuning';

function profile(): LifterProfile {
  const result = createLifterProfile(
    { name: 'R. VELLUM', sex: 'female', bodyweightKgText: '63.5' },
    'seam-entropy',
  );
  if (!result.ok) throw new Error(`fixture: ${result.detail}`);
  return result.profile;
}

describe('8 meet-entry-seam', () => {
  it('a Career Meet entry is built from the profile, not from MEET_ENTRY', () => {
    const entry = kilogramMeetEntryFrom(profile(), 'meridian', MEET_ENTRY.lot);
    expect(entry.name).toBe('R. VELLUM');
    expect(entry.name).not.toBe(MEET_ENTRY.name);
    expect(entry.sex).toBe('female');
    expect(entry.sex).not.toBe(MEET_ENTRY.sex);
    expect(entry.bodyweight.kilograms).toBe(63.5);
    expect(entry.bodyweight.kilograms).not.toBe(MEET_ENTRY.bodyweight.kilograms);
    expect(entry.bodyweight.unit).toBe('kg');
  });
});

describe('9 board-name / 13 weigh-in-identity / 14 recap-identity', () => {
  it('the seam carries the platform name the board, weigh-in, and recap read', () => {
    const entry = kilogramMeetEntryFrom(profile(), 'meridian', MEET_ENTRY.lot);
    expect(entry.name).toBe('R. VELLUM');
    expect(entry.name.length).toBeLessThanOrEqual(LIFTER_IDENTITY.NAME_MAX_CHARS);
  });
});

describe('10 lot-local', () => {
  it('lot is the number passed in, never a profile field', () => {
    const athlete = profile();
    expect(Object.prototype.hasOwnProperty.call(athlete, 'lot')).toBe(false);
    const a = kilogramMeetEntryFrom(athlete, 'meridian', 3);
    const b = kilogramMeetEntryFrom(athlete, 'meridian', 7);
    expect(a.lot).toBe(3);
    expect(b.lot).toBe(7);
    expect(MEET_ENTRY.lot).toBe(3);
  });
});

describe('11 equipment-from-federation', () => {
  it('equipment presentation comes from the federation ruleset, not a stored Raw string', () => {
    const athlete = profile();
    const raw = kilogramMeetEntryFrom(athlete, 'meridian', 3);
    const equipped = kilogramMeetEntryFrom(athlete, 'grandhall', 3);
    expect(raw.equipment).toBe(CAREER_COPY.EQUIPMENT_LABEL[rulesetOf('meridian').equipment]);
    expect(equipped.equipment).toBe(CAREER_COPY.EQUIPMENT_LABEL[rulesetOf('grandhall').equipment]);
    expect(raw.equipment).toBe('RAW');
    expect(equipped.equipment).toBe('EQUIPPED');
    expect(Object.prototype.hasOwnProperty.call(athlete, 'equipment')).toBe(false);
  });
});

describe('12 division-open', () => {
  it('division is Open at the meet boundary, and is not stored on the profile', () => {
    const athlete = profile();
    expect(Object.prototype.hasOwnProperty.call(athlete, 'division')).toBe(false);
    expect(kilogramMeetEntryFrom(athlete, 'ironline', 3).division).toBe(LIFTER_IDENTITY.OPEN_DIVISION);
    expect(LIFTER_IDENTITY.OPEN_DIVISION).toBe('Open');
  });
});

describe('MEET_ENTRY remains the fixture', () => {
  it('the debug and unit-test fixture is still A. LIFTER at lot 3', () => {
    expect(MEET_ENTRY.name).toBe('A. LIFTER');
    expect(MEET_ENTRY.lot).toBe(3);
    expect(MEET_ENTRY.equipment).toBe('Raw');
    expect(MEET_ENTRY.division).toBe('Open');
  });
});
