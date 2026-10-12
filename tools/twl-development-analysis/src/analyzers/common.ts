import type { AnalyzerContext, Beat, DomSample, Trace } from "../types.ts";

export const STAGE_SCREENS = new Set(["attempts", "walkout", "play", "judging", "success", "failure", "transition", "bomb"]);
export const PLAY_SCREENS = new Set(["walkout", "play", "judging", "success", "failure"]);

export function frameIndexOf(name: string | null | undefined): number | null {
  if (!name) return null;
  const m = /frame-(\d+)\.png$/.exec(name);
  return m ? Number(m[1]) - 1 : null;
}

export function basename(p: string | null | undefined): string | null {
  if (!p) return null;
  return p.split("/").pop() ?? null;
}

export function beatsOf(ctx: AnalyzerContext, pred: (b: Beat) => boolean): Beat[] {
  return ctx.bundle.beats.filter(pred);
}

export function stageBeats(ctx: AnalyzerContext): Beat[] {
  return beatsOf(ctx, (b) => STAGE_SCREENS.has(b.dom.screen ?? ""));
}

export function playSamples(trace: Trace): DomSample[] {
  return trace.samples.filter((s) => s.dom.screen === "play").map((s) => s.dom);
}

export function phasePath(phases: (string | null)[]): string[] {
  const out: string[] = [];
  for (const p of phases) {
    if (!p) continue;
    if (out[out.length - 1] !== p) out.push(p);
  }
  return out;
}

export function ratio(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 10000) / 10000;
}

export function approx(a: number | null, b: number | null, tol: number): boolean {
  if (a === null || b === null) return false;
  return Math.abs(a - b) <= tol;
}
