/**
 * devServerSentinel.test.ts — the checks that make the dev-server sentinel
 * gate bite.
 *
 * WHY THIS FILE IS IN `tools/`: the subject is `tools/devServerSentinel.mjs`,
 * and CLAUDE.md asks for a test colocated with its module. `vitest.config.ts`
 * includes `tools/**‍/*.test.ts`, and `progression.test.ts`'s "drops from the
 * sweep exactly the files vitest runs" would go red on a `.test.ts` the suite
 * compiled but never ran.
 *
 * EVERY REFUSAL ARM IS DRIVEN TO RED AND THE PASS ARM TO GREEN, in a throwaway
 * directory — CLAUDE.md's "driven both ways" bar for a new guard. Beside each
 * check is the edit to the subject that turns it red, because an assertion
 * nobody can name a reddening edit for is decoration.
 *
 * WHAT THIS FILE DOES NOT COVER, declared rather than implied:
 *   - That `tools/dev-web.sh` writes a truthful pid. The CLI round-trip below
 *     proves the exact command the script runs works end to end, and a source
 *     pin proves the script still issues it — but nothing here starts a real
 *     Expo server. The first real `tools/dev-web.sh` run is that check.
 *   - A machine restart. Same limit `verifyMarker.test.ts` declares: what is
 *     proved is that a record whose boot identity differs from this machine's
 *     is refused, via a hand-tampered record — the state cannot be produced on
 *     demand.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  DEV_SERVER_SENTINEL,
  OVERRIDE_BANNER_LINES,
  checkDevServerSentinel,
  gateDevServer,
  portOfUrl,
  removeSentinel,
  sentinelPathFor,
  writeSentinel,
  writeSentinelRecord,
} from './devServerSentinel.mjs';
import type { SentinelRecord, SentinelVerdict } from './devServerSentinel.mjs';

const REPO_ROOT = path.resolve(__dirname, '..');
const MODULE = path.join(REPO_ROOT, 'tools', 'devServerSentinel.mjs');
const DEV_WEB = path.join(REPO_ROOT, 'tools', 'dev-web.sh');

/** The port every fixture below serves and drives unless the case is ABOUT a mismatch. */
const FIXTURE_PORT = 8097;
const FIXTURE_URL = `http://localhost:${FIXTURE_PORT}`;

function throwawayRoot(): string {
  return mkdtempSync(path.join(os.tmpdir(), 'sentinel-test-'));
}

/** A sentinel for THIS process: the one live pid a test can always vouch for. */
function liveSentinelAt(root: string): SentinelRecord {
  return writeSentinel({ root, pid: process.pid, port: FIXTURE_PORT }).record;
}

function tamper(root: string, mutate: (record: SentinelRecord) => void): void {
  const record = JSON.parse(readFileSync(sentinelPathFor(root), 'utf8')) as SentinelRecord;
  mutate(record);
  writeSentinelRecord(root, record);
}

function refusalOf(verdict: SentinelVerdict): { reason: string; message: string } {
  if (verdict.ok) throw new Error('expected a refusal, got ok');
  return verdict;
}

describe('the pass arm', () => {
  // Reddens on: any refusal arm firing spuriously — e.g. the boot comparison
  // reading this boot as stale, or the pid check failing on a live pid.
  it('a present, live, matching sentinel passes and reports the recorded server', () => {
    const root = throwawayRoot();
    liveSentinelAt(root);
    const verdict = checkDevServerSentinel({ url: FIXTURE_URL, root });
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.sentinel.port).toBe(FIXTURE_PORT);
    expect(verdict.sentinel.schema).toBe(DEV_SERVER_SENTINEL.SCHEMA);
    expect(verdict.sentinel.runner.pid).toBe(process.pid);
  });

  // Reddens on: gateDevServer exiting on a verdict that is ok, or going
  // silent — the OK line is the gate's visible-in-transcript telemetry.
  it('gateDevServer on a live sentinel does not exit and logs the OK line', () => {
    const root = throwawayRoot();
    liveSentinelAt(root);
    const lines: string[] = [];
    const exits: number[] = [];
    const outcome = gateDevServer({
      url: FIXTURE_URL,
      root,
      env: {},
      log: (line) => lines.push(line),
      exit: (code) => exits.push(code),
    });
    expect(exits).toEqual([]);
    expect(outcome.overridden).toBe(false);
    expect(outcome.sentinel).not.toBeNull();
    expect(lines.join('\n')).toContain('dev-server sentinel OK');
  });
});

describe('each refusal reason, driven', () => {
  // Reddens on: the gate treating an absent sentinel as passable, or the
  // refusal dropping the fix line — the message contract is "names what was
  // wrong AND names tools/dev-web.sh as the fix", per arm, not on average.
  it('absent sentinel refuses NO_SENTINEL and names the fix', () => {
    const root = throwawayRoot();
    const refusal = refusalOf(checkDevServerSentinel({ url: FIXTURE_URL, root }));
    expect(refusal.reason).toBe(DEV_SERVER_SENTINEL.REASONS.NO_SENTINEL);
    expect(refusal.message).toContain('NO_SENTINEL');
    expect(refusal.message).toContain(sentinelPathFor(root));
    expect(refusal.message).toContain(`PORT=${FIXTURE_PORT} tools/dev-web.sh`);
    expect(refusal.message).toContain('UNMANAGED_DEV_SERVER=1');
  });

  // Reddens on: JSON.parse failures leaking as throws, or a torn record being
  // read as "no sentinel" (an existing-but-broken file is a different fact
  // from an absent one, and the message must say which).
  it('a torn sentinel refuses UNREADABLE, not NO_SENTINEL', () => {
    const root = throwawayRoot();
    liveSentinelAt(root);
    writeFileSync(sentinelPathFor(root), '{ this is not JSON');
    const refusal = refusalOf(checkDevServerSentinel({ url: FIXTURE_URL, root }));
    expect(refusal.reason).toBe(DEV_SERVER_SENTINEL.REASONS.UNREADABLE);
    expect(refusal.message).toContain('tools/dev-web.sh');
  });

  // Reddens on: dropping the schema check — an old-shape record would then be
  // interrogated field-by-field and refuse with whatever arm happens to trip,
  // or pass.
  it('a wrong-schema sentinel refuses UNREADABLE', () => {
    const root = throwawayRoot();
    liveSentinelAt(root);
    tamper(root, (record) => {
      record.schema = DEV_SERVER_SENTINEL.SCHEMA + 1;
    });
    const refusal = refusalOf(checkDevServerSentinel({ url: FIXTURE_URL, root }));
    expect(refusal.reason).toBe(DEV_SERVER_SENTINEL.REASONS.UNREADABLE);
  });

  // Reddens on: the boot-id comparison being dropped or inverted. This is the
  // load-bearing arm — a pre-restart sentinel names a pid the new boot may
  // have REUSED, so pid-aliveness alone would pass exactly the wrong record.
  it('a different boot id refuses STALE_BOOT even though the pid is alive', () => {
    const root = throwawayRoot();
    liveSentinelAt(root);
    tamper(root, (record) => {
      record.runner.bootId = 'not-this-boot-0000-0000-000000000000';
    });
    const refusal = refusalOf(checkDevServerSentinel({ url: FIXTURE_URL, root }));
    expect(refusal.reason).toBe(DEV_SERVER_SENTINEL.REASONS.STALE_BOOT);
    expect(refusal.message).toContain('different boot id');
  });

  // Reddens on: losing the epoch leg — the fallback that still catches a
  // restart when a boot id is unreadable on either side (verifyMarker's two
  // legs, followed rather than reinvented).
  it('a boot-epoch drift past tolerance refuses STALE_BOOT when boot ids cannot disagree', () => {
    const root = throwawayRoot();
    liveSentinelAt(root);
    tamper(root, (record) => {
      record.runner.bootId = null;
      record.runner.bootEpochSeconds = Math.round(Date.now() / 1000) - 10_000_000;
    });
    const refusal = refusalOf(checkDevServerSentinel({ url: FIXTURE_URL, root }));
    expect(refusal.reason).toBe(DEV_SERVER_SENTINEL.REASONS.STALE_BOOT);
    expect(refusal.message).toContain('booted');
  });

  // Reddens on: the pid liveness read going soft — e.g. "cannot read /proc"
  // being read as alive, which verifyMarker.mjs's own header forbids.
  it('a dead pid refuses DEAD_PID and says the server is gone', () => {
    const root = throwawayRoot();
    // A pid that is certainly not this process and almost certainly dead:
    // spawn a child, let it print its own pid, and use it after it has exited.
    // If the pid was reused in the gap, the start tick differs and the reason
    // is still DEAD_PID — both branches of that arm are the same refusal.
    const deadPid = Number(execFileSync('node', ['-e', 'console.log(process.pid)'], { encoding: 'utf8' }).trim());
    writeSentinel({ root, pid: deadPid, port: FIXTURE_PORT });
    const refusal = refusalOf(checkDevServerSentinel({ url: FIXTURE_URL, root }));
    expect(refusal.reason).toBe(DEV_SERVER_SENTINEL.REASONS.DEAD_PID);
    expect(refusal.message).toContain(String(deadPid));
  });

  // Reddens on: dropping the start-tick/cmdline comparison — the arm that
  // makes "pid is alive" mean "and is still the process the sentinel
  // recorded" inside one boot.
  it('a reused pid (live, wrong start tick) refuses DEAD_PID as a reuse', () => {
    const root = throwawayRoot();
    liveSentinelAt(root);
    tamper(root, (record) => {
      record.runner.startTick = '1';
    });
    const refusal = refusalOf(checkDevServerSentinel({ url: FIXTURE_URL, root }));
    expect(refusal.reason).toBe(DEV_SERVER_SENTINEL.REASONS.DEAD_PID);
    expect(refusal.message).toContain('reused');
  });

  // Reddens on: dropping the port comparison — the cross-session arm. The
  // concurrent-builder incident class is exactly "my checkout's server is on
  // 8097 and I absent-mindedly drove the default 8081, which is somebody
  // else's build".
  it('a live sentinel for another port refuses WRONG_PORT and names both ports', () => {
    const root = throwawayRoot();
    liveSentinelAt(root);
    const refusal = refusalOf(checkDevServerSentinel({ url: 'http://localhost:8098', root }));
    expect(refusal.reason).toBe(DEV_SERVER_SENTINEL.REASONS.WRONG_PORT);
    expect(refusal.message).toContain('8097');
    expect(refusal.message).toContain('8098');
  });

  // Reddens on: `new URL('http://localhost').port === ''` being compared as a
  // number — the scheme default must be made explicit or a port-free URL
  // compares NaN and every sentinel refuses it for the wrong reason.
  it('portOfUrl makes scheme defaults explicit', () => {
    expect(portOfUrl('http://localhost')).toBe(80);
    expect(portOfUrl('https://localhost')).toBe(443);
    expect(portOfUrl('http://localhost:8097/page?x=1')).toBe(8097);
  });
});

describe('the override, loud and the refusal, terminal', () => {
  // Reddens on: the override going silent (the banner is the whole point — a
  // deliberate other-server run must be a visible transcript choice), or the
  // override failing to skip the check.
  it('UNMANAGED_DEV_SERVER=1 skips the check and prints every banner line', () => {
    const root = throwawayRoot(); // no sentinel: the check would refuse
    const lines: string[] = [];
    const exits: number[] = [];
    const outcome = gateDevServer({
      url: FIXTURE_URL,
      root,
      env: { [DEV_SERVER_SENTINEL.OVERRIDE_ENV]: DEV_SERVER_SENTINEL.OVERRIDE_VALUE },
      log: (line) => lines.push(line),
      exit: (code) => exits.push(code),
    });
    expect(outcome.overridden).toBe(true);
    expect(exits).toEqual([]);
    const printed = lines.join('\n');
    for (const bannerLine of OVERRIDE_BANNER_LINES) {
      expect(printed).toContain(bannerLine);
    }
    expect(printed).toContain(FIXTURE_URL);
  });

  // Non-vacuity for the case above: the same call WITHOUT the env var must
  // refuse, so the env var is provably what flipped the outcome — not a check
  // that never fires. Reddens on: the gate not exiting on a refusal.
  it('the same call without the override refuses, exits 1, and prints the reason', () => {
    const root = throwawayRoot();
    const lines: string[] = [];
    const exits: number[] = [];
    gateDevServer({
      url: FIXTURE_URL,
      root,
      env: {},
      log: (line) => lines.push(line),
      exit: (code) => exits.push(code),
    });
    expect(exits).toEqual([1]);
    expect(lines.join('\n')).toContain('REFUSING TO DRIVE');
  });

  // Reddens on: the override accepting any truthy value — the escape hatch is
  // `=1` exactly, so a typo cannot silently disable the gate.
  it('any value other than "1" does not engage the override', () => {
    const root = throwawayRoot();
    const exits: number[] = [];
    gateDevServer({
      url: FIXTURE_URL,
      root,
      env: { [DEV_SERVER_SENTINEL.OVERRIDE_ENV]: 'true' },
      log: () => undefined,
      exit: (code) => exits.push(code),
    });
    expect(exits).toEqual([1]);
  });
});

describe('the CLI dev-web.sh actually calls', () => {
  // Reddens on: the CLI arg parsing breaking — this is the exact command shape
  // the shell script issues, driven as a real subprocess, so bash's half of
  // the handshake is proved against the module's half.
  it('write → check ok → remove → NO_SENTINEL, end to end', () => {
    const root = throwawayRoot();
    execFileSync('node', [
      MODULE, 'write',
      '--root', root,
      '--pid', String(process.pid),
      '--port', String(FIXTURE_PORT),
      '--log', '/tmp/expo-web.log',
    ]);
    expect(existsSync(sentinelPathFor(root))).toBe(true);
    const okVerdict = checkDevServerSentinel({ url: FIXTURE_URL, root });
    expect(okVerdict.ok).toBe(true);

    execFileSync('node', [MODULE, 'remove', '--root', root]);
    const refusal = refusalOf(checkDevServerSentinel({ url: FIXTURE_URL, root }));
    expect(refusal.reason).toBe(DEV_SERVER_SENTINEL.REASONS.NO_SENTINEL);
  });

  // Reddens on: removeSentinel throwing on an absent file — dev-web.sh calls
  // it unconditionally before every start.
  it('remove is idempotent', () => {
    const root = throwawayRoot();
    expect(removeSentinel(root)).toBe(false);
    liveSentinelAt(root);
    expect(removeSentinel(root)).toBe(true);
    expect(removeSentinel(root)).toBe(false);
  });
});

describe('the siblings all read the guard (CLAUDE.md twin-guard rule)', () => {
  /**
   * The census rule: a tool that DRIVES the dev server is one that declares
   * the default URL as `flag('url', 'http://localhost:...`. Usage prose that
   * merely mentions the URL (card.mjs, licensing.mjs tell you how to invoke
   * shoot.mjs) does not match, and that precision is pinned below.
   *
   * DECLARED LIMIT: a future tool that drives a server without that exact
   * declaration shape is invisible to this census. The census catches the
   * house pattern, which is what every driving tool uses today — the count
   * pin below is what forces the next person to look here when it moves.
   */
  const URL_DECLARATION = "flag('url', 'http://localhost:";
  const GATED_TOOLS = [
    '_capture-a2-lifter.mjs',
    '_capture-iron-amber-training.mjs',
    'capture-cutin.mjs',
    'capture-lift.mjs',
    'capture-meet.mjs',
    'capture-session.mjs',
    'shoot.mjs',
    'verify-cutin-cap.mjs',
    'verify-lift-press.mjs',
    'verify-meet-sound.mjs',
    'verify-session-boundary.mjs',
    'verify-shell-route.mjs',
  ] as const;

  const toolsDir = path.join(REPO_ROOT, 'tools');
  const allTools = readdirSync(toolsDir).filter((name) => name.endsWith('.mjs'));

  // Reddens on: an eleventh driving tool shipping without the gate (set
  // inequality, left side grows), or a gate call being deleted from one of
  // the ten (right side shrinks). Both directions, per CLAUDE.md's rule that
  // a twin guard must READ the sibling list, not copy it.
  it('every tool that declares the default dev-server URL calls gateDevServer, and no other', () => {
    const declaring: string[] = [];
    const gated: string[] = [];
    for (const name of allTools) {
      if (name === 'devServerSentinel.mjs') continue; // the guard itself
      const source = readFileSync(path.join(toolsDir, name), 'utf8');
      if (source.includes(URL_DECLARATION)) declaring.push(name);
      if (source.includes('gateDevServer({ url })')) gated.push(name);
    }
    expect(declaring.sort()).toEqual([...GATED_TOOLS]);
    expect(gated.sort()).toEqual([...GATED_TOOLS]);
  });

  // Non-vacuity: the census must have SEEN the lookalikes and excluded them —
  // an empty tools directory or a broken read would otherwise pass the set
  // equality vacuously. card.mjs and licensing.mjs mention the URL in usage
  // prose only; they spawn shoot.mjs, whose own gate covers the drive.
  it('the census saw the whole directory, including the prose lookalikes it excluded', () => {
    expect(allTools.length).toBeGreaterThanOrEqual(30);
    expect(allTools).toContain('card.mjs');
    expect(allTools).toContain('licensing.mjs');
    const card = readFileSync(path.join(toolsDir, 'card.mjs'), 'utf8');
    expect(card).toContain('http://localhost:'); // the prose mention exists…
    expect(card).not.toContain(URL_DECLARATION); // …and is not a declaration
  });

  // Reddens on: dev-web.sh dropping either half of the handshake. A textual
  // pin, so its match COUNTS are asserted (a pattern with two witnesses
  // survives the mutation that breaks one of them — CLAUDE.md, the cut-in cap
  // lesson). It pins that the script still issues the calls; the CLI test
  // above is the proof the calls work.
  it('dev-web.sh writes the sentinel once and removes it once', () => {
    const script = readFileSync(DEV_WEB, 'utf8');
    const writes = script.split('"$SENTINEL_TOOL" write').length - 1;
    const removes = script.split('"$SENTINEL_TOOL" remove').length - 1;
    expect(writes).toBe(1);
    expect(removes).toBe(1);
    // The write must be inside the server-up branch (after the curl probe),
    // so a sentinel's existence keeps meaning "the server actually answered".
    expect(script.indexOf('"$SENTINEL_TOOL" write')).toBeGreaterThan(script.indexOf('curl -s -o /dev/null'));
    // The remove must come before the kill-by-port, so mid-restart there is
    // never a sentinel describing a server being killed.
    expect(script.indexOf('"$SENTINEL_TOOL" remove')).toBeLessThan(script.indexOf('fuser -k'));
  });
});
