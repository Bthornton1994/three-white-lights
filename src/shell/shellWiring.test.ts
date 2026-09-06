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

import { CAREER_TUNING } from '../career/careerTuning';
import { appCareerPort, appLifterPort, appMeetPort, appSessionPort } from './appServer';
import { empireFloorReadings, openEmpireFloor } from './empireFloor';
import { meetDayFactsFromCache } from '../game/meetClient';
import { meetResultProposal } from '../game/meetDay';
import { playMeet } from '../game/meetPreview';
import { MEET_ENTRY, MEET_LOCAL } from '../game/meetTuning';
import { openingCache } from '../game/sessionClient';
import { SESSION_BOUNDARY, SESSION_TUNING } from '../game/sessionTuning';
import { asProposalId, readFederation, readTotalKg, readingValue } from '../game/progression';
import { PERSISTENT_SURFACES, forgetsBeatOnArrival, isPersistentSurface } from './shellRoute';

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
  it('renders the session, meet, Empire, Career and Lifter surfaces — the join is in one file', () => {
    expect(SHELL).toMatch(/\bSessionScreen\b/);
    expect(SHELL).toMatch(/\bMeetScreen\b/);
    expect(SHELL).toMatch(/\bEmpireScreen\b/);
    expect(SHELL).toMatch(/\bCareerScreen\b/);
    expect(SHELL).toMatch(/\bLifterScreen\b/);
    expect(SHELL).toMatch(/from ''/); // imports survived the stripper
    expect(source('src/shell/AppShell.tsx')).toMatch(/from '\.\.\/meet\/MeetScreen'/);
    expect(source('src/shell/AppShell.tsx')).toMatch(/from '\.\.\/session\/SessionScreen'/);
    expect(source('src/shell/AppShell.tsx')).toMatch(/from '\.\/EmpireScreen'/);
    expect(source('src/shell/AppShell.tsx')).toMatch(/from '\.\.\/meet\/CareerScreen'/);
    expect(source('src/shell/AppShell.tsx')).toMatch(/from '\.\.\/meet\/LifterScreen'/);
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
    expect(SHELL).toMatch(/\benter-meet\b|''/);
    expect(source('src/shell/AppShell.tsx')).toMatch(/navigate\(current, 'enter-meet'\)/);
    expect(source('src/shell/AppShell.tsx')).toMatch(/navigate\(current, 'leave-meet'\)/);
    expect(source('src/shell/AppShell.tsx')).toMatch(/navigate\(current, 'open-empire'\)/);
    expect(source('src/shell/AppShell.tsx')).toMatch(/navigate\(current, 'leave-empire'\)/);
    expect(source('src/shell/AppShell.tsx')).toMatch(/navigate\(current, 'open-career'\)/);
    expect(source('src/shell/AppShell.tsx')).toMatch(/navigate\(current, 'leave-career'\)/);
    expect(source('src/shell/AppShell.tsx')).toMatch(/navigate\(current, 'open-lifter'\)/);
    expect(source('src/shell/AppShell.tsx')).toMatch(/navigate\(current, 'leave-lifter'\)/);
    expect(SHELL).not.toMatch(/setRoute\(\{/);
    expect(source('src/shell/AppShell.tsx')).toMatch(/shell-train-here/);
    expect(source('src/shell/AppShell.tsx')).toMatch(/TRAIN_NAV_LABEL/);
    expect(source('src/shell/AppShell.tsx')).not.toMatch(/navigate\(current, 'open-train'\)/);
  });

  it('forgets the destination’s beat on the way in, so no stale control flashes', () => {
    // The screen being routed to reports its beat in an effect, a commit later.
    // Without these, a meet opened after a previous one ended shows the recap's
    // "way back" over its weigh-in for a frame.
    //
    // The cut-in flag is cleared in the same places and for the same
    // reason — the host on the surface being left un-mounts — so the pattern
    // now allows anything BETWEEN the phase reset and the navigate, and the
    // test above pins that what is in there is `setCutInLive(false)`.
    expect(SHELL).toMatch(
      /setMeetPhase\(null\);[\s\S]{0,80}?setRoute\(\(current\) => navigate\(current, ''\)\)/,
    );
    expect(SHELL).toMatch(
      /setSessionPhase\(null\);[\s\S]{0,80}?setRoute\(\(current\) => navigate\(current, ''\)\)/,
    );
    expect(SHELL).toMatch(
      /setEmpirePhase\(null\);[\s\S]{0,80}?setRoute\(\(current\) => navigate\(current, ''\)\)/,
    );
    expect(SHELL).toMatch(
      /setCareerPhase\(null\);[\s\S]{0,80}?setRoute\(\(current\) => navigate\(current, ''\)\)/,
    );
    expect(SHELL).toMatch(
      /setLifterPhase\(null\);[\s\S]{0,80}?setRoute\(\(current\) => navigate\(current, ''\)\)/,
    );
    // ...and the reset still has to be there: a `setRoute` with no phase reset
    // before it does not match, which is the failure this exists for.
    expect(codeOnly('setRoute((current) => navigate(current, "enter-meet"));')).not.toMatch(
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
    // ------------------------------------------------------------------
    // THESE TWO ARE NOT THE CLASS GUARD, AND THEY ARE NOT DEAD EITHER
    // ------------------------------------------------------------------
    // The class guard is `every screen the shell mounts reports its beat`
    // below, which discovers its subjects from `AppShell.tsx`'s JSX and covers
    // the screen these two lines forgot for a wave. The obvious next move is to
    // delete them as superseded, and CLAUDE.md's standing check says to compare
    // the thresholds symbolically before doing that rather than by feel.
    //
    // Compared: the derived guard asks whether the module CALLS `onPhase` at
    // all. These ask whether it calls it with `state.phase`. A subject that
    // reports a hardcoded beat — `onPhase?.('check-in')` on `SessionScreen`,
    // which would pin the shell's pill to one phase for ever while the screen
    // moved underneath it — satisfies the derived guard and reddens these. So
    // these two imply the derived one on their two screens and are strictly
    // stronger there; neither is dominated, and both were mutated to confirm it
    // rather than argued about.
    //
    // They stay screen-named on purpose: `EmpireScreen` legitimately reports
    // `onPhase?.('floor')` from a literal, because the Empire surface has one
    // beat, so a tree-wide version of THIS check would be false of a correct
    // screen. The argument-shape claim is per-screen; the reporting claim is
    // the class.
    expect(SESSION_SCREEN).toMatch(/onPhase\?\.\(state\.phase\)/);
    expect(MEET_SCREEN).toMatch(/onPhase\?\.\(state\.phase\)/);
  });

  it('asks `shellAffordanceFor` when to draw a control, and draws only that', () => {
    expect(SHELL).toMatch(/shellAffordanceFor\(/);
    expect(SHELL).toMatch(/shellEmpireAffordanceFor\(/);
    expect(SHELL).toMatch(/shellCareerAffordanceFor\(/);
    expect(SHELL).toMatch(/shellLifterAffordanceFor\(/);
    // The gate must be the thing that decides, so the pill cannot be rendered
    // unconditionally next to it.
    expect(SHELL).toMatch(
      /affordance === null &&\s*empireAffordance === null &&\s*careerAffordance === null &&\s*lifterAffordance === null \? null :/,
    );
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
    //   ...it hands each surface a setter OF ITS OWN, and that changed when the
    //   daily session stopped un-mounting under GDD §5's floor. One shared flag
    //   was correct while exactly one host was ever mounted; it is not correct
    //   now, because a report from the hidden session would take the chrome off
    //   the floor and strand the player on a surface whose only exit is the pill
    //   that just vanished. Two setters, one per host, and the count is pinned so
    //   a third surface growing a host has to arrive here.
    expect(source('src/shell/AppShell.tsx')).toMatch(/onCutIn=\{setSessionCutIn\}/);
    expect(source('src/shell/AppShell.tsx')).toMatch(/onCutIn=\{setMeetCutIn\}/);
    expect(source('src/shell/AppShell.tsx').match(/onCutIn=\{set\w+\}/g)?.length).toBe(2);
    //   ...and the gate is handed the flag belonging to the surface ON SCREEN,
    //   rather than whichever host spoke last. Empire mounts no host, so it is
    //   told `false` rather than being told nothing.
    expect(source('src/shell/AppShell.tsx')).toMatch(
      /route\.surface === 'session' \? sessionCutIn : route\.surface === 'meet' \? meetCutIn : false/,
    );
    //   ...and each surface forwards it to the host that owns the answer.
    expect(SESSION_SCREEN).toMatch(/onLive=\{onCutIn\}/);
    expect(MEET_SCREEN).toMatch(/onLive=\{onCutIn\}/);
    // The host really reports it, rather than accepting the prop and dropping
    // it — the same failure `onPhase` had, and invisible to a type.
    const HOST = codeOnly(source('src/cutin/CutInHost.tsx'));
    expect(HOST).toMatch(/onLive\?\.\(live !== null\)/);
    expect(HOST).toMatch(/onLive\?\.\(false\)/);
    // And the flag is cleared on the way ONTO a surface whose host re-mounts,
    // like the phases, so a host that un-mounted mid-cut-in cannot leave the
    // next screen bare. TWO, not four, and the two that are gone are the Empire
    // round trip's: the floor mounts no host at all, and the session it returns
    // to never un-mounted, so there is nothing stale on either side of it.
    // `PERSISTENT_SURFACES` in `shellRoute.ts` is the list, and the pairing below
    // is what keeps this number honest rather than merely current.
    expect(source('src/shell/AppShell.tsx').match(/set\w*CutIn\(false\)/g)?.length).toBe(2);
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

/**
 * Every name declared in a module, so an identifier can be followed to its value.
 *
 * DESTRUCTURED NAMES ARE IN HERE TOO, and they are mapped to the WHOLE
 * declaration rather than to their own slot of it. `const [state] = useState(()
 * => createEmpireState())` is the shape React hands every screen its state in,
 * and without this arm `state` resolves to nothing and every tracer built on
 * this map stops at the first hook.
 *
 * THE IMPRECISION IS DELIBERATE AND IS STATED RATHER THAN HIDDEN: mapping a
 * bound name to the whole declaration means `const [a, b] = [pure(), 'copy']`
 * reads `b` as coming from `pure()` too. It is the direction that OVER-accepts,
 * so a check built on it is weaker than it looks on a multi-element pattern and
 * exactly as strong as it looks on the single-element ones the shell actually
 * writes. Narrowing it would mean re-implementing destructuring assignment,
 * which is a bigger surface to get wrong than the case it would buy.
 */
function declarationsIn(ast: ts.SourceFile): ReadonlyMap<string, ts.Node> {
  const out = new Map<string, ts.Node>();
  const bindNamesOf = (name: ts.BindingName, declaration: ts.Node): void => {
    if (ts.isIdentifier(name)) {
      out.set(name.text, declaration);
      return;
    }
    for (const element of name.elements) {
      if (ts.isBindingElement(element)) bindNamesOf(element.name, declaration);
    }
  };
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name !== undefined) out.set(node.name.text, node);
    else if (ts.isVariableDeclaration(node)) bindNamesOf(node.name, node);
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
      // THROUGH A DESTRUCTURED NAME, which is how React hands anything back and
      // which `declarationsIn` could not follow until the arm above was added.
      // Without it `search` resolves to no declaration and this reads as starved.
      `const [search] = useState(window.location.search);\nconst a = <AppShell search={search} />;`,
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
// THE SCREENS THE SHELL MOUNTS, AND THE FILES THE SHELL IS MADE OF —
// BOTH DISCOVERED FROM THE TREE RATHER THAN LISTED HERE
// ---------------------------------------------------------------------------

/**
 * ===========================================================================
 * THE DEFECT THIS BLOCK EXISTS TO CLOSE, AND WHY A THIRD REGEX WOULD NOT
 * ===========================================================================
 * `EmpireScreen` reports its beat in a three-line effect, and that effect is
 * the entire reason GDD §5's floor has anything on it a thumb can press:
 * `AppShell`'s `empirePhase` has one writer, `shellEmpireAffordanceFor` has one
 * input, and the screen renders no `Pressable` of its own. Delete the effect
 * and a player who presses GYM EMPIRE lands on a surface with no interactive
 * element at all — the route was entered through React state, so
 * `location.search` never moved and browser-back does not undo it, and on a
 * phone there is no URL to fall back to in the first place.
 *
 * That deletion was measured on this tree, not reasoned about: 78 files, 3214
 * tests, all green, `npx tsc --noEmit` exit 0. `onPhase?:` is optional, so
 * dropping the attribute at the mount site typechecks as well.
 *
 * WHY IT SURVIVED. The scan that covers the other two screens is six lines
 * above the scan that covers Empire's pill, in a test whose own comment records
 * that it was added after this exact mutation stayed green across 2183 tests.
 * It names its two subjects as literals. The third screen arrived a wave later
 * and nobody edited the list — which is the failure mode of any guard that has
 * to be remembered, at the shortest distance this repository has recorded yet.
 *
 * SO THE SET IS DISCOVERED, from `AppShell.tsx`'s own JSX, and the requirement
 * is applied to whatever is in it. A fifth screen inherits the check by being
 * mounted rather than by somebody thinking of it. The two censuses are what
 * keep that from being silent: they pin how many screens were found and how
 * many of them declare a phase callback, so a screen arriving — or one quietly
 * dropping the declaration, which would otherwise leave the set smaller and the
 * loop still green — is a red test with a number in it.
 */
const SCREEN_REPORTING = Object.freeze({
  /** The prop a surface reports its beat to the shell through. */
  PHASE_PROP: 'onPhase',
  /** The file whose JSX decides which screens the app has. */
  SHELL_FILE: 'src/shell/AppShell.tsx',
  /**
   * How many distinct screen modules `AppShell.tsx` mounts today.
   *
   * `SessionScreen`, `MeetScreen`, `EmpireScreen`, `CareerScreen`,
   * `LiftScreen`, `LifterScreen`. Pinned so the seventh is announced rather
   * than absorbed. The sixth WAS announced here — `LifterScreen` arrived
   * with A2 and moved this from 5, which is the number doing its job.
   */
  SCREENS: 6,
  /**
   * ...and how many of those declare a phase callback in their props.
   *
   * Five: the replay harness's `LiftScreen` has no beats and is not
   * player-reachable (`shellRoute.ts` keeps `replay` out of
   * `playerReachableFrom`), so the shell draws no chrome over it and asks it
   * nothing. Pinned separately from the count above because the two move for
   * different reasons: deleting `EmpireScreenProps.onPhase` outright leaves
   * six screens and five becomes four.
   */
  DECLARING_A_PHASE: 5,
});

/** One `<Screen …>` element in `AppShell.tsx`, and what it was given. */
interface ScreenMount {
  readonly component: string;
  /** The module the tag name resolves to, repository-relative. */
  readonly file: string;
  /** Does that module's props type declare the phase callback? */
  readonly declaresPhase: boolean;
  /** Does that module CALL it, rather than accepting it and dropping it? */
  readonly reportsPhase: boolean;
  /** Was this mount site handed one? */
  readonly handedPhase: boolean;
}

/** Does this module's props type declare a `PHASE_PROP` member? */
function declaresPhaseProp(module: Module): boolean {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (
      (ts.isPropertySignature(node) || ts.isPropertyDeclaration(node)) &&
      ts.isIdentifier(node.name) &&
      node.name.text === SCREEN_REPORTING.PHASE_PROP
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(module.ast, visit);
  return found;
}

/**
 * Does this module CALL the phase callback?
 *
 * AN AST AND NOT A REGEX, for the reason the hand-off analyser above gives at
 * length: `expect(SCREEN).toMatch(/onPhase\?\.\(state\.phase\)/)` pins the
 * SPELLING and the ARGUMENT, so `onPhase?.(beat)`, `props.onPhase?.(p)` and a
 * report hoisted into a callback all turn it red while the app is correct. It
 * accepts `onPhase(x)`, `onPhase?.(x)` and `<anything>.onPhase(x)`; a mention
 * inside a comment or a string is not a call node and does not count, which the
 * fixtures below drive both ways.
 */
function callsPhaseProp(module: Module): boolean {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const name = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : null;
      if (name === SCREEN_REPORTING.PHASE_PROP) {
        found = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(module.ast, visit);
  return found;
}

/**
 * Every screen element in a shell module, with the module each tag resolves to.
 *
 * A tag counts as a screen when it is capitalised AND it resolves through this
 * file's own import follower to a relative module on disk. That is what keeps
 * `<View>`, `<Text>`, `<Pressable>` and `<Animated.View>` out — they come from
 * packages — and `<ShellNav>` out, which is declared in `AppShell.tsx` itself
 * and is chrome rather than a surface.
 */
function screenMountsIn(shellFile: string, text: string, loader: Loader): readonly ScreenMount[] {
  const shell = parseModule(shellFile, text);
  const imported = importsIn(shell.ast);
  const mounts: ScreenMount[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const tag = node.tagName.getText(shell.ast);
      const via = imported.get(tag);
      const target = via === undefined ? null : loader(shell.file, via.from);
      if (/^[A-Z]/.test(tag) && target !== null) {
        mounts.push({
          component: tag,
          file: target.file,
          declaresPhase: declaresPhaseProp(target),
          reportsPhase: callsPhaseProp(target),
          handedPhase: node.attributes.properties.some(
            (attribute) =>
              ts.isJsxAttribute(attribute) &&
              attribute.name.getText(shell.ast) === SCREEN_REPORTING.PHASE_PROP &&
              attribute.initializer !== undefined,
          ),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(shell.ast);
  return mounts;
}

/** The screens the real shell mounts, read off the real file. */
function shellScreens(): readonly ScreenMount[] {
  return screenMountsIn(
    SCREEN_REPORTING.SHELL_FILE,
    source(SCREEN_REPORTING.SHELL_FILE),
    loadFromDisk,
  );
}

describe('every screen the shell mounts reports its beat', () => {
  /**
   * A loader with one fake screen module on it, so the discovery and both
   * detectors can be driven without inventing files in the tree. The fixture's
   * body is varied per case; `withScreen` builds a loader that serves it.
   */
  const withScreen = (screenSource: string): Loader => (_from, specifier) =>
    specifier.endsWith('FixtureScreen')
      ? parseModule('src/fixture/FixtureScreen.tsx', screenSource)
      : null;

  const REPORTS = `
    export interface FixtureScreenProps { readonly onPhase?: (p: string) => void; }
    export function FixtureScreen({ onPhase }: FixtureScreenProps) {
      useEffect(() => { onPhase?.('floor'); }, [onPhase]);
      return null;
    }
  `;
  const SILENT = `
    export interface FixtureScreenProps { readonly onPhase?: (p: string) => void; }
    export function FixtureScreen({ onPhase }: FixtureScreenProps) {
      // onPhase?.('floor');  <- the mutation: accepted, never called
      return null;
    }
  `;
  const NO_PROP = `
    export interface FixtureScreenProps { readonly serverPort: Port; }
    export function FixtureScreen(_props: FixtureScreenProps) { return null; }
  `;
  const MOUNT_FED = `import { FixtureScreen } from './FixtureScreen';
    const a = <FixtureScreen onPhase={setPhase} />;`;
  const MOUNT_STARVED = `import { FixtureScreen } from './FixtureScreen';
    const a = <FixtureScreen />;`;

  const verdictFor = (shellText: string, screenText: string): ScreenMount | undefined =>
    screenMountsIn('src/shell/Fixture.tsx', shellText, withScreen(screenText))[0];

  it('CONTROL: the discovery sees a screen, and both detectors see their subject go missing', () => {
    // The scan finds the mount at all, and reads the good case as good.
    const good = verdictFor(MOUNT_FED, REPORTS);
    expect(good?.file).toBe('src/fixture/FixtureScreen.tsx');
    expect([good?.declaresPhase, good?.reportsPhase, good?.handedPhase]).toEqual([
      true,
      true,
      true,
    ]);

    // THE MUTATION, in the shape it took on the real screen: the prop is still
    // declared and still handed over, and the call is gone.
    const silent = verdictFor(MOUNT_FED, SILENT);
    expect([silent?.declaresPhase, silent?.reportsPhase, silent?.handedPhase]).toEqual([
      true,
      false,
      true,
    ]);

    // ...and the other two ways the same dead end arrives.
    const starved = verdictFor(MOUNT_STARVED, REPORTS);
    expect([starved?.declaresPhase, starved?.reportsPhase, starved?.handedPhase]).toEqual([
      true,
      true,
      false,
    ]);
    const gone = verdictFor(MOUNT_FED, NO_PROP);
    expect([gone?.declaresPhase, gone?.reportsPhase]).toEqual([false, false]);

    // Elements that are not screens are not counted: a package component, a
    // namespaced tag, and a component declared in the shell file itself.
    expect(
      screenMountsIn(
        'src/shell/Fixture.tsx',
        `import { View } from 'react-native';
         function ShellNav() { return null; }
         const a = <View><Animated.View /><ShellNav /></View>;`,
        withScreen(REPORTS),
      ),
    ).toEqual([]);

    // And the call detector accepts the shapes a legitimate restructure would
    // produce, while a regex on today's spelling would not.
    for (const body of [
      `function S(props) { props.onPhase('x'); return null; }`,
      `function S({ onPhase }) { const go = () => onPhase(beat); go(); return null; }`,
    ]) {
      expect(callsPhaseProp(parseModule('f.tsx', body)), body).toBe(true);
    }
    // A mention in prose or in a string is not a call.
    for (const body of [
      `function S({ onPhase }) { /* onPhase?.(state.phase) */ return null; }`,
      `function S({ onPhase }) { log('onPhase?.(state.phase)'); return null; }`,
    ]) {
      expect(callsPhaseProp(parseModule('f.tsx', body)), body).toBe(false);
    }
  });

  it('EVERY screen the shell mounts is DISCOVERED, and the census pins how many', () => {
    const mounts = shellScreens();
    const files = [...new Set(mounts.map((mount) => mount.file))].sort();
    expect(
      files.length,
      `${SCREEN_REPORTING.SHELL_FILE} mounts ${files.length} screen module(s): ${files.join(', ')}.` +
        ' A new one is not a defect — but it has to be looked at, and this number is where it gets looked at.',
    ).toBe(SCREEN_REPORTING.SCREENS);
    // ...and the walk really reached the file the finding was about, inside the
    // shell's own directory as well as outside it.
    expect(files).toContain('src/shell/EmpireScreen.tsx');
    expect(files).toContain('src/session/SessionScreen.tsx');
    expect(files).toContain('src/meet/CareerScreen.tsx');
    expect(files).toContain('src/meet/LifterScreen.tsx');

    const declaring = files.filter((file) =>
      mounts.some((mount) => mount.file === file && mount.declaresPhase),
    );
    expect(
      declaring.length,
      `${declaring.length} of ${files.length} mounted screens declare '${SCREEN_REPORTING.PHASE_PROP}': ${declaring.join(', ')}`,
    ).toBe(SCREEN_REPORTING.DECLARING_A_PHASE);
  });

  it('AND EVERY ONE OF THEM CALLS IT — a screen that accepts the beat and drops it is a dead end', () => {
    // THE ASSERTION THE `useEffect` DELETION REDDENS. Nothing here names a
    // screen: the list comes off the shell's JSX, so the next screen mounted is
    // covered by having been mounted.
    const mounts = shellScreens();
    const silent = mounts
      .filter((mount) => mount.declaresPhase && !mount.reportsPhase)
      .map(
        (mount) =>
          `${mount.file} accepts '${SCREEN_REPORTING.PHASE_PROP}' and never calls it, so ` +
          `AppShell's phase for that surface stays null, shellAffordanceFor/shellEmpireAffordanceFor draw nothing, ` +
          'and a player who routes there has no control to press — no URL changed, so there is no way back',
      );
    expect(silent, silent.join('\n')).toEqual([]);

    // THE SIBLING ARM, and it is the one the `useEffect` fix would leave open:
    // the screen reports faithfully and the shell forgot to ask. Same dead end,
    // and it typechecks because the prop is optional.
    const starved = mounts
      .filter((mount) => mount.declaresPhase && !mount.handedPhase)
      .map(
        (mount) =>
          `${SCREEN_REPORTING.SHELL_FILE} mounts <${mount.component}> without '${SCREEN_REPORTING.PHASE_PROP}', ` +
          `so ${mount.file} reports its beat to nobody and the shell draws no chrome over that surface`,
      );
    expect(starved, starved.join('\n')).toEqual([]);

    // NON-VACUITY, AS A COUNT RATHER THAN A BOUND. Both filters above are empty
    // when the domain is empty, which is precisely how a discovery that stopped
    // working would look.
    expect(
      mounts.filter((mount) => mount.declaresPhase).length,
      'no mounted screen declares a phase callback at all, so the two checks above walked an empty list',
    ).toBe(SCREEN_REPORTING.DECLARING_A_PHASE);
  });
});

// ---------------------------------------------------------------------------
// WHERE THE NUMBERS ON GDD §5's FLOOR COME FROM
// ---------------------------------------------------------------------------

/**
 * ===========================================================================
 * THE DEFECT THIS BLOCK EXISTS TO CLOSE: A SCREEN THAT COULD BE A MOCK-UP AND
 * NOTHING WOULD SAY SO
 * ===========================================================================
 * `EmpireScreen.tsx` opens by claiming that every reading it paints is a field
 * of the pure state object. That sentence was load-bearing — it is the whole of
 * why the Empire surface counted as GDD §5 reaching a player at all — and
 * NOTHING IN THE REPOSITORY COULD HAVE REDDENED IF IT STOPPED BEING TRUE.
 *
 * MEASURED, not suspected. Replacing `createEmpireState()` with four hardcoded
 * strings — leaving `src/shell/` with no import edge into `src/empire/`
 * anywhere — left `src/shell`'s node tests at 92 passed and `npx tsc --noEmit`
 * at exit 0. The browser tool was no better and could not have been: the four
 * testIDs holding the readings occurred exactly once each in the whole tree, in
 * the screen itself, and the check filed under "it is drawing real
 * `createEmpireState()` fields" resolved `onScreen('empire-stats')`, which is an
 * opacity read on the container. The DOM is byte-identical under the mutation,
 * so all 254 browser checks reported the same thing.
 *
 * ===========================================================================
 * AND WHY THE OBVIOUS CHECK IS NOT THE CHECK
 * ===========================================================================
 * `expect(read('empire-stat-bucks')).toBe('0')` is the shape everybody reaches
 * for first and it is worth nothing here. EVERY field on this floor is a
 * constant of the constructor — `gymBucks: 0`, `reputation: 0`, `roster: []`,
 * the opening equipment rung — and nothing in the app steps the state, because
 * GDD §11 gates §5's loop on a human ruling that has not happened. So the
 * rendered value and the hardcoded placeholder are THE SAME STRING, and a value
 * assertion cannot tell a wired screen from a mock-up of one. It is the
 * `!visible('meet-recap')` shape one level out: the two things being told apart
 * cannot differ, whatever the code does.
 *
 * SO THE PROPERTY ASSERTED IS PROVENANCE, NOT VALUE. Every element the floor
 * draws that carries both a testID and a value must have that value fed,
 * directly or through names this file can follow, by a call to the pure
 * constructor IMPORTED FROM `src/empire/`. Hardcode a string, read a
 * `SHELL_COPY` constant, or declare a local function spelled
 * `createEmpireState` and return an object literal from it, and the row is
 * named in the failure. That last one is why the import edge is resolved rather
 * than the callee matched by spelling: `progression.test.ts` shipped a seal
 * check that matched its callee by identifier TEXT, and a local shim with the
 * right name typechecked clean past it.
 *
 * ===========================================================================
 * WHAT THIS DOES NOT COVER, SO NOBODY READS IT AS MORE
 * ===========================================================================
 *   - IT IS A SCAN, NOT A RENDER. It says the value expression traces to the
 *     constructor; it does not say React drew it. That half is
 *     `tools/verify-shell-route.mjs`, which reads the four rows off the DOM of a
 *     floor a mouse opened — and which cannot see provenance, because the DOM is
 *     identical under the mutation above. Two instruments, neither sufficient.
 *   - ITS UNIT IS A ROW, NOT A GLYPH. A bare numeral typed straight into a
 *     `<Text>` child is not a row and is not reached here. What keeps that
 *     narrow is that the screen's readings are the only numbers on it, which is
 *     a fact about today's file rather than a property this enforces.
 *   - IT SAYS NOTHING ABOUT WHETHER THE READING IS CORRECT. `gymBucks` drawn
 *     into the reputation row traces perfectly and is wrong. THAT HALF IS
 *     `DRAWN_FROM_PURE_STATE.ROWS` NOW, added a round later and after the swap
 *     had been planted and measured green — the sentence above was accurate,
 *     sat here for a round, and nothing in the tree could redden on it. What
 *     the pairing pin reaches and what it still does not is written on that
 *     constant rather than restated here.
 *   - AND IT IS ROOTED AT THE SCREEN, WHICH NO LONGER PRODUCES THE VALUES. This
 *     is the sharpest of the four and it was measured rather than reasoned
 *     about. `SCREEN_FILE` is `EmpireScreen.tsx`; the screen draws
 *     `readings.<field>`, and `readings` comes from `empireFloorReadings` in
 *     `empireFloor.ts`. `tracesToPureState` asks whether the EXPRESSION reaches
 *     a call to the pure constructor, and `readings` does — through
 *     `openEmpireFloor` -> `createEmpireGym` -> `createEmpireState` — so EVERY
 *     FIELD OF `readings` PASSES THIS WALK WHATEVER IT HOLDS. Replacing
 *     `equipment: floor.gym.state.axes.equipment` with the literal `'bare-bar'`
 *     one file down left this test green, `src/shell` green and `tsc` clean.
 *     The walk was widened from direct to transitive when the arithmetic moved
 *     out of the `.tsx`, and its ROOT was left behind; widening a reach and
 *     moving a root are two edits and only one of them was made. What catches a
 *     hardcode below the screen today is `empireFloor.test.ts`, which pins how
 *     each drawn value MOVES — six rows, six claims — and not this scan.
 */
const DRAWN_FROM_PURE_STATE = Object.freeze({
  /**
   * The screen whose header claims its readings come from pure state.
   *
   * NAMED RATHER THAN DISCOVERED, and the census below is what stops that being
   * a list somebody has to remember: the set of shell-mounted screens reaching
   * into the pure directory is read off `AppShell.tsx`'s own JSX and pinned, so
   * a SECOND screen drawing §5 state announces itself here instead of inheriting
   * nothing.
   */
  SCREEN_FILE: 'src/shell/EmpireScreen.tsx',
  /** The pure constructor a reading has to come from. */
  CONSTRUCTOR: 'createEmpireState',
  /** ...and the directory it has to be imported from, resolved rather than spelled. */
  PURE_DIRECTORY: 'src/empire/',
  /** The two attributes that, together, make an element a drawn reading. */
  VALUE_PROP: 'value',
  TEST_ID_PROP: 'testID',
  /** Follow budget, same number and same reason as `HAND_OFF.MAX_DEPTH`. */
  MAX_DEPTH: 8,
  /**
   * WHICH READING EACH ROW DRAWS, WHICH IS A DIFFERENT QUESTION FROM WHERE IT
   * CAME FROM.
   *
   * The provenance walk above answers "did this value come out of the gym". It
   * does not answer "out of WHICH field of the gym", and its own header says so
   * — `gymBucks` drawn into the reputation row traces perfectly and is false.
   * Measured, at 2b6612e, before this list existed: swapping
   * `value={readings.reputation}` for `value={readings.gymBucks}` on the row
   * labelled REPUTATION left `npx vitest run src/shell
   * src/game/guaranteeTags.test.ts` at 139 passed and `npx tsc --noEmit` at exit
   * 0. The browser tool was no better and could not be: it asserts the label,
   * which comes from untouched `SHELL_COPY`, and that the value advances, which
   * Gym Bucks does. Nothing in the repository read the pairing, and the datum
   * that decides it — `DrawnReading.expression` — was collected on every run and
   * reached a failure-message template string and no predicate.
   *
   * A LIST AND NOT A COUNT, and the difference is what makes it bite. A count
   * pins how many rows there are; this pins which field each of them draws, so a
   * permutation of two rows' values is red, a second row drawing a field already
   * drawn is red, and a row deleted is red. The count is implied by it, which is
   * why the count that used to live here is gone — see the test below.
   *
   * TEXT AND NOT A RESOLVED SYMBOL, said plainly because it is the limit. Each
   * entry is the row's testID and its value expression as written, one layer of
   * quotes or JSX braces stripped and whitespace flattened. So it is red on a
   * rename of a field and on a reformat that changes the expression's tokens,
   * and it is blind to `empireFloorReadings` putting the wrong quantity in a
   * correctly-named field one file down. That half is `empireFloor.test.ts`'s
   * per-row value pins, which is where the equivalent hardcode was caught.
   */
  ROWS: Object.freeze([
    'empire-stat-bucks <- readings.gymBucks',
    'empire-stat-pending <- readings.pendingGymBucks',
    'empire-stat-rep <- readings.reputation',
    'empire-stat-roster <- readings.roster',
    'empire-stat-equipment <- readings.equipment',
    'empire-stat-clock <- readings.clockSeconds',
    // GDD §5.1's away summary, ruled 2026-08-18: the forfeited span past the
    // offline cap, a number and a state. The reading is the floor adapter's own
    // two clocks differenced — the one row that is not a gym field — and how it
    // MOVES is classified and swept in `empireFloor.test.ts` like the other six.
    'empire-stat-away <- readings.forfeitedSeconds',
  ]),
});

/** Is `name`, as used inside `module`, the pure constructor imported from `src/empire/`? */
function isPureConstructorImport(module: Module, name: string, loader: Loader): boolean {
  const via = importsIn(module.ast).get(name);
  if (via === undefined || via.as !== DRAWN_FROM_PURE_STATE.CONSTRUCTOR) return false;
  const target = loader(module.file, via.from);
  return target !== null && target.file.startsWith(DRAWN_FROM_PURE_STATE.PURE_DIRECTORY);
}

/**
 * Does the value of `node` come, however indirectly, from a call to the pure
 * constructor?
 *
 * The same walk `readsPlatformSearch` does, with "a `location.search` read"
 * swapped for "a call to a name imported from the pure directory". Written as
 * its own function rather than as a parameterised one because the two ask
 * different questions of the leaf — one about a property access, one about a
 * call whose callee has to be resolved through the import map — and a shared
 * skeleton with two predicates hanging off it reads worse than two short walks.
 */
function tracesToPureState(
  node: ts.Node,
  module: Module,
  loader: Loader,
  depth = 0,
  seen: Set<string> = new Set(),
): boolean {
  if (depth > DRAWN_FROM_PURE_STATE.MAX_DEPTH) return false;
  const locals = declarationsIn(module.ast);
  const imported = importsIn(module.ast);
  let found = false;
  const visit = (child: ts.Node): void => {
    if (found) return;
    if (
      ts.isCallExpression(child) &&
      ts.isIdentifier(child.expression) &&
      isPureConstructorImport(module, child.expression.text, loader)
    ) {
      found = true;
      return;
    }
    if (ts.isIdentifier(child)) {
      const key = `${module.file}#${child.text}`;
      if (!seen.has(key)) {
        seen.add(key);
        const local = locals.get(child.text);
        if (local !== undefined) {
          if (tracesToPureState(local, module, loader, depth + 1, seen)) found = true;
          return;
        }
        const via = imported.get(child.text);
        if (via !== undefined) {
          const next = loader(module.file, via.from);
          const target = next === null ? undefined : declarationsIn(next.ast).get(via.as);
          if (next !== null && target !== undefined) {
            if (tracesToPureState(target, next, loader, depth + 1, seen)) found = true;
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

/** One element the floor draws that carries a reading. */
interface DrawnReading {
  /** The testID as written, for the failure text. */
  readonly testID: string;
  /** The value expression as written, so a failure names what was drawn instead. */
  readonly expression: string;
  /**
   * The property names the value expression reads, in source order.
   *
   * `{readings.gymBucks}` gives `['gymBucks']`. Structural rather than a
   * substring match on the expression text, so `pendingGymBucks` is its own
   * field and not a sighting of `gymBucks`. It is what lets the check below ask
   * the other direction — is any field of the floor computed and painted
   * nowhere — which a pinned list of rows on its own does not answer.
   */
  readonly fields: readonly string[];
  /** Does that expression trace to the pure constructor? */
  readonly fromPureState: boolean;
}

/**
 * One layer of quotes or JSX braces off, whitespace flattened.
 *
 * `getText` on a JSX attribute's initializer hands back `"empire-stat-rep"` for
 * a string and `{readings.reputation}` for an expression, so a pinned row would
 * otherwise be written with the delimiters in it and read worse for no gain.
 * Flattening whitespace is what stops a reformat of a wrapped `<Stat …>` from
 * reddening a pin about which field it draws — a spurious red is its own defect
 * and this is the one place it was cheap to remove.
 */
function unwrapped(text: string): string {
  const flattened = text.split(/\s+/).join(' ').trim();
  const stripped = /^\{[\s\S]*\}$/.test(flattened)
    ? flattened.slice(1, -1)
    : /^"[\s\S]*"$/.test(flattened) || /^'[\s\S]*'$/.test(flattened)
      ? flattened.slice(1, -1)
      : flattened;
  return stripped.trim();
}

/** A row as `<testID> <- <value expression>`, which is the unit `ROWS` pins. */
function rowPairing(reading: DrawnReading): string {
  return `${unwrapped(reading.testID)} <- ${unwrapped(reading.expression)}`;
}

/** Every property name read anywhere inside a value expression. */
function fieldsRead(node: ts.Node, ast: ts.SourceFile): string[] {
  const names: string[] = [];
  const visit = (child: ts.Node): void => {
    if (ts.isPropertyAccessExpression(child)) names.push(child.name.getText(ast));
    ts.forEachChild(child, visit);
  };
  visit(node);
  return names;
}

/**
 * Every drawn reading in a module: an element given BOTH a testID and a value.
 *
 * That pair is what makes an element a reading rather than chrome. The stats
 * container carries a testID and no value; the label is a `label` attribute and
 * not a `value`; the title and the lead are neither. So the set discovered is
 * the rows, and a fifth row inherits the check by being a row.
 */
function drawnReadingsIn(module: Module, loader: Loader): readonly DrawnReading[] {
  const readings: DrawnReading[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      let testID: string | null = null;
      let value: ts.Node | null = null;
      for (const attribute of node.attributes.properties) {
        if (!ts.isJsxAttribute(attribute)) continue;
        const name = attribute.name.getText(module.ast);
        const initializer = attribute.initializer;
        if (initializer === undefined) continue;
        if (name === DRAWN_FROM_PURE_STATE.TEST_ID_PROP) testID = initializer.getText(module.ast);
        if (name === DRAWN_FROM_PURE_STATE.VALUE_PROP) value = initializer;
      }
      if (testID !== null && value !== null) {
        readings.push({
          testID,
          expression: value.getText(module.ast),
          fields: fieldsRead(value, module.ast),
          fromPureState: tracesToPureState(value, module, loader),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(module.ast);
  return readings;
}

/**
 * Does `file` import from the pure directory, directly or through shell modules?
 *
 * TRANSITIVE, AND THAT IS NOT A LOOSENING. `EmpireScreen.tsx` used to import
 * `createEmpireState` itself; it now imports `empireFloor.ts`, which is where
 * the schedule and the `stepGym` calls live because CLAUDE.md forbids game math
 * in a `.tsx`. A direct-import census would have gone red on a change that made
 * the split BETTER, and the obvious repair — deleting the census — is the one
 * this codebase keeps recording as the way a guard dies.
 *
 * The walk is bounded to `src/shell/` on purpose rather than by a depth
 * counter: the question is "does this screen reach GDD §5", and the only route
 * from a shell screen to `src/empire/` is through the shell's own modules. A
 * whole-graph closure would parse most of the tree per screen and would answer a
 * question nobody asked.
 */
function reachesPureState(module: Module, loader: Loader, seen: Set<string> = new Set()): boolean {
  if (seen.has(module.file)) return false;
  seen.add(module.file);
  for (const via of importsIn(module.ast).values()) {
    const target = loader(module.file, via.from);
    if (target === null) continue;
    if (target.file.startsWith(DRAWN_FROM_PURE_STATE.PURE_DIRECTORY)) return true;
    if (!target.file.startsWith(`${SHELL_DIRECTORY}/`)) continue;
    if (reachesPureState(target, loader, seen)) return true;
  }
  return false;
}

/** The one directory the census walks through on its way to `src/empire/`. */
const SHELL_DIRECTORY = 'src/shell';

/** The screens the shell mounts that reach into the pure directory at all. */
function screensReadingPureState(): readonly string[] {
  const files = [...new Set(shellScreens().map((mount) => mount.file))];
  return files.filter((file) => reachesPureState(parseModule(file, source(file)), loadFromDisk)).sort();
}

describe('the numbers on GDD §5’s floor come from GDD §5’s own module', () => {
  /**
   * A loader carrying one fake pure module and one fake chrome module, so both
   * verdicts can be driven without inventing files in the tree. The chrome
   * module is the one that matters: it is the shape the mutation took.
   */
  const fixtureLoader: Loader = (_from, specifier) => {
    if (specifier.includes('empireCore')) {
      return parseModule(
        'src/empire/empireCore.ts',
        'export function createEmpireState() { return { gymBucks: 0 }; }',
      );
    }
    if (specifier.includes('shellTuning')) {
      return parseModule(
        'src/shell/shellTuning.ts',
        "export const SHELL_COPY = Object.freeze({ EMPIRE_BUCKS: '0' });",
      );
    }
    return null;
  };

  const verdictFor = (text: string): DrawnReading | undefined =>
    drawnReadingsIn(parseModule('src/shell/Fixture.tsx', text), fixtureLoader)[0];

  const IMPORTS_PURE = "import { createEmpireState } from '../empire/empireCore';\n";
  const IMPORTS_CHROME = "import { SHELL_COPY } from './shellTuning';\n";

  it('CONTROL: the tracer sees the provenance, and sees it go missing', () => {
    // A scan that has stopped matching agrees with every file it is pointed at,
    // so both halves are written out. The rejections are the half that matters:
    // every one of them is a floor that renders identically to the real one.
    const passes = [
      // What the screen does today: the hook's state, destructured, stringified.
      `${IMPORTS_PURE}const [state] = useState(() => createEmpireState());\n` +
        `const a = <Stat testID="empire-stat-bucks" value={String(state.gymBucks)} />;`,
      // Read straight off the call, no hook in between.
      `${IMPORTS_PURE}const a = <Stat testID="s" value={createEmpireState().axes.equipment} />;`,
      // Through a second name, which is the restructure a regex would break on.
      `${IMPORTS_PURE}const gym = createEmpireState();\nconst shown = String(gym.gymBucks);\n` +
        `const a = <Stat testID="s" value={shown} />;`,
      // Imported under a different local name.
      `import { createEmpireState as openingGym } from '../empire/empireCore';\n` +
        `const a = <Stat testID="s" value={String(openingGym().gymBucks)} />;`,
    ];
    for (const text of passes) {
      expect(verdictFor(text)?.fromPureState, text).toBe(true);
    }

    const failures = [
      // THE MUTATION, in the shape a critic actually planted it: the import is
      // gone and the row draws chrome copy. `tsc` is clean and the DOM is
      // identical.
      `${IMPORTS_CHROME}const a = <Stat testID="empire-stat-bucks" value={SHELL_COPY.EMPIRE_BUCKS} />;`,
      // The bare literal, which is what a mock-up looks like.
      `${IMPORTS_PURE}const a = <Stat testID="s" value={'0'} />;`,
      // THE LOCAL SHIM. Right spelling, no import edge — the exact shape that
      // walked past `progression.ts`'s seal check when it matched by text.
      `function createEmpireState() { return { gymBucks: 0 }; }\n` +
        `const a = <Stat testID="s" value={String(createEmpireState().gymBucks)} />;`,
      // Imported from somewhere that is not the pure directory.
      `import { createEmpireState } from './shellTuning';\n` +
        `const a = <Stat testID="s" value={String(createEmpireState().gymBucks)} />;`,
      // The constructor is imported and called, and its result goes SOMEWHERE
      // ELSE — the shape a "does the file mention createEmpireState" scan passes.
      `${IMPORTS_PURE}${IMPORTS_CHROME}const unused = createEmpireState();\n` +
        `const a = <Stat testID="s" value={SHELL_COPY.EMPIRE_BUCKS} />;`,
    ];
    for (const text of failures) {
      expect(verdictFor(text)?.fromPureState, text).toBe(false);
    }

    // ...and the row finder itself can come back empty, so "no readings" is
    // distinguishable from "a reading with nothing behind it". A testID with no
    // value is chrome (the stats container); a value with no testID is not a row
    // this file can name in a failure.
    for (const notARow of [
      `${IMPORTS_PURE}const a = <View testID="empire-stats">{null}</View>;`,
      `${IMPORTS_PURE}const a = <Stat value={String(createEmpireState().gymBucks)} />;`,
    ]) {
      expect(drawnReadingsIn(parseModule('src/shell/Fixture.tsx', notARow), fixtureLoader)).toEqual(
        [],
      );
    }
  });

  it('EVERY reading the floor draws traces to the pure constructor, not to chrome copy [every-drawn-empire-reading-comes-from-the-pure-state]', () => {
    const file = DRAWN_FROM_PURE_STATE.SCREEN_FILE;
    const readings = drawnReadingsIn(parseModule(file, source(file)), loadFromDisk);

    // THE ASSERTION THE HARDCODING MUTATION REDDENS. Nothing here reads a
    // rendered NUMBER: every field on this floor is a constant of the
    // constructor, so the number is the same either way and only where it came
    // from can tell the two apart.
    const unbound = readings
      .filter((reading) => !reading.fromPureState)
      .map(
        (reading) =>
          `${file} draws ${reading.testID} from ${reading.expression}, which does not trace to ` +
          `${DRAWN_FROM_PURE_STATE.CONSTRUCTOR}() imported from ${DRAWN_FROM_PURE_STATE.PURE_DIRECTORY} — ` +
          'so that row is a hardcoded mock-up of GDD §5 and every value assertion in the tree would still pass',
      );
    expect(unbound, unbound.join('\n')).toEqual([]);

    // A COUNT PIN LIVED HERE — `readings.length` against
    // `DRAWN_FROM_PURE_STATE.READINGS`, 6 — AND IT IS DELETED, with the
    // domination recorded rather than the check quietly removed. The pairing
    // test directly below pins the multiset of rows against a six-entry list,
    // so `readings.length === 6` is implied by it in every state of the
    // subject: no discovery can move the count while agreeing with the list.
    // Same shape as the two deletions already recorded in this file and in
    // `empireFloor.test.ts`, and it was compared symbolically rather than by
    // eye — one signature is built per element of `readings`, so the pinned
    // list's length IS this count.
    //
    // WHAT THE DELETION COSTS, said plainly because it is a real cost. The
    // filter above is empty when the discovery finds nothing, so this
    // assertion no longer carries its own non-vacuity: a scan that stopped
    // matching passes it. What reports an empty discovery is the pairing test
    // below — same file, same describe block, same `drawnReadingsIn` call —
    // which goes red with `expected [] to deeply equal [ …(6) ]`. Two adjacent
    // tests, one guard between them, and this comment is where a reader is
    // told which one holds it.
  });

  it('each row draws the reading its label names [each-empire-row-draws-the-reading-its-label-names]', () => {
    // THE ASSERTION THE ROW-SWAP MUTANT REDDENS, and the one whose absence let
    // that mutant sit green through a whole round. Provenance says a value came
    // out of the gym; this says which field of the gym it is. Both directions
    // in one comparison: a row drawing a different field is an entry the pin
    // does not have AND an entry it has that the screen no longer draws, so a
    // permutation of two rows fails twice over rather than cancelling out.
    //
    // SORTED, so the order the rows appear in the JSX is deliberately not
    // pinned. Moving the REPUTATION row above the ROSTER row is a layout
    // change with no reading behind it, and a pin that reddens on it would be
    // friction with nothing behind it either. The cost is stated rather than
    // implied: swapping two rows WHOLE — label, testID and value together — is
    // invisible here, and what would see it is a screen-order check nothing in
    // this tree makes.
    const file = DRAWN_FROM_PURE_STATE.SCREEN_FILE;
    const readings = drawnReadingsIn(parseModule(file, source(file)), loadFromDisk);
    const drawn = readings.map(rowPairing).sort();
    const pinned = [...DRAWN_FROM_PURE_STATE.ROWS].sort();
    const report =
      `${file} pairs its rows with its readings as:\n  ${drawn.join('\n  ')}\n` +
      `and DRAWN_FROM_PURE_STATE.ROWS says:\n  ${pinned.join('\n  ')}`;

    expect(drawn, report).toEqual(pinned);
  });

  it('and no reading the floor computes is painted nowhere', () => {
    // THE OTHER DIRECTION, AND IT IS NOT THE PIN ABOVE RESTATED. That list is
    // text this file holds; this compares the screen against the live shape of
    // `EmpireFloorReadings`, so a seventh field added to the floor and drawn by
    // no row is red here and green there. Symbolically: the pin above fixes the
    // six rows and says nothing about how many fields the module produces, and
    // this fixes the two sets equal and says nothing about which row holds
    // which — a permutation passes here and fails above.
    //
    // NOT REACHED BY `empireFloor.test.ts`'s scope guard either, which was the
    // other domination candidate. That one pins the readings' keys against the
    // walk's own classification lists, so a field added to both stays green
    // there while it is painted nowhere and red here.
    const file = DRAWN_FROM_PURE_STATE.SCREEN_FILE;
    const readings = drawnReadingsIn(parseModule(file, source(file)), loadFromDisk);
    const painted = [...new Set(readings.flatMap((reading) => reading.fields))].sort();
    const produced = Object.keys(empireFloorReadings(openEmpireFloor(0))).sort();
    const report =
      `${file} paints the fields ${painted.join(', ') || '(none)'} and empireFloorReadings ` +
      `produces ${produced.join(', ') || '(none)'} — a field on one side and not the other is ` +
      'either a reading computed on every refresh and painted nowhere, or a row reading ' +
      'something the floor does not produce';

    expect(painted, report).toEqual(produced);
  });

  it('and it is the ONLY screen the shell mounts that reaches into the pure module', () => {
    // The census that keeps `SCREEN_FILE` above from being a list somebody has to
    // remember. Read off `AppShell.tsx`'s own JSX, so a second surface drawing
    // §5 state is announced here rather than absorbed — and so the mutation that
    // removes the import edge altogether reddens on the way in as well as on the
    // rows.
    const reaching = screensReadingPureState();
    expect(
      reaching,
      `${reaching.length} of the shell's mounted screens import from ${DRAWN_FROM_PURE_STATE.PURE_DIRECTORY}: ` +
        `${reaching.join(', ') || 'none'}`,
    ).toEqual([DRAWN_FROM_PURE_STATE.SCREEN_FILE]);
    // A COUNT PIN WAS WRITTEN HERE AND DELETED, and the domination is recorded
    // rather than the check quietly removed. `toEqual([SCREEN_FILE])` fixes the
    // list exactly, so `reaching.length === 1` is implied by it in every state
    // of the subject — no version of the tree reddens the count while the
    // equality passes. That is the exact shape `guaranteeTags.test.ts` already
    // had to delete once, one file over. The equality IS the census.
  });

  it('CONTROL: the census walker follows a shell hop, and stops when the hop is cut', () => {
    // The census above went from a DIRECT import test to a transitive one when
    // the `stepGym` calls moved out of the `.tsx` and into `empireFloor.ts`. A
    // walker that answered "yes" to everything would agree with the tree just as
    // happily, so both verdicts are driven here on fixtures.
    const screen = (body: string): Module => parseModule('src/shell/Fixture.tsx', body);
    const withHop =
      (adapterBody: string): Loader =>
      (_from, specifier) => {
        if (specifier.includes('adapter')) return parseModule('src/shell/adapter.ts', adapterBody);
        if (specifier.includes('empireCore')) {
          return parseModule('src/empire/empireCore.ts', 'export function createEmpireState() {}');
        }
        if (specifier.includes('shellTuning')) {
          return parseModule('src/shell/shellTuning.ts', 'export const SHELL_COPY = {};');
        }
        return null;
      };
    const REACHES = "import { createEmpireState } from '../empire/empireCore';\nexport const a = 1;";
    const DOES_NOT = "import { SHELL_COPY } from './shellTuning';\nexport const a = 1;";

    // One hop: screen -> shell adapter -> src/empire/.
    expect(
      reachesPureState(screen("import { a } from './adapter';"), withHop(REACHES)),
      'a screen reaching §5 through one shell module',
    ).toBe(true);
    // The same screen when the adapter stops reaching — which is the mutation
    // that would make the floor a mock-up without touching the screen at all.
    expect(
      reachesPureState(screen("import { a } from './adapter';"), withHop(DOES_NOT)),
      'the same screen when the adapter no longer reaches §5',
    ).toBe(false);
    // ...and it still sees a direct import, which is the shape every other
    // screen in the shell would take.
    expect(reachesPureState(screen(REACHES), withHop(DOES_NOT))).toBe(true);
    // A cycle between two shell modules terminates rather than hanging.
    const cyclic: Loader = (from) =>
      from === 'src/shell/a.ts'
        ? parseModule('src/shell/b.ts', "import { x } from './a';")
        : parseModule('src/shell/a.ts', "import { x } from './b';");
    expect(reachesPureState(parseModule('src/shell/a.ts', "import { x } from './b';"), cyclic)).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// THE EMPIRE ROUND TRIP DOES NOT SPEND THE PLAYER'S SESSION
// ---------------------------------------------------------------------------

/**
 * ===========================================================================
 * THE DEFECT THESE PIN, WHICH WAS PHOTOGRAPHED BEFORE IT WAS FIXED
 * ===========================================================================
 * Played, no query string: three check-in answers reach GDD §3.2's briefing,
 * GYM EMPIRE opens the floor, BACK TO TRAINING lands on the CHECK-IN with all
 * three answers blank. `AppShell` picked one surface out of a ternary, so
 * `SessionScreen` un-mounted and its client state died with it.
 * `.gauntlet/shots/shell/17-` and `18-` are the before.
 *
 * WHAT A NODE TEST CAN AND CANNOT SAY ABOUT THAT. `vitest.config.ts` is
 * `environment: node` and mounts no component, so nothing here can watch a
 * beat survive a press — that is `tools/verify-shell-route.mjs`'s section 10b,
 * which reads the beat on BOTH sides of the round trip in a real browser. What
 * these pin is the STRUCTURE the fix is made of, and specifically the two
 * places it could be undone by an edit that looks like tidying: re-mounting the
 * session, or nulling the beat of a surface that never went away.
 */
describe('the Empire round trip keeps both of its surfaces', () => {
  /**
   * =========================================================================
   * TWO PINS IN HERE WERE BLIND ON THE ONE AXIS THEIR SENTENCES ADVERTISED
   * =========================================================================
   * Both ran over `SHELL`, which is `codeOnly(...)`, and `codeOnly` replaces
   * every string literal with `''`. A pin whose subject IS a surface name
   * therefore matched any surface name, and each of these bypasses left
   * `npx vitest run src/shell` at `Test Files 3 passed / Tests 117 passed`:
   *
   *   - `active={route.surface === 'empire'}` -> `'meet'`. The floor is mounted
   *     and never told it is the surface on screen, so `EmpireScreen`'s two
   *     effects early-return, `empirePhase` stays null, both affordance
   *     functions return null, the nav slot draws nothing, and the player is
   *     stranded on the floor for the rest of the app run.
   *   - `const empireMounted = route.surface === 'empire' || false;`. The whole
   *     persistence mechanism is gone — `PERSISTENT_SURFACES` and
   *     `isPersistentSurface` stay defined and are read by nothing — and the
   *     old pattern stopped at the `||`, so it never looked at what was on the
   *     other side of it.
   *
   * So both read the RAW source, the way `navigate(current, 'open-empire')` is
   * read further up this file: the surface name is a string literal, and a scan
   * that blanks string literals cannot be the scan that checks one. The
   * `empireMounted` pattern also reaches PAST the `||` to the rest of the
   * condition, because the half it did not read was the mechanism.
   *
   * They are MATCH COUNTS rather than presence, which is this codebase's own
   * answer to a textual pin with more than one witness: `route.surface ===
   * 'empire'` appears five times in `AppShell.tsx` and a looser pattern would
   * have four other places to be satisfied by.
   *
   * `sessionMounted`'s pin two lines down is deliberately left on `SHELL`. Its
   * mechanism is `isPersistentSurface(route.surface)` — identifiers, not
   * strings — so `codeOnly` leaves it intact and it reddens on the matching
   * mutation today. It is the shape these two were repaired to match.
   */
  const APP_SHELL_RAW = source('src/shell/AppShell.tsx');

  /**
   * The shell's own mount flag for GDD §5's floor, whole.
   *
   * Written as a source string rather than a literal regex so the same pattern
   * can be asked for a match COUNT against the real file and driven as a
   * predicate against a fixture, without a `g` flag's `lastIndex` making the
   * second answer depend on the first.
   */
  const EMPIRE_MOUNTED_PIN = String.raw`const empireMounted =\s*route\.surface === 'empire'\s*\|\|\s*\(isPersistentSurface\('empire'\)\s*&&\s*empireOpened\);`;

  /** The Career surface's mount flag, whole, for the same reasons. */
  const CAREER_MOUNTED_PIN = String.raw`const careerMounted =\s*route\.surface === 'career'\s*\|\|\s*\(isPersistentSurface\('career'\)\s*&&\s*careerOpened\);`;

  /** The My Lifter surface's mount flag, whole, for the same reasons. */
  const LIFTER_MOUNTED_PIN = String.raw`const lifterMounted =\s*route\.surface === 'lifter'\s*\|\|\s*\(isPersistentSurface\('lifter'\)\s*&&\s*lifterOpened\);`;

  /** The one place the shell tells the floor which surface is on screen. */
  const ACTIVE_SURFACE_PIN = String.raw`active=\{route\.surface === 'empire'\}`;

  /** ...and the one place it tells the Career surface. */
  const CAREER_ACTIVE_PIN = String.raw`active=\{route\.surface === 'career'\}`;

  /** ...and the one place it tells My Lifter. */
  const LIFTER_ACTIVE_PIN = String.raw`active=\{route\.surface === 'lifter'\}`;

  /** How many times a pattern occurs in a text. */
  const occurrences = (pattern: string, text: string): number =>
    (text.match(new RegExp(pattern, 'g')) ?? []).length;

  /** Whether a pattern occurs at all, with no shared `lastIndex`. */
  const occursIn = (pattern: string, text: string): boolean => new RegExp(pattern).test(text);

  /** The body of a named `useCallback` in `AppShell.tsx`, comments and strings kept. */
  const bodyOfCallback = (name: string): string => {
    const text = source('src/shell/AppShell.tsx');
    const start = text.indexOf(`const ${name} = useCallback(`);
    if (start < 0) return '';
    const end = text.indexOf('}, []);', start);
    return end < 0 ? '' : text.slice(start, end);
  };

  it('CONTROL: the callback reader finds a body, and reports a missing one as missing', () => {
    expect(bodyOfCallback('leaveMeet')).toMatch(/navigate\(current, 'leave-meet'\)/);
    expect(bodyOfCallback('noSuchCallback')).toBe('');
  });

  it('mounts every persistent surface and hides the one that is not on screen', () => {
    // `display: 'none'` and not opacity, and the difference is measured rather
    // than stylistic: `tools/verify-shell-route.mjs` documents at length that
    // `isVisible()` and `elementFromPoint` both HIT a fully transparent element,
    // so a surface hidden by opacity would still read as on screen and would
    // still take a thumb. The mounted-but-hidden wrapper is the only new thing
    // between the player and the screen, so it is the thing pinned.
    expect(SHELL).toMatch(/styles\.hiddenSurface/);
    expect(source('src/shell/AppShell.tsx')).toMatch(/hiddenSurface: \{\s*display: 'none',/);
    expect(SHELL).not.toMatch(/hiddenSurface: \{\s*opacity: 0/);
    // Both persistent surfaces are behind a mount flag rather than an arm of the
    // surface ternary. `sessionMounted` reads `isPersistentSurface`, so removing
    // a surface from that list really does un-mount it.
    expect(SHELL).toMatch(/const sessionMounted =\s*isPersistentSurface\(route\.surface\)/);
    // ...and the floor's flag is read WHOLE, off the raw file. See this block's
    // header: the old pattern stopped at the `||` and ran over `codeOnly`, so
    // `route.surface === 'empire' || false` — the edit that deletes persistence
    // outright — satisfied it.
    expect(
      occurrences(EMPIRE_MOUNTED_PIN, APP_SHELL_RAW),
      'AppShell.tsx no longer mounts GDD §5’s floor off `isPersistentSurface` and `empireOpened`',
    ).toBe(1);
    expect(
      occurrences(CAREER_MOUNTED_PIN, APP_SHELL_RAW),
      'AppShell.tsx no longer mounts the Career surface off `isPersistentSurface` and `careerOpened`',
    ).toBe(1);
    expect(
      occurrences(LIFTER_MOUNTED_PIN, APP_SHELL_RAW),
      'AppShell.tsx no longer mounts My Lifter off `isPersistentSurface` and `lifterOpened`',
    ).toBe(1);
    expect(PERSISTENT_SURFACES).toEqual(['session', 'empire', 'career', 'lifter']);
  });

  it('CONTROL: the Career mount-flag pin bites on the same two axes as Empire’s', () => {
    // The same two bypasses the Empire pin was rewritten for, driven against
    // the career copy of it rather than assumed to transfer: the `|| false`
    // edit that deletes persistence outright, and the surface-literal swap
    // `codeOnly` cannot see.
    const shipped =
      "  const careerMounted =\n    route.surface === 'career' || (isPersistentSurface('career') && careerOpened);";
    expect(occursIn(CAREER_MOUNTED_PIN, shipped)).toBe(true);
    expect(
      occursIn(CAREER_MOUNTED_PIN, "  const careerMounted =\n    route.surface === 'career' || false;"),
    ).toBe(false);
    expect(
      occursIn(
        CAREER_MOUNTED_PIN,
        "  const careerMounted =\n    route.surface === 'meet' || (isPersistentSurface('career') && careerOpened);",
      ),
    ).toBe(false);
  });

  it('CONTROL: the Lifter mount-flag pin bites on the same two axes as Career’s', () => {
    const shipped =
      "  const lifterMounted =\n    route.surface === 'lifter' || (isPersistentSurface('lifter') && lifterOpened);";
    expect(occursIn(LIFTER_MOUNTED_PIN, shipped)).toBe(true);
    expect(
      occursIn(LIFTER_MOUNTED_PIN, "  const lifterMounted =\n    route.surface === 'lifter' || false;"),
    ).toBe(false);
    expect(
      occursIn(
        LIFTER_MOUNTED_PIN,
        "  const lifterMounted =\n    route.surface === 'meet' || (isPersistentSurface('lifter') && lifterOpened);",
      ),
    ).toBe(false);
  });

  it('CONTROL: the mount-flag pin reads the half of the condition that IS the mechanism', () => {
    // BOTH WAYS, ON THE AXIS THE CLAIM ADVERTISES. The shipped text matches; the
    // two edits that broke the old pattern do not. `|| false` is the bypass this
    // pin was rewritten for, and the surface swap is the other half of the same
    // blindness — a pattern over `codeOnly` could not tell 'empire' from 'meet'.
    const shipped =
      "  const empireMounted =\n    route.surface === 'empire' || (isPersistentSurface('empire') && empireOpened);";
    expect(occursIn(EMPIRE_MOUNTED_PIN, shipped)).toBe(true);
    expect(
      occursIn(EMPIRE_MOUNTED_PIN, "  const empireMounted =\n    route.surface === 'empire' || false;"),
    ).toBe(false);
    expect(
      occursIn(
        EMPIRE_MOUNTED_PIN,
        "  const empireMounted =\n    route.surface === 'meet' || (isPersistentSurface('empire') && empireOpened);",
      ),
    ).toBe(false);
    // ...and the blindness itself, reproduced, so the reason for reading raw is
    // a measurement in this file rather than a sentence in its header: through
    // `codeOnly` the shipped text and the surface swap are the same string.
    expect(codeOnly(shipped)).toBe(
      codeOnly(
        "  const empireMounted =\n    route.surface === 'meet' || (isPersistentSurface('empire') && empireOpened);",
      ),
    );
  });

  it('does not forget the beat of a surface that never un-mounted', () => {
    // THE ONE-LINE REGRESSION THIS EXISTS FOR. `leaveEmpire` used to null the
    // session's phase, copying its sibling `leaveMeet`. With the session now
    // persistent that is not tidying, it is a strand: the screen has no reason to
    // re-report, `shellAffordanceFor` draws nothing for a null beat, and the
    // player lands back on their briefing with no pill to anywhere.
    expect(forgetsBeatOnArrival('session')).toBe(false);
    expect(bodyOfCallback('leaveEmpire')).not.toMatch(/setSessionPhase\(null\)/);
    // `leaveCareer` returns to the same never-unmounted session, so the same
    // one-line regression is banned there too.
    expect(bodyOfCallback('leaveCareer')).not.toMatch(/setSessionPhase\(null\)/);
    expect(bodyOfCallback('leaveLifter')).not.toMatch(/setSessionPhase\(null\)/);
    // ...and the sibling that DOES re-mount still forgets, so the assertion above
    // is about persistence rather than about `leaveEmpire` having been emptied.
    expect(bodyOfCallback('leaveMeet')).toMatch(/setSessionPhase\(null\)/);
  });

  it('a persistent surface whose beat IS forgotten re-reports when it becomes active', () => {
    // The pairing that keeps the rule above from being a special case somebody
    // has to remember. Empire is forgotten on the way in — its beat list has one
    // member, so a stale 'floor' is harmless, but the shell forgets uniformly —
    // and that is only safe because `EmpireScreen` re-reports: `active` is in the
    // dependency list of the effect that calls `onPhase`. Delete `active` from
    // that list and a second visit to the floor has no way off it.
    expect(forgetsBeatOnArrival('empire')).toBe(true);
    expect(isPersistentSurface('empire')).toBe(true);
    expect(bodyOfCallback('openEmpire')).toMatch(/setEmpirePhase\(null\)/);
    const empireScreen = codeOnly(source('src/shell/EmpireScreen.tsx'));
    expect(empireScreen).toMatch(/onPhase\?\.\(''\);\s*\}, \[onPhase, active\]\);/);
    // CONTROL FOR THE LINE DIRECTLY ABOVE, and for that line only: the scan can
    // see the dependency go missing. It used to sit at the bottom of this test,
    // below the `active=` claim, where it read as that claim's control and
    // probed a different axis entirely — which is exactly why the `active=`
    // claim went four rounds unable to see a surface swap.
    expect(codeOnly('onPhase?.("floor");\n  }, [onPhase]);')).not.toMatch(
      /onPhase\?\.\(''\);\s*\}, \[onPhase, active\]\);/,
    );
    // ...and the shell really does tell it which surface is up. RAW, and a
    // count: `route.surface === 'empire'` occurs five times in that file, and
    // through `codeOnly` this pattern could not tell which surface it had found.
    expect(
      occurrences(ACTIVE_SURFACE_PIN, APP_SHELL_RAW),
      'AppShell.tsx no longer hands EmpireScreen `active` off the Empire surface',
    ).toBe(1);
    // CONTROL FOR THE LINE DIRECTLY ABOVE, ON ITS OWN AXIS: a surface-literal
    // swap. Driven both ways, because a pattern that matches nothing and a
    // pattern that matches everything both look green from one direction.
    const activeShipped = "<EmpireScreen onPhase={setEmpirePhase} active={route.surface === 'empire'} />";
    const activeSwapped = "<EmpireScreen onPhase={setEmpirePhase} active={route.surface === 'meet'} />";
    expect(occursIn(ACTIVE_SURFACE_PIN, activeShipped)).toBe(true);
    expect(occursIn(ACTIVE_SURFACE_PIN, activeSwapped)).toBe(false);
    // ...and the blindness, reproduced: through `codeOnly` those two lines are
    // the same string, which is what the old pin was reading.
    expect(codeOnly(activeShipped)).toBe(codeOnly(activeSwapped));
  });

  it('the Career surface re-reports on activation, and the shell tells it which surface is up', () => {
    // The same pairing as Empire's, on the surface that joined the persistent
    // list with Sprint 1b: Career is forgotten on the way in, so a second
    // visit has no beat until the screen re-reports — `active` and the phase
    // are both in the effect's dependency list, and losing either strands the
    // player on a surface whose only exit is the pill that never comes back.
    expect(forgetsBeatOnArrival('career')).toBe(true);
    expect(isPersistentSurface('career')).toBe(true);
    expect(bodyOfCallback('openCareer')).toMatch(/setCareerPhase\(null\)/);
    const careerScreen = codeOnly(source('src/meet/CareerScreen.tsx'));
    expect(careerScreen).toMatch(/onPhase\?\.\(loop\.phase\);\s*\}, \[onPhase, active, loop\.phase\]\);/);
    // CONTROL, both ways: the scan sees the dependency go missing.
    expect(codeOnly('onPhase?.(loop.phase);\n  }, [onPhase, loop.phase]);')).not.toMatch(
      /onPhase\?\.\(loop\.phase\);\s*\}, \[onPhase, active, loop\.phase\]\);/,
    );
    // ...and the shell hands it `active` off the CAREER surface, raw and
    // counted, because through `codeOnly` a surface swap is invisible.
    expect(
      occurrences(CAREER_ACTIVE_PIN, APP_SHELL_RAW),
      'AppShell.tsx no longer hands CareerScreen `active` off the Career surface',
    ).toBe(1);
    const activeShipped = "<CareerScreen serverPort={appCareerPort()} onPhase={setCareerPhase} active={route.surface === 'career'} />";
    const activeSwapped = "<CareerScreen serverPort={appCareerPort()} onPhase={setCareerPhase} active={route.surface === 'empire'} />";
    expect(occursIn(CAREER_ACTIVE_PIN, activeShipped)).toBe(true);
    expect(occursIn(CAREER_ACTIVE_PIN, activeSwapped)).toBe(false);
    // The hook really does re-read the row on activation — the persistence
    // trade `PERSISTENT_SURFACES` records for this surface. `openingCache` is
    // an identifier, so `codeOnly` keeps it.
    const useCareerCode = codeOnly(source('src/meet/useCareer.ts'));
    expect(useCareerCode).toMatch(/if \(!active\) return;/);
    expect(useCareerCode).toMatch(
      /setCache\(\(current\) => \(current\.status === '' \? current : openingCache\(port\)\)\);/,
    );
  });

  it('the Lifter surface re-reports on activation, and the shell tells it which surface is up', () => {
    expect(forgetsBeatOnArrival('lifter')).toBe(true);
    expect(isPersistentSurface('lifter')).toBe(true);
    expect(bodyOfCallback('openLifter')).toMatch(/setLifterPhase\(null\)/);
    const lifterScreen = codeOnly(source('src/meet/LifterScreen.tsx'));
    expect(lifterScreen).toMatch(/onPhase\?\.\(loop\.phase\);\s*\}, \[onPhase, active, loop\.phase\]\);/);
    expect(
      occurrences(LIFTER_ACTIVE_PIN, APP_SHELL_RAW),
      'AppShell.tsx no longer hands LifterScreen `active` off the Lifter surface',
    ).toBe(1);
    const activeShipped =
      "<LifterScreen serverPort={appLifterPort()} onPhase={setLifterPhase} active={route.surface === 'lifter'} />";
    const activeSwapped =
      "<LifterScreen serverPort={appLifterPort()} onPhase={setLifterPhase} active={route.surface === 'career'} />";
    expect(occursIn(LIFTER_ACTIVE_PIN, activeShipped)).toBe(true);
    expect(occursIn(LIFTER_ACTIVE_PIN, activeSwapped)).toBe(false);
    const useLifterCode = codeOnly(source('src/meet/useLifter.ts'));
    expect(useLifterCode).toMatch(/if \(!active\) return;/);
    expect(useLifterCode).toMatch(/openingCache\(port\)/);
    expect(useLifterCode).not.toMatch(/localSessionServer/);
  });

  it('the floor stops its clock while nobody is looking, and catches up when they are', () => {
    // Not an optimisation this file cares about for its own sake: a timer left
    // running behind a hidden surface is a re-render per tick for nothing, and a
    // floor that did NOT catch up on the way back would draw a stale reading —
    // which is the same class of defect as the beat this block is about.
    const empireScreen = codeOnly(source('src/shell/EmpireScreen.tsx'));
    expect(empireScreen).toMatch(/if \(!active\) return undefined;/);
    expect(empireScreen).toMatch(/setInterval\(/);
    expect(empireScreen).toMatch(/clearInterval\(timer\)/);
    // The catch-up: the floor is advanced once on activation, before the timer.
    expect(
      empireScreen.match(/advanceEmpireFloor\(current, Date\.now\(\)\)/g)?.length,
      'the floor is advanced on activation AND on every tick',
    ).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// THE FILES THE SHELL'S §12.3 SCANS RUN OVER — DISCOVERED, FOR THE SAME REASON
// ---------------------------------------------------------------------------

/**
 * ===========================================================================
 * A REFUSAL CONDITION ENFORCED OVER A HAND-WRITTEN FILE LIST NARROWS IN SILENCE
 * ===========================================================================
 * Three scans below carry GDD §12.3 refusal conditions — no fatigue readout, no
 * Total in persistent chrome, no progression fact read by the router — and all
 * three used to name their files as literals. `EmpireScreen.tsx` was merged into
 * `src/shell/` and joined none of them. The file is clean today; what had
 * broken is the SCOPE, and a scope that shrank when a file arrived will shrink
 * again the next time one does.
 *
 * So the set is walked. `repositorySources()` already exists two blocks up and
 * already excludes tests and the directories a worktree makes dangerous, so the
 * shell's file set is that walk filtered two ways: everything under
 * `src/shell/`, plus every file anywhere in the repository that mounts
 * `<AppShell>` — which is how `App.tsx`, the platform edge at the repository
 * root, stays in scope without being typed here.
 *
 * REACH AND PREDICATE ARE TWO AXES. Widening the reach says nothing about what
 * is being looked for, and the fatigue scan's predicate had a hole of its own:
 * `FatigueState` and `.fatigue` do not match `import { fatigueDebtDays } from
 * '../game/fatigue'`, which is a shell file reaching the hidden ledger by the
 * most obvious route there is. The module import is now banned too, and both
 * halves are driven against tripwires below.
 */
const SHELL_SCANS = Object.freeze({
  /** Everything under here is the shell's, tests excluded by the walk. */
  DIRECTORY: 'src/shell',
  /**
   * How many files that comes to today.
   *
   * `AppShell.tsx`, `EmpireScreen.tsx`, `appServer.ts`, `empireFloor.ts`,
   * `shellRoute.ts`, `shellTuning.ts`, and `App.tsx` from the mount walk. Pinned
   * so a walk that stopped working reports an empty domain instead of agreeing
   * with it.
   *
   * 6 -> 7 when `empireFloor.ts` arrived to advance GDD §5's floor. It is the
   * one shell file that calls a state-machine step on purpose — `stepGym` — and
   * it is worth saying why that is not what `NOT_THE_SHELLS_JOB` forbids: that
   * list is about the ROUTER computing the state of a screen it is drawing.
   * Advancing the idle layer is what GDD §11's 2026-08-14 ruling authorised, it
   * happens in a pure module rather than in a component, and every function it
   * calls belongs to `src/empire/`. `stepSession` and `stepMeetDay` stay banned
   * everywhere in this directory, `empireFloor.ts` included.
   */
  FILES: 7,
  /**
   * Names the router may not reach for: a state machine step, a progression
   * read, or a progression write. GDD §12.3 and CLAUDE.md's "client is a
   * renderer".
   */
  NOT_THE_SHELLS_JOB: Object.freeze([
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
  ]),
  /** The module that holds GDD §3.4's hidden ledger. */
  FATIGUE_MODULE: 'game/fatigue',
});

/** Comments gone, string literals KEPT — an import specifier is a string. */
function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 ');
}

/** Which banned names a file's real code contains, in list order. */
function shellBannedNamesIn(text: string): readonly string[] {
  const code = codeOnly(text);
  return SHELL_SCANS.NOT_THE_SHELLS_JOB.filter((banned) =>
    new RegExp(`\\b${banned}\\b`).test(code),
  );
}

/** Which of the three ways into the fatigue ledger a file's code takes. */
function fatigueReachesIn(text: string): readonly string[] {
  const code = codeOnly(text);
  const withStrings = withoutComments(text);
  const found: string[] = [];
  if (/\bFatigueState\b/.test(code)) found.push('FatigueState');
  if (/\.fatigue\b/.test(code)) found.push('.fatigue');
  if (new RegExp(`from\\s+'[^']*${SHELL_SCANS.FATIGUE_MODULE}'`).test(withStrings)) {
    found.push(`imports ${SHELL_SCANS.FATIGUE_MODULE}`);
  }
  return found;
}

/**
 * How many times a file's real text says "total".
 *
 * A COUNT AND NOT A BOOLEAN, because CLAUDE.md's own record of this class is
 * that a presence pin whose pattern has more than one witness survives the
 * mutation that breaks the thing. Comments are stripped and STRINGS ARE NOT: a
 * rendered Total is a string literal, which is the whole point.
 */
function totalMentionsIn(text: string): number {
  return (withoutComments(text).match(/\btotal\b/gi) ?? []).length;
}

/** Every file the shell is made of, walked rather than listed. */
function shellSurfaceFiles(): readonly string[] {
  const all = repositorySources();
  const inDirectory = all.filter((file) => file.startsWith(`${SHELL_SCANS.DIRECTORY}/`));
  const mounting = all.filter(
    (file) => shellMountsIn(parseModule(file, source(file)), loadFromDisk).length > 0,
  );
  return [...new Set([...inDirectory, ...mounting])].sort();
}

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
  });

  it('and it really is a meet-server port, so the identity above is not two stubs', () => {
    const port = appMeetPort();
    expect(typeof port.openingSnapshot).toBe('function');
    expect(typeof port.meetBrief).toBe('function');
    expect(typeof port.recordMeetResult).toBe('function');
  });

  it('THE CAREER PORT IS THE SAME OBJECT AS BOTH, so the third mode reads the same lifter', () => {
    // `one-row-behind-one-port`, extended to the career half the moment it
    // exists — because the career is precisely the surface the original defect
    // starved: a calendar reading its own row would gate eligibility on a
    // lifter who never competed. Same `unknown` widening as above, for the
    // same reason: the narrowing refusing `===` is the fences working.
    const career: unknown = appCareerPort();
    expect(
      career === appMeetPort(),
      'the career surface is holding a different server from meet day, so they are two different lifters',
    ).toBe(true);
    expect(
      career === appSessionPort(),
      'the career surface is holding a different server from the daily session',
    ).toBe(true);
    const port = appCareerPort();
    expect(typeof port.openingSnapshot).toBe('function');
    expect(typeof port.chooseFederation).toBe('function');
  });

  it('THE LIFTER PORT IS THE SAME OBJECT AS THE OTHER THREE', () => {
    // Identity only. This file's later test confirms a federation on the
    // shared singleton; creating a profile here would lock that choice and
    // race it. The create/persist loop lives in lifterPersist.test.ts.
    const lifter: unknown = appLifterPort();
    expect(
      lifter === appMeetPort(),
      'My Lifter is holding a different server from meet day, so they are two different lifters',
    ).toBe(true);
    expect(
      lifter === appSessionPort(),
      'My Lifter is holding a different server from the daily session',
    ).toBe(true);
    expect(
      lifter === appCareerPort(),
      'My Lifter is holding a different server from the career surface',
    ).toBe(true);
    const port = appLifterPort();
    expect(typeof port.openingSnapshot).toBe('function');
    expect(typeof port.openingProfile).toBe('function');
    expect(typeof port.createProfile).toBe('function');
  });

  it('first-run Create is the identity gate, and Career Meet entry is built from the profile', () => {
    // 15 launch. Debug routes skip it (`source === 'debug'`). A player launch
    // with no profile opens My Lifter. The seam is kilogramMeetEntryFrom, and
    // lot stays the fixture number until an event system owns it.
    expect(source('src/shell/AppShell.tsx')).toMatch(
      /if \(appLifterPort\(\)\.openingProfile\(\) === null\)/,
    );
    expect(source('src/shell/AppShell.tsx')).toMatch(/surface: 'lifter'/);
    expect(source('src/shell/AppShell.tsx')).toMatch(/kilogramMeetEntryFrom\(/);
    expect(source('src/shell/AppShell.tsx')).toMatch(
      /kilogramMeetEntryFrom\(profile, meet\.federationId, MEET_ENTRY\.lot\)/,
    );
    expect(SHELL).toMatch(/serverPort=\{appLifterPort\(\)\}/);
  });

  it('a federation confirmed through the career half is on the snapshot the session half opens', async () => {
    // The driven consequence, like the meet total's test below: the choice
    // goes in through the CAREER endpoint and comes back out of the snapshot
    // the SESSION half opens on. The id confirmed is the seeded default,
    // because this file's tests share the app's one connection and a meet may
    // already be banked on it — moving those results to another federation is
    // exactly what `careerServer.ts` refuses, and confirming the calendar they
    // were lifted on is what it allows.
    const before = readingValue(readFederation(openingCache(appSessionPort())));
    expect(before, 'the app opens on the seeded default').toEqual({
      id: CAREER_TUNING.DEFAULT_FEDERATION_ID,
      chosen: false,
    });
    const response = await appCareerPort().chooseFederation(
      { kind: 'choose-federation', report: { federationId: CAREER_TUNING.DEFAULT_FEDERATION_ID } },
      asProposalId('shell-career-choice'),
    );
    expect(response.kind, 'the confirmation was recorded').toBe('chosen');
    const after = readingValue(readFederation(openingCache(appSessionPort())));
    expect(after, 'the session half reads the choice off the one row').toEqual({
      id: CAREER_TUNING.DEFAULT_FEDERATION_ID,
      chosen: true,
    });
  });

  it('the Career SCREEN is wired to that port, through the cache machinery, not around it', () => {
    // The port identity above proves the connection is one object; this pins
    // that the screen a player reaches actually drives it. `useCareer`
    // sequences pure transitions from `careerSurface.ts` —
    // `cacheWithChoicePending` (the optimistic park), the port call, and
    // `cacheAfterChoiceResponse` (the settle) — and the screen draws the
    // refusal the server sent, verbatim, off the loop.
    expect(SHELL).toMatch(/serverPort=\{appCareerPort\(\)\}/);
    const careerScreen = codeOnly(source('src/meet/CareerScreen.tsx'));
    expect(careerScreen).toMatch(/useCareer\(serverPort, active\)/);
    expect(careerScreen).toMatch(/\{loop\.refusal\}/);
    expect(careerScreen).toMatch(/loop\.choose\(option\.id\)/);
    const useCareerCode = codeOnly(source('src/meet/useCareer.ts'));
    expect(useCareerCode).toMatch(/cacheWithChoicePending\(cacheRef\.current, proposal, proposalId\)/);
    expect(useCareerCode).toMatch(/port\.chooseFederation\(proposal, proposalId\)/);
    expect(useCareerCode).toMatch(/cacheAfterChoiceResponse\(current, proposalId, response, port\.openingSnapshot\(\)\)/);
    expect(useCareerCode).toMatch(/setRefusal\(refusalSentence\(response\)\)/);
    // The hook builds no port of its own: the one connection arrives from the
    // shell, so the lifter who chooses is the lifter who trains and competes.
    expect(useCareerCode).not.toMatch(/localSessionServer/);
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
    // Since Sprint 2 the one construction carries the store and the real
    // signup day, so the pin is on the guard and the call rather than one line.
    expect(APP_SERVER).toMatch(/if \(connection === null\) \{\s*\n\s*const now = new Date\(\);\s*\n\s*connection = localSessionServer\(\{/);
    expect(APP_SERVER).not.toMatch(/useRef|useState|useMemo/);
    // AND THERE IS EXACTLY ONE `localSessionServer()` CALL IN THE FILE. Two
    // would typecheck, would keep every assertion above green except the
    // identity one, and would be the defect back.
    expect(APP_SERVER.match(/localSessionServer\(/g)).toHaveLength(1);
  });

  it('the shell hands that port to the session, rather than letting it build one', () => {
    expect(SHELL).toMatch(/serverPort=\{appSessionPort\(\)\}/);
  });

  it('and hands the meet one too, which it did not before', () => {
    // `AppShell` gave `SessionScreen` a `serverPort` and gave `MeetScreen` no
    // port, no record and no cache. That asymmetry IS the defect, in one line of
    // JSX, and this is the line.
    expect(SHELL).toMatch(/serverPort=\{meetFrame\?\.serverPort \?\? appMeetPort\(\)\}/);
  });

  it('MeetScreen forwards the port to the hook instead of dropping it', () => {
    // The twin of the `SessionScreen` check below, and the same silent failure:
    // accepting the prop and calling `useMeetDay(preview, ...)` anyway.
    expect(MEET_SCREEN).toMatch(
      /useMeetDay\(serverPort, meet, preview, preview !== undefined, enteredEntry\)/,
    );
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
    // Half two, in `shellRoute.test.ts`: `shellCareerAffordanceFor(session,
    // 'check-in')` is pinned by a HAND-WRITTEN literal to `'open-career'` —
    // the way toward a meet since Sprint 1c deleted the direct door.
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
      /loop\.alreadyTrainedToday && state\.plan === null && preview === undefined/,
    );
    expect(source('src/session/SessionScreen.tsx')).toMatch(
      /loop\.alreadyTrainedToday && state\.plan === null/,
    );
    expect(codeOnly("if (a && state.plan === null && b) {")).toMatch(
      /state\.plan === null/,
    );
    expect("loop.alreadyTrainedToday && state.phase === 'rest'").not.toMatch(
      /loop\.alreadyTrainedToday && state\.plan === null/,
    );
  });
});

// ---------------------------------------------------------------------------
// The shell computes nothing and shows nothing it should not
// ---------------------------------------------------------------------------

describe('the shell is a router, not a screen', () => {
  /**
   * Walked once for the whole block. Every scan below runs over this and over
   * nothing it was told about by hand.
   */
  const SURFACE = shellSurfaceFiles();

  it('CONTROL: the shell’s file set is WALKED, and the three scans below can see what they forbid', () => {
    // THE CENSUS. A derived set that quietly went empty would satisfy every
    // "no file contains X" check in this block, which is the shape CLAUDE.md
    // calls an empty domain. So the count is pinned and the members printed.
    expect(
      SURFACE.length,
      `the shell is ${SURFACE.length} file(s): ${SURFACE.join(', ')}. A new one is not a defect —` +
        ' but it joins three §12.3 scans by arriving, and this number is where that is noticed.',
    ).toBe(SHELL_SCANS.FILES);
    // Inside the directory, including the file that arrived without joining any
    // of the three lists this block used to keep by hand...
    expect(SURFACE).toContain('src/shell/EmpireScreen.tsx');
    // ...and outside it, reached through the mount walk rather than typed.
    expect(SURFACE).toContain('App.tsx');
    for (const file of SURFACE) {
      expect(source(file).length, file).toBeGreaterThan(150);
    }

    // AND EACH PREDICATE AGAINST A TRIPWIRE, because a scan that has stopped
    // matching agrees with every file it is pointed at. Counts, not presence:
    // the banned-name reader returns which names it saw, in list order.
    expect(shellBannedNamesIn('const s = stepMeetDay(a, b); proposeChange(x);')).toEqual([
      'stepMeetDay',
      'proposeChange',
    ]);
    expect(shellBannedNamesIn('// stepMeetDay(a, b)\nconst s = 1;')).toEqual([]);
    expect(fatigueReachesIn('const n = state.context.fatigue.sessions;')).toEqual(['.fatigue']);
    expect(fatigueReachesIn('let f: FatigueState = seed;')).toEqual(['FatigueState']);
    // THE PREDICATE HOLE, DRIVEN: neither of the two above matches this line,
    // and it is a shell file reading the hidden ledger by the plainest route.
    expect(fatigueReachesIn("import { fatigueDebtDays } from '../game/fatigue';")).toEqual([
      `imports ${SHELL_SCANS.FATIGUE_MODULE}`,
    ]);
    expect(fatigueReachesIn("const readiness = 'ready';")).toEqual([]);
    expect(totalMentionsIn('const a = <Text>{`TOTAL ${kg}`}</Text>;')).toBe(1);
    expect(totalMentionsIn('/* Total moves on meet day and no other day. */')).toBe(0);
  });

  it('steps no state machine and reads no progression fact, in EVERY file of the shell', () => {
    const reaching = SURFACE.flatMap((file) =>
      shellBannedNamesIn(source(file)).map((banned) => `${file} reaches for ${banned}`),
    );
    expect(reaching, reaching.join('\n')).toEqual([]);
  });

  it('cannot reach the hidden fatigue ledger, in EVERY file of the shell — GDD §3.4, §12.3', () => {
    const reaching = SURFACE.flatMap((file) =>
      fatigueReachesIn(source(file)).map((how) => `${file}: ${how}`),
    );
    expect(reaching, reaching.join('\n')).toEqual([]);
  });

  it('shows no Total anywhere in its chrome, in EVERY file of the shell — GDD §3.2, §6.4', () => {
    // Total moves on meet day and no other day. Persistent chrome is on screen
    // during a training session, so a Total there is the exact thing §3.2 says
    // spends meet day's payoff.
    const saying = SURFACE.flatMap((file) => {
      const count = totalMentionsIn(source(file));
      return count === 0 ? [] : [`${file} says "total" ${count} time(s) outside its comments`];
    });
    expect(saying, saying.join('\n')).toEqual([]);
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

describe('the browser tools’ fresh-lifter boundary matches the app’s save', () => {
  // Sprint 2 made the server persist a lifter across boots, which falsified the
  // premise every browser tool was written on ("a goto is a new lifter").
  // `tools/freshLifterBoundary.mjs` makes the premise true again by clearing the
  // app's storage namespace — which means it holds a COPY of a literal that
  // lives in `appServer.ts`. Copies drift, and a drifted prefix does not fail:
  // it clears nothing, and every tool silently goes back to measuring resumed
  // lifters. These pins are what redden instead.

  const boundary = source('tools/freshLifterBoundary.mjs');
  const prefixMatch = boundary.match(/SAVE_NAMESPACE_PREFIX = '([^']+)'/);
  const saveKeyMatch = source('src/shell/appServer.ts').match(/const SAVE_KEY = '([^']+)'/);

  it('the tools’ fresh-lifter boundary clears the key the app saves under', () => {
    // Non-vacuity first: both literals were actually found, so the comparison
    // below is about two real strings rather than two nulls agreeing.
    expect(prefixMatch?.[1], 'SAVE_NAMESPACE_PREFIX literal in freshLifterBoundary.mjs').toBeTruthy();
    expect(saveKeyMatch?.[1], 'SAVE_KEY literal in appServer.ts').toBeTruthy();
    const prefix = prefixMatch?.[1] ?? '';
    const saveKey = saveKeyMatch?.[1] ?? '';
    expect(saveKey.startsWith(prefix), `SAVE_KEY ${JSON.stringify(saveKey)} must start with the boundary prefix ${JSON.stringify(prefix)}`).toBe(true);
    // The quarantine keys extend SAVE_KEY, so covering the prefix covers them
    // too — asserted rather than reasoned, against the template's own head.
    expect(source('src/shell/appServer.ts')).toMatch(/QUARANTINE_KEY = \(code: SaveRefusalCode\): string => `three-white-lights\.save\.refused\./);
  });

  it('every browser tool arms the boundary — the guard is applied to its siblings mechanically', () => {
    // The lesson this rule is from: a guard written for one hook sat one
    // directory from its unguarded sibling for six waves. So the sibling list
    // is READ from the tree, not copied into it: every tool under tools/ that
    // opens a browser context must either arm the per-boot clear or (exactly
    // one, the tool that owns the deliberate reload check) call the imperative
    // clear at its own boundary.
    const toolsDir = path.join(ROOT, 'tools');
    // Scanned RAW rather than through `codeOnly`: that helper's backtick
    // blanking pairs template literals naively, and these tools nest backticks
    // inside interpolations, so real code between two templates gets swallowed
    // — measured: it dropped verify-cutin-cap.mjs and verify-lift-press.mjs
    // from this very census. A comment that mentions the pattern would drag a
    // tool in, but the census below is PINNED, so that arrives as a visible
    // new row rather than a silent widening.
    const browserTools = readdirSync(toolsDir)
      .filter((name) => name.endsWith('.mjs'))
      .filter((name) => /browser\.newContext\(|browser\.newPage\(/.test(source(path.join('tools', name))))
      .sort();
    // The census, pinned: an empty scan would pass the loop below over nothing.
    expect(browserTools, 'tools that open a browser context').toEqual([
      '_capture-a2-lifter.mjs',
      'capture-cutin.mjs',
      'capture-lift.mjs',
      'capture-meet.mjs',
      'capture-session.mjs',
      'capture-training-fit.mjs',
      'shoot.mjs',
      'verify-cutin-cap.mjs',
      'verify-lift-press.mjs',
      'verify-meet-sound.mjs',
      'verify-session-boundary.mjs',
      'verify-shell-route.mjs',
    ]);
    const imperative: string[] = [];
    for (const name of browserTools) {
      const text = source(path.join('tools', name));
      const armed = /armFreshLifterPerBoot\(/.test(text);
      const clears = /clearSavedLifter\(/.test(text);
      expect(armed || clears, `${name} opens a browser and never establishes the fresh-lifter boundary`).toBe(true);
      expect(armed && clears, `${name} uses BOTH arms — the init script would clear the save the reload check depends on`).toBe(false);
      if (clears) imperative.push(name);
    }
    // Exactly one tool owns the imperative arm, because exactly one tool has a
    // deliberate persistence section. A second one is a decision, not drift.
    expect(imperative).toEqual(['verify-shell-route.mjs']);
  });
});
