import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { FABLE_STILL_LIST, LIFT_STILLS, TITLE_STILL } from "./assets.ts";

describe("illustrated Fable stills", () => {
  it("points only at the five existing concept-fable reference-ai files", () => {
    assert.equal(FABLE_STILL_LIST.length, 5);
    for (const still of FABLE_STILL_LIST) {
      assert.equal(existsSync(still.repoPath), true, still.repoPath);
      const digest = createHash("sha256").update(readFileSync(still.repoPath)).digest("hex");
      assert.equal(digest, still.sha256, still.file);
      assert.equal(still.src.startsWith("/illustrated/fable-20260916/"), true);
      assert.equal(still.file.startsWith("AI-REF-"), true);
    }
  });

  it("maps each lift to a distinct Fable still", () => {
    assert.notEqual(LIFT_STILLS.squat.file, LIFT_STILLS.bench.file);
    assert.notEqual(LIFT_STILLS.squat.file, LIFT_STILLS.deadlift.file);
    assert.notEqual(LIFT_STILLS.bench.file, LIFT_STILLS.deadlift.file);
  });

  it("does not treat templates or swatches as illustrated assets", () => {
    for (const still of FABLE_STILL_LIST) {
      assert.equal(still.repoPath.includes("/templates/"), false);
      assert.equal(still.repoPath.includes("/palette/"), false);
      assert.equal(still.repoPath.includes("/baseline/"), false);
      assert.equal(still.repoPath.includes("/sprites/"), false);
    }
    assert.equal(TITLE_STILL.file, "AI-REF-05-TITLE-SCREEN.png");
  });
});
