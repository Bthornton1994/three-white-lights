import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FEEL } from "../feel.ts";
import { cuesForLift, gradeTap, laneWindowPercent, sequenceDurationMs, spriteFrameIndex } from "./timing.ts";

describe("timing windows", () => {
  it("grades a centered tap as great", () => {
    const cue = cuesForLift("squat", 0)[0];
    assert.ok(cue);
    const duration = sequenceDurationMs("squat");
    assert.equal(gradeTap(cue.center * duration, duration, cue), "great");
  });

  it("grades a tap inside the visible amber band as good or great", () => {
    const cue = cuesForLift("squat", 0)[0];
    assert.ok(cue);
    const duration = sequenceDurationMs("squat");
    const half = (cue.windowMs / duration / 2) * FEEL.GOOD_HALF_WINDOW;
    const inside = gradeTap((cue.center + half * 0.7) * duration, duration, cue);
    assert.equal(inside, "good");
  });

  it("grades taps outside the visible lane as early, late, or miss", () => {
    const cue = cuesForLift("squat", 0)[0];
    assert.ok(cue);
    const duration = sequenceDurationMs("squat");
    const fullHalf = cue.windowMs / duration / 2;
    const goodHalf = fullHalf * FEEL.GOOD_HALF_WINDOW;
    const lateFringe = gradeTap((cue.center + (goodHalf + fullHalf) / 2) * duration, duration, cue);
    assert.equal(lateFringe, "late");
    const earlyFringe = gradeTap((cue.center - (goodHalf + fullHalf) / 2) * duration, duration, cue);
    assert.equal(earlyFringe, "early");
    const miss = gradeTap((cue.center + fullHalf * 2.4) * duration, duration, cue);
    assert.equal(miss, "miss");
  });

  it("draws the amber band as the graded good zone", () => {
    const duration = sequenceDurationMs("squat");
    const fresh = cuesForLift("squat", 0)[0];
    const tired = cuesForLift("squat", 0.8)[0];
    assert.ok(fresh && tired);
    const freshBand = laneWindowPercent(fresh, duration);
    const tiredBand = laneWindowPercent(tired, duration);
    assert.ok(tiredBand.widthPct < freshBand.widthPct);
    const goodWidth = ((fresh.windowMs / duration) * FEEL.GOOD_HALF_WINDOW) * 100;
    assert.ok(Math.abs(freshBand.widthPct - goodWidth) < 0.01);
  });

  it("tightens the window with fatigue", () => {
    const fresh = cuesForLift("deadlift", 0)[0];
    const tired = cuesForLift("deadlift", 1)[0];
    assert.ok(fresh && tired);
    assert.ok(tired.windowMs < fresh.windowMs);
  });

  it("maps progress onto lift frames without wrapping", () => {
    assert.equal(spriteFrameIndex("squat", 0, 6), 0);
    assert.equal(spriteFrameIndex("squat", 1, 6), 5);
  });
});
