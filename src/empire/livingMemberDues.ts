/**
 * livingMemberDues.ts — Stage G.2D living-member dues accounting.
 *
 * G.2A already says what recent service means. This module is the first slice
 * allowed to turn that meaning, plus who is actually on the active roster,
 * into Gym Bucks dues. It does not own stay, departure, or vacancy arrival.
 * It does not write reputation, Career, Portfolio, or NpcLifter state. It
 * does not retune frozen D2 ladder income.
 *
 * GDD §5.6: "They generate income. Dues scale with count and satisfaction."
 * Count is the active living roster. Satisfaction is accepted G.2A composite
 * when formed. Forming is not a fake score, so forming members pay the
 * published base rate rather than `memberDuesGymBucks` with an invented
 * 0 or 1. Old crowding × fit × condition `memberSatisfaction` is not an
 * input. `crowdingLoad` is not an input.
 *
 * Accrual grain is gym-clock seconds, not FloorSim ticks and not per-visit
 * cash. Exact replay of an already-settled mark is a roster no-op. A later
 * mark that is earlier than the ledger refuses. The spendable ladder purse
 * stays the frozen facility lump (G2-DUES-PURSE-01).
 */

import { refuseWith } from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';
import { livingMemberExperience } from './livingMemberExperience';
import type { LivingGymMember } from './livingMembers';
import { memberBaseDuesGymBucks, memberDuesGymBucks } from './members';
import { scrubPrecision } from './production';

export const LIVING_MEMBER_DUES_STATUSES = Object.freeze(['forming', 'formed'] as const);
export type LivingMemberDuesStatus = (typeof LIVING_MEMBER_DUES_STATUSES)[number];

/** Current daily dues rate for one living member. Not a probability. */
export interface LivingMemberDailyDues {
  readonly status: LivingMemberDuesStatus;
  readonly gymBucksPerDay: number;
}

/** One contiguous gym-clock settlement. */
export interface LivingMemberDuesSettlement {
  readonly fromSeconds: number;
  readonly toSeconds: number;
  readonly gymBucks: number;
}

/**
 * Authoritative dues ledger carried on `LivingMemberRoster`. Credited Gym
 * Bucks are accounted here; they are not composed into `ladder.gymBucks` in
 * this slice.
 */
export interface LivingMemberDuesLedger {
  readonly settledAtSeconds: number;
  readonly creditedGymBucks: number;
  readonly settlements: readonly LivingMemberDuesSettlement[];
}

export function requireLivingMemberDuesWindow(fromSeconds: number, toSeconds: number): void {
  if (!Number.isFinite(fromSeconds) || fromSeconds < 0) {
    refuseWith(`dues interval start must be a non-negative number, received ${fromSeconds}`);
  }
  if (!Number.isFinite(toSeconds) || toSeconds < 0) {
    refuseWith(`dues interval end must be a non-negative number, received ${toSeconds}`);
  }
  if (toSeconds < fromSeconds) {
    refuseWith(`dues interval end ${toSeconds} is earlier than start ${fromSeconds}`);
  }
}

export function createLivingMemberDuesLedger(settledAtSeconds: number): LivingMemberDuesLedger {
  if (!Number.isFinite(settledAtSeconds) || settledAtSeconds < 0) {
    refuseWith(`dues settledAtSeconds must be a non-negative number, received ${settledAtSeconds}`);
  }
  return Object.freeze({
    settledAtSeconds,
    creditedGymBucks: 0,
    settlements: Object.freeze([]),
  });
}

export function createLivingMemberDuesSettlement(
  fromSeconds: number,
  toSeconds: number,
  gymBucks: number,
): LivingMemberDuesSettlement {
  requireLivingMemberDuesWindow(fromSeconds, toSeconds);
  if (toSeconds === fromSeconds) {
    refuseWith(`dues settlement requires a positive interval, received ${fromSeconds}–${toSeconds}`);
  }
  if (!Number.isFinite(gymBucks) || gymBucks < 0) {
    refuseWith(`dues settlement gym bucks must be a non-negative number, received ${gymBucks}`);
  }
  return Object.freeze({
    fromSeconds,
    toSeconds,
    gymBucks: scrubPrecision(gymBucks),
  });
}

/** Last accepted G.2D settlement, or null when nothing has been settled. */
export function lastLivingMemberDuesSettlement(
  settlements: readonly LivingMemberDuesSettlement[],
): LivingMemberDuesSettlement | null {
  const record = settlements[settlements.length - 1];
  return record ?? null;
}

/** Append one settlement and advance the settled mark. */
export function appendLivingMemberDuesSettlement(
  ledger: LivingMemberDuesLedger,
  settlement: LivingMemberDuesSettlement,
): LivingMemberDuesLedger {
  if (settlement.fromSeconds !== ledger.settledAtSeconds) {
    refuseWith(
      `dues settlement start ${settlement.fromSeconds} does not continue ${ledger.settledAtSeconds}`,
    );
  }
  return Object.freeze({
    settledAtSeconds: settlement.toSeconds,
    creditedGymBucks: scrubPrecision(ledger.creditedGymBucks + settlement.gymBucks),
    settlements: Object.freeze([...ledger.settlements, settlement]),
  });
}

/**
 * Daily dues for one living member from accepted G.2A experience.
 *
 * Forming pays published base — the member is present; there is no composite
 * to scale with. Formed pays `memberDuesGymBucks(type, composite)`.
 */
export function livingMemberDailyDuesGymBucks(member: LivingGymMember): LivingMemberDailyDues {
  const experience = livingMemberExperience(member.recentVisits);
  if (experience.status === 'forming' || experience.composite === null) {
    return Object.freeze({
      status: 'forming',
      gymBucksPerDay: memberBaseDuesGymBucks(member.type),
    });
  }
  return Object.freeze({
    status: 'formed',
    gymBucksPerDay: memberDuesGymBucks(member.type, experience.composite),
  });
}

function overlapSeconds(
  joinedAtSeconds: number,
  fromSeconds: number,
  toSeconds: number,
): number {
  if (!Number.isFinite(joinedAtSeconds) || joinedAtSeconds < 0) {
    refuseWith(`joinedAtSeconds must be a non-negative number, received ${joinedAtSeconds}`);
  }
  const start = Math.max(fromSeconds, joinedAtSeconds);
  if (start >= toSeconds) return 0;
  return toSeconds - start;
}

/** Gym Bucks one living member owes across `[fromSeconds, toSeconds)`. */
export function livingMemberDuesGymBucksForInterval(
  member: LivingGymMember,
  fromSeconds: number,
  toSeconds: number,
): number {
  requireLivingMemberDuesWindow(fromSeconds, toSeconds);
  const seconds = overlapSeconds(member.joinedAtSeconds, fromSeconds, toSeconds);
  if (seconds === 0) return 0;
  const daily = livingMemberDailyDuesGymBucks(member);
  return scrubPrecision(daily.gymBucksPerDay * (seconds / EMPIRE_TUNING.SECONDS_PER_DAY));
}

/**
 * Gym Bucks the active roster owes across a gym-clock window. Departed
 * members are not in `members` and do not pay. Joins during the window are
 * pro-rated from `joinedAtSeconds`.
 */
export function livingMemberDuesForWindow(
  members: readonly LivingGymMember[],
  fromSeconds: number,
  toSeconds: number,
): number {
  requireLivingMemberDuesWindow(fromSeconds, toSeconds);
  if (toSeconds === fromSeconds) return 0;
  let total = 0;
  for (const member of members) {
    total += livingMemberDuesGymBucksForInterval(member, fromSeconds, toSeconds);
  }
  return scrubPrecision(total);
}

/**
 * Member-card dues line. No percentage, countdown, reputation claim, or
 * upgrade-ownership guess.
 */
export function playerFacingDuesLine(daily: LivingMemberDailyDues): string {
  return `DUES ${daily.gymBucksPerDay} gym bucks a day`;
}
