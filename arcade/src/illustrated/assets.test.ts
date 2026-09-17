import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { LiftId } from "../feel.ts";
import type { Screen } from "../loop/machine.ts";
import {
  BENCH_RACKED_NOT_SELECTED,
  BENCH_REVISED,
  FABLE_STILL_LIST,
  FABLE_STILLS,
  LIFT_STILLS,
  TITLE_STILL,
  cameraForScreen,
  captionForScreen,
  isLegacyBenchSrc,
  isLegacySpriteSrc,
  stillForScreen,
} from "./assets.ts";

const MEET_SCREENS: Screen[] = [
  "title",
  "lift",
  "attempts",
  "walkout",
  "timing",
  "judging",
  "success",
  "failure",
  "transition",
  "bomb",
  "results",
];
const LIFTS: LiftId[] = ["squat", "bench", "deadlift"];

function appPath(rel: string): string {
  for (const root of ["src", "src/arcade"]) {
    const candidate = `${root}/${rel}`;
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`missing ${rel}`);
}

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
    const arcade = readFileSync(appPath("ui/ArcadeApp.tsx"), "utf8");
    const art = readFileSync(appPath("ui/IllustratedArt.tsx"), "utf8");
    assert.equal(arcade.includes("AI-REF-02"), false);
    assert.equal(art.includes("AI-REF-02"), false);
    assert.equal(arcade.includes("benchOriginal"), false);
    assert.equal(art.includes("benchOriginal"), false);
    assert.match(art, /stillForScreen/);
  });

  it("never maps a proof screen onto a PR #70 sprite path", () => {
    for (const screen of MEET_SCREENS) {
      for (const lift of LIFTS) {
        const still = stillForScreen(screen, lift);
        assert.equal(isLegacySpriteSrc(still.src), false, `${screen}/${lift}`);
        assert.equal(still.src.includes("/sprites/"), false, `${screen}/${lift}`);
        assert.equal(isLegacyBenchSrc(still.src), false, `${screen}/${lift}`);
      }
    }
    assert.equal(stillForScreen("attempts", "bench").file, "bench-revised-20260916.png");
    assert.equal(stillForScreen("timing", "bench").file, "bench-revised-20260916.png");
    assert.equal(stillForScreen("walkout", "bench").file, "bench-revised-20260916.png");
    assert.equal(stillForScreen("success", "squat").file, FABLE_STILLS.squat.file);
    assert.equal(stillForScreen("bomb", "deadlift").file, TITLE_STILL.file);
    assert.match(captionForScreen("timing", "deadlift"), /not frames/i);
    assert.match(captionForScreen("bomb", "squat"), /title hall/i);
  });

  it("keeps diptych camera honest: start left, finish right, bench zoom-only", () => {
    const start = cameraForScreen("timing", "deadlift", 0);
    const end = cameraForScreen("success", "deadlift", 1);
    assert.equal(start.objectPosition.startsWith("22%"), true);
    assert.equal(end.objectPosition.startsWith("78%"), true);
    const benchStart = cameraForScreen("timing", "bench", 0);
    const benchEnd = cameraForScreen("timing", "bench", 1);
    assert.equal(benchStart.objectPosition, benchEnd.objectPosition);
  });
});
