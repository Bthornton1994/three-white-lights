/**
 * useMeetDay — the clock, the boundary, and the only place the pure meet-day
 * machine meets the app.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT DOES AND DELIBERATELY DOES NOT DO
 * ---------------------------------------------------------------------------
 * It resolves what day it is, holds the local stand-in for the Edge Function,
 * dispatches events into `stepMeetDay`, and runs the three timers the loop
 * needs — the walkout beat, the deliberation beat and the verdict hold. It
 * contains no meet logic of its own: no rule, no weight validation, no judging,
 * no total. If a rule about the meet appears in this file it is in the wrong
 * file (CLAUDE.md: "Never inline game math into a component").
 *
 * ---------------------------------------------------------------------------
 * THE CLOCK LIVES HERE, ON PURPOSE
 * ---------------------------------------------------------------------------
 * `meetDay.ts`, `meet.ts` and `fatigue.ts` are pure and take the day as an
 * integer. Somebody has to read a real clock, and it is this file — once, at
 * the edge, through `streakDayFromLocalWallClock`, the same door `useSession`
 * uses so the two loops can never disagree about what day it is.
 *
 * ---------------------------------------------------------------------------
 * THE TOTAL GOES THROUGH THE DOOR
 * ---------------------------------------------------------------------------
 * Even with both halves in one process, a finished meet takes the full route:
 * `meetResultProposal` -> `proposeChange` (the cache goes `pending`, with the
 * optimistic projection parked beside truth) -> `applyMeetResult` (the server
 * body, which REPLAYS the reported attempts through `meet.ts` rather than
 * trusting the client's arithmetic) -> `receiveProgressionSnapshot` ->
 * `applyServerSnapshot`. Nothing here writes a fact, and the recap is built
 * from the server's answer rather than from the client's card.
 *
 * NOTHING IS PERSISTED. The stand-in record lives in a ref and dies with the
 * tab, because persistence is the server's job and inventing a client-side
 * store now is exactly the code CLAUDE.md says would have to be unwound. The
 * cost is stated rather than hidden: a reload starts a fresh lifter, with the
 * placeholder history in `MEET_PREVIEW`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  buildMeetRecap,
  createMeetDay,
  deliberationMs,
  meetIdFor,
  meetResultProposal,
  stepMeetDay,
  verdictMs,
  type MeetDayContext,
  type MeetDayEvent,
  type MeetDayState,
  type MeetRecap,
} from '../game/meetDay';
import {
  applyMeetResult,
  meetDayFacts,
  type AppliedMeetResult,
  type MeetServerError,
} from '../game/meetServer';
import { newServerRecord, snapshotWireFor, type ServerRecord } from '../game/sessionServer';
import { previewServerRecord } from '../game/meetPreview';
import {
  applyServerSnapshot,
  asProposalId,
  emptyProgressionCache,
  emptyProjection,
  projectedKg,
  proposeChange,
  receiveProgressionSnapshot,
  type ProgressionCache,
} from '../game/progression';
import { streakDayFromLocalWallClock, type LocalWallClock } from '../game/streak';
import { SESSION_BOUNDARY, SESSION_TUNING } from '../game/sessionTuning';
import { MEET_ENTRY, MEET_LOCAL } from '../game/meetTuning';

/** Reads the one real clock this screen touches. */
function nowWallClock(): LocalWallClock {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
  };
}

export interface MeetDayLoop {
  readonly state: MeetDayState;
  readonly cache: ProgressionCache;
  /** GDD §6.5's recap, once the server has answered. Null until then. */
  readonly recap: MeetRecap | null;
  /** The server's own answer, for the bomb-out screen's "what you kept" list. */
  readonly applied: AppliedMeetResult | null;
  /**
   * WHY THE MEET DID NOT RECORD, when it did not. Null on the happy path and on
   * every meet the shipped configuration can play.
   *
   * IT IS NOT RENDERED BY ANYTHING YET, and saying so is the point of the field.
   * A refused submission used to be dropped on the floor inside `setCache` and
   * existed nowhere afterwards, so the screen showed a player who had just taken
   * nine attempts an empty recap with no explanation and no route back except
   * `restart()`. This does not fix that screen — the screen is GDD §11's open
   * pound-meet ruling and is somebody's deliberate design work, not a `?? ''`
   * bolted on here — but it means the refusal survives the effect, can be
   * asserted on in a test, and is one `if` away from being shown by whoever
   * takes the ruling. See the submit effect for what happens to the retry.
   */
  readonly submissionError: MeetServerError | null;
  readonly dispatch: (event: MeetDayEvent) => void;
  readonly restart: () => void;
}

/**
 * @param frozen stops the three beat timers without unmounting anything. Used
 * only by the scripted-preview capture path (`meetPreview.ts`), which supplies
 * its own state and must not have a walkout counting down underneath the frame
 * it is being photographed at. `useLiftLoop`'s `paused` exists for the same
 * reason and is the precedent. The server round trip still runs when frozen, so
 * a preview of the recap has a real total on it.
 */
export function useMeetDay(initial?: MeetDayState, frozen: boolean = false): MeetDayLoop {
  // A frozen preview is describing a lifter with a history (`previewContext`),
  // so its stand-in server has to hold that history or the recap reports a
  // first total for a lifter who has competed before. Debug-only, and the one
  // branch in this file that a played meet never takes.
  const recordRef = useRef<ServerRecord>(frozen ? previewServerRecord() : newServerRecord(SESSION_BOUNDARY.LOCAL_SERVER_SIGNUP_DAY));
  const [cache, setCache] = useState<ProgressionCache>(() => {
    const received = receiveProgressionSnapshot(snapshotWireFor(recordRef.current, null));
    if (!received.ok) return emptyProgressionCache();
    const applied = applyServerSnapshot(emptyProgressionCache(), received.value);
    return applied.ok ? applied.value : emptyProgressionCache();
  });

  const buildMeet = useCallback((): MeetDayState => {
    const day = streakDayFromLocalWallClock(nowWallClock());
    const facts = meetDayFacts(recordRef.current, day, SESSION_TUNING.STARTING_E1RM);
    const context: MeetDayContext = {
      day: facts.day,
      meet: MEET_LOCAL,
      entry: MEET_ENTRY,
      bestE1rmKg: facts.bestE1rmKg,
      previousBestTotalKg: facts.previousBestTotalKg,
      previousBestByLiftKg: facts.previousBestByLiftKg,
      fatigue: recordRef.current.fatigue,
    };
    return createMeetDay(context);
  }, []);

  const [state, setState] = useState<MeetDayState>(() => initial ?? buildMeet());
  const [applied, setApplied] = useState<AppliedMeetResult | null>(null);
  const [submissionError, setSubmissionError] = useState<MeetServerError | null>(null);
  const submittedRef = useRef<string>('');
  const proposalSeq = useRef<number>(0);

  const dispatch = useCallback((event: MeetDayEvent) => {
    setState((current) => stepMeetDay(current, event));
  }, []);

  const restart = useCallback(() => {
    setState(buildMeet());
    setApplied(null);
    setSubmissionError(null);
    submittedRef.current = '';
  }, [buildMeet]);

  // --- the bar-load and walk-out beat (GDD §6.2 step 1) ---------------------
  const live = state.live;
  const walkoutFor = live === null ? 0 : live.walkoutMs;
  useEffect(() => {
    if (frozen || state.phase !== 'walkout' || walkoutFor <= 0) return undefined;
    const timer = setTimeout(() => dispatch({ kind: 'walkout-done' }), walkoutFor);
    return () => clearTimeout(timer);
  }, [frozen, state.phase, walkoutFor, dispatch]);

  // --- the "judges deliberating" beat (GDD §6.2 step 4) --------------------
  const deliberated = state.call === null ? false : state.call.deliberated;
  useEffect(() => {
    if (frozen || state.phase !== 'deliberation') return undefined;
    const timer = setTimeout(() => dispatch({ kind: 'deliberation-done' }), deliberationMs(deliberated));
    return () => clearTimeout(timer);
  }, [frozen, state.phase, deliberated, dispatch]);

  // --- the lights and the feedback cue (GDD §6.2 steps 4-5) ----------------
  const verdictKey = state.attempts.length;
  useEffect(() => {
    if (frozen || state.phase !== 'verdict') return undefined;
    const timer = setTimeout(() => dispatch({ kind: 'verdict-done' }), verdictMs());
    return () => clearTimeout(timer);
  }, [frozen, state.phase, verdictKey, dispatch]);

  // --- the finished meet goes to the server --------------------------------
  //
  // WHAT HAPPENS WHEN THE SERVER SAYS NO, written here because this is the file
  // somebody editing this effect is looking at. `applyMeetResult` refuses:
  // `MEET_REPLAY_REFUSED`, `MEET_INCOMPLETE`, `MEET_OVERRUN`,
  // `MEET_ALREADY_RECORDED`, `BAD_DAY`; `UNSUPPORTED_MEET_UNIT` for a meet not
  // run in kilograms, a lifter not weighed in kilograms, or a card whose
  // declared unit is not the unit its meet runs in; `MEET_ID_MISMATCH` when the
  // definition passed is not the meet the report names; and `MALFORMED_READING`
  // for a unit-tagged number with nothing under the tag.
  //
  // NONE of them is reachable from the shipped `MEET_LOCAL` + `MEET_ENTRY`, and
  // the two newest are structurally unreachable from HERE rather than merely
  // unused: `meetResultProposal` takes the meet id and the card's unit off
  // `state.context.meet`, and this effect passes that same object as the
  // definition — so the id always matches and the card's unit always agrees with
  // the rules it was played under. They exist for the JSON body a real Edge
  // Function is handed, which is not built by this file. The rest are one second
  // meet definition away, and GDD §11 has that ruling open.
  //
  // THE RECAP DOES NOT APPEAR IN THAT CASE. `recap` is derived from `applied`,
  // `applied` is only set on success, and the loop returns no route back except
  // `restart()`. That is the right shape for a case that cannot happen and the
  // wrong one for a player who has just taken nine attempts. The refusal is now
  // at least KEPT (`submissionError`) instead of dropped; showing it is a screen
  // and a screen is not this file's to invent.
  //
  // AND IT IS NOT RETRIED, deliberately. `submittedRef` is set BEFORE the call,
  // so a refusal is final for this meet until `restart()`. Setting it only on
  // success would look kinder and would be worse: every refusal above is a pure
  // function of (record, day, meet, card), none of which changes while the meet
  // sits in `recap`/`bombed`, so a retry re-runs the same computation and gets
  // the same answer — once per render, forever, with the screen still empty. The
  // day this call becomes a real `fetch`, that reasoning stops holding, because
  // a transport failure IS retryable: the fix then is for the error to carry
  // whether it is transient, and to retry only those. Not before.
  const meetOver = state.phase === 'bombed' || state.phase === 'recap';
  useEffect(() => {
    if (!meetOver) return;
    const proposal = meetResultProposal(state);
    if (proposal === null) return;
    const key = String(meetIdFor(state.context.meet));
    if (submittedRef.current === key) return;
    submittedRef.current = key;

    proposalSeq.current += 1;
    const proposalId = asProposalId(`meet-${state.context.day}-${proposalSeq.current}`);

    setCache((current) => {
      const result = applyMeetResult(
        recordRef.current,
        state.context.day,
        state.context.meet,
        proposal,
        proposalId,
      );
      if (!result.ok) {
        // KEPT, NOT SWALLOWED. See the note above the effect for why there is no
        // retry and why there is no screen for this yet.
        setSubmissionError(result.error);
        return current;
      }
      // The one thing a meet may show optimistically while the request is in
      // flight is the Total it just made — `ProjectionWithinReach<'record-meet-
      // result'>` permits it and makes a training session's Total a compile
      // error. `null` on a bomb-out, because there is no total to project.
      const madeTotal = result.value.totalKg;
      const pending = proposeChange(current, proposalId, proposal, {
        ...emptyProjection(),
        totalKg: madeTotal === null ? null : projectedKg(madeTotal),
      });
      if (!pending.ok) return current;
      recordRef.current = result.value.record;
      setApplied(result.value);
      const received = receiveProgressionSnapshot(result.value.wire);
      if (!received.ok) return pending.value;
      const settled = applyServerSnapshot(pending.value, received.value);
      return settled.ok ? settled.value : pending.value;
    });
  }, [meetOver, state]);

  const recap = useMemo(() => {
    if (applied === null) return null;
    const built = buildMeetRecap(state, applied);
    return built.ok ? built.recap : null;
  }, [applied, state]);

  return { state, cache, recap, applied, submissionError, dispatch, restart };
}
