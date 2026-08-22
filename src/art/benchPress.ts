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
 * Draw order, back to front:
 *
 *     far plates
 *     far arm
 *     bench pad and legs
 *     far leg, torso, near leg
 *     head
 *     near arm, hands
 *     near plates (the read of the load)
 *     despeckle, face marks, outline
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

/** Hair cap inset, copied in kind from the squat sprite — not a feel knob. */
const HAIR_RX_INSET = 0.1;

/**
 * Authored landmarks for one side-on press drawing.
 *
 * Units are sprite pixels in the 96×72 cell. Head is LEFT, feet RIGHT — the
 * conventional sagittal view of a press. `barX`/`barY` are the near-sleeve
 * centre, where the plate faces sit.
 */
interface BenchLandmarks {
  readonly headX: number;
  readonly headY: number;
  readonly headRx: number;
  readonly headRy: number;
  readonly neckX: number;
  readonly neckY: number;
  readonly shoulderX: number;
  readonly shoulderY: number;
  readonly elbowX: number;
  readonly elbowY: number;
  readonly handX: number;
  readonly handY: number;
  readonly hipX: number;
  readonly hipY: number;
  readonly kneeX: number;
  readonly kneeY: number;
  readonly ankleX: number;
  readonly ankleY: number;
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
  SHOE_RX: 4.2,
  SHOE_RY: 2.0,
  TORSO_R: { SHOULDER: 6.2, HIP: 7.0 },
  NECK_R: 2.2,
  COLLAR_R: 2.4,
  SHAFT_HALF: 4,
  SHAFT_THICK: 2,
  HAIR_RY_INSET: 0.4,
  HAIR_DX: 1,
  HAIR_DY: 1,
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
 * Bar on the chest, elbows dropped. This is HOLE, and the pose the command
 * fires against.
 */
const CHEST: BenchLandmarks = {
  headX: 20,
  headY: 43,
  headRx: 6.0,
  headRy: 5.0,
  neckX: 27,
  neckY: 47,
  shoulderX: 33,
  shoulderY: 48,
  elbowX: 22,
  elbowY: 54,
  handX: 39,
  handY: 41,
  hipX: 54,
  hipY: 50,
  kneeX: 68,
  kneeY: 43,
  ankleX: 76,
  ankleY: 66,
  barX: 38,
  barY: 40,
};

/**
 * Arms long, bar at lockout. Feet stay planted; the hips stay on the pad.
 */
const LOCKOUT: BenchLandmarks = {
  headX: 20,
  headY: 42,
  headRx: 6.0,
  headRy: 5.0,
  neckX: 27,
  neckY: 46,
  shoulderX: 33,
  shoulderY: 47,
  elbowX: 36,
  elbowY: 31,
  handX: 39,
  handY: 18,
  hipX: 54,
  hipY: 50,
  kneeX: 68,
  kneeY: 43,
  ankleX: 76,
  ankleY: 66,
  barX: 38,
  barY: 17,
};

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function poseAtHeight(height: number): BenchLandmarks {
  const t = clamp01(height);
  return {
    headX: mix(CHEST.headX, LOCKOUT.headX, t),
    headY: mix(CHEST.headY, LOCKOUT.headY, t),
    headRx: mix(CHEST.headRx, LOCKOUT.headRx, t),
    headRy: mix(CHEST.headRy, LOCKOUT.headRy, t),
    neckX: mix(CHEST.neckX, LOCKOUT.neckX, t),
    neckY: mix(CHEST.neckY, LOCKOUT.neckY, t),
    shoulderX: mix(CHEST.shoulderX, LOCKOUT.shoulderX, t),
    shoulderY: mix(CHEST.shoulderY, LOCKOUT.shoulderY, t),
    elbowX: mix(CHEST.elbowX, LOCKOUT.elbowX, t),
    elbowY: mix(CHEST.elbowY, LOCKOUT.elbowY, t),
    handX: mix(CHEST.handX, LOCKOUT.handX, t),
    handY: mix(CHEST.handY, LOCKOUT.handY, t),
    hipX: mix(CHEST.hipX, LOCKOUT.hipX, t),
    hipY: mix(CHEST.hipY, LOCKOUT.hipY, t),
    kneeX: mix(CHEST.kneeX, LOCKOUT.kneeX, t),
    kneeY: mix(CHEST.kneeY, LOCKOUT.kneeY, t),
    ankleX: mix(CHEST.ankleX, LOCKOUT.ankleX, t),
    ankleY: mix(CHEST.ankleY, LOCKOUT.ankleY, t),
    barX: mix(CHEST.barX, LOCKOUT.barX, t),
    barY: mix(CHEST.barY, LOCKOUT.barY, t),
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
  fillRect(g, pose.hipX - 2, pose.hipY - 1, pose.hipX + 1, pose.hipY + 1, PAL.GEAR_DARK);
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
    pose.headY - BENCH.HAIR_DY,
    pose.headRx - HAIR_RX_INSET,
    pose.headRy - BENCH.HAIR_RY_INSET,
    RAMPS.HAIR,
    { edge: true },
  );
}

function stampFace(g: IndexGrid, pose: BenchLandmarks): void {
  // Two stacked pixels so despeckle cannot eat the eye. Looking UP, toward
  // the bar — that is the whole reason this is a press and not a nap.
  const eyeX = Math.round(pose.headX + 2);
  const eyeY = Math.round(pose.headY - 1);
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

/** Bar centre y for a normalised height, after strain shortens lockout. */
export function benchBarY(height: number, strainLevel: number = 0): number {
  const pose = poseAtHeight(height);
  const drop = strainForLevel(strainLevel) * BENCH_PRESS.STRAIN_LOCKOUT_DROP_PX * clamp01(height);
  return pose.barY + drop;
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
  const pose = poseAtHeight(height);
  const drop = strainForLevel(spec.strainLevel) * BENCH_PRESS.STRAIN_LOCKOUT_DROP_PX * height;
  const barY = pose.barY + drop;
  const barX = pose.barX + spec.barLateralPx;
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
  drawHand(g, pose, false, skin);
  drawPlates(g, barX, barY, spec.totalKg, barKg, true);

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
