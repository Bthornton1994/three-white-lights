import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { usesArcadeFrames } from "./assets.ts";
import {
  frameSrcFor,
  poseForScreen,
  visualEffort,
  walkoutProgress,
} from "../sprites/sheets.ts";

describe("illustrated shell arcade-frame animation", () => {
  it("walkout progress advances through multiple early frames without lockout", () => {
    const start = walkoutProgress(0, 1100);
    const mid = walkoutProgress(550, 1100);
    const end = walkoutProgress(1100, 1100);
    assert.equal(start < mid, true);
    assert.equal(mid < end, true);
    assert.equal(end <= 0.49, true);
    const a = frameSrcFor("squat", "walkout", start, 0);
    const b = frameSrcFor("squat", "walkout", mid, 550);
    const c = frameSrcFor("squat", "walkout", end, 1100);
    const unique = new Set([a, b, c]);
    assert.equal(unique.size >= 2, true, `${[...unique].join(",")}`);
    assert.equal(c.includes("frame-06"), false);
  });

  it("timing advances squat, bench, and deadlift on their own sheets", () => {
    const lifts = ["squat", "bench", "deadlift"] as const;
    for (const lift of lifts) {
      const frames = [0, 0.2, 0.45, 0.7, 0.95].map((p) =>
        frameSrcFor(lift, "timing", p, p * 2000),
      );
      const unique = new Set(frames);
      assert.equal(unique.size >= 3, true, `${lift} ${[...unique].join(",")}`);
      for (const src of frames) {
        assert.equal(src.includes(`/sprites/${lift}/`), true, src);
        assert.equal(src.includes("/sprites/squat/") && lift !== "squat", false, src);
      }
    }
    assert.notEqual(
      frameSrcFor("bench", "timing", 0.5, 1000),
      frameSrcFor("squat", "timing", 0.5, 1000),
    );
    assert.notEqual(
      frameSrcFor("deadlift", "timing", 0.5, 1000),
      frameSrcFor("squat", "timing", 0.5, 1000),
    );
  });

  it("deadlift judging lockout is frame-06, not setup", () => {
    const setup = frameSrcFor("deadlift", "walkout", 0, 0);
    const lock = frameSrcFor("deadlift", "judging", 1, 0);
    assert.equal(setup.includes("frame-01"), true, setup);
    assert.equal(lock.includes("deadlift/frame-06.png"), true, lock);
    assert.equal(poseForScreen("timing", "deadlift", 0.95), "lock");
    assert.notEqual(setup, lock);
  });

  it("does not retune visual effort split", () => {
    assert.equal(visualEffort(162, 180), "light");
    assert.equal(visualEffort(180, 180), "max");
    assert.equal(
      frameSrcFor("bench", "timing", 0.5, 800, "max").includes("/bench-max/"),
      true,
    );
  });

  it("marks play screens as arcade-frame runtime, not stills", () => {
    assert.equal(usesArcadeFrames("timing"), true);
    assert.equal(usesArcadeFrames("walkout"), true);
    assert.equal(usesArcadeFrames("attempts"), false);
    assert.equal(usesArcadeFrames("lift"), false);
    assert.equal(usesArcadeFrames("results"), false);
    assert.equal(usesArcadeFrames("title"), false);
  });
});