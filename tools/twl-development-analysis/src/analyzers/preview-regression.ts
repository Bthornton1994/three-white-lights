import { existsSync } from "node:fs";
import { Findings, makeDecision } from "../decision.ts";
import { alignedRegionDiff, diffPng, readPng } from "../png.ts";
import type { Analyzer, AnalyzerContext, Beat, Decision } from "../types.ts";

interface Mapping {
  name: string;
  viewport: "phone" | "desktop";
  lift: string | null;
  label: string;
  kind: "chrome" | "play";
  attempt?: number;
}

/** Committed evidence names at the target, mapped to fresh beats of this run. */
const MAPPINGS: Mapping[] = [
  { name: "title-390", viewport: "phone", lift: null, label: "title", kind: "chrome" },
  { name: "title-1280", viewport: "desktop", lift: null, label: "title", kind: "chrome" },
  { name: "select-390", viewport: "phone", lift: null, label: "lift", kind: "chrome" },
  { name: "squat-brace-390", viewport: "phone", lift: "squat", label: "brace", kind: "play", attempt: 1 },
  { name: "squat-brace-1280", viewport: "desktop", lift: "squat", label: "brace", kind: "play", attempt: 1 },
  { name: "squat-hole-390", viewport: "phone", lift: "squat", label: "hole", kind: "play", attempt: 1 },
  { name: "bench-brace-390", viewport: "phone", lift: "bench", label: "brace", kind: "play", attempt: 1 },
  { name: "bench-press-390", viewport: "phone", lift: "bench", label: "press", kind: "play", attempt: 1 },
  { name: "deadlift-brace-390", viewport: "phone", lift: "deadlift", label: "brace", kind: "play", attempt: 1 },
  { name: "deadlift-lock-390", viewport: "phone", lift: "deadlift", label: "lock", kind: "play", attempt: 1 },
];

const STRUCTURAL_KEYS = ["screen", "shell", "source", "lift", "frame", "worldY", "canvas", "depthRail", "fableAthlete"] as const;

function freshValue(beat: Beat, key: string): unknown {
  const d = beat.dom;
  switch (key) {
    case "screen":
      return d.screen;
    case "shell":
      return d.visualShell;
    case "source":
      return d.sportSource;
    case "lift":
      return d.liftKind ?? "";
    case "frame":
      return d.animFrame;
    case "worldY":
      return d.worldY === null ? null : String(d.worldY);
    case "canvas":
      return d.hasSpriteStage && d.canvasAttrWidth !== null;
    case "depthRail":
      return d.hasDepthGauge;
    case "fableAthlete":
      return d.hasIllustratedStill;
    default:
      return undefined;
  }
}

function findBeat(beats: Beat[], m: Mapping): Beat | null {
  const matches = beats.filter((b) => b.viewport === m.viewport && b.label === m.label && (m.lift === null || b.lift === m.lift));
  if (matches.length === 0) return null;
  if (m.attempt === undefined) return matches[0] ?? null;
  return matches[m.attempt - 1] ?? matches[0] ?? null;
}

/**
 * Fresh-preview regression. A fresh build is captured every run and compared
 * to (a) the evidence the candidate committed for itself and (b) the
 * presentation reference captured from PR #69 in its own worktree. Structural
 * drift fails; pixel drift is reviewed, because fonts and clocks legitimately
 * move pixels.
 */
export const previewRegression: Analyzer = {
  id: "preview-regression",
  title: "Fresh preview vs committed evidence and presentation reference",
  run: async (ctx: AnalyzerContext): Promise<Decision> => {
    const f = new Findings();
    const { bundle, facts, intent } = ctx;
    const committed = facts.committedEvidence;
    if (!committed || committed.entries.length === 0) f.fail("BASELINE_EVIDENCE_MISSING");
    else {
      f.ref({ kind: "file", ref: committed.dir, note: `${committed.entries.length} committed evidence entries` });
      let compared = 0;
      let structuralDrift = 0;
      let pixelDrift = 0;
      let missingFresh = 0;
      for (const m of MAPPINGS) {
        const entry = committed.entries.find((e) => e.name === m.name);
        if (!entry || !entry.json) {
          f.metric(`committed.${m.name}`, "absent");
          continue;
        }
        const fresh = findBeat(bundle.beats, m);
        if (!fresh) {
          missingFresh += 1;
          f.fail(`FRESH_BEAT_MISSING:${m.name}`);
          continue;
        }
        compared += 1;
        const drift: string[] = [];
        for (const key of STRUCTURAL_KEYS) {
          if (!(key in entry.json)) continue;
          const want = entry.json[key];
          const got = freshValue(fresh, key);
          const same = typeof want === "boolean" ? want === Boolean(got) : String(want ?? "") === String(got ?? "");
          if (!same) drift.push(`${key}:${String(want)}->${String(got)}`);
        }
        if (drift.length > 0) {
          structuralDrift += 1;
          f.metric(`drift.${m.name}`, drift.join(";"));
          f.fail(`EVIDENCE_STRUCTURE_DRIFT:${m.name}`);
        } else f.pass();
        if (entry.png && fresh.screenshot) {
          const a = ctx.resolvePath(entry.png);
          const b = ctx.resolvePath(fresh.screenshot);
          if (existsSync(a) && existsSync(b)) {
            const committedPng = readPng(a);
            const freshPng = readPng(b);
            const d = diffPng(freshPng, committedPng);
            f.metric(`pixel.${m.name}.meanAbsDiff`, d.meanAbsDiff);
            f.metric(`pixel.${m.name}.sizeMatch`, d.sizeMatch);
            let score = d.meanAbsDiff;
            let note = `full-page meanAbsDiff ${d.meanAbsDiff}`;
            if (m.kind === "play" && fresh.dom.wrapBox) {
              // Committed evidence was captured at an unknown scroll offset; compare the
              // stage region at its best vertical alignment instead of the whole page.
              const ad = alignedRegionDiff(freshPng, committedPng, fresh.dom.wrapBox);
              f.metric(`pixel.${m.name}.stageAlignedMeanAbsDiff`, ad.meanAbsDiff);
              f.metric(`pixel.${m.name}.stageAlignedOffsetY`, ad.offsetY);
              score = ad.meanAbsDiff;
              note += `; stage region aligned at dy=${ad.offsetY} meanAbsDiff ${ad.meanAbsDiff}`;
            }
            const limit = m.kind === "chrome" ? intent.regression.chromeBeatsMeanDiffMax : intent.regression.playBeatsMeanDiffMax;
            const ok = d.sizeMatch && score <= limit;
            if (!ok) pixelDrift += 1;
            f.check(ok, `EVIDENCE_PIXEL_DRIFT:${m.name}`, "REVIEW");
            f.ref({ kind: "screenshot", ref: fresh.screenshot, note: `vs committed ${entry.png}: ${note}` });
          } else f.review(`EVIDENCE_PNG_UNREADABLE:${m.name}`);
        }
      }
      f.metric("committedPairsCompared", compared);
      f.metric("committedStructuralDrift", structuralDrift);
      f.metric("committedPixelDrift", pixelDrift);
      f.metric("committedFreshMissing", missingFresh);
      f.check(compared > 0, "NO_COMMITTED_PAIRS");
    }

    const ref = facts.reference;
    if (!ref || !ref.captured) f.abstain("REFERENCE_NOT_CAPTURED");
    else {
      f.metric("referenceSha", ref.sha);
      f.ref({ kind: "git", ref: ref.sha, note: "presentation reference worktree capture" });
      const targetTitle = bundle.beats.find((b) => b.label === "title" && b.viewport === "phone");
      const tokenDrift: string[] = [];
      for (const [token, expected] of Object.entries(intent.ironAmber.tokens)) {
        const refVal = (ref.rootTokens[token] ?? "").trim().toLowerCase();
        const tgtVal = (targetTitle?.dom.rootTokens[token] ?? "").trim().toLowerCase();
        if (refVal !== tgtVal) tokenDrift.push(`${token}:${refVal}->${tgtVal}`);
        if (refVal !== expected.toLowerCase()) f.metric(`reference.token.${token}`, refVal);
      }
      f.metric("tokenDriftVsReference", tokenDrift.join(";") || "none");
      f.check(tokenDrift.length === 0, "TOKEN_DRIFT_VS_REFERENCE");
      let spriteDrift = 0;
      let spriteCompared = 0;
      for (const [p, hash] of Object.entries(ref.spriteHashes)) {
        const served = bundle.served?.spriteHashes[p] ?? facts.fileHashes[`arcade/public${p}`] ?? null;
        if (served === null) continue;
        spriteCompared += 1;
        if (served !== hash) spriteDrift += 1;
      }
      f.metric("spritesComparedVsReference", spriteCompared);
      f.metric("spritesDifferingVsReference", spriteDrift);
      f.check(spriteCompared > 0, "REFERENCE_SPRITES_UNCOMPARED", "REVIEW");
      f.check(spriteDrift === 0, "SPRITE_DRIFT_VS_REFERENCE");
      for (const vp of ["phone", "desktop"] as const) {
        const rb = ref.beats.find((b) => b.label === "title" && b.viewport === vp);
        const tb = bundle.beats.find((b) => b.label === "title" && b.viewport === vp);
        if (!rb?.screenshot || !tb?.screenshot) {
          f.review(`REFERENCE_TITLE_MISSING:${vp}`);
          continue;
        }
        const a = ctx.resolvePath(rb.screenshot);
        const b = ctx.resolvePath(tb.screenshot);
        if (!existsSync(a) || !existsSync(b)) {
          f.review(`REFERENCE_TITLE_UNREADABLE:${vp}`);
          continue;
        }
        const d = diffPng(readPng(a), readPng(b));
        f.metric(`referenceTitle.${vp}.meanAbsDiff`, d.meanAbsDiff);
        f.check(d.sizeMatch && d.meanAbsDiff <= intent.regression.referenceTitleMeanDiffMax, `TITLE_DRIFT_VS_REFERENCE:${vp}`, "REVIEW");
        f.ref({ kind: "screenshot", ref: rb.screenshot, note: `reference ${vp} title` });
      }
    }

    const verdict = f.verdict();
    return makeDecision(
      {
        id: previewRegression.id,
        title: previewRegression.title,
        verdict,
        confidence: committed && ref?.captured ? 0.75 : committed ? 0.6 : 0.2,
        flags: f.flags,
        metrics: f.metrics,
        evidence: f.evidence,
        humanApprovalRequired: true,
        summary:
          verdict === "PASS"
            ? "A fresh build reproduces the candidate's committed evidence structurally and stays within pixel tolerance of it and of the presentation reference."
            : "The fresh preview drifted from committed evidence or the reference, or a comparison could not run; see flags.",
      },
      ctx.source,
      ctx.provider,
      ctx.now(),
    );
  },
};
