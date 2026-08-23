/**
 * Bench press drawing — a SIDE-ON recumbent press on the 96×72 index grid.
 *
 * WHY A SECOND CAMERA, NOT NEW SQUAT POSE ROWS. The squat sheet is front-on
 * and mirror-symmetric by construction (`rig.ts`). A bench press that reuses
 * those rows is a squat with a different caption, which is exactly what a
 * phone playtest reported. Side-on is the view that makes a press: the lifter
 * is on their back, the bar travels off the chest, the plates are faces.
 *
 * THIS FILE IS DATA, same class as `rig.ts`. The numbers below are joint
 * anchors. Moving one without redrawing the pose it names is meaningless, so
 * they are not knobs. The knobs — how coarse the height sheet is, how much a
 * strained lockout fails to finish — are `BENCH_PRESS` in `spriteTuning.ts`.
 *
 * PURE. Zero React, zero I/O, zero randomness. Same spec, same pixels.
 *
 * HOW THE ARM IS BUILT, AND WHY IT IS NOT AUTHORED TWICE. The first version of
 * this file authored an elbow in the CHEST pose and a second elbow in the
 * LOCKOUT pose and lerped between the two POSITIONS. Interpolating positions
 * does not interpolate a skeleton: measured on that build, the upper arm ran
 * 12.53 px at the chest, 6.17 px a third of the way up and 16.28 px at lockout
 * — a 2.6x length change inside one rep, shortest exactly where the player is
 * looking. Total arm length swung 33.93 -> 22.80 px. A rubber arm is not a
 * tuning mistake that two better numbers would fix; it is what that
 * representation produces for ANY two poses that are not accidentally
 * consistent, which is why the numbers were not what changed.
 *
 * So the arm is now a two-bone linkage solved by inverse kinematics:
 *
 *     bone lengths           authored, ONE pair, `ARM`
 *     shoulder               authored per pose, lerped
 *     hand                   THE BAR — not a landmark of its own
 *     elbow                  solved from those three, `solveElbow`
 *
 * That makes both of the defects unrepresentable rather than merely absent. A
 * bone cannot change length because its length is an input and never an
 * output. The hand cannot leave the bar because the hand IS the bar position,
 * after lateral drift and after the strain drop — there is no second number to
 * disagree with the first. Re-authoring the two poses by hand would have moved
 * the drawing without moving either possibility, and the next retune would have
 * reintroduced both.
 *
 * Those two sentences are claims about behaviour, so they name the checks that
 * go red without them rather than sitting on their own authority. Bone length:
 * "keeps every arm bone exactly the same length for the whole stroke". Hand on
 * bar: "holds the hand on the bar that is actually drawn", and "draws skin
 * inside the hand own disc at every height" for the drawn half of it. Vertical
 * path: "runs the bar up one vertical column over the chest". All four are in
 * `benchPress.test.ts` and each was watched going red on a planted mutant when
 * it was written. They carry no `@guarantee` tag because a new tag needs a
 * witness recorded in `src/game/guaranteeTags.test.ts`, which this piece was
 * scoped out of — so the pointer is prose, and that is weaker than a tag by
 * exactly the amount a scan would have checked.
 *
 * WHAT IK BUYS OVER FORWARD KINEMATICS, since FK also preserves bone length.
 * FK — lerp a shoulder angle and an elbow angle — keeps the bones rigid and
 * swings the hand along an arc of the FK solution's own choosing. The bar here
 * is required to travel a straight vertical line over the chest, so under FK
 * either the hand leaves the bar or the bar path bends to follow the hand.
 * IK is the formulation where both constraints are inputs.
 *
 * Draw order, back to front:
 *
 *     far plates
 *     far arm
 *     bench pad and legs
 *     far leg, torso, near leg
 *     head
 *     near arm, shaft
 *     near plates (the read of the load)
 *     near hand and grip stub, ON TOP of the near plates
 *     despeckle, face marks, outline
 *
 * The near hand is drawn last on purpose and it is a cheat. A 25 kg disc is
 * 15.4 px across at this scale and the grip is inboard of it, so in a strict
 * sagittal projection the plate is between the camera and the hand and hides
 * it: measured on the previous build, zero skin pixels survived inside the
 * hand's own disc at every one of nine heights, and the arm visibly stopped
 * short of the bar in every cell. Given a choice between a projection that is
 * correct and a lifter who never touches the bar, this draws the grip.
 */

import { BENCH_PRESS, CENTER_X, RESOLUTION, SHADING, SHADOW, STRAIN } from './spriteTuning';
import { PAL, RAMPS } from './palette';
import {
  createGrid,
  despeckle,
  drawEllipsoid,
  drawLimb,
  drawLimbChain,
  outlinePass,
  setPx,
  type IndexGrid,
} from './raster';
import {
  BAR_AND_COLLARS_KG,
  PLATE_HUE_RAMPS,
  visualPlateStack,
} from './plates';
import { strainForLevel, type Pose } from './rig';
import type { LifterFrameSpec } from './lifterSprite';

/**
 * Hair cap inset, in sprite px off the head's own radii.
 *
 * Wider than the squat sprite's, because the two cameras want different things
 * from the same primitive. Front-on, the hair is a cap seen edge-on and an
 * inset of a tenth of a pixel is right. Side-on, the same inset makes the cap
 * cover the whole 12x10 skull: measured, that left FOUR skin pixels on the head
 * and one of them isolated above the crown, so the lifter rendered as a
 * featureless dark blob with a floating speck over it.
 */
const HAIR_RX_INSET = 1.2;

/**
 * Landmarks a human authored for one side-on press drawing.
 *
 * Units are sprite pixels in the 96×72 cell. Head is LEFT, feet RIGHT — the
 * conventional sagittal view of a press.
 *
 * The elbow, the hand and the bar are absent on purpose: those three are
 * derived, and a derived quantity with an authored twin is the defect this
 * file's header is about.
 */
interface BenchAnchors {
  readonly headX: number;
  readonly headY: number;
  readonly headRx: number;
  readonly headRy: number;
  readonly neckX: number;
  readonly neckY: number;
  readonly shoulderX: number;
  readonly shoulderY: number;
  readonly hipX: number;
  readonly hipY: number;
  readonly kneeX: number;
  readonly kneeY: number;
  readonly ankleX: number;
  readonly ankleY: number;
}

/** An authored pose plus the three landmarks solved from it and the bar. */
interface BenchLandmarks extends BenchAnchors {
  readonly elbowX: number;
  readonly elbowY: number;
  readonly handX: number;
  readonly handY: number;
  /** Near-sleeve centre, where the plate faces sit. */
  readonly barX: number;
  readonly barY: number;
}

/** Pad and uprights. Authored with the poses; they do not travel with the bar. */
const BENCH = {
  PAD_X0: 14,
  PAD_X1: 82,
  PAD_Y0: 50,
  PAD_Y1: 54,
  LEG_W: 3,
  LEG_LEFT_X: 24,
  LEG_RIGHT_X: 70,
  /** Far-side offset, toward the camera's far flank. */
  FAR_DX: 3,
  FAR_DY: 1,
  /** Plate faces stack this far toward the camera per disc. */
  PLATE_STACK_DX: 2,
  PLATE_STACK_DY: 1,
  /** Upper-arm / forearm / thigh / shin radii at the two ends of each capsule. */
  ARM_R: { UPPER: [3.2, 2.6] as const, FORE: [2.4, 2.0] as const },
  LEG_R: { THIGH: [4.6, 3.8] as const, SHIN: [2.8, 2.4] as const },
  HAND_R: 2.2,
  /**
   * How much of the forearm's distal end is redrawn in front of the near
   * plates, together with the hand.
   *
   * Without it the arm is a capsule that ends somewhere behind a 15 px disc and
   * the eye reads it as stopping short — which is what the previous build did.
   * A stub this long puts the last third of the forearm and the fist on the
   * near side of the plate, so the limb arrives at the bar in the picture and
   * not only in the numbers.
   */
  GRIP_STUB_PX: 6,
  SHOE_RX: 4.2,
  SHOE_RY: 2.0,
  TORSO_R: { SHOULDER: 6.2, HIP: 7.0 },
  NECK_R: 2.2,
  COLLAR_R: 2.4,
  SHAFT_HALF: 4,
  SHAFT_THICK: 2,
  HAIR_RY_INSET: 0.2,
  /**
   * Hair cap offset from the head centre: head-ward, and level.
   *
   * It used to be head-ward and UP, on a cap inset a tenth of a pixel off the
   * head's own radii, which covered the entire 12x10 skull. Four skin pixels
   * survived and one of them was an isolated speck above the crown, so the head
   * drew as a featureless dark blob. `stampFace` sits directly under a comment
   * saying the lifter is looking up toward the bar and calling that "the whole
   * reason this is a press and not a nap"; the eye it stamps was two dark
   * pixels on dark hair, so nothing in the picture agreed with it.
   *
   * LEVEL RATHER THAN LOW, and that was measured by looking rather than
   * reasoned. Offsetting the cap downward as well is the anatomically tidier
   * answer — the crown of a supine skull is against the pad — and it draws a
   * light crescent wrapped over a dark ball, which the outline pass then
   * separates into two shapes. At 6x that read as a flame on a bowling ball. A
   * purely head-ward offset splits the head vertically instead: hair behind,
   * face in front, which is what a profile is.
   */
  HAIR_DX: 4,
  HAIR_DY: 0,
  /**
   * Eye offset from the head centre. Foot-ward and up, in the quadrant the hair
   * cap now leaves as skin.
   */
  EYE_DX: 4,
  EYE_DY: -1,
  /**
   * Belt band, as offsets back from the hip along the trunk.
   *
   * At the hip itself the near thigh now covers it completely — the leg repair
   * put the knee below the hip, so the thigh root sits over the hip joint
   * instead of rising away from it. Drawn there, the belt was a dark rectangle
   * in the middle of a thigh.
   */
  BELT: { BACK: 7, FRONT: 4, RISE: 4, DROP: 1 },
  /**
   * Dummy half-widths so the squat Pose type is filled. The bench drawing does
   * not use them; they exist so headBox / contact-shadow callers have a Pose.
   */
  COMPAT: {
    SHOULDER_HALF: 4,
    WAIST_HALF: 5,
    HIP_HALF: 5,
    KNEE_HALF: 8,
    ANKLE_HALF: 14,
    ELBOW_HALF: 6,
    HAND_HALF: 4,
  },
} as const;

/**
 * THE BAR'S OWN GEOMETRY. One column and two heights, and the column is a
 * single number rather than a field on each pose — which is what makes "the bar
 * path is vertical and over the chest" a property of the representation instead
 * of a coincidence between two authored poses that a retune could break.
 *
 * X sits between the shoulder (33) and the hip (54): the bar touches the lower
 * chest, not the throat and not the belly.
 *
 * CHEST_Y is one pixel clear of the drawn chest, so the bar reads as resting on
 * it. LOCKOUT_Y is not a taste value — it is the highest the arm can hold the
 * bar and still show a bend at the elbow. `ARM.UPPER_PX + ARM.FORE_PX` is
 * 26.5 px; the shoulder at lockout is (33, 47); a bar at (38, 22) is 25.50 px
 * from it, so the arm is 96.2% extended and the elbow is still articulated.
 * Raising LOCKOUT_Y past that straightens the arm and then breaks it —
 * `benchPress.test.ts`'s "can always reach the bar with a bend left over" is
 * the check that goes red, and the reach margin is pinned there.
 *
 * THE TRAVEL SHRANK, AND IT SHRANK TOWARD THE TRUTH. The first build's lockout
 * was y=17, a 23 px stroke, which at this sprite's 34.29 px/m is a 67 cm bench
 * press. No human has that range. 18 px is 52 cm, which is a long-armed
 * lifter's honest ROM, and it still sweeps a quarter of the cell's height.
 */
const BAR = {
  X: 38,
  CHEST_Y: 40,
  LOCKOUT_Y: 22,
} as const;

/**
 * THE ARM'S TWO BONES. Sprite pixels, and the only inputs the arm has.
 *
 * THESE ARE PROJECTED LENGTHS, NOT ANATOMICAL ONES, which is why the forearm is
 * the longer of the two and that is not a mistake. A bencher's humerus is
 * abducted away from the ribs, so a strict sagittal camera sees it partly
 * end-on and its projection is foreshortened; the forearm at the bottom of a
 * press is close to vertical and is barely foreshortened at all. Two capsules
 * on a 96×72 grid cannot rotate a bone out of the screen plane, so this drawing
 * holds the humerus at ONE abduction for the whole stroke and draws its
 * projection. Fixing the abduction is exactly what makes the projected length a
 * constant, and the constant is what is written here.
 *
 * They are chosen, not free. `UPPER_PX` sets where the elbow lands at the
 * chest — 11 px puts it at (41.4, 55.1), under the bar and below the pad line,
 * which is where a tucked elbow goes. Their SUM sets how high the bar can be
 * held: see `BAR.LOCKOUT_Y`. Move either and both of those move, so both are
 * pinned in the tests rather than left to be noticed on a sheet.
 */
const ARM = {
  UPPER_PX: 11,
  FORE_PX: 15.5,
  /**
   * Which of the two elbow solutions to take. +1 is the foot-ward side of the
   * shoulder-to-hand line, where a benched elbow goes; -1 folds the elbow back
   * over the lifter's own face and draws a pullover. The previous build's
   * authored chest elbow was at x=22 against a shoulder at x=33 — 11 px
   * head-ward, level with the skull — so it drew the -1 pose at the bottom of
   * the stroke and the +1 pose at the top, and swapped between them mid-rep.
   */
  SIDE: 1,
} as const;

/**
 * Bar on the chest, elbows dropped. This is HOLE, and the pose the command
 * fires against.
 *
 * The leg is a linkage too, and it is authored rather than solved because it
 * does not move: hip, knee and ankle are identical in both poses, so there is
 * nothing for a lerp to stretch. It was still wrong. The first build put the
 * knee at y=43 — SEVEN pixels ABOVE a hip at y=50, with the feet planted on the
 * floor — and gave the shin 24.35 px against a 15.65 px thigh, a shin 56%
 * longer than the thigh it hangs off. It read as a high-kneed crouch. A supine
 * lifter's knee sits a little BELOW the hip, because the pad is higher off the
 * floor than the knee joint is; thigh and shin are within a few percent of each
 * other on a real skeleton. 14.22 and 14.40 at 34.29 px/m are 41 cm and 42 cm.
 */
const CHEST: BenchAnchors = {
  headX: 20,
  headY: 43,
  headRx: 6.0,
  headRy: 5.0,
  neckX: 27,
  neckY: 47,
  shoulderX: 33,
  shoulderY: 48,
  hipX: 54,
  hipY: 50,
  kneeX: 68,
  kneeY: 52.5,
  ankleX: 73,
  ankleY: 66,
};

/**
 * Arms long, bar at lockout. Feet stay planted; the hips stay on the pad.
 */
const LOCKOUT: BenchAnchors = {
  headX: 20,
  headY: 42,
  headRx: 6.0,
  headRy: 5.0,
  neckX: 27,
  neckY: 46,
  shoulderX: 33,
  shoulderY: 47,
  hipX: 54,
  hipY: 50,
  kneeX: 68,
  kneeY: 52.5,
  ankleX: 73,
  ankleY: 66,
};

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Structural constants of the circle-intersection solve. Not knobs — changing
 * one does not restyle the arm, it makes the arithmetic wrong.
 */
const IK = {
  /** The 2 in `(d² + u² − f²) / 2d`. */
  HALF_DIVISOR: 2,
  /**
   * Below this shoulder-to-hand separation the solve has no direction to work
   * along and the arm is drawn folded. Unreachable in the shipped domain — the
   * closest the bar ever gets to the shoulder is 9.43 px — and present so the
   * function is total rather than because anything calls it.
   */
  MIN_SEPARATION_PX: 0.001,
} as const;

interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * The elbow of a two-bone arm whose shoulder and hand are both given.
 *
 * Both bone lengths come from `ARM` and neither is ever computed from the
 * drawing, so no pose can produce an arm whose bones are the wrong length. That
 * is the whole reason this function exists instead of two authored elbows: it
 * is not a better-behaved interpolation, it is a representation in which the
 * rubber-arm defect has nowhere to live. `benchPress.test.ts`'s "keeps every
 * arm bone exactly the same length for the whole stroke" is the check.
 *
 * Geometry: the elbow is on both bone circles, so it is one of the two
 * intersection points. `along` is the projection of that point onto the
 * shoulder-to-hand line and `across` its perpendicular offset; `ARM.SIDE`
 * picks which of the two.
 *
 * The unreachable branch keeps the UPPER bone exact and lays the arm straight
 * along the line, which loses at most the reach overshoot off the forearm
 * rather than producing a NaN. The shipped domain never enters it and the test
 * named above pins the worst-case reach margin, so entering it is a red test
 * and not a silently different drawing.
 */
function solveElbow(sx: number, sy: number, hx: number, hy: number): Point {
  const dx = hx - sx;
  const dy = hy - sy;
  const d = Math.hypot(dx, dy);
  if (d < IK.MIN_SEPARATION_PX) return { x: sx + ARM.UPPER_PX, y: sy };

  const ux = dx / d;
  const uy = dy / d;
  // The screen-space left normal of (ux, uy): y grows downward here, so this
  // points foot-ward and down when the hand is up and foot-ward of the shoulder.
  const nx = -uy * ARM.SIDE;
  const ny = ux * ARM.SIDE;

  const along =
    (d * d + ARM.UPPER_PX * ARM.UPPER_PX - ARM.FORE_PX * ARM.FORE_PX) / (IK.HALF_DIVISOR * d);
  const acrossSq = ARM.UPPER_PX * ARM.UPPER_PX - along * along;
  if (acrossSq <= 0) return { x: sx + ux * ARM.UPPER_PX, y: sy + uy * ARM.UPPER_PX };

  const across = Math.sqrt(acrossSq);
  return { x: sx + ux * along + nx * across, y: sy + uy * along + ny * across };
}

/**
 * The whole figure at one bar height, with the bar already resolved.
 *
 * `barX` / `barY` are passed in rather than read from the poses because the
 * drawn bar carries the strain drop and any lateral drift, and the hand has to
 * be on the bar that is actually drawn — not on the one the authored pose would
 * have had. That was live in the first build: strain moved the bar three pixels
 * and left the hand where it was.
 */
function poseFor(height: number, barX: number, barY: number): BenchLandmarks {
  const t = clamp01(height);
  const shoulderX = mix(CHEST.shoulderX, LOCKOUT.shoulderX, t);
  const shoulderY = mix(CHEST.shoulderY, LOCKOUT.shoulderY, t);
  const elbow = solveElbow(shoulderX, shoulderY, barX, barY);
  return {
    headX: mix(CHEST.headX, LOCKOUT.headX, t),
    headY: mix(CHEST.headY, LOCKOUT.headY, t),
    headRx: mix(CHEST.headRx, LOCKOUT.headRx, t),
    headRy: mix(CHEST.headRy, LOCKOUT.headRy, t),
    neckX: mix(CHEST.neckX, LOCKOUT.neckX, t),
    neckY: mix(CHEST.neckY, LOCKOUT.neckY, t),
    shoulderX,
    shoulderY,
    elbowX: elbow.x,
    elbowY: elbow.y,
    handX: barX,
    handY: barY,
    hipX: mix(CHEST.hipX, LOCKOUT.hipX, t),
    hipY: mix(CHEST.hipY, LOCKOUT.hipY, t),
    kneeX: mix(CHEST.kneeX, LOCKOUT.kneeX, t),
    kneeY: mix(CHEST.kneeY, LOCKOUT.kneeY, t),
    ankleX: mix(CHEST.ankleX, LOCKOUT.ankleX, t),
    ankleY: mix(CHEST.ankleY, LOCKOUT.ankleY, t),
    barX,
    barY,
  };
}

function fillRect(
  g: IndexGrid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  index: number,
): void {
  const xa = Math.round(Math.min(x0, x1));
  const xb = Math.round(Math.max(x0, x1));
  const ya = Math.round(Math.min(y0, y1));
  const yb = Math.round(Math.max(y0, y1));
  for (let y = ya; y <= yb; y += 1) {
    for (let x = xa; x <= xb; x += 1) setPx(g, x, y, index);
  }
}

function drawBenchHardware(g: IndexGrid): void {
  fillRect(g, BENCH.PAD_X0, BENCH.PAD_Y0, BENCH.PAD_X1, BENCH.PAD_Y1, PAL.GEAR_MID);
  fillRect(g, BENCH.PAD_X0, BENCH.PAD_Y0, BENCH.PAD_X1, BENCH.PAD_Y0, PAL.GEAR_LIGHT);
  const floor = RESOLUTION.FLOOR_Y;
  for (const legX of [BENCH.LEG_LEFT_X, BENCH.LEG_RIGHT_X]) {
    fillRect(g, legX, BENCH.PAD_Y1 + 1, legX + BENCH.LEG_W - 1, floor, PAL.STEEL_MID);
    fillRect(g, legX, BENCH.PAD_Y1 + 1, legX, floor, PAL.STEEL_LIGHT);
  }
}

function drawPlates(
  g: IndexGrid,
  barX: number,
  barY: number,
  totalKg: number,
  barKg: number,
  towardCamera: boolean,
): void {
  const stack = visualPlateStack(totalKg, barKg);
  const dir = towardCamera ? 1 : -1;
  const lightScale = towardCamera ? 1 : SHADING.FAR_LIMB_LIGHT_SCALE;
  let x = barX;
  let y = barY;
  for (const plate of stack.perSide) {
    const r = plate.diameterPx / 2;
    drawEllipsoid(g, x, y, r, r, PLATE_HUE_RAMPS[plate.spec.hue], {
      edge: true,
      lightScale,
    });
    x += dir * BENCH.PLATE_STACK_DX;
    y += dir * BENCH.PLATE_STACK_DY;
  }
  drawEllipsoid(g, barX, barY, BENCH.COLLAR_R, BENCH.COLLAR_R, RAMPS.CHROME, {
    edge: true,
    lightScale,
  });
}

function drawShaft(g: IndexGrid, barX: number, barY: number): void {
  drawLimb(
    g,
    barX - BENCH.SHAFT_HALF,
    barY,
    barX + BENCH.SHAFT_HALF,
    barY,
    BENCH.SHAFT_THICK,
    BENCH.SHAFT_THICK,
    RAMPS.SHAFT,
    { edge: true, axial: SHADING.AXIAL_FLAT },
  );
}

function drawArm(
  g: IndexGrid,
  pose: BenchLandmarks,
  far: boolean,
  skin: typeof RAMPS.SKIN,
): void {
  const dx = far ? BENCH.FAR_DX : 0;
  const dy = far ? BENCH.FAR_DY : 0;
  const lightScale = far ? SHADING.FAR_LIMB_LIGHT_SCALE : 1;
  const opts = { edge: true as const, lightScale, axial: SHADING.AXIAL_LIMB };
  drawLimbChain(g, [
    {
      ax: pose.shoulderX + dx,
      ay: pose.shoulderY + dy,
      bx: pose.elbowX + dx,
      by: pose.elbowY + dy,
      ra: BENCH.ARM_R.UPPER[0],
      rb: BENCH.ARM_R.UPPER[1],
      ramp: skin,
      opts,
    },
    {
      ax: pose.elbowX + dx,
      ay: pose.elbowY + dy,
      bx: pose.handX + dx,
      by: pose.handY + dy,
      ra: BENCH.ARM_R.FORE[0],
      rb: BENCH.ARM_R.FORE[1],
      ramp: skin,
      opts,
    },
  ]);
}

function drawHand(
  g: IndexGrid,
  pose: BenchLandmarks,
  far: boolean,
  skin: typeof RAMPS.SKIN,
): void {
  const dx = far ? BENCH.FAR_DX : 0;
  const dy = far ? BENCH.FAR_DY : 0;
  drawEllipsoid(
    g,
    pose.handX + dx,
    pose.handY + dy,
    BENCH.HAND_R,
    BENCH.HAND_R,
    skin,
    { edge: true, lightScale: far ? SHADING.FAR_LIMB_LIGHT_SCALE : 1 },
  );
}

/**
 * The last `BENCH.GRIP_STUB_PX` of the near forearm plus the near fist, drawn
 * over the near plates so the arm arrives at the bar in the picture.
 *
 * Wholly a legibility cheat and the module header says why. The stub is taken
 * back along the real forearm's own axis, so it is a redraw of geometry that is
 * already there rather than a second arm that could point somewhere else.
 */
function drawGrip(g: IndexGrid, pose: BenchLandmarks, skin: typeof RAMPS.SKIN): void {
  const dx = pose.handX - pose.elbowX;
  const dy = pose.handY - pose.elbowY;
  const len = Math.hypot(dx, dy);
  if (len > IK.MIN_SEPARATION_PX) {
    const back = Math.min(BENCH.GRIP_STUB_PX, len) / len;
    drawLimb(
      g,
      pose.handX - dx * back,
      pose.handY - dy * back,
      pose.handX,
      pose.handY,
      BENCH.ARM_R.FORE[1],
      BENCH.ARM_R.FORE[1],
      skin,
      { edge: true, axial: SHADING.AXIAL_LIMB },
    );
  }
  drawHand(g, pose, false, skin);
}

function drawBody(g: IndexGrid, pose: BenchLandmarks, skin: typeof RAMPS.SKIN): void {
  const farOpts = {
    edge: true as const,
    lightScale: SHADING.FAR_LIMB_LIGHT_SCALE,
    axial: SHADING.AXIAL_LEG,
  };
  const nearOpts = { edge: true as const, axial: SHADING.AXIAL_LEG };

  drawLimb(
    g,
    pose.hipX + BENCH.FAR_DX,
    pose.hipY + BENCH.FAR_DY,
    pose.kneeX + BENCH.FAR_DX,
    pose.kneeY + BENCH.FAR_DY,
    BENCH.LEG_R.THIGH[0],
    BENCH.LEG_R.THIGH[1],
    skin,
    farOpts,
  );
  drawLimb(
    g,
    pose.kneeX + BENCH.FAR_DX,
    pose.kneeY + BENCH.FAR_DY,
    pose.ankleX + BENCH.FAR_DX,
    pose.ankleY + BENCH.FAR_DY,
    BENCH.LEG_R.SHIN[0],
    BENCH.LEG_R.SHIN[1],
    skin,
    farOpts,
  );

  drawLimb(
    g,
    pose.shoulderX,
    pose.shoulderY,
    pose.hipX,
    pose.hipY,
    BENCH.TORSO_R.SHOULDER,
    BENCH.TORSO_R.HIP,
    RAMPS.SINGLET,
    { edge: true, axial: SHADING.AXIAL_TRUNK },
  );

  drawLimb(
    g,
    pose.hipX,
    pose.hipY,
    pose.kneeX,
    pose.kneeY,
    BENCH.LEG_R.THIGH[0],
    BENCH.LEG_R.THIGH[1],
    skin,
    nearOpts,
  );
  drawLimb(
    g,
    pose.kneeX,
    pose.kneeY,
    pose.ankleX,
    pose.ankleY,
    BENCH.LEG_R.SHIN[0],
    BENCH.LEG_R.SHIN[1],
    skin,
    nearOpts,
  );

  drawEllipsoid(
    g,
    pose.ankleX + 1,
    pose.ankleY + 1,
    BENCH.SHOE_RX,
    BENCH.SHOE_RY,
    RAMPS.GEAR,
    { edge: true, axial: SHADING.AXIAL_FLAT },
  );

  // Belt: a short GEAR band at the waist so the singlet reads as kit.
  fillRect(
    g,
    pose.hipX - BENCH.BELT.BACK,
    pose.hipY - BENCH.BELT.RISE,
    pose.hipX - BENCH.BELT.FRONT,
    pose.hipY + BENCH.BELT.DROP,
    PAL.GEAR_DARK,
  );
}

function drawHead(g: IndexGrid, pose: BenchLandmarks, skin: typeof RAMPS.SKIN): void {
  drawLimb(
    g,
    pose.neckX,
    pose.neckY,
    pose.shoulderX,
    pose.shoulderY,
    BENCH.NECK_R,
    BENCH.NECK_R,
    skin,
    { edge: true, axial: SHADING.AXIAL_LIMB },
  );
  drawEllipsoid(g, pose.headX, pose.headY, pose.headRx, pose.headRy, skin, {
    edge: true,
    stepBias: SHADING.HEAD_STEP_BIAS,
  });
  drawEllipsoid(
    g,
    pose.headX - BENCH.HAIR_DX,
    pose.headY + BENCH.HAIR_DY,
    pose.headRx - HAIR_RX_INSET,
    pose.headRy - BENCH.HAIR_RY_INSET,
    RAMPS.HAIR,
    { edge: true },
  );
}

function stampFace(g: IndexGrid, pose: BenchLandmarks): void {
  // Two stacked pixels so despeckle cannot eat the eye. Looking UP, toward
  // the bar — that is the whole reason this is a press and not a nap.
  const eyeX = Math.round(pose.headX + BENCH.EYE_DX);
  const eyeY = Math.round(pose.headY + BENCH.EYE_DY);
  setPx(g, eyeX, eyeY, PAL.OUTLINE);
  setPx(g, eyeX, eyeY + 1, PAL.OUTLINE);
  setPx(g, eyeX + 1, eyeY + 2, PAL.SKIN_SHADOW);
}

/**
 * A Pose the squat shadow / headBox machinery can read, mapped from the
 * recumbent landmarks. Not a squat pose — just enough for the existing
 * measurement helpers to point at the head and the floor.
 */
function squatCompatiblePose(pose: BenchLandmarks): Pose {
  return {
    headY: pose.headY,
    headDx: pose.headX - CENTER_X,
    neckY: pose.neckY,
    shoulderY: pose.shoulderY,
    shoulderHalfW: BENCH.COMPAT.SHOULDER_HALF,
    chestY: pose.shoulderY,
    waistY: pose.hipY,
    waistHalfW: BENCH.COMPAT.WAIST_HALF,
    hipY: pose.hipY,
    hipHalfW: BENCH.COMPAT.HIP_HALF,
    kneeY: pose.kneeY,
    kneeHalfW: BENCH.COMPAT.KNEE_HALF,
    ankleY: pose.ankleY,
    ankleHalfW: BENCH.COMPAT.ANKLE_HALF,
    elbowY: pose.elbowY,
    elbowHalfW: BENCH.COMPAT.ELBOW_HALF,
    handY: pose.handY,
    handHalfW: BENCH.COMPAT.HAND_HALF,
  };
}

export interface BenchRender {
  readonly grid: IndexGrid;
  readonly pose: Pose;
  readonly barCenterY: number;
  readonly landmarks: BenchLandmarks;
}

/**
 * The geometry this drawing is built from, exported so `benchPress.test.ts`
 * measures against the real numbers instead of restating them.
 *
 * Deliberately the same objects, not copies: a test that holds its own copy of
 * a constant agrees with itself forever and says nothing about the drawing.
 */
export const BENCH_GEOMETRY = Object.freeze({ ARM, BAR, BENCH });

/** Bar centre y for a normalised height, after strain shortens lockout. */
export function benchBarY(height: number, strainLevel: number = 0): number {
  const t = clamp01(height);
  const drop = strainForLevel(strainLevel) * BENCH_PRESS.STRAIN_LOCKOUT_DROP_PX * t;
  return mix(BAR.CHEST_Y, BAR.LOCKOUT_Y, t) + drop;
}

/** The shadow a recumbent lifter throws — a wide oval under the pad, not under two feet. */
export function renderBenchContactShadow(): IndexGrid {
  const g = createGrid(RESOLUTION.CELL_W, RESOLUTION.CELL_H);
  const halfW = SHADOW.BASE_HALF_W_PX * 2;
  const cy = RESOLUTION.FLOOR_Y;
  for (let y = Math.round(cy - SHADOW.HALF_H_PX); y <= Math.round(cy + SHADOW.HALF_H_PX); y += 1) {
    const ny = (y - cy) / SHADOW.HALF_H_PX;
    const span = halfW * Math.sqrt(Math.max(0, 1 - ny * ny));
    for (let x = Math.round(CENTER_X - span); x <= Math.round(CENTER_X + span); x += 1) {
      setPx(g, x, y, PAL.CONTACT_SHADOW);
    }
  }
  return g;
}

/** Render one press frame to an index grid with a transparent background. */
export function renderBenchFrame(spec: LifterFrameSpec): BenchRender {
  const height = clamp01(spec.height ?? 1 - spec.depth);
  const barY = benchBarY(height, spec.strainLevel);
  const barX = BAR.X + spec.barLateralPx;
  const pose = poseFor(height, barX, barY);
  const skin = strainForLevel(spec.strainLevel) > STRAIN.FLUSH_THRESHOLD ? RAMPS.SKIN_FLUSHED : RAMPS.SKIN;
  const barKg = spec.barKg ?? BAR_AND_COLLARS_KG;

  const g = createGrid(RESOLUTION.CELL_W, RESOLUTION.CELL_H);

  drawPlates(g, barX, barY, spec.totalKg, barKg, false);
  drawArm(g, pose, true, skin);
  drawHand(g, pose, true, skin);
  drawBenchHardware(g);
  drawBody(g, pose, skin);
  drawHead(g, pose, skin);
  drawArm(g, pose, false, skin);
  drawShaft(g, barX, barY);
  drawPlates(g, barX, barY, spec.totalKg, barKg, true);
  drawGrip(g, pose, skin);

  despeckle(g);
  stampFace(g, pose);
  outlinePass(g);

  return {
    grid: g,
    pose: squatCompatiblePose(pose),
    barCenterY: barY,
    landmarks: pose,
  };
}
