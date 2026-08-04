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

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { appSessionPort } from './appServer';

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

  it('the screens actually REPORT their beat, rather than only accepting the prop', () => {
    // Added after this exact deletion was mutated in and the whole node suite —
    // all 2183 tests — stayed green. `tools/verify-shell-route.mjs` caught it
    // and named eleven broken checks; nothing here could see it, because
    // accepting a callback and never calling it is invisible to a type and to
    // every pure test. This scan closes the cheap half. It does NOT close the
    // class: a control that mounts and stays at zero opacity would pass this
    // and fail the browser, which is why the browser check is the decisive one.
    expect(SESSION_SCREEN).toMatch(/onPhase\?\.\(state\.phase\)/);
    expect(MEET_SCREEN).toMatch(/onPhase\?\.\(state\.phase\)/);
  });

  it('asks `shellAffordanceFor` when to draw a control, and draws only that', () => {
    expect(SHELL).toMatch(/shellAffordanceFor\(/);
    // The gate must be the thing that decides, so the pill cannot be rendered
    // unconditionally next to it.
    expect(SHELL).toMatch(/affordance === null \? null :/);
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
    expect(APP).toMatch(/typeof window/);
    expect(APP).toMatch(/window\.location\.search/);
    expect(APP).toMatch(/AppShell/);
    for (const banned of ['MeetScreen', 'SessionScreen', 'LiftScreen', 'previewStateFor']) {
      expect(APP, banned).not.toMatch(new RegExp(`\\b${banned}\\b`));
    }
  });
});

// ---------------------------------------------------------------------------
// THE ALREADY-TRAINED-TODAY CASE SURVIVES NAVIGATION
// ---------------------------------------------------------------------------

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

  it('the port is memoised at module scope, not in a component', () => {
    // A `useRef` only survives as long as the component holding it, which is
    // exactly the thing that stops surviving when the shell can route away.
    expect(APP_SERVER).toMatch(/let connection: SessionServerPort \| null = null;/);
    expect(APP_SERVER).toMatch(/if \(connection === null\) connection = localSessionServer\(\);/);
    expect(APP_SERVER).not.toMatch(/useRef|useState|useMemo/);
  });

  it('the shell hands that port to the session, rather than letting it build one', () => {
    expect(SHELL).toMatch(/serverPort=\{appSessionPort\(\)\}/);
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
