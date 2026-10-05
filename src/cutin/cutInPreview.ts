/**
 * cutInPreview.ts — THE DEBUG ROUTE THAT PUTS A CUT-IN ON SCREEN TO BE LOOKED
 * AT.
 *
 * ===========================================================================
 * WHY THIS HAD TO EXIST
 * ===========================================================================
 *
 * The gate is covered by unit tests, and the gate is only half the piece.
 * `vitest.config.ts` is `environment: node`, so no test in this repository can
 * mount a component: the full-screen tap target, the auto-dismiss timer, the
 * arrival, the scrim and the mount ORDER of the overlay over the screen it
 * interrupts were all verified by reading source text and nothing else. GDD
 * §12.2 grades cut-ins on what they look like. Nobody had looked.
 *
 * So: `?cutin=<moment>` mounts the real overlay, over the real screen, through
 * the real gate, and `tools/capture-cutin.mjs` photographs it.
 *
 * ===========================================================================
 * IT DOES NOT BYPASS THE GATE, AND THAT IS THE POINT
 * ===========================================================================
 *
 * A preview that reached into `CutInView` directly would photograph a component
 * nothing in the app can reach, and would go on passing after the gate stopped
 * firing at all. This route instead hands the gate a REAL BEAT — the same shape
 * `WalkoutView`, `RecapView`, `BombOutView`, `CloseOutView` and `RestView` send
 * — and lets `requestCutIn` decide. The cap applies. The rate applies. The
 * qualification applies: `previewBeatsFor('third-attempt-walkout')` reports a
 * third attempt with nothing bombing, because a beat that did not qualify would
 * photograph an empty screen.
 *
 * THE ONLY THING IT ARRANGES IS THE SEED. §7.2's rates are per session, so most
 * sittings do not fire most moments and a capture that booted an arbitrary one
 * would be photographing a coin toss. `cutInPreviewSeedFor` searches for a seed
 * whose roll ALLOWS the requested moment — a session the gate would have let
 * through on its own — rather than adding a "force" flag the played path could
 * ever reach. A moment with a rate of 0 has no such seed and this refuses.
 *
 * ===========================================================================
 * NOT REACHABLE IN PLAY
 * ===========================================================================
 *
 * A query string, and only a query string. `window.location.search` is `null`
 * on native, where there is no URL, so every branch below is correctly dead
 * there. No `ShellIntent` produces it and no control anywhere navigates to it.
 * Anything unrecognised returns `null` and the app boots normally — the same
 * promise `?meet=nonsense` keeps.
 *
 * PURE. Zero React, zero I/O — it is handed a string, not `window`.
 */

import { ATTEMPTS_PER_LIFT } from '../game/meet';
import {
  CUT_IN_MOMENTS,
  isCutInMoment,
  openCutInSession,
  type CutInBeat,
  type CutInMoment,
} from './cutInGate';
import { CUT_IN_TUNING } from './cutInTuning';

/** Query-string keys, so the harness and the app cannot disagree. */
export const CUT_IN_PARAM = 'cutin';
export const CUT_IN_LIVE_PARAM = 'live';

/** The value of `live` that means "let the clocks run". */
export const CUT_IN_LIVE_VALUE = '1';

export interface CutInPreviewRequest {
  readonly moment: CutInMoment;
  /**
   * HOLD THE CUT-IN ON SCREEN INSTEAD OF LETTING IT TIME OUT.
   *
   * The same idiom as `useMeetDay(preview, frozen)` and `useLiftLoop`'s
   * `paused`, and for the same reason: the whole beat is under two seconds, so
   * a shutter on a loaded machine cannot be relied on to land inside it. A
   * frozen preview is how the overlay gets photographed at all.
   *
   * `?cutin=<moment>&live=1` turns it off, which is the shot that proves the
   * auto-dismiss actually fires rather than merely having a duration — the one
   * thing a frozen capture cannot show.
   */
  readonly frozen: boolean;
}

/**
 * A cut-in preview request, or `null` if this query string is not asking for
 * one.
 *
 * @param search a `location.search`-shaped string, with or without its '?'.
 */
export function cutInPreviewFrom(search: string | null): CutInPreviewRequest | null {
  if (search === null) return null;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return null;
  }
  const raw = params.get(CUT_IN_PARAM);
  if (raw === null) return null;
  // Refuses anything it does not recognise. A debug route that silently
  // half-applies is worse than one that is not there.
  if (!isCutInMoment(raw)) return null;
  return { moment: raw, frozen: params.get(CUT_IN_LIVE_PARAM) !== CUT_IN_LIVE_VALUE };
}

/**
 * A BEAT THAT REALLY QUALIFIES AS THIS MOMENT.
 *
 * Built from the same facts the screens report, so what gets photographed is
 * the gate firing rather than a bypass. Each one is the minimal true statement
 * that `momentFor` accepts:
 *
 *   third-attempt-walkout   the last attempt on a lift, with something already
 *                           banked — because a third attempt that can still
 *                           bomb is disqualified (`cutInGate.ts` §4), and a
 *                           preview that quietly used the disqualified shape
 *                           would photograph nothing at all.
 *   personal-record         a new e1RM, achieved.
 *   bomb-out                the meet ended with a bomb-out.
 *   coach-heavy-set         the session's top set, at the heavy threshold.
 */
export function previewBeatsFor(moment: CutInMoment): readonly CutInBeat[] {
  switch (moment) {
    case 'third-attempt-walkout':
      return [
        {
          kind: 'meet-walkout',
          attemptNumber: ATTEMPTS_PER_LIFT,
          attemptsPerLift: ATTEMPTS_PER_LIFT,
          bombRisk: false,
        },
      ];
    case 'personal-record':
      return [{ kind: 'record', record: 'e1rm', achieved: true }];
    case 'bomb-out':
      return [{ kind: 'meet-over', bombedOut: true }];
    case 'coach-heavy-set':
      return [
        {
          kind: 'work-set',
          loadRatio: CUT_IN_TUNING.COACH_HEAVY_SET_LOAD_RATIO,
          isTopSet: true,
        },
      ];
  }
}

/** The sitting a preview opens. Never collides with `cutInSessionId`'s two. */
export function cutInPreviewSessionId(moment: CutInMoment): string {
  return `preview-${moment}`;
}

/**
 * A SEED WHOSE §7.2 ROLL ALLOWS THIS MOMENT.
 *
 * Searched rather than forced, so the photographed session is one the gate
 * would have permitted anyway.
 *
 * @throws {RangeError} when no seed under the limit allows it — which is what a
 *   `SESSION_ALLOWANCE` of 0 means, and a moment that can never fire has no
 *   picture to take. Loud rather than silent: a preview that quietly showed an
 *   empty screen would look exactly like a broken overlay.
 */
export function cutInPreviewSeedFor(moment: CutInMoment): number {
  const sessionId = cutInPreviewSessionId(moment);
  for (let seed = 0; seed < CUT_IN_TUNING.PREVIEW_SEED_LIMIT; seed += 1) {
    if (openCutInSession({ sessionId, seed }).allowed[moment]) return seed;
  }
  throw new RangeError(
    `cutInPreview: no seed under ${CUT_IN_TUNING.PREVIEW_SEED_LIMIT} allows "${moment}"`,
  );
}

/** Everything the host needs to stage one preview. */
export interface CutInPreviewSession {
  readonly sessionId: string;
  readonly seed: number;
  readonly beats: readonly CutInBeat[];
  readonly frozen: boolean;
}

/** Resolve a request into the sitting the host should open and what to offer. */
export function cutInPreviewSessionFor(request: CutInPreviewRequest): CutInPreviewSession {
  return {
    sessionId: cutInPreviewSessionId(request.moment),
    seed: cutInPreviewSeedFor(request.moment),
    beats: previewBeatsFor(request.moment),
    frozen: request.frozen,
  };
}

/**
 * Every moment the route can be asked for, for the harness to enumerate.
 *
 * The gate's own list, so a firing moment added to GDD §7.2 becomes
 * photographable without anybody remembering to add it here — and a moment
 * removed stops being reachable rather than 404-ing in a tool.
 */
export const CUT_IN_PREVIEW_MOMENTS: readonly CutInMoment[] = CUT_IN_MOMENTS;
