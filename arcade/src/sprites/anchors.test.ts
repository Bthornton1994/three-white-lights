import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { ANCHORS, STAGE, anchorFromSrc, contactWorld, placeAnchor } from "./anchors.ts";
import { LIFT_SHEETS, LIFT_SHEETS_MAX } from "./sheets.ts";

const FEEL_SHA = "b26c21b520d17a8e87e6abac17661fc219870a2320a376b5b1b1adfe0bc2425c";
const LIFT_SHA = "4dc74947ffc64f1af36da92c01a7cfb53d3f021b802cba31f67c3ecdcb24e417";

describe("integer sprite world", () => {
  it("is a 320×320 integer canvas with a shared contact Y", () => {
    assert.equal(STAGE.width, 320);
    assert.equal(STAGE.height, 320);
    assert.equal(STAGE.contactY, 318);
  });

  it("grounds every authored lift frame to the same world Y", () => {
    const keys = ["squat", "squatMax", "bench", "benchMax", "deadlift", "deadliftMax"] as const;
    for (const key of keys) {
      assert.equal(ANCHORS[key].length, 6);
      for (const anchor of ANCHORS[key]) {
        assert.equal(contactWorld(anchor).y, STAGE.contactY);
        assert.equal(Number.isInteger(placeAnchor(anchor).y), true);
        assert.equal(Number.isInteger(placeAnchor(anchor).x), true);
      }
    }
  });

  it("resolves existing sheet paths onto those six frames", () => {
    for (const lift of ["squat", "bench", "deadlift"] as const) {
      LIFT_SHEETS[lift].frames.forEach((src, i) => {
        const a = anchorFromSrc(src);
        assert.equal(a.contactY, ANCHORS[lift][i]?.contactY);
      });
      LIFT_SHEETS_MAX[lift].frames.forEach((src, i) => {
        const key = lift === "squat" ? "squatMax" : lift === "bench" ? "benchMax" : "deadliftMax";
        assert.equal(anchorFromSrc(src).contactY, ANCHORS[key][i]?.contactY);
      });
    }
  });
});

describe("gameplay hashes stay frozen", () => {
  it("does not retouch feel.ts or lift.ts", () => {
    assert.equal(createHash("sha256").update(readFileSync("src/feel.ts")).digest("hex"), FEEL_SHA);
    assert.equal(createHash("sha256").update(readFileSync("src/game/lift.ts")).digest("hex"), LIFT_SHA);
  });
});
