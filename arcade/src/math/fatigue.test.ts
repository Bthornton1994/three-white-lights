import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextFatigue, windowMs } from "./fatigue.ts";

describe("hidden fatigue", () => {
  it("shrinks the timing window as fatigue rises", () => {
    const fresh = windowMs(160, 0);
    const tired = windowMs(160, 1);
    assert.ok(tired < fresh);
    assert.ok(tired >= 70);
  });

  it("adds more fatigue on a miss than a clean make", () => {
    const miss = nextFatigue(0, 9, false, ["miss", "miss"]);
    const make = nextFatigue(0, 7, true, ["great", "great"]);
    assert.ok(miss > make);
  });
});
