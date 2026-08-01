/**
 * cardTuning.ts — every layout number the result card uses, in one place.
 *
 * UNTUNED. CLAUDE.md: "Keep every such value as a named constant in one place.
 * Never scatter them as magic numbers across components." Nothing here has been
 * looked at by a human on a phone yet. The renderer reads this file and holds
 * no geometry of its own, so a tuning pass is edits to this file alone.
 *
 * THE INTERNAL RESOLUTION IS FIXED AND THE SCALE IS AN INTEGER. GDD §7.1:
 * "pick a fixed internal resolution early and use nearest-neighbor scaling
 * throughout. Retrofitting this later is painful." The card is authored at
 * `CARD.W x CARD.H` and only ever upscaled by a whole number, so a source pixel
 * is always exactly N device pixels square. A layout that needs a size between
 * two integer scales letterboxes the smaller one; it does not interpolate.
 *
 * WHY 192 x 240: 4:5, the portrait aspect every social feed crops to without
 * letterboxing, and both axes are multiples of 8 (the SNES tile). At the
 * default upscale of 2 that is 384 x 480 logical px, which fits inside a
 * 390 px-wide phone viewport with a margin — the scale GDD §12.2 says to judge
 * readability at.
 *
 * Vertical layout, top to bottom, all in card px:
 *
 *     0                     frame
 *     1  .. 44   MASTHEAD   federation, meet name, date and place
 *    45  .. 72   LIFTER     name, then class / bodyweight / division / kit
 *    74  ..124   GRID       header row, then squat / bench / deadlift
 *   128  ..157   TOTAL      the hero number
 *   159  ..184   SCORE      DOTS and PLACE, side by side
 *   186  ..224   BARBELL    the heaviest good lift, drawn as a loaded bar
 *   226  ..238   FOOTER     wordmark
 *   239                     frame
 */

/** The card's own pixel grid, and how it reaches the screen. */
export const CARD = {
  W: 192,
  H: 240,
  /** Left and right text margin. */
  MARGIN: 6,
  /** Default integer upscale. 2 -> 384x480 logical px. */
  DEFAULT_UPSCALE: 2,
} as const;

/** Left edge of the content column, and the width available to it. */
export const CONTENT = {
  X: CARD.MARGIN,
  W: CARD.W - 2 * CARD.MARGIN,
  /** One past the right edge — where a right-aligned run ends. */
  RIGHT: CARD.W - CARD.MARGIN,
} as const;

/**
 * The masthead. Federation set large because that is the one line a lifter
 * scans first on a real sheet; meet name and date beneath it at body size.
 */
export const MASTHEAD = {
  Y: 1,
  H: 44,
  FEDERATION_Y: 6,
  FEDERATION_SCALE: 2,
  /** Dropped to 1 automatically when a long federation name will not fit. */
  RULE_Y: 23,
  RULE_INSET: 22,
  MEET_NAME_Y: 27,
  PLACE_DATE_Y: 36,
} as const;

/** The lifter identity strip under the masthead. */
export const LIFTER_STRIP = {
  Y: 45,
  H: 28,
  NAME_Y: 48,
  NAME_SCALE: 2,
  META_Y: 63,
  /** Separator between the fields on the meta line. */
  META_SEPARATOR: ' · ',
} as const;

/**
 * The attempt grid. One row per lift, one column per attempt, plus a best
 * column — the same information as the long single-line form in
 * `RESULT_SHEET_COLUMNS`, transposed so it fits a portrait card.
 */
export const GRID = {
  HEADER_Y: 74,
  HEADER_H: 10,
  HEADER_TEXT_Y: 76,
  /** 1px rule between the header row and the first lift. */
  RULE_Y: 84,
  /** Top of the squat row; each lift row is `ROW_H` below the last. */
  FIRST_ROW_Y: 85,
  ROW_H: 13,
  /** Baseline-ish offset of a cell's type inside its row. */
  ROW_TEXT_DY: 3,
  /**
   * The grid runs wider than the text margin. A table on a printed sheet
   * bleeds closer to the trim than body copy does, and the two extra pixels per
   * column are what stop a five-character weight like "312.5" touching its own
   * cell rule.
   */
  X: 4,
  /** Left column, holding SQUAT / BENCH / DEADLIFT. */
  LABEL_X: 6,
  LABEL_W: 48,
  /** Four equal columns: attempt 1, 2, 3, best. */
  CELL_W: 34,
  CELL_COUNT: 4,
  /** Inset of an attempt cell's coloured fill inside its column. */
  CELL_INSET_X: 1,
  CELL_INSET_Y: 1,
  /** Right padding for the tabular figure inside a cell. */
  CELL_TEXT_PAD: 3,
  /** Extra px the strike-through overhangs the number on each side. */
  STRIKE_OVERHANG: 1,
  STRIKE_THICKNESS: 1,
} as const;

/** X of the left edge of attempt column `i` (0..3, the last being BEST). */
export function gridCellX(index: number): number {
  return GRID.X + GRID.LABEL_W + index * GRID.CELL_W;
}

/** One past the right edge of the last column. */
export const GRID_RIGHT_X = GRID.X + GRID.LABEL_W + GRID.CELL_COUNT * GRID.CELL_W;

/** Y of the top of lift row `i` (0 squat, 1 bench, 2 deadlift). */
export function gridRowY(index: number): number {
  return GRID.FIRST_ROW_Y + index * GRID.ROW_H;
}

/** One past the bottom of the last lift row — where the closing rule goes. */
export const GRID_BOTTOM_Y = GRID.FIRST_ROW_Y + 3 * GRID.ROW_H;

/**
 * The total. Set on the dark band and in brass, because it is the number the
 * card exists to show and the only one a lifter screenshots for.
 */
export const TOTAL_BLOCK = {
  Y: 128,
  H: 30,
  LABEL_X: CONTENT.X + 4,
  LABEL_Y: 138,
  VALUE_RIGHT: CONTENT.RIGHT - 4,
  VALUE_Y: 133,
  VALUE_SCALE: 3,
  /** Dropped a step at a time until the value fits the block. */
  VALUE_MIN_SCALE: 1,
} as const;

/** DOTS and PLACE, side by side under the total. */
export const SCORE_BLOCKS = {
  Y: 159,
  H: 26,
  /** Gap between the two blocks. */
  GAP: 4,
  LABEL_DX: 4,
  LABEL_DY: 3,
  VALUE_DY: 11,
  VALUE_SCALE: 2,
  VALUE_PAD_RIGHT: 4,
} as const;

/** Width of one of the two score blocks. */
export const SCORE_BLOCK_W = Math.floor((CONTENT.W - SCORE_BLOCKS.GAP) / 2);

/**
 * The barbell motif: the lifter's heaviest GOOD attempt, loaded from real
 * competition denominations via `src/art/plates.ts`. Plate colours are weight
 * information in this sport (GDD §7.1), so this is a second, wordless reading
 * of the card's best number — and it is drawn from the same module the lift
 * screen loads its bar from, not from a lookalike table.
 *
 * A lifter who made nothing gets a bare bar. That is honest and it is the
 * point: an empty sleeve is what bombing out looks like.
 */
export const BARBELL = {
  CAPTION_Y: 187,
  CENTER_Y: 209,
  /**
   * Multiplier on the true-scale disc diameter from `plateDiameterPx`. At 1.0 a
   * 450 mm disc is ~15 px, which is too small to read a colour off; this lifts
   * the motif to a legible size without changing the sprite system's own scale.
   */
  DIAMETER_SCALE: 1.75,
  /** Half the shaft's drawn length, from the card's centre line. */
  HALF_SPAN: 46,
  /** Half-length of the bare knurled shaft before the first disc. */
  SHAFT_HALF: 10,
  SHAFT_THICKNESS: 3,
  /** Drawn thickness of one disc, and the pitch between two. */
  PLATE_FACE: 3,
  PLATE_PITCH: 4,
  COLLAR_W: 4,
  COLLAR_H: 9,
  /**
   * Discs past this many per side are not drawn. `(HALF_SPAN - SHAFT_HALF -
   * COLLAR_W) / PLATE_PITCH` is what the sleeve physically holds; a bar heavier
   * than that still prints its weight in the caption, which is the number that
   * matters.
   */
  MAX_PLATES_PER_SIDE: 8,
} as const;

/** The wordmark strip along the bottom. */
export const FOOTER = {
  Y: 226,
  H: 13,
  TEXT_Y: 229,
  /**
   * The card is the organic-growth lever (GDD §6.5), so it carries the app's
   * name. Not a federation's — GDD §11 leaves real-federation licensing open,
   * and this card ships no real federation's marks.
   */
  WORDMARK: 'THREE WHITE LIGHTS',
} as const;

/** Fixed strings the card prints that are not lifter or meet data. */
export const CARD_LABELS = {
  BODYWEIGHT_SUFFIX: ' KG',
  CLASS_PREFIX: 'CLASS ',
  /** Lifters' own word for a one-rep best; short enough to share the line. */
  BARBELL_CAPTION: 'TOP SINGLE',
  BARBELL_CAPTION_NONE: 'NO LIFTS MADE',
  UNIT: 'KG',
} as const;
