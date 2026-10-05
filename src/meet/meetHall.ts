/**
 * meetHall.ts — the building meet day happens in, as plain data.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * `MEET_TUNING.VENUE` used to be read at exactly one site in the whole tree —
 * `AttemptView.tsx` — so the only beat of meet day that happened in a building
 * was the one where the player is pressing the screen and watching a cue ring.
 * The walk-out, the wait for the lights and the lights themselves — every beat
 * that is ABOUT dread, and the ones GDD §12.2 actually names — were flat React
 * Native text on near-black.
 *
 * This module is what the other beats stage themselves against. It answers
 * three questions and holds no state:
 *
 *   1. WHICH ROOM. `MEET_HALL_SCENE`, and it is `liftStageScene()` with the
 *      venue overridden — the SAME box, the same floor row, the same focus
 *      column and the same integer scale the attempt is drawn in. That is the
 *      point: a player must not teleport between two differently-proportioned
 *      halls twice per attempt.
 *   2. WHO IS IN IT. `hallLifterFrame`, a `LifterFrameSpec` for the lifter
 *      standing under the bar, built from `buildSquatRep`'s own first frame so
 *      the figure on the walkout is drawn by the same rig, at the same load, as
 *      the figure in the rep that follows it.
 *   3. HOW LOADED THE BAR IS. `plateRevealPx`, below.
 *
 * ---------------------------------------------------------------------------
 * THE BAR IS THE SPRITE'S BAR, AND THAT IS THE WHOLE POINT OF (3)
 * ---------------------------------------------------------------------------
 * The walk-out used to draw its own barbell: `Animated.View`s with
 * `backgroundColor`, `borderColor` and `borderRadius` — anti-aliased vector
 * rectangles — two seconds before the player squatted a chunky
 * nearest-neighbour bar with knurl rings and collars. Two art styles for one
 * object, on the highest-value screen in the game, and GDD §7.1 commits to a
 * fixed internal resolution and nearest-neighbour scaling THROUGHOUT.
 *
 * So the walkout's bar is now `renderLifterFrame`'s bar, and the loading beat is
 * a CLIP rather than a second drawing: the bare bar is drawn, and the loaded bar
 * is drawn over it clipped to a window that widens from the shaft outward. Since
 * `drawBarAndPlates` puts the heaviest disc inboard, widening the window lands
 * the plates in exactly the order a real loading crew works in — which is what
 * the old view was hand-animating.
 *
 * Two renders of the same pose differ ONLY in their sleeves (`renderLifterFrame`
 * reads `totalKg` for nothing but `visualPlateStack`), so there is no seam in
 * the body at the clip edge. `meetHall.test.ts` asserts that rather than
 * assuming it.
 *
 * PURE. Zero React, zero Skia, zero I/O. Every number comes from
 * `spriteTuning.ts`, `plates.ts` or `MEET_TUNING`; `meetTuning.test.ts` scans
 * this file for bare literals.
 */

import { liftStageScene, type GymSceneSpec } from '../art/gymScene';
import { frameSpecFrom, type LifterFrameSpec } from '../art/lifterSprite';
import { layoutSleeve, visualPlateStack } from '../art/plates';
import { BAR, RESOLUTION } from '../art/spriteTuning';
import { buildSquatRep, type SquatFrame } from '../art/squatAnimation';
import { MEET_TUNING } from '../game/meetTuning';

/**
 * The hall, as a scene spec.
 *
 * ONE BOX FOR EVERY BEAT. `liftStageScene()` is the box `LiftStage` draws the
 * rep in — 130 x 173 scene pixels at an integer scale of 3, with the sprite's
 * own lattice — and every staged beat uses it unchanged apart from the venue.
 * A second, taller box for the quiet screens would be a second camera, and the
 * player would walk into a different building between the walkout and the rep.
 */
export const MEET_HALL_SCENE: GymSceneSpec = Object.freeze({
  ...liftStageScene(),
  venue: MEET_TUNING.VENUE,
});

/**
 * The same hall with the seating `risePx` rows up.
 *
 * THE ONE THING ABOUT THE ROOM THAT MOVES, and it moves on exactly two moments:
 * an attempt the meet turns on, and a good lift (see `MEET_TUNING.CROWD`).
 * `risePx` of 0 returns `MEET_HALL_SCENE` itself — the identical object, not a
 * copy — so a beat that never brings the hall up cannot accidentally rasterise a
 * second room, and `renderGymScene(hallScene(0))` is byte-for-byte the room
 * every previous pass measured.
 */
export function hallScene(risePx: number): GymSceneSpec {
  if (risePx <= 0) return MEET_HALL_SCENE;
  return { ...MEET_HALL_SCENE, crowdRisePx: risePx };
}

/**
 * The brace — the drawing the walk-out settles onto and the rep begins from.
 *
 * `buildSquatRep`'s FIRST frame, taken from the canned rep rather than authored
 * here so the strain, tilt, bend and chalk of a man standing under a maximal bar
 * are the animation system's numbers and not a second set that could disagree
 * with them. `src/meet/walkout.ts` deforms AROUND this frame and returns to it
 * exactly, which is what makes the cut from the walk-out to the attempt a cut
 * inside one shot.
 */
export function hallBraceFrame(loadRatio: number): SquatFrame {
  const frame = buildSquatRep(loadRatio).frames[0];
  if (frame === undefined) {
    throw new RangeError('meetHall: the squat rep produced no frames to stand on.');
  }
  return frame;
}

/**
 * The lifter standing under a bar of `totalKg`, at `loadRatio` of his best.
 *
 * The settled pose, with no walk-out applied — what every beat AFTER the
 * walk-out draws.
 */
export function hallLifterFrame(
  loadRatio: number,
  totalKg: number,
  barAndCollarsKg: number,
): LifterFrameSpec {
  return frameSpecFrom(hallBraceFrame(loadRatio), totalKg, barAndCollarsKg);
}

/** How many discs go on ONE side of a bar of `totalKg`. */
export function hallPlateCount(totalKg: number, barAndCollarsKg: number): number {
  return layoutSleeve(visualPlateStack(totalKg, barAndCollarsKg)).slots.length;
}

/**
 * Half-width, in SPRITE pixels from the bar's centre, of the window that shows
 * exactly `loaded` discs per side.
 *
 * At 0 it is the bare knurled shaft. At each step it reaches the outboard face
 * of the next disc, so a disc lands whole or not at all. Once the stack is
 * complete it opens to the whole cell, which is what brings the collars in —
 * a collar goes on last on a real platform too.
 */
export function plateRevealPx(
  loaded: number,
  totalKg: number,
  barAndCollarsKg: number,
): number {
  const sleeve = layoutSleeve(visualPlateStack(totalKg, barAndCollarsKg));
  const count = sleeve.slots.length;
  const k = Math.max(0, Math.min(Math.floor(loaded), count));
  if (k >= count) return RESOLUTION.CELL_W;
  if (k === 0) return BAR.SHAFT_HALF_PX;
  const slot = sleeve.slots[k - 1];
  return slot === undefined ? BAR.SHAFT_HALF_PX : slot.dxInner + slot.facePx;
}
