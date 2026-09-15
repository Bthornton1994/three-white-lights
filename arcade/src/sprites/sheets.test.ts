import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { LIFT_SHEETS, SCENE, poseForScreen } from "./sheets.ts";

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

  it("does not rewind the deadlift lockout to the setup pose", () => {
    const setup = readFileSync("public/sprites/deadlift/frame-01.png");
    const lockout = readFileSync("public/sprites/deadlift/frame-06.png");
    assert.equal(setup.equals(lockout), false);
    assert.equal(poseForScreen("timing", "deadlift", 0.95), "lock");
  });

  it("serves PNG title and platform scenes, not noisy JPEGs", () => {
    assert.equal(SCENE.title.endsWith(".png"), true);
    assert.equal(SCENE.platform.endsWith(".png"), true);
    assert.equal(existsSync(`public${SCENE.title}`), true);
    assert.equal(existsSync(`public${SCENE.platform}`), true);
    assert.equal(existsSync("public/sprites/title.jpg"), false);
    assert.equal(existsSync("public/sprites/platform.jpg"), false);
  });
});
