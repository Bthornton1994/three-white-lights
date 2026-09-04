/**
 * livingMemberStay.ts — Stage G.2C1 persistent stay-response foundation.
 *
 * G.2B is a type-blind service-derived pressure signal. This module is the
 * next boundary: it turns repeated, accepted pressure evaluations into a
 * persistent member response. It does not calculate satisfaction, does not
 * reinterpret pressure as probability, and does not remove a roster row.
 *
 * One evaluation is processed per real service observation. The observation
 * tick is persisted so render/reducer replay is idempotent and an older event
 * is refused rather than double-counted. A member must traverse multiple
 * formed states before becoming departure-eligible, so one bad visit cannot
 * make a member disappear.
 *
 * Type treatment is deliberately narrow and GDD-backed:
 * - Casual may deteriorate at Watching only when accepted G.2B reasons include
 *   wait. That is the living-floor interpretation of “leaves fastest when
 *   crowded” without importing legacy crowding satisfaction.
 * - Bodybuilder, Powerlifter, and Athlete use the common service-response path.
 *   Bodybuilder occupancy is upstream, Powerlifter reputation is later, and
 *   Athlete seasonality is a separate G.2C event model.
 * - Serious Lifter deteriorates only at At risk, implementing “very slow to
 *   leave” as response tolerance rather than rewriting G.2A/G.2B truth.
 *
 * Recovery is hysteretic: Stable service steps concern back one state at a
 * time. Watching holds unless the Casual wait rule advances it. No random
 * roll, wall clock, leave percentage, or countdown exists here.
 */

import { refuseWith } from './empireCore';
import type { LivingMemberRetentionPressure } from './livingMemberRetention';
import type { MemberType } from './members';

export const LIVING_MEMBER_STAY_STATUSES = Object.freeze([
  'forming',
  'staying',
  'unsettled',
  'considering-exit',
  'departure-eligible',
] as const);

export type LivingMemberStayStatus = (typeof LIVING_MEMBER_STAY_STATUSES)[number];
export type LivingMemberStayCause = 'forming' | 'wait' | 'reliability' | 'service' | 'recovery';

export interface LivingMemberStayState {
  readonly status: LivingMemberStayStatus;
  readonly lastEvaluatedVisitTick: number | null;
  readonly lastCause: LivingMemberStayCause;
}

const FORMED_STAY_STATUSES = Object.freeze([
  'staying',
  'unsettled',
  'considering-exit',
  'departure-eligible',
] as const);

type FormedStayStatus = (typeof FORMED_STAY_STATUSES)[number];

const FORMED_RETENTION_LABELS = Object.freeze(['Stable', 'Watching', 'Strained', 'At risk'] as const);
type FormedRetentionLabel = (typeof FORMED_RETENTION_LABELS)[number];

const INITIAL_STAY_STATE: LivingMemberStayState = Object.freeze({
  status: 'forming',
  lastEvaluatedVisitTick: null,
  lastCause: 'forming',
});

export function createLivingMemberStayState(): LivingMemberStayState {
  return INITIAL_STAY_STATE;
}

function formedStatus(status: LivingMemberStayStatus): FormedStayStatus {
  if (status === 'forming') return 'staying';
  return status;
}

function moveStatus(status: FormedStayStatus, direction: 'up' | 'down'): FormedStayStatus {
  const index = FORMED_STAY_STATUSES.indexOf(status);
  if (index < 0) refuseWith(`unknown living-member stay status ${status}`);
  const nextIndex =
    direction === 'up'
      ? Math.min(index + 1, FORMED_STAY_STATUSES.length - 1)
      : Math.max(index - 1, 0);
  return FORMED_STAY_STATUSES[nextIndex] as FormedStayStatus;
}

function formedRetentionLabel(retention: LivingMemberRetentionPressure): FormedRetentionLabel {
  if (!FORMED_RETENTION_LABELS.includes(retention.label as FormedRetentionLabel)) {
    refuseWith(`formed retention has unknown label ${retention.label}`);
  }
  return retention.label as FormedRetentionLabel;
}

function hasReason(
  retention: LivingMemberRetentionPressure,
  kind: 'wait' | 'reliability',
): boolean {
  return retention.reasons.some((reason) => reason.kind === kind);
}

function strainCause(retention: LivingMemberRetentionPressure): LivingMemberStayCause {
  if (hasReason(retention, 'wait')) return 'wait';
  if (hasReason(retention, 'reliability')) return 'reliability';
  return 'service';
}

function shouldEscalate(
  type: MemberType,
  retention: LivingMemberRetentionPressure,
  label: FormedRetentionLabel,
): boolean {
  if (label === 'At risk') return true;
  if (type === 'serious-lifter') return false;
  if (label === 'Strained') return true;
  return type === 'casual' && label === 'Watching' && hasReason(retention, 'wait');
}

/**
 * Fold one new service-derived G.2B evaluation into persistent stay response.
 * Replaying the same observation tick is a no-op; an older tick is invalid.
 */
export function advanceLivingMemberStay(
  previous: LivingMemberStayState,
  type: MemberType,
  retention: LivingMemberRetentionPressure,
  observedAtTick: number,
): LivingMemberStayState {
  if (!Number.isFinite(observedAtTick) || !Number.isInteger(observedAtTick) || observedAtTick < 0) {
    refuseWith(`stay evaluation tick must be a non-negative whole number, received ${observedAtTick}`);
  }

  if (previous.lastEvaluatedVisitTick !== null) {
    if (observedAtTick < previous.lastEvaluatedVisitTick) {
      refuseWith(
        `stay evaluation tick ${observedAtTick} is older than ${previous.lastEvaluatedVisitTick}`,
      );
    }
    if (observedAtTick === previous.lastEvaluatedVisitTick) return previous;
  }

  if (retention.status === 'forming' || retention.pressure === null) {
    if (previous.status !== 'forming') {
      refuseWith('formed living-member stay state cannot return to forming');
    }
    return Object.freeze({
      status: 'forming',
      lastEvaluatedVisitTick: observedAtTick,
      lastCause: 'forming',
    });
  }

  const label = formedRetentionLabel(retention);
  const current = formedStatus(previous.status);
  if (shouldEscalate(type, retention, label)) {
    return Object.freeze({
      status: moveStatus(current, 'up'),
      lastEvaluatedVisitTick: observedAtTick,
      lastCause: strainCause(retention),
    });
  }

  if (label === 'Stable') {
    return Object.freeze({
      status: moveStatus(current, 'down'),
      lastEvaluatedVisitTick: observedAtTick,
      lastCause: 'recovery',
    });
  }

  return Object.freeze({
    status: current,
    lastEvaluatedVisitTick: observedAtTick,
    lastCause: strainCause(retention),
  });
}

export function isLivingMemberDepartureEligible(state: LivingMemberStayState): boolean {
  return state.status === 'departure-eligible';
}

/**
 * Readable state only. Departure-eligible deliberately shares copy with the
 * preceding warning state until a later G.2C slice actually performs a
 * departure; the UI must not claim an event that has not happened.
 */
export function playerFacingStayResponse(state: LivingMemberStayState): string {
  switch (state.status) {
    case 'forming':
      return 'Still forming';
    case 'staying':
      return 'Staying';
    case 'unsettled':
      return 'Unsettled';
    case 'considering-exit':
    case 'departure-eligible':
      return 'Considering leaving';
  }
}
