import { existsSync } from "node:fs";
import path from "node:path";
import { Findings, makeDecision } from "../decision.ts";
import { composeStage, diffPng, downscaleNearest, lifterRegionMismatch, readPng } from "../png.ts";
import type { Analyzer, AnalyzerContext, Beat, Decision, FrameAnchor, LiftId, MeasuredFrame } from "../types.ts";
import { approx, basename, frameIndexOf, playSamples, ratio, stageBeats } from "./common.ts";

const SHEET_KEYS: Record<string, string> = {
  squat: "squat",
  "squat-max": "squatMax",
  bench: "bench",
  "bench-max": "benchMax",
  deadlift: "deadlift",
  "deadlift-max": "deadliftMax",
  idle: "idle",
  success: "success",
  miss: "miss",
};

function candidateSheets(lift: LiftId | null, screen: string | null): string[] {
  if (screen === "success") return ["success"];
  if (screen === "failure" || screen === "bomb") return ["miss"];
  if (screen === "title" || screen === "lift") return ["idle"];
  if (!lift) return [];
  return [lift, `${lift}-max`];
}

function measuredFor(measured: MeasuredFrame[], sheet: string, index: number): MeasuredFrame | null {
  return measured.find((m) => m.sheet === sheet && m.index === index) ?? null;
}

interface ComposeResult {
  sheet: string;
  mismatchFraction: number;
  meanAbsDiff: number;
  sizeMatch: boolean;
  scale: number;
  lifterMismatch: number;
  lifterPixels: number;
}

function proveCanvas(ctx: AnalyzerContext, beat: Beat, worktreeSprites: string, platformPath: string): ComposeResult | null {
  if (!beat.canvasPng || beat.dom.destY === null || !beat.dom.animFrame) return null;
  const canvasFile = ctx.resolvePath(beat.canvasPng);
  if (!existsSync(canvasFile) || !existsSync(platformPath)) return null;
  const canvas = readPng(canvasFile);
  const platform = readPng(platformPath);
  const stageW = ctx.intent.stage.width;
  const stageH = ctx.intent.stage.height;
  const scale = canvas.width / stageW;
  const actual = Number.isInteger(scale) && scale > 1 ? downscaleNearest(canvas, scale) : canvas;
  let best: ComposeResult | null = null;
  for (const sheet of candidateSheets(beat.lift, beat.dom.screen)) {
    const frameFile = path.join(worktreeSprites, sheet, beat.dom.animFrame);
    if (!existsSync(frameFile)) continue;
    const lifter = readPng(frameFile);
    const expected = composeStage(platform, lifter, stageW, stageH, 0, beat.dom.destY);
    const d = diffPng(actual, expected);
    const lr = lifterRegionMismatch(actual, expected, lifter, 0, beat.dom.destY);
    const r: ComposeResult = {
      sheet,
      mismatchFraction: d.mismatchFraction,
      meanAbsDiff: d.meanAbsDiff,
      sizeMatch: d.sizeMatch,
      scale,
      lifterMismatch: lr.mismatch,
      lifterPixels: lr.total,
    };
    if (!best || r.mismatchFraction < best.mismatchFraction) best = r;
  }
  return best;
}

/**
 * Sprite grounding and animation continuity.
 *
 * Grounding is proven three ways: the anchor table must equal what the PNG
 * alpha actually measures, every rendered stage frame must report the shared
 * contact line, and the live canvas pixels must equal the anchored
 * composition of platform + frame. Continuity is measured on the play traces:
 * distinct frames, no jumps inside a phase, the hole frame at maximal depth,
 * a fixed ground line, and bounded foot drift.
 */
export const spriteGrounding: Analyzer = {
  id: "sprite-grounding",
  title: "Sprite grounding and animation continuity",
  run: async (ctx: AnalyzerContext): Promise<Decision> => {
    const f = new Findings();
    const { facts, bundle, intent } = ctx;
    const stage = facts.probe?.stage ?? null;
    const anchors = facts.probe?.anchors ?? null;
    if (!stage || !anchors) f.fail("ANCHORS_MISSING");
    else {
      f.metric("stage.contactY", stage.contactY);
      f.metric("stage.size", `${stage.width}x${stage.height}`);
      f.check(stage.width === intent.stage.width && stage.height === intent.stage.height, "STAGE_SPEC_MISMATCH");
      f.check(stage.contactY === intent.stage.contactY, "CONTACT_LINE_SPEC_MISMATCH");
    }

    const measured = facts.measured;
    if (!measured || measured.length === 0) f.fail("SPRITE_FRAMES_UNMEASURED");
    else if (anchors) {
      let rows = 0;
      let mismatched = 0;
      let fringe = 0;
      let wide = 0;
      for (const [dir, key] of Object.entries(SHEET_KEYS)) {
        const table = (anchors[key] ?? null) as FrameAnchor[] | null;
        const frames = measured.filter((m) => m.sheet === dir).sort((a, b) => a.index - b.index);
        if (!table) {
          if (frames.length > 0) f.fail(`ANCHOR_TABLE_MISSING:${dir}`);
          continue;
        }
        if (table.length !== frames.length) f.fail(`ANCHOR_COUNT_MISMATCH:${dir}`);
        for (const m of frames) {
          rows += 1;
          const a = table[m.index];
          if (!a) continue;
          const ok = a.minX === m.minX && a.minY === m.minY && a.maxX === m.maxX && a.maxY === m.maxY && a.contactY === m.maxY;
          if (!ok) mismatched += 1;
          if (m.semiTransparent > 0) fringe += 1;
          if (m.colors > 48) wide += 1;
        }
      }
      f.metric("anchorRowsChecked", rows);
      f.metric("anchorRowsMismatched", mismatched);
      f.metric("framesWithFringe", fringe);
      f.metric("framesOver48Colors", wide);
      f.check(rows > 0, "NO_FRAMES_MEASURED");
      f.check(mismatched === 0, "ANCHOR_MISMATCH");
      f.check(fringe === 0, "SPRITE_FRINGE");
      f.check(wide === 0, "SPRITE_PALETTE_WIDE", "REVIEW");
      f.ref({ kind: "file", ref: ctx.baseline.anchorsModule, note: "anchor table vs measured PNG alpha" });
    }

    const contactY = stage?.contactY ?? intent.stage.contactY;
    const tol = intent.stage.contactYTolerancePx;
    const beats = stageBeats(ctx);
    f.metric("stageBeats", beats.length);
    f.check(beats.length > 0, "NO_STAGE_BEATS");
    let notGrounded = 0;
    let worldMissing = 0;
    let arithmetic = 0;
    let noStage = 0;
    let canvasSize = 0;
    for (const b of beats) {
      if (!b.dom.hasSpriteStage) {
        noStage += 1;
        continue;
      }
      if (b.dom.worldY === null || b.dom.contactY === null || b.dom.destY === null) {
        worldMissing += 1;
        continue;
      }
      if (!approx(b.dom.worldY, contactY, tol)) notGrounded += 1;
      if (b.dom.destY + b.dom.contactY !== b.dom.worldY) arithmetic += 1;
      if (b.dom.canvasAttrWidth !== intent.stage.width || b.dom.canvasAttrHeight !== intent.stage.height) canvasSize += 1;
    }
    f.metric("beatsWithoutSpriteStage", noStage);
    f.metric("beatsMissingWorldY", worldMissing);
    f.metric("beatsNotGrounded", notGrounded);
    f.metric("beatsAnchorArithmeticBroken", arithmetic);
    f.metric("beatsCanvasSizeWrong", canvasSize);
    f.check(noStage === 0, "SPRITE_STAGE_MISSING_ON_STAGE_SCREEN");
    f.check(worldMissing === 0, "WORLD_Y_MISSING");
    f.check(notGrounded === 0, "ATHLETE_NOT_GROUNDED");
    f.check(arithmetic === 0, "ANCHOR_ARITHMETIC_MISMATCH");
    f.check(canvasSize === 0, "CANVAS_SIZE_MISMATCH");

    const worktreeSprites = facts.worktree ? path.join(facts.worktree, "arcade", "public", "sprites") : null;
    const platform = facts.platformPng ? ctx.resolvePath(facts.platformPng.path) : null;
    let proved = 0;
    let proofFailed = 0;
    let proofMissing = 0;
    let worstMismatch = 0;
    let lifterProofFailed = 0;
    for (const b of beats) {
      if (!b.dom.hasSpriteStage) continue;
      if (!b.canvasPng) {
        if (b.dom.screen !== "attempts") proofMissing += 1;
        continue;
      }
      const r = worktreeSprites && platform ? proveCanvas(ctx, b, worktreeSprites, platform) : null;
      if (!r) {
        proofMissing += 1;
        continue;
      }
      proved += 1;
      worstMismatch = Math.max(worstMismatch, r.mismatchFraction);
      const ok = r.sizeMatch && r.mismatchFraction <= intent.stage.canvasPixelMismatchMaxFraction;
      if (!ok) proofFailed += 1;
      if (r.lifterPixels === 0 || r.lifterMismatch > 0) lifterProofFailed += 1;
      f.ref({ kind: "canvas", ref: b.canvasPng, note: `${b.id}: ${r.sheet} stage mismatch ${r.mismatchFraction}, lifter pixels off ${r.lifterMismatch}/${r.lifterPixels}, scale ${r.scale}` });
    }
    f.metric("canvasProofs", proved);
    f.metric("canvasProofsFailed", proofFailed);
    f.metric("canvasLifterProofsFailed", lifterProofFailed);
    f.metric("canvasProofsMissing", proofMissing);
    f.metric("canvasWorstMismatchFraction", worstMismatch);
    f.check(proved > 0, "CANVAS_PIXELS_MISSING");
    f.check(proofMissing === 0, "CANVAS_PROOF_INCOMPLETE", "REVIEW");
    f.check(proofFailed === 0, "CANVAS_COMPOSITION_MISMATCH");
    f.check(lifterProofFailed === 0, "ATHLETE_PIXELS_NOT_AT_ANCHOR");

    let traces = 0;
    for (const trace of bundle.traces) {
      traces += 1;
      const samples = playSamples(trace);
      const label = trace.id;
      const idx = samples.map((s) => frameIndexOf(s.animFrame));
      const distinct = new Set(idx.filter((i) => i !== null)).size;
      f.metric(`${label}.distinctFrames`, distinct);
      f.check(distinct >= intent.stage.minDistinctFramesPerLift, `STILL_IMAGE_ANIMATION:${label}`);
      let jumps = 0;
      for (let i = 1; i < samples.length; i += 1) {
        const a = idx[i - 1];
        const b = idx[i];
        if (a === null || b === null || a === undefined || b === undefined) continue;
        if (samples[i - 1]!.phase === samples[i]!.phase && Math.abs(b - a) > intent.stage.maxFrameJumpWithinPhase) jumps += 1;
      }
      f.metric(`${label}.frameJumpsWithinPhase`, jumps);
      f.check(jumps === 0, `FRAME_DISCONTINUITY:${label}`);
      const worldYs = new Set(samples.map((s) => s.worldY));
      f.metric(`${label}.groundLineValues`, Array.from(worldYs).join(","));
      f.check(worldYs.size === 1 && !worldYs.has(null), `GROUND_LINE_MOVED:${label}`);
      if (trace.lift === "squat" || trace.lift === "bench") {
        const deepest = samples.reduce<(typeof samples)[number] | null>((acc, s) => (s.depth !== null && (acc === null || (acc.depth ?? -1) < s.depth) ? s : acc), null);
        const holeIdx = deepest ? frameIndexOf(deepest.animFrame) : null;
        f.metric(`${label}.frameAtMaxDepth`, holeIdx);
        f.check(holeIdx === 2, `HOLE_FRAME_MISSING:${label}`);
      }
      if (measured) {
        const feet: number[] = [];
        for (const s of samples) {
          const i = frameIndexOf(s.animFrame);
          if (i === null) continue;
          for (const sheet of candidateSheets(trace.lift, "play")) {
            const m = measuredFor(measured, sheet, i);
            if (m?.footCenterX !== null && m?.footCenterX !== undefined) {
              feet.push(m.footCenterX);
              break;
            }
          }
        }
        const drift = feet.length > 0 ? Math.max(...feet) - Math.min(...feet) : null;
        f.metric(`${label}.footDriftPx`, drift);
        if (drift !== null) f.check(drift <= intent.stage.footDriftReviewPx, `FOOT_DRIFT:${label}`, "REVIEW");
      }
    }
    f.metric("tracesAnalysed", traces);
    f.check(traces > 0, "NO_PLAY_TRACES");

    const verdict = f.verdict();
    const confidence = proved > 0 && traces > 0 ? 0.9 : 0.5;
    return makeDecision(
      {
        id: spriteGrounding.id,
        title: spriteGrounding.title,
        verdict,
        confidence,
        flags: f.flags,
        metrics: f.metrics,
        evidence: f.evidence,
        humanApprovalRequired: true,
        summary:
          verdict === "PASS"
            ? "Anchors match the PNG alpha, every stage frame sits on the shared contact line, the live canvas equals the anchored composition, and play traces animate continuously."
            : "Grounding or continuity evidence is incomplete or contradicted; see flags.",
      },
      ctx.source,
      ctx.provider,
      ctx.now(),
    );
  },
};

export { ratio as _ratio, basename as _basename };
