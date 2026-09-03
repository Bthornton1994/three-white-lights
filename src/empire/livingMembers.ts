/**
 * livingMembers.ts — Stage G.1: living floor-member identity and service outcomes.
 *
 * Pure module: zero React, zero side effects, zero I/O, no `Math.random`.
 * Persists the bodies the player sees on the played floor — NOT `NpcLifter`
 * (`empireCore.ts`'s idle roster), NOT `MemberRoster` (`members.ts`'s
 * aggregate satisfaction inputs). Those populations stay separate.
 *
 * NOT BUILT HERE, ON PURPOSE — later stages:
 *
 *   - No retention/departure, no dues wiring, no `reputationFromMembers`
 *     wiring, no `memberSatisfaction` calls.
 *   - No offline-fabricated service visits — observations arrive only from
 *     real `floorSim.ts` steps while the sim is running.
 *   - No Career/Meet → `EmpireState.reputation` path.
 */

import { refuseWith } from './empireCore';
import { ambientMemberRoster } from './floor';
import type { FloorSimServiceObservation } from './floorSim';
import type { LadderEquipmentItem, LadderRung } from './ladder';
import type { MemberType } from './members';
import type { SessionEquipmentItem } from './sessions';
import { EMPIRE_TUNING } from './empireTuning';

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/** Stable identity for one living floor member. Derived, never random. */
export type GymMemberId = string & { readonly __brand: 'GymMemberId' };

/** One completed or interrupted station use, recorded from floor-sim truth. */
export interface ServiceVisitRecord {
  readonly stationKind: FloorSimServiceObservation['stationKind'];
  readonly stationKey: string;
  readonly waitTicks: number;
  readonly trainingExperience: number;
  readonly outcome: 'completed' | 'interrupted';
  readonly observedAtTick: number;
}

/** One persistent member the player can recognise across sim resets. */
export interface LivingGymMember {
  readonly id: GymMemberId;
  readonly type: MemberType;
  /** Gym clock seconds when this member joined the floor roster. */
  readonly joinedAtSeconds: number;
  readonly recentVisits: readonly ServiceVisitRecord[];
}

/** The authoritative living roster carried in `GymViewState`. */
export interface LivingMemberRoster {
  readonly rung: LadderRung;
  readonly identityNonce: number;
  readonly members: readonly LivingGymMember[];
}

/** History limits compared in tests; the shipped limit is the middle entry. */
export const SERVICE_HISTORY_WINDOWS = EMPIRE_TUNING.LIVING_MEMBER_SERVICE_HISTORY_WINDOWS;
export const SHIPPED_SERVICE_HISTORY_WINDOW = EMPIRE_TUNING.LIVING_MEMBER_SERVICE_HISTORY_WINDOW;
export const SERVICE_WAIT_SHORT_MAX_TICKS = EMPIRE_TUNING.LIVING_MEMBER_WAIT_SHORT_MAX_TICKS;
export const SERVICE_WAIT_LONG_MIN_TICKS = EMPIRE_TUNING.LIVING_MEMBER_WAIT_LONG_MIN_TICKS;

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/** Deterministic id from rung, roster index and the floor-sim render nonce. */
export function deriveMemberId(rung: LadderRung, index: number, identityNonce: number): GymMemberId {
  if (!Number.isInteger(index) || index < 0) {
    refuseWith(`member index must be a non-negative whole number, received ${index}`);
  }
  if (!Number.isInteger(identityNonce) || identityNonce < 0) {
    refuseWith(
      `living-member identity nonce must be a non-negative whole number, received ${identityNonce}`,
    );
  }
  return `member:${rung}:${index}:n${identityNonce}` as GymMemberId;
}

/** Opening roster: one living member per ambient placement, empty history. */
export function createLivingMemberRoster(
  rung: LadderRung,
  barbellOwned: readonly LadderEquipmentItem[],
  sessionOwned: readonly SessionEquipmentItem[],
  joinedAtSeconds: number,
  identityNonce: number,
): LivingMemberRoster {
  if (!Number.isFinite(joinedAtSeconds) || joinedAtSeconds < 0) {
    refuseWith(`joinedAtSeconds must be a non-negative number, received ${joinedAtSeconds}`);
  }
  const placements = ambientMemberRoster(rung, barbellOwned, sessionOwned);
  const members = Object.freeze(
    placements.map((row, index) =>
      Object.freeze({
        id: deriveMemberId(rung, index, identityNonce),
        type: row.type,
        joinedAtSeconds,
        recentVisits: Object.freeze([]),
      }),
    ),
  );
  return Object.freeze({ rung, identityNonce, members });
}

/** Resolve a sim member index to its persistent id. */
export function memberIdForIndex(roster: LivingMemberRoster, index: number): GymMemberId | null {
  const row = roster.members[index];
  return row === undefined ? null : row.id;
}

/** Read one living member by sim index. */
export function livingMemberAtIndex(
  roster: LivingMemberRoster,
  index: number,
): LivingGymMember | null {
  const row = roster.members[index];
  return row === undefined ? null : row;
}

// ---------------------------------------------------------------------------
// Service outcomes
// ---------------------------------------------------------------------------

function visitFromObservation(observation: FloorSimServiceObservation): ServiceVisitRecord {
  return Object.freeze({
    stationKind: observation.stationKind,
    stationKey: observation.stationKey,
    waitTicks: observation.waitTicks,
    trainingExperience: observation.trainingExperience,
    outcome: observation.outcome,
    observedAtTick: observation.observedAtTick,
  });
}

function truncateHistory(
  visits: readonly ServiceVisitRecord[],
  limit: number,
): readonly ServiceVisitRecord[] {
  if (visits.length <= limit) return visits;
  return Object.freeze(visits.slice(visits.length - limit));
}

/** Fold floor-sim observations into the living roster. Offline clock does not call this. */
export function applyServiceObservations(
  roster: LivingMemberRoster,
  observations: readonly FloorSimServiceObservation[],
  historyLimit: number = SHIPPED_SERVICE_HISTORY_WINDOW,
): LivingMemberRoster {
  if (!SERVICE_HISTORY_WINDOWS.includes(historyLimit as (typeof SERVICE_HISTORY_WINDOWS)[number])) {
    refuseWith(
      `service history limit must be one of ${SERVICE_HISTORY_WINDOWS.join(', ')}, received ${historyLimit}`,
    );
  }
  if (observations.length === 0) return roster;
  const byId = new Map<GymMemberId, LivingGymMember>();
  for (const member of roster.members) {
    byId.set(member.id, member);
  }
  for (const observation of observations) {
    const id = memberIdForIndex(roster, observation.memberIndex);
    if (id === null) continue;
    const current = byId.get(id);
    if (current === undefined) continue;
    const nextVisits = truncateHistory(
      Object.freeze([...current.recentVisits, visitFromObservation(observation)]),
      historyLimit,
    );
    byId.set(
      id,
      Object.freeze({
        ...current,
        recentVisits: nextVisits,
      }),
    );
  }
  return Object.freeze({
    ...roster,
    members: Object.freeze(roster.members.map((member) => byId.get(member.id) ?? member)),
  });
}

/**
 * Clock advance only moves tenure forward. It never fabricates visits — the
 * gym may have been away; service truth stays in the sim.
 */
export function advanceLivingMemberTenure(
  roster: LivingMemberRoster,
  _gapSeconds: number,
): LivingMemberRoster {
  return roster;
}

// ---------------------------------------------------------------------------
// Player-facing copy
// ---------------------------------------------------------------------------

/** Short stable label derived from the id, not the sim index. */
export function playerFacingMemberShortId(id: GymMemberId): string {
  const parts = id.split(':');
  const index = parts[2] ?? '?';
  return `member ${index}`;
}

/** Plain-language tenure from gym-clock seconds. */
export function playerFacingTenureLine(joinedAtSeconds: number, nowSeconds: number): string {
  const elapsed = Math.max(0, nowSeconds - joinedAtSeconds);
  const days = Math.floor(elapsed / EMPIRE_TUNING.SECONDS_PER_DAY);
  if (days <= 0) return 'new this week';
  if (days === 1) return '1 day as a member';
  return `${days} days as a member`;
}

export function playerFacingWaitExperience(waitTicks: number): string {
  if (waitTicks <= SERVICE_WAIT_SHORT_MAX_TICKS) return 'short wait';
  if (waitTicks >= SERVICE_WAIT_LONG_MIN_TICKS) return 'long wait';
  return 'waited a while';
}

export function playerFacingTrainingExperience(trainingExperience: number): string {
  if (trainingExperience >= EMPIRE_TUNING.STATION_QUALITY_TRAINING_EXPERIENCE) {
    return 'solid workout';
  }
  return 'light session';
}

export function playerFacingServiceVisitLine(visit: ServiceVisitRecord): string {
  const wait = playerFacingWaitExperience(visit.waitTicks);
  const training = playerFacingTrainingExperience(visit.trainingExperience);
  if (visit.outcome === 'interrupted') {
    return `${wait}, ${training}, interrupted`;
  }
  return `${wait}, ${training}, finished`;
}
