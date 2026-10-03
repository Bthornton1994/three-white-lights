import { describe, expect, it } from "vitest";
import { createBuffer } from "./canvas";
import { drawBench, drawDeadlift, drawSquat, poseFromProgress } from "./lifter";
import { renderArcadeFrame } from "./render";

function occupied(draw: () => void, buf = createBuffer()): number {
  draw();
  return buf.data.filter((p) => p !== 0).length;
}

describe("distinct lift silhouettes", () => {
  it("draws squat / bench / deadlift into different pixel sets", () => {
    const squat = createBuffer();
    drawSquat(squat, 0.5, 180, "hole", true);
    const bench = createBuffer();
    drawBench(bench, 0.5, 120, "hole", true);
    const dead = createBuffer();
    drawDeadlift(dead, 0.5, 200, "drive", true);

    let sameSquatBench = 0;
    let sameSquatDead = 0;
    for (let i = 0; i < squat.data.length; i += 1) {
      if (squat.data[i] === bench.data[i] && (squat.data[i] ?? 0) !== 0) {
        sameSquatBench += 1;
      }
      if (squat.data[i] === dead.data[i] && (squat.data[i] ?? 0) !== 0) {
        sameSquatDead += 1;
      }
    }
    const squatPixels = occupied(() => undefined, squat);
    expect(sameSquatBench / squatPixels).toBeLessThan(0.55);
    expect(sameSquatDead / squatPixels).toBeLessThan(0.7);
  });

  it("uses lift-specific pose names", () => {
    expect(poseFromProgress("squat", 0.5, "timing")).toBe("hole");
    expect(poseFromProgress("bench", 0.45, "timing")).toBe("hole");
    expect(poseFromProgress("deadlift", 0.9, "timing")).toBe("lock");
  });

  it("composites venue + lifter + lights", () => {
    const frame = renderArcadeFrame({
      lift: "squat",
      progress: 0.5,
      weightKg: 180,
      e1rmKg: 180,
      screen: "timing",
      lights: ["white", "white", "white"],
    });
    expect(frame.data.some((p) => p !== 0)).toBe(true);
  });
});
