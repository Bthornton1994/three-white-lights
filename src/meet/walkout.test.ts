/**
 * THE WALK-OUT MOVES, AND THE HALL KNOWS WHICH ATTEMPT IT IS.
 *
 * ===========================================================================
 * WHAT THIS FILE IS FOR, AND THE MEASUREMENT THAT PUT IT HERE
 * ===========================================================================
 * The previous pass staged meet day in a real building and got that right. It
 * also shipped a beat named "walk-out" with no walk-out in it. Diffing the two
 * captured frames:
 *
 *     walkout.png (opener, 207.5 kg) vs walkout-third.png (third, nothing banked)
 *     differing pixels:                 22,467 of 1,316,640  = 1.71%
 *     row span of every difference:     y 204 to 439  — the copy block
 *     differing pixels below y=640:     0
 *
 * Zero. Below the text the two frames were byte-identical, and they stayed
 * identical for the whole beat: `MeetHallView` drew one memoised still of
 * `buildSquatRep(loadRatio).frames[0]` and held it. Every channel by which a
 * third attempt escalated — the longer hold, `CROWD_SWELL_BIG`,
 * `WALKOUT_CALL_URGENT` — was in sound or haptics, the two channels nobody in
 * this environment can verify.
 *
 * ===========================================================================
 * SO EVERY CLAIM HERE IS MEASURED ON RENDERED PIXELS
 * ===========================================================================
 * `hallAt` below composites the walk-out exactly the way `MeetHallView` does —
 * `renderGymScene(hallScene(rise))`, then the sprite blitted at
 * `SPRITE_X + bodyDxPx` — and the geometry that makes those two the same
 * composite is asserted rather than assumed (see "the composite this file
 * measures is the composite the screen draws").
 *
 * WHAT IT CANNOT SEE, said plainly: this suite runs in a node environment with
 * no renderer, so it cannot mount `WalkoutView` and watch `useHallStep` advance.
 * It measures the SHEET on real pixels and it guards the WIRING through
 * `meetStage.test.ts`'s source parser. The one instrument that can watch the
 * component's clock run is `tools/capture-meet.mjs`, which photographs the live
 * walk-out at two instants and fails if the hall is the same picture in both.
 *
 * PACING IS STILL UNVERIFIABLE HERE (GDD §12.1, §12.2). Nothing below says the
 * walk-out feels like a walk-out; it says the picture changes, that it changes
 * in the places the design claims, and that it stops changing when it should.
 */

import { describe, expect, it } from 'vitest';

import { blitOver, renderGymScene } from '../art/gymScene';
import { GYM } from '../art/gymPalette';
import { GYM_CROWD, GYM_LIFT_STAGE } from '../art/gymTuning';
import { renderLifterFrame } from '../art/lifterSprite';
import { BAR_AND_COLLARS_KG, layoutSleeve, visualPlateStack } from '../art/plates';
import type { IndexGrid } from '../art/raster';
import { LOAD_PRESETS, QUANTISE, RESOLUTION, STRAIN } from '../art/spriteTuning';
import { LIFT_TUNING } from '../game/liftTuning';
import { meetLoadingRules } from '../game/meet';
import { walkoutMs } from '../game/meetDay';
import { holdWalkoutAtMs, MEET_MOMENTS, previewStateFor } from '../game/meetPreview';
import { MEET_PREVIEW, MEET_TUNING } from '../game/meetTuning';
import { SPRITE_BOX } from '../lift/liftFrame';
import { hallLifterFrame, hallPlateCount, hallScene, MEET_HALL_SCENE } from './meetHall';
import {
  barLoadMs,
  buildWalkout,
  CHEER_CROWD_RISE,
  crowdRisePxAt,
  WALKOUT_CROWD_RISE,
  WALKOUT_STAGES,
  walkoutFrameAt,
  walkoutFrameIndexAt,
  walkoutLifterFrame,
  walkoutMotionMs,
  walkoutStageAt,
  walkoutStageStartMs,
  type WalkoutFrame,
} from './walkout';

/** A heavy competition squat, so the sleeve is long and the strain is real. */
const HEAVY_KG = 240;
const LOAD = LOAD_PRESETS.MAXIMAL;
const PLATES = hallPlateCount(HEAVY_KG, BAR_AND_COLLARS_KG);

const URGENT = buildWalkout({ loadRatio: LOAD, plateCount: PLATES, urgent: true });
const ORDINARY = buildWalkout({ loadRatio: LOAD, plateCount: PLATES, urgent: false });
const AT = walkoutStageStartMs(PLATES);

// ---------------------------------------------------------------------------
// The instrument
// ---------------------------------------------------------------------------

/**
 * The hall as the screen composites it, at one instant of the beat.
 *
 * A fresh room every call, because `blitOver` writes into its base.
 *
 * The BAR IS DRAWN FULLY LOADED. `MeetHallView` draws a bare frame under a
 * clipped loaded one only while the discs are landing, which is the `LOAD`
 * stage and `meetHall.test.ts`'s subject; every instant this file compares is
 * after the last plate, where the clip covers the whole cell and the composite
 * is exactly the loaded drawing.
 */
function hallAt(frame: WalkoutFrame | null): IndexGrid {
  const scene = renderGymScene(hallScene(frame?.crowdRisePx ?? 0));
  const spec =
    frame === null
      ? hallLifterFrame(LOAD, HEAVY_KG, BAR_AND_COLLARS_KG)
      : walkoutLifterFrame(frame, HEAVY_KG, BAR_AND_COLLARS_KG);
  const { grid } = renderLifterFrame(spec);
  return blitOver(
    scene,
    grid,
    GYM_LIFT_STAGE.SPRITE_X + (frame?.bodyDxPx ?? 0),
    GYM_LIFT_STAGE.SPRITE_Y,
  );
}

function hallMs(sequence: typeof URGENT, ms: number): IndexGrid {
  return hallAt(walkoutFrameAt(sequence, ms));
}

function differingPixels(a: IndexGrid, b: IndexGrid): number {
  expect(a.data.length, 'the two composites are not the same box').toBe(b.data.length);
  let n = 0;
  for (let i = 0; i < a.data.length; i += 1) if (a.data[i] !== b.data[i]) n += 1;
  return n;
}

/** Every differing pixel's row, as a span. `null` when the two are identical. */
function differingRows(a: IndexGrid, b: IndexGrid): { top: number; bottom: number } | null {
  let top = a.h;
  let bottom = -1;
  for (let y = 0; y < a.h; y += 1) {
    for (let x = 0; x < a.w; x += 1) {
      const i = y * a.w + x;
      if (a.data[i] === b.data[i]) continue;
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  return bottom < 0 ? null : { top, bottom };
}

/** Pixels of seating, both values of the crowd ramp. */
function crowdPixels(grid: IndexGrid): number {
  let n = 0;
  for (const v of grid.data) if (v === GYM.CROWD_DARK || v === GYM.CROWD_MID) n += 1;
  return n;
}

describe('the composite this file measures is the composite the screen draws', () => {
  it('places the sprite where MeetHallView places it, at the same integer scale', () => {
    // Without this, every pixel measurement below could be of a picture no
    // screen ever shows. `MeetHallView` draws the room at `ORIGIN` and scale
    // `GYM_LIFT_STAGE.SCALE`, and the sprite at `SPRITE_BOX` offset by
    // `bodyDxPx * SPRITE_SCALE` screen points — so a whole sprite pixel of body
    // travel is a whole scene pixel here only if these agree.
    const scale = GYM_LIFT_STAGE.SCALE;
    expect(LIFT_TUNING.FEEDBACK.SPRITE_SCALE).toBe(scale);
    expect(SPRITE_BOX.x).toBe(GYM_LIFT_STAGE.ORIGIN_X + GYM_LIFT_STAGE.SPRITE_X * scale);
    expect(SPRITE_BOX.y).toBe(GYM_LIFT_STAGE.ORIGIN_Y + GYM_LIFT_STAGE.SPRITE_Y * scale);
    expect(Number.isInteger(scale)).toBe(true);
  });

  it('measures a room with people in it', () => {
    // The other non-vacuity control: `hallAt` really does render the meet hall.
    expect(crowdPixels(hallAt(null))).toBeGreaterThan(0);
    expect(hallAt(null).data.length).toBe(GYM_LIFT_STAGE.W * GYM_LIFT_STAGE.H);
  });
});

// ---------------------------------------------------------------------------
// THE CLAIM: the beat named after a walk-out contains one
// ---------------------------------------------------------------------------

describe('the walk-out moves (GDD §6.2 step 1)', () => {
  /**
   * Four instants, one per stage that has motion in it, plus the settled end.
   * Named by stage rather than by number so a tuning pass that moves a duration
   * moves these with it.
   */
  const M = MEET_TUNING.WALKOUT_MOTION;
  /** Far enough into a step to be past the transfer and onto the plant. */
  const PLANT_MS = M.STEP_MS * 0.85;
  const INSTANTS: readonly { readonly name: string; readonly ms: number }[] = [
    { name: 'racked, bar loaded', ms: AT.UNRACK - M.TICK_MS },
    { name: 'mid-unrack', ms: AT.UNRACK + M.UNRACK_MS / 2 },
    { name: 'first plant', ms: AT.STEP + PLANT_MS },
    { name: 'second plant', ms: AT.STEP + M.STEP_MS + PLANT_MS },
    { name: 'set', ms: AT.SET },
  ];

  /**
   * THE MUTATION THIS TEST EXISTS FOR, and the number that used to be zero.
   *
   * Every consecutive pair of instants must differ by more than this many scene
   * pixels. Measured at these values: 224 / 344 / 391 / 279 for the four pairs
   * on an ordinary walk-out. The bound is deliberately far below the smallest of
   * them — this is "the picture is not the same picture", not a pin on a
   * drawing nobody has looked at.
   *
   * FREEZE THE CLOCK AND THIS GOES RED. Make `walkoutFrameAt` return
   * `sequence.frames[0]`, or make `buildWalkout` emit one frame, and every pair
   * collapses to 0.
   */
  const A_PICTURE_THAT_CHANGED = 100;

  it('draws a different picture at every stage of the beat', () => {
    const shots = INSTANTS.map((instant) => ({
      ...instant,
      grid: hallMs(ORDINARY, instant.ms),
    }));

    for (let i = 1; i < shots.length; i += 1) {
      const before = shots[i - 1];
      const after = shots[i];
      if (before === undefined || after === undefined) throw new Error('unreachable');
      const moved = differingPixels(before.grid, after.grid);
      expect(moved, `${before.name} -> ${after.name} is the same picture`).toBeGreaterThan(
        A_PICTURE_THAT_CHANGED,
      );
    }

    // ...and no two of the five are the same drawing, so the beat is not two
    // pictures with three repeats in it.
    for (let i = 0; i < shots.length; i += 1) {
      for (let j = i + 1; j < shots.length; j += 1) {
        const a = shots[i];
        const b = shots[j];
        if (a === undefined || b === undefined) throw new Error('unreachable');
        expect(differingPixels(a.grid, b.grid), `${a.name} == ${b.name}`).toBeGreaterThan(0);
      }
    }
  });

  it('moves the LIFTER, not just the room', () => {
    // Stated as its own assertion because "the picture changed" would also be
    // satisfied by a background that flickered while the man stood still. On an
    // ordinary walk-out the room is the SAME room at both instants — the crowd
    // never comes up — so every differing pixel has to be inside the sprite's
    // own cell.
    const racked = hallMs(ORDINARY, AT.UNRACK - MEET_TUNING.WALKOUT_MOTION.TICK_MS);
    const planted = hallMs(ORDINARY, AT.STEP + MEET_TUNING.WALKOUT_MOTION.STEP_MS * 0.85);
    const rooms = differingPixels(renderGymScene(hallScene(0)), renderGymScene(hallScene(0)));
    expect(rooms, 'the room is not stable between two renders').toBe(0);

    const span = differingRows(racked, planted);
    expect(span, 'nothing moved at all').not.toBeNull();
    expect(span?.top).toBeGreaterThanOrEqual(GYM_LIFT_STAGE.SPRITE_Y);
    expect(span?.bottom).toBeLessThan(GYM_LIFT_STAGE.SPRITE_Y + RESOLUTION.CELL_H);
  });

  it('takes the bar off the hooks: he starts dipped and ends standing', () => {
    const racked = walkoutFrameAt(ORDINARY, AT.LOAD);
    const set = walkoutFrameAt(ORDINARY, AT.SET);
    expect(racked.stage).toBe('LOAD');
    expect(racked.depth, 'he is not sitting under the bar while it loads').toBeGreaterThan(
      set.depth,
    );
    // ...and the dip is a whole number of the sheet's authored depth steps, so
    // it is a drawing rather than a rounding error.
    const steps = Math.round(racked.depth * QUANTISE.DEPTH_STEPS) -
      Math.round(set.depth * QUANTISE.DEPTH_STEPS);
    expect(steps).toBe(MEET_TUNING.WALKOUT_MOTION.RACK_DIP_STEPS);
  });

  it('steps back: the body plants each way and the bar rocks the other way', () => {
    const stepping = ORDINARY.frames.filter((f) => f.stage === 'STEP');
    const left = stepping.filter((f) => f.bodyDxPx < 0);
    const right = stepping.filter((f) => f.bodyDxPx > 0);
    expect(left.length, 'he never plants one way').toBeGreaterThan(0);
    expect(right.length, 'he never plants the other way').toBeGreaterThan(0);

    // Each plant is smaller than the first: he is settling, not pacing.
    const widest = Math.max(...stepping.map((f) => Math.abs(f.bodyDxPx)));
    expect(widest).toBe(MEET_TUNING.WALKOUT_MOTION.STEP_BODY_DX_PX);

    // The bar goes the OTHER way, on every frame that moves at all. This is the
    // thing that reads as a walk-out in a front view rather than as a man
    // sliding sideways.
    for (const frame of stepping) {
      if (frame.bodyDxPx === 0) continue;
      expect(
        Math.sign(frame.barLateralPx),
        `bar and body both went ${frame.bodyDxPx > 0 ? 'right' : 'left'} at ${frame.startMs}ms`,
      ).toBe(-Math.sign(frame.bodyDxPx));
    }
  });

  it('settles onto EXACTLY the drawing the rep begins from', () => {
    // THE CONTINUITY PROPERTY, on pixels. The cut from the walk-out to the
    // attempt is a cut inside one shot, so the last frame of the beat and the
    // still every other staged beat draws must be the same composite — not
    // similar, identical.
    const set = hallMs(ORDINARY, ORDINARY.motionMs);
    const still = hallAt(null);
    expect(differingPixels(set, still)).toBe(0);

    // ...and the spec really is the same spec, field for field.
    expect(walkoutLifterFrame(walkoutFrameAt(ORDINARY, ORDINARY.motionMs), HEAVY_KG, BAR_AND_COLLARS_KG))
      .toEqual(hallLifterFrame(LOAD, HEAVY_KG, BAR_AND_COLLARS_KG));
  });

  it('goes still and stays still — no loop, no drift', () => {
    const last = ORDINARY.frames[ORDINARY.frames.length - 1];
    expect(last).toBeDefined();
    for (const ms of [ORDINARY.motionMs, ORDINARY.motionMs * 2, walkoutMs(3, HEAVY_KG, null, true)]) {
      expect(walkoutFrameAt(ORDINARY, ms).index, `${ms}ms`).toBe(last?.index);
    }
    // A beat that is mostly stillness is the design (GDD §6.2 calls it "brief"
    // and §12.2 judges the dread), so the last stage really is the longest hold.
    expect(ORDINARY.motionMs).toBeLessThan(walkoutMs(1, HEAVY_KG, null, false));
  });
});

// ---------------------------------------------------------------------------
// THE SECOND CLAIM: `urgent` reaches the picture
// ---------------------------------------------------------------------------

describe('a third attempt is a different picture from an opener', () => {
  /**
   * THE NUMBER THAT USED TO BE ZERO.
   *
   * Below the copy block, an opener's settled walk-out and a third attempt's
   * differed in ZERO pixels — the hall was byte-identical. This is the same
   * measurement on the same instant of the same beat, in scene pixels.
   *
   * Measured at these values: 959 of the room's 22,490 scene pixels, 4.3% of
   * it. At the stage's integer scale of 3, photographed at device pixel ratio 2,
   * that is 34,524 screen pixels — half again as many as the 22,467 the copy
   * block accounted for in the frames that had nothing below it.
   *
   * Pinned as a FLOOR rather than exactly, because it is a function of how far
   * the crowd rises and that is a value a playtest pass will turn. The floor is
   * set below rise 3 (719) so a one-row reduction does not fail the suite, and
   * far above zero, which is what it used to be.
   */
  const THE_HALL_KNOWS = 500;

  it('brings the hall up, and an opener does not', () => {
    const opener = hallMs(ORDINARY, ORDINARY.motionMs);
    const third = hallMs(URGENT, URGENT.motionMs);
    const moved = differingPixels(opener, third);
    expect(moved, 'the opener and the third attempt are the same picture').toBeGreaterThan(
      THE_HALL_KNOWS,
    );

    // AND IT IS THE CROWD, not the lifter. He is under the same bar at the same
    // weight and must be drawn identically; a third attempt that changed how a
    // man stands would be a lie about the sport.
    expect(walkoutFrameAt(URGENT, URGENT.motionMs).crowdRisePx).toBe(
      MEET_TUNING.CROWD.WALKOUT_RISE_PX,
    );
    expect(walkoutFrameAt(ORDINARY, ORDINARY.motionMs).crowdRisePx).toBe(0);
    // Compared as the SPRITE'S OWN INPUT rather than as the frame object, so
    // the check is "the same man is drawn" and not "the two sheets have the same
    // number of drawings in them".
    const figureOf = (sequence: typeof URGENT): unknown =>
      walkoutLifterFrame(
        walkoutFrameAt(sequence, sequence.motionMs),
        HEAVY_KG,
        BAR_AND_COLLARS_KG,
      );
    expect(figureOf(URGENT)).toEqual(figureOf(ORDINARY));
    expect(walkoutFrameAt(URGENT, URGENT.motionMs).bodyDxPx).toBe(
      walkoutFrameAt(ORDINARY, ORDINARY.motionMs).bodyDxPx,
    );

    // ...and the difference sits entirely ABOVE the platform, in the seating.
    const span = differingRows(opener, third);
    expect(span).not.toBeNull();
    expect(span?.bottom).toBeLessThan(GYM_LIFT_STAGE.FLOOR_ROW);
  });

  it('never lets a risen hall reach down toward the lifter', () => {
    // THE READABILITY GUARANTEE THIS COULD HAVE BROKEN. `meetStage.test.ts`
    // measures zero sub-perceptual silhouette crossings against the crowd,
    // because `GYM_CROWD.RISER_ROWS` puts the seating above the lifter's crown.
    // A crowd that grew DOWNWARD when it stood would undo that silently.
    const seated = renderGymScene(hallScene(0));
    const standing = renderGymScene(hallScene(MEET_TUNING.CROWD.CHEER_RISE_PX));
    let lowestNewCrowdRow = -1;
    let lowestSeatedCrowdRow = -1;
    for (let y = 0; y < seated.h; y += 1) {
      for (let x = 0; x < seated.w; x += 1) {
        const i = y * seated.w + x;
        const was = seated.data[i];
        const now = standing.data[i];
        const isCrowd = (v: number | undefined): boolean =>
          v === GYM.CROWD_DARK || v === GYM.CROWD_MID;
        if (isCrowd(was)) lowestSeatedCrowdRow = Math.max(lowestSeatedCrowdRow, y);
        if (isCrowd(now) && !isCrowd(was)) lowestNewCrowdRow = Math.max(lowestNewCrowdRow, y);
      }
    }
    expect(lowestSeatedCrowdRow, 'there is no crowd to measure').toBeGreaterThan(0);
    // Nothing new appears below where crowd could already be.
    expect(lowestNewCrowdRow).toBeLessThanOrEqual(lowestSeatedCrowdRow);
  });

  it('stands the crowd up without turning it into a slab', () => {
    // THE OTHER FAILURE MODE, and the one a "make it more visible" tuning pass
    // would walk into. Each silhouette grows UPWARD, so enough rise closes every
    // dark gap between spectators and the band stops reading as people at all.
    // Both bounds are on rendered pixels.
    const bandOf = (rise: number): { lit: number; dark: number } => {
      const grid = renderGymScene(hallScene(rise));
      let lit = 0;
      let dark = 0;
      for (const v of grid.data) {
        if (v === GYM.CROWD_MID) lit += 1;
        else if (v === GYM.CROWD_DARK) dark += 1;
      }
      return { lit, dark };
    };

    const seated = bandOf(0);
    const walkout = bandOf(MEET_TUNING.CROWD.WALKOUT_RISE_PX);
    const cheer = bandOf(MEET_TUNING.CROWD.CHEER_RISE_PX);

    // They really do stand: more of the band is a person than was.
    expect(walkout.lit).toBeGreaterThan(seated.lit);
    expect(cheer.lit).toBeGreaterThan(walkout.lit);

    // ...and there is still air between them. A fifth of the band's pixels is
    // the floor; at these values the walk-out leaves 26% and the cheer 23%.
    const band = seated.lit + seated.dark;
    expect(band, 'there is no seating to measure').toBeGreaterThan(0);
    expect(walkout.dark / band).toBeGreaterThan(1 / 5);
    expect(cheer.dark / band).toBeGreaterThan(1 / 5);

    // The bound bites: a rise of two whole seating pitches closes the gaps and
    // fails it, which is what makes the numbers above a choice rather than a
    // description.
    expect(bandOf(GYM_CROWD.ROW_PITCH * 2).dark / band).toBeLessThan(1 / 5);
  });

  it('leaves a seated hall byte-identical to the room every other beat draws', () => {
    // `hallScene(0)` must be `MEET_HALL_SCENE` itself, not a copy with an extra
    // field — otherwise every previously-measured room in this project quietly
    // becomes a different object with a different memo key.
    expect(hallScene(0)).toBe(MEET_HALL_SCENE);
    expect(hallScene(-MEET_TUNING.CROWD.CHEER_RISE_PX)).toBe(MEET_HALL_SCENE);
    expect(differingPixels(renderGymScene(hallScene(0)), renderGymScene(MEET_HALL_SCENE))).toBe(0);
  });

  it('comes up over time rather than switching on', () => {
    const rises = ORDINARY.frames.map((f) => f.crowdRisePx);
    expect(new Set(rises).size, 'an opener has a crowd doing something').toBe(1);

    const urgentRises = URGENT.frames.map((f) => f.crowdRisePx);
    expect(new Set(urgentRises).size, 'the hall stands up in one frame').toBeGreaterThan(2);
    // Monotonic: nobody sits back down mid-walk-out.
    for (let i = 1; i < urgentRises.length; i += 1) {
      expect(urgentRises[i] ?? 0).toBeGreaterThanOrEqual(urgentRises[i - 1] ?? 0);
    }
    // Seated while the bar is still being loaded — the hall reacts to him
    // taking it, not to the crew.
    expect(walkoutFrameAt(URGENT, AT.LOAD).crowdRisePx).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// THE THIRD CLAIM: the crowd reacts to three whites
// ---------------------------------------------------------------------------

describe('the hall reacts to a good lift, and to nothing else', () => {
  it('is a different room after the last lamp than during the deliberation', () => {
    // The flattest frame in the sequence was three white lights in a hall that
    // did not move. Measured the same way: whole scene pixels.
    const waiting = renderGymScene(hallScene(0));
    const cheering = renderGymScene(hallScene(MEET_TUNING.CROWD.CHEER_RISE_PX));
    expect(differingPixels(waiting, cheering)).toBeGreaterThan(0);
    // DELETE THE REACTION — pass 0 where the verdict passes the ramp's top —
    // and this is the assertion that goes red.
    expect(crowdRisePxAt(MEET_TUNING.CROWD.CHEER_RISE_MS, CHEER_CROWD_RISE)).toBe(
      MEET_TUNING.CROWD.CHEER_RISE_PX,
    );
    expect(CHEER_CROWD_RISE.toPx).toBeGreaterThan(0);
  });

  it('stands FURTHER than it does on a walk-out', () => {
    // The ordering is the design claim; the values are a starting point nobody
    // has watched on a phone. Anticipation is people getting up; a good lift is
    // people already up.
    expect(CHEER_CROWD_RISE.toPx).toBeGreaterThan(WALKOUT_CROWD_RISE.toPx);
    // ...and faster: a reaction, not an anticipation.
    expect(CHEER_CROWD_RISE.rampMs).toBeLessThan(WALKOUT_CROWD_RISE.rampMs);
  });

  it('is seated before its ramp starts, so it cannot leak a verdict', () => {
    // The deliberation beat must be identical whichever way the call went. The
    // ramp is measured from AFTER the last lamp, so every negative offset — the
    // whole of the deliberation — is a seated hall.
    for (const before of [-MEET_TUNING.DELIBERATION_MS, -MEET_TUNING.LIGHT_FADE_MS, 0]) {
      expect(crowdRisePxAt(before, CHEER_CROWD_RISE), `${before}ms`).toBe(0);
    }
  });

  it('rises in whole rows, so the room is rasterised a handful of times', () => {
    const seen = new Set<number>();
    for (let ms = 0; ms <= CHEER_CROWD_RISE.rampMs; ms += 1) {
      seen.add(crowdRisePxAt(ms, CHEER_CROWD_RISE));
    }
    for (const rise of seen) expect(Number.isInteger(rise)).toBe(true);
    expect(seen.size).toBeLessThanOrEqual(CHEER_CROWD_RISE.toPx + 1);
  });
});

// ---------------------------------------------------------------------------
// The order the bar is loaded in, and the shape of the sheet
// ---------------------------------------------------------------------------

describe('the bar is loaded before he takes it off the hooks', () => {
  it('holds the unrack until the last disc could have landed', () => {
    // The complaint this answers: the plates were landing on a bar that was
    // already being walked out. `WalkoutView` drops one disc per
    // `BAR_LOAD_PLATE_STAGGER_MS`, so the loading window has to cover every disc
    // on the heaviest bar this game can build.
    for (const kg of [BAR_AND_COLLARS_KG, 100, 207.5, HEAVY_KG, 320, 400]) {
      const discs = layoutSleeve(visualPlateStack(kg, BAR_AND_COLLARS_KG)).slots.length;
      const lastDiscAt = Math.max(0, discs - 1) * MEET_TUNING.BAR_LOAD_PLATE_STAGGER_MS;
      expect(barLoadMs(discs), `${kg} kg`).toBeGreaterThan(lastDiscAt);
      expect(walkoutStageStartMs(discs).UNRACK, `${kg} kg`).toBeGreaterThan(lastDiscAt);
    }
    // The measurement is not vacuous: a real bar has real discs on it.
    expect(layoutSleeve(visualPlateStack(HEAVY_KG, BAR_AND_COLLARS_KG)).slots.length)
      .toBeGreaterThan(2);
  });

  it('never runs the choreography past the beat the meet gives it', () => {
    // An opener is the shortest walk-out there is (`walkoutMs`), so if the
    // motion fits inside that it fits inside every other.
    for (const kg of [BAR_AND_COLLARS_KG, 207.5, HEAVY_KG, 400]) {
      const discs = layoutSleeve(visualPlateStack(kg, BAR_AND_COLLARS_KG)).slots.length;
      expect(walkoutMotionMs(discs), `${kg} kg`).toBeLessThanOrEqual(
        walkoutMs(1, kg, null, false),
      );
    }
  });

  it('walks its stages in order and reaches every one of them', () => {
    const at = walkoutStageStartMs(PLATES);
    let previous = -1;
    for (const stage of WALKOUT_STAGES) {
      expect(at[stage], `${stage} does not follow the stage before it`).toBeGreaterThan(previous);
      previous = at[stage];
      expect(walkoutStageAt(at[stage], PLATES), stage).toBe(stage);
    }
    expect(new Set(ORDINARY.frames.map((f) => f.stage))).toEqual(new Set(WALKOUT_STAGES));
  });
});

describe('the walk-out is a finite sheet, not a per-frame deformation (GDD §7.1)', () => {
  it('coalesces into a sheet a 16-bit game could have shipped', () => {
    // A drawing per display frame over a 2 s beat would be ~120 drawings. The
    // bound is generous but it is a bound: this is what stops the choreography
    // becoming a continuous tween with a pixel filter on it.
    const A_SHEET = 48;
    expect(ORDINARY.frames.length).toBeGreaterThan(WALKOUT_STAGES.length);
    expect(ORDINARY.frames.length).toBeLessThan(A_SHEET);
    expect(URGENT.frames.length).toBeLessThan(A_SHEET);
    // ...and the urgent one costs a few more, because the crowd's rows are part
    // of the drawn identity.
    expect(URGENT.frames.length).toBeGreaterThan(ORDINARY.frames.length);
  });

  it('puts every channel on the sheet’s own quanta', () => {
    for (const frame of URGENT.frames) {
      const on = (value: number, step: number): boolean =>
        Math.abs(value / step - Math.round(value / step)) < 1e-9;
      expect(on(frame.depth, 1 / QUANTISE.DEPTH_STEPS), `depth ${frame.depth}`).toBe(true);
      expect(on(frame.barLateralPx, QUANTISE.LATERAL_QUANTUM_PX)).toBe(true);
      expect(on(frame.barTiltDeg, QUANTISE.TILT_QUANTUM_DEG)).toBe(true);
      expect(on(frame.barBendPx, QUANTISE.BEND_QUANTUM_PX)).toBe(true);
      expect(Number.isInteger(frame.bodyDxPx)).toBe(true);
      expect(Number.isInteger(frame.crowdRisePx)).toBe(true);
      expect(Number.isInteger(frame.strainLevel)).toBe(true);
      expect(frame.strainLevel).toBeLessThan(STRAIN.LEVELS);
    }
  });

  it('adds strain only where he is actually driving the bar', () => {
    // SCARCITY. Letting the steps feed the strain channel too made the body flip
    // rungs four times during the walk back, which at this quantisation is a
    // twitch rather than effort.
    const rest = walkoutFrameAt(ORDINARY, ORDINARY.motionMs).strainLevel;
    const byStage = new Map<string, Set<number>>();
    for (const frame of ORDINARY.frames) {
      const seen = byStage.get(frame.stage) ?? new Set<number>();
      seen.add(frame.strainLevel);
      byStage.set(frame.stage, seen);
    }
    expect([...(byStage.get('UNRACK') ?? [])].some((s) => s > rest)).toBe(true);
    for (const stage of ['LOAD', 'STEP', 'SETTLE', 'SET']) {
      expect([...(byStage.get(stage) ?? [rest])], stage).toEqual([rest]);
    }
  });

  it('is deterministic — the same attempt is the same beat every time', () => {
    expect(buildWalkout({ loadRatio: LOAD, plateCount: PLATES, urgent: false })).toEqual(ORDINARY);
  });

  it('indexes a frame by time the same way the render loop does', () => {
    for (const frame of URGENT.frames) {
      expect(walkoutFrameIndexAt(URGENT, frame.startMs)).toBe(frame.index);
      expect(walkoutFrameIndexAt(URGENT, frame.startMs + frame.holdMs - 1)).toBe(frame.index);
    }
    expect(walkoutFrameIndexAt(URGENT, -URGENT.motionMs)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The two instants the capture photographs
// ---------------------------------------------------------------------------

describe('the mid-motion preview beats land where they are named', () => {
  /**
   * The third attempt the preview builds, and the discs on its bar — read out of
   * the preview's own state and the federation's own loading rules, so a tuning
   * pass that moves the opener moves this with it.
   */
  function previewThird(): { sequence: ReturnType<typeof buildWalkout>; plates: number } {
    const state = previewStateFor({ moment: 'walkout-third' });
    const live = state.live;
    if (live === null) throw new Error('the walkout-third preview has no attempt on the bar');
    const barKg = meetLoadingRules(state.meet).barAndCollarsWeight[live.lift];
    const plates = hallPlateCount(live.weightKg, barKg);
    return {
      sequence: buildWalkout({ loadRatio: live.loadRatio, plateCount: plates, urgent: true }),
      plates,
    };
  }

  it('holds walkout-unrack inside the unrack and walkout-step inside a step', () => {
    // The photographs exist to show motion in stills, so each has to land in the
    // stage it is named for. Checked against the sequence the preview's own
    // attempt builds, not against arithmetic on the constants.
    const { sequence, plates } = previewThird();
    const unrackAt = MEET_PREVIEW.WALKOUT_HOLD_MS.UNRACK;
    const stepAt = MEET_PREVIEW.WALKOUT_HOLD_MS.STEP;
    expect(walkoutStageAt(unrackAt, plates)).toBe('UNRACK');
    expect(walkoutStageAt(stepAt, plates)).toBe('STEP');

    // ...and the two are genuinely different pictures from each other and from
    // the settled frame the third-attempt shot is taken at.
    const shots = [unrackAt, stepAt, sequence.motionMs].map((ms) =>
      hallAt(walkoutFrameAt(sequence, ms)),
    );
    for (let i = 0; i < shots.length; i += 1) {
      for (let j = i + 1; j < shots.length; j += 1) {
        const a = shots[i];
        const b = shots[j];
        if (a === undefined || b === undefined) throw new Error('unreachable');
        expect(differingPixels(a, b), `preview shots ${i} and ${j} are the same frame`)
          .toBeGreaterThan(0);
      }
    }
    // The step shot catches him off centre, which is the whole reason it is
    // taken there.
    expect(walkoutFrameAt(sequence, stepAt).bodyDxPx).not.toBe(0);
  });

  it('lets every other beat play, and freezes only these two', () => {
    const held = MEET_MOMENTS.filter((moment) => holdWalkoutAtMs(moment) !== null);
    expect(held).toEqual(['walkout-unrack', 'walkout-step']);
    // `walkout` and `walkout-third` run their clocks and come to rest, which is
    // what makes the crowd the only thing separating those two frames.
    expect(holdWalkoutAtMs('walkout')).toBeNull();
    expect(holdWalkoutAtMs('walkout-third')).toBeNull();
  });

  it('photographs the SAME attempt at all three walk-out instants', () => {
    // Otherwise the frames differ because they are different lifts, and the
    // comparison says nothing about the choreography.
    const third = previewStateFor({ moment: 'walkout-third' }).live;
    for (const moment of ['walkout-unrack', 'walkout-step'] as const) {
      const live = previewStateFor({ moment }).live;
      expect(live?.weightKg, moment).toBe(third?.weightKg);
      expect(live?.attemptNumber, moment).toBe(third?.attemptNumber);
      expect(live?.bombRisk, moment).toBe(third?.bombRisk);
    }
    // ...and the opener really is a different attempt, so the crowd measurement
    // above is comparing an urgent walk-out with a non-urgent one.
    const opener = previewStateFor({ moment: 'walkout' }).live;
    expect(opener?.attemptNumber).not.toBe(third?.attemptNumber);
    expect(opener?.bombRisk).toBe(false);
    expect(third?.bombRisk).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The one number nobody can check here
// ---------------------------------------------------------------------------

describe('what this file does NOT claim', () => {
  it('records that the pacing half of GDD §12.2 is unverified', () => {
    // Not a behaviour test. It is here so the claim is in the suite rather than
    // only in a comment: every duration the choreography runs on is a starting
    // point, and GDD §12.1 puts the tuning of them after the run, by hand, with
    // people watching. Broadcast footage is unreachable from this environment.
    const motion = MEET_TUNING.WALKOUT_MOTION;
    expect(motion.UNRACK_MS).toBeGreaterThan(0);
    expect(motion.STEP_MS).toBeGreaterThan(0);
    expect(motion.SETTLE_MS).toBeGreaterThan(0);
    expect(MEET_TUNING.CROWD.WALKOUT_RISE_MS).toBeGreaterThan(0);
  });
});
