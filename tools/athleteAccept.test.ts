/**
 * The post-delivery gate is driven as a subprocess against every outcome it
 * can reach without an athlete: nothing to accept (exit 2), a real file that
 * is not the athlete (exit 1 at intake, the later steps still reported), and
 * a `--web` request without a managed dev server (refused by the sentinel
 * gate, before any browser is launched). The one outcome it cannot reach —
 * exit 0 — needs an authored athlete, and is asserted absent, not assumed.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const TOOL = path.join(HERE, 'athleteAccept.mjs');
const SOURCE = readFileSync(TOOL, 'utf8');
/** Comments blanked: the header may NAME the gate it refuses to write; the code may not touch it. */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const QUICK_START = path.join(REPO, 'assets', 'dev', 'quick_start.riv');

function run(args: readonly string[] = [], env: Record<string, string> = {}): { status: number | null; out: string } {
  const r = spawnSync(process.execPath, [TOOL, ...args], { cwd: REPO, encoding: 'utf8', env: { ...process.env, ...env } });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

const scratch: string[] = [];
function scratchDir(): string {
  const d = mkdtempSync(path.join(tmpdir(), 'athlete-accept-'));
  scratch.push(d);
  return d;
}
afterEach(() => {
  for (const d of scratch.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('tools/athleteAccept.mjs', () => {
  it('with no athlete (isolated empty --dir): intake WAITING, corpus PASS, web SKIPPED, the human gates OWED, exit 2', () => {
    // The default assets/athlete/ may hold an authored file while the player
    // mount stays closed. The ASSET_MISSING arm is still owed — drive it
    // against an empty scratch tree, not against the repo default path.
    const dir = scratchDir();
    const room = path.join(dir, 'squat-room-side.jpg');
    // Room missing is reported as a note by intake; the WAITING verdict is
    // keyed on the athlete package, not the room.
    const r = run(['--dir', dir, '--room', room]);
    expect(r.status, r.out).toBe(2);
    expect(r.out).toContain('athlete-accept: intake: WAITING — ASSET_MISSING');
    expect(r.out).toContain('athlete-accept: corpus: PASS — 6 records current');
    expect(r.out).toContain('athlete-accept: web smoke: SKIPPED');
    expect(r.out).toContain('OWED (human, never claimed here): VISUAL, ANIMATION, SOFT-FEEL, OWNER PLAYTEST');
    expect(r.out).toContain('ATHLETE_ACCEPT: ASSET_MISSING');
    expect(r.out, 'no PASS verdict without an asset').not.toContain('ATHLETE_ACCEPT: PASS');
  });

  it('a real file that is not the athlete fails at intake with the contract verdict copied, and exits 1', () => {
    const dir = scratchDir();
    const riv = path.join(dir, 'athlete-01.riv');
    copyFileSync(QUICK_START, riv);
    writeFileSync(path.join(dir, 'athlete-01.rev'), '');
    writeFileSync(path.join(dir, 'athlete-01-reference-sheet.png'), '');
    const hash = createHash('sha256').update(readFileSync(riv)).digest('hex');
    writeFileSync(
      path.join(dir, 'ATHLETE-01-PROVENANCE.md'),
      ['# athlete-01 provenance', `SHA-256: ${hash}`, 'Licence: test', 'Artist: test', 'Marks: none', 'Editor source: athlete-01.rev'].join('\n'),
    );
    const r = run(['--dir', dir]);
    expect(r.status, r.out).toBe(1);
    expect(r.out).toContain('CONTRACT_NOT_SATISFIED');
    expect(r.out).toContain('athlete-accept: intake: FAIL');
    // The other mechanical step still reports; the verdict names the failed one.
    expect(r.out).toContain('athlete-accept: corpus: PASS');
    expect(r.out).toContain('ATHLETE_ACCEPT: FAIL — intake');
  });

  it('--web without a server started by tools/dev-web.sh is refused by the sentinel gate before any browser launches', () => {
    const r = run(['--web', '--url', 'http://localhost:1'], { UNMANAGED_DEV_SERVER: '' });
    expect(r.status, r.out).toBe(1);
    expect(r.out).toContain('tools/dev-web.sh');
    // The mechanical steps ran and were reported first, synchronously.
    expect(r.out).toContain('athlete-accept: intake:');
    expect(r.out).toContain('athlete-accept: corpus:');
    expect(r.out).not.toContain('athlete-accept: web smoke:');
    expect(r.out).not.toContain('ATHLETE_ACCEPT:');
  });

  it('declares the dev-server URL the house way and gates on it; never names the player-path gate or its tuning home', () => {
    expect(SOURCE).toContain("flag('url', 'http://localhost:8081')");
    expect(SOURCE).toContain('gateDevServer({ url })');
    expect(CODE).not.toMatch(/TRAINING_STAGE/);
    expect(CODE).not.toMatch(/spriteTuning/);
    expect(CODE).not.toMatch(/writeFileSync\([^)]*src\//);
    // NON-VACUITY: the header does name the gate, so the code-only view is what passed.
    expect(SOURCE).toMatch(/TRAINING_STAGE/);
    // Every intake verdict is copied from the subprocess; this tool decides nothing about the file itself.
    expect(SOURCE).toContain("run('athleteIntake.mjs'");
    expect(SOURCE).toContain("run('athleteTraces.mjs', ['check'])");
    expect(SOURCE).toContain('ASSET_MISSING');
    expect(SOURCE).toContain('BOUND, not DRIVEN');
  });
});
