import { describe, expect, it } from 'vitest';
import {
  CRAFT,
  SNES_5BIT_CHANNEL_VALUES,
  colourKeyedField,
  fieldFromIndexGrid,
  isKeylined,
  isSnesLatticeChannel,
  largestBlob,
  limbWindows,
  luma8,
  lumaAt,
  measureEraConformance,
  measureFigure,
  measureRamp,
  measureRegion,
  rgbAt,
  type FigureField,
  type PixelBox,
  type StepField,
  type RgbaImage,
} from './craftMetrics';
import { PAL, colorAt, rgb5ToRgb8 } from './palette';
import { createGrid, setPx, type IndexGrid } from './raster';
import { POSES } from './rig';

// ---------------------------------------------------------------------------
// Synthetic fixtures. Every metric in this module has to be able to come back
// BOTH ways, so each is exercised on a drawing built to say yes and one built
// to say no. A metric that only ever sees our sprite and the one reference is
// a metric nobody has watched fail.
// ---------------------------------------------------------------------------

/**
 * Build a field from an ASCII picture.
 *
 *   `.`  lit background, not material
 *   `~`  DARK background, not material — a figure standing in front of black
 *   `K`  near-black, not material — a keyline, which lives outside the material
 *   `#`  near-black material
 *   0-9  material at luma `digit * 25`
 */
function fieldFrom(rows: readonly string[]): FigureField {
  const h = rows.length;
  const w = (rows[0] ?? '').length;
  const luma = new Float64Array(w * h);
  const member = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) {
    const row = rows[y] ?? '';
    expect(row.length, `row ${y} is ragged`).toBe(w);
    for (let x = 0; x < w; x += 1) {
      const c = row[x] ?? '.';
      const p = y * w + x;
      if (c === '.') {
        luma[p] = 200;
      } else if (c === '~' || c === 'K') {
        luma[p] = 10;
      } else if (c === '#') {
        luma[p] = 19;
        member[p] = 1;
      } else {
        luma[p] = Number(c) * 25;
        member[p] = 1;
      }
    }
  }
  return { w, h, luma, member };
}

const rgbaFrom = (width: number, height: number, pixels: readonly number[]): RgbaImage => {
  const rgba = new Uint8Array(width * height * 4);
  pixels.forEach((key, i) => {
    rgba[i * 4] = (key >> 16) & 0xff;
    rgba[i * 4 + 1] = (key >> 8) & 0xff;
    rgba[i * 4 + 2] = key & 0xff;
    rgba[i * 4 + 3] = 255;
  });
  return { width, height, rgba };
};

describe('luma and pixel access', () => {
  it('uses Rec.601 weights', () => {
    expect(luma8(255, 255, 255)).toBeCloseTo(255, 6);
    expect(luma8(0, 0, 0)).toBe(0);
    expect(luma8(255, 0, 0)).toBeCloseTo(76.245, 3);
    expect(luma8(0, 255, 0)).toBeCloseTo(149.685, 3);
    expect(luma8(0, 0, 255)).toBeCloseTo(29.07, 3);
  });

  it('reads the pixel it is asked for, not its neighbour', () => {
    const image = rgbaFrom(2, 2, [0x000000, 0xff0000, 0x00ff00, 0x0000ff]);
    expect(rgbAt(image, 1, 0)).toBe(0xff0000);
    expect(rgbAt(image, 0, 1)).toBe(0x00ff00);
    expect(rgbAt(image, 1, 1)).toBe(0x0000ff);
    expect(lumaAt(image, 0, 0)).toBe(0);
    expect(lumaAt(image, 1, 1)).toBeCloseTo(29.07, 3);
  });
});

describe('SNES 5-bit lattice conformance', () => {
  it('lists the 32 values a 5-bit channel expands to', () => {
    expect(SNES_5BIT_CHANNEL_VALUES).toHaveLength(32);
    expect(SNES_5BIT_CHANNEL_VALUES[0]).toBe(0);
    expect(SNES_5BIT_CHANNEL_VALUES[31]).toBe(255);
    // (c << 3) | (c >> 2), not c * 255 / 31 — 3 expands to 24, never 25.
    expect(SNES_5BIT_CHANNEL_VALUES[3]).toBe(24);
    expect(isSnesLatticeChannel(24)).toBe(true);
    expect(isSnesLatticeChannel(25)).toBe(false);
  });

  it('scores an on-lattice image at 1 and an off-lattice one near 0', () => {
    const hardware = rgbaFrom(2, 1, [0xf7e7d6, 0x101010]);
    expect(measureEraConformance(hardware)).toEqual({
      distinctColours: 2,
      latticeColours: 2,
      latticePixelShare: 1,
    });
    // One channel value off the lattice is enough, which is the point: a
    // resampled image misses it on almost every colour.
    const resampled = rgbaFrom(2, 1, [0xefcf31, 0xa5aeb5]);
    expect(measureEraConformance(resampled).latticeColours).toBe(0);
    expect(measureEraConformance(resampled).latticePixelShare).toBe(0);
  });

  it('measures only the box it is given', () => {
    const image = rgbaFrom(2, 1, [0xf7e7d6, 0xefcf31]);
    const box: PixelBox = { x: 0, y: 0, w: 1, h: 1 };
    expect(measureEraConformance(image, box).latticePixelShare).toBe(1);
    expect(measureEraConformance(image, { ...box, x: 1 }).latticePixelShare).toBe(0);
  });
});

describe('largestBlob', () => {
  it('keeps the biggest 8-connected component and drops the rest', () => {
    // Two blobs: 4 px on the left, 2 px on the right, not touching.
    const mask = new Uint8Array([1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0]);
    expect([...largestBlob(mask, 4, 3)]).toEqual([1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0]);
  });

  it('returns an empty mask for an empty input', () => {
    expect([...largestBlob(new Uint8Array(4), 2, 2)]).toEqual([0, 0, 0, 0]);
  });

  it('joins diagonals, because a sprite limb can pass through a corner', () => {
    const mask = new Uint8Array([1, 0, 0, 1]);
    expect([...largestBlob(mask, 2, 2)]).toEqual([1, 0, 0, 1]);
  });
});

describe('colourKeyedField', () => {
  const image = rgbaFrom(
    4,
    3,
    [
      0xf7e7d6, 0xf7e7d6, 0x101010, 0xf7e7d6, //
      0xf7e7d6, 0xf7e7d6, 0x101010, 0x101010,
      0x101010, 0x101010, 0x101010, 0x101010,
    ],
  );

  it('masks the material colours and keeps only the largest blob', () => {
    const field = colourKeyedField(image, { x: 0, y: 0, w: 4, h: 3 }, [0xf7e7d6]);
    expect([...field.member]).toEqual([1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0]);
  });

  it('keeps the luma of NON-material pixels too, because the keyline test needs it', () => {
    const field = colourKeyedField(image, { x: 0, y: 0, w: 4, h: 3 }, [0xf7e7d6]);
    expect(field.luma[2]).toBeCloseTo(16, 6);
    expect(field.luma[0]).toBeCloseTo(233.85, 1);
  });

  it('is empty when the colour key names nothing in the image', () => {
    const field = colourKeyedField(image, { x: 0, y: 0, w: 4, h: 3 }, [0x123456]);
    expect(measureFigure(field).count).toBe(0);
  });
});

describe('the keyline verdict can come back either way', () => {
  // A 6x6 block of mid material with a one-pixel black ring OUTSIDE it, on lit
  // background — the shape our own sprite has once the keyline is taken off the
  // material, which is how `fieldFromIndexGrid` presents it.
  const keylined = fieldFrom([
    '..........',
    '.KKKKKKKK.',
    '.K555555K.',
    '.K555555K.',
    '.K555555K.',
    '.K555555K.',
    '.K555555K.',
    '.K555555K.',
    '.KKKKKKKK.',
    '..........',
  ]);
  // The same block contoured in its own darkest step (luma 75) instead — the
  // shape the reference wrestler has.
  const contoured = fieldFrom([
    '..........',
    '.33333333.',
    '.35555553.',
    '.35555553.',
    '.35555553.',
    '.35555553.',
    '.35555553.',
    '.35555553.',
    '.33333333.',
    '..........',
  ]);

  it('reads a black ring as a keyline', () => {
    const m = measureFigure(keylined);
    expect(m.litBoundaryDarkShare).toBe(1);
    expect(m.litBoundarySamples).toBeGreaterThan(0);
  });

  it('reads a figure contoured in its own ramp as NOT keylined', () => {
    const m = measureFigure(contoured);
    expect(m.litBoundaryDarkShare).toBe(0);
    expect(isKeylined(m)).toBe(false);
  });

  it('refuses to credit a dark BACKGROUND as an outline', () => {
    // The failure mode that made the old prose circular in the other direction:
    // this figure has no keyline, it is simply standing in front of black.
    // Every crossing here ends in dark background, so none is sampled.
    const onBlack = fieldFrom([
      '~~~~~~~~',
      '~333333~',
      '~355553~',
      '~355553~',
      '~333333~',
      '~~~~~~~~',
    ]);
    expect(measureFigure(onBlack).litBoundarySamples).toBe(0);
    expect(isKeylined(measureFigure(onBlack))).toBe(false);
  });

  it('will not return a verdict on too few crossings', () => {
    const tiny = fieldFrom(['.....', '.KKK.', '.K5K.', '.KKK.', '.....']);
    const m = measureFigure(tiny);
    expect(m.litBoundaryDarkShare).toBe(1);
    expect(m.litBoundarySamples).toBeLessThan(CRAFT.MIN_LIT_BOUNDARY_SAMPLES);
    expect(isKeylined(m)).toBe(false);
  });
});

describe('interior keyline is a LINE, not a dark mass', () => {
  it('counts a one-pixel dark line drawn inside the figure', () => {
    const withSeam = fieldFrom([
      '......',
      '.5555.',
      '.5##5.',
      '.5555.',
      '......',
    ]);
    const m = measureFigure(withSeam);
    expect(m.count).toBe(12);
    expect(m.interiorKeylineShare).toBeCloseTo(2 / 12, 6);
  });

  it('does NOT count a solid dark mass, which is how hair survives', () => {
    // A 4x4 near-black block inside a light figure. Every pixel is near-black
    // and enclosed, and none of it is a line: the run through each is 4 both
    // ways. A plain near-black count scored our lifter's own hair at 30-38% of
    // his head, which no amount of drawing could have fixed.
    const withMass = fieldFrom([
      '........',
      '.555555.',
      '.5####5.',
      '.5####5.',
      '.5####5.',
      '.5####5.',
      '.555555.',
      '........',
    ]);
    const m = measureFigure(withMass);
    expect(m.nearBlackShare).toBeCloseTo(16 / 36, 6);
    expect(m.interiorKeylineShare).toBe(0);
  });

  it('does NOT count the silhouette keyline, which is outside the material', () => {
    const keylined = fieldFrom([
      '......',
      '.####.',
      '.#55#.',
      '.####.',
      '......',
    ]);
    // Every near-black pixel here touches open space, so none is interior.
    expect(measureFigure(keylined).interiorKeylineShare).toBe(0);
  });
});

describe('measureRegion windows', () => {
  const field = fieldFrom([
    '........',
    '.555555.',
    '.5##115.',
    '.555555.',
    '........',
  ]);

  it('aggregates only inside the window', () => {
    const left = measureRegion(field, (x) => x < 4);
    const right = measureRegion(field, (x) => x >= 4);
    expect(left.count + right.count).toBe(measureRegion(field).count);
    expect(left.meanLuma).not.toBeCloseTo(right.meanLuma, 3);
  });

  it('judges interior against the WHOLE field, not the window edge', () => {
    // The two near-black pixels at x=2,3 are interior in the full field. A
    // window cutting between them must not turn either into a boundary pixel
    // and lose it — that is how a limb window would manufacture a clean score.
    const split = measureRegion(field, (x) => x <= 2);
    expect(split.interiorKeylineShare).toBeGreaterThan(0);
  });

  it('reports zeroes rather than NaN for an empty window', () => {
    const empty = measureRegion(field, () => false);
    expect(empty).toEqual({
      count: 0,
      meanLuma: 0,
      nearBlackShare: 0,
      interiorKeylineShare: 0,
      litBoundarySamples: 0,
      litBoundaryDarkShare: 0,
    });
  });
});

describe('measureFigure halves', () => {
  it('splits at the figure own vertical midpoint, not the field midpoint', () => {
    // Material only in the top three rows of a six-row field: the split must
    // fall inside the figure, at row 1, not at row 3.
    const field = fieldFrom(['.555.', '.555.', '.111.', '.....', '.....', '.....']);
    const m = measureFigure(field);
    expect(m.midRow).toBe(1);
    expect(m.upper.count).toBe(3);
    expect(m.lower.count).toBe(6);
    expect(m.upperOverLowerMean).toBeGreaterThan(1);
  });

  it('reports a ratio of zero rather than dividing by an empty half', () => {
    expect(measureFigure(fieldFrom(['.....'])).upperOverLowerMean).toBe(0);
  });
});

describe('fieldFromIndexGrid', () => {
  const build = (paint: (g: IndexGrid) => void): IndexGrid => {
    const g = createGrid(9, 9);
    paint(g);
    return g;
  };

  it('takes the bank it is asked for and treats open space as lit', () => {
    const g = build((grid) => {
      setPx(grid, 4, 4, PAL.SKIN_MID);
      setPx(grid, 5, 4, PAL.STEEL_MID);
    });
    const lifter = fieldFromIndexGrid(g);
    expect(lifter.member[4 * 9 + 4]).toBe(1);
    expect(lifter.member[4 * 9 + 5]).toBe(0);
    expect(lifter.luma[0]).toBe(CRAFT.ASSUMED_LIT_BACKGROUND);

    const equipment = fieldFromIndexGrid(g, { bank: 1 });
    expect(equipment.member[4 * 9 + 5]).toBe(1);
    expect(equipment.member[4 * 9 + 4]).toBe(0);
  });

  it('drops a one-pixel outline from the material when asked, and only then', () => {
    const g = build((grid) => {
      for (let y = 3; y <= 5; y += 1) {
        for (let x = 3; x <= 5; x += 1) setPx(grid, x, y, PAL.OUTLINE);
      }
      setPx(grid, 4, 4, PAL.SKIN_MID);
    });
    expect(fieldFromIndexGrid(g).member.reduce((a, b) => a + b, 0)).toBe(9);
    const core = fieldFromIndexGrid(g, { excludeSilhouetteKeyline: true });
    expect(core.member.reduce((a, b) => a + b, 0)).toBe(1);
    expect(core.member[4 * 9 + 4]).toBe(1);
  });

  it('keeps the inside of a dark mass, and drops only the band on its boundary', () => {
    // A 4x4 block of near-black with no outline round it. The rule is
    // `outlinePass`'s exactly — near-black AND touching something that is not
    // this figure's own material — so the block's outer ring goes and its 2x2
    // core stays. That is what stops the option eating a legitimate dark MASS.
    const g = build((grid) => {
      for (let y = 2; y <= 5; y += 1) {
        for (let x = 2; x <= 5; x += 1) setPx(grid, x, y, PAL.OUTLINE);
      }
    });
    const core = fieldFromIndexGrid(g, { excludeSilhouetteKeyline: true });
    expect(core.member.reduce((a, b) => a + b, 0)).toBe(4);
    expect(core.member[3 * 9 + 3]).toBe(1);
  });

  it('never drops the hair, because the hair is no longer near-black', () => {
    // THIS BLOCK USED TO BE THE CASE ABOVE, and it stopped being one when
    // HAIR_DARK was lifted off luma 37.2 to 45.2 (see palette.ts). Below
    // NEAR_BLACK_LUMA the lifter's hair was black ink to every measure that
    // separates a drawn line from material, and the head window read 31-41%
    // "near-black" and 9.9% "interior keyline" with nothing wrong in the
    // drawing. Above it, hair is material, and the same 4x4 block survives.
    const hair = luma8(...rgb5ToRgb8(colorAt(PAL.HAIR_DARK) ?? [0, 0, 0]));
    const outline = luma8(...rgb5ToRgb8(colorAt(PAL.OUTLINE) ?? [0, 0, 0]));
    expect(hair).toBeGreaterThan(CRAFT.NEAR_BLACK_LUMA);
    expect(outline).toBeLessThan(CRAFT.NEAR_BLACK_LUMA);
    const g = build((grid) => {
      for (let y = 2; y <= 5; y += 1) {
        for (let x = 2; x <= 5; x += 1) setPx(grid, x, y, PAL.HAIR_DARK);
      }
    });
    const core = fieldFromIndexGrid(g, { excludeSilhouetteKeyline: true });
    expect(core.member.reduce((a, b) => a + b, 0)).toBe(16);
  });

  it('drops the keyline where the figure borders the BARBELL, not only open space', () => {
    // The bug this closes. `outlinePass` outlines the lifter against equipment
    // as well as against the backdrop, and the old rule — "near-black AND
    // touching open space" — left every one of those pixels inside the
    // "material" field, where the interior-keyline and raw near-black measures
    // then counted them as marks drawn INSIDE the figure.
    //
    // Here: skin, a keyline pixel, and a plate. Open space is nowhere near the
    // keyline pixel, and it must still go.
    const g = build((grid) => {
      setPx(grid, 3, 4, PAL.SKIN_MID);
      setPx(grid, 4, 3, PAL.SKIN_MID);
      setPx(grid, 4, 5, PAL.SKIN_MID);
      setPx(grid, 4, 4, PAL.OUTLINE);
      setPx(grid, 5, 4, PAL.PLATE_RED_LIGHT);
    });
    expect(fieldFromIndexGrid(g).member[4 * 9 + 4]).toBe(1);
    const core = fieldFromIndexGrid(g, { excludeSilhouetteKeyline: true });
    expect(core.member[4 * 9 + 4]).toBe(0);
    expect(core.member[4 * 9 + 3]).toBe(1);
  });
});

describe('limbWindows', () => {
  const pose = POSES.STAND;
  const centerX = 48;
  const handCentres = [
    { x: centerX - pose.handHalfW, y: 15 },
    { x: centerX + pose.handHalfW + 1, y: 15 },
  ];
  const windows = limbWindows({ pose, centerX, handCentres });

  it('names one window per part the aggregate could not see', () => {
    expect(windows.map((w) => w.name)).toEqual([
      'head',
      'neck',
      'left arm',
      'right arm',
      'left hand',
      'right hand',
    ]);
  });

  it('puts the head window on the head and not on the chest', () => {
    const head = windows[0];
    expect(head?.contains(centerX + pose.headDx, pose.headY)).toBe(true);
    expect(head?.contains(centerX, pose.chestY)).toBe(false);
  });

  it('keeps the arm windows off the torso and off each other', () => {
    const left = windows[2];
    const right = windows[3];
    expect(left?.contains(centerX, pose.elbowY)).toBe(false);
    expect(right?.contains(centerX, pose.elbowY)).toBe(false);
    expect(left?.contains(centerX - pose.elbowHalfW, pose.elbowY)).toBe(true);
    expect(right?.contains(centerX + pose.elbowHalfW, pose.elbowY)).toBe(true);
    expect(left?.contains(centerX + pose.elbowHalfW, pose.elbowY)).toBe(false);
    expect(right?.contains(centerX - pose.elbowHalfW, pose.elbowY)).toBe(false);
  });

  it('punches the hands out of the arms, so nothing is counted twice', () => {
    const leftArm = windows[2];
    const leftHand = windows[4];
    expect(leftHand?.contains(handCentres[0]?.x ?? 0, handCentres[0]?.y ?? 0)).toBe(true);
    expect(leftArm?.contains(handCentres[0]?.x ?? 0, handCentres[0]?.y ?? 0)).toBe(false);
  });

  it('follows the hand when the grip moves', () => {
    const moved = limbWindows({
      pose,
      centerX,
      handCentres: [
        { x: centerX - pose.handHalfW, y: 40 },
        { x: centerX + pose.handHalfW + 1, y: 40 },
      ],
    });
    expect(moved[4]?.contains(centerX - pose.handHalfW, 40)).toBe(true);
    expect(moved[4]?.contains(centerX - pose.handHalfW, 15)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// THE BOUND MECHANISM ITSELF
//
// The defect these exist for was not a wrong number, it was a wrong KIND of
// number: a bound of the form "the reference's measured value x a factor",
// where the factor was chosen after looking at our own output. That cannot
// grade the artifact it was fitted to, and one of them was fitted so loosely
// that it pointed the wrong way — a limb rendered entirely in the darkest
// colour its ramp contains satisfied it.
// ---------------------------------------------------------------------------

describe('CRAFT holds thresholds, not multipliers', () => {
  it('has no key that is a slack factor', () => {
    // Structural, so the shape of the defect cannot come back without deleting
    // this test. `CRAFT` is allowed absolute thresholds — a luma, a pixel count,
    // a padding — and is not allowed anything that multiplies or brackets a
    // measurement of the reference. Those are the two spellings the five
    // deleted entries used: INTERIOR_KEYLINE_FACTOR, LIMB_MEAN_LUMA_FLOOR_FACTOR,
    // LIMB_INTERIOR_KEYLINE_FACTOR, FACE_INTERIOR_KEYLINE_FACTOR,
    // LIMB_NEAR_BLACK_FACTOR, and UPPER_LOWER_RATIO_SLACK.
    const offenders = Object.keys(CRAFT).filter((k) => /_FACTOR$|_SLACK$/.test(k));
    expect(offenders).toEqual([]);
  });

  it('cannot express the old limb floor, because that floor was under the ramp', () => {
    // The arithmetic that made the old bound unfireable, kept as a check rather
    // than as a sentence. SKIN_SHADOW is the darkest colour our skin ramp has;
    // the old floor sat BELOW it, so a limb painted entirely in it passed.
    const skinShadowLuma = luma8(...rgb5ToRgb8(colorAt(PAL.SKIN_SHADOW) ?? [0, 0, 0]));
    const OLD_REFERENCE_FIGURE_MEAN_LUMA = 130.16;
    const OLD_FLOOR_FACTOR = 0.55;
    expect(OLD_REFERENCE_FIGURE_MEAN_LUMA * OLD_FLOOR_FACTOR).toBeLessThan(skinShadowLuma);
  });
});

describe('the step-structure measures are not permutation-invariant', () => {
  /** A field with a clean two-band drawing: five columns dark, five light. */
  const banded = (): StepField => {
    const w = 10;
    const h = 10;
    const step = new Int16Array(w * h);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) step[y * w + x] = x < w / 2 ? 0 : 3;
    }
    return { w, h, step, rampLength: 4 };
  };

  /** The same multiset of pixels, in a fixed shuffled order. */
  const shuffled = (field: StepField, seed: number): StepField => {
    const values = Array.from(field.step);
    let state = seed;
    for (let i = values.length - 1; i > 0; i -= 1) {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      const j = state % (i + 1);
      const a = values[i] ?? 0;
      values[i] = values[j] ?? 0;
      values[j] = a;
    }
    return { ...field, step: Int16Array.from(values) };
  };

  it('MOVES when the same pixels are rearranged, and the aggregates do not', () => {
    // THE PROOF, run rather than claimed. Same multiset of pixels, different
    // arrangement. The scalar aggregates the rest of this suite is built on are
    // blind to the difference by construction; these two are not, which is why
    // they can see ragged step boundaries and stranded pixels.
    const clean = measureRamp(banded());
    const mess = measureRamp(shuffled(banded(), 7));

    // Identical multiset: every aggregate is unchanged, to the last bit.
    expect(mess.count).toBe(clean.count);
    expect(mess.floorShare).toBe(clean.floorShare);
    expect(mess.topTwoShare).toBe(clean.topTwoShare);
    expect(mess.meanPosition).toBe(clean.meanPosition);
    expect(mess.medianStep).toBe(clean.medianStep);

    // And the two structural measures move a long way.
    expect(clean.bandBreakRate).toBeLessThan(0.1);
    expect(mess.bandBreakRate).toBeGreaterThan(0.4);
    expect(mess.bandBreakRate / Math.max(clean.bandBreakRate, 1e-9)).toBeGreaterThan(4);
    // Islands: none in the banded drawing, and a real crop of them once the
    // same pixels are scattered. A two-value shuffle strands an interior pixel
    // when all four of its neighbours differ, which is 1 in 16 of them, so ~6%
    // is the arrangement's own arithmetic rather than a threshold anyone chose.
    expect(clean.isletShare).toBe(0);
    expect(mess.isletShare).toBeGreaterThan(0);
    expect(Math.round(mess.isletShare * mess.count)).toBeGreaterThan(3);
  });

  it('counts a stranded pixel as an island and a two-pixel pair as not one', () => {
    // Zero parameters: an island is a component of one. A pair is not an
    // island, which is what stops the measure calling a deliberate two-pixel
    // mark noise — the same distinction `despeckle` draws.
    const w = 7;
    const h = 7;
    const step = new Int16Array(w * h);
    step[3 * w + 3] = 3; // one stranded bright pixel
    const one = measureRamp({ w, h, step, rampLength: 4 });
    expect(one.isletShare).toBeCloseTo(1 / (w * h), 9);

    const pair = new Int16Array(w * h);
    pair[3 * w + 3] = 3;
    pair[3 * w + 4] = 3;
    expect(measureRamp({ w, h, step: pair, rampLength: 4 }).isletShare).toBe(0);
  });
});
