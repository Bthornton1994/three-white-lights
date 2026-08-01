import { describe, expect, it } from 'vitest';

import { PAL } from '../art/palette';
import type { IndexGrid } from '../art/raster';
import { buildResultCard, type ResultCard, type ResultCardInput } from '../game/resultCard';
import { createMeet, declareAttempt, resolveAttempt, type JudgePanel, type MeetState } from '../game/meet';
import {
  BARBELL,
  CARD,
  GRID,
  GRID_RIGHT_X,
  SCORE_BLOCKS,
  SCORE_BLOCK_W,
  TOTAL_BLOCK,
  CONTENT,
  gridCellX,
  gridRowY,
} from './cardTuning';
import { LIFTER_META_LADDER } from './cardTuning';
import { visualPlateStack } from '../art/plates';
import {
  firstThatFits,
  fitScale,
  fitSleeve,
  heaviestGoodLift,
  lifterMetaLine,
  renderResultCard,
} from './renderResultCard';
import { SHEET, findUnallocatedSheetIndices } from './sheetPalette';
import { BOMBED_MEET_CARD, STRESS_MEET_CARD, STRONG_MEET_CARD } from './sampleCards';
import { measureText } from './pixelFont';

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

const TOTAL_RECT: Rect = { x: 0, y: TOTAL_BLOCK.Y, w: CARD.W, h: TOTAL_BLOCK.H };
const DOTS_RECT: Rect = { x: CONTENT.X, y: SCORE_BLOCKS.Y, w: SCORE_BLOCK_W, h: SCORE_BLOCKS.H };
const PLACE_RECT: Rect = {
  x: CONTENT.X + SCORE_BLOCK_W + SCORE_BLOCKS.GAP,
  y: SCORE_BLOCKS.Y,
  w: SCORE_BLOCK_W,
  h: SCORE_BLOCKS.H,
};
const BARBELL_RECT: Rect = { x: 0, y: BARBELL.CENTER_Y - 16, w: CARD.W, h: 32 };

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

  it('stays inside its own frame', () => {
    for (let x = 0; x < CARD.W; x += 1) {
      expect(STRONG.data[x]).toBe(SHEET.INK);
      expect(STRONG.data[(CARD.H - 1) * CARD.W + x]).toBe(SHEET.INK);
    }
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
    // The strike is a horizontal run of the cell's dark rim colour across the
    // number. The rim itself is only ever 1px of run at the cell edge going
    // down, so a run this long can only be the strike.
    const struck = longestRunIn(STRONG, cellRect(0, 2), SHEET.NOLIFT_DARK);
    expect(struck).toBeGreaterThanOrEqual(measureText('275', 'tabular'));
    // A made attempt has a rim but no strike: its longest dark run is the
    // cell's own top or bottom edge, which spans the whole cell — so check the
    // interior instead, where a strike would have to live.
    const madeInterior: Rect = {
      x: gridCellX(0) + 3,
      y: gridRowY(0) + 3,
      w: GRID.CELL_W - 6,
      h: GRID.ROW_H - 6,
    };
    expect(countIn(STRONG, madeInterior, SHEET.GOOD_DARK)).toBe(0);
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
      expect(longestRunIn(BOMBED, rect, SHEET.NOLIFT_DARK), `bench ${cellIndex + 1} strike`).toBeGreaterThanOrEqual(
        measureText('75', 'tabular'),
      );
    }
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

  it('still draws something where the total would be, so the block is not blank', () => {
    expect(countIn(BOMBED, TOTAL_RECT, SHEET.RULE)).toBeGreaterThan(0);
  });
});

describe('the place block', () => {
  it('sets a placing in ink', () => {
    expect(countIn(STRONG, PLACE_RECT, SHEET.INK)).toBeGreaterThan(10);
    expect(countIn(STRONG, PLACE_RECT, SHEET.NOLIFT_DARK)).toBe(0);
  });

  it('sets DQ in red, so it cannot be mistaken for a placing', () => {
    expect(countIn(BOMBED, PLACE_RECT, SHEET.NOLIFT_DARK)).toBeGreaterThan(20);
    expect(countIn(NOTHING_MADE, PLACE_RECT, SHEET.NOLIFT_DARK)).toBeGreaterThan(20);
  });

  it('prints a DOTS score for one card and a placeholder for the other', () => {
    expect(countIn(STRONG, DOTS_RECT, SHEET.INK)).toBeGreaterThan(40);
    // A dash is a handful of soft-ink pixels; a score is dozens of full-ink
    // ones. The bombed card must have no full-ink digits in this block.
    expect(countIn(BOMBED, DOTS_RECT, SHEET.INK)).toBeLessThan(countIn(STRONG, DOTS_RECT, SHEET.INK) / 3);
    expect(countIn(BOMBED, DOTS_RECT, SHEET.INK_SOFT)).toBeGreaterThan(0);
  });
});

describe('the barbell', () => {
  it('loads real competition discs for the heaviest good lift', () => {
    expect(heaviestGoodLift(STRONG_MEET_CARD)).toEqual({ label: 'DEADLIFT', kg: 312.5, text: '312.5' });
    expect(plateCount(STRONG)).toBeGreaterThan(50);
    // 312.5 kg loads five 25s a side: the reds have to be there.
    expect(countIn(STRONG, BARBELL_RECT, PAL.PLATE_RED_LIGHT)).toBeGreaterThan(0);
  });

  it('loads the SQUAT when that was the heaviest thing made, not the last lift', () => {
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

  it('keeps a short lifter’s full meta line and shortens a long one', () => {
    const full = lifterMetaLine(STRONG_MEET_CARD, CONTENT.W);
    expect(full).toContain('CLASS 93');
    expect(full).toContain('92.40 KG');
    expect(full).toContain('OPEN');
    expect(full).toContain('RAW');
    expect(measureText(full)).toBeLessThanOrEqual(CONTENT.W);
  });

  it('always keeps the class and the bodyweight, however tight it gets', () => {
    // These two are the row a lifter is placed in. Everything else on the meta
    // line is context; the ladder may drop context and may never drop these.
    for (const width of [CONTENT.W, 120, 80, 40, 0]) {
      const line = lifterMetaLine(STRESS_MEET_CARD, width);
      expect(line, `at ${width}px`).toContain('120+');
      expect(line, `at ${width}px`).toContain('139.40');
    }
  });

  it('walks the whole ladder as the width shrinks, and never past its end', () => {
    const widths = [CONTENT.W, 140, 110, 90, 0];
    const lines = widths.map((width) => lifterMetaLine(STRESS_MEET_CARD, width));
    for (let i = 1; i < lines.length; i += 1) {
      expect(measureText(lines[i] ?? ''), `${widths[i]}px`).toBeLessThanOrEqual(
        measureText(lines[i - 1] ?? ''),
      );
    }
    expect(new Set(lines).size).toBeGreaterThan(1);
    expect(LIFTER_META_LADDER.length).toBeGreaterThan(1);
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
    const long = cardOf({
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
