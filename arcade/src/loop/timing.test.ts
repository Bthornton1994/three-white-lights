import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cuesForLift, gradeTap, sequenceDurationMs, spriteFrameIndex } from "./timing.ts";

describe("timing windows", () => {
  it("grades a centered tap as great", () => {
    const cue = cuesForLift("squat", 0)[0];
    assert.ok(cue);
    const duration = sequenceDurationMs("squat");
    assert.equal(gradeTap(cue.center * duration, duration, cue), "great");
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
