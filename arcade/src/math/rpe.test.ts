import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { impliedRpeFromPercent, loadFromE1rm, percentOf1rm } from "./rpe.ts";

describe("Tuchscherer RPE chart", () => {
  it("maps a 1@10 to 100% of 1RM", () => {
    assert.equal(percentOf1rm(1, 10), 100);
  });

  it("maps a 1@8 to the published 92.2%", () => {
    assert.equal(percentOf1rm(1, 8), 92.2);
  });

  it("loads an opener from e1RM using 1@8", () => {
    assert.equal(loadFromE1rm(180, 1, 8), 165.96);
  });

  it("implies RPE 10 near a max single", () => {
    assert.equal(impliedRpeFromPercent(100), 10);
  });

  it("implies RPE 8 near 92%", () => {
    assert.equal(impliedRpeFromPercent(92.2), 8);
  });
});
