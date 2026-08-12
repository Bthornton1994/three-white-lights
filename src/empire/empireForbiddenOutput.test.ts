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
 *   So the bite is not that bare strings are absent — twenty-three of them are
 *   legitimate, and they are five FIELDS reached through eighteen exports,
 *   listed in `DECLARED_BARE_STRING_FIELDS` with a reason per field. The bite
 *   is that a NEW one cannot arrive unnoticed. The reproduced defect returns
 *   `{ readonly kind: string; readonly days: number }`, which is a
 *   twenty-fourth position, and that is what reddens — verbatim, as
 *   `+ "production.ts#idleMilestoneGrant#return.kind"`.
 *
 *   Its limit, stated because no type reaches past it: it cannot see a value
 *   that is legitimately typed as a string. `NpcLifter.displayName` is a bare
 *   `string` on purpose, and nothing in a signature says whether the string in
 *   it is a player's chosen name or `'covered-day'`. Instrument B is the
 *   catcher for that limit, and it is pointed at those positions by `SENTINELS`,
 *   one benign sentinel per caller-supplied position, twelve in all.
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
 * both instruments here are about a word. It was planted as M8 and both
 * instruments stayed green; the run is recorded in `PLANTED_ROUTES`.
 *
 * What DOES fire on it, and it is worth being exact about how much that is
 * worth: 'drives every export the census knows about' is a set equality over
 * the directory's whole export list in both directions, so the new export
 * reddens THIS file until somebody adds a row for it. Measured: mutant M8 in
 * `PLANTED_ROUTES` is that function, and it reddened exactly two assertions,
 * both of them counts of the export list, and nothing else in the repository. That is not detection — it is CLAUDE.md's stated purpose
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
 * invoked; a method is not. `DRIVE_CENSUS.GETTERS_INVOKED` is zero on the
 * subject and `TRIPWIRE_CENSUS.GETTERS_INVOKED` is one, so the getter branch is
 * pinned as live by the tripwire and by nothing in the directory.
 *
 * A FOLD NOT IN `NORMALISATION_FOLDS` IS NOT APPLIED. `'coveredx-day'` and a
 * translation of the word are outside every fold here and are not caught. Each
 * fold that IS applied carries its own tripwire in `fold survives its own
 * tripwire`, so the fold list is measured rather than asserted.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { types as nodeTypes } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import * as core from './empireCore';
import * as invariant from './empireInvariant';
import * as tuningModule from './empireTuning';
import * as engagementModule from './engagement';
import * as expansionModule from './expansion';
import * as npcModule from './npc';
import * as productionModule from './production';
import * as recruitmentModule from './recruitment';
import * as reputationModule from './reputation';
import * as socialModule from './social';

import { EMPIRE_TUNING } from './empireTuning';
import type {
  AccelerableOutput,
  AppliedAccelerant,
  EmpireAccelerant,
  EmpireClock,
  EmpireOutput,
  EmpireState,
  EquipmentTier,
  GymAxes,
  NpcLifter,
  NpcTier,
  StaffRole,
  UnacceleratedSeconds,
  WallClockBooks,
  WallClockFundedOutput,
} from './empireCore';
import type { EmpirePolicy, EmpireDayEntry, EmpireGym, SocialInputs } from './empireInvariant';
import type { ExpansionAxis, ExpansionBuild, ExpansionContext } from './expansion';
import type { EngagementHistory } from './engagement';
import type {
  CalendarDay,
  Encouragement,
  GymSnapshot,
  SocialCalendarContext,
  SocialContext,
} from './social';
import type { RosterRateSource } from './production';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
/** This file, read as text by the two checks that scan for a domain the registry never saw. */
const THIS_FILE = fileURLToPath(import.meta.url);

// ---------------------------------------------------------------------------
// The banned vocabulary, and the two exports that legitimately are it
// ---------------------------------------------------------------------------

/**
 * The names no export of this directory may produce.
 *
 * READ out of the directory's own two ban lists rather than retyped, so a name
 * added to either is swept without this file being edited — and the content
 * pins in 'names no forbidden output in any closed literal union' and in
 * 'produces no banned name from any export but the two that ARE the ban lists'
 * are what say one arrived.
 *
 * THAT SENTENCE USED TO BE FALSE AND IS RECORDED HERE RATHER THAN QUIETLY
 * CORRECTED. This was seven hardcoded literals under a comment claiming they
 * were taken from the ban lists, which is the exact defect CLAUDE.md records
 * eight times: a sentence that was true of an intention rather than of the
 * code. Adding a name to `EMPIRE_FORBIDDEN_OUTPUTS` would have left this list
 * short and swept the tree for six names while claiming seven.
 *
 * The vacuity risk the derivation introduces, and its catcher: an emptied ban
 * list would empty this and every zero below would become vacuous. `BANNED`
 * in `SURFACE_CENSUS` pins the length, and the two content pins name every
 * member, so an emptied or shortened list reddens before the zeros do.
 */
const BANNED_VOCABULARY: readonly string[] = Object.freeze([
  ...core.EMPIRE_FORBIDDEN_OUTPUTS,
  ...reputationModule.FORBIDDEN_UNLOCK_KEYS,
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
 * Five fields, twenty-three positions. The grouping is not decoration: the same
 * field is reached through several exports, so a per-export list would suggest
 * eighteen independent holes where there are five, and would make the count move
 * for a reason that is not a new hole.
 *
 * NOTHING HERE WAS TIGHTENED, AND THAT IS A DELIBERATE CHOICE RATHER THAN AN
 * OMISSION. Every one of the five is a string a caller or a server supplies, so
 * a brand on it would be a brand on free text and would say nothing about what
 * the text is. The instrument's bite is the SET EQUALITY below, not the absence
 * of bare strings: a sixth field cannot arrive without this list being
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
  /** The banned vocabulary's own length, so an emptied ban list is not a clean sweep. */
  BANNED: 7,
  LITERAL_POSITIONS: 1175,
  DISTINCT_LITERAL_MEMBERS: 93,
  DEPTH_CUTS: 0,
});

describe('the domains are derived from the subject and are not empty', () => {
  it('pins how many thresholds were filed, how many domains exist, and how many points each came out at', () => {
    // The census that says a truncated or reshaped domain reports itself. A
    // threshold dropped from `UNIT_THRESHOLDS` shrinks a point count here
    // before it shrinks anything downstream, where it would look like a clean
    // sweep.
    expect(AXIS_UNITS.length).toBe(DOMAIN_CENSUS.UNITS);
    expect(Object.keys(UNIT_THRESHOLDS).sort()).toEqual([...AXIS_UNITS].sort());
    const filed = AXIS_UNITS.flatMap((unit) => Object.keys(UNIT_THRESHOLDS[unit]));
    expect(filed.length).toBe(DOMAIN_CENSUS.THRESHOLDS);
    // Filed exactly once, so a threshold cannot be counted twice into the
    // census while being missing from the unit that needed it.
    expect(distinct(filed).length).toBe(DOMAIN_CENSUS.THRESHOLDS);
    // And no unit is empty, which is what stops a domain declaring a unit and
    // thereby declaring no obligation at all.
    for (const unit of AXIS_UNITS) {
      expect(Object.keys(UNIT_THRESHOLDS[unit]).length, unit).toBeGreaterThan(0);
    }

    expect(Object.keys(NUMERIC_DOMAINS).length).toBe(DOMAIN_CENSUS.DOMAINS);
    expect(NUMBER_DOMAIN.length).toBe(DOMAIN_CENSUS.NUMBER_POINTS);
    expect(SECONDS_DOMAIN.length).toBe(DOMAIN_CENSUS.SECONDS_POINTS);
    expect(DAY_DOMAIN.length).toBe(DOMAIN_CENSUS.DAY_POINTS);
    expect(COUNT_DOMAIN.length).toBe(DOMAIN_CENSUS.COUNT_POINTS);
    expect(LEVEL_DOMAIN.length).toBe(DOMAIN_CENSUS.LEVEL_POINTS);
    expect(ROSTER_SHAPES.length).toBe(DOMAIN_CENSUS.ROSTER_SHAPE_POINTS);
  });

  it('straddles every threshold of its own units, IN EVERY DOMAIN AND NOT ONLY THE FIRST', () => {
    // This is the assertion the sixth bypass got past, and the way it got past
    // was not that it was wrong — it was that it looped `NUMBER_DOMAIN` and
    // left the domain declared one line below it pinned by LENGTH alone. So it
    // loops `NUMERIC_DOMAINS`, which is discovered at runtime: a seventh domain
    // added to the registry is checked without this assertion being edited, and
    // `DOMAINS` below reddens if one is added and `CONTAINMENT_CHECKS` reddens
    // if a domain is added that obliges itself to nothing.
    let domainsChecked = 0;
    let checks = 0;
    for (const [name, domain] of Object.entries(NUMERIC_DOMAINS)) {
      const required: Record<string, number> = { ...domain.alsoContains };
      for (const unit of domain.units) Object.assign(required, UNIT_THRESHOLDS[unit]);
      // A domain that obliges itself to nothing would pass every check below
      // vacuously, which is the shape of the defect one level out.
      expect(Object.keys(required).length, name).toBeGreaterThan(0);
      expect(domain.why.length, name).toBeGreaterThan(200);

      for (const [label, threshold] of Object.entries(required)) {
        const at = `${name}/${label}=${String(threshold)}`;
        expect(domain.points, at).toContain(threshold);
        expect(domain.points.some((point) => point > threshold), at).toBe(true);
        // Zero has nothing below it. Every other threshold is straddled on
        // both sides; a one-sided sample cannot see a `< threshold` branch.
        if (threshold > 0) {
          expect(domain.points.some((point) => point < threshold), at).toBe(true);
        }
        checks += 1;
      }

      // The shape points, which change an input's SHAPE rather than its size.
      expect(domain.points[0], name).toBe(0);
      expect(domain.points, name).toContain(1);
      domainsChecked += 1;
    }
    expect(domainsChecked).toBe(DOMAIN_CENSUS.DOMAINS);
    expect(checks).toBe(DOMAIN_CENSUS.CONTAINMENT_CHECKS);

    // And the structural fact the units buy: the full domain contains every
    // narrow one, so moving an axis onto NUMBER never loses a point.
    for (const [name, domain] of Object.entries(NUMERIC_DOMAINS)) {
      if (domain.units.length === 0) continue;
      for (const point of domain.points) expect(NUMBER_DOMAIN, name).toContain(point);
    }
  });

  it('defines every numeric domain inside the registry, and nowhere else', () => {
    // The catcher for the registry's declared limit. Runtime discovery cannot
    // see a domain that was never put in the registry, so this reads the file's
    // own source and asserts that every module-level `readonly number[]` is an
    // alias of a registry entry — no literal, no ad-hoc `numeric([...])`.
    const source = readFileSync(THIS_FILE, 'utf8');
    const declarations = [...source.matchAll(/^const (\w+): readonly number\[\] = (.+)$/gm)];
    expect(declarations.length).toBe(DOMAIN_CENSUS.ALIASES);
    const aliased: string[] = [];
    for (const declaration of declarations) {
      const initialiser = declaration[2] ?? '';
      const key = /^NUMERIC_DOMAINS\.(\w+)\.points;$/.exec(initialiser);
      expect(key, `${declaration[1] ?? ''} = ${initialiser}`).not.toBeNull();
      if (key !== null) aliased.push(key[1] ?? '');
    }
    // Set equality both ways: an unaliased registry entry is as much a defect
    // as an alias of something that is not in the registry.
    expect(aliased.sort()).toEqual(Object.keys(NUMERIC_DOMAINS).sort());
  });

  it('declares every literal for-of axis, so an axis outside the registry is not silently an axis', () => {
    // The branch immediately below the check above. A domain can also be
    // written as an array literal at the call site, where no `readonly
    // number[]` declaration exists to scan for — and two axes in this file
    // were, one of them a threshold axis sampled at its two extremes.
    const source = readFileSync(THIS_FILE, 'utf8');
    const found = distinct([...source.matchAll(/for \(const (\w+) of \[/g)].map((hit) => hit[1] ?? ''));
    expect(found).toEqual([...LITERAL_AXES.map(([name]) => name)].sort());
    expect(LITERAL_AXES.length).toBe(DOMAIN_CENSUS.LITERAL_AXES);
    for (const [name, why] of LITERAL_AXES) expect(why.length, name).toBeGreaterThan(60);
  });

  it('states a measured price for every domain that is not the full one', () => {
    // A cost concession with no measurement beside it is how a ten-point
    // hour-derived domain stayed on six axes that never needed to be cheap.
    expect(DOMAIN_COST_SECONDS.length).toBe(DOMAIN_CENSUS.COST_ROWS);
    const baseline = DOMAIN_COST_SECONDS[0]?.[1] ?? 0;
    expect(baseline).toBeGreaterThan(0);
    // Two axes and only two measured a real price. The other six are within
    // noise of the baseline, and four of them measured FASTER than it — which
    // is what says the cheap domain was not bought for them.
    const expensive = DOMAIN_COST_SECONDS.slice(1).filter(([, cost]) => cost > baseline * 2);
    expect(expensive.map(([axis]) => axis)).toEqual([
      'historyFrom and four siblings / history slots',
      'fifteen social exports / calendar day',
    ]);
  });
});

describe('instrument A — no export type admits a forbidden literal, and no new string position arrives unseen', () => {
  it('walks the whole directory without truncating, and the compiler is happy with it', () => {
    // The non-vacuity guard for the derived ban list: every zero in this file
    // is zero against these seven names, and an emptied ban list would make
    // all of them vacuously true.
    expect(BANNED_VOCABULARY.length).toBe(SURFACE_CENSUS.BANNED);
    expect(distinct([...BANNED_VOCABULARY]).length).toBe(SURFACE_CENSUS.BANNED);
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

// ===========================================================================
// INSTRUMENT B — the behavioural drive and the deep scan
// ===========================================================================

/**
 * How deep the VALUE walk goes, and how many nodes it will visit per driven
 * call before it gives up.
 *
 * Both are pinned as zero-cut counts below rather than trusted. A walker that
 * truncates reports a clean scan, which is the reassuring direction.
 */
const VALUE_WALK_MAX_DEPTH = 16;

interface ScannedString {
  /** Where the string sat, e.g. `[0].visits[0].gymId` or `[0].{key}kind`. */
  readonly path: string;
  readonly value: string;
  /** True when the string was a property KEY rather than a property value. */
  readonly viaKey: boolean;
}

interface ScanResult {
  readonly strings: readonly ScannedString[];
  readonly nodes: number;
  readonly depthCuts: number;
  readonly gettersInvoked: number;
  readonly getterThrows: number;
  readonly revisits: number;
  /** Objects the runtime reports as a `Proxy`. A trap can lie about its keys. */
  readonly proxies: number;
  /** Strings and finite numbers in visit order, for the axis fingerprint. */
  readonly trace: readonly string[];
}

/**
 * Walk a value and report every string reachable from it.
 *
 * WHAT IT REACHES, in its own terms: own enumerable AND non-enumerable
 * properties via `Reflect.ownKeys`; property KEYS as well as property values,
 * because attack shape 8 carries the name as a computed key; accessors, which
 * are INVOKED, because `Object.freeze` does not neutralise a getter and
 * `Object.keys` / `Object.entries` / spread / `JSON.stringify` all skip a
 * non-enumerable one; symbol keys, by their description; array elements; `Map`
 * keys and values; `Set` members; and a thrown payload, which is scanned like
 * any other object.
 *
 * WHAT IT DOES NOT REACH, stated because a walker's gaps are its verdict:
 *
 *  - A returned FUNCTION is walked for its own properties and is not called.
 *    Calling an arbitrary returned closure with invented arguments is not
 *    something this can do safely, so a name produced only by invoking one is
 *    outside it. A getter is called; a method is not.
 *  - `Error.stack` is skipped deliberately. It is the runtime's text about file
 *    paths rather than a value the module produced, and scanning it would make
 *    the verdict depend on where the repository is checked out.
 *  - A `Proxy` whose `ownKeys` trap lies is walked as the trap describes it.
 *    `Reflect.ownKeys` is the widest enumeration available and a trap can still
 *    return nothing while `get` answers. Nothing in this directory constructs a
 *    Proxy — `DRIVE_CENSUS.PROXIES` is zero across the whole drive, and the
 *    tripwire's is one, so the branch is measured rather than assumed.
 */
function deepScan(root: unknown, label: string): ScanResult {
  const strings: ScannedString[] = [];
  const trace: string[] = [];
  const visited = new Set<object>();
  let nodes = 0;
  let depthCuts = 0;
  let gettersInvoked = 0;
  let getterThrows = 0;
  let revisits = 0;
  let proxies = 0;

  const isIndexKey = (key: string): boolean => /^(?:0|[1-9][0-9]*)$/.test(key);

  const scan = (value: unknown, at: string, depth: number): void => {
    if (depth > VALUE_WALK_MAX_DEPTH) {
      depthCuts += 1;
      return;
    }
    if (typeof value === 'string') {
      strings.push({ path: at, value, viaKey: false });
      trace.push(`${at}=${value}`);
      return;
    }
    if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
      trace.push(`${at}=${String(value)}`);
      return;
    }
    if (typeof value === 'symbol') {
      const description = value.description;
      if (description !== undefined) strings.push({ path: `${at}@@`, value: description, viaKey: false });
      return;
    }
    if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return;

    const node = value as object;
    if (visited.has(node)) {
      revisits += 1;
      return;
    }
    visited.add(node);
    nodes += 1;
    if (nodeTypes.isProxy(node)) proxies += 1;

    if (node instanceof Map) {
      let index = 0;
      for (const [key, entry] of node) {
        scan(key, `${at}{mapKey${String(index)}}`, depth + 1);
        scan(entry, `${at}{mapVal${String(index)}}`, depth + 1);
        index += 1;
      }
    }
    if (node instanceof Set) {
      let index = 0;
      for (const member of node) {
        scan(member, `${at}{setMember${String(index)}}`, depth + 1);
        index += 1;
      }
    }

    const isArray = Array.isArray(node);
    const isError = node instanceof Error;
    for (const key of Reflect.ownKeys(node)) {
      if (typeof key === 'symbol') {
        const description = key.description;
        if (description !== undefined) {
          strings.push({ path: `${at}[@@key]`, value: description, viaKey: true });
        }
      } else {
        if (isError && key === 'stack') continue;
        if (!(isArray && (isIndexKey(key) || key === 'length'))) {
          // The KEY itself is a reachable string. Attack shape 8 puts the name
          // here rather than in a value.
          strings.push({ path: `${at}[key]`, value: key, viaKey: true });
        }
      }
      const descriptor = Object.getOwnPropertyDescriptor(node, key);
      if (descriptor === undefined) continue;
      const path = `${at}.${String(key)}`;
      if (descriptor.get !== undefined) {
        gettersInvoked += 1;
        try {
          scan(descriptor.get.call(node), path, depth + 1);
        } catch {
          getterThrows += 1;
        }
      } else {
        scan(descriptor.value, path, depth + 1);
      }
    }
  };

  scan(root, label, 0);
  return {
    strings: Object.freeze(strings),
    nodes,
    depthCuts,
    gettersInvoked,
    getterThrows,
    revisits,
    proxies,
    trace: Object.freeze(trace),
  };
}

/** The ten shipped namespaces, keyed by the file name the census reports. */
const MODULE_NAMESPACES: Readonly<Record<string, Readonly<Record<string, unknown>>>> = Object.freeze({
  'empireCore.ts': core as unknown as Readonly<Record<string, unknown>>,
  'empireInvariant.ts': invariant as unknown as Readonly<Record<string, unknown>>,
  'empireTuning.ts': tuningModule as unknown as Readonly<Record<string, unknown>>,
  'engagement.ts': engagementModule as unknown as Readonly<Record<string, unknown>>,
  'expansion.ts': expansionModule as unknown as Readonly<Record<string, unknown>>,
  'npc.ts': npcModule as unknown as Readonly<Record<string, unknown>>,
  'production.ts': productionModule as unknown as Readonly<Record<string, unknown>>,
  'recruitment.ts': recruitmentModule as unknown as Readonly<Record<string, unknown>>,
  'reputation.ts': reputationModule as unknown as Readonly<Record<string, unknown>>,
  'social.ts': socialModule as unknown as Readonly<Record<string, unknown>>,
});

// ---------------------------------------------------------------------------
// The domains — one per UNIT, each derived from the branch points of the
// quantity it is a domain OF, and every one of them asserted
// ---------------------------------------------------------------------------

/**
 * The quantity a numeric driver axis is measured in.
 *
 * WHY A UNIT EXISTS AT ALL, MEASURED RATHER THAN ARGUED. An earlier version of
 * this file had one `NUMBER_DOMAIN` derived from every threshold, and beside it
 * a `SMALL_NUMBER_DOMAIN` of ten points — `{0,1,8,9,10,11,12,13,40,48}` —
 * derived from the two OFFLINE_EARNINGS *hour* thresholds and captioned "a
 * cheap subset, for the calls whose cost is a whole simulated calendar". It was
 * then handed to eight axes that are not hours: calendar days, expansion
 * levels, check-ins, grant seconds, upkeep Gym Bucks and history slots.
 * `RIVAL_COMPARISON_PERIOD_DAYS` is 7, it was already in the threshold table,
 * and the file's own header claimed the domain was "derived from the subject's
 * own branch points" — but the axis that branches on 7 was never handed 7. A
 * `recordFriendVisit` that returned a forbidden name on exactly day 7 was
 * invisible to both instruments: `tsc --noEmit` exit 0, 13 files and 484 tests
 * green.
 *
 * So a domain is not "big" or "small". It is a domain OF something, and the
 * thing it is of is what decides which branch points it has to contain. Every
 * threshold below is filed under its unit, every domain declares the units it
 * is a domain of, and 'every domain straddles every threshold of its own units'
 * loops the REGISTRY rather than one hand-picked member of it.
 */
const AXIS_UNITS = [
  'second',
  'hour',
  'day',
  'level',
  'count',
  'reputation',
  'gymBucks',
  'trainingIq',
] as const;

type AxisUnit = (typeof AXIS_UNITS)[number];

/** One named threshold per rung, so a ladder is filed like a scalar. */
function rungs(name: string, ladder: readonly number[]): Readonly<Record<string, number>> {
  const table: Record<string, number> = {};
  ladder.forEach((value, index) => {
    table[`${name}[${String(index)}]`] = value;
  });
  return Object.freeze(table);
}

/**
 * Every number this directory branches on, read out of `EMPIRE_TUNING` and
 * filed under the unit it is measured in.
 *
 * Two entries are derived rather than read — the offline-earnings caps in
 * SECONDS — because the code divides seconds by `SECONDS_PER_HOUR` and compares
 * the result against the hour caps, so both the hour and the second are real
 * branch points and they are different numbers.
 *
 * Its limit, stated because the classification is a judgement and nothing here
 * checks it against the code: a threshold filed under the wrong unit is still
 * in `NUMBER_DOMAIN` (which is every unit) but is missing from the narrow
 * domain that needed it, which is exactly the bypass above one level in. What
 * covers that is 'no unit is empty and every threshold is filed exactly once'
 * plus the rule that a narrow domain may only be used where the full domain was
 * MEASURED to be too expensive — the measurements are in `DOMAIN_COST_SECONDS`,
 * and six of the eight axes that used to share the ten-point domain are on the
 * full domain now because the measurement said they were free.
 */
const UNIT_THRESHOLDS: Readonly<Record<AxisUnit, Readonly<Record<string, number>>>> = Object.freeze({
  second: Object.freeze({
    SECONDS_PER_HOUR: EMPIRE_TUNING.SECONDS_PER_HOUR,
    SECONDS_PER_DAY: EMPIRE_TUNING.SECONDS_PER_DAY,
    BUILD_SECONDS_BASE: EMPIRE_TUNING.BUILD_SECONDS_BASE,
    BUILD_SECONDS_MAX: EMPIRE_TUNING.BUILD_SECONDS_MAX,
    TIMER_SKIP_SECONDS_PER_GRANT: EMPIRE_TUNING.TIMER_SKIP_SECONDS_PER_GRANT,
    OFFLINE_EARNINGS_NO_PUNISH_SECONDS:
      EMPIRE_TUNING.OFFLINE_EARNINGS_NO_PUNISH_HOURS * EMPIRE_TUNING.SECONDS_PER_HOUR,
    OFFLINE_EARNINGS_CAP_SECONDS:
      EMPIRE_TUNING.OFFLINE_EARNINGS_CAP_HOURS * EMPIRE_TUNING.SECONDS_PER_HOUR,
  }),
  hour: Object.freeze({
    OFFLINE_EARNINGS_NO_PUNISH_HOURS: EMPIRE_TUNING.OFFLINE_EARNINGS_NO_PUNISH_HOURS,
    OFFLINE_EARNINGS_CAP_HOURS: EMPIRE_TUNING.OFFLINE_EARNINGS_CAP_HOURS,
  }),
  day: Object.freeze({
    NPC_TENURE_DAYS_TO_FULL_LOYALTY: EMPIRE_TUNING.NPC_TENURE_DAYS_TO_FULL_LOYALTY,
    PHYSIO_MAX_DAYS_SAVED: EMPIRE_TUNING.PHYSIO_MAX_DAYS_SAVED,
    RIVAL_COMPARISON_PERIOD_DAYS: EMPIRE_TUNING.RIVAL_COMPARISON_PERIOD_DAYS,
  }),
  level: Object.freeze({
    SPACE_LEVEL_MAX: EMPIRE_TUNING.SPACE_LEVEL_MAX,
    COACH_LEVEL_MAX: EMPIRE_TUNING.STAFF_LEVEL_MAX.coach,
    // The sibling of the line above, listed because CLAUDE.md's rule is that a
    // guard written for one arm must be applied to the arm below it. It carries
    // the same value as the coach ceiling today and dedupes to nothing; that is
    // a fact about this tuning and not a reason to leave it unlisted.
    SPOTTER_LEVEL_MAX: EMPIRE_TUNING.STAFF_LEVEL_MAX.spotter,
    PHYSIO_LEVEL_MAX: EMPIRE_TUNING.STAFF_LEVEL_MAX.physio,
  }),
  count: Object.freeze({
    ROSTER_SLOTS_BASE: EMPIRE_TUNING.ROSTER_SLOTS_BASE,
    ROSTER_SLOTS_MAX: EMPIRE_TUNING.ROSTER_SLOTS_MAX,
    FRIEND_VISITS_PER_DAY: EMPIRE_TUNING.FRIEND_VISITS_PER_DAY,
    REGIONAL_BRACKET: EMPIRE_TUNING.LEADERBOARD_BRACKET_SIZE.regional,
    // The sibling again: the regional bracket was in the old table and the
    // global one was not.
    GLOBAL_BRACKET: EMPIRE_TUNING.LEADERBOARD_BRACKET_SIZE.global,
  }),
  reputation: Object.freeze({
    REPUTATION_MAX: EMPIRE_TUNING.REPUTATION_MAX,
    ...rungs('REPUTATION_TIER_THRESHOLDS', EMPIRE_TUNING.REPUTATION_TIER_THRESHOLDS),
  }),
  gymBucks: Object.freeze({
    ...rungs('SPACE_LEVEL_COST_GYM_BUCKS', EMPIRE_TUNING.SPACE_LEVEL_COST_GYM_BUCKS),
    ...rungs(
      'SPONSOR_GYM_BUCKS_PER_DAY_BY_REPUTATION_TIER',
      EMPIRE_TUNING.SPONSOR_GYM_BUCKS_PER_DAY_BY_REPUTATION_TIER,
    ),
    // The two payouts the upkeep axis is denominated in. That axis was on the
    // hour-derived domain and so was never driven at either of them.
    RIVAL_REWARD_GYM_BUCKS: EMPIRE_TUNING.RIVAL_REWARD_GYM_BUCKS,
    ENCOURAGEMENT_REWARD_GYM_BUCKS: EMPIRE_TUNING.ENCOURAGEMENT_REWARD_GYM_BUCKS,
  }),
  trainingIq: Object.freeze({
    TRAINING_IQ_DAILY_CEILING: EMPIRE_TUNING.TRAINING_IQ_DAILY_CEILING,
  }),
});

/** Below, just below, at, just above, far above. Negatives dropped, not clamped. */
function straddle(threshold: number): readonly number[] {
  return [threshold - 2, threshold - 1, threshold, threshold + 1, threshold * 4].filter(
    (point) => Number.isFinite(point) && point >= 0,
  );
}

const numeric = (values: readonly number[]): readonly number[] =>
  [...new Set(values)].sort((left, right) => left - right);

/** Every threshold of the named units, straddled, plus the two shape points. */
function domainOf(units: readonly AxisUnit[], extra: readonly number[] = []): readonly number[] {
  return numeric([
    0,
    1,
    ...units.flatMap((unit) => Object.values(UNIT_THRESHOLDS[unit]).flatMap(straddle)),
    ...extra,
  ]);
}

/**
 * A numeric driver axis's domain, and the units it is a domain OF.
 *
 * `units` is what the containment assertion reads. `alsoContains` is for a
 * domain whose axis is narrower than any whole unit — it names individual
 * thresholds, checked exactly the same way, so a domain can never declare zero
 * obligations and pass. `why` is required and is required to be long, because
 * every one of these that is not `NUMBER` is a cost concession and a concession
 * without a stated price is how the ten-point domain survived six rounds.
 */
interface NumericDomain {
  readonly units: readonly AxisUnit[];
  readonly alsoContains: Readonly<Record<string, number>>;
  readonly points: readonly number[];
  readonly why: string;
}

/** Freeze one registry entry at the interface, so its key stays concrete. */
function domainSpec(spec: NumericDomain): NumericDomain {
  return Object.freeze(spec);
}

/**
 * MEASURED, not estimated: what the whole file costs with each axis moved from
 * the ten-point hour-derived domain to the full domain, one axis at a time,
 * against a 6.4 s baseline on the same machine in the same session.
 *
 * This is the answer to "cost is the reason the small domain exists". Six of
 * the eight axes were free — four of them measured FASTER than the baseline,
 * which is noise and is the point: the difference is below the measurement's
 * own resolution. Only two axes cost anything, and both cost it because the
 * subject is linear in the axis and the full domain's top point is 480 000.
 * Those two got a domain of their own quantity; the other six are on the full
 * domain now.
 */
const DOMAIN_COST_SECONDS: readonly (readonly [string, number])[] = Object.freeze([
  ['baseline, whole file, ten-point domain at all eight axes', 6.4],
  ['applyAccelerant / grant seconds', 6.0],
  ['accrueReputation / check-ins', 7.8],
  ['axisLevelCost and three siblings / expansion level', 6.1],
  ['applyPurchasableGrant / grant seconds', 5.9],
  ['grantSecondsAt / grants x check-in', 6.6],
  ['engagementWiring / upkeep', 5.8],
  ['historyFrom and four siblings / history slots', 18.3],
  ['fifteen social exports / calendar day', 67.3],
]);

const NUMERIC_DOMAINS = Object.freeze({
  NUMBER: domainSpec({
    units: [...AXIS_UNITS],
    alsoContains: Object.freeze({}),
    points: domainOf([...AXIS_UNITS]),
    why:
      'The default, and the one every axis uses unless a measurement in ' +
      'DOMAIN_COST_SECONDS says it cannot afford to. It is the union of every ' +
      'unit domain, so it contains every branch point this directory has, and ' +
      'the containment assertion below is therefore trivially satisfiable for ' +
      'it — which is fine, because for this domain the interesting property is ' +
      'that nothing was left out rather than that anything was put in.',
  }),
  SECONDS: domainSpec({
    units: ['second'],
    alsoContains: Object.freeze({}),
    points: domainOf(['second']),
    why:
      'Elapsed-seconds axes: build timers, clocks, recruitment schedules and ' +
      'the offline banking horizon. Separate from NUMBER because a seconds ' +
      'axis is driven at four or five call sites per point and the seconds ' +
      'thresholds are the large ones, but the saving is small and this domain ' +
      'could be folded into NUMBER if a future site needs it; it is kept ' +
      'because a seconds axis handed a level-sized number tests nothing.',
  }),
  DAY: domainSpec({
    units: ['day'],
    alsoContains: Object.freeze({}),
    points: domainOf(['day']),
    why:
      'Calendar days, and the axis the bypass rode in on. socialRewardSchedule ' +
      'and rivalPeriodCloseDays are linear in the day, and every value they ' +
      'return is deep-scanned, so the full domain costs 67.3 s against a 6.4 s ' +
      'baseline — its top point is 480 000 and each of those is 480 000 frozen ' +
      'objects. The day thresholds top out at 120, which is a horizon a real ' +
      'calendar reaches, and RIVAL_COMPARISON_PERIOD_DAYS is in it by ' +
      'construction rather than by anybody remembering.',
  }),
  COUNT: domainSpec({
    units: ['count'],
    alsoContains: Object.freeze({}),
    points: domainOf(['count']),
    why:
      'Slot counts and roster-sized quantities. historyFrom allocates one ' +
      'entry per slot and four more exports then walk the result, so the full ' +
      'domain costs 18.3 s against a 6.4 s baseline for the same reason the ' +
      'day axis does. The count thresholds top out at 400, which is well ' +
      'past ROSTER_SLOTS_MAX and past both leaderboard brackets.',
  }),
  LEVEL: domainSpec({
    units: ['level'],
    alsoContains: Object.freeze({}),
    points: domainOf(['level']),
    why:
      'Expansion and staff levels, for the axes that build a GymAxes per point ' +
      'and cross it with every equipment tier and every expansion axis. This ' +
      'one replaces an inline [0, SPACE_LEVEL_MAX] literal, which is CLAUDE.md ' +
      'sampling only the extremes exactly: the space ceiling was sampled at ' +
      'its two ends and never at a level in between, and the staff ceilings ' +
      'were never sampled at all.',
  }),
  ROSTER_SHAPE: domainSpec({
    units: [],
    alsoContains: Object.freeze({
      ROSTER_SLOTS_BASE: EMPIRE_TUNING.ROSTER_SLOTS_BASE,
      ROSTER_SLOTS_MAX: EMPIRE_TUNING.ROSTER_SLOTS_MAX,
    }),
    points: numeric([
      0,
      1,
      EMPIRE_TUNING.ROSTER_SLOTS_BASE,
      EMPIRE_TUNING.ROSTER_SLOTS_MAX,
      EMPIRE_TUNING.ROSTER_SLOTS_MAX + 1,
    ]),
    why:
      'The roster sizes STATES is built at, which is the most expensive axis ' +
      'in the file: every point here multiplies the reputation ladder and the ' +
      'product is then crossed with tiers, clocks and the whole NUMBER domain. ' +
      'It is declared with named thresholds rather than a unit because the ' +
      'count unit tops out at 400 and 400 lifters per state is not affordable ' +
      'here. It was [0, 1, ROSTER_SLOTS_MAX] and so never sampled base ' +
      'capacity or a roster over capacity, which are both real branches in ' +
      'rosterCapacity and in the recruitment refusals that read it.',
  }),
});

const NUMBER_DOMAIN: readonly number[] = NUMERIC_DOMAINS.NUMBER.points;
const SECONDS_DOMAIN: readonly number[] = NUMERIC_DOMAINS.SECONDS.points;
const DAY_DOMAIN: readonly number[] = NUMERIC_DOMAINS.DAY.points;
const COUNT_DOMAIN: readonly number[] = NUMERIC_DOMAINS.COUNT.points;
const LEVEL_DOMAIN: readonly number[] = NUMERIC_DOMAINS.LEVEL.points;
const ROSTER_SHAPES: readonly number[] = NUMERIC_DOMAINS.ROSTER_SHAPE.points;

/**
 * The horizon the composed-loop drivers run to.
 *
 * A named constant rather than `RUN_DAY_DOMAIN[1]`, which is what it used to
 * be: a positional read out of a domain is a silent dependency on that domain's
 * sort order, and this round changes the domain.
 */
const RUN_HORIZON_DAYS = EMPIRE_TUNING.RIVAL_COMPARISON_PERIOD_DAYS;

/**
 * The loop axes in this file that are written as an array literal at their
 * call site rather than as a domain, each with the reason it is not a domain.
 *
 * This is the catcher for the registry's declared limit. `NUMERIC_DOMAINS` is
 * discovered at runtime, so a domain inside it cannot escape the containment
 * assertion — but an axis written as a bare array literal at its call site was
 * never in the registry to be discovered. Two of the eight axes in this file
 * were exactly that, and one of them (`[0, SPACE_LEVEL_MAX]`) was a threshold
 * axis sampled at its two extremes. It is `LEVEL_DOMAIN` now; these six are
 * what is left, and 'every literal for-of axis is declared' pins the set in
 * both directions so a seventh cannot arrive quietly.
 */
const LITERAL_AXES: readonly (readonly [string, string])[] = Object.freeze([
  ['accelerant', 'null and one purchasable accelerant: the presence of a plan, not a magnitude.'],
  ['diagnostic', 'the fixed list of TypeScript diagnostic categories the surface walk reports.'],
  ['encourage', 'the boolean argument to recordFriendVisit. Two points is the whole domain.'],
  ['everyNth', 'a divisor selecting which slots are check-ins. A shape parameter — every slot, or every other — and not a magnitude with thresholds.'],
  ['gymId', 'four caller-supplied identifiers: two friends, the player, and one that is not on the friend list. The second friend is what makes the VISITED arm reachable. Strings, not numbers.'],
  ['identifier', 'the three sentinels fed to asNpcId, one per caller-supplied identifier position. Strings, not numbers.'],
  ['last', 'the boolean telling spendingMoment whether this is the final moment. Two points is the whole domain.'],
]);

/**
 * What the registry measured on this tree. Counts, not bounds.
 *
 * `CONTAINMENT_CHECKS` is the one that says the assertion below is not looping
 * over an empty registry or an empty obligation list — it is the number of
 * (domain, threshold) pairs actually checked, and a domain that declares no
 * units and no `alsoContains` would leave it short rather than pass.
 */
const DOMAIN_CENSUS = Object.freeze({
  UNITS: 8,
  THRESHOLDS: 40,
  DOMAINS: 6,
  CONTAINMENT_CHECKS: 61,
  ALIASES: 6,
  LITERAL_AXES: 7,
  COST_ROWS: 9,
  NUMBER_POINTS: 118,
  SECONDS_POINTS: 27,
  DAY_POINTS: 13,
  COUNT_POINTS: 24,
  LEVEL_POINTS: 9,
  ROSTER_SHAPE_POINTS: 5,
});

// ---------------------------------------------------------------------------
// Sentinels — the strings that prove a position was REACHED
// ---------------------------------------------------------------------------

/**
 * A unique, benign string per caller-supplied string position.
 *
 * These exist because every one of instrument A's five bare-string fields is
 * EMPTY on the obvious fixture: `createEmpireState()` returns
 * `roster: Object.freeze([])`, `createEmpireGym()` returns an empty `pending`,
 * and all eight fault functions are pinned at `[]` on healthy input. A driver
 * built on those would sample an empty string domain, pin an honest count of
 * zero banned names, and be vacuous in the exact shape CLAUDE.md names — "a
 * sweep whose generator never produces the failing case".
 *
 * So each position is fed a sentinel and `SENTINELS_OBSERVED` asserts, as a set
 * equality, that the walk found every one of them. A position that stops being
 * reachable reddens instead of quietly emptying.
 *
 * NO BANNED NAME IS EVER PASSED IN AS AN ARGUMENT, anywhere in this file. A
 * driver that feeds poison and then finds poison has measured its own fixture.
 * Every banned name the check reports was therefore produced by the subject.
 * The check that goes red if this stops holding is 'produces no banned name
 * from any export but the two that ARE the ban lists' — a re-read argument is
 * inside its domain, so poison handed in comes back out at it.
 *
 * That sentence is a guarantee and the tree-wide census in
 * `src/game/guaranteeTags.test.ts` does not count it, which is disclosed here
 * rather than acted on. Its trigger list is NEVER / CANNOT / ALWAYS / ONLY, and
 * this says "NO … EVER". Measured: this file contributes ZERO triggering runs
 * and twenty-seven capitalised runs of three words or more, so the pin at 225
 * is correct for what that scan measures and wrong about this paragraph.
 * Nothing here was rephrased in either direction to reach that number —
 * `guaranteeTags.test.ts` is outside this piece's scope and a synonym swap in
 * either direction is the evasion CLAUDE.md records twice already.
 */
const SENTINELS = Object.freeze({
  NPC_ID: 'sentinel-npc-id',
  NPC_DISPLAY_NAME: 'sentinel-npc-display-name',
  RECRUIT_ID: 'sentinel-recruit-id',
  RECRUIT_DISPLAY_NAME: 'sentinel-recruit-display-name',
  OWN_GYM_ID: 'sentinel-own-gym-id',
  OWN_GYM_DISPLAY_NAME: 'sentinel-own-gym-display-name',
  FRIEND_GYM_ID: 'sentinel-friend-gym-id',
  FRIEND_GYM_DISPLAY_NAME: 'sentinel-friend-gym-display-name',
  RIVAL_GYM_ID: 'sentinel-rival-gym-id',
  ENCOURAGEMENT_FROM: 'sentinel-encouragement-from-gym',
  FAULT_EQUIPMENT: 'sentinel-not-an-equipment-tier',
  FAULT_VISIT_GYM_ID: 'sentinel-unfriended-gym-id',
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ZERO_SECONDS: UnacceleratedSeconds = core.asUnacceleratedSeconds(0);

function booksAt(balance: number): WallClockBooks {
  const books: Partial<Record<WallClockFundedOutput, core.GymBucks>> = {};
  for (const output of core.WALL_CLOCK_FUNDED_OUTPUTS) books[output] = core.asGymBucks(balance);
  return Object.freeze(books as Record<WallClockFundedOutput, core.GymBucks>);
}

function axesAt(equipment: EquipmentTier, spaceLevel: number, staff: Record<StaffRole, number>): GymAxes {
  return Object.freeze({ equipment, spaceLevel, staffLevel: Object.freeze({ ...staff }) });
}

/**
 * Axes wide enough to hold the largest LEGAL roster.
 *
 * Not the largest roster the sweep builds: `ROSTER_SHAPE` straddles
 * `ROSTER_SLOTS_MAX` on both sides on purpose, so one of its points is one
 * lifter OVER capacity and `empireStateFaults` has something to say about it.
 * That is the branch a domain sampling only `[0, 1, ROSTER_SLOTS_MAX]` could
 * not reach, and it is why the diagnostic-channel census moved.
 */
const WIDE_AXES: GymAxes = axesAt(
  EMPIRE_TUNING.EQUIPMENT_TIERS[EMPIRE_TUNING.EQUIPMENT_TIERS.length - 1] as EquipmentTier,
  EMPIRE_TUNING.SPACE_LEVEL_MAX,
  {
    coach: EMPIRE_TUNING.STAFF_LEVEL_MAX.coach,
    spotter: EMPIRE_TUNING.STAFF_LEVEL_MAX.spotter,
    physio: EMPIRE_TUNING.STAFF_LEVEL_MAX.physio,
  },
);

const OPENING_AXES: GymAxes = axesAt(EMPIRE_TUNING.EQUIPMENT_TIERS[0] as EquipmentTier, 0, {
  coach: 0,
  spotter: 0,
  physio: 0,
});

function lifterAt(tier: NpcTier, index: number, joinedAt: number, settledAt: number): NpcLifter {
  return core.createNpcLifter(
    `${SENTINELS.NPC_ID}-${String(index)}`,
    tier,
    `${SENTINELS.NPC_DISPLAY_NAME}-${String(index)}`,
    joinedAt,
    settledAt,
  );
}

function rosterOf(size: number, joinedAt: number, settledAt: number): readonly NpcLifter[] {
  return Object.freeze(
    Array.from({ length: size }, (_unused, index) =>
      lifterAt(
        EMPIRE_TUNING.NPC_TIERS[index % EMPIRE_TUNING.NPC_TIERS.length] as NpcTier,
        index,
        joinedAt,
        settledAt,
      ),
    ),
  );
}

interface StateOptions {
  readonly reputation?: number;
  readonly gymBucks?: number;
  readonly settledGymBucks?: number;
  readonly rosterSize?: number;
  readonly elapsed?: number;
  readonly skipped?: number;
  readonly wide?: boolean;
}

function stateAt(options: StateOptions): EmpireState {
  const axes = options.wide === true ? WIDE_AXES : OPENING_AXES;
  const gymBucks = options.gymBucks ?? 0;
  return Object.freeze({
    clock: core.createEmpireClock(options.elapsed ?? 0, options.skipped ?? 0),
    axes,
    settledAxes: axes,
    roster: rosterOf(options.rosterSize ?? 0, 0, 0),
    reputation: core.asReputation(options.reputation ?? 0),
    gymBucks: core.asGymBucks(gymBucks),
    settledBooks: booksAt(options.settledGymBucks ?? gymBucks),
    ledger: Object.freeze([]),
    accelerants: Object.freeze([]),
  });
}

function snapshotAt(gymId: string, displayName: string, reputation: number, totalKg: number): GymSnapshot {
  return Object.freeze({ gymId, displayName, reputation, combinedTotalKg: totalKg });
}

function completedBuild(axis: ExpansionAxis, toLevel: number): ExpansionBuild {
  return Object.freeze({
    axis,
    toLevel,
    paid: core.asGymBucks(0),
    startedAt: ZERO_SECONDS,
    settledCompletion: ZERO_SECONDS,
    idleCompletion: core.asAcceleratedSeconds(0),
  });
}

function contextAt(gymBucks: number, reputation: number, builds: readonly ExpansionBuild[]): ExpansionContext {
  return Object.freeze({
    clock: core.createEmpireClock(0, 0),
    gymBucks: core.asGymBucks(gymBucks),
    settledBooks: booksAt(gymBucks),
    reputation: core.asReputation(reputation),
    builds,
  });
}

/**
 * An `AppliedAccelerant` for an accelerant known only at runtime.
 *
 * `applyAccelerant` refuses a widened accelerant type on purpose, so a loop
 * cannot call it. The switch re-narrows per arm; the same shape exists in
 * `expansion.test.ts` and is reproduced rather than imported because that file
 * does not export it.
 */
function appliedFor(
  accelerant: EmpireAccelerant,
  output: EmpireOutput,
  at: UnacceleratedSeconds,
  seconds: number,
): AppliedAccelerant {
  switch (accelerant) {
    case 'gym-empire-timer-skip':
      return core.applyAccelerant('gym-empire-timer-skip', output as AccelerableOutput<'gym-empire-timer-skip'>, at, seconds);
    case 'rewarded-ad-timer-skip':
      return core.applyAccelerant('rewarded-ad-timer-skip', output as AccelerableOutput<'rewarded-ad-timer-skip'>, at, seconds);
    case 'coach-staff-level':
      return core.applyAccelerant('coach-staff-level', output as AccelerableOutput<'coach-staff-level'>, at, seconds);
    case 'space-level':
      return core.applyAccelerant('space-level', output as AccelerableOutput<'space-level'>, at, seconds);
    case 'reputation-tier':
      return core.applyAccelerant('reputation-tier', output as AccelerableOutput<'reputation-tier'>, at, seconds);
  }
}

function acceleratedFor(accelerant: EmpireAccelerant, output: EmpireOutput): core.AcceleratedOutput {
  switch (accelerant) {
    case 'gym-empire-timer-skip':
      return core.acceleratedOutput('gym-empire-timer-skip', output as AccelerableOutput<'gym-empire-timer-skip'>);
    case 'rewarded-ad-timer-skip':
      return core.acceleratedOutput('rewarded-ad-timer-skip', output as AccelerableOutput<'rewarded-ad-timer-skip'>);
    case 'coach-staff-level':
      return core.acceleratedOutput('coach-staff-level', output as AccelerableOutput<'coach-staff-level'>);
    case 'space-level':
      return core.acceleratedOutput('space-level', output as AccelerableOutput<'space-level'>);
    case 'reputation-tier':
      return core.acceleratedOutput('reputation-tier', output as AccelerableOutput<'reputation-tier'>);
  }
}

const CALENDAR_ANCHOR = 0;

function calendarAt(anchorDay: number): SocialCalendarContext {
  return Object.freeze({
    anchorDay: socialModule.asCalendarDay(anchorDay),
    trainedDays: Object.freeze(
      [1, 3, 4, 8, 13, 21].map((day) => socialModule.asCalendarDay(anchorDay + day)),
    ),
    sessionCount: EMPIRE_TUNING.ROSTER_SLOTS_MAX,
    streakDays: EMPIRE_TUNING.RIVAL_COMPARISON_PERIOD_DAYS,
    passTiersUnlocked: EMPIRE_TUNING.PHYSIO_MAX_DAYS_SAVED,
  });
}

function encouragementsAt(anchorDay: number): readonly Encouragement[] {
  return Object.freeze(
    [2, 5, 5, 11].map((day, at) =>
      Object.freeze({
        day: socialModule.asCalendarDay(anchorDay + day),
        fromGymId: `${SENTINELS.ENCOURAGEMENT_FROM}-${String(Math.floor(at / 2))}`,
      }),
    ),
  );
}

const FRIENDS: readonly GymSnapshot[] = Object.freeze([
  snapshotAt(`${SENTINELS.FRIEND_GYM_ID}-0`, `${SENTINELS.FRIEND_GYM_DISPLAY_NAME}-0`, 0, 0),
  snapshotAt(
    `${SENTINELS.FRIEND_GYM_ID}-1`,
    `${SENTINELS.FRIEND_GYM_DISPLAY_NAME}-1`,
    EMPIRE_TUNING.REPUTATION_MAX,
    EMPIRE_TUNING.RIVAL_REWARD_GYM_BUCKS,
  ),
]);

const OWN_GYM: GymSnapshot = snapshotAt(
  SENTINELS.OWN_GYM_ID,
  SENTINELS.OWN_GYM_DISPLAY_NAME,
  EMPIRE_TUNING.REPUTATION_TIER_THRESHOLDS[1] as number,
  0,
);

const RIVAL_GYM: GymSnapshot = snapshotAt(
  SENTINELS.RIVAL_GYM_ID,
  `${SENTINELS.FRIEND_GYM_DISPLAY_NAME}-rival`,
  EMPIRE_TUNING.REPUTATION_TIER_THRESHOLDS[2] as number,
  0,
);

function socialContextAt(visitDays: readonly number[]): SocialContext {
  return Object.freeze({
    ownGym: OWN_GYM,
    calendar: calendarAt(CALENDAR_ANCHOR),
    friends: FRIENDS,
    visits: Object.freeze(
      visitDays.map((day, index) =>
        Object.freeze({
          day: socialModule.asCalendarDay(day),
          gymId: `${SENTINELS.FRIEND_GYM_ID}-${String(index % FRIENDS.length)}`,
          encouraged: index % 2 === 0,
        }),
      ),
    ),
    encouragementsReceived: encouragementsAt(CALENDAR_ANCHOR),
    rival: RIVAL_GYM,
  });
}

function socialInputsAt(): SocialInputs {
  return Object.freeze({
    calendar: calendarAt(CALENDAR_ANCHOR),
    rival: RIVAL_GYM,
    encouragementsReceived: encouragementsAt(CALENDAR_ANCHOR),
  });
}

function policyAt(checkInsPerDay: number): EmpirePolicy {
  return Object.freeze({
    checkInsPerDay,
    axisOrder: Object.freeze([...expansionModule.EXPANSION_AXES]),
    leaderboardMetric: 'reputation',
  });
}

function planAt(accelerant: core.PurchasableAccelerant | null, grantsPerCheckIn: number): invariant.AccelerantPlan {
  return Object.freeze({ accelerant, grantsPerCheckIn, firstCheckIn: 1, everyNthCheckIn: 1 });
}

function historyAt(slots: number, everyNth: number): EngagementHistory {
  return engagementModule.historyFrom(
    slots,
    (slot) => slot % everyNth === 0,
    [1, 3, 4, 8, 13],
  );
}

function entryAt(day: number, output: EmpireOutput, amount: number): EmpireDayEntry {
  return Object.freeze({ day, at: core.asUnacceleratedSeconds(day * EMPIRE_TUNING.SECONDS_PER_DAY), output, amount });
}

// ---------------------------------------------------------------------------
// The drive
// ---------------------------------------------------------------------------

interface DrivenRow {
  readonly export: string;
  readonly point: string;
  /** The return (or the thrown payload), then every argument, re-read AFTER the call. */
  readonly values: readonly unknown[];
}

const DRIVEN_ROWS: DrivenRow[] = [];

/**
 * Call one export at one domain point and keep everything it could have
 * written to.
 *
 * The arguments are pushed AFTER the call rather than copied before it, so a
 * value delivered by mutating a caller-supplied sink — attack shape 13's second
 * half — is inside the scan. Nothing passed in ever contains a banned name, so
 * a banned name found in an argument was written there by the subject.
 */
function drive(exportName: string, point: string, thunk: () => unknown, args: readonly unknown[] = []): void {
  const values: unknown[] = [];
  try {
    values.push(thunk());
  } catch (error) {
    values.push(error);
  }
  values.push(...args);
  DRIVEN_ROWS.push({ export: exportName, point, values });
}

/** Read an exported constant and keep it, so exported DATA is a subject too. */
function read(exportName: string, value: unknown): void {
  DRIVEN_ROWS.push({ export: exportName, point: 'read', values: [value] });
}

/**
 * The values fed to the `unknown`-taking decoders.
 *
 * Deliberately WITHOUT any banned name. Feeding a decoder its own poison and
 * then finding the poison in the re-read argument measures the fixture, not the
 * subject.
 */
const DECODER_PROBES: readonly unknown[] = Object.freeze([
  ...core.EMPIRE_OUTPUTS,
  ...core.EMPIRE_ACCELERANTS,
  ...socialModule.SOCIAL_SURFACES,
  ...expansionModule.EXPANSION_AXES,
  ...socialModule.LEADERBOARD_METRICS,
  SENTINELS.FAULT_EQUIPMENT,
  '',
  0,
  1,
  true,
  null,
  undefined,
  Object.freeze({ kind: SENTINELS.NPC_ID }),
  Object.freeze([SENTINELS.NPC_ID]),
]);

/** A ledger with one entry per payable output, so the splitters see both reaches. */
const LEDGER: readonly core.EmpireLedgerEntry[] = Object.freeze(
  core.EMPIRE_OUTPUTS.map((output, index) =>
    Object.freeze({ at: core.asUnacceleratedSeconds(index), output, amount: index }),
  ),
);

const DAY_LEDGER: readonly EmpireDayEntry[] = Object.freeze(
  core.EMPIRE_OUTPUTS.map((output, index) => entryAt(index, output, index)),
);

/** The states the sweep drives, shaped on the roster axis and the reputation axis. */
const STATES: readonly (readonly [string, EmpireState])[] = Object.freeze(
  ROSTER_SHAPES.flatMap((rosterSize) =>
    EMPIRE_TUNING.REPUTATION_TIER_THRESHOLDS.map(
      (reputation) =>
        [
          `roster=${String(rosterSize)}/rep=${String(reputation)}`,
          stateAt({
            rosterSize,
            reputation,
            gymBucks: EMPIRE_TUNING.RIVAL_REWARD_GYM_BUCKS,
            wide: true,
            elapsed: EMPIRE_TUNING.SECONDS_PER_DAY,
            skipped: EMPIRE_TUNING.TIMER_SKIP_SECONDS_PER_GRANT,
          }),
        ] as const,
    ),
  ),
);

/**
 * A state that is deliberately faulted, so the diagnostic channel is not empty.
 *
 * `empireStateFaults` is pinned at `[]` on every legal state, so a driver that
 * only ever handed it legal states would sample an empty string domain. The
 * equipment tier carries a sentinel, which lands in a fault message verbatim —
 * that is how `SENTINELS_OBSERVED` measures the channel as REACHED rather than
 * assuming it.
 */
const FAULTED_STATE: EmpireState = Object.freeze({
  ...stateAt({ rosterSize: 1, wide: true }),
  axes: Object.freeze({
    equipment: SENTINELS.FAULT_EQUIPMENT as unknown as EquipmentTier,
    spaceLevel: WIDE_AXES.spaceLevel,
    staffLevel: WIDE_AXES.staffLevel,
  }),
});

const CLOCKS: readonly (readonly [string, EmpireClock])[] = Object.freeze(
  SECONDS_DOMAIN.map(
    (elapsed) =>
      [`elapsed=${String(elapsed)}`, core.createEmpireClock(elapsed, EMPIRE_TUNING.TIMER_SKIP_SECONDS_PER_GRANT)] as const,
  ),
);

/**
 * Collection marks that sit at or behind every state in `STATES`.
 *
 * `accrueProduction` refuses a mark ahead of the gym's own idle clock, so the
 * axis measurement needs points it will actually answer at. The driver above
 * uses the wider `CLOCK_SHAPES` on purpose and keeps the refusals.
 */
const COLLECTION_CLOCKS: readonly (readonly [string, EmpireClock])[] = Object.freeze([
  ['at-zero', core.createEmpireClock(0, 0)],
  ['half-day', core.createEmpireClock(EMPIRE_TUNING.SECONDS_PER_DAY / 2, 0)],
  [
    'half-day-skipped',
    core.createEmpireClock(EMPIRE_TUNING.SECONDS_PER_DAY / 2, EMPIRE_TUNING.TIMER_SKIP_SECONDS_PER_GRANT),
  ],
]);

/** One clock per shape, for the calls that take a clock and are otherwise cheap. */
const CLOCK_SHAPES: readonly (readonly [string, EmpireClock])[] = Object.freeze([
  ['zero', core.createEmpireClock(0, 0)],
  ['no-skip', core.createEmpireClock(EMPIRE_TUNING.SECONDS_PER_DAY, 0)],
  ['skewed', core.createEmpireClock(EMPIRE_TUNING.SECONDS_PER_DAY, EMPIRE_TUNING.BUILD_SECONDS_MAX)],
]);

const BUILDS: readonly ExpansionBuild[] = Object.freeze(
  expansionModule.EXPANSION_AXES.map((axis) => completedBuild(axis, 1)),
);

const CONTEXTS: readonly (readonly [string, ExpansionContext])[] = Object.freeze([
  ['broke', contextAt(0, 0, [])],
  ['rich', contextAt(EMPIRE_TUNING.SPACE_LEVEL_COST_GYM_BUCKS[EMPIRE_TUNING.SPACE_LEVEL_COST_GYM_BUCKS.length - 1] as number, EMPIRE_TUNING.REPUTATION_MAX, [])],
  ['building', contextAt(EMPIRE_TUNING.RIVAL_REWARD_GYM_BUCKS, EMPIRE_TUNING.REPUTATION_MAX, BUILDS)],
]);

/**
 * Check-ins per calendar day the composed drivers run at.
 *
 * Six is a four-hour gap, which is inside GDD §5.1's offline horizon and is the
 * cadence `empireSweep.test.ts` already parameterises its own runs at. Named
 * here rather than shared because that file's constant is a sweep parameter for
 * a different measurement and this one should be tunable on its own.
 */
const EMPIRE_SWEEP_CHECK_INS_PER_DAY = 6;

/** How many check-ins `stepGym` is walked for, so a recruit can start and land. */
const STEP_COUNT = EMPIRE_TUNING.RIVAL_COMPARISON_PERIOD_DAYS * EMPIRE_SWEEP_CHECK_INS_PER_DAY;

/**
 * Runs and a context that are deliberately faulted, so the diagnostic channel
 * has a non-empty domain.
 *
 * Every fault function is pinned at `[]` on healthy input by the tests that
 * already exist, so without these three the whole diagnostic channel would be
 * swept at zero strings and its exemption from the containment check would be
 * an exemption from nothing.
 */
/*
 * BUILT LAZILY, AND THE REASON IS A MEASURED FAILURE OF THIS FILE RATHER THAN A
 * STYLE PREFERENCE.
 *
 * Both of these run the whole engine. While they were module-level `const`s, a
 * planted mutant that made `runEmpire` throw took the file down at IMPORT time
 * — vitest reported `Test Files 1 failed / Tests no tests` and a stack in
 * `assertEmpireState`, with not one of this file's twenty-two checks named.
 * The mutant WAS caught, and the output said nothing about which guarantee had
 * broken. CLAUDE.md's rule is that a check which bites but fails uselessly is
 * half a check, so the engine calls happen inside `driveEverything`, where a
 * throw fails a named test instead of a whole suite.
 */
let faultedRunMemo: invariant.EmpireRun | null = null;

function faultedRun(): invariant.EmpireRun {
  if (faultedRunMemo === null) {
    faultedRunMemo = Object.freeze({
      ...invariant.runEmpire(1, policyAt(EMPIRE_SWEEP_CHECK_INS_PER_DAY), planAt(null, 0), socialInputsAt()),
      ledger: Object.freeze([]),
    });
  }
  return faultedRunMemo;
}

let faultedEngagementRunMemo: engagementModule.EngagementRun | null = null;

function faultedEngagementRun(): engagementModule.EngagementRun {
  if (faultedEngagementRunMemo === null) {
    faultedEngagementRunMemo = Object.freeze({
      ...engagementModule.runEngagement(
        1,
        policyAt(EMPIRE_SWEEP_CHECK_INS_PER_DAY),
        historyAt(EMPIRE_SWEEP_CHECK_INS_PER_DAY, 1),
        socialInputsAt(),
      ),
      ledger: Object.freeze([]),
    });
  }
  return faultedEngagementRunMemo;
}

const FAULTED_SOCIAL_CONTEXT: SocialContext = Object.freeze({
  ...socialContextAt([]),
  visits: Object.freeze([
    Object.freeze({
      day: socialModule.asCalendarDay(CALENDAR_ANCHOR),
      gymId: SENTINELS.FAULT_VISIT_GYM_ID,
      encouraged: false,
    }),
  ]),
});

let drivenMemo = false;

function driveEverything(): readonly DrivenRow[] {
  if (drivenMemo) return DRIVEN_ROWS;
  drivenMemo = true;

  // --- every exported CONSTANT, read directly. Attack shape 12 lives here.
  for (const namespace of Object.values(MODULE_NAMESPACES)) {
    for (const [name, value] of Object.entries(namespace)) {
      if (typeof value === 'function') continue;
      read(name, value);
    }
  }

  // --- empireCore.ts
  for (const output of core.EMPIRE_OUTPUTS) drive('outputReach', output, () => core.outputReach(output));
  for (const accelerant of core.EMPIRE_ACCELERANTS) {
    drive('accelerantLicence', accelerant, () => core.accelerantLicence(accelerant));
    for (const output of core.EMPIRE_OUTPUTS) {
      drive('mayAccelerate', `${accelerant}/${output}`, () => core.mayAccelerate(accelerant, output));
      drive('acceleratedOutput', `${accelerant}/${output}`, () => acceleratedFor(accelerant, output));
      for (const seconds of NUMBER_DOMAIN) {
        drive('applyAccelerant', `${accelerant}/${output}/${String(seconds)}`, () =>
          appliedFor(accelerant, output, ZERO_SECONDS, seconds),
        );
      }
    }
  }
  for (const probe of DECODER_PROBES) {
    const label = String(typeof probe === 'object' ? JSON.stringify(probe) : probe);
    drive('isEmpireOutput', label, () => core.isEmpireOutput(probe), [probe]);
    drive('isEmpireAccelerant', label, () => core.isEmpireAccelerant(probe), [probe]);
    drive('isPurchasableAccelerant', label, () => core.isPurchasableAccelerant(probe), [probe]);
    drive('isProgressionReachingOutput', label, () => core.isProgressionReachingOutput(probe), [probe]);
    drive('isExpansionAxis', label, () => expansionModule.isExpansionAxis(probe), [probe]);
    drive('isSocialSurface', label, () => socialModule.isSocialSurface(probe), [probe]);
    drive('isLeaderboardMetric', label, () => socialModule.isLeaderboardMetric(probe), [probe]);
  }
  drive('empireVocabularyFaults', 'zero-arg', () => core.empireVocabularyFaults());
  drive('expansionVocabularyFaults', 'zero-arg', () => expansionModule.expansionVocabularyFaults());
  drive('reputationVocabularyFaults', 'zero-arg', () => reputationModule.reputationVocabularyFaults());
  drive('socialVocabularyFaults', 'zero-arg', () => socialModule.socialVocabularyFaults());
  for (const point of NUMBER_DOMAIN) {
    const label = String(point);
    drive('asGymBucks', label, () => core.asGymBucks(point));
    drive('asReputation', label, () => core.asReputation(point));
    drive('asTrainingIq', label, () => core.asTrainingIq(point));
    drive('asInjuryDaysSaved', label, () => core.asInjuryDaysSaved(point));
    drive('asUnacceleratedSeconds', label, () => core.asUnacceleratedSeconds(point));
    drive('asAcceleratedSeconds', label, () => core.asAcceleratedSeconds(point));
    drive('asIdleTenureDays', label, () => core.asIdleTenureDays(point));
    drive('asCalendarDay', label, () => socialModule.asCalendarDay(point));
    drive('reputationTierFloor', label, () => reputationModule.reputationTierFloor(point));
    drive('spaceLevelCost', label, () => core.spaceLevelCost(point));
    drive('buildSeconds', label, () => core.buildSeconds(point));
    drive('scrubPrecision', label, () => productionModule.scrubPrecision(point));
    drive('quantiseElapsedSeconds', label, () => productionModule.quantiseElapsedSeconds(point));
    drive('bankableOfflineSeconds', label, () => productionModule.bankableOfflineSeconds(point));
    for (const role of EMPIRE_TUNING.STAFF_ROLES) {
      drive('staffLevelCost', `${role}/${label}`, () => core.staffLevelCost(role, point));
    }
  }
  for (const identifier of [SENTINELS.NPC_ID, SENTINELS.RECRUIT_ID, SENTINELS.OWN_GYM_ID]) {
    drive('asNpcId', identifier, () => core.asNpcId(identifier), [identifier]);
  }
  for (const now of SECONDS_DOMAIN) {
    const times = SECONDS_DOMAIN.slice(0, 4).map((seconds) => core.asUnacceleratedSeconds(seconds));
    drive('settledLevel', String(now), () => core.settledLevel(times, core.asUnacceleratedSeconds(now)), [times]);
    drive('physioDaysSavedFor', String(now), () =>
      core.physioDaysSavedFor(core.settledLevel(times, core.asUnacceleratedSeconds(now))),
    );
  }
  for (const elapsed of SECONDS_DOMAIN) {
    drive('createEmpireClock', String(elapsed), () => core.createEmpireClock(elapsed, elapsed));
  }
  for (const [label, clock] of CLOCK_SHAPES) {
    for (const output of core.EMPIRE_OUTPUTS) {
      drive('elapsedFor', `${label}/${output}`, () => core.elapsedFor(clock, output));
    }
    for (const output of core.GATING_OUTPUTS) {
      drive('gateTarget', output, () => core.gateTarget(output));
      drive('gateElapsedFor', `${label}/${output}`, () => core.gateElapsedFor(clock, output));
    }
    drive('rosterRatesAt', label, () => invariant.rosterRatesAt(clock));
  }
  for (const tier of EMPIRE_TUNING.NPC_TIERS) {
    for (const seconds of SECONDS_DOMAIN.slice(0, 6)) {
      drive('createNpcLifter', `${tier}/${String(seconds)}`, () => lifterAt(tier, 0, seconds, seconds));
    }
    drive('recruitCost', tier, () => core.recruitCost(tier));
    drive('recruitReputationThreshold', tier, () => core.recruitReputationThreshold(tier));
    drive('recruitSeconds', tier, () => core.recruitSeconds(tier));
    drive('npcTierOutputMultiplier', tier, () => npcModule.npcTierOutputMultiplier(tier));
    drive('recruitmentQuote', tier, () => recruitmentModule.recruitmentQuote(tier));
    drive('npcTierUnlockKey', tier, () => reputationModule.npcTierUnlockKey(tier));
    for (const [label, clock] of CLOCK_SHAPES) {
      drive('recruitmentSchedule', `${tier}/${label}`, () => recruitmentModule.recruitmentSchedule(tier, clock));
    }
  }
  {
    const lifter = lifterAt('legendary', 0, 0, 0);
    for (const [label, clock] of CLOCKS) {
      drive('idleTenureDays', label, () => core.idleTenureDays(lifter, clock.accelerated));
      drive('settledTenureDays', label, () => core.settledTenureDays(lifter, clock.unaccelerated));
      drive('npcGymBucksPerHour', label, () => npcModule.npcGymBucksPerHour(lifter, clock));
      drive('npcTrainingIqPerDay', label, () => npcModule.npcTrainingIqPerDay(lifter, clock));
      drive('npcOutputRates', label, () => npcModule.npcOutputRates(lifter, clock));
      for (const size of ROSTER_SHAPES) {
        const roster = rosterOf(size, 0, 0);
        drive('rosterGymBucksPerHour', `${label}/${String(size)}`, () => npcModule.rosterGymBucksPerHour(roster, clock), [roster]);
        drive('rosterTrainingIqPerDay', `${label}/${String(size)}`, () => npcModule.rosterTrainingIqPerDay(roster, clock), [roster]);
        drive('rosterOutputRates', `${label}/${String(size)}`, () => npcModule.rosterOutputRates(roster, clock), [roster]);
      }
      drive('settledLoyaltyMultiplier', label, () =>
        npcModule.settledLoyaltyMultiplier(core.settledTenureDays(lifter, clock.unaccelerated)),
      );
    }
    for (const days of NUMBER_DOMAIN) {
      drive('idleLoyaltyMultiplier', String(days), () => npcModule.idleLoyaltyMultiplier(core.asIdleTenureDays(days)));
    }
  }
  for (const equipment of EMPIRE_TUNING.EQUIPMENT_TIERS) {
    drive('equipmentTierCost', equipment, () => core.equipmentTierCost(equipment));
    for (const spaceLevel of LEVEL_DOMAIN) {
      const axes = axesAt(equipment, spaceLevel, { coach: 0, spotter: 1, physio: 1 });
      drive('rosterCapacity', `${equipment}/${String(spaceLevel)}`, () => core.rosterCapacity(axes), [axes]);
      for (const axis of expansionModule.EXPANSION_AXES) {
        drive('axisLevel', `${equipment}/${axis}`, () => expansionModule.axisLevel(axes, axis), [axes]);
        drive('quoteExpansion', `${equipment}/${axis}`, () => expansionModule.quoteExpansion(axes, axis), [axes]);
      }
    }
  }
  for (const reputation of NUMBER_DOMAIN) {
    let points: core.ReputationPoints;
    try {
      points = core.asReputation(reputation);
    } catch {
      continue;
    }
    drive('reputationTierIndex', String(reputation), () => core.reputationTierIndex(points));
    drive('milestonesReached', String(reputation), () => reputationModule.milestonesReached(points));
    drive('nextMilestone', String(reputation), () => reputationModule.nextMilestone(points));
    drive('sponsorGymBucksPerDay', String(reputation), () => reputationModule.sponsorGymBucksPerDay(points));
  }
  drive('progressionLedger', 'full', () => core.progressionLedger(LEDGER), [LEDGER]);
  drive('idleLedger', 'full', () => core.idleLedger(LEDGER), [LEDGER]);
  drive('createEmpireState', 'zero-arg', () => core.createEmpireState());
  for (const [label, state] of STATES) {
    drive('empireStateFaults', label, () => core.empireStateFaults(state), [state]);
    drive('assertEmpireState', label, () => core.assertEmpireState(state), [state]);
    drive('composeTrainingIqRate', label, () => invariant.composeTrainingIqRate(state, state.clock), [state]);
    drive('expansionContext', label, () => expansionModule.expansionContext(state, BUILDS), [state]);
    drive('recruitmentBoard', label, () => recruitmentModule.recruitmentBoard(state), [state]);
    drive('npcTierUnlocks', label, () => reputationModule.npcTierUnlocks(state), [state]);
    drive('unlockedNpcTiers', label, () => reputationModule.unlockedNpcTiers(state), [state]);
    drive('topNpcTierUnlocked', label, () => reputationModule.topNpcTierUnlocked(state), [state]);
    drive('reputationRates', label, () => reputationModule.reputationRates(state, state.clock), [state]);
    for (const tier of EMPIRE_TUNING.NPC_TIERS) {
      drive('recruitmentRefusals', `${label}/${tier}`, () => recruitmentModule.recruitmentRefusals(state, tier), [state]);
      drive('mayRecruit', `${label}/${tier}`, () => recruitmentModule.mayRecruit(state, tier), [state]);
      drive('recruitmentOffer', `${label}/${tier}`, () => recruitmentModule.recruitmentOffer(state, tier), [state]);
      drive('beginRecruitment', `${label}/${tier}`, () => recruitmentModule.beginRecruitment(state, tier), [state]);
      const schedule = recruitmentModule.recruitmentSchedule(tier, state.clock);
      drive('completeRecruitment', `${label}/${tier}`, () =>
        recruitmentModule.completeRecruitment(state, schedule, SENTINELS.RECRUIT_ID, SENTINELS.RECRUIT_DISPLAY_NAME),
        [state, schedule, SENTINELS.RECRUIT_ID, SENTINELS.RECRUIT_DISPLAY_NAME],
      );
    }
    for (const [clockLabel, clock] of CLOCK_SHAPES) {
      const rates = invariant.rosterRatesAt(clock);
      drive('gymBucksRatePerHour', `${label}/${clockLabel}`, () => productionModule.gymBucksRatePerHour(state, clock, rates), [state, rates]);
      drive('trainingIqRatePerDay', `${label}/${clockLabel}`, () => productionModule.trainingIqRatePerDay(state, clock, rates), [state, rates]);
      drive('productionRates', `${label}/${clockLabel}`, () => productionModule.productionRates(state, clock, rates), [state, rates]);
      drive('accrueProduction', `${label}/${clockLabel}`, () => productionModule.accrueProduction(state, clock, rates), [state, rates]);
      drive('accrueSponsorship', `${label}/${clockLabel}`, () => reputationModule.accrueSponsorship(state, clock), [state]);
      for (const checkIns of NUMBER_DOMAIN) {
        drive('accrueReputation', `${label}/${clockLabel}/${String(checkIns)}`, () =>
          reputationModule.accrueReputation(state, clock, checkIns), [state],
        );
      }
    }
  }
  drive('empireStateFaults', 'faulted', () => core.empireStateFaults(FAULTED_STATE), [FAULTED_STATE]);
  drive('assertEmpireState', 'faulted', () => core.assertEmpireState(FAULTED_STATE), [FAULTED_STATE]);
  drive('offlineBankingHorizonSeconds', 'zero-arg', () => productionModule.offlineBankingHorizonSeconds());
  drive('settledGymBucksRatePerHour', 'zero-arg', () => productionModule.settledGymBucksRatePerHour());
  drive('reputationTierCount', 'zero-arg', () => reputationModule.reputationTierCount());
  drive('highestReputationTierIndex', 'zero-arg', () => reputationModule.highestReputationTierIndex());
  drive('reputationMilestones', 'zero-arg', () => reputationModule.reputationMilestones());
  drive('topNpcTier', 'zero-arg', () => reputationModule.topNpcTier());
  drive('reputationCensus', 'zero-arg', () => reputationModule.reputationCensus());
  drive('emptyEngagementTally', 'zero-arg', () => engagementModule.emptyEngagementTally());
  drive('shippedEngagementWiring', 'zero-arg', () => engagementModule.shippedEngagementWiring());
  drive('createEmpireGym', 'zero-arg', () => invariant.createEmpireGym());

  // --- expansion.ts
  for (const axis of expansionModule.EXPANSION_AXES) {
    drive('isStaffAxis', axis, () => expansionModule.isStaffAxis(axis));
    drive('axisOutput', axis, () => expansionModule.axisOutput(axis));
    drive('axisBook', axis, () => expansionModule.axisBook(axis));
    drive('axisClockFamily', axis, () => expansionModule.axisClockFamily(axis));
    drive('axisCeiling', axis, () => expansionModule.axisCeiling(axis));
    for (const level of NUMBER_DOMAIN) {
      const label = `${axis}/${String(level)}`;
      drive('axisLevelCost', label, () => expansionModule.axisLevelCost(axis, level));
      drive('axisReputationRule', label, () => expansionModule.axisReputationRule(axis, level));
      drive('axisReputationRequirement', label, () => expansionModule.axisReputationRequirement(axis, level));
      drive('axisBuildSeconds', label, () => expansionModule.axisBuildSeconds(axis, level));
    }
    for (const [label, context] of CONTEXTS) {
      drive('expansionVerdict', `${label}/${axis}`, () => expansionModule.expansionVerdict(context, axis), [context]);
      drive('startExpansion', `${label}/${axis}`, () => expansionModule.startExpansion(context, axis), [context]);
      drive('savingForPhysio', `${label}/${axis}`, () =>
        invariant.savingForPhysio(expansionModule.EXPANSION_AXES, context), [context],
      );
    }
    for (const seconds of SECONDS_DOMAIN) {
      drive('buildInFlight', `${axis}/${String(seconds)}`, () =>
        expansionModule.buildInFlight(BUILDS, axis, core.asAcceleratedSeconds(seconds)), [BUILDS],
      );
      drive('settledBuildInFlight', `${axis}/${String(seconds)}`, () =>
        expansionModule.settledBuildInFlight(BUILDS, axis, core.asUnacceleratedSeconds(seconds)), [BUILDS],
      );
      drive('settledAxisLevel', `${axis}/${String(seconds)}`, () =>
        expansionModule.settledAxisLevel(BUILDS, axis, core.asUnacceleratedSeconds(seconds)), [BUILDS],
      );
    }
  }
  for (const seconds of SECONDS_DOMAIN) {
    drive('idleAxesAt', String(seconds), () => expansionModule.idleAxesAt(BUILDS, core.asAcceleratedSeconds(seconds)), [BUILDS]);
    drive('settledAxesAt', String(seconds), () => expansionModule.settledAxesAt(BUILDS, core.asUnacceleratedSeconds(seconds)), [BUILDS]);
    drive('physioDaysSavedAt', String(seconds), () => expansionModule.physioDaysSavedAt(BUILDS, core.asUnacceleratedSeconds(seconds)), [BUILDS]);
  }
  for (const [label, context] of CONTEXTS) {
    for (const book of expansionModule.EMPIRE_BOOKS) {
      drive('bookBalance', `${label}/${book}`, () => expansionModule.bookBalance(context, book), [context]);
    }
  }
  for (const build of BUILDS) {
    for (const accelerant of core.PURCHASABLE_ACCELERANTS) {
      const applied = invariant.applyPurchasableGrant(
        accelerant,
        core.IDLE_ONLY_OUTPUTS[0] as core.IdleOnlyOutput,
        ZERO_SECONDS,
        EMPIRE_TUNING.TIMER_SKIP_SECONDS_PER_GRANT,
      );
      drive('skipExpansion', `${build.axis}/${accelerant}`, () => expansionModule.skipExpansion(build, applied), [build, applied]);
    }
  }
  for (const accelerant of core.PURCHASABLE_ACCELERANTS) {
    for (const output of core.IDLE_ONLY_OUTPUTS) {
      for (const seconds of NUMBER_DOMAIN) {
        drive('applyPurchasableGrant', `${accelerant}/${output}/${String(seconds)}`, () =>
          invariant.applyPurchasableGrant(accelerant, output, ZERO_SECONDS, seconds),
        );
      }
    }
  }

  // --- empireInvariant.ts, the loop
  for (const funding of invariant.EMPIRE_FUNDINGS) {
    drive('poolsWallClockBooks', funding, () => invariant.poolsWallClockBooks(funding));
  }
  for (const policy of invariant.EMPIRE_SPENDING_POLICIES) {
    for (const last of [false, true]) {
      const moment = invariant.spendingMoment(policy, last);
      drive('spendingMoment', `${policy}/${String(last)}`, () => invariant.spendingMoment(policy, last));
      drive('spendsAtMoment', `${policy}/${String(last)}`, () => invariant.spendsAtMoment(moment), [moment]);
      drive('rotatesAtMoment', `${policy}/${String(last)}`, () => invariant.rotatesAtMoment(moment), [moment]);
      for (const [label, context] of CONTEXTS) {
        for (const funding of invariant.EMPIRE_FUNDINGS) {
          drive('maySpendOnRoster', `${policy}/${label}/${funding}`, () =>
            invariant.maySpendOnRoster(moment, expansionModule.EXPANSION_AXES, context, funding), [context],
          );
          for (const book of expansionModule.EMPIRE_BOOKS) {
            drive('axisSpendingOrder', `${policy}/${label}/${funding}/${book}`, () =>
              invariant.axisSpendingOrder(moment, expansionModule.EXPANSION_AXES, 0, book, context, funding), [context],
            );
          }
        }
      }
    }
  }
  for (const accelerant of core.PURCHASABLE_ACCELERANTS) {
    for (const grants of NUMBER_DOMAIN) {
      const plan = planAt(accelerant, grants);
      for (const checkIn of NUMBER_DOMAIN) {
        drive('grantSecondsAt', `${accelerant}/${String(grants)}/${String(checkIn)}`, () =>
          invariant.grantSecondsAt(plan, checkIn), [plan],
        );
      }
    }
  }
  {
    // The gym, stepped rather than only constructed: `pending[].id` and the
    // roster's display names are minted INSIDE the loop, so a driver that only
    // read `createEmpireGym()` would sample two frozen empty arrays.
    let gym: EmpireGym = invariant.createEmpireGym();
    drive('gymSnapshot', 'opening', () => invariant.gymSnapshot(gym), [gym]);
    const stepSeconds = EMPIRE_TUNING.SECONDS_PER_DAY / EMPIRE_SWEEP_CHECK_INS_PER_DAY;
    for (let step = 0; step < STEP_COUNT; step += 1) {
      const accelerant = step % 3 === 0 ? (core.PURCHASABLE_ACCELERANTS[0] as core.PurchasableAccelerant) : null;
      const grantSeconds = accelerant === null ? 0 : EMPIRE_TUNING.TIMER_SKIP_SECONDS_PER_GRANT;
      const before = gym;
      drive('stepGym', `step=${String(step)}`, () => {
        gym = invariant.stepGym(before, policyAt(EMPIRE_SWEEP_CHECK_INS_PER_DAY), stepSeconds, accelerant, grantSeconds);
        return gym;
      }, [before]);
      drive('gymSnapshot', `step=${String(step)}`, () => invariant.gymSnapshot(gym), [gym]);
      drive('gymProgressionEntries', `step=${String(step)}`, () =>
        invariant.gymProgressionEntries(gym, step, core.asUnacceleratedSeconds(step * stepSeconds)), [gym],
      );
    }
  }
  for (const days of DAY_DOMAIN) {
    for (const funding of invariant.EMPIRE_FUNDINGS) {
      for (const accelerant of [null, core.PURCHASABLE_ACCELERANTS[0] as core.PurchasableAccelerant]) {
        const plan = planAt(accelerant, accelerant === null ? 0 : 1);
        const social = socialInputsAt();
        const policy = policyAt(EMPIRE_SWEEP_CHECK_INS_PER_DAY);
        const label = `${String(days)}/${funding}/${String(accelerant)}`;
        let run: invariant.EmpireRun | null = null;
        drive('runEmpire', label, () => {
          run = invariant.runEmpire(days, policy, plan, social, funding);
          return run;
        }, [policy, plan, social]);
        if (run !== null) {
          const settled: invariant.EmpireRun = run;
          drive('empireRunFaults', label, () => invariant.empireRunFaults(settled), [settled]);
          drive('progressionDayLedger', label, () => invariant.progressionDayLedger(settled.ledger));
          drive('idleDayLedger', label, () => invariant.idleDayLedger(settled.ledger));
          for (const output of core.EMPIRE_OUTPUTS) {
            drive('outputSeries', `${label}/${output}`, () => invariant.outputSeries(settled.ledger, output));
            drive('arrivalDays', `${label}/${output}`, () => invariant.arrivalDays(settled.ledger, output));
            drive('amountSeries', `${label}/${output}`, () => engagementModule.amountSeries(settled.ledger, output));
          }
          drive('compareLedgers', label, () => invariant.compareLedgers(DAY_LEDGER, settled.ledger), [DAY_LEDGER]);
          drive('compareDayLists', label, () =>
            invariant.compareDayLists(
              invariant.arrivalDays(DAY_LEDGER, core.EMPIRE_OUTPUTS[0]),
              invariant.arrivalDays(settled.ledger, core.EMPIRE_OUTPUTS[0]),
            ),
          );
        }
      }
    }
  }
  drive('empireRunFaults', 'faulted', () => invariant.empireRunFaults(faultedRun()), [faultedRun()]);

  // --- engagement.ts
  for (const key of engagementModule.ENGAGEMENT_WIRINGS) {
    drive('chargesUpkeep', key, () => engagementModule.chargesUpkeep(key));
    drive('wiringFunding', key, () => engagementModule.wiringFunding(key));
    for (const upkeep of NUMBER_DOMAIN) {
      drive('engagementWiring', `${key}/${String(upkeep)}`, () => engagementModule.engagementWiring(key, upkeep));
    }
  }
  for (const slots of COUNT_DOMAIN) {
    for (const everyNth of [1, 2]) {
      const label = `${String(slots)}/${String(everyNth)}`;
      // Driven at every point including the ones that refuse, so the RangeError
      // payload is scanned like any other value. The rows below need a real
      // history, so a refused point stops after the throw has been kept.
      drive('historyFrom', label, () => historyAt(slots, everyNth));
      if (slots < 1) continue;
      const history = historyAt(slots, everyNth);
      drive('checkInCount', label, () => engagementModule.checkInCount(history), [history]);
      drive('moreEngagedBy', label, () => engagementModule.moreEngagedBy(history, 0), [history]);
      drive('moreEngagedByTrainedDay', label, () => engagementModule.moreEngagedByTrainedDay(history, 0), [history]);
      drive('slotWallSeconds', label, () => engagementModule.slotWallSeconds(slots, EMPIRE_SWEEP_CHECK_INS_PER_DAY));
    }
  }
  {
    let tally = engagementModule.emptyEngagementTally();
    for (const spending of invariant.EMPIRE_SPENDING_POLICIES) {
      for (const key of engagementModule.ENGAGEMENT_WIRINGS) {
        const days = RUN_HORIZON_DAYS;
        const slots = days * EMPIRE_SWEEP_CHECK_INS_PER_DAY;
        const history = historyAt(slots, 1);
        // The upkeep argument is what the wiring itself admits: a wiring that
        // charges none refuses a non-zero one, and vice versa.
        const wiring = engagementModule.engagementWiring(
          key,
          engagementModule.chargesUpkeep(key) ? EMPIRE_TUNING.ENCOURAGEMENT_REWARD_GYM_BUCKS : 0,
        );
        const policy = policyAt(EMPIRE_SWEEP_CHECK_INS_PER_DAY);
        const social = socialInputsAt();
        const label = `${spending}/${key}`;
        let run: engagementModule.EngagementRun | null = null;
        drive('runEngagement', label, () => {
          run = engagementModule.runEngagement(days, policy, history, social, wiring, spending);
          return run;
        }, [policy, history, social, wiring]);
        if (run !== null) {
          const settled: engagementModule.EngagementRun = run;
          drive('engagementRunFaults', label, () => engagementModule.engagementRunFaults(settled), [settled]);
          const other = engagementModule.runEngagement(
            days,
            policy,
            engagementModule.moreEngagedByTrainedDay(history, 0),
            social,
            wiring,
            spending,
          );
          const divergence = engagementModule.compareEngagement(settled, other);
          drive('compareEngagement', label, () => engagementModule.compareEngagement(settled, other), [settled, other]);
          const carried = tally;
          drive('addEngagement', label, () => {
            tally = engagementModule.addEngagement(carried, divergence);
            return tally;
          }, [carried, divergence]);
        }
      }
    }
  }
  drive('engagementRunFaults', 'faulted', () =>
    engagementModule.engagementRunFaults(faultedEngagementRun()), [faultedEngagementRun()],
  );

  // --- social.ts
  for (const payout of reputationModule.REPUTATION_PAYOUTS) {
    drive('reputationPayoutOutput', payout, () => reputationModule.reputationPayoutOutput(payout));
    drive('reputationPayoutReach', payout, () => reputationModule.reputationPayoutReach(payout));
  }
  for (const surface of socialModule.SOCIAL_SURFACES) {
    drive('socialOutput', surface, () => socialModule.socialOutput(surface));
    drive('socialReach', surface, () => socialModule.socialReach(surface));
  }
  for (const scope of EMPIRE_TUNING.LEADERBOARD_SCOPES) {
    drive('leaderboardBracketSize', scope, () => socialModule.leaderboardBracketSize(scope));
    for (const metric of socialModule.LEADERBOARD_METRICS) {
      const entries = Object.freeze([OWN_GYM, ...FRIENDS, RIVAL_GYM]);
      drive('rankLeaderboard', `${scope}/${metric}`, () => socialModule.rankLeaderboard(entries, metric, scope), [entries]);
      const rows = socialModule.rankLeaderboard(entries, metric, scope);
      drive('leaderboardRankOf', `${scope}/${metric}`, () => socialModule.leaderboardRankOf(rows, SENTINELS.OWN_GYM_ID), [rows]);
      for (const entry of entries) {
        drive('leaderboardScore', `${metric}/${entry.gymId}`, () => socialModule.leaderboardScore(entry, metric), [entry]);
      }
      drive('compareWithRival', `${scope}/${metric}`, () =>
        socialModule.compareWithRival(
          OWN_GYM,
          RIVAL_GYM,
          metric,
          socialModule.asCalendarDay(CALENDAR_ANCHOR),
          socialModule.asCalendarDay(EMPIRE_TUNING.RIVAL_COMPARISON_PERIOD_DAYS),
        ),
      );
    }
  }
  for (const day of DAY_DOMAIN) {
    const calendarDay = socialModule.asCalendarDay(day);
    const context = socialContextAt([0, 1, day]);
    const label = String(day);
    drive('visitsUsedOn', label, () => socialModule.visitsUsedOn(context.visits, calendarDay), [context]);
    drive('visitsLeftOn', label, () => socialModule.visitsLeftOn(context.visits, calendarDay), [context]);
    drive('socialContextFaults', label, () => socialModule.socialContextFaults(context), [context]);
    drive('encouragementGymBucksOn', label, () =>
      socialModule.encouragementGymBucksOn(context.encouragementsReceived, calendarDay), [context],
    );
    // `friend-1` is here because of a measured hole, and it is the reason the
    // domain fix alone was not enough. `socialContextAt([0, 1, day])` puts a
    // visit to `friend-0` on the day being driven, so `visitRefusals` returned
    // 'already-visited-today' for it, 'own-gym' for the player and
    // 'not-a-friend-gym' for the third — and `recordFriendVisit`'s VISITED arm
    // was never produced at any point of any domain. The bypass this round is
    // about plants its name inside that arm, so widening the day domain to
    // contain day 7 left it green: the branch was unreachable for a reason that
    // had nothing to do with numbers. 'produced every arm of every
    // discriminated return' is the check that says so.
    for (const gymId of [
      `${SENTINELS.FRIEND_GYM_ID}-0`,
      `${SENTINELS.FRIEND_GYM_ID}-1`,
      SENTINELS.OWN_GYM_ID,
      SENTINELS.FAULT_VISIT_GYM_ID,
    ]) {
      drive('visitRefusals', `${label}/${gymId}`, () => socialModule.visitRefusals(context, gymId, calendarDay), [context, gymId]);
      drive('mayVisitFriendGym', `${label}/${gymId}`, () => socialModule.mayVisitFriendGym(context, gymId, calendarDay), [context, gymId]);
      for (const encourage of [false, true]) {
        drive('recordFriendVisit', `${label}/${gymId}/${String(encourage)}`, () =>
          socialModule.recordFriendVisit(context, gymId, calendarDay, encourage), [context, gymId],
        );
      }
    }
    drive('rivalPeriodIndex', label, () =>
      socialModule.rivalPeriodIndex(socialModule.asCalendarDay(CALENDAR_ANCHOR), calendarDay),
    );
    drive('rivalPeriodStartDay', label, () =>
      socialModule.rivalPeriodStartDay(socialModule.asCalendarDay(CALENDAR_ANCHOR), day),
    );
    drive('rivalPeriodCloseDay', label, () =>
      socialModule.rivalPeriodCloseDay(socialModule.asCalendarDay(CALENDAR_ANCHOR), day),
    );
    drive('rivalPeriodCloseDays', label, () =>
      socialModule.rivalPeriodCloseDays(socialModule.asCalendarDay(CALENDAR_ANCHOR), day),
    );
    drive('socialRewardSchedule', label, () => socialModule.socialRewardSchedule(calendarAt(CALENDAR_ANCHOR), day));
  }
  drive('socialContextFaults', 'faulted', () => socialModule.socialContextFaults(FAULTED_SOCIAL_CONTEXT), [FAULTED_SOCIAL_CONTEXT]);

  return DRIVEN_ROWS;
}

// ---------------------------------------------------------------------------
// The tripwire — the non-zero number the zeros below are zero against
// ---------------------------------------------------------------------------

/**
 * A synthetic value carrying one banned name per attack shape the scanner
 * claims to reach.
 *
 * This is the house standard of proof, taken from `src/game/streakSweep.ts`:
 * counts pinned at zero, with the unfixed variant's non-zero numbers kept in
 * the file as the thing the zeros are zero against. A scan reporting zero
 * banned names is exactly what a scan reporting nothing at all reports, and the
 * two are indistinguishable in a green suite.
 *
 * Every name here is read out of `EMPIRE_FORBIDDEN_OUTPUTS` and
 * `FORBIDDEN_UNLOCK_KEYS` rather than typed, so a name added to either is
 * tripwired without this function being edited.
 *
 * `TRIPWIRE_SHAPES` names each shape and `benignTwin` builds the identical
 * structure with a harmless string in every slot. The twin measuring zero is
 * what says the tripwire's count is about the NAMES and not about the shape.
 */
const TRIPWIRE_SHAPES: readonly string[] = Object.freeze([
  'a plain property value',
  'nested five deep through arrays and objects',
  'a computed property KEY',
  'a non-enumerable accessor, invoked',
  'a Map key',
  'a Map value',
  'a Set member',
  'an own property on a thrown Error',
  'a frozen structure',
  'a symbol description',
  'a Proxy whose ownKeys trap is honest',
  'the case fold: COVERED-DAY',
  'the separator fold: a doubled hyphen',
  'the separator fold: a space',
  'the separator fold: a non-breaking hyphen',
  'the trim fold: surrounding whitespace',
]);

function tripwireSubject(name: string, other: string): unknown {
  const target: Record<string, unknown> = {};
  Object.defineProperty(target, 'hidden', { enumerable: false, get: () => name });
  const thrown = new RangeError('a refusal that carries a payload');
  Object.defineProperty(thrown, 'output', { enumerable: true, value: name });
  return [
    Object.freeze({ kind: name }),
    Object.freeze({ a: Object.freeze({ b: Object.freeze([Object.freeze({ c: Object.freeze([name]) })]) }) }),
    Object.freeze({ [name]: 1 }),
    target,
    new Map<unknown, unknown>([
      [name, 1],
      ['key', name],
    ]),
    new Set<unknown>([name]),
    thrown,
    Object.freeze(Object.freeze({ frozen: Object.freeze([Object.freeze({ deep: name })]) })),
    Object.freeze({ [Symbol(name)]: 1 }),
    new Proxy(Object.freeze({ proxied: other }), {}),
    Object.freeze({ shouted: name.toUpperCase() }),
    Object.freeze({ doubled: name.replace('-', '--') }),
    Object.freeze({ spaced: name.replace('-', ' ') }),
    Object.freeze({ nonBreaking: name.replace('-', '‑') }),
    Object.freeze({ padded: `  ${name}  ` }),
  ];
}

/** The same structure with a harmless string in every slot. */
const BENIGN_TWIN = tripwireSubject(SENTINELS.NPC_ID, SENTINELS.OWN_GYM_ID);

const TRIPWIRE_CENSUS = Object.freeze({
  /** Distinct banned-name-equal strings the walker found in the loaded subject. */
  HITS: 16,
  /** The same walk over the benign twin. */
  BENIGN_HITS: 0,
  /** Accessors invoked. Non-zero here and zero on the real drive. */
  GETTERS_INVOKED: 1,
  PROXIES_SEEN: 1,
  SHAPES: 16,
});

// ---------------------------------------------------------------------------
// The measurement
// ---------------------------------------------------------------------------

/** Where a scanned string sat: the call's RETURN (or throw), or a re-read argument. */
type Region = 'return' | 'argument';

interface Found {
  readonly export: string;
  readonly region: Region;
  readonly found: ScannedString;
}

interface DriveMeasurement {
  readonly rows: number;
  readonly exports: readonly string[];
  readonly strings: readonly Found[];
  readonly nodes: number;
  readonly depthCuts: number;
  readonly gettersInvoked: number;
  readonly getterThrows: number;
  readonly proxies: number;
}

let measurementMemo: DriveMeasurement | null = null;

function measureDrive(): DriveMeasurement {
  if (measurementMemo !== null) return measurementMemo;
  const rows = driveEverything();
  const strings: Found[] = [];
  let nodes = 0;
  let depthCuts = 0;
  let gettersInvoked = 0;
  let getterThrows = 0;
  let proxies = 0;
  for (const row of rows) {
    // The return and the re-read arguments are scanned separately, because a
    // string that came back OUT is a different claim from one that was handed
    // IN and is still there. Both are checked; only the first is what a
    // diagnostic channel's contents mean.
    const label = `${row.export}@${row.point}`;
    const regions: readonly (readonly [Region, unknown])[] = [
      ['return', row.values[0]],
      ['argument', row.values.slice(1)],
    ];
    for (const [region, value] of regions) {
      const scan = deepScan(value, `${label}#${region}`);
      nodes += scan.nodes;
      depthCuts += scan.depthCuts;
      gettersInvoked += scan.gettersInvoked;
      getterThrows += scan.getterThrows;
      proxies += scan.proxies;
      for (const found of scan.strings) strings.push({ export: row.export, region, found });
    }
  }
  measurementMemo = {
    rows: rows.length,
    exports: distinct(rows.map((row) => row.export)),
    strings: Object.freeze(strings),
    nodes,
    depthCuts,
    gettersInvoked,
    getterThrows,
    proxies,
  };
  return measurementMemo;
}

const DRIVE_CENSUS = Object.freeze({
  ROWS: 53162,
  EXPORTS_DRIVEN: 226,
  NODES: 338409,
  STRINGS: 1404775,
  DISTINCT_STRINGS: 1034,
  DEPTH_CUTS: 0,
  /**
   * Accessors invoked across the whole drive, and PROXIES seen.
   *
   * Both zero, and both pinned rather than omitted: this directory constructs
   * neither, so the two branches of the walker that exist for attack shape 9
   * are exercised by the tripwire and by nothing in the subject. A non-zero
   * number here means one arrived, which is worth a look on its own.
   */
  GETTERS_INVOKED: 0,
  PROXIES: 0,
  /** Banned-name-equal strings, and every one of them from a ban-list export. */
  BANNED_EQUAL: 7,
  BANNED_EQUAL_OUTSIDE_THE_BAN_LISTS: 0,
  BANNED_CONTAINED_OUTSIDE_THE_BAN_LISTS: 0,
  /**
   * How many strings the diagnostic-channel exemption actually excluded.
   *
   * ZERO, on this tree, and that is worth stating plainly rather than letting
   * the exemption read as load-bearing: no fault message produced under this
   * drive contains a banned name, because no banned name is ever passed in.
   * The exemption is therefore declared, measured, and currently excluding
   * nothing — and if it ever starts excluding something, this number moves.
   */
  EXCLUDED_BY_THE_DIAGNOSTIC_EXEMPTION: 0,
});

// ---------------------------------------------------------------------------
// The injected axes, and the disagreement between their points
// ---------------------------------------------------------------------------

/**
 * A stable digest of every string and number a value reaches, in visit order.
 *
 * Used only to answer "did varying this axis change anything at all". CLAUDE.md
 * is explicit that richness on one axis is not evidence about an axis nobody
 * varied: these functions take injected clocks, policies, fundings and wirings,
 * and a sweep that holds one of those fixed has ONE POINT on it however many
 * points it has elsewhere. So each axis is varied on its own, the number of
 * points that disagree with the first is counted, and a control that holds the
 * axis fixed is measured beside it at zero.
 */
function fingerprint(value: unknown): string {
  const { trace } = deepScan(value, 'fp');
  let hash = 2166136261;
  for (const item of trace) {
    for (let index = 0; index < item.length; index += 1) {
      hash ^= item.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
  }
  return `${String(trace.length)}:${(hash >>> 0).toString(16)}`;
}

interface AxisReading {
  readonly axis: string;
  readonly points: number;
  /** Points whose fingerprint differs from the first point's. */
  readonly disagreements: number;
}

function disagreementsAmong(prints: readonly string[]): number {
  const first = prints[0];
  return prints.filter((print) => print !== first).length;
}

function readingFor(axis: string, prints: readonly string[]): AxisReading {
  return { axis, points: prints.length, disagreements: disagreementsAmong(prints) };
}

let axisMemo: readonly AxisReading[] | null = null;

function axisReadings(): readonly AxisReading[] {
  if (axisMemo !== null) return axisMemo;
  const policy = policyAt(EMPIRE_SWEEP_CHECK_INS_PER_DAY);
  const social = socialInputsAt();
  const days = RUN_HORIZON_DAYS;
  const slots = days * EMPIRE_SWEEP_CHECK_INS_PER_DAY;
  const history = historyAt(slots, 1);
  const readings: AxisReading[] = [
    readingFor(
      'runEmpire / funding',
      invariant.EMPIRE_FUNDINGS.map((funding) =>
        fingerprint(invariant.runEmpire(days, policy, planAt(null, 0), social, funding)),
      ),
    ),
    readingFor(
      'runEmpire / funding held fixed (control)',
      invariant.EMPIRE_FUNDINGS.map(() =>
        fingerprint(invariant.runEmpire(days, policy, planAt(null, 0), social, invariant.SHIPPED_FUNDING)),
      ),
    ),
    readingFor(
      'runEmpire / accelerant plan',
      [null, ...core.PURCHASABLE_ACCELERANTS].map((accelerant) =>
        fingerprint(
          invariant.runEmpire(
            days,
            policy,
            planAt(accelerant, accelerant === null ? 0 : 1),
            social,
          ),
        ),
      ),
    ),
    readingFor(
      'runEngagement / spending policy',
      invariant.EMPIRE_SPENDING_POLICIES.map((spending) =>
        fingerprint(
          engagementModule.runEngagement(
            days,
            policy,
            history,
            social,
            engagementModule.shippedEngagementWiring(),
            spending,
          ),
        ),
      ),
    ),
    readingFor(
      'runEngagement / spending policy held fixed (control)',
      invariant.EMPIRE_SPENDING_POLICIES.map(() =>
        fingerprint(
          engagementModule.runEngagement(
            days,
            policy,
            history,
            social,
            engagementModule.shippedEngagementWiring(),
            invariant.SHIPPED_SPENDING_POLICY,
          ),
        ),
      ),
    ),
    readingFor(
      'runEngagement / wiring',
      engagementModule.ENGAGEMENT_WIRINGS.map((key) =>
        fingerprint(
          engagementModule.runEngagement(
            days,
            policy,
            history,
            social,
            engagementModule.engagementWiring(
              key,
              engagementModule.chargesUpkeep(key) ? EMPIRE_TUNING.ENCOURAGEMENT_REWARD_GYM_BUCKS : 0,
            ),
          ),
        ),
      ),
    ),
    readingFor(
      'accrueProduction / clock shape',
      COLLECTION_CLOCKS.map(([, clock]) =>
        fingerprint(
          productionModule.accrueProduction(
            STATES[STATES.length - 1]?.[1] as EmpireState,
            clock,
            invariant.rosterRatesAt(clock),
          ),
        ),
      ),
    ),
    readingFor(
      'accrueProduction / clock held fixed (control)',
      COLLECTION_CLOCKS.map(() =>
        fingerprint(
          productionModule.accrueProduction(
            STATES[STATES.length - 1]?.[1] as EmpireState,
            COLLECTION_CLOCKS[0]?.[1] as EmpireClock,
            invariant.rosterRatesAt(COLLECTION_CLOCKS[0]?.[1] as EmpireClock),
          ),
        ),
      ),
    ),
    readingFor(
      'productionRates / gym state shape',
      STATES.map(([, state]) =>
        fingerprint(
          productionModule.productionRates(
            state,
            COLLECTION_CLOCKS[2]?.[1] as EmpireClock,
            invariant.rosterRatesAt(COLLECTION_CLOCKS[2]?.[1] as EmpireClock),
          ),
        ),
      ),
    ),
  ];
  axisMemo = Object.freeze(readings);
  return axisMemo;
}

/**
 * What each injected axis was measured to move.
 *
 * A zero on a NON-control row means the axis is inert under this driver, so
 * every other point in the sweep is one point on it. That is the failure this
 * table exists to make visible, and it is the reason these are counts rather
 * than a `toBeGreaterThan(0)`.
 */
const AXIS_CENSUS: readonly (readonly [string, number, number])[] = Object.freeze([
  ['runEmpire / funding', 3, 2],
  ['runEmpire / funding held fixed (control)', 3, 0],
  ['runEmpire / accelerant plan', 3, 2],
  ['runEngagement / spending policy', 6, 5],
  ['runEngagement / spending policy held fixed (control)', 6, 0],
  ['runEngagement / wiring', 5, 4],
  ['accrueProduction / clock shape', 3, 2],
  ['accrueProduction / clock held fixed (control)', 3, 0],
  // Twenty rather than twenty-four, and the gap is the finding rather than a
  // shortfall: reputation is one of the two axes `STATES` crosses and
  // production rates do not read it, so the four other reputations at an empty
  // roster fingerprint identically to the first point. Roster size is what
  // moves this, and it moves it twenty times out of twenty-five.
  ['productionRates / gym state shape', 25, 20],
]);

/**
 * What each of the eight fault functions actually produced under the drive.
 *
 * Four of them take no argument and check frozen vocabulary tables, so their
 * string domain is EMPTY on a healthy tree and cannot be made non-empty from a
 * test file. Those four are absent from this table, which is the honest way to
 * say the behavioural half covers them not at all — instrument A's
 * literal-member pass is what covers their subject.
 */
const DIAGNOSTIC_CHANNEL_CENSUS: readonly (readonly [string, number])[] = Object.freeze([
  ['empireRunFaults', 3],
  ['empireStateFaults', 7],
  ['engagementRunFaults', 1],
  ['socialContextFaults', 1],
]);

/**
 * Every arm of every discriminated return the drive actually PRODUCED, by count.
 *
 * This exists because of a hole the numeric-domain fix could not close, and the
 * distinction is the whole reason it is a separate check. A domain decides
 * which NUMBERS an axis is driven at. It says nothing about whether the
 * subject's own guards let the interesting branch run at all — and here they
 * did not: every gym the social loop offered `recordFriendVisit` was refused on
 * every day, so the VISITED arm was produced zero times, at every point of
 * every domain this file has ever had. Instrument A knew the arm existed the
 * whole time; it is a literal member of the return's `kind`.
 *
 * So the check below is a set equality between the arms instrument A DECLARES
 * and the arms instrument B REACHED, discovered from the type rather than
 * listed — and the counts are pinned beside it so an arm that survives on one
 * lucky point reports how thin it is.
 *
 * Its limit, and the named catcher for it: this only sees a union discriminated
 * by a property literally called `kind`. A return that branches on the presence
 * of a field, on an empty array, or on a discriminant with another name is
 * invisible here, and what covers those is `SENTINELS_OBSERVED` for the
 * caller-supplied positions and nothing at all for the rest. That is the honest
 * state of it; the four arms below are the whole population this instrument has.
 */
const KINDED_RETURN_CENSUS: readonly (readonly [string, number])[] = Object.freeze([
  ['beginRecruitment#accepted', 27],
  ['beginRecruitment#refused', 98],
  ['recordFriendVisit#refused', 80],
  ['recordFriendVisit#visited', 24],
]);

/**
 * The two strings the composed loop mints for its own snapshot.
 *
 * Pinned by content because `gymSnapshot`'s two bare-string positions carry
 * module-private constants rather than caller text, so no sentinel can reach
 * them. Content is the same guarantee by a different route.
 */
const GYM_SNAPSHOT_STRINGS: readonly string[] = Object.freeze(['Placeholder', 'composed-gym']);

describe('instrument B — nothing this directory produces is a forbidden name', () => {
  it('drives every export the census knows about, in both directions', () => {
    const census = distinct(stringSurface().exports.map((key) => key.split('#')[1] as string));
    const driven = measureDrive().exports;
    // Set equality. A new export is an undriven member and reddens here until
    // somebody writes a row for it — which is the ONLY thing that fires on
    // attack shape 16, and is a demand for a reviewer rather than a detection.
    expect(driven).toEqual(census);
    expect(driven.length).toBe(DRIVE_CENSUS.EXPORTS_DRIVEN);
    expect(census.length).toBe(SURFACE_CENSUS.EXPORTS);
  });

  it('walked a domain that is not empty, and did not truncate', () => {
    const measurement = measureDrive();
    expect(measurement.rows).toBe(DRIVE_CENSUS.ROWS);
    expect(measurement.nodes).toBe(DRIVE_CENSUS.NODES);
    expect(measurement.strings.length).toBe(DRIVE_CENSUS.STRINGS);
    expect(distinct(measurement.strings.map((entry) => entry.found.value)).length).toBe(
      DRIVE_CENSUS.DISTINCT_STRINGS,
    );
    // A truncated walk reports a clean scan, which is the reassuring direction.
    expect(measurement.depthCuts).toBe(DRIVE_CENSUS.DEPTH_CUTS);
    expect(measurement.gettersInvoked).toBe(DRIVE_CENSUS.GETTERS_INVOKED);
    expect(measurement.proxies).toBe(DRIVE_CENSUS.PROXIES);
    expect(measurement.getterThrows).toBe(0);
  });

  it('reached every caller-supplied string position, by sentinel', () => {
    const values = new Set(measureDrive().strings.map((entry) => entry.found.value));
    const reached = Object.entries(SENTINELS)
      .filter(([, sentinel]) => [...values].some((value) => value.includes(sentinel)))
      .map(([name]) => name)
      .sort();
    // Set equality both ways. Every one of instrument A's five bare-string
    // fields is EMPTY on the obvious fixture, so this is the assertion that
    // says the domain is non-empty where it matters rather than merely large.
    expect(reached).toEqual([...Object.keys(SENTINELS)].sort());
  });

  it('produces no banned name from any export but the two that ARE the ban lists', () => {
    const measurement = measureDrive();
    const banned = measurement.strings.filter((entry) => BANNED_NORMALISED.has(normalise(entry.found.value)));
    expect(banned.length).toBe(DRIVE_CENSUS.BANNED_EQUAL);

    const offenders = banned
      .filter((entry) => !BAN_LIST_EXPORTS.includes(entry.export))
      .map((entry) => `${entry.export}${entry.found.path}=${entry.found.value}`);
    // THE ZERO THIS WHOLE FILE IS ABOUT. The tripwire below is the non-zero
    // number it is zero against.
    expect(distinct(offenders)).toEqual([]);
    expect(offenders.length).toBe(DRIVE_CENSUS.BANNED_EQUAL_OUTSIDE_THE_BAN_LISTS);

    // The exempted pair is pinned by content and by count, not skipped.
    expect(
      distinct(banned.map((entry) => `${entry.export}=${entry.found.value}`)),
    ).toEqual([
      'EMPIRE_FORBIDDEN_OUTPUTS=chalk',
      'EMPIRE_FORBIDDEN_OUTPUTS=competition-total',
      'EMPIRE_FORBIDDEN_OUTPUTS=covered-day',
      'EMPIRE_FORBIDDEN_OUTPUTS=e1rm',
      'FORBIDDEN_UNLOCK_KEYS=chance-draw',
      'FORBIDDEN_UNLOCK_KEYS=currency-purchase',
      'FORBIDDEN_UNLOCK_KEYS=paid-pull',
    ]);
  });

  it('CONTAINS no banned name either, outside the diagnostic channel, and the exemption is measured', () => {
    const measurement = measureDrive();
    const contained = measurement.strings.filter((entry) =>
      BANNED_VOCABULARY.some((name) => normalise(entry.found.value).includes(normalise(name))),
    );
    const exempted = contained.filter((entry) => DIAGNOSTIC_CHANNEL_EXPORTS.includes(entry.export));
    const offenders = contained
      .filter((entry) => !BAN_LIST_EXPORTS.includes(entry.export))
      .filter((entry) => !DIAGNOSTIC_CHANNEL_EXPORTS.includes(entry.export))
      .map((entry) => `${entry.export}${entry.found.path}=${entry.found.value}`);
    expect(distinct(offenders)).toEqual([]);
    expect(offenders.length).toBe(DRIVE_CENSUS.BANNED_CONTAINED_OUTSIDE_THE_BAN_LISTS);
    // The exemption's own size. Attack shape 19 hides in whatever the exemption
    // turns out to be, so the exemption is a number rather than a silence.
    expect(exempted.length).toBe(DRIVE_CENSUS.EXCLUDED_BY_THE_DIAGNOSTIC_EXEMPTION);
  });

  it('pins what the diagnostic channel actually said, rather than passing over it', () => {
    const byExport = new Map<string, number>();
    for (const entry of measureDrive().strings) {
      if (entry.region !== 'return') continue;
      if (!DIAGNOSTIC_CHANNEL_EXPORTS.includes(entry.export)) continue;
      if (entry.found.viaKey) continue;
      byExport.set(entry.export, (byExport.get(entry.export) ?? 0) + 1);
    }
    // Four of the eight are zero-argument vocabulary checks over frozen tables,
    // so their string domain is EMPTY on a healthy tree and cannot be made
    // non-empty without editing a shipped module. That is stated as a number,
    // not hidden: those four are checked by instrument A's literal-member pass
    // and by nothing here.
    expect([...byExport.entries()].sort()).toEqual(DIAGNOSTIC_CHANNEL_CENSUS);
  });

  it('produced every arm of every discriminated return, and not merely some of them', () => {
    // Declared by instrument A, reached by instrument B, compared in both
    // directions. An arm the type has and the drive never produced is a branch
    // no point of any domain can reach, which is a domain that is empty where
    // it matters no matter how many points it has.
    const declared = distinct(
      stringSurface()
        .positions.filter((position) => position.kind === 'literal')
        .filter((position) => positionKey(position).endsWith('#return.kind'))
        .flatMap((position) => position.members.map((member) => `${position.export}#${member}`)),
    );
    const arms = new Map<string, number>();
    for (const row of driveEverything()) {
      const returned = row.values[0];
      if (typeof returned !== 'object' || returned === null) continue;
      const kind = (returned as { readonly kind?: unknown }).kind;
      if (typeof kind !== 'string') continue;
      const at = `${row.export}#${kind}`;
      arms.set(at, (arms.get(at) ?? 0) + 1);
    }
    expect([...arms.keys()].sort()).toEqual([...declared]);
    expect([...arms.entries()].sort()).toEqual(KINDED_RETURN_CENSUS);
  });

  it('pins the two strings the composed loop mints for itself', () => {
    // `gymSnapshot` returns module-private constants rather than caller text,
    // so its two bare-string positions carry no sentinel. They are pinned by
    // content instead, which is the same guarantee by a different route.
    const measurement = measureDrive();
    const fromSnapshot = distinct(
      measurement.strings
        .filter((entry) => entry.export === 'gymSnapshot' && entry.region === 'return')
        .filter((entry) => !entry.found.viaKey)
        .map((entry) => entry.found.value),
    );
    expect(fromSnapshot).toEqual(GYM_SNAPSHOT_STRINGS);
  });
});

describe('instrument B bites — the tripwire the zeros are zero against', () => {
  it('finds a banned name in every shape the scanner claims to reach', () => {
    const loaded = deepScan(
      tripwireSubject(core.EMPIRE_FORBIDDEN_OUTPUTS[0], reputationModule.FORBIDDEN_UNLOCK_KEYS[0]),
      'tripwire',
    );
    const hits = loaded.strings.filter((found) => BANNED_NORMALISED.has(normalise(found.value)));
    expect(hits.length).toBe(TRIPWIRE_CENSUS.HITS);
    // Sixteen hits at sixteen distinct paths, one per declared shape. Without
    // this the count could be sixteen because one shape fired sixteen times.
    expect(distinct(hits.map((found) => found.path)).length).toBe(TRIPWIRE_CENSUS.HITS);
    expect(loaded.gettersInvoked).toBe(TRIPWIRE_CENSUS.GETTERS_INVOKED);
    expect(loaded.proxies).toBe(TRIPWIRE_CENSUS.PROXIES_SEEN);
    expect(TRIPWIRE_SHAPES.length).toBe(TRIPWIRE_CENSUS.SHAPES);
  });

  it('finds nothing in the identically shaped benign twin', () => {
    // Without this the count above would be a count about the SHAPE rather than
    // about the names, and would stay green if `normalise` matched everything.
    const twin = deepScan(BENIGN_TWIN, 'benign');
    const hits = twin.strings.filter((found) => BANNED_NORMALISED.has(normalise(found.value)));
    expect(hits.length).toBe(TRIPWIRE_CENSUS.BENIGN_HITS);
    // …and the twin is the same walk, not a smaller one.
    expect(twin.gettersInvoked).toBe(TRIPWIRE_CENSUS.GETTERS_INVOKED);
    expect(twin.proxies).toBe(TRIPWIRE_CENSUS.PROXIES_SEEN);
  });

  it('gives every declared fold its own tripwire, in both directions', () => {
    expect(FOLD_NAMES).toEqual(['case', 'separators', 'trim']);
    let checked = 0;
    for (const [fold, variant, name] of FOLD_TRIPWIRES) {
      expect(FOLD_NAMES, fold).toContain(fold);
      expect(normalise(variant), `${fold}: ${variant}`).toBe(name);
      expect(BANNED_NORMALISED.has(normalise(variant)), `${fold}: ${variant}`).toBe(true);
      checked += 1;
    }
    expect(checked).toBe(FOLD_TRIPWIRES.length);
    // The other direction. A fold that matched everything would pass every line
    // above and be worthless.
    let refused = 0;
    for (const value of FOLD_NON_MATCHES) {
      expect(BANNED_NORMALISED.has(normalise(value)), value).toBe(false);
      refused += 1;
    }
    expect(refused).toBe(FOLD_NON_MATCHES.length);
  });
});

describe('the injected axes were varied, and the variation was measured', () => {
  it('pins the disagreement on every axis, with a held-fixed control beside it', () => {
    const readings = axisReadings().map(
      (reading) => [reading.axis, reading.points, reading.disagreements] as const,
    );
    // Counts rather than bounds. A zero on a non-control row says the axis is
    // inert under this driver, which makes every other point in the sweep one
    // point on that axis — CLAUDE.md's "richness on one axis is not evidence
    // about an axis nobody varied".
    expect(readings).toEqual(AXIS_CENSUS);
    const controls = readings.filter(([axis]) => axis.includes('(control)'));
    expect(controls.length).toBe(3);
    for (const [axis, , disagreements] of controls) expect(disagreements, axis).toBe(0);
    for (const [axis, , disagreements] of readings.filter(([name]) => !name.includes('(control)'))) {
      expect(disagreements, axis).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// PLANTED_ROUTES — what was actually run against this file, and what survived
// ---------------------------------------------------------------------------

/**
 * Nine routes, planted into shipped modules one at a time, each run against
 * `tsc --noEmit`, against this file, and against the three accidental catchers
 * the piece was told not to build on: `empireCore.test.ts`'s magic-number
 * audit, its tree-wide string census, and its import fence.
 *
 * THE ISOLATION RULE, AND IT COST FIVE EXTRA ATTEMPTS. A mutant that only trips
 * an accidental catcher has not been caught by this guard. The first attempt at
 * M3 used `?? ''` as a fallback and the empty-string literal moved
 * `singleQuoted.size`; the first attempt at M4 named its hidden property
 * `'settlement'` and did the same; the first attempts at M2 and M5 REPLACED the
 * `'Placeholder'` literal rather than keeping it, which moved the census the
 * other way. Nine mutants took fifteen attempts. Every row below is the
 * attempt that reached isolation.
 *
 * `caughtBy` is what reddened in THIS file. `alsoRed` is every other test that
 * went red, named rather than omitted — a co-catcher is not this guard working,
 * and hiding one would let a row claim credit it has not earned.
 */
interface PlantedRoute {
  readonly id: string;
  /** The attack shape from the survey this route is an instance of. */
  readonly shape: string;
  readonly where: string;
  readonly attempts: number;
  readonly tscExit: number;
  /** Assertions in THIS file that went red. Empty means this file was blind. */
  readonly caughtBy: readonly string[];
  /** The three accidental catchers. `true` means all three stayed green. */
  readonly accidentalCatchersGreen: boolean;
  /** Other tests that also reddened, named so no row over-claims. */
  readonly alsoRed: readonly string[];
}

const PLANTED_ROUTES: readonly PlantedRoute[] = Object.freeze([
  Object.freeze({
    id: 'M1',
    shape: '1 — read the name out of the ban list; the reproduced defect, verbatim',
    where: "production.ts, a new export returning `{ readonly kind: string; readonly days: number }`",
    attempts: 1,
    tscExit: 0,
    caughtBy: Object.freeze([
      'instrument A / walks the whole directory: expected 227 to be 226',
      'instrument A / pins every bare-string position: + "production.ts#idleMilestoneGrant#return.kind"',
      'instrument B / drives every export the census knows about: - "idleMilestoneGrant"',
    ]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([]),
  }),
  Object.freeze({
    id: 'M2',
    shape: '2 + 3 + 4 — derived selection, into an EXISTING bare-string position, inside a declaration already on COVERED_DAY_TOUCHING_FUNCTIONS',
    where: "empireInvariant.ts, `RECRUIT_DISPLAY_NAME`, with the 'Placeholder' literal kept in the file",
    attempts: 3,
    tscExit: 0,
    caughtBy: Object.freeze([
      'instrument B / produces no banned name: expected 256 to be 7',
      'instrument B / CONTAINS no banned name: 145 offenders',
      "instrument B / pins the two strings the composed loop mints: [ 'composed-gym', 'covered-day' ]",
      'instrument B / walked a domain that is not empty: expected 636 to be 637 distinct strings',
    ]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([
      'empireInvariant.test.ts > would catch a person-shaped name arriving in this module',
      'empireInvariant.test.ts > names every lifter it creates from a placeholder and a kebab id',
    ]),
  }),
  Object.freeze({
    id: 'M3',
    shape: '8 — the name as a computed property KEY, nested inside a returned structure, past a cast',
    where: 'production.ts, `accrueProduction`, one extra key on the returned accrual',
    attempts: 2,
    tscExit: 0,
    caughtBy: Object.freeze([
      'instrument B / produces no banned name: expected 37 to be 7',
      'instrument B / CONTAINS no banned name: 30 offenders',
      'instrument B / walked a domain that is not empty: expected 53748 to be 53688 nodes',
    ]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([]),
  }),
  Object.freeze({
    id: 'M4',
    shape: '9 — a NON-ENUMERABLE accessor, on a frozen object',
    where: 'empireInvariant.ts, `gymSnapshot`, `Object.defineProperty` with an existing literal as the key',
    attempts: 2,
    tscExit: 0,
    caughtBy: Object.freeze([
      'instrument B / produces no banned name: expected 50 to be 7',
      'instrument B / CONTAINS no banned name: 43 offenders',
      "instrument B / pins the two strings the composed loop mints: a third arrived",
      'instrument B / walked a domain that is not empty: expected 206781 to be 206695 strings',
    ]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([]),
  }),
  Object.freeze({
    id: 'M5',
    shape: '17 — a normalisation variant a wire decoder folds back: `COVERED-DAY`',
    where: 'empireInvariant.ts, `RECRUIT_DISPLAY_NAME`, uppercased',
    attempts: 3,
    tscExit: 0,
    caughtBy: Object.freeze([
      'instrument B / produces no banned name: expected 256 to be 7 — the case fold, on a real subject',
      'instrument B / CONTAINS no banned name: 145 offenders',
      "instrument B / pins the two strings the composed loop mints: [ 'COVERED-DAY', 'composed-gym' ]",
    ]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([
      'empireInvariant.test.ts > would catch a person-shaped name arriving in this module',
      'empireInvariant.test.ts > names every lifter it creates from a placeholder and a kebab id',
    ]),
  }),
  Object.freeze({
    id: 'M6',
    shape: '19 — hide in the diagnostic channel the guard has to exempt',
    where: 'empireCore.ts, `empireStateFaults`, pushing the bare name rather than a sentence',
    attempts: 1,
    tscExit: 0,
    caughtBy: Object.freeze([
      'instrument B / produces no banned name: expected 12 to be 7 — the EQUALITY half, which the diagnostic exemption does not cover',
      'instrument B / pins what the diagnostic channel actually said',
      'instrument B / CONTAINS no banned name: 5 offenders, via the thrown assertEmpireState message',
    ]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([
      'empireCore.test.ts > opens a gym that satisfies every invariant',
      'empireCore.test.ts > catches every invariant it claims to catch',
      'empireCore.test.ts > refuses a purchased accelerant that arrived past the compiler',
      'empireCore.test.ts > stamps and sizes an applied accelerant, and refuses a negative size',
    ]),
  }),
  Object.freeze({
    id: 'M7',
    shape: '12 — exported DATA rather than a function return',
    where: 'production.ts, a new frozen exported const carrying the name and a per-check-in rate',
    attempts: 1,
    tscExit: 0,
    caughtBy: Object.freeze([
      'instrument A / names no forbidden output in any closed literal union: expected 1176 to be 1175',
      'instrument A / walks the whole directory: expected 227 to be 226',
      'instrument B / produces no banned name: expected 8 to be 7',
      'instrument B / CONTAINS no banned name: 1 offender',
      'instrument B / drives every export the census knows about',
    ]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([]),
  }),
  Object.freeze({
    id: 'M8',
    shape: '16 — THE DECLARED LIMIT: a check-in-keyed day count with no name anywhere',
    where: 'production.ts, `idleProtectionDays(checkIns: number): number`',
    attempts: 1,
    tscExit: 0,
    caughtBy: Object.freeze([
      'instrument A / walks the whole directory: expected 227 to be 226 — a COUNT of the export list',
      'instrument B / drives every export the census knows about: - "idleProtectionDays"',
    ]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([]),
  }),
  Object.freeze({
    id: 'M9',
    shape: '15 — the branded-string channel: `asNpcId(<the name>)`',
    where: 'empireCore.ts, a new export returning `NpcId`',
    attempts: 1,
    tscExit: 0,
    caughtBy: Object.freeze([
      'instrument A / pins every branded-string position: expected 9 to be 8',
      'instrument A / walks the whole directory: expected 227 to be 226',
      'instrument B / drives every export the census knows about',
    ]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([
      'empireCore.test.ts > finds every exported producer of a brand, and says how much it looked at',
    ]),
  }),
]);

/**
 * What M8 measures, said once so it is not read as a pass.
 *
 * Neither instrument SAW the day count. Both of the assertions it reddened are
 * counts of the export list, which is a demand that a reviewer look at a new
 * name — not a verdict about what the name does. `M8_WAS_SEMANTICALLY_CAUGHT`
 * is `false` and is asserted to be `false`, so a later edit that starts
 * claiming coverage of this shape has to change this line to do it.
 */
const M8_WAS_SEMANTICALLY_CAUGHT = false;

describe('the routes that were planted, and what each of them cost', () => {
  it('records nine routes, every one isolated from the three accidental catchers', () => {
    expect(PLANTED_ROUTES.length).toBe(9);
    let attempts = 0;
    for (const route of PLANTED_ROUTES) {
      // A mutant that only trips the magic-number audit, the string census or
      // the import fence has not been caught by this guard. Every row reached a
      // form where all three stayed green.
      expect(route.accidentalCatchersGreen, route.id).toBe(true);
      expect(route.tscExit, route.id).toBe(0);
      expect(route.caughtBy.length, route.id).toBeGreaterThan(0);
      expect(route.shape.length, route.id).toBeGreaterThan(20);
      attempts += route.attempts;
    }
    // Fifteen attempts for nine routes. The five extra are the accidents that
    // had to be stripped: an empty-string fallback, a new property name, and
    // two mutants that REPLACED a shipped literal instead of keeping it.
    expect(attempts).toBe(15);
    expect(PLANTED_ROUTES.filter((route) => route.alsoRed.length > 0).length).toBe(4);
  });

  it('says plainly that attack shape 16 was not semantically caught', () => {
    // Not a pass. The declared limit, taken as a boolean so it cannot be
    // quietly reinterpreted.
    expect(M8_WAS_SEMANTICALLY_CAUGHT).toBe(false);
    const shape16 = PLANTED_ROUTES.find((route) => route.id === 'M8');
    expect(shape16?.caughtBy.every((line) => line.includes('export'))).toBe(true);
  });
});
