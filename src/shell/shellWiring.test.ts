/**
 * shellWiring.test.ts — the check that the ROUTE IS ACTUALLY WIRED UP, and that
 * nothing else got wired up with it.
 *
 * ---------------------------------------------------------------------------
 * WHY A SOURCE SCAN, AND WHAT IT IS AND IS NOT WORTH
 * ---------------------------------------------------------------------------
 * `shellRoute.test.ts` proves the graph says a player can reach meet day. That
 * is necessary and it is not sufficient: a perfect route module nothing calls is
 * exactly the shape of the defect this piece was built to fix — `MeetScreen`
 * was correct, tested, and unreachable. So this file reads the real sources and
 * fails on the shapes that would leave the graph unused.
 *
 * It is WEAKER THAN RENDERING and does not pretend otherwise. This project has
 * no DOM test runner (`vitest.config.ts` is `environment: node`), and a sibling
 * piece in this run proved that a frozen component clock leaves the whole suite
 * green. What actually renders is checked by `tools/verify-shell-route.mjs`,
 * which drives the built app in a browser, PRESSES the control with a mouse and
 * reads the DOM — the same arrangement `verify-session-boundary.mjs` uses.
 *
 * Every scan below is paired with a positive control, because a scan that has
 * stopped matching passes every file.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { appMeetPort, appSessionPort, withSportingCreditOnRecord } from './appServer';
import { meetDayFactsFromCache } from '../game/meetClient';
import { meetResultProposal } from '../game/meetDay';
import { playMeet } from '../game/meetPreview';
import { MEET_ENTRY, MEET_LOCAL } from '../game/meetTuning';
import { openingCache } from '../game/sessionClient';
import { SESSION_BOUNDARY, SESSION_TUNING } from '../game/sessionTuning';
import { asProposalId, readTotalKg, readingValue } from '../game/progression';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

function source(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), 'utf8');
}

/** Strips comments and string literals, so only real code is scanned. */
function codeOnly(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``');
}

const APP = codeOnly(source('App.tsx'));
const SHELL = codeOnly(source('src/shell/AppShell.tsx'));
const SESSION_SCREEN = codeOnly(source('src/session/SessionScreen.tsx'));
const MEET_SCREEN = codeOnly(source('src/meet/MeetScreen.tsx'));
const APP_SERVER = codeOnly(source('src/shell/appServer.ts'));

describe('the scans can see what they are looking for', () => {
  it('strips comments and keeps code', () => {
    expect(codeOnly('// navigate(route)\nconst a = 1;')).not.toMatch(/navigate/);
    expect(codeOnly('const b = navigate(route, x);')).toMatch(/navigate/);
  });

  it('the files it reads are the real ones', () => {
    for (const [name, text] of [
      ['App.tsx', APP],
      ['AppShell.tsx', SHELL],
      ['SessionScreen.tsx', SESSION_SCREEN],
      ['MeetScreen.tsx', MEET_SCREEN],
    ] as const) {
      expect(text.length, name).toBeGreaterThan(400);
    }
    // `appServer.ts` is mostly the argument for why it exists, so its code is
    // short by design. Bounded anyway, so an emptied file fails loudly.
    expect(APP_SERVER.length).toBeGreaterThan(150);
  });
});

// ---------------------------------------------------------------------------
// THE JOIN
// ---------------------------------------------------------------------------

describe('the shell is the join, and it is the only one', () => {
  it('renders both surfaces — the two halves of the loop are in one file', () => {
    expect(SHELL).toMatch(/\bSessionScreen\b/);
    expect(SHELL).toMatch(/\bMeetScreen\b/);
    expect(SHELL).toMatch(/from ''/); // imports survived the stripper
    expect(source('src/shell/AppShell.tsx')).toMatch(/from '\.\.\/meet\/MeetScreen'/);
    expect(source('src/shell/AppShell.tsx')).toMatch(/from '\.\.\/session\/SessionScreen'/);
  });

  it('the two screens still know nothing about each other', () => {
    // The point of routing in the shell. If the daily loop had to import meet
    // day to offer a way into it, every future surface would have to import
    // every other one.
    for (const file of ['SessionScreen.tsx', 'useSession.ts', 'CloseOutView.tsx']) {
      expect(source(`src/session/${file}`), file).not.toMatch(/from '\.\.\/meet\//);
    }
    for (const file of ['MeetScreen.tsx', 'useMeetDay.ts', 'RecapView.tsx']) {
      expect(source(`src/meet/${file}`), file).not.toMatch(/from '\.\.\/session\//);
    }
  });

  it('drives the route through `navigate`, rather than setting a surface by hand', () => {
    // A `setRoute({ surface: 'meet' })` here would work and would make
    // `shellRoute.test.ts`'s whole graph decorative.
    expect(SHELL).toMatch(/navigate\(current, ''\)/);
    expect(SHELL).toMatch(/\bopen-meet\b|''/);
    expect(source('src/shell/AppShell.tsx')).toMatch(/navigate\(current, 'open-meet'\)/);
    expect(source('src/shell/AppShell.tsx')).toMatch(/navigate\(current, 'leave-meet'\)/);
    expect(SHELL).not.toMatch(/setRoute\(\{/);
  });

  it('forgets the destination’s beat on the way in, so no stale control flashes', () => {
    // The screen being routed to reports its beat in an effect, a commit later.
    // Without these, a meet opened after a previous one ended shows the recap's
    // "way back" over its weigh-in for a frame.
    //
    // The cut-in flag is cleared in the same two places and for the same
    // reason — the host on the surface being left un-mounts — so the pattern
    // now allows anything BETWEEN the phase reset and the navigate, and the
    // test above pins that what is in there is `setCutInLive(false)`.
    expect(SHELL).toMatch(
      /setMeetPhase\(null\);[\s\S]{0,80}?setRoute\(\(current\) => navigate\(current, ''\)\)/,
    );
    expect(SHELL).toMatch(
      /setSessionPhase\(null\);[\s\S]{0,80}?setRoute\(\(current\) => navigate\(current, ''\)\)/,
    );
    // ...and the reset still has to be there: a `setRoute` with no phase reset
    // before it does not match, which is the failure this exists for.
    expect(codeOnly('setRoute((current) => navigate(current, "open-meet"));')).not.toMatch(
      /setMeetPhase\(null\);[\s\S]{0,80}?setRoute\(\(current\) => navigate\(current, ''\)\)/,
    );
  });

  it('the screens actually REPORT their beat, rather than only accepting the prop', () => {
    // Added after this exact deletion was mutated in and the whole node suite —
    // all 2183 tests — stayed green. `tools/verify-shell-route.mjs` caught it
    // and named eleven broken checks; nothing here could see it, because
    // accepting a callback and never calling it is invisible to a type and to
    // every pure test. This scan closes the cheap half.
    //
    // IT DOES NOT CLOSE THE CLASS — AND NEITHER DOES "THE BROWSER" BY ITSELF.
    // This comment used to say: "a control that mounts and stays at zero
    // opacity would pass this and fail the browser, which is why the browser
    // check is the decisive one." THAT WAS FALSE, and expensively so.
    // Playwright's `isVisible()` means "has a non-empty box and is not
    // `visibility: hidden`" — it returns TRUE at `opacity: 0` — and
    // `document.elementFromPoint`, which the tool's `hitTest` and Playwright's
    // own click actionability both rest on, hits a fully transparent element
    // too. An opacity-zero control sails through a naive browser check exactly
    // as happily as it sails through this scan.
    //
    // The proof is in this run's own evidence. With a fixed 2600 ms settle,
    // `.gauntlet/shots/shell/09-bombed-keeps-its-own-exit.png` photographed a
    // screen with NO EXIT ANYWHERE ON IT, while `route.json` recorded
    // "ok    the bomb-out beat keeps its own way out" — because `BombOutView`'s
    // action row is not drawn until 4220 ms. The app was correct. The check was
    // not.
    //
    // So the browser check is decisive only because it was made to MEASURE
    // OPACITY and to wait for the fade each screen actually plays — `onScreen`,
    // `waitUntilDrawn` and `BOMB_OUT_SETTLE_MS` in
    // `tools/verify-shell-route.mjs`. Rendering does not verify itself; the
    // timing has to be right, and it has to be derived from the constant the
    // screen animates on rather than from one global settle.
    expect(SESSION_SCREEN).toMatch(/onPhase\?\.\(state\.phase\)/);
    expect(MEET_SCREEN).toMatch(/onPhase\?\.\(state\.phase\)/);
  });

  it('asks `shellAffordanceFor` when to draw a control, and draws only that', () => {
    expect(SHELL).toMatch(/shellAffordanceFor\(/);
    // The gate must be the thing that decides, so the pill cannot be rendered
    // unconditionally next to it.
    expect(SHELL).toMatch(/affordance === null \? null :/);
  });

  it('CROSSING 6: renders Gym Empire, drives it through `navigate`, and gates its second pill separately', () => {
    expect(SHELL).toMatch(/\bGymScreen\b/);
    expect(SHELL).toMatch(/\bGymHost\b/);
    expect(source('src/shell/AppShell.tsx')).toMatch(/from '\.\.\/empire\/GymScreen'/);
    expect(source('src/shell/AppShell.tsx')).toMatch(/from '\.\.\/empire\/ladderView'/);
    // Driven through the same route function as the meet pair, not a
    // hand-set surface.
    expect(source('src/shell/AppShell.tsx')).toMatch(/navigate\(current, 'open-gym'\)/);
    expect(source('src/shell/AppShell.tsx')).toMatch(/navigate\(current, 'leave-gym'\)/);
    // The second pill is gated by its OWN function, not folded into the call
    // above — `gymAffordanceFor\(` matching is what proves it is a second
    // gate rather than a second literal reading the first one's result.
    expect(SHELL).toMatch(/gymAffordanceFor\(/);
    expect(SHELL).toMatch(/gymAffordance === null \? null :/);
    // `useReducer` is the ONE stateful hook Gym Empire needs, and it lives
    // here — outside `src/empire/` — not inside the pure `GymScreen`.
    expect(SHELL).toMatch(/useReducer\(/);
    expect(source('src/shell/AppShell.tsx')).toMatch(
      /useReducer\(gymViewReduce, undefined, createGymViewState\)/,
    );
  });

  it('CROSSING 6: no `?gym=` debug route exists — reachability is by press only', () => {
    // The one thing this piece's own brief forbids as a verification
    // shortcut. `shellRoute.ts` has one debug entry per OTHER surface
    // (`?meet=`, `?session=`, `?replay=`) and deliberately none for gym — see
    // that file's own `ShellSurface` doc comment.
    //
    // RAW SOURCE, NOT `codeOnly` — a debug route is a STRING LITERAL
    // (`'?gym='` or similar), and `codeOnly` blanks every string to `''`
    // before this file's other checks read it, which would make a check
    // aimed at a string literal vacuously pass whether or not one existed.
    // Comments are excluded by hand instead of by the stripper, which is why
    // the prose describing this absence, two files over, is careful not to
    // spell the four characters this looks for.
    const rawShellRoute = source('src/shell/shellRoute.ts').replace(/\/\*[\s\S]*?\*\//g, ' ');
    const rawShell = source('src/shell/AppShell.tsx').replace(/\/\*[\s\S]*?\*\//g, ' ');
    const rawApp = source('App.tsx').replace(/\/\*[\s\S]*?\*\//g, ' ');
    expect(rawShellRoute).not.toMatch(/gym=/);
    expect(rawShell).not.toMatch(/gym=/);
    expect(rawApp).not.toMatch(/gym=/);
    // The scan can see the shape it would be looking for.
    expect("const q = '?gym=x';").toMatch(/gym=/);
  });

  it('tells the gate whether a GDD §7.2 cut-in is up, and is told by the hosts', () => {
    // THE HALF NO PURE TEST CAN SEE. `shellRoute.test.ts` pins that a live
    // cut-in takes the chrome off every beat; that is worth nothing if the
    // shell never passes the argument, which is exactly the shape of the
    // `onPhase` defect this file already carries a scan for.
    //
    // The chain, in three links, all pinned here:
    //   the shell holds the flag and feeds it to the gate...
    expect(SHELL).toMatch(/cutInLive \? '' : ''/);
    expect(source('src/shell/AppShell.tsx')).toMatch(/cutInLive \? 'live' : 'none'/);
    //   ...it hands `setCutInLive` to BOTH surfaces...
    expect(source('src/shell/AppShell.tsx').match(/onCutIn=\{setCutInLive\}/g)?.length).toBe(2);
    //   ...and each surface forwards it to the host that owns the answer.
    expect(SESSION_SCREEN).toMatch(/onLive=\{onCutIn\}/);
    expect(MEET_SCREEN).toMatch(/onLive=\{onCutIn\}/);
    // The host really reports it, rather than accepting the prop and dropping
    // it — the same failure `onPhase` had, and invisible to a type.
    const HOST = codeOnly(source('src/cutin/CutInHost.tsx'));
    expect(HOST).toMatch(/onLive\?\.\(live !== null\)/);
    expect(HOST).toMatch(/onLive\?\.\(false\)/);
    // And the flag is cleared on the way between surfaces, like the phases, so
    // a host that un-mounted mid-cut-in cannot leave the next screen bare.
    // 2 -> 4: CROSSING 6's `openGym` / `leaveGym` clear it too, for the same
    // reason `openMeet` / `leaveMeet` do — see their own comment in
    // AppShell.tsx. Measured by running this exact assertion, not guessed.
    expect(source('src/shell/AppShell.tsx').match(/setCutInLive\(false\)/g)?.length).toBe(4);
    // The scans can see what they are looking for, and can see it change.
    expect(codeOnly("const a = x ? 'live' : 'none';")).toMatch(/x \? '' : ''/);
    expect(codeOnly('onLive?.(true);')).not.toMatch(/onLive\?\.\(live !== null\)/);
  });

  it('the `?cutin=` debug route is resolved from the shell, not from `window`', () => {
    // `CutInHost` used to read `window.location.search` itself — disclosed at
    // the time, because `src/shell/**` belonged to another builder in the wave
    // that added the route. `App.tsx` is the platform edge; the string now
    // comes down as a prop and the host's own read survives only as the default
    // for a standalone render.
    expect(source('src/shell/AppShell.tsx').match(/cutInSearch=\{search\}/g)?.length).toBe(2);
    expect(SESSION_SCREEN).toMatch(/search=\{cutInSearch\}/);
    expect(MEET_SCREEN).toMatch(/search=\{cutInSearch\}/);
    // And no screen between the edge and the host reads `window` for itself.
    for (const relPath of ['src/session/SessionScreen.tsx', 'src/meet/MeetScreen.tsx']) {
      expect(codeOnly(source(relPath)), relPath).not.toMatch(/window\.location/);
    }
    expect(codeOnly('const s = window.location.search;')).toMatch(/window\.location/);
  });

  it('gives the meet its way out — GDD §6.5 ends somewhere', () => {
    expect(SHELL).toMatch(/onLeave=\{leaveMeet\}/);
    expect(MEET_SCREEN).toMatch(/\bonLeave\b/);
  });

  it('the way out is a route, not a page reload', () => {
    // What it used to be: `window.location.search = ''` in App.tsx. Web-only,
    // a full reload, and a silent no-op on the phone this game ships on.
    for (const [name, text] of [
      ['App.tsx', APP],
      ['AppShell.tsx', SHELL],
      ['MeetScreen.tsx', MEET_SCREEN],
    ] as const) {
      expect(text, name).not.toMatch(/location\.search\s*=[^=]/);
      expect(text, name).not.toMatch(/location\.(assign|replace|reload)/);
      expect(text, name).not.toMatch(/location\.href\s*=[^=]/);
    }
    // ...and the scan can see the thing it forbids.
    expect(codeOnly('window.location.search = x;')).toMatch(/location\.search\s*=[^=]/);
    expect(codeOnly('const s = window.location.search;')).not.toMatch(/location\.search\s*=[^=]/);
  });

  it('App.tsx is the platform edge and nothing else', () => {
    // One `window` read, handed to a pure module. No routing decisions here.
    //
    // NOTE WHAT THESE THREE LINES DO NOT SAY, and read the next describe block
    // for the part that does. They assert that the entry file MENTIONS a
    // `window.location.search` read and MENTIONS `AppShell`. They do not assert
    // that the first is handed to the second, and for a while nothing anywhere
    // did: `<AppShell />` left every one of these green.
    expect(APP).toMatch(/typeof window/);
    expect(APP).toMatch(/window\.location\.search/);
    expect(APP).toMatch(/AppShell/);
    for (const banned of ['MeetScreen', 'SessionScreen', 'LiftScreen', 'previewStateFor']) {
      expect(APP, banned).not.toMatch(new RegExp(`\\b${banned}\\b`));
    }
  });
});

// ---------------------------------------------------------------------------
// THE ONE LINK FROM `window` INTO THE ROUTE GRAPH
// ---------------------------------------------------------------------------

/**
 * ===========================================================================
 * THE DEFECT THIS BLOCK EXISTS TO MAKE IMPOSSIBLE
 * ===========================================================================
 * Delete the prop — `<AppShell />` — and:
 *
 *   - `npx tsc --noEmit` was clean (`search` was optional, defaulting to null);
 *   - all 2457 node tests were green, including every scan in the file above,
 *     because they ask whether `App.tsx` MENTIONS `window.location.search` and
 *     whether it MENTIONS `AppShell`, and both were still true;
 *   - `resolveEntry(null)` then returns `DEFAULT_ROUTE` for every URL, so
 *     `?meet=recap`, `?meet=live`, `?meet=bombed`, `?session=set`, `?replay=`
 *     and `?cutin=` all boot the daily check-in;
 *   - and `tools/verify-shell-route.mjs` would photograph the check-in twelve
 *     times, under twelve filenames naming twelve other screens, because a
 *     capture tool photographs whatever is on screen.
 *
 * Roughly forty of that tool's eighty-two checks would have been describing
 * screens the app could no longer draw. The irony a critic pointed out is the
 * shape of the hole: `cutInSearch={search}` one level down is pinned twice, by
 * two separate assertions, and the one link that actually reaches `window` was
 * pinned zero times.
 *
 * ===========================================================================
 * WHY AN AST AND NOT A REGEX
 * ===========================================================================
 * `expect(APP).toMatch(/search=\{locationSearch\(\)\}/)` would close today's
 * hole and would be a worse check than nothing, because it pins the SPELLING.
 * Rename the prop, inline the helper, hoist the read into a `useMemo`, move the
 * read into its own module — every one of those is a legitimate restructure and
 * every one turns that regex red while the app is correct, which is how a check
 * gets deleted rather than fixed.
 *
 * So the property asserted is the DATA FLOW: some attribute of the `<AppShell>`
 * element is fed, directly or through names this file can follow, by a read of
 * `<something>.location.search`. `<AppShell search={window.location.search} />`,
 * `<AppShell urlQuery={readSearch()} />` and
 * `<AppShell {...{ search: locationSearch() }} />` all pass. `<AppShell />`,
 * `<AppShell search={null} />`, and a file that DEFINES `locationSearch` and
 * never passes it all fail — that last one being exactly the state the old
 * scans could not tell from the good one.
 *
 * ===========================================================================
 * AND WHY IT IS DISCOVERED RATHER THAN POINTED AT `App.tsx`
 * ===========================================================================
 * The entry file is at the REPOSITORY ROOT, not under `src/`. A sibling piece
 * in this run shipped a scan rooted at `src/`, with every non-vacuity control
 * inside it passing, because they all asked about files the scan already had —
 * a scan cannot notice the file it never looked at. So this one walks the whole
 * tree from the root, requires that EVERY non-test file mounting the shell hands
 * over the URL, and separately requires that at least one of those files is
 * reachable from `package.json`'s `main` by following imports. Move `App.tsx`
 * to `src/AppRoot.tsx` and the check follows it; add a second mount point that
 * forgets the URL and the check names it.
 */
const HAND_OFF = Object.freeze({
  /** The component every mount of which must be fed the browser's URL. */
  COMPONENT: 'AppShell',
  /** The read that IS the platform edge: `<something>.location.search`. */
  LOCATION: 'location',
  SEARCH: 'search',
  /**
   * How many names deep the analyser will follow a value before giving up —
   * `search={locationSearch()}` is one hop, a helper in another module is two.
   * Bounded so a cycle or a deep graph cannot hang the suite; generous enough
   * that no plausible restructure runs out of budget.
   */
  MAX_DEPTH: 8,
  /** How many modules the entry-point walk will load before giving up. */
  MAX_MODULES: 600,
  /**
   * Directories the repository walk does not descend into.
   *
   * `.claude` for the reason `src/tuning/audit.test.ts` gives at length: it
   * holds `worktrees/`, and a git worktree is a COMPLETE SECOND CHECKOUT of this
   * repository, so walking into one makes this test's verdict depend on what
   * some other agent has half-finished.
   */
  NOT_WALKED: Object.freeze(['node_modules', '.git', '.expo', 'dist', 'coverage', '.claude', '.gauntlet']),
  /** What a relative import may resolve to, in the order Metro would try. */
  MODULE_EXTENSIONS: Object.freeze(['.tsx', '.ts']),
});

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

/** Resolves a relative import the way Metro would, or `null` if nothing is there. */
type Loader = (fromFile: string, specifier: string) => Module | null;

const loadFromDisk: Loader = (fromFile, specifier) => {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(ROOT, path.dirname(fromFile), specifier);
  const candidates = [
    ...HAND_OFF.MODULE_EXTENSIONS.map((ext) => `${base}${ext}`),
    ...HAND_OFF.MODULE_EXTENSIONS.map((ext) => path.join(base, `index${ext}`)),
    base,
  ];
  for (const candidate of candidates) {
    if (!existsSync(candidate) || statSync(candidate).isDirectory()) continue;
    const rel = path.relative(ROOT, candidate).split(path.sep).join('/');
    return parseModule(rel, readFileSync(candidate, 'utf8'));
  }
  return null;
};

/** Is this node the read `<something>.location.search`? */
function isLocationSearchRead(node: ts.Node): boolean {
  const named = (child: ts.Node, name: string): boolean => {
    if (ts.isIdentifier(child)) return child.text === name;
    if (ts.isPropertyAccessExpression(child)) return child.name.text === name;
    if (ts.isElementAccessExpression(child)) {
      const arg = child.argumentExpression;
      return ts.isStringLiteralLike(arg) && arg.text === name;
    }
    return false;
  };
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    return named(node, HAND_OFF.SEARCH) && named(node.expression, HAND_OFF.LOCATION);
  }
  return false;
}

/** Every name declared in a module, so an identifier can be followed to its value. */
function declarationsIn(ast: ts.SourceFile): ReadonlyMap<string, ts.Node> {
  const out = new Map<string, ts.Node>();
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name !== undefined) out.set(node.name.text, node);
    else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) out.set(node.name.text, node);
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(ast, visit);
  return out;
}

/** Local name -> `{ module specifier, name inside that module }`, for every import. */
function importsIn(ast: ts.SourceFile): ReadonlyMap<string, { readonly from: string; readonly as: string }> {
  const out = new Map<string, { from: string; as: string }>();
  for (const stmt of ast.statements) {
    if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    const from = stmt.moduleSpecifier.text;
    const clause = stmt.importClause;
    if (clause === undefined) continue;
    if (clause.name !== undefined) out.set(clause.name.text, { from, as: 'default' });
    const bound = clause.namedBindings;
    if (bound !== undefined && ts.isNamedImports(bound)) {
      for (const element of bound.elements) {
        out.set(element.name.text, { from, as: (element.propertyName ?? element.name).text });
      }
    }
  }
  return out;
}

/**
 * Does the value of `node` come, however indirectly, from a `location.search`
 * read?
 *
 * Follows identifiers to the declarations they name — in this module, or one
 * relative import away — up to `MAX_DEPTH`. `seen` is the cycle guard and is
 * keyed by file so the same helper name in two modules is two different names.
 */
function readsPlatformSearch(
  node: ts.Node,
  module: Module,
  loader: Loader,
  depth = 0,
  seen: Set<string> = new Set(),
): boolean {
  if (depth > HAND_OFF.MAX_DEPTH) return false;
  const locals = declarationsIn(module.ast);
  const imported = importsIn(module.ast);
  let found = false;
  const visit = (child: ts.Node): void => {
    if (found) return;
    if (isLocationSearchRead(child)) {
      found = true;
      return;
    }
    if (ts.isIdentifier(child)) {
      const key = `${module.file}#${child.text}`;
      if (!seen.has(key)) {
        seen.add(key);
        const local = locals.get(child.text);
        if (local !== undefined) {
          if (readsPlatformSearch(local, module, loader, depth + 1, seen)) found = true;
          return;
        }
        const via = imported.get(child.text);
        if (via !== undefined) {
          const next = loader(module.file, via.from);
          const target = next === null ? undefined : declarationsIn(next.ast).get(via.as);
          if (next !== null && target !== undefined) {
            if (readsPlatformSearch(target, next, loader, depth + 1, seen)) found = true;
          }
          return;
        }
      }
      return;
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
}

interface ShellMount {
  readonly file: string;
  /** The attribute carrying the platform read, or `null` when none does. */
  readonly fedBy: string | null;
  /** Every attribute the element was given, for the failure text. */
  readonly props: readonly string[];
}

/** Every `<AppShell>` element in a module, and what feeds each one. */
function shellMountsIn(module: Module, loader: Loader): readonly ShellMount[] {
  const mounts: ShellMount[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      if (node.tagName.getText(module.ast) === HAND_OFF.COMPONENT) {
        const props: string[] = [];
        let fedBy: string | null = null;
        for (const attribute of node.attributes.properties) {
          const name = ts.isJsxAttribute(attribute)
            ? attribute.name.getText(module.ast)
            : '{...spread}';
          props.push(name);
          const value = ts.isJsxAttribute(attribute) ? attribute.initializer : attribute.expression;
          if (value === undefined) continue;
          if (fedBy === null && readsPlatformSearch(value, module, loader)) fedBy = name;
        }
        mounts.push({ file: module.file, fedBy, props });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(module.ast);
  return mounts;
}

/** Every non-test TypeScript file in the repository, repository-relative POSIX. */
function repositorySources(): readonly string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (HAND_OFF.NOT_WALKED.includes(entry)) continue;
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

/** Every module the app boots, from `package.json`'s `main` outwards. */
function bootedModules(): readonly string[] {
  const main = String((JSON.parse(source('package.json')) as { main?: unknown }).main ?? '');
  const start = loadFromDisk('package.json', main.startsWith('.') ? main : `./${main}`);
  if (start === null) return [];
  const reached = new Set<string>([start.file]);
  const queue: Module[] = [start];
  while (queue.length > 0 && reached.size < HAND_OFF.MAX_MODULES) {
    const module = queue.shift() as Module;
    const specifiers: string[] = [];
    const visit = (node: ts.Node): void => {
      // Static `import ... from './x'` and dynamic `await import('./x')`, which
      // is how `index.ts` reaches the app at all — it defers the import until
      // Skia's WASM has loaded, so a static-only walk would never find `App`.
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        specifiers.push(node.moduleSpecifier.text);
      }
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const [arg] = node.arguments;
        if (arg !== undefined && ts.isStringLiteralLike(arg)) specifiers.push(arg.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(module.ast);
    for (const specifier of specifiers) {
      const next = loadFromDisk(module.file, specifier);
      if (next === null || reached.has(next.file)) continue;
      reached.add(next.file);
      queue.push(next);
    }
  }
  return [...reached].sort();
}

describe('the browser’s URL actually reaches the route graph', () => {
  /**
   * A loader for the fixtures: no disk, one fake module, so the import-following
   * branch is exercised without inventing files in the tree.
   */
  const FIXTURE_HELPER = 'src/shell/fixtureSearch.ts';
  const fixtureLoader: Loader = (_from, specifier) =>
    specifier.endsWith('fixtureSearch')
      ? parseModule(
          FIXTURE_HELPER,
          'export function readSearch(): string | null { return window.location.search; }',
        )
      : null;

  const verdictFor = (text: string): ShellMount | undefined =>
    shellMountsIn(parseModule('fixture.tsx', text), fixtureLoader)[0];

  it('CONTROL: the analyser sees the hand-off, and sees it go missing', () => {
    // A scan that has stopped matching agrees with every file it is pointed at,
    // so the shapes it must ACCEPT and the shapes it must REJECT are both
    // written out. The rejections are the half that matters: each one is a way
    // the app could be broken while `tsc` and the whole suite stayed green.
    const passes = [
      // What the app does today.
      `const s = () => window.location.search;\nconst a = <AppShell search={s()} />;`,
      // Inlined.
      `const a = <AppShell search={window.location.search} />;`,
      // The prop renamed — the restructure a regex on the spelling would break on.
      `const s = () => window.location.search;\nconst a = <AppShell urlQuery={s()} />;`,
      // Spread rather than a named attribute.
      `const s = () => window.location.search;\nconst a = <AppShell {...{ search: s() }} />;`,
      // The read extracted into its own module.
      `import { readSearch } from './fixtureSearch';\nconst a = <AppShell search={readSearch()} />;`,
      // Not self-closing, and read off a bare `location`.
      `const a = <AppShell search={location.search}>{null}</AppShell>;`,
      // Through two names and a ternary.
      `const raw = window.location.search;\nconst s = raw ?? null;\nconst a = <AppShell search={s} />;`,
    ];
    for (const text of passes) {
      expect(verdictFor(text)?.fedBy, text).not.toBeNull();
    }

    const failures = [
      // THE MUTATION. Typechecked before `search` was made required.
      `const s = () => window.location.search;\nconst a = <AppShell />;`,
      // Typechecks even now, which is why the type alone is not enough.
      `const s = () => window.location.search;\nconst a = <AppShell search={null} />;`,
      // The helper exists and is called, and its result goes somewhere else —
      // the shape every "does App.tsx mention window.location.search" scan
      // passed on.
      `const s = () => window.location.search;\nconst used = s();\nconst a = <AppShell search={''} />;`,
      // A different property of location is not the query string.
      `const a = <AppShell search={window.location.pathname} />;`,
      // Imported from a module that does not read it.
      `import { readSearch } from './somewhereElse';\nconst a = <AppShell search={readSearch()} />;`,
    ];
    for (const text of failures) {
      expect(verdictFor(text)?.fedBy, text).toBeNull();
    }

    // ...and the element finder itself can come back empty, so "no mount points"
    // is distinguishable from "a mount point with nothing feeding it".
    expect(shellMountsIn(parseModule('fixture.tsx', 'const a = <Other />;'), fixtureLoader)).toEqual(
      [],
    );
  });

  it('CONTROL: the walk covers the whole repository, not just src/', () => {
    // THE SHAPE GDD §12.2 ASKS FOR, BY NAME. Its third correction is about this
    // exact instrument defect, in this exact repository: "the round after the
    // pin was built, its scan was rooted at `src/`, and `App.tsx` — the app's
    // entry point, at the repo root, reachable from nothing under `src/` —
    // could hold an annotated `ServerRecord` with the whole suite green. The
    // table was complete; the instrument reading it was not, and every
    // non-vacuity check inside it passed because they all asked about files the
    // scan already had."
    //
    // Its prescription is to name at least one file outside the main source
    // directory BY HAND, which is what `src/tuning/audit.test.ts` does. Doing it
    // here too is not redundant with the check below: today `App.tsx` is the
    // only file that mounts the shell, so a walk that lost the root would fail
    // that one as well — but add a second mount point under `src/` and it would
    // not, and the root-blind walk would be back with everything green.
    const walked = repositorySources();
    for (const anchor of ['App.tsx', 'index.ts']) {
      expect(walked, `${anchor} is outside src/ and the walk must still see it`).toContain(anchor);
    }
    // ...and it does reach into `src/`, so "covers the root" is not "covers only
    // the root".
    expect(walked).toContain('src/shell/AppShell.tsx');
    // Test files are deliberately excluded: a test may legitimately render a
    // shell with no URL. Stated as a fact of the walk rather than left implicit.
    expect(walked.filter((file) => file.endsWith('.test.ts'))).toEqual([]);
  });

  it('EVERY file in the repository that mounts the shell hands it the URL', () => {
    const mounts = repositorySources().flatMap((file) =>
      shellMountsIn(parseModule(file, source(file)), loadFromDisk),
    );

    // The walk found something at all. Rooted at the repository, not at `src/`:
    // the entry file is `App.tsx`, at the top level, and a scan that starts one
    // directory down cannot see it however many controls it carries.
    expect(
      mounts.length,
      `nothing in the repository mounts <${HAND_OFF.COMPONENT}> — either the walk stopped working or the app no longer has a shell`,
    ).toBeGreaterThan(0);

    const starved = mounts.filter((mount) => mount.fedBy === null);
    expect(
      starved,
      starved
        .map(
          (mount) =>
            `${mount.file} mounts <${HAND_OFF.COMPONENT}> but no prop of it carries a ${HAND_OFF.LOCATION}.${HAND_OFF.SEARCH} read` +
            ` (props given: ${mount.props.length === 0 ? 'none' : mount.props.join(', ')}).` +
            ' Every debug URL and every deep link would boot DEFAULT_ROUTE.',
        )
        .join('\n'),
    ).toEqual([]);
  });

  it('and the file that does is one the app actually boots into', () => {
    // The other half. A perfectly wired mount point in a file nothing imports is
    // the same defect one level up, and it is the shape this whole piece exists
    // to close: `MeetScreen` was correct, tested, and unreachable.
    const booted = bootedModules();
    expect(
      booted.length,
      `could not follow package.json's "main" to anything — the import walk found ${booted.length} module(s)`,
    ).toBeGreaterThan(1);

    const mounting = booted.filter(
      (file) => shellMountsIn(parseModule(file, source(file)), loadFromDisk).length > 0,
    );
    expect(
      mounting.length,
      `package.json's "main" reaches ${booted.length} module(s) and none of them mounts <${HAND_OFF.COMPONENT}>`,
    ).toBeGreaterThan(0);

    const fed = mounting.filter((file) =>
      shellMountsIn(parseModule(file, source(file)), loadFromDisk).every(
        (mount) => mount.fedBy !== null,
      ),
    );
    expect(fed, `the booted mount point(s) ${mounting.join(', ')} do not all get the URL`).toEqual(
      mounting,
    );
  });
});

// ---------------------------------------------------------------------------
// THE ALREADY-TRAINED-TODAY CASE SURVIVES NAVIGATION
// ---------------------------------------------------------------------------

/**
 * The one meet this file drives through the app's module-scoped port.
 *
 * ONE PLACE, because `appServer.ts` exports no reset: the singleton this file
 * writes to is the same object every test below it reads, so the day and the
 * proposal id are properties of the file rather than of a test. A second meet
 * recorded on this row is refused as `MEET_ALREADY_RECORDED`, which is why the
 * id is written down here rather than typed at a call site where a duplicate
 * would look like a typo instead of a collision.
 *
 * `DAY` is past `SESSION_BOUNDARY.LOCAL_SERVER_SIGNUP_DAY`, which is where the
 * un-configured `localSessionServer()` behind the accessors starts its lifter.
 */
const APP_PORT_MEET_FIXTURE = {
  DAY: SESSION_BOUNDARY.LOCAL_SERVER_SIGNUP_DAY + 301,
  PROPOSAL_ID: asProposalId('shell-wiring-app-port-meet'),
} as const;

describe('navigating away and back cannot buy a second session of the day', () => {
  it('the app has ONE session-server connection, and asking twice returns it', () => {
    // The behavioural half, and it needs no renderer: the guarantee IS object
    // identity across calls. `SessionScreen` unmounts when meet day opens, so a
    // port built per mount would be a server that had never heard of today's
    // session — and `alreadyTrainedToday` is read out of what the server said.
    const first = appSessionPort();
    const second = appSessionPort();
    expect(second).toBe(first);
    // A third time, after something else has run, still the same object.
    expect(appSessionPort()).toBe(first);
  });

  it('it really is a session-server port and not a stub', () => {
    const port = appSessionPort();
    expect(typeof port.openingSnapshot).toBe('function');
    expect(typeof port.sessionBrief).toBe('function');
    expect(typeof port.recordTrainingSession).toBe('function');
  });

  // -------------------------------------------------------------------------
  // ONE LIFTER: the meet half reaches the SAME connection
  // -------------------------------------------------------------------------

  it('THE MEET PORT AND THE SESSION PORT ARE THE SAME OBJECT [one-row-behind-one-port]', () => {
    // The entire content of "the four modes are one game because they are one
    // lifter", as one assertion. `useMeetDay` used to call `newServerRecord(...)`
    // on mount, so meet day read a lifter who had never trained: the signup
    // seed's openers on day 1 and on day 400, FIRST TOTAL after every meet, and
    // GDD §6.3's PR attempt permanently impossible.
    //
    // NOT `toEqual`. Two ports built from the same seed are deeply equal on
    // construction and diverge the instant either is written to, which is
    // exactly the bug wearing a passing test. Identity is the claim.
    //
    // THE MESSAGE IS CARRIED BY HAND because the bare identity failure reads
    // `expected { …(5) } to be { …(5) }`, which tells a reader nothing about
    // what broke — measured, on the mutation that produced this witness.
    //
    // WIDENED TO `unknown` FIRST, and the reason is a small piece of evidence in
    // its own right: `tsc` refuses `appMeetPort() === appSessionPort()` with
    // "these types have no overlap", because the two accessors narrow to
    // interfaces that share only `openingSnapshot` and are otherwise disjoint.
    // That refusal is the narrowing working — neither screen can reach the other
    // mode's endpoints through the port it was handed — so the comparison is
    // about OBJECT IDENTITY and says so, rather than being made to typecheck by
    // widening the accessors back.
    const meet: unknown = appMeetPort();
    const session: unknown = appSessionPort();
    expect(
      meet === session,
      'meet day and the daily session are holding two different servers, so they are two different lifters',
    ).toBe(true);
    const viewed: unknown = withSportingCreditOnRecord(appMeetPort(), () => undefined);
    expect(
      viewed === meet,
      'the played-route credit view replaced the singleton, so the two halves are two objects again',
    ).toBe(false);
    expect(
      (appMeetPort() as unknown) === (appSessionPort() as unknown),
      'the view mutated the singleton identity',
    ).toBe(true);
  });

  it('and it really is a meet-server port, so the identity above is not two stubs', () => {
    const port = appMeetPort();
    expect(typeof port.openingSnapshot).toBe('function');
    expect(typeof port.meetBrief).toBe('function');
    expect(typeof port.recordMeetResult).toBe('function');
  });

  it('a meet recorded through it is visible to the session half, on one row [a-meet-total-reaches-the-session-half]', async () => {
    // The identity above is structural; this is the consequence, and this test
    // is where it is actually driven. A total banked through the MEET endpoint
    // has to come back out of the snapshot the SESSION half opens on, or the
    // two halves are one object holding two truths.
    //
    // WHAT THIS USED TO BE, recorded because it is the thing the file was sent
    // back for: it read `readTotalKg` once, named the result `before`, asserted
    // it was null, and stopped. No meet was recorded, `recordMeetResult` was
    // never called, and there was no `after`. Pointing `appMeetPort()` at a
    // second `localSessionServer()` — the defect this whole module exists to
    // prevent, and the mutant the witness below records — left it green.
    //
    // THE SUBJECT IS THE MODULE-SCOPED SINGLETON, which is what makes this a
    // different test from `localSessionServer.test.ts`'s "A MEET BANKS A TOTAL
    // THAT THE SESSION SIDE CAN THEN READ". That one constructs its port with
    // `localSessionServer({ record, sleep })` and proves the SERVER joins the
    // two endpoints. This one asks the same question of `appServer.ts`'s
    // accessors, which is the join the shipped app actually goes through: a
    // correct server reached by two connections is the bug wearing a passing
    // test one level out. The drive below is deliberately a copy of that file's
    // `playAMeet` rather than a shared helper — it is a fixture, not a guard,
    // and sharing it would make one subject's setup the other's.
    //
    // Read through `readTotalKg` rather than off any row, because the row has no
    // accessor — which is the other half of the discipline.
    //
    // NO `before`-IS-NULL PIN. The singleton has no reset, so this test runs
    // against whatever the file has already done to it; the claim is that the
    // reading MOVED to the number the meet endpoint reported, which is true
    // wherever it started from.
    const meetPort = appMeetPort();
    const day = APP_PORT_MEET_FIXTURE.DAY;
    const facts = meetDayFactsFromCache(
      openingCache(meetPort),
      day,
      SESSION_TUNING.STARTING_E1RM,
    );
    const played = playMeet(
      () => 'perfect',
      () => 'small',
      {
        day,
        meet: MEET_LOCAL,
        entry: MEET_ENTRY,
        bestE1rmKg: facts.bestE1rmKg,
        previousBestTotalKg: facts.previousBestTotalKg,
        previousBestByLiftKg: facts.previousBestByLiftKg,
        fatigue: meetPort.meetBrief(day).fatigue,
      },
    );
    const proposal = meetResultProposal(played);
    expect(proposal, 'the played meet produced no proposal, so nothing was submitted').not.toBeNull();
    if (proposal === null) throw new Error('unreachable');

    const before = readingValue(readTotalKg(openingCache(appSessionPort())));
    const response = await meetPort.recordMeetResult(
      day,
      MEET_LOCAL,
      proposal,
      APP_PORT_MEET_FIXTURE.PROPOSAL_ID,
    );
    // NON-VACUITY, AND IT IS THE FIRST THING ASKED. A refused write leaves every
    // assertion below comparing two numbers that never moved for a reason that
    // has nothing to do with the port. `MEET_ALREADY_RECORDED` is the live
    // version of that hazard: a second recording of the same meet on this
    // singleton is refused, so if anything upstream in this file starts banking
    // one, this line names it rather than the claim failing sideways.
    expect(
      response.kind === 'recorded' ? 'recorded' : `refused: ${JSON.stringify(response)}`,
      'the meet endpoint refused the write, so nothing below is about the port',
    ).toBe('recorded');
    if (response.kind !== 'recorded') throw new Error('unreachable');
    expect(response.result.totalKg, 'the meet banked no total to look for').toBeGreaterThan(0);
    expect(
      response.result.isTotalPr,
      'this meet did not move the row, so reading the row back proves nothing — something earlier in this file banked a bigger total',
    ).toBe(true);

    const after = readingValue(readTotalKg(openingCache(appSessionPort())));
    // THE CLAIM. The message is carried by hand for the reason the identity
    // check above gives: a bare `toBe` on two numbers names neither half.
    expect(
      after,
      'the session half cannot see the total the meet endpoint banked, so meet day and the daily loop are two lifters',
    ).toBe(response.result.totalKg);
    expect(after, 'the reading did not move at all').not.toBe(before);
  });

  it('the port is memoised at module scope, not in a component', () => {
    // A `useRef` only survives as long as the component holding it, which is
    // exactly the thing that stops surviving when the shell can route away.
    expect(APP_SERVER).toMatch(/let connection: LocalAppServerPort \| null = null;/);
    expect(APP_SERVER).toMatch(/if \(connection === null\) connection = localSessionServer\(\);/);
    expect(APP_SERVER).not.toMatch(/useRef|useState|useMemo/);
    // AND THERE IS EXACTLY ONE `localSessionServer()` CALL IN THE FILE. Two
    // would typecheck, would keep every assertion above green except the
    // identity one, and would be the defect back.
    expect(APP_SERVER.match(/localSessionServer\(\)/g)).toHaveLength(1);
  });

  it('the shell hands that port to the session, rather than letting it build one', () => {
    expect(SHELL).toMatch(/serverPort=\{appSessionPort\(\)\}/);
  });

  it('and hands the meet one too, which it did not before', () => {
    // `AppShell` gave `SessionScreen` a `serverPort` and gave `MeetScreen` no
    // port, no record and no cache. That asymmetry IS the defect, in one line of
    // JSX, and this is the line.
    expect(SHELL).toMatch(/serverPort=\{meetFrame\?\.serverPort \?\? playedMeetPort\}/);
    expect(SHELL).toMatch(/withSportingCreditOnRecord\(appMeetPort\(\), creditSportingResult\)/);
  });

  it('MeetScreen forwards the port to the hook instead of dropping it', () => {
    // The twin of the `SessionScreen` check below, and the same silent failure:
    // accepting the prop and calling `useMeetDay(preview, ...)` anyway.
    expect(MEET_SCREEN).toMatch(/useMeetDay\(serverPort, preview, preview !== undefined\)/);
    expect(MEET_SCREEN).not.toMatch(/useMeetDay\(preview/);
  });

  it('SessionScreen forwards the port to the hook instead of dropping it', () => {
    // The one place this could break silently: accepting the prop and calling
    // `useSession(preview)` anyway.
    expect(SESSION_SCREEN).toMatch(/useSession\(preview, serverPort\)/);
    expect(SESSION_SCREEN).not.toMatch(/useSession\(preview\)/);
  });

  it('the already-trained surface is still there and still gated on the server’s answer', () => {
    expect(SESSION_SCREEN).toMatch(/loop\.alreadyTrainedToday/);
    expect(source('src/session/SessionScreen.tsx')).toMatch(/testID=""session-already-trained""|testID="session-already-trained"/);
  });

  it('AND IT RENDERS ON THE `check-in` BEAT, so the shell’s pill is on it too', () => {
    // THE JOIN THAT MAKES A SECOND VISIT NOT A DEAD END, in two halves.
    //
    // Half one, here: `SessionScreen` renders the already-trained surface while
    // `state.phase === 'check-in'` and reports that same `state.phase` to the
    // shell (pinned above, `onPhase?.(state.phase)`). So the beat the shell's
    // gate sees on the already-trained screen IS `'check-in'`.
    //
    // Half two, in `shellRoute.test.ts`: `shellAffordanceFor(session,
    // 'check-in')` is pinned by a HAND-WRITTEN literal to `'open-meet'`.
    //
    // Compose them and a player who opens the app for the second time today
    // gets somewhere to go rather than a screen with nothing on it — GDD §12.3's
    // "never punish daily engagement" line applied to navigation. Neither half
    // states it alone, which is why this scan exists: `'check-in'` could be
    // changed to a bespoke phase here and the literal in `shellRoute.test.ts`
    // would stay green while the second visit went back to being a dead end.
    //
    // WHAT THIS DOES NOT SETTLE, AND WHO DOES. Nothing here says whether the
    // pill visually collides with the already-trained copy. The surface is
    // `styles.centred` (`flex: 1`, `justifyContent: 'center'`), so it occupies
    // the middle band and the pill is anchored `SHELL_LAYOUT.NAV_BOTTOM_INSET`
    // from the bottom — but that is an argument, not a photograph.
    //
    // THIS COMMENT USED TO SAY THE PHOTOGRAPH WAS IMPOSSIBLE: "this path has no
    // `?session=` moment that reaches it, so `verify-shell-route.mjs` cannot
    // drive it". The premise was right and the conclusion was wrong. The
    // already-trained branch does require `preview === undefined`, so no debug
    // URL opens it — but it does not need one. It needs A SESSION.
    // `verify-shell-route.mjs` now PLAYS one with a mouse (see
    // `tools/sessionDrive.mjs`), presses DONE, and measures the gap between the
    // copy's lowest drawn line and the pill's top edge on the screen that comes
    // up. Playing that path is also what caught the close-out's server round
    // trip being cancelled by its own effect — a defect this whole file, and
    // the other 2233 tests, were structurally unable to see.
    expect(SESSION_SCREEN).toMatch(
      /loop\.alreadyTrainedToday && state\.phase === '' && preview === undefined/,
    );
    // ...and the phase it is gated on, in the raw source, is `check-in` itself.
    expect(source('src/session/SessionScreen.tsx')).toMatch(
      /loop\.alreadyTrainedToday && state\.phase === 'check-in'/,
    );
    // The scan can see the shape it is looking for, and can see it change.
    expect(codeOnly("if (a && state.phase === 'check-in' && b) {")).toMatch(
      /state\.phase === ''/,
    );
    expect("loop.alreadyTrainedToday && state.phase === 'rest'").not.toMatch(
      /loop\.alreadyTrainedToday && state\.phase === 'check-in'/,
    );
  });
});

// ---------------------------------------------------------------------------
// The shell computes nothing and shows nothing it should not
// ---------------------------------------------------------------------------

describe('the shell is a router, not a screen', () => {
  it('steps no state machine and reads no progression fact', () => {
    for (const banned of [
      'stepSession',
      'stepMeetDay',
      'createSession',
      'createMeetDay',
      'readTotalKg',
      'readBestE1rmKg',
      'readStreakDays',
      'snapshotFacts',
      'applyTrainingSession',
      'applyMeetResult',
      'proposeChange',
    ]) {
      expect(SHELL, banned).not.toMatch(new RegExp(`\\b${banned}\\b`));
    }
    // The scan can see one.
    expect(codeOnly('const s = stepMeetDay(a, b);')).toMatch(/\bstepMeetDay\b/);
  });

  it('cannot reach the hidden fatigue ledger — GDD §3.4, §12.3', () => {
    for (const [name, text] of [
      ['AppShell.tsx', SHELL],
      ['shellRoute.ts', codeOnly(source('src/shell/shellRoute.ts'))],
      ['shellTuning.ts', codeOnly(source('src/shell/shellTuning.ts'))],
      ['appServer.ts', APP_SERVER],
      ['App.tsx', APP],
    ] as const) {
      expect(text, name).not.toMatch(/\bFatigueState\b/);
      expect(text, name).not.toMatch(/\.fatigue\b/);
    }
    expect(codeOnly('const n = state.context.fatigue.sessions;')).toMatch(/\.fatigue\b/);
  });

  it('shows no Total anywhere in its chrome — GDD §3.2, §6.4', () => {
    // Total moves on meet day and no other day. Persistent chrome is on screen
    // during a training session, so a Total there is the exact thing §3.2 says
    // spends meet day's payoff.
    for (const relPath of ['src/shell/AppShell.tsx', 'src/shell/shellTuning.ts', 'App.tsx']) {
      // The RAW source, not the stripped one: a rendered Total would be a
      // string literal, which `codeOnly` blanks.
      const raw = source(relPath).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 ');
      expect(raw, relPath).not.toMatch(/\btotal\b/i);
    }
  });

  it('holds no bare feel value — every one is in the registered tuning module', () => {
    // The magic-number audit enforces this over the whole tree; this states the
    // shell's own half of it in the file a reviewer of the shell will open.
    expect(SHELL).toMatch(/SHELL_LAYOUT|\bL\./);
    expect(SHELL).toMatch(/SHELL_NAV\./);
    expect(SHELL).toMatch(/SHELL_COPY\./);
  });
});

// ---------------------------------------------------------------------------
// The debug routes the evidence harness drives
// ---------------------------------------------------------------------------

describe('the capture harness still has its four query strings', () => {
  it('the shell resolves the launch URL through the pure module', () => {
    expect(SHELL).toMatch(/resolveEntry\(search\)/);
    expect(SHELL).toMatch(/frozenMeetFor\(entry, route\)/);
    expect(SHELL).toMatch(/frozenSessionFor\(entry, route\)/);
    expect(SHELL).toMatch(/entry\.replay/);
  });

  it('and hands every frozen field to the screen that draws it', () => {
    expect(SHELL).toMatch(/preview=\{meetFrame\?\.state\}/);
    expect(SHELL).toMatch(/showCard=\{meetFrame\?\.card/);
    expect(SHELL).toMatch(/holdWalkoutAtMs=\{meetFrame\?\.holdWalkoutAtMs/);
    expect(SHELL).toMatch(/preview=\{frozenSessionFor\(entry, route\)\}/);
    expect(SHELL).toMatch(/replay=\{entry\.replay\}/);
  });

  it('the tools that depend on them name the strings this app parses', () => {
    // Cross-checked against the tools rather than asserted about the app alone:
    // the failure mode is renaming a param and finding out when a capture run
    // produces a directory of identical screenshots.
    expect(source('tools/capture-meet.mjs')).toMatch(/\?meet=\$\{moment\}/);
    expect(source('tools/capture-meet.mjs')).toMatch(/\?meet=live/);
    expect(source('tools/capture-session.mjs')).toMatch(/\?session=\$\{moment\}/);
    expect(source('tools/verify-session-boundary.mjs')).toMatch(/\?session=\$\{moment\}/);
    expect(source('tools/capture-lift.mjs')).toMatch(/\?replay=\$\{load\}&moment=\$\{moment\}/);
    // `verify-lift-shots.mjs` reads the shots off disk rather than driving the
    // app, so it depends on `?replay=` only through the tool above. Named here
    // so that is a recorded fact rather than an omission.
    expect(source('tools/verify-lift-shots.mjs')).toMatch(/manifest\.json/);
  });
});
