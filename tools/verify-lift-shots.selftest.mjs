#!/usr/bin/env node
/**
 * Self-test for `verify-lift-shots.mjs`.
 *
 * A verifier nobody has broken on purpose is a verifier nobody knows works.
 * This copies a real captured sequence, injects each failure the tool exists to
 * catch, and asserts the tool rejects it. The first mutant is the exact one that
 * shipped before: three copies of one resolved frame, byte-distinguished only by
 * a stray glyph.
 *
 * Usage: node tools/verify-lift-shots.selftest.mjs [--root .gauntlet/shots]
 */
import { cp, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const VERIFIER = path.join(HERE, 'verify-lift-shots.mjs');

const args = process.argv.slice(2);
const flagAt = args.indexOf('--root');
const sourceRoot = path.resolve(flagAt === -1 ? '.gauntlet/shots' : args[flagAt + 1]);

async function verify(root) {
  try {
    await run(process.execPath, [VERIFIER, '--root', root], { maxBuffer: 1 << 24 });
    return { ok: true, output: '' };
  } catch (e) {
    return { ok: false, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

async function withCopy(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'lift-shots-'));
  await cp(sourceRoot, dir, { recursive: true });
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function editManifest(root, seq, edit) {
  const file = path.join(root, seq, 'manifest.json');
  const manifest = JSON.parse(await readFile(file, 'utf8'));
  edit(manifest);
  await writeFile(file, JSON.stringify(manifest, null, 2));
}

const MUTANTS = [
  {
    name: 'THE ORIGINAL FAILURE: three shots are all the resolved frame',
    apply: async (root) => {
      await editManifest(root, 'L1-maximal', (m) => {
        const resolved = m.shots.find((s) => s.moment === 'result');
        for (const moment of ['descent', 'hole', 'losing']) {
          const shot = m.shots.find((s) => s.moment === moment);
          shot.probe = { ...resolved.probe, moment };
        }
      });
      // ...and give each a distinct byte, exactly as a dev-menu glyph did.
      for (const moment of ['01-descent', '03-hole', '05-losing']) {
        const src = path.join(root, 'L1-maximal', '08-result.png');
        const dst = path.join(root, 'L1-maximal', `${moment}.png`);
        const bytes = Buffer.concat([await readFile(src), Buffer.from(moment)]);
        await writeFile(dst, bytes);
      }
    },
  },
  {
    name: 'a shot is in the wrong phase',
    apply: (root) =>
      editManifest(root, 'L1-maximal', (m) => {
        m.shots.find((s) => s.moment === 'losing').probe.phase = 'LOCKOUT';
      }),
  },
  {
    name: 'the rep never lost anywhere (no grind)',
    apply: (root) =>
      editManifest(root, 'L1-maximal', (m) => {
        for (const shot of m.shots) if (shot.probe.netForce < 0) shot.probe.netForce = 0.1;
      }),
  },
  {
    name: 'the maximal attempt never reaches the top strain rung',
    apply: (root) =>
      editManifest(root, 'L1-maximal', (m) => {
        for (const shot of m.shots) shot.probe.strainLevel = Math.min(shot.probe.strainLevel, 2);
      }),
  },
  {
    name: 'the maximal attempt draws no heavier than the light one',
    apply: (root) =>
      editManifest(root, 'L1-maximal', (m) => {
        for (const shot of m.shots) shot.probe.strainLevel = 0;
      }),
  },
  {
    name: 'no shot is anywhere near the sticking point',
    apply: (root) =>
      editManifest(root, 'L1-maximal', (m) => {
        for (const shot of m.shots) if (shot.probe.phase === 'ASCENT') shot.probe.height = 0.05;
      }),
  },
  {
    name: 'the replay route never engaged, so a shot has no probe',
    apply: (root) =>
      editManifest(root, 'L1-light', (m) => {
        m.shots.find((s) => s.moment === 'hole').probe = null;
      }),
  },
  {
    name: 'the renderer showed a stale frame for a different sprite spec',
    apply: async (root) => {
      const src = path.join(root, 'L1-maximal', 'stage', '05-losing.png');
      const dst = path.join(root, 'L1-maximal', 'stage', '06-sticking-point.png');
      await writeFile(dst, await readFile(src));
    },
  },
  {
    name: 'the captured rep was a miss',
    apply: (root) =>
      editManifest(root, 'L1-maximal', (m) => {
        m.shots.find((s) => s.moment === 'result').probe.outcome = 'miss';
      }),
  },
];

const baseline = await verify(sourceRoot);
if (!baseline.ok) {
  console.error('BASELINE FAILED — the real sequence does not pass, so nothing below means anything');
  console.error(baseline.output);
  process.exit(2);
}

const survived = [];
for (const mutant of MUTANTS) {
  // eslint-disable-next-line no-await-in-loop
  const caught = await withCopy(async (root) => {
    await mutant.apply(root);
    return !(await verify(root)).ok;
  });
  console.log(`${caught ? 'caught  ' : 'SURVIVED'}  ${mutant.name}`);
  if (!caught) survived.push(mutant.name);
}

console.log(`\n${MUTANTS.length - survived.length}/${MUTANTS.length} mutants caught`);
process.exit(survived.length === 0 ? 0 : 1);
