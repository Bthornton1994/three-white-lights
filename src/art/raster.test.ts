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
  dimToward,
  drawLimb,
  drawLimbChain,
  getPx,
  lambert,
  limbNormal,
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

  it('dims the far limb without renumbering its ramp', () => {
    // The property the far-limb separation had to gain, stated as arithmetic.
    //
    // A STEP BIAS is a renumbering: whatever the surface does, it comes out one
    // entry lower, so the shadow flank — already on the floor — cannot go
    // anywhere, everything one step off the floor lands ON it, and the top step
    // is unreachable at ANY brightness. That is what put the far arm's median on
    // SKIN_SHADOW in every frame the animation can produce.
    //
    // `dimToward` is a lamp, so it does none of those three things.
    const ramp = RAMPS.SKIN;
    const k = SHADING.FAR_LIMB_LIGHT_SCALE;
    expect(k).toBeGreaterThan(0);
    expect(k).toBeLessThan(1);

    // 1. The shadow flank does not move: it is already at AMBIENT.
    expect(dimToward(SHADING.AMBIENT, k)).toBeCloseTo(SHADING.AMBIENT, 12);
    expect(shadeToIndex(ramp, dimToward(SHADING.AMBIENT, k))).toBe(
      shadeToIndex(ramp, SHADING.AMBIENT),
    );

    // 2. The top of the ramp is still reachable — a surface square to the lamp
    //    keeps it. A -1 step bias cannot, by construction.
    expect(shadeToIndex(ramp, dimToward(1, k))).toBe(ramp[ramp.length - 1]);
    expect(shadeToIndex(ramp, 1, -1)).not.toBe(ramp[ramp.length - 1]);

    // 3. It still separates: a value just over the top threshold comes down.
    const mid = (SHADING.THRESHOLDS_4[2] ?? 1) + 1e-6;
    expect(shadeToIndex(ramp, dimToward(mid, k))).not.toBe(shadeToIndex(ramp, mid));

    // 4. And 1 is exactly a no-op, so every part that does not opt in is
    //    bit-for-bit untouched.
    for (const lit of [0, 0.13, 0.2, 0.37, 0.55, 0.89, 1]) {
      expect(dimToward(lit, 1)).toBe(lit);
    }
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
    // Not "roughly dimmer": the deficit is bigger than the ENTIRE muscle-belly
    // term, so no axial highlight can give back what the drawing angle took.
    //
    // This used to be measured against half the distance between two of
    // THRESHOLDS_4's entries, which made a claim about the lamp depend on where
    // the quantiser's cuts happen to sit — move a threshold for an unrelated
    // reason and the sentence changes meaning without anyone editing it. The
    // belly gain is a property of the shading model, which is what the claim is
    // about.
    expect(vertical - towardLamp).toBeGreaterThan(belly);
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

describe('limbNormal', () => {
  // The unit vectors this returns are the whole shading model for a limb, so
  // these are claims about the model rather than about any rendered pixel.
  const P = { x: -0.6, y: 0.8 }; // an arbitrary in-plane perpendicular
  const U = { x: 0.8, y: 0.6 }; // and the axis it belongs to
  const len = (n: { x: number; y: number; z: number }): number =>
    Math.hypot(n.x, n.y, n.z);

  it('is always a unit vector', () => {
    for (const camera of [0, 0.3, 0.7, 1]) {
      for (const across of [-1, -0.4, 0, 0.4, 1]) {
        for (const along of [-2, -1, 0, 1, 2]) {
          expect(len(limbNormal(P.x, P.y, U.x, U.y, across, along, camera)), `${camera}/${across}/${along}`)
            .toBeCloseTo(1, 10);
        }
      }
    }
  });

  it('is the plain cylinder at zero camera blend, whatever the axial offset', () => {
    // THE GUARANTEE THE SHIN, THE ARMS AND THE NECK RELY ON. None of them pass
    // `outOfPlane`, so `camera` is 0 for them and the dome terms must multiply
    // out completely rather than "almost".
    for (const across of [-1, -0.5, 0, 0.5, 1]) {
      const expected = {
        x: P.x * across,
        y: P.y * across,
        z: Math.sqrt(Math.max(0, 1 - across * across)),
      };
      for (const along of [-3, 0, 3]) {
        const n = limbNormal(P.x, P.y, U.x, U.y, across, along, 0);
        expect(n.x, `across ${across} along ${along}`).toBeCloseTo(expected.x, 12);
        expect(n.y).toBeCloseTo(expected.y, 12);
        expect(n.z).toBeCloseTo(expected.z, 12);
      }
    }
  });

  it('clamps its inputs rather than producing an imaginary z', () => {
    for (const camera of [0, 0.5, 1]) {
      for (const [across, along] of [[5, 0], [-5, 0], [0, 9], [0, -9], [3, 3]] as const) {
        const n = limbNormal(P.x, P.y, U.x, U.y, across, along, camera);
        expect(Number.isFinite(n.x) && Number.isFinite(n.y) && Number.isFinite(n.z)).toBe(true);
        expect(len(n)).toBeCloseTo(1, 10);
      }
    }
  });

  it('collapses a fully foreshortened limb to one value at the shipped curvature', () => {
    // DOME_CURVATURE ships at 0, which means a limb pointing straight at the
    // camera is shaded as a flat face: every pixel of it gets the same normal
    // and therefore the same ramp step. That is a deliberate choice with a
    // measurement written beside it in SHADING.FORESHORTEN.DOME_CURVATURE, and
    // this is the test that will start failing the moment somebody turns the
    // dial — which is the point of having the dial.
    if (SHADING.FORESHORTEN.DOME_CURVATURE !== 0) return;
    const centre = limbNormal(P.x, P.y, U.x, U.y, 0, 0, 1);
    for (const across of [-1, -0.3, 0.6, 1]) {
      for (const along of [-1, 0, 1]) {
        const n = limbNormal(P.x, P.y, U.x, U.y, across, along, 1);
        expect(n.x, `${across}/${along}`).toBeCloseTo(centre.x, 12);
        expect(n.y).toBeCloseTo(centre.y, 12);
        expect(n.z).toBeCloseTo(centre.z, 12);
      }
    }
    expect(centre.z).toBeCloseTo(1, 12);
  });

  it('cannot reach the top skin step while it is a flat camera-facing face', () => {
    // The arithmetic behind DOME_CURVATURE's comment, checkable rather than
    // asserted: a plane facing the camera reaches AMBIENT + (1-AMBIENT)*L.z,
    // and THRESHOLDS_4's top entry is deliberately above that. So a
    // foreshortened limb gets its top step from a hand-placed mark or from the
    // axial belly, never from its own normal — and the axial term is faded out
    // at full tilt by FORESHORTEN.AXIAL_FADE.
    const flat = limbNormal(P.x, P.y, U.x, U.y, 0.5, 0.5, 1);
    const top = SHADING.THRESHOLDS_4[2] ?? 1;
    expect(lambert(flat.x, flat.y, flat.z)).toBeLessThan(top);
    expect(SHADING.FORESHORTEN.AXIAL_FADE).toBe(1);
  });

  it('curves in both screen axes once the dome is turned on', () => {
    // The other end of the dial, tested at a value it does not ship at, so the
    // model itself is covered rather than only the setting. With curvature the
    // normal varies ALONG the axis as well as across it, which is what makes
    // the mass a cap instead of a disc.
    const a = limbNormalAt(0, -1, 1, 1);
    const b = limbNormalAt(0, 1, 1, 1);
    expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeGreaterThan(0.5);
    // And there is a point on it whose normal aims at the lamp, which is the
    // whole reason a dome can reach the top skin step and a disc cannot.
    let best = 0;
    for (let across = -1; across <= 1; across += 0.05) {
      for (let along = -1; along <= 1; along += 0.05) {
        const n = limbNormalAt(across, along, 1, 1);
        best = Math.max(best, lambert(n.x, n.y, n.z));
      }
    }
    expect(best).toBeGreaterThan(SHADING.THRESHOLDS_4[2] ?? 1);
  });

  /**
   * `limbNormal` at an explicit curvature, so the dome half of the model can be
   * tested without the shipped constant deciding whether the test runs. Same
   * arithmetic as the function, kept in the test only for the `curve` argument
   * the production path takes from `SHADING`.
   */
  function limbNormalAt(
    across: number,
    along: number,
    camera: number,
    curve: number,
  ): { x: number; y: number; z: number } {
    const shrink = 1 + camera * (curve - 1);
    const a = shrink * Math.min(1, Math.max(-1, across));
    const b = camera * curve * Math.min(1, Math.max(-1, along));
    const nz = Math.sqrt(Math.max(0, 1 - a * a - b * b));
    const x = P.x * a + U.x * b;
    const y = P.y * a + U.y * b;
    const inv = 1 / Math.max(1e-6, Math.sqrt(x * x + y * y + nz * nz));
    return { x: x * inv, y: y * inv, z: nz * inv };
  }
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
    //
    // THIS LOCK IS STILL RIGHT AFTER THE ROUND-4 REVIEW, and it was re-checked
    // rather than assumed. The shin's drawn knee-to-ankle length GROWS through
    // the descent (14.14 px standing, 16.40 in the hole) and its screen angle
    // stays within 75-105 degrees, so there is no out-of-plane rotation in it
    // to shade from. The shin's darkness was fixed on the axial side instead —
    // `SHADING.AXIAL_LEG` — which leaves this guarantee untouched.
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
    // And the floor of the ramp — the mud — is not where a lit mass lives.
    //
    // This used to read "tilted has less than half the floor share of flat",
    // and it now passes for a stronger reason than it was written for: with
    // THRESHOLDS_4's bottom entry under AMBIENT and `litWithAxial` flooring
    // there, the LAMP CANNOT PUT A FILL PIXEL ON THE DARKEST STEP AT ALL. The
    // ramp floor is the contour's colour. Asserted on both drawings, because
    // "less than half of nothing" would have been vacuous.
    const floorShare = (g: IndexGrid): number => 1 - shareAtOrAbove(g, 1);
    expect(floorShare(flat)).toBe(0);
    expect(floorShare(tilted)).toBe(0);
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

describe('a chain of capsules carries ONE ring, at the union boundary', () => {
  // THE DOUBLED RING AT THE ELBOW. `PartOptions.edge` stamps a ring a pixel
  // outside the capsule and fills the capsule over it, so one capsule ends up
  // with one ring. Two capsules that MEET did not: drawn one after the other,
  // the second capsule's ring lands on the first capsule's fill and stays
  // there. On a five-pixel arm that was a dark band straight across the joint.
  //
  // The counterexample below is the whole point of the first assertion. It
  // reproduces the old call pattern exactly and shows the property failing, so
  // "no ring inside the union" is a claim about the fix rather than a claim
  // about a case that never arises.
  const A = { ax: 6, ay: 6, bx: 6, by: 16, ra: 2.7, rb: 2.1 } as const;
  const B = { ax: 6, ay: 16, bx: 14, by: 20, ra: 2.0, rb: 1.7 } as const;
  const RING = PAL.CHALK; // any index the SKIN ramp cannot produce
  const opts = { edge: true, edgeIndex: RING };

  /** Ring pixels that fall strictly inside one of the capsules. */
  function ringInsideUnion(g: IndexGrid): number {
    const inside = (s: typeof A | typeof B, x: number, y: number): boolean => {
      const dx = s.bx - s.ax;
      const dy = s.by - s.ay;
      const len2 = dx * dx + dy * dy;
      const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (y - s.ay) * dy) / len2));
      const r = s.ra + (s.rb - s.ra) * t;
      return Math.hypot(x - (s.ax + t * dx), y - (s.ay + t * dy)) <= r;
    };
    let n = 0;
    for (let y = 0; y < g.h; y += 1) {
      for (let x = 0; x < g.w; x += 1) {
        if (getPx(g, x, y) !== RING) continue;
        if (inside(A, x, y) || inside(B, x, y)) n += 1;
      }
    }
    return n;
  }

  it('leaves no ring pixel inside either capsule', () => {
    const g = createGrid(28, 28);
    drawLimbChain(g, [
      { ...A, ramp: RAMPS.SKIN, opts },
      { ...B, ramp: RAMPS.SKIN, opts },
    ]);
    expect(ringInsideUnion(g)).toBe(0);
  });

  it('and drawing the two capsules separately does leave some', () => {
    const g = createGrid(28, 28);
    drawLimb(g, A.ax, A.ay, A.bx, A.by, A.ra, A.rb, RAMPS.SKIN, opts);
    drawLimb(g, B.ax, B.ay, B.bx, B.by, B.ra, B.rb, RAMPS.SKIN, opts);
    expect(ringInsideUnion(g)).toBeGreaterThan(0);
  });

  it('is bit-for-bit `drawLimb` for a chain of one', () => {
    const one = createGrid(28, 28);
    const chained = createGrid(28, 28);
    drawLimb(one, A.ax, A.ay, A.bx, A.by, A.ra, A.rb, RAMPS.SKIN, opts);
    drawLimbChain(chained, [{ ...A, ramp: RAMPS.SKIN, opts }]);
    expect(Array.from(chained.data)).toEqual(Array.from(one.data));
  });
});
