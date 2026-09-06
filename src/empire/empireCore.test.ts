/**
 * empireCore.test.ts — the tests for the §5 vocabulary, and for the claim in
 * this piece that vitest cannot grade.
 *
 * ===========================================================================
 * What is graded by what, because part of this file is not a runtime test
 * ===========================================================================
 *
 * GDD §4.4's bar on this shape is that the hazard be STRUCTURALLY unable to
 * occur, not merely observed not to occur at the horizons somebody happened to
 * sweep — and it records that "structurally unable" has two readings and means
 * both. This file is the first reading: the accelerated path is not
 * constructible.
 *
 * So the load-bearing assertions in the first section are `@ts-expect-error`
 * directives, and they are graded by `npx tsc --noEmit` rather than by vitest.
 * Vitest strips types without checking them, so under vitest alone those lines
 * are comments. If `AccelerableOutput` ever widens to admit a
 * progression-reaching output for a purchased accelerant, `tsc` reports TS2578
 * "Unused '@ts-expect-error' directive" and the build fails. That is the
 * compiler's verdict rather than a claim about it.
 *
 * EVERY DIRECTIVE IN THIS FILE NEEDS A LINE VITEST CAN ALSO REDDEN, and that is
 * a rule this file broke twice, in two different ways, and the second time it
 * broke it in the sentence written to fix the first.
 *
 * The first break was on the licence directives: the hazard tests ended
 * `expect(bought.accelerant).toBe('gym-empire-timer-skip')` — reading back the
 * argument that had just been passed in, from a constructor that validated
 * nothing. Under vitest they were two green ticks for hazard 1 and hazard 2
 * that were ticks for nothing at all. Both constructors now ask
 * `mayAccelerate` and throw, so each of those directives sits beside a
 * `toThrow` whose message names the arrival, the output and the reach.
 *
 * The second break was on the BRAND directives, and the rule above was already
 * written when they shipped without one. Five of them sat over
 * `expect(typeof wrong).toBe('number')` — twice — and over three assertions
 * that the constructors still mint the same value. A brand is erased at
 * runtime, so those were not weak lines, they were lines no state of
 * `empireCore.ts` could redden: the subject returns a number and mints the same
 * value whether the parameter says `SettledLevel` or `number`.
 *
 * A brand's reddenable line is therefore the DECLARATION, and that is what
 * 'fences every branded quantity in its own declaration' pins — the constructor
 * list read out of the source with `Unbranded<N>` asserted on each, and one row
 * per branded parameter and return type, so widening any of them to a primitive
 * is red in vitest at the same moment it makes a directive unused in `tsc`.
 * 'gives every type-only directive in this file a covering test, by census'
 * counts the directives and pins which tests carry them. Be exact about what
 * that census is worth: it stops a directive arriving with no signed-for home,
 * and it does not prove the covering assertions bite. That evidence is the
 * mutation run in the report.
 *
 * A DIRECTIVE'S DOMAIN IS THE SPELLING IT WAS WRITTEN IN. Both original
 * directives passed the accelerant as a bare string literal, which is the one
 * shape where `A` infers as a singleton and the licence filter bites. The
 * spellings that widen `A` to the declared union — a parameter, a `for...of`
 * over `EMPIRE_ACCELERANTS`, an `isEmpireAccelerant` narrowing — compiled, and
 * a green `tsc` said nothing about them because nothing asked. They are asked
 * now, all three, on both constructors.
 *
 * To check the directives still bite, change `ARRIVAL_LICENCE['store-purchase']`
 * in `empireCore.ts` to `['idle-only', 'progression-reaching']`. `tsc --noEmit`
 * then reports TS2578 on the directives below, and `vitest run src/empire`
 * fails the licence tests in this file. Both were run; see the report for the
 * verbatim output.
 *
 * The second reading — that the output does not MOVE with the purchase — is not
 * in this file and is not claimed by it. It belongs to piece E6 and §6 of
 * `empireCore.ts`'s header states what it has to assert.
 *
 * ===========================================================================
 * Three exported constants this file deliberately does not assert on
 * ===========================================================================
 *
 * `EMPIRE_OUTPUT_REACH_IS_A_PARTITION`, `EMPIRE_ACCELERANT_ARRIVAL_IS_A_PARTITION`
 * and `EMPIRE_PAYS_NO_FORBIDDEN_OUTPUT` are each `const x: T = true`. Their
 * value is a literal, so `expect(x).toBe(true)` is a line no state of the
 * tables can redden — and all three of those assertions were in this file,
 * reading as independent checks. They are graded by `tsc --noEmit`; the runtime
 * statement of the same three claims is `empireVocabularyFaults`, and the
 * membership of the four derived lists is pinned by name below.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { SOURCE_RULES, auditSource, formatFindings } from '../tuning/audit';
import { shippedModuleNames, tsFilesUnder, withProbeTree } from './directoryWalk.test';
import { EMPIRE_TUNING } from './empireTuning';
import {
  ACCELERANT_ARRIVAL,
  ACCELERANT_ARRIVALS,
  ARRIVAL_LICENCE,
  EARNED_ACCELERANTS,
  EMPIRE_ACCELERANTS,
  EMPIRE_FORBIDDEN_OUTPUTS,
  EMPIRE_OUTPUTS,
  IDLE_ONLY_OUTPUTS,
  OUTPUT_REACHES,
  OUTPUT_SINK,
  OUTPUT_SINKS,
  PROGRESSION_REACHING_OUTPUTS,
  PURCHASABLE_ACCELERANTS,
  SINK_REACH,
  asAcceleratedSeconds,
  asGymBucks,
  asIdleTenureDays,
  asInjuryDaysSaved,
  asNpcId,
  asReputation,
  asTrainingIq,
  asUnacceleratedSeconds,
  accelerantLicence,
  acceleratedOutput,
  applyAccelerant,
  assertEmpireState,
  buildSeconds,
  createEmpireClock,
  createEmpireState,
  createNpcLifter,
  elapsedFor,
  empireStateFaults,
  empireVocabularyFaults,
  equipmentTierCost,
  idleLedger,
  idleTenureDays,
  isEmpireAccelerant,
  isEmpireOutput,
  isProgressionReachingOutput,
  isPurchasableAccelerant,
  mayAccelerate,
  outputReach,
  physioDaysSavedFor,
  progressionLedger,
  recruitCost,
  recruitReputationThreshold,
  recruitSeconds,
  refuseWith,
  reputationTierIndex,
  rosterCapacity,
  settledLevel,
  settledTenureDays,
  spaceLevelCost,
  staffLevelCost,
  type AcceleratedOutput,
  type AcceleratedSeconds,
  type AppliedAccelerant,
  type EmpireAccelerant,
  type EmpireLedgerEntry,
  type EmpireOutput,
  type EmpireState,
  type EquipmentTier,
  type GymAxes,
  type GymBucks,
  type IdleTenureDays,
  type NpcTier,
  type SettledTenureDays,
  type StaffRole,
  type UnacceleratedSeconds,
} from './empireCore';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// The producer census, resolved through the TypeScript checker
// ---------------------------------------------------------------------------

/**
 * WHAT THIS REPLACED, AND WHY THE REPLACEMENT IS A DIFFERENT KIND OF THING.
 *
 * The guard that was supposed to catch a producer taking a bare primitive was
 *
 *     [...code.matchAll(/export function (as[A-Z]\w*)<[^{]*\{/g)]
 *
 * — scoped by NAME. `createEmpireClock` and `createNpcLifter` both return
 * branded quantities and both took bare `number`s, and neither is spelled
 * `as*`, so the check that existed for exactly this defect could not see it.
 * CLAUDE.md records the same shape one file over: `progression.test.ts`'s seal
 * check matched a callee by identifier TEXT while the `receive` check twelve
 * lines below resolved symbols through the checker, and a local shim spelled
 * `sealServerValue` type-checked clean past 202 green guard tests.
 *
 * So this resolves through the compiler, in both directions:
 *
 *   - WHICH FUNCTIONS PRODUCE A BRAND is asked of the checker. A type is
 *     branded when it carries a property whose computed key resolves — through
 *     `getAliasedSymbol`, so an alias or a re-export lands on the same
 *     declaration — to the `EMPIRE_BRAND` symbol declared in `empireCore.ts`.
 *     The return type is walked into unions, arrays, conditionals (through
 *     their constraint) and object properties, so a brand nested inside an
 *     `EmpireClock`, an `NpcLifter` or an `EmpireState` counts. No part of that
 *     determination reads a function's name.
 *   - WHICH PARAMETERS WOULD ADMIT A BRANDED VALUE is asked of the compiler by
 *     COMPILING A CALL. A generated probe module calls every exported function
 *     once per parameter slot per candidate argument — two bare primitives and
 *     one value of every brand this module declares — filling the other slots
 *     with `never`, which is assignable to anything. A slot "admits" a
 *     candidate when the resulting call produces no diagnostic.
 *
 * Compiling the call rather than testing assignability against the declared
 * parameter type is the load-bearing choice and it is not a stylistic one.
 * Every guarded constructor here is generic — `value: N & Unbranded<N>` — and
 * `number` is not assignable to an uninstantiated `N`, so an assignability
 * probe reports EVERY generic slot as admitting nothing, and reports the
 * unguarded mutant `<N extends number>(value: N)` exactly the same way. That
 * check would have been green on the defect it was written for. A real call
 * site infers `N`, which is where the guard actually bites.
 *
 * What it cannot see, stated because no census reaches past it: arithmetic.
 * `Number(clock.accelerated) + 0` is a plain number and no signature can tell
 * where it came from. Piece E6's element-wise ledger comparison covers that.
 */

const CORE_PATH = path.join(HERE, 'empireCore.ts');

/** Served from memory and never written to disk. */
const PROBE_PATH = path.join(HERE, '__brandCensusProbe.ts');

const REPO_ROOT = path.resolve(HERE, '..', '..');

/** The two bare primitives a brand in this module is made of. */
const RAW_CANDIDATES = ['RAW_NUMBER', 'RAW_STRING'] as const;

type SlotKind = 'both' | 'raw-only' | 'brand-only' | 'neither';

interface CensusSlot {
  readonly fn: string;
  readonly index: number;
  readonly parameter: string;
  readonly acceptsRaw: boolean;
  readonly acceptsBrands: readonly string[];
  readonly kind: SlotKind;
}

interface CensusFunction {
  readonly name: string;
  /** The brands reachable from the return type. Empty for a non-producer. */
  readonly produces: readonly string[];
  readonly slots: readonly CensusSlot[];
}

interface BrandCensus {
  readonly brands: readonly string[];
  readonly functions: readonly CensusFunction[];
  readonly slots: readonly CensusSlot[];
  readonly probes: number;
  readonly refusedProbes: number;
  /** Functions whose all-`never` control call did not compile. Must be empty. */
  readonly controlFailures: readonly string[];
  /**
   * Types `brandsIn` reached and had no arm for. Must be empty.
   *
   * THIS FILE'S OWN COPY OF THE SIXTEENTH BYPASS. `brandsIn`'s walk was four
   * `if ((current.flags & X) !== 0)` arms with no final branch, exactly like
   * `surfaceOf`'s in `empireForbiddenOutput.test.ts`, so a type kind outside the
   * four made a brand under it invisible and `produces` came back short. It was
   * found by a dispatch-chain census that reads the whole directory rather than
   * the one file the bypass was planted in.
   */
  readonly unwalkedTypes: readonly string[];
  /** Diagnostics from `empireCore.ts` itself. Must be empty. */
  readonly coreDiagnostics: readonly string[];
}

function compilerOptions(): ts.CompilerOptions {
  const configPath = path.join(REPO_ROOT, 'tsconfig.json');
  const config = ts.readConfigFile(configPath, ts.sys.readFile).config as unknown;
  const parsed = ts.parseJsonConfigFileContent(config, ts.sys, REPO_ROOT);
  return { ...parsed.options, noEmit: true, skipLibCheck: true };
}

function programWithProbe(options: ts.CompilerOptions, probeText: string): ts.Program {
  const host = ts.createCompilerHost(options, true);
  const readSource = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) =>
    path.normalize(fileName) === PROBE_PATH
      ? ts.createSourceFile(fileName, probeText, languageVersion, true)
      : readSource(fileName, languageVersion, onError, shouldCreate);
  const exists = host.fileExists.bind(host);
  host.fileExists = (fileName) =>
    path.normalize(fileName) === PROBE_PATH ? true : exists(fileName);
  const read = host.readFile.bind(host);
  host.readFile = (fileName) =>
    path.normalize(fileName) === PROBE_PATH ? probeText : read(fileName);
  return ts.createProgram([CORE_PATH, PROBE_PATH], options, host);
}

let censusMemo: BrandCensus | null = null;

function brandCensus(): BrandCensus {
  if (censusMemo !== null) return censusMemo;

  const options = compilerOptions();
  const program = programWithProbe(options, 'export {};\n');
  const checker = program.getTypeChecker();
  const core = program.getSourceFile(CORE_PATH);
  if (core === undefined) throw new Error(`${CORE_PATH} is not in the program`);
  const moduleSymbol = checker.getSymbolAtLocation(core);
  if (moduleSymbol === undefined) throw new Error('empireCore.ts resolved to no module symbol');

  // The brand symbol, taken from its declaration rather than from its
  // spelling. Every `isBranded` verdict below is symbol identity against this.
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

  const isBranded = (type: ts.Type): boolean =>
    type.getProperties().some((property) => {
      const declaration = property.valueDeclaration ?? property.declarations?.[0];
      const name = declaration === undefined ? undefined : (declaration as ts.NamedDeclaration).name;
      if (name === undefined || !ts.isComputedPropertyName(name)) return false;
      return resolved(checker.getSymbolAtLocation(name.expression)) === brandSymbol;
    });

  const exportedSymbols = checker.getExportsOfModule(moduleSymbol);

  const brands: string[] = [];
  for (const symbol of exportedSymbols) {
    const declaration = symbol.declarations?.[0];
    if (declaration === undefined || !ts.isTypeAliasDeclaration(declaration)) continue;
    if (declaration.typeParameters !== undefined) continue;
    if (isBranded(checker.getTypeAtLocation(declaration.name))) brands.push(symbol.getName());
  }
  brands.sort();

  /** Every brand reachable from a type, through unions, arrays and properties. */
  const unwalked = new Set<string>();
  const brandsIn = (type: ts.Type): readonly string[] => {
    const found = new Set<string>();
    const seen = new Set<ts.Type>();
    const walk = (current: ts.Type, depth: number): void => {
      if (depth > 4 || seen.has(current)) return;
      seen.add(current);
      if (isBranded(current)) {
        found.add(checker.typeToString(current));
        return;
      }
      if (current.isUnionOrIntersection()) {
        for (const constituent of current.types) walk(constituent, depth + 1);
        return;
      }
      if ((current.flags & (ts.TypeFlags.Conditional | ts.TypeFlags.TypeParameter)) !== 0) {
        const constraint = checker.getBaseConstraintOfType(current);
        if (constraint !== undefined && constraint !== current) walk(constraint, depth + 1);
        return;
      }
      if (checker.isArrayType(current) || checker.isTupleType(current)) {
        for (const argument of checker.getTypeArguments(current as ts.TypeReference)) {
          walk(argument, depth + 1);
        }
        return;
      }
      if ((current.flags & ts.TypeFlags.Object) !== 0) {
        for (const property of current.getProperties()) {
          walk(checker.getTypeOfSymbolAtLocation(property, property.valueDeclaration ?? core), depth + 1);
        }
        return;
      }
      // THE `else` ON THE TYPE-FLAG AXIS, ADDED BECAUSE THE SIBLING WALKER IN
      // `empireForbiddenOutput.test.ts` HAD THE IDENTICAL MISSING BRANCH AND A
      // BYPASS WENT THROUGH IT. A type kind outside the four above — a template
      // literal, a `keyof`, an indexed access — was dropped here with nothing
      // recorded, so a brand sitting under one would make `produces` come back
      // short and the fault-list join below would pass on a census that had
      // quietly got smaller. Nothing shipped reaches it today, which is what
      // `unwalkedTypes` being pinned empty says; a first arrival is a line
      // naming the type instead of a shorter list.
      //
      // A PRIMITIVE IS NOT AN OMISSION AND IS NOT RECORDED. `number`, `string`,
      // `boolean`, `void`, `undefined`, `null` and a string literal carry no
      // properties this walk could find a brand under, so recording them would
      // fill this list with every leaf in the directory and hide the arrivals it
      // exists for.
      const CARRIES_NO_BRAND =
        ts.TypeFlags.StringLike |
        ts.TypeFlags.NumberLike |
        ts.TypeFlags.BigIntLike |
        ts.TypeFlags.BooleanLike |
        ts.TypeFlags.ESSymbolLike |
        ts.TypeFlags.VoidLike |
        ts.TypeFlags.Null |
        ts.TypeFlags.Never |
        ts.TypeFlags.Unknown |
        ts.TypeFlags.Any;
      if ((current.flags & CARRIES_NO_BRAND) !== 0) return;
      unwalked.add(checker.typeToString(current));
    };
    walk(type, 0);
    return [...found].sort();
  };

  interface Declared {
    readonly name: string;
    readonly produces: readonly string[];
    readonly parameters: readonly string[];
  }
  const declared: Declared[] = [];
  for (const symbol of exportedSymbols) {
    const declaration = symbol.declarations?.[0];
    if (declaration === undefined || !ts.isFunctionDeclaration(declaration)) continue;
    const signature = checker.getSignatureFromDeclaration(declaration);
    if (signature === undefined) throw new Error(`no signature for ${symbol.getName()}`);
    declared.push({
      name: symbol.getName(),
      produces: brandsIn(checker.getReturnTypeOfSignature(signature)),
      parameters: declaration.parameters.map((parameter) => {
        if (parameter.dotDotDotToken !== undefined || parameter.questionToken !== undefined) {
          // No rest or optional parameter exists in this module today. One
          // arriving changes what "fill the other slots with `never`" means, so
          // it is a refusal rather than a silently mis-probed slot.
          throw new Error(`${symbol.getName()} has an optional or rest parameter; the probe cannot fill it`);
        }
        return parameter.name.getText();
      }),
    });
  }
  declared.sort((left, right) => (left.name < right.name ? -1 : 1));

  // The probe module: one call per (function, slot, candidate), each on its own
  // line so a diagnostic maps back to exactly one probe.
  const lines: string[] = [
    "import * as M from './empireCore';",
    'declare const NOTHING: never;',
    'declare const RAW_NUMBER: number;',
    'declare const RAW_STRING: string;',
    ...brands.map((brand) => `declare const BRAND_${brand}: M.${brand};`),
  ];
  interface Probe {
    readonly fn: string;
    readonly slot: number;
    readonly candidate: string;
    readonly branded: boolean;
    readonly control: boolean;
    readonly line: number;
  }
  const probes: Probe[] = [];
  const call = (fn: Declared, slot: number, candidate: string, branded: boolean): void => {
    const args = fn.parameters.map((_, index) => (index === slot ? candidate : 'NOTHING'));
    lines.push(`M.${fn.name}(${args.join(', ')});`);
    probes.push({ fn: fn.name, slot, candidate, branded, control: slot < 0, line: lines.length });
  };
  for (const fn of declared) {
    call(fn, -1, 'NOTHING', false);
    for (let slot = 0; slot < fn.parameters.length; slot += 1) {
      for (const raw of RAW_CANDIDATES) call(fn, slot, raw, false);
      for (const brand of brands) call(fn, slot, `BRAND_${brand}`, true);
    }
  }

  const probed = programWithProbe(options, `${lines.join('\n')}\n`);
  const probeFile = probed.getSourceFile(PROBE_PATH);
  if (probeFile === undefined) throw new Error('the probe module is not in the program');
  const coreInProbe = probed.getSourceFile(CORE_PATH);
  if (coreInProbe === undefined) throw new Error(`${CORE_PATH} is not in the probe program`);

  const refusedLines = new Set<number>();
  for (const diagnostic of [
    ...probed.getSyntacticDiagnostics(probeFile),
    ...probed.getSemanticDiagnostics(probeFile),
  ]) {
    if (diagnostic.start === undefined) continue;
    refusedLines.add(probeFile.getLineAndCharacterOfPosition(diagnostic.start).line + 1);
  }
  const coreDiagnostics = [
    ...probed.getSyntacticDiagnostics(coreInProbe),
    ...probed.getSemanticDiagnostics(coreInProbe),
  ].map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '));

  const accepted = (probe: Probe): boolean => !refusedLines.has(probe.line);

  const slots: CensusSlot[] = [];
  const functions: CensusFunction[] = declared.map((fn) => {
    const own: CensusSlot[] = [];
    for (let index = 0; index < fn.parameters.length; index += 1) {
      const mine = probes.filter((probe) => probe.fn === fn.name && probe.slot === index);
      const acceptsRaw = mine.some((probe) => !probe.branded && accepted(probe));
      const acceptsBrands = mine
        .filter((probe) => probe.branded && accepted(probe))
        .map((probe) => probe.candidate.replace('BRAND_', ''))
        .sort();
      const kind: SlotKind = acceptsRaw
        ? acceptsBrands.length > 0
          ? 'both'
          : 'raw-only'
        : acceptsBrands.length > 0
          ? 'brand-only'
          : 'neither';
      const slot: CensusSlot = {
        fn: fn.name,
        index,
        parameter: fn.parameters[index] as string,
        acceptsRaw,
        acceptsBrands,
        kind,
      };
      own.push(slot);
      slots.push(slot);
    }
    return { name: fn.name, produces: fn.produces, slots: own };
  });

  censusMemo = {
    brands,
    functions,
    slots,
    probes: probes.length,
    refusedProbes: probes.filter((probe) => !accepted(probe)).length,
    controlFailures: probes.filter((probe) => probe.control && !accepted(probe)).map((p) => p.fn),
    unwalkedTypes: Object.freeze([...unwalked].sort()),
    coreDiagnostics,
  };
  return censusMemo;
}

/** The producers, as the census found them. */
const producers = (census: BrandCensus): readonly CensusFunction[] =>
  census.functions.filter((fn) => fn.produces.length > 0);

interface FaultSite {
  /** The message with its substitutions left in, for a failure to name. */
  readonly text: string;
  /** The same message as a pattern, with each `${...}` widened to `.*`. */
  readonly pattern: RegExp;
}

/**
 * Every `faults.push` site in `empireStateFaults`, as the message it pushes.
 *
 * Read out of the SUBJECT, which is the whole point: the invariant table in
 * this file used to be guarded by `expect(broken.length).toBe(15)` — a count of
 * an array declared in the same test, which no state of `empireCore.ts` could
 * move. This is what that line was reaching for: a fault branch added to the
 * decode boundary with no row exercising it is red, and one deleted is red too.
 *
 * The parse is deliberately narrow and pins its own result: a balanced-paren
 * slice from `faults.push(`, then the string and template chunks of the
 * argument concatenated in order, then `${...}` widened to `.*`. A message with
 * an unbalanced parenthesis inside a literal would merge two sites into one,
 * and the count pinned at the call site is what says so.
 */
function faultPushSkeletons(): readonly FaultSite[] {
  const source = readFileSync(path.join(HERE, 'empireCore.ts'), 'utf8');
  const start = source.indexOf('export function empireStateFaults');
  if (start < 0) throw new Error('no empireStateFaults declaration in empireCore.ts');
  const after = source.indexOf('\nexport ', start + 1);
  const body = source.slice(start, after < 0 ? source.length : after);

  const marker = 'faults.push(';
  const sites: FaultSite[] = [];
  for (let at = body.indexOf(marker); at >= 0; at = body.indexOf(marker, at + 1)) {
    let depth = 0;
    let index = at + marker.length - 1;
    for (; index < body.length; index += 1) {
      const character = body[index];
      if (character === '(') depth += 1;
      else if (character === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const argument = body.slice(at + marker.length, index);
    let text = '';
    for (const chunk of argument.matchAll(/`((?:[^`\\]|\\[\s\S])*)`|'((?:[^'\\\n]|\\.)*)'/g)) {
      text += chunk[1] ?? chunk[2] ?? '';
    }
    if (text.length === 0) throw new Error(`a faults.push with no message: ${argument}`);
    const pattern = text
      .split(/\$\{[^}]*\}/)
      .map((literal) => literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*');
    sites.push({ text, pattern: new RegExp(`^${pattern}$`) });
  }
  return sites;
}

// ---------------------------------------------------------------------------
// The structural half — graded by `tsc --noEmit`, not by vitest
// ---------------------------------------------------------------------------

describe('a purchased accelerant does not typecheck onto a progression-reaching output', () => {
  it('accepts every legal pairing for a purchased skip, spelled out', () => {
    // The positive control for the directives below. If `AccelerableOutput`
    // resolved to `never` — which would also make the `@ts-expect-error`s pass
    // — these lines would not compile either. They do, so the licensed subset
    // is a real subset rather than an empty one.
    const legal: readonly AcceleratedOutput[] = [
      acceleratedOutput('gym-empire-timer-skip', 'gym-bucks'),
      acceleratedOutput('gym-empire-timer-skip', 'reputation'),
      acceleratedOutput('gym-empire-timer-skip', 'roster-slot'),
      acceleratedOutput('gym-empire-timer-skip', 'cosmetic-unlock'),
    ];
    // And the list is the whole list, cross-checked against the derived value
    // so it cannot go stale when an output is added.
    expect(legal.map((pairing) => pairing.output).sort()).toEqual([...IDLE_ONLY_OUTPUTS].sort());
  });

  it('refuses the Training IQ path, in both graders — GDD §8.3B into §5.2, hazard 1', () => {
    // Two graders on one call, and it needed both. The directive is `tsc`'s: a
    // widened `AccelerableOutput` makes it unused and the build fails. The
    // `toThrow` is vitest's, and it is what this test did not have — the line
    // here used to be `expect(bought.accelerant).toBe('gym-empire-timer-skip')`,
    // which reads back the argument that was just passed in and which no state
    // of the licence tables could change.
    expect(() =>
      acceleratedOutput(
        'gym-empire-timer-skip',
        // @ts-expect-error — 'training-iq' feeds 'training-pace', which is
        // progression-reaching; a store-purchase accelerant is licensed for
        // 'idle-only' and nothing else. GDD §8.1, §8.3B, §12.3.
        'training-iq',
      ),
    ).toThrow(
      /gym-empire-timer-skip arrives by store-purchase and may not accelerate training-iq, which reaches progression-reaching/,
    );
  });

  it('refuses the physio path, in both graders — GDD §5.4 into §3.5, hazard 2', () => {
    // The second path, closed by the same edit rather than by a second check.
    // 'training-iq' and 'physio-days-saved' both declare the 'training-pace'
    // sink, so they are one row in `SINK_REACH`. There is no configuration in
    // which one compiles and the other does not, which is the property the
    // currencyProvenance precedent exists to deliver.
    expect(() =>
      acceleratedOutput(
        'rewarded-ad-timer-skip',
        // @ts-expect-error — a shorter setback is training pace by another name,
        // and a rewarded ad is the same arrival row as a purchase.
        'physio-days-saved',
      ),
    ).toThrow(
      /rewarded-ad-timer-skip arrives by store-purchase and may not accelerate physio-days-saved, which reaches progression-reaching/,
    );
  });

  it('refuses the same two on `applyAccelerant`, which is the branch below', () => {
    // `acceleratedOutput` and `applyAccelerant` are two arms of one decision
    // and were written as two. Both now funnel through one non-generic callee
    // so the runtime refusal cannot be present on one and absent on the other,
    // and both are driven here rather than one being trusted to imply the
    // other.
    expect(() =>
      applyAccelerant(
        'gym-empire-timer-skip',
        // @ts-expect-error — hazard 1 through the stamped constructor.
        'training-iq',
        asUnacceleratedSeconds(0),
        EMPIRE_TUNING.TIMER_SKIP_SECONDS_PER_GRANT,
      ),
    ).toThrow(/may not accelerate training-iq/);
    expect(() =>
      applyAccelerant(
        'rewarded-ad-timer-skip',
        // @ts-expect-error — hazard 2 through the stamped constructor.
        'physio-days-saved',
        asUnacceleratedSeconds(0),
        EMPIRE_TUNING.TIMER_SKIP_SECONDS_PER_GRANT,
      ),
    ).toThrow(/may not accelerate physio-days-saved/);
  });

  it('refuses an accelerant whose type has widened to the union, in all three spellings', () => {
    // The defect the two directives above could not see. `AccelerableOutput<A>`
    // is only as narrow as `A`, `A` is inferred at the CALL SITE, and
    // `LicenceOfAccelerant<A>` is an indexed access that DISTRIBUTES over a
    // union key — so for `A = EmpireAccelerant` the licence is every licence
    // and the accelerable set is every output. All three spellings below
    // compiled, with no cast and only exported API. Their domain is exactly
    // the one the bare-literal directives never produce.
    const viaAParameter = (accelerant: EmpireAccelerant): AppliedAccelerant =>
      // @ts-expect-error — a union accelerant widens the licence to every
      // output; `OneAccelerant` refuses it at the first argument.
      applyAccelerant(accelerant, 'training-iq', asUnacceleratedSeconds(0), 1);

    const viaTheModulesOwnList = (): void => {
      for (const accelerant of EMPIRE_ACCELERANTS) {
        // @ts-expect-error — the element type of the exported list IS the union.
        applyAccelerant(accelerant, 'physio-days-saved', asUnacceleratedSeconds(0), 1);
      }
    };

    const viaTheDecodePath = (wire: unknown): void => {
      if (isEmpireAccelerant(wire)) {
        // @ts-expect-error — the narrowing lands on the union and goes no
        // further, and this is the exact path the runtime shadow exists for.
        acceleratedOutput(wire, 'training-iq');
      }
    };

    // And the runtime half, so vitest reports something for each spelling
    // rather than three comments.
    expect(() => viaAParameter('gym-empire-timer-skip')).toThrow(
      /gym-empire-timer-skip arrives by store-purchase and may not accelerate training-iq/,
    );
    expect(viaTheModulesOwnList).toThrow(/may not accelerate physio-days-saved/);
    expect(() => viaTheDecodePath('rewarded-ad-timer-skip')).toThrow(
      /rewarded-ad-timer-skip arrives by store-purchase and may not accelerate training-iq/,
    );

    // Discriminating rather than firing on everything: the same widened
    // parameter with an EARNED accelerant is legal and does not throw, and a
    // wire value that is not an accelerant never reaches the constructor.
    expect(() => viaAParameter('coach-staff-level')).not.toThrow();
    expect(() => viaTheDecodePath('not-an-accelerant')).not.toThrow();
  });

  it('refuses the illegal pairing as an object literal — the fence inference cannot move', () => {
    // `AcceleratedOutput` is the union `AppliedAccelerant` is built on. It is
    // checked against a VALUE rather than resolved from a call site's
    // inference, so union widening never reached it — it was the strongest
    // fence in `empireCore.ts` and the one thing with no test at all.
    const anyAccelerant = (index: number): EmpireAccelerant =>
      EMPIRE_ACCELERANTS[index % EMPIRE_ACCELERANTS.length] ?? 'coach-staff-level';

    // @ts-expect-error — the skip's member of the union types `output` as the
    // idle-only subset, and no other member accepts this accelerant.
    const boughtIq: AcceleratedOutput = {
      accelerant: 'gym-empire-timer-skip',
      output: 'training-iq',
    };
    // @ts-expect-error — and with the accelerant field typed as the whole
    // union: TypeScript checks a union-discriminated source against every
    // member, and the sold skip's member refuses this output.
    const widenedIq: AcceleratedOutput = { accelerant: anyAccelerant(0), output: 'training-iq' };

    // Two positive controls, so the refusals above are about the OUTPUT
    // reaching progression rather than about object literals or unions being
    // refused generally. Both of these compile.
    const legal: readonly AcceleratedOutput[] = [
      { accelerant: 'gym-empire-timer-skip', output: 'gym-bucks' },
      { accelerant: 'coach-staff-level', output: 'training-iq' },
      { accelerant: anyAccelerant(0), output: 'gym-bucks' },
    ];

    // The runtime half of the same three claims, so a licence widening is red
    // here as well as in the typecheck.
    expect(mayAccelerate(boughtIq.accelerant, boughtIq.output)).toBe(false);
    expect(mayAccelerate(widenedIq.accelerant, widenedIq.output)).toBe(false);
    let evaluated = 0;
    for (const pairing of legal) {
      expect(
        mayAccelerate(pairing.accelerant, pairing.output),
        `${pairing.accelerant} -> ${pairing.output}`,
      ).toBe(true);
      evaluated += 1;
    }
    // The line here was `expect(legal.length).toBe(3)`, guarding the `.every`
    // above against an empty list — but `legal` is three object literals eight
    // lines up, so no state of `empireCore.ts` moved it. It guarded the test
    // against being edited, which is not the same thing.
    //
    // What the list is for is two REASONS, so the reasons are what is counted,
    // read through the tables: two of these pairings are legal because the
    // output is idle-only, one because the accelerant is earned. Re-tagging the
    // sold skip as `'gym-progress'` — how §12.3's first refusal condition would
    // ship — moves those counts to 0 and 3.
    expect(evaluated).toBe(legal.length);
    expect(legal.filter((pairing) => isPurchasableAccelerant(pairing.accelerant)).length).toBe(2);
    expect(legal.filter((pairing) => !isPurchasableAccelerant(pairing.accelerant)).length).toBe(1);
    expect(legal.filter((pairing) => isProgressionReachingOutput(pairing.output)).length).toBe(1);
  });

  it('lets an earned accelerant reach the trickle, because §5.2 asks for that', () => {
    // The other positive control, and the one that stops the fix being the
    // too-broad one. §5.2 wants the empire connected to Sim progression; what
    // §8.1 refuses is a PURCHASE reaching it. A coach built with Gym Bucks is
    // not a purchase, so this compiles.
    const earned: readonly AcceleratedOutput[] = [
      acceleratedOutput('coach-staff-level', 'training-iq'),
      acceleratedOutput('space-level', 'physio-days-saved'),
      acceleratedOutput('reputation-tier', 'gym-bucks'),
    ];
    // The branch immediately below the one above, and its `expect(earned.length)
    // .toBe(3)` was the same guard against editing the test. Derived instead:
    // the list covers every earned accelerant, and it reaches both hazards. An
    // accelerant added to `EMPIRE_ACCELERANTS` on the `'gym-progress'` row
    // reddens the first line; re-tagging `'training-pace'` as `'idle-only'`,
    // the one-word edit that opens both hazards, reddens the second.
    expect(earned.map((pairing) => pairing.accelerant).sort()).toEqual(
      [...EARNED_ACCELERANTS].sort(),
    );
    expect(earned.filter((pairing) => isProgressionReachingOutput(pairing.output)).length).toBe(2);
    expect(earned.filter((pairing) => isPurchasableAccelerant(pairing.accelerant)).length).toBe(0);
  });

  it('refuses an accelerated clock where a wall clock is required, on every arm', () => {
    const clock = createEmpireClock(1000, 500);
    const lifter = createNpcLifter('a', 'novice', 'Placeholder', 0, 0);
    // @ts-expect-error — `settledTenureDays` takes UnacceleratedSeconds. The
    // physio and Training IQ halves run on the wall clock, so handing them the
    // accelerated one is a type error rather than a silent two-hop sale.
    const wrong = settledTenureDays(lifter, clock.accelerated);
    // @ts-expect-error — the sibling arm, written because the arm above was:
    // the idle half takes AcceleratedSeconds and the wall clock is not one.
    // This direction carried no directive for a round.
    const alsoWrong = idleTenureDays(lifter, clock.unaccelerated);
    // @ts-expect-error — and the level counter, whose `now` is the same seam.
    const wrongLevel = settledLevel([], clock.accelerated);
    // @ts-expect-error — including its first argument, which is the parameter
    // immediately beside the one above and had no directive either.
    const alsoWrongLevel = settledLevel([clock.accelerated], clock.unaccelerated);

    // The vitest half, and it is a quantity rather than a `typeof`. The line
    // here used to be `expect(typeof wrong).toBe('number')`, which is true of
    // every version of the subject — `settledTenureDays` returns a division
    // whatever it is declared to take, so no edit to `empireCore.ts` could
    // redden it. What the directives are worth is a NUMBER: routing the
    // accelerated clock into the settled tenure adds the whole purchased skip
    // to the term §5.2 pays Training IQ on, and this measures exactly that gap.
    const honest = settledTenureDays(lifter, clock.unaccelerated);
    expect(Number(wrong) - Number(honest)).toBeCloseTo(500 / EMPIRE_TUNING.SECONDS_PER_DAY, 9);
    expect(Number(wrong)).toBeGreaterThan(Number(honest));
    // And the sibling arm's gap, measured the same way rather than assumed.
    const idleHonest = idleTenureDays(lifter, clock.accelerated);
    expect(Number(idleHonest) - Number(alsoWrong)).toBeCloseTo(
      500 / EMPIRE_TUNING.SECONDS_PER_DAY,
      9,
    );
    // The level counter's two arms, driven so the directives above are about
    // values the subject really computes.
    expect(Number(wrongLevel)).toBe(0);
    expect(Number(alsoWrongLevel)).toBe(0);
    expect(settledLevel([asUnacceleratedSeconds(1000)], clock.unaccelerated)).toBe(1);
    // The two readings differ, so the refusals above are about a brand rather
    // than about two names for one number.
    expect(Number(clock.accelerated)).not.toBe(Number(clock.unaccelerated));
    // The directives themselves are graded by `tsc --noEmit`. What vitest can
    // redden for them is the DECLARATION, and that is the signature scan in
    // 'fences every branded quantity in its own declaration' below — it pins
    // `now: UnacceleratedSeconds` and the return brand for each function named
    // here, so widening either to `number` is red in vitest as well as in tsc.
  });

  it('refuses one tenure brand where the other is required — hazard 1’s derived quantity', () => {
    // The fence that was missing, and the one §5.2 actually needs. Tenure is
    // the word §5.2 uses for the Training IQ input, and it shipped as ONE brand
    // for both clocks — so the expression below compiled, with no cast, no `as`
    // and only exported API, carrying the purchased skip twice over: through
    // `now` and through `NpcLifter.joinedAt`. Hazard 2's derived quantity had
    // its own brand (`SettledLevel`) twelve lines away in the same file.
    //
    // The fixture is a lifter whose recruitment was skipped by a day: three
    // days of wall time, one day of purchased skip, so the lifter has been on
    // the roster four days and would have settled after one.
    const day = EMPIRE_TUNING.SECONDS_PER_DAY;
    const clock = createEmpireClock(day * 3, day);
    const lifter = createNpcLifter('a', 'novice', 'Placeholder', 0, day);

    // @ts-expect-error — an idle tenure is not what the trickle reads.
    const iqInput: SettledTenureDays = idleTenureDays(lifter, clock.accelerated);
    // @ts-expect-error — the sibling direction, applied mechanically.
    const bucksInput: IdleTenureDays = settledTenureDays(lifter, clock.unaccelerated);
    // @ts-expect-error — and the re-brand, which is how the raw-clock fence was
    // walked around before `Unbranded` landed. There is no `asSettledTenureDays`
    // to write the other direction with, which the constructor pin below
    // enforces by naming every `as*` this module exports.
    const rebranded = asIdleTenureDays(settledTenureDays(lifter, clock.unaccelerated));

    // The vitest half, and it is the decomposition rather than an inequality:
    // the gap between the two tenures is TWO days on a one-day purchase, one
    // from the clock the argument came off and one from the origin it was
    // measured against. That is what "carries the purchased skip twice" means,
    // in a number, and an engine that measured both from `joinedAt` or both on
    // one clock collapses it to one day or to zero.
    expect(Number(iqInput)).toBeCloseTo(4, 9);
    expect(Number(bucksInput)).toBeCloseTo(2, 9);
    const fromTheClock = Number(idleTenureDays(lifter, clock.accelerated)) -
      Number(idleTenureDays(lifter, asAcceleratedSeconds(day * 3)));
    const fromTheOrigin = Number(idleTenureDays(lifter, asAcceleratedSeconds(day * 3))) -
      Number(bucksInput);
    expect(fromTheClock).toBeCloseTo(1, 9);
    expect(fromTheOrigin).toBeCloseTo(1, 9);
    expect(fromTheClock + fromTheOrigin).toBeCloseTo(Number(iqInput) - Number(bucksInput), 9);
    expect(Number(rebranded)).toBe(Number(bucksInput));

    // And the seam itself, written out. E0 exports no Training IQ rate — that
    // is E1's — so the consumer is declared here in the shape E1 has to write
    // it, and the question the bar asks is put to the compiler directly: can a
    // legal expression built only from exported API let a purchasable
    // accelerant change Training IQ? The two lines below are the two ways it
    // could, and both are type errors.
    const trainingIqFor = (tenure: SettledTenureDays): number =>
      Number(tenure) * EMPIRE_TUNING.NPC_TRAINING_IQ_PER_DAY_BASE;
    // @ts-expect-error — the accelerated clock into the trickle, in one call.
    trainingIqFor(idleTenureDays(lifter, clock.accelerated));
    // @ts-expect-error — and a bare number, so the fence is not one spelling
    // wide.
    trainingIqFor(day * 4);
    // The legal call, so the refusals above are about the brand rather than
    // about the function refusing everything.
    expect(trainingIqFor(settledTenureDays(lifter, clock.unaccelerated))).toBeCloseTo(
      2 * EMPIRE_TUNING.NPC_TRAINING_IQ_PER_DAY_BASE,
      9,
    );
  });

  it('refuses a re-brand, which is how the argument list above was walked around', () => {
    // Every brand here IS its primitive, so `AcceleratedSeconds` is a `number`
    // and `asUnacceleratedSeconds` took a `number`. That made the fence in the
    // test above one call wide:
    //
    //     settledTenureDays(lifter, asUnacceleratedSeconds(clock.accelerated))
    //
    // compiled clean and fed the purchase-moved clock straight into the
    // Training IQ tenure term. It is a type error now, and so is every sibling
    // of it — the guard is one `Unbranded<N>` applied to every `as*`
    // constructor rather than to the one that was noticed.
    //
    // How many that is, is not asserted in a sentence here either. It was
    // asserted in one, in this comment and in `empireCore.ts`, and the sentence
    // said nine when there were eight. The constructor list is read out of the
    // source and pinned by name in 'fences every branded quantity in its own
    // declaration' below, which is also the line vitest reddens when
    // `Unbranded<N>` is dropped from one of them — the three assertions at the
    // bottom of this test are NOT that line. They state that the constructors
    // still mint the same value, which is true with the guard and without it.
    const clock = createEmpireClock(1000, 500);
    const lifter = createNpcLifter('a', 'novice', 'Placeholder', 0, 0);

    // @ts-expect-error — hazard 2 in one expression: an accelerated reading
    // re-branded as wall time.
    const laundered = asUnacceleratedSeconds(clock.accelerated);
    // @ts-expect-error — the sibling direction, applied mechanically.
    const alsoLaundered = asAcceleratedSeconds(clock.unaccelerated);
    // @ts-expect-error — and the string brand, so the ban is not numeric-only.
    const reIded = asNpcId(lifter.id);

    // Runtime: the constructors still mint, so these are the same numbers. The
    // refusal is entirely at the argument list, which is what makes it worth
    // asserting that they ARE the same numbers — a reader should not think the
    // ban is doing arithmetic. Read these three as documentation of what the
    // ban is not; the guard's own reddenable line is the constructor pin named
    // above.
    expect(Number(laundered)).toBe(Number(clock.accelerated));
    expect(Number(alsoLaundered)).toBe(Number(clock.unaccelerated));
    expect(String(reIded)).toBe(String(lifter.id));

    // The stated limit, driven rather than described: arithmetic launders, and
    // no signature can see it. This compiles, deliberately, and E6's
    // element-wise ledger comparison is what covers it.
    const throughArithmetic = asUnacceleratedSeconds(Number(clock.accelerated) + 0);
    expect(Number(throughArithmetic)).toBe(Number(clock.accelerated));
    expect(Number(throughArithmetic)).not.toBe(Number(clock.unaccelerated));
  });

  it('refuses every route the exploit reproduction took — the laundering regression', () => {
    // THE REPRODUCTION, KEPT. A working exploit lived in the tree as a scratch
    // file called `__exploitProbe.ts`, compiled clean, and was deleted when it
    // was fixed. A deleted reproduction protects nothing; this is it, moved
    // inside the suite so removing the `Unbranded` guard reddens something.
    //
    // It had three claims. Two are here as directives. The third was
    //
    //     physioDaysSavedFor(settledLevel([laundered], laundered))
    //
    // and it does NOT error any more — correctly, because `laundered` is
    // unobtainable now, so what closed is the SOURCE rather than the consumer.
    // Writing a bogus directive to make that line red would be an assertion
    // about nothing; the true statement is 'no exported function that produces
    // a wall-clock brand accepts an accelerated one', and it is measured over
    // the whole module by 'closes the laundering SOURCE' below.
    const day = EMPIRE_TUNING.SECONDS_PER_DAY;
    const clock = createEmpireClock(day * 3, day);

    // @ts-expect-error — route 1: the clock's own accelerated reading fed back
    // into the clock constructor, which handed it straight back wearing the
    // wall-clock brand. Hazard 1 and hazard 2 both, in one expression, with no
    // cast and only exported API.
    const launderedClock = createEmpireClock(clock.accelerated, 0);

    // ONE FAILED CALL REPORTS ONE ARGUMENT ERROR, so the two roster slots get
    // one call each. Written as a single five-argument call with a directive on
    // each of the last two, the second directive is UNUSED and `tsc` fails with
    // TS2578 — which is the right answer to the wrong question, and would have
    // been tempting to fix by deleting the sibling directive rather than by
    // giving the sibling its own call. That is the same "one arm of one
    // decision" shape this file keeps finding.
    // @ts-expect-error — route 2, the reproduction's own spelling: `joinedAt`
    // taking the wall reading. Semantically it is the harmless direction —
    // `NpcLifter.joinedAt` IS an `AcceleratedSeconds` — and it is refused
    // anyway, because the rule is about the parameter and not about which
    // laundering somebody has thought of.
    const launderedJoin = createNpcLifter('b', 'novice', 'Placeholder', clock.unaccelerated, day * 3);
    // @ts-expect-error — route 3, and the one that sells training pace:
    // `settledAt` taking the purchase-moved reading. That is the origin
    // `settledTenureDays` measures the Training IQ tenure from.
    const launderedLifter = createNpcLifter('c', 'novice', 'Placeholder', day * 4, clock.accelerated);

    // The vitest half, and it is the size of the sale rather than a `typeof`.
    // Types are erased, so all three calls still RUN — which is what makes the
    // numbers below the honest statement of what each route was worth.
    //
    // Route 1: the wall clock came back a whole day of purchased skip ahead of
    // the wall clock it was derived from.
    expect(Number(launderedClock.unaccelerated)).toBe(Number(clock.accelerated));
    expect(Number(launderedClock.unaccelerated) - Number(clock.unaccelerated)).toBe(day);

    // Routes 2 and 3, each against an honest twin built from the same two
    // moments: the recruit landed on day four and would have landed unaided on
    // day three.
    const honestLifter = createNpcLifter('d', 'novice', 'Placeholder', day * 4, day * 3);
    expect(
      Number(idleTenureDays(launderedJoin, clock.accelerated)) -
        Number(idleTenureDays(honestLifter, clock.accelerated)),
    ).toBeCloseTo(1, 9);
    const now = asUnacceleratedSeconds(day * 5);
    expect(
      Number(settledTenureDays(honestLifter, now)) -
        Number(settledTenureDays(launderedLifter, now)),
    ).toBeCloseTo(1, 9);
    expect(Number(settledTenureDays(honestLifter, now))).toBeCloseTo(2, 9);
    expect(Number(settledTenureDays(launderedLifter, now))).toBeCloseTo(1, 9);
  });

  it('refuses a bare number where a settled level is required', () => {
    // Whole days, because `asInjuryDaysSaved` refuses a fraction at the seam —
    // the sibling probe below really is evaluated rather than short-circuited
    // by a throw.
    const day = EMPIRE_TUNING.SECONDS_PER_DAY;
    const clock = createEmpireClock(day * 2, day);
    const lifter = createNpcLifter('a', 'novice', 'Placeholder', 0, 0);
    // @ts-expect-error — `physioDaysSavedFor` takes a SettledLevel, which only
    // `settledLevel` produces and which only UnacceleratedSeconds reach.
    const wrong = physioDaysSavedFor(1);
    // @ts-expect-error — the sibling quantity, checked rather than trusted to
    // follow: the two derived brands are not interchangeable with each other
    // either, so an idle tenure cannot stand in for a settled level.
    const alsoWrong = physioDaysSavedFor(idleTenureDays(lifter, clock.accelerated));

    // This line used to be `expect(typeof wrong).toBe('number')`, which is true
    // of every version of `physioDaysSavedFor` — it returns a number whether it
    // is declared to take a `SettledLevel` or a `number`, so the named subject
    // edit could not redden it. What vitest can grade here is the VALUE the
    // brand carries: a level of 1 buys exactly the table's per-level saving,
    // capped, and that is a fact about the tuning the fence protects.
    const oneLevel = settledLevel([asUnacceleratedSeconds(0)], asUnacceleratedSeconds(1));
    expect(Number(wrong)).toBe(
      Math.min(
        EMPIRE_TUNING.PHYSIO_MAX_DAYS_SAVED,
        EMPIRE_TUNING.PHYSIO_DAYS_SAVED_PER_STAFF_LEVEL,
      ),
    );
    expect(Number(wrong)).toBe(Number(physioDaysSavedFor(oneLevel)));
    expect(Number(alsoWrong)).toBe(EMPIRE_TUNING.PHYSIO_MAX_DAYS_SAVED);
    // The declaration itself — `level: SettledLevel`, not `level: number` — is
    // pinned by the signature scan in 'fences every branded quantity in its own
    // declaration', which is the line vitest reddens when this directive stops
    // being a directive.
  });
});

// ---------------------------------------------------------------------------
// The census, run against the shipped module
// ---------------------------------------------------------------------------

describe('the producer census, scoped by return type and resolved through the checker', () => {
  it('finds every exported producer of a brand, and says how much it looked at', () => {
    const census = brandCensus();

    // Non-vacuity first, and it is the whole reason this test can be trusted:
    // if the probe module stopped compiling for a reason unrelated to a brand —
    // a wrong argument count, a renamed export, a broken host — every probe
    // would be refused and every slot would read "admits nothing", which is the
    // shape a laundering route hides in. The all-`never` control call proves
    // each function is callable at all, and `never` is assignable to every
    // parameter type there is, so a control that fails means the harness is
    // wrong rather than the subject.
    expect(census.controlFailures).toEqual([]);
    expect(census.coreDiagnostics).toEqual([]);
    // AND THE TYPE WALK'S OWN TERMINAL ARM. `brandsIn` had four flag arms and no
    // final branch, so a type kind outside them made a brand under it invisible
    // and `produces` came back short — which reads exactly like a function that
    // produces nothing. Empty on this tree, in both directions, with the type
    // named in the message when it is not.
    expect(census.unwalkedTypes, census.unwalkedTypes.join(' | ')).toEqual([]);
    // 930 rather than 914 since `refuseWith` arrived, and the sixteen are
    // derived rather than read off a diff: one control plus one slot times two
    // raw candidates and thirteen brands.
    expect(census.probes).toBe(930);
    // Counts, not bounds, on both verdicts. All-accepted and all-refused are
    // the two degenerate states, and each is a number away rather than a bound
    // away.
    //
    // The wrap's ten refusals are derived the same way: `message: string`
    // refuses `RAW_NUMBER` and the nine brands over `number`, and accepts the
    // control, `RAW_STRING` and the four brands over `string`.
    expect(census.refusedProbes).toBe(793);
    expect(census.probes - census.refusedProbes).toBe(137);

    // The brands, from the declarations rather than from a list written here.
    expect(census.brands).toEqual([
      'AcceleratedSeconds',
      'DisplayName',
      'FaultMessage',
      'GymBucks',
      'GymId',
      'IdleTenureDays',
      'InjuryDaysSaved',
      'NpcId',
      'ReputationPoints',
      'SettledLevel',
      'SettledTenureDays',
      'TrainingIqPoints',
      'UnacceleratedSeconds',
    ]);

    expect(census.functions.length).toBe(45);
    expect(census.slots.length).toBe(59);

    // The producers, by name. `createEmpireClock` and `createNpcLifter` are on
    // this list and are not spelled `as*`, which is the whole difference
    // between this census and the one it replaced.
    expect(producers(census).map((fn) => fn.name)).toEqual([
      'applyAccelerant',
      'asAcceleratedSeconds',
      'asDisplayName',
      'asFaultMessage',
      'asGymBucks',
      'asGymId',
      'asIdleTenureDays',
      'asInjuryDaysSaved',
      'asNpcId',
      'asReputation',
      'asTrainingIq',
      'asUnacceleratedSeconds',
      'createEmpireClock',
      'createEmpireState',
      'createNpcLifter',
      'elapsedFor',
      // The two `*Faults` functions are producers now: they return
      // `readonly FaultMessage[]`, and the census asks the checker what a
      // function RETURNS rather than what it is called. That is the census
      // working — a brand arriving inside an array is exactly the nesting the
      // name-based version it replaced could not see.
      'empireStateFaults',
      'empireVocabularyFaults',
      'equipmentTierCost',
      'gateElapsedFor',
      'idleLedger',
      'idleTenureDays',
      'physioDaysSavedFor',
      'progressionLedger',
      'recruitCost',
      'recruitReputationThreshold',
      'settledLevel',
      'settledTenureDays',
      'spaceLevelCost',
      'staffLevelCost',
    ]);

    // Every `as*` export is a producer and the list is closed. This is the
    // clause `SettledTenureDays`'s own docstring depends on: there is no
    // `asSettledTenureDays`, so a caller holding a tenure measured on the
    // accelerated clock has no one-call route to the wall-clock brand.
    expect(
      census.functions.filter((fn) => /^as[A-Z]/.test(fn.name)).map((fn) => fn.name),
    ).toEqual([
      'asAcceleratedSeconds',
      'asDisplayName',
      'asFaultMessage',
      'asGymBucks',
      'asGymId',
      'asIdleTenureDays',
      'asInjuryDaysSaved',
      'asNpcId',
      'asReputation',
      'asTrainingIq',
      'asUnacceleratedSeconds',
    ]);

    // How the slots landed, counted per class. `raw-only` is the guarded set —
    // dropping `Unbranded<N>` from any one of them moves it to `both`, which is
    // red twice: here and on the fault list in the next test.
    const tally = new Map<SlotKind, number>();
    for (const slot of census.slots) tally.set(slot.kind, (tally.get(slot.kind) ?? 0) + 1);
    expect(tally.get('raw-only')).toBe(21);
    expect(tally.get('brand-only')).toBe(6);
    expect(tally.get('neither')).toBe(27);
    expect(tally.get('both')).toBe(5);
    expect([...tally.values()].reduce((total, n) => total + n, 0)).toBe(census.slots.length);
  });

  it('lets no producer take a parameter that also admits an already-branded value', () => {
    // THE RULE, and it is about the parameter rather than the name: a function
    // that produces a branded quantity may not have a parameter that accepts a
    // bare primitive AND a value that already carries a brand. That is the
    // shape `createEmpireClock(clock.accelerated, 0).unaccelerated` was — a
    // wall-clock brand handed back over a purchase-moved reading, with no cast
    // and only exported API.
    const census = brandCensus();
    const faults = producers(census)
      .flatMap((fn) => fn.slots)
      .filter((slot) => slot.kind === 'both')
      .map((slot) => `${slot.fn}(${slot.parameter}) admits ${slot.acceptsBrands.join(', ')}`);
    expect(faults).toEqual([]);

    // The complement, pinned so the zero above is zero against something. Five
    // slots in the module do admit both, and the sentence that used to sit here
    // said all of them were decode predicates taking `unknown` on purpose — the
    // wire has no types, and a narrowing function that refused a branded value
    // would refuse the values this module's own constructors hand back. That is
    // still true of the first four and is now false of the list, so it is
    // corrected rather than left reading as a description of all of them.
    //
    // The fifth is `refuseWith`, the throw wrap. Its parameter is a message
    // rather than a quantity, and `Unbranded<S>` was considered there and left
    // off deliberately: `assertEmpireState` throws prose built out of
    // `FaultMessage`s, so refusing an already-branded string would refuse a
    // legitimate site to buy nothing — the rule this test enforces is about a
    // PRODUCER's parameter, and the line below is what says the wrap is not one.
    expect(
      census.slots
        .filter((slot) => slot.kind === 'both')
        .map((slot) => `${slot.fn}(${slot.parameter})`),
    ).toEqual([
      'isEmpireAccelerant(value)',
      'isEmpireOutput(value)',
      'isProgressionReachingOutput(value)',
      'isPurchasableAccelerant(value)',
      'refuseWith(message)',
    ]);
    // And none of those five is a producer, so the exemption is a fact about
    // the census rather than a hole punched in it. `refuseWith` returns `never`
    // and therefore produces nothing at all, which is why it does not appear in
    // `producers(census)` — checked by the emptiness above rather than asserted.
    expect(
      producers(census).filter((fn) => /^is[A-Z]/.test(fn.name)).length,
    ).toBe(0);
  });

  it('closes the laundering SOURCE: no wall-clock producer accepts an accelerated reading', () => {
    // The third claim of the salvaged exploit probe, stated the way it is now
    // true. `physioDaysSavedFor(settledLevel([laundered], laundered))` does not
    // error any more, and that is correct rather than a regression: its input
    // is unobtainable, so the source is closed instead of the consumer. The
    // honest assertion is therefore about the source.
    //
    // WALL_CLOCK is the progression-reaching side of the split — the raw wall
    // clock and the three quantities derived from it — and ACCELERATED is the
    // side a purchase moves. A function that emits one of the first while
    // accepting one of the second is the two-hop sale in one signature,
    // whatever it is called and whatever it does inside.
    const WALL_CLOCK: readonly string[] = [
      'UnacceleratedSeconds',
      'SettledTenureDays',
      'SettledLevel',
      'InjuryDaysSaved',
      // `elapsedFor`'s return is a conditional over its output parameter, and
      // one arm of it is the wall clock. Named here so the function is inside
      // the rule rather than outside it on a technicality of spelling.
      'ElapsedFor<O>',
    ];
    const ACCELERATED: readonly string[] = ['AcceleratedSeconds', 'IdleTenureDays'];

    const census = brandCensus();
    const wallClockProducers = census.functions.filter((fn) =>
      fn.produces.some((brand) => WALL_CLOCK.includes(brand)),
    );
    expect(wallClockProducers.map((fn) => fn.name)).toEqual([
      'applyAccelerant',
      'asInjuryDaysSaved',
      'asUnacceleratedSeconds',
      'createEmpireClock',
      'createEmpireState',
      'createNpcLifter',
      'elapsedFor',
      // Piece E6's gate clock. It returns `UnacceleratedSeconds` as a
      // consequence of `GATE_TARGET` being typed against
      // `ProgressionReachingOutput`, so it is a wall-clock producer and belongs
      // inside this rule rather than outside it.
      'gateElapsedFor',
      'idleLedger',
      'physioDaysSavedFor',
      'progressionLedger',
      'settledLevel',
      'settledTenureDays',
    ]);

    let checked = 0;
    const routes: string[] = [];
    for (const fn of wallClockProducers) {
      for (const slot of fn.slots) {
        for (const accelerated of ACCELERATED) {
          checked += 1;
          if (slot.acceptsBrands.includes(accelerated)) {
            routes.push(`${fn.name}(${slot.parameter}) accepts ${accelerated}`);
          }
        }
      }
    }
    expect(routes).toEqual([]);
    // Counts, not bounds: how many (producer, slot, accelerated brand) triples
    // were actually driven. A wall-clock producer that lost its parameters, or
    // a WALL_CLOCK list that stopped matching any brand the module declares,
    // would make the zero above a zero over an empty domain.
    expect(wallClockProducers.length).toBe(13);
    expect(checked).toBe(48);
    // And the brand names this test routes on are real brands, resolved by the
    // census rather than spelled here and hoped for. `ElapsedFor<O>` is a
    // conditional and is excluded from that check by construction, so it is
    // held by the producer pin above instead.
    for (const brand of [...WALL_CLOCK.filter((name) => !name.includes('<')), ...ACCELERATED]) {
      expect(census.brands, `${brand} is not a brand this module declares`).toContain(brand);
    }
  });
});

// ---------------------------------------------------------------------------
// The four tables
// ---------------------------------------------------------------------------

describe('the reach and licence tables are exhaustive and cannot disagree', () => {
  it('gives every output a sink and every sink a reach', () => {
    expect(Object.keys(OUTPUT_SINK).sort()).toEqual([...EMPIRE_OUTPUTS].sort());
    expect(Object.keys(SINK_REACH).sort()).toEqual([...OUTPUT_SINKS].sort());
    for (const output of EMPIRE_OUTPUTS) {
      expect(OUTPUT_SINKS).toContain(OUTPUT_SINK[output]);
    }
    for (const sink of OUTPUT_SINKS) {
      expect(OUTPUT_REACHES).toContain(SINK_REACH[sink]);
    }
    // This line was `expect(EMPIRE_OUTPUT_REACH_IS_A_PARTITION).toBe(true)`.
    // That constant is the literal `true` and its type is a tautology by
    // construction — `ProgressionReachingOutput` is defined as an `Exclude`, so
    // both `extends [never]` branches resolve whatever the tables say. Flipping
    // `SINK_REACH['training-pace']` to `'idle-only'`, the single edit
    // `empireCore.ts` itself calls out as the one that opens both hazards, left
    // it green in vitest AND in tsc.
    //
    // What reddens on that edit is membership, so membership is what is pinned.
    // It is the derived lists that are pinned, not a second source of truth:
    // `IdleOnlyOutput` is still the mapped filter and nothing reads these.
    expect([...PROGRESSION_REACHING_OUTPUTS].sort()).toEqual([
      'physio-days-saved',
      'training-iq',
    ]);
    expect([...IDLE_ONLY_OUTPUTS].sort()).toEqual([
      'cosmetic-unlock',
      'gym-bucks',
      'reputation',
      'roster-slot',
    ]);
    expect(empireVocabularyFaults()).toEqual([]);
  });

  it('gives every accelerant an arrival and every arrival a licence', () => {
    expect(Object.keys(ACCELERANT_ARRIVAL).sort()).toEqual([...EMPIRE_ACCELERANTS].sort());
    expect(Object.keys(ARRIVAL_LICENCE).sort()).toEqual([...ACCELERANT_ARRIVALS].sort());
    for (const accelerant of EMPIRE_ACCELERANTS) {
      expect(ACCELERANT_ARRIVALS).toContain(ACCELERANT_ARRIVAL[accelerant]);
    }
    for (const arrival of ACCELERANT_ARRIVALS) {
      const licence = ARRIVAL_LICENCE[arrival];
      expect(licence.length, `${arrival} licenses nothing`).toBeGreaterThan(0);
      for (const reach of licence) expect(OUTPUT_REACHES).toContain(reach);
    }
    // The branch immediately below the one above, and it was written the same
    // way and was vacuous for the same reason. `EarnedAccelerant` is an
    // `Exclude`, so re-tagging the sold skip as `'gym-progress'` — which is
    // precisely how §12.3's first refusal condition would ship — moved a member
    // from one half to the other and left the partition, and the assertion that
    // used to be here, perfectly green.
    expect([...PURCHASABLE_ACCELERANTS].sort()).toEqual([
      'gym-empire-timer-skip',
      'rewarded-ad-timer-skip',
    ]);
    expect([...EARNED_ACCELERANTS].sort()).toEqual([
      'coach-staff-level',
      'reputation-tier',
      'space-level',
    ]);
  });

  it('publishes what each arrival is licensed to touch, by name', () => {
    // The licence table read through the helper the runtime uses. Adding
    // `'progression-reaching'` to the `'store-purchase'` row — the one-word
    // edit `empireCore.ts` is arranged around — reddens the first two lines.
    expect([...accelerantLicence('gym-empire-timer-skip')]).toEqual(['idle-only']);
    expect([...accelerantLicence('rewarded-ad-timer-skip')]).toEqual(['idle-only']);
    expect([...accelerantLicence('coach-staff-level')].sort()).toEqual([
      'idle-only',
      'progression-reaching',
    ]);
  });

  it('makes hazard 1 and hazard 2 one row, not two', () => {
    // The runtime shadow of the header's §2. Both progression-reaching outputs
    // share a sink, so re-tagging that sink is the single edit that opens or
    // closes both, and there is no per-output verdict anywhere for two people
    // to decide differently.
    expect(OUTPUT_SINK['training-iq']).toBe(OUTPUT_SINK['physio-days-saved']);
    const onTrainingPace = EMPIRE_OUTPUTS.filter(
      (output) => OUTPUT_SINK[output] === 'training-pace',
    );
    // Counts, not bounds — this file's own rule, applied to the two lines that
    // were written as bounds. "Closing one closes both" is about exactly two
    // things on each axis, and a third arriving is a decision somebody signs.
    expect(onTrainingPace.length).toBe(2);
    expect(onTrainingPace).toContain('training-iq');
    expect(onTrainingPace).toContain('physio-days-saved');
    // And the same for the two purchased accelerants.
    expect(ACCELERANT_ARRIVAL['gym-empire-timer-skip']).toBe(
      ACCELERANT_ARRIVAL['rewarded-ad-timer-skip'],
    );
    expect(PURCHASABLE_ACCELERANTS.length).toBe(2);
  });

  it('partitions both axes, and no half is empty', () => {
    // The anti-vacuity that matters most here. A licence whose banned side is
    // empty bans nothing and passes every other test in this file; one whose
    // allowed side is empty is the over-broad fix that deletes §5.2's whole
    // connection to Sim progression. Both are failures.
    expect(PROGRESSION_REACHING_OUTPUTS.length, 'nothing is protected').toBeGreaterThan(0);
    expect(IDLE_ONLY_OUTPUTS.length, 'a purchase may touch nothing at all').toBeGreaterThan(0);
    expect([...IDLE_ONLY_OUTPUTS, ...PROGRESSION_REACHING_OUTPUTS].sort()).toEqual(
      [...EMPIRE_OUTPUTS].sort(),
    );
    expect(PURCHASABLE_ACCELERANTS.length, 'nothing is sold, so nothing is gated').toBeGreaterThan(
      0,
    );
    expect(EARNED_ACCELERANTS.length, 'nothing is earned, so §5.2 pays nothing').toBeGreaterThan(0);
    expect([...PURCHASABLE_ACCELERANTS, ...EARNED_ACCELERANTS].sort()).toEqual(
      [...EMPIRE_ACCELERANTS].sort(),
    );
    for (const accelerant of PURCHASABLE_ACCELERANTS) {
      expect(EARNED_ACCELERANTS).not.toContain(accelerant);
    }
  });

  it('walks the whole cross product rather than the pairs somebody thought of', () => {
    // The oracle here used to be
    //
    //     accelerantLicence(accelerant).includes(outputReach(output))
    //
    // which is `mayAccelerate`'s body character for character. No edit to any
    // of the four tables could make the two sides disagree, because both sides
    // were the same two lookups; only an edit to `mayAccelerate` itself
    // reddened it, and `mayAccelerate` is not the subject the §12.3 guarantee
    // is about. The whole test was carried by the count pins at the bottom.
    //
    // The oracle below states the RULE instead: a purchase may not touch
    // anything that reaches Sim progression. It reads `ACCELERANT_ARRIVAL` and
    // the sink tables and does NOT read `ARRIVAL_LICENCE`, so widening the
    // store-purchase licence — the §12.3 edit — makes the two sides disagree
    // on four pairs and this goes red.
    //
    // What it is blind to, stated rather than left for the next reader: an
    // edit to `SINK_REACH` moves both sides together, because both ask what an
    // output reaches. That edit is caught by the membership pin two tests
    // above, and by nothing here.
    let refused = 0;
    let allowed = 0;
    for (const accelerant of EMPIRE_ACCELERANTS) {
      for (const output of EMPIRE_OUTPUTS) {
        const banned = isPurchasableAccelerant(accelerant) && isProgressionReachingOutput(output);
        expect(mayAccelerate(accelerant, output), `${accelerant} -> ${output}`).toBe(!banned);
        if (banned) refused += 1;
        else allowed += 1;
      }
    }
    // Counts, not bounds, so an empty domain reports itself. Five accelerants
    // by six outputs is thirty pairs; two purchased accelerants against two
    // progression-reaching outputs is the four that are refused.
    expect(allowed + refused).toBe(EMPIRE_ACCELERANTS.length * EMPIRE_OUTPUTS.length);
    expect(refused).toBe(4);
    expect(allowed).toBe(26);
  });

  it('refuses every purchased accelerant on every progression-reaching output', () => {
    // The branch immediately below the one whose oracle was just rewritten,
    // and it had the same shape of hole: two nested loops with no count on
    // either, so emptying `PROGRESSION_REACHING_OUTPUTS` would have made the
    // inner one walk nothing and pass.
    let bannedPairs = 0;
    let stillSellable = 0;
    for (const accelerant of PURCHASABLE_ACCELERANTS) {
      for (const output of PROGRESSION_REACHING_OUTPUTS) {
        expect(mayAccelerate(accelerant, output), `${accelerant} -> ${output}`).toBe(false);
        bannedPairs += 1;
      }
      // And it may still touch the idle economy, so the sale is a real sale.
      expect(
        IDLE_ONLY_OUTPUTS.every((output) => mayAccelerate(accelerant, output)),
        `${accelerant} may accelerate nothing at all`,
      ).toBe(true);
      stillSellable += 1;
    }
    expect(bannedPairs).toBe(4);
    expect(stillSellable).toBe(2);
  });

  it('names no forbidden output among the payable ones', () => {
    // This line was `expect(EMPIRE_PAYS_NO_FORBIDDEN_OUTPUT).toBe(true)`. That
    // constant is declared FROM the literal `true`, so under vitest no state of
    // the tables changed what it read — it does bite under `tsc --noEmit`, and
    // it reads here as a fourth independent runtime check that it never was.
    // `empireVocabularyFaults` walks the same claim off the tables, and the
    // loop below is the other honest half.
    expect(empireVocabularyFaults()).toEqual([]);
    // Named rather than absent: GDD §8.3E's condition 3 rules out "true by the
    // current absence of a code path", and §8.2's own history is that a tender
    // list kept achievement Chalk out by having no word for it.
    expect(EMPIRE_FORBIDDEN_OUTPUTS).toContain('covered-day');
    expect(EMPIRE_FORBIDDEN_OUTPUTS).toContain('chalk');
    // Counts, not bounds — the sibling correction, applied to the line that
    // guarded this loop's domain with `toBeGreaterThan(0)`.
    expect([...EMPIRE_FORBIDDEN_OUTPUTS].sort()).toEqual([
      'chalk',
      'competition-total',
      'covered-day',
      'e1rm',
    ]);
    let walked = 0;
    for (const forbidden of EMPIRE_FORBIDDEN_OUTPUTS) {
      expect(EMPIRE_OUTPUTS as readonly string[], forbidden).not.toContain(forbidden);
      expect(isEmpireOutput(forbidden), `${forbidden} decoded as a payable output`).toBe(false);
      walked += 1;
    }
    expect(walked).toBe(4);
  });

  it('lets a name mislead nobody — the sink is what decides it', () => {
    // A floor under the tables, and stated as a floor. An output called
    // `'gym-sparkles'` that secretly wrote Training IQ satisfies this, and the
    // thing that catches THAT is having to write a sink next to it. What this
    // catches is the copy-paste: adding `'training-iq-bonus'` and leaving the
    // sink on `'gym-economy'` because the line above said so.
    for (const output of EMPIRE_OUTPUTS) {
      if (/iq|physio|injury|e1rm|total|pace/i.test(output)) {
        expect(OUTPUT_SINK[output], `${output} names something Sim progression reads`).toBe(
          'training-pace',
        );
      }
    }
    // And the scan is not matching nothing.
    expect(
      EMPIRE_OUTPUTS.some((output) => /iq|physio/i.test(output)),
      'no output name trips the scan, so the loop above proves nothing',
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The runtime guards, for callers the compiler never sees
// ---------------------------------------------------------------------------

describe('the runtime predicates refuse what the types refuse', () => {
  it('agrees with the tables on every member', () => {
    // The oracles here were `outputReach(output) === 'progression-reaching'`
    // and `ACCELERANT_ARRIVAL[accelerant] === 'store-purchase'` — which are the
    // two predicates' own bodies, character for character. No edit to any of
    // the four tables could make either side disagree with the other, because
    // both sides performed the identical lookup. That is the defect
    // `empireCore.ts` says was removed from the cross product, left standing in
    // the describe block immediately below it.
    //
    // The oracle is the PIN instead — the same two membership lists the four
    // tables are pinned against above, restated as a predicate. Re-tagging
    // `'training-pace'` as `'idle-only'`, or the sold skip as
    // `'gym-progress'`, now makes the two sides disagree instead of moving
    // them together.
    let outputsWalked = 0;
    let reaching = 0;
    for (const output of EMPIRE_OUTPUTS) {
      expect(isEmpireOutput(output)).toBe(true);
      const pinned = output === 'training-iq' || output === 'physio-days-saved';
      expect(isProgressionReachingOutput(output), output).toBe(pinned);
      if (pinned) reaching += 1;
      outputsWalked += 1;
    }
    let accelerantsWalked = 0;
    let purchasable = 0;
    for (const accelerant of EMPIRE_ACCELERANTS) {
      expect(isEmpireAccelerant(accelerant)).toBe(true);
      const pinned =
        accelerant === 'gym-empire-timer-skip' || accelerant === 'rewarded-ad-timer-skip';
      expect(isPurchasableAccelerant(accelerant), accelerant).toBe(pinned);
      if (pinned) purchasable += 1;
      accelerantsWalked += 1;
    }
    // Counts, not bounds, on both halves of the domain and on both verdicts.
    expect(outputsWalked).toBe(6);
    expect(reaching).toBe(2);
    expect(accelerantsWalked).toBe(5);
    expect(purchasable).toBe(2);
  });

  it('refuses wire garbage, including the words the empire may not pay in', () => {
    const garbage: readonly unknown[] = [
      'covered-day',
      'chalk',
      'e1rm',
      'competition-total',
      'timer-skip',
      '',
      null,
      undefined,
      42,
      { output: 'gym-bucks' },
      ['gym-bucks'],
      'GYM-BUCKS',
    ];
    let refusals = 0;
    for (const value of garbage) {
      expect(isEmpireOutput(value), `${String(value)} is not an output`).toBe(false);
      expect(isEmpireAccelerant(value), `${String(value)} is not an accelerant`).toBe(false);
      expect(isPurchasableAccelerant(value), `${String(value)} is not purchasable`).toBe(false);
      expect(isProgressionReachingOutput(value), `${String(value)} reaches nothing`).toBe(false);
      // `mayAccelerate` on the same garbage, on BOTH arguments, because its own
      // docstring says it is the one for callers the compiler never saw and it
      // went straight to two table lookups: an unknown accelerant made
      // `accelerantLicence` return undefined and the `.includes` beneath it
      // threw a TypeError. It answers rather than throwing now, and the answer
      // is no.
      expect(
        () => mayAccelerate(value as EmpireAccelerant, 'gym-bucks'),
        `${String(value)} threw instead of answering`,
      ).not.toThrow();
      expect(mayAccelerate(value as EmpireAccelerant, 'gym-bucks')).toBe(false);
      expect(mayAccelerate('coach-staff-level', value as EmpireOutput)).toBe(false);
      refusals += 1;
    }
    // Counts, not bounds. And the refusals above are refusals of the VALUE
    // rather than of everything: the same earned accelerant on a real output is
    // allowed, including on the progression-reaching one §5.2 asks for.
    expect(refusals).toBe(garbage.length);
    expect(refusals).toBe(12);
    expect(mayAccelerate('coach-staff-level', 'training-iq')).toBe(true);
    expect(mayAccelerate('coach-staff-level', 'gym-bucks')).toBe(true);
  });

  it('derives its published lists rather than re-listing them', () => {
    // Four loops with no count of their own: if all four lists went empty,
    // every loop below would walk nothing and this test would pass. The counts
    // are pinned in a different `it(` two describes up, which is exactly the
    // "a witness proves one assertion, not the others in the same test" gap —
    // so each loop counts what it actually walked, here, beside itself.
    let idle = 0;
    let reaching = 0;
    let purchasable = 0;
    let earned = 0;
    for (const output of IDLE_ONLY_OUTPUTS) {
      expect(isProgressionReachingOutput(output), output).toBe(false);
      idle += 1;
    }
    for (const output of PROGRESSION_REACHING_OUTPUTS) {
      expect(isProgressionReachingOutput(output), output).toBe(true);
      reaching += 1;
    }
    for (const accelerant of PURCHASABLE_ACCELERANTS) {
      expect(isPurchasableAccelerant(accelerant), accelerant).toBe(true);
      purchasable += 1;
    }
    for (const accelerant of EARNED_ACCELERANTS) {
      expect(isPurchasableAccelerant(accelerant), accelerant).toBe(false);
      earned += 1;
    }
    expect(idle).toBe(4);
    expect(reaching).toBe(2);
    expect(purchasable).toBe(2);
    expect(earned).toBe(3);
    // And the two axes are covered exactly once each, so a list that had gone
    // empty is red on the count above and on the total here.
    expect(idle + reaching).toBe(EMPIRE_OUTPUTS.length);
    expect(purchasable + earned).toBe(EMPIRE_ACCELERANTS.length);
  });
});

// ---------------------------------------------------------------------------
// The clock split
// ---------------------------------------------------------------------------

describe('the clock split', () => {
  it('leaves the wall clock a function of wall time alone', () => {
    // The property piece E6's sweep is the horizon-wide version of. Here it is
    // the local statement: whatever is skipped, the un-accelerated reading is
    // the elapsed seconds it was given.
    //
    // WHAT THIS SWEEP'S DOMAIN IS, because it was overstated. The generator
    // emits raw numeric literals, so the only laundering it can express is
    // "pass a bigger number" — it cannot produce `createEmpireClock(
    // clock.accelerated, 0)`, which is the route that actually reopened the
    // hazard, because that route is a TYPE error and cannot appear in a passing
    // test at all. It is asserted where it can be: with a directive, in
    // 'refuses every route the exploit reproduction took' above.
    //
    // Of the two counters that used to sit at the bottom, `pairsWithASkip`
    // counted the literals in the generator — no state of `empireCore.ts` moved
    // it — and reported the sweep as full while the case it was standing guard
    // over was outside the domain entirely. It is replaced by a count of what
    // the SUBJECT produced.
    const readingsByElapsed = new Map<number, Set<number>>();
    let pairs = 0;
    let pairsWhereTheClocksDiffer = 0;
    for (const elapsed of [0, 1, 60, 3600, 86400, 604800]) {
      for (const skipped of [0, 1, 3600, 86400]) {
        const clock = createEmpireClock(elapsed, skipped);
        expect(clock.unaccelerated, `elapsed ${elapsed}, skipped ${skipped}`).toBe(elapsed);
        expect(clock.accelerated).toBe(elapsed + skipped);
        const readings = readingsByElapsed.get(elapsed) ?? new Set<number>();
        readings.add(Number(clock.unaccelerated));
        readingsByElapsed.set(elapsed, readings);
        pairs += 1;
        if (Number(clock.accelerated) !== Number(clock.unaccelerated)) {
          pairsWhereTheClocksDiffer += 1;
        }
      }
    }
    // The claim in the title, as a fact about the OUTPUT: across every skip
    // offered for one wall time, the wall clock took exactly one value. An
    // implementation that let any of the skip into it — `elapsed + skipped`,
    // `elapsed + skipped / 2`, a clamp — gives four readings for one elapsed
    // and this goes red without depending on the equality above.
    for (const [elapsed, readings] of readingsByElapsed) {
      expect(readings.size, `wall time ${elapsed} produced ${readings.size} wall clocks`).toBe(1);
    }
    // Counts rather than bounds, and both of these move with the subject. The
    // second in particular is what says the domain is not degenerate: an engine
    // that ignored `skippedSeconds` outright would satisfy every assertion
    // above and drop this to zero.
    expect(readingsByElapsed.size).toBe(6);
    expect(pairs).toBe(24);
    expect(pairsWhereTheClocksDiffer).toBe(18);
  });

  it('hands each output the clock its reach entitles it to, on both arms', () => {
    const clock = createEmpireClock(1000, 500);
    // The two readings differ, so an implementation that returned the same one
    // for both arms is visible. Without this the check below is one number
    // compared with itself.
    expect(Number(clock.accelerated)).not.toBe(Number(clock.unaccelerated));

    let progressionArm = 0;
    let idleArm = 0;
    for (const output of EMPIRE_OUTPUTS) {
      const elapsed = elapsedFor(clock, output);
      if (outputReach(output) === 'progression-reaching') {
        expect(elapsed, `${output} read the accelerated clock`).toBe(clock.unaccelerated);
        progressionArm += 1;
      } else {
        expect(elapsed, `${output} read the wall clock`).toBe(clock.accelerated);
        idleArm += 1;
      }
    }
    // Both arms were driven, and by how many outputs each.
    expect(progressionArm).toBe(2);
    expect(idleArm).toBe(4);
  });

  it('counts settled levels on the wall clock and nothing else', () => {
    const completions: readonly UnacceleratedSeconds[] = [100, 200, 300].map(
      asUnacceleratedSeconds,
    );
    expect(settledLevel(completions, asUnacceleratedSeconds(0))).toBe(0);
    expect(settledLevel(completions, asUnacceleratedSeconds(100))).toBe(1);
    expect(settledLevel(completions, asUnacceleratedSeconds(250))).toBe(2);
    expect(settledLevel(completions, asUnacceleratedSeconds(10000))).toBe(3);
    expect(settledLevel([], asUnacceleratedSeconds(10000))).toBe(0);
  });

  it('measures a lifter’s two tenures from its two arrival times', () => {
    const day = EMPIRE_TUNING.SECONDS_PER_DAY;
    // A lifter whose recruitment was skipped: on the roster a day early.
    const lifter = createNpcLifter('a', 'club', 'Placeholder', 0, day);
    expect(idleTenureDays(lifter, asAcceleratedSeconds(day))).toBeCloseTo(1, 9);
    expect(settledTenureDays(lifter, asUnacceleratedSeconds(day))).toBeCloseTo(0, 9);
    expect(settledTenureDays(lifter, asUnacceleratedSeconds(day * 2))).toBeCloseTo(1, 9);
    // And neither goes negative before the lifter exists.
    expect(settledTenureDays(lifter, asUnacceleratedSeconds(0))).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Constructors
// ---------------------------------------------------------------------------

describe('the branded constructors', () => {
  it('accepts ordinary values', () => {
    expect(asGymBucks(0)).toBe(0);
    expect(asGymBucks(1234.5)).toBe(1234.5);
    expect(asReputation(EMPIRE_TUNING.REPUTATION_MAX)).toBe(EMPIRE_TUNING.REPUTATION_MAX);
    expect(asTrainingIq(3)).toBe(3);
    expect(asIdleTenureDays(0.5)).toBe(0.5);
    expect(asUnacceleratedSeconds(0)).toBe(0);
    expect(asAcceleratedSeconds(7)).toBe(7);
    expect(asNpcId('lifter-1')).toBe('lifter-1');
  });

  it('refuses what is not a quantity', () => {
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => asGymBucks(bad), `gymBucks ${bad}`).toThrow(RangeError);
      expect(() => asReputation(bad), `reputation ${bad}`).toThrow(RangeError);
      expect(() => asTrainingIq(bad), `trainingIq ${bad}`).toThrow(RangeError);
      expect(() => asUnacceleratedSeconds(bad), `seconds ${bad}`).toThrow(RangeError);
      expect(() => asAcceleratedSeconds(bad), `seconds ${bad}`).toThrow(RangeError);
      expect(() => asIdleTenureDays(bad), `tenure ${bad}`).toThrow(RangeError);
    }
    expect(() => asReputation(EMPIRE_TUNING.REPUTATION_MAX + 1)).toThrow(/REPUTATION_MAX/);
    expect(() => asNpcId('')).toThrow(RangeError);
    expect(() => createNpcLifter('a', 'novice', '', 0, 0)).toThrow(RangeError);
  });

  it('hands a caller the refusal rather than the name, when a throw carries one', () => {
    // The containment half of the throw wrap, driven rather than reasoned. A
    // legitimate message passes through untouched, which is the traffic the
    // whole directory sends: 53 of the 54 throw sites now call the wrap and
    // every one of them carries a sentence.
    expect(() => refuseWith('roster holds 2 of 2 slots')).toThrow(RangeError);
    expect(() => refuseWith('roster holds 2 of 2 slots')).toThrow(/roster holds 2 of 2 slots/);
    // And the tenth bypass's shape, driven at every member of the ban list
    // rather than at the first: the caller receives the refusal, and the value
    // it refused is quoted INSIDE that refusal rather than handed over as the
    // whole message. That distinction is the reason this asserts on the prefix
    // as well — a wrap that merely re-threw would match the second line.
    let refused = 0;
    for (const forbidden of EMPIRE_FORBIDDEN_OUTPUTS) {
      expect(() => refuseWith(forbidden), forbidden).toThrow(
        /^thrownMessage must not be a forbidden empire output;/,
      );
      expect(() => refuseWith(forbidden), forbidden).toThrow(RangeError);
      refused += 1;
    }
    // Counts, not bounds: an emptied ban list would make the loop above vacuous.
    expect(refused).toBe(EMPIRE_FORBIDDEN_OUTPUTS.length);
    expect(refused).toBe(4);
  });

  it('bounds the physio hook at the seam rather than at the far end of it', () => {
    // `recordSession` refuses a fractional or negative `physioDaysSaved`, and
    // it clamps at its own floor. Both refusals are repeated here so the
    // message names the empire table that produced the value.
    expect(asInjuryDaysSaved(0)).toBe(0);
    expect(asInjuryDaysSaved(EMPIRE_TUNING.PHYSIO_MAX_DAYS_SAVED)).toBe(
      EMPIRE_TUNING.PHYSIO_MAX_DAYS_SAVED,
    );
    expect(() => asInjuryDaysSaved(0.5)).toThrow(/whole number/);
    expect(() => asInjuryDaysSaved(-1)).toThrow(RangeError);
    expect(() => asInjuryDaysSaved(EMPIRE_TUNING.PHYSIO_MAX_DAYS_SAVED + 1)).toThrow(
      /PHYSIO_MAX_DAYS_SAVED/,
    );
  });

  it('turns a settled level into days saved, and clamps rather than throwing', () => {
    expect(physioDaysSavedFor(settledLevel([], asUnacceleratedSeconds(0)))).toBe(0);
    const oneLevel = settledLevel([asUnacceleratedSeconds(0)], asUnacceleratedSeconds(1));
    expect(physioDaysSavedFor(oneLevel)).toBe(
      Math.min(
        EMPIRE_TUNING.PHYSIO_MAX_DAYS_SAVED,
        EMPIRE_TUNING.PHYSIO_DAYS_SAVED_PER_STAFF_LEVEL,
      ),
    );
    // A level list longer than the ladder saturates instead of exceeding the
    // ceiling, so a wiring mistake upstream is a capped value rather than a
    // throw at the fatigue seam.
    const manyLevels = settledLevel(
      [0, 1, 2, 3, 4, 5, 6].map(asUnacceleratedSeconds),
      asUnacceleratedSeconds(100),
    );
    expect(manyLevels).toBe(7);
    expect(physioDaysSavedFor(manyLevels)).toBe(EMPIRE_TUNING.PHYSIO_MAX_DAYS_SAVED);
  });
});

// ---------------------------------------------------------------------------
// The ladders, read through the core
// ---------------------------------------------------------------------------

describe('the ladder lookups', () => {
  it('prices every recruit tier deterministically, with no seed anywhere', () => {
    for (const tier of EMPIRE_TUNING.NPC_TIERS) {
      const first = recruitCost(tier);
      // Called twice, because determinism is the §12.3 refusal condition here
      // and a function that consulted a generator would differ between calls.
      expect(recruitCost(tier)).toBe(first);
      expect(first).toBe(EMPIRE_TUNING.NPC_RECRUIT_COST_GYM_BUCKS[tier]);
      expect(recruitReputationThreshold(tier)).toBe(
        EMPIRE_TUNING.NPC_RECRUIT_REPUTATION_THRESHOLD[tier],
      );
      expect(recruitSeconds(tier)).toBe(EMPIRE_TUNING.NPC_RECRUIT_SECONDS[tier]);
    }
  });

  it('prices the axes and returns null off the ladder', () => {
    for (const tier of EMPIRE_TUNING.EQUIPMENT_TIERS) {
      expect(equipmentTierCost(tier)).toBe(EMPIRE_TUNING.EQUIPMENT_TIER_COST_GYM_BUCKS[tier]);
    }
    expect(spaceLevelCost(0)).toBeNull();
    expect(spaceLevelCost(1)).toBe(EMPIRE_TUNING.SPACE_LEVEL_COST_GYM_BUCKS[0]);
    expect(spaceLevelCost(EMPIRE_TUNING.SPACE_LEVEL_MAX)).not.toBeNull();
    expect(spaceLevelCost(EMPIRE_TUNING.SPACE_LEVEL_MAX + 1)).toBeNull();
    for (const role of EMPIRE_TUNING.STAFF_ROLES) {
      expect(staffLevelCost(role, 0)).toBeNull();
      expect(staffLevelCost(role, 1)).toBe(EMPIRE_TUNING.STAFF_LEVEL_COST_GYM_BUCKS[role][0]);
      expect(staffLevelCost(role, EMPIRE_TUNING.STAFF_LEVEL_MAX[role])).not.toBeNull();
      expect(staffLevelCost(role, EMPIRE_TUNING.STAFF_LEVEL_MAX[role] + 1)).toBeNull();
    }
  });

  it('grows a build timer with the level and caps it', () => {
    let previous = 0;
    for (let level = 1; level <= EMPIRE_TUNING.SPACE_LEVEL_MAX; level += 1) {
      const seconds = buildSeconds(level);
      expect(seconds, `level ${level}`).toBeGreaterThan(previous);
      previous = seconds;
    }
    // The cap is slack today, so it is exercised by asking past the ladder.
    expect(buildSeconds(100)).toBe(EMPIRE_TUNING.BUILD_SECONDS_MAX);
  });

  it('places a gym in a reputation tier, monotonically', () => {
    expect(reputationTierIndex(asReputation(0))).toBe(0);
    expect(reputationTierIndex(asReputation(EMPIRE_TUNING.REPUTATION_MAX))).toBe(
      EMPIRE_TUNING.REPUTATION_TIER_THRESHOLDS.length - 1,
    );
    let previous = 0;
    let increases = 0;
    for (let points = 0; points <= EMPIRE_TUNING.REPUTATION_MAX; points += 50) {
      const index = reputationTierIndex(asReputation(points));
      expect(index, `${points} points`).toBeGreaterThanOrEqual(previous);
      if (index > previous) increases += 1;
      previous = index;
    }
    // Counts, not bounds: the sweep really does cross every boundary.
    expect(increases).toBe(EMPIRE_TUNING.REPUTATION_TIER_THRESHOLDS.length - 1);
  });

  it('grows roster capacity with the two axes that pay it, and caps it', () => {
    const axes = (spaceLevel: number, spotter: number): GymAxes => ({
      equipment: EMPIRE_TUNING.EQUIPMENT_TIERS[0],
      spaceLevel,
      staffLevel: { coach: 0, spotter, physio: 0 },
    });
    expect(rosterCapacity(axes(0, 0))).toBe(EMPIRE_TUNING.ROSTER_SLOTS_BASE);
    expect(rosterCapacity(axes(1, 0))).toBe(
      EMPIRE_TUNING.ROSTER_SLOTS_BASE + EMPIRE_TUNING.ROSTER_SLOTS_PER_SPACE_LEVEL,
    );
    expect(
      rosterCapacity(axes(EMPIRE_TUNING.SPACE_LEVEL_MAX, EMPIRE_TUNING.STAFF_LEVEL_MAX.spotter)),
    ).toBe(EMPIRE_TUNING.ROSTER_SLOTS_MAX);
    // And the cap holds against a state that overshot it.
    expect(rosterCapacity(axes(99, 99))).toBe(EMPIRE_TUNING.ROSTER_SLOTS_MAX);
  });
});

// ---------------------------------------------------------------------------
// Ledgers
// ---------------------------------------------------------------------------

describe('the ledger halves', () => {
  const at = asUnacceleratedSeconds(1);
  const ledger: readonly EmpireLedgerEntry[] = [
    { at, output: 'gym-bucks', amount: 10 },
    { at, output: 'training-iq', amount: 1 },
    { at, output: 'cosmetic-unlock', amount: 1 },
    { at, output: 'physio-days-saved', amount: 1 },
    { at, output: 'reputation', amount: 2 },
  ];

  it('splits a ledger into two halves that cover it exactly once', () => {
    const progression = progressionLedger(ledger);
    const idle = idleLedger(ledger);
    // Non-vacuity first: both halves have members, so neither loop below is
    // walking an empty list.
    expect(progression.length).toBe(2);
    expect(idle.length).toBe(3);
    expect(progression.length + idle.length).toBe(ledger.length);
    for (const entry of progression) expect(idle).not.toContain(entry);
    for (const entry of ledger) {
      const inProgression = progression.includes(entry);
      const inIdle = idle.includes(entry);
      expect(inProgression !== inIdle, `${entry.output} is in both halves or neither`).toBe(true);
    }
  });

  it('puts both hazards in the half piece E6 compares', () => {
    const outputs = progressionLedger(ledger).map((entry) => entry.output);
    expect(outputs).toContain('training-iq');
    expect(outputs).toContain('physio-days-saved');
  });

  it('returns empty halves for an empty ledger without claiming anything', () => {
    expect(progressionLedger([])).toEqual([]);
    expect(idleLedger([])).toEqual([]);
  });
});

describe('the pairing constructors', () => {
  it('builds a frozen pairing that the runtime guard agrees with', () => {
    const pairing = acceleratedOutput('gym-empire-timer-skip', 'gym-bucks');
    expect(pairing).toEqual({ accelerant: 'gym-empire-timer-skip', output: 'gym-bucks' });
    expect(Object.isFrozen(pairing)).toBe(true);
    expect(mayAccelerate(pairing.accelerant, pairing.output)).toBe(true);
  });

  it('stamps and sizes an applied accelerant, and refuses a negative size', () => {
    const applied = applyAccelerant(
      'coach-staff-level',
      'training-iq',
      asUnacceleratedSeconds(120),
      EMPIRE_TUNING.TIMER_SKIP_SECONDS_PER_GRANT,
    );
    expect(applied.at).toBe(120);
    expect(applied.seconds).toBe(EMPIRE_TUNING.TIMER_SKIP_SECONDS_PER_GRANT);
    expect(Object.isFrozen(applied)).toBe(true);
    expect(empireStateFaults({ ...createEmpireState(), accelerants: [applied] })).toEqual([]);
    expect(() =>
      applyAccelerant('space-level', 'gym-bucks', asUnacceleratedSeconds(0), -1),
    ).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// State and invariants
// ---------------------------------------------------------------------------

describe('the state constructor and its invariants', () => {
  it('opens a gym that satisfies every invariant', () => {
    const state = createEmpireState();
    expect(empireStateFaults(state)).toEqual([]);
    expect(() => assertEmpireState(state)).not.toThrow();
    expect(Object.isFrozen(state)).toBe(true);
    expect(state.axes.equipment).toBe(EMPIRE_TUNING.EQUIPMENT_TIERS[0]);
    expect(state.roster).toEqual([]);
    expect(state.gymBucks).toBe(0);
    expect(state.reputation).toBe(0);
    expect(state.clock.unaccelerated).toBe(0);
    expect(state.clock.accelerated).toBe(0);
  });

  const base = createEmpireState();
  const lifter = (id: string, tier: NpcTier = 'novice'): ReturnType<typeof createNpcLifter> =>
    createNpcLifter(id, tier, 'Placeholder', 0, 0);

  /**
   * A roster lifter as a DECODED PAYLOAD rather than a constructed value.
   *
   * `createNpcLifter` cannot build any of the rows below it, which is exactly
   * why they need building: `empireStateFaults` is the shadow for the caller
   * TypeScript never sees, and a payload from an Edge Function arrives as JSON
   * with whatever is in it.
   */
  const wireLifter = (
    overrides: Readonly<Record<string, unknown>>,
  ): ReturnType<typeof createNpcLifter> =>
    ({
      id: 'a',
      tier: 'novice',
      displayName: 'Placeholder',
      joinedAt: 0,
      settledAt: 0,
      ...overrides,
    }) as unknown as ReturnType<typeof createNpcLifter>;

  const broken: readonly (readonly [string, EmpireState, RegExp])[] = [
    [
      'a clock with no numbers in it',
      {
        ...base,
        clock: {
          unaccelerated: undefined as unknown as UnacceleratedSeconds,
          accelerated: undefined as unknown as AcceleratedSeconds,
        },
      },
      /the un-accelerated reading undefined is not a wall-clock time/,
    ],
    [
      // The payload the ordering test accepted: both readings negative, so
      // `accelerated < unaccelerated` is false and the only check there was
      // passed. `createEmpireClock` refuses it on both arguments.
      'a clock at a negative time, which the ordering check alone accepted',
      {
        ...base,
        clock: {
          unaccelerated: -1 as unknown as UnacceleratedSeconds,
          accelerated: -1 as unknown as AcceleratedSeconds,
        },
      },
      /the accelerated reading -1 is not an idle-clock time/,
    ],
    [
      'a clock running backwards',
      {
        ...base,
        clock: {
          unaccelerated: asUnacceleratedSeconds(10),
          accelerated: asAcceleratedSeconds(5),
        },
      },
      /accelerated reading is behind/,
    ],
    [
      // The wall-clock view of the ladders, ahead of the idle one on each of
      // the three rungs. That ordering is what says no accelerant reached the
      // settled side: `skipExpansion` moves `idleCompletion` and copies
      // `settledCompletion` across, so the idle view is never behind. Three
      // rows rather than one because the three rungs are three branches.
      'a wall-clock equipment tier ahead of the idle one',
      {
        ...base,
        settledAxes: { ...base.settledAxes, equipment: 'monolift' as EquipmentTier },
      },
      /settledAxes: equipment monolift is ahead of the idle view's bare-bar/,
    ],
    [
      'a wall-clock space level ahead of the idle one',
      { ...base, settledAxes: { ...base.settledAxes, spaceLevel: 1 } },
      /settledAxes: space level 1 is ahead of the idle view's 0/,
    ],
    [
      'a wall-clock staff level ahead of the idle one',
      {
        ...base,
        settledAxes: {
          ...base.settledAxes,
          staffLevel: { ...base.settledAxes.staffLevel, physio: 1 },
        },
      },
      /settledAxes: physio level 1 is ahead of the idle view's 0/,
    ],
    [
      // A wall-clock book, which is the money §5.4's physio rung and §5.3's
      // recruits are bought out of. Its sibling below is the accelerated book.
      // The physio purse rather than the record, because GDD §5.4's third-book
      // ruling makes this a purse per funded output and the walk has to reach
      // every one of them — a check on the record's shape would pass on a
      // record whose physio entry was NaN.
      'a wall-clock book that is not a balance',
      {
        ...base,
        settledBooks: { ...base.settledBooks, 'physio-days-saved': Number.NaN as GymBucks },
      },
      /the physio-days-saved book: NaN is not a balance/,
    ],
    [
      'an equipment tier off the ladder',
      { ...base, axes: { ...base.axes, equipment: 'gold-bar' as EquipmentTier } },
      /is not an equipment tier/,
    ],
    [
      'a space level off the ladder',
      { ...base, axes: { ...base.axes, spaceLevel: EMPIRE_TUNING.SPACE_LEVEL_MAX + 1 } },
      /space level .* is off the ladder/,
    ],
    [
      'a fractional space level',
      { ...base, axes: { ...base.axes, spaceLevel: 1.5 } },
      /space level .* is off the ladder/,
    ],
    [
      'a staff level off the ladder',
      {
        ...base,
        axes: { ...base.axes, staffLevel: { coach: 99, spotter: 0, physio: 0 } },
      },
      /coach level .* is off the ladder/,
    ],
    [
      // The branch below the axis checks. `rosterCapacity` reads the spotter
      // level, so an axis that decoded as something other than a number makes
      // the capacity NaN — and `length > NaN` is false, which let any roster at
      // all through the check beneath it.
      'a spotter level that is not a number, which makes the capacity NaN',
      {
        ...base,
        axes: {
          ...base.axes,
          staffLevel: { coach: 0, spotter: Number.NaN, physio: 0 },
        },
        roster: [lifter('a'), lifter('b'), lifter('c')],
      },
      /roster: NaN is not a capacity/,
    ],
    [
      'reputation above the scale',
      { ...base, reputation: (EMPIRE_TUNING.REPUTATION_MAX + 1) as never },
      /above REPUTATION_MAX/,
    ],
    ['negative reputation', { ...base, reputation: -1 as never }, /is not a reputation/],
    ['a negative balance', { ...base, gymBucks: -1 as never }, /is not a balance/],
    [
      'more lifters than slots',
      { ...base, roster: [lifter('a'), lifter('b'), lifter('c')] },
      /lifters in .* slots/,
    ],
    ['two lifters with one id', { ...base, roster: [lifter('a'), lifter('a')] }, /duplicate/],
    [
      'a lifter on a tier that is not a tier',
      { ...base, roster: [createNpcLifter('a', 'olympian' as NpcTier, 'Placeholder', 0, 0)] },
      /which is not a tier/,
    ],
    // The five rows below are the decode boundary catching up with the
    // constructors. `createNpcLifter` refuses every one of these payloads; the
    // roster loop checked ids for duplication and tiers for membership and
    // accepted the rest, which is the same guard-on-one-arm shape as the clock.
    [
      'a lifter with no id',
      { ...base, roster: [wireLifter({ id: '' })] },
      /a lifter arrived with no id/,
    ],
    [
      'a lifter with no display name',
      { ...base, roster: [wireLifter({ displayName: '' })] },
      /arrived with no display name/,
    ],
    [
      'a lifter with no arrival times at all',
      { ...base, roster: [wireLifter({ joinedAt: undefined, settledAt: undefined })] },
      /joined at undefined, which is not an idle-clock time/,
    ],
    [
      'a lifter that joined before the gym opened',
      { ...base, roster: [wireLifter({ joinedAt: -1 })] },
      /joined at -1, which is not an idle-clock time/,
    ],
    [
      // The hazard-adjacent one. `settledTenureDays` measures from `settledAt`,
      // so a negative settled time inflates the tenure GDD §5.2 pays Training
      // IQ on — reached through a decoded payload rather than an argument list.
      'a lifter that settled before the gym opened',
      { ...base, roster: [wireLifter({ settledAt: -1 })] },
      /settled at -1, which is not a wall-clock time/,
    ],
    [
      'a ledger entry stamped at no time',
      {
        ...base,
        ledger: [
          {
            at: undefined as unknown as UnacceleratedSeconds,
            output: 'gym-bucks',
            amount: 1,
          },
        ],
      },
      /gym-bucks was stamped at undefined, which is not a wall-clock time/,
    ],
    [
      'a ledger entry with no number in it',
      {
        ...base,
        ledger: [{ at: asUnacceleratedSeconds(0), output: 'gym-bucks', amount: Number.NaN }],
      },
      /non-finite amount/,
    ],
    [
      'a ledger entry paying something the empire may not pay',
      {
        ...base,
        ledger: [
          { at: asUnacceleratedSeconds(0), output: 'covered-day' as never, amount: 1 },
        ],
      },
      /is not an empire output/,
    ],
    [
      'an accelerant stamped at no time',
      {
        ...base,
        accelerants: [
          {
            accelerant: 'gym-empire-timer-skip',
            output: 'gym-bucks',
            at: undefined as unknown as UnacceleratedSeconds,
            seconds: 1,
          },
        ],
      },
      /gym-empire-timer-skip was stamped at undefined, which is not a wall-clock time/,
    ],
    [
      'an accelerant applied for a negative time',
      {
        ...base,
        accelerants: [
          {
            accelerant: 'gym-empire-timer-skip',
            output: 'gym-bucks',
            at: asUnacceleratedSeconds(0),
            seconds: -1,
          },
        ],
      },
      /applied for -1 seconds/,
    ],
    [
      // The fault that used to be a `TypeError`. `mayAccelerate` indexes
      // `ACCELERANT_ARRIVAL` and then calls `.includes` on the result, so an
      // accelerant the tables have never heard of made `accelerantLicence`
      // return undefined and threw out of a function whose whole contract is to
      // COLLECT faults — which meant `assertEmpireState` reported the wrong
      // error for a decoded payload, which is the one caller it exists for.
      'an accelerant the tables have no verdict for',
      {
        ...base,
        accelerants: [
          {
            accelerant: 'free-training-iq',
            output: 'training-iq',
            at: asUnacceleratedSeconds(0),
            seconds: 1,
          } as unknown as AppliedAccelerant,
        ],
      },
      /free-training-iq on training-iq is not a pairing this module has a verdict for/,
    ],
    [
      'an accelerant with no accelerant on it at all',
      {
        ...base,
        accelerants: [
          {
            output: 'gym-bucks',
            at: asUnacceleratedSeconds(0),
            seconds: 1,
          } as unknown as AppliedAccelerant,
        ],
      },
      /undefined on gym-bucks is not a pairing this module has a verdict for/,
    ],
    [
      'an accelerant aimed at an output the tables have no verdict for',
      {
        ...base,
        accelerants: [
          {
            accelerant: 'gym-empire-timer-skip',
            output: 'covered-day',
            at: asUnacceleratedSeconds(0),
            seconds: 1,
          } as unknown as AppliedAccelerant,
        ],
      },
      /gym-empire-timer-skip on covered-day is not a pairing this module has a verdict for/,
    ],
    [
      'a purchased accelerant on a progression-reaching output, cast past the type',
      {
        ...base,
        accelerants: [
          {
            accelerant: 'gym-empire-timer-skip',
            output: 'training-iq',
            at: asUnacceleratedSeconds(0),
            seconds: 1,
          } as unknown as AppliedAccelerant,
        ],
      },
      /may not accelerate training-iq/,
    ],
  ];

  it('catches every invariant it claims to catch', () => {
    const produced: string[] = [];
    for (const [what, state, message] of broken) {
      const faults = empireStateFaults(state);
      expect(faults.length, `${what} produced no fault`).toBeGreaterThan(0);
      expect(faults.join('\n'), what).toMatch(message);
      expect(() => assertEmpireState(state), what).toThrow(RangeError);
      produced.push(...faults);
    }

    // The line here was `expect(broken.length).toBe(15)`, described as "counts,
    // not bounds" — and it was a count of an array declared in this same test,
    // which no state of `empireCore.ts` could move. It guarded the table
    // against being edited, which is not what the table is for.
    //
    // What it is for is the fault branches in `empireStateFaults`, so those are
    // what is counted, read out of the subject. Every `faults.push` site has to
    // be produced by a row above: a branch added to the decode boundary with no
    // row exercising it is red here, and a branch deleted — which is what
    // reverting any of this piece's decode fixes looks like — is red both here
    // and on the row that stops producing a fault.
    const sites = faultPushSkeletons();
    expect(sites.length, 'the faults.push parse found nothing to check').toBe(28);
    const uncovered = sites
      .filter((site) => !produced.some((fault) => site.pattern.test(fault)))
      .map((site) => site.text);
    expect(uncovered).toEqual([]);
    // Counts, not bounds, on the other side of the same claim: how many faults
    // the table actually produced. A table whose rows all went quiet would make
    // `uncovered` a filter over an empty list of messages — which is caught
    // above, and is caught here too, in the number rather than in the shape.
    expect(produced.length).toBe(37);
  });

  it('refuses a purchased accelerant that arrived past the compiler', () => {
    // The runtime second line, stated on its own because it is the one that
    // catches a decoded Edge Function payload. TypeScript never sees JSON.
    const state: EmpireState = {
      ...base,
      accelerants: [
        {
          accelerant: 'rewarded-ad-timer-skip',
          output: 'physio-days-saved',
          at: asUnacceleratedSeconds(0),
          seconds: 1,
        } as unknown as AppliedAccelerant,
      ],
    };
    const faults = empireStateFaults(state);
    expect(faults.length).toBe(1);
    expect(faults[0]).toContain('arrives by store-purchase');
    expect(faults[0]).toContain('may not accelerate physio-days-saved');
    expect(faults[0]).toContain('progression-reaching');
    // And the legal sibling produces no fault at all, so the check above is
    // discriminating rather than firing on everything.
    const legal: EmpireState = {
      ...base,
      accelerants: [
        {
          accelerant: 'coach-staff-level',
          output: 'physio-days-saved',
          at: asUnacceleratedSeconds(0),
          seconds: 1,
        },
      ],
    };
    expect(empireStateFaults(legal)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Purity, and the magic-number audit run from inside this piece
// ---------------------------------------------------------------------------

describe('the directory is pure, numerically clean and free of dice', () => {
  // The same walk the import fence above uses, and for the same reason: this
  // list was a one-level `readdirSync(HERE)`, so a module in a subdirectory was
  // outside every scan in this block — the purity scan, the dice ban and the
  // magic-number audit alike. `shippedModuleNames()` recurses, and the pinned
  // list below is what says the directory has not quietly grown one.
  const shipped = shippedModuleNames();

  it('has shipped modules to scan, so the scans below are not empty', () => {
    // Counts, not bounds. Every check in this block walks this list, and a
    // list that had gone empty would make all of them pass.
    expect(shipped).toEqual([
      'FloorGrid.tsx',
      'GymScreen.tsx',
      'empireCore.ts',
      'empireInvariant.ts',
      'empireTuning.ts',
      'engagement.ts',
      'expansion.ts',
      'floor.ts',
      'floorSim.ts',
      // GDD §5.13 presentation Phase 4: the floor's sprite data — index
      // grids, palettes resolved from EMPIRE_TUNING, and the indexed-PNG
      // encoding FloorGrid.tsx draws.
      'floorSprites.ts',
      'institutionalReputation.ts',
      'ladder.ts',
      'ladderView.tsx',
      // Stage G.2C3: vacancy arrival / population replenishment.
      'livingMemberArrival.ts',
      'livingMemberDeparture.ts',
      // Stage G.2D: living-member dues accounting.
      'livingMemberDues.ts',
      'livingMemberExperience.ts',
      // Stage G.2E: living-member reputation ledger.
      'livingMemberReputation.ts',
      // Stage G.2B: living-member retention pressure, derived from G.2A.
      'livingMemberRetention.ts',
      // G2-ATHLETE-SEASON-01: shared gym-clock Athlete leave/return.
      'livingMemberSeason.ts',
      // Stage G.2C1: persistent stay-response. No roster deletion.
      'livingMemberStay.ts',
      // Stage G.1: living floor-member identity and service outcomes.
      'livingMembers.ts',
      // §5.11 stage 4: staffing, maintenance, equipment condition and
      // recoverable failure.
      'management.ts',
      'members.ts',
      'npc.ts',
      // GDD §5.14 Stage B: the economy pacing simulator.
      'pacing.ts',
      'production.ts',
      'recruitment.ts',
      'reputation.ts',
      'sessions.ts',
      'social.ts',
      // Stage E: Career-result → Empire reputation calculator. Pure function;
      // the persistent write is a later crossing.
      'sportingReputation.ts',
      // CAREER-EMPIRE-REP-01: sporting ledger on the played gym tree.
      'sportingReputationLedger.ts',
      // GDD §5.14 Stage D: Quality / Capacity / Throughput algebra.
      'stationCapability.ts',
      // GDD §5.14 Stage C: the station-tap management selector.
      'stationView.ts',
      // GDD §5.18 Stage D.1: equipment is not a training station.
      'trainingStation.ts',
    ]);
  });

  it('leaves no shipped module invisible to the rest of the directory', () => {
    // The structural half of a coherence finding. `engagement.ts` and
    // `engagement.test.ts` measure the earned chain three other headers were
    // still calling unmeasured, and NO OTHER SHIPPED MODULE NAMED THEM — the
    // only occurrence of either name outside themselves was the file list
    // pinned in the test above. Eleven modules, and the last one was invisible
    // to the other ten, so a reader following the directory's own account of
    // itself could not arrive at the file that discharged the obligation.
    //
    // What this measures: for each shipped module, how many OTHER shipped
    // modules name it — as an import specifier `'./name'`, or in prose as
    // `name.ts` or `name.test.ts`. Prose counts deliberately; `engagement.ts`
    // is a leaf that nothing imports, so an import-only scan would report it
    // orphaned forever and be deleted.
    //
    // What it cannot do, said rather than implied: it cannot tell a mention
    // that orients a reader from one that does not, and a module could satisfy
    // it with one stale sentence. It catches ARRIVAL — a new module nobody
    // wrote into the map — which is the case that actually happened.
    const bodies = new Map(
      shipped.map((name) => [name, readFileSync(path.join(HERE, name), 'utf8')]),
    );
    const mentionersOf = (name: string): readonly string[] => {
      const base = name.replace(/\.tsx?$/, '');
      const keys = [`./${base}`, `${base}.ts`, `${base}.test.ts`];
      return shipped.filter(
        (other) => other !== name && keys.some((key) => (bodies.get(other) as string).includes(key)),
      );
    };

    const orphans: string[] = [];
    let pairs = 0;
    for (const name of shipped) {
      const mentioners = mentionersOf(name);
      pairs += mentioners.length;
      if (mentioners.length === 0) orphans.push(name);
    }
    // The claim, with the offenders in the message rather than a length.
    expect(orphans.join(', ')).toBe('');
    // Non-vacuity, as counts rather than bounds: every module was examined, and
    // the map really has edges in it. Pinned exactly, so a directory whose
    // cross-references thinned out is a decision somebody signs.
    expect(bodies.size).toBe(shipped.length);
    // 59 -> 60: `ladderView.tsx` now imports `./sessions` too (`GymView`, the
    // stage-2 gate's instrument), one new mention and nothing else moved.
    // 60 -> 65: `GymScreen.tsx` arrived. Five new pairs, measured rather than
    // guessed: `GymScreen.tsx` mentions four other shipped modules
    // (`./empireTuning`, `./ladder`, `./ladderView`, `./sessions` — its own
    // import list), and `sessions.ts`'s trailing paragraph pointing at
    // `GymScreen.tsx` (added so `GymScreen.tsx` is not an orphan below) is the
    // fifth, the only mention running the other direction. It sits in
    // `sessions.ts` rather than `ladderView.tsx` for a reason worth recording:
    // a trailing `/** */`-style comment appended immediately before EOF in
    // ANY file in this tree is invisible to this suite's own parser-agreement
    // oracle (`audit.test.ts`'s `parserCommentMask` mis-walks the JSDoc node
    // TypeScript synthesises as a child of the EOF token in that shape,
    // reported to Session A rather than fixed here), and appending anything
    // at all to `ladderView.tsx` specifically hits a second, unrelated defect
    // in that oracle's subject (`onlyComments`'s brace-depth tracking desyncs
    // partway through `GymView`'s nested template-literal JSX). A plain `//`
    // block, placed in a file with no such JSX, avoids both.
    // 65 -> merged: members.ts (§5.11 stage 3) arrived, adding seven new
    // pairs (six file-name mentions in its own header, deduplicated per
    // module, plus sessions.ts's header naming it back), and GDD §5.13
    // presentation Phase 1's `floor.ts`/`FloorGrid.tsx` arrived independently,
    // adding fourteen more. Both counts were measured by running this exact
    // assertion against each branch alone; the merged value is re-measured
    // here rather than hand-summed, since the two branches' mention graphs
    // could in principle overlap.
    // 86 -> 88: PLAYTEST 3's overlap-refusal ruling added two mentions to
    // `floor.ts`'s own header, both new pairs measured by diffing this exact
    // walk against HEAD rather than hand-counted — `floor.ts` now names
    // `FloorGrid.tsx` (the drop handler that calls the new
    // `overlapsFixedFurniture`) and `ladderView.test.ts` (the reducer-level
    // direct-call tests `placeFloorItem`'s own header points at). Neither
    // mention existed before this round.
    // 88 -> 90: GDD §5.13 presentation Phase 2's ambient-member work gives
    // `floor.ts` and `FloorGrid.tsx` each a first mention of `members.ts` —
    // `floor.ts` via its new `./members` import plus its
    // `ambientMemberRoster` header prose, `FloorGrid.tsx` via its new
    // `./members` import for `MemberType`. Two new pairs, measured by running
    // this exact assertion and reading its failure value.
    // 90 -> 91: PLAYTEST 4's rework of the ambient-body prop-surface guard.
    // `FloorGrid.tsx`'s rewritten limit paragraph names `empireCore.test.ts`
    // for the first time — the import fence lives there, and the paragraph
    // names it as the reason a `useContext` channel would pass unnoticed, which
    // is CLAUDE.md's "name the check that covers the route" applied to a route
    // that turns out to have no cover. One new pair, `FloorGrid.tsx` ->
    // `empireCore.ts`, measured by running this exact assertion and reading its
    // failure value rather than hand-counted.
    // 91 -> 98: GDD §5.13 presentation Phase 3's `floorSim.ts` arrived. Seven
    // new pairs, measured by running this exact assertion and reading its
    // failure value: six running outward (its own import list — empireCore,
    // empireTuning, floor, ladder, members, sessions) and one running back,
    // `empireTuning.ts`'s new FLOOR_SIM block saying "Read by `floorSim.ts`
    // only", which is what keeps the new module off the orphan list above.
    // 98 -> 99: Phase 3's RENDER half. One new pair, `FloorGrid.tsx` ->
    // `floorSim.ts`, from the import that drives the sim. Nothing runs back
    // the other way — `floorSim.ts`'s header names no screen file, only "A
    // SECOND BUILDER WIRES THIS TO A SCREEN" — and `empireTuning.ts` already
    // named `FloorGrid.tsx` before this round, so neither is a new pair.
    // Measured by running this assertion and reading its failure value.
    // 99 -> 106: GDD §5.13 presentation Phase 4's `floorSprites.ts`. Seven
    // new pairs, measured by running this exact assertion: five outward from
    // its own imports and header prose (`./empireTuning`, `./ladder`,
    // `./members`, `./sessions`, plus naming `floorSprites.test.ts`'s
    // decode-and-compare battery and `FloorGrid.tsx` as its consumer), and
    // two running back — `FloorGrid.tsx`'s `./floorSprites` import and
    // `empireTuning.ts`'s FLOOR_SPRITE block naming its reader.
    // 106 -> 107: floorSprites.ts's parseMap comment names floorSim.ts's
    // precedent in the member-call census — one more mention pair.
    // 107 -> 115: §5.11 stage 4's `management.ts`. Measured by running this
    // exact assertion and reading its failure value.
    // 115 -> 118: S4b, stage 4 reaching the screen a player presses. Three new
    // pairs, and they were ENUMERATED rather than read off the failure count —
    // the whole pair list was diffed against the previous commit, because a
    // re-pin that only matches a total can absorb a pair arriving while
    // another one leaves. The three: `GymScreen.tsx -> management.ts` and
    // `ladderView.tsx -> management.ts` (both files now import `./management`,
    // the screen to read condition/staffing/failure and the reducer to write
    // them), and `ladderView.tsx -> GymScreen.tsx`, from the new paragraph in
    // `GymViewState`'s header saying which of the two views renders stage 4.
    // Nothing was removed.
    // 118 -> 119: the player's own check-in. ONE new pair, and it was
    // enumerated the same way the three above were — the whole pair list was
    // diffed against the previous commit rather than the total being read off
    // this assertion's failure value, because a re-pin that only matches a
    // total absorbs a pair arriving while another leaves. The one:
    // `ladder.ts -> GymScreen.tsx`, from `playerCheckInGapSeconds`'s header
    // naming the screen whose "open up" control feeds it. Nothing was
    // removed.
    // 119 -> 120: S4g's `mats` retune. The new derivation block in
    // `empireTuning.ts`'s `SESSION_EQUIPMENT_COST_GYM_BUCKS` comment names
    // `GymScreen.tsx` for the first time — the aside noting that the dev
    // skip-row is "explicitly labelled 'not part of the game' in
    // `GymScreen.tsx`'s own header rather than a legitimate buy path". ONE
    // new pair, `empireTuning.ts -> GymScreen.tsx`, and it was ENUMERATED
    // rather than read off the failure count — the whole pair list was
    // diffed against the previous commit (2d0daebe vs 7e91e088) rather than
    // trusting the total, because a re-pin that only matches a total can
    // absorb a pair arriving while another leaves. Nothing was removed.
    // 120 -> 121: S4h's button-chrome fix. `GymScreen.tsx`'s new header
    // paragraph names `empireCore.test.ts`'s import fence (to say the fence
    // still reads `StyleSheet` as the same `react-native` specifier, not a
    // new dependency edge) and, separately, its no-real-name census (to say
    // the new colours are reused rather than invented). Two new textual
    // mentions of the same target dedupe to ONE new pair,
    // `GymScreen.tsx -> empireCore.ts` — confirmed absent from the pre-round
    // file by `git show`, not assumed. Nothing was removed.
    // 121 -> 128: GDD §5.14 Stage B's `pacing.ts`. SEVEN new pairs, enumerated
    // rather than read off the failure count: `pacing.ts` mentions six other
    // modules — `empireCore.ts`, `empireTuning.ts` and `ladder.ts` via both an
    // import specifier and prose, `management.ts` and `production.ts` the
    // same way, and `ladderView.tsx` in prose only (header §6's stage-gate
    // reference) — for six `pacing.ts -> X` pairs, plus one the other
    // direction: `empireTuning.ts`'s own new `PACING_REPORT_HORIZONS_SECONDS`
    // doc comment names `pacing.ts` by file name, so `empireTuning.ts ->
    // pacing.ts` is the seventh. Nothing was removed.
    // 128 -> 139: GDD §5.14 Stage C's `stationView.ts`. Eleven new pairs,
    // enumerated by diffing this exact walk against the pre-round tree
    // rather than hand-counted: `stationView.ts` outward to `FloorGrid.tsx`,
    // `GymScreen.tsx`, `empireTuning.ts`, `floor.ts`, `floorSim.ts`,
    // `management.ts`, `members.ts` and `sessions.ts` (eight — its own
    // import list plus its header prose naming the two screens by their real
    // extension, which this scan's substring match reads as a mention of the
    // `.ts` key), and three the other direction — `FloorGrid.tsx ->
    // stationView.ts` and `FloorGrid.tsx -> management.ts` (both new import
    // edges) and `empireTuning.ts -> stationView.ts` (the new Stage C tuning
    // block's own section-header comment). Nothing was removed.
    // 139 -> 140: GDD §5.14 Stage C.1, the world-first management transition
    // completed — the duplicate global per-item repair loop was deleted from
    // `GymScreen.tsx`, and its own header/inline comments now say where that
    // logic lives instead: `stationView.ts`'s `isSoundCondition`/
    // `displayRepairCostBySoundness`. ONE new pair, `GymScreen.tsx ->
    // stationView.ts` — confirmed by diffing this file-name scan's output
    // against `git show 9d4b3cd8:src/empire/GymScreen.tsx` rather than
    // assumed: that was the only new distinct `.ts`/`.tsx` name the file
    // gained. `FloorGrid.tsx` gained no new mentioned name over the same
    // diff (its new diagnostics-toggle section names only files it already
    // named). Nothing was removed.
    // 140 -> 141: Stage C.1b, one new distinct file-name mention across the
    // gym-screen / floor-layout rewrite.
    // 153 -> 159: GDD §5.18 Stage D.1's trainingStation.ts. Six new pairs
    // from the bay module naming its neighbours and from floorSim /
    // stationCapability / FloorGrid / ladderView / empireTuning naming it.
    // 159 -> 158: Stage D2.2 re-measured. One mention pair left the graph
    // (the D2.1B QA-helper copy in GymScreen/ladderView no longer named a
    // shipped module it used to). Pin is the live walk, not a guess.
    // 158 -> 175: Stage G.1 `livingMembers.ts` — new edges from ladderView,
    // FloorGrid, floorSim observations, and header prose across neighbours.
    // 175 -> 181: Stage G.2A livingMemberExperience.ts plus FloorGrid /
    // livingMembers / members headers naming it.
    // 183 -> 188: Stage G.2B livingMemberRetention.ts plus FloorGrid reading it.
    // 188 -> 194: Stage G.2C1 livingMemberStay.ts plus livingMembers wiring it.
    // 194 -> 200: Stage G.2C2 livingMemberDeparture.ts plus FloorGrid / livingMembers / stay wiring.
    // 200 -> 207: Stage G.2C3 livingMemberArrival.ts plus FloorGrid / livingMembers wiring.
    // 207 -> 215: Stage G.2D livingMemberDues.ts plus FloorGrid / livingMembers / ladderView wiring.
    // 215 -> 216: Stage G.2D purse composition — ladderView.tsx now names livingMemberDues.ts.
    // 216 -> 226: Stage G.2E livingMemberReputation.ts plus FloorGrid / livingMembers / arrival wiring.
    // 226 -> 233: G2-ATHLETE-SEASON-01 livingMemberSeason.ts plus FloorGrid / livingMembers / ladderView wiring.
    // 233 -> 245: CAREER-EMPIRE-REP-01 institutionalReputation.ts +
    // sportingReputationLedger.ts mention graph. Read from this assertion's
    // own failure value.
    // 245 -> 246: CAREER-EMPIRE-REP-01 GymScreen → institutionalReputation.
    // 246 -> 249: SF-TWL-GYM-EMPIRE-UX-01 GymScreen staff cards name
    // livingMemberDues / livingMemberReputation / livingMembers.
    expect(pairs).toBe(249);
    // And the finder can report: a name no module contains comes back with no
    // mentioners, so the empty `orphans` above is an empty answer to a question
    // that has a non-empty one available.
    expect(mentionersOf('empireNotAModule.ts')).toEqual([]);
    // 11 -> merged: members.ts's header names empireCore.ts by file name, and
    // floor.ts's `refuseWith` import does too — two independent new mentions.
    // 13 -> 14: PLAYTEST 4 again, and this assertion is what ATTRIBUTED the
    // pair count above rather than merely agreeing with it — the new mentioner
    // is `FloorGrid.tsx`, naming `empireCore.test.ts`'s import fence in its
    // rewritten limit paragraph.
    // 14 -> 15: `floorSim.ts` imports `refuseWith` from `./empireCore` and
    // names `empireCore.test.ts`'s import fence in its header §5.
    // 15 -> 16: `management.ts` imports `refuseWith` from `./empireCore` and
    // names the file in its own header.
    // 16 -> 17: S4h. `GymScreen.tsx` names `empireCore.test.ts`'s import
    // fence and its no-real-name census in its new header paragraphs — its
    // first mention of `empireCore.ts` by either key, confirmed absent from
    // the pre-round file by `git show` rather than assumed.
    // 17 -> 18: GDD §5.14 Stage B. `pacing.ts` imports `refuseWith` from
    // `./empireCore`.
    // 22 -> 23: Stage G.2B livingMemberRetention.ts imports refuseWith.
    // 23 -> 24: Stage G.2C1 livingMemberStay.ts imports refuseWith.
    // 24 -> 25: Stage G.2C2 livingMemberDeparture.ts imports refuseWith.
    // 25 -> 26: Stage G.2C3 livingMemberArrival.ts imports refuseWith.
    // 26 -> 27: Stage G.2D livingMemberDues.ts imports refuseWith.
    // 27 -> 28: Stage G.2E livingMemberReputation.ts imports refuseWith.
    // 28 -> 29: G2-ATHLETE-SEASON-01 livingMemberSeason.ts imports refuseWith.
    // 29 -> 31: CAREER-EMPIRE-REP-01 institutionalReputation.ts +
    // sportingReputationLedger.ts import refuseWith.
    expect(mentionersOf('empireCore.ts').length).toBe(31);
  });

  it('reads no clock, rolls no dice and touches no host API', () => {
    // Randomness in particular is GDD §12.3's second refusal condition: §5.3's
    // recruitment is deterministic, so the language of chance is banned from
    // the whole directory rather than reviewed per function.
    //
    // `seed`, `weight` and `distribution` are here because `empireTuning.ts`
    // says in prose that "there is no seed, no weight and no distribution
    // anywhere in this file" and only `weightedPick` was banned — two thirds of
    // that sentence had nothing behind it.
    const banned: readonly RegExp[] = [
      /\bDate\b/,
      /\bperformance\s*\./,
      /Math\s*\.\s*random/,
      /\brandom\b/i,
      /\bshuffle\b/i,
      /\bweightedPick\b/i,
      /\bweight/i,
      /\bseed\b/i,
      /\bdistribution\b/i,
      /\bprobability\b/i,
      /\brarity\b/i,
      /\bgacha\b/i,
      /\bfetch\s*\(/,
      /\bprocess\b/,
      /\bwindow\b/,
      /\bdocument\b/,
      /\blocalStorage\b/,
      // Exact-match on the bare `react` specifier — NOT a prefix match. The
      // prefix form `/from ['"]react/` also matched `from 'react-native'`,
      // because "react-native" starts with the literal string "react". Until
      // GDD §5.13 presentation Phase 1 no shipped module here had ever
      // needed a bare `react` import (the project's `jsx: react-jsx`
      // transform supplies the JSX runtime at build time with no explicit
      // import), so this stayed a real ban on that one specifier with no
      // exception. `FloorGrid.tsx` (`./FloorGrid`) is the first genuine one:
      // it is this directory's one component that needs a stateful hook
      // (`useRef`/`useState`, for a live drag gesture — its own header
      // explains why `GymScreen.tsx` itself cannot be where that hook
      // lives), and a hook is a named export of `react` rather than a value
      // ambient the way JSX itself is. The exemption below is scoped to
      // exactly that one (file, pattern) pair — every other shipped module,
      // and every other pattern against `FloorGrid.tsx` itself, is still
      // driven through unchanged.
      /from ['"]react['"]/,
    ];
    // The documented exemptions from the scan below — (file, pattern) pairs,
    // not file-wide carve-outs, so each exempted file is still checked against
    // every other pattern.
    const REACT_IMPORT_BAN_EXEMPT_FILES: readonly string[] = ['FloorGrid.tsx'];
    // THE SECOND EXEMPTION, AND IT IS A NAMING CARVE-OUT RATHER THAN A LICENCE.
    // GDD §5.13 presentation Phase 3's `floorSim.ts` carries an explicit seed
    // in its own state, and every choice it makes — which station a member
    // targets, how long it uses it, which way it wanders — is a pure function
    // of that seed, the tick and the member index. The word is the honest name
    // for that value.
    //
    // Why the ban exists, and why this does not breach it: the pattern list is
    // GDD §12.3's no-gacha refusal, and `empireTuning.ts`'s own prose ("there
    // is no seed, no weight and no distribution anywhere in this file") is what
    // put `seed` on it. That claim is about the TUNING module and is still
    // enforced — this pair is scoped to `floorSim.ts` alone. The patterns that
    // carry the refusal itself (`Math.random`, `random`, `shuffle`,
    // `weightedPick`, `probability`, `rarity`, `gacha`, `Date`) all still run
    // against `floorSim.ts`, and so does `weight` and `distribution`.
    //
    // The alternative was renaming the field to something the scan does not
    // match. It was refused: this file's own warning is that a scan for words
    // is a scan for authors who cooperate, and renaming a seed to hide it from
    // a randomness ban is the cooperating author writing the evasion. The
    // exemption is the visible edit a reviewer sees instead.
    //
    // What says the value is not chance: `floorSim.test.ts`'s `produces a
    // byte-identical run from the same seed and context`, beside `moves a
    // pinned number of FIRST TARGETS when only the seed changes`, which pins
    // 4, 6 and 3 of 8 against a control of 0 — a reproducible variation key
    // rather than a roll.
    const SEED_BAN_EXEMPT_FILES: readonly string[] = ['floorSim.ts'];
    let scanned = 0;
    let checks = 0;
    let exemptions = 0;
    for (const name of shipped) {
      const source = readFileSync(path.join(HERE, name), 'utf8');
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      // The strip is checked rather than assumed, so a scan over an empty
      // string cannot pass silently.
      expect(code.length, `${name} stripped to nothing`).toBeGreaterThan(0);
      expect(code, `${name} lost its declarations to the comment strip`).toMatch(/export /);
      for (const pattern of banned) {
        if (
          REACT_IMPORT_BAN_EXEMPT_FILES.includes(name) &&
          pattern.source === "from ['\"]react['\"]"
        ) {
          exemptions += 1;
          continue;
        }
        if (SEED_BAN_EXEMPT_FILES.includes(name) && pattern.source === '\\bseed\\b') {
          exemptions += 1;
          continue;
        }
        expect(code, `${name} must not reach ${String(pattern)}`).not.toMatch(pattern);
        checks += 1;
      }
      scanned += 1;
    }
    // Counts, not bounds: how many files and how many (file, pattern) pairs
    // actually ran.
    //
    // The line here was `expect(banned.length).toBe(18)` — a count of an array
    // literal declared twenty lines above, which no state of `src/empire/` could
    // move. What it was reaching for is the product, and the product has a
    // SUBJECT in it: a module added to this directory, or one that stopped
    // being read, moves 36 as surely as a shortened ban list does.
    expect(scanned).toBe(shipped.length);
    // The product minus the one documented exemption above — not a bound,
    // because `exemptions` is itself pinned on the next line, so a second
    // exemption sneaking in moves BOTH numbers and neither can absorb it
    // alone.
    // 1 -> 2: GDD §5.13 presentation Phase 3's seed pair, above.
    expect(exemptions).toBe(2);
    expect(checks).toBe(shipped.length * banned.length - exemptions);
    // And the patterns are not all dead letters: each one is driven against a
    // string that should trip it, derived from the pattern's own purpose, so a
    // regex that stopped matching anything is red rather than quietly green.
    const tripwires: readonly string[] = [
      'const now = Date.now();',
      'performance . now()',
      'Math.random()',
      'const r = random();',
      'shuffle(list)',
      'weightedPick(list)',
      'const w = weights[0];',
      'const seed = 7;',
      'const distribution = [];',
      'const probability = 0.5;',
      'const rarity = 3;',
      'gacha()',
      'fetch (url)',
      'process.env',
      'window.alert',
      'document.body',
      'localStorage.getItem',
      "import x from 'react';",
    ];
    // `expect(tripwires.length).toBe(banned.length)` was here and is gone: two
    // arrays declared eight lines apart in this test, compared with each other.
    // The loop below is what the pairing needs — a short `tripwires` makes
    // `tripwires[index]` undefined and `toMatch` throws — and a long one is
    // extra strings nothing reads. Neither direction is a fact about
    // `src/empire/`, which is what the deleted line read as. The loop's own
    // domain is pinned by `checks` above, through `shipped.length`.
    for (const [index, pattern] of banned.entries()) {
      expect(tripwires[index], `pattern ${String(pattern)} matches nothing`).toMatch(pattern);
    }
  });

  it('fences every branded quantity in its own declaration', () => {
    // The vitest half of the `@ts-expect-error` directives at the top of this
    // file, and the thing five of them did not have. A brand is erased at
    // runtime, so no value this module produces can tell whether a parameter
    // was declared `UnacceleratedSeconds` or `number` — which is exactly why
    // `expect(typeof wrong).toBe('number')` sat under three directives and
    // could not have gone red under any of them. What vitest CAN read is the
    // declaration, so the declaration is what is pinned here.
    //
    // Plainly: this is a companion, not the grader. `tsc --noEmit` grades the
    // directives. This reddens on the same edits that make them unused —
    // widening a branded parameter or return type to its primitive — so the two
    // go red together instead of one going quiet while the other stays green.
    const code = readFileSync(path.join(HERE, 'empireCore.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(code.length, 'empireCore.ts stripped to nothing').toBeGreaterThan(0);
    expect(code).toMatch(/export function /);

    // Part 1 — `Unbranded<N>`, on every parameter the CENSUS says needs it,
    // rather than on everything spelled `as*`.
    //
    // The enumeration here was `/export function (as[A-Z]\w*)<[^{]*\{/g`, and
    // that regex is why this check could not see the defect it was written for:
    // `createEmpireClock` and `createNpcLifter` return brands, took bare
    // numbers, and are not spelled `as*`. The producer list now comes from
    // `brandCensus`, which asks the compiler what a function RETURNS, so the
    // set this loop walks cannot go stale against a name.
    //
    // What this adds on top of the census's own fault list is the SPELLING: the
    // census says the slot refuses a brand, this says it refuses it by carrying
    // `Unbranded<...>` rather than by some other accident of inference. The two
    // go red together, which is the point — one is the compiler's verdict and
    // one is a line a reader can find.
    const census = brandCensus();
    const rawSlots = producers(census).flatMap((fn) =>
      fn.slots.filter((slot) => slot.kind === 'raw-only').map((slot) => ({ fn: fn.name, slot })),
    );
    const declarationOf = (name: string): string => {
      const found = [...code.matchAll(new RegExp(`export function ${name}(<[^{]*)?\\(`, 'g'))];
      expect(found.length, `${name} is declared ${found.length} times, not once`).toBe(1);
      const at = (found[0] as RegExpMatchArray).index as number;
      return code.slice(at, code.indexOf('{', at));
    };
    let guarded = 0;
    for (const { fn, slot } of rawSlots) {
      expect(
        declarationOf(fn),
        `${fn}(${slot.parameter}) accepts a bare primitive without an Unbranded guard`,
      ).toMatch(new RegExp(`${slot.parameter}:[^,)]*&\\s*Unbranded<`));
      guarded += 1;
    }
    // Counts, not bounds: how many producing slots take a raw primitive at all.
    // A census that found no producers, or producers with no raw slots, would
    // walk nothing here.
    expect(guarded).toBe(20);
    expect(rawSlots.map(({ fn, slot }) => `${fn}(${slot.parameter})`).sort()).toEqual([
      'applyAccelerant(seconds)',
      'asAcceleratedSeconds(value)',
      'asDisplayName(value)',
      'asFaultMessage(value)',
      'asGymBucks(value)',
      'asGymId(value)',
      'asIdleTenureDays(value)',
      'asInjuryDaysSaved(value)',
      'asNpcId(value)',
      'asReputation(value)',
      'asTrainingIq(value)',
      'asUnacceleratedSeconds(value)',
      'createEmpireClock(elapsedSeconds)',
      'createEmpireClock(skippedSeconds)',
      'createNpcLifter(displayName)',
      'createNpcLifter(id)',
      'createNpcLifter(joinedAt)',
      'createNpcLifter(settledAt)',
      'spaceLevelCost(level)',
      'staffLevelCost(level)',
    ]);
    // `buildSeconds` is guarded too and is NOT on that list, because it returns
    // a bare `number` and is therefore not a producer. Kept as its own line
    // rather than left out: the census's rule is about producers, and applying
    // the guard more widely than the rule requires is a decision somebody made
    // on purpose — see the note on `buildSeconds` itself.
    expect(declarationOf('buildSeconds')).toMatch(/level:[^,)]*&\s*Unbranded</);
    expect(producers(census).map((fn) => fn.name)).not.toContain('buildSeconds');

    // Part 2 — the derived quantities. One row per function whose argument list
    // or return type IS the fence, including both arms of the tenure pair,
    // which shipped returning one brand between them.
    const fences: readonly {
      readonly symbol: string;
      readonly parameters: readonly string[];
      readonly returns: string;
      readonly brands: readonly string[];
    }[] = [
      {
        symbol: 'idleTenureDays',
        parameters: ['lifter: NpcLifter', 'now: AcceleratedSeconds'],
        returns: 'IdleTenureDays',
        brands: ['AcceleratedSeconds', 'IdleTenureDays'],
      },
      {
        symbol: 'settledTenureDays',
        parameters: ['lifter: NpcLifter', 'now: UnacceleratedSeconds'],
        returns: 'SettledTenureDays',
        brands: ['UnacceleratedSeconds', 'SettledTenureDays'],
      },
      {
        symbol: 'settledLevel',
        parameters: [
          'completionTimes: readonly UnacceleratedSeconds[]',
          'now: UnacceleratedSeconds',
        ],
        returns: 'SettledLevel',
        brands: ['UnacceleratedSeconds', 'SettledLevel'],
      },
      {
        symbol: 'physioDaysSavedFor',
        parameters: ['level: SettledLevel'],
        returns: 'InjuryDaysSaved',
        brands: ['SettledLevel', 'InjuryDaysSaved'],
      },
    ];
    let fenced = 0;
    let parametersPinned = 0;
    for (const fence of fences) {
      const found = [
        ...code.matchAll(new RegExp(`export function ${fence.symbol}\\(([^)]*)\\):\\s*(\\w+)`, 'g')),
      ];
      // Counts, not presence: a pattern with a second witness in the file is
      // the textual pin that survives its own mutation.
      expect(found.length, `${fence.symbol} is declared ${found.length} times, not once`).toBe(1);
      const declaration = found[0] as RegExpMatchArray;
      for (const parameter of fence.parameters) {
        expect(
          declaration[1] ?? '',
          `${fence.symbol} no longer takes \`${parameter}\` — the brand fence widened`,
        ).toContain(parameter);
        parametersPinned += 1;
      }
      expect(
        declaration[2] ?? '',
        `${fence.symbol} no longer returns ${fence.returns}`,
      ).toBe(fence.returns);
      // A row may not name a type that is not a brand in this module, so a
      // fence written against a widened or invented alias is red rather than
      // trivially satisfied by whatever text happens to be there.
      for (const brand of fence.brands) {
        expect(code, `${brand} is not a branded type in this module`).toMatch(
          new RegExp(`export type ${brand} = Branded<`),
        );
      }
      fenced += 1;
    }
    expect(fenced).toBe(4);
    expect(parametersPinned).toBe(7);
    // The two tenure arms return DIFFERENT brands. One brand between them is
    // the state this shipped in, and it is the state this line refuses.
    expect(new Set(fences.map((fence) => fence.returns)).size).toBe(fences.length);
  });

  it('gives every type-only directive in this file a covering test, by census', () => {
    // The header of this file makes a behavioural claim about the file, and it
    // was false five times over: directives sat above
    // `expect(typeof x).toBe('number')` twice and above three assertions that
    // the constructors still mint the same number, none of which any state of
    // `empireCore.ts` could have reddened.
    //
    // What this check is, exactly. It is a CENSUS: it counts the directives,
    // attributes each to the test it sits in, and pins both. It cannot prove
    // the covering test bites — CLAUDE.md's own note is that a pointer to a
    // test that cannot fail is the same defect one level out, and the mutation
    // evidence for these lives in the report rather than here. What it does
    // stop is a directive arriving in a test nobody signed for, which is how
    // the five got in.
    //
    // The token is built rather than written: a pattern containing it matches
    // itself, which is the self-referential vacuity shape this file's own
    // header warns about.
    const token = ['@ts', 'expect', 'error'].join('-');
    const source = readFileSync(fileURLToPath(import.meta.url), 'utf8');
    const directiveLine = new RegExp(`^\\s*//\\s*${token}`);
    const itLine = /^\s+it\((['"`])(.*?)\1,\s/;

    let current: string | null = null;
    let directives = 0;
    const carriers = new Map<string, number>();
    for (const line of source.split('\n')) {
      const title = itLine.exec(line);
      if (title !== null) current = title[2] as string;
      if (!directiveLine.test(line)) continue;
      directives += 1;
      expect(current, `a directive outside any it() block: ${line.trim()}`).not.toBeNull();
      const key = current as string;
      carriers.set(key, (carriers.get(key) ?? 0) + 1);
    }

    expect(directives).toBe(26);
    expect(carriers.size).toBe(10);
    expect([...carriers.values()].reduce((total, n) => total + n, 0)).toBe(directives);
    // The tests that carry them, pinned by title. A directive added to a test
    // not on this list is red, and a title edited without touching the list is
    // red too — which is the point, because the title is what a reader uses to
    // find the covering assertions.
    expect([...carriers.keys()].sort()).toEqual([
      'refuses a bare number where a settled level is required',
      'refuses a re-brand, which is how the argument list above was walked around',
      'refuses an accelerant whose type has widened to the union, in all three spellings',
      'refuses an accelerated clock where a wall clock is required, on every arm',
      'refuses every route the exploit reproduction took — the laundering regression',
      'refuses one tenure brand where the other is required — hazard 1’s derived quantity',
      'refuses the Training IQ path, in both graders — GDD §8.3B into §5.2, hazard 1',
      'refuses the illegal pairing as an object literal — the fence inference cannot move',
      'refuses the physio path, in both graders — GDD §5.4 into §3.5, hazard 2',
      'refuses the same two on `applyAccelerant`, which is the branch below',
    ]);
  });

  /**
   * The pattern a person's name takes inside prose — two adjacent Titlecase
   * words. One source string, so the ban predicate below (`personShaped`) and
   * the pair extractor cannot drift apart: the census asserts
   * `personShaped.source` equals this text.
   */
  const TITLECASE_PAIR_SOURCE = String.raw`\b[A-Z][a-z]+ [A-Z][a-z]+\b`;

  /** Every Titlecase pair in `text`, in order, non-overlapping. */
  function titlecasePairsIn(text: string): readonly string[] {
    return text.match(new RegExp(TITLECASE_PAIR_SOURCE, 'g')) ?? [];
  }

  /**
   * The three quote-keyed collectors, factored so the driven fixture below
   * exercises the same predicates the shipped census runs — the patterns are
   * byte-identical to the ones that used to sit inline in the census loop,
   * and the three count pins there (172 / 0 / 139) are what says the move
   * changed no behaviour. Comments are stripped first, as before, because a
   * quoted example inside prose is not a shipped string.
   */
  function quoteKeyedStringsIn(source: string): {
    readonly singleQuoted: readonly string[];
    readonly doubleQuoted: readonly string[];
    readonly templateChunks: readonly string[];
  } {
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const singleQuoted: string[] = [];
    const doubleQuoted: string[] = [];
    const templateChunks: string[] = [];
    for (const match of code.matchAll(/'([^'\\\n]*)'/g)) singleQuoted.push(match[1] as string);
    for (const match of code.matchAll(/"([^"\\\n]*)"/g)) doubleQuoted.push(match[1] as string);
    // The static text of a template, with each `${...}` replaced by a space
    // so two words either side of a substitution are not run together into a
    // false match.
    for (const match of code.matchAll(/`((?:[^`\\]|\\[\s\S])*)`/g)) {
      templateChunks.push((match[1] as string).replace(/\$\{[^}]*\}/g, ' '));
    }
    return { singleQuoted, doubleQuoted, templateChunks };
  }

  /**
   * The fourth collector: bare JSX text. It carries no quote character, so
   * none of the three quote-keyed predicates can see it — measured (E39):
   * `<span>Sponsored by Placeholder Lifter</span>` in a compiled, walked
   * `.tsx` on the real tree left this census green and put the name in no
   * failure message anywhere in the suite. The route is a parse, not a regex,
   * and the ScriptKind is inferred from `fileName` (no fifth argument — the
   * E38 shape): the identical text parsed under a `.ts` name yields zero
   * JsxText nodes, so a hardcoded kind would empty this collector without an
   * error. Both facts are driven in the fixture test below rather than
   * trusted. (When this collector was written the shipped tree had zero
   * `.tsx` files, so the shipped pins alone could not tell a working
   * collector from a deleted one; `ladderView.tsx` has since given the
   * shipped census a real domain, and the fixture drive is kept because it
   * covers the catching case — a person-shaped chunk — which the shipped
   * copy deliberately never contains.)
   *
   * It parses the original source, not the comment-stripped `code` above:
   * the line-comment strip would corrupt JSX text containing `//`, and the
   * parser handles comments itself.
   *
   * It refuses a dirty parse rather than walking the wrong tree (E41).
   * `ts.createSourceFile` does not throw on broken or mis-kinded source — it
   * returns a smaller, wrong tree and lands its complaints on the non-public
   * `parseDiagnostics` array that nothing in the product reads, so a walked
   * `.tsx` that mis-parses would yield fewer JsxText nodes with every pin
   * green. `empireForbiddenOutput.test.ts`'s `parses every walked source
   * clean` covers exactly `chainScanFiles()` — the compiler-importing files —
   * and this collector walks a different set (`tsFilesUnder` filtered to
   * `.tsx`), so it reads the same array itself. Written one round after that
   * guard, this collector was the literal one-reader-fixed-sibling-not
   * pattern until this read arrived. Non-vacuity for the throw is a driven
   * broken `.tsx` in the fixture test below; the mis-kind drive there shows
   * the same route that used to yield a silent `[]` is now a loud stop.
   */
  function jsxTextChunksIn(fileName: string, text: string): readonly string[] {
    const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.ES2022, true);
    const diagnostics =
      (source as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? [];
    if (diagnostics.length > 0) {
      const first = ts.flattenDiagnosticMessageText(diagnostics[0]?.messageText ?? '', ' ');
      throw new Error(
        `${fileName} parsed dirty (${String(diagnostics.length)} syntactic diagnostics; first: ${first}); a census over its tree would under-count`,
      );
    }
    const chunks: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isJsxText(node) && node.text.trim().length > 0) {
        chunks.push(node.text.replace(/\s+/g, ' ').trim());
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    return chunks;
  }

  /**
   * The fourth collector pointed at a tree: every `.tsx` the same walk the
   * census uses hands back, gated on the extension because JsxText is a node
   * kind only a TSX parse produces. The census below calls this at `HERE`;
   * the fixture test calls it at a probe root — so the drive is about the
   * shipped scan rather than about a copy of it.
   */
  function jsxTextCensusUnder(root: string): {
    readonly jsxFilesRead: number;
    readonly chunks: readonly string[];
  } {
    const chunks: string[] = [];
    let jsxFilesRead = 0;
    for (const name of tsFilesUnder(root, 'without-tests')) {
      if (!name.endsWith('.tsx')) continue;
      jsxFilesRead += 1;
      chunks.push(...jsxTextChunksIn(name, readFileSync(path.join(root, name), 'utf8')));
    }
    return { jsxFilesRead, chunks };
  }

  it('ships no string a real name could be hiding in, and pins the ones it does ship', () => {
    // GDD §12.3 refuses a real, named athlete, brand or company in any string
    // or code path, and `empireTuning.ts` claims in prose that no lifter, gym,
    // sponsor, federation or equipment-brand name appears in it. That sentence
    // had no scan behind it, which is the condition CLAUDE.md says produces the
    // next defect.
    //
    // What this catches, and what it does not. No scan can tell a real name from
    // an invented one — that is the human, name-by-name pass §12.3 asks for on
    // every piece. What these two halves do is make a name ARRIVING visible:
    // the first pins every space-free literal in the shipped modules exactly,
    // so a new vocabulary token is a decision somebody signs rather than a diff
    // nobody reads; the second bans a `Capitalised Capitalised` pair anywhere,
    // which is the shape a person's name takes inside a message, where the
    // first half does not look. Neither half adjudicates. Both make the
    // adjudication happen.
    // THE SECOND HALF READ NO MESSAGE THIS MODULE WRITES. `literals` was built
    // from `/'...'/` alone, so it held vocabulary tokens and nothing else —
    // every runtime message in `empireCore.ts` is a TEMPLATE literal, and every
    // one of them was invisible. Appending `, already used by Placeholder
    // Lifter` to the duplicate-id fault — a person-shaped name, invented, of
    // exactly the shape a real one would take — left both halves green and left
    // the count pin at 64, so the sentence claiming this half "looks inside a
    // message, where the first half does not look" was describing a scan of an
    // empty domain. The three collectors below are the domain, and the counts
    // are pinned per collector so one going quiet is red on its own line.
    //
    // The name used to run that mutation is invented, and that is not a style
    // choice: a real lifter's name written into a comment here is GDD §12.3's
    // last refusal condition in a code path, which `src/licensing/realIp.ts`
    // scans the whole tree for. It caught one on the way in.
    const singleQuoted = new Set<string>();
    const doubleQuoted = new Set<string>();
    const templateChunks = new Set<string>();
    let filesRead = 0;
    for (const name of shipped) {
      const source = readFileSync(path.join(HERE, name), 'utf8');
      const found = quoteKeyedStringsIn(source);
      for (const value of found.singleQuoted) singleQuoted.add(value);
      for (const value of found.doubleQuoted) doubleQuoted.add(value);
      for (const value of found.templateChunks) templateChunks.add(value);
      filesRead += 1;
    }
    expect(filesRead).toBe(shipped.length);
    // The fourth collector, run over the same walk. Its domain since
    // `ladderView.tsx` landed: one shipped `.tsx`, and every bare-JSX-text
    // chunk in it is SIGNED below as an exact list — the form the note that
    // used to sit here asked the first raiser of the old zero pin to choose
    // ("an exact chunk list, not a count", E40/E41), because a count's diff
    // is a number while a list's diff is the string itself. A new or edited
    // visible sentence in the view is a row somebody signs here by name, the
    // same shape as the `spaceFree` pin below; this census adjudicates
    // nothing, it makes the adjudication happen. The driven fixture test
    // that follows still carries the collector's non-vacuity on a probe
    // tree, and the list here is its non-vacuity on the shipped one.
    const jsxCensus = jsxTextCensusUnder(HERE);
    const SIGNED_JSX_TEXT_CHUNKS: readonly string[] = Object.freeze([
      // FloorGrid.tsx, in tree order — first of all, because `tsFilesUnder`
      // sorts and a capital `F` sorts before every other shipped `.tsx`
      // module name here, GymScreen.tsx included. Transcribed from a driven
      // run of this exact census (`jsxCensus.chunks.join(' | ')` on the
      // failing assertion), not typed by hand against the source, for the
      // same reason the GymScreen.tsx note below gives.
      //
      // GDD §5.14 STAGE C.1 REORDERED THIS FILE'S TOP TWO CHUNKS, AND MOVED
      // THE DIAGNOSTIC BREAKDOWN DOWN. `floorgrid-caption` used to be the
      // ONE chunk-producing caption, both identity and diagnostic in one
      // Text; it is now a short identity-only line (`'floor ('`, `')'`,
      // straddling `{floor.rung}` with nothing after it) and the raw
      // tile/fixed/placed/unplaced breakdown moved into the new
      // `floorgrid-diagnostics` block, behind the `floorgrid-diagnostics-
      // toggle` control — see that chunk's own arrival further down. This
      // census reads the SOURCE AST, not a runtime render, so the
      // diagnostics block's chunks are present here regardless of the
      // toggle's default-collapsed state; only their POSITION moved.
      // Stage C.1b: the identity caption is now a JSX expression
      // (`buildMode ? … : …`), so it is not JsxText. The `(fixed)` label is
      // gone — starting Barbell is player-positionable. Transcribed from a
      // driven run of this census.
      // Stage C.1d: the silent `can't place here` overlay and on-chip `x`
      // remove control are gone. Placement chrome is the Moving banner and
      // Cancel, and refusal copy is an expression from stationView.ts.
      'Moving:',
      'Cancel',
      // GDD §5.18 Stage D.1b: the "bench bay" / "second bench" world labels
      // are explicit station tap targets (raised above members). AST order:
      // both live in the grid after Moving/Cancel, before the ambient caption.
      'bench bay',
      'second bench',
      // GDD §5.13 presentation Phase 2: the ambient-member caption, in tree
      // order — rendered after the grid's ScrollView and before the tray,
      // which is why it lands between the placed-item remove control's 'x'
      // and the tray's own empty/non-empty text.
      'member(s) around the gym',
      // C.1c: the Build tray now sits above the diagnostics block so the
      // inventory is next to the gym rather than under a developer readout.
      'unplaced — tap a piece, then tap a tile on the gym',
      'floor (',
      ') —',
      'x',
      'tiles,',
      'furniture,',
      'placed,',
      'unplaced',
      'close',
      // GDD §5.14 Stage C: the contextual station panel, the last thing
      // FloorGrid.tsx's own JSX returns, so its chunks land after every
      // other chunk in this file rather than interleaved with them.
      // Transcribed from a driven run of this exact census, same discipline
      // as every entry above. Most of the panel's text sits inside `{...}`
      // expression containers (a ternary or a template literal) rather than
      // as plain JsxText, so this collector — bare JsxText only — sees far
      // fewer chunks than the panel's own JSX has lines; the `{' '}`-joined
      // static fragments are what land here.
      'Condition',
      '% — repair',
      'gym bucks',
      'the standing maintenance review is currently about this item',
      // GDD §5.14 Stage C — the repair arm's own gate, S4f-consistent
      // (`isSound` then a purse comparison), written as plain JSX text with
      // `{}` expressions rather than a template literal, which is why these
      // three land here rather than in `templateChunks` below.
      // GDD §5.14 STAGE C.1a: reworded from 'as new — nothing to repair'.
      // The human's brief named this exact wording as overstating the
      // routine-maintenance threshold — an item can be well below full
      // condition and still read "as new" here, and did — so the text now
      // describes the actual mechanic (no routine repair is currently
      // offered) instead of claiming a condition the threshold does not
      // establish.
      'no routine maintenance needed — nothing to repair',
      'needs',
      'gym bucks — you have',
      'repair for',
      'remove from the floor',
      'move to the tray',
      'close',
      // GDD §5.18 Stage D.1: the equipment panel, distinct from the
      // station panel. Tap bar/plates → inspect/move/condition; tap the
      // bay → Q/C/T. Transcribed from this census.
      'Condition',
      '%',
      'repair for',
      'move to the tray',
      'close',
      // GymScreen.tsx, in tree order — second, because a capital `G` sorts
      // before every lowercase shipped module name, GymScreen.tsx's chunks
      // come before ladderView.tsx's below rather than after it. Transcribed
      // the same way as the block above.
      //
      // GDD §5.14 Stage C reordered this file's AST, which is what moves
      // every chunk below rather than only the ones whose TEXT changed —
      // read that as this census doing its job (a position move is a real
      // finding) rather than as churn. The rung/rate and money group now
      // leads (it was fourth and fifth before), the floor caption follows
      // immediately (new text, see below), and the week/lifts/accrual/
      // refusal chunks that used to lead now trail it. Transcribed from a
      // driven run of this exact census, same discipline as every entry in
      // this list.
      // Player HUD is now expressions from stationView.ts (location, purse,
      // rate, reputation). The six rung/earning/clock JsxText chunks that
      // used to lead this file are gone from Play; clock/accelerated remain
      // on the developer route below.
      'maintenance review',
      'refused:',
      // S4b — §5.11 stage 4 on the garage floor. Fifty-two new chunks, all
      // in `GymScreen.tsx`'s new management section, transcribed from a driven
      // run of this exact census rather than typed against the source, the
      // same discipline every other entry in this list carries.
      //
      // WHAT A REVIEWER IS SIGNING HERE, since this is the list that makes the
      // adjudication happen: player-facing sentences about equipment
      // condition, the standing repair order and its price, the three answers
      // to it, the failure ledger, the three manager tiers and their wages,
      // dormancy and the way back out of it. None of them names a person, a
      // brand or a company, and none of them tells a player that being away
      // cost them anything — `docs/GDD.md` §5.7's clarification forbids the
      // second, and this list is where a sentence that broke it would have to
      // arrive in the open.
      'No manager hired',
      ': hire',
      'gym bucks, wage',
      '/hour,',
      'Role: manager',
      'Specialty:',
      'Assignment: not hired',
      'Effect:',
      'Next: hire if the purse covers it',
      'needs',
      'gym bucks — you have',
      'hire',
      'manager:',
      '—',
      'gym bucks per banked hour,',
      'Role:',
      'Specialty:',
      'Assignment: on staff',
      'Effect:',
      'Next: let them go',
      'let them go',
      'Role: member',
      'Specialty:',
      'Assignment:',
      'Effect:',
      ';',
      ';',
      'Next:',
      'gym status:',
      'Equipment condition:',
      '%',
      'Full repair:',
      'gym bucks',
      'Needs attention:',
      'maintenance review:',
      'at',
      '% — repair costs',
      'gym bucks',
      'this one is already as new — there is nothing to pay for',
      'needs',
      'gym bucks — you have',
      'repair for',
      'not now',
      'decline the repair',
      'counted decision(s)',
      'at',
      's, price shown',
      'gym bucks',
      'open for business —',
      'dormant — everything reopening asks for is done',
      'dormant — still needed:',
      'reopening would cost',
      // THE ONE THE HUMAN CALLED WRONG RATHER THAN USELESS. This block drew a
      // reopening price and a "reopen the gym" control directly under "open
      // for business — sound". The price is quoted only for a gym that is
      // actually shut, the control is offered only where `recoverGym` does
      // not refuse, and the reopen COUNT — history rather than an offer — is
      // its own sentence now, drawn once there is one.
      'gym bucks in repairs',
      // GDD §5.14 STAGE C.1a: the two new chunks this round adds anywhere in
      // the tree. `gymscreen-recovery-blocking`, drawn only in the `blocked`
      // arm with equipment still below `RECOVERY_CONDITION_MIN` — the
      // actionable-remedy pointer the human's brief asked for, naming which
      // stations are keeping the gym shut and where to go fix them, rather
      // than only quoting a total the screen has no control to spend.
      'blocking reopening:',
      '— tap one on the floor to repair it',
      'reopen the gym',
      'this gym has reopened',
      'time(s)',
      // GDD §5.14 STAGE C.1: the eleven chunks that used to sit here
      // (`gymscreen-check-in-costs` and its own auto-repair `.map`) are
      // relocated, not deleted — see the new `gymscreen-diagnostics` block,
      // byte-identical, right before this file's dev-controls chunk below.
      'gym bucks ·',
      'owned',
      'not here yet — fits from',
      'and this gym is',
      'needs',
      'gym bucks — you have',
      'buy',
      '·',
      'gym bucks ·',
      'owned',
      'not here yet — fits from',
      'and this gym is',
      'needs',
      'gym bucks — you have',
      'buy',
      // S4b: this sentence used to say the portfolio arrives with stage
      // four. Stage 4 is on the screen above it now and the portfolio is
      // still paused, so it said the wrong thing in a new way. Only
      // `GymScreen.tsx`'s copy changed; `LadderView` and `GymView` are the
      // closed stage-1/stage-2 dev harnesses and keep theirs, below.
      'top of the ladder - staffing, maintenance and the failure state are above; the portfolio stays paused',
      'next:',
      'for',
      'gym bucks',
      // `moveUpLadder`'s own `'not-enough-gym-bucks'` arm — a cold gym holds 0
      // against a 2500 move, so the relocate control was the first dead
      // press on the screen and is now the price it cannot meet.
      'needs',
      'gym bucks — you have',
      'relocate',
      'week',
      '(',
      'fixed +',
      'flexible =',
      'sessions) —',
      'lifts unlocked:',
      'available now:',
      'slot',
      ':',
      '—',
      'week',
      ':',
      '—',
      // GDD §5.14 STAGE C.1 — the new `gymscreen-diagnostics` block, directly
      // above this file's dev-controls chunk (also unmoved: already correctly
      // last). Relocated onto the explicit developer route this round, still
      // byte-identical except clock/accelerated which moved here from the
      // player HUD.
      'engine detail — not needed to play, kept here for verification',
      'accelerated:',
      'clock:',
      'no maintenance review open',
      'Needs attention: none',
      '0 counted decision(s)',
      'last advance banked',
      's of',
      's, paid',
      'gym bucks, cap discarded',
      's',
      'since the last update: condition took',
      'gym bucks off the accrual and paid',
      'at',
      ', wore the gym down by',
      ', paid',
      'in wages (unpaid',
      '), and the manager repaired',
      'item(s) for',
      'your manager repaired',
      'for',
      'gym bucks',
      'not part of the game. Watched buttons pay the online garage rate. Away buttons pay the offline fraction, the same as leaving the app. The week-boundary jump is away. Reset gym starts a new opening garage.',
      '+1 week boundary',
      'reset gym',
      // ladderView.tsx, in tree order: the header line, the money line, the
      // capability line, the accrual report, the refusal line, the shop, the
      // relocation line, and the visibly-labelled dev control.
      'the ladder',
      'rung',
      'earning',
      'gym bucks per hour',
      'gym bucks:',
      'clock:',
      'lifts unlocked:',
      'last advance banked',
      's of',
      's, paid',
      'gym bucks, cap discarded',
      's',
      'refused:',
      'costs',
      'gym bucks, fits from',
      'buy',
      'top of the ladder - the portfolio arrives with stage four',
      'next:',
      'for',
      'gym bucks',
      'relocate',
      'dev control',
      'not part of the game. Watched buttons pay the online garage rate. Away buttons pay the offline fraction. Neither is a player mechanic.',
      // GymView, in tree order, appended below `LadderView` rather than
      // interleaved — the file is grown by addition (this component's own
      // header explains why), and the walk reads the file top to bottom.
      'the gym',
      'week',
      '(',
      'fixed +',
      'flexible =',
      'sessions) —',
      'rung',
      'earning',
      'gym bucks per hour',
      'gym bucks:',
      'accelerated:',
      'clock:',
      'lifts unlocked:',
      'last advance banked',
      's of',
      's, paid',
      'gym bucks, cap discarded',
      's',
      'refused:',
      'costs',
      'gym bucks, fits from',
      'buy',
      '(',
      ') costs',
      'gym bucks, fits from',
      'buy',
      'top of the ladder - the portfolio arrives with stage four',
      'next:',
      'for',
      'gym bucks',
      'relocate',
      "this week's allocation",
      'available now:',
      'slot',
      ':',
      '—',
      'if this week ended now: residual carry',
      ', injury chance',
      ', technique bonus',
      ', ceiling growth',
      'week',
      ':',
      '— residual carry',
      ', injury chance',
      ', technique bonus',
      ', ceiling growth',
      'dev control',
      'not part of the game. Watched buttons pay the online garage rate. Away buttons pay the offline fraction. The week-boundary jump is away (offline). Neither is a player mechanic.',
      '+1 week boundary',
    ]);
    expect(jsxCensus.chunks, jsxCensus.chunks.join(' | ')).toEqual(SIGNED_JSX_TEXT_CHUNKS);
    expect(jsxCensus.jsxFilesRead).toBe(shipped.filter((name) => name.endsWith('.tsx')).length);
    // 1 -> 2: GymScreen.tsx is the second shipped `.tsx`. 2 -> 3:
    // FloorGrid.tsx is the third.
    expect(jsxCensus.jsxFilesRead).toBe(3);
    // Counts before contents, so an empty domain reports itself rather than
    // making the pin below a comparison of two empty lists.
    // 172 rather than 171 since `sealRate`'s label refusal arrived — a fixed
    // sentence with no substitution in it, which is what lets that refusal
    // name an unrecognised label without interpolating one.
    // 246 -> 274: GymView's new testids/action vocabulary and sessions.ts's
    // new refuseWith messages, all single-quoted like everything else here.
    // 274 -> 296: GymScreen.tsx's new `gymscreen-*` testID vocabulary and
    // label strings, measured by running this exact assertion rather than
    // hand-counted against the source.
    // 296 -> merged: §5.6's five member-type vocabulary tokens
    // (empireTuning.ts's MEMBER_TYPES / MEMBER_TYPE_ITEM_AFFINITY etc.) landed
    // independently of GDD §5.13 presentation Phase 1's floor.ts/FloorGrid.tsx
    // — floor.ts's refusal vocabulary and action-kind strings, and
    // FloorGrid.tsx's `floorgrid-*` testID vocabulary, colour names and
    // style-key strings (including `'relative'`, added once the grid
    // container needed an explicit `position: 'relative'`). Re-measured on
    // the merged tree rather than hand-summed.
    // 331 -> 335: GDD §5.13's PLAYTEST 2 ruling — FloorGrid.tsx's new
    // `'floorgrid-tray-empty'` testID and `'dimgray'` fixed-furniture colour,
    // plus its two new empty-tray copy strings. Measured by running this
    // assertion and reading the failure value.
    // 335 -> 337: PLAYTEST 3's overlap-refusal ruling — FloorGrid.tsx's new
    // `'floorgrid-drop-refused'` testID and `'crimson'` refusal-outline
    // colour. The refusal MESSAGE itself ("can&apos;t place here") is JSX
    // text with no surrounding quote characters, so it belongs to (and was
    // already added to) SIGNED_JSX_TEXT_CHUNKS above, not here.
    // 337 -> 344: GDD §5.13 presentation Phase 2 — floor.ts's and
    // FloorGrid.tsx's new `'./members'` import specifier (one new distinct
    // value, shared by both call sites), FloorGrid.tsx's five new
    // `AMBIENT_MEMBER_PALETTE` colours ('coral', 'khaki', 'lightseagreen',
    // 'plum', 'tan' — none a repeat of `PLACEHOLDER_PALETTE`), and its one
    // new `'floorgrid-ambient-caption'` testID. `AMBIENT_MEMBER_BORDER_COLOR`
    // ('black') is NOT new — it duplicates `FLOOR_ITEM_BORDER_COLOR`'s
    // existing value, and this is a set of distinct VALUES, not declarations.
    // Measured by running this assertion and reading the failure value.
    // 344 -> 345: PLAYTEST 4 replaced `AMBIENT_MEMBER_PALETTE`'s five values
    // ('coral', 'khaki', 'lightseagreen', 'plum', 'tan' — the last of which
    // was the "same colour as the floor" defect) with five new ones
    // ('orange', 'gold', 'hotpink', 'chartreuse', 'tomato' — net zero), and
    // added one new colour, `AMBIENT_MEMBER_HEAD_COLOR` ('white'), which is
    // the net +1. Measured by running this assertion and reading the failure
    // value.
    // 345 -> 354: GDD §5.13 presentation Phase 3's `floorSim.ts`. Nine new
    // distinct single-quoted values, measured by running this assertion and
    // reading its failure value: the five `FLOOR_SIM_MEMBER_STATES` tokens
    // ('seeking', 'queuing', 'using', 'leaving', 'interrupted'), the two
    // `FLOOR_SIM_INTERRUPTIONS` tokens ('target-removed', 'target-moved'), the
    // two station-kind tokens ('fixed', 'session'), and its own './floorSim'-
    // adjacent import specifiers — all of which except './floor' already
    // existed as values elsewhere in the directory, which is why the delta is
    // nine and not larger.
    // 354 -> 355: the `route-blocked` interruption cause, GDD §5.13's third
    // cause and this module's own addition to it. One new distinct
    // single-quoted value; `FLOOR_SIM_INTERRUPTIBLE_STATES`'s three tokens are
    // already in this set as member states. Measured by running this assertion
    // and reading its failure value.
    // 355 -> 372: Phase 3's RENDER half. Seventeen new distinct
    // single-quoted values, measured by running this assertion and reading
    // its failure value: the './floorSim' import specifier; six colours
    // ('deepskyblue', 'khaki', 'springgreen', 'silver', 'red' for the five
    // state cues, and 'transparent' for the highlight fill — 'khaki' counts
    // as new because PLAYTEST 4 removed it from `AMBIENT_MEMBER_PALETTE` and
    // it survives only inside a comment, which this scan strips); the three
    // interruption words ('removed', 'moved', 'blocked'); 'claimed', the
    // station-activity token that is not already a member state; the two
    // untemplated testIDs 'floorsim-caption' and 'floorsim-legend'; and the
    // five legend sentences. The five `FLOOR_SIM_MEMBER_STATES` tokens the
    // legend and the cue key off are already in this set, which is why the
    // delta is seventeen and not larger.
    // 372 -> 390: GDD §5.13 presentation Phase 4. floorSprites.ts's new
    // vocabulary (its import specifiers, the pose/facing tokens, the legend
    // and base64 alphabet strings, the PNG chunk names and URI prefix) and
    // FloorGrid.tsx's new testIDs/label colours, LESS the placeholder
    // colour vocabulary the sprite pass retired (PLACEHOLDER_PALETTE's
    // seven colours, the five AMBIENT_MEMBER_PALETTE colours and 'white'/
    // 'dimgray'). Measured by running this assertion and reading its
    // failure value.
    // 390 -> 394: the paint-ops refactor's four op-kind tokens ('fill',
    // 'hatch', 'disc', 'dot'), the shape that replaced parameter-mutating
    // raster helpers. Measured by running this assertion.
    // 394 -> 402: GDD §5.13 P4b — the six using-pose tokens plus 'bar' and
    // 'generic' ('bench' was already an equipment word; the rep frames are
    // booleans, so no one-character literal arrives). Measured by running
    // this assertion and reading its failure value.
    // 402 -> 405: P4c — the 'under' paint-op kind, and the two indexed-access
    // type spellings 'fixedOccupiedGrids'/'fixedOccupiedUris' in
    // floorSprites.ts's table builder ('power-bar' and FloorGrid's 'fixed'
    // were already in the set). Attributed by re-running the collector on
    // each changed file against HEAD, not guessed.
    // 405 -> 452: §5.11 stage 4's `management.ts`. Its import specifiers, the
    // three manager tiers, the three counted-decision tokens, the three
    // failure phases, the five wiring keys, the six policy names, the nine
    // decision-event kinds, the discriminated-return `kind` and `reason`
    // tokens across eight result types, and the two wear bases. Measured by
    // running this assertion and reading its failure value.
    // 452 -> 455: the §5.13 wear-basis ruling's chain break in
    // `management.ts`. Three new tokens: the `'repeat-strike-control'` wiring
    // key, and the two strike-ledger names `'per-order'` and `'per-refusal'`.
    // `'already-refused'`, `'neglected'` and the rest are not literals in the
    // module — they are property names and type members. Measured by running
    // this assertion and reading its failure value, not guessed.
    // 455 -> 459: the §5.7 chain-break round keys the maintenance review to
    // the check-in ordinal. Four new tokens in `management.ts`: the two new
    // wiring keys `'condition-gated-prompt-control'` and
    // `'eager-turnaround-control'`, the two review gates `'ordinal'` and
    // `'condition'`. The new `'already-sound'` prompt-refusal reason is NOT
    // one of them — `repairEquipment` already shipped that literal, so the
    // set is unchanged by it, which is the kind of thing a hand-sum gets
    // wrong. Measured by running this assertion and reading its failure
    // value.
    // 459 -> 498: S4b, §5.11 stage 4 on the garage floor. Thirty-nine new
    // literals, ENUMERATED against the previous commit rather than read off
    // this pin's failure value — a total that only has to match can absorb a
    // literal arriving while another one leaves, and this set is the one a
    // reviewer is meant to read name by name. Nothing was removed. They are,
    // in four groups:
    //   - `GymScreen.tsx`'s new `'./management'` import specifier;
    //   - twenty new `'gymscreen-*'` testIDs, all of them addresses for the
    //     browser check rather than anything a player sees;
    //   - five new dispatch tags (`'repair-item'`, `'answer-prompt'`,
    //     `'hire-manager'`, `'recover-gym'`, and the `'nothing'`/`'no repairs'`
    //     empty-state words), plus six player-facing sentences about what a
    //     refusal is worth, what the ledger holds, and what reopening needs;
    //   - three type-level property names in `ladderView.tsx` — `'state'` and
    //     `'accrual'` from `Omit<ManagedCheckIn, 'state' | 'accrual'>`, and
    //     `'kind'` from the `Extract<PromptResult, { kind: 'no-prompt' }>`
    //     that derives the last member of `GymViewRefusal`. Not vocabulary a
    //     player can ever see; the collector cannot tell a type position from
    //     a value one, and that is stated rather than filtered.
    // `'decline-repair'` and `'dismiss-manager'` are NOT new: `management.ts`
    // already ships both as `MANAGED_DECISION_KINDS` members, so the two new
    // reducer arms named after them add nothing to this set. That is exactly
    // the kind of thing a hand-sum gets wrong, which is why the diff was run.
    // 498 -> 506: the player's own check-in, plus the gating that replaced
    // every control which could only refuse. EIGHT new literals, ENUMERATED by
    // diffing this exact collector against the previous commit rather than
    // read off a failure count — `'open-up'` (the new reducer arm, spelled
    // once in `ladderView.tsx` and once at the dispatch site, one literal),
    // `'gymscreen-open-up'`, `'gymscreen-open-up-press'`,
    // `'gymscreen-open-up-note'`, the note's own review-is-open sentence
    // (`'a maintenance review is waiting for you further down this screen'`),
    // and three testIDs for the reason drawn where a dead control used to be:
    // `'gymscreen-prompt-repair-unavailable'`, `'gymscreen-recovery-history'`
    // and `'gymscreen-move-up-unavailable'`. Nothing was removed. The four
    // per-item versions of that last group are TEMPLATE literals and land in
    // the count below instead, which is the kind of split a hand-sum gets
    // wrong.
    // 506 -> 501: "KILL THE MINT" ROUND. FIVE literals removed, ENUMERATED
    // the same way the eight above arrived — `'open-up'` (the reducer arm,
    // one literal for both spellings), `'gymscreen-open-up'`,
    // `'gymscreen-open-up-press'`, `'gymscreen-open-up-note'`, and the note's
    // own review-is-open sentence
    // (`'a maintenance review is waiting for you further down this screen'`).
    // Nothing was added.
    // 501 -> 503: the "chrome vs paid" bug-fix round's `EarningsMode` type,
    // `'online' | 'offline'` — two new distinct single-quoted literals,
    // spelled once each in `ladder.ts` and read as default-parameter values
    // across the functions it threads through.
    // 503 -> 507: S4h's button-chrome fix. Four new words, none a colour —
    // every colour `GymScreen.tsx` reaches for (`'darkslateblue'`,
    // `'deepskyblue'`, `'white'`, `'darkslategray'`, `'gray'`, `'silver'`) was
    // already in this directory's vocabulary and adds nothing new. The four:
    // `'auto'` and `'pointer'` (the CSS `cursor` values the iOS Safari fix
    // needs), `'button'` (`accessibilityRole`), and `'center'`
    // (`alignItems`/`justifyContent` on the new button style).
    // 507 -> 511: GDD §5.14 Stage B's `pacing.ts`. FOUR new distinct values —
    // its own `PacingCheckInPolicy` vocabulary: `'watcher'`,
    // `'few-times-a-day'`, `'once-a-day'`, `'sporadic'`. Everything else the
    // module writes as a single-quoted literal already ships elsewhere in
    // this directory and adds nothing new to the set: its five import
    // specifiers (`'./empireCore'`, `'./empireTuning'`, `'./ladder'`,
    // `'./management'`, `'./production'`) are each already imported by some
    // other shipped module, `'online'`/`'offline'` are `ladder.ts`'s own
    // `EarningsMode` literals, `'cheapest-affordable-first'` is
    // `LADDER_POLICIES`'s own member, and `'moved'` is
    // `LadderMoveResult`'s own `kind`. Measured by running the collector
    // above directly against this file's own comment-stripped source rather
    // than hand-counted.
    // 511 -> 527: GDD §5.14 Stage C. Sixteen new distinct values, measured by
    // diffing this exact collector against the pre-round tree rather than
    // hand-counted: ten new `floorgrid-station-panel*` testIDs, the new
    // `'./stationView'` import specifier, the new selection-outline colour
    // `'gold'` (reused from `AMBIENT_MEMBER_PALETTE` at the STRING level —
    // this collector counts distinct VALUES across the directory regardless
    // of which constant holds them, so a value already spelled once
    // elsewhere would not have moved this count; `'gold'` was not), the new
    // `'tray'` tap-origin literal (`'placed'`, its sibling, already shipped
    // elsewhere and added nothing), and three new copy sentences (' — fixed
    // barbell equipment', 'idle — nobody is using it right now', 'no manager
    // hired — nothing repairs this automatically'). The repair arm's own
    // "as new — nothing to repair" and the queue-count ternary's else arm are
    // plain JSX text and `null` respectively — neither is single-quoted, so
    // neither lands in this collector; see the bare-JsxText list above and
    // `panelCondition`'s own comment on why the repair gate reads `isSound`
    // rather than a fourth reason string. Everything else the panel writes as
    // a single-quoted literal — `'repair-item'`, `'floor-remove'`,
    // `'session'`, `'fixed'`, `'button'` among them — already ships
    // elsewhere in this directory and adds nothing new to the set.
    // 527 -> 533: GDD §5.14 Stage C.1, the world-first management transition
    // completed. Six new distinct values, measured by diffing this exact
    // collector against `9d4b3cd8` rather than hand-counted: four new
    // testIDs for the new collapsed-by-default diagnostics surface
    // (`'gymscreen-diagnostics'`, `'floorgrid-diagnostics'`,
    // `'floorgrid-diagnostics-toggle'`, `'floorgrid-diagnostic-caption'`) and
    // the toggle's own two-word vocabulary (`'show diagnostics'`,
    // `'hide diagnostics'`). Nothing was removed — every other literal this
    // round touched (`'gymscreen-condition-${item}'` and its siblings, the
    // whole deleted per-item loop) was already a TEMPLATE literal, which this
    // collector counts separately, below.
    // 533 -> 535: GDD §5.14 Stage C.1a, the recovery-path UX contradiction
    // fix. Two new testIDs, measured by diffing this exact collector against
    // `90d7eb5` rather than hand-counted: `'floorgrid-station-panel-recovery'`
    // (the station panel's new dormant-only recovery reading) and
    // `'gymscreen-recovery-blocking'` (the gym-level pointer naming which
    // stations are keeping a dormant gym shut). Every other new player-facing
    // sentence this round adds is a TEMPLATE literal (the two
    // `floorgrid-station-panel-recovery` sentences themselves) or plain JSX
    // text (`'no routine maintenance needed — nothing to repair'`,
    // `'blocking reopening:'`, `'— tap one on the floor to repair it'`),
    // neither of which this collector counts here — see the bare-JsxText
    // list above.
    // 535 -> 563: Stage C.1b dock/drawer/member-panel testIDs, GymSurface
    // names, furniture place/remove action kinds, and Build-mode copy.
    // 583 -> 597: Stage C.1d placement-phase chrome, player-facing member
    // labels, and refuse-kind tokens. `floorgrid-grid-tap` left the set.
    // 614 -> 624: Stage D critic pass — item-aware upgrade labels, upgrade
    // refuse copy, goldenrod/darkkhaki rest-cues.
    // 624 -> 640: GDD §5.18 Stage D.1 — trainingStation tokens, bay
    // testIDs, equipment-panel copy, training-kind station refs.
    // 640 -> 643: Stage D.1b world-legibility testIDs (quality bench, plate
    // tree, raised bay labels).
    // 643 -> 645: Stage D2 gymscreen-reset-gym + reset-gym action kind.
    // 645 -> 647: Stage D2.1B — `'loading'` (station highlight activity)
    // and `'Loading plates'` (player-facing empty-seat changeover).
    // `'faster changeovers'` became `'faster plate changes'` (replace,
    // size unchanged); `'Idle'` already shipped.
    // 647 -> 652: Stage D2.2 QA-mode labels and clock testID prefixes.
    // 652 -> 666: Stage E sportingReputation copy, meet-kind tokens, refuse lines.
    // 666 -> 670: Stage E.1 outcome tokens `'bombed-out'` / `'total'` and
    // typeof checks `'object'` / `'boolean'`. Copy/refuse strings with spaces
    // swapped four-for-four and do not move this pin.
    // 670 -> 671: Stage E.2 `'newlyQualifiedFor must be null or a sporting
    // qualify rung'` — the no-coercion refuse, spaced so it is not a
    // space-free token.
    // 671 -> 672: Stage G.1 member panel — `no recent service yet`.
    // 672 -> 688: Stage G.1 `livingMembers.ts` refuseWith and id-template strings.
    // 688 -> 756: Stage G.1C 64 given names plus wait-copy and selected-name testIDs.
    // 756 -> 794: Stage G.2A livingMemberExperience labels, statuses, reason
    // kinds, and FloorGrid experience-panel testIDs. Read from this
    // assertion's own failure value.
    // 794 -> 806: Stage G.2B membership labels, reasons, and member-panel
    // membership testIDs. Read from this assertion's own failure value.
    // 806 -> 815: Stage G.2C1 stay-status / cause / direction vocabulary.
    // 815 -> 821: Stage G.2C2 departure reason kinds, notice testID, and refuse tokens.
    // 821 -> 823: Stage G.2C3 arrival notice testID and join-line copy.
    // 823 -> 825: Stage G.2D dues card testID and daily-rate copy.
    // 825 -> 827: Stage G.2E reputation card testID and daily-rate copy.
    // 827 -> 841: G2-ATHLETE-SEASON-01 season copy, refuse lines, and notice testID.
    // 841 -> 852: CAREER-EMPIRE-REP-01 ledger/composer copy and refuse lines.
    // 852 -> 856: CAREER-EMPIRE-REP-01 GymScreen reputation testIDs / copy.
    // 856 -> 905: SF-TWL-GYM-EMPIRE-UX-01 player-facing chrome and catalog copy.
    expect(singleQuoted.size).toBe(905);
    expect(doubleQuoted.size).toBe(0);
    // 177 -> 188: sessions.ts's new refuseWith template messages and
    // ladderView.tsx's new testid template literals.
    // 188 -> 194: GymScreen.tsx's six templated testID literals
    // (`gymscreen-buy-ladder-${item}`, `gymscreen-buy-session-${item}`,
    // `gymscreen-slot-${slotIndex}`, `gymscreen-slot-${slotIndex}-set-
    // ${option}`, `gymscreen-advance-${step.mode}-${step.seconds}`, `gymscreen-week-log-
    // ${week.weekIndex}`), measured the same way as the count above.
    // 194 -> merged: members.ts's nine refuseWith template messages landed
    // independently of floor.ts's templated refusal messages and
    // FloorGrid.tsx's three templated testID literals
    // (`floorgrid-placed-${row.item}`, `floorgrid-remove-${row.item}`,
    // `floorgrid-tray-item-${item}`). Re-measured on the merged tree.
    // 211 -> 217: GDD §5.13's PLAYTEST 2 ruling — floor.ts's one new
    // `refuseWith` template message, and FloorGrid.tsx's five new template
    // literals (`floorgrid-fixed-${row.item}`, `floorgrid-line-v-${i}`,
    // `floorgrid-line-h-${j}`, and the two `key={...}` template literals on
    // the line/`v`/`h` elements). Measured by running this assertion.
    // 217 -> 222: GDD §5.13 presentation Phase 2 — floor.ts's `cellKey`
    // template (`${position.x},${position.y}`) and its two new `refuseWith`
    // template messages, plus FloorGrid.tsx's `floorgrid-ambient-${index}`
    // testID and `ambient-${index}` key templates. Measured by running this
    // assertion.
    // 222 -> 228: GDD §5.13 presentation Phase 3 — floorSim.ts's five
    // `refuseWith` template messages (the route-visit budget, the no-walkable-
    // cell refusal, the seed refusal, the run-length refusal, the run-budget
    // refusal) and the pass-order refusal that names a member index. Measured
    // by running this assertion and reading its failure value.
    // 228 -> 238: Phase 3's RENDER half. This set holds the CHUNKS between a
    // template's substitutions rather than whole templates, so the six new
    // templated testIDs contribute their prefixes and separators rather than
    // six entries: 'floorsim-', 'floorsim-cue-', 'floorsim-cue-glyph-',
    // 'floorsim-stranded-', 'floorsim-legend-', 'station-' and the bare '-'
    // that separates a cue's index from its state, plus ':' from the
    // station-key join and 'tick ' / ' — ' from the sim readout. Ten new
    // chunks, measured by running this assertion and reading its failure
    // value.
    // 238 -> 261: Phase 4. floorSprites.ts's template chunks are its sprite
    // MAPS — each hand-authored torso/leg map is one multi-line template
    // literal, which is why the census moves here rather than gaining rows
    // of quoted pixel strings — plus the data-URI assembly's prefix chunk.
    // FloorGrid.tsx adds its three new sprite testID templates
    // (`floorgrid-member-sprite-`, `floorgrid-fixed-sprite-`,
    // `floorgrid-placed-sprite-`, `floorgrid-tray-sprite-` prefixes).
    // Measured by running this assertion and reading its failure value.
    // 261 -> 282: §5.11 stage 4. `management.ts`'s refusal messages are
    // template literals, one per named refusal, and each contributes its
    // fixed chunks. Measured by running this assertion and reading its
    // failure value.
    // 282 -> 284: the §5.13 wear-basis ruling's two new `refuseWith` template
    // messages in `management.ts` — the refusal for an item that carries a
    // refused repair order and is not owned, and the one for an item carrying
    // two. Measured by running this assertion and reading its failure value.
    // 284 -> 285: one new `refuseWith` template chunk in `management.ts` —
    // `requireManagedGym`'s check-ins-taken validation, added with the ordinal
    // the review cadence is read off. Measured by running this assertion and
    // reading its failure value.
    // 285 -> 293: S4b. Eight new chunks, all in `GymScreen.tsx` and all
    // enumerated against the previous commit rather than read off this pin's
    // failure value: six testID prefixes (`gymscreen-condition-`,
    // `gymscreen-repair-`, `gymscreen-strike-`, `gymscreen-manager-tier-`,
    // `gymscreen-hire-`, `gymscreen-auto-repair-`), the strike-record key's
    // bare ` - ` separator, and the one player-facing fragment
    // `equipment back to condition ` from the recovery requirement. Nothing
    // was removed.
    // 293 -> 298: five new templates, enumerated by the same diff as the
    // single-quoted count above — the open-up note's next-review sentence
    // (`your next maintenance review comes up at shift ${...}`) and the four
    // `-unavailable` testIDs whose subject is per-item or per-tier
    // (`gymscreen-repair-${item}-unavailable`,
    // `gymscreen-hire-${tier}-unavailable`,
    // `gymscreen-buy-ladder-${item}-unavailable`,
    // `gymscreen-buy-session-${item}-unavailable`). Nothing was removed.
    // 298 -> 301: GDD §5.14 Stage B's `pacing.ts`. THREE new templates, its
    // own `refuseWith` messages: "… is not a pacing check-in policy", "a
    // pacing horizon must be finite and above zero, received …", and "no
    // reading recorded at the …-second horizon". Measured by running the
    // collector above directly against this file's own comment-stripped
    // source.
    // 301 -> 307: GDD §5.14 Stage C. Six new templates, all in the station
    // panel's own copy — the operation line ("in use by a", the queue-count
    // line), the session-identity line ("— session equipment ("), and the
    // three manager-effect lines ("your … manager repairs this
    // automatically below condition …", "…automatically below condition …,
    // and this item is above that line", "…never repairs equipment
    // automatically — their threshold is 0"). The repair-shortfall line is
    // plain JSX text now (see `singleQuoted.size`'s own comment above), so
    // it does not land here. Measured by diffing this exact collector
    // against the pre-round tree rather than hand-counted.
    // 307 -> 304: GDD §5.14 Stage C.1. THREE templates REMOVED, none added,
    // measured the same way — diffing this exact collector against
    // `9d4b3cd8`. All three were the deleted per-item loop's own testIDs
    // (`gymscreen-condition-${item}`, `gymscreen-repair-${item}`,
    // `gymscreen-repair-${item}-unavailable`), confirmed absent from every
    // other shipped file both before and after this round, so their removal
    // here is a real shrink rather than a dedupe against a copy elsewhere.
    // 304 -> 306: GDD §5.14 Stage C.1a. Two new templates, both
    // `floorgrid-station-panel-recovery`'s own dormant-only sentences —
    // "recovery repair required — condition … is below the reopening
    // minimum of …" and "condition … clears the reopening minimum of … —
    // not blocking recovery". Measured by diffing this exact collector
    // against `90d7eb5` rather than hand-counted.
    // 306 -> 316: Stage C.1b templated testIDs (dock surface, member hits) and
    // Build-mode caption interpolation.
    // 322 -> 324: Stage C.1c per-tile Build hit targets (`floorgrid-cell-${x}-${y}`
    // and its React `key`).
    // 324 -> 320: Stage C.1d dropped PanResponder/remove-chip templates.
    // 332 -> 333: Stage D critic pass `Can't upgrade this` escape.
    // 333 -> 335: GDD §5.18 Stage D.1 highlight ids — dash-stable
    // `floorsim-${activity}-training-${ref.station}` and the Capacity
    // second-bench sibling `-expansion`, replacing the colon-keyed
    // `floorStationRefKey` form the verifiers cannot read.
    // 335 -> 336: Stage D2.1B `changeoverSeatKey`
    // (`${floorStationRefKey(ref)}:${cell.x},${cell.y}`) adds the `:`
    // chunk; the operation-line templates moved from FloorGrid to
    // `playerFacingStationOperation` without a new unique chunk besides
    // that key. Read from this assertion's own failure value.
    // 336 -> 348: Stage D2.2 plate-loading and mode-labelled clock templates.
    // 348 -> 354: Stage E sportingReputation refuseWith templates.
    // 354 -> 353: Stage E.1 dropped totalKg / fieldSize / duplicate-qualify
    // templates and added outcome / categoryFieldSize ones; net −1 unique chunk.
    // 353 -> 364 -> 370: Stage G.1A livingMembers refuseWith / id templates.
    // 370 -> 372: Stage G.1C display-name pool and wait-copy refuse templates.
    // 372 -> 377: Stage G.2A FloorGrid experience-line templates plus the
    // wait-ticks refuse message. Read from this assertion's own failure value.
    // 377 -> 379: Stage G.2B MEMBERSHIP line templates. Read from this
    // assertion's own failure value.
    // 379 -> 384: Stage G.2C1 stay-state refuseWith templates.
    // 384 -> 392: Stage G.2C2 departure refuseWith templates and FloorGrid memberId keys.
    // 392 -> 393: departed-member same-tick type-conflict refuseWith template.
    // 393 -> 395: Stage G.2C3 arrival tick / joinedAtSeconds refuseWith templates.
    // 395 -> 406: Stage G.2D dues interval / settle refuseWith templates plus DUES line.
    // 406 -> 409: Stage G.2D purse-credit refuseWith templates. Read from this
    // assertion's own failure value.
    // 409 -> 413: Stage G.2D P1 occupancy-clock / occupancy-identity refuse templates.
    // 413 -> 426: Stage G.2E reputation settle / occupancy refuse templates plus REP line.
    // 426 -> 446: G2-ATHLETE-SEASON-01 season leave/return / occupancy refuse templates.
    // 446 -> 451: CAREER-EMPIRE-REP-01 ledger/composer refuse templates.
    // 451 -> 452: CAREER-EMPIRE-REP-01 gymscreen-reputation-reason template.
    // 452 -> 469: SF-TWL-GYM-EMPIRE-UX-01 player-facing template lines.
    expect(templateChunks.size).toBe(469);
    // And the template collector really reaches the messages, named from the
    // real source in both directions: these counts drop to zero if the
    // collector stops reading templates AND if the module stops writing the
    // message. Match counts rather than presence, because a pattern with more
    // than one witness is the textual pin this codebase has been bitten by.
    const chunks = [...templateChunks];
    expect(chunks.filter((chunk) => chunk.includes('may not accelerate')).length).toBe(3);
    expect(chunks.filter((chunk) => chunk.includes('duplicate lifter id')).length).toBe(1);

    const spaceFree = [...singleQuoted].filter((literal) => !literal.includes(' ')).sort();
    // 347 -> 394 entries this round: §5.11 stage 4's whole vocabulary — three
    // manager tiers, three counted decisions, three failure phases, five
    // wiring keys, six policy names, nine decision-event kinds, two wear
    // bases, and the `kind`/`reason` tokens of eight discriminated returns.
    // Forty-seven added and NONE removed, attributed by diffing the collected
    // set against the previous pin rather than by hand. Every one of them is a
    // generic noun or a mechanism name; no manufacturer, athlete or brand.
    // 401 -> 432 with S4b: thirty-one added and NONE removed, attributed the
    // same way. Twenty are `gymscreen-*` testIDs, five are dispatch tags
    // (`answer-prompt`, `repair-item`, `hire-manager`, `recover-gym`, and
    // `nothing` as an empty-state word), one is the `./management` import
    // specifier, and three (`state`, `accrual`, `kind`) are type-level
    // property names from `Omit`/`Extract` in `ladderView.tsx`. No
    // manufacturer, athlete or brand.
    expect(spaceFree).toEqual([
      '-',
      './FloorGrid',
      './empireCore',
      './empireInvariant',
      './empireTuning',
      './expansion',
      './floor',
      './floorSim',
      './floorSprites',
      './institutionalReputation',
      './ladder',
      './ladderView',
      './livingMemberArrival',
      './livingMemberDeparture',
      './livingMemberDues',
      './livingMemberExperience',
      './livingMemberReputation',
      './livingMemberRetention',
      './livingMemberSeason',
      './livingMemberStay',
      './livingMembers',
      './management',
      './members',
      './npc',
      './production',
      './recruitment',
      './reputation',
      './sessions',
      './social',
      './sportingReputation',
      './sportingReputationLedger',
      './stationCapability',
      './stationView',
      './trainingStation',
      ':',
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
      'Accessory',
      'Anya',
      'Arlo',
      'Athlete',
      'Bec',
      'Belts',
      'Bike',
      'Blair',
      'Bodybuilder',
      'Build',
      'Cables',
      'Casual',
      'Cole',
      'Conditioning',
      'Cora',
      'Dara',
      'Developer',
      'Disrupted',
      'Done',
      'Dove',
      'Drew',
      'Dumbbells',
      'Easy',
      'Elke',
      'Ellis',
      'Enzo',
      'Excellent',
      'Farah',
      'Felix',
      'Fern',
      'Galen',
      'Garage',
      'Good',
      'Gray',
      'GymMemberId',
      'Hale',
      'Hana',
      'Hugo',
      'IDAT',
      'IEND',
      'IHDR',
      'Idle',
      'Ines',
      'Interrupted',
      'Ivo',
      'Jonas',
      'Joss',
      'KSTHJDPZBWLMERQUVONCGFAXY',
      'Kade',
      'Kai',
      'Kian',
      'Leaving',
      'Leif',
      'Lila',
      'Machines',
      'Manageable',
      'Mara',
      'Mats',
      'Miles',
      'Mira',
      'Mixed',
      'More',
      'Nia',
      'Nils',
      'Noor',
      'Olin',
      'Omar',
      'Orla',
      'PLTE',
      'Paz',
      'Petra',
      'Pia',
      'Placeholder',
      'Play',
      'Poor',
      'Powerlifter',
      'Priya',
      'Quinn',
      'Rafi',
      'Recovery',
      'Reid',
      'Remy',
      'Rina',
      'Rough',
      'Rowan',
      'Rower',
      'Sauna',
      'Shae',
      'Shop',
      'Skye',
      'Sled',
      'Sleeves',
      'Solid',
      'Soren',
      'Stable',
      'Staff',
      'Steady',
      'Strained',
      'Suki',
      'Support',
      'Tessa',
      'Theo',
      'Thin',
      'Toni',
      'Tove',
      'Treadmill',
      'Uma',
      'Uneven',
      'Unsettled',
      'Veda',
      'Vera',
      'Walking',
      'Warehouse',
      'Watching',
      'Wren',
      'Wynn',
      'Yara',
      'Yves',
      'Zora',
      'absence-strike-control',
      'absolute',
      'accelerated',
      'accelerated-purse',
      'accelerated-seconds',
      'acceleratedSeconds',
      'accepted',
      'accessory',
      'accrual',
      'advance',
      'advance-clock',
      'advance-to-next-week',
      'advanced-recovery',
      'ahead',
      'already-building',
      'already-owned',
      'already-sound',
      'already-staffed',
      'already-upgraded',
      'already-visited-today',
      'answer-prompt',
      'apply-living-member-observations',
      'at-ceiling',
      'at-the-top',
      'athlete',
      'auto',
      'axes',
      'banked-operation',
      'bar',
      'bare-bar',
      'behind',
      'belts',
      'bench',
      'bike',
      'black',
      'blocked',
      'bodybuilder',
      'bombed-out',
      'boolean',
      'bought',
      'box-none',
      'brace',
      'budget',
      'build',
      'button',
      'buy',
      'buy-ladder',
      'buy-session',
      'cables',
      'calendar-day',
      'capacity',
      'cardio',
      'casual',
      'ceiling-growth',
      'ceiling-growth-per-week',
      'center',
      'chalk',
      'chance-draw',
      'cheapest-affordable-first',
      'cheapest-hire-under-warning',
      'cheapskate',
      'check-in-upkeep',
      'claimed',
      'club',
      'coach',
      'coach-staff-level',
      'combined-total',
      'comp-plates',
      'competition-bench-bay',
      'competition-total',
      'completed',
      'composed-gym',
      'condition',
      'condition-gated-prompt-control',
      'conditioning',
      'considering-exit',
      'cosmetic-unlock',
      'cosmetics',
      'costliest-affordable-first',
      'covered-day',
      'credit-sporting-result',
      'credited',
      'crimson',
      'currency-purchase',
      'daily-allowance-spent',
      'darkkhaki',
      'darkslateblue',
      'darkslategray',
      'data:image/png;base64,',
      'deadlift',
      'decline-repair',
      'declined',
      'deepskyblue',
      'delegating',
      'departure-eligible',
      'developer',
      'diligent',
      'disc',
      'dismiss',
      'dismiss-manager',
      'dismissed',
      'display-name',
      'displayName',
      'doesnt-fit',
      'dot',
      'down',
      'dumbbells',
      'e1rm',
      'eager-turnaround-control',
      'elapsedSeconds',
      'equipment',
      'equipment-below-recovery-minimum',
      'expansion',
      'failed',
      'failure-slump-control',
      'fault-message',
      'faultMessage',
      'few-times-a-day',
      'fill',
      'fixed',
      'fixed-order-no-rotation',
      'fixedGrids',
      'fixedOccupiedGrids',
      'fixedOccupiedUris',
      'fixedUris',
      'flat-bench',
      'flex-start',
      'floor-place',
      'floor-place-furniture',
      'floor-remove',
      'floor-remove-furniture',
      'floorGrids',
      'floorUris',
      'floorgrid-ambient-caption',
      'floorgrid-arrival-notice',
      'floorgrid-bay-expansion',
      'floorgrid-bay-expansion-sprite',
      'floorgrid-bay-label-competition-bench-bay',
      'floorgrid-bay-label-second-bench',
      'floorgrid-caption',
      'floorgrid-departure-notice',
      'floorgrid-diagnostic-caption',
      'floorgrid-diagnostics',
      'floorgrid-diagnostics-toggle',
      'floorgrid-drop-refused',
      'floorgrid-drop-refused-area',
      'floorgrid-equipment-panel',
      'floorgrid-equipment-panel-condition',
      'floorgrid-equipment-panel-dismiss',
      'floorgrid-equipment-panel-identity',
      'floorgrid-equipment-panel-remove',
      'floorgrid-equipment-panel-repair',
      'floorgrid-equipment-panel-role',
      'floorgrid-floor-texture',
      'floorgrid-grid',
      'floorgrid-member-panel',
      'floorgrid-member-panel-dismiss',
      'floorgrid-member-panel-display-name',
      'floorgrid-member-panel-dues',
      'floorgrid-member-panel-experience',
      'floorgrid-member-panel-experience-components',
      'floorgrid-member-panel-experience-reason',
      'floorgrid-member-panel-experience-reliability',
      'floorgrid-member-panel-experience-training',
      'floorgrid-member-panel-experience-wait',
      'floorgrid-member-panel-identity',
      'floorgrid-member-panel-membership',
      'floorgrid-member-panel-membership-reason',
      'floorgrid-member-panel-no-history',
      'floorgrid-member-panel-reputation',
      'floorgrid-member-panel-short-id',
      'floorgrid-member-panel-state',
      'floorgrid-member-panel-tenure',
      'floorgrid-pending',
      'floorgrid-place-banner',
      'floorgrid-place-cancel',
      'floorgrid-place-cost',
      'floorgrid-place-effect',
      'floorgrid-place-ghost',
      'floorgrid-place-purpose',
      'floorgrid-place-tradeoff',
      'floorgrid-plate-tree-competition-bench-bay',
      'floorgrid-quality-bench-competition-bench-bay',
      'floorgrid-quality-mark-competition-bench-bay',
      'floorgrid-root',
      'floorgrid-scroll-x',
      'floorgrid-scroll-y',
      'floorgrid-season-notice',
      'floorgrid-selected-member-name',
      'floorgrid-station-panel',
      'floorgrid-station-panel-condition',
      'floorgrid-station-panel-dismiss',
      'floorgrid-station-panel-identity',
      'floorgrid-station-panel-manager',
      'floorgrid-station-panel-operation',
      'floorgrid-station-panel-recovery',
      'floorgrid-station-panel-remove',
      'floorgrid-station-panel-remove-furniture',
      'floorgrid-station-panel-repair',
      'floorgrid-station-panel-repair-unavailable',
      'floorgrid-station-panel-review-note',
      'floorgrid-throughput-mark-competition-bench-bay',
      'floorgrid-tray',
      'floorgrid-tray-empty',
      'floorgrid-tray-scroll',
      'floorsim-caption',
      'floorsim-legend',
      'foam-rollers',
      'formed',
      'forming',
      'friend',
      'friend-encouragement',
      'friend-visit-allowance-reset',
      'furniture',
      'garage',
      'generic',
      'global',
      'gold',
      'goldenrod',
      'gray',
      'gym-accelerated-bucks',
      'gym-accrual',
      'gym-advance',
      'gym-advance-next-week',
      'gym-allocation',
      'gym-available-now',
      'gym-bucks',
      'gym-bucks-below-cost',
      'gym-clock',
      'gym-dev-controls',
      'gym-economy',
      'gym-empire-timer-skip',
      'gym-gym-bucks',
      'gym-id',
      'gym-ladder-shop',
      'gym-lifts',
      'gym-move',
      'gym-move-up',
      'gym-progress',
      'gym-rate',
      'gym-refusal',
      'gym-rung',
      'gym-session-shop',
      'gym-view',
      'gym-week',
      'gym-week-log',
      'gym-week-preview',
      'gymBucks',
      'gymBucksPerHour',
      'gymId',
      'gymscreen-accelerated-bucks',
      'gymscreen-accrual',
      'gymscreen-advance',
      'gymscreen-advance-next-week',
      'gymscreen-allocation',
      'gymscreen-available-now',
      'gymscreen-check-in-costs',
      'gymscreen-clock',
      'gymscreen-condition',
      'gymscreen-dev-controls',
      'gymscreen-developer-drawer',
      'gymscreen-diagnostics',
      'gymscreen-dismiss-manager',
      'gymscreen-dock',
      'gymscreen-floor',
      'gymscreen-full-repair',
      'gymscreen-gym-bucks',
      'gymscreen-gym-bucks-exact',
      'gymscreen-hud',
      'gymscreen-hud-review',
      'gymscreen-ladder-shop',
      'gymscreen-lifts',
      'gymscreen-management',
      'gymscreen-manager',
      'gymscreen-manager-state',
      'gymscreen-more-drawer',
      'gymscreen-move',
      'gymscreen-move-up',
      'gymscreen-move-up-unavailable',
      'gymscreen-phase',
      'gymscreen-prompt',
      'gymscreen-prompt-decline',
      'gymscreen-prompt-dismiss',
      'gymscreen-prompt-item',
      'gymscreen-prompt-repair',
      'gymscreen-prompt-repair-unavailable',
      'gymscreen-prompt-stakes',
      'gymscreen-rate',
      'gymscreen-recover',
      'gymscreen-recovery',
      'gymscreen-recovery-blocking',
      'gymscreen-recovery-cost',
      'gymscreen-recovery-history',
      'gymscreen-recovery-state',
      'gymscreen-refusal',
      'gymscreen-reputation',
      'gymscreen-reset-gym',
      'gymscreen-return',
      'gymscreen-return-more',
      'gymscreen-root',
      'gymscreen-rung',
      'gymscreen-session-shop',
      'gymscreen-shop-drawer',
      'gymscreen-staff-card-manager',
      'gymscreen-staff-drawer',
      'gymscreen-staff-members',
      'gymscreen-stage',
      'gymscreen-strikes',
      'gymscreen-strikes-lead',
      'gymscreen-surface-build',
      'gymscreen-surface-developer',
      'gymscreen-week',
      'gymscreen-week-log',
      'gymscreen-week-preview',
      'gymscreen-worn',
      'hands-off',
      'hatch',
      'hidden',
      'hire-manager',
      'hire-novice',
      'hire-steady',
      'hire-veteran',
      'hired',
      'hoard',
      'hypertrophy',
      'idle-clock',
      'idle-only',
      'idle-tenure-days',
      'idleTenureDays',
      'in-season',
      'injury-chance-multiplier',
      'injury-days-saved',
      'injury-risk',
      'injuryDaysSaved',
      'interrupted',
      'khaki',
      'kind',
      'knob',
      'ladder-accrual',
      'ladder-clock',
      'ladder-dev-controls',
      'ladder-gym-bucks',
      'ladder-lifts',
      'ladder-move',
      'ladder-rate',
      'ladder-refusal',
      'ladder-rung',
      'ladder-shop',
      'ladder-view',
      'leaderboard-placement',
      'leave',
      'leaving',
      'left',
      'legendary',
      'level',
      'livingPopulation',
      'loading',
      'local',
      'local-open-2026',
      'machines',
      'manager-hired-under-warning',
      'mats',
      'memberGrids',
      'memberUris',
      'monolift',
      'more',
      'move',
      'move-up',
      'moved',
      'national',
      'nationals',
      'negligent',
      'neutral',
      'no-manager',
      'no-prompt',
      'no-second-position',
      'no-total',
      'none',
      'not-a-friend-gym',
      'not-creditable',
      'not-dormant',
      'not-enough-gym-bucks',
      'not-enough-reputation',
      'not-enough-wall-clock-earnings',
      'not-offered',
      'not-owned',
      'not-placed',
      'not-upgradable',
      'novice',
      'npc-id',
      'npcId',
      'number',
      'object',
      'occupied',
      'off-season',
      'offered',
      'offline',
      'once-a-day',
      'online',
      'ordinal',
      'other-recovery',
      'out-of-bounds',
      'outcome',
      'outside',
      'overlaps',
      'own-gym',
      'paid-pull',
      'per-order',
      'per-refusal',
      'physio',
      'physio-days-saved',
      'pixelated',
      'placed',
      'placing',
      'play',
      'pointer',
      'power-bar',
      'powerlifter',
      'primary',
      'progression-reaching',
      'prompt-dismiss',
      'prompt-dismissed-again',
      'prompt-repair',
      'qualify',
      'quality',
      'queuing',
      'quiet',
      'react',
      'react-native',
      'ready',
      'reason',
      'reasonKind',
      'reasonText',
      'recover',
      'recover-gym',
      'recovered',
      'recovery',
      'red',
      'redemptive',
      'refusal',
      'refused',
      'regional',
      'relative',
      'reliability',
      'removed',
      'repair',
      'repair-declined',
      'repair-item',
      'repair-refused',
      'repaired',
      'repeat-strike-control',
      'reputation',
      'reputation-below-threshold',
      'reputation-milestone',
      'reputation-tier',
      'reset-gym',
      'residual-carry-multiplier',
      'rest',
      'rested',
      'return',
      'rewarded-ad-timer-skip',
      'right',
      'rival',
      'rival-period-close',
      'rival-week',
      'roster-at-capacity',
      'roster-slot',
      'rotate-greedy-per-check-in',
      'route-blocked',
      'row',
      'rower',
      'rung-too-low',
      'sauna',
      'save-for-physio-first',
      'seeking',
      'serious-lifter',
      'service',
      'session',
      'sessionGrids',
      'sessionUris',
      'set-allocation-slot',
      'set-gym-surface',
      'settled-level',
      'settled-purse-wired-control',
      'settled-tenure-days',
      'settledAxes',
      'settledTenureDays',
      'shipped',
      'shop',
      'silver',
      'single-purse',
      'single-wall-clock-purse',
      'skippedSeconds',
      'sled',
      'sleeves',
      'slim',
      'slots',
      'sound',
      'space',
      'space-around',
      'space-between',
      'space-level',
      'specialty-bars',
      'spend-once-per-calendar-day',
      'sponsorship',
      'sporadic',
      'spotter',
      'springgreen',
      'squat',
      'squat-rack',
      'staff',
      'stand',
      'state',
      'stationKind',
      'staying',
      'steady',
      'step-a',
      'step-b',
      'stepA',
      'stepB',
      'storage-unit',
      'store-purchase',
      'strain',
      'stretch',
      'stretching-yoga',
      'string',
      'strip-mall-unit',
      'structural',
      'support',
      'tRNS',
      'target-moved',
      'target-removed',
      'technique',
      'technique-quality',
      'technique-quality-bonus',
      'throughput',
      'thrownMessage',
      'total',
      'total-pr',
      'trained',
      'trained-day-upkeep',
      'training',
      'training-iq',
      'training-pace',
      'trainingIq',
      'trainingIqPerDay',
      'transparent',
      'treadmill',
      'unaccelerated-seconds',
      'unacceleratedSeconds',
      'under',
      'unequipped',
      'unknown-meet',
      'unsettled',
      'up',
      'upgrade-station',
      'upgraded',
      'using',
      'using-bar-a',
      'using-bar-b',
      'using-bench-a',
      'using-bench-b',
      'using-generic-a',
      'using-generic-b',
      'veteran',
      'visit-fee-control',
      'visited',
      'wait',
      'wall-clock',
      'wall-clock-earned',
      'wall-clock-elapsed',
      'wall-clock-wear-control',
      'warehouse',
      'warned',
      'watcher',
      'white',
      'wide',
      'worlds',
      'wrist-wraps',
    ]);

    // The half the pin does not reach: a multi-word name inside a message. Run
    // over all three collectors, not just the one it used to see.
    const personShaped = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/;
    const everyString = [...singleQuoted, ...doubleQuoted, ...templateChunks];
    let stringsChecked = 0;
    for (const value of everyString) {
      expect(personShaped.test(value), `${value} is shaped like a person's name`).toBe(false);
      stringsChecked += 1;
    }
    expect(stringsChecked).toBe(singleQuoted.size + doubleQuoted.size + templateChunks.size);
    // 423 -> 462: singleQuoted (246 -> 274) and templateChunks (177 -> 188).
    // 462 -> 490: GymScreen.tsx — singleQuoted (274 -> 296) and templateChunks
    // (188 -> 194). singleQuoted's own comment above explains the 296 rather
    // than 298: `relocate` is GymScreen.tsx's bare `<Text>relocate</Text>`,
    // already counted by the JSX-text collector above, not a quoted code
    // literal — inlining the button (no shared `DispatchButton`, per this
    // file's own header) means no `'relocate'` string ever appears in code.
    // 490 -> merged: members.ts's singleQuoted/templateChunks growth landed
    // independently of GDD §5.13 presentation Phase 1's (the extra one over
    // floor.ts alone being `'relative'`, added once the grid container needed
    // an explicit `position: 'relative'`). Re-measured on the merged tree,
    // same as `singleQuoted.size`/`templateChunks.size` above — this is their
    // sum plus doubleQuoted (0), so it moves in lockstep with both.
    // 552 -> 554: singleQuoted (335 -> 337), PLAYTEST 3's overlap-refusal
    // ruling; templateChunks unchanged.
    // 542 -> 552: singleQuoted (331 -> 335) and templateChunks (211 -> 217),
    // both from GDD §5.13's PLAYTEST 2 ruling.
    // 554 -> 566: singleQuoted (337 -> 344) and templateChunks (217 -> 222),
    // GDD §5.13 presentation Phase 2.
    // 566 -> 567: singleQuoted (344 -> 345), PLAYTEST 4; templateChunks
    // unchanged (222).
    // 567 -> 582: singleQuoted (345 -> 354) and templateChunks (222 -> 228),
    // GDD §5.13 presentation Phase 3's floorSim.ts. Read from this
    // assertion's own failure value.
    // 582 -> 583: the `route-blocked` interruption cause. Read from this
    // assertion's own failure value.
    // 583 -> 610: singleQuoted (355 -> 372) and templateChunks (228 -> 238),
    // Phase 3's RENDER half. Read from this assertion's own failure value.
    // 610 -> 651: singleQuoted (372 -> 390) and templateChunks (238 -> 261),
    // Phase 4. Read from this assertion's own failure value.
    // 651 -> 655: the four op-kind tokens above.
    // 655 -> 663: P4b's eight new single-quoted tokens (the six using
    // poses, 'bar', 'generic'). Read from this assertion's failure value.
    // 663 -> 666: P4c's three new single-quoted tokens ('under',
    // 'fixedOccupiedGrids', 'fixedOccupiedUris'). Read from this assertion's
    // failure value.
    // 666 -> 734: §5.11 stage 4's `management.ts` — singleQuoted (405 -> 452)
    // and templateChunks (261 -> 282). Read from this assertion's own failure
    // value.
    // 734 -> 739: the §5.13 wear-basis ruling — three single-quoted tokens and
    // two template chunks, exactly the increments the two counts above carry.
    // Read from this assertion's own failure value.
    // 739 -> 744: the §5.7 chain-break round's four new literals and one new
    // template chunk, exactly the increments the two counts above record.
    // Read from this assertion's own failure value.
    // 744 -> 791: S4b — singleQuoted (459 -> 498) and templateChunks
    // (285 -> 293), exactly the two increments those pins above carry, 39 + 8.
    // Read from this assertion's own failure value and cross-checked against
    // the two enumerated diffs rather than only against this total.
    // 791 -> 804: 8 single-quoted + 5 template, the two enumerated diffs
    // above, summed here rather than re-read — a total that agrees with two
    // enumerations is worth more than a total read off a failure value, which
    // is what the note above this line asks for.
    // 804 -> 799: "kill the mint" removes exactly 5 single-quoted literals
    // (enumerated above) and 0 templates.
    // 799 -> 801: the "chrome vs paid" bug-fix round's 2 new single-quoted
    // literals ('online', 'offline'), enumerated above.
    // 801 -> 805: S4h's four new single-quoted literals ('auto', 'button',
    // 'center', 'pointer'), enumerated in `singleQuoted.size`'s own comment
    // above; templateChunks and doubleQuoted unchanged.
    // 805 -> 812: GDD §5.14 Stage B's `pacing.ts` — singleQuoted 507 -> 511
    // and templateChunks 298 -> 301, both enumerated above; doubleQuoted
    // unchanged.
    // 812 -> 834: GDD §5.14 Stage C — singleQuoted 511 -> 527 and
    // templateChunks 301 -> 307, both enumerated above; doubleQuoted
    // unchanged.
    // 834 -> 837: GDD §5.14 Stage C.1 — singleQuoted 527 -> 533 (+6) and
    // templateChunks 307 -> 304 (-3), both enumerated above; doubleQuoted
    // unchanged. Net +3.
    // 837 -> 841: GDD §5.14 Stage C.1a — singleQuoted 533 -> 535 (+2) and
    // templateChunks 304 -> 306 (+2), both enumerated above; doubleQuoted
    // unchanged. Net +4.
    // 841 -> 878: Stage C.1b singleQuoted + templateChunks growth.
    // 905 -> 907: Stage C.1c per-tile Build hit-target templates.
    // 907 -> 917: Stage C.1d singleQuoted 583 -> 597, templateChunks 324 -> 320.
    // 946 -> 957: Stage D critic pass singleQuoted 614 -> 624, templates 332 -> 333.
    // 957 -> 973: GDD §5.18 Stage D.1 singleQuoted 624 -> 640; templateChunks unchanged.
    // 973 -> 975: D.1 highlight ids, templateChunks 333 -> 335.
    // 975 -> 978: Stage D.1b singleQuoted 640 -> 643.
    // 978 -> 980: Stage D2 singleQuoted 643 -> 645.
    // 980 -> 983: Stage D2.1B singleQuoted 645 -> 647 and templateChunks
    // 335 -> 336. Read from this assertion's own failure value.
    // 983 -> 1000: Stage D2.2 singleQuoted 647 -> 652 and templateChunks
    // 336 -> 348.
    // 1020 -> 1023: Stage E.1 singleQuoted 666 -> 670 and templateChunks
    // 354 -> 353.
    // 1023 -> 1024: Stage E.2 singleQuoted 670 -> 671; templateChunks unchanged.
    // 1024 -> 1052: Stage G.1 singleQuoted 688 -> 698 and templateChunks
    // 364 -> 374 — ten new space-free tokens plus eighteen new template
    // chunks from livingMembers refuseWith / member-card copy. Read from this
    // assertion's own failure value.
    // 1058 -> 1128: Stage G.1C — 68 new single-quoted literals (64 given
    // names, two wait phrases, two selected/card testIDs) plus two template
    // chunks. Read from this assertion's own failure value.
    // 1128 -> 1171: Stage G.2A singleQuoted 756 -> 794 and templateChunks
    // 372 -> 377. Read from this assertion's own failure value.
    // 1171 -> 1185: Stage G.2B singleQuoted 794 -> 806 and templateChunks
    // 377 -> 379.
    // 1185 -> 1199: Stage G.2C1 singleQuoted 806 -> 815 and templateChunks
    // 379 -> 384.
    // 1199 -> 1213: Stage G.2C2 singleQuoted 815 -> 821 and templateChunks 384 -> 392.
    // 1213 -> 1214: departed-member same-tick type-conflict refuseWith template.
    // 1214 -> 1218: Stage G.2C3 singleQuoted +2 and templateChunks +2.
    // 1218 -> 1231: Stage G.2D singleQuoted +2 and templateChunks +11.
    // 1231 -> 1234: Stage G.2D purse-credit refuseWith templates +3.
    // 1234 -> 1238: Stage G.2D P1 occupancy refuse templates +4.
    // 1238 -> 1253: Stage G.2E singleQuoted +2 and templateChunks +13.
    // 1253 -> 1287: G2-ATHLETE-SEASON-01 singleQuoted +14 and templateChunks +20.
    // 1287 -> 1303: CAREER-EMPIRE-REP-01 space-free tokens + template chunks.
    // 1303 -> 1307: CAREER-EMPIRE-REP-01 GymScreen composed-copy tokens.
    // 1308 -> 1374: SF-TWL-GYM-EMPIRE-UX-01 player-facing chrome strings.
    expect(stringsChecked).toBe(1374);

    // The pattern is not a dead letter, and the probe is DERIVED from the
    // shipped vocabulary. The two lines here were
    // `personShaped.test('lifted by Placeholder Lifter')` and
    // `personShaped.test('bare-bar')` — both operands string literals written
    // four lines from the pattern, so nothing kept them in step with the file
    // they claimed to be about. That is verbatim the shape the sibling scan in
    // `empireTuning.test.ts` says it removed, kept here in the same directory.
    // Every shipped token, title-cased and doubled, is a person-shaped name.
    //
    // What this reddens on, said exactly rather than implied: a weakening of
    // `personShaped` itself — it is a tripwire against the CHECK going quiet,
    // which is the same job the sibling's `${key}_PER_SESSION` probe does, and
    // it is not a second bite on `empireCore.ts`. The subject-edit bites in
    // this test are the three count pins, the exact `spaceFree` pin, and the
    // loop over every string the three collectors found, whose count is pinned
    // two lines above this comment and is 295 rather than the 94 this sentence
    // said while the collector read single-quoted literals only. What the derivation buys is that the
    // probes cannot go stale: rename the vocabulary and the probes rename with
    // it, instead of two literals still passing about tokens that are gone.
    let probes = 0;
    for (const literal of spaceFree) {
      const word = literal.replace(/[^A-Za-z]/g, '');
      if (word.length < 2) continue;
      const titled = `${word.slice(0, 1).toUpperCase()}${word.slice(1).toLowerCase()}`;
      expect(personShaped.test(`${titled} ${titled}`), `${titled} is not person-shaped`).toBe(true);
      probes += 1;
    }
    // 199 -> 224: spaceFree grew by the same 25 entries added above.
    // 224 -> 246: spaceFree grew by the same 22 entries GymScreen.tsx added
    // above (none is under two letters, so all 22 clear the guard below).
    // Not 23: `relocate` is in `spaceFree`'s own comment above as the one
    // entry that did NOT arrive with GymScreen.tsx's code strings — it is
    // JSX text, already counted by the fourth (JSX) collector, not this one.
    // 246 -> merged: spaceFree grew by the five member-type tokens members.ts's
    // tuning added (athlete, bodybuilder, casual, powerlifter, serious-lifter,
    // all clearing the two-letter guard below), independently of the 29
    // entries GDD §5.13 presentation Phase 1 added (also none under two
    // letters). Re-measured on the merged tree.
    // 280 -> 282: PLAYTEST 2's 'dimgray' and 'floorgrid-tray-empty', both
    // clearing the two-letter guard below.
    // 282 -> 284: PLAYTEST 3's 'crimson' and 'floorgrid-drop-refused', same.
    // 284 -> 291: GDD §5.13 presentation Phase 2's seven new spaceFree
    // entries ('./members', 'coral', 'khaki', 'lightseagreen', 'plum', 'tan',
    // 'floorgrid-ambient-caption'), all clearing the two-letter guard below.
    // 291 -> 292: PLAYTEST 4 removed five spaceFree entries ('coral', 'khaki',
    // 'lightseagreen', 'plum', 'tan') and added six ('orange', 'gold',
    // 'hotpink', 'chartreuse', 'tomato', 'white'), all clearing the
    // two-letter guard below — net +1. Measured by running this assertion.
    // 292 -> 301: GDD §5.13 presentation Phase 3's nine new spaceFree entries
    // ('seeking', 'queuing', 'using', 'leaving', 'interrupted',
    // 'target-removed', 'target-moved', 'fixed', 'session'), all clearing the
    // two-letter guard below. Measured by running this assertion.
    // 301 -> 302: the `route-blocked` cause, which clears the two-letter guard
    // like the rest. Measured by running this assertion.
    // 302 -> 314: Phase 3's RENDER half's twelve new space-free entries
    // ('./floorSim', 'deepskyblue', 'khaki', 'springgreen', 'silver', 'red',
    // 'transparent', 'removed', 'blocked', 'claimed', 'floorsim-caption',
    // 'floorsim-legend' — 'moved' is already in this set, which is why the
    // list gained twelve rows and the interruption table's three words only
    // two of them). All twelve clear the two-letter guard below, which is why
    // this number stays equal to the list's own length; the interruption cue
    // says a WORD rather than a glyph precisely so that stays true. Measured
    // by running this assertion.
    // 314 -> 332: Phase 4's net movement of the spaceFree list — thirty-one
    // new entries (floorSprites.ts's vocabulary, the sprite testIDs, the
    // pose/facing/build tokens) against thirteen retired placeholder
    // colours. Every entry clears the two-letter guard below, including the
    // legend and base64-alphabet strings, whose letters-only forms are long.
    // Measured by running this assertion and reading its failure value.
    // 332 -> 336: the four op-kind tokens, all clearing the two-letter guard.
    // 336 -> 344: P4b's eight new tokens (six poses, 'bar', 'generic'), all
    // clearing the guard — the rep frames are booleans so nothing here is
    // skippable. Measured by running this assertion.
    // 344 -> 347: P4c's three new tokens ('under', 'fixedOccupiedGrids',
    // 'fixedOccupiedUris'), all clearing the guard. Measured by running this
    // assertion.
    // 347 -> 394: §5.11 stage 4's forty-seven new tokens, all clearing the
    // two-letter guard. Measured by running this assertion.
    // 394 -> 397: the wear-basis ruling's three new single-quoted tokens, all
    // clearing the two-letter guard. Measured by running this assertion.
    // 397 -> 401: the §5.7 chain-break round's four new single-quoted tokens,
    // all clearing the two-letter guard. Measured by running this assertion
    // and reading its failure value.
    // 401 -> 432: S4b's thirty-one new tokens, all clearing the two-letter
    // guard. Measured by running this assertion and reading its failure value.
    // 432 -> 439: the player check-in round's own tokens, from the thirteen
    // new literals enumerated above. Measured by running this assertion and
    // reading its failure value; the gap between 13 literals and 7 probes is
    // the two-letter guard and the dedupe, which is why this number is not a
    // sum of the two above.
    // 439 -> 435: "kill the mint" removes exactly four `spaceFree` tokens
    // ('open-up', 'gymscreen-open-up', '-note', '-press'), each a probe.
    // 435 -> 437: the "chrome vs paid" bug-fix round's two new `spaceFree`
    // tokens, 'offline' and 'online', each a probe.
    // 437 -> 441: S4h's four new `spaceFree` tokens ('auto', 'button',
    // 'center', 'pointer'), all clearing the two-letter guard below, each a
    // probe.
    // 441 -> 445: GDD §5.14 Stage B's four new `spaceFree` tokens
    // ('few-times-a-day', 'once-a-day', 'sporadic', 'watcher'), each a probe.
    // 445 -> 458: GDD §5.14 Stage C's thirteen new `spaceFree` tokens
    // ('./stationView', ten `floorgrid-station-panel*` testIDs, 'gold',
    // 'tray'), each clearing the two-letter guard below, each a probe.
    // 458 -> 462: GDD §5.14 Stage C.1's four new `spaceFree` tokens
    // ('floorgrid-diagnostic-caption', 'floorgrid-diagnostics',
    // 'floorgrid-diagnostics-toggle', 'gymscreen-diagnostics') — the
    // collapsed-by-default diagnostics surface's testIDs. Its other two new
    // single-quoted literals ('show diagnostics', 'hide diagnostics') both
    // contain a space, so neither clears this filter and neither is a probe
    // here — measured by diffing `spaceFree` against the pre-round tree
    // rather than hand-counted.
    // 462 -> 464: GDD §5.14 Stage C.1a's two new `spaceFree` tokens
    // ('floorgrid-station-panel-recovery', 'gymscreen-recovery-blocking'),
    // each clearing the two-letter guard below, each a probe.
    // 464 -> 488: Stage C.1b new space-free tokens (surfaces, furniture, dock).
    // 488 -> 498: Stage G.1 — ten new space-free tokens (`./livingMembers`,
    // `apply-living-member-observations`, three member-panel testIDs,
    // `stationKind`, `completed`, `GymMemberId`, `:` from
    // `livingMembers.ts`'s id split). G.1A removes the `?` fallback from
    // `memberOrdinalFromId` and adds no new space-free single-quoted tokens.
    expect(probes).toBe(spaceFree.length - 2);
    // `:` from `livingMembers.ts`'s id split and `-` from shop separators
    // clear the `< 2` guard and are intentionally unprobed — every other
    // shipped token is.
    expect(probes + 2).toBe(spaceFree.length);

    // JSX text gets a SIGNED-PAIR census rather than the flat ban above, and
    // the difference is a measurement, not a taste (E39): the ban predicate
    // fires on 7 of 20 chunks of ordinary render copy built from the GDD's
    // own vocabulary — "Gym Empire", "Gym Bucks" twice, "Squat Rack",
    // "Meet Day", "Covered Day", "Chalk Cloud" — so as a ban over render copy
    // it would refuse the product's own feature names. As a signed list, each
    // Titlecase pair in shipped JSX text is a row somebody adds here by name,
    // the same shape as the `spaceFree` pin above: a person-shaped name
    // arrives as a named diff a reviewer reads, and this census does not
    // adjudicate it any more than the first half does.
    //
    // The list is empty because `ladderView.tsx`'s copy is deliberately
    // lower-case throughout — a Titlecase pair arriving in render copy is a
    // row somebody signs here, and the view's first version chose to need
    // none. The fixture test below is where the extractor is shown to bite.
    //
    // The residual E40/E41 declared here is now CLOSED the way its own note
    // asked: the zero chunk-count pin was raised to `SIGNED_JSX_TEXT_CHUNKS`,
    // an exact chunk list, when the first shipped `.tsx` landed. Both shapes
    // the note named — (a) a mark that is not a Titlecase pair, and (b) a
    // pair split across an expression container like `Placeholder{' '}
    // Lifter` — now surface as named string diffs against that list rather
    // than as count moves: (a) is a new or edited row, and (b) is two
    // adjacent rows a reviewer reads together, plus the separator landing in
    // the single-quoted collector. This pairs list stays the catcher for the
    // shape the chunk list cannot make a reviewer see at a glance — a
    // person-shaped pair inside one long signed sentence.
    const SIGNED_JSX_TITLECASE_PAIRS: readonly string[] = Object.freeze([]);
    const jsxPairs = [...new Set(jsxCensus.chunks.flatMap((chunk) => titlecasePairsIn(chunk)))];
    expect(jsxPairs.sort()).toEqual([...SIGNED_JSX_TITLECASE_PAIRS].sort());
    // One pattern, two spellings: the extractor above is built from
    // TITLECASE_PAIR_SOURCE, and this is what keeps `personShaped` — the ban
    // predicate the quoted-string half runs — from drifting away from it.
    expect(personShaped.source).toBe(TITLECASE_PAIR_SOURCE);
  });

  it('catches a person-shaped name in bare JSX text, which no quote-keyed collector can see', () => {
    // Driven on-disk through the same walk and the same collector the census
    // above runs. When this was written the shipped tree had zero `.tsx`
    // files and every jsx pin above held with the collector deleted, so the
    // fourth collector's claim was earned here or not at all; the shipped
    // census now has `ladderView.tsx` as a real domain, and this drive stays
    // because the shipped copy is deliberately lower-case — the CATCHING
    // case, a person-shaped chunk, still exists only here.
    //
    // This exact text was planted at src/empire/sponsorBanner.tsx on the real
    // tree first (E39): `tsc --noEmit` exit 0, so the gap is a shippable
    // route and not a syntax accident; the census above stayed green; and the
    // whole suite's failure output contained the name zero times — 35 tests
    // reddened, every one an arrival-count pin that fires for any `.tsx`
    // whatever its content, which is detection of a file, not of a string.
    const banner = [
      'export function SponsorBanner() {',
      '  return <span>Sponsored by Placeholder Lifter</span>;',
      '}',
      '',
    ].join('\n');
    withProbeTree({ 'sponsorBanner.tsx': banner, 'plain.ts': 'export {};\n' }, (root) => {
      const census = jsxTextCensusUnder(root);
      // Reach: the walk hands the `.tsx` to the collector.
      expect(census.jsxFilesRead).toBe(1);
      // The catch, named: the chunk is collected, whitespace-normalised, and
      // its Titlecase pair is exactly the name — an unsigned pair, so on the
      // shipped census this is a red line carrying the string itself.
      expect(census.chunks).toEqual(['Sponsored by Placeholder Lifter']);
      expect(census.chunks.flatMap((chunk) => titlecasePairsIn(chunk))).toEqual([
        'Placeholder Lifter',
      ]);
      // The gap this collector exists for, measured on the same text with the
      // same factored predicates the census runs: the three quote-keyed
      // collectors find no string at all in it.
      const quoted = quoteKeyedStringsIn(banner);
      expect(quoted.singleQuoted).toEqual([]);
      expect(quoted.doubleQuoted).toEqual([]);
      expect(quoted.templateChunks).toEqual([]);
    });

    // The domain axis, stated at the mechanism: the identical text parsed
    // under a `.ts` name (ScriptKind inferred as TS) produces a wrong,
    // smaller tree with zero JsxText nodes — and until E41 this line
    // asserted exactly that silent `[]`, demonstrating the gap while leaving
    // it open. The collector now reads the parse's own syntactic diagnostics
    // (3 on this text under a `.ts` name, measured) and refuses, so the
    // mis-kind route is a loud stop naming the file instead of an
    // under-count no pin can see.
    expect(() => jsxTextChunksIn('sponsorBanner.ts', banner)).toThrow(
      'sponsorBanner.ts parsed dirty (3 syntactic diagnostics',
    );
    // Non-vacuity for the refusal on the route the walk actually takes: a
    // genuinely broken `.tsx` (not a mis-kinded one) also throws, so the
    // diagnostics read is a real constraint on every source this collector
    // parses, not a check that can only report clean.
    expect(() => jsxTextChunksIn('broken.tsx', 'export const V = () => <div>{;\n')).toThrow(
      'broken.tsx parsed dirty',
    );

    // The neighbouring `.tsx` shapes are covered by the existing collectors
    // once the walk hands them the file — measured here rather than assumed,
    // because the recon planted neither: an attribute string is
    // double-quoted, a string in a JSX expression container is single-quoted,
    // and a template in one is a template. All three land in the existing
    // sets, where the flat ban above reaches them.
    const attributeShape = [
      "export const S = () => <Sponsor name=\"Placeholder Lifter\" note={'quoted-in-braces'} />;",
      'export const V = () => <span>{`lifted by Placeholder Lifter`}</span>;',
      '',
    ].join('\n');
    const shapes = quoteKeyedStringsIn(attributeShape);
    expect(shapes.doubleQuoted).toEqual(['Placeholder Lifter']);
    expect(shapes.singleQuoted).toEqual(['quoted-in-braces']);
    expect(shapes.templateChunks).toEqual(['lifted by Placeholder Lifter']);

    // And the signing path is real, not just the refusal: ordinary render
    // copy produces pairs a signer can name. Two of the E39 measurement's
    // twenty realistic lines, with their extracted pairs — this is the 35%
    // false-positive measurement that decided signed-pairs over a flat ban,
    // kept runnable.
    const copyShapes = [
      { chunk: 'Your gym earned 240 Gym Bucks while you were away.', pairs: ['Gym Bucks'] },
      { chunk: 'Reputation: Regional', pairs: [] },
    ];
    let copyProbes = 0;
    for (const { chunk, pairs } of copyShapes) {
      expect([...titlecasePairsIn(chunk)]).toEqual(pairs);
      copyProbes += 1;
    }
    expect(copyProbes).toBe(copyShapes.length);
  });

  it('imports nothing outside this directory', () => {
    // An import edge into another session's territory is how a pure module
    // acquires a side effect it did not ask for. This is the ONE fence for the
    // directory, and it walks the directory.
    //
    // THIS CHECK HAS NOW BEEN WRONG ON BOTH OF ITS AXES, AND PARTIALLY FIXED
    // TWICE. Recorded in full because the sequence is the lesson.
    //
    //   REACH, first miss: it scanned `from '...'` only, so
    //   `import '../game/progression';` — a side-effect import, which has no
    //   `from` — was invisible. Verified by planting exactly that line: this
    //   guard stayed GREEN and the directory's string census caught it
    //   instead, on the path counting as one more literal. A different check
    //   noticing by accident is not this check working. Found by the builder
    //   of `src/career/`, which copied this scanner and fixed the copy.
    //
    //   PREDICATE, missed until a critic read the fixed version: the pattern
    //   was `'([^']+)'` — single quotes only — so
    //   `from "../game/progression"` walked straight past all three forms.
    //   Verified in `src/career/`, where the same hole existed: with that line
    //   planted, the named fence stayed green at `expected 186 to be 185` on a
    //   different test entirely. Prettier writes single quotes here, so this
    //   is not a mutant the repo produces by habit — which is the reason a
    //   fence must catch it. A fence that holds only while everyone follows
    //   the style guide is a style guide.
    //
    //   REACH, second miss, and the one this rewrite is really about: it named
    //   TWO FILES. `src/empire/` ships ten. `expansion.test.ts` and
    //   `social.test.ts` each grew their own copy for the file they were about
    //   — both on the original form-only, single-quote-only pattern — and six
    //   modules had no fence at all. Three partial hand-written walkers is
    //   exactly what CLAUDE.md means by "a twin guard must READ the sibling's
    //   list, not copy it": each copy inherited the defect and none of them
    //   covered the gap between them.
    //
    // So: one walker, over every shipped module the walk finds, with the
    // edges pinned per file rather than constrained. Deleting a module or
    // adding one is a change to this directory's shape and should be read.
    //
    //   REACH, THIRD MISS, and it is the one this rewrite is about: the walker
    //   was `readdirSync(HERE)`, which reads ONE LEVEL. `src/empire/sub/leak.ts`
    //   holding `import { WALLET_CURRENCIES } from '../../game/progression';`
    //   compiles — `tsc --noEmit` exit 0 — and with it planted this file passed
    //   57 tests at exit 0 while fencing a directory with an illegal edge in
    //   it. Four sibling files passed 178 tests beside it. What went red was in
    //   `empireForbiddenOutput.test.ts`, on a module count and a directory
    //   shape, and no message in the whole run named `game/progression`.
    //
    //   WHY THIS CHECK COULD NOT NOTICE, rather than why it happened not to.
    //   Both sides of `Object.keys(EXPECTED)` vs `SHIPPED_MODULES` derive from
    //   the same walk, so a file the walk cannot see is missing from both and
    //   the set equality is satisfied by construction. `expect(fenced).toBe(10)`
    //   is satisfied the same way. A both-way join over an incomplete
    //   enumeration is not a join, and this directory reaches for a both-way
    //   join whenever it wants to show something is complete.
    //
    //   The walk is now `shippedModuleNames()` from `directoryWalk.test.ts` —
    //   one implementation, recursive, shared by all five census sites here, so
    //   this is READING the sibling's walk rather than holding a fourth copy of
    //   one. Keys are paths relative to this directory, which on a flat tree are
    //   the same bare names this table always had.
    //
    // MUTANTS RUN AGAINST THIS VERSION, all three planted in `production.ts` —
    // a module the two-file fence could not reach at all, so each covers both
    // the reach fix and its own axis:
    //
    //   import { FATIGUE_TUNING } from '../game/fatigue';   -> RED
    //   import { FATIGUE_TUNING } from "../game/fatigue";   -> RED
    //   import '../game/fatigue';                           -> RED
    //
    // each with "production.ts: expected [ '../game/fatigue', …(2) ] to deeply
    // equal [ './empireCore', './empireTuning' ]". The message names the file
    // and the offending specifier, which is the other half of the bar: a check
    // that bites but fails uselessly is half a check.
    //
    // A static `from \`...\`` mutant is NOT listed because it is a syntax
    // error rather than a bypass — a template literal is not a legal specifier
    // for a static import. The backtick axis is real only on the dynamic form,
    // and the probe grid below covers it.
    const SHIPPED_MODULES = shippedModuleNames();
    const SPECIFIER = /(?:\bfrom|\bimport)\s*\(?\s*(['"`])([^'"`]+)\1/g;
    const imports = (name: string): readonly string[] => {
      const source = readFileSync(path.join(HERE, name), 'utf8');
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      return [...code.matchAll(SPECIFIER)].map((match) => match[2] as string);
    };
    const EXPECTED: Readonly<Record<string, readonly string[]>> = {
      'empireCore.ts': ['./empireTuning'],
      'empireInvariant.ts': [
        './empireCore',
        './empireTuning',
        './expansion',
        './npc',
        './production',
        './recruitment',
        './reputation',
        './social',
      ],
      'empireTuning.ts': [],
      'engagement.ts': ['./empireCore', './empireTuning', './empireInvariant', './social'],
      'expansion.ts': ['./empireCore', './empireTuning'],
      'floor.ts': ['./empireCore', './empireTuning', './ladder', './members', './sessions'],
      // GDD §5.13 presentation Phase 3. Six edges, one more than floor.ts's
      // five: it reads the floor's own read models (`floorLayout`,
      // `fixedFloorFurniture`, `ambientMemberRoster`, `floorGridSize`) as well
      // as the vocabularies floor.ts reads.
      'floorSim.ts': [
        './empireCore',
        './empireTuning',
        './floor',
        './ladder',
        './members',
        './sessions',
        './stationCapability',
        './trainingStation',
      ],
      'FloorGrid.tsx': [
        './empireTuning',
        './floor',
        './floorSim',
        // GDD §5.13 presentation Phase 4: the sprite tables the floor draws.
        './floorSprites',
        './ladder',
        './ladderView',
        // Stage G.2C3: last-arrival notice copy.
        './livingMemberArrival',
        // Stage G.2C2: last-departure notice copy.
        './livingMemberDeparture',
        // Stage G.2D: member-card dues line.
        './livingMemberDues',
        './livingMemberExperience',
        './livingMemberReputation',
        './livingMemberRetention',
        './livingMemberSeason',
        './livingMembers',
        // GDD §5.14 Stage C: the contextual station panel reads condition,
        // manager capability and the standing maintenance review straight
        // out of `management.ts`, and calls `repairEquipment` itself to
        // decide whether a press would succeed — never a second copy of
        // that arithmetic.
        './management',
        './members',
        './sessions',
        // Stage C's own small selector — see that file's header.
        './stationView',
        // GDD §5.14 Stage D / §5.18 Stage D.1: Q/C/T levels the panel
        // upgrades and the bay expansion/marks read.
        './stationCapability',
        './trainingStation',
        'react',
        'react-native',
      ],
      // Phase 4: pure sprite data. Tuning for every colour and scale knob,
      // and the three vocabulary types its tables are keyed by.
      'floorSprites.ts': ['./empireTuning', './ladder', './members', './sessions'],
      'GymScreen.tsx': [
        './empireTuning',
        './FloorGrid',
        './floorSprites',
        './ladder',
        './ladderView',
        // Staff person cards: dues / reputation / tenure copy already
        // published by those modules. Presentation only — no new economy.
        './livingMemberDues',
        './livingMemberReputation',
        './livingMembers',
        // S4b: §5.11 stage 4 reaching the screen. Every condition, cost,
        // staffing and dormancy quantity this screen draws is a call into
        // `management.ts`; nothing about stage 4 is recomputed here.
        './management',
        './sessions',
        // GDD §5.14 Stage C.1a: `recoveryBlockingItems`, the same per-item
        // recovery predicate the station panel now reads, so a dormant
        // gym's own screen can point at which stations are blocking it —
        // one new edge, no new arithmetic.
        './stationView',
        // CAREER-EMPIRE-REP-01 / REP-EVIDENCE-01: composed reputation HUD.
        './institutionalReputation',
        'react-native',
      ],
      'institutionalReputation.ts': [
        './empireCore',
        './empireTuning',
        './livingMemberReputation',
        './sportingReputationLedger',
      ],
      'ladder.ts': ['./empireCore', './empireTuning', './production'],
      // S4b: `./management` joined the reducer's edges — `GymViewState.managed`
      // is a `ManagedGym` now, and every stage-4 arm is one call into that
      // module, the same one-call-per-arm shape the stage-1/2 arms already had.
      'ladderView.tsx': [
        './empireTuning',
        './floor',
        './floorSim',
        './ladder',
        './livingMemberDues',
        './livingMembers',
        './management',
        './sessions',
        // CAREER-EMPIRE-REP-01: sporting ledger + credit-sporting-result.
        './sportingReputationLedger',
        './stationCapability',
        './trainingStation',
      ],
      // §5.11 stage 4. Five edges: the throw gate, the tuning block, the
      // equipment vocabulary and accrual type from stage 1, `scrubPrecision`,
      // and stage 2's composed gym state — composed whole rather than
      // re-implemented.
      'management.ts': [
        './empireCore',
        './empireTuning',
        './ladder',
        './production',
        './sessions',
      ],
      'members.ts': ['./empireCore', './empireTuning', './production', './sessions'],
      'livingMemberArrival.ts': [
        './empireCore',
        './empireTuning',
        './livingMemberStay',
        './livingMembers',
        './members',
        './sessions',
      ],
      'livingMemberDues.ts': [
        './empireCore',
        './empireTuning',
        './livingMemberExperience',
        './livingMembers',
        './members',
        './production',
      ],
      'livingMemberExperience.ts': ['./empireCore', './empireTuning', './livingMembers'],
      'livingMemberReputation.ts': [
        './empireCore',
        './empireTuning',
        './livingMemberDues',
        './livingMembers',
        './members',
        './production',
      ],
      'livingMemberRetention.ts': ['./empireCore', './empireTuning', './livingMemberExperience'],
      'livingMemberSeason.ts': [
        './empireCore',
        './empireTuning',
        './livingMembers',
        './members',
        './sessions',
      ],
      'livingMemberStay.ts': ['./empireCore', './empireTuning', './livingMemberRetention', './members'],
      'livingMemberDeparture.ts': [
        './empireCore',
        './livingMemberRetention',
        './livingMemberStay',
        './livingMembers',
      ],
      'livingMembers.ts': [
        './empireCore',
        './empireTuning',
        './floor',
        './floorSim',
        './ladder',
        './livingMemberArrival',
        './livingMemberDeparture',
        './livingMemberDues',
        './livingMemberExperience',
        './livingMemberReputation',
        './livingMemberRetention',
        './livingMemberSeason',
        './livingMemberStay',
        './members',
        './sessions',
      ],
      'npc.ts': ['./empireCore', './empireTuning'],
      // GDD §5.14 Stage B: the economy pacing simulator. Composes the ladder
      // (stage 1) and management (stage 4) engines whole rather than
      // reimplementing their arithmetic, and reads `offlineBankingHorizonSeconds`
      // straight from `production.ts` for the sporadic-policy gap cap.
      'pacing.ts': ['./empireCore', './empireTuning', './ladder', './management', './production'],
      'production.ts': ['./empireCore', './empireTuning'],
      'recruitment.ts': ['./empireCore', './empireTuning'],
      'reputation.ts': ['./empireCore', './empireTuning', './expansion', './production'],
      'sessions.ts': ['./empireCore', './empireTuning', './ladder', './production'],
      'social.ts': ['./empireCore', './empireTuning'],
      'sportingReputation.ts': ['./empireCore', './empireTuning', './production'],
      'sportingReputationLedger.ts': [
        './empireCore',
        './empireTuning',
        './production',
        './sportingReputation',
      ],
      // GDD §5.14 Stage C: the station-tap management selector. Five edges —
      // the tuning block, the floor sim's own vocabulary (`FloorStationRef`,
      // `FloorSimMember`), `management.ts`'s condition/repair/manager
      // functions, `members.ts`'s `MemberType`, and `sessions.ts`'s
      // `sessionEquipmentGroup` for a session station's identity.
      'stationView.ts': [
        './empireTuning',
        './floorSim',
        './ladder',
        './management',
        './members',
        './sessions',
        './stationCapability',
      ],
      'stationCapability.ts': ['./empireCore', './empireTuning', './trainingStation'],
      'trainingStation.ts': ['./floor', './ladder'],
    };
    let fenced = 0;
    for (const name of SHIPPED_MODULES) {
      expect([...imports(name)].sort(), name).toEqual(
        [...(EXPECTED[name] ?? ['NO EXPECTATION PINNED'])].sort(),
      );
      fenced += 1;
    }
    // Counts, not bounds. A module added without a row above fails on the
    // sentinel rather than passing unchecked, and the set equality catches a
    // row left behind by a deleted module.
    expect(fenced).toBe(SHIPPED_MODULES.length);
    // 13 -> 14: GymScreen.tsx. 14 -> 15: members.ts (§5.11 stage 3).
    // 15 -> 17: GDD §5.13 presentation Phase 1's floor.ts and FloorGrid.tsx.
    // 17 -> 18: GDD §5.13 presentation Phase 3's floorSim.ts. Read from this
    // assertion's own failure value.
    // 18 -> 19: Phase 4's floorSprites.ts.
    // 20 -> 21: GDD §5.14 Stage B's pacing.ts. Read from this assertion's own
    // failure value.
    // 21 -> 22: GDD §5.14 Stage C's stationView.ts.
    // 22 -> 23: GDD §5.14 Stage D's stationCapability.ts.
    // 23 -> 24: GDD §5.18 Stage D.1's trainingStation.ts.
    // 27 -> 28: Stage G.2B livingMemberRetention.ts.
    // 28 -> 29: Stage G.2C1 livingMemberStay.ts.
    // 29 -> 30: Stage G.2C2 livingMemberDeparture.ts.
    // 30 -> 31: Stage G.2C3 livingMemberArrival.ts.
    // 31 -> 32: Stage G.2D livingMemberDues.ts.
    // 32 -> 33: Stage G.2E livingMemberReputation.ts.
    // 33 -> 34: G2-ATHLETE-SEASON-01 livingMemberSeason.ts.
    // 34 -> 36: CAREER-EMPIRE-REP-01 institutionalReputation.ts +
    // sportingReputationLedger.ts.
    expect(fenced).toBe(36);
    expect(Object.keys(EXPECTED).sort()).toEqual([...SHIPPED_MODULES].sort());

    // And the fence is a property, not just a list: every RELATIVE specifier
    // anywhere in the directory resolves to a module in this directory.
    //
    // Resolved against the IMPORTING module's own directory rather than by
    // stripping a leading `./`. On the flat tree the two agree at every one of
    // the 32 edges; they part on a module in a subdirectory, where a strip
    // reads `../../game/progression` as a name that is merely absent and a
    // resolve reads it as a path that leaves the directory. The strip is also
    // wrong in the reassuring direction one level down — `sub/a.ts` importing
    // `./b` would strip to `b.ts`, and if a top-level `b.ts` existed the edge
    // would resolve to a module it does not import.
    const resolved = (name: string, specifier: string): string =>
      `${path.posix.normalize(path.posix.join(path.posix.dirname(name), specifier))}.ts`;
    // `resolved` always appends `.ts` — true of every edge in this directory
    // until `GymScreen.tsx` imported `./ladderView`, a `.tsx` file. Rather
    // than widen `resolved` itself (its own three driven cases below still
    // pin the `.ts` form byte for byte), this is the `.tsx` alternate,
    // tried only when the `.ts` form is not a real module.
    const resolvedTsx = (name: string, specifier: string): string =>
      resolved(name, specifier).replace(/\.ts$/, '.tsx');
    // THE LIMIT, stated because a type cannot reach past it: this widening
    // makes the fence accept a `.tsx` sibling that resolves alongside a `.ts`
    // one of the same base name — no such pair exists in this directory today
    // (`ladderView` and `GymScreen` each own exactly one extension), and nothing
    // here refuses one arriving. The property this loop still enforces
    // unconditionally is the one that matters: EITHER form must be a real
    // module in `SHIPPED_MODULES`, so an escape to a repo file outside this
    // directory is caught on both extensions identically.
    //
    // A SEPARATE property for the non-relative form: `react-native` is not a
    // path this directory owns, and resolving it as one would read as
    // `GymScreen.ts` or `GymScreen.tsx` — coincidentally a real file, which is
    // exactly the kind of accidental pass this fence exists to not have. A
    // bare specifier is therefore routed to its own explicit, per-file
    // allow-list instead of through path resolution, and the two counts
    // below are pinned separately so one cannot silently absorb the other.
    const EXTERNAL_PACKAGE_IMPORTS: Readonly<Record<string, readonly string[]>> = {
      'GymScreen.tsx': ['react-native'],
      // GDD §5.13 Phase 1's drag-interaction screen — the one module in this
      // directory that needs a real hook (`useRef`/`useState`), so it needs
      // `react` explicitly rather than the ambient jsx-runtime GymScreen.tsx
      // and ladderView.tsx get away with. `FloorGrid.tsx`'s own header
      // explains why it, and not `GymScreen.tsx`, is where that hook lives.
      'FloorGrid.tsx': ['react', 'react-native'],
    };
    let specifiers = 0;
    let externalSpecifiers = 0;
    for (const name of SHIPPED_MODULES) {
      for (const specifier of imports(name)) {
        if (!specifier.startsWith('.')) {
          expect(
            EXTERNAL_PACKAGE_IMPORTS[name] ?? [],
            `${name} imports external package ${specifier}`,
          ).toContain(specifier);
          externalSpecifiers += 1;
          continue;
        }
        const asTs = resolved(name, specifier);
        const asTsx = resolvedTsx(name, specifier);
        expect(
          SHIPPED_MODULES.includes(asTs) || SHIPPED_MODULES.includes(asTsx),
          `${name} imports ${specifier}`,
        ).toBe(true);
        specifiers += 1;
      }
    }
    // 37 -> 41: GymScreen.tsx's four intra-directory edges (./empireTuning,
    // ./ladder, ./ladderView, ./sessions).
    // 41 -> 45: members.ts's four intra-directory edges (./empireCore,
    // ./empireTuning, ./production, ./sessions).
    // 45 -> 55: GDD §5.13 presentation Phase 1 — floor.ts (4: ./empireCore,
    // ./empireTuning, ./ladder, ./sessions), FloorGrid.tsx (4: ./empireTuning,
    // ./floor, ./ladderView, ./sessions), ladderView.tsx's new ./floor edge
    // (1), and GymScreen.tsx's new ./FloorGrid edge (1).
    // 55 -> 56: GDD §5.13's PLAYTEST 2 ruling adds FloorGrid.tsx's new
    // ./ladder edge (`fixedFloorFurniture`, `LadderEquipmentItem`), read from
    // this assertion's own failure value.
    // 56 -> 58: GDD §5.13 presentation Phase 2 adds a ./members edge to both
    // floor.ts (`equipmentBiasedMemberTypes`, `MemberType`) and FloorGrid.tsx
    // (`MemberType`). Read from this assertion's own failure value.
    // 58 -> 64: GDD §5.13 presentation Phase 3 adds floorSim.ts's six
    // intra-directory edges. Read from this assertion's own failure value.
    // 64 -> 65: Phase 3's RENDER half adds FloorGrid.tsx's own ./floorSim
    // edge — the one arrow this round draws. Read from this assertion's own
    // failure value.
    // 65 -> 70: GDD §5.13 presentation Phase 4 — floorSprites.ts's four
    // intra-directory edges (./empireTuning, ./ladder, ./members,
    // ./sessions) and FloorGrid.tsx's one new ./floorSprites edge. Read from
    // this assertion's own failure value.
    // 70 -> 75: §5.11 stage 4's `management.ts` — five intra-directory edges
    // (./empireCore, ./empireTuning, ./ladder, ./production, ./sessions).
    // Read from this assertion's own failure value.
    // 75 -> 77: S4b — the two new `./management` edges, one from
    // `GymScreen.tsx` (the screen reads condition, staffing and dormancy) and
    // one from `ladderView.tsx` (the reducer writes them). Both are named in
    // `EXPECTED` above, which is the per-file assertion this total is only the
    // sum of; the total moving alone would be caught there first.
    // 77 -> 82: GDD §5.14 Stage B's pacing.ts — five intra-directory edges
    // (./empireCore, ./empireTuning, ./ladder, ./management, ./production).
    // Read from this assertion's own failure value.
    // 82 -> 89: GDD §5.14 Stage C — two new edges on `FloorGrid.tsx`
    // (./management, ./stationView) plus `stationView.ts`'s own five
    // (./empireTuning, ./floorSim, ./management, ./members, ./sessions).
    // Read from this assertion's own failure value.
    // 89 -> 90: GDD §5.14 Stage C.1a — one new edge, `GymScreen.tsx ->
    // ./stationView` (`recoveryBlockingItems`). Read from this assertion's
    // own failure value.
    // 92 -> 100: GDD §5.14 Stage D — stationCapability.ts's three edges
    // plus floorSim/FloorGrid/ladderView/stationView reading it, and
    // ladderView's new floorSim edge for realised-capacity preview.
    // 100 -> 104: GDD §5.18 Stage D.1 — trainingStation.ts's two edges
    // (./floor, ./ladder), floorSim and FloorGrid reading it, ladderView
    // swapping floorSim for trainingStation, stationCapability swapping
    // ladder for trainingStation.
    // 107 -> 117: Stage G.1 — livingMembers.ts edges plus ladderView/FloorGrid
    // reading it and floorSim observation exports.
    // 117 -> 121: Stage G.2A — livingMemberExperience.ts three edges plus
    // FloorGrid reading it.
    // 121 -> 125: Stage G.2B — livingMemberRetention.ts three edges plus
    // FloorGrid reading it.
    // 125 -> 132: Stage G.2C1 — livingMemberStay.ts four edges plus
    // livingMembers.ts reading experience / retention / stay.
    // 132 -> 138: Stage G.2C2 — livingMemberDeparture.ts four edges plus
    // livingMembers.ts and FloorGrid.tsx reading it.
    // 138 -> 145: Stage G.2C3 — livingMemberArrival.ts five edges plus
    // livingMembers.ts and FloorGrid.tsx reading it.
    // 145 -> 153: Stage G.2D — livingMemberDues.ts six edges plus livingMembers
    // and FloorGrid reading it.
    // 153 -> 154: Stage G.2D purse composition — ladderView.tsx imports livingMemberDues.ts.
    // 154 -> 163: Stage G.2E livingMemberReputation.ts six edges plus livingMembers / FloorGrid / arrival.
    // 163 -> 170: G2-ATHLETE-SEASON-01 livingMemberSeason.ts five edges plus livingMembers / FloorGrid.
    // CAREER-EMPIRE-REP-01: +10 specifiers (ledger + composer + GymScreen).
    // SF-TWL-GYM-EMPIRE-UX-01: GymScreen.tsx staff cards read living-member
    // dues, reputation, and tenure — three presentation edges, no new math.
    expect(specifiers).toBe(183);
    // Non-vacuous in both directions: a real edge exists that only the `.tsx`
    // alternate resolves (GymScreen.tsx -> ladderView.tsx), and the allow-list
    // really is being read rather than defaulting open — an unlisted external
    // package on a module with no row would fail on `[]`, driven directly
    // below rather than only implied by the loop above.
    // 1 -> 3: FloorGrid.tsx's react and react-native.
    expect(externalSpecifiers).toBe(3);
    expect(
      Object.values(EXTERNAL_PACKAGE_IMPORTS).reduce((total, list) => total + list.length, 0),
    ).toBe(3);
    expect(EXTERNAL_PACKAGE_IMPORTS['sessions.ts'] ?? []).not.toContain('react-native');
    // The resolver is driven rather than trusted, on both the shape the tree
    // has and the shape it does not, so this is a subject rather than a helper.
    expect(resolved('empireCore.ts', './empireTuning')).toBe('empireTuning.ts');
    expect(resolved('sub/leak.ts', '../../game/progression')).toBe('../game/progression.ts');
    expect(resolved('sub/leak.ts', './helper')).toBe('sub/helper.ts');
    // The `.tsx` alternate, driven the same way: the real edge that needs it,
    // and a synthetic case showing it is a suffix swap and nothing cleverer.
    expect(resolvedTsx('GymScreen.tsx', './ladderView')).toBe('ladderView.tsx');
    expect(resolved('GymScreen.tsx', './ladderView')).toBe('ladderView.ts');
    expect(SHIPPED_MODULES).not.toContain('ladderView.ts');
    expect(SHIPPED_MODULES).toContain('ladderView.tsx');
    expect(resolvedTsx('sub/leak.ts', '../../game/progression')).toBe('../game/progression.tsx');

    // Non-vacuity over BOTH axes: every (form x quote) pair is caught on a
    // synthetic source, so an empty answer above is an answer rather than a
    // dead regex. Driven from the two axes rather than listed, with the grid
    // size pinned, so widening the pattern without widening the probes is not
    // possible.
    const FORMS: readonly ((quoted: string) => string)[] = [
      (quoted) => `import { meetsQualifyingTotal } from ${quoted};`,
      (quoted) => `import ${quoted};`,
      (quoted) => `const m = await import(${quoted});`,
    ];
    const QUOTES: readonly string[] = ["'", '"', '`'];
    let probes = 0;
    for (const form of FORMS) {
      for (const quote of QUOTES) {
        const text = form(`${quote}../game/progression${quote}`);
        expect(
          [...text.matchAll(SPECIFIER)].map((match) => match[2] as string),
          text,
        ).toEqual(['../game/progression']);
        probes += 1;
      }
    }
    expect(probes).toBe(FORMS.length * QUOTES.length);
    expect(probes).toBe(9);
  });

  it('holds every number in the tuning module and none anywhere else', () => {
    // The repository's own audit, run from inside this piece rather than only
    // in the tree-wide pass, so a bare literal here is red before it is red
    // there.
    //
    // THIS GUARD HAS TO BE RIGHT IN TWO WORLDS AND WAS RIGHT IN ONE. It pinned
    // the audit at 87 findings in `empireTuning.ts` — true only while that file
    // is ABSENT from `SOURCE_RULES`. The row that registers it is drafted and
    // lands in another session's file; the moment it does, the correct number
    // is zero and a guard pinned at 87 goes red on a correct change, which is
    // the worst kind of red because the fix looks like weakening the check.
    //
    // So it reads `SOURCE_RULES` and asserts the right thing on each side. The
    // registration is a fact about the tree, not a flag this test sets.
    const REGISTERED_PATH = 'src/empire/empireTuning.ts';
    const registered = Object.prototype.hasOwnProperty.call(SOURCE_RULES, REGISTERED_PATH);

    const sources = new Map<string, string>(
      shipped.map((name) => [`src/empire/${name}`, readFileSync(path.join(HERE, name), 'utf8')]),
    );
    expect([...sources.keys()]).toEqual(shipped.map((name) => `src/empire/${name}`));

    // What the audit says about the directory as it really sits, per file.
    const findings = new Map(
      [...sources].map(([relPath, source]) => [relPath, auditSource(relPath, source)]),
    );
    const report = (relPath: string): string =>
      `\n${formatFindings(findings.get(relPath) ?? [])}\n`;

    // Every file except the tuning module is a `renderer` in both worlds and
    // must be numerically clean. This half does not branch.
    let renderers = 0;
    for (const relPath of sources.keys()) {
      if (relPath === REGISTERED_PATH) continue;
      expect(findings.get(relPath)?.length, `${relPath}${report(relPath)}`).toBe(0);
      renderers += 1;
    }
    expect(renderers).toBe(shipped.length - 1);

    if (registered) {
      // The row landed. Nothing in `src/empire/` may report anything at all,
      // and the row has to be a constants row — a `renderer` row would be the
      // default and would leave the count at 87 while looking like a fix.
      expect(SOURCE_RULES[REGISTERED_PATH]?.role).toBe('constants');
      expect(findings.get(REGISTERED_PATH)?.length, report(REGISTERED_PATH)).toBe(0);
    } else {
      // The row has not landed. Every finding in the directory is in the tuning
      // module and there are exactly this many of them — the one tree-wide
      // failure this piece expects, pinned rather than bounded so a literal
      // arriving in it is a decision somebody signs.
      // 136 -> 186: §5 (v2) stage 3's ten new member tuning entries.
      expect(findings.get(REGISTERED_PATH)?.length, report(REGISTERED_PATH)).toBe(186);
      // And the row would fix it rather than hide it: audited under a path that
      // already carries the rule it is asking for, the same bytes report
      // nothing, because every literal sits inside a frozen, named, top-level
      // constant block.
      const asRegistered = auditSource(
        'src/game/sessionTuning.ts',
        sources.get(REGISTERED_PATH) ?? '',
      );
      expect(asRegistered.length, `\n${formatFindings(asRegistered)}\n`).toBe(0);
    }

    // The content pin, taken under a path that is unregistered in BOTH worlds,
    // so the number survives the row landing. This is the line that says the
    // instrument still sees the tuning block at all: it is 87 today, it is 87
    // after registration, and it is 0 only if the block empties or the audit
    // stops reporting.
    const asRenderer = auditSource(
      'src/empire/__unregistered.ts',
      sources.get(REGISTERED_PATH) ?? '',
    );
    // 136 -> merged: §5 (v2) stage 3's ten new member tuning entries landed
    // independently of GDD §5.13 presentation Phase 1's three new tuning
    // blocks (FLOOR_GRID_SIZE, SESSION_EQUIPMENT_FOOTPRINT, and the five
    // scalar pixel/z-index knobs). Re-measured on the merged tree rather than
    // hand-counted leaves.
    // 218 -> 224: GDD §5.13's PLAYTEST 2 ruling's two new tuning entries —
    // FLOOR_FIXED_FURNITURE_LAYOUT (gap 1) and FLOOR_GRID_LINE_WIDTH_PIXELS
    // (gap 3). Read from this assertion's own failure value, not
    // hand-counted from the new source lines.
    // 224 -> 226: PLAYTEST 3's overlap-refusal ruling's two new tuning
    // entries — FLOOR_OVERLAP_REFUSAL_FLASH_MS (1200) and
    // FLOOR_OVERLAP_REFUSAL_OUTLINE_WIDTH_PIXELS (4), one literal each.
    // Read from this assertion's own failure value, not hand-counted.
    // 226 -> 231: GDD §5.13 presentation Phase 2's three new tuning entries —
    // AMBIENT_MEMBER_COUNT_BY_RUNG (four rung values),
    // AMBIENT_MEMBER_FOOTPRINT_TILES (width, height) and
    // AMBIENT_MEMBER_PLACEMENT_STRIDE (one value). Read from this assertion's
    // own failure value, not hand-counted.
    // 231 -> 239: PLAYTEST 4's eight new scalar knobs
    // (AMBIENT_MEMBER_HEAD_DIAMETER_FRACTION, AMBIENT_MEMBER_BODY_WIDTH_FRACTION,
    // AMBIENT_MEMBER_BODY_HEIGHT_FRACTION, AMBIENT_MEMBER_BODY_CORNER_RADIUS_PIXELS,
    // AMBIENT_MEMBER_BOB_AMPLITUDE_PIXELS, AMBIENT_MEMBER_BOB_HALF_CYCLE_MS,
    // AMBIENT_MEMBER_BOB_STAGGER_LANES, AMBIENT_MEMBER_BOB_STAGGER_STEP_MS —
    // one numeric literal each). Read from this assertion's own failure value.
    expect(
      asRenderer.length,
      'the count of literals the audit finds in empireTuning.ts moved: an entry was added or ' +
        'removed, or the instrument stopped reporting. Both are decisions; neither is a tuning ' +
        `pass. First finding: ${formatFindings(asRenderer.slice(0, 1)).trim()}`,
    // 239 -> 256: GDD §5.13 presentation Phase 3's thirteen FLOOR_SIM entries,
    // seventeen numeric leaves between them (twelve scalars plus
    // FLOOR_SIM_USE_TICKS_BY_TYPE's five). Read from this assertion's own
    // failure value.
    // 256 -> 267: Phase 3's RENDER half adds twelve scalar knobs and ELEVEN
    // findings — `FLOOR_SIM_RENDER_SEED: 1` is the twelfth entry and the
    // audit does not report a bare 1, which is worth writing down because a
    // reader hand-summing the entries would expect 268 and find the
    // instrument disagreeing. Read from this assertion's own failure value.
    // 267 -> 365: GDD §5.13 presentation Phase 4. +102 from the seven
    // FLOOR_SPRITE entries (mostly RGB components: 8 body colours, 5 outfit
    // pairs, 11 gear colours and 4 floor tones at three components each,
    // less the components the audit's 0/1/2 idioms absorb, plus the two
    // scalar knobs and the fleck stride), -4 from retiring PLAYTEST 4's
    // placeholder-body sizing knobs with the placeholder itself. Read from
    // this assertion's own failure value, not hand-summed.
    // 365 -> 366: the label-size knob (FLOOR_SPRITE_LABEL_FONT_SIZE).
    // 366 -> 383: §5.11 stage 4's fourteen entries, whose nested per-tier
    // tables carry three leaves each rather than one. Read from this
    // assertion's own failure value, not hand-summed.
    // 383 -> 385: the two ordinal review knobs
    // (MAINTENANCE_ORDER_FIRST_CHECK_IN, MAINTENANCE_ORDER_STRIDE), one
    // numeric leaf each. Read from this assertion's own failure value.
    // 385 -> 386: "kill the mint" adds one numeric leaf,
    // WALL_CLOCK_TICK_INTERVAL_SECONDS. Read from this assertion's own
    // failure value.
    // 386 -> 387: the same round's harness fix adds one more,
    // MILLISECONDS_PER_SECOND. Read from this assertion's own failure value.
    // 387 -> 388: the "chrome vs paid" bug-fix round's one new tuning
    // literal, DUST_REPAIR_COST_GYM_BUCKS (0.01). Read from this assertion's
    // own failure value.
    // 388 -> 393: S4h's GYM_SCREEN_BUTTON_* block, six new entries but FIVE
    // new findings — PADDING_VERTICAL_PIXELS (10), PADDING_HORIZONTAL_PIXELS
    // (16), BORDER_RADIUS_PIXELS (8), MIN_HEIGHT_PIXELS (44) and
    // DISABLED_OPACITY (0.5). BORDER_WIDTH_PIXELS is `1`, which
    // `ALWAYS_STRUCTURAL` already exempts everywhere — the same reason
    // `FLOOR_SIM_RENDER_SEED: 1` above (239 -> 256) reported no finding for
    // its own literal. Read from this assertion's own failure value, not
    // hand-summed.
    // 393 -> 394: S4i's one new tuning literal,
    // GYM_SCREEN_LEAVE_PILL_CLEARANCE_PIXELS (82). Read from this
    // assertion's own failure value.
    // 394 -> 399: GDD §5.14 Stage B's one new tuning entry,
    // PACING_REPORT_HORIZONS_SECONDS — an array of five literals (600, 3600,
    // 86400, 259200, 604800), so FIVE new findings under the synthetic
    // unregistered path rather than one. Read from this assertion's own
    // failure value.
    // 399 -> 403: GDD §5.14 Stage C's four new tuning entries
    // (STATION_TAP_MAX_DRAG_PIXELS: 7, FLOOR_STATION_PANEL_PADDING_PIXELS: 10,
    // FLOOR_STATION_PANEL_BORDER_WIDTH_PIXELS: 2,
    // FLOOR_STATION_PANEL_MARGIN_TOP_PIXELS: 8) — four new findings, none of
    // them 0 or 1. Read from this assertion's own failure value.
    // 411 -> 412: Stage D STATION_QUALITY_AFFINITY_BONUS 0.25.
    // 412 -> 413: Stage D2.1B FLOOR_SIM_STATION_CHANGEOVER_TICKS (18).
    // STATION_THROUGHPUT_USE_TICKS_FACTOR (0.65) was replaced by
    // STATION_THROUGHPUT_CHANGEOVER_TICKS (6) — replace, count unchanged.
    // 413 -> 422: Stage D2.2 nine new tuning literals (SECONDS_PER_MINUTE,
    // two watched grains, six FLOOR_PLATE_LOADING leaves).
    // 428 -> 434: Stage G.1 four living-member service-history knobs.
    // 434 -> 435: Stage G.1C LIVING_MEMBER_WAIT_VERY_LONG_MIN_TICKS.
    // 435 -> 448: Stage G.2A LIVING_MEMBER_EXPERIENCE leaves (13 findings;
    // trainingQualityScore 1 is ALWAYS_STRUCTURAL).
    // 448 -> 451: Stage G.2B LIVING_MEMBER_RETENTION three label mins.
    // 451 -> 454: G2-ATHLETE-SEASON-01 ATHLETE_SEASON three week knobs.
    // 454 -> 455: SF-TWL-GYM-EMPIRE-UX-01 GYM_SCREEN_DOCK_HOME_FLEX.
    ).toBe(455);
    // And the instrument is live on a file it has never seen, in both worlds.
    expect(auditSource('src/empire/probe.ts', 'export const RATE = 42;\n').length).toBe(1);
  });
});
