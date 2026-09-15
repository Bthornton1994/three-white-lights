import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { ATTEMPTS_PER_LIFT } from '../game/meet';
import { IRON_AMBER } from '../game/sessionTuning';
import { MEET_LAYOUT } from '../game/meetTuning';
import {
  ironAmberHallLayout,
  ironAmberHallPlateId,
  meetAttemptPlateId,
  MEET_HALL_PLATE_FILES,
  MEET_HALL_PLATE_IDS,
} from './ironAmberHall';

const OPENER = 1 as const;
const THIRD = ATTEMPTS_PER_LIFT;

const ASSET_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../assets/iron-amber');

const PHONE_W = 390;
const PHONE_H = 844;

describe('Iron & Amber meet hall stills', () => {
  it('an empty platform is the meet hall, never a training garage plate', () => {
    expect(ironAmberHallPlateId('squat', 'SET', true, OPENER)).toBe('meet-empty');
    expect(ironAmberHallPlateId(null, null, true, null)).toBe('meet-empty');
  });

  it('the step and the unrack are not the settled brace', () => {
    expect(ironAmberHallPlateId('squat', 'STEP', false, OPENER)).toBe('meet-squat-walk');
    expect(ironAmberHallPlateId('squat', 'UNRACK', false, OPENER)).toBe('meet-squat-unrack');
    expect(ironAmberHallPlateId('squat', 'SET', false, OPENER)).toBe('meet-squat-brace');
    expect(ironAmberHallPlateId('squat', 'HUSH', false, OPENER)).toBe('meet-squat-brace');
    expect(ironAmberHallPlateId('bench', 'STEP', false, OPENER)).toBe('meet-bench');
    expect(ironAmberHallPlateId('bench', 'SET', false, OPENER)).toBe('meet-bench');
    expect(ironAmberHallPlateId('deadlift', 'LOAD', false, OPENER)).toBe('meet-empty');
    expect(ironAmberHallPlateId('deadlift', 'STEP', false, OPENER)).toBe('meet-deadlift');
    expect(ironAmberHallPlateId('deadlift', 'HUSH', false, OPENER)).toBe('meet-deadlift');
  });

  it('the last squat draws the packed-third bar, not the opener stack', () => {
    expect(ironAmberHallPlateId('squat', 'STEP', false, THIRD)).toBe('meet-squat-walk-third');
    expect(ironAmberHallPlateId('squat', 'UNRACK', false, THIRD)).toBe('meet-squat-unrack-third');
    expect(ironAmberHallPlateId('squat', 'SET', false, THIRD)).toBe('meet-squat-brace-third');
    expect(ironAmberHallPlateId('squat', 'HUSH', false, THIRD)).toBe('meet-squat-brace-third');
    expect(ironAmberHallPlateId('squat', null, false, THIRD)).toBe('meet-squat-brace-third');
    expect(ironAmberHallPlateId('bench', 'SET', false, THIRD)).toBe('meet-bench');
  });

  it('a missing pose is the settled still, so deliberation and a no-lift match', () => {
    expect(ironAmberHallPlateId('squat', null, false, OPENER)).toBe('meet-squat-brace');
    const settled = ironAmberHallLayout(PHONE_W, PHONE_H, 'meet-squat-brace', 0, 0, 0);
    const omitted = ironAmberHallLayout(PHONE_W, PHONE_H, 'meet-squat-brace', 0, 0, 0);
    expect(omitted).toEqual(settled);
  });

  it('crowd rise and a step pan actually move the cover rect', () => {
    const calm = ironAmberHallLayout(PHONE_W, PHONE_H, 'meet-squat-brace', 0, 0, 0);
    const hushRise = MEET_LAYOUT.HALL_WALK_SHIFT;
    const urgent = ironAmberHallLayout(PHONE_W, PHONE_H, 'meet-squat-brace', 0, hushRise, 0);
    const stepped = ironAmberHallLayout(PHONE_W, PHONE_H, 'meet-squat-walk', 2, 0, 0);
    expect(urgent.width).toBeGreaterThan(calm.width);
    expect(stepped.left).not.toBe(calm.left);
  });

  it('cover still fills a phone after a pan', () => {
    const layout = ironAmberHallLayout(PHONE_W, PHONE_H, 'meet-squat-walk', 2, 8, 6);
    expect(layout.width).toBeGreaterThanOrEqual(PHONE_W);
    expect(layout.height).toBeGreaterThanOrEqual(PHONE_H);
    expect(layout.width).toBeLessThan(IRON_AMBER.PLATE_SRC_W * 2);
    expect(layout.left).toBeLessThanOrEqual(0);
    expect(layout.top).toBeLessThanOrEqual(0);
    expect(layout.left + layout.width).toBeGreaterThanOrEqual(PHONE_W);
    expect(layout.top + layout.height).toBeGreaterThanOrEqual(PHONE_H);
  });

  it('ships every meet-hall plate as a real asset', () => {
    expect(MEET_HALL_PLATE_IDS.length).toBe(Object.keys(MEET_HALL_PLATE_FILES).length);
    for (const id of MEET_HALL_PLATE_IDS) {
      const file = path.join(ASSET_DIR, MEET_HALL_PLATE_FILES[id]);
      expect(existsSync(file), file).toBe(true);
      expect(statSync(file).size, file).toBeGreaterThan(80_000);
    }
  });

  it('the unrack still is not a crop of the walk still', () => {
    const unrack = readFileSync(path.join(ASSET_DIR, MEET_HALL_PLATE_FILES['meet-squat-unrack']));
    const walk = readFileSync(path.join(ASSET_DIR, MEET_HALL_PLATE_FILES['meet-squat-walk']));
    const unrackThird = readFileSync(
      path.join(ASSET_DIR, MEET_HALL_PLATE_FILES['meet-squat-unrack-third']),
    );
    const walkThird = readFileSync(
      path.join(ASSET_DIR, MEET_HALL_PLATE_FILES['meet-squat-walk-third']),
    );
    expect(unrack.equals(walk), 'opener unrack is the walk jpeg').toBe(false);
    expect(unrackThird.equals(walkThird), 'third unrack is the walk jpeg').toBe(false);
  });

  it('a meet attempt still is the hall, never a garage pose', () => {
    expect(meetAttemptPlateId('squat', 'BRACE', OPENER)).toBe('meet-squat-brace');
    expect(meetAttemptPlateId('squat', 'ASCENT', OPENER)).toBe('meet-squat-walk');
    expect(meetAttemptPlateId('squat', 'BRACE', THIRD)).toBe('meet-squat-brace-third');
    expect(meetAttemptPlateId('squat', 'ASCENT', THIRD)).toBe('meet-squat-walk-third');
    expect(meetAttemptPlateId('bench', 'HOLE', OPENER)).toBe('meet-bench');
    expect(meetAttemptPlateId('deadlift', 'LOCKOUT', OPENER)).toBe('meet-deadlift');
  });
});
