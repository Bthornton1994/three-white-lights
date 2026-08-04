/**
 * Craft metrics — the measurements that compare our sprite to real 16-bit
 * reference, computed rather than asserted in prose.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS
 * ---------------------------------------------------------------------------
 * `lifterSprite.test.ts` used to justify its bounds with sentences like "the
 * reference's upper half is 553 px at mean luma 133.2, near-black 1.3%".
 * Nothing in the repository opened `docs/reference/sprite-ref-1-snes-wrestling.png`.
 * Two different such sentences in the same file disagreed by 17% on the same
 * quantity and the file shrugged at the contradiction, because there was no way
 * for either number to be wrong: a comment cannot fail.
 *
 * Everything here is pure — no file reads, no React — and takes decoded pixels.
 * The test does the I/O (that is the convention in this repo: `src/game/*.test.ts`
 * read files, `src/**\/*.ts` do not) and runs these functions over the real PNG.
 * A reference figure that moves now breaks a test instead of ageing quietly in a
 * comment.
 *
 * ---------------------------------------------------------------------------
 * THE CIRCULAR-MASK PROBLEM, AND WHAT REPLACES IT
 * ---------------------------------------------------------------------------
 * The old prose said the reference "has no keyline", and derived that from a
 * mask built out of the wrestler's own palette (skin ramp, trunks, hair). A
 * colour-keyed mask CANNOT answer that question: an outline is not one of the
 * body's colours, so it is excluded by construction and "no near-black inside
 * the mask" is guaranteed whether or not the figure is keylined.
 *
 * The fix is `litBoundaryDarkShare`. It looks at the pixel immediately OUTSIDE
 * the figure's own material — exactly where a keyline would live — and only at
 * the places where the pixel beyond THAT is lit, so a dark background cannot be
 * mistaken for a drawn outline. It is geometric, it is measured on both the
 * reference and on us, and it can come back either way:
 *
 *   - a keylined figure scores near 1.0 (ours does: the silhouette keyline is
 *     deliberate, GDD §12.2 wants it readable at phone scale over unknown
 *     scenery)
 *   - a figure contoured in its own darkest ramp step scores near 0.
 *
 * That single number is what licenses comparing INTERIOR near-black between us
 * and the reference while refusing to compare the raw share. If the reference
 * had turned out to be keylined, this metric would have said so and the bounds
 * would have had to move.
 */

import { BANK_SIZE, colorAt, isTransparentIndex, rgb5ToRgb8 } from './palette';
import { getPx, type IndexGrid } from './raster';
import { RIG_GEOMETRY, type Pose } from './rig';

// ---------------------------------------------------------------------------
// TUNING — every threshold this file compares against lives in this one block.
// These are bar constants (how close to the reference we require), not game
// feel, but the same rule applies: one place, named, hand-tunable.
// ---------------------------------------------------------------------------

export const CRAFT = {
  /**
   * Luma below which a pixel counts as "near-black". 40 sits above the
   * reference wrestler's darkest trunk step (39.5) and well below his darkest
   * skin step (52.8), so it separates "a black line" from "the dark end of a
   * ramp" on the actual reference art.
   */
  NEAR_BLACK_LUMA: 40,
  /**
   * Luma at or above which a pixel counts as a LIT background sample. Only
   * boundary crossings that end in lit background are used for the keyline
   * verdict, because a dark pixel between a figure and a dark background says
   * nothing about whether the figure was outlined.
   */
  LIT_BACKGROUND_LUMA: 90,
  /**
   * `litBoundaryDarkShare` at or above this reads as "this figure is keylined".
   * Below it, "this figure is contoured in its own ramp". Nothing in the suite
   * is allowed to compare a raw near-black share across that divide.
   */
  KEYLINE_VERDICT_SHARE: 0.6,
  /** A verdict taken on fewer crossings than this is not a verdict. */
  MIN_LIT_BOUNDARY_SAMPLES: 24,
  /**
   * Thickest near-black run that still counts as an INTERIOR LINE rather than a
   * MASS.
   *
   * Without this the measure cannot tell a keyline from dark material, and the
   * distinction is the whole point: our lifter's hair is `HAIR_DARK` at luma
   * 37.2, which is under NEAR_BLACK_LUMA, so a plain near-black count scored a
   * perfectly legitimate hair mass at 30-38% of the head — a bigger number than
   * any keyline defect would have produced, and one no amount of drawing could
   * ever have fixed. A pixel is line-like when the near-black run through it is
   * short along at least ONE axis; every pixel of a solid mass has a long run
   * along both, and every pixel of a one- or two-pixel band has a short one
   * across the band. 2 rather than 1 so the doubled band where two masses meet
   * still reads as a line.
   *
   * This governs `interiorKeylineShare` only. The SILHOUETTE keyline is
   * separated by position, not thickness — see `excludeSilhouetteKeyline`.
   */
  MAX_KEYLINE_THICKNESS_PX: 2,
  /**
   * Luma a sprite's transparent pixel is treated as, when asking what lies
   * beyond a keyline. A sprite is composited over unknown scenery, so its
   * outline exists to read against something lighter than itself; treating
   * open space as lit is the assumption the outline is drawn under.
   */
  ASSUMED_LIT_BACKGROUND: 255,

  // -------------------------------------------------------------------------
  // HOW MUCH SLACK OUR SPRITE GETS AGAINST THE MEASURED REFERENCE.
  //
  // Each of these multiplies a number READ OFF THE REFERENCE PNG, so the anchor
  // and the allowance stay separately visible and neither can be quietly moved
  // to fit. The margin each leaves over our sprite's own worst case across the
  // full pose/load/strain/pitch sweep is stated, because a factor with no
  // stated margin is indistinguishable from one fitted to today's output.
  // -------------------------------------------------------------------------
  /**
   * Whole-figure interior keyline, as a multiple of the reference's 2.79%.
   * Ours peaks at 3.64%, so this leaves 1.5x. Above 1 because the eyes, the
   * brow bar, the mouth and the belt's lever plate are hand-placed near-black
   * marks — what a 16-bit artist does with the darkest entry in a bank.
   */
  INTERIOR_KEYLINE_FACTOR: 2.0,
  /**
   * How far our upper/lower mean-luma ratio may sit either side of the
   * reference's 1.1138. Bracketed, not capped: a cap alone is directional and
   * a darker upper body satisfies it more easily, which is how the arms stayed
   * ringed in near-black through several rounds. Ours runs 0.937-1.211 on the
   * material field and 1.011-1.315 with the keyline, so the tight side of the
   * bracket is 0.043 away and the loose side 0.019.
   */
  UPPER_LOWER_RATIO_SLACK: 0.22,
  /**
   * A limb's mean luma, as a fraction of the reference figure's 130.16. This is
   * the direct form of "the arms are not the darkest thing on him". Ours
   * bottoms out at 80.6 on the shaded far arm, against a floor of 71.6.
   */
  LIMB_MEAN_LUMA_FLOOR_FACTOR: 0.55,
  /**
   * An arm's or hand's interior keyline, as a multiple of the reference
   * figure's 2.79%. Ours peaks at 8.1%, against a cap of 10.1%.
   */
  LIMB_INTERIOR_KEYLINE_FACTOR: 3.6,
  /**
   * A head's or neck's interior keyline, as a multiple of the REFERENCE HEAD's
   * own 3.67% — a separate anchor, because a face carries marks a forearm does
   * not and one bound over both would either be too loose for the arm or would
   * fail a face for having eyes. Ours peaks at 16.9% on the head and 13.3% on
   * the neck, against a cap of 20.2%. This is the loosest factor here and it is
   * the one to tighten first if the face is ever redrawn.
   */
  FACE_INTERIOR_KEYLINE_FACTOR: 5.5,
  /** Below this many pixels a limb window is not measuring the limb. */
  MIN_LIMB_PIXELS: 12,
  /** Clearance past the deltoid before a pixel counts as arm, not torso. */
  LIMB_TORSO_CLEARANCE_PX: 0.5,
  /** Padding on a limb window's radius, covering the interior edge ring. */
  LIMB_WINDOW_PAD_PX: 1.2,
} as const;

// ---------------------------------------------------------------------------
// Pixels
// ---------------------------------------------------------------------------

/** Decoded, straight (non-premultiplied) RGBA8888, row-major. */
export interface RgbaImage {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array;
}

/** A rectangle in image pixels. */
export interface PixelBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Rec.601 luma, the same weights the sprite tests have always used. */
export function luma8(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Packed 0xRRGGBB of one image pixel. */
export function rgbAt(image: RgbaImage, x: number, y: number): number {
  const i = (y * image.width + x) * 4;
  return ((image.rgba[i] ?? 0) << 16) | ((image.rgba[i + 1] ?? 0) << 8) | (image.rgba[i + 2] ?? 0);
}

/** Luma of one image pixel. */
export function lumaAt(image: RgbaImage, x: number, y: number): number {
  const i = (y * image.width + x) * 4;
  return luma8(image.rgba[i] ?? 0, image.rgba[i + 1] ?? 0, image.rgba[i + 2] ?? 0);
}

// ---------------------------------------------------------------------------
// Era conformance — the check that can tell ref-1 from ref-2
// ---------------------------------------------------------------------------

/**
 * The 32 8-bit values a SNES 5-bit channel can take, expanded the way hardware
 * and emulators do it: `(c << 3) | (c >> 2)`. `palette.ts` builds every colour
 * we draw through exactly this expansion, so our art lands on this lattice by
 * construction — and so does anything actually captured from the hardware.
 */
export const SNES_5BIT_CHANNEL_VALUES: readonly number[] = Array.from(
  { length: 32 },
  (_, c) => (c << 3) | (c >> 2),
);

const SNES_LATTICE = new Set(SNES_5BIT_CHANNEL_VALUES);

/** True when an 8-bit channel value is reachable from a 5-bit hardware channel. */
export function isSnesLatticeChannel(value: number): boolean {
  return SNES_LATTICE.has(value);
}

export interface EraConformance {
  readonly distinctColours: number;
  readonly latticeColours: number;
  /** Share of PIXELS whose colour lies on the 5-bit lattice. */
  readonly latticePixelShare: number;
}

/**
 * How much of an image could have come off 16-bit hardware.
 *
 * This is the discriminator the §12.2 blind A/B needs and the one thing in this
 * file that separates the two committed sprite references without any judgement
 * call: `sprite-ref-1` is a native 256x224 SNES frame and every colour in it
 * sits on the lattice; `sprite-ref-2` is modern pixel art of a current MLB
 * player and almost none of it does, because resampling invented colours
 * between the hardware steps. A check that scored them the same would not be
 * measuring era craft.
 */
export function measureEraConformance(image: RgbaImage, box?: PixelBox): EraConformance {
  const region = box ?? { x: 0, y: 0, w: image.width, h: image.height };
  const counts = new Map<number, number>();
  for (let y = region.y; y < region.y + region.h; y += 1) {
    for (let x = region.x; x < region.x + region.w; x += 1) {
      const key = rgbAt(image, x, y);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  let latticeColours = 0;
  let latticePixels = 0;
  let totalPixels = 0;
  for (const [key, n] of counts) {
    totalPixels += n;
    const on =
      isSnesLatticeChannel((key >> 16) & 0xff) &&
      isSnesLatticeChannel((key >> 8) & 0xff) &&
      isSnesLatticeChannel(key & 0xff);
    if (on) {
      latticeColours += 1;
      latticePixels += n;
    }
  }
  return {
    distinctColours: counts.size,
    latticeColours,
    latticePixelShare: totalPixels === 0 ? 0 : latticePixels / totalPixels,
  };
}

// ---------------------------------------------------------------------------
// Figure fields
// ---------------------------------------------------------------------------

/**
 * A rectangle of luma with a membership mask.
 *
 * `member` marks the figure's own MATERIAL — skin, kit, hair. A silhouette
 * keyline is deliberately NOT material: it is the band immediately outside,
 * which is what `litBoundaryDarkShare` goes looking for. `luma` is defined for
 * every pixel of the field, member or not, because the keyline test has to read
 * two pixels outward.
 */
export interface FigureField {
  readonly w: number;
  readonly h: number;
  readonly luma: Float64Array;
  readonly member: Uint8Array;
}

export interface RegionStats {
  readonly count: number;
  readonly meanLuma: number;
  readonly nearBlackShare: number;
  /**
   * Near-black pixels that are enclosed by material on all four sides AND are
   * part of a thin run — a LINE drawn inside the figure, not a dark mass and
   * not the silhouette keyline. This is the measure that survives the keyline
   * difference between us and the reference, so it is the one the bounds are
   * anchored to.
   */
  readonly interiorKeylineShare: number;
  /** Boundary crossings into lit background, and how many are dark. */
  readonly litBoundarySamples: number;
  readonly litBoundaryDarkShare: number;
}

export interface FigureMetrics extends RegionStats {
  /** Row the figure is split at: its own vertical midpoint, in field rows. */
  readonly midRow: number;
  readonly upper: RegionStats;
  readonly lower: RegionStats;
  readonly upperOverLowerMean: number;
}

const inField = (f: FigureField, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < f.w && y < f.h;

const isMember = (f: FigureField, x: number, y: number): boolean =>
  inField(f, x, y) && (f.member[y * f.w + x] ?? 0) === 1;

const lumaOfField = (f: FigureField, x: number, y: number): number => f.luma[y * f.w + x] ?? 0;

const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * Is (x, y) a keyline-probe crossing, and is the probe dark?
 *
 * Walks one step out of the figure into `r`, then one more to `o`. The crossing
 * only counts when `o` is lit, so a figure standing in front of black crowd is
 * not credited with an outline it does not have. `r` is the pixel a keyline
 * would occupy.
 */
function litCrossing(f: FigureField, x: number, y: number): { sampled: boolean; dark: boolean } {
  for (const [dx, dy] of NEIGHBOURS) {
    const rx = x + dx;
    const ry = y + dy;
    if (!inField(f, rx, ry) || isMember(f, rx, ry)) continue;
    const ox = x + 2 * dx;
    const oy = y + 2 * dy;
    if (!inField(f, ox, oy) || isMember(f, ox, oy)) continue;
    if (lumaOfField(f, ox, oy) < CRAFT.LIT_BACKGROUND_LUMA) continue;
    return { sampled: true, dark: lumaOfField(f, rx, ry) < CRAFT.NEAR_BLACK_LUMA };
  }
  return { sampled: false, dark: false };
}

/** Near-black material at (x, y). */
const isDarkMaterial = (f: FigureField, x: number, y: number): boolean =>
  isMember(f, x, y) && lumaOfField(f, x, y) < CRAFT.NEAR_BLACK_LUMA;

/** Length of the maximal near-black material run through (x, y) along (dx, dy). */
function darkRun(f: FigureField, x: number, y: number, dx: number, dy: number): number {
  let n = 1;
  for (let k = 1; isDarkMaterial(f, x + k * dx, y + k * dy); k += 1) n += 1;
  for (let k = 1; isDarkMaterial(f, x - k * dx, y - k * dy); k += 1) n += 1;
  return n;
}

/**
 * A near-black pixel drawn as a LINE inside the figure.
 *
 * Three conditions, and each is load-bearing: near-black (it is a dark mark),
 * enclosed on all four sides by material (it is not the silhouette keyline,
 * which we keep on purpose and the reference does not have), and thin along at
 * least one axis (it is a line, not a mass of dark material like hair).
 */
function isInteriorKeyline(f: FigureField, x: number, y: number): boolean {
  if (!isDarkMaterial(f, x, y)) return false;
  if (!NEIGHBOURS.every(([dx, dy]) => isMember(f, x + dx, y + dy))) return false;
  const thickness = Math.min(darkRun(f, x, y, 1, 0), darkRun(f, x, y, 0, 1));
  return thickness <= CRAFT.MAX_KEYLINE_THICKNESS_PX;
}

/** A window onto part of a figure — a limb, a half, the whole thing. */
export interface FieldWindow {
  readonly name: string;
  readonly contains: (x: number, y: number) => boolean;
}

const EVERYWHERE = (): boolean => true;

/**
 * Statistics over the material inside `keep`.
 *
 * Interior/boundary are evaluated against the WHOLE field, not against the
 * window, so a limb window does not manufacture a boundary where the limb
 * simply continues into the torso.
 */
export function measureRegion(
  field: FigureField,
  keep: (x: number, y: number) => boolean = EVERYWHERE,
): RegionStats {
  let count = 0;
  let sum = 0;
  let nearBlack = 0;
  let interiorKeyline = 0;
  let litSamples = 0;
  let litDark = 0;
  for (let y = 0; y < field.h; y += 1) {
    for (let x = 0; x < field.w; x += 1) {
      if (!isMember(field, x, y) || !keep(x, y)) continue;
      const l = lumaOfField(field, x, y);
      count += 1;
      sum += l;
      if (l < CRAFT.NEAR_BLACK_LUMA) {
        nearBlack += 1;
        if (isInteriorKeyline(field, x, y)) interiorKeyline += 1;
      }
      const crossing = litCrossing(field, x, y);
      if (crossing.sampled) {
        litSamples += 1;
        if (crossing.dark) litDark += 1;
      }
    }
  }
  return {
    count,
    meanLuma: count === 0 ? 0 : sum / count,
    nearBlackShare: count === 0 ? 0 : nearBlack / count,
    interiorKeylineShare: count === 0 ? 0 : interiorKeyline / count,
    litBoundarySamples: litSamples,
    litBoundaryDarkShare: litSamples === 0 ? 0 : litDark / litSamples,
  };
}

/** Whole-figure statistics, plus the split at the figure's own midpoint. */
export function measureFigure(field: FigureField): FigureMetrics {
  let minY = Infinity;
  let maxY = -Infinity;
  for (let y = 0; y < field.h; y += 1) {
    for (let x = 0; x < field.w; x += 1) {
      if (!isMember(field, x, y)) continue;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const midRow = minY > maxY ? 0 : (minY + maxY) / 2;
  const whole = measureRegion(field);
  const upper = measureRegion(field, (_x, y) => y < midRow);
  const lower = measureRegion(field, (_x, y) => y >= midRow);
  return {
    ...whole,
    midRow,
    upper,
    lower,
    upperOverLowerMean: lower.meanLuma === 0 ? 0 : upper.meanLuma / lower.meanLuma,
  };
}

/** True when a figure carries a drawn silhouette keyline. */
export function isKeylined(stats: RegionStats): boolean {
  return (
    stats.litBoundarySamples >= CRAFT.MIN_LIT_BOUNDARY_SAMPLES &&
    stats.litBoundaryDarkShare >= CRAFT.KEYLINE_VERDICT_SHARE
  );
}

// ---------------------------------------------------------------------------
// Building a field from a reference photograph
// ---------------------------------------------------------------------------

/**
 * The figure inside `box` whose colours are in `materialColours`, keeping only
 * the largest 8-connected blob so a bystander drawn from the same ramp is not
 * counted.
 *
 * The colour key here is honest ONLY because nothing downstream asks it whether
 * the figure is outlined — `litBoundaryDarkShare` answers that from the band
 * outside this mask, which is precisely where a colour key cannot look.
 */
export function colourKeyedField(
  image: RgbaImage,
  box: PixelBox,
  materialColours: Iterable<number>,
): FigureField {
  const wanted = new Set(materialColours);
  const w = box.w;
  const h = box.h;
  const luma = new Float64Array(w * h);
  const candidate = new Uint8Array(w * h);
  for (let j = 0; j < h; j += 1) {
    for (let i = 0; i < w; i += 1) {
      const x = box.x + i;
      const y = box.y + j;
      luma[j * w + i] = lumaAt(image, x, y);
      candidate[j * w + i] = wanted.has(rgbAt(image, x, y)) ? 1 : 0;
    }
  }
  return { w, h, luma, member: largestBlob(candidate, w, h) };
}

/** Largest 8-connected component of a binary mask; ties go to the first found. */
export function largestBlob(mask: Uint8Array, w: number, h: number): Uint8Array {
  const label = new Int32Array(w * h).fill(-1);
  let bestId = -1;
  let bestSize = 0;
  let nextId = 0;
  for (let seed = 0; seed < w * h; seed += 1) {
    if ((mask[seed] ?? 0) === 0 || (label[seed] ?? -1) >= 0) continue;
    const id = nextId;
    nextId += 1;
    let size = 0;
    const stack: number[] = [seed];
    label[seed] = id;
    while (stack.length > 0) {
      const p = stack.pop() ?? 0;
      size += 1;
      const px = p % w;
      const py = Math.floor(p / w);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const qx = px + dx;
          const qy = py + dy;
          if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue;
          const q = qy * w + qx;
          if ((mask[q] ?? 0) === 1 && (label[q] ?? -1) < 0) {
            label[q] = id;
            stack.push(q);
          }
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      bestId = id;
    }
  }
  const out = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p += 1) out[p] = (label[p] ?? -1) === bestId && bestId >= 0 ? 1 : 0;
  return out;
}

// ---------------------------------------------------------------------------
// Building a field from one of our own rendered frames
// ---------------------------------------------------------------------------

export interface SpriteFieldOptions {
  /** Palette bank to treat as the figure. 0 is the lifter; 1 is equipment. */
  readonly bank?: number;
  /**
   * Drop the silhouette keyline, so `member` is the figure's MATERIAL and the
   * keyline becomes the band outside it — the same shape of mask the reference
   * gets, so the two can be compared.
   *
   * The rule is exactly `outlinePass`'s: a pixel is keyline when it is
   * near-black AND touches open space. That is a definition, not a guess, and
   * `lifterSprite.test.ts` asserts on real frames that every pixel this drops
   * is `PAL.OUTLINE` — so it removes the outline and nothing else, and in
   * particular does not eat the lifter's near-black hair, which the outline
   * wraps rather than borders.
   */
  readonly excludeSilhouetteKeyline?: boolean;
}

/**
 * A field from a rendered frame.
 *
 * Transparent pixels are given `ASSUMED_LIT_BACKGROUND` rather than a luma of
 * zero: a sprite's outline is drawn to separate it from scenery it has not met
 * yet, so open space is the lit side of that crossing. Equipment pixels keep
 * their real luma, so a hand resting against a plate is judged against the
 * plate.
 */
export function fieldFromIndexGrid(grid: IndexGrid, options: SpriteFieldOptions = {}): FigureField {
  const bank = options.bank ?? 0;
  const w = grid.w;
  const h = grid.h;
  const luma = new Float64Array(w * h);
  const raw = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const index = getPx(grid, x, y);
      const p = y * w + x;
      if (isTransparentIndex(index)) {
        luma[p] = CRAFT.ASSUMED_LIT_BACKGROUND;
        continue;
      }
      const c5 = colorAt(index);
      if (c5 === undefined) {
        luma[p] = CRAFT.ASSUMED_LIT_BACKGROUND;
        continue;
      }
      const [r, g, b] = rgb5ToRgb8(c5);
      luma[p] = luma8(r, g, b);
      if (Math.floor(index / BANK_SIZE) === bank) raw[p] = 1;
    }
  }
  if (options.excludeSilhouetteKeyline !== true) return { w, h, luma, member: raw };

  const openAt = (x: number, y: number): boolean =>
    x < 0 || y < 0 || x >= w || y >= h || isTransparentIndex(getPx(grid, x, y));
  const member = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const p = y * w + x;
      if ((raw[p] ?? 0) === 0) continue;
      const dark = (luma[p] ?? 0) < CRAFT.NEAR_BLACK_LUMA;
      const onSilhouette = NEIGHBOURS.some(([dx, dy]) => openAt(x + dx, y + dy));
      if (dark && onSilhouette) continue;
      member[p] = 1;
    }
  }
  return { w, h, luma, member };
}

// ---------------------------------------------------------------------------
// Limb windows
// ---------------------------------------------------------------------------

/** Distance from (x, y) to the segment a->b. */
function distanceToSegment(
  x: number,
  y: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { d: number; t: number } {
  const vx = bx - ax;
  const vy = by - ay;
  const len2 = vx * vx + vy * vy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / len2));
  const px = ax + t * vx;
  const py = ay + t * vy;
  return { d: Math.hypot(x - px, y - py), t };
}

/** Inside the capsule from a to b whose radius runs `ra` -> `rb`. */
function inCapsule(
  x: number,
  y: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  ra: number,
  rb: number,
  pad: number,
): boolean {
  const { d, t } = distanceToSegment(x, y, ax, ay, bx, by);
  return d <= ra + (rb - ra) * t + pad;
}

export interface LimbGeometry {
  readonly pose: Pose;
  readonly centerX: number;
  /** Drawn hand centres, in sprite px, left then right. */
  readonly handCentres: readonly { readonly x: number; readonly y: number }[];
}

/**
 * Windows that isolate the parts a whole-half aggregate cannot see.
 *
 * The test this replaces was named for the arms and measured the entire upper
 * half — head, neck, traps, pecs, singlet, belt, both arms, both hands — as one
 * number, so three of the four parts it was named for could have regressed to a
 * full near-black ring without moving the aggregate past its cap. Each window
 * below is small enough that a regression inside it dominates its own number.
 *
 * The arm windows are clipped to `|x - centerX| >= torso clearance`, which is
 * what keeps them off the deltoid and the trap mass. The hands are punched out
 * of the arms so the two are never the same pixels.
 */
export function limbWindows(geometry: LimbGeometry): readonly FieldWindow[] {
  const { pose, centerX, handCentres } = geometry;
  const G = RIG_GEOMETRY;
  const pad = CRAFT.LIMB_WINDOW_PAD_PX;
  const torsoOut =
    Math.max(
      pose.shoulderHalfW * G.ATTACH.TRAP_HALF_W,
      pose.shoulderHalfW * G.ATTACH.DELTOID + G.ATTACH.DELTOID_R,
    ) + CRAFT.LIMB_TORSO_CLEARANCE_PX;
  const handR = G.HAND_R + G.NUDGE.HAND_TALL + pad;

  const inAnyHand = (x: number, y: number): boolean =>
    handCentres.some((c) => Math.hypot(x - c.x, y - c.y) <= handR);

  const windows: FieldWindow[] = [
    {
      name: 'head',
      contains: (x, y) => {
        const dx = (x - (centerX + pose.headDx)) / (G.HEAD_RX + pad);
        const dy = (y - pose.headY) / (G.HEAD_RY + pad);
        return dx * dx + dy * dy <= 1;
      },
    },
    {
      name: 'neck',
      contains: (x, y) =>
        Math.abs(x - (centerX + pose.headDx * 0.5)) <= G.NECK_R + G.NUDGE.NECK_FLARE + pad &&
        y >= pose.headY + G.HEAD_RY - G.NECK_OVERLAP - pad &&
        y <= pose.shoulderY - G.ATTACH.TRAP_RISE + pad,
    },
  ];

  for (const [side, sign] of [
    ['left', -1],
    ['right', 1],
  ] as const) {
    const shX = centerX + sign * pose.shoulderHalfW * G.ATTACH.ARM_ROOT;
    const elX = centerX + sign * pose.elbowHalfW;
    const grip = pose.handHalfW + (sign > 0 ? G.GRIP_ASYMMETRY_PX : 0);
    const haX = centerX + sign * grip;
    windows.push({
      name: `${side} arm`,
      contains: (x, y) =>
        Math.abs(x - centerX) >= torsoOut &&
        Math.sign(x - centerX) === sign &&
        !inAnyHand(x, y) &&
        (inCapsule(x, y, shX, pose.shoulderY, elX, pose.elbowY, G.UPPER_ARM_R[0], G.UPPER_ARM_R[1], pad) ||
          inCapsule(x, y, elX, pose.elbowY, haX, pose.handY, G.FOREARM_R[0], G.FOREARM_R[1], pad)),
    });
  }

  handCentres.forEach((c, i) => {
    windows.push({
      name: `${i === 0 ? 'left' : 'right'} hand`,
      contains: (x, y) => Math.hypot(x - c.x, y - c.y) <= handR,
    });
  });

  return windows;
}
