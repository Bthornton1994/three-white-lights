import path from "node:path";
import { parseAttemptsPerLift } from "./attempt-plan.ts";
import { loadBaseline, loadIntent, providerInfo } from "./config.ts";
import { analyzeArtifacts, runAnalysis } from "./pipeline.ts";
import { renderMarkdown } from "./report/markdown.ts";
import type { CaptureBundle, RunReport, WorktreeFacts } from "./types.ts";
import { readJson } from "./util/fs.ts";

function flag(args: string[], name: string): string | null {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : (args[i + 1] ?? null);
}

function has(args: string[], name: string): boolean {
  return args.includes(`--${name}`);
}

function usage(): never {
  console.error(`usage:
  cli.ts analyze [--target <sha>] [--reference <sha>] [--out <dir>] [--work-dir <dir>]
                 [--keep-worktree] [--skip-reference] [--skip-tests] [--chromium <path>]
                 [--insecure-fonts]   (accept a TLS-intercepting proxy for the font hosts only)
                 [--attempts-per-lift <n>]  (omit for original coverage; 3 → 18 cases)
  cli.ts analyze-bundle --bundle <bundle.json> --facts <facts.json> [--out <dir>]
  cli.ts report <decisions.json>`);
  process.exit(2);
}

async function main(): Promise<void> {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === "analyze") {
    const report = await runAnalysis({
      targetSha: flag(args, "target") ?? undefined,
      referenceSha: flag(args, "reference") ?? undefined,
      outDir: flag(args, "out") ?? undefined,
      workDir: flag(args, "work-dir") ?? undefined,
      keepWorktree: has(args, "keep-worktree"),
      skipReference: has(args, "skip-reference"),
      skipTests: has(args, "skip-tests"),
      chromiumPath: flag(args, "chromium"),
      ignoreHttpsErrors: has(args, "insecure-fonts") || process.env.TWL_IGNORE_HTTPS_ERRORS === "1",
      attemptsPerLift: parseAttemptsPerLift(flag(args, "attempts-per-lift")),
    });
    console.log(renderMarkdown(report));
    console.error(`written: ${report.outDir}`);
    process.exit(report.overall === "FAIL" ? 1 : 0);
  }
  if (cmd === "analyze-bundle") {
    const bundleFile = flag(args, "bundle");
    const factsFile = flag(args, "facts");
    if (!bundleFile || !factsFile) usage();
    const bundle = readJson<CaptureBundle>(bundleFile);
    const facts = readJson<WorktreeFacts>(factsFile);
    const outDir = flag(args, "out") ?? path.dirname(path.resolve(bundleFile));
    const baseline = loadBaseline();
    baseline.target.sha = bundle.targetSha;
    const report = await analyzeArtifacts(bundle, facts, baseline, loadIntent(), providerInfo(), outDir, `offline-${Date.now()}`, []);
    console.log(renderMarkdown(report));
    process.exit(report.overall === "FAIL" ? 1 : 0);
  }
  if (cmd === "report") {
    const file = args[0];
    if (!file) usage();
    console.log(renderMarkdown(readJson<RunReport>(file)));
    return;
  }
  usage();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
