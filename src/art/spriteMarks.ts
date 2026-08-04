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
 * KIT AND FLESH ARE COUNTED SEPARATELY, AND THAT IS THE POINT
 * ---------------------------------------------------------------------------
 * The first version of this table was 25 marks and 252 pixels, and a blind A/B
 * still sent it back with a specific finding: THE KIT GOT DRAWN, THE FLESH DID
 * NOT. Roughly four fifths of every authored pixel was a worn object — shoe
 * sole, sleeve band, belt lever, wrist wrap, singlet trim, chest patch, hair —
 * and the objects landed at 90-100% while the handful of marks meant to break
 * the value ramp at anatomy landed 31-68%. On a bare-armed, bare-legged figure
 * whose largest single surface is skin, that is a well-dressed mannequin.
 *
 * Every mark therefore carries a `depicts` field, and both the tests and the
 * inspection sheet floor the FLESH share rather than the total. "How many
 * pixels did a hand place" is not the question; "is the body drawn" is.
 *
 * The other half of that finding was not a mark-table problem at all and could
 * not have been fixed here: `drawLimb` shaded from the across-limb offset only,
 * so a limb's lit flank was a constant column from joint to joint by
 * construction. See `axialTerm` in `raster.ts`. Marks sit ON TOP of the
 * underpainting; if the underpainting guarantees a stripe, no number of marks
 * removes it.
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
 *     For the FLESH marks specifically: the blond wrestler's bare chest is a
 *     lit clavicular shelf, two pec masses split by a dark sternum notch and a
 *     hard dark line along the lower border of the pec — five rows of authored
 *     value on a chest about as wide as ours. His arm carries a highlight
 *     cluster on the deltoid, a dark insertion crease straight across the limb,
 *     and a second cluster on the biceps below it. Sampled at native scale his
 *     skin runs from `@ref skin.luma0 = 52.8` to `@ref skin.luma5 = 233.8`
 *     across six steps, with the top two covering
 *     `@ref skin.topTwoShare = 25.6%` of his skin — the figure holds the
 *     brightest pixels in the frame and the crowd behind him has a mean of
 *     `@ref crowd.meanLuma = 36.8`.
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
import { RIG_GEOMETRY, kneeSleeveSpan, singletHemY, type Pose } from './rig';
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
 * PAL.OUTLINE is never in any of these, and the reason has narrowed. It used to
 * be that a mark must not overwrite the drawing's own interior outlines, since
 * those separated one mass from the next; there are now almost none of those to
 * protect, because every mass is ringed in its OWN darkest step rather than in
 * near-black (`INTERIOR_EDGE` in `palette.ts`). What is left is the silhouette
 * keyline `outlinePass` puts round the outside, and a mark that painted over
 * THAT would punch a hole in the figure's edge — which is the same rule with a
 * smaller and more honest justification.
 *
 * A useful side effect of the narrowing: a mark aimed at the flank of a limb now
 * lands, where before it hit the keyline and was dropped. The authored budget
 * that reaches a frame went up 267-302 px to 276-303 px on the four inspection
 * poses when the arms came off the keyline, with no mark table change.
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
  | 'BICEPS'
  | 'ELBOW'
  | 'FOREARM'
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
 * language `SHADING.FAR_LIMB_LIGHT_SCALE` uses: the frontal view is shaded as
 * if the lifter were turned a couple of degrees, so the screen-right limbs
 * stand a little further from the lamp. A mark that lightens skin therefore has
 * to be authored twice, once per side, at different ramp steps — a single
 * `BOTH` highlight would paint the far arm as bright as the near one and undo
 * the separation.
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
  /**
   * Trap anchor, as a fraction of the shoulder half-width.
   *
   * 0.75, not the 0.3 it was. At 0.3 the anchor sat between the singlet's two
   * straps, so the bar's contact shadow was asking to be painted on the straps
   * and the `over: SKIN` test — correctly — refused: the mark landed on 10 of
   * 16 requested pixels and the sprite had no bar-contact cue on a third of the
   * frames a critic looks at. The trap mass runs out to ATTACH.TRAP_HALF_W
   * (0.95) and the straps sit at 0.42-0.5, so 0.75 is bare trap at every pose,
   * with a pixel of clearance on each side for a three-wide run.
   */
  TRAP_HALF_W: 0.75,
  /** Trap anchor, rows below the shoulder line. */
  TRAP_DROP: 0,
  /** Strap anchor, as a fraction of the shoulder half-width. */
  STRAP_HALF_W: 0.46,
  /** Strap anchor, rows above the chest landmark. */
  STRAP_LIFT: 2,
  /**
   * Biceps anchor: this far from the shoulder toward the elbow.
   *
   * Proximal on purpose — the belly of the biceps sits in the upper third of
   * the upper arm, and past halfway the near forearm crosses in front of it at
   * squat depth and there is no upper arm left to paint on.
   */
  BICEPS_TOWARD_ELBOW: 0.42,
  /** Forearm anchor: this far from the elbow toward the hand. */
  FOREARM_TOWARD_HAND: 0.42,
  /** Wrist anchor: this far from the hand toward the elbow. */
  WRIST_TOWARD_ELBOW: 0.28,
  /** Quad anchor: this far from the hip toward the knee. */
  QUAD_TOWARD_KNEE: 0.34,
  /** Shin anchor: this far from the ankle toward the knee. */
  SHIN_ABOVE_ANKLE: 0.12,
  /**
   * Calf anchor: this far from the ankle toward the knee.
   *
   * 0.34, not 0.45. The knee sleeve covers the leg down to roughly a quarter of
   * the way from knee to ankle, so at 0.45 the anchor sat behind the sleeve and
   * anything authored above it was painted on gear and refused. What is bare is
   * the band from the sleeve hem to the shoe, and 0.34 sits in the middle of it
   * at every pose.
   */
  CALF_ABOVE_ANKLE: 0.34,
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
      return at(CENTER_X, singletHemY(pose));
    case 'DELTOID':
      return at(
        CENTER_X + sign * pose.shoulderHalfW * G.ATTACH.DELTOID,
        pose.shoulderY + G.NUDGE.DELTOID_DROP,
      );
    // Biceps and forearm bellies. Anchored to the SAME two endpoints the arm
    // capsules are drawn between (`drawArm`), not to a joint plus an offset, so
    // they stay on the muscle when the elbow tucks in on a grind.
    case 'BICEPS': {
      const shX = CENTER_X + sign * pose.shoulderHalfW * G.ATTACH.ARM_ROOT;
      const elX = CENTER_X + sign * pose.elbowHalfW;
      const f = A.BICEPS_TOWARD_ELBOW;
      return at(shX + (elX - shX) * f, pose.shoulderY + (pose.elbowY - pose.shoulderY) * f);
    }
    case 'ELBOW':
      return at(CENTER_X + sign * pose.elbowHalfW, pose.elbowY);
    case 'FOREARM': {
      const elX = CENTER_X + sign * pose.elbowHalfW;
      const handX = CENTER_X + sign * (pose.handHalfW + (sign > 0 ? G.GRIP_ASYMMETRY_PX : 0));
      const f = A.FOREARM_TOWARD_HAND;
      return at(elX + (handX - elX) * f, pose.elbowY + (pose.handY - pose.elbowY) * f);
    }
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
      const s = kneeSleeveSpan(pose, sign);
      if (key === 'SLEEVE_TOP') return at(s.topX, s.topY);
      if (key === 'SLEEVE_BOTTOM') return at(s.botX, s.botY);
      return at((s.topX + s.botX) / 2, (s.topY + s.botY) / 2);
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

/**
 * What a mark DEPICTS, as opposed to what surface it is allowed to paint on.
 *
 * The two are not the same question and conflating them is what let the last
 * authoring pass go wrong: the chest patch and the strap seam both paint over
 * SINGLET and are worn kit, while the bar's contact shadow paints over SKIN and
 * is a shadow cast BY kit; the pec shelf paints over SKIN and is flesh.
 *
 * This field exists because "how many pixels did a hand place" turned out to be
 * the wrong number to watch. The table cleared that bar comfortably while
 * roughly 80% of its pixels were objects — shoes, sleeves, belt, wraps, trim,
 * patch, hair — on a figure whose largest surface by far is bare skin. Splitting
 * the count is the only way the tests and the inspection sheet can tell the
 * difference between a well-dressed mannequin and a drawn body.
 */
export type MarkSubject = 'KIT' | 'FLESH';

export interface Mark {
  /** Names the object or landmark, not the shape. Used by the tests. */
  readonly name: string;
  /** Worn object, or bare anatomy. See MarkSubject. */
  readonly depicts: MarkSubject;
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
    depicts: 'KIT',
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
  //
  // THE INK IS `s` — SKIN_SHADOW, the darkest step of the face's OWN ramp — and
  // not `K`. Sampled off sprite-ref-1 at native scale, the blond wrestler's eye
  // sockets, brow and mouth are drawn in HIS darkest skin step (luma 53 of a
  // 53-234 ramp) and there is no near-black anywhere on his face; the only
  // near-black inside his head box at all is the darkest step of his red
  // headband. Ours were `PAL.OUTLINE` at luma 19, which is why our head window
  // measured 16.9% interior keyline against the reference head's
  // `@ref head.interiorKeylineShare = 3.67%` — four and a half times the rate,
  // on a face a third the size. A face at this scale is value steps inside one
  // ramp, which is the rule `INTERIOR_EDGE` already applies to every other
  // boundary on this figure.
  //
  // GDD §7.3 TIER 1: these three marks are an EXPRESSION, not a likeness — two
  // eye pixels and a mouth that changes shape under strain, on a seven-pixel
  // skull. No portrait and no wordmark reaches the base sprite; those are Tier 3
  // surfaces (cut-ins, character select, shop, result card).
  {
    name: 'FACE_CALM',
    depicts: 'FLESH',
    anchor: 'HEAD',
    side: 'CENTER',
    over: 'SKIN',
    gate: 'CALM',
    origin: [-1, 0],
    map: [
      's  s',
      '    ',
      ' ss ',
    ],
  },
  // Braced and grimacing: the brow comes down as a bar over both eyes and the
  // mouth opens. A different drawing, not a darker one.
  //
  // Origin is [-1, 0], not [-1, -1]: a row higher put the brow bar on the hair
  // mass, which is not in the SKIN surface class, and the strained face threw
  // away four of its ten pixels on every strained frame.
  {
    name: 'FACE_STRAINED',
    depicts: 'FLESH',
    anchor: 'HEAD',
    side: 'CENTER',
    over: 'SKIN',
    gate: 'STRAINED',
    origin: [-1, 0],
    map: [
      'ssss',
      's  s',
      '    ',
      'ssss',
    ],
  },
  // --- torso --------------------------------------------------------------
  // Trap ridge: the shelf of muscle the bar is actually sitting on. Authored
  // twice, near brighter than far, because a single BOTH map at one ink would
  // paint the far trap as light as the near one and undo the far-side lamp
  // falloff (SHADING.FAR_LIMB_LIGHT_SCALE).
  //
  // This and the shadow below are the pair that makes a back squat read as a
  // back squat from the front: a lit ridge with a hard dark line under it says
  // "there is a bar across this man's shoulders" more directly than the bar,
  // which is drawn behind him and mostly hidden.
  {
    name: 'TRAP_RIDGE_NEAR',
    depicts: 'FLESH',
    anchor: 'TRAP',
    side: 'NEAR',
    over: 'SKIN',
    origin: [-1, -2],
    map: [
      'hhh',
      'hhh',
    ],
  },
  {
    name: 'TRAP_RIDGE_FAR',
    depicts: 'FLESH',
    anchor: 'TRAP',
    side: 'FAR',
    over: 'SKIN',
    origin: [-1, -2],
    map: [
      'lll',
      'lll',
    ],
  },
  // The bar is drawn behind the lifter, so nothing else says it is resting on
  // him. This is its contact shadow across the traps, sitting on the shoulder
  // line directly under the ridge above.
  //
  // A row lower and it collided with the deltoid marks, which are anchored a
  // few hundredths of a shoulder half-width away and are applied later — the
  // shadow was painted and then immediately overwritten on two thirds of the
  // frames, which counts as landed to the stamper and as absent to anyone
  // looking at the picture.
  {
    name: 'TRAP_BAR_SHADOW',
    depicts: 'FLESH',
    anchor: 'TRAP',
    side: 'BOTH',
    over: 'SKIN',
    origin: [-1, 0],
    map: ['sss'],
  },
  // Singlet strap: a dark seam down its shadowed flank, and the shadow it
  // throws onto bare chest beside it. The light is upper-left, so both of those
  // are on the strap's right.
  {
    name: 'STRAP_SEAM',
    depicts: 'KIT',
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
  // THE PEC SHELF. The largest patch of bare skin on the figure that is not a
  // limb, and until this mark existed it carried no authored pixel at all: the
  // only marks on the torso were two cast shadows thrown by objects, so the
  // chest was one flat field at one ramp step with a strap shadow beside it.
  //
  // Five rows and four columns of chest, read off the reference wrestlers at
  // native scale: a lit clavicular shelf across the top, two pec masses, a dark
  // sternum notch splitting them, and a hard dark line along the lower border
  // of the pec. The near pec is authored a full ramp step brighter than the far
  // one and the notch is one column off centre — the lamp is upper-left and the
  // figure is drawn as if turned a couple of degrees, so a symmetric chest here
  // would undo both.
  //
  // It sits between the straps, so at poses where the chest collapses and the
  // straps steepen the outer columns simply do not paint. The 'over: SKIN' test
  // is doing that, not a conditional.
  {
    name: 'PEC_SHELF',
    depicts: 'FLESH',
    anchor: 'CHEST',
    side: 'CENTER',
    over: 'SKIN',
    origin: [-2, -5],
    map: [
      'hhll',
      'hhsl',
      'hhsl',
      'lssl',
      'ssss',
    ],
  },
  // The shadow each singlet strap throws onto the chest beside it. AFTER the
  // pec shelf, not before: the strap sits on the pec, so its shadow falls
  // across the pec's outer column and has to be the thing that wins there.
  // Applied first, the shelf simply repainted over it and the mark was dead.
  {
    name: 'STRAP_SHADOW',
    depicts: 'FLESH',
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
    depicts: 'KIT',
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
  //
  // ON the hem row, not one above it. The hem is a fraction along the thigh now
  // (`singletHemY`), which puts it closer to the belt at depth under strain —
  // and at depth 0.5 / strain 3 the row above the hem was inside the belt's own
  // edge ring, so the trim landed 0 px there. The last row of cloth is where a
  // leg-opening band belongs anyway.
  {
    name: 'SINGLET_HEM_TRIM',
    depicts: 'KIT',
    anchor: 'HEM',
    side: 'CENTER',
    over: 'SINGLET',
    origin: [-7, 0],
    map: ['333333333333333'],
  },
  // --- belt ---------------------------------------------------------------
  // A lever belt: the plate is the dark rectangle spanning the belt's whole
  // height, the lever arm the two lit pixels down its middle, and it sits a
  // pixel off the midline because a real one does. This is the mark the
  // critique named — a 16-bit artist did not ship a belt with no buckle pixel.
  {
    name: 'BELT_LEVER',
    depicts: 'KIT',
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
    depicts: 'KIT',
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
  //
  // The origin is [-2, 0], not the [-4, 0] it was. Four pixels outboard put the
  // highlight cluster where the near forearm crosses in front of the upper arm
  // at squat depth, and nineteen of its twenty-eight pixels landed. The crease
  // row stays at anchor.y + 1: that relationship is what `spriteMarks.test.ts`
  // reads when it checks the arm ramp is broken rather than continuous.
  {
    name: 'DELTOID_MASS_NEAR',
    depicts: 'FLESH',
    anchor: 'DELTOID',
    side: 'NEAR',
    over: 'SKIN',
    origin: [-3, 0],
    map: [
      'hhh ',
      'ssss',
      ' hh ',
    ],
  },
  // The far deltoid starts on the deltoid line, not two rows above it: at
  // [-1, -2] its top two rows sat on the same pixels as the far trap ridge and
  // the far half of the bar's contact shadow, and — being later in the table —
  // it repainted both. The bar shadow measured as landing on 56% of its
  // requested pixels for that reason alone.
  {
    name: 'DELTOID_MASS_FAR',
    depicts: 'FLESH',
    anchor: 'DELTOID',
    side: 'FAR',
    over: 'SKIN',
    origin: [-1, 0],
    map: [
      'lll ',
      'ssss',
      ' ll ',
    ],
  },
  // Biceps and triceps, split. Below the deltoid the upper arm was one column
  // of one ramp step from the shoulder to the elbow — the shader can only give
  // a limb one value per cross-section, so the break has to be drawn.
  //
  // These are highlight clusters with NO dark row of their own, and that is
  // deliberate. An arm is about eleven rows tall here; with a shadow row in the
  // deltoid, the biceps, the elbow and the forearm it stops reading as a limb
  // and starts reading as a barcode. The reference wrestler's arm has exactly
  // two dark breaks in it — the deltoid insertion and the elbow — and large
  // flat mid-tone between the highlights. So the breaks live in
  // DELTOID_MASS_* and ELBOW_CREASE, and everything else is a cluster.
  {
    name: 'BICEPS_MASS_NEAR',
    depicts: 'FLESH',
    anchor: 'BICEPS',
    side: 'NEAR',
    over: 'SKIN',
    origin: [0, -1],
    map: [
      'hh ',
      'hhl',
      ' ll',
    ],
  },
  {
    name: 'BICEPS_MASS_FAR',
    depicts: 'FLESH',
    anchor: 'BICEPS',
    side: 'FAR',
    over: 'SKIN',
    origin: [-1, -1],
    map: [
      ' ll',
      'lll',
      ' ll',
    ],
  },
  // Elbow crease. Two pixels, and the whole job of them is that the forearm
  // does not read as a continuation of the upper arm.
  {
    name: 'ELBOW_CREASE',
    depicts: 'FLESH',
    anchor: 'ELBOW',
    side: 'BOTH',
    over: 'SKIN',
    origin: [-1, -1],
    map: [
      'ss',
      'ss',
    ],
  },
  // Forearm belly. The reference wrestlers' forearms are not tapered tubes:
  // there is a mass just below the elbow, a step down out of it, and then the
  // wrist. Ours ran one unbroken light column from the elbow crease to the
  // wrist wrap in every rendered frame.
  {
    name: 'FOREARM_BELLY_NEAR',
    depicts: 'FLESH',
    anchor: 'FOREARM',
    side: 'NEAR',
    over: 'SKIN',
    origin: [-1, -1],
    map: [
      'hh ',
      'hhl',
      ' ll',
    ],
  },
  {
    name: 'FOREARM_BELLY_FAR',
    depicts: 'FLESH',
    anchor: 'FOREARM',
    side: 'FAR',
    over: 'SKIN',
    origin: [-1, -1],
    map: [
      'll ',
      'lll',
      ' ll',
    ],
  },
  // Wrist wraps. An object, so the forearm cannot read as one tapered tube from
  // the elbow to the hand — the reference squat photo has these on both wrists
  // and they are the most visible piece of kit on a lifter after the belt.
  {
    name: 'WRIST_WRAP',
    depicts: 'KIT',
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
  // THIS IS A SHALLOW-DEPTH MARK AND IT IS SUPPOSED TO DISAPPEAR. Past about
  // two thirds depth the thigh folds up until the singlet hem and the knee
  // sleeve meet over it and there is no bare thigh left to draw on — measured,
  // the quad marks paint 8 px a side at lockout and 0 in the hole. The
  // `over: SKIN` test is what makes that a non-event instead of a mark floating
  // on a singlet, and it is the reason the surface test exists at all.
  //
  // WHERE THAT LIMIT MOVED TO, and why it was worth moving: it used to be half
  // depth, and 133 of the 416 pose/strain/pitch combinations had no bare thigh
  // anywhere in the frame. Those frames are the whole bottom half of every rep,
  // and through them the legs were two kit tubes with nothing but more kit
  // drawn on them. A shorter, narrower knee sleeve and a hem that rides the
  // thigh instead of the hip landmark (`RIG_GEOMETRY.KNEE_SLEEVE`,
  // `singletHemY`) took that to 105 and 107 frames. It is not zero and must not
  // be: at full depth a front-on thigh really is two rows tall.
  {
    name: 'QUAD_SWEEP_NEAR',
    depicts: 'FLESH',
    anchor: 'QUAD',
    side: 'NEAR',
    over: 'SKIN',
    origin: [-3, -2],
    map: [
      'hhh',
      'hhs',
      'sss',
    ],
  },
  {
    name: 'QUAD_SWEEP_FAR',
    depicts: 'FLESH',
    anchor: 'QUAD',
    side: 'FAR',
    over: 'SKIN',
    origin: [1, -2],
    map: [
      'lll',
      'sll',
      'sss',
    ],
  },
  // Knee sleeve, top band. The reference knee pads all carry one; ours was a
  // plain shaded tube. GEAR_DARK rather than the outline colour: a pure black
  // run here merges with the outline already filling the gap between the legs
  // at lockout, and the two knees weld into one bar.
  {
    name: 'KNEE_SLEEVE_TOP_BAND',
    depicts: 'KIT',
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
    depicts: 'KIT',
    anchor: 'SLEEVE_BOTTOM',
    side: 'BOTH',
    over: 'GEAR',
    origin: [-4, 2],
    map: ['gggggggg'],
  },
  // An ABSTRACT ICON-MARK on the sleeve face — GDD §7.3 Tier 1, which carries
  // build, colorway and an icon-mark and never a wordmark. Two dark pixels, no
  // glyph, no letterform, and deliberately not a real manufacturer's shape:
  // powerlifting kit has a small set of very well-known makers and §12.3 refuses
  // any of them anywhere in an asset. Small on purpose in the drawing sense too:
  // two pixels is a mark, four is a stripe.
  {
    name: 'KNEE_SLEEVE_LOGO',
    depicts: 'KIT',
    anchor: 'SLEEVE_MID',
    side: 'BOTH',
    over: 'GEAR',
    origin: [-1, -1],
    map: [
      'g',
      'g',
    ],
  },
  // THE LOWER LEG. What is actually bare here is not the calf belly — the knee
  // sleeve covers that — it is the front of the shin from the sleeve hem to the
  // shoe, and on a front-on figure that is a lit tibial crest with the muscle
  // falling away in shade on one side of it.
  //
  // This is where the shader's guaranteed stripe was most visible: one unbroken
  // light column from sleeve hem to ankle on both legs in every frame. The
  // crest gives it a lit edge with a hard shaded flank, the taper ends it, and
  // the ankle shadow stops it running into the shoe.
  {
    name: 'SHIN_CREST_NEAR',
    depicts: 'FLESH',
    anchor: 'CALF',
    side: 'NEAR',
    over: 'SKIN',
    origin: [-2, -2],
    map: [
      'hhl ',
      'hhls',
      'hhls',
    ],
  },
  {
    name: 'SHIN_CREST_FAR',
    depicts: 'FLESH',
    anchor: 'CALF',
    side: 'FAR',
    over: 'SKIN',
    origin: [-2, -2],
    map: [
      'lls ',
      'llss',
      'llss',
    ],
  },
  // Where the calf belly stops and the tendon starts.
  {
    name: 'CALF_TAPER',
    depicts: 'FLESH',
    anchor: 'CALF',
    side: 'BOTH',
    over: 'SKIN',
    origin: [-2, 2],
    map: ['sss'],
  },
  // The ankle bone, so the shin does not run straight into the shoe.
  {
    name: 'ANKLE_SHADOW',
    depicts: 'FLESH',
    anchor: 'SHIN',
    side: 'BOTH',
    over: 'SKIN',
    origin: [-1, 0],
    map: ['sss'],
  },
  // Flat squat shoe: mid-grey collar, dark upper, pale sole. Three authored
  // rows, which is why `FOOT_H` had to become three — at the two rows it had
  // before, the sole line and the upper were the same pixel. The sole is the
  // mark that stops a shoe reading as a grey lump with a lighter top row.
  {
    name: 'SHOE_COLLAR',
    depicts: 'KIT',
    anchor: 'SHOE',
    side: 'BOTH',
    over: 'GEAR',
    origin: [-4, 0],
    map: ['GGGGGGGGG'],
  },
  {
    name: 'SHOE_UPPER',
    depicts: 'KIT',
    anchor: 'SHOE',
    side: 'BOTH',
    over: 'GEAR',
    origin: [-4, 1],
    map: ['ggggggggg'],
  },
  {
    name: 'SHOE_SOLE',
    depicts: 'KIT',
    anchor: 'SHOE',
    side: 'BOTH',
    over: 'GEAR',
    origin: [-4, 2],
    map: ['WWWWWWWWW'],
  },
  // Laces on the instep. Two pixels of chalk-white against the dark upper.
  {
    name: 'SHOE_LACES',
    depicts: 'KIT',
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
