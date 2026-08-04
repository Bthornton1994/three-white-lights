/**
 * THE WALKOUT'S BAR, AND THE ROOM IT IS LOADED IN.
 *
 * ===========================================================================
 * WHAT THIS FILE IS FOR
 * ===========================================================================
 * `meetHall.ts` exists because of a GDD §7.1 violation on the highest-value
 * screen in the game: the walk-out drew its barbell as `Animated.View`s with
 * `backgroundColor`, `borderColor` and `borderRadius` — anti-aliased vector
 * rectangles — two seconds before the player squatted a chunky
 * nearest-neighbour pixel bar with knurl rings and collars. §7.1 commits to a
 * fixed internal resolution and nearest-neighbour scaling THROUGHOUT, and the
 * walkout never entered that pipeline at all.
 *
 * The replacement is a clip rather than a second drawing, and that only works
 * if three things are true. They are the three claims below, and each of them
 * is checked on rendered pixels rather than on the code that produces them:
 *
 *   1. The plate ladder is `src/art/plates.ts`'s, not a second one.
 *   2. Widening the window reveals discs INBOARD FIRST, one at a time, whole.
 *   3. Two renders of the same pose at two weights are the same FIGURE, so the
 *      bare bar underneath and the loaded bar on top do not show a seam down
 *      the middle of a man.
 *
 * (3) is the load-bearing one, and it is NOT perfectly true — see the test. The
 * measured residue is eleven pixels at the shaft/sleeve junction where the
 * outline pass resolves differently once a disc is there, and it is pinned by
 * count and by position rather than claimed away.
 */

import { describe, expect, it } from 'vitest';

import { renderGymScene, liftStageScene } from '../art/gymScene';
import { isBodyIndex, renderLifterFrame } from '../art/lifterSprite';
import { isTransparentIndex } from '../art/palette';
import { BAR_AND_COLLARS_KG, layoutSleeve, visualPlateStack } from '../art/plates';
import { getPx, type IndexGrid } from '../art/raster';
import { BAR, CENTER_X, LOAD_PRESETS, RESOLUTION } from '../art/spriteTuning';
import { MEET_TUNING } from '../game/meetTuning';
import { hallLifterFrame, hallPlateCount, plateRevealPx, MEET_HALL_SCENE } from './meetHall';

/**
 * A bar with a long stack: 25/25/25/25/20/2.5 a side at a 25 kg bar. Chosen so
 * the reveal has several steps to walk and so "one disc at a time" is a claim
 * with something to say.
 */
const HEAVY_KG = 240;
const LOAD = LOAD_PRESETS.MAXIMAL;

function frameFor(totalKg: number): IndexGrid {
  return renderLifterFrame(hallLifterFrame(LOAD, totalKg, BAR_AND_COLLARS_KG)).grid;
}

/** Palette-bank-1 (equipment) pixels inside the reveal window, right sleeve. */
function sleevePixelsWithin(grid: IndexGrid, halfWidthPx: number): number {
  let n = 0;
  for (let y = 0; y < grid.h; y += 1) {
    for (let x = Math.ceil(CENTER_X + BAR.SHAFT_HALF_PX); x < grid.w; x += 1) {
      if (x - CENTER_X > halfWidthPx) continue;
      const v = getPx(grid, x, y);
      if (isTransparentIndex(v) || isBodyIndex(v)) continue;
      n += 1;
    }
  }
  return n;
}

// ---------------------------------------------------------------------------
// The room
// ---------------------------------------------------------------------------

describe('MEET_HALL_SCENE', () => {
  it('is the rep’s own box with the meet venue in it', () => {
    const rep = liftStageScene();
    expect(MEET_HALL_SCENE.venue).toBe(MEET_TUNING.VENUE);
    expect(MEET_HALL_SCENE.venue).not.toBe(rep.venue);
    // Everything else is identical, field by field, so the walkout and the rep
    // are the same camera in the same building.
    expect({ ...MEET_HALL_SCENE, venue: rep.venue }).toEqual(rep);
  });

  it('renders a room that is materially not the training gym', () => {
    const hall = renderGymScene(MEET_HALL_SCENE);
    const gym = renderGymScene(liftStageScene());
    expect(hall.data.length).toBe(gym.data.length);
    let differing = 0;
    for (let i = 0; i < hall.data.length; i += 1) if (hall.data[i] !== gym.data[i]) differing += 1;
    expect(differing).toBeGreaterThan(hall.data.length / 3);
  });
});

// ---------------------------------------------------------------------------
// The bar
// ---------------------------------------------------------------------------

describe('the walkout’s bar is the sprite’s bar', () => {
  it('counts the discs on ONE side, from the art module’s own loader', () => {
    // Not a ladder of its own. Deleting `plates.ts`'s 25 kg disc would move both
    // sides of this equality, which is the point of writing it as one.
    const perSide = layoutSleeve(visualPlateStack(HEAVY_KG, BAR_AND_COLLARS_KG)).slots.length;
    expect(hallPlateCount(HEAVY_KG, BAR_AND_COLLARS_KG)).toBe(perSide);
    expect(perSide).toBeGreaterThan(2);
    // An empty bar has no discs and therefore no thuds.
    expect(hallPlateCount(BAR_AND_COLLARS_KG, BAR_AND_COLLARS_KG)).toBe(0);
  });

  it('opens the window one disc at a time, inboard first', () => {
    const count = hallPlateCount(HEAVY_KG, BAR_AND_COLLARS_KG);
    const steps = [];
    for (let k = 0; k <= count; k += 1) steps.push(plateRevealPx(k, HEAVY_KG, BAR_AND_COLLARS_KG));

    // Nothing loaded is the bare knurled shaft and no more.
    expect(steps[0]).toBe(BAR.SHAFT_HALF_PX);
    // Strictly widening, so no step is a no-op the player would see as a
    // dropped plate.
    for (let k = 1; k <= count; k += 1) {
      expect(steps[k], `step ${k} did not widen`).toBeGreaterThan(steps[k - 1] ?? 0);
    }
    // Fully loaded reaches past the collars, which sit outboard of the last
    // disc — a collar goes on last on a real platform too.
    expect(steps[count]).toBeGreaterThan(BAR.HALF_SPAN_PX + BAR.COLLAR_WIDTH_PX);
    expect(steps[count]).toBe(RESOLUTION.CELL_W);
  });

  it('reveals WHOLE discs — the count in the window is the count asked for', () => {
    // ON THE RENDERED GRID. Every step must add strictly more sleeve pixels than
    // the one before, and the last step must equal the whole loaded sleeve. A
    // reveal that cut a disc in half would still widen, and would still pass the
    // geometry test above; this is what says the plates land whole.
    const loaded = frameFor(HEAVY_KG);
    const count = hallPlateCount(HEAVY_KG, BAR_AND_COLLARS_KG);
    let previous = -1;
    for (let k = 0; k <= count; k += 1) {
      const px = sleevePixelsWithin(loaded, plateRevealPx(k, HEAVY_KG, BAR_AND_COLLARS_KG));
      expect(px, `step ${k} revealed no more sleeve than step ${k - 1}`).toBeGreaterThan(previous);
      previous = px;
    }
    expect(previous).toBe(sleevePixelsWithin(loaded, RESOLUTION.CELL_W));
    expect(previous).toBeGreaterThan(0);
  });

  it('draws a heavier bar with more sleeve on it than a lighter one', () => {
    // The non-vacuity control for everything above: if `totalKg` did not reach
    // the drawing at all, every frame in this file would be the same grid.
    const light = sleevePixelsWithin(frameFor(BAR_AND_COLLARS_KG), RESOLUTION.CELL_W);
    const heavy = sleevePixelsWithin(frameFor(HEAVY_KG), RESOLUTION.CELL_W);
    expect(heavy).toBeGreaterThan(light);
  });
});

describe('the bare bar and the loaded bar are one body', () => {
  /**
   * THE RESIDUE, MEASURED AND STATED RATHER THAN CLAIMED AWAY.
   *
   * `MeetHallView` draws the bare frame in full and the loaded frame over it
   * through a window, so any pixel the two disagree about OUTSIDE the sleeves is
   * a discontinuity at the window's edge while the bar loads.
   *
   * There are eleven, and they are all the same thing: `outlinePass` runs last
   * and only writes transparent pixels, so where a disc now sits, a pixel that
   * was the FIGURE's keyline in the bare frame is the disc's keyline in the
   * loaded one. Every one of them is within three columns of the shaft/sleeve
   * junction and inside the bar's own rows — which is where his hands are.
   *
   * WHAT IT LOOKS LIKE: at most a one-pixel edge beside each hand, for the half
   * second the bar is loading, gone the moment the window opens past them. Not
   * nothing, and not a seam down a man. Nobody has looked at it on a phone.
   *
   * Pinned by exact count so it cannot grow quietly.
   */
  const BODY_PIXELS_THE_TWO_BARS_DISAGREE_ABOUT = 11;

  it('differs from the loaded bar in eleven pixels, all beside the hands', () => {
    const bare = frameFor(BAR_AND_COLLARS_KG);
    const loaded = frameFor(HEAVY_KG);
    expect(bare.w).toBe(loaded.w);
    expect(bare.h).toBe(loaded.h);

    let differing = 0;
    const bodyDiffs: { x: number; y: number }[] = [];
    let barTop = bare.h;
    let barBottom = -1;
    for (let y = 0; y < bare.h; y += 1) {
      for (let x = 0; x < bare.w; x += 1) {
        const a = getPx(bare, x, y);
        const b = getPx(loaded, x, y);
        // Where the sleeves are, in rows, read off the LOADED bar's own discs
        // rather than assumed — this is the band the hands are in.
        if (!isTransparentIndex(b) && !isBodyIndex(b) && Math.abs(x - CENTER_X) > BAR.SHAFT_HALF_PX) {
          barTop = Math.min(barTop, y);
          barBottom = Math.max(barBottom, y);
        }
        if (a === b) continue;
        differing += 1;
        if (isBodyIndex(a) || isBodyIndex(b)) bodyDiffs.push({ x, y });
      }
    }

    // They really do differ, or every assertion below is empty.
    expect(differing).toBeGreaterThan(0);
    expect(barBottom).toBeGreaterThan(barTop);

    // THE RESIDUE. Exactly this many, and no more.
    expect(bodyDiffs.length, JSON.stringify(bodyDiffs)).toBe(
      BODY_PIXELS_THE_TWO_BARS_DISAGREE_ABOUT,
    );
    // ...and every one of them is at the shaft/sleeve junction, in the bar's own
    // rows. A disagreement anywhere ELSE on the figure — a differently-drawn
    // face, a shifted knee — would be a real seam and fails here even though the
    // count above might not move.
    for (const { x, y } of bodyDiffs) {
      const fromShaft = Math.abs(Math.abs(x - CENTER_X) - BAR.SHAFT_HALF_PX);
      expect(fromShaft, `body pixel at (${x},${y}) is not at the sleeve junction`).toBeLessThanOrEqual(
        BAR.PLATE_PITCH_PX,
      );
      expect(y, `body pixel at (${x},${y}) is not in the bar's rows`).toBeGreaterThanOrEqual(barTop);
      expect(y, `body pixel at (${x},${y}) is not in the bar's rows`).toBeLessThanOrEqual(barBottom);
    }
  });

  it('stands the lifter up rather than drawing him mid-rep', () => {
    // The walkout is the beat before the rep. `buildSquatRep`'s first frame is
    // the brace; a spec that had drifted into the descent would put a man at the
    // bottom of a squat on the screen that says WALK IT OUT.
    const spec = hallLifterFrame(LOAD, HEAVY_KG, BAR_AND_COLLARS_KG);
    expect(spec.direction).toBe('DESCENT');
    expect(spec.depth).toBeLessThan(LOAD_PRESETS.LIGHT);
    expect(spec.totalKg).toBe(HEAVY_KG);
    expect(spec.barKg).toBe(BAR_AND_COLLARS_KG);
  });
});
