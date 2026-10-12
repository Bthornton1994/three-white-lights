/**
 * Orchestrates one analysis run:
 *   worktree(target) -> static facts -> build -> tests -> mechanics probe ->
 *   serve dist -> browser capture -> frame oracle -> reference capture ->
 *   analyzers -> decisions.json + report.md
 *
 * Everything the analyzers consume is persisted (bundle.json, facts.json) so
 * the same decisions can be recomputed offline and so fixtures can be built
 * from real runs.
 */
import { copyFileSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ANALYZERS } from "./analyzers/index.ts";
import { captureBundle, playwrightVersion } from "./browser/driver.ts";
import { serveStatic } from "./browser/server.ts";
import { loadBaseline, loadIntent, PACKAGE_ROOT, providerInfo } from "./config.ts";
import { validateDecision, worstVerdict } from "./decision.ts";
import { addWorktree, diffNames, fileHashAt, repoRoot, showFile, type WorktreeHandle } from "./git.ts";
import { measureFrame, readPng } from "./png.ts";
import { runProbe } from "./probe/client.ts";
import { renderMarkdown } from "./report/markdown.ts";
import type {
  AnalyzerContext,
  BaselineConfig,
  Beat,
  CaptureBundle,
  CommandRecord,
  CommittedEvidence,
  Decision,
  DocClauseFacts,
  DocFacts,
  IntentConfig,
  LiftId,
  MeasuredFrame,
  OracleSample,
  ProviderInfo,
  ReferenceFacts,
  RunReport,
  SourceIdentity,
  WorktreeFacts,
} from "./types.ts";
import { run, toRecord } from "./util/exec.ts";
import { ensureDir, readJson, writeJson } from "./util/fs.ts";
import { sha256File, sha256Hex, short } from "./util/hash.ts";

export interface RunOptions {
  targetSha?: string;
  referenceSha?: string;
  outDir?: string;
  workDir?: string;
  keepWorktree?: boolean;
  skipReference?: boolean;
  skipTests?: boolean;
  chromiumPath?: string | null;
  ignoreHttpsErrors?: boolean;
  log?: (line: string) => void;
}

const SPRITE_SHEETS = ["squat", "squat-max", "bench", "bench-max", "deadlift", "deadlift-max", "idle", "success", "miss"];

function nowIso(): string {
  return new Date().toISOString();
}

function runId(sha: string): string {
  return `${short(sha, 8)}-${nowIso().replace(/[:.]/g, "-")}`;
}

function docFacts(root: string, baseline: BaselineConfig): DocFacts {
  const read = (label: string, sha: string, file: string, clauses: string[]): DocClauseFacts => {
    const buf = showFile(root, sha, file);
    if (!buf) return { label, sha, path: file, present: false, sha256: null, clausesFound: [], clausesMissing: clauses };
    const text = buf.toString("utf8");
    const found = clauses.filter((c) => text.includes(c));
    return {
      label,
      sha,
      path: file,
      present: true,
      sha256: sha256Hex(buf),
      clausesFound: found,
      clausesMissing: clauses.filter((c) => !found.includes(c)),
    };
  };
  const ia = baseline.documents.ironAmberReference;
  const gdd = baseline.documents.gdd;
  return {
    ironAmber: ia.readFrom.map((r) => read(r.label, r.sha, ia.path, ia.conflictingClauses)),
    gdd: gdd.readFrom.map((r) => read(r.label, r.sha, gdd.path, gdd.clauses)),
  };
}

function measureSprites(arcadeDir: string): MeasuredFrame[] {
  const out: MeasuredFrame[] = [];
  const root = path.join(arcadeDir, "public", "sprites");
  for (const sheet of SPRITE_SHEETS) {
    const dir = path.join(root, sheet);
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir)
      .filter((f) => /^frame-\d+\.png$/.test(f))
      .sort();
    files.forEach((file) => {
      const index = Number(/(\d+)/.exec(file)?.[1] ?? "1") - 1;
      out.push(measureFrame(sheet, index, path.join(dir, file)));
    });
  }
  return out;
}

function collectCommittedEvidence(worktree: string, relDir: string, outDir: string): CommittedEvidence | null {
  const dir = path.join(worktree, relDir);
  if (!existsSync(dir)) return null;
  const copyDir = ensureDir(path.join(outDir, "committed-evidence"));
  const entries: CommittedEvidence["entries"] = [];
  const names = new Set<string>();
  for (const file of readdirSync(dir)) {
    const m = /^(.*)\.(json|png)$/.exec(file);
    if (m && m[1] !== "report") names.add(m[1]!);
  }
  for (const name of Array.from(names).sort()) {
    const jsonFile = path.join(dir, `${name}.json`);
    const pngFile = path.join(dir, `${name}.png`);
    let json: Record<string, unknown> | null = null;
    if (existsSync(jsonFile)) json = readJson<Record<string, unknown>>(jsonFile);
    let png: string | null = null;
    let pngSha: string | null = null;
    if (existsSync(pngFile)) {
      const dest = path.join(copyDir, `${name}.png`);
      copyFileSync(pngFile, dest);
      png = path.relative(outDir, dest);
      pngSha = sha256File(dest);
    }
    entries.push({ name, json, png, pngSha256: pngSha });
  }
  const readme = existsSync(path.join(dir, "README.md")) ? readFileSync(path.join(dir, "README.md"), "utf8") : null;
  return { dir: relDir, entries, readme };
}

function distAssets(arcadeDir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const dist = path.join(arcadeDir, "dist");
  if (!existsSync(dist)) return out;
  const walk = (dir: string): void => {
    for (const f of readdirSync(dir)) {
      const p = path.join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else out[path.relative(dist, p)] = sha256File(p);
    }
  };
  walk(dist);
  return out;
}

function installAndBuild(arcadeDir: string, commands: CommandRecord[], log: (l: string) => void): { npmCiExit: number | null; buildExit: number | null } {
  const env = { PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1", CI: "1" };
  let npmCiExit: number | null = 0;
  if (!existsSync(path.join(arcadeDir, "node_modules"))) {
    log("npm ci");
    const ci = run("npm", ["ci", "--no-audit", "--no-fund", "--loglevel=error"], { cwd: arcadeDir, env, timeoutMs: 600_000 });
    commands.push(toRecord(ci));
    npmCiExit = ci.exitCode;
  }
  log("npm run build");
  const build = run("npm", ["run", "build"], { cwd: arcadeDir, env, timeoutMs: 600_000 });
  commands.push(toRecord(build));
  return { npmCiExit, buildExit: build.exitCode };
}

function spritePathsFor(arcadeDir: string): string[] {
  const out: string[] = ["/sprites/platform.png", "/sprites/title.png", "/sprites/title-wide.png", "/sprites/identity.png"];
  for (const sheet of SPRITE_SHEETS) {
    const dir = path.join(arcadeDir, "public", "sprites", sheet);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) if (/^frame-\d+\.png$/.test(f)) out.push(`/sprites/${sheet}/${f}`);
  }
  return out;
}

async function captureReference(
  root: string,
  baseline: BaselineConfig,
  intent: IntentConfig,
  outDir: string,
  workDir: string,
  commands: CommandRecord[],
  keep: boolean,
  chromiumPath: string | null | undefined,
  ignoreHttpsErrors: boolean,
  log: (l: string) => void,
): Promise<ReferenceFacts> {
  const sha = baseline.presentationReference.sha;
  const facts: ReferenceFacts = { sha, bundlePath: null, captured: false, beats: [], rootTokens: {}, spriteHashes: {}, notes: [] };
  let handle: WorktreeHandle | null = null;
  try {
    handle = addWorktree(root, sha, path.join(workDir, short(sha, 12)));
    const arcadeDir = path.join(handle.dir, baseline.presentationReference.app ?? "arcade");
    const build = installAndBuild(arcadeDir, commands, log);
    if (build.buildExit !== 0) {
      facts.notes.push("reference build failed");
      return facts;
    }
    const server = await serveStatic(path.join(arcadeDir, "dist"));
    try {
      const refOut = ensureDir(path.join(outDir, "reference"));
      const bundle = await captureBundle(
        {
          url: server.url,
          outDir: refOut,
          targetSha: sha,
          intent,
          probeTraces: [],
          tickMs: 1000 / 60,
          liftsByViewport: { phone: [], desktop: [] },
          chromiumPath,
          spritePaths: spritePathsFor(arcadeDir),
          log,
          mode: "reference",
          ignoreHttpsErrors,
        },
        baseline.mechanicsAuthority.sha,
        baseline.presentationReference.sha,
      );
      const rebased: Beat[] = bundle.beats.map((b) => ({
        ...b,
        screenshot: b.screenshot ? path.join("reference", b.screenshot) : null,
        canvasPng: b.canvasPng ? path.join("reference", b.canvasPng) : null,
      }));
      writeJson(path.join(refOut, "bundle.json"), { ...bundle, beats: rebased });
      facts.bundlePath = path.join("reference", "bundle.json");
      facts.captured = rebased.length > 0;
      facts.beats = rebased;
      facts.rootTokens = rebased.find((b) => b.label === "title")?.dom.rootTokens ?? {};
      facts.spriteHashes = bundle.served?.spriteHashes ?? {};
      facts.notes.push(...bundle.notes);
    } finally {
      await server.close();
    }
  } catch (err) {
    facts.notes.push(`reference capture failed: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    if (handle && !keep) handle.remove();
  }
  return facts;
}

export async function runAnalysis(opts: RunOptions = {}): Promise<RunReport> {
  const log = opts.log ?? ((l: string) => console.error(l));
  const baseline = loadBaseline();
  const intent = loadIntent();
  if (opts.targetSha) baseline.target.sha = opts.targetSha;
  if (opts.referenceSha) baseline.presentationReference.sha = opts.referenceSha;
  const root = repoRoot(PACKAGE_ROOT);
  const id = runId(baseline.target.sha);
  const outDir = ensureDir(opts.outDir ?? path.join(PACKAGE_ROOT, "out", id));
  const workDir = ensureDir(opts.workDir ?? path.join(os.tmpdir(), "twl-development-analysis"));
  const commands: CommandRecord[] = [];
  const startedAt = nowIso();
  log(`run ${id}: target ${baseline.target.sha}`);

  const facts: WorktreeFacts = {
    schemaVersion: 1,
    targetSha: baseline.target.sha,
    worktree: null,
    fileHashes: {},
    authorityHashes: {},
    spriteDiffVsReference: null,
    measured: null,
    platformPng: null,
    probe: null,
    oracle: null,
    docs: null,
    committedEvidence: null,
    reference: null,
    build: null,
    tests: null,
  };
  for (const file of Object.keys(baseline.mechanicsAuthority.files)) {
    facts.authorityHashes[file] = fileHashAt(root, baseline.mechanicsAuthority.sha, file);
  }
  facts.docs = docFacts(root, baseline);
  facts.spriteDiffVsReference = diffNames(root, baseline.presentationReference.sha, baseline.target.sha, baseline.presentationReference.spriteRoot ?? "arcade/public/sprites");

  let bundle: CaptureBundle = {
    schemaVersion: 1,
    capturedAt: nowIso(),
    targetSha: baseline.target.sha,
    served: null,
    viewports: intent.viewports,
    beats: [],
    traces: [],
    evidenceDir: "evidence",
    browser: null,
    notes: [],
  };
  let browserVersion: string | null = null;
  let handle: WorktreeHandle | null = null;
  try {
    handle = addWorktree(root, baseline.target.sha, path.join(workDir, short(baseline.target.sha, 12)));
    facts.worktree = handle.dir;
    const arcadeDir = path.join(handle.dir, baseline.target.app ?? "arcade");
    for (const rel of Object.keys(baseline.protectedFilesAtTarget)) {
      const p = path.join(handle.dir, rel);
      facts.fileHashes[rel] = existsSync(p) ? sha256File(p) : null;
    }
    for (const p of spritePathsFor(arcadeDir)) {
      const abs = path.join(arcadeDir, "public", p);
      facts.fileHashes[`arcade/public${p}`] = existsSync(abs) ? sha256File(abs) : null;
    }
    facts.measured = measureSprites(arcadeDir);
    const platform = path.join(arcadeDir, "public", "sprites", "platform.png");
    if (existsSync(platform)) {
      const copy = path.join(ensureDir(path.join(outDir, "committed-evidence")), "platform.png");
      copyFileSync(platform, copy);
      const png = readPng(copy);
      facts.platformPng = { path: path.relative(outDir, copy), sha256: sha256File(copy), width: png.width, height: png.height };
    }
    facts.committedEvidence = collectCommittedEvidence(handle.dir, baseline.committedEvidenceDir, outDir);

    const build = installAndBuild(arcadeDir, commands, log);
    facts.build = { ...build, distAssets: distAssets(arcadeDir) };

    if (!opts.skipTests) {
      log("npm test (target)");
      const t = run("npm", ["test"], { cwd: arcadeDir, env: { CI: "1" }, timeoutMs: 900_000 });
      commands.push(toRecord(t));
      facts.tests = { ran: true, records: [toRecord(t)] };
    } else facts.tests = { ran: false, records: [] };

    log("mechanics probe");
    const probe = runProbe(arcadeDir, path.join(outDir, "probe.json"));
    commands.push(toRecord(probe.record));
    facts.probe = probe.facts;

    if (build.buildExit === 0) {
      const server = await serveStatic(path.join(arcadeDir, "dist"));
      try {
        log(`serving ${server.url}`);
        bundle = await captureBundle(
          {
            url: server.url,
            outDir,
            targetSha: baseline.target.sha,
            intent,
            probeTraces: probe.facts?.traces ?? [],
            tickMs: probe.facts?.tickMs ?? 1000 / 60,
            liftsByViewport: { phone: ["squat", "bench", "deadlift"] as LiftId[], desktop: ["squat"] as LiftId[] },
            chromiumPath: opts.chromiumPath,
            spritePaths: spritePathsFor(arcadeDir),
            log,
            mode: "full",
            ignoreHttpsErrors: Boolean(opts.ignoreHttpsErrors),
          },
          baseline.mechanicsAuthority.sha,
          baseline.presentationReference.sha,
        );
        browserVersion = bundle.browser?.version ?? null;
      } finally {
        await server.close();
      }
      const samples: OracleSample[] = [];
      for (const trace of bundle.traces) {
        for (const s of trace.samples) {
          const d = s.dom;
          if (d.screen !== "play" || d.phase === null || d.depth === null || d.barHeight === null) continue;
          samples.push({ kind: trace.lift, phase: d.phase, depth: d.depth, barHeight: d.barHeight });
        }
      }
      if (samples.length > 0) {
        log(`frame oracle (${samples.length} samples)`);
        const oracle = runProbe(arcadeDir, path.join(outDir, "oracle.json"), samples);
        commands.push(toRecord(oracle.record));
        facts.oracle = oracle.oracle ? { samples, expected: oracle.oracle } : null;
      }
    } else bundle.notes.push("target build failed; browser capture skipped");

    if (!opts.skipReference) {
      log(`reference capture ${baseline.presentationReference.sha}`);
      facts.reference = await captureReference(root, baseline, intent, outDir, workDir, commands, Boolean(opts.keepWorktree), opts.chromiumPath, Boolean(opts.ignoreHttpsErrors), log);
    }
  } finally {
    if (handle && !opts.keepWorktree) {
      handle.remove();
      facts.worktree = null;
    }
  }

  writeJson(path.join(outDir, "bundle.json"), bundle);
  writeJson(path.join(outDir, "facts.json"), facts);
  const provider = providerInfo({ playwright: playwrightVersion(), browser: browserVersion });
  const report = await analyzeArtifacts(bundle, facts, baseline, intent, provider, outDir, id, commands, startedAt);
  return report;
}

export async function analyzeArtifacts(
  bundle: CaptureBundle,
  facts: WorktreeFacts,
  baseline: BaselineConfig,
  intent: IntentConfig,
  provider: ProviderInfo,
  outDir: string,
  id: string,
  commands: CommandRecord[],
  generatedAt = nowIso(),
): Promise<RunReport> {
  const servedSha = bundle.beats[0]?.dom.sportSource ?? null;
  const source: SourceIdentity = {
    targetSha: baseline.target.sha,
    presentationBaseSha: baseline.presentationReference.sha,
    mechanicsSha: baseline.mechanicsAuthority.sha,
    servedSha,
    servedUrl: bundle.served?.url ?? null,
  };
  const ctx: AnalyzerContext = {
    bundle,
    facts,
    baseline,
    intent,
    source,
    provider,
    resolvePath: (ref: string) => (path.isAbsolute(ref) ? ref : path.join(outDir, ref)),
    now: nowIso,
  };
  const decisions: Decision[] = [];
  const blockers: string[] = [];
  for (const analyzer of ANALYZERS) {
    try {
      const d = await analyzer.run(ctx);
      const issues = validateDecision(d);
      if (issues.length > 0) throw new Error(`invalid decision: ${issues.map((i) => `${i.path} ${i.message}`).join("; ")}`);
      decisions.push(d);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      decisions.push({
        schemaVersion: 1,
        id: analyzer.id,
        title: analyzer.title,
        verdict: "FAIL",
        confidence: 0,
        flags: ["ANALYZER_CRASHED"],
        metrics: { error: message.slice(0, 500) },
        evidence: [],
        source,
        provider,
        humanApprovalRequired: true,
        summary: "The analyzer threw; treated as FAIL so a crash never reads as a pass.",
        generatedAt: nowIso(),
      });
    }
  }
  for (const d of decisions) {
    if (d.verdict === "FAIL") blockers.push(`${d.id}: ${d.flags.join(", ")}`);
  }
  for (const n of bundle.notes) if (/aborted|failed/.test(n)) blockers.push(`capture: ${n}`);
  const overall = worstVerdict(decisions.map((d) => d.verdict));
  const report: RunReport = {
    schemaVersion: 1,
    runId: id,
    generatedAt,
    overall,
    humanApprovalRequired: true,
    source,
    provider,
    decisions,
    blockers,
    commands,
    outDir,
  };
  writeJson(path.join(outDir, "decisions.json"), report);
  const md = renderMarkdown(report);
  ensureDir(outDir);
  writeJson(path.join(outDir, "run.json"), { runId: id, outDir, generatedAt, overall });
  writeFileSync(path.join(outDir, "report.md"), md);
  return report;
}
