/**
 * livingMemberReputation.ts — Stage G.2E member-side institutional reputation.
 *
 * G.2D already says how long a living member occupied an unsettled gym-clock
 * window. This module is the first slice allowed to turn that occupancy, plus
 * published type reputation rates, into a living-member reputation ledger.
 * It does not own stay, departure, vacancy arrival, or dues. It does not
 * write Career, Meet, Portfolio, or NpcLifter state. It does not retune
 * check-in reputation or close E-REP-01. Career/Meet → EmpireState.reputation
 * stays blocked.
 *
 * GDD §5.6: "Reputation is earned mostly by powerlifter and serious-lifter
 * members, and by your own competition results. It gates: ... the arrival
 * rate of the high-paying member types." This file is the members half as a
 * gym-clock rate from living occupancy. Competition results are Stage E's
 * sporting calculator and are not an argument here. High-paying arrival
 * gating consumes the credited ledger in `livingMemberArrival.ts`.
 *
 * Accrual grain is gym-clock seconds, not FloorSim ticks and not per-visit
 * credit. Occupancy is the same time-weighted presence G.2D ships. Type rate
 * is `memberReputationPerDay` — not old crowding × fit `memberSatisfaction`,
 * not `reputationFromMembers` on an aggregate `MemberRoster`, and not a
 * G.2A composite scale (the GDD does not say member reputation scales with
 * satisfaction). Forming members still occupy, so they still contribute their
 * published type rate. Casual's published rate is 0.
 *
 * Exact replay of an already-settled mark is a roster no-op. A later mark
 * that is earlier than the ledger refuses. Service observations do not
 * credit reputation. They may stamp gym-clock occupancy ends onto
 * `duesLeftAtSeconds` so a leave inside an unsettled window still contributes
 * the active stub — the occupancy marks are shared with G.2D.
 */

import { refuseWith } from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';
import {
  livingMemberDuesOccupancyUntilSeconds,
  livingMemberPresenceOverlapSeconds,
  requireLivingMemberDuesOccupancyClock,
  requireLivingMemberDuesWindow,
  type LivingMemberDuesDeparturePresence,
} from './livingMemberDues';
import type { LivingGymMember } from './livingMembers';
import { memberReputationPerDay } from './members';
import { scrubPrecision } from './production';

/** One contiguous gym-clock reputation settlement. */
export interface LivingMemberReputationSettlement {
  readonly fromSeconds: number;
  readonly toSeconds: number;
  readonly reputation: number;
}

/**
 * Authoritative member-side reputation ledger carried on
 * `LivingMemberRoster`. Credited reputation is the institutional number
 * G.2E high-paying arrival reads. This ledger is not EmpireState.reputation
 * and is not the check-in / NPC-tenure accumulator.
 */
export interface LivingMemberReputationLedger {
  readonly settledAtSeconds: number;
  readonly creditedReputation: number;
  readonly settlements: readonly LivingMemberReputationSettlement[];
}

export type LivingMemberReputationDeparturePresence = LivingMemberDuesDeparturePresence;

export function createLivingMemberReputationLedger(
  settledAtSeconds: number,
): LivingMemberReputationLedger {
  if (!Number.isFinite(settledAtSeconds) || settledAtSeconds < 0) {
    refuseWith(`reputation settledAtSeconds must be a non-negative number, received ${settledAtSeconds}`);
  }
  return Object.freeze({
    settledAtSeconds,
    creditedReputation: 0,
    settlements: Object.freeze([]),
  });
}

export function createLivingMemberReputationSettlement(
  fromSeconds: number,
  toSeconds: number,
  reputation: number,
): LivingMemberReputationSettlement {
  requireLivingMemberDuesWindow(fromSeconds, toSeconds);
  if (toSeconds === fromSeconds) {
    refuseWith(
      `reputation settlement requires a positive interval, received ${fromSeconds}–${toSeconds}`,
    );
  }
  if (!Number.isFinite(reputation) || reputation < 0) {
    refuseWith(`reputation settlement must be a non-negative number, received ${reputation}`);
  }
  return Object.freeze({
    fromSeconds,
    toSeconds,
    reputation: scrubPrecision(reputation),
  });
}

/** Reputation credited between two ledger snapshots. Replay of the same mark is 0. */
export function livingMemberReputationCreditedDelta(
  before: LivingMemberReputationLedger,
  after: LivingMemberReputationLedger,
): number {
  return after.creditedReputation - before.creditedReputation;
}

/** Last accepted G.2E settlement, or null when nothing has been settled. */
export function lastLivingMemberReputationSettlement(
  settlements: readonly LivingMemberReputationSettlement[],
): LivingMemberReputationSettlement | null {
  const record = settlements[settlements.length - 1];
  return record ?? null;
}

/** Append one settlement and advance the settled mark. */
export function appendLivingMemberReputationSettlement(
  ledger: LivingMemberReputationLedger,
  settlement: LivingMemberReputationSettlement,
): LivingMemberReputationLedger {
  if (settlement.fromSeconds !== ledger.settledAtSeconds) {
    refuseWith(
      `reputation settlement start ${settlement.fromSeconds} does not continue ${ledger.settledAtSeconds}`,
    );
  }
  return Object.freeze({
    settledAtSeconds: settlement.toSeconds,
    creditedReputation: scrubPrecision(ledger.creditedReputation + settlement.reputation),
    settlements: Object.freeze([...ledger.settlements, settlement]),
  });
}

/** Daily reputation rate for one living member from the published type table. */
export function livingMemberDailyReputation(member: LivingGymMember): number {
  return memberReputationPerDay(member.type);
}

/**
 * Reputation one living member contributes across `[fromSeconds, toSeconds)`.
 * `untilSeconds` is the exclusive gym-clock end of presence; omitted means
 * still active through the window.
 */
export function livingMemberReputationForInterval(
  member: LivingGymMember,
  fromSeconds: number,
  toSeconds: number,
  untilSeconds: number = toSeconds,
): number {
  requireLivingMemberDuesWindow(fromSeconds, toSeconds);
  const seconds = livingMemberPresenceOverlapSeconds(
    member.joinedAtSeconds,
    untilSeconds,
    fromSeconds,
    toSeconds,
  );
  if (seconds === 0) return 0;
  return scrubPrecision(
    livingMemberDailyReputation(member) * (seconds / EMPIRE_TUNING.SECONDS_PER_DAY),
  );
}

/**
 * Member-side reputation across a gym-clock window from time-weighted
 * occupancy. Active `members` contribute through the window end, each
 * pro-rated from `joinedAtSeconds`. `departed` rows still contribute
 * `[joinedAtSeconds, until)` clipped to the window. A stamp strictly before
 * the window start contributes nothing. A stamp on the window start occupies
 * the open GymHost tick — the same occupancy rule G.2D ships.
 */
export function livingMemberReputationForWindow(
  members: readonly LivingGymMember[],
  fromSeconds: number,
  toSeconds: number,
  departed: readonly LivingMemberReputationDeparturePresence[] = Object.freeze([]),
): number {
  requireLivingMemberDuesWindow(fromSeconds, toSeconds);
  if (toSeconds === fromSeconds) return 0;
  const activeIds = new Set<string>();
  for (const member of members) {
    activeIds.add(member.id);
  }
  const departedIds = new Set<string>();
  for (const row of departed) {
    requireLivingMemberDuesOccupancyClock(row.departedAtSeconds, row.member.joinedAtSeconds);
    if (activeIds.has(row.member.id)) {
      refuseWith(`reputation occupancy names active member ${row.member.id}`);
    }
    if (departedIds.has(row.member.id)) {
      refuseWith(`reputation occupancy names departed member ${row.member.id} twice`);
    }
    departedIds.add(row.member.id);
  }
  let total = 0;
  for (const member of members) {
    total += livingMemberReputationForInterval(member, fromSeconds, toSeconds);
  }
  for (const row of departed) {
    total += livingMemberReputationForInterval(
      row.member,
      fromSeconds,
      toSeconds,
      livingMemberDuesOccupancyUntilSeconds(row.departedAtSeconds, fromSeconds, toSeconds),
    );
  }
  return scrubPrecision(total);
}

/**
 * Member-card reputation line. Daily type rate only. No percentage, countdown,
 * Career claim, or upgrade-ownership guess.
 */
export function playerFacingReputationLine(reputationPerDay: number): string {
  if (!Number.isFinite(reputationPerDay) || reputationPerDay < 0) {
    refuseWith(`reputation per day must be a non-negative number, received ${reputationPerDay}`);
  }
  return `REP ${reputationPerDay} a day`;
}
