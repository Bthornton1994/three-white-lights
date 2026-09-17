import path from "node:path";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import { PACKAGE_ROOT, loadBaseline, loadIntent, providerInfo } from "../src/config.ts";
import type { AnalyzerContext, CaptureBundle, SourceIdentity, WorktreeFacts } from "../src/types.ts";
import { readJson } from "../src/util/fs.ts";

export const FIXTURES = path.join(PACKAGE_ROOT, "fixtures");

export function tmpDir(prefix = "twl-test-"): string {
  return mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function loadFixtureBundle(name: string): { bundle: CaptureBundle; facts: WorktreeFacts } {
  const dir = path.join(FIXTURES, "bundles", name);
  const meta = readJson<{ facts?: string }>(path.join(dir, "fixture.json"));
  const factsFile = meta.facts ? path.resolve(dir, meta.facts) : path.join(dir, "facts.json");
  return { bundle: readJson<CaptureBundle>(path.join(dir, "bundle.json")), facts: readJson<WorktreeFacts>(factsFile) };
}

export function contextFor(bundle: CaptureBundle, facts: WorktreeFacts, resolveRoot: string): AnalyzerContext {
  const baseline = loadBaseline();
  const intent = loadIntent();
  const source: SourceIdentity = {
    targetSha: baseline.target.sha,
    presentationBaseSha: baseline.presentationReference.sha,
    mechanicsSha: baseline.mechanicsAuthority.sha,
    servedSha: bundle.beats[0]?.dom.sportSource ?? null,
    servedUrl: bundle.served?.url ?? null,
  };
  return {
    bundle,
    facts,
    baseline,
    intent,
    source,
    provider: providerInfo(),
    resolvePath: (ref: string) => (path.isAbsolute(ref) ? ref : path.join(resolveRoot, ref)),
    now: () => "2026-09-17T00:00:00.000Z",
  };
}

/** Deep clone via JSON; fixtures are plain data. */
export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
