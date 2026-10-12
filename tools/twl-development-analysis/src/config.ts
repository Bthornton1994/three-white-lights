import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BaselineConfig, IntentConfig, ProviderInfo } from "./types.ts";

export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function packageVersion(): string {
  const pkg = JSON.parse(readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf8")) as { version: string };
  return pkg.version;
}

export function loadBaseline(file = path.join(PACKAGE_ROOT, "config", "baseline.json")): BaselineConfig {
  const cfg = JSON.parse(readFileSync(file, "utf8")) as BaselineConfig;
  assertSha(cfg.target.sha, "target.sha");
  assertSha(cfg.presentationReference.sha, "presentationReference.sha");
  assertSha(cfg.mechanicsAuthority.sha, "mechanicsAuthority.sha");
  return cfg;
}

export function loadIntent(file = path.join(PACKAGE_ROOT, "config", "intent.json")): IntentConfig {
  return JSON.parse(readFileSync(file, "utf8")) as IntentConfig;
}

export function assertSha(sha: string, label: string): void {
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`${label}: expected a 40-hex SHA, got ${JSON.stringify(sha)}`);
}

export function providerInfo(extra: Partial<ProviderInfo> = {}): ProviderInfo {
  return {
    name: "twl-development-analysis",
    version: packageVersion(),
    engine: "deterministic-rules",
    node: process.version,
    playwright: extra.playwright ?? null,
    browser: extra.browser ?? null,
  };
}
