/**
 * livingMemberRetention.ts — Stage G.2B living-member retention pressure.
 *
 * Pure module: zero React, zero side effects, zero I/O, no clock read, no
 * `Math.random`, no state mutation. It derives membership strain from the
 * accepted G.2A `LivingMemberExperience`. It does not write dues, reputation,
 * Gym Bucks, or roster membership. It does not persist a second copy of the
 * score: callers derive it when they need it.
 *
 * Causal chain this file sits on:
 *
 *   physical gym decision
 *   → FloorSim service
 *   → N=5 living-member history
 *   → LivingMemberExperience (G.2A, frozen)
 *   → retention pressure (this file)
 *
 * ===========================================================================
 * 1. What this number is, and what it is not
 * ===========================================================================
 *
 * The formed `pressure` field is a normalized index on `[0, 1]`.
 * 0 is minimum strain (best accepted experience). 1 is maximum strain
 * (worst accepted experience). It is not a chance of departure, not a
 * daily hazard, not a countdown, and not a churn roll. Player-facing copy
 * must not put `%` on it and must not name it as a leave probability.
 *
 * Bounded claim, with the limit and the catcher named:
 *
 *   Claim: formed pressure equals `1 - composite`, clamped to `[0, 1]`.
 *   Limit: this file is type-blind. MemberType does not enter the shipped
 *   function. A later GDD-backed tolerance layer is compared in
 *   `livingMemberRetention.test.ts` and is not shipped. Arithmetic
 *   laundering of a different experience formula is possible if a caller
 *   constructs a fake `LivingMemberExperience`; the catcher for the played
 *   path is that FloorGrid passes `livingMemberExperience(recentVisits)`
 *   straight in, and the fixture tables pin pressure to G.2A composites.
 *   Catcher: `livingMemberRetention.test.ts` (monotone, forming-null,
 *   fixture tables, source fences).
 *
 * ===========================================================================
 * 2. Forming experience produces forming retention
 * ===========================================================================
 *
 * G.2A: empty history → experience status `forming`, composite `null`.
 * This file preserves that uncertainty. Forming retention has status
 * `forming`, `pressure` `null`, and label `Still forming`. It does not
 * claim Stable, Watching, Strained, or At risk.
 *
 * ===========================================================================
 * 3. Common mapping, then type as a second layer (unshipped)
 * ===========================================================================
 *
 * Three common mappings were compared against the G.2A Garage fixtures
 * (see the test file): linear inverse `1 - composite`, convex
 * `(1 - composite)^2`, and a logistic centered at 0.535 (midpoint of the
 * Mixed 0.62 / Rough 0.45 presentation bands) with k = 8. Linear inverse
 * won: it is monotone, hits 0 at experience 1 and 1 at experience 0, has
 * no cliff at Good/Mixed/Rough/Poor, and does not compress Capacity vs
 * Stock into the same "fine" reading. Complexity was not added to justify
 * a module. G.2B's value is the semantic boundary: experience truth →
 * membership consequence input.
 *
 * MemberType does not alter G.2A experience. Casual / Serious Lifter
 * retention-response candidates are compared in tests only. Bodybuilder
 * occupancy, Powerlifter reputation, and Athlete seasonality are not
 * retention modifiers here. Athlete leave/return is G2-ATHLETE-SEASON-01,
 * owned by G.2C.
 *
 * ===========================================================================
 * 4. What this file refuses to do
 * ===========================================================================
 *
 * No member leaves. No arrival except G.1 facility-expansion (not this
 * module). No `memberSatisfaction`, `crowdingLoad`,
 * `MEMBER_TYPE_CROWDING_SENSITIVITY`, `equipmentFitScore`,
 * `memberDuesGymBucks`, or `reputationFromMembers`. No Q/C/T ownership
 * read. Offline clock advance and relocation without a new visit cannot
 * change this result, because they cannot change G.2A experience.
 */

import { refuseWith } from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';
import type { LivingMemberExperience } from './livingMemberExperience';

const KNOBS = EMPIRE_TUNING.LIVING_MEMBER_RETENTION;

export const LIVING_MEMBER_RETENTION_STATUSES = Object.freeze(['forming', 'formed'] as const);
export type LivingMemberRetentionStatus = (typeof LIVING_MEMBER_RETENTION_STATUSES)[number];

export type LivingMemberRetentionReasonKind = 'forming' | 'wait' | 'reliability' | 'service';

export interface LivingMemberRetentionReason {
  readonly kind: LivingMemberRetentionReasonKind;
  readonly text: string;
}

export interface LivingMemberRetentionPressure {
  readonly status: LivingMemberRetentionStatus;
  readonly pressure: number | null;
  readonly label: string;
  readonly reasons: readonly LivingMemberRetentionReason[];
}

function clampUnit(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function membershipLabel(pressure: number): string {
  if (pressure < KNOBS.watchingMin) return 'Stable';
  if (pressure < KNOBS.strainedMin) return 'Watching';
  if (pressure < KNOBS.atRiskMin) return 'Strained';
  return 'At risk';
}

const FORMING: LivingMemberRetentionPressure = Object.freeze({
  status: 'forming',
  pressure: null,
  label: 'Still forming',
  reasons: Object.freeze([
    Object.freeze({
      kind: 'forming',
      text: 'Membership is still forming.',
    }),
  ]),
});

function formedReasons(
  experience: LivingMemberExperience,
  pressure: number,
): readonly LivingMemberRetentionReason[] {
  const reasons: LivingMemberRetentionReason[] = [];
  if (experience.labels.wait === 'Strained' || experience.labels.wait === 'Rough') {
    reasons.push(
      Object.freeze({
        kind: 'wait',
        text: 'Long waits are testing this membership.',
      }),
    );
  }
  for (const reason of experience.reasons) {
    if (reason.kind === 'reliability') {
      reasons.push(
        Object.freeze({
          kind: 'reliability',
          text: 'Interrupted sessions are creating strain.',
        }),
      );
    }
  }
  if (pressure < KNOBS.watchingMin) {
    reasons.push(
      Object.freeze({
        kind: 'service',
        text: 'Recent service has been working well.',
      }),
    );
  } else if (reasons.length === 0) {
    reasons.push(
      Object.freeze({
        kind: 'service',
        text: 'Recent service is shaping this membership.',
      }),
    );
  }
  return Object.freeze(reasons);
}

/**
 * Retention pressure for one living member, from accepted G.2A experience.
 *
 * Pass the result of `livingMemberExperience(member.recentVisits)`. Display
 * name, member type, ordinal, and current upgrades are not inputs.
 */
export function livingMemberRetentionPressure(
  experience: LivingMemberExperience,
): LivingMemberRetentionPressure {
  if (experience.status === 'forming' || experience.composite === null) {
    return FORMING;
  }
  if (!Number.isFinite(experience.composite)) {
    refuseWith(
      `formed living-member experience composite must be finite, received ${experience.composite}`,
    );
  }
  const pressure = clampUnit(1 - experience.composite);
  return Object.freeze({
    status: 'formed',
    pressure,
    label: membershipLabel(pressure),
    reasons: formedReasons(experience, pressure),
  });
}
