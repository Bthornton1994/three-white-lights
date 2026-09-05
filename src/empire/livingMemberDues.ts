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
 * Count is time-weighted occupancy during the unsettled window. Satisfaction
 * is accepted G.2A composite when formed. Forming is not a fake score, so
 * forming members pay the published base rate rather than `memberDuesGymBucks`
 * with an invented 0 or 1. Old crowding × fit × condition `memberSatisfaction`
 * is not an input. `crowdingLoad` is not an input.
 *
 * Accrual grain is gym-clock seconds, not FloorSim ticks and not per-visit
 * cash. Occupancy is time-weighted over the unsettled window: joins pro-rate
 * from `joinedAtSeconds`, and a G.2C2 leave during the window still pays for
 * the stub it was active. A leave stamped on the settle-window start — the
 * production `gymViewReduce` observation arm, where `collectedAt` equals
 * `dues.settledAtSeconds` — still occupies the open GymHost tick
 * (`WALL_CLOCK_TICK_INTERVAL_SECONDS`), clipped to the window, so a played
 * leave is not `[mark, mark)`. Exact replay of an already-settled mark is a
 * roster no-op. A later mark that is earlier than the ledger refuses. The
 * production clock path credits each ledger delta onto `ladder.gymBucks` on
 * top of frozen D2 facility income. This module does not write ladder state
 * and does not retune facility rates.
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
 * Occupancy end for a departed living member. Gym-clock seconds, not a
 * FloorSim tick. Presence is `[joinedAtSeconds, departedAtSeconds)`.
 */
export interface LivingMemberDuesDeparturePresence {
  readonly member: LivingGymMember;
  readonly departedAtSeconds: number;
}

/**
 * Authoritative dues ledger carried on `LivingMemberRoster`. Credited Gym
 * Bucks are the income amount the production clock path adds onto
 * `ladder.gymBucks`. This ledger is not itself the purse.
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

/** Gym-clock occupancy end. Leave cannot precede join. */
export function requireLivingMemberDuesOccupancyClock(
  gymClockSeconds: number,
  joinedAtSeconds: number,
): number {
  if (!Number.isFinite(gymClockSeconds) || gymClockSeconds < 0) {
    refuseWith(`dues occupancy gym clock must be a non-negative number, received ${gymClockSeconds}`);
  }
  if (!Number.isFinite(joinedAtSeconds) || joinedAtSeconds < 0) {
    refuseWith(`joinedAtSeconds must be a non-negative number, received ${joinedAtSeconds}`);
  }
  if (gymClockSeconds < joinedAtSeconds) {
    refuseWith(
      `dues occupancy gym clock ${gymClockSeconds} is earlier than joinedAtSeconds ${joinedAtSeconds}`,
    );
  }
  return gymClockSeconds;
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

/** Gym Bucks credited between two ledger snapshots. Replay of the same mark is 0. */
export function livingMemberDuesCreditedDelta(
  before: LivingMemberDuesLedger,
  after: LivingMemberDuesLedger,
): number {
  return after.creditedGymBucks - before.creditedGymBucks;
}

/**
 * Add a living-dues ledger credit onto a Gym Bucks purse. Zero delta is
 * identity. A negative credit refuses — the ledger only grows. This is
 * spendable-income composition, not a D2 facility-rate retune.
 */
export function creditLivingMemberDuesGymBucks(
  gymBucks: number,
  creditedDelta: number,
): number {
  if (!Number.isFinite(gymBucks)) {
    refuseWith(`gym bucks purse must be a finite number, received ${gymBucks}`);
  }
  if (!Number.isFinite(creditedDelta)) {
    refuseWith(`dues credit must be a finite number, received ${creditedDelta}`);
  }
  if (creditedDelta < 0) {
    refuseWith(`dues credit must be non-negative, received ${creditedDelta}`);
  }
  if (creditedDelta === 0) return gymBucks;
  return scrubPrecision(gymBucks + creditedDelta);
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

function presenceOverlapSeconds(
  joinedAtSeconds: number,
  untilSeconds: number,
  fromSeconds: number,
  toSeconds: number,
): number {
  if (!Number.isFinite(joinedAtSeconds) || joinedAtSeconds < 0) {
    refuseWith(`joinedAtSeconds must be a non-negative number, received ${joinedAtSeconds}`);
  }
  if (!Number.isFinite(untilSeconds) || untilSeconds < 0) {
    refuseWith(`dues occupancy gym clock must be a non-negative number, received ${untilSeconds}`);
  }
  const start = Math.max(fromSeconds, joinedAtSeconds);
  const end = Math.min(toSeconds, untilSeconds);
  if (start >= end) return 0;
  return end - start;
}

/**
 * Exclusive gym-clock end of a departed member's presence in `[from, to)`.
 *
 * A stamp strictly inside the window is used as-is. A stamp on the window
 * start is the production observation arm: GymHost has not yet dispatched
 * the tick the leave occurred in, so occupancy is that open tick clipped to
 * the settle window — not `[from, from)` and not the whole following skip.
 */
export function livingMemberDuesOccupancyUntilSeconds(
  departedAtSeconds: number,
  fromSeconds: number,
  toSeconds: number,
): number {
  requireLivingMemberDuesWindow(fromSeconds, toSeconds);
  if (!Number.isFinite(departedAtSeconds) || departedAtSeconds < 0) {
    refuseWith(
      `dues occupancy gym clock must be a non-negative number, received ${departedAtSeconds}`,
    );
  }
  if (departedAtSeconds !== fromSeconds) return departedAtSeconds;
  return Math.min(
    toSeconds,
    fromSeconds + EMPIRE_TUNING.WALL_CLOCK_TICK_INTERVAL_SECONDS,
  );
}

/**
 * Gym Bucks one living member owes across `[fromSeconds, toSeconds)`.
 * `untilSeconds` is the exclusive gym-clock end of presence; omitted means
 * still active through the window.
 */
export function livingMemberDuesGymBucksForInterval(
  member: LivingGymMember,
  fromSeconds: number,
  toSeconds: number,
  untilSeconds: number = toSeconds,
): number {
  requireLivingMemberDuesWindow(fromSeconds, toSeconds);
  const seconds = presenceOverlapSeconds(
    member.joinedAtSeconds,
    untilSeconds,
    fromSeconds,
    toSeconds,
  );
  if (seconds === 0) return 0;
  const daily = livingMemberDailyDuesGymBucks(member);
  return scrubPrecision(daily.gymBucksPerDay * (seconds / EMPIRE_TUNING.SECONDS_PER_DAY));
}

/**
 * Gym Bucks owed across a gym-clock window from time-weighted occupancy.
 * Active `members` pay through the window end, each pro-rated from
 * `joinedAtSeconds`. `departed` rows still pay `[joinedAtSeconds, until)`
 * clipped to the window. A stamp strictly before the window start pays
 * nothing. A stamp on the window start occupies the open GymHost tick.
 */
export function livingMemberDuesForWindow(
  members: readonly LivingGymMember[],
  fromSeconds: number,
  toSeconds: number,
  departed: readonly LivingMemberDuesDeparturePresence[] = Object.freeze([]),
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
      refuseWith(`dues occupancy names active member ${row.member.id}`);
    }
    if (departedIds.has(row.member.id)) {
      refuseWith(`dues occupancy names departed member ${row.member.id} twice`);
    }
    departedIds.add(row.member.id);
  }
  let total = 0;
  for (const member of members) {
    total += livingMemberDuesGymBucksForInterval(member, fromSeconds, toSeconds);
  }
  for (const row of departed) {
    total += livingMemberDuesGymBucksForInterval(
      row.member,
      fromSeconds,
      toSeconds,
      livingMemberDuesOccupancyUntilSeconds(
        row.departedAtSeconds,
        fromSeconds,
        toSeconds,
      ),
    );
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
