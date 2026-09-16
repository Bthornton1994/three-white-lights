import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ILLUSTRATED_MOTION, timingCamera } from "./motion.ts";

describe("illustrated camera", () => {
  it("pans deadlift and squat diptychs from left panel toward right", () => {
    const start = timingCamera("deadlift", 0);
    const end = timingCamera("deadlift", 1);
    assert.equal(start.objectPosition.startsWith(`${ILLUSTRATED_MOTION.DIPTYCH_PAN_LEFT_PCT}%`), true);
    assert.equal(end.objectPosition.startsWith(`${ILLUSTRATED_MOTION.DIPTYCH_PAN_RIGHT_PCT}%`), true);
    assert.equal(start.scale, ILLUSTRATED_MOTION.TIMING_ZOOM_FROM);
    assert.equal(end.scale, ILLUSTRATED_MOTION.TIMING_ZOOM_TO);
  });

  it("does not invent a second bench frame — zoom only", () => {
    const start = timingCamera("bench", 0);
    const end = timingCamera("bench", 1);
    assert.equal(start.objectPosition, ILLUSTRATED_MOTION.BENCH_OBJECT_POSITION);
    assert.equal(end.objectPosition, ILLUSTRATED_MOTION.BENCH_OBJECT_POSITION);
    assert.ok(end.scale > start.scale);
  });
});
