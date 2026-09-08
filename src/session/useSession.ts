/**
 * useSession — the clock, the boundary, and the only place the pure session
 * machine meets the app.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT DOES AND DELIBERATELY DOES NOT DO
 * ---------------------------------------------------------------------------
 * It resolves what day it is, talks to the one `SessionServerPort`, dispatches
 * events into `stepSession`, and runs the timers the loop needs (the briefing
 * reveal and the rest beat). It contains no session logic of its own — no
 * prescription, no scoring, no streak arithmetic, and no reading of a
 * progression fact that is not a call into `sessionClient.ts`. If a rule about
 * the session appears in this file it is in the wrong file (CLAUDE.md: "Never
 * inline game math into a component").
 *
 * ---------------------------------------------------------------------------
 * THE CLOCK LIVES HERE, ON PURPOSE
 * ---------------------------------------------------------------------------
 * `session.ts`, `streak.ts` and `fatigue.ts` are pure and take the day as an
 * integer. Somebody has to read a real clock, and it is this file — once, at
 * the edge, through `streakDayFromLocalWallClock`, which applies GDD §4.1's
 * 03:00 rollover so a session finished at 00:40 counts for the day the lifter
 * believes they are in.
 *
 * GDD §4.1 also says "'Local' is an account property the server resolves, not
 * the device's current timezone". There is no account here, so the device's
 * clock is all there is — and the proposal carries `deviceWallClock` as a HINT
 * precisely so a real server can disagree with it. This is the one place that
 * shortcut lives.
 *
 * ---------------------------------------------------------------------------
 * THERE IS NO `ServerRecord` IN THIS FILE ANY MORE, AND THAT IS THE FIX
 * ---------------------------------------------------------------------------
 * This hook used to hold two sources of truth: a `ProgressionCache`, and the
 * stored server row in a ref. It wrote the first and read the second —
 * `todayForLifter(recordRef.current, ...)` fed every number the session started
 * from — so `progression.ts`'s read half had zero callers anywhere in the app
 * and the close-out rendered figures that had never been through the door. The
 * boundary's write side was sealed and provably so; its read side protected
 * nothing that existed.
 *
 * The row now lives behind `SessionServerPort` (see `localSessionServer.ts`),
 * which returns a `ProgressionSnapshotWire` and a `SessionBrief` and has no
 * accessor for anything else. So:
 *
 *   - EVERY progression number the session starts from comes out of the cache,
 *     through `sessionClient.ts`'s `todayFromCache` and therefore through
 *     `readBestE1rmKg`, `readStreakDays` and `readStreakState`.
 *   - EVERY number the close-out prints comes out of the cache too, through
 *     `closeOutReadings`, and is RE-READ when the server answers. A server value
 *     the client did not predict wins on screen.
 *   - The one thing that is not a progression fact — the fatigue ledger, which
 *     `ProgressionSnapshotWire` excludes on purpose (GDD §3.4, §12.3) — crosses
 *     as a `SessionBrief` with exactly one field, narrowed to the horizon that
 *     can affect today. `sessionClient.ts`'s header has the full argument and
 *     the residual.
 *
 * A finished session still takes the full route: `sessionProposal` ->
 * `proposeChange` (the cache goes `pending`, with the optimistic projection
 * parked beside truth) -> the port -> `receiveProgressionSnapshot` ->
 * `applyServerSnapshot`. Nothing here writes a fact.
 *
 * ---------------------------------------------------------------------------
 * THE ROUND TRIP IS ASYNCHRONOUS, WHICH IS WHAT MAKES `pending` A REAL STATE
 * ---------------------------------------------------------------------------
 * The previous version proposed and settled inside ONE `setCache` updater, so
 * the `pending` cache existed as a local variable and never as a rendered state.
 * Everything downstream of it — the `'projected'` reading, and any affordance
 * that distinguishes a provisional number from a settled one — was unreachable
 * code. The port returns a promise, so `pending` is a state the app passes
 * through and a screen can draw.
 *
 * Persistence is the server's job — `localSessionServer.ts` writes the row
 * through `saveGame.ts` after every accepted mutation. A reload of a port
 * constructed over the same store reopens the same lifter. This hook still
 * does not write a fact; it only proposes.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  createSession,
  liftForDay,
  stepSession,
  type SessionEvent,
  type SessionState,
} from '../game/session';
import type { LiftKind } from '../game/meet';
import {
  closeOutReadings,
  openingCache,
  receiveSnapshot,
  sessionContextFrom,
  submitCloseOut,
  todayFromCache,
  type CloseOutReadings,
  type SessionServerPort,
} from '../game/sessionClient';
import {
  asProposalId,
  readStreakState,
  rejectProposal,
  type ProgressionCache,
} from '../game/progression';
import {
  firstRunDisclosuresFor,
  type OnboardingDisclosure,
} from '../game/onboardingDisclosure';
import {
  civilDateFromStreakDay,
  streakDayFromLocalWallClock,
  type LocalWallClock,
} from '../game/streak';
import { SESSION_TUNING } from '../game/sessionTuning';
import { localSessionServer } from './localSessionServer';

/** Reads the one real clock in the app. */
function nowWallClock(): LocalWallClock {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
  };
}

/**
 * DEBUG ONLY. A scripted beat of the loop, frozen for a photograph.
 *
 * IT CARRIES THE CACHE AS WELL AS THE STATE, and that is not bookkeeping. The
 * close-out's numbers are read out of the cache, so a preview whose cache was a
 * fresh lifter's would photograph a screen showing figures that belong to a
 * different session — which is the exact class of divergence this wiring exists
 * to make impossible. See `sessionPreview.ts`.
 */
export interface SessionPreviewFrame {
  readonly state: SessionState;
  readonly cache: ProgressionCache;
}

export interface SessionLoop {
  readonly state: SessionState;
  readonly cache: ProgressionCache;
  /** What the payoff beat prints, and how sure each number is. `null` off it. */
  readonly closeOutReadings: CloseOutReadings | null;
  /** True once the briefing's reveal beat has elapsed and the ladder is live. */
  readonly ladderReady: boolean;
  /** True when the server would refuse another session today (GDD §3.2). */
  readonly alreadyTrainedToday: boolean;
  /**
   * GDD §4.2's first-run disclosures, for the check-in to render. Empty for
   * every lifter who has trained, and on every lift but the first-run one.
   */
  readonly onboardingDisclosures: readonly OnboardingDisclosure[];
  readonly dispatch: (event: SessionEvent) => void;
  /** Starts a fresh session for whatever day it is now. */
  readonly restartDay: () => void;
  /**
   * Retargets today's session to another competition lift. Legal on the
   * briefing before an RPE is chosen; ignored later. Rebuilds the context
   * through the cache so the bar is prescribed from that lift's e1RM.
   */
  readonly chooseLift: (lift: LiftKind) => void;
}

export function useSession(
  preview?: SessionPreviewFrame,
  /** The server. Injected so a test can run one that DISAGREES with the client. */
  serverPort?: SessionServerPort,
): SessionLoop {
  const portRef = useRef<SessionServerPort | null>(null);
  if (portRef.current === null) {
    portRef.current = serverPort ?? localSessionServer();
  }
  const port = portRef.current;

  const [liveCache, setLiveCache] = useState<ProgressionCache>(() => openingCache(port));

  const buildSession = useCallback(
    (cache: ProgressionCache): SessionState => {
      const day = streakDayFromLocalWallClock(nowWallClock());
      const lift = liftForDay(day);
      return createSession(sessionContextFrom(cache, port.sessionBrief(day, lift), day, lift));
    },
    [port],
  );

  const [liveState, setLiveState] = useState<SessionState>(() => buildSession(liveCache));
  const [liveLadderReady, setLiveLadderReady] = useState(false);
  const submittedRef = useRef<string>('');
  const proposalSeq = useRef<number>(0);

  const frozen = preview !== undefined;
  const state = preview?.state ?? liveState;
  const cache = preview?.cache ?? liveCache;

  const dispatch = useCallback((event: SessionEvent) => {
    setLiveState((current) => stepSession(current, event));
  }, []);

  const restartDay = useCallback(() => {
    setLiveState(buildSession(liveCache));
    setLiveLadderReady(false);
  }, [buildSession, liveCache]);

  // --- the briefing reveal beat ---------------------------------------------
  useEffect(() => {
    if (liveState.phase !== 'briefing') {
      setLiveLadderReady(false);
      return undefined;
    }
    setLiveLadderReady(false);
    const timer = setTimeout(() => setLiveLadderReady(true), SESSION_TUNING.BRIEFING_REVEAL_MS);
    return () => clearTimeout(timer);
  }, [liveState.phase]);

  // --- the rest beat --------------------------------------------------------
  useEffect(() => {
    if (liveState.phase !== 'rest') return undefined;
    const timer = setTimeout(() => dispatch({ kind: 'begin-set' }), SESSION_TUNING.SET_REST_MS);
    return () => clearTimeout(timer);
  }, [liveState.phase, liveState.setIndex, dispatch]);

  // THE CACHE THE SUBMISSION IS BUILT FROM, MIRRORED INTO A REF.
  //
  // Declared BEFORE the submit effect below so it runs first on every commit,
  // which is what makes `cacheRef.current` the cache of the frame the
  // submission is built in rather than the one before it.
  //
  // See the submit effect for why it may not simply depend on `liveCache`.
  const cacheRef = useRef<ProgressionCache>(liveCache);
  useEffect(() => {
    cacheRef.current = liveCache;
  }, [liveCache]);

  const chooseLift = useCallback(
    (lift: LiftKind) => {
      setLiveState((current) => {
        if (current.phase !== 'briefing' || current.plan !== null || current.context.lift === lift) {
          return current;
        }
        const { day } = current.context;
        const nextContext = sessionContextFrom(
          cacheRef.current,
          port.sessionBrief(day, lift),
          day,
          lift,
        );
        return stepSession(current, { kind: 'choose-lift', context: nextContext });
      });
    },
    [port],
  );

  // --- the close-out goes to the server -------------------------------------
  //
  // TWO STATE CHANGES, NOT ONE. The proposal lands first and the cache renders
  // `pending` — the frame in which the close-out's numbers are provisional and
  // say so. The response lands second and REPLACES them. If the server disagrees
  // with the client's projection, this is where the client loses, which is the
  // only arrangement in which server authority is worth anything on screen.
  //
  // -------------------------------------------------------------------------
  // THIS EFFECT MAY NOT DEPEND ON `liveCache`, AND THAT IS NOT A LINT DODGE
  // -------------------------------------------------------------------------
  // It used to, and the second state change never happened. The sequence:
  //
  //   1. the effect calls `setLiveCache(submission.cache)` — the pending frame
  //   2. `liveCache` is a dependency, so React CLEANS UP AND RE-RUNS the effect
  //   3. the cleanup sets `cancelled = true`, on the request still in flight
  //   4. the re-run short-circuits on `submittedRef`, so nothing re-arms it
  //   5. the response arrives 550 ms later, sees `cancelled`, and is DISCARDED
  //
  // The cache therefore stayed `pending` for the rest of the app's life: the
  // close-out sat on its "SAVING" tag for ever, and `alreadyTrainedToday`
  // below — which is read out of the SETTLED streak state — was never true, so
  // GDD §3.2's one-session-a-day surface could not be reached by playing.
  // Measured in a browser, not reasoned about: 22 s on the close-out with the
  // tag unchanged, against a stand-in server that answers in 550 ms.
  //
  // Nothing in the node suite could see it. `sessionClient.test.ts` drives the
  // same round trip through the same functions and settles correctly, because
  // the defect is in the EFFECT'S WIRING and there is no renderer in the suite
  // to run an effect. `tools/verify-shell-route.mjs` plays the loop with a
  // mouse and is what caught it.
  //
  // So the cache is read through `cacheRef`, and the deps are the things that
  // should actually re-arm a submission: which beat the loop is on, and which
  // close-out it is. `submittedRef` still guarantees one submission per
  // close-out.
  const closeOut = liveState.closeOut;
  useEffect(() => {
    if (frozen) return undefined;
    if (liveState.phase !== 'close-out' || closeOut === null || !closeOut.canPropose) {
      return undefined;
    }
    const key = `${closeOut.day}:${closeOut.lift}:${closeOut.goodReps}:${closeOut.weightKg}`;
    if (submittedRef.current === key) return undefined;

    const wallClock: LocalWallClock = {
      ...civilDateFromStreakDay(streakDayFromLocalWallClock(nowWallClock())),
      hour: nowWallClock().hour,
    };
    proposalSeq.current += 1;
    const proposalId = asProposalId(`session-${closeOut.day}-${proposalSeq.current}`);
    const submission = submitCloseOut(cacheRef.current, closeOut, wallClock, proposalId);
    if (submission === null) return undefined;

    submittedRef.current = key;
    setLiveCache(submission.cache);

    let cancelled = false;
    void port
      .recordTrainingSession(closeOut.day, submission.proposal, proposalId)
      .then((response) => {
        if (cancelled) return;
        setLiveCache((current) =>
          response.kind === 'snapshot'
            ? receiveSnapshot(current, response.wire)
            : refuseProposal(current, proposalId),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [frozen, liveState.phase, closeOut, port]);

  const alreadyTrainedToday = useMemo(() => {
    if (frozen) return false;
    return todayFromCache(liveCache, liveState.context.day, liveState.context.lift)
      .alreadyTrainedToday;
  }, [frozen, liveCache, liveState.context.day, liveState.context.lift]);

  const readings = useMemo(
    () => (state.closeOut === null ? null : closeOutReadings(cache, state.closeOut)),
    [cache, state.closeOut],
  );

  // GDD §4.2's two first-run disclosures. Read out of the cache through
  // `readStreakState` for the same reason every other number on these screens
  // is: the streak state the sentences are about is server truth, and a screen
  // that decided this from anything else would be the second channel
  // `sessionWiring.test.ts` exists to keep shut. The decision itself is
  // `onboardingDisclosure.ts`'s — nothing is derived here.
  const onboardingDisclosures = useMemo(() => {
    const streak = readStreakState(cache);
    return firstRunDisclosuresFor(
      streak.kind === 'unknown' ? null : streak.value,
      state.context.lift,
    );
  }, [cache, state.context.lift]);

  return {
    state,
    cache,
    closeOutReadings: readings,
    ladderReady: frozen || liveLadderReady,
    alreadyTrainedToday,
    onboardingDisclosures,
    dispatch,
    restartDay,
    chooseLift,
  };
}

/**
 * The server refused. `progression.ts` discards the projection whole and marks
 * the cache stale, so the close-out keeps showing the last CONFIRMED numbers and
 * flags them — rather than keeping a projection nothing is going to acknowledge.
 */
function refuseProposal(
  cache: ProgressionCache,
  proposalId: ReturnType<typeof asProposalId>,
): ProgressionCache {
  const rejected = rejectProposal(cache, proposalId);
  return rejected.ok ? rejected.value : cache;
}
