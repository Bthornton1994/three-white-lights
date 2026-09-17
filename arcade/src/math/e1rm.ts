/**
 * Estimated 1RM — Epley formula.
 * e1RM = weight * (1 + reps / 30)
 * For a made single, e1RM equals the weight.
 */

export function epleyE1rm(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) {
    return 0;
  }
  if (reps === 1) {
    return weightKg;
  }
  return weightKg * (1 + reps / 30);
}

export function roundToPlate(kg: number, stepKg: number): number {
  return Math.round(kg / stepKg) * stepKg;
}
