/**
 * Rig — the authored drawings.
 *
 * A pose is a set of screen-space landmarks in the 96x72 cell, not a skeleton
 * with angles. Angles are the wrong abstraction at this scale: rotating a limb
 * by an arbitrary angle and re-rasterising produces the stair-stepped, slightly
 * melted look that separates procedural pixel art from drawn pixel art. Placing
 * the landmark and letting the limb rasteriser find the pixels between them
 * keeps every frame under direct control.
 *
 * VIEW: front-on. The lifter faces the camera, back squat, bar across the
 * traps. Chosen over a side view because
 *   - competition plate colour is only visible edge-on from the front, and
 *     GDD §7.1 calls that "free visual language";
 *   - bar whip (the sleeves bowing under load) is the single most immediate
 *     read of weight and only exists in this view;
 *   - knee valgus, the ugly cave-in of a grinding squat, is a frontal-plane
 *     fault and is invisible from the side.
 * The cost is real and is stated rather than hidden: sagittal bar drift — the
 * bar creeping over the toes — cannot be drawn as a horizontal offset here.
 * It is carried as data (`SquatFrame.barForwardPx`) and rendered indirectly
 * through the strain deltas. See `spriteTuning.ts` BAR_PATH.
 *
 * SYMMETRY: landmarks are authored as half-widths about CENTER_X, so the
 * geometry is mirror-symmetric by construction. That is right for a front-on
 * squat, but perfect symmetry is also a "generated" tell, so three asymmetries
 * are introduced deliberately: the key light is upper-LEFT (so the two sides
 * never shade alike), the head sits HEAD_DX off centre, and the grip is one
 * pixel wider on one side (GRIP_ASYMMETRY_PX).
 *
 * WHAT IS NOT HERE: no timing, no load response, no curve. Those are all in
 * `spriteTuning.ts`. The one borderline case is POSE_DEPTH_ANCHORS below — the
 * squat depth each drawing is drawn *at*. It lives with the drawings because
 * moving an anchor without redrawing the pose is meaningless; it is not a knob
 * that can be turned in isolation the way a tick count is.
 */

import {
  RESOLUTION,
  BAR,
  BRACE_SETTLE_DEPTH,
  DEFORM_FOLLOW,
  STRAIN,
  PITCH,
  CENTER_X,
  type PitchPoseDelta,
  type StrainPoseDelta,
} from './spriteTuning';

export type PoseKey =
  | 'STAND'
  | 'BRACE'
  | 'DESC_1'
  | 'DESC_2'
  | 'DESC_3'
  | 'HOLE'
  | 'ASC_DRIVE'
  | 'ASC_STICK'
  | 'ASC_RISE'
  | 'ASC_NEAR'
  | 'LOCKOUT';

export interface Pose {
  /** Centre of the head. */
  readonly headY: number;
  readonly headDx: number;
  readonly neckY: number;
  readonly shoulderY: number;
  readonly shoulderHalfW: number;
  /** Top of the singlet, where the straps meet the chest. */
  readonly chestY: number;
  readonly waistY: number;
  readonly waistHalfW: number;
  readonly hipY: number;
  readonly hipHalfW: number;
  readonly kneeY: number;
  readonly kneeHalfW: number;
  readonly ankleY: number;
  readonly ankleHalfW: number;
  readonly elbowY: number;
  readonly elbowHalfW: number;
  readonly handY: number;
  readonly handHalfW: number;
}

export const POSE_FIELDS = [
  'headY',
  'headDx',
  'neckY',
  'shoulderY',
  'shoulderHalfW',
  'chestY',
  'waistY',
  'waistHalfW',
  'hipY',
  'hipHalfW',
  'kneeY',
  'kneeHalfW',
  'ankleY',
  'ankleHalfW',
  'elbowY',
  'elbowHalfW',
  'handY',
  'handHalfW',
] as const satisfies readonly (keyof Pose)[];

/**
 * Body proportions, in sprite px, checked against a 1.75 m lifter at
 * PX_PER_METRE = 34.29 px/m:
 *   floor 68, crown 8            -> 60 px  = 1.75 m
 *   standing shoulder y 19       -> 1.43 m off the floor
 *   standing hip y 36            -> 0.93 m
 *   standing knee y 51           -> 0.50 m
 *   stance 17 px between ankles  -> 0.50 m, a normal competition squat stance
 *   grip 30 px between hands     -> 0.87 m, a normal squat grip
 *   bar drop, stand to hole      -> 15 px = 0.44 m
 * The bar-drop figure is the one that matters most: it is what the animation's
 * whole depth axis is measured in, and 0.44 m is a real squat's bar travel.
 */
export const POSES: Record<PoseKey, Pose> = {
  STAND: {
    headY: 12,
    headDx: 0.6,
    neckY: 17,
    shoulderY: 19,
    shoulderHalfW: 8.0,
    chestY: 23,
    waistY: 33,
    waistHalfW: 5.0,
    hipY: 36,
    hipHalfW: 5.6,
    kneeY: 51,
    kneeHalfW: 6.5,
    ankleY: 65,
    ankleHalfW: 8.5,
    elbowY: 28,
    elbowHalfW: 10.5,
    handY: 21,
    handHalfW: 15,
  },
  BRACE: {
    headY: 13,
    headDx: 0.6,
    neckY: 18,
    shoulderY: 20,
    shoulderHalfW: 8.3,
    chestY: 24,
    waistY: 34,
    waistHalfW: 5.1,
    hipY: 37,
    hipHalfW: 5.7,
    kneeY: 50.6,
    kneeHalfW: 6.9,
    ankleY: 65,
    ankleHalfW: 8.6,
    elbowY: 29,
    elbowHalfW: 10.7,
    handY: 22,
    handHalfW: 15,
  },
  DESC_1: {
    headY: 17.5,
    headDx: 0.6,
    neckY: 22,
    shoulderY: 24,
    shoulderHalfW: 8.2,
    chestY: 28,
    waistY: 38,
    waistHalfW: 5.2,
    hipY: 41.5,
    hipHalfW: 5.8,
    kneeY: 50.4,
    kneeHalfW: 8.4,
    ankleY: 65,
    ankleHalfW: 8.6,
    elbowY: 33,
    elbowHalfW: 10.9,
    handY: 26,
    handHalfW: 15,
  },
  DESC_2: {
    headY: 22,
    headDx: 0.5,
    neckY: 26.5,
    shoulderY: 28.5,
    shoulderHalfW: 8.4,
    chestY: 32.5,
    waistY: 42,
    waistHalfW: 5.5,
    hipY: 46,
    hipHalfW: 6.1,
    kneeY: 49.8,
    kneeHalfW: 10.0,
    ankleY: 65,
    ankleHalfW: 8.8,
    elbowY: 38,
    elbowHalfW: 11.2,
    handY: 30.5,
    handHalfW: 15,
  },
  DESC_3: {
    headY: 25.2,
    headDx: 0.4,
    neckY: 29.8,
    shoulderY: 31.8,
    shoulderHalfW: 8.5,
    chestY: 35.6,
    waistY: 45.4,
    waistHalfW: 5.8,
    hipY: 49.5,
    hipHalfW: 6.3,
    kneeY: 49.2,
    kneeHalfW: 11.3,
    ankleY: 65,
    ankleHalfW: 8.9,
    elbowY: 41.3,
    elbowHalfW: 11.4,
    handY: 33.8,
    handHalfW: 15,
  },
  HOLE: {
    headY: 27.4,
    headDx: 0.4,
    neckY: 32,
    shoulderY: 34,
    shoulderHalfW: 8.6,
    chestY: 37.6,
    waistY: 47.2,
    waistHalfW: 6.0,
    hipY: 51.5,
    hipHalfW: 6.0,
    kneeY: 49.0,
    kneeHalfW: 12.2,
    ankleY: 65,
    ankleHalfW: 8.6,
    elbowY: 43.5,
    elbowHalfW: 11.5,
    handY: 36,
    handHalfW: 15,
  },
  // --- ascent: the same depths look different coming up ---------------------
  ASC_DRIVE: {
    headY: 25.6,
    headDx: 0.3,
    neckY: 30.2,
    shoulderY: 32.4,
    shoulderHalfW: 8.7,
    chestY: 36,
    waistY: 44.6,
    waistHalfW: 6.0,
    hipY: 48.6,
    hipHalfW: 6.0,
    kneeY: 49.1,
    kneeHalfW: 11.8,
    ankleY: 65,
    ankleHalfW: 8.6,
    elbowY: 42,
    elbowHalfW: 11.4,
    handY: 34.4,
    handHalfW: 15,
  },
  ASC_STICK: {
    headY: 21.4,
    headDx: 0.3,
    neckY: 26.4,
    shoulderY: 28.7,
    shoulderHalfW: 8.8,
    chestY: 32.4,
    waistY: 40.2,
    waistHalfW: 5.9,
    hipY: 43.6,
    hipHalfW: 6.3,
    kneeY: 49.4,
    kneeHalfW: 10.6,
    ankleY: 65,
    ankleHalfW: 8.6,
    elbowY: 38.2,
    elbowHalfW: 11.1,
    handY: 30.7,
    handHalfW: 15,
  },
  ASC_RISE: {
    headY: 17.9,
    headDx: 0.4,
    neckY: 22.6,
    shoulderY: 24.6,
    shoulderHalfW: 8.5,
    chestY: 28.6,
    waistY: 37.6,
    waistHalfW: 5.5,
    hipY: 40.4,
    hipHalfW: 6.0,
    kneeY: 50.2,
    kneeHalfW: 8.8,
    ankleY: 65,
    ankleHalfW: 8.8,
    elbowY: 34,
    elbowHalfW: 10.9,
    handY: 26.8,
    handHalfW: 15,
  },
  ASC_NEAR: {
    headY: 14.4,
    headDx: 0.5,
    neckY: 19.2,
    shoulderY: 21.2,
    shoulderHalfW: 8.2,
    chestY: 25.2,
    waistY: 35,
    waistHalfW: 5.2,
    hipY: 37.6,
    hipHalfW: 5.8,
    kneeY: 50.8,
    kneeHalfW: 7.4,
    ankleY: 65,
    ankleHalfW: 8.6,
    elbowY: 30.4,
    elbowHalfW: 10.6,
    handY: 23.2,
    handHalfW: 15,
  },
  LOCKOUT: {
    headY: 11.8,
    headDx: 0.7,
    neckY: 16.8,
    shoulderY: 19,
    shoulderHalfW: 8.1,
    chestY: 22.8,
    waistY: 33,
    waistHalfW: 4.9,
    hipY: 36,
    hipHalfW: 5.6,
    kneeY: 51,
    kneeHalfW: 6.4,
    ankleY: 65,
    ankleHalfW: 8.5,
    elbowY: 27.6,
    elbowHalfW: 10.4,
    handY: 20.6,
    handHalfW: 15,
  },
};

export type RepDirection = 'DESCENT' | 'ASCENT';

export interface PoseAnchor {
  readonly key: PoseKey;
  /** Squat depth this drawing is drawn at. 0 standing, 1 bottom of the hole. */
  readonly depth: number;
}

/**
 * Squat depth each drawing is drawn at, ascending.
 *
 * Descent and ascent are separate ladders on purpose — a lifter halfway down
 * and a lifter halfway up do not look alike, and reusing the descent frames on
 * the way up is the cheapest and most obvious animation shortcut there is.
 */
export const POSE_DEPTH_ANCHORS: Readonly<Record<RepDirection, readonly PoseAnchor[]>> = {
  DESCENT: [
    { key: 'STAND', depth: 0 },
    // Reads the same constant the brace phase settles to; see spriteTuning.
    { key: 'BRACE', depth: BRACE_SETTLE_DEPTH },
    { key: 'DESC_1', depth: 0.33 },
    { key: 'DESC_2', depth: 0.62 },
    { key: 'DESC_3', depth: 0.86 },
    { key: 'HOLE', depth: 1 },
  ],
  ASCENT: [
    { key: 'LOCKOUT', depth: 0 },
    { key: 'ASC_NEAR', depth: 0.15 },
    { key: 'ASC_RISE', depth: 0.38 },
    { key: 'ASC_STICK', depth: 0.66 },
    { key: 'ASC_DRIVE', depth: 0.88 },
    { key: 'HOLE', depth: 1 },
  ],
};

/**
 * Limb thicknesses, part sizes and attachment fractions. Sprite px unless the
 * name says otherwise; fractions are of the pose landmark they scale.
 *
 * Everything the composer draws comes from here. That is the point: an
 * attachment fraction typed inline in `lifterSprite.ts` would be a magic number
 * in a component, and the one thing this project is strict about is that
 * hand-tuned values live in named constants (CLAUDE.md). These are drawing
 * values rather than feel values, so they sit with the drawings rather than in
 * `spriteTuning.ts` — but they are named, and they are all in one block.
 *
 * AND THAT EXCLUSION IS NARROWER THAN IT WAS BEING USED. It covers sizes and
 * positions: a radius or an attachment fraction cannot be moved without
 * redrawing the mass it names. It does NOT cover shading — three ramp-step
 * biases (head, belt, knee sleeve) used to sit in this block, and a ramp-step
 * bias moves no geometry, turns on its own, and is the same kind of number as
 * `SHADING.FAR_LIMB_LIGHT_SCALE`. They now live with the rest of them, in
 * `SHADING`.
 */
export const RIG_GEOMETRY = {
  HEAD_RX: 3.6,
  HEAD_RY: 4.4,
  HAIR_RY: 2.2,
  // Eye, mouth and fringe positions are NOT here. They are hand-placed pixels
  // in `spriteMarks.ts`, because that is what they are — a value here would be
  // an offset fed to a shape function, and the face is not a shape function.
  NECK_R: 2.3,
  NECK_OVERLAP: 1,

  /**
   * Upper arm: shoulder attach -> biceps belly -> elbow. THREE radii, for
   * exactly the reason `FOREARM_R` below has three, applied to the segment above
   * it.
   *
   * WAS [2.7, 2.1], a cone, and it was left a cone in the round that bellied the
   * forearm. That round's own argument condemns it: `spriteMarks.ts` stamps a
   * BICEPS mark at `BICEPS_BELLY_ALONG`, and its comment says "the belly of the
   * biceps sits in the upper third of the upper arm" — on a mass that tapered
   * monotonically from shoulder to elbow and had no belly anywhere. Same defect,
   * same sentence, one segment up: the mark was drawing a shape the geometry did
   * not have.
   *
   * AND THE CONE HAD INVERTED THE ARM'S MODELLED PROPORTION. Every figure in
   * this table is OURS, computed from these radii by the convention this file
   * already uses — drawn width = 2 x (radius + the one px of contour):
   *
   *              before   after
   *   shoulder     7.4     7.4    (attachment; it sits under the deltoid disc,
   *                                and `limbWindows` clips it out entirely)
   *   biceps       6.9     8.0    <- the modelled peak of the arm, now
   *   elbow        6.2     6.2
   *   forearm      7.6     7.6
   *   wrist        5.8     5.8
   *
   * Before, the widest mass anywhere on the bare arm was the FOREARM belly, 7.6
   * against 6.9 of upper arm at the very fraction `spriteMarks.ts` stamps a
   * biceps on. In `sprite-ref-1` the upper arm is plainly the dominant mass of
   * the arm — that is an eye judgement off the decoded crop, not a measured
   * figure, and no committed metric measures per-bone width on the reference, so
   * it is stated as what it is. Belly to belly, ours is now 8.0 upper against
   * 7.6 forearm.
   *
   * BELLY-TO-BELLY IS THE RIGHT COMPARISON, and the old ceiling argument on
   * `FOREARM_R` below was not. It read the forearm's 7.6 against the upper arm's
   * 7.4 AT THE SHOULDER — an attachment radius on a bone with no modelled belly,
   * i.e. a proportion ceiling measured off the shape defect this constant fixes.
   * That paragraph is rewritten below and both radii are now swept together.
   *
   * 3.0 IS ONE NOTCH PAST THE FOREARM ON THE 0.2 PX GRID BOTH ARE SWEPT ON, AND
   * IT IS NOT THE VALUE THE FLOOR-SHARE METRIC PREFERS. Said plainly because the
   * two answers disagree and the metric's answer is an artefact. Swept jointly
   * with `FOREARM_R[1]` — 6 x 6 grid, 0.2 px steps, all 448 frames at each point
   * — the far arm's mean clearance under the reference bound peaks in the
   * forearm axis at 2.8 for EVERY biceps radius, but in the biceps axis it is
   * flat to 3.2 and then climbs without turning: 4.58, 4.46, 4.52, 4.42, 4.51,
   * 5.05, 5.29, 5.71, 5.68 as the biceps goes 2.45 (the old cone's interpolated
   * value at this fraction), 2.6, 2.8, 3.0, 3.2, 3.4, 3.6, 3.8, 4.0. All ours,
   * measured. The full grid is in `lifterSprite.test.ts`'s KNOWN GAP comment.
   *
   * WHY THAT CLIMB IS NOT A REASON TO GO WIDER, measured rather than argued.
   * Every figure in this paragraph is OURS, off our own rendered frames. At this
   * fraction the biceps is not on the silhouette at all: at BRACE and in the
   * HOLE the outermost skin pixel of every row from the shoulder to the elbow is
   * IDENTICAL, row for row, at every biceps radius from 2.448 to 4.0, because
   * the lifter's hands are wider than his elbows and the FOREARM is the outboard
   * mass in that band at every pose this rig draws. What the extra width does
   * instead is paint over the singlet: at those two poses the drawn singlet goes
   * 141 -> 125 px and 98 -> 76 px across that same range, and the strap on the
   * far shoulder disappears entirely past about 3.6. So the metric improves
   * because the arm window catches skin pixels that used to be singlet, not
   * because the arm got bigger. Buying floor share by burying the singlet is the
   * same trade the forearm declined one constant down, and it is declined here
   * for the same reason.
   *
   * THE ELBOW STAYS 2.1 AND MUST. It is `FOREARM_R[0]` exactly, so the two
   * capsules meet at the same width and the joint is a break in shading rather
   * than a step in the silhouette. Raising it fattens the one part of the arm
   * that should be the narrowest thing between two bellies.
   */
  UPPER_ARM_R: [2.7, 3.0, 2.1] as const,
  /**
   * Where the biceps belly sits, shoulder (0) to elbow (1).
   *
   * ONE NUMBER FOR THE MASS AND THE MARK, the same move `FOREARM_BELLY_ALONG`
   * made. `spriteMarks.ts` used to carry its own `BICEPS_TOWARD_ELBOW` at this
   * value; now that the mass has a belly, the fraction names a place ON the
   * mass, and a belly mark that can slide off the belly it is naming is the
   * defect `singletHemY` was extracted to prevent.
   *
   * Proximal on purpose, and that reason is unchanged from the mark table: past
   * halfway the near forearm crosses in front of the upper arm at squat depth
   * and there is no upper arm left to paint on. It also lands just under the
   * deltoid disc, which reaches `NUDGE.DELTOID_DROP + ATTACH.DELTOID_R` = 3.1
   * rows below the shoulder line on a shoulder-to-elbow run of about 9 rows —
   * i.e. f = 0.34 — so 0.42 is the first bare row of upper arm below it. Ours,
   * read off the drawn rig.
   *
   * WHAT THAT COSTS, AND IT IS NOT NOTHING. Ours, measured on the drawn rig: at
   * 0.42 the belly sits about 8.2 px from centre while
   * `CRAFT.LIMB_TORSO_CLEARANCE_PX` puts the arm measurement window's inner edge
   * at 9.5-10.0 — so the belly is CLIPPED OUT OF THE WINDOW at every pose, and
   * `UPPER_ARM_R[1]` reaches the floor-share number only through the
   * belly->elbow capsule's taper. Moving this fraction
   * outboard would put the belly in the window and on the silhouette, but it
   * moves the biceps MARK with it — that is the whole point of the constant —
   * and the mark's own constraint above is what stops it. Left as a knob rather
   * than resolved.
   */
  BICEPS_BELLY_ALONG: 0.42,
  /**
   * Forearm: elbow -> belly -> wrist. THREE radii, not two, and the middle one
   * is the whole point.
   *
   * WAS [2.0, 1.7], a cone. That is not what a forearm is and the mark table
   * already said so — `spriteMarks.ts` carries a hand-placed FOREARM_BELLY mark
   * whose comment reads "the reference wrestlers' forearms are not tapered
   * tubes: there is a mass just below the elbow, a step down out of it, and then
   * the wrist". The mass under that mark was a cone; the mark was drawing a
   * shape the geometry did not have.
   *
   * IT IS ALSO WHAT THE FAR ARM'S RAMP OCCUPANCY TURNS ON, measured. The
   * contour is one pixel down each flank and is the ramp's darkest entry by
   * construction (`SHADING.EDGE_STEP_DROP`), so a limb's floor share is
   * essentially its perimeter over its area and the thinnest mass on the figure
   * pays the most. At [2.0, 1.7] the drawn forearm was six pixels across with
   * two of them contour, and over the 448-frame sweep the far arm's window ran
   * 37.1% floor with a mean clearance of 0.7 points under the bound
   * `lifterSprite.test.ts` measures off the reference. At [2.1, 2.8, 1.9] it
   * runs 31.1% with 4.4 points of clearance (it was 4.6 before `UPPER_ARM_R`
   * grew a belly; the arm is measured in ONE window, so the two constants share
   * a number). Both figures are OURS, measured on our own frames; what the bound
   * is, is the reference's business and is computed there.
   *
   * 2.8 IS A MEASURED PEAK, NOT A ROUND NUMBER, and it is not the widest that
   * scores well. Widening the belly raises the window's pixel count, and
   * `neighbourhoodProfile` makes the bound STRICTER as the window grows — the
   * reference's worst patch of a given size shrinks with the size. Past 2.8 the
   * extra pixels cost more bound than they buy margin. All ours, measured.
   *
   * THAT PEAK IS NOW A 2-D ONE, and it was a 1-D slice when it was written. The
   * original sweep held `UPPER_ARM_R` fixed and moved this radius alone, which
   * is a line through a space with at least two axes in it; the claim "past 2.8
   * the extra pixels cost more bound than they buy" was true only along that
   * line. Re-swept jointly, 6 x 6 at 0.2 px steps on both axes over all 448
   * frames, the far arm's mean clearance still peaks at forearm 2.8 in EVERY one
   * of the nine biceps rows tried (2.45 through 4.0) — so the turn is real and
   * it is not an artefact of the fixed upper arm. The grid is printed in
   * `lifterSprite.test.ts`'s KNOWN GAP comment. The violation COUNT keeps
   * drifting either way at that scale, because it is a threshold crossing on a
   * quantised drawing and a fifth of a pixel flips whole poses across it. The
   * clearance is the quantity, and it turns here.
   *
   * AND 2.8 IS ALSO WHERE THE PROPORTION RUNS OUT — RESTATED BELLY TO BELLY,
   * WHICH IS NOT WHAT THIS PARAGRAPH USED TO SAY. It used to read the forearm's
   * drawn 7.6 against the UPPER ARM AT THE SHOULDER, 7.4: an attachment radius,
   * on a bone that was then a cone with no modelled belly at all. That is a
   * ceiling measured off a shape defect, and the defect is fixed one constant
   * up. The comparison that means something is belly against belly: 7.6 forearm
   * against `UPPER_ARM_R`'s 8.0 biceps. One notch under the upper arm is a
   * forearm; level with it or over it is a forearm thicker than the arm it hangs
   * off, and rendered frames at 3.4 close the negative space between the forearm
   * and the ribs that is most of what reads as "a man holding a bar". Both
   * figures ours.
   *
   * THE WRIST IS THE NARROWEST POINT AND MUST STAY THAT WAY. 1.9 is the hand's
   * own radius (`HAND_R`), so the capsule disappears into the fist instead of
   * standing proud of it. Raising it to 2.2 measurably flatters the floor-share
   * number and draws a forearm thicker than the hand on the end of it, which is
   * not a trade this file makes.
   */
  FOREARM_R: [2.1, 2.8, 1.9] as const,
  /**
   * Where the forearm's belly sits, elbow (0) to hand (1).
   *
   * ONE NUMBER FOR THE MASS AND THE MARK. `spriteMarks.ts` used to carry its own
   * `FOREARM_TOWARD_HAND` at the same value; a belly mark and a belly that
   * disagree about where the belly is is trim floating off the muscle, which is
   * the defect `singletHemY` exists to prevent one mass further down.
   */
  FOREARM_BELLY_ALONG: 0.42,
  HAND_R: 1.9,
  THIGH_R: [4.3, 3.1] as const,
  /**
   * Calf below the knee, tapering to the ankle.
   *
   * Was [2.9, 1.9], which made the bare shin a 4-6px waist between a 6.4px knee
   * sleeve and a 9px shoe — the one stretch of flesh that is bare at EVERY
   * depth was the narrowest thing on the leg, so the lower body read as two
   * dark blocks with a gap. A squatter's gastroc at the sleeve hem is close to
   * knee width (meet-photo-ref-1), and sprite-ref-1's calf is as wide as its
   * boot. This still tapers hard into the ankle, which is what stops it
   * reading as a stovepipe.
   */
  SHIN_R: [3.4, 2.1] as const,

  FOOT_W: 9,
  /**
   * Drawn shoe height, in rows. The shoe runs from `ankleY + FOOT_DROP` down to
   * the row above the floor, so with FOOT_DROP at 0 and the ankle landmark at
   * 65 against FLOOR_Y 68 this is three rows — which is the minimum a shoe
   * needs to carry a dark upper, a lace and a pale sole as separate marks. At
   * the two rows it had before, a sole line and an upper were the same pixel.
   * `lifterSprite.test.ts` asserts the drawn height matches this number.
   */
  FOOT_H: 3,
  FOOT_DROP: 0,
  FOOT_FLARE: 0.5,

  /**
   * How much a part drawn with an interior edge ring grows by, in px.
   *
   * `PartOptions.edge` stamps the ring OUTSIDE the shape, so a part whose
   * extent has to land on an exact row — the shoe, whose sole must sit on the
   * platform's top row and not over it — subtracts this from both ends. It was
   * invisible while the ring was near-black and read as outline; now the ring is
   * the material's own shadow step it is part of the drawn object, and a shoe
   * that quietly grew a row would have covered the pale floor its sole is
   * supposed to read against.
   */
  EDGE_INSET_PX: 1,

  /** Belt height, centred on waistY, and how far it stands off the waist. */
  BELT_H: 3,
  BELT_OVERHANG: 1.1,

  /**
   * Knee sleeve: fractions along thigh and shin, plus its radii.
   *
   * SHORTER AND NARROWER THAN IT WAS ([0.26, 0.24], R [3.2, 2.9]). A 7 mm
   * sleeve on a real lifter covers the joint and a hand's width either side of
   * it — meet-photo-ref-1 has a clear band of bare quad above the sleeve and
   * bare calf below it even at the bottom of the squat. Ours reached a quarter
   * of the way up the thigh from both ends and was WIDER than the shin it sat
   * on, so from about half depth the sleeve met the singlet hem and the whole
   * leg was kit. Pulling both fractions in and taking the radii under the new
   * SHIN_R puts flesh back on both sides of the joint at every depth.
   *
   * These four numbers decide how much bare leg the figure has and will be
   * moved by hand; they are the lower-body counterpart of the arm's break
   * positions.
   *
   * The sleeve's ramp-step bias is NOT here — it is
   * `SHADING.KNEE_SLEEVE_STEP_BIAS`, with `HEAD_STEP_BIAS` and `BELT_STEP_BIAS`
   * beside it. All three used to sit in this block; a shading bias is a knob
   * that turns on its own and belongs in the tuning file, which is what the
   * other five ramp-step biases already do.
   */
  KNEE_SLEEVE: {
    TOWARD_HIP: 0.19,
    TOWARD_ANKLE: 0.17,
    R: [3.0, 2.6] as const,
  },

  /** Attachment fractions of the matching pose half-widths. */
  ATTACH: {
    THIGH_ROOT: 0.8,
    ARM_ROOT: 0.82,
    DELTOID: 0.8,
    DELTOID_R: 2.6,
    TRAP_HALF_W: 0.95,
    /** How far above the shoulder line the trap mass starts. */
    TRAP_RISE: 2.5,
    STRAP_TOP: 0.5,
    STRAP_BOTTOM: 0.42,
    STRAP_R: [1.5, 1.7] as const,
    /**
     * Singlet hem, as a fraction ALONG the thigh from hip toward knee — not, as
     * it was, a fixed number of rows below the hip landmark.
     *
     * A fixed drop is only right while the hip is the highest point of the
     * thigh. At the bottom of a squat the hip is BELOW the knee, so `hipY + 3`
     * put the hem four rows below the kneecap: the singlet grew a trouser leg
     * exactly when the lifter needed to show his quad. A fraction of the
     * hip->knee segment stays on the thigh at every depth and shortens the
     * drawn hem as the thigh foreshortens, which is what a leg opening does.
     *
     * DEPTH HONESTY IS PRESERVED, and deliberately so: at full depth the thigh
     * has about two rows of vertical extent, so the hem and the sleeve still
     * close over it and the quad marks still have nothing to paint on. That is
     * a fact about a squat seen from the front, not a bug — see the coverage
     * floor in `spriteMarks.test.ts`.
     */
    SINGLET_HEM_ALONG_THIGH: 0.2,
  },

  /** Inner-leg seam extent, relative to the hip/knee and ankle landmarks. */
  SEAM: { TOP_OFFSET: 1, BOTTOM_OFFSET: 4 },

  /**
   * Sub-pixel nudges. Each is a fraction of a pixel that decides whether a
   * feature lands on one row or the next, which at 96x72 is the difference
   * between a shoulder and a lump. They are named for the same reason the
   * timings are: they will be moved by hand and nobody should have to find them
   * inside a draw call.
   */
  NUDGE: {
    /** Deltoid centre, below the shoulder line. */
    DELTOID_DROP: 0.5,
    /** Singlet hem flare past the hip half-width. */
    SINGLET_FLARE: 0.8,
    /** Strap top, above the shoulder line. */
    STRAP_LIFT: 1,
    /** Hand is drawn slightly taller than wide: fingers over the bar. */
    HAND_TALL: 0.4,
    /** Neck widens into the traps. */
    NECK_FLARE: 0.6,
  },

  /** One hand grips this much wider than the other. */
  GRIP_ASYMMETRY_PX: 1,
} as const;

/** Bar centre-line for a pose: it rides the traps, so it tracks the shoulders. */
export function barYForPose(pose: Pose): number {
  return pose.shoulderY - BAR.SHOULDER_OFFSET_PX;
}

/**
 * Bottom row of the singlet's leg opening, on the thigh axis.
 *
 * One function rather than the same expression in the composer and in the mark
 * table: they used to hold `pose.hipY + ATTACH.SINGLET_HEM` independently, and
 * a hem that the drawing and the mark anchor disagree about is trim floating
 * off the cloth.
 */
export function singletHemY(pose: Pose): number {
  return pose.hipY + (pose.kneeY - pose.hipY) * RIG_GEOMETRY.ATTACH.SINGLET_HEM_ALONG_THIGH;
}

/** Hip and knee ends of the femur as drawn, for one side of the body. */
export function femurSpan(
  pose: Pose,
  sign: number,
): { readonly hipX: number; readonly hipY: number; readonly kneeX: number; readonly kneeY: number } {
  return {
    hipX: CENTER_X + sign * pose.hipHalfW * RIG_GEOMETRY.ATTACH.THIGH_ROOT,
    hipY: pose.hipY,
    kneeX: CENTER_X + sign * pose.kneeHalfW,
    kneeY: pose.kneeY,
  };
}

/** Drawn hip-to-knee distance, in sprite px. */
export function femurDrawnLenPx(pose: Pose, sign: number): number {
  const f = femurSpan(pose, sign);
  return Math.hypot(f.kneeX - f.hipX, f.kneeY - f.hipY);
}

/**
 * The femur at zero out-of-plane rotation: its hip-to-knee distance in the
 * STAND drawing, where a front-on lifter's thigh lies in the frontal plane.
 *
 * DERIVED, NOT DECLARED. A hand-typed 15.1 here would silently become a lie the
 * first time somebody moved STAND's hip or knee, and the shading that reads it
 * would start claiming a standing lifter's thigh is foreshortened.
 */
export const FEMUR_FRONTAL_LEN_PX: number = femurDrawnLenPx(POSES.STAND, -1);

/**
 * How far out of the screen plane the femur has rotated in this pose, 0..1.
 *
 * This rig is a front view and it has no z. What it has instead is honest
 * foreshortening: hip-to-knee is drawn at FEMUR_FRONTAL_LEN_PX standing and
 * collapses to a couple of pixels in the hole, because a squatting lifter's
 * knee travels forward, at the camera. A bone is rigid, so the drawn length IS
 * the cosine of the angle it has swung through and this is just
 * `sqrt(1 - cos^2)` — trigonometry, with nothing tuneable in it.
 *
 * Clamped at 1: the strain deformation stretches the standing thigh past its
 * STAND length, and a bone longer than itself is not tilted the other way.
 *
 * `drawLimb` uses this to stop shading a thigh that is pointing at the viewer as
 * though it were lying sideways. See `SHADING.FORESHORTEN` for what went wrong
 * without it and `PartOptions.outOfPlane` for how it is applied.
 */
export function femurTilt(pose: Pose, sign: number): number {
  const cos = Math.min(1, Math.max(0, femurDrawnLenPx(pose, sign) / FEMUR_FRONTAL_LEN_PX));
  return Math.sqrt(Math.max(0, 1 - cos * cos));
}

/** Elbow, hand and grip x for one arm — the endpoints the arm is drawn between. */
export function armSpan(
  pose: Pose,
  sign: number,
): {
  readonly shoulderX: number;
  readonly elbowX: number;
  readonly handX: number;
} {
  return {
    shoulderX: CENTER_X + sign * pose.shoulderHalfW * RIG_GEOMETRY.ATTACH.ARM_ROOT,
    elbowX: CENTER_X + sign * pose.elbowHalfW,
    handX:
      CENTER_X + sign * (pose.handHalfW + (sign > 0 ? RIG_GEOMETRY.GRIP_ASYMMETRY_PX : 0)),
  };
}

/**
 * The upper arm's three points: shoulder attach, biceps belly, elbow.
 *
 * Same contract as `forearmSpan` below and for the same reason: the composer
 * draws the mass between these points, `craftMetrics.limbWindows` measures the
 * mass between these points, and `spriteMarks.ts` anchors the BICEPS mark to the
 * middle one. Three copies of the arithmetic is three chances for the measured
 * window, the drawn mass and the authored mark to drift apart.
 */
export function upperArmSpan(
  pose: Pose,
  sign: number,
): {
  readonly shoulderX: number;
  readonly shoulderY: number;
  readonly bellyX: number;
  readonly bellyY: number;
  readonly elbowX: number;
  readonly elbowY: number;
} {
  const { shoulderX, elbowX } = armSpan(pose, sign);
  const f = RIG_GEOMETRY.BICEPS_BELLY_ALONG;
  return {
    shoulderX,
    shoulderY: pose.shoulderY,
    bellyX: shoulderX + (elbowX - shoulderX) * f,
    bellyY: pose.shoulderY + (pose.elbowY - pose.shoulderY) * f,
    elbowX,
    elbowY: pose.elbowY,
  };
}

/**
 * The forearm's three points: elbow, belly, wrist.
 *
 * ONE FUNCTION, for the same reason `singletHemY` is one function. The composer
 * draws the mass between these points, `craftMetrics.limbWindows` measures the
 * mass between these points, and `spriteMarks.ts` anchors the forearm belly mark
 * to the middle one. Three copies of the arithmetic is three chances for the
 * measured window, the drawn mass and the authored mark to drift apart, and a
 * limb check aimed at empty space is the shape of defect this area keeps
 * producing.
 */
export function forearmSpan(
  pose: Pose,
  sign: number,
): {
  readonly elbowX: number;
  readonly elbowY: number;
  readonly bellyX: number;
  readonly bellyY: number;
  readonly handX: number;
  readonly handY: number;
} {
  const { elbowX, handX } = armSpan(pose, sign);
  const f = RIG_GEOMETRY.FOREARM_BELLY_ALONG;
  return {
    elbowX,
    elbowY: pose.elbowY,
    bellyX: elbowX + (handX - elbowX) * f,
    bellyY: pose.elbowY + (pose.handY - pose.elbowY) * f,
    handX,
    handY: pose.handY,
  };
}

/** Top and bottom of the knee sleeve on the leg axis, as (x, y) pairs. */
export function kneeSleeveSpan(
  pose: Pose,
  sign: number,
): { readonly topX: number; readonly topY: number; readonly botX: number; readonly botY: number } {
  const KS = RIG_GEOMETRY.KNEE_SLEEVE;
  const hipX = CENTER_X + sign * pose.hipHalfW * RIG_GEOMETRY.ATTACH.THIGH_ROOT;
  const kneeX = CENTER_X + sign * pose.kneeHalfW;
  const ankleX = CENTER_X + sign * pose.ankleHalfW;
  return {
    topX: kneeX + (hipX - kneeX) * KS.TOWARD_HIP,
    topY: pose.kneeY + (pose.hipY - pose.kneeY) * KS.TOWARD_HIP,
    botX: kneeX + (ankleX - kneeX) * KS.TOWARD_ANKLE,
    botY: pose.kneeY + (pose.ankleY - pose.kneeY) * KS.TOWARD_ANKLE,
  };
}

/** Standing and bottom bar heights, derived from the drawings, not declared. */
export const BAR_Y_STAND = barYForPose(POSES.STAND);
export const BAR_Y_HOLE = barYForPose(POSES.HOLE);

/** Bar centre-line at a normalised depth, by the same linear map the poses use. */
export function barYAtDepth(depth: number): number {
  return BAR_Y_STAND + (BAR_Y_HOLE - BAR_Y_STAND) * depth;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function blendPose(a: Pose, b: Pose, t: number): Pose {
  const out: Record<string, number> = {};
  for (const field of POSE_FIELDS) {
    out[field] = lerp(a[field], b[field], t);
  }
  return out as unknown as Pose;
}

/**
 * The drawing for a given depth, blended between the two nearest anchors on the
 * relevant ladder. Blending at authoring time produces a concrete frame; it is
 * not a runtime tween. The animation quantises before it gets here.
 */
export function poseAtDepth(depth: number, direction: RepDirection): Pose {
  const ladder = POSE_DEPTH_ANCHORS[direction];
  const d = Math.min(1, Math.max(0, depth));

  // Ladders are authored ascending in depth for DESCENT and ASCENT alike.
  let lo = ladder[0];
  let hi = ladder[ladder.length - 1];
  if (lo === undefined || hi === undefined) throw new Error('empty pose ladder');

  for (let i = 0; i < ladder.length - 1; i += 1) {
    const a = ladder[i];
    const b = ladder[i + 1];
    if (a === undefined || b === undefined) continue;
    if (d >= a.depth && d <= b.depth) {
      lo = a;
      hi = b;
      break;
    }
  }

  const span = hi.depth - lo.depth;
  const t = span <= 0 ? 0 : (d - lo.depth) / span;
  return blendPose(POSES[lo.key], POSES[hi.key], t);
}

// ---------------------------------------------------------------------------
// Deformation: how load changes the drawing
// ---------------------------------------------------------------------------
//
// Two channels, quantised separately, composed once:
//
//   STRAIN — how hard this rep is. Authored per level in spriteTuning; the
//            renderer only ever asks for a level, so each level is a drawing.
//   PITCH  — the body's share of the sagittal forward bar drift, which the
//            front view cannot show directly. Its own channel because strain
//            saturates on exactly the rep where the drift is largest.
//
// Both obey the same hard rule: NEITHER MAY MOVE THE SHOULDER LINE. The bar
// rides the shoulders, so any deformation that moved them would let a strained
// frame misreport squat depth. `shoulderY` does not appear on the left of an
// assignment anywhere below, and a test asserts the bar's y is identical across
// all strain and pitch levels.

/** Blend between the two authored entries a continuous 0..1 position falls in. */
function levelBlend<T, R>(
  table: readonly T[],
  t01: number,
  lerpFn: (a: T, b: T, f: number) => R,
): R {
  const last = table.length - 1;
  if (last <= 0) {
    const only = table[0];
    if (only === undefined) throw new Error('empty level table');
    return lerpFn(only, only, 0);
  }
  const pos = Math.min(1, Math.max(0, t01)) * last;
  const lo = Math.min(last, Math.floor(pos));
  const hi = Math.min(last, lo + 1);
  const a = table[lo];
  const b = table[hi];
  if (a === undefined || b === undefined) throw new Error('ragged level table');
  return lerpFn(a, b, pos - lo);
}

/**
 * Authored strain deformation at a continuous strain value.
 *
 * Exact on the authored levels — `strainForLevel` lands on them by
 * construction, and the renderer only ever passes those — and interpolated in
 * between so a caller sweeping strain does not see steps that the sheet does
 * not have.
 */
export function strainDeltaAt(strain: number): StrainPoseDelta {
  return levelBlend(STRAIN.LEVEL_DELTAS, strain, (a, b, f) => ({
    HIP_SHOOT: lerp(a.HIP_SHOOT, b.HIP_SHOOT, f),
    HEAD_CRANE: lerp(a.HEAD_CRANE, b.HEAD_CRANE, f),
    SHOULDER_SHRUG: lerp(a.SHOULDER_SHRUG, b.SHOULDER_SHRUG, f),
    KNEE_VALGUS: lerp(a.KNEE_VALGUS, b.KNEE_VALGUS, f),
    ELBOW_TUCK: lerp(a.ELBOW_TUCK, b.ELBOW_TUCK, f),
    STANCE_SPREAD: lerp(a.STANCE_SPREAD, b.STANCE_SPREAD, f),
    CHEST_COLLAPSE: lerp(a.CHEST_COLLAPSE, b.CHEST_COLLAPSE, f),
  }));
}

/** Authored pitch deformation at a continuous pitch value. */
export function pitchDeltaAt(pitch: number): PitchPoseDelta {
  return levelBlend(PITCH.LEVEL_DELTAS, pitch, (a, b, f) => ({
    HIP_RISE: lerp(a.HIP_RISE, b.HIP_RISE, f),
    CHEST_DROP: lerp(a.CHEST_DROP, b.CHEST_DROP, f),
    TORSO_NARROW: lerp(a.TORSO_NARROW, b.TORSO_NARROW, f),
    HEAD_CRANE: lerp(a.HEAD_CRANE, b.HEAD_CRANE, f),
  }));
}

/**
 * Deform a pose by strain and pitch, both 0..1.
 *
 * This is what makes a maximal attempt look different in a *still* frame, with
 * timing stripped out: hips shoot ahead of the shoulders, knees cave, traps
 * bunch, the head cranes and the neck stretches, the elbows drag down into the
 * ribs, the chest caves, the feet spread into the platform.
 *
 * Two clamps, both there to protect depth rather than to look nice:
 *
 *   - The knees may not cave inside KNEE_MIN_VS_HIP of the hip half-width.
 *     Legs cannot cross, and it stops a standing pose going knock-kneed.
 *   - Where the authored drawing has the hip crease below the top of the knee
 *     — i.e. where the drawing is at legal depth — the combined hip rise may
 *     not bring it closer than HIP_DEPTH_MARGIN_PX. A strained frame is
 *     allowed to be uglier than a clean one. It is not allowed to be shallower.
 */
export function deformPose(pose: Pose, strain: number, pitch: number): Pose {
  const s = Math.min(1, Math.max(0, strain));
  const p = Math.min(1, Math.max(0, pitch));
  if (s === 0 && p === 0) return pose;

  const d = strainDeltaAt(s);
  const q = pitchDeltaAt(p);

  // Hip. Both channels raise it; the depth guard is applied once, to the sum.
  const hipRaw = pose.hipY - d.HIP_SHOOT - q.HIP_RISE;
  const atDepth = pose.hipY > pose.kneeY;
  const hipFloor = atDepth ? Math.min(pose.hipY, pose.kneeY + STRAIN.HIP_DEPTH_MARGIN_PX) : -Infinity;
  const hipY = Math.max(hipRaw, hipFloor);
  // The waist rides most of whatever the hip actually got, not what it asked
  // for, so the belt does not detach from the pelvis when the guard binds.
  const hipTravel = pose.hipY - hipY;

  // MIN_HALF_W is a degenerate-geometry guard, not a feel value: a half-width
  // of zero collapses the trunk rasteriser's normal and there is nothing to
  // shade. It is not reachable at any authored level.
  const MIN_HALF_W = 1;
  const hipHalfW = Math.max(MIN_HALF_W, pose.hipHalfW - q.TORSO_NARROW);
  const kneeFloor = hipHalfW * STRAIN.KNEE_MIN_VS_HIP;
  const kneeHalfW = Math.max(Math.min(pose.kneeHalfW, kneeFloor), pose.kneeHalfW - d.KNEE_VALGUS);

  const F = DEFORM_FOLLOW;
  return {
    ...pose,
    headY: pose.headY - d.HEAD_CRANE - q.HEAD_CRANE,
    neckY: pose.neckY - (d.HEAD_CRANE + q.HEAD_CRANE) * F.NECK_OF_HEAD_CRANE,
    shoulderHalfW: pose.shoulderHalfW + d.SHOULDER_SHRUG,
    chestY: pose.chestY + d.CHEST_COLLAPSE + q.CHEST_DROP,
    waistY: pose.waistY - hipTravel * F.WAIST_OF_HIP_TRAVEL,
    waistHalfW: Math.max(
      MIN_HALF_W,
      pose.waistHalfW - q.TORSO_NARROW * F.WAIST_WIDTH_OF_TORSO_NARROW,
    ),
    hipY,
    hipHalfW,
    kneeHalfW,
    elbowHalfW: pose.elbowHalfW - d.ELBOW_TUCK,
    elbowY: pose.elbowY + d.ELBOW_TUCK * F.ELBOW_DROP_OF_TUCK,
    ankleHalfW: pose.ankleHalfW + d.STANCE_SPREAD,
  };
}

/** Strain alone. Kept as a named entry point; pitch defaults to none. */
export function applyStrain(pose: Pose, strain: number): Pose {
  return deformPose(pose, strain, 0);
}

/** Pitch alone. */
export function applyPitch(pose: Pose, pitch: number): Pose {
  return deformPose(pose, 0, pitch);
}

/** Quantise strain to the fixed number of authored levels. */
export function strainLevel(strain: number): number {
  const s = Math.min(1, Math.max(0, strain));
  return Math.min(STRAIN.LEVELS - 1, Math.floor(s * STRAIN.LEVELS));
}

/** Representative strain value for a quantised level. */
export function strainForLevel(level: number): number {
  const clamped = Math.min(STRAIN.LEVELS - 1, Math.max(0, Math.round(level)));
  return STRAIN.LEVELS <= 1 ? 0 : clamped / (STRAIN.LEVELS - 1);
}

/** Quantise a forward bar drift, in px, to the authored pitch levels. */
export function pitchLevelForDriftPx(forwardPx: number): number {
  const t = Math.min(1, Math.max(0, Math.abs(forwardPx) / PITCH.FULL_PX));
  return Math.min(PITCH.LEVELS - 1, Math.floor(t * PITCH.LEVELS));
}

/** Representative pitch value for a quantised level. */
export function pitchForLevel(level: number): number {
  const clamped = Math.min(PITCH.LEVELS - 1, Math.max(0, Math.round(level)));
  return PITCH.LEVELS <= 1 ? 0 : clamped / (PITCH.LEVELS - 1);
}

/** Cell bounds, re-exported so drawing code has one import for geometry. */
export const CELL = {
  W: RESOLUTION.CELL_W,
  H: RESOLUTION.CELL_H,
  FLOOR_Y: RESOLUTION.FLOOR_Y,
  CENTER_X,
} as const;
