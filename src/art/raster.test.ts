/**
 * Guards on the rasteriser's shading model.
 *
 * The finding these exist for was structural rather than cosmetic. `drawLimb`
 * shaded every pixel from `perp` — the across-limb offset — and used the axial
 * term only to clamp the capsule's rounded ends. Every cross-section of a limb
 * therefore resolved to the same ramp step as every other, so the lit flank was
 * a CONSTANT COLUMN from one joint to the other by construction, on the thigh,
 * the shin, the forearm and the neck alike. No amount of hand-placed marks
 * fixes that: a mark is a handful of pixels and this was the whole limb.
 *
 * So the assertions below are about the shape of the value structure, not about
 * any particular pixel, and the flat-profile case is kept as an explicit
 * counterexample: it reproduces the old behaviour exactly, which is what makes
 * the first test a claim about the fix rather than a claim about nothing.
 */

import { describe, expect, it } from 'vitest';
import {
  axialTerm,
  createGrid,
  drawLimb,
  getPx,
  lambert,
  shadeToIndex,
  type IndexGrid,
} from './raster';
import { PAL, RAMPS } from './palette';
import { SHADING } from './spriteTuning';

const SKIN_STEP = [PAL.SKIN_SHADOW, PAL.SKIN_MID, PAL.SKIN_LIGHT, PAL.SKIN_HI];

/** Ramp step at a pixel, or -1 if it is not skin. */
function stepAt(g: IndexGrid, x: number, y: number): number {
  return SKIN_STEP.indexOf(getPx(g, x, y));
}

/** The most ramp steps any single column of the limb passes through. */
function maxStepsDownAColumn(g: IndexGrid): number {
  let best = 0;
  for (let x = 0; x < g.w; x += 1) {
    const seen = new Set<number>();
    for (let y = 0; y < g.h; y += 1) {
      const s = stepAt(g, x, y);
      if (s >= 0) seen.add(s);
    }
    best = Math.max(best, seen.size);
  }
  return best;
}

function verticalLimb(axial?: typeof SHADING.AXIAL_LIMB): IndexGrid {
  const g = createGrid(24, 44);
  drawLimb(g, 12, 6, 12, 38, 3.2, 3.2, RAMPS.SKIN, axial === undefined ? {} : { axial });
  return g;
}

describe('axialTerm', () => {
  it('peaks at the muscle belly', () => {
    const p = SHADING.AXIAL_LIMB;
    const atBelly = axialTerm(p, p.BELLY_FRAC);
    for (const t of [0.0, 0.1, 0.2, 0.55, 0.7, 0.9, 1.0]) {
      expect(axialTerm(p, t), `t=${t}`).toBeLessThan(atBelly);
    }
    expect(atBelly).toBeGreaterThan(0);
  });

  it('darkens both ends, where the joints are', () => {
    const p = SHADING.AXIAL_LIMB;
    expect(axialTerm(p, 0)).toBeLessThan(0);
    expect(axialTerm(p, 1)).toBeLessThan(0);
  });

  it('clamps outside 0..1 rather than extrapolating off the limb', () => {
    const p = SHADING.AXIAL_LIMB;
    expect(axialTerm(p, -5)).toBeCloseTo(axialTerm(p, 0), 12);
    expect(axialTerm(p, 5)).toBeCloseTo(axialTerm(p, 1), 12);
  });

  it('is exactly zero everywhere for the flat profile', () => {
    // AXIAL_FLAT is what worn kit uses. If it ever stopped being a no-op, every
    // belt and shoe would pick up a belly bump.
    for (let t = 0; t <= 1.0001; t += 0.05) {
      expect(axialTerm(SHADING.AXIAL_FLAT, Math.min(1, t))).toBe(0);
    }
  });
});

describe('a limb is not a longitudinal stripe', () => {
  it('changes ramp step DOWN a column, not only across one', () => {
    expect(maxStepsDownAColumn(verticalLimb())).toBeGreaterThan(1);
  });

  it('would be a constant column without the axial term — the old behaviour', () => {
    // The counterexample. With a flat profile the shading is a pure function of
    // the across-limb offset, so a column of a straight limb has exactly one
    // value in it. This is what every limb in every frame used to look like.
    expect(maxStepsDownAColumn(verticalLimb(SHADING.AXIAL_FLAT))).toBe(1);
  });

  it('reaches the top of the skin ramp only near the muscle belly', () => {
    // THRESHOLDS_4's top entry sits above a cylinder's peak Lambert on purpose,
    // so the brightest skin step is unreachable from the surface normal alone.
    // A limb gets there where the belly lifts it and nowhere else — which is
    // what makes the highlight a cluster instead of a one-pixel sliver running
    // the whole length of the limb.
    const g = verticalLimb();
    const rows: number[] = [];
    for (let y = 0; y < g.h; y += 1) {
      for (let x = 0; x < g.w; x += 1) {
        if (getPx(g, x, y) === PAL.SKIN_HI) {
          rows.push(y);
          break;
        }
      }
    }
    expect(rows.length).toBeGreaterThan(0);
    const top = 6;
    const bottom = 38;
    const first = (Math.min(...rows) - top) / (bottom - top);
    const last = (Math.max(...rows) - top) / (bottom - top);
    expect(last - first).toBeLessThan(0.6);
    expect(first).toBeGreaterThan(0.05);
    expect(last).toBeLessThan(0.85);
  });
});

describe('the quantiser', () => {
  it('steps up at the documented thresholds and never off the end of a ramp', () => {
    const ramp = RAMPS.SKIN;
    const [t0, t1, t2] = SHADING.THRESHOLDS_4;
    expect(shadeToIndex(ramp, 0)).toBe(ramp[0]);
    expect(shadeToIndex(ramp, (t0 ?? 0) + 1e-6)).toBe(ramp[1]);
    expect(shadeToIndex(ramp, (t1 ?? 0) + 1e-6)).toBe(ramp[2]);
    expect(shadeToIndex(ramp, (t2 ?? 0) + 1e-6)).toBe(ramp[3]);
    expect(shadeToIndex(ramp, 1, +9)).toBe(ramp[ramp.length - 1]);
    expect(shadeToIndex(ramp, 1, -9)).toBe(ramp[0]);
  });

  it('keeps the far-limb bias a real step down, not a rounding artefact', () => {
    const ramp = RAMPS.SKIN;
    const lit = 1;
    expect(shadeToIndex(ramp, lit, SHADING.FAR_LIMB_STEP_BIAS)).not.toBe(
      shadeToIndex(ramp, lit, 0),
    );
  });
});

describe('the key light', () => {
  it('never mirrors: the same lamp lights both flanks from the same side', () => {
    // A normal tilted toward screen-left is lit harder than its mirror image.
    const left = lambert(-0.6, -0.2, Math.sqrt(1 - 0.36 - 0.04));
    const right = lambert(0.6, -0.2, Math.sqrt(1 - 0.36 - 0.04));
    expect(left).toBeGreaterThan(right);
  });

  it('lifts the unlit side off the outline with ambient', () => {
    expect(lambert(0, 0, -1)).toBe(SHADING.AMBIENT);
  });
});
