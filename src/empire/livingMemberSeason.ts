/**
 * livingMemberSeason.ts — G2-ATHLETE-SEASON-01 Athlete seasonal leave / return.
 *
 * Pure calendar and copy. Zero React, zero I/O, no `Math.random`, no
 * `Date.now`. It does not write dues or reputation ledgers — clock
 * composition lives in `livingMembers.ts` (`settleLivingMemberClock`).
 *
 * GDD §5.6: Athlete quirk is "Seasonal — leaves and returns." Leaving is
 * visible: the floor count drops and the player can see why. This module
 * names the shared gym-clock season, the leave/return records, and the
 * one-line notice. Seat reservation, vacancy, and FloorSim population
 * stay in `livingMembers.ts`.
 *
 * A season leave is not a G.2C2 departure. A season return is not a
 * G.2C3 arrival. Departed members never enter `onLeave`. Identity,
 * `joinedAtSeconds`, `recentVisits`, and `stayState` are preserved.
 *
 * Feel knobs (`ATHLETE_SEASON`) are first-pass and unproven.
 */

import { refuseWith } from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';
import type { LivingGymMember } from './livingMembers';
import type { MemberType } from './members';
import { trainingWeekIndexAt } from './sessions';

export type AthleteSeasonPhase = 'off-season' | 'in-season';

export interface LivingMemberSeasonLeaveRecord {
  readonly member: LivingGymMember;
  readonly leftAtSeconds: number;
}

export interface LivingMemberSeasonReturnRecord {
  readonly member: LivingGymMember;
  readonly leftAtSeconds: number;
  readonly returnedAtSeconds: number;
}

export interface LivingMemberSeasonLedger {
  readonly settledAtSeconds: number;
  readonly onLeave: readonly LivingMemberSeasonLeaveRecord[];
  readonly returns: readonly LivingMemberSeasonReturnRecord[];
}

export interface AthleteSeasonBoundary {
  readonly atSeconds: number;
  readonly phase: AthleteSeasonPhase;
}

export interface LivingMemberSeasonEvent {
  readonly kind: 'leave' | 'return';
  readonly member: LivingGymMember;
  readonly atSeconds: number;
}

function requireNonNegativeSeconds(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    refuseWith(`${label} must be a non-negative number, received ${value}`);
  }
  return value;
}

/** Shipped cadence knobs. Feel is unproven. */
export function requireAthleteSeasonKnobs(): {
  readonly cycleWeeks: number;
  readonly inSeasonWeeks: number;
  readonly firstInSeasonWeek: number;
} {
  const knobs = EMPIRE_TUNING.ATHLETE_SEASON;
  if (
    !Number.isInteger(knobs.cycleWeeks) ||
    !Number.isInteger(knobs.inSeasonWeeks) ||
    !Number.isInteger(knobs.firstInSeasonWeek)
  ) {
    refuseWith('ATHLETE_SEASON knobs must be integers');
  }
  if (!(knobs.inSeasonWeeks > 0 && knobs.inSeasonWeeks < knobs.cycleWeeks)) {
    refuseWith('ATHLETE_SEASON inSeasonWeeks must sit in (0, cycleWeeks)');
  }
  if (knobs.firstInSeasonWeek < 1) {
    refuseWith('ATHLETE_SEASON firstInSeasonWeek must be at least 1');
  }
  return knobs;
}

function trainingWeekLengthSeconds(): number {
  return EMPIRE_TUNING.DAYS_PER_TRAINING_WEEK * EMPIRE_TUNING.SECONDS_PER_DAY;
}

export function athleteSeasonPhaseAtWeek(weekIndex: number): AthleteSeasonPhase {
  if (!Number.isInteger(weekIndex) || weekIndex < 0) {
    refuseWith(`athlete season week index must be a non-negative integer, received ${weekIndex}`);
  }
  const knobs = requireAthleteSeasonKnobs();
  const offset = weekIndex - knobs.firstInSeasonWeek;
  const inSeason =
    weekIndex >= knobs.firstInSeasonWeek &&
    ((offset % knobs.cycleWeeks) + knobs.cycleWeeks) % knobs.cycleWeeks < knobs.inSeasonWeeks;
  return inSeason ? 'in-season' : 'off-season';
}

export function athleteSeasonPhaseAt(gymClockSeconds: number): AthleteSeasonPhase {
  return athleteSeasonPhaseAtWeek(trainingWeekIndexAt(gymClockSeconds));
}

/**
 * Week-start boundaries strictly in `(fromSeconds, toSeconds]` where the
 * shared season phase flips. Empty when `from === to`.
 */
export function athleteSeasonBoundariesBetween(
  fromSeconds: number,
  toSeconds: number,
): readonly AthleteSeasonBoundary[] {
  requireNonNegativeSeconds(fromSeconds, 'season interval start');
  requireNonNegativeSeconds(toSeconds, 'season interval end');
  if (toSeconds < fromSeconds) {
    refuseWith(`season interval end ${toSeconds} is earlier than start ${fromSeconds}`);
  }
  if (toSeconds === fromSeconds) return Object.freeze([]);
  const weekSeconds = trainingWeekLengthSeconds();
  const firstStart = Math.floor(fromSeconds / weekSeconds) * weekSeconds + weekSeconds;
  const boundaries: AthleteSeasonBoundary[] = [];
  for (let atSeconds = firstStart; atSeconds <= toSeconds; atSeconds += weekSeconds) {
    const weekIndex = trainingWeekIndexAt(atSeconds);
    const phase = athleteSeasonPhaseAtWeek(weekIndex);
    const previous = weekIndex === 0 ? 'off-season' : athleteSeasonPhaseAtWeek(weekIndex - 1);
    if (phase !== previous) {
      boundaries.push(Object.freeze({ atSeconds, phase }));
    }
  }
  return Object.freeze(boundaries);
}

export function livingMemberTakesSeasonLeave(type: MemberType): boolean {
  return type === 'athlete';
}

export function createLivingMemberSeasonLedger(
  settledAtSeconds: number,
): LivingMemberSeasonLedger {
  requireNonNegativeSeconds(settledAtSeconds, 'season settledAtSeconds');
  return Object.freeze({
    settledAtSeconds,
    onLeave: Object.freeze([]),
    returns: Object.freeze([]),
  });
}

export function createLivingMemberSeasonLeaveRecord(
  member: LivingGymMember,
  leftAtSeconds: number,
): LivingMemberSeasonLeaveRecord {
  requireNonNegativeSeconds(leftAtSeconds, 'season leave mark');
  if (!livingMemberTakesSeasonLeave(member.type)) {
    refuseWith(`season leave is for Athletes, received ${member.type}`);
  }
  return Object.freeze({
    member,
    leftAtSeconds,
  });
}

export function createLivingMemberSeasonReturnRecord(
  record: LivingMemberSeasonLeaveRecord,
  returnedAtSeconds: number,
): LivingMemberSeasonReturnRecord {
  requireNonNegativeSeconds(returnedAtSeconds, 'season return mark');
  if (returnedAtSeconds < record.leftAtSeconds) {
    refuseWith(
      `season return ${returnedAtSeconds} is earlier than leave ${record.leftAtSeconds}`,
    );
  }
  return Object.freeze({
    member: record.member,
    leftAtSeconds: record.leftAtSeconds,
    returnedAtSeconds,
  });
}

export function lastLivingMemberSeasonEvent(
  ledger: LivingMemberSeasonLedger,
): LivingMemberSeasonEvent | null {
  const leave = ledger.onLeave[ledger.onLeave.length - 1];
  const returned = ledger.returns[ledger.returns.length - 1];
  if (leave === undefined && returned === undefined) return null;
  if (leave === undefined) {
    if (returned === undefined) return null;
    return Object.freeze({
      kind: 'return',
      member: returned.member,
      atSeconds: returned.returnedAtSeconds,
    });
  }
  if (returned === undefined) {
    return Object.freeze({
      kind: 'leave',
      member: leave.member,
      atSeconds: leave.leftAtSeconds,
    });
  }
  if (leave.leftAtSeconds > returned.returnedAtSeconds) {
    return Object.freeze({
      kind: 'leave',
      member: leave.member,
      atSeconds: leave.leftAtSeconds,
    });
  }
  return Object.freeze({
    kind: 'return',
    member: returned.member,
    atSeconds: returned.returnedAtSeconds,
  });
}

/** One notice line. No countdown, percent, return week, or dues figure. */
export function playerFacingSeasonLine(event: LivingMemberSeasonEvent): string {
  if (event.kind === 'leave') {
    return `${event.member.displayName} is away for the season.`;
  }
  return `${event.member.displayName} is back from the season.`;
}

/** True when this boundary would move at least one Athlete on `roster`. */
export function athleteSeasonBoundaryWouldMove(
  members: readonly LivingGymMember[],
  onLeave: readonly LivingMemberSeasonLeaveRecord[],
  boundary: AthleteSeasonBoundary,
): boolean {
  if (boundary.phase === 'in-season') {
    return members.some((member) => livingMemberTakesSeasonLeave(member.type));
  }
  return onLeave.length > 0;
}
