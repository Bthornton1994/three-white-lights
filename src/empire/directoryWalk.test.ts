/**
 * The one directory walk `src/empire/`'s censuses share, and the flatness
 * measurement that says what it is currently walking over.
 *
 * WHY THIS FILE EXISTS. Five separate `readdirSync(HERE)` calls read this
 * directory, in three test files, and all five read one level:
 *
 *   - `empireCore.test.ts`  the import fence — the guard behind "this directory
 *                           imports only its own modules", which is the
 *                           property that makes a parallel session safe
 *   - `empireCore.test.ts`  the purity, magic-number and dice scans
 *   - `empireTuning.test.ts` which `EMPIRE_TUNING` entries shipped code reads
 *   - `empireForbiddenOutput.test.ts` the re-derived unconsumed scan, so a
 *                           NO CONSUMER exemption expires by itself
 *   - `empireForbiddenOutput.test.ts` `chainScanFiles()`, the dispatch-chain
 *                           census's file list
 *
 * E33 made a sixth one — `shippedModulePaths()` in
 * `empireForbiddenOutput.test.ts` — recursive, and left these five flat. The
 * measurement that says why that matters was taken rather than argued:
 * `src/empire/sub/leak.ts`, holding a cross-directory import of
 * `../../game/progression`, compiles (`tsc --noEmit` exit 0), and with it in
 * place the import fence passed 57 tests at exit 0 while fencing a directory
 * that had an illegal edge in it. The four sibling files passed 178 tests at
 * exit 0 beside it. What went red was a count of modules and a shape of
 * directories in a file about bare strings, and no failure message anywhere in
 * the run named `game/progression`. A different check noticing by accident is
 * not the fence working.
 *
 * WHY THE FENCE COULD NOT NOTICE, in the mechanism's own terms. Its credibility
 * rests on a set equality between the keys of its expectations table and the
 * modules the walk found. Both sides derive from the same walk, so a file the
 * walk cannot see is absent from both and the equality holds by construction —
 * and the hard `expect(fenced).toBe(10)` holds too, for the same reason. A
 * both-way join over an incomplete enumeration is not a join.
 *
 * WHAT THIS FILE DOES ABOUT IT, and what it deliberately does not do. It ships
 * one recursive walk and one flatness reading, and the five sites call them
 * instead of writing their own. It does **not** ban subdirectories, because
 * nothing in this repository makes one illegitimate and inventing a rule here
 * would be a design ruling this file does not own — measured rather than
 * assumed: `tsconfig.json` type-checks `src/empire/sub/leak.ts`,
 * `vitest.config.ts`'s `include` is `src/**\/*.test.ts` and already reaches a
 * subdirectory, and `src/tuning/audit.ts` audits an unregistered path under the
 * renderer rule without a row. So the recursion is what makes each census true
 * on its own terms, and `subdirectoriesUnder` is containment: it reports what
 * arrived, by name, in one place, rather than being the thing that keeps four
 * other censuses honest by proxy.
 *
 * THE LIMIT, stated with its catcher rather than left as an absolute. A
 * recursive walk over a directory that happens to be flat is byte-identical to
 * a flat one, so nothing about the shipped tree can distinguish this repair
 * from the defect it replaces. `descends into a subdirectory, on a tree built
 * to have one` is the check that covers that: it builds a temporary tree two
 * levels deep, with a symlinked directory beside a real one, and reads it back.
 * Delete the recursion and that test reddens; delete the symlink arm and
 * `counts a symlinked directory as a directory` reddens.
 *
 * THIS SUITE RUNS ONCE PER IMPORTING FILE, BY DESIGN AND NOT BY ACCIDENT.
 * Measured: vitest registers an imported test file's `describe` blocks into the
 * importer, and a `.test.ts` carrying no suite fails collection with "No test
 * suite found in file", so a shared helper here has to carry one. The
 * consequence is that the flatness reading executes inside every file that
 * walks this directory — so `npx vitest run src/empire/empireCore.test.ts`
 * alone still reads it, rather than depending on a 310-second sibling file
 * being in the same run.
 */

import {
  type Dirent,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * Every number this file pins, in one place.
 *
 * `SHIPPED_MODULES` duplicates a count `empireCore.test.ts` also pins as a
 * list; that is the join rather than a copy — the two disagree the moment the
 * walk and the list disagree, which is the state the flat walk could not reach.
 */
export const DIRECTORY_WALK = Object.freeze({
  /** Shipped (non-test) modules this directory holds today. */
  SHIPPED_MODULES: 10,
  /** Directories under `src/empire/` today. */
  SUBDIRECTORIES: 0,
  /** `.ts` files the probe tree holds below its root, tests included. */
  PROBE_TS_FILES: 7,
  /** Non-test modules the probe tree holds below its root. */
  PROBE_SHIPPED: 5,
  /** Directories the probe tree holds, the symlinked one included. */
  PROBE_DIRECTORIES: 5,
});

/** A path below `root`, with `/` separators, so a pin reads the same anywhere. */
function relative(root: string, at: string): string {
  return path.relative(root, at).split(path.sep).join('/');
}

/**
 * Whether a directory entry is a directory, following a symlink that points at
 * one.
 *
 * This is the predicate axis of both walks below, and it is separated out so it
 * is a subject a test can drive rather than a clause whose only symptom is a
 * missing file. `Dirent.isDirectory()` is false for a symlink even when the
 * link resolves to a directory, so a walk keyed on it alone skips the link and
 * a directory census keyed on it alone reports the tree flat while a module
 * sits behind the link.
 */
export function isDirectoryEntry(at: string, entry: Dirent): boolean {
  if (entry.isDirectory()) return true;
  if (!entry.isSymbolicLink()) return false;
  try {
    return statSync(path.join(at, entry.name)).isDirectory();
  } catch {
    return false;
  }
}

/** Whether `name` under `at` resolves to a directory. The reading, by name. */
export function isDirectory(at: string, name: string): boolean {
  const entry = readdirSync(at, { withFileTypes: true }).find(
    (candidate) => candidate.name === name,
  );
  return entry === undefined ? false : isDirectoryEntry(at, entry);
}

/**
 * Walk `root`, calling `onFile` for every file at any depth.
 *
 * A symlink that resolves to a directory already on the current descent would
 * otherwise recur forever, so the real path of each ancestor is held on a stack
 * and a repeat is reported and not descended. The guard is scoped to the
 * descent rather than to the whole walk on purpose: a global seen-set would
 * make two links to the same directory return whichever the filesystem happened
 * to hand back first, which is a walk whose answer depends on `readdir` order.
 */
function walkTree(
  root: string,
  onDirectory: (at: string) => void,
  onFile: (at: string, entry: Dirent) => void,
): void {
  const walk = (at: string, ancestors: readonly string[]): void => {
    const real = realpathSync(at);
    if (ancestors.includes(real)) return;
    const below = [...ancestors, real];
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const full = path.join(at, entry.name);
      if (isDirectoryEntry(at, entry)) {
        onDirectory(full);
        walk(full, below);
        continue;
      }
      onFile(full, entry);
    }
  };
  walk(root, []);
}

/**
 * Every `.ts` file below `root`, at any depth, relative to `root` and sorted.
 *
 * `tests` decides whether `*.test.ts` is included, because the five call sites
 * split on exactly that: four want shipped modules and `chainScanFiles()` wants
 * every `.ts` in the directory.
 */
export function tsFilesUnder(
  root: string,
  tests: 'with-tests' | 'without-tests',
): readonly string[] {
  const found: string[] = [];
  walkTree(
    root,
    () => undefined,
    (full, entry) => {
      if (!entry.name.endsWith('.ts')) return;
      if (tests === 'without-tests' && entry.name.endsWith('.test.ts')) return;
      found.push(relative(root, full));
    },
  );
  return Object.freeze(found.sort());
}

/** Every directory below `root`, at any depth, relative to `root` and sorted. */
export function subdirectoriesUnder(root: string): readonly string[] {
  const found: string[] = [];
  walkTree(
    root,
    (full) => {
      found.push(relative(root, full));
    },
    () => undefined,
  );
  return Object.freeze(found.sort());
}

/** The shipped modules of `src/empire/`, at any depth, relative to the directory. */
export function shippedModuleNames(): readonly string[] {
  return tsFilesUnder(HERE, 'without-tests');
}

/** Every `.ts` file of `src/empire/`, tests included, at any depth. */
export function directoryFileNames(): readonly string[] {
  return tsFilesUnder(HERE, 'with-tests');
}

/** The directories under `src/empire/`. Empty today; read, not assumed. */
export function empireSubdirectories(): readonly string[] {
  return subdirectoriesUnder(HERE);
}

/**
 * Run `body` against a temporary tree built from `files`, keyed by relative path.
 *
 * Exported because a call site whose walk is rooted at `src/empire/` cannot
 * express the difference between a recursive walk and a flat one — the shipped
 * directory is flat, so both answers agree. A site that wants its OWN reach
 * measured takes a root parameter and drives it through here.
 */
export function withProbeTree(
  files: Readonly<Record<string, string>>,
  body: (root: string) => void,
): void {
  const root = mkdtempSync(path.join(tmpdir(), 'empire-probe-tree-'));
  try {
    for (const [name, text] of Object.entries(files)) {
      const at = path.join(root, ...name.split('/'));
      mkdirSync(path.dirname(at), { recursive: true });
      writeFileSync(at, text);
    }
    body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** Build a temporary tree two levels deep, with a symlinked directory beside a real one. */
function probeTree(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'empire-directory-walk-'));
  mkdirSync(path.join(root, 'sub', 'deeper'), { recursive: true });
  mkdirSync(path.join(root, 'target'), { recursive: true });
  writeFileSync(path.join(root, 'top.ts'), 'export {};\n');
  writeFileSync(path.join(root, 'top.test.ts'), 'export {};\n');
  writeFileSync(path.join(root, 'notes.md'), 'x\n');
  writeFileSync(path.join(root, 'sub', 'nested.ts'), 'export {};\n');
  writeFileSync(path.join(root, 'sub', 'nested.test.ts'), 'export {};\n');
  writeFileSync(path.join(root, 'sub', 'deeper', 'deep.ts'), 'export {};\n');
  writeFileSync(path.join(root, 'target', 'behindLink.ts'), 'export {};\n');
  symlinkSync(path.join(root, 'target'), path.join(root, 'linked'), 'dir');
  // A link back to the root, so the cycle guard is a subject rather than a
  // clause. Without it the walk below does not terminate.
  symlinkSync(root, path.join(root, 'sub', 'loop'), 'dir');
  return root;
}

describe('the directory walk every census in src/empire/ shares', () => {
  it('descends into a subdirectory, on a tree built to have one', () => {
    // The repair is indistinguishable from the defect on the shipped tree,
    // which is flat. So it is driven against a tree that is not — otherwise
    // this change is one no state of the subject could tell from the bug.
    const root = probeTree();
    try {
      expect(tsFilesUnder(root, 'without-tests')).toEqual([
        'linked/behindLink.ts',
        'sub/deeper/deep.ts',
        'sub/nested.ts',
        'target/behindLink.ts',
        'top.ts',
      ]);
      expect(tsFilesUnder(root, 'with-tests')).toEqual([
        'linked/behindLink.ts',
        'sub/deeper/deep.ts',
        'sub/nested.test.ts',
        'sub/nested.ts',
        'target/behindLink.ts',
        'top.test.ts',
        'top.ts',
      ]);
      // Counts, not bounds, so a truncated walk reports itself rather than
      // shrinking into a shorter list somebody reads as correct.
      expect(tsFilesUnder(root, 'without-tests').length).toBe(DIRECTORY_WALK.PROBE_SHIPPED);
      expect(tsFilesUnder(root, 'with-tests').length).toBe(DIRECTORY_WALK.PROBE_TS_FILES);
      // `notes.md` is below the root and is in neither list, so the extension
      // filter is doing something rather than the walk finding nothing.
      expect(tsFilesUnder(root, 'with-tests').some((at) => at.endsWith('.md'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('counts a symlinked directory as a directory', () => {
    // The predicate axis of this walk, and the one a `Dirent.isDirectory()`
    // test gets wrong on its own: for a symlink pointing at a directory that
    // call is false, so a naive walk skips it and a naive directory census
    // reports the tree flat while a module sits behind the link.
    const root = probeTree();
    try {
      expect(subdirectoriesUnder(root)).toEqual([
        'linked',
        'sub',
        'sub/deeper',
        'sub/loop',
        'target',
      ]);
      expect(subdirectoriesUnder(root).length).toBe(DIRECTORY_WALK.PROBE_DIRECTORIES);
      // `sub/loop` points back at the root and is reported once without being
      // descended, which is the cycle guard. Nothing below it appears.
      expect(subdirectoriesUnder(root).filter((at) => at.startsWith('sub/loop/'))).toEqual([]);
      expect(isDirectory(root, 'linked')).toBe(true);
      expect(isDirectory(root, 'target')).toBe(true);
      // The discriminating half: a plain file and a name that is not there both
      // come back false, so the answer above is a reading rather than a `true`.
      expect(isDirectory(root, 'top.ts')).toBe(false);
      expect(isDirectory(root, 'nothing-here')).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reads src/empire/ as flat today, and names anything that arrives', () => {
    // Containment, not a prohibition. Nothing in this repository makes a
    // subdirectory here illegitimate — `tsc` accepts one, `vitest.config.ts`'s
    // include glob already reaches one, and the magic-number audit handles an
    // unregistered path under its renderer rule. What this line buys is that a
    // subdirectory arriving is read by somebody, in one place, by name, instead
    // of being absorbed silently by five walks that recurse into it.
    expect(empireSubdirectories()).toEqual([]);
    expect(empireSubdirectories().length).toBe(DIRECTORY_WALK.SUBDIRECTORIES);
  });

  it('is the only file here that lists a directory, so a sixth walk cannot start flat', () => {
    // The residual the five repairs leave open, and it is the one this
    // directory has already fallen into three times: a new census writes its
    // own `readdirSync(HERE)`, which on a flat tree agrees with the shared walk
    // at every point, so no assertion anywhere can tell them apart. Three
    // hand-written walkers inherited one defect here once; a fourth is
    // available to anybody who types the call.
    //
    // WHAT THIS CATCHES, in the mechanism's own terms: a directory-listing call
    // by NAME, in a `.ts` file under `src/empire/` other than this one. The
    // names are the node:fs listing API and the glob helpers a scan would
    // reasonably reach for.
    //
    // WHAT IT DOES NOT CATCH, stated rather than implied. It is a source scan,
    // and this repository's own record on source scans is that the next
    // unenumerated spelling wins: a walk built on `fs.promises`, on a `require`d
    // alias, on a shell out, or on a name assembled at run time is invisible to
    // it. It is containment on the cheap route rather than a proof, and the
    // expensive routes are covered by nothing here. The reason it is still
    // worth having is that the cheap route is the one that actually happened,
    // five times, and it forces the sixth to be a visible edit.
    const LISTS_A_DIRECTORY = /\b(?:readdirSync|readdir|opendirSync|opendir|globSync|glob)\s*\(/;
    const mine = 'directoryWalk.test.ts';
    const offenders = directoryFileNames()
      .filter((name) => name !== mine)
      .filter((name) =>
        LISTS_A_DIRECTORY.test(
          readFileSync(path.join(HERE, ...name.split('/')), 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\/\/.*$/gm, ''),
        ),
      );
    expect(offenders, `these list the directory themselves: ${offenders.join(', ')}`).toEqual([]);
    // The domain is not empty: the scan really did read every other file here,
    // and it really does fire on the shape it is written about.
    expect(directoryFileNames().length).toBeGreaterThan(DIRECTORY_WALK.SHIPPED_MODULES);
    expect(directoryFileNames()).toContain(mine);
    let spellings = 0;
    for (const spelling of ['readdirSync(', 'readdir(', 'opendirSync(', 'globSync(']) {
      expect(LISTS_A_DIRECTORY.test(`const x = ${spelling}here);`), spelling).toBe(true);
      spellings += 1;
    }
    expect(spellings).toBe(4);
    // And it discriminates, so the empty list above is a reading rather than a
    // dead pattern: a name that merely contains one of these is not a call.
    expect(LISTS_A_DIRECTORY.test('const readdirSyncCount = 3;')).toBe(false);
    expect(LISTS_A_DIRECTORY.test("readFileSync(path.join(HERE, 'x'));")).toBe(false);
  });

  it('finds the shipped modules the rest of the directory pins, so the walk is not empty', () => {
    // The empty-domain guard for all five call sites at once: every one of them
    // is a scan over this list, and a list that had gone empty would make all
    // five pass.
    expect(shippedModuleNames()).toEqual([
      'empireCore.ts',
      'empireInvariant.ts',
      'empireTuning.ts',
      'engagement.ts',
      'expansion.ts',
      'npc.ts',
      'production.ts',
      'recruitment.ts',
      'reputation.ts',
      'social.ts',
    ]);
    expect(shippedModuleNames().length).toBe(DIRECTORY_WALK.SHIPPED_MODULES);
    // And the test files are in the wider list and out of the narrower one, so
    // the `tests` parameter is a parameter rather than a decoration.
    expect(directoryFileNames()).toContain('directoryWalk.test.ts');
    expect(shippedModuleNames()).not.toContain('directoryWalk.test.ts');
    expect(directoryFileNames().length).toBeGreaterThan(shippedModuleNames().length);
  });
});
