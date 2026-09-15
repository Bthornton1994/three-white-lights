import { describe, expect, it } from 'vitest';

import { BANK_SIZE, PAL, PALETTE_BANKS, colorAt, isTransparentIndex, paletteIndex, rgb5ToRgb8, type Rgb5 } from '../art/palette';
import { createGrid } from '../art/raster';
import {
  SHEET,
  SHEET_BANK,
  SHEET_BANK_INDEX,
  SHEET_PALETTE_INDEX_COUNT,
  SHEET_CSS,
  findUnallocatedSheetIndices,
  sheetColorAt,
  sheetCss,
  sheetGridToRgba,
} from './sheetPalette';

/** Rec. 601 luma, good enough to order a ramp by value. */
function luma(c: Rgb5): number {
  const [r, g, b] = rgb5ToRgb8(c);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function lumaOf(index: number): number {
  const c = sheetColorAt(index);
  expect(c, `index ${index}`).toBeDefined();
  return c === undefined ? -1 : luma(c);
}

function dominantChannel(index: number): number {
  const c = sheetColorAt(index);
  expect(c).toBeDefined();
  if (c === undefined) return -1;
  const max = Math.max(c[0], c[1], c[2]);
  const winners = [0, 1, 2].filter((i) => c[i] === max);
  return winners.length === 1 ? (winners[0] ?? -1) : -1;
}

describe('the sheet bank obeys the palette system it extends', () => {
  it('sits after the three sprite banks, not on top of one', () => {
    expect(SHEET_BANK_INDEX).toBe(PALETTE_BANKS.length);
    expect(SHEET_PALETTE_INDEX_COUNT).toBe((PALETTE_BANKS.length + 1) * BANK_SIZE);
    // The sprite banks must still be unreachable from a sheet index and vice
    // versa; one shared, continuous index space is the whole point.
    for (const index of Object.values(SHEET)) {
      expect(Math.floor(index / BANK_SIZE)).toBe(SHEET_BANK_INDEX);
      expect(colorAt(index), `sprite palette must not know index ${index}`).toBeUndefined();
    }
  });

  it('fills the bank exactly to the hardware limit', () => {
    expect(SHEET_BANK.colors).toHaveLength(BANK_SIZE);
  });

  it('stores every channel as an integer inside the 5-bit range', () => {
    for (const c of SHEET_BANK.colors) {
      for (const ch of c) {
        expect(Number.isInteger(ch)).toBe(true);
        expect(ch).toBeGreaterThanOrEqual(0);
        expect(ch).toBeLessThanOrEqual(31);
      }
    }
  });

  it('treats slot 0 as transparent and never spends two slots on one colour', () => {
    expect(isTransparentIndex(paletteIndex(SHEET_BANK_INDEX, 0))).toBe(true);
    const seen = new Set<string>();
    SHEET_BANK.colors.forEach((c, slot) => {
      if (slot === 0) return;
      const key = c.join(',');
      expect(seen.has(key), `slot ${slot} duplicates ${key}`).toBe(false);
      seen.add(key);
    });
  });

  it('resolves every name in SHEET to an allocated colour', () => {
    for (const [name, index] of Object.entries(SHEET)) {
      expect(sheetColorAt(index), `${name} -> ${index}`).toBeDefined();
    }
  });

  it('resolves sprite colours too, so one grid can hold both', () => {
    // The barbell on the card is drawn in EQUIPMENT colours on SHEET paper.
    expect(sheetColorAt(PAL.STEEL_MID)).toEqual(colorAt(PAL.STEEL_MID));
    expect(sheetColorAt(PAL.PLATE_RED_LIGHT)).toEqual(colorAt(PAL.PLATE_RED_LIGHT));
  });

  it('leaves indices past the bank undefined rather than silently valid', () => {
    expect(sheetColorAt(SHEET_PALETTE_INDEX_COUNT + 1)).toBeUndefined();
  });
});

describe('the sheet reads as printed paper', () => {
  it('keeps ink far below paper', () => {
    // A results sheet is dark type on light stock. Anything less than a wide
    // gap here and the card stops looking printed.
    expect(lumaOf(SHEET.PAPER) - lumaOf(SHEET.INK)).toBeGreaterThan(150);
    expect(lumaOf(SHEET.PAPER)).toBeGreaterThan(lumaOf(SHEET.PAPER_ALT));
    expect(lumaOf(SHEET.PAPER_ALT)).toBeGreaterThan(lumaOf(SHEET.PAPER_SHADE));
    expect(lumaOf(SHEET.PAPER_SHADE)).toBeGreaterThan(lumaOf(SHEET.RULE));
    expect(lumaOf(SHEET.RULE)).toBeGreaterThan(lumaOf(SHEET.INK_SOFT));
    expect(lumaOf(SHEET.INK_SOFT)).toBeGreaterThan(lumaOf(SHEET.INK));
  });

  it('keeps the masthead legible', () => {
    expect(lumaOf(SHEET.BAND_INK) - lumaOf(SHEET.BAND_DARK)).toBeGreaterThan(150);
    expect(lumaOf(SHEET.BAND_MID)).toBeGreaterThan(lumaOf(SHEET.BAND_DARK));
    // The date line is set in RULE on the band; it has to clear the band too.
    expect(lumaOf(SHEET.RULE) - lumaOf(SHEET.BAND_DARK)).toBeGreaterThan(80);
    // The total is set in brass on the same band.
    expect(lumaOf(SHEET.ACCENT_HI) - lumaOf(SHEET.BAND_DARK)).toBeGreaterThan(120);
    expect(lumaOf(SHEET.ACCENT_HI)).toBeGreaterThan(lumaOf(SHEET.ACCENT));
  });

  it('takes dark type on both attempt cells', () => {
    for (const fill of [SHEET.GOOD_LIGHT, SHEET.NOLIFT_LIGHT]) {
      expect(lumaOf(fill) - lumaOf(SHEET.INK)).toBeGreaterThan(90);
    }
    // Each cell's rim must separate it from its own fill and from the paper.
    expect(lumaOf(SHEET.GOOD_LIGHT) - lumaOf(SHEET.GOOD_DARK)).toBeGreaterThan(40);
    expect(lumaOf(SHEET.NOLIFT_LIGHT) - lumaOf(SHEET.NOLIFT_DARK)).toBeGreaterThan(40);
  });

  it('tells a made attempt from a missed one by VALUE as well as by hue', () => {
    // Roughly one man in twelve cannot separate these two by hue. A card meant
    // to be posted publicly has to survive that, so green and red differ in
    // brightness as well — on top of the strike-through, which is the real
    // belt-and-braces (see NO_LIFT_STRIKES_THROUGH in resultCard.ts).
    expect(dominantChannel(SHEET.GOOD_LIGHT)).toBe(1);
    expect(dominantChannel(SHEET.NOLIFT_LIGHT)).toBe(0);
    expect(Math.abs(lumaOf(SHEET.GOOD_LIGHT) - lumaOf(SHEET.NOLIFT_LIGHT))).toBeGreaterThan(25);
  });
});

describe('sheetGridToRgba', () => {
  it('writes the expanded 8-bit colour of every index it is given', () => {
    const grid = createGrid(3, 1, 0);
    grid.data[0] = SHEET.PAPER;
    grid.data[1] = SHEET.INK;
    grid.data[2] = PAL.PLATE_RED_LIGHT;
    const rgba = sheetGridToRgba(grid);

    const expectAt = (i: number, index: number): void => {
      const c = sheetColorAt(index);
      expect(c).toBeDefined();
      if (c === undefined) return;
      const [r, g, b] = rgb5ToRgb8(c);
      expect([rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2], rgba[i * 4 + 3]]).toEqual([r, g, b, 255]);
    };
    expectAt(0, SHEET.PAPER);
    expectAt(1, SHEET.INK);
    expectAt(2, PAL.PLATE_RED_LIGHT);
  });

  it('leaves a transparent index fully transparent', () => {
    const grid = createGrid(1, 1, 0);
    const rgba = sheetGridToRgba(grid);
    expect([rgba[0], rgba[1], rgba[2], rgba[3]]).toEqual([0, 0, 0, 0]);
  });

  it('produces four bytes per pixel and no padding', () => {
    const grid = createGrid(7, 5, SHEET.PAPER);
    expect(sheetGridToRgba(grid)).toHaveLength(7 * 5 * 4);
  });
});

describe('findUnallocatedSheetIndices', () => {
  it('finds an index that names no colour', () => {
    const grid = createGrid(2, 1, 0);
    grid.data[0] = SHEET.PAPER;
    grid.data[1] = SHEET_PALETTE_INDEX_COUNT + 3;
    expect(findUnallocatedSheetIndices(grid)).toEqual([SHEET_PALETTE_INDEX_COUNT + 3]);
  });

  it('finds nothing in a grid of real colours', () => {
    const grid = createGrid(2, 1, SHEET.PAPER);
    grid.data[1] = PAL.STEEL_MID;
    expect(findUnallocatedSheetIndices(grid)).toEqual([]);
  });
});

describe('sheetCss', () => {
  it('matches SHEET_CSS for every named slot', () => {
    expect(SHEET_CSS.PAPER).toMatch(/^#[0-9a-f]{6}$/);
    expect(SHEET_CSS.INK).toBe(sheetCss(SHEET.INK));
    expect(SHEET_CSS.INK).not.toBe(SHEET_CSS.PAPER);
  });
});
