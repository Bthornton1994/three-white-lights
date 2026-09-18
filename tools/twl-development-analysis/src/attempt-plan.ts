/**
 * Attempt coverage for one analysis run.
 *
 * Default (flag omitted) matches the original PR #80 driver/probe:
 *   phone squat × 3, phone bench × 1, phone deadlift × 1, desktop squat × 1.
 *
 * `--attempts-per-lift 3` covers every lift on both viewports (18 cases).
 */
import type { LiftId, Viewport } from "./types.ts";
import { LIFT_IDS } from "./types.ts";

export const DEFAULT_ATTEMPTS_PER_LIFT: null = null;

export function parseAttemptsPerLift(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1 || n > 9) {
    throw new Error(`--attempts-per-lift expects an integer 1..9, got ${JSON.stringify(raw)}`);
  }
  return n;
}

export function liftsByViewport(attemptsPerLift: number | null): Record<Viewport["name"], LiftId[]> {
  if (attemptsPerLift !== null) {
    return { phone: [...LIFT_IDS], desktop: [...LIFT_IDS] };
  }
  return { phone: [...LIFT_IDS], desktop: ["squat"] };
}

export function attemptsFor(lift: LiftId, viewport: Viewport["name"], attemptsPerLift: number | null): number {
  if (attemptsPerLift !== null) return attemptsPerLift;
  return lift === "squat" && viewport === "phone" ? 3 : 1;
}

export function probePlan(attemptsPerLift: number | null): { lift: LiftId; attempts: number }[] {
  if (attemptsPerLift !== null) {
    return LIFT_IDS.map((lift) => ({ lift, attempts: attemptsPerLift }));
  }
  return [
    { lift: "squat", attempts: 3 },
    { lift: "bench", attempts: 1 },
    { lift: "deadlift", attempts: 1 },
  ];
}

export function expectedTraceIds(attemptsPerLift: number | null): string[] {
  const ids: string[] = [];
  const viewports: Viewport["name"][] = attemptsPerLift !== null ? ["phone", "desktop"] : ["phone", "desktop"];
  for (const viewport of viewports) {
    for (const lift of liftsByViewport(attemptsPerLift)[viewport]) {
      const n = attemptsFor(lift, viewport, attemptsPerLift);
      for (let attempt = 1; attempt <= n; attempt += 1) ids.push(`${viewport}-${lift}-a${attempt}`);
    }
  }
  return ids;
}

export function expectedCaseCount(attemptsPerLift: number | null): number {
  return expectedTraceIds(attemptsPerLift).length;
}
