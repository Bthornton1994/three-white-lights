import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { IRON_AMBER } from '../game/sessionTuning';
import {
  IRON_AMBER_PLATE_FILES,
  IRON_AMBER_PLATE_IDS,
  ironAmberCoverRect,
  ironAmberGymLayout,
  ironAmberPlateFocus,
  ironAmberPlateFor,
  ironAmberPlateLayout,
} from './ironAmberPlates';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ASSET_DIR = path.join(REPO, 'assets/iron-amber');

const PHONE_W = 390;
const PHONE_H = 844;

describe('Iron & Amber training plates', () => {
  it('ships every owned plate as a real asset', () => {
    expect(IRON_AMBER_PLATE_IDS.length).toBe(Object.keys(IRON_AMBER_PLATE_FILES).length);
    for (const id of IRON_AMBER_PLATE_IDS) {
      const file = path.join(ASSET_DIR, IRON_AMBER_PLATE_FILES[id]);
      expect(existsSync(file), file).toBe(true);
      expect(statSync(file).size, file).toBeGreaterThan(80_000);
    }
  });

  it('deadlift brace is a floor pull, never a squat plate', () => {
    expect(ironAmberPlateFor('deadlift', 'BRACE', 0)).toBe('deadlift-floor');
    expect(ironAmberPlateFor('deadlift', 'ASCENT', IRON_AMBER.DEADLIFT_FLOOR_MAX)).toBe(
      'deadlift-floor',
    );
    expect(ironAmberPlateFor('deadlift', 'ASCENT', 0.5)).toBe('deadlift-knee');
    expect(ironAmberPlateFor('deadlift', 'LOCKOUT', 1)).toBe('deadlift-lockout');
    expect(ironAmberPlateFor('deadlift', 'BRACE', 0)).not.toMatch(/^squat-/);
  });

  it('squat hole and bench chest are exercise-specific', () => {
    expect(ironAmberPlateFor('squat', 'HOLE', 0)).toBe('squat-hole');
    expect(ironAmberPlateFor('squat', 'ASCENT', 0.7)).toBe('squat-drive');
    expect(ironAmberPlateFor('squat', 'BRACE', 1)).toBe('squat-brace');
    expect(ironAmberPlateFor('bench', 'HOLE', 0)).toBe('bench-chest');
    expect(ironAmberPlateFor('bench', 'ASCENT', 0.7)).toBe('bench-press');
    expect(ironAmberPlateFor('bench', 'BRACE', 1)).toBe('bench-brace');
  });

  it('focus is lift-specific so a deadlift never uses the squat crop', () => {
    expect(ironAmberPlateFocus('deadlift')).toEqual({
      x: IRON_AMBER.DEADLIFT_FOCUS_X,
      y: IRON_AMBER.DEADLIFT_FOCUS_Y,
    });
    expect(ironAmberPlateFocus('bench')).toEqual({
      x: IRON_AMBER.BENCH_FOCUS_X,
      y: IRON_AMBER.BENCH_FOCUS_Y,
    });
    expect(ironAmberPlateFocus('squat')).toEqual({
      x: IRON_AMBER.SQUAT_FOCUS_X,
      y: IRON_AMBER.SQUAT_FOCUS_Y,
    });
    expect(ironAmberPlateFocus('deadlift')).not.toEqual(ironAmberPlateFocus('squat'));
  });

  it('cover layout fills a phone and is not the JPEG intrinsic size', () => {
    const squat = ironAmberPlateLayout('squat', PHONE_W, PHONE_H);
    const bench = ironAmberPlateLayout('bench', PHONE_W, PHONE_H);
    const deadlift = ironAmberPlateLayout('deadlift', PHONE_W, PHONE_H);
    for (const layout of [squat, bench, deadlift]) {
      expect(layout.width).toBeGreaterThanOrEqual(PHONE_W);
      expect(layout.height).toBeGreaterThanOrEqual(PHONE_H);
      expect(layout.width).toBeLessThan(IRON_AMBER.PLATE_SRC_W);
      expect(layout.height).toBeLessThan(IRON_AMBER.PLATE_SRC_H);
      expect(layout.left).toBeLessThanOrEqual(0);
      expect(layout.top).toBeLessThanOrEqual(0);
      expect(layout.left + layout.width).toBeGreaterThanOrEqual(PHONE_W);
      expect(layout.top + layout.height).toBeGreaterThanOrEqual(PHONE_H);
    }
    expect(deadlift.top).toBeLessThan(squat.top);
  });

  it('gym cover fills the room the same way', () => {
    const gym = ironAmberGymLayout(PHONE_W, PHONE_H);
    expect(gym.width).toBeGreaterThanOrEqual(PHONE_W);
    expect(gym.height).toBeGreaterThanOrEqual(PHONE_H);
    expect(gym.left + gym.width).toBeGreaterThanOrEqual(PHONE_W);
    expect(gym.top + gym.height).toBeGreaterThanOrEqual(PHONE_H);
  });

  it('a pan cannot open a gap at the opposite edge', () => {
    const gapped = ironAmberCoverRect(100, 100, 50, 80, 0, 0, 1);
    expect(gapped.left).toBe(0);
    expect(gapped.top).toBe(0);
    expect(gapped.width).toBeGreaterThanOrEqual(50);
    expect(gapped.height).toBeGreaterThanOrEqual(80);
  });
});
