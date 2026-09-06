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

import {
  isLiveMeetRequest,
  meetPreviewFrom,
  previewServerRecord,
  previewStateFor,
  showsCard,
  holdWalkoutAtMs,
} from '../game/meetPreview';
import { replayRequestFrom } from '../lift/replayRoute';
import { localSessionServer } from '../session/localSessionServer';
import { previewFrameFor, sessionPreviewFrom } from '../session/sessionPreview';
import type { MeetServerPort } from '../game/meetClient';
import type { MeetDayPhaseId, MeetDayState } from '../game/meetDay';
import type { ReplayRequest } from '../lift/liftReplay';
import type { SessionPhase } from '../game/session';
import type { SessionPreviewFrame } from '../session/useSession';
import { SHELL_NAV } from './shellTuning';

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

/**
 * The four things the shell can put on screen.
 *
 * `replay` is the scripted single rep the lift-mechanic harness photographs. It
 * is deliberately NOT player-reachable — it is a debug surface and appears in
 * `playerReachableFrom` nowhere.
 *
 * `gym` is GDD §5's Gym Empire — CROSSING 6 in CLAUDE.md's Session
 * Coordination section. Reachable only from `session`, and only by a real
 * press: there is no debug query-string entry point for it anywhere in this file's debug
 * section below, unlike `meet`, `session` and `replay`, which all have one for
 * the evidence harness. Gym Empire has no scripted moment a screenshot tool
 * needs, so it does not get one either.
 */
export type ShellSurface = 'session' | 'meet' | 'replay' | 'gym';

export const SHELL_SURFACES = Object.freeze([
  'session',
  'meet',
  'replay',
  'gym',
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
 * Four, up from two: the daily session, meet day, and now Gym Empire (GDD §5)
 * are the surfaces this module moves between — CROSSING 6.
 *
 * THIS IS NOT THE CLAIM THAT NOTHING ELSE RENDERS. `LicensingScreen`
 * (`src/licensing/LicensedPanelView.tsx`) is a GDD §7.3 identity-tier shop that
 * renders, has tests, and is reachable at `licensing.html?panel=shop` through
 * its own entry point (`src/licensing/licensingEntry.tsx`) — it is simply not
 * wired to this shell, so no `ShellIntent` reaches it and `ShellSurface` does
 * not name it. Whether that screen counts as one of GDD §2's four modes for the
 * purpose of "a player can reach every mode" is a scoping call, and this file
 * is not the place it gets made. What this comment states is only what is true
 * here: four intents, three player-reachable surfaces besides the harness, and
 * a fourth surface (`LicensingScreen`) that exists behind a separate entry
 * point rather than behind nothing.
 */
export type ShellIntent = 'open-meet' | 'leave-meet' | 'open-gym' | 'leave-gym';

export const SHELL_INTENTS = Object.freeze([
  'open-meet',
  'leave-meet',
  'open-gym',
  'leave-gym',
] as const satisfies readonly ShellIntent[]);

/**
 * THE ROUTE GRAPH. One edge per intent, per surface it applies from.
 *
 * `session --open-meet--> meet` is the edge that did not exist and that made
 * the whole of GDD §6 unreachable on a device.
 * `meet --leave-meet--> session` is the way back, which GDD §6.5's recap and
 * §6.3's bomb-out both need and which used to be `window.location.search = ''`
 * — a full page reload, on web only, doing nothing at all on a phone.
 *
 * `session --open-gym--> gym` and `gym --leave-gym--> session` are CROSSING
 * 6's pair, built the same shape as the meet pair above. THE MID-MEET REFUSAL
 * IS STRUCTURAL, NOT A GATE SOMEBODY COULD FORGET: `open-gym` matches only
 * `route.surface === 'session'`, so dispatching it from `'meet'` is the same
 * no-op every other inapplicable intent already is here — there is no arm
 * that reads `route.surface === 'meet'` for `open-gym` to fall into. GDD §6.2's
 * attempt loop is uninterruptible, and a player cannot duck into the gym
 * mid-meet twice over: `gymAffordanceFor` in this same file never offers the
 * control while `route.surface !== 'session'` (so no meet screen ever draws
 * it), and even a dispatch that bypassed the UI entirely would still refuse
 * here. `shellRoute.test.ts`'s full surface-by-intent cross product is what
 * proves both of those are true of the real graph rather than of this
 * paragraph.
 */
export function navigate(route: ShellRoute, intent: ShellIntent): ShellRoute {
  if (intent === 'open-meet' && route.surface === 'session') {
    return { surface: 'meet', source: 'player' };
  }
  if (intent === 'leave-meet' && route.surface === 'meet') {
    return { surface: 'session', source: 'player' };
  }
  if (intent === 'open-gym' && route.surface === 'session') {
    return { surface: 'gym', source: 'player' };
  }
  if (intent === 'leave-gym' && route.surface === 'gym') {
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
  // UX-02: BACK TO TRAINING is not Empire operating chrome. The way out lives
  // on More as `gymscreen-leave-gym`. The gym surface draws none of the
  // shell's pills.
  if (route.surface === 'gym') return null;
  if (phase === null) return null;
  if (route.surface === 'session') {
    return (SHELL_NAV.SESSION_PHASES as readonly string[]).includes(phase) ? 'open-meet' : null;
  }
  if (route.surface === 'meet') {
    return (SHELL_NAV.MEET_PHASES as readonly string[]).includes(phase) ? 'leave-meet' : null;
  }
  return null;
}

/**
 * THE SECOND AFFORDANCE, drawn ALONGSIDE `shellAffordanceFor`'s pill rather
 * than instead of it — CROSSING 6's answer to "the concrete navigation
 * shape... is a builder decision". Kept as its own function rather than
 * folded into a widened `shellAffordanceFor` return, because every existing
 * caller and every existing pin in `shellRoute.test.ts` already assumes that
 * function returns AT MOST ONE `ShellIntent`; two independently-gated
 * single-valued functions compose to "zero, one or two pills" without
 * touching that assumption or any of its pinned cases.
 *
 * GATED IDENTICALLY TO THE MEET PILL ON THE WAY IN — same `SESSION_PHASES`
 * list, same cut-in rule. Nothing yet distinguishes "safe to open a meet"
 * from "safe to open the gym", and inventing a second, ungated judgement with
 * no evidence behind it would be exactly the unplayed-number problem
 * CLAUDE.md's "Game Feel Values Must Be Tunable" warns about — so this reads
 * the one list a human will actually tune rather than a second one nobody
 * has reason to diverge from yet.
 *
 * NEVER OFFERED OFF THE SESSION SURFACE — in particular, never mid-meet.
 * `route.surface !== 'session'` refuses unconditionally, first, before the
 * phase check, so a player on `meet` is never shown a way to duck into the
 * gym. `navigate` refuses the same route one layer down even if this gate
 * were bypassed (see its own comment), so the property holds twice over.
 */
export function gymAffordanceFor(
  route: ShellRoute,
  phase: SessionPhase | null,
  cutIn: CutInPresence = 'none',
): ShellIntent | null {
  if (cutIn === 'live') return null;
  if (route.surface !== 'session') return null;
  if (phase === null) return null;
  return (SHELL_NAV.SESSION_PHASES as readonly string[]).includes(phase) ? 'open-gym' : null;
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
  /**
   * The stand-in server this scripted lifter's history lives in, or `undefined`
   * for a meet that is PLAYED and therefore uses the app's own connection.
   *
   * PRESENT EXACTLY WHEN `state` IS, and `shellRoute.test.ts` pins that
   * biconditional over every moment `MEET_MOMENTS` declares plus `?meet=live`.
   * That equivalence is the replacement for `useMeetDay`'s old
   * `frozen ? previewServerRecord() : newServerRecord(...)` — one ternary that
   * was doing two jobs, whose live arm handed the played app a fabricated lifter
   * for ever. A boolean and a record that had to agree are now one value that
   * cannot disagree with itself.
   */
  readonly serverPort: MeetServerPort | undefined;
}

/**
 * The scripted lifter's stand-in server. DEBUG ONLY.
 *
 * ===========================================================================
 * WHY THE PREVIEW NEEDS A SERVER OF ITS OWN AT ALL
 * ===========================================================================
 * `previewContext()` describes a lifter with a competition history — a 605 kg
 * best total and per-lift bests. The app's real connection describes whoever is
 * actually playing, which in a capture run is a brand-new account. Photograph
 * the recap against the real connection and it reads FIRST TOTAL, the PR branch
 * is unphotographable, and `04-recap-with-way-back.png` stops being a picture of
 * what it claims to be.
 *
 * ===========================================================================
 * AND WHY IT CANNOT LEAK ONTO THE PLAYED PATH
 * ===========================================================================
 * Four things, in decreasing order of how much they would have to be broken:
 *
 *   1. It is only ever attached to an entry that has a scripted `state` — the
 *      `?meet=live` arm below leaves it `undefined` — and that biconditional is
 *      pinned exhaustively.
 *   2. An entry only reaches `MeetScreen` through `frozenMeetFor`, which returns
 *      `undefined` unless `route.source === 'debug'`. A player leaving a debug
 *      meet and re-entering from the session gets a LIVE meet; that was already
 *      load-bearing and already pinned.
 *   3. `useMeetDay` cannot fabricate a substitute if it is handed nothing,
 *      because `serverPort` is a required parameter with no default, and
 *      `ServerRecord`/`newServerRecord` are names `useMeetDay.test.ts` forbids
 *      it. There is no fallback to fall back to.
 *   4. `tools/verify-shell-route.mjs` plays a real session with a mouse on the
 *      shipped route — no query string — and asserts meet day's opener is
 *      derived from the e1RM that session banked. That is the instrument that
 *      would have caught the original defect, and it now exists.
 *
 * A REAL `localSessionServer`, not a stub: same closure, same latency, same
 * `applyMeetResult`. Only the row it starts from differs, which is why the
 * preview's recap has a real total on it.
 *
 * @guarantee a-preview-server-cannot-reach-a-played-meet
 */
function previewMeetPort(): MeetServerPort {
  return localSessionServer({ record: previewServerRecord() });
}

/**
 * A meet pinned by the query string, or `undefined`.
 *
 * A frame is a scripted `MeetDayState` AND how to draw it AND the server its
 * lifter exists in, because two of the walk-out beats are the same state
 * photographed at different instants and all of them are a lifter the app's own
 * connection has never heard of.
 */
export function meetEntryFrom(search: string | null): MeetEntry | undefined {
  if (search === null) return undefined;
  if (isLiveMeetRequest(search)) {
    // A played meet: no preview state, so the loop builds its own and every
    // beat timer runs — including the walk-out's, which is why the live shot is
    // the one that shows the choreography moving on its own.
    //
    // AND NO PREVIEW SERVER, for the same reason. `?meet=live` is the debug
    // route to the PLAYED loop, so it plays against the app's real connection
    // like any other meet. It is the one debug entry that must not get one.
    return { state: undefined, card: false, holdWalkoutAtMs: null, serverPort: undefined };
  }
  const request = meetPreviewFrom(search);
  if (request === null) return undefined;
  return {
    state: previewStateFor(request),
    card: showsCard(request.moment),
    // Null for every beat but the two mid-motion walk-out ones.
    holdWalkoutAtMs: holdWalkoutAtMs(request.moment),
    serverPort: previewMeetPort(),
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
