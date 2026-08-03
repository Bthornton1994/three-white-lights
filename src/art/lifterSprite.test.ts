import { describe, expect, it } from 'vitest';
import {
  SPRITE_CELL,
  barOffsetAt,
  bodyPixelDiff,
  frameSpecFrom,
  headBox,
  renderContactShadow,
  renderLifterFrame,
  renderStage,
  unionRect,
  type LifterFrameSpec,
} from './lifterSprite';
import { buildSquatRep, stickingPointFrame } from './squatAnimation';
import { BANK_SIZE, PAL, colorAt, isTransparentIndex, rgb5ToRgb8 } from './palette';
import { findUnallocatedIndices, gridToRgba, usedIndices } from './rgba';
import { getPx, upscaleGrid, type IndexGrid } from './raster';
import { BAR, BEND, CENTER_X, LOAD_PRESETS, PITCH, RESOLUTION, STRAIN } from './spriteTuning';
import {
  FEMUR_FRONTAL_LEN_PX,
  POSES,
  RIG_GEOMETRY,
  deformPose,
  femurTilt,
  kneeSleeveSpan,
  poseAtDepth,
  singletHemY,
  type Pose,
} from './rig';

const BASE: LifterFrameSpec = {
  depth: 0,
  direction: 'DESCENT',
  strainLevel: 0,
  pitchLevel: 0,
  barLateralPx: 0,
  barTiltDeg: 0,
  barBendPx: 0,
  chalkMotes: 0,
  totalKg: 180,
};

const spec = (over: Partial<LifterFrameSpec> = {}): LifterFrameSpec => ({ ...BASE, ...over });

function coverage(grid: IndexGrid): number {
  let lit = 0;
  for (let i = 0; i < grid.data.length; i += 1) {
    if (!isTransparentIndex(grid.data[i] ?? 0)) lit += 1;
  }
  return lit / grid.data.length;
}

function gridsEqual(a: IndexGrid, b: IndexGrid): boolean {
  if (a.w !== b.w || a.h !== b.h) return false;
  for (let i = 0; i < a.data.length; i += 1) if (a.data[i] !== b.data[i]) return false;
  return true;
}

describe('rendered frame integrity', () => {
  it('renders at the committed internal resolution', () => {
    const { grid } = renderLifterFrame(spec());
    expect(grid.w).toBe(RESOLUTION.CELL_W);
    expect(grid.h).toBe(RESOLUTION.CELL_H);
    expect(SPRITE_CELL).toEqual({ W: RESOLUTION.CELL_W, H: RESOLUTION.CELL_H });
    // 96x72 is 12x9 tiles of 8x8, which is how sprite RAM was budgeted.
    expect(grid.w % 8).toBe(0);
    expect(grid.h % 8).toBe(0);
  });

  it('never references an unallocated palette index', () => {
    for (const rep of [buildSquatRep(LOAD_PRESETS.LIGHT), buildSquatRep(LOAD_PRESETS.MAXIMAL)]) {
      for (const frame of rep.frames) {
        const { grid } = renderLifterFrame(frameSpecFrom(frame, 250));
        expect(findUnallocatedIndices(grid), `frame ${frame.index}`).toEqual([]);
      }
    }
  });

  it('keeps the character out of the STAGE bank entirely', () => {
    // STAGE exists so a frame has a floor when inspected alone. A sprite that
    // painted itself with backdrop colours would fall apart over real scenery.
    const { grid } = renderLifterFrame(spec({ strainLevel: STRAIN.LEVELS - 1, depth: 1 }));
    for (const index of usedIndices(grid)) {
      expect(Math.floor(index / BANK_SIZE), `index ${index}`).toBeLessThan(2);
    }
  });

  it('draws something substantial but does not fill the cell', () => {
    const { grid } = renderLifterFrame(spec());
    expect(coverage(grid)).toBeGreaterThan(0.12);
    expect(coverage(grid)).toBeLessThan(0.6);
  });

  it('leaves a transparent margin, so nothing is clipped by the cell', () => {
    for (const depth of [0, 0.5, 1]) {
      for (const kg of [27.5, 250, 400]) {
        const { grid } = renderLifterFrame(
          spec({ depth, totalKg: kg, barBendPx: BEND.MAX_PX, barLateralPx: 1, barTiltDeg: 4 }),
        );
        for (let x = 0; x < grid.w; x += 1) {
          expect(getPx(grid, x, 0), `top row, ${kg}kg d${depth}`).toBe(0);
          expect(getPx(grid, x, grid.h - 1), `bottom row, ${kg}kg d${depth}`).toBe(0);
        }
        for (let y = 0; y < grid.h; y += 1) {
          expect(getPx(grid, 0, y), `left col, ${kg}kg d${depth}`).toBe(0);
          expect(getPx(grid, grid.w - 1, y), `right col, ${kg}kg d${depth}`).toBe(0);
        }
      }
    }
  });

  it('outlines the whole silhouette: no fill pixel touches open space', () => {
    const { grid } = renderLifterFrame(spec({ depth: 1, strainLevel: 2, totalKg: 250 }));
    const outlines = new Set<number>([PAL.OUTLINE, PAL.EQ_OUTLINE]);
    for (let y = 1; y < grid.h - 1; y += 1) {
      for (let x = 1; x < grid.w - 1; x += 1) {
        const v = getPx(grid, x, y);
        if (isTransparentIndex(v) || outlines.has(v)) continue;
        const neighbours = [
          getPx(grid, x - 1, y),
          getPx(grid, x + 1, y),
          getPx(grid, x, y - 1),
          getPx(grid, x, y + 1),
        ];
        for (const n of neighbours) {
          expect(isTransparentIndex(n), `bare fill pixel at ${x},${y}`).toBe(false);
        }
      }
    }
  });

  it('is deterministic', () => {
    const a = renderLifterFrame(spec({ depth: 0.5, strainLevel: 2 })).grid;
    const b = renderLifterFrame(spec({ depth: 0.5, strainLevel: 2 })).grid;
    expect(gridsEqual(a, b)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// THE BODY-ONLY MAGNITUDE FLOORS
//
// The whole point of this block is that "the grids differ" is not a claim worth
// making. A grimace is seven pixels and a skin ramp swap is a palette index; a
// test that only asks whether something changed passes on both while the
// lifter's body is the same drawing at every load.
//
// So every assertion below is a COUNT with a floor, measured on the LIFTER bank
// only (the barbell is excluded structurally, by palette bank) with the two
// frames drawn at the same depth, the same direction and the SAME barbell —
// same weight, same bend, same tilt, same shake. And the sharpest of them is
// measured with the head box masked out entirely, so neither the grimace nor
// the flushed face can contribute a single pixel to the number.
//
// `silhouette` counts pixels that are body in one frame and not body in the
// other. It is pure shape, and it is the load-bearing number here: a palette
// change cannot move it at all, so neither a grimace nor a ruddier skin ramp
// can carry it. `changed` is the weaker of the two precisely because the flush
// ramp inflates it, and it is floored as a secondary check, not a primary one.
//
// FLOORS ARE CALIBRATED AGAINST THE PREVIOUS MODEL, not just against zero.
// Before this rework the strain response was one delta vector scaled linearly,
// and it was not a no-op — at the same matched depth and bar it moved 98
// silhouette px, which is why a bare "the grids differ" assertion had nothing
// to say about it. Every floor below sits above what that model produced and
// below what this one does, so it discriminates between the two rather than
// merely between something and nothing. The measured values for both are on
// each constant.
// ---------------------------------------------------------------------------

/**
 * At the sticking point — the frame the whole comparison is about.
 * This tuning: 188 silhouette / 717 changed. Previous model: 98 / 406.
 */
const FLOOR_STICK_SILHOUETTE = 140;
const FLOOR_STICK_CHANGED = 520;
/**
 * Everywhere on the depth ladder, so no depth is a dead spot.
 * This tuning, worst depth: 143 / 514. Previous model, worst depth: 40 / 251.
 */
const FLOOR_SWEEP_SILHOUETTE = 110;
const FLOOR_SWEEP_CHANGED = 380;
/**
 * Every adjacent authored strain rung must move a body. Not a comparison
 * against the old model — a check that no rung is decoration.
 * This tuning, worst rung: 27 silhouette / 212 changed.
 */
const FLOOR_ADJACENT_RUNG_SILHOUETTE = 15;
const FLOOR_ADJACENT_RUNG_CHANGED = 100;
/**
 * Forward-drift response, measured on a frame ALREADY at maximum strain.
 * This tuning: 146 changed / 13 silhouette. Previous model: 0 and 0.
 */
const FLOOR_PITCH_ON_MAX_STRAIN_CHANGED = 60;
/** Fraction of the light-vs-maximal difference that must be off the head. */
const MIN_SHARE_OUTSIDE_HEAD = 0.6;

/** The drawing a rep reaches at its sticking point, as a render spec. */
function stickSpec(loadRatio: number, over: Partial<LifterFrameSpec> = {}): LifterFrameSpec {
  const frame = stickingPointFrame(buildSquatRep(loadRatio));
  if (frame === undefined) throw new Error(`no sticking-point frame at ${loadRatio}`);
  // Identical barbell on both sides: the bar's own load cues are not what this
  // is measuring, so they are held fixed rather than allowed to differ.
  return spec({
    depth: frame.poseDepth,
    direction: frame.direction,
    strainLevel: frame.strainLevel,
    pitchLevel: frame.pitchLevel,
    totalKg: 250,
    ...over,
  });
}

describe('the LIFTER carries the load, not only the bar and the clock', () => {
  const lightStick = stickingPointFrame(buildSquatRep(LOAD_PRESETS.LIGHT));
  const maxStick = stickingPointFrame(buildSquatRep(LOAD_PRESETS.MAXIMAL));

  it('compares the levels the animation actually produces, not the endpoints', () => {
    // If this ever fails, every floor below is measuring the wrong pair. The
    // previous version of this file compared strain 0 against STRAIN.LEVELS-1,
    // a comparison no two reps in the animation ever make.
    expect(lightStick?.strainLevel).toBe(1);
    expect(maxStick?.strainLevel).toBe(3);
    expect(maxStick?.pitchLevel).toBe(3);
    expect(lightStick?.poseDepth).toBe(maxStick?.poseDepth);
  });

  it('changes a large, counted number of BODY pixels between a light rep and a maximal one', () => {
    // Measured at this tuning: 218 silhouette / 829 changed of 1366 body px.
    const light = renderLifterFrame(stickSpec(LOAD_PRESETS.LIGHT));
    const maximal = renderLifterFrame(stickSpec(LOAD_PRESETS.MAXIMAL));
    const diff = bodyPixelDiff(light.grid, maximal.grid);

    expect(diff.bodyArea).toBeGreaterThan(500);
    expect(diff.silhouette).toBeGreaterThan(FLOOR_STICK_SILHOUETTE);
    expect(diff.changed).toBeGreaterThan(FLOOR_STICK_CHANGED);
  });

  it('still clears the floor with the entire head masked out — it is not a face swap', () => {
    // Measured at this tuning: 188 silhouette / 717 changed, and 86% of all
    // changed body pixels fall outside the head box.
    const light = renderLifterFrame(stickSpec(LOAD_PRESETS.LIGHT));
    const maximal = renderLifterFrame(stickSpec(LOAD_PRESETS.MAXIMAL));
    const box = unionRect(headBox(light.pose), headBox(maximal.pose));

    const all = bodyPixelDiff(light.grid, maximal.grid);
    const noHead = bodyPixelDiff(light.grid, maximal.grid, box);

    expect(noHead.silhouette).toBeGreaterThan(FLOOR_STICK_SILHOUETTE);
    expect(noHead.changed).toBeGreaterThan(FLOOR_STICK_CHANGED);
    expect(noHead.changed / all.changed).toBeGreaterThan(MIN_SHARE_OUTSIDE_HEAD);
  });

  it('holds that floor at every authored depth step, not just at the sticking point', () => {
    // Measured minimum over the whole depth ladder and both directions:
    // 143 silhouette / 514 changed with the head masked.
    for (let step = 0; step <= 12; step += 1) {
      const depth = step / 12;
      for (const direction of ['DESCENT', 'ASCENT'] as const) {
        const light = renderLifterFrame(stickSpec(LOAD_PRESETS.LIGHT, { depth, direction }));
        const maximal = renderLifterFrame(stickSpec(LOAD_PRESETS.MAXIMAL, { depth, direction }));
        const box = unionRect(headBox(light.pose), headBox(maximal.pose));
        const noHead = bodyPixelDiff(light.grid, maximal.grid, box);
        expect(noHead.silhouette, `depth ${depth.toFixed(2)} ${direction}`).toBeGreaterThan(
          FLOOR_SWEEP_SILHOUETTE,
        );
        expect(noHead.changed, `depth ${depth.toFixed(2)} ${direction}`).toBeGreaterThan(
          FLOOR_SWEEP_CHANGED,
        );
      }
    }
  });

  it('gives every authored strain rung a body of its own', () => {
    // No rung may be decoration. Measured, head masked: 27/212, 93/334, 93/421.
    for (let level = 1; level < STRAIN.LEVELS; level += 1) {
      const lower = renderLifterFrame(
        spec({ depth: 0.66, direction: 'ASCENT', strainLevel: level - 1, totalKg: 250 }),
      );
      const upper = renderLifterFrame(
        spec({ depth: 0.66, direction: 'ASCENT', strainLevel: level, totalKg: 250 }),
      );
      const box = unionRect(headBox(lower.pose), headBox(upper.pose));
      const diff = bodyPixelDiff(lower.grid, upper.grid, box);
      expect(diff.silhouette, `strain ${level - 1} -> ${level}`).toBeGreaterThan(
        FLOOR_ADJACENT_RUNG_SILHOUETTE,
      );
      expect(diff.changed, `strain ${level - 1} -> ${level}`).toBeGreaterThan(
        FLOOR_ADJACENT_RUNG_CHANGED,
      );
    }
  });

  it('lets forward bar drift reach the pixels of a rep that is ALREADY at maximum strain', () => {
    // The regression this exists for: drift used to be a term added into
    // strain. On a maximal grind the strain term is already at the top of its
    // range, the sum clamps, and the drift changed no pixels at all — it moved
    // the light rep and nothing else. Here the two frames are identical in
    // every respect including strain level; only the drift response differs.
    // Measured: 146 changed / 13 silhouette.
    const top = STRAIN.LEVELS - 1;
    const noDrift = renderLifterFrame(
      spec({ depth: 0.66, direction: 'ASCENT', strainLevel: top, pitchLevel: 0, totalKg: 250 }),
    );
    const drifted = renderLifterFrame(
      spec({
        depth: 0.66,
        direction: 'ASCENT',
        strainLevel: top,
        pitchLevel: PITCH.LEVELS - 1,
        totalKg: 250,
      }),
    );
    const diff = bodyPixelDiff(noDrift.grid, drifted.grid);
    expect(diff.changed).toBeGreaterThan(FLOOR_PITCH_ON_MAX_STRAIN_CHANGED);
    expect(diff.silhouette).toBeGreaterThan(0);
  });

  it('does the same on the maximal rep as it is actually built', () => {
    // Not a hand-built spec: the real frame, with its pitch level knocked out.
    // Measured: 158 changed / 18 silhouette.
    if (maxStick === undefined) throw new Error('no maximal sticking-point frame');
    const asBuilt = renderLifterFrame(frameSpecFrom(maxStick, 250));
    const flattened = renderLifterFrame({ ...frameSpecFrom(maxStick, 250), pitchLevel: 0 });
    expect(maxStick.strainLevel).toBe(STRAIN.LEVELS - 1);
    expect(bodyPixelDiff(asBuilt.grid, flattened.grid).changed).toBeGreaterThan(
      FLOOR_PITCH_ON_MAX_STRAIN_CHANGED,
    );
  });

  it('measures the body and only the body', () => {
    // The diff must be blind to the barbell, or every floor above is inflated
    // by discs. Two frames identical except for 100 kg of plates must read as
    // zero body change.
    const lightBar = renderLifterFrame(spec({ depth: 0.66, direction: 'ASCENT', totalKg: 100 }));
    const heavyBar = renderLifterFrame(spec({ depth: 0.66, direction: 'ASCENT', totalKg: 250 }));
    expect(gridsEqual(lightBar.grid, heavyBar.grid)).toBe(false);
    const diff = bodyPixelDiff(lightBar.grid, heavyBar.grid);
    expect(diff.changed).toBe(0);
    expect(diff.silhouette).toBe(0);
  });

  it('deforms in the direction the model claims: hips up, knees in, elbows in', () => {
    const relaxed = renderLifterFrame(spec({ depth: 0.66, direction: 'ASCENT', strainLevel: 0 }));
    const strained = renderLifterFrame(
      spec({ depth: 0.66, direction: 'ASCENT', strainLevel: STRAIN.LEVELS - 1 }),
    );
    expect(strained.pose.hipY).toBeLessThan(relaxed.pose.hipY);
    expect(strained.pose.kneeHalfW).toBeLessThan(relaxed.pose.kneeHalfW);
    expect(strained.pose.headY).toBeLessThan(relaxed.pose.headY);
    expect(strained.pose.elbowHalfW).toBeLessThan(relaxed.pose.elbowHalfW);
    expect(strained.pose.shoulderHalfW).toBeGreaterThan(relaxed.pose.shoulderHalfW);
    expect(strained.pose.ankleHalfW).toBeGreaterThan(relaxed.pose.ankleHalfW);
  });
});

describe('the drawing responds to load, not only the clock', () => {
  it('changes pixels when the bar gets heavier at the same pose', () => {
    const lightBar = renderLifterFrame(spec({ totalKg: 100 }));
    const heavyBar = renderLifterFrame(spec({ totalKg: 250 }));
    expect(gridsEqual(lightBar.grid, heavyBar.grid)).toBe(false);
    expect(heavyBar.sleeve.slots.length).toBeGreaterThan(lightBar.sleeve.slots.length);
  });

  it('changes pixels when the sleeves bend', () => {
    const straight = renderLifterFrame(spec({ totalKg: 250, barBendPx: 0 }));
    const bowed = renderLifterFrame(spec({ totalKg: 250, barBendPx: 3.5 }));
    expect(gridsEqual(straight.grid, bowed.grid)).toBe(false);
  });

  it('changes pixels when the bar tilts', () => {
    const levelBar = renderLifterFrame(spec({ totalKg: 250, barTiltDeg: 0 }));
    const tilted = renderLifterFrame(spec({ totalKg: 250, barTiltDeg: 3 }));
    expect(gridsEqual(levelBar.grid, tilted.grid)).toBe(false);
  });

  it('does not render a mirror image of itself', () => {
    // Geometry is symmetric about CENTER_X by construction; the key light,
    // the head offset and the grip asymmetry are what stop the pixels from
    // being symmetric too. If this ever passes as symmetric, the shading model
    // has been flattened.
    const { grid } = renderLifterFrame(spec({ totalKg: 250 }));
    let mirrored = 0;
    let total = 0;
    for (let y = 0; y < grid.h; y += 1) {
      for (let x = 0; x < grid.w; x += 1) {
        const a = getPx(grid, x, y);
        const b = getPx(grid, grid.w - 1 - x, y);
        if (isTransparentIndex(a) && isTransparentIndex(b)) continue;
        total += 1;
        if (a === b) mirrored += 1;
      }
    }
    expect(mirrored / total).toBeLessThan(0.9);
  });
});

// ---------------------------------------------------------------------------
// THE LIFTER CARRIES THE TOP OF THE VALUE RANGE
//
// In the 16-bit sports reference the figures hold the brightest, most contrasty
// pixels in the frame and everything behind them is deliberately suppressed —
// sampled off `docs/reference/sprite-ref-1-snes-wrestling.png`, the wrestler's
// skin runs up to luma 234 while the crowd behind him sits between 16 and 80.
//
// Ours had it the other way round: the skin ramp topped out a hair under the
// steel of the sprite's own collars, the top step was reachable only as a
// one-pixel sliver, and the brightest and most saturated things in every frame
// were the chrome collars and the red discs. The sprite read duller than its
// own barbell.
//
// So this is floored as an AREA, not as a colour. "The palette contains a light
// skin tone" is not the claim; "the lifter's bright pixels outnumber the
// equipment's" is.
// ---------------------------------------------------------------------------

/** Luma of a palette index in display space, or -1 for unallocated. */
function luma(index: number): number {
  const c = colorAt(index);
  if (c === undefined) return -1;
  const [r, g, b] = rgb5ToRgb8(c);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Pixels at or above `floorLuma`, split into lifter and equipment. */
function brightSplit(grid: IndexGrid, floorLuma: number): { lifter: number; equipment: number } {
  let lifter = 0;
  let equipment = 0;
  for (const v of grid.data) {
    if (isTransparentIndex(v) || luma(v) < floorLuma) continue;
    if (Math.floor(v / BANK_SIZE) === 0) lifter += 1;
    else equipment += 1;
  }
  return { lifter, equipment };
}

/** Where the lifter's own ramps stop. Everything above this is a highlight. */
const HIGHLIGHT_LUMA = 170;

/**
 * BOUNDS FOR "THE FIGURE CARRIES ITS RANGE ACROSS ITS WHOLE HEIGHT".
 *
 * All five are measured facts about the reference plus headroom, not round
 * numbers, and all five were measured in this repo's sandbox on
 * `docs/reference/sprite-ref-1-snes-wrestling.png` at its native 256x224 — the
 * blond wrestler masked by his own palette (skin ramp, trunks, hair, boots) and
 * split at his own vertical midpoint. That mask gives:
 *
 *     upper: 553 px, mean luma 133.2, near-black 1.3%
 *     lower: 530 px, mean luma 118.8, near-black 5.7%
 *     upper / lower mean ratio 1.122
 *
 * `sprite-ref-2-16bit-baseball.png` is NOT used for any of this. It is modern
 * pixel art of a current player, i.e. the pastiche GDD §12.2's blind A/B exists
 * to tell us apart from.
 *
 * THE MEAN RATIO IS BRACKETED, NOT CAPPED, and that is the point of the floor.
 * The cap alone was directional: it caught a lower body left behind by a change
 * to the upper body, and a DARKER upper body satisfies it more easily, not less
 * — so it could not see the arms being the only part of the figure still drawn
 * with a near-black keyline round every mass. Measured with that keyline in
 * place the ratio ran 0.86-1.02 and passed the 1.35 cap at every pose. The
 * reference is above 1 on both masks anyone here has taken of it (1.04 and
 * 1.122): its brightest half is the one with the arms in it.
 */
const MAX_UPPER_OVER_LOWER_MEAN = 1.35;
const MIN_UPPER_OVER_LOWER_MEAN = 0.98;
const NEAR_BLACK_LUMA = 40;
const MAX_LOWER_NEAR_BLACK_SHARE = 0.32;
/**
 * Tighter than the lower half's, because the reference's upper half is the
 * cleaner one (1.3% against 5.7%) and because there is less silhouette per pixel
 * up here: the torso is one wide mass, the legs are two narrow ones.
 */
const MAX_UPPER_NEAR_BLACK_SHARE = 0.24;
/**
 * Near-black that is not the silhouette keyline — every 4-neighbour is body, so
 * it is a line drawn INSIDE the figure. Applied to both halves, because the
 * defect this catches has now appeared in each of them in turn.
 *
 * This is the sharp measure and the two shares above are the blunt ones. The
 * keyline `outlinePass` puts round the outside is deliberate (GDD §12.2: it has
 * to read at phone scale against an unknown background) and the reference does
 * not have one, so a raw near-black share can never be compared to the
 * reference's directly. Interior near-black can: the reference has none at all
 * on a limb, its arms and thighs being contoured in their own darkest skin step.
 * Ours is not zero and is not meant to be — the eyes, the brow bar, the mouth
 * and the belt's lever plate are hand-placed near-black marks, which is what a
 * 16-bit artist does with the darkest entry in a bank, and a one-pixel gap
 * between two masses gets filled by the keyline pass from both sides.
 */
const MAX_INTERIOR_KEYLINE_SHARE = 0.14;

interface HalfPixel {
  readonly y: number;
  readonly l: number;
  /** True when this pixel is near-black AND every 4-neighbour is body. */
  readonly interiorKeyline: boolean;
}

/** Every LIFTER-bank pixel, split at the figure's vertical midpoint. */
function bodyHalfPixels(grid: IndexGrid): { upper: HalfPixel[]; lower: HalfPixel[] } {
  const touchesOpenSpace = (x: number, y: number): boolean =>
    isTransparentIndex(getPx(grid, x - 1, y)) ||
    isTransparentIndex(getPx(grid, x + 1, y)) ||
    isTransparentIndex(getPx(grid, x, y - 1)) ||
    isTransparentIndex(getPx(grid, x, y + 1));

  const px: HalfPixel[] = [];
  for (let y = 0; y < grid.h; y += 1) {
    for (let x = 0; x < grid.w; x += 1) {
      const v = getPx(grid, x, y);
      if (isTransparentIndex(v) || Math.floor(v / BANK_SIZE) !== 0) continue;
      const l = luma(v);
      px.push({ y, l, interiorKeyline: l < NEAR_BLACK_LUMA && !touchesOpenSpace(x, y) });
    }
  }
  const ys = px.map((p) => p.y);
  const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
  return { upper: px.filter((p) => p.y < mid), lower: px.filter((p) => p.y >= mid) };
}

/** The luma-only view the mean and near-black share are taken over. */
function bodyHalves(grid: IndexGrid): { upper: number[]; lower: number[] } {
  const { upper, lower } = bodyHalfPixels(grid);
  return { upper: upper.map((p) => p.l), lower: lower.map((p) => p.l) };
}

const mean = (xs: readonly number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((s, v) => s + v, 0) / xs.length;

describe('the lifter is the brightest thing in his own frame', () => {
  it('holds more highlight pixels than the whole barbell does, at every load', () => {
    // Swept over loads because the plate hues are not equally bright: a bar
    // carrying 15 kg yellows is the brightest barbell the game can draw.
    for (const totalKg of [27.5, 60, 100, 145, 250, 400]) {
      for (const depth of [0, 0.5, 1]) {
        for (const strainLevel of [0, STRAIN.LEVELS - 1]) {
          const { grid } = renderLifterFrame(
            spec({ depth, direction: 'ASCENT', strainLevel, totalKg }),
          );
          const split = brightSplit(grid, HIGHLIGHT_LUMA);
          const where = `${totalKg}kg d${depth} s${strainLevel}`;
          expect(split.lifter, where).toBeGreaterThan(60);
          expect(split.lifter, where).toBeGreaterThan(split.equipment * 4);
        }
      }
    }
  });

  it('reaches the top of the skin ramp over a real area, not a one-pixel sliver', () => {
    // Measured at this authoring: 46-58 px of the brightest skin step per
    // frame. Before the axial term and the mark table it was 28-42, and 7 of
    // those came from the mark table's entire authored SKIN_HI budget.
    for (const depth of [0, 0.5, 1]) {
      const { grid } = renderLifterFrame(spec({ depth, direction: 'ASCENT', totalKg: 250 }));
      let hi = 0;
      for (const v of grid.data) if (v === PAL.SKIN_HI) hi += 1;
      expect(hi, `depth ${depth}`).toBeGreaterThan(30);
    }
  });

  it('carries that range BELOW the belt as well as above it', () => {
    // The finding this exists for, in the critic's words: "the value fix was
    // applied to SKIN and never to GEAR, so the figure carries the top of the
    // range only above the belt... at native the lifter reads as a bright chest
    // floating over a smear."
    //
    // Split at the figure's own vertical midpoint, which is not tuneable to
    // flatter either half. MEASURED on the same split of the blond wrestler in
    // sprite-ref-1 (masked by colour, at native scale, in this repo's sandbox):
    // upper mean luma 113.7 against lower 109.0, a ratio of 1.04. Ours was
    // 81.4 / 54.3 — a ratio of 1.50 — and is now inside the bound below.
    //
    // A RATIO, not an absolute: this test's job is to catch either half being
    // left behind by a change to the other, which is how the gap appeared in
    // both directions. Whether the figure as a whole is bright enough is a
    // different claim and belongs to a human looking at pixels.
    //
    // BRACKETED, NOT CAPPED. The cap on its own pointed one way: a darker upper
    // body satisfies it more easily, so it sat at 1.35 through every round in
    // which the arms were the only masses on the figure still ringed in
    // near-black, at a measured 0.86-1.02. See MIN_UPPER_OVER_LOWER_MEAN.
    for (const depth of [0, 0.35, 0.65, 1]) {
      for (const strainLevel of [0, STRAIN.LEVELS - 1]) {
        const { grid } = renderLifterFrame(
          spec({ depth, direction: 'ASCENT', strainLevel, totalKg: 250 }),
        );
        const { upper, lower } = bodyHalves(grid);
        const where = `depth ${depth} strain ${strainLevel}`;
        expect(lower.length, where).toBeGreaterThan(100);
        expect(upper.length, where).toBeGreaterThan(100);
        const upperMean = mean(upper);
        const lowerMean = mean(lower);
        expect(upperMean / lowerMean, `${where}: mean luma ratio`).toBeLessThan(
          MAX_UPPER_OVER_LOWER_MEAN,
        );
        expect(upperMean / lowerMean, `${where}: mean luma ratio`).toBeGreaterThan(
          MIN_UPPER_OVER_LOWER_MEAN,
        );
        // And the near-black that used to fill the lower body: half of it was
        // separation line at luma 19, against 4% on the reference's own lower
        // half. Floored well above the reference so the silhouette keyline,
        // which we keep and it does not have, is not squeezed out.
        const nearBlack = lower.filter((v) => v < NEAR_BLACK_LUMA).length / lower.length;
        expect(nearBlack, `${where}: near-black share below the midpoint`).toBeLessThan(
          MAX_LOWER_NEAR_BLACK_SHARE,
        );
      }
    }
  });

  it('carries it ABOVE the belt too: the arms are not the darkest thing on him', () => {
    // THE FIFTEENTH BLIND CHECK, IN THE CRITIC'S WORDS: "the near-black keyline
    // fix was applied below the belt and deliberately withheld above it — and
    // the reference puts its brightest pixels on the arms." Nothing in this
    // suite could see it. The near-black share was measured on `lower` only,
    // and the one upper/lower assertion was a CAP, which a darker upper body
    // satisfies more easily rather than less.
    //
    // Measured with the arms, hands, neck and head still on the default
    // near-black ring, at 250 kg over this sweep: near-black 38.0-43.2% of the
    // upper half, of which 29.3-36.0 points were interior. The same interior
    // figure below the belt, where the fix had already landed, was 0.3-7.2%.
    // Against sprite-ref-1's own upper half at 1.3%.
    for (const depth of [0, 0.35, 0.65, 1]) {
      for (const strainLevel of [0, STRAIN.LEVELS - 1]) {
        const { grid } = renderLifterFrame(
          spec({ depth, direction: 'ASCENT', strainLevel, totalKg: 250 }),
        );
        const { upper, lower } = bodyHalfPixels(grid);
        const where = `depth ${depth} strain ${strainLevel}`;
        expect(upper.length, where).toBeGreaterThan(100);
        expect(lower.length, where).toBeGreaterThan(100);

        const nearBlack = upper.filter((p) => p.l < NEAR_BLACK_LUMA).length / upper.length;
        expect(nearBlack, `${where}: near-black share above the midpoint`).toBeLessThan(
          MAX_UPPER_NEAR_BLACK_SHARE,
        );

        // The sharp one. A near-black pixel every one of whose neighbours is
        // body is a line drawn inside the figure, not the silhouette keyline,
        // and it is the thing the reference has none of on a limb.
        for (const [name, half] of [
          ['above', upper],
          ['below', lower],
        ] as const) {
          const interior = half.filter((p) => p.interiorKeyline).length / half.length;
          expect(interior, `${where}: interior keyline share ${name} the midpoint`).toBeLessThan(
            MAX_INTERIOR_KEYLINE_SHARE,
          );
        }
      }
    }
  });

  it('keeps the collar a dim block with one specular pixel, not a bright block', () => {
    // The collars used to paint ~20 px of the brightest steel at each end of
    // the bar. CHROME_HI existed only in the palette and in a comment claiming
    // it was "reserved for a single specular pixel"; nothing drew it.
    const { grid } = renderLifterFrame(spec({ totalKg: 250 }));
    let chrome = 0;
    let steelLight = 0;
    for (const v of grid.data) {
      if (v === PAL.CHROME_HI) chrome += 1;
      if (v === PAL.STEEL_LIGHT) steelLight += 1;
    }
    expect(chrome).toBeGreaterThan(0);
    expect(chrome).toBeLessThan(8);
    expect(steelLight).toBe(0);
  });
});

describe('bar geometry', () => {
  it('bends nothing at the centre and exactly the bend amount at the tip', () => {
    expect(barOffsetAt(0, 0, 3)).toBe(0);
    expect(barOffsetAt(BAR.HALF_SPAN_PX, 0, 3)).toBeCloseTo(3, 9);
    expect(barOffsetAt(-BAR.HALF_SPAN_PX, 0, 3)).toBeCloseTo(3, 9);
  });

  it('keeps the shaft between the sleeves nearly flat', () => {
    // Exponent 2 means a loaded bar bows at the sleeves, not uniformly. At the
    // sleeve boundary the droop must still be a small fraction of the tip's.
    const atShaft = barOffsetAt(BAR.SHAFT_HALF_PX, 0, 3);
    const atTip = barOffsetAt(BAR.HALF_SPAN_PX, 0, 3);
    expect(atShaft / atTip).toBeLessThan(0.25);
    expect(BEND.EXPONENT).toBeGreaterThan(1);
  });

  it('tilts linearly and antisymmetrically', () => {
    expect(barOffsetAt(10, 2, 0)).toBeCloseTo(-barOffsetAt(-10, 2, 0), 9);
    expect(barOffsetAt(20, 2, 0)).toBeCloseTo(2 * barOffsetAt(10, 2, 0), 9);
  });

  it('spans a real competition bar', () => {
    // 2 * 38 px at 34.29 px/m is 2.216 m against a 2.2 m bar.
    const metres = (2 * BAR.HALF_SPAN_PX) / (RESOLUTION.LIFTER_HEIGHT_PX / 1.75);
    expect(metres).toBeGreaterThan(2.15);
    expect(metres).toBeLessThan(2.3);
  });

  it('keeps the bar glued to the shoulders at every depth', () => {
    for (const depth of [0, 0.25, 0.5, 0.75, 1]) {
      const rendered = renderLifterFrame(spec({ depth }));
      const pose = poseAtDepth(depth, 'DESCENT');
      expect(rendered.barCenterY).toBeCloseTo(pose.shoulderY - BAR.SHOULDER_OFFSET_PX, 9);
    }
  });

  it('drops the bar the distance a real squat drops it', () => {
    const stand = renderLifterFrame(spec({ depth: 0 })).barCenterY;
    const hole = renderLifterFrame(spec({ depth: 1 })).barCenterY;
    const metres = (hole - stand) / (RESOLUTION.LIFTER_HEIGHT_PX / 1.75);
    expect(metres).toBeGreaterThan(0.35);
    expect(metres).toBeLessThan(0.55);
  });
});

describe('depth is honest', () => {
  it('puts the hip below the knee at the bottom, and above it standing', () => {
    // Screen y grows downward, so "hip crease below the top of the knee" — the
    // actual judging criterion — is hipY > kneeY here.
    expect(POSES.HOLE.hipY).toBeGreaterThan(POSES.HOLE.kneeY);
    expect(POSES.STAND.hipY).toBeLessThan(POSES.STAND.kneeY);
  });

  it('never moves the bar by one pixel at any strain or pitch level', () => {
    // The load response is allowed to make him uglier. It is not allowed to
    // move the bar, because the bar's height IS the squat's depth. Every
    // combination of the two channels must land on the same centre-line.
    for (const depth of [0, 0.25, 0.5, 0.75, 1]) {
      for (const direction of ['DESCENT', 'ASCENT'] as const) {
        const expected = renderLifterFrame(
          spec({ depth, direction, strainLevel: 0, pitchLevel: 0 }),
        ).barCenterY;
        for (let s = 0; s < STRAIN.LEVELS; s += 1) {
          for (let p = 0; p < PITCH.LEVELS; p += 1) {
            const at = renderLifterFrame(
              spec({ depth, direction, strainLevel: s, pitchLevel: p }),
            );
            expect(at.barCenterY, `d${depth} ${direction} s${s} p${p}`).toBe(expected);
            expect(at.pose.shoulderY, `d${depth} ${direction} s${s} p${p}`).toBe(
              poseAtDepth(depth, direction).shoulderY,
            );
          }
        }
      }
    }
  });

  it('never lets strain raise a hip that was below the knee back above it', () => {
    // The second judging cue. HIP_SHOOT raises the hip, so without a guard a
    // maximally strained frame in the hole could draw itself out of depth —
    // uglier is fine, shallower is not.
    for (const [key, pose] of Object.entries(POSES)) {
      if (pose.hipY <= pose.kneeY) continue;
      for (let s = 0; s <= 1.0001; s += 0.1) {
        for (let p = 0; p <= 1.0001; p += 0.25) {
          const out = deformPose(pose, Math.min(1, s), Math.min(1, p));
          expect(out.hipY, `${key} s${s.toFixed(1)} p${p.toFixed(2)}`).toBeGreaterThan(out.kneeY);
        }
      }
    }
  });

  it('never lets the knees cave inside the hips, at any strain', () => {
    for (const [key, pose] of Object.entries(POSES)) {
      for (let s = 0; s <= 1.0001; s += 0.1) {
        const out = deformPose(pose, Math.min(1, s), 1);
        expect(out.kneeHalfW, `${key} s${s.toFixed(1)}`).toBeGreaterThan(0);
        expect(out.kneeHalfW, `${key} s${s.toFixed(1)}`).toBeGreaterThanOrEqual(
          Math.min(pose.kneeHalfW, out.hipHalfW * STRAIN.KNEE_MIN_VS_HIP) - 1e-9,
        );
      }
    }
  });

  it('descends monotonically along both pose ladders', () => {
    for (const direction of ['DESCENT', 'ASCENT'] as const) {
      let prev = -Infinity;
      for (let d = 0; d <= 1.0001; d += 0.05) {
        const y = poseAtDepth(Math.min(1, d), direction).shoulderY;
        expect(y, `${direction} at depth ${d.toFixed(2)}`).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = y;
      }
    }
  });

  it('draws the way up differently from the way down at the same depth', () => {
    const down = renderLifterFrame(spec({ depth: 0.66, direction: 'DESCENT' }));
    const up = renderLifterFrame(spec({ depth: 0.66, direction: 'ASCENT' }));
    expect(gridsEqual(down.grid, up.grid)).toBe(false);
  });
});

describe('scaling and colour conversion', () => {
  it('upscales by exact pixel replication', () => {
    const { grid } = renderLifterFrame(spec());
    const up = upscaleGrid(grid, 6);
    expect(up.w).toBe(grid.w * 6);
    expect(up.h).toBe(grid.h * 6);
    for (let y = 0; y < up.h; y += 1) {
      for (let x = 0; x < up.w; x += 1) {
        expect(getPx(up, x, y)).toBe(getPx(grid, Math.floor(x / 6), Math.floor(y / 6)));
      }
    }
  });

  it('introduces no colour that is not in the palette', () => {
    const { grid } = renderLifterFrame(spec({ totalKg: 250, strainLevel: 3, depth: 0.66 }));
    const rgba = gridToRgba(grid);
    const allowed = new Set<string>();
    for (const index of usedIndices(grid)) {
      const c = colorAt(index);
      if (c === undefined) continue;
      allowed.add(rgb5ToRgb8(c).join(','));
    }
    for (let i = 0; i < grid.data.length; i += 1) {
      const alpha = rgba[i * 4 + 3] ?? 0;
      if (isTransparentIndex(grid.data[i] ?? 0)) {
        expect(alpha).toBe(0);
        continue;
      }
      expect(alpha).toBe(255);
      const key = [rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]].join(',');
      expect(allowed.has(key), `stray colour ${key}`).toBe(true);
    }
  });

  it('produces no partial alpha anywhere — there is no anti-aliasing', () => {
    const { grid } = renderLifterFrame(spec({ totalKg: 250 }));
    const rgba = gridToRgba(grid);
    for (let i = 3; i < rgba.length; i += 4) {
      expect([0, 255]).toContain(rgba[i]);
    }
  });
});

// ---------------------------------------------------------------------------
// KIT IS A DARK OBJECT ON A LIT LEG, NOT THE LEG
//
// `palette.ts` states this rule about itself where it decides not to push
// GEAR_LIGHT past SKIN_LIGHT: "Sleeves, belts and shoes are black kit in this
// sport; they must read as dark objects ON a lit leg, not as the leg." The
// renderer broke it, and nothing in the suite could tell.
//
// ---------------------------------------------------------------------------
// WHY THIS BLOCK WAS REWRITTEN: THE MEASUREMENT WAS BLIND, NOT THE RENDERER
// ---------------------------------------------------------------------------
// The previous version of these tests decided inversion with
// `Math.max(...thigh) <= Math.max(...sleeve)` over the WHOLE thigh capsule, and
// reported 0 inverted over a 112-pose sweep while a rendered frame showed the
// lower body as one dark mass with the two grey sleeves the brightest objects
// below the belt. Three separate holes, all of the same shape:
//
//   1. A MAX IS NOT A READ. Two surviving pixels clear any max test. The thigh
//      capsule runs up UNDER the singlet to the hip, where the glute flare
//      beside the belt keeps a couple of SKIN_LIGHT pixels at every depth. The
//      claim is about the band of bare leg between the singlet hem and the
//      sleeve, so the measurement now takes only pixels at or below
//      `singletHemY`, and it takes a MEDIAN and an AREA SHARE, not a max.
//   2. THE THIGH IS NOT THE LEG. At squat depth the femur is drawn 6-8 px long
//      and its visible bare band is 2-26 px, while the bare SHIN is 37-50 px —
//      two to four times as much of what the player actually looks at. A test
//      that only ever asked about the thigh could not see the mass that was
//      dark. Thigh and shin are now counted and asserted SEPARATELY.
//   3. `if (sleeve.length === 0) continue;` SKIPPED INSTEAD OF FAILING. Every
//      quantity this block compares now has a floor asserted on its pixel
//      count, so a pose that stops drawing a sleeve, a shin or a thigh fails
//      here instead of quietly removing itself from the sweep. The knee-sleeve
//      MARKS are asserted to land as well, so deleting them from the mark table
//      fails this block rather than passing it.
//
// MEASURED ON THE BUILD THIS REWRITE FIXES, over 288 poses x 2 legs, using
// exactly the helper below:
//
//                                              before      after
//   min median of the visible bare thigh          73         117
//   min median of the visible bare shin           73         117
//   max median of the knee sleeve                101          59
//   brightest single sleeve pixel                149         101
//   min (leg median - sleeve median)              14          58
//   min share of visible thigh >= SKIN_LIGHT    0.000       0.333
//   min share of visible shin  >= SKIN_LIGHT    0.100       0.422
//
// 73 is SKIN_SHADOW, the floor of the skin ramp, and 149 is GEAR_LIGHT. So on
// the old build there were poses where the median pixel of the bare leg was the
// darkest colour the skin ramp has while the brightest pixel of the kit worn on
// it was 76 luma above that, and no test in the suite failed.
//
// The invariant is swept over the pose space rather than checked on one frame,
// and asserted per LEG rather than per frame, because the two legs are at
// different angles and it was always one of them that fell out first.
// ---------------------------------------------------------------------------

/**
 * Floors and margins for the block below. Named here rather than typed into the
 * assertions because every one of them is a claim about how the lower body
 * should read, and the numbers next to them are what the current build measures
 * at its worst pose — so the headroom each floor leaves is visible.
 */
const LEG_READ = {
  /** Bare thigh and bare shin must each clear the sleeve's median by this. */
  MIN_LEG_OVER_KIT_LUMA: 44,
  /** Share of the visible bare thigh at or above SKIN_LIGHT. Worst: 0.333. */
  MIN_LIT_SHARE_THIGH: 0.25,
  /** Share of the visible bare shin at or above SKIN_LIGHT. Worst: 0.422. */
  MIN_LIT_SHARE_SHIN: 0.33,
  /** Share of the whole visible bare leg at or above SKIN_LIGHT. Worst: 0.476. */
  MIN_LIT_SHARE_LEG: 0.38,
  // --- anti-vacuity floors. Every comparison above divides by one of these. ---
  /**
   * Visible bare thigh pixels. TWO, and it has to stay two: at full depth a
   * front-on thigh really is about two rows tall once the hem and the sleeve
   * have closed over it (see RIG_GEOMETRY.ATTACH.SINGLET_HEM_ALONG_THIGH).
   * Worst over the sweep: 2, at DESCENT depth 0.66 strain 3 pitch 1.
   */
  MIN_THIGH_PX: 2,
  /** Visible bare shin pixels. Worst: 37. */
  MIN_SHIN_PX: 20,
  /** Knee-sleeve pixels. Worst: 53. */
  MIN_SLEEVE_PX: 30,
} as const;

const SKIN_INDICES = new Set([
  PAL.SKIN_SHADOW,
  PAL.SKIN_MID,
  PAL.SKIN_LIGHT,
  PAL.SKIN_HI,
  PAL.SKIN_FLUSH,
]);
const GEAR_INDICES = new Set([PAL.GEAR_DARK, PAL.GEAR_MID, PAL.GEAR_LIGHT]);

/** Is (x,y) inside the capsule this rasteriser would have drawn? */
function inCapsule(
  x: number,
  y: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  ra: number,
  rb: number,
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return false;
  const ux = dx / len;
  const uy = dy / len;
  const rx = x - ax;
  const ry = y - ay;
  const t = Math.min(1, Math.max(0, (rx * ux + ry * uy) / len));
  const r = ra + (rb - ra) * t;
  const perp = rx * -uy + ry * ux;
  const along = rx * ux + ry * uy;
  const overA = along < 0 ? -along : 0;
  const overB = along > len ? along - len : 0;
  return Math.hypot(perp, overA + overB) <= r;
}

interface LegValues {
  /** Bare thigh the player can see: skin, in the femur capsule, below the hem. */
  readonly thigh: number[];
  /** Bare shin the player can see: skin, in the shin capsule. */
  readonly shin: number[];
  /** Knee sleeve: gear, in the sleeve capsule as drawn (radius plus its ring). */
  readonly sleeve: number[];
}

/**
 * What ONE LEG of a rendered frame is actually showing, by luma.
 *
 * Classification is by DRAWN PIXEL, not by geometry alone: a pixel counts as
 * bare thigh only if a skin index survived there, which means the singlet, the
 * belt, the sleeve and the shoe have all already been drawn over it and did not
 * cover it. Geometry only says WHICH mass a surviving pixel belongs to.
 *
 * The hem cut on the thigh is the part that matters. Without it the femur
 * capsule reaches up past the singlet to the hip, where two or three pixels of
 * lit glute flare sit beside the belt at every depth — and those two pixels
 * were enough to satisfy every max-based assertion this block used to make
 * while the drawn thigh was inverted everywhere the player looks.
 */
function legValues(grid: IndexGrid, pose: Pose, sign: number): LegValues {
  const span = kneeSleeveSpan(pose, sign);
  const KS = RIG_GEOMETRY.KNEE_SLEEVE;
  const hipX = CENTER_X + sign * pose.hipHalfW * RIG_GEOMETRY.ATTACH.THIGH_ROOT;
  const kneeX = CENTER_X + sign * pose.kneeHalfW;
  const ankleX = CENTER_X + sign * pose.ankleHalfW;
  const TR = RIG_GEOMETRY.THIGH_R;
  const SR = RIG_GEOMETRY.SHIN_R;
  const hem = singletHemY(pose);
  const thigh: number[] = [];
  const shin: number[] = [];
  const sleeve: number[] = [];
  for (let y = 0; y < grid.h; y += 1) {
    for (let x = 0; x < grid.w; x += 1) {
      const v = getPx(grid, x, y);
      if (isTransparentIndex(v)) continue;
      if (GEAR_INDICES.has(v)) {
        // Plus one radius: `PartOptions.edge` grows the drawn sleeve by its ring.
        if (
          inCapsule(x, y, span.topX, span.topY, span.botX, span.botY, KS.R[0] + 1, KS.R[1] + 1)
        ) {
          sleeve.push(luma(v));
        }
        continue;
      }
      if (!SKIN_INDICES.has(v)) continue;
      const shinEndY = pose.ankleY + RIG_GEOMETRY.FOOT_DROP - (SR[1] ?? 0);
      if (inCapsule(x, y, kneeX, pose.kneeY, ankleX, shinEndY, SR[0] ?? 0, SR[1] ?? 0)) {
        shin.push(luma(v));
        continue;
      }
      if (y >= hem && inCapsule(x, y, hipX, pose.hipY, kneeX, pose.kneeY, TR[0] ?? 0, TR[1] ?? 0)) {
        thigh.push(luma(v));
      }
    }
  }
  return { thigh, shin, sleeve };
}

/** Middle value. An area statistic, which is the whole point — see the block. */
function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/** Share of `values` at or above `floor`. */
function shareAtLeast(values: readonly number[], floor: number): number {
  if (values.length === 0) return 0;
  return values.filter((v) => v >= floor).length / values.length;
}

/** Every leg pose the animation can reach, as (spec, label) pairs. */
function poseSweep(): { spec: LifterFrameSpec; where: string }[] {
  const out: { spec: LifterFrameSpec; where: string }[] = [];
  for (const direction of ['DESCENT', 'ASCENT'] as const) {
    for (const depth of [0, 0.15, 0.33, 0.5, 0.66, 0.75, 0.86, 0.93, 1]) {
      for (let strainLevel = 0; strainLevel < STRAIN.LEVELS; strainLevel += 1) {
        for (let pitchLevel = 0; pitchLevel < PITCH.LEVELS; pitchLevel += 1) {
          out.push({
            spec: spec({ depth, direction, strainLevel, pitchLevel, totalKg: 250 }),
            where: `${direction} d${depth} s${strainLevel} p${pitchLevel}`,
          });
        }
      }
    }
  }
  return out;
}

describe('a knee sleeve reads as a dark object on a lit leg', () => {
  it('finds a sleeve, a thigh and a shin to compare at every pose', () => {
    // THE ANTI-VACUITY TEST, and it exists because the version of this block it
    // replaces did not have one on the sleeve side: `if (sleeve.length === 0)
    // continue;` silently removed a pose from the sweep instead of failing, so
    // every comparison below it was conditional on a quantity nothing checked.
    // Run this first: if it fails, nothing else in this block means anything.
    const sweep = poseSweep();
    expect(sweep.length).toBeGreaterThan(100);
    for (const { spec: s, where } of sweep) {
      const { grid, pose } = renderLifterFrame(s);
      for (const sign of [-1, 1]) {
        const leg = `${where} ${sign > 0 ? 'far' : 'near'}`;
        const { thigh, shin, sleeve } = legValues(grid, pose, sign);
        expect(sleeve.length, `${leg}: knee-sleeve px`).toBeGreaterThanOrEqual(
          LEG_READ.MIN_SLEEVE_PX,
        );
        expect(thigh.length, `${leg}: visible bare thigh px`).toBeGreaterThanOrEqual(
          LEG_READ.MIN_THIGH_PX,
        );
        expect(shin.length, `${leg}: visible bare shin px`).toBeGreaterThanOrEqual(
          LEG_READ.MIN_SHIN_PX,
        );
      }
    }
  });

  it('carries its authored band and hem, not just a shaded tube', () => {
    // The other half of anti-vacuity, and the one that answers "what if the
    // sleeve stopped being an object at all". A sleeve resolved purely by the
    // shading model is a grey capsule; what makes it read as a worn thing is
    // the top band and the hem in `spriteMarks.ts`. Deleting those two marks
    // from the table has to fail a test somewhere in this block, and it is this
    // one — `renderLifterFrame` reports what each mark actually painted, so an
    // absent mark is an absent entry rather than a zero.
    const BANDED = ['KNEE_SLEEVE_TOP_BAND', 'KNEE_SLEEVE_HEM'];
    for (const depth of [0, 0.33, 0.66, 0.86, 1]) {
      for (const direction of ['DESCENT', 'ASCENT'] as const) {
        const { marks } = renderLifterFrame(spec({ depth, direction, totalKg: 250 }));
        for (const name of BANDED) {
          const placement = marks.find((m) => m.name === name);
          expect(placement, `${name} missing from the mark table at ${direction} ${depth}`)
            .toBeDefined();
          expect(placement?.painted ?? 0, `${name} painted at ${direction} ${depth}`)
            .toBeGreaterThan(0);
        }
      }
    }
  });

  it('never out-values the bare leg it is worn on, by area, anywhere in the pose space', () => {
    // BY MEDIAN AND BY THE BRIGHTEST SLEEVE PIXEL, not by two maxima. The
    // question a player answers by looking is "which of these is the lit thing"
    // and that is decided by area, so the sleeve's median has to sit a real
    // distance under the leg's median AND its single brightest pixel has to
    // stay under the leg's median too. Thigh and shin are asked separately
    // because at depth the shin is most of the bare leg and the thigh is a
    // sliver, and an average over both would let the shin carry the thigh.
    const sweep = poseSweep();
    const inverted: string[] = [];
    for (const { spec: s, where } of sweep) {
      const { grid, pose } = renderLifterFrame(s);
      for (const sign of [-1, 1]) {
        const leg = `${where} ${sign > 0 ? 'far' : 'near'}`;
        const { thigh, shin, sleeve } = legValues(grid, pose, sign);
        const kit = median(sleeve);
        const kitTop = Math.max(...sleeve);
        for (const [name, flesh] of [
          ['thigh', thigh],
          ['shin', shin],
        ] as const) {
          const skin = median(flesh);
          if (skin - kit < LEG_READ.MIN_LEG_OVER_KIT_LUMA) {
            inverted.push(`${leg} ${name}: median ${skin} vs sleeve ${kit}`);
          }
          if (kitTop >= skin) {
            inverted.push(`${leg} ${name}: brightest sleeve px ${kitTop} vs median ${skin}`);
          }
        }
      }
    }
    expect(inverted.slice(0, 8), `${inverted.length}/${sweep.length * 2} leg-poses inverted`)
      .toEqual([]);
  });

  it('keeps the bent leg lit by area, not only at lockout', () => {
    // THE POSE-DRIVEN HALF. The blind A/B's finding was a contrast between two
    // frames of the same rep at the same load: legs straight, five clean bands
    // from hem to shoe; legs bent, one dark mass. Bent legs are most of the
    // animation, so the claim is about the bent frames specifically and it is a
    // claim about AREA — what share of the bare leg reaches the step a lit leg
    // has to reach — rather than about whether any single pixel gets there.
    const LIT = luma(PAL.SKIN_LIGHT);
    const failures: string[] = [];
    for (const { spec: s, where } of poseSweep()) {
      const { grid, pose } = renderLifterFrame(s);
      for (const sign of [-1, 1]) {
        const leg = `${where} ${sign > 0 ? 'far' : 'near'}`;
        const { thigh, shin } = legValues(grid, pose, sign);
        const checks: readonly (readonly [string, readonly number[], number])[] = [
          ['thigh', thigh, LEG_READ.MIN_LIT_SHARE_THIGH],
          ['shin', shin, LEG_READ.MIN_LIT_SHARE_SHIN],
          ['leg', [...thigh, ...shin], LEG_READ.MIN_LIT_SHARE_LEG],
        ];
        for (const [name, values, floor] of checks) {
          const lit = shareAtLeast(values, LIT);
          if (lit < floor) {
            failures.push(`${leg} ${name}: ${lit.toFixed(3)} of ${values.length} px lit, want ${floor}`);
          }
        }
      }
    }
    expect(failures.slice(0, 8), `${failures.length} leg-poses below the lit floor`).toEqual([]);
  });

  it('does not get darker when the leg bends', () => {
    // The direction of the defect, stated as its own claim. Whatever the
    // absolute numbers are, the deep frames may not read darker than the
    // standing one — that inversion is what "collapses into one dark mass the
    // moment the leg bends" means, and it is invisible to any test that only
    // looks at one pose.
    const litShare = (depth: number, direction: 'DESCENT' | 'ASCENT'): number => {
      const { grid, pose } = renderLifterFrame(spec({ depth, direction, totalKg: 250 }));
      const all: number[] = [];
      for (const sign of [-1, 1]) {
        const { thigh, shin } = legValues(grid, pose, sign);
        all.push(...thigh, ...shin);
      }
      expect(all.length, `${direction} ${depth}: bare leg px`).toBeGreaterThan(
        2 * (LEG_READ.MIN_THIGH_PX + LEG_READ.MIN_SHIN_PX),
      );
      return shareAtLeast(all, luma(PAL.SKIN_LIGHT));
    };
    const standing = litShare(0, 'DESCENT');
    // A one-ramp-step allowance, expressed as area rather than as value: a bent
    // frame may give up some lit share to the geometry — the thigh really does
    // fold away — but not most of it.
    const FLOOR = standing * 0.8;
    for (const depth of [0.33, 0.5, 0.66, 0.75, 0.86, 1]) {
      for (const direction of ['DESCENT', 'ASCENT'] as const) {
        expect(litShare(depth, direction), `${direction} depth ${depth} vs standing ${standing.toFixed(3)}`)
          .toBeGreaterThanOrEqual(FLOOR);
      }
    }
  });
});

describe('femur foreshortening', () => {
  it('is zero standing and high everywhere below a quarter depth', () => {
    // NOT monotonic in depth, and the test says so rather than pretending: the
    // drawn femur is shortest around three-quarter depth (6.0 px) and grows
    // again in the hole (7.8 px), because down there the hip drops BELOW the
    // knee and the two landmarks separate on screen once more. Measured over
    // the ladder: 0 standing, 0.38-0.50 at a tenth, 0.73-0.87 at 0.4, peaking
    // 0.92 at 0.75, 0.86 at the bottom.
    expect(femurTilt(POSES.STAND, -1)).toBe(0);
    expect(femurTilt(POSES.STAND, 1)).toBe(0);
    for (const direction of ['DESCENT', 'ASCENT'] as const) {
      expect(femurTilt(poseAtDepth(0.1, direction), -1), `${direction} 0.1`).toBeGreaterThan(0.35);
      for (const depth of [0.4, 0.5, 0.62, 0.75, 0.86, 1]) {
        const tilt = femurTilt(poseAtDepth(depth, direction), -1);
        expect(tilt, `${direction} ${depth}`).toBeGreaterThan(0.7);
        expect(tilt).toBeLessThanOrEqual(1);
      }
    }
  });

  it('clamps rather than inverting when the strain deform stretches the thigh', () => {
    // STRAIN pushes the hips back and lengthens the drawn femur past its STAND
    // length. A bone longer than itself is not tilted the other way.
    const stretched = deformPose(POSES.STAND, 1, 0);
    expect(femurTilt(stretched, -1)).toBe(0);
    expect(femurTilt(stretched, 1)).toBe(0);
  });

  it('measures its reference length off the drawing rather than a typed number', () => {
    const pose = POSES.STAND;
    const hipX = CENTER_X + -1 * pose.hipHalfW * RIG_GEOMETRY.ATTACH.THIGH_ROOT;
    const kneeX = CENTER_X + -1 * pose.kneeHalfW;
    expect(FEMUR_FRONTAL_LEN_PX).toBeCloseTo(
      Math.hypot(kneeX - hipX, pose.kneeY - pose.hipY),
      12,
    );
  });
});

describe('inspection layers', () => {
  it('fills the stage completely so a sprite always has a floor', () => {
    const stage = renderStage();
    expect(coverage(stage)).toBe(1);
  });

  it('grounds the lifter with a shadow that narrows as he descends', () => {
    const stand = coverage(renderContactShadow(poseAtDepth(0, 'DESCENT'), 0));
    const bottom = coverage(renderContactShadow(poseAtDepth(1, 'DESCENT'), 1));
    expect(stand).toBeGreaterThan(0);
    expect(bottom).toBeLessThan(stand);
  });
});
