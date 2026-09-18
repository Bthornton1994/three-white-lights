/**
 * Derives one AttemptCase per browser trace. Pure: no I/O, no game imports.
 */
import { phasePath } from "./analyzers/common.ts";
import type { AttemptCase, CaptureBundle, ProbeTrace, Trace, WorktreeFacts } from "./types.ts";

function heldOf(trace: Trace): boolean | null {
  if (trace.heldBeforeFirstInput !== undefined && trace.heldBeforeFirstInput !== null) return trace.heldBeforeFirstInput;
  return trace.samples[0]?.dom.held ?? null;
}

function firstPressAcceptedOf(trace: Trace): boolean {
  if (typeof trace.firstPressAccepted === "boolean") return trace.firstPressAccepted;
  const held = heldOf(trace);
  const hasPress = trace.inputPlan.some((i) => i.kind === "press");
  return held !== true && hasPress;
}

function overflowOf(trace: Trace, bundle: CaptureBundle): boolean {
  const fromTrace = trace.samples.some((s) => s.dom.scrollWidth > s.dom.innerWidth);
  const fromBeats = bundle.beats.some(
    (b) => b.viewport === trace.viewport && b.lift === trace.lift && b.dom.scrollWidth > b.dom.innerWidth,
  );
  return fromTrace || fromBeats;
}

function groundedOf(trace: Trace, contactY: number): boolean | null {
  const play = trace.samples.filter((s) => s.dom.screen === "play");
  const withY = play.filter((s) => s.dom.worldY !== null);
  if (withY.length === 0) return null;
  return withY.every((s) => s.dom.worldY === contactY);
}

function consoleErrorsFor(trace: Trace, notes: string[]): string[] {
  const prefix = `${trace.viewport}:`;
  return notes.filter((n) => n.startsWith(prefix) && /pageerror|console\.error/i.test(n));
}

function pairStats(trace: Trace, probe: ProbeTrace | null): { compared: number; mismatch: number } {
  if (!probe) return { compared: 0, mismatch: 0 };
  const byFrame = new Map(probe.frames.map((row) => [row.frame, row]));
  let compared = 0;
  let mismatch = 0;
  for (const s of trace.samples) {
    if (s.dom.screen !== "play") continue;
    const row = byFrame.get(s.frame) ?? byFrame.get(s.frame - 1);
    if (!row) continue;
    compared += 1;
    const samePhase = row.phase === s.dom.phase;
    if (!samePhase) mismatch += 1;
  }
  return { compared, mismatch };
}

function missMatches(trace: Trace, probe: ProbeTrace | null): boolean | null {
  const browserMiss = trace.endScreen === "failure" || probe?.made === false && trace.endScreen !== "success";
  const probeMiss = probe ? probe.made === false || probe.endScreen === "failure" : null;
  if (probeMiss !== true && trace.endScreen !== "failure") return null;
  if (probe === null) return false;
  const bPath = phasePath(trace.samples.filter((s) => s.dom.screen === "play").map((s) => s.dom.phase)).join(">");
  const pPath = phasePath(probe.frames.filter((r) => r.screen === "play").map((r) => r.phase)).join(">");
  return browserMiss === true && probeMiss === true && bPath === pPath && trace.endScreen === probe.endScreen;
}

export function buildAttemptCases(bundle: CaptureBundle, facts: WorktreeFacts): AttemptCase[] {
  const contactY = facts.probe?.stage?.contactY ?? 318;
  const servedSha = bundle.beats[0]?.dom.sportSource ?? facts.probe?.edition?.MECHANICS_SHA ?? null;
  return bundle.traces.map((trace) => {
    const probe = facts.probe?.traces.find((t) => t.lift === trace.lift && t.attempt === trace.attempt) ?? null;
    const stats = pairStats(trace, probe);
    const held = heldOf(trace);
    const firstPressAccepted = firstPressAcceptedOf(trace);
    const bPath = phasePath(trace.samples.filter((s) => s.dom.screen === "play").map((s) => s.dom.phase));
    const pPath = probe ? phasePath(probe.frames.filter((r) => r.screen === "play").map((r) => r.phase)) : [];
    return {
      id: trace.id,
      targetSha: bundle.targetSha,
      servedSha: typeof servedSha === "string" ? servedSha : null,
      viewport: trace.viewport,
      lift: trace.lift,
      attempt: trace.attempt,
      inputEvents: trace.inputPlan,
      mechanicsPhasePath: bPath,
      probePhasePath: pPath,
      frameTrace: trace.samples.map((s) => ({
        frame: s.frame,
        phase: s.dom.phase,
        animFrame: s.dom.animFrame,
      })),
      heldBeforeFirstInput: held,
      firstPressAccepted,
      finalJudgment: trace.endScreen,
      probeJudgment: probe?.endScreen ?? null,
      made: probe?.made ?? null,
      probeMade: probe?.made ?? null,
      consoleErrors: consoleErrorsFor(trace, bundle.notes),
      horizontalOverflow: overflowOf(trace, bundle),
      grounded: groundedOf(trace, contactY),
      framesCompared: stats.compared,
      frameMismatch: stats.mismatch,
      missMatchesMechanics: missMatches(trace, probe),
    };
  });
}

export function inspectHoldPadSource(holdPadText: string | null, arcadeAppText: string | null): import("./types.ts").HoldPadSourceFacts {
  const controller = holdPadText ?? "";
  const app = arcadeAppText ?? "";
  const combined = `${controller}\n${app}`;
  return {
    controllerPresent: holdPadText !== null && holdPadText.length > 0,
    controllerPath: "arcade/src/ui/holdPad.ts",
    arcadeAppPath: "arcade/src/ui/ArcadeApp.tsx",
    hasPointerUp: /pointerup/.test(combined),
    hasPointerCancel: /pointercancel/.test(combined),
    hasScreenChanged: /screenChanged/.test(combined),
    hasDispose: /\bdispose\s*\(/.test(combined),
    hasResetClear: /resetToTitle|screenChanged|held\s*=\s*false/.test(combined),
    snippets: [
      holdPadText !== null ? "holdPad.ts present" : "holdPad.ts missing",
      /pointerup/.test(combined) ? "pointerup" : "no pointerup",
      /pointercancel/.test(combined) ? "pointercancel" : "no pointercancel",
      /screenChanged/.test(combined) ? "screenChanged" : "no screenChanged",
      /\bdispose\s*\(/.test(combined) ? "dispose" : "no dispose",
    ],
  };
}
