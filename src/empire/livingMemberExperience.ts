/**
 * livingMemberExperience.ts — Stage G.2A living-member recent-service meaning.
 *
 * Pure module: zero React, zero side effects, zero I/O, no clock read, no
 * `Math.random`, no state mutation. It derives WHAT recent service means to
 * one living member from the visits G.1 already stored. It does not write
 * dues, reputation, Gym Bucks, retention, or roster membership.
 *
 * G.1 stores what happened (`ServiceVisitRecord`). This file is the semantic
 * layer on top of that history. Later G.2B / G.3 consumers may read the
 * composite after a source audit and a human product gate. This stage does
 * not call those consumers.
 *
 * ===========================================================================
 * 1. Why this is not `memberSatisfaction()`
 * ===========================================================================
 *
 * `members.ts#memberSatisfaction` multiplies aggregate crowding
 * (`crowdingLoad` = weighted headcount / owned equipment count), equipment
 * fit, and a caller-supplied condition multiplier. That was reasonable before
 * G.1 produced per-person queue waits. For a living member, using crowding as
 * the access signal would double-model the same phenomenon: proxy crowding
 * plus actual `queueWaitTicks`.
 *
 * Verdict: `memberSatisfaction` is superseded for living-floor service. It
 * stays as the aggregate / attraction / offline-sim proxy. This module does
 * not call it.
 *
 * Named debts, deferred rather than faked:
 *
 *   G2-CONDITION-01 — SERVICE-LEVEL CONDITION ATTRIBUTION MISSING.
 *   A `FloorSimServiceObservation` carries station kind/key, wait, training
 *   experience and outcome. It does not snapshot `itemCondition` at the
 *   moment of service. Mapping the current gym-wide mean, or inventing 1.0,
 *   would be a substitute. Condition stays out of this score until the
 *   exact station used can be attributed without a parallel condition system.
 *
 *   G2-FIT-01 — EQUIPMENT FIT IS ATTRACTION, NOT RECENT SERVICE.
 *   `equipmentFitScore` asks whether the gym has what this type came for.
 *   Buying unrelated kit after a Powerlifter already joined would move that
 *   score without changing yesterday's session. `trainingExperience` on the
 *   visit is the direct service-quality fact. Fit stays out of this score.
 *
 *   G2-TYPE-01 — NO TYPE-SPECIFIC INTERPRETATION YET.
 *   Casual-leaves-when-crowded and Serious-Lifter-slow-to-leave are retention
 *   dynamics. G.2A establishes a common service-experience truth first.
 *
 * ===========================================================================
 * 2. Wait uses raw ticks; G.1C copy is presentation only
 * ===========================================================================
 *
 * Player-facing wait phrases (`no wait`, `short wait`, `waited a while`,
 * `long wait`, `very long wait`) live in `livingMembers.ts` and must not
 * enter the numerical formula. Future copy edits must not retune later
 * retention economics.
 *
 * Chosen wait curve, after comparing three bounded candidates against the
 * G.1 Garage distributions (see `livingMemberExperience.test.ts`):
 * exponential decay with half-life `waitHalfLifeTicks` (110). Wait 0 is 1;
 * larger wait is never a better score; 95 ticks scores better than 128;
 * there is no step at the G.1C copy thresholds 15 / 40 / 100.
 *
 * ===========================================================================
 * 3. Training uses the recorded experience, not upgrade ownership
 * ===========================================================================
 *
 * Stock completed service is experience 1; Quality is 2. Those values are
 * already on the visit. This file does not read `qualityOwned` or station
 * level. Stock maps to a high legitimate score (a working gym, not a failed
 * one); Quality raises the training component without a direct Q bonus.
 *
 * ===========================================================================
 * 4. Reliability uses mid-use interruption only
 * ===========================================================================
 *
 * `floorSim.ts` emits an interrupted observation only when a member was
 * `using` and the station was moved or removed. Seeking / queuing
 * interruptions do not create visit records. That is a player-caused
 * disrupted set, so it may lower reliability. It is not scored as zero:
 * the set started. There is no random penalty.
 *
 * ===========================================================================
 * 5. Same history, same output
 * ===========================================================================
 *
 * Display name, member ordinal, sprite palette, selected state, current
 * Q/C/T ownership, facility rung, and gym-clock tenure are not inputs.
 * Relocating or advancing the clock without a new observation cannot change
 * this result. Offline advancement fabricates no visits, so it cannot decay
 * this result by absence.
 */

import { refuseWith } from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';
import type { ServiceVisitRecord } from './livingMembers';

const KNOBS = EMPIRE_TUNING.LIVING_MEMBER_EXPERIENCE;

/** Explicit no-history state. Not a fake 1.0 and not a fake 0.0. */
export const LIVING_MEMBER_EXPERIENCE_STATUSES = Object.freeze(['forming', 'formed'] as const);
export type LivingMemberExperienceStatus = (typeof LIVING_MEMBER_EXPERIENCE_STATUSES)[number];

export type LivingMemberExperienceReasonKind =
  | 'forming'
  | 'wait'
  | 'training'
  | 'reliability';

export interface LivingMemberExperienceReason {
  readonly kind: LivingMemberExperienceReasonKind;
  readonly text: string;
}

export interface LivingMemberExperienceComponents {
  readonly wait: number;
  readonly training: number;
  readonly reliability: number;
}

export interface LivingMemberExperienceLabels {
  readonly overall: string;
  readonly wait: string;
  readonly training: string;
  readonly reliability: string;
}

export interface LivingMemberExperience {
  readonly sampleCount: number;
  readonly status: LivingMemberExperienceStatus;
  readonly components: LivingMemberExperienceComponents | null;
  readonly composite: number | null;
  readonly reasons: readonly LivingMemberExperienceReason[];
  readonly labels: LivingMemberExperienceLabels;
}

function clampUnit(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function meanOf(values: readonly number[]): number {
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

function geometricMean(values: readonly number[]): number {
  if (values.some((value) => value <= 0)) return 0;
  let logSum = 0;
  for (const value of values) logSum += Math.log(value);
  return Math.exp(logSum / values.length);
}

/**
 * Wait component from raw queue ticks. Exponential decay; wait 0 is 1.
 * This function is the mechanical formula. G.1C copy thresholds are not
 * consulted here.
 */
export function waitComponentFromTicks(queueWaitTicks: number): number {
  if (!Number.isFinite(queueWaitTicks) || queueWaitTicks < 0) {
    refuseWith(`queue wait ticks must be a non-negative number, received ${queueWaitTicks}`);
  }
  return clampUnit(Math.exp(-queueWaitTicks / KNOBS.waitHalfLifeTicks));
}

function trainingComponentFromExperience(trainingExperience: number): number {
  if (!Number.isFinite(trainingExperience)) {
    refuseWith(`training experience must be finite, received ${trainingExperience}`);
  }
  const stockExp = EMPIRE_TUNING.STATION_STOCK_TRAINING_EXPERIENCE;
  const qualityExp = EMPIRE_TUNING.STATION_QUALITY_TRAINING_EXPERIENCE;
  const span = qualityExp - stockExp;
  const t = span === 0 ? 0 : (trainingExperience - stockExp) / span;
  return clampUnit(KNOBS.trainingStockScore + t * (KNOBS.trainingQualityScore - KNOBS.trainingStockScore));
}

function reliabilityComponentFromOutcome(outcome: ServiceVisitRecord['outcome']): number {
  if (outcome === 'interrupted') return KNOBS.reliabilityInterrupted;
  return 1;
}

function waitLabel(score: number): string {
  if (score >= KNOBS.waitEasyMin) return 'Easy';
  if (score >= KNOBS.waitManageableMin) return 'Manageable';
  if (score >= KNOBS.waitStrainedMin) return 'Strained';
  return 'Rough';
}

function trainingLabel(score: number): string {
  if (score >= KNOBS.trainingExcellentMin) return 'Excellent';
  if (score >= KNOBS.trainingSolidMin) return 'Solid';
  return 'Thin';
}

function reliabilityLabel(score: number): string {
  if (score >= KNOBS.reliabilitySteadyMin) return 'Steady';
  if (score >= KNOBS.reliabilityUnevenMin) return 'Uneven';
  return 'Disrupted';
}

function overallLabel(score: number): string {
  if (score >= KNOBS.overallGoodMin) return 'Good';
  if (score >= KNOBS.overallMixedMin) return 'Mixed';
  if (score >= KNOBS.overallRoughMin) return 'Rough';
  return 'Poor';
}

function waitReason(score: number): LivingMemberExperienceReason {
  if (score >= KNOBS.waitEasyMin) {
    return Object.freeze({ kind: 'wait', text: 'Service has been prompt.' });
  }
  if (score >= KNOBS.waitManageableMin) {
    return Object.freeze({ kind: 'wait', text: 'Waiting has been more reasonable.' });
  }
  if (score >= KNOBS.waitStrainedMin) {
    return Object.freeze({ kind: 'wait', text: 'Waits have been long.' });
  }
  return Object.freeze({ kind: 'wait', text: 'Waits have been very long.' });
}

function trainingReason(score: number): LivingMemberExperienceReason {
  if (score >= KNOBS.trainingExcellentMin) {
    return Object.freeze({ kind: 'training', text: 'Training setup has been strong.' });
  }
  if (score >= KNOBS.trainingSolidMin) {
    return Object.freeze({ kind: 'training', text: 'Training has been a regular gym session.' });
  }
  return Object.freeze({ kind: 'training', text: 'Training has been lighter than it could be.' });
}

function reliabilityReason(
  score: number,
  interruptedCount: number,
): LivingMemberExperienceReason | null {
  if (score >= KNOBS.reliabilitySteadyMin) return null;
  if (interruptedCount === 1) {
    return Object.freeze({ kind: 'reliability', text: 'One session was interrupted.' });
  }
  return Object.freeze({ kind: 'reliability', text: 'Sessions were interrupted on the floor.' });
}

const FORMING: LivingMemberExperience = Object.freeze({
  sampleCount: 0,
  status: 'forming',
  components: null,
  composite: null,
  reasons: Object.freeze([
    Object.freeze({
      kind: 'forming',
      text: 'No recent service yet — experience still forming.',
    }),
  ]),
  labels: Object.freeze({
    overall: 'Still forming',
    wait: 'Not yet',
    training: 'Not yet',
    reliability: 'Not yet',
  }),
});

/**
 * Recent-service meaning for one living member, from their remembered visits.
 *
 * Pass `member.recentVisits` — not the member record. Display name, type,
 * ordinal and current upgrades are therefore not available to this function.
 */
export function livingMemberExperience(
  history: readonly ServiceVisitRecord[],
): LivingMemberExperience {
  if (history.length === 0) return FORMING;

  const waitScores = history.map((visit) => waitComponentFromTicks(visit.queueWaitTicks));
  const trainingScores = history.map((visit) =>
    trainingComponentFromExperience(visit.trainingExperience),
  );
  const reliabilityScores = history.map((visit) =>
    reliabilityComponentFromOutcome(visit.outcome),
  );
  const components = Object.freeze({
    wait: meanOf(waitScores),
    training: meanOf(trainingScores),
    reliability: meanOf(reliabilityScores),
  });
  const composite = geometricMean([components.wait, components.training, components.reliability]);
  const interruptedCount = history.filter((visit) => visit.outcome === 'interrupted').length;
  const reasons: LivingMemberExperienceReason[] = [
    waitReason(components.wait),
    trainingReason(components.training),
  ];
  const reliability = reliabilityReason(components.reliability, interruptedCount);
  if (reliability !== null) reasons.push(reliability);

  return Object.freeze({
    sampleCount: history.length,
    status: 'formed',
    components,
    composite,
    reasons: Object.freeze(reasons),
    labels: Object.freeze({
      overall: overallLabel(composite),
      wait: waitLabel(components.wait),
      training: trainingLabel(components.training),
      reliability: reliabilityLabel(components.reliability),
    }),
  });
}
