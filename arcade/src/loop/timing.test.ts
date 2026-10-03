import { describe, expect, it } from "vitest";
import { cuesForLift, gradeTap, sequenceDurationMs } from "./timing";

describe("lift-specific timing", () => {
  it("gives squat depth + drive, bench pause + press, deadlift pull + lockout", () => {
    expect(cuesForLift("squat", 0).map((c) => c.id)).toEqual(["depth", "drive"]);
    expect(cuesForLift("bench", 0).map((c) => c.id)).toEqual(["pause", "press"]);
    expect(cuesForLift("deadlift", 0).map((c) => c.id)).toEqual(["pull", "lock"]);
  });

  it("grades a tap on the cue center as great", () => {
    const cue = cuesForLift("squat", 0)[0];
    if (!cue) {
      throw new Error("missing cue");
    }
    const duration = sequenceDurationMs("squat");
    expect(gradeTap(cue.center * duration, duration, cue)).toBe("great");
  });

  it("tightens windows when fatigued", () => {
    const fresh = cuesForLift("deadlift", 0)[1];
    const tired = cuesForLift("deadlift", 0.8)[1];
    if (!fresh || !tired) {
      throw new Error("missing lockout cue");
    }
    expect(tired.windowMs).toBeLessThan(fresh.windowMs);
  });
});
