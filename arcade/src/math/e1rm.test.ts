import { describe, expect, it } from "vitest";
import { epleyE1rm, roundToPlate } from "./e1rm";

describe("Epley e1RM", () => {
  it("returns the weight for a single", () => {
    expect(epleyE1rm(180, 1)).toBe(180);
  });

  it("uses weight * (1 + reps/30)", () => {
    expect(epleyE1rm(100, 5)).toBeCloseTo(116.666, 2);
  });

  it("returns 0 for invalid input", () => {
    expect(epleyE1rm(0, 5)).toBe(0);
    expect(epleyE1rm(100, 0)).toBe(0);
  });

  it("rounds to competition plates", () => {
    expect(roundToPlate(182.4, 2.5)).toBe(182.5);
  });
});
