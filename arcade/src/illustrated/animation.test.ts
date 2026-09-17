import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { usesArcadeFrames } from "./assets.ts";
import {
  frameSrcFor,
  poseForScreen,
  squatDepth01,
  squatDepthPhase,
  squatSheetIndex,
  visualEffort,
  walkoutProgress,
} from "../sprites/sheets.ts";

describe("illustrated shell arcade-frame animation", () => {
  it("walkout progress advances bench and deadlift without showing lockout", () => {
    const start = walkoutProgress(0, 1100);
    const mid = walkoutProgress(550, 1100);
    const end = walkoutProgress(1100, 1100);
    assert.equal(start < mid, true);
    assert.equal(end <= 0.49, true);
    const bench = [start, mid, end].map((p, i) => frameSrcFor("bench", "walkout", p, i * 400));
    assert.equal(new Set(bench).size >= 2, true, bench.join(","));
    assert.equal(bench.some((src) => src.includes("frame-06")), false);
  });

  it("squat walkout stays standing; timing holds the hole through DEPTH", () => {
    assert.equal(frameSrcFor("squat", "walkout", 0.4, 800).includes("squat/frame-01.png"), true);
    assert.equal(squatSheetIndex("walkout", 0.49), 0);
    assert.equal(frameSrcFor("squat", "timing", 0.1, 200).includes("frame-01.png"), true);
    assert.equal(frameSrcFor("squat", "timing", 0.3, 600).includes("frame-02.png"), true);
    assert.equal(frameSrcFor("squat", "timing", 0.42, 900).includes("frame-03.png"), true);
    assert.equal(frameSrcFor("squat", "timing", 0.5, 1100).includes("frame-03.png"), true);
    assert.equal(frameSrcFor("squat", "timing", 0.57, 1200).includes("frame-03.png"), true);
    assert.equal(poseForScreen("timing", "squat", 0.5), "hole");
    assert.equal(squatDepthPhase("timing", 0.5), "hole");
    assert.equal(squatDepth01("timing", 0.5), 1);
    assert.equal(frameSrcFor("squat", "timing", 0.7, 1500).includes("frame-03.png"), false);
    assert.equal(frameSrcFor("squat", "timing", 0.95, 2000).includes("frame-06.png"), true);
    assert.equal(frameSrcFor("squat", "judging", 1, 0).includes("frame-06.png"), true);
    assert.equal(frameSrcFor("squat", "success", 1, 0).includes("/success/"), true);
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
    assert.equal(frameSrcFor("bench", "timing", 0.5, 1000).includes("/sprites/bench/frame-04.png"), true);
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