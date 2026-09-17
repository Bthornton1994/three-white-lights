import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { spriteGrounding } from "../src/analyzers/sprite-grounding.ts";
import { composeStage, newPng, writePng } from "../src/png.ts";
import type { CaptureBundle, DomSample, WorktreeFacts } from "../src/types.ts";
import { ensureDir } from "../src/util/fs.ts";
import { contextFor, tmpDir } from "./helpers.ts";

function paint(png: ReturnType<typeof newPng>, x: number, y: number, w: number, h: number, rgb: [number, number, number]): void {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) {
      const i = (yy * png.width + xx) * 4;
      png.data[i] = rgb[0];
      png.data[i + 1] = rgb[1];
      png.data[i + 2] = rgb[2];
      png.data[i + 3] = 255;
    }
  }
}

/**
 * Builds a synthetic target: a platform, one 6-frame squat sheet whose frames
 * are simple blocks standing on row 317, and a live canvas produced by the
 * same compositor. Proves the pixel rules pass on an honest stage and fail
 * when the athlete is drawn one row too high.
 */
function synthetic(floating: boolean): { bundle: CaptureBundle; facts: WorktreeFacts; root: string } {
  const root = tmpDir("twl-grounding-");
  const worktree = ensureDir(path.join(root, "worktree"));
  const sprites = ensureDir(path.join(worktree, "arcade", "public", "sprites", "squat"));
  const platform = newPng(640, 360);
  paint(platform, 0, 0, 640, 360, [40, 30, 20]);
  paint(platform, 0, 300, 640, 60, [120, 90, 60]);
  const platformPath = path.join(root, "platform.png");
  writePng(platformPath, platform);
  const anchors = [] as { minX: number; minY: number; maxX: number; maxY: number; boxW: number; boxH: number; contactX: number; contactY: number }[];
  const measured = [] as WorktreeFacts["measured"];
  for (let i = 0; i < 6; i += 1) {
    const frame = newPng(320, 320);
    const h = 120 + i * 10;
    paint(frame, 120, 318 - h, 80, h, [200, 150, 100]);
    writePng(path.join(sprites, `frame-0${i + 1}.png`), frame);
    anchors.push({ minX: 120, minY: 318 - h, maxX: 199, maxY: 317, boxW: 80, boxH: h, contactX: 159.5, contactY: 317 });
    measured!.push({ sheet: "squat", index: i, path: `frame-0${i + 1}.png`, sha256: "x", width: 320, height: 320, minX: 120, minY: 318 - h, maxX: 199, maxY: 317, footCenterX: 159.5, opaque: 80 * h, semiTransparent: 0, colors: 1 });
  }
  const destY = floating ? -9 : 1;
  const lifter = newPng(320, 320);
  paint(lifter, 120, 318 - 140, 80, 140, [200, 150, 100]);
  const canvas = composeStage(platform, lifter, 320, 320, 0, destY);
  const canvasPath = path.join(ensureDir(path.join(root, "evidence")), "beat.canvas.png");
  writePng(canvasPath, canvas);
  const dom: DomSample = {
    screen: "play", liftKind: "squat", visualShell: "sprite-stage", legacySprites: "true", sportSource: "288db32c06232bb0fb65ce7236a0614c698a6920", presentationBase: "1151569c40c77485ab9e9299e5db0db022437a8a", previewBuild: "test", editionBanner: null,
    hasSpriteStage: true, phase: "HOLE", barHeight: 0.02, depth: 0.98, strain: 0.5, grind: 0, animFrame: "frame-03.png", animPose: "hole", contactX: 159.5, contactY: 317, worldY: 317 + destY, destY, commandPress: false, commandLockout: false, prompt: "OUT OF THE HOLE", held: true,
    lightCount: 3, lightColors: ["off", "off", "off"], hasDepthGauge: false, hasIllustratedStill: false, hasTimingLane: false, hudText: "Squat · attempt 1 160.0 kg", heading: null,
    canvasCssWidth: 320, canvasCssHeight: 320, canvasAttrWidth: 320, canvasAttrHeight: 320, canvasImageRendering: "pixelated", canvasBox: { x: 35, y: 30, width: 320, height: 320 }, wrapBox: { x: 0, y: 30, width: 390, height: 320 },
    stageImgCount: 0, scrollWidth: 390, scrollY: 0, innerWidth: 390, innerHeight: 844, displayFontLoaded: true, rootTokens: {}, bodyBackground: "rgb(20, 17, 15)",
  };
  const bundle: CaptureBundle = {
    schemaVersion: 1, capturedAt: "2026-09-17T00:00:00.000Z", targetSha: "fc4c1aec06f0f079b851bb703f69ee67140b4f85", served: null, viewports: [{ name: "phone", width: 390, height: 844 }],
    beats: [{ id: "phone-00-squat-hole", viewport: "phone", lift: "squat", label: "hole", frame: 80, dom, screenshot: null, canvasPng: "evidence/beat.canvas.png" }],
    traces: [{ id: "phone-squat-a1", viewport: "phone", lift: "squat", attempt: 1, inputPlan: [], samples: [0, 1, 2, 2, 3, 4, 5].map((idx, i) => ({ frame: i, dom: { ...dom, phase: i < 3 ? "DESCENT" : "ASCENT", depth: i < 3 ? i * 0.4 : 1 - (i - 2) * 0.2, animFrame: `frame-0${idx + 1}.png` } })), endScreen: "judging", framesRun: 7 }],
    evidenceDir: "evidence", browser: null, notes: [],
  };
  const facts: WorktreeFacts = {
    schemaVersion: 1, targetSha: bundle.targetSha, worktree, fileHashes: {}, authorityHashes: {}, spriteDiffVsReference: [], measured, platformPng: { path: platformPath, sha256: "p", width: 640, height: 360 },
    probe: { tickMs: 1000 / 60, frameDtMs: 16, legalDepthSquat: 0.8, stage: { width: 320, height: 320, contactX: 160, contactY: 318 }, anchors: { squat: anchors }, edition: null, traces: [], errors: [] },
    oracle: null, docs: null, committedEvidence: null, reference: null, build: null, tests: null,
  };
  return { bundle, facts, root };
}

describe("sprite grounding pixel proofs", () => {
  it("passes when the live canvas equals the anchored composition on the contact line", async () => {
    const { bundle, facts, root } = synthetic(false);
    const d = await spriteGrounding.run(contextFor(bundle, facts, root));
    assert.equal(d.verdict, "PASS", JSON.stringify(d.flags));
    assert.equal(d.metrics.canvasProofsFailed, 0);
    assert.equal(d.metrics.canvasLifterProofsFailed, 0);
  });

  it("fails a floating athlete both by contact line and by pixels", async () => {
    const { bundle, facts, root } = synthetic(true);
    const d = await spriteGrounding.run(contextFor(bundle, facts, root));
    assert.equal(d.verdict, "FAIL");
    assert.ok(d.flags.includes("ATHLETE_NOT_GROUNDED"), JSON.stringify(d.flags));
  });
});
