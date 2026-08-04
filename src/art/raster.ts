/**
 * Index-grid rasteriser.
 *
 * A sprite here is exactly what a sprite was on the hardware: a grid of palette
 * indices. No colour values appear in this file, no alpha, no blending, and
 * nothing writes a fractional pixel. Every primitive resolves each pixel to one
 * palette index by a hard threshold.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE SHADING MODEL IS FOR, AND WHAT IT IS NOT
 * ---------------------------------------------------------------------------
 * The single loudest tell of generated pixel art is pillow shading: brightness
 * falling off toward the edges of a shape in every direction, because the
 * author had no light source in mind. Every primitive below computes an actual
 * surface normal — cylindrical for limbs, ellipsoidal for heads and hands —
 * dots it with one key light fixed in `SHADING.LIGHT_DIR`, and quantises the
 * result into a ramp. That is what buys the one thing it can buy: a consistent
 * lamp, so the lit edge of the left arm and the lit edge of the right arm are
 * on the same side of the body instead of mirroring each other.
 *
 * BE PRECISE ABOUT WHAT THAT IS AND IS NOT. This file's earlier header claimed
 * per-pixel Lambert on a capsule was "what a competent 16-bit artist did by
 * hand". It is not, and the pixels never supported it. An artist did not
 * evaluate a normal per pixel; an artist placed a highlight cluster on the
 * deltoid, put a core shadow under the biceps, drew a buckle and a sole line,
 * and left large areas flat. A limb resolved entirely by `lambert()` comes out
 * as an extruded tube with a stripe down it, identical on the thigh, the shin,
 * the forearm and the neck apart from its angle, and no amount of correct light
 * direction fixes that — the value structure ends up a function of geometry
 * only, never of anatomy or of an object.
 *
 * That stripe was not a tendency, it was an identity. Shading from the
 * across-limb offset alone gives every cross-section of a limb the same value,
 * so the lit column was constant from shoulder to wrist by construction. The
 * fix is `axialTerm` below: one more term, a function of position ALONG the
 * mass, so a limb can be bright at the muscle belly and darker at the joints.
 * It is still an underpainting and it is still cheap — a belly and two ends,
 * not a muscle map — but the guarantee is gone.
 *
 * So the model here is the UNDERPAINTING. It establishes the lamp and the
 * masses. Everything that makes the figure read as a drawn object rather than a
 * shaded solid — belt lever, shoe sole, singlet trim, strap shadow, hair
 * fringe, knee-sleeve banding, and the breaks in the value ramp at the deltoid,
 * elbow, wrist and knee — is hand-placed pixel data in `spriteMarks.ts` and is
 * stamped on top of what this file produces. If you are looking for the pixels
 * an artist chose, they are there, not here.
 *
 * There is no anti-aliasing and no dithering. AA is impossible in an index grid
 * without spending palette slots on blend colours, which is exactly the budget
 * the hardware did not have.
 */

import { SHADING, type AxialProfile } from './spriteTuning';
import {
  BANK_SIZE,
  hasInteriorEdge,
  interiorEdgeFor,
  isTransparentIndex,
  outlineIndexForBank,
  type Ramp,
} from './palette';

/**
 * Divide-by-zero guard for the normal and profile maths.
 *
 * NOT A TUNABLE, and deliberately not in `spriteTuning.ts`: it exists so a
 * degenerate limb (zero length, zero width) produces a finite number instead of
 * `Infinity`. Turning it does not change how anything looks until it is large
 * enough to change what a *correct* limb computes, at which point it is a bug.
 */
const EPSILON = 1e-6;

/**
 * Half a pixel — the offset from a pixel's corner, where integer coordinates
 * live, to its centre, where a distance test should be evaluated.
 *
 * Fixed by the pixel grid, not by taste. It appears as a floor on a radius (a
 * shape thinner than one pixel still has a centre) and as the corner-knock
 * inset on a plate edge.
 */
const HALF_PIXEL = 0.5;

export interface IndexGrid {
  readonly w: number;
  readonly h: number;
  readonly data: Uint8Array;
}

export function createGrid(w: number, h: number, fill: number = 0): IndexGrid {
  const data = new Uint8Array(w * h);
  if (fill !== 0) data.fill(fill);
  return { w, h, data };
}

export function cloneGrid(g: IndexGrid): IndexGrid {
  return { w: g.w, h: g.h, data: Uint8Array.from(g.data) };
}

export function getPx(g: IndexGrid, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return 0;
  return g.data[y * g.w + x] ?? 0;
}

export function setPx(g: IndexGrid, x: number, y: number, index: number): void {
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return;
  g.data[y * g.w + x] = index;
}

export function fillRect(
  g: IndexGrid,
  x0: number,
  y0: number,
  w: number,
  h: number,
  index: number,
): void {
  for (let y = Math.round(y0); y < Math.round(y0) + h; y += 1) {
    for (let x = Math.round(x0); x < Math.round(x0) + w; x += 1) {
      setPx(g, x, y, index);
    }
  }
}

// ---------------------------------------------------------------------------
// Lighting
// ---------------------------------------------------------------------------

const L = SHADING.LIGHT_DIR;
const L_LEN = Math.sqrt(L.x * L.x + L.y * L.y + L.z * L.z);
const LX = L.x / L_LEN;
const LY = L.y / L_LEN;
const LZ = L.z / L_LEN;

/** Lambert term for a unit normal, lifted by ambient, clamped to 0..1. */
export function lambert(nx: number, ny: number, nz: number): number {
  const d = nx * LX + ny * LY + nz * LZ;
  const lit = Math.max(0, d);
  return Math.min(1, SHADING.AMBIENT + (1 - SHADING.AMBIENT) * lit);
}

/**
 * The lamp, plus whatever a mass does to itself along its own axis.
 *
 * AMBIENT IS A FLOOR HERE, NOT A BASE, and that is the whole content of this
 * function. `lambert` already bottoms out at AMBIENT, but `axialTerm`'s
 * `JOINT_DROP` was subtracted afterwards and could take a pixel BELOW it: on
 * the shadow flank of a limb, where the lamp contributes nothing, the joint
 * bands at each end of every capsule went from AMBIENT to AMBIENT - JOINT_DROP.
 * With four capsule ends down each arm that put whole wedges of every limb on
 * the darkest entry of the ramp — measured, 48-64% of the far arm's own window,
 * against a reference figure whose worst limb-sized patch of skin anywhere is
 * 37-50% and whose median never lands there at all.
 *
 * Ambient is light that arrives from everywhere; a muscle belly does not
 * occlude it. So the axial profile modulates the KEY light and stops at the
 * ambient floor, which leaves the ramp's darkest step to the thing that is
 * actually drawn in it — the contour (`INTERIOR_EDGE.SKIN`), one step under the
 * fill beside it. The joint articulation is unchanged where anyone can see it:
 * on the lit flank the drop still has the full range to work in.
 */
export function litWithAxial(lambertValue: number, axial: number): number {
  return Math.min(1, Math.max(SHADING.AMBIENT, lambertValue + axial));
}

/**
 * Push a lit value toward ambient — a mass standing further from the lamp.
 *
 * THIS REPLACES A RAMP-STEP BIAS, and the difference is the whole point. A
 * step bias renumbers the ramp: every pixel of the mass drops one entry, so a
 * limb whose lit flank was the top step is capped one below it and everything
 * that was one step off the floor lands ON the floor. Measured on the far arm
 * that was 54-93% of its skin at `SKIN_SHADOW` with a median AT the floor in
 * every frame the animation can produce, and zero pixels at `SKIN_HI` — a flat
 * dark mass beside a near arm running the whole ramp.
 *
 * Scaling toward ambient is what a dimmer lamp actually does. The shadow flank
 * is already sitting at ambient and does not move, so nothing extra is pushed
 * onto the floor; the lit flank comes down, so the mass reads further away; and
 * where the surface really does face the lamp it can still cross the top
 * threshold, which is how both of `sprite-ref-1`'s arms reach the top two steps
 * of one skin ramp under one light.
 *
 * `scale` 1 is a no-op, bit for bit.
 */
export function dimToward(lit: number, scale: number): number {
  if (scale === 1) return lit;
  return SHADING.AMBIENT + scale * (lit - SHADING.AMBIENT);
}

/**
 * Peak Lambert value a cylinder lying in the screen plane can reach, for an
 * axis at `angleRad` on screen. Exported because it is the arithmetic behind
 * `SHADING.FORESHORTEN`, and a claim about the shading model that the tests can
 * check is worth more than a claim about it in a comment.
 *
 * A cylinder's brightest surface point is where its normal lies in the plane of
 * the light and the axis, so the peak is `|L - (L.u)u|` — the light's component
 * perpendicular to the axis. It is therefore MAXIMAL for an axis square to the
 * lamp and MINIMAL for an axis pointing at it, which is the whole problem: it
 * makes a limb's value band a function of the angle it happens to be drawn at.
 */
export function cylinderPeakLit(angleRad: number): number {
  const ux = Math.cos(angleRad);
  const uy = Math.sin(angleRad);
  const along = ux * LX + uy * LY;
  const perp = Math.sqrt(Math.max(0, 1 - along * along));
  return Math.min(1, SHADING.AMBIENT + (1 - SHADING.AMBIENT) * perp);
}

/**
 * Blend weight for the camera-facing normal, from a limb's out-of-plane tilt.
 *
 * `tilt` is 0 for a limb lying in the screen plane and 1 for one pointing
 * straight at the viewer; `rig.ts` derives it from the drawn length of a bone
 * against its unforeshortened length. See `SHADING.FORESHORTEN` for why this
 * exists at all.
 */
export function cameraBlendForTilt(tilt: number): number {
  const t = Math.min(1, Math.max(0, tilt));
  return (
    SHADING.FORESHORTEN.CAMERA_BLEND * Math.pow(t, SHADING.FORESHORTEN.TILT_EXPONENT)
  );
}

/**
 * Surface normal for a limb pixel, in screen space, normalised.
 *
 * `across` is the offset from the axis in radii (-1 at one flank, +1 at the
 * other) and `alongOff` is the offset from the dome's pole along the axis, in
 * the same units. `camera` is `cameraBlendForTilt`.
 *
 * AT `camera` 0 THIS IS THE PLAIN CYLINDER, bit for bit: both dome terms are
 * multiplied out, so the normal is `(p*across, sqrt(1-across^2))` and every
 * cross-section is identical, which is what a tube lying in the screen plane
 * looks like. The `outOfPlane`-free callers — arms, neck, shin — are therefore
 * untouched by anything in this function.
 *
 * AS `camera` RISES the cross-section curvature is scaled by
 * `FORESHORTEN.DOME_CURVATURE` and the same curvature is introduced ALONG the
 * axis, so the mass turns from a tube into a cap. At DOME_CURVATURE 1 that cap
 * is a full hemisphere of the limb's own radius, which is geometrically what
 * the rounded end of a capsule pointing at the viewer is. At 0 it collapses to
 * a flat camera-facing face, which is what this blend used to be
 * unconditionally — so the constant spans the old behaviour and the new one and
 * a tuner can walk between them.
 *
 * WHY IT IS NOT SIMPLY 1. Both extremes are wrong on real pixels, in opposite
 * directions, and the measurement is in `SHADING.FORESHORTEN.DOME_CURVATURE`.
 */
export function limbNormal(
  px: number,
  py: number,
  ux: number,
  uy: number,
  across: number,
  alongOff: number,
  camera: number,
): { readonly x: number; readonly y: number; readonly z: number } {
  const curve = SHADING.FORESHORTEN.DOME_CURVATURE;
  const shrink = 1 + camera * (curve - 1);
  const a = shrink * Math.min(1, Math.max(-1, across));
  const b = camera * curve * Math.min(1, Math.max(-1, alongOff));
  const nz = Math.sqrt(Math.max(0, 1 - a * a - b * b));
  const x = px * a + ux * b;
  const y = py * a + uy * b;
  const inv = 1 / Math.max(EPSILON, Math.sqrt(x * x + y * y + nz * nz));
  return { x: x * inv, y: y * inv, z: nz * inv };
}

/**
 * Value modulation along a mass's own axis, added to the Lambert term before
 * quantisation.
 *
 * THIS IS THE TERM THAT WAS MISSING. Without it `drawLimb` shaded purely from
 * the across-limb offset, so every pixel at the same distance from the limb's
 * centre-line got the same ramp step no matter how far down the limb it was —
 * a longitudinal stripe, guaranteed by the maths rather than chosen. One
 * unbroken light column ran down each forearm and each shin in every rendered
 * frame, and no mark table could fix it, because a mark is a handful of pixels
 * and this was the whole limb.
 *
 * The shape is two bumps and nothing else: `BELLY_GAIN` raised over a Gaussian
 * at `BELLY_FRAC`, and `JOINT_DROP` subtracted over the outer `JOINT_WIDTH` at
 * each end. A limb therefore reads bright at the muscle belly, steps down past
 * it, and goes darkest where it meets the joint — which is the value structure
 * the reference wrestlers' arms have and the structure a smooth gradient does
 * not. `t` is 0 at the mass's start and 1 at its end.
 */
export function axialTerm(profile: AxialProfile, t: number): number {
  const u = Math.min(1, Math.max(0, t));
  const d = (u - profile.BELLY_FRAC) / Math.max(EPSILON, profile.BELLY_WIDTH);
  const belly = Math.exp(-d * d);
  const w = Math.max(EPSILON, profile.JOINT_WIDTH);
  const joint = Math.max(Math.max(0, 1 - u / w), Math.max(0, 1 - (1 - u) / w));
  return profile.BELLY_GAIN * belly - profile.JOINT_DROP * joint;
}

function thresholdsFor(steps: number): readonly number[] {
  // A ramp of N steps needs N-1 thresholds, so the step counts are read off
  // the tables themselves rather than restated as literals that could drift.
  if (steps >= SHADING.THRESHOLDS_4.length + 1) return SHADING.THRESHOLDS_4;
  if (steps === SHADING.THRESHOLDS_3.length + 1) return SHADING.THRESHOLDS_3;
  return SHADING.THRESHOLDS_2;
}

/**
 * Pick a ramp entry for a lit value. `stepBias` shifts darker (negative) or
 * lighter; far-side limbs use a negative bias so they separate from near ones.
 */
export function shadeToIndex(ramp: Ramp, lit: number, stepBias: number = 0): number {
  const thresholds = thresholdsFor(ramp.length);
  let step = 0;
  for (let i = 0; i < thresholds.length && i < ramp.length - 1; i += 1) {
    if (lit >= (thresholds[i] ?? 1)) step = i + 1;
  }
  const biased = Math.min(ramp.length - 1, Math.max(0, step + stepBias));
  return ramp[biased] ?? ramp[0] ?? 0;
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export interface PartOptions {
  /** Shift the whole part's ramp step. */
  readonly stepBias?: number;
  /**
   * Dim this part's lamp toward ambient — depth separation for far masses.
   *
   * Omitted means 1, which is bit-for-bit no change. See `dimToward` for why
   * this and not `stepBias`, and `SHADING.FAR_LIMB_LIGHT_SCALE` for the value.
   */
  readonly lightScale?: number;
  /** Stamp a 1px outline around the part before filling it. */
  readonly edge?: boolean;
  /** Outline colour for `edge`. Defaults to the part's own bank outline. */
  readonly edgeIndex?: number;
  /**
   * Shade the edge ring from the same lamp as the fill, `SHADING.EDGE_STEP_DROP`
   * steps under it, instead of stamping one flat colour all the way round.
   *
   * A flat ring is a rim of the ramp's floor on every side of the mass at once —
   * the lit flank gets the same near-black as the shadow flank, which is the one
   * thing a lamp cannot do. Sampled off sprite-ref-1 at native scale, a bare
   * thigh row runs his six-step skin ramp as 1/3/4/5/5/5/5/2/3/2: one step-1
   * pixel where the light leaves the form, a run of the top step across the face
   * of the mass, and a MID step, not a dark one, on the other side — and NOT ONE
   * pixel of that row on step 0 (`@ref skin.luma0 = 52.8`). That asymmetry is
   * most of what makes the reference's limbs read as lit cylinders rather than
   * as outlined tubes.
   */
  readonly edgeFollowsLight?: boolean;
  /**
   * How value varies ALONG this mass. Limbs default to `SHADING.AXIAL_LIMB`
   * (flesh, so a muscle belly and two joints); trunks default to
   * `SHADING.AXIAL_FLAT`, because the trunk primitive draws worn kit — belt,
   * shoe, singlet — as often as it draws a body, and a muscle belly on a belt
   * reads as a dent. The torso passes `SHADING.AXIAL_TRUNK` explicitly.
   */
  readonly axial?: AxialProfile;
  /**
   * How far out of the screen plane this mass has rotated: 0 for a limb lying
   * in the frontal plane, 1 for one pointing straight at the camera.
   *
   * Omitted means 0, and at 0 the shading is bit-for-bit the pure cylinder it
   * always was — so every part that does not opt in is untouched. The only
   * masses that pass it are the ones this rig actually draws foreshortened: the
   * femur, and the knee sleeve worn on it. `rig.ts`'s `femurTilt` computes it
   * from the drawn bone length; `SHADING.FORESHORTEN` says what is done with it
   * and why the cylinder model needs correcting at all.
   */
  readonly outOfPlane?: number;
}

function edgeIndexFor(ramp: Ramp, opts?: PartOptions): number {
  if (opts?.edgeIndex !== undefined) return opts.edgeIndex;
  return outlineIndexForBank(ramp[0] ?? 0);
}

/**
 * Tapered capsule between two points — an arm, a leg, a neck.
 *
 * Shaded as a cylinder: the normal's in-plane component runs across the limb's
 * width, so a limb angled up-left is lit along its upper-left flank and a limb
 * angled up-right is lit along its upper-right flank, from the same lamp.
 *
 * AND along its length, by `axialTerm`. The across-limb normal on its own gives
 * every cross-section the same value, which is a stripe from end to end however
 * good the lamp is; the axial term is what puts a highlight cluster on the
 * muscle belly and a darker step at each joint.
 *
 * AND, for a limb that is not lying in the screen plane, tipped toward the
 * camera by `PartOptions.outOfPlane`. A cylinder shaded from its screen angle
 * alone has no way to tell a limb lying sideways from one pointing at the
 * viewer, and gets the second one exactly backwards — dark down the middle of
 * the mass the camera is looking straight into. See `SHADING.FORESHORTEN`.
 */
export function drawLimb(
  g: IndexGrid,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  ra: number,
  rb: number,
  ramp: Ramp,
  opts?: PartOptions,
): void {
  drawLimbChain(g, [
    { ax, ay, bx, by, ra, rb, ramp, ...(opts === undefined ? {} : { opts }) },
  ]);
}

/** One capsule of a limb chain. Same arguments `drawLimb` takes, as a record. */
export interface LimbSegment {
  readonly ax: number;
  readonly ay: number;
  readonly bx: number;
  readonly by: number;
  readonly ra: number;
  readonly rb: number;
  readonly ramp: Ramp;
  readonly opts?: PartOptions;
}

/**
 * Several capsules drawn as ONE mass: every ring first, then every fill.
 *
 * WHY THIS EXISTS — THE DOUBLED RING AT THE ELBOW. `PartOptions.edge` stamps a
 * ring one pixel outside the capsule and then fills the capsule over it, so a
 * capsule drawn on its own carries exactly one ring. Two capsules that MEET —
 * upper arm into forearm — do not: the second capsule's ring lands on top of
 * the first capsule's fill, and the first capsule's ring survives wherever the
 * second one does not reach. Measured on the drawn arm at lockout, that put a
 * two-pixel dark band straight across the elbow, on a limb only five pixels
 * wide.
 *
 * Stamping all the rings before any of the fills makes the ring the outline of
 * the UNION: every ring pixel that falls inside any capsule is covered by that
 * capsule's fill, so what is left is the outside boundary and nothing else. A
 * chain of one segment is bit-for-bit what `drawLimb` always did.
 *
 * The joint is not left unarticulated by this — it is articulated by the value
 * structure instead of by a keyline. Both capsules run `axialTerm`'s JOINT_DROP
 * into their shared end (see `SHADING.AXIAL_LIMB`) and `spriteMarks.ts` places
 * the elbow break by hand on top.
 */
export function drawLimbChain(g: IndexGrid, segments: readonly LimbSegment[]): void {
  for (const s of segments) {
    if (s.opts?.edge === true) limbPass(g, s, 0);
  }
  for (const s of segments) limbPass(g, s, 1);
}

/** One capsule, one pass: 0 stamps the grown ring, 1 fills the capsule. */
function limbPass(g: IndexGrid, seg: LimbSegment, pass: 0 | 1): void {
  const { ax, ay, bx, by, ra, rb, ramp, opts } = seg;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len < EPSILON) return;
  const ux = dx / len;
  const uy = dy / len;
  // Left-hand perpendicular; sign is consistent so the lit flank is consistent.
  const px = -uy;
  const py = ux;

  const pad = Math.ceil(Math.max(ra, rb)) + 2;
  const x0 = Math.floor(Math.min(ax, bx) - pad);
  const x1 = Math.ceil(Math.max(ax, bx) + pad);
  const y0 = Math.floor(Math.min(ay, by) - pad);
  const y1 = Math.ceil(Math.max(ay, by) + pad);

  const stepBias = opts?.stepBias ?? 0;
  const lightScale = opts?.lightScale ?? 1;
  const edgeIdx = edgeIndexFor(ramp, opts);
  const litEdge = opts?.edgeFollowsLight === true;
  const axial = opts?.axial ?? SHADING.AXIAL_LIMB;
  // 0 for a limb in the screen plane, and then this is the old cylinder exactly.
  const camera = cameraBlendForTilt(opts?.outOfPlane ?? 0);
  const axialScale = 1 - SHADING.FORESHORTEN.AXIAL_FADE * camera;
  // Where the dome's pole sits along the capsule, in px from the start point.
  const domeCentre = len * SHADING.FORESHORTEN.DOME_CENTRE_FRAC;

  const grow = pass === 0 ? 1 : 0;
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const rx = x - ax;
      const ry = y - ay;
      let t = (rx * ux + ry * uy) / len;
      t = Math.min(1, Math.max(0, t));
      const r = ra + (rb - ra) * t + grow;
      const perp = rx * px + ry * py;
      const along = rx * ux + ry * uy;
      // Capsule: rounded ends, so clamp the axial term at the endpoints.
      const overA = along < 0 ? -along : 0;
      const overB = along > len ? along - len : 0;
      const dist = Math.hypot(perp, overA + overB);
      if (dist > r) continue;

      const rCore = Math.max(HALF_PIXEL, r);
      const n = Math.min(1, Math.max(-1, perp / rCore));
      // Cylinder normal, blended toward a DOME of the limb's own radius by
      // however far this mass has rotated out of the screen plane. At
      // `camera` 0 this is the plain cylinder, bit for bit; at 1 it is the
      // rounded end a tube pointing at the viewer actually shows, which is
      // what the front of a thigh IS at the bottom of a squat.
      // See SHADING.FORESHORTEN and `limbNormal`.
      const N = limbNormal(px, py, ux, uy, n, (along - domeCentre) / rCore, camera);
      // `t` is the position DOWN the limb. Reading it here is the whole
      // difference between a modelled limb and an extruded stripe.
      const lit = dimToward(
        litWithAxial(lambert(N.x, N.y, N.z), axialScale * axialTerm(axial, t)),
        lightScale,
      );
      if (pass === 0) {
        setPx(
          g,
          x,
          y,
          litEdge ? shadeToIndex(ramp, lit, stepBias - SHADING.EDGE_STEP_DROP) : edgeIdx,
        );
        continue;
      }
      setPx(g, x, y, shadeToIndex(ramp, lit, stepBias));
    }
  }
}

/**
 * Ellipse shaded as an ellipsoid — head, hands, chalk-free round masses.
 *
 * `edgeFollowsLight` works here exactly as it does on a capsule: the grown ring
 * is shaded from the same lamp, `SHADING.EDGE_STEP_DROP` steps under the fill,
 * rather than stamped flat. It matters most on the smallest masses this
 * function draws. A hand is 3.8 px across; a flat near-black ring around it
 * plus `outlinePass`'s own pixel outside that left a handful of fill pixels in
 * the middle, and nothing resolves into a fist in a handful of pixels.
 */
export function drawEllipsoid(
  g: IndexGrid,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  ramp: Ramp,
  opts?: PartOptions,
): void {
  const stepBias = opts?.stepBias ?? 0;
  const lightScale = opts?.lightScale ?? 1;
  const wantEdge = opts?.edge === true;
  const edgeIdx = edgeIndexFor(ramp, opts);
  const litEdge = opts?.edgeFollowsLight === true;

  for (let pass = wantEdge ? 0 : 1; pass < 2; pass += 1) {
    const grow = pass === 0 ? 1 : 0;
    const erx = rx + grow;
    const ery = ry + grow;
    const x0 = Math.floor(cx - erx);
    const x1 = Math.ceil(cx + erx);
    const y0 = Math.floor(cy - ery);
    const y1 = Math.ceil(cy + ery);
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const nx = (x - cx) / erx;
        const ny = (y - cy) / ery;
        const q = nx * nx + ny * ny;
        if (q > 1) continue;
        const nz = Math.sqrt(Math.max(0, 1 - q));
        const lit = dimToward(lambert(nx, ny, nz), lightScale);
        if (pass === 0) {
          setPx(
            g,
            x,
            y,
            litEdge ? shadeToIndex(ramp, lit, stepBias - SHADING.EDGE_STEP_DROP) : edgeIdx,
          );
          continue;
        }
        setPx(g, x, y, shadeToIndex(ramp, lit, stepBias));
      }
    }
  }
}

/**
 * A vertical body mass with a different half-width at top and bottom — torso,
 * hips, belt. Shaded as a vertical cylinder with a mild top-down term so the
 * chest is not the same value as the gut.
 */
export function drawTrunk(
  g: IndexGrid,
  cx: number,
  yTop: number,
  yBottom: number,
  halfWTop: number,
  halfWBottom: number,
  ramp: Ramp,
  opts?: PartOptions,
): void {
  const stepBias = opts?.stepBias ?? 0;
  const lightScale = opts?.lightScale ?? 1;
  const wantEdge = opts?.edge === true;
  const edgeIdx = edgeIndexFor(ramp, opts);
  const litEdge = opts?.edgeFollowsLight === true;
  // Kit by default: see PartOptions.axial. The torso opts into a real profile.
  const axial = opts?.axial ?? SHADING.AXIAL_FLAT;
  const yA = Math.round(yTop);
  const yB = Math.round(yBottom);
  if (yB < yA) return;

  for (let pass = wantEdge ? 0 : 1; pass < 2; pass += 1) {
    const grow = pass === 0 ? 1 : 0;
    for (let y = yA - grow; y <= yB + grow; y += 1) {
      const f = yB === yA ? 0 : Math.min(1, Math.max(0, (y - yA) / (yB - yA)));
      const hw = halfWTop + (halfWBottom - halfWTop) * f + grow;
      const x0 = Math.floor(cx - hw);
      const x1 = Math.ceil(cx + hw);
      for (let x = x0; x <= x1; x += 1) {
        const nx = (x - cx) / Math.max(HALF_PIXEL, hw);
        if (Math.abs(nx) > 1) continue;
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx));
        const vertical = SHADING.VERTICAL_GAIN * (1 - 2 * f);
        const lit = dimToward(
          litWithAxial(lambert(nx, 0, nz), vertical + axialTerm(axial, f)),
          lightScale,
        );
        if (pass === 0) {
          setPx(
            g,
            x,
            y,
            litEdge ? shadeToIndex(ramp, lit, stepBias - SHADING.EDGE_STEP_DROP) : edgeIdx,
          );
          continue;
        }
        setPx(g, x, y, shadeToIndex(ramp, lit, stepBias));
      }
    }
  }
}

/**
 * A competition disc seen edge-on: a vertical bar of `facePx` width and
 * `diameter` height, corners knocked off so it reads as round rather than as a
 * domino. The top PLATE_RIM_LIT_FRAC catches the key light.
 */
export function drawPlateEdge(
  g: IndexGrid,
  xInner: number,
  facePx: number,
  cy: number,
  diameter: number,
  ramp: Ramp,
): void {
  const r = diameter / 2;
  const shade = ramp[0] ?? 0;
  const light = ramp[ramp.length - 1] ?? shade;
  const litUntil = cy - r + diameter * SHADING.PLATE_RIM_LIT_FRAC;

  for (let x = xInner; x < xInner + facePx; x += 1) {
    for (let y = Math.round(cy - r); y <= Math.round(cy + r); y += 1) {
      const dy = Math.abs(y - cy);
      // Knock the corners: at 90% of the radius the disc has visibly curved in,
      // which is what stops a stack of these looking like a picket fence.
      if (dy > r) continue;
      if (dy > r - HALF_PIXEL && facePx > 1 && x !== xInner) continue;
      setPx(g, x, y, y <= litUntil ? light : shade);
    }
  }
}

// ---------------------------------------------------------------------------
// Passes
// ---------------------------------------------------------------------------

/**
 * Add a 1px outline outside the silhouette.
 *
 * Outside rather than inside, so the interior shading survives at 2-3px limb
 * widths. Colour is chosen per-pixel from the bank of the neighbour it is
 * outlining, giving the warm-on-flesh / cool-on-steel selective outline the era
 * used. Reads from a snapshot so the outline cannot outline itself.
 *
 * A GAP BETWEEN TWO OF THE FIGURE'S OWN MASSES IS NOT A SILHOUETTE, and this
 * pass used to treat it as one. Where the drawing leaves a one-pixel channel
 * between the neck and the trap, or the forearm and the ribs, the transparent
 * pixels in it are reachable from BOTH sides, so the pass filled them with the
 * near-black keyline — a black seam buried inside the figure with the world
 * nowhere near it. Measured over the full pose sweep, every near-black pixel
 * inside the arm, hand and neck windows was one of these: up to 16.7% of the
 * neck, 8.3% of an arm. `sprite-ref-1`'s masses meet in their own darkest ramp
 * step and there is no keyline anywhere on him, so that share had nothing to be
 * compared against.
 *
 * So a gap pixel — one with the SAME BANK's material on both ends of an axis —
 * takes `interiorEdgeFor` instead, which is the same answer `PartOptions.edge`
 * gives everywhere else: skin shadow inside skin, gear dark inside gear. The
 * seam stays; it stops being black. The silhouette proper is untouched, so the
 * figure still reads at phone scale against unknown scenery (GDD §12.2).
 *
 * SAME BANK, and that qualifier is load-bearing rather than tidy. A gap with
 * skin on one side and a PLATE on the other is the boundary between the lifter
 * and the barbell — a real silhouette, and one whose position moves every time
 * the load changes. Treating it as an interior seam made the drawn body a
 * function of how many discs are on the bar, which is exactly what
 * `bodyPixelDiff`'s "measures the body and only the body" forbids: 66 body
 * pixels changed between two frames that differ by 150 kg of plates and nothing
 * else.
 */
export function outlinePass(g: IndexGrid): void {
  const src = Uint8Array.from(g.data);
  const at = (x: number, y: number): number => {
    if (x < 0 || y < 0 || x >= g.w || y >= g.h) return 0;
    return src[y * g.w + x] ?? 0;
  };
  /** The drawn index shared by two opposite neighbours, or 0. */
  const sameBankAcross = (ax: number, ay: number, bx: number, by: number): number => {
    const a = at(ax, ay);
    const b = at(bx, by);
    if (isTransparentIndex(a) || isTransparentIndex(b)) return 0;
    return Math.floor(a / BANK_SIZE) === Math.floor(b / BANK_SIZE) ? a : 0;
  };
  const STEPS: readonly (readonly [number, number])[] = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  /**
   * A transparent pixel THIS PASS WILL LEAVE TRANSPARENT: nothing drawn touches
   * it, so it is still open space when the pass finishes.
   *
   * Off the grid counts as open, because the cell edge is where the world is.
   */
  const staysOpen = (x: number, y: number): boolean =>
    isTransparentIndex(at(x, y)) &&
    STEPS.every(([dx, dy]) => isTransparentIndex(at(x + dx, y + dy)));

  for (let y = 0; y < g.h; y += 1) {
    for (let x = 0; x < g.w; x += 1) {
      if (!isTransparentIndex(at(x, y))) continue;
      const n = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)];
      let pick = 0;
      for (const v of n) {
        if (!isTransparentIndex(v)) {
          pick = v;
          break;
        }
      }
      if (pick === 0) continue;
      const seam =
        sameBankAcross(x - 1, y, x + 1, y) || sameBankAcross(x, y - 1, x, y + 1) || 0;
      // A SEAM PIXEL THAT STILL FACES OPEN SPACE IS NOT A SEAM, IT IS THE
      // SILHOUETTE, and the rule above could not tell the difference: it asks
      // only whether ONE axis has the same bank on both sides. A one-pixel notch
      // bitten out of the outside of a limb has exactly that — material above
      // and below, nothing to the left, nothing to the right — so it was filled
      // with the material's own shadow step, and the still-transparent pixel
      // beyond it was then left bare, because `outlinePass` reads a snapshot and
      // that pixel had no drawn neighbour when the snapshot was taken. The
      // result is fill touching open space with no keyline between: a hole in
      // the silhouette one pixel wide, which is precisely what this pass exists
      // to prevent and what `lifterSprite.test.ts`'s "outlines the whole
      // silhouette" catches.
      //
      // The interior channels the seam rule was written for — neck against
      // trap, forearm against ribs — are enclosed by the figure on the axis they
      // run along, so none of them touches a pixel that survives the pass, and
      // none of them changes.
      const facesOpenSpace = STEPS.some(([dx, dy]) => staysOpen(x + dx, y + dy));
      const isSeam = seam !== 0 && hasInteriorEdge(seam) && !facesOpenSpace;
      setPx(g, x, y, isSeam ? interiorEdgeFor(seam) : outlineIndexForBank(pick));
    }
  }
}

/**
 * Remove single orphan pixels: a lit pixel with no lit 4-neighbour of the same
 * index. Isolated pixels are noise, and noise is what makes a generated sprite
 * look like a JPEG of a sprite.
 *
 * IT CANNOT TELL NOISE FROM A DELIBERATE ONE-PIXEL MARK, and it has eaten them
 * before: the face's two eye pixels, its mouth pixel and the chalked knuckle on
 * each hand were all drawn before this pass ran, and none of them survived into
 * a rendered PNG. Anything hand-placed is stamped AFTER this pass — see
 * `spriteMarks.ts` and the order in `renderLifterFrame`.
 */
export function despeckle(g: IndexGrid): void {
  const src = Uint8Array.from(g.data);
  const at = (x: number, y: number): number => {
    if (x < 0 || y < 0 || x >= g.w || y >= g.h) return 0;
    return src[y * g.w + x] ?? 0;
  };
  for (let y = 0; y < g.h; y += 1) {
    for (let x = 0; x < g.w; x += 1) {
      const v = at(x, y);
      if (isTransparentIndex(v)) continue;
      const same =
        (at(x - 1, y) === v ? 1 : 0) +
        (at(x + 1, y) === v ? 1 : 0) +
        (at(x, y - 1) === v ? 1 : 0) +
        (at(x, y + 1) === v ? 1 : 0);
      if (same > 0) continue;
      // Replace with whichever neighbour is most common; ties go to the left.
      const counts = new Map<number, number>();
      for (const n of [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)]) {
        if (isTransparentIndex(n)) continue;
        counts.set(n, (counts.get(n) ?? 0) + 1);
      }
      let best = v;
      let bestCount = 0;
      for (const [idx, c] of counts) {
        if (c > bestCount) {
          best = idx;
          bestCount = c;
        }
      }
      if (bestCount > 0) setPx(g, x, y, best);
    }
  }
}

/** Paint `over` on top of `base` wherever `over` is not transparent. */
export function compositeOver(base: IndexGrid, over: IndexGrid): void {
  const n = Math.min(base.data.length, over.data.length);
  for (let i = 0; i < n; i += 1) {
    const v = over.data[i] ?? 0;
    if (!isTransparentIndex(v)) base.data[i] = v;
  }
}

/** Nearest-neighbour integer upscale. The only scaling this project performs. */
export function upscaleGrid(g: IndexGrid, factor: number): IndexGrid {
  const f = Math.max(1, Math.round(factor));
  const out = createGrid(g.w * f, g.h * f);
  for (let y = 0; y < out.h; y += 1) {
    const sy = Math.floor(y / f);
    for (let x = 0; x < out.w; x += 1) {
      const sx = Math.floor(x / f);
      out.data[y * out.w + x] = g.data[sy * g.w + sx] ?? 0;
    }
  }
  return out;
}
