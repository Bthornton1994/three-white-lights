#!/usr/bin/env node
/**
 * devServerSentinel.mjs — the handshake between `tools/dev-web.sh` and every
 * browser tool that drives the server it starts.
 *
 * ===========================================================================
 * THE INCIDENT CLASS THIS CLOSES
 * ===========================================================================
 * Two shapes, both measured on this box rather than hypothesised:
 *
 *   1. A tool drives a server that `tools/dev-web.sh` did not start. A bare
 *      `npx expo start` misses the canvaskit copy (loud failure) and misses
 *      `--clear` (silent one: Metro's transform cache serves the PREVIOUS
 *      build, and a green capture of the wrong code is indistinguishable from
 *      a green capture of the right one). Session A ran a whole session of
 *      evidence re-takes against a bare server before noticing.
 *   2. A tool on one session drives the port another session's server owns.
 *      Four sessions share this box; the default `--url` is the same string in
 *      every checkout, so nothing in the tool can tell whose build answered.
 *
 * `tools/verify-shell-route.mjs` says it plainly in its own header: "`--url`
 * can point anywhere, and nothing here can tell that the bundle on the other
 * end was built from these files." This module is the closest available
 * approximation of that missing telling: the tool refuses to drive unless the
 * checkout it lives in holds a sentinel proving `tools/dev-web.sh` started a
 * server, that the server process is still the one the sentinel recorded, and
 * that it listens on the port the tool is about to drive.
 *
 * ===========================================================================
 * THE SENTINEL: WHAT IS RECORDED AND WHY EACH FIELD EXISTS
 * ===========================================================================
 * `tools/dev-web.sh` writes `.gauntlet/dev-web.sentinel` (gitignored — it
 * describes a live process and is not meant to survive anything) AFTER its
 * curl loop has seen the server answer, so a sentinel's existence also means
 * the server actually came up. One JSON object:
 *
 *   schema     bumped when this shape changes; an older record is UNREADABLE.
 *   port       the port the server was started on. Compared against the URL
 *              the tool is about to drive.
 *   startedAt* wall-clock provenance for a human reading the file.
 *   logPath    where the server's output went, for the same human.
 *   runner     `currentRunner(...)` from `tools/verifyMarker.mjs`, taken for
 *              the SERVER's pid: pid, /proc start tick, cmdline fingerprint,
 *              boot id, boot epoch, host. Imported, not copied — CLAUDE.md's
 *              twin-guard rule: a guard written for one tool must be READ by
 *              its siblings. `watchdog.mjs`'s marker verdicts already decided
 *              how "this pid is the process I recorded" is asked on this box,
 *              and this module asks the same way rather than inventing a
 *              second dialect.
 *
 * WHY THE BOOT ID IS LOAD-BEARING AND NOT DECORATION: this environment's
 * dominant failure is the whole machine restarting (39 rewinds and counting).
 * A sentinel from before a restart names a pid the new boot may have reused.
 * "pid is alive" only means something inside one boot, so the boot comparison
 * runs FIRST and a mismatch voids everything else the sentinel says. The
 * epoch tolerance is `VERIFY_MARKER.BOOT_EPOCH_TOLERANCE_SECONDS`, imported
 * for the same reason the runner is.
 *
 * ===========================================================================
 * THE REFUSALS, AND THE ESCAPE HATCH
 * ===========================================================================
 * Every refusal names WHAT was wrong (one of `DEV_SERVER_SENTINEL.REASONS`)
 * and names `tools/dev-web.sh` as the fix, so it never reads as a hang and
 * never reads as a mystery. The escape hatch is `UNMANAGED_DEV_SERVER=1`:
 * it skips the check and prints a banner saying so, because the legitimate
 * "I really do mean another server" case needs a precise, honest exit — a
 * blocking guard with no exit trains bypass, which is the defect one level
 * out.
 *
 * ===========================================================================
 * DECLARED LIMITS, so nobody reads this as more than it is
 * ===========================================================================
 *   - ONE SENTINEL PER CHECKOUT. `tools/dev-web.sh` on a second port replaces
 *     it, so "the managed server" means the LAST one started from this
 *     checkout. Two live servers from one checkout leaves the older one
 *     refusable (WRONG_PORT), which is the conservative direction.
 *   - THIS IS NOT PROOF THE BUNDLE MATCHES THE TREE. A server started by
 *     `tools/dev-web.sh` before a source edit still serves the old build
 *     until restarted. What the sentinel proves is narrower: the server was
 *     started the supported way (wasm copied, cache cleared at boot, old
 *     listener killed by port) and is still that process on that port.
 *   - PID REUSE THAT ALSO REPRODUCES THE START TICK AND THE CMDLINE reads as
 *     live. Same declared limit as `verifyMarker.mjs`, same three-coincidence
 *     bar.
 *   - A HOST WITHOUT `/proc`, or a sentinel written on another host, is
 *     UNVERIFIABLE and refused — "cannot confirm alive" is never read as
 *     "alive" (the `verifyMarker.mjs` rule). The override is the exit there.
 */
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  renameSync,
  readFileSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { VERIFY_MARKER, currentRunner } from './verifyMarker.mjs';

/**
 * Every tuned value and every enumerated name in one frozen object
 * (CLAUDE.md, "Game Feel Values Must Be Tunable" — written about feel, reads
 * on any hand-tuned number or load-bearing name).
 */
export const DEV_SERVER_SENTINEL = Object.freeze({
  /** Repo-relative. Gitignored; see this file's header. */
  RELATIVE_PATH: '.gauntlet/dev-web.sentinel',
  /** Bumped when the record's shape changes; an older record is UNREADABLE. */
  SCHEMA: 1,
  /** Written-then-renamed so a kill mid-write leaves no torn sentinel. */
  TEMP_SUFFIX: '.tmp',
  /** The env var that skips the gate — loudly, never silently. */
  OVERRIDE_ENV: 'UNMANAGED_DEV_SERVER',
  /** The only value that engages the override; anything else is the gate. */
  OVERRIDE_VALUE: '1',
  /** The fix every refusal names. */
  FIX: 'tools/dev-web.sh',

  REASONS: Object.freeze({
    /** No sentinel file: no managed server is known for this checkout. */
    NO_SENTINEL: 'NO_SENTINEL',
    /** A file exists but cannot be read as a sentinel (torn, or old schema). */
    UNREADABLE: 'UNREADABLE',
    /** Another host, or no `/proc`: liveness is undecidable, so refused. */
    UNVERIFIABLE: 'UNVERIFIABLE',
    /** The machine restarted since the sentinel was written. */
    STALE_BOOT: 'STALE_BOOT',
    /** The recorded process is gone, or its pid now names a stranger. */
    DEAD_PID: 'DEAD_PID',
    /** The managed server listens on a different port than the URL names. */
    WRONG_PORT: 'WRONG_PORT',
  }),
});

/** The repo this module (and therefore the calling tool) lives in. */
export function repoRootOfThisModule() {
  return path.resolve(fileURLToPath(import.meta.url), '..', '..');
}

export function sentinelPathFor(root) {
  return path.join(root, DEV_SERVER_SENTINEL.RELATIVE_PATH);
}

/**
 * The port a URL names, with the scheme defaults `new URL` leaves implicit
 * made explicit — `http://localhost` drives 80, not "no port".
 */
export function portOfUrl(url) {
  const parsed = new URL(url);
  if (parsed.port !== '') return Number(parsed.port);
  return parsed.protocol === 'https:' ? 443 : 80;
}

/**
 * The record `tools/dev-web.sh` asks this module to write. The runner facts
 * are taken for the SERVER's pid, not this process's.
 */
export function buildSentinelRecord({ pid, port, logPath = null, procRoot = '/proc', nowMs = Date.now() }) {
  return {
    schema: DEV_SERVER_SENTINEL.SCHEMA,
    port: Number(port),
    startedAtIso: new Date(nowMs).toISOString(),
    startedAtMs: nowMs,
    logPath,
    runner: currentRunner({ nowMs, procRoot, pid: Number(pid) }),
    means:
      'Describes the live dev server tools/dev-web.sh last started from this checkout. '
      + 'Browser tools refuse to drive a server this record cannot vouch for.',
  };
}

/**
 * Write, fsync, rename — the same ordering `verifyMarker.mjs` uses and for
 * the same reason: a kill during the write leaves a `.tmp` that is not a
 * sentinel, never a half-parsed record.
 */
export function writeSentinelRecord(root, record) {
  const filePath = sentinelPathFor(root);
  mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}${DEV_SERVER_SENTINEL.TEMP_SUFFIX}`;
  const fd = openSync(tmp, 'w');
  try {
    writeSync(fd, `${JSON.stringify(record, null, 2)}\n`);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, filePath);
  return filePath;
}

export function writeSentinel({ root, pid, port, logPath = null, procRoot = '/proc', nowMs = Date.now() }) {
  const record = buildSentinelRecord({ pid, port, logPath, procRoot, nowMs });
  return { path: writeSentinelRecord(root, record), record };
}

/** Idempotent: removing an absent sentinel is not an error. */
export function removeSentinel(root) {
  try {
    unlinkSync(sentinelPathFor(root));
    return true;
  } catch {
    return false;
  }
}

function readSentinelEntry(root) {
  const filePath = sentinelPathFor(root);
  if (!existsSync(filePath)) return { record: null, parseError: null, exists: false };
  try {
    const record = JSON.parse(readFileSync(filePath, 'utf8'));
    if (record === null || typeof record !== 'object' || record.schema !== DEV_SERVER_SENTINEL.SCHEMA) {
      return { record: null, parseError: `schema is not ${DEV_SERVER_SENTINEL.SCHEMA}`, exists: true };
    }
    return { record, parseError: null, exists: true };
  } catch (error) {
    return { record: null, parseError: String(error).slice(0, 200), exists: true };
  }
}

/**
 * The complete refusal text. Every arm routes through here so the two
 * promises — the reason is named, and `tools/dev-web.sh` is named as the fix
 * — hold by construction rather than per-arm discipline.
 */
function refusal(reason, what, { url, root }) {
  const port = portOfUrl(url);
  return {
    ok: false,
    reason,
    message:
      `REFUSING TO DRIVE ${url} — ${reason}: ${what}\n`
      + `The browser tools only drive a dev server started by ${DEV_SERVER_SENTINEL.FIX}, which\n`
      + `records a sentinel at ${sentinelPathFor(root)}.\n`
      + `A server without a live matching sentinel may be another session's, another\n`
      + `checkout's, or a bare \`npx expo start\` missing the canvaskit copy and --clear.\n`
      + `Fix:      PORT=${port} ${DEV_SERVER_SENTINEL.FIX}\n`
      + `Override: ${DEV_SERVER_SENTINEL.OVERRIDE_ENV}=${DEV_SERVER_SENTINEL.OVERRIDE_VALUE} (skips this check and says so loudly)`,
  };
}

/**
 * The pure check. Arms in the order `classifyMarker` asks its questions —
 * readability, then "can this machine answer at all", then boot, then pid —
 * with the port comparison after boot because a stale boot voids the port
 * claim along with everything else.
 */
export function checkDevServerSentinel({ url, root = repoRootOfThisModule(), procRoot = '/proc', nowMs = Date.now() }) {
  const ctx = { url, root };
  const entry = readSentinelEntry(root);
  if (!entry.exists) {
    return refusal(
      DEV_SERVER_SENTINEL.REASONS.NO_SENTINEL,
      `no sentinel exists, so no ${DEV_SERVER_SENTINEL.FIX}-managed server is known for this checkout`,
      ctx,
    );
  }
  if (entry.record === null) {
    return refusal(
      DEV_SERVER_SENTINEL.REASONS.UNREADABLE,
      `the sentinel cannot be read (${entry.parseError})`,
      ctx,
    );
  }
  const recorded = entry.record.runner ?? {};
  const current = currentRunner({ nowMs, procRoot, pid: recorded.pid ?? -1 });

  if (typeof recorded.host === 'string' && recorded.host !== current.host) {
    return refusal(
      DEV_SERVER_SENTINEL.REASONS.UNVERIFIABLE,
      `the sentinel was written on host ${recorded.host}; this is ${current.host}, whose /proc cannot answer for it`,
      ctx,
    );
  }
  if (!current.procAvailable || !recorded.procAvailable) {
    return refusal(
      DEV_SERVER_SENTINEL.REASONS.UNVERIFIABLE,
      `no /proc to resolve pid ${String(recorded.pid)} against (platform ${current.platform}) — "cannot confirm alive" is never read as "alive"`,
      ctx,
    );
  }

  // Boot identity first: a restarted machine voids every pid claim, whatever
  // the pid table says today. Same two legs and same tolerance as
  // `classifyMarker` in verifyMarker.mjs.
  const bootIdMatches =
    recorded.bootId === null || current.bootId === null ? true : recorded.bootId === current.bootId;
  const epochDrift =
    typeof recorded.bootEpochSeconds === 'number' && typeof current.bootEpochSeconds === 'number'
      ? Math.abs(recorded.bootEpochSeconds - current.bootEpochSeconds)
      : 0;
  if (!bootIdMatches || epochDrift > VERIFY_MARKER.BOOT_EPOCH_TOLERANCE_SECONDS) {
    return refusal(
      DEV_SERVER_SENTINEL.REASONS.STALE_BOOT,
      bootIdMatches
        ? `the machine booted ${epochDrift}s away from when this sentinel was written — the recorded server cannot exist`
        : 'the machine has a different boot id than when this sentinel was written — the recorded server cannot exist',
      ctx,
    );
  }

  if (current.startTick === null) {
    return refusal(
      DEV_SERVER_SENTINEL.REASONS.DEAD_PID,
      `pid ${String(recorded.pid)} is not running — the server this sentinel describes is gone`,
      ctx,
    );
  }
  if (recorded.startTick === null || current.startTick !== recorded.startTick || current.cmdline !== recorded.cmdline) {
    return refusal(
      DEV_SERVER_SENTINEL.REASONS.DEAD_PID,
      `pid ${String(recorded.pid)} is running but is not the process the sentinel recorded — the pid was reused since`,
      ctx,
    );
  }

  const drivingPort = portOfUrl(url);
  if (Number(entry.record.port) !== drivingPort) {
    return refusal(
      DEV_SERVER_SENTINEL.REASONS.WRONG_PORT,
      `this checkout's managed server listens on port ${String(entry.record.port)}; this tool is about to drive port ${drivingPort}, which is somebody else's`,
      ctx,
    );
  }

  return { ok: true, sentinel: entry.record };
}

/** The banner the override prints. Exported so the test pins the real text. */
export const OVERRIDE_BANNER_LINES = Object.freeze([
  '!! =================================================================== !!',
  `!! ${DEV_SERVER_SENTINEL.OVERRIDE_ENV}=${DEV_SERVER_SENTINEL.OVERRIDE_VALUE} — DEV-SERVER SENTINEL CHECK SKIPPED ON PURPOSE.   !!`,
  '!! This run drives a server this checkout cannot vouch for. Evidence   !!',
  '!! it produces cannot say which build, or whose server, it measured.   !!',
  '!! =================================================================== !!',
]);

/**
 * The one line every browser tool calls before launching a browser.
 * Injectable `env`/`log`/`exit` so the vitest file can drive both arms
 * without killing the worker; the defaults are the real thing.
 */
export function gateDevServer({
  url,
  root = repoRootOfThisModule(),
  env = process.env,
  log = (line) => console.error(line),
  exit = (code) => process.exit(code),
  procRoot = '/proc',
  nowMs = Date.now(),
}) {
  if (env[DEV_SERVER_SENTINEL.OVERRIDE_ENV] === DEV_SERVER_SENTINEL.OVERRIDE_VALUE) {
    for (const line of OVERRIDE_BANNER_LINES) log(line);
    log(`!! URL: ${url}`);
    return { overridden: true, sentinel: null };
  }
  const verdict = checkDevServerSentinel({ url, root, procRoot, nowMs });
  if (!verdict.ok) {
    log(verdict.message);
    exit(1);
    // Reached only under an injected `exit` (tests). Refuse to fall through
    // into driving: the caller gets a verdict, never a green.
    return { overridden: false, sentinel: null, refused: verdict };
  }
  log(
    `dev-server sentinel OK: pid ${String(verdict.sentinel.runner?.pid)} on port ${String(verdict.sentinel.port)} `
    + `(started ${String(verdict.sentinel.startedAtIso)})`,
  );
  return { overridden: false, sentinel: verdict.sentinel };
}

// ---------------------------------------------------------------------------
// CLI — what `tools/dev-web.sh` calls, so bash never hand-rolls JSON or /proc
// parsing and the schema has exactly one home.
//
//   node tools/devServerSentinel.mjs write  --pid N --port N [--root R] [--log L]
//   node tools/devServerSentinel.mjs remove [--root R]
//   node tools/devServerSentinel.mjs check  --url U [--root R]
// ---------------------------------------------------------------------------
const invokedDirectly =
  process.argv[1] !== undefined
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const [command, ...rest] = process.argv.slice(2);
  const flag = (name) => {
    const i = rest.indexOf(`--${name}`);
    return i === -1 ? undefined : rest[i + 1];
  };
  const root = flag('root') ?? repoRootOfThisModule();
  if (command === 'write') {
    const pid = Number(flag('pid'));
    const port = Number(flag('port'));
    if (!Number.isFinite(pid) || !Number.isFinite(port)) {
      console.error('usage: devServerSentinel.mjs write --pid N --port N [--root R] [--log L]');
      process.exit(2);
    }
    const { path: written } = writeSentinel({ root, pid, port, logPath: flag('log') ?? null });
    console.log(`sentinel written: ${written}`);
  } else if (command === 'remove') {
    removeSentinel(root);
  } else if (command === 'check') {
    const url = flag('url');
    if (url === undefined) {
      console.error('usage: devServerSentinel.mjs check --url U [--root R]');
      process.exit(2);
    }
    const verdict = checkDevServerSentinel({ url, root });
    if (verdict.ok) {
      console.log(`OK: managed server pid ${String(verdict.sentinel.runner?.pid)} on port ${String(verdict.sentinel.port)}`);
    } else {
      console.error(verdict.message);
      process.exit(1);
    }
  } else {
    console.error('usage: devServerSentinel.mjs <write|remove|check> ...');
    process.exit(2);
  }
}
