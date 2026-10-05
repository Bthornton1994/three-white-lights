/**
 * spriteKit.ts — TIER 1 ON AN ACTUAL SPRITE (GDD §7.3).
 *
 * ===========================================================================
 * WHAT THIS FILE IS FOR, AND THE HOLE IT CLOSES
 * ===========================================================================
 *
 * A colorway's entire purpose is the singlet ramp on the base sprite. Until this
 * module existed, no partner colorway had ever reached one: the only Tier 1
 * colour check in the piece was `expect(sheetColorAt(index)).toBeDefined()`, and
 * `sheetColorAt` resolves ANY index across all four banks — so a colorway made
 * of barbell-plate colours passed, and three of the four did. The Tier 1 payload
 * was being validated in the palette of a Tier 3 surface.
 *
 * Two things fix that and both are here:
 *
 *   1. `colorwayProblems` validates a colorway against the SPRITE palette and
 *      `isBodyIndex` — the pipeline's own rule for "this pixel is the lifter".
 *   2. `wearColorway` puts a colorway on a REAL RENDERED FRAME, so the claim
 *      can be asserted on pixels rather than on a swatch rectangle.
 *
 * ===========================================================================
 * WHY THIS LIVES IN `src/licensing/` AND NOT IN `src/art/`
 * ===========================================================================
 *
 * §7.3's practical claim is that "the sprite pipeline never has to know a
 * partner exists" — losing a deal removes rows from a table rather than forcing
 * a re-render of every animation frame. `tiers.test.ts` enforces the direction
 * by reading the real files: nothing under `src/art/` may import
 * `src/licensing/`. The reverse is allowed and is the whole design.
 *
 * So the recolour is applied on THIS side of the boundary, to the `IndexGrid`
 * `renderLifterFrame` already handed back. `renderLifterFrame` is not called
 * again, takes no new parameter, and does not know this file exists.
 *
 * ===========================================================================
 * WHAT THIS IS AND IS NOT — SAID PLAINLY, BECAUSE THE SHAPE IS ARGUABLE
 * ===========================================================================
 *
 * This is an INDEX REMAP: the three singlet indices in a rendered grid are
 * rewritten to the three indices of the partner's ramp. It is dependency-correct
 * and it is enough to prove Tier 1 works on real pixels.
 *
 * It is NOT what the hardware did, and the difference is worth writing down
 * rather than glossing. A 16-bit palette swap changed CRAM — the tile data was
 * untouched and the same index resolved to a different colour. The equivalent
 * here is a colorway-aware step where an `IndexGrid` becomes RGBA: the grid
 * keeps saying `SINGLET_MID` and the palette says what `SINGLET_MID` looks like
 * today. That is strictly better, because a remapped grid answers "is this pixel
 * the singlet?" differently from an unremapped one, and anything downstream that
 * asks loses the answer.
 *
 * It is not built that way because the RGBA resolution step lives in `src/art/`,
 * and taking a colorway parameter there is a change to a settled module this
 * piece does not own. `RECOLOUR_IS_A_STOPGAP_FOR_A_PALETTE_OVERRIDE` below names
 * the residual so it is greppable rather than forgotten. What is NOT residual is
 * the validation: `colorwayProblems` is the check that was missing, and it is
 * correct whichever way the swap is eventually performed.
 *
 * PURE MODULE: no React, no I/O, no clock, no randomness. Every numeric knob is
 * in `licensingTuning.ts`.
 */

import { luma8 } from '../art/craftMetrics';
import { isBodyIndex } from '../art/lifterSprite';
import { PAL, colorAt, rgb5ToRgb8 } from '../art/palette';
import { cloneGrid, type IndexGrid } from '../art/raster';
import { COLORWAY_RAMP } from './licensingTuning';
import type { Colorway } from './tiers';

// ---------------------------------------------------------------------------
// The residual, named
// ---------------------------------------------------------------------------

/**
 * WHAT WOULD REPLACE `wearColorway`, stated as a constant so it is greppable.
 *
 * A comment saying "this should really be X" is invisible to every search
 * anybody runs. This is the same thing as a name.
 */
export const RECOLOUR_IS_A_STOPGAP_FOR_A_PALETTE_OVERRIDE =
  'A colorway is a CRAM swap, not a tile rewrite. The end state is a colorway ' +
  'parameter on the index->RGBA step in src/art/, so a rendered grid keeps ' +
  'saying SINGLET_MID and the palette decides what SINGLET_MID looks like. ' +
  'That is an edit to a settled art module and is reported, not made, here.';

// ---------------------------------------------------------------------------
// What the base sprite draws a singlet in
// ---------------------------------------------------------------------------

/**
 * THE HOUSE SINGLET RAMP, dark to light — the pixels a colorway replaces.
 *
 * Read off `palette.ts`'s named indices rather than re-typed, so it cannot drift
 * from what `RAMPS.SINGLET` actually shades into. `spriteKit.test.ts` asserts
 * these three are exactly `RAMPS.SINGLET`, which is the non-vacuity guard: a
 * recolour that targeted indices the renderer never draws would be a no-op that
 * every assertion below would happily pass over.
 */
export const HOUSE_SINGLET_RAMP: readonly number[] = Object.freeze([
  PAL.SINGLET_DARK,
  PAL.SINGLET_MID,
  PAL.SINGLET_LIGHT,
]);

/** A colorway's three steps, dark to light, as an array. */
export function colorwayRamp(colorway: Colorway): readonly number[] {
  return [colorway.dark, colorway.mid, colorway.light];
}

// ---------------------------------------------------------------------------
// What a colorway may not be
// ---------------------------------------------------------------------------

/**
 * PALETTE INDICES A COLORWAY MAY NAME BUT MUST NOT, WITH THE REASON.
 *
 * Every one of these is bank 0, so `isBodyIndex` passes and the check above it
 * cannot catch them. They are excluded for drawing reasons, one per entry:
 *
 *  - `OUTLINE` is the line, not a fill. A singlet drawn in it dissolves into its
 *    own silhouette and `outlinePass` has nothing left to separate.
 *  - The SKIN ramp is flesh. A singlet the colour of a shoulder is not a singlet,
 *    and `SKIN_FLUSH` specifically is GDD §3.4's strain cue — a kit wearing it
 *    would make "the lifter went red" unmeasurable, which is a thing
 *    `lifterSprite.test.ts` measures.
 *
 * A LIST, NOT A RANGE, so adding a bank-0 slot later does not silently join it.
 */
export const COLORWAY_FORBIDDEN_INDICES: ReadonlyMap<number, string> = new Map([
  [PAL.OUTLINE, 'the outline colour is a line, not a fill'],
  [PAL.SKIN_SHADOW, 'the skin ramp is flesh, not kit'],
  [PAL.SKIN_MID, 'the skin ramp is flesh, not kit'],
  [PAL.SKIN_LIGHT, 'the skin ramp is flesh, not kit'],
  [PAL.SKIN_HI, 'the skin ramp is flesh, not kit'],
  [PAL.SKIN_FLUSH, 'SKIN_FLUSH is the strain cue (GDD §3.4), not a kit colour'],
]);

/** Rec.601 luma of a palette index, or `undefined` when it resolves to nothing. */
export function spriteLumaOf(index: number): number | undefined {
  const colour = colorAt(index);
  if (colour === undefined) return undefined;
  const [r, g, b] = rgb5ToRgb8(colour);
  return luma8(r, g, b);
}

/**
 * WHAT IS WRONG WITH A COLORWAY, IF ANYTHING. Empty array for a good one.
 *
 * ===========================================================================
 * THIS IS THE CHECK THAT WAS MISSING, AND WHAT IT ACTUALLY ASKS
 * ===========================================================================
 *
 * The one it replaces asked `sheetColorAt(index) !== undefined`, which is true
 * of every index in all four banks — the sprite's two, the stage's and the
 * result sheet's. A colorway naming `SHEET.PAPER` passed it. What a Tier 1
 * payload has to satisfy is narrower and is the SPRITE's rule:
 *
 *   1. THREE DISTINCT STEPS. A ramp with a repeat is a two-tone kit wearing a
 *      three-field type.
 *   2. EVERY STEP IS THE LIFTER. `isBodyIndex` — `lifterSprite.ts`'s own
 *      function, bank 0 and not transparent. This is the one that fails on a
 *      plate colour, and it is not a stylistic preference: `bodyPixelDiff`, the
 *      silhouette measure and the phone-scale readability bounds all classify
 *      pixels with it, so a singlet drawn in bank 1 is measured as barbell.
 *   3. EVERY STEP RESOLVES TO A COLOUR. An allocated slot, not a hole.
 *   4. NO FORBIDDEN INDEX. See `COLORWAY_FORBIDDEN_INDICES`.
 *   5. IT RISES. Strictly ascending Rec.601 luma, by at least
 *      `COLORWAY_RAMP.MIN_STEP_LUMA` per step, because a three-step ramp whose
 *      steps a phone cannot tell apart is a flat kit with extra fields.
 *
 * WHAT IT STILL CANNOT SAY: whether the kit LOOKS good, whether the hue suits
 * the partner, or whether three steps of one hue read as cloth. Those need a
 * human's eye and this is a floor under the mechanical failures, stated as a
 * floor rather than glossed as a guarantee.
 */
export function colorwayProblems(colorway: Colorway): readonly string[] {
  const problems: string[] = [];
  const steps = colorwayRamp(colorway);
  const named = [
    ['dark', colorway.dark],
    ['mid', colorway.mid],
    ['light', colorway.light],
  ] as const;

  if (steps.length !== COLORWAY_RAMP.STEPS) {
    problems.push(`${colorway.id}: a colorway is ${COLORWAY_RAMP.STEPS} steps`);
  }
  if (new Set(steps).size !== steps.length) {
    problems.push(`${colorway.id}: the three steps are not distinct`);
  }

  for (const [name, index] of named) {
    if (!isBodyIndex(index)) {
      problems.push(
        `${colorway.id}.${name}: index ${index} is not a body index — Tier 1 recolours the ` +
          `singlet on the base sprite, and every measurement in the sprite pipeline reads ` +
          `bank 0 as the lifter and everything else as equipment`,
      );
      continue;
    }
    if (colorAt(index) === undefined) {
      problems.push(`${colorway.id}.${name}: index ${index} is not an allocated palette slot`);
      continue;
    }
    const forbidden = COLORWAY_FORBIDDEN_INDICES.get(index);
    if (forbidden !== undefined) {
      problems.push(`${colorway.id}.${name}: index ${index} may not be worn — ${forbidden}`);
    }
  }

  // Only meaningful once every step resolves; a hole has no luma to compare.
  const lumas = steps.map(spriteLumaOf);
  if (lumas.every((l): l is number => l !== undefined)) {
    for (let i = 1; i < lumas.length; i += 1) {
      const rise = (lumas[i] ?? 0) - (lumas[i - 1] ?? 0);
      if (rise < COLORWAY_RAMP.MIN_STEP_LUMA) {
        problems.push(
          `${colorway.id}: step ${i - 1}->${i} rises ${rise.toFixed(1)} luma, under the ` +
            `${COLORWAY_RAMP.MIN_STEP_LUMA} floor — a ramp whose steps a phone cannot tell ` +
            `apart is a flat kit`,
        );
      }
    }
  }

  return problems;
}

// ---------------------------------------------------------------------------
// Wearing it
// ---------------------------------------------------------------------------

/**
 * PUT A COLORWAY ON A RENDERED FRAME. The Tier 1 surface, for real.
 *
 * ONE PASS OVER THE SOURCE, THROUGH A LOOKUP, and that is not an optimisation.
 * A colorway may legitimately reuse a house singlet index — `ninebar-blue` keeps
 * `SINGLET_DARK` as its base — so rewriting the grid step by step would send
 * `SINGLET_MID` to `SINGLET_LIGHT` on one pass and then `SINGLET_LIGHT` to
 * `CHALK` on the next, and the mid step would arrive at the highlight. Read from
 * the original, write to the copy.
 *
 * Everything that is not the singlet is left exactly as rendered: skin, hair,
 * gear, chalk, and every bank-1 pixel of the barbell. A colorway is a kit, not a
 * filter.
 *
 * @throws {RangeError} if the colorway is not a legal Tier 1 payload. The door
 *   is here on purpose: a colorway that cannot be worn should fail where it is
 *   put on, not render a lifter whose torso the pipeline counts as barbell.
 */
export function wearColorway(grid: IndexGrid, colorway: Colorway): IndexGrid {
  const problems = colorwayProblems(colorway);
  if (problems.length > 0) {
    throw new RangeError(`spriteKit: ${colorway.id} is not a wearable colorway: ${problems.join('; ')}`);
  }
  const swap = new Map<number, number>();
  const to = colorwayRamp(colorway);
  HOUSE_SINGLET_RAMP.forEach((from, i) => {
    const target = to[i];
    if (target !== undefined) swap.set(from, target);
  });

  const out = cloneGrid(grid);
  for (let i = 0; i < grid.data.length; i += 1) {
    const source = grid.data[i] ?? 0;
    const target = swap.get(source);
    if (target !== undefined) out.data[i] = target;
  }
  return out;
}

/**
 * How many pixels a grid carries of each palette index.
 *
 * Here rather than in a test because two tests want it and because "count the
 * pixels" is the only way to tell a recolour that happened from one that was
 * asserted about. Transparent is included: a caller that wants to ignore it can,
 * and a collector that silently dropped it would make an empty grid look full.
 */
export function indexHistogram(grid: IndexGrid): ReadonlyMap<number, number> {
  const counts = new Map<number, number>();
  for (let i = 0; i < grid.data.length; i += 1) {
    const index = grid.data[i] ?? 0;
    counts.set(index, (counts.get(index) ?? 0) + 1);
  }
  return counts;
}

/** Pixels in a grid that `isBodyIndex` counts as the lifter. */
export function bodyPixelCount(grid: IndexGrid): number {
  let count = 0;
  for (let i = 0; i < grid.data.length; i += 1) {
    if (isBodyIndex(grid.data[i] ?? 0)) count += 1;
  }
  return count;
}
