/**
 * livingMemberDeparture.ts — Stage G.2C2 actual living-member departure.
 *
 * G.2C1 persists stay response up through `departure-eligible`. This module is
 * the next boundary: it names the departure record, decides whether one newly
 * accepted strain-qualifying observation should execute a leave, and writes
 * the player-facing line from accepted G.2B reason authority.
 *
 * It does not own the G.2C1 confirmation machine. It does not reinterpret
 * pressure as probability. It does not invent arrivals, dues, reputation,
 * seasonality, or a return path. Athlete leave/return stays G2-ATHLETE-SEASON-01.
 *
 * Departure is not the observation that first reaches eligibility. A member
 * already `departure-eligible` who then receives a new strain-qualifying
 * service observation under the frozen G.2C1 type-response classifier leaves
 * after that observation is accepted. Neutral evidence does not leave them.
 * Stable evidence participates in G.2C1 recovery instead.
 */

import { refuseWith } from './empireCore';
import type { LivingMemberRetentionPressure } from './livingMemberRetention';
import type { LivingGymMember } from './livingMembers';
import type { LivingMemberStayEvidence, LivingMemberStayStatus } from './livingMemberStay';

export type LivingMemberDepartureReasonKind = 'wait' | 'reliability' | 'service';

/**
 * Archive of one departed living member. The snapshot is not an active roster
 * row. It exists so exact replay of the departure-causing observation is a
 * no-op, conflicting same-tick facts fail closed, and later observations for
 * this identity fail closed rather than resurrecting anyone.
 */
export interface LivingMemberDepartureRecord {
  readonly member: LivingGymMember;
  readonly departedAtTick: number;
  readonly reasonKind: LivingMemberDepartureReasonKind;
  readonly reasonText: string;
}

/**
 * True only when G.2C1 has already established eligibility and the newly
 * accepted observation is strain-qualifying for that member's type.
 */
export function livingMemberShouldDepart(
  stayStatus: LivingMemberStayStatus,
  evidence: LivingMemberStayEvidence,
): boolean {
  return stayStatus === 'departure-eligible' && evidence === 'strain';
}

/**
 * Accepted G.2B reason that will be attributed on a strain-confirming leave.
 * Wait outranks reliability, then service — the same cause order G.2C1 uses.
 */
export function livingMemberDepartureReason(
  retention: LivingMemberRetentionPressure,
): Pick<LivingMemberDepartureRecord, 'reasonKind' | 'reasonText'> {
  let wait: (typeof retention.reasons)[number] | undefined;
  let reliability: (typeof retention.reasons)[number] | undefined;
  let service: (typeof retention.reasons)[number] | undefined;
  for (const reason of retention.reasons) {
    if (reason.kind === 'wait' && wait === undefined) wait = reason;
    if (reason.kind === 'reliability' && reliability === undefined) reliability = reason;
    if (reason.kind === 'service' && service === undefined) service = reason;
  }
  const chosen = wait ?? reliability ?? service;
  if (chosen === undefined || chosen.kind === 'forming') {
    refuseWith('departure requires an accepted wait, reliability, or service reason');
  }
  return Object.freeze({
    reasonKind: chosen.kind,
    reasonText: chosen.text,
  });
}

export function createLivingMemberDepartureRecord(
  member: LivingGymMember,
  departedAtTick: number,
  retention: LivingMemberRetentionPressure,
): LivingMemberDepartureRecord {
  if (
    !Number.isFinite(departedAtTick) ||
    !Number.isInteger(departedAtTick) ||
    departedAtTick < 0
  ) {
    refuseWith(
      `departure tick must be a non-negative whole number, received ${departedAtTick}`,
    );
  }
  const reason = livingMemberDepartureReason(retention);
  return Object.freeze({
    member,
    departedAtTick,
    reasonKind: reason.reasonKind,
    reasonText: reason.reasonText,
  });
}

/** Last accepted departure, or null when nobody has left. */
export function lastLivingMemberDeparture(
  departures: readonly LivingMemberDepartureRecord[],
): LivingMemberDepartureRecord | null {
  const record = departures[departures.length - 1];
  return record ?? null;
}

/**
 * Minimal player-facing leave line. Uses the accepted G.2B reason text rather
 * than a guessed upgrade cause, a percentage, or a countdown.
 */
export function playerFacingDepartureLine(record: LivingMemberDepartureRecord): string {
  return `${record.member.displayName} left the gym. ${record.reasonText}`;
}
