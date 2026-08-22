/**
 * SPRITE_TUNING — every game-feel number the lifter sprite system uses.
 *
 * CLAUDE.md: "Keep every such value as a named constant in one place. Never
 * scatter them as magic numbers across components." This is that place for the
 * art piece. Nothing in `raster.ts`, `rig.ts`, `squatAnimation.ts` or
 * `lifterSprite.ts` may contain a bare timing, curve or load-response number —
 * they all read from here.
 *
 * NOT in this file, deliberately:
 *   - Palette colours (`palette.ts`). A colour is not a feel value; the plate
 *     hues in particular are sourced from real meet software and must not be
 *     "balanced".
 *   - Joint coordinates and pose depth anchors (`rig.ts`). Those are drawing,
 *     not timing: an anchor cannot be moved without redrawing the pose it
 *     names, so it is not a knob that turns in isolation. The *load response*
 *     applied to those poses — STRAIN and PITCH below — is a feel value and
 *     lives here, including the per-level pixel deltas: unlike a pose anchor,
 *     a strain delta can be turned on its own and immediately looked at.
 *
 * `spriteTuning.test.ts` guards the rules a hand pass can silently break: one
 * table entry per level, no rung going backwards, no constant duplicated
 * somewhere else in the codebase.
 *
 * These numbers have never been played. GDD §12.1 budgets roughly 30 hand
 * tuning passes on exactly this kind of value. Treat every number below as a
 * starting point that a human will move, not as a result.
 */

/**
 * Frames are held for whole 60 Hz ticks, not milliseconds.
 *
 * This is not decoration. SNES and Genesis animation was authored in vblanks —
 * a frame held "3" meant three fields, and animators felt weight in integer
 * counts. Storing float milliseconds and rounding at playback is the thing that
 * makes modern pixel work drift off the grid and read as smooth-but-wrong.
 */
export const TICK_HZ = 60;
export const TICK_MS = 1000 / TICK_HZ;

/**
 * Internal resolution. GDD §7.1: "pick a fixed internal resolution early and
 * use nearest-neighbor scaling throughout. Retrofitting this later is painful."
 *
 * 96x72 is 12x9 tiles of 8x8, which is how sprite RAM was actually budgeted.
 * The lifter stands 60px, in the band SNES fighting-game leads occupied (Ryu is
 * roughly 90px on a 224-line field; ours is smaller because a 2.2 m barbell has
 * to fit in frame beside him, which no fighting game had to solve).
 *
 * PX_PER_METRE falls out of LIFTER_HEIGHT_PX / 1.75 m and everything physical
 * — plate diameters, bar span, squat depth — is derived from it rather than
 * eyeballed, so the proportions survive a resolution change even though the
 * hand-authored poses would not.
 */
export const RESOLUTION = {
  CELL_W: 96,
  CELL_H: 72,
  /** Sole of the shoe / top surface of the platform. */
  FLOOR_Y: 68,
  /** Standing lifter, sole to crown. */
  LIFTER_HEIGHT_PX: 60,
  /** Assumed stature of the sprite's lifter. */
  LIFTER_HEIGHT_M: 1.75,
  /** Integer upscale used by the inspection tool and the default view. */
  DEFAULT_UPSCALE: 6,
} as const;

export const PX_PER_METRE = RESOLUTION.LIFTER_HEIGHT_PX / RESOLUTION.LIFTER_HEIGHT_M;

/** Horizontal centre. Half-pixel, so symmetric shapes land symmetrically. */
export const CENTER_X = (RESOLUTION.CELL_W - 1) / 2;

/**
 * QUANTISE — how finite the shipped sheet is.
 *
 * A 16-bit game shipped a fixed number of drawings and picked the nearest one;
 * continuous per-frame deformation is a modern-engine tell. These say how
 * coarse the picking is, and they are feel values: raising DEPTH_STEPS makes
 * the animation smoother and less like a sheet, lowering it makes it chunkier.
 *
 * They live here rather than in `squatAnimation.ts` because they decide what
 * counts as the same drawing, which is the animator's timing sheet, which is
 * exactly the kind of thing a playtester turns.
 */
export const QUANTISE = {
  /** Distinct authored depth steps per direction. */
  DEPTH_STEPS: 12,
  /** Bar tilt is drawn in whole degrees of this size. */
  TILT_QUANTUM_DEG: 1,
  /** Sleeve droop is drawn to this precision, px. */
  BEND_QUANTUM_PX: 0.5,
  /** Lateral bar shake is drawn to this precision, px. */
  LATERAL_QUANTUM_PX: 1,
} as const;

/**
 * Depth the brace settles to before the eccentric proper starts.
 *
 * ONE value with TWO consumers, which is why it is here and not in either of
 * them: `squatAnimation.ts` walks the brace down to this depth, and `rig.ts`
 * anchors the BRACE drawing at it. If they ever disagree the lifter snaps
 * between two drawings at the top of every rep, and the bug is invisible in
 * both files individually.
 */
export const BRACE_SETTLE_DEPTH = 0.06;

/**
 * Barbell geometry, in sprite pixels.
 *
 * OVERALL LENGTH IS TRUE: HALF_SPAN 38 => a 76px bar => 2.216 m at
 * PX_PER_METRE, against a real 2.2 m competition bar. That is the dimension a
 * lifter would notice, so it is the one that is not fudged.
 *
 * SLEEVE LENGTH IS NOT TRUE, and this is the load-bearing stylisation of the
 * whole piece. A 25 kg calibrated disc is ~30 mm thick, which at this scale is
 * 1.03 px — six of them would be a 6px smear and the player could not count the
 * load. Each disc is drawn 2px wide with a 1px gap, a ~2.9x thickness
 * exaggeration, and the sleeve is stretched to 21px (real: 415 mm = 14px) to
 * hold six of them plus a collar. The shaft between the sleeves absorbs the
 * difference: 34px against a real 1.31 m = 45px. That trade is deliberate — the
 * shaft is mostly hidden behind the lifter, and plate count is the single
 * fastest read of how heavy a bar is.
 *
 * Plate DIAMETERS are not exaggerated at all (see PLATE_SPECS in plates.ts), so
 * a 10 kg disc is still visibly smaller than a 25.
 */
export const BAR = {
  HALF_SPAN_PX: 38,
  /** Knurled shaft, no plates inside this half-width. */
  SHAFT_HALF_PX: 17,
  /** Shaft thickness. A 29 mm bar is 1px here; 2px so it reads as steel. */
  SHAFT_THICKNESS_PX: 2,
  PLATE_PITCH_PX: 3,
  PLATE_FACE_PX: 2,
  COLLAR_WIDTH_PX: 3,
  COLLAR_HEIGHT_PX: 7,
  /**
   * The specular glint on each collar, as an offset from the collar block's
   * top-left corner, and how many rows it runs.
   *
   * The SAME offset on both collars, not mirrored: the lamp is upper-left, so
   * the glint is on the upper-left of the left collar and on the upper-left of
   * the right one too. Mirroring it would be the tell.
   *
   * RUN_PX is 2 and may not be 1. `despeckle` replaces any pixel with no
   * 4-neighbour of its own index, and this is drawn before that pass — a
   * one-pixel glint is exactly the shape it eats, which is how the sprite's
   * eyes and knuckles used to vanish. Two stacked pixels are each other's
   * neighbour and survive.
   */
  COLLAR_SPECULAR: { DX: 0, DY: 1, RUN_PX: 2 },
  /** Bar rests this far above the shoulder-line joint. */
  SHOULDER_OFFSET_PX: 1,
  /** Knurl ring marks, as |dx| from centre. IPF rings are 810 mm apart. */
  KNURL_RING_DX: [13, 14] as readonly number[],
} as const;

/**
 * Named load levels. `loadRatio` is attempt weight / current best single, so
 * 1.0 is a true maximal and values above 1.0 are PR territory.
 *
 * These are the presets the inspection contact sheet and the tests use. The
 * animation itself takes a continuous ratio.
 *
 * READ THIS BEFORE TUNING. Every `{ LIGHT, MAXIMAL }` pair below is an endpoint
 * pair evaluated at LOAD_RANGE.MIN and LOAD_RANGE.MAX — 0.35 and 1.05 — NOT at
 * the presets of the same name. A rep at LOAD_PRESETS.MAXIMAL (1.0) sits at
 * loadT ~0.88, so it sees about 88% of the way to the MAXIMAL endpoint, and a
 * rep at LOAD_PRESETS.LIGHT (0.55) sits at loadT ~0.12. The endpoints are
 * headroom, not the values a normal rep will show. Changing LOAD_RANGE moves
 * every other number in this file.
 */
export const LOAD_PRESETS = {
  WARMUP: 0.4,
  LIGHT: 0.55,
  MODERATE: 0.75,
  HEAVY: 0.88,
  MAXIMAL: 1.0,
} as const;

/** Ratios below/above this clamp the load response. */
export const LOAD_RANGE = { MIN: 0.35, MAX: 1.05 } as const;

/**
 * TIMING — tick counts at the light end and the maximal end of the load range.
 *
 * Interpolation between them is not linear: LOAD_CURVE_EXPONENT > 1 means the
 * top of the range is where the rep falls apart, which is how heavy singles
 * actually behave — 80% and 85% feel similar, 95% and 100% do not.
 *
 * ASCENT_TICKS is a *total*. It is deliberately not split per phase: the
 * sticking point's duration is an emergent property of the velocity model in
 * STICK below, not a separate number that could be tuned to disagree with it.
 */
export const TIMING = {
  LOAD_CURVE_EXPONENT: 1.7,

  /** Setup breath and brace before the descent starts. */
  BRACE_TICKS: { LIGHT: 14, MAXIMAL: 34 },
  /** Eccentric. Heavier is slower and more controlled, not faster. */
  DESCENT_TICKS: { LIGHT: 36, MAXIMAL: 62 },
  /** Reversal in the hole. */
  HOLE_TICKS: { LIGHT: 3, MAXIMAL: 11 },
  /** Whole concentric, bottom to lockout. */
  ASCENT_TICKS: { LIGHT: 29, MAXIMAL: 92 },
  /** Standing tall, exhale, before the frame data ends. */
  LOCKOUT_TICKS: { LIGHT: 8, MAXIMAL: 14 },
} as const;

/**
 * DESCENT shape.
 *
 * Depth over the eccentric is `mix` blended between a straight line and a
 * smoothstep: `d(u) = (1-mix)*u + mix*(3u^2 - 2u^3)`.
 *
 * A light rep descends at close to constant speed and is nearly linear. A
 * maximal rep is a full smoothstep: slow to break at the top, moving through
 * the middle, decelerating hard into the hole. That deceleration is where the
 * eccentric of a real limit squat lives, and it is also what loads the bar
 * enough to whip on the reversal (see BEND.WHIP_GAIN).
 */
export const DESCENT = {
  SMOOTHSTEP_MIX: { LIGHT: 0.25, MAXIMAL: 1.0 },
} as const;

/**
 * STICK — the sticking point. This is the piece's central claim and the half of
 * the bar a critic can actually check, so the model is written out rather than
 * faked with a hand-placed pause.
 *
 * Ascent velocity as a function of normalised bar height h in [0,1]:
 *
 *     v(h) = 1 - DEPTH * exp( -((h - HEIGHT_FRAC) / WIDTH)^2 )
 *
 * Ticks are then distributed by integrating dt = dh / v(h), so a deep, narrow
 * velocity notch produces a long dwell at one height — a stall — while the rest
 * of the ascent keeps moving. DEPTH near 1 means the bar very nearly stops.
 *
 * HEIGHT_FRAC 0.34 puts the stall a third of the way up, which is where a squat
 * actually stalls (hips rising past the point of maximum moment arm), not at
 * the midpoint where a symmetric ease would put it.
 */
export const STICK = {
  HEIGHT_FRAC: 0.34,
  WIDTH: 0.14,
  DEPTH: { LIGHT: 0.12, MAXIMAL: 0.93 },
  /** Grind wobble: the bar creeps and shakes rather than moving cleanly. */
  OSCILLATION_PERIOD_TICKS: 7,
  /** Peak lateral shake, px, at maximal load. Light load gets none. */
  OSCILLATION_PX: { LIGHT: 0, MAXIMAL: 1.2 },
  /** A tick counts as stalled below this rise, in normalised height units. */
  STALL_EPSILON: 0.004,
  /**
   * The wobble envelope is this much wider than the velocity notch, so the bar
   * is already shaking as it enters the sticking point rather than starting to
   * shake exactly when it stops.
   */
  WOBBLE_ENVELOPE_WIDEN: 1.5,
  /**
   * Floor on v(h), so the time integral cannot diverge.
   *
   * This is NOT only a numerical guard, which is why it is a tunable and not a
   * private constant in the animation module: as DEPTH approaches 1 it is the
   * value that decides how slowly the slowest tick of the grind creeps, and
   * therefore how long the stall runs. Raising DEPTH toward 0.99 without
   * lowering this just clips the notch flat.
   */
  MIN_VELOCITY: 0.02,
} as const;

/**
 * BAR_PATH — deviation of the bar from a clean vertical line.
 *
 * FORWARD is sagittal (toward the toes) and is the classic heavy-squat failure:
 * the hips shoot, the bar drifts over the toes, the lifter fights it back. The
 * sprite is a FRONT view, so forward drift is not drawn as a horizontal offset
 * — that would be a lie about the camera. It is drawn as the PITCH channel
 * below: its own quantised level with its own authored pose deltas, so it
 * reaches pixels independently of how strained the lifter already is.
 *
 * That independence is the whole point of the separate channel. Folding
 * forward drift into strain (which is what this file used to do, through a
 * `FORWARD_TO_PITCH` gain) meant that on a maximal grind — the one rep where
 * the drift is largest — base strain was already at the top of its range, the
 * sum clamped, and the drift changed no pixels at all. It was a term that only
 * ever moved the light rep.
 *
 * LATERAL and TILT are frontal-plane and *are* drawn directly: one side driving
 * harder than the other tips the bar, and that is visible head-on.
 */
export const BAR_PATH = {
  /** Peak forward drift during the ascent, px. */
  FORWARD_PX: { LIGHT: 0.6, MAXIMAL: 4.2 },
  /** Forward drift already present at the bottom of the descent, px. */
  FORWARD_AT_HOLE_PX: { LIGHT: 0.3, MAXIMAL: 1.8 },
  /** Where the forward drift peaks, as a fraction of ascent height. */
  FORWARD_PEAK_FRAC: 0.34,
  FORWARD_PEAK_WIDTH: 0.3,
  /**
   * How late in the eccentric the drift accumulates. Exponent > 1 keeps the
   * bar over midfoot at the top of the descent and lets it creep forward only
   * as the hips travel back near the bottom, which is when it actually creeps.
   */
  FORWARD_DESCENT_EXPONENT: 1.5,
  /** Peak lateral offset of the bar centre, px. */
  LATERAL_PX: { LIGHT: 0.0, MAXIMAL: 1.0 },
  /** Share of LATERAL_PX that is a steady lean; the rest is the shake. */
  LATERAL_LEAN_SHARE: 0.5,
  /** Peak bar tilt, degrees. Positive = lifter's right side high. */
  TILT_DEG: { LIGHT: 0.0, MAXIMAL: 3.5 },
} as const;

/**
 * BEND — sleeve droop from bar whip. Reads as weight before anything else does:
 * a bar that visibly bows is carrying plates, a straight one is not.
 *
 * Droop at |dx| from centre is BEND_PX * (|dx| / HALF_SPAN)^BEND_EXPONENT.
 * Exponent 2 keeps the shaft between the sleeves nearly flat, which is what a
 * loaded bar does — it bends at the sleeves, not uniformly.
 *
 * WHIP_GAIN adds bend proportional to upward acceleration, so the bar bows
 * hardest at the reversal out of the hole and again coming off the stick.
 */
export const BEND = {
  STATIC_PX: { LIGHT: 0.4, MAXIMAL: 3.4 },
  EXPONENT: 2.0,
  WHIP_GAIN: 4.0,
  /**
   * Acceleration is read off a moving average of the bar's height. Without the
   * smoothing, every phase boundary is a one-tick velocity discontinuity and
   * the whip term spikes there — which showed up as a light rep bending its bar
   * almost as far as a maximal one. The window is in ticks and must be odd.
   */
  ACCEL_SMOOTH_TICKS: 5,
  /** Ceiling on the whip multiplier, so a transient cannot dominate load. */
  MAX_WHIP_MULTIPLIER: 1.8,
  /** Bend never exceeds this, so the sleeves stay inside the cell. */
  MAX_PX: 4.5,
} as const;

/**
 * A strain level's authored pose deformation, in sprite px.
 *
 * NONE of these fields may move the shoulder line. The bar rides the
 * shoulders, so a strain deformation that moved the shoulders would let a
 * strained frame misreport squat depth — the lifter could grimace his way to
 * looking deeper. Everything else is fair game. `rig.ts` enforces this and
 * `lifterSprite.test.ts` asserts it.
 */
export interface StrainPoseDelta {
  /** Hips shoot: pelvis rises ahead of the shoulders, torso folds shut. */
  readonly HIP_SHOOT: number;
  /** Head cranes up and back, away from the bar; the neck lengthens. */
  readonly HEAD_CRANE: number;
  /** Traps bunch up under the bar; the shoulder line widens. */
  readonly SHOULDER_SHRUG: number;
  /** Knees track inward (valgus). Ugly on purpose. */
  readonly KNEE_VALGUS: number;
  /** Elbows drag down and in as the lifter fights to keep the bar racked. */
  readonly ELBOW_TUCK: number;
  /** Feet spread into the floor. */
  readonly STANCE_SPREAD: number;
  /** Chest caves: the singlet's neckline drops and the straps steepen. */
  readonly CHEST_COLLAPSE: number;
}

/**
 * STRAIN — how load deforms the pose itself.
 *
 * Timing alone is "slower". Weight is "slower AND shaped differently": the back
 * rounds, the hips outrun the shoulders, the knees track in, the head cranes
 * up, the whole thing gets uglier the closer to a limit it is. These deltas are
 * what a critic should be able to see in a still frame with the timing stripped
 * out, and the contact sheet is built to make exactly that comparison.
 *
 * ---------------------------------------------------------------------------
 * WHY LEVEL_DELTAS IS A TABLE AND NOT ONE VECTOR TIMES A SCALAR
 * ---------------------------------------------------------------------------
 * Strain is quantised to LEVELS steps before rendering, because a 16-bit game
 * shipped a fixed sheet and continuous deformation per frame is a
 * modern-engine tell. Given that the renderer only ever draws four strain
 * states, each of the four is AUTHORED. It is not one delta vector scaled by
 * a strain scalar.
 *
 * That distinction is the whole fix. A single vector scaled linearly means the
 * drawing a working set reaches and the drawing a limit single reaches are the
 * same drawing at different gains, and — because the reps the animation
 * actually produces sit at levels 0 and 3, not at the endpoints — the gap
 * between them lands under two pixels on a 60 px figure and rounds away. An
 * authored table lets level 3 be a QUALITATIVELY different drawing: the
 * elbow tuck is more than eight times level 1's, not three times, so a grind
 * is a pose the light rep never passes through rather than a faster version of
 * the one it does.
 *
 * Be precise about how far that claim goes. Only KNEE_VALGUS, ELBOW_TUCK,
 * STANCE_SPREAD and CHEST_COLLAPSE are genuinely authored per level — those
 * four carry the qualitative change. HIP_SHOOT, HEAD_CRANE and SHOULDER_SHRUG
 * currently share one ladder (0 / 0.5 / 1.3 / 2.2), which is a scalar written
 * out three times. That is a deliberate resting point, not a finished
 * decision: they are the fields a playtester is most likely to want to pull
 * apart, and the table shape is what makes doing so a one-line edit.
 *
 * The load presets map one-to-one onto the levels, which is what makes the
 * table worth authoring:
 *   LIGHT 0.55 -> 0,  MODERATE 0.75 -> 1,  HEAVY 0.88 -> 2,  MAXIMAL 1.0 -> 3
 * (at the sticking point, where the phase weight is highest).
 *
 * These are pixel offsets on a 60 px figure. Anything under ~1 px will not
 * survive rounding into the 96x72 grid, so a level whose deltas are all below
 * that is a level that does not exist. Level 1 is deliberately close to that
 * floor — a working set should barely deform — and levels 2 and 3 are not.
 */
export const STRAIN = {
  LEVELS: 4,
  /**
   * Strain from load alone, before phase weighting.
   *
   * LIGHT is not zero, and the exact value is load-bearing: it is what decides
   * that a 0.55 working set reaches level 1 at its sticking point and level 0
   * everywhere else. Drop it below ~0.15 and a light rep never deforms at all,
   * which makes the whole strain response read as a switch rather than a
   * ladder. `squatAnimation.test.ts` pins the preset-to-level map so a tuner
   * finds out immediately if a nudge here collapses a rung.
   */
  FROM_LOAD: { LIGHT: 0.16, MAXIMAL: 1.0 },

  /**
   * One authored deformation per strain level. Length must equal LEVELS.
   * Index 0 is the undeformed drawing and must stay all zeros: it is what
   * "the lifter is not straining" means.
   */
  LEVEL_DELTAS: [
    // 0 — composed. A warm-up. The authored pose, untouched.
    {
      HIP_SHOOT: 0,
      HEAD_CRANE: 0,
      SHOULDER_SHRUG: 0,
      KNEE_VALGUS: 0,
      ELBOW_TUCK: 0,
      STANCE_SPREAD: 0,
      CHEST_COLLAPSE: 0,
    },
    // 1 — working weight. Tight, braced, still clean. Barely a pixel anywhere.
    {
      HIP_SHOOT: 0.5,
      HEAD_CRANE: 0.5,
      SHOULDER_SHRUG: 0.5,
      KNEE_VALGUS: 0.6,
      ELBOW_TUCK: 0.4,
      STANCE_SPREAD: 0.3,
      CHEST_COLLAPSE: 0.1,
    },
    // 2 — heavy single. The fight is visible: knees drifting in, elbows down.
    {
      HIP_SHOOT: 1.3,
      HEAD_CRANE: 1.3,
      SHOULDER_SHRUG: 1.3,
      KNEE_VALGUS: 2.1,
      ELBOW_TUCK: 1.5,
      STANCE_SPREAD: 1.1,
      CHEST_COLLAPSE: 0.5,
    },
    // 3 — the grind at a limit. Knees caved, elbows dragged into the ribs,
    //     neck stretched, feet spread into the platform.
    //
    // CHEST_COLLAPSE is small on purpose and was pulled back once already: the
    // landmark it moves is the singlet's neckline, so a large value reads as
    // the singlet having slipped rather than as the chest having caved, which
    // is a worse cue than the one it replaced.
    {
      HIP_SHOOT: 2.2,
      HEAD_CRANE: 2.2,
      SHOULDER_SHRUG: 2.2,
      KNEE_VALGUS: 3.8,
      ELBOW_TUCK: 2.8,
      STANCE_SPREAD: 2.0,
      CHEST_COLLAPSE: 0.9,
    },
  ] as const satisfies readonly StrainPoseDelta[],

  /**
   * Knees may not cave inside this fraction of the hip half-width — the legs
   * would cross. It also makes valgus a deep-squat phenomenon for free: a
   * standing pose has narrow knees already, so the cap binds and the lifter
   * does not stand around knock-kneed at high strain.
   */
  KNEE_MIN_VS_HIP: 0.95,

  /**
   * Depth honesty, second line of defence.
   *
   * The bar is glued to the shoulders and strain never moves the shoulders, so
   * the bar's height cannot lie. But the hip-crease-below-top-of-knee cue is
   * the criterion a judge actually calls, and HIP_SHOOT raises the hip. Where
   * the authored drawing has the hip below the knee, strain may not raise it
   * closer than this — a strained frame can look uglier than a clean one but
   * never shallower.
   */
  HIP_DEPTH_MARGIN_PX: 0.8,

  /**
   * CORD — muscle cording, drawn only at a real grind.
   *
   * A few 2px runs of shadow down the neck and the outer quad. Small, but it
   * is a mark that exists in the heavy drawing and does not exist in the light
   * one at all, which is the thing a fixed sheet gets to do and a scaled
   * deformation does not. Runs are 2px because `despeckle` eats lone pixels,
   * and deliberately so.
   */
  CORD: {
    /** Strain level at or above which cording is drawn. */
    MIN_LEVEL: 3,
    RUN_PX: 2,
    /** Neck cords: |dx| from the neck axis, dy from the neck's midpoint. */
    NECK_DX: 2,
    NECK_DY: -1,
    /** Quad cords: fractions from hip to knee, and |dx| off the thigh axis. */
    THIGH_FRACS: [0.4, 0.62] as readonly number[],
    THIGH_DX: 1.8,
  },

  /**
   * How much of the load's strain shows at each point in the rep. A brace is
   * tight but composed; the hole and the sticking point are where a limit
   * attempt visibly comes apart.
   *
   * ASCENT is a function of normalised bar height h, not a constant:
   *   w(h) = ASCENT_BASE - ASCENT_FALLOFF*h + ASCENT_STICK_BONUS*gauss(h)
   * so the ugliest frame of the rep is the one at the sticking point, and the
   * lockout is composed again.
   *
   * -------------------------------------------------------------------------
   * THE BRACE IS THE ONE BEAT WITH NO MOTION TO HIDE BEHIND
   * -------------------------------------------------------------------------
   * Every other heaviness cue this system has — the stall plateau, the forward
   * drift, the shake, the tilt, the whip, the tick counts — is a MOTION cue,
   * and all of them are identically zero in a still frame. The brace is a still
   * frame, it is the frame the screen opens on, and it is held for up to
   * BRACE_TIMEOUT_TICKS. It is the one place the body has to carry the weight
   * on its own.
   *
   * At BRACE 0.25 it carried none. Measured, at STRAIN.FROM_LOAD as shipped:
   *
   *   load  base    x0.25   rung        x0.42   rung
   *   0.40  0.1695  0.0424  0           0.0712  0
   *   0.55  0.2599  0.0650  0           0.1091  0
   *   0.75  0.4844  0.1211  0           0.2035  0
   *   0.88  0.6835  0.1709  0           0.2871  1
   *   1.00  0.9006  0.2251  0           0.3782  1
   *
   * `strainLevel` floors at LEVELS rungs, so everything under 0.25 is rung 0 —
   * LEVEL_DELTAS[0], "the authored pose, untouched". A 220 kg brace and a
   * 120 kg brace were therefore the same drawing of the same body, differing
   * only in the plates and about 2 px of sleeve droop, which is the "heaviness
   * is in the bar, not the lifter" failure arriving in the one frame motion
   * cannot cover for.
   *
   * -------------------------------------------------------------------------
   * WHY DESCENT_TOP MOVED WITH IT, WHICH IS NOT SCOPE CREEP
   * -------------------------------------------------------------------------
   * Raising BRACE alone is not a safe one-number fix, and the measurement says
   * so. The rung a load draws at the top of the eccentric is
   * base * DESCENT_TOP; at DESCENT_TOP 0.3 the 0.88 default drew rung 0 there.
   * Any BRACE at or above 0.366 — the threshold the 0.88 default needs to
   * reach rung 1 at all — therefore made the default rep brace at rung 1 and
   * then RELAX to rung 0 on the first tick of the descent. The lifter would
   * visibly loosen the instant the bar started moving, which is worse than the
   * flat brace it replaced.
   *
   * The invariant, guarded in `spriteTuning.test.ts`:
   *
   *     BRACE <= DESCENT_TOP < DESCENT_BOTTOM
   *
   * That is also the honest physics. The brace IS the top of the descent, held
   * still; the same body, under the same bar, at the same height. There was no
   * reason for the drawn load to be lower standing than one millimetre into the
   * eccentric, and the 0.25/0.30 gap was the artefact rather than the design.
   * They stay two knobs rather than one, because a tuner may well want the
   * brace a little BELOW the moving descent — composed, set, not yet fighting —
   * and the guard permits that. It only forbids the direction that pops.
   *
   * -------------------------------------------------------------------------
   * WHERE 0.42 COMES FROM, AND WHAT IT IS NOT
   * -------------------------------------------------------------------------
   * It is a measured point inside the window the rung boundaries leave, not a
   * played value. Lower bound 0.3658: below it the 0.88 default — the load the
   * app opens on — is still drawn with the untouched pose. Upper bound 0.5161:
   * above it a 0.75 working set starts bracing strained too, and a change that
   * makes EVERY brace look heavy has traded one flat frame for another. 0.42
   * sits 0.054 above the floor and 0.096 below the ceiling.
   *
   * IT IS NOT THE ARITHMETIC MIDPOINT (0.441), AND THE REASON IS WORTH READING
   * BEFORE MOVING IT. Because the descent's weighting ramps linearly from
   * DESCENT_TOP to DESCENT_BOTTOM and depth is drawn in QUANTISE.DEPTH_STEPS
   * steps, a handful of weights land a rung crossing exactly on a step boundary
   * and the eccentric loses one authored drawing to a merge. Swept at 0.01
   * across the whole window, `distinctDrawingCount(maximal)` is 34 everywhere
   * except 0.39, 0.44 and 0.48, where it is 33. Those are narrow quantiser
   * artefacts rather than a property of the pose, and a tuner who lands on one
   * has spent a drawing for nothing.
   *
   * The resulting brace ladder is 0 / 0 / 0 / 1 / 1 across the five presets:
   * the warm-up, the light set and the working set stand there composed, and
   * the two near-limit loads do not. Maximal and the 0.88 default share rung 1
   * at the brace — reaching rung 2 there needs BRACE >= 0.5552, which drags the
   * working set onto rung 1 as well. That trade is a tuner's call, and this
   * file is where they make it.
   *
   * NOT PLAYED. GDD §12.1. The rung boundaries are measured; which side of them
   * a 192.5 kg brace should sit on is a question for a person with the app in
   * their hands.
   */
  PHASE_WEIGHT: {
    BRACE: 0.42,
    /**
     * Descent ramps from this at the top to this at the bottom. DESCENT_TOP is
     * the same standing body as BRACE and may not be drawn lighter than it.
     */
    DESCENT_TOP: 0.42,
    DESCENT_BOTTOM: 0.75,
    HOLE: 0.88,
    ASCENT_BASE: 0.95,
    ASCENT_FALLOFF: 0.5,
    ASCENT_STICK_BONUS: 0.35,
    ASCENT_STICK_WIDTH: 0.2,
    LOCKOUT: 0.3,
  },

  /** Strain above this flushes the face and forearms with SKIN_FLUSH. */
  FLUSH_THRESHOLD: 0.55,
} as const;

/**
 * A pitch level's authored pose deformation, in sprite px.
 *
 * Same rule as StrainPoseDelta: nothing here may move the shoulder line.
 */
export interface PitchPoseDelta {
  /** Hips travel back and up — the fault the forward drift IS. */
  readonly HIP_RISE: number;
  /** Chest turns toward the floor: the singlet's neckline drops. */
  readonly CHEST_DROP: number;
  /** A torso pitched away from camera presents a narrower frontal outline. */
  readonly TORSO_NARROW: number;
  /** Eyes come up, fighting the fold. */
  readonly HEAD_CRANE: number;
}

/**
 * PITCH — the drawn consequence of sagittal forward bar drift.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS IS FOR
 * ---------------------------------------------------------------------------
 * `BAR_PATH.FORWARD_PX` is toward the toes, and the camera is in front of the
 * lifter, so it cannot be drawn as a horizontal offset without lying about the
 * view. What CAN be drawn is its effect on the body: the hips travel back and
 * up, the torso folds toward the floor and so presents less of itself to the
 * camera, and the lifter's head comes up to fight it.
 *
 * It is a SEPARATE quantised channel from strain rather than a term added into
 * strain, for one concrete reason: strain saturates. On the rep where the
 * drift is largest, the base strain is already at the top of its range, so an
 * added term is clamped away and changes nothing. As its own channel the drift
 * reaches pixels on the heavy rep, which is the only rep where the claim
 * "the bar drifted forward and the lifter fought it back" was ever made.
 *
 * FULL_PX reads BAR_PATH so the two cannot desync: raise the modelled drift
 * and the level scale still spans it.
 */
export const PITCH = {
  LEVELS: 4,
  /** Drift, px, that reaches the top authored level. */
  FULL_PX: BAR_PATH.FORWARD_PX.MAXIMAL,
  /** One authored deformation per pitch level. Length must equal LEVELS. */
  LEVEL_DELTAS: [
    { HIP_RISE: 0, CHEST_DROP: 0, TORSO_NARROW: 0, HEAD_CRANE: 0 },
    { HIP_RISE: 0.5, CHEST_DROP: 0.15, TORSO_NARROW: 0.35, HEAD_CRANE: 0.3 },
    { HIP_RISE: 1.0, CHEST_DROP: 0.4, TORSO_NARROW: 0.8, HEAD_CRANE: 0.55 },
    { HIP_RISE: 1.6, CHEST_DROP: 0.7, TORSO_NARROW: 1.2, HEAD_CRANE: 0.8 },
  ] as const satisfies readonly PitchPoseDelta[],
} as const;

/**
 * DEFORM_FOLLOW — how far a secondary landmark follows the primary one it is
 * attached to, as a fraction of that primary's movement.
 *
 * These are not independent deltas and must not become them. The waist is
 * attached to the pelvis, the neck to the head; if they were authored
 * separately per level they could be tuned into disagreeing with each other and
 * the figure would come apart at the joint. One ratio each, applied to whatever
 * the primary landmark actually got AFTER its depth guard — so when the hip's
 * rise is clamped in the hole, the belt stays on the hips instead of floating
 * up to where the hip asked to go.
 */
export const DEFORM_FOLLOW = {
  NECK_OF_HEAD_CRANE: 0.4,
  WAIST_OF_HIP_TRAVEL: 0.7,
  ELBOW_DROP_OF_TUCK: 0.5,
  WAIST_WIDTH_OF_TORSO_NARROW: 0.6,
} as const;

/**
 * How a mass's value varies ALONG its own length, as opposed to across it.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * A cylinder lit by one lamp has exactly one value at every point of a given
 * cross-section, so a limb shaded from the across-limb normal alone is a
 * LONGITUDINAL STRIPE by construction: the same ramp step, from the shoulder to
 * the wrist, on every limb, at every pose. That is not a tuning problem, it is
 * what the maths guarantees, and the rendered frames showed it — one unbroken
 * light column down each forearm and each shin.
 *
 * A hand-drawn 16-bit limb does not look like that. Look at the wrestlers in
 * `docs/reference/sprite-ref-1-snes-wrestling.png` at native scale: the light on
 * an arm is a CLUSTER over the deltoid, a second cluster over the biceps belly,
 * and darker pixels at the joints between them. The value goes up and down as
 * you travel down the limb.
 *
 * So this profile adds a term that is a function of position along the axis:
 * one raised belly and two darkened ends. It is deliberately not a smooth
 * gradient — a gradient down a limb is a different generated-looking artefact,
 * not a fix for the first one — and it is deliberately cheap: two bumps, no
 * per-limb tables, quantised into the same hard ramp steps as everything else.
 *
 * These are FEEL VALUES. Every one of them decides how a body reads and will be
 * moved by hand; GAIN and DROP in particular are only meaningful relative to
 * the gap between two THRESHOLDS entries (0.26 on the four-step skin ramp), so
 * a gain under about 0.13 cannot move a single pixel.
 */
export interface AxialProfile {
  /** Where the muscle belly sits. 0 is the start of the mass, 1 the end. */
  readonly BELLY_FRAC: number;
  /** Gaussian half-width of the belly's highlight cluster, in the same units. */
  readonly BELLY_WIDTH: number;
  /** How far the belly lifts the lit value. */
  readonly BELLY_GAIN: number;
  /** Fraction of the mass at each end that darkens toward the joint. */
  readonly JOINT_WIDTH: number;
  /** How far the joint ends drop the lit value. */
  readonly JOINT_DROP: number;
}

/**
 * SHADING — one key light, upper-left, slightly toward camera.
 *
 * Direction is a unit-ish vector in screen space with +z out of the screen.
 * Quantisation thresholds are hard cuts with no dithering and no anti-aliasing:
 * a pixel is one ramp step or the next, never a blend. THRESHOLDS are the
 * lambert values at which the ramp steps up; there is one fewer threshold than
 * the ramp has steps.
 *
 * AMBIENT keeps the unlit side off the outline colour, so the silhouette still
 * reads against a dark backdrop.
 */
export const SHADING = {
  LIGHT_DIR: { x: -0.52, y: -0.62, z: 0.59 },
  AMBIENT: 0.2,
  /**
   * Fractions of the lit range at which the ramp steps up.
   *
   * THE BOTTOM ENTRY SITS JUST UNDER `AMBIENT`, AND THAT IS THE WHOLE POINT OF
   * ITS VALUE. `lambert` bottoms out at AMBIENT and `litWithAxial` now floors
   * there too, so at 0.19 the LAMP CAN NEVER REACH THE DARKEST STEP OF A RAMP.
   * That step belongs to the contour — `INTERIOR_EDGE.SKIN` is exactly it, and
   * `EDGE_STEP_DROP` puts the ring one step under the fill beside it — which is
   * how `sprite-ref-1` uses the bottom of its own skin ramp:
   * `@ref skin.floorShare = 10.4%` of the wrestler's skin, spent on contour,
   * with a bare thigh row reading his ramp steps 1/3/4/5/5/5/5/2/3/2 and not one
   * pixel on the floor.
   *
   * At 0.30 the shadow flank of every mass landed on the floor as well, and so
   * did the joint bands at each end of every capsule. Measured over the whole
   * 448-frame sweep with that value, the far arm's own window ran 48-75% floor
   * with its MEDIAN on the floor in every frame; the near arm, the hands and
   * the neck were 46-62%. The reference's worst limb-sized patch of skin
   * anywhere on the figure runs 35-58% depending on the patch size, and its
   * median is essentially never there — `lifterSprite.test.ts` computes both
   * against the decoded file and prints the table.
   *
   * The top entry is set ABOVE a cylinder's peak lambert (0.830 under this
   * lamp) on purpose, and 0.84 keeps that true. The consequence is worth
   * stating plainly: a limb cannot reach the top skin step from its surface
   * normal alone. It gets there only where AXIAL_LIMB's belly bump lifts it — a
   * cluster over the muscle belly — or where a hand-placed mark puts it.
   * Spheres (head, hands) can still reach it, because a sphere really does have
   * a facet pointing at the lamp.
   *
   * At 0.82 with no axial term the top step was a one-pixel sliver down the
   * whole length of every limb and the far limbs could not reach it at all, so
   * the figure lived in the middle of its ramp while the chrome collars and the
   * red discs carried the top of the frame — the reverse of the reference,
   * where the wrestlers hold the brightest pixels and the crowd is suppressed
   * to luma 16-80.
   *
   * ONLY THE 4-STEP RAMPS READ THIS TABLE, which is `SKIN` and `SKIN_FLUSHED`
   * and nothing else (see `thresholdsFor`). Kit, hair, steel and the plates are
   * 2- and 3-step ramps on their own tables and did not move.
   */
  THRESHOLDS_4: [0.19, 0.5, 0.84],
  THRESHOLDS_3: [0.36, 0.72],
  THRESHOLDS_2: [0.52],
  /**
   * Extra top-down lighting term on body masses, so the chest out-values the
   * gut. Spans 2*VERTICAL_GAIN top to bottom, so under half the 0.26 gap
   * between two skin thresholds it cannot change a single pixel — which is
   * where it was.
   */
  VERTICAL_GAIN: 0.17,
  /**
   * Far-side ARM, hand and deltoid: how far its lamp is dimmed toward AMBIENT.
   *
   * THIS USED TO BE A RAMP-STEP BIAS OF -1, AND THE NOTE HERE RECORDED WHAT
   * THAT COST AND KEPT IT ANYWAY. The record, restated because it is the reason
   * the mechanism changed: measured over the far arm's own limb window across
   * every frame the animation can produce, 54-93% of its skin sat on
   * SKIN_SHADOW (73), the floor of the ramp; its median was that floor in
   * 448 frames out of 448; and it reached SKIN_HI on zero pixels, because -1
   * capped it at SKIN_LIGHT. The near arm over the same window ran the whole
   * ramp. In sprite-ref-1 BOTH of the blond wrestler's arms reach the top two
   * steps of one skin ramp under one lamp, and no limb-sized patch of his skin
   * anywhere on the figure has its median on the darkest step.
   *
   * A STEP BIAS CANNOT DO WHAT A DIMMER LAMP DOES. It renumbers the ramp, so
   * every pixel one step off the floor lands ON the floor and the top step
   * becomes unreachable however square to the lamp the surface is. Scaling the
   * lit value toward ambient instead leaves the shadow flank exactly where it
   * was — it is already at ambient — and takes the lit flank down, which is the
   * separation that was wanted, without spending the mass's whole value range.
   * See `raster.dimToward`.
   *
   * 0.86 is a feel value and GDD §12.1 hands it to a human. What it is picked
   * against is stated so it can be re-picked: at 1.0 the two arms differ only
   * by the lamp's own left-right asymmetry, and at 0.72 the far arm's belly no
   * longer crosses THRESHOLDS_4's top entry, so it stops reaching SKIN_HI and
   * the old flatness comes back by a slower route. It is the first number to
   * turn if the far arm reads either pasted-on or too close to the near one.
   */
  FAR_LIMB_LIGHT_SCALE: 0.86,
  /**
   * The same, for the far LEG — thigh, shin, knee sleeve and shoe.
   *
   * WHY THE LEG NEEDED ITS OWN NUMBER, AND GOT 0 WHERE THE ARM KEPT -1. On a
   * bent leg the whole step is unaffordable: the femur is foreshortened,
   * so its peak is already down at SKIN_LIGHT before any bias, and one step off
   * that is SKIN_MID (117) — below GEAR_LIGHT (149), the top step of the very
   * kit worn on it. A leg wears kit and an arm does not, so the leg had an
   * inversion to lose and the arm only has value to lose. Measured over the pose
   * ladder with this at -1, the far leg's bare skin had a MEDIAN of SKIN_SHADOW
   * (73), the floor of the ramp, at every depth including lockout: shadow flank
   * at the floor, edge ring at the floor, and only the lit flank at SKIN_MID.
   *
   * At 0 the far leg is NOT the same drawing as the near one. The lamp is fixed
   * in `LIGHT_DIR`, so both legs are lit on their upper-left flank rather than
   * mirrored; the interior edge ring, the inner-leg seam and the separately
   * authored NEAR/FAR quad and shin-crest marks all still separate them. What
   * goes away is only the blanket step, which was buying depth by spending the
   * lower body's whole value range.
   */
  FAR_LEG_STEP_BIAS: 0,
  /**
   * How many ramp steps the 1px edge ring sits under the fill beside it, for
   * parts drawn with `PartOptions.edgeFollowsLight`.
   *
   * 1 is a rim; 2 reads as a keyline again and undoes the point of the option;
   * 0 makes the ring invisible and the mass loses its boundary. This is a feel
   * value and will be moved by hand — it decides how hard-edged the figure is.
   */
  EDGE_STEP_DROP: 1,

  // -------------------------------------------------------------------------
  // PER-PART RAMP-STEP BIASES
  //
  // The three below arrived here from `RIG_GEOMETRY` in `rig.ts`, where they
  // sat among the joint coordinates. That file's exclusion from this one is
  // specific and it does not cover them: a joint anchor "cannot be moved
  // without redrawing the pose it names", which is why anchors stay there. A
  // ramp-step bias is the opposite — it is a knob that turns on its own, it
  // changes no geometry, and its effect is visible in one render. It is the
  // same KIND of number as FAR_LIMB_LIGHT_SCALE and EDGE_STEP_DROP directly
  // above, and CLAUDE.md asks for every such value in one named place.
  // -------------------------------------------------------------------------

  /**
   * The face is the smallest thing on the figure that has to read, so it gets
   * lifted a step above the lamp's own answer.
   */
  HEAD_STEP_BIAS: 1,
  /**
   * Ramp steps the belt sits below the rest of the GEAR kit.
   *
   * The belt is the widest single flat mass on the figure — three rows across
   * the whole waist — so it takes the largest share of any change to the GEAR
   * ramp. When GEAR was lifted so the knee sleeves would stop vanishing into
   * the backdrop, the belt came with it and became the brightest large area on
   * the body, which is a silver belt. Every belt in the references is black or
   * black-with-a-patch (meet-photo-ref-1, meet-photo-ref-2). One step down puts
   * its lit centre at GEAR_MID and its flanks at GEAR_DARK: leather catching a
   * little light.
   *
   * The shoes deliberately do NOT take a bias — they are small, they are part
   * of what the ramp was lifted for, and their own marks (sole, laces) supply
   * their internal contrast.
   */
  BELT_STEP_BIAS: -1,
  /**
   * The same argument, for the knee sleeve, arriving late because the sleeve
   * used to be held down by something else. While the whole far leg carried
   * the far-limb bias the far sleeve was dragged down with it, and the near
   * sleeve's GEAR_LIGHT flank was one object among many. With the blanket leg
   * bias gone (FAR_LEG_STEP_BIAS) both sleeves rendered their own lit flank at
   * GEAR_LIGHT, luma 149 — above the bare leg's own median of SKIN_MID (117) —
   * and the biggest kit mass on the leg became the brightest thing below the
   * belt. Every sleeve in meet-photo-ref-1 is black with a contrast top band.
   * One step down puts the sleeve's lit flank at GEAR_MID and its shaded flank
   * at GEAR_DARK, and leaves the top gear step for the shoes' pale sole line.
   */
  KNEE_SLEEVE_STEP_BIAS: -1,

  /** Rim of a plate: fraction of the disc's height that catches the key light. */
  PLATE_RIM_LIT_FRAC: 0.42,

  /**
   * FORESHORTENING — what to do when a limb is pointing at the camera.
   *
   * THE BUG THIS EXISTS FOR. `drawLimb` shades a capsule as a cylinder whose
   * axis lies in the screen plane, so a limb's peak value is a function of its
   * SCREEN ANGLE: measured under this lamp, a vertical limb peaks at 0.83 and a
   * limb angled 45 degrees down-and-out peaks at 0.67, low enough that it cannot
   * reach the top skin step at all and drops a whole step across its width.
   * Worse, a limb drawn near-horizontal is shaded top-lit / bottom-shadowed, and
   * at squat depth the only part of the thigh the shorts and the sleeve leave
   * visible IS its underside. Measured across the pose space before this term
   * existed, the knee sleeve out-valued the bare thigh it is worn on in 18% of
   * leg-frames — GEAR_LIGHT (luma 149) sitting on SKIN_MID (117) — which is the
   * exact inversion `palette.ts` forbids: kit must read as a dark object ON a
   * lit leg, not as the leg.
   *
   * WHY IT IS NOT A CYLINDER. The rig is a front view and it draws the femur
   * FORESHORTENED: hip-to-knee is 15.1 px standing and collapses to 2.5-7.8 px
   * in the hole, because in a squat the knee travels forward, toward the camera.
   * A near-horizontal thigh in this rig is therefore not a tube lying sideways;
   * it is a tube pointing at the viewer, and what the camera sees is its broad
   * anterior face — which points at the camera, and so at this lamp. That is
   * what meet-photo-ref-1 shows: at the bottom of a real squat the front of the
   * thigh is the brightest mass in the lower body with the black sleeve a dark
   * band laid across it. Note what the photo does NOT show — that band is not a
   * modelled cylinder, it is a broad evenly-lit sheet, which is the evidence
   * DOME_CURVATURE is read against below.
   *
   * SO: the surface normal is blended from the cylinder normal toward the
   * camera as the limb rotates out of the screen plane. The tilt itself is not
   * tuneable — it is `sqrt(1 - (drawn/natural)^2)`, trigonometry on a rigid
   * bone, and it lives in `rig.ts`. These are the feel values: how much of that
   * tilt turns into shading, how sharply it comes on, how curved the
   * foreshortened mass is, and where its pole sits.
   *
   * WHAT THIS BLOCK DID NOT FIX, said plainly. Turning the thigh's normal
   * toward the camera stopped it being dark BECAUSE it was angled, and the
   * shipped DOME_CURVATURE of 0 makes the result a flat face — one lambert
   * value over the whole mass. On the near leg that lands on SKIN_LIGHT, which
   * is why the frames looked fixed. It was not enough on its own, for a reason
   * that has nothing to do with foreshortening: with a blanket
   * far-limb ramp-step bias the far leg then sat one step under that, on SKIN_MID
   * (117), which is BELOW GEAR_LIGHT (149) — the same inversion, one leg over.
   * And the thigh is only 12-26 px of visible bare skin at depth against the
   * shin's 37-50, so fixing the femur alone could not fix the lower body.
   * See FAR_LEG_STEP_BIAS, AXIAL_LEG and RIG_GEOMETRY.KNEE_SLEEVE.STEP_BIAS
   * for the three terms that finished the job.
   *
   * The arithmetic behind DOME_CURVATURE is short enough to check, and
   * `raster.test.ts` checks it. Under this lamp a camera-facing plane reaches
   * `AMBIENT + (1-AMBIENT)*L.z` = 0.2 + 0.8*0.589 = 0.67, and THRESHOLDS_4's
   * top entry is 0.88 — so a flat-blended limb cannot reach the top skin step
   * from its normal at ANY brightness, and with AXIAL_FADE at 1 the belly bump
   * that would otherwise lift it has been faded out. A dome would: it has a
   * facet whose normal IS the lamp direction, 0.81 of a radius up and to the
   * left of its pole. It is not turned on, and DOME_CURVATURE says why.
   *
   * CAMERA_BLEND 0 restores the old pure-cylinder behaviour exactly, on every
   * limb, and is the first thing to reach for if the legs read too flat.
   */
  FORESHORTEN: {
    /** Weight of the dome normal at full out-of-plane tilt, 0..1. */
    CAMERA_BLEND: 1,
    /**
     * Shaping exponent on the tilt before it becomes blend weight. 2 makes the
     * weight the squared tilt, which is linear in `1 - (drawn/natural)^2` and
     * so ramps in smoothly over the first third of the descent; 1 uses the tilt
     * itself, which jumps hard in the first frame off lockout.
     */
    TILT_EXPONENT: 2,
    /**
     * How far the axial profile fades as the mass turns to face the camera.
     * 1 fades it out completely at full tilt; 0 leaves it at full strength.
     *
     * `axialTerm` is a function of position ALONG the bone, and a bone pointing
     * at the viewer has almost no drawn length to spread it over. In the hole
     * the femur is 3.7 px long against a 4.3 px radius, so the capsule is very
     * nearly a disc and the whole of it lies inside AXIAL_LIMB's joint band:
     * without this, JOINT_DROP took 0.16 off every pixel of the thigh at once
     * and dropped the mass a whole ramp step — which is the same inversion this
     * block exists to fix, arriving by the other door. A cap is not the joint
     * seen from the side; at full tilt it is the front of the thigh.
     */
    AXIAL_FADE: 1,
    /**
     * Where the dome's pole sits along the capsule: 0 the start point, 1 the
     * end point, 0.5 the middle.
     *
     * A rigid bone swinging toward the camera brings ONE of its ends forward —
     * for the femur, drawn hip-to-knee, that is the knee — so the strictly
     * correct pole is the end at 1. It sits at the middle instead because the
     * middle is the only place the highlight lands ON DRAWN PIXELS at every
     * depth: the femur's drawn length falls to 6 px against a 4.3 px radius, so
     * a pole at the knee end puts the cluster half a radius outside the mass
     * and under the knee sleeve, and a highlight nobody can see is not a
     * highlight. This is a feel value; it decides where the light lands on a
     * bent thigh.
     *
     * IT DOES NOTHING WHILE DOME_CURVATURE IS 0, because at 0 there is no dome
     * to have a pole. It is here so that the two halves of the dome model sit
     * together and a tuner turning DOME_CURVATURE up does not then have to go
     * find a hard-coded 0.5 in the rasteriser.
     */
    DOME_CENTRE_FRAC: 0.5,
    /**
     * How curved the foreshortened mass is: 1 a full hemisphere of the limb's
     * own radius, 0 a flat camera-facing face.
     *
     * MEASURED, BOTH ENDS, ON THE PIXELS THE SHORTS AND THE SLEEVE LEAVE
     * VISIBLE — which is the only part of a thigh anyone grades.
     *
     * IT SHIPS AT 0 — a flat face — AND THAT IS A RESULT, NOT AN OVERSIGHT.
     * State it plainly: at 0 this blend is the same model it was before the
     * constant existed. What changed is that the choice now has a name, a dial
     * and a measurement beside it instead of being an unnamed expression, and
     * the other end of the dial has been tried on real pixels rather than
     * argued about.
     *
     * WHAT THE OTHER END DID. At 1 the mass is a full hemisphere and gets a
     * proper highlight cluster — but the cluster lands up and to the LEFT,
     * because that is where LIGHT_DIR is, and the knee sleeve is not centred on
     * the thigh. At depth the knee tracks OUTBOARD of the hip, so the sleeve
     * sits outboard too and covers the OUTER flank of each thigh. On the
     * screen-left leg the outer flank is the lit one, so the dome's highlight
     * goes under the sleeve and what the player sees is the shaded flank.
     * Measured over the pose ladder, the visible bare thigh's median went
     * SKIN_LIGHT (175) -> SKIN_SHADOW (73) on the near leg at every depth past
     * two thirds, and the far leg — whose outer flank is the shaded one — came
     * out BRIGHTER than the near one, which inverts the depth cue as well.
     *
     * The reference photo agrees with the flat reading rather than the domed
     * one: in meet-photo-ref-1 the band of bare quad between hem and sleeve is
     * an evenly lit sheet on both legs, not a modelled cylinder. At the bottom
     * of a front-on squat that band IS the anterior quad turned to face the
     * camera, and a broad plane facing the camera under a lamp 59% toward the
     * camera is close to evenly lit.
     *
     * Intermediate values were measured too: 0.15 and 0.25 already take the
     * near thigh's median to SKIN_MID past three-quarter depth. There is no
     * setting above 0 that keeps both thighs in the lit band, because the
     * sleeve's position, not the shading, is what decides which flank shows.
     * Move the sleeve inboard (RIG_GEOMETRY.KNEE_SLEEVE) and this becomes
     * worth turning up.
     */
    DOME_CURVATURE: 0,
  },

  /**
   * Arms, legs, neck: a proximal muscle belly with darker joints either side.
   *
   * BELLY_GAIN is the number that makes the top of the skin ramp reachable at
   * all on a limb — see THRESHOLDS_4. Drop it below about 0.05 and limbs never
   * reach the brightest step; raise it much above 0.2 and the belly bump alone
   * clears the threshold everywhere and the stripe comes back.
   */
  AXIAL_LIMB: {
    BELLY_FRAC: 0.36,
    BELLY_WIDTH: 0.2,
    BELLY_GAIN: 0.14,
    JOINT_WIDTH: 0.3,
    JOINT_DROP: 0.16,
  } as AxialProfile,
  /**
   * THE LEG, WHICH IS NOT AN ARM, BECAUSE BOTH ITS JOINTS ARE UNDER KIT.
   *
   * `AXIAL_LIMB` puts a highlight over the muscle belly and drops the value at
   * both ends, which is right for an arm: the elbow and the wrist are bare, the
   * drop lands on a joint, and the hand-placed elbow and wrist marks sit on top
   * of it. On a leg every one of those ends is covered. The thigh capsule runs
   * from a hip under the singlet to a knee under the sleeve; the shin capsule
   * runs from that same sleeve to an ankle inside the shoe. So the joint drop
   * does not darken a joint — the joint is not drawn — it darkens the first
   * bare rows past the hem of whatever is covering the end, which is the top
   * and bottom of the only bare skin the lower body has.
   *
   * Measured on the drawn shin: the sleeve's hem clears it at about t 0.35 and
   * the shoe starts at about t 0.95, so the bare band is the back two thirds of
   * the capsule. AXIAL_LIMB's belly sits at 0.36 — under the sleeve — and its
   * joint band starts at 0.7, so the visible shin was the falling side of a
   * highlight nobody can see followed by a drop into the shoe. Hence a belly
   * moved down into the bare band and a shallower, narrower drop.
   *
   * THE SHIN IS NOT FORESHORTENED and this is not a foreshortening term. Its
   * drawn knee-to-ankle length GROWS through the descent, 14.1 px standing to
   * 16.4 in the hole, because the knee tracks out sideways rather than toward
   * the camera. `femurTilt`'s argument does not transfer to it and the shin is
   * still drawn as the plain cylinder it has always been.
   *
   * These are feel values in the same class as AXIAL_LIMB: they decide how much
   * of a bent leg reads as lit.
   */
  AXIAL_LEG: {
    BELLY_FRAC: 0.62,
    BELLY_WIDTH: 0.3,
    BELLY_GAIN: 0.16,
    JOINT_WIDTH: 0.14,
    JOINT_DROP: 0.1,
  } as AxialProfile,
  /** Torso: the pec shelf sits high, and the value falls into the waist. */
  AXIAL_TRUNK: {
    BELLY_FRAC: 0.18,
    BELLY_WIDTH: 0.2,
    BELLY_GAIN: 0.12,
    JOINT_WIDTH: 0.16,
    JOINT_DROP: 0.14,
  } as AxialProfile,
  /**
   * No axial variation at all. Worn kit is not a muscle: a belt, a shoe and a
   * singlet are objects whose value structure comes from their own hand-placed
   * marks, and a belly bump on a belt reads as a dent.
   */
  AXIAL_FLAT: {
    BELLY_FRAC: 0.5,
    BELLY_WIDTH: 1,
    BELLY_GAIN: 0,
    JOINT_WIDTH: 0.5,
    JOINT_DROP: 0,
  } as AxialProfile,
} as const;

/**
 * SHADOW — contact shadow on the platform. Grounds the sprite; a 16-bit sports
 * sprite without one floats. Width shrinks as the lifter descends because the
 * light is high and the body is closer to the floor.
 */
export const SHADOW = {
  BASE_HALF_W_PX: 13,
  HALF_H_PX: 2,
  /** Extra half-width per px of stance spread. */
  STANCE_GAIN: 0.5,
  /** Half-width multiplier at full squat depth. */
  DEPTH_SHRINK: 0.86,
} as const;

/**
 * CHALK — dust puff off the hands at the moment of the drive out of the hole,
 * scaled by load. Purely a heaviness cue; a light rep gets none.
 */
export const CHALK = {
  MIN_LOAD_RATIO: 0.7,
  PUFF_TICKS: 9,
  MAX_MOTES: 7,
  /**
   * Mote positions, as (dx, dy) from the hand, in draw order. Fixed offsets and
   * not noise, because this module is pure and a random puff would make two
   * renders of the same frame differ. MAX_MOTES may not exceed this length.
   */
  MOTE_OFFSETS: [
    [0, -2],
    [2, -4],
    [-2, -3],
    [4, -6],
    [-4, -5],
    [1, -7],
    [-1, -9],
  ] as readonly (readonly [number, number])[],
} as const;

/**
 * BENCH_PRESS — feel knobs for the side-on recumbent drawing.
 *
 * Joint coordinates live in `benchPress.ts`, same class as `rig.ts`: an anchor
 * cannot be moved without redrawing the pose it names. What lives here is what
 * a playtester turns without redrawing: how coarse the bar-height sheet is,
 * and how much a strained lockout fails to finish.
 *
 * Plate diameters stay true (`plates.ts`). The side-on camera shows them as
 * faces rather than edges; that is a view change, not a scale change.
 */
export const BENCH_PRESS = {
  /** Distinct bar-height steps. Same job QUANTISE.DEPTH_STEPS does for squat. */
  HEIGHT_STEPS: 12,
  /**
   * How many sprite pixels a fully-strained lockout sits short of the authored
   * lockout. Zero at strain 0. A playtester turns this to make a grind look
   * unfinished without moving the CHEST / LOCKOUT anchors.
   */
  STRAIN_LOCKOUT_DROP_PX: 3,
} as const;

/**
 * Everything above, in one object, for callers that want to pass the whole
 * tuning set around (a debug tuner UI, a playtest build with hot-reloaded
 * values). The individual exports stay because tree-shaken imports read better
 * at the call site.
 */
export const SPRITE_TUNING = {
  TICK_HZ,
  TICK_MS,
  RESOLUTION,
  PX_PER_METRE,
  CENTER_X,
  QUANTISE,
  BRACE_SETTLE_DEPTH,
  BAR,
  BENCH_PRESS,
  LOAD_PRESETS,
  LOAD_RANGE,
  TIMING,
  DESCENT,
  STICK,
  BAR_PATH,
  BEND,
  STRAIN,
  PITCH,
  DEFORM_FOLLOW,
  SHADING,
  SHADOW,
  CHALK,
} as const;

// ---------------------------------------------------------------------------
// Load-response helpers. Every "LIGHT / MAXIMAL" pair above is read through
// these, so the shape of the load curve is defined once.
// ---------------------------------------------------------------------------

export interface LoadEndpoints {
  readonly LIGHT: number;
  readonly MAXIMAL: number;
}

/** Clamp a raw load ratio into the modelled range. */
export function clampLoadRatio(loadRatio: number): number {
  return Math.min(LOAD_RANGE.MAX, Math.max(LOAD_RANGE.MIN, loadRatio));
}

/**
 * Position of a load ratio within the modelled range, 0..1, after the
 * exponent. Monotonically increasing in loadRatio by construction — the tests
 * lean on that, so it must stay a pure power of a clamped linear term.
 */
export function loadT(loadRatio: number): number {
  const clamped = clampLoadRatio(loadRatio);
  const linear = (clamped - LOAD_RANGE.MIN) / (LOAD_RANGE.MAX - LOAD_RANGE.MIN);
  return Math.pow(linear, TIMING.LOAD_CURVE_EXPONENT);
}

/** Interpolate a LIGHT/MAXIMAL pair at a load ratio. */
export function byLoad(endpoints: LoadEndpoints, loadRatio: number): number {
  const t = loadT(loadRatio);
  return endpoints.LIGHT + (endpoints.MAXIMAL - endpoints.LIGHT) * t;
}

/** Interpolate and round to whole ticks, never below 1. */
export function ticksByLoad(endpoints: LoadEndpoints, loadRatio: number): number {
  return Math.max(1, Math.round(byLoad(endpoints, loadRatio)));
}
