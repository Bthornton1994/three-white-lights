/**
 * The intake command is driven end to end against every mechanical outcome
 * it can reach today: no asset, a package with missing lines, a package
 * whose hash names other bytes, and a complete package around a file the
 * contract refuses. The one outcome it cannot reach — exit 0 — needs an
 * authored athlete, and its absence is asserted rather than assumed.
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
const TOOL = path.join(HERE, 'athleteIntake.mjs');
const QUICK_START = path.join(REPO, 'assets', 'dev', 'quick_start.riv');
const PLACEHOLDER = path.join(REPO, 'assets', 'dev', 'rive-spike.riv');

function run(dir?: string): { status: number | null; out: string } {
  const args = [TOOL, ...(dir ? ['--dir', dir] : [])];
  const r = spawnSync(process.execPath, args, { cwd: REPO, encoding: 'utf8' });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

const scratch: string[] = [];
function scratchDir(): string {
  const d = mkdtempSync(path.join(tmpdir(), 'athlete-intake-'));
  scratch.push(d);
  return d;
}
afterEach(() => {
  for (const d of scratch.splice(0)) rmSync(d, { recursive: true, force: true });
});

function fullProvenance(rivPath: string): string {
  const hash = createHash('sha256').update(readFileSync(rivPath)).digest('hex');
  return [
    '# athlete-01 provenance',
    '',
    `SHA-256: ${hash}`,
    'Licence: owned outright; agreement filed',
    'Artist: a fictional person for this test',
    'Marks: none — no federation, brand, sponsor or likeness',
    'Editor source: athlete-01.rev',
  ].join('\n');
}

describe('tools/athleteIntake.mjs', () => {
  it('reports ASSET_MISSING with exit 2 at the default location — no athlete has arrived', () => {
    expect(existsSync(path.join(REPO, 'assets', 'athlete', 'athlete-01.riv'))).toBe(false);
    const r = run();
    expect(r.status).toBe(2);
    expect(r.out).toContain('INTAKE_WAITING: ASSET_MISSING');
  });

  it('rejects at step 1 when the provenance package is absent or short, naming every missing item', () => {
    const dir = scratchDir();
    copyFileSync(QUICK_START, path.join(dir, 'athlete-01.riv'));
    let r = run(dir);
    expect(r.status).toBe(1);
    expect(r.out).toContain('PROVENANCE_INCOMPLETE');
    expect(r.out).toContain('ATHLETE-01-PROVENANCE.md (the package itself)');

    writeFileSync(path.join(dir, 'ATHLETE-01-PROVENANCE.md'), 'SHA-256: 00\nLicence: x\n');
    r = run(dir);
    expect(r.status).toBe(1);
    expect(r.out).toContain('PROVENANCE_INCOMPLETE');
    expect(r.out).toMatch(/missing: line `\(Author\|Artist\):`/);
    expect(r.out).toMatch(/missing: line `Marks:`/);
    expect(r.out).toMatch(/missing: line `Editor source:`/);
    expect(r.out).toContain('missing: athlete-01.rev beside the .riv');
    expect(r.out).toContain('missing: athlete-01-reference-sheet.png beside the .riv');
    expect(r.out, 'the hash is not compared before the package is complete').not.toContain('HASH_MISMATCH');
  });

  it('rejects at step 1 when the attested SHA-256 names other bytes', () => {
    const dir = scratchDir();
    copyFileSync(QUICK_START, path.join(dir, 'athlete-01.riv'));
    writeFileSync(path.join(dir, 'athlete-01.rev'), '');
    writeFileSync(path.join(dir, 'athlete-01-reference-sheet.png'), '');
    // A complete package whose hash is the PLACEHOLDER's, not this file's.
    writeFileSync(path.join(dir, 'ATHLETE-01-PROVENANCE.md'), fullProvenance(PLACEHOLDER));
    const r = run(dir);
    expect(r.status).toBe(1);
    expect(r.out).toContain('PROVENANCE_HASH_MISMATCH');
    expect(r.out).not.toContain('step 2');
  });

  it('reaches step 2 on a complete package and rejects a real file that is not the athlete', () => {
    const dir = scratchDir();
    copyFileSync(QUICK_START, path.join(dir, 'athlete-01.riv'));
    writeFileSync(path.join(dir, 'athlete-01.rev'), '');
    writeFileSync(path.join(dir, 'athlete-01-reference-sheet.png'), '');
    writeFileSync(path.join(dir, 'ATHLETE-01-PROVENANCE.md'), fullProvenance(path.join(dir, 'athlete-01.riv')));
    const r = run(dir);
    expect(r.status).toBe(1);
    expect(r.out).toContain('step 1 ok');
    expect(r.out).toContain('CONTRACT_NOT_SATISFIED');
    expect(r.out).toContain('squat');
    expect(r.out, 'the remaining steps are not printed for a rejected file').not.toContain('INTAKE_MECHANICAL_CHECKS_PASSED');
  });

  it('rejects the invalid placeholder the same way — the contract command decides, not this tool', () => {
    const dir = scratchDir();
    copyFileSync(PLACEHOLDER, path.join(dir, 'athlete-01.riv'));
    writeFileSync(path.join(dir, 'athlete-01.rev'), '');
    writeFileSync(path.join(dir, 'athlete-01-reference-sheet.png'), '');
    writeFileSync(path.join(dir, 'ATHLETE-01-PROVENANCE.md'), fullProvenance(path.join(dir, 'athlete-01.riv')));
    const r = run(dir);
    expect(r.status).toBe(1);
    expect(r.out).toContain('CONTRACT_NOT_SATISFIED');
  });

  it('names the five remaining steps in order in its source, ending at the human gate', () => {
    const src = readFileSync(TOOL, 'utf8');
    const steps = [...src.matchAll(/step: (\d)/g)].map((m) => Number(m[1]));
    expect(steps).toEqual([4, 5, 6, 7, 8]);
    expect(src).toContain('OWNER PLAYTEST is Bryant');
    expect(src, 'it declares no dev-server URL').not.toMatch(/localhost:8081|127\.0\.0\.1:8081/);
  });
});
