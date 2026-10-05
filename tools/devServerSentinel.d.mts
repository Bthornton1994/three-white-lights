export interface DevServerSentinelReasons {
  readonly NO_SENTINEL: string;
  readonly UNREADABLE: string;
  readonly UNVERIFIABLE: string;
  readonly STALE_BOOT: string;
  readonly DEAD_PID: string;
  readonly WRONG_PORT: string;
}
export interface DevServerSentinelConfig {
  readonly RELATIVE_PATH: string;
  readonly SCHEMA: number;
  readonly TEMP_SUFFIX: string;
  readonly OVERRIDE_ENV: string;
  readonly OVERRIDE_VALUE: string;
  readonly FIX: string;
  readonly REASONS: DevServerSentinelReasons;
}
export const DEV_SERVER_SENTINEL: DevServerSentinelConfig;

export interface SentinelRunner {
  pid: number;
  startTick: string | null;
  cmdline: string | null;
  bootId: string | null;
  bootEpochSeconds: number | null;
  host: string;
  platform: string;
  procAvailable: boolean;
}
export interface SentinelRecord {
  schema: number;
  port: number;
  startedAtIso: string;
  startedAtMs: number;
  logPath: string | null;
  runner: SentinelRunner;
  means: string;
}
export type SentinelVerdict =
  | { ok: true; sentinel: SentinelRecord }
  | { ok: false; reason: string; message: string };

export function repoRootOfThisModule(): string;
export function sentinelPathFor(root: string): string;
export function portOfUrl(url: string): number;
export function buildSentinelRecord(opts: {
  pid: number;
  port: number;
  logPath?: string | null;
  procRoot?: string;
  nowMs?: number;
}): SentinelRecord;
export function writeSentinelRecord(root: string, record: unknown): string;
export function writeSentinel(opts: {
  root: string;
  pid: number;
  port: number;
  logPath?: string | null;
  procRoot?: string;
  nowMs?: number;
}): { path: string; record: SentinelRecord };
export function removeSentinel(root: string): boolean;
export function checkDevServerSentinel(opts: {
  url: string;
  root?: string;
  procRoot?: string;
  nowMs?: number;
}): SentinelVerdict;
export const OVERRIDE_BANNER_LINES: readonly string[];
export function gateDevServer(opts: {
  url: string;
  root?: string;
  env?: Record<string, string | undefined>;
  log?: (line: string) => void;
  exit?: (code: number) => void;
  procRoot?: string;
  nowMs?: number;
}): { overridden: boolean; sentinel: SentinelRecord | null; refused?: SentinelVerdict };
