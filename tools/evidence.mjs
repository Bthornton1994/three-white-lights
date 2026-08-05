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
import { createHash } from 'node:crypto';
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
// Parse the PATH rather than slicing a fixed column: `git()` trims its output,
// which eats the leading status space of the first porcelain line only, so a
// column-based filter silently let exactly one entry through — the first. That
// is the same shape of bug as everything else this header exists to catch, so
// it is worth the two extra lines to read the field instead of its offset.
const dirtyPath = (line) => line.replace(/^\s*\S+\s+/, '').replace(/^.*? -> /, '');

/**
 * What this check is allowed to ignore, and why it is a LIST and not a PREFIX.
 *
 * The exclusion started as `!p.startsWith('.gauntlet/')`, for a real reason:
 * this script writes `.gauntlet/evidence/<piece>.txt`, so a bundle that counted
 * it would report dirt it had just caused itself, and every bundle after the
 * first inherited the last one's.
 *
 * That reason covers exactly two paths, and the prefix covered the whole tree.
 * A critic found the hole it left. `.gauntlet/shots/shell/` and
 * `.gauntlet/shots/cutin/` were un-ignored in `.gitignore` SPECIFICALLY so a
 * grader could open committed, datable pixels instead of trusting undated ones
 * — and this filter made `--verify` structurally blind to the one directory
 * that existed for verification. A `route.json` self-describing a different
 * commit, a DIRTY tree and three failures sat in the graded artifact and
 * `--verify` said "tree clean". The tool whose entire job is catching stale
 * evidence could not see stale evidence.
 *
 * So: name the self-dirtying files. Anything else under `.gauntlet/` is graded
 * output and belongs in the signal — if committed pixels no longer match the
 * tree, that is precisely the thing worth failing on.
 */
const SELF_DIRTYING = [
  // Written by this script, on this run, before the check would read it.
  '.gauntlet/evidence/',
  // The progress page's data file. Not code, not graded; updated continuously
  // as pieces land, and never something a bundle's results depend on.
  '.gauntlet/state.json',
];
const dirty = git(['status', '--porcelain'])
  .split('\n')
  .filter((line) => line.trim() !== '')
  .map(dirtyPath)
  .filter((p) => !SELF_DIRTYING.some((prefix) => p.startsWith(prefix)));

/**
 * `--verify`: exit non-zero if this piece's bundle does not describe HEAD.
 *
 * Regenerating a bundle and then merging something else before dispatching a
 * critic has now burned two grading cycles — both times the critic caught it by
 * reading the stamp, which is the system working, but it is a whole agent spent
 * on bookkeeping. This makes the check a command instead of a habit: run it
 * immediately before dispatching and the stale case cannot get past.
 */
/**
 * Committed browser evidence must describe HEAD too, and say so out of its own
 * mouth.
 *
 * `.gauntlet/shots/shell/` and `.gauntlet/shots/cutin/` are tracked on purpose:
 * a critic is asked to OPEN those pixels, and a screenshot carries no
 * provenance, so the JSON beside them carries it instead. Which means the JSON
 * can go stale exactly the way a bundle can — and one did. `route.json` sat in
 * the graded artifact self-describing a different commit, `workingTree: DIRTY`,
 * and THREE FAILURES, next to PNGs from a different run, while `--verify`
 * reported the tree clean. The critic's words: "the only browser-level record
 * in the artifact is a red run against different code, and nothing in the
 * harness can notice."
 *
 * The `failures` check is the sharp one. A stale SHA is a bookkeeping error; a
 * committed record whose own `failures` array is non-empty is a RED RUN filed
 * as evidence, and it will read as green to anyone who looks at the pictures
 * and not the JSON. That is the same false pass the shots were committed to
 * kill, so it fails here rather than being left for a grader to catch.
 */
/**
 * DEFAULT-DENY, AND IT WAS AN ALLOWLIST UNTIL A CRITIC READ IT.
 *
 * This used to diff `-- src package.json tsconfig.json vitest.config.ts`. Three
 * things that decide what a browser record measured are outside that pathspec:
 *
 *   - `App.tsx` and `index.ts` — the app's ENTRY POINT, at the repo root.
 *   - all of `tools/` — including the instrument that WRITES the record.
 *
 * The critic's demonstration, which I checked and which holds: change
 * `App.tsx`'s `<AppShell search={locationSearch()} />` to `<AppShell />`. It
 * typechecks, because `search` is optional and defaults to null. Every debug
 * route then boots the daily check-in, so roughly forty of `route.json`'s
 * eighty-two checks describe screens the app can no longer show — and vitest is
 * green, tsc is green, and `--verify` prints "current and green", because the
 * one file that changed is not in the list. Worse in the other direction:
 * editing `ON_SCREEN_MIN_OPACITY` to 0 inside `verify-shell-route.mjs` leaves a
 * committed green record attributed to an instrument that no longer exists.
 *
 * The `SELF_DIRTYING` denylist twenty lines above got this right and this
 * function did not, in the same file, in the same commit. So: diff EVERYTHING,
 * then subtract the run artefacts by name. A new source directory, a new tool,
 * a new config at the root is covered the day it is added rather than the day
 * somebody remembers to widen a list.
 */
const NOT_CODE = [
  // Regenerated evidence, the progress page's data, and the shot records
  // themselves. A commit touching only these did not move what the browser ran.
  '.gauntlet/',
  // Prose. A GDD or CLAUDE.md edit does not change what the app does.
  'docs/',
  'CLAUDE.md',
  'README.md',
];
const codeChangedBetween = (from, to) =>
  git(['diff', '--name-only', `${from}..${to}`])
    .split('\n')
    .filter((line) => line.trim() !== '')
    .filter((p) => !NOT_CODE.some((prefix) => p.startsWith(prefix)));

/**
 * THE RECORDS THAT MUST EXIST, because `git ls-files` returning nothing is a
 * PASS and that is the whole failure mode this file keeps re-learning.
 *
 * A critic grading A4 found it: `checkCommittedShots` iterated the tracked shot
 * records and reported every problem it found among them — and an empty list
 * has no problems in it. Drop the `!.gauntlet/shots/cutin/` negation from
 * `.gitignore`, `git rm --cached` the directory, and the browser evidence is
 * gone from the repo with `--verify` still printing "current and green". That
 * is the FIRST of the two historical falsehoods this directory was tracked to
 * kill — "gitignored, existed on one machine" — reachable again, with the whole
 * suite green.
 *
 * A non-vacuity guard is the standard fix and it is one this run has demanded
 * of builders repeatedly; the harness had not applied it to itself. These two
 * paths mirror the negations in `.gitignore`. Adding a third tracked shot
 * directory means adding it here, and the cost of forgetting is a loud failure
 * rather than a silent pass.
 */
const REQUIRED_SHOT_RECORDS = [
  '.gauntlet/shots/shell/route.json',
  '.gauntlet/shots/cutin/frames.json',
];

const checkCommittedShots = () => {
  const tracked = git(['ls-files', '.gauntlet/shots'])
    .split('\n')
    .filter((p) => p.endsWith('.json'));
  const problems = [];
  for (const required of REQUIRED_SHOT_RECORDS) {
    if (!tracked.includes(required)) {
      problems.push(
        `${required} is NOT TRACKED — committed browser evidence has gone missing, and an untracked record is checked by nothing here`,
      );
    }
  }
  for (const rel of tracked) {
    let record;
    try {
      record = JSON.parse(readFileSync(path.join(ROOT, rel), 'utf8'));
    } catch (error) {
      problems.push(`${rel}: unreadable (${String(error).slice(0, 120)})`);
      continue;
    }
    const from = record?.capturedFrom;
    // Not every shot record carries provenance yet. Say which, rather than
    // passing it silently — an unprovenanced record is exactly as undatable as
    // the PNGs it sits beside, which is the problem this whole file is about.
    if (!from || typeof from.commit !== 'string') {
      problems.push(`${rel}: no capturedFrom.commit — this record cannot be dated`);
      continue;
    }
    if (from.workingTree !== 'clean') {
      problems.push(`${rel}: captured from a ${from.workingTree} tree — it describes no commit`);
    }
    const stamped = git(['rev-parse', from.commit]);
    if (stamped === '(unavailable)') {
      problems.push(`${rel}: stamps ${from.commit}, which is not a commit in this repo`);
    } else if (stamped !== head) {
      const changed = codeChangedBetween(stamped, head);
      if (changed.length > 0) {
        problems.push(
          `${rel}: stamps ${from.commit}, and code changed since: ${changed.slice(0, 6).join(', ')}${changed.length > 6 ? ` (+${changed.length - 6} more)` : ''}`,
        );
      }
    }
    if (Array.isArray(record.failures) && record.failures.length > 0) {
      problems.push(
        `${rel}: RED — ${record.failures.length} failure(s) recorded, e.g. ${JSON.stringify(record.failures[0]).slice(0, 160)}`,
      );
    }
    // A stale SHA and a stale INSTRUMENT are different failures and only one of
    // them moves the commit. Re-hash the tools the record names and compare, so
    // a record cannot claim currency for a measuring device that has since
    // been edited underneath it.
    if (!from.instrument || typeof from.instrument !== 'object') {
      problems.push(`${rel}: records no instrument digest — it cannot say WHICH tool measured this`);
    } else {
      for (const [name, digest] of Object.entries(from.instrument)) {
        let now;
        try {
          now = createHash('sha256')
            .update(readFileSync(path.join(ROOT, 'tools', name)))
            .digest('hex')
            .slice(0, 16);
        } catch (error) {
          problems.push(`${rel}: names tools/${name}, which cannot be read (${String(error).slice(0, 80)})`);
          continue;
        }
        if (now !== digest) {
          problems.push(
            `${rel}: measured by tools/${name}@${digest}, but that file is now ${now} — the instrument moved, re-capture`,
          );
        }
      }
    }
  }
  return problems;
};

if (verifyOnly) {
  // Accumulate rather than exit on the first hit: a stale bundle and a stale
  // shot record get fixed in the same pass, and reporting one at a time turns
  // that into two dispatch cycles.
  const problems = [];
  const notes = [];

  const existing = (() => {
    try {
      return readFileSync(path.join(ROOT, '.gauntlet', 'evidence', `${piece}.txt`), 'utf8');
    } catch {
      return null;
    }
  })();
  const stamped = existing === null ? null : (/^commit ([0-9a-f]{40})$/m.exec(existing)?.[1] ?? null);

  if (existing === null) {
    problems.push(`no evidence bundle for "${piece}" — generate one before grading.`);
  } else if (stamped === null) {
    problems.push(`${piece}.txt predates commit stamping — regenerate it.`);
  } else if (stamped !== head) {
    // An exact SHA match is the WRONG test, and a critic caught me writing it: a
    // bundle produced at commit X is itself committed by commit Y, so it can never
    // stamp the commit it lives in. What matters is not whether the SHA moved but
    // whether any CODE moved under it — a bundle still describes the tree if every
    // commit since only touched run artefacts or docs.
    const changed = codeChangedBetween(stamped, head);
    if (changed.length > 0) {
      problems.push(
        `${piece}.txt describes ${stamped.slice(0, 8)}, and code changed since: ${changed.join(', ')}. Regenerate before grading.`,
      );
    } else {
      notes.push(
        `${piece}.txt stamps ${stamped.slice(0, 8)} (HEAD ${head.slice(0, 8)}); no code changed since, so it still describes this tree`,
      );
    }
  } else {
    notes.push(`${piece}.txt describes HEAD (${head.slice(0, 8)})`);
  }

  if (dirty.length > 0) {
    problems.push(`working tree has uncommitted code (${dirty.join(', ')}) — the bundle cannot describe it.`);
  }
  problems.push(...checkCommittedShots());

  for (const note of notes) console.log(`ok: ${note}`);
  if (problems.length > 0) {
    for (const p of problems) console.error(`STALE: ${p}`);
    process.exit(1);
  }
  console.log('ok: tree clean, committed browser evidence current and green');
  process.exit(0);
}

const parts = [
  `EVIDENCE BUNDLE — piece ${piece}`,
  `generated ${new Date().toISOString()}`,
  `repo ${ROOT}`,
  `commit ${head}`,
  `working tree ${dirty.length === 0 ? "clean (ignoring only this script's own output and .gauntlet/state.json)" : `DIRTY — ${dirty.length} uncommitted file(s): ${dirty.join(', ')}`}`,
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

// THE WHOLE SUITE, ALWAYS, EVEN WHEN A PATTERN NARROWED THE RUN ABOVE.
//
// A critic caught the gap this closes. Asked to grade a change that had
// reorganised a module header, it had the narrowed run (one test file, verbose)
// and a typecheck — but the test that stops that header going stale lives in a
// DIFFERENT file, and so did the tests for a signature the same commit changed.
// It could not say those were green, so it correctly reported them unproven at
// the commit it was grading.
//
// The narrowed run is what makes a bundle readable; it is not what makes it
// sufficient. Both belong, at one stamp, so "the piece's tests pass" and
// "nothing else broke" are answerable from the same file.
parts.push(run('whole suite', 'npx', ['vitest', 'run']));
parts.push(run('typecheck', 'npx', ['tsc', '--noEmit']));

const outDir = path.join(ROOT, '.gauntlet', 'evidence');
mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `${piece}.txt`);
writeFileSync(out, parts.join('\n'), 'utf8');
console.log(`wrote ${out}`);
