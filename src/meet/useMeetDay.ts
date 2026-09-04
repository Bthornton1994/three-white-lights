/**
 * useMeetDay — the clock, the boundary, and the only place the pure meet-day
 * machine meets the app.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT DOES AND DELIBERATELY DOES NOT DO
 * ---------------------------------------------------------------------------
 * It resolves what day it is, holds a `ProgressionCache`, dispatches events into
 * `stepMeetDay`, and runs the three timers the loop needs — the walkout beat,
 * the deliberation beat and the verdict hold. It contains no meet logic of its
 * own: no rule, no weight validation, no judging, no total. If a rule about the
 * meet appears in this file it is in the wrong file (CLAUDE.md: "Never inline
 * game math into a component").
 *
 * ---------------------------------------------------------------------------
 * IT HOLDS NO ROW, AND THIS FILE IS WHERE THAT WENT WRONG
 * ---------------------------------------------------------------------------
 * It used to open with:
 *
 *     const recordRef = useRef<ServerRecord>(
 *       frozen ? previewServerRecord() : newServerRecord(SIGNUP_DAY));
 *
 * — a stored server row of its own, built on mount, and the entire meet was
 * built out of it. So meet day played a lifter who had never trained: the seed
 * e1RM on day 1 and on day 400, FIRST TOTAL after every meet, `isPrAttempt`
 * permanently false, and `MEET_ALREADY_RECORDED` unreachable. Every unit test
 * was green, because every pure module was right; what was wrong was which
 * lifter they were called about. `meetClient.ts`'s header has the full account
 * and `appServer.ts` has the shape of the fix.
 *
 * The hook now takes a `MeetServerPort` and has no way to build a row —
 * `ServerRecord` is not a name it can write. `useMeetDay.test.ts` bans the six
 * names the daily loop's twin bans plus the meet ones, so this cannot come back
 * by someone re-parking the row in a ref.
 *
 * ---------------------------------------------------------------------------
 * THE TOTAL GOES THROUGH THE DOOR
 * ---------------------------------------------------------------------------
 * A finished meet takes the full route: `meetResultProposal` -> `proposeChange`
 * (the cache goes `pending`, with the client's own projected total parked beside
 * truth) -> `port.recordMeetResult` (whose body REPLAYS the reported attempts
 * through `meet.ts` rather than trusting the client's arithmetic) ->
 * `receiveSnapshot`. Nothing here writes a fact, and the recap is built from the
 * server's answer rather than from the client's card.
 *
 * NOTHING IS PERSISTED. The row lives in `localSessionServer`'s closure and dies
 * with the tab, because persistence is the server's job. What survives is
 * navigation within one run of the app — which is exactly what was missing.
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
import { finalMeetTotal } from '../game/meet';
import { meetDayFactsFromCache, type MeetServerPort, type RecordedMeet } from '../game/meetClient';
import type { MeetServerError } from '../game/meetServer';
import {
  asProposalId,
  emptyProjection,
  projectedKg,
  proposeChange,
  rejectProposal,
  type ProgressionCache,
} from '../game/progression';
import { openingCache, receiveSnapshot } from '../game/sessionClient';
import { streakDayFromLocalWallClock, type LocalWallClock } from '../game/streak';
import { SESSION_TUNING } from '../game/sessionTuning';
import { MEET_ENTRY, type KilogramMeetEntry, type MeetDefinition } from '../game/meetTuning';

/**
 * The stakes of an attempt that does not exist.
 *
 * `stepMeetDay` only enters the deliberation phase by pushing an attempt, so
 * this is unreachable in play. It is the SHORTEST beat rather than the longest,
 * so a future path that reached it would show up as a rushed wait rather than
 * silently handing every attempt the third-attempt escalation.
 */
const OPENER_STAKES = Object.freeze({
  attemptNumber: 1 as const,
  isPrAttempt: false,
  bombRisk: false,
});

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
  readonly applied: RecordedMeet | null;
  /**
   * WHY THE MEET DID NOT RECORD, when it did not. Null on the happy path.
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
   *
   * IT IS NO LONGER ONLY THEORETICAL. See MEET_ALREADY_RECORDED below.
   */
  readonly submissionError: MeetServerError | null;
  readonly dispatch: (event: MeetDayEvent) => void;
  readonly restart: () => void;
}

/**
 * @param serverPort THE APP'S CONNECTION. Required, and first, because it is the
 * only source of everything below it: there is no default, no fallback and no
 * way for this hook to conjure a lifter if one is not handed to it. `AppShell`
 * passes `appMeetPort()`, which is the same object `SessionScreen` is given.
 *
 * @param meet WHICH MEET IS BEING LIFTED. Required for the port's own reason:
 * a default here would BE the ungated door — the hook reaching for
 * `MEET_LOCAL` on its own is exactly the Sprint 1c defect this parameter
 * deletes, where every meet a player ever opened was the one local and the
 * calendar decided nothing. The router hands the meet the player entered
 * (`careerMeet.ts`'s adapter over the calendar's choice); the capture path
 * hands its own fixture with the frozen frame.
 *
 * @param initial a scripted `MeetDayState` for the capture path, which supplies
 * its own beat rather than playing to it.
 *
 * @param frozen stops the three beat timers without unmounting anything. Used
 * only by the scripted-preview capture path (`meetPreview.ts`), which must not
 * have a walkout counting down underneath the frame it is being photographed at.
 * `useLiftLoop`'s `paused` exists for the same reason and is the precedent. The
 * server round trip still runs when frozen, so a preview of the recap has a real
 * total on it — against the preview's OWN port, which `meetPreview.ts` builds
 * and `shellRoute.ts` only ever attaches to a scripted frame.
 *
 * @param entry the athlete who walks onto this platform. Career Meet supplies
 * the profile-derived seam. Omitted, `MEET_ENTRY` remains the explicit
 * fixture for tests and debug preview.
 */
export function useMeetDay(
  serverPort: MeetServerPort,
  meet: MeetDefinition,
  initial?: MeetDayState,
  frozen: boolean = false,
  entry: KilogramMeetEntry | undefined = MEET_ENTRY,
): MeetDayLoop {
  const athlete = entry ?? MEET_ENTRY;
  const [cache, setCache] = useState<ProgressionCache>(() => openingCache(serverPort));

  /**
   * The meet this lifter opens today.
   *
   * READS THE PORT RATHER THAN THE `cache` STATE ABOVE, on purpose and not out
   * of laziness. `openingSnapshot` is synchronous, so this is current truth
   * either way — but taking `cache` as a dependency would rebuild the meet every
   * time the cache settles, including on the response to this meet's own result.
   * The meet is built exactly twice in its life: at mount and at `restart`.
   */
  const buildMeet = useCallback((): MeetDayState => {
    const day = streakDayFromLocalWallClock(nowWallClock());
    const facts = meetDayFactsFromCache(openingCache(serverPort), day, SESSION_TUNING.STARTING_E1RM);
    const context: MeetDayContext = {
      day: facts.day,
      meet,
      entry: athlete,
      bestE1rmKg: facts.bestE1rmKg,
      previousBestTotalKg: facts.previousBestTotalKg,
      previousBestByLiftKg: facts.previousBestByLiftKg,
      // The single named narrowing, the same one `useSession` gets: the days
      // that can still affect today, never a training history (GDD §3.4, §12.3).
      fatigue: serverPort.meetBrief(day).fatigue,
    };
    return createMeetDay(context);
  }, [serverPort, meet, athlete]);

  const [state, setState] = useState<MeetDayState>(() => initial ?? buildMeet());
  const [applied, setApplied] = useState<RecordedMeet | null>(null);
  const [submissionError, setSubmissionError] = useState<MeetServerError | null>(null);
  const submittedRef = useRef<string>('');
  const proposalSeq = useRef<number>(0);

  const dispatch = useCallback((event: MeetDayEvent) => {
    setState((current) => stepMeetDay(current, event));
  }, []);

  const restart = useCallback(() => {
    // The cache is re-read too, so a second meet opens against what the server
    // holds NOW rather than against what it held when this screen mounted.
    setCache(openingCache(serverPort));
    setState(buildMeet());
    setApplied(null);
    setSubmissionError(null);
    submittedRef.current = '';
  }, [buildMeet, serverPort]);

  // --- the bar-load and walk-out beat (GDD §6.2 step 1) ---------------------
  const live = state.live;
  const walkoutFor = live === null ? 0 : live.walkoutMs;
  useEffect(() => {
    if (frozen || state.phase !== 'walkout' || walkoutFor <= 0) return undefined;
    const timer = setTimeout(() => dispatch({ kind: 'walkout-done' }), walkoutFor);
    return () => clearTimeout(timer);
  }, [frozen, state.phase, walkoutFor, dispatch]);

  // --- the "judges deliberating" beat (GDD §6.2 step 4) --------------------
  //
  // The stakes come from the attempt JUST RESOLVED, not from `state.live`, which
  // this phase no longer has. `MeetDayAttempt` carries the same three facts
  // forward exactly so the beats after an attempt escalate on what the beats
  // before it escalated on.
  const deliberated = state.call === null ? false : state.call.deliberated;
  const judgedAttempt = state.attempts[state.attempts.length - 1];
  const deliberationFor =
    judgedAttempt === undefined
      ? deliberationMs(deliberated, OPENER_STAKES)
      : deliberationMs(deliberated, judgedAttempt);
  useEffect(() => {
    if (frozen || state.phase !== 'deliberation') return undefined;
    const timer = setTimeout(() => dispatch({ kind: 'deliberation-done' }), deliberationFor);
    return () => clearTimeout(timer);
  }, [frozen, state.phase, deliberationFor, dispatch]);

  // --- the lights and the feedback cue (GDD §6.2 steps 4-5) ----------------
  const verdictKey = state.attempts.length;
  useEffect(() => {
    if (frozen || state.phase !== 'verdict') return undefined;
    const timer = setTimeout(() => dispatch({ kind: 'verdict-done' }), verdictMs());
    return () => clearTimeout(timer);
  }, [frozen, state.phase, verdictKey, dispatch]);

  // --- the finished meet goes to the server --------------------------------
  //
  // IT IS A PROMISE NOW, AND THE `pending` CACHE IS THEREFORE RENDERABLE. This
  // used to call `applyMeetResult` synchronously inside a `setCache` updater and
  // settle it in the same tick, so the `ProjectionWithinReach<'record-meet-
  // result'>` it built lived for zero frames — the exact defect
  // `localSessionServer.ts` describes for the session half, one mode over. The
  // projected total is also the CLIENT's now (`finalMeetTotal`), computed before
  // the request rather than copied out of the response, which is what makes it a
  // projection rather than a restatement of the answer.
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
  // ONE OF THEM IS NOW REACHABLE FROM THE SHIPPED CONFIGURATION, AND IT IS
  // REACHABLE *BECAUSE* THIS FIX LANDED. `MEET_ALREADY_RECORDED` fires when the
  // row already carries a result for the meet being reported. `meetIdFor` is the
  // DEFINITION's id and `MEET_LOCAL` is a single dated event, so a second meet in
  // one app run reports the same id and is refused. That verdict is CORRECT —
  // banking one competition twice is exactly what the guard is for, and it could
  // never fire before only because the row was thrown away with the screen.
  //
  // WHAT THE PLAYER SEES, stated rather than left to be discovered: the phase is
  // still `'recap'`, so `SHELL_NAV.MEET_PHASES` draws BACK TO TRAINING over it
  // and nobody is stranded — but the recap itself does not appear, because
  // `applied` is only set on success. That is a blank screen with a way out, and
  // it is not good enough. The FIX is not here: GDD §6.1 enters a meet from a
  // Career calendar, and a calendar knows which meets a lifter has already
  // competed at. `AppShell`'s header already says it is ONE UNGATED DOOR to the
  // one local meet that exists, and this is the first consequence of that to
  // reach a player. Recorded in GDD §11.
  //
  // AND IT IS NOT RETRIED, deliberately. `submittedRef` is set BEFORE the call,
  // so a refusal is final for this meet until `restart()`. Setting it only on
  // success would look kinder and would be worse: every refusal above is a pure
  // function of (row, day, meet, card), none of which changes while the meet
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

    // The one thing a meet may show optimistically while the request is in
    // flight is the Total it just made — `ProjectionWithinReach<'record-meet-
    // result'>` permits it and makes a training session's Total a compile error.
    // `null` on a bomb-out, because there is no total to project.
    const projected = finalMeetTotal(state.meet);
    setCache((current) => {
      const pending = proposeChange(current, proposalId, proposal, {
        ...emptyProjection(),
        totalKg: projected === null ? null : projectedKg(projected),
      });
      return pending.ok ? pending.value : current;
    });

    void serverPort
      .recordMeetResult(state.context.day, state.context.meet, proposal, proposalId)
      .then((response) => {
        if (response.kind === 'refused') {
          // KEPT, NOT SWALLOWED. See the note above the effect for why there is
          // no retry and why there is no screen for this yet.
          setSubmissionError(response.error);
          // AND THE CACHE IS PUT BACK. A refusal that left the cache `pending`
          // would leave every reading permanently `'projected'` — the screen
          // would go on showing a provisional total for a meet the server
          // declined to record, which is the one thing a client-is-a-renderer
          // must never do.
          setCache((current) => {
            const rejected = rejectProposal(current, proposalId);
            return rejected.ok ? rejected.value : current;
          });
          return;
        }
        setApplied(response.result);
        setCache((current) => receiveSnapshot(current, response.wire));
      });
    // `cache` IS DELIBERATELY NOT A DEPENDENCY. Listing the state this effect
    // writes is what made the session half cancel its own request and sit on
    // "SAVING" for 22 seconds against a server that answers in 550 ms.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetOver, state, serverPort]);

  const recap = useMemo(() => {
    if (applied === null) return null;
    const built = buildMeetRecap(state, applied);
    return built.ok ? built.recap : null;
  }, [applied, state]);

  return { state, cache, recap, applied, submissionError, dispatch, restart };
}
