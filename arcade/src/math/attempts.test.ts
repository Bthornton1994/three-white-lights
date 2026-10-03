import { describe, expect, it } from "vitest";
import { bestSuccessfulKg, nudgeAttempt, sanitizeAttempts, suggestedAttempts } from "./attempts";

describe("attempt card", () => {
  it("never lets attempts go down", () => {
    expect(sanitizeAttempts([200, 180, 170])).toEqual([200, 200, 200]);
  });

  it("suggests opener < second < third from e1RM", () => {
    const [a, b, c] = suggestedAttempts(200);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThanOrEqual(c);
    expect(c).toBe(200);
  });

  it("nudges without breaking the no-down rule", () => {
    const next = nudgeAttempt([180, 190, 200], 1, -1);
    expect(next[1]).toBeGreaterThanOrEqual(next[0] ?? 0);
  });

  it("totals the best successful attempt", () => {
    expect(bestSuccessfulKg([180, 190])).toBe(190);
    expect(bestSuccessfulKg([])).toBe(0);
  });
});
