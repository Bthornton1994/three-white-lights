import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dotsScore } from "./dots.ts";

describe("DOTS", () => {
  it("scores a male 83 kg, 500 kg total in the published band", () => {
    const score = dotsScore(500, 83, "M");
    assert.ok(score > 300 && score < 450, `unexpected DOTS ${score}`);
  });

  it("returns 0 for a bomb-out total", () => {
    assert.equal(dotsScore(0, 83, "M"), 0);
  });
});
