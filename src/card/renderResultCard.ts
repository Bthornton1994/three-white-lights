/**
 * renderResultCard.ts — a `ResultCard` drawn onto an index grid.
 *
 * PURE. No React, no Skia, no I/O. In, a card built by
 * `src/game/resultCard.ts`; out, an `IndexGrid` of palette indices, exactly
 * like `renderLifterFrame` in `src/art/lifterSprite.ts`. `ResultCardView.tsx` is
 * the only file that turns one into pixels on a screen, and `tools/shoot.mjs`
 * is what proves it does.
 *
 * WHAT THIS FILE IS ALLOWED TO DECIDE: where a thing goes. It reads every
 * coordinate from `cardTuning.ts` and every colour from `sheetPalette.ts`. It
 * decides NOTHING about what the card says — every string, every mark and every
 * rounding is already fixed by `resultCard.ts`, so a critic checking a
 * convention checks that module and not this one.
 *
 * WHAT "READS EVERY NUMBER FROM `cardTuning.ts`" DOES AND DOES NOT CLAIM. This
 * header used to say the file "holds no number of its own", and that was false:
 * a `+ 6` decided when the total lost a step of size, a `+ 8` decided whether
 * the barbell caption was printed at all, a `Math.max(4, ...)` floored a disc,
 * and a two-space separator was typed inline. Every one of those is now a named
 * constant, because CLAUDE.md is explicit that tunable values do not get buried
 * in components. What is left here is arithmetic ON those constants — halving a
 * named thickness to centre it, insetting by one pixel from a named width,
 * flooring a scale at 1 because there is nothing below it — and that is
 * structure, not tuning. If you find yourself wanting to try a different value
 * for something, it belongs in `cardTuning.ts` and not here.
 *
 * It draws the barbell from `src/art/plates.ts` and `src/art/raster.ts`'s
 * `drawPlateEdge`, in the EQUIPMENT bank — the same denominations, the same
 * colours and the same disc primitive the lift screen loads its bar from. That
 * is the reuse GDD §7.1's "one game" pass is looking for: a lifter reading
 * plate colours off this card is reading the same language the gameplay speaks.
 */

import {
  ATTEMPT_GRID_HEADINGS,
  NO_VALUE_DISPLAY,
  PLACE_NO_TOTAL_DISPLAY,
  divisionCategoryWord,
  lifterCategoryText,
  type AttemptCell,
  type LiftRow,
  type ResultCard,
} from '../game/resultCard';
import { PAL, RAMPS } from '../art/palette';
import { createGrid, drawPlateEdge, fillRect, setPx, type IndexGrid } from '../art/raster';
import { PLATE_HUE_RAMPS, plateDiameterPx, visualPlateStack, type LoadedPlate } from '../art/plates';
import { SHEET } from './sheetPalette';
import {
  BARBELL,
  CARD,
  CARD_CENTER_X,
  CARD_LABELS,
  CONTENT,
  FOOTER,
  GRID,
  GRID_BOTTOM_Y,
  LIFTER_STRIP,
  MASTHEAD,
  SCORE_BLOCKS,
  SCORE_BLOCK_W,
  TOTAL_BLOCK,
  gridCellCenterX,
  gridCellX,
  gridRowY,
  lifterMetaLineY,
  lifterMetaRungs,
  type LifterMetaRung,
} from './cardTuning';
import { capHeight, drawText, measureText, strikeThrough, type TextMode } from './pixelFont';

const CENTER_X = CARD_CENTER_X;

// ---------------------------------------------------------------------------
// Small drawing helpers. Each one is a rectangle or a run of type; nothing here
// computes a layout, because layout is `cardTuning.ts`'s job.
// ---------------------------------------------------------------------------

function strokeRect(grid: IndexGrid, x: number, y: number, w: number, h: number, index: number): void {
  for (let dx = 0; dx < w; dx += 1) {
    setPx(grid, x + dx, y, index);
    setPx(grid, x + dx, y + h - 1, index);
  }
  for (let dy = 0; dy < h; dy += 1) {
    setPx(grid, x, y + dy, index);
    setPx(grid, x + w - 1, y + dy, index);
  }
}

function rule(grid: IndexGrid, x: number, y: number, w: number, index: number): void {
  fillRect(grid, x, y, w, 1, index);
}

/**
 * The largest whole scale at which `text` still fits `maxWidth`.
 *
 * The alternative — squeezing type by a fraction — is the thing GDD §7.1's
 * nearest-neighbour rule forbids, so a long federation name or a four-digit
 * total steps DOWN a whole scale rather than being condensed.
 */
export function fitScale(text: string, maxWidth: number, maxScale: number, mode: TextMode = 'proportional'): number {
  const width = measureText(text, mode);
  if (width <= 0) return 1;
  for (let scale = Math.max(1, Math.round(maxScale)); scale > 1; scale -= 1) {
    if (width * scale <= maxWidth) return scale;
  }
  return 1;
}

/** Grey for a placeholder, full ink for a real value. */
function inkFor(text: string): number {
  return text === NO_VALUE_DISPLAY ? SHEET.INK_SOFT : SHEET.INK;
}

/**
 * The first candidate that fits `maxWidth`, or the last one if none do.
 *
 * EVERY CANDIDATE IS A TRUE, SHORTER STATEMENT — there is no truncation and no
 * ellipsis anywhere on this card. A results sheet that ends mid-word has
 * stopped being believable, which is the whole bar this piece is held to.
 * Falling back to the last candidate rather than to nothing is deliberate: a
 * line that overruns by a pixel is recoverable by tuning, a line that vanished
 * is a fact the card silently dropped.
 */
export function firstThatFits(candidates: readonly string[], maxWidth: number): string {
  for (const candidate of candidates) {
    if (measureText(candidate) <= maxWidth) return candidate;
  }
  return candidates[candidates.length - 1] ?? '';
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function drawMasthead(grid: IndexGrid, card: ResultCard): void {
  fillRect(grid, 0, MASTHEAD.Y, CARD.W, MASTHEAD.H, SHEET.BAND_DARK);

  const federationScale = fitScale(card.meet.federation, CONTENT.W, MASTHEAD.FEDERATION_SCALE);
  drawText(
    grid,
    card.meet.federation,
    CENTER_X,
    MASTHEAD.FEDERATION_BASELINE - capHeight(federationScale),
    SHEET.BAND_INK,
    { align: 'center', scale: federationScale },
  );

  rule(
    grid,
    CARD.MARGIN + MASTHEAD.RULE_INSET,
    MASTHEAD.RULE_Y,
    CONTENT.W - 2 * MASTHEAD.RULE_INSET,
    SHEET.BAND_MID,
  );

  drawText(grid, card.meet.name, CENTER_X, MASTHEAD.MEET_NAME_Y, SHEET.BAND_INK, { align: 'center' });

  // Date to the left margin, place to the right, the way a letterheaded sheet
  // sets them — which also buys the whole content width instead of spending
  // some of it on a separator. Falls back to a shorter TRUE place and then to
  // the date alone; nothing is ever truncated. See `firstThatFits`.
  const date = card.meet.dateText;
  const room = CONTENT.W - measureText(date) - MASTHEAD.DATE_PLACE_MIN_GAP;
  const place = firstThatFits([card.meet.locationText, card.meet.locationShortText, ''], room);
  if (place === '') {
    drawText(grid, date, CENTER_X, MASTHEAD.PLACE_DATE_Y, SHEET.RULE, { align: 'center' });
    return;
  }
  drawText(grid, date, CONTENT.X, MASTHEAD.PLACE_DATE_Y, SHEET.RULE);
  drawText(grid, place, CONTENT.RIGHT, MASTHEAD.PLACE_DATE_Y, SHEET.RULE, { align: 'right' });
}

function drawLifterStrip(grid: IndexGrid, card: ResultCard): void {
  fillRect(grid, 0, LIFTER_STRIP.Y, CARD.W, LIFTER_STRIP.H, SHEET.PAPER_ALT);
  rule(grid, 0, LIFTER_STRIP.Y + LIFTER_STRIP.H - 1, CARD.W, SHEET.RULE);

  const strip = lifterStrip(card, CONTENT.W);
  drawText(grid, card.lifter.name, CONTENT.X, LIFTER_STRIP.NAME_Y, SHEET.INK, { scale: strip.nameScale });

  strip.metaLines.forEach((line, index) => {
    drawText(grid, line, CONTENT.X, lifterMetaLineY(strip.metaLines.length, index), SHEET.INK_SOFT);
  });
}

/**
 * The meta line — or lines — at one rung of the ladder.
 *
 * Three facts and only three go into them: the category phrase, the division
 * when the rung has moved it out of that phrase, and the bodyweight. The words
 * inside the phrase come from `lifterCategoryText`, which is where the SEX is
 * welded on; this function has no way to build a strip without it, because the
 * rung can only ask about `equipment` and `division`. It has no way to build
 * one without the BODYWEIGHT either: `bodyweightOnOwnLine` picks the line, not
 * whether there is one.
 *
 * A rung that moved the division down is the difference between MOVING a fact
 * and SPENDING one — see `LIFTER_META_LADDER`. The division is upper-cased by
 * `divisionCategoryWord` in `src/game/resultCard.ts` and not here, so the word
 * on the second line is the same word the phrase would have used.
 */
export function lifterMetaLinesAtRung(card: ResultCard, rung: LifterMetaRung): readonly string[] {
  const keepsDivision = rung.category.includes('division');
  const category = lifterCategoryText(card.lifter, {
    equipment: rung.category.includes('equipment'),
    division: keepsDivision,
  });
  const bodyweight = rung.bodyweightUnit
    ? `${card.lifter.bodyweightText}${CARD_LABELS.BODYWEIGHT_SUFFIX}`
    : card.lifter.bodyweightText;
  // Guarded so a rung that both keeps the division and moves it cannot print
  // it twice.
  const movedDivision =
    rung.divisionOnSecondLine && !keepsDivision ? divisionCategoryWord(card.lifter) : '';

  const first = [category, rung.bodyweightOnOwnLine ? '' : bodyweight];
  const second = [movedDivision, rung.bodyweightOnOwnLine ? bodyweight : ''];
  return [first, second]
    .map((parts) => parts.filter((part) => part.trim() !== '').join(LIFTER_STRIP.META_SEPARATOR))
    .filter((line) => line !== '');
}

/** How the identity strip is set on one card: the name's size and its lines. */
export interface LifterStrip {
  /** Which rung of `LIFTER_META_LADDER` produced it. */
  readonly rung: LifterMetaRung;
  /** The whole scale the lifter's name is set at. */
  readonly nameScale: number;
  /** One or two lines, in the order they are printed. */
  readonly metaLines: readonly string[];
}

/**
 * The identity strip: as much of the lifter's category as fits, and the size
 * the name has to be set at to make room for it.
 *
 * Walks `lifterMetaRungs(card.placed)` and takes the first rung whose EVERY
 * line fits `maxWidth` — the same "first that fits, never a truncation" rule as
 * `firstThatFits`, over a rung rather than a string. A rung that needs two
 * lines caps the name at `LIFTER_STRIP.NAME_SCALE_COMPACT`, which is where the
 * second line comes from: the strip's height is unchanged, so the grid below it
 * does not move.
 *
 * Exported so a test can check the ladder rather than the pixels it produces.
 */
export function lifterStrip(card: ResultCard, maxWidth: number): LifterStrip {
  const rungs = lifterMetaRungs(card.placed);
  const candidates = rungs.map((rung) => ({ rung, metaLines: lifterMetaLinesAtRung(card, rung) }));
  const chosen =
    candidates.find(({ metaLines }) => metaLines.every((line) => measureText(line) <= maxWidth)) ??
    candidates[candidates.length - 1];
  if (chosen === undefined) {
    // Unreachable: `LIFTER_META_LADDER` is non-empty and its first rung names
    // the division, so neither the ladder nor the placed filter can empty it.
    throw new Error('renderResultCard: the lifter meta ladder has no rungs');
  }
  const maxScale =
    chosen.metaLines.length > 1 ? LIFTER_STRIP.NAME_SCALE_COMPACT : LIFTER_STRIP.NAME_SCALE;
  return {
    rung: chosen.rung,
    metaLines: chosen.metaLines,
    nameScale: fitScale(card.lifter.name, maxWidth, maxScale),
  };
}

function drawAttemptCell(grid: IndexGrid, cell: AttemptCell, x: number, y: number): void {
  if (cell.text === '') return;

  const fill = cell.mark === 'good' ? SHEET.GOOD_LIGHT : SHEET.NOLIFT_LIGHT;
  const rim = cell.mark === 'good' ? SHEET.GOOD_DARK : SHEET.NOLIFT_DARK;
  const boxX = x + GRID.CELL_INSET_X;
  const boxY = y + GRID.CELL_INSET_Y;
  const boxW = GRID.CELL_W - 2 * GRID.CELL_INSET_X;
  const boxH = GRID.ROW_H - 2 * GRID.CELL_INSET_Y;
  fillRect(grid, boxX, boxY, boxW, boxH, fill);
  strokeRect(grid, boxX, boxY, boxW, boxH, rim);

  const textRight = x + GRID.CELL_W - GRID.CELL_TEXT_PAD;
  const textY = y + GRID.ROW_TEXT_DY;
  const width = measureText(cell.text, 'tabular');
  drawText(grid, cell.text, textRight, textY, SHEET.INK, { align: 'right', mode: 'tabular' });

  if (cell.struckThrough) {
    strikeThrough(
      grid,
      textRight - width - GRID.STRIKE_OVERHANG,
      textY,
      width + 2 * GRID.STRIKE_OVERHANG,
      rim,
      1,
      GRID.STRIKE_THICKNESS,
    );
  }
}

function drawLiftRow(grid: IndexGrid, row: LiftRow, index: number): void {
  const y = gridRowY(index);
  fillRect(grid, 0, y, CARD.W, GRID.ROW_H, index % 2 === 0 ? SHEET.PAPER : SHEET.PAPER_ALT);

  drawText(grid, row.label, GRID.LABEL_X, y + GRID.ROW_TEXT_DY, SHEET.INK);

  row.attempts.forEach((cell, attemptIndex) => {
    drawAttemptCell(grid, cell, gridCellX(attemptIndex), y);
  });

  // The best column: no red/green, because it is not an attempt — it is the
  // number that goes into the total.
  const bestX = gridCellX(GRID.CELL_COUNT - 1);
  fillRect(
    grid,
    bestX + GRID.CELL_INSET_X,
    y + GRID.CELL_INSET_Y,
    GRID.CELL_W - 2 * GRID.CELL_INSET_X,
    GRID.ROW_H - 2 * GRID.CELL_INSET_Y,
    SHEET.PAPER_SHADE,
  );
  drawText(
    grid,
    row.bestText,
    bestX + GRID.CELL_W - GRID.CELL_TEXT_PAD,
    y + GRID.ROW_TEXT_DY,
    inkFor(row.bestText),
    { align: 'right', mode: 'tabular' },
  );
}

function drawGrid(grid: IndexGrid, card: ResultCard, headings: readonly string[]): void {
  fillRect(grid, 0, GRID.HEADER_Y, CARD.W, GRID.HEADER_H, SHEET.PAPER_SHADE);
  const [liftHeading, ...cellHeadings] = headings;
  if (liftHeading !== undefined) {
    drawText(grid, liftHeading, GRID.LABEL_X, GRID.HEADER_TEXT_Y, SHEET.INK_SOFT);
  }
  cellHeadings.forEach((heading, i) => {
    drawText(grid, heading, gridCellCenterX(i), GRID.HEADER_TEXT_Y, SHEET.INK_SOFT, { align: 'center' });
  });
  rule(grid, 0, GRID.RULE_Y, CARD.W, SHEET.INK);

  card.rows.forEach((row, i) => drawLiftRow(grid, row, i));

  rule(grid, 0, GRID_BOTTOM_Y, CARD.W, SHEET.INK);
}

function drawTotalBlock(grid: IndexGrid, card: ResultCard): void {
  fillRect(grid, 0, TOTAL_BLOCK.Y, CARD.W, TOTAL_BLOCK.H, SHEET.BAND_DARK);

  const total = card.summary[0];
  drawText(grid, total.label, TOTAL_BLOCK.LABEL_X, TOTAL_BLOCK.LABEL_Y, SHEET.BAND_INK);

  const labelWidth = measureText(total.label);
  const available =
    TOTAL_BLOCK.VALUE_RIGHT - (TOTAL_BLOCK.LABEL_X + labelWidth + TOTAL_BLOCK.LABEL_VALUE_MIN_GAP);
  const scale = Math.max(
    TOTAL_BLOCK.VALUE_MIN_SCALE,
    fitScale(total.value, available, TOTAL_BLOCK.VALUE_SCALE, 'tabular'),
  );
  drawText(grid, total.value, TOTAL_BLOCK.VALUE_RIGHT, TOTAL_BLOCK.VALUE_Y, total.hasValue ? SHEET.ACCENT_HI : SHEET.RULE, {
    align: 'right',
    mode: 'tabular',
    scale,
  });
  drawText(
    grid,
    CARD_LABELS.UNIT,
    TOTAL_BLOCK.LABEL_X + labelWidth + TOTAL_BLOCK.UNIT_GAP,
    TOTAL_BLOCK.LABEL_Y,
    SHEET.RULE,
  );
}

function drawScoreBlocks(grid: IndexGrid, card: ResultCard): void {
  const blocks = [card.summary[1], card.summary[2]];
  blocks.forEach((block, i) => {
    const x = CONTENT.X + i * (SCORE_BLOCK_W + SCORE_BLOCKS.GAP);
    fillRect(grid, x, SCORE_BLOCKS.Y, SCORE_BLOCK_W, SCORE_BLOCKS.H, SHEET.PAPER_SHADE);
    strokeRect(grid, x, SCORE_BLOCKS.Y, SCORE_BLOCK_W, SCORE_BLOCKS.H, SHEET.RULE);
    drawText(grid, block.label, x + SCORE_BLOCKS.LABEL_DX, SCORE_BLOCKS.Y + SCORE_BLOCKS.LABEL_DY, SHEET.INK_SOFT);

    // "DQ" is not a placing and must not look like one.
    const ink =
      block.value === PLACE_NO_TOTAL_DISPLAY ? SHEET.NOLIFT_DARK : inkFor(block.value);
    const right = x + SCORE_BLOCK_W - SCORE_BLOCKS.VALUE_PAD_RIGHT;
    const scale = fitScale(block.value, SCORE_BLOCK_W - 2 * SCORE_BLOCKS.VALUE_PAD_RIGHT, SCORE_BLOCKS.VALUE_SCALE, 'tabular');
    drawText(grid, block.value, right, SCORE_BLOCKS.Y + SCORE_BLOCKS.VALUE_DY, ink, {
      align: 'right',
      mode: 'tabular',
      scale,
    });
  });
}

/** The heaviest GOOD attempt on the card, or null when there was none. */
export function heaviestGoodLift(
  card: ResultCard,
): { readonly label: string; readonly kg: number; readonly text: string } | null {
  let best: { label: string; kg: number; text: string } | null = null;
  for (const row of card.rows) {
    if (row.bestKg === null) continue;
    if (best === null || row.bestKg > best.kg) {
      best = { label: row.label, kg: row.bestKg, text: row.bestText };
    }
  }
  return best;
}

export interface SleeveFit {
  readonly discs: readonly LoadedPlate[];
  readonly pitch: number;
  readonly face: number;
}

/**
 * How many discs actually go on the card's sleeve, and how tightly.
 *
 * Same idea as `layoutSleeve` in `src/art/plates.ts` — compress the pitch before
 * dropping a disc — but against this card's geometry rather than the lifter
 * sprite's bar, which is a different size. Compression is also a free heaviness
 * cue: a maximal bar looks densely packed and a light one has air around it.
 *
 * A bar past the compressed capacity still prints its true weight in the
 * caption; only the picture is short. That limit is real on a platform too.
 */
export function fitSleeve(perSide: readonly LoadedPlate[]): SleeveFit {
  const available = BARBELL.HALF_SPAN - BARBELL.SHAFT_HALF - BARBELL.COLLAR_W;
  let pitch: number = BARBELL.PLATE_PITCH;
  if (perSide.length > 0 && perSide.length * pitch > available) {
    pitch = Math.max(BARBELL.MIN_PLATE_PITCH, Math.floor(available / perSide.length));
  }
  const capacity = pitch > 0 ? Math.floor(available / pitch) : 0;
  const count = Math.min(perSide.length, capacity, BARBELL.MAX_PLATES_PER_SIDE);
  // Always leave a pixel of gap: the gap is the only thing that makes a stack
  // countable, and a lifter WILL count them.
  const face = Math.max(BARBELL.MIN_PLATE_FACE, Math.min(BARBELL.PLATE_FACE, pitch - 1));
  return { discs: perSide.slice(0, count), pitch, face };
}

export interface BarbellCaption {
  /** Left-hand run: "TOP SINGLE", or "NO LIFTS MADE" when nothing was made. */
  readonly caption: string;
  /** Right-hand run: the lift and its weight. Empty when nothing was made. */
  readonly detail: string;
  /**
   * False when the two runs would come closer than `BARBELL.CAPTION_MIN_GAP`,
   * in which case the CAPTION is dropped and only the detail prints.
   */
  readonly captionFits: boolean;
}

/**
 * The barbell's caption line: two runs sharing one line, and the rule for what
 * happens when they will not both fit.
 *
 * EXPORTED SO IT CAN BE TESTED AT A WIDTH THE CARD CANNOT ACTUALLY PRODUCE.
 * The drop branch is unreachable at today's geometry — see
 * `BARBELL.CAPTION_MIN_GAP` — so the only way to check that the rule is the one
 * intended, rather than a `+ 8` nobody has looked at since it was typed, is to
 * call it directly with a narrow width.
 *
 * A caption with no detail beside it ALWAYS prints: "NO LIFTS MADE" is the
 * whole message on a bombed card, and dropping it would leave a bare bar with
 * no words at all.
 */
export function barbellCaption(card: ResultCard, maxWidth: number): BarbellCaption {
  const heaviest = heaviestGoodLift(card);
  const caption = heaviest === null ? CARD_LABELS.BARBELL_CAPTION_NONE : CARD_LABELS.BARBELL_CAPTION;
  const detail =
    heaviest === null
      ? ''
      : `${heaviest.label}${CARD_LABELS.BARBELL_DETAIL_SEPARATOR}${heaviest.text} ${CARD_LABELS.UNIT}`;
  const together = measureText(caption) + measureText(detail) + BARBELL.CAPTION_MIN_GAP;
  // Overlapping type is the most obvious kind of broken there is on a card
  // meant to be screenshotted, so when the line is short the caption is the run
  // that goes: the detail carries the number, the caption only labels it.
  return { caption, detail, captionFits: detail === '' || together <= maxWidth };
}

function drawBarbell(grid: IndexGrid, card: ResultCard): void {
  const heaviest = heaviestGoodLift(card);
  const cy = BARBELL.CENTER_Y;

  const { caption, detail, captionFits } = barbellCaption(card, CONTENT.W);
  if (captionFits) drawText(grid, caption, CONTENT.X, BARBELL.CAPTION_Y, SHEET.INK_SOFT);
  if (detail !== '') {
    drawText(grid, detail, CONTENT.RIGHT, BARBELL.CAPTION_Y, SHEET.INK, { align: 'right' });
  }

  // Shaft: three rows of steel, lit from above, so it reads as a cylinder
  // rather than as a line.
  const shaftTop = cy - Math.floor(BARBELL.SHAFT_THICKNESS / 2);
  const shaftRamp = [PAL.STEEL_LIGHT, PAL.STEEL_MID, PAL.STEEL_DARK];
  for (let i = 0; i < BARBELL.SHAFT_THICKNESS; i += 1) {
    rule(
      grid,
      CENTER_X - BARBELL.HALF_SPAN,
      shaftTop + i,
      BARBELL.HALF_SPAN * 2,
      shaftRamp[Math.min(i, shaftRamp.length - 1)] ?? PAL.STEEL_MID,
    );
  }

  const stack = heaviest === null ? null : visualPlateStack(heaviest.kg);
  const { discs, pitch, face } = fitSleeve(stack?.perSide ?? []);

  discs.forEach((disc, i) => {
    const ramp = PLATE_HUE_RAMPS[disc.spec.hue];
    const diameter = Math.max(
      BARBELL.MIN_DISC_DIAMETER,
      Math.round(plateDiameterPx(disc.spec) * BARBELL.DIAMETER_SCALE),
    );
    const dxInner = BARBELL.SHAFT_HALF + i * pitch;
    drawPlateEdge(grid, CENTER_X + dxInner, face, cy, diameter, ramp);
    drawPlateEdge(grid, CENTER_X - dxInner - face, face, cy, diameter, ramp);
  });

  // Collar, outboard of the last disc, exactly where a real one clamps.
  const collarInner = BARBELL.SHAFT_HALF + discs.length * pitch;
  const collarTop = cy - Math.floor(BARBELL.COLLAR_H / 2);
  fillRect(grid, CENTER_X + collarInner, collarTop, BARBELL.COLLAR_W, BARBELL.COLLAR_H, PAL.STEEL_MID);
  fillRect(grid, CENTER_X - collarInner - BARBELL.COLLAR_W, collarTop, BARBELL.COLLAR_W, BARBELL.COLLAR_H, PAL.STEEL_MID);
  setPx(grid, CENTER_X + collarInner, collarTop, PAL.CHROME_HI);
  setPx(grid, CENTER_X - collarInner - BARBELL.COLLAR_W, collarTop, PAL.CHROME_HI);
}

function drawFooter(grid: IndexGrid): void {
  fillRect(grid, 0, FOOTER.Y, CARD.W, FOOTER.H, SHEET.BAND_DARK);
  drawText(grid, FOOTER.WORDMARK, CENTER_X, FOOTER.TEXT_Y, SHEET.BAND_INK, { align: 'center' });
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * The attempt grid's headings, read from `resultCard.ts` rather than retyped.
 *
 * This used to be the literal `['LIFT','1','2','3','BEST']`, which contradicted
 * this file's own claim to decide nothing about what the card says: renaming a
 * heading in `ATTEMPT_GRID_HEADINGS` would have left the drawn card unchanged.
 */
export const DEFAULT_GRID_HEADINGS: readonly string[] = [
  ATTEMPT_GRID_HEADINGS.lift,
  ...ATTEMPT_GRID_HEADINGS.attempts,
  ATTEMPT_GRID_HEADINGS.best,
];

/**
 * Draw a result card. The grid it returns is `CARD.W x CARD.H` indices in the
 * shared palette space — sheet colours in bank 3, the barbell's steel and discs
 * in the EQUIPMENT bank — and is turned into pixels by `sheetGridToRgba`.
 *
 * `headings` defaults to the attempt grid's own headings from `resultCard.ts`;
 * it is a parameter only so a caller (or a test) can pass a localised set
 * without this file inventing one.
 */
export function renderResultCard(
  card: ResultCard,
  headings: readonly string[] = DEFAULT_GRID_HEADINGS,
): IndexGrid {
  const grid = createGrid(CARD.W, CARD.H, SHEET.PAPER);

  drawMasthead(grid, card);
  drawLifterStrip(grid, card);
  drawGrid(grid, card, headings);
  drawTotalBlock(grid, card);
  drawScoreBlocks(grid, card);
  drawBarbell(grid, card);
  drawFooter(grid);

  // The frame goes on last so nothing above can paint over the card's edge.
  strokeRect(grid, 0, 0, CARD.W, CARD.H, SHEET.INK);

  return grid;
}
