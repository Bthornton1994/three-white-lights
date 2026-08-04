import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { dotsScore, officialTotalKg, type BodyweightReading, type OfficialTotalKg } from './dots';
import { estimateE1rm } from './e1rm';
import { LIFT_ORDER, type LiftKind } from './meet';
import * as progressionModule from './progression';
import {
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
// { ...newServerRecord(), totalKg: 900 }` appended to `App.tsx` compiled clean,
// passed every test here, and added no row. `tsconfig.json` already knew better:
// `parsed.fileNames` was being computed two lines above the hand-walk and thrown
// away. The scan is now rooted in it, which is exactly the set `npm run
// typecheck` checks, so "it compiles into this app" and "this scan sees it" are
// the same statement rather than two overlapping ones.
// ---------------------------------------------------------------------------

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** One row of §7.5: a place a record, a wire, or a snapshot read comes from. */
interface RouteSite {
  readonly kind: 'record' | 'wire' | 'receive';
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

const IS_TEST_FILE = /\.test\.tsx?$/;

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
 * How far into a type the import scan will chase a `ServerRecord`.
 *
 * `applyMeetResult` returns `ProgressionResult<{ record: ServerRecord; … }>`,
 * which is three hops (union arm → object → property), so the bound has to
 * clear that with room. It is a cost control, not a judgement: raising it
 * widens the candidate set, which makes the reflection guard STRICTER, so an
 * over-generous value is the safe direction to be wrong in.
 */
const IMPORT_TYPE_REACH_DEPTH = 8;

/**
 * Everything the scan found, split into what ships and what is a fixture.
 *
 * `candidateFiles` is the set the reflection guard runs over: every non-test
 * file that could obtain a `ServerRecord` at all.
 *
 * `scannedFiles` is every repository file the program actually parsed. It
 * exists so the non-vacuity tests can name `App.tsx` and `index.ts` and fail
 * loudly the day someone narrows the root set again.
 */
interface RouteScan {
  readonly shipped: readonly RouteSite[];
  readonly fixtures: readonly RouteSite[];
  readonly candidateFiles: readonly string[];
  readonly scannedFiles: readonly string[];
}

function scanRoutes(): RouteScan {
  // THE ROOT SET. `parsed.fileNames` is what `tsconfig.json`'s own
  // `include`/`exclude` resolve to — `App.tsx`, `index.ts`, `vitest.config.ts`
  // and all of `src/` — and it is the same list `tsc --noEmit` compiles. The
  // previous version of this function computed `parsed` for its `options`,
  // discarded `fileNames`, and hand-walked `src/` instead; see the header note
  // above for the route that survived in the gap.
  const configPath = path.join(REPO_ROOT, 'tsconfig.json');
  const config = ts.readConfigFile(configPath, ts.sys.readFile).config as unknown;
  const parsed = ts.parseJsonConfigFileContent(config, ts.sys, REPO_ROOT);
  if (parsed.fileNames.length === 0) {
    throw new Error('tsconfig.json resolved to no files — the route pin would pass vacuously');
  }
  const program = ts.createProgram([...parsed.fileNames], {
    ...parsed.options,
    noEmit: true,
    skipLibCheck: true,
  });
  const checker = program.getTypeChecker();

  /** Repo-relative posix path, or `null` for anything outside the repo. */
  const repoPathOf = (fileName: string): string | null => {
    const rel = path.relative(REPO_ROOT, fileName).split(path.sep).join('/');
    if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return null;
    if (IS_VENDORED.test(rel)) return null;
    return rel;
  };

  // The two interfaces the pin is about, resolved from their declarations so a
  // same-named type in another module cannot be mistaken for one of them.
  const targets: {
    readonly kind: 'record' | 'wire';
    readonly name: string;
    readonly from: string;
    type?: ts.Type;
    symbol?: ts.Symbol;
    declaredIn?: ts.SourceFile;
  }[] = [
    { kind: 'record', name: 'ServerRecord', from: 'src/game/sessionServer.ts' },
    { kind: 'wire', name: 'ProgressionSnapshotWire', from: 'src/game/progression.ts' },
  ];
  for (const target of targets) {
    const declaring = program.getSourceFile(path.join(REPO_ROOT, target.from));
    if (declaring === undefined) throw new Error(`${target.from} is not in the program`);
    target.declaredIn = declaring;
    declaring.forEachChild((node) => {
      if (ts.isInterfaceDeclaration(node) && node.name.text === target.name) {
        target.type = checker.getTypeAtLocation(node.name);
        target.symbol = checker.getSymbolAtLocation(node.name);
      }
    });
    if (target.type === undefined || target.symbol === undefined) {
      throw new Error(`no interface ${target.name} in ${target.from}`);
    }
  }

  const receiverName = 'receiveProgressionSnapshot';
  const receiverFile = path.join(REPO_ROOT, 'src/game/progression.ts');

  /**
   * One frame, named, or `null` for a node that is not one.
   *
   * `ts.isPropertyDeclaration` is here because it was missing: a class property
   * arrow — `private readonly build = (): ServerRecord => …` — matched none of
   * the other forms, so the walk ran past it to the module and reported
   * `<module>`. Nothing in the repo is written that way today, which is exactly
   * why it was worth adding rather than waiting for one.
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
        ts.isFunctionExpression(node)) &&
      node.name !== undefined
    ) {
      return node.name.getText();
    }
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
  // THE REFLECTION GUARD'S CANDIDATE SET — AN IMPORT CHECK, NOT A TOKEN MATCH.
  //
  // The argument for scoping the guard has always been about IMPORTS: "a module
  // that imports nothing from this boundary has nothing to clone". The check was
  // a regex over identifiers — `\b(ServerRecord|ProgressionSnapshotWire|
  // sessionServer|localSessionServer)\b` — and the two do not line up.
  // `meetPreview.ts` exports `previewServerRecord(): ServerRecord`, and
  // `\bServerRecord\b` does not match inside `previewServerRecord`. A file
  // importing THAT obtained a real record, matched no trigger, was not a
  // candidate, and could `Object.assign` freely; forge there, call
  // `snapshotWireFor` from a clean candidate file, hand the wire to the pinned
  // `receiveSnapshot`, and no row moves. Latent rather than live — that
  // function's only shipped consumer also imports `sessionServer` — but the fix
  // is to make the set match the argument rather than to add more tokens, since
  // the next export named around the type would reopen it.
  //
  // So: a file is a candidate if it DECLARES a target type, or if any symbol it
  // imports from a repository module has a type that REACHES one. That is
  // transitive for free — a wrapper whose inferred return type is `ServerRecord`
  // makes its importer a candidate without this needing to know the wrapper
  // exists — and it is bounded to repo modules because a target type cannot be
  // obtained from `react-native`.
  // -------------------------------------------------------------------------
  const targetSymbols = new Set(
    targets.map((target) => target.symbol).filter((symbol): symbol is ts.Symbol => symbol !== undefined),
  );

  /**
   * Is this type's own declaration inside the repository?
   *
   * THE ONE PLACE THIS WALK NARROWS, AND IT IS STATED RATHER THAN BURIED. The
   * walk does not descend into the MEMBERS of a type declared in
   * `node_modules` — a `ViewStyle` has hundreds of properties, each of which
   * has hundreds, and chasing them cost 53 seconds against the 0.4 this does.
   * It still descends into TYPE ARGUMENTS and UNION ARMS unconditionally, so
   * `Promise<ServerRecord>`, `Array<ServerRecord>` and
   * `ServerRecord | null` are all caught through a foreign wrapper. A type with
   * no declaration at all — an anonymous object type — is treated as ours and
   * walked.
   *
   * What it can miss: a foreign type that exposes a record through a MEMBER
   * rather than a parameter, e.g. a third-party container whose `.value` is
   * typed `ServerRecord` by declaration merging. Nothing in this repo does
   * that. This narrows the CANDIDATE SET, which makes the reflection guard
   * cover fewer files, so it is a real (small) hole and is listed in §7.5's
   * residual rather than argued away.
   */
  const isOurs = (type: ts.Type): boolean => {
    const declarations = (type.aliasSymbol ?? type.getSymbol())?.declarations;
    if (declarations === undefined || declarations.length === 0) return true;
    return declarations.some((node) => repoPathOf(node.getSourceFile().fileName) !== null);
  };

  const typeReaches = (type: ts.Type, at: ts.Node, seen: Set<ts.Type>, depth: number): boolean => {
    if (depth < 0 || seen.has(type)) return false;
    seen.add(type);
    const symbol = type.aliasSymbol ?? type.getSymbol();
    if (symbol !== undefined && targetSymbols.has(symbol)) return true;
    if (type.isUnionOrIntersection()) {
      return type.types.some((part) => typeReaches(part, at, seen, depth - 1));
    }
    const isReference =
      (type.flags & ts.TypeFlags.Object) !== 0 &&
      ((type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference) !== 0;
    if (isReference) {
      for (const argument of checker.getTypeArguments(type as ts.TypeReference)) {
        if (typeReaches(argument, at, seen, depth - 1)) return true;
      }
    }
    if (!isOurs(type)) return false;
    for (const signature of [...type.getCallSignatures(), ...type.getConstructSignatures()]) {
      if (typeReaches(checker.getReturnTypeOfSignature(signature), at, seen, depth - 1)) return true;
      for (const parameter of signature.getParameters()) {
        const parameterType = checker.getTypeOfSymbolAtLocation(parameter, at);
        if (typeReaches(parameterType, at, seen, depth - 1)) return true;
      }
    }
    for (const property of type.getProperties()) {
      const propertyType = checker.getTypeOfSymbolAtLocation(property, at);
      if (typeReaches(propertyType, at, seen, depth - 1)) return true;
    }
    return false;
  };

  /** Does this file import a value or type from which a target can be had? */
  const importsTheBoundary = (source: ts.SourceFile): boolean => {
    let found = false;
    const consider = (name: ts.Node): void => {
      if (found) return;
      const symbol = checker.getSymbolAtLocation(name);
      if (symbol === undefined) return;
      const resolved =
        (symbol.flags & ts.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(symbol) : symbol;
      if (targetSymbols.has(resolved)) {
        found = true;
        return;
      }
      if (typeReaches(checker.getTypeOfSymbolAtLocation(resolved, name), name, new Set(), IMPORT_TYPE_REACH_DEPTH)) {
        found = true;
      }
    };
    source.forEachChild((node) => {
      if (found) return;
      if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) return;
      // Only repository modules. A target type cannot come out of `expo`, and
      // walking `react-native`'s types would cost more than the whole scan.
      const specifier = node.moduleSpecifier;
      if (specifier === undefined || !ts.isStringLiteral(specifier)) return;
      const resolvedModule = checker.getSymbolAtLocation(specifier)?.declarations?.[0]?.getSourceFile();
      if (resolvedModule === undefined || repoPathOf(resolvedModule.fileName) === null) return;
      const clause = ts.isImportDeclaration(node) ? node.importClause : node.exportClause;
      if (clause === undefined) return;
      if (ts.isImportClause(clause)) {
        if (clause.name !== undefined) consider(clause.name);
        const bindings = clause.namedBindings;
        if (bindings !== undefined) {
          if (ts.isNamespaceImport(bindings)) consider(bindings.name);
          else for (const element of bindings.elements) consider(element.name);
        }
      } else if (ts.isNamedExports(clause)) {
        for (const element of clause.elements) consider(element.name);
      } else {
        // `export * as ns from './m'` — the namespace carries every export.
        consider(clause.name);
      }
    });
    return found;
  };

  const candidateFiles: string[] = [];
  const scannedFiles: string[] = [];

  for (const source of program.getSourceFiles()) {
    if (source.isDeclarationFile) continue;
    const rel = repoPathOf(source.fileName);
    if (rel === null) continue;
    scannedFiles.push(rel);
    if (
      !IS_TEST_FILE.test(rel) &&
      (targets.some((target) => target.declaredIn === source) || importsTheBoundary(source))
    ) {
      candidateFiles.push(rel);
    }
    const visit = (node: ts.Node): void => {
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
          if (byContext || byShape) tally(target.kind, rel, enclosingSite(node));
        }
      }
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        const identifier = ts.isIdentifier(callee)
          ? callee
          : ts.isPropertyAccessExpression(callee)
            ? callee.name
            : undefined;
        if (identifier !== undefined && identifier.text === receiverName) {
          const symbol = checker.getSymbolAtLocation(identifier);
          const resolved =
            symbol !== undefined && (symbol.flags & ts.SymbolFlags.Alias) !== 0
              ? checker.getAliasedSymbol(symbol)
              : symbol;
          const declaredIn = resolved?.declarations?.[0]?.getSourceFile().fileName;
          if (declaredIn === receiverFile) tally('receive', rel, enclosingSite(node));
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
    candidateFiles: candidateFiles.sort(),
    scannedFiles: scannedFiles.sort(),
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
    if (kind !== 'record' && kind !== 'wire' && kind !== 'receive') {
      throw new Error(`§7.5 has a row of unknown kind "${kind}"`);
    }
    return { kind, file: match[2] ?? '', site: match[3] ?? '', n: Number(match[4]) };
  });
}

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
      currentStreak: 12,
      longestStreak: 31,
      lastTrainedDay: 20_000,
      armedRecoveryDays: 2,
      recoveryDayBalance: 2,
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
    card: { unit: 'kg', kilogramSets: [{ lift: 'squat', weight: 200, reps: 3, rpe: 8 }] },
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

  it('scans the whole project, not just src/', () => {
    // THE ROUND-SEVEN DEFECT, PINNED BY NAME. The scan was rooted at
    // `walk(REPO_ROOT + '/src')`. `App.tsx` and `index.ts` are at the repo root
    // and every import points INTO `src/` and never out, so neither was reached
    // directly or transitively — and a fully annotated
    // `const seeded: ServerRecord = { ...newServerRecord(), totalKg: 900 }`
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
    expect(routeScan().shipped.length).toBeGreaterThan(4);
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
    expect(declaredRoutes().length).toBeGreaterThan(4);
    const found = new Set(sortedKeys(routeScan().shipped));
    for (const row of declaredRoutes()) {
      expect(
        found.has(routeKey(row)),
        `progression.ts §7.5 names ${row.kind} ${row.file} ${row.site} x${row.n}, and the scan does not find it — delete the row or fix the count`,
      ).toBe(true);
    }
  });

  it('rules test fixtures out of §7.5 rather than matching none of them', () => {
    // THE EXCLUSION IS A RULING, NOT A FILTER THAT QUIETLY FINDS NOTHING — the
    // guard `realIp.test.ts` puts on its own omission list. Fixtures are out
    // because `meetServer.test.ts` and `sessionClient.test.ts` build a dozen
    // records between them and every new one would make §7.5 red, which trains
    // exactly the "edit the number" reflex the table exists to prevent. A
    // fixture also reaches no player and persists nothing.
    //
    // What this asserts is that the scan SEES them, so the exclusion is a
    // decision about a set that exists.
    expect(routeScan().fixtures.length).toBeGreaterThan(5);
    expect(routeScan().fixtures.map((row) => row.file)).toContain('src/game/meetServer.test.ts');
    // ...and no fixture leaked into the pinned table.
    expect(declaredRoutes().filter((row) => IS_TEST_FILE.test(row.file))).toEqual([]);
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

  it('lets no module that can reach a ServerRecord forge one without an object literal', () => {
    // THE RESIDUAL THE SCAN CANNOT SEE, closed by a cruder check rather than
    // argued away. `Object.assign({}, record, { totalKg: 900 })` produces a
    // record with no object literal for the checker to type: the `{}` is not a
    // `ServerRecord` and neither is the patch. Same for `structuredClone` and
    // for anything laundered through `as unknown as`.
    //
    // Scoped to files that can actually obtain one — a module that imports
    // nothing from this boundary has nothing to clone. THE SCOPE IS NOW THE
    // ARGUMENT ITSELF rather than a token match standing in for it: a file is a
    // candidate if it declares a target type or if any symbol it imports from a
    // repository module has a type that REACHES one. See `importsTheBoundary`
    // for what that still misses, and §7.5 item 2 for why the token match was
    // not the same question.
    expect(routeScan().candidateFiles).toContain('src/game/sessionServer.ts');
    expect(routeScan().candidateFiles).toContain('src/session/sessionPreview.ts');
    expect(routeScan().candidateFiles).toContain('src/game/meetPreview.ts');
    expect(routeScan().candidateFiles.length).toBeGreaterThan(5);
    for (const file of routeScan().candidateFiles) {
      const code = codeOnly(readFileSync(path.join(REPO_ROOT, file), 'utf8'));
      expect(code, `${file} uses Object.assign`).not.toMatch(/Object\.assign\s*\(/);
      expect(code, `${file} uses structuredClone`).not.toMatch(/structuredClone\s*\(/);
      expect(code, `${file} casts through unknown`).not.toMatch(/as unknown as/);
    }
  });

  it('picks candidates by what they import, not by what words they contain', () => {
    // THE CONTROL FOR THE PARAGRAPH ABOVE, in both directions, because "scoped
    // to files that can obtain one" is worth nothing if the scoping is really
    // the old regex wearing a type checker's coat.
    //
    // The old trigger was `\b(ServerRecord|ProgressionSnapshotWire|sessionServer|
    // localSessionServer)\b` over comment-stripped source. Two disagreements
    // prove the sets are not the same instrument:
    const OLD_TRIGGER =
      /\b(ServerRecord|ProgressionSnapshotWire|sessionServer|localSessionServer)\b/;
    const candidates = routeScan().candidateFiles;
    const codeOf = (file: string): string => codeOnly(readFileSync(path.join(REPO_ROOT, file), 'utf8'));

    // (1) IN THE NEW SET, INVISIBLE TO THE OLD ONE. These reach a record only
    //     through a hook or a re-export, and spell none of the four tokens.
    //     `\bServerRecord\b` does not match inside `previewServerRecord`, which
    //     is the shape of the hole: import that, get a real record, trip no
    //     trigger, forge freely.
    const reachedByTypeOnly = candidates.filter((file) => !OLD_TRIGGER.test(codeOf(file)));
    expect(reachedByTypeOnly.length, 'the import check found nothing the token match missed').toBeGreaterThan(0);
    // Anchored by name as well as by count, so this cannot go vacuous through
    // some unrelated file drifting in. `MeetScreen.tsx` reaches a record only
    // through `useMeetDay`'s return type (`applied.record`) and spells none of
    // the four tokens. If it genuinely stops reaching one, edit this line —
    // that is a real change, and it should be visible in a diff.
    expect(reachedByTypeOnly).toContain('src/meet/MeetScreen.tsx');

    // (2) OUT OF THE NEW SET, IN THE OLD ONE. A file may spell `ServerRecord`
    //     in a string — a citation, a watchlist row — without importing
    //     anything that can produce one, and guarding it was noise.
    expect(candidates).not.toContain('src/licensing/realIp.ts');
    expect(OLD_TRIGGER.test(codeOf('src/licensing/realIp.ts'))).toBe(true);
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
    const writes = codeOnly(MODULE_SOURCE).match(/\[SNAPSHOT_CONTENTS\]:/g) ?? [];
    expect(writes).toHaveLength(2);
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
    const writes = codeOnly(MODULE_SOURCE).match(/\[PAIRING_CHECKED\]:/g) ?? [];
    expect(writes).toHaveLength(2);
    // And it is a real `unique symbol`, not a string key a caller could guess.
    expect(codeOnly(MODULE_SOURCE)).toMatch(/const PAIRING_CHECKED: unique symbol = Symbol\(/);
    expect(codeOnly(MODULE_SOURCE)).not.toMatch(/export const PAIRING_CHECKED/);
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
    // One consumable, one ledger. `streak.ts` holds it, with the hold cap and
    // the consecutive-use limit attached.
    expect([...WALLET_CURRENCIES]).toEqual(['gymBucks', 'chalk']);
    const facts = snapshotFacts(snapshot());
    expect(Object.keys(facts.wallet)).not.toContain('recoveryDays');
    expect(facts.streak.recoveryDayBalance).toBe(2);
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
    expect([...TRAINING_SET_REPORT_KEYS].sort()).toEqual(['lift', 'reps', 'rpe', 'weight']);
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
    const snap = snapshot();
    const facts = snapshotFacts(snap);
    expect(Object.isFrozen(snap)).toBe(true);
    expect(Object.isFrozen(facts)).toBe(true);
    expect(Object.isFrozen(facts.wallet)).toBe(true);
    expect(Object.isFrozen(facts.meets)).toBe(true);
    expect(() => {
      (facts as { totalKg: number | null }).totalKg = 900;
    }).toThrow(TypeError);
    expect(snapshotFacts(snap).totalKg).toBe(630);
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
    const advanced = recordTrainingDay(createStreakState(), day);
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
      'readMeets',
      'readStreakDays',
      'readStreakState',
      'readTotalKg',
      'readingValue',
      'receiveProgressionSnapshot',
      'rejectProposal',
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
                { lift: set.weight > 0 ? 'squat' : 'bench', weight: set.weight, reps: set.reps, rpe: set.rpe },
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
