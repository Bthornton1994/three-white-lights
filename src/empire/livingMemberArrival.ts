/**
 * livingMemberArrival.ts — Stage G.2C3 living-member vacancy arrival.
 *
 * G.2C2 may shrink the active roster below the facility ambient cap. This
 * module is the next boundary: it names the arrival record, decides whether
 * one newly accepted attraction-qualifying service observation should mint a
 * replacement into a vacancy, and writes the player-facing join line.
 *
 * It does not own the G.2C1 confirmation machine or G.2C2 departure. It does
 * not invent dues, reputation, seasonality, a return path, a random roll, a
 * percentage, a countdown, or wall-clock churn. Athlete leave/return stays
 * G2-ATHLETE-SEASON-01. Reputation-gated high-paying arrival rates stay G.2E.
 *
 * A vacancy is not itself an arrival. G.1 relocation still appends when the
 * destination cap is larger. G.2C3 is the first slice allowed to mint at the
 * current rung. The observation that executes a departure does not also mint.
 * Neutral or strained service does not fill a vacancy. Exact replay of the
 * attracting observation is a roster no-op because that visit is already the
 * serving member's latest event.
 */

import { refuseWith } from './empireCore';
import type { LivingMemberStayEvidence } from './livingMemberStay';
import type { GymMemberId, LivingGymMember } from './livingMembers';
import type { MemberType } from './members';
import type { SessionEquipmentItem } from './sessions';

/**
 * Inputs the roster writer needs to mint an arrival. Session ownership biases
 * type the same way G.1 creation and relocation already do. Join time is gym
 * clock seconds, not a fabricated service visit and not elapsed-time hazard.
 */
export interface LivingMemberArrivalContext {
  readonly sessionOwned: readonly SessionEquipmentItem[];
  readonly joinedAtSeconds: number;
}

/**
 * Archive of one G.2C3 arrival. The snapshot is the member as minted, not a
 * later history. It exists so tests can name who joined, which observation
 * attracted them, and so the player-facing notice has a last-join record.
 */
export interface LivingMemberArrivalRecord {
  readonly member: LivingGymMember;
  readonly arrivedAtTick: number;
  readonly attractedById: GymMemberId;
}

/**
 * True when a vacancy exists and the serving observation is attraction for
 * the type that would fill it.
 *
 * Type treatment is the arrival-rate boundary only, matching G.2C1's stay
 * response rather than rewriting G.2A/G.2B:
 * - Casual may join on recovery or on formed-neutral evidence (faster to
 *   arrive).
 * - Serious Lifter joins only on recovery (slow to arrive).
 * - Bodybuilder, Powerlifter, and Athlete use the common recovery path.
 *   Athlete seasonality is not this slice.
 */
export function livingMemberShouldArrive(
  vacancyCount: number,
  arrivingType: MemberType,
  servingEvidence: LivingMemberStayEvidence,
): boolean {
  if (vacancyCount <= 0) return false;
  if (servingEvidence === 'forming' || servingEvidence === 'strain') return false;
  if (arrivingType === 'serious-lifter') return servingEvidence === 'recovery';
  if (arrivingType === 'casual') {
    return servingEvidence === 'recovery' || servingEvidence === 'neutral';
  }
  return servingEvidence === 'recovery';
}

export function createLivingMemberArrivalRecord(
  member: LivingGymMember,
  arrivedAtTick: number,
  attractedById: GymMemberId,
): LivingMemberArrivalRecord {
  if (!Number.isFinite(arrivedAtTick) || !Number.isInteger(arrivedAtTick) || arrivedAtTick < 0) {
    refuseWith(`arrival tick must be a non-negative whole number, received ${arrivedAtTick}`);
  }
  return Object.freeze({
    member,
    arrivedAtTick,
    attractedById,
  });
}

export function requireLivingMemberArrivalContext(
  arrival: LivingMemberArrivalContext,
): LivingMemberArrivalContext {
  if (!Number.isFinite(arrival.joinedAtSeconds) || arrival.joinedAtSeconds < 0) {
    refuseWith(
      `arrival joinedAtSeconds must be a non-negative number, received ${arrival.joinedAtSeconds}`,
    );
  }
  return arrival;
}

/** Last accepted G.2C3 arrival, or null when nobody has joined through this seam. */
export function lastLivingMemberArrival(
  arrivals: readonly LivingMemberArrivalRecord[],
): LivingMemberArrivalRecord | null {
  const record = arrivals[arrivals.length - 1];
  return record ?? null;
}

/**
 * Minimal player-facing join line. No percentage, countdown, dues figure,
 * reputation claim, or upgrade-ownership guess.
 */
export function playerFacingArrivalLine(record: LivingMemberArrivalRecord): string {
  return `${record.member.displayName} joined the gym.`;
}
