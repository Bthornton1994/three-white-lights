import { Findings, makeDecision } from "../decision.ts";
import type { Analyzer, AnalyzerContext, Decision } from "../types.ts";

/** Runs nothing itself; reports the target's own test commands as executed by the pipeline. */
export const existingTests: Analyzer = {
  id: "existing-tests",
  title: "Target's own test suites",
  run: async (ctx: AnalyzerContext): Promise<Decision> => {
    const f = new Findings();
    const tests = ctx.facts.tests;
    if (!tests || !tests.ran) {
      f.abstain("EXISTING_TESTS_NOT_RUN");
    } else {
      for (const r of tests.records) {
        const label = r.cmd.replace(/\s+/g, " ").slice(0, 60);
        f.metric(`exit:${label}`, r.exitCode);
        f.check(r.exitCode === 0, `EXISTING_TEST_FAILED:${label}`);
        f.ref({ kind: "command", ref: r.cmd, note: `exit ${r.exitCode} in ${r.durationMs} ms` });
      }
      f.check(tests.records.length > 0, "NO_TEST_COMMANDS");
    }
    const verdict = f.verdict();
    return makeDecision(
      {
        id: existingTests.id,
        title: existingTests.title,
        verdict,
        confidence: verdict === "ABSTAIN" ? 0 : 0.95,
        flags: f.flags,
        metrics: f.metrics,
        evidence: f.evidence,
        humanApprovalRequired: false,
        summary:
          verdict === "PASS"
            ? "The target's node tests, sprite QA and vitest parity suite all exited 0 in this run."
            : verdict === "ABSTAIN"
              ? "The target's test suites were not executed in this run."
              : "At least one of the target's own test commands failed; see evidence.",
      },
      ctx.source,
      ctx.provider,
      ctx.now(),
    );
  },
};
