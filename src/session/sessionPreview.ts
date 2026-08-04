/**
 * sessionPreview.ts — DEBUG ONLY. Builds a `SessionState` frozen at one beat of
 * the loop, so the real screens can be photographed at moments a wall clock and
 * a headless browser cannot reliably hit.
 *
 * WHY THIS EXISTS. The same reason `src/lift/liftReplay.ts` does: the close-out
 * of a session is four sets and a dozen timing inputs away from app launch, and
 * a headless browser on a loaded machine cannot land a press inside the
 * mechanic's window. Driving the loop with pointer events to photograph its
 * last screen produces a photograph of a session that died in the first
 * descent.
 *
 * WHAT IT IS NOT: a second renderer or a mock. It drives the SAME
 * `stepSession` the played loop runs on, with the outcomes scripted instead of
 * played, and hands the resulting state to the same components. A screenshot
 * taken through it is a photograph of the shipped screen.
 *
 * PURE. Zero React, zero I/O, no clock — the day is `SESSION_PREVIEW.DAY`, a
 * fixed index, so the rotation and every number below it are stable across runs.
 * Nothing in the played app reaches this module; it is entered from the
 * `?session=` query string in `App.tsx` and nowhere else.
 */

import {
  createSession,
  liftForDay,
  stepSession,
  type SessionContext,
  type SessionState,
} from '../game/session';
import { EMPTY_FATIGUE_STATE, type ReadinessCheckIn } from '../game/fatigue';
import { SESSION_PREVIEW, SESSION_TUNING } from '../game/sessionTuning';
import type { LiftOutcome } from '../game/lift';

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
  /** The payoff, on a session that set an e1RM PR. */
  | 'close-out-pr'
  /** The payoff, on a session that held its estimate. */
  | 'close-out-held'
  /** The payoff, on a session that banked nothing and offers a retry. */
  | 'close-out-empty';

export const SESSION_MOMENTS = Object.freeze([
  'check-in',
  'check-in-partial',
  'briefing',
  'set',
  'rest',
  'close-out-pr',
  'close-out-held',
  'close-out-empty',
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

function previewContext(): SessionContext {
  const day = SESSION_PREVIEW.DAY;
  return {
    day,
    lift: liftForDay(day),
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
    });
  }
  return state;
}

/**
 * The state a preview beat renders.
 *
 * Every branch goes through `stepSession`, so a preview cannot show a screen
 * the machine could not reach.
 */
export function previewStateFor(request: SessionPreviewRequest): SessionState {
  const fresh = createSession(previewContext());
  switch (request.moment) {
    case 'check-in':
      return fresh;
    case 'check-in-partial': {
      const one = stepSession(fresh, {
        kind: 'check-in-tap',
        tap: { question: 'sleep', answer: 'good' },
      });
      return stepSession(one, {
        kind: 'check-in-tap',
        tap: { question: 'soreness', answer: 'fresh' },
      });
    }
    case 'briefing':
      return tapThrough(fresh, PRIMED);
    case 'set':
      return stepSession(tapThrough(fresh, STEADY), {
        kind: 'choose-rpe',
        rpe: SESSION_PREVIEW.RPE,
      });
    case 'rest':
      return playScripted(STEADY, () => 'good-lift', true);
    case 'close-out-pr':
      return playScripted(PRIMED, () => 'good-lift', false);
    case 'close-out-held':
      return playScripted(STEADY, () => 'good-lift', false);
    case 'close-out-empty':
      return playScripted(STEADY, () => 'miss', false);
    default:
      return fresh;
  }
}
