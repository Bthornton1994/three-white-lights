import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { providerInfo } from "../src/config.ts";
import { makeDecision } from "../src/decision.ts";
import { renderMarkdown } from "../src/report/markdown.ts";
import type { RunReport } from "../src/types.ts";

describe("markdown report", () => {
  it("renders every decision with verdict, flags and SHAs", () => {
    const source = {
      targetSha: "fc4c1aec06f0f079b851bb703f69ee67140b4f85",
      presentationBaseSha: "1151569c40c77485ab9e9299e5db0db022437a8a",
      mechanicsSha: "288db32c06232bb0fb65ce7236a0614c698a6920",
      servedSha: null,
      servedUrl: null,
    };
    const provider = providerInfo();
    const d = makeDecision(
      { id: "demo", title: "Demo", verdict: "REVIEW", confidence: 0.5, flags: ["X_FLAG"], metrics: { n: 1 }, humanApprovalRequired: true, summary: "s" },
      source,
      provider,
      "2026-09-17T00:00:00.000Z",
    );
    const report: RunReport = {
      schemaVersion: 1,
      runId: "r",
      generatedAt: "2026-09-17T00:00:00.000Z",
      overall: "REVIEW",
      humanApprovalRequired: true,
      source,
      provider,
      decisions: [d],
      blockers: [],
      commands: [],
      outDir: "/tmp",
    };
    const md = renderMarkdown(report);
    assert.match(md, /REVIEW/);
    assert.match(md, /X_FLAG/);
    assert.match(md, /fc4c1aec06f0f079b851bb703f69ee67140b4f85/);
    assert.match(md, /\| `demo` \|/);
  });
});
