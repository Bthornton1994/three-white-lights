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
  cameraBlendForTilt,
  createGrid,
  cylinderPeakLit,
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

// ---------------------------------------------------------------------------
// A LIMB'S VALUE BAND MUST NOT BE A FUNCTION OF THE ANGLE IT IS DRAWN AT
//
// The cylinder model's peak Lambert is the light's component perpendicular to
// the axis, so it collapses for a limb pointing at the lamp. Measured under
// this lamp: 0.83 for a vertical limb against 0.67 at 45 degrees — enough to
// drop a limb a whole ramp step across its entire width purely because of the
// angle it happens to be drawn at, and enough that a bent thigh could not reach
// the top skin step at all. `SHADING.FORESHORTEN` is the correction; these are
// the arithmetic that justifies it and the guards on the correction itself.
// ---------------------------------------------------------------------------

const DEG = Math.PI / 180;

describe('the cylinder model is angle-dependent, which is why FORESHORTEN exists', () => {
  it('drops a limb out of the top skin step purely for being drawn at an angle', () => {
    const vertical = cylinderPeakLit(90 * DEG);
    const towardLamp = cylinderPeakLit(45 * DEG);
    const top = SHADING.THRESHOLDS_4[2] ?? 1;
    const belly = SHADING.AXIAL_LIMB.BELLY_GAIN;
    // Not "roughly dimmer": the gap is bigger than half the distance between
    // two steps of the four-step skin ramp, which is why it was visible.
    const stepGap = (SHADING.THRESHOLDS_4[1] ?? 0) - (SHADING.THRESHOLDS_4[0] ?? 0);
    expect(vertical - towardLamp).toBeGreaterThan(0.5 * stepGap);
    // And it lands across a threshold rather than inside a step: with the WHOLE
    // muscle belly behind it, a limb at this angle still cannot reach the top
    // skin step, and a vertical one can. That is a limb out of its band.
    expect(vertical + belly).toBeGreaterThan(top);
    expect(towardLamp + belly).toBeLessThan(top);
  });

  it('is symmetric about the lamp, so the deficit lands on one screen side', () => {
    // The peak depends only on |L.u|, so 45 and 225 degrees are the same limb
    // seen from either end. That is what makes the darker side a consistent
    // screen side rather than noise, and it is the property the far-limb bias
    // is stacked on top of.
    for (const deg of [0, 30, 45, 60, 90]) {
      expect(cylinderPeakLit(deg * DEG)).toBeCloseTo(cylinderPeakLit((deg + 180) * DEG), 12);
    }
  });
});

describe('camera blend', () => {
  it('is zero for a limb lying in the screen plane and maximal pointing at us', () => {
    expect(cameraBlendForTilt(0)).toBe(0);
    expect(cameraBlendForTilt(1)).toBeCloseTo(SHADING.FORESHORTEN.CAMERA_BLEND, 12);
  });

  it('is monotonic and clamps rather than extrapolating', () => {
    let prev = -1;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const v = cameraBlendForTilt(Math.min(1, t));
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(cameraBlendForTilt(-3)).toBe(cameraBlendForTilt(0));
    expect(cameraBlendForTilt(3)).toBe(cameraBlendForTilt(1));
  });
});

/** A limb at `deg` on screen, optionally tilted out of the screen plane. */
function angledLimb(deg: number, outOfPlane?: number): IndexGrid {
  const g = createGrid(48, 48);
  const r = 20;
  const cx = 24;
  const cy = 24;
  const dx = Math.cos(deg * DEG) * r;
  const dy = Math.sin(deg * DEG) * r;
  drawLimb(g, cx - dx, cy - dy, cx + dx, cy + dy, 4, 4, RAMPS.SKIN, {
    ...(outOfPlane === undefined ? {} : { outOfPlane }),
  });
  return g;
}

/** Share of a limb's pixels at or above ramp step `floor`. */
function shareAtOrAbove(g: IndexGrid, floor: number): number {
  let lit = 0;
  let total = 0;
  for (let y = 0; y < g.h; y += 1) {
    for (let x = 0; x < g.w; x += 1) {
      const s = stepAt(g, x, y);
      if (s < 0) continue;
      total += 1;
      if (s >= floor) lit += 1;
    }
  }
  return total === 0 ? 0 : lit / total;
}

describe('foreshortening keeps a limb in its band', () => {
  it('leaves a limb with no tilt bit-for-bit identical to the old cylinder', () => {
    // The guard that this change cannot have touched the arms, the neck or the
    // shins: none of them pass `outOfPlane`, and omitting it must mean nothing
    // happens at all rather than "something small happens".
    for (const deg of [0, 37, 90, 143]) {
      const plain = angledLimb(deg);
      const zero = angledLimb(deg, 0);
      expect([...zero.data], `${deg} deg`).toEqual([...plain.data]);
    }
  });

  it('pulls the shadow flank of a bent limb up out of the ramp floor', () => {
    // THE REGRESSION THIS CATCHES. At squat depth the shorts and the sleeve
    // leave only ONE flank of the thigh visible, and on a near-horizontal limb
    // that flank is the shadow side. Untilted it sits on the bottom two ramp
    // steps; tilted by what the rig measures on a bent femur it comes up into
    // the lit band, which is what makes the leg read as a lit leg.
    const LIT = 2; // SKIN_LIGHT
    const flat = angledLimb(45);
    const tilted = angledLimb(45, 0.9);
    expect(shareAtOrAbove(tilted, LIT)).toBeGreaterThan(shareAtOrAbove(flat, LIT) * 1.2);
    // And the floor of the ramp — the mud — goes away rather than moving.
    const floorShare = (g: IndexGrid): number => 1 - shareAtOrAbove(g, 1);
    expect(floorShare(tilted)).toBeLessThan(0.5 * floorShare(flat));
  });

  it('does not turn the joint drop into a whole-limb drop on a stubby limb', () => {
    // A femur in the hole is drawn ~3.7 px long against a 4.3 px radius, so the
    // entire capsule sits inside AXIAL_LIMB's joint band and JOINT_DROP came off
    // every pixel of it at once. AXIAL_FADE is what stops that; without it this
    // limb loses its lit area again.
    const g = createGrid(24, 24);
    drawLimb(g, 10, 12, 14, 12, 4.3, 3.1, RAMPS.SKIN, { outOfPlane: 0.96 });
    expect(shareAtOrAbove(g, 2)).toBeGreaterThan(0.5);
  });
});
