import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  BENCH_RACKED_NOT_SELECTED,
  BENCH_REVISED,
  FABLE_STILL_LIST,
  FABLE_STILLS,
  LIFT_STILLS,
  TITLE_STILL,
  isLegacyBenchSrc,
} from "./assets.ts";

describe("illustrated Fable stills", () => {
  it("hash-locks the five existing concept-fable reference-ai files without overwriting them", () => {
    assert.equal(FABLE_STILL_LIST.length, 5);
    for (const still of FABLE_STILL_LIST) {
      assert.equal(existsSync(still.repoPath), true, still.repoPath);
      const digest = createHash("sha256").update(readFileSync(still.repoPath)).digest("hex");
      assert.equal(digest, still.sha256, still.file);
      assert.equal(still.repoPath.startsWith("art-direction/concept-fable-20260916/reference-ai/"), true);
      assert.equal(still.file.startsWith("AI-REF-"), true);
    }
  });

  it("maps each lift to a distinct still", () => {
    assert.notEqual(LIFT_STILLS.squat.file, LIFT_STILLS.bench.file);
    assert.notEqual(LIFT_STILLS.squat.file, LIFT_STILLS.deadlift.file);
    assert.notEqual(LIFT_STILLS.bench.file, LIFT_STILLS.deadlift.file);
  });

  it("loads only the revised mid-press bench on bench select and timing", () => {
    assert.equal(LIFT_STILLS.bench.file, "bench-revised-20260916.png");
    assert.equal(LIFT_STILLS.bench.sha256, BENCH_REVISED.sha256);
    assert.equal(isLegacyBenchSrc(LIFT_STILLS.bench.src), false);
    assert.equal(LIFT_STILLS.bench.src.includes("AI-REF-02"), false);
    assert.equal(LIFT_STILLS.bench.repoPath.includes("concept-fable-20260916"), false);
    assert.equal(existsSync(BENCH_REVISED.repoPath), true);
    const digest = createHash("sha256").update(readFileSync(BENCH_REVISED.repoPath)).digest("hex");
    assert.equal(digest, "6ded9e1d74512e42527a3e1e4d86d915d210f8326a07b331c34973c4ab99548b");
    const original = createHash("sha256")
      .update(readFileSync(FABLE_STILLS.benchOriginal.repoPath))
      .digest("hex");
    assert.equal(original, FABLE_STILLS.benchOriginal.sha256);
    assert.notEqual(digest, original);
    const unused = createHash("sha256")
      .update(readFileSync(BENCH_RACKED_NOT_SELECTED.repoPath))
      .digest("hex");
    assert.equal(unused, BENCH_RACKED_NOT_SELECTED.sha256);
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

  it("does not load AI-REF-02 from bench select or timing source", () => {
    const arcade = readFileSync("src/ui/ArcadeApp.tsx", "utf8");
    const art = readFileSync("src/ui/IllustratedArt.tsx", "utf8");
    assert.equal(arcade.includes("AI-REF-02"), false);
    assert.equal(art.includes("AI-REF-02"), false);
    assert.equal(arcade.includes("benchOriginal"), false);
    assert.equal(art.includes("benchOriginal"), false);
    assert.match(art, /LIFT_STILLS\[lift\]/);
  });
});
