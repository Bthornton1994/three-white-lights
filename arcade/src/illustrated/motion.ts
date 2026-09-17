/**
 * Tunable presentation motion for the illustrated edition.
 * Not gameplay. Do not fold these into feel.ts.
 * Untuned — human playtesting owns whether the camera feels right.
 */

export const ILLUSTRATED_MOTION = {
  KEN_BURNS_DURATION_MS: 22000,
  KEN_BURNS_SCALE_TO: 1.08,
  TITLE_OBJECT_POSITION_PORTRAIT: "center top",
  TITLE_OBJECT_POSITION_WIDE: "center 46%",
  TITLE_FIT_PORTRAIT: "contain" as const,
  LIFT_CARD_OBJECT_POSITION: "center 42%",
  RESULTS_BACKDROP_POSITION: "center 40%",
  RESULTS_SHEET_OBJECT_FIT: "contain" as const,
  VIGNETTE_OPACITY: 0.62,
  LIGHTING_AMBER_OPACITY: 0.18,
  FAIL_VIGNETTE_OPACITY: 0.78,
  FAIL_LIGHTING_OPACITY: 0.08,
  SUCCESS_LIGHTING_OPACITY: 0.28,
  TIMING_ZOOM_FROM: 1,
  TIMING_ZOOM_TO: 1.06,
  /** object-position x% for diptych left panel (setup / light). */
  DIPTYCH_PAN_LEFT_PCT: 22,
  /** object-position x% for diptych right panel (lockout / max). */
  DIPTYCH_PAN_RIGHT_PCT: 78,
  DIPTYCH_PAN_Y_PCT: 48,
  BENCH_OBJECT_POSITION: "center 42%",
  REDUCED_MOTION_SCALE: 1,
} as const;

export type IllustratedCamera = {
  objectPosition: string;
  scale: number;
};

export function timingCamera(
  lift: "squat" | "bench" | "deadlift",
  progress: number,
): IllustratedCamera {
  const t = Math.min(1, Math.max(0, progress));
  const scale =
    ILLUSTRATED_MOTION.TIMING_ZOOM_FROM +
    t * (ILLUSTRATED_MOTION.TIMING_ZOOM_TO - ILLUSTRATED_MOTION.TIMING_ZOOM_FROM);
  if (lift === "bench") {
    return {
      objectPosition: ILLUSTRATED_MOTION.BENCH_OBJECT_POSITION,
      scale,
    };
  }
  const x =
    ILLUSTRATED_MOTION.DIPTYCH_PAN_LEFT_PCT +
    t * (ILLUSTRATED_MOTION.DIPTYCH_PAN_RIGHT_PCT - ILLUSTRATED_MOTION.DIPTYCH_PAN_LEFT_PCT);
  return {
    objectPosition: `${x}% ${ILLUSTRATED_MOTION.DIPTYCH_PAN_Y_PCT}%`,
    scale,
  };
}
