/**
 * empireForbiddenOutput.test.ts — can anything in `src/empire/` hand out a
 * forbidden name?
 *
 * ===========================================================================
 * WHY THIS FILE EXISTS, AND WHAT IT IS NOT
 * ===========================================================================
 *
 * GDD §12.3 forbids the idle layer paying a covered day, and CLAUDE.md records
 * the tree-wide guard for that rule — `NAMES_A_COVERED_DAY_OR_A_PURCHASE` in
 * `src/game/streakEntitlement.ts` — being wrong on REACH, fixed, wrong on
 * PREDICATE, fixed, and wrong on reach again. All three fixes widened a scan
 * over source TEXT. The third axis, reported in CLAUDE.md and reproduced by the
 * lead agent, is that a source scan is the wrong instrument: the words are
 * chosen by the author, so a scan for words is a scan for authors who
 * cooperate. The reproduction reads the string out of `EMPIRE_FORBIDDEN_OUTPUTS`
 * itself, spells no forbidden word anywhere, adds no import edge and uses no
 * bare number — and `tsc --noEmit` exits 0 with the whole suite green.
 *
 * This file is the behavioural-and-type-level answer for this directory only.
 * It does not touch `src/game/`, it does not widen any regex, and it makes no
 * claim about any directory but this one.
 *
 * ===========================================================================
 * THE TWO INSTRUMENTS, EACH WITH ITS PROPERTY, ITS LIMIT, AND THE OTHER NAMED
 * AS THE CATCHER FOR THAT LIMIT
 * ===========================================================================
 *
 * The shape is CLAUDE.md's "The Form That Survived": a bounded claim, a
 * declared limit, and a named catcher — with the route run against the check
 * rather than asserted about it. The mutation results are in this file's
 * `PLANTED_ROUTES` table and in the piece's report.
 *
 * INSTRUMENT A — THE TYPE-LEVEL POSITION CENSUS (`stringSurface`).
 *
 *   What it guarantees, in the mechanism's own terms: for every one of this
 *   directory's exports, every `string`-valued position reachable from that
 *   export's TYPE — through unions, intersections, arrays, tuples, object
 *   properties, index signatures and the return types of function-valued
 *   properties — is classified by the TypeScript checker as one of
 *   (a) a closed string-literal union, (b) a branded string, or (c) a bare
 *   `string`; the (a) members are asserted to contain no banned name, and the
 *   (b) and (c) POSITION LISTS are pinned as set equalities in both directions.
 *
 *   So the bite is not that bare strings are absent — six of them are
 *   legitimate and are listed in `DECLARED_BARE_STRING_POSITIONS` with a reason
 *   each. The bite is that a NEW one cannot arrive unnoticed. The reproduced
 *   defect returns `{ readonly kind: string; readonly days: number }`, which is
 *   a seventh position, and that is what reddens.
 *
 *   Its limit, stated because no type reaches past it: it cannot see a value
 *   that is legitimately typed as a string. `NpcLifter.displayName` is a bare
 *   `string` on purpose, and nothing in a signature says whether the string in
 *   it is a player's chosen name or `'covered-day'`. Instrument B is the
 *   catcher for that limit, and it is pointed at exactly those six positions by
 *   `SENTINELS`.
 *
 *   Its second limit: it reads DECLARED types, so `as string`, `as unknown as
 *   T` and a `JSON.parse` round trip all erase what it reads. That is attack
 *   shape 18 and it is also covered by instrument B, which reads values.
 *
 * INSTRUMENT B — THE BEHAVIOURAL DRIVE AND DEEP SCAN (`observeEverything`).
 *
 *   What it guarantees, in the mechanism's own terms: every export of this
 *   directory is driven or read; every value reachable from what comes back —
 *   through own enumerable AND non-enumerable keys, through property KEYS as
 *   well as values, through getters (invoked), arrays, `Map` keys and values,
 *   `Set` members, frozen structures, thrown payloads and every argument
 *   re-read after the call — is compared against `BANNED_VOCABULARY` under the
 *   named folds in `NORMALISATION_FOLDS`, by equality for every value and by
 *   containment for every value outside the declared diagnostic channel.
 *
 *   Its limit: it samples inputs. A branch no point of the domain reaches
 *   produces nothing to scan. That is why the domain is derived from the
 *   subject's own branch points (`BRANCH_POINTS`, read out of `EMPIRE_TUNING`)
 *   rather than from what looks extreme — CLAUDE.md's "a domain that samples
 *   only extremes is empty where it matters", which was earned on a probe that
 *   sampled `0` and `1_000_000` while every threshold sat between 260 and 680.
 *   The reproduced defect has this property exactly: `Math.floor(checkIns / 12)`
 *   is `0` for every `checkIns` below twelve.
 *
 *   Its second limit: it is a value check, so it has a decode horizon. A
 *   function returning an INDEX that a later wiring piece uses to select a
 *   forbidden name (attack shape 15) carries no string and is invisible here.
 *   Instrument A is the catcher for the branded-string half of that shape
 *   (`asNpcId(...)` widens a new branded position and reddens the census); the
 *   plain-number half has no catcher in this file and is declared below.
 *
 * ===========================================================================
 * WHAT NEITHER INSTRUMENT CATCHES — NAMED CONCRETELY, BECAUSE AN UNDECLARED
 * LIMIT IS THE DEFECT THIS CODEBASE HAS RECORDED EIGHT TIMES
 * ===========================================================================
 *
 * ATTACK SHAPE 16, THE EFFECT WITH NO NAME ANYWHERE. An export
 * `idleProtectionDays(checkIns: number): number` returning
 * `Math.floor(checkIns / OFFLINE_EARNINGS_CAP_HOURS)` contains no forbidden
 * name in its source, its return value, a key, a throw, at any depth, under any
 * fold. NO NAME-BASED GUARD CAN CATCH IT, because the hazard is a quantity and
 * both instruments here are about a word. It was planted and both instruments
 * stayed green; the run is recorded in `PLANTED_ROUTES`.
 *
 * What DOES fire on it, and it is worth being exact about how much that is
 * worth: `EXPORT_CENSUS` is a set equality over the directory's whole export
 * list in both directions, so the new export reddens THIS file until somebody
 * adds a row for it. That is not detection — it is CLAUDE.md's stated purpose
 * for the covered-day guard, *"a new way to hand out a covered day forces a
 * visible edit where a reviewer sees it"*. The reviewer is the mechanism. Do
 * not read the export census as a semantic check; it is a tripwire on the
 * surface's shape.
 *
 * The semantic catcher for shape 16 is a monotonicity sweep on the day list, in
 * `src/game/streakSweep.ts`'s shape, which this directory already has three of
 * — `ENGAGEMENT_SWEEP`, `REPUTATION_SWEEP` and `EMPIRE_SWEEP`. It covers such a
 * function only ONCE IT IS WIRED into `runEngagement`. An unwired export is
 * covered by nothing in this repository, and that is the honest state of it.
 *
 * A RETURNED FUNCTION IS NOT INVOKED. If an export returns a closure that would
 * yield a forbidden name when called, instrument B walks the closure's own
 * properties and not its result — invoking arbitrary returned functions with
 * invented arguments is not something this walker can do safely. A getter is
 * invoked; a method is not. `INVOKED_GETTERS` pins that the getter half is
 * live.
 *
 * A FOLD NOT IN `NORMALISATION_FOLDS` IS NOT APPLIED. `'coveredx-day'` and a
 * translation of the word are outside every fold here and are not caught. Each
 * fold that IS applied carries its own tripwire in `fold survives its own
 * tripwire`, so the fold list is measured rather than asserted.
 */

import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');

// ---------------------------------------------------------------------------
// The banned vocabulary, and the two exports that legitimately are it
// ---------------------------------------------------------------------------

/**
 * The names no export of this directory may produce.
 *
 * Taken from the directory's own two ban lists rather than retyped, so a name
 * added to either is swept without this file being edited — and the count pins
 * below are what say one arrived.
 */
const BANNED_VOCABULARY: readonly string[] = Object.freeze([
  'covered-day',
  'chalk',
  'e1rm',
  'competition-total',
  'paid-pull',
  'currency-purchase',
  'chance-draw',
]);

/**
 * The two exports that ARE the ban lists.
 *
 * Exempted by export identity and by nothing else. Anything that READS one of
 * these is not exempt — which matters, because reading the ban list is exactly
 * where the reproduced defect gets its string. Their contents are pinned by
 * count and by content below rather than skipped, so an exemption cannot grow
 * a member quietly.
 */
const BAN_LIST_EXPORTS: readonly string[] = Object.freeze([
  'EMPIRE_FORBIDDEN_OUTPUTS',
  'FORBIDDEN_UNLOCK_KEYS',
]);

/**
 * The exports whose channel is diagnostic prose rather than a payable value.
 *
 * Every one returns `readonly string[]` and every message in it is a sentence.
 * A sentence that NAMES a forbidden output ('covered-day is named as forbidden
 * and is also payable') is the module reporting a fault, not paying one — so
 * these are exempt from the CONTAINMENT half of the check and are NOT exempt
 * from the EQUALITY half. A fault list whose element IS a forbidden name, with
 * no sentence around it, is a grant wearing a diagnostic's coat and reddens.
 *
 * Attack shape 19 is aimed precisely at this exemption. It is scoped to seven
 * named exports, by name, and `DIAGNOSTIC_CHANNEL_CENSUS` pins what they
 * actually produced under the drive rather than passing over them in silence.
 */
const DIAGNOSTIC_CHANNEL_EXPORTS: readonly string[] = Object.freeze([
  'empireVocabularyFaults',
  'empireStateFaults',
  'empireRunFaults',
  'engagementRunFaults',
  'expansionVocabularyFaults',
  'reputationVocabularyFaults',
  'socialVocabularyFaults',
  'socialContextFaults',
]);

// ---------------------------------------------------------------------------
// Normalisation — the folds, named, each with a tripwire
// ---------------------------------------------------------------------------

/**
 * The folds a candidate string is put through before it is compared.
 *
 * Named individually rather than composed into one regex because CLAUDE.md's
 * rule is that the normalisation a guard chooses is itself a declared limit:
 * it must state which folds it applies and pin a tripwire per fold. The test
 * 'every declared fold survives its own tripwire' does exactly that.
 *
 * `separators` collapses any run of non-alphanumeric characters to a single
 * hyphen, which is what folds `'covered--day'`, `'covered day'`,
 * `'covered_day'` and the U+2011 non-breaking hyphen back onto the name. The
 * tree-wide scan in `src/game/` catches the first of those and not the others.
 */
const NORMALISATION_FOLDS = Object.freeze({
  case: (value: string): string => value.toLowerCase(),
  trim: (value: string): string => value.trim(),
  separators: (value: string): string =>
    value.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, ''),
} as const);

const FOLD_NAMES: readonly string[] = Object.freeze(Object.keys(NORMALISATION_FOLDS).sort());

/** Every fold, applied in a fixed order. The order is stated, not implied. */
function normalise(value: string): string {
  return NORMALISATION_FOLDS.separators(
    NORMALISATION_FOLDS.case(NORMALISATION_FOLDS.trim(value)),
  );
}

const BANNED_NORMALISED: ReadonlySet<string> = new Set(BANNED_VOCABULARY.map(normalise));

/** Every banned name, as a fold-tripwire pair: the variant and the name it folds onto. */
const FOLD_TRIPWIRES: readonly (readonly [string, string, string])[] = Object.freeze([
  ['case', 'COVERED-DAY', 'covered-day'],
  ['case', 'Covered-Day', 'covered-day'],
  ['trim', '  chalk  ', 'chalk'],
  ['separators', 'covered--day', 'covered-day'],
  ['separators', 'covered day', 'covered-day'],
  ['separators', 'covered_day', 'covered-day'],
  ['separators', 'covered‑day', 'covered-day'],
  ['separators', '-covered-day-', 'covered-day'],
]);

/** Strings that must NOT fold onto a banned name. The other half of the fold check. */
const FOLD_NON_MATCHES: readonly string[] = Object.freeze([
  'coveredx-day',
  'covered',
  'day',
  'gym-bucks',
  'training-iq',
  'physio-days-saved',
  'e1rmx',
]);

// ===========================================================================
// INSTRUMENT A — the type-level string-position census
// ===========================================================================

/**
 * How deep the type walk goes before it gives up.
 *
 * Twelve rather than a smaller number because the deepest real chain in this
 * directory is `EmpireRun -> gym -> state -> roster -> [] -> id`, and a walker
 * that truncates reports a false negative in the reassuring direction.
 * `depthCuts` is pinned at zero, so a type arriving that is deeper than this
 * reports itself instead of being silently shortened.
 */
const TYPE_WALK_MAX_DEPTH = 12;

type StringPositionKind = 'literal' | 'branded' | 'bare';

interface StringPosition {
  readonly module: string;
  readonly export: string;
  /** Where in the type the string sits, e.g. `return.kind` or `value[].entry.gymId`. */
  readonly path: string;
  readonly kind: StringPositionKind;
  /** The members, for a `literal` position. Empty otherwise. */
  readonly members: readonly string[];
}

interface StringSurface {
  readonly modules: readonly string[];
  readonly exports: readonly string[];
  readonly positions: readonly StringPosition[];
  /** Non-zero means the walk truncated and the census below is a prefix. */
  readonly depthCuts: number;
  /** Diagnostics from the directory's own sources. Must be empty. */
  readonly sourceDiagnostics: readonly string[];
}

function compilerOptions(): ts.CompilerOptions {
  const configPath = path.join(REPO_ROOT, 'tsconfig.json');
  const config = ts.readConfigFile(configPath, ts.sys.readFile).config as unknown;
  const parsed = ts.parseJsonConfigFileContent(config, ts.sys, REPO_ROOT);
  return { ...parsed.options, noEmit: true, skipLibCheck: true };
}

/** The shipped modules, read off the directory rather than listed. */
function shippedModulePaths(): readonly string[] {
  return readdirSync(HERE)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .sort()
    .map((name) => path.join(HERE, name));
}

/**
 * The probe module path, served from memory and never written to disk.
 *
 * It exists so instrument A can be shown to SEE a bare-string return and a
 * banned literal without any shipped file being edited. `programWith` swaps
 * the compiler host's reader for this one path only, which is the technique
 * `empireCore.test.ts`'s `brandCensus` already uses.
 */
const PROBE_PATH = path.join(HERE, '__forbiddenOutputProbe.ts');

function programWith(
  options: ts.CompilerOptions,
  roots: readonly string[],
  probeText: string | null,
): ts.Program {
  const host = ts.createCompilerHost(options, true);
  if (probeText !== null) {
    const readSource = host.getSourceFile.bind(host);
    host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) =>
      path.normalize(fileName) === PROBE_PATH
        ? ts.createSourceFile(fileName, probeText, languageVersion, true, ts.ScriptKind.TS)
        : readSource(fileName, languageVersion, onError, shouldCreate);
    const exists = host.fileExists.bind(host);
    host.fileExists = (fileName) =>
      path.normalize(fileName) === PROBE_PATH ? true : exists(fileName);
    const read = host.readFile.bind(host);
    host.readFile = (fileName) =>
      path.normalize(fileName) === PROBE_PATH ? probeText : read(fileName);
  }
  return ts.createProgram([...roots], options, host);
}

/**
 * Walk every export's type and classify every reachable string position.
 *
 * The three classifications are decided by the CHECKER, not by the text: a
 * position is `literal` when its type is a string-literal type, `branded` when
 * it is an intersection carrying both `string` and this directory's brand
 * symbol, and `bare` when it is the `string` keyword. Asking the compiler is
 * the load-bearing choice — `EMPIRE_FORBIDDEN_OUTPUTS[0] as string` is a bare
 * string to the checker whatever the source looks like.
 */
function surfaceOf(roots: readonly string[], probeText: string | null): StringSurface {
  const options = compilerOptions();
  const program = programWith(options, roots, probeText);
  const checker = program.getTypeChecker();

  const corePath = path.join(HERE, 'empireCore.ts');
  const core = program.getSourceFile(corePath);
  if (core === undefined) throw new Error(`${corePath} is not in the program`);

  // The brand symbol, taken from its declaration rather than from its spelling.
  let brandSymbol: ts.Symbol | undefined;
  core.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const declaration of node.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === 'EMPIRE_BRAND') {
        brandSymbol = checker.getSymbolAtLocation(declaration.name);
      }
    }
  });
  if (brandSymbol === undefined) throw new Error('no EMPIRE_BRAND declaration in empireCore.ts');

  const resolved = (symbol: ts.Symbol | undefined): ts.Symbol | undefined =>
    symbol !== undefined && (symbol.flags & ts.SymbolFlags.Alias) !== 0
      ? checker.getAliasedSymbol(symbol)
      : symbol;

  const carriesBrand = (type: ts.Type): boolean =>
    type.getProperties().some((property) => {
      const declaration = property.valueDeclaration ?? property.declarations?.[0];
      const name = declaration === undefined ? undefined : (declaration as ts.NamedDeclaration).name;
      if (name === undefined || !ts.isComputedPropertyName(name)) return false;
      return resolved(checker.getSymbolAtLocation(name.expression)) === brandSymbol;
    });

  const positions: StringPosition[] = [];
  const modules: string[] = [];
  const exportNames: string[] = [];
  let depthCuts = 0;

  const PRIMITIVE_FLAGS =
    ts.TypeFlags.Number |
    ts.TypeFlags.NumberLiteral |
    ts.TypeFlags.Boolean |
    ts.TypeFlags.BooleanLiteral |
    ts.TypeFlags.BigInt |
    ts.TypeFlags.BigIntLiteral |
    ts.TypeFlags.ESSymbolLike |
    ts.TypeFlags.Void |
    ts.TypeFlags.Undefined |
    ts.TypeFlags.Null |
    ts.TypeFlags.Never |
    ts.TypeFlags.Unknown |
    ts.TypeFlags.Any;

  for (const root of roots) {
    const source = program.getSourceFile(root);
    if (source === undefined) throw new Error(`${root} is not in the program`);
    const moduleSymbol = checker.getSymbolAtLocation(source);
    if (moduleSymbol === undefined) continue;
    const moduleName = path.basename(root);
    modules.push(moduleName);

    for (const symbol of checker.getExportsOfModule(moduleSymbol)) {
      const declaration = symbol.declarations?.[0];
      if (declaration === undefined) continue;
      if (ts.isTypeAliasDeclaration(declaration) || ts.isInterfaceDeclaration(declaration)) continue;
      const exportName = symbol.getName();
      exportNames.push(`${moduleName}#${exportName}`);

      const isFunction = ts.isFunctionDeclaration(declaration);
      let entry: ts.Type;
      let entryPath: string;
      if (isFunction) {
        const signature = checker.getSignatureFromDeclaration(declaration);
        if (signature === undefined) throw new Error(`no signature for ${exportName}`);
        entry = checker.getReturnTypeOfSignature(signature);
        entryPath = 'return';
      } else {
        entry = checker.getTypeOfSymbolAtLocation(symbol, declaration);
        entryPath = 'value';
      }

      const push = (kind: StringPositionKind, at: string, members: readonly string[]): void => {
        positions.push({ module: moduleName, export: exportName, path: at, kind, members });
      };

      /**
       * Cycle detection is scoped to the CURRENT PATH, not to the whole export.
       *
       * This was wrong once, in the direction that under-reports. A single
       * `Set<ts.Type>` per export made the walk report the FIRST bare string it
       * reached and silently drop every later one, because the checker hands
       * back one `string` type object for all of them: `createEmpireGym`
       * reported `state.roster[].displayName` and lost `pending[].id`
       * altogether. A missing position is a hole in the census that reads
       * exactly like a clean surface.
       */
      const walk = (type: ts.Type, at: string, depth: number, ancestors: readonly ts.Type[]): void => {
        if (depth > TYPE_WALK_MAX_DEPTH) {
          depthCuts += 1;
          return;
        }
        if (ancestors.includes(type)) return;
        const below = [...ancestors, type];

        if ((type.flags & ts.TypeFlags.StringLiteral) !== 0) {
          push('literal', at, [(type as ts.StringLiteralType).value]);
          return;
        }
        if ((type.flags & ts.TypeFlags.String) !== 0) {
          push('bare', at, []);
          return;
        }
        if (type.isIntersection()) {
          const stringy = type.types.some(
            (part) => (part.flags & (ts.TypeFlags.String | ts.TypeFlags.StringLiteral)) !== 0,
          );
          if (stringy && carriesBrand(type)) {
            push('branded', at, []);
            return;
          }
          for (const part of type.types) walk(part, at, depth + 1, below);
          return;
        }
        // A branded PRIMITIVE (a branded number, say) resolves its apparent
        // members off `Number`, whose `toString` returns a string. Walking those
        // would invent a string position in every numeric brand in the
        // directory, so primitives stop here.
        if ((type.flags & PRIMITIVE_FLAGS) !== 0) return;
        if (type.isUnion()) {
          for (const part of type.types) walk(part, at, depth + 1, below);
          return;
        }
        if ((type.flags & (ts.TypeFlags.Conditional | ts.TypeFlags.TypeParameter)) !== 0) {
          const constraint = checker.getBaseConstraintOfType(type);
          if (constraint !== undefined && constraint !== type) walk(constraint, at, depth + 1, below);
          return;
        }
        if (checker.isArrayType(type) || checker.isTupleType(type)) {
          for (const argument of checker.getTypeArguments(type as ts.TypeReference)) {
            walk(argument, `${at}[]`, depth + 1, below);
          }
          return;
        }
        if ((type.flags & ts.TypeFlags.Object) !== 0) {
          for (const index of checker.getIndexInfosOfType(type)) {
            walk(index.type, `${at}[key]`, depth + 1, below);
          }
          for (const call of type.getCallSignatures()) {
            walk(checker.getReturnTypeOfSignature(call), `${at}()`, depth + 1, below);
          }
          for (const property of type.getProperties()) {
            const site = property.valueDeclaration ?? property.declarations?.[0] ?? declaration;
            walk(
              checker.getTypeOfSymbolAtLocation(property, site),
              `${at}.${property.getName()}`,
              depth + 1,
              below,
            );
          }
        }
      };

      walk(entry, entryPath, 0, []);
    }
  }

  const sourceDiagnostics: string[] = [];
  for (const root of roots) {
    const source = program.getSourceFile(root);
    if (source === undefined) continue;
    for (const diagnostic of [
      ...program.getSyntacticDiagnostics(source),
      ...program.getSemanticDiagnostics(source),
    ]) {
      sourceDiagnostics.push(ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '));
    }
  }

  return {
    modules: Object.freeze(modules),
    exports: Object.freeze(exportNames.sort()),
    positions: Object.freeze(positions),
    depthCuts,
    sourceDiagnostics: Object.freeze(sourceDiagnostics),
  };
}

let surfaceMemo: StringSurface | null = null;

/** The census of the shipped directory. Memoised; the program build is the cost. */
function stringSurface(): StringSurface {
  if (surfaceMemo !== null) return surfaceMemo;
  surfaceMemo = surfaceOf(shippedModulePaths(), null);
  return surfaceMemo;
}

/** A position, as one sortable line, for a set equality that names its members. */
const positionKey = (position: StringPosition): string =>
  `${position.module}#${position.export}#${position.path}`;

const distinct = (values: readonly string[]): readonly string[] => [...new Set(values)].sort();

const bareKeys = (surface: StringSurface): readonly string[] =>
  distinct(surface.positions.filter((p) => p.kind === 'bare').map(positionKey));

const brandedKeys = (surface: StringSurface): readonly string[] =>
  distinct(surface.positions.filter((p) => p.kind === 'branded').map(positionKey));

/**
 * Every bare-`string` position in the directory, grouped by the FIELD it is,
 * with the reason that field is legitimately a bare string.
 *
 * Six fields, twenty-three positions. The grouping is not decoration: the same
 * field is reached through several exports, so a per-export list would suggest
 * eighteen independent holes where there are six, and would make the count move
 * for a reason that is not a new hole.
 *
 * NOTHING HERE WAS TIGHTENED, AND THAT IS A DELIBERATE CHOICE RATHER THAN AN
 * OMISSION. Every one of the six is a string a caller or a server supplies, so
 * a brand on it would be a brand on free text and would say nothing about what
 * the text is. The instrument's bite is the SET EQUALITY below, not the absence
 * of bare strings: a seventh field cannot arrive without this list being
 * edited, and that is what the reproduced defect runs into.
 */
const DECLARED_BARE_STRING_FIELDS = Object.freeze([
  Object.freeze({
    field: 'the eight `readonly string[]` fault lists',
    why:
      'Diagnostic prose. Every element is a sentence, and a sentence naming a ' +
      'forbidden output is the module REPORTING a fault rather than paying ' +
      'one. Instrument B checks these by equality and not by containment, and ' +
      'pins what they produced in DIAGNOSTIC_CHANNEL_CENSUS.',
    positions: Object.freeze([
      'empireCore.ts#empireStateFaults#return[]',
      'empireCore.ts#empireVocabularyFaults#return[]',
      'empireInvariant.ts#empireRunFaults#return[]',
      'engagement.ts#engagementRunFaults#return[]',
      'expansion.ts#expansionVocabularyFaults#return[]',
      'reputation.ts#reputationVocabularyFaults#return[]',
      'social.ts#socialContextFaults#return[]',
      'social.ts#socialVocabularyFaults#return[]',
    ]),
  }),
  Object.freeze({
    field: 'NpcLifter.displayName',
    why:
      "An NPC's shown name. Caller-chosen free text, checked only for " +
      'non-emptiness by `createNpcLifter`. Covered by instrument B, which ' +
      'drives it with a sentinel so the position is measured as REACHED ' +
      'rather than assumed non-empty.',
    positions: Object.freeze([
      'empireCore.ts#createEmpireState#return.roster[].displayName',
      'empireCore.ts#createNpcLifter#return.displayName',
      'empireInvariant.ts#createEmpireGym#return.state.roster[].displayName',
      'empireInvariant.ts#runEmpire#return.gym.state.roster[].displayName',
      'empireInvariant.ts#stepGym#return.state.roster[].displayName',
      'recruitment.ts#beginRecruitment#return.state.roster[].displayName',
      'recruitment.ts#completeRecruitment#return.roster[].displayName',
    ]),
  }),
  Object.freeze({
    field: 'GymSnapshot.gymId and GymSnapshot.displayName',
    why:
      "Another gym's identity, which arrives from outside this directory " +
      'entirely. There is no closed set of them to narrow to.',
    positions: Object.freeze([
      'empireInvariant.ts#gymSnapshot#return.displayName',
      'empireInvariant.ts#gymSnapshot#return.gymId',
      'social.ts#rankLeaderboard#return[].entry.displayName',
      'social.ts#rankLeaderboard#return[].entry.gymId',
    ]),
  }),
  Object.freeze({
    field: 'PendingRecruit.id',
    why:
      'The id a recruitment will mint. It is a bare `string` where ' +
      '`NpcLifter.id` is the `NpcId` brand, which is an inconsistency in the ' +
      'shipped types and is recorded here rather than fixed — narrowing it is ' +
      'an edit to a shipped module and buys nothing this census does not ' +
      'already give, because a new position reddens whatever its type is.',
    positions: Object.freeze([
      'empireInvariant.ts#createEmpireGym#return.pending[].id',
      'empireInvariant.ts#runEmpire#return.gym.pending[].id',
      'empireInvariant.ts#stepGym#return.pending[].id',
    ]),
  }),
  Object.freeze({
    field: 'FriendVisit.gymId',
    why:
      "The visited gym's id, which the caller passes in and `recordFriendVisit` " +
      'logs verbatim. Same class as GymSnapshot.gymId.',
    positions: Object.freeze(['social.ts#recordFriendVisit#return.visits[].gymId']),
  }),
]);

/**
 * Every branded-string position: `NpcId`, which is `string & brand`.
 *
 * Listed separately from the bare ones because a brand is erased at runtime, so
 * `asNpcId('covered-day')` returns the forbidden name. A scan for the `string`
 * keyword misses this whole class; the checker does not.
 */
const DECLARED_BRANDED_STRING_POSITIONS: readonly string[] = Object.freeze([
  'empireCore.ts#asNpcId#return',
  'empireCore.ts#createEmpireState#return.roster[].id',
  'empireCore.ts#createNpcLifter#return.id',
  'empireInvariant.ts#createEmpireGym#return.state.roster[].id',
  'empireInvariant.ts#runEmpire#return.gym.state.roster[].id',
  'empireInvariant.ts#stepGym#return.state.roster[].id',
  'recruitment.ts#beginRecruitment#return.state.roster[].id',
  'recruitment.ts#completeRecruitment#return.roster[].id',
]);

/** What the census measured on the shipped tree. Counts, not bounds. */
const SURFACE_CENSUS = Object.freeze({
  MODULES: 10,
  EXPORTS: 226,
  BARE_POSITIONS: 23,
  BARE_FIELDS: 5,
  BRANDED_POSITIONS: 8,
  LITERAL_POSITIONS: 1175,
  DISTINCT_LITERAL_MEMBERS: 93,
  DEPTH_CUTS: 0,
});

describe('instrument A — no export type admits a forbidden literal, and no new string position arrives unseen', () => {
  it('walks the whole directory without truncating, and the compiler is happy with it', () => {
    const surface = stringSurface();
    // A depth cut means the census below is a prefix of the surface rather than
    // the surface. Pinned at zero so a deeper type reports itself.
    expect(surface.depthCuts).toBe(SURFACE_CENSUS.DEPTH_CUTS);
    expect(surface.sourceDiagnostics).toEqual([]);
    expect(surface.modules.length).toBe(SURFACE_CENSUS.MODULES);
    expect(surface.exports.length).toBe(SURFACE_CENSUS.EXPORTS);
  });

  it('pins every bare-string position, in both directions, grouped by the field it is', () => {
    const surface = stringSurface();
    const declared = distinct(DECLARED_BARE_STRING_FIELDS.flatMap((group) => group.positions));
    // Set equality both ways. A new bare-string return type is an unexpected
    // member; a removed one is a stale row. Either reddens.
    expect(bareKeys(surface)).toEqual(declared);
    expect(declared.length).toBe(SURFACE_CENSUS.BARE_POSITIONS);
    expect(DECLARED_BARE_STRING_FIELDS.length).toBe(SURFACE_CENSUS.BARE_FIELDS);
    // Every group carries a reason, so a position cannot be added to this list
    // by pasting a line.
    for (const group of DECLARED_BARE_STRING_FIELDS) {
      expect(group.positions.length, group.field).toBeGreaterThan(0);
      expect(group.why.length, group.field).toBeGreaterThan(80);
    }
  });

  it('pins every branded-string position, in both directions', () => {
    const surface = stringSurface();
    expect(brandedKeys(surface)).toEqual([...DECLARED_BRANDED_STRING_POSITIONS].sort());
    expect(DECLARED_BRANDED_STRING_POSITIONS.length).toBe(SURFACE_CENSUS.BRANDED_POSITIONS);
  });

  it('names no forbidden output in any closed literal union, outside the two lists that ARE the ban', () => {
    const surface = stringSurface();
    const literals = surface.positions.filter((position) => position.kind === 'literal');
    expect(literals.length).toBe(SURFACE_CENSUS.LITERAL_POSITIONS);
    expect(distinct(literals.flatMap((position) => position.members)).length).toBe(
      SURFACE_CENSUS.DISTINCT_LITERAL_MEMBERS,
    );

    // The exemption is scoped to the two exports that ARE the ban lists and to
    // nothing else. Anything that READS one of them is checked in full, which
    // matters because reading the list is where the reproduced defect gets its
    // string.
    const offenders = literals
      .filter((position) => !BAN_LIST_EXPORTS.includes(position.export))
      .filter((position) => position.members.some((member) => BANNED_NORMALISED.has(normalise(member))))
      .map((position) => `${positionKey(position)}=${position.members.join('|')}`);
    expect(distinct(offenders)).toEqual([]);

    // And the exempted pair is pinned by content, not skipped. An exemption
    // that can grow a member quietly is a hiding place (attack shape 19).
    const exempted = literals.filter((position) => BAN_LIST_EXPORTS.includes(position.export));
    expect(distinct(exempted.map((position) => `${position.export}=${position.members.join('|')}`))).toEqual([
      'EMPIRE_FORBIDDEN_OUTPUTS=chalk',
      'EMPIRE_FORBIDDEN_OUTPUTS=competition-total',
      'EMPIRE_FORBIDDEN_OUTPUTS=covered-day',
      'EMPIRE_FORBIDDEN_OUTPUTS=e1rm',
      'FORBIDDEN_UNLOCK_KEYS=chance-draw',
      'FORBIDDEN_UNLOCK_KEYS=currency-purchase',
      'FORBIDDEN_UNLOCK_KEYS=paid-pull',
    ]);
    // Every banned name is accounted for by that pair, so the ban list this
    // file sweeps under and the ones the directory declares are the same list.
    expect(distinct(exempted.flatMap((position) => position.members))).toEqual(
      distinct([...BANNED_VOCABULARY]),
    );
  });
});

/**
 * The probe module, served from memory and never written to disk.
 *
 * It is instrument A's non-vacuity guard. Every check above is a set equality
 * that passes on a clean tree, and a set equality passes just as happily when
 * the walker is broken — the walker WAS broken once, in exactly that way, and
 * reported eighteen positions where there are twenty-three. So the census is
 * re-run over an eleventh module carrying four routes and the classification of
 * each is asserted. Nothing shipped is edited to do it.
 *
 * `probeProtectionDays` is here for the opposite reason: it is attack shape 16
 * and it must produce NO position. That zero is the declared limit, measured
 * rather than argued.
 */
const PROBE_SOURCE = `import { EMPIRE_FORBIDDEN_OUTPUTS, asNpcId, type NpcId } from './empireCore';

export function probeMilestoneGrant(checkIns: number): { readonly kind: string; readonly days: number } {
  return Object.freeze({ kind: EMPIRE_FORBIDDEN_OUTPUTS[0] as string, days: checkIns });
}

export const PROBE_GRANT_DATA = Object.freeze({ kind: EMPIRE_FORBIDDEN_OUTPUTS[0] });

export function probeMilestoneId(checkIns: number): NpcId {
  return asNpcId(\`\${EMPIRE_FORBIDDEN_OUTPUTS[0]}-\${String(checkIns)}\`);
}

export function probeProtectionDays(checkIns: number): number {
  return Math.floor(checkIns / EMPIRE_FORBIDDEN_OUTPUTS.length);
}
`;

const PROBE_MODULE = path.basename(PROBE_PATH);

let probeSurfaceMemo: StringSurface | null = null;

function probeSurface(): StringSurface {
  if (probeSurfaceMemo !== null) return probeSurfaceMemo;
  probeSurfaceMemo = surfaceOf([...shippedModulePaths(), PROBE_PATH], PROBE_SOURCE);
  return probeSurfaceMemo;
}

describe('instrument A bites — the census is re-run over a probe carrying four routes', () => {
  it('compiles the probe cleanly, so a refusal below is a classification and not an error', () => {
    const surface = probeSurface();
    expect(surface.sourceDiagnostics).toEqual([]);
    expect(surface.depthCuts).toBe(SURFACE_CENSUS.DEPTH_CUTS);
    expect(surface.modules.length).toBe(SURFACE_CENSUS.MODULES + 1);
  });

  it('sees the reproduced defect: `{ kind: string }` is a new bare position', () => {
    const probeBare = bareKeys(probeSurface()).filter((key) => key.startsWith(PROBE_MODULE));
    expect(probeBare).toEqual([`${PROBE_MODULE}#probeMilestoneGrant#return.kind`]);
    // And it is a position the shipped census does not have, which is the whole
    // mechanism: the set equality above goes red on arrival.
    expect(bareKeys(stringSurface())).not.toContain(`${PROBE_MODULE}#probeMilestoneGrant#return.kind`);
  });

  it('sees a banned name that survives as a literal type in exported DATA', () => {
    const offenders = probeSurface()
      .positions.filter((position) => position.kind === 'literal')
      .filter((position) => !BAN_LIST_EXPORTS.includes(position.export))
      .filter((position) => position.members.some((member) => BANNED_NORMALISED.has(normalise(member))))
      .map((position) => `${positionKey(position)}=${position.members.join('|')}`);
    expect(distinct(offenders)).toEqual([`${PROBE_MODULE}#PROBE_GRANT_DATA#value.kind=covered-day`]);
  });

  it('sees the branded-string channel, which a scan for the `string` keyword misses', () => {
    const probeBranded = brandedKeys(probeSurface()).filter((key) => key.startsWith(PROBE_MODULE));
    expect(probeBranded).toEqual([`${PROBE_MODULE}#probeMilestoneId#return`]);
  });

  it('is BLIND to attack shape 16, and the blindness is the measurement', () => {
    // `probeProtectionDays(checkIns): number` is a check-in-keyed day count with
    // no forbidden name anywhere in it. It contributes zero positions of any
    // kind. This assertion is not a pass — it is the declared limit taken as a
    // number, and it reddens if somebody later claims this instrument covers
    // the shape.
    const fromShape16 = probeSurface().positions.filter(
      (position) => position.export === 'probeProtectionDays',
    );
    expect(fromShape16).toEqual([]);
    // What DOES move is the export list, and only that.
    expect(probeSurface().exports).toContain(`${PROBE_MODULE}#probeProtectionDays`);
  });
});
