/**
 * Builds committed fixtures from a real run directory:
 *
 *   node test/build-fixtures.ts <run-dir>
 *
 * - fixtures/bundles/good-sprite-stage/{bundle,facts}.json: the run's bundle and
 *   facts with traces trimmed to every 4th sample, screenshots dropped, and
 *   absolute paths removed. The good fixture is what the analyzers judged.
 * - fixtures/bundles/negative-<direction>/ : the same data mutated into each
 *   known bad direction. Each negative carries a `mutation` note in fixture.json.
 *
 * Negatives are derived, not hand-drawn, so they stay structurally honest to
 * what the driver really records.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { PACKAGE_ROOT } from "../src/config.ts";
import type { CaptureBundle, WorktreeFacts } from "../src/types.ts";
import { ensureDir, readJson, writeJson } from "../src/util/fs.ts";

const runDir = process.argv[2];
if (!runDir) {
  console.error("usage: build-fixtures <run-dir>");
  process.exit(2);
}

const bundle = readJson<CaptureBundle>(path.join(runDir, "bundle.json"));
const facts = readJson<WorktreeFacts>(path.join(runDir, "facts.json"));

const KEEP_EVERY = 4;

function slimSample(dom: CaptureBundle["beats"][number]["dom"]): CaptureBundle["beats"][number]["dom"] {
  // Trace samples keep only what the analyzers read from traces; beats stay complete.
  return {
    ...dom,
    rootTokens: {},
    lightColors: [],
    hudText: null,
    editionBanner: null,
    canvasBox: null,
    wrapBox: null,
    bodyBackground: null,
  };
}

function trim(b: CaptureBundle, maxFrames = Number.POSITIVE_INFINITY, traceIds: string[] | null = null): CaptureBundle {
  return {
    ...b,
    beats: b.beats.map((beat) => ({ ...beat, screenshot: null, canvasPng: null })),
    traces: b.traces
      .filter((t) => traceIds === null || traceIds.includes(t.id))
      .map((t) => ({
        ...t,
        samples: t.samples
          .filter((s, i) => (i % KEEP_EVERY === 0 || i === t.samples.length - 1) && s.frame < maxFrames)
          .map((s) => ({ frame: s.frame, dom: slimSample(s.dom) })),
      })),
    notes: b.notes.filter((n) => !/performance\.now|clickAt/.test(n)),
  };
}

function trimFacts(f: WorktreeFacts, maxFrames = Number.POSITIVE_INFINITY): WorktreeFacts {
  return {
    ...f,
    worktree: f.worktree ? "<worktree-removed-after-capture>" : null,
    measured: f.measured ? f.measured.map((m) => ({ ...m, path: path.basename(m.path) })) : null,
    platformPng: null,
    probe: f.probe
      ? {
          ...f.probe,
          traces: f.probe.traces.map((t) => ({
            ...t,
            frames: t.frames.filter((r) => (r.frame % KEEP_EVERY === 0 || r.frame === -1 || r === t.frames[t.frames.length - 1]) && r.frame < maxFrames),
          })),
        }
      : null,
    oracle: null,
    committedEvidence: f.committedEvidence ? { ...f.committedEvidence, entries: f.committedEvidence.entries.map((e) => ({ ...e, png: null })) } : null,
    reference: f.reference ? { ...f.reference, beats: f.reference.beats.map((b) => ({ ...b, screenshot: null, canvasPng: null })) } : null,
    tests: f.tests ? { ...f.tests, records: f.tests.records.map((r) => ({ ...r, cwd: "<worktree>/arcade", stdoutTail: "", stderrTail: "" })) } : null,
  };
}

const good = { bundle: trim(bundle), facts: trimFacts(facts) };
const NEGATIVE_MAX_FRAMES = 100;
const NEGATIVE_TRACES = ["phone-squat-a1", "phone-squat-a2", "phone-bench-a1", "phone-deadlift-a1"];

type Mutation = { name: string; mutation: string; mutatesFacts?: boolean; apply: (b: CaptureBundle, f: WorktreeFacts) => void };

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const negatives: Mutation[] = [
  {
    name: "negative-two-tap-timing-demo",
    mutation: "Play screens expose a timing lane and 'Tap in the amber window' copy; no mechanics phase in the DOM.",
    apply: (b) => {
      for (const beat of b.beats) {
        if (beat.dom.screen === "play") {
          beat.dom.hasTimingLane = true;
          beat.dom.prompt = "Tap in the amber window. Fatigue is not a bar — it shrinks that window.";
          beat.dom.phase = null;
          beat.dom.depth = null;
          beat.dom.barHeight = null;
        }
      }
      for (const t of b.traces) {
        for (const s of t.samples) {
          s.dom.hasTimingLane = true;
          s.dom.phase = null;
          s.dom.depth = null;
          s.dom.barHeight = null;
        }
      }
    },
  },
  {
    name: "negative-still-image-shell",
    mutation: "Athlete is an illustrated <img> still; the same frame is shown for the whole lift.",
    apply: (b) => {
      for (const beat of b.beats) {
        if (beat.dom.hasSpriteStage) {
          beat.dom.hasIllustratedStill = true;
          beat.dom.stageImgCount = 1;
          beat.dom.animFrame = "frame-01.png";
        }
      }
      for (const t of b.traces) for (const s of t.samples) s.dom.animFrame = "frame-01.png";
    },
  },
  {
    name: "negative-depth-gauge",
    mutation: "A vertical DEPTH gauge is rendered beside the lifter on squat screens.",
    apply: (b) => {
      for (const beat of b.beats) if (beat.lift === "squat" && beat.dom.hasSpriteStage) beat.dom.hasDepthGauge = true;
      for (const t of b.traces) if (t.lift === "squat") for (const s of t.samples) s.dom.hasDepthGauge = true;
    },
  },
  {
    name: "negative-raw-centered-tile",
    mutatesFacts: true,
    mutation: "Canvas present but no per-frame anchors: world-y, contact-y and dest-y are absent; anchors module missing.",
    apply: (b, f) => {
      for (const beat of b.beats) {
        beat.dom.worldY = null;
        beat.dom.contactY = null;
        beat.dom.destY = null;
      }
      for (const t of b.traces) for (const s of t.samples) s.dom.worldY = null;
      if (f.probe) {
        f.probe.anchors = null;
        f.probe.stage = null;
      }
    },
  },
  {
    name: "negative-floating-athlete",
    mutation: "The athlete's contact line reports 290 instead of the platform line 318, and the ground line moves between frames.",
    apply: (b) => {
      for (const beat of b.beats) if (beat.dom.worldY !== null) beat.dom.worldY = 290;
      for (const t of b.traces) t.samples.forEach((s, i) => { if (s.dom.worldY !== null) s.dom.worldY = i % 2 === 0 ? 290 : 296; });
    },
  },
  {
    name: "negative-giant-gutters",
    mutation: "Phone canvas rendered at 160 CSS px inside a 390 px viewport; desktop canvas 320 px tall in an 800 px viewport.",
    apply: (b) => {
      for (const beat of b.beats) {
        if (!beat.dom.hasSpriteStage || beat.dom.canvasCssWidth === null) continue;
        if (beat.viewport === "phone") {
          beat.dom.canvasCssWidth = 160;
          beat.dom.canvasCssHeight = 160;
          beat.dom.canvasAttrWidth = 320;
          beat.dom.canvasAttrHeight = 320;
        } else {
          beat.dom.canvasCssWidth = 320;
          beat.dom.canvasCssHeight = 320;
        }
      }
    },
  },
  {
    name: "negative-smoothed-non-integer-scale",
    mutation: "Canvas scaled to 1.5x with image-rendering auto (bilinear smoothing).",
    apply: (b) => {
      for (const beat of b.beats) {
        if (!beat.dom.hasSpriteStage || beat.dom.canvasCssWidth === null) continue;
        beat.dom.canvasCssWidth = 480;
        beat.dom.canvasCssHeight = 480;
        beat.dom.canvasImageRendering = "auto";
      }
    },
  },
  {
    name: "negative-stale-preview",
    mutation: "Served bundle hash differs from the fresh build and every screen declares a different mechanics SHA.",
    apply: (b) => {
      if (b.served) b.served.scriptSha256 = "0".repeat(64);
      for (const beat of b.beats) beat.dom.sportSource = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    },
  },
  {
    name: "negative-mechanics-hash-drift",
    mutatesFacts: true,
    mutation: "lift.ts at the target no longer matches the authority pin; sprite sheets changed vs reference; edition pins point elsewhere.",
    apply: (_b, f) => {
      f.fileHashes["arcade/src/game/lift.ts"] = "1".repeat(64);
      f.spriteDiffVsReference = ["arcade/public/sprites/squat/frame-03.png"];
      if (f.probe?.edition) f.probe.edition = { ...f.probe.edition, MECHANICS_SHA: "0".repeat(40) };
    },
  },
  {
    name: "negative-missing-evidence",
    mutatesFacts: true,
    mutation: "No committed evidence, no anchors, no screenshots, no served facts: everything the rules must fail closed on.",
    apply: (b, f) => {
      f.committedEvidence = null;
      f.measured = null;
      if (f.probe) f.probe.anchors = null;
      b.served = null;
      for (const beat of b.beats) {
        beat.screenshot = null;
        beat.canvasPng = null;
      }
    },
  },
];

const outRoot = ensureDir(path.join(PACKAGE_ROOT, "fixtures", "bundles"));
const compact = (file: string, value: unknown): void => {
  ensureDir(path.dirname(file));
  writeFileSync(file, `${JSON.stringify(value)}\n`);
};
compact(path.join(outRoot, "good-sprite-stage", "bundle.json"), good.bundle);
compact(path.join(outRoot, "good-sprite-stage", "facts.json"), good.facts);
writeJson(path.join(outRoot, "good-sprite-stage", "fixture.json"), {
  source: path.basename(runDir),
  targetSha: bundle.targetSha,
  note: `Trimmed real capture of the candidate: every ${KEEP_EVERY}th trace sample and probe frame, trace samples slimmed to the fields analyzers read, screenshots and canvases not committed. Pixel proofs are exercised by synthetic PNGs in tests and by live runs.`,
});
for (const n of negatives) {
  const b = clone(trim(bundle, NEGATIVE_MAX_FRAMES, NEGATIVE_TRACES));
  const f = clone(trimFacts(facts, NEGATIVE_MAX_FRAMES));
  n.apply(b, f);
  compact(path.join(outRoot, n.name, "bundle.json"), b);
  const meta: Record<string, unknown> = { derivedFrom: "good-sprite-stage", mutation: n.mutation, tracesKept: NEGATIVE_TRACES, maxFrames: NEGATIVE_MAX_FRAMES };
  if (n.mutatesFacts) compact(path.join(outRoot, n.name, "facts.json"), f);
  else meta.facts = "../good-sprite-stage/facts.json";
  writeJson(path.join(outRoot, n.name, "fixture.json"), meta);
}
console.log(`fixtures written to ${outRoot}: good + ${negatives.length} negatives`);
