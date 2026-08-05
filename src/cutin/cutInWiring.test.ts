/**
 * cutInWiring.test.ts — that the gate is actually WIRED, and that no screen can
 * route around it.
 *
 * ---------------------------------------------------------------------------
 * WHY A SOURCE SCAN
 * ---------------------------------------------------------------------------
 * This project has no DOM test runner: `vitest.config.ts` is `environment:
 * node` and the suite is `src/**\/*.test.ts`, so a `.tsx` cannot be rendered
 * here at all. `sessionWiring.test.ts` established the idiom for exactly this
 * problem and this file follows it — read the real sources and fail on the
 * shapes that would break the rule.
 *
 * IT IS WEAKER THAN RENDERING AND THIS FILE DOES NOT PRETEND OTHERWISE. What a
 * scan can prove is that the call is present and the handler is the right one.
 * What it cannot prove is that a tap on a phone reaches it, or that the
 * interrupt feels like an interrupt. GDD §12.1 is explicit that the second of
 * those was never automatable.
 *
 * EVERY SCAN BELOW IS PAIRED WITH A POSITIVE CONTROL, because a scan that has
 * stopped matching passes every file.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import ts from 'typescript';

import { onlyComments, withoutComments } from '../tuning/audit';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..');
const REPO_ROOT = path.resolve(SRC, '..');

function source(relPath: string): string {
  return readFileSync(path.join(SRC, relPath), 'utf8');
}

/** Comments blanked, string contents kept — a testID and a JSX prop are code. */
function code(relPath: string): string {
  return withoutComments(source(relPath));
}

/**
 * The other half of the same file: its COMMENTS, as one flat run of prose.
 *
 * `onlyComments` is `withoutComments`'s complement and `audit.test.ts` checks
 * that they partition the file. Decoration — the leading `*` of a jsdoc line,
 * the `//` of a line comment, the fences — is stripped and runs of whitespace
 * are collapsed, so a claim that wraps across four lines is one string to match
 * against rather than four.
 */
function prose(relPath: string): string {
  return onlyComments(source(relPath))
    .replace(/^\s*(?:\/\*+|\*+\/|[*/]+)/gm, ' ')
    .replace(/\*+\/|\/\*+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const VIEW = code('cutin/CutInView.tsx');
const HOST = code('cutin/CutInHost.tsx');

/**
 * THE FOUR FIRING MOMENTS OF GDD §7.2, AND THE SCREEN THAT REPORTS EACH.
 *
 * Spelled out here rather than derived, so deleting a `useOfferCutIn` call from
 * any one of these screens turns this file red by name. A gate with no callers
 * is the same failure as an empty firing-moment list, one layer out.
 *
 * IT IS NOT THE SCOPE OF THE SCANS BELOW, and that distinction is the whole
 * point of `THE SET OF FILES THAT TALK TO THE GATE IS THIS SET` further down.
 * Every scan in this file used to read only these five paths, so a SIXTH screen
 * — one offering two beat kinds at once, or one opening its own gate session —
 * was invisible to all of them and the run's ruled claims about the priority
 * order and the cap would have gone quietly false. The list is now checked to
 * be exhaustive by walking `src/`, which is the difference between a statement
 * and a restatement.
 */
const CALLERS: readonly (readonly [string, string, string])[] = [
  ['third-attempt walk-out', 'meet/WalkoutView.tsx', "kind: 'meet-walkout'"],
  ['a PR at a meet', 'meet/RecapView.tsx', "kind: 'record'"],
  ['a PR in the daily loop', 'session/CloseOutView.tsx', "kind: 'record'"],
  ['bombing out', 'meet/BombOutView.tsx', "kind: 'meet-over'"],
  ['a coach reaction on a heavy set', 'session/RestView.tsx', "kind: 'work-set'"],
];

/**
 * The two screens that own a sitting and mount the host over it.
 *
 * `src/`-relative, like `CALLERS`. The sitting derivation further down works in
 * REPOSITORY-relative paths — its file list is the compiler's, which reaches
 * outside `src/` — and prefixes these rather than keeping a second list.
 */
const HOST_SCREENS: readonly string[] = ['meet/MeetScreen.tsx', 'session/SessionScreen.tsx'];

/**
 * Every non-test source file under `src/`, as a path relative to `src/`.
 *
 * `includeTests` DEFAULTS TO FALSE AND NO CALLER BELOW PASSES IT except the
 * prose scan, so every walk in this file behaves as it did before the parameter
 * existed. The prose scan wants tests too: a comment in a test file describes
 * the architecture to the next reader exactly as loudly as one in a module, and
 * `cutInArt.test.ts` is where most of this piece's history is written down.
 */
function everySourceFile(dir: string = '', includeTests: boolean = false): readonly string[] {
  return readdirSync(path.join(SRC, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = dir === '' ? entry.name : `${dir}/${entry.name}`;
    if (entry.isDirectory()) return everySourceFile(rel, includeTests);
    if (!/\.tsx?$/.test(entry.name)) return [];
    if (!includeTests && /\.test\.tsx?$/.test(entry.name)) return [];
    return [rel];
  });
}

/**
 * The piece's own module. Excluded from the walks below BY PREFIX rather than
 * by name, so a file added to `src/cutin/` cannot escape the exclusion and a
 * file added anywhere else cannot fall into it.
 *
 * THE RESIDUAL THAT LEAVES, STATED RATHER THAN DISCOVERED: a NEW file inside
 * `src/cutin/` could open a session and no check here would see it. That is
 * left standing on purpose and is the softest of the holes — it has to be
 * written inside the module whose entire purpose is the cap, next to the
 * comments explaining it, and `resumeCutInSession` makes a re-open under an
 * existing id idempotent, so the damage needs a NEW id as well as a new file.
 *
 * WHAT IT NO LONGER LEAVES, and what this comment used to describe only half of:
 * the exclusion also hid a RE-EXPORT. One line inside this directory —
 *
 *     export { useOfferCutIn as offerBeat } from './CutInHost';
 *
 * — launders the name, and a sixth screen calling `offerBeat` spells none of the
 * words a text scan is looking for. Proved by execution before it was closed: a
 * `SixthView.tsx` offering TWO beat kinds through that alias type-checked clean
 * and left all 2470 tests green, with GDD §7.2's ruled "the priority order
 * decides nothing today" false and nothing red. The previous round's argument —
 * that an aliased import still spells the original name somewhere — is true of a
 * DIRECT import and of a re-export OUTSIDE this directory, and false of one
 * inside it, because the file holding the original spelling is the excluded one.
 * So the caller set is now the type checker's, exactly like `SITTING_BINDINGS`,
 * and the text scan below survives only as a cross-check.
 */
const THE_GATE_ITSELF = 'cutin/';

/**
 * NAMING ANY OF THESE IS TALKING TO THE GATE — the TEXT half, kept as a
 * cross-check on the symbol scan rather than as the answer.
 *
 * `useOfferCutIn` is how a screen reports a beat; the others are the gate and
 * the ledger themselves, which no screen may reach — a screen that opened its
 * own session would mint itself a second slot and §12.3's refusal condition
 * would become a convention.
 */
const GATE_ENTRY_POINTS =
  /\b(?:useCutIn|useOfferCutIn|openCutInSession|resumeCutInSession|requestCutIn|rememberCutInSession|forgetAllCutInSessions)\b/;

/** Files outside `src/cutin/` whose code matches `pattern`. */
function filesNaming(pattern: RegExp): readonly string[] {
  return everySourceFile()
    .filter((rel) => !rel.startsWith(THE_GATE_ITSELF))
    .filter((rel) => pattern.test(code(rel)))
    .sort();
}

/**
 * THE BINDINGS THAT ARE THE GATE, by module and exported name.
 *
 * The same list `GATE_ENTRY_POINTS` spells, asked of the compiler instead — and
 * one name longer. `useCutIn` was in neither list before this round, and a
 * screen writing `const { offer } = useCutIn(); offer(beats)` reaches the gate
 * without naming anything either scan was looking for. It is a hook this module
 * exports for exactly that purpose, so it belongs here.
 */
const GATE_BINDINGS: readonly (readonly [string, readonly string[]])[] = [
  ['src/cutin/CutInHost.tsx', ['useOfferCutIn', 'useCutIn']],
  ['src/cutin/cutInGate.ts', ['openCutInSession', 'requestCutIn']],
  [
    'src/cutin/cutInLedger.ts',
    ['resumeCutInSession', 'rememberCutInSession', 'forgetAllCutInSessions'],
  ],
];

/** The one binding whose LOCAL SPELLINGS the priority-order loop has to read. */
const THE_OFFER_HOOK: readonly [string, string] = ['src/cutin/CutInHost.tsx', 'useOfferCutIn'];

// ---------------------------------------------------------------------------
// WHO CLAIMS A SITTING — asked of the type checker, not of a JSX spelling
// ---------------------------------------------------------------------------

/**
 * THE THREE BINDINGS THAT CLAIM A SITTING, by module and exported name.
 *
 * A SITTING IS WHAT THE CAP COUNTS (GDD §7.2), so the set of files that can open
 * one is the set §12.3's refusal condition actually rests on. It used to be
 * derived from the text `<CutInHost`, and that is a JSX SPELLING rather than a
 * binding: a screen doing
 *
 *     import { CutInHost as Interrupt } from '../cutin/CutInHost';
 *     <Interrupt sessionId="meet-7" seed={3} />
 *
 * matched neither `<CutInHost\b` nor `cutInSessionId|cutInSessionSeed` — it
 * passes a literal id — and so opened a SECOND gate session under a SECOND id
 * inside one sitting, handing the player a second cut-in with nothing red.
 * `AppShell.tsx` is the plausible author of that edit: it is the one file in the
 * tree that talks about hosts without mounting one.
 *
 * SO THE SET IS ASKED OF THE COMPILER. Every identifier in the project is
 * resolved with `checker.getSymbolAtLocation`, aliases followed with
 * `getAliasedSymbol`, and compared against the symbols these three exports
 * declare. An alias, a namespace import, a re-export chain and a dynamic
 * `import()` all resolve to the same symbol, so "what counts as a reference" is
 * not a question this file answers — which is the same move `progression.test.ts`
 * makes for the route table, and for the same reason: it hand-rolled that answer
 * once and the hand-rolled version was the defect.
 *
 * IT IS COARSER THAN THE OLD PATTERN ON PURPOSE. Referencing `CutInHost` AT ALL
 * puts a file in this set, including a type-only import. That errs toward red,
 * and red on a file that turns out to be innocent is a line added to
 * `HOST_SCREENS` on purpose — which is the direction a refusal condition should
 * fail in.
 */
const SITTING_BINDINGS: readonly (readonly [string, readonly string[]])[] = [
  ['src/cutin/CutInHost.tsx', ['CutInHost']],
  ['src/cutin/cutInGate.ts', ['cutInSessionId', 'cutInSessionSeed']],
];

/** Repo-relative posix path, or `null` for anything outside the repository. */
function repoPathOf(fileName: string): string | null {
  const rel = path.relative(REPO_ROOT, fileName).split(path.sep).join('/');
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  if (/(?:^|\/)node_modules\//.test(rel)) return null;
  return rel;
}

/** The declared symbols of `names`, as `file` exports them. */
function exportedSymbols(
  program: ts.Program,
  checker: ts.TypeChecker,
  file: string,
  names: readonly string[],
): readonly ts.Symbol[] {
  const source = program.getSourceFile(path.join(REPO_ROOT, file));
  if (source === undefined) throw new Error(`${file} is not in the program`);
  const moduleSymbol = checker.getSymbolAtLocation(source);
  if (moduleSymbol === undefined) throw new Error(`${file} is not a module`);
  const exported = checker.getExportsOfModule(moduleSymbol);
  return names.map((name) => {
    const found = exported.find((symbol) => symbol.name === name);
    if (found === undefined) throw new Error(`${file} no longer exports ${name}`);
    return found;
  });
}

interface SymbolScan {
  readonly scanned: readonly string[];
  readonly referencing: readonly string[];
  /**
   * Per file, the LOCAL SPELLINGS that resolved into `wanted`.
   *
   * `import { useOfferCutIn as offerBeat }` puts both names here, and a caller
   * reading call sites has to look for both — which is the difference between
   * finding a laundered call and reporting the file as offering no beat at all.
   */
  readonly localNames: ReadonlyMap<string, readonly string[]>;
}

/** Every file in `program` holding an identifier that resolves into `wanted`. */
function filesReferencing(
  program: ts.Program,
  checker: ts.TypeChecker,
  wanted: ReadonlySet<ts.Symbol>,
): SymbolScan {
  const scanned: string[] = [];
  const referencing: string[] = [];
  const localNames = new Map<string, readonly string[]>();
  for (const source of program.getSourceFiles()) {
    if (source.isDeclarationFile) continue;
    const rel = repoPathOf(source.fileName);
    if (rel === null) continue;
    scanned.push(rel);
    const spellings = new Set<string>();
    const visit = (node: ts.Node): void => {
      if (ts.isIdentifier(node)) {
        const symbol = checker.getSymbolAtLocation(node);
        const resolved =
          symbol !== undefined && (symbol.flags & ts.SymbolFlags.Alias) !== 0
            ? checker.getAliasedSymbol(symbol)
            : symbol;
        if (resolved !== undefined && wanted.has(resolved)) spellings.add(node.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    if (spellings.size > 0) {
      referencing.push(rel);
      localNames.set(rel, [...spellings].sort());
    }
  }
  return { scanned: scanned.sort(), referencing: referencing.sort(), localNames };
}

/**
 * The project, compiled once and shared by both symbol scans.
 *
 * MEMOISED RATHER THAN RUN AT IMPORT, the same call `progression.test.ts` makes:
 * building a `ts.Program` over the whole project is a few seconds of real work,
 * and an import that takes seconds has neither a timeout nor a useful failure
 * message. Inside a test it has both.
 *
 * THE ROOT SET IS `tsconfig.json`'s OWN, not a walk of `src/`. §12.2 records why
 * — a scan rooted at `src/` cannot see `App.tsx`, which sits at the repository
 * root, mounts the shell, and could mount a host. The non-vacuity check below
 * names it by hand.
 */
let programMemo: { readonly program: ts.Program; readonly checker: ts.TypeChecker } | null = null;
function theProject(): { readonly program: ts.Program; readonly checker: ts.TypeChecker } {
  if (programMemo !== null) return programMemo;
  const configPath = path.join(REPO_ROOT, 'tsconfig.json');
  const config: unknown = ts.readConfigFile(configPath, ts.sys.readFile).config;
  const parsed = ts.parseJsonConfigFileContent(config, ts.sys, REPO_ROOT);
  if (parsed.fileNames.length === 0) {
    throw new Error('tsconfig.json resolved to no files — the derived pins would pass vacuously');
  }
  const program = ts.createProgram([...parsed.fileNames], {
    ...parsed.options,
    noEmit: true,
    skipLibCheck: true,
  });
  programMemo = { program, checker: program.getTypeChecker() };
  return programMemo;
}

function scanFor(bindings: readonly (readonly [string, readonly string[]])[]): SymbolScan {
  const { program, checker } = theProject();
  const wanted = new Set(
    bindings.flatMap(([file, names]) => exportedSymbols(program, checker, file, names)),
  );
  return filesReferencing(program, checker, wanted);
}

let sittingScanMemo: SymbolScan | null = null;
function sittingScan(): SymbolScan {
  if (sittingScanMemo === null) sittingScanMemo = scanFor(SITTING_BINDINGS);
  return sittingScanMemo;
}

let gateScanMemo: SymbolScan | null = null;
function gateScan(): SymbolScan {
  if (gateScanMemo === null) gateScanMemo = scanFor(GATE_BINDINGS);
  return gateScanMemo;
}

let offerScanMemo: SymbolScan | null = null;
function offerScan(): SymbolScan {
  if (offerScanMemo === null) offerScanMemo = scanFor([[THE_OFFER_HOOK[0], [THE_OFFER_HOOK[1]]]]);
  return offerScanMemo;
}

/**
 * A TEST FILE, by the same regular expression `everySourceFile` uses.
 *
 * The two scans have to agree about what they drop or the comparison between
 * them is between different sets. It is a regex's opinion, which §12.2 has ruled
 * on elsewhere for the sweeps that hold refusal conditions; here it only decides
 * which files may name the gate freely, and `src/cutin/`'s own tests — the ones
 * that really do call `openCutInSession` — are already dropped by prefix.
 */
function isTestFile(rel: string): boolean {
  return /\.test\.tsx?$/.test(rel);
}

/** Repo-relative, outside `src/cutin/`, non-test files in a symbol scan. */
function outsideTheGate(scan: SymbolScan): readonly string[] {
  return scan.referencing
    .filter((rel) => !rel.startsWith(`src/${THE_GATE_ITSELF}`))
    .filter((rel) => !isTestFile(rel));
}

/** Repo-relative files outside `src/cutin/` that claim a sitting. */
function filesClaimingASitting(): readonly string[] {
  return sittingScan().referencing.filter((rel) => !rel.startsWith(`src/${THE_GATE_ITSELF}`));
}

/** Repo-relative files outside `src/cutin/` that reach a gate entry point. */
function filesTalkingToTheGate(): readonly string[] {
  return outsideTheGate(gateScan());
}

// ---------------------------------------------------------------------------
// The scans can see what they are looking for
// ---------------------------------------------------------------------------

describe('the scans are not blind', () => {
  it('strips comments and keeps code', () => {
    expect(withoutComments('// onPress={onDismiss}\n')).not.toMatch(/onDismiss/);
    expect(withoutComments('<X onPress={onDismiss} />')).toMatch(/onDismiss/);
  });

  it('reads the real files', () => {
    expect(VIEW.length).toBeGreaterThan(500);
    expect(HOST.length).toBeGreaterThan(500);
    for (const [, file] of CALLERS) {
      expect(source(file).length, file).toBeGreaterThan(500);
    }
  });

  it('THE WALK REACHES THE WHOLE TREE, and the patterns match a real caller', () => {
    // Three positive controls for the derivation below, because a walk that
    // returned nothing and a pattern that matched nothing would agree with a
    // hand-written list right up until the day they were needed.
    const all = everySourceFile();
    expect(all.length, 'the walk found almost nothing').toBeGreaterThan(50);
    // It descends into directories rather than reading only the top level...
    expect(all).toContain('cutin/CutInHost.tsx');
    expect(all).toContain('meet/WalkoutView.tsx');
    // ...it skips tests, which are full of these names by design...
    expect(all.filter((f) => f.includes('.test.'))).toEqual([]);
    // ...and both patterns really do match the files that really do call the
    // gate. If either stopped matching, `filesNaming` would return `[]` and the
    // equality below would fail loudly rather than pass silently — but only the
    // FIRST of those is guaranteed by the equality itself, so both are asserted.
    expect(GATE_ENTRY_POINTS.test(code('cutin/CutInHost.tsx'))).toBe(true);
    expect(GATE_ENTRY_POINTS.test(code('meet/WalkoutView.tsx'))).toBe(true);
    // The exclusion is a prefix on the walk's own output, not a missing file.
    expect(filesNaming(GATE_ENTRY_POINTS)).not.toContain('cutin/CutInHost.tsx');
  });

  it('AN ALIASED IMPORT IS STILL A REFERENCE — the sitting scan’s positive control', () => {
    // The mutation this whole derivation exists for, run against a THREE-FILE
    // PROGRAM BUILT IN MEMORY so the control is permanent rather than a thing a
    // builder once did by hand and reverted. If `getAliasedSymbol` stopped being
    // followed, the equality below would report the two host screens and look
    // exactly like a pass while a third screen mounted its own host.
    const files: Readonly<Record<string, string>> = {
      '/v/host.tsx': 'export function CutInHost(p: { sessionId: string; seed: number }): unknown { return p; }\n',
      '/v/aliased.tsx':
        "import { CutInHost as Interrupt } from './host';\n" +
        'export const a = <Interrupt sessionId="meet-7" seed={3} />;\n',
      '/v/namespaced.tsx':
        "import * as Gate from './host';\n" +
        'export const b = <Gate.CutInHost sessionId="meet-7" seed={3} />;\n',
      '/v/innocent.tsx': 'export const c = 2;\n',
    };
    const host: ts.CompilerHost = {
      fileExists: (name) => name in files,
      readFile: (name) => files[name],
      getSourceFile: (name, languageVersion) => {
        const text = files[name];
        return text === undefined ? undefined : ts.createSourceFile(name, text, languageVersion, true);
      },
      getDefaultLibFileName: () => '/v/lib.d.ts',
      writeFile: () => undefined,
      getCurrentDirectory: () => '/v',
      getCanonicalFileName: (name) => name,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => '\n',
    };
    const program = ts.createProgram(
      Object.keys(files),
      { noLib: true, noEmit: true, jsx: ts.JsxEmit.Preserve },
      host,
    );
    const checker = program.getTypeChecker();
    const declaring = program.getSourceFile('/v/host.tsx');
    expect(declaring, 'the virtual program did not build').toBeDefined();
    if (declaring === undefined) return;
    const moduleSymbol = checker.getSymbolAtLocation(declaring);
    expect(moduleSymbol).toBeDefined();
    if (moduleSymbol === undefined) return;
    const target = checker.getExportsOfModule(moduleSymbol).find((s) => s.name === 'CutInHost');
    expect(target).toBeDefined();
    if (target === undefined) return;

    const seen: string[] = [];
    for (const sourceFile of program.getSourceFiles()) {
      let found = false;
      const visit = (node: ts.Node): void => {
        if (found) return;
        if (ts.isIdentifier(node)) {
          const symbol = checker.getSymbolAtLocation(node);
          const resolved =
            symbol !== undefined && (symbol.flags & ts.SymbolFlags.Alias) !== 0
              ? checker.getAliasedSymbol(symbol)
              : symbol;
          if (resolved === target) found = true;
        }
        ts.forEachChild(node, visit);
      };
      visit(sourceFile);
      if (found) seen.push(sourceFile.fileName);
    }
    // The aliased JSX tag and the namespaced one both count; the file that
    // imports nothing does not. A text scan for `<CutInHost` sees none of the
    // first two.
    expect(seen.sort()).toEqual(['/v/aliased.tsx', '/v/host.tsx', '/v/namespaced.tsx']);
    expect(seen).not.toContain('/v/innocent.tsx');
    expect(files['/v/aliased.tsx'], 'the fixture stopped being the aliased shape').not.toMatch(
      /<CutInHost\b/,
    );
  });
});

// ---------------------------------------------------------------------------
// THE PROSE HAS TO DESCRIBE THE ARCHITECTURE THAT IS THERE — GDD §7.2
// ---------------------------------------------------------------------------

/**
 * WHY A COMMENT NEEDS A TEST AT ALL.
 *
 * Every other claim this piece makes is pinned by something that reddens. This
 * one was pinned by nothing, in the files most likely to be read first, and it
 * went false in the most damaging possible way: after GDD §7.2 ruled that the
 * cut-in composes its own frame and does NOT mount `renderPanels.ts`'s
 * `renderPanel`, four separate headers went on telling the next reader that the
 * thing on screen was the licensing panel — `CutInView.tsx`, `cutInGate.ts`,
 * `WalkoutView.tsx` and `CloseOutView.tsx`. All four are quoted verbatim in
 * `THE_DELETED_CLAIMS` below, which is a string array and therefore CODE: this
 * header does not have to write the sentence it bans, and the scan does not
 * have to make an exception for the file that defines it. A stale comment is
 * not cosmetic here — it is an instruction to rebuild the thing that was just
 * graded as broken, and `cutInArt.test.ts` only guards `cutInArt.ts`'s CODE.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS BANNED, AND WHAT IS DELIBERATELY NOT
 * ---------------------------------------------------------------------------
 * NOT the word `renderPanel`. The sentence worth keeping most in this whole
 * module is the historical one — "this used to mount `renderPanel` and that was
 * a §7.3 failure" — and a scan that killed it would trade one kind of ignorance
 * for another. `cutInArt.ts`'s header, `cutInTuning.ts`'s and GDD §7.2 all
 * explain the change by naming the thing that changed.
 *
 * What is banned is the ORDERED CLAIM: a noun for what a cut-in puts on screen,
 * then the object `THE_PANEL` names, inside one sentence, with nothing
 * disowning it in between. `THE_DELETED_CLAIMS` holds four real examples and
 * `THE_HISTORY_WORTH_KEEPING` holds six sentences that are near it and must
 * survive: a past-tense mounting note, a statement of what `renderPanel` itself
 * is, and a contrast that says this surface borrows nothing from it. Every one
 * of the second set is really in the tree today.
 *
 * ---------------------------------------------------------------------------
 * IT BANS THE CLAIM, NOT FIVE SPELLINGS OF ONE NOUN — AND IT USED TO DO THE
 * SECOND
 * ---------------------------------------------------------------------------
 * The previous version of this scan required a PRESENT-TENSE VERB off a list of
 * eleven, and required the object to be spelled `renderPanel(s)`, or `panel`
 * immediately behind one of four qualifiers. Three one-edit rewrites of the
 * sentences in `THE_DELETED_CLAIMS` walked past it with their meaning fully
 * intact. All three are pinned as strings — which is CODE, so this header does
 * not have to write out the thing it bans — in
 * `THE_ESCAPES_THAT_USED_TO_WORK` below. What each edit was:
 *
 *   - DELETE TWO WORDS: the qualifier in front of the noun. Bare `panel` was
 *     not in the vocabulary at all, so a claim that named it went green.
 *   - SPLIT ON A FULL STOP, leaving a pronoun as the second sentence's subject.
 *     `it` was not a subject, and a sentence-local gap cannot reach back over
 *     the stop for the noun a pronoun stands in for.
 *   - USE ANOTHER VERB. `reuses`, `borrows`, `wraps`, `calls`, `delegates to`,
 *     `reads`, `takes` — none of the eleven, all the same claim.
 *
 * SO THE VERB LIST IS GONE. What is left is a SUBJECT and an OBJECT with a
 * bounded gap, plus a closed list of things that, appearing in that gap, mean
 * the sentence is DISOWNING the architecture rather than asserting it. Tense
 * still does most of the separating — a historical note is written in the past —
 * but it does it as `PAST_TENSE`, a disowner, rather than as an enumeration of
 * present-tense verbs that a synonym walks around.
 *
 * FOUR GUARDS MAKE THAT WORK, and each is a way the scan is weak:
 *
 *   - `PAST_TENSE` — `-ed`, plus the irregulars, minus the present passive: a
 *     claim in the passive voice is a live claim and only the ACTIVE past is
 *     history. See the present-passive row of `THE_HELD_OUT_PARAPHRASES`. It
 *     reads an ADJECTIVE ending in `-ed` as history, which costs it one held-out
 *     row, pinned there as a miss.
 *   - `DISOWNED` — negation, contrast, `own`, and the counterfactual moods. If
 *     one appears between the subject and the panel, the sentence is denying
 *     the architecture. `own` is load-bearing on real prose in the tree: "the
 *     cut-in composes its own grid ... the same §7.3 witness the panel goes
 *     through" is true and must stay green.
 *   - `PRONOUN_SUBJECT` — `it`/`this` count as a subject only with a `cut-in`,
 *     `overlay` or `interrupt` ANTECEDENT within `PRONOUN_REACH`, and nothing
 *     disowning in between. Without that requirement the pattern matches
 *     FIFTEEN true sentences across TEN files — counted, not estimated — two of
 *     them about the MEET JUDGING panel, which is a different noun with the same
 *     spelling and lives in a module this scan has to walk anyway.
 *   - `NOT_ITS_OWN_CLAUSE` — a panel noun followed by a copula is the subject
 *     of its own clause, not the object of the claim. Without it "a cut-in is a
 *     full-screen interrupt and a shelf panel is a thumbnail" — a real contrast
 *     in `cutInTuning.ts` — goes red.
 *
 * IT IS A FLOOR, NOT A PROOF, AND THE FLOOR IS MEASURED RATHER THAN ASSERTED.
 * `THE_HELD_OUT_PARAPHRASES` is twelve rewrites written AFTER this pattern was
 * settled and never tuned against; eight are caught and the four misses are
 * pinned as misses, with the reason, so nobody has to take the ban's word for
 * its own coverage. The biggest known hole is the REVERSED claim ("the shop
 * panel is what the interrupt shows"): an alternative for it was written and
 * MEASURED, and it reddened six true sentences in the tree — contrastive prose
 * and the judging panel again — so it is refused rather than shipped.
 */
const NAMED_SUBJECT = [
  'the picture',
  'the cut-?ins?',
  'a cut-?in',
  'the overlay',
  'the interrupt',
  'the beat',
  'the shot',
  'this file',
  'this piece',
  'this view',
  'this screen',
  'this module',
  'this surface',
  'what it shows',
  'what mounts',
  'what the overlay shows',
  'what is drawn',
  'what arrives',
  'what is on screen',
  'what fires',
].join('|');

/**
 * The licensing system's composition, however it is named.
 *
 * BARE `panel` IS IN, and it is the whole point of this round. `composition`,
 * `card` and `grid` are only in BEHIND A QUALIFIER: the result card and the
 * cut-in's own grid are legitimate surfaces this repository talks about
 * constantly, and banning those nouns outright would ban the true prose.
 */
const THE_PANEL = [
  'renderPanels?\\b',
  'LicensedPanelView\\b',
  '(?:licensing|shop|shelf|character-?select|character select|Tier 3|partner) (?:panel|composition|card|grid|frame)\\b',
  'panels?\\b',
].join('|');

/** Past tenses that no `-ed` rule can reach. Provenance verbs only. */
const IRREGULAR_PAST =
  'was|were|had|did|read|drew|took|came|went|made|held|sat|got|built|wrote|gave|ran|kept|left|put|sent|meant|brought|stood|chose|wore|began';

/** In the gap, any of these means the sentence is denying the architecture. */
const DISOWNED = [
  'not',
  'never',
  'no longer',
  'nothing',
  'no',
  'cannot',
  'used to',
  'rather than',
  'instead of',
  'without',
  'unlike',
  'as opposed to',
  'own',
  'would',
  'could',
  'should',
  'might',
  'if',
  'whether',
  IRREGULAR_PAST,
].join('|');

/** How far apart the two parts may sit and still be one claim, in characters. */
const CLAIM_GAP = 60;
/** How far back a pronoun may reach for the noun it stands in for. */
const PRONOUN_REACH = 160;
/**
 * A past tense — EXCEPT after a copula, where an `-ed` word is a present
 * PASSIVE. A claim in the passive voice is still a claim; only the active past
 * is history. The present-passive row of `THE_HELD_OUT_PARAPHRASES` is the case.
 */
const PAST_TENSE = '(?<!\\b(?:is|are|be|been|being|get|gets|got)\\s)\\b\\w+ed\\b';
const NOTHING_DISOWNING = `(?!\\b(?:${DISOWNED})\\b)(?!${PAST_TENSE})`;
const WITHIN_A_SENTENCE = `(?:(?!\\.\\s+[A-Z\`§])${NOTHING_DISOWNING}[\\s\\S]){0,${CLAIM_GAP}}?`;
/** The pronoun's reach DOES cross a full stop. That is what it is for. */
const ACROSS_A_FULL_STOP = `(?:${NOTHING_DISOWNING}[\\s\\S]){0,${PRONOUN_REACH}}?`;
const PRONOUN_SUBJECT = `(?:cut-?in|overlay|interrupt)\\b${ACROSS_A_FULL_STOP}\\b(?:it|this|these|they)`;
const NOT_ITS_OWN_CLAUSE = '(?!\\s+(?:is|are|was|were)\\b)';
const MOUNTS_THE_PANEL = new RegExp(
  `\\b(?:${NAMED_SUBJECT}|${PRONOUN_SUBJECT})\\b${WITHIN_A_SENTENCE}\\b(?:${THE_PANEL})${NOT_ITS_OWN_CLAUSE}`,
  'gi',
);

/** Every claim of that shape in one file's comments. */
function panelClaimsIn(relPath: string): readonly string[] {
  return [...prose(relPath).matchAll(MOUNTS_THE_PANEL)].map((match) => match[0]);
}

describe('no comment says the cut-in mounts the shop panel — GDD §7.2', () => {
  /**
   * THE FOUR SENTENCES THAT WERE REALLY IN THE TREE, verbatim off the commit
   * that carried them. A planted fixture would only prove the regex matches
   * something the same author wrote to be matched; these are the actual prose,
   * including the one in `CutInView.tsx` that survived the §7.3 fix by two
   * rounds and was still instructing the next builder to mount the panel.
   */
  const THE_DELETED_CLAIMS: readonly string[] = [
    'Nothing here is drawn for the cut-in: the picture is the Tier 3 panel `src/licensing/renderPanels.ts` already produces, read through §7.3’s surface witness.',
    'What the overlay shows is the placeholder Tier 3 panel `src/licensing/` already renders, read through §7.3’s surface witness (see `cutInArt.ts`).',
    'There is still no cut-in ART. §7.2 says to "cut art entirely from the early prototypes"; what mounts is the placeholder Tier 3 panel the licensing system already renders.',
    'There is still no cut-in ART (§7.2, GDD §11): what mounts is the placeholder Tier 3 panel the licensing system already renders.',
  ];

  /**
   * SENTENCES THAT MUST STAY GREEN, and every one is really in the tree today —
   * see the non-vacuity check below, which fails if the module stops explaining
   * itself. A scan that killed these would delete the record of WHY the
   * architecture changed, which is the more useful half of the prose.
   */
  const THE_HISTORY_WORTH_KEEPING: readonly string[] = [
    '`renderPanel` is the CHARACTER-SELECT / SHOP composition, one layer above the identity read.',
    'It used to mount `renderPanel`, which is the character-select / shop composition.',
    'the cut-in composes its own shape rather than borrowing the shop panel',
    'a cut-in is a full-screen interrupt and a shelf panel is a thumbnail',
    'GDD §7.2’s promise that the art pass is "a row in the identity table and not a rewiring" was false for as long as the cut-in read the panel.',
    'While the cut-in mounted the panel, GDD §7.2’s "the art pass is a row in the identity table and not a rewiring" was false as written.',
  ];

  /**
   * ONE-EDIT REWRITES OF THE SENTENCES ABOVE THAT THE PREVIOUS SCAN LET THROUGH.
   *
   * Each is one of the four sentences above, edited once, with its meaning left
   * fully intact — still the architecture §7.2 ruled against — and each was
   * GREEN before this round. They are the reason the verb list is gone and bare
   * `panel` is in.
   */
  const THE_ESCAPES_THAT_USED_TO_WORK: readonly (readonly [string, string])[] = [
    [
      'two words deleted from [3]',
      'There is still no cut-in ART (§7.2, GDD §11): what mounts is the placeholder panel the licensing system already renders.',
    ],
    [
      'two words deleted from [1]',
      'What the overlay shows is the placeholder panel `src/licensing/` already renders, read through §7.3’s surface witness.',
    ],
    [
      'two words deleted from [2]',
      'There is still no cut-in ART. §7.2 says to "cut art entirely from the early prototypes"; what mounts is the placeholder panel the licensing system already renders.',
    ],
    [
      'split across a full stop, so the subject is a pronoun',
      'There is still no cut-in ART. It mounts the placeholder Tier 3 panel the licensing system already renders.',
    ],
    [
      'split across a full stop, with a bare panel',
      'There is still no cut-in ART. It mounts the placeholder panel the licensing system already renders.',
    ],
    ['a verb outside the eleven — reuses', 'There is still no cut-in ART: the cut-in reuses the Tier 3 panel.'],
    ['a verb outside the eleven — borrows', 'The overlay borrows the licensing panel.'],
    ['a verb outside the eleven — wraps', 'This view wraps the shop panel.'],
    ['a verb outside the eleven — delegates to', 'The cut-in delegates to renderPanel for its picture.'],
    ['a verb outside the eleven — calls', 'The interrupt calls renderPanel.'],
    [
      'a verb outside the eleven — takes',
      'The cut-in is unchanged. It takes the character-select panel and scales it up.',
    ],
  ];

  /**
   * TWELVE PARAPHRASES WRITTEN AFTER THE PATTERN WAS SETTLED, AND NEVER TUNED
   * AGAINST. Eight are caught. The four that are not are pinned as MISSES.
   *
   * WHY THIS TABLE EXISTS. `THE_DELETED_CLAIMS` is simultaneously the corpus the
   * pattern was fitted to and, until this round, the only evidence it worked —
   * which is the self-agreement `SITTING_BINDINGS` refuses next door. A pattern
   * scoring itself on its own training set says nothing about the next sentence
   * somebody writes. These twelve were written, then run ONCE, and the verdicts
   * recorded as they came out. `false` is not a to-do: it is the measured bound
   * on this ban, and a future round that widens the pattern to catch one has to
   * come here and say so.
   */
  const THE_HELD_OUT_PARAPHRASES: readonly (readonly [boolean, string, string])[] = [
    [true, 'a named subject and a bare panel', 'What the interrupt puts on screen is the shop panel, scaled up.'],
    [true, 'leans on', 'The cut-in still leans on `renderPanel` for its picture.'],
    [true, 'comes out of, and a qualified composition', "The overlay's picture comes straight out of the licensing shelf composition."],
    [true, 'hands the frame to', 'This view hands the whole frame to the character-select panel.'],
    [true, 'the same panel as another screen', 'Today the interrupt shows the same panel the shop screen does.'],
    [true, 'a PRESENT PASSIVE, which is not history', 'The picture on the cut-in is produced by `renderPanels.ts`.'],
    [
      false,
      'REVERSED: the panel first, the subject second. An alternative for this was written and measured; it reddened six true sentences in the tree, so it is refused.',
      'The shop panel is what the interrupt puts on screen.',
    ],
    [true, 'no verb at all — a colon', "The cut-in's picture: the licensing panel, at 3x."],
    [true, 'a third subject in the same sentence', 'There is no cut-in art yet, so the beat borrows the shop panel.'],
    [
      false,
      'PLURAL AND ARTICLE-LESS: every subject in the vocabulary carries `the` or `a`, so a sentence opening on a bare `Cut-ins` has no subject to match.',
      'Cut-ins mount the licensing panel until the art lands.',
    ],
    [
      false,
      'A PRONOUN WITH NO ANTECEDENT within PRONOUN_REACH. Deliberate: a bare `it` beside a bare `panel` reddens true prose all over the tree.',
      'It reuses the shop panel.',
    ],
    [
      false,
      'AN -ed ADJECTIVE read as a past tense. `scaled-up` trips PAST_TENSE and the gap closes.',
      'The interrupt is a scaled-up shelf panel.',
    ],
  ];

  it('THE SCAN SEES THE DELETED SENTENCES — the positive control', () => {
    // Without this the whole check below is theatre: a pattern that had stopped
    // matching would report every file clean and look exactly like a pass.
    for (const claim of THE_DELETED_CLAIMS) {
      expect(claim.match(MOUNTS_THE_PANEL), `the scan cannot see: ${claim}`).not.toBeNull();
    }
  });

  it('AND IT SEES THE ONE-EDIT REWRITES THAT USED TO WALK PAST IT', () => {
    // The headline defect of the previous round: the ban scanned for five
    // spellings of one noun and a list of eleven verbs, so deleting two words
    // from a real banned sentence — "the placeholder Tier 3 panel" to "the
    // placeholder panel" — put it back in a header, telling the next builder to
    // rebuild the architecture GDD §7.2 ruled against, with the suite green.
    for (const [how, claim] of THE_ESCAPES_THAT_USED_TO_WORK) {
      expect(claim.match(MOUNTS_THE_PANEL), `${how} still escapes: ${claim}`).not.toBeNull();
    }
  });

  it('AND HERE IS WHAT IT SCORED ON TWELVE SENTENCES IT WAS NOT FITTED TO', () => {
    // Held out, run once, verdicts recorded as they came. The FALSE rows are as
    // load-bearing as the true ones: they are what stops this file claiming a
    // coverage it has not got.
    for (const [caught, why, claim] of THE_HELD_OUT_PARAPHRASES) {
      expect(
        claim.match(MOUNTS_THE_PANEL) !== null,
        `${caught ? 'this used to be caught and now is not' : 'this used to be missed and now is not'}` +
          ` — ${why}: ${claim}`,
      ).toBe(caught);
    }
    // The summary number, pinned, so "8 of 12" cannot quietly become "4 of 12"
    // by a widening somewhere else in the pattern.
    const hits = THE_HELD_OUT_PARAPHRASES.filter(([caught]) => caught).length;
    expect(hits, 'the measured held-out score moved').toBe(8);
    expect(THE_HELD_OUT_PARAPHRASES.length, 'the held-out set changed size').toBe(12);
  });

  it('and it does NOT see the history that explains why they went — the negative control', () => {
    for (const kept of THE_HISTORY_WORTH_KEEPING) {
      expect(kept.match(MOUNTS_THE_PANEL), `the scan would delete: ${kept}`).toBeNull();
    }
  });

  it('THE VIEW’S HEADER NAMES EVERY TUNING CONSTANT THE VIEW READS', () => {
    // The claim this replaces was "every number it uses is `CUT_IN_LAYOUT`'s",
    // which was false in the same file that made it: the arrival animation reads
    // `CUT_IN_TUNING.ENTER_MS`. Same species as the panel claim — prose that
    // describes an architecture the code next to it does not have — and one line
    // of it is enough to send a reader looking in the wrong module.
    //
    // ONE DIRECTION ONLY: every `CUT_IN_TUNING.X` in the CODE must appear in the
    // PROSE. The reverse would be wrong, because the header correctly discusses
    // constants this file does not read — `DISMISS_ENABLED_AFTER_MS` is the
    // host's and the header says exactly that.
    const used = [...new Set([...VIEW.matchAll(/CUT_IN_TUNING\.([A-Z_]+)/g)].map((m) => m[1]))];
    expect(used.length, 'the view reads no tuning constant at all — check the scan').toBeGreaterThan(
      0,
    );
    const header = prose('cutin/CutInView.tsx');
    for (const name of used) {
      expect(header, `the header does not mention CUT_IN_TUNING.${name}, which the code reads`).toContain(
        name,
      );
    }
  });

  it('the reader really is reading comments, and only comments', () => {
    // `prose` is the complement of `code`, so a scan built on it can see what
    // every other scan in this file is blind to — and must be blind to what
    // they see, or the two would double-count.
    expect(prose('cutin/CutInView.tsx')).toMatch(/THE WHOLE SCREEN IS THE DISMISS TARGET/);
    expect(prose('cutin/CutInView.tsx')).not.toMatch(/onPress=\{onDismiss\}/);
    expect(code('cutin/CutInView.tsx')).toMatch(/onPress=\{onDismiss\}/);
    expect(code('cutin/CutInView.tsx')).not.toMatch(/THE WHOLE SCREEN IS THE DISMISS TARGET/);
  });

  it('NO FILE IN THE TREE SAYS THE CUT-IN’S PICTURE IS THE PANEL', () => {
    // THE WHOLE TREE, not `src/cutin/`. Two of the four stale sentences were in
    // screens — `WalkoutView.tsx` and `CloseOutView.tsx` — because a caller
    // describes what it triggers, and a scan rooted at the module would have
    // left both standing. Tests are included: `cutInArt.test.ts` carries more
    // of this piece's history than any module does.
    const files = everySourceFile('', true);
    expect(files.length, 'the walk found almost nothing').toBeGreaterThan(50);
    expect(files, 'the walk skipped the tests it is supposed to read').toContain(
      'cutin/cutInArt.test.ts',
    );
    for (const file of files) {
      expect(
        panelClaimsIn(file),
        `${file} still tells its reader the cut-in's picture is the licensing panel. ` +
          'GDD §7.2: "The cut-in composes its own frame; it does not mount the shop panel — ' +
          'RULED." Say what it does instead, or say what it USED TO do.',
      ).toEqual([]);
    }
  });

  it('AND IT IS CLEAN FOR A REASON, NOT BECAUSE THE PROSE WENT QUIET', () => {
    // The failure mode the check above cannot see by itself: a module that
    // deleted every mention of the panel would pass it and would also have
    // thrown away the explanation. So the history has to still be there, in the
    // two files that carry it, while the claim scan reads zero.
    for (const file of ['cutin/cutInArt.ts', 'cutin/cutInTuning.ts']) {
      const text = prose(file);
      expect(text, `${file} no longer explains what it does not mount`).toMatch(/renderPanel/);
      expect(text, `${file} no longer names the failure it fixed`).toMatch(/§7\.3/);
      expect(panelClaimsIn(file), file).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// THE EVIDENCE THE HEADER CITES IS REALLY IN THE REPOSITORY
// ---------------------------------------------------------------------------

describe('`CutInView.tsx` cites pictures that a fresh checkout really has', () => {
  /**
   * The loop this closes. `.gitignore` carries a negation for
   * `.gauntlet/shots/cutin/` whose comment gives `CutInView.tsx` as the reason —
   * "the sentence that was false until the pictures were committed" — and for
   * two rounds that header went on saying the pixels were NOT in the repo. One
   * side of the loop was closed and the other was left open, with nothing that
   * could notice.
   *
   * ASKED OF GIT, NOT OF THE DISK. This check used `existsSync`, which is TRUE
   * FOR A FILE GIT DOES NOT TRACK — so re-running `tools/capture-cutin.mjs`
   * locally recreated every path this test names, and `git rm --cached` on the
   * whole directory (or re-adding the `.gitignore` line the negation undoes)
   * would have left it green on the machine that captured them and false for
   * every other reader. The header's claim is about a FRESH CHECKOUT, and the
   * only instrument that can answer that question is the index.
   * `tools/evidence.mjs` learned the same lesson from the other side, where an
   * empty list of tracked shot records was a pass.
   */
  const SHOTS_DIR = '.gauntlet/shots/cutin';

  /** Repo-relative paths git actually tracks under `dir`. */
  function trackedUnder(dir: string): readonly string[] {
    const out = execFileSync('git', ['ls-files', '-z', '--', dir], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    return out.split('\0').filter((line) => line !== '');
  }

  it('THE PIXELS ARE TRACKED, not merely present on this disk', () => {
    const tracked = trackedUnder(SHOTS_DIR);
    // Non-vacuity for the instrument itself: `git ls-files` on a path that does
    // not exist returns nothing, and nothing has no problems in it.
    expect(
      trackedUnder('src/cutin').includes('src/cutin/CutInView.tsx'),
      'git ls-files answered nothing for a file that is certainly tracked — the instrument is broken, not the evidence',
    ).toBe(true);

    expect(
      tracked,
      `${SHOTS_DIR}/frames.json is not tracked — see .gitignore and CutInView.tsx`,
    ).toContain(`${SHOTS_DIR}/frames.json`);
    const pngs = tracked.filter((name) => name.endsWith('.png'));
    expect(pngs.length, `the header says ten committed PNGs, git tracks ${pngs.length}`).toBe(10);
    // And they are really on disk too, which is a different claim from being in
    // the index and is the half `existsSync` was right about.
    for (const rel of [...pngs, `${SHOTS_DIR}/frames.json`]) {
      expect(existsSync(path.join(REPO_ROOT, rel)), `${rel} is tracked but missing`).toBe(true);
    }
  });

  it('and the header names it, and the instrument that writes it', () => {
    // The other direction: pictures with nothing pointing at them are evidence
    // nobody finds. Both halves have to hold for the sentence to be true.
    const header = prose('cutin/CutInView.tsx');
    expect(header).toMatch(/\.gauntlet\/shots\/cutin\//);
    expect(header).toMatch(/tools\/capture-cutin\.mjs/);
    // The INSTRUMENT is held to the same standard as the pictures: a capture
    // script nobody else has is not a way for a reader to re-take the shots.
    expect(trackedUnder('tools/capture-cutin.mjs')).toEqual(['tools/capture-cutin.mjs']);
    // And it must not have drifted back to denying they are here.
    expect(header, 'the header denies pixels that are committed').not.toMatch(
      /THE PIXELS ARE NOT IN THE REPO/,
    );
  });
});

// ---------------------------------------------------------------------------
// SKIPPABILITY, at the view layer — GDD §7.2
// ---------------------------------------------------------------------------

describe('the cut-in is dismissed by tapping it — GDD §7.2', () => {
  it('THE PRESS HANDLER IS THE DISMISS HANDLER', () => {
    // The mutation this exists to catch is `onPress={() => {}}`, which type-
    // checks, renders identically, and makes the cut-in un-skippable.
    expect(VIEW).toMatch(/onPress=\{onDismiss\}/);
    // ...and there is no second, conditional press handler that could shadow it.
    expect(VIEW).not.toMatch(/onPress=\{\(\)\s*=>\s*\{\s*\}\}/);
    expect(VIEW).not.toMatch(/onPress=\{[^}]*\?[^}]*:[^}]*\}/);
  });

  it('THE WHOLE SCREEN IS THE TARGET, not a button in a corner', () => {
    expect(VIEW).toMatch(/<Pressable/);
    expect(VIEW).toMatch(/StyleSheet\.absoluteFill/);
  });

  it('says it is skippable, because a player has to know', () => {
    expect(VIEW).toMatch(/SKIP_HINT/);
    expect(VIEW).toMatch(/cut-in-skip-hint/);
  });

  it('the host really calls the gate’s dismiss, not just setLive(null)', () => {
    // `setLive(null)` alone would take the picture off screen and leave the
    // gate session holding a live cut-in for ever, which is a different bug
    // wearing the same appearance.
    expect(HOST).toMatch(/dismissCutIn\(session\.current\)/);
    expect(HOST).toMatch(/cutInAutoDismissMs\(\)/);
  });

  it('THE TAP GOES THROUGH THE WINDOW AND THE TIMER DOES NOT', () => {
    // The defect this catches, which shipped for two rounds:
    // `CUT_IN_TUNING.DISMISS_ENABLED_AFTER_MS` was registered, documented,
    // pinned by a unit test, and named in `cutInTuning.ts` as "the line to
    // move" — while the only reader of it was `canDismissAt`, which nothing
    // outside `cutInGate.test.ts` called. `onPress` went straight to an ungated
    // `dismiss`. Setting the constant to 300 turned two unit tests red and left
    // the app's behaviour untouched. Same shape as the `SCRIM_OPACITY` defect
    // one round earlier: a tunable that reached no pixel.
    //
    // The view still hands its press straight to `onDismiss` (above); what
    // changed is which callback the host puts there.
    expect(HOST).toMatch(/tapDismissCutIn\(session\.current, Date\.now\(\) - shownAt\.current\)/);
    expect(HOST).toMatch(/onDismiss=\{dismissByTap\}/);
    // ...and the AUTO-dismiss keeps the ungated route. A timer routed through
    // the tap window would strand a cut-in on screen for ever the day somebody
    // set a window longer than `HOLD_MS`.
    expect(HOST).toMatch(/setTimeout\(dismiss, cutInAutoDismissMs\(\)\)/);
    expect(HOST).not.toMatch(/setTimeout\(dismissByTap/);
    // The clock is the host's, not the gate's: `cutInGate.ts` is pure.
    expect(HOST).toMatch(/shownAt\.current = Date\.now\(\)/);
    expect(code('cutin/cutInGate.ts'), 'the gate started reading a clock').not.toMatch(
      /Date\.now\(\)/,
    );
  });

  it('THE SCRIM IS ITS OWN LAYER, so its opacity is not overridden by the arrival', () => {
    // The defect this catches, which shipped: `styles.root` carried both the
    // backdrop AND `opacity: L.SCRIM_OPACITY`, and the arrival animation's
    // `{ opacity: arrived.value }` was applied after it on the same node — so
    // once the enter timing completed the overlay sat at opacity 1 and the
    // registered, documented tunable reached no pixel at all.
    //
    // The pixel proof is `tools/capture-cutin.mjs`, which measures blended
    // pixels behind the overlay on real frames. This is the cheap statement of
    // the same thing: the two must not be on one node.
    expect(VIEW).toMatch(/SCRIM_OPACITY/);
    expect(VIEW).toMatch(/scrim: \{/);
    expect(VIEW).toMatch(/StyleSheet\.absoluteFill, styles\.scrim/);
    const root = /root: \{[^}]*\}/.exec(VIEW)?.[0] ?? '';
    expect(root.length).toBeGreaterThan(0);
    expect(root, 'the arrival node still carries a static opacity').not.toMatch(/opacity/);
    expect(root, 'the arrival node still carries the backdrop').not.toMatch(/backgroundColor/);
  });
});

// ---------------------------------------------------------------------------
// THE CAP LIVES IN THE GATE, AND NO SCREEN CAN GET ROUND IT
// ---------------------------------------------------------------------------

describe('only the host talks to the gate — GDD §7.2, §12.3', () => {
  it('THE SET OF FILES THAT TALK TO THE GATE IS THIS SET — derived, not restated', () => {
    // WHY THIS EXISTS. `CALLERS` is a hand-written list of five paths and every
    // other scan in this file reads only those five. Nothing asserted that the
    // list was COMPLETE, so:
    //
    //   - a sixth screen offering two beat kinds at once would leave "THE
    //     PRIORITY ORDER DECIDES NOTHING TODAY" green while GDD §7.2's ruled
    //     claim went false, and
    //   - a sixth screen calling `openCutInSession` directly would mint itself a
    //     second slot inside one sitting with no test red at all — which is
    //     §12.3's refusal condition, reached by a route no scan was looking at.
    //
    // DERIVED FROM THE TYPE CHECKER, not from the spelling. The first version of
    // this check walked `src/` for the six names as TEXT, and its residual said
    // an aliased import still spells the original name somewhere. That is true
    // of a direct import and false of a re-export placed INSIDE `src/cutin/`,
    // which is the one directory the walk skips: one line there turns
    // `useOfferCutIn` into `offerBeat`, and a screen importing `offerBeat`
    // matched nothing. See `THE_GATE_ITSELF` for the reproduction.
    const claimants = filesTalkingToTheGate();
    const scanned = gateScan().scanned;
    expect(scanned.length, 'the program compiled almost nothing').toBeGreaterThan(50);
    expect(scanned, 'the root set does not reach outside src/').toContain('App.tsx');
    expect(claimants.length, 'nothing in the tree talks to the gate at all').toBeGreaterThan(0);
    expect(claimants).toEqual([...CALLERS.map(([, file]) => `src/${file}`)].sort());

    // THE TEXT SCAN IS KEPT AS A CROSS-CHECK, one way round. Every file that
    // NAMES an entry point must be in the derived set; the derived set may be
    // larger, and the whole point of this round is that it can be.
    for (const rel of filesNaming(GATE_ENTRY_POINTS)) {
      expect(claimants, `${rel} names the gate and the symbol scan missed it`).toContain(
        `src/${rel}`,
      );
    }
  });

  it('AND THE SET OF SCREENS THAT CLAIM A SITTING IS THE TWO LOOPS', () => {
    // The other half of the same hole. The cap is per SITTING (§7.2), and a
    // sitting is whatever a caller names with `cutInSessionId` and mounts a
    // `CutInHost` over. A third screen doing that inside an existing sitting
    // would hand it a second cut-in without ever touching `CALLERS` — so the
    // set of files that can open one is derived too, not listed in a loop.
    //
    // DERIVED FROM THE TYPE CHECKER, not from a JSX spelling. See
    // `SITTING_BINDINGS`: the old text scan for `<CutInHost` was blind to an
    // aliased import, which is §12.3's refusal condition reached by a rename.
    //
    // The paths are REPOSITORY-relative here — `src/meet/MeetScreen.tsx`, not
    // `meet/MeetScreen.tsx` — because the enumeration is over the project's own
    // file list and that list reaches outside `src/`.
    const claimants = filesClaimingASitting();
    // Non-vacuity, three ways: the program really compiled the project, it
    // really reached a file outside `src/`, and the pattern really matches
    // something. Without the last, `[] === []` would pass for ever.
    const scanned = sittingScan().scanned;
    expect(scanned.length, 'the program compiled almost nothing').toBeGreaterThan(50);
    expect(scanned, 'the root set does not reach outside src/').toContain('App.tsx');
    expect(claimants.length, 'nothing in the tree claims a sitting at all').toBeGreaterThan(0);
    expect(claimants).toEqual([...HOST_SCREENS.map((file) => `src/${file}`)].sort());
  });

  it('the host is the only file that opens a session or requests a cut-in', () => {
    expect(HOST).toMatch(/resumeCutInSession/);
    expect(HOST).toMatch(/requestCutIn/);
    for (const [moment, file] of CALLERS) {
      const text = code(file);
      // A screen that could call these could give itself a second slot, and
      // §12.3's refusal condition would then be a convention rather than a rule.
      expect(text, `${moment} (${file})`).not.toMatch(/\bopenCutInSession\b/);
      expect(text, `${moment} (${file})`).not.toMatch(/\brequestCutIn\b/);
      expect(text, `${moment} (${file})`).not.toMatch(/\bCUT_IN_TUNING\b/);
      expect(text, `${moment} (${file})`).not.toMatch(/\bCutInView\b/);
      // ...nor reach the ledger, which is where the count lives now. A screen
      // that could forget a sitting could refund its slot.
      expect(text, `${moment} (${file})`).not.toMatch(/\bresumeCutInSession\b/);
      expect(text, `${moment} (${file})`).not.toMatch(/\brememberCutInSession\b/);
      expect(text, `${moment} (${file})`).not.toMatch(/\bforgetAllCutInSessions\b/);
    }
  });

  it('ONE GATE SESSION PER SITTING, GUARDED ON ITS ID', () => {
    // The one hole `cutInGate.ts` §5 names: a caller that re-opens mid-sitting
    // hands itself a second slot — or, as this file actually did before a
    // browser caught it, throws away a cut-in that had just been granted,
    // because React runs child effects before parent ones.
    //
    // The GUARD is what closes both, not the dependency list, so the guard is
    // what this reads.
    expect(HOST).toMatch(/if \(session\.current\.sessionId === activeSessionId\) return;/);
    expect(HOST).toMatch(/resumeCutInSession\(\{ sessionId: activeSessionId, seed: activeSeed \}\)/);
    // ...and the count is never touched anywhere else.
    expect(HOST).not.toMatch(/firedCount/);
  });

  it('THE COUNT OUTLIVES THE COMPONENT — the cap is per sitting, not per mount', () => {
    // A `useRef` is about a MOUNT and §12.3's refusal condition is about a
    // SESSION. `AppShell.tsx` swaps the two screens with a ternary and both
    // screens early-return above their own `<CutInHost>`, so the component
    // really does go away inside a sitting.
    //
    // THE BEHAVIOUR IS TESTED FOR REAL IN `cutInLedger.test.ts` — this only
    // checks that the host is the thing wired to it, which is the half a node
    // environment cannot execute.
    expect(HOST).toMatch(/from '\.\/cutInLedger'/);
    expect(HOST).toMatch(/rememberCutInSession\(decision\.state\)/);
    expect(HOST).toMatch(/rememberCutInSession\(session\.current\)/);
    // The ledger is not cleared by anything that renders. A component that
    // could forget a sitting could hand it a second slot.
    expect(HOST).not.toMatch(/forgetAllCutInSessions/);
    expect(VIEW).not.toMatch(/cutInLedger/);
  });

  it('THE DEBUG ROUTE IS NOT REACHABLE IN PLAY', () => {
    // `?cutin=<moment>` stages one cut-in for the capture harness. It is a
    // query string and nothing else: no control navigates to it, and the parser
    // returns null for anything it does not recognise (`cutInPreview.test.ts`).
    expect(HOST).toMatch(/cutInPreviewFrom/);
    expect(HOST).toMatch(/window\.location\.search/);
    // The preview's beats go through the same `offer`, so the cap, the rate and
    // the qualification all still apply. A preview that called `setLive`
    // directly would be photographing a component the app cannot reach.
    expect(HOST).toMatch(/offer\(preview\.beats\)/);
    expect(HOST).not.toMatch(/setLive\(preview/);
    // No screen may reach the route either.
    for (const [moment, file] of CALLERS) {
      expect(code(file), `${moment} (${file})`).not.toMatch(/cutInPreview/);
    }
  });

  it('both loops mount exactly one host, above the whole loop', () => {
    for (const file of ['session/SessionScreen.tsx', 'meet/MeetScreen.tsx']) {
      const text = code(file);
      expect(text, file).toMatch(/<CutInHost/);
      expect(text, file).toMatch(/<\/CutInHost>/);
      expect(text.match(/<CutInHost/g)?.length, `${file} mounts one host`).toBe(1);
      expect(text, file).toMatch(/cutInSessionId\(/);
      expect(text, file).toMatch(/cutInSessionSeed\(/);
    }
  });

  it('A MEET IS ONE SESSION, AND A TRAINING DAY IS ANOTHER', () => {
    // GDD §7.2 as read in `cutInGate.ts` §3, at the two call sites. The meet's
    // host is above the phase router, so all nine attempts, the recap and the
    // bomb-out share one slot.
    expect(code('meet/MeetScreen.tsx')).toMatch(/cutInSessionId\('meet'/);
    expect(code('session/SessionScreen.tsx')).toMatch(/cutInSessionId\('training'/);
  });
});

// ---------------------------------------------------------------------------
// ALL FOUR MOMENTS HAVE A CALLER
// ---------------------------------------------------------------------------

describe('every firing moment of GDD §7.2 is wired to a screen', () => {
  it('EACH OF THE FOUR IS OFFERED BY THE SCREEN THAT KNOWS ABOUT IT', () => {
    expect(CALLERS.length).toBe(5); // four moments; PRs have two screens
    for (const [moment, file, beat] of CALLERS) {
      const text = code(file);
      expect(text, `${moment} (${file}) offers nothing`).toMatch(/useOfferCutIn\(/);
      expect(text, `${moment} (${file}) reports the wrong beat`).toContain(beat);
    }
  });

  it('covers all four of the gate’s beat kinds between them', () => {
    // The union of what the app can report. A beat kind the gate understands
    // but no screen sends is a firing moment that exists only in the tests.
    const offered = new Set(
      CALLERS.flatMap(([, file]) => [...code(file).matchAll(/kind: '([a-z-]+)'/g)].map((m) => m[1])),
    );
    for (const kind of ['meet-walkout', 'record', 'meet-over', 'work-set']) {
      expect(offered.has(kind), `nothing reports a ${kind} beat`).toBe(true);
    }
  });

  it('no screen qualifies the beat itself — it reports facts', () => {
    // The walk-out reports which attempt it is; it does not check for a third
    // and offer nothing otherwise. If it did, "the gate does not fire on a
    // non-qualifying beat" would be a property of five screens instead of one
    // module, and `cutInGate.test.ts` could not see any of them.
    expect(code('meet/WalkoutView.tsx')).toMatch(/attemptNumber: attempt\.attemptNumber/);
    expect(code('session/CloseOutView.tsx')).toMatch(/achieved: isPr/);
    expect(code('meet/RecapView.tsx')).toMatch(/achieved: recap\.isTotalPr/);
    expect(code('session/RestView.tsx')).toMatch(/loadRatio,/);
  });

  it('THE WALK-OUT REPORTS WHETHER ITS LIFT CAN STILL BOMB', () => {
    // The fact that stops a third attempt with nothing banked spending the slot
    // §7.2's "somber counterpart" is about to need. It is REPORTED, not acted
    // on: the screen must not check it and withhold the beat, or the rule would
    // move out of the gate and `cutInGate.test.ts` could not see it.
    const walkout = code('meet/WalkoutView.tsx');
    expect(walkout).toMatch(/bombRisk: attempt\.bombRisk/);
    // The shapes that would move the decision into the screen.
    expect(walkout).not.toMatch(/attempt\.bombRisk \?\s*\[\]/);
    expect(walkout).not.toMatch(/useOfferCutIn\(attempt\.bombRisk/);
  });
});

// ---------------------------------------------------------------------------
// THE PRIORITY ORDER, AND THE READING THAT SAYS IT DECIDES NOTHING
// ---------------------------------------------------------------------------

describe('CUT_IN_MOMENT_PRIORITY is a declared invariant, not a live tie-break', () => {
  /**
   * The text of EVERY `useOfferCutIn(...)` call in a file, parentheses balanced.
   *
   * Read off the real source rather than restated, because the claim being
   * checked is about what the CALL SITES can produce and a restatement would
   * agree with itself for ever.
   *
   * ALL OF THEM, not the first. This used to stop at `indexOf`, so a screen that
   * grew a second `useOfferCutIn` offering two kinds at once kept the assertion
   * below green on the strength of its first call — the same class of blind spot
   * as the five-file `CALLERS` list, one scope in.
   */
  function offerCalls(text: string, names: readonly string[] = ['useOfferCutIn']): readonly string[] {
    const calls: { readonly at: number; readonly text: string }[] = [];
    for (const name of names) {
      const marker = `${name}(`;
      let from = 0;
      for (;;) {
        const start = text.indexOf(marker, from);
        if (start === -1) break;
        let depth = 0;
        let end = -1;
        for (let i = start + marker.length - 1; i < text.length; i += 1) {
          if (text[i] === '(') depth += 1;
          else if (text[i] === ')') {
            depth -= 1;
            if (depth === 0) {
              end = i;
              break;
            }
          }
        }
        if (end === -1) break;
        calls.push({ at: start, text: text.slice(start, end + 1) });
        from = end + 1;
      }
    }
    return calls.sort((a, b) => a.at - b.at).map((call) => call.text);
  }

  /**
   * TEXT IN, CALLS OUT — deliberately, so the positive control below can feed
   * the SAME function a two-call string. A reader that only ever took a path
   * could not be shown to find a second call without planting a second call in
   * the tree.
   *
   * THE NAMES COME FROM THE TYPE CHECKER, not from the string `useOfferCutIn`.
   * A screen importing the hook under another name — which a re-export inside
   * `src/cutin/` can arrange in one line — spells nothing this reader would find
   * on the old marker, so its two-kind call would have read as NO call at all.
   */
  function offerCallsIn(repoRel: string): readonly string[] {
    const names = offerScan().localNames.get(repoRel) ?? ['useOfferCutIn'];
    return offerCalls(code(repoRel.replace(/^src\//, '')), names);
  }

  function beatKindsPerCall(repoRel: string): readonly (readonly string[])[] {
    return offerCallsIn(repoRel).map((call) => [
      ...new Set([...call.matchAll(/kind: '([a-z-]+)'/g)].map((m) => m[1] ?? '')),
    ]);
  }

  it('the reader can see a two-kind call when there is one, and sees every call', () => {
    // Positive control. A scan that had stopped matching would report every
    // file as single-kind and the assertion below would pass on anything.
    const twoKinds = "useOfferCutIn([{ kind: 'record' }, { kind: 'meet-over' }]);";
    expect([...new Set([...twoKinds.matchAll(/kind: '([a-z-]+)'/g)].map((m) => m[1]))]).toEqual([
      'record',
      'meet-over',
    ]);
    // ...it really is reading the call, not the whole file...
    expect(offerCallsIn('src/meet/RecapView.tsx')[0]).toMatch(/^useOfferCutIn\(/);
    expect(offerCallsIn('src/meet/RecapView.tsx')[0]).not.toMatch(/ScrollView/);
    expect(offerCallsIn('src/meet/RecapView.tsx').length).toBe(1);
    // ...it finds a call made under a LAUNDERED NAME, which is the shape a
    // re-export inside `src/cutin/` can hand a sixth screen in one line...
    const laundered = "offerBeat([{ kind: 'record' }, { kind: 'meet-over' }]);";
    expect(offerCalls(laundered), 'the reader is still hard-coded to one spelling').toEqual([]);
    expect(offerCalls(laundered, ['offerBeat']).length).toBe(1);
    // ...and it does not stop at the first one, which is what it used to do.
    // The same balancing reader, given a text with two calls — the second of
    // which is the two-kind shape the assertion below is hunting for.
    const twice =
      "useOfferCutIn([{ kind: 'record', achieved: f(1) }]);\nconst x = 1;\n" +
      "useOfferCutIn([{ kind: 'meet-over' }, { kind: 'work-set' }]);";
    const calls = offerCalls(twice);
    expect(calls.length, 'the reader still stops at the first call').toBe(2);
    expect([...new Set([...(calls[1] ?? '').matchAll(/kind: '([a-z-]+)'/g)].map((m) => m[1]))]).toEqual(
      ['meet-over', 'work-set'],
    );
  });

  it('THE PRIORITY ORDER DECIDES NOTHING TODAY, AND HERE IS THE READING THAT SAYS SO', () => {
    // Each of the four beat KINDS maps to exactly one moment (`momentFor` is a
    // switch on `kind`), so the number of distinct moments one request can
    // produce is the number of distinct kinds at that call site. Every site
    // offers one kind, so `momentsFor` returns at most one moment on every
    // request the app can make and `CUT_IN_MOMENT_PRIORITY` never breaks a tie.
    //
    // THIS IS THE TEST THAT GOES RED THE DAY THAT STOPS BEING TRUE. When it
    // does, the ranking starts deciding real beats and somebody should look at
    // it on purpose rather than discover it — which is the whole reason the
    // constant is kept rather than deleted.
    //
    // EVERY CALL IN EVERY FILE THAT TALKS TO THE GATE — and the file set is the
    // SYMBOL-derived one, not `CALLERS` and not a text scan, so a sixth screen
    // is inside this loop the day it is written rather than the day somebody
    // remembers to add it, and a sixth screen that imported the hook under
    // another name is inside it too.
    const offering = filesTalkingToTheGate();
    expect(offering.length, 'no file offers a beat at all').toBeGreaterThan(0);
    for (const file of offering) {
      const perCall = beatKindsPerCall(file);
      expect(perCall.length, `${file} offers no beat`).toBeGreaterThan(0);
      perCall.forEach((kinds, i) => {
        expect(kinds.length, `${file} call ${i + 1} offers no beat`).toBeGreaterThan(0);
        expect(
          kinds.length,
          `${file} call ${i + 1} now offers ${kinds.join(' + ')} at once — the priority ` +
            'order has started deciding something. See CUT_IN_MOMENT_PRIORITY.',
        ).toBe(1);
      });
    }
  });

  it('and the ranking is still declared, so the invariant has an implementation', () => {
    // GDD §7.2 states the order in prose. Deleting the constant would leave the
    // document with no implementation and make `momentsFor` return the caller's
    // order instead of a defined one.
    const GATE = source('cutin/cutInGate.ts');
    expect(GATE).toMatch(/CUT_IN_MOMENT_PRIORITY/);
    expect(GATE).toMatch(/CUT_IN_MOMENT_PRIORITY\.filter/);
  });
});

// ---------------------------------------------------------------------------
// The three deferrals are gone
// ---------------------------------------------------------------------------

describe('the three "the gate belongs to somebody else" comments are gone', () => {
  const DEFERRALS: readonly (readonly [string, RegExp])[] = [
    ['meet/WalkoutView.tsx', /NO CUT-IN\./],
    ['meet/RecapView.tsx', /NO CUT-IN FIRES HERE/],
    ['session/CloseOutView.tsx', /NO CUT-IN FIRES HERE/],
  ];

  it('the scan can see the sentence it is looking for', () => {
    expect('NO CUT-IN FIRES HERE. GDD §7.2 lists PR moments').toMatch(/NO CUT-IN FIRES HERE/);
  });

  it('replaced by wiring, not by a different comment', () => {
    for (const [file, deferral] of DEFERRALS) {
      const raw = source(file);
      expect(raw, `${file} still defers`).not.toMatch(deferral);
      expect(raw, `${file} still says the gate is somebody else's`).not.toMatch(
        /gate belongs to/i,
      );
      expect(code(file), `${file} has no wiring`).toMatch(/useOfferCutIn\(/);
    }
  });
});

// ---------------------------------------------------------------------------
// A cut-in is cosmetic — GDD §8.1, §12.3
// ---------------------------------------------------------------------------

describe('nothing in the cut-in path can touch a number the player earns', () => {
  it('the view and the host read no progression, no total and no e1RM', () => {
    for (const [name, text] of [
      ['CutInView.tsx', VIEW],
      ['CutInHost.tsx', HOST],
    ] as const) {
      for (const banned of [
        'readTotalKg',
        'readBestE1rmKg',
        'proposeChange',
        'ProgressionCache',
        'applyMeetResult',
        'recordTrainingSession',
      ]) {
        expect(text, `${name} names ${banned}`).not.toMatch(new RegExp(`\\b${banned}\\b`));
      }
    }
  });

  it('the cut-in path never reaches the fatigue ledger either — GDD §3.4, §12.3', () => {
    for (const [name, text] of [
      ['CutInView.tsx', VIEW],
      ['CutInHost.tsx', HOST],
    ] as const) {
      expect(text, name).not.toMatch(/\bFatigueState\b/);
      expect(text, name).not.toMatch(/\.fatigue\b/);
    }
  });
});
