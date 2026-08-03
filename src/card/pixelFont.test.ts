import { describe, expect, it } from 'vitest';

import { createGrid, type IndexGrid } from '../art/raster';
import {
  FONT,
  drawText,
  foldText,
  hasGlyph,
  measureText,
  missingGlyphs,
  strikeThrough,
  textHeight,
  type TextMode,
} from './pixelFont';
import { resultCardStrings } from '../game/resultCard';
import { CARD_LABELS, FOOTER } from './cardTuning';
import { SAMPLE_CARDS } from './sampleCards';

const INK = 1;

/** Draws into a fresh grid and returns it, so each case is isolated. */
function draw(text: string, options?: Parameters<typeof drawText>[5]): IndexGrid {
  const grid = createGrid(200, 24, 0);
  drawText(grid, text, 4, 4, INK, options);
  return grid;
}

/** Columns that have any ink, and the leftmost/rightmost of them. */
function inkExtent(grid: IndexGrid): { left: number; right: number; count: number } {
  let left = grid.w;
  let right = -1;
  let count = 0;
  for (let y = 0; y < grid.h; y += 1) {
    for (let x = 0; x < grid.w; x += 1) {
      if (grid.data[y * grid.w + x] === INK) {
        count += 1;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  return { left, right, count };
}

/** The x of every column holding ink. */
function inkColumns(grid: IndexGrid): number[] {
  const columns: number[] = [];
  for (let x = 0; x < grid.w; x += 1) {
    for (let y = 0; y < grid.h; y += 1) {
      if (grid.data[y * grid.w + x] === INK) {
        columns.push(x);
        break;
      }
    }
  }
  return columns;
}

describe('glyph data', () => {
  const SAMPLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:;\'"!?()/+=%&*#°-—−×· ';

  it('draws every character it claims to have', () => {
    for (const ch of SAMPLE) {
      if (ch === ' ') continue;
      expect(hasGlyph(ch), `no glyph for "${ch}"`).toBe(true);
      const { count } = inkExtent(draw(ch));
      expect(count, `"${ch}" drew nothing`).toBeGreaterThan(0);
    }
  });

  it('keeps every glyph inside the cell it is allotted', () => {
    for (const ch of SAMPLE) {
      const grid = draw(ch);
      const { left, right, count } = inkExtent(grid);
      if (count === 0) continue;
      expect(right - left + 1, `"${ch}" is wider than the cell`).toBeLessThanOrEqual(FONT.GLYPH_W);
      // Ink must never appear above the cell top or below the descender.
      for (let y = 0; y < grid.h; y += 1) {
        for (let x = 0; x < grid.w; x += 1) {
          if (grid.data[y * grid.w + x] !== INK) continue;
          expect(y, `"${ch}" drew above its cell`).toBeGreaterThanOrEqual(4);
          expect(y, `"${ch}" drew below its cell`).toBeLessThan(4 + FONT.GLYPH_H);
        }
      }
    }
  });

  it('keeps capitals and digits out of the descender rows', () => {
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
      const grid = draw(ch);
      for (let y = 4 + FONT.CAP_H; y < grid.h; y += 1) {
        for (let x = 0; x < grid.w; x += 1) {
          expect(grid.data[y * grid.w + x], `"${ch}" has a descender`).not.toBe(INK);
        }
      }
    }
  });

  it('gives the five lowercase letters that need one a real descender', () => {
    for (const ch of 'gjpqy') {
      const grid = draw(ch);
      let belowBaseline = 0;
      for (let y = 4 + FONT.CAP_H; y < grid.h; y += 1) {
        for (let x = 0; x < grid.w; x += 1) {
          if (grid.data[y * grid.w + x] === INK) belowBaseline += 1;
        }
      }
      expect(belowBaseline, `"${ch}" has no descender`).toBeGreaterThan(0);
    }
  });

  it('draws a hollow box, not a blank, for a character it does not have', () => {
    // A missing glyph that renders as a space is a bug that survives review.
    const glyph = '☃'; // snowman: definitely not in the font
    expect(hasGlyph(glyph)).toBe(false);
    expect(inkExtent(draw(glyph)).count).toBeGreaterThan(0);
    expect(missingGlyphs(`meet ${glyph}`)).toEqual([glyph]);
  });

  it('tells O and 0 apart', () => {
    // A zero that is an O is the classic 5px-font failure and a results sheet
    // is nothing but digits.
    const o = inkExtent(draw('O'));
    const zero = inkExtent(draw('0'));
    expect(zero.count).not.toBe(o.count);
  });
});

describe('accented letters', () => {
  it('folds to the base letter rather than to a box', () => {
    expect(foldText('Clément').join('')).toBe('Clement');
    expect(foldText('Miková').join('')).toBe('Mikova');
    expect(foldText('Njergeš Orčik').join('')).toBe('Njerges Orcik');
    expect(missingGlyphs('Corentin Clément')).toEqual([]);
  });

  it('folds a decomposed string too', () => {
    // "e" + U+0301 COMBINING ACUTE, which is what some data sources emit.
    expect(foldText('Clément').join('')).toBe('Clement');
  });

  it('leaves unaccented text alone', () => {
    expect(foldText('Marcus Vale').join('')).toBe('Marcus Vale');
  });
});

describe('measurement matches what is drawn', () => {
  const cases: readonly (readonly [string, TextMode])[] = [
    ['SQUAT', 'proportional'],
    ['Dana Whitmore', 'proportional'],
    ['312.5', 'tabular'],
    ['145', 'tabular'],
    ['481.87', 'tabular'],
    ['1', 'tabular'],
    ['DQ', 'tabular'],
  ];

  it('never draws wider than it measured', () => {
    for (const [text, mode] of cases) {
      const grid = draw(text, { mode });
      const width = measureText(text, mode);
      const { left, right } = inkExtent(grid);
      expect(left, `${text} started left of the pen`).toBeGreaterThanOrEqual(4);
      expect(right - 4 + 1, `${text} overran its measured width`).toBeLessThanOrEqual(width);
    }
  });

  it('right-aligns so the last pixel lands on the anchor', () => {
    for (const [text, mode] of cases) {
      const grid = createGrid(200, 24, 0);
      drawText(grid, text, 150, 4, INK, { mode, align: 'right' });
      const { right } = inkExtent(grid);
      // Tabular figures carry half a cell of air on the right of a narrow
      // glyph, which is the whole point of them; proportional ones do not.
      const slack = mode === 'tabular' ? Math.ceil(FONT.TABULAR_ADVANCE / 2) : 1;
      expect(right, `${text} did not end at its anchor`).toBeGreaterThan(150 - 1 - slack);
      expect(right).toBeLessThanOrEqual(150);
    }
  });

  it('measures an empty string as nothing and draws nothing', () => {
    expect(measureText('')).toBe(0);
    expect(inkExtent(draw('')).count).toBe(0);
  });
});

describe('tabular figures', () => {
  it('puts the same number of digits in the same width', () => {
    // The property a results sheet lives on: 111 and 888 occupy one column.
    expect(measureText('111', 'tabular')).toBe(measureText('888', 'tabular'));
    expect(measureText('137.5', 'tabular')).toBe(measureText('312.5', 'tabular'));
  });

  it('does NOT do that proportionally, which is why the mode exists', () => {
    expect(measureText('111', 'proportional')).not.toBe(measureText('888', 'proportional'));
  });

  it('confines every digit to the same fixed cell, whatever its own width', () => {
    // This is the property a column of weights lives on: the CELL is identical
    // for every digit, so digit N of one number sits over digit N of the next.
    // The ink inside a cell is centred, so a narrow "1" is not expected to
    // start on the same pixel as a wide "8" — it is expected to share a cell.
    const PEN = 10;
    for (const digit of '0123456789') {
      const grid = createGrid(40, 24, 0);
      drawText(grid, digit, PEN, 4, INK, { mode: 'tabular' });
      const { left, right } = inkExtent(grid);
      expect(left, `"${digit}" leaked left of its cell`).toBeGreaterThanOrEqual(PEN);
      expect(right, `"${digit}" leaked right of its cell`).toBeLessThan(PEN + FONT.TABULAR_ADVANCE);
      expect(measureText(digit, 'tabular')).toBe(FONT.TABULAR_ADVANCE);
    }
  });

  it('lands two same-length numbers in the same span', () => {
    const a = createGrid(80, 24, 0);
    const b = createGrid(80, 24, 0);
    drawText(a, '111', 70, 4, INK, { mode: 'tabular', align: 'right' });
    drawText(b, '888', 70, 4, INK, { mode: 'tabular', align: 'right' });
    const wide = inkExtent(b);
    const narrow = inkExtent(a);
    expect(wide.left).toBeLessThanOrEqual(narrow.left);
    expect(wide.right).toBeGreaterThanOrEqual(narrow.right);
    // ...and inside one cell of each other, i.e. the same three columns.
    expect(narrow.left - wide.left).toBeLessThan(FONT.TABULAR_ADVANCE);
    expect(wide.right - narrow.right).toBeLessThan(FONT.TABULAR_ADVANCE);
  });

  it('gives the decimal point less room than a digit', () => {
    // Without this a five-character weight does not fit an attempt cell.
    expect(FONT.TABULAR_PUNCT_ADVANCE).toBeLessThan(FONT.TABULAR_ADVANCE);
    expect(measureText('1.1', 'tabular')).toBeLessThan(3 * FONT.TABULAR_ADVANCE);
    expect(measureText('1.1', 'tabular')).toBe(2 * FONT.TABULAR_ADVANCE + FONT.TABULAR_PUNCT_ADVANCE);
  });

  it('leaves a gap between adjacent glyphs so digits do not touch', () => {
    const grid = draw('88', { mode: 'tabular' });
    const columns = inkColumns(grid);
    // Two 5px-wide glyphs on a 6px pitch: there must be exactly one empty
    // column between them, or the pair reads as one blob.
    const gaps = columns.slice(1).filter((x, i) => x - (columns[i] ?? x) > 1);
    expect(gaps).toHaveLength(1);
  });
});

describe('scaling', () => {
  /** Tall enough that a scale-4 glyph is never clipped by the grid edge. */
  function drawTall(text: string, scale: number): IndexGrid {
    const grid = createGrid(200, 4 + FONT.GLYPH_H * 4 + 4, 0);
    drawText(grid, text, 4, 4, INK, { scale });
    return grid;
  }

  it('multiplies the drawn size by a whole number, never a fraction', () => {
    const one = inkExtent(drawTall('8', 1));
    const three = inkExtent(drawTall('8', 3));
    expect(three.right - three.left + 1).toBe((one.right - one.left + 1) * 3);
    // Every source pixel becomes exactly a 3x3 block: nearest neighbour, no
    // blending, nothing dropped. GDD §7.1.
    expect(three.count).toBe(one.count * 9);
  });

  it('rounds a fractional scale rather than interpolating', () => {
    expect(inkExtent(drawTall('8', 2.4)).count).toBe(inkExtent(drawTall('8', 2)).count);
    expect(textHeight(2.4)).toBe(textHeight(2));
  });

  it('never scales below 1', () => {
    expect(inkExtent(drawTall('8', 0)).count).toBe(inkExtent(drawTall('8', 1)).count);
    expect(textHeight(0)).toBe(FONT.GLYPH_H);
  });
});

describe('strikeThrough', () => {
  it('crosses the number at cap mid-height and spans the width it is given', () => {
    const grid = createGrid(80, 24, 0);
    drawText(grid, '275', 10, 4, INK, { mode: 'tabular' });
    const width = measureText('275', 'tabular');
    const STRIKE = 2;
    strikeThrough(grid, 10, 4, width, STRIKE);

    let struckRow = -1;
    let struckCount = 0;
    for (let y = 0; y < grid.h; y += 1) {
      for (let x = 0; x < grid.w; x += 1) {
        if (grid.data[y * grid.w + x] !== STRIKE) continue;
        struckCount += 1;
        struckRow = y;
      }
    }
    expect(struckCount).toBe(width);
    // Inside the cap, not above it and not on the baseline row.
    expect(struckRow).toBeGreaterThan(4);
    expect(struckRow).toBeLessThan(4 + FONT.CAP_H - 1);
  });

  it('is a line, not a fill', () => {
    const grid = createGrid(80, 24, 0);
    strikeThrough(grid, 10, 4, 20, 2);
    const rows = new Set<number>();
    for (let y = 0; y < grid.h; y += 1) {
      for (let x = 0; x < grid.w; x += 1) {
        if (grid.data[y * grid.w + x] === 2) rows.add(y);
      }
    }
    expect(rows.size).toBe(1);
  });
});

describe('coverage of what the card actually prints', () => {
  it('has a glyph for every character on every sample card', () => {
    for (const { id, card } of SAMPLE_CARDS) {
      for (const text of resultCardStrings(card)) {
        expect(missingGlyphs(text), `${id}: "${text}"`).toEqual([]);
      }
    }
  });

  it('has a glyph for every fixed label the renderer adds', () => {
    const fixed = [...Object.values(CARD_LABELS), FOOTER.WORDMARK, 'LIFT', '1', '2', '3', 'BEST', ' · ', '  ·  '];
    for (const text of fixed) {
      expect(missingGlyphs(text), `"${text}"`).toEqual([]);
    }
  });
});
