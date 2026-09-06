/**
 * Session A chrome binds to Gym Empire's playable A×C IRON & AMBER tokens
 * without forking `src/empire/` or the PX visual-direction tree.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { LIFT_PALETTE } from '../lift/liftPalette';
import { IRON_AMBER, SESSION_PALETTE } from './sessionPalette';

const HERE = path.dirname(fileURLToPath(import.meta.url));

describe('A×C IRON & AMBER bind', () => {
  it('matches the CSS named colours Gym Empire playable chrome uses', () => {
    expect(IRON_AMBER.IRON).toBe('#000000');
    expect(IRON_AMBER.AMBER).toBe('#DAA520');
    expect(IRON_AMBER.IVORY).toBe('#FFFFF0');
    expect(IRON_AMBER.MUTED).toBe('#C0C0C0');
    expect(IRON_AMBER.STAGE_NAMED).toBe('#2F4F4F');
  });

  it('training chrome uses iron / ivory / amber; lift stage colours stay on LIFT_PALETTE', () => {
    expect(SESSION_PALETTE.BACKDROP).toBe(IRON_AMBER.IRON);
    expect(SESSION_PALETTE.TEXT).toBe(IRON_AMBER.IVORY);
    expect(SESSION_PALETTE.ACTION).toBe(IRON_AMBER.AMBER);
    expect(SESSION_PALETTE.ACTION_TEXT).toBe(IRON_AMBER.IRON);
    expect(SESSION_PALETTE.CHIP_CHOSEN).toBe(IRON_AMBER.AMBER);
    expect(SESSION_PALETTE.LIGHT).toBe(IRON_AMBER.IVORY);
    expect(SESSION_PALETTE.TRACE).toBe(LIFT_PALETTE.TRACE);
    expect(SESSION_PALETTE.CUE_PERFECT).toBe(LIFT_PALETTE.CUE_PERFECT);
    expect(SESSION_PALETTE.GRIND_PIP_LIT).toBe(LIFT_PALETTE.GRIND_PIP_LIT);
    expect(SESSION_PALETTE.STAGE).toBe(LIFT_PALETTE.STAGE);
    expect(LIFT_PALETTE.BACKDROP).toBe('#12141a');
  });

  it('does not import Gym Empire modules', () => {
    const source = readFileSync(path.join(HERE, 'sessionPalette.ts'), 'utf8');
    expect(source).not.toMatch(/from ['"]\.\.\/empire\//);
    expect(source).toMatch(/IRON_AMBER/);
    expect(source).toMatch(/GymScreen/);
  });
});
