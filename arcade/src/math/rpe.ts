/**
 * Tuchscherer-style RTS RPE → %1RM chart (reps in reserve).
 * Published values — do not invent percentages.
 * Source: Reactive Training Systems / Tuchscherer RPE chart.
 */

export type Rpe = 6 | 6.5 | 7 | 7.5 | 8 | 8.5 | 9 | 9.5 | 10;

const RPE_COLUMNS: readonly Rpe[] = [10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6];

/** percent of 1RM, rows = reps 1..10, columns = RPE 10 → 6 */
const PCT_TABLE: readonly (readonly number[])[] = [
  [100.0, 97.8, 95.5, 93.9, 92.2, 90.7, 89.2, 87.8, 86.3],
  [95.5, 93.9, 92.2, 90.7, 89.2, 87.8, 86.3, 85.0, 83.7],
  [92.2, 90.7, 89.2, 87.8, 86.3, 85.0, 83.7, 82.4, 81.1],
  [89.2, 87.8, 86.3, 85.0, 83.7, 82.4, 81.1, 79.9, 78.6],
  [86.3, 85.0, 83.7, 82.4, 81.1, 79.9, 78.6, 77.4, 76.2],
  [83.7, 82.4, 81.1, 79.9, 78.6, 77.4, 76.2, 75.1, 73.9],
  [81.1, 79.9, 78.6, 77.4, 76.2, 75.1, 73.9, 72.3, 70.7],
  [78.6, 77.4, 76.2, 75.1, 73.9, 72.3, 70.7, 69.4, 68.0],
  [76.2, 75.1, 73.9, 72.3, 70.7, 69.4, 68.0, 66.7, 65.3],
  [73.9, 72.3, 70.7, 69.4, 68.0, 66.7, 65.3, 64.0, 62.6],
];

export function percentOf1rm(reps: number, rpe: number): number {
  if (reps < 1 || reps > 10) {
    throw new Error("RPE chart covers reps 1–10");
  }
  const col = RPE_COLUMNS.indexOf(rpe as Rpe);
  if (col < 0) {
    throw new Error("RPE must be 6–10 in 0.5 steps");
  }
  const row = PCT_TABLE[reps - 1];
  if (!row) {
    throw new Error("missing RPE row");
  }
  const pct = row[col];
  if (pct === undefined) {
    throw new Error("missing RPE cell");
  }
  return pct;
}

export function loadFromE1rm(e1rmKg: number, reps: number, rpe: number): number {
  return (e1rmKg * percentOf1rm(reps, rpe)) / 100;
}

/** Nearest published 1-rep RPE for a load as % of e1RM. */
export function impliedRpeFromPercent(pctOfE1rm: number): number {
  const singles = PCT_TABLE[0];
  if (!singles) {
    throw new Error("missing singles RPE row");
  }
  let best = RPE_COLUMNS[0] ?? 10;
  let bestDelta = Infinity;
  for (let i = 0; i < RPE_COLUMNS.length; i += 1) {
    const col = singles[i];
    const rpe = RPE_COLUMNS[i];
    if (col === undefined || rpe === undefined) {
      continue;
    }
    const delta = Math.abs(col - pctOfE1rm);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = rpe;
    }
  }
  return best;
}

export function clampRpe(value: number): number {
  const stepped = Math.round(value * 2) / 2;
  return Math.min(10, Math.max(6, stepped));
}
