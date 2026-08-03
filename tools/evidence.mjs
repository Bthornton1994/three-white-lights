#!/usr/bin/env node
/**
 * Produces a machine-output evidence bundle for a critic to read.
 *
 * The critic agent's tool allowlist is read-only and has no Bash, so a critic
 * cannot run the suite itself — but the run's whole premise is that critics
 * judge actual test results rather than a builder's claims about them. This
 * script runs the real commands and captures their raw output verbatim, so the
 * critic reads machine output rather than any agent's prose. It deliberately
 * does not summarise, interpret, or filter: a failing run must look failing.
 *
 * Usage: node tools/evidence.mjs <piece-id> [testPathPattern]
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const piece = process.argv[2];
if (!piece) {
  console.error('usage: node tools/evidence.mjs <piece-id> [testPathPattern]');
  process.exit(2);
}
const pattern = process.argv[3] === '--verify' ? null : (process.argv[3] ?? null);
const verifyOnly = process.argv.includes('--verify');

const run = (label, cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', timeout: 600_000 });
  const body = `${r.stdout ?? ''}${r.stderr ?? ''}`.trimEnd();
  return [
    `${'='.repeat(70)}`,
    `$ ${cmd} ${args.join(' ')}`,
    `[${label}] exit code: ${r.status}${r.error ? ` (${r.error.message})` : ''}`,
    `${'='.repeat(70)}`,
    body || '(no output)',
    '',
  ].join('\n');
};

/**
 * Provenance, so a critic can tell a stale bundle from a current one.
 *
 * This exists because a stale bundle already reached a critic once: it was
 * generated before a rebuild landed and still listed the pre-rebuild tests, so
 * the new bounds it was asked to judge were absent from the evidence entirely.
 * The critic only caught it by noticing the bundle's clock was older than the
 * screenshots' — sharp of it, but luck, not design. A timestamp alone cannot be
 * checked against anything; a commit can.
 *
 * `dirty` matters as much as the SHA: a bundle produced from an uncommitted
 * tree describes code that is not in any commit, so the SHA alone would be a
 * lie of omission.
 */
const git = (args) => {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  return r.status === 0 ? (r.stdout ?? '').trim() : '(unavailable)';
};
const head = git(['rev-parse', 'HEAD']);
// `.gauntlet/` holds evidence bundles and the progress page — run artefacts, not
// code under test. Regenerating one bundle dirties the tree for the next, so
// counting them made every bundle after the first report inherited dirt it had
// caused itself. Only code the tests actually exercise belongs in this signal.
//
// Parse the PATH rather than slicing a fixed column: `git()` trims its output,
// which eats the leading status space of the first porcelain line only, so a
// column-based filter silently let exactly one entry through — the first. That
// is the same shape of bug as everything else this header exists to catch, so
// it is worth the two extra lines to read the field instead of its offset.
const dirtyPath = (line) => line.replace(/^\s*\S+\s+/, '').replace(/^.*? -> /, '');
const dirty = git(['status', '--porcelain'])
  .split('\n')
  .filter((line) => line.trim() !== '')
  .map(dirtyPath)
  .filter((p) => !p.startsWith('.gauntlet/'));

/**
 * `--verify`: exit non-zero if this piece's bundle does not describe HEAD.
 *
 * Regenerating a bundle and then merging something else before dispatching a
 * critic has now burned two grading cycles — both times the critic caught it by
 * reading the stamp, which is the system working, but it is a whole agent spent
 * on bookkeeping. This makes the check a command instead of a habit: run it
 * immediately before dispatching and the stale case cannot get past.
 */
if (verifyOnly) {
  const existing = (() => {
    try {
      return readFileSync(path.join(ROOT, '.gauntlet', 'evidence', `${piece}.txt`), 'utf8');
    } catch {
      return null;
    }
  })();
  if (existing === null) {
    console.error(`STALE: no evidence bundle for "${piece}" — generate one before grading.`);
    process.exit(1);
  }
  const stamped = /^commit ([0-9a-f]{40})$/m.exec(existing)?.[1] ?? null;
  if (stamped === null) {
    console.error(`STALE: ${piece}.txt predates commit stamping — regenerate it.`);
    process.exit(1);
  }
  // An exact SHA match is the WRONG test, and a critic caught me writing it: a
  // bundle produced at commit X is itself committed by commit Y, so it can never
  // stamp the commit it lives in. What matters is not whether the SHA moved but
  // whether any CODE moved under it — a bundle still describes the tree if every
  // commit since only touched run artefacts or docs.
  if (stamped !== head) {
    const changed = git(['diff', '--name-only', `${stamped}..${head}`, '--', 'src', 'package.json', 'tsconfig.json', 'vitest.config.ts'])
      .split('\n')
      .filter((line) => line.trim() !== '');
    if (changed.length > 0) {
      console.error(
        `STALE: ${piece}.txt describes ${stamped.slice(0, 8)}, and code changed since: ${changed.join(', ')}. Regenerate before grading.`,
      );
      process.exit(1);
    }
    console.log(`ok: ${piece}.txt stamps ${stamped.slice(0, 8)} (HEAD ${head.slice(0, 8)}), but no code changed since`);
  }
  if (dirty.length > 0) {
    console.error(`STALE: working tree has uncommitted code (${dirty.join(', ')}) — the bundle cannot describe it.`);
    process.exit(1);
  }
  console.log(`ok: ${piece}.txt describes HEAD (${head.slice(0, 8)}), tree clean`);
  process.exit(0);
}

const parts = [
  `EVIDENCE BUNDLE — piece ${piece}`,
  `generated ${new Date().toISOString()}`,
  `repo ${ROOT}`,
  `commit ${head}`,
  `working tree ${dirty.length === 0 ? 'clean (ignoring .gauntlet/ run artefacts)' : `DIRTY — ${dirty.length} uncommitted code file(s): ${dirty.join(', ')}`}`,
  '',
  'This file is raw, unedited output of the commands shown. It is produced by',
  'the run harness, not by the agent that wrote the code under test.',
  '',
  'CHECK THE COMMIT ABOVE against the code you were asked to grade. If it does',
  'not match, this bundle describes different code and its results do not apply',
  '— report the evidence as stale rather than grading against it.',
  '',
];

parts.push(run('tests', 'npx', ['vitest', 'run', ...(pattern ? [pattern] : []), '--reporter=verbose']));
parts.push(run('typecheck', 'npx', ['tsc', '--noEmit']));

const outDir = path.join(ROOT, '.gauntlet', 'evidence');
mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `${piece}.txt`);
writeFileSync(out, parts.join('\n'), 'utf8');
console.log(`wrote ${out}`);
