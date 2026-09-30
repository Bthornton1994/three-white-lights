import { describe, expect, it } from 'vitest';

import { BANK_SIZE, PALETTE_INDEX_COUNT, PAL, colorAt, isTransparentIndex } from './palette';
import {
  GYM,
  GYM_BANKS,
  GYM_BANK_FIRST,
  GYM_DIM_STEP,
  GYM_LIGHT_STEP,
  GYM_RAMPS,
  SCENE_INDEX_COUNT,
  dimIndex,
  litIndex,
  lumaOfIndex,
  sceneColorAt,
  stepIndex,
} from './gymPalette';
import { GYM_READABILITY } from './gymTuning';

/**
 * `sprite-ref-1-snes-wrestling.png`, measured at native scale and recorded in
 * `palette.ts`: the crowd — the busiest, most detailed band on that screen — has
 * mean 38.8 and median 36. These are the reference's own pixels, not ours, and
 * they are the only numbers in this file with a reference behind them.
 */
const REF_CROWD_MEAN = 38.8;
const REF_CROWD_MEDIAN = 36;

/**
 * THE VALUE STRUCTURE, CHECKED RATHER THAN PROMISED.
 *
 * `gymPalette.ts`'s header makes three claims about where the room sits
 * relative to the figure, sourced from measurements of
 * `sprite-ref-1-snes-wrestling.png` recorded in `palette.ts`. A header can say
 * anything; this is the part that fails when a colour is moved.
 *
 * WHAT THESE BOUNDS ARE NOT. None of them says the room LOOKS 16-bit. GDD
 * §12.2's blind era A/B needs a human and a reference this repository does not
 * have for gym interiors (`docs/reference/README.md`). These check the one half
 * that is measurable: the figure owns the top of the range and the room does
 * not sit in the figure's own value band.
 */

const luma = (index: number): number => {
  const v = lumaOfIndex(index);
  expect(v, `index ${index} has no colour`).toBeDefined();
  return v ?? 0;
};

/** Every value the LIFTER bank can put at a silhouette edge. */
const FIGURE_STEPS: readonly number[] = [
  PAL.SKIN_SHADOW,
  PAL.SKIN_MID,
  PAL.SKIN_LIGHT,
  PAL.SKIN_HI,
  PAL.SINGLET_DARK,
  PAL.SINGLET_MID,
  PAL.SINGLET_LIGHT,
  PAL.GEAR_DARK,
  PAL.GEAR_MID,
  PAL.GEAR_LIGHT,
];

describe('the gym banks are hardware-shaped', () => {
  it('adds exactly two banks of sixteen, after the sprite banks', () => {
    expect(GYM_BANKS).toHaveLength(2);
    for (const bank of GYM_BANKS) expect(bank.colors).toHaveLength(BANK_SIZE);
    expect(GYM_BANK_FIRST).toBe(PALETTE_INDEX_COUNT / BANK_SIZE);
    expect(SCENE_INDEX_COUNT).toBe(PALETTE_INDEX_COUNT + GYM_BANKS.length * BANK_SIZE);
  });

  it('keeps slot 0 of each bank as the transparent sentinel', () => {
    for (let bank = 0; bank < GYM_BANKS.length; bank += 1) {
      const index = (GYM_BANK_FIRST + bank) * BANK_SIZE;
      expect(isTransparentIndex(index)).toBe(true);
    }
  });

  it('stores every colour on the 5-bit hardware grid', () => {
    for (const bank of GYM_BANKS) {
      for (const c of bank.colors) {
        for (const channel of c) {
          expect(Number.isInteger(channel)).toBe(true);
          expect(channel).toBeGreaterThanOrEqual(0);
          expect(channel).toBeLessThan(BANK_SIZE * 2);
        }
      }
    }
  });

  it('leaves the sprite banks untouched, and resolves both from one function', () => {
    // The merge-safety claim in the header, as an assertion: `palette.ts` still
    // answers for 0..47 and answers identically.
    for (let index = 0; index < PALETTE_INDEX_COUNT; index += 1) {
      expect(sceneColorAt(index)).toEqual(colorAt(index));
    }
    // ...and `colorAt` alone cannot see the gym, which is why a scene rendered
    // through it would come out fully transparent.
    expect(colorAt(GYM.WALL_MID)).toBeUndefined();
    expect(sceneColorAt(GYM.WALL_MID)).toBeDefined();
    expect(sceneColorAt(SCENE_INDEX_COUNT)).toBeUndefined();
  });

  it('allocates every named index', () => {
    for (const [name, index] of Object.entries(GYM)) {
      expect(sceneColorAt(index), `${name} is unallocated`).toBeDefined();
      expect(isTransparentIndex(index), `${name} is a sentinel`).toBe(false);
    }
  });

  it('gives every gym index a distinct name', () => {
    const values = Object.values(GYM);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('the room stays under the figure', () => {
  it('holds the wall in the bottom of the range, where the reference crowd is', () => {
    // sprite-ref-1's crowd: mean 38.8, median 36. The wall brackets that value
    // rather than sitting on it — see the note in the bank about being out of
    // phase with the figure's own ladder — and the bound is two-sided: a wall
    // that vanished to black would fail the floor, one lifted into the figure's
    // range fails the ceiling.
    for (const index of [GYM.WALL_DEEP, GYM.WALL_DARK, GYM.WALL_MID, GYM.WALL_LIGHT]) {
      expect(luma(index)).toBeGreaterThan(8);
      expect(luma(index)).toBeLessThan(75);
    }
    // The three bands the wall is actually PAINTED in — the fourth is the lamp
    // wash and never lands behind the figure — all sit at or under the
    // reference crowd's own mean of 38.8. That is the reference-anchored half:
    // a background in this era is not brighter than the busiest dark mass on
    // the screen.
    for (const index of [GYM.WALL_DEEP, GYM.WALL_DARK, GYM.WALL_MID]) {
      expect(luma(index)).toBeLessThanOrEqual(REF_CROWD_MEAN);
    }
    // ...and at least one of them is within a visible step of the reference
    // crowd's MEDIAN, so "at or under" cannot be satisfied by a black wall.
    expect(
      Math.min(
        ...[GYM.WALL_DEEP, GYM.WALL_DARK, GYM.WALL_MID].map((i) =>
          Math.abs(luma(i) - REF_CROWD_MEDIAN),
        ),
      ),
    ).toBeLessThan(GYM_READABILITY.PERCEPTIBLE_LUMA_STEP);
    // WHAT THIS NO LONGER CLAIMS. It used to require WALL_DARK below the
    // reference median and WALL_MID above it — the wall bracketing 36 rather
    // than sitting on it. That was an ours-only nicety with no reference behind
    // it, and the A1 shading rework made it unsatisfiable: HAIR_DARK moved to
    // 45.2 and the only window left for the band behind the lifter's head is
    // 19.3-45.2, whose usable middle is under 36. The bracket was dropped
    // rather than the collision tolerated, and this comment is the record.
  });

  it('lands the platform on the reference mat, not above the figure', () => {
    // Ref mat: mean 93.4, median 102, p90 120. Ours tops out at 136 — above the
    // reference's p90, and the comment in the bank says why (SKIN_MID is 117).
    // The ceiling is what matters: the platform must stay under SKIN_LIGHT.
    expect(luma(GYM.WOOD_LIGHT)).toBeGreaterThan(100);
    expect(luma(GYM.WOOD_LIGHT)).toBeLessThan(luma(PAL.SKIN_LIGHT));
    expect(luma(GYM.WOOD_LIGHT)).toBeLessThan(luma(PAL.SINGLET_LIGHT));
    // ...and clear of the lifter's own shoes by a wide margin, or a black shoe
    // on a platform is two dark shapes touching (meet-photo-ref-1).
    expect(luma(GYM.WOOD_LIGHT) - luma(PAL.GEAR_DARK)).toBeGreaterThan(40);
  });

  it('keeps the rubber floor out of the band the figure lives in', () => {
    // The measured failure this bound exists for: a 50-luma rubber floor put
    // the shade half of a red disc 0.6 luma from the floor behind it.
    for (const index of [GYM.FLOOR_DEEP, GYM.FLOOR_DARK, GYM.FLOOR_MID, GYM.FLOOR_LIGHT]) {
      expect(luma(index)).toBeLessThanOrEqual(52);
      expect(luma(index)).toBeGreaterThan(12);
    }
  });

  it('lets nothing but the lamp filament into the figure own top band', () => {
    const top = Math.min(luma(PAL.SKIN_LIGHT), luma(PAL.SKIN_HI));
    const bright = Object.entries(GYM).filter(([, index]) => luma(index) >= top - 20);
    expect(bright.map(([name]) => name)).toEqual(['LAMP_CORE']);
    // A lamp darker than the room it lights is its own tell, so it also has a
    // floor: the filament must be the brightest thing in either gym bank.
    for (const [name, index] of Object.entries(GYM)) {
      if (name === 'LAMP_CORE') continue;
      expect(luma(GYM.LAMP_CORE), `${name} out-values the filament`).toBeGreaterThan(luma(index));
    }
  });

  it('gives the figure the top of the range outright', () => {
    const brightestRoutine = Math.max(
      ...Object.entries(GYM)
        .filter(([name]) => name !== 'LAMP_CORE')
        .map(([, index]) => luma(index)),
    );
    expect(luma(PAL.SKIN_HI) - brightestRoutine).toBeGreaterThan(60);
  });
});

describe('the ramps are ramps', () => {
  it('orders every ramp dark to light, with no repeated step', () => {
    for (const [name, ramp] of Object.entries(GYM_RAMPS)) {
      for (let i = 1; i < ramp.length; i += 1) {
        const below = luma(ramp[i - 1] ?? 0);
        const above = luma(ramp[i] ?? 0);
        expect(above, `${name} step ${i} does not rise`).toBeGreaterThan(below);
        expect(above - below, `${name} step ${i} is a duplicate`).toBeGreaterThan(4);
      }
    }
  });

  it('steps every ramp entry down monotonically under dimIndex', () => {
    // The depth cue in `gymScene.ts` is "the same drawing in darker paint". If
    // any entry dimmed UPWARD the far copy of a prop would be the brighter one.
    for (const [from, to] of Object.entries(GYM_DIM_STEP)) {
      expect(luma(to), `dim of ${from} is brighter`).toBeLessThan(luma(Number(from)));
    }
    for (const [from, to] of Object.entries(GYM_LIGHT_STEP)) {
      expect(luma(to), `lit of ${from} is darker`).toBeGreaterThan(luma(Number(from)));
    }
  });

  it('leaves an unlisted index alone rather than guessing', () => {
    expect(dimIndex(GYM.LAMP_CORE)).toBe(GYM.LAMP_CORE);
    expect(litIndex(GYM.CHALK_DUST)).toBe(GYM.CHALK_DUST);
    expect(dimIndex(PAL.SKIN_HI)).toBe(PAL.SKIN_HI);
  });

  it('does not change a plate denomination when it is lit', () => {
    // `GYM_DIM_STEP` deliberately steps a far yellow disc toward blue, which is
    // saturation loss with distance. Inverting that map would have made a LIT
    // blue disc turn yellow — a plate changing what weight it is because a lamp
    // fell on it. `GYM_LIGHT_STEP` is written out separately for exactly this.
    for (const accent of [GYM.ACCENT_RED, GYM.ACCENT_BLUE, GYM.ACCENT_YELLOW]) {
      expect(litIndex(accent)).toBe(accent);
    }
  });

  it('walks several steps, in either direction, and stops at the end', () => {
    expect(stepIndex(GYM.WOOD_DARK, 2)).toBe(GYM.WOOD_LIGHT);
    expect(stepIndex(GYM.WOOD_LIGHT, -2)).toBe(GYM.WOOD_DARK);
    expect(stepIndex(GYM.WOOD_LIGHT, 4)).toBe(GYM.WOOD_LIGHT);
    expect(stepIndex(GYM.WALL_MID, 0)).toBe(GYM.WALL_MID);
  });

  it('keeps the light pool off the rubber, structurally', () => {
    // A spot on a platform lights the platform. This is not a convention in the
    // renderer — there is simply no lighting step for a rubber index, which is
    // what stopped the pool lifting the floor back into the plate ramp's band.
    for (const index of [GYM.FLOOR_DEEP, GYM.FLOOR_DARK, GYM.FLOOR_MID]) {
      expect(litIndex(index)).toBe(index);
    }
  });
});

describe('the surfaces the figure is actually drawn against', () => {
  /**
   * WHY THIS IS NOT A BLANKET RULE OVER EVERY BACKGROUND COLOUR.
   *
   * It was, and it was unsatisfiable, which is worth recording rather than
   * quietly narrowing. The lifter's own ramp puts ten steps into the 19-217
   * range and six of them below 80 — outline 19.3, hair 45.2, red-disc shade
   * 49.3, singlet 54.1, gear 58.9, skin-shadow 73.0, hair-light 75.0. A
   * background needing eleven surfaces of its own cannot keep all of them 8
   * luma from all of those, and the version of this test that demanded it was a
   * bound no palette could pass. It got TIGHTER, not looser, when the A1
   * shading rework moved HAIR_DARK from 37.2 to 45.2: the ladder now leaves
   * exactly one window under 80 — 19.3 to 45.2 — with room for a background
   * value inside it.
   *
   * So the rule is targeted at what actually touches what. The lifter's TORSO
   * is drawn against the wall paint; his SHINS AND SHOES stand on the platform.
   * A colour that appears only above his head — the lamp wash, the painted
   * stripe, the window glass — is not held to it here. That exemption is not
   * taken on trust either: `gymScene.test.ts` asserts, on the rendered scene,
   * that no pixel of any of them lands inside the band the figure occupies.
   */
  const UPPER_BODY: readonly number[] = [
    PAL.SKIN_SHADOW,
    PAL.SKIN_MID,
    PAL.SKIN_LIGHT,
    PAL.SINGLET_DARK,
    PAL.SINGLET_MID,
    PAL.SINGLET_LIGHT,
    // His HAIR is drawn against the wall too, and it was left out of this list
    // until the shading rework walked HAIR_DARK from 37.2 to 45.2 and parked it
    // 1.4 luma from WALL_MID. Nothing here caught that; the rim percentiles in
    // `gymReadability.ts` did, at four to five samples a frame. It is in the
    // list now, which is what makes this test able to catch it next time.
    PAL.HAIR_DARK,
    PAL.HAIR_LIGHT,
  ];
  const LOWER_BODY: readonly number[] = [
    PAL.GEAR_DARK,
    PAL.GEAR_MID,
    PAL.GEAR_LIGHT,
    PAL.SKIN_SHADOW,
    PAL.SKIN_MID,
    PAL.SKIN_LIGHT,
  ];
  const MIN_GAP = 8;

  const worstGapAgainst = (value: number, steps: readonly number[]): number =>
    Math.min(...steps.map((step) => Math.abs(value - luma(step))));

  it('keeps the wall paint clear of the steps the torso is drawn in', () => {
    for (const [name, index] of [
      ['WALL_DEEP', GYM.WALL_DEEP],
      ['WALL_DARK', GYM.WALL_DARK],
      ['WALL_MID', GYM.WALL_MID],
    ] as const) {
      const gap = worstGapAgainst(luma(index), UPPER_BODY);
      expect(gap, `${name} sits ${gap.toFixed(1)} luma from a torso step`).toBeGreaterThan(MIN_GAP);
    }
  });

  it('keeps the platform clear of the steps the legs and shoes are drawn in', () => {
    for (const [name, index] of [
      ['WOOD_DARK', GYM.WOOD_DARK],
      ['WOOD_MID', GYM.WOOD_MID],
      ['WOOD_LIGHT', GYM.WOOD_LIGHT],
    ] as const) {
      const gap = worstGapAgainst(luma(index), LOWER_BODY);
      expect(gap, `${name} sits ${gap.toFixed(1)} luma from a leg step`).toBeGreaterThan(MIN_GAP);
    }
  });

  it('fails for every palette this file actually shipped and measured wrong', () => {
    // A bound nothing can fail is not a bound. These are real previous values,
    // planted back, with the round each was caught in.
    //
    //   120   the platform at the reference mat's p90, 3 luma from SKIN_MID
    //   51.9  the wall's even 17-luma ladder, 2 luma from SINGLET_DARK
    //   18    the same ladder's bottom rung, 1.3 from OUTLINE
    //   43.9  WALL_MID as it shipped until this round — 1.4 luma from HAIR_DARK
    //         once A1's shading rework moved his hair from 37.2 to 45.2. This
    //         one is here because the version of THIS TEST that shipped with it
    //         did not catch it: HAIR_DARK was not in the contact list. The rim
    //         percentiles in `gymReadability.ts` caught it instead.
    expect(worstGapAgainst(120, LOWER_BODY)).toBeLessThan(MIN_GAP);
    for (const planted of [18, 43.9, 51.9]) {
      expect(worstGapAgainst(planted, [...UPPER_BODY, PAL.OUTLINE])).toBeLessThan(MIN_GAP);
    }

    // ONE RUNG OF THAT OLD LADDER NO LONGER COLLIDES, and saying so is the
    // point of this comment. 36 was chosen to sit on the old HAIR_DARK of 37.2;
    // his hair is now 45.2, so a wall at 36 clears every contact step by 9.2 and
    // this test would be lying if it still claimed otherwise. That is what a
    // plant calibrated against a moving figure does, and it is why the control
    // below is generated from the figure instead of written down.
    expect(worstGapAgainst(36, [...UPPER_BODY, PAL.OUTLINE])).toBeGreaterThan(MIN_GAP);

    // THE CONTROL THAT CANNOT GO STALE. A background value placed ON any step
    // the figure is actually drawn against fails by construction, whatever the
    // figure's ramp does next — and so does one placed within half the minimum
    // gap of it, on either side, which is what stops this being a test about
    // exact equality.
    for (const contacts of [UPPER_BODY, LOWER_BODY]) {
      expect(contacts.length).toBeGreaterThan(4);
      for (const step of contacts) {
        for (const offset of [0, MIN_GAP / 2, -MIN_GAP / 2]) {
          expect(
            worstGapAgainst(luma(step) + offset, contacts),
            `a background at ${(luma(step) + offset).toFixed(1)} should collide`,
          ).toBeLessThan(MIN_GAP);
        }
      }
    }
    // ...and the same generator run one gap away from every step does NOT fail,
    // so it is measuring distance rather than always saying yes.
    const clear = luma(PAL.OUTLINE) - MIN_GAP * 2;
    expect(worstGapAgainst(clear, [PAL.OUTLINE])).toBeGreaterThan(MIN_GAP);
  });
});
