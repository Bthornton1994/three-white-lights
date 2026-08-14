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
  PERSISTENT_SURFACES,
  SHELL_INTENTS,
  SHELL_SURFACES,
  entryRoute,
  forgetsBeatOnArrival,
  isPersistentSurface,
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
  shellEmpireAffordanceFor,
  type ShellIntent,
  type ShellRoute,
  type ShellSurface,
} from './shellRoute';
import { SHELL_COPY, SHELL_NAV } from './shellTuning';
import { MEET_MOMENTS } from '../game/meetPreview';
import { MEET_PREVIEW } from '../game/meetTuning';
import { openingCache } from '../game/sessionClient';
import { readTotalKg, readingValue } from '../game/progression';
import { SESSION_MOMENTS } from '../session/sessionPreview';
import { CAPTURE_MOMENTS } from '../lift/liftReplay';
import { MEET_DAY_PHASES, type MeetDayPhaseId } from '../game/meetDay';
import { SESSION_PHASES, type SessionPhase } from '../game/session';

const AS_PLAYER = (surface: ShellSurface): ShellRoute => ({ surface, source: 'player' });

// ---------------------------------------------------------------------------
// THE ANSWER SHEET — WRITTEN OUT BY HAND, DERIVED FROM NOTHING
// ---------------------------------------------------------------------------
/**
 * WHAT THE SHELL DRAWS ON EVERY BEAT OF THE GAME. Every value below is a
 * literal somebody typed. Nothing here reads `SHELL_NAV`, and that is the whole
 * point of it.
 *
 * ===========================================================================
 * THE DEFECT THIS TABLE EXISTS TO MAKE IMPOSSIBLE
 * ===========================================================================
 * The chrome-gate tests used to read their own expectations out of the constant
 * they existed to check:
 *
 *     const listed: readonly string[] = SHELL_NAV.SESSION_PHASES;
 *     expect(shellAffordanceFor(route, phase)).toBe(
 *       listed.includes(phase) ? 'open-meet' : null,   // <- the same constant
 *     );
 *
 * Empty `SHELL_NAV.SESSION_PHASES` to `[]` and `listed.includes(phase)` is
 * false for every phase; `shellAffordanceFor` reads the same emptied constant
 * and returns null for every phase. BOTH SIDES MOVE TOGETHER, the assertion
 * passes vacuously, and the app silently regresses to the exact dead ends this
 * piece was built to close — meet day unreachable, the recap and the result
 * card with no way out — with the whole suite green.
 *
 * That is not a hypothetical mutation. `src/tuning/index.ts` names these two
 * lists as "the ones to turn first and the ones most likely to be wrong": they
 * are the values GDD §12.1's playtest pass is expected to HAND-EDIT. A
 * playtester who decides the recap wants a bespoke exit and empties
 * `MEET_PHASES` by mistake has to be told, not applauded.
 *
 * ===========================================================================
 * SO YES, THIS DUPLICATES A TUNED VALUE, DELIBERATELY
 * ===========================================================================
 * `SHELL_NAV` is still the one home the app reads from — CLAUDE.md's rule is
 * about where the SHIPPING code gets its numbers, and no component holds these.
 * This is an EXPECTATION, and an expectation that derives itself from its own
 * subject cannot fail. `tools/verify-shell-route.mjs` writes out its testIDs by
 * hand for the same reason and says so in its header.
 *
 * IF YOU ARE TUNING `SHELL_NAV`, EDIT THIS TABLE TOO. The cross-check below —
 * "the table and SHELL_NAV are two statements of one fact" — fails loudly and
 * by name when they disagree, so the second edit is not something you can
 * forget. It is something the suite asks you for.
 *
 * The `Record<SessionPhase, ...>` / `Record<MeetDayPhaseId, ...>` types make
 * the table EXHAUSTIVE at compile time: a phase added to either union is a type
 * error here until somebody decides what the shell does on it.
 */
const ON_A_SESSION_BEAT: Readonly<Record<SessionPhase, ShellIntent | null>> = Object.freeze({
  /** GDD §3.2's first beat — and the "already trained today" surface too. */
  'check-in': 'open-meet',
  /** Choosing an RPE. Deciding, not lifting. */
  briefing: 'open-meet',
  /** THE MECHANIC. A pill here is a mis-tap that costs a rep. */
  set: null,
  /** The gap between two sets. Still the mechanic's screen. */
  rest: null,
  /** The end of a session — the "finish training, reach a meet" path. */
  'close-out': 'open-meet',
});

const ON_A_MEET_BEAT: Readonly<Record<MeetDayPhaseId, ShellIntent | null>> = Object.freeze({
  'weigh-in': null,
  openers: null,
  /** GDD §6.3's choice. The tensest decision in the game; leave it alone. */
  'attempt-select': null,
  walkout: null,
  lift: null,
  deliberation: null,
  verdict: null,
  /** GDD §6.3's somber beat draws its OWN way out. */
  bombed: null,
  /** GDD §6.5. The meet is over, and the way out is a route. */
  recap: 'leave-meet',
});

/** The beats the hand-written table above gives `intent` to, sorted. */
function tableBeatsFor(
  table: Readonly<Record<string, ShellIntent | null>>,
  intent: ShellIntent,
): readonly string[] {
  return Object.entries(table)
    .filter(([, drawn]) => drawn === intent)
    .map(([phase]) => phase)
    .sort();
}

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

  it('THE SESSION -> EMPIRE ROUTE EXISTS AND IS A PATH, NOT A COMPONENT', () => {
    const path = pathBetween('session', 'empire');
    expect(path, 'a player cannot reach Gym Empire at all').not.toBeNull();
    expect(path).toEqual(['open-empire']);
  });

  it('and the way back from Empire exists too', () => {
    expect(pathBetween('empire', 'session')).toEqual(['leave-empire']);
  });

  it('Empire round-trips to the daily session without a debug URL', () => {
    let route = DEFAULT_ROUTE;
    for (const intent of pathBetween('session', 'empire') ?? []) route = navigate(route, intent);
    expect(route.surface).toBe('empire');
    for (const intent of pathBetween('empire', 'session') ?? []) route = navigate(route, intent);
    expect(route).toEqual({ surface: 'session', source: 'player' });
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
      'session --open-empire-->': 'empire',
      'session --leave-empire-->': 'session',
      'meet --open-meet-->': 'meet',
      'meet --leave-meet-->': 'session',
      'meet --open-empire-->': 'meet',
      'meet --leave-empire-->': 'meet',
      'replay --open-meet-->': 'replay',
      'replay --leave-meet-->': 'replay',
      'replay --open-empire-->': 'replay',
      'replay --leave-empire-->': 'replay',
      'empire --open-meet-->': 'empire',
      'empire --leave-meet-->': 'empire',
      'empire --open-empire-->': 'empire',
      'empire --leave-empire-->': 'session',
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
    expect(playerReachableFrom('empire')).not.toContain('replay');
    expect(pathBetween('session', 'replay')).toBeNull();
    expect(pathBetween('meet', 'replay')).toBeNull();
    expect(pathBetween('empire', 'replay')).toBeNull();
  });

  it('a player on the daily session can reach Empire without a URL', () => {
    expect(playerReachableFrom('session')).toContain('empire');
    expect(playerReachableFrom('empire')).toContain('session');
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
// Which surfaces survive a navigation
// ---------------------------------------------------------------------------

describe('the surfaces a side trip may not spend', () => {
  it('names both ends of the Empire round trip and nothing else', () => {
    // Typed out rather than derived. A list of two that a loop agrees with is a
    // list nobody has to read; the point of this one is that adding a third
    // surface to it changes what `AppShell` mounts, and that is a decision
    // somebody should have to write down here first.
    expect([...PERSISTENT_SURFACES]).toEqual(['session', 'empire']);
    expect(isPersistentSurface('session')).toBe(true);
    expect(isPersistentSurface('empire')).toBe(true);
    // Meet is deliberately absent — the argument is in `shellRoute.ts`, and the
    // consequence is that a meet still discards the beat under it.
    expect(isPersistentSurface('meet')).toBe(false);
    expect(isPersistentSurface('replay')).toBe(false);
  });

  it('forgets the beat of every surface that re-mounts, and of the one that re-reports', () => {
    // The daily session is the one surface whose beat must survive the arrival,
    // because it is the one screen that both persists AND has no way to report
    // again — see `forgetsBeatOnArrival`. Everything else is forgotten on the way
    // in, which is what stops a stale beat flashing chrome over a weigh-in.
    expect(forgetsBeatOnArrival('session')).toBe(false);
    for (const surface of SHELL_SURFACES) {
      if (surface === 'session') continue;
      expect(forgetsBeatOnArrival(surface), surface).toBe(true);
    }
    // ...and the two rules are not the same rule wearing two names: Empire both
    // persists and is forgotten, which is the pair that would be missing if
    // "persistent" simply meant "keeps its beat".
    expect(isPersistentSurface('empire') && forgetsBeatOnArrival('empire')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The chrome gate
// ---------------------------------------------------------------------------

describe('when the shell may draw a control — pinned, one beat at a time', () => {
  // ONE `expect` PER BEAT, WITH THE ANSWER TYPED OUT NEXT TO IT. No loop, no
  // list membership, no ternary that reads the module under test. Emptying
  // `SHELL_NAV.SESSION_PHASES` reddens the first three lines below; adding
  // `set` to it reddens the pair after that.
  const SESSION = DEFAULT_ROUTE;
  const MEET = AS_PLAYER('meet');

  it('THE WAY TO MEET DAY IS ON THE CHECK-IN, THE BRIEFING AND THE CLOSE-OUT', () => {
    expect(shellAffordanceFor(SESSION, 'check-in')).toBe('open-meet');
    expect(shellAffordanceFor(SESSION, 'briefing')).toBe('open-meet');
    expect(shellAffordanceFor(SESSION, 'close-out')).toBe('open-meet');
  });

  it('AND IT IS DRAWN OVER NEITHER A LIVE SET NOR THE REST BETWEEN TWO OF THEM', () => {
    // The one assertion here that is about feel rather than routing, and the
    // reason the gate exists at all: a pill over the mechanic is a mis-tap that
    // costs a rep.
    expect(shellAffordanceFor(SESSION, 'set')).toBe(null);
    expect(shellAffordanceFor(SESSION, 'rest')).toBe(null);
  });

  it('THE WAY BACK IS ON GDD §6.5’s RECAP', () => {
    expect(shellAffordanceFor(MEET, 'recap')).toBe('leave-meet');
  });

  it('AND ON NO OTHER BEAT OF MEET DAY — every one named', () => {
    expect(shellAffordanceFor(MEET, 'weigh-in')).toBe(null);
    expect(shellAffordanceFor(MEET, 'openers')).toBe(null);
    expect(shellAffordanceFor(MEET, 'attempt-select')).toBe(null);
    expect(shellAffordanceFor(MEET, 'walkout')).toBe(null);
    expect(shellAffordanceFor(MEET, 'lift')).toBe(null);
    expect(shellAffordanceFor(MEET, 'deliberation')).toBe(null);
    expect(shellAffordanceFor(MEET, 'verdict')).toBe(null);
    // GDD §6.3: `BombOutView` has an `onDone` wired to the same route, and a
    // second control on that beat would clutter the one screen the GDD asks to
    // be left somber.
    expect(shellAffordanceFor(MEET, 'bombed')).toBe(null);
  });

  it('the already-trained-today surface gets the pill, because it IS the check-in', () => {
    // GDD §3.2 allows one session a day, and `SessionScreen` renders its
    // "already trained" surface while `state.phase === 'check-in'` — the same
    // beat as a fresh check-in. `shellWiring.test.ts` pins that gate against the
    // real source; this is the other half of the join. Together they say: a
    // player who opens the app for the second time today gets somewhere to go
    // rather than a dead end, which is GDD §12.3's "never punish daily
    // engagement" line applied to navigation.
    expect(shellAffordanceFor(SESSION, 'check-in')).toBe('open-meet');
    expect(shellAffordanceFor(AS_PLAYER('session'), 'check-in')).toBe('open-meet');
  });

  it('the answer does not depend on HOW the player got to the surface', () => {
    // `source` is why the route is up — default launch, walked to, or pinned by
    // a debug URL. The gate is about the BEAT, so all three agree.
    for (const source of ['default', 'player', 'debug'] as const) {
      const route: ShellRoute = { surface: 'session', source };
      expect(shellAffordanceFor(route, 'check-in'), source).toBe('open-meet');
      expect(shellAffordanceFor(route, 'set'), source).toBe(null);
      expect(shellAffordanceFor({ surface: 'meet', source }, 'recap'), source).toBe('leave-meet');
      expect(shellAffordanceFor({ surface: 'meet', source }, 'lift'), source).toBe(null);
    }
  });

  it('a beat belonging to the OTHER surface draws nothing', () => {
    // Guards against the two lists being merged into one: the session's beats
    // must not open a way out of a meet, and vice versa.
    expect(shellAffordanceFor(SESSION, 'recap')).toBe(null);
    expect(shellAffordanceFor(SESSION, 'weigh-in')).toBe(null);
    expect(shellAffordanceFor(MEET, 'check-in')).toBe(null);
    expect(shellAffordanceFor(MEET, 'close-out')).toBe(null);
  });

  it('draws nothing before a surface has reported a beat, or over the harness', () => {
    expect(shellAffordanceFor(DEFAULT_ROUTE, null)).toBe(null);
    expect(shellAffordanceFor(AS_PLAYER('replay'), null)).toBe(null);
    expect(shellAffordanceFor(AS_PLAYER('replay'), 'check-in')).toBe(null);
    expect(shellAffordanceFor(AS_PLAYER('replay'), 'recap')).toBe(null);
  });

  it('THE WAY TO EMPIRE IS ON THE SAME SESSION BEATS AS MEET DAY', () => {
    expect(shellEmpireAffordanceFor(SESSION, 'check-in')).toBe('open-empire');
    expect(shellEmpireAffordanceFor(SESSION, 'briefing')).toBe('open-empire');
    expect(shellEmpireAffordanceFor(SESSION, 'close-out')).toBe('open-empire');
    expect(shellEmpireAffordanceFor(SESSION, 'set')).toBe(null);
    expect(shellEmpireAffordanceFor(SESSION, 'rest')).toBe(null);
  });

  it('THE WAY BACK FROM EMPIRE IS ON THE FLOOR BEAT', () => {
    expect(shellEmpireAffordanceFor(AS_PLAYER('empire'), 'floor')).toBe('leave-empire');
    expect(shellEmpireAffordanceFor(AS_PLAYER('empire'), null)).toBe(null);
    expect(shellEmpireAffordanceFor(MEET, 'recap')).toBe(null);
    expect(shellEmpireAffordanceFor(SESSION, 'recap')).toBe(null);
  });

  it('a live cut-in takes the Empire chrome off too', () => {
    expect(shellEmpireAffordanceFor(SESSION, 'check-in', 'live')).toBe(null);
    expect(shellEmpireAffordanceFor(AS_PLAYER('empire'), 'floor', 'live')).toBe(null);
    expect(shellEmpireAffordanceFor(SESSION, 'check-in', 'none')).toBe('open-empire');
  });

  it('every beat of the game is in the answer sheet, and answers as written', () => {
    // Exhaustive sweep, driven by the HAND-WRITTEN table rather than by
    // `SHELL_NAV`. It cannot go vacuous: the table's type is
    // `Record<SessionPhase, …>`, so emptying it is a type error and not a green
    // run.
    for (const [phase, drawn] of Object.entries(ON_A_SESSION_BEAT)) {
      expect(shellAffordanceFor(DEFAULT_ROUTE, phase as SessionPhase), phase).toBe(drawn);
    }
    for (const [phase, drawn] of Object.entries(ON_A_MEET_BEAT)) {
      expect(shellAffordanceFor(MEET, phase as MeetDayPhaseId), phase).toBe(drawn);
    }
    // ...and the sweep really did run, on every beat there is.
    expect(Object.keys(ON_A_SESSION_BEAT).sort()).toEqual([...SESSION_PHASES].sort());
    expect(Object.keys(ON_A_MEET_BEAT).sort()).toEqual([...MEET_DAY_PHASES].sort());
  });

  it('A LIVE CUT-IN TAKES THE CHROME OFF EVERY BEAT — GDD §7.2, tap to dismiss', () => {
    // THE SWEEP IS THE POINT. Not "the gate returns null for a cut-in on the
    // check-in" — for EVERY beat that would otherwise carry a control, because
    // the defect is about the pill's paint order and not about any one screen.
    //
    // `AppShell` draws the pill as a sibling AFTER the surface, and `CutInHost`
    // mounts §7.2's overlay INSIDE the surface, so the pill paints on top of
    // the interrupt and takes the tap meant to dismiss it — measured on
    // rendered pixels by `tools/capture-cutin.mjs`, which hit-tested the pill's
    // own centre through a live cut-in and got the pill back. §7.2 makes the
    // whole screen the dismiss target, so a control that navigates instead is
    // a hole in it.
    let covered = 0;
    for (const [phase, drawn] of Object.entries(ON_A_SESSION_BEAT)) {
      if (drawn === null) continue;
      covered += 1;
      expect(shellAffordanceFor(DEFAULT_ROUTE, phase as SessionPhase, 'live'), phase).toBe(null);
      // ...and the same call with no cut-in still draws it, so this is not
      // passing because the gate stopped working altogether.
      expect(shellAffordanceFor(DEFAULT_ROUTE, phase as SessionPhase, 'none'), phase).toBe(drawn);
    }
    for (const [phase, drawn] of Object.entries(ON_A_MEET_BEAT)) {
      if (drawn === null) continue;
      covered += 1;
      expect(shellAffordanceFor(MEET, phase as MeetDayPhaseId, 'live'), phase).toBe(null);
      expect(shellAffordanceFor(MEET, phase as MeetDayPhaseId, 'none'), phase).toBe(drawn);
    }
    // The sweep found beats to sweep. Without this it would pass on a table
    // that gave the pill to nothing at all.
    expect(covered).toBeGreaterThan(0);
  });

  it('and `none` is what the two-argument call means, so old call sites are safe', () => {
    // The third argument is optional, which is the only reason the dozens of
    // two-argument assertions above still compile. Pinned so that default can
    // never quietly become `'live'` — which would hide the chrome everywhere.
    expect(shellAffordanceFor(DEFAULT_ROUTE, 'check-in')).toBe(
      shellAffordanceFor(DEFAULT_ROUTE, 'check-in', 'none'),
    );
    expect(shellAffordanceFor(DEFAULT_ROUTE, 'check-in')).toBe('open-meet');
  });
});

// ---------------------------------------------------------------------------
// The answer sheet and the tuning module are two statements of one fact
// ---------------------------------------------------------------------------

describe('the table and SHELL_NAV are two statements of one fact', () => {
  // The pair of properties this file needs at once:
  //
  //   - the assertions above are literals, so they cannot go vacuous when
  //     `SHELL_NAV` is emptied;
  //   - and this block says the literals are still describing the REAL
  //     constant, so a playtester who turns `SHELL_NAV` and forgets the table —
  //     or turns the table and forgets `SHELL_NAV` — is told by name.
  //
  // Neither alone is enough. Only the literals can fail vacuously; only this
  // can drift.

  it('SHELL_NAV.SESSION_PHASES is exactly the beats the table gives the pill to', () => {
    expect([...SHELL_NAV.SESSION_PHASES].sort()).toEqual(
      tableBeatsFor(ON_A_SESSION_BEAT, 'open-meet'),
    );
    // Spelled out, so a failure names the beats rather than only a diff.
    expect(tableBeatsFor(ON_A_SESSION_BEAT, 'open-meet')).toEqual([
      'briefing',
      'check-in',
      'close-out',
    ]);
  });

  it('SHELL_NAV.MEET_PHASES is exactly the beats the table gives the way out to', () => {
    expect([...SHELL_NAV.MEET_PHASES].sort()).toEqual(tableBeatsFor(ON_A_MEET_BEAT, 'leave-meet'));
    expect(tableBeatsFor(ON_A_MEET_BEAT, 'leave-meet')).toEqual(['recap']);
  });

  it('and neither list is empty, which is the mutation that used to pass', () => {
    // Stated on its own, because "the lists are non-empty" is the property the
    // whole piece rests on: an empty `SESSION_PHASES` puts meet day out of reach
    // again, and an empty `MEET_PHASES` makes the recap and the result card dead
    // ends again — the two defects this piece was built to close.
    expect(SHELL_NAV.SESSION_PHASES.length).toBeGreaterThan(0);
    expect(SHELL_NAV.MEET_PHASES.length).toBeGreaterThan(0);
  });

  it('every listed beat is a beat the game actually has', () => {
    // Guards the other direction: `MEET_PHASES` naming a phase that
    // `meetDay.ts` does not have would make the gate silently never fire.
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
    // AND NO STAND-IN SERVER. `?meet=live` is the debug route to the PLAYED
    // loop, so it plays against the app's real connection like any other meet.
    // It is the one debug entry that must not carry a preview lifter.
    expect(entry.meet?.serverPort).toBeUndefined();
  });

  it('A FRAME CARRIES A STAND-IN SERVER EXACTLY WHEN IT CARRIES A SCRIPTED STATE [a-preview-server-cannot-reach-a-played-meet]', () => {
    // ===================================================================
    // THE PIN THAT KEEPS THE FABRICATED LIFTER OFF THE PLAYED PATH
    // ===================================================================
    // `useMeetDay` used to choose its server with
    //
    //     frozen ? previewServerRecord() : newServerRecord(SIGNUP_DAY)
    //
    // — one ternary doing two jobs, whose LIVE arm handed the played app a
    // lifter who had never trained, for ever. The replacement is not a better
    // ternary: it is that the preview's server and the preview's state are ONE
    // VALUE, so they cannot disagree about which of the two a frame is.
    //
    // A BICONDITIONAL, ASSERTED IN BOTH DIRECTIONS AND EXHAUSTIVELY. Checking
    // only "every scripted moment has a port" would pass a build in which
    // `?meet=live` had one too, which is the direction that reaches a player.
    const rows = [
      ...MEET_MOMENTS.map((moment) => [`?meet=${moment}`, resolveEntry(`?meet=${moment}`).meet] as const),
      ['?meet=live', resolveEntry('?meet=live').meet] as const,
    ];
    // The control: without it an empty list satisfies every claim below.
    expect(rows.length).toBe(MEET_MOMENTS.length + 1);
    for (const [search, entry] of rows) {
      expect(entry, search).toBeDefined();
      expect(
        (entry?.state !== undefined) === (entry?.serverPort !== undefined),
        `${search}: state ${entry?.state === undefined ? 'absent' : 'present'},` +
          ` serverPort ${entry?.serverPort === undefined ? 'absent' : 'present'}`,
      ).toBe(true);
    }
    // And both arms of the biconditional are actually exercised by the list, so
    // it is not vacuously true of a set that is all one kind.
    expect(rows.filter(([, e]) => e?.serverPort !== undefined).length).toBe(MEET_MOMENTS.length);
    expect(rows.filter(([, e]) => e?.serverPort === undefined).length).toBe(1);
  });

  it('and a scripted frame’s server is that frame’s own, never a shared one', () => {
    // Two `?meet=recap` resolutions must not hand back the same port: a preview
    // banks its meet into whatever row it was given, and a shared row would make
    // the second capture of the same beat hit MEET_ALREADY_RECORDED and
    // photograph an empty recap.
    const first = resolveEntry('?meet=recap').meet?.serverPort;
    const second = resolveEntry('?meet=recap').meet?.serverPort;
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(second).not.toBe(first);
  });

  it('the preview’s server describes the lifter the preview data describes', () => {
    // The reason the preview needs a server of its own at all: `previewContext`
    // is a lifter with a competition history, and the app's real connection is
    // whoever is playing. Read through the boundary, because there is no row to
    // read.
    const port = resolveEntry('?meet=recap').meet?.serverPort;
    expect(port).toBeDefined();
    const total = readingValue(readTotalKg(openingCache(port!)));
    expect(total).toBe(MEET_PREVIEW.PREVIOUS_BEST_TOTAL_KG);
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
