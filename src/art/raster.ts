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
import { isTransparentIndex, outlineIndexForBank, type Ramp } from './palette';

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
  const d = (u - profile.BELLY_FRAC) / Math.max(1e-6, profile.BELLY_WIDTH);
  const belly = Math.exp(-d * d);
  const w = Math.max(1e-6, profile.JOINT_WIDTH);
  const joint = Math.max(Math.max(0, 1 - u / w), Math.max(0, 1 - (1 - u) / w));
  return profile.BELLY_GAIN * belly - profile.JOINT_DROP * joint;
}

function thresholdsFor(steps: number): readonly number[] {
  if (steps >= 4) return SHADING.THRESHOLDS_4;
  if (steps === 3) return SHADING.THRESHOLDS_3;
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
  /** Shift the whole part's ramp step. Depth separation for far limbs. */
  readonly stepBias?: number;
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
   * thigh row reads 80 / 152 / 200 / 233 / 233 / 233 / 233 / 116 / 152 / 116:
   * one dark pixel where the light leaves the form, and a MID step, not a dark
   * one, on the other side. That asymmetry is most of what makes the reference's
   * limbs read as lit cylinders rather than as outlined tubes.
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
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return;
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
  const wantEdge = opts?.edge === true;
  const edgeIdx = edgeIndexFor(ramp, opts);
  const litEdge = opts?.edgeFollowsLight === true;
  const axial = opts?.axial ?? SHADING.AXIAL_LIMB;

  // Two passes so the outline never overwrites fill drawn later in the same part.
  for (let pass = wantEdge ? 0 : 1; pass < 2; pass += 1) {
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

        const rCore = Math.max(0.5, r);
        const n = Math.min(1, Math.max(-1, perp / rCore));
        const nz = Math.sqrt(Math.max(0, 1 - n * n));
        // `t` is the position DOWN the limb. Reading it here is the whole
        // difference between a modelled limb and an extruded stripe.
        const lit = Math.min(1, Math.max(0, lambert(px * n, py * n, nz) + axialTerm(axial, t)));
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

/** Ellipse shaded as an ellipsoid — head, hands, chalk-free round masses. */
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
  const wantEdge = opts?.edge === true;
  const edgeIdx = edgeIndexFor(ramp, opts);

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
        if (pass === 0) {
          setPx(g, x, y, edgeIdx);
          continue;
        }
        const nz = Math.sqrt(Math.max(0, 1 - q));
        setPx(g, x, y, shadeToIndex(ramp, lambert(nx, ny, nz), stepBias));
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
        const nx = (x - cx) / Math.max(0.5, hw);
        if (Math.abs(nx) > 1) continue;
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx));
        const vertical = SHADING.VERTICAL_GAIN * (1 - 2 * f);
        const lit = Math.min(
          1,
          Math.max(0, lambert(nx, 0, nz) + vertical + axialTerm(axial, f)),
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
      if (dy > r - 0.5 && facePx > 1 && x !== xInner) continue;
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
 */
export function outlinePass(g: IndexGrid): void {
  const src = Uint8Array.from(g.data);
  const at = (x: number, y: number): number => {
    if (x < 0 || y < 0 || x >= g.w || y >= g.h) return 0;
    return src[y * g.w + x] ?? 0;
  };

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
      if (pick !== 0) setPx(g, x, y, outlineIndexForBank(pick));
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
