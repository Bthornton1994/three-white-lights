/**
 * careerLoop.ts — server-gated Career meet entry and settlement authorization.
 *
 * THE LOOP THIS CLOSES: train → calendar → qualify → enter → existing Meet
 * Day → persist the result once → return. Entry is a booking, not a
 * progression fact: it does not mint Total, e1RM, or training credit, and it
 * is not a `ProgressionProposal` kind. Settlement still goes through
 * `applyMeetResult` — this module reconstructs the legitimate `MeetDefinition`
 * and refuses a result the lifter never entered. It does not call
 * `applyMeetResult` itself.
 *
 * In-progress entry (`enteredMeetId`) is a save-envelope sibling, not a field
 * on `ServerRecord`, so `meetServer.ts`'s A1 freeze does not have to grow a
 * copy-through line.
 *
 * Loop-specific refusals live here. `entryVerdict`'s four reasons are wrapped
 * verbatim — a fifth `ENTRY_REFUSAL_REASON` is not added.
 */

import { careerMeetFromId, type CareerMeet } from '../career/calendar';
import { entryVerdict, type CareerLifter, type EntryRefusalReason } from '../career/eligibility';
import { meetDefinitionFor } from './careerMeet';
import type { MeetDefinition } from './meetTuning';
import { asStreakDay } from './streak';

export const CAREER_LOOP_ERROR_CODES = [
  'UNKNOWN_MEET',
  'ALREADY_IN_A_MEET',
  'NOT_ENTERED',
  'MEET_MISMATCH',
  'WRONG_FEDERATION',
  'ALREADY_ENTERED',
  'MEET_HAS_PASSED',
  'BELOW_QUALIFYING_TOTAL',
] as const;

export type CareerLoopErrorCode = (typeof CAREER_LOOP_ERROR_CODES)[number];

export interface CareerLoopError {
  readonly code: CareerLoopErrorCode;
  readonly message: string;
}

export type CareerLoopResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: CareerLoopError };

export interface EnteredCareerMeet {
  readonly enteredMeetId: string;
  readonly meet: CareerMeet;
  readonly definition: MeetDefinition;
}

const LOOP_COPY: Readonly<Record<'UNKNOWN_MEET' | 'ALREADY_IN_A_MEET' | 'NOT_ENTERED' | 'MEET_MISMATCH', string>> =
  Object.freeze({
    UNKNOWN_MEET: 'That meet is not on this calendar.',
    ALREADY_IN_A_MEET: 'You are already entered in another meet.',
    NOT_ENTERED: 'Enter this meet from the Career calendar before recording a result.',
    MEET_MISMATCH: 'This result is for a different meet than the one entered.',
  });

function fail(code: CareerLoopErrorCode, message: string): { readonly ok: false; readonly error: CareerLoopError } {
  return { ok: false, error: { code, message } };
}

function loopFail(
  code: 'UNKNOWN_MEET' | 'ALREADY_IN_A_MEET' | 'NOT_ENTERED' | 'MEET_MISMATCH',
): { readonly ok: false; readonly error: CareerLoopError } {
  return fail(code, LOOP_COPY[code]);
}

function wrapVerdict(reason: EntryRefusalReason, sentence: string): { readonly ok: false; readonly error: CareerLoopError } {
  return fail(reason, sentence);
}

/**
 * Book a Career meet. Idempotent for the same in-progress id. A different
 * meet while one is already entered is `ALREADY_IN_A_MEET`. Eligibility is
 * `entryVerdict`'s, not a second copy of it.
 *
 * Leave-without-settling does not DNF: the booking stays until a successful
 * `applyMeetResult` clears it. Re-entering the same booked meet returns the
 * same definition without re-testing the day, so a player who walked away
 * from weigh-in can walk back in.
 */
export function applyEnterMeet(
  lifter: CareerLifter,
  enteredMeetId: string | null,
  meetId: string,
  day: number,
): CareerLoopResult<EnteredCareerMeet> {
  const today = asStreakDay(day);
  const meet = careerMeetFromId(meetId);
  if (meet === null) return loopFail('UNKNOWN_MEET');
  if (enteredMeetId !== null && enteredMeetId !== meet.id) return loopFail('ALREADY_IN_A_MEET');
  if (enteredMeetId === meet.id) {
    return { ok: true, value: { enteredMeetId, meet, definition: meetDefinitionFor(meet) } };
  }
  const verdict = entryVerdict(lifter, meet, today);
  if (verdict.kind === 'refused') return wrapVerdict(verdict.reason, verdict.sentence);
  return {
    ok: true,
    value: { enteredMeetId: meet.id, meet, definition: meetDefinitionFor(meet) },
  };
}

/**
 * The Meet Day result is for the booked Career meet. Reconstructs the
 * runnable definition from the calendar — the client-supplied
 * `MeetDefinition` is not consulted. Caller still runs `applyMeetResult`.
 */
export function authorizeCareerMeetRecord(
  enteredMeetId: string,
  reportedMeetId: string,
): CareerLoopResult<EnteredCareerMeet> {
  if (reportedMeetId !== enteredMeetId) return loopFail('MEET_MISMATCH');
  const meet = careerMeetFromId(enteredMeetId);
  if (meet === null) return loopFail('UNKNOWN_MEET');
  return {
    ok: true,
    value: { enteredMeetId, meet, definition: meetDefinitionFor(meet) },
  };
}

/** True when `id` names a scheduled Career meet this calendar holds. */
export function isCareerMeetId(id: string): boolean {
  return careerMeetFromId(id) !== null;
}
