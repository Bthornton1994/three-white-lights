import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { describe, it } from "node:test";
import { LIFT_SHEETS, poseForScreen } from "./sheets.ts";

describe("sprite package identity", () => {
  it("gives squat, bench, and deadlift distinct sheet paths", () => {
    assert.notEqual(LIFT_SHEETS.squat.src, LIFT_SHEETS.bench.src);
    assert.notEqual(LIFT_SHEETS.squat.src, LIFT_SHEETS.deadlift.src);
    assert.notEqual(LIFT_SHEETS.bench.src, LIFT_SHEETS.deadlift.src);
  });

  it("never falls back squat frames for bench or deadlift", () => {
    assert.equal(LIFT_SHEETS.bench.fallbackLift, "bench");
    assert.equal(LIFT_SHEETS.deadlift.fallbackLift, "deadlift");
    assert.notEqual(LIFT_SHEETS.bench.fallbackLift, "squat");
    assert.notEqual(LIFT_SHEETS.deadlift.fallbackLift, "squat");
  });

  it("uses lift-specific poses for timing", () => {
    assert.equal(poseForScreen("timing", "squat", 0.5), "hole");
    assert.equal(poseForScreen("timing", "bench", 0.45), "pause");
    assert.equal(poseForScreen("timing", "deadlift", 0.8), "lock");
  });

  it("ships distinct processed frames for each lift", () => {
    for (const lift of ["squat", "bench", "deadlift"] as const) {
      const sheet = LIFT_SHEETS[lift];
      assert.equal(existsSync(`public${sheet.src}`), true, sheet.src);
      for (const frame of sheet.frames) {
        assert.equal(existsSync(`public${frame}`), true, frame);
      }
    }
  });
});
