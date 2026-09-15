import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { epleyE1rm, roundToPlate } from "./e1rm.ts";

describe("Epley e1RM", () => {
  it("returns the weight for a made single", () => {
    assert.equal(epleyE1rm(180, 1), 180);
  });

  it("uses weight * (1 + reps/30)", () => {
    assert.equal(epleyE1rm(150, 3), 165);
  });

  it("rounds to 2.5 kg plates", () => {
    assert.equal(roundToPlate(182.4, 2.5), 182.5);
  });
});
