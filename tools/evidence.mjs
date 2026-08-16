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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { describeDelta, identityDelta, treeIdentity } from './treeIdentity.mjs';
import { filterFindings, filtersFrom } from './evidenceFilters.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const piece = process.argv[2];
if (!piece) {
  console.error('usage: node tools/evidence.mjs <piece-id> [testPathPattern…]');
  process.exit(2);
}
/**
 * The vitest filters, as a LIST rather than as one argv element.
 *
 * It was `process.argv[3]`, handed to vitest whole, while the transcript header
 * printed the argv joined by spaces — so a two-path pattern displayed as a
 * targeted run and executed as a single filter matching nothing. See
 * `evidenceFilters.mjs` for the four committed bundles that carry it.
 */
const filters = filtersFrom(process.argv.slice(3));
const verifyOnly = process.argv.includes('--verify');

const run = (label, cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', timeout: 600_000 });
  const body = `${r.stdout ?? ''}${r.stderr ?? ''}`.trimEnd();
  const text = [
    `${'='.repeat(70)}`,
    `$ ${cmd} ${args.join(' ')}`,
    `[${label}] exit code: ${r.status}${r.error ? ` (${r.error.message})` : ''}`,
    `${'='.repeat(70)}`,
    body || '(no output)',
    '',
  ].join('\n');
  return { text, body, status: r.status };
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
  //
  // AND IT DOES NOT FOLLOW THAT IT CANNOT MOVE A BUNDLE, WHICH THIS COMMENT
  // USED TO BE READ AS SAYING. `src/licensing/realIp.test.ts` pins the exact
  // occurrence count of every watchlisted name in `CLAUDE.md` and
  // `docs/GDD.md`, and `tools/claudeIndex.test.ts` pins that file's index
  // against its live `##` headings — so a prose-only commit CAN redden the
  // suite while this list reports the bundle fresh. That hole is left standing
  // here rather than closed in passing: closing it makes every coordination
  // note in `CLAUDE.md` — the busiest file in the repository — demand a full
  // re-capture of the suite bundle, which is the crying-wolf trade this file
  // has already lost twice, and it is a policy call rather than a defect fix.
  // It is written down so the next reader knows the silence is chosen and
  // measured, not assumed.
  'docs/',
  'CLAUDE.md',
  'README.md',
  // AGENT PROMPTS. `.claude/agents/{builder,critic}.md` are the only tracked
  // files under here — `.claude/worktrees/` is gitignored — and they are
  // instructions to an agent, never an input to the app or to this bundle.
  // Every walker in the repository already excludes `.claude` by name
  // (`audit.test.ts`, `realIp.ts`, `shellWiring.test.ts`, `liftInput.test.ts`),
  // `tsconfig.json`'s wildcard include skips dot-directories, and
  // `vitest.config.ts` collects only `src/` and `tools/`. So nothing compiled,
  // scanned or executed can read them.
  //
  // MEASURED, AND BY THIS FILE'S OWN CHANGE. Editing the critic's prompt — one
  // markdown file no pixel and no test reads — reported ALL FIVE committed
  // browser records stale:
  //
  //   STALE: .gauntlet/shots/shell/route.json: stamps 2a5c625, and code changed
  //   since: .claude/agents/critic.md            (and four more, identically)
  //
  // That is verbatim the failure the `tools/` narrowing forty lines below was
  // written to stop: a finding that is impossible, whose remedy is ~25 minutes
  // of re-capture that cannot come back different, on a check people then learn
  // to skip. The narrowing there keyed on the records' own instrument digests;
  // this one is a whole directory, because unlike `tools/` there is no member
  // of it that could ever be an instrument.
  '.claude/',
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
  '.gauntlet/shots/cutin-cap/cap.json',
  // The fourth, added in the same commit as its `.gitignore` negation — this
  // list is what the paragraph above means. `sound.json` is the only record of
  // the sound half of GDD §12.2's bar: it holds the wall-clock instant every cue
  // reached the audio layer, per beat, against each file's own decoded length,
  // which is the only way a cue firing over its own still-sounding copy is
  // visible at all. No screenshot can carry it.
  '.gauntlet/shots/meet/sound.json',
  // The fifth, added in the same commit as its `.gitignore` negation, like the
  // fourth. `press.json` is the only record that the press fix reached the
  // screens a player presses: the computed `touch-action` off each live element
  // and the `pointercancel` count under a real touch pan, on the played session
  // (GDD §3.2), on a played meet attempt (GDD §6.2) and on the replay harness,
  // each with the neutralised and forced controls beside it.
  //
  // Nothing in the suite can hold it — `vitest.config.ts` is `environment:
  // node`, so no test renders — and the defect this piece fixed was exactly a
  // source scan that stayed green about a screen nobody could reach. The three
  // PNGs beside it are debugging output and stay ignored; `.gitignore` says why.
  '.gauntlet/shots/lift-press/press.json',
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
      // WHY A SHOT RECORD IGNORES `tools/` FILES IT DOES NOT NAME.
      //
      // `codeChangedBetween` is a blunt "did any code move", which is right for
      // the suite bundle and wrong here, because a shot record already carries
      // something sharper: `capturedFrom.instrument`, the digest of every tool
      // that actually measured it, re-hashed a few lines below. A `tools/` file
      // outside that list cannot have changed what the browser drew.
      //
      // Left blunt, this reported every browser record stale after an edit to
      // `watchdog.mjs` — a process supervisor that renders nothing — and the
      // remedy was ~25 minutes of re-capture that could not come back different.
      // A check whose remedy is expensive and whose finding is impossible is one
      // people learn to skip, and then it is not there for the stale record that
      // matters. Same argument the branch scan's archive handling just made.
      //
      // `src/` is still blunt on purpose: the app's code is what the pixels are
      // made of, and no digest here tracks it.
      const instrumented = new Set(Object.keys(from.instrument ?? {}));
      const changed = codeChangedBetween(stamped, head).filter(
        (p) => !p.startsWith('tools/') || instrumented.has(p.slice('tools/'.length)),
      );
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
  'WHY THE STAMP WILL NOT EQUAL HEAD, AND WHY THAT IS NOT A PROBLEM.',
  '',
  'Three critics in a row have spent a paragraph working this out from',
  '.git/logs/HEAD, correctly, and then had to record that they could not run',
  'git diff to finish the argument. So it is stated here instead.',
  '',
  'A bundle produced at commit X is itself committed BY a later commit, so it',
  'can never stamp the commit it lives in. The stamp will normally be one or',
  'two commits behind HEAD, and those commits will be the bundle itself and a',
  'progress-page update.',
  '',
  'What makes that safe is not the ordering — it is that',
  '`node tools/evidence.mjs <piece> --verify` is run immediately before a critic',
  'is dispatched, and it FAILS unless: no file outside the run-artefact and',
  'docs paths changed between the stamp and HEAD (default-deny — everything is',
  'code unless named otherwise, including App.tsx at the repo root and all of',
  'tools/); the working tree carries no uncommitted code; and every committed',
  'browser-shot record is present, dated, captured clean, current, and green.',
  '',
  'If any of that were false the dispatch would not have happened. You are not',
  'being asked to take that on trust: the check is in tools/evidence.mjs and you',
  'can read it. But you do not need to reconstruct it from the reflog.',
  '',
  'AND THE TREE DID NOT MOVE WHILE THIS RAN — which is a different claim from',
  'the stamp, and one the stamp cannot make.',
  '',
  'This run takes minutes — long enough for another commit to land inside it. If',
  'a tracked or untracked-but-not-ignored file changes in that window, the output',
  'below straddles the edit: part of it describes one tree and part another, and',
  'no commit describes the whole. The stamp above would still name a single',
  'commit, so a stale-stamp check cannot notice.',
  '',
  'The identity of every relevant file is taken before the first command and',
  'again after each one; if any of it moved, this file is NOT WRITTEN and the',
  'run exits 3. So the existence of this bundle is itself the evidence — there',
  'is no arm of tools/evidence.mjs that writes a straddled bundle with a warning',
  'in it, deliberately, because a warning in prose here is a thing no check',
  'reads. tools/treeIdentity.test.ts pins that control flow; tools/treeIdentity.mjs',
  'states what the identity covers and what it explicitly cannot see.',
  '',
];

/**
 * ===========================================================================
 * THE TREE MUST NOT MOVE WHILE THIS RUN IS IN FLIGHT
 * ===========================================================================
 * This run takes minutes — three commands, one of them the whole suite.
 * Everything below reads the working tree at the moment it executes, and that
 * window is long enough for a commit to land inside it. If a relevant file
 * moves in it, the bundle written at
 * the end describes a tree that NEVER EXISTED AS A WHOLE: the narrowed vitest
 * output came off one tree, the whole-suite output off another, and the file
 * says nothing about the seam.
 *
 * WHY THIS IS A DIFFERENT PROBLEM FROM STALENESS, AND WHY `--verify` CANNOT
 * COVER IT. `--verify` compares the bundle's stamp against HEAD. A bundle that
 * straddled an edit stamps the commit it STARTED at; if the edit was then
 * committed, `--verify` compares stamp-to-HEAD, finds the code that moved, and
 * says stale — which is right by accident. If the edit was reverted, or was
 * itself the commit that landed the bundle, `--verify` reports it FRESH. The
 * stamp cannot express "half of this output predates the change", because the
 * bundle has one stamp and the run had two trees.
 *
 * WHAT IT REFUSES TO DO, AND WHY REFUSING BEATS MARKING. The alternative was to
 * write the bundle with a banner saying it describes no single tree. That
 * banner would be prose in a file whose only machine-read line is `commit
 * <sha>` — `--verify` greps exactly that, so a marked bundle would still report
 * fresh, and a critic would be reading a warning that nothing enforces. That is
 * this repository's "measured, carried, displayed, never compared" failure
 * verbatim. Refusing leaves the PREVIOUS bundle in place, and the previous
 * bundle's stamp is honest about being old: whichever way the tree moved,
 * `--verify` then reports it — uncommitted movement as `working tree has
 * uncommitted code`, committed movement as `code changed since`. Refusing puts
 * the system in a state the existing check already catches. Marking would put
 * it in one that check reads as clean.
 *
 * WHY THE EXCLUSION IS `SELF_DIRTYING` AND EMPHATICALLY NOT `NOT_CODE`, WHICH
 * IS THE OTHER LIST IN THIS FILE AND WAS THE OBVIOUS CHOICE. `NOT_CODE` answers
 * "did the APP change", and it excludes `docs/`, `CLAUDE.md` and `README.md` on
 * the stated ground that prose does not change what the app does. That is true
 * of the app and false of THIS BUNDLE, whose contents are a test run — and two
 * tests in this suite read that prose off the disk. Measured, not reasoned —
 * two probes, each one appended line, each reverted afterwards:
 *
 *     append an HTML comment holding one name REVIEWABLE_CITATIONS pins
 *     $ npx vitest run src/licensing/realIp.test.ts
 *      Test Files  1 failed (1)
 *           Tests  1 failed | 56 passed (57)
 *
 *     append a new `##` heading with no row in the index table
 *     $ npx vitest run tools/claudeIndex.test.ts
 *      Test Files  1 failed (1)
 *           Tests  2 failed | 4 passed (6)
 *
 * (The probe text is described rather than quoted because this file is inside
 * the census that reddened: pasting the name here would move its own count.)
 *
 * `REVIEWABLE_CITATIONS` pins the exact occurrence count of every watchlisted
 * name in `CLAUDE.md` and `docs/GDD.md`, and `claudeIndex.test.ts` pins the
 * index against the live `##` headings. So a one-word comment added to a
 * markdown file moves the suite's result, and a guard built on `NOT_CODE` would
 * have been silent for it. Inheriting that list here would have imported a hole
 * into the one window nothing else can see into.
 *
 * `SELF_DIRTYING` is the right list because it names exactly what THIS RUN
 * writes, which is the only category that must be ignored: without it the tool
 * reports itself moved on every run and becomes an instrument nobody reads.
 *
 * CHECKED AFTER EVERY CAPTURED COMMAND, not only before the write. The last
 * checkpoint IS the check before the write, so this is a superset of the
 * obvious start-and-end version, and it buys two things: the report names which
 * command's output the seam runs through, and the run stops early. Measured on
 * the drive that introduced this — an edit three seconds in exited at 226 s
 * rather than carrying on through the typecheck.
 *
 * The identity's two halves, what it can and cannot see, and why a failure to
 * measure throws rather than returning "nothing moved", are in
 * `tools/treeIdentity.mjs`.
 */
const baseline = treeIdentity(ROOT, SELF_DIRTYING);

/**
 * Distinct from 1 (a `--verify` finding) and 2 (bad usage), so a caller that
 * wraps this can tell "the evidence is stale" from "the evidence could not be
 * taken at all" without parsing the message.
 */
const TREE_MOVED_EXIT_CODE = 3;

const capture = (label, cmd, args) => {
  const result = run(label, cmd, args);
  parts.push(result.text);
  const moved = identityDelta(baseline, treeIdentity(ROOT, SELF_DIRTYING));
  if (moved.length === 0) return result;
  console.error('');
  console.error('='.repeat(72));
  console.error('REFUSING TO WRITE: THE TREE MOVED WHILE THIS RUN WAS IN FLIGHT');
  console.error('='.repeat(72));
  console.error(`It was still the baseline tree when this run started, and it was not by`);
  console.error(`the time [${label}] finished. Output captured so far straddles the change,`);
  console.error(`so no single commit describes it and no bundle can honestly stamp it.`);
  console.error('');
  console.error('What moved:');
  for (const line of describeDelta(moved)) console.error(line);
  console.error('');
  // WHICH OF THESE TWO SENTENCES IS TRUE IS READ OFF THE DISK, NOT ASSUMED.
  // The first draft said "still holds the previous bundle" unconditionally,
  // which is a confident sentence that is false for any piece being captured
  // for the first time — the exact shape of prose this repository keeps
  // catching. Either way the point holds: nothing here leaves behind a file
  // that `--verify` would call fresh.
  const bundle = path.join('.gauntlet', 'evidence', `${piece}.txt`);
  if (existsSync(path.join(ROOT, bundle))) {
    console.error(`Nothing was written. ${bundle} still holds the previous`);
    console.error('bundle, whose stamp is honest about being older than this tree —');
    console.error(`run \`node tools/evidence.mjs ${piece} --verify\` and it will say so.`);
  } else {
    console.error(`Nothing was written, and there was no ${bundle}`);
    console.error(`to begin with — \`node tools/evidence.mjs ${piece} --verify\` reports its`);
    console.error('absence rather than a bundle you would have had to distrust.');
  }
  console.error('');
  console.error('Let the tree settle, commit what you meant to commit, then re-run this.');
  process.exit(TREE_MOVED_EXIT_CODE);
};

const targeted = capture('tests', 'npx', ['vitest', 'run', ...filters, '--reporter=verbose']);

/**
 * REFUSING TO WRITE A BUNDLE WHOSE TARGETED RUN SELECTED NOTHING.
 *
 * A run that matched nothing is not a narrowed run, and the difference is
 * invisible in the finished file: the whole-suite capture below is green, so
 * the bundle reads green while its first section covered zero tests. Four
 * committed bundles are in exactly that state and nobody noticed for waves,
 * which is the argument for refusing rather than warning — a warning at the top
 * of a long command is scrolled past, and this repository has recorded that
 * about its own output twice.
 *
 * IT REFUSES RATHER THAN FALLING BACK to the whole suite, on this file's own
 * standing rule about a named skipped check: quietly widening the run would
 * leave the section looking complete while answering a different question from
 * the one the command asked.
 *
 * The exit code is its own, so a wrapper can tell "the pattern was wrong" from
 * "the tree moved" (`TREE_MOVED_EXIT_CODE`) and from "the tests failed" — a
 * failing targeted run is a RESULT and is written out, loudly, exactly as
 * before. This fires only when the filters selected no file at all.
 */
const FILTERS_MATCHED_NOTHING_EXIT_CODE = 4;
const findings = filterFindings(filters, targeted?.body ?? '');
if (findings.length > 0) {
  console.error('');
  console.error('='.repeat(72));
  console.error('REFUSING TO WRITE: A FILTER IN THE TARGETED RUN SELECTED NOTHING');
  console.error('='.repeat(72));
  for (const finding of findings) {
    console.error(
      finding.kind === 'no-test-files'
        ? 'The run named no filters and vitest reported no test files at all.'
        : `The filter ${JSON.stringify(finding.filter)} appears in none of the paths that ran.`,
    );
  }
  const ran = findings[0]?.ran ?? [];
  console.error('');
  console.error(
    ran.length === 0
      ? 'No test file ran.'
      : `${ran.length} test file(s) ran: ${ran.slice(0, 8).join(', ')}${ran.length > 8 ? ' …' : ''}`,
  );
  console.error('');
  console.error('vitest selects a test file whose PATH CONTAINS the filter, and it exits 0');
  console.error('when one filter matches nothing as long as another matches something — so a');
  console.error('bundle written now would carry a section that reads targeted and covered');
  console.error('less than it names. Pass each path as its own argument:');
  console.error('');
  console.error(`  node tools/evidence.mjs ${piece} src/shell src/game/guaranteeTags.test.ts`);
  console.error('');
  console.error('Nothing was written. A `|`-separated pattern is reported here rather than');
  console.error('split, because vitest does not read one as alternation and this tool does');
  console.error('not get to invent a syntax for it.');
  process.exit(FILTERS_MATCHED_NOTHING_EXIT_CODE);
}

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
capture('whole suite', 'npx', ['vitest', 'run']);
capture('typecheck', 'npx', ['tsc', '--noEmit']);

const outDir = path.join(ROOT, '.gauntlet', 'evidence');
mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `${piece}.txt`);
writeFileSync(out, parts.join('\n'), 'utf8');
console.log(`wrote ${out}`);

/**
 * THE SENTENCE THAT KEEPS BEING WRITTEN IN GOOD FAITH AND BEING WRONG BY THE
 * NEXT COMMIT, printed at the moment it is about to be written.
 *
 * Twice now a commit has re-taken bundles and said so — "all three stale
 * bundles re-taken" — and the very next commit edited a source those bundles
 * derive from. Both times the person doing it knew the rule. That is the
 * signature of something that wants a prompt at the point of use rather than
 * more care, and this is the point of use: the only moment at which the claim
 * "this bundle describes this tree" is true is the moment it is printed.
 *
 * Short on purpose. A wall of text at the end of a long command is scrolled
 * past, and a warning nobody reads is the same as no warning.
 */
const rule = '─'.repeat(72);
console.log('');
console.log(rule);
console.log(`This bundle describes commit ${head.slice(0, 8)} and this tree. Nothing else.`);
console.log('ANY source edit after this line invalidates it — including the one you are');
console.log('about to make. If the next thing you commit touches a source this bundle');
console.log('depends on, re-take it IN THAT COMMIT or say in that message that it is now');
console.log('stale. Do not write "re-taken" over a bundle you are about to outdate.');
console.log('');
console.log(`Ask, do not assume:  node tools/evidence.mjs ${piece} --verify`);
console.log(rule);
