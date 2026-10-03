import { describe, expect, it } from "vitest";
import { resolveAttempt, scoreMeet } from "./score";

describe("attempt resolution + score", () => {
  it("makes a lift on great/good timing with at least two whites", () => {
    const outcome = resolveAttempt({
      attempt: 1,
      weightKg: 180,
      e1rmKg: 200,
      grades: ["great", "good"],
      fatigue: 0,
    });
    expect(outcome.made).toBe(true);
    expect(outcome.lights.filter((c) => c === "white").length).toBeGreaterThanOrEqual(2);
  });

  it("misses when a cue is late", () => {
    const outcome = resolveAttempt({
      attempt: 2,
      weightKg: 200,
      e1rmKg: 200,
      grades: ["great", "late"],
      fatigue: 0.2,
    });
    expect(outcome.made).toBe(false);
    expect(outcome.lights).toEqual(["red", "red", "red"]);
  });

  it("bombs to a zero score when all three miss", () => {
    const miss = resolveAttempt({
      attempt: 1,
      weightKg: 180,
      e1rmKg: 180,
      grades: ["miss", "miss"],
      fatigue: 0,
    });
    const meet = scoreMeet("squat", 180, [180, 185, 190], [miss, miss, miss], 0.5);
    expect(meet.bombed).toBe(true);
    expect(meet.totalKg).toBe(0);
    expect(meet.score).toBe(0);
    expect(meet.dots).toBe(0);
  });
});
