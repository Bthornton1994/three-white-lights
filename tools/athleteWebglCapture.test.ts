/**
 * Pins that the WebGL2/canvas athlete capture tool exists and refuses to write
 * the player-path gate. Blank-frame failure is asserted in the tool's own exit
 * codes when run locally (`BLANK_FRAMES` → exit 2); CI does not require
 * Playwright browsers for this pin.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOL = path.join(HERE, 'athleteWebglCapture.mjs');
const SOURCE = readFileSync(TOOL, 'utf8');
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('tools/athleteWebglCapture.mjs', () => {
  it('is present, names both runtimes, and never writes TRAINING_STAGE or the placeholder flag', () => {
    expect(existsSync(TOOL)).toBe(true);
    expect(CODE).not.toMatch(/TRAINING_STAGE/);
    expect(CODE).not.toMatch(/ATHLETE_RIV_IS_PLACEHOLDER/);
    expect(CODE).not.toMatch(/writeFileSync\([^)]*src\//);
    expect(SOURCE).toContain('@rive-app/webgl2');
    expect(SOURCE).toContain('@rive-app/canvas');
    expect(SOURCE).toContain('BLANK_FRAMES');
    expect(SOURCE).toContain('PIXELS_PRESENT');
  });
});
