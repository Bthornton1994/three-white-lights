import { describe, expect, it } from "vitest";
import { dotsScore } from "./dots";

describe("DOTS published coefficients", () => {
  it("scores a known male 83 kg / 700 kg total in the published range", () => {
    const score = dotsScore(700, 83, "M");
    expect(score).toBeGreaterThan(400);
    expect(score).toBeLessThan(550);
  });

  it("returns 0 for a bombed total", () => {
    expect(dotsScore(0, 83, "M")).toBe(0);
  });

  it("is higher at the same total for a lighter lifter", () => {
    expect(dotsScore(600, 67.5, "M")).toBeGreaterThan(dotsScore(600, 93, "M"));
  });
});
