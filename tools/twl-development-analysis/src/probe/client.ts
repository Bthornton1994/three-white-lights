import path from "node:path";
import { PACKAGE_ROOT } from "../config.ts";
import type { OracleSample, ProbeFacts } from "../types.ts";
import { run, type ExecResult } from "../util/exec.ts";
import { readJson, writeJson } from "../util/fs.ts";

export interface OracleAnswer {
  index: number;
  accepted: number[];
}

export interface ProbeRun {
  facts: ProbeFacts | null;
  oracle: OracleAnswer[] | null;
  record: ExecResult;
}

/**
 * Executes the mechanics probe against `<worktree>/arcade` and returns its
 * facts. A probe that cannot run yields `facts: null`; the analyzers treat
 * that as missing evidence and fail closed.
 */
export function runProbe(arcadeDir: string, outFile: string, oracle?: OracleSample[]): ProbeRun {
  const register = path.join(PACKAGE_ROOT, "src", "probe", "register.mjs");
  const probe = path.join(PACKAGE_ROOT, "src", "probe", "mechanics-probe.ts");
  const args = ["--disable-warning=ExperimentalWarning", "--import", register, probe, "--arcade", arcadeDir, "--out", outFile];
  let oracleFile: string | null = null;
  if (oracle && oracle.length > 0) {
    oracleFile = `${outFile}.oracle-input.json`;
    writeJson(oracleFile, oracle);
    args.push("--oracle", oracleFile);
  }
  const record = run(process.execPath, args, { cwd: arcadeDir, timeoutMs: 180_000 });
  if (record.exitCode !== 0) return { facts: null, oracle: null, record };
  try {
    const raw = readJson<ProbeFacts & { oracle?: OracleAnswer[] | null }>(outFile);
    const { oracle: oracleOut, ...facts } = raw;
    return { facts: facts as ProbeFacts, oracle: oracleOut ?? null, record };
  } catch (err) {
    record.stderrTail += `\nprobe output unreadable: ${String(err)}`;
    return { facts: null, oracle: null, record };
  }
}
