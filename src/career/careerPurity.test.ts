/**
 * careerPurity.test.ts — the import fence, the dice ban, and the half of
 * GDD §12.3's pay-to-win line that `CAREER_ELIGIBILITY_READS_NO_WALLET` cannot
 * see.
 *
 * ===========================================================================
 * Why this file exists, and why it does not copy Empire's scanners
 * ===========================================================================
 *
 * Empire already has a directory purity block. An outside audit planted
 * mutants against it (M0–M5, M11–M14) rather than reading the comments.
 * Single-quoted `from '../game/progression'` in the two files
 * `empireCore.test.ts` actually opens went red. Four other plants stayed
 * green:
 *
 *   M1  a sibling file (`production.ts`) the "directory" test never opened
 *   M2  `from "../game/progression"` (double quotes)
 *   M3  `import '../game/progression'` (side-effect, no `from`)
 *   M4  double quotes in `empireCore.ts` itself
 *   M5  side-effect import in `empireCore.ts` itself
 *
 * Career had no import fence and no dice scan at all (M13, M14). Copying
 * Empire's `from\s+'([^']+)'` regex into a second directory would have
 * ported the incomplete version. This file uses the TypeScript AST, walks
 * every shipped module, and keeps a live probe for each spelling that
 * stayed green over there.
 *
 * `careerSweep.ts` may import `../game/prng` — it is the measurement
 * fixture, and its header already forbids `Math.random` in favour of a
 * seeded generator. Every other shipped module may not. `Math.random`
 * itself is banned in all of them, sweep included.
 *
 * ===========================================================================
 * The opacity half (audit mutant M12)
 * ===========================================================================
 *
 * `CAREER_ELIGIBILITY_READS_NO_WALLET` proves `CareerLifter` has exactly
 * three keys. Vitest strips types, so that constant is graded by `tsc`.
 * The runtime key pin in `eligibility.test.ts` catches a key added to the
 * object. Neither catches:
 *
 *   export let careerDebugWallet = 0;
 *   export function qualifiesFor(...) {
 *     if (careerDebugWallet > 0) return true;
 *     ...
 *   }
 *
 * The type still says `true`. The object still has three keys. Qualification
 * now reads a hidden balance. This file asks the checker which value
 * bindings `qualifiesFor` and its siblings close over, follows import
 * aliases, and refuses module-level or imported `let`/`var`.
 *
 * A synthetic overlay of that exact plant is compiled on every run, so a
 * scanner that stopped resolving identifiers cannot pass by looking at a
 * tree that contains no `let`.
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(HERE, '..', '..');
const ELIGIBILITY_PATH = path.join(HERE, 'eligibility.ts');

const SHIPPED = [
  'calendar.ts',
  'careerSweep.ts',
  'careerTuning.ts',
  'eligibility.ts',
  'federation.ts',
] as const;

type ShippedName = (typeof SHIPPED)[number];

/**
 * Exact import specifiers each shipped module is allowed, value and type.
 * A new edge is a signed edit here. `../game/streak` is the one day scale
 * (calendar.ts header). `../game/prng` is the sweep's seeded generator and
 * is listed only on `careerSweep.ts`.
 */
const ALLOWED_SPECIFIERS: Readonly<Record<ShippedName, readonly string[]>> = {
  'calendar.ts': ['./careerTuning', './federation', '../game/streak'],
  'careerSweep.ts': [
    '../game/prng',
    '../game/streak',
    './calendar',
    './careerTuning',
    './eligibility',
    './federation',
  ],
  'careerTuning.ts': ['../game/streak'],
  'eligibility.ts': ['../game/streak', './calendar', './careerTuning'],
  'federation.ts': ['./careerTuning'],
};

/** Functions whose bodies may not close over a module-level or imported `let`. */
const ELIGIBILITY_FNS = [
  'meetsQualifyingTotal',
  'qualifiedTiers',
  'qualifiesFor',
  'qualifiedMeets',
  'refused',
  'entryVerdict',
  'canEnter',
  'enterableMeets',
  'careerRecordAfterMeet',
  'newCareerLifter',
] as const;

const DICE_AND_HOST: readonly { readonly name: string; readonly pattern: RegExp; readonly tripwire: string }[] =
  [
    { name: 'Date', pattern: /\bDate\b/, tripwire: 'Date.now()' },
    { name: 'performance', pattern: /\bperformance\s*\./, tripwire: 'performance.now()' },
    { name: 'Math.random', pattern: /Math\s*\.\s*random/, tripwire: 'Math.random()' },
    { name: 'gacha', pattern: /\bgacha\b/i, tripwire: 'gacha()' },
    { name: 'rarity', pattern: /\brarity\b/i, tripwire: 'const rarity = 3;' },
    { name: 'pity', pattern: /\bpity\b/i, tripwire: 'const pity = 10;' },
    { name: 'lootbox', pattern: /\blootbox\b/i, tripwire: 'lootbox(tiers)' },
    { name: 'fetch', pattern: /\bfetch\s*\(/, tripwire: 'fetch(url)' },
    { name: 'process', pattern: /\bprocess\b/, tripwire: 'process.env' },
    { name: 'window', pattern: /\bwindow\b/, tripwire: 'window.alert' },
    { name: 'document', pattern: /\bdocument\b/, tripwire: 'document.body' },
    { name: 'localStorage', pattern: /\blocalStorage\b/, tripwire: 'localStorage.getItem' },
    { name: 'react import', pattern: /from ['"]react/, tripwire: "import x from 'react';" },
  ];

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

interface ImportScan {
  readonly specifiers: readonly string[];
  readonly nonLiteral: number;
}

/**
 * Module specifiers from import, export-from, dynamic import(), and require().
 * StringLiteral and no-substitution templates both count; a computed specifier
 * is a fault rather than a skip.
 */
function namespaceImportNames(sourceText: string, fileName: string): readonly string[] {
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const names: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isImportDeclaration(node) &&
      node.importClause?.namedBindings !== undefined &&
      ts.isNamespaceImport(node.importClause.namedBindings)
    ) {
      names.push(node.importClause.namedBindings.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return names;
}

function scanImports(sourceText: string, fileName = 'mod.ts'): ImportScan {
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const specifiers: string[] = [];
  let nonLiteral = 0;

  const consider = (expr: ts.Expression | undefined): void => {
    if (expr === undefined) return;
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
      specifiers.push(expr.text);
      return;
    }
    nonLiteral += 1;
  };

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      consider(node.moduleSpecifier);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined) {
      consider(node.moduleSpecifier);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      // `import x = require('…')` / `export import x = require('…')`.
      // A CallExpression named require does not visit this node; Empire's
      // regex missed a spelling, and treating only the call would miss this
      // one.
      consider(node.moduleReference.expression);
    } else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        consider(node.arguments[0]);
      } else if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
        consider(node.arguments[0]);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { specifiers, nonLiteral };
}

function shippedOnDisk(): readonly string[] {
  return readdirSync(HERE)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .sort();
}

function readShipped(name: ShippedName): string {
  return readFileSync(path.join(HERE, name), 'utf8');
}

function compilerOptions(): ts.CompilerOptions {
  const configPath = path.join(REPO_ROOT, 'tsconfig.json');
  const config = ts.readConfigFile(configPath, ts.sys.readFile).config as unknown;
  const parsed = ts.parseJsonConfigFileContent(config, ts.sys, REPO_ROOT);
  return { ...parsed.options, noEmit: true, skipLibCheck: true };
}

function programWithOverlays(overlays: Readonly<Record<string, string>>): ts.Program {
  const options = compilerOptions();
  const host = ts.createCompilerHost(options, true);
  const normalized = new Map(
    Object.entries(overlays).map(([rel, text]) => [path.normalize(path.join(HERE, rel)), text] as const),
  );
  if (normalized.size > 0) {
    const readSource = host.getSourceFile.bind(host);
    host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) => {
      const text = normalized.get(path.normalize(fileName));
      return text !== undefined
        ? ts.createSourceFile(fileName, text, languageVersion, true, ts.ScriptKind.TS)
        : readSource(fileName, languageVersion, onError, shouldCreate);
    };
    const exists = host.fileExists.bind(host);
    host.fileExists = (fileName) => normalized.has(path.normalize(fileName)) || exists(fileName);
    const read = host.readFile.bind(host);
    host.readFile = (fileName) => normalized.get(path.normalize(fileName)) ?? read(fileName);
  }
  const roots = SHIPPED.map((name) => path.join(HERE, name));
  return ts.createProgram(roots, options, host);
}

function isInTypePosition(node: ts.Node): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current !== undefined && !ts.isSourceFile(current) && !ts.isFunctionLike(current)) {
    if (ts.isTypeNode(current) || ts.isTypeQueryNode(current) || ts.isExpressionWithTypeArguments(current)) {
      return true;
    }
    if (
      ts.isParameter(current) &&
      current.type !== undefined &&
      (node === current.type || node.parent === current.type)
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function isPropertyNameOfAccess(node: ts.Identifier): boolean {
  const parent = node.parent;
  return ts.isPropertyAccessExpression(parent) && parent.name === node;
}

function isDeclarationName(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (ts.isFunctionDeclaration(parent) && parent.name === node) return true;
  if (ts.isParameter(parent) && parent.name === node) return true;
  if (ts.isVariableDeclaration(parent) && parent.name === node) return true;
  if (ts.isBindingElement(parent) && parent.name === node) return true;
  return false;
}

function isModuleScopeDeclaration(declaration: ts.Node): boolean {
  let current: ts.Node | undefined = declaration.parent;
  while (current !== undefined) {
    if (ts.isFunctionLike(current) || ts.isClassLike(current)) return false;
    if (ts.isSourceFile(current)) return true;
    current = current.parent;
  }
  return false;
}

function isMutableVariable(declaration: ts.Declaration): boolean {
  if (!ts.isVariableDeclaration(declaration)) return false;
  const list = declaration.parent;
  if (!ts.isVariableDeclarationList(list)) return false;
  return (list.flags & ts.NodeFlags.Const) === 0;
}

function resolvedValueSymbol(checker: ts.TypeChecker, identifier: ts.Identifier): ts.Symbol | undefined {
  const symbol = checker.getSymbolAtLocation(identifier);
  if (symbol === undefined) return undefined;
  if ((symbol.flags & ts.SymbolFlags.Alias) !== 0) {
    const aliased = checker.getAliasedSymbol(symbol);
    if (aliased.flags === ts.SymbolFlags.Value && aliased.escapedName === 'unknown') return symbol;
    return aliased;
  }
  return symbol;
}

function recordIfMutable(
  found: Set<string>,
  symbol: ts.Symbol | undefined,
  label: string,
): void {
  const declaration = symbol?.valueDeclaration;
  if (
    symbol !== undefined &&
    declaration !== undefined &&
    !declaration.getSourceFile().isDeclarationFile &&
    isMutableVariable(declaration) &&
    isModuleScopeDeclaration(declaration)
  ) {
    found.add(label);
  }
}

function recordNamespaceProperty(
  found: Set<string>,
  checker: ts.TypeChecker,
  node: ts.PropertyAccessExpression,
): void {
  if (!ts.isIdentifier(node.expression) || !ts.isIdentifier(node.name)) return;
  const namespaceSymbol = resolvedValueSymbol(checker, node.expression);
  if (namespaceSymbol === undefined) return;
  if ((namespaceSymbol.flags & ts.SymbolFlags.Module) === 0) return;
  let exported: readonly ts.Symbol[];
  try {
    exported = checker.getExportsOfModule(namespaceSymbol);
  } catch {
    return;
  }
  const member = exported.find((entry) => entry.getName() === node.name.text);
  if (member === undefined) return;
  const resolved =
    (member.flags & ts.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(member) : member;
  recordIfMutable(found, resolved, `${node.expression.text}.${node.name.text}`);
}

function mutableClosedNames(sourceFile: ts.SourceFile, checker: ts.TypeChecker): readonly string[] {
  const found = new Set<string>();

  const visitFunction = (fn: ts.FunctionDeclaration): void => {
    if (fn.body === undefined) return;
    const visit = (node: ts.Node): void => {
      if (ts.isPropertyAccessExpression(node)) {
        recordNamespaceProperty(found, checker, node);
      }
      if (
        ts.isIdentifier(node) &&
        !isDeclarationName(node) &&
        !isPropertyNameOfAccess(node) &&
        !isInTypePosition(node)
      ) {
        recordIfMutable(found, resolvedValueSymbol(checker, node), node.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(fn.body);
  };

  const visit = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name !== undefined) {
      if ((ELIGIBILITY_FNS as readonly string[]).includes(node.name.text)) {
        visitFunction(node);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return [...found].sort();
}

function moduleLevelMutableNames(sourceFile: ts.SourceFile): readonly string[] {
  const found: string[] = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    if ((statement.declarationList.flags & ts.NodeFlags.Const) !== 0) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) found.push(declaration.name.text);
    }
  }
  return found.sort();
}

function plantM12(source: string): string {
  const withLet = source.replace(
    'export const CAREER_ELIGIBILITY_READS_NO_WALLET: KeysAreExactly<CareerLifter, CareerLifterKey> = true;\n',
    'export const CAREER_ELIGIBILITY_READS_NO_WALLET: KeysAreExactly<CareerLifter, CareerLifterKey> = true;\n\nexport let careerDebugWallet = 0;\n',
  );
  if (withLet === source) {
    throw new Error('M12 plant: CAREER_ELIGIBILITY_READS_NO_WALLET anchor missing');
  }
  const planted = withLet.replace(
    `export function qualifiesFor(lifter: CareerLifter, meet: CareerMeet): boolean {
  if (lifter.federationId !== meet.federationId) return false;
  return meetsQualifyingTotal(lifter.bestTotalKg, meet.qualifyingTotalKg);
}
`,
    `export function qualifiesFor(lifter: CareerLifter, meet: CareerMeet): boolean {
  if (lifter.federationId !== meet.federationId) return false;
  if (careerDebugWallet > 0) return true;
  return meetsQualifyingTotal(lifter.bestTotalKg, meet.qualifyingTotalKg);
}
`,
  );
  if (planted === withLet) {
    throw new Error('M12 plant: qualifiesFor body anchor missing');
  }
  return planted;
}

// ---------------------------------------------------------------------------
// Directory inventory
// ---------------------------------------------------------------------------

describe('the career directory is fenced as a whole, not file by file', () => {
  it('has shipped modules to scan, so the scans below are not empty', () => {
    expect(shippedOnDisk()).toEqual([...SHIPPED]);
    expect(SHIPPED.length).toBe(5);
  });

  it('ships no sibling extension the .ts filter would not open', () => {
    // M1 was a .ts file the directory claim never opened. A .tsx/.js next to
    // these five would be the same miss with a different suffix.
    const extras = readdirSync(HERE)
      .filter((name) => /\.(tsx|mts|cts|js|mjs|cjs)$/.test(name))
      .sort();
    expect(extras).toEqual([]);
  });

  it('pins allowed specifiers for every shipped module, not a subset', () => {
    expect(Object.keys(ALLOWED_SPECIFIERS).sort()).toEqual([...SHIPPED]);
    let edges = 0;
    for (const name of SHIPPED) {
      expect(ALLOWED_SPECIFIERS[name].length, `${name} has no allowed-import pin`).toBeGreaterThan(0);
      edges += ALLOWED_SPECIFIERS[name].length;
    }
    // 3 + 6 + 1 + 3 + 1. A module added without a row fails the keys pin
    // above; a row that thinned out moves this count.
    expect(edges).toBe(14);
  });
});

// ---------------------------------------------------------------------------
// Import fence — AST, every sibling, every spelling
// ---------------------------------------------------------------------------

describe('shipped career modules import only the pinned specifiers', () => {
  it('reads every shipped file and matches the pin exactly', () => {
    let files = 0;
    for (const name of SHIPPED) {
      const scan = scanImports(readShipped(name), name);
      expect(scan.nonLiteral, `${name} has a computed import specifier`).toBe(0);
      expect([...scan.specifiers].sort(), name).toEqual([...ALLOWED_SPECIFIERS[name]].sort());
      files += 1;
    }
    expect(files).toBe(SHIPPED.length);
  });

  it('ships no namespace import, so a sibling let cannot hide behind import *', () => {
    let files = 0;
    for (const name of SHIPPED) {
      expect(namespaceImportNames(readShipped(name), name), name).toEqual([]);
      files += 1;
    }
    expect(files).toBe(SHIPPED.length);
    expect(namespaceImportNames("import * as careerTuning from './careerTuning';\n", 'probe.ts')).toEqual([
      'careerTuning',
    ]);
  });

  it('names progression in no specifier, even if a pin were widened', () => {
    // The allowlist is the signed list. This is the hard ban the allowlist
    // is not allowed to override without editing this assertion too.
    let seen = 0;
    for (const name of SHIPPED) {
      for (const specifier of scanImports(readShipped(name), name).specifiers) {
        expect(specifier, `${name} imports ${specifier}`).not.toMatch(/progression/);
        expect(specifier, `${name} imports ${specifier}`).not.toMatch(/react/);
        seen += 1;
      }
    }
    expect(seen).toBe(14);
  });

  it('only the sweep may reach the generator, and it reaches it by the pinned specifier', () => {
    const sweep = scanImports(readShipped('careerSweep.ts'), 'careerSweep.ts').specifiers;
    expect(sweep).toContain('../game/prng');
    let others = 0;
    for (const name of SHIPPED) {
      if (name === 'careerSweep.ts') continue;
      expect(scanImports(readShipped(name), name).specifiers, name).not.toContain('../game/prng');
      others += 1;
    }
    expect(others).toBe(SHIPPED.length - 1);
  });

  it('the parser sees every spelling the empire regex missed, by planting them', () => {
    const probes: readonly { readonly source: string; readonly expected: string }[] = [
      { source: "import { readTotalKg } from '../game/progression';\n", expected: '../game/progression' },
      { source: 'import { readTotalKg } from "../game/progression";\n', expected: '../game/progression' },
      { source: "import '../game/progression';\n", expected: '../game/progression' },
      { source: 'import "../game/progression";\n', expected: '../game/progression' },
      { source: "import type { X } from '../game/progression';\n", expected: '../game/progression' },
      { source: "export { readTotalKg } from '../game/progression';\n", expected: '../game/progression' },
      { source: 'export * from "../game/progression";\n', expected: '../game/progression' },
      { source: "const m = import('../game/progression');\n", expected: '../game/progression' },
      { source: 'const m = import("../game/progression");\n', expected: '../game/progression' },
      { source: "const m = require('../game/progression');\n", expected: '../game/progression' },
      {
        source: "import prog = require('../game/progression');\n",
        expected: '../game/progression',
      },
      {
        source: 'import prog = require("../game/progression");\n',
        expected: '../game/progression',
      },
      {
        source: "export import prog = require('../game/progression');\n",
        expected: '../game/progression',
      },
    ];
    let live = 0;
    for (const probe of probes) {
      const scan = scanImports(probe.source);
      expect(scan.specifiers, probe.source).toContain(probe.expected);
      expect(scan.nonLiteral).toBe(0);
      live += 1;
    }
    expect(live).toBe(probes.length);
    expect(live).toBe(13);

    const computed = scanImports('const m = import(specifier);\n');
    expect(computed.specifiers).toEqual([]);
    expect(computed.nonLiteral).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Dice and host APIs
// ---------------------------------------------------------------------------

describe('shipped career modules roll no dice and touch no host API', () => {
  it('bans Math.random and the host list on every shipped file', () => {
    let checks = 0;
    for (const name of SHIPPED) {
      const code = stripComments(readShipped(name));
      expect(code.length, `${name} stripped to nothing`).toBeGreaterThan(0);
      expect(code, `${name} lost its declarations to the comment strip`).toMatch(/export /);
      for (const row of DICE_AND_HOST) {
        expect(code, `${name} must not reach ${row.name}`).not.toMatch(row.pattern);
        checks += 1;
      }
    }
    expect(checks).toBe(SHIPPED.length * DICE_AND_HOST.length);
  });

  it('each pattern is live against a tripwire, so a dead regex cannot pass', () => {
    let live = 0;
    for (const row of DICE_AND_HOST) {
      expect(row.tripwire, `pattern ${row.name} matches nothing`).toMatch(row.pattern);
      live += 1;
    }
    expect(live).toBe(DICE_AND_HOST.length);
    expect(live).toBe(13);
  });
});

// ---------------------------------------------------------------------------
// Opacity — M12
// ---------------------------------------------------------------------------

describe('eligibility functions close over no module-level or imported let', () => {
  it('the shipped eligibility.ts has no module-level let or var', () => {
    const sourceFile = ts.createSourceFile(
      ELIGIBILITY_PATH,
      readShipped('eligibility.ts'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    expect(moduleLevelMutableNames(sourceFile)).toEqual([]);
  });

  it('qualifiesFor and its siblings close over no mutable binding', () => {
    const program = programWithOverlays({});
    const sourceFile = program.getSourceFile(ELIGIBILITY_PATH);
    if (sourceFile === undefined) throw new Error('eligibility.ts is not in the program');
    const checker = program.getTypeChecker();
    expect(mutableClosedNames(sourceFile, checker)).toEqual([]);

    const names: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isFunctionDeclaration(node) && node.name !== undefined) names.push(node.name.text);
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    for (const name of ELIGIBILITY_FNS) {
      expect(names, `eligibility.ts no longer declares ${name}`).toContain(name);
    }
    expect(ELIGIBILITY_FNS.length).toBe(10);
  });

  it('reddens on the M12 plant: a module-level let that qualifiesFor reads', () => {
    const planted = plantM12(readShipped('eligibility.ts'));
    expect(planted).toContain('export let careerDebugWallet = 0');
    expect(planted).toContain('if (careerDebugWallet > 0) return true');

    const plantedFile = ts.createSourceFile(
      ELIGIBILITY_PATH,
      planted,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    expect(moduleLevelMutableNames(plantedFile)).toEqual(['careerDebugWallet']);

    const program = programWithOverlays({ 'eligibility.ts': planted });
    const sourceFile = program.getSourceFile(ELIGIBILITY_PATH);
    if (sourceFile === undefined) throw new Error('planted eligibility.ts is not in the program');
    const checker = program.getTypeChecker();
    expect(mutableClosedNames(sourceFile, checker)).toEqual(['careerDebugWallet']);
  });

  it('reddens on a sibling let read through import * as, which is the same wallet with a property access', () => {
    const eligibility = readShipped('eligibility.ts').replace(
      "import { CAREER_COPY, MEET_TIER_ORDER, type CareerFederationId, type CareerMeetTier } from './careerTuning';\n",
      "import * as careerTuning from './careerTuning';\nimport { CAREER_COPY, MEET_TIER_ORDER, type CareerFederationId, type CareerMeetTier } from './careerTuning';\n",
    );
    const plantedEligibility = eligibility.replace(
      `export function qualifiesFor(lifter: CareerLifter, meet: CareerMeet): boolean {
  if (lifter.federationId !== meet.federationId) return false;
  return meetsQualifyingTotal(lifter.bestTotalKg, meet.qualifyingTotalKg);
}
`,
      `export function qualifiesFor(lifter: CareerLifter, meet: CareerMeet): boolean {
  if (lifter.federationId !== meet.federationId) return false;
  if (careerTuning.careerDebugWallet > 0) return true;
  return meetsQualifyingTotal(lifter.bestTotalKg, meet.qualifyingTotalKg);
}
`,
    );
    expect(plantedEligibility).not.toBe(eligibility);
    expect(namespaceImportNames(plantedEligibility, 'eligibility.ts')).toEqual(['careerTuning']);

    const plantedTuning = `export let careerDebugWallet = 0;\n${readShipped('careerTuning.ts')}`;
    const program = programWithOverlays({
      'eligibility.ts': plantedEligibility,
      'careerTuning.ts': plantedTuning,
    });
    const sourceFile = program.getSourceFile(ELIGIBILITY_PATH);
    if (sourceFile === undefined) throw new Error('namespace-planted eligibility.ts is not in the program');
    const checker = program.getTypeChecker();
    expect(mutableClosedNames(sourceFile, checker)).toEqual(['careerTuning.careerDebugWallet']);
  });
});
