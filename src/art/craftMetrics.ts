/**
 * Craft metrics — the measurements that compare our sprite to real 16-bit
 * reference, computed rather than asserted in prose.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS
 * ---------------------------------------------------------------------------
 * `lifterSprite.test.ts` used to justify its bounds with sentences giving the
 * reference's upper half a pixel count, a mean luma and a near-black share.
 * Nothing in the repository opened `docs/reference/sprite-ref-1-snes-wrestling.png`.
 * Two such sentences in the same file disagreed by 17% on the same quantity and
 * the file shrugged at the contradiction, because there was no way for either
 * number to be wrong: a comment cannot fail. The retired figures are not
 * restated here either — `lifterSprite.test.ts` names them once, in the test
 * that forbids them, and nowhere else.
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
   * reference wrestler's darkest kit step (`@ref kit.luma0 = 39.5`) and well
   * below his darkest skin step (`@ref skin.luma0 = 52.8`), so it separates "a
   * black line" from "the dark end of a ramp" on the actual reference art.
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
   * distinction is the whole point. The case it was built for: our lifter's hair
   * used to be `HAIR_DARK` at luma 37.2, under NEAR_BLACK_LUMA, so a plain
   * near-black count scored a perfectly legitimate hair mass at 30-41% of the
   * head — a bigger number than any keyline defect would have produced, and one
   * no amount of drawing could have fixed. HAIR_DARK has since been lifted to
   * 45.2 (see palette.ts) so the hair is not in that class at all any more, and
   * this rule is what covers every OTHER dark mass, drawn or yet to be drawn.
   * A pixel is line-like when the near-black run through it is
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
  // WHAT IS *NOT* IN THIS BLOCK, AND WHY THAT IS THE POINT.
  //
  // There used to be five entries here of the form "the reference's measured
  // value x a factor": INTERIOR_KEYLINE_FACTOR 2.0, LIMB_INTERIOR_KEYLINE_FACTOR
  // 3.6, LIMB_NEAR_BLACK_FACTOR 5.5, FACE_INTERIOR_KEYLINE_FACTOR 5.5, and the
  // bracket UPPER_LOWER_RATIO_SLACK 0.22. Every one of them was a real
  // measurement of the reference multiplied by a number chosen after looking at
  // our own output — the doc comments said so, in the form "ours peaks at X,
  // against a cap of Y". A bound whose slack was picked by looking at the
  // artifact cannot grade the artifact; it is a ratchet on drift wearing a
  // comparison's name, and the direction of the ratchet was wrong in at least
  // one case. LIMB_MEAN_LUMA_FLOOR_FACTOR put the floor at 0.55 x 130.16 =
  // 71.6, which is BELOW SKIN_SHADOW's own luma of 73.0 — a limb rendered
  // entirely in the darkest colour its ramp has passed a test called "keeps no
  // limb darker than the reference figure".
  //
  // THE REPLACEMENT IS A RULE, NOT BETTER NUMBERS. Every bound in this suite is
  // now exactly one of two things and there is no third kind:
  //
  //   1. REFERENCE-DERIVED, WITH NO FREE TERM. Both the anchor and the slack
  //      are read off `sprite-ref-1`'s pixels: the bound is the reference's own
  //      worst comparable neighbourhood, measured with the same code, at the
  //      same pixel count as the window it is bounding (`neighbourhoodProfile`
  //      below). Nothing about our sprite appears in it, so it cannot be
  //      fitted to our sprite. If our drawing cannot meet it, the honest
  //      outcome is a red test, not a bigger multiplier.
  //   2. AN OURS-ONLY RATCHET, named so that it makes no reference claim, and
  //      declared in `lifterSprite.test.ts` beside a comment saying what it
  //      pins. These exist for quantities the two figures do not share — our
  //      silhouette keyline, which the reference measurably does not have.
  //
  // `craftMetrics.test.ts` asserts that no key in CRAFT ends in _FACTOR or
  // _SLACK, so category 1 cannot quietly grow a multiplier again.
  // -------------------------------------------------------------------------
  /** Below this many pixels a limb window is not measuring the limb. */
  MIN_LIMB_PIXELS: 12,
  /** Clearance past the deltoid before a pixel counts as arm, not torso. */
  LIMB_TORSO_CLEARANCE_PX: 0.5,
  /**
   * How much of the head's own lateral offset the neck window follows. The
   * throat runs from an off-centre skull to a centred shoulder line, so half is
   * the midpoint of the mass rather than either end of it.
   */
  NECK_WINDOW_HEAD_LEAN: 0.5,
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

/**
 * Rec.601 luma weights. Published coefficients, not a knob — the whole point of
 * measuring against a reference is that both sides use the same definition of
 * brightness, and this one is the definition the sprite tests have used since
 * the first of them.
 */
const REC601 = Object.freeze({ R: 0.299, G: 0.587, B: 0.114 });

/** Bytes per pixel in the straight RGBA8888 buffers this module reads. */
const RGBA_STRIDE = 4;

/** Rec.601 luma, the same weights the sprite tests have always used. */
export function luma8(r: number, g: number, b: number): number {
  return REC601.R * r + REC601.G * g + REC601.B * b;
}

/** Packed 0xRRGGBB of one image pixel. */
export function rgbAt(image: RgbaImage, x: number, y: number): number {
  const i = (y * image.width + x) * RGBA_STRIDE;
  return ((image.rgba[i] ?? 0) << 16) | ((image.rgba[i + 1] ?? 0) << 8) | (image.rgba[i + 2] ?? 0);
}

/** Luma of one image pixel. */
export function lumaAt(image: RgbaImage, x: number, y: number): number {
  const i = (y * image.width + x) * RGBA_STRIDE;
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
const SNES_CHANNEL_LEVELS = 32;

export const SNES_5BIT_CHANNEL_VALUES: readonly number[] = Array.from(
  { length: SNES_CHANNEL_LEVELS },
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
   * near-black AND touches something that is not this figure's own material.
   * That is a definition, not a guess, and `lifterSprite.test.ts` asserts on
   * real frames that every pixel this drops is `PAL.OUTLINE` — so it removes
   * the outline and nothing else, and in particular does not eat the lifter's
   * near-black hair, which the outline wraps rather than borders.
   *
   * "NOT THIS FIGURE'S MATERIAL" USED TO READ "OPEN SPACE", AND THE DIFFERENCE
   * WAS LOAD-BEARING. `outlinePass` outlines the lifter against the BARBELL as
   * well as against the backdrop — the equipment is a different palette bank,
   * so the boundary gets a keyline pixel there too. Under the old rule those
   * pixels stayed in the "material" field, where the interior-keyline and raw
   * near-black measures then counted them as marks drawn INSIDE the figure.
   * Measured over the full sweep, every single near-black pixel inside the arm,
   * hand and neck windows was one of them: `PAL.OUTLINE` where a forearm passes
   * a plate, reported as up to 16.7% of a limb "ringed in near-black". The
   * reference wrestler carries no keyline at all and holds no barbell, so the
   * quantity being compared did not exist on his side of the comparison.
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

  const foreignAt = (x: number, y: number): boolean =>
    x < 0 || y < 0 || x >= w || y >= h || (raw[y * w + x] ?? 0) === 0;
  const member = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const p = y * w + x;
      if ((raw[p] ?? 0) === 0) continue;
      const dark = (luma[p] ?? 0) < CRAFT.NEAR_BLACK_LUMA;
      const onSilhouette = NEIGHBOURS.some(([dx, dy]) => foreignAt(x + dx, y + dy));
      if (dark && onSilhouette) continue;
      member[p] = 1;
    }
  }
  return { w, h, luma, member };
}

// ---------------------------------------------------------------------------
// WHERE THE RAMP STEPS FALL
//
// Everything above this line is a SCALAR AGGREGATE over a set of pixels — mean
// luma, near-black share, interior-keyline share, lattice conformance. Shuffle
// every pixel inside a limb window and three of those five do not move at all.
// So they cannot see the thing that separates drawn 16-bit shading from a
// lambert field quantised into four steps: not how much of each value is
// present, but WHERE the steps fall — whether the bands are contiguous, whether
// the boundaries between them are smooth, whether there are two-pixel islands
// stranded in the middle of a mass.
//
// Two of the five numbers below are deliberately NOT permutation-invariant, and
// `craftMetrics.test.ts` proves it by shuffling a window and showing them move
// while the aggregates do not.
//
// The other three are ordinal facts about ramp POSITION rather than luma, which
// is what lets our four-step skin ramp be compared with the reference's
// six-step one at all: "the median sits on the darkest step" means the same
// thing on both sides, and "mean luma 80.6" does not.
// ---------------------------------------------------------------------------

/**
 * A field of ramp steps: for each pixel, which entry of a known ordered ramp it
 * was drawn with, or -1 for "not on this ramp".
 *
 * Built from palette indices on our side and from RGB on the reference's, so
 * the same measurement code runs over both.
 */
export interface StepField {
  readonly w: number;
  readonly h: number;
  /** -1 where the pixel is not on the ramp. */
  readonly step: Int16Array;
  readonly rampLength: number;
}

export interface RampStats {
  readonly count: number;
  /** Median ramp entry, or -1 for an empty window. 0 is the ramp's floor. */
  readonly medianStep: number;
  /** Share of pixels on the ramp's darkest entry. */
  readonly floorShare: number;
  /** Share on the top two entries — "does this mass reach the light". */
  readonly topTwoShare: number;
  /** Mean position in the ramp, 0 at the floor and 1 at the top. */
  readonly meanPosition: number;
  /**
   * Share of adjacent same-window pixel PAIRS whose ramp step differs.
   *
   * NOT PERMUTATION-INVARIANT. A mass drawn in contiguous bands has few
   * boundaries and scores low; the same pixels shuffled score near the value a
   * random arrangement gives, which is much higher. This is the measure of
   * "are the step boundaries smooth, or do they wander".
   */
  readonly bandBreakRate: number;
  /**
   * Share of pixels that are an ISLAND: no 4-neighbour inside the window shares
   * their ramp step.
   *
   * NOT PERMUTATION-INVARIANT either, and it is the direct form of the defect —
   * single stranded pixels of the wrong value speckled through a mass. Zero
   * parameters: an island is a component of one, which is a definition rather
   * than a threshold.
   */
  readonly isletShare: number;
}

const EMPTY_RAMP_STATS: RampStats = Object.freeze({
  count: 0,
  medianStep: -1,
  floorShare: 0,
  topTwoShare: 0,
  meanPosition: 0,
  bandBreakRate: 0,
  isletShare: 0,
});

/** Ramp step at (x, y), or -1 outside the field. */
export function stepAt(field: StepField, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= field.w || y >= field.h) return -1;
  return field.step[y * field.w + x] ?? -1;
}

/** How many entries of a ramp count as "the top two", for short ramps. */
const TOP_BAND_ENTRIES = 2;

/**
 * Ramp statistics over the pixels of `field` that `keep` accepts.
 *
 * `keep` is by coordinate, so the same function serves a limb window on our
 * sprite and an arbitrary neighbourhood on the reference.
 */
export function measureRamp(
  field: StepField,
  keep: (x: number, y: number) => boolean = EVERYWHERE,
): RampStats {
  const inside = (x: number, y: number): boolean => stepAt(field, x, y) >= 0 && keep(x, y);
  const histogram = new Array<number>(field.rampLength).fill(0);
  let count = 0;
  let stepSum = 0;
  let pairs = 0;
  let breaks = 0;
  let islets = 0;

  for (let y = 0; y < field.h; y += 1) {
    for (let x = 0; x < field.w; x += 1) {
      if (!inside(x, y)) continue;
      const s = stepAt(field, x, y);
      count += 1;
      stepSum += s;
      histogram[s] = (histogram[s] ?? 0) + 1;
      // Each unordered pair counted once: only look right and down.
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
      ] as const) {
        if (!inside(x + dx, y + dy)) continue;
        pairs += 1;
        if (stepAt(field, x + dx, y + dy) !== s) breaks += 1;
      }
      const joined = NEIGHBOURS.some(
        ([dx, dy]) => inside(x + dx, y + dy) && stepAt(field, x + dx, y + dy) === s,
      );
      if (!joined) islets += 1;
    }
  }
  if (count === 0) return EMPTY_RAMP_STATS;

  let seen = 0;
  let medianStep = 0;
  for (let s = 0; s < field.rampLength; s += 1) {
    seen += histogram[s] ?? 0;
    if (seen * 2 > count) {
      medianStep = s;
      break;
    }
  }
  let top = 0;
  for (let s = Math.max(0, field.rampLength - TOP_BAND_ENTRIES); s < field.rampLength; s += 1) {
    top += histogram[s] ?? 0;
  }
  const span = Math.max(1, field.rampLength - 1);
  return {
    count,
    medianStep,
    floorShare: (histogram[0] ?? 0) / count,
    topTwoShare: top / count,
    meanPosition: stepSum / count / span,
    bandBreakRate: pairs === 0 ? 0 : breaks / pairs,
    isletShare: islets / count,
  };
}

/**
 * A step field from one of our rendered frames: the pixels of `member` that
 * were drawn with one of `ramp`'s entries, indexed by their position in it.
 */
export function stepFieldFromIndexGrid(
  grid: IndexGrid,
  member: Uint8Array,
  ramps: readonly (readonly number[])[],
): StepField {
  const length = Math.max(...ramps.map((r) => r.length));
  const step = new Int16Array(grid.w * grid.h).fill(-1);
  for (let y = 0; y < grid.h; y += 1) {
    for (let x = 0; x < grid.w; x += 1) {
      const p = y * grid.w + x;
      if ((member[p] ?? 0) === 0) continue;
      const index = getPx(grid, x, y);
      for (const ramp of ramps) {
        const s = ramp.indexOf(index);
        if (s >= 0) {
          step[p] = s;
          break;
        }
      }
    }
  }
  return { w: grid.w, h: grid.h, step, rampLength: length };
}

/** A step field from a decoded reference image and an ordered list of colours. */
export function stepFieldFromColours(
  image: RgbaImage,
  box: PixelBox,
  rampDarkToLight: readonly number[],
): StepField {
  const step = new Int16Array(box.w * box.h).fill(-1);
  for (let j = 0; j < box.h; j += 1) {
    for (let i = 0; i < box.w; i += 1) {
      const s = rampDarkToLight.indexOf(rgbAt(image, box.x + i, box.y + j));
      if (s >= 0) step[j * box.w + i] = s;
    }
  }
  return { w: box.w, h: box.h, step, rampLength: rampDarkToLight.length };
}

/**
 * The worst that any limb-sized patch of a reference drawing does.
 *
 * THIS IS THE WHOLE BOUND MECHANISM, so it is worth being exact about what it
 * does and does not choose. For EVERY pixel on the ramp it takes the `n`
 * nearest ramp pixels — a compact patch of the drawing, of exactly the size of
 * the window being bounded — measures it with `measureRamp`, and reports the
 * extremes over all such patches.
 *
 * There is nothing to fit. `n` comes from the window on OUR side, which comes
 * from the rig; the centres are every pixel of the reference; the statistic is
 * the same code both sides run. No box is drawn by hand, no percentile is
 * chosen, no multiplier exists. Moving the bound requires a different reference
 * image.
 *
 * WHAT IT IS LOOSE ABOUT, said plainly: the reference's ramp pixels are its
 * whole figure's skin — face, chest, abs, thighs, arms — so "the worst patch"
 * includes shadow pockets under a pec that no limb of ours corresponds to.
 * That makes the bound EASIER than comparing arm to arm would be. It is the
 * price of not hand-drawing a box around the reference's arms, and the numbers
 * it produces are printed in full by `lifterSprite.test.ts` so the margin is
 * visible rather than asserted.
 */
export interface NeighbourhoodProfile {
  readonly n: number;
  readonly samples: number;
  readonly minMeanPosition: number;
  readonly maxFloorShare: number;
  readonly minMedianStep: number;
  readonly maxBandBreakRate: number;
  readonly maxIsletShare: number;
  /**
   * The AVERAGE patch, not the worst one.
   *
   * `maxBandBreakRate` and `maxIsletShare` are nearly vacuous as caps: the
   * reference's worst twelve-pixel patch is a scatter of single pixels across a
   * ramp boundary and scores 1.0, so no drawing could fail a bound set there.
   * The average over every patch of a given size is the other parameter-free
   * summary of the same distribution and it is not vacuous, so the structural
   * bounds compare average to average. Both are reported, so which one a check
   * uses is visible rather than buried.
   */
  readonly meanBandBreakRate: number;
  readonly meanIsletShare: number;
  readonly meanFloorShare: number;
  /** Share of patches whose median sits on the ramp's darkest entry. */
  readonly medianAtFloorRate: number;
  /** Share of patches that put nothing in the ramp's top two entries. */
  readonly zeroTopTwoRate: number;
}

/**
 * Profiles for several patch sizes at once.
 *
 * Several rather than one because the expensive half — sorting every ramp pixel
 * by distance from every other — depends only on the drawing, not on `n`. Doing
 * it once and taking prefixes turns a per-size O(P^2 log P) into one, which is
 * the difference between a bound the suite can afford to evaluate at each
 * window's own exact size and a bound that has to bucket sizes (and a bucketing
 * is a free parameter, which is the thing this whole mechanism exists to
 * remove).
 */
export function neighbourhoodProfiles(
  field: StepField,
  sizes: readonly number[],
): readonly NeighbourhoodProfile[] {
  const px: number[] = [];
  const py: number[] = [];
  for (let y = 0; y < field.h; y += 1) {
    for (let x = 0; x < field.w; x += 1) {
      if (stepAt(field, x, y) >= 0) {
        px.push(x);
        py.push(y);
      }
    }
  }
  const total = px.length;
  const orders: Int32Array[] = [];
  const index = Int32Array.from({ length: total }, (_, i) => i);
  for (let c = 0; c < total; c += 1) {
    const cx = px[c] ?? 0;
    const cy = py[c] ?? 0;
    const sorted = Array.from(index).sort(
      (a, b) =>
        ((px[a] ?? 0) - cx) ** 2 +
        ((py[a] ?? 0) - cy) ** 2 -
        (((px[b] ?? 0) - cx) ** 2 + ((py[b] ?? 0) - cy) ** 2),
    );
    orders.push(Int32Array.from(sorted));
  }

  return sizes.map((n) => {
    let samples = 0;
    let minMeanPosition = Infinity;
    let maxFloorShare = 0;
    let minMedianStep = Infinity;
    let maxBandBreakRate = 0;
    let maxIsletShare = 0;
    let sumBandBreakRate = 0;
    let sumIsletShare = 0;
    let sumFloorShare = 0;
    let medianAtFloor = 0;
    let zeroTopTwo = 0;
    for (const order of orders) {
      if (order.length < n) continue;
      const chosen = new Set<number>();
      for (let k = 0; k < n; k += 1) {
        const i = order[k] ?? 0;
        chosen.add((py[i] ?? 0) * field.w + (px[i] ?? 0));
      }
      const stats = measureRamp(field, (x, y) => chosen.has(y * field.w + x));
      samples += 1;
      minMeanPosition = Math.min(minMeanPosition, stats.meanPosition);
      maxFloorShare = Math.max(maxFloorShare, stats.floorShare);
      minMedianStep = Math.min(minMedianStep, stats.medianStep);
      maxBandBreakRate = Math.max(maxBandBreakRate, stats.bandBreakRate);
      maxIsletShare = Math.max(maxIsletShare, stats.isletShare);
      sumBandBreakRate += stats.bandBreakRate;
      sumIsletShare += stats.isletShare;
      sumFloorShare += stats.floorShare;
      if (stats.medianStep === 0) medianAtFloor += 1;
      if (stats.topTwoShare === 0) zeroTopTwo += 1;
    }
    const per = samples === 0 ? 0 : 1 / samples;
    return {
      n,
      samples,
      minMeanPosition: samples === 0 ? 0 : minMeanPosition,
      maxFloorShare,
      minMedianStep: samples === 0 ? -1 : minMedianStep,
      maxBandBreakRate,
      maxIsletShare,
      meanBandBreakRate: sumBandBreakRate * per,
      meanIsletShare: sumIsletShare * per,
      meanFloorShare: sumFloorShare * per,
      medianAtFloorRate: medianAtFloor * per,
      zeroTopTwoRate: zeroTopTwo * per,
    };
  });
}

/** One patch size. See `neighbourhoodProfiles` for why the plural is the API. */
export function neighbourhoodProfile(field: StepField, n: number): NeighbourhoodProfile {
  const [only] = neighbourhoodProfiles(field, [n]);
  if (only === undefined) throw new Error('no profile');
  return only;
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

  const headEllipse =
    (padding: number) =>
    (x: number, y: number): boolean => {
      const dx = (x - (centerX + pose.headDx)) / (G.HEAD_RX + padding);
      const dy = (y - pose.headY) / (G.HEAD_RY + padding);
      return dx * dx + dy * dy <= 1;
    };
  /** The head as MEASURED — padded, so its own edge ring is inside it. */
  const inHeadWindow = headEllipse(pad);
  /** The head as DRAWN. Everything the face's marks can land on is in here. */
  const inHeadDrawn = headEllipse(0);

  const windows: FieldWindow[] = [
    { name: 'head', contains: inHeadWindow },
    {
      name: 'neck',
      // THE DRAWN HEAD IS PUNCHED OUT, for the same reason the hands are
      // punched out of the arms below: two windows must never be the same
      // pixels. The neck capsule overlaps the skull by `NECK_OVERLAP` on
      // purpose, so the window's top row sat inside the drawn head — on the row
      // where `FACE_STRAINED` stamps its open mouth. Measured over the whole
      // sweep, every near-black pixel this window ever saw was that mouth or
      // the brow bar above it: 16.7% of a window named for the throat,
      // reported as "the neck is ringed in near-black". A face's hand-placed
      // marks belong to the face's own window and are judged there.
      //
      // The DRAWN ellipse rather than the padded one, so the throat keeps the
      // rows between the jaw and the traps that are the only neck this sprite
      // has.
      contains: (x, y) =>
        !inHeadDrawn(x, y) &&
        Math.abs(x - (centerX + pose.headDx * CRAFT.NECK_WINDOW_HEAD_LEAN)) <= G.NECK_R + G.NUDGE.NECK_FLARE + pad &&
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
