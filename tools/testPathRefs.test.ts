/**
 * testPathRefs.test.ts — the guard that a named test file is a real test file.
 *
 * ===========================================================================
 * WHY THIS LIVES IN `tools/` AND NOT IN `src/`
 * ===========================================================================
 * Its subject is the COMMAND LAYER, not a game module. The defect is that
 * `npx vitest run <a> <b>` silently ignores a filter that matches nothing when
 * another filter matches something, so a standing verification command keeps
 * printing `passed` while covering less than it names. The things that hold
 * those commands are `tools/evidence.mjs`, `tools/testBudget.mjs`,
 * `tools/watchdog.mjs`, `docs/GDD.md` and `CLAUDE.md` — no `src/` module owns
 * the question, and putting the check under one would make it look like that
 * module's business.
 *
 * `vitest.config.ts` already includes `tools/` for exactly this reason, and
 * says so: `tools/verifyMarker.test.ts` drives a tool as a subprocess so that
 * the interrupted-verification marker is checked by the same command that
 * checks everything else, "instead of by a script somebody remembers to run."
 * Same argument, one instrument over.
 *
 * ===========================================================================
 * THIS FILE IS INSIDE ITS OWN SUBJECT, AND THAT SHAPED EVERY FIXTURE BELOW
 * ===========================================================================
 * The scan reads the tracked tree, and this file is tracked. So a fixture path
 * written out as a literal here is a REFERENCE, and a fixture path that names
 * nothing is a FINDING — against this file. The first draft learned that by
 * going red 18 times against itself.
 *
 * The fix is not an exemption. Two rules, applied everywhere below, and both
 * make the tests read better rather than worse:
 *
 *   - A fixture that must RESOLVE is a real path from this repository, so the
 *     fixture and the tree cannot disagree.
 *   - A fixture that must NOT resolve is DERIVED from a real one — "the same
 *     path with its first segment shaved", "the same path in a different
 *     directory" — which says what the case is about far better than a
 *     hand-typed near-miss, or it is assembled from constants (`ABSENT_REF`,
 *     `FIXTURE_REF`) so no contiguous path-shaped string appears in the source.
 *
 * `this file writes no reference it cannot back` pins that discipline: inline
 * any of those derivations and it goes red one line before the whole-tree
 * check does.
 *
 * ===========================================================================
 * WHAT IS PINNED HERE AND WHY IT IS PINNED AS A COUNT
 * ===========================================================================
 * `PINNED` below holds equalities, not bounds — with ONE deliberate exception,
 * ruled by a human and argued here so that it does not read later as a
 * concession. The reason equalities are the default is the failure this whole
 * check is an instance of: an empty domain passes silently. If a refactor
 * narrows the walk, breaks the pattern, or points the scan at nothing, an
 * assertion that "no reference is unresolved" is TRUE OF NOTHING and green.
 *
 * ===========================================================================
 * WHY `REFERENCES_FLOOR` IS A FLOOR WHEN EVERY OTHER PIN IS AN EQUALITY
 * ===========================================================================
 * **Because it is not the same KIND of number**, and that distinction is the
 * whole ruling rather than a softening of the rule.
 *
 * In `src/game/streakSweep.ts` the pinned count IS THE MEASUREMENT — violating
 * pairs at zero, against non-zero controls kept beside it. Moving that number
 * hides a regression, which is exactly why `CLAUDE.md` demands counts over
 * bounds there and why every other pin in this file is an equality.
 *
 * The reference count is an INCIDENTAL CENSUS of how often people happened to
 * mention a test path in prose. No property is being measured, so there is no
 * defect for it to hide; it is a byproduct of how much coordination writing
 * occurred. A pin on a byproduct guards nothing and charges a toll.
 *
 * The only vacuity mode an equality catches here and a floor does not is the
 * match set collapsing — and a floor catches that completely, because a broken
 * matcher does not lose a few references, it loses nearly all of them. The
 * sharper risk, the RESOLUTION TARGET SET being silently widened so the main
 * assertion becomes trivially true, is caught by `TEST_FILES` — measured, not
 * assumed: widening the target set moves it 88 -> 384 and reddens exactly one
 * test. And the walk quietly losing files is caught by `SCANNED_FILES`, which
 * stays an equality. So the floor loses nothing that another pin does not hold.
 *
 * MEASURED COST OF THE EQUALITY, which is why it went: appending one ordinary
 * coordination note to `CLAUDE.md` — "Session B should run
 * `src/game/streak.test.ts` after touching that module" — took the count 327 ->
 * 328 and reddened the suite. Coordination notes are the most frequent edit
 * category in this run, and three other sessions rely on that file. A guard
 * that fires on the most common edit while protecting against nothing
 * demonstrable trains its readers to treat red as noise, which this repository
 * has now paid for on four separate instruments.
 *
 * This is the same trade, and the same answer, as the `NOT_CODE` prose ruling
 * in `CLAUDE.md` — consistent with it rather than in tension.
 *
 * ===========================================================================
 * DRIVEN BOTH WAYS, AND WHERE EACH HALF IS
 * ===========================================================================
 * A guard nobody has watched fail is not evidence. Every predicate below has a
 * case that makes it fire:
 *
 *   - The WHOLE PIPELINE — git, read, match, resolve, report — is driven in
 *     throwaway repositories under `driven both ways`: once with a reference
 *     that resolves and once with one that does not, plus both false-positive
 *     modes, the excluded root and the binary rule, each with its own control
 *     showing the silence is the rule doing something.
 *   - The PURE PREDICATES are driven over synthetic sources.
 *   - The REAL TREE is measured, and its counts are pinned.
 *
 * `tools/` is outside the `@guarantee` scanner's reach — that scan is rooted at
 * `src/` — so nothing here can carry a resolvable tag or a `MUTATION_WITNESSES`
 * entry. Every claim above names the test that reddens instead, which is the
 * honest substitute and not a claim of equivalent coverage.
 *
 * ===========================================================================
 * DOMINATION CHECK — "A NEW RULE CAN MAKE AN OLD ONE VACUOUS"
 * ===========================================================================
 * Two checks already in this tree assert that a named test file exists, and
 * both are heavily overlapped by the rule above. Neither is dominated, and both
 * discriminators were EXECUTED rather than reasoned about, per CLAUDE.md's
 * "mutate the subject into the region the older check claims".
 *
 *   - `src/game/guaranteeTags.test.ts:3720/3735` — `existsSync` on a witness's
 *     `mutatedFile` and `testFile`. Its exclusive region is `mutatedFile`,
 *     which is usually NOT a test path and is therefore outside this scan
 *     entirely. Driven: `mutatedFile: 'src/career/eligibility.ts'` renamed to
 *     `…/eligibilityGone.ts` gives that file `1 failed | 14 passed` with
 *     "witness for strength-never-removes-a-meet: src/career/eligibilityGone.ts"
 *     while `testPathRefs.test.ts` reports `28 passed`.
 *   - `src/game/progression.test.ts:1767` — the same shape over the route
 *     ledger, and the same argument.
 *
 * And the other direction, which is what says this rule is worth adding rather
 * than merely not harmful. Driven: renaming the prose reference in
 * `src/art/gymTuning.ts` from `src/meet/walkout.test.ts` to a near-miss leaves
 * `guaranteeTags.test.ts` at `15 passed` and `progression.test.ts` at
 * `143 passed`, and reddens only this file — `1 failed | 27 passed`, at
 * `src/art/gymTuning.ts:477`.
 * Neither existing check has anything to say about a test path outside a
 * witness row, which is where 323 of this tree's 327 references live.
 *
 * WITHIN THIS FILE, the pins were compared the same way. `TEST_FILES` looked
 * dominated by `SCANNED_FILES` — both move when a test file is added — and is
 * not: it is the ONLY assertion that catches the resolution target set being
 * WIDENED, which would make the main check vacuous while every other number
 * held. Driven: `testFiles = tracked` gives exactly one red,
 * "tracked test files moved from 88 to 384".
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { NOT_WALKED_HIDES_TRACKED } from '../src/licensing/realIp';
import {
  TEST_PATH_REFS,
  auditSources,
  auditTestPathReferences,
  describeOccurrences,
  inScanScope,
  isSyntheticFixture,
  normalizeReference,
  referencesIn,
  resolvesAgainst,
  trackedFiles,
} from './testPathRefs.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');

/**
 * WHAT THE REAL TREE MEASURES TODAY.
 *
 * Every one of these is an equality on purpose; see the header. Each moves for
 * a different, named reason, so a red here says which thing changed.
 */
const PINNED = Object.freeze({
  /**
   * A FLOOR, not an equality — the one exception in this object, argued at
   * length in the header. Path-shaped `*.test.ts` references in the tracked
   * tree, after the extension guard.
   *
   * It is the non-vacuity guard against the MATCHER collapsing: if the pattern
   * breaks or the read stops seeing file contents, references go to zero or
   * near it and this fires. It is deliberately NOT a guard against ordinary
   * churn, because adding or removing a prose mention of a test path is not a
   * defect and reddening the suite for it trains readers to ignore red.
   *
   * Measured at 327 when written. The floor sits ~24% below that: far enough
   * for a run's worth of coordination notes to be added or deleted without
   * anyone touching this file, close enough that a broken matcher — which
   * costs nearly all of them at once — cannot clear it.
   *
   * The two failure modes a floor cannot see are held by equalities that stay
   * equalities: `SCANNED_FILES` if the walk loses files, `TEST_FILES` if the
   * resolution target set is widened.
   */
  REFERENCES_FLOOR: 250,

  /**
   * FALSE-POSITIVE MODE 1, counted. Occurrences dropped because the match ran
   * on into a longer extension. Delete the guard in `referencesIn` and these
   * stop being dropped and start being findings, so this number and the main
   * assertion redden together.
   */
  CLIPPED: 8,

  /**
   * The distinct things the clipping guard dropped, WRITTEN IN THEIR REAL
   * EXTENSION. Pinning the clipped form instead would mean writing a name
   * nobody gave a file, which this scan would then report — see the header.
   */
  CLIPPED_SOURCES: Object.freeze(['src/card/seed.test.tsx', 'src/game/streak.test.tsx']),

  /**
   * FALSE-POSITIVE MODE 2, counted. References under
   * `TEST_PATH_REFS.SYNTHETIC_PREFIX`, which are fixtures rather than files.
   */
  SYNTHETIC: 9,

  /**
   * AND WHERE THEY ARE ALLOWED TO BE, which is what stops the exemption
   * widening quietly. A fixture-prefixed reference from a third file reddens
   * this, and a reviewer decides whether it is a fixture or a mistake.
   *
   * `guaranteeTags.test.ts` holds three, in the fake `MutationWitness` rows it
   * drives its own schema with. `testPathRefs.mjs` holds one, in the verbatim
   * `npx vitest run` command its header quotes as the measurement of the defect
   * — a command that has to name something absent to demonstrate anything.
   *
   * 4 -> 9, and two files -> four, when `evidenceFilters` arrived. Its subject
   * is a vitest filter that selected nothing, so a fixture it can be pointed at
   * has to be a path that is not there — the same reason `testPathRefs.mjs`
   * already holds one, one instrument over. The five new occurrences are all
   * the same planted path: twice in `evidenceFilters.mjs` (a quoted transcript
   * in its header) and three times in its test (a captured `filter:` echo, the
   * assertion that the echo is in the fixture, and the control that holds the
   * same path in both line shapes).
   */
  SYNTHETIC_FILES: Object.freeze([
    'src/game/guaranteeTags.test.ts',
    'tools/evidenceFilters.mjs',
    'tools/evidenceFilters.test.ts',
    'tools/testPathRefs.mjs',
  ]),

  /**
   * Tracked files whose bytes were read.
   *
   * 286 -> 292 when the dev-server sentinel arrived: `devServerSentinel.mjs`,
   * its `.d.mts`, its test, `processHazardHook.test.ts`, and the two hook
   * files under `.claude/` (`hooks/warn-process-hazards.mjs`,
   * `settings.json`).
   *
   * 292 -> 295 when the career reached the boundary (Sprint 1a):
   * `careerServer.ts`, `careerClient.ts` and `careerServer.test.ts` under
   * `src/game/`.
   *
   * 299 -> 301 with Sprint 1c's adapter pair: `src/game/careerMeet.ts` and
   * `src/game/careerMeet.test.ts`; 301 -> 299 when the placeholder trio was
   * deleted. Three files left the tree and the census moved by two, which
   * says one of the three was not in this walk's domain to begin with — the
   * walk's own filters decide that, and the equality is what notices either
   * way.
   *
   * 299 -> 301 with Sprint 2's save codec: `src/game/saveGame.ts` and
   * `src/game/saveGame.test.ts`.
   *
   * 301 -> 302, found running the full suite for Sprint 3's gate rather than
   * introduced by it: no commit in this session touched the tracked file set
   * (`HEAD` had not moved when this was measured), and the delta traces to no
   * single file — `git ls-files` outside `.gauntlet/` minus the 19 binary
   * assets `readAsText` already filters lands on 302 exactly, both before and
   * after this session's uncommitted edits. Re-measured rather than
   * hand-bumped, per this file's own rule; the origin of the one-off drift in
   * "301" is not traced further here.
   *
   * 302 -> 304 with bench's artwork: `src/art/benchPress.ts` and
   * `src/art/benchPress.test.ts`, both added by PR #15. TRACED TO THOSE TWO
   * FILES rather than re-measured and bumped — `git diff --diff-filter=A`
   * across that merge names exactly them, and 302 + 2 lands on 304.
   *
   * WORTH RECORDING: PR #15 WAS MERGED WITH THIS PIN ALREADY RED. Checked out
   * at its own merge commit the suite reports `1 failed | 27 passed` in this
   * file, so the pin never held on that branch. It is not a defect in the two
   * new files — they are real files and the count is honestly higher — but it
   * is a concrete instance of the standing rule that a session's own pass is
   * not verification, and it is why the number is corrected here by the
   * session that owns the tree rather than left to be rediscovered.
   *
   * 304 -> 306 with the GDD §4.2 first-run onboarding disclosures:
   * `src/game/onboardingDisclosure.ts` and
   * `src/game/onboardingDisclosure.test.ts`. TRACED, not re-measured and
   * bumped, the same way the PR #15 pair above was: `git diff
   * --diff-filter=A 22ada1e cab8a58` names exactly those two files and
   * nothing else, and 304 + 2 lands on 306.
   *
   * A note for whoever moves this next, because it cost a run here: these two
   * files were UNTRACKED for the first full-suite pass of that piece, so this
   * pin stayed green while the work was uncommitted and went red only on the
   * run after the commit. The census reads tracked files, so "the suite was
   * green before I committed" is not evidence about it.
   */
  /**
   * 306 -> 307 with `tools/liftLadders.test.ts`, which is a test with no module
   * half: its subject is `sessionDrive.mjs`'s prompt table, which already
   * exists. TRACED rather than re-measured and bumped, the way the two pairs
   * above were: `git status` names exactly that one added file.
   *
   * The note above about untracked files applies and was paid here too — the
   * new test was written, run green, and only reddened this census once it was
   * `git add`ed, which is the census reading the tracked tree as designed.
   *
   * 307 -> 312, catching a pin that five files behind HEAD never moved:
   * `VISION.md`, `src/game/benchSurplus.test.ts`, and the C3 grind-response
   * probe trio. This commit then swaps that trio for `src/art/deadliftPull.ts`,
   * `src/art/deadliftPull.test.ts` and `src/game/a0LiftFreeze.test.ts`, so the
   * net of the swap is 0 and the number that remains is the catch-up.
   *
   * 312 -> 320 with A1 authentic meet: `meetField.ts`, `meetBoard.ts`,
   * `meetLedger.ts`, `MeetBoardView.tsx`, and the four tests beside them
   * (`meetField`, `meetBoard`, `meetLedger`, `meetCommand`).
   *
   * 320 -> 332 with A2 My Lifter: six identity modules, five tests, and
   * `tools/_capture-a2-lifter.mjs`.
   *
   * 332 -> 339 with Iron & Amber training plates: `TrainingLiftStage.tsx`,
   * `ironAmberPlates.ts`, two tests, `jpg.d.ts`, the capture tool, and the
   * `sessionPalette` sibling already on the tree.
   *
   * 339 -> 340 with `docs/design/IRON-AMBER-TRAINING-ASSETS.md`.
   */
  SCANNED_FILES: 340,

  /**
   * Tracked `*.test.ts` files — the set every reference must land in.
   *
   * 89 -> 91 with the sentinel: `tools/devServerSentinel.test.ts` and
   * `tools/processHazardHook.test.ts`.
   */
  /** 91 -> 92 with Sprint 1a's `src/game/careerServer.test.ts`. */
  /**
   * 92 -> 93 with Sprint 1b's `src/meet/careerSurface.test.ts` (and
   * SCANNED_FILES 295 -> 299 with its three shipped siblings:
   * `careerSurface.ts`, `useCareer.ts`, `CareerScreen.tsx`).
   */
  /** 93 -> 94 with Sprint 1c's `src/game/careerMeet.test.ts`; 94 -> 93 when
   *  `careerCalendarPlaceholder.test.ts` was deleted with its trio; 93 -> 94
   *  with Sprint 2's `src/game/saveGame.test.ts`; 94 -> 95 with bench's
   *  `src/art/benchPress.test.ts`, the test half of the same PR #15 pair that
   *  moved `SCANNED_FILES` above — and masked by it, since both assertions
   *  live in one test and the first to fail hides the second. */
  /**
   * 95 -> 96 with `src/game/onboardingDisclosure.test.ts`, the test half of
   * the same pair that moved `SCANNED_FILES` to 306 above.
   *
   * Masked by that assertion in exactly the way the previous entry warns
   * about, and confirmed rather than assumed this time: bumping
   * `SCANNED_FILES` alone leaves this one red on the next run, so both halves
   * of an added module/test pair have to move together.
   */
  /**
   * 96 -> 97 with `tools/liftLadders.test.ts`. It moves BOTH pins on its own
   * rather than one — it is a test with no module beside it — so the masking
   * hazard the entry above records does not arise here, and both were bumped
   * together anyway because that is what the census asks for.
   *
   * 97 -> 100 with the same catch-up as `SCANNED_FILES` 307 -> 312:
   * `src/game/benchSurplus.test.ts` and the two C3 probe tests landed without
   * a bump. This commit then swaps those two probe tests for
   * `src/art/deadliftPull.test.ts` and `src/game/a0LiftFreeze.test.ts`, so
   * the net of the swap is 0 and the number that remains is the catch-up.
   *
   * 100 -> 104 with A1: `meetField.test.ts`, `meetBoard.test.ts`,
   * `meetLedger.test.ts`, `meetCommand.test.ts`.
   *
   * 104 -> 109 with A2: `lifterProfile.test.ts`, `lifterEntry.test.ts`,
   * `lifterPersist.test.ts`, `lifterSurface.test.ts`, `a2LifterFreeze.test.ts`.
   *
   * 109 -> 111 with Iron & Amber training plates: `ironAmberPlates.test.ts`
   * and `ironAmberWiring.test.ts`.
   */
  TEST_FILES: 111,
});

/**
 * REAL PATHS FROM THIS REPOSITORY, used wherever a fixture must resolve.
 *
 * Written out rather than derived, deliberately: they are references like any
 * other, so if one of these files is renamed this file is among the things that
 * goes red, which is the check working on its own author.
 */
const AUDIT = 'src/tuning/audit.test.ts';
const WIRING = 'src/session/sessionWiring.test.ts';
const STREAK = 'src/game/streak.test.ts';

/**
 * A path-shaped reference to a file that is NOT THERE, assembled from parts so
 * that no contiguous match exists in this source. See the header.
 */
const ABSENT_REF = ['src', 'game', `noSuchModule${TEST_PATH_REFS.SUFFIX}`].join('/');

/** A fixture path, exempt by prefix — the affordance false-positive mode 2 is for. */
const FIXTURE_REF = `${TEST_PATH_REFS.SYNTHETIC_PREFIX}fixture${TEST_PATH_REFS.SUFFIX}`;

const sandboxes: string[] = [];
afterAll(() => {
  for (const dir of sandboxes) rmSync(dir, { recursive: true, force: true });
});

function gitIn(repo: string, args: readonly string[]): string {
  return execFileSync('git', [...args], {
    cwd: repo,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'test',
      GIT_AUTHOR_EMAIL: 't@t',
      GIT_COMMITTER_NAME: 'test',
      GIT_COMMITTER_EMAIL: 't@t',
    },
  });
}

/** A throwaway repository whose contents the caller states file by file. */
function sandbox(prefix: string, files: Readonly<Record<string, string>>): string {
  const repo = mkdtempSync(path.join(os.tmpdir(), prefix));
  sandboxes.push(repo);
  gitIn(repo, ['init', '--quiet']);
  for (const [rel, text] of Object.entries(files)) {
    const full = path.join(repo, rel);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, text);
  }
  gitIn(repo, ['add', '-A']);
  gitIn(repo, ['commit', '--quiet', '-m', 'base']);
  return repo;
}

describe('the tracked tree names only test files that exist', () => {
  /**
   * Taken inside the tests rather than at collection time. A throw during
   * collection reports `Tests  no tests` while the FILE goes red, which is
   * indistinguishable from a caught mutant to anything reading the colour —
   * CLAUDE.md records that exact shape as a hole in the witness bar. Here it
   * would mean every assertion below silently stopped running.
   */
  let cached: ReturnType<typeof auditTestPathReferences> | null = null;
  const tree = (): ReturnType<typeof auditTestPathReferences> =>
    (cached ??= auditTestPathReferences(REPO_ROOT));

  it('reports no reference that points at nothing', () => {
    const audit = tree();
    expect(
      audit.unresolved,
      `these ${audit.unresolved.length} reference(s) name a test file that is not in the tracked tree.\n` +
        'Run alone, vitest exits 1 on each; run beside a path that exists, it reports "passed" and skips them.\n' +
        `${describeOccurrences(audit.unresolved)}\n` +
        `(scanned ${audit.scanned.length} files, ${audit.references.length} references, ` +
        `${audit.testFiles.length} test files)`,
    ).toEqual([]);
  });

  it('saw the whole tree, counted, so an empty domain cannot pass as a clean one', () => {
    const audit = tree();
    // Equalities, not bounds — except the first, which is a FLOOR on purpose.
    // See the header: it is an incidental census of prose mentions, not a
    // measurement, so an equality would charge every coordination note while
    // guarding nothing an equality alone can hold.
    expect(
      audit.references.length,
      `path-shaped references fell to ${audit.references.length}, below the floor of ` +
        `${PINNED.REFERENCES_FLOOR}. This is not ordinary churn — a drop this far means the ` +
        'MATCHER stopped seeing the tree, so "no unresolved references" would be true of ' +
        'nothing. Check `referencesIn` and the read before adjusting this number.',
    ).toBeGreaterThanOrEqual(PINNED.REFERENCES_FLOOR);
    expect(
      audit.scanned.length,
      `tracked files read moved from ${PINNED.SCANNED_FILES} to ${audit.scanned.length}`,
    ).toBe(PINNED.SCANNED_FILES);
    expect(
      audit.testFiles.length,
      `tracked test files moved from ${PINNED.TEST_FILES} to ${audit.testFiles.length}`,
    ).toBe(PINNED.TEST_FILES);
  });

  it('has a live subject for the extension guard, and it is the .test.tsx mentions', () => {
    const audit = tree();
    // FALSE-POSITIVE MODE 1 on the real tree. `src/card/seed.test.tsx` is a
    // plant `progression.test.ts` describes at length; a naive pattern reads a
    // shorter name out of the middle of it and reports a file nobody wrote.
    expect(
      audit.clipped.length,
      `clipped occurrences moved from ${PINNED.CLIPPED} to ${audit.clipped.length}:\n` +
        describeOccurrences(audit.clipped),
    ).toBe(PINNED.CLIPPED);
    expect([...new Set(audit.clipped.map((o) => `${o.ref}x`))].sort()).toEqual([
      ...PINNED.CLIPPED_SOURCES,
    ]);
    // And each drop was RIGHT rather than convenient: go back to the source and
    // read the character the guard refused. Every one continues into a longer
    // extension, so what a naive pattern would report is a name nobody wrote.
    // Weaken the guard to a lookahead that accepts letters and this disagrees.
    for (const dropped of audit.clipped) {
      const line = readFileSync(path.join(REPO_ROOT, dropped.file), 'utf8').split('\n')[
        dropped.line - 1
      ];
      expect(line, `${dropped.file}:${dropped.line} does not continue past the match`).toContain(
        `${dropped.ref}x`,
      );
    }
  });

  it('exempts fixture paths only where fixture paths belong', () => {
    const audit = tree();
    // FALSE-POSITIVE MODE 2 on the real tree. These name no file ON PURPOSE:
    // `guaranteeTags.test.ts` drives the MutationWitness schema against itself.
    // Demanding they resolve would force a real file into existence to satisfy
    // a scan, which is backwards.
    expect(
      audit.synthetic.length,
      `exempted references moved from ${PINNED.SYNTHETIC} to ${audit.synthetic.length}:\n` +
        describeOccurrences(audit.synthetic),
    ).toBe(PINNED.SYNTHETIC);
    expect(
      [...new Set(audit.synthetic.map((o) => o.file))].sort(),
      'a new file started using the fixture prefix — is it a fixture, or a mistake?',
    ).toEqual([...PINNED.SYNTHETIC_FILES]);
  });

  it('keeps the fixture prefix pointing at nothing, so the exemption stays a rule', () => {
    // If that directory ever becomes real, this exemption stops meaning "these
    // are not files" and becomes a hole in the scan.
    expect(
      existsSync(path.join(REPO_ROOT, TEST_PATH_REFS.SYNTHETIC_PREFIX)),
      `${TEST_PATH_REFS.SYNTHETIC_PREFIX} exists on disk; the exemption now hides real paths`,
    ).toBe(false);
  });

  it('this file writes no reference it cannot back', () => {
    // The derivations described in the header are what keep this true. Inline
    // one and this goes red beside the whole-tree check.
    const mine = tree().references.filter((o) => o.file === 'tools/testPathRefs.test.ts');
    // Anchored on references this file really does write, so the filter having
    // silently matched nothing is not what makes the line below pass.
    expect(mine.map((o) => o.ref)).toEqual(expect.arrayContaining([AUDIT, WIRING, STREAK]));
    expect(mine.map((o) => o.ref)).not.toContain(ABSENT_REF);
  });
});

describe('what the scan reaches', () => {
  it('reads captured output nowhere and everything else', () => {
    // ONE exclusion, and it is a category rather than a directory somebody
    // dislikes: `.gauntlet/` is raw stdout and scraped browser records, so a
    // bundle captured before a rename is SUPPOSED to name the old path.
    expect(TEST_PATH_REFS.CAPTURED_OUTPUT_ROOTS).toEqual(['.gauntlet']);
    expect(inScanScope('.gauntlet/evidence/suite.txt')).toBe(false);
    expect(inScanScope('src/game/streak.ts')).toBe(true);
    expect(inScanScope('.claude/agents/critic.md')).toBe(true);
    // Segment, not prefix: a file whose name merely starts the same way is read.
    expect(inScanScope('.gauntletish/notes.md')).toBe(true);
  });

  it('reaches the whole repository and not just src/, anchored by name', () => {
    // GDD §12.2's third correction to the unit bar, applied here: "a table a
    // test fails on" is satisfied by a test that scans less than the codebase,
    // and that is not hypothetical — a pin rooted at `src/` left `App.tsx`, the
    // app's entry point at the repository root, outside the instrument while
    // every non-vacuity check inside it stayed green, because they all asked
    // about files the scan already had. So the anchors are named by hand and
    // sit outside `src/`, which is the shape `src/tuning/audit.test.ts` uses.
    const scanned = new Set(auditTestPathReferences(REPO_ROOT).scanned);
    for (const anchor of [
      'App.tsx',
      'vitest.config.ts',
      'package.json',
      'CLAUDE.md',
      'docs/GDD.md',
      '.gitignore',
      '.claude/agents/critic.md',
      'tools/evidence.mjs',
    ]) {
      expect(scanned.has(anchor), `${anchor} is outside this scan`).toBe(true);
    }
    // And the one root deliberately outside it stays outside — the same set,
    // read the other way, so the anchors above cannot pass by the scan simply
    // holding everything.
    expect([...scanned].some((f) => f.startsWith('.gauntlet/'))).toBe(false);
  });

  it('cannot reach a sibling worktree, structurally rather than by list', () => {
    // A worktree under `.claude/` is a COMPLETE SECOND CHECKOUT of this repo.
    // `src/tuning/audit.test.ts` records what walking one costs: 24 findings
    // against another agent's half-written copy, so the verdict depended on who
    // else was building. This scan asks git, and `.gitignore` ignores
    // `.claude/worktrees/`, so there is nothing to exclude — but "structurally"
    // is a claim, and this is the check rather than the sentence.
    expect(gitIn(REPO_ROOT, ['ls-files', '.claude/worktrees']).trim()).toBe('');
  });

  it('has not silently diverged from the sibling scan it deliberately differs from', () => {
    // `NOT_WALKED_HIDES_TRACKED` is realIp's own measurement of which of its
    // exclusions hide COMMITTED files — the only ones that could matter to a
    // tracked-file scan. This reads that list rather than copying it, per
    // CLAUDE.md's "a twin guard must READ the sibling's list".
    //
    // The divergence is deliberate and is exactly one entry: `.claude` is
    // excluded there because a filesystem walk cannot otherwise stay out of
    // `worktrees/`, and realIp's own header calls that exclusion "WIDER THAN
    // ITS OWN STATED REASON". Asking git makes the narrow version free, so the
    // two hand-written agent definitions are read here. If a THIRD directory
    // joins that list, this reddens and somebody decides whether it applies to
    // this scan too.
    expect(NOT_WALKED_HIDES_TRACKED).toEqual(['.claude', '.gauntlet']);
    expect(
      TEST_PATH_REFS.CAPTURED_OUTPUT_ROOTS.every((r) => NOT_WALKED_HIDES_TRACKED.includes(r)),
      'this scan excludes a root the sibling does not even list',
    ).toBe(true);
  });

  it('throws where git cannot answer, rather than reporting a clean tree', () => {
    // "An empty list has no problems in it" is the failure `evidence.mjs`
    // records against its own shot check. A scan that could not look must not
    // read like a scan that found nothing.
    const notARepo = mkdtempSync(path.join(os.tmpdir(), 'test-path-refs-not-a-repo-'));
    sandboxes.push(notARepo);
    expect(() => trackedFiles(notARepo)).toThrow(/git ls-files failed/);
  });
});

describe('what counts as a reference', () => {
  it('takes a path and leaves a bare basename alone', () => {
    // The scoping rule, stated in the module header: a `/` means somebody wrote
    // a LOCATION. A bare basename in prose is a mention, and no scan can tell a
    // mention from a metavariable — `empireCore.test.ts` says "`name.ts` or
    // `name.test.ts`" about a naming convention, and CLAUDE.md's own
    // description of this defect writes two placeholder basenames.
    expect(referencesIn(`see ${STREAK}`).map((r) => r.ref)).toEqual([STREAK]);
    expect(referencesIn(`see ${path.basename(STREAK)}`)).toEqual([]);
  });

  it('does not read a glob as a path', () => {
    // `vitest.config.ts`'s own `include` must not become two findings. `*` is
    // not in the character class, so neither segment can be one.
    expect(referencesIn("include: ['src/**/*.test.ts', 'tools/**/*.test.ts']")).toEqual([]);
  });

  it('clips nothing off a longer extension, and reports that it did not take it', () => {
    // FALSE-POSITIVE MODE 1, as a predicate rather than as a tree measurement.
    const tsx = `${STREAK}x`;
    expect(referencesIn(`the plant was ${tsx}, deleted since`).map((h) => [h.ref, h.clipped])).toEqual(
      [[STREAK, true]],
    );
    // The same string without the trailing character IS taken.
    expect(referencesIn(`${STREAK},`).map((h) => [h.ref, h.clipped])).toEqual([[STREAK, false]]);
  });

  it('carries the line the reference sits on', () => {
    // "A check that bites but fails uselessly is half a check." A finding is a
    // `file:line` a reader can open.
    expect(referencesIn(['one', 'two', STREAK, ''].join('\n')).map((h) => h.line)).toEqual([3]);
  });
});

describe('what counts as resolved', () => {
  const files = [AUDIT, WIRING];

  it('takes a whole path and a partial one', () => {
    expect(resolvesAgainst(AUDIT, files)).toBe(true);
    // Prose abbreviates paths. This exact string also works as a vitest filter.
    expect(resolvesAgainst(AUDIT.slice('src/'.length), files)).toBe(true);
  });

  it('refuses a suffix that starts mid-segment, though vitest would take it', () => {
    // Deliberately STRICTER than vitest's substring filter. The question here
    // is "does this name a file", not "would vitest tolerate it". One character
    // into the second segment is still a raw suffix of the real path and is no
    // longer a path.
    const midSegment = AUDIT.slice('src/t'.length);
    expect(AUDIT.endsWith(midSegment)).toBe(true);
    expect(resolvesAgainst(midSegment, files)).toBe(false);
  });

  it('refuses the right basename in the wrong directory', () => {
    expect(resolvesAgainst(AUDIT.replace('tuning', 'game'), files)).toBe(false);
  });

  it('takes a relative specifier by stripping its climb', () => {
    const relative = `../${WIRING.slice('src/'.length)}`;
    expect(normalizeReference(relative)).toBe(WIRING.slice('src/'.length));
    expect(resolvesAgainst(relative, files)).toBe(true);
    expect(normalizeReference(`./${WIRING}`)).toBe(WIRING);
  });

  it('holds fixture paths apart from real ones', () => {
    expect(isSyntheticFixture(FIXTURE_REF)).toBe(true);
    // A directory whose name merely STARTS with the prefix is not the prefix.
    expect(isSyntheticFixture(TEST_PATH_REFS.SYNTHETIC_PREFIX.replace('/', `ish/`) + 'x.test.ts'))
      .toBe(false);
    expect(isSyntheticFixture(STREAK)).toBe(false);
  });
});

describe('driven both ways', () => {
  it('reports a reference to a file that is not there', () => {
    const repo = sandbox('test-path-refs-fires-', {
      [STREAK]: 'export const ok = 1;\n',
      'tools/run.mjs': `// npx vitest run ${STREAK} ${ABSENT_REF}\n`,
    });

    const audit = auditTestPathReferences(repo);

    expect(audit.unresolved).toEqual([{ file: 'tools/run.mjs', line: 1, ref: ABSENT_REF }]);
    // Non-vacuity beside the finding: the good reference on the same line was
    // seen and was NOT reported, so this discriminates rather than reporting
    // whatever it touches.
    expect(audit.references.map((o) => o.ref)).toEqual([STREAK, ABSENT_REF]);
  });

  it('reports nothing on the same tree once the file is there', () => {
    const repo = sandbox('test-path-refs-quiet-', {
      [STREAK]: 'export const ok = 1;\n',
      [ABSENT_REF]: 'export const alsoOk = 1;\n',
      'tools/run.mjs': `// npx vitest run ${STREAK} ${ABSENT_REF}\n`,
    });

    const audit = auditTestPathReferences(repo);

    expect(audit.unresolved).toEqual([]);
    expect(audit.references.length).toBe(2);
  });

  it('does not report a reference that only captured output holds', () => {
    const repo = sandbox('test-path-refs-captured-', {
      [STREAK]: 'export const ok = 1;\n',
      '.gauntlet/evidence/suite.txt': `Test Files 1 passed\n ${ABSENT_REF}\n`,
    });

    expect(auditTestPathReferences(repo).unresolved).toEqual([]);

    // And the exclusion is the reason, not the text being unreachable: the same
    // bytes in a directory that is not captured output ARE reported.
    const control = sandbox('test-path-refs-captured-control-', {
      [STREAK]: 'export const ok = 1;\n',
      'evidence/suite.txt': `Test Files 1 passed\n ${ABSENT_REF}\n`,
    });
    expect(auditTestPathReferences(control).unresolved).toEqual([
      { file: 'evidence/suite.txt', line: 2, ref: ABSENT_REF },
    ]);
  });

  it('does not report a longer extension, and counts what it dropped', () => {
    const repo = sandbox('test-path-refs-clip-', {
      [`${ABSENT_REF}x`]: 'export const tsx = 1;\n',
      'docs/note.md': `the plant was ${ABSENT_REF}x\n`,
    });

    const audit = auditTestPathReferences(repo);

    expect(audit.unresolved).toEqual([]);
    expect(audit.clipped).toEqual([{ file: 'docs/note.md', line: 1, ref: ABSENT_REF }]);
    expect(audit.references).toEqual([]);
  });

  it('does not report a fixture path, and counts it as exempt', () => {
    const repo = sandbox('test-path-refs-fixture-', {
      [STREAK]: `const row = { testFile: '${FIXTURE_REF}' };\n`,
    });

    const audit = auditTestPathReferences(repo);

    expect(audit.unresolved).toEqual([]);
    expect(audit.synthetic).toEqual([{ file: STREAK, line: 1, ref: FIXTURE_REF }]);
  });

  it('reads a binary as nothing rather than as mojibake', () => {
    // `realIp.ts` measured this: reading this tree's binaries as UTF-8 with
    // replacement produces two false watchlist hits, one inside the deflate
    // stream of an app icon. A path-shaped run of bytes can land the same way,
    // so the BYTES decide and not the name.
    const repo = sandbox('test-path-refs-binary-', { [STREAK]: 'ok\n' });
    const withLead = (lead: readonly number[]): Buffer =>
      Buffer.concat([Buffer.from(lead), Buffer.from(ABSENT_REF)]);
    const icon = path.join(repo, 'assets', 'icon.bin');
    mkdirSync(path.dirname(icon), { recursive: true });
    const commitIcon = (lead: readonly number[]): void => {
      writeFileSync(icon, withLead(lead));
      gitIn(repo, ['add', '-A']);
      gitIn(repo, ['commit', '--quiet', '--allow-empty', '-m', 'icon']);
    };

    // Arm one: a NUL byte ahead of the reference.
    commitIcon([0x00, 0x20]);
    expect(auditTestPathReferences(repo).unresolved).toEqual([]);

    // Arm two: no NUL, but a lead byte that is not valid UTF-8. Both arms of
    // the rule are live and they answer different questions — a UTF-16 file is
    // all NULs and a latin-1 one has none. This arm was found by driving the
    // control below and watching it stay silent for the wrong reason.
    commitIcon([0x89, 0x20]);
    expect(auditTestPathReferences(repo).unresolved).toEqual([]);

    // THE CONTROL, and it is why this test is worth its lines: the SAME
    // reference in the SAME file is reported once those bytes are ordinary.
    // One byte apart from arm one. The silence above is the byte rule doing
    // something, not the file being out of reach for some other reason.
    commitIcon([0x20]);
    expect(auditTestPathReferences(repo).unresolved).toEqual([
      { file: 'assets/icon.bin', line: 1, ref: ABSENT_REF },
    ]);
  });
});

describe('the pure fold', () => {
  it('splits every occurrence into exactly one bucket', () => {
    const audit = auditSources(
      [
        {
          file: 'a.md',
          text: [
            `good ${STREAK}`,
            `bad ${ABSENT_REF}`,
            `fixture ${FIXTURE_REF}`,
            `clipped ${STREAK}x`,
            '',
          ].join('\n'),
        },
      ],
      [STREAK],
    );

    expect(audit.references.map((o) => o.ref)).toEqual([STREAK, ABSENT_REF, FIXTURE_REF]);
    expect(audit.clipped.map((o) => o.line)).toEqual([4]);
    expect(audit.synthetic.map((o) => o.ref)).toEqual([FIXTURE_REF]);
    expect(audit.unresolved.map((o) => o.ref)).toEqual([ABSENT_REF]);
    // Clipped is NOT in references; exempt and unresolved both are. That is the
    // arithmetic the pinned counts on the real tree rest on.
    expect(audit.references.length).toBe(3);
  });

  it('reports nothing when there is nothing, and that is not a pass', () => {
    // The empty case exists so the counts above are known to be doing work: an
    // empty input gives empty buckets, which is precisely why the real-tree
    // assertion cannot stand on `unresolved` alone.
    const audit = auditSources([], []);
    expect(audit.references).toEqual([]);
    expect(audit.unresolved).toEqual([]);
  });
});
