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
 */
export const RIG_GEOMETRY = {
  HEAD_RX: 3.6,
  HEAD_RY: 4.4,
  /** The face is the smallest thing that has to read; it gets lifted a step. */
  HEAD_STEP_BIAS: 1,
  HAIR_RY: 2.2,
  EYE_DX: 1.7,
  EYE_DY: 1,
  MOUTH_DY: 3,
  NECK_R: 2.3,
  NECK_OVERLAP: 1,

  UPPER_ARM_R: [2.7, 2.1] as const,
  FOREARM_R: [2.0, 1.7] as const,
  HAND_R: 1.9,
  THIGH_R: [4.3, 3.1] as const,
  SHIN_R: [2.9, 1.9] as const,

  FOOT_W: 9,
  FOOT_H: 3,
  FOOT_DROP: 1,
  FOOT_FLARE: 0.5,

  /** Belt height, centred on waistY, and how far it stands off the waist. */
  BELT_H: 3,
  BELT_OVERHANG: 1.1,

  /** Knee sleeve: fractions along thigh and shin, plus its radii. */
  KNEE_SLEEVE: {
    TOWARD_HIP: 0.26,
    TOWARD_ANKLE: 0.24,
    R: [3.2, 2.9] as const,
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
    /** Singlet hem below the hip landmark. */
    SINGLET_HEM: 3,
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
    /** Sternum notch, above the singlet's top edge. */
    STERNUM_LIFT: 1,
  },

  /** One hand grips this much wider than the other. */
  GRIP_ASYMMETRY_PX: 1,
} as const;

/** Bar centre-line for a pose: it rides the traps, so it tracks the shoulders. */
export function barYForPose(pose: Pose): number {
  return pose.shoulderY - BAR.SHOULDER_OFFSET_PX;
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
