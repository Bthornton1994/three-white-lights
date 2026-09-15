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
    walkout: 900,
    squatDescend: 1100,
    squatHole: 420,
    squatDrive: 700,
    benchLower: 900,
    benchPause: 380,
    benchPress: 650,
    deadliftStart: 500,
    deadliftPull: 900,
    deadliftLock: 520,
    judging: 700,
    successHold: 900,
    missHold: 1100,
    transition: 650,
  },

  WINDOW_MS: {
    squatDepth: 160,
    squatDrive: 180,
    benchPause: 150,
    benchPress: 170,
    deadliftPull: 170,
    deadliftLock: 190,
  },

  FATIGUE_WINDOW_SHRINK: 0.42,
  FATIGUE_PER_HARD_MAKE: 0.18,
  FATIGUE_PER_GRIND: 0.12,
  FATIGUE_PER_MISS: 0.22,
  FATIGUE_PER_RPE_ABOVE_8: 0.08,
  FATIGUE_MAX: 1,

  GREAT_HALF_WINDOW: 0.28,
  GOOD_HALF_WINDOW: 0.72,

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
