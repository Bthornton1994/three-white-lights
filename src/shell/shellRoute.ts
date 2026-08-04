/**
 * shellRoute.ts — WHERE THE APP IS, AND WHERE IT CAN GO FROM THERE.
 *
 * ===========================================================================
 * THE GAP THIS EXISTS TO CLOSE
 * ===========================================================================
 * Every piece of the loop was built and tested, and the loop was still not
 * playable: `App.tsx` routed on query strings alone, so `MeetScreen` was
 * reachable only by typing `?meet=` into a browser. Nothing under `src/session`
 * imported `src/meet`, nothing under `src/meet` imported `src/session`, and a
 * player on a phone could not get from a daily session to a meet at all. Five
 * rounds of meet-day work — a hall, sound, haptics, choreography, attempt
 * selection, judging, bomb-out, recap, result card — sat behind a debug URL.
 *
 * The join is a ROUTE, and this module is it: which surface is on screen, why,
 * and which surfaces a player can reach from it WITHOUT a debug URL. That last
 * clause is the whole point, and `playerReachableFrom` and `pathBetween` below
 * exist so a test can assert reachability rather than assert that a component
 * exists. A check that only says "MeetScreen is imported somewhere" would have
 * passed on the broken tree.
 *
 * ===========================================================================
 * PURE
 * ===========================================================================
 * Zero React, zero I/O, no `window`. The caller hands in a `location.search`
 * string — or `null`, which is what a native build has, where there is no URL
 * and every debug branch below is correctly dead.
 *
 * ===========================================================================
 * WHAT THIS DELIBERATELY IS NOT
 * ===========================================================================
 * It is not the Career calendar. GDD §6.1 enters a meet by selecting one from a
 * calendar of local -> regional -> nationals -> worlds meets, gated by
 * qualifying totals, and Career mode is zero files. What is here is ONE ungated
 * door to the ONE local meet the game has. When Career exists, `open-meet`
 * stops going straight to `MeetScreen` and goes to the calendar instead, the
 * calendar applies the qualifying-total gate, and this module's job is
 * unchanged: it still only says which surface is up. See `SHELL_COPY` in
 * `shellTuning.ts` for why the label does not promise a calendar.
 *
 * It is also not progression. The shell routes and renders; every mutation to
 * Total, e1RM, streak state or a meet result goes through the server bodies in
 * `sessionServer.ts` / `meetServer.ts` exactly as it did before, and nothing in
 * this file or the shell above it writes one. In particular the shell never
 * surfaces a Total: GDD §3.2 and §6.4 put Total on meet day and no other day,
 * so a Total in the app's chrome — where it would be visible during a training
 * session — is a refusal condition, not a nice-to-have.
 */

import { isLiveMeetRequest, meetPreviewFrom, previewStateFor, showsCard, holdWalkoutAtMs } from '../game/meetPreview';
import { replayRequestFrom } from '../lift/replayRoute';
import { previewFrameFor, sessionPreviewFrom } from '../session/sessionPreview';
import type { MeetDayPhaseId, MeetDayState } from '../game/meetDay';
import type { ReplayRequest } from '../lift/liftReplay';
import type { SessionPhase } from '../game/session';
import type { SessionPreviewFrame } from '../session/useSession';
import { SHELL_NAV } from './shellTuning';

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

/**
 * The three things the shell can put on screen.
 *
 * `replay` is the scripted single rep the lift-mechanic harness photographs. It
 * is deliberately NOT player-reachable — it is a debug surface and appears in
 * `playerReachableFrom` nowhere.
 */
export type ShellSurface = 'session' | 'meet' | 'replay';

export const SHELL_SURFACES = Object.freeze([
  'session',
  'meet',
  'replay',
] as const satisfies readonly ShellSurface[]);

/** Why the shell is on this surface. */
export type ShellSource =
  /** What the app opens on with no URL at all (GDD §3.2: the daily session). */
  | 'default'
  /** The player navigated here, in-app, with a finger. */
  | 'player'
  /** A debug query string pinned it. The capture harness, and nothing else. */
  | 'debug';

export interface ShellRoute {
  readonly surface: ShellSurface;
  readonly source: ShellSource;
}

/**
 * What the app opens on.
 *
 * GDD §3.2 and §12.2: the daily session, with no splash and no home screen in
 * front of it, because §12.2 measures the retention core on time-to-first-input
 * and every screen before the first question answers nothing.
 */
export const DEFAULT_ROUTE: ShellRoute = Object.freeze({ surface: 'session', source: 'default' });

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/**
 * Everything a player can ask the shell to do.
 *
 * Two, and that is the honest size of the shell's ROUTE GRAPH right now: the
 * daily session and meet day are the surfaces this module moves between.
 *
 * THIS IS NOT THE CLAIM THAT NOTHING ELSE RENDERS. `LicensingScreen`
 * (`src/licensing/LicensedPanelView.tsx`) is a GDD §7.3 identity-tier shop that
 * renders, has tests, and is reachable at `licensing.html?panel=shop` through
 * its own entry point (`src/licensing/licensingEntry.tsx`) — it is simply not
 * wired to this shell, so no `ShellIntent` reaches it and `ShellSurface` does
 * not name it. Whether that screen counts as one of GDD §2's four modes for the
 * purpose of "a player can reach every mode" is a scoping call, and this file
 * is not the place it gets made. What this comment states is only what is true
 * here: two intents, two player-reachable surfaces, and a third surface that
 * exists behind a separate entry point rather than behind nothing.
 */
export type ShellIntent = 'open-meet' | 'leave-meet';

export const SHELL_INTENTS = Object.freeze([
  'open-meet',
  'leave-meet',
] as const satisfies readonly ShellIntent[]);

/**
 * THE ROUTE GRAPH. One edge per intent, per surface it applies from.
 *
 * `session --open-meet--> meet` is the edge that did not exist and that made
 * the whole of GDD §6 unreachable on a device.
 * `meet --leave-meet--> session` is the way back, which GDD §6.5's recap and
 * §6.3's bomb-out both need and which used to be `window.location.search = ''`
 * — a full page reload, on web only, doing nothing at all on a phone.
 */
export function navigate(route: ShellRoute, intent: ShellIntent): ShellRoute {
  if (intent === 'open-meet' && route.surface === 'session') {
    return { surface: 'meet', source: 'player' };
  }
  if (intent === 'leave-meet' && route.surface === 'meet') {
    return { surface: 'session', source: 'player' };
  }
  return route;
}

/**
 * Every surface a player can reach from `from` using only in-app navigation.
 *
 * Breadth-first over `navigate`, so it cannot drift from the graph: delete an
 * edge in `navigate` and this shrinks. Includes `from` itself — you are already
 * there. Sorted, so a test can compare it without ordering noise.
 */
export function playerReachableFrom(from: ShellSurface): readonly ShellSurface[] {
  const seen = new Set<ShellSurface>([from]);
  const queue: ShellSurface[] = [from];
  while (queue.length > 0) {
    const surface = queue.shift() as ShellSurface;
    for (const intent of SHELL_INTENTS) {
      const next = navigate({ surface, source: 'player' }, intent).surface;
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return [...seen].sort();
}

/**
 * The shortest sequence of intents that gets a player from `from` to `to`, or
 * `null` when no sequence does.
 *
 * THIS IS THE FUNCTION THE REACHABILITY TESTS BITE ON. `pathBetween('session',
 * 'meet')` returning null means a player holding a phone cannot get to meet
 * day, whatever else is green — which is precisely the state the repository was
 * in while 2128 tests passed.
 */
export function pathBetween(from: ShellSurface, to: ShellSurface): readonly ShellIntent[] | null {
  if (from === to) return [];
  const cameBy = new Map<ShellSurface, readonly ShellIntent[]>([[from, []]]);
  const queue: ShellSurface[] = [from];
  while (queue.length > 0) {
    const surface = queue.shift() as ShellSurface;
    const soFar = cameBy.get(surface) ?? [];
    for (const intent of SHELL_INTENTS) {
      const next = navigate({ surface, source: 'player' }, intent).surface;
      if (cameBy.has(next)) continue;
      const path = [...soFar, intent];
      if (next === to) return path;
      cameBy.set(next, path);
      queue.push(next);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// The chrome gate
// ---------------------------------------------------------------------------

/**
 * Whether a GDD §7.2 cut-in is on screen over the current surface.
 *
 * A union rather than a boolean because it is the third argument of a gate and
 * a bare `true` at a call site says nothing about what is true.
 */
export type CutInPresence = 'live' | 'none';

/**
 * The affordance the shell should draw over the current surface, or `null` for
 * none.
 *
 * The shell owns this rather than the screens, for the reason `App.tsx` has
 * always given: the way into and out of a mode is a route, and the screens are
 * renderers. It is gated on the surface's own beat (`phase`), because a
 * navigation control drawn over a live set is a mis-tap on the one beat where a
 * mis-tap costs a rep. `SHELL_NAV` holds the two phase lists and the comment
 * arguing them.
 *
 * `phase` is `null` when the surface has not reported one yet, or when the
 * surface has no phases (the replay harness). No phase, no chrome.
 *
 * ---------------------------------------------------------------------------
 * AND NO CHROME OVER A CUT-IN, WHICH IS THE SAME RULE
 * ---------------------------------------------------------------------------
 * GDD §7.2 requires a cut-in to be "always skippable — tap to dismiss", and the
 * whole screen is the dismiss target. `AppShell` draws the pill as a SIBLING of
 * the surface, after it, so an overlay mounted inside the surface paints
 * UNDERNEATH the pill: a tap that lands on the pill navigates to meet day
 * instead of dismissing the interrupt. Measured on rendered pixels by
 * `tools/capture-cutin.mjs`, which hit-tested the pill's own centre through a
 * live cut-in and found the pill.
 *
 * The overlay cannot fix it from its side — it would have to give the entire
 * surface a stacking order that buried the pill permanently — so the fix is
 * here, and it is the gate this function already applies over a live set. Same
 * argument, same shape: no chrome on a beat where a mis-tap costs the player
 * something.
 */
export function shellAffordanceFor(
  route: ShellRoute,
  phase: SessionPhase | MeetDayPhaseId | null,
  cutIn: CutInPresence = 'none',
): ShellIntent | null {
  if (cutIn === 'live') return null;
  if (phase === null) return null;
  if (route.surface === 'session') {
    return (SHELL_NAV.SESSION_PHASES as readonly string[]).includes(phase) ? 'open-meet' : null;
  }
  if (route.surface === 'meet') {
    return (SHELL_NAV.MEET_PHASES as readonly string[]).includes(phase) ? 'leave-meet' : null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// The debug entry points
// ---------------------------------------------------------------------------
//
// THESE ARE LOAD-BEARING FOR THE RUN'S EVIDENCE, NOT LEFTOVERS. Four tools
// drive the app through them and there is no other way to photograph a beat a
// wall clock cannot hit:
//
//   ?replay=<load>&moment=<id>   tools/capture-lift.mjs, verify-lift-shots.mjs
//   ?session=<moment>            tools/capture-session.mjs,
//                                verify-session-boundary.mjs
//   ?meet=<moment>               tools/capture-meet.mjs
//   ?meet=live                   tools/capture-meet.mjs --live
//
// A player never reaches one: `entryRoute` is the only reader, it runs once at
// launch, and no `ShellIntent` produces a `debug` route.

/** The frozen meet beat a query string asks for, and how to draw it. */
export interface MeetEntry {
  /** The scripted state, or `undefined` for `?meet=live` — a PLAYED meet. */
  readonly state: MeetDayState | undefined;
  /** Open straight onto GDD §6.5's shareable card. */
  readonly card: boolean;
  /** Hold the walk-out's choreography at this instant, or `null` to let it run. */
  readonly holdWalkoutAtMs: number | null;
}

/**
 * A meet pinned by the query string, or `undefined`.
 *
 * A frame is a scripted `MeetDayState` AND how to draw it, because two of the
 * walk-out beats are the same state photographed at different instants.
 */
export function meetEntryFrom(search: string | null): MeetEntry | undefined {
  if (search === null) return undefined;
  if (isLiveMeetRequest(search)) {
    // A played meet: no preview state, so the loop builds its own and every
    // beat timer runs — including the walk-out's, which is why the live shot is
    // the one that shows the choreography moving on its own.
    return { state: undefined, card: false, holdWalkoutAtMs: null };
  }
  const request = meetPreviewFrom(search);
  if (request === null) return undefined;
  return {
    state: previewStateFor(request),
    card: showsCard(request.moment),
    // Null for every beat but the two mid-motion walk-out ones.
    holdWalkoutAtMs: holdWalkoutAtMs(request.moment),
  };
}

/**
 * A session beat pinned by the query string, or `undefined`.
 *
 * A frame is a scripted `SessionState` AND the `ProgressionCache` its numbers
 * are read out of — the close-out prints what the boundary says, so a preview
 * without a cache would photograph the wrong figures.
 */
export function sessionEntryFrom(search: string | null): SessionPreviewFrame | undefined {
  if (search === null) return undefined;
  const request = sessionPreviewFrom(search);
  return request === null ? undefined : previewFrameFor(request);
}

/** A scripted rep pinned by the query string, or `undefined`. */
export function replayEntryFrom(search: string | null): ReplayRequest | undefined {
  if (search === null) return undefined;
  return replayRequestFrom(search) ?? undefined;
}

/**
 * Everything a launch URL asks for: which surface, and the frozen frame to draw
 * on it.
 *
 * ONE PASS, ONE ANSWER. The route and the frame are decided together rather
 * than by two independent parses, so they cannot disagree about which surface a
 * query string meant — and the meet preview, which plays a whole scripted meet
 * through `stepMeetDay` to build its state, is built once rather than once per
 * question asked about it.
 */
export interface ShellEntry {
  readonly route: ShellRoute;
  readonly meet: MeetEntry | undefined;
  readonly session: SessionPreviewFrame | undefined;
  readonly replay: ReplayRequest | undefined;
}

const NO_FRAMES = Object.freeze({ meet: undefined, session: undefined, replay: undefined });

/**
 * Resolve a launch URL.
 *
 * PRECEDENCE IS MEET, THEN REPLAY, THEN SESSION — the order `App.tsx` has
 * always used, restated here because the four harness tools depend on it.
 */
export function resolveEntry(search: string | null): ShellEntry {
  const meet = meetEntryFrom(search);
  if (meet !== undefined) {
    return { ...NO_FRAMES, route: { surface: 'meet', source: 'debug' }, meet };
  }
  const replay = replayEntryFrom(search);
  if (replay !== undefined) {
    return { ...NO_FRAMES, route: { surface: 'replay', source: 'debug' }, replay };
  }
  const session = sessionEntryFrom(search);
  if (session !== undefined) {
    return { ...NO_FRAMES, route: { surface: 'session', source: 'debug' }, session };
  }
  return { ...NO_FRAMES, route: DEFAULT_ROUTE };
}

/** The route a launch URL opens on. */
export function entryRoute(search: string | null): ShellRoute {
  return resolveEntry(search).route;
}

/**
 * The frozen meet frame to draw, or `undefined` for a meet the player is
 * actually playing.
 *
 * THE `source` CHECK IS LOAD-BEARING. A player who leaves a debug meet and then
 * opens meet day again from the session must get a LIVE meet, not the scripted
 * beat the URL still names. Without this the second meet would be the
 * screenshot, frozen, with its timers stopped.
 */
export function frozenMeetFor(entry: ShellEntry, route: ShellRoute): MeetEntry | undefined {
  if (route.surface !== 'meet' || route.source !== 'debug') return undefined;
  return entry.meet;
}

/** The frozen session frame to draw, or `undefined` for a session being played. */
export function frozenSessionFor(
  entry: ShellEntry,
  route: ShellRoute,
): SessionPreviewFrame | undefined {
  if (route.surface !== 'session' || route.source !== 'debug') return undefined;
  return entry.session;
}
