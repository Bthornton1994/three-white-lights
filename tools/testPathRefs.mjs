/**
 * testPathRefs.mjs — every `*.test.ts` path this repository names must name a
 * real file.
 *
 * ===========================================================================
 * THE DEFECT THIS EXISTS TO CLOSE, MEASURED ON THIS REPOSITORY
 * ===========================================================================
 * `npx vitest run a.test.ts b.test.ts` where one of those paths does not exist
 * EXITS 0 AND REPORTS SUCCESS, listing only the files it found. Verbatim, at
 * `f4ef02a`, five paths passed and four files ran — the fifth is under
 * `SYNTHETIC_PREFIX` below so that quoting the command here does not make this
 * file the thing it reports:
 *
 *     $ npx vitest run src/licensing/realIp.test.ts src/tuning/audit.test.ts \
 *         tools/claudeIndex.test.ts src/game/guaranteeTags.test.ts \
 *         src/planted/absent.test.ts
 *      Test Files  4 passed (4)
 *           Tests  134 passed (134)
 *     EXIT=0
 *
 * Run alone, that same fifth path prints `No test files found, exiting with
 * code 1` and exits 1 — so vitest CAN detect it and deliberately does not when
 * another filter matches. The consequence sits in the COMMAND LAYER rather
 * than in any test: a standing verification command naming a file that is
 * later renamed or deleted keeps reporting success while covering strictly
 * less than it claims, indefinitely, with no signal. A human reading `passed`
 * learns nothing about what ran.
 *
 * A one-time sweep found the tree clean. This module is what turns that
 * point-in-time measurement into something that stays true.
 *
 * ===========================================================================
 * WHAT IT CHECKS, AND WHAT ITS SCOPING RULE THEREFORE CANNOT
 * ===========================================================================
 * A REFERENCE IS PATH-SHAPED — it contains at least one `/`.
 * `src/game/streak.test.ts` is a reference; a bare `streak.test.ts` in prose is
 * not, and that boundary is a judgement worth stating rather than implying:
 *
 *   - WHAT IT CATCHES. Everything anybody could paste into a command or an
 *     `import`: full repo-relative paths, partial paths written in prose
 *     (`tuning/audit.test.ts`), and relative specifiers
 *     (`../session/sessionWiring.test.ts`). That is the class the defect above
 *     lives in.
 *   - WHAT IT DOES NOT CATCH, and the measurement behind the choice. Widening
 *     to bare basenames adds roughly a thousand more mentions here and drags in
 *     three shapes that are not file references at all: `a.test.ts` and
 *     `b.test.ts` in CLAUDE.md's own description of this defect, and
 *     `name.test.ts` in `empireCore.test.ts`, which is a naming convention
 *     being described rather than a file. Every one of those would need its own
 *     allowlist row, and "is this a metavariable or a real name" is not a
 *     question a scan can answer. A fuzzy exclusion class that somebody has to
 *     keep right is the failure this repository already records for three other
 *     instruments, so the universe stays crisp instead: a `/` means somebody
 *     wrote a LOCATION.
 *   - WHAT NO VERSION OF THIS COULD CATCH. A reference assembled at run time
 *     from parts, and a reference in a file this scan does not read (see
 *     `CAPTURED_OUTPUT_ROOTS`).
 *
 * `*.test.tsx` IS OUT OF SCOPE ON PURPOSE. `vitest.config.ts`'s `include` is
 * `.test.ts` under `src/` and `tools/` and nothing else, so a `.test.tsx` names
 * a file no runner executes. It is also the source of the first false-positive
 * mode below, which is why it gets a guard rather than an entry.
 *
 * ===========================================================================
 * THE TWO FALSE-POSITIVE MODES, BOTH MEASURED, BOTH GUARDED
 * ===========================================================================
 *   1. EXTENSION CLIPPING. A naive `\.test\.ts` matches INSIDE a `.test.tsx`
 *      name and reports a shorter path nobody ever gave a file. Occurrences of
 *      that exact shape are live in this tree: `docs/GDD.md`,
 *      `progression.ts` and `progression.test.ts` all discuss a
 *      `src/card/seed.test.tsx` plant. `referencesIn` requires the character
 *      after the match not to be an identifier character, and REPORTS what it
 *      dropped rather than swallowing it, so the guard has a live subject and a
 *      pinned count in `testPathRefs.test.ts`.
 *   2. SYNTHETIC FIXTURE PATHS. `src/game/guaranteeTags.test.ts` builds fake
 *      `MutationWitness` rows naming files under `SYNTHETIC_PREFIX`. Those are
 *      DELIBERATELY nonexistent — they test the witness schema against itself —
 *      and a check demanding they resolve would force a real file into
 *      existence to satisfy a scan, which is backwards. One prefix, one reason,
 *      pinned in `testPathRefs.test.ts` by count AND by the exact set of files
 *      allowed to use it, so it cannot quietly widen.
 *
 * ===========================================================================
 * WHAT IT READS: THE TRACKED TREE, ASKED OF GIT
 * ===========================================================================
 * `git ls-files` rather than a filesystem walk, following `treeIdentity.mjs`
 * rather than growing a third dialect. That is not only convenience — it makes
 * three exclusions STRUCTURAL instead of an allowlist somebody maintains:
 * `node_modules/`, `.expo/`, `dist/` and `.claude/worktrees/` are all
 * gitignored, so this scan cannot reach them however the list is edited. The
 * last of those matters most: a worktree under `.claude/` is a COMPLETE SECOND
 * CHECKOUT of this repository, and walking one would make this verdict depend
 * on what another agent has half-finished. `testPathRefs.test.ts` asserts git
 * tracks nothing under there rather than trusting the sentence.
 *
 * SO ONE EXCLUSION IS DECLARED HERE, AND IT IS NOT A DIRECTORY SOMEBODY
 * DISLIKES — it is a category: CAPTURED OUTPUT. See `CAPTURED_OUTPUT_ROOTS`.
 *
 * A REFERENCE RESOLVES AGAINST TRACKED FILES, NOT AGAINST DISK, AND THE
 * DIFFERENCE IS DELIBERATE. Resolving against whatever is lying in the working
 * directory would make this verdict a fact about somebody's checkout rather
 * than about this repository — the failure `realIp.ts` records at length, where
 * a pinned census read `.png 10 | .wav 7 | .webp 2` in one checkout of the same
 * commit and `.png 10 | .wasm 1 | .wav 7 | .webp 2` in another, over an 8 MB
 * file a dev script copies out of `node_modules`. Green here and red in a clean
 * checkout is the worse of the two failures, so this one is checkout-independent
 * by construction.
 *
 * THE WINDOW THAT COSTS, stated rather than glossed: a TRACKED file that
 * references a test file which exists on disk but is not yet staged gets a
 * finding. That window is one `git add` wide, the message names the path, and
 * the fix is the command you were about to run anyway. An untracked file
 * referencing an untracked test is not scanned at all, so the common case of
 * writing a module and its test together never reaches this.
 *
 * A NOTE ON `.claude/`, WHICH THIS SCAN READS AND `src/licensing/realIp.ts`'s
 * `NOT_WALKED` DOES NOT. That module walks the filesystem, so it must name
 * `.claude` to stay out of sibling worktrees, and its own header records that
 * the exclusion is "WIDER THAN ITS OWN STATED REASON" — it also hides
 * `agents/builder.md` and `agents/critic.md`, which are hand-written. Asking
 * git instead makes the narrow version free, and those two files are exactly
 * where a stale test path would sit unread. `testPathRefs.test.ts` reads
 * `NOT_WALKED_HIDES_TRACKED` from that module so the divergence is asserted
 * rather than assumed, and reddens if a third directory joins it.
 *
 * ===========================================================================
 * A FAILURE TO MEASURE IS NOT A CLEAN TREE
 * ===========================================================================
 * `trackedFiles` throws when git fails instead of returning an empty list. The
 * shape it refuses is the one `tools/evidence.mjs` records against itself: "an
 * empty list has no problems in it", so a scan that could not look reads
 * exactly like a scan that found nothing. Every count this module produces is
 * pinned as an equality by its test for the same reason.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * The knobs, in one place, per CLAUDE.md's "named constant in one place" rule.
 * None is a game-feel value; they are here so a reader who wants to change one
 * does not have to find it inside a regex at a call site.
 */
export const TEST_PATH_REFS = Object.freeze({
  /** What a runnable test file ends with. `vitest.config.ts`'s `include` agrees. */
  SUFFIX: '.test.ts',

  /**
   * A PATH-SHAPED reference: at least two segments, so at least one `/`.
   *
   * The character class is deliberately narrow. `*` is absent, which is what
   * keeps a glob out of the universe: `src/**` + `/*` + this suffix has no
   * substring where both segments are made only of these characters, so
   * `vitest.config.ts`'s own `include` entries are not references and are not
   * reported. `referencesInGlobIsNotAReference` in the test drives that.
   */
  PATH_SHAPED_SOURCE: '[A-Za-z0-9_.\\-]+(?:/[A-Za-z0-9_.\\-]+)+\\.test\\.ts',

  /**
   * The character that must NOT follow a match. This is false-positive mode 1:
   * without it, `seed.test.tsx` yields a phantom `seed.test.ts`.
   */
  IDENTIFIER_CHAR_SOURCE: '[A-Za-z0-9_]',

  /** Leading `./` and `../` segments, stripped before resolution. */
  RELATIVE_PREFIX_SOURCE: '^(?:\\.\\.?/)+',

  /**
   * DIRECTORIES OF CAPTURED OUTPUT, NOT OF MAINTAINED REFERENCES.
   *
   * `.gauntlet/` holds evidence bundles — raw `npx vitest run` stdout, captured
   * verbatim — and browser records scraped from a running app. There are 22109
   * path-shaped references in there against 302 in the rest of the tree, and
   * every one of them is a photograph of what a path was WHEN A COMMAND RAN.
   * Requiring those to resolve makes this check's verdict depend on when
   * somebody last re-took a bundle, which is the same "verdict moves with
   * unrelated state" failure `realIp.ts` gives as its own reason for excluding
   * this directory. A bundle captured before a rename is supposed to describe
   * the tree it was taken from.
   *
   * ONE ENTRY, ONE REASON, AND THE TEST PINS THE LIST. Adding a second is an
   * edit somebody reviews.
   */
  CAPTURED_OUTPUT_ROOTS: Object.freeze(['.gauntlet']),

  /**
   * FALSE-POSITIVE MODE 2, as one prefix.
   *
   * A path under here is a FIXTURE: a file name written so a scan can be
   * pointed at it, never a file. `src/game/guaranteeTags.test.ts` needs two of
   * them to drive the `MutationWitness` schema against itself, and this file's
   * own test needs the same affordance for the same reason. Nothing under this
   * prefix exists on disk and `testPathRefs.test.ts` asserts that too — if the
   * directory ever becomes real, this exemption is a hole rather than a rule.
   */
  SYNTHETIC_PREFIX: 'src/planted/',
});

/** @typedef {{ file: string, line: number, ref: string }} Occurrence */
/**
 * @typedef {{
 *   scannedFiles: number,
 *   testFiles: readonly string[],
 *   references: readonly Occurrence[],
 *   clipped: readonly Occurrence[],
 *   synthetic: readonly Occurrence[],
 *   unresolved: readonly Occurrence[],
 * }} ReferenceAudit
 */

/** A fresh global matcher. `/g` regexes carry `lastIndex`, so never share one. */
export function pathShapedPattern() {
  return new RegExp(TEST_PATH_REFS.PATH_SHAPED_SOURCE, 'g');
}

/**
 * Every path-shaped reference in `text`, with the ones the extension guard
 * dropped flagged rather than removed.
 *
 * REPORTING THE DROP IS THE POINT. A guard that silently discards has no
 * subject a test can pin, and the count of what it discarded is the only
 * evidence on the real tree that it is still doing anything.
 *
 * @param {string} text
 * @returns {readonly { ref: string, index: number, line: number, clipped: boolean }[]}
 */
export function referencesIn(text) {
  const identifier = new RegExp(TEST_PATH_REFS.IDENTIFIER_CHAR_SOURCE);
  const found = [];
  let lineOfIndex = 1;
  let cursor = 0;
  for (const match of text.matchAll(pathShapedPattern())) {
    const index = match.index ?? 0;
    for (; cursor < index; cursor += 1) if (text[cursor] === '\n') lineOfIndex += 1;
    const after = text[index + match[0].length];
    found.push({
      ref: match[0],
      index,
      line: lineOfIndex,
      clipped: after !== undefined && identifier.test(after),
    });
  }
  return found;
}

/**
 * A reference with its leading `./` / `../` segments removed.
 *
 * Relative specifiers are resolved by SUFFIX rather than against the referring
 * file's directory, which is looser and is the honest description: `new
 * URL('../session/sessionWiring.test.ts', import.meta.url)` in `src/meet/`
 * resolves here because some tracked path ends with those two segments, not
 * because this module computed `src/meet/..`. That is stated rather than
 * glossed — it means a relative specifier pointing at the right BASENAME in
 * the wrong DIRECTORY is not caught.
 *
 * @param {string} ref
 * @returns {string}
 */
export function normalizeReference(ref) {
  return ref.replace(new RegExp(TEST_PATH_REFS.RELATIVE_PREFIX_SOURCE), '');
}

/**
 * True when `ref` names one of `testFiles`.
 *
 * SEGMENT-BOUNDARY SUFFIX, NOT SUBSTRING. `tuning/audit.test.ts` resolves
 * against `src/tuning/audit.test.ts` because prose abbreviates paths and
 * because that string works verbatim as a vitest positional filter. But the
 * same path with a character or two shaved off the front of a segment does NOT
 * resolve, even though vitest's own substring filter would accept it — this
 * rule is deliberately STRICTER than vitest's, because the question here is
 * "does this name a file" and not "would vitest tolerate this". Nobody writes
 * that shape; if somebody does, they get a finding and this paragraph explains
 * it. `refuses a suffix that starts mid-segment` drives it.
 *
 * @param {string} ref
 * @param {readonly string[]} testFiles repo-relative paths that exist
 * @returns {boolean}
 */
export function resolvesAgainst(ref, testFiles) {
  const wanted = normalizeReference(ref);
  return testFiles.some((file) => file === wanted || file.endsWith(`/${wanted}`));
}

/** True when a reference is a fixture rather than a file. False-positive mode 2. */
export function isSyntheticFixture(ref) {
  return normalizeReference(ref).startsWith(TEST_PATH_REFS.SYNTHETIC_PREFIX);
}

/** True when this repo-relative path is read. False for captured output. */
export function inScanScope(relPath) {
  const segments = relPath.split('/');
  return !TEST_PATH_REFS.CAPTURED_OUTPUT_ROOTS.some((root) => segments[0] === root);
}

/**
 * Every path git tracks, repo-relative.
 *
 * THROWS RATHER THAN RETURNING `[]`. A scan that could not look and a scan that
 * found nothing are the same green line otherwise, which is the failure
 * `evidence.mjs` records against its own shot check.
 *
 * @param {string} root
 * @returns {readonly string[]}
 */
export function trackedFiles(root) {
  const result = spawnSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw new Error(`git ls-files could not run in ${root}: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(
      `git ls-files failed in ${root} (exit ${result.status}): ${(result.stderr ?? '').trim()}`,
    );
  }
  return (result.stdout ?? '').split('\0').filter((entry) => entry !== '');
}

/**
 * A file's contents as text, or `null` when its bytes are not text.
 *
 * The same two-arm rule as `classifyBytes` in `src/licensing/realIp.ts` — a NUL
 * byte, or a sequence that is not valid UTF-8, is not text in any language. It
 * is re-stated here rather than imported because this is a `.mjs` a plain
 * `node` process must be able to load and that is a `.ts`. The divergence is
 * harmless in a way the sibling-drift rule cares about: the worst a wrong
 * answer costs here is a phantom reference found inside a compressed image,
 * which the test's pinned counts would report immediately.
 *
 * @param {string} absolute
 * @returns {string | null}
 */
export function readAsText(absolute) {
  let bytes;
  try {
    bytes = readFileSync(absolute);
  } catch {
    return null;
  }
  if (bytes.includes(0)) return null;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Fold a set of already-read files into a report. Pure — the caller does the
 * git and the filesystem, which is what lets the whole verdict be driven over
 * inputs a real repository makes awkward to stage.
 *
 * @param {readonly { file: string, text: string }[]} sources
 * @param {readonly string[]} testFiles
 * @returns {Omit<ReferenceAudit, 'scannedFiles'>}
 */
export function auditSources(sources, testFiles) {
  /** @type {Occurrence[]} */ const references = [];
  /** @type {Occurrence[]} */ const clipped = [];
  /** @type {Occurrence[]} */ const synthetic = [];
  /** @type {Occurrence[]} */ const unresolved = [];
  for (const { file, text } of sources) {
    for (const hit of referencesIn(text)) {
      const occurrence = { file, line: hit.line, ref: hit.ref };
      if (hit.clipped) {
        clipped.push(occurrence);
        continue;
      }
      references.push(occurrence);
      if (isSyntheticFixture(hit.ref)) synthetic.push(occurrence);
      else if (!resolvesAgainst(hit.ref, testFiles)) unresolved.push(occurrence);
    }
  }
  return { testFiles, references, clipped, synthetic, unresolved };
}

/**
 * The whole audit against a real checkout.
 *
 * @param {string} root
 * @returns {ReferenceAudit}
 */
export function auditTestPathReferences(root) {
  const tracked = trackedFiles(root);
  const testFiles = tracked.filter((file) => file.endsWith(TEST_PATH_REFS.SUFFIX));
  const sources = [];
  for (const file of tracked) {
    if (!inScanScope(file)) continue;
    const text = readAsText(path.join(root, file));
    if (text === null) continue;
    sources.push({ file, text });
  }
  return { scannedFiles: sources.length, ...auditSources(sources, testFiles) };
}

/** One `file:line  ref` line per occurrence, for a failure message worth reading. */
export function describeOccurrences(occurrences) {
  return occurrences.map((o) => `  ${o.file}:${o.line}  ${o.ref}`).join('\n');
}
