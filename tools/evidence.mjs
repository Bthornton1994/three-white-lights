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
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const piece = process.argv[2];
if (!piece) {
  console.error('usage: node tools/evidence.mjs <piece-id> [testPathPattern]');
  process.exit(2);
}
const pattern = process.argv[3] ?? null;

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

const parts = [
  `EVIDENCE BUNDLE — piece ${piece}`,
  `generated ${new Date().toISOString()}`,
  `repo ${ROOT}`,
  '',
  'This file is raw, unedited output of the commands shown. It is produced by',
  'the run harness, not by the agent that wrote the code under test.',
  '',
];

parts.push(run('tests', 'npx', ['vitest', 'run', ...(pattern ? [pattern] : []), '--reporter=verbose']));
parts.push(run('typecheck', 'npx', ['tsc', '--noEmit']));

const outDir = path.join(ROOT, '.gauntlet', 'evidence');
mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `${piece}.txt`);
writeFileSync(out, parts.join('\n'), 'utf8');
console.log(`wrote ${out}`);
