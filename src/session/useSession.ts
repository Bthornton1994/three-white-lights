/**
 * useSession — the clock, the boundary, and the only place the pure session
 * machine meets the app.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT DOES AND DELIBERATELY DOES NOT DO
 * ---------------------------------------------------------------------------
 * It resolves what day it is, holds the local stand-in for the Edge Function,
 * dispatches events into `stepSession`, and runs the two timers the loop needs
 * (the briefing reveal and the rest beat). It contains no session logic of its
 * own — no prescription, no scoring, no streak arithmetic. If a rule about the
 * session appears in this file it is in the wrong file (CLAUDE.md: "Never
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
 * the device's current timezone". There is no account and no server here, so
 * the device's clock is all there is — and the proposal carries
 * `deviceWallClock` as a HINT precisely so a real server can disagree with it.
 * This is the one place that shortcut lives.
 *
 * ---------------------------------------------------------------------------
 * PROGRESSION STILL GOES THROUGH THE DOOR
 * ---------------------------------------------------------------------------
 * Even with both halves in one process, a finished session takes the full
 * route: `sessionProposal` -> `proposeChange` (the cache goes `pending`, with
 * the optimistic projection parked beside truth) -> `applyTrainingSession` (the
 * server body, which recomputes e1RM from the reported sets and the streak from
 * `streak.ts`, ignoring anything the client believed) -> `receiveProgression
 * Snapshot` -> `applyServerSnapshot`. Nothing here writes a fact.
 *
 * NOTHING IS PERSISTED. The stand-in record lives in a ref and dies with the
 * tab, because persistence is the server's job and inventing a client-side
 * store now is exactly the code CLAUDE.md says would have to be unwound. The
 * cost is stated rather than hidden: a reload starts a fresh lifter.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  createSession,
  liftForDay,
  sessionProjection,
  sessionProposal,
  stepSession,
  type SessionEvent,
  type SessionState,
} from '../game/session';
import {
  applyTrainingSession,
  newServerRecord,
  snapshotWireFor,
  todayForLifter,
  type ServerRecord,
} from '../game/sessionServer';
import {
  applyServerSnapshot,
  asProposalId,
  emptyProgressionCache,
  proposeChange,
  receiveProgressionSnapshot,
  type ProgressionCache,
} from '../game/progression';
import {
  civilDateFromStreakDay,
  streakDayFromLocalWallClock,
  type LocalWallClock,
} from '../game/streak';
import { SESSION_TUNING } from '../game/sessionTuning';

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

export interface SessionLoop {
  readonly state: SessionState;
  readonly cache: ProgressionCache;
  /** True once the briefing's reveal beat has elapsed and the ladder is live. */
  readonly ladderReady: boolean;
  /** True when the server would refuse another session today (GDD §3.2). */
  readonly alreadyTrainedToday: boolean;
  readonly dispatch: (event: SessionEvent) => void;
  /** Starts a fresh session for whatever day it is now. */
  readonly restartDay: () => void;
}

export function useSession(initial?: SessionState): SessionLoop {
  const recordRef = useRef<ServerRecord>(newServerRecord());
  const [cache, setCache] = useState<ProgressionCache>(() => {
    const received = receiveProgressionSnapshot(snapshotWireFor(recordRef.current, null));
    if (!received.ok) return emptyProgressionCache();
    const applied = applyServerSnapshot(emptyProgressionCache(), received.value);
    return applied.ok ? applied.value : emptyProgressionCache();
  });

  const buildSession = useCallback((): SessionState => {
    const wallClock = nowWallClock();
    const day = streakDayFromLocalWallClock(wallClock);
    const lift = liftForDay(day);
    const today = todayForLifter(recordRef.current, day, lift);
    return createSession({
      day,
      lift,
      e1rmKg: today.e1rmKg,
      bestE1rmKg: today.bestE1rmKg,
      streakBefore: today.streakBefore,
      streakIfTrainedToday: today.streakIfTrainedToday,
      fatigue: today.fatigue,
    });
  }, []);

  const [state, setState] = useState<SessionState>(() => initial ?? buildSession());
  const [ladderReady, setLadderReady] = useState(false);
  const submittedRef = useRef<string>('');
  const proposalSeq = useRef<number>(0);

  const dispatch = useCallback((event: SessionEvent) => {
    setState((current) => stepSession(current, event));
  }, []);

  const restartDay = useCallback(() => {
    setState(buildSession());
    setLadderReady(false);
  }, [buildSession]);

  // --- the briefing reveal beat ---------------------------------------------
  useEffect(() => {
    if (state.phase !== 'briefing') {
      setLadderReady(false);
      return undefined;
    }
    setLadderReady(false);
    const timer = setTimeout(() => setLadderReady(true), SESSION_TUNING.BRIEFING_REVEAL_MS);
    return () => clearTimeout(timer);
  }, [state.phase]);

  // --- the rest beat --------------------------------------------------------
  useEffect(() => {
    if (state.phase !== 'rest') return undefined;
    const timer = setTimeout(
      () => dispatch({ kind: 'begin-set' }),
      SESSION_TUNING.SET_REST_MS,
    );
    return () => clearTimeout(timer);
  }, [state.phase, state.setIndex, dispatch]);

  // --- the close-out goes to the server -------------------------------------
  const closeOut = state.closeOut;
  useEffect(() => {
    if (state.phase !== 'close-out' || closeOut === null || !closeOut.canPropose) return;
    const key = `${closeOut.day}:${closeOut.lift}:${closeOut.goodReps}:${closeOut.weightKg}`;
    if (submittedRef.current === key) return;
    submittedRef.current = key;

    const wallClock: LocalWallClock = {
      ...civilDateFromStreakDay(
        streakDayFromLocalWallClock(nowWallClock()),
      ),
      hour: nowWallClock().hour,
    };
    const proposal = sessionProposal(closeOut, wallClock);
    if (proposal === null) return;

    proposalSeq.current += 1;
    const proposalId = asProposalId(`session-${closeOut.day}-${proposalSeq.current}`);

    setCache((current) => {
      const pending = proposeChange(current, proposalId, proposal, sessionProjection(closeOut));
      if (!pending.ok) return current;
      const applied = applyTrainingSession(
        recordRef.current,
        closeOut.day,
        proposal,
        proposalId,
      );
      if (!applied.ok) return pending.value;
      recordRef.current = applied.value.record;
      const received = receiveProgressionSnapshot(applied.value.wire);
      if (!received.ok) return pending.value;
      const settled = applyServerSnapshot(pending.value, received.value);
      return settled.ok ? settled.value : pending.value;
    });
  }, [state.phase, closeOut]);

  const alreadyTrainedToday = useMemo(
    () => todayForLifter(recordRef.current, state.context.day, state.context.lift).alreadyTrainedToday,
    // `cache` is the signal that the server answered, which is when this can
    // change. `recordRef` is a ref and cannot be a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cache, state.context.day, state.context.lift],
  );

  return { state, cache, ladderReady, alreadyTrainedToday, dispatch, restartDay };
}
