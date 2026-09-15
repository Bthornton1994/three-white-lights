/**
 * Every game-feel value lives here. Untuned — human playtesting owns feel.
 * Do not scatter these as magic numbers in components.
 */

export const FEEL = {
  TITLE: "Three White Lights: Iron & Amber Arcade",
  FEDERATION: "IRON & AMBER ARCADE",
  MEET_NAME: "Arcade Open",
  LIFTER_NAME: "A. LIFTER",
  BODYWEIGHT_KG: 83,
  SEX: "M" as const,

  DEFAULT_E1RM_KG: {
    squat: 180,
    bench: 120,
    deadlift: 200,
  },

  PLATE_STEP_KG: 2.5,
  MIN_ATTEMPT_KG: 20,
  MAX_ATTEMPT_KG: 400,

  OPENER_PCT: 0.9,
  SECOND_PCT: 0.955,
  THIRD_PCT: 1.0,

  /** Internal pixel stage. Nearest-neighbor scaled. */
  STAGE_W: 160,
  STAGE_H: 120,
  STAGE_SCALE_MAX: 4,

  TIMING_MS: {
    walkout: 1100,
    squatDescend: 1400,
    squatHole: 520,
    squatDrive: 900,
    benchLower: 1200,
    benchPause: 480,
    benchPress: 850,
    deadliftStart: 700,
    deadliftPull: 1100,
    deadliftLock: 700,
    judging: 700,
    successHold: 900,
    missHold: 1100,
    transition: 650,
  },

  WINDOW_MS: {
    squatDepth: 320,
    squatDrive: 340,
    benchPause: 300,
    benchPress: 330,
    deadliftPull: 330,
    deadliftLock: 360,
  },

  FATIGUE_WINDOW_SHRINK: 0.42,
  FATIGUE_PER_HARD_MAKE: 0.18,
  FATIGUE_PER_GRIND: 0.12,
  FATIGUE_PER_MISS: 0.22,
  FATIGUE_PER_RPE_ABOVE_8: 0.08,
  FATIGUE_MAX: 1,

  GREAT_HALF_WINDOW: 0.4,
  GOOD_HALF_WINDOW: 1,

  SCORE_BEST_WEIGHT: 10,
  SCORE_GREAT: 120,
  SCORE_GOOD: 70,
  SCORE_MAKE: 40,
  SCORE_MISS: 0,
  SCORE_THREE_WHITE: 80,
  SCORE_BOMB: 0,

  HAPTIC_MS: {
    cue: 12,
    hit: 24,
    miss: 40,
    whiteLights: 18,
  },
} as const;

export type LiftId = "squat" | "bench" | "deadlift";
export type Sex = "M" | "F";
