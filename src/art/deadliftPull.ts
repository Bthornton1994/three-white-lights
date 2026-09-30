/**
 * Deadlift drawing — a SIDE-ON conventional pull on the 96×72 index grid.
 *
 * WHY A SECOND CAMERA, NOT A SQUAT POSE WITH THE BAR MOVED DOWN. The squat
 * sheet is front-on, bar on the traps. A deadlift that reuses those rows is a
 * squat that started at the bottom, which is exactly what a phone playtest
 * reported. Side-on is the view that makes a pull: the athlete is hinged over
 * a bar on the floor, the hands ARE the bar, the plates are faces on the
 * floor, and lockout is a finished standing pull, not a front-on squat.
 *
 * THIS FILE IS DATA, same class as `rig.ts` and `benchPress.ts`. The numbers
 * below are joint anchors. Moving one without redrawing the pose it names is
 * meaningless, so they are not knobs. The knobs — how coarse the height sheet
 * is, how much a strained lockout fails to finish — are `DEADLIFT_PULL` in
 * `spriteTuning.ts`.
 *
 * PURE. Zero React, zero I/O, zero randomness. Same spec, same pixels.
 *
 * THE ARM AND THE LEG ARE TWO-BONE LINKAGES, for the reason `benchPress.ts`
 * already paid for: interpolating authored joint POSITIONS between a floor
 * pose and a lockout pose stretches bones. So:
 *
 *     bone lengths           authored, ONE pair each (`ARM`, `LEG`)
 *     shoulder / hip         authored per pose, lerped
 *     hand                   THE BAR — not a landmark of its own
 *     ankle                  planted
 *     elbow / knee           solved, `solveJoint`
 *
 * Draw order, back to front:
 *
 *     far plates
 *     far arm
 *     far leg
 *     torso, singlet, belt
 *     near leg
 *     head
 *     shaft
 *     near plates
 *     near arm, grip stub, hand
 *     despeckle, face marks, outline
 *
 * The near hand is drawn last on purpose, same cheat as the bench: a 25 kg
 * disc hides a strict sagittal grip, and a lifter who never touches the bar
 * is worse than a projection that is not textbook.
 */

import { CENTER_X, DEADLIFT_PULL, RESOLUTION, SHADING, SHADOW, STRAIN } from './spriteTuning';
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

const HAIR_RX_INSET = 1.2;

interface DeadliftAnchors {
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
  readonly ankleX: number;
  readonly ankleY: number;
}

interface DeadliftLandmarks extends DeadliftAnchors {
  readonly elbowX: number;
  readonly elbowY: number;
  readonly handX: number;
  readonly handY: number;
  readonly kneeX: number;
  readonly kneeY: number;
  readonly barX: number;
  readonly barY: number;
}

const FIGURE = {
  FAR_DX: 3,
  FAR_DY: 1,
  PLATE_STACK_DX: 2,
  PLATE_STACK_DY: 1,
  ARM_R: { UPPER: [3.0, 2.4] as const, FORE: [2.4, 2.0] as const },
  LEG_R: { THIGH: [5.0, 4.0] as const, SHIN: [3.0, 2.4] as const },
  HAND_R: 2.2,
  GRIP_STUB_PX: 6,
  SHOE_RX: 4.4,
  SHOE_RY: 2.0,
  TORSO_R: { SHOULDER: 6.4, HIP: 7.2 },
  NECK_R: 2.2,
  COLLAR_R: 2.4,
  SHAFT_HALF: 4,
  SHAFT_THICK: 2,
  HAIR_RY_INSET: 0.2,
  HAIR_DX: 3,
  HAIR_DY: -1,
  EYE_DX: -4,
  EYE_DY: -1,
  BELT: { BACK: 4, FRONT: 4, RISE: 3, DROP: 2 },
  COMPAT: {
    SHOULDER_HALF: 4,
    WAIST_HALF: 5,
    HIP_HALF: 5,
    KNEE_HALF: 6,
    ANKLE_HALF: 8,
    ELBOW_HALF: 5,
    HAND_HALF: 4,
  },
  EMPTY_BAR_RADIUS_PX: 1,
} as const;

/**
 * THE BAR'S OWN GEOMETRY. One column, two heights. The column is a single
 * number rather than a field on each pose — which is what makes "the bar path
 * is vertical and over the midfoot" a property of the representation.
 *
 * LOCKOUT_Y is at the hip, not overhead. A deadlift finishes when the hips
 * and knees are extended, with the bar in the hands against the thighs.
 */
const BAR = {
  X: 42,
  LOCKOUT_Y: 40,
} as const;

const ARM = {
  UPPER_PX: 9.5,
  FORE_PX: 11.5,
  /** +1 folds the elbow toward the hip (behind the bar). -1 is a curl. */
  SIDE: 1,
} as const;

const LEG = {
  THIGH_PX: 16,
  SHIN_PX: 16,
  /** +1 puts the knee toward the bar (forward). -1 is a sitting hinge. */
  SIDE: 1,
} as const;

/**
 * Floor start: hips HIGH and BACK, torso folded, bar on the floor in the
 * hands. This is the silhouette that is not a squat.
 */
const SETUP: DeadliftAnchors = {
  headX: 24,
  headY: 28,
  headRx: 5.8,
  headRy: 5.0,
  neckX: 33,
  neckY: 35,
  shoulderX: 42,
  shoulderY: 40,
  hipX: 60,
  hipY: 40,
  ankleX: 50,
  ankleY: 66,
};

/**
 * Lockout: knees and hips extended, bar in the hands at the hip, a finished
 * pull waiting on DOWN.
 */
const LOCKOUT: DeadliftAnchors = {
  headX: 38,
  headY: 12,
  headRx: 5.8,
  headRy: 5.0,
  neckX: 42,
  neckY: 18,
  shoulderX: 44,
  shoulderY: 20,
  hipX: 48,
  hipY: 36,
  ankleX: 50,
  ankleY: 66,
};

const IK = {
  HALF_DIVISOR: 2,
  MIN_SEPARATION_PX: 0.001,
} as const;

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

function solveJoint(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  proximalPx: number,
  distalPx: number,
  side: number,
): Point {
  const dx = bx - ax;
  const dy = by - ay;
  const d = Math.hypot(dx, dy);
  if (d < IK.MIN_SEPARATION_PX) return { x: ax + proximalPx, y: ay };

  const ux = dx / d;
  const uy = dy / d;
  const nx = -uy * side;
  const ny = ux * side;

  const along = (d * d + proximalPx * proximalPx - distalPx * distalPx) / (IK.HALF_DIVISOR * d);
  const acrossSq = proximalPx * proximalPx - along * along;
  if (acrossSq <= 0) return { x: ax + ux * proximalPx, y: ay + uy * proximalPx };

  const across = Math.sqrt(acrossSq);
  return { x: ax + ux * along + nx * across, y: ay + uy * along + ny * across };
}

function poseFor(height: number, barX: number, barY: number): DeadliftLandmarks {
  const t = clamp01(height);
  const shoulderX = mix(SETUP.shoulderX, LOCKOUT.shoulderX, t);
  const shoulderY = mix(SETUP.shoulderY, LOCKOUT.shoulderY, t);
  const hipX = mix(SETUP.hipX, LOCKOUT.hipX, t);
  const hipY = mix(SETUP.hipY, LOCKOUT.hipY, t);
  const ankleX = mix(SETUP.ankleX, LOCKOUT.ankleX, t);
  const ankleY = mix(SETUP.ankleY, LOCKOUT.ankleY, t);
  const elbow = solveJoint(shoulderX, shoulderY, barX, barY, ARM.UPPER_PX, ARM.FORE_PX, ARM.SIDE);
  const knee = solveJoint(hipX, hipY, ankleX, ankleY, LEG.THIGH_PX, LEG.SHIN_PX, LEG.SIDE);
  return {
    headX: mix(SETUP.headX, LOCKOUT.headX, t),
    headY: mix(SETUP.headY, LOCKOUT.headY, t),
    headRx: mix(SETUP.headRx, LOCKOUT.headRx, t),
    headRy: mix(SETUP.headRy, LOCKOUT.headRy, t),
    neckX: mix(SETUP.neckX, LOCKOUT.neckX, t),
    neckY: mix(SETUP.neckY, LOCKOUT.neckY, t),
    shoulderX,
    shoulderY,
    elbowX: elbow.x,
    elbowY: elbow.y,
    handX: barX,
    handY: barY,
    hipX,
    hipY,
    kneeX: knee.x,
    kneeY: knee.y,
    ankleX,
    ankleY,
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

function plateRadiusPx(totalKg: number, barKg: number): number {
  const stack = visualPlateStack(totalKg, barKg);
  let maxD = FIGURE.EMPTY_BAR_RADIUS_PX * 2;
  for (const plate of stack.perSide) {
    if (plate.diameterPx > maxD) maxD = plate.diameterPx;
  }
  return maxD / 2;
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
    x += dir * FIGURE.PLATE_STACK_DX;
    y += dir * FIGURE.PLATE_STACK_DY;
  }
  drawEllipsoid(g, barX, barY, FIGURE.COLLAR_R, FIGURE.COLLAR_R, RAMPS.CHROME, {
    edge: true,
    lightScale,
  });
}

function drawShaft(g: IndexGrid, barX: number, barY: number): void {
  drawLimb(
    g,
    barX - FIGURE.SHAFT_HALF,
    barY,
    barX + FIGURE.SHAFT_HALF,
    barY,
    FIGURE.SHAFT_THICK,
    FIGURE.SHAFT_THICK,
    RAMPS.SHAFT,
    { edge: true, axial: SHADING.AXIAL_FLAT },
  );
}

function drawArm(
  g: IndexGrid,
  pose: DeadliftLandmarks,
  far: boolean,
  skin: typeof RAMPS.SKIN,
): void {
  const dx = far ? FIGURE.FAR_DX : 0;
  const dy = far ? FIGURE.FAR_DY : 0;
  const lightScale = far ? SHADING.FAR_LIMB_LIGHT_SCALE : 1;
  const opts = { edge: true as const, lightScale, axial: SHADING.AXIAL_LIMB };
  drawLimbChain(g, [
    {
      ax: pose.shoulderX + dx,
      ay: pose.shoulderY + dy,
      bx: pose.elbowX + dx,
      by: pose.elbowY + dy,
      ra: FIGURE.ARM_R.UPPER[0],
      rb: FIGURE.ARM_R.UPPER[1],
      ramp: skin,
      opts,
    },
    {
      ax: pose.elbowX + dx,
      ay: pose.elbowY + dy,
      bx: pose.handX + dx,
      by: pose.handY + dy,
      ra: FIGURE.ARM_R.FORE[0],
      rb: FIGURE.ARM_R.FORE[1],
      ramp: skin,
      opts,
    },
  ]);
}

function drawHand(
  g: IndexGrid,
  pose: DeadliftLandmarks,
  far: boolean,
  skin: typeof RAMPS.SKIN,
): void {
  const dx = far ? FIGURE.FAR_DX : 0;
  const dy = far ? FIGURE.FAR_DY : 0;
  drawEllipsoid(
    g,
    pose.handX + dx,
    pose.handY + dy,
    FIGURE.HAND_R,
    FIGURE.HAND_R,
    skin,
    { edge: true, lightScale: far ? SHADING.FAR_LIMB_LIGHT_SCALE : 1 },
  );
}

function drawGrip(g: IndexGrid, pose: DeadliftLandmarks, skin: typeof RAMPS.SKIN): void {
  const dx = pose.handX - pose.elbowX;
  const dy = pose.handY - pose.elbowY;
  const len = Math.hypot(dx, dy);
  if (len > IK.MIN_SEPARATION_PX) {
    const back = Math.min(FIGURE.GRIP_STUB_PX, len) / len;
    drawLimb(
      g,
      pose.handX - dx * back,
      pose.handY - dy * back,
      pose.handX,
      pose.handY,
      FIGURE.ARM_R.FORE[1],
      FIGURE.ARM_R.FORE[1],
      skin,
      { edge: true, axial: SHADING.AXIAL_LIMB },
    );
  }
  drawHand(g, pose, false, skin);
}

function drawLeg(
  g: IndexGrid,
  pose: DeadliftLandmarks,
  far: boolean,
  skin: typeof RAMPS.SKIN,
): void {
  const dx = far ? FIGURE.FAR_DX : 0;
  const dy = far ? FIGURE.FAR_DY : 0;
  const lightScale = far ? SHADING.FAR_LIMB_LIGHT_SCALE : 1;
  const opts = { edge: true as const, lightScale, axial: SHADING.AXIAL_LEG };
  drawLimb(
    g,
    pose.hipX + dx,
    pose.hipY + dy,
    pose.kneeX + dx,
    pose.kneeY + dy,
    FIGURE.LEG_R.THIGH[0],
    FIGURE.LEG_R.THIGH[1],
    skin,
    opts,
  );
  drawLimb(
    g,
    pose.kneeX + dx,
    pose.kneeY + dy,
    pose.ankleX + dx,
    pose.ankleY + dy,
    FIGURE.LEG_R.SHIN[0],
    FIGURE.LEG_R.SHIN[1],
    skin,
    opts,
  );
  drawEllipsoid(
    g,
    pose.ankleX + dx + 1,
    pose.ankleY + dy + 1,
    FIGURE.SHOE_RX,
    FIGURE.SHOE_RY,
    RAMPS.GEAR,
    { edge: true, axial: SHADING.AXIAL_FLAT, lightScale },
  );
}

function drawBody(g: IndexGrid, pose: DeadliftLandmarks, skin: typeof RAMPS.SKIN): void {
  drawLeg(g, pose, true, skin);
  drawLimb(
    g,
    pose.shoulderX,
    pose.shoulderY,
    pose.hipX,
    pose.hipY,
    FIGURE.TORSO_R.SHOULDER,
    FIGURE.TORSO_R.HIP,
    RAMPS.SINGLET,
    { edge: true, axial: SHADING.AXIAL_TRUNK },
  );
  drawLeg(g, pose, false, skin);
  fillRect(
    g,
    pose.hipX - FIGURE.BELT.BACK,
    pose.hipY - FIGURE.BELT.RISE,
    pose.hipX + FIGURE.BELT.FRONT,
    pose.hipY + FIGURE.BELT.DROP,
    PAL.GEAR_DARK,
  );
}

function drawHead(g: IndexGrid, pose: DeadliftLandmarks, skin: typeof RAMPS.SKIN): void {
  drawLimb(
    g,
    pose.neckX,
    pose.neckY,
    pose.shoulderX,
    pose.shoulderY,
    FIGURE.NECK_R,
    FIGURE.NECK_R,
    skin,
    { edge: true, axial: SHADING.AXIAL_LIMB },
  );
  drawEllipsoid(g, pose.headX, pose.headY, pose.headRx, pose.headRy, skin, {
    edge: true,
    stepBias: SHADING.HEAD_STEP_BIAS,
  });
  drawEllipsoid(
    g,
    pose.headX + FIGURE.HAIR_DX,
    pose.headY + FIGURE.HAIR_DY,
    pose.headRx - HAIR_RX_INSET,
    pose.headRy - FIGURE.HAIR_RY_INSET,
    RAMPS.HAIR,
    { edge: true },
  );
}

function stampFace(g: IndexGrid, pose: DeadliftLandmarks): void {
  const eyeX = Math.round(pose.headX + FIGURE.EYE_DX);
  const eyeY = Math.round(pose.headY + FIGURE.EYE_DY);
  setPx(g, eyeX, eyeY, PAL.OUTLINE);
  setPx(g, eyeX, eyeY + 1, PAL.OUTLINE);
  setPx(g, eyeX - 1, eyeY + 2, PAL.SKIN_SHADOW);
}

function squatCompatiblePose(pose: DeadliftLandmarks): Pose {
  return {
    headY: pose.headY,
    headDx: pose.headX - CENTER_X,
    neckY: pose.neckY,
    shoulderY: pose.shoulderY,
    shoulderHalfW: FIGURE.COMPAT.SHOULDER_HALF,
    chestY: pose.shoulderY,
    waistY: pose.hipY,
    waistHalfW: FIGURE.COMPAT.WAIST_HALF,
    hipY: pose.hipY,
    hipHalfW: FIGURE.COMPAT.HIP_HALF,
    kneeY: pose.kneeY,
    kneeHalfW: FIGURE.COMPAT.KNEE_HALF,
    ankleY: pose.ankleY,
    ankleHalfW: FIGURE.COMPAT.ANKLE_HALF,
    elbowY: pose.elbowY,
    elbowHalfW: FIGURE.COMPAT.ELBOW_HALF,
    handY: pose.handY,
    handHalfW: FIGURE.COMPAT.HAND_HALF,
  };
}

export interface DeadliftRender {
  readonly grid: IndexGrid;
  readonly pose: Pose;
  readonly barCenterY: number;
  readonly landmarks: DeadliftLandmarks;
}

export const DEADLIFT_GEOMETRY = Object.freeze({ ARM, BAR, FIGURE, LEG, SETUP, LOCKOUT });

/** Bar centre y for a normalised height, after strain shortens lockout. */
export function deadliftBarY(height: number, strainLevel: number, totalKg: number, barKg: number): number {
  const t = clamp01(height);
  const floorY = RESOLUTION.FLOOR_Y - plateRadiusPx(totalKg, barKg);
  const drop = strainForLevel(strainLevel) * DEADLIFT_PULL.STRAIN_LOCKOUT_DROP_PX * t;
  return mix(floorY, BAR.LOCKOUT_Y, t) + drop;
}

export function renderDeadliftContactShadow(pose: Pose, depth: number): IndexGrid {
  const g = createGrid(RESOLUTION.CELL_W, RESOLUTION.CELL_H);
  const halfW =
    (SHADOW.BASE_HALF_W_PX + SHADOW.STANCE_GAIN * pose.ankleHalfW) *
    (1 - (1 - SHADOW.DEPTH_SHRINK) * Math.min(1, Math.max(0, depth)));
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

export function deadliftPoseForSpec(spec: LifterFrameSpec): Pose {
  const height = clamp01(spec.height ?? 1 - spec.depth);
  const barKg = spec.barKg ?? BAR_AND_COLLARS_KG;
  const barY = deadliftBarY(height, spec.strainLevel, spec.totalKg, barKg);
  const barX = BAR.X + spec.barLateralPx;
  return squatCompatiblePose(poseFor(height, barX, barY));
}

/** Render one pull frame to an index grid with a transparent background. */
export function renderDeadliftFrame(spec: LifterFrameSpec): DeadliftRender {
  const height = clamp01(spec.height ?? 1 - spec.depth);
  const barKg = spec.barKg ?? BAR_AND_COLLARS_KG;
  const barY = deadliftBarY(height, spec.strainLevel, spec.totalKg, barKg);
  const barX = BAR.X + spec.barLateralPx;
  const pose = poseFor(height, barX, barY);
  const skin = strainForLevel(spec.strainLevel) > STRAIN.FLUSH_THRESHOLD ? RAMPS.SKIN_FLUSHED : RAMPS.SKIN;

  const g = createGrid(RESOLUTION.CELL_W, RESOLUTION.CELL_H);

  drawPlates(g, barX, barY, spec.totalKg, barKg, false);
  drawArm(g, pose, true, skin);
  drawHand(g, pose, true, skin);
  drawBody(g, pose, skin);
  drawHead(g, pose, skin);
  drawShaft(g, barX, barY);
  drawPlates(g, barX, barY, spec.totalKg, barKg, true);
  drawArm(g, pose, false, skin);
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
