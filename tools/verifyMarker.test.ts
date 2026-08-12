/**
 * verifyMarker.test.ts — the checks that make an INCOMPLETE marker bite.
 *
 * ===========================================================================
 * WHY THIS FILE IS IN `tools/` AND NOT IN `src/`
 * ===========================================================================
 * The subject is `tools/verifyMarker.mjs` and `tools/watchdog.mjs`, and
 * CLAUDE.md asks for a test colocated with its module. It runs because
 * `vitest.config.ts`'s `include` names `tools/**‍/*.test.ts` as well as `src/`;
 * that edit is not cosmetic, because `progression.test.ts`'s "drops from the
 * sweep exactly the files vitest runs" asserts the set of compiled-but-unswept
 * files EQUALS the set vitest executes. A `.test.ts` here that vitest did not
 * run would go red there, which is the guard working.
 *
 * ===========================================================================
 * EVERY CHECK DRIVES THE REAL TOOL AS A SUBPROCESS
 * ===========================================================================
 * Nothing here imports the module under test. The entry point a human and a
 * wave actually use is `node tools/watchdog.mjs`, so that is the subject: the
 * argument parsing, the write ordering, the exit codes and the report text are
 * all in scope rather than only the functions behind them.
 *
 * TWO KINDS OF INTERRUPTION ARE PRODUCED FOR REAL, not simulated by writing a
 * file by hand: a `SIGKILL` delivered to a running wrapper, and a command that
 * outlives its budget. A hand-placed marker cannot exercise the write-before-
 * start ordering, which is the part the ruling is about. Hand-planted records
 * appear only where the STATE cannot be produced on demand — a marker from a
 * previous boot, and a torn record.
 *
 * ===========================================================================
 * WHAT THESE CHECKS DO NOT COVER — declared, not implied
 * ===========================================================================
 *   - The repository-scan check at the end has an EMPTY DOMAIN when the suite
 *     is run without a wrapper, because then no marker exists at all. It says
 *     so in its own message rather than reading as coverage. The checks that
 *     bite are the ones above it, which build their domain.
 *   - Nothing here can prove the marker survives a container restart, because
 *     nothing here can restart the container. What is proved is the two
 *     properties that restart depends on: the record is on disk and fsynced
 *     before the command starts, and a record whose boot identity differs from
 *     this machine's is a finding even when its pid is alive.
 */
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '..');
const WATCHDOG = path.join(REPO_ROOT, 'tools', 'watchdog.mjs');
const MARKER_MODULE = path.join(REPO_ROOT, 'tools', 'verifyMarker.mjs');

/**
 * EVERY TIMING THIS FILE USES, IN ONE PLACE. They are test-harness values
 * rather than game feel, and the same rule applies: a playtester who slows the
 * marker write down changes one number here, not eleven call sites.
 */
const MARKER_TEST_TIMING = {
  /** How long a wrapped command sleeps when the test needs it still running. */
  CHILD_LIFE_MS: 4000,
  /** A budget no test command can reach, so the wrapper never kills anything. */
  LONG_BUDGET_S: 120,
  /** A budget every test command exceeds, so the wrapper always kills it. */
  TINY_BUDGET_S: 1,
  /** Poll interval and ceiling while waiting for the marker to appear. */
  POLL_MS: 20,
  MARKER_WAIT_MS: 8000,
  /** Ceiling on waiting for a killed wrapper to be gone from the process table. */
  REAPED_WAIT_MS: 4000,
  /** Per-test budget for the cases that spawn and wait. */
  SLOW_CASE_MS: 25_000,
} as const;

const MARKER_EXTENSION = '.verify.json';

/**
 * CONSTANTS ARE READ FROM THE MODULE, NEVER TRANSCRIBED, and a miss THROWS
 * rather than falling back. A `?? 'off'` here would turn a renamed constant
 * into a silently-still-passing suite, which is the same defect one level out.
 */
const MARKER_MODULE_SOURCE = readFileSync(path.join(REPO_ROOT, 'tools', 'verifyMarker.mjs'), 'utf8');
function moduleConstant(pattern: RegExp, what: string): string {
  const found = pattern.exec(MARKER_MODULE_SOURCE)?.[1];
  if (found === undefined) throw new Error(`${what} could not be read from verifyMarker.mjs`);
  return found;
}
const SYNC_OFF = moduleConstant(/DISABLED:\s*'([^']+)'/, 'VERIFY_SYNC.DISABLED');
const SYNC_REF_PREFIX = moduleConstant(/REF_PREFIX:\s*'([^']+)'/, 'VERIFY_SYNC.REF_PREFIX');
const SYNC_LOCAL_REF_PREFIX = moduleConstant(/LOCAL_REF_PREFIX:\s*'([^']+)'/, 'VERIFY_SYNC.LOCAL_REF_PREFIX');
const SYNC_RECORD_SUFFIX = moduleConstant(/RECORD_FILE_SUFFIX:\s*'([^']+)'/, 'VERIFY_SYNC.RECORD_FILE_SUFFIX');
const REMOTE_COMPLETED_KEPT = Number(
  moduleConstant(/REMOTE_COMPLETED_KEPT:\s*(\d+)/, 'VERIFY_SYNC.REMOTE_COMPLETED_KEPT'),
);

interface MarkerRunner {
  readonly pid: number;
  readonly startTick: string | null;
  readonly cmdline: string | null;
  readonly bootId: string | null;
  readonly bootEpochSeconds: number | null;
  readonly host: string;
  readonly platform: string;
  readonly procAvailable: boolean;
}

interface Marker {
  readonly schema: number;
  readonly status: string;
  readonly id: string;
  readonly command: readonly string[];
  readonly budgetSeconds: number;
  readonly startedAtIso: string;
  readonly startedAtMs: number;
  readonly commit: string | null;
  readonly branch: string | null;
  readonly dirty: number | null;
  readonly runner: MarkerRunner;
  readonly means: string;
  readonly interruption?: string;
  readonly exitCode?: number;
  readonly elapsedSeconds?: number;
  readonly sync?: MarkerSync;
}

/** The origin-sync bookkeeping the wrapper stamps on every heartbeat. */
interface MarkerSync {
  readonly count: number;
  readonly okCount: number;
  readonly ok?: boolean;
  readonly remote?: string;
  readonly ref?: string;
  readonly lastAttemptIso?: string;
  readonly lastOkIso?: string | null;
  readonly errors: readonly { readonly at: string; readonly why: string }[];
}

interface Run {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

function tempDir(prefix: string): string {
  return mkdtempSync(path.join(os.tmpdir(), prefix));
}

/**
 * `syncRemote` DEFAULTS TO `off`, AND THE DEFAULT IS THE LOAD-BEARING PART.
 *
 * Every check written before the origin sync existed is about the LOCAL record,
 * and running them against a real remote would make each one push to origin and
 * depend on a network. They are held at `off`, which the tool reports as a named
 * SKIPPED section. The sync checks below name their own remote — a bare
 * repository in a temp directory, so the whole git path is real and none of it
 * is the network.
 *
 * `null` means "use the shipped default", which is the real `origin`. Exactly
 * one check does that, and it says why.
 */
function watchdog(
  args: readonly string[],
  markerDir: string | null,
  cwd: string = REPO_ROOT,
  tool: string = WATCHDOG,
  syncRemote: string | null = SYNC_OFF,
): Run {
  const env = { ...process.env };
  if (markerDir === null) delete env.VERIFY_MARKER_DIR;
  else env.VERIFY_MARKER_DIR = markerDir;
  if (syncRemote === null) delete env.VERIFY_SYNC_REMOTE;
  else env.VERIFY_SYNC_REMOTE = syncRemote;
  const result = spawnSync('node', [tool, ...args], { cwd, encoding: 'utf8', env });
  return { status: result.status ?? -1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function markerFiles(dir: string): readonly string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(MARKER_EXTENSION))
    .sort()
    .map((name) => path.join(dir, name));
}

function markersIn(dir: string): readonly Marker[] {
  return markerFiles(dir).map((file) => JSON.parse(readFileSync(file, 'utf8')) as Marker);
}

function theOneMarker(dir: string): Marker {
  const all = markersIn(dir);
  expect(all.length, `expected exactly one marker in ${dir}, found ${all.length}`).toBe(1);
  const only = all[0];
  if (only === undefined) throw new Error('unreachable: length was asserted above');
  return only;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(what: string, predicate: () => boolean, ceilingMs: number): Promise<void> {
  const deadline = Date.now() + ceilingMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await sleep(MARKER_TEST_TIMING.POLL_MS);
  }
  expect.fail(`waited ${ceilingMs}ms for ${what} and it never happened`);
}

/** True while a pid is in this machine's process table at all. */
function pidExists(pid: number): boolean {
  return existsSync(path.join('/proc', String(pid)));
}

/** A command that stays alive long enough to be killed, and then gives up. */
const SLEEPING_COMMAND = ['node', '-e', `setTimeout(() => {}, ${MARKER_TEST_TIMING.CHILD_LIFE_MS})`];

// ---------------------------------------------------------------------------
// The ordering — the half a hand-placed file cannot test
// ---------------------------------------------------------------------------

describe('the marker is written before the command starts', () => {
  it('is already on disk, INCOMPLETE, by the time the wrapped command runs', () => {
    // THE WRAPPED COMMAND IS THE INSTRUMENT. It reads the marker directory and
    // prints what it found there, so the assertion below is about what existed
    // DURING the run rather than after it. Move `beginMarker` to after the
    // await in `watchdog.mjs` and this is the check that goes red — the whole
    // point of the ruling is that a marker written on completion is the one
    // that vanishes when the process dies.
    const dir = tempDir('verify-marker-ordering-');
    const reader = `
      const { readdirSync, readFileSync } = require('node:fs');
      const path = require('node:path');
      const dir = ${JSON.stringify(dir)};
      const names = readdirSync(dir).filter((n) => n.endsWith(${JSON.stringify(MARKER_EXTENSION)}));
      console.log('SAW ' + names.length);
      for (const n of names) console.log('STATUS ' + JSON.parse(readFileSync(path.join(dir, n), 'utf8')).status);
    `;
    const run = watchdog(
      ['--budget', String(MARKER_TEST_TIMING.LONG_BUDGET_S), '--label', 'ordering', '--', 'node', '-e', reader],
      dir,
    );

    expect(run.status, `the wrapped reader failed: ${run.stdout}${run.stderr}`).toBe(0);
    expect(run.stdout).toContain('SAW 1');
    expect(run.stdout).toContain('STATUS INCOMPLETE');
    // ...and only then did it become a verdict.
    expect(theOneMarker(dir).status).toBe('PASS');
  });

  it('records what a reader found cold needs: command, commit, branch, dirt, start, budget', () => {
    const dir = tempDir('verify-marker-contents-');
    watchdog(
      ['--budget', String(MARKER_TEST_TIMING.LONG_BUDGET_S), '--label', 'contents', '--', ...SLEEPING_COMMAND.slice(0, 2), 'process.exit(0)'],
      dir,
    );
    const marker = theOneMarker(dir);

    // Each field is compared against the fact itself, asked independently of
    // the tool. A marker that records its own defaults is a marker that lies
    // confidently the first time somebody reads one cold.
    const git = (args: readonly string[]): string =>
      execFileSync('git', ['-C', REPO_ROOT, ...args], { encoding: 'utf8' }).trim();
    const status = git(['status', '--porcelain']);
    expect(marker.commit).toBe(git(['rev-parse', 'HEAD']));
    expect(marker.branch).toBe(git(['rev-parse', '--abbrev-ref', 'HEAD']));
    expect(marker.dirty, 'the marker must record the tree it actually ran against').toBe(
      status === '' ? 0 : status.split('\n').length,
    );
    expect(marker.command).toEqual(['node', '-e', 'process.exit(0)']);
    expect(marker.budgetSeconds).toBe(MARKER_TEST_TIMING.LONG_BUDGET_S);
    expect(Number.isFinite(Date.parse(marker.startedAtIso))).toBe(true);
    expect(marker.runner.host).toBe(os.hostname());
    expect(marker.means).toContain('not a pass');
  });
});

// ---------------------------------------------------------------------------
// The incident, produced for real
// ---------------------------------------------------------------------------

describe('an interrupted verification leaves its marker standing', () => {
  it(
    'survives a SIGKILL delivered to the running wrapper, and then reads as a finding',
    async () => {
      // THIS IS INCIDENT 1, REPRODUCED. A wrapper is started, the marker is
      // waited for, and the wrapper's process group is SIGKILLed while the
      // command is still running — the container-restart case, minus the
      // container. Nothing gets a chance to write a verdict, which is the
      // whole hazard: what is left behind must not read as a pass.
      const dir = tempDir('verify-marker-sigkill-');
      const child = spawn(
        'node',
        [WATCHDOG, '--budget', String(MARKER_TEST_TIMING.LONG_BUDGET_S), '--label', 'killed', '--', ...SLEEPING_COMMAND],
        { cwd: REPO_ROOT, detached: true, stdio: 'ignore', env: { ...process.env, VERIFY_MARKER_DIR: dir } },
      );
      const wrapperPid = child.pid;
      expect(wrapperPid, 'the wrapper did not start').not.toBe(undefined);
      if (wrapperPid === undefined) throw new Error('unreachable: pid was asserted above');

      await waitFor('the marker to appear', () => markerFiles(dir).length === 1, MARKER_TEST_TIMING.MARKER_WAIT_MS);
      const live = theOneMarker(dir);
      expect(live.status).toBe('INCOMPLETE');
      expect(live.runner.pid).toBe(wrapperPid);

      // BOTH DIRECTIONS ON THE SAME FILE. While the wrapper is alive the marker
      // is LIVE and is not a finding; the only thing that changes below is that
      // the process stops existing. Nothing rewrites the record.
      const whileLive = watchdog(['--markers'], dir);
      expect(whileLive.stdout, whileLive.stdout).toContain('LIVE');
      expect(whileLive.status, 'a running verification must not be a finding').toBe(0);

      process.kill(-wrapperPid, 'SIGKILL');
      await waitFor('the wrapper to leave the process table', () => !pidExists(wrapperPid), MARKER_TEST_TIMING.REAPED_WAIT_MS);

      const after = theOneMarker(dir);
      expect(after.status, 'the record must be untouched by the kill').toBe('INCOMPLETE');
      expect(after.interruption, 'nothing was alive to record which interruption').toBe(undefined);

      const whileDead = watchdog(['--markers'], dir);
      expect(whileDead.status, 'an interrupted verification must fail the check').toBe(1);
      expect(whileDead.stdout).toContain('INTERRUPTED_PROCESS_GONE');
      // The message names the command and the age, because a marker found cold
      // has to answer what was being verified and how long ago it stopped.
      expect(whileDead.stdout).toContain(SLEEPING_COMMAND.join(' '));
      expect(whileDead.stdout).toMatch(/\d+s ago/);
      expect(whileDead.stdout).toContain('It is not a pass');
    },
    MARKER_TEST_TIMING.SLOW_CASE_MS,
  );

  it(
    'leaves it standing when the command outruns its budget',
    () => {
      // The other real interruption: the wrapper's own SIGKILL fires. It knows
      // which interruption happened, so it records that — and the status stays
      // INCOMPLETE, because a killed run produced no verdict about the code.
      const dir = tempDir('verify-marker-budget-');
      const run = watchdog(
        ['--budget', String(MARKER_TEST_TIMING.TINY_BUDGET_S), '--label', 'over-budget', '--', ...SLEEPING_COMMAND],
        dir,
      );
      expect(run.status, 'the wrapper reports a budget breach as 124').toBe(124);

      const marker = theOneMarker(dir);
      expect(marker.status).toBe('INCOMPLETE');
      expect(marker.interruption).toBe('BUDGET_EXCEEDED');

      const scan = watchdog(['--markers'], dir);
      expect(scan.status, `a budget breach must be a finding, and this scan said:\n${scan.stdout}`).toBe(1);
      expect(scan.stdout).toContain('BUDGET_EXCEEDED');
    },
    MARKER_TEST_TIMING.SLOW_CASE_MS,
  );

  it('leaves it standing when something else kills the command — the sibling arm', () => {
    // THE BRANCH IMMEDIATELY BELOW THE ONE ABOVE, which is where this
    // repository's guards keep going missing. A command killed by a signal that
    // is NOT this budget produced no verdict either, and the two arms are one
    // decision written twice. The command kills itself, so the case is
    // deterministic rather than raced.
    const dir = tempDir('verify-marker-signal-');
    const run = watchdog(
      ['--budget', String(MARKER_TEST_TIMING.LONG_BUDGET_S), '--label', 'signalled', '--', 'node', '-e', "process.kill(process.pid, 'SIGKILL')"],
      dir,
    );
    expect(run.stderr).toContain('was killed by SIGKILL');

    const marker = theOneMarker(dir);
    expect(marker.status, 'a signalled command is not a verdict').toBe('INCOMPLETE');
    expect(marker.interruption).toBe('SIGNAL');
    const signalScan = watchdog(['--markers'], dir);
    expect(signalScan.status, `a signalled run must be a finding:\n${signalScan.stdout}`).toBe(1);
  });

  it('leaves it standing when the command never started at all', () => {
    // The third interruption arm. A verification that could not launch is not a
    // failing verification; nothing was measured.
    const dir = tempDir('verify-marker-nostart-');
    const run = watchdog(
      ['--budget', String(MARKER_TEST_TIMING.LONG_BUDGET_S), '--label', 'no-such', '--', 'definitely-not-a-command-here'],
      dir,
    );
    expect(run.status).toBe(2);
    const marker = theOneMarker(dir);
    expect(marker.status).toBe('INCOMPLETE');
    expect(marker.interruption).toBe('COULD_NOT_START');
    const noStartScan = watchdog(['--markers'], dir);
    expect(noStartScan.status, `a run that never started must be a finding:\n${noStartScan.stdout}`).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// A verdict is a verdict, including a red one
// ---------------------------------------------------------------------------

describe('a completed verification replaces the marker with its verdict', () => {
  it('records a pass as PASS and a failure as FAIL, and neither is a finding', () => {
    // A FAILURE IS A COMPLETED VERIFICATION. Conflating it with an interruption
    // would make the loud signal — a red suite — arrive twice and the quiet one
    // mean nothing. The check that this is not conflated is the exit code
    // below: a FAIL marker leaves `--markers` green.
    const passDir = tempDir('verify-marker-pass-');
    const passRun = watchdog(
      ['--budget', String(MARKER_TEST_TIMING.LONG_BUDGET_S), '--', 'node', '-e', 'process.exit(0)'],
      passDir,
    );
    expect(passRun.status).toBe(0);
    expect(theOneMarker(passDir).status).toBe('PASS');
    expect(watchdog(['--markers'], passDir).status).toBe(0);

    const failDir = tempDir('verify-marker-fail-');
    const failRun = watchdog(
      ['--budget', String(MARKER_TEST_TIMING.LONG_BUDGET_S), '--', 'node', '-e', 'process.exit(3)'],
      failDir,
    );
    expect(failRun.status, "the wrapper passes the command's own exit code through").toBe(3);
    const marker = theOneMarker(failDir);
    expect(marker.status).toBe('FAIL');
    expect(marker.exitCode).toBe(3);
    const scan = watchdog(['--markers'], failDir);
    expect(scan.status, 'a failing verification is complete, not interrupted').toBe(0);
    expect(scan.stdout).toContain('COMPLETE');
  });

  it('prunes completed records and never an incomplete one', () => {
    // Retention is the one place a delete happens on a schedule, so the arm
    // that matters is the one nobody watches: an old INCOMPLETE record is the
    // evidence, and age is not evidence that it was dealt with.
    const dir = tempDir('verify-marker-prune-');
    mkdirSync(dir, { recursive: true });
    const keptCount = Number(
      /COMPLETED_KEPT:\s*(\d+)/.exec(readFileSync(MARKER_MODULE, 'utf8'))?.[1] ?? 'NaN',
    );
    // READ FROM THE MODULE, not transcribed: a playtester who changes the
    // retention gets a test that still plants more than it.
    expect(Number.isFinite(keptCount), 'COMPLETED_KEPT could not be read from the module').toBe(true);

    const plant = (name: string, marker: Record<string, unknown>): void =>
      writeFileSync(path.join(dir, `${name}${MARKER_EXTENSION}`), JSON.stringify(marker));
    for (let i = 0; i < keptCount + 5; i += 1) {
      plant(`old-${String(i).padStart(3, '0')}`, { schema: 1, status: 'PASS', id: `old-${i}`, startedAtMs: 1000 + i });
    }
    plant('ancient-incomplete', {
      schema: 1,
      status: 'INCOMPLETE',
      id: 'ancient-incomplete',
      command: ['npx', 'vitest', 'run'],
      startedAtMs: 1,
      budgetSeconds: 1,
      runner: { pid: 999_999, startTick: '1', cmdline: 'gone', bootId: 'gone', bootEpochSeconds: 1, host: os.hostname(), platform: 'linux', procAvailable: true },
    });
    const before = markerFiles(dir).length;
    expect(before, 'the domain this prunes over').toBe(keptCount + 6);

    watchdog(['--budget', String(MARKER_TEST_TIMING.LONG_BUDGET_S), '--', 'node', '-e', 'process.exit(0)'], dir);

    const names = markerFiles(dir).map((f) => path.basename(f));
    expect(names, 'the interrupted record must survive any retention rule').toContain(
      `ancient-incomplete${MARKER_EXTENSION}`,
    );
    // Counts, not bounds: kept completed records, plus the run just made, plus
    // the incomplete one that is never pruned.
    expect(names.length).toBe(keptCount + 2);
  });
});

// ---------------------------------------------------------------------------
// The discriminator, on states that cannot be produced on demand
// ---------------------------------------------------------------------------

describe('live versus stale', () => {
  const runnerOfThisProcess = (): MarkerRunner => {
    const stat = readFileSync(path.join('/proc', String(process.pid), 'stat'), 'utf8');
    const startTick = stat.slice(stat.lastIndexOf(')') + 1).trim().split(/\s+/)[19] ?? null;
    const uptime = Number(readFileSync('/proc/uptime', 'utf8').trim().split(/\s+/)[0]);
    return {
      pid: process.pid,
      startTick,
      cmdline: readFileSync(path.join('/proc', String(process.pid), 'cmdline'), 'utf8').replace(/\0/g, ' ').trim().slice(0, 200),
      bootId: readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim(),
      bootEpochSeconds: Math.round(Date.now() / 1000 - uptime),
      host: os.hostname(),
      platform: process.platform,
      procAvailable: true,
    };
  };

  const plantIncomplete = (dir: string, runner: MarkerRunner, extra: Record<string, unknown> = {}): void => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, `planted${MARKER_EXTENSION}`),
      JSON.stringify({
        schema: 1,
        status: 'INCOMPLETE',
        id: 'planted',
        command: ['npx', 'vitest', 'run'],
        budgetSeconds: 900,
        startedAtIso: new Date().toISOString(),
        startedAtMs: Date.now(),
        commit: 'deadbee',
        branch: 'claude/planted',
        dirty: 0,
        runner,
        ...extra,
      }),
    );
  };

  it('calls a marker from a different boot interrupted even though its pid is alive', () => {
    // INCIDENT 1'S ARM, AND THE ONE AGE CANNOT DO. This record's runner triple
    // is THIS process — pid, start tick and cmdline all resolve, and it is
    // seconds old — so every signal except the boot identity says LIVE. After a
    // container restart a pid is just an integer somebody else now holds.
    const dir = tempDir('verify-marker-boot-');
    const runner = runnerOfThisProcess();
    plantIncomplete(dir, { ...runner, bootId: '00000000-0000-4000-8000-000000000000' });

    const scan = watchdog(['--markers'], dir);
    expect(scan.status, `a marker from another boot must be a finding, and this scan said:\n${scan.stdout}`).toBe(1);
    expect(scan.stdout).toContain('INTERRUPTED_MACHINE_RESTARTED');
    expect(scan.stdout).toContain('different boot id');

    // The control, one field apart: same record, this machine's boot id.
    const control = tempDir('verify-marker-boot-control-');
    plantIncomplete(control, runner);
    const controlScan = watchdog(['--markers'], control);
    expect(controlScan.stdout, controlScan.stdout).toContain('LIVE');
    expect(controlScan.status, 'the control must be green or the case above proves nothing').toBe(0);
  });

  it('calls a marker whose boot instant is far from this one interrupted', () => {
    // The second boot leg, for a machine whose `boot_id` does not change across
    // restarts. Same construction: everything else says LIVE.
    const dir = tempDir('verify-marker-epoch-');
    const runner = runnerOfThisProcess();
    const tolerance = Number(
      /BOOT_EPOCH_TOLERANCE_SECONDS:\s*(\d+)/.exec(readFileSync(MARKER_MODULE, 'utf8'))?.[1] ?? 'NaN',
    );
    expect(Number.isFinite(tolerance), 'the tolerance could not be read from the module').toBe(true);
    plantIncomplete(dir, { ...runner, bootEpochSeconds: (runner.bootEpochSeconds ?? 0) - tolerance - 1 });

    const scan = watchdog(['--markers'], dir);
    expect(scan.status, `a boot instant ${tolerance + 1}s away must be a finding, and this scan said:\n${scan.stdout}`).toBe(1);
    expect(scan.stdout).toContain('INTERRUPTED_MACHINE_RESTARTED');

    // And one second inside the tolerance is not a reboot — the arm that stops
    // an NTP correction reading as an interruption.
    const inside = tempDir('verify-marker-epoch-inside-');
    plantIncomplete(inside, { ...runner, bootEpochSeconds: (runner.bootEpochSeconds ?? 0) - tolerance + 1 });
    const insideScan = watchdog(['--markers'], inside);
    expect(insideScan.status, `a clock correction inside the tolerance is not a reboot:\n${insideScan.stdout}`).toBe(0);
  });

  it('calls a live wrapper that has outrun its own budget overdue, not live', () => {
    // THE OTHER SIDE OF THE LIMIT THE MODULE'S HEADER DECLARES. It cannot tell a
    // live process making progress from one making none — but it does not stay
    // quiet about it forever. Past the marker's own budget plus the grace, a
    // process that is still alive means the wrapper's SIGKILL did not fire,
    // which is a defect in the guard rather than a slow command.
    //
    // Without this check that state is reachable and reported by nothing, which
    // is a branch of the classifier no test would have entered.
    const grace = Number(
      /OVERDUE_GRACE_SECONDS:\s*(\d+)/.exec(readFileSync(MARKER_MODULE, 'utf8'))?.[1] ?? 'NaN',
    );
    expect(Number.isFinite(grace), 'the grace could not be read from the module').toBe(true);
    const runner = runnerOfThisProcess();

    const dir = tempDir('verify-marker-overdue-');
    plantIncomplete(dir, runner, { budgetSeconds: 1, startedAtMs: Date.now() - (grace + 2) * 1000 });
    const scan = watchdog(['--markers'], dir);
    expect(scan.status, `an overdue live wrapper must be a finding, and this scan said:\n${scan.stdout}`).toBe(1);
    expect(scan.stdout).toContain('LIVE_OVERDUE');
    expect(scan.stdout).toContain("the wrapper's own kill did not fire");

    // The control: the same live process, inside budget plus grace.
    const inside = tempDir('verify-marker-overdue-control-');
    plantIncomplete(inside, runner, { budgetSeconds: 1, startedAtMs: Date.now() - (grace - 1) * 1000 });
    const insideScan = watchdog(['--markers'], inside);
    expect(insideScan.status, `a long run inside its budget is not a finding:\n${insideScan.stdout}`).toBe(0);
    expect(insideScan.stdout).toContain('LIVE');
  });

  it('refuses to answer on a machine with no /proc rather than passing the marker', () => {
    // macOS and Windows have no `/proc`, so liveness is undecidable there and
    // every INCOMPLETE marker is a finding. `kill(pid, 0)` was refused as a
    // fallback because it cannot see pid reuse, so it answers "live" for a
    // stranger's process — "I cannot tell" becoming green is the failure mode
    // this whole discipline exists to remove.
    //
    // DRIVEN, NOT REASONED ABOUT. The scan takes `procRoot`, so pointing it at
    // an empty directory is what this machine looks like without `/proc`. The
    // CLI does not expose it, so a real run cannot reach this arm by accident,
    // which is why this one case calls the module instead of the tool.
    const dir = tempDir('verify-marker-noproc-');
    plantIncomplete(dir, runnerOfThisProcess());
    const emptyProc = tempDir('verify-marker-fakeproc-');
    const script = `
      import { scanMarkers, formatMarkerReport } from ${JSON.stringify(MARKER_MODULE)};
      const scan = scanMarkers({
        root: ${JSON.stringify(REPO_ROOT)},
        env: { VERIFY_MARKER_DIR: ${JSON.stringify(dir)} },
        procRoot: ${JSON.stringify(emptyProc)},
      });
      console.log(formatMarkerReport(scan));
      console.log('FINDINGS ' + scan.findings.length);
    `;
    const result = spawnSync('node', ['--input-type=module', '-e', script], { encoding: 'utf8' });
    const out = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    expect(out, out).toContain('UNRESOLVED_NO_PROC');
    expect(out, 'the marker must be counted, not merely described').toContain('FINDINGS 1');

    // The control: the same record, this machine's real /proc, is LIVE.
    const withProc = spawnSync('node', ['--input-type=module', '-e', script.replace(JSON.stringify(emptyProc), JSON.stringify('/proc'))], { encoding: 'utf8' });
    expect(`${withProc.stdout ?? ''}`, 'the control must be green or the case above proves nothing').toContain('FINDINGS 0');
  });

  it('calls a marker from another machine unresolved rather than passing it', () => {
    const dir = tempDir('verify-marker-host-');
    plantIncomplete(dir, { ...runnerOfThisProcess(), host: `${os.hostname()}-somewhere-else` });
    const scan = watchdog(['--markers'], dir);
    expect(scan.status, '"I cannot tell" must not read as green').toBe(1);
    expect(scan.stdout).toContain('UNRESOLVED_FOREIGN_HOST');
  });

  it('calls a torn record a finding rather than skipping it', () => {
    // A write interrupted mid-flight, or a record from an older schema. Both
    // are "something happened here"; neither is an absence.
    const dir = tempDir('verify-marker-torn-');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, `torn${MARKER_EXTENSION}`), '{"schema": 1, "status": "INCO');
    const scan = watchdog(['--markers'], dir);
    expect(scan.status, `a torn record must be a finding, and this scan said:\n${scan.stdout}`).toBe(1);
    expect(scan.stdout).toContain('UNREADABLE');
  });

  it('clears findings on request and never clears a live one', () => {
    const dir = tempDir('verify-marker-clear-');
    const runner = runnerOfThisProcess();
    plantIncomplete(dir, runner); // LIVE: this process
    writeFileSync(
      path.join(dir, `dead${MARKER_EXTENSION}`),
      JSON.stringify({
        schema: 1,
        status: 'INCOMPLETE',
        id: 'dead',
        command: ['npx', 'tsc', '--noEmit'],
        budgetSeconds: 60,
        startedAtMs: Date.now(),
        runner: { ...runner, pid: 999_999, startTick: '1', cmdline: 'gone' },
      }),
    );
    expect(markerFiles(dir).length).toBe(2);

    const cleared = watchdog(['--markers', '--clear-stale'], dir);
    expect(cleared.status, 'clearing still reports what it found').toBe(1);
    expect(cleared.stdout).toContain('cleared');
    const left = markerFiles(dir).map((f) => path.basename(f));
    expect(left).toEqual([`planted${MARKER_EXTENSION}`]);
    const afterClear = watchdog(['--markers'], dir);
    expect(afterClear.status, `only the live marker should be left:\n${afterClear.stdout}`).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// SURVIVING THE TREE — the failure that actually happens here
// ---------------------------------------------------------------------------
//
// The local marker covers process-death-with-surviving-disk, observed ZERO
// times in this environment. Tree death has been observed seventeen times, and
// it takes `.gauntlet/verify/` with it — gitignored files included, because it
// is the filesystem going back rather than a git operation. So these checks are
// about the half that reaches origin WHILE THE RUN IS IN FLIGHT.
//
// EVERY CHECK BELOW RUNS IN ITS OWN SANDBOX REPOSITORY WITH ITS OWN BARE
// REMOTE, and that is not tidiness. The scanner parks fetched records in local
// refs under `refs/verify-sync/`, which are per-REPOSITORY: two checks sharing
// this repository would fetch two different remotes into one ref name and race.
// The tool is copied byte for byte and the copy is asserted identical, so the
// subject is the shipped tool; only the repository and the remote are synthetic.
//
// THE ONE THING THESE CANNOT DO is exercise the real network — the remote is a
// bare repository on this disk, so `git push` is real and the wire is not. The
// real-origin proof is a hand-run one and is recorded in the merge commit.

interface SyncSandbox {
  readonly repo: string;
  readonly tool: string;
  readonly remote: string;
  readonly markers: string;
}

function gitIn(dir: string, args: readonly string[]): string {
  return execFileSync('git', ['-C', dir, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'test',
      GIT_AUTHOR_EMAIL: 't@t',
      GIT_COMMITTER_NAME: 'test',
      GIT_COMMITTER_EMAIL: 't@t',
    },
  });
}

function syncSandbox(prefix: string): SyncSandbox {
  const repo = tempDir(`${prefix}repo-`);
  mkdirSync(path.join(repo, 'tools'), { recursive: true });
  for (const name of ['watchdog.mjs', 'verifyMarker.mjs']) {
    cpSync(path.join(REPO_ROOT, 'tools', name), path.join(repo, 'tools', name));
    expect(readFileSync(path.join(repo, 'tools', name))).toEqual(readFileSync(path.join(REPO_ROOT, 'tools', name)));
  }
  gitIn(repo, ['init', '--quiet']);
  gitIn(repo, ['commit', '--allow-empty', '--quiet', '-m', 'base']);
  const remote = tempDir(`${prefix}remote-`);
  execFileSync('git', ['init', '--bare', '--quiet', remote]);
  return { repo, tool: path.join(repo, 'tools', 'watchdog.mjs'), remote, markers: tempDir(`${prefix}markers-`) };
}

const remoteRef = (host: string = os.hostname()): string => `refs/heads/${SYNC_REF_PREFIX}/${host}`;

function remoteRecordNames(sandbox: SyncSandbox, host: string = os.hostname()): readonly string[] {
  const listed = spawnSync('git', ['--git-dir', sandbox.remote, 'ls-tree', '--name-only', remoteRef(host)], {
    encoding: 'utf8',
  });
  if (listed.status !== 0) return [];
  return (listed.stdout ?? '').trim() === '' ? [] : listed.stdout.trim().split('\n');
}

function remoteRecords(sandbox: SyncSandbox, host: string = os.hostname()): readonly Marker[] {
  return remoteRecordNames(sandbox, host).map(
    (name) =>
      JSON.parse(
        execFileSync('git', ['--git-dir', sandbox.remote, 'show', `${remoteRef(host)}:${name}`], { encoding: 'utf8' }),
      ) as Marker,
  );
}

/** Put a record on the remote by hand, for states a real run cannot produce here. */
function plantRemoteRecord(sandbox: SyncSandbox, host: string, records: readonly Record<string, unknown>[]): void {
  const staging = tempDir('verify-sync-plant-');
  gitIn(staging, ['init', '--quiet']);
  for (const record of records) {
    writeFileSync(path.join(staging, `${String(record.id)}${SYNC_RECORD_SUFFIX}`), JSON.stringify(record, null, 2));
  }
  gitIn(staging, ['add', '-A']);
  gitIn(staging, ['commit', '--quiet', '-m', 'planted']);
  gitIn(staging, ['push', '--quiet', '--force', sandbox.remote, `HEAD:${remoteRef(host)}`]);
}

/** How many local cache refs this sandbox holds — the count the ref-mapping bug moved. */
function cacheRefs(sandbox: SyncSandbox): readonly string[] {
  const listed = gitIn(sandbox.repo, ['for-each-ref', '--format=%(refname)', `${SYNC_LOCAL_REF_PREFIX}/`]).trim();
  return listed === '' ? [] : listed.split('\n');
}

describe('the record reaches origin while the run is still in flight', () => {
  it(
    'is on the remote, INCOMPLETE, with the wrapper still running',
    async () => {
      // THE WHOLE PIECE IN ONE CHECK. Move the push below the `await` in
      // `watchdog.mjs` — the completion-time sync that reads as the obvious
      // design — and the wait below times out, because a run that is still
      // going has not completed and never pushes.
      const sandbox = syncSandbox('verify-sync-inflight-');
      const child = spawn(
        'node',
        [sandbox.tool, '--budget', String(MARKER_TEST_TIMING.LONG_BUDGET_S), '--label', 'inflight', '--', ...SLEEPING_COMMAND],
        {
          cwd: sandbox.repo,
          detached: true,
          stdio: 'ignore',
          env: {
            ...process.env,
            VERIFY_MARKER_DIR: sandbox.markers,
            VERIFY_SYNC_REMOTE: sandbox.remote,
            VERIFY_SYNC_INTERVAL_SECONDS: '1',
          },
        },
      );
      const wrapperPid = child.pid;
      if (wrapperPid === undefined) throw new Error('the wrapper did not start');

      await waitFor(
        'the record to reach the remote',
        () => remoteRecordNames(sandbox).length === 1,
        MARKER_TEST_TIMING.MARKER_WAIT_MS,
      );
      // THE DISCRIMINATOR: the wrapper is STILL ALIVE at the instant the record
      // is readable on the remote. Without this line the check would pass on a
      // completion-time push that happened to land inside the wait.
      expect(pidExists(wrapperPid), 'the push must have happened DURING the run, not after it').toBe(true);

      const pushed = remoteRecords(sandbox);
      expect(pushed.length, 'counts, not bounds — exactly this run and nothing else').toBe(1);
      expect(pushed[0]?.status).toBe('INCOMPLETE');
      expect(pushed[0]?.command).toEqual(SLEEPING_COMMAND);
      expect(pushed[0]?.id).toBe(markersIn(sandbox.markers)[0]?.id);

      process.kill(-wrapperPid, 'SIGKILL');
      await waitFor('the wrapper to leave', () => !pidExists(wrapperPid), MARKER_TEST_TIMING.REAPED_WAIT_MS);
    },
    MARKER_TEST_TIMING.SLOW_CASE_MS,
  );

  it(
    'keeps pushing on a heartbeat, so a record found cold dates the last sign of life',
    async () => {
      // PERIODIC, NOT ONCE. Delete the `setInterval` and the count below never
      // moves — the record on origin would then be a snapshot of the first
      // second of a ten-minute run, which says nothing about when it stopped.
      const sandbox = syncSandbox('verify-sync-heartbeat-');
      const child = spawn(
        'node',
        [sandbox.tool, '--budget', String(MARKER_TEST_TIMING.LONG_BUDGET_S), '--label', 'heartbeat', '--', ...SLEEPING_COMMAND],
        {
          cwd: sandbox.repo,
          detached: true,
          stdio: 'ignore',
          env: {
            ...process.env,
            VERIFY_MARKER_DIR: sandbox.markers,
            VERIFY_SYNC_REMOTE: sandbox.remote,
            VERIFY_SYNC_INTERVAL_SECONDS: '1',
          },
        },
      );
      const wrapperPid = child.pid;
      if (wrapperPid === undefined) throw new Error('the wrapper did not start');

      await waitFor('the first push', () => remoteRecordNames(sandbox).length === 1, MARKER_TEST_TIMING.MARKER_WAIT_MS);
      const first = remoteRecords(sandbox)[0];
      const firstCount = first?.sync?.count ?? 0;
      const firstStamp = first?.sync?.lastAttemptIso ?? '';

      await waitFor(
        'a later heartbeat',
        () => (remoteRecords(sandbox)[0]?.sync?.count ?? 0) > firstCount,
        MARKER_TEST_TIMING.MARKER_WAIT_MS,
      );
      const later = remoteRecords(sandbox)[0];
      // NON-VACUITY, PINNED BY WHAT WAS SEEN rather than by a bound: the same
      // record id, a strictly higher heartbeat count, a later stamp, and the
      // status still INCOMPLETE because the run has not finished.
      expect(later?.id, 'the heartbeat must update the SAME record, not add one').toBe(first?.id);
      expect(remoteRecordNames(sandbox).length).toBe(1);
      expect(
        later?.sync?.count ?? 0,
        `heartbeat count went ${String(firstCount)} -> ${String(later?.sync?.count)}`,
      ).toBeGreaterThan(firstCount);
      expect(later?.sync?.lastAttemptIso ?? '', 'the stamp is what dates the last sign of life').not.toBe(firstStamp);
      expect(later?.status).toBe('INCOMPLETE');

      process.kill(-wrapperPid, 'SIGKILL');
      await waitFor('the wrapper to leave', () => !pidExists(wrapperPid), MARKER_TEST_TIMING.REAPED_WAIT_MS);
    },
    MARKER_TEST_TIMING.SLOW_CASE_MS,
  );

  it(
    'THE INCIDENT: the marker directory is destroyed and --markers still reports the run, from origin',
    async () => {
      // This is the case the whole piece exists for, produced rather than
      // described: a wrapped run is interrupted, and then the tree dies —
      // `.gauntlet/verify/` gone, the local cache refs gone, exactly what the
      // seventeen rewinds left behind.
      const sandbox = syncSandbox('verify-sync-treedeath-');
      const child = spawn(
        'node',
        [sandbox.tool, '--budget', String(MARKER_TEST_TIMING.LONG_BUDGET_S), '--label', 'doomed', '--', ...SLEEPING_COMMAND],
        {
          cwd: sandbox.repo,
          detached: true,
          stdio: 'ignore',
          env: {
            ...process.env,
            VERIFY_MARKER_DIR: sandbox.markers,
            VERIFY_SYNC_REMOTE: sandbox.remote,
            VERIFY_SYNC_INTERVAL_SECONDS: '1',
          },
        },
      );
      const wrapperPid = child.pid;
      if (wrapperPid === undefined) throw new Error('the wrapper did not start');
      await waitFor('the record to reach the remote', () => remoteRecordNames(sandbox).length === 1, MARKER_TEST_TIMING.MARKER_WAIT_MS);
      process.kill(-wrapperPid, 'SIGKILL');
      await waitFor('the wrapper to leave', () => !pidExists(wrapperPid), MARKER_TEST_TIMING.REAPED_WAIT_MS);

      // ===================== TREE DEATH =====================
      rmSync(sandbox.markers, { recursive: true, force: true });
      for (const ref of cacheRefs(sandbox)) gitIn(sandbox.repo, ['update-ref', '-d', ref]);
      expect(existsSync(sandbox.markers), 'the marker directory must really be gone').toBe(false);
      expect(cacheRefs(sandbox).length, 'and so must every local copy of the remote record').toBe(0);

      // THE CONTROL, AND IT IS WHAT MAKES THE CHECK BELOW MEAN ANYTHING. With
      // the origin scan switched off, the tool sees nothing and says nothing —
      // which is the state the marker discipline was in before this piece, and
      // is exactly the silent absence the ruling forbids.
      const localOnly = watchdog(['--markers', '--no-remote'], sandbox.markers, sandbox.repo, sandbox.tool, sandbox.remote);
      expect(localOnly.status, `the LOCAL scan alone cannot see it — that is the gap:\n${localOnly.stdout}`).toBe(0);
      expect(localOnly.stdout).toContain('0 verification marker(s)');

      // And the real scan, which reads origin.
      const scan = watchdog(['--markers'], sandbox.markers, sandbox.repo, sandbox.tool, sandbox.remote);
      expect(scan.status, `an interrupted run that outlived its tree must be a finding:\n${scan.stdout}`).toBe(1);
      expect(scan.stdout).toContain('[verify:origin]');
      expect(scan.stdout).toContain('INTERRUPTED_PROCESS_GONE');
      expect(scan.stdout, 'the report must name what was being verified').toContain(SLEEPING_COMMAND.join(' '));
      expect(scan.stdout).toContain('that SURVIVED THE TREE');
      expect(scan.stdout, "the ruling's own sentence must be on the origin arm too").toContain('It is not a pass');

      // ONE `--clear-stale`, NOT TWO. The record exists only on origin here, so
      // this is also the check that the remote clear path can reach it at all.
      const cleared = watchdog(['--markers', '--clear-stale'], sandbox.markers, sandbox.repo, sandbox.tool, sandbox.remote);
      expect(cleared.status, 'clearing still reports what it found').toBe(1);
      expect(cleared.stdout).toContain('1 record(s) removed');
      expect(remoteRecordNames(sandbox).length, 'the entry must be gone from the host ref').toBe(0);
      const after = watchdog(['--markers'], sandbox.markers, sandbox.repo, sandbox.tool, sandbox.remote);
      expect(after.status, `a cleared record must not come back:\n${after.stdout}`).toBe(0);
    },
    MARKER_TEST_TIMING.SLOW_CASE_MS,
  );

  it(
    'clears BOTH copies of a record that is in both places, in one pass',
    async () => {
      // THE BRANCH IMMEDIATELY BELOW THE ONE ABOVE, and it was broken when it
      // was written. A record present locally AND on origin is classified
      // `REMOTE_SUPERSEDED_BY_LOCAL` so it is not among the remote findings;
      // clearing "the local files and the remote findings" therefore left the
      // origin copy standing and the next scan reported it again forever.
      const sandbox = syncSandbox('verify-sync-bothcopies-');
      const run = watchdog(
        ['--budget', String(MARKER_TEST_TIMING.TINY_BUDGET_S), '--label', 'both', '--', ...SLEEPING_COMMAND],
        sandbox.markers,
        sandbox.repo,
        sandbox.tool,
        sandbox.remote,
      );
      expect(run.status, 'the budget breach is the interruption this uses').toBe(124);
      expect(markerFiles(sandbox.markers).length, 'the local copy').toBe(1);
      expect(remoteRecordNames(sandbox).length, 'and the origin copy').toBe(1);

      const scan = watchdog(['--markers'], sandbox.markers, sandbox.repo, sandbox.tool, sandbox.remote);
      expect(scan.status).toBe(1);
      // Counted ONCE, not twice: the local row speaks and the remote twin says so.
      expect(scan.stdout).toContain('REMOTE_SUPERSEDED_BY_LOCAL');
      expect(scan.stdout).toContain('1 verification(s) started and never wrote a verdict');

      const cleared = watchdog(['--markers', '--clear-stale'], sandbox.markers, sandbox.repo, sandbox.tool, sandbox.remote);
      expect(cleared.stdout).toContain('2 record(s) removed');
      expect(markerFiles(sandbox.markers).length).toBe(0);
      expect(remoteRecordNames(sandbox).length, 'ONE pass must clear the origin twin too').toBe(0);
      const after = watchdog(['--markers'], sandbox.markers, sandbox.repo, sandbox.tool, sandbox.remote);
      expect(after.status, `a cleared record must not come back from origin:\n${after.stdout}`).toBe(0);
    },
    MARKER_TEST_TIMING.SLOW_CASE_MS,
  );
});

describe('a heartbeat never overwrites a verdict', () => {
  it('leaves a passing run PASS in both places, and green', () => {
    // A REAL DEFECT, CAUGHT BY THE CONCURRENCY CHECK BELOW AND PINNED HERE.
    // A heartbeat reads the record, pushes, and writes back. If it writes back
    // the SNAPSHOT it read, a heartbeat that started before the verdict was
    // written restores INCOMPLETE over a real PASS — so a finished, passing
    // verification becomes a permanent finding, manufactured by the instrument
    // whose whole job is reporting findings. It writes only its own `sync`
    // field onto a re-read record now, and the wrapper drains in-flight
    // heartbeats before writing the verdict.
    const sandbox = syncSandbox('verify-sync-verdict-');
    const run = watchdog(
      ['--budget', String(MARKER_TEST_TIMING.LONG_BUDGET_S), '--label', 'verdict', '--', 'node', '-e', 'process.exit(0)'],
      sandbox.markers,
      sandbox.repo,
      sandbox.tool,
      sandbox.remote,
    );
    expect(run.status).toBe(0);
    expect(theOneMarker(sandbox.markers).status, 'the local record must keep its verdict').toBe('PASS');
    const pushed = remoteRecords(sandbox);
    expect(pushed.length, 'counts, not bounds').toBe(1);
    expect(pushed[0]?.status, 'and so must the copy on origin').toBe('PASS');
    const scan = watchdog(['--markers'], sandbox.markers, sandbox.repo, sandbox.tool, sandbox.remote);
    expect(scan.status, `a completed passing run is not a finding anywhere:\n${scan.stdout}`).toBe(0);
  }, MARKER_TEST_TIMING.SLOW_CASE_MS);

  it('discards its own stale snapshot when the verdict lands mid-push', () => {
    // THE CASE ONLY THE RE-READ CAN SAVE, DRIVEN DIRECTLY, because nothing the
    // wrapper does reaches it any more: a drain used to stand in front of it and
    // was deleted as dominated (see `watchdog.mjs`). Without a check that
    // reaches this, the re-read is a correct-looking line no edit can redden,
    // which is the vacuity this repository keeps paying for.
    //
    // `heartbeatMarker` reads the record synchronously and then awaits git, so a
    // write on the very next statement is guaranteed to land while the push is
    // in flight. That is the real interleaving, not a simulation of one.
    const sandbox = syncSandbox('verify-sync-midpush-');
    const markerPath = path.join(sandbox.markers, `midpush${MARKER_EXTENSION}`);
    const record = {
      schema: 1,
      status: 'INCOMPLETE',
      id: 'midpush',
      command: ['npx', 'vitest', 'run'],
      budgetSeconds: 900,
      startedAtMs: Date.now(),
      runner: { pid: process.pid, startTick: '1', cmdline: 'x', bootId: 'b', bootEpochSeconds: 1, host: os.hostname(), platform: 'linux', procAvailable: true },
    };
    writeFileSync(markerPath, JSON.stringify(record, null, 2));
    const script = `
      import { readFileSync, writeFileSync } from 'node:fs';
      import { heartbeatMarker } from ${JSON.stringify(path.join(sandbox.repo, 'tools', 'verifyMarker.mjs'))};
      const markerPath = ${JSON.stringify(markerPath)};
      const inFlight = heartbeatMarker(markerPath, {
        root: ${JSON.stringify(sandbox.repo)},
        env: { VERIFY_SYNC_REMOTE: ${JSON.stringify(sandbox.remote)} },
      });
      // The verdict lands here, while the push above is still going.
      const current = JSON.parse(readFileSync(markerPath, 'utf8'));
      writeFileSync(markerPath, JSON.stringify({ ...current, status: 'PASS', exitCode: 0 }, null, 2));
      await inFlight;
      console.log('FINAL ' + JSON.parse(readFileSync(markerPath, 'utf8')).status);
    `;
    const result = spawnSync('node', ['--input-type=module', '-e', script], { encoding: 'utf8', cwd: sandbox.repo });
    const out = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    expect(out, out).toContain('FINAL PASS');
    // NON-VACUITY: the heartbeat really did run and really did write, so the
    // line above is about a record the heartbeat touched rather than one it
    // never reached.
    const after = JSON.parse(readFileSync(markerPath, 'utf8')) as Marker;
    expect(after.sync?.count, 'the heartbeat must have stamped this record').toBe(1);
    expect(after.sync?.ok, 'and its push must have succeeded, or the write path was never taken').toBe(true);
  }, MARKER_TEST_TIMING.SLOW_CASE_MS);

  it('leaves a FAILING run FAIL in both places, and still green — the sibling arm', () => {
    // The branch immediately below the one above. A red suite is loud and gets
    // read; conflating it with an interruption would make the quiet signal mean
    // nothing. The origin copy must agree, or a rewind turns every failed
    // verification into an "interrupted" one.
    const sandbox = syncSandbox('verify-sync-verdict-fail-');
    const run = watchdog(
      ['--budget', String(MARKER_TEST_TIMING.LONG_BUDGET_S), '--label', 'verdict-fail', '--', 'node', '-e', 'process.exit(3)'],
      sandbox.markers,
      sandbox.repo,
      sandbox.tool,
      sandbox.remote,
    );
    expect(run.status).toBe(3);
    expect(theOneMarker(sandbox.markers).status).toBe('FAIL');
    expect(remoteRecords(sandbox)[0]?.status, 'origin must carry the verdict, not the start state').toBe('FAIL');
    const scan = watchdog(['--markers'], sandbox.markers, sandbox.repo, sandbox.tool, sandbox.remote);
    expect(scan.status, `a failing verification is complete, not interrupted:\n${scan.stdout}`).toBe(0);
  }, MARKER_TEST_TIMING.SLOW_CASE_MS);
});

describe('a sync failure is contained and is not silent', () => {
  it('does not fail the verification it is recording, and says so on stderr', () => {
    // A network call can fail. The rule is that it may not take the
    // verification down with it, and may not vanish either.
    const sandbox = syncSandbox('verify-sync-broken-');
    const broken = watchdog(
      ['--budget', String(MARKER_TEST_TIMING.LONG_BUDGET_S), '--label', 'broken-remote', '--', 'node', '-e', 'process.exit(0)'],
      sandbox.markers,
      sandbox.repo,
      sandbox.tool,
      path.join(sandbox.remote, 'definitely-not-a-repository'),
    );
    expect(broken.status, "a dead remote must not change the command's own verdict").toBe(0);
    expect(broken.stderr, broken.stderr).toContain('NEVER reached');
    expect(broken.stderr).toContain('is the ONLY copy');
    const marker = theOneMarker(sandbox.markers);
    expect(marker.status, 'the verification completed and its verdict stands').toBe('PASS');
    expect(marker.sync?.ok, 'and the record says the durable copy was not made').toBe(false);
    expect((marker.sync?.errors ?? []).length, 'with the reason kept, not merely a flag').toBeGreaterThan(0);

    // THE CONTROL, one argument apart: the same command against a real remote.
    const working = watchdog(
      ['--budget', String(MARKER_TEST_TIMING.LONG_BUDGET_S), '--label', 'good-remote', '--', 'node', '-e', 'process.exit(0)'],
      tempDir('verify-sync-broken-control-'),
      sandbox.repo,
      sandbox.tool,
      sandbox.remote,
    );
    expect(working.status).toBe(0);
    expect(working.stderr, working.stderr).toContain('it survives this tree');
    expect(working.stderr).not.toContain('NEVER reached');
  }, MARKER_TEST_TIMING.SLOW_CASE_MS);

  it('reports an unreachable origin as a NAMED SKIPPED check rather than as a pass', () => {
    // Every other "I cannot tell" in this module is a finding. This one is not,
    // and the reason is written down in `scanRemoteMarkers`: an offline run
    // going red on every suite is the crying-wolf failure. What it must never
    // do is look like an answer, so the exit code below is paired with a
    // control that shows the exit code CAN move.
    const sandbox = syncSandbox('verify-sync-unreachable-');
    const unreachable = watchdog(
      ['--markers'],
      sandbox.markers,
      sandbox.repo,
      sandbox.tool,
      path.join(sandbox.remote, 'gone'),
    );
    expect(unreachable.stdout, unreachable.stdout).toContain('[verify:origin] SKIPPED');
    expect(unreachable.stdout).toContain('THIS IS NOT A PASS AND IT IS NOT COUNTED');
    expect(unreachable.status, 'an unreachable remote does not redden a run').toBe(0);

    // THE CONTROL: same sandbox, reachable remote, one interrupted record on it.
    plantRemoteRecord(sandbox, os.hostname(), [
      {
        schema: 1,
        status: 'INCOMPLETE',
        id: 'unreachable-control',
        command: ['npx', 'vitest', 'run'],
        budgetSeconds: 900,
        startedAtMs: Date.now(),
        runner: { pid: 999_999, startTick: '1', cmdline: 'gone', bootId: 'gone', bootEpochSeconds: 1, host: os.hostname(), platform: 'linux', procAvailable: true },
      },
    ]);
    const reachable = watchdog(['--markers'], sandbox.markers, sandbox.repo, sandbox.tool, sandbox.remote);
    expect(reachable.status, `the exit code must be able to move, or the case above proves nothing:\n${reachable.stdout}`).toBe(1);
  }, MARKER_TEST_TIMING.SLOW_CASE_MS);
});

describe('three sessions share this remote', () => {
  it("reports another host's interrupted run and does not count it, and counts its own", () => {
    // Locally a foreign host is a FINDING — somebody else's marker on my disk is
    // anomalous. On a remote shared by three sessions it is the ordinary case,
    // and counting it would leave every session permanently red on every other
    // session's work. The two arms are one decision and are written together.
    const sandbox = syncSandbox('verify-sync-hosts-');
    const foreign = `${os.hostname()}-another-session`;
    const dead = {
      schema: 1,
      status: 'INCOMPLETE',
      command: ['npx', 'tsc', '--noEmit'],
      budgetSeconds: 900,
      startedAtMs: Date.now(),
    };
    plantRemoteRecord(sandbox, foreign, [
      {
        ...dead,
        id: 'someone-elses-run',
        runner: { pid: 999_999, startTick: '1', cmdline: 'gone', bootId: 'gone', bootEpochSeconds: 1, host: foreign, platform: 'linux', procAvailable: true },
      },
    ]);

    const onlyForeign = watchdog(['--markers'], sandbox.markers, sandbox.repo, sandbox.tool, sandbox.remote);
    expect(onlyForeign.stdout, onlyForeign.stdout).toContain('REMOTE_ANOTHER_HOST');
    expect(onlyForeign.stdout, 'the host must be named so a reader knows whose run it is').toContain(foreign);
    expect(onlyForeign.status, "another session's run is reported, not counted").toBe(0);

    // THE SIBLING ARM: the same record, this host. Now /proc can answer for it,
    // and the answer is that the process is gone.
    plantRemoteRecord(sandbox, os.hostname(), [
      {
        ...dead,
        id: 'my-own-run',
        runner: { pid: 999_999, startTick: '1', cmdline: 'gone', bootId: 'gone', bootEpochSeconds: 1, host: os.hostname(), platform: 'linux', procAvailable: true },
      },
    ]);
    const both = watchdog(['--markers'], sandbox.markers, sandbox.repo, sandbox.tool, sandbox.remote);
    expect(both.status, `this host's own interrupted run must be a finding:\n${both.stdout}`).toBe(1);
    expect(both.stdout).toContain('2 record(s) on');
    expect(both.stdout, 'counts, not bounds: exactly one of the two is counted').toContain(
      '1 verification(s) on',
    );
  }, MARKER_TEST_TIMING.SLOW_CASE_MS);

  it('lands three concurrent runs on one host ref without losing any', () => {
    // Two of the three sessions on this repository are on this host and share
    // one ref. A lost push is a lost RACE, not a lost record: refetch, replay,
    // push. Remove the retry and this drops to fewer than three.
    const sandbox = syncSandbox('verify-sync-race-');
    const runs = [1, 2, 3].map((n) =>
      new Promise<void>((resolve) => {
        const child = spawn(
          'node',
          [sandbox.tool, '--budget', String(MARKER_TEST_TIMING.LONG_BUDGET_S), '--label', `race-${n}`, '--', 'node', '-e', 'process.exit(0)'],
          {
            cwd: sandbox.repo,
            stdio: 'ignore',
            env: { ...process.env, VERIFY_MARKER_DIR: path.join(sandbox.markers, `r${n}`), VERIFY_SYNC_REMOTE: sandbox.remote },
          },
        );
        child.on('exit', () => resolve());
      }),
    );
    return Promise.all(runs).then(() => {
      const names = remoteRecordNames(sandbox);
      expect(names.length, `three runs, three records; the remote held ${names.join(', ')}`).toBe(3);
      expect(remoteRecords(sandbox).every((m) => m.status === 'PASS')).toBe(true);
    });
  }, MARKER_TEST_TIMING.SLOW_CASE_MS);
});

describe('the remote record survives retention, and the ref mapping has one spelling', () => {
  it('never prunes an INCOMPLETE record off the host ref, however many verdicts pile up', () => {
    // The remote sibling of "prunes completed records and never an incomplete
    // one". SYMBOLIC COMPARISON WITH THAT CHECK, because a new rule that
    // subsumes an old one is a check that can never speak again:
    // `COMPLETED_KEPT` (20) prunes FILES in a marker directory at `beginMarker`
    // time; `REMOTE_COMPLETED_KEPT` (40) prunes TREE ENTRIES on a host ref at
    // sync time. The collections are disjoint — a record pruned locally is
    // still on the remote — so neither threshold implies the other in either
    // direction, and 40 > 20 means the remote is the LOOSER of the two and
    // cannot be what reddens first.
    const sandbox = syncSandbox('verify-sync-retention-');
    const planted: Record<string, unknown>[] = [];
    for (let i = 0; i < REMOTE_COMPLETED_KEPT + 5; i += 1) {
      planted.push({ schema: 1, status: 'PASS', id: `done-${String(i).padStart(3, '0')}`, startedAtMs: 1000 + i, command: ['node', '-e', '0'] });
    }
    planted.push({
      schema: 1,
      status: 'INCOMPLETE',
      id: 'ancient-remote-incomplete',
      command: ['npx', 'vitest', 'run'],
      budgetSeconds: 1,
      startedAtMs: 1,
      runner: { pid: 999_999, startTick: '1', cmdline: 'gone', bootId: 'gone', bootEpochSeconds: 1, host: os.hostname(), platform: 'linux', procAvailable: true },
    });
    plantRemoteRecord(sandbox, os.hostname(), planted);
    expect(remoteRecordNames(sandbox).length, 'the domain this prunes over').toBe(REMOTE_COMPLETED_KEPT + 6);

    watchdog(
      ['--budget', String(MARKER_TEST_TIMING.LONG_BUDGET_S), '--label', 'retention', '--', 'node', '-e', 'process.exit(0)'],
      sandbox.markers,
      sandbox.repo,
      sandbox.tool,
      sandbox.remote,
    );

    const names = remoteRecordNames(sandbox);
    expect(names, 'age is not evidence that an interruption was dealt with').toContain(
      `ancient-remote-incomplete${SYNC_RECORD_SUFFIX}`,
    );
    // Counts, not bounds: the retained verdicts, the run just made, and the
    // incomplete one that is never cut.
    expect(names.length).toBe(REMOTE_COMPLETED_KEPT + 2);

    // AND THE REPORT COLLAPSES THE VERDICTS AND NEVER THE FINDING. This is the
    // only check whose domain is big enough to tell the two apart: with forty-odd
    // records on one ref, a section that listed all of them is the wall of text
    // that trains a reader to skip it, and one that collapsed the finding along
    // with them would be worse than silent.
    const scan = watchdog(['--markers'], sandbox.markers, sandbox.repo, sandbox.tool, sandbox.remote);
    expect(scan.stdout, scan.stdout).toContain(`${REMOTE_COMPLETED_KEPT + 1} COMPLETE —`);
    // The planted runner carries a foreign boot id, so this is the arm the
    // classifier reaches; naming it rather than "some finding" is what makes a
    // change of classification visible instead of silently still-green.
    expect(scan.stdout, 'the interrupted record must still be listed in full').toContain(
      'INTERRUPTED_MACHINE_RESTARTED',
    );
    expect(scan.stdout, 'naming the record and the command it was verifying').toContain('ancient-remote-incomplete');
    expect(scan.stdout).toContain('npx vitest run');
    expect(scan.status, `and it must still decide the exit code:\n${scan.stdout}`).toBe(1);
  }, MARKER_TEST_TIMING.SLOW_CASE_MS);

  it('writes and reads ONE local cache ref, because the mapping is derived and not respelled', () => {
    // THE DEFECT THIS IS ABOUT WAS REAL AND LASTED AN HOUR. The push derived
    // `refs/verify-sync/verify-markers/vm`, the scanner's refspec derived
    // `refs/verify-sync/vm`, and the clear path derived `refs/heads/vm`. Nothing
    // threw; the scanner simply read a ref the writer had never filled, and the
    // count below was 2 where it should be 1.
    // THE ORDER OF THE TWO READS BELOW IS THE ENTIRE CHECK, and the first
    // version had it the other way round and SURVIVED the respelling mutant.
    // Found by running the mutant rather than by reading the check.
    //
    // The scanner fetches with `--prune`, so any stray ref under its own
    // destination namespace is DELETED the first time it scans. A writer
    // spelling its destination differently therefore self-heals at scan time:
    // the steady state is one correct ref either way, and the only symptom is
    // a fetch that re-downloads the ref on every push. So the writer's
    // spelling has to be read BEFORE anything scans, or `--prune` erases the
    // evidence and the check reads like coverage.
    const sandbox = syncSandbox('verify-sync-refmap-');
    expect(cacheRefs(sandbox).length, 'nothing has been fetched yet').toBe(0);
    watchdog(
      ['--budget', String(MARKER_TEST_TIMING.LONG_BUDGET_S), '--label', 'refmap', '--', 'node', '-e', 'process.exit(0)'],
      sandbox.markers,
      sandbox.repo,
      sandbox.tool,
      sandbox.remote,
    );
    // The wrapper syncs twice — start and final — so the second push has a
    // parent and takes the fetch path. Without a parent there is no fetch and
    // `localCacheRefFor` is never called at all, which is an empty domain.
    expect(theOneMarker(sandbox.markers).sync?.count, 'two pushes, so the second one had a parent to fetch').toBe(2);
    const expected = [`${SYNC_LOCAL_REF_PREFIX}/${os.hostname()}`];
    // The wrong value goes in the MESSAGE, not only in the diff: a deep-equal
    // failure here prints `[ Array(1) ]` and tells the reader nothing about
    // which spelling actually landed.
    const written = cacheRefs(sandbox);
    expect(written, `the WRITER must spell its cache ref the derived way; it wrote [${written.join(', ')}]`).toEqual(expected);

    watchdog(['--markers'], sandbox.markers, sandbox.repo, sandbox.tool, sandbox.remote);
    const scanned = cacheRefs(sandbox);
    expect(scanned, `the SCANNER must land on that same one ref; it left [${scanned.join(', ')}]`).toEqual(expected);
  }, MARKER_TEST_TIMING.SLOW_CASE_MS);
});

// ---------------------------------------------------------------------------
// The wave-level bite
// ---------------------------------------------------------------------------

describe('the check a wave already runs', () => {
  it('reports markers inside --branches and lets one decide its exit code', () => {
    // A HERMETIC REPOSITORY, because `--branches` exits on three findings and
    // this check is about exactly one of them. The tool is COPIED BYTE FOR BYTE
    // from the shipped file at test time and the copy is asserted identical, so
    // the subject is the real tool; only the repository around it is synthetic,
    // which is what makes the two runs below differ in one thing.
    const sandbox = tempDir('verify-marker-branches-');
    mkdirSync(path.join(sandbox, 'tools'), { recursive: true });
    for (const name of ['watchdog.mjs', 'verifyMarker.mjs']) {
      cpSync(path.join(REPO_ROOT, 'tools', name), path.join(sandbox, 'tools', name));
      expect(readFileSync(path.join(sandbox, 'tools', name))).toEqual(readFileSync(path.join(REPO_ROOT, 'tools', name)));
    }
    const git = (args: readonly string[]): void => {
      execFileSync('git', ['-C', sandbox, ...args], {
        encoding: 'utf8',
        env: { ...process.env, GIT_AUTHOR_NAME: 'test', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 'test', GIT_COMMITTER_EMAIL: 't@t' },
      });
    };
    git(['init', '--quiet']);
    git(['commit', '--allow-empty', '--quiet', '-m', 'base']);
    const sandboxTool = path.join(sandbox, 'tools', 'watchdog.mjs');

    // Baseline: no claude/* branches, no worktrees, no markers.
    const clean = watchdog(['--branches'], null, sandbox, sandboxTool);
    expect(clean.stdout, 'the marker section is missing from --branches').toContain('[verify]');
    expect(clean.status, 'the synthetic repository has nothing to report').toBe(0);

    // One thing changes.
    watchdog(['--budget', String(MARKER_TEST_TIMING.TINY_BUDGET_S), '--', ...SLEEPING_COMMAND], null, sandbox, sandboxTool);
    const dirty = watchdog(['--branches'], null, sandbox, sandboxTool);
    expect(dirty.stdout).toContain('BUDGET_EXCEEDED');
    expect(dirty.stdout).toContain(SLEEPING_COMMAND.join(' '));
    expect(dirty.status, 'an interrupted verification must fail the wave check').toBe(1);
  }, MARKER_TEST_TIMING.SLOW_CASE_MS);

  it('finds no interrupted verification in this repository or on its origin right now', () => {
    // THE LIVE-TREE CHECK, and the honest note about it: if the suite is run
    // without a wrapper there are no LOCAL markers at all, so that half of this
    // check's domain is EMPTY and proves nothing about the scanner. It is here
    // because the alternative — a marker discipline nothing in the suite ever
    // consults — is how the last four instruments in this repository came to be
    // decoration. The checks above build their own domains and are where the
    // biting is.
    //
    // IT IS ALSO THE ONE CHECK IN THIS FILE THAT USES THE REAL `origin`, and
    // that is deliberate: after a rewind the local half is empty by
    // construction, so a suite that only reads local disk is green in exactly
    // the situation this piece was built for. The cost is stated rather than
    // hidden — this check now depends on the state of a shared remote and on
    // being able to reach it. An unreachable origin is a NAMED SKIPPED section
    // and stays green, so a network flake does not redden the suite; what does
    // redden it is a real interrupted run pushed from THIS host, which is the
    // bite CLAUDE.md's ruling asked to keep.
    //
    // The environment is asserted rather than assumed, so a stray
    // VERIFY_MARKER_DIR or VERIFY_SYNC_REMOTE cannot make this pass by looking
    // somewhere else.
    expect(process.env.VERIFY_MARKER_DIR, 'this check must read the repository, not an override').toBe(undefined);
    expect(process.env.VERIFY_SYNC_REMOTE, 'and the real origin, not a sandbox').toBe(undefined);
    const scan = watchdog(['--markers'], null, REPO_ROOT, WATCHDOG, null);
    expect(scan.stdout).toContain('[verify]');
    expect(scan.stdout, 'the origin half must have been asked, not skipped by default').toContain('[verify:origin]');
    expect(
      scan.status,
      `an interrupted verification is on disk in this tree or on its origin, and its result is UNKNOWN:\n${scan.stdout}`,
    ).toBe(0);
  }, MARKER_TEST_TIMING.SLOW_CASE_MS);
});
