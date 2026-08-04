/**
 * sheetPalette.ts — bank 3 of the project palette: printed paper and ink.
 *
 * ---------------------------------------------------------------------------
 * WHY A FOURTH BANK RATHER THAN A SECOND PALETTE SYSTEM
 * ---------------------------------------------------------------------------
 * `src/art/palette.ts` already fixes the rules: colours are 5-bit triples so an
 * era-illegal colour cannot be written down, they live in banks of 16 whose
 * slot 0 is transparent, and a frame is one grid of `bank * 16 + slot` indices.
 * This file obeys every one of those rules and simply adds the next bank. It
 * imports `Rgb5`, `PaletteBank`, `BANK_SIZE` and `paletteIndex` from there, so
 * there is one definition of what a palette is, not two.
 *
 * It is a SEPARATE FILE rather than a fourth entry in `PALETTE_BANKS` for one
 * blunt reason: `palette.test.ts` pins `PALETTE_BANKS` at three banks and
 * `PALETTE_INDEX_COUNT` at 48, and that file belongs to the lifter-sprite
 * piece. Editing it to make room for the result card would break a suite this
 * piece has no business breaking.
 *
 * The INDEX SPACE is shared and continuous: `SHEET_BANK_INDEX` is 3, so a sheet
 * colour is 48..63 and a sprite colour is 0..47. One grid can therefore hold
 * both, which is what lets the card draw a real loaded barbell out of
 * `src/art/plates.ts` in EQUIPMENT colours on paper drawn in SHEET colours.
 * `sheetGridToRgba` resolves whichever bank an index names.
 *
 * ---------------------------------------------------------------------------
 * WHY THESE COLOURS
 * ---------------------------------------------------------------------------
 * A results sheet is a printed object: warm paper, near-black ink, hairline
 * rules. The 16-bit constraint is not fought here — it is what a printed sheet
 * wants anyway, since paper has a short value range and the ink does all the
 * contrast work.
 *
 * The good/no-lift pair is the one place the card spends saturation. GDD §7.1:
 * "Competition plates are also color-coded by weight in the real sport — that
 * is free visual language". The committed reference
 * (`docs/reference/scoresheet-ref-1-live-attempt-board.png`) shows meet-running
 * software colouring made attempts green and missed attempts red on a LIVE
 * board, and `docs/reference/README.md` licenses that image for exactly
 * "good/no-lift colour coding". It does NOT establish what a PUBLISHED sheet
 * prints — see `NO_LIFT_STRIKES_THROUGH` in `resultCard.ts` — so the greens and
 * reds here are the live-board convention carried onto a card, which is our
 * choice and is written down as ours.
 *
 * UNTUNED. Every triple below is a first pass. They are named constants in one
 * file precisely so they can be turned by hand later without touching a
 * renderer (CLAUDE.md "Game Feel Values Must Be Tunable").
 */

import { BANK_SIZE, RGBA, colorAt, isTransparentIndex, paletteIndex, rgb5ToRgb8, type PaletteBank, type Rgb5 } from '../art/palette';
import type { IndexGrid } from '../art/raster';

/** The bank this file owns. Banks 0-2 are the lifter sprite's. */
export const SHEET_BANK_INDEX = 3;

/** Total index space once this bank is included. */
export const SHEET_PALETTE_INDEX_COUNT = (SHEET_BANK_INDEX + 1) * BANK_SIZE;

const SHEET_COLORS: readonly Rgb5[] = [
  [31, 0, 31], //  0 transparent sentinel (magenta; never rendered)
  [3, 3, 4], //  1 INK           near-black, faintly cool — printer's black
  [11, 11, 12], //  2 INK_SOFT      secondary type: labels, units, small print
  [19, 18, 17], //  3 RULE          hairline table rule, warm so it sits on paper
  [30, 29, 26], //  4 PAPER         warm off-white. The card's ground.
  [27, 26, 23], //  5 PAPER_ALT     alternating row tint. One step down, no more:
  //                                 a banded table whose bands fight the type is
  //                                 the classic spreadsheet-print mistake.
  [24, 23, 20], //  6 PAPER_SHADE   the totals block, a step below the alt row
  [3, 5, 10], //  7 BAND_DARK     masthead ground. Deep navy rather than black so
  //                                 it reads as printed ink on stock, not a hole.
  [6, 9, 16], //  8 BAND_MID      masthead rule / underline
  [30, 30, 31], //  9 BAND_INK      type on the masthead
  [4, 13, 5], // 10 GOOD_DARK     made attempt: the cell's 1px rim
  [15, 25, 13], // 11 GOOD_LIGHT    made attempt: the cell's fill. Type on it is
  //                                 INK — the reference board runs dark type on
  //                                 a light green cell, not the reverse.
  [14, 3, 3], // 12 NOLIFT_DARK   missed attempt: rim, and the strike-through
  [27, 11, 10], // 13 NOLIFT_LIGHT  missed attempt: fill
  [22, 16, 3], // 14 ACCENT       brass. The total, and only the total.
  [31, 26, 10], // 15 ACCENT_HI    brass highlight
];

export const SHEET_BANK: PaletteBank = { name: 'SHEET', colors: SHEET_COLORS };

/** Named indices. Nothing downstream writes a raw number. */
export const SHEET = {
  INK: paletteIndex(SHEET_BANK_INDEX, 1),
  INK_SOFT: paletteIndex(SHEET_BANK_INDEX, 2),
  RULE: paletteIndex(SHEET_BANK_INDEX, 3),
  PAPER: paletteIndex(SHEET_BANK_INDEX, 4),
  PAPER_ALT: paletteIndex(SHEET_BANK_INDEX, 5),
  PAPER_SHADE: paletteIndex(SHEET_BANK_INDEX, 6),
  BAND_DARK: paletteIndex(SHEET_BANK_INDEX, 7),
  BAND_MID: paletteIndex(SHEET_BANK_INDEX, 8),
  BAND_INK: paletteIndex(SHEET_BANK_INDEX, 9),
  GOOD_DARK: paletteIndex(SHEET_BANK_INDEX, 10),
  GOOD_LIGHT: paletteIndex(SHEET_BANK_INDEX, 11),
  NOLIFT_DARK: paletteIndex(SHEET_BANK_INDEX, 12),
  NOLIFT_LIGHT: paletteIndex(SHEET_BANK_INDEX, 13),
  ACCENT: paletteIndex(SHEET_BANK_INDEX, 14),
  ACCENT_HI: paletteIndex(SHEET_BANK_INDEX, 15),
} as const;

/** Colour for any index in the shared space: sprite banks or the sheet bank. */
export function sheetColorAt(index: number): Rgb5 | undefined {
  if (Math.floor(index / BANK_SIZE) !== SHEET_BANK_INDEX) return colorAt(index);
  return SHEET_COLORS[index % BANK_SIZE];
}

/**
 * Index grid -> straight RGBA8888, resolving sprite banks and the sheet bank
 * alike. Mirrors `src/art/rgba.ts`'s `gridToRgba`, which cannot see this bank
 * because `colorAt` stops at 48 — and which must not be changed to, for the
 * reason in the header.
 */
export function sheetGridToRgba(grid: IndexGrid): Uint8Array {
  const out = new Uint8Array(grid.w * grid.h * RGBA.BYTES_PER_PIXEL);
  for (let i = 0; i < grid.w * grid.h; i += 1) {
    const index = grid.data[i] ?? 0;
    if (isTransparentIndex(index)) continue;
    const c5 = sheetColorAt(index);
    if (c5 === undefined) continue;
    const [r, gg, b] = rgb5ToRgb8(c5);
    const o = i * RGBA.BYTES_PER_PIXEL;
    out[o + RGBA.RED_OFFSET] = r;
    out[o + RGBA.GREEN_OFFSET] = gg;
    out[o + RGBA.BLUE_OFFSET] = b;
    out[o + RGBA.ALPHA_OFFSET] = RGBA.OPAQUE;
  }
  return out;
}

/** Distinct indices in the grid that name no allocated colour. */
export function findUnallocatedSheetIndices(grid: IndexGrid): number[] {
  const bad = new Set<number>();
  for (let i = 0; i < grid.data.length; i += 1) {
    const index = grid.data[i] ?? 0;
    if (isTransparentIndex(index)) continue;
    if (sheetColorAt(index) === undefined) bad.add(index);
  }
  return [...bad].sort((a, b) => a - b);
}
