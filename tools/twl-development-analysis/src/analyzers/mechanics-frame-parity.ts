import { Findings, makeDecision } from "../decision.ts";
import type { Analyzer, AnalyzerContext, Decision, ProbeFrame, ProbeTrace, Trace } from "../types.ts";
import { approx, basename, frameIndexOf, phasePath, playSamples, ratio } from "./common.ts";

interface PairStats {
  compared: number;
  frameMismatch: number;
  numericMismatch: number;
  promptMismatch: number;
  commandMismatch: number;
  lagged: number;
}

function comparePair(browser: Trace, probe: ProbeTrace, lagTolerance: number, sampleByFrame: Map<number, ProbeFrame>): PairStats {
  const stats: PairStats = { compared: 0, frameMismatch: 0, numericMismatch: 0, promptMismatch: 0, commandMismatch: 0, lagged: 0 };
  for (const s of browser.samples) {
    if (s.dom.screen !== "play") continue;
    const candidates: ProbeFrame[] = [];
    for (let lag = 0; lag <= lagTolerance; lag += 1) {
      const row = sampleByFrame.get(s.frame - lag);
      if (row) candidates.push(row);
    }
    if (candidates.length === 0) continue;
    stats.compared += 1;
    const browserIdx = frameIndexOf(s.dom.animFrame);
    const matchAt = (row: ProbeFrame): boolean =>
      row.phase === s.dom.phase &&
      frameIndexOf(basename(row.frameSrc)) === browserIdx &&
      approx(row.depth, s.dom.depth, 0.002) &&
      approx(row.barHeight, s.dom.barHeight, 0.002);
    const exact = candidates[0] && matchAt(candidates[0]);
    const anyLag = candidates.some(matchAt);
    if (!anyLag) {
      const frameOk = candidates.some((row) => row.phase === s.dom.phase && frameIndexOf(basename(row.frameSrc)) === browserIdx);
      if (!frameOk) stats.frameMismatch += 1;
      else stats.numericMismatch += 1;
    } else if (!exact) stats.lagged += 1;
    const promptOk = candidates.some((row) => row.prompt === s.dom.prompt);
    if (!promptOk) stats.promptMismatch += 1;
    const cmdOk = candidates.some((row) => row.press === s.dom.commandPress && row.lockout === s.dom.commandLockout);
    if (!cmdOk) stats.commandMismatch += 1;
  }
  return stats;
}

/**
 * Mechanics-to-frame parity. The browser trace (stepped at 16 ms with a paused
 * fake clock) is compared frame-for-frame to the mechanics probe's mirror of
 * the same input schedule run through the target's own createLift/stepLift
 * and frame mapping. A second, lag-independent check asks the target's frame
 * oracle which frame the DOM's own (phase, depth, barHeight) should show.
 */
export const mechanicsFrameParity: Analyzer = {
  id: "mechanics-frame-parity",
  title: "Mechanics-to-frame parity",
  run: async (ctx: AnalyzerContext): Promise<Decision> => {
    const f = new Findings();
    const { bundle, facts, intent } = ctx;
    const probe = facts.probe;
    if (!probe || probe.traces.length === 0) f.fail("PROBE_TRACE_MISSING");
    if (probe && probe.errors.length > 0) {
      f.metric("probeErrors", probe.errors.join(" | ").slice(0, 400));
      f.review("PROBE_REPORTED_ERRORS");
    }
    if (bundle.traces.length === 0) f.fail("BROWSER_TRACE_MISSING");

    let totalCompared = 0;
    let totalFrameMismatch = 0;
    let totalNumeric = 0;
    let totalPrompt = 0;
    let totalCommand = 0;
    let totalLagged = 0;
    let traceCount = 0;
    let healthyCompared = 0;
    let healthyFrameMismatch = 0;
    for (const trace of bundle.traces) {
      const pt = probe?.traces.find((t) => t.lift === trace.lift && t.attempt === trace.attempt) ?? null;
      const label = trace.id;
      if (!pt) {
        f.fail(`PROBE_TRACE_MISSING:${label}`);
        continue;
      }
      traceCount += 1;
      const samples = playSamples(trace);
      f.metric(`${label}.samples`, samples.length);
      f.check(samples.length > 0, `NO_PLAY_SAMPLES:${label}`);
      const withPhase = samples.filter((s) => s.phase !== null).length;
      f.check(withPhase === samples.length && samples.length > 0, `NO_MECHANICS_STATE_IN_DOM:${label}`);

      const firstSample = trace.samples[0]?.dom ?? null;
      const firstPress = trace.inputPlan.find((i) => i.kind === "press")?.frame ?? null;
      const firstMotion = trace.samples.find((s) => s.dom.phase !== null && s.dom.phase !== "BRACE")?.frame ?? null;
      f.metric(`${label}.heldBeforeFirstInput`, firstSample?.held ?? null);
      f.metric(`${label}.firstPressFrame`, firstPress);
      f.metric(`${label}.firstMotionFrame`, firstMotion);
      const firstPressAccepted = (trace.firstPressAccepted ?? (firstSample?.held !== true && trace.inputPlan.some((i) => i.kind === "press")));
      f.metric(`${label}.firstPressAccepted`, firstPressAccepted);
      f.check(firstSample?.held !== true, `INPUT_HELD_STATE_LEAK:${label}`);
      f.check(firstPressAccepted === true, `FIRST_PRESS_REJECTED:${label}`);
      const bPath = phasePath(samples.map((s) => s.phase));
      const pPath = phasePath(pt.frames.filter((r) => r.screen === "play").map((r) => r.phase));
      f.metric(`${label}.browserPhasePath`, bPath.join(">"));
      f.metric(`${label}.probePhasePath`, pPath.join(">"));
      f.check(bPath.join(">") === pPath.join(">"), `PHASE_PATH_MISMATCH:${label}`);
      f.metric(`${label}.browserEnd`, trace.endScreen);
      f.metric(`${label}.probeEnd`, pt.endScreen);
      f.check(trace.endScreen === pt.endScreen, `RESOLUTION_MISMATCH:${label}`);

      const planA = trace.inputPlan.map((i) => `${i.frame}:${i.kind}`).join(",");
      const planB = pt.inputPlan.map((i) => `${i.frame}:${i.kind}`).join(",");
      f.metric(`${label}.inputPlanMatch`, planA === planB);
      f.check(planA === planB, `INPUT_PLAN_DIVERGED:${label}`, "REVIEW");

      const byFrame = new Map<number, ProbeFrame>();
      for (const row of pt.frames) byFrame.set(row.frame, row);
      const stats = comparePair(trace, pt, intent.parity.renderLagToleranceFrames, byFrame);
      totalCompared += stats.compared;
      totalFrameMismatch += stats.frameMismatch;
      if (firstSample?.held !== true) {
        healthyCompared += stats.compared;
        healthyFrameMismatch += stats.frameMismatch;
      }
      totalNumeric += stats.numericMismatch;
      totalPrompt += stats.promptMismatch;
      totalCommand += stats.commandMismatch;
      totalLagged += stats.lagged;
      f.metric(`${label}.frameMismatchFraction`, ratio(stats.frameMismatch, stats.compared));
      f.metric(`${label}.numericMismatchFraction`, ratio(stats.numericMismatch, stats.compared));
      f.metric(`${label}.laggedFraction`, ratio(stats.lagged, stats.compared));
      f.ref({ kind: "json", ref: `trace:${label}`, note: `${stats.compared} play frames compared` });
    }
    f.metric("tracesCompared", traceCount);
    f.metric("framesCompared", totalCompared);
    f.metric("frameMismatchFraction", ratio(totalFrameMismatch, totalCompared));
    f.metric("framesComparedExcludingLeakedTraces", healthyCompared);
    f.metric("frameMismatchFractionExcludingLeakedTraces", ratio(healthyFrameMismatch, healthyCompared));
    f.metric("numericMismatchFraction", ratio(totalNumeric, totalCompared));
    f.metric("promptMismatchFraction", ratio(totalPrompt, totalCompared));
    f.metric("commandMismatchFraction", ratio(totalCommand, totalCompared));
    f.metric("renderLaggedFraction", ratio(totalLagged, totalCompared));
    if (totalCompared > 0) {
      f.check(ratio(totalFrameMismatch, totalCompared) <= intent.parity.maxFrameMismatchFraction, "FRAME_PARITY_MISMATCH");
      f.check(ratio(totalNumeric, totalCompared) <= intent.parity.maxFrameMismatchFraction, "STATE_PARITY_MISMATCH");
      f.check(totalPrompt === 0, "PROMPT_PARITY_MISMATCH");
      f.check(totalCommand === 0, "COMMAND_PARITY_MISMATCH");
    }

    const oracle = facts.oracle;
    if (!oracle) f.fail("FRAME_ORACLE_MISSING");
    else {
      let checked = 0;
      let bad = 0;
      let i = 0;
      for (const trace of bundle.traces) {
        for (const s of playSamples(trace)) {
          if (s.phase === null || s.depth === null || s.barHeight === null) continue;
          const expected = oracle.expected[i] ?? null;
          i += 1;
          const actual = frameIndexOf(s.animFrame);
          if (!expected || expected.index < 0 || actual === null) continue;
          checked += 1;
          if (!expected.accepted.includes(actual)) bad += 1;
        }
      }
      f.metric("oracleChecked", checked);
      f.metric("oracleMismatchFraction", ratio(bad, checked));
      f.check(checked > 0, "FRAME_ORACLE_EMPTY");
      f.check(bad === 0, "FRAME_ORACLE_MISMATCH");
    }

    const verdict = f.verdict();
    const confidence = totalCompared === 0 ? 0.2 : Math.min(0.97, 0.6 + totalCompared / 1500);
    return makeDecision(
      {
        id: mechanicsFrameParity.id,
        title: mechanicsFrameParity.title,
        verdict,
        confidence,
        flags: f.flags,
        metrics: f.metrics,
        evidence: f.evidence,
        humanApprovalRequired: false,
        summary:
          verdict === "PASS"
            ? "Rendered frames, phases, prompts and commands match the frozen mechanics frame for frame under an identical input schedule."
            : f.flags.some((x) => x.startsWith("INPUT_HELD_STATE_LEAK"))
              ? "The hold pad's held flag survives a lift that resolves while the finger is down, so the next attempt's first press is swallowed; later attempts then diverge from the mechanics mirror."
              : "The rendered lift did not track the frozen mechanics everywhere; see flags.",
      },
      ctx.source,
      ctx.provider,
      ctx.now(),
    );
  },
};
