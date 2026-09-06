/**
 * Session A chrome binds to Gym Empire's playable A×C IRON & AMBER tokens
 * without forking `src/empire/` or the PX visual-direction tree.
 *
 * TRAINING-FIT-02 visual SoT (Session A only):
 *   design/session-a-training-fit-02/00-twl-bo-product-bar.md
 *   design/session-a-training-fit-02/01-visual-rework-diagnosis.md
 *   design/session-a-training-fit-02/02-screen-03-impl-contract.md
 *   design/session-a-training-fit-02/03-developer-packet.md
 *
 * If PX publishes those files or TOKEN-MANIFEST into this checkout, every hex
 * in `IRON_AMBER` must appear in the published text when that text actually
 * contains hex. Until they exist, the suite pins the GymScreen CSS named
 * colours and `index.ts` void at Gym Empire `7010867efea4438db7d098a619625400016025da`.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { LIFT_PALETTE } from '../lift/liftPalette';
import { IRON_AMBER, SESSION_PALETTE } from './sessionPalette';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');

const PX_SPEC = 'design/gym-empire-ux-02/visual-direction/04-iron-amber-visual-spec.md';
const PX_MANIFEST_CANDIDATES = [
  'design/gym-empire-ux-02/visual-direction/shared-assets/TOKEN-MANIFEST',
  'design/gym-empire-ux-02/visual-direction/shared-assets/TOKEN-MANIFEST.md',
  'design/gym-empire-ux-02/shared-assets/TOKEN-MANIFEST',
  'design/gym-empire-ux-02/shared-assets/TOKEN-MANIFEST.md',
  'shared-assets/TOKEN-MANIFEST',
  'shared-assets/TOKEN-MANIFEST.md',
] as const;

const TRAINING_FIT_02_SOT = [
  'design/session-a-training-fit-02/00-twl-bo-product-bar.md',
  'design/session-a-training-fit-02/01-visual-rework-diagnosis.md',
  'design/session-a-training-fit-02/02-screen-03-impl-contract.md',
  'design/session-a-training-fit-02/03-developer-packet.md',
] as const;

/** CSS Color Module Level 4 sRGB for GymScreen's named-colour chrome. */
const GYM_SCREEN_NAMED = Object.freeze({
  black: '#000000',
  goldenrod: '#DAA520',
  ivory: '#FFFFF0',
  silver: '#C0C0C0',
  darkslategray: '#2F4F4F',
  gray: '#808080',
});

/** `index.ts` html/body/#root on Gym Empire HEAD `7010867e`. */
const GYM_EMPIRE_VOID = '#1A1410';

function readIfPresent(repoRel: string): string | null {
  const abs = path.join(REPO, repoRel);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
}

function pxBindText(): { files: string[]; text: string } | null {
  const files: string[] = [];
  const chunks: string[] = [];
  const spec = readIfPresent(PX_SPEC);
  if (spec !== null) {
    files.push(PX_SPEC);
    chunks.push(spec);
  }
  for (const candidate of PX_MANIFEST_CANDIDATES) {
    const body = readIfPresent(candidate);
    if (body === null) continue;
    files.push(candidate);
    chunks.push(body);
  }
  for (const packet of TRAINING_FIT_02_SOT) {
    const body = readIfPresent(packet);
    if (body === null) continue;
    files.push(packet);
    chunks.push(body);
  }
  if (files.length === 0) return null;
  return { files, text: chunks.join('\n').toUpperCase() };
}

describe('A×C IRON & AMBER bind', () => {
  it('does not fork PX spec or TOKEN-MANIFEST into this tree', () => {
    expect(existsSync(path.join(HERE, 'TOKEN-MANIFEST'))).toBe(false);
    expect(existsSync(path.join(HERE, '04-iron-amber-visual-spec.md'))).toBe(false);
    const sessionDir = readdirSync(HERE);
    expect(sessionDir.some((name) => name.startsWith('GymScreen'))).toBe(false);
  });

  it('cites TRAINING-FIT-02 visual SoT paths so the suite fail-closes when they land', () => {
    const palette = readFileSync(path.join(HERE, 'sessionPalette.ts'), 'utf8');
    for (const packet of TRAINING_FIT_02_SOT) {
      expect(palette).toContain(packet);
    }
    expect(palette).toMatch(/hard rejects V1/);
  });

  it('consumes PX files when they exist; otherwise GymScreen named CSS + void', () => {
    const px = pxBindText();
    if (px !== null) {
      const hasHex = /#[0-9A-F]{3,8}/.test(px.text);
      if (hasHex) {
        for (const [name, hex] of Object.entries(IRON_AMBER)) {
          expect(
            px.text.includes(hex.toUpperCase()),
            `${name} ${hex} must occur in PX bind files (${px.files.join(', ')}) — re-bind, do not fork`,
          ).toBe(true);
        }
      }
      const contract = readIfPresent(TRAINING_FIT_02_SOT[2]);
      if (contract !== null) {
        expect(contract).toMatch(/V1/);
        expect(contract).toMatch(/V8/);
      }
      if (hasHex) return;
    }
    expect(IRON_AMBER.IRON).toBe(GYM_SCREEN_NAMED.black);
    expect(IRON_AMBER.AMBER).toBe(GYM_SCREEN_NAMED.goldenrod);
    expect(IRON_AMBER.IVORY).toBe(GYM_SCREEN_NAMED.ivory);
    expect(IRON_AMBER.MUTED).toBe(GYM_SCREEN_NAMED.silver);
    expect(IRON_AMBER.STAGE_NAMED).toBe(GYM_SCREEN_NAMED.darkslategray);
    expect(IRON_AMBER.GRAY).toBe(GYM_SCREEN_NAMED.gray);
    expect(IRON_AMBER.VOID).toBe(GYM_EMPIRE_VOID);
  });

  it('training chrome uses warm-iron void / ivory / amber; lift stage stays on LIFT_PALETTE', () => {
    expect(SESSION_PALETTE.BACKDROP).toBe(IRON_AMBER.VOID);
    expect(SESSION_PALETTE.CARD).toBe(IRON_AMBER.IRON);
    expect(SESSION_PALETTE.CARD_EDGE).toBe(IRON_AMBER.GRAY);
    expect(SESSION_PALETTE.CHIP).toBe(IRON_AMBER.IRON);
    expect(SESSION_PALETTE.CHIP_EDGE).toBe(IRON_AMBER.GRAY);
    expect(SESSION_PALETTE.TEXT).toBe(IRON_AMBER.IVORY);
    expect(SESSION_PALETTE.ACTION).toBe(IRON_AMBER.AMBER);
    expect(SESSION_PALETTE.ACTION_TEXT).toBe(IRON_AMBER.IRON);
    expect(SESSION_PALETTE.CHIP_CHOSEN).toBe(IRON_AMBER.AMBER);
    expect(SESSION_PALETTE.LIGHT).toBe(IRON_AMBER.IVORY);
    expect(SESSION_PALETTE.TYPE_HERO).toMatch(/Impact/);
    expect(SESSION_PALETTE.TRACE).toBe(LIFT_PALETTE.TRACE);
    expect(SESSION_PALETTE.CUE_PERFECT).toBe(LIFT_PALETTE.CUE_PERFECT);
    expect(SESSION_PALETTE.GRIND_PIP_LIT).toBe(LIFT_PALETTE.GRIND_PIP_LIT);
    expect(SESSION_PALETTE.STAGE).toBe(LIFT_PALETTE.STAGE);
    expect(LIFT_PALETTE.BACKDROP).toBe('#12141a');
    expect(SESSION_PALETTE.BACKDROP).not.toBe(LIFT_PALETTE.BACKDROP);
    expect(SESSION_PALETTE.BACKDROP).not.toBe(IRON_AMBER.STAGE_NAMED);
  });

  it('does not import Gym Empire modules', () => {
    const source = readFileSync(path.join(HERE, 'sessionPalette.ts'), 'utf8');
    expect(source).not.toMatch(/from ['"]\.\.\/empire\//);
    expect(source).toMatch(/IRON_AMBER/);
    expect(source).toMatch(/GymScreen/);
    expect(source).toMatch(/04-iron-amber-visual-spec/);
    expect(source).toMatch(/TOKEN-MANIFEST/);
    expect(source).toMatch(/session-a-training-fit-02/);
  });
});
