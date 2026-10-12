import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { ANALYZERS } from "../src/analyzers/index.ts";
import { designIntent } from "../src/analyzers/design-intent.ts";
import { documentContract } from "../src/analyzers/document-contract.ts";
import { mechanicsFrameParity } from "../src/analyzers/mechanics-frame-parity.ts";
import { previewRegression } from "../src/analyzers/preview-regression.ts";
import { servedIdentity } from "../src/analyzers/served-identity.ts";
import { sourceIdentity } from "../src/analyzers/source-identity.ts";
import { spriteGrounding } from "../src/analyzers/sprite-grounding.ts";
import { validateDecision } from "../src/decision.ts";
import { FIXTURES, clone, contextFor, loadFixtureBundle } from "./helpers.ts";

const GOOD = "good-sprite-stage";
const hasFixtures = existsSync(path.join(FIXTURES, "bundles", GOOD, "bundle.json"));

function flagsStartingWith(flags: string[], prefix: string): string[] {
  return flags.filter((f) => f.startsWith(prefix));
}

describe("good fixture (trimmed real capture of the candidate)", { skip: !hasFixtures && "fixtures not built" }, () => {
  const { bundle, facts } = loadFixtureBundle(GOOD);
  const ctx = contextFor(bundle, facts, "/nonexistent");

  it("every analyzer returns a schema-valid decision stamped with the source SHAs", async () => {
    for (const a of ANALYZERS) {
      const d = await a.run(ctx);
      assert.deepEqual(validateDecision(d), [], `${a.id} invalid`);
      assert.equal(d.source.targetSha, bundle.targetSha);
      assert.equal(d.provider.engine, "deterministic-rules");
      assert.equal(typeof d.humanApprovalRequired, "boolean");
    }
  });

  it("source identity passes when hashes match pins and authority", async () => {
    const d = await sourceIdentity.run(ctx);
    assert.equal(d.verdict, "PASS", JSON.stringify(d.flags));
  });

  it("served identity passes when served bundle equals the fresh build and SHAs match", async () => {
    const d = await servedIdentity.run(ctx);
    assert.equal(d.verdict, "PASS", JSON.stringify(d.flags));
  });

  it("parity reports the held-state leak on later attempts and exact parity on first attempts", async () => {
    const d = await mechanicsFrameParity.run(ctx);
    assert.ok(flagsStartingWith(d.flags, "INPUT_HELD_STATE_LEAK").length >= 1, JSON.stringify(d.flags));
    assert.equal(d.metrics["phone-squat-a1.frameMismatchFraction"], 0);
    assert.equal(d.metrics["phone-bench-a1.frameMismatchFraction"], 0);
    assert.equal(d.metrics["phone-deadlift-a1.frameMismatchFraction"], 0);
    assert.equal(d.metrics["phone-squat-a1.heldBeforeFirstInput"], false);
    assert.equal(d.metrics["phone-squat-a2.heldBeforeFirstInput"], true);
  });

  it("grounding passes every non-pixel rule; pixel proofs fail closed when canvases are absent", async () => {
    const d = await spriteGrounding.run(ctx);
    const unexpected = d.flags.filter((f) => f !== "CANVAS_PIXELS_MISSING" && f !== "CANVAS_PROOF_INCOMPLETE");
    assert.deepEqual(unexpected, [], JSON.stringify(d.flags));
    assert.equal(d.metrics.anchorRowsMismatched, 0);
    assert.equal(d.metrics.beatsNotGrounded, 0);
    assert.equal(d.metrics.beatsMissingWorldY, 0);
  });

  it("design intent flags only the known REVIEW items on the candidate", async () => {
    const d = await designIntent.run(ctx);
    assert.notEqual(d.verdict, "FAIL", JSON.stringify(d.flags));
    assert.equal(d.metrics.depthGaugeSightings, 0);
    assert.equal(d.metrics.timingLaneSightings, 0);
    assert.equal(d.metrics.illustratedStillSightings, 0);
    assert.equal(d.metrics.stageBeatsNotPixelated, 0);
    assert.equal(d.metrics.stageBeatsNonIntegerScale, 0);
    assert.ok(d.flags.includes("CANDIDATE_BANNER_RENDERED"));
    assert.ok(d.flags.includes("DESKTOP_GUTTERS_WIDE"));
  });

  it("regression finds no structural drift against the committed evidence", async () => {
    const d = await previewRegression.run(ctx);
    assert.equal(d.metrics.committedStructuralDrift, 0);
    assert.equal(flagsStartingWith(d.flags, "FRESH_BEAT_MISSING").length, 0, JSON.stringify(d.flags));
  });

  it("document contract is a standing REVIEW that never passes", async () => {
    const d = await documentContract.run(ctx);
    assert.equal(d.verdict, "REVIEW");
    assert.ok(d.flags.includes("DOCUMENT_CONTRACT_CONFLICT"));
    assert.equal(d.humanApprovalRequired, true);
    const d2 = await documentContract.run(contextFor(bundle, { ...facts, docs: null }, "/nonexistent"));
    assert.equal(d2.verdict, "FAIL");
  });
});

interface Expectation {
  fixture: string;
  analyzer: { id: string; run: (ctx: ReturnType<typeof contextFor>) => Promise<{ verdict: string; flags: string[] }> };
  verdict: "FAIL" | "REVIEW";
  flagPrefixes: string[];
}

const NEGATIVES: Expectation[] = [
  { fixture: "negative-two-tap-timing-demo", analyzer: designIntent, verdict: "FAIL", flagPrefixes: ["TIMING_LANE_PRESENT", "TWO_TAP_PROMPT"] },
  { fixture: "negative-two-tap-timing-demo", analyzer: mechanicsFrameParity, verdict: "FAIL", flagPrefixes: ["NO_MECHANICS_STATE_IN_DOM"] },
  { fixture: "negative-still-image-shell", analyzer: designIntent, verdict: "FAIL", flagPrefixes: ["ILLUSTRATED_STILL_PRESENT", "ATHLETE_NOT_CANVAS"] },
  { fixture: "negative-still-image-shell", analyzer: spriteGrounding, verdict: "FAIL", flagPrefixes: ["STILL_IMAGE_ANIMATION"] },
  { fixture: "negative-depth-gauge", analyzer: designIntent, verdict: "FAIL", flagPrefixes: ["DEPTH_GAUGE_PRESENT"] },
  { fixture: "negative-raw-centered-tile", analyzer: spriteGrounding, verdict: "FAIL", flagPrefixes: ["ANCHORS_MISSING", "WORLD_Y_MISSING"] },
  { fixture: "negative-floating-athlete", analyzer: spriteGrounding, verdict: "FAIL", flagPrefixes: ["ATHLETE_NOT_GROUNDED", "GROUND_LINE_MOVED"] },
  { fixture: "negative-giant-gutters", analyzer: designIntent, verdict: "FAIL", flagPrefixes: ["PHONE_STAGE_TOO_SMALL", "DESKTOP_STAGE_TOO_SHORT"] },
  { fixture: "negative-smoothed-non-integer-scale", analyzer: designIntent, verdict: "FAIL", flagPrefixes: ["NOT_NEAREST_NEIGHBOR", "NON_INTEGER_SCALE"] },
  { fixture: "negative-stale-preview", analyzer: servedIdentity, verdict: "FAIL", flagPrefixes: ["STALE_PREVIEW", "SERVED_SHA_MISMATCH"] },
  { fixture: "negative-mechanics-hash-drift", analyzer: sourceIdentity, verdict: "FAIL", flagPrefixes: ["MECHANICS_HASH_MISMATCH", "SPRITE_SHEETS_CHANGED_VS_REFERENCE", "EDITION_MECHANICS_PIN_MISMATCH"] },
  { fixture: "negative-missing-evidence", analyzer: previewRegression, verdict: "FAIL", flagPrefixes: ["BASELINE_EVIDENCE_MISSING"] },
  { fixture: "negative-missing-evidence", analyzer: spriteGrounding, verdict: "FAIL", flagPrefixes: ["ANCHORS_MISSING", "SPRITE_FRAMES_UNMEASURED", "CANVAS_PIXELS_MISSING"] },
  { fixture: "negative-missing-evidence", analyzer: servedIdentity, verdict: "FAIL", flagPrefixes: ["SERVED_FACTS_MISSING"] },
];

describe("negative fixtures: known bad directions must FAIL with the named flags", { skip: !hasFixtures && "fixtures not built" }, () => {
  for (const exp of NEGATIVES) {
    it(`${exp.fixture} -> ${exp.analyzer.id}`, async () => {
      const { bundle, facts } = loadFixtureBundle(exp.fixture);
      const d = await exp.analyzer.run(contextFor(bundle, facts, "/nonexistent"));
      assert.equal(d.verdict, exp.verdict, JSON.stringify(d.flags));
      for (const prefix of exp.flagPrefixes) {
        assert.ok(flagsStartingWith(d.flags, prefix).length > 0, `expected flag ${prefix}, got ${JSON.stringify(d.flags)}`);
      }
    });
  }
});

describe("fail-closed rules on an empty capture", () => {
  it("every implemented analyzer refuses to pass with nothing to inspect", async () => {
    const { bundle, facts } = hasFixtures ? loadFixtureBundle(GOOD) : { bundle: null, facts: null };
    if (!bundle || !facts) return;
    const empty = clone(bundle);
    empty.beats = [];
    empty.traces = [];
    empty.served = null;
    const bare = clone(facts);
    bare.probe = null;
    bare.measured = null;
    bare.committedEvidence = null;
    bare.docs = null;
    bare.build = null;
    const ctx = contextFor(empty, bare, "/nonexistent");
    for (const a of [sourceIdentity, servedIdentity, mechanicsFrameParity, spriteGrounding, designIntent, previewRegression, documentContract]) {
      const d = await a.run(ctx);
      assert.equal(d.verdict, "FAIL", `${a.id} should fail closed, got ${d.verdict} ${JSON.stringify(d.flags)}`);
    }
  });
});
