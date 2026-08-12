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
 * WHERE MARKERS LIVE, AND WHY `/tmp` AND THE REPOSITORY ARE BOTH INSUFFICIENT
 * ===========================================================================
 * `.gauntlet/verify/` — inside the repository, gitignored. That was chosen on
 * the reasoning that *"the scratchpad under `/tmp` does not survive a rewind;
 * the repo does."*
 *
 * THE FIRST HALF IS TRUE AND THE SECOND HALF IS FALSE, ruled by a human after
 * the gap was observed. A rewind reverts the whole working tree and
 * `.gauntlet/verify/` goes with it — gitignored files included, because this is
 * not a git operation, it is the filesystem going back. Every time it has
 * happened the tree came back with `tools/watchdog.mjs` giving
 * `MODULE_NOT_FOUND`, no marker directory and no `*.verify.log`. So the marker
 * as first built protected against process-death-with-surviving-disk, which has
 * been observed ZERO times here, and not against tree death, which has been
 * observed seventeen.
 *
 * ORIGIN IS THE ONLY THING THAT HAS EVER SURVIVED A REWIND — sole surviving
 * copy ten times. So the record is ALSO pushed to origin, PERIODICALLY WHILE
 * THE RUN IS IN FLIGHT. Completion-time sync is not sufficient and repeats the
 * original error one level out: a run that dies mid-flight is exactly the run
 * that never reaches its completion step, which is the same reason the local
 * marker is written BEFORE the spawn rather than after the return.
 *
 * See `VERIFY_SYNC` below for every tuned number, and the section headed
 * "SYNCING TO ORIGIN" for the ref layout, the race handling and the limits.
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
import { execFile, execFileSync } from 'node:child_process';
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

/**
 * EVERY TUNED VALUE THE ORIGIN SYNC HAS, IN ONE PLACE. Same rule as above; a
 * playtester or a lead who wants a different cadence changes one number here.
 */
export const VERIFY_SYNC = Object.freeze({
  /** Which git remote. `off` disables the whole mechanism. */
  REMOTE: 'origin',
  DISABLED: 'off',
  /** Testing seams, and the only two. */
  ENV_REMOTE: 'VERIFY_SYNC_REMOTE',
  ENV_INTERVAL_SECONDS: 'VERIFY_SYNC_INTERVAL_SECONDS',

  /**
   * `refs/heads/`, WHICH IS NOT A DESIGN CHOICE — IT IS THE ONLY NAMESPACE THIS
   * ENVIRONMENT CAN WRITE. Measured against the real origin before anything was
   * built on it:
   *
   *     refs/verify/<host>/<id>   -> HTTP 403
   *     refs/notes/verify-probe   -> HTTP 403
   *     refs/tags/verify-probe-1  -> HTTP 403
   *     refs/heads/verify/vm/...  -> [new branch], accepted
   *     any delete, any namespace -> HTTP 403
   *
   * A dedicated `refs/verify/*` namespace would have kept this out of the branch
   * list, which is what a reader would expect to see here; it is unavailable.
   * So the record lives on branches, and the two consequences are paid for
   * deliberately:
   *
   *   - ONE REF PER HOST, NOT ONE PER RUN, so the branch list grows by hosts
   *     rather than by verifications. The ref's tree holds one `<id>.json` per
   *     run.
   *   - THE TREE IS PRUNED INSTEAD OF THE REF, because refs cannot be deleted
   *     here but tree entries can. `REMOTE_COMPLETED_KEPT` below is that
   *     retention, and it never touches an INCOMPLETE record — same rule as
   *     `pruneCompleted`, one layer out.
   */
  REF_PREFIX: 'verify-markers',
  /** Where a fetch parks them locally. Local refs are unrestricted. */
  LOCAL_REF_PREFIX: 'refs/verify-sync',
  RECORD_FILE_SUFFIX: '.json',

  /**
   * How often a live run re-pushes its record. Often enough that a tree death
   * loses at most this much knowledge of the run; rare enough that a 560 s
   * browser verification costs ~9 pushes rather than hundreds.
   */
  INTERVAL_SECONDS: 60,

  /** Hard cap on ONE git network call. */
  NETWORK_TIMEOUT_SECONDS: 20,
  /**
   * Hard cap on ONE WHOLE SYNC including retries, checked before each attempt.
   * Bounds how long the final sync can delay the wrapper's exit.
   */
  TOTAL_TIMEOUT_SECONDS: 45,

  /**
   * Retries, and ONLY on a non-fast-forward rejection. Three sessions share
   * this repository and two of them are on this host, so two wrappers pushing
   * to one host ref is an ordinary event, not an error: refetch, replay our own
   * record onto the new tip, push again. An unreachable remote is NOT retried —
   * it is reported, because a run must not be delayed by a network that is down.
   */
  PUSH_ATTEMPTS: 4,
  PUSH_BACKOFF_BASE_MS: 250,

  /** Completed records kept in the remote tree. INCOMPLETE ones are never cut. */
  REMOTE_COMPLETED_KEPT: 40,
  /** Sync failures kept in the local record, newest last. */
  SYNC_ERRORS_RECORDED: 5,
  /** Cap on any error string copied into a record. */
  ERROR_CHARS_RECORDED: 300,

  /** `commit-tree` needs an identity and must never inherit a human's. */
  IDENTITY: Object.freeze({ name: 'verify-marker', email: 'verify-marker@localhost' }),
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
  /**
   * REMOTE-ONLY STATES. Neither is a finding, and each says why in its own
   * name rather than being folded into a local state that means something else.
   */
  REMOTE_ANOTHER_HOST: 'REMOTE_ANOTHER_HOST',
  REMOTE_SUPERSEDED_BY_LOCAL: 'REMOTE_SUPERSEDED_BY_LOCAL',
});

/** What a remote scan managed to do. Only `READ` is an answer. */
export const REMOTE_SCAN_STATE = Object.freeze({
  READ: 'READ',
  DISABLED: 'DISABLED',
  UNREACHABLE: 'UNREACHABLE',
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
// SYNCING TO ORIGIN — the half that outlives the tree
// ---------------------------------------------------------------------------
//
// LAYOUT.  One ref per host: `refs/heads/<REF_PREFIX>/<slug(host)>`. Its tree is
// flat and holds one `<marker id>.json` per run, byte-identical to the local
// record at the instant it was pushed. There is no history worth keeping, but
// each push is a child of the fetched tip anyway so the push is a fast-forward
// and two sessions cannot silently clobber each other.
//
// WHY A HOST REF AND NOT A RUN REF.  Refs cannot be deleted here (403 on every
// namespace, measured), so one ref per run is a branch list that grows forever
// with nothing able to prune it. Tree ENTRIES can be pruned, so the retention
// lives one level in.
//
// THE RACE, AND WHY IT IS ORDINARY.  Two wrappers on one host share one ref.
// Each writes only its own `<id>.json` and copies the rest forward, so a lost
// push is a lost race and not a lost record: refetch, replay, push. Retries are
// bounded by `PUSH_ATTEMPTS` and the whole sync by `TOTAL_TIMEOUT_SECONDS`.
//
// SYNCHRONOUS VERSUS ASYNCHRONOUS, deliberately split.  The three NETWORK calls
// (`ls-remote`, `fetch`, `push`) are async, because the wrapper's own budget
// timer lives on the same event loop and a blocking 20 s network call would
// push its SIGKILL 20 s late — which is the guard failing quietly. The local
// object calls (`hash-object`, `ls-tree`, `cat-file`, `mktree`, `commit-tree`)
// are synchronous and cost milliseconds.
//
// WHAT THIS CANNOT COVER — limits, not caveats:
//
//   - THE FIRST PUSH IS NOT INSTANT. The marker is on local disk before the
//     spawn; it reaches origin one round trip later. A tree death inside that
//     window leaves nothing on origin, exactly as before. The window is one
//     push, not one run, which is the whole improvement — but it is not zero
//     and no amount of cadence makes it zero.
//   - A RUN WHOSE PUSH NEVER SUCCEEDS IS LOCAL-ONLY. That is reported loudly
//     at the end of the run and recorded in the marker (`sync.errors`); it is
//     never allowed to fail the verification it is recording.
//   - COMPLETED RECORDS ACCUMULATE ON ORIGIN. They are pruned from the tree at
//     `REMOTE_COMPLETED_KEPT`, but the ref itself can never be removed.
//   - IT SAYS NOTHING ABOUT ANOTHER HOST'S PROCESSES. `/proc` here describes
//     this machine, so a record from another host is reported and not counted.

export function syncRemoteFor(env = process.env) {
  const override = env[VERIFY_SYNC.ENV_REMOTE];
  return override === undefined || override === '' ? VERIFY_SYNC.REMOTE : override;
}

export function syncIntervalSecondsFor(env = process.env) {
  const override = Number(env[VERIFY_SYNC.ENV_INTERVAL_SECONDS]);
  return Number.isFinite(override) && override > 0 ? override : VERIFY_SYNC.INTERVAL_SECONDS;
}

export function syncEnabled(env = process.env) {
  return syncRemoteFor(env) !== VERIFY_SYNC.DISABLED;
}

/**
 * THE REF MAPPING, IN ONE PAIR OF FUNCTIONS BUILT FROM ONE PAIR OF ROOTS.
 *
 * It was three expressions for about an hour and two of them disagreed: the
 * push wrote `refs/verify-sync/verify-markers/vm`, the fetch refspec wrote
 * `refs/verify-sync/vm`, and the clear path derived `refs/heads/vm` — a ref
 * nothing had ever written. Nothing failed; the scan simply read a ref the
 * writer had not filled. That is this repository's most-recorded defect shape
 * (a decision written twice, the second copy while the first was still fresh
 * enough to feel solved), so the roots are literals in one place and the four
 * users below are derived from them. `verifyMarker.test.ts`'s
 * "the ref mapping round-trips" is what goes red if they drift again.
 */
const REMOTE_REF_ROOT = `refs/heads/${VERIFY_SYNC.REF_PREFIX}/`;
const LOCAL_REF_ROOT = `${VERIFY_SYNC.LOCAL_REF_PREFIX}/`;
/** The one refspec, used by the writer's fetch and the scanner's fetch alike. */
export const VERIFY_SYNC_REFSPEC = `+${REMOTE_REF_ROOT}*:${LOCAL_REF_ROOT}*`;

export function remoteRefForHost(host) {
  return `${REMOTE_REF_ROOT}${slug(host) === '' ? 'unknown-host' : slug(host)}`;
}

export function localCacheRefFor(remoteRef) {
  return `${LOCAL_REF_ROOT}${remoteRef.slice(REMOTE_REF_ROOT.length)}`;
}

export function remoteRefForCacheRef(localRef) {
  return `${REMOTE_REF_ROOT}${localRef.slice(LOCAL_REF_ROOT.length)}`;
}

export function hostOfCacheRef(localRef) {
  return localRef.slice(LOCAL_REF_ROOT.length);
}

/**
 * `commit-tree` refuses without an identity, and it must never inherit the
 * human's: these commits are machine bookkeeping and should read as such in
 * anyone's log.
 */
const GIT_IDENTITY_ENV = Object.freeze({
  GIT_AUTHOR_NAME: VERIFY_SYNC.IDENTITY.name,
  GIT_AUTHOR_EMAIL: VERIFY_SYNC.IDENTITY.email,
  GIT_COMMITTER_NAME: VERIFY_SYNC.IDENTITY.name,
  GIT_COMMITTER_EMAIL: VERIFY_SYNC.IDENTITY.email,
});

/** Local object-database calls. Milliseconds; blocking is correct here. */
function gitLocal(root, args, input = undefined) {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    input,
    env: { ...process.env, ...GIT_IDENTITY_ENV },
    maxBuffer: 16 * 1024 * 1024,
  });
}

/** Network calls. Never blocking — see the section header. */
function gitNetwork(root, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      ['-C', root, ...args],
      { encoding: 'utf8', timeout: timeoutMs, killSignal: 'SIGKILL', maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error === null) resolve({ stdout, stderr });
        else reject(Object.assign(error, { stdout, stderr }));
      },
    );
  });
}

function describeGitError(error) {
  const text = `${String(error && error.message ? error.message : error)} ${String((error && error.stderr) ?? '')}`;
  return text.replace(/\s+/g, ' ').trim().slice(0, VERIFY_SYNC.ERROR_CHARS_RECORDED);
}

/**
 * A push rejected because somebody else got there first is the ONE retryable
 * failure. Everything else — no network, no credentials, no such remote — is
 * reported immediately rather than retried, so a dead network cannot delay a
 * verification by four round trips.
 */
function isLostRace(error) {
  const text = `${String((error && error.stderr) ?? '')}${String((error && error.message) ?? '')}`;
  return /non-fast-forward|\[rejected\]|fetch first|cannot lock ref|failed to lock/i.test(text);
}

const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- tree plumbing ---------------------------------------------------------

function treeEntriesOf(root, commitish) {
  let raw;
  try {
    raw = gitLocal(root, ['ls-tree', commitish]);
  } catch {
    return [];
  }
  const entries = [];
  for (const line of raw.split('\n')) {
    if (line === '') continue;
    const [meta, name] = line.split('\t');
    const [mode, type, sha] = meta.split(/\s+/);
    if (mode === undefined || type === undefined || sha === undefined || name === undefined) continue;
    entries.push({ mode, type, sha, name });
  }
  return entries;
}

function blobJson(root, sha) {
  try {
    return JSON.parse(gitLocal(root, ['cat-file', 'blob', sha]));
  } catch {
    return null;
  }
}

/**
 * RETENTION, AND THE ARM NOBODY WATCHES IS THE ONE THAT MATTERS. Identical rule
 * to `pruneCompleted` one layer out: every INCOMPLETE record survives whatever
 * the count, because age is not evidence that an interruption was dealt with,
 * and an unreadable one survives too because "I could not parse it" is not
 * "it was finished". Only real verdicts are cut, newest first.
 */
export function retainedRemoteEntries(root, entries) {
  const incomplete = [];
  const completed = [];
  for (const entry of entries) {
    const record = blobJson(root, entry.sha);
    const isVerdict =
      record !== null
      && (record.status === VERIFY_MARKER.STATUS.PASS || record.status === VERIFY_MARKER.STATUS.FAIL);
    if (!isVerdict) {
      incomplete.push(entry);
    } else {
      completed.push({ entry, startedAtMs: typeof record.startedAtMs === 'number' ? record.startedAtMs : 0 });
    }
  }
  completed.sort((a, b) => b.startedAtMs - a.startedAtMs);
  return [...incomplete, ...completed.slice(0, VERIFY_SYNC.REMOTE_COMPLETED_KEPT).map((c) => c.entry)];
}

function buildTree(root, entries) {
  const text = entries
    .slice()
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map((e) => `${e.mode} ${e.type} ${e.sha}\t${e.name}`)
    .join('\n');
  // `mktree` reads a BLANK LINE as an end-of-batch marker and refuses it outside
  // batch mode, so a trailing newline on an empty list is a fatal error rather
  // than the empty tree. Reached by clearing the last stale record off a host
  // ref, which is the whole point of the clear path.
  return gitLocal(root, ['mktree'], text === '' ? '' : `${text}\n`).trim();
}

function commitTree(root, tree, parent, message) {
  const args = ['commit-tree', tree, '-m', message];
  if (parent !== null) args.push('-p', parent);
  return gitLocal(root, args).trim();
}

// --- the write side --------------------------------------------------------

/**
 * Push one marker record onto its host's ref. Returns a plain result object and
 * NEVER throws: a sync failure must not fail the verification it is recording.
 */
export async function syncMarkerToRemote({ root, marker, env = process.env, nowMs = Date.now() }) {
  const remote = syncRemoteFor(env);
  if (remote === VERIFY_SYNC.DISABLED) {
    return { attempted: false, ok: false, remote, ref: null, state: REMOTE_SCAN_STATE.DISABLED, attempts: 0, error: null };
  }
  const host = marker?.runner?.host ?? os.hostname();
  const ref = remoteRefForHost(host);
  const localRef = localCacheRefFor(ref);
  const recordName = `${marker.id}${VERIFY_SYNC.RECORD_FILE_SUFFIX}`;
  const deadline = nowMs + VERIFY_SYNC.TOTAL_TIMEOUT_SECONDS * 1000;
  let attempts = 0;
  let lastError = null;

  for (let attempt = 1; attempt <= VERIFY_SYNC.PUSH_ATTEMPTS; attempt += 1) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      lastError = lastError ?? new Error(`sync exceeded ${VERIFY_SYNC.TOTAL_TIMEOUT_SECONDS}s`);
      break;
    }
    const callTimeout = Math.min(VERIFY_SYNC.NETWORK_TIMEOUT_SECONDS * 1000, remainingMs);
    attempts = attempt;
    try {
      // Does the host ref exist yet? `--exit-code` distinguishes "no such ref"
      // (2) from "could not ask" (anything else), which is the difference
      // between a first push and an unreachable remote.
      let parent = null;
      try {
        const listed = await gitNetwork(root, ['ls-remote', '--exit-code', remote, ref], callTimeout);
        parent = (listed.stdout.split('\t')[0] ?? '').trim() || null;
      } catch (error) {
        if (error && error.code === 2) parent = null;
        else throw error;
      }
      if (parent !== null) {
        await gitNetwork(
          root,
          ['fetch', '--quiet', '--no-tags', remote, `+${ref}:${localRef}`],
          Math.min(VERIFY_SYNC.NETWORK_TIMEOUT_SECONDS * 1000, Math.max(1, deadline - Date.now())),
        );
      }

      const carried = parent === null ? [] : treeEntriesOf(root, parent).filter((e) => e.name !== recordName);
      const blob = gitLocal(root, ['hash-object', '-w', '--stdin'], `${JSON.stringify(marker, null, 2)}\n`).trim();
      const tree = buildTree(root, [
        ...retainedRemoteEntries(root, carried),
        { mode: '100644', type: 'blob', sha: blob, name: recordName },
      ]);
      const commit = commitTree(root, tree, parent, `verify ${marker.status} ${marker.id}`);
      await gitNetwork(
        root,
        ['push', remote, `${commit}:${ref}`],
        Math.min(VERIFY_SYNC.NETWORK_TIMEOUT_SECONDS * 1000, Math.max(1, deadline - Date.now())),
      );
      return { attempted: true, ok: true, remote, ref, commit, state: REMOTE_SCAN_STATE.READ, attempts, error: null };
    } catch (error) {
      lastError = error;
      if (!isLostRace(error)) break;
      await sleepMs(VERIFY_SYNC.PUSH_BACKOFF_BASE_MS * attempt);
    }
  }
  return {
    attempted: true,
    ok: false,
    remote,
    ref,
    state: REMOTE_SCAN_STATE.UNREACHABLE,
    attempts,
    error: describeGitError(lastError),
  };
}

/**
 * ONE HEARTBEAT: stamp the local record, push it, then record what the push did.
 *
 * The pushed copy necessarily cannot know whether its own push succeeded — that
 * fact only exists afterwards — so the local record is the one that carries
 * `sync.ok`. The remote copy carries `sync.count` and `sync.lastAttemptIso`,
 * which is what makes it a heartbeat rather than a snapshot: a record found cold
 * on origin says when the run was last known to be alive.
 */
export async function heartbeatMarker(markerPath, { root, env = process.env, nowMs = Date.now(), reason = 'heartbeat' } = {}) {
  let marker;
  try {
    marker = JSON.parse(readFileSync(markerPath, 'utf8'));
  } catch (error) {
    return { ok: false, skipped: 'no local marker to sync', error: describeGitError(error) };
  }
  const previous = marker.sync ?? { count: 0, okCount: 0, errors: [] };
  const attempted = {
    ...marker,
    sync: {
      ...previous,
      count: (previous.count ?? 0) + 1,
      lastAttemptIso: new Date(nowMs).toISOString(),
      lastReason: reason,
      // Stamped on the copy that is PUSHED, so a record read cold off origin
      // names the ref it is sitting on rather than a `?`.
      remote: syncRemoteFor(env),
      ref: remoteRefForHost(marker?.runner?.host ?? os.hostname()),
    },
  };
  const result = await syncMarkerToRemote({ root, marker: attempted, env, nowMs });
  /**
   * RE-READ, NEVER WRITE BACK THE SNAPSHOT. A heartbeat that began before the
   * verdict was written holds a record whose status is INCOMPLETE, and writing
   * that object back CLOBBERS A REAL PASS — which was not theoretical: it left
   * finished runs reading INCOMPLETE locally and on origin, i.e. a permanent
   * false finding produced by the instrument that reports findings. Only the
   * `sync` field is this function's to write.
   */
  let current = attempted;
  try {
    current = { ...JSON.parse(readFileSync(markerPath, 'utf8')), sync: attempted.sync };
  } catch {
    current = attempted;
  }
  const settled = {
    ...current,
    sync: {
      ...current.sync,
      remote: result.remote,
      ref: result.ref,
      ok: result.ok,
      okCount: (previous.okCount ?? 0) + (result.ok ? 1 : 0),
      lastOkIso: result.ok ? new Date(Date.now()).toISOString() : (previous.lastOkIso ?? null),
      errors: result.ok
        ? (previous.errors ?? [])
        : [...(previous.errors ?? []), { at: new Date(Date.now()).toISOString(), why: result.error }].slice(
            -VERIFY_SYNC.SYNC_ERRORS_RECORDED,
          ),
    },
  };
  writeAtomic(markerPath, `${JSON.stringify(settled, null, 2)}\n`);
  return { ok: result.ok, result, marker: settled };
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

/**
 * THE REMOTE SCAN — THE RECOVERY SIDE, AND THE CASE THIS WHOLE MECHANISM EXISTS
 * FOR IS THE ONE WHERE THE LOCAL DIRECTORY IS EMPTY.
 *
 * A record on origin that nobody reads is worth nothing, so this runs as part
 * of the ordinary `--markers` scan rather than behind a flag somebody has to
 * remember after a rewind — the rewind is exactly when nobody remembers.
 *
 * TWO DELIBERATE DIFFERENCES FROM THE LOCAL RULES, both because a shared remote
 * is a different subject from this machine's disk:
 *
 *   - A FOREIGN HOST IS A FINDING LOCALLY AND IS NOT ONE HERE. A foreign-host
 *     record in this tree's own `.gauntlet/verify/` is anomalous — somebody
 *     else's marker on my disk. On a remote shared by three sessions it is the
 *     normal case, and counting it would make every session permanently red on
 *     every other session's work. It is REPORTED, in its own section, with the
 *     host named. `REMOTE_ANOTHER_HOST`.
 *   - A RECORD THIS TREE ALSO HOLDS IS NOT COUNTED TWICE. The local row is the
 *     fresher of the two and is the one that speaks; the remote copy is shown
 *     as `REMOTE_SUPERSEDED_BY_LOCAL` so the reader can see it arrived.
 *
 * AND ONE DELIBERATE NON-FINDING, WHICH IS THE WEAKEST THING HERE: a remote
 * that cannot be reached is reported as a NAMED SKIPPED CHECK and does not
 * change the exit code. Every other "I cannot tell" in this module is a
 * finding, and this one is not, because the alternative is that every offline
 * or rate-limited run of the whole suite goes red — the crying-wolf failure
 * this repository has already recorded for three instruments. The output says
 * out loud that the question was not asked.
 */
export function scanRemoteMarkers({
  root,
  nowMs = Date.now(),
  env = process.env,
  procRoot = '/proc',
  runner = currentRunner({ nowMs, procRoot }),
  localIds = new Set(),
} = {}) {
  const remote = syncRemoteFor(env);
  const base = { remote, refs: [], scanned: 0, rows: [], findings: [] };
  if (remote === VERIFY_SYNC.DISABLED) {
    return { ...base, state: REMOTE_SCAN_STATE.DISABLED, why: `${VERIFY_SYNC.ENV_REMOTE}=${VERIFY_SYNC.DISABLED}` };
  }
  // `--prune` ALSO DELETES A STRAY REF UNDER THIS DESTINATION NAMESPACE, which
  // is hygiene and is also why the writer's spelling must be read BEFORE
  // anything scans: a writer that fetched to a different destination has it
  // swept up here, so the drift is invisible in the steady state and costs only
  // a redundant fetch per push. `verifyMarker.test.ts`'s "writes and reads ONE
  // local cache ref" reads the writer's ref before this line runs, and it
  // survived the respelling mutant until it did.
  try {
    execFileSync('git', ['-C', root, 'fetch', '--quiet', '--no-tags', '--prune', remote, VERIFY_SYNC_REFSPEC], {
      encoding: 'utf8',
      timeout: VERIFY_SYNC.NETWORK_TIMEOUT_SECONDS * 1000,
      killSignal: 'SIGKILL',
      env: { ...process.env, ...GIT_IDENTITY_ENV },
    });
  } catch (error) {
    return { ...base, state: REMOTE_SCAN_STATE.UNREACHABLE, why: describeGitError(error) };
  }

  let refLines = '';
  try {
    refLines = gitLocal(root, ['for-each-ref', '--format=%(refname)%09%(objectname)', LOCAL_REF_ROOT]).trim();
  } catch (error) {
    return { ...base, state: REMOTE_SCAN_STATE.UNREACHABLE, why: describeGitError(error) };
  }

  const refs = refLines === '' ? [] : refLines.split('\n').map((line) => {
    const [refname, sha] = line.split('\t');
    return { ref: refname, sha, host: hostOfCacheRef(refname ?? '') };
  });

  const rows = [];
  for (const { ref, sha, host } of refs) {
    for (const entry of treeEntriesOf(root, sha)) {
      if (!entry.name.endsWith(VERIFY_SYNC.RECORD_FILE_SUFFIX)) continue;
      const marker = blobJson(root, entry.sha);
      const wrapped =
        marker === null || typeof marker !== 'object' || typeof marker.status !== 'string'
          ? { path: `${ref}:${entry.name}`, marker: null, parseError: 'not a marker record' }
          : marker.schema !== VERIFY_MARKER.SCHEMA
            ? { path: `${ref}:${entry.name}`, marker: null, parseError: `schema ${String(marker.schema)} is not ${VERIFY_MARKER.SCHEMA}` }
            : { path: `${ref}:${entry.name}`, marker, parseError: null };
      rows.push({
        ...wrapped,
        ref,
        refHost: host,
        ...classifyRemoteMarker(wrapped, { nowMs, runner, procRoot, localIds }),
        ageSeconds: wrapped.marker === null ? null : (nowMs - (wrapped.marker.startedAtMs ?? nowMs)) / 1000,
      });
    }
  }
  return {
    ...base,
    state: REMOTE_SCAN_STATE.READ,
    why: `${refs.length} host ref(s) on ${remote}`,
    refs,
    scanned: rows.length,
    rows,
    findings: rows.filter((r) => isFinding(r.state)),
  };
}

/**
 * The remote classifier, which is the local one plus the two exemptions the
 * section above names. The exemptions are checked FIRST and each returns, so
 * `classifyMarker`'s own foreign-host arm is unreachable from here — the two
 * rules cannot both apply to one row and disagree.
 */
export function classifyRemoteMarker(entry, { nowMs = Date.now(), runner, procRoot = '/proc', localIds = new Set() } = {}) {
  if (entry.marker !== null && entry.marker.status === VERIFY_MARKER.STATUS.INCOMPLETE) {
    if (typeof entry.marker.id === 'string' && localIds.has(entry.marker.id)) {
      return {
        state: MARKER_STATE.REMOTE_SUPERSEDED_BY_LOCAL,
        why: 'this tree holds the same record, and the local copy is the one counted above',
      };
    }
    const host = entry.marker.runner?.host;
    if (typeof host === 'string' && host !== runner.host) {
      return {
        state: MARKER_STATE.REMOTE_ANOTHER_HOST,
        why: `another session's run, on host ${host}; this is ${runner.host} and its /proc cannot answer for it`,
      };
    }
  }
  return classifyMarker(entry, { nowMs, runner, procRoot });
}

export function scanMarkers({ root, nowMs = Date.now(), env = process.env, procRoot = '/proc', remote = true } = {}) {
  const dir = markerDirFor(root, env);
  const runner = currentRunner({ nowMs, procRoot });
  const rows = readMarkerFiles(dir).map((entry) => ({
    ...entry,
    ...classifyMarker(entry, { nowMs, runner, procRoot }),
    ageSeconds: entry.marker === null ? null : (nowMs - (entry.marker.startedAtMs ?? nowMs)) / 1000,
  }));
  const localIds = new Set(rows.map((r) => r.marker?.id).filter((id) => typeof id === 'string'));
  return {
    dir,
    scanned: rows.length,
    rows,
    findings: rows.filter((r) => isFinding(r.state)),
    remote: remote
      ? scanRemoteMarkers({ root, nowMs, env, procRoot, runner, localIds })
      : { remote: syncRemoteFor(env), state: REMOTE_SCAN_STATE.DISABLED, why: '--no-remote', refs: [], scanned: 0, rows: [], findings: [] },
  };
}

/**
 * THE ONE PLACE THE EXIT CODE IS DECIDED, with two callers in `watchdog.mjs`.
 * Written as a function rather than as `scan.findings.length` at each call site
 * because that expression stayed CORRECT-LOOKING and silently wrong the moment
 * a second source of findings existed — which is this repository's
 * most-recorded defect shape, a guard applied to one arm and not its sibling.
 */
export function findingCount(scan) {
  return scan.findings.length + (scan.remote?.findings.length ?? 0);
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
function formatRow(out, row) {
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
    if (marker.sync !== undefined && marker.sync !== null) {
      out.push(
        `       last heartbeat ${marker.sync.lastAttemptIso ?? '?'} (sync ${String(marker.sync.okCount ?? '?')}/${String(marker.sync.count ?? '?')} to ${String(marker.sync.remote ?? '?')})`,
      );
    }
  }
  out.push(`       ${row.path}`);
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
    // told which one this is. AFTER A REWIND IT IS ALSO WHAT A TREE THAT LOST
    // ITS MARKERS LOOKS LIKE, which is what the origin section below is for.
    out.push('    none — so this LOCAL scan checked NOTHING. An empty directory is what a tree');
    out.push('    with no interrupted run looks like, what a tree where nothing was ever');
    out.push('    wrapped looks like, AND what a tree that was rewound looks like. The origin');
    out.push('    section below is the one that can tell the third case from the first two.');
  }
  for (const row of scan.rows) formatRow(out, row);
  if (scan.findings.length > 0) {
    out.push(`\n  !! ${scan.findings.length} verification(s) started and never wrote a verdict.`);
    out.push('     THE RESULT OF EACH IS UNKNOWN. It is not a pass. Re-run the command named');
    out.push('     above, or read the record and clear it with `--markers --clear-stale`.');
  }
  out.push(...formatRemoteSection(scan.remote));
  return out.join('\n');
}

export function formatRemoteSection(remote) {
  const out = [];
  if (remote === undefined || remote === null) return out;
  if (remote.state === REMOTE_SCAN_STATE.DISABLED) {
    out.push(`\n[verify:origin] SKIPPED — the origin scan did not run (${remote.why}).`);
    out.push('    So NOTHING here is known about verifications that died with the tree. This');
    out.push('    is the case the local scan above cannot see and is not covering for it.');
    return out;
  }
  if (remote.state === REMOTE_SCAN_STATE.UNREACHABLE) {
    // A NAMED SKIPPED CHECK, not a quiet fallback. It does not change the exit
    // code, and the reason is in `scanRemoteMarkers`'s header: every offline run
    // going red is the crying-wolf failure, and a check nobody reads catches
    // nothing. What it must never do is look like an answer.
    out.push(`\n[verify:origin] SKIPPED — could not read ${remote.remote}.`);
    out.push(`    ${remote.why}`);
    out.push('    THIS IS NOT A PASS AND IT IS NOT COUNTED. The durable half of the record');
    out.push('    was not consulted, so an interrupted run that died with a tree would not');
    out.push('    appear here. Re-run when the remote is reachable.');
    return out;
  }
  out.push(`\n[verify:origin] ${remote.scanned} record(s) on ${remote.remote} across ${remote.refs.length} host ref(s)`);
  if (remote.scanned === 0) {
    out.push('    none — origin holds no verification record at all. That is what a repository');
    out.push('    where nothing has ever been wrapped looks like, so this checked NOTHING.');
    return out;
  }
  for (const row of remote.rows) formatRow(out, row);
  if (remote.findings.length > 0) {
    out.push(`\n  !! ${remote.findings.length} verification(s) on ${remote.remote} started and never wrote a verdict.`);
    out.push('     THE RESULT OF EACH IS UNKNOWN. It is not a pass — and these are the ones');
    out.push('     that SURVIVED THE TREE. A rewind takes .gauntlet/verify/ with it, gitignored');
    out.push('     files included, so a record here with nothing beside it locally is the case');
    out.push('     this section exists for. Read it, re-run what it names, then clear it with');
    out.push('     `--markers --clear-stale`.');
  }
  return out;
}

/** Deletes exactly the local findings. A LIVE marker is never touched. */
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

/**
 * THE REMOTE SIBLING OF `clearStale`, and it exists because a record that
 * cannot be cleared becomes a permanent false alarm — the failure this
 * repository has recorded for three instruments and which turns
 * `--markers --clear-stale` into a ritual.
 *
 * It cannot delete the ref (403 here, on every namespace, measured). It removes
 * the ENTRY from the host's tree and pushes the result, which is the same
 * effect one level in. Only rows the scan already called findings are removed,
 * so another session's record and a LIVE one are untouched by construction.
 */
export async function clearRemoteStale({ root, scan, env = process.env, nowMs = Date.now(), alsoIds = new Set() }) {
  const remote = scan.remote;
  if (remote === undefined || remote.state !== REMOTE_SCAN_STATE.READ) {
    return { removed: [], ok: true, error: null };
  }
  /**
   * THE BRANCH IMMEDIATELY BELOW THE ONE ABOVE, WHICH IS WHERE THIS
   * REPOSITORY'S GUARDS KEEP GOING MISSING — and this one was missing for
   * twenty minutes.
   *
   * A record present in BOTH places is classified `REMOTE_SUPERSEDED_BY_LOCAL`
   * and is therefore NOT in `remote.findings`, by design: the local row is the
   * one counted. So clearing the local file and then clearing "the remote
   * findings" leaves the origin copy standing, the next scan reports it again,
   * and `--clear-stale` becomes a ritual that has to be run twice — the exact
   * permanent-false-alarm shape this file argues against elsewhere.
   *
   * `alsoIds` is the ids the local clear just removed. They are cleared here on
   * the caller's say-so rather than re-derived, because after the local delete
   * the evidence for "this was a finding" no longer exists on disk.
   */
  const doomed = remote.rows.filter(
    (row) => isFinding(row.state) || (typeof row.marker?.id === 'string' && alsoIds.has(row.marker.id)),
  );
  if (doomed.length === 0) return { removed: [], ok: true, error: null };
  const byRef = new Map();
  for (const row of doomed) {
    const names = byRef.get(row.ref) ?? new Set();
    names.add(row.path.slice(`${row.ref}:`.length));
    byRef.set(row.ref, names);
  }
  const removed = [];
  let error = null;
  for (const [localRef, names] of byRef) {
    const pushRef = remoteRefForCacheRef(localRef);
    try {
      const parent = gitLocal(root, ['rev-parse', localRef]).trim();
      const kept = treeEntriesOf(root, parent).filter((e) => !names.has(e.name));
      const tree = buildTree(root, kept);
      const commit = commitTree(root, tree, parent, `verify cleared ${names.size} stale record(s)`);
      await gitNetwork(
        root,
        ['push', syncRemoteFor(env), `${commit}:${pushRef}`],
        VERIFY_SYNC.NETWORK_TIMEOUT_SECONDS * 1000,
      );
      gitLocal(root, ['update-ref', localRef, commit]);
      for (const name of names) removed.push(`${pushRef}:${name}`);
    } catch (caught) {
      error = describeGitError(caught);
    }
  }
  return { removed, ok: error === null, error, nowMs };
}
