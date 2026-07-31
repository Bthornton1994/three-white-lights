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
import { BAR, BEND, LOAD_PRESETS, PITCH, RESOLUTION, STRAIN } from './spriteTuning';
import { POSES, deformPose, poseAtDepth } from './rig';

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
