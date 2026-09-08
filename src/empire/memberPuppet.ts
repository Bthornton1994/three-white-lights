/**
 * memberPuppet.ts — THE AUTHORED DRAWINGS of VL-3's cut-out puppet: the
 * part atlas over the two Iron & Amber paintings and the keyframes that
 * pose it. Claude Code Session B owns it (CLAUDE.md, "VL-3").
 *
 * THIS FILE IS HAND-AUTHORED ART DATA, in the sense `src/art/rig.ts` gives
 * the phrase. Every number here is a coordinate read off a painting's
 * pixels (a polygon vertex, a joint pivot, a sole point) or a pose a
 * limb is drawn at (a keyframe angle, a bar offset). None of them is a
 * knob: a pivot cannot move without the polygon around it being re-cut,
 * and a contact-pose thigh angle cannot be turned without the whole gait
 * being re-authored against it. What CAN be turned without redrawing —
 * tolerances, the ground inset, the far-limb shade, the breath and sway
 * amplitudes — lives in `empireTuning.ts` under `FLOOR_MEMBER_MOTION_*`.
 *
 * `src/tuning/audit.ts` does not yet register this file as a `data`
 * constants home the way it registers `src/art/rig.ts`, so its literals
 * fire the magic-number audit until a row is added there. That row is
 * Session A's to add (CLAUDE.md, "The one place the two sessions genuinely
 * touch"); this header exists so the row's `why:` can quote it.
 *
 * Pure module: zero React, zero I/O, no pixels. The bake reads it through
 * Node's type stripping; `memberRig.ts` poses it; `memberRig.test.ts`
 * grades the poses. Nothing here decides anything a member does.
 *
 * COORDINATES. Polygons, pivots, tips and sole points are SOURCE pixels of
 * the painting the part is cut from (x right, y down, origin top-left).
 * Bone angles are ABSOLUTE degrees on screen for the authored RIGHT facing:
 * 0 is straight down, positive turns the bone's distal end toward the
 * facing direction (+x), so 90 points forward, 180 straight up, 270 back.
 * The rig rotates each part by (authored angle − its source rest angle),
 * where the rest angle is read from pivot → tip. A part's `attach` is
 * where its pivot sits in its PARENT's source pixels; it equals the pivot
 * unless the part borrows another part's drawing (both legs use the near
 * leg's, so the far leg's attach is the far hip while its pivot is the
 * near hip in the drawing it borrows).
 *
 * WHY THE FAR LEG BORROWS THE NEAR LEG'S DRAWING. The painting's far leg is
 * mid toe-off — heel lifted, foreshortened — and its near leg is heel-down
 * at contact. Cutting each as its own part gives two feet of different
 * length and sole geometry, and a walk whose second step cannot mirror its
 * first. One drawing for both, the far copy shaded by
 * `FLOOR_MEMBER_MOTION_FAR_LIMB_SHADE`, makes the half-cycles exact
 * mirrors. The arms keep their own drawings: the near sleeve is the tee's
 * silhouette and the far arm hangs behind the torso where its length
 * matters less than its shading.
 */

import { EMPIRE_TUNING } from './empireTuning';

export type PuppetSource = 'member-walk-a-right' | 'member-using-bench-a-right';
export type PuppetPointTuple = readonly [number, number];
export type PuppetPolygon = readonly PuppetPointTuple[];

export interface PuppetFill {
  /** Source rectangle [x0, y0, x1, y1), exclusive maxima, to overpaint. */
  readonly rect: readonly [number, number, number, number];
  /** Which side's nearest opaque in-polygon pixel each row copies from. */
  readonly from: 'left' | 'right';
}

export interface PuppetPart {
  readonly name: string;
  /** `null` is the puppet's virtual root joint. */
  readonly parent: string | null;
  /** Regions of the source cut for this part, in source pixels. Union. */
  readonly polygons: readonly PuppetPolygon[];
  /** The joint the part hangs from, in its own source pixels. */
  readonly pivot: PuppetPointTuple;
  /** Where the pivot sits in the parent's source pixels (the root's, for a root child). */
  readonly attach: PuppetPointTuple;
  /** The distal joint or endpoint; pivot → tip is the source rest direction. */
  readonly tip: PuppetPointTuple;
  /** Translates with an authored offset instead of rotating (the bar). */
  readonly free?: boolean;
  /** Drawn with the far-limb shade applied. */
  readonly far?: boolean;
  /** Foot parts: the heel and the ball of the sole, source pixels, for planting. */
  readonly sole?: { readonly heel: PuppetPointTuple; readonly ball: PuppetPointTuple };
  /** Occlusion fills applied to the cut before it is posed. */
  readonly fills?: readonly PuppetFill[];
}

/**
 * A garment recolour by QUANTILE MATCHING (art round 2): every pixel of the
 * target region is ranked by luminance among the region's pixels and given
 * the colour at the same rank in the reference garment's pixels. The
 * result carries the reference cloth's own colours AND its own contrast
 * range — the darkest fold of the tank becomes the darkest fold of the tee,
 * its median its median — with no authored shadow / lit pair and no gamma.
 * Round 1 remapped the tank's luminance through a gamma onto two typed
 * colours and it read as flat cream with an orange rim; the measured tee
 * is (228, 211, 174) at its tenth percentile and (246, 221, 180) at its
 * median, which the bake now reads off the painting rather than trusting.
 */
export interface PuppetRecolour {
  /** Region of the source, in source pixels, to recolour: the garment, cut as tight as the painting allows. */
  readonly polygon: PuppetPolygon;
  /**
   * Pixels inside the polygon that are skin rather than cloth are left
   * alone: warm (red − blue at least `minChroma`) AND lit (luminance at
   * least `minLuminance`). The garment's own warm rim light is darker than
   * this and is remapped as its brightest cloth, which is what it is.
   */
  readonly skin: { readonly minChroma: number; readonly minLuminance: number };
  /** The garment whose colours are borrowed. */
  readonly reference: {
    readonly source: PuppetSource;
    /** Regions of the reference painting, in its source pixels, that hold the garment. Union. */
    readonly polygons: readonly PuppetPolygon[];
    /**
     * Cloth classifier inside those regions: blue at least `minBlueOverRed`
     * of red (skin is far warmer) and luminance at least `minLuminance`
     * (the joggers' waistband is darker). Only pixels passing it are the
     * reference distribution.
     */
    readonly cloth: { readonly minBlueOverRed: number; readonly minLuminance: number };
  };
}

export interface PuppetIkChain {
  readonly upper: string;
  readonly fore: string;
  /** The grip: a point on `part`, in that part's source pixels. */
  readonly target: { readonly part: string; readonly point: PuppetPointTuple };
  /** Which side of the shoulder → target line the elbow bends to: +1 is the normal (−dy, dx) side. */
  readonly bend: 1 | -1;
}

export interface Puppet {
  readonly source: PuppetSource;
  /** The painting's square side in source pixels. */
  readonly size: number;
  /** The virtual root joint (the pelvis) in source pixels. */
  readonly rootPivot: PuppetPointTuple;
  /** Back to front. */
  readonly parts: readonly PuppetPart[];
  /** Left ↔ right part pairs, for mirroring a half gait cycle. */
  readonly mirror: readonly (readonly [string, string])[];
  readonly recolour?: PuppetRecolour;
  readonly ik?: readonly PuppetIkChain[];
}

export type PuppetEase = 'linear' | 'in-out' | 'in' | 'out';

export interface PuppetKey {
  /** Position in the segment, 0..1. */
  readonly t: number;
  /** Easing of the interval that ENDS at this key. Ignored on the first key. */
  readonly ease: PuppetEase;
  /** Absolute bone angles, degrees, for every rotating part of the puppet. */
  readonly angles: Readonly<Record<string, number>>;
  /** Root position in CANVAS pixels; the rig may solve x and y from planting. */
  readonly root: PuppetPointTuple;
  /** Translation from rest, source pixels, for each free part. */
  readonly offsets?: Readonly<Record<string, PuppetPointTuple>>;
}

export interface PuppetPlantRun {
  /** Frames [fromFrame, toFrame) of the segment during which `foot` is on the ground and fixed. */
  readonly fromFrame: number;
  readonly toFrame: number;
  readonly foot: string;
  /**
   * The frame whose authored root x is trusted; every other frame of the
   * run is solved forward or backward from it so the foot's ball keeps
   * one world x. A clip that must END centred anchors its last frame.
   */
  readonly anchorFrame: number;
}

export interface PuppetPlant {
  readonly runs: readonly PuppetPlantRun[];
  /** Solve each frame's sample time so the reference foot retreats uniformly (the walk). */
  readonly retime: boolean;
}

export interface PuppetSegment {
  readonly puppet: 'walker' | 'presser';
  /** Frames [from, to) of the clip this segment authors. */
  readonly frames: readonly [number, number];
  /** Sample times wrap (t = k / n) rather than end on the last key (t = k / (n − 1)). */
  readonly cyclic: boolean;
  /** Append the keys again at t + ½ with left/right parts swapped. */
  readonly mirrorSecondHalf: boolean;
  /**
   * `body`: the baked frame pins the root x to the canvas centre and the
   * planting solve is reported as `rootAdvance` for the runtime to apply
   * (the walk and every standing clip — the runtime moves the body).
   * `world`: the solved or authored root x is drawn where it is and the
   * advance is zero (the bench clips — the bench is fixed in the canvas
   * and the runtime holds the body on it).
   */
  readonly frame: 'body' | 'world';
  readonly keys: readonly PuppetKey[];
  /** Foot planting; null when no foot touches the floor (the presser). */
  readonly plant: PuppetPlant | null;
}

// ---------------------------------------------------------------------------
// THE WALKER — `member-walk-a-right.png`, 246 px square. A man mid-stride
// facing right: beige tee, dark joggers, white trainers. Landmarks read off
// the pixels (an alpha/colour-class dump at 3 px, then the 3× grid view):
// crown y 9, neck (124,44), far shoulder (94,64) → elbow (86,100) → hand
// (84,136), near shoulder (146,66) → elbow (150,96) → hand (170,126),
// hips at y 120 (near 126, far 116), near knee (137,168) → ankle (148,212),
// near sole heel (141,233) to toe (172,229), lowest pixel y 236.
// ---------------------------------------------------------------------------

const WALKER_SIZE = 246;
const WALKER_ROOT: PuppetPointTuple = [121, 120];
const NEAR_HIP: PuppetPointTuple = [126, 120];
/** The far hip shares the near hip's x: in a side view the hips differ in depth, not along the stride, and an x offset here is a limp (measured: 10 px gave alternating 98 / 118 px steps). */
const FAR_HIP: PuppetPointTuple = [126, 120];
const NEAR_KNEE: PuppetPointTuple = [137, 168];
const NEAR_ANKLE: PuppetPointTuple = [148, 212];
const NEAR_TOE: PuppetPointTuple = [176, 227];

const THIGH_POLYGON: PuppetPolygon = [
  [116, 108],
  [140, 108],
  [147, 118],
  [148, 140],
  [146, 174],
  [120, 174],
  [114, 150],
  [110, 126],
];
const SHIN_POLYGON: PuppetPolygon = [
  [122, 158],
  [150, 158],
  [153, 190],
  [155, 216],
  [138, 216],
  [130, 200],
  [122, 180],
];
const FOOT_POLYGON: PuppetPolygon = [
  [136, 204],
  [156, 204],
  [178, 220],
  [180, 232],
  [162, 239],
  [140, 239],
  [136, 224],
];
const SOLE = { heel: [141, 234] as const, ball: [163, 231] as const };

export const WALKER: Puppet = Object.freeze<Puppet>({
  source: 'member-walk-a-right',
  size: WALKER_SIZE,
  rootPivot: WALKER_ROOT,
  mirror: [
    ['nearThigh', 'farThigh'],
    ['nearShin', 'farShin'],
    ['nearFoot', 'farFoot'],
    ['nearUpperArm', 'farUpperArm'],
    ['nearForearm', 'farForearm'],
  ],
  parts: [
    {
      name: 'farUpperArm',
      parent: 'torso',
      polygons: [[[84, 56], [102, 58], [100, 80], [96, 104], [80, 104], [80, 80]]],
      pivot: [94, 64],
      attach: [94, 64],
      tip: [86, 100],
      far: true,
    },
    {
      name: 'farForearm',
      parent: 'farUpperArm',
      polygons: [[[78, 92], [96, 92], [94, 120], [92, 140], [76, 140], [76, 120]]],
      pivot: [86, 100],
      attach: [86, 100],
      tip: [84, 136],
      far: true,
    },
    {
      name: 'farThigh',
      parent: null,
      polygons: [THIGH_POLYGON],
      pivot: NEAR_HIP,
      attach: FAR_HIP,
      tip: NEAR_KNEE,
      far: true,
    },
    {
      name: 'farShin',
      parent: 'farThigh',
      polygons: [SHIN_POLYGON],
      pivot: NEAR_KNEE,
      attach: NEAR_KNEE,
      tip: NEAR_ANKLE,
      far: true,
    },
    {
      name: 'farFoot',
      parent: 'farShin',
      polygons: [FOOT_POLYGON],
      pivot: NEAR_ANKLE,
      attach: NEAR_ANKLE,
      tip: NEAR_TOE,
      far: true,
      sole: SOLE,
    },
    {
      name: 'nearThigh',
      parent: null,
      polygons: [THIGH_POLYGON],
      pivot: NEAR_HIP,
      attach: NEAR_HIP,
      tip: NEAR_KNEE,
    },
    {
      name: 'nearShin',
      parent: 'nearThigh',
      polygons: [SHIN_POLYGON],
      pivot: NEAR_KNEE,
      attach: NEAR_KNEE,
      tip: NEAR_ANKLE,
    },
    {
      name: 'nearFoot',
      parent: 'nearShin',
      polygons: [FOOT_POLYGON],
      pivot: NEAR_ANKLE,
      attach: NEAR_ANKLE,
      tip: NEAR_TOE,
      sole: SOLE,
    },
    {
      name: 'torso',
      parent: null,
      // The right edge runs UNDER the near sleeve (x ≈ 141), so the sleeve
      // belongs to the near upper arm and swings with it. The strip the
      // sleeve's inner edge leaves on the torso (the arm's dark boundary
      // line at x 139–143 below the sleeve hem) is filled from the shirt
      // to its left so a forward-swung arm reveals shirt, not a seam.
      polygons: [
        [
          [92, 40],
          [150, 40],
          [152, 56],
          [143, 62],
          [141, 100],
          [146, 116],
          [142, 130],
          [100, 130],
          [96, 116],
          [88, 100],
          [86, 60],
        ],
      ],
      pivot: WALKER_ROOT,
      attach: WALKER_ROOT,
      tip: [124, 44],
      fills: [{ rect: [139, 76, 143, 100], from: 'left' }],
    },
    {
      name: 'head',
      parent: 'torso',
      polygons: [[[112, 6], [146, 6], [148, 30], [140, 45], [118, 45], [112, 30]]],
      pivot: [124, 44],
      attach: [124, 44],
      tip: [128, 9],
    },
    {
      name: 'nearUpperArm',
      parent: 'torso',
      polygons: [[[134, 50], [156, 54], [160, 78], [156, 102], [140, 102], [136, 84], [132, 66]]],
      pivot: [146, 66],
      attach: [146, 66],
      tip: [150, 96],
    },
    {
      name: 'nearForearm',
      parent: 'nearUpperArm',
      polygons: [[[140, 88], [158, 88], [176, 112], [181, 130], [166, 135], [150, 116], [140, 104]]],
      pivot: [150, 96],
      attach: [150, 96],
      tip: [170, 126],
    },
  ],
});

// ---------------------------------------------------------------------------
// THE PRESSER — `member-using-bench-a-right.png`, 256 px square. A lying
// presser at lockout, three-quarter view, head left and feet right, no
// bench in the picture. Landmarks: near shoulder (100,112) → elbow (88,86)
// → hand (88,60); far shoulder (135,108) → elbow (143,76) → hand (147,45);
// bar from (24,82) to (206,30) through both grips; left plate x 33–72
// y 45–102, right plate x 159–200 y 15–60; pelvis about (180,152).
// ---------------------------------------------------------------------------

const PRESSER_SIZE = 256;
const PRESSER_ROOT: PuppetPointTuple = [180, 152];
const NEAR_GRIP: PuppetPointTuple = [88, 60];
const FAR_GRIP: PuppetPointTuple = [147, 45];

export const PRESSER: Puppet = Object.freeze<Puppet>({
  source: 'member-using-bench-a-right',
  size: PRESSER_SIZE,
  rootPivot: PRESSER_ROOT,
  mirror: [],
  parts: [
    {
      name: 'farUpperArm',
      parent: 'body',
      polygons: [[[128, 66], [154, 66], [154, 112], [126, 112]]],
      pivot: [135, 108],
      attach: [135, 108],
      tip: [143, 76],
    },
    {
      name: 'farForearm',
      parent: 'farUpperArm',
      polygons: [[[134, 34], [155, 34], [155, 84], [132, 84]]],
      pivot: [143, 76],
      attach: [143, 76],
      tip: FAR_GRIP,
    },
    {
      name: 'body',
      parent: null,
      polygons: [
        [
          [50, 104],
          [104, 104],
          [106, 90],
          [126, 90],
          [126, 104],
          [240, 104],
          [240, 212],
          [212, 214],
          [200, 200],
          [198, 246],
          [158, 246],
          [156, 196],
          [140, 160],
          [54, 140],
        ],
      ],
      pivot: PRESSER_ROOT,
      attach: PRESSER_ROOT,
      tip: [100, 112],
    },
    {
      name: 'bar',
      parent: 'body',
      free: true,
      polygons: [
        [[22, 76], [204, 24], [208, 36], [26, 88]],
        [[30, 44], [74, 44], [74, 104], [30, 104]],
        [[157, 12], [202, 12], [202, 64], [157, 64]],
      ],
      pivot: NEAR_GRIP,
      attach: NEAR_GRIP,
      tip: FAR_GRIP,
    },
    {
      name: 'nearUpperArm',
      parent: 'body',
      polygons: [[[74, 76], [104, 76], [106, 112], [92, 112], [84, 102], [74, 96]]],
      pivot: [100, 112],
      attach: [100, 112],
      tip: [88, 86],
    },
    {
      name: 'nearForearm',
      parent: 'nearUpperArm',
      polygons: [[[74, 50], [102, 50], [104, 94], [76, 94]]],
      pivot: [88, 86],
      attach: [88, 86],
      tip: NEAR_GRIP,
    },
  ],
  // The tank, read off a luminance / chroma class map of the painting at
  // 1 px: the near strap runs diagonally over the near shoulder from
  // (92, 100) to (101, 108); the far strap's cloth sits at rows 105–108
  // between x 120 and 140, which round 1's polygon cut off and left as a
  // black wedge; the hem against the black shorts is still an authored
  // guess on a painting where both garments are black.
  recolour: {
    polygon: [
      [92, 99],
      [97, 99],
      [97, 103],
      [102, 107],
      [104, 108],
      [106, 103],
      [112, 102],
      [114, 108],
      [122, 110],
      [128, 105],
      [140, 104],
      [150, 103],
      [158, 104],
      [178, 118],
      [190, 128],
      [182, 140],
      [166, 148],
      [142, 150],
      [120, 152],
      [98, 146],
      [92, 132],
      [96, 112],
      [92, 106],
    ],
    skin: { minChroma: 60, minLuminance: 120 },
    reference: {
      source: 'member-walk-a-right',
      // The tee: the torso below the neck and above the waistband, and the
      // near sleeve.
      polygons: [
        [
          [92, 48],
          [150, 48],
          [152, 58],
          [143, 62],
          [141, 100],
          [146, 112],
          [100, 112],
          [96, 100],
          [88, 100],
          [86, 60],
        ],
        [
          [134, 50],
          [156, 54],
          [160, 76],
          [140, 76],
          [136, 66],
        ],
      ],
      cloth: { minBlueOverRed: 0.62, minLuminance: 60 },
    },
  },
  ik: [
    { upper: 'nearUpperArm', fore: 'nearForearm', target: { part: 'bar', point: NEAR_GRIP }, bend: -1 },
    { upper: 'farUpperArm', fore: 'farForearm', target: { part: 'bar', point: FAR_GRIP }, bend: 1 },
  ],
});

export const PUPPETS: Readonly<Record<'walker' | 'presser', Puppet>> = Object.freeze({
  walker: WALKER,
  presser: PRESSER,
});

// ---------------------------------------------------------------------------
// KEYFRAMES. Absolute degrees per the convention above. Foot angles are
// written against FOOT_FLAT, the angle at which the borrowed near foot's
// sole lies along the ground: the source rest angle (ankle → toe, 61.8°)
// plus the source sole's slope (heel → ball, −7.8°, the toe drawn a touch
// up), so 54.0°. FOOT_FLAT − n points the toe DOWN (plantar flexion, the
// heel rising at toe-off); FOOT_FLAT + n lifts the toe (heel strike). It is
// derived here from the same points the rig reads, not typed in.
// ---------------------------------------------------------------------------

/** Degrees in a half turn — the one unit constant the rig converts angles with, kept here so `memberRig.ts` holds no bare number. */
export const HALF_TURN_DEGREES = 180;

function degrees(from: PuppetPointTuple, to: PuppetPointTuple): number {
  return (Math.atan2(to[0] - from[0], to[1] - from[1]) * HALF_TURN_DEGREES) / Math.PI;
}

/** Screen angle of the sole below horizontal, degrees, positive when the ball is lower than the heel. */
function soleSlopeDegrees(sole: { readonly heel: PuppetPointTuple; readonly ball: PuppetPointTuple }): number {
  return (Math.atan2(sole.ball[1] - sole.heel[1], sole.ball[0] - sole.heel[0]) * HALF_TURN_DEGREES) / Math.PI;
}

export const FOOT_FLAT: number = degrees(NEAR_ANKLE, NEAR_TOE) + soleSlopeDegrees(SOLE);

const UP = HALF_TURN_DEGREES;
const BACK = 270;
const LEAN = UP - EMPIRE_TUNING.FLOOR_MEMBER_LEAN_DEGREES;
const CANVAS_CENTRE_X = EMPIRE_TUNING.FLOOR_MEMBER_MOTION_CANVAS_PX / 2;

/**
 * The gait, Richard Williams' four keys per step: contact, down, passing,
 * up. Authored for the first step (near foot forward at contact); the rig
 * mirrors it for the second. The thigh swing is sized so the stance foot
 * covers half of `memberMotionStrideTiles()` in canvas px per step
 * (`memberRig.test.ts` pins the full stride).
 */
const GAIT = {
  contact: {
    nearThigh: 22,
    nearShin: 19,
    nearFoot: FOOT_FLAT + 8,
    farThigh: -19,
    farShin: -32,
    farFoot: FOOT_FLAT - 30,
    nearUpperArm: -24,
    nearForearm: -12,
    farUpperArm: 26,
    farForearm: 50,
    torso: LEAN,
    head: LEAN + 2,
  },
  down: {
    nearThigh: 14,
    nearShin: 5,
    nearFoot: FOOT_FLAT,
    farThigh: -20,
    farShin: -48,
    farFoot: FOOT_FLAT - 38,
    nearUpperArm: -14,
    nearForearm: -6,
    farUpperArm: 16,
    farForearm: 44,
    torso: LEAN,
    head: LEAN + 2,
  },
  passing: {
    nearThigh: 2,
    nearShin: -2,
    nearFoot: FOOT_FLAT,
    farThigh: 4,
    farShin: -44,
    farFoot: FOOT_FLAT - 18,
    nearUpperArm: 0,
    nearForearm: 8,
    farUpperArm: 2,
    farForearm: 34,
    torso: LEAN,
    head: LEAN + 2,
  },
  up: {
    nearThigh: -11,
    nearShin: -13,
    nearFoot: FOOT_FLAT - 14,
    farThigh: 19,
    farShin: 3,
    farFoot: FOOT_FLAT + 2,
    nearUpperArm: 14,
    nearForearm: 30,
    farUpperArm: -12,
    farForearm: -4,
    torso: LEAN,
    head: LEAN + 2,
  },
} as const;

/** The same pose with the near and far limbs swapped: the other step of the gait. */
function otherSide(angles: Readonly<Record<string, number>>): Readonly<Record<string, number>> {
  const out: Record<string, number> = { ...angles };
  for (const [a, b] of WALKER.mirror) {
    const va = angles[a];
    const vb = angles[b];
    if (va !== undefined) out[b] = va;
    if (vb !== undefined) out[a] = vb;
  }
  return out;
}

/**
 * The amplitudes of one full inhale, degrees: the torso pitching back, the
 * chin lifting on top of that, the upper arms lifting away from the body.
 * All three are knobs (`FLOOR_MEMBER_MOTION_BREATH_*`); this file authors
 * where in the cycle they peak.
 */
export interface PuppetBreath {
  readonly torso: number;
  readonly nod: number;
  readonly shoulder: number;
}

const NO_BREATH: PuppetBreath = { torso: 0, nod: 0, shoulder: 0 };

/**
 * A stand: feet apart by ±stance, arms hanging, torso upright, plus a lean
 * and `inhale` (0..1) of a breath. The head is a child of the torso but its
 * angle is absolute, so it is given the torso's pitch AND the nod: without
 * the pitch the head would stay level while the chest rose and read as a
 * counter-nod.
 */
function stand(stance: number, lean: number, breath: PuppetBreath, inhale: number): Readonly<Record<string, number>> {
  const pitch = breath.torso * inhale;
  const shoulder = breath.shoulder * inhale;
  return {
    nearThigh: stance,
    nearShin: stance,
    nearFoot: FOOT_FLAT,
    farThigh: -stance,
    farShin: -stance,
    farFoot: FOOT_FLAT,
    nearUpperArm: 4 - shoulder,
    nearForearm: 12 - shoulder,
    farUpperArm: -6 - shoulder,
    farForearm: 2 - shoulder,
    torso: UP + lean + pitch,
    head: UP + lean - 2 + pitch + breath.nod * inhale,
  };
}

/**
 * THE BENCH, art round 2. Five walker poses put a standing man on the bench
 * lying where the presser painting's pelvis is, (180, 152), with every
 * frame's feet planted:
 *
 *   0 stand     both feet at the stand spot (the idle's), root on the centre line
 *   1 step-sink far foot planted at the stand spot, the near foot stepping
 *               toward the bench edge, knees bending, hips sinking back a
 *               little over the far foot
 *   2 seated    both feet at the seat spot under the bench edge, the near
 *               foot planted; hips a third of the way to the presser's
 *   3 lean-back torso half way down, knees rising, hips two thirds of the way
 *   4 lying     the presser's body line in side view — head to the left and
 *               up, torso rising toward the head, knees up with the feet
 *               under the pelvis, arms reaching up to the racked bar
 *
 * The hips travel from the step-sink to the lying pose in three near-equal
 * moves (`memberRig.test.ts` pins each at no more than a third plus
 * `FLOOR_MEMBER_MOTION_SCOOT_SLACK_PX`), which replaces round 1's sit-back
 * then 100 px scoot. The seated and lean-back roots are SOLVED from the
 * planted near foot, so the thirds are authored through the thigh and shin
 * angles below rather than typed as roots. Round 1's lying pose was a flat
 * side-view man (torso 270°, head far left, arms folded); this one is posed
 * to the PRESSER's silhouette so the dissolve between the two paintings
 * overlaps as far as two drawings allow — the bake measures that as
 * intersection over union. The far foot closes up from the stand spot to the
 * seat spot between frames 1 and 2, in the air: a two-foot drawing cannot
 * step twice in five frames, and that is the one slide the sit still has.
 */
const STEP_SINK: Readonly<Record<string, number>> = {
  nearThigh: 45,
  nearShin: 10,
  nearFoot: FOOT_FLAT + 12,
  farThigh: 30,
  farShin: -24,
  farFoot: FOOT_FLAT,
  nearUpperArm: 30,
  nearForearm: 50,
  farUpperArm: 26,
  farForearm: 44,
  torso: UP - 14,
  head: UP - 8,
};

/** Sitting on the bench edge: thighs a little above level, shins near vertical, hands on the thighs. */
const SEATED: Readonly<Record<string, number>> = {
  nearThigh: 55,
  nearShin: -12,
  nearFoot: FOOT_FLAT,
  farThigh: 57,
  farShin: -14,
  farFoot: FOOT_FLAT,
  nearUpperArm: 60,
  nearForearm: 90,
  farUpperArm: 54,
  farForearm: 84,
  torso: UP - 6,
  head: UP - 4,
};

/** Leaning back half way onto the pad, knees rising, arms coming up toward the bar. */
const LEAN_BACK: Readonly<Record<string, number>> = {
  nearThigh: 40,
  nearShin: -30,
  nearFoot: FOOT_FLAT,
  farThigh: 44,
  farShin: -28,
  farFoot: FOOT_FLAT,
  nearUpperArm: 140,
  nearForearm: 170,
  farUpperArm: 130,
  farForearm: 160,
  torso: 215,
  head: 210,
};

/**
 * Lying on the presser's body line: torso rising toward the head at the
 * left, knees up with the feet under the pelvis, both arms up to the racked
 * bar's grips. The presser's own line, read off its painting: pelvis
 * (180, 152) to the neck (115, 110) is about 248°; its near thigh runs to a
 * knee at about (205, 185) and its shin back down to a foot at (172, 240).
 */
const LYING: Readonly<Record<string, number>> = {
  nearThigh: 23,
  nearShin: -42,
  nearFoot: FOOT_FLAT,
  farThigh: 66,
  farShin: -16,
  farFoot: FOOT_FLAT,
  nearUpperArm: 150,
  nearForearm: 210,
  farUpperArm: 165,
  farForearm: 185,
  torso: 248,
  head: 240,
};

/**
 * Roots, canvas px. A standing clip's root sits on the canvas centre line
 * with y solved from the planted foot (the 0 is never drawn). The bench
 * clips are world-frame: the stand is anchored on the centre line, the
 * lying pose on the presser painting's own pelvis (180, 152), and every
 * frame between is solved from its planted foot. Only the anchors' x is
 * read; y is always solved.
 */
const STAND_ROOT: PuppetPointTuple = [CANVAS_CENTRE_X, 0];
const LYING_ROOT: PuppetPointTuple = [180, 152];

const PRESSER_ANGLES: Readonly<Record<string, number>> = {};
/** The presser's root is the painting's own pelvis: the body block never moves. */
const PRESSER_ROOT_CANVAS: PuppetPointTuple = PRESSER_ROOT;
const BAR_LOCKOUT: PuppetPointTuple = [0, 0];
const BAR_RACKED: PuppetPointTuple = [-14, 8];
const BAR_HALF_RACKED: PuppetPointTuple = [-7, 4];
const BAR_BOTTOM: PuppetPointTuple = [6, 32];

function presserKey(t: number, ease: PuppetEase, bar: PuppetPointTuple): PuppetKey {
  return { t, ease, angles: PRESSER_ANGLES, root: PRESSER_ROOT_CANVAS, offsets: { bar } };
}

function walkerKey(
  t: number,
  ease: PuppetEase,
  angles: Readonly<Record<string, number>>,
  root: PuppetPointTuple,
): PuppetKey {
  return { t, ease, angles, root };
}

/** The gait's four authored keys for the first step; the rig mirrors the second. */
export const WALK_KEYS: readonly PuppetKey[] = [
  walkerKey(0, 'in-out', GAIT.contact, STAND_ROOT),
  walkerKey(0.125, 'in-out', GAIT.down, STAND_ROOT),
  walkerKey(0.25, 'in-out', GAIT.passing, STAND_ROOT),
  walkerKey(0.375, 'in-out', GAIT.up, STAND_ROOT),
];

export const WALK_SEGMENT: PuppetSegment = {
  puppet: 'walker',
  frames: [0, EMPIRE_TUNING.FLOOR_MEMBER_MOTION_FRAMES.walk],
  cyclic: true,
  mirrorSecondHalf: true,
  frame: 'body',
  keys: WALK_KEYS,
  plant: {
    runs: [
      { fromFrame: 0, toFrame: 8, foot: 'nearFoot', anchorFrame: 0 },
      { fromFrame: 8, toFrame: 16, foot: 'farFoot', anchorFrame: 8 },
    ],
    retime: true,
  },
};

/**
 * The idle and wait breathe on the same shape: ONE breath per cycle — the
 * torso pitching back, the chin lifting and the shoulders rising by the
 * `breath` amplitudes, from rest at the start to the full inhale half way
 * round and back — and a weight shift of ±`sway` degrees of lean, a full
 * sine over the same cycle (peaking a quarter and three quarters through).
 * The amplitudes are knobs the rig passes in (`FLOOR_MEMBER_MOTION_BREATH_*`,
 * `FLOOR_MEMBER_WAIT_SWAY_DEGREES` and the idle fraction), so this file
 * authors the SHAPE and the tuning file the amount.
 *
 * Round 1 peaked the breath a quarter AND three quarters through, which made
 * frames 0 and 6 of a twelve-frame idle byte-identical — a clip period
 * `FLOOR_MEMBER_IDLE_BREATH_PERIOD_MS` calls "one breath" held two. One
 * breath per cycle is what that knob's own comment says.
 */
export function standingSegment(stance: number, sway: number, breath: PuppetBreath, frames: number): PuppetSegment {
  return {
    puppet: 'walker',
    frames: [0, frames],
    cyclic: true,
    mirrorSecondHalf: false,
    frame: 'body',
    keys: [
      walkerKey(0, 'in-out', stand(stance, 0, breath, 0), STAND_ROOT),
      walkerKey(0.25, 'in-out', stand(stance, sway, breath, 1 / 2), STAND_ROOT),
      walkerKey(0.5, 'in-out', stand(stance, 0, breath, 1), STAND_ROOT),
      walkerKey(0.75, 'in-out', stand(stance, -sway, breath, 1 / 2), STAND_ROOT),
    ],
    plant: { runs: [{ fromFrame: 0, toFrame: frames, foot: 'nearFoot', anchorFrame: 0 }], retime: false },
  };
}

/**
 * The last step settling to feet together: from the contact pose to the
 * stand. Retimed like the walk (art round 2): the sample times are solved
 * so the planted near foot retreats by the same amount every frame, and the
 * runtime drives the clip by distance over that total.
 */
export function walkToWaitSegment(stance: number, frames: number): PuppetSegment {
  return {
    puppet: 'walker',
    frames: [0, frames],
    cyclic: false,
    mirrorSecondHalf: false,
    frame: 'body',
    keys: [
      walkerKey(0, 'out', GAIT.contact, STAND_ROOT),
      walkerKey(0.5, 'out', GAIT.down, STAND_ROOT),
      walkerKey(1, 'out', stand(stance, 0, NO_BREATH, 0), STAND_ROOT),
    ],
    plant: { runs: [{ fromFrame: 0, toFrame: frames, foot: 'nearFoot', anchorFrame: 0 }], retime: true },
  };
}

/**
 * The first step out of a stand: the far foot stays planted while the near
 * leg swings forward through the OTHER step's up pose (near leg forward,
 * far leg pushing) to the contact pose. Retimed like the walk.
 */
export function waitToWalkSegment(stance: number, frames: number): PuppetSegment {
  return {
    puppet: 'walker',
    frames: [0, frames],
    cyclic: false,
    mirrorSecondHalf: false,
    frame: 'body',
    keys: [
      walkerKey(0, 'in', stand(stance, 0, NO_BREATH, 0), STAND_ROOT),
      walkerKey(0.5, 'in', otherSide(GAIT.up), STAND_ROOT),
      walkerKey(1, 'in', GAIT.contact, STAND_ROOT),
    ],
    plant: { runs: [{ fromFrame: 0, toFrame: frames, foot: 'farFoot', anchorFrame: 0 }], retime: true },
  };
}

/** The walker's five bench keys, stand → lying, at equal spacing. */
const BENCH_WALKER_KEYS = (stance: number): readonly PuppetKey[] => [
  walkerKey(0, 'in-out', stand(stance, 0, NO_BREATH, 0), STAND_ROOT),
  walkerKey(0.25, 'in-out', STEP_SINK, STAND_ROOT),
  walkerKey(0.5, 'in-out', SEATED, STAND_ROOT),
  walkerKey(0.75, 'in-out', LEAN_BACK, STAND_ROOT),
  walkerKey(1, 'in-out', LYING, LYING_ROOT),
];

/** The same keys played backwards: t → 1 − t. Every interval is `in-out`, which is its own reverse. */
function reversedKeys(keys: readonly PuppetKey[]): readonly PuppetKey[] {
  return [...keys].reverse().map((key) => ({ ...key, t: 1 - key.t }));
}

/** Frames of the setup during which the FAR foot holds the stand spot (the stand and the step-sink). */
const BENCH_STAND_PLANTED_FRAMES = 2;

/**
 * Step to the bench, sit, lean back, lie down: the walker alone (art round
 * 2 moved the presser's reach for the bar into `bench-mount`). Frames 0–1
 * plant the far foot at the stand spot, anchored on the centred stand;
 * frames 2–4 plant the near foot at the seat spot, anchored on the lying
 * pose over the presser's pelvis, so the seated and lean-back roots are
 * solved from where the lying feet are rather than authored.
 */
export function benchSetupSegment(stance: number): PuppetSegment {
  const frames = EMPIRE_TUNING.FLOOR_MEMBER_MOTION_FRAMES['bench-setup'];
  return {
    puppet: 'walker',
    frames: [0, frames],
    cyclic: false,
    mirrorSecondHalf: false,
    frame: 'world',
    keys: BENCH_WALKER_KEYS(stance),
    plant: {
      runs: [
        { fromFrame: 0, toFrame: BENCH_STAND_PLANTED_FRAMES, foot: 'farFoot', anchorFrame: 0 },
        { fromFrame: BENCH_STAND_PLANTED_FRAMES, toFrame: frames, foot: 'nearFoot', anchorFrame: frames - 1 },
      ],
      retime: false,
    },
  };
}

/** Sit up, stand: the setup reversed, the stand anchored on the centre line so it meets the idle. */
export function benchFinishSegment(stance: number): PuppetSegment {
  const frames = EMPIRE_TUNING.FLOOR_MEMBER_MOTION_FRAMES['bench-finish'];
  return {
    puppet: 'walker',
    frames: [0, frames],
    cyclic: false,
    mirrorSecondHalf: false,
    frame: 'world',
    keys: reversedKeys(BENCH_WALKER_KEYS(stance)),
    plant: {
      runs: [
        { fromFrame: 0, toFrame: frames - BENCH_STAND_PLANTED_FRAMES, foot: 'nearFoot', anchorFrame: 0 },
        { fromFrame: frames - BENCH_STAND_PLANTED_FRAMES, toFrame: frames, foot: 'farFoot', anchorFrame: frames - 1 },
      ],
      retime: false,
    },
  };
}

/** The presser taking the racked bar to lockout: racked, half way, lockout. */
export const BENCH_MOUNT_SEGMENT: PuppetSegment = {
  puppet: 'presser',
  frames: [0, EMPIRE_TUNING.FLOOR_MEMBER_MOTION_FRAMES['bench-mount']],
  cyclic: false,
  mirrorSecondHalf: false,
  frame: 'world',
  keys: [presserKey(0, 'in-out', BAR_RACKED), presserKey(0.5, 'in-out', BAR_HALF_RACKED), presserKey(1, 'in-out', BAR_LOCKOUT)],
  plant: null,
};

/** The presser racking the bar: lockout, half way, racked — the mount reversed. */
export const BENCH_DISMOUNT_SEGMENT: PuppetSegment = {
  puppet: 'presser',
  frames: [0, EMPIRE_TUNING.FLOOR_MEMBER_MOTION_FRAMES['bench-dismount']],
  cyclic: false,
  mirrorSecondHalf: false,
  frame: 'world',
  keys: reversedKeys(BENCH_MOUNT_SEGMENT.keys),
  plant: null,
};

/** One press: lockout held, controlled descent, bottom held, drive. */
export const BENCH_PRESS_SEGMENT: PuppetSegment = {
  puppet: 'presser',
  frames: [0, EMPIRE_TUNING.FLOOR_MEMBER_MOTION_FRAMES['bench-press']],
  cyclic: true,
  mirrorSecondHalf: false,
  frame: 'world',
  keys: [
    presserKey(0, 'linear', BAR_LOCKOUT),
    presserKey(0.1, 'linear', BAR_LOCKOUT),
    presserKey(0.5, 'in-out', BAR_BOTTOM),
    presserKey(0.6, 'linear', BAR_BOTTOM),
  ],
  plant: null,
};
