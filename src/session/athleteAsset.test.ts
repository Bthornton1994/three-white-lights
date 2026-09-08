/**
 * The athlete asset reference and its placeholder flag move together, and
 * only when the asset is actually on disk. Source-scanned: the module
 * `require`s a `.riv`, which vitest cannot import.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const SOURCE = readFileSync(path.join(HERE, 'athleteAsset.ts'), 'utf8');
const ATHLETE_FILE = path.join(REPO, 'assets', 'athlete', 'athlete-01.riv');

function requiredPath(): string {
  const m = SOURCE.match(/require\('([^']+\.riv)'\)/);
  expect(m, 'one require of a .riv').not.toBeNull();
  return m![1]!;
}
function placeholderFlag(): boolean {
  const m = SOURCE.match(/export const ATHLETE_RIV_IS_PLACEHOLDER = (true|false);/);
  expect(m, 'the flag is a literal boolean').not.toBeNull();
  return m![1] === 'true';
}

describe('athleteAsset.ts — the reference and the flag cannot move alone', () => {
  it('the flag is true exactly when the require points into assets/dev', () => {
    const rel = requiredPath();
    const placeholder = rel.startsWith('../../assets/dev/');
    expect(placeholderFlag(), `require('${rel}') with ATHLETE_RIV_IS_PLACEHOLDER`).toBe(placeholder);
    // NON-VACUITY: the file the require names exists at all.
    expect(existsSync(path.resolve(HERE, rel)), `${rel} exists`).toBe(true);
  });

  it('while the flag is true the athlete has not arrived; once it has, the require must point at it', () => {
    if (placeholderFlag()) {
      expect(existsSync(ATHLETE_FILE), 'assets/athlete/athlete-01.riv is on disk but athleteAsset.ts still points at the placeholder — repoint the require and flip the flag').toBe(false);
    } else {
      expect(requiredPath()).toBe('../../assets/athlete/athlete-01.riv');
      expect(existsSync(ATHLETE_FILE)).toBe(true);
    }
  });

  it('the placeholder is the deliberately-invalid file, never one of the real diagnostic assets', () => {
    if (!placeholderFlag()) return;
    expect(requiredPath()).toBe('../../assets/dev/rive-spike.riv');
    expect(SOURCE).not.toMatch(/quick_start|rewards\.riv/);
  });
});
