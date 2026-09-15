import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveAttempt, scoreMeet } from "./score.ts";

describe("attempt resolution", () => {
  it("awards a good lift for two whites", () => {
    const outcome = resolveAttempt({
      attempt: 1,
      weightKg: 162.5,
      e1rmKg: 180,
      grades: ["great", "good"],
      fatigue: 0,
    });
    assert.equal(outcome.made, true);
    assert.equal(outcome.lights.filter((c) => c === "white").length, 2);
  });

  it("red-lights a miss", () => {
    const outcome = resolveAttempt({
      attempt: 1,
      weightKg: 180,
      e1rmKg: 180,
      grades: ["miss", "late"],
      fatigue: 0.4,
    });
    assert.equal(outcome.made, false);
    assert.deepEqual(outcome.lights, ["red", "red", "red"]);
  });

  it("breaks score into weight, execution, streak, total", () => {
    const first = resolveAttempt({
      attempt: 1,
      weightKg: 160,
      e1rmKg: 180,
      grades: ["great", "great"],
      fatigue: 0,
    });
    const meet = scoreMeet("squat", 180, [160, 170, 180], [first], 0.1, 2);
    assert.equal(meet.breakdown.total, meet.score);
    assert.ok(meet.breakdown.weight > 0);
    assert.ok(meet.breakdown.execution > 0);
    assert.ok(meet.breakdown.streak > 0);
  });

  it("zeros a bomb-out", () => {
    const miss = resolveAttempt({
      attempt: 1,
      weightKg: 180,
      e1rmKg: 180,
      grades: ["miss", "miss"],
      fatigue: 0,
    });
    const meet = scoreMeet("deadlift", 200, [180, 180, 180], [miss, miss, miss], 0.8, 4);
    assert.equal(meet.bombed, true);
    assert.equal(meet.totalKg, 0);
    assert.equal(meet.score, 0);
  });
});
