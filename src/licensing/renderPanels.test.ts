/**
 * THE TIER 3 SURFACES, checked as pixels.
 *
 * `tools/licensing.mjs` writes the PNGs a human looks at; this file checks the
 * things a human cannot see reliably — that nothing is drawn outside its box,
 * that no text is silently dropped, that every index on the sheet resolves to a
 * colour, and that the whole sheet actually fits a phone at a whole-number
 * upscale, which is the constraint GDD §7.1 and §12.2 impose together and the
 * one a screenshot flatters.
 */

import { describe, expect, it } from 'vitest';

import {
  LICENSING_PANELS,
  artScaleFor,
  drawArt,
  renderCharacterSelect,
  renderLicensingPanel,
  renderPanel,
  renderShopShelf,
  scaleToFit,
  wrapToWidth,
} from './renderPanels';
import { LICENSING_CATALOGUE, IDENTITY_ENTRIES, ILSE_VONDRAK } from './partners';
import { TIER_3_SLOTS, tier3Of } from './tiers';
import { PANEL, SHELF, LICENSING_SCREEN, LICENSING_COPY } from './licensingTuning';
import { findUnallocatedSheetIndices, SHEET } from '../card/sheetPalette';
import { createGrid, getPx } from '../art/raster';
import { measureText } from '../card/pixelFont';

/** The capture viewport `tools/shoot.mjs` uses, in logical points. */
const PHONE_WIDTH = 390;
const PHONE_HEIGHT = 844;

// ---------------------------------------------------------------------------
// Every index on the sheet is a colour
// ---------------------------------------------------------------------------

describe('the sheets are drawable', () => {
  it('uses no unallocated palette index', () => {
    // An unallocated index renders as nothing. On a licensed surface that is a
    // hole where a partner's art should be, and it does not throw.
    for (const panel of LICENSING_PANELS) {
      const grid = renderLicensingPanel(LICENSING_CATALOGUE, panel);
      expect(findUnallocatedSheetIndices(grid), panel).toEqual([]);
    }
  });

  it('draws both surfaces, and they differ', () => {
    const shop = renderShopShelf(LICENSING_CATALOGUE);
    const select = renderCharacterSelect(LICENSING_CATALOGUE);
    expect(shop.w).toBeGreaterThan(0);
    expect(select.w).toBeGreaterThan(0);
    // Two captures that were meant to differ must not silently be the same
    // screen twice — the failure `cardEntry.tsx` records for its own harness.
    expect(Array.from(shop.data)).not.toEqual(Array.from(select.data));
  });

  it('puts every entry on character select and every offer on the shelf', () => {
    const select = renderCharacterSelect(LICENSING_CATALOGUE);
    const shop = renderShopShelf(LICENSING_CATALOGUE);
    const rowsFor = (n: number): number => Math.ceil(n / SHELF.COLUMNS);
    const heightFor = (n: number): number =>
      SHELF.MARGIN * 2 + SHELF.HEADING_H + rowsFor(n) * PANEL.H + (rowsFor(n) - 1) * SHELF.GAP;
    expect(select.h).toBe(heightFor(IDENTITY_ENTRIES.length));
    expect(shop.h).toBe(heightFor(LICENSING_CATALOGUE.reskins.length));
  });
});

// ---------------------------------------------------------------------------
// Nothing is drawn outside its box
// ---------------------------------------------------------------------------

describe('a panel stays inside itself', () => {
  it('leaves the bottom margin clear of text', () => {
    // The Tier 1 strip is the last thing on the panel and it is positioned from
    // the bottom, so the failure mode is the mechanics line running into it.
    // Checking the strip's own row is the wrong test — it is supposed to have
    // ink. Checking the row BELOW the strip is right: nothing may be there.
    for (const entry of IDENTITY_ENTRIES) {
      for (const slot of TIER_3_SLOTS) {
        const grid = renderPanel({ entry, slot }, 'character-select');
        for (let y = PANEL.H - PANEL.PAD + 1; y < PANEL.H - 1; y += 1) {
          for (let x = 1; x < PANEL.W - 1; x += 1) {
            expect(getPx(grid, x, y), `${entry.id} ${slot} ink at ${x},${y}`).toBe(SHEET.PAPER);
          }
        }
      }
    }
  });

  it('keeps the art inside its well', () => {
    // `drawArt` clips at the grid edge via `setPx`, so overflow inside the
    // panel would be silent. The well's top border row must stay untouched.
    for (const entry of IDENTITY_ENTRIES) {
      for (const slot of TIER_3_SLOTS) {
        const content = tier3Of(entry, slot, 'shop');
        const wellW = PANEL.W - PANEL.PAD * 2;
        const scale = artScaleFor(content.art, wellW, PANEL.ART_H);
        const w = (content.art.rows[0]?.length ?? 0) * scale;
        const h = content.art.rows.length * scale;
        expect(w, `${entry.id} ${slot} too wide for the well`).toBeLessThanOrEqual(wellW);
        expect(h, `${entry.id} ${slot} too tall for the well`).toBeLessThanOrEqual(PANEL.ART_H);
      }
    }
  });

  it('scales a drawing up when the well has room, and never past the cap', () => {
    // Non-vacuity on `artScaleFor`: if it always returned 1 the art would sit
    // in a corner of a large well and nothing here would say so.
    const portrait = tier3Of(ILSE_VONDRAK, 'portrait', 'character-select');
    expect(artScaleFor(portrait.art, PANEL.W - PANEL.PAD * 2, PANEL.ART_H)).toBeGreaterThan(1);
    // ...and the cap holds even in an enormous well.
    const huge = artScaleFor(portrait.art, 10_000, 10_000);
    expect(huge).toBe(PANEL.ART_MAX_SCALE);
    // ...and it floors at 1 rather than going to 0 in a well too small.
    expect(artScaleFor(portrait.art, 1, 1)).toBe(1);
  });

  it('stamps art at a whole-number scale, with no interpolation', () => {
    // GDD §7.1. Each source pixel becomes a solid `scale x scale` block.
    const grid = createGrid(8, 8, SHEET.PAPER);
    drawArt(grid, { rows: ['K.', '.K'], legend: { K: SHEET.INK } }, 0, 0, 3);
    for (let y = 0; y < 3; y += 1) {
      for (let x = 0; x < 3; x += 1) {
        expect(getPx(grid, x, y)).toBe(SHEET.INK);
        expect(getPx(grid, x + 3, y)).toBe(SHEET.PAPER);
        expect(getPx(grid, x + 3, y + 3)).toBe(SHEET.INK);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// No text is dropped
// ---------------------------------------------------------------------------

describe('wrapToWidth', () => {
  it('never drops a word, even when nothing fits', () => {
    // A truncated licensed wordmark is worse than a wrapped one, and a
    // SILENTLY truncated one is worse than both.
    for (const text of [
      'Ninebar Athletic',
      'Halberd Grip Co.',
      'Teodor Kessling',
      'SAME AS RECOVERY DAY',
      'ONEVERYLONGUNBREAKABLETOKEN',
      'a b c d e f g',
    ]) {
      const joined = wrapToWidth(text, PANEL.W - PANEL.PAD * 2).join(' ');
      expect(joined, text).toBe(text);
    }
  });

  it('wraps to at most the configured number of lines', () => {
    for (const text of ['a b c d e f g h i j', 'SAME AS RECOVERY DAY']) {
      expect(wrapToWidth(text, PANEL.W - PANEL.PAD * 2).length).toBeLessThanOrEqual(
        PANEL.TEXT_LINES,
      );
    }
  });

  it('does not wrap what already fits', () => {
    expect(wrapToWidth('Ninebar', PANEL.W)).toEqual(['Ninebar']);
  });

  it('is exercised by the real data, or it is untested scaffolding', () => {
    // At least one real caption must actually need two lines, or the wrap is a
    // function nothing in the product runs.
    const inner = PANEL.W - PANEL.PAD * 2;
    const wrapped = IDENTITY_ENTRIES.flatMap((entry) =>
      TIER_3_SLOTS.map((slot) => wrapToWidth(tier3Of(entry, slot, 'shop').caption, inner).length),
    );
    expect(Math.max(...wrapped)).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// The §8.1 promise is on the surface, not only in the tests
// ---------------------------------------------------------------------------

describe('the no-stat promise is printed', () => {
  it('names the house item under every sponsored offer', () => {
    // GDD §8.1: "mechanically identical to the fictional item it reskins". A
    // promise a player cannot read is a promise only the tests know about.
    // Checked through the copy constant rather than a literal, so rewording the
    // line does not silently delete the claim.
    expect(LICENSING_COPY.SAME_AS.length).toBeGreaterThan(0);
    for (const reskin of LICENSING_CATALOGUE.reskins) {
      const base = LICENSING_CATALOGUE.baseItems.find((i) => i.sku === reskin.reskins);
      expect(base, reskin.sku).toBeDefined();
      const line = `${LICENSING_COPY.SAME_AS} ${base?.displayName.toUpperCase() ?? ''}`;
      // It has to FIT, or it is printed off the edge of the panel.
      const lines = wrapToWidth(line, PANEL.W - PANEL.PAD * 2);
      expect(lines.length, `${reskin.sku}: "${line}"`).toBeLessThanOrEqual(PANEL.TEXT_LINES);
      for (const l of lines) {
        expect(measureText(l), `${reskin.sku}: "${l}" overflows`).toBeLessThanOrEqual(
          PANEL.W - PANEL.PAD * 2,
        );
      }
    }
  });

  it('says on the sheet itself that nothing here is real', () => {
    expect(LICENSING_COPY.PLACEHOLDER_NOTE.length).toBeGreaterThan(0);
    expect(measureText(LICENSING_COPY.PLACEHOLDER_NOTE)).toBeLessThanOrEqual(
      renderShopShelf(LICENSING_CATALOGUE).w - SHELF.MARGIN * 2,
    );
  });
});

// ---------------------------------------------------------------------------
// It fits a phone at a whole-number upscale
// ---------------------------------------------------------------------------

describe('phone scale (GDD §7.1, §12.2)', () => {
  it('doubles inside a 390pt viewport rather than dropping to 1x', () => {
    // THE CONSTRAINT A SCREENSHOT FLATTERS. Nearest neighbour means the sheet
    // can only be drawn at whole multiples; one pixel too wide and the whole
    // screen falls to 1x, where the 5x9 font is unreadable on a phone. This is
    // the assertion that fails when somebody widens a panel by two pixels.
    const available = PHONE_WIDTH - LICENSING_SCREEN.PAD * 2;
    for (const panel of LICENSING_PANELS) {
      const grid = renderLicensingPanel(LICENSING_CATALOGUE, panel);
      const scale = scaleToFit(grid.w, available);
      expect(scale, `${panel} falls to ${scale}x on a phone`).toBeGreaterThanOrEqual(2);
      expect(grid.w * scale, `${panel} overflows the viewport`).toBeLessThanOrEqual(available);
      // ...and it has to fit vertically too, or the capture is cropped.
      expect(grid.h * scale, `${panel} is taller than the viewport`).toBeLessThanOrEqual(
        PHONE_HEIGHT,
      );
    }
  });

  it('never picks a fractional scale', () => {
    for (const width of [100, 183, 200, 389, 390, 1000]) {
      const scale = scaleToFit(182, width);
      expect(Number.isInteger(scale)).toBe(true);
      expect(scale).toBeGreaterThanOrEqual(1);
      expect(scale).toBeLessThanOrEqual(LICENSING_SCREEN.MAX_SCALE);
    }
  });
});
