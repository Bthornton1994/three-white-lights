/**
 * Every game-feel value lives here. Untuned — human playtesting owns feel.
 * Do not scatter these as magic numbers in components.
 */

export const FEEL = {
  TITLE: "Three White Lights: Iron & Amber Arcade",
  SHORT_TITLE: "Iron & Amber Arcade",
  FEDERATION: "IRON & AMBER ARCADE",
  MEET_NAME: "Arcade Open",
  LIFTER_NAME: "A. LIFTER",
  BODYWEIGHT_KG: 83,
  SEX: "M" as const,
  LOT: 12,
  PLACEHOLDER_PLACE: "—",

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

  STAGE_W: 320,
  STAGE_H: 200,

  TIMING_MS: {
    walkout: 1100,
    squatDescend: 1100,
    squatHole: 420,
    squatDrive: 700,
    benchLower: 900,
    benchPause: 380,
    benchPress: 650,
    deadliftStart: 500,
    deadliftPull: 900,
    deadliftLock: 520,
    judging: 780,
    successHold: 900,
    missHold: 1100,
    transition: 650,
  },

  WINDOW_MS: {
    squatDepth: 340,
    squatDrive: 360,
    benchPause: 320,
    benchPress: 340,
    deadliftPull: 340,
    deadliftLock: 380,
  },

  FATIGUE_WINDOW_SHRINK: 0.42,
  FATIGUE_PER_HARD_MAKE: 0.18,
  FATIGUE_PER_GRIND: 0.12,
  FATIGUE_PER_MISS: 0.22,
  FATIGUE_PER_RPE_ABOVE_8: 0.08,
  FATIGUE_MAX: 1,

  GREAT_HALF_WINDOW: 0.34,
  GOOD_HALF_WINDOW: 0.88,

  SCORE_BEST_WEIGHT: 10,
  SCORE_GREAT: 120,
  SCORE_GOOD: 70,
  SCORE_MAKE: 40,
  SCORE_MISS: 0,
  SCORE_THREE_WHITE: 80,
  SCORE_STREAK_MAKE: 50,
  SCORE_STREAK_SESSION: 25,
  SCORE_BOMB: 0,

  HAPTIC_MS: {
    cue: 12,
    hit: 24,
    miss: 40,
    whiteLights: 18,
  },

  STREAK_STORAGE_KEY: "ia-arcade-streak-v1",
} as const;

export type LiftId = "squat" | "bench" | "deadlift";
export type Sex = "M" | "F";

export const LIFT_COPY: Record<
  LiftId,
  { name: string; cue: string; checks: string }
> = {
  squat: {
    name: "Squat",
    cue: "Depth in the hole, then drive.",
    checks: "DEPTH · DRIVE",
  },
  bench: {
    name: "Bench",
    cue: "Pause on the chest, then press.",
    checks: "PAUSE · PRESS",
  },
  deadlift: {
    name: "Deadlift",
    cue: "Break the floor, lock the hips.",
    checks: "PULL · LOCKOUT",
  },
};
