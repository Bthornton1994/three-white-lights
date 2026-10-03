import { FEEL } from "../feel.ts";
import { loadFromE1rm } from "./rpe.ts";
import { roundToPlate } from "./e1rm.ts";

export function suggestedAttempts(e1rmKg: number): [number, number, number] {
  const step = FEEL.PLATE_STEP_KG;
  const opener = roundToPlate(e1rmKg * FEEL.OPENER_PCT, step);
  const second = roundToPlate(e1rmKg * FEEL.SECOND_PCT, step);
  const third = roundToPlate(e1rmKg * FEEL.THIRD_PCT, step);
  return sanitizeAttempts([opener, second, third]);
}

export function sanitizeAttempts(
  raw: [number, number, number],
): [number, number, number] {
  const step = FEEL.PLATE_STEP_KG;
  let prev: number = FEEL.MIN_ATTEMPT_KG;
  const out: [number, number, number] = [prev, prev, prev];
  for (let i = 0; i < 3; i += 1) {
    const rounded = roundToPlate(raw[i] ?? prev, step);
    const clamped = Math.min(FEEL.MAX_ATTEMPT_KG, Math.max(prev, rounded));
    out[i] = clamped;
    prev = clamped;
  }
  return out;
}

export function nudgeAttempt(
  attempts: [number, number, number],
  index: 0 | 1 | 2,
  direction: 1 | -1,
): [number, number, number] {
  const trial: [number, number, number] = [...attempts];
  trial[index] = (trial[index] ?? FEEL.MIN_ATTEMPT_KG) + direction * FEEL.PLATE_STEP_KG;
  return sanitizeAttempts(trial);
}

export function bestSuccessfulKg(madeWeights: readonly number[]): number {
  if (madeWeights.length === 0) {
    return 0;
  }
  return Math.max(...madeWeights);
}

export function openerFromChart(e1rmKg: number): number {
  return roundToPlate(loadFromE1rm(e1rmKg, 1, 8), FEEL.PLATE_STEP_KG);
}

export function consecutiveMakes(madeFlags: readonly boolean[]): number {
  let streak = 0;
  for (const made of madeFlags) {
    if (!made) {
      streak = 0;
      continue;
    }
    streak += 1;
  }
  return streak;
}
