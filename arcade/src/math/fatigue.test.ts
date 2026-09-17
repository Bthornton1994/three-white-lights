import { describe, expect, it } from "vitest";
import { nextFatigue, windowMs } from "./fatigue";

describe("hidden fatigue", () => {
  it("grows after a miss and shrinks the next window", () => {
    const afterMiss = nextFatigue(0, 9.5, false, ["miss", "miss"]);
    expect(afterMiss).toBeGreaterThan(0);
    expect(windowMs(160, afterMiss)).toBeLessThan(160);
  });

  it("never exposes a meter value above 1", () => {
    const maxed = nextFatigue(1, 10, false, ["miss"]);
    expect(maxed).toBe(1);
  });

  it("does not grow on an easy great make at RPE 8", () => {
    const after = nextFatigue(0, 8, true, ["great", "great"]);
    expect(after).toBe(0);
  });
});
