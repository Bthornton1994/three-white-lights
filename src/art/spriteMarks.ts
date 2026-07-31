/**
 * MARKS — the pixels a hand placed.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS
 * ---------------------------------------------------------------------------
 * Everything in `raster.ts` resolves a pixel from geometry: a capsule, an
 * ellipsoid or a trunk, dotted with one key light and quantised into a ramp.
 * That gets the light direction right and it gets the load-dependent pose
 * right, but it can only ever produce even shading. It cannot produce a buckle,
 * a sole line, a strap shadow or a break in the value ramp at the deltoid,
 * because none of those are functions of the surface normal — they are objects
 * and anatomical landmarks, and on real 16-bit sprites an artist placed them
 * one pixel at a time.
 *
 * So this file is a table of hand-placed pixels. It is DATA, not a second
 * shading model. There is no lighting term, no noise function and no rule that
 * derives a mark from geometry. If a mark is in the wrong place, the fix is to
 * move a character in a string here — not to tune a model that generates it.
 *
 * ---------------------------------------------------------------------------
 * HOW A MARK IS AUTHORED
 * ---------------------------------------------------------------------------
 * Each mark is a small ASCII bitmap, an anchor naming a pose landmark, and an
 * origin saying where the bitmap's top-left corner sits relative to that
 * landmark. Anchors are the same idea as `POSE_DEPTH_ANCHORS` in `rig.ts`: the
 * landmark moves with the drawing, the offsets do not.
 *
 *     { name: 'BELT_LEVER', anchor: 'BELT', origin: [-1, -1], over: 'GEAR',
 *       map: ['KKK',
 *             'KWK',
 *             'KWK'] }
 *
 * reads: three rows starting one pixel left of and one pixel above the belt's
 * centre, drawn only where the belt already is. Moving the buckle down a row is
 * changing `-1` to `0`. Making the lever two pixels wide is changing `'KWK'` to
 * `'KWW'`. Neither requires understanding anything else in the codebase.
 *
 * MAP LEGEND — one character per palette entry, the same letters the sprite
 * inspection dump uses. A space paints nothing.
 *
 * `over` is a surface class, checked against what is ALREADY in the grid at
 * that pixel. It is what stops a mark escaping the silhouette: a belt buckle
 * pixel that falls off the belt at some pose simply does not get painted, and
 * nothing has to clamp or clip. It also means a mark can be authored for the
 * pose where it matters and quietly disappear where the body covers it — the
 * quad marks are authored for an exposed thigh and vanish under the singlet at
 * lockout without a single conditional.
 *
 * ---------------------------------------------------------------------------
 * WHY MARKS ARE STAMPED AFTER `despeckle`
 * ---------------------------------------------------------------------------
 * `despeckle` replaces any pixel with no 4-neighbour of its own index. That is
 * the right treatment for procedural noise and the wrong treatment for a
 * deliberate one-pixel eye: before this file existed, the sprite's face marks
 * were drawn before despeckle and every one of them was eaten — the rendered
 * lockout frame had no eyes, no mouth and no chalked knuckle at all, only the
 * source code that intended them. Marks are therefore applied after despeckle
 * and before `outlinePass`, so an authored single pixel survives exactly as
 * authored and the outline still has the last word on the silhouette.
 *
 * ---------------------------------------------------------------------------
 * REFERENCE
 * ---------------------------------------------------------------------------
 * Marks were authored looking at `docs/reference/` at native pixel scale:
 *   - sprite-ref-1-snes-wrestling.png — the ~55px wrestlers carry armbands, a
 *     headband over a shaped hair fringe, a gold trim band at the boot top and
 *     knee pads with a distinct dark band. Their arm highlight is broken into a
 *     deltoid mass and a separate biceps mass rather than running the length of
 *     the limb. The referee, a front-on figure at almost exactly our scale, has
 *     a bow tie, a belt line, a crease down each trouser leg and shoes with a
 *     separate sole.
 *   - sprite-ref-2-16bit-baseball.png — black belt band across the waist,
 *     contrast piping on the shoulder, a sock band breaking the leg above the
 *     shoe.
 *   - meet-photo-ref-1-ipf-squat-bottom.webp — navy singlet with red trim on
 *     the straps and a white chest patch, knee sleeves with a contrasting top
 *     band, flat shoes with a pale sole, wrist wraps breaking the forearm.
 *   - meet-photo-ref-2-deadlift-lockout.png — a lever belt: a light strap with
 *     a dark rectangular lever plate sitting just off centre-front.
 */

import { PAL } from './palette';
import { CENTER_X } from './spriteTuning';
import { RIG_GEOMETRY, type Pose } from './rig';
import { getPx, setPx, type IndexGrid } from './raster';

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

/**
 * Character -> palette index. Deliberately the same letters the inspection dump
 * prints, so a map string can be read straight off a rendered frame.
 */
export const MARK_INK: Readonly<Record<string, number>> = {
  K: PAL.OUTLINE,
  s: PAL.SKIN_SHADOW,
  m: PAL.SKIN_MID,
  l: PAL.SKIN_LIGHT,
  h: PAL.SKIN_HI,
  '1': PAL.SINGLET_DARK,
  '2': PAL.SINGLET_MID,
  '3': PAL.SINGLET_LIGHT,
  a: PAL.HAIR_DARK,
  A: PAL.HAIR_LIGHT,
  g: PAL.GEAR_DARK,
  G: PAL.GEAR_MID,
  W: PAL.GEAR_LIGHT,
  C: PAL.CHALK,
};

/** Blank cell in a map: paints nothing. */
export const MARK_BLANK = ' ';

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

export type MarkSurface = 'SKIN' | 'SINGLET' | 'GEAR' | 'HAIR' | 'SKIN_OR_HAIR' | 'LIFTER';

const SKIN_SET: readonly number[] = [
  PAL.SKIN_SHADOW,
  PAL.SKIN_MID,
  PAL.SKIN_LIGHT,
  PAL.SKIN_HI,
  PAL.SKIN_FLUSH,
];
const SINGLET_SET: readonly number[] = [PAL.SINGLET_DARK, PAL.SINGLET_MID, PAL.SINGLET_LIGHT];
const GEAR_SET: readonly number[] = [PAL.GEAR_DARK, PAL.GEAR_MID, PAL.GEAR_LIGHT];
const HAIR_SET: readonly number[] = [PAL.HAIR_DARK, PAL.HAIR_LIGHT];

/**
 * Which existing palette indices a surface class will paint over.
 *
 * PAL.OUTLINE is never in any of these. A mark may not overwrite the drawing's
 * own interior outlines, because those are what separate one mass from the next
 * — a strap trim that painted over the outline between the arm and the chest
 * would weld them together.
 */
export const MARK_SURFACES: Readonly<Record<MarkSurface, readonly number[]>> = {
  SKIN: SKIN_SET,
  SINGLET: SINGLET_SET,
  GEAR: GEAR_SET,
  HAIR: HAIR_SET,
  SKIN_OR_HAIR: [...SKIN_SET, ...HAIR_SET],
  LIFTER: [...SKIN_SET, ...SINGLET_SET, ...GEAR_SET, ...HAIR_SET, PAL.CHALK],
};

// ---------------------------------------------------------------------------
// Anchors
// ---------------------------------------------------------------------------

export type MarkAnchorKey =
  | 'HEAD'
  | 'TRAP'
  | 'CHEST'
  | 'STRAP'
  | 'BELT'
  | 'HEM'
  | 'DELTOID'
  | 'ELBOW'
  | 'WRIST'
  | 'QUAD'
  | 'KNEE'
  | 'SLEEVE_TOP'
  | 'SLEEVE_MID'
  | 'SLEEVE_BOTTOM'
  | 'CALF'
  | 'SHIN'
  | 'SHOE';

/**
 * Which side(s) a mark is placed on.
 *
 * `NEAR` is the screen-left limb and `FAR` the screen-right one, the same
 * language `SHADING.FAR_LIMB_STEP_BIAS` uses: the frontal view is shaded as if
 * the lifter were turned a couple of degrees, so the screen-right limbs sit one
 * ramp step darker. A mark that lightens skin therefore has to be authored
 * twice, once per side, at different ramp steps — a single `BOTH` highlight
 * would paint the far arm as bright as the near one and undo the separation.
 */
export type MarkSide = 'CENTER' | 'BOTH' | 'NEAR' | 'FAR';

/** `CALM` and `STRAINED` gate on the same flush threshold the skin ramp uses. */
export type MarkGate = 'ALWAYS' | 'CALM' | 'STRAINED';

/**
 * Fractions used to find the anchors that do not sit exactly on a pose
 * landmark. These are drawing values, not feel values — the same category as
 * `RIG_GEOMETRY` — and they are named here rather than typed into an anchor
 * lookup so a tuner moving the wrist wrap up the forearm has one number to
 * change.
 */
export const MARK_ANCHOR_GEOMETRY = {
  /** Trap anchor, as a fraction of the shoulder half-width. */
  TRAP_HALF_W: 0.3,
  /** Trap anchor, rows below the shoulder line. */
  TRAP_DROP: 0,
  /** Strap anchor, as a fraction of the shoulder half-width. */
  STRAP_HALF_W: 0.46,
  /** Strap anchor, rows above the chest landmark. */
  STRAP_LIFT: 2,
  /** Wrist anchor: this far from the hand toward the elbow. */
  WRIST_TOWARD_ELBOW: 0.28,
  /** Quad anchor: this far from the hip toward the knee. */
  QUAD_TOWARD_KNEE: 0.34,
  /** Shin anchor: this far from the ankle toward the knee. */
  SHIN_ABOVE_ANKLE: 0.12,
  /** Calf anchor: this far from the ankle toward the knee. */
  CALF_ABOVE_ANKLE: 0.45,
} as const;

/** A resolved anchor, in whole sprite pixels. */
export interface AnchorPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Where each anchor sits for a pose, on one side.
 *
 * `sign` is -1 for the screen-left limb and +1 for the screen-right one;
 * `CENTER` marks resolve with sign 0 and never read a half-width.
 */
export function anchorPoint(key: MarkAnchorKey, pose: Pose, sign: number): AnchorPoint {
  const G = RIG_GEOMETRY;
  const A = MARK_ANCHOR_GEOMETRY;
  const at = (x: number, y: number): AnchorPoint => ({ x: Math.round(x), y: Math.round(y) });

  switch (key) {
    case 'HEAD':
      return at(CENTER_X + pose.headDx, pose.headY);
    case 'TRAP':
      return at(CENTER_X + sign * pose.shoulderHalfW * A.TRAP_HALF_W, pose.shoulderY + A.TRAP_DROP);
    case 'CHEST':
      return at(CENTER_X, pose.chestY);
    case 'STRAP':
      return at(
        CENTER_X + sign * pose.shoulderHalfW * A.STRAP_HALF_W,
        pose.chestY - A.STRAP_LIFT,
      );
    case 'BELT':
      return at(CENTER_X, pose.waistY);
    case 'HEM':
      return at(CENTER_X, pose.hipY + G.ATTACH.SINGLET_HEM);
    case 'DELTOID':
      return at(
        CENTER_X + sign * pose.shoulderHalfW * G.ATTACH.DELTOID,
        pose.shoulderY + G.NUDGE.DELTOID_DROP,
      );
    case 'ELBOW':
      return at(CENTER_X + sign * pose.elbowHalfW, pose.elbowY);
    case 'WRIST': {
      const handX = CENTER_X + sign * (pose.handHalfW + (sign > 0 ? G.GRIP_ASYMMETRY_PX : 0));
      const elbowX = CENTER_X + sign * pose.elbowHalfW;
      const f = A.WRIST_TOWARD_ELBOW;
      return at(handX + (elbowX - handX) * f, pose.handY + (pose.elbowY - pose.handY) * f);
    }
    case 'QUAD': {
      const hipX = CENTER_X + sign * pose.hipHalfW * G.ATTACH.THIGH_ROOT;
      const kneeX = CENTER_X + sign * pose.kneeHalfW;
      const f = A.QUAD_TOWARD_KNEE;
      return at(hipX + (kneeX - hipX) * f, pose.hipY + (pose.kneeY - pose.hipY) * f);
    }
    case 'KNEE':
      return at(CENTER_X + sign * pose.kneeHalfW, pose.kneeY);
    // The knee sleeve is not drawn on the knee landmark — it is drawn between
    // two fractions along the thigh and the shin, so that it stays on the joint
    // when the knee tracks out at depth. Its marks have to be anchored to the
    // SAME two points or they walk off it: anchored to the knee instead, the
    // top band missed the sleeve entirely on 120 of 416 pose/strain/pitch
    // combinations, because in the hole the thigh is nearly horizontal and the
    // sleeve sits well below where the joint is.
    case 'SLEEVE_TOP':
    case 'SLEEVE_MID':
    case 'SLEEVE_BOTTOM': {
      const KS = G.KNEE_SLEEVE;
      const hipX = CENTER_X + sign * pose.hipHalfW * G.ATTACH.THIGH_ROOT;
      const kneeX = CENTER_X + sign * pose.kneeHalfW;
      const ankleX = CENTER_X + sign * pose.ankleHalfW;
      const upX = kneeX + (hipX - kneeX) * KS.TOWARD_HIP;
      const upY = pose.kneeY + (pose.hipY - pose.kneeY) * KS.TOWARD_HIP;
      const dnX = kneeX + (ankleX - kneeX) * KS.TOWARD_ANKLE;
      const dnY = pose.kneeY + (pose.ankleY - pose.kneeY) * KS.TOWARD_ANKLE;
      if (key === 'SLEEVE_TOP') return at(upX, upY);
      if (key === 'SLEEVE_BOTTOM') return at(dnX, dnY);
      return at((upX + dnX) / 2, (upY + dnY) / 2);
    }
    case 'CALF':
    case 'SHIN': {
      const kneeX = CENTER_X + sign * pose.kneeHalfW;
      const ankleX = CENTER_X + sign * pose.ankleHalfW;
      const f = key === 'CALF' ? A.CALF_ABOVE_ANKLE : A.SHIN_ABOVE_ANKLE;
      return at(ankleX + (kneeX - ankleX) * f, pose.ankleY + (pose.kneeY - pose.ankleY) * f);
    }
    case 'SHOE':
      return at(
        CENTER_X + sign * pose.ankleHalfW + sign * G.FOOT_FLARE,
        pose.ankleY + G.FOOT_DROP,
      );
  }
}

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

export interface Mark {
  /** Names the object or landmark, not the shape. Used by the tests. */
  readonly name: string;
  readonly anchor: MarkAnchorKey;
  readonly side: MarkSide;
  readonly over: MarkSurface;
  /** Top-left of `map`, relative to the resolved anchor, in sprite px. */
  readonly origin: readonly [number, number];
  readonly gate?: MarkGate;
  readonly map: readonly string[];
}

/**
 * THE MARKS.
 *
 * Ordered head to foot, and applied in that order, so a later mark wins where
 * two overlap.
 *
 * `BOTH` places the SAME offsets at each side's anchor — a translation, not a
 * mirror. That is deliberate and it is the reason the key light survives this
 * file: the lamp is upper-left, so the lit flank of the left deltoid and the
 * lit flank of the right deltoid are on the same side of the screen. A mirrored
 * mark table would put a highlight on the outside of both arms and undo the one
 * thing about the shading that was already right. Where a mark genuinely needs
 * to differ per side, write two marks.
 */
export const MARKS: readonly Mark[] = [
  // --- head ---------------------------------------------------------------
  // A fringe with a shape, rather than the smooth cap the hair ellipsoid
  // leaves. Asymmetric on purpose, and it dips onto the forehead on one side
  // only: the reference wrestlers' hair falls to one side, and a symmetric
  // fringe on a symmetric skull is the tell this whole sprite is avoiding.
  {
    name: 'HAIR_FRINGE',
    anchor: 'HEAD',
    side: 'CENTER',
    over: 'SKIN_OR_HAIR',
    origin: [-4, -4],
    map: [
      '  AA ',
      ' AAa ',
      ' aaa ',
      ' aa  ',
      ' a   ',
    ],
  },
  // Eyes and mouth. One pixel per eye: at seven pixels of head width there is
  // room for nothing else. These used to be drawn before `despeckle` and every
  // one of them was eaten before it reached a PNG.
  {
    name: 'FACE_CALM',
    anchor: 'HEAD',
    side: 'CENTER',
    over: 'SKIN',
    gate: 'CALM',
    origin: [-1, 0],
    map: [
      'K  K',
      '    ',
      ' KK ',
    ],
  },
  // Braced and grimacing: the brow comes down as a bar over both eyes and the
  // mouth opens. A different drawing, not a darker one.
  {
    name: 'FACE_STRAINED',
    anchor: 'HEAD',
    side: 'CENTER',
    over: 'SKIN',
    gate: 'STRAINED',
    origin: [-1, -1],
    map: [
      'KKKK',
      'K  K',
      '    ',
      'KKKK',
    ],
  },
  // --- torso --------------------------------------------------------------
  // The bar is drawn behind the lifter, so nothing else says it is resting on
  // him. This is its contact shadow across the traps.
  {
    name: 'TRAP_BAR_SHADOW',
    anchor: 'TRAP',
    side: 'BOTH',
    over: 'SKIN',
    origin: [-1, 1],
    map: ['ss'],
  },
  // Singlet strap: a dark seam down its shadowed flank, and the shadow it
  // throws onto bare chest beside it. The light is upper-left, so both of those
  // are on the strap's right.
  {
    name: 'STRAP_SEAM',
    anchor: 'STRAP',
    side: 'BOTH',
    over: 'SINGLET',
    origin: [1, 1],
    map: [
      '1',
      '1',
      '1',
    ],
  },
  {
    name: 'STRAP_SHADOW',
    anchor: 'STRAP',
    side: 'BOTH',
    over: 'SKIN',
    origin: [2, -1],
    map: [
      's',
      's',
      's',
    ],
  },
  // Federation patch on the chest. Two-by-two of chalk-white is the brightest
  // thing on the figure and the fastest read on the sheet; the reference squat
  // photo has exactly one of these, high and centred, over the sternum.
  //
  // It sits two rows under the neckline rather than four. Four put it on the
  // belt on a maximal grind: at high strain and mid depth the waist rides up
  // until the belt is right under the chest and the singlet above it is three
  // rows tall, and the patch vanished on exactly the frames a grind is made of.
  {
    name: 'CHEST_PATCH',
    anchor: 'CHEST',
    side: 'CENTER',
    over: 'SINGLET',
    origin: [-1, 1],
    map: [
      'CC',
      'CC',
    ],
  },
  // Leg-opening trim. The reference trunks all carry a lighter band at the hem;
  // without it the singlet is a flat field with one vertical gradient.
  {
    name: 'SINGLET_HEM_TRIM',
    anchor: 'HEM',
    side: 'CENTER',
    over: 'SINGLET',
    origin: [-7, -1],
    map: ['333333333333333'],
  },
  // --- belt ---------------------------------------------------------------
  // A lever belt: the plate is the dark rectangle spanning the belt's whole
  // height, the lever arm the two lit pixels down its middle, and it sits a
  // pixel off the midline because a real one does. This is the mark the
  // critique named — a 16-bit artist did not ship a belt with no buckle pixel.
  {
    name: 'BELT_LEVER',
    anchor: 'BELT',
    side: 'CENTER',
    over: 'GEAR',
    origin: [-1, -1],
    map: [
      'KKK',
      'KWK',
      'KWK',
      'KKK',
    ],
  },
  // Where the belt tail laps back over itself, four pixels left of the lever.
  // The other reason a plain band reads as a band and not as a belt.
  {
    name: 'BELT_TAIL',
    anchor: 'BELT',
    side: 'CENTER',
    over: 'GEAR',
    origin: [-5, -1],
    map: [
      'g',
      'g',
      'g',
      'g',
    ],
  },
  // --- arms ---------------------------------------------------------------
  // The deltoid, placed rather than computed: a highlight cluster held to two
  // rows, a step down out of it, and a core shadow along the insertion where
  // the deltoid meets the biceps. Without this the arm's lit flank is one
  // stripe running unbroken from the shoulder to the wrist, which is the shape
  // an extruded capsule has and not the shape an arm has.
  //
  // Authored twice, and NOT as the same map: the far arm is already a ramp step
  // darker and its lit column sits at a different offset, so a single mirrored
  // map would either miss the arm or paint the far deltoid as bright as the
  // near one. Near reads HI-HI / LIGHT / SHADOW / HI-HI down the rows; far
  // reads the same shape one step down, LIGHT / MID / SHADOW / LIGHT.
  {
    name: 'DELTOID_MASS_NEAR',
    anchor: 'DELTOID',
    side: 'NEAR',
    over: 'SKIN',
    origin: [-4, 0],
    map: [
      ' ll ',
      ' ss ',
      'hh  ',
      ' h  ',
    ],
  },
  {
    name: 'DELTOID_MASS_FAR',
    anchor: 'DELTOID',
    side: 'FAR',
    over: 'SKIN',
    origin: [-1, -2],
    map: [
      'll  ',
      'll  ',
      'mm  ',
      'ss  ',
      'll  ',
      ' l  ',
    ],
  },
  // Elbow crease. Two pixels, and the whole job of them is that the forearm
  // does not read as a continuation of the upper arm.
  {
    name: 'ELBOW_CREASE',
    anchor: 'ELBOW',
    side: 'BOTH',
    over: 'SKIN',
    origin: [-2, -1],
    map: [
      'ss',
      's ',
    ],
  },
  // Wrist wraps. An object, so the forearm cannot read as one tapered tube from
  // the elbow to the hand — the reference squat photo has these on both wrists
  // and they are the most visible piece of kit on a lifter after the belt.
  {
    name: 'WRIST_WRAP',
    anchor: 'WRIST',
    side: 'BOTH',
    over: 'SKIN',
    origin: [-2, -1],
    map: [
      'GGGG',
      'gggg',
    ],
  },
  // --- legs ---------------------------------------------------------------
  // Quad sweep: the vastus bulge above the knee, and the shadow that ends it.
  // Near and far again, one ramp step apart.
  //
  // THIS IS A SHALLOW-DEPTH MARK AND IT IS SUPPOSED TO DISAPPEAR. Below about
  // half depth the thigh folds up until the singlet hem and the knee sleeve
  // meet over it and there is no bare thigh left to draw on — measured, the
  // quad marks paint 8 px a side at lockout and 0 in the hole. The `over: SKIN`
  // test is what makes that a non-event instead of a mark floating on a
  // singlet, and it is the reason the surface test exists at all.
  {
    name: 'QUAD_SWEEP_NEAR',
    anchor: 'QUAD',
    side: 'NEAR',
    over: 'SKIN',
    origin: [-3, -1],
    map: [
      ' hh  ',
      ' hh  ',
      'ss   ',
      'ss   ',
    ],
  },
  {
    name: 'QUAD_SWEEP_FAR',
    anchor: 'QUAD',
    side: 'FAR',
    over: 'SKIN',
    origin: [-3, -1],
    map: [
      ' ll  ',
      ' ll  ',
      'ss   ',
      'ss   ',
    ],
  },
  // Knee sleeve, top band. The reference knee pads all carry one; ours was a
  // plain shaded tube. GEAR_DARK rather than the outline colour: a pure black
  // run here merges with the outline already filling the gap between the legs
  // at lockout, and the two knees weld into one bar.
  {
    name: 'KNEE_SLEEVE_TOP_BAND',
    anchor: 'SLEEVE_TOP',
    side: 'BOTH',
    over: 'GEAR',
    origin: [-4, -2],
    map: [
      'gggggggg',
      'gggggggg',
    ],
  },
  {
    name: 'KNEE_SLEEVE_HEM',
    anchor: 'SLEEVE_BOTTOM',
    side: 'BOTH',
    over: 'GEAR',
    origin: [-4, 2],
    map: ['gggggggg'],
  },
  // Brand mark on the sleeve face. Small on purpose: two pixels is a logo,
  // four is a stripe.
  {
    name: 'KNEE_SLEEVE_LOGO',
    anchor: 'SLEEVE_MID',
    side: 'BOTH',
    over: 'GEAR',
    origin: [-1, -1],
    map: [
      'g',
      'g',
    ],
  },
  // Where the calf belly stops and the tendon starts. The shin is the last limb
  // that was one tapered tube with a stripe down it; this is the break.
  {
    name: 'CALF_TAPER',
    anchor: 'CALF',
    side: 'BOTH',
    over: 'SKIN',
    origin: [-2, 0],
    map: ['ss'],
  },
  // The ankle bone, so the shin does not run straight into the shoe.
  {
    name: 'ANKLE_SHADOW',
    anchor: 'SHIN',
    side: 'BOTH',
    over: 'SKIN',
    origin: [-2, 0],
    map: ['sss'],
  },
  // Flat squat shoe: mid-grey collar, dark upper, pale sole. Three authored
  // rows, which is why `FOOT_H` had to become three — at the two rows it had
  // before, the sole line and the upper were the same pixel. The sole is the
  // mark that stops a shoe reading as a grey lump with a lighter top row.
  {
    name: 'SHOE_COLLAR',
    anchor: 'SHOE',
    side: 'BOTH',
    over: 'GEAR',
    origin: [-4, 0],
    map: ['GGGGGGGGG'],
  },
  {
    name: 'SHOE_UPPER',
    anchor: 'SHOE',
    side: 'BOTH',
    over: 'GEAR',
    origin: [-4, 1],
    map: ['ggggggggg'],
  },
  {
    name: 'SHOE_SOLE',
    anchor: 'SHOE',
    side: 'BOTH',
    over: 'GEAR',
    origin: [-4, 2],
    map: ['WWWWWWWWW'],
  },
  // Laces on the instep. Two pixels of chalk-white against the dark upper.
  {
    name: 'SHOE_LACES',
    anchor: 'SHOE',
    side: 'BOTH',
    over: 'GEAR',
    origin: [-1, 1],
    map: ['CC'],
  },
];

// ---------------------------------------------------------------------------
// Stamping
// ---------------------------------------------------------------------------

/** How many pixels a single mark actually landed. Used by tests and the tool. */
export interface MarkPlacement {
  readonly name: string;
  /** Pixels the map asked for, summed over the sides it is drawn on. */
  readonly requested: number;
  /** Pixels that passed the surface test and were written. */
  readonly painted: number;
}

function sidesFor(side: MarkSide): readonly number[] {
  switch (side) {
    case 'CENTER':
      return [0];
    case 'NEAR':
      return [-1];
    case 'FAR':
      return [1];
    case 'BOTH':
      return [-1, 1];
  }
}

function gateAllows(gate: MarkGate | undefined, strained: boolean): boolean {
  if (gate === undefined || gate === 'ALWAYS') return true;
  return gate === 'STRAINED' ? strained : !strained;
}

/** Total pixels a map paints, ignoring blanks. Authoring aid and test fixture. */
export function markPixelCount(mark: Mark): number {
  let n = 0;
  for (const row of mark.map) {
    for (const ch of row) if (ch !== MARK_BLANK) n += 1;
  }
  return n * sidesFor(mark.side).length;
}

/** Every mark's pixel count, summed. The "how many pixels a hand placed" number. */
export function authoredPixelBudget(marks: readonly Mark[] = MARKS): number {
  return marks.reduce((sum, m) => sum + markPixelCount(m), 0);
}

/** One pixel a mark asks for, in cell coordinates. */
export interface MarkTarget {
  readonly x: number;
  readonly y: number;
  readonly ink: number;
}

/**
 * Every pixel a mark asks for at a pose, before the surface test.
 *
 * Exported so a test can go back to the RENDERED grid afterwards and check the
 * ink is still there — the pipeline runs `outlinePass` after the marks, and the
 * whole reason this file exists is that a pass downstream of a mark once ate it
 * silently. "The stamper says it painted" and "the PNG has it" are different
 * claims, and only the second one matters.
 */
export function markTargets(
  mark: Mark,
  pose: Pose,
  strained: boolean,
): readonly MarkTarget[] {
  if (!gateAllows(mark.gate, strained)) return [];
  const out: MarkTarget[] = [];
  const [ox, oy] = mark.origin;
  for (const sign of sidesFor(mark.side)) {
    const anchor = anchorPoint(mark.anchor, pose, sign);
    for (let row = 0; row < mark.map.length; row += 1) {
      const line = mark.map[row];
      if (line === undefined) continue;
      for (let col = 0; col < line.length; col += 1) {
        const ch = line[col];
        if (ch === undefined || ch === MARK_BLANK) continue;
        const ink = MARK_INK[ch];
        if (ink === undefined) continue;
        out.push({ x: anchor.x + ox + col, y: anchor.y + oy + row, ink });
      }
    }
  }
  return out;
}

/**
 * Stamp one mark and report what landed.
 *
 * The only rule here is the surface test. There is no clipping, no blending and
 * no fallback position: a pixel is painted where the author put it, or it is
 * not painted at all.
 */
export function stampMark(
  grid: IndexGrid,
  mark: Mark,
  pose: Pose,
  strained: boolean,
): MarkPlacement {
  const targets = markTargets(mark, pose, strained);
  const allowed = MARK_SURFACES[mark.over];
  let painted = 0;
  for (const t of targets) {
    if (!allowed.includes(getPx(grid, t.x, t.y))) continue;
    setPx(grid, t.x, t.y, t.ink);
    painted += 1;
  }
  return { name: mark.name, requested: targets.length, painted };
}

/**
 * Apply the whole table to a rendered body.
 *
 * Call site is `renderLifterFrame`, between `despeckle` and `outlinePass`.
 */
export function applyMarks(
  grid: IndexGrid,
  pose: Pose,
  strained: boolean,
  marks: readonly Mark[] = MARKS,
): readonly MarkPlacement[] {
  return marks.map((mark) => stampMark(grid, mark, pose, strained));
}
