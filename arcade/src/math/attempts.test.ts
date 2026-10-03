import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { consecutiveMakes, nudgeAttempt, sanitizeAttempts, suggestedAttempts } from "./attempts.ts";

describe("attempts", () => {
  it("never lets a later attempt go down", () => {
    const next = sanitizeAttempts([180, 170, 200]);
    assert.deepEqual(next, [180, 180, 200]);
  });

  it("suggests non-decreasing openers", () => {
    const [a, b, c] = suggestedAttempts(180);
    assert.ok(a <= b && b <= c);
  });

  it("nudges in 2.5 kg steps without going down", () => {
    const start: [number, number, number] = [160, 170, 180];
    const down = nudgeAttempt(start, 1, -1);
    assert.ok(down[1] >= down[0]);
  });

  it("counts trailing consecutive makes", () => {
    assert.equal(consecutiveMakes([true, true, false]), 0);
    assert.equal(consecutiveMakes([true, false, true]), 1);
    assert.equal(consecutiveMakes([true, true, true]), 3);
  });
});
