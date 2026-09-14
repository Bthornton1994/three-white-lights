/**
 * fetch-freeze-shas.mjs — fetch only the commits freeze guards git-diff against.
 *
 * Freeze tests (`src/game/a2LifterFreeze.test.ts` and any later *Freeze* file
 * that `git diff --name-only`s a historical SHA) fail on a depth=1 checkout
 * with `fatal: bad revision`. fetch-depth: 0 pulled the whole history so those
 * objects existed. This script fetches those commits and no others.
 *
 * Do not delete the guards. This file does not replace them. --self-test
 * fails if the freeze tests stop naming git-diff SHAs, or if FREEZE_COMMITS
 * drifts from those names.
 *
 * Not a GDD §12.2 bar. Not a StageForge adapter. Does not install Playwright.
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

/**
 * Full objects GitHub will serve to `git fetch origin <sha>`.
 * Each must be the freeze SHA a guard actually diffs against (prefix match).
 * A0 PLAYABLE SPORT `39400d97`. A1 closed `3cee186c`.
 */
export const FREEZE_COMMITS = Object.freeze([
  '39400d9790597f53a1665d8bf6eea76736d2e9cb',
  '3cee186cf1773afd54985cff978920e38d4bd60e',
]);

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

export function isFreezeGuardSource(source) {
  if (source.includes('gitDiffNames') && source.includes('--name-only')) return true;
  const hasDiffArg = source.includes("['diff'") || source.includes('["diff"');
  return hasDiffArg && source.includes('--name-only');
}

export function listFreezeGuardFiles(root = ROOT) {
  const out = [];
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (name === 'node_modules' || name === '.git') continue;
        walk(full);
        continue;
      }
      if (!name.endsWith('.test.ts')) continue;
      const src = readFileSync(full, 'utf8');
      if (isFreezeGuardSource(src)) out.push(full);
    }
  }
  walk(path.join(root, 'src'));
  return out.sort();
}

/**
 * SHAs freeze guards pass to `gitDiffNames` / `git diff --name-only`.
 * Comment-only hashes are ignored so a restated history note cannot fetch
 * a commit the suite never diffs against.
 */
export function extractFreezeShas(source) {
  const consts = new Map();
  for (const match of source.matchAll(
    /\bconst\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*['"]([0-9a-f]{7,40})['"]/g,
  )) {
    consts.set(match[1], match[2]);
  }

  const shas = new Set();
  for (const match of source.matchAll(/\bgitDiffNames\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,/g)) {
    const sha = consts.get(match[1]);
    if (sha !== undefined) shas.add(sha);
  }
  for (const match of source.matchAll(/\bgitDiffNames\(\s*['"]([0-9a-f]{7,40})['"]/g)) {
    shas.add(match[1]);
  }
  return [...shas].sort();
}

export function freezeShasFromTree(root = ROOT) {
  const files = listFreezeGuardFiles(root);
  const shas = new Set();
  for (const file of files) {
    for (const sha of extractFreezeShas(readFileSync(file, 'utf8'))) shas.add(sha);
  }
  return { files, shas: [...shas].sort() };
}

export function commitsCoverShas(fullCommits, shorts) {
  const missing = [];
  for (const short of shorts) {
    const covered = fullCommits.some((full) => full.startsWith(short) || short.startsWith(full));
    if (!covered) missing.push(short);
  }
  const unused = fullCommits.filter(
    (full) => !shorts.some((short) => full.startsWith(short) || short.startsWith(full)),
  );
  return { missing, unused, ok: missing.length === 0 && unused.length === 0 };
}

function git(args, opts = {}) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    ...opts,
  });
}

export function hasCommit(sha) {
  try {
    git(['cat-file', '-e', `${sha}^{commit}`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function fetchCommits(shas) {
  const needed = shas.filter((sha) => !hasCommit(sha));
  if (needed.length === 0) {
    process.stdout.write('fetch-freeze-shas: freeze commits already present\n');
    return;
  }
  git(['fetch', '--no-tags', '--depth=1', 'origin', ...needed], { stdio: 'inherit' });
}

function selfTest() {
  const planted = `
    const A0 = '39400d97';
    const A1_CLOSED = '3cee186c';
    const COMMENT_ONLY = 'aaaaaaaa';
    function gitDiffNames(against, ...paths) {}
    gitDiffNames(A0, 'src/game/lift.ts');
    gitDiffNames(A1_CLOSED, 'src/empire');
  `;
  const extracted = extractFreezeShas(planted);
  if (extracted.join(',') !== '39400d97,3cee186c') {
    fail(`self-test: extractor missed freeze SHAs: ${extracted.join(',')}`);
  }
  if (extracted.includes('aaaaaaaa')) {
    fail('self-test: comment-only SHA was extracted');
  }

  const empty = extractFreezeShas("const A0 = '39400d97';\n// no gitDiffNames call\n");
  if (empty.length !== 0) fail(`self-test: unused const was extracted: ${empty.join(',')}`);

  const cover = commitsCoverShas(FREEZE_COMMITS, ['39400d97', '3cee186c']);
  if (!cover.ok) fail(`self-test: known freeze SHAs must match FREEZE_COMMITS: ${JSON.stringify(cover)}`);

  const drifted = commitsCoverShas(FREEZE_COMMITS, ['39400d97']);
  if (drifted.ok || drifted.unused.length !== 1) {
    fail(`self-test: unused full SHA was not caught: ${JSON.stringify(drifted)}`);
  }

  const missing = commitsCoverShas(FREEZE_COMMITS, ['39400d97', '3cee186c', 'deadbee']);
  if (missing.ok || missing.missing.join() !== 'deadbee') {
    fail(`self-test: new freeze SHA was not caught: ${JSON.stringify(missing)}`);
  }

  const live = freezeShasFromTree(ROOT);
  if (live.files.length === 0) {
    fail('self-test: no freeze guard files remain under src/ (do not delete the guards)');
  }
  if (live.shas.length === 0) {
    fail('self-test: freeze guards no longer name git-diff SHAs (do not delete the guards)');
  }
  const liveRel = live.files.map((f) => path.relative(ROOT, f));
  if (!liveRel.some((f) => f.replaceAll('\\', '/') === 'src/game/a2LifterFreeze.test.ts')) {
    fail(`self-test: a2LifterFreeze.test.ts is no longer a freeze guard: ${liveRel.join(', ')}`);
  }
  if (!isFreezeGuardSource(readFileSync(path.join(ROOT, 'src/game/a2LifterFreeze.test.ts'), 'utf8'))) {
    fail('self-test: a2LifterFreeze.test.ts no longer matches the freeze-guard detector');
  }
  if (isFreezeGuardSource('const A0 = "39400d97";\n')) {
    fail('self-test: a SHA mention without gitDiffNames was treated as a guard');
  }
  const liveCover = commitsCoverShas(FREEZE_COMMITS, live.shas);
  if (!liveCover.ok) {
    fail(
      `self-test: FREEZE_COMMITS drifted from freeze guards.\n` +
        `files: ${live.files.map((f) => path.relative(ROOT, f)).join(', ')}\n` +
        `guard SHAs: ${live.shas.join(', ')}\n` +
        `missing from FREEZE_COMMITS: ${liveCover.missing.join(', ') || '(none)'}\n` +
        `unused FREEZE_COMMITS: ${liveCover.unused.join(', ') || '(none)'}`,
    );
  }

  process.stdout.write(
    `fetch-freeze-shas self-test: ok (${live.shas.length} freeze SHA(s) in ${live.files.length} guard file(s))\n`,
  );
}

function live() {
  const live = freezeShasFromTree(ROOT);
  if (live.files.length === 0 || live.shas.length === 0) {
    fail('freeze guards missing; refusing to skip history fetch by deleting them');
  }
  const cover = commitsCoverShas(FREEZE_COMMITS, live.shas);
  if (!cover.ok) {
    fail(
      `FREEZE_COMMITS does not cover freeze-guard SHAs: ${JSON.stringify({ ...cover, shas: live.shas })}`,
    );
  }

  fetchCommits(FREEZE_COMMITS);

  const unresolved = live.shas.filter((sha) => !hasCommit(sha));
  if (unresolved.length > 0) {
    fail(`freeze SHAs still missing after fetch: ${unresolved.join(', ')}`);
  }

  process.stdout.write(
    `fetch-freeze-shas: ${live.shas.join(', ')} present for ${live.files
      .map((f) => path.relative(ROOT, f))
      .join(', ')}\n`,
  );
}

if (process.argv.includes('--self-test')) selfTest();
else live();
