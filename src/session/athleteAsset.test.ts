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
const STATUS = readFileSync(path.join(HERE, 'athleteAssetStatus.ts'), 'utf8');
const ATHLETE_FILE = path.join(REPO, 'assets', 'athlete', 'athlete-01.riv');

function requiredPath(): string {
  const m = SOURCE.match(/require\('([^']+\.riv)'\)/);
  expect(m, 'one require of a .riv').not.toBeNull();
  return m![1]!;
}
function placeholderFlag(): boolean {
  const m = STATUS.match(/export const ATHLETE_RIV_IS_PLACEHOLDER = (true|false);/);
  expect(m, 'the flag is a literal boolean').not.toBeNull();
  return m![1] === 'true';
}

describe('athleteAssetStatus.ts — the flag lives in a module the player bundle can carry', () => {
  it('has no require in it, and athleteAsset.ts re-exports it rather than declaring a second one', () => {
    expect(STATUS).not.toMatch(/require\(/);
    expect(SOURCE).toMatch(/export \{ ATHLETE_RIV_IS_PLACEHOLDER \} from '\.\/athleteAssetStatus';/);
    expect(SOURCE, 'one definition of the flag').not.toMatch(/export const ATHLETE_RIV_IS_PLACEHOLDER/);
  });
});

describe('athleteAsset.ts — the reference and the flag cannot move alone', () => {
  it('the flag is true exactly when the require points into assets/dev', () => {
    const rel = requiredPath();
    const placeholder = rel.startsWith('../../assets/dev/');
    expect(placeholderFlag(), `require('${rel}') with ATHLETE_RIV_IS_PLACEHOLDER`).toBe(placeholder);
    // NON-VACUITY: the file the require names exists at all.
    expect(existsSync(path.resolve(HERE, rel)), `${rel} exists`).toBe(true);
  });

  it('flag false means the require is the production athlete and that file exists; flag true may coexist with an authored-but-unmounted .riv', () => {
    // Authored bytes can land under assets/athlete/ for intake / contract /
    // WebGL QA while ATHLETE_RIV_IS_PLACEHOLDER stays true and
    // TRAINING_STAGE stays schematic — player mount is a separate flip.
    // The old pin (flag true ⟹ file absent) was valid only before any
    // authored file existed; isolating the no-athlete assumption here keeps
    // that intent without forcing a premature mount.
    if (!placeholderFlag()) {
      expect(requiredPath()).toBe('../../assets/athlete/athlete-01.riv');
      expect(existsSync(ATHLETE_FILE)).toBe(true);
    } else {
      expect(requiredPath()).toBe('../../assets/dev/rive-spike.riv');
    }
  });

  it('the placeholder is the deliberately-invalid file, never one of the real diagnostic assets', () => {
    if (!placeholderFlag()) return;
    expect(requiredPath()).toBe('../../assets/dev/rive-spike.riv');
    expect(SOURCE).not.toMatch(/quick_start|rewards\.riv/);
  });
});
