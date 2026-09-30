import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { budgetFrom } from '../../tools/testBudget.mjs';

import { testScopeFault } from '../tuning/audit';
import { createVitest } from 'vitest/node';

import { dotsScore, officialTotalKg, type BodyweightReading, type OfficialTotalKg } from './dots';
import { estimateE1rm } from './e1rm';
import { LIFT_ORDER, type LiftKind } from './meet';
import * as progressionModule from './progression';
import {
  CHOOSE_FEDERATION_REPORT_KEYS,
  SET_RECOVERY_DAY_PROTECTION_REPORT_KEYS,
  applyServerSnapshot,
  asMeetId,
  asProposalId,
  asServerRevision,
  cachedSnapshot,
  CONFIRMED_MEET_RESULT_KEYS,
  CONVENIENCE_GRANTS,
  COSMETIC_SLOTS,
  emptyProgressionCache,
  emptyProjection,
  ENTITLEMENT_EFFECT_KINDS,
  FACT_PROTECTION,
  FACT_PROTECTION_KINDS,
  factsMovedBy,
  inFlightProposal,
  isConfirmedReading,
  markCacheStale,
  MEET_ATTEMPT_REPORT_KEYS,
  MEET_CARD_REPORT_KEYS,
  MEET_RESULT_REPORT_KEYS,
  meetsQualifyingTotal,
  OPEN_FACTS,
  PERFORMANCE_FACT_VOCABULARY,
  PROGRESSION_CACHE_POLICY,
  PROGRESSION_FACT_KEYS,
  PROGRESSION_PROPOSAL_KINDS,
  PROJECTION_KEYS,
  projectedCount,
  projectedKg,
  PROPOSAL_ORIGIN_BY_KIND,
  PROPOSAL_ORIGIN_KINDS,
  proposeChange,
  PROTECTED_CONCERNS,
  PURCHASABLE_PROPOSAL_KINDS,
  PURCHASE_EVIDENCE_KEYS,
  readBalance,
  readBestE1rmKg,
  readingValue,
  readMeets,
  readStreakDays,
  readTotalKg,
  receiveProgressionSnapshot,
  REDEEM_ENTITLEMENT_REPORT_KEYS,
  rejectProposal,
  snapshotAcknowledges,
  snapshotFacts,
  snapshotRevision,
  SPEND_CURRENCY_REPORT_KEYS,
  TRAINING_CARD_REPORT_KEYS,
  TRAINING_SESSION_REPORT_KEYS,
  TRAINING_SET_REPORT_KEYS,
  WALLET_CURRENCIES,
  type ConfirmedFacts,
  type ConfirmedMeetResult,
  type ConfirmedKg,
  type ConfirmedTotalKg,
  type EntitlementEffect,
  type InFlightProposal,
  type MeetCardReport,
  type MeetResultReport,
  type ProgressionCache,
  type ProgressionProjection,
  type ProgressionProposal,
  type ProgressionProposalKind,
  type ProgressionResult,
  type ProgressionSnapshot,
  type ProgressionSnapshotWire,
  type ProjectedKg,
  type ProjectionKey,
  type ProposalId,
  type ProposalOfKind,
  type RedeemEntitlementReport,
  type TrainingSetReport,
  type UnclaimedProjection,
} from './progression';
import { createStreakState, recordTrainingDay, streakDayFromCivilDate, STREAK_FACT_KEYS } from './streak';

/**
 * The day these fixtures pretend the account was created on (GDD 4.2 signup
 * day; `streak.ts` 1b). Day 0, because every simulated session below is
 * recorded on day 0 or later and a signup day after a session is refused.
 */
const SIGNUP_DAY = 0;


const MODULE_SOURCE = readFileSync(fileURLToPath(new URL('./progression.ts', import.meta.url)), 'utf8');

/**
 * The module's source with block and line comments taken out.
 *
 * Every source scan in this file wants this and several were writing it inline;
 * one was not writing it at all and was counting comment mentions as code.
 */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

// ---------------------------------------------------------------------------
// §7.5 — THE ROUTE PIN
//
// The tests over §7 above are over the FACT SET, so they fail when a fact goes
// unlisted and are blind to a new CONSTRUCTION SITE. That blindness is what six
// rounds of this section have been closed by hand and reopened by a grep. This
// block closes it mechanically.
//
// WHY THE TYPE CHECKER AND NOT A REGULAR EXPRESSION. The `[SNAPSHOT_CONTENTS]:`
// count below is a text scan and it works because the thing it counts is a
// symbol key that can be spelled exactly one way. A `ServerRecord` cannot: the
// six sites that exist are written as a return annotation, a `const x:
// ServerRecord =`, and a branch of a conditional — and the forms that DON'T
// exist yet are worse, because a literal in a function with an INFERRED return
// type names the type nowhere at all. So the question is asked of the syntax
// tree, with types: "is this object literal a `ServerRecord`?", by contextual
// type or by structural assignability.
//
// COMMENTS CANNOT INFLATE OR MASK IT, which is the property the mint-count test
// spells out. Its failure mode was that a sentence naming the key counted as a
// write, and — the direction that matters — deleting a real write could have
// been hidden by adding prose. Here the two sides are made of DIFFERENT
// MATERIAL: the found set comes from a parsed program, in which comments do not
// exist as nodes at all, and the declared set is §7.5, which is nothing but
// comment. No amount of writing about a route can produce one, and no amount of
// writing about a route can stand in for one that has been deleted.
//
// AND THE ROOT SET IS THE PROJECT'S FILE LIST, NOT A DIRECTORY. This scan spent
// a round rooted at `src/`, which is the same defect one level out from the one
// §7 exists to prevent: honestly scoped, complete within its scope, and the
// repository's own entry points sit OUTSIDE it. `App.tsx` and `index.ts` are at
// the repo root, imports point INTO `src/` and never out, so neither was reached
// directly or transitively — and a fully annotated `const seeded: ServerRecord =
// { ...newServerRecord(SIGNUP_DAY), totalKg: 900 }` appended to `App.tsx` compiled clean,
// passed every test here, and added no row. `tsconfig.json` already knew better:
// `parsed.fileNames` was being computed two lines above the hand-walk and thrown
// away. The scan is now rooted in it, which is exactly the set `npm run
// typecheck` checks, so "it compiles into this app" and "this scan sees it" are
// the same statement rather than two overlapping ones.
//
// AND THE SECOND, CRUDER GUARD IS NO LONGER SCOPED EITHER. The literal sweep is
// blind to a record assembled without a literal, which is what the three-pattern
// text check exists for — and that check spent a round running over a computed
// CANDIDATE SET whose implementation missed `await import()` and bare
// `export * from`, this repository's own idioms. On a file that used either, the
// two checks composed to zero: nothing to type and nothing to grep. It now runs
// over every non-test file the project compiles, with the pre-existing
// occurrences excused by name and count. The reasoning that licensed the
// scoping — "it can only make the guard cover fewer files" — is exactly what
// left those two constructs unnamed; direction-of-harm is not a substitute for
// enumeration in a check whose job is enumeration.
// ---------------------------------------------------------------------------

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/*
 * The species of boundary value §7.5 enumerates construction sites of.
 *
 * `facts` IS THIS ROUND'S ADDITION AND IT IS THE DOOR EVERY CONFIRMED NUMBER
 * COMES THROUGH. `receiveProgressionSnapshot` assembles a `ConfirmedFacts`
 * holding `totalKg`, `bestE1rmKg` and `meets`, and froze it with a call spelled
 * `deepFreeze` — neither the type nor that spelling was a scan target, so the
 * mint was not a row, was not required to be sealed, and had no runtime
 * witness. Measured before it was fixed: replacing that call with a shallow
 * `Object.freeze` left every §7.5 assertion green and reddened exactly one test
 * in the whole suite, which no ledger named.
 */
type RouteKind = 'record' | 'wire' | 'facts' | 'receive';

/** One row of §7.5: a place a record, a wire, a facts set or a read comes from. */
interface RouteSite {
  readonly kind: RouteKind;
  /** Repo-relative, posix. */
  readonly file: string;
  /**
   * The chain of function frames around it, outermost first, `/`-joined.
   * `<module>` when there is none.
   *
   * A CHAIN RATHER THAN THE NEAREST NAMED FUNCTION, because the nearest named
   * function collapsed `useMeetDay`'s two `receive` sites — the boot seed and
   * the post-meet settle, structurally different things — into one row with a
   * count of 2, in which deleting one and adding another anywhere in a
   * 150-line hook was invisible. They are now `useMeetDay/useState` and
   * `useMeetDay/useEffect/setCache`.
   */
  readonly site: string;
  /** How many, because a row names a FRAME and a frame can hold two. */
  readonly n: number;
}

function routeKey(row: RouteSite): string {
  return `${row.kind} ${row.file} ${row.site} x${row.n}`;
}

function sortedKeys(rows: readonly RouteSite[]): readonly string[] {
  return rows.map(routeKey).sort();
}

/**
 * WHAT THE SWEEP DROPS. Not a definition of "a test file" — the definition is
 * `filesVitestRuns()`, and the test named "drops from the sweep exactly the
 * files vitest runs" pins this predicate's output against it, both ways, over
 * the project's own file list.
 *
 * WHY THAT PIN EXISTS. This was `/\.test\.tsx?$/` standing alone against a
 * `vitest.config.ts` that includes only `.test.ts` under `src/`, and the two are
 * not the same set: every `*.test.tsx` anywhere, and every `*.test.ts` outside
 * `src/`, was dropped here and run by nothing. `tsconfig.json` claims every
 * `.ts` and `.tsx` in the tree, so such a file IS COMPILED and IS in
 * `scannedFiles`; it was dropped from the reflective sweep, dropped from §7.5
 * (routed to `fixtures` and discarded), dropped from `src/tuning/audit.ts`'s
 * magic-number auditor, which used the identical regex — and it BUNDLES, because
 * there is no `metro.config.js` and Expo's default `sourceExts` resolves
 * `./seed` to `seed.test.tsx`. Verified by execution at the commit before this
 * one: `src/card/seed.test.tsx` holding a fully annotated `const seeded:
 * ServerRecord = { ...newServerRecord(SIGNUP_DAY), totalKg: 900 }` type-checked clean and
 * left the suite green at exactly the counts it had without the file (57 files,
 * 2437 tests).
 *
 * THE FIX IS NOT A NARROWER REGEX. `/\.test\.ts$/` would make a `.test.tsx`
 * swept and still unexecuted and still importable; it repairs a predicate rather
 * than removing the gap between two sets. Two sets asserted equal is the same
 * move `scanRoutes` already made when it collapsed "compiles into this app" and
 * "this scan sees it" into `parsed.fileNames`.
 */
const IS_TEST_FILE = /\.test\.tsx?$/;

/**
 * EVERY FILE VITEST ACTUALLY RUNS, repo-relative and sorted.
 *
 * ASKED OF VITEST, NOT DERIVED FROM A RESTATEMENT OF ITS GLOBS. `createVitest`
 * loads `vitest.config.ts` through the same code path the CLI uses and
 * `globTestSpecifications()` is the same call that decides what a run collects,
 * so an edit to `include` or `exclude` — or a whole second project — moves this
 * set without anything here being kept in step by hand. Copying the globs into
 * this file and re-globbing them would have reintroduced exactly the drift the
 * pin exists to remove.
 *
 * MEMOISED. It is roughly a third of a second (measured) because it starts a
 * Vite server; the instance is closed either way.
 */
let vitestFilesMemo: readonly string[] | null = null;
async function filesVitestRuns(): Promise<readonly string[]> {
  if (vitestFilesMemo !== null) return vitestFilesMemo;
  const moduleIds = new Set<string>();
  for (const relativeConfig of ['vitest.config.ts', 'web/vitest.config.ts']) {
    const instance = await createVitest('test', {
      root: REPO_ROOT,
      config: path.join(REPO_ROOT, relativeConfig),
      watch: false,
      run: true,
    });
    try {
      for (const specification of await instance.globTestSpecifications()) {
        moduleIds.add(specification.moduleId);
      }
    } finally {
      await instance.close();
    }
  }
  vitestFilesMemo = [...moduleIds]
    .map((moduleId) => path.relative(REPO_ROOT, moduleId).split(path.sep).join('/'))
    .sort();
  return vitestFilesMemo;
}

/** Vendored code. Never in the repo's own file list; checked anyway, cheaply. */
const IS_VENDORED = /(?:^|\/)node_modules\//;

/**
 * A path segment starting with `.` — `.claude/`, `.expo/`, `.gauntlet/`.
 *
 * NOT A FILTER. Nothing here removes these; the test named "scans the whole
 * project, not just src/" ASSERTS the file list contains none, because TypeScript's wildcard
 * includes already skip dot-directories and that behaviour is load-bearing:
 * `.claude/worktrees/` holds COMPLETE SECOND CHECKOUTS of this repository, and
 * a scan that walked into one would report routes in another agent's
 * half-finished copy of these very files. `audit.test.ts` hit exactly that —
 * 24 findings from a parallel tree — and its `NOT_WALKED` carries the reason at
 * length. Here the same hazard is closed by `tsconfig.json` rather than by a
 * list, so what this pins is that the closure is real and not luck.
 */
const IS_DOT_DIRECTORY = /(?:^|\/)\.[^/]+\//;

/**
 * THE FOUR IDIOMS THE LITERAL SWEEP CANNOT SEE, as literal text.
 *
 * `scanRoutes` asks the type checker for OBJECT LITERALS, so an assembly with no
 * literal in it presents no node to type: `Object.assign({}, rec, { … })` types
 * as `{} & ServerRecord & { totalKg: number }` with neither operand being a
 * record, `structuredClone(rec)` returns its argument's type, and `as unknown
 * as` erases whatever was there. These four patterns are the crude second pass.
 *
 * `as any as` IS THE FOURTH AND IS NEW THIS ROUND, taken because it is the same
 * shape as the row already running rather than a new kind of instrument:
 * `noImplicitAny` is on repo-wide and `progression.ts` already bans a bare
 * `\bany\b` in its own source, so a repo-wide sweep for the two-step launder
 * costs one line and excuses nothing (there is no live occurrence outside the
 * prose in this file and in §7.5). The other five escapes named below are NOT
 * taken: each would need a pattern shaped differently from these, and adding
 * them one at a time is how a bounded instrument comes to look like a closure.
 *
 * NOT GLOBAL, ON PURPOSE. A `/g` regex carries `lastIndex` across calls, and a
 * shared one reused by `.test()` in a loop skips matches. The counting site
 * builds its own global copy from `.source`.
 *
 * THEY ARE FOUR STRING PATTERNS AND NOT A CLOSURE OVER THE CLASS. §7.5's
 * residual 1 states the bound rather than claiming the class is shut, because it
 * is not: `class Forged { totalKg = 900; … }` plus `new Forged()`,
 * `JSON.parse(s) as ServerRecord`, `Object.fromEntries(…) as ServerRecord`,
 * `Object.create(rec)`, `Reflect.set` and an aliased `const assign =
 * Object.assign` all pass all four, and nothing else in this repository bans
 * them.
 */
const REFLECTIVE_ASSEMBLY = [
  { idiom: 'Object.assign', pattern: /Object\.assign\s*\(/ },
  { idiom: 'structuredClone', pattern: /structuredClone\s*\(/ },
  { idiom: 'as unknown as', pattern: /as unknown as/ },
  { idiom: 'as any as', pattern: /as any as/ },
] as const;

/**
 * Every occurrence of one of those idioms in the project's non-test files, by
 * file, idiom and COUNT — pinned both ways, so an occurrence that is not on this
 * list goes red and a row whose occurrence is gone goes red too.
 *
 * WHY A LIST RATHER THAN A SCOPE. The sweep used to run over a computed
 * CANDIDATE SET — files that import something reaching the boundary — and the
 * computation was a hand-rolled approximation of the word "imports" that missed
 * `await import()` and `export * from`. An exemption list is the other shape:
 * it cannot be wrong about which files it covers, because it covers all of them,
 * and everything excused is excused BY NAME in a diff a human reads.
 *
 * WHAT A ROW IS AND IS NOT. It is a statement that somebody read that line and
 * it is not a forged progression fact. It is NOT a proof that the file could not
 * reach one; the pin's value is that it is exact, so a second occurrence cannot
 * hide behind an excused first.
 *
 * `lines` IS THE OTHER HALF OF EXACT, and it closes the swap `n` cannot see.
 * Count-level pinning catches a second occurrence appearing and an excused one
 * vanishing — but deleting `blendPose`'s cast and adding a different one
 * elsewhere in `rig.ts` keeps the count at 1 and stays green. That is §7.5's
 * residual 4 ("two literals in one frame, one deleted and one added") arriving
 * at the exemption table, and it is carried over rather than restated as a
 * bound: `lines` holds the MATCHED SOURCE LINE, trimmed and
 * whitespace-collapsed, pinned both ways alongside the count.
 *
 * THE LINE TEXT AND NOT THE LINE NUMBER, deliberately. A number churns on every
 * edit above it and trains the reflex of re-running to get the new one; the text
 * is stable under insertions elsewhere in the file and moves only when the
 * excused line itself is rewritten — which is when it wants re-reading. Its cost
 * is that a rename on that line, or a reformat that splits it, is a red asking
 * for a diff nobody thinks is interesting. Named, not hidden.
 */
const REFLECTIVE_ASSEMBLY_EXEMPTIONS: readonly {
  readonly file: string;
  readonly idiom: string;
  readonly n: number;
  /** The matched line(s), `.trim()`ed with whitespace runs collapsed to one. */
  readonly lines: readonly string[];
  readonly why: string;
}[] = [
  {
    file: 'src/art/rig.ts',
    idiom: 'as unknown as',
    n: 1,
    lines: ['return out as unknown as Pose;'],
    why:
      'blendPose() interpolates a Pose field by field into a Record<string, number> ' +
      'and widens it once at the return. Sprite geometry, no progression fact in it; ' +
      'the sprite rig imports nothing from this boundary, which is context rather ' +
      'than the reason — the reason is that the line was read.',
  },
  {
    file: 'src/cutin/cutInObserver.ts',
    idiom: 'as unknown as',
    n: 1,
    lines: ['const scope = globalThis as unknown as Record<string, unknown>;'],
    why:
      'publishCutInObservations() puts a getter on globalThis so the browser tool can ' +
      'read what the cut-in gate was ASKED and what it ANSWERED. globalThis is typed as ' +
      'its own declared globals and this key is not one of them, so the widening is to ' +
      'Record<string, unknown> rather than to any, which CLAUDE.md bans. IT ASSEMBLES NO ' +
      'PROGRESSION VALUE: the thing published is a function returning an observation log ' +
      'of moments and refusal reasons, and this module imports nothing from the boundary. ' +
      'Added on the merge of two branches rather than by its author — A4 was built before ' +
      'this scan was tightened, so the line is new to the scan and not new to the tree, ' +
      'and it was read before it was excused.',
  },
  {
    file: 'src/game/meetField.ts',
    idiom: 'Object.assign',
    n: 6,
    lines: [
      "throw Object.assign(new Error(fixtureError(lifterId, 'plan is not a full card').message), {",
      'throw Object.assign(new Error(fixtureError(lifterId, declared.error.message).message), {',
      'throw Object.assign(new Error(fixtureError(lifterId, resolved.error.message).message), {',
      "throw Object.assign(new Error(fixtureError(lifterId, 'card did not complete').message), {",
      "throw Object.assign(new Error(fixtureError(lifterId, 'resolved fewer attempts than planned').message), {",
      "throw Object.assign(new Error(fixtureError(spec.id, 'lot collides on this flight').message), {",
    ],
    why:
      'A1 flight replay tags fixture Errors with a code and lifterId. The assign ' +
      'is onto an Error, not a progression record or wire. Named here because A1 ' +
      'landed the six throws after this sweep, and an unexcused Object.assign in ' +
      'shipped code is the thing the sweep exists to make a human read.',
  },
];

/** The form a matched line is pinned in: trimmed, whitespace runs collapsed. */
function normalizedLine(line: string): string {
  return line.trim().replace(/\s+/g, ' ');
}

/**
 * Everything the scan found, split into what ships and what is a fixture.
 *
 * `scannedFiles` is every repository file the program actually parsed. It does
 * double duty: the non-vacuity tests name `App.tsx` and `index.ts` in it so a
 * narrowed root set fails loudly, and `sweptFiles` derives the reflective
 * sweep's set from it rather than computing a second one that could disagree.
 */
interface RouteScan {
  readonly shipped: readonly RouteSite[];
  readonly fixtures: readonly RouteSite[];
  readonly scannedFiles: readonly string[];
  /**
   * Every resolved module edge inside the repository, `importer -> target`,
   * deduplicated and sorted.
   *
   * WHAT COUNTS AS AN IMPORT IS THE COMPILER'S ANSWER, NOT A LIST OF NODE KINDS.
   * Round nine's defect was a hand-rolled one — a `forEachChild` walk for
   * `ImportDeclaration` / `ExportDeclaration` with a non-empty clause, which
   * dropped `await import()` and bare `export * from`, this repository's own
   * house idioms. So this asks `checker.getSymbolAtLocation` of every string
   * literal in the program: TypeScript answers with a module symbol exactly when
   * the literal is a specifier, and its own enumeration of that covers static
   * imports, `export … from`, `import x = require()`, dynamic `import()` and
   * `import('…')` types. A construct nobody here has thought of is covered by
   * whoever taught `tsc` about it.
   */
  readonly importEdges: readonly string[];
  /**
   * Every `record` or `wire` literal in SHIPPED code that is not handed straight
   * to `sealServerValue`, as `kind file site`. Empty is the passing state.
   */
  readonly unsealed: readonly string[];
  /** How many shipped ones ARE. The non-vacuity counterweight to the above. */
  readonly sealedLiterals: number;
  /**
   * Every call in SHIPPED code spelled `sealServerValue(…)`, as `file site`,
   * whatever it resolves to — so a shim is counted here rather than skipped.
   */
  readonly sealCallSites: readonly string[];
  /**
   * The repo-relative files those callees are DECLARED in, deduplicated and
   * sorted. `['src/game/progression.ts']` is the passing state; anything else is
   * a second function answering to the seal's name. `<unresolved>` for a callee
   * the checker cannot follow, so a resolution that stops working reports itself
   * instead of emptying the set.
   */
  readonly sealCalleeSources: readonly string[];
}

/**
 * The files the reflective sweep runs over: every non-test file the project
 * compiles. No other filter, which is the whole of round nine's fix.
 */
function sweptFiles(scan: RouteScan): readonly string[] {
  return scan.scannedFiles.filter((file) => !IS_TEST_FILE.test(file));
}

/** One of the boundary types §7.5 enumerates construction sites of. */
interface RouteTarget {
  readonly kind: RouteKind;
  readonly name: string;
  readonly from: string;
  readonly type: ts.Type;
  readonly symbol: ts.Symbol;
}

/**
 * The program, the checker, and the boundary types — built once and shared.
 *
 * HOISTED OUT OF `scanRoutes` BECAUSE A SECOND INSTRUMENT NEEDS THE SAME
 * CHECKER. The route scan asks the checker which object literals are boundary
 * values; `auditSealWitnesses` asks the same checker what each named test
 * actually calls and actually freezes. Building a second `ts.Program` for the
 * second question is a few seconds of duplicated work and — worse — two
 * resolutions of the same types that could disagree.
 */
interface BoundaryProgram {
  readonly program: ts.Program;
  readonly checker: ts.TypeChecker;
  readonly targets: readonly RouteTarget[];
  /** Repo-relative posix path, or `null` for anything outside the repo. */
  repoPathOf(fileName: string): string | null;
  /** The identifier a callee is spelled with — `f()` and `o.f()`, nothing else. */
  calleeIdentifier(call: ts.CallExpression): ts.Identifier | undefined;
  /** Where that identifier is DECLARED, through import aliases and re-exports. */
  declaringFileOf(identifier: ts.Identifier): string | undefined;
  /** The symbol it resolves to, past any import alias. `declaringFileOf`'s input. */
  resolvedSymbolOf(identifier: ts.Identifier): ts.Symbol | undefined;
}

let boundaryProgramMemo: BoundaryProgram | null = null;

function boundaryProgram(): BoundaryProgram {
  if (boundaryProgramMemo !== null) return boundaryProgramMemo;

  // Each package compiles its own strict project. The boundary inventory
  // takes the union of their actual TypeScript inputs so adding a browser or
  // edge package cannot make its progression routes disappear from this scan.
  const configurations = ['tsconfig.json', 'web/tsconfig.json', 'web/tsconfig.test.json'];
  if (existsSync(path.join(REPO_ROOT, 'supabase/tsconfig.json'))) {
    configurations.push('supabase/tsconfig.json');
  }
  const projects = configurations.map((relativeConfig) => {
    const configPath = path.join(REPO_ROOT, relativeConfig);
    const result = ts.readConfigFile(configPath, ts.sys.readFile);
    if (result.error !== undefined) throw new Error(`Cannot read ${relativeConfig}`);
    const parsed = ts.parseJsonConfigFileContent(result.config as unknown, ts.sys, path.dirname(configPath));
    if (parsed.errors.length !== 0 || parsed.fileNames.length === 0) {
      throw new Error(`${relativeConfig} did not resolve to a valid nonempty source inventory`);
    }
    return parsed;
  });
  const native = projects[0];
  if (native === undefined) throw new Error('The native source project is missing');
  const fileNames = [...new Set(projects.flatMap((project) => project.fileNames))];
  const program = ts.createProgram(fileNames, {
    ...native.options,
    noEmit: true,
    skipLibCheck: true,
  });
  const checker = program.getTypeChecker();

  const repoPathOf = (fileName: string): string | null => {
    const rel = path.relative(REPO_ROOT, fileName).split(path.sep).join('/');
    if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return null;
    if (IS_VENDORED.test(rel)) return null;
    return rel;
  };

  // The interfaces the pin is about, resolved from their declarations so a
  // same-named type in another module cannot be mistaken for one of them.
  const wanted: { readonly kind: RouteKind; readonly name: string; readonly from: string }[] = [
    { kind: 'record', name: 'ServerRecord', from: 'src/game/sessionServer.ts' },
    { kind: 'wire', name: 'ProgressionSnapshotWire', from: 'src/game/progression.ts' },
    { kind: 'facts', name: 'ConfirmedFacts', from: 'src/game/progression.ts' },
  ];
  const targets: RouteTarget[] = [];
  for (const target of wanted) {
    const declaring = program.getSourceFile(path.join(REPO_ROOT, target.from));
    if (declaring === undefined) throw new Error(`${target.from} is not in the program`);
    let type: ts.Type | undefined;
    let symbol: ts.Symbol | undefined;
    declaring.forEachChild((node) => {
      if (ts.isInterfaceDeclaration(node) && node.name.text === target.name) {
        type = checker.getTypeAtLocation(node.name);
        symbol = checker.getSymbolAtLocation(node.name);
      }
    });
    if (type === undefined || symbol === undefined) {
      throw new Error(`no interface ${target.name} in ${target.from}`);
    }
    targets.push({ ...target, type, symbol });
  }

  const calleeIdentifier = (call: ts.CallExpression): ts.Identifier | undefined => {
    const callee = call.expression;
    if (ts.isIdentifier(callee)) return callee;
    // `o.#f()` is a `PrivateIdentifier`, which cannot be an import and cannot
    // name any of the functions these scans ask about, so it is not one.
    if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.name)) return callee.name;
    return undefined;
  };

  /*
   * WHERE A CALLEE IS DECLARED, ASKED OF THE CHECKER RATHER THAN OF ITS SPELLING.
   *
   * ONE IMPLEMENTATION WITH THREE CALLERS, WHICH IS THE POINT OF THE FUNCTION
   * AND NOT A TIDINESS PREFERENCE. `isSealedAt`, the `receive` tally and the
   * seal-witness producer walk are all name-driven checks. The `receive` half
   * resolved through the checker; the seal half compared `callee.text` to a
   * string twelve lines up and stopped there. CLAUDE.md's "a guard written for
   * one hook must be applied to its sibling, mechanically" failed inside a
   * single function body, and a MEASURED consequence followed — replacing
   * `meetPreview.ts`'s
   *
   *     import { sealServerValue } from './progression';
   *
   * with an aliased real import plus a local no-op shim spelled the same
   *
   *     import { sealServerValue as realSealServerValue } from './progression';
   *     const sealServerValue = <T,>(value: T): T => { void realSealServerValue; return value; };
   *
   * left `tsc --noEmit` at exit 0 and `progression.test.ts` +
   * `sessionServer.test.ts` + `guaranteeTags.test.ts` green at 202 tests, on the
   * commit this comment replaces. One import line, no cast, no `any`, and none
   * of §7.5 residual 1's four string patterns look for it. Copying the four
   * resolution lines a second time is what let them diverge once; there is now
   * nothing to copy.
   *
   * `SymbolFlags.Alias` is what an imported binding is, so following it is what
   * turns "a local thing spelled `sealServerValue`" into "progression.ts's
   * exported function". `getAliasedSymbol` follows a whole re-export chain, so a
   * barrel between the caller and the declaration resolves the same way.
   */
  const resolvedSymbolOf = (identifier: ts.Identifier): ts.Symbol | undefined => {
    const symbol = checker.getSymbolAtLocation(identifier);
    return symbol !== undefined && (symbol.flags & ts.SymbolFlags.Alias) !== 0
      ? checker.getAliasedSymbol(symbol)
      : symbol;
  };

  const declaringFileOf = (identifier: ts.Identifier): string | undefined =>
    resolvedSymbolOf(identifier)?.declarations?.[0]?.getSourceFile().fileName;

  boundaryProgramMemo = {
    program,
    checker,
    targets,
    repoPathOf,
    calleeIdentifier,
    declaringFileOf,
    resolvedSymbolOf,
  };
  return boundaryProgramMemo;
}

function scanRoutes(): RouteScan {
  const { program, checker, targets, repoPathOf, calleeIdentifier, declaringFileOf } =
    boundaryProgram();

  const receiverName = 'receiveProgressionSnapshot';
  const receiverFile = path.join(REPO_ROOT, 'src/game/progression.ts');
  // The seal. `sealServerValue` is asserted to be a real export of this module
  // below, so a rename cannot leave this string matching nothing — which is how
  // a scan becomes vacuous without anybody editing it. THE NAME IS A PREFILTER
  // AND NOT THE TEST; `declaringFileOf` below is the test.
  const SEAL_NAME = 'sealServerValue';
  const sealFile = path.join(REPO_ROOT, 'src/game/progression.ts');

  /**
   * One frame, named, or `null` for a node that is not one.
   *
   * THE ENUMERATION IS THE WHOLE SET OF NODES THAT OWN A FUNCTION BODY, and it
   * is written out rather than sampled. `ts.isPropertyDeclaration` was added
   * first, on the argument "nothing in the repo is written that way today, which
   * is exactly why it was worth adding" — and that argument applies word for
   * word to accessors, to constructors and to class static blocks, which were
   * left out. A principle applied to one of four cases is not a principle, so
   * the remaining three are here: a record built inside `get facts()`, inside a
   * constructor, or inside a `static { … }` block used to collapse to the outer
   * frame, and two of them collapsed all the way to `<module>`.
   *
   * The list is: `FunctionDeclaration`, `FunctionExpression`, `ArrowFunction`,
   * `MethodDeclaration`, `GetAccessorDeclaration`, `SetAccessorDeclaration`,
   * `ConstructorDeclaration`, `ClassStaticBlockDeclaration`. `MethodSignature`
   * and the ambient forms have no body to hold a literal. CLASSES AND NAMESPACES
   * ARE DELIBERATELY NOT FRAMES: they are scopes, not function bodies, and
   * naming them would rewrite every existing row's `site` for granularity §7.5's
   * residual already prices.
   *
   * A BINDING COUNTS WHEN IT HOLDS A FUNCTION, not whenever it holds anything.
   * The wider rule was tried and is worse: it names the binding a call's RESULT
   * lands in, so every `receive` row grew a `/received` tail that distinguishes
   * nothing, and four unrelated rows churned to say `applyMeetResult/next`.
   * The cost of the narrow rule is that two record literals at MODULE scope in
   * one file both report `<module>` and collapse to one row with a count of 2 —
   * a smaller version of the `useMeetDay` defect, left standing and named in
   * §7.5's residual rather than paid for with noise on nine rows.
   * Destructuring patterns are skipped either way: `const [cache, setCache] =
   * useState(…)` has no single name and `[cache, setCache]` would break the
   * table's columns.
   */
  const frameName = (node: ts.Node): string | null => {
    if (
      (ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isGetAccessorDeclaration(node) ||
        ts.isSetAccessorDeclaration(node)) &&
      node.name !== undefined
    ) {
      return node.name.getText();
    }
    // The two body-owning forms with no name of their own. Named for what they
    // are, because `<module>` is a lie about where the literal sits.
    if (ts.isConstructorDeclaration(node)) return 'constructor';
    if (ts.isClassStaticBlockDeclaration(node)) return 'static';
    if (
      (ts.isVariableDeclaration(node) ||
        ts.isPropertyAssignment(node) ||
        ts.isPropertyDeclaration(node)) &&
      node.initializer !== undefined &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) &&
      ts.isIdentifier(node.name)
    ) {
      return node.name.getText();
    }
    // AN ANONYMOUS FUNCTION HANDED STRAIGHT TO A CALL, named for the callee.
    // `useState(() => …)` and `setCache((c) => …)` are both "an arrow inside
    // `useMeetDay`" and nothing else distinguishes them, which is how one row
    // came to cover two structurally different sites.
    if (
      (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) &&
      node.parent !== undefined &&
      ts.isCallExpression(node.parent) &&
      node.parent.arguments.includes(node as ts.Expression)
    ) {
      const callee = node.parent.expression;
      if (ts.isIdentifier(callee)) return callee.text;
      if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
    }
    return null;
  };

  /** Every frame around a node, outermost first — the row's `site`. */
  const enclosingSite = (node: ts.Node): string => {
    const frames: string[] = [];
    let current: ts.Node | undefined = node.parent;
    while (current !== undefined) {
      const frame = frameName(current);
      if (frame !== null) frames.push(frame);
      current = current.parent;
    }
    return frames.length === 0 ? '<module>' : frames.reverse().join('/');
  };

  const counted = new Map<string, RouteSite>();
  const tally = (kind: RouteSite['kind'], file: string, site: string): void => {
    const key = `${kind} ${file} ${site}`;
    const existing = counted.get(key);
    counted.set(key, { kind, file, site, n: (existing?.n ?? 0) + 1 });
  };

  // -------------------------------------------------------------------------
  // AND, OF THE SAME LITERALS, WHETHER EACH ONE IS SEALED.
  //
  // A SECOND QUESTION ASKED OF THE SET ABOVE, NOT A SECOND ENUMERATION. §7.5's
  // rows are already derived from the type checker and pinned in both
  // directions; this reads the node the scan is holding anyway and asks whether
  // it is the argument of a `sealServerValue` call. So a construction site added
  // anywhere the project compiles must be sealed or `seals every record and wire
  // §7.5 finds in shipped code` goes red — with no list of seal sites to keep
  // current, which is what every previous round of this section ended up owning.
  //
  // WHY THE QUESTION IS "IS IT THIS CALL'S ARGUMENT" AND NOT "IS IT FROZEN".
  // Frozen-ness is a runtime property of a value and this is a scan over syntax;
  // it cannot execute the sites. What it can do is refuse a literal that is not
  // handed straight to the one function whose job this is. That is narrower than
  // the truth in the safe direction — `sealServerValue(build())` where `build()`
  // returns the literal reads as unsealed here and is not — and a site written
  // that way should say so by moving the call, rather than by widening this.
  //
  // AND THE CALLEE IS RESOLVED, NOT SPELLED. `declaringFileOf` above has the
  // measurement; the short version is that comparing `callee.text` to a string
  // accepted any local function of that name, so one import line defeated this
  // whole check with `tsc` clean and the suite green.
  //
  // WHAT IT CANNOT SEE, stated rather than left to be found: a value that is
  // sealed and then REPLACED, and any assembly with no object literal in it at
  // all, which is residual 1 above and is not made smaller by this. Nor does it
  // see INSIDE the seal — it proves the callee is progression.ts's export, not
  // that that export freezes anything, which is what the runtime
  // `Object.isFrozen` witnesses in `SEAL_RUNTIME_WITNESSES` are for.
  const unsealed: string[] = [];
  let sealedLiterals = 0;
  const isSealedAt = (node: ts.Node): boolean => {
    const parent = node.parent;
    if (parent === undefined || !ts.isCallExpression(parent)) return false;
    if (parent.arguments[0] !== node) return false;
    const identifier = calleeIdentifier(parent);
    if (identifier === undefined || identifier.text !== SEAL_NAME) return false;
    return declaringFileOf(identifier) === sealFile;
  };

  // THE SEAL'S CALL SITES IN THEIR OWN RIGHT, so the resolution above has a
  // non-vacuity counterweight that is a COUNT AND A SET rather than a bound.
  // `sealedLiterals` alone cannot tell "the resolution works" from "the
  // resolution accepts everything": both leave it at 7. `sealCalleeSources` can
  // — it reports where each shipped `sealServerValue(…)` callee is DECLARED, so
  // a shim named the same adds its own file to the set and the exact-set pin
  // goes red naming it, whether or not `isSealedAt` still filters on the file.
  // A callee the checker cannot resolve reports `<unresolved>` rather than
  // vanishing, because an input that is silently absent is its own defect shape.
  const sealCallSites: string[] = [];
  const sealCalleeSources = new Set<string>();

  // -------------------------------------------------------------------------
  // THERE IS NO CANDIDATE SET, AND THAT IS ROUND NINE'S FIX.
  //
  // The reflective-assembly guard below used to run over a computed subset of
  // the project — "a file is a candidate if it declares a target type or if any
  // symbol it imports from a repository module has a type that reaches one" —
  // implemented as a walk of `source.forEachChild` for `ImportDeclaration` and
  // `ExportDeclaration` nodes with a non-empty clause. That is not "imports",
  // and the two constructs it missed are this repository's own house idioms:
  //
  //   · `await import('./m')` is a `CallExpression` inside a FUNCTION BODY, so
  //     it was past the top-level walk and past the node-kind filter both.
  //     `index.ts`, `src/card/cardEntry.tsx` and `src/licensing/licensingEntry
  //     .tsx` hold six between them — everything downstream of the Skia WASM
  //     boot has to be loaded this way.
  //   · `export * from './m'` has `exportClause === undefined` and was dropped
  //     one line later. `src/art/index.ts` is fourteen of them.
  //
  // ON SUCH A FILE THE TWO CHECKS COMPOSED TO ZERO. The literal sweep is blind
  // to a no-literal assembly BY CONSTRUCTION — that is why the cruder guard
  // exists — and the cruder guard never looked at the file. Six lines appended
  // to `boot()` in `cardEntry.tsx`, on its own dynamic-import template:
  //
  //     const { newServerRecord, snapshotWireFor } =
  //       await import('../game/sessionServer');
  //     const { emptyProgressionCache } = await import('../game/progression');
  //     const { receiveSnapshot } = await import('../game/sessionClient');
  //     const claimed = Number(new URLSearchParams(location.search).get('total'));
  //     const forged = Object.assign({}, newServerRecord(SIGNUP_DAY), { totalKg: claimed });
  //     receiveSnapshot(emptyProgressionCache(), snapshotWireFor(forged, null));
  //
  // No object literal assignable to a record, no `ImportDeclaration` naming the
  // boundary, and no bare number for the magic-number audit to catch either —
  // a Total off the query string entering the cache as confirmed truth, `tsc`
  // clean, all 2437 tests green. (Taking the number off the URL rather than
  // writing `900` matters: a literal trips `audit.test.ts`, which would have
  // looked like this boundary catching it when it was not.)
  //
  // THE FIX IS NOT MORE CONSTRUCTS. Teaching the walk `import()`, bare
  // `export *` and `import =` leaves a hand-rolled approximation that the next
  // unusual construct reopens, and every round of this piece has been a scope
  // error one construct further out. The guard's entire purpose is preventing
  // under-scoping, so scoping it was self-defeating. It now runs over EVERY
  // non-test file the project compiles (`sweptFiles`), with the one live
  // occurrence in the tree excused BY NAME AND COUNT in
  // `REFLECTIVE_ASSEMBLY_EXEMPTIONS` rather than by a predicate. Reading 109
  // files and running three regexes is milliseconds, and deleting the type walk
  // gave that back: measured, this file runs at 7.4–7.7s against 7.8s before.
  // -------------------------------------------------------------------------

  const scannedFiles: string[] = [];
  const importEdges = new Set<string>();

  for (const source of program.getSourceFiles()) {
    if (source.isDeclarationFile) continue;
    const rel = repoPathOf(source.fileName);
    if (rel === null) continue;
    scannedFiles.push(rel);
    const visit = (node: ts.Node): void => {
      // EVERY RESOLVED MODULE EDGE, asked of the checker rather than of a list
      // of node kinds. `getSymbolAtLocation` of a string literal returns a
      // module symbol exactly when TypeScript itself considers that literal a
      // specifier — static import, `export … from`, `import =`, dynamic
      // `import()`, `import('…')` type — so "what counts as an import" is not a
      // question this file answers. It is the question round nine's candidate
      // set got wrong.
      if (ts.isStringLiteralLike(node)) {
        const moduleSymbol = checker.getSymbolAtLocation(node);
        const declaration = moduleSymbol?.declarations?.[0];
        if (declaration !== undefined && ts.isSourceFile(declaration)) {
          const target = repoPathOf(declaration.fileName);
          if (target !== null) importEdges.add(`${rel} -> ${target}`);
        }
      }
      if (ts.isObjectLiteralExpression(node)) {
        const own = checker.getTypeAtLocation(node);
        const contextual = checker.getContextualType(node);
        const contextualParts =
          contextual === undefined ? [] : contextual.isUnion() ? contextual.types : [contextual];
        for (const target of targets) {
          const byContext = contextualParts.some((part) => part.getSymbol() === target.symbol);
          // AND BY SHAPE, which is the half a scan for annotations cannot have.
          // A literal returned from a function whose return type is INFERRED has
          // no contextual type at all and is still a record.
          const byShape = target.type !== undefined && checker.isTypeAssignableTo(own, target.type);
          if (byContext || byShape) {
            tally(target.kind, rel, enclosingSite(node));
            if (!IS_TEST_FILE.test(rel)) {
              if (isSealedAt(node)) sealedLiterals += 1;
              else unsealed.push(`${target.kind} ${rel} ${enclosingSite(node)}`);
            }
          }
        }
      }
      if (ts.isCallExpression(node)) {
        const identifier = calleeIdentifier(node);
        if (identifier !== undefined && identifier.text === receiverName) {
          if (declaringFileOf(identifier) === receiverFile) tally('receive', rel, enclosingSite(node));
        }
        if (identifier !== undefined && identifier.text === SEAL_NAME && !IS_TEST_FILE.test(rel)) {
          const declaredIn = declaringFileOf(identifier);
          sealCallSites.push(`${rel} ${enclosingSite(node)}`);
          sealCalleeSources.add(
            declaredIn === undefined
              ? '<unresolved>'
              : (repoPathOf(declaredIn) ?? '<outside the repository>'),
          );
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  const all = [...counted.values()];
  return {
    shipped: all.filter((row) => !IS_TEST_FILE.test(row.file)),
    fixtures: all.filter((row) => IS_TEST_FILE.test(row.file)),
    scannedFiles: scannedFiles.sort(),
    importEdges: [...importEdges].sort(),
    unsealed: unsealed.sort(),
    sealedLiterals,
    sealCallSites: sealCallSites.sort(),
    sealCalleeSources: [...sealCalleeSources].sort(),
  };
}

/**
 * The rows §7.5 declares.
 *
 * Parsed out of the header COMMENT on purpose — that is the whole point of the
 * two-way pin. The separator row is excluded by requiring the count column to be
 * digits, so it cannot be mistaken for a route.
 */
function declaredRoutes(): readonly RouteSite[] {
  const start = MODULE_SOURCE.indexOf('7.5 THE ROUTE TABLE');
  if (start < 0) throw new Error('§7.5 is gone from the header');
  const section = MODULE_SOURCE.slice(start, MODULE_SOURCE.indexOf('*/\n\nimport type'));
  const rows = [...section.matchAll(/^\s*\*\s*\|\s*(\w+)\s*\|\s*(\S+)\s*\|\s*(\S+)\s*\|\s*(\d+)\s*\|/gm)];
  return rows.map((match) => {
    const kind = match[1];
    if (kind !== 'record' && kind !== 'wire' && kind !== 'facts' && kind !== 'receive') {
      throw new Error(`§7.5 has a row of unknown kind "${kind}"`);
    }
    return { kind, file: match[2] ?? '', site: match[3] ?? '', n: Number(match[4]) };
  });
}

/**
 * WHICH TEST ACTUALLY RUNS EACH §7.5 SEAL, as opposed to reading it off the
 * source.
 *
 * The scan resolves each seal callee through the checker, so it can say the
 * function being called IS `progression.ts`'s `sealServerValue`. It cannot say
 * that function froze anything — it never executes the site. These are the
 * checks that do, one per `record`/`wire`/`facts` row, pinned against the table
 * in both directions by `every-shipped-route-observes-its-seal`.
 *
 * `route` is `kind file site`, matching §7.5's columns without the count: the
 * count is what the row pin is for, and repeating it here would make this table
 * churn every time a frame gained a second literal.
 *
 * Two rows share a title on purpose — `sessionServer.ts`'s test covers both of
 * its `record` producers in one body, and splitting it to satisfy a table would
 * be the table deciding how the tests are written.
 *
 * ---------------------------------------------------------------------------
 * A NAMED TEST WAS ALL THIS TABLE EVER CHECKED, AND THAT WAS MEASURED FALSE
 * ---------------------------------------------------------------------------
 *
 * `title` had exactly one reader: a regular expression counting declarations
 * spelled with that title, and requiring the count to be one. So the table proved a test
 * EXISTED and never that it ASSERTED anything, while the paragraph in
 * `progression.ts` that declares this ledger said it "names the test that
 * actually calls each producer and asserts `Object.isFrozen` on the shell and
 * the nested objects". Neither clause was checked. Measured, not suspected:
 * emptying the body of the test titled 'freezes the drifted row the server
 * answers with' and keeping only that title left `tsc --noEmit` at exit 0 and the whole suite
 * at 63 files / 2687 tests, with one route's runtime evidence gone and the
 * ledger built to make that impossible reporting itself complete.
 *
 * The sibling guard existed one file over the entire time.
 * `guaranteeTags.test.ts` already required a `MutationWitness`'s `redAssertion`
 * to be verbatim text inside the named test's body. Two ledgers, same job,
 * different strength, nothing saying so. `auditSealWitnesses` below asks the
 * three questions the paragraph claimed, and the body scoping and its premise
 * census are now `src/tuning/audit.ts`'s, shared with that sibling.
 */
const SEAL_RUNTIME_WITNESSES: readonly {
  readonly route: string;
  readonly testFile: string;
  readonly title: string;
}[] = [
  {
    route: 'record src/game/sessionServer.ts newServerRecord',
    testFile: 'src/game/sessionServer.test.ts',
    title: 'seals the record this file produces, at both of its producers',
  },
  {
    route: 'record src/game/sessionServer.ts applyTrainingSession',
    testFile: 'src/game/sessionServer.test.ts',
    title: 'seals the record this file produces, at both of its producers',
  },
  {
    route: 'wire src/game/sessionServer.ts snapshotWireFor',
    testFile: 'src/game/sessionServer.test.ts',
    title: 'seals every level of the wire, not only its shell',
  },
  {
    route: 'record src/game/meetServer.ts applyMeetResult',
    testFile: 'src/game/meetServer.test.ts',
    title: 'freezes the record, its meets array, and the meet row that carries totalKg',
  },
  {
    route: 'record src/game/careerServer.ts applyFederationChoice',
    testFile: 'src/game/careerServer.test.ts',
    title: 'seals the record a federation choice produces, every nested object included',
  },
  {
    route: 'record src/game/meetPreview.ts previewServerRecord',
    testFile: 'src/game/meetServer.test.ts',
    title: 'freezes the debug preview record too, one meet deep',
  },
  {
    route: 'record src/session/sessionPreview.ts recordBeforeSession',
    testFile: 'src/session/sessionPreview.test.ts',
    title: 'freezes the row the scripted session starts from, and its nested objects',
  },
  {
    route: 'record src/session/sessionPreview.ts recordAfterServer',
    testFile: 'src/session/sessionPreview.test.ts',
    title: 'freezes the drifted row the server answers with',
  },
  {
    route: 'record src/game/saveGame.ts decodeSavedGame',
    testFile: 'src/game/saveGame.test.ts',
    title: 'seals the record a save decodes into, every nested object included',
  },
  {
    route: 'facts src/game/progression.ts receiveProgressionSnapshot',
    testFile: 'src/game/progression.test.ts',
    title: 'freezes what it hands back, symbol payload included',
  },
];

/**
 * The scan, run once and shared.
 *
 * MEMOISED RATHER THAN RUN AT IMPORT. Building a `ts.Program` over the whole
 * project is a few seconds of real work — it is the same work `tsc` does — and
 * an import that takes seconds has no timeout and no useful failure message if
 * it ever stops finishing. Inside a test it has both.
 */
let routeScanMemo: RouteScan | null = null;
function routeScan(): RouteScan {
  routeScanMemo ??= scanRoutes();
  return routeScanMemo;
}

// ---------------------------------------------------------------------------
// What each named witness actually does, read off the syntax tree
// ---------------------------------------------------------------------------

/** What one row of `SEAL_RUNTIME_WITNESSES` is measured to do. */
interface SealWitnessAudit {
  readonly route: string;
  /** The producer the route names: the outermost frame of its `site` column. */
  readonly producer: string;
  /** How many declarations of `title` the test file holds for this row. */
  readonly declarations: number;
  /**
   * Whether the body reaches the producer — directly, or through a helper
   * declared in the same test file.
   */
  readonly callsProducer: boolean;
  /** Whether it asserts `Object.isFrozen` on a value of the produced type. */
  readonly freezesShell: boolean;
  /** Which of the produced type's object-valued properties it asserts frozen. */
  readonly freezesNested: readonly string[];
  /** Whether it also asserts one array element of the produced type frozen. */
  readonly freezesElement: boolean;
  /** Every `Object.isFrozen(…)` argument in the body, as written. */
  readonly frozenArguments: readonly string[];
}

/**
 * The object-valued properties of a boundary type, sorted.
 *
 * DERIVED FROM THE TYPE RATHER THAN LISTED, which is the only version of this
 * check worth having: adding a nested object to `ServerRecord` makes every
 * `record` witness owe an assertion about it, with nobody maintaining a list of
 * what "the nested objects" means. A union — `number | null` — is not an object
 * type and drops out, so scalars are not demanded.
 */
function objectValuedProperties(target: RouteTarget, checker: ts.TypeChecker): readonly string[] {
  const names: string[] = [];
  for (const property of target.type.getProperties()) {
    const declaration = property.declarations?.[0];
    if (declaration === undefined) continue;
    const type = checker.getTypeOfSymbolAtLocation(property, declaration);
    if ((type.flags & ts.TypeFlags.Object) !== 0) names.push(property.name);
  }
  return names.sort();
}

/** The element types of a boundary type's array-valued properties. */
function arrayElementTypes(target: RouteTarget, checker: ts.TypeChecker): readonly ts.Type[] {
  const elements: ts.Type[] = [];
  for (const property of target.type.getProperties()) {
    const declaration = property.declarations?.[0];
    if (declaration === undefined) continue;
    const type = checker.getTypeOfSymbolAtLocation(property, declaration);
    const element = checker.getIndexTypeOfType(type, ts.IndexKind.Number);
    if (element !== undefined) elements.push(element);
  }
  return elements;
}

/*
 * WHAT THE THREE QUESTIONS ARE, AND WHY EACH IS ASKED OF THE CHECKER.
 *
 * (1) DOES THE BODY REACH THE PRODUCER. Six of the rows call it by name; the
 *     `applyMeetResult` row calls a fixture helper, `applyClean()`, that calls
 *     it. So this is reachability and not a name match: every call in the body
 *     is resolved past its import alias, and a callee declared IN THE SAME TEST
 *     FILE is followed into. One hop is not enough and unbounded is not needed
 *     — the walk is a queue over local declarations with a visited set, so it
 *     terminates on any depth of fixture helper. A callee declared anywhere
 *     else is not followed, deliberately: a helper in another module is a
 *     second thing to read, and this ledger's whole point is that the evidence
 *     is where the reader is looking.
 *
 * (2) DOES IT FREEZE THE SHELL. Every `Object.isFrozen(x)` in the body has
 *     `x`'s type asked of the checker; the shell is satisfied by any `x` whose
 *     type is assignable to the row's produced type. Assignability rather than
 *     symbol identity because a narrowed local, a destructured field and a
 *     `result.value.record` are all the produced type and none of them is the
 *     same node as the declaration.
 *
 * (3) DOES IT FREEZE THE NESTED OBJECTS. `Object.isFrozen(rec.streak)` counts
 *     for `streak` when `rec`'s own type is the produced type. That is what
 *     makes `Object.isFrozen(stored.bestByLift)` — where `stored` is a meet row
 *     and not a record — correctly NOT count as a record property, and it is
 *     what makes the requirement survive a rename of the local.
 *
 * WHAT IT DOES NOT ASK: whether the assertion PASSES. It cannot; it is a scan.
 * What closes that gap is that the file is one vitest runs — pinned by the
 * `filesVitestRuns()` check below — and the declaration is the bare declarator
 * rather than a `.skip` or `.only` variant, so if the assertion is written and
 * the suite is green then it ran and passed.
 * The failure this catches is the one that was live: an assertion that is not
 * written at all.
 */
function auditSealWitnesses(): readonly SealWitnessAudit[] {
  const { program, checker, targets, calleeIdentifier, resolvedSymbolOf } = boundaryProgram();

  return SEAL_RUNTIME_WITNESSES.map((witness) => {
    const [kind, file, site] = witness.route.split(' ');
    const target = targets.find((candidate) => candidate.kind === kind);
    if (target === undefined || file === undefined || site === undefined) {
      throw new Error(`${witness.route}: no boundary type for kind "${String(kind)}"`);
    }
    const producer = (site.split('/')[0] ?? '') as string;
    const producerFile = path.join(REPO_ROOT, file);
    const testPath = path.join(REPO_ROOT, witness.testFile);
    const source = program.getSourceFile(testPath);
    if (source === undefined) {
      throw new Error(`${witness.route}: ${witness.testFile} is not in the program`);
    }

    // The declarations of `witness.title`, as nodes. Counted here so the test
    // can insist there is exactly one before it reads the one it found.
    const bodies: ts.Node[] = [];
    const findDeclarations = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'it'
      ) {
        const [titleNode, callback] = node.arguments;
        if (
          titleNode !== undefined &&
          ts.isStringLiteralLike(titleNode) &&
          titleNode.text === witness.title &&
          callback !== undefined &&
          (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))
        ) {
          bodies.push(callback);
        }
      }
      ts.forEachChild(node, findDeclarations);
    };
    findDeclarations(source);

    const audit = {
      route: witness.route,
      producer,
      declarations: bodies.length,
      callsProducer: false,
      freezesNested: [] as string[],
      freezesShell: false,
      freezesElement: false,
      frozenArguments: [] as string[],
    };
    const body = bodies[0];
    if (body === undefined) return audit;

    const elements = arrayElementTypes(target, checker);
    const isProduced = (node: ts.Node): boolean =>
      checker.isTypeAssignableTo(checker.getTypeAtLocation(node), target.type);

    const visited = new Set<ts.Node>();
    const queue: ts.Node[] = [body];
    while (queue.length > 0) {
      const frame = queue.shift();
      if (frame === undefined || visited.has(frame)) continue;
      visited.add(frame);

      const walk = (node: ts.Node): void => {
        if (ts.isCallExpression(node)) {
          const identifier = calleeIdentifier(node);
          if (identifier !== undefined) {
            const declaration = resolvedSymbolOf(identifier)?.declarations?.[0];
            const declaringFile = declaration?.getSourceFile().fileName;
            if (identifier.text === producer && declaringFile === producerFile) {
              audit.callsProducer = true;
            } else if (declaration !== undefined && declaringFile === testPath) {
              // A fixture helper in the same file. Follow it.
              if (ts.isFunctionDeclaration(declaration) && declaration.body !== undefined) {
                queue.push(declaration.body);
              } else if (
                ts.isVariableDeclaration(declaration) &&
                declaration.initializer !== undefined &&
                (ts.isArrowFunction(declaration.initializer) ||
                  ts.isFunctionExpression(declaration.initializer))
              ) {
                queue.push(declaration.initializer);
              }
            }
          }

          // `Object.isFrozen(x)` — only inside the test's own body, never
          // inside a helper. An assertion is evidence where a reader can see
          // it, and a helper's assertions belong to whoever calls it.
          if (
            frame === body &&
            ts.isPropertyAccessExpression(node.expression) &&
            ts.isIdentifier(node.expression.expression) &&
            node.expression.expression.text === 'Object' &&
            node.expression.name.text === 'isFrozen'
          ) {
            const argument = node.arguments[0];
            if (argument !== undefined) {
              audit.frozenArguments.push(argument.getText());
              if (isProduced(argument)) audit.freezesShell = true;
              if (
                ts.isPropertyAccessExpression(argument) &&
                isProduced(argument.expression) &&
                !audit.freezesNested.includes(argument.name.text)
              ) {
                audit.freezesNested.push(argument.name.text);
              }
              const argumentType = checker.getTypeAtLocation(argument);
              if (elements.some((element) => checker.isTypeAssignableTo(argumentType, element))) {
                audit.freezesElement = true;
              }
            }
          }
        }
        ts.forEachChild(node, walk);
      };
      walk(frame);
    }

    audit.freezesNested.sort();
    audit.frozenArguments.sort();
    return audit;
  });
}

let sealWitnessAuditMemo: readonly SealWitnessAudit[] | null = null;
function sealWitnessAudits(): readonly SealWitnessAudit[] {
  sealWitnessAuditMemo ??= auditSealWitnesses();
  return sealWitnessAuditMemo;
}

// ---------------------------------------------------------------------------
// Fixtures. Every one of them goes through `receiveProgressionSnapshot`,
// because that is the only door and a test that ducked around it would be
// testing a different module than the app runs.
// ---------------------------------------------------------------------------

function wire(overrides: Partial<ProgressionSnapshotWire> = {}): ProgressionSnapshotWire {
  return {
    revision: 7,
    totalKg: 630,
    bestE1rmKg: { squat: 240, bench: 150, deadlift: 280 },
    streak: {
      signupDay: 19_000,
      currentStreak: 12,
      longestStreak: 31,
      lastTrainedDay: 20_000,
      entitlement: { windowIndex: 33, coveredDaysLeft: 2, purchasedDaysLeft: 0 },
      armedEntitlement: { windowIndex: 33, coveredDaysLeft: 2, purchasedDaysLeft: 0 },
      entitlementArmed: true,
      recoveryDayProtectionEnabled: true,
      hasBankedFirstRecoveryDaySave: true,
    },
    meets: [
      {
        meetId: 'meet-2026-spring',
        meetDayIndex: 19_900,
        totalKg: 630,
        bestByLift: { squat: 230, bench: 145, deadlift: 255 },
        bodyweightKg: 93,
      },
    ],
    wallet: { gymBucks: 1200, chalk: 40 },
    federation: { id: 'meridian', chosen: false },
    acknowledgedProposalId: null,
    ...overrides,
  };
}

function expectOk<T>(result: { ok: true; value: T } | { ok: false; error: { code: string; message: string } }): T {
  if (!result.ok) {
    throw new Error(`expected ok, got ${result.error.code}: ${result.error.message}`);
  }
  return result.value;
}

function expectErr<T>(
  result: { ok: true; value: T } | { ok: false; error: { code: string; message: string } },
): { code: string; message: string } {
  if (result.ok) {
    throw new Error('expected an error, got ok');
  }
  return result.error;
}

function snapshot(overrides: Partial<ProgressionSnapshotWire> = {}): ProgressionSnapshot {
  return expectOk(receiveProgressionSnapshot(wire(overrides)));
}

function confirmedCache(overrides: Partial<ProgressionSnapshotWire> = {}): ProgressionCache {
  return expectOk(applyServerSnapshot(emptyProgressionCache(), snapshot(overrides)));
}

/**
 * ANNOTATED WITH ITS KIND, not with the bare union. `proposeChange` infers its
 * type parameter from `proposal.kind`, so the annotation is what decides which
 * projection this fixture may be paired with. `ProgressionProposal` would work
 * here today only because control-flow analysis narrows a `const` back to the
 * member it was initialised with — relying on that would make the test depend on
 * an inference detail rather than on the boundary.
 */
const A_PROPOSAL: ProposalOfKind<'record-training-session'> = {
  kind: 'record-training-session',
  report: {
    deviceWallClock: { year: 2026, month: 8, day: 3, hour: 19 },
    // THE SETS RIDE ON A CARD AND THE CARD CARRIES THE UNIT. There is no `sets`
    // field to write here any more, and no arm reachable without naming a unit.
    card: {
      unit: 'kg',
      kilogramSets: [{ lift: 'squat', weight: 200, reps: 3, rpe: 8, executionQuality: 1 }],
    },
  },
};

/**
 * The other side of the ruling: the one proposal kind that DOES move a Total,
 * because it is the only one that carries competition attempts (GDD §6.4).
 * Every test below that wants an optimistic Total uses this one.
 */
const A_MEET_PROPOSAL: ProposalOfKind<'record-meet-result'> = {
  kind: 'record-meet-result',
  report: {
    meetId: asMeetId('meet-2026-autumn'),
    bodyweight: { unit: 'kg', kilograms: 93 },
    card: {
      unit: 'kg',
      kilogramAttempts: [
        { lift: 'squat', attemptNumber: 1, weight: 220, good: true },
        { lift: 'bench', attemptNumber: 1, weight: 150, good: true },
        { lift: 'deadlift', attemptNumber: 1, weight: 275, good: true },
      ],
    },
  },
};

/**
 * A projection built from the empty one, KEEPING THE OVERRIDES' EXACT TYPES.
 *
 * The return type is not `ProgressionProjection`, and it is not
 * `UnclaimedProjection & O` either. Both would defeat the boundary under test:
 * the first says every field might carry a claim, so nothing would fit a
 * narrowed kind; the second intersects `null` with `ProjectedKg` per field,
 * which TypeScript reduces to `never` — and `never` is assignable to everything,
 * so `projectionWith({ totalKg: ... })` would sail through a training session
 * and the guard would be invisible exactly where the tests live. Checked, not
 * assumed: the naive version compiles that pairing.
 */
function projectionWith<O extends Partial<ProgressionProjection>>(
  overrides: O,
): Omit<UnclaimedProjection, keyof O> & O {
  return { ...emptyProjection(), ...overrides };
}

/** One valid proposal of every kind, so a test can loop over the whole union. */
const PROPOSAL_BY_KIND: Readonly<Record<ProgressionProposalKind, ProgressionProposal>> = {
  'record-training-session': A_PROPOSAL,
  'set-recovery-day-protection': {
    kind: 'set-recovery-day-protection',
    report: { deviceWallClock: { year: 2026, month: 8, day: 3, hour: 9 }, protectionEnabled: false },
  },
  'record-meet-result': A_MEET_PROPOSAL,
  'redeem-entitlement': { kind: 'redeem-entitlement', report: { sku: 'chalk-pack-3', receipt: 'txn-1' } },
  'spend-currency': { kind: 'spend-currency', report: { currency: 'gymBucks', amount: 500, sku: 'gym-decor-neon' } },
  'choose-federation': { kind: 'choose-federation', report: { federationId: 'ironline' } },
};

/** A projection that claims exactly one fact, and nothing else. */
function projectionClaiming(fact: ProjectionKey): ProgressionProjection {
  switch (fact) {
    case 'totalKg':
      return { ...emptyProjection(), totalKg: projectedKg(645) };
    case 'bestE1rmKg':
      return { ...emptyProjection(), bestE1rmKg: { squat: projectedKg(245), bench: null, deadlift: null } };
    case 'streak':
      return { ...emptyProjection(), streak: { currentStreak: projectedCount(13) } };
    case 'wallet':
      return { ...emptyProjection(), wallet: { gymBucks: projectedCount(1250), chalk: null } };
    default: {
      // Exhaustive over `ProjectionKey`: a new projectable fact fails `tsc` here
      // rather than quietly getting no coverage in the reach tests below.
      const unreachable: never = fact;
      throw new Error(`no projection fixture for ${String(unreachable)}`);
    }
  }
}

/**
 * `proposeChange` WITH THE COMPILE-TIME PAIRING RULE TAKEN OFF.
 *
 * `ProjectionWithinReach` makes a training-session-plus-Total-projection a type
 * error, so the pairing cannot be written in typed code — which is the point,
 * and which also means the RUNTIME refusal could not be tested at all without
 * this. The cast models the caller the runtime check exists for: JavaScript, a
 * projection rehydrated from storage, or someone's `as`. Nothing else in this
 * file may use it, or the compile-time half stops being tested.
 */
function proposeUntyped(
  cache: ProgressionCache,
  proposalId: ProposalId,
  proposal: ProgressionProposal,
  projection: ProgressionProjection,
): ProgressionResult<ProgressionCache> {
  const erased = proposeChange as unknown as (
    cache: ProgressionCache,
    proposalId: ProposalId,
    proposal: ProgressionProposal,
    projection: ProgressionProjection,
  ) => ProgressionResult<ProgressionCache>;
  return erased(cache, proposalId, proposal, projection);
}

/**
 * EVERY FIELD NAME A PROPOSAL OF THIS KIND CAN PUT ON THE WIRE, nested report
 * types included. `MoneyCarryingProposalKind` reads `keyof` the top-level report
 * only, so the nested allowlists are checked here or nowhere.
 *
 * Two bindings, because one is not enough in a test file. The `Record<
 * ProgressionProposalKind, ...>` annotation makes a new proposal kind fail
 * `npm run typecheck`; the key cross-check against `PROGRESSION_PROPOSAL_KINDS`
 * in the test below makes it fail `npm test`, which matters because vitest
 * strips types rather than checking them and there is no CI.
 */
const PAYLOAD_KEYS_BY_PROPOSAL_KIND: Record<ProgressionProposalKind, readonly string[]> = {
  'record-training-session': [
    ...TRAINING_SESSION_REPORT_KEYS,
    ...TRAINING_CARD_REPORT_KEYS,
    ...TRAINING_SET_REPORT_KEYS,
  ],
  'set-recovery-day-protection': [...SET_RECOVERY_DAY_PROTECTION_REPORT_KEYS],
  'record-meet-result': [...MEET_RESULT_REPORT_KEYS, ...MEET_CARD_REPORT_KEYS, ...MEET_ATTEMPT_REPORT_KEYS],
  'redeem-entitlement': [...REDEEM_ENTITLEMENT_REPORT_KEYS],
  'spend-currency': [...SPEND_CURRENCY_REPORT_KEYS],
  'choose-federation': [...CHOOSE_FEDERATION_REPORT_KEYS],
};

/** Every payload field name belonging to a kind with this declared origin. */
function payloadKeysWithOrigin(origin: (typeof PROPOSAL_ORIGIN_KINDS)[number]): readonly string[] {
  return PROGRESSION_PROPOSAL_KINDS.filter((kind) => PROPOSAL_ORIGIN_BY_KIND[kind] === origin).flatMap(
    (kind) => [...PAYLOAD_KEYS_BY_PROPOSAL_KIND[kind]],
  );
}

/**
 * Every word in `PERFORMANCE_FACT_VOCABULARY`, both groups. Pace words are a
 * subset of what a fact may not be OPEN under, so the two groups are checked
 * together where the question is "may this be bought?" and separately where the
 * question is "may this exist at all?".
 */
const EVERY_PERFORMANCE_WORD: readonly string[] = [
  ...PERFORMANCE_FACT_VOCABULARY.pace,
  ...PERFORMANCE_FACT_VOCABULARY.performance,
];

/**
 * The words of `vocabulary` that appear in `name`, case-insensitively.
 *
 * The runtime twin of the module's `WordsMatching`. Returns the hits rather than
 * a boolean on purpose: a test that asserts `toEqual([])` fails with the word
 * that caught it, and the positive controls can assert the scan found SOMETHING
 * without hard-coding which word.
 */
function vocabularyHits(name: string, vocabulary: readonly string[]): readonly string[] {
  const lower = name.toLowerCase();
  return vocabulary.filter((word) => lower.includes(word));
}

/** One of the module's exported `*_REPORT_KEYS` allowlists, read back by name. */
function reportKeyAllowlist(name: string): readonly string[] {
  const exported: Readonly<Record<string, unknown>> = progressionModule;
  const value = exported[name];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error(`expected ${name} to be an array of field names`);
  }
  return value as readonly string[];
}

// ---------------------------------------------------------------------------
// Purity
// ---------------------------------------------------------------------------

describe('purity', () => {
  it('reads no clock, no randomness and no network', () => {
    // The same source-scan `streak.test.ts` uses, for the same reason: the
    // claim in the header is worth nothing if nothing checks it.
    const withoutComments = MODULE_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(withoutComments).not.toMatch(/\bDate\b/);
    expect(withoutComments).not.toMatch(/Math\.random/);
    expect(withoutComments).not.toMatch(/performance\.now/);
    expect(withoutComments).not.toMatch(/\bfetch\(/);
    expect(withoutComments).not.toMatch(/\bawait\b/);
    expect(withoutComments).not.toMatch(/from 'react/);
    expect(withoutComments).not.toMatch(/supabase/i);
  });

  it('names every permanent fact in the unit sweep, so the sweep cannot be scoped', () => {
    // §7 OF THE HEADER IS A TABLE, AND A TABLE GOES STALE. This is what stops it.
    //
    // The failure this exists for is not hypothetical and is not a typo: for
    // three rounds `meetServer.ts` carried a sweep scoped to "this path", every
    // field on that path was genuinely proven, and a bare `weightKg` sat thirty
    // lines away in THIS file on the other mode's path. Honest scoping, complete
    // within its scope, and the defect lived outside it.
    //
    // So the subject of the sweep is the FACT SET, derived, and every member of
    // it has to be named in §7 — including a fact added tomorrow by someone who
    // never read the section.
    const sweep = MODULE_SOURCE.slice(
      MODULE_SOURCE.indexOf('7. THE UNIT SWEEP'),
      MODULE_SOURCE.indexOf('*/\n\nimport type'),
    );
    // Non-vacuity: the slice really is the section, not an empty string that
    // `toContain` would report nothing about.
    expect(sweep.length).toBeGreaterThan(2000);
    expect(sweep).toContain('WHAT IS STILL UNPROVEN');

    const everyPermanentField: readonly string[] = [
      ...PROGRESSION_FACT_KEYS,
      ...CONFIRMED_MEET_RESULT_KEYS,
      ...STREAK_FACT_KEYS,
      ...WALLET_CURRENCIES,
    ];
    expect(everyPermanentField.length).toBeGreaterThan(15);
    for (const field of everyPermanentField) {
      expect(sweep, `§7 does not mention ${field}`).toContain(field);
    }
    // And the control for the scan itself: a name that is NOT a permanent fact
    // is not in the section either, so `toContain` is discriminating rather than
    // matching everything.
    expect(sweep).not.toContain('simSessionsPerDay');
  });

  it('scans the whole project, not just src/', { timeout: budgetFrom(15_300) }, () => {
    // THE ROUND-SEVEN DEFECT, PINNED BY NAME. The scan was rooted at
    // `walk(REPO_ROOT + '/src')`. `App.tsx` and `index.ts` are at the repo root
    // and every import points INTO `src/` and never out, so neither was reached
    // directly or transitively — and a fully annotated
    // `const seeded: ServerRecord = { ...newServerRecord(SIGNUP_DAY), totalKg: 900 }`
    // appended to `App.tsx` compiled clean, passed all 133 tests here, and added
    // no §7.5 row. Same species as the `meetServer.ts` sweep §7 replaced, one
    // level out: honestly scoped, complete within scope, defect outside it.
    //
    // Anchored BY NAME, which is `audit.test.ts`'s shape for the same problem
    // ("walks the whole repository, not just src/"). A future narrowing of the
    // root set fails here with the file it dropped, rather than passing quietly
    // with a smaller world.
    expect(routeScan().scannedFiles, 'App.tsx is not in the scanned set').toContain('App.tsx');
    expect(routeScan().scannedFiles, 'index.ts is not in the scanned set').toContain('index.ts');
    expect(routeScan().scannedFiles).toContain('vitest.config.ts');
    expect(routeScan().scannedFiles).toContain('src/game/sessionServer.ts');
    expect(routeScan().scannedFiles.length).toBeGreaterThan(100);

    // ...and the two directions the root set must NOT grow in.
    //
    // `node_modules` is obvious. The dot-directory rule is not, and it is
    // load-bearing: `.claude/worktrees/` holds COMPLETE SECOND CHECKOUTS of this
    // repository, so a root set that reached into one would report routes from
    // another agent's half-finished copy of these very files, and this pin's
    // verdict would depend on who else is building right now. `audit.test.ts`
    // hit exactly that — 24 findings from a parallel tree — and closes it with
    // an explicit `NOT_WALKED`. Here `tsconfig.json` closes it for free, because
    // TypeScript's wildcard `include`s skip dot-directories. Asserted, not
    // trusted: if that ever stops being true this goes red instead of going
    // slow-and-wrong.
    for (const file of routeScan().scannedFiles) {
      expect(IS_VENDORED.test(file), `${file} is vendored`).toBe(false);
      expect(IS_DOT_DIRECTORY.test(file), `${file} is inside a dot-directory`).toBe(false);
    }
  });

  it('leaves no TypeScript file in the repository out of the scanned set', () => {
    // THE HALF THE ANCHORS ABOVE DO NOT COVER. Rooting the scan in
    // `tsconfig.json` bought the entry points, and it moved the way this can be
    // narrowed rather than removing it: an `exclude` entry, or an `include` that
    // stops saying `**/*`, shrinks the sweep silently, and every anchor above
    // would still pass because they all name files that would still be in.
    //
    // So the project's list is checked against the DISK, by the only walk in
    // this file — and this walk is not the root set, it is the cross-check on
    // the root set. That distinction is the whole point: a directory walk as the
    // root is what produced round seven's defect, because someone has to choose
    // the directory. Here nothing is chosen; it starts at the repository and
    // skips only vendored code and dot-directories, both of which are the same
    // two exclusions asserted above, so what this compares is two independent
    // answers to "which TypeScript files are in this repository".
    //
    // THIS WALK AND `audit.test.ts`'s DO NOT AGREE, and the divergence is worth
    // naming rather than leaving for someone to trip over. That one skips a
    // FIXED list (`node_modules`, `.git`, `.expo`, `dist`, `coverage`,
    // `.claude`); this one skips every dot-prefixed entry and does NOT skip
    // `dist` or `coverage`. Neither directory exists today. If one appears with
    // TypeScript in it, this goes RED demanding it be in the project's file list
    // — which is the safe direction for a check whose failure mode is seeing too
    // little — and the fix at that point is an `exclude` in `tsconfig.json`,
    // visible in a diff, rather than a skip list here.
    //
    // `.mts` / `.cts` ARE WALKED, ahead of there being one. `tsconfig.json`'s
    // `include` says `**/*.ts` and `**/*.tsx`, neither of which matches
    // `foo.mts`, so an ES-module-flavoured source would fall out of the project
    // list AND out of a `/\.tsx?$/` walk — invisible from both ends, which is
    // the one shape this cross-check exists to make impossible. Matching them
    // here means such a file goes red until `tsconfig.json` claims it.
    // `tools/png.d.mts` is the live case and is excluded as a declaration file,
    // by the same rule as `src/audio/assets.d.ts`.
    const found: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        // `.d.ts` is out and the scan agrees: the program skips declaration
        // files (`source.isDeclarationFile`) because they declare types and
        // hold no expressions, so there is no object literal in one to find.
        // `src/audio/assets.d.ts` is the live example — it types `*.mp3`
        // imports. Including it here would only ever fail for that reason.
        else if (/\.[mc]?tsx?$/.test(entry.name) && !/\.d\.[mc]?tsx?$/.test(entry.name)) {
          found.push(path.relative(REPO_ROOT, full).split(path.sep).join('/'));
        }
      }
    };
    walk(REPO_ROOT);

    // Non-vacuity: the walk found a tree, not an empty directory.
    expect(found.length).toBeGreaterThan(100);
    expect(found).toContain('App.tsx');

    const scanned = new Set(routeScan().scannedFiles);
    for (const file of found) {
      expect(
        scanned.has(file),
        `${file} is TypeScript in this repository and tsconfig.json's file list does not claim it — the route pin cannot see anything in it`,
      ).toBe(true);
    }
  });

  it('names every route into permanent progression in §7.5, derived from the type checker', () => {
    // THE ROUTE HALF OF THE SWEEP, MECHANISED. The test above is over the FACT
    // SET and cannot see a new `ServerRecord` construction site; that is what
    // its own §7.4 admitted, and a grep found the missing route in five of the
    // six rounds this section has existed. This is the direction that matters:
    // a hand-built record ANYWHERE THE PROJECT COMPILES that §7.5 does not name.
    //
    // Non-vacuity first, so a scan that resolved nothing cannot pass by finding
    // nothing: the shipped set has to contain the two server functions the whole
    // boundary is built around, and the scanned set has to reach past `src/`.
    //
    // A COUNT AND NOT A BOUND, because the count was available. `> 4` is
    // satisfied by a scan that lost three of the nine rows, and the row-by-row
    // loop below only fails on a row the TABLE does not name — a route the scan
    // stopped finding is invisible to it and is caught by the reverse pin one
    // test down, which had the same bound. Nine is §7.5's eight producer rows
    // plus its one `receive` row. It moves when a route is added or deleted,
    // which is a diff somebody writes on purpose.
    // 10 -> 12 with Sprint 2's save loader: `decodeSavedGame` is one route seen
    // twice — a `receive` (the stored wire through the boundary's own decoder)
    // and a `record` (the sealed row assembled from what it proved).
    expect(routeScan().shipped.length, 'shipped rows the scan resolves').toBe(12);
    expect(sortedKeys(routeScan().shipped)).toContain('record src/game/sessionServer.ts newServerRecord x1');
    expect(sortedKeys(routeScan().shipped)).toContain('record src/game/meetServer.ts applyMeetResult x1');
    // The anchor that would have caught round seven's defect. A route pin whose
    // world stops at `src/` passes every assertion above it.
    expect(routeScan().scannedFiles).toContain('App.tsx');
    expect(routeScan().scannedFiles).toContain('index.ts');
    expect(routeScan().scannedFiles.some((file) => !file.startsWith('src/'))).toBe(true);

    const declared = new Set(sortedKeys(declaredRoutes()));
    for (const row of routeScan().shipped) {
      expect(
        declared.has(routeKey(row)),
        `${row.file} builds a ${row.kind} in ${row.site} (x${row.n}) and progression.ts §7.5 does not name it`,
      ).toBe(true);
    }
  });

  it('names no route in §7.5 that no longer exists', () => {
    // The other half of the two-way pin, in the shape `REVIEWABLE_CITATIONS`
    // uses: a table that may only grow is a table that fills up with rulings
    // about code somebody deleted, and every stale row makes the real ones
    // cheaper to skim past. Deleting a builder means deleting its row.
    //
    // A COUNT AND NOT A BOUND. `> 4` passed on a table that had lost four of
    // its nine rows, and the loop below cannot see a missing row either — it
    // walks the table, so a deleted row is simply not walked. This is the pin
    // that catches the table shrinking, and it was the one number in the pair
    // that could be stated exactly.
    // 10 -> 12 with the two saveGame rows, declared beside their reasoning.
    expect(declaredRoutes().length, '§7.5 rows parsed out of the header').toBe(12);
    const found = new Set(sortedKeys(routeScan().shipped));
    for (const row of declaredRoutes()) {
      expect(
        found.has(routeKey(row)),
        `progression.ts §7.5 names ${row.kind} ${row.file} ${row.site} x${row.n}, and the scan does not find it — delete the row or fix the count`,
      ).toBe(true);
    }
  });

  it('names a runtime freeze witness for every §7.5 route [every-shipped-route-observes-its-seal]', () => {
    // WHAT THIS ADDS THAT THE SCAN CANNOT. The scan above resolves each seal
    // callee to `progression.ts`'s export. It still cannot execute the site, so
    // it proves IDENTITY and not BEHAVIOUR: a `sealServerValue` that returned
    // its argument untouched would leave every assertion up there green.
    //
    // FOUR OF THE SEVEN ROWS HAD NO RUNTIME EVIDENCE AT ALL when this ledger was
    // written — `applyMeetResult`, the sole writer of `totalKg`, among them, and
    // a grep for `isFrozen` across `src/` returned nothing in
    // `meetServer.test.ts`. That is the gap this closes, and the ledger rather
    // than four loose tests is the point: without it the same four rows can go
    // back to syntax-only evidence one deletion at a time, and a NEW row arrives
    // with no runtime evidence and nothing says so.
    //
    // IT IS A POINTER, AND CLAUDE.md IS RIGHT THAT A POINTER TO A TEST THAT
    // CANNOT FAIL IS THE SAME DEFECT ONE LEVEL OUT. So all seven were
    // mutation-tested by hand on the run that declared this, in both directions
    // that matter — the seal deleted, and the seal replaced by a SHALLOW
    // `Object.freeze` — and every one went red. The four shallow mutants each
    // reddened on a NESTED object (`the meets array`, `bestE1rmKg`, `and its
    // e1RMs`), which is the half a shell-only check would have missed.
    //
    // AND THAT WAS NOT ENOUGH, WHICH IS WHY THIS TEST IS TWICE THE LENGTH IT
    // WAS. Everything above describes a mutation somebody ran by hand once. The
    // ledger's own mechanical content was `existsSync` plus a regexp counting
    // declarations, so it survived every one of those mutants for the same
    // reason it survived EMPTYING A NAMED TEST'S BODY AND KEEPING ITS TITLE:
    // it never read the body at all. That mutant was run at the commit before
    // this one and left `tsc` at exit 0 and the suite at 63 files / 2687 tests.
    // The three clauses below are the ones the ledger's paragraph in
    // `progression.ts` had been claiming all along.
    const scan = routeScan();
    const rows = scan.shipped.filter((row) => row.kind !== 'receive');

    // NON-VACUITY AS A COUNT, so an empty scan cannot satisfy the loop below.
    // 9 -> 10 with the save loader's record row (its receive row needs no
    // freeze witness — a receive mints facts behind the snapshot's own seal).
    expect(rows.length, 'shipped record/wire/facts rows to find witnesses for').toBe(10);
    expect(SEAL_RUNTIME_WITNESSES.length, 'ledger rows').toBe(10);

    // BOTH DIRECTIONS. An unwitnessed row is the defect this closes; a witness
    // for a row that no longer exists is bookkeeping about deleted code, and
    // §12.2's own restatement of the bar calls out that a table which only ever
    // grows fills with rulings nobody can skim.
    const found = new Set(rows.map((row) => `${row.kind} ${row.file} ${row.site}`));
    const listed = new Set(SEAL_RUNTIME_WITNESSES.map((w) => w.route));
    expect(
      [...found].filter((route) => !listed.has(route)).sort(),
      'a §7.5 route with no runtime freeze witness — write one and list it here',
    ).toEqual([]);
    expect(
      [...listed].filter((route) => !found.has(route)).sort(),
      'a runtime freeze witness for a §7.5 route that no longer exists',
    ).toEqual([]);

    // AND EACH NAMED TEST EXISTS AND RUNS. The pattern requires the bare `it`
    // form, so `it.skip` / `it.todo` / `it.fails` fail this rather than
    // satisfying it — a witness that is declared and not executed is the same
    // nothing as a witness that was never written.
    //
    // BUILT AS A REGEXP RATHER THAN A STRING, and the reason is a real one
    // rather than taste: spelling the needle as a plain template literal plants
    // a verbatim test-declaration opener in this file, which then truncates this
    // very test's body in `guaranteeTags.test.ts`'s witness scoper — so the
    // assertion below could not be witnessed at all — and registers a phantom
    // title in that file's tree-wide title sweep. Found by writing it the
    // obvious way and watching the witness fail to resolve.
    for (const witness of SEAL_RUNTIME_WITNESSES) {
      const full = path.join(REPO_ROOT, witness.testFile);
      expect(existsSync(full), `${witness.route}: ${witness.testFile} is gone`).toBe(true);
      const text = readFileSync(full, 'utf8');
      const escaped = witness.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const declaration = new RegExp(String.raw`\bit\s*\(\s*'${escaped}'`, 'g');
      expect(
        [...text.matchAll(declaration)].length,
        `${witness.route}: ${witness.testFile} does not declare exactly one running test called "${witness.title}"`,
      ).toBe(1);

      // AND THE SCOPER CAN SLICE THE FILE, on `audit.ts`'s census, which is the
      // same call `guaranteeTags.test.ts` makes about its own witness files.
      // Two ledgers scoping into two different lists of test files, one guard:
      // the premise cannot be strengthened for one and left weak for the other,
      // which is exactly how these two ledgers came to differ in the first
      // place. The census fails on a spurious declarator opener inside a string
      // or a comment (which truncates a body, fails closed) and on the `.each` /
      // `.skip` / `.only` variants (which merge two bodies, fails open).
      // Measured while this was being written: seven of the sentences in this
      // very file tripped it, which is the guard biting on its own author.
      expect(
        testScopeFault(text, witness.testFile),
        `${witness.route}: the witness scoper cannot slice ${witness.testFile}`,
      ).toBe(null);
    }

    // -----------------------------------------------------------------------
    // WHAT THE NAMED TEST ACTUALLY DOES, WHICH IS WHAT `title` NOW HAS A READER
    // FOR. Everything above this line is satisfied by a test that declares a
    // title and asserts nothing.
    // -----------------------------------------------------------------------
    const audits = sealWitnessAudits();
    const { targets, checker } = boundaryProgram();
    expect(audits.length, 'audited witnesses').toBe(SEAL_RUNTIME_WITNESSES.length);

    // THE REQUIRED DEPTH IS DERIVED FROM THE BOUNDARY TYPES, NOT LISTED, and
    // these three sets are pinned exactly because the requirement below is a
    // superset check: a derivation that returned nothing would make it pass on
    // every row at once. `totalKg` is absent from all three on purpose — it is
    // `number | null`, not an object, and there is nothing to freeze.
    const requiredByKind = Object.fromEntries(
      targets.map((target) => [target.kind, objectValuedProperties(target, checker)]),
    );
    expect(requiredByKind, 'the nested objects each boundary type carries').toEqual({
      record: ['bestE1rmKg', 'fatigue', 'federation', 'meets', 'streak', 'wallet'],
      wire: ['bestE1rmKg', 'federation', 'meets', 'streak', 'wallet'],
      facts: ['bestE1rmKg', 'federation', 'meets', 'streak', 'wallet'],
    });

    for (const audit of audits) {
      const kind = audit.route.split(' ')[0] ?? '';
      const required = requiredByKind[kind] ?? [];

      // (1) EXACTLY ONE DECLARATION, READ OFF THE SYNTAX TREE. The regexp check
      //     above reads raw text and would count an occurrence inside a string
      //     or a comment; this counts call expressions whose callee is the
      //     declarator, whose first argument is the title, and whose second is a
      //     real callback. Two instruments, and the tree is the one the
      //     body scoping then uses, so this is its precondition rather than a
      //     duplicate.
      expect(
        audit.declarations,
        `${audit.route}: ${audit.producer}'s witness is not exactly one \`it\` with a callback`,
      ).toBe(1);

      // (2) THE BODY REACHES THE PRODUCER. Six rows call it by name; the
      //     `applyMeetResult` row reaches it through `applyClean()`, a fixture
      //     helper in the same file, which is why this is resolved reachability
      //     rather than a name match.
      expect(
        audit.callsProducer,
        `${audit.route}: the named test never reaches ${audit.producer} — it is a witness for a producer it does not run`,
      ).toBe(true);

      // (3) IT FREEZES THE SHELL AND EVERY NESTED OBJECT. This is the clause
      //     the ledger's paragraph claimed and nothing checked, and four of the
      //     seven rows did not meet it: `newServerRecord`, `applyTrainingSession`
      //     and `recordAfterServer` asserted `bestE1rmKg` alone, and
      //     `previewServerRecord` left `wallet` and `fatigue` unasserted.
      expect(
        audit.freezesShell,
        `${audit.route}: the named test asserts Object.isFrozen on nothing of the produced type`,
      ).toBe(true);
      expect(
        required.filter((property) => !audit.freezesNested.includes(property)),
        `${audit.route}: nested objects the named test does not assert frozen. Object.freeze is shallow and every number §12.2's bar is about lives one level down`,
      ).toEqual([]);
    }

    // NON-VACUITY FOR THE WALK ITSELF, AS A COUNT. Every assertion in the loop
    // above is satisfiable by an audit that found the right things; none of
    // them is red if the walk silently found NO `Object.isFrozen` calls and the
    // required sets were empty. This is the number of arguments the walk read.
    const frozen = audits.reduce((total, audit) => total + audit.frozenArguments.length, 0);
    // 63 -> 64 when the `facts` row's body finally read the symbol payload its
    // own TITLE had promised since it was written. That row is the reason this
    // count moved and the reason it is a count: the audit reads the clauses
    // COMMON to all eight rows, so a claim unique to one row lives in its title
    // and had no reader. The number is measured, not adjusted to fit.
    //
    // 64 -> 81 when `federation` joined every boundary type: one new isFrozen
    // argument in each of the seven existing witness bodies (the shared
    // sessionServer test carries two and is audited once per route it
    // witnesses), plus the seven arguments of the new `applyFederationChoice`
    // witness.
    //
    // 81 -> 92 when the save codec's `decodeSavedGame` row arrived (Sprint 2):
    // its witness reads eleven arguments, because a decoded record is the one
    // producer whose arrays arrive from JSON.parse thawed — it asserts both
    // array shells, an element of each, and the entitlement, where the other
    // rows' fixtures inherit those from an already-sealed input.
    expect(frozen, 'Object.isFrozen arguments read out of the witness bodies').toBe(92);

    // AND THE DEPTH THE LEDGER DOES NOT REACH, TABULATED RATHER THAN CLAIMED.
    // One array element down — `meets[0]`, where a stored meet's Total lives —
    // cannot be required of every row: `newServerRecord` produces an empty
    // `meets`, so there is no element to freeze and a universal requirement
    // would be a demand no fixture can meet. Two rows do reach it. That is
    // written down as the set rather than left to a sentence, so deleting one
    // is red and adding a third is a deliberate line. `sessionServer.test.ts`
    // covers the wire's element in a separate test ('seals a meet inside the
    // wire, one array element down') which this ledger does not name.
    //
    // The third line was drawn deliberately (Sprint 2): `decodeSavedGame` is
    // the producer where element depth does the most work, because its meets
    // rows come out of JSON.parse writable rather than inherited from a
    // sealed fixture.
    expect(
      audits.filter((audit) => audit.freezesElement).map((audit) => audit.route).sort(),
      'the rows whose witness reaches one array element down',
    ).toEqual([
      'record src/game/meetPreview.ts previewServerRecord',
      'record src/game/meetServer.ts applyMeetResult',
      'record src/game/saveGame.ts decodeSavedGame',
    ]);
  });

  it('seals every record and wire §7.5 finds in shipped code [every-shipped-route-is-sealed]', () => {
    const scan = routeScan();

    // THE THIRD QUESTION ASKED OF §7.5'S DERIVED SET. The two above ask whether
    // the table's rows and the scan's rows are the same set. This asks whether
    // each literal the scan found is handed to `sealServerValue` — which is what
    // makes a NEW construction site have to be sealed rather than merely
    // documented, without anyone maintaining a list of seal sites.
    expect(
      scan.unsealed,
      'a record or wire is built in shipped code and not sealed — pass it to sealServerValue',
    ).toEqual([]);

    // NON-VACUITY, AS A COUNT AND NOT A BOUND. An empty domain passes the line
    // above perfectly: a scan that found nothing, or one whose `SEAL_NAME` no
    // longer matches any callee, reports zero unsealed sites and looks green.
    // Eight is §7.5's six `record` rows, its one `wire` row, and the `facts`
    // row — the snapshot mint, which reached this count by having its
    // `deepFreeze` call respelled as the seal it already was.
    // 9 -> 10: decodeSavedGame's record literal is passed to sealServerValue.
    expect(scan.sealedLiterals, 'shipped record/wire/facts literals seen sealed').toBe(10);

    // AND THE CALLEE IS THE SEAL, NOT A FUNCTION SPELLED LIKE IT.
    //
    // This replaces a line that compared the row-count sum against
    // `sealedLiterals`. Both sides were written in the same branch over the same
    // node set, so the identity held by construction and could not be red while
    // `unsealed` was empty — a check that restates its subject rather than
    // grading it. What goes here instead is the question that line could not
    // ask, and the one a measured mutant walked through: a local
    //
    //     const sealServerValue = <T,>(value: T): T => value;
    //
    // beside an aliased real import left the old text-match check reporting all
    // seven literals sealed, `tsc` at exit 0 and 202 tests green. The scan now
    // resolves each callee to its DECLARATION, and this pins the exact set of
    // files those declarations live in — so the shim shows up as a second
    // member naming its own file, whether or not `isSealedAt` still filters.
    // An exact set and not `toContain`: an empty set is red here, which is what
    // makes it a non-vacuity guard for the resolution rather than a restatement
    // of it.
    expect(
      scan.sealCalleeSources,
      'a shipped call to sealServerValue resolves somewhere other than the seal',
    ).toEqual(['src/game/progression.ts']);
    // NINE AND NOT EIGHT: the mint calls the seal twice, once on the
    // `ConfirmedFacts` literal — the row above — and once on the opaque
    // `ProgressionSnapshot` that carries it. The snapshot is not a scan target
    // and never can be, its only property being a module-private symbol.
    //
    // THE EXCUSE THAT USED TO SIT HERE IS DELETED BECAUSE IT WAS FALSE. It read
    // "no test can name what is under it and no `Object.isFrozen` assertion can
    // reach one level down", and this file disproves it about 900 lines below:
    // the `PAIRING_CHECKED` test walks `getOwnPropertySymbols` and asserts on
    // the payload underneath, and `progression.ts` calls that "the
    // SNAPSHOT_CONTENTS idiom". A guard written for the copy and not for the
    // original — the two module-private symbols of one module, in one test
    // file. The `facts` witness now does the same thing to the snapshot, so
    // "sealed by name and counted here" is no longer the whole of the evidence:
    // a string-only walk in `deepFreeze` reddens it.
    // 10 -> 11 with saveGame.ts's one seal.
    expect(scan.sealCallSites.length, 'shipped sealServerValue call sites').toBe(11);

    // AND THE NAME THE SCAN MATCHES ON IS A REAL EXPORT. Without this, renaming
    // the seal turns the whole check into "no literal is sealed, and none is
    // required to be" — green, and measuring nothing.
    expect(Object.keys(progressionModule)).toContain('sealServerValue');
  });

  it('rules test fixtures out of §7.5 rather than matching none of them', async () => {
    // THE EXCLUSION IS A RULING, NOT A FILTER THAT QUIETLY FINDS NOTHING — the
    // guard `realIp.test.ts` puts on its own omission list. Fixtures are out
    // because `meetServer.test.ts` and `sessionClient.test.ts` build a dozen
    // records between them and every new one would make §7.5 red, which trains
    // exactly the "edit the number" reflex the table exists to prevent. A
    // fixture also reaches no player and persists nothing.
    //
    // What this asserts is that the scan SEES them, so the exclusion is a
    // decision about a set that exists.
    //
    // A COUNT AND NOT A BOUND, AND THE COST IS NAMED RATHER THAN DODGED. §7.5's
    // header argues that pinning fixtures would make the table churn on work
    // that has nothing to do with it, and that is true OF A TABLE OF ROWS,
    // where the churn is a merge conflict on a nine-column list. This is one
    // integer. What the bound could not do is notice the scan collapsing from
    // twenty-one fixtures to six — every assertion in this test would still
    // pass, because they all ask about fixtures the scan already found. Adding
    // a fixture record moves this number and the diff is one character.
    //
    // 21 -> 22 with `meetDay.test.ts`'s `recordHolding`, the fixture GDD §6.5's
    // per-lift call-out needed: a lifter who walks onto the platform already
    // holding numbers, so a recap has a record to beat and not only a first one
    // to set.
    // 22 -> 24 with `careerServer.test.ts`'s two `receive` rows: `cacheFor`,
    // the fixture that reads a boundary-swept row back through the one door,
    // and the choose-federation test that decodes the choice's own wire.
    // 24 -> 25 with saveGame.test.ts's injured-rung record spread — a fixture,
    // seen and correctly discarded.
    expect(routeScan().fixtures.length, 'fixture rows the scan sees and discards').toBe(25);
    expect(routeScan().fixtures.map((row) => row.file)).toContain('src/game/meetServer.test.ts');
    // ...and no fixture leaked into the pinned table.
    expect(declaredRoutes().filter((row) => IS_TEST_FILE.test(row.file))).toEqual([]);

    // AND EVERY DISCARDED ROW IS DISCARDED INTO SOMETHING THAT RUNS. This is the
    // §7.5 half of the same-set pin below: a route in a file vitest never
    // executes is not "a fixture read by the same reviewer as the assertion
    // beside it", it is a route nothing looks at. Stated here as well as in the
    // sweep because these are two different discards of the same set and the
    // gap that produced this pin was that both were justified by one argument.
    const executed = new Set(await filesVitestRuns());
    expect(executed.size, 'vitest reports no test files at all').toBeGreaterThan(50);
    for (const row of routeScan().fixtures) {
      expect(
        executed.has(row.file),
        `${row.file} builds a ${row.kind} in ${row.site}, §7.5 discards it as a fixture, and vitest does not run it`,
      ).toBe(true);
    }
  });

  it('drops from the sweep exactly the files vitest runs', async () => {
    // THE TWO SETS, ASSERTED EQUAL. This is the gap this round closes and it is
    // worth stating as two names rather than one predicate:
    //
    //   "excluded because it is a test"  — `sweptFiles`, via `IS_TEST_FILE`
    //   "actually run as a test"         — `vitest.config.ts`'s `include`
    //
    // They were different sets and nothing said so. `/\.test\.tsx?$/` here,
    // against an `include` there that names only `.test.ts` under `src/`,
    // differs by every `*.test.tsx` anywhere and every `*.test.ts` outside
    // `src/` — files the project COMPILES (so `scannedFiles` holds them), which
    // the reflective sweep drops, which §7.5 routes to `fixtures` and discards,
    // which `src/tuning/audit.ts`'s magic-number auditor drops on the identical
    // regex, and which Expo's default `sourceExts` would BUNDLE. Verified by
    // execution before it was fixed: a `src/card/seed.test.tsx` holding
    // `const seeded: ServerRecord = { ...newServerRecord(SIGNUP_DAY), totalKg: 900 }`
    // type-checked clean and left the suite green at the counts it had without
    // the file (57 files, 2437 tests).
    //
    // The justification for the exemption was an argument about reachability —
    // "a test fixture reaches no player, persists nothing, and is read by the
    // same reviewer as the assertion beside it". Both clauses are true of a
    // `.test.ts` under `src/` that vitest runs, and the exemption is NECESSARY
    // for those: banning the idiom in the files that prove the ban is circular.
    // Neither clause is true of a file nothing executes. Rather than argue the
    // line, the line is now derived: the sweep may drop a file if and only if
    // vitest runs it.
    //
    // AND THE RIGHT-HAND SIDE IS ASKED, NOT RESTATED. `filesVitestRuns()` calls
    // vitest's own config loader and its own `globTestSpecifications()`, so a
    // change to `include`, `exclude`, or the project list cannot silently widen
    // what this file is allowed to skip.
    const scan = routeScan();
    const swept = new Set(sweptFiles(scan));
    const dropped = scan.scannedFiles.filter((file) => !swept.has(file));
    const executed = await filesVitestRuns();

    // Non-vacuity in both directions before the comparison, so "equal" cannot be
    // two empty sets or one narrow one.
    expect(executed.length, 'vitest reports no test files at all').toBeGreaterThan(50);
    expect(dropped.length, 'the sweep drops nothing').toBeGreaterThan(20);
    // The strongest available anchor on the right-hand side: the file this
    // assertion is written in is, demonstrably, being run. If the glob were
    // wrong or empty, this catches it without trusting the comparison.
    const running = expect.getState().testPath ?? '';
    expect(running, 'vitest did not report a path for the running file').not.toBe('');
    expect(executed, 'vitest does not list the file it is currently running').toContain(
      path.relative(REPO_ROOT, running).split(path.sep).join('/'),
    );

    // Both directions in one statement, which is the point. A file dropped and
    // not run fails; a file run and not dropped fails.
    expect(dropped).toEqual([...executed]);
  });

  it('lets no file the sweep covers import one it drops', () => {
    // THE OTHER HALF OF THE SAME GAP. Asserting the dropped set equals the run
    // set says the skipped files are executed and reviewed; it does not say
    // shipped code cannot REACH one. Nothing stops `src/game/foo.ts` importing
    // `./foo.test` today — Expo's default `sourceExts` resolves `./seed` to
    // `seed.test.tsx` with no `metro.config.js` and no `blockList` in the tree —
    // and a dropped file is, by construction, one no guard in this file reads.
    //
    // THE EDGES COME FROM THE CHECKER. See `RouteScan.importEdges`: round nine's
    // defect was a hand-rolled answer to "what counts as an import", so this one
    // is TypeScript's.
    const scan = routeScan();
    const swept = new Set(sweptFiles(scan));
    const dropped = new Set(scan.scannedFiles.filter((file) => !swept.has(file)));

    // Non-vacuity, anchored on one edge of each spelling that has ever been
    // missed here, plus one from a dropped file so the scan is not silently
    // one-directional.
    expect(scan.importEdges.length, 'the edge scan resolved nothing').toBeGreaterThan(100);
    expect(scan.importEdges, 'static import').toContain(
      'src/game/sessionClient.ts -> src/game/progression.ts',
    );
    expect(scan.importEdges, 'dynamic await import()').toContain(
      'src/card/cardEntry.tsx -> src/card/ResultCardScreen.tsx',
    );
    expect(scan.importEdges, 'bare export * from').toContain('src/art/index.ts -> src/art/rig.ts');
    expect(scan.importEdges, 'an edge out of a dropped file').toContain(
      'src/game/progression.test.ts -> src/game/progression.ts',
    );

    const reaching = scan.importEdges.filter((edge) => {
      const [importer, target] = edge.split(' -> ');
      return importer !== undefined && target !== undefined && swept.has(importer) && dropped.has(target);
    });
    expect(
      reaching,
      'a file the sweep covers resolves an import to one it drops — the dropped file is compiled, bundled and read by no guard here',
    ).toEqual([]);
  });

  it('counts routes from parsed code, so a sentence about one is not one', () => {
    // The control that makes the two-way pin worth running. `sessionClient.ts`
    // names `ServerRecord` three times — all of them in prose, saying it holds
    // none — and builds zero. A scan that could be fooled by a comment would
    // report a route there.
    const client = readFileSync(
      fileURLToPath(new URL('./sessionClient.ts', import.meta.url)),
      'utf8',
    );
    expect(client).toMatch(/ServerRecord/);
    expect(codeOnly(client)).not.toMatch(/ServerRecord/);
    expect(routeScan().shipped.filter((row) => row.file === 'src/game/sessionClient.ts' && row.kind === 'record')).toEqual(
      [],
    );
    // And the same file DOES appear for what it really does — call the door —
    // so the absence above is discrimination, not a blind spot.
    expect(sortedKeys(routeScan().shipped)).toContain('receive src/game/sessionClient.ts receiveSnapshot x1');
  });

  it('lets no file the project compiles assemble an object reflectively, except by name', () => {
    // THE RESIDUAL THE LITERAL SWEEP CANNOT SEE. `Object.assign({}, record,
    // { totalKg: 900 })` produces a record with no object literal for the
    // checker to type: the `{}` is not a `ServerRecord` and neither is the
    // patch. Same for `structuredClone` and for anything laundered through
    // `as unknown as`.
    //
    // IT RUNS OVER EVERY NON-TEST FILE THE PROJECT COMPILES, and the scoping
    // that used to stand in front of it is deleted rather than repaired. See
    // `scanRoutes`'s "THERE IS NO CANDIDATE SET" note for the two constructs the
    // old import check missed and how the two checks composed to zero on a file
    // that used either. This is a guard against under-scoping; scoping it was
    // self-defeating.
    //
    // WHAT IT IS NOT is a closure over "a record assembled without a literal".
    // It is four string patterns. §7.5 residual 1 lists what walks past them.
    const swept = sweptFiles(routeScan());

    // Non-vacuity, anchored on the files the old scoping DROPPED and on the
    // three the whole boundary is built around.
    expect(swept.length).toBeGreaterThan(100);
    expect(swept).toContain('src/game/sessionServer.ts');
    expect(swept).toContain('src/session/sessionPreview.ts');
    expect(swept).toContain('src/game/meetPreview.ts');
    expect(swept).toContain('src/card/cardEntry.tsx');
    expect(swept).toContain('src/art/index.ts');
    expect(swept).toContain('App.tsx');

    // The patterns fire. Three of the four have no live occurrence anywhere in
    // the repository, so without this a typo in any of them would make the sweep
    // pass by matching nothing — the exemption table below is the positive
    // control for `as unknown as` and cannot be one for these.
    const SYNTHETIC_FORGERY =
      'const a = Object.assign({}, rec, { totalKg: 900 }); ' +
      'const b = structuredClone(rec); ' +
      'const c = payload as unknown as ServerRecord; ' +
      'const d = payload as any as ServerRecord;';
    for (const { idiom, pattern } of REFLECTIVE_ASSEMBLY) {
      expect(SYNTHETIC_FORGERY, `the ${idiom} pattern matches nothing`).toMatch(pattern);
    }

    const found: string[] = [];
    const foundLines: string[] = [];
    for (const file of swept) {
      const code = codeOnly(readFileSync(path.join(REPO_ROOT, file), 'utf8'));
      for (const { idiom, pattern } of REFLECTIVE_ASSEMBLY) {
        const hits = code.match(new RegExp(pattern.source, 'g'));
        if (hits !== null) found.push(`${file} ${idiom} x${hits.length}`);
        // AND WHICH LINE, so a swap inside one file cannot hold the count still.
        // `pattern` is deliberately non-global (see `REFLECTIVE_ASSEMBLY`), so
        // `.test` in this loop carries no `lastIndex`.
        for (const line of code.split('\n')) {
          if (pattern.test(line)) foundLines.push(`${file} ${idiom} :: ${normalizedLine(line)}`);
        }
      }
    }
    const excused = REFLECTIVE_ASSEMBLY_EXEMPTIONS.map((row) => `${row.file} ${row.idiom} x${row.n}`);
    const excusedLines = REFLECTIVE_ASSEMBLY_EXEMPTIONS.flatMap((row) =>
      row.lines.map((line) => `${row.file} ${row.idiom} :: ${line}`),
    );

    // Both directions, in the shape §7.5's route table uses. An unexcused
    // occurrence goes red; so does an excuse for an occurrence that is gone,
    // because a stale exemption is a hole somebody else can move into.
    const excusedKeys = new Set(excused);
    for (const hit of found) {
      expect(
        excusedKeys.has(hit),
        `${hit} — a non-test file the project compiles assembles an object reflectively, and REFLECTIVE_ASSEMBLY_EXEMPTIONS does not name it at that count`,
      ).toBe(true);
    }
    const foundKeys = new Set(found);
    expect(excused.length, 'the exemption list is empty, so it proves nothing fired').toBeGreaterThan(0);
    for (const row of excused) {
      expect(
        foundKeys.has(row),
        `REFLECTIVE_ASSEMBLY_EXEMPTIONS names ${row} and the sweep does not find it — delete the row or fix the count`,
      ).toBe(true);
    }

    // AND THE SAME TWO DIRECTIONS ON THE LINE ITSELF. The count pin is exact
    // about HOW MANY and blind to WHICH: deleting `blendPose`'s cast and adding
    // a different one elsewhere in `rig.ts` leaves the count at 1. That is
    // §7.5's residual 4 applied to this table, and it is closed here rather than
    // left as a bound.
    expect(excusedLines.length, 'no exemption names the line it excuses').toBeGreaterThan(0);
    const excusedLineKeys = new Set(excusedLines);
    for (const hit of foundLines) {
      expect(
        excusedLineKeys.has(hit),
        `${hit} — REFLECTIVE_ASSEMBLY_EXEMPTIONS excuses this file and idiom but not this line, so an excused occurrence has been swapped for a different one`,
      ).toBe(true);
    }
    const foundLineKeys = new Set(foundLines);
    for (const row of excusedLines) {
      expect(
        foundLineKeys.has(row),
        `REFLECTIVE_ASSEMBLY_EXEMPTIONS names ${row} and the sweep does not find that line — the excused occurrence moved or was rewritten, so re-read it`,
      ).toBe(true);
    }
  });

  it('sweeps every non-test file the project compiles, with no import check in the way', () => {
    // ROUND NINE'S DEFECT, PINNED BY NAME, in the shape "scans the whole
    // project, not just src/" uses for round seven's.
    //
    // The sweep above ran over a computed candidate set whose implementation
    // walked `source.forEachChild` for `ImportDeclaration` / `ExportDeclaration`
    // with a non-empty clause. Two constructs fell straight through, and both
    // are house idioms here rather than curiosities. A future narrowing back to
    // any predicate at all fails here with the file it dropped.
    const scan = routeScan();
    const swept = sweptFiles(scan);
    expect(swept).toEqual(scan.scannedFiles.filter((file) => !IS_TEST_FILE.test(file)));
    expect(scan.scannedFiles.length - swept.length, 'no test file was excluded').toBeGreaterThan(20);

    const codeOf = (file: string): string => codeOnly(readFileSync(path.join(REPO_ROOT, file), 'utf8'));

    // (1) DYNAMIC `import()` — a `CallExpression` in a function body, invisible
    //     to a top-level `ImportDeclaration` walk. Everything downstream of the
    //     Skia WASM boot is loaded this way, so this is not a hypothetical.
    //     Each anchor is paired with the construct that used to hide it: if one
    //     stops using `await import(`, this says so and a new anchor is owed.
    for (const file of ['index.ts', 'src/card/cardEntry.tsx', 'src/licensing/licensingEntry.tsx']) {
      expect(swept, `${file} is not swept`).toContain(file);
      expect(codeOf(file), `${file} no longer uses await import() — pick another anchor`).toMatch(
        /await import\(/,
      );
    }

    // (2) BARE `export * from` — `exportClause === undefined`, dropped one line
    //     after the node-kind filter. `src/art/index.ts` is fourteen of them.
    expect(swept).toContain('src/art/index.ts');
    expect(codeOf('src/art/index.ts'), 'src/art/index.ts no longer bare-re-exports').toMatch(
      /^export \* from '/m,
    );

    // (3) AND A FILE WITH NO ROUTE TO THE BOUNDARY AT ALL is swept too, which is
    //     the point of having no predicate. `src/licensing/realIp.ts` spells
    //     `ServerRecord` in a watchlist string and imports nothing that can
    //     produce one; under the old scoping it was explicitly out.
    expect(swept).toContain('src/licensing/realIp.ts');
  });

  it('mints server truth in exactly one place', () => {
    // The private symbol is what makes `ProgressionSnapshot` unforgeable, so
    // the number of places that write it is the number of doors there are.
    // Expected: the interface declaration, and the one construction inside
    // `receiveProgressionSnapshot`.
    //
    // COMMENTS ARE STRIPPED FIRST. They were not, and the count was therefore a
    // count of MENTIONS: a header paragraph that named the key inflated it and
    // failed this test, and — the direction that matters — deleting a real write
    // could have been masked by adding a sentence about it.
    const code = codeOnly(MODULE_SOURCE);
    const writes = code.match(/\[SNAPSHOT_CONTENTS\]:/g) ?? [];
    expect(writes).toHaveLength(2);

    // AND WHICH LINES, NOT ONLY HOW MANY. The count is exact about how many and
    // blind to which: deleting the mint and writing the key somewhere else in
    // this 4000-line module holds the total at 2 and stays green, which defeats
    // the whole point of pinning the number of doors. §7.5's
    // `REFLECTIVE_ASSEMBLY_EXEMPTIONS` had this exact defect and closed it by
    // pinning the matched LINE beside the count; this is that fix carried to
    // its two siblings, which is where it should have gone at the time. Both
    // lines are named, so a swap has to rewrite one of them in the diff.
    expect(
      code.split('\n').filter((line) => /\[SNAPSHOT_CONTENTS\]:/.test(line)).map(normalizedLine),
      'the lines that write the snapshot key — a swap holds the count and moves the door',
    ).toEqual(['readonly [SNAPSHOT_CONTENTS]: SnapshotContents;', '[SNAPSHOT_CONTENTS]: {']);
  });

  it('mints the in-flight pairing in exactly one place', () => {
    // `InFlightProposal`'s only property is `[PAIRING_CHECKED]`, and the triple
    // lives UNDER it. That is what stops a caller hand-assembling a `pending`
    // cache and skipping `validateProposal`, `validateProjection` and
    // `projectionExceedsReach` — the three checks that are properties of the
    // pairing. A second mint would be a second way past those three.
    //
    // NOT all five: the in-flight limit and the stale-cache rule are properties
    // of the CACHE, and §6 of the header carries that as an open residual. The
    // sentence that used to be here said five, and saying five is how the last
    // hole got called closed.
    //
    // Expected: the interface declaration, and the one construction inside
    // `proposeChange`.
    const code = codeOnly(MODULE_SOURCE);
    const writes = code.match(/\[PAIRING_CHECKED\]:/g) ?? [];
    expect(writes).toHaveLength(2);

    // AND WHICH LINES, for the reason the snapshot key's sibling pin above
    // gives: a count of 2 survives deleting this mint and adding the key
    // anywhere else in the module.
    expect(
      code.split('\n').filter((line) => /\[PAIRING_CHECKED\]:/.test(line)).map(normalizedLine),
      'the lines that write the pairing key — a swap holds the count and moves the door',
    ).toEqual([
      'readonly [PAIRING_CHECKED]: CheckedPairing;',
      'inFlight: { [PAIRING_CHECKED]: { proposalId, proposal, projection } },',
    ]);

    // And it is a real `unique symbol`, not a string key a caller could guess.
    expect(code).toMatch(/const PAIRING_CHECKED: unique symbol = Symbol\(/);
    expect(code).not.toMatch(/export const PAIRING_CHECKED/);
  });

  it('keeps the in-flight pairing opaque, not branded', () => {
    // The runtime half of `AN_IN_FLIGHT_PROPOSAL_HAS_NO_STRING_KEY`, which is a
    // type-level `const ... = true` and therefore invisible to vitest once
    // esbuild has stripped it. A branded `InFlightProposal` — contents beside the
    // symbol rather than under it — is the shape the forgery in §6 of the header
    // exploited, and it is the shape this refuses.
    const pending = expectOk(
      proposeChange(confirmedCache(), asProposalId('p-shape'), A_PROPOSAL, emptyProjection()),
    );
    if (pending.status !== 'pending') {
      throw new Error('expected a pending cache');
    }
    // No string keys at all: nothing for a spread to overwrite.
    expect(Object.keys(pending.inFlight)).toEqual([]);
    // Exactly one symbol key, and the payload is under it.
    const symbols = Object.getOwnPropertySymbols(pending.inFlight);
    expect(symbols).toHaveLength(1);
    const held = (pending.inFlight as unknown as Record<symbol, Record<string, unknown>>)[symbols[0]!];
    expect(Object.keys(held ?? {}).sort()).toEqual(['projection', 'proposal', 'proposalId']);
  });

  it('does not cast its way past its own boundary', () => {
    const withoutComments = MODULE_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(withoutComments).not.toMatch(/as unknown as/);
    expect(withoutComments).not.toMatch(/as ProgressionSnapshot/);
    expect(withoutComments).not.toMatch(/\bany\b/);
  });

  it('keeps the pay-to-win guard derived, in source, where vitest cannot see it', () => {
    // Every assertion in this module is a type-level `const ... = true`. esbuild
    // strips the types, so `npm test` runs a file in which they are all just
    // `true` — deleting one, or replacing the derived union with the literal
    // union it used to be, would not fail a single test. There is no CI
    // workflow, so the only other thing that would notice is a human running
    // `npm run typecheck`. This scan is what makes the source itself the thing
    // under test, the way dots.test.ts pins its branded signatures.
    const code = MODULE_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    // Sanity: the comment strip left real code behind, so the scans below are
    // looking at something.
    expect(code).toContain('export function receiveProgressionSnapshot');

    // The purchasable set is COMPUTED from the origin map...
    expect(code).toMatch(
      /export type PurchasableProposalKind = \{\s*\[K in ProgressionProposalKind\]: \(typeof PROPOSAL_ORIGIN_BY_KIND\)\[K\] extends 'purchase' \? K : never;\s*\}\[ProgressionProposalKind\];/,
    );
    // ...and is not a hand-written union of kind names, which is what it was.
    expect(code).not.toMatch(/export type PurchasableProposalKind\s*=\s*'/);

    // The origin map stays exhaustive and stays literal. Losing `as const`
    // widens its values and collapses the derivation to `never`.
    expect(code).toMatch(/as const satisfies Readonly<Record<ProgressionProposalKind, ProposalOrigin>>/);

    // THE SAME MECHANISM ON THE OTHER OPERAND. `PROTECTED_CONCERNS` is derived
    // from an exhaustive per-fact declaration, not written out as a list — a
    // list has a default, and that default was `unprotected`.
    expect(code).toMatch(/as const satisfies Readonly<Record<ProgressionFactKey, FactProtection>>/);
    expect(code).toMatch(
      /export const PROTECTED_CONCERNS: readonly ProtectedConcern\[\] = PROGRESSION_FACT_KEYS\.filter\(isProtectedFact\);/,
    );
    // ...and is not a hand-written list of fact names, which is what it was.
    expect(code).not.toMatch(/export const PROTECTED_CONCERNS\s*=\s*\[/);
    // The removed assertion stays removed: it could not fail, and keeping a name
    // that reads like enforcement over a tautology is what this replaced.
    expect(code).not.toMatch(/NOTHING_MOVES_TRAINING_PACE/);

    // The assertions the derivation feeds, each named so a deletion is visible.
    const requiredAssertions = [
      /export const PROPOSAL_ORIGIN_COVERS_EVERY_KIND: KeysAreExactly</,
      /export const PURCHASES_CANNOT_REACH_PROTECTED_CONCERNS: AreDisjoint</,
      /export const PURCHASE_REACH_IS_NOT_VACUOUS: IsNonEmptyUnion</,
      /export const PURCHASABLE_KINDS_ARE_NOT_VACUOUS: IsNonEmptyUnion</,
      /export const MONEY_ON_THE_WIRE_IS_DECLARED_A_PURCHASE: IsSubsetOf</,
      /export const MONEY_CARRYING_KINDS_ARE_NOT_VACUOUS: IsNonEmptyUnion</,
      // GDD §6.4: a Total is the sum of best successful competition attempts, so
      // exactly one proposal kind may move it. Deleting this leaves the reach
      // map free to hand `'totalKg'` back to a training session.
      /export const ONLY_A_MEET_RESULT_MOVES_TOTAL: UnionIsExactly</,
      // The bindings that make the two disjointness checks above mean something:
      // both of their operands name facts that exist, not strings that look
      // like facts. Deleting one leaves a reach map bound to nothing while the
      // disjointness check keeps passing by spelling.
      /export const PROPOSAL_REACH_NAMES_REAL_FACTS: IsSubsetOf</,
      /export const ENTITLEMENT_REACH_NAMES_REAL_FACTS: IsSubsetOf</,
      // THE RIGHT-HAND OPERAND, which had none of this. It was a hand-written
      // list whose default was `unprotected`, so a new fact was buyable unless
      // someone remembered to protect it. These five are the exhaustive
      // declaration, its exhaustiveness binding, the non-vacuity guard the
      // operand never had, and the two checks that make answering `'open'` cost
      // something.
      /export const FACT_PROTECTION_COVERS_EVERY_FACT: KeysAreExactly</,
      /export const PROTECTED_CONCERNS_ARE_NOT_VACUOUS: IsNonEmptyUnion</,
      /export const OPEN_FACTS_ARE_EXACTLY_WHAT_A_PURCHASE_MAY_REACH: UnionIsExactly</,
      /export const NO_OPEN_FACT_NAMES_PERFORMANCE: AreDisjoint</,
      // GDD §8.1's training-pace line, held over the FACT SET rather than over
      // one hard-coded spelling that no reach could ever contain.
      /export const NO_FACT_MEANS_TRAINING_PACE: IsEmptyUnion</,
      /export const PERFORMANCE_NAMED_FACTS_ARE_NOT_VACUOUS: IsNonEmptyUnion</,
    ];
    for (const assertion of requiredAssertions) {
      expect(code).toMatch(assertion);
    }

    // And the payload cross-check reads the report types rather than a list of
    // kinds, so it cannot be satisfied by editing the same list twice.
    expect(code).toMatch(/Extract<keyof ReportFor<K>, PurchaseEvidenceKey>/);
  });
});

// ---------------------------------------------------------------------------
// The allowlists, checked against live objects rather than against themselves
// ---------------------------------------------------------------------------

describe('the fact allowlist', () => {
  it('is exactly the keys a live snapshot carries', () => {
    const facts = snapshotFacts(snapshot());
    expect(Object.keys(facts).sort()).toEqual([...PROGRESSION_FACT_KEYS].sort());
  });

  it('answers the buyable question for every fact, from one map', () => {
    // The subject of everything below. `PROTECTED_CONCERNS` used to be a
    // hand-written list, which meant a new fact defaulted to UNPROTECTED and no
    // check in the module was looking at the fact set at all. This is the
    // runtime half of `FACT_PROTECTION_COVERS_EVERY_FACT`: a fact with no answer
    // fails `npm test` as well as `npm run typecheck`.
    expect(Object.keys(FACT_PROTECTION).sort()).toEqual([...PROGRESSION_FACT_KEYS].sort());
    for (const key of PROGRESSION_FACT_KEYS) {
      expect(FACT_PROTECTION_KINDS as readonly string[]).toContain(FACT_PROTECTION[key]);
    }
  });

  it('derives the protected set from that map rather than restating it', () => {
    // `PROTECTED_CONCERNS` and `OPEN_FACTS` are computed by the module through
    // type predicates, which `tsc` cannot check against the conditional types
    // they mirror. This recomputes both straight off the map, so the drift a
    // compiler cannot see is the one a test does — the same treatment
    // `PURCHASABLE_PROPOSAL_KINDS` gets.
    const protectedFromMap = PROGRESSION_FACT_KEYS.filter((key) => FACT_PROTECTION[key] === 'protected');
    const openFromMap = PROGRESSION_FACT_KEYS.filter((key) => FACT_PROTECTION[key] === 'open');
    expect([...PROTECTED_CONCERNS].sort()).toEqual([...protectedFromMap].sort());
    expect([...OPEN_FACTS].sort()).toEqual([...openFromMap].sort());
    // And the two are a PARTITION of the facts: no fact in both, no fact in
    // neither. A fact in neither is the old default coming back by another road.
    expect([...PROTECTED_CONCERNS, ...OPEN_FACTS].sort()).toEqual([...PROGRESSION_FACT_KEYS].sort());
    // Non-vacuity in BOTH directions, which is what the module's
    // `PROTECTED_CONCERNS_ARE_NOT_VACUOUS` does at the type level. An empty
    // protected set makes every pay-to-win check below pass over nothing; an
    // empty open set means Recovery Days and Chalk cannot be sold at all, which
    // satisfies the prohibition perfectly and breaks the product.
    expect(PROTECTED_CONCERNS.length).toBeGreaterThan(0);
    expect(OPEN_FACTS.length).toBeGreaterThan(0);
  });

  it('names Total, e1RM and meet results as protected', () => {
    // CONTAINMENT, NOT EQUALITY, and the asymmetry with the open set below is
    // deliberate. Protecting a new fact is the SAFE direction — it can only stop
    // a purchase reaching something — so a `toEqual` here would fail every
    // addition of a protected fact and put friction on the answer §8.1 wants
    // people to give. What must hold is that the three facts GDD §8.1 names are
    // on the list; that the list is total over the facts is
    // `FACT_PROTECTION_COVERS_EVERY_FACT`'s job, and that it is non-empty is
    // `PROTECTED_CONCERNS_ARE_NOT_VACUOUS`'.
    //
    // The open set is pinned exactly, because THERE the exactness is the guard.
    for (const concern of ['totalKg', 'bestE1rmKg', 'meets']) {
      expect(PROTECTED_CONCERNS as readonly string[]).toContain(concern);
    }
  });

  it('leaves streak and wallet open on purpose, and nothing else yet', () => {
    // Recovery Days are purchasable and do move a streak (GDD §4.2, §8.2);
    // buying Chalk moves a balance by definition. Protecting them here would be
    // a lie the code could not keep.
    //
    // THE EQUALITY IS THE TRIPWIRE FOR THE RESIDUAL IN §6 OF THE MODULE HEADER,
    // not decoration. The compile-time guards can be walked past by an author
    // who makes three coordinated edits AND picks a fact name bland enough to
    // dodge `PERFORMANCE_FACT_VOCABULARY` — `simRunsAllowed`, declared `'open'`,
    // on a purchase's reach row and in `EntitlementReach.convenience`, was
    // verified to compile clean. This line is what fails on it.
    //
    // It lives in the test rather than as a type-level assertion ON PURPOSE. A
    // `UnionIsExactly<OpenFactKey, 'streak' | 'wallet'>` in the module would
    // refuse a legitimately open fact too — GDD §8.3A's cosmetics business will
    // plausibly want one — and a guard that refuses the product is satisfied
    // best by a worse artifact. As a test expectation it is the same instrument
    // as the export-surface `toEqual` below: adding one is allowed, doing it by
    // accident is not.
    expect([...OPEN_FACTS].sort()).toEqual(['streak', 'wallet']);
    expect(PROTECTED_CONCERNS).not.toContain('streak');
    expect(PROTECTED_CONCERNS).not.toContain('wallet');
  });

  it('has no fact that names training pace, and can tell', () => {
    // The runtime half of `NO_FACT_MEANS_TRAINING_PACE` (GDD §8.1, §12.3). The
    // assertion it mirrors passes over an EMPTY set by design, so the control
    // comes first: the scan must be able to catch the fact that motivated it.
    // `simSessionsPerDay` is the name that shipped a purchasable training-pace
    // fact past a clean `tsc` and all 1104 tests.
    expect(vocabularyHits('simSessionsPerDay', PERFORMANCE_FACT_VOCABULARY.pace)).not.toEqual([]);
    expect(PERFORMANCE_FACT_VOCABULARY.pace.length).toBeGreaterThan(0);
    for (const key of PROGRESSION_FACT_KEYS) {
      expect(vocabularyHits(key, PERFORMANCE_FACT_VOCABULARY.pace)).toEqual([]);
    }
  });

  it('lets no fact that names performance be bought', () => {
    // The runtime half of `NO_OPEN_FACT_NAMES_PERFORMANCE`. A fact MAY name
    // performance — `totalKg` and `bestE1rmKg` do, and must — it just may not
    // then be open. The control is that some real fact still trips the scan,
    // which is `PERFORMANCE_NAMED_FACTS_ARE_NOT_VACUOUS` at runtime: a
    // vocabulary that had drifted off the facts would make this pass over
    // nothing.
    const named = PROGRESSION_FACT_KEYS.filter((key) => vocabularyHits(key, EVERY_PERFORMANCE_WORD).length > 0);
    expect(named.length).toBeGreaterThan(0);
    for (const fact of OPEN_FACTS) {
      expect(vocabularyHits(fact, EVERY_PERFORMANCE_WORD)).toEqual([]);
    }
    // And the blocklist is weaker than the map above; it is here as the second,
    // dumber check, exactly as `PURCHASE_EVIDENCE_KEYS` is for the origin map.
    for (const fact of OPEN_FACTS) {
      expect(fact).not.toMatch(/bonus|multiplier|boost|pace/i);
    }
  });

  it('keeps the Recovery Day ledger out of the wallet', () => {
    // One consumable, one ledger. `streak.ts` holds it, with the per-absence
    // ceiling and the window rate attached.
    expect([...WALLET_CURRENCIES]).toEqual(['gymBucks', 'chalk']);
    const facts = snapshotFacts(snapshot());
    expect(Object.keys(facts.wallet)).not.toContain('recoveryDays');
    expect(facts.streak.entitlement.coveredDaysLeft).toBe(2);
    expect(facts.streak.entitlement.purchasedDaysLeft).toBe(0);
  });

  it('CARRIES A PURCHASED COVERED DAY ACROSS THE WIRE, now that GDD §8.3E is ruled in', () => {
    // THIS REVERSES A REFUSAL. `receiveProgressionSnapshot` used to reject any
    // snapshot with `purchasedDaysLeft !== 0` outright, on the grounds that
    // §8.3E was proposed and not ruled and a server carrying one was a server
    // running ahead of the design. It is ruled in, so the refusal is gone and
    // the field crosses the boundary like every other count.
    //
    // WHAT DID NOT CHANGE IS WHO OWNS IT. This decodes what the server says;
    // no client path writes it, and `streak.applySettledCoveredDayPurchase`
    // needs a settled order the server alone can produce.
    const base = wire();
    const withPurchase = {
      ...base,
      streak: {
        ...base.streak,
        entitlement: { ...base.streak.entitlement, purchasedDaysLeft: 4 },
      },
    };
    const received = receiveProgressionSnapshot(withPurchase);
    expect(received.ok).toBe(true);
    if (!received.ok) return;
    expect(snapshotFacts(received.value).streak.entitlement.purchasedDaysLeft).toBe(4);

    // NO CEILING IS VALIDATED, DELIBERATELY. A large purchased balance is not a
    // suspicious snapshot: `MAX_COVERED_DAYS_PER_ABSENCE` caps what any one
    // absence may draw regardless of what the window holds, so ten thousand
    // purchased days buy exactly the protection two do. Refusing a number here
    // would be enforcing a bound that does not exist.
    const enormous = {
      ...base,
      streak: {
        ...base.streak,
        entitlement: { ...base.streak.entitlement, purchasedDaysLeft: 10_000 },
      },
    };
    expect(receiveProgressionSnapshot(enormous).ok).toBe(true);

    // What IS still refused is a value that is not a count at all.
    for (const bad of [-1, 1.5, Number.NaN]) {
      const broken = {
        ...base,
        streak: {
          ...base.streak,
          entitlement: { ...base.streak.entitlement, purchasedDaysLeft: bad },
        },
      };
      const result = receiveProgressionSnapshot(broken);
      expect(result.ok, `purchasedDaysLeft ${bad} must be refused`).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('INVALID_SNAPSHOT');
    }
  });

  it('tracks streak.ts own allowlist rather than duplicating it', () => {
    const facts = snapshotFacts(snapshot());
    expect(Object.keys(facts.streak).sort()).toEqual([...STREAK_FACT_KEYS].sort());
  });

  it('pins every report type to its declared inputs', () => {
    // `weight`, NOT `weightKg`, ON EVERY ROW ON THIS WIRE. The unit is not on a
    // row — it is on the card, once, at the grain the mode actually has one: a
    // meet runs under one `MeetLoadingRules`, a session is prescribed under one
    // `SESSION_TUNING.LOAD_UNIT`.
    //
    // THIS ASSERTION USED TO PIN `weightKg` FOR THE TRAINING ROW, four lines
    // above the comment explaining why `weightKg` is wrong. Two doctrines in one
    // test, and the one being pinned was the discarded one — which is how the
    // fourth unproven field survived a round that closed the other three.
    expect([...TRAINING_SET_REPORT_KEYS].sort()).toEqual([
      'executionQuality',
      'lift',
      'reps',
      'rpe',
      'weight',
    ]);
    expect([...TRAINING_CARD_REPORT_KEYS].sort()).toEqual(['kilogramSets', 'poundSets', 'unit']);
    expect([...TRAINING_SESSION_REPORT_KEYS].sort()).toEqual(['card', 'deviceWallClock']);
    expect([...SET_RECOVERY_DAY_PROTECTION_REPORT_KEYS].sort()).toEqual([
      'deviceWallClock',
      'protectionEnabled',
    ]);
    expect([...MEET_ATTEMPT_REPORT_KEYS].sort()).toEqual(['attemptNumber', 'good', 'lift', 'weight']);
    expect([...MEET_CARD_REPORT_KEYS].sort()).toEqual(['kilogramAttempts', 'poundAttempts', 'unit']);
    expect([...MEET_RESULT_REPORT_KEYS].sort()).toEqual(['bodyweight', 'card', 'meetId']);
    expect([...REDEEM_ENTITLEMENT_REPORT_KEYS].sort()).toEqual(['receipt', 'sku']);
    expect([...SPEND_CURRENCY_REPORT_KEYS].sort()).toEqual(['amount', 'currency', 'sku']);
  });

  it('lets no report field name a unit unless its allowlist carries the tag', () => {
    // THE SWEEP, RUN RATHER THAN REMEMBERED, AND DERIVED RATHER THAN LISTED.
    //
    // THE RULE: a field may say `kg` or `pound` in its NAME only in an allowlist
    // that also carries `unit` — i.e. only as an ARM of a tagged pair, where the
    // name is unreachable without a narrow and is therefore backed by something.
    // `kilogramSets` and `poundAttempts` qualify. `weightKg` on a bare row does
    // not: that is a unit in a name with nothing behind it, which is the whole
    // defect this boundary has now been through four rounds of.
    //
    // Scanned off the module's exports rather than off a list, because the round
    // that wrote this existed for exactly one reason: the previous sweep was
    // scoped to "the meet path" and a bare `weightKg` sat thirty lines outside it.
    const NAMES_A_UNIT = /kg|kilogram|lb|pound/i;
    const allowlists = Object.keys(progressionModule)
      .filter((name) => name.endsWith('_REPORT_KEYS'))
      .map((name) => [name, reportKeyAllowlist(name)] as const);
    const untagged = allowlists.filter(([, keys]) => !keys.includes('unit'));
    const tagged = allowlists.filter(([, keys]) => keys.includes('unit'));
    // Non-vacuity on both halves before either is read: a wire with no tagged
    // allowlists has lost its units entirely, and a wire with no untagged ones
    // would make the loop below scan nothing.
    expect(tagged.length).toBeGreaterThan(0);
    expect(untagged.length).toBeGreaterThan(0);
    for (const [name, keys] of untagged) {
      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) {
        expect(`${name}.${key}`).not.toMatch(NAMES_A_UNIT);
      }
    }
    // The control for the regex itself: it CAN see the name it is looking for,
    // so an empty result means the rows are bare rather than that nothing matches.
    expect('weightKg').toMatch(NAMES_A_UNIT);
    expect('bodyweightKg').toMatch(NAMES_A_UNIT);
    expect('weight').not.toMatch(NAMES_A_UNIT);
  });

  it('lets no report name an output', () => {
    const everyReportKey = [
      ...TRAINING_SET_REPORT_KEYS,
      ...TRAINING_CARD_REPORT_KEYS,
      ...TRAINING_SESSION_REPORT_KEYS,
      ...SET_RECOVERY_DAY_PROTECTION_REPORT_KEYS,
      ...MEET_ATTEMPT_REPORT_KEYS,
      ...MEET_CARD_REPORT_KEYS,
      ...MEET_RESULT_REPORT_KEYS,
      ...REDEEM_ENTITLEMENT_REPORT_KEYS,
      ...SPEND_CURRENCY_REPORT_KEYS,
    ];
    for (const key of everyReportKey) {
      expect(PROGRESSION_FACT_KEYS as readonly string[]).not.toContain(key);
      expect(key).not.toMatch(/e1rm|total|streak|balance|effect/i);
    }
  });

  it('keeps a meet result to its declared fields', () => {
    const [meet] = snapshotFacts(snapshot()).meets;
    expect(meet).toBeDefined();
    expect(Object.keys(meet as object).sort()).toEqual([...CONFIRMED_MEET_RESULT_KEYS].sort());
  });

  it('keeps a projection to a subset of the real facts', () => {
    expect(Object.keys(emptyProjection()).sort()).toEqual([...PROJECTION_KEYS].sort());
    for (const key of PROJECTION_KEYS) {
      expect(PROGRESSION_FACT_KEYS as readonly string[]).toContain(key);
    }
    // A meet result is never optimistic.
    expect(PROJECTION_KEYS as readonly string[]).not.toContain('meets');
  });
});

// ---------------------------------------------------------------------------
// The pay-to-win line (GDD §8.1, §12.3)
// ---------------------------------------------------------------------------

describe('nothing purchasable reaches performance', () => {
  it('declares a non-empty reach for every proposal kind', () => {
    // The disjointness checks below are vacuously true over an empty reach, so
    // this runs first: if the reach table is ever gutted, this fails rather
    // than the guard silently passing forever.
    for (const kind of PROGRESSION_PROPOSAL_KINDS) {
      expect(factsMovedBy(kind).length).toBeGreaterThan(0);
    }
  });

  it('names only real facts in every reach', () => {
    // The runtime half of `PROPOSAL_REACH_NAMES_REAL_FACTS`, and the other way a
    // reach map can stop being worth anything. The map is a hand-written set of
    // strings AND it is the operand of the disjointness check below: rename a
    // fact without updating it and it names a field that no longer exists, while
    // the check goes on passing because two dead spellings cannot collide. The
    // non-vacuity check above cannot see that — a drifted union is still
    // non-empty, it just refers to nothing.
    const realFacts: readonly string[] = PROGRESSION_FACT_KEYS;
    expect(realFacts.length).toBeGreaterThan(0);
    for (const kind of PROGRESSION_PROPOSAL_KINDS) {
      for (const fact of factsMovedBy(kind) as readonly string[]) {
        expect(realFacts).toContain(fact);
      }
    }
    // `EntitlementReach` has no runtime table to walk — it is type-only, so
    // `ENTITLEMENT_REACH_NAMES_REAL_FACTS` is the whole of that half.
  });

  it('gives every proposal kind an origin, from one map', () => {
    // The subject of the check below. If a kind could exist without an origin,
    // the check below would be back to iterating a list someone maintains.
    expect(Object.keys(PROPOSAL_ORIGIN_BY_KIND).sort()).toEqual([...PROGRESSION_PROPOSAL_KINDS].sort());
    for (const kind of PROGRESSION_PROPOSAL_KINDS) {
      expect(PROPOSAL_ORIGIN_KINDS as readonly string[]).toContain(PROPOSAL_ORIGIN_BY_KIND[kind]);
    }
  });

  it('derives the purchasable set from that map rather than restating it', () => {
    // `PURCHASABLE_PROPOSAL_KINDS` is computed by the module; this recomputes it
    // straight off the origin map. The two agreeing is what makes the module's
    // type predicate — which `tsc` cannot check against its conditional type —
    // safe to build the pay-to-win guard on.
    const fromTheMap = PROGRESSION_PROPOSAL_KINDS.filter((kind) => PROPOSAL_ORIGIN_BY_KIND[kind] === 'purchase');
    expect([...PURCHASABLE_PROPOSAL_KINDS].sort()).toEqual([...fromTheMap].sort());
    // Non-vacuity in BOTH directions: some kinds are purchases and some are not.
    // An empty derived set would make every check below pass over nothing; a
    // total one would mean the tag stopped discriminating.
    expect(PURCHASABLE_PROPOSAL_KINDS.length).toBeGreaterThan(0);
    expect(PURCHASABLE_PROPOSAL_KINDS.length).toBeLessThan(PROGRESSION_PROPOSAL_KINDS.length);
  });

  it('keeps every purchase-originated proposal off the protected facts', () => {
    // The iteration set is DERIVED, not listed here. A new proposal kind tagged
    // `'purchase'` joins it without this test being edited — which is the whole
    // point: the previous version hardcoded the two kinds it knew about and was
    // blind to a third.
    expect(PURCHASABLE_PROPOSAL_KINDS.length).toBeGreaterThan(0);
    for (const kind of PURCHASABLE_PROPOSAL_KINDS) {
      const reach = factsMovedBy(kind) as readonly string[];
      expect(reach.length).toBeGreaterThan(0);
      for (const concern of PROTECTED_CONCERNS) {
        expect(reach).not.toContain(concern);
      }
    }
  });

  it('names purchase evidence that real reports carry and earned reports do not', () => {
    // The runtime half of `MONEY_ON_THE_WIRE_IS_DECLARED_A_PURCHASE`. That
    // assertion is a subset check over the kinds whose report names money, so it
    // passes for free if `PURCHASE_EVIDENCE_KEYS` points at fields nothing has.
    //
    // THE PARTITION IS DERIVED FROM `PROPOSAL_ORIGIN_BY_KIND`. It used to be two
    // hand-sorted lists of report-key arrays — the same defect the assertion
    // itself was rewritten to stop having, one level down: a new kind's report
    // would land in neither list and be cross-checked by nothing.
    expect(Object.keys(PAYLOAD_KEYS_BY_PROPOSAL_KIND).sort()).toEqual([...PROGRESSION_PROPOSAL_KINDS].sort());
    const purchaseReportKeys = payloadKeysWithOrigin('purchase');
    const earnedReportKeys = payloadKeysWithOrigin('earned');
    // Non-vacuity on both halves of the partition before anything reads them: an
    // empty side would make one of the two directions below pass over nothing.
    expect(purchaseReportKeys.length).toBeGreaterThan(0);
    expect(earnedReportKeys.length).toBeGreaterThan(0);
    expect(PURCHASE_EVIDENCE_KEYS.length).toBeGreaterThan(0);
    for (const evidence of PURCHASE_EVIDENCE_KEYS) {
      expect(purchaseReportKeys).toContain(evidence);
      expect(earnedReportKeys).not.toContain(evidence);
    }
  });

  it('walks every exported report allowlist, nested ones included', () => {
    // The partition above is worth what it covers, and what it must cover is
    // more than `keyof` can see: `MoneyCarryingProposalKind` reads the top level
    // of each report only (§6 of the module header), so a `sku` on a nested
    // `TrainingSetReport` is invisible to the type-level check and this runtime
    // walk is the only thing looking at it.
    //
    // Found by scanning the module's own exports rather than by being
    // remembered: a new report type gets a `*_REPORT_KEYS` allowlist, and until
    // it appears in `PAYLOAD_KEYS_BY_PROPOSAL_KIND` it is checked by nothing.
    const allowlists = Object.keys(progressionModule)
      .filter((name) => name.endsWith('_REPORT_KEYS'))
      .map((name) => [name, reportKeyAllowlist(name)] as const);
    // Non-vacuity: a scan that matched nothing would pass forever.
    expect(allowlists.length).toBeGreaterThan(0);
    // Each allowlist must sit inside ONE kind's payload, rather than merely
    // having its field names turn up somewhere across the map. A report whose
    // keys are individually shared with other reports — `lift` and `weightKg`
    // are on two — would otherwise look covered while belonging to no kind.
    const payloads = Object.values(PAYLOAD_KEYS_BY_PROPOSAL_KIND);
    const unwired = allowlists
      .filter(([, keys]) => !payloads.some((payload) => keys.every((key) => payload.includes(key))))
      .map(([name]) => name);
    expect(unwired).toEqual([]);
  });

  it('lets no proposal at all move a fact that means training pace', () => {
    // THIS TEST USED TO BE `not.toContain('trainingPace')` AND COULD NOT FAIL.
    // Every reach value is bound to `ProgressionFactKey` by
    // `PROPOSAL_REACH_NAMES_REAL_FACTS`, and `'trainingPace'` was deliberately
    // not a fact key — so no reach could ever contain that string, whatever any
    // row said. A purchasable `simSessionsPerDay` on the `'redeem-entitlement'`
    // row passed it unchanged.
    //
    // It now asks the question the §8.1 line actually cares about: does any
    // proposal reach a fact whose NAME means pace? The control comes first,
    // because a reach that named nothing would satisfy the loop for free.
    expect(vocabularyHits('simSessionsPerDay', PERFORMANCE_FACT_VOCABULARY.pace)).not.toEqual([]);
    let factsSeen = 0;
    for (const kind of PROGRESSION_PROPOSAL_KINDS) {
      for (const fact of factsMovedBy(kind) as readonly string[]) {
        factsSeen += 1;
        expect(vocabularyHits(fact, PERFORMANCE_FACT_VOCABULARY.pace)).toEqual([]);
      }
    }
    expect(factsSeen).toBeGreaterThan(0);
  });

  it('lets earned proposals move the facts a purchase may not', () => {
    // The positive control for the check above. If the protected facts were
    // unreachable by *everything*, the purchase check would pass for the wrong
    // reason. Derived from `PROTECTED_CONCERNS` rather than naming facts by
    // hand, so a renamed or added concern is covered without editing this test —
    // the hardcoded `'totalKg'` that used to be here was satisfied just as well
    // by a reach map that had drifted off the facts.
    //
    // WHAT IT CANNOT SEE: it asks whether SOME earned kind reaches each concern,
    // never which, so `record-meet-result` satisfies the whole loop on its own.
    // A `record-training-session` that also claimed `'totalKg'` would pass here
    // unchanged. That is not a defect in this test — it is a different question
    // — but it is the reason "a Total is set at a meet and nowhere else" below
    // exists rather than being folded into this block.
    const earnedReach = new Set(
      PROGRESSION_PROPOSAL_KINDS.filter((kind) => PROPOSAL_ORIGIN_BY_KIND[kind] === 'earned').flatMap((kind) => [
        ...factsMovedBy(kind),
      ]),
    );
    expect(earnedReach.size).toBeGreaterThan(0);
    // NO CARVE-OUT ANY MORE. This loop used to skip `'trainingPace'`, the one
    // protected concern that was not a stored fact and that every check in the
    // module had to route around. `PROTECTED_CONCERNS` is now derived from
    // `FACT_PROTECTION` and contains only real facts, so every member of it is a
    // fact some earned proposal must be able to move.
    for (const concern of PROTECTED_CONCERNS) {
      expect([...earnedReach]).toContain(concern);
    }
  });

  it('offers no entitlement effect that touches a lift', () => {
    expect([...ENTITLEMENT_EFFECT_KINDS].sort()).toEqual(['convenience', 'cosmetic', 'currency', 'recovery-day']);
    for (const kind of ENTITLEMENT_EFFECT_KINDS) {
      expect(kind).not.toMatch(/e1rm|total|strength|boost|pace|xp/i);
    }
  });

  it('sells no convenience that speeds up training', () => {
    // GDD §8.3B: "Never speed up Sim-mode training progression. That is the
    // credibility line."
    for (const grant of CONVENIENCE_GRANTS) {
      expect(grant).not.toMatch(/session|training|sim|recovery|fatigue/i);
    }
    expect([...CONVENIENCE_GRANTS]).toEqual(['gym-empire-timer-skip', 'extra-save-slot']);
  });

  it('keeps every cosmetic slot cosmetic', () => {
    expect(COSMETIC_SLOTS.length).toBeGreaterThan(0);
    for (const slot of COSMETIC_SLOTS) {
      expect(slot).not.toMatch(/e1rm|total|strength|boost|pace/i);
    }
  });
});

// ---------------------------------------------------------------------------
// A Total is set at a meet and nowhere else (GDD §2, §6.4)
//
// WHY THIS IS ITS OWN BLOCK AND NOT A LINE IN THE ONE ABOVE. The pay-to-win
// tests ask "may a PURCHASE reach a protected fact?", and their positive control
// — "lets earned proposals move the facts a purchase may not" — is satisfied by
// `record-meet-result` alone. It therefore passes identically whether or not
// `record-training-session` also claims `'totalKg'`: it cannot see the
// difference between the two worlds, because it only ever asks whether SOME
// earned kind reaches each concern. This block asks WHICH.
//
// The claim: `totalKg` is the sum of best successful competition attempts
// (§6.4), `null` until the first meet (`ConfirmedFacts.totalKg`), and a
// `dots.ts` `OfficialTotalKg` by construction. So training cannot move it. What
// training moves is `bestE1rmKg`, which is what GDD §2 now says and §3.2 now
// tells the daily loop to put on screen.
// ---------------------------------------------------------------------------

describe('a Total is set at a meet and nowhere else', () => {
  /** The kinds whose declared reach names a fact, read off the runtime table. */
  function kindsMoving(fact: string): readonly ProgressionProposalKind[] {
    return PROGRESSION_PROPOSAL_KINDS.filter((kind) => (factsMovedBy(kind) as readonly string[]).includes(fact));
  }

  it('lets only a proposal that carries a meet move the Total', () => {
    // BOTH SIDES ARE DERIVED. The right-hand side is not the literal
    // `['record-meet-result']` but "every kind whose payload names a meet",
    // computed from the report allowlists — so this survives a renamed kind and
    // fails on a new kind that reaches `totalKg` without being a meet at all.
    const carriesAMeet = PROGRESSION_PROPOSAL_KINDS.filter((kind) =>
      PAYLOAD_KEYS_BY_PROPOSAL_KIND[kind].includes('meetId'),
    );
    // Non-vacuity first, on the side that is doing the constraining: if nothing
    // carried a meet, the equality below would be `[] === []` and would pass
    // over an empty world.
    expect(carriesAMeet.length).toBeGreaterThan(0);
    expect([...kindsMoving('totalKg')].sort()).toEqual([...carriesAMeet].sort());
  });

  it('does not let a training session move the Total', () => {
    const reach = factsMovedBy('record-training-session') as readonly string[];
    expect(reach).not.toContain('totalKg');
    expect(reach).not.toContain('meets');
    // THE POSITIVE CONTROL, in the same test as the prohibition on purpose. A
    // prohibition alone is satisfied better by a worse artifact — an emptied
    // reach passes every `not.toContain` there is. A training session must still
    // move the number that training actually moves.
    expect(reach).toContain('bestE1rmKg');
    expect(reach.length).toBeGreaterThan(0);
  });

  it('still lets a meet result move the Total', () => {
    // The other direction, because the reach TABLE can name fewer facts than the
    // reach MAP allows and still compile. Without this, deleting `'totalKg'`
    // from both rows would satisfy the test above and leave nothing in the game
    // able to set a Total.
    const reach = factsMovedBy('record-meet-result') as readonly string[];
    expect(reach).toContain('totalKg');
    expect(reach).toContain('meets');
  });

  it('moves e1RM from both, because a meet is also the heaviest single you did', () => {
    // Not a redundancy: it pins that dropping `totalKg` from the training row
    // did not take `bestE1rmKg` with it, and that the two kinds are
    // distinguished by Total rather than by e1RM.
    for (const kind of ['record-training-session', 'record-meet-result'] as const) {
      expect(factsMovedBy(kind) as readonly string[]).toContain('bestE1rmKg');
    }
  });

  // -------------------------------------------------------------------------
  // ...AND THE SAME RULE ON THE OPTIMISTIC LAYER (GDD §3.2).
  //
  // Everything above is about what the SERVER is asked to move. A screen renders
  // the projection, not the reach map, and until `proposeChange` bound the two
  // together a `record-training-session` paired with a projection carrying
  // `totalKg` constructed fine — which is precisely the "number that moves"
  // after a session that §3.2 says must be e1RM and never Total.
  //
  // These tests are the RUNTIME half. The compile-time half is in the
  // `@ts-expect-error` block near the end of this file, because `npm test` sees
  // types not at all.
  // -------------------------------------------------------------------------

  it('refuses a training session whose projection claims a Total', () => {
    const result = proposeUntyped(
      confirmedCache(),
      asProposalId('p1'),
      A_PROPOSAL,
      projectionWith({ totalKg: projectedKg(645) }),
    );
    expect(expectErr(result).code).toBe('PROJECTION_EXCEEDS_REACH');
    expect(expectErr(result).message).toMatch(/totalKg/);
  });

  it('accepts the same projected Total from a meet result', () => {
    // THE POSITIVE CONTROL, and it is the one that matters: a guard that refused
    // every projection would pass the test above and make meet day unrenderable.
    // Meet day is the day the Total moves, so meet day is the day it may be
    // shown moving.
    const pending = expectOk(
      proposeChange(
        confirmedCache(),
        asProposalId('p1'),
        A_MEET_PROPOSAL,
        projectionWith({ totalKg: projectedKg(645) }),
      ),
    );
    expect(readTotalKg(pending)).toEqual({ kind: 'projected', value: 645, lastConfirmed: 630 });
  });

  it('lets a training session project the number a session actually moves', () => {
    // The other positive control, and the shape GDD §3.2 asks the daily loop to
    // put on screen at the close-out.
    const pending = expectOk(
      proposeChange(
        confirmedCache(),
        asProposalId('p1'),
        A_PROPOSAL,
        projectionWith({ bestE1rmKg: { squat: projectedKg(245), bench: null, deadlift: null } }),
      ),
    );
    expect(readBestE1rmKg(pending, 'squat')).toEqual({ kind: 'projected', value: 245, lastConfirmed: 240 });
    // And the Total on that screen is still the confirmed one, not a tick up.
    expect(readTotalKg(pending)).toEqual({ kind: 'confirmed', value: 630 });
  });

  it('checks every kind against every projectable fact, in both directions', () => {
    // DERIVED, not a list of cases: for each proposal kind, each projectable
    // fact is claimed on its own and the answer is compared against that kind's
    // declared reach. A guard that refused everything fails the `accepted` half;
    // a guard that refused nothing fails the `refused` half; a guard that only
    // knew about Totals fails on `streak` against a meet result.
    let refused = 0;
    let accepted = 0;
    for (const kind of PROGRESSION_PROPOSAL_KINDS) {
      const reach = factsMovedBy(kind) as readonly string[];
      for (const fact of PROJECTION_KEYS) {
        const result = proposeUntyped(
          confirmedCache(),
          asProposalId('p1'),
          PROPOSAL_BY_KIND[kind],
          projectionClaiming(fact),
        );
        if (reach.includes(fact)) {
          expect(expectOk(result).status).toBe('pending');
          accepted += 1;
        } else {
          expect(expectErr(result).code).toBe('PROJECTION_EXCEEDS_REACH');
          refused += 1;
        }
      }
    }
    // Non-vacuity on both counters: a loop over an empty product would pass.
    expect(accepted).toBeGreaterThan(0);
    expect(refused).toBeGreaterThan(0);
    expect(accepted + refused).toBe(PROGRESSION_PROPOSAL_KINDS.length * PROJECTION_KEYS.length);
  });

  it('lets every kind claim nothing', () => {
    // The floor: an empty projection is not a claim, so no kind may be refused
    // one. Without this, "claims nothing" could quietly start counting as a
    // claim on `totalKg` and every proposal in the game would fail.
    for (const kind of PROGRESSION_PROPOSAL_KINDS) {
      const result = proposeChange(confirmedCache(), asProposalId('p1'), PROPOSAL_BY_KIND[kind], emptyProjection());
      expect(result.ok).toBe(true);
    }
  });

  it('keeps the compile-time half of the claim in the source', () => {
    // Everything above reads the runtime table. The type-level assertion that
    // makes putting `'totalKg'` back fail `tsc` is stripped by esbuild and there
    // is no CI, so — same idiom as the pay-to-win scan above — the source is the
    // thing under test.
    const code = MODULE_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).toMatch(/export const ONLY_A_MEET_RESULT_MOVES_TOTAL: UnionIsExactly</);
    // `UnionIsExactly`, not `AreDisjoint` or `IsSubsetOf`: this one has to fail
    // when the reach gets NARROWER too. See the comment on the assertion.
    expect(code).not.toMatch(/export const ONLY_A_MEET_RESULT_MOVES_TOTAL: (AreDisjoint|IsSubsetOf)</);
    // And the declaration it reads is column-wise over the map, so it cannot be
    // satisfied by editing one row's spelling.
    expect(code).toMatch(/\[K in ProgressionProposalKind\]: F extends ProposalReach\[K\] \? K : never;/);
  });

  it('keeps the compile-time half of the PROJECTION claim in the source too', () => {
    const code = MODULE_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    // The binding itself: `proposeChange` takes a projection narrowed to the
    // proposal's kind, rather than any old `ProgressionProjection`.
    expect(code).toMatch(/projection: ProjectionWithinReach<K> & ProgressionProjection/);
    // Both directions, and `UnionIsExactly` for both, for the same reason as
    // above: the prohibition alone is satisfied better by a guard that refuses
    // every projection, which would leave meet day unable to show a Total.
    expect(code).toMatch(/export const A_TRAINING_SESSION_PROJECTION_CANNOT_CLAIM_A_TOTAL: UnionIsExactly</);
    expect(code).toMatch(/export const A_MEET_RESULT_PROJECTION_CAN_CLAIM_A_TOTAL: UnionIsExactly</);
    expect(code).not.toMatch(
      /export const (A_TRAINING_SESSION_PROJECTION_CANNOT_CLAIM_A_TOTAL|A_MEET_RESULT_PROJECTION_CAN_CLAIM_A_TOTAL): (AreDisjoint|IsSubsetOf)</,
    );
  });
});

// ---------------------------------------------------------------------------
// The one door
// ---------------------------------------------------------------------------

describe('receiveProgressionSnapshot', () => {
  it('turns a wire payload into server truth', () => {
    const snap = snapshot();
    expect(snapshotRevision(snap)).toBe(7);
    const facts = snapshotFacts(snap);
    expect(facts.totalKg).toBe(630);
    expect(facts.bestE1rmKg.squat).toBe(240);
    expect(facts.streak.currentStreak).toBe(12);
    expect(facts.wallet.gymBucks).toBe(1200);
    expect(facts.meets).toHaveLength(1);
  });

  it('carries a bomb-out as null, not as a total of zero', () => {
    const facts = snapshotFacts(
      snapshot({
        totalKg: null,
        meets: [
          {
            meetId: 'meet-bombed',
            meetDayIndex: 19_950,
            totalKg: null,
            bestByLift: { squat: 230, bench: null, deadlift: null },
            bodyweightKg: 93,
          },
        ],
      }),
    );
    expect(facts.totalKg).toBeNull();
    expect(facts.meets[0]?.totalKg).toBeNull();
    expect(facts.meets[0]?.totalKg).not.toBe(0);
  });

  it('brands a stored bodyweight like every other number on server truth', () => {
    // IT WAS THE ONE THAT WAS NOT. `ConfirmedMeetResult.bodyweightKg` was a bare
    // `number` sitting beside a `ConfirmedTotalKg` and a `Record<LiftKind,
    // ConfirmedKg | null>`, which made it the single scalar on server truth a
    // locally computed number could be written into. The asymmetry was the
    // defect, in one line.
    //
    // THIS PIN FAILS BY COMPILING. Widen the field back to `number` and the
    // directive below stops being an error, which `tsc` reports as an unused
    // `@ts-expect-error` — so the pin cannot go quiet the way a runtime
    // assertion on a brand would (brands are erased; there is nothing to assert
    // at runtime, which is exactly why this is written as a type check).
    const stored: ConfirmedMeetResult = snapshotFacts(
      snapshot({
        meets: [
          {
            meetId: 'meet-branded',
            meetDayIndex: 19_950,
            totalKg: 600,
            bestByLift: { squat: 230, bench: 150, deadlift: 220 },
            bodyweightKg: 93,
          },
        ],
      }),
    ).meets[0]!;
    expect(stored.bodyweightKg).toBe(93);
    // @ts-expect-error - a plain number is not a ConfirmedKg; only the decoder mints one.
    const forged: typeof stored.bodyweightKg = 93;
    expect(forged).toBe(93);
  });

  it('refuses a zero or negative total rather than storing it', () => {
    expect(expectErr(receiveProgressionSnapshot(wire({ totalKg: 0 }))).code).toBe('INVALID_SNAPSHOT');
    expect(expectErr(receiveProgressionSnapshot(wire({ totalKg: -5 }))).code).toBe('INVALID_SNAPSHOT');
    expect(expectErr(receiveProgressionSnapshot(wire({ totalKg: Number.NaN }))).code).toBe('INVALID_SNAPSHOT');
  });

  it('refuses a malformed revision', () => {
    expect(expectErr(receiveProgressionSnapshot(wire({ revision: -1 }))).code).toBe('INVALID_SNAPSHOT');
    expect(expectErr(receiveProgressionSnapshot(wire({ revision: 1.5 }))).code).toBe('INVALID_SNAPSHOT');
  });

  it('refuses a malformed e1RM', () => {
    const bad = receiveProgressionSnapshot(wire({ bestE1rmKg: { squat: -1, bench: 150, deadlift: 280 } }));
    expect(expectErr(bad).message).toMatch(/bestE1rmKg\.squat/);
  });

  it('refuses a streak whose best is below its current run', () => {
    const bad = receiveProgressionSnapshot(
      wire({ streak: { ...wire().streak, currentStreak: 40, longestStreak: 31 } }),
    );
    expect(expectErr(bad).code).toBe('INVALID_SNAPSHOT');
  });

  it('refuses a streak whose signup day is missing, fractional, or after a recorded session', () => {
    // GDD §4.2: `signupDay` is the day the account was created, and `streak.ts`
    // charges a lifter's idle days from it. A snapshot that gets it wrong is a
    // migration bug, and the two ways it can be wrong are different bugs:
    //
    //   - not a day index at all — the wire carried something that is not a day;
    //   - later than `lastTrainedDay` — an account created after a session was
    //     recorded on it, which is not a fact about anything.
    //
    // Neither is clamped or defaulted. A quiet default here would be a quiet
    // Recovery Day balance for the lifter's whole first week.
    const fractional = receiveProgressionSnapshot(
      wire({ streak: { ...wire().streak, signupDay: 19_000.5 } }),
    );
    expect(expectErr(fractional).code).toBe('INVALID_SNAPSHOT');
    expect(expectErr(fractional).message).toMatch(/streak\.signupDay/);

    const afterTraining = receiveProgressionSnapshot(
      wire({ streak: { ...wire().streak, signupDay: 20_001, lastTrainedDay: 20_000 } }),
    );
    expect(expectErr(afterTraining).code).toBe('INVALID_SNAPSHOT');
    expect(expectErr(afterTraining).message).toMatch(/signupDay cannot be after/);

    // NOT VACUOUS: the same day equal to the last trained day is legitimate — a
    // lifter who trained on the day they signed up — and it decodes.
    const sameDay = receiveProgressionSnapshot(
      wire({ streak: { ...wire().streak, signupDay: 20_000, lastTrainedDay: 20_000 } }),
    );
    expect(sameDay.ok).toBe(true);
  });

  it('carries the signup day through to the confirmed facts unchanged', () => {
    // The field crosses the boundary rather than being reconstructed on the far
    // side, which is what "the client is a renderer" means for a state field.
    const received = receiveProgressionSnapshot(wire({ streak: { ...wire().streak, signupDay: 18_500 } }));
    if (!received.ok) throw new Error('expected a valid snapshot');
    expect(snapshotFacts(received.value).streak.signupDay).toBe(18_500);
  });

  it('refuses a fractional currency balance', () => {
    const bad = receiveProgressionSnapshot(wire({ wallet: { gymBucks: 10.5, chalk: 40 } }));
    expect(expectErr(bad).message).toMatch(/wallet\.gymBucks/);
  });

  it('refuses a blank meet id and a blank acknowledgement', () => {
    const badMeet = receiveProgressionSnapshot(
      wire({ meets: [{ ...wire().meets[0]!, meetId: '   ' }] }),
    );
    expect(expectErr(badMeet).code).toBe('INVALID_SNAPSHOT');
    expect(expectErr(receiveProgressionSnapshot(wire({ acknowledgedProposalId: '  ' }))).code).toBe(
      'INVALID_SNAPSHOT',
    );
  });

  it('freezes what it hands back, symbol payload included', () => {
    // §7.5'S `facts` ROW, AND THE ONE THAT WAS OUTSIDE EVERY INSTRUMENT. This
    // test predates the row: the mint used to freeze through a call spelled
    // `deepFreeze`, which no scan looked for, and `ConfirmedFacts` was not a
    // target type, so nothing required this test to exist or to reach past the
    // two fields it happened to name. Measured on the commit before the row:
    // swapping the mint's `deepFreeze` for a shallow `Object.freeze` left every
    // §7.5 assertion green and reddened this test alone, out of 2687.
    const snap = snapshot();
    const facts = snapshotFacts(snap);
    expect(Object.isFrozen(snap)).toBe(true);
    expect(Object.isFrozen(facts)).toBe(true);
    expect(Object.isFrozen(facts.bestE1rmKg)).toBe(true);
    expect(Object.isFrozen(facts.streak)).toBe(true);
    expect(Object.isFrozen(facts.wallet)).toBe(true);
    expect(Object.isFrozen(facts.meets)).toBe(true);
    expect(Object.isFrozen(facts.federation)).toBe(true);
    expect(() => {
      (facts as { totalKg: number | null }).totalKg = 900;
    }).toThrow(TypeError);
    expect(snapshotFacts(snap).totalKg).toBe(630);

    // THE SYMBOL PAYLOAD THE TITLE PROMISES, WHICH THIS BODY DID NOT READ.
    //
    // Everything above reaches the facts through `snapshotFacts`, and the facts
    // were sealed independently one statement before the snapshot was. So a
    // `deepFreeze` that walked string keys only left `snap[SNAPSHOT_CONTENTS]`
    // writable and every assertion above still green — the contents record
    // could be swapped wholesale for hand-built numbers with no unit tag, and
    // handed back as confirmed truth.
    //
    // The ledger excused this: "no test can name what is under it and no
    // Object.isFrozen assertion can reach one level down." That was false when
    // written, and the counterexample is in THIS FILE — the `PAIRING_CHECKED`
    // test above does exactly this to the sibling symbol, which `progression.ts`
    // itself calls "the SNAPSHOT_CONTENTS idiom". A guard written for the copy
    // and not for the original, two module-private symbols of one module, one
    // test file apart.
    expect(Object.keys(snap)).toEqual([]);
    const snapSymbols = Object.getOwnPropertySymbols(snap);
    expect(snapSymbols).toHaveLength(1);
    const contents = (snap as unknown as Record<symbol, Record<string, unknown>>)[snapSymbols[0]!];
    expect(contents, 'the snapshot carries its payload under that symbol').not.toBeUndefined();
    expect(Object.isFrozen(contents), 'the payload one level under the symbol').toBe(true);
  });
});

describe('the snapshot is opaque, not branded', () => {
  it('exposes no string-named property at all', () => {
    expect(Object.keys(snapshot())).toEqual([]);
  });

  it('makes a spread-and-override tamper inert', () => {
    // This is the line an object brand would have let through. It compiles here
    // too — a spread copies the symbol-keyed payload and adding a `totalKg`
    // alongside it is assignable — but no reader looks at the added key, so the
    // forged total is not there when anyone asks. See §2 of the module header.
    const real = snapshot();
    const spread = { ...real, totalKg: 900 };
    const asSnapshot: ProgressionSnapshot = spread;
    expect(snapshotFacts(asSnapshot).totalKg).toBe(630);
    expect(snapshotRevision(asSnapshot)).toBe(7);
    const total = snapshotFacts(asSnapshot).totalKg;
    expect(total).not.toBe(900);
  });
});

// ---------------------------------------------------------------------------
// The cache
// ---------------------------------------------------------------------------

describe('the cache as a cache of server truth', () => {
  it('starts empty, with no truth to read', () => {
    const cache = emptyProgressionCache();
    expect(cache.status).toBe('empty');
    expect(cachedSnapshot(cache)).toBeNull();
    expect(readTotalKg(cache)).toEqual({ kind: 'unknown' });
  });

  it('refuses a proposal before anything has been read', () => {
    const result = proposeChange(emptyProgressionCache(), asProposalId('p1'), A_PROPOSAL, emptyProjection());
    expect(expectErr(result).code).toBe('NO_CONFIRMED_TRUTH');
  });

  it('confirms on the first snapshot', () => {
    const cache = confirmedCache();
    expect(cache.status).toBe('confirmed');
    expect(readTotalKg(cache)).toEqual({ kind: 'confirmed', value: 630 });
  });

  it('refuses a snapshot older than the one it holds', () => {
    const cache = confirmedCache();
    const older = snapshot({ revision: 6, totalKg: 900 });
    const result = applyServerSnapshot(cache, older);
    expect(expectErr(result).code).toBe('SNAPSHOT_BEHIND');
    // And the cache is untouched: the refusal is not a partial apply.
    expect(readingValue(readTotalKg(cache))).toBe(630);
  });

  it('accepts a repeat of the revision it holds, per policy', () => {
    expect(PROGRESSION_CACHE_POLICY.ACCEPT_REPEATED_REVISION).toBe(true);
    const cache = confirmedCache();
    const same = expectOk(applyServerSnapshot(cache, snapshot({ revision: 7, totalKg: 640 })));
    expect(readingValue(readTotalKg(same))).toBe(640);
  });

  it('parks a projection beside truth instead of inside it', () => {
    // A MEET, not a training session: an optimistic Total is only a legal thing
    // to render on the one day a Total moves (GDD §3.2, §6.4). Pairing this with
    // `A_PROPOSAL` used to compile and no longer does — see the block at the end
    // of this file.
    const cache = confirmedCache();
    const pending = expectOk(
      proposeChange(
        cache,
        asProposalId('p1'),
        A_MEET_PROPOSAL,
        projectionWith({ totalKg: projectedKg(645) }),
      ),
    );
    expect(pending.status).toBe('pending');
    // Truth did not move.
    const snap = cachedSnapshot(pending);
    expect(snap).not.toBeNull();
    expect(snapshotFacts(snap as ProgressionSnapshot).totalKg).toBe(630);
    // The optimistic number is readable, and is flagged as optimistic.
    expect(readTotalKg(pending)).toEqual({ kind: 'projected', value: 645, lastConfirmed: 630 });
  });

  it('holds one proposal at a time', () => {
    expect(PROGRESSION_CACHE_POLICY.MAX_IN_FLIGHT_PROPOSALS).toBe(1);
    const pending = expectOk(
      proposeChange(confirmedCache(), asProposalId('p1'), A_PROPOSAL, emptyProjection()),
    );
    const second = proposeChange(pending, asProposalId('p2'), A_PROPOSAL, emptyProjection());
    expect(expectErr(second).code).toBe('PROPOSAL_ALREADY_IN_FLIGHT');
  });

  it('discards the projection whole when the server acknowledges', () => {
    // Two claims, both inside a meet's reach — a competition Total and the
    // heaviest single that produced it — so "whole" is checked on more than one
    // field. It used to be Total plus streak, which a meet cannot move.
    const pending = expectOk(
      proposeChange(
        confirmedCache(),
        asProposalId('p1'),
        A_MEET_PROPOSAL,
        projectionWith({
          totalKg: projectedKg(645),
          bestE1rmKg: { squat: projectedKg(245), bench: null, deadlift: null },
        }),
      ),
    );
    const settled = expectOk(
      applyServerSnapshot(pending, snapshot({ revision: 8, totalKg: 632, acknowledgedProposalId: 'p1' })),
    );
    expect(settled.status).toBe('confirmed');
    // The server's number, not the client's guess, and not a merge of the two.
    expect(readTotalKg(settled)).toEqual({ kind: 'confirmed', value: 632 });
    expect(readBestE1rmKg(settled, 'squat')).toEqual({ kind: 'confirmed', value: 240 });
    expect(inFlightProposal(settled)).toBeNull();
  });

  it('keeps waiting when a snapshot arrives that settles something else', () => {
    const pending = expectOk(
      proposeChange(
        confirmedCache(),
        asProposalId('p1'),
        A_MEET_PROPOSAL,
        projectionWith({ totalKg: projectedKg(645) }),
      ),
    );
    const elsewhere = expectOk(
      applyServerSnapshot(pending, snapshot({ revision: 9, totalKg: 631, acknowledgedProposalId: 'other' })),
    );
    expect(elsewhere.status).toBe('pending');
    expect(inFlightProposal(elsewhere)?.proposalId).toBe('p1');
    // The base moved; the projection did not become truth.
    expect(readTotalKg(elsewhere)).toEqual({ kind: 'projected', value: 645, lastConfirmed: 631 });
  });

  it('drops the projection and goes stale on a rejection', () => {
    const pending = expectOk(
      proposeChange(
        confirmedCache(),
        asProposalId('p1'),
        A_MEET_PROPOSAL,
        projectionWith({ totalKg: projectedKg(645) }),
      ),
    );
    const rejected = expectOk(rejectProposal(pending, asProposalId('p1')));
    expect(rejected.status).toBe('stale');
    expect(readTotalKg(rejected)).toEqual({ kind: 'stale', value: 630, reason: 'proposal-rejected' });
    expect(inFlightProposal(rejected)).toBeNull();
  });

  it('refuses to reject a proposal that is not the one in flight', () => {
    const pending = expectOk(
      proposeChange(confirmedCache(), asProposalId('p1'), A_PROPOSAL, emptyProjection()),
    );
    expect(expectErr(rejectProposal(pending, asProposalId('p2'))).code).toBe('NO_MATCHING_PROPOSAL');
    expect(expectErr(rejectProposal(confirmedCache(), asProposalId('p1'))).code).toBe('NO_MATCHING_PROPOSAL');
  });

  it('refuses a proposal against stale truth, per policy', () => {
    expect(PROGRESSION_CACHE_POLICY.ACCEPT_PROPOSALS_WHILE_STALE).toBe(false);
    const stale = markCacheStale(confirmedCache(), 'reconnected');
    expect(expectErr(proposeChange(stale, asProposalId('p1'), A_PROPOSAL, emptyProjection())).code).toBe(
      'CACHE_IS_STALE',
    );
  });

  it('still renders stale truth rather than blanking it', () => {
    const stale = markCacheStale(confirmedCache(), 'signed-in-elsewhere');
    expect(readTotalKg(stale)).toEqual({ kind: 'stale', value: 630, reason: 'signed-in-elsewhere' });
    expect(readingValue(readTotalKg(stale))).toBe(630);
  });

  it('recovers from stale on the next snapshot', () => {
    const stale = markCacheStale(confirmedCache(), 'reconnected');
    const fresh = expectOk(applyServerSnapshot(stale, snapshot({ revision: 11, totalKg: 650 })));
    expect(fresh.status).toBe('confirmed');
    expect(readTotalKg(fresh)).toEqual({ kind: 'confirmed', value: 650 });
  });

  it('has nothing to make stale before the first read', () => {
    expect(markCacheStale(emptyProgressionCache(), 'reconnected').status).toBe('empty');
  });

  it('refuses a malformed proposal and a malformed projection', () => {
    const cache = confirmedCache();
    const noSets: ProgressionProposal = {
      kind: 'record-training-session',
      report: {
        deviceWallClock: { year: 2026, month: 8, day: 3, hour: 19 },
        card: { unit: 'kg', kilogramSets: [] },
      },
    };
    expect(expectErr(proposeChange(cache, asProposalId('p1'), noSets, emptyProjection())).code).toBe(
      'INVALID_PROPOSAL',
    );
    const badSpend: ProgressionProposal = {
      kind: 'spend-currency',
      report: { currency: 'chalk', amount: 0, sku: 'singlet-red' },
    };
    expect(expectErr(proposeChange(cache, asProposalId('p1'), badSpend, emptyProjection())).code).toBe(
      'INVALID_PROPOSAL',
    );
  });
});

describe('readings', () => {
  it('reports every fact through the same four-state shape', () => {
    const cache = confirmedCache();
    expect(readBestE1rmKg(cache, 'bench')).toEqual({ kind: 'confirmed', value: 150 });
    expect(readStreakDays(cache)).toEqual({ kind: 'confirmed', value: 12 });
    expect(readBalance(cache, 'chalk')).toEqual({ kind: 'confirmed', value: 40 });
    expect(readMeets(cache).kind).toBe('confirmed');
  });

  it('projects per-lift and per-currency independently', () => {
    const pending = expectOk(
      proposeChange(
        confirmedCache(),
        asProposalId('p1'),
        A_PROPOSAL,
        projectionWith({
          bestE1rmKg: { squat: projectedKg(245), bench: null, deadlift: null },
          wallet: { gymBucks: projectedCount(1250), chalk: null },
        }),
      ),
    );
    expect(readBestE1rmKg(pending, 'squat')).toEqual({ kind: 'projected', value: 245, lastConfirmed: 240 });
    // No projection for bench: the confirmed number, not a stale-looking blank.
    expect(readBestE1rmKg(pending, 'bench')).toEqual({ kind: 'confirmed', value: 150 });
    expect(readBalance(pending, 'gymBucks')).toEqual({ kind: 'projected', value: 1250, lastConfirmed: 1200 });
    expect(readBalance(pending, 'chalk')).toEqual({ kind: 'confirmed', value: 40 });
  });

  it('never projects a meet result', () => {
    const pending = expectOk(
      proposeChange(
        confirmedCache(),
        asProposalId('p1'),
        A_MEET_PROPOSAL,
        projectionWith({ totalKg: projectedKg(645) }),
      ),
    );
    // On meet day of all days: the Total may be optimistic while the meet is
    // still being judged, and the meet list still never is.
    expect(readTotalKg(pending).kind).toBe('projected');
    expect(readMeets(pending).kind).toBe('confirmed');
  });

  it('lets a renderer tell truth from a guess', () => {
    const cache = confirmedCache();
    const pending = expectOk(
      proposeChange(cache, asProposalId('p1'), A_MEET_PROPOSAL, projectionWith({ totalKg: projectedKg(645) })),
    );
    expect(isConfirmedReading(readTotalKg(cache))).toBe(true);
    expect(isConfirmedReading(readTotalKg(pending))).toBe(false);
    expect(isConfirmedReading(readTotalKg(markCacheStale(cache, 'reconnected')))).toBe(false);
    expect(isConfirmedReading(readTotalKg(emptyProgressionCache()))).toBe(false);
  });

  it('returns null for a value nobody has yet', () => {
    expect(readingValue(readTotalKg(emptyProgressionCache()))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// COMPILE-TIME BOUNDARY.
//
// Every `@ts-expect-error` below is an assertion, not a comment: `npm run
// typecheck` fails with TS2578 "Unused '@ts-expect-error' directive" the moment
// one of these lines starts compiling.
//
// EACH ONE WAS MUTATION-CHECKED rather than reasoned about. The guard it names
// was deleted from `progression.ts`, `tsc` was run, the directive was confirmed
// to go unused (TS2578) or the paired type-level assertion was confirmed to
// fail, and the guard was restored. A `@ts-expect-error` on a line that was
// never going to compile for an unrelated reason proves nothing, and the only
// way to tell the difference is to break the thing and look.
//
// ONE RESULT WORTH WRITING DOWN, because it is the sort of overlap that makes a
// check look stronger than it is: `ConfirmedTotalKg` is `Confirmed<
// OfficialTotalKg>`, so it carries TWO brands. Deleting this module's
// `Confirmed` brand does NOT make `const forged: ConfirmedTotalKg = 630` start
// compiling — dots.ts's brand still refuses the bare number. The test that
// isolates *this* module's brand is the e1RM one below, which uses `ConfirmedKg`
// (no second brand on it); that directive does go unused when `Confirmed` is
// removed. Both tests are worth having, but only one of them is evidence about
// the boundary this file builds.
//
// The positive controls in the last block matter as much as the negatives: a
// boundary where nothing compiles is not a boundary, it is a broken module.
// ---------------------------------------------------------------------------

describe('a client cannot mint server truth', () => {
  it('will not accept a bare number as a confirmed total', () => {
    // @ts-expect-error - a plain number is not a ConfirmedTotalKg. There is no
    // exported mint; the only one is inside receiveProgressionSnapshot.
    const forged: ConfirmedTotalKg = 630;
    expect(forged).toBe(630);
  });

  it('will not accept a locally estimated e1RM as a confirmed one', () => {
    // The client is allowed to compute this. It is not allowed to call it truth.
    const local: number = estimateE1rm({ weight: 200, reps: 3, rpe: 8 });
    expect(local).toBeGreaterThan(200);
    // @ts-expect-error - e1rm.ts returns a number, and a number is not confirmed.
    const forged: ConfirmedKg = estimateE1rm({ weight: 200, reps: 3, rpe: 8 });
    expect(forged).toBe(local);
  });

  it('will not accept an officially-minted total as a confirmed one either', () => {
    // dots.ts's `officialTotalKg` is a client-reachable mint on purpose (it has
    // to be — totals arrive from fixtures and NPC tables). It brands a number as
    // "this is a final total"; it does not brand it as "the server said so", and
    // the two are different claims.
    const official: OfficialTotalKg = officialTotalKg(630);
    // @ts-expect-error - OfficialTotalKg is not Confirmed<OfficialTotalKg>.
    const forged: ConfirmedTotalKg = official;
    expect(forged).toBe(630);
  });

  it('will not accept a hand-built object as a snapshot', () => {
    // @ts-expect-error - ProgressionSnapshot's only key is a module-private symbol.
    const forged: ProgressionSnapshot = { revision: 7, facts: {} };
    expect(forged).toBeDefined();
  });

  it('will not let a wire payload into the cache without the mint', () => {
    const cache = confirmedCache();
    // Forced past the compiler it does not quietly work: there is no payload
    // under the private symbol, so the read throws rather than accepting a
    // client-authored total of 900.
    expect(() => {
      // @ts-expect-error - the wire is JSON; only receiveProgressionSnapshot makes truth of it.
      applyServerSnapshot(cache, wire({ revision: 8, totalKg: 900 }));
    }).toThrow(TypeError);
    expect(readingValue(readTotalKg(cache))).toBe(630);
  });

  it('will not let a projection be fed in as a server response', () => {
    // @ts-expect-error - a client projection is not a wire payload.
    const result = receiveProgressionSnapshot(projectionWith({ totalKg: projectedKg(900) }));
    expect(result.ok).toBe(false);
  });

  it('will not accept a raw string where a proposal id is required', () => {
    const cache = confirmedCache();
    // @ts-expect-error - ProposalId is branded; go through asProposalId.
    const result = proposeChange(cache, 'p1', A_PROPOSAL, emptyProjection());
    expect(result.ok).toBe(true);
  });
});

describe('an unconfirmed value cannot be used as a confirmed one', () => {
  it('will not store a projection as truth', () => {
    // @ts-expect-error - ProjectedKg and Confirmed<T> are disjoint brands.
    const forged: ConfirmedTotalKg = projectedKg(900);
    expect(forged).toBe(900);
  });

  it('will not gate meet entry on a projection', () => {
    // GDD §6.1: meets are gated by qualifying totals. Not by a local guess.
    // @ts-expect-error - meetsQualifyingTotal demands a ConfirmedTotalKg.
    const qualified = meetsQualifyingTotal(projectedKg(900), 600);
    expect(qualified).toBe(true);
  });

  it('will not gate meet entry on a bare number either', () => {
    // @ts-expect-error - the `?? 0` shape: a number is not a confirmed total.
    const qualified = meetsQualifyingTotal(630, 600);
    expect(qualified).toBe(true);
  });

  it('will not let a projected total reach a DOTS score', () => {
    // A provisional number cannot get onto a leaderboard: ProjectedKg is not an
    // OfficialTotalKg, so dots.ts refuses it at the type level.
    // @ts-expect-error - dotsScore takes an OfficialTotalKg.
    const fake = dotsScore('male', 93, projectedKg(900));
    expect(fake).toBeGreaterThan(0);
  });

  it('will not let a confirmed number be passed off as a projection', () => {
    const facts = snapshotFacts(snapshot());
    const total = facts.totalKg;
    expect(total).not.toBeNull();
    // The brand is disjoint in both directions — truth is not a guess either.
    // @ts-expect-error - Confirmed<T> is not Projected<T>.
    const backwards: ProjectedKg = total as ConfirmedTotalKg;
    expect(backwards).toBe(630);
  });

  it('will not let a locally advanced streak be written into the facts', () => {
    // streak.ts is pure, so the client really can compute the next state. What
    // it cannot do is put the answer where the server's answer goes.
    const day = streakDayFromCivilDate({ year: 2026, month: 8, day: 3 });
    const advanced = recordTrainingDay(createStreakState(day), day);
    expect(advanced.ok).toBe(true);
    const facts = snapshotFacts(snapshot());
    // @ts-expect-error - a number is not a ConfirmedTotalKg; the facts object
    // cannot be rebuilt with a local total alongside a local streak.
    const forged: ConfirmedFacts = { ...facts, totalKg: 900 };
    expect(forged.totalKg).toBe(900);
  });

  it('will not accept a plain number into a projection either', () => {
    // The projection brand runs the same way: projecting is deliberate too.
    // @ts-expect-error - a plain number is not a ProjectedKg.
    const bad: ProgressionProjection = { ...emptyProjection(), totalKg: 645 };
    expect(bad.totalKg).toBe(645);
  });

  it('will not let a projection invent a fact the server does not have', () => {
    // @ts-expect-error - `meets` is not a projectable fact.
    const bad: ProgressionProjection = { ...emptyProjection(), meets: [] };
    expect(bad).toBeDefined();
  });
});

describe('a projection cannot claim what its proposal cannot move', () => {
  // GDD §3.2, in the type system. Each of these ALSO asserts the runtime
  // refusal, because the `@ts-expect-error` suppresses the error rather than
  // removing the call: one test, both halves. Deleting `ProjectionWithinReach`
  // makes the directives unused (TS2578) and the `expect`s fail — checked by
  // doing it, not by reasoning about it.

  it('will not let a training session project a Total', () => {
    const result = proposeChange(
      confirmedCache(),
      asProposalId('p1'),
      A_PROPOSAL,
      // @ts-expect-error - a training session's reach is bestE1rmKg | streak |
      // wallet, so `totalKg` on its projection is narrowed to `null`.
      projectionWith({ totalKg: projectedKg(645) }),
    );
    expect(expectErr(result).code).toBe('PROJECTION_EXCEEDS_REACH');
  });

  it('will not let a meet result project a streak', () => {
    // NOT ONLY ABOUT TOTALS. The rule is the reach map, read per kind — a meet
    // does not touch the streak, so a meet may not show one moving either. A
    // guard hard-coded to `totalKg` passes the test above and fails this one.
    const result = proposeChange(
      confirmedCache(),
      asProposalId('p1'),
      A_MEET_PROPOSAL,
      // @ts-expect-error - 'streak' is not in a meet result's reach.
      projectionWith({ streak: { currentStreak: projectedCount(13) } }),
    );
    expect(expectErr(result).code).toBe('PROJECTION_EXCEEDS_REACH');
  });

  it('will not let a Recovery Day project an e1RM', () => {
    const result = proposeChange(
      confirmedCache(),
      asProposalId('p1'),
      PROPOSAL_BY_KIND['set-recovery-day-protection'],
      // @ts-expect-error - the Recovery Day setting moves the streak and nothing else.
      projectionWith({ bestE1rmKg: { squat: projectedKg(245), bench: null, deadlift: null } }),
    );
    expect(expectErr(result).code).toBe('PROJECTION_EXCEEDS_REACH');
  });

  it('will not let an unnarrowed proposal claim anything at all', () => {
    // A caller holding a bare `ProgressionProposal` does not know which kind it
    // has, so it does not know what it may claim: the reach used is the
    // INTERSECTION over the union, which is empty. Narrowing with a `switch`
    // gives the projection back.
    const anyProposal: ProgressionProposal = PROPOSAL_BY_KIND['record-meet-result'];
    const result = proposeChange(
      confirmedCache(),
      asProposalId('p1'),
      anyProposal,
      // @ts-expect-error - nothing is within reach of every kind.
      projectionWith({ totalKg: projectedKg(645) }),
    );
    // At runtime the kind IS known, so this particular one is allowed through —
    // the compile-time rule is the strict half, and it is strict on purpose.
    expect(result.ok).toBe(true);
  });

  it('will not take a projection that merely might claim a Total', () => {
    const loose: ProgressionProjection = projectionWith({ totalKg: projectedKg(645) });
    const result = proposeChange(
      confirmedCache(),
      asProposalId('p1'),
      A_PROPOSAL,
      // @ts-expect-error - `ProgressionProjection` says `totalKg` may be present.
      loose,
    );
    expect(expectErr(result).code).toBe('PROJECTION_EXCEEDS_REACH');
  });

  it('takes the pairings the design calls for, with no directive', () => {
    // THE LOCAL POSITIVE CONTROL. Without it this whole block would pass just as
    // well if `proposeChange` had stopped accepting any projection at all.
    const meetDay = proposeChange(
      confirmedCache(),
      asProposalId('p1'),
      A_MEET_PROPOSAL,
      projectionWith({ totalKg: projectedKg(645) }),
    );
    const sessionCloseOut = proposeChange(
      confirmedCache(),
      asProposalId('p1'),
      A_PROPOSAL,
      projectionWith({
        bestE1rmKg: { squat: projectedKg(245), bench: null, deadlift: null },
        streak: { currentStreak: projectedCount(13) },
      }),
    );
    const nothingClaimed = proposeChange(confirmedCache(), asProposalId('p1'), A_PROPOSAL, emptyProjection());
    expect([meetDay.ok, sessionCloseOut.ok, nothingClaimed.ok]).toEqual([true, true, true]);
  });
});

describe('a purchase cannot reach performance', () => {
  it('offers no entitlement effect that moves e1RM', () => {
    // @ts-expect-error - ENTITLEMENT_EFFECT_KINDS has no 'e1rm-boost' and the
    // union is pinned to it by ENTITLEMENT_EFFECTS_ARE_EXACTLY_THE_ALLOWLIST.
    const boost: EntitlementEffect = { kind: 'e1rm-boost', multiplier: 1.05 };
    expect(boost).toBeDefined();
  });

  it('offers no entitlement effect that moves a Total', () => {
    // @ts-expect-error - nor a 'total-bonus'.
    const boost: EntitlementEffect = { kind: 'total-bonus', kg: 10 };
    expect(boost).toBeDefined();
  });

  it('offers no convenience that skips a training session', () => {
    // @ts-expect-error - CONVENIENCE_GRANTS is an allowlist; a session skip is not on it.
    const grant: EntitlementEffect = { kind: 'convenience', grant: 'sim-session-skip' };
    expect(grant).toBeDefined();
  });

  it('will not let a redemption tell the server what it bought', () => {
    // The server resolves the SKU against its own catalogue. A client that
    // cannot name an effect cannot name a forbidden one.
    const report: RedeemEntitlementReport = {
      sku: 'chalk-pack-3',
      receipt: 'txn-1',
      // @ts-expect-error - RedeemEntitlementReport has no `effect` field.
      effect: { kind: 'currency', currency: 'chalk', amount: 300 },
    };
    expect(report.sku).toBe('chalk-pack-3');
  });

  it('will not let a session report carry the e1RM it thinks it earned', () => {
    // @ts-expect-error - TrainingSetReport is inputs only; there is no e1rmKg.
    const report: TrainingSetReport = { lift: 'squat', weight: 200, reps: 3, rpe: 8, e1rmKg: 220 };
    expect(report.weight).toBe(200);
  });

  it('will not let a meet report carry the total it thinks it made', () => {
    // GDD §6.4: total = sum of best successful attempt per lift, computed where
    // the attempts are judged, not where they are displayed.
    const report: MeetResultReport = {
      meetId: asMeetId('meet-1'),
      bodyweight: { unit: 'kg', kilograms: 93 },
      card: { unit: 'kg', kilogramAttempts: [{ lift: 'squat', attemptNumber: 1, weight: 220, good: true }] },
      // @ts-expect-error - MeetResultReport is inputs only; there is no totalKg.
      totalKg: 900,
    };
    expect(report.bodyweight.unit).toBe('kg');
  });

  it('will not let a card hand over its weights without naming a unit', () => {
    // THE COMPILE-TIME HALF OF THE ATTEMPT-UNIT BOUNDARY, and the reason the
    // shape is a tagged pair rather than a `unit` field beside an `attempts`
    // array. There is no field on `MeetCardReport` that yields the nine numbers
    // from both arms, so every expression in the tree that reaches an attempt
    // weight has had to name a unit to get there. A `unit` field beside a shared
    // `attempts` array would have compiled here and left the check deletable.
    //
    // INVISIBLE TO VITEST — esbuild strips the directive — so this is checked by
    // `npm run typecheck`, where an UNUSED `@ts-expect-error` is itself an error.
    const card: MeetCardReport = {
      unit: 'kg',
      kilogramAttempts: [{ lift: 'squat', attemptNumber: 1, weight: 220, good: true }],
    };
    // @ts-expect-error - there is no `attempts` on a card, from either arm.
    const smuggled = card.attempts;
    expect(smuggled).toBeUndefined();
    // ...and the pound arm's field is not reachable off an unnarrowed card either.
    // @ts-expect-error - `poundAttempts` does not exist on the kilogram arm.
    expect(card.poundAttempts).toBeUndefined();
    if (card.unit !== 'kg') throw new Error('unreachable');
    expect(card.kilogramAttempts.length).toBe(1);
  });

  it('pins the property the two tagged readings on this wire are built on', () => {
    // THE RUNTIME TWIN of `A_MEET_CARD_CANNOT_BE_READ_WITHOUT_ITS_UNIT` and
    // `A_BODYWEIGHT_CANNOT_BE_READ_WITHOUT_ITS_UNIT`. Those are type-level and
    // therefore invisible to `npm test`; this asserts the same thing about the
    // values that actually travel.
    //
    // WHICH MUTATIONS EACH ONE CATCHES, because they are not the same set and
    // the difference has been overstated in this codebase before. Renaming one
    // arm's payload field to match the other's fails `tsc` at the assertion — and
    // it also stops this file compiling, so vitest never runs it. Adding a
    // convenience field reachable from BOTH arms (`attempts?:` on each) is the
    // mutation that compiles everywhere else: `tsc` catches it at the assertion,
    // and this test does NOT, because an optional field absent at runtime has no
    // key to see. So the type-level assertion is the load-bearing one and this is
    // the check that the real objects have not drifted from it.
    const kgCard: MeetCardReport = { unit: 'kg', kilogramAttempts: [] };
    const lbCard: MeetCardReport = { unit: 'lb', poundAttempts: [] };
    const kgBody: BodyweightReading = { unit: 'kg', kilograms: 93 };
    const lbBody: BodyweightReading = { unit: 'lb', pounds: 205 };
    const payloadKeys = (value: object): readonly string[] =>
      Object.keys(value).filter((key) => key !== 'unit');
    for (const [a, b] of [
      [kgCard, lbCard],
      [kgBody, lbBody],
    ] as const) {
      const left = payloadKeys(a);
      const right = payloadKeys(b);
      // Non-vacuity first: two arms with no payload at all would be trivially
      // disjoint and would prove nothing.
      expect(left.length).toBeGreaterThan(0);
      expect(right.length).toBeGreaterThan(0);
      expect(left.filter((key) => right.includes(key))).toEqual([]);
    }
  });

  it('has no Recovery Day balance in the wallet to buy against', () => {
    const cache = confirmedCache();
    // @ts-expect-error - 'recoveryDays' is not a WalletCurrency; streak.ts owns that ledger.
    const balance = readBalance(cache, 'recoveryDays');
    expect(balance.kind).toBe('confirmed');
  });

  it('will not let a pending cache be assembled from a literal', () => {
    // The NAIVE shape: an `inFlight` written out by hand. `ProgressionCache` is a
    // transparent union, so this used to compile and skipped `validateProposal`,
    // `validateProjection`, `projectionExceedsReach`, the in-flight limit AND the
    // stale-cache rule in one innocent-looking object literal.
    //
    // INVISIBLE TO VITEST — esbuild strips the directive — so this is checked by
    // `npm run typecheck`, where an UNUSED `@ts-expect-error` is itself an
    // error. That is what makes reopening the hole fail rather than pass.
    // Built in a variable first ON PURPOSE. Writing it inline would test
    // excess-property checking, which is freshness — the weaker of the two
    // guarantees, and the one the loose-spread test below shows can be walked
    // around. Through a variable, what is under test is structural
    // assignability: this object does not have the symbol, so it is not an
    // `InFlightProposal`, however it was written.
    const naive = {
      proposalId: asProposalId('p-forged'),
      proposal: A_PROPOSAL,
      projection: projectionClaiming('totalKg'),
    };
    // @ts-expect-error - InFlightProposal's only property is a private symbol.
    const handBuilt: InFlightProposal = naive;
    const smuggled: ProgressionCache = {
      status: 'pending',
      snapshot: snapshot(),
      inFlight: handBuilt,
    };
    expect(smuggled.status).toBe('pending');
  });

  it('will not let a REAL in-flight proposal be spread and overridden', () => {
    // THE SHAPE THE TEST ABOVE MISSED, AND IT WAS LIVE. The test above pins the
    // shape its author thought of; §2 of the module header warns about a
    // different one. `InFlightProposal` used to be a partly transparent object
    // with a symbol bolted on, so a caller did not have to BUILD one — it could
    // ask for one and spread it:
    //
    //   const real = inFlightProposal(pending)!;
    //   { ...real, projection: aTotal }        // compiled, cast-free
    //
    // and `readTotalKg` then reported a PROJECTED TOTAL on a training session,
    // which is the GDD §3.2 line the whole §4.1 apparatus exists to enforce.
    //
    // The contents now live under the symbol, so there is no string-keyed
    // `projection` to override and this is a compile error. Typecheck-only, same
    // as above.
    //
    // WHAT THIS ONE RESTS ON is excess-property checking of a fresh literal —
    // the reported exploit's exact shape. That is the weaker of the two
    // guarantees and it can be walked around by assigning through a variable, so
    // it is not left standing alone: the next test takes that route and pins
    // what happens instead.
    const pending = expectOk(
      proposeChange(confirmedCache(), asProposalId('p-real'), A_PROPOSAL, emptyProjection()),
    );
    if (pending.status !== 'pending') {
      throw new Error('expected a pending cache');
    }
    const real = pending.inFlight;
    const forged: ProgressionCache = {
      status: 'pending',
      snapshot: snapshot(),
      // @ts-expect-error - there is no string-keyed `projection` to overwrite.
      inFlight: { ...real, projection: projectionClaiming('totalKg') },
    };
    expect(forged.status).toBe('pending');
  });

  it('makes the spread that DOES still compile inert, and this one runs', () => {
    // KNOWN-OPEN, PINNED. Assigning through a variable defeats excess-property
    // checking, so this shape compiles and always will — spread copies symbols.
    // What stops it is that every reader goes through the private symbol, so the
    // planted field is never looked at.
    //
    // This assertion is the one that bites if the hole is reopened: put
    // `projection` back as a plain field and the reader sees 645 instead of the
    // confirmed 630, and this fails at RUNTIME where `npm test` can see it.
    const pending = expectOk(
      proposeChange(confirmedCache(), asProposalId('p-real'), A_PROPOSAL, emptyProjection()),
    );
    if (pending.status !== 'pending') {
      throw new Error('expected a pending cache');
    }
    const loose = { ...pending.inFlight, projection: projectionClaiming('totalKg') };
    const forged: ProgressionCache = { status: 'pending', snapshot: snapshot(), inFlight: loose };

    const reading = readTotalKg(forged);
    expect(reading.kind).toBe('confirmed');
    expect(readingValue(reading)).toBe(630);
    // And the real pairing is what the module still reports.
    expect(inFlightProposal(forged)?.projection.totalKg).toBeNull();
  });

  it('does not let the read model be handed back in', () => {
    // `inFlightProposal` returns an `InFlightProposalView` — the contents, not
    // the container — so reading out is free and writing back is not. This is
    // what stops the exploit at its source rather than only at its destination.
    // Typecheck-only.
    const pending = expectOk(
      proposeChange(confirmedCache(), asProposalId('p-real'), A_PROPOSAL, emptyProjection()),
    );
    const view = inFlightProposal(pending);
    if (view === null) {
      throw new Error('expected a view');
    }
    const forged: ProgressionCache = {
      status: 'pending',
      snapshot: snapshot(),
      // @ts-expect-error - a view carries no symbol, so it is not an InFlightProposal.
      inFlight: view,
    };
    expect(forged.status).toBe('pending');
  });

  it('carries the reuse residual explicitly, so it cannot be silently widened', () => {
    // ALSO KNOWN-OPEN, AND §6 OF THE HEADER SAYS SO. The union is transparent, so
    // a real `InFlightProposal` can be lifted out of a pending cache and
    // re-attached by hand — past the stale-cache rule and the in-flight limit,
    // which are properties of the CACHE.
    //
    // It cannot get past the three that are properties of the PAIRING. That is
    // the claim this test pins, in both directions: the reuse renders (so the
    // residual is real and stated at its true size), and what it renders is a
    // projection that passed `projectionExceedsReach` (so a training session
    // still cannot show a Total this way).
    const meetPending = expectOk(
      proposeChange(confirmedCache(), asProposalId('p-meet'), A_MEET_PROPOSAL, projectionWith({
        totalKg: projectedKg(645),
      })),
    );
    if (meetPending.status !== 'pending') {
      throw new Error('expected a pending cache');
    }
    const checked = meetPending.inFlight;

    // `proposeChange` refuses a stale cache...
    const stale = markCacheStale(confirmedCache(), 'reconnected');
    expect(expectErr(proposeChange(stale, asProposalId('p-x'), A_MEET_PROPOSAL, emptyProjection())).code).toBe(
      'CACHE_IS_STALE',
    );
    // ...and re-attaching a checked pairing by hand gets past that rule.
    const reused: ProgressionCache = { status: 'pending', snapshot: snapshot(), inFlight: checked };
    expect(readTotalKg(reused).kind).toBe('projected');
    expect(readingValue(readTotalKg(reused))).toBe(645);

    // But the pairing it reused is intact: the proposal that justifies the Total
    // is the meet result, not a training session. Welded, not merely branded.
    expect(inFlightProposal(reused)?.proposal.kind).toBe('record-meet-result');
    expect(inFlightProposal(reused)?.proposalId).toBe('p-meet');
  });

  it('still lets proposeChange build one, which is the positive control', () => {
    // A type nothing can mint refuses every forged shape above perfectly and also
    // makes the feature unusable. The door has to still open.
    const pending = expectOk(
      proposeChange(confirmedCache(), asProposalId('p-real'), A_PROPOSAL, emptyProjection()),
    );
    expect(inFlightProposal(pending)?.proposalId).toBe('p-real');
  });

  it('runs the whole legitimate flow end to end', () => {
    // THE OTHER DIRECTION, AND THE ONE A GUARD THAT REFUSES EVERYTHING FAILS.
    // Propose, read the projection back as PROJECTED, receive the acknowledging
    // snapshot, and land on confirmed truth with the projection gone. If any step
    // of this stops working, the fence above has been bought with the product.
    const start = confirmedCache();
    expect(readBestE1rmKg(start, 'squat').kind).toBe('confirmed');

    // 1. Propose a training session that projects a new squat e1RM.
    const pending = expectOk(
      proposeChange(
        start,
        asProposalId('p-flow'),
        A_PROPOSAL,
        projectionWith({ bestE1rmKg: { squat: projectedKg(248), bench: null, deadlift: null } }),
      ),
    );
    expect(pending.status).toBe('pending');

    // 2. The projection is visible, AS a projection, with the truth behind it.
    const projected = readBestE1rmKg(pending, 'squat');
    expect(projected.kind).toBe('projected');
    expect(readingValue(projected)).toBe(248);
    if (projected.kind === 'projected') {
      expect(projected.lastConfirmed).toBe(240);
    }
    // GDD §3.2: the session may not tick a Total, and does not.
    expect(readTotalKg(pending).kind).toBe('confirmed');
    // The read model reports what is in flight.
    expect(inFlightProposal(pending)?.proposalId).toBe('p-flow');

    // 3. The server acknowledges it.
    const ackWire = wire({ revision: 8, bestE1rmKg: { squat: 250, bench: 150, deadlift: 280 } });
    const acked = expectOk(
      receiveProgressionSnapshot({ ...ackWire, acknowledgedProposalId: 'p-flow' }),
    );
    const settled = expectOk(applyServerSnapshot(pending, acked));

    // 4. Confirmed truth, projection discarded, and it is the SERVER's number —
    //    250, not the 248 the client guessed.
    expect(settled.status).toBe('confirmed');
    expect(inFlightProposal(settled)).toBeNull();
    const final = readBestE1rmKg(settled, 'squat');
    expect(final.kind).toBe('confirmed');
    expect(readingValue(final)).toBe(250);
  });
});

describe('the module exports no writer', () => {
  it('has no way to commit a projection', () => {
    // @ts-expect-error - there is no commitProjection, and adding one would make
    // this directive unused and fail the typecheck.
    const commit = progressionModule.commitProjection;
    expect(commit).toBeUndefined();
  });

  it('has no way to set a confirmed total', () => {
    // @ts-expect-error - there is no setConfirmedTotal either.
    const setter = progressionModule.setConfirmedTotal;
    expect(setter).toBeUndefined();
  });

  it('has no exported mint for a confirmed number', () => {
    // @ts-expect-error - `confirm` is module-private and stays that way.
    const mint = progressionModule.confirm;
    expect(mint).toBeUndefined();
  });

  it('exports exactly the surface it is meant to', () => {
    // Mechanical, and the point is that it fails on ANY new export — including
    // one that looks innocent. Adding a writer means editing this list, which
    // means someone reads the file header first.
    const expected = [
      'AN_IN_FLIGHT_PROPOSAL_HAS_NO_STRING_KEY',
      'AN_UNCLAIMED_PROJECTION_IS_A_PROJECTION',
      'A_BODYWEIGHT_CANNOT_BE_READ_WITHOUT_ITS_UNIT',
      'A_DECLARED_ROW_IS_NEVER_ANY',
      'A_MEET_CARD_CANNOT_BE_READ_WITHOUT_ITS_UNIT',
      'A_MEET_RESULT_PROJECTION_CAN_CLAIM_A_TOTAL',
      'A_STARTING_E1RM_SEED_CANNOT_BE_READ_WITHOUT_ITS_UNIT',
      'A_TRAINING_CARD_CANNOT_BE_READ_WITHOUT_ITS_UNIT',
      'A_TRAINING_SESSION_PROJECTION_CANNOT_CLAIM_A_TOTAL',
      'CHOOSE_FEDERATION_REPORT_IS_EXACTLY_ITS_ALLOWLIST',
      'CHOOSE_FEDERATION_REPORT_KEYS',
      'CONFIRMED_MEET_RESULT_KEYS',
      'CONVENIENCE_GRANTS',
      'COSMETIC_SLOTS',
      'ENTITLEMENTS_CANNOT_REACH_PROTECTED_CONCERNS',
      'ENTITLEMENT_EFFECTS_ARE_EXACTLY_THE_ALLOWLIST',
      'ENTITLEMENT_EFFECT_KINDS',
      'ENTITLEMENT_REACH_IS_NOT_VACUOUS',
      'ENTITLEMENT_REACH_NAMES_REAL_FACTS',
      'FACT_PROTECTION',
      'FACT_PROTECTION_COVERS_EVERY_FACT',
      'FACT_PROTECTION_KINDS',
      'MEET_ATTEMPT_REPORT_IS_EXACTLY_ITS_ALLOWLIST',
      'MEET_ATTEMPT_REPORT_KEYS',
      'MEET_CARD_REPORT_IS_EXACTLY_ITS_ALLOWLIST',
      'MEET_CARD_REPORT_KEYS',
      'MEET_RESULT_IS_EXACTLY_ITS_ALLOWLIST',
      'MEET_RESULT_REPORT_IS_EXACTLY_ITS_ALLOWLIST',
      'MEET_RESULT_REPORT_KEYS',
      'MONEY_CARRYING_KINDS_ARE_NOT_VACUOUS',
      'MONEY_ON_THE_WIRE_IS_DECLARED_A_PURCHASE',
      'NO_FACT_MEANS_TRAINING_PACE',
      'NO_OPEN_FACT_NAMES_PERFORMANCE',
      'ONLY_A_MEET_RESULT_MOVES_TOTAL',
      'OPEN_FACTS',
      'OPEN_FACTS_ARE_EXACTLY_WHAT_A_PURCHASE_MAY_REACH',
      'PERFORMANCE_FACT_VOCABULARY',
      'PERFORMANCE_NAMED_FACTS_ARE_NOT_VACUOUS',
      'PROGRESSION_CACHE_POLICY',
      'PROGRESSION_FACTS_ARE_EXACTLY_THE_ALLOWLIST',
      'PROGRESSION_FACT_KEYS',
      'PROGRESSION_PROPOSAL_KINDS',
      'PROJECTION_IS_EXACTLY_ITS_ALLOWLIST',
      'PROJECTION_KEYS',
      'PROJECTION_ONLY_MIRRORS_REAL_FACTS',
      'PROPOSAL_KINDS_ARE_EXACTLY_THE_ALLOWLIST',
      'PROPOSAL_ORIGIN_BY_KIND',
      'PROPOSAL_ORIGIN_COVERS_EVERY_KIND',
      'PROPOSAL_ORIGIN_KINDS',
      'PROPOSAL_REACH_COVERS_EVERY_KIND',
      'PROPOSAL_REACH_NAMES_REAL_FACTS',
      'PROTECTED_CONCERNS',
      'PROTECTED_CONCERNS_ARE_NOT_VACUOUS',
      'PURCHASABLE_KINDS_ARE_NOT_VACUOUS',
      'PURCHASABLE_PROPOSAL_KINDS',
      'PURCHASES_CANNOT_REACH_PROTECTED_CONCERNS',
      'PURCHASE_EVIDENCE_KEYS',
      'PURCHASE_REACH_IS_NOT_VACUOUS',
      'REDEEM_ENTITLEMENT_REPORT_IS_EXACTLY_ITS_ALLOWLIST',
      'REDEEM_ENTITLEMENT_REPORT_KEYS',
      'SET_RECOVERY_DAY_PROTECTION_REPORT_IS_EXACTLY_ITS_ALLOWLIST',
      'SET_RECOVERY_DAY_PROTECTION_REPORT_KEYS',
      'SPEND_CURRENCY_REPORT_IS_EXACTLY_ITS_ALLOWLIST',
      'SPEND_CURRENCY_REPORT_KEYS',
      'STREAK_WIRE_MATCHES_THE_STREAK_ALLOWLIST',
      'TRAINING_CARD_REPORT_IS_EXACTLY_ITS_ALLOWLIST',
      'TRAINING_CARD_REPORT_KEYS',
      'TRAINING_SESSION_REPORT_IS_EXACTLY_ITS_ALLOWLIST',
      'TRAINING_SESSION_REPORT_KEYS',
      'TRAINING_SET_REPORT_IS_EXACTLY_ITS_ALLOWLIST',
      'TRAINING_SET_REPORT_KEYS',
      'UNCLAIMED_PROJECTION_IS_EXACTLY_ITS_ALLOWLIST',
      'WALLET_CURRENCIES',
      'applyServerSnapshot',
      'asMeetId',
      'asProposalId',
      'asServerRevision',
      'cachedSnapshot',
      'declaredRows',
      'emptyProgressionCache',
      'emptyProjection',
      'factsMovedBy',
      'inFlightProposal',
      'isConfirmedReading',
      'markCacheStale',
      'meetsQualifyingTotal',
      'projectedCount',
      'projectedKg',
      'proposeChange',
      'readBalance',
      'readBestE1rmKg',
      'readFederation',
      'readMeets',
      'readStreakDays',
      'readStreakState',
      'readTotalKg',
      'readingValue',
      'receiveProgressionSnapshot',
      'rejectProposal',
      // NOT A WRITER, which is what this list is about. It takes a value away
      // from every writer there is or ever will be — see its docstring for why
      // the boundary needs one exported function that does that.
      'sealServerValue',
      'snapshotAcknowledges',
      'snapshotFacts',
      'snapshotRevision',
    ];
    expect(Object.keys(progressionModule).sort()).toEqual(expected);
  });

  it('accepts a ConfirmedFacts nowhere', () => {
    // The residual documented in §6 of the header: a `ConfirmedFacts` value can
    // be assembled by hand from an existing one, because object brands do not
    // work. It goes nowhere, and this is the check that keeps it that way —
    // every exported function that takes progression state takes a snapshot or
    // a cache, never bare facts.
    const withoutComments = MODULE_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const signatures = [...withoutComments.matchAll(/export function (\w+)\s*(?:<[^>]*>)?\s*\(([\s\S]*?)\)\s*:/g)];
    // Non-vacuity first: a scan that matched nothing would pass forever.
    expect(signatures.length).toBeGreaterThan(15);
    expect(signatures.map((match) => match[1])).toContain('applyServerSnapshot');
    const accepting = signatures.filter((match) => (match[2] ?? '').includes('ConfirmedFacts'));
    expect(accepting.map((match) => match[1])).toEqual([]);
    // And the scan can see parameter types at all — the control for the filter.
    const acceptingSnapshots = signatures.filter((match) => (match[2] ?? '').includes('ProgressionSnapshot'));
    expect(acceptingSnapshots.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Positive controls. If the block above passed because nothing in this module
// compiles, these would fail.
// ---------------------------------------------------------------------------

describe('the boundary lets legitimate work through', () => {
  it('scores a confirmed total with dots.ts, with no cast', () => {
    const facts = snapshotFacts(snapshot());
    const total = facts.totalKg;
    if (total === null) {
      throw new Error('fixture should have a total');
    }
    // No cast anywhere on this line: a ConfirmedTotalKg IS an OfficialTotalKg.
    const score = dotsScore('male', 93, total);
    expect(score).toBeCloseTo(dotsScore('male', 93, officialTotalKg(630)), 9);
    expect(score).toBeGreaterThan(300);
  });

  it('gates meet entry on a confirmed total, with no cast', () => {
    const total = snapshotFacts(snapshot()).totalKg;
    if (total === null) {
      throw new Error('fixture should have a total');
    }
    expect(meetsQualifyingTotal(total, 600)).toBe(true);
    expect(meetsQualifyingTotal(total, 700)).toBe(false);
  });

  it('does arithmetic and formatting on confirmed numbers', () => {
    const facts = snapshotFacts(snapshot());
    const squat = facts.bestE1rmKg.squat;
    if (squat === null) {
      throw new Error('fixture should have a squat e1RM');
    }
    const asNumber: number = squat;
    expect(asNumber * 2).toBe(480);
    expect(squat.toFixed(1)).toBe('240.0');
    expect(Math.max(...LIFT_ORDER.map((lift: LiftKind) => facts.bestE1rmKg[lift] ?? 0))).toBe(280);
  });

  it('projects an optimistic e1RM from the same pure math the server would use', () => {
    // The intended client path end to end: compute locally with e1rm.ts, mark
    // it as a projection, propose the INPUTS, render the guess as a guess.
    const set = { weight: 200, reps: 3, rpe: 8 } as const;
    const projected = projectedKg(estimateE1rm(set));
    const pending = expectOk(
      proposeChange(
        confirmedCache(),
        asProposalId('p1'),
        {
          kind: 'record-training-session',
          report: {
            deviceWallClock: { year: 2026, month: 8, day: 3, hour: 19 },
            card: {
              unit: 'kg',
              kilogramSets: [
                {
                  lift: set.weight > 0 ? 'squat' : 'bench',
                  weight: set.weight,
                  reps: set.reps,
                  rpe: set.rpe,
                  executionQuality: 1,
                },
              ],
            },
          },
        },
        projectionWith({ bestE1rmKg: { squat: projected, bench: null, deadlift: null } }),
      ),
    );
    const reading = readBestE1rmKg(pending, 'squat');
    expect(reading.kind).toBe('projected');
    expect(readingValue(reading)).toBeCloseTo(estimateE1rm(set), 9);
  });

  it('mints ids and revisions the client is allowed to mint', () => {
    expect(asProposalId('p1')).toBe('p1');
    expect(asMeetId('meet-1')).toBe('meet-1');
    expect(asServerRevision(3)).toBe(3);
    expect(() => asProposalId('  ')).toThrow(RangeError);
    expect(() => asMeetId('')).toThrow(RangeError);
    expect(() => asServerRevision(-1)).toThrow(RangeError);
  });

  it('refuses a nonsense projection at the mint', () => {
    expect(() => projectedKg(0)).toThrow(RangeError);
    expect(() => projectedKg(Number.NaN)).toThrow(RangeError);
    expect(() => projectedCount(-1)).toThrow(RangeError);
    expect(() => projectedCount(1.5)).toThrow(RangeError);
  });

  it('answers the acknowledgement question directly', () => {
    const snap = snapshot({ acknowledgedProposalId: 'p1' });
    expect(snapshotAcknowledges(snap, asProposalId('p1'))).toBe(true);
    expect(snapshotAcknowledges(snap, asProposalId('p2'))).toBe(false);
    expect(snapshotAcknowledges(snapshot(), asProposalId('p1'))).toBe(false);
  });

  it('builds every proposal kind the design calls for', () => {
    const proposals: readonly ProgressionProposal[] = [
      A_PROPOSAL,
      {
        kind: 'set-recovery-day-protection',
        report: { deviceWallClock: { year: 2026, month: 8, day: 3, hour: 9 }, protectionEnabled: false },
      },
      {
        kind: 'record-meet-result',
        report: {
          meetId: asMeetId('meet-1'),
          bodyweight: { unit: 'kg', kilograms: 93 },
          card: { unit: 'kg', kilogramAttempts: [{ lift: 'squat', attemptNumber: 1, weight: 220, good: true }] },
        },
      },
      { kind: 'redeem-entitlement', report: { sku: 'chalk-pack-3', receipt: 'txn-1' } },
      { kind: 'spend-currency', report: { currency: 'gymBucks', amount: 500, sku: 'gym-decor-neon' } },
      { kind: 'choose-federation', report: { federationId: 'ironline' } },
    ];
    expect(proposals.map((p) => p.kind).sort()).toEqual([...PROGRESSION_PROPOSAL_KINDS].sort());
    for (const proposal of proposals) {
      expect(proposeChange(confirmedCache(), asProposalId('p1'), proposal, emptyProjection()).ok).toBe(true);
    }
  });

  it('builds every entitlement effect the catalogue allows', () => {
    const effects: readonly EntitlementEffect[] = [
      { kind: 'cosmetic', slot: 'singlet' },
      { kind: 'convenience', grant: 'gym-empire-timer-skip' },
      { kind: 'currency', currency: 'chalk', amount: 300 },
      { kind: 'recovery-day', count: 3 },
    ];
    expect(effects.map((e) => e.kind).sort()).toEqual([...ENTITLEMENT_EFFECT_KINDS].sort());
  });
});
