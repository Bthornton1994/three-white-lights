/**
 * cutInArt.test.ts — that the cut-in reads from the identity table (GDD §7.3)
 * and does not author art of its own (GDD §7.2).
 *
 * The point of §7.3 is that a licensed portrait later is A DATA CHANGE. That is
 * only true if the cut-in surface is already reading from the table BEFORE any
 * art exists, which is why these checks matter now rather than after the art
 * pass: a cut-in that drew its own placeholder today would have to be rebuilt
 * the day a partner arrived, and the whole tier system would have bought
 * nothing.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createGrid, getPx, type IndexGrid } from '../art/raster';
import { FONT, drawText, measureText } from '../card/pixelFont';
import { SHEET } from '../card/sheetPalette';
import { LICENSING_COPY } from '../licensing/licensingTuning';
import { LICENSING_CATALOGUE } from '../licensing/partners';
import { renderPanel } from '../licensing/renderPanels';
import { TIER_3_SLOTS, TIER_3_SURFACES, tier3Of, type IdentityEntry } from '../licensing/tiers';
import { withoutComments } from '../tuning/audit';
import { CUT_IN_SURFACE, cutInIdentity, renderCutIn } from './cutInArt';
import { openCutInSession, requestCutIn, type LiveCutIn } from './cutInGate';
import { CUT_IN_ART } from './cutInTuning';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function source(file: string): string {
  return readFileSync(path.join(HERE, file), 'utf8');
}

const A_LIVE_CUT_IN: LiveCutIn = Object.freeze({
  moment: 'personal-record',
  identityId: CUT_IN_ART.DEFAULT_IDENTITY_ID,
  slot: 'portrait',
});

describe('the cut-in is a Tier 3 surface — GDD §7.3', () => {
  it('“cut-in” is one of §7.3’s four Tier 3 surfaces', () => {
    // Spelled out rather than read off the constant the code uses, and the list
    // is §7.3's own sentence: "cut-ins (§7.2), character select, the shop
    // screen, and the result card (§6.5)".
    expect([...TIER_3_SURFACES].sort()).toEqual(
      ['character-select', 'cut-in', 'result-card', 'shop'].sort(),
    );
    expect(CUT_IN_SURFACE).toBe('cut-in');
  });

  it('renders through the existing licensing panel path, not a parallel one', () => {
    const grid = renderCutIn(LICENSING_CATALOGUE, A_LIVE_CUT_IN);
    expect(grid.w).toBeGreaterThan(0);
    expect(grid.h).toBeGreaterThan(0);
    expect(grid.data.length).toBe(grid.w * grid.h);
  });

  it('DRAWS A DIFFERENT PICTURE FOR A DIFFERENT IDENTITY', () => {
    // The check that the table is actually being read. A renderer that ignored
    // the entry and stamped a fixed placeholder would pass every assertion
    // above and fail this one.
    const first = renderCutIn(LICENSING_CATALOGUE, A_LIVE_CUT_IN);
    const second = renderCutIn(LICENSING_CATALOGUE, {
      ...A_LIVE_CUT_IN,
      identityId: CUT_IN_ART.COACH_IDENTITY_ID,
    });
    expect(first.w).toBe(second.w);
    expect([...first.data]).not.toEqual([...second.data]);
  });

  it('refuses an identity that is not in the table', () => {
    // A cut-in that fired and rendered a blank rectangle is what `partners.ts`
    // calls "exactly what nobody notices".
    expect(() => cutInIdentity(LICENSING_CATALOGUE, 'nobody')).toThrow(RangeError);
    expect(() => renderCutIn(LICENSING_CATALOGUE, { ...A_LIVE_CUT_IN, identityId: 'nobody' })).toThrow(
      RangeError,
    );
  });

  it('every identity the gate can name is really in the table', () => {
    // Non-vacuity for the default-identity constants: a typo there would make
    // every fired cut-in throw at render time, in the app, and nowhere else.
    for (const id of [CUT_IN_ART.DEFAULT_IDENTITY_ID, CUT_IN_ART.COACH_IDENTITY_ID]) {
      expect(cutInIdentity(LICENSING_CATALOGUE, id).id, id).toBe(id);
    }
  });

  it('a cut-in the GATE fired renders — the two halves fit together', () => {
    // End to end, so the gate's output really is a valid render input rather
    // than a shape that only the fixtures above satisfy.
    let session = openCutInSession({ sessionId: 'render', seed: 0 });
    for (let seed = 0; seed < 5000; seed += 1) {
      const candidate = openCutInSession({ sessionId: 'render', seed });
      if (candidate.allowed['personal-record']) {
        session = candidate;
        break;
      }
    }
    const decision = requestCutIn(session, [{ kind: 'record', record: 'e1rm', achieved: true }]);
    const outcome = decision.outcome;
    expect(outcome.kind).toBe('fire');
    if (outcome.kind !== 'fire') return;
    expect(() => renderCutIn(LICENSING_CATALOGUE, outcome.live)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// WHAT THE INTERRUPT ACTUALLY SAYS — GDD §7.2, §7.3
// ---------------------------------------------------------------------------

/**
 * READING TEXT BACK OFF A RENDERED GRID.
 *
 * The gap this exists for: every test above asserts that the cut-in RENDERS and
 * that it differs per identity. None of them looked at what it SAYS — so the
 * beat could print, and for a long time did print, the Tier 3 caption, the Tier
 * 2 name tag and the Tier 1 build label stacked three deep, and every assertion
 * in this file stayed green.
 *
 * HOW IT WORKS. `drawText` is deterministic, so the ink pattern of a string at a
 * given scale is a fixed 2D mask. The mask is slid over the grid; a hit needs
 * every INK cell of the mask to hold one and the same palette index, and every
 * BLANK cell inside the mask's box to hold something else. The blank half is
 * what stops a filled rectangle from "containing" every string in the language.
 *
 * WHAT IT CANNOT DO, stated rather than discovered: it only finds text drawn in
 * a single flat colour at a whole-number scale in the range it is asked about,
 * left to right. That is how every string in this codebase is drawn, and it is
 * not a proof that no other rendering of the label could hide from it.
 */
const SCAN_SCALES: readonly number[] = [1, 2, 3];

/** The ink cells of `text` at `scale`, as offsets from the top-left of its box. */
function glyphMask(text: string, scale: number): { w: number; h: number; ink: readonly number[] } {
  const w = measureText(text) * scale;
  const h = FONT.GLYPH_H * scale;
  // Two indices that are certainly different and certainly not the "unset" 0.
  const scratch = createGrid(w, h, SHEET.PAPER);
  drawText(scratch, text, 0, 0, SHEET.INK, { scale });
  const ink: number[] = [];
  for (let i = 0; i < w * h; i += 1) if (scratch.data[i] === SHEET.INK) ink.push(i);
  return { w, h, ink };
}

/** How many times `text` is drawn in `grid`, at any of `SCAN_SCALES`. */
function countTextIn(grid: IndexGrid, text: string): number {
  let hits = 0;
  for (const scale of SCAN_SCALES) {
    const mask = glyphMask(text, scale);
    if (mask.ink.length === 0 || mask.w > grid.w || mask.h > grid.h) continue;
    const isInk = new Set(mask.ink);
    for (let oy = 0; oy + mask.h <= grid.h; oy += 1) {
      for (let ox = 0; ox + mask.w <= grid.w; ox += 1) {
        const first = mask.ink[0] ?? 0;
        const k = getPx(grid, ox + (first % mask.w), oy + Math.floor(first / mask.w));
        let ok = true;
        for (let i = 0; i < mask.w * mask.h && ok; i += 1) {
          const px = getPx(grid, ox + (i % mask.w), oy + Math.floor(i / mask.w));
          ok = isInk.has(i) ? px === k : px !== k;
        }
        if (ok) hits += 1;
      }
    }
  }
  return hits;
}

/** The words of a build label. The panel WRAPS the label, so words are the unit. */
function labelWordsFor(entry: IdentityEntry): readonly string[] {
  const label = LICENSING_COPY.BUILD_LABELS[entry.tier1.build];
  return [label, ...label.split(' ')];
}

describe('the cut-in prints ONE line of identity text — GDD §7.2, §7.3', () => {
  it('THE SCAN CAN SEE THE BUILD LABEL WHERE IT REALLY IS — the positive control', () => {
    // Not a planted fixture: the CHARACTER-SELECT PANEL, drawn by the real
    // `renderPanel` with no `offer`, which is the branch that prints
    // `BUILD_LABELS[entry.tier1.build]`. That is the exact drawing the cut-in
    // used to mount. If this scan cannot find the label here, the assertion
    // below is vacuous and this whole check is theatre.
    for (const entry of LICENSING_CATALOGUE.entries) {
      const panel = renderPanel({ entry, slot: 'portrait' }, 'character-select');
      for (const word of labelWordsFor(entry)) {
        // The whole label may wrap across two lines in an 82px panel, so only
        // the WORDS are guaranteed contiguous. Every word must be found.
        if (word.includes(' ')) continue;
        expect(countTextIn(panel, word), `${entry.id}: the panel does not show "${word}"`).toBeGreaterThan(0);
      }
    }
  });

  it('THE SCAN CAN SEE TEXT IN A CUT-IN GRID — the second positive control', () => {
    // The control above proves the scan works on a PANEL. This one proves it
    // works on the artifact actually under test, which is the stronger claim: a
    // scan that could not read the cut-in's own grid at all would report every
    // label absent from it and look exactly like a pass.
    for (const entry of LICENSING_CATALOGUE.entries) {
      const grid = renderCutIn(LICENSING_CATALOGUE, { ...A_LIVE_CUT_IN, identityId: entry.id });
      const caption = tier3Of(entry, 'portrait', CUT_IN_SURFACE).caption;
      expect(countTextIn(grid, caption), `${entry.id}: its caption is not on its cut-in`).toBe(1);
    }
  });

  it('NO CUT-IN SHOWS A TIER 1 BUILD LABEL, FOR ANY ENTRY IN THE TABLE', () => {
    // THE DEFECT THIS IS WRITTEN FOR. `renderPanel` with no `offer` prints
    // `LICENSING_COPY.BUILD_LABELS[entry.tier1.build]` unconditionally, and
    // `tier1.build` is REQUIRED on every entry with a non-empty label for every
    // one of its four values — so no row of `partners.ts` can remove that line.
    // While the cut-in mounted the panel, GDD §7.2's "the art pass is a row in
    // the identity table and not a rewiring" was false as written, which is the
    // one property §7.3 exists to guarantee.
    //
    // Every entry and every slot, not just the two ids `CUT_IN_ART` names: the
    // gate takes an identity id as data and `CUT_IN_ART.SLOT` is a per-moment
    // table a later pass is expected to change.
    for (const entry of LICENSING_CATALOGUE.entries) {
      for (const slot of TIER_3_SLOTS) {
        const grid = renderCutIn(LICENSING_CATALOGUE, {
          ...A_LIVE_CUT_IN,
          identityId: entry.id,
          slot,
        });
        for (const word of labelWordsFor(entry)) {
          expect(
            countTextIn(grid, word),
            `${entry.id}/${slot}: the interrupt prints "${word}" — that is the Tier 1 ` +
              'build label, and no row of partners.ts can take it off. See GDD §7.3.',
          ).toBe(0);
        }
      }
    }
  });

  it('THE IDENTITY IS NAMED ONCE, NOT TWICE', () => {
    // The other half of what the panel put on the interrupt beat. For every
    // identity the gate can reach, `tier2.displayName` and the portrait slot's
    // `caption` are the same string, so a surface that prints both prints the
    // partner's name on two consecutive lines. Counted rather than merely
    // detected: "present" was already true and was never the question.
    for (const entry of LICENSING_CATALOGUE.entries) {
      const grid = renderCutIn(LICENSING_CATALOGUE, { ...A_LIVE_CUT_IN, identityId: entry.id });
      expect(
        countTextIn(grid, entry.tier2.displayName),
        `${entry.id}: its name is drawn more than once on the interrupt`,
      ).toBeLessThanOrEqual(1);
    }
  });

  it('and it draws the TIER 3 CAPTION, which is the line that follows the slot', () => {
    // WHICH of the two identity strings the cut-in keeps is a decision, and it
    // is pinned here so that changing it is a deliberate edit rather than a
    // drift. The caption is a field of the same `Tier3Content` as the drawing,
    // so leading a beat with `wordmark` or `product` instead of `portrait`
    // changes the picture AND the line together. The name tag would not move.
    const entry = cutInIdentity(LICENSING_CATALOGUE, CUT_IN_ART.DEFAULT_IDENTITY_ID);
    for (const slot of TIER_3_SLOTS) {
      const grid = renderCutIn(LICENSING_CATALOGUE, { ...A_LIVE_CUT_IN, slot });
      const caption = tier3Of(entry, slot, CUT_IN_SURFACE).caption;
      // Long product captions wrap, so the check is per word: every word of the
      // slot's own caption is on the slot's own cut-in.
      for (const word of caption.split(' ')) {
        expect(countTextIn(grid, word), `${slot}: "${word}" is missing`).toBeGreaterThan(0);
      }
    }
  });
});

describe('THIS PIECE AUTHORS NO CUT-IN ART — GDD §7.2, §11', () => {
  // Comments blanked, STRING CONTENTS KEPT. An authored drawing in this
  // codebase is a string literal, so `codeOnly` — which erases them — would
  // make this scan look at nothing at all.
  const ART = withoutComments(source('cutInArt.ts'));
  const VIEW = withoutComments(source('CutInView.tsx'));

  /**
   * The three marks of an authored drawing in this codebase — a `rows` field, a
   * `legend`, and a row of blanks-and-ink (`spriteMarks.ts`, `gymProps.ts`,
   * `partners.ts` all use the same idiom).
   *
   * A FLOOR, NOT A PROOF, and it is worth saying which way it is weak: the row
   * pattern only catches drawings written in `.` and CAPITALS, which is how
   * every drawing in the tree is actually written but not the only way one
   * could be. It catches the drawing somebody pastes in from another file,
   * which is how art would really arrive here.
   */
  const DRAWING_MARKS: readonly (readonly [string, RegExp])[] = [
    ['a rows field', /\brows\s*[:=]/],
    ['a legend', /\blegend\b/],
    ['a row of pixels', /'[.A-Z]{6,}'/],
    ['a minted Tier 3 asset', /tier3Asset/],
  ];

  it('the scan can see a drawing when there is one', () => {
    // Positive control. Without it, a scan that stopped matching would pass
    // every file, which is the blindness this whole suite is written against.
    const PLANTED = withoutComments(
      "const drawing = { rows: ['..KKKKKK..', '.KKKKKKKK.'], legend: { K: 1 } };",
    );
    for (const [what, pattern] of DRAWING_MARKS) {
      if (what === 'a minted Tier 3 asset') continue;
      expect(PLANTED, what).toMatch(pattern);
    }
    expect(withoutComments('const a = tier3Asset(c);')).toMatch(/tier3Asset/);
  });

  it('holds no authored pixel rows and no legend of its own', () => {
    for (const [name, text] of [
      ['cutInArt.ts', ART],
      ['CutInView.tsx', VIEW],
    ] as const) {
      for (const [what, pattern] of DRAWING_MARKS) {
        expect(text, `${name} has ${what}`).not.toMatch(pattern);
      }
    }
  });

  it('reads the table through §7.3’s witness and stamps with the licensing renderer', () => {
    // `tier3Of(entry, slot, surface)` is the ONLY accessor to Tier 3 content and
    // it cannot be called without naming a surface, so this is what makes the
    // cut-in's picture a row in `partners.ts`.
    expect(ART).toMatch(/tier3Of\(entry, live\.slot, CUT_IN_SURFACE\)/);
    expect(ART).toMatch(/licensing\/tiers/);
    // ...and the stamp is the licensing module's own, not a second copy of the
    // legend-walking loop.
    expect(ART).toMatch(/\bdrawArt\(/);
    expect(ART).toMatch(/licensing\/renderPanels/);
    // NOT the character-select / shop composition. That is one layer above the
    // identity read and carries the Tier 2 name tag, the Tier 1 swatch strip and
    // the Tier 1 build label with it — see the grid scans above.
    expect(ART).not.toMatch(/\brenderPanel\(/);
    // It names the catalogue only as a TYPE and takes it as an argument, so the
    // table is data the caller supplies and not a hard-coded dependency.
    expect(ART).not.toMatch(/from '\.\.\/licensing\/partners'/);
  });
});
