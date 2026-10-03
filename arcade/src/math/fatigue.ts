import { FEEL } from "../feel.ts";
import type { TimingGrade } from "./types.ts";

/**
 * Hidden fatigue. Never rendered as a meter.
 * Surfaces through window width, bar-speed copy, and implied RPE.
 */
export function nextFatigue(
  current: number,
  impliedRpe: number,
  made: boolean,
  grades: readonly TimingGrade[],
): number {
  let add = 0;
  if (!made) {
    add += FEEL.FATIGUE_PER_MISS;
  } else if (impliedRpe >= 9) {
    add += FEEL.FATIGUE_PER_HARD_MAKE;
  }
  if (grades.some((g) => g === "good" || g === "late" || g === "early")) {
    add += FEEL.FATIGUE_PER_GRIND;
  }
  if (impliedRpe > 8) {
    add += (impliedRpe - 8) * FEEL.FATIGUE_PER_RPE_ABOVE_8;
  }
  return Math.min(FEEL.FATIGUE_MAX, Math.max(0, current + add));
}

export function windowMs(baseMs: number, fatigue: number): number {
  const shrink = 1 - fatigue * FEEL.FATIGUE_WINDOW_SHRINK;
  return Math.max(70, baseMs * shrink);
}

export function fatigueCue(fatigue: number, made: boolean): string {
  if (!made && fatigue > 0.45) {
    return "Bar speed died — that was a grind and it missed.";
  }
  if (!made) {
    return "No lift. The timing window closed before the lock.";
  }
  if (fatigue > 0.7) {
    return "That rep looked slower than the last. Window is tighter now.";
  }
  if (fatigue > 0.4) {
    return "Bar speed fading. Next attempt will feel heavier.";
  }
  if (fatigue > 0.15) {
    return "A little chalk dust. Still moving, just less snap.";
  }
  return "Bar speed looked honest. Ready for the next one.";
}
