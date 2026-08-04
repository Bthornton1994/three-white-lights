import { describe, expect, it } from 'vitest';

import { PAL } from '../art/palette';
import { createGrid, type IndexGrid } from '../art/raster';
import {
  ATTEMPT_GRID_HEADINGS,
  NO_VALUE_DISPLAY,
  PLACE_NO_TOTAL_DISPLAY,
  SEX_CATEGORY_WORD,
  buildResultCard,
  type ResultCard,
  type ResultCardInput,
} from '../game/resultCard';
import { createMeet, declareAttempt, resolveAttempt, type JudgePanel, type MeetState } from '../game/meet';
import {
  BARBELL,
  CARD,
  CARD_LABELS,
  FOOTER,
  GRID,
  GRID_RIGHT_X,
  LIFTER_STRIP,
  MASTHEAD,
  SCORE_BLOCKS,
  SCORE_BLOCK_W,
  TOTAL_BLOCK,
  CONTENT,
  gridCellX,
  gridRowY,
} from './cardTuning';
import {
  LIFTER_META_LADDER,
  lifterMetaLineY,
  lifterMetaRungs,
  lifterNameY,
  rungNamesDivision,
} from './cardTuning';
import { visualPlateStack } from '../art/plates';
import {
  DEFAULT_GRID_HEADINGS,
  barbellCaption,
  firstThatFits,
  fitScale,
  fitSleeve,
  heaviestGoodLift,
  lifterMetaLinesAtRung,
  lifterStrip,
  renderResultCard,
} from './renderResultCard';
import { SHEET, findUnallocatedSheetIndices } from './sheetPalette';
import { BOMBED_MEET_CARD, MASTERS_MEET_CARD, STRESS_MEET_CARD, STRONG_MEET_CARD } from './sampleCards';
import { FONT, capHeight, drawText, measureText } from './pixelFont';

// ---------------------------------------------------------------------------
// Pixel probes. Everything below asserts against the grid the renderer actually
// produced, not against the card model it was given — the model already has its
// own suite in `src/game/resultCard.test.ts`.
// ---------------------------------------------------------------------------

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

function countIn(grid: IndexGrid, rect: Rect, index: number): number {
  let count = 0;
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      if (x < 0 || y < 0 || x >= grid.w || y >= grid.h) continue;
      if (grid.data[y * grid.w + x] === index) count += 1;
    }
  }
  return count;
}

/** Longest run of `index` along any single row inside the rect. */
function longestRunIn(grid: IndexGrid, rect: Rect, index: number): number {
  let best = 0;
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    let run = 0;
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      if (x < 0 || y < 0 || x >= grid.w || y >= grid.h) continue;
      if (grid.data[y * grid.w + x] === index) {
        run += 1;
        if (run > best) best = run;
      } else {
        run = 0;
      }
    }
  }
  return best;
}

function cellRect(rowIndex: number, cellIndex: number): Rect {
  return { x: gridCellX(cellIndex), y: gridRowY(rowIndex), w: GRID.CELL_W, h: GRID.ROW_H };
}

/**
 * The inside of a cell, with its 1px rim excluded on all four sides.
 *
 * THIS EXISTS BECAUSE OF A MUTANT THAT SURVIVED. The strike-through test used
 * to measure the longest run of the cell's dark colour across the WHOLE cell —
 * and the cell's own rim is that colour and spans the full width, so deleting
 * the strike entirely left every assertion passing. Inside the rim, a long
 * horizontal run of the dark colour can only be a strike.
 */
function cellInteriorRect(rowIndex: number, cellIndex: number): Rect {
  const outer = cellRect(rowIndex, cellIndex);
  const inset = GRID.CELL_INSET_X + 1;
  const insetY = GRID.CELL_INSET_Y + 1;
  return { x: outer.x + inset, y: outer.y + insetY, w: outer.w - 2 * inset, h: outer.h - 2 * insetY };
}

/**
 * Assert that the ink inside `rect` is exactly what `text` draws there.
 *
 * THIS EXISTS BECAUSE OF A SECOND MUTANT THAT SURVIVED. Every assertion in
 * this file used to be about colour and area, so a renderer that printed the
 * THIRD ATTEMPT in the best column — 275 where 265 belongs — passed
 * everything: the fill was right, the pixel count was close, and nothing
 * checked which number it was. A results sheet whose best column is wrong is
 * the single worst thing this piece could ship, so the check is now on the
 * glyphs.
 *
 * It works by drawing the expected string into a blank grid with the same
 * arguments the renderer uses, and comparing the ink masks. That is not a
 * tautology as long as the EXPECTED STRING is written out by hand in the test,
 * which it is.
 */
interface TextRun {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly options?: Parameters<typeof drawText>[5];
}

/**
 * The same check for a rect that holds MORE THAN ONE run of the same ink — the
 * masthead sets the date to the left margin and the place to the right, and a
 * probe that could only describe one of them would have to leave the other
 * unasserted.
 */
function expectRunsIn(
  grid: IndexGrid,
  rect: Rect,
  runs: readonly TextRun[],
  index: number,
  label: string,
  /**
   * A colour that is allowed to sit on top of the type. Only the strike-through
   * does this: it crosses the digits by design, so three pixels of "275"
   * legitimately come out the strike's colour instead of the ink's.
   */
  overdrawnBy?: number,
): void {
  const reference = createGrid(CARD.W, CARD.H, 0);
  for (const run of runs) drawText(reference, run.text, run.x, run.y, index, run.options);
  const spelled = runs.map((run) => run.text).join(' | ');
  let mismatches = 0;
  let inkPixels = 0;
  for (let py = rect.y; py < rect.y + rect.h; py += 1) {
    for (let px = rect.x; px < rect.x + rect.w; px += 1) {
      const i = py * CARD.W + px;
      const value = grid.data[i];
      const expected = reference.data[i] === index;
      if (expected) inkPixels += 1;
      const actual = value === index || (expected && overdrawnBy !== undefined && value === overdrawnBy);
      if (actual !== expected) mismatches += 1;
    }
  }
  expect(inkPixels, `${label}: expected "${spelled}" to draw something`).toBeGreaterThan(0);
  expect(mismatches, `${label}: pixels do not spell "${spelled}"`).toBe(0);
}

function expectTextIn(
  grid: IndexGrid,
  rect: Rect,
  text: string,
  x: number,
  y: number,
  index: number,
  options: Parameters<typeof drawText>[5],
  label: string,
  overdrawnBy?: number,
): void {
  expectRunsIn(grid, rect, [{ text, x, y, options }], index, label, overdrawnBy);
}

/** Where a number is drawn inside a grid cell, matching the renderer exactly. */
function cellTextAnchor(rowIndex: number, cellIndex: number): { x: number; y: number } {
  return {
    x: gridCellX(cellIndex) + GRID.CELL_W - GRID.CELL_TEXT_PAD,
    y: gridRowY(rowIndex) + GRID.ROW_TEXT_DY,
  };
}

const TABULAR_RIGHT = { align: 'right', mode: 'tabular' } as const;

const TOTAL_RECT: Rect = { x: 0, y: TOTAL_BLOCK.Y, w: CARD.W, h: TOTAL_BLOCK.H };
const DOTS_RECT: Rect = { x: CONTENT.X, y: SCORE_BLOCKS.Y, w: SCORE_BLOCK_W, h: SCORE_BLOCKS.H };
const PLACE_RECT: Rect = {
  x: CONTENT.X + SCORE_BLOCK_W + SCORE_BLOCKS.GAP,
  y: SCORE_BLOCKS.Y,
  w: SCORE_BLOCK_W,
  h: SCORE_BLOCKS.H,
};

// The top third of the card. Every rect below stops one pixel inside the frame
// on each side, because the frame's own columns are SHEET.INK and would show up
// as stray ink in a mask that is supposed to hold nothing but type.
const INSIDE_FRAME = { x: 1, w: CARD.W - 2 } as const;

const FEDERATION_RECT: Rect = {
  ...INSIDE_FRAME,
  y: MASTHEAD.Y,
  h: MASTHEAD.MEET_NAME_Y - MASTHEAD.Y,
};
const MEET_NAME_RECT: Rect = {
  ...INSIDE_FRAME,
  y: MASTHEAD.MEET_NAME_Y,
  h: MASTHEAD.PLACE_DATE_Y - MASTHEAD.MEET_NAME_Y,
};
const DATE_PLACE_RECT: Rect = {
  ...INSIDE_FRAME,
  y: MASTHEAD.PLACE_DATE_Y,
  h: MASTHEAD.Y + MASTHEAD.H - MASTHEAD.PLACE_DATE_Y,
};
/**
 * THE WHOLE STRIP, minus its closing rule — not just the rows a line happens to
 * be set on today.
 *
 * The strip prints its category on one line or two, and the name steps up two
 * rows when it prints two (`LIFTER_META_LADDER`), so a rect drawn tightly
 * around either position would have nothing to say about a card in the other
 * mode. The band works for both probes because the name is drawn in
 * `SHEET.INK` and the meta lines in `SHEET.INK_SOFT`: each mask sees only its
 * own ink, and nothing else in the band is drawn in either — the paper and the
 * rule are two more indices. So each probe asserts BOTH that its runs are what
 * they are and that there is no other ink of that colour anywhere in the strip.
 */
const LIFTER_STRIP_RECT: Rect = {
  ...INSIDE_FRAME,
  y: LIFTER_STRIP.Y,
  h: LIFTER_STRIP.H - 1,
};
const LIFTER_NAME_RECT: Rect = LIFTER_STRIP_RECT;
const LIFTER_META_RECT: Rect = LIFTER_STRIP_RECT;
/** The header row of the attempt grid, above its closing rule. */
const GRID_HEADER_RECT: Rect = { ...INSIDE_FRAME, y: GRID.HEADER_Y, h: GRID.RULE_Y - GRID.HEADER_Y };
const FOOTER_RECT: Rect = { ...INSIDE_FRAME, y: FOOTER.Y, h: FOOTER.H };

/**
 * A tight box around a right-aligned value, big enough for the type and nothing
 * else.
 *
 * THIS EXISTS BECAUSE OF THREE MUTANTS THAT SURVIVED. The bombed card's total
 * block, DOTS block and place block were each checked by counting pixels of one
 * colour across the WHOLE block — and each block draws a label or a unit in
 * that same colour, so: deleting the em dash from the total left the "KG" unit
 * satisfying `countIn(BOMBED, TOTAL_RECT, SHEET.RULE) > 0`; deleting the DOTS
 * placeholder left the word "DOTS" satisfying
 * `countIn(BOMBED, DOTS_RECT, SHEET.INK_SOFT) > 0`; and printing "12" in place
 * of "DQ" satisfied `countIn(BOMBED, PLACE_RECT, SHEET.NOLIFT_DARK) > 20` —
 * i.e. the suite passed a card that ranked a bombed lifter twelfth, which is
 * the one thing `resultCard.ts` exists to refuse. Boxing the value away from
 * its label is what lets the check be on the glyphs instead.
 */
function valueRect(right: number, top: number, bottom: number, text: string, scale: number): Rect {
  const width = measureText(text, 'tabular') * scale;
  return { x: right - width - 2, y: top, w: width + 3, h: bottom - top };
}

const TOTAL_VALUE_BOTTOM = TOTAL_BLOCK.Y + TOTAL_BLOCK.H;
const SCORE_VALUE_BOTTOM = SCORE_BLOCKS.Y + SCORE_BLOCKS.H - 1;
const DOTS_VALUE_RIGHT = CONTENT.X + SCORE_BLOCK_W - SCORE_BLOCKS.VALUE_PAD_RIGHT;
const PLACE_VALUE_RIGHT = PLACE_RECT.x + SCORE_BLOCK_W - SCORE_BLOCKS.VALUE_PAD_RIGHT;
const SCORE_VALUE_Y = SCORE_BLOCKS.Y + SCORE_BLOCKS.VALUE_DY;
const BARBELL_RECT: Rect = { x: 0, y: BARBELL.CENTER_Y - 16, w: CARD.W, h: 32 };
/**
 * The caption line above the bar. One line of type and nothing else — the score
 * blocks end above it and the shaft starts below it — so anything found in here
 * is the caption or the detail.
 */
const CAPTION_RECT: Rect = { ...INSIDE_FRAME, y: BARBELL.CAPTION_Y, h: FONT.GLYPH_H };

const PLATE_FILLS = [
  PAL.PLATE_RED_LIGHT,
  PAL.PLATE_RED_SHADE,
  PAL.PLATE_BLUE_LIGHT,
  PAL.PLATE_BLUE_SHADE,
  PAL.PLATE_YELLOW_LIGHT,
  PAL.PLATE_YELLOW_SHADE,
  PAL.PLATE_GREEN_LIGHT,
  PAL.PLATE_GREEN_SHADE,
  PAL.PLATE_BLACK_LIGHT,
  PAL.PLATE_BLACK_SHADE,
];

function plateCount(grid: IndexGrid): number {
  return PLATE_FILLS.reduce((sum, index) => sum + countIn(grid, BARBELL_RECT, index), 0);
}

const STRONG = renderResultCard(STRONG_MEET_CARD);
const BOMBED = renderResultCard(BOMBED_MEET_CARD);
const STRESS = renderResultCard(STRESS_MEET_CARD);

// A third case the samples do not cover: nothing made at all, so there is no
// heaviest lift for the barbell to load.
const GOOD: JudgePanel = ['white', 'white', 'white'];
const NO_LIFT: JudgePanel = ['red', 'red', 'red'];

function take(state: MeetState, weight: number, lights: JudgePanel): MeetState {
  const declared = declareAttempt(state, { weight });
  if (!declared.ok) throw new Error(declared.error.message);
  const judged = resolveAttempt(declared.value, { lights });
  if (!judged.ok) throw new Error(judged.error.message);
  return judged.value;
}

function cardOf(input: ResultCardInput): ResultCard {
  const built = buildResultCard(input);
  if (!built.ok) throw new Error(built.error.message);
  return built.card;
}

const NOTHING_MADE_CARD = cardOf({
  meet: { federation: 'Irongate', name: 'National Championships', dateIso: '2026-02-14', town: 'Sheffield' },
  lifter: { name: 'Kit Alder', sex: 'male', bodyweightKg: 82.6, division: 'Open', equipment: 'Raw' },
  state: [
    [200, NO_LIFT],
    [200, NO_LIFT],
    [202.5, NO_LIFT],
  ].reduce<MeetState>((state, entry) => take(state, entry[0] as number, entry[1] as JudgePanel), createMeet()),
});
const NOTHING_MADE = renderResultCard(NOTHING_MADE_CARD);

/**
 * A fourth case: the longest of everything. A four-digit total is the only load
 * that can push the total block's value down a whole scale, so it is the only
 * card that can see `TOTAL_BLOCK.LABEL_VALUE_MIN_GAP` at all.
 */
const LONG_TOTAL_CARD = cardOf({
  meet: {
    federation: 'Continental Powerlifting Alliance',
    name: 'Autumn Open Championships and Qualifier',
    dateIso: '2026-11-07',
    town: 'Newcastle upon Tyne',
    country: 'England',
  },
  lifter: {
    name: 'Konstantinos Papadopoulos-Wright',
    sex: 'male',
    bodyweightKg: 139.4,
    division: 'Masters 1',
    equipment: 'Single-ply',
  },
  state: [
    [400, GOOD],
    [420, GOOD],
    [440, GOOD],
    [280, GOOD],
    [300, GOOD],
    [312.5, GOOD],
    [370, GOOD],
    [390, GOOD],
    [400, GOOD],
  ].reduce<MeetState>((state, entry) => take(state, entry[0] as number, entry[1] as JudgePanel), createMeet()),
  placing: 1,
});

// ---------------------------------------------------------------------------

describe('the grid the renderer produces', () => {
  it('is exactly the authored resolution', () => {
    for (const grid of [STRONG, BOMBED, NOTHING_MADE]) {
      expect(grid.w).toBe(CARD.W);
      expect(grid.h).toBe(CARD.H);
    }
  });

  it('names an allocated colour at every pixel', () => {
    for (const grid of [STRONG, BOMBED, NOTHING_MADE]) {
      expect(findUnallocatedSheetIndices(grid)).toEqual([]);
    }
  });

  it('leaves no hole: a shareable card is opaque edge to edge', () => {
    for (const grid of [STRONG, BOMBED, NOTHING_MADE]) {
      let transparent = 0;
      for (let i = 0; i < grid.data.length; i += 1) if ((grid.data[i] ?? 0) % 16 === 0) transparent += 1;
      expect(transparent).toBe(0);
    }
  });

  it('draws the two sample cards differently, and not by a pixel', () => {
    let differing = 0;
    for (let i = 0; i < STRONG.data.length; i += 1) {
      if (STRONG.data[i] !== BOMBED.data[i]) differing += 1;
    }
    expect(differing).toBeGreaterThan(CARD.W * CARD.H * 0.05);
  });

  it('takes its column headings from resultCard.ts rather than retyping them', () => {
    // The renderer's own docstring says it "decides NOTHING about what the card
    // says". It used to default to the literal ['LIFT','1','2','3','BEST'], so
    // renaming a heading in `ATTEMPT_GRID_HEADINGS` would have left the drawn
    // card unchanged — a string decision living in the layout file.
    expect(DEFAULT_GRID_HEADINGS).toEqual([
      ATTEMPT_GRID_HEADINGS.lift,
      ...ATTEMPT_GRID_HEADINGS.attempts,
      ATTEMPT_GRID_HEADINGS.best,
    ]);
    expect(DEFAULT_GRID_HEADINGS).toHaveLength(GRID.CELL_COUNT + 1);
    // ...and the default really is what an un-parameterised call draws.
    const explicit = renderResultCard(STRONG_MEET_CARD, DEFAULT_GRID_HEADINGS);
    expect(Array.from(explicit.data)).toEqual(Array.from(STRONG.data));
  });

  it('spells those headings on the card', () => {
    // The assertion above compares two constants that move together, so on its
    // own it is a tautology: renaming `ATTEMPT_GRID_HEADINGS.best` to "TOP"
    // passed it. These literals are hand-written, so a rename has to come with
    // a deliberate edit here.
    expectRunsIn(
      STRONG,
      GRID_HEADER_RECT,
      [
        { text: 'LIFT', x: GRID.LABEL_X, y: GRID.HEADER_TEXT_Y },
        ...['1', '2', '3', 'BEST'].map((text, i) => ({
          text,
          x: gridCellX(i) + Math.floor(GRID.CELL_W / 2),
          y: GRID.HEADER_TEXT_Y,
          options: { align: 'center' } as const,
        })),
      ],
      SHEET.INK_SOFT,
      'grid headings',
    );
  });

  it('carries the app’s wordmark, and no federation’s', () => {
    // GDD §11 leaves real-federation licensing open, so the footer is the one
    // place the card is branded and it is branded as ours.
    expectTextIn(
      STRONG,
      FOOTER_RECT,
      'THREE WHITE LIGHTS',
      Math.floor(CARD.W / 2),
      FOOTER.TEXT_Y,
      SHEET.BAND_INK,
      { align: 'center' },
      'footer wordmark',
    );
  });

  it('stays inside its own frame', () => {
    for (let x = 0; x < CARD.W; x += 1) {
      expect(STRONG.data[x]).toBe(SHEET.INK);
      expect(STRONG.data[(CARD.H - 1) * CARD.W + x]).toBe(SHEET.INK);
    }
  });
});

// ---------------------------------------------------------------------------
// The top third of the card.
//
// THIS BLOCK EXISTS BECAUSE THERE WAS NOTHING HERE. Every content assertion in
// this file used to sit inside the attempt grid, so the masthead, the lifter's
// name and the identity strip had no pixel-level check of any kind — which is
// how the card came to omit the lifter's SEX entirely while `resultCard.ts`
// computed it, exported it, put it third in `RESULT_SHEET_COLUMNS` and wrote it
// into the CSV row. Nothing could have failed. Now something can.
//
// Every expected string below is written out BY HAND. That is what stops the
// glyph-mask probe from being a tautology: it compares the rendered card
// against these literals, not against the model the renderer was handed.
// ---------------------------------------------------------------------------

describe('the masthead, in pixels', () => {
  it('sets the federation, the meet and the date and place', () => {
    expectTextIn(
      STRONG,
      FEDERATION_RECT,
      'IRONGATE',
      Math.floor(CARD.W / 2),
      MASTHEAD.FEDERATION_BASELINE - capHeight(2),
      SHEET.BAND_INK,
      { align: 'center', scale: 2 },
      'strong federation',
    );
    expectTextIn(
      STRONG,
      MEET_NAME_RECT,
      'National Championships',
      Math.floor(CARD.W / 2),
      MASTHEAD.MEET_NAME_Y,
      SHEET.BAND_INK,
      { align: 'center' },
      'strong meet name',
    );
    expectRunsIn(
      STRONG,
      DATE_PLACE_RECT,
      [
        { text: '14 FEB 2026', x: CONTENT.X, y: MASTHEAD.PLACE_DATE_Y },
        { text: 'SHEFFIELD, ENGLAND', x: CONTENT.RIGHT, y: MASTHEAD.PLACE_DATE_Y, options: { align: 'right' } },
      ],
      SHEET.RULE,
      'strong date and place',
    );
  });

  it('drops the federation a whole step and shortens the place rather than truncating either', () => {
    // The stress card's federation will not set at double height and its town
    // and country will not fit beside the date. Both must come out as shorter
    // TRUE statements, never as "CONTINENTAL ALLIANC" or "NEWCASTLE UPON TY…".
    expectTextIn(
      STRESS,
      FEDERATION_RECT,
      'CONTINENTAL ALLIANCE',
      Math.floor(CARD.W / 2),
      MASTHEAD.FEDERATION_BASELINE - capHeight(1),
      SHEET.BAND_INK,
      { align: 'center', scale: 1 },
      'stress federation',
    );
    expectRunsIn(
      STRESS,
      DATE_PLACE_RECT,
      [
        { text: '07 NOV 2026', x: CONTENT.X, y: MASTHEAD.PLACE_DATE_Y },
        { text: 'NEWCASTLE UPON TYNE', x: CONTENT.RIGHT, y: MASTHEAD.PLACE_DATE_Y, options: { align: 'right' } },
      ],
      SHEET.RULE,
      'stress date and short place',
    );
  });
});

describe('the lifter identity strip, in pixels', () => {
  it('sets the lifter’s name', () => {
    expectTextIn(STRONG, LIFTER_NAME_RECT, 'Marcus Vale', CONTENT.X, LIFTER_STRIP.NAME_Y, SHEET.INK, { scale: 2 }, 'strong name');
    expectTextIn(BOMBED, LIFTER_NAME_RECT, 'Dana Whitmore', CONTENT.X, LIFTER_STRIP.NAME_Y, SHEET.INK, { scale: 2 }, 'bombed name');
    // The stress card reflows to two meta lines, which steps the name up as
    // well as down: `NAME_Y_COMPACT`, not `NAME_Y`.
    expectTextIn(
      STRESS,
      LIFTER_NAME_RECT,
      'Konstantín Papadopoulos',
      CONTENT.X,
      LIFTER_STRIP.NAME_Y_COMPACT,
      SHEET.INK,
      { scale: 1 },
      'stress name',
    );
  });

  it('SAYS WHOSE CATEGORY IT IS — the card prints DOTS, and DOTS takes sex', () => {
    // The gap this block was written for. A card that publishes a coefficient
    // while withholding one of its inputs cannot be checked by the people
    // GDD §6.5 says have to believe it, and the weight class does not stand in:
    // 84 is a women's class, 83 a men's, and "120+" is just "the top one".
    expectTextIn(
      STRONG,
      LIFTER_META_RECT,
      "MEN'S RAW OPEN 93 · 92.40 KG",
      CONTENT.X,
      LIFTER_STRIP.META_Y,
      SHEET.INK_SOFT,
      {},
      'strong meta line',
    );
    expectTextIn(
      BOMBED,
      LIFTER_META_RECT,
      "WOMEN'S RAW OPEN 69 · 68.20 KG",
      CONTENT.X,
      LIFTER_STRIP.META_Y,
      SHEET.INK_SOFT,
      {},
      'bombed meta line',
    );
    // Under pressure the strip takes a SECOND line rather than spending a fact.
    // Both runs hand-written; the card that used to print
    // "MEN'S SINGLE-PLY 120+ · 139.40" — no division, next to PLACE 3 — fails
    // this on the first line's mask.
    expectRunsIn(
      STRESS,
      LIFTER_META_RECT,
      [
        { text: "MEN'S SINGLE-PLY MASTERS 1 120+", x: CONTENT.X, y: LIFTER_STRIP.META_Y_TWO_LINE[0] },
        { text: '139.40 KG', x: CONTENT.X, y: LIFTER_STRIP.META_Y_TWO_LINE[1] },
      ],
      SHEET.INK_SOFT,
      'stress meta lines',
    );
  });

  it('draws a different strip for a man and a woman with identical numbers', () => {
    // The differential check. Both cards run the same meet, weigh the same,
    // sit in the same declared class and take the same division and kit, so
    // the ONLY thing that can move a pixel in this strip is the sex. A card
    // that computed the sex and dropped it on the floor — which is exactly
    // what shipped — renders these two identically.
    const base: ResultCardInput = {
      meet: { federation: 'Irongate', name: 'National Championships', dateIso: '2026-02-14', town: 'Sheffield' },
      lifter: {
        name: 'Sam Reyes',
        sex: 'male',
        bodyweightKg: 74,
        division: 'Open',
        equipment: 'Raw',
        // Pinned, so flipping the sex cannot change the class string and give
        // the test a difference that has nothing to do with the sex.
        weightClassKg: '74',
      },
      state: [
        [200, GOOD],
        [210, GOOD],
        [220, GOOD],
        [120, GOOD],
        [130, GOOD],
        [140, GOOD],
        [230, GOOD],
        [240, GOOD],
        [250, GOOD],
      ].reduce<MeetState>((state, entry) => take(state, entry[0] as number, entry[1] as JudgePanel), createMeet()),
    };
    const asMan = cardOf(base);
    const asWoman = cardOf({ ...base, lifter: { ...base.lifter, sex: 'female' } });
    expect(asMan.lifter.weightClassText).toBe(asWoman.lifter.weightClassText);
    expect(asMan.lifter.bodyweightText).toBe(asWoman.lifter.bodyweightText);
    expect(asMan.totalKg).toBe(asWoman.totalKg);

    const manGrid = renderResultCard(asMan);
    const womanGrid = renderResultCard(asWoman);
    let differing = 0;
    for (let y = LIFTER_META_RECT.y; y < LIFTER_META_RECT.y + LIFTER_META_RECT.h; y += 1) {
      for (let x = LIFTER_META_RECT.x; x < LIFTER_META_RECT.x + LIFTER_META_RECT.w; x += 1) {
        const i = y * CARD.W + x;
        if (manGrid.data[i] !== womanGrid.data[i]) differing += 1;
      }
    }
    expect(differing, 'the identity strip must not be the same for both sexes').toBeGreaterThan(0);
    expectTextIn(manGrid, LIFTER_META_RECT, "MEN'S RAW OPEN 74 · 74.00 KG", CONTENT.X, LIFTER_STRIP.META_Y, SHEET.INK_SOFT, {}, 'man');
    expectTextIn(womanGrid, LIFTER_META_RECT, "WOMEN'S RAW OPEN 74 · 74.00 KG", CONTENT.X, LIFTER_STRIP.META_Y, SHEET.INK_SOFT, {}, 'woman');
  });
});

// ---------------------------------------------------------------------------
// A PLACING IS A PLACING IN A DIVISION.
//
// THIS BLOCK EXISTS BECAUSE THE STRESS CARD PRINTED "PLACE 3" OVER AN IDENTITY
// LINE THAT READ "MEN'S SINGLE-PLY 120+". Third in what? On a real sheet the
// division is never missing next to a rank — a meet page makes it the section
// heading over the rows the ranks are in — and a one-lifter card has no section
// heading, so it has to be on the line. Nothing here could have failed before:
// the suite pinned the truncated line as CORRECT.
//
// Every expected string below is written out BY HAND.
// ---------------------------------------------------------------------------

/** Nine for nine: a state that totals, so a card built on it may be placed. */
function nineForNine(): MeetState {
  return (
    [
      [200, GOOD],
      [210, GOOD],
      [220, GOOD],
      [120, GOOD],
      [130, GOOD],
      [140, GOOD],
      [230, GOOD],
      [240, GOOD],
      [250, GOOD],
    ] as const
  ).reduce<MeetState>((state, entry) => take(state, entry[0], entry[1] as JudgePanel), createMeet());
}

/**
 * A placed lifter whose category will not fit one line — and whose name WOULD
 * fit at double height, which is what the strip spends to buy the second one.
 * This is `sampleCards.ts`'s `masters` card, so what is asserted here is what
 * the harness renders.
 */
const SHORT_NAME_MASTERS_CARD = MASTERS_MEET_CARD;

/**
 * The same lifter, same numbers, same everything — with no placing supplied.
 * Not a sample: it exists to isolate the placing as the only difference.
 */
const SHORT_NAME_MASTERS_UNPLACED_CARD = cardOf({
  meet: { federation: 'Irongate', name: 'National Championships', dateIso: '2026-02-14', town: 'Sheffield' },
  lifter: {
    name: 'Nils Berg',
    sex: 'male',
    bodyweightKg: 138.6,
    division: 'Masters 2',
    equipment: 'Single-ply',
  },
  state: nineForNine(),
});

/**
 * The widest phrase a real entry list can produce: the longer sex word, the
 * longer kit word, the longest IPF age division and a super-heavyweight class.
 * At 182 px it is two past `CONTENT.W`, so it is the one case that exercises
 * the rung where the division moves to the second line instead of sharing the
 * first.
 */
const WIDEST_PHRASE_CARD = cardOf({
  meet: { federation: 'Irongate', name: 'National Championships', dateIso: '2026-02-14', town: 'Sheffield' },
  lifter: {
    name: 'Ada Ng',
    sex: 'female',
    bodyweightKg: 84.9,
    division: 'Sub-Juniors',
    equipment: 'Single-ply',
  },
  state: nineForNine(),
  placing: 1,
});

/** Everything the strip prints, joined — what a reader of the card sees. */
function stripText(card: ResultCard, maxWidth: number = CONTENT.W): string {
  return lifterStrip(card, maxWidth).metaLines.join(' ');
}

describe('a card that prints a PLACING prints its DIVISION', () => {
  it('spells both, on the card, in pixels', () => {
    // The pairing itself, on the artifact: the place block says 3 and the
    // identity strip says which division it was third in. Hand-written, both.
    expectTextIn(
      STRESS,
      valueRect(PLACE_VALUE_RIGHT, SCORE_VALUE_Y, SCORE_VALUE_BOTTOM, '3', 2),
      '3',
      PLACE_VALUE_RIGHT,
      SCORE_VALUE_Y,
      SHEET.INK,
      { ...TABULAR_RIGHT, scale: 2 },
      'stress place',
    );
    expectRunsIn(
      STRESS,
      LIFTER_META_RECT,
      [
        { text: "MEN'S SINGLE-PLY MASTERS 1 120+", x: CONTENT.X, y: LIFTER_STRIP.META_Y_TWO_LINE[0] },
        { text: '139.40 KG', x: CONTENT.X, y: LIFTER_STRIP.META_Y_TWO_LINE[1] },
      ],
      SHEET.INK_SOFT,
      'stress division beside its placing',
    );
  });

  it('names the division on all three sample cards', () => {
    // Hand-written table, card by card: what each one is placed as, and the
    // word its strip has to carry. The bombed card is DQ'd rather than placed —
    // it is here to say that the sweep is not vacuous for it either.
    const expected = [
      { card: STRONG_MEET_CARD, place: '1', division: 'OPEN' },
      { card: BOMBED_MEET_CARD, place: 'DQ', division: 'OPEN' },
      { card: STRESS_MEET_CARD, place: '3', division: 'MASTERS 1' },
    ] as const;
    for (const { card, place, division } of expected) {
      expect(card.summary[2].value, card.lifter.name).toBe(place);
      expect(stripText(card), card.lifter.name).toContain(division);
    }
  });

  it('has no rung, at all, that a placed card could fall back to and lose it', () => {
    // Structural, not measured: the rungs that spend the division are filtered
    // out of a placed card's ladder BEFORE any width is looked at, so there is
    // no division string, however long, that produces a ranked card with no
    // division on it. The literals are hand-written.
    expect(LIFTER_META_LADDER.map(rungNamesDivision)).toEqual([true, true, true, true, false, false]);
    expect(lifterMetaRungs(true)).toHaveLength(4);
    for (const [i, rung] of lifterMetaRungs(true).entries()) {
      expect(rungNamesDivision(rung), `placed rung ${i}`).toBe(true);
    }
    // ...and an unplaced card is still offered the whole ladder, which is the
    // residual this piece has carried and documented all along.
    expect(lifterMetaRungs(false)).toEqual(LIFTER_META_LADDER);
    expect(lifterMetaRungs(false).length).toBeGreaterThan(lifterMetaRungs(true).length);
  });

  it('keeps it at every width, on every placed card', () => {
    const cards = [
      { card: STRONG_MEET_CARD, division: 'OPEN' },
      { card: STRESS_MEET_CARD, division: 'MASTERS 1' },
      { card: SHORT_NAME_MASTERS_CARD, division: 'MASTERS 2' },
      { card: WIDEST_PHRASE_CARD, division: 'SUB-JUNIORS' },
    ] as const;
    for (const { card, division } of cards) {
      expect(card.placed, card.lifter.name).toBe(true);
      for (const width of [CONTENT.W, 140, 110, 90, 40, 0]) {
        expect(stripText(card, width), `${card.lifter.name} at ${width}px`).toContain(division);
      }
    }
  });

  it('is the placing that does it, and nothing else about the lifter', () => {
    // The differential. Same name, same kit, same division, same bodyweight,
    // same meet — one card was given a placing and one was not. If the placed
    // filter did nothing, these two would be identical.
    expect(SHORT_NAME_MASTERS_CARD.placed).toBe(true);
    expect(SHORT_NAME_MASTERS_UNPLACED_CARD.placed).toBe(false);
    expect(stripText(SHORT_NAME_MASTERS_CARD, 90)).toContain('MASTERS 2');
    expect(stripText(SHORT_NAME_MASTERS_UNPLACED_CARD, 90)).not.toContain('MASTERS 2');
  });

  it('moves the division to the second line rather than spending it', () => {
    // The widest phrase a real entry list produces overruns a line of its own by
    // two pixels, so the division comes out of the phrase and shares the second
    // line with the bodyweight. Hand-written, both lines.
    expect(lifterStrip(WIDEST_PHRASE_CARD, CONTENT.W).metaLines).toEqual([
      "WOMEN'S SINGLE-PLY 84+",
      'SUB-JUNIORS · 84.90 KG',
    ]);
    // ...and that really is because the whole phrase does not fit: 182 against
    // the 180 the content column has. Hand-written; a card that got wider would
    // fail here rather than silently changing which rung prints.
    expect(measureText("WOMEN'S SINGLE-PLY SUB-JUNIORS 84+")).toBe(182);
    expect(CONTENT.W).toBe(180);
  });

  it('buys the second line out of the name’s type size, not out of the card', () => {
    // "Nils Berg" fits at double height — the strip steps it down anyway,
    // because a smaller name is a smaller name and a dropped division is a
    // missing fact.
    expect(fitScale('Nils Berg', CONTENT.W, LIFTER_STRIP.NAME_SCALE)).toBe(2);
    const strip = lifterStrip(SHORT_NAME_MASTERS_CARD, CONTENT.W);
    expect(strip.nameScale).toBe(1);
    expect(strip.metaLines).toEqual(["MEN'S SINGLE-PLY MASTERS 2 120+", '138.60 KG']);
    // A one-line card keeps the big name.
    expect(lifterStrip(STRONG_MEET_CARD, CONTENT.W).nameScale).toBe(2);

    const grid = renderResultCard(SHORT_NAME_MASTERS_CARD);
    expectTextIn(
      grid,
      LIFTER_NAME_RECT,
      'Nils Berg',
      CONTENT.X,
      LIFTER_STRIP.NAME_Y_COMPACT,
      SHEET.INK,
      { scale: 1 },
      'short name stepped down',
    );
    expectRunsIn(
      grid,
      LIFTER_META_RECT,
      [
        { text: "MEN'S SINGLE-PLY MASTERS 2 120+", x: CONTENT.X, y: LIFTER_STRIP.META_Y_TWO_LINE[0] },
        { text: '138.60 KG', x: CONTENT.X, y: LIFTER_STRIP.META_Y_TWO_LINE[1] },
      ],
      SHEET.INK_SOFT,
      'short-name masters strip',
    );
  });

  it('leaves the grid, the total and the barbell exactly where they were', () => {
    // The second line is free only if it costs no height. Everything below the
    // strip is compared pixel for pixel against a card that prints ONE line.
    const twoLine = renderResultCard(SHORT_NAME_MASTERS_CARD);
    const oneLine = STRONG;
    const stripBottom = LIFTER_STRIP.Y + LIFTER_STRIP.H;
    let differing = 0;
    for (let y = stripBottom; y < GRID.HEADER_Y; y += 1) {
      for (let x = 0; x < CARD.W; x += 1) {
        if (twoLine.data[y * CARD.W + x] !== oneLine.data[y * CARD.W + x]) differing += 1;
      }
    }
    expect(differing, 'the band between the strip and the grid moved').toBe(0);
    // The grid's own header row is drawn at the same place on both.
    expectRunsIn(
      twoLine,
      GRID_HEADER_RECT,
      [
        { text: 'LIFT', x: GRID.LABEL_X, y: GRID.HEADER_TEXT_Y },
        ...['1', '2', '3', 'BEST'].map((text, i) => ({
          text,
          x: gridCellX(i) + Math.floor(GRID.CELL_W / 2),
          y: GRID.HEADER_TEXT_Y,
          options: { align: 'center' } as const,
        })),
      ],
      SHEET.INK_SOFT,
      'grid headings under a two-line strip',
    );
  });

  it('keeps the two lines clear of the name, of each other and of the rule', () => {
    // Measured off the rendered card rather than off the constants, because the
    // Y of each line is a free tuning value and what is NOT free is type
    // landing on type. `FONT.GLYPH_H` is 9 — seven rows of capital and two of
    // descender — and "Papadopoulos" has two descenders to collide with.
    const rowsWith = (index: number): readonly number[] => {
      const rows: number[] = [];
      for (let y = LIFTER_STRIP.Y; y < LIFTER_STRIP.Y + LIFTER_STRIP.H; y += 1) {
        if (countIn(STRESS, { x: 1, y, w: CARD.W - 2, h: 1 }, index) > 0) rows.push(y);
      }
      return rows;
    };
    const nameRows = rowsWith(SHEET.INK);
    const metaRows = rowsWith(SHEET.INK_SOFT);
    expect(nameRows.length).toBeGreaterThan(0);
    expect(metaRows.length).toBeGreaterThan(0);
    // No row carries both, so nothing is set on top of anything else.
    expect(metaRows.filter((row) => nameRows.includes(row))).toEqual([]);
    // The name is above both meta lines, and the meta lines stop above the
    // strip's closing rule.
    expect(Math.max(...nameRows)).toBeLessThan(Math.min(...metaRows));
    expect(Math.max(...metaRows)).toBeLessThan(LIFTER_STRIP.Y + LIFTER_STRIP.H - 1);
    // There really are TWO separate lines down there, not one tall smear: the
    // inked rows fall into exactly two contiguous runs.
    const runs = metaRows.filter((row) => !metaRows.includes(row - 1)).length;
    expect(runs, 'the strip should be printing two meta lines').toBe(2);
  });
});

describe('attempt cells, in pixels', () => {
  it('fills a made attempt green and a missed one red', () => {
    // Squat: 250 good, 265 good, 275 missed.
    expect(countIn(STRONG, cellRect(0, 0), SHEET.GOOD_LIGHT)).toBeGreaterThan(100);
    expect(countIn(STRONG, cellRect(0, 0), SHEET.NOLIFT_LIGHT)).toBe(0);
    expect(countIn(STRONG, cellRect(0, 2), SHEET.NOLIFT_LIGHT)).toBeGreaterThan(100);
    expect(countIn(STRONG, cellRect(0, 2), SHEET.GOOD_LIGHT)).toBe(0);
  });

  it('strikes the missed attempt through, and only the missed one', () => {
    // Measured INSIDE the rim, so the rim's own full-width run cannot stand in
    // for a strike that is not there — see `cellInteriorRect`.
    const struck = longestRunIn(STRONG, cellInteriorRect(0, 2), SHEET.NOLIFT_DARK);
    expect(struck).toBeGreaterThanOrEqual(measureText('275', 'tabular'));
    // A made attempt has a rim but no strike, so its interior is clean.
    expect(countIn(STRONG, cellInteriorRect(0, 0), SHEET.GOOD_DARK)).toBe(0);
    expect(countIn(STRONG, cellInteriorRect(0, 1), SHEET.GOOD_DARK)).toBe(0);
  });

  it('leaves an attempt that was never taken with no cell at all', () => {
    // Bombed card, deadlift row: never contested. No green, no red, no rim.
    for (const cellIndex of [0, 1, 2]) {
      const rect = cellRect(2, cellIndex);
      expect(countIn(BOMBED, rect, SHEET.GOOD_LIGHT)).toBe(0);
      expect(countIn(BOMBED, rect, SHEET.NOLIFT_LIGHT)).toBe(0);
      expect(countIn(BOMBED, rect, SHEET.GOOD_DARK)).toBe(0);
      expect(countIn(BOMBED, rect, SHEET.NOLIFT_DARK)).toBe(0);
    }
  });

  it('draws all three attempts of a bombed lift red and struck', () => {
    for (const cellIndex of [0, 1, 2]) {
      const rect = cellRect(1, cellIndex);
      expect(countIn(BOMBED, rect, SHEET.NOLIFT_LIGHT), `bench ${cellIndex + 1}`).toBeGreaterThan(100);
      expect(
        longestRunIn(BOMBED, cellInteriorRect(1, cellIndex), SHEET.NOLIFT_DARK),
        `bench ${cellIndex + 1} strike`,
      ).toBeGreaterThanOrEqual(measureText('75', 'tabular'));
    }
  });

  it('prints the right number in every attempt cell', () => {
    const expected = [
      ['250', '265', '275'],
      ['160', '170', '177.5'],
      ['280', '300', '312.5'],
    ];
    expected.forEach((row, rowIndex) => {
      row.forEach((text, cellIndex) => {
        const anchor = cellTextAnchor(rowIndex, cellIndex);
        expectTextIn(
          STRONG,
          cellRect(rowIndex, cellIndex),
          text,
          anchor.x,
          anchor.y,
          SHEET.INK,
          TABULAR_RIGHT,
          `attempt ${rowIndex}.${cellIndex}`,
          SHEET.NOLIFT_DARK,
        );
      });
    });
  });

  it('prints the BEST of the lift in the best column, not the last attempt', () => {
    // Squat: made 250 and 265, MISSED 275. The best column says 265. A
    // renderer reading the third attempt instead would say 275 here and look
    // entirely plausible.
    const BEST_COLUMN = GRID.CELL_COUNT - 1;
    const expected = ['265', '177.5', '312.5'];
    expected.forEach((text, rowIndex) => {
      const anchor = cellTextAnchor(rowIndex, BEST_COLUMN);
      expectTextIn(
        STRONG,
        cellRect(rowIndex, BEST_COLUMN),
        text,
        anchor.x,
        anchor.y,
        SHEET.INK,
        TABULAR_RIGHT,
        `best ${rowIndex}`,
      );
    });
  });

  it('prints a dash, not a zero, in the best column of a bombed lift', () => {
    const BEST_COLUMN = GRID.CELL_COUNT - 1;
    const anchor = cellTextAnchor(1, BEST_COLUMN);
    expectTextIn(
      BOMBED,
      cellRect(1, BEST_COLUMN),
      NO_VALUE_DISPLAY,
      anchor.x,
      anchor.y,
      SHEET.INK_SOFT,
      TABULAR_RIGHT,
      'bombed best',
    );
    // ...and no full-strength ink at all, which is what a digit would be.
    expect(countIn(BOMBED, cellRect(1, BEST_COLUMN), SHEET.INK)).toBe(0);
  });

  it('keeps every cell inside its own column', () => {
    // A weight that overran its cell would touch the next one's rim, which is
    // the fastest way to make a table look broken.
    for (let cellIndex = 0; cellIndex < GRID.CELL_COUNT - 1; cellIndex += 1) {
      const gutter: Rect = { x: gridCellX(cellIndex + 1) - 1, y: gridRowY(0), w: 1, h: GRID.ROW_H * 3 };
      expect(countIn(STRONG, gutter, SHEET.INK), `gutter after column ${cellIndex}`).toBe(0);
    }
    // ...and inside the card.
    expect(GRID_RIGHT_X).toBeLessThanOrEqual(CARD.W - 1);
  });
});

describe('the total block', () => {
  it('sets a real total in brass', () => {
    expect(countIn(STRONG, TOTAL_RECT, SHEET.ACCENT_HI)).toBeGreaterThan(40);
  });

  it('puts NO brass on a card with no total — there is no number to celebrate', () => {
    // The single most important pixel-level assertion on this card. A renderer
    // that collapsed a missing total to a number would light this up.
    expect(countIn(BOMBED, TOTAL_RECT, SHEET.ACCENT_HI)).toBe(0);
    expect(countIn(NOTHING_MADE, TOTAL_RECT, SHEET.ACCENT_HI)).toBe(0);
  });

  it('prints the total itself, and a dash where there is none', () => {
    // WAS `countIn(BOMBED, TOTAL_RECT, SHEET.RULE) > 0`, which the "KG" unit
    // satisfied on its own: deleting the em dash left the test green. Boxed
    // away from the unit and checked on the glyphs, it bites.
    expectTextIn(
      STRONG,
      valueRect(TOTAL_BLOCK.VALUE_RIGHT, TOTAL_BLOCK.VALUE_Y, TOTAL_VALUE_BOTTOM, '755', 3),
      '755',
      TOTAL_BLOCK.VALUE_RIGHT,
      TOTAL_BLOCK.VALUE_Y,
      SHEET.ACCENT_HI,
      { ...TABULAR_RIGHT, scale: 3 },
      'strong total',
    );
    expectTextIn(
      BOMBED,
      valueRect(TOTAL_BLOCK.VALUE_RIGHT, TOTAL_BLOCK.VALUE_Y, TOTAL_VALUE_BOTTOM, NO_VALUE_DISPLAY, 3),
      NO_VALUE_DISPLAY,
      TOTAL_BLOCK.VALUE_RIGHT,
      TOTAL_BLOCK.VALUE_Y,
      SHEET.RULE,
      { ...TABULAR_RIGHT, scale: 3 },
      'bombed total',
    );
  });

  it('draws the dash somewhere the KG unit is not, so one cannot stand in for the other', () => {
    // Pinning the trap the assertion above was rewritten around: if these two
    // rects ever overlap, "the block is not blank" stops proving anything again.
    const dash = valueRect(TOTAL_BLOCK.VALUE_RIGHT, TOTAL_BLOCK.VALUE_Y, TOTAL_VALUE_BOTTOM, NO_VALUE_DISPLAY, 3);
    const unitLeft = TOTAL_BLOCK.LABEL_X + measureText('TOTAL') + TOTAL_BLOCK.UNIT_GAP;
    const unitRight = unitLeft + measureText('KG');
    expect(unitRight).toBeLessThan(dash.x);
    expect(countIn(BOMBED, dash, SHEET.RULE)).toBeGreaterThan(0);
  });

  it('sets the KG unit where TOTAL_BLOCK.UNIT_GAP puts it, in pixels', () => {
    // `UNIT_GAP` used to be a bare `+ 4` in the renderer. The x below is
    // HAND-WRITTEN — 10 of LABEL_X plus 29 of "TOTAL" plus the 4 px gap —
    // rather than recomputed from the constant, because a probe anchored on the
    // value it is checking moves with it and proves nothing. The rect is the
    // whole label band, so a unit that wandered anywhere else in the block
    // still fails. STRONG only: its total is set in brass, so the one thing in
    // this band drawn in SHEET.RULE is the unit.
    expect(TOTAL_BLOCK.LABEL_X).toBe(10);
    expect(measureText('TOTAL')).toBe(29);
    expectTextIn(
      STRONG,
      { ...INSIDE_FRAME, y: TOTAL_BLOCK.LABEL_Y, h: FONT.GLYPH_H },
      'KG',
      43,
      TOTAL_BLOCK.LABEL_Y,
      SHEET.RULE,
      {},
      'total unit',
    );
  });

  it('keeps a four-digit total at full size, which is what LABEL_VALUE_MIN_GAP buys', () => {
    // `LABEL_VALUE_MIN_GAP` used to be a bare `+ 6`. It decides how much room
    // the value has and therefore when it steps DOWN a whole scale — and a
    // three-digit total is small enough that the step never shows, so the old
    // suite could not see the value change at all. 1152.5 at scale 3 is 102 px
    // against the 137 px the gap leaves it; widen the gap and it drops to
    // scale 2, which this spells out in glyphs.
    const grid = renderResultCard(LONG_TOTAL_CARD);
    expect(LONG_TOTAL_CARD.totalKg).toBe(1152.5);
    expectTextIn(
      grid,
      valueRect(TOTAL_BLOCK.VALUE_RIGHT, TOTAL_BLOCK.VALUE_Y, TOTAL_VALUE_BOTTOM, '1152.5', 3),
      '1152.5',
      TOTAL_BLOCK.VALUE_RIGHT,
      TOTAL_BLOCK.VALUE_Y,
      SHEET.ACCENT_HI,
      { ...TABULAR_RIGHT, scale: 3 },
      'four-digit total at scale 3',
    );
  });
});

describe('the place block', () => {
  it('sets the placing it was given, in ink', () => {
    expectTextIn(
      STRONG,
      valueRect(PLACE_VALUE_RIGHT, SCORE_VALUE_Y, SCORE_VALUE_BOTTOM, '1', 2),
      '1',
      PLACE_VALUE_RIGHT,
      SCORE_VALUE_Y,
      SHEET.INK,
      { ...TABULAR_RIGHT, scale: 2 },
      'strong place',
    );
    expect(countIn(STRONG, PLACE_RECT, SHEET.NOLIFT_DARK)).toBe(0);
  });

  it('spells DQ, in red, and never a number', () => {
    // WAS a red-pixel count over the whole block. Printing "12" instead of "DQ"
    // in the same red passed it — i.e. the suite accepted a card that ranked a
    // bombed lifter twelfth, which is the exact thing `resultCard.ts` refuses
    // to build. Now the glyphs are checked.
    for (const [label, grid] of [
      ['bombed', BOMBED],
      ['nothing made', NOTHING_MADE],
    ] as const) {
      expectTextIn(
        grid,
        valueRect(PLACE_VALUE_RIGHT, SCORE_VALUE_Y, SCORE_VALUE_BOTTOM, PLACE_NO_TOTAL_DISPLAY, 2),
        PLACE_NO_TOTAL_DISPLAY,
        PLACE_VALUE_RIGHT,
        SCORE_VALUE_Y,
        SHEET.NOLIFT_DARK,
        { ...TABULAR_RIGHT, scale: 2 },
        `${label} place`,
      );
      // ...and no full-strength ink anywhere in the block, which is what a
      // placing would be set in.
      expect(countIn(grid, PLACE_RECT, SHEET.INK), `${label} place has no ink digits`).toBe(0);
    }
  });

  it('prints the DOTS score itself, and a dash where there is none', () => {
    // WAS `countIn(BOMBED, DOTS_RECT, SHEET.INK_SOFT) > 0`, which the word
    // "DOTS" satisfied on its own: deleting the placeholder left it green.
    expectTextIn(
      STRONG,
      valueRect(DOTS_VALUE_RIGHT, SCORE_VALUE_Y, SCORE_VALUE_BOTTOM, '481.87', 2),
      // Hand-written, not read off the card: DOTS for 755 kg at 92.40 kg on
      // the men's coefficients. A renderer reading the total, the placing or
      // the other sex's score into this block would not spell this.
      '481.87',
      DOTS_VALUE_RIGHT,
      SCORE_VALUE_Y,
      SHEET.INK,
      { ...TABULAR_RIGHT, scale: 2 },
      'strong dots',
    );
    expectTextIn(
      BOMBED,
      valueRect(DOTS_VALUE_RIGHT, SCORE_VALUE_Y, SCORE_VALUE_BOTTOM, NO_VALUE_DISPLAY, 2),
      NO_VALUE_DISPLAY,
      DOTS_VALUE_RIGHT,
      SCORE_VALUE_Y,
      SHEET.INK_SOFT,
      { ...TABULAR_RIGHT, scale: 2 },
      'bombed dots',
    );
    // No full-strength ink at all in the bombed block: a digit would be.
    expect(countIn(BOMBED, DOTS_RECT, SHEET.INK)).toBe(0);
  });
});

describe('the barbell', () => {
  it('loads real competition discs for the heaviest good lift', () => {
    expect(heaviestGoodLift(STRONG_MEET_CARD)).toEqual({ label: 'DEADLIFT', kg: 312.5, text: '312.5' });
    expect(plateCount(STRONG)).toBeGreaterThan(50);
    // 312.5 kg loads five 25s a side: the reds have to be there.
    expect(countIn(STRONG, BARBELL_RECT, PAL.PLATE_RED_LIGHT)).toBeGreaterThan(0);
  });

  it('loads the HEAVIEST lift, not the last one', () => {
    // The stress card squats 440 and deadlifts 400, so "heaviest" and "last"
    // disagree — which is the only way to tell the two rules apart.
    expect(STRESS_MEET_CARD.rows[2].bestKg).toBe(400);
    expect(heaviestGoodLift(STRESS_MEET_CARD)).toEqual({ label: 'SQUAT', kg: 440, text: '440' });
    expect(heaviestGoodLift(BOMBED_MEET_CARD)).toEqual({ label: 'SQUAT', kg: 145, text: '145' });
    expect(plateCount(BOMBED)).toBeGreaterThan(20);
  });

  it('leaves the bar bare when nothing was made', () => {
    expect(heaviestGoodLift(NOTHING_MADE_CARD)).toBeNull();
    expect(plateCount(NOTHING_MADE)).toBe(0);
    // The shaft and collars are still drawn: an empty bar, not an empty space.
    expect(countIn(NOTHING_MADE, BARBELL_RECT, PAL.STEEL_MID)).toBeGreaterThan(50);
  });

  it('draws the same load on both sides of the bar', () => {
    const half = Math.floor(CARD.W / 2);
    const left: Rect = { x: 0, y: BARBELL_RECT.y, w: half, h: BARBELL_RECT.h };
    const right: Rect = { x: half, y: BARBELL_RECT.y, w: CARD.W - half, h: BARBELL_RECT.h };
    for (const index of PLATE_FILLS) {
      expect(countIn(STRONG, left, index), `plate ${index}`).toBe(countIn(STRONG, right, index));
    }
  });
});

// ---------------------------------------------------------------------------
// The barbell caption.
//
// THIS BLOCK EXISTS BECAUSE THERE WAS NOTHING HERE EITHER. "TOP SINGLE",
// "NO LIFTS MADE" and "DEADLIFT 312.5 KG" appeared in `cardTuning.ts`, in
// `renderResultCard.ts` and in a font glyph-coverage test, and in no assertion
// about the card — deleting `drawText(grid, caption, ...)` outright left the
// whole suite green. On a shareable card, the words next to the bar are the
// only thing that says what the bar IS.
// ---------------------------------------------------------------------------

describe('the barbell caption, in pixels', () => {
  it('prints the caption and the lift-and-weight detail on one line', () => {
    // Hand-written, both runs. The caption is set soft to the left margin, the
    // detail in full ink to the right, and the two inks let one probe check
    // each without the other's pixels leaking into the mask.
    expectTextIn(STRONG, CAPTION_RECT, 'TOP SINGLE', CONTENT.X, BARBELL.CAPTION_Y, SHEET.INK_SOFT, {}, 'strong caption');
    expectTextIn(
      STRONG,
      CAPTION_RECT,
      'DEADLIFT  312.5 KG',
      CONTENT.RIGHT,
      BARBELL.CAPTION_Y,
      SHEET.INK,
      { align: 'right' },
      'strong caption detail',
    );
  });

  it('names the HEAVIEST lift in the detail, not the last one', () => {
    // The stress card squats 440 and deadlifts 400, so a detail that read the
    // last row instead of the best would say "DEADLIFT  400 KG" and look fine.
    expectTextIn(STRESS, CAPTION_RECT, 'TOP SINGLE', CONTENT.X, BARBELL.CAPTION_Y, SHEET.INK_SOFT, {}, 'stress caption');
    expectTextIn(
      STRESS,
      CAPTION_RECT,
      'SQUAT  440 KG',
      CONTENT.RIGHT,
      BARBELL.CAPTION_Y,
      SHEET.INK,
      { align: 'right' },
      'stress caption detail',
    );
  });

  it('says NO LIFTS MADE, and nothing else, on a card with no good lift', () => {
    expectTextIn(
      NOTHING_MADE,
      CAPTION_RECT,
      'NO LIFTS MADE',
      CONTENT.X,
      BARBELL.CAPTION_Y,
      SHEET.INK_SOFT,
      {},
      'nothing-made caption',
    );
    // There is no weight to print beside it, so the ink run is absent entirely.
    expect(countIn(NOTHING_MADE, CAPTION_RECT, SHEET.INK)).toBe(0);
  });

  it('keeps the caption line clear of the score blocks above and the discs below', () => {
    // `BARBELL.CAPTION_Y` is a free tuning value WITHIN this band and pinning
    // the number itself would just make the tuning pass edit a test. What is
    // not free is the type landing on a plate: the clearance below is one pixel
    // at today's numbers, so this is where a nudge in the wrong direction
    // surfaces. Measured in pixels off the rendered card, not off the constants.
    expect(BARBELL.CAPTION_Y).toBeGreaterThanOrEqual(SCORE_BLOCKS.Y + SCORE_BLOCKS.H);
    let topmostPlateRow: number = CARD.H;
    for (let y = 0; y < CARD.H; y += 1) {
      for (let x = 0; x < CARD.W; x += 1) {
        if (PLATE_FILLS.includes(STRONG.data[y * CARD.W + x] ?? -1)) {
          topmostPlateRow = Math.min(topmostPlateRow, y);
        }
      }
    }
    expect(topmostPlateRow).toBeLessThan(CARD.H);
    expect(BARBELL.CAPTION_Y + FONT.GLYPH_H, 'the caption sits on a plate').toBeLessThanOrEqual(topmostPlateRow);
  });

  it('still captions a bombed card, which is the one that most needs words', () => {
    // The bombed lifter squatted 145 and bombed the bench: there IS a top
    // single, and the card says so rather than going quiet.
    expectTextIn(BOMBED, CAPTION_RECT, 'TOP SINGLE', CONTENT.X, BARBELL.CAPTION_Y, SHEET.INK_SOFT, {}, 'bombed caption');
    expectTextIn(
      BOMBED,
      CAPTION_RECT,
      'SQUAT  145 KG',
      CONTENT.RIGHT,
      BARBELL.CAPTION_Y,
      SHEET.INK,
      { align: 'right' },
      'bombed caption detail',
    );
  });
});

describe('barbellCaption — the fits / does-not-fit rule', () => {
  // The rule the pixel probes above cannot reach: `BARBELL.CAPTION_MIN_GAP`
  // decides whether the caption is printed at all, and at the card's real width
  // it never fires. Called directly, at widths the card cannot produce, it can
  // be pinned — so a tuning pass that changes the gap changes a test.

  it('builds both runs from the card', () => {
    expect(barbellCaption(STRONG_MEET_CARD, CONTENT.W)).toEqual({
      caption: 'TOP SINGLE',
      detail: 'DEADLIFT  312.5 KG',
      captionFits: true,
    });
    expect(barbellCaption(NOTHING_MADE_CARD, CONTENT.W)).toEqual({
      caption: 'NO LIFTS MADE',
      detail: '',
      captionFits: true,
    });
  });

  it('separates the lift from the weight with the tuned separator', () => {
    // A one-space separator reads as a kerning accident at this font's 3px
    // space advance, so the two spaces are a decision and live in cardTuning.
    expect(CARD_LABELS.BARBELL_DETAIL_SEPARATOR).toBe('  ');
    expect(barbellCaption(STRONG_MEET_CARD, CONTENT.W).detail).toBe(
      `DEADLIFT${CARD_LABELS.BARBELL_DETAIL_SEPARATOR}312.5 ${CARD_LABELS.UNIT}`,
    );
  });

  it('drops the caption — and only the caption — exactly at the tuned gap', () => {
    const { caption, detail } = barbellCaption(STRONG_MEET_CARD, CONTENT.W);
    // HAND-WRITTEN BOUNDARY, not one derived from the constant under test.
    // Deriving it — `together + BARBELL.CAPTION_MIN_GAP` — reads correct and is
    // blind: the boundary moves with the constant and the assertion follows it,
    // so doubling the gap survived. 54 px of "TOP SINGLE" plus 91 px of
    // "DEADLIFT  312.5 KG" plus the 8 px gap is 153.
    expect(measureText(caption)).toBe(54);
    expect(measureText(detail)).toBe(91);
    expect(barbellCaption(STRONG_MEET_CARD, 153).captionFits).toBe(true);
    expect(barbellCaption(STRONG_MEET_CARD, 152).captionFits).toBe(false);
    // The detail never goes: it carries the number, the caption only labels it.
    expect(barbellCaption(STRONG_MEET_CARD, 0).detail).toBe(detail);
    expect(barbellCaption(STRONG_MEET_CARD, 0).caption).toBe(caption);
  });

  it('never drops a caption that has no detail beside it to collide with', () => {
    // "NO LIFTS MADE" is the whole message on a card with nothing made; a bare
    // bar with no words at all would read as a rendering failure.
    for (const width of [CONTENT.W, 40, 1, 0]) {
      expect(barbellCaption(NOTHING_MADE_CARD, width).captionFits, `at ${width}px`).toBe(true);
    }
  });

  it('is not reachable at the card’s own width, on any card the engine can build', () => {
    // Pinning `BARBELL.CAPTION_MIN_GAP`'s docstring claim. The widest detail the
    // card can produce is a four-digit deadlift; if a tuning pass narrows the
    // card or lengthens the caption, this is where it surfaces.
    for (const card of [STRONG_MEET_CARD, BOMBED_MEET_CARD, STRESS_MEET_CARD, NOTHING_MADE_CARD]) {
      expect(barbellCaption(card, CONTENT.W).captionFits, card.lifter.name).toBe(true);
    }
    const widest = measureText('TOP SINGLE') + measureText('DEADLIFT  9999.5 KG') + BARBELL.CAPTION_MIN_GAP;
    expect(widest).toBeLessThanOrEqual(CONTENT.W);
  });
});

describe('fitScale', () => {
  it('drops a whole step rather than condensing type', () => {
    // "Marcus Vale" fits at 2; a much longer name must come down to 1 rather
    // than being squeezed to 1.6.
    expect(fitScale('Marcus Vale', CONTENT.W, 2)).toBe(2);
    expect(fitScale('A Preposterously Long Lifter Name', CONTENT.W, 2)).toBe(1);
    expect(Number.isInteger(fitScale('Dana Whitmore', CONTENT.W, 3))).toBe(true);
  });

  it('never returns a scale whose text overruns the width it was given', () => {
    for (const text of ['755', '1042.5', 'Irongate', 'A Very Long Federation Name Indeed']) {
      for (const width of [40, 80, CONTENT.W]) {
        const scale = fitScale(text, width, 3);
        // Scale 1 is the floor: below that there is nothing to drop to, so an
        // over-long string is allowed to overrun rather than vanish.
        if (scale > 1) expect(measureText(text) * scale, `${text} @ ${width}`).toBeLessThanOrEqual(width);
      }
    }
  });

  it('never returns less than 1', () => {
    expect(fitScale('anything', 1, 3)).toBe(1);
    expect(fitScale('', 100, 3)).toBe(1);
  });
});

describe('shortening rather than truncating', () => {
  it('takes the first candidate that fits', () => {
    expect(firstThatFits(['LONGEST OF THEM ALL', 'MIDDLING', 'SHORT'], 200)).toBe('LONGEST OF THEM ALL');
    expect(firstThatFits(['LONGEST OF THEM ALL', 'MIDDLING', 'SHORT'], measureText('MIDDLING'))).toBe('MIDDLING');
  });

  it('falls back to the last candidate rather than to nothing', () => {
    // A line that overruns is recoverable by tuning; a line that silently
    // vanished is a fact the card dropped.
    expect(firstThatFits(['AAAA', 'BB'], 1)).toBe('BB');
    expect(firstThatFits([], 100)).toBe('');
  });

  it('never truncates: every candidate it can return is one it was given', () => {
    const candidates = ['ALPHA BRAVO CHARLIE', 'ALPHA BRAVO', 'ALPHA'];
    for (const width of [0, 10, 40, 80, 400]) {
      expect(candidates).toContain(firstThatFits(candidates, width));
    }
  });

  it('keeps a short lifter’s full meta line on ONE line and reflows a long one', () => {
    const full = lifterStrip(STRONG_MEET_CARD, CONTENT.W);
    expect(full.metaLines).toEqual(["MEN'S RAW OPEN 93 · 92.40 KG"]);
    expect(measureText(full.metaLines[0] ?? '')).toBeLessThanOrEqual(CONTENT.W);
    // The stress lifter's card cannot hold all of it on one line, so it takes
    // two — it does not shorten, and it certainly does not truncate.
    const tight = lifterStrip(STRESS_MEET_CARD, CONTENT.W);
    expect(tight.metaLines).toEqual(["MEN'S SINGLE-PLY MASTERS 1 120+", '139.40 KG']);
    for (const line of tight.metaLines) expect(measureText(line)).toBeLessThanOrEqual(CONTENT.W);
  });

  it('always keeps the sex, the class and the bodyweight, however tight it gets', () => {
    // Sex, class and bodyweight are the three facts a reader needs to check the
    // DOTS score the card publishes two blocks further down. Everything else on
    // the strip is context; the ladder may spend context and may never spend
    // these. At width 0 the ladder has run out and falls back to its last rung,
    // which still has to carry all three.
    for (const width of [CONTENT.W, 120, 80, 40, 0]) {
      const text = stripText(STRESS_MEET_CARD, width);
      expect(text, `at ${width}px`).toContain(SEX_CATEGORY_WORD.male);
      expect(text, `at ${width}px`).toContain('120+');
      expect(text, `at ${width}px`).toContain('139.40');
    }
    for (const width of [CONTENT.W, 120, 80, 40, 0]) {
      const text = stripText(BOMBED_MEET_CARD, width);
      expect(text, `at ${width}px`).toContain(SEX_CATEGORY_WORD.female);
      expect(text, `at ${width}px`).toContain('69');
      expect(text, `at ${width}px`).toContain('68.20');
    }
  });

  it('has no rung, at any width, on any card, that omits the sex or the bodyweight', () => {
    // The ladder is data, so walk all of it rather than sampling widths: every
    // rung of every card must name the lifter's sex and print their bodyweight
    // somewhere. `LifterCategoryPart` has no 'sex' member and no rung flag
    // removes a bodyweight — this is checking the types kept those promises.
    const bodyweights = [
      { card: STRONG_MEET_CARD, text: '92.40' },
      { card: BOMBED_MEET_CARD, text: '68.20' },
      { card: STRESS_MEET_CARD, text: '139.40' },
    ] as const;
    for (const { card, text } of bodyweights) {
      const word = SEX_CATEGORY_WORD[card.lifter.sex];
      LIFTER_META_LADDER.forEach((rung, i) => {
        const joined = lifterMetaLinesAtRung(card, rung).join(' ');
        expect(joined, `${card.lifter.name} rung ${i} sex`).toContain(word);
        expect(joined, `${card.lifter.name} rung ${i} bodyweight`).toContain(text);
      });
    }
  });

  it('walks the whole ladder as the width shrinks, and never past its end', () => {
    const widths = [CONTENT.W, 140, 110, 90, 0];
    const strips = widths.map((width) => lifterStrip(STRESS_MEET_CARD, width));
    const widest = (strip: { readonly metaLines: readonly string[] }): number =>
      Math.max(...strip.metaLines.map((line) => measureText(line)));
    for (let i = 1; i < strips.length; i += 1) {
      const strip = strips[i];
      const previous = strips[i - 1];
      if (strip === undefined || previous === undefined) throw new Error('missing strip');
      expect(widest(strip), `${widths[i]}px`).toBeLessThanOrEqual(widest(previous));
    }
    expect(new Set(strips.map((strip) => strip.metaLines.join('|'))).size).toBeGreaterThan(1);
    expect(LIFTER_META_LADDER.length).toBeGreaterThan(1);
  });

  it('takes a second line before it spends a fact, and says so out loud', () => {
    // The order of preference IS the design call this whole piece turns on, so
    // pin the whole ladder shape with hand-written literals: changing it has to
    // be a deliberate edit to `cardTuning.ts` and not a drift. Read down the
    // columns — the first two rungs shorten wording, the next two reflow onto a
    // second line, and only the last two spend a fact.
    expect(LIFTER_META_LADDER.map((rung) => [...rung.category])).toEqual([
      ['equipment', 'division'],
      ['equipment', 'division'],
      ['equipment', 'division'],
      ['equipment'],
      ['equipment'],
      [],
    ]);
    expect(LIFTER_META_LADDER.map((rung) => rung.bodyweightOnOwnLine)).toEqual([
      false,
      false,
      true,
      true,
      true,
      true,
    ]);
    expect(LIFTER_META_LADDER.map((rung) => rung.divisionOnSecondLine)).toEqual([
      false,
      false,
      false,
      true,
      false,
      false,
    ]);
    expect(LIFTER_META_LADDER.map((rung) => rung.bodyweightUnit)).toEqual([
      true,
      false,
      true,
      true,
      true,
      true,
    ]);
    // ...and when it does spend one, the division still goes before the
    // equipment, because raw-vs-equipped is never implied by the meet. That
    // order only applies to a card with no placing on it — see the placing
    // block above for why, and for the filter that enforces it.
    expect(LIFTER_META_LADDER.map(rungNamesDivision)).toEqual([true, true, true, true, false, false]);
    expect(LIFTER_META_LADDER.map((rung) => rung.category.includes('equipment'))).toEqual([
      true,
      true,
      true,
      true,
      true,
      false,
    ]);
  });

  it('sets the second line where cardTuning says, and one line where it says that', () => {
    // `lifterMetaLineY` and `lifterNameY` are the indirections the renderer
    // draws through; the pixel probes anchor on `LIFTER_STRIP.*` directly, so
    // this is what stops the two drifting apart. Hand-written line counts.
    expect(lifterMetaLineY(1, 0)).toBe(LIFTER_STRIP.META_Y);
    expect(lifterMetaLineY(2, 0)).toBe(LIFTER_STRIP.META_Y_TWO_LINE[0]);
    expect(lifterMetaLineY(2, 1)).toBe(LIFTER_STRIP.META_Y_TWO_LINE[1]);
    expect(lifterNameY(1)).toBe(LIFTER_STRIP.NAME_Y);
    expect(lifterNameY(2)).toBe(LIFTER_STRIP.NAME_Y_COMPACT);
    // The two-line positions are inside the strip and in order.
    expect(LIFTER_STRIP.META_Y_TWO_LINE[0]).toBeLessThan(LIFTER_STRIP.META_Y_TWO_LINE[1]);
    expect(LIFTER_STRIP.META_Y_TWO_LINE[1] + FONT.CAP_H).toBeLessThanOrEqual(
      LIFTER_STRIP.Y + LIFTER_STRIP.H - 1,
    );
    // Each line clears the descenders of the one above it: the name's, then
    // the first meta line's. `FONT.GLYPH_H` is the cell, descenders included.
    expect(LIFTER_STRIP.META_Y_TWO_LINE[0]).toBeGreaterThanOrEqual(
      LIFTER_STRIP.NAME_Y_COMPACT + FONT.GLYPH_H,
    );
    expect(LIFTER_STRIP.META_Y_TWO_LINE[1]).toBeGreaterThanOrEqual(
      LIFTER_STRIP.META_Y_TWO_LINE[0] + FONT.CAP_H,
    );
    // The compact name starts inside the strip, not on the masthead's band.
    expect(LIFTER_STRIP.NAME_Y_COMPACT).toBeGreaterThan(LIFTER_STRIP.Y);
  });
});

describe('fitSleeve', () => {
  const room = BARBELL.HALF_SPAN - BARBELL.SHAFT_HALF - BARBELL.COLLAR_W;

  it('uses the authored pitch when the sleeve is not crowded', () => {
    const stack = visualPlateStack(145).perSide;
    const fit = fitSleeve(stack);
    expect(fit.pitch).toBe(BARBELL.PLATE_PITCH);
    expect(fit.discs).toHaveLength(stack.length);
  });

  it('compresses before it drops a disc', () => {
    const stack = visualPlateStack(440).perSide;
    expect(stack.length * BARBELL.PLATE_PITCH).toBeGreaterThan(room);
    const fit = fitSleeve(stack);
    expect(fit.pitch).toBeLessThan(BARBELL.PLATE_PITCH);
    expect(fit.discs).toHaveLength(stack.length);
  });

  it('always leaves a gap between discs, so a stack stays countable', () => {
    for (const kg of [100, 200, 300, 440, 600, 900]) {
      const fit = fitSleeve(visualPlateStack(kg).perSide);
      expect(fit.face, `${kg} kg`).toBeLessThan(fit.pitch);
      expect(fit.face).toBeGreaterThanOrEqual(1);
    }
  });

  it('keeps the whole stack inside the sleeve it has', () => {
    for (const kg of [25, 60, 145, 312.5, 440, 900]) {
      const fit = fitSleeve(visualPlateStack(kg).perSide);
      expect(fit.discs.length * fit.pitch, `${kg} kg`).toBeLessThanOrEqual(room);
      expect(fit.discs.length).toBeLessThanOrEqual(BARBELL.MAX_PLATES_PER_SIDE);
    }
  });

  it('loads nothing on a bar with nothing to load', () => {
    expect(fitSleeve([]).discs).toHaveLength(0);
  });
});

describe('a long name and a long total still fit the card', () => {
  it('does not overflow the grid or the total block', () => {
    const long = LONG_TOTAL_CARD;
    expect(long.totalKg).toBe(1152.5);
    expect(long.lifter.weightClassText).toBe('120+');

    const grid = renderResultCard(long);
    expect(findUnallocatedSheetIndices(grid)).toEqual([]);
    // The masthead and the total block must not have spilled onto the rows
    // above or below them.
    expect(countIn(grid, { x: 0, y: TOTAL_BLOCK.Y - 2, w: CARD.W, h: 1 }, SHEET.ACCENT_HI)).toBe(0);
    expect(countIn(grid, { x: 0, y: TOTAL_BLOCK.Y + TOTAL_BLOCK.H, w: CARD.W, h: 1 }, SHEET.ACCENT_HI)).toBe(0);
    // A four-digit total still gets brass.
    expect(countIn(grid, TOTAL_RECT, SHEET.ACCENT_HI)).toBeGreaterThan(40);
  });
});
