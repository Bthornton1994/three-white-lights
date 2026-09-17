import { spawn, spawnSync, type SpawnSyncOptions } from "node:child_process";
import type { CommandRecord } from "../types.ts";

const TAIL = 4000;

function tail(s: string): string {
  return s.length > TAIL ? s.slice(s.length - TAIL) : s;
}

export interface ExecResult extends CommandRecord {
  stdout: string;
  stderr: string;
}

/** Runs a command to completion and records it. Never throws on non-zero exit. */
export function run(
  cmd: string,
  args: string[],
  opts: { cwd: string; env?: NodeJS.ProcessEnv; timeoutMs?: number; input?: string } ,
): ExecResult {
  const started = Date.now();
  const spawnOpts: SpawnSyncOptions = {
    cwd: opts.cwd,
    env: { ...process.env, ...(opts.env ?? {}) },
    encoding: "utf8",
    timeout: opts.timeoutMs ?? 600_000,
    maxBuffer: 64 * 1024 * 1024,
    input: opts.input,
  };
  const r = spawnSync(cmd, args, spawnOpts);
  const stdout = String(r.stdout ?? "");
  const stderr = String(r.stderr ?? "");
  return {
    cmd: [cmd, ...args].join(" "),
    cwd: opts.cwd,
    exitCode: r.status,
    durationMs: Date.now() - started,
    stdoutTail: tail(stdout),
    stderrTail: tail(stderr + (r.error ? `\n${String(r.error)}` : "")),
    stdout,
    stderr,
  };
}

export function toRecord(r: ExecResult): CommandRecord {
  return {
    cmd: r.cmd,
    cwd: r.cwd,
    exitCode: r.exitCode,
    durationMs: r.durationMs,
    stdoutTail: r.stdoutTail,
    stderrTail: r.stderrTail,
  };
}

export interface BackgroundProcess {
  pid: number | undefined;
  stop: () => Promise<void>;
}

export function runBackground(cmd: string, args: string[], cwd: string): BackgroundProcess {
  const child = spawn(cmd, args, { cwd, stdio: "ignore" });
  return {
    pid: child.pid,
    stop: () =>
      new Promise((resolve) => {
        if (child.exitCode !== null) return resolve();
        child.once("exit", () => resolve());
        child.kill("SIGTERM");
        setTimeout(() => {
          if (child.exitCode === null) child.kill("SIGKILL");
        }, 2000).unref();
      }),
  };
}
