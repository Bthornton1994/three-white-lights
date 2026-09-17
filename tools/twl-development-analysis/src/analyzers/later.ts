import { makeDecision } from "../decision.ts";
import type { Analyzer, AnalyzerContext, Decision } from "../types.ts";

function abstaining(id: string, title: string, plan: string, extraFlags: string[] = []): Analyzer {
  return {
    id,
    title,
    run: async (ctx: AnalyzerContext): Promise<Decision> =>
      makeDecision(
        {
          id,
          title,
          verdict: "ABSTAIN",
          confidence: 0,
          flags: ["NOT_IMPLEMENTED", ...extraFlags],
          metrics: { plannedMeasurements: plan },
          evidence: [],
          humanApprovalRequired: true,
          summary: `${title} is scheduled for a later slice and abstains rather than guessing.`,
        },
        ctx.source,
        ctx.provider,
        ctx.now(),
      ),
  };
}

/** Later analyzers register now so the report shows them as ABSTAIN, never as silently absent. */
export const laterAnalyzers: Analyzer[] = [
  abstaining("flow", "Player flow", "screen graph coverage, dead ends, return paths, time-to-first-input"),
  abstaining("balance", "Balance", "make/miss rates per lift and load ratio across seeds, opener suggestions vs e1RM"),
  abstaining("input-fairness", "Input fairness", "cue window widths vs fatigue, press/hold latency budget, keyboard vs pointer parity"),
  abstaining("progression", "Progression", "e1RM and streak deltas per outcome, server-authoritative boundary checks"),
  abstaining("playtest", "Human playtest", "feel, pacing, tension; cannot be established by tooling", ["HUMAN_PLAYTEST_REQUIRED"]),
];
