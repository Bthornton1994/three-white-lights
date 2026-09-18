import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { attemptMatrix } from "../src/analyzers/attempt-matrix.ts";
import { mechanicsFrameParity } from "../src/analyzers/mechanics-frame-parity.ts";
import { servedIdentity } from "../src/analyzers/served-identity.ts";
import { sourceIdentity } from "../src/analyzers/source-identity.ts";
import { parseAttemptsPerLift, expectedCaseCount, expectedTraceIds, liftsByViewport, probePlan, attemptsFor } from "../src/attempt-plan.ts";
import { FORBIDDEN_PORTS } from "../src/browser/server.ts";
import { clone, contextFor, loadFixtureBundle } from "./helpers.ts";
import { fileHashAt, repoRoot } from "../src/git.ts";
import type { AttemptCase, LiftId, Trace } from "../src/types.ts";

describe("CLI --attempts-per-lift", () => {
  it("omitted / empty preserves default null coverage", () => {
    assert.equal(parseAttemptsPerLift(null), null);
    assert.equal(parseAttemptsPerLift(undefined), null);
    assert.equal(parseAttemptsPerLift(""), null);
    assert.equal(expectedCaseCount(null), 6);
    assert.deepEqual(liftsByViewport(null).desktop, ["squat"]);
    assert.equal(attemptsFor("squat", "phone", null), 3);
    assert.equal(attemptsFor("bench", "phone", null), 1);
    assert.equal(attemptsFor("deadlift", "desktop", null), 1);
    assert.deepEqual(
      probePlan(null).map((p) => `${p.lift}:${p.attempts}`),
      ["squat:3", "bench:1", "deadlift:1"],
    );
  });

  it("3 covers squat/bench/deadlift on both viewports for 18 cases", () => {
    assert.equal(parseAttemptsPerLift("3"), 3);
    assert.equal(expectedCaseCount(3), 18);
    const ids = expectedTraceIds(3);
    assert.equal(ids.length, 18);
    for (const viewport of ["phone", "desktop"] as const) {
      for (const lift of ["squat", "bench", "deadlift"] as const) {
        for (const attempt of [1, 2, 3]) {
          assert.ok(ids.includes(`${viewport}-${lift}-a${attempt}`), `${viewport}-${lift}-a${attempt}`);
        }
      }
    }
    assert.deepEqual(liftsByViewport(3).phone, ["squat", "bench", "deadlift"]);
    assert.deepEqual(liftsByViewport(3).desktop, ["squat", "bench", "deadlift"]);
    assert.deepEqual(
      probePlan(3).map((p) => `${p.lift}:${p.attempts}`),
      ["squat:3", "bench:3", "deadlift:3"],
    );
  });

  it("rejects non-integers and out-of-range values", () => {
    assert.throws(() => parseAttemptsPerLift("0"));
    assert.throws(() => parseAttemptsPerLift("10"));
    assert.throws(() => parseAttemptsPerLift("nope"));
  });
});

describe("forbidden preview ports", () => {
  it("never reuses 8080 or 8081", () => {
    assert.ok(FORBIDDEN_PORTS.has(8080));
    assert.ok(FORBIDDEN_PORTS.has(8081));
    assert.equal(FORBIDDEN_PORTS.has(37121), false);
  });
});

function healthyCase(id: string, trace: Trace, targetSha: string): AttemptCase {
  const [, viewport, lift, attempt] = /^(phone|desktop)-(squat|bench|deadlift)-a(\d+)$/.exec(id) ?? [];
  return {
    id,
    targetSha,
    servedSha: "288db32c06232bb0fb65ce7236a0614c698a6920",
    viewport: (viewport as "phone" | "desktop") ?? "phone",
    lift: (lift as LiftId) ?? "squat",
    attempt: Number(attempt ?? 1),
    inputEvents: trace.inputPlan,
    mechanicsPhasePath: ["BRACE", "DESCENT", "HOLE", "ASCENT", "LOCKOUT"],
    probePhasePath: ["BRACE", "DESCENT", "HOLE", "ASCENT", "LOCKOUT"],
    frameTrace: trace.samples.slice(0, 3).map((s) => ({ frame: s.frame, phase: s.dom.phase, animFrame: s.dom.animFrame })),
    heldBeforeFirstInput: false,
    firstPressAccepted: true,
    finalJudgment: "judging",
    probeJudgment: "judging",
    made: true,
    probeMade: true,
    consoleErrors: [],
    horizontalOverflow: false,
    grounded: true,
    framesCompared: 20,
    frameMismatch: 0,
    missMatchesMechanics: null,
  };
}

describe("18-case matrix on a healthy target", () => {
  it("passes when every case is unheld, first-press accepted, and parity-clean", async () => {
    const { bundle, facts } = loadFixtureBundle("good-sprite-stage");
    const seed = bundle.traces.find((t) => t.id === "phone-squat-a1");
    assert.ok(seed);
    const healthy = clone(bundle);
    healthy.attemptsPerLift = 3;
    healthy.traces = [];
    healthy.cases = expectedTraceIds(3).map((id) => healthyCase(id, seed!, healthy.targetSha));
    const wiring = {
      controllerPresent: true,
      controllerPath: "arcade/src/ui/holdPad.ts",
      arcadeAppPath: "arcade/src/ui/ArcadeApp.tsx",
      hasPointerUp: true,
      hasPointerCancel: true,
      hasScreenChanged: true,
      hasDispose: true,
      hasResetClear: true,
      snippets: ["holdPad.ts present"],
    };
    const d = await attemptMatrix.run(contextFor(healthy, { ...facts, holdPadSource: wiring }, "/nonexistent"));
    assert.equal(d.verdict, "PASS", JSON.stringify(d.flags));
    assert.equal(d.metrics.caseCount, 18);
    assert.equal(d.metrics.heldLeaks, 0);
    assert.equal(d.metrics.firstPressRejected, 0);
    assert.equal(d.metrics.frameMismatchTotal, 0);
    for (const id of expectedTraceIds(3)) {
      assert.equal(d.metrics[`${id}.heldBeforeFirstInput`], false, id);
      assert.equal(d.metrics[`${id}.firstPressAccepted`], true, id);
    }
  });

  it("fails when a 3-attempt run is missing cases", async () => {
    const { bundle, facts } = loadFixtureBundle("good-sprite-stage");
    const slim = clone(bundle);
    slim.attemptsPerLift = 3;
    slim.cases = [];
    const d = await attemptMatrix.run(contextFor(slim, facts, "/nonexistent"));
    assert.equal(d.verdict, "FAIL");
    assert.ok(d.flags.includes("ATTEMPT_MATRIX_NOT_18") || d.flags.some((f) => f.startsWith("CASE_MISSING")), JSON.stringify(d.flags));
  });
});

describe("held-state negative fixture", () => {
  it("classifies the old leak as FAIL, not PASS or REVIEW", async () => {
    const { bundle, facts } = loadFixtureBundle("negative-held-state-leak");
    const ctx = contextFor(bundle, facts, "/nonexistent");
    const matrix = await attemptMatrix.run(ctx);
    assert.equal(matrix.verdict, "FAIL");
    assert.notEqual(matrix.verdict, "PASS");
    assert.notEqual(matrix.verdict, "REVIEW");
    assert.ok(matrix.flags.some((f) => f.startsWith("INPUT_HELD_STATE_LEAK")), JSON.stringify(matrix.flags));
    const parity = await mechanicsFrameParity.run(ctx);
    assert.equal(parity.verdict, "FAIL");
    assert.ok(parity.flags.some((f) => f.startsWith("INPUT_HELD_STATE_LEAK")));
    assert.equal(parity.metrics["phone-squat-a2.heldBeforeFirstInput"], true);
    assert.equal(parity.metrics["phone-squat-a1.heldBeforeFirstInput"], false);
  });
});

describe("provenance and stale-server rejection", () => {
  it("pins the exact target SHA on source identity", async () => {
    const { bundle, facts } = loadFixtureBundle("good-sprite-stage");
    const d = await sourceIdentity.run(contextFor(bundle, facts, "/nonexistent"));
    assert.equal(d.metrics.targetSha, "fc4c1aec06f0f079b851bb703f69ee67140b4f85");
    assert.equal(d.verdict, "PASS", JSON.stringify(d.flags));
  });

  it("fileHashAt returns null for a missing blob instead of hashing empty stdin", () => {
    const root = repoRoot();
    const missing = fileHashAt(root, "b80d6a0527eafb6c93afc43f63aad71c509fd277", "no/such/file.ts");
    assert.equal(missing, null);
    assert.notEqual(missing, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    const lift = fileHashAt(root, "288db32c06232bb0fb65ce7236a0614c698a6920", "src/game/lift.ts");
    assert.equal(lift, "4dc74947ffc64f1af36da92c01a7cfb53d3f021b802cba31f67c3ecdcb24e417");
  });

  it("rejects a stale preview and a provenance SHA mismatch", async () => {
    const { bundle, facts } = loadFixtureBundle("negative-stale-preview");
    const stale = await servedIdentity.run(contextFor(bundle, facts, "/nonexistent"));
    assert.equal(stale.verdict, "FAIL");
    assert.ok(stale.flags.includes("STALE_PREVIEW") || stale.flags.includes("SERVED_SHA_MISMATCH"), JSON.stringify(stale.flags));

    const { bundle: good, facts: gf } = loadFixtureBundle("good-sprite-stage");
    const poisoned = clone(good);
    poisoned.attemptsPerLift = 3;
    poisoned.served = {
      ...(poisoned.served ?? {
        url: "http://127.0.0.1:8080/",
        indexSha256: "00",
        scriptPath: null,
        scriptSha256: null,
        cssPath: null,
        cssSha256: null,
        scriptContainsMechanicsSha: false,
        scriptContainsBaseSha: false,
        spriteHashes: {},
      }),
      url: "http://127.0.0.1:8080/",
      port: 8080,
      provenance: {
        schemaVersion: 1,
        targetSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        capturedAt: "2026-09-18T00:00:00.000Z",
        runId: "fake",
        port: 8080,
        listenToken: "nope",
        distScriptPath: null,
        distScriptSha256: null,
        indexSha256: "00",
      },
    };
    const d = await servedIdentity.run(contextFor(poisoned, gf, "/nonexistent"));
    assert.equal(d.verdict, "FAIL");
    assert.ok(d.flags.includes("PRIOR_SERVER_REUSE"), JSON.stringify(d.flags));
    assert.ok(d.flags.includes("PROVENANCE_TARGET_SHA_MISMATCH"), JSON.stringify(d.flags));
  });
});
