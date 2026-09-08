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

function run(dir?: string, room?: string): { status: number | null; out: string } {
  const args = [TOOL, ...(dir ? ['--dir', dir] : []), ...(room ? ['--room', room] : [])];
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

  it('rejects a malformed provenance package — binary bytes, JSON, or the right words in the wrong grammar — naming every line', () => {
    const dir = scratchDir();
    copyFileSync(QUICK_START, path.join(dir, 'athlete-01.riv'));
    writeFileSync(path.join(dir, 'athlete-01.rev'), '');
    writeFileSync(path.join(dir, 'athlete-01-reference-sheet.png'), '');
    const malformed: readonly [string, Buffer | string][] = [
      ['binary', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0xfe, 0x0d, 0x0a, 0x1a, 0x0a])],
      ['json', JSON.stringify({ 'SHA-256': 'abc', Licence: 'x', Artist: 'y', Marks: 'none', 'Editor source': 'athlete-01.rev' })],
      ['prose', 'The SHA-256 is fine and the licence is owned; the artist attests there are no marks; editor source is the rev.'],
    ];
    for (const [label, body] of malformed) {
      writeFileSync(path.join(dir, 'ATHLETE-01-PROVENANCE.md'), body);
      const r = run(dir);
      expect(r.status, label).toBe(1);
      expect(r.out, label).toContain('PROVENANCE_INCOMPLETE');
      // Every attested line is reported missing — a package with no readable
      // `Key: value` line has none of the five, and the report says so.
      expect(r.out, label).toMatch(/missing: line `SHA-256:`/);
      expect(r.out, label).toMatch(/missing: line `Licen\[cs\]e:`/);
      expect(r.out, label).toMatch(/missing: line `\(Author\|Artist\):`/);
      expect(r.out, label).toMatch(/missing: line `Marks:`/);
      expect(r.out, label).toMatch(/missing: line `Editor source:`/);
      expect(r.out, `${label}: the hash is not compared`).not.toContain('HASH_MISMATCH');
      expect(r.out, `${label}: the contract is not asked`).not.toContain('step 2');
    }
  });

  it('rejects a package missing only the .rev, and one missing only the reference sheet, naming exactly the absent sibling', () => {
    for (const absent of ['athlete-01.rev', 'athlete-01-reference-sheet.png'] as const) {
      const dir = scratchDir();
      copyFileSync(QUICK_START, path.join(dir, 'athlete-01.riv'));
      for (const sibling of ['athlete-01.rev', 'athlete-01-reference-sheet.png']) {
        if (sibling !== absent) writeFileSync(path.join(dir, sibling), '');
      }
      writeFileSync(path.join(dir, 'ATHLETE-01-PROVENANCE.md'), fullProvenance(path.join(dir, 'athlete-01.riv')));
      const r = run(dir);
      expect(r.status, absent).toBe(1);
      expect(r.out, absent).toContain('PROVENANCE_INCOMPLETE');
      expect(r.out, absent).toContain(`missing: ${absent} beside the .riv`);
      const missingLines = r.out.split('\n').filter((l) => l.includes('  missing: '));
      expect(missingLines, `${absent}: exactly one item is missing`).toHaveLength(1);
      expect(r.out, absent).not.toContain('step 2');
    }
  });

  it('reads the attested SHA-256 case-insensitively — an uppercase hash is the same attestation', () => {
    const dir = scratchDir();
    copyFileSync(QUICK_START, path.join(dir, 'athlete-01.riv'));
    writeFileSync(path.join(dir, 'athlete-01.rev'), '');
    writeFileSync(path.join(dir, 'athlete-01-reference-sheet.png'), '');
    const upper = fullProvenance(path.join(dir, 'athlete-01.riv')).replace(/^SHA-256: (.+)$/m, (_m, h: string) => `SHA-256: ${h.toUpperCase()}`);
    expect(upper).toMatch(/SHA-256: [0-9A-F]{64}/);
    writeFileSync(path.join(dir, 'ATHLETE-01-PROVENANCE.md'), upper);
    const r = run(dir);
    expect(r.out).toContain('step 1 ok');
    expect(r.out, 'then the contract decides').toContain('CONTRACT_NOT_SATISFIED');
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

  it('step 0 — reports the missing room plate as a note, never a rejection, at the default location', () => {
    const r = run();
    expect(r.out).toContain('step 0 note: room plate assets/iron-amber/squat-room-side.jpg is not there yet');
    expect(r.out).toContain('ASSET_MISSING');
    expect(r.status).toBe(2);
  });

  it('step 0 — refuses every existing painted squat scene by name, before reading the rig at all', () => {
    for (const scene of ['squat-brace.jpg', 'squat-hole.jpg', 'squat-drive.jpg']) {
      const r = run(undefined, path.join('assets', 'iron-amber', scene));
      expect(r.status, scene).toBe(1);
      expect(r.out, scene).toContain('ROOM_PLATE_IS_A_SCENE');
      expect(r.out, 'the rig is not looked at once the room is refused').not.toContain('ASSET_MISSING');
    }
  });

  it('step 0 — rejects a real JPEG of the wrong size and accepts one of the right size', () => {
    // gym-briefing.jpg is a real 1008 x 1792 plate: right family, wrong lens.
    const wrong = run(undefined, path.join('assets', 'iron-amber', 'gym-briefing.jpg'));
    expect(wrong.status).toBe(1);
    expect(wrong.out).toContain('ROOM_PLATE_WRONG_SIZE');
    expect(wrong.out).toContain('1008 x 1792');
    // A 1152 x 1728 JPEG under a NEW name passes the size gate — the only
    // real one in the tree is a painted scene, so it is copied under the
    // room's name into scratch. The by-name refusal is keyed on the basename
    // alone, which this copy does not carry: the tool can refuse the direct
    // re-use it can see and cannot tell a painted room from an empty one by
    // content — that judgement is the reviewer's, and the header says so.
    const dir = scratchDir();
    const room = path.join(dir, 'squat-room-side.jpg');
    copyFileSync(path.join(REPO, 'assets', 'iron-amber', 'squat-brace.jpg'), room);
    const right = run(undefined, room);
    expect(right.out).toContain('step 0 ok');
    expect(right.out).toContain('1152 x 1728');
    expect(right.out, 'then the rig check proceeds').toContain('ASSET_MISSING');
    expect(right.status).toBe(2);
  });

  it('names the five remaining steps in order in its source, ending at the human gate', () => {
    const src = readFileSync(TOOL, 'utf8');
    const steps = [...src.matchAll(/step: (\d)/g)].map((m) => Number(m[1]));
    expect(steps).toEqual([4, 5, 6, 7, 8]);
    expect(src).toContain('OWNER PLAYTEST is Bryant');
    expect(src, 'it declares no dev-server URL').not.toMatch(/localhost:8081|127\.0\.0\.1:8081/);
  });
});
