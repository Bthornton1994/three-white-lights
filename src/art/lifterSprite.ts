/**
 * Lifter sprite composition — pose + bar + plates into one index grid.
 *
 * Pure: no React, no I/O, no randomness. Same inputs, same pixels.
 *
 * Draw order is back to front, the way a sprite sheet is layered:
 *
 *     bar and plates            (behind the lifter; the bar sits on the traps)
 *     far-side leg / near leg
 *     neck                      (before the torso, so the traps cover its cap)
 *     torso, singlet, belt
 *     arms
 *     skull and hair mass
 *     hands on the bar          (in front of the bar, gripping it)
 *     chalk
 *     despeckle
 *     HAND-PLACED MARKS         (`spriteMarks.ts`)
 *     outline pass
 *
 * Everything above the marks line is an underpainting: masses resolved from
 * geometry under one key light, plus `axialTerm`'s belly-and-joints profile so
 * a limb is not a constant column down its length. That is all a shading model
 * can give you. The marks line is where the objects AND THE FLESH go on —
 * buckle, sole line, singlet trim, face, hair fringe, knee-sleeve banding, and
 * the pec shelf, trap ridge, deltoid, biceps, forearm belly, quad sweep and
 * shin crest. It sits after `despeckle` on purpose: that pass cannot tell a
 * deliberate one-pixel eye from noise, and it used to eat them.
 *
 * The split between those two groups is tracked, not assumed: every mark says
 * whether it depicts KIT or FLESH, and the tests floor the flesh share. A
 * previous pass cleared a large authored-pixel budget with four fifths of it on
 * worn objects and the body itself almost untouched.
 *
 * The frontal view has no true far and near side, so the sprite is shaded as if
 * the lifter were turned a couple of degrees: the screen-right limbs render one
 * ramp step darker (SHADING.FAR_LIMB_STEP_BIAS). Together with the upper-left
 * key light and the off-centre head this is what stops a mirror-symmetric pose
 * from rendering as a mirror-symmetric image, which is the giveaway of a sprite
 * that was generated rather than drawn. The mark table respects it: marks are
 * translated to each side, never mirrored, and the deltoid is authored twice.
 */

import {
  BAR,
  BEND,
  CENTER_X,
  CHALK,
  SHADING,
  SHADOW,
  STRAIN,
  RESOLUTION,
} from './spriteTuning';
import {
  BANK_SIZE,
  INTERIOR_EDGE,
  PAL,
  RAMPS,
  interiorEdgeFor,
  isTransparentIndex,
  type Ramp,
} from './palette';
import {
  CELL,
  RIG_GEOMETRY,
  barYForPose,
  deformPose,
  kneeSleeveSpan,
  pitchForLevel,
  poseAtDepth,
  singletHemY,
  strainForLevel,
  type Pose,
  type RepDirection,
} from './rig';
import {
  createGrid,
  drawEllipsoid,
  drawLimb,
  drawPlateEdge,
  drawTrunk,
  despeckle,
  getPx,
  outlinePass,
  setPx,
  type IndexGrid,
} from './raster';
import {
  BAR_AND_COLLARS_KG,
  PLATE_HUE_RAMPS,
  layoutSleeve,
  visualPlateStack,
  type SleeveLayout,
} from './plates';
import { applyMarks, type MarkPlacement } from './spriteMarks';
import type { SquatFrame } from './squatAnimation';

const DEG = Math.PI / 180;

export interface LifterFrameSpec {
  /** 0 = standing, 1 = bottom of the hole. Quantised by the animation. */
  readonly depth: number;
  readonly direction: RepDirection;
  /** Quantised strain level, 0..STRAIN.LEVELS-1. */
  readonly strainLevel: number;
  /** Quantised pitch level, 0..PITCH.LEVELS-1. Defaults to 0 when omitted. */
  readonly pitchLevel?: number;
  readonly barLateralPx: number;
  readonly barTiltDeg: number;
  readonly barBendPx: number;
  readonly chalkMotes: number;
  /** Total weight on the bar including bar and collars, kg. */
  readonly totalKg: number;
  readonly barKg?: number;
}

/** Everything the renderer resolved, for callers that need to draw alongside. */
export interface RenderedFrame {
  readonly grid: IndexGrid;
  readonly pose: Pose;
  readonly barCenterY: number;
  readonly sleeve: SleeveLayout;
  readonly strain: number;
  readonly pitch: number;
  /**
   * What each hand-placed mark actually landed on this frame. Reported rather
   * than assumed: a mark whose `painted` is 0 is authored at a position the
   * body does not reach, and the only way to know is to count.
   */
  readonly marks: readonly MarkPlacement[];
}

export function frameSpecFrom(frame: SquatFrame, totalKg: number, barKg?: number): LifterFrameSpec {
  return {
    depth: frame.poseDepth,
    direction: frame.direction,
    strainLevel: frame.strainLevel,
    pitchLevel: frame.pitchLevel,
    barLateralPx: frame.barLateralPx,
    barTiltDeg: frame.barTiltDeg,
    barBendPx: frame.barBendPx,
    chalkMotes: frame.chalkMotes,
    totalKg,
    ...(barKg === undefined ? {} : { barKg }),
  };
}

// ---------------------------------------------------------------------------
// Bar
// ---------------------------------------------------------------------------

/**
 * Vertical offset of the bar at a signed distance from its centre.
 *
 * Tilt is linear in dx. Bend is `bendPx * (|dx| / HALF_SPAN)^EXPONENT`, so the
 * shaft between the sleeves stays nearly flat and the loaded ends droop — which
 * is what a loaded bar does. A uniformly curved bar is a bar nobody looked at.
 */
export function barOffsetAt(dx: number, tiltDeg: number, bendPx: number): number {
  const tilt = Math.tan(tiltDeg * DEG) * dx;
  const droop = bendPx * Math.pow(Math.abs(dx) / BAR.HALF_SPAN_PX, BEND.EXPONENT);
  return tilt + droop;
}

function drawSteelSpan(
  g: IndexGrid,
  cx: number,
  barCy: number,
  fromDx: number,
  toDx: number,
  thickness: number,
  tiltDeg: number,
  bendPx: number,
  ramp: Ramp,
): void {
  for (let dx = fromDx; dx <= toDx; dx += 1) {
    const y = barCy + barOffsetAt(dx, tiltDeg, bendPx);
    const top = Math.round(y - thickness / 2);
    for (let i = 0; i < thickness; i += 1) {
      // Top row catches the key light, bottom row is in shadow: a 2px bar has
      // room for exactly one highlight and one shadow, and no more.
      const idx = i === 0 ? (ramp[ramp.length - 1] ?? 0) : (ramp[0] ?? 0);
      setPx(g, Math.round(cx + dx), top + i, idx);
    }
  }
}

function drawBarAndPlates(
  g: IndexGrid,
  barCy: number,
  lateralPx: number,
  tiltDeg: number,
  bendPx: number,
  sleeve: SleeveLayout,
): void {
  const cx = CENTER_X + lateralPx;

  // Shaft, then the thicker sleeves out to the ends. The shaft uses the dark
  // half of the steel ramp: a 2px full-brightness line across the whole cell
  // out-values the lifter and drags the eye off him.
  drawSteelSpan(
    g,
    cx,
    barCy,
    -BAR.SHAFT_HALF_PX,
    BAR.SHAFT_HALF_PX,
    BAR.SHAFT_THICKNESS_PX,
    tiltDeg,
    bendPx,
    RAMPS.SHAFT,
  );
  for (const sign of [-1, 1]) {
    const from = sign < 0 ? -BAR.HALF_SPAN_PX : BAR.SHAFT_HALF_PX;
    const to = sign < 0 ? -BAR.SHAFT_HALF_PX : BAR.HALF_SPAN_PX;
    drawSteelSpan(g, cx, barCy, from, to, BAR.SHAFT_THICKNESS_PX + 1, tiltDeg, bendPx, RAMPS.SHAFT);
  }

  // Knurl rings: two darker marks where a lifter measures grip width.
  for (const ringDx of BAR.KNURL_RING_DX) {
    for (const sign of [-1, 1]) {
      const dx = sign * ringDx;
      const y = barCy + barOffsetAt(dx, tiltDeg, bendPx);
      setPx(g, Math.round(cx + dx), Math.round(y - BAR.SHAFT_THICKNESS_PX / 2), PAL.STEEL_DARK);
    }
  }

  // Discs, inboard first, mirrored onto both sleeves.
  for (const slot of sleeve.slots) {
    const ramp = PLATE_HUE_RAMPS[slot.plate.spec.hue];
    for (const sign of [-1, 1]) {
      const dxMid = sign * (slot.dxInner + slot.facePx / 2);
      const cy = barCy + barOffsetAt(dxMid, tiltDeg, bendPx);
      const xInner =
        sign < 0
          ? Math.round(cx - slot.dxInner - slot.facePx)
          : Math.round(cx + slot.dxInner);
      drawPlateEdge(g, xInner, slot.facePx, cy, slot.plate.diameterPx, ramp);
    }
  }

  // Collars, plus their single specular pixel. The collar body is mid steel on
  // purpose (see RAMPS.CHROME): a bright block here out-values the lifter's own
  // skin, and the figure is supposed to be the brightest thing in his frame.
  for (const sign of [-1, 1]) {
    const dxMid = sign * (sleeve.collarDxInner + BAR.COLLAR_WIDTH_PX / 2);
    const cy = barCy + barOffsetAt(dxMid, tiltDeg, bendPx);
    const xInner =
      sign < 0
        ? Math.round(cx - sleeve.collarDxInner - BAR.COLLAR_WIDTH_PX)
        : Math.round(cx + sleeve.collarDxInner);
    drawPlateEdge(g, xInner, BAR.COLLAR_WIDTH_PX, cy, BAR.COLLAR_HEIGHT_PX, RAMPS.CHROME);
    const top = Math.round(cy - BAR.COLLAR_HEIGHT_PX / 2);
    for (let k = 0; k < BAR.COLLAR_SPECULAR.RUN_PX; k += 1) {
      setPx(
        g,
        xInner + BAR.COLLAR_SPECULAR.DX,
        top + BAR.COLLAR_SPECULAR.DY + k,
        PAL.CHROME_HI,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------

/**
 * A leg, from hip to sole.
 *
 * EVERY PART HERE SEPARATES WITH ITS OWN SHADOW, NOT WITH A BLACK LINE
 * (`INTERIOR_EDGE`). Four masses overlap in this small a space — thigh, shin,
 * sleeve, shoe — and with the default near-black ring each boundary cost two
 * columns of luma-19 pixels once `outlinePass` had added its own. Measured over
 * the lower half of the figure that was 52% of the body's pixels, against 4% on
 * the same split of sprite-ref-1, whose limbs are edged in their own darkest
 * step. The silhouette keyline is unaffected: `outlinePass` still runs.
 */
function drawLeg(g: IndexGrid, pose: Pose, sign: number, bias: number): void {
  const cx = CENTER_X;
  const hipX = cx + sign * pose.hipHalfW * RIG_GEOMETRY.ATTACH.THIGH_ROOT;
  const kneeX = cx + sign * pose.kneeHalfW;
  const ankleX = cx + sign * pose.ankleHalfW;
  const fleshOpts = {
    stepBias: bias,
    edge: true,
    edgeIndex: INTERIOR_EDGE.SKIN,
    edgeFollowsLight: true,
  };
  const gearOpts = {
    stepBias: bias,
    edge: true,
    edgeIndex: INTERIOR_EDGE.GEAR,
    edgeFollowsLight: true,
  };

  drawLimb(
    g,
    hipX,
    pose.hipY,
    kneeX,
    pose.kneeY,
    RIG_GEOMETRY.THIGH_R[0],
    RIG_GEOMETRY.THIGH_R[1],
    RAMPS.SKIN,
    fleshOpts,
  );
  // The shin's endpoint is lifted by its own end radius so the capsule's rounded
  // cap finishes AT the top of the shoe rather than a pixel past the floor. The
  // cap still reaches the ankle, so no bare leg is lost; what goes away is the
  // one stray pixel the cap used to leave under each sole, which was invisible
  // while it was outline-coloured and is not now that edges are material shadow.
  drawLimb(
    g,
    kneeX,
    pose.kneeY,
    ankleX,
    pose.ankleY + RIG_GEOMETRY.FOOT_DROP - RIG_GEOMETRY.SHIN_R[1],
    RIG_GEOMETRY.SHIN_R[0],
    RIG_GEOMETRY.SHIN_R[1],
    RAMPS.SKIN,
    fleshOpts,
  );

  // Knee sleeve, following the leg's own axis through the joint rather than a
  // vertical, so it stays on the knee when the knee is out at depth.
  const KS = RIG_GEOMETRY.KNEE_SLEEVE;
  const span = kneeSleeveSpan(pose, sign);
  drawLimb(g, span.topX, span.topY, span.botX, span.botY, KS.R[0], KS.R[1], RAMPS.GEAR, gearOpts);

  // Shoe. Inset by the ring at both ends so the drawn object still occupies
  // exactly FOOT_H rows and its sole still lands on FLOOR_Y - 1.
  const inset = RIG_GEOMETRY.EDGE_INSET_PX;
  drawTrunk(
    g,
    ankleX + sign * RIG_GEOMETRY.FOOT_FLARE,
    pose.ankleY + RIG_GEOMETRY.FOOT_DROP + inset,
    CELL.FLOOR_Y - 1 - inset,
    RIG_GEOMETRY.FOOT_W / 2 - 1 - inset,
    RIG_GEOMETRY.FOOT_W / 2 - inset,
    RAMPS.GEAR,
    gearOpts,
  );
}

function drawArm(g: IndexGrid, pose: Pose, sign: number, bias: number, skin: Ramp): void {
  const cx = CENTER_X;
  const shX = cx + sign * pose.shoulderHalfW * RIG_GEOMETRY.ATTACH.ARM_ROOT;
  const elX = cx + sign * pose.elbowHalfW;
  const grip = pose.handHalfW + (sign > 0 ? RIG_GEOMETRY.GRIP_ASYMMETRY_PX : 0);
  const haX = cx + sign * grip;
  const opts = { stepBias: bias, edge: true };

  drawLimb(
    g,
    shX,
    pose.shoulderY,
    elX,
    pose.elbowY,
    RIG_GEOMETRY.UPPER_ARM_R[0],
    RIG_GEOMETRY.UPPER_ARM_R[1],
    RAMPS.SKIN,
    opts,
  );
  drawLimb(
    g,
    elX,
    pose.elbowY,
    haX,
    pose.handY,
    RIG_GEOMETRY.FOREARM_R[0],
    RIG_GEOMETRY.FOREARM_R[1],
    skin,
    opts,
  );
}

function drawHand(
  g: IndexGrid,
  pose: Pose,
  sign: number,
  barCy: number,
  lateralPx: number,
  tiltDeg: number,
  bendPx: number,
  bias: number,
): void {
  const grip = pose.handHalfW + (sign > 0 ? RIG_GEOMETRY.GRIP_ASYMMETRY_PX : 0);
  const dx = sign * grip;
  const x = CENTER_X + lateralPx + dx;
  const y = barCy + barOffsetAt(dx, tiltDeg, bendPx);
  drawEllipsoid(
    g,
    x,
    y,
    RIG_GEOMETRY.HAND_R,
    RIG_GEOMETRY.HAND_R + RIG_GEOMETRY.NUDGE.HAND_TALL,
    RAMPS.SKIN,
    {
      stepBias: bias,
      edge: true,
    },
  );
  // Chalked knuckles: two pixels, side by side. Two rather than one because
  // `despeckle` runs before the hand is finished and ate the single pixel this
  // used to be — it never reached a rendered frame. Side by side, each is the
  // other's like-indexed neighbour and the pass leaves them alone.
  const kx = Math.round(x - 1);
  const ky = Math.round(y - 1);
  setPx(g, kx, ky, PAL.GEAR_LIGHT);
  setPx(g, kx + 1, ky, PAL.GEAR_LIGHT);
}

/**
 * Neck. Drawn BEFORE the torso, not with the head.
 *
 * `drawLimb` with `edge` grows the capsule by a pixel and stamps the outline
 * colour around it, and a capsule has rounded ends — so the neck's lower cap
 * reached three rows below the shoulder line and, drawn after the torso, left a
 * four-by-three block of pure outline sitting in the middle of the bare chest.
 * Drawn first, the trap mass covers the cap and only the throat shows.
 */
function drawNeck(g: IndexGrid, pose: Pose, skin: Ramp): void {
  const G = RIG_GEOMETRY;
  drawLimb(
    g,
    CENTER_X + pose.headDx,
    pose.headY + G.HEAD_RY - G.NECK_OVERLAP,
    CENTER_X,
    pose.shoulderY + G.NECK_OVERLAP,
    G.NECK_R,
    G.NECK_R + G.NUDGE.NECK_FLARE,
    skin,
    { edge: true },
  );
}

/**
 * Skull and hair mass. The FACE is not here — eyes, mouth, brow and the
 * fringe's shape are hand-placed pixels in `spriteMarks.ts`, stamped after
 * `despeckle`, because every one of them drawn at this point in the pipeline
 * was being eaten before it reached a PNG.
 */
function drawHead(g: IndexGrid, pose: Pose, skin: Ramp): void {
  const hx = CENTER_X + pose.headDx;
  const hy = pose.headY;
  const G = RIG_GEOMETRY;

  drawEllipsoid(g, hx, hy, G.HEAD_RX, G.HEAD_RY, skin, {
    edge: true,
    stepBias: G.HEAD_STEP_BIAS,
  });
  drawEllipsoid(g, hx, hy - G.HEAD_RY + G.HAIR_RY, G.HEAD_RX - 0.1, G.HAIR_RY, RAMPS.HAIR, {});
}

function drawTorso(g: IndexGrid, pose: Pose): void {
  const cx = CENTER_X;
  const A = RIG_GEOMETRY.ATTACH;
  const trapTop = pose.shoulderY - A.TRAP_RISE;
  const trapHalf = pose.shoulderHalfW * A.TRAP_HALF_W;

  // Traps and shoulders first, high enough to swallow the bar behind the neck:
  // from the front you see the bar emerge past the delts, not cross the throat.
  //
  // AXIAL_TRUNK, not the flat profile the other trunk calls take: this one is
  // flesh. It puts the pec shelf high and lets the value fall into the waist,
  // so the bare chest is not one field at one ramp step.
  drawTrunk(g, cx, trapTop, pose.hipY, trapHalf, pose.hipHalfW, RAMPS.SKIN, {
    axial: SHADING.AXIAL_TRUNK,
  });

  // Deltoid caps: without these the shoulder line is a straight cut and the
  // whole figure reads as a mannequin.
  for (const sign of [-1, 1]) {
    drawEllipsoid(
      g,
      cx + sign * pose.shoulderHalfW * A.DELTOID,
      pose.shoulderY + RIG_GEOMETRY.NUDGE.DELTOID_DROP,
      A.DELTOID_R,
      A.DELTOID_R,
      RAMPS.SKIN,
      { stepBias: sign > 0 ? SHADING.FAR_LIMB_STEP_BIAS : 0 },
    );
  }

  // Singlet, starting where the straps meet the chest. Its top half-width has
  // to match the torso's half-width at that row or the singlet overhangs the
  // body, so it is interpolated from the same trapezoid the torso used.
  const chestHalf =
    trapHalf +
    (pose.hipHalfW - trapHalf) *
      ((pose.chestY - trapTop) / Math.max(1, pose.hipY - trapTop));

  drawTrunk(
    g,
    cx,
    pose.chestY,
    singletHemY(pose),
    chestHalf,
    pose.hipHalfW + RIG_GEOMETRY.NUDGE.SINGLET_FLARE,
    RAMPS.SINGLET,
    {},
  );

  for (const sign of [-1, 1]) {
    drawLimb(
      g,
      cx + sign * pose.shoulderHalfW * A.STRAP_TOP,
      pose.shoulderY - RIG_GEOMETRY.NUDGE.STRAP_LIFT,
      cx + sign * pose.shoulderHalfW * A.STRAP_BOTTOM,
      pose.chestY,
      A.STRAP_R[0],
      A.STRAP_R[1],
      RAMPS.SINGLET,
      {},
    );
  }

  // Belt.
  drawTrunk(
    g,
    cx,
    pose.waistY - RIG_GEOMETRY.BELT_H / 2,
    pose.waistY + RIG_GEOMETRY.BELT_H / 2,
    pose.waistHalfW + RIG_GEOMETRY.BELT_OVERHANG,
    pose.waistHalfW + RIG_GEOMETRY.BELT_OVERHANG,
    RAMPS.GEAR,
    {
      stepBias: RIG_GEOMETRY.BELT_STEP_BIAS,
      edge: true,
      edgeIndex: INTERIOR_EDGE.GEAR,
      edgeFollowsLight: true,
    },
  );
  // Belt marks — lever plate and tail — are hand-placed in `spriteMarks.ts`.
  // Nothing else about a belt is a function of the surface normal.
}

/**
 * Inner-leg seam.
 *
 * A front-on squat's two thighs meet in one continuous mass of pixels at the
 * hip, and without a line down the middle the whole lower body reads as a
 * single blob — which is what kills the depth cue that the squat is supposed to
 * deliver. Artists draw this line by hand. It is stamped only over pixels that
 * are already body, so when the legs are apart it does nothing at all.
 *
 * Drawn in the shadow step of whatever material it crosses rather than in flat
 * black: sprite-ref-1's crotch line is one pixel of the trunks' own darkest red,
 * not a keyline, and a black column here was the single longest run of luma-19
 * in the lower body.
 */
function drawInnerLegSeam(g: IndexGrid, pose: Pose): void {
  const x = Math.round(CENTER_X);
  const top = Math.round(Math.min(pose.hipY, pose.kneeY) + RIG_GEOMETRY.SEAM.TOP_OFFSET);
  const bottom = Math.round(pose.ankleY - RIG_GEOMETRY.SEAM.BOTTOM_OFFSET);
  for (let y = top; y <= bottom; y += 1) {
    const here = g.data[y * g.w + x];
    if (here === undefined || here === 0) continue;
    setPx(g, x, y, interiorEdgeFor(here));
  }
}

function drawChalk(
  g: IndexGrid,
  pose: Pose,
  motes: number,
  barCy: number,
  lateralPx: number,
): void {
  if (motes <= 0) return;
  const offsets = CHALK.MOTE_OFFSETS;
  for (const sign of [-1, 1]) {
    const baseX = CENTER_X + lateralPx + sign * pose.handHalfW;
    for (let i = 0; i < Math.min(motes, offsets.length); i += 1) {
      const off = offsets[i];
      if (off === undefined) continue;
      setPx(g, Math.round(baseX + sign * off[0]), Math.round(barCy + off[1]), PAL.CHALK);
    }
  }
}

/**
 * Muscle cording — drawn only at STRAIN.CORD.MIN_LEVEL and above.
 *
 * A mark that exists in the grind drawing and does not exist in the light one
 * at all. Stamped over skin only, so it cannot escape the silhouette and cannot
 * land on the singlet or the belt, and always as a vertical run of RUN_PX so
 * `despeckle` does not eat it as noise.
 */
function drawCording(g: IndexGrid, pose: Pose, strainLevelValue: number): void {
  if (strainLevelValue < STRAIN.CORD.MIN_LEVEL) return;
  const C = STRAIN.CORD;
  const skin = new Set<number>([PAL.SKIN_SHADOW, PAL.SKIN_MID, PAL.SKIN_LIGHT, PAL.SKIN_HI, PAL.SKIN_FLUSH]);

  const stampRun = (x: number, yTop: number): void => {
    for (let k = 0; k < C.RUN_PX; k += 1) {
      const y = yTop + k;
      if (!skin.has(getPx(g, x, y))) return;
    }
    for (let k = 0; k < C.RUN_PX; k += 1) setPx(g, x, yTop + k, PAL.SKIN_SHADOW);
  };

  // Neck cords, either side of the throat, between the jaw and the traps.
  const neckMidY = Math.round((pose.neckY + pose.shoulderY) / 2 + C.NECK_DY);
  for (const sign of [-1, 1]) {
    stampRun(Math.round(CENTER_X + pose.headDx + sign * C.NECK_DX), neckMidY);
  }

  // Quad separation down the outer thigh, following the leg's own axis.
  for (const sign of [-1, 1]) {
    const hipX = CENTER_X + sign * pose.hipHalfW * RIG_GEOMETRY.ATTACH.THIGH_ROOT;
    const kneeX = CENTER_X + sign * pose.kneeHalfW;
    for (const frac of C.THIGH_FRACS) {
      const x = hipX + (kneeX - hipX) * frac + sign * C.THIGH_DX;
      const y = pose.hipY + (pose.kneeY - pose.hipY) * frac;
      stampRun(Math.round(x), Math.round(y));
    }
  }
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

/** Render one animation frame to an index grid with a transparent background. */
export function renderLifterFrame(spec: LifterFrameSpec): RenderedFrame {
  const strain = strainForLevel(spec.strainLevel);
  const pitch = pitchForLevel(spec.pitchLevel ?? 0);
  const pose = deformPose(poseAtDepth(spec.depth, spec.direction), strain, pitch);
  const barCy = barYForPose(pose);
  const stack = visualPlateStack(spec.totalKg, spec.barKg ?? BAR_AND_COLLARS_KG);
  const sleeve = layoutSleeve(stack);
  const skin = strain > STRAIN.FLUSH_THRESHOLD ? RAMPS.SKIN_FLUSHED : RAMPS.SKIN;

  const g = createGrid(CELL.W, CELL.H);

  drawBarAndPlates(g, barCy, spec.barLateralPx, spec.barTiltDeg, spec.barBendPx, sleeve);

  drawLeg(g, pose, 1, SHADING.FAR_LIMB_STEP_BIAS);
  drawLeg(g, pose, -1, 0);
  drawNeck(g, pose, skin);
  drawTorso(g, pose);
  drawInnerLegSeam(g, pose);
  drawArm(g, pose, 1, SHADING.FAR_LIMB_STEP_BIAS, skin);
  drawArm(g, pose, -1, 0, skin);
  drawHead(g, pose, skin);
  drawHand(g, pose, 1, barCy, spec.barLateralPx, spec.barTiltDeg, spec.barBendPx, SHADING.FAR_LIMB_STEP_BIAS);
  drawHand(g, pose, -1, barCy, spec.barLateralPx, spec.barTiltDeg, spec.barBendPx, 0);
  drawCording(g, pose, spec.strainLevel);
  drawChalk(g, pose, spec.chalkMotes, barCy, spec.barLateralPx);

  // Order matters, and all three steps are load-bearing.
  //
  // 1. `despeckle` on the raw underpainting. It replaces isolated pixels with a
  //    neighbour, and run after the outline it would happily eat a lone outline
  //    pixel and leave a hole in the silhouette.
  // 2. Hand-placed marks, which is everything a shading model cannot produce:
  //    buckle, sole line, singlet trim, strap shadow, hair fringe, face, sleeve
  //    banding, and the breaks in the value ramp at deltoid, elbow and knee.
  //    AFTER despeckle, not before. Drawn before it, an authored single pixel
  //    is indistinguishable from noise and gets replaced — which is exactly
  //    what happened to this sprite's eyes, mouth and chalked knuckles, none of
  //    which ever reached a rendered PNG.
  // 3. `outlinePass` last, so the outline is the final word on the shape. It
  //    only writes transparent pixels, so it cannot touch a mark.
  despeckle(g);
  const marks = applyMarks(g, pose, strain > STRAIN.FLUSH_THRESHOLD);
  outlinePass(g);

  return { grid: g, pose, barCenterY: barCy, sleeve, strain, pitch, marks };
}

// ---------------------------------------------------------------------------
// Body-only measurement
// ---------------------------------------------------------------------------

/**
 * Is this palette index part of the LIFTER, as opposed to the bar?
 *
 * Bank 0 is the character and bank 1 is the equipment (see `palette.ts`), and
 * the banks are the reason this question has an exact answer rather than a
 * bounding box. Everything the barbell contributes — shaft, discs, collars and
 * their outline — is bank 1. The hands, which are drawn in front of the bar,
 * are bank 0 and count as body.
 */
export function isBodyIndex(index: number): boolean {
  return !isTransparentIndex(index) && Math.floor(index / BANK_SIZE) === 0;
}

/** An inclusive pixel rectangle, for excluding a region from a diff. */
export interface PixelRect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export interface BodyPixelDiff {
  /** Body pixels whose palette index differs. Colour changes count. */
  readonly changed: number;
  /**
   * Pixels that are body in one grid and not body in the other. Pure shape:
   * a palette swap cannot move this number, so it is the honest measure of
   * "the silhouette is different", not "the lifter went redder".
   */
  readonly silhouette: number;
  /** Body pixels present in either grid — the denominator for the above. */
  readonly bodyArea: number;
}

/**
 * Compare two rendered frames at the body only.
 *
 * Everything the barbell draws is excluded by bank, so two frames rendered with
 * the same `totalKg` and the same bend/tilt differ here only where the LIFTER
 * differs. `exclude` drops a rectangle — the caller passes the head box to ask
 * the sharper question: with the face taken away, is anything else happening?
 */
export function bodyPixelDiff(a: IndexGrid, b: IndexGrid, exclude?: PixelRect): BodyPixelDiff {
  let changed = 0;
  let silhouette = 0;
  let bodyArea = 0;
  const w = Math.min(a.w, b.w);
  const h = Math.min(a.h, b.h);

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (
        exclude !== undefined &&
        x >= exclude.x0 &&
        x <= exclude.x1 &&
        y >= exclude.y0 &&
        y <= exclude.y1
      ) {
        continue;
      }
      const va = getPx(a, x, y);
      const vb = getPx(b, x, y);
      const ba = isBodyIndex(va);
      const bb = isBodyIndex(vb);
      if (!ba && !bb) continue;
      bodyArea += 1;
      if (ba !== bb) silhouette += 1;
      if (va !== vb) changed += 1;
    }
  }

  return { changed, silhouette, bodyArea };
}

/** Bounding box of the head, padded, for excluding the face from a diff. */
export function headBox(pose: Pose, pad: number = 2): PixelRect {
  const cx = CENTER_X + pose.headDx;
  return {
    x0: Math.floor(cx - RIG_GEOMETRY.HEAD_RX - pad),
    x1: Math.ceil(cx + RIG_GEOMETRY.HEAD_RX + pad),
    y0: Math.floor(pose.headY - RIG_GEOMETRY.HEAD_RY - pad),
    y1: Math.ceil(pose.headY + RIG_GEOMETRY.HEAD_RY + pad),
  };
}

/** Smallest rectangle containing both. Used to exclude two frames' heads. */
export function unionRect(a: PixelRect, b: PixelRect): PixelRect {
  return {
    x0: Math.min(a.x0, b.x0),
    y0: Math.min(a.y0, b.y0),
    x1: Math.max(a.x1, b.x1),
    y1: Math.max(a.y1, b.y1),
  };
}

/**
 * Contact shadow, as a separate layer so the sprite itself stays a sprite.
 * Narrows as the lifter descends: the key light is high, so a body closer to
 * the floor throws less.
 */
export function renderContactShadow(pose: Pose, depth: number): IndexGrid {
  const g = createGrid(CELL.W, CELL.H);
  const halfW =
    (SHADOW.BASE_HALF_W_PX + SHADOW.STANCE_GAIN * pose.ankleHalfW) *
    (1 - (1 - SHADOW.DEPTH_SHRINK) * Math.min(1, Math.max(0, depth)));
  const cy = CELL.FLOOR_Y;
  for (let y = Math.round(cy - SHADOW.HALF_H_PX); y <= Math.round(cy + SHADOW.HALF_H_PX); y += 1) {
    const ny = (y - cy) / SHADOW.HALF_H_PX;
    const span = halfW * Math.sqrt(Math.max(0, 1 - ny * ny));
    for (let x = Math.round(CENTER_X - span); x <= Math.round(CENTER_X + span); x += 1) {
      setPx(g, x, y, PAL.CONTACT_SHADOW);
    }
  }
  return g;
}

/** Flat backdrop and platform, for inspecting a frame in isolation. */
export function renderStage(): IndexGrid {
  const g = createGrid(CELL.W, CELL.H, PAL.BACKDROP_DARK);
  for (let y = 0; y < CELL.FLOOR_Y; y += 1) {
    const idx = y > CELL.FLOOR_Y - 18 ? PAL.BACKDROP_MID : PAL.BACKDROP_DARK;
    for (let x = 0; x < CELL.W; x += 1) setPx(g, x, y, idx);
  }
  for (let y = CELL.FLOOR_Y; y < CELL.H; y += 1) {
    const idx =
      y === CELL.FLOOR_Y
        ? PAL.PLATFORM_LIGHT
        : y === CELL.FLOOR_Y + 1
          ? PAL.PLATFORM_MID
          : PAL.PLATFORM_DARK;
    for (let x = 0; x < CELL.W; x += 1) setPx(g, x, y, idx);
  }
  return g;
}

/** Cell size, re-exported so a renderer needs one import. */
export const SPRITE_CELL = {
  W: RESOLUTION.CELL_W,
  H: RESOLUTION.CELL_H,
} as const;
