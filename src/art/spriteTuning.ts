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
 *     applied to those poses (STRAIN below) is a feel value and lives here.
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
} as const;

/**
 * BAR_PATH — deviation of the bar from a clean vertical line.
 *
 * FORWARD is sagittal (toward the toes) and is the classic heavy-squat failure:
 * the hips shoot, the bar drifts over the toes, the lifter fights it back. The
 * sprite is a FRONT view, so forward drift is not drawn as a horizontal offset
 * — that would be a lie about the camera. It is drawn as torso pitch and head
 * crane (STRAIN.FORWARD_TO_PITCH below) and exposed as data for the sagittal
 * bar-path trace. See `squatAnimation.ts` for the full note.
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
  /** Peak lateral offset of the bar centre, px. */
  LATERAL_PX: { LIGHT: 0.0, MAXIMAL: 1.0 },
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
 * STRAIN — how load deforms the pose itself.
 *
 * Timing alone is "slower". Weight is "slower AND shaped differently": the back
 * rounds, the hips outrun the shoulders, the knees track in, the head cranes
 * up, the whole thing gets uglier the closer to a limit it is. These deltas are
 * what a critic should be able to see in a still frame with the timing stripped
 * out, and the contact sheet is built to make exactly that comparison.
 *
 * Strain is quantised to LEVELS steps before rendering. 16-bit games shipped a
 * fixed sheet; continuous deformation per frame is a modern-engine tell.
 */
export const STRAIN = {
  LEVELS: 4,
  /** Strain from load alone, before phase weighting. */
  FROM_LOAD: { LIGHT: 0.08, MAXIMAL: 1.0 },
  /** Extra strain per px of forward bar drift. */
  FORWARD_TO_PITCH: 0.09,

  /**
   * Pixel deltas at strain = 1.
   *
   * None of these move the shoulder line, because the bar rides the shoulders
   * and a strain deformation that moved the bar would let a strained frame
   * misreport squat depth. Everything else is fair game.
   */
  DELTA_PX: {
    /** Hips shoot: pelvis rises ahead of the shoulders, torso folds shut. */
    HIP_SHOOT: 2.4,
    /** Head cranes up and back, away from the bar. */
    HEAD_CRANE: 1.6,
    /** Traps bunch up under the bar; the shoulder line widens. */
    SHOULDER_SHRUG: 0.9,
    /** Knees track inward (valgus). Ugly on purpose. */
    KNEE_VALGUS: 2.4,
    /** Elbows drag down and in as the lifter fights to keep the bar racked. */
    ELBOW_TUCK: 1.8,
    /** Feet spread into the floor. */
    STANCE_SPREAD: 1.0,
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
   */
  PHASE_WEIGHT: {
    BRACE: 0.25,
    /** Descent ramps from this at the top to this at the bottom. */
    DESCENT_TOP: 0.3,
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
  /** Fractions of the lit range at which the ramp steps up. */
  THRESHOLDS_4: [0.3, 0.56, 0.82],
  THRESHOLDS_3: [0.36, 0.72],
  THRESHOLDS_2: [0.52],
  /** Extra top-down lighting term on body masses, so the chest out-values the gut. */
  VERTICAL_GAIN: 0.12,
  /** Far-side limbs drop this many ramp steps for depth separation. */
  FAR_LIMB_STEP_BIAS: -1,
  /** Rim of a plate: fraction of the disc's height that catches the key light. */
  PLATE_RIM_LIT_FRAC: 0.42,
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
  BAR,
  LOAD_PRESETS,
  LOAD_RANGE,
  TIMING,
  DESCENT,
  STICK,
  BAR_PATH,
  BEND,
  STRAIN,
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
