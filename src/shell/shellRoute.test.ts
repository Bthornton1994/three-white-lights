/**
 * shellRoute.test.ts — the reachability suite.
 *
 * WHAT THIS FILE IS FOR, STATED SO IT CANNOT DRIFT INTO SOMETHING WEAKER.
 *
 * The defect this piece closed was not a wrong value and not a missing
 * component. `MeetScreen` existed, was imported, rendered correctly and had
 * hundreds of green tests behind it. What did not exist was a PATH TO IT: the
 * app routed on query strings only, so meet day was reachable by typing a URL
 * and by nothing else. Every test in the repository passed on that tree.
 *
 * So the assertions below are about REACHABILITY, deliberately, and every one
 * of them is written so that deleting the edge in `navigate` turns it red. A
 * test that only asserted "a meet route exists" or "MeetScreen is imported"
 * would have passed before this piece was built, which is the definition of a
 * check that cannot fail.
 */

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ROUTE,
  SHELL_INTENTS,
  SHELL_SURFACES,
  entryRoute,
  frozenMeetFor,
  frozenSessionFor,
  meetEntryFrom,
  navigate,
  pathBetween,
  playerReachableFrom,
  replayEntryFrom,
  resolveEntry,
  sessionEntryFrom,
  shellAffordanceFor,
  type ShellRoute,
  type ShellSurface,
} from './shellRoute';
import { SHELL_COPY, SHELL_NAV } from './shellTuning';
import { MEET_MOMENTS } from '../game/meetPreview';
import { SESSION_MOMENTS } from '../session/sessionPreview';
import { CAPTURE_MOMENTS } from '../lift/liftReplay';
import { MEET_DAY_PHASES } from '../game/meetDay';
import { SESSION_PHASES } from '../game/session';

const AS_PLAYER = (surface: ShellSurface): ShellRoute => ({ surface, source: 'player' });

// ---------------------------------------------------------------------------
// THE ONE THAT MATTERS
// ---------------------------------------------------------------------------

describe('a player can get from the daily session to a meet, and back', () => {
  it('THE SESSION -> MEET ROUTE EXISTS AND IS A PATH, NOT A COMPONENT', () => {
    // Read this as: holding a phone, on the screen the app opens on, with no
    // URL bar, how many presses to meet day? The answer must be a number.
    const path = pathBetween('session', 'meet');
    expect(path, 'a player cannot reach meet day at all').not.toBeNull();
    expect(path).toEqual(['open-meet']);
  });

  it('and the way back exists too — GDD §6.5 ends somewhere', () => {
    expect(pathBetween('meet', 'session')).toEqual(['leave-meet']);
  });

  it('the two compose into a round trip that ends where the app opens', () => {
    // Not two separate facts. A player who goes to a meet and comes back must
    // be on the surface GDD §3.2 says the app is about, not on a third thing.
    let route = DEFAULT_ROUTE;
    for (const intent of pathBetween('session', 'meet') ?? []) route = navigate(route, intent);
    expect(route.surface).toBe('meet');
    for (const intent of pathBetween('meet', 'session') ?? []) route = navigate(route, intent);
    expect(route).toEqual({ surface: 'session', source: 'player' });
  });

  it('the app opens on the session, so the round trip starts from the default', () => {
    expect(DEFAULT_ROUTE.surface).toBe('session');
    expect(entryRoute(null)).toEqual(DEFAULT_ROUTE);
    expect(entryRoute('')).toEqual(DEFAULT_ROUTE);
    expect(playerReachableFrom(DEFAULT_ROUTE.surface)).toContain('meet');
  });

  it('reaching meet day never needs a debug URL', () => {
    // `source` is the whole point of this assertion: a route the player walked
    // to is `player`, and nothing a player does can produce `debug`.
    let route: ShellRoute = DEFAULT_ROUTE;
    const sources: string[] = [];
    for (const intent of ['open-meet', 'leave-meet', 'open-meet'] as const) {
      route = navigate(route, intent);
      sources.push(route.source);
    }
    expect(sources).toEqual(['player', 'player', 'player']);
  });
});

// ---------------------------------------------------------------------------
// The graph, and the positive controls that make its absence visible
// ---------------------------------------------------------------------------

describe('the route graph', () => {
  it('has exactly the edges the shell claims, and no others', () => {
    // Written as the full cross product rather than as the two true cases, so
    // an edge ADDED by accident fails here too.
    const edges: Record<string, string> = {};
    for (const surface of SHELL_SURFACES) {
      for (const intent of SHELL_INTENTS) {
        edges[`${surface} --${intent}-->`] = navigate(AS_PLAYER(surface), intent).surface;
      }
    }
    expect(edges).toEqual({
      'session --open-meet-->': 'meet',
      'session --leave-meet-->': 'session',
      'meet --open-meet-->': 'meet',
      'meet --leave-meet-->': 'session',
      'replay --open-meet-->': 'replay',
      'replay --leave-meet-->': 'replay',
    });
  });

  it('an intent that does not apply is a no-op, identically', () => {
    const route = AS_PLAYER('session');
    expect(navigate(route, 'leave-meet')).toBe(route);
  });

  it('the replay harness is not a place a player can walk to', () => {
    // It is a debug surface for the lift-mechanic captures. A player reaching
    // it would be reaching a screenshot rig.
    expect(playerReachableFrom('session')).not.toContain('replay');
    expect(playerReachableFrom('meet')).not.toContain('replay');
    expect(pathBetween('session', 'replay')).toBeNull();
    expect(pathBetween('meet', 'replay')).toBeNull();
  });

  it('playerReachableFrom is the closure of navigate, not a second list', () => {
    // If it were written out by hand it could stay right while the graph broke.
    for (const from of SHELL_SURFACES) {
      for (const to of playerReachableFrom(from)) {
        expect(pathBetween(from, to), `${from} -> ${to}`).not.toBeNull();
      }
      for (const to of SHELL_SURFACES) {
        if (playerReachableFrom(from).includes(to)) continue;
        expect(pathBetween(from, to), `${from} -> ${to} should be unreachable`).toBeNull();
      }
    }
  });

  it('pathBetween of a surface to itself is the empty path, not null', () => {
    for (const surface of SHELL_SURFACES) {
      expect(pathBetween(surface, surface)).toEqual([]);
    }
  });

  it('every surface can reach the daily session — nothing is a dead end', () => {
    // `replay` is exempt and says so: it is the capture harness, entered by URL
    // and left by closing the tab.
    for (const surface of SHELL_SURFACES) {
      if (surface === 'replay') continue;
      expect(playerReachableFrom(surface), surface).toContain('session');
    }
  });
});

// ---------------------------------------------------------------------------
// The chrome gate
// ---------------------------------------------------------------------------

describe('when the shell may draw a control', () => {
  it('offers the way to meet day on the beats SHELL_NAV lists, and nowhere else', () => {
    const listed: readonly string[] = SHELL_NAV.SESSION_PHASES;
    for (const phase of SESSION_PHASES) {
      expect(shellAffordanceFor(DEFAULT_ROUTE, phase), phase).toBe(
        listed.includes(phase) ? 'open-meet' : null,
      );
    }
  });

  it('draws NOTHING over a live set or the rest between two of them', () => {
    // The one assertion here that is about feel rather than routing, and the
    // reason the gate exists: a pill over the mechanic is a mis-tap that costs
    // a rep. Pinned by name rather than by list membership so loosening
    // SHELL_NAV cannot quietly loosen this.
    expect(shellAffordanceFor(DEFAULT_ROUTE, 'set')).toBeNull();
    expect(shellAffordanceFor(DEFAULT_ROUTE, 'rest')).toBeNull();
  });

  it('offers the way back only once meet day is over', () => {
    const meet = AS_PLAYER('meet');
    const listed: readonly string[] = SHELL_NAV.MEET_PHASES;
    for (const phase of MEET_DAY_PHASES) {
      expect(shellAffordanceFor(meet, phase), phase).toBe(
        listed.includes(phase) ? 'leave-meet' : null,
      );
    }
    // Spelled out: no control over a walk-out, an attempt, or a verdict.
    for (const phase of ['walkout', 'lift', 'deliberation', 'verdict'] as const) {
      expect(shellAffordanceFor(meet, phase), phase).toBeNull();
    }
  });

  it('leaves GDD §6.3’s bomb-out to draw its own way out', () => {
    // BombOutView has an `onDone` wired to the same route. A second control on
    // that beat would clutter the one screen the GDD asks to be left somber.
    expect(shellAffordanceFor(AS_PLAYER('meet'), 'bombed')).toBeNull();
  });

  it('draws nothing before a surface has reported a beat, or over the harness', () => {
    expect(shellAffordanceFor(DEFAULT_ROUTE, null)).toBeNull();
    expect(shellAffordanceFor(AS_PLAYER('replay'), null)).toBeNull();
    expect(shellAffordanceFor(AS_PLAYER('replay'), 'check-in')).toBeNull();
  });

  it('the recap is reachable and IS a listed beat — the way back is drawable', () => {
    // Guards the pair: `MEET_PHASES` naming a phase that `meetDay.ts` does not
    // have would make the gate silently never fire.
    for (const phase of SHELL_NAV.MEET_PHASES) {
      expect(MEET_DAY_PHASES as readonly string[], phase).toContain(phase);
    }
    for (const phase of SHELL_NAV.SESSION_PHASES) {
      expect(SESSION_PHASES as readonly string[], phase).toContain(phase);
    }
  });
});

// ---------------------------------------------------------------------------
// The debug routes: still there, and still the only way to a frozen frame
// ---------------------------------------------------------------------------

describe('the four debug query strings the evidence harness drives', () => {
  it('?meet=<moment> opens a frozen meet, for every moment capture-meet.mjs asks for', () => {
    for (const moment of MEET_MOMENTS) {
      const entry = resolveEntry(`?meet=${moment}`);
      expect(entry.route, moment).toEqual({ surface: 'meet', source: 'debug' });
      expect(entry.meet?.state, moment).toBeDefined();
    }
  });

  it('?meet=live opens a PLAYED meet — no frozen state, clocks running', () => {
    const entry = resolveEntry('?meet=live');
    expect(entry.route).toEqual({ surface: 'meet', source: 'debug' });
    expect(entry.meet).toBeDefined();
    expect(entry.meet?.state).toBeUndefined();
    expect(entry.meet?.holdWalkoutAtMs).toBeNull();
  });

  it('?session=<moment> opens a frozen session, for every moment capture-session.mjs asks for', () => {
    for (const moment of SESSION_MOMENTS) {
      const entry = resolveEntry(`?session=${moment}`);
      expect(entry.route, moment).toEqual({ surface: 'session', source: 'debug' });
      expect(entry.session, moment).toBeDefined();
      // The frame carries the cache the close-out's numbers are read out of.
      expect(entry.session?.cache, moment).toBeDefined();
    }
  });

  it('?replay=<load>&moment=<id> opens the lift harness, for every capture moment', () => {
    for (const moment of CAPTURE_MOMENTS) {
      const entry = resolveEntry(`?replay=0.9&moment=${moment}`);
      expect(entry.route, moment).toEqual({ surface: 'replay', source: 'debug' });
      expect(entry.replay, moment).toEqual({ loadRatio: 0.9, moment });
    }
  });

  it('holds the walk-out at an instant only for the two mid-motion beats', () => {
    expect(resolveEntry('?meet=walkout-unrack').meet?.holdWalkoutAtMs).toBeGreaterThan(0);
    expect(resolveEntry('?meet=walkout-step').meet?.holdWalkoutAtMs).toBeGreaterThan(0);
    expect(resolveEntry('?meet=walkout-third').meet?.holdWalkoutAtMs).toBeNull();
  });

  it('opens straight onto the shareable card for exactly one beat', () => {
    const opensOnCard = MEET_MOMENTS.filter((m) => resolveEntry(`?meet=${m}`).meet?.card === true);
    expect(opensOnCard).toEqual(['recap-card']);
  });

  it('precedence is meet, then replay, then session — the order App.tsx used', () => {
    expect(resolveEntry('?meet=recap&replay=0.9&moment=hole').route.surface).toBe('meet');
    expect(resolveEntry('?replay=0.9&moment=hole&session=briefing').route.surface).toBe('replay');
    expect(resolveEntry('?session=briefing').route.surface).toBe('session');
  });

  it('refuses what it does not recognise and boots normally', () => {
    for (const search of ['?meet=nonsense', '?session=nonsense', '?replay=99&moment=hole', '?x=1']) {
      expect(resolveEntry(search).route, search).toEqual(DEFAULT_ROUTE);
    }
  });

  it('has no URL to read on native, and every debug branch is dead there', () => {
    const entry = resolveEntry(null);
    expect(entry.route).toEqual(DEFAULT_ROUTE);
    expect(entry.meet).toBeUndefined();
    expect(entry.session).toBeUndefined();
    expect(entry.replay).toBeUndefined();
    expect(meetEntryFrom(null)).toBeUndefined();
    expect(sessionEntryFrom(null)).toBeUndefined();
    expect(replayEntryFrom(null)).toBeUndefined();
  });

  it('entryRoute and resolveEntry cannot disagree about a query string', () => {
    // They are one function and its projection. Asserted anyway, because the
    // shape they used to have — two independent parses in App.tsx — is exactly
    // where a route and its frame drift apart.
    for (const search of ['?meet=recap', '?meet=live', '?session=set', '?replay=0.9&moment=hole', '', '?x=1']) {
      expect(entryRoute(search), search).toEqual(resolveEntry(search).route);
    }
  });
});

// ---------------------------------------------------------------------------
// A played meet is never a screenshot
// ---------------------------------------------------------------------------

describe('a meet the player opened is played, not frozen', () => {
  it('a player-opened meet gets no frozen frame, even from a debug launch URL', () => {
    // The bug this prevents: launch on `?meet=recap`, press the way out, press
    // MEET DAY again — and get the recap screenshot back, with its timers
    // stopped, instead of a meet.
    const entry = resolveEntry('?meet=recap');
    expect(frozenMeetFor(entry, entry.route)).toBeDefined();
    const afterRoundTrip = navigate(navigate(entry.route, 'leave-meet'), 'open-meet');
    expect(afterRoundTrip).toEqual({ surface: 'meet', source: 'player' });
    expect(frozenMeetFor(entry, afterRoundTrip)).toBeUndefined();
  });

  it('the same for the session', () => {
    const entry = resolveEntry('?session=close-out-pr');
    expect(frozenSessionFor(entry, entry.route)).toBeDefined();
    const afterRoundTrip = navigate(navigate(entry.route, 'open-meet'), 'leave-meet');
    expect(afterRoundTrip).toEqual({ surface: 'session', source: 'player' });
    expect(frozenSessionFor(entry, afterRoundTrip)).toBeUndefined();
  });

  it('a frozen frame is never handed to the wrong surface', () => {
    const meetEntry = resolveEntry('?meet=recap');
    expect(frozenSessionFor(meetEntry, meetEntry.route)).toBeUndefined();
    const sessionEntry = resolveEntry('?session=set');
    expect(frozenMeetFor(sessionEntry, sessionEntry.route)).toBeUndefined();
  });

  it('the default launch has nothing frozen anywhere', () => {
    const entry = resolveEntry('');
    expect(frozenMeetFor(entry, entry.route)).toBeUndefined();
    expect(frozenSessionFor(entry, entry.route)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// The shell surfaces no progression (GDD §3.2, §6.4, §12.3)
// ---------------------------------------------------------------------------

describe('the shell routes and renders; it does not carry the numbers', () => {
  it('nothing the shell can say mentions a Total', () => {
    // GDD §3.2: Total moves on meet day and no other day, so a Total in
    // persistent chrome would be on screen during a training session. Serialised
    // rather than eyeballed, the same way session.ts checks its close-out.
    const everythingTheShellSays = JSON.stringify({ SHELL_NAV, SHELL_COPY });
    expect(everythingTheShellSays).not.toMatch(/total/i);
    expect(everythingTheShellSays).not.toMatch(/e1rm/i);
    expect(everythingTheShellSays).not.toMatch(/dots/i);
    // §3.4/§12.3: no fatigue readout, and no word that implies one.
    expect(everythingTheShellSays).not.toMatch(/fatigue/i);
    expect(everythingTheShellSays).not.toMatch(/recover/i);
    expect(everythingTheShellSays).not.toMatch(/readiness/i);
  });

  it('a route carries a surface and a reason and nothing else', () => {
    // If a progression number were ever going to leak into the shell, the route
    // object is where it would ride. Pinned to two fields.
    for (const search of ['', '?meet=recap', '?session=set', '?replay=0.9&moment=hole']) {
      expect(Object.keys(entryRoute(search)).sort(), search).toEqual(['source', 'surface']);
    }
  });
});
