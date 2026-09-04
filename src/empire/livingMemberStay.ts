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
 * is refused rather than double-counted.
 *
 * A single adverse visit does not move the persistent stay status. One status
 * step requires a majority of the same five-visit memory window G.2A ships:
 * floor(5 / 2) + 1 = three consecutive confirmations in the same direction.
 * Neutral evidence breaks the pending streak. That makes the shortest path
 * from Staying to departure eligibility nine qualifying service observations,
 * while preserving a visible, recoverable warning path before any later stage
 * is allowed to remove a member.
 *
 * Type treatment is deliberately narrow and GDD-backed:
 * - Casual can accumulate strain at Watching only when accepted G.2B reasons
 *   include wait. This is the living-floor response to “leaves fastest when
 *   crowded” without importing legacy crowding satisfaction.
 * - Bodybuilder, Powerlifter, and Athlete use the common service-response path.
 *   Bodybuilder occupancy is upstream, Powerlifter reputation is later, and
 *   Athlete seasonality is a separate G.2C event model.
 * - Serious Lifter accumulates strain only at At risk, implementing “very slow
 *   to leave” as response tolerance rather than rewriting G.2A/G.2B truth.
 *
 * Recovery uses the same confirmation rule: sustained Stable service steps
 * concern back one state at a time. No random roll, wall clock, leave
 * percentage, or countdown exists here.
 */

import { refuseWith } from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';
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
export type LivingMemberStayDirection = 'strain' | 'recovery';

/**
 * Majority of the accepted recent-service memory, not a free-standing churn
 * knob. If the G.2A service-history window changes, this evidence requirement
 * changes with it and must be re-adjudicated with that upstream decision.
 */
export const LIVING_MEMBER_STAY_CONFIRMATIONS_PER_STEP =
  Math.floor(EMPIRE_TUNING.LIVING_MEMBER_SERVICE_HISTORY_WINDOW / 2) + 1;

export interface LivingMemberStayState {
  readonly status: LivingMemberStayStatus;
  readonly lastEvaluatedVisitTick: number | null;
  readonly lastCause: LivingMemberStayCause;
  /** Pending same-direction evidence. Null means no streak is currently armed. */
  readonly pendingDirection: LivingMemberStayDirection | null;
  /** Consecutive confirmations toward the pending direction, always below the step threshold. */
  readonly confirmations: number;
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
  pendingDirection: null,
  confirmations: 0,
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

function shouldAccumulateStrain(
  type: MemberType,
  retention: LivingMemberRetentionPressure,
  label: FormedRetentionLabel,
): boolean {
  if (label === 'At risk') return true;
  if (type === 'serious-lifter') return false;
  if (label === 'Strained') return true;
  return type === 'casual' && label === 'Watching' && hasReason(retention, 'wait');
}

function confirmedState(
  previous: LivingMemberStayState,
  current: FormedStayStatus,
  direction: LivingMemberStayDirection,
  observedAtTick: number,
  cause: LivingMemberStayCause,
): LivingMemberStayState {
  const confirmations =
    previous.pendingDirection === direction ? previous.confirmations + 1 : 1;
  if (confirmations < LIVING_MEMBER_STAY_CONFIRMATIONS_PER_STEP) {
    return Object.freeze({
      status: current,
      lastEvaluatedVisitTick: observedAtTick,
      lastCause: cause,
      pendingDirection: direction,
      confirmations,
    });
  }

  const nextStatus = moveStatus(current, direction === 'strain' ? 'up' : 'down');
  return Object.freeze({
    status: nextStatus,
    lastEvaluatedVisitTick: observedAtTick,
    lastCause: cause,
    pendingDirection: null,
    confirmations: 0,
  });
}

function neutralState(
  current: FormedStayStatus,
  observedAtTick: number,
  cause: LivingMemberStayCause,
): LivingMemberStayState {
  return Object.freeze({
    status: current,
    lastEvaluatedVisitTick: observedAtTick,
    lastCause: cause,
    pendingDirection: null,
    confirmations: 0,
  });
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
      pendingDirection: null,
      confirmations: 0,
    });
  }

  const label = formedRetentionLabel(retention);
  const current = formedStatus(previous.status);

  if (shouldAccumulateStrain(type, retention, label)) {
    if (current === 'departure-eligible') {
      return neutralState(current, observedAtTick, strainCause(retention));
    }
    return confirmedState(
      previous,
      current,
      'strain',
      observedAtTick,
      strainCause(retention),
    );
  }

  if (label === 'Stable') {
    if (current === 'staying') {
      return neutralState(current, observedAtTick, 'recovery');
    }
    return confirmedState(previous, current, 'recovery', observedAtTick, 'recovery');
  }

  // Watching for common types and Strained/Watching for Serious Lifter are
  // neutral evidence: they neither worsen nor heal the persistent state, and
  // they break a streak so confirmations must actually be consecutive.
  return neutralState(current, observedAtTick, strainCause(retention));
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
