/**
 * THE STAGE MUST TAKE A PRESS AS A LIFT INPUT, NOT AS A BROWSER GESTURE — ON
 * EVERY SCREEN THAT HAS A STAGE ON IT, DISCOVERED RATHER THAN LISTED.
 *
 * ===========================================================================
 * WHY THIS FILE WAS REWRITTEN, WHICH IS A SHARPER FINDING THAN WHY IT EXISTED
 * ===========================================================================
 * It existed because a human playtest (GDD §12.1) found that pressing the lift
 * surface on a mobile browser handed the gesture to the browser. It was
 * rewritten because the version that guarded that fix read exactly one file —
 * `LiftScreen.tsx` — and `LiftScreen` is the REPLAY HARNESS. `AppShell.tsx`
 * mounts it behind `route.surface === 'replay'`, `shellRoute.ts` builds that
 * surface with `source: 'debug'`, and `playerReachableFrom` keeps `replay` out.
 *
 * So the fix for a defect players reported was declared on the one lift surface
 * players cannot open, the two they can — `SetView` (GDD §3.2) and `AttemptView`
 * (GDD §6.2) — carried none of the three properties, and this file was green the
 * whole time. It was not weakly green: it counted declarations, it refused a
 * second conflicting declaration, it checked the touch target and the style were
 * the same element. Every one of those assertions was true, and all of them were
 * about a screen nobody presses.
 *
 * That is CLAUDE.md's recorded class, at the widest distance it has taken here:
 * "a guard written for one hook — or one FIXTURE, or one ARM OF ONE `if` — must
 * be applied to its sibling, mechanically." A hand-written subject list is the
 * mechanism by which a guard stops covering the code. `shellWiring.test.ts` had
 * the same failure — its `onPhase` scan named two screens as literals and a
 * third arrived a wave later — and its repair is the precedent this file
 * follows: discover the subjects from the tree, apply the requirement to
 * whatever is in the set, and pin a census so an arrival is announced rather
 * than absorbed.
 *
 * ===========================================================================
 * WHAT IS DISCOVERED, AND WHY THAT IS THE RIGHT SET
 * ===========================================================================
 * A lift press surface is an element a finger presses to play a rep. In this
 * codebase that is exactly: a `Pressable` with a `<LiftStage>` inside it. So the
 * walk finds every `<LiftStage>` element in the repository, climbs its JSX
 * ancestors to the nearest `Pressable`, and requires the properties of what it
 * finds. A fourth screen that mounts a stage inherits this guard by mounting
 * one, not by somebody remembering this file.
 *
 * The walk is rooted at the REPOSITORY, not at `src/`, for the reason
 * `shellWiring.test.ts` gives at length: `App.tsx` is at the top level, and a
 * scan that starts one directory down cannot see it however many controls it
 * carries.
 *
 * ===========================================================================
 * WHAT THIS FILE CAN AND CANNOT SAY, FIRST, SO NOBODY READS IT AS MORE
 * ===========================================================================
 * `vitest.config.ts` is `environment: node`: nothing here renders. This is a
 * REACHABILITY check — the properties are declared, on the right elements, from
 * the shared module — and it says nothing about whether they reached a DOM node
 * or whether a real press behaves. `tools/verify-lift-press.mjs` is the other
 * half: it drives the played session and a played meet in a real browser, reads
 * computed style off the live elements, and counts `pointercancel` under a touch
 * pan. Neither file pretends to cover the other's half, and both say so.
 *
 * One property is invisible to both: `-webkit-touch-callout` is a WebKit
 * property Blink does not implement, so its computed value is unreadable in the
 * browser check (a NAMED SKIPPED check there) and its presence in the source is
 * all that is covered — here.
 *
 * `SUPPRESS_CONTEXT_MENU` (pressGuard.ts) exists because that gap stopped being
 * theoretical: a phone playtest found the callout returning on the far side of
 * the descent, which no property this environment can read back could confirm
 * or deny. This file covers the same half as before — that the guard is
 * declared, on the right ancestor, from the shared module — and
 * `tools/verify-lift-press.mjs` covers a half it could not before: a
 * dispatched `contextmenu` event is standard DOM, not a CSS property, so
 * whether `preventDefault` actually fires IS observable in this browser, even
 * though the native iOS callout it stands in for is not.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { PRESS_NOT_SELECT, PRESS_NOT_TAKEN, SUPPRESS_CONTEXT_MENU } from './pressGuard';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

/**
 * ===========================================================================
 * EVERYTHING THE WALK MOVES ON, IN ONE PLACE
 * ===========================================================================
 * None of these is a game-feel value — there is no timing, curve or threshold
 * here. They are the names the discovery keys on, kept together so a rename in
 * the app is one edit here rather than a scan that quietly matches nothing.
 */
const PRESS_SURFACES = Object.freeze({
  /** The component whose presence makes an element a lift press surface. */
  STAGE: 'LiftStage',
  /** The element kinds a rep can be played on. */
  PRESSABLE_TAGS: Object.freeze(['Pressable']),
  /** The module both style objects have to come from, repository-relative. */
  GUARD_MODULE: 'src/lift/pressGuard.ts',
  /** The two style-object exports, by the name the JSX spread has to bind to. */
  INHERITED: 'PRESS_NOT_SELECT',
  ON_THE_TARGET: 'PRESS_NOT_TAKEN',
  /**
   * The third export, a PROP rather than a style — spread directly onto the
   * JSX element (`{...SUPPRESS_CONTEXT_MENU}`), not into a `style={...}`
   * attribute. Placed like `PRESS_NOT_SELECT`: on an ancestor, because
   * `contextmenu` bubbles the same way `user-select` inherits, and the callout
   * it stands in for can originate from the stage or from the copy beside it.
   */
  CONTEXT_MENU: 'SUPPRESS_CONTEXT_MENU',

  /**
   * How many `<LiftStage>` press surfaces the repository has today.
   *
   * `src/lift/LiftScreen.tsx` (the replay harness, `lift-touch`),
   * `src/session/SetView.tsx` (`session-touch`) and
   * `src/meet/AttemptView.tsx` (`attempt-touch`). Pinned as an equality so a
   * fourth is announced here rather than absorbed — which is the whole failure
   * this file was rewritten for.
   */
  COUNT: 3,

  /**
   * The testIDs those surfaces carry, sorted.
   *
   * Pinned because they are the join to `tools/verify-lift-press.mjs`, which
   * names them as literals on purpose — a browser check that read its selectors
   * out of the module under test would agree with a broken module. So the two
   * files state the same three strings independently, and this equality is what
   * makes a rename on this side redden rather than silently leave the browser
   * check hunting for an element that no longer exists.
   */
  TEST_IDS: Object.freeze(['attempt-touch', 'lift-touch', 'session-touch']),

  /** Directories the repository walk does not descend into. */
  NOT_WALKED: Object.freeze([
    'node_modules',
    '.git',
    '.expo',
    'dist',
    'coverage',
    // `.claude` holds `worktrees/`, and a git worktree is a COMPLETE SECOND
    // CHECKOUT of this repository — walking into one makes this test's verdict
    // depend on what some other agent has half-finished. Same reason
    // `src/tuning/audit.test.ts` and `shellWiring.test.ts` skip it.
    '.claude',
    '.gauntlet',
  ]),
  MODULE_EXTENSIONS: Object.freeze(['.tsx', '.ts']),
});

/**
 * WHICH OF THE THREE PROPERTIES BELONGS IN WHICH OBJECT, RESTATED HERE RATHER
 * THAN IMPORTED.
 *
 * The split is a fact about CSS inheritance: `user-select` and
 * `-webkit-touch-callout` inherit, so they work from the screen root and reach
 * the copy; `touch-action` does not, so it has to sit on the element the press
 * lands in. Nothing in a node test can compute that fact — it is a property of
 * the engine, not of this repository — so it is written down and the two key
 * sets are pinned against it. Reading the expectation out of `pressGuard.ts`
 * instead would be an oracle that agrees with a broken module, which is the
 * shape CLAUDE.md records for `capture-lift.mjs`'s moment list.
 *
 * The consequence of getting it backwards is measured rather than asserted, in
 * `tools/verify-lift-press.mjs`: with the inherited pair on the stage, the same
 * press-and-drift selects nothing whatever value the fix has, because the node
 * under the finger is a Skia `<canvas>` and Blink will not start a selection
 * inside a replaced element.
 */
const PROPERTY_PLACEMENT = Object.freeze({
  /** Inherited — declared on an ancestor, reaches the text. */
  INHERITED: Object.freeze(['WebkitTouchCallout', 'userSelect']),
  /** Not inherited — declared on the pressed element itself. */
  ON_THE_TARGET: Object.freeze(['touchAction']),
  /** What every one of them is set to. */
  VALUE: 'none',
});

// ---------------------------------------------------------------------------
// Reading the tree
// ---------------------------------------------------------------------------

interface Module {
  /** Repository-relative POSIX path, for failure text. */
  readonly file: string;
  readonly ast: ts.SourceFile;
}

function parseModule(relPath: string, text: string): Module {
  return {
    file: relPath,
    ast: ts.createSourceFile(relPath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX),
  };
}

function source(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), 'utf8');
}

/** Every non-test TypeScript file in the repository, repository-relative POSIX. */
function repositorySources(): readonly string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (PRESS_SURFACES.NOT_WALKED.includes(entry)) continue;
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(full) && !/\.test\.tsx?$/.test(full)) {
        out.push(path.relative(ROOT, full).split(path.sep).join('/'));
      }
    }
  };
  walk(ROOT);
  return out.sort();
}

/** Resolves a relative import the way Metro would, or `null` if nothing is there. */
type Loader = (fromFile: string, specifier: string) => string | null;

/** Where a relative import resolves to on disk, repository-relative POSIX. */
const resolveFromDisk: Loader = (fromFile, specifier) => {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(ROOT, path.dirname(fromFile), specifier);
  const candidates = [
    ...PRESS_SURFACES.MODULE_EXTENSIONS.map((ext) => `${base}${ext}`),
    ...PRESS_SURFACES.MODULE_EXTENSIONS.map((ext) => path.join(base, `index${ext}`)),
    base,
  ];
  for (const candidate of candidates) {
    if (!existsSync(candidate) || statSync(candidate).isDirectory()) continue;
    return path.relative(ROOT, candidate).split(path.sep).join('/');
  }
  return null;
};

/** Local name -> the repository-relative module it was imported from. */
function importSources(module: Module, loader: Loader): ReadonlyMap<string, string | null> {
  const out = new Map<string, string | null>();
  for (const stmt of module.ast.statements) {
    if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    const from = stmt.moduleSpecifier.text;
    const clause = stmt.importClause;
    if (clause === undefined) continue;
    const resolved = loader(module.file, from);
    if (clause.name !== undefined) out.set(clause.name.text, resolved);
    const bound = clause.namedBindings;
    if (bound !== undefined && ts.isNamedImports(bound)) {
      for (const element of bound.elements) out.set(element.name.text, resolved);
    }
  }
  return out;
}

/**
 * Does this identifier name the guard module's export, rather than something
 * local that happens to be spelled the same?
 *
 * THE HOLE THIS CLOSES IS ONE THIS REPOSITORY HAS ALREADY PAID FOR. CLAUDE.md
 * records `progression.test.ts`'s seal check matching its callee by identifier
 * TEXT while the check twelve lines below resolved symbols — so a local shim
 * spelled `sealServerValue` typechecked clean and left 202 guard tests green.
 * A `const PRESS_NOT_TAKEN = { touchAction: 'manipulation' }` declared in a
 * screen would satisfy a text match here identically.
 *
 * The file that DECLARES the export satisfies this by being that file, which is
 * why `pressGuard.ts` itself would pass if it ever mounted a stage.
 */
function bindsToGuardModule(name: string, module: Module, loader: Loader): boolean {
  if (module.file === PRESS_SURFACES.GUARD_MODULE) return true;
  return importSources(module, loader).get(name) === PRESS_SURFACES.GUARD_MODULE;
}

// ---------------------------------------------------------------------------
// Resolving a `style={...}` attribute to the spreads inside it
// ---------------------------------------------------------------------------

/** The `StyleSheet.create({...})` object literals in a module, by variable name. */
function styleSheetsIn(module: Module): ReadonlyMap<string, ts.ObjectLiteralExpression> {
  const out = new Map<string, ts.ObjectLiteralExpression>();
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer !== undefined
    ) {
      const init = node.initializer;
      // `StyleSheet.create({...})` and a bare object literal both count: what
      // matters is that a named style can be followed to its properties.
      if (
        ts.isCallExpression(init) &&
        init.arguments.length > 0 &&
        ts.isObjectLiteralExpression(init.arguments[0] as ts.Node)
      ) {
        out.set(node.name.text, init.arguments[0] as ts.ObjectLiteralExpression);
      } else if (ts.isObjectLiteralExpression(init)) {
        out.set(node.name.text, init);
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(module.ast, visit);
  return out;
}

/**
 * Which of the two guard objects a style expression spreads.
 *
 * Handles the three shapes this codebase writes: `style={styles.stage}`,
 * `style={[styles.a, styles.b]}` (every element resolved, because a later entry
 * is as real as the first), and an inline object literal. A shape it does not
 * understand contributes nothing rather than passing — the fixtures below drive
 * that both ways.
 */
function spreadsIn(
  expression: ts.Node | undefined,
  module: Module,
  sheets: ReadonlyMap<string, ts.ObjectLiteralExpression>,
  loader: Loader,
): readonly string[] {
  if (expression === undefined) return [];
  const found = new Set<string>();

  const fromObject = (object: ts.ObjectLiteralExpression): void => {
    for (const property of object.properties) {
      if (!ts.isSpreadAssignment(property)) continue;
      const spread = property.expression;
      if (!ts.isIdentifier(spread)) continue;
      const name = spread.text;
      if (name !== PRESS_SURFACES.INHERITED && name !== PRESS_SURFACES.ON_THE_TARGET) continue;
      if (!bindsToGuardModule(name, module, loader)) continue;
      found.add(name);
    }
  };

  const fromExpression = (node: ts.Node): void => {
    const inner = ts.isJsxExpression(node) ? node.expression : node;
    if (inner === undefined) return;
    if (ts.isObjectLiteralExpression(inner)) {
      fromObject(inner);
      return;
    }
    if (ts.isArrayLiteralExpression(inner)) {
      for (const element of inner.elements) fromExpression(element);
      return;
    }
    if (ts.isPropertyAccessExpression(inner) && ts.isIdentifier(inner.expression)) {
      const sheet = sheets.get(inner.expression.text);
      if (sheet === undefined) return;
      for (const property of sheet.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const key = ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)
          ? property.name.text
          : null;
        if (key !== inner.name.text) continue;
        if (ts.isObjectLiteralExpression(property.initializer)) fromObject(property.initializer);
      }
    }
  };

  fromExpression(expression);
  return [...found].sort();
}

/** The `style` and `testID` attributes of a JSX element. */
function attributesOf(
  element: ts.JsxOpeningLikeElement,
  ast: ts.SourceFile,
): { readonly style: ts.Node | undefined; readonly testID: string | null } {
  let style: ts.Node | undefined;
  let testID: string | null = null;
  for (const attribute of element.attributes.properties) {
    if (!ts.isJsxAttribute(attribute)) continue;
    const name = attribute.name.getText(ast);
    if (name === 'style') style = attribute.initializer;
    if (name === 'testID') {
      const value = attribute.initializer;
      if (value !== undefined && ts.isStringLiteral(value)) testID = value.text;
      else if (value !== undefined && ts.isJsxExpression(value) && value.expression !== undefined) {
        testID = value.expression.getText(ast);
      }
    }
  }
  return { style, testID };
}

/**
 * Does this JSX element spread `SUPPRESS_CONTEXT_MENU` among its attributes,
 * bound to the guard module rather than to a same-named local?
 *
 * A separate walk from `spreadsIn` because the two live in different JSX
 * positions: `style={...}` spreads a STYLE OBJECT, this looks at the
 * element's own attribute list for a `{...identifier}` spread — the shape
 * `{...SUPPRESS_CONTEXT_MENU}` actually takes on the element, not inside a
 * style. `bindsToGuardModule` is reused unchanged: the identifier-vs-import
 * hole it closes for the two style objects is the same hole a same-spelled
 * local `SUPPRESS_CONTEXT_MENU` would open here.
 */
function hasContextMenuGuard(
  element: ts.JsxOpeningLikeElement,
  module: Module,
  loader: Loader,
): boolean {
  for (const attribute of element.attributes.properties) {
    if (!ts.isJsxSpreadAttribute(attribute)) continue;
    const expr = attribute.expression;
    if (!ts.isIdentifier(expr) || expr.text !== PRESS_SURFACES.CONTEXT_MENU) continue;
    if (bindsToGuardModule(expr.text, module, loader)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// The discovery
// ---------------------------------------------------------------------------

interface PressSurface {
  readonly file: string;
  /** The `Pressable` a finger lands on, or `null` if the stage is outside one. */
  readonly pressTag: string | null;
  readonly testID: string | null;
  /** Does the pressed element's own style carry the non-inheriting property? */
  readonly targetHasNotTaken: boolean;
  /** Does ANY ancestor of the stage carry the inheriting pair? */
  readonly ancestorHasNotSelect: boolean;
  /** Which ancestor did, for the failure text. */
  readonly notSelectOn: string | null;
  /** Does ANY ancestor of the stage spread the context-menu guard? */
  readonly ancestorHasContextMenuGuard: boolean;
}

/**
 * Every `<LiftStage>` in a module, with what its ancestors declare.
 *
 * The ancestor chain is what makes this a statement about CSS rather than about
 * one element: `user-select` inherits, so a `none` anywhere above the stage
 * reaches it, and requiring it on a NAMED element would be this file's old
 * mistake with a different literal in it. `touch-action` does not inherit, so
 * that half is required on the press target exactly.
 */
function pressSurfacesIn(module: Module, loader: Loader): readonly PressSurface[] {
  const sheets = styleSheetsIn(module);
  const out: PressSurface[] = [];
  const chain: ts.JsxOpeningLikeElement[] = [];

  const visit = (node: ts.Node): void => {
    const opening = ts.isJsxElement(node)
      ? node.openingElement
      : ts.isJsxSelfClosingElement(node)
        ? node
        : null;
    if (opening !== null) {
      const tag = opening.tagName.getText(module.ast);
      if (tag === PRESS_SURFACES.STAGE) {
        // The nearest enclosing pressable, and every ancestor above the stage.
        const enclosing = [...chain].reverse();
        const target = enclosing.find((element) =>
          PRESS_SURFACES.PRESSABLE_TAGS.includes(element.tagName.getText(module.ast)),
        );
        const targetAttributes =
          target === undefined ? null : attributesOf(target, module.ast);
        const withNotSelect = enclosing.find((element) =>
          spreadsIn(attributesOf(element, module.ast).style, module, sheets, loader).includes(
            PRESS_SURFACES.INHERITED,
          ),
        );
        const withContextMenuGuard = enclosing.find((element) =>
          hasContextMenuGuard(element, module, loader),
        );
        out.push({
          file: module.file,
          pressTag: target === undefined ? null : target.tagName.getText(module.ast),
          testID: targetAttributes === null ? null : targetAttributes.testID,
          targetHasNotTaken:
            targetAttributes !== null &&
            spreadsIn(targetAttributes.style, module, sheets, loader).includes(
              PRESS_SURFACES.ON_THE_TARGET,
            ),
          ancestorHasNotSelect: withNotSelect !== undefined,
          notSelectOn:
            withNotSelect === undefined ? null : withNotSelect.tagName.getText(module.ast),
          ancestorHasContextMenuGuard: withContextMenuGuard !== undefined,
        });
      }
      chain.push(opening);
      ts.forEachChild(node, visit);
      chain.pop();
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(module.ast);
  return out;
}

/** Every lift press surface in the repository, walked rather than listed. */
function repositoryPressSurfaces(): readonly PressSurface[] {
  return repositorySources().flatMap((file) =>
    pressSurfacesIn(parseModule(file, source(file)), resolveFromDisk),
  );
}

// ---------------------------------------------------------------------------
// The fixtures the detectors are driven against
// ---------------------------------------------------------------------------

/**
 * A loader with the real guard module's path on it, so the import-binding check
 * can be exercised without inventing files in the tree. Anything else resolves
 * to a different module, which is what makes the negative fixtures negative.
 */
const fixtureLoader: Loader = (_from, specifier) =>
  specifier.endsWith('pressGuard') ? PRESS_SURFACES.GUARD_MODULE : `src/somewhere/${specifier}.ts`;

const surfacesFor = (text: string): readonly PressSurface[] =>
  pressSurfacesIn(parseModule('src/fixture/Fixture.tsx', text), fixtureLoader);

const GOOD = `
  import { PRESS_NOT_SELECT, PRESS_NOT_TAKEN, SUPPRESS_CONTEXT_MENU } from '../lift/pressGuard';
  export function Fixture() {
    return (
      <View style={styles.root} testID="fixture" {...SUPPRESS_CONTEXT_MENU}>
        <Text style={styles.prompt}>x</Text>
        <Pressable style={styles.stage} testID="fixture-touch">
          <LiftStage state={s} />
        </Pressable>
      </View>
    );
  }
  const styles = StyleSheet.create({
    root: { flex: 1, ...PRESS_NOT_SELECT },
    prompt: { fontSize: 1 },
    stage: { width: 1, ...PRESS_NOT_TAKEN },
  });
`;

describe('the discovery sees a press surface, and sees each half go missing', () => {
  it('CONTROL: reads the good shape as good', () => {
    const [surface, ...rest] = surfacesFor(GOOD);
    expect(rest).toEqual([]);
    expect(surface?.pressTag).toBe('Pressable');
    expect(surface?.testID).toBe('fixture-touch');
    expect([surface?.targetHasNotTaken, surface?.ancestorHasNotSelect]).toEqual([true, true]);
    expect(surface?.notSelectOn).toBe('View');
    expect(surface?.ancestorHasContextMenuGuard).toBe(true);
  });

  it('CONTROL: the context-menu guard going missing, and a same-spelled local shadowing it', () => {
    // Gone entirely — the shape the shipped fix was in before this playtest.
    const noContextMenuGuard = surfacesFor(GOOD.replace(' {...SUPPRESS_CONTEXT_MENU}', ''));
    expect(noContextMenuGuard[0]?.ancestorHasContextMenuGuard).toBe(false);
    // Present as a spread, but a local constant spelled the same rather than an
    // import from the guard module — the same identifier-text hole the other
    // two objects are guarded against.
    const shadowedContextMenuGuard = surfacesFor(
      GOOD.replace(
        "import { PRESS_NOT_SELECT, PRESS_NOT_TAKEN, SUPPRESS_CONTEXT_MENU } from '../lift/pressGuard';",
        "import { PRESS_NOT_SELECT, PRESS_NOT_TAKEN } from '../lift/pressGuard';\n  const SUPPRESS_CONTEXT_MENU = { onContextMenu: () => {} };",
      ),
    );
    expect(shadowedContextMenuGuard[0]?.ancestorHasContextMenuGuard).toBe(false);
    // Imported, but from somewhere that is not the guard module.
    const wrongModuleContextMenuGuard = surfacesFor(
      GOOD.replace('../lift/pressGuard', '../lift/otherGuard'),
    );
    expect(wrongModuleContextMenuGuard[0]?.ancestorHasContextMenuGuard).toBe(false);
  });

  it('CONTROL: the four ways the fix goes missing are each seen', () => {
    // 1. THE MUTATION THAT SHIPPED. The spread is gone from the pressed style,
    //    and the screen still renders, still typechecks, still plays a rep.
    const noTouchAction = surfacesFor(GOOD.replace(', ...PRESS_NOT_TAKEN', ''));
    expect([noTouchAction[0]?.targetHasNotTaken, noTouchAction[0]?.ancestorHasNotSelect]).toEqual([
      false,
      true,
    ]);

    // 2. The inherited pair gone from the root.
    const noUserSelect = surfacesFor(GOOD.replace(', ...PRESS_NOT_SELECT', ''));
    expect([noUserSelect[0]?.targetHasNotTaken, noUserSelect[0]?.ancestorHasNotSelect]).toEqual([
      true,
      false,
    ]);

    // 3. THE TWO SWAPPED, which is the placement error this file's split exists
    //    to make visible. Both objects are present, both are imported from the
    //    real module, and each is on the element the other belongs on.
    const swapped = surfacesFor(
      GOOD.replace('flex: 1, ...PRESS_NOT_SELECT', 'flex: 1, ...PRESS_NOT_TAKEN').replace(
        'width: 1, ...PRESS_NOT_TAKEN',
        'width: 1, ...PRESS_NOT_SELECT',
      ),
    );
    expect([swapped[0]?.targetHasNotTaken, swapped[0]?.ancestorHasNotSelect]).toEqual([
      false,
      // The inherited pair on the STAGE still reaches the stage's own subtree,
      // and the stage is an ancestor of nothing but a canvas. It reads as
      // present because the stage is in its own ancestor chain — so this arm is
      // caught by `targetHasNotTaken` alone, and that is stated rather than
      // implied.
      true,
    ]);

    // 4. A LOCAL CONSTANT SPELLED THE SAME. Typechecks, renders, and is the
    //    identifier-text hole CLAUDE.md records from `progression.test.ts`.
    const shadowed = surfacesFor(
      GOOD.replace(
        "import { PRESS_NOT_SELECT, PRESS_NOT_TAKEN, SUPPRESS_CONTEXT_MENU } from '../lift/pressGuard';",
        'import { SUPPRESS_CONTEXT_MENU } from \'../lift/pressGuard\';\n' +
          '  const PRESS_NOT_SELECT = { userSelect: "none" };\n  const PRESS_NOT_TAKEN = { touchAction: "manipulation" };',
      ),
    );
    expect([shadowed[0]?.targetHasNotTaken, shadowed[0]?.ancestorHasNotSelect]).toEqual([
      false,
      false,
    ]);

    // 5. Imported from somewhere that is not the guard module.
    const wrongModule = surfacesFor(GOOD.replace('../lift/pressGuard', '../lift/otherGuard'));
    expect([wrongModule[0]?.targetHasNotTaken, wrongModule[0]?.ancestorHasNotSelect]).toEqual([
      false,
      false,
    ]);
  });

  it('CONTROL: the shapes a legitimate restructure produces still resolve', () => {
    // An array style, which this codebase writes for conditional styling — and
    // the guard entry is the SECOND element, so a resolver that read only the
    // first would pass the good case and fail this one.
    const arrayStyle = surfacesFor(
      GOOD.replace('style={styles.stage}', 'style={[styles.pad, styles.stage]}'),
    );
    expect(arrayStyle[0]?.targetHasNotTaken).toBe(true);

    // An inline object rather than a sheet entry.
    const inline = surfacesFor(
      GOOD.replace('style={styles.stage}', 'style={{ width: 1, ...PRESS_NOT_TAKEN }}'),
    );
    expect(inline[0]?.targetHasNotTaken).toBe(true);

    // The inherited pair three elements up rather than on the immediate parent,
    // which is what "it inherits" means and what a screen with more chrome on it
    // would look like.
    const distant = surfacesFor(`
      import { PRESS_NOT_SELECT, PRESS_NOT_TAKEN } from '../lift/pressGuard';
      export function F() {
        return (
          <View style={styles.root}>
            <View style={styles.middle}>
              <View style={styles.inner}>
                <Pressable style={styles.stage} testID="fixture-touch">
                  <LiftStage state={s} />
                </Pressable>
              </View>
            </View>
          </View>
        );
      }
      const styles = StyleSheet.create({
        root: { flex: 1, ...PRESS_NOT_SELECT },
        middle: { flex: 1 },
        inner: { flex: 1 },
        stage: { width: 1, ...PRESS_NOT_TAKEN },
      });
    `);
    expect(distant.length).toBe(1);
    expect(distant[0]?.ancestorHasNotSelect).toBe(true);
    expect(distant[0]?.notSelectOn).toBe('View');
  });

  it('CONTROL: what is NOT a press surface produces nothing', () => {
    // No stage: a screen full of Pressables that never plays a rep.
    expect(
      surfacesFor(`export function F() { return <Pressable style={styles.a}><Text>x</Text></Pressable>; }`),
    ).toEqual([]);
    // A stage outside any Pressable — reported with a null target rather than
    // skipped, because a stage nobody can press is its own finding.
    const orphan = surfacesFor(`export function F() { return <View><LiftStage state={s} /></View>; }`);
    expect(orphan.length).toBe(1);
    expect(orphan[0]?.pressTag).toBeNull();
    expect(orphan[0]?.targetHasNotTaken).toBe(false);
    // A SIBLING carrying the fix is not an ancestor carrying it, which is the
    // difference between `user-select` reaching the stage and not.
    const sibling = surfacesFor(`
      import { PRESS_NOT_SELECT, PRESS_NOT_TAKEN } from '../lift/pressGuard';
      export function F() {
        return (
          <View>
            <View style={styles.other} />
            <Pressable style={styles.stage}><LiftStage state={s} /></Pressable>
          </View>
        );
      }
      const styles = StyleSheet.create({ other: { ...PRESS_NOT_SELECT }, stage: { ...PRESS_NOT_TAKEN } });
    `);
    expect(sibling[0]?.ancestorHasNotSelect).toBe(false);
  });

  it('CONTROL: the walk covers the whole repository, not just src/', () => {
    // The lesson `shellWiring.test.ts` records: a scan rooted at `src/` cannot
    // see `App.tsx`, and every non-vacuity control inside it passes because they
    // all ask about files the scan already had.
    const walked = repositorySources();
    for (const anchor of ['App.tsx', 'index.ts']) {
      expect(walked, `${anchor} is outside src/ and the walk must still see it`).toContain(anchor);
    }
    expect(walked).toContain(PRESS_SURFACES.GUARD_MODULE);
    expect(walked).toContain('src/session/SetView.tsx');
    // Tests are excluded, so a fixture in a test file cannot satisfy the census.
    expect(walked.filter((file) => file.endsWith('.test.ts'))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The requirement, applied to whatever the walk found
// ---------------------------------------------------------------------------

describe('every lift press surface in the repository carries the press guard', () => {
  it('the census: how many surfaces there are, and what they are called', () => {
    const surfaces = repositoryPressSurfaces();
    const files = [...new Set(surfaces.map((surface) => surface.file))].sort();
    expect(
      surfaces.length,
      `the repository has ${surfaces.length} <${PRESS_SURFACES.STAGE}> press surface(s): ${files.join(', ')}.` +
        ' A new one is not a defect — but it has to be looked at, and this number is where it gets looked at.',
    ).toBe(PRESS_SURFACES.COUNT);
    // ...and the walk really reached outside `src/lift/`, which is where the old
    // version of this file could not see.
    expect(files).toContain('src/session/SetView.tsx');
    expect(files).toContain('src/meet/AttemptView.tsx');
    expect(files).toContain('src/lift/LiftScreen.tsx');

    // The join to the browser check. Both files state these three strings, and
    // neither reads them from the other.
    expect([...surfaces.map((surface) => surface.testID)].sort()).toEqual([
      ...PRESS_SURFACES.TEST_IDS,
    ]);
  });

  it('every stage sits inside something a finger can press', () => {
    const orphans = repositoryPressSurfaces()
      .filter((surface) => surface.pressTag === null)
      .map(
        (surface) =>
          `${surface.file} mounts <${PRESS_SURFACES.STAGE}> outside any of ${PRESS_SURFACES.PRESSABLE_TAGS.join('/')},` +
          ' so nothing below is a statement about the element a rep is played on',
      );
    expect(orphans, orphans.join('\n')).toEqual([]);
  });

  it('the pressed element declares the property that does NOT inherit [press-guard-on-every-played-surface]', () => {
    // THE ASSERTION THE SHIPPED DEFECT REDDENS. `SetView` and `AttemptView` both
    // computed `touch-action: manipulation` — React Native Web's `Pressable`
    // default, which is what an element has when nobody adds anything — and 20px
    // of finger drift during a press-and-hold produced one `pointercancel` on
    // each. Nothing here names a screen: the list comes off the tree.
    const bare = repositoryPressSurfaces()
      .filter((surface) => !surface.targetHasNotTaken)
      .map(
        (surface) =>
          `${surface.file} presses <${PRESS_SURFACES.STAGE}> through a <${surface.pressTag}> ` +
          `(testID ${JSON.stringify(surface.testID)}) whose style does not spread ${PRESS_SURFACES.ON_THE_TARGET} ` +
          `from ${PRESS_SURFACES.GUARD_MODULE}. touch-action does not inherit, so no ancestor can supply it: ` +
          'the browser will claim a drifting press and the app will not hear the rest of the gesture',
      );
    expect(bare, bare.join('\n')).toEqual([]);
  });

  it('an ancestor of every stage declares the two that DO inherit', () => {
    const bare = repositoryPressSurfaces()
      .filter((surface) => !surface.ancestorHasNotSelect)
      .map(
        (surface) =>
          `${surface.file} mounts <${PRESS_SURFACES.STAGE}> with no ancestor spreading ` +
          `${PRESS_SURFACES.INHERITED} from ${PRESS_SURFACES.GUARD_MODULE}, so the copy around the stage ` +
          'is selectable and iOS’s press-and-hold callout is unguarded',
      );
    expect(bare, bare.join('\n')).toEqual([]);
  });

  it(
    'an ancestor of every stage spreads the context-menu guard [context-menu-guard-on-every-played-surface]',
    () => {
      // THE PLAYTEST FINDING THIS ROW EXISTS FOR. The callout came back on the
      // far side of the descent, on a property Blink cannot even store in a
      // parsed rule — see pressGuard.ts's header. This is the JS-level second
      // layer, and its placement follows PRESS_NOT_SELECT exactly: an ancestor,
      // because `contextmenu` bubbles the way `user-select` inherits.
      const bare = repositoryPressSurfaces()
        .filter((surface) => !surface.ancestorHasContextMenuGuard)
        .map(
          (surface) =>
            `${surface.file} mounts <${PRESS_SURFACES.STAGE}> with no ancestor spreading ` +
            `${PRESS_SURFACES.CONTEXT_MENU} from ${PRESS_SURFACES.GUARD_MODULE}, so a sustained touch on ` +
            'the stage or the copy beside it has no JS-level fallback if the CSS property does not apply',
        );
      expect(bare, bare.join('\n')).toEqual([]);
    },
  );

  it('NON-VACUITY: the three checks above walked a real list, and the count is exact', () => {
    // All three filters are empty when the domain is empty, which is precisely
    // how a discovery that stopped working would look. Counts, not bounds.
    const surfaces = repositoryPressSurfaces();
    expect(
      surfaces.filter((surface) => surface.targetHasNotTaken).length,
      'no press surface carries the non-inheriting property at all, so the check above walked an empty list',
    ).toBe(PRESS_SURFACES.COUNT);
    expect(
      surfaces.filter((surface) => surface.ancestorHasNotSelect).length,
      'no press surface has an ancestor carrying the inheriting pair, so the check above walked an empty list',
    ).toBe(PRESS_SURFACES.COUNT);
    expect(
      surfaces.filter((surface) => surface.ancestorHasContextMenuGuard).length,
      'no press surface has an ancestor spreading the context-menu guard, so the check above walked an empty list',
    ).toBe(PRESS_SURFACES.COUNT);
  });
});

// ---------------------------------------------------------------------------
// The two objects themselves
// ---------------------------------------------------------------------------

describe('the guard module holds exactly the three properties, split by inheritance', () => {
  it('each object holds the keys its placement requires, and no others', () => {
    expect(Object.keys(PRESS_NOT_SELECT).sort()).toEqual([...PROPERTY_PLACEMENT.INHERITED]);
    expect(Object.keys(PRESS_NOT_TAKEN).sort()).toEqual([...PROPERTY_PLACEMENT.ON_THE_TARGET]);
  });

  it('the two are disjoint, so no property is declared in both places', () => {
    const both = Object.keys(PRESS_NOT_SELECT).filter((key) =>
      Object.keys(PRESS_NOT_TAKEN).includes(key),
    );
    expect(both, `${both.join(', ')} is in both objects, so its placement is ambiguous`).toEqual([]);
    // ...and together they are still the three the playtest fix was made of, so
    // a property cannot be dropped by moving it out of one object.
    expect([...Object.keys(PRESS_NOT_SELECT), ...Object.keys(PRESS_NOT_TAKEN)].sort()).toEqual(
      [...PROPERTY_PLACEMENT.INHERITED, ...PROPERTY_PLACEMENT.ON_THE_TARGET].sort(),
    );
  });

  it('every one of them is off, not merely present', () => {
    const values = [...Object.values(PRESS_NOT_SELECT), ...Object.values(PRESS_NOT_TAKEN)];
    expect(values.length).toBe(
      PROPERTY_PLACEMENT.INHERITED.length + PROPERTY_PLACEMENT.ON_THE_TARGET.length,
    );
    for (const value of values) expect(value).toBe(PROPERTY_PLACEMENT.VALUE);
  });

  it('the module says what it deliberately leaves out, so the omission is a decision', () => {
    // `-webkit-tap-highlight-color` is the other property "the surface
    // highlighted" could mean, and it is absent because it is already
    // transparent on every element from the stage up to BODY. Asserted so
    // deleting the reasoning reddens rather than quietly removing the note.
    const guard = source(PRESS_SURFACES.GUARD_MODULE);
    expect(guard).toContain('-webkit-tap-highlight-color');
    expect(guard).toContain('rgba(0, 0, 0, 0)');
    // And the limit this file cannot cover, for the same reason.
    expect(guard).toContain('NAMED SKIPPED check');
  });
});

describe('the context-menu guard is exactly a preventDefault handler', () => {
  it('holds exactly one key, and it is the DOM prop name', () => {
    expect(Object.keys(SUPPRESS_CONTEXT_MENU)).toEqual(['onContextMenu']);
  });

  it('calling it calls preventDefault on what it is given, once', () => {
    let calls = 0;
    SUPPRESS_CONTEXT_MENU.onContextMenu({
      preventDefault: () => {
        calls += 1;
      },
    });
    expect(calls).toBe(1);
  });

  it('the module says why this is a prop and not a style, so the JSX shape is a decision', () => {
    const guard = source(PRESS_SURFACES.GUARD_MODULE);
    expect(guard).toContain('excess-property check');
    expect(guard).toContain('forwardedProps');
  });
});
