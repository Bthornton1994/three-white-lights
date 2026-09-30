/**
 * TIER 1, ON REAL PIXELS (GDD §7.3).
 *
 * The half of this piece's bar — "the fictional entries fully exercise all three
 * tiers end to end" — that was previously exercised by three swatch rectangles
 * and a legend on a Tier 3 surface. Tier 2 and Tier 3 reach real Skia pixels;
 * Tier 1 now reaches a real `renderLifterFrame` grid, and the assertions below
 * are on the palette indices that come back out of it.
 *
 * WHAT MAKES THESE CHECKS ABLE TO FAIL, since that is the thing this file exists
 * to fix: every one of them is anchored on `isBodyIndex`, which is
 * `lifterSprite.ts`'s own rule and the same function `bodyPixelDiff` and the
 * readability bounds classify with. `sheetColorAt` — what the old check used —
 * resolves every index in all four banks and could not have failed on any of
 * them.
 */

import { describe, expect, it } from 'vitest';

import {
  HALBERD_COLORWAY,
  HOUSE_COLORWAY,
  IDENTITY_ENTRIES,
  ILSE_VONDRAK,
  KESSLING_COLORWAY,
  NINEBAR_ATHLETIC,
  NINEBAR_COLORWAY,
  VONDRAK_COLORWAY,
} from './partners';
import { spriteIdentityOf, spriteIdentityWithKit, type Colorway } from './tiers';
import {
  COLORWAY_FORBIDDEN_INDICES,
  HOUSE_SINGLET_RAMP,
  bodyPixelCount,
  colorwayProblems,
  colorwayRamp,
  indexHistogram,
  spriteLumaOf,
  wearColorway,
} from './spriteKit';
import { COLORWAY_RAMP, RAMP_STEPS } from './licensingTuning';
import {
  bodyPixelDiff,
  isBodyIndex,
  renderLifterFrame,
  type LifterFrameSpec,
} from '../art/lifterSprite';
import { PAL, RAMPS } from '../art/palette';
import { cloneGrid, type IndexGrid } from '../art/raster';
import { STRAIN } from '../art/spriteTuning';

const COLORWAYS: readonly Colorway[] = [
  HOUSE_COLORWAY,
  NINEBAR_COLORWAY,
  HALBERD_COLORWAY,
  VONDRAK_COLORWAY,
  KESSLING_COLORWAY,
];

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

/** The frames every check below runs over. Standing, and buried under a max. */
const FRAMES: readonly (readonly [string, LifterFrameSpec])[] = [
  ['standing', spec()],
  ['bottom of the hole, straining', spec({ depth: 1, strainLevel: STRAIN.LEVELS - 1 })],
];

function singletPixels(grid: IndexGrid): number {
  const histogram = indexHistogram(grid);
  return HOUSE_SINGLET_RAMP.reduce((sum, index) => sum + (histogram.get(index) ?? 0), 0);
}

// ---------------------------------------------------------------------------
// The check itself
// ---------------------------------------------------------------------------

describe('what a Tier 1 colorway has to be', () => {
  it('targets the ramp the renderer actually shades the singlet into', () => {
    // NON-VACUITY, and the first thing to check. A recolour aimed at indices
    // `renderLifterFrame` never emits is a no-op, and every assertion in this
    // file would pass over it without noticing.
    expect([...HOUSE_SINGLET_RAMP]).toEqual([...RAMPS.SINGLET]);
    expect(HOUSE_SINGLET_RAMP).toHaveLength(RAMP_STEPS);
    expect(COLORWAY_RAMP.STEPS).toBe(RAMP_STEPS);
  });

  it('accepts every colorway in the table', () => {
    for (const colorway of COLORWAYS) {
      expect(colorwayProblems(colorway), colorway.id).toEqual([]);
    }
  });

  it('accepts the colorway of every entry, by the route the entry hands it over', () => {
    for (const entry of IDENTITY_ENTRIES) {
      expect(colorwayProblems(spriteIdentityOf(entry).colorway), entry.id).toEqual([]);
    }
  });

  it('REJECTS a colorway built out of the equipment bank', () => {
    // THE MUTATION. These are the three colorways this table shipped with, put
    // back verbatim: plate ramps and CHROME_HI, all bank 1. The old check —
    // `expect(sheetColorAt(index)).toBeDefined()` — passed all three, because
    // `sheetColorAt` resolves any index in any of the four banks.
    const asShipped: readonly Colorway[] = [
      { id: 'was-ninebar', dark: PAL.PLATE_BLUE_SHADE, mid: PAL.PLATE_BLUE_LIGHT, light: PAL.CHROME_HI },
      { id: 'was-vondrak', dark: PAL.PLATE_RED_SHADE, mid: PAL.PLATE_RED_LIGHT, light: PAL.CHROME_HI },
      { id: 'was-halberd', dark: PAL.PLATE_GREEN_SHADE, mid: PAL.PLATE_GREEN_LIGHT, light: PAL.CHALK },
    ];
    for (const colorway of asShipped) {
      const problems = colorwayProblems(colorway);
      expect(problems.length, colorway.id).toBeGreaterThan(0);
      expect(problems.join(' '), colorway.id).toMatch(/not a body index/);
    }
    // And the two that were already right are not swept up with them.
    expect(colorwayProblems(KESSLING_COLORWAY)).toEqual([]);
    expect(colorwayProblems(HOUSE_COLORWAY)).toEqual([]);
  });

  it('rejects an unallocated slot, a repeat, and a ramp that does not rise', () => {
    // Bank 0 slot 0 is the transparent sentinel, so it is not a body index.
    expect(colorwayProblems({ id: 'hole', dark: 0, mid: PAL.SINGLET_MID, light: PAL.CHALK }).join(' ')).toMatch(
      /not a body index/,
    );
    expect(
      colorwayProblems({ id: 'repeat', dark: PAL.GEAR_DARK, mid: PAL.GEAR_DARK, light: PAL.CHALK }).join(' '),
    ).toMatch(/not distinct/);
    // Descending: light is darker than dark.
    expect(
      colorwayProblems({ id: 'upside-down', dark: PAL.CHALK, mid: PAL.GEAR_MID, light: PAL.GEAR_DARK }).join(' '),
    ).toMatch(/luma/);
  });

  it('rejects a ramp whose steps a phone cannot tell apart', () => {
    // Non-vacuity on MIN_STEP_LUMA. GEAR_DARK -> HAIR_LIGHT is a real rise, and
    // a small one: the floor has to be what refuses it, not the ordering.
    const flat: Colorway = { id: 'nearly-flat', dark: PAL.GEAR_DARK, mid: PAL.HAIR_LIGHT, light: PAL.CHALK };
    const dark = spriteLumaOf(PAL.GEAR_DARK) ?? 0;
    const mid = spriteLumaOf(PAL.HAIR_LIGHT) ?? 0;
    expect(mid).toBeGreaterThan(dark);
    expect(mid - dark).toBeLessThan(COLORWAY_RAMP.MIN_STEP_LUMA);
    expect(colorwayProblems(flat).join(' ')).toMatch(/luma/);
  });

  it('rejects the outline colour and the skin ramp, which are bank 0 and still wrong', () => {
    // The bank check cannot catch these — they pass `isBodyIndex`. Named
    // separately so the reason is in the failure rather than in a comment.
    expect(COLORWAY_FORBIDDEN_INDICES.size).toBeGreaterThan(0);
    for (const [index] of COLORWAY_FORBIDDEN_INDICES) {
      expect(isBodyIndex(index), `${index} should be bank 0, or this check proves nothing`).toBe(true);
      const worn: Colorway = { id: 'forbidden', dark: index, mid: PAL.GEAR_LIGHT, light: PAL.CHALK };
      expect(colorwayProblems(worn).join(' '), `${index}`).toMatch(/may not be worn/);
    }
  });

  it('gives every colorway in the table a different ramp, not just a different id', () => {
    const ramps = COLORWAYS.map((c) => colorwayRamp(c).join(','));
    expect(new Set(ramps).size).toBe(COLORWAYS.length);
  });
});

// ---------------------------------------------------------------------------
// On a rendered frame
// ---------------------------------------------------------------------------

describe('a partner colorway on a real rendered sprite', () => {
  it('finds a singlet on the frame to recolour at all', () => {
    // The floor under everything below. A frame with no singlet pixels would
    // make every recolour assertion vacuously true.
    for (const [label, frameSpec] of FRAMES) {
      const { grid } = renderLifterFrame(frameSpec);
      expect(singletPixels(grid), label).toBeGreaterThan(HOUSE_SINGLET_RAMP.length);
      for (const index of HOUSE_SINGLET_RAMP) {
        expect(indexHistogram(grid).get(index) ?? 0, `${label} ${index}`).toBeGreaterThan(0);
      }
    }
  });

  it('leaves every recoloured pixel a BODY pixel', () => {
    // THE ASSERTION THE PIECE WAS MISSING. Worn on a real frame, a partner's
    // singlet has to still be the lifter as far as the pipeline is concerned.
    for (const [label, frameSpec] of FRAMES) {
      const { grid } = renderLifterFrame(frameSpec);
      for (const colorway of COLORWAYS) {
        const worn = wearColorway(grid, colorway);
        let recoloured = 0;
        for (let i = 0; i < grid.data.length; i += 1) {
          const before = grid.data[i] ?? 0;
          if (!HOUSE_SINGLET_RAMP.includes(before)) continue;
          recoloured += 1;
          const after = worn.data[i] ?? 0;
          expect(isBodyIndex(after), `${label} ${colorway.id} at ${i}: ${after}`).toBe(true);
          expect(colorwayRamp(colorway), `${label} ${colorway.id}`).toContain(after);
        }
        expect(recoloured, `${label} ${colorway.id}`).toBeGreaterThan(0);
      }
    }
  });

  it('does not move the silhouette, and does move the colour', () => {
    // `bodyPixelDiff` splits exactly this way: `silhouette` is body-ness
    // changing, which a palette swap cannot do, and `changed` is colour, which
    // is the whole point. Both halves asserted, so a no-op cannot pass.
    for (const [label, frameSpec] of FRAMES) {
      const { grid } = renderLifterFrame(frameSpec);
      for (const colorway of COLORWAYS) {
        if (colorway === HOUSE_COLORWAY) continue; // the identity swap; see below
        const worn = wearColorway(grid, colorway);
        const diff = bodyPixelDiff(grid, worn);
        expect(diff.silhouette, `${label} ${colorway.id}`).toBe(0);
        expect(diff.changed, `${label} ${colorway.id}`).toBeGreaterThan(0);
        expect(bodyPixelCount(worn), `${label} ${colorway.id}`).toBe(bodyPixelCount(grid));
      }
    }
  });

  it('WOULD move the silhouette if a colorway used an equipment index', () => {
    // THE COUNTERFACTUAL, done by hand rather than through `wearColorway`,
    // because `wearColorway` refuses. This is what the three shipped colorways
    // would have produced: the athlete's torso reclassified as barbell.
    const { grid } = renderLifterFrame(spec());
    const forged = cloneGrid(grid);
    for (let i = 0; i < grid.data.length; i += 1) {
      if ((grid.data[i] ?? 0) === PAL.SINGLET_LIGHT) forged.data[i] = PAL.CHROME_HI;
    }
    const diff = bodyPixelDiff(grid, forged);
    expect(isBodyIndex(PAL.CHROME_HI)).toBe(false);
    expect(diff.silhouette).toBeGreaterThan(0);
    expect(bodyPixelCount(forged)).toBeLessThan(bodyPixelCount(grid));
  });

  it('refuses to wear a colorway that is not a legal Tier 1 payload', () => {
    const chrome: Colorway = {
      id: 'was-ninebar',
      dark: PAL.PLATE_BLUE_SHADE,
      mid: PAL.PLATE_BLUE_LIGHT,
      light: PAL.CHROME_HI,
    };
    const { grid } = renderLifterFrame(spec());
    expect(() => wearColorway(grid, chrome)).toThrow(/not a body index/);
  });

  it('touches nothing but the singlet', () => {
    // Skin, hair, gear, chalk and every bank-1 pixel of the barbell come
    // through untouched. A colorway is a kit, not a filter.
    const { grid } = renderLifterFrame(spec({ depth: 1, chalkMotes: 4, totalKg: 260 }));
    const worn = wearColorway(grid, VONDRAK_COLORWAY);
    let untouched = 0;
    for (let i = 0; i < grid.data.length; i += 1) {
      const before = grid.data[i] ?? 0;
      if (HOUSE_SINGLET_RAMP.includes(before)) continue;
      untouched += 1;
      expect(worn.data[i], `${i}`).toBe(before);
    }
    expect(untouched).toBeGreaterThan(0);
  });

  it('maps each step once, so a colorway may reuse a house index', () => {
    // `ninebar-blue` keeps SINGLET_DARK as its base. A step-by-step rewrite
    // would send SINGLET_MID to SINGLET_LIGHT and then on to CHALK, and the mid
    // step would arrive at the highlight. Counted, not argued.
    const { grid } = renderLifterFrame(spec());
    const before = indexHistogram(grid);
    const worn = wearColorway(grid, NINEBAR_COLORWAY);
    const after = indexHistogram(worn);
    expect(NINEBAR_COLORWAY.dark).toBe(PAL.SINGLET_DARK);
    expect(after.get(NINEBAR_COLORWAY.light) ?? 0).toBe(
      (before.get(PAL.SINGLET_LIGHT) ?? 0) + (before.get(PAL.CHALK) ?? 0),
    );
    expect(after.get(NINEBAR_COLORWAY.mid) ?? 0).toBe(before.get(PAL.SINGLET_MID) ?? 0);
  });

  it('is the identity when the house colorway is worn', () => {
    // §7.3's practical claim, on pixels: losing a deal is passing the house
    // ramp instead of the partner's, and no frame is re-rendered. The frame
    // that comes back is byte-identical to the one the renderer produced.
    const { grid } = renderLifterFrame(spec({ depth: 1 }));
    const worn = wearColorway(grid, HOUSE_COLORWAY);
    expect([...worn.data]).toEqual([...grid.data]);
  });

  it('wears a brand kit on an athlete build, end to end', () => {
    // The composed Tier 1 of a sponsored lifter — the athlete's body, the
    // brand's colours — put on the frame the renderer actually drew.
    const sponsored = spriteIdentityWithKit(ILSE_VONDRAK, NINEBAR_ATHLETIC);
    expect(sponsored.colorway.id).toBe(NINEBAR_COLORWAY.id);
    const { grid } = renderLifterFrame(spec({ depth: 1, strainLevel: STRAIN.LEVELS - 1 }));
    const worn = wearColorway(grid, sponsored.colorway);
    const after = indexHistogram(worn);
    for (const step of colorwayRamp(sponsored.colorway)) {
      expect(after.get(step) ?? 0, `step ${step}`).toBeGreaterThan(0);
      expect(isBodyIndex(step), `step ${step}`).toBe(true);
    }
    expect(bodyPixelDiff(grid, worn).silhouette).toBe(0);
  });
});
