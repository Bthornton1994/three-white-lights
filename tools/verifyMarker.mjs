#!/usr/bin/env node
/**
 * verifyMarker.mjs — a verification that stops existing must not read as a pass.
 *
 * ===========================================================================
 * THE RULING THIS IMPLEMENTS, VERBATIM
 * ===========================================================================
 *   > An interrupted verification must write an INCOMPLETE marker, never leave
 *   > silent absence that reads as a pass.
 *
 * ===========================================================================
 * THE TWO INCIDENTS, BOTH REAL, BOTH THIS RUN
 * ===========================================================================
 *   1. A container restart killed a running `vitest` AND TOOK ITS OUTPUT FILE
 *      WITH IT. The lead session polled and found no output file at all. A
 *      missing file looks identical to a run that has not started, a run still
 *      going, and a run that passed — the reader supplies the verdict from
 *      context, and context says green. Nothing on disk distinguished "this
 *      verification was interrupted" from "this verification was never asked
 *      for".
 *   2. A merged tree was pushed while its verification was in flight. The
 *      branch had been verified; the MERGE had not. The suite came back red —
 *      one test over budget — twenty minutes after the push.
 *
 * The failure mode is not "a run failed". A failure is loud and gets read. The
 * failure mode is a verification that STOPS EXISTING.
 *
 * ===========================================================================
 * THE PROPERTY
 * ===========================================================================
 * At every instant from the moment a verification starts until it has written a
 * real verdict, an on-disk artifact says it is INCOMPLETE.
 *
 *   - The marker is written, fsynced and renamed into place BEFORE the command
 *     is spawned. A marker written on completion is exactly the thing that
 *     vanishes when the process dies. `tools/verifyMarker.test.ts`'s
 *     "writes the marker before the command starts" proves the ordering by
 *     having THE WRAPPED COMMAND ITSELF read the marker directory: if the write
 *     moved after the await, the child would see nothing.
 *   - A real verdict — PASS or FAIL — replaces the marker's status in place. A
 *     failing verification is a COMPLETED one and is not a finding here; the
 *     suite going red is its own loud signal and does not need this one.
 *   - A timeout, a signal, a spawn failure or a crash leaves the status at
 *     INCOMPLETE. Timeout and signal additionally record WHICH interruption,
 *     because the wrapper was alive to see it; a container kill records nothing
 *     more, because nothing was alive to write it. Both stay findings.
 *
 * ===========================================================================
 * WHERE MARKERS LIVE, AND WHY NOT `/tmp`
 * ===========================================================================
 * `.gauntlet/verify/` — inside the repository, gitignored. The precedent and
 * the reasoning are already in `.gitignore` beside `*.verify.log`: the
 * scratchpad under `/tmp` does not survive a rewind, and the thirteenth rewind
 * took a running vitest and its output file together. Writing here means the
 * marker survives the container; ignoring it means it never dirties a tree an
 * evidence stamp is about to describe.
 *
 * ===========================================================================
 * LIVE VERSUS STALE, AND WHAT THE DISCRIMINATOR CANNOT TELL APART
 * ===========================================================================
 * A verification running right now legitimately has an INCOMPLETE marker, so
 * "an INCOMPLETE marker exists" cannot be the finding. AGE IS A WEAK SIGNAL and
 * is deliberately not the discriminator: the suite has taken 430 s honestly,
 * and a container restart leaves a marker whose process is long gone with no
 * way to ask it.
 *
 * The discriminator is the RUNNER TRIPLE plus the BOOT IDENTITY, both recorded
 * at write time and both re-read at scan time:
 *
 *   boot identity   `/proc/sys/kernel/random/boot_id` and the wall-clock
 *                   instant of boot (`now - /proc/uptime`, compared within
 *                   `BOOT_EPOCH_TOLERANCE_SECONDS` so NTP jitter is not a
 *                   reboot). Differ => the machine restarted => the recorded
 *                   process cannot exist, whatever the pid says. THIS IS THE
 *                   ARM THAT CATCHES INCIDENT 1.
 *   runner triple   pid, the process start tick from `/proc/<pid>/stat`, and a
 *                   fingerprint of `/proc/<pid>/cmdline`. Same boot and the
 *                   triple still resolves => LIVE. Same boot and it does not =>
 *                   the process is gone => INTERRUPTED.
 *
 * WHAT IT CANNOT TELL APART — stated as limits, not caveats, because a partial
 * mechanism that declares its coverage beats one that implies completeness:
 *
 *   - A LIVE PROCESS MAKING PROGRESS FROM A LIVE PROCESS MAKING NONE. A wedged
 *     verification reads LIVE and is not a finding until its own budget plus
 *     `OVERDUE_GRACE_SECONDS` has elapsed, at which point it is reported as
 *     LIVE_OVERDUE — which says the wrapper's own kill did not happen, not that
 *     the command is slow.
 *   - PID REUSE THAT ALSO REPRODUCES THE START TICK AND THE CMDLINE. Three
 *     coincidences at once inside one boot. It would read LIVE. Nothing here
 *     can see it.
 *   - A MARKER WRITTEN ON ANOTHER MACHINE. `/proc` here describes this machine
 *     only, so a foreign `host` is reported UNRESOLVED and counted as a
 *     finding. It is not called stale, because it is not known to be.
 *   - ANY PLATFORM WITHOUT `/proc`. Liveness is undecidable and every
 *     INCOMPLETE marker is reported UNRESOLVED and counted. `kill(pid, 0)` was
 *     considered as a fallback and REFUSED: it cannot see pid reuse, so it
 *     answers "live" for a stranger's process — turning "I cannot tell" into a
 *     green, which is the exact failure mode this file exists to remove.
 *   - WHETHER THE COMMAND WAS THE RIGHT ONE. The marker records what was run;
 *     it does not know what should have been.
 *
 * ===========================================================================
 * WHY THERE IS NO `@guarantee` TAG ON ANY OF THE CLAIMS ABOVE
 * ===========================================================================
 * The tag scan in `src/game/guaranteeTags.test.ts` walks `src/` and binds a tag
 * to a vitest `it(` body; `MUTATION_WITNESSES` resolves against that binding.
 * This module is in `tools/`, so a tag written here resolves against nothing —
 * the same hole CLAUDE.md already declares for `tools/verify-shell-route.mjs`,
 * and it says explicitly not to bend the schema to accept an entry that cannot
 * expire. So the four witnesses for the claims above — verbatim mutant and
 * verbatim reddening assertion — are recorded in the commit that introduced
 * them, and every claim's check is named beside the claim here.
 */
import { execFileSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * EVERY TUNED VALUE THIS DISCIPLINE HAS, IN ONE PLACE (CLAUDE.md, "Game Feel
 * Values Must Be Tunable" — the rule is written about feel and reads on any
 * hand-tuned number). Nothing below this object holds a bare threshold.
 */
export const VERIFY_MARKER = Object.freeze({
  /** Repo-relative. Gitignored; see this file's header and `.gitignore`. */
  DIR: '.gauntlet/verify',
  /** Only files with this suffix are markers. A leftover `.tmp` is not one. */
  EXTENSION: '.verify.json',
  TEMP_SUFFIX: '.tmp',
  /** Bumped when the record's shape changes; an older record reads UNREADABLE. */
  SCHEMA: 1,

  STATUS: Object.freeze({
    INCOMPLETE: 'INCOMPLETE',
    PASS: 'PASS',
    FAIL: 'FAIL',
  }),

  /** Recorded on the arms where the wrapper was alive to see the interruption. */
  INTERRUPTION: Object.freeze({
    BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
    SIGNAL: 'SIGNAL',
    COULD_NOT_START: 'COULD_NOT_START',
  }),

  /**
   * How far the recorded boot instant may drift from the one measured now and
   * still count as the same boot. `now - uptime` moves when the wall clock is
   * corrected, so a small tolerance stops NTP looking like a reboot. It is far
   * below any plausible container lifetime, and it is only ONE of the two boot
   * legs — `boot_id` is the other — so a restart inside the tolerance still has
   * to survive the id comparison and then the runner triple.
   */
  BOOT_EPOCH_TOLERANCE_SECONDS: 120,

  /**
   * How long past `startedAt + budget` a marker whose process is still alive is
   * reported as LIVE_OVERDUE. Reaching this means the wrapper's own SIGKILL did
   * not fire, which is a defect in the guard rather than a slow command.
   */
  OVERDUE_GRACE_SECONDS: 120,

  /** Completed records kept; older ones are pruned when a new run begins. */
  COMPLETED_KEPT: 20,

  /** Caps on what a record copies, so a marker stays small and readable. */
  DIRTY_PATHS_RECORDED: 20,
  CMDLINE_CHARS_RECORDED: 200,
  ID_SLUG_CHARS: 40,

  /** Absolute path override. A testing seam, and the only one. */
  ENV_DIR: 'VERIFY_MARKER_DIR',
});

/** Findings, in the order a reader should be shown them. */
export const MARKER_STATE = Object.freeze({
  COMPLETE: 'COMPLETE',
  LIVE: 'LIVE',
  LIVE_OVERDUE: 'LIVE_OVERDUE',
  INTERRUPTED_MACHINE_RESTARTED: 'INTERRUPTED_MACHINE_RESTARTED',
  INTERRUPTED_PROCESS_GONE: 'INTERRUPTED_PROCESS_GONE',
  UNRESOLVED_FOREIGN_HOST: 'UNRESOLVED_FOREIGN_HOST',
  UNRESOLVED_NO_PROC: 'UNRESOLVED_NO_PROC',
  UNREADABLE: 'UNREADABLE',
});

/**
 * THE STATES THAT ARE FINDINGS. Two of them are not stale and are counted
 * anyway: an UNRESOLVED marker is one this machine cannot decide, and "I cannot
 * tell" reading as green is the thing the ruling forbids.
 */
const FINDING_STATES = Object.freeze([
  MARKER_STATE.LIVE_OVERDUE,
  MARKER_STATE.INTERRUPTED_MACHINE_RESTARTED,
  MARKER_STATE.INTERRUPTED_PROCESS_GONE,
  MARKER_STATE.UNRESOLVED_FOREIGN_HOST,
  MARKER_STATE.UNRESOLVED_NO_PROC,
  MARKER_STATE.UNREADABLE,
]);

export function isFinding(state) {
  return FINDING_STATES.includes(state);
}

// ---------------------------------------------------------------------------
// Where
// ---------------------------------------------------------------------------

export function markerDirFor(root, env = process.env) {
  const override = env[VERIFY_MARKER.ENV_DIR];
  if (override !== undefined && override !== '') return override;
  return path.join(root, VERIFY_MARKER.DIR);
}

function slug(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, VERIFY_MARKER.ID_SLUG_CHARS);
}

// ---------------------------------------------------------------------------
// Who is running it — the half of the record the discriminator reads
// ---------------------------------------------------------------------------

/**
 * The process start tick from `/proc/<pid>/stat`, field 22.
 *
 * Parsed from after the LAST `)` rather than by splitting the whole line: field
 * 2 is the executable name in parentheses and may itself contain spaces and
 * parentheses, so a naive split shifts every field after it. `null` when the
 * process does not exist or the file cannot be read as expected — the caller
 * treats "cannot read" as "cannot confirm alive", never as "alive".
 */
function startTickOf(pid, procRoot) {
  let text;
  try {
    text = readFileSync(path.join(procRoot, String(pid), 'stat'), 'utf8');
  } catch {
    return null;
  }
  const close = text.lastIndexOf(')');
  if (close === -1) return null;
  const fields = text.slice(close + 1).trim().split(/\s+/);
  // After the closing paren the first field is `state` (field 3), so field 22
  // is index 19 here.
  const tick = fields[19];
  return tick === undefined ? null : tick;
}

function cmdlineOf(pid, procRoot) {
  try {
    return readFileSync(path.join(procRoot, String(pid), 'cmdline'), 'utf8')
      .replace(/\0/g, ' ')
      .trim()
      .slice(0, VERIFY_MARKER.CMDLINE_CHARS_RECORDED);
  } catch {
    return null;
  }
}

/**
 * Everything about this machine and this process that a later scan can compare
 * against. `procAvailable` is false on any platform without `/proc`, and every
 * caller must branch on it rather than reading `null` as an answer.
 */
export function currentRunner({ nowMs = Date.now(), procRoot = '/proc', pid = process.pid } = {}) {
  const procAvailable = existsSync(path.join(procRoot, 'uptime'));
  let bootEpochSeconds = null;
  if (procAvailable) {
    try {
      const uptime = Number(readFileSync(path.join(procRoot, 'uptime'), 'utf8').trim().split(/\s+/)[0]);
      if (Number.isFinite(uptime)) bootEpochSeconds = Math.round(nowMs / 1000 - uptime);
    } catch {
      bootEpochSeconds = null;
    }
  }
  let bootId = null;
  try {
    bootId = readFileSync(path.join(procRoot, 'sys/kernel/random/boot_id'), 'utf8').trim();
  } catch {
    bootId = null;
  }
  return {
    pid,
    startTick: procAvailable ? startTickOf(pid, procRoot) : null,
    cmdline: procAvailable ? cmdlineOf(pid, procRoot) : null,
    bootId,
    bootEpochSeconds,
    host: os.hostname(),
    platform: process.platform,
    procAvailable,
  };
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/**
 * Write, fsync, rename. The rename is what makes "the marker exists before the
 * command starts" true rather than nearly true: a kill during the write leaves
 * a `.tmp` that is not a marker and no half-parsed record, and a kill after it
 * leaves a complete one. The fsync is because the incident this file is about
 * is a container disappearing, which takes the page cache with it.
 */
function writeAtomic(filePath, text) {
  const tmp = `${filePath}${VERIFY_MARKER.TEMP_SUFFIX}`;
  const fd = openSync(tmp, 'w');
  try {
    writeSync(fd, text);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, filePath);
}

function gitFacts(root) {
  const git = (args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
  try {
    const status = git(['status', '--porcelain']);
    const dirtyLines = status === '' ? [] : status.split('\n');
    return {
      commit: git(['rev-parse', 'HEAD']),
      branch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
      dirty: dirtyLines.length,
      dirtyPaths: dirtyLines
        .slice(0, VERIFY_MARKER.DIRTY_PATHS_RECORDED)
        .map((l) => l.replace(/^\s*\S+\s+/, '')),
    };
  } catch (error) {
    // "Could not ask git" is recorded as itself. It is never recorded as clean:
    // a marker found cold with `dirty: 0` would claim the tree was pristine.
    return { commit: null, branch: null, dirty: null, dirtyPaths: [], gitError: String(error).slice(0, 200) };
  }
}

/**
 * BEFORE THE COMMAND STARTS. The caller must have nothing between this
 * returning and the spawn.
 */
export function beginMarker({ root, command, budgetSeconds, label = null, nowMs = Date.now(), env = process.env }) {
  const dir = markerDirFor(root, env);
  mkdirSync(dir, { recursive: true });
  const runner = currentRunner({ nowMs });
  const stamp = new Date(nowMs).toISOString().replace(/[:.]/g, '-');
  const name = slug(label ?? `${path.basename(command[0] ?? 'command')}-${command[1] ?? ''}`);
  const id = `${name === '' ? 'command' : name}-${stamp}-${runner.pid}`;
  const marker = {
    schema: VERIFY_MARKER.SCHEMA,
    status: VERIFY_MARKER.STATUS.INCOMPLETE,
    id,
    label,
    command,
    budgetSeconds,
    startedAtIso: new Date(nowMs).toISOString(),
    startedAtMs: nowMs,
    cwd: root,
    ...gitFacts(root),
    runner,
    means:
      'INCOMPLETE means this verification started and has not written a verdict. '
      + 'If no process is behind it, the run was interrupted and its result is UNKNOWN — not a pass.',
  };
  const markerPath = path.join(dir, `${id}${VERIFY_MARKER.EXTENSION}`);
  writeAtomic(markerPath, `${JSON.stringify(marker, null, 2)}\n`);
  pruneCompleted(dir);
  return { markerPath, marker };
}

/**
 * Replace the marker's status with a real verdict, or annotate the
 * interruption. `status` stays INCOMPLETE on every interruption arm — a
 * timeout is not a verdict about the code, it is a verification that did not
 * finish.
 */
export function finishMarker(markerPath, patch, { nowMs = Date.now() } = {}) {
  let marker;
  try {
    marker = JSON.parse(readFileSync(markerPath, 'utf8'));
  } catch {
    // The marker is gone or unreadable — somebody cleared it mid-run. Say so in
    // the record we write rather than silently recreating a clean one.
    marker = { schema: VERIFY_MARKER.SCHEMA, status: VERIFY_MARKER.STATUS.INCOMPLETE, recovered: true };
  }
  const finished = {
    ...marker,
    ...patch,
    finishedAtIso: new Date(nowMs).toISOString(),
    elapsedSeconds:
      typeof marker.startedAtMs === 'number' ? Number(((nowMs - marker.startedAtMs) / 1000).toFixed(1)) : null,
  };
  writeAtomic(markerPath, `${JSON.stringify(finished, null, 2)}\n`);
  return finished;
}

/**
 * Keep the directory from growing without bound.
 *
 * IT DELETES ONLY `PASS` AND `FAIL`. An INCOMPLETE record is the whole point of
 * this module and is never pruned, however old and however many — age is not
 * evidence that an interruption was dealt with. `tools/verifyMarker.test.ts`'s
 * "prunes completed records and never an incomplete one" plants more than
 * `COMPLETED_KEPT` completed records beside one interrupted one and checks
 * which survives.
 */
export function pruneCompleted(dir) {
  const completed = readMarkerFiles(dir)
    .filter((entry) => entry.marker !== null && entry.marker.status !== VERIFY_MARKER.STATUS.INCOMPLETE)
    .sort((a, b) => (b.marker.startedAtMs ?? 0) - (a.marker.startedAtMs ?? 0));
  const removed = [];
  for (const entry of completed.slice(VERIFY_MARKER.COMPLETED_KEPT)) {
    try {
      unlinkSync(entry.path);
      removed.push(entry.path);
    } catch {
      // A record somebody else already removed is not an error.
    }
  }
  return removed;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export function readMarkerFiles(dir) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter((n) => n.endsWith(VERIFY_MARKER.EXTENSION))
    .sort()
    .map((n) => {
      const full = path.join(dir, n);
      try {
        const marker = JSON.parse(readFileSync(full, 'utf8'));
        if (typeof marker !== 'object' || marker === null || typeof marker.status !== 'string') {
          return { path: full, marker: null, parseError: 'no status field' };
        }
        if (marker.schema !== VERIFY_MARKER.SCHEMA) {
          return { path: full, marker: null, parseError: `schema ${String(marker.schema)} is not ${VERIFY_MARKER.SCHEMA}` };
        }
        return { path: full, marker, parseError: null };
      } catch (error) {
        return { path: full, marker: null, parseError: String(error).slice(0, 200) };
      }
    });
}

/**
 * THE DISCRIMINATOR. See this file's header for what it cannot tell apart.
 *
 * The order of the questions is the order of their strength, and each one that
 * fires is definitive on its own:
 *
 *   1. Not INCOMPLETE            -> COMPLETE. A failure is a finished run.
 *   2. Unparseable / wrong schema-> UNREADABLE, and it is a FINDING: a torn or
 *                                   foreign record is not an absence.
 *   3. Another machine           -> UNRESOLVED_FOREIGN_HOST.
 *   4. No `/proc` here           -> UNRESOLVED_NO_PROC.
 *   5. Different boot            -> INTERRUPTED_MACHINE_RESTARTED.
 *   6. Runner triple gone        -> INTERRUPTED_PROCESS_GONE.
 *   7. Alive past budget + grace -> LIVE_OVERDUE.
 *   8. Otherwise                 -> LIVE.
 */
export function classifyMarker(entry, { nowMs = Date.now(), runner = currentRunner({ nowMs }), procRoot = '/proc' } = {}) {
  if (entry.marker === null) {
    return { state: MARKER_STATE.UNREADABLE, why: `cannot be read as a marker: ${entry.parseError}` };
  }
  const marker = entry.marker;
  if (marker.status !== VERIFY_MARKER.STATUS.INCOMPLETE) {
    return { state: MARKER_STATE.COMPLETE, why: `finished with ${marker.status}` };
  }
  const recorded = marker.runner ?? {};

  if (typeof recorded.host === 'string' && recorded.host !== runner.host) {
    return {
      state: MARKER_STATE.UNRESOLVED_FOREIGN_HOST,
      why: `written on host ${recorded.host}; this is ${runner.host}, whose /proc cannot answer for it`,
    };
  }
  if (!runner.procAvailable || !recorded.procAvailable) {
    return {
      state: MARKER_STATE.UNRESOLVED_NO_PROC,
      why: `no /proc to resolve pid ${String(recorded.pid)} against (platform ${runner.platform})`,
    };
  }

  const bootIdMatches =
    recorded.bootId === null || runner.bootId === null ? true : recorded.bootId === runner.bootId;
  const epochDrift =
    typeof recorded.bootEpochSeconds === 'number' && typeof runner.bootEpochSeconds === 'number'
      ? Math.abs(recorded.bootEpochSeconds - runner.bootEpochSeconds)
      : 0;
  if (!bootIdMatches || epochDrift > VERIFY_MARKER.BOOT_EPOCH_TOLERANCE_SECONDS) {
    return {
      state: MARKER_STATE.INTERRUPTED_MACHINE_RESTARTED,
      why: bootIdMatches
        ? `the machine booted ${epochDrift}s away from when this marker was written`
        : 'the machine has a different boot id, so the recorded process cannot exist',
    };
  }

  const startTick = startTickOf(recorded.pid, procRoot);
  const cmdline = cmdlineOf(recorded.pid, procRoot);
  if (startTick === null || startTick !== recorded.startTick || cmdline !== recorded.cmdline) {
    return {
      state: MARKER_STATE.INTERRUPTED_PROCESS_GONE,
      why:
        startTick === null
          ? `pid ${String(recorded.pid)} is not running`
          : `pid ${String(recorded.pid)} is running but is not the process that wrote this`,
    };
  }

  const budget = typeof marker.budgetSeconds === 'number' ? marker.budgetSeconds : 0;
  const ageSeconds = (nowMs - (marker.startedAtMs ?? nowMs)) / 1000;
  if (ageSeconds > budget + VERIFY_MARKER.OVERDUE_GRACE_SECONDS) {
    return {
      state: MARKER_STATE.LIVE_OVERDUE,
      why: `pid ${String(recorded.pid)} is alive ${Math.round(ageSeconds)}s in, past its ${budget}s budget plus ${VERIFY_MARKER.OVERDUE_GRACE_SECONDS}s grace — the wrapper's own kill did not fire`,
    };
  }
  return { state: MARKER_STATE.LIVE, why: `pid ${String(recorded.pid)} is running` };
}

export function scanMarkers({ root, nowMs = Date.now(), env = process.env, procRoot = '/proc' } = {}) {
  const dir = markerDirFor(root, env);
  const runner = currentRunner({ nowMs, procRoot });
  const rows = readMarkerFiles(dir).map((entry) => ({
    ...entry,
    ...classifyMarker(entry, { nowMs, runner, procRoot }),
    ageSeconds: entry.marker === null ? null : (nowMs - (entry.marker.startedAtMs ?? nowMs)) / 1000,
  }));
  return {
    dir,
    scanned: rows.length,
    rows,
    findings: rows.filter((r) => isFinding(r.state)),
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function humanAge(seconds) {
  if (seconds === null || !Number.isFinite(seconds)) return 'unknown age';
  if (seconds < 90) return `${Math.round(seconds)}s ago`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} min ago`;
  return `${(seconds / 3600).toFixed(1)} h ago`;
}

/**
 * The message a reader gets cold. It names the COMMAND and the AGE, because
 * those are the two things a marker found by somebody who did not start it has
 * to answer: what was being verified, and how long ago did it stop.
 */
export function formatMarkerReport(scan) {
  const out = [];
  out.push(`\n[verify] ${scan.scanned} verification marker(s) in ${scan.dir}`);
  if (scan.scanned === 0) {
    // NON-VACUITY, SAID OUT LOUD. An empty directory satisfies "nothing is
    // stale" and is also what a machine that has never run a wrapped
    // verification looks like. Those are different facts and the reader gets
    // told which one this is.
    out.push('    none — so this checked NOTHING. An empty directory is what a tree with no');
    out.push('    interrupted run looks like AND what a tree where nothing was ever wrapped');
    out.push('    looks like. Wrap verifications with `watchdog.mjs --budget` or this is silent.');
    return out.join('\n');
  }
  for (const row of scan.rows) {
    const marker = row.marker;
    const command = marker === null ? '(unreadable)' : (marker.command ?? []).join(' ');
    const mark = isFinding(row.state) ? '!!' : '  ';
    out.push(`  ${mark} ${row.state}  ${humanAge(row.ageSeconds)}  ${command}`);
    out.push(`       ${row.why}`);
    if (marker !== null) {
      const budget = marker.budgetSeconds === undefined ? '?' : marker.budgetSeconds;
      out.push(
        `       started ${marker.startedAtIso ?? '?'}  budget ${budget}s  commit ${(marker.commit ?? '???????').slice(0, 7)}`
          + `  branch ${marker.branch ?? '?'}  ${marker.dirty === null ? 'dirty?' : marker.dirty === 0 ? 'clean' : `DIRTY ${marker.dirty}`}`,
      );
      if (marker.interruption !== undefined) out.push(`       interruption: ${marker.interruption}`);
    }
    out.push(`       ${row.path}`);
  }
  if (scan.findings.length > 0) {
    out.push(`\n  !! ${scan.findings.length} verification(s) started and never wrote a verdict.`);
    out.push('     THE RESULT OF EACH IS UNKNOWN. It is not a pass. Re-run the command named');
    out.push('     above, or read the record and clear it with `--markers --clear-stale`.');
  }
  return out.join('\n');
}

/** Deletes exactly the findings. A LIVE marker is never touched. */
export function clearStale(scan) {
  const removed = [];
  for (const row of scan.findings) {
    try {
      unlinkSync(row.path);
      removed.push(row.path);
    } catch {
      // Already gone.
    }
  }
  return removed;
}
