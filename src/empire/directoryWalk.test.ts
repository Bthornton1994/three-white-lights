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
 * THE SECOND AXIS OF THE SAME WALK, AND IT WAS OPEN FOR A WHOLE ROUND AFTER THE
 * FIRST WAS SHUT. Depth was fixed above; the line that decides which files the
 * walk hands over — the extension filter in `tsFilesUnder` — sits one statement
 * away from the recursion that fix added, and it read `.ts` while
 * `tsconfig.json`'s `include` is `**\/*.ts` AND `**\/*.tsx` with `jsx` set. So a
 * `.tsx` module here is compiled by the same `tsc` the evidence bundle reports
 * at exit 0, and was invisible to every census in this directory, because
 * `shippedModuleNames()` and `directoryFileNames()` are both `tsFilesUnder` and
 * all five sites are rooted on one of them.
 *
 * MEASURED RATHER THAN ARGUED, at this file's base commit. `src/empire/
 * rates.tsx`, nothing else edited, exporting `idleRates()` whose returned
 * `gymBucksPerHour` closure is `EMPIRE_FORBIDDEN_OUTPUTS[0] as never`: `npx tsc
 * --noEmit` exit 0, the closure driven at a one-argument caller returning the
 * string `covered-day`, and the whole repository 85 files / 3478 tests at exit
 * 0. That is the same payload as M84, which the returned-closure census catches
 * in a `.ts` file — so the difference between red and green there is the file's
 * extension and nothing else.
 *
 * WHAT THIS FILE DOES ABOUT THE EXTENSION AXIS. `compiledFilesUnder` enumerates
 * every file at any depth and keeps the ones `tsconfig.json` itself claims,
 * with the extensions read out of its `include` array rather than transcribed
 * into a literal here; `unwalkedCompiledUnder` subtracts what `tsFilesUnder`
 * hands the censuses. `names every file the compiler compiles here that no
 * census walks` pins the difference at zero, by name and by extension, which is
 * the same containment reading `empireSubdirectories()` gives depth — an
 * arriving extension is read by somebody rather than absorbed. Adding `.tsx` to
 * the filter instead would have bought exactly one extension; the next one is
 * the same defect, and this file has now been wrong about its own file set five
 * times by its own count.
 *
 * WHAT THE CONTAINMENT READING DOES NOT DO, since it is containment and not
 * coverage. It does not make the five censuses scan a `.tsx`. A render-only
 * view under `src/empire/` is in scope per CLAUDE.md's split, and when one
 * lands this reading goes red and somebody has to decide what scans it — which
 * is the visible edit, not a silent absorption. It also says nothing about a
 * file `tsconfig.json` does not claim: a `.mts` here is out of both sets, and
 * the catcher for that is in another session's file — `progression.test.ts`'s
 * `leaves no TypeScript file in the repository out of the scanned set`, which
 * walks `.mts`/`.cts` ahead of there being one. Measured here by accident and
 * kept because it is a measurement: a `drive.config.mts` written at the
 * repository root during this round reddened exactly that check, naming the
 * file, while every check in this directory stayed green.
 *
 * THIS SUITE RUNS ONCE PER IMPORTING FILE, BY DESIGN AND NOT BY ACCIDENT.
 * Measured: vitest registers an imported test file's `describe` blocks into the
 * importer, and a `.test.ts` carrying no suite fails collection with "No test
 * suite found in file", so a shared helper here has to carry one. The
 * consequence is that the flatness reading executes inside every file that
 * walks this directory — so `npx vitest run src/empire/empireCore.test.ts`
 * alone still reads it, rather than depending on a 310-second sibling file
 * being in the same run.
 *
 * AND THE JUSTIFICATION ABOVE USED TO CLAIM MORE THAN IT BUYS, corrected here
 * rather than deleted. It read as though the thirty registrations — five tests
 * across six importing files — were themselves evidence, six readings agreeing.
 * They are not evidence of anything. Six executions of one function, in one
 * process, against one filesystem, at one moment, are numerous rather than
 * independent; they answer the same question the same way by construction and
 * no state of the tree makes two of them disagree. What the repetition actually
 * buys is availability — a run narrowed to one importing file still reads these
 * pins instead of depending on a 310-second sibling being collected — and that
 * is worth the duplicated wall time on its own. It is not a redundancy
 * argument, and CLAUDE.md's question about whether harnesses are independent or
 * merely numerous has one answer here.
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
  // 14 -> 17: members.ts (§5.11 stage 3, unpaused as a named exception),
  // plus GDD §5.13 presentation Phase 1's `floor.ts` (pure grid/placement
  // logic) and `FloorGrid.tsx` (the drag-interaction screen).
  // 17 -> 18: GDD §5.13 presentation Phase 3's `floorSim.ts` — the pathing,
  // queuing and use simulation. Read from this pin's own failure value.
  // 18 -> 19: GDD §5.13 presentation Phase 4's `floorSprites.ts` — the
  // floor's index-grid sprite data and its indexed-PNG encoding, one module.
  // 19 -> 20: §5.11 stage 4's `management.ts` — staffing, maintenance,
  // equipment condition and recoverable failure. Read from this pin's own
  // failure value.
  // 20 -> 21: GDD §5.14 Stage B's `pacing.ts` — the economy pacing simulator.
  // 21 -> 22: GDD §5.14 Stage C's `stationView.ts` — the station-tap
  // management selector. Read from this pin's own failure value.
  // 22 -> 23: GDD §5.14 Stage D's `stationCapability.ts` — Quality /
  // Capacity / Throughput algebra.
  // 23 -> 24: GDD §5.18 Stage D.1's `trainingStation.ts` — the Competition
  // Bench Bay, equipment is not a training station.
  // 26 -> 27: Stage G.2A `livingMemberExperience.ts`.
  // 27 -> 28: Stage G.2B `livingMemberRetention.ts`.
  // 28 -> 29: Iron & Amber owned-art adapter (`ironAmberArt.ts`).
  SHIPPED_MODULES: 29,
  /**
   * Files the shared walk hands the censuses today, tests included.
   *
   * A COUNT AND NOT A BOUND, which is what it was until this round. The only
   * reading `directoryFileNames()` had was
   * `toBeGreaterThan(SHIPPED_MODULES)` — satisfied by a walk that had lost
   * eleven of its twenty-three files, in a file that pins counts everywhere
   * else. A truncated or reshaped file set now reports itself here.
   */
  // 31 -> 36: members.ts and members.test.ts, plus floor.ts, floor.test.ts,
  // FloorGrid.tsx.
  // 36 -> 38: GDD §5.13 presentation Phase 3's floorSim.ts and
  // floorSim.test.ts. Read from this pin's own failure value.
  // 38 -> 40: Phase 4's `floorSprites.ts` and `floorSprites.test.ts`.
  // 40 -> 42: stage 4's `management.ts` and `management.test.ts`.
  // 42 -> 44: Stage B's `pacing.ts` and `pacing.test.ts`.
  // 44 -> 46: Stage C's `stationView.ts` and `stationView.test.ts`.
  // 46 -> 48: Stage D's `stationCapability.ts` and `stationCapability.test.ts`.
  // 48 -> 50: Stage D.1's `trainingStation.ts` and `trainingStation.test.ts`.
  // 50 -> 51: Stage D2.1B's `throughputSemantics.test.ts` — closed-loop,
  // live-purchase, C-vs-T, and opening-agency catcher. One test file, no
  // new shipped module. Read from this pin's own failure value.
  // 51 -> 52: Stage D2.2 `d2Consequence.test.ts` — consequence-boundary
  // source trace. One test file, no new shipped module.
  // 54 -> 56: Stage G.1 `livingMembers.ts` and `livingMembers.test.ts`.
  // 56 -> 58: Stage G.2A `livingMemberExperience.ts` and its test.
  // 58 -> 60: Stage G.2B `livingMemberRetention.ts` and its test.
  // 60 -> 62: Iron & Amber owned-art adapter and its test.
  DIRECTORY_FILES: 62,
  /** Directories under `src/empire/` today. */
  SUBDIRECTORIES: 0,
  /**
   * Extensions `tsconfig.json`'s `include` claims: `.ts` and `.tsx` today.
   *
   * Read from that file rather than written here, so this pin moves when the
   * project's own `include` moves and not when somebody edits this literal.
   */
  COMPILED_EXTENSIONS: 2,
  /**
   * Files here the compiler compiles that no census in this directory walks.
   *
   * Zero today. It is one for a `src/empire/rates.tsx`, which is the bypass
   * this reading exists for.
   */
  UNWALKED_COMPILED: 0,
  /** `.ts` files the probe tree holds below its root, tests included. */
  PROBE_TS_FILES: 7,
  /** Non-test modules the probe tree holds below its root. */
  PROBE_SHIPPED: 5,
  /** Directories the probe tree holds, the symlinked one included. */
  PROBE_DIRECTORIES: 5,
  /** Files the extension probe's tree holds that a `.ts`+`.tsx` include claims. */
  PROBE_COMPILED: 5,
  /**
   * Files the compiler claims that the shared walk does not hand over. Since
   * the walk keeps `.ts` and `.tsx`, this is driven against a config that also
   * claims `**\/*.md`, so `notes.md` is the one file compiled-but-unwalked —
   * the discriminating case the widened walk would otherwise have emptied.
   */
  PROBE_UNWALKED: 1,
  /** Files that same tree holds under an include claiming `.ts` alone. */
  PROBE_TS_ONLY_COMPILED: 2,
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
 * The extensions the shared walk hands the five censuses.
 *
 * Declared as a value rather than left inline in `tsFilesUnder`, because
 * `unwalkedCompiledUnder` subtracts what this keeps from what the compiler
 * claims: the two sides of that difference read the same constant, so widening
 * the censuses' reach empties the containment reading instead of leaving two
 * literals to drift apart in different functions.
 */
export const WALKED_EXTENSIONS: readonly string[] = Object.freeze(['.ts', '.tsx']);

/** Whether `name` is a colocated test module, at whatever extension it carries. */
function isTestFileName(name: string): boolean {
  return /\.test\.[A-Za-z0-9]+$/.test(name);
}

/**
 * Every file below `root` whose extension is in `WALKED_EXTENSIONS`, at any
 * depth, relative to `root` and sorted.
 *
 * `tests` decides whether a colocated test module is included, because the five
 * call sites split on exactly that: four want shipped modules and
 * `chainScanFiles()` wants every walked file in the directory.
 *
 * The name is historical — this keeps `.ts` today because `WALKED_EXTENSIONS`
 * says so, and what `tsconfig.json` compiles is a wider set that
 * `compiledFilesUnder` answers separately.
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
      if (!WALKED_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) return;
      if (tests === 'without-tests' && isTestFileName(entry.name)) return;
      found.push(relative(root, full));
    },
  );
  return Object.freeze(found.sort());
}

/** Every file below `root`, at any depth, whatever its extension. */
export function filesUnder(root: string): readonly string[] {
  const found: string[] = [];
  walkTree(
    root,
    () => undefined,
    (full) => {
      found.push(relative(root, full));
    },
  );
  return Object.freeze(found.sort());
}

/**
 * The extensions a `tsconfig.json`'s own `include` claims, read from its text.
 *
 * WHAT IT UNDERSTANDS, in the mechanism's own terms: an `include` array of
 * patterns shaped `**\/*.<ext>`, which is what this project's `tsconfig.json`
 * holds. Anything else — a narrower path prefix, a brace expansion, a missing
 * `include`, a comment making the file JSONC rather than JSON — is a REFUSAL
 * with the offending pattern named, and not a silent fallback to some default.
 * That is deliberate: the failure mode this whole reading exists to close is a
 * file set that quietly did not contain something, so the reader is written to
 * fail loudly at a config shape it cannot answer for rather than to guess.
 *
 * `refuses a config shape it does not understand, rather than guessing` drives
 * every one of those refusals.
 */
export function compiledExtensionsIn(configText: string): readonly string[] {
  const config = JSON.parse(configText) as { readonly include?: unknown };
  const include = config.include;
  if (!Array.isArray(include) || include.length === 0) {
    throw new Error(
      "tsconfig.json has no non-empty `include` array — this reader will not guess the compiler's file set",
    );
  }
  const extensions: string[] = [];
  for (const pattern of include) {
    if (typeof pattern !== 'string') {
      throw new Error(`tsconfig.json's include holds a non-string entry: ${JSON.stringify(pattern)}`);
    }
    const shaped = /^\*\*\/\*(\.[A-Za-z0-9]+)$/.exec(pattern);
    if (shaped === null) {
      throw new Error(
        `tsconfig.json's include holds ${pattern}, which this reader does not understand — widen it deliberately rather than letting a file set shrink silently`,
      );
    }
    extensions.push(shaped[1] as string);
  }
  return Object.freeze([...new Set(extensions)].sort());
}

/**
 * The repo-relative path prefixes a `tsconfig.json`'s `exclude` drops.
 *
 * Same refusal discipline as above, and the reason it is anchored rather than
 * matched at any depth: `exclude: ['node_modules']` means the one at the
 * config's own base, so testing every path segment against it would drop a
 * `src/empire/node_modules.ts` that the compiler does compile — a file missing
 * from the compiled set is a hole in exactly the direction this reading exists
 * to close.
 */
export function excludedPrefixesIn(configText: string): readonly string[] {
  const config = JSON.parse(configText) as { readonly exclude?: unknown };
  const exclude = config.exclude ?? [];
  if (!Array.isArray(exclude)) {
    throw new Error("tsconfig.json's `exclude` is present and is not an array");
  }
  const prefixes: string[] = [];
  for (const pattern of exclude) {
    if (typeof pattern !== 'string' || !/^[A-Za-z0-9._-]+$/.test(pattern)) {
      throw new Error(
        `tsconfig.json's exclude holds ${JSON.stringify(pattern)}, which this reader does not understand — it handles plain directory names only`,
      );
    }
    prefixes.push(pattern);
  }
  return Object.freeze([...new Set(prefixes)].sort());
}

/**
 * The files below `walkRoot` that a `tsconfig.json` rooted at `configRoot`
 * compiles, relative to `walkRoot` and sorted.
 *
 * Two roots because they differ in the shipped case: the config sits at the
 * repository root and the walk starts at `src/empire/`, and `exclude` is
 * resolved against the first while the answer is reported against the second.
 */
export function compiledFilesUnder(
  walkRoot: string,
  configRoot: string,
  extensions: readonly string[],
  excludedPrefixes: readonly string[],
): readonly string[] {
  const found: string[] = [];
  walkTree(
    walkRoot,
    () => undefined,
    (full) => {
      const fromConfig = relative(configRoot, full);
      if (excludedPrefixes.some((prefix) => fromConfig === prefix || fromConfig.startsWith(`${prefix}/`))) {
        return;
      }
      const name = path.basename(full);
      if (!extensions.some((extension) => name.endsWith(extension))) return;
      found.push(relative(walkRoot, full));
    },
  );
  return Object.freeze(found.sort());
}

/**
 * The files below `walkRoot` the compiler compiles and the shared walk does not
 * hand to any census here, each tagged with the extension that put it there.
 *
 * This is the difference the containment reading pins, and it is a real join:
 * one side is `tsconfig.json`'s own claim and the other is `tsFilesUnder`, so a
 * file cannot be absent from both the way it could when both sides of a set
 * equality came off one incomplete enumeration.
 */
export function unwalkedCompiledUnder(
  walkRoot: string,
  configRoot: string,
  extensions: readonly string[],
  excludedPrefixes: readonly string[],
): readonly string[] {
  const walked = new Set(tsFilesUnder(walkRoot, 'with-tests'));
  return Object.freeze(
    compiledFilesUnder(walkRoot, configRoot, extensions, excludedPrefixes)
      .filter((name) => !walked.has(name))
      .map((name) => `${name} (${path.extname(name)})`),
  );
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

/** The repository root, from this file. `tsconfig.json`'s own base. */
const REPO_ROOT = path.resolve(HERE, '..', '..');

/** The project's `tsconfig.json`, as text, read once. */
function projectConfigText(): string {
  return readFileSync(path.join(REPO_ROOT, 'tsconfig.json'), 'utf8');
}

/** The extensions the project compiles, out of `tsconfig.json`'s own `include`. */
export function projectCompiledExtensions(): readonly string[] {
  return compiledExtensionsIn(projectConfigText());
}

/** Every file under `src/empire/` the project's `tsconfig.json` compiles. */
export function empireCompiledFiles(): readonly string[] {
  return compiledFilesUnder(
    HERE,
    REPO_ROOT,
    projectCompiledExtensions(),
    excludedPrefixesIn(projectConfigText()),
  );
}

/**
 * Files under `src/empire/` the compiler compiles and no census here walks.
 *
 * Empty today; read, not assumed — the same containment reading
 * `empireSubdirectories()` gives the depth axis.
 */
export function empireCompiledButUnwalked(): readonly string[] {
  return unwalkedCompiledUnder(
    HERE,
    REPO_ROOT,
    projectCompiledExtensions(),
    excludedPrefixesIn(projectConfigText()),
  );
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

/**
 * A tree carrying the extensions the shipped directory does not have.
 *
 * `src/empire/` is `.ts` at every one of its twenty-three files, so a reading
 * taken at `HERE` cannot tell a walk that splits compiled from walked apart
 * from one that returns the same list twice — the same reason the depth axis
 * needed `probeTree()`. This tree has a `.tsx` module, a `.tsx` test, a `.tsx`
 * below a subdirectory, a plain `.ts` pair, a file the compiler claims under no
 * include, and a directory an `exclude` can be pointed at.
 */
function extensionProbeTree(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'empire-extension-probe-'));
  mkdirSync(path.join(root, 'sub'), { recursive: true });
  mkdirSync(path.join(root, 'vendor'), { recursive: true });
  writeFileSync(path.join(root, 'top.ts'), 'export {};\n');
  writeFileSync(path.join(root, 'top.test.ts'), 'export {};\n');
  writeFileSync(path.join(root, 'view.tsx'), 'export {};\n');
  writeFileSync(path.join(root, 'view.test.tsx'), 'export {};\n');
  writeFileSync(path.join(root, 'notes.md'), 'x\n');
  writeFileSync(path.join(root, 'sub', 'deep.tsx'), 'export {};\n');
  writeFileSync(path.join(root, 'vendor', 'skipped.tsx'), 'export {};\n');
  return root;
}

/** An `include`/`exclude` pair as a config would carry it, as text. */
function configText(include: readonly unknown[], exclude?: readonly unknown[]): string {
  return JSON.stringify(exclude === undefined ? { include } : { include, exclude });
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

  it('splits a tree into what the compiler claims and what the censuses walk', () => {
    // The extension axis, driven on a tree that has one. `src/empire/` is `.ts`
    // at every file, so the compiled list and the walked list agree there at
    // every point and a reading taken at `HERE` alone is satisfied by a split
    // that does not split.
    const root = extensionProbeTree();
    try {
      const both = compiledExtensionsIn(configText(['**/*.ts', '**/*.tsx']));
      expect(both).toEqual(['.ts', '.tsx']);

      // With nothing excluded, every extension the include names is claimed,
      // at any depth.
      expect(compiledFilesUnder(root, root, both, [])).toEqual([
        'sub/deep.tsx',
        'top.test.ts',
        'top.ts',
        'vendor/skipped.tsx',
        'view.test.tsx',
        'view.tsx',
      ]);
      // `exclude` is a parameter and not a decoration: point it at a directory
      // and the files below that directory leave the compiled set.
      const excluded = excludedPrefixesIn(configText(['**/*.ts', '**/*.tsx'], ['vendor']));
      expect(excluded).toEqual(['vendor']);
      expect(compiledFilesUnder(root, root, both, excluded)).toEqual([
        'sub/deep.tsx',
        'top.test.ts',
        'top.ts',
        'view.test.tsx',
        'view.tsx',
      ]);
      expect(compiledFilesUnder(root, root, both, excluded).length).toBe(
        DIRECTORY_WALK.PROBE_COMPILED,
      );

      // What the five censuses see of the same tree. The walk now keeps `.ts`
      // AND `.tsx`, so a `.ts`+`.tsx` include leaves the censuses nothing they
      // miss — the widening RETIRED the discriminating case this test was built
      // on, and the containment reading has to be re-armed against an extension
      // the walk still does not keep.
      expect(tsFilesUnder(root, 'with-tests')).toEqual([
        'sub/deep.tsx',
        'top.test.ts',
        'top.ts',
        'vendor/skipped.tsx',
        'view.test.tsx',
        'view.tsx',
      ]);
      expect(unwalkedCompiledUnder(root, root, both, excluded)).toEqual([]);
      // Re-armed against a THIRD extension the walk does not keep. `notes.md` is
      // claimed by an include that names `**\/*.md` and walked by no census, so
      // the difference is non-empty again — a reading rather than an empty
      // domain. The extension is carried in the row because "a file arrived" and
      // "an extension arrived" are different findings and the second is the one
      // that needs a decision.
      const withMarkdown = compiledExtensionsIn(configText(['**/*.ts', '**/*.tsx', '**/*.md']));
      expect(withMarkdown).toEqual(['.md', '.ts', '.tsx']);
      const excludedMarkdown = excludedPrefixesIn(
        configText(['**/*.ts', '**/*.tsx', '**/*.md'], ['vendor']),
      );
      expect(unwalkedCompiledUnder(root, root, withMarkdown, excludedMarkdown)).toEqual([
        'notes.md (.md)',
      ]);
      expect(unwalkedCompiledUnder(root, root, withMarkdown, excludedMarkdown).length).toBe(
        DIRECTORY_WALK.PROBE_UNWALKED,
      );
      // And `notes.md` is claimed by neither the `.ts`+`.tsx` include nor the
      // walk, so the compiled list is a reading of the include rather than a
      // list of everything present.
      expect(filesUnder(root)).toContain('notes.md');
      expect(compiledFilesUnder(root, root, both, excluded)).not.toContain('notes.md');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reads the split out of a config, so a transcribed extension list fails it', () => {
    // The point of the derivation, made falsifiable. Replace
    // `compiledExtensionsIn` with a literal `['.ts', '.tsx']` — which is the
    // repair this round was told not to make — and the first two expectations
    // below go red, because they hand it a config that claims `.ts` alone and
    // read the answer back off the same tree.
    const root = extensionProbeTree();
    try {
      const tsOnly = compiledExtensionsIn(configText(['**/*.ts']));
      expect(tsOnly).toEqual(['.ts']);
      expect(compiledFilesUnder(root, root, tsOnly, [])).toEqual(['top.test.ts', 'top.ts']);
      expect(compiledFilesUnder(root, root, tsOnly, []).length).toBe(
        DIRECTORY_WALK.PROBE_TS_ONLY_COMPILED,
      );
      // Under that config there is nothing compiled the censuses miss — the
      // same tree, the same walk, a different answer, decided by the config.
      expect(unwalkedCompiledUnder(root, root, tsOnly, [])).toEqual([]);

      // And a config naming an extension nobody here has is followed too, so
      // the reader is not keyed on the two spellings the project happens to
      // use. This is the shape that matters when `tsconfig.json` next moves.
      expect(compiledExtensionsIn(configText(['**/*.mts', '**/*.ts']))).toEqual(['.mts', '.ts']);
      expect(
        compiledFilesUnder(root, root, compiledExtensionsIn(configText(['**/*.md'])), []),
      ).toEqual(['notes.md']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('refuses a config shape it does not understand, rather than guessing', () => {
    // A reader that fell back to a default on an unfamiliar config would answer
    // "nothing is uncovered" for a project whose file set it had not read — the
    // exact failure this reading exists to close, one level out. Each refusal
    // names the pattern it choked on.
    expect(() => compiledExtensionsIn(JSON.stringify({}))).toThrow(/no non-empty `include`/);
    expect(() => compiledExtensionsIn(configText([]))).toThrow(/no non-empty `include`/);
    expect(() => compiledExtensionsIn(configText(['src/**/*']))).toThrow(/src\/\*\*\/\*/);
    expect(() => compiledExtensionsIn(configText(['**/*.{ts,tsx}']))).toThrow(/does not understand/);
    expect(() => compiledExtensionsIn(configText([7]))).toThrow(/non-string entry/);
    expect(() => compiledExtensionsIn('{ // a comment\n}')).toThrow();
    expect(() => excludedPrefixesIn(configText(['**/*.ts'], ['**/generated']))).toThrow(
      /plain directory names only/,
    );
    expect(() => excludedPrefixesIn(configText(['**/*.ts'], ['src/generated']))).toThrow(
      /plain directory names only/,
    );
    // The discriminating half, so the refusals above are a reading rather than
    // a function that throws at everything: the shapes the project actually
    // carries are accepted.
    expect(compiledExtensionsIn(configText(['**/*.ts', '**/*.tsx']))).toEqual(['.ts', '.tsx']);
    expect(excludedPrefixesIn(configText(['**/*.ts'], ['node_modules', 'dist', '.expo']))).toEqual([
      '.expo',
      'dist',
      'node_modules',
    ]);
    expect(excludedPrefixesIn(configText(['**/*.ts']))).toEqual([]);
  });

  it('names every file the compiler compiles here that no census walks', () => {
    // CONTAINMENT, NOT A PROHIBITION, and the same reading `empireSubdirectories()`
    // gives depth. Nothing makes a `.tsx` here illegitimate — CLAUDE.md's split
    // says a render-only view under `src/empire/` is in scope, so the next
    // legitimate piece lands as one. What this line buys is that it is read by
    // somebody, in one place, by name and by extension, instead of being
    // compiled by `tsc` and walked by none of the five censuses.
    //
    // THE ROUTE IT COVERS, named concretely enough to plant: `src/empire/
    // rates.tsx` exporting `idleRates()`, whose returned `gymBucksPerHour`
    // closure body is `EMPIRE_FORBIDDEN_OUTPUTS[0] as never`. At this file's
    // base that compiled at exit 0, drove to the string `covered-day`, and left
    // 85 files / 3478 tests green. With this reading in place it is
    // `rates.tsx (.tsx)` here and nothing else in the repository moves.
    expect(empireCompiledButUnwalked()).toEqual([]);
    expect(empireCompiledButUnwalked().length).toBe(DIRECTORY_WALK.UNWALKED_COMPILED);
    // Non-vacuity on both sides. The compiled set is the whole directory rather
    // than an empty answer from a config that resolved to nothing, and the
    // extensions really were read off `tsconfig.json` and really are two.
    expect(empireCompiledFiles()).toEqual(directoryFileNames());
    expect(empireCompiledFiles().length).toBe(DIRECTORY_WALK.DIRECTORY_FILES);
    expect(projectCompiledExtensions()).toEqual(['.ts', '.tsx']);
    expect(projectCompiledExtensions().length).toBe(DIRECTORY_WALK.COMPILED_EXTENSIONS);
    // The two sides of the difference are joined to the constant that decides
    // it, so widening the censuses' reach and emptying this reading are one
    // edit rather than two that can drift.
    expect(WALKED_EXTENSIONS).toEqual(['.ts', '.tsx']);
    expect(projectCompiledExtensions()).toEqual(
      expect.arrayContaining([...WALKED_EXTENSIONS]),
    );
  });

  it('is the one file here that names a listing API, which is a scan and not a proof', () => {
    // THE TITLE USED TO SAY A SIXTH WALK COULD NOT START FLAT, AND THE PREMISE
    // DID NOT CARRY IT. What this does is scan six spellings of one API in the
    // `.ts` files the shared walk hands over. That is a statement about six
    // strings, and the conclusion it was carrying was a statement about every
    // sixth census anybody might write — a much bigger claim, of exactly the
    // class CLAUDE.md says gets the same bar as "this is fixed". Bounded here
    // to what the scan does, with the routes past it named and each one's
    // catcher named beside it or declared absent.
    //
    // The residual the five repairs leave open, and it is the one this
    // directory has already fallen into three times: a new census writes its
    // own `readdirSync(HERE)`, which on a flat tree agrees with the shared walk
    // at every point, so no assertion anywhere can tell them apart. Three
    // hand-written walkers inherited one defect here once; a fourth is
    // available to anybody who types the call.
    //
    // WHAT THIS CATCHES, in the mechanism's own terms: a directory-listing
    // identifier by NAME, called or bound, in a file `directoryFileNames()`
    // hands over other than this one. The names are the node:fs listing API and
    // the glob helpers a scan would reasonably reach for.
    //
    // WHAT IT DOES NOT CATCH, enumerated rather than gestured at, because the
    // previous version's list omitted the route that had just been used against
    // this directory:
    //
    //   - A WALK IN A FILE THE SHARED WALK DOES NOT HAND OVER. Until this round
    //     that meant any `.tsx`, and the scan's own file list was the reason —
    //     the same one-line filter the header is about. Its catcher is now
    //     `names every file the compiler compiles here that no census walks`,
    //     which reddens on the file's arrival rather than on what it contains.
    //     A `.mts` is still outside both, and `progression.test.ts`'s repo-wide
    //     TypeScript census is what covers that one.
    //   - A SIXTH CENSUS THAT LISTS NO DIRECTORY AT ALL. The defect this ban is
    //     written about was a fence naming two files as literals, with no
    //     listing call anywhere in it; a new census deriving its file list from
    //     `Object.keys(EXPECTED)` has that defect exactly and is invisible
    //     here, because there is no call to see. Nothing in this directory
    //     covers it. It is the honest reason the old title was too strong.
    //   - `fs.promises`, a `require`d handle, a shell out, or a name assembled
    //     at run time. Unchanged from the previous disclosure, covered by
    //     nothing here.
    //
    // The ESM alias — `import { readdirSync as ls } from 'node:fs'`, then
    // `ls(HERE)` — WAS on the invisible list and is not any more: the pattern
    // matches the bound name as well as the call, and `sees a listing API bound
    // as well as called` below drives both forms. It is one spelling closed,
    // not a change of instrument, and the two bullets above still stand.
    const LISTS_A_DIRECTORY =
      /\b(?:readdirSync|readdir|opendirSync|opendir|globSync)\b|\bglob\s*\(/;
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
    // and it really does fire on the shape it is written about. A COUNT, not a
    // bound — `> 10` is satisfied by a walk that has lost eleven of its
    // twenty-three files, which is the shape of every reach defect in this
    // file's own history.
    expect(directoryFileNames().length).toBe(DIRECTORY_WALK.DIRECTORY_FILES);
    expect(directoryFileNames()).toContain(mine);
    let spellings = 0;
    for (const spelling of ['readdirSync(', 'readdir(', 'opendirSync(', 'globSync(', 'glob(']) {
      expect(LISTS_A_DIRECTORY.test(`const x = ${spelling}here);`), spelling).toBe(true);
      spellings += 1;
    }
    expect(spellings).toBe(5);
    // Bound as well as called, which is the alias route: the import binding is
    // the thing a `\s*\(` pattern walked past while the call site read `ls(`.
    let bindings = 0;
    for (const name of ['readdirSync', 'readdir', 'opendirSync', 'globSync']) {
      expect(
        LISTS_A_DIRECTORY.test(`import { ${name} as ls } from 'node:fs';`),
        name,
      ).toBe(true);
      expect(LISTS_A_DIRECTORY.test(`const ls = ${name};`), name).toBe(true);
      bindings += 1;
    }
    expect(bindings).toBe(4);
    // And it discriminates, so the empty list above is a reading rather than a
    // dead pattern: a name that merely contains one of these is not a call, and
    // `glob` on its own is too ordinary a word to read as one.
    expect(LISTS_A_DIRECTORY.test('const readdirSyncCount = 3;')).toBe(false);
    expect(LISTS_A_DIRECTORY.test("readFileSync(path.join(HERE, 'x'));")).toBe(false);
    expect(LISTS_A_DIRECTORY.test('const glob = 3;')).toBe(false);
  });

  it('finds the shipped modules the rest of the directory pins, so the walk is not empty', () => {
    // The empty-domain guard for all five call sites at once: every one of them
    // is a scan over this list, and a list that had gone empty would make all
    // five pass.
    expect(shippedModuleNames()).toEqual([
      'FloorGrid.tsx',
      'GymScreen.tsx',
      'empireCore.ts',
      'empireInvariant.ts',
      'empireTuning.ts',
      'engagement.ts',
      'expansion.ts',
      'floor.ts',
      'floorSim.ts',
      'floorSprites.ts',
      'ironAmberArt.ts',
      'ladder.ts',
      'ladderView.tsx',
      'livingMemberExperience.ts',
      'livingMemberRetention.ts',
      'livingMembers.ts',
      'management.ts',
      'members.ts',
      'npc.ts',
      'pacing.ts',
      'production.ts',
      'recruitment.ts',
      'reputation.ts',
      'sessions.ts',
      'social.ts',
      'sportingReputation.ts',
      'stationCapability.ts',
      'stationView.ts',
      'trainingStation.ts',
    ]);
    expect(shippedModuleNames().length).toBe(DIRECTORY_WALK.SHIPPED_MODULES);
    // And the test files are in the wider list and out of the narrower one, so
    // the `tests` parameter is a parameter rather than a decoration.
    expect(directoryFileNames()).toContain('directoryWalk.test.ts');
    expect(shippedModuleNames()).not.toContain('directoryWalk.test.ts');
    expect(directoryFileNames().length).toBe(DIRECTORY_WALK.DIRECTORY_FILES);
    expect(directoryFileNames().length).toBeGreaterThan(shippedModuleNames().length);
  });
});
