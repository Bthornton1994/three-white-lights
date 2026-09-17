import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Findings, foldVerdicts, makeDecision, validateDecision, worstVerdict } from "../src/decision.ts";
import { providerInfo } from "../src/config.ts";
import type { SourceIdentity } from "../src/types.ts";

const SOURCE: SourceIdentity = {
  targetSha: "fc4c1aec06f0f079b851bb703f69ee67140b4f85",
  presentationBaseSha: "1151569c40c77485ab9e9299e5db0db022437a8a",
  mechanicsSha: "288db32c06232bb0fb65ce7236a0614c698a6920",
  servedSha: null,
  servedUrl: null,
};

describe("verdict folding", () => {
  it("orders FAIL > REVIEW > ABSTAIN > PASS", () => {
    assert.equal(worstVerdict(["PASS", "REVIEW"]), "REVIEW");
    assert.equal(worstVerdict(["PASS", "ABSTAIN"]), "ABSTAIN");
    assert.equal(worstVerdict(["REVIEW", "ABSTAIN", "FAIL"]), "FAIL");
    assert.equal(worstVerdict(["PASS"]), "PASS");
  });

  it("never turns silence into a pass", () => {
    assert.equal(foldVerdicts([]), "ABSTAIN");
    const f = new Findings();
    assert.equal(f.verdict(), "ABSTAIN");
  });

  it("Findings.check records severity and flags", () => {
    const f = new Findings();
    f.check(true, "A");
    f.check(false, "B", "REVIEW");
    assert.equal(f.verdict(), "REVIEW");
    assert.deepEqual(f.flags, ["B"]);
    f.check(false, "C");
    assert.equal(f.verdict(), "FAIL");
    assert.equal(f.failCount(), 1);
  });
});

describe("decision schema", () => {
  it("stamps source, provider and clamps confidence", () => {
    const d = makeDecision(
      { id: "x", title: "X", verdict: "PASS", confidence: 1.7, humanApprovalRequired: false, summary: "ok" },
      SOURCE,
      providerInfo(),
      "2026-09-17T00:00:00.000Z",
    );
    assert.equal(d.confidence, 1);
    assert.equal(d.source.targetSha, SOURCE.targetSha);
    assert.equal(d.provider.engine, "deterministic-rules");
    assert.deepEqual(validateDecision(d), []);
  });

  it("rejects non-PASS decisions without flags and malformed SHAs", () => {
    const d = makeDecision(
      { id: "x", title: "X", verdict: "FAIL", confidence: 0.5, humanApprovalRequired: true, summary: "bad" },
      { ...SOURCE, targetSha: "nope" },
      providerInfo(),
      "2026-09-17T00:00:00.000Z",
    );
    const issues = validateDecision(d);
    assert.ok(issues.some((i) => i.path === "flags"));
    assert.ok(issues.some((i) => i.path === "source.targetSha"));
  });
});
