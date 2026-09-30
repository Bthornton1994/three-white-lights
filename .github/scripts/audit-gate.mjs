/**
 * audit-gate.mjs — supply-chain step of the merge gate.
 *
 * This is not a GDD §12.2 bar and it does not grade Empire, Career, or art.
 * It asks whether the leaf advisories in `npm audit --json` are exactly the
 * remainder Session C already named, and whether the two package.json
 * overrides that closed the patchable pair are still in place.
 *
 * A raw `npm audit` exits 1 on that remainder (image-size, uuid). Treating
 * that exit as the gate would be red on the first run. Swallowing it with
 * `|| true` would never fail. The allowlist is the third shape: novelty is
 * red, the known three are not.
 *
 * --self-test plants a fourth GHSA and a missing one against the comparator
 * so empty-equals-empty cannot pass.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

/** Leaf advisories C named and ruled: do not force-fix (would downgrade Expo). */
const ALLOWED_GHSA = Object.freeze([
  'GHSA-w3rx-r6r6-pgpr', // image-size ICNS DoS
  'GHSA-5p2g-fcmc-qvqq', // image-size JXL/HEIF DoS
  'GHSA-w5hq-g745-h8pq', // uuid buffer bounds
]);

const REQUIRED_OVERRIDES = Object.freeze({
  'js-yaml': '4.3.2',
  nanoid: '3.3.18',
});

export function leafGhsas(audit) {
  const ids = new Set();
  for (const vuln of Object.values(audit.vulnerabilities ?? {})) {
    for (const via of vuln.via ?? []) {
      if (via === null || typeof via !== 'object') continue;
      const url = typeof via.url === 'string' ? via.url : '';
      const id = url.split('/').pop() ?? '';
      if (id.startsWith('GHSA-')) ids.add(id);
    }
  }
  return ids;
}

export function compareGhsas(found, allowed = ALLOWED_GHSA) {
  const allowedSet = new Set(allowed);
  const extra = [...found].filter((id) => !allowedSet.has(id)).sort();
  const missing = [...allowedSet].filter((id) => !found.has(id)).sort();
  return { extra, missing, ok: extra.length === 0 && missing.length === 0 };
}

export function overrideFindings(pkg, required = REQUIRED_OVERRIDES) {
  const overrides = pkg.overrides ?? {};
  const findings = [];
  for (const [name, version] of Object.entries(required)) {
    if (overrides[name] !== version) {
      findings.push(`${name}: expected ${version}, got ${overrides[name] ?? '(absent)'}`);
    }
  }
  return findings;
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function selfTest() {
  const allowed = leafGhsas({
    vulnerabilities: {
      a: {
        via: ALLOWED_GHSA.map((id) => ({ url: `https://github.com/advisories/${id}` })),
      },
    },
  });
  const exact = compareGhsas(allowed);
  if (!exact.ok) fail(`self-test: exact allowlist should pass, got ${JSON.stringify(exact)}`);

  const extra = compareGhsas(new Set([...ALLOWED_GHSA, 'GHSA-0000-planted-test']));
  if (extra.ok || extra.extra.join() !== 'GHSA-0000-planted-test') {
    fail(`self-test: planted extra GHSA was not caught: ${JSON.stringify(extra)}`);
  }

  const missing = compareGhsas(new Set(ALLOWED_GHSA.slice(1)));
  if (missing.ok || missing.missing.join() !== ALLOWED_GHSA[0]) {
    fail(`self-test: dropped allowlist GHSA was not caught: ${JSON.stringify(missing)}`);
  }

  const empty = compareGhsas(new Set());
  if (empty.ok) fail('self-test: empty found-set matched the allowlist');

  const pkgOk = overrideFindings({ overrides: { ...REQUIRED_OVERRIDES } });
  if (pkgOk.length !== 0) fail(`self-test: good overrides flagged: ${pkgOk.join('; ')}`);

  const pkgBad = overrideFindings({ overrides: {} });
  if (pkgBad.length !== 2) fail(`self-test: missing overrides not flagged: ${pkgBad.join('; ')}`);

  process.stdout.write('audit-gate self-test: ok\n');
}

function live() {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const ran = spawnSync(npm, ['audit', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    // npm.cmd on Windows refuses spawn without a shell; Ubuntu CI uses `npm`.
    shell: process.platform === 'win32',
  });
  if (ran.error) fail(`npm audit failed to start: ${ran.error.message}`);
  let audit;
  try {
    audit = JSON.parse(ran.stdout);
  } catch (err) {
    fail(`npm audit --json was not JSON (exit ${ran.status}): ${err.message}`);
  }

  const found = leafGhsas(audit);
  const cmp = compareGhsas(found);
  if (!cmp.ok) {
    const lines = ['npm audit leaf set is not the pinned remainder.'];
    if (cmp.extra.length > 0) lines.push(`new: ${cmp.extra.join(', ')}`);
    if (cmp.missing.length > 0) lines.push(`vanished: ${cmp.missing.join(', ')}`);
    lines.push(`found: ${[...found].sort().join(', ') || '(none)'}`);
    fail(lines.join('\n'));
  }

  const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const pins = overrideFindings(pkg);
  if (pins.length > 0) fail(`package.json overrides drifted:\n${pins.join('\n')}`);

  process.stdout.write(
    `audit-gate: ${ALLOWED_GHSA.length} known leaf advisories, overrides intact\n`,
  );
}

if (process.argv.includes('--self-test')) selfTest();
else live();
