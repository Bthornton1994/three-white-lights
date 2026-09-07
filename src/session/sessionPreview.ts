/**
 * sessionPreview.ts — DEBUG ONLY. Builds a `SessionPreviewFrame` frozen at one
 * beat of the loop, so the real screens can be photographed at moments a wall
 * clock and a headless browser cannot reliably hit.
 *
 * WHY THIS EXISTS. The same reason `src/lift/liftReplay.ts` does: the close-out
 * of a session is four sets and a dozen timing inputs past app launch, and a
 * headless browser on a loaded machine cannot land a press inside the mechanic's
 * window. Driving the loop with pointer events to photograph its last screen
 * produces a photograph of a session that died in the first descent.
 *
 * WHAT IT IS NOT: a second renderer or a mock. It drives the SAME `stepSession`
 * the played loop runs on, with the outcomes scripted instead of played, and it
 * builds its cache with the SAME `sessionServer.ts` decision procedure and the
 * SAME `progression.ts` transitions. A screenshot taken through it is a
 * photograph of the shipped screen.
 *
 * ---------------------------------------------------------------------------
 * A FRAME IS A STATE **AND** A CACHE
 * ---------------------------------------------------------------------------
 * The close-out's figures are read out of the progression cache, so a preview
 * carrying only a `SessionState` would photograph a scripted session beside a
 * fresh lifter's numbers. It carries both, and the cache is produced by running
 * the real route: `receiveProgressionSnapshot` -> `applyServerSnapshot` ->
 * `proposeChange` -> `applyServerSnapshot`, over wires `sessionServer.ts` built.
 * Nothing here mints a `Confirmed` number; it cannot.
 *
 * That is what lets the four CERTAINTIES be photographed rather than argued
 * about: `close-out-pr` is confirmed, `close-out-saving` is in flight,
 * `close-out-server-wins` is a server answer the client did not predict, and
 * `close-out-unsynced` is a refusal.
 *
 * PURE. No clock, no I/O, no randomness — the day is `SESSION_PREVIEW.DAY`, a
 * fixed index, so the rotation and every number below it are stable across runs.
 * The one import from `useSession` is `import type` and is erased, so no React
 * reaches this module. Nothing in the played app enters here; it is reached from
 * the `?session=` query string in `App.tsx` and nowhere else.
 */

import {
  asAccessoryCloseOut,
  createSession,
  liftForDay,
  stepSession,
  type SessionCloseOut,
  type SessionContext,
  type SessionState,
} from '../game/session';
import { EMPTY_FATIGUE_STATE, type ReadinessCheckIn } from '../game/fatigue';
import {
  SESSION_BOUNDARY,
  SESSION_BOUNDARY_PREVIEW,
  SESSION_PREVIEW,
  SESSION_TUNING,
} from '../game/sessionTuning';
import { receiveSnapshot, submitCloseOut } from '../game/sessionClient';
import {
  asProposalId,
  emptyProgressionCache,
  rejectProposal,
  sealServerValue,
  type ProgressionCache,
} from '../game/progression';
import {
  applyTrainingSession,
  newServerRecord,
  snapshotWireFor,
  type ServerRecord,
} from '../game/sessionServer';
import {
  STREAK_DAY_BOUNDARY,
  asStreakDay,
  civilDateFromStreakDay,
  type LocalWallClock,
} from '../game/streak';
import type { LiftOutcome } from '../game/lift';
import type { SessionPreviewFrame } from './useSession';

/** The beats a preview can be frozen on. In loop order. */
export type SessionMomentId =
  /** Nothing tapped. What the app opens on. */
  | 'check-in'
  /** Two of the three taps in. */
  | 'check-in-partial'
  /** The modifier surfaced and the RPE ladder live. */
  | 'briefing'
  /**
   * The first rep of the first set, braced.
   *
   * THE SESSION IS FROZEN HERE; THE REP IS NOT. `SetView` runs the real
   * `useLiftLoop`, so the rep this beat opens on is live and will time out of
   * its brace on its own. That is deliberate — a still of a moving rep is what
   * `?replay=` is for, and it already exists. This beat is for the session
   * chrome around it: the set counter, the rep pips, the prescribed bar.
   */
  | 'set'
  /** Between work sets. */
  | 'rest'
  /** The payoff, on a session that set an e1RM PR. The server has answered. */
  | 'close-out-pr'
  /** The payoff, on a session that held its estimate. */
  | 'close-out-held'
  /** The payoff, on a session that banked nothing and offers a retry. */
  | 'close-out-empty'
  /**
   * The payoff WHILE THE PROPOSAL IS IN FLIGHT. Every progression number on it
   * is the client's projection, and the screen says so.
   */
  | 'close-out-saving'
  /**
   * The payoff after a server answer THE CLIENT DID NOT PREDICT. The beat that
   * proves the screen reports the record rather than its own arithmetic: the
   * figure on it is the server's, not the one the close-out computed.
   */
  | 'close-out-server-wins'
  /** The payoff after the server REFUSED. Last known truth, flagged. */
  | 'close-out-unsynced'
  /**
   * The payoff on an ACCESSORY day (GDD §3.2, ruled): Training IQ, and no e1RM
   * at all — not a zero, and not yesterday's number.
   */
  | 'close-out-accessory';

export const SESSION_MOMENTS = Object.freeze([
  'check-in',
  'check-in-partial',
  'briefing',
  'set',
  'rest',
  'close-out-pr',
  'close-out-held',
  'close-out-empty',
  'close-out-saving',
  'close-out-server-wins',
  'close-out-unsynced',
  'close-out-accessory',
] as const satisfies readonly SessionMomentId[]);

export interface SessionPreviewRequest {
  readonly moment: SessionMomentId;
}

/** True when `value` names a beat this module can build. */
export function isSessionMoment(value: string): value is SessionMomentId {
  return (SESSION_MOMENTS as readonly string[]).includes(value);
}

/**
 * Parse `?session=<moment>` out of a query string, or null.
 *
 * Takes the string rather than reading `window`, so it is pure and testable.
 * `App.tsx` supplies it.
 */
export function sessionPreviewFrom(search: string): SessionPreviewRequest | null {
  const params = new URLSearchParams(search);
  const moment = params.get('session');
  if (moment === null || !isSessionMoment(moment)) return null;
  return { moment };
}

const PRIMED: ReadinessCheckIn = { sleep: 'good', soreness: 'fresh', motivation: 'fired-up' };
const STEADY: ReadinessCheckIn = { sleep: 'ok', soreness: 'normal', motivation: 'steady' };

const PREVIEW_DAY = SESSION_PREVIEW.DAY;
const PREVIEW_LIFT = liftForDay(PREVIEW_DAY);
const PREVIEW_PROPOSAL_ID = asProposalId('preview-session');

const PREVIEW_WALL_CLOCK: LocalWallClock = {
  ...civilDateFromStreakDay(asStreakDay(PREVIEW_DAY)),
  hour: STREAK_DAY_BOUNDARY.ROLLOVER_HOUR_LOCAL,
};

/**
 * The stored row this lifter had BEFORE the scripted session.
 *
 * Built on `newServerRecord()` so every field is one the server would have
 * written, with only the two the preview pins overridden.
 *
 * EXPORTED FOR ITS SEAL, and the symmetry is the argument rather than the
 * convenience: `meetPreview.ts`'s twin row, `previewServerRecord`, is exported
 * and is therefore observable, and this one was not. §7.5 pins both as `record`
 * rows and `progression.test.ts` reads both as sealed off the source; only one
 * of them could be executed. `sessionPreview.test.ts` now freezes-checks it.
 */
export function recordBeforeSession(): ServerRecord {
  const fresh = newServerRecord(SESSION_BOUNDARY.LOCAL_SERVER_SIGNUP_DAY);
  // SEALED, like every other `record` row in `progression.ts` 7.5.
  return sealServerValue({
    ...fresh,
    bestE1rmKg: { ...fresh.bestE1rmKg, [PREVIEW_LIFT]: SESSION_PREVIEW.BEST_E1RM_KG },
    streak: {
      ...fresh.streak,
      currentStreak: SESSION_PREVIEW.STREAK_BEFORE,
      longestStreak: SESSION_PREVIEW.STREAK_BEFORE,
      lastTrainedDay: asStreakDay(PREVIEW_DAY - 1),
    },
  });
}

function previewContext(): SessionContext {
  return {
    day: PREVIEW_DAY,
    lift: PREVIEW_LIFT,
    e1rmKg: SESSION_PREVIEW.E1RM_KG,
    bestE1rmKg: SESSION_PREVIEW.BEST_E1RM_KG,
    streakBefore: SESSION_PREVIEW.STREAK_BEFORE,
    streakIfTrainedToday: SESSION_PREVIEW.STREAK_BEFORE + 1,
    fatigue: EMPTY_FATIGUE_STATE,
  };
}

function tapThrough(state: SessionState, answers: ReadinessCheckIn): SessionState {
  let next = stepSession(state, {
    kind: 'check-in-tap',
    tap: { question: 'sleep', answer: answers.sleep },
  });
  next = stepSession(next, {
    kind: 'check-in-tap',
    tap: { question: 'soreness', answer: answers.soreness },
  });
  return stepSession(next, {
    kind: 'check-in-tap',
    tap: { question: 'motivation', answer: answers.motivation },
  });
}

/** Drives the loop to its close-out with every rep scripted. */
function playScripted(
  answers: ReadinessCheckIn,
  outcome: (setIndex: number, repIndex: number) => LiftOutcome,
  stopAtRest: boolean,
): SessionState {
  let state = stepSession(tapThrough(createSession(previewContext()), answers), {
    kind: 'choose-rpe',
    rpe: SESSION_PREVIEW.RPE,
  });
  let guard = 0;
  const limit = SESSION_TUNING.WORK_SETS * SESSION_TUNING.REPS_PER_SET * SESSION_TUNING.WORK_SETS;
  while (state.phase !== 'close-out' && guard < limit) {
    guard += 1;
    if (state.phase === 'rest') {
      if (stopAtRest) return state;
      state = stepSession(state, { kind: 'begin-set' });
      continue;
    }
    state = stepSession(state, {
      kind: 'rep-resolved',
      outcome: outcome(state.setIndex, state.repIndex),
      // Scripted, not played — full credit, same standing as `ALL_GOOD` in
      // session.test.ts's own canned-outcome driver.
      executionQuality: 1,
    });
  }
  return state;
}

// ---------------------------------------------------------------------------
// The caches, built by running the real route
// ---------------------------------------------------------------------------

/** The cache as it stood before the scripted session was proposed. */
export function cacheBeforeSession(): ProgressionCache {
  return receiveSnapshot(emptyProgressionCache(), snapshotWireFor(recordBeforeSession(), null));
}

/** The cache with the scripted session's proposal in flight, or `null`. */
function submissionFor(closeOut: SessionCloseOut): ReturnType<typeof submitCloseOut> {
  return submitCloseOut(cacheBeforeSession(), closeOut, PREVIEW_WALL_CLOCK, PREVIEW_PROPOSAL_ID);
}

function cacheWhileSaving(closeOut: SessionCloseOut): ProgressionCache {
  return submissionFor(closeOut)?.cache ?? cacheBeforeSession();
}

/**
 * The row the server answers with, once `driftKg` has been added to the e1RM it
 * actually computed. That drift is how `close-out-server-wins` is built: a
 * response the client's projection did not predict.
 *
 * A NAMED FUNCTION RATHER THAN A TERNARY INSIDE `cacheAfterServer`, so §7.5's
 * `record` row for it can be OBSERVED rather than read off the source. The
 * literal was previously assembled inside a function whose only output was a
 * `ProgressionCache`, which put the sealed row past every public door in this
 * module: nothing could ask whether the seal had run.
 *
 * `settled` arrives already sealed — `applyTrainingSession` seals what it
 * returns — so the left arm is a pass-through and the seal below does its work
 * only down the drift arm.
 */
export function recordAfterServer(
  settled: ServerRecord,
  lift: SessionCloseOut['lift'],
  driftKg: number,
): ServerRecord {
  const best = settled.bestE1rmKg[lift];
  if (driftKg === 0 || best === null) return settled;
  // SEALED, like every other `record` row in `progression.ts` 7.5.
  return sealServerValue({
    ...settled,
    bestE1rmKg: { ...settled.bestE1rmKg, [lift]: best + driftKg },
  });
}

/**
 * The cache after the real server body has answered.
 *
 * `driftKg` is zero for the ordinary settled beats, where the client's
 * projection and the server agree because `sessionServer.ts` and the client run
 * the same `nextBestE1rm`.
 */
function cacheAfterServer(closeOut: SessionCloseOut, driftKg: number): ProgressionCache {
  const submission = submissionFor(closeOut);
  if (submission === null) return cacheBeforeSession();
  const applied = applyTrainingSession(
    recordBeforeSession(),
    PREVIEW_DAY,
    submission.proposal,
    PREVIEW_PROPOSAL_ID,
  );
  if (!applied.ok) return submission.cache;
  const answered = recordAfterServer(applied.value.record, closeOut.lift, driftKg);
  return receiveSnapshot(submission.cache, snapshotWireFor(answered, PREVIEW_PROPOSAL_ID));
}

/** The cache after the server refused. `progression.ts` marks it stale. */
function cacheAfterRefusal(closeOut: SessionCloseOut): ProgressionCache {
  const pending = cacheWhileSaving(closeOut);
  const rejected = rejectProposal(pending, PREVIEW_PROPOSAL_ID);
  return rejected.ok ? rejected.value : pending;
}

function frame(state: SessionState, cache: ProgressionCache): SessionPreviewFrame {
  return { state, cache };
}

function settledFrame(state: SessionState, driftKg: number): SessionPreviewFrame {
  return frame(
    state,
    state.closeOut === null
      ? cacheBeforeSession()
      : cacheAfterServer(state.closeOut, driftKg),
  );
}

/**
 * The frame a preview beat renders.
 *
 * Every branch goes through `stepSession` and every cache through
 * `progression.ts`'s transitions, so a preview cannot show a screen the machine
 * could not reach or a number the boundary would not hand out.
 */
export function previewFrameFor(request: SessionPreviewRequest): SessionPreviewFrame {
  const fresh = createSession(previewContext());
  switch (request.moment) {
    case 'check-in':
    case 'check-in-partial':
    case 'briefing':
      return frame(fresh, cacheBeforeSession());
    case 'set':
      return frame(
        stepSession(fresh, { kind: 'choose-rpe', rpe: SESSION_PREVIEW.RPE }),
        cacheBeforeSession(),
      );
    case 'rest':
      return frame(playScripted(STEADY, () => 'good-lift', true), cacheBeforeSession());
    case 'close-out-pr':
      return settledFrame(playScripted(PRIMED, () => 'good-lift', false), 0);
    case 'close-out-held':
      return settledFrame(playScripted(STEADY, () => 'good-lift', false), 0);
    case 'close-out-empty':
      // Nothing was banked, so nothing was proposed: the cache is exactly where
      // it was before the session, and confirmed.
      return frame(playScripted(STEADY, () => 'miss', false), cacheBeforeSession());
    case 'close-out-saving': {
      const state = playScripted(PRIMED, () => 'good-lift', false);
      return frame(
        state,
        state.closeOut === null ? cacheBeforeSession() : cacheWhileSaving(state.closeOut),
      );
    }
    case 'close-out-server-wins':
      return settledFrame(
        playScripted(PRIMED, () => 'good-lift', false),
        SESSION_BOUNDARY_PREVIEW.SERVER_DRIFT_KG,
      );
    case 'close-out-unsynced': {
      const state = playScripted(PRIMED, () => 'good-lift', false);
      return frame(
        state,
        state.closeOut === null ? cacheBeforeSession() : cacheAfterRefusal(state.closeOut),
      );
    }
    case 'close-out-accessory': {
      // PRIMED, NOT STEADY, AND THE READINESS IS THE POINT OF THIS BEAT.
      //
      // This fixture used to be built on `STEADY` — the one readiness band that
      // arithmetically cannot produce a PR — while every other close-out beat
      // used `PRIMED`. So the one demonstration of accessory day was pointed
      // away from the case where it fails: on `STEADY` the screen read "SESSION
      // LOGGED", which is merely wrong, and on `PRIMED` it read "NEW e1RM" over
      // a Training IQ row with no number in it, which is the thing GDD §3.2
      // rules out. The beat is now built on the readiness that would have shown
      // it, and `sessionPreview.test.ts` asserts the headline.
      const played = playScripted(PRIMED, () => 'good-lift', false);
      const settled = settledFrame(played, 0);
      return played.closeOut === null
        ? settled
        : frame({ ...played, closeOut: asAccessoryCloseOut(played.closeOut) }, settled.cache);
    }
    default:
      return frame(fresh, cacheBeforeSession());
  }
}
