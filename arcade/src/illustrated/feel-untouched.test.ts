import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { applyProofToState, readProofQuery, sampleScoredMeet } from "./proof.ts";
import { initialState } from "../loop/machine.ts";

const FEEL_SHA256 = "b26c21b520d17a8e87e6abac17661fc219870a2320a376b5b1b1adfe0bc2425c";

describe("illustrated edition safeguards", () => {
  it("leaves feel.ts byte-identical to the Fable SoT tip", () => {
    const digest = createHash("sha256").update(readFileSync("src/feel.ts")).digest("hex");
    assert.equal(digest, FEEL_SHA256);
  });

  it("parses proof query without touching scoring modules' contracts", () => {
    assert.deepEqual(readProofQuery("?proof=timing"), { screen: "timing", freeze: true, lift: null });
    assert.deepEqual(readProofQuery("?proof=timing&lift=bench"), {
      screen: "timing",
      freeze: true,
      lift: "bench",
    });
    assert.deepEqual(readProofQuery("?proof=results&freeze=0"), {
      screen: "results",
      freeze: false,
      lift: null,
    });
    assert.deepEqual(readProofQuery(""), { screen: null, freeze: false, lift: null });
  });

  it("builds a results fixture through resolveAttempt and scoreMeet", () => {
    const meet = sampleScoredMeet();
    assert.equal(meet.lift, "deadlift");
    assert.equal(meet.outcomes.length, 3);
    assert.equal(meet.bombed, false);
    assert.ok(meet.bestKg > 0);
    const next = applyProofToState(initialState(null), "?proof=results");
    assert.equal(next.screen, "results");
    assert.equal(next.meet?.bestKg, meet.bestKg);
    const benchTiming = applyProofToState(initialState(null), "?proof=timing&lift=bench");
    assert.equal(benchTiming.screen, "timing");
    assert.equal(benchTiming.lift, "bench");
  });
});
