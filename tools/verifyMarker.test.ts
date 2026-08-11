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
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
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
}

interface Run {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

function tempDir(prefix: string): string {
  return mkdtempSync(path.join(os.tmpdir(), prefix));
}

function watchdog(args: readonly string[], markerDir: string | null, cwd: string = REPO_ROOT, tool: string = WATCHDOG): Run {
  const env = { ...process.env };
  if (markerDir === null) delete env.VERIFY_MARKER_DIR;
  else env.VERIFY_MARKER_DIR = markerDir;
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

  it('finds no interrupted verification in this repository right now', () => {
    // THE LIVE-TREE CHECK, and the honest note about it: if the suite is run
    // without a wrapper there are no markers at all, so this check's domain is
    // EMPTY and it proves nothing about the scanner. It is here because the
    // alternative — a marker discipline nothing in the suite ever consults — is
    // how the last four instruments in this repository came to be decoration.
    // The checks above build their own domains and are where the biting is.
    //
    // The environment is asserted rather than assumed, so a stray
    // VERIFY_MARKER_DIR cannot make this pass by looking somewhere else.
    expect(process.env.VERIFY_MARKER_DIR, 'this check must read the repository, not an override').toBe(undefined);
    const scan = watchdog(['--markers'], null);
    expect(scan.stdout).toContain('[verify]');
    expect(
      scan.status,
      `an interrupted verification is on disk in this tree and its result is UNKNOWN:\n${scan.stdout}`,
    ).toBe(0);
  });
});
