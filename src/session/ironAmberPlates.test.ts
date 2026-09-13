import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { IRON_AMBER } from '../game/sessionTuning';
import {
  IRON_AMBER_PLATE_FILES,
  IRON_AMBER_PLATE_IDS,
  ironAmberCropShift,
  ironAmberPlateFor,
} from './ironAmberPlates';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ASSET_DIR = path.join(REPO, 'assets/iron-amber');

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

  it('crop shift is lift-specific so a deadlift never uses the squat crop', () => {
    expect(ironAmberCropShift('deadlift')).toBe(IRON_AMBER.DEADLIFT_CROP_Y);
    expect(ironAmberCropShift('bench')).toBe(IRON_AMBER.BENCH_CROP_Y);
    expect(ironAmberCropShift('squat')).toBe(IRON_AMBER.SQUAT_CROP_Y);
    expect(ironAmberCropShift('deadlift')).not.toBe(ironAmberCropShift('squat'));
  });
});
