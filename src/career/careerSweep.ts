/**
 * careerSweep.ts — the inputs the career eligibility measurement runs on, and
 * the two controls it is measured against.
 *
 * Pure: zero React, zero side effects, zero I/O, no clock, no `Math.random`.
 * Every sequence below is a pure function of a seed written down here.
 *
 * ===========================================================================
 * WHY A MODULE AND NOT A HELPER IN THE TEST
 * ===========================================================================
 * The same reason `src/game/streakSweep.ts` exists, and that file says it at
 * length: a measurement whose inputs are not written down is an anecdote. The
 * streak measurement was first published with its seeds unstated and could not
 * afterwards be reproduced by anyone, including its author. So the grid, the
 * seeds, the distribution and the window live here as named constants, and
 * `eligibility.test.ts` measures through them.
 *
 * Registered in `src/tuning/audit.ts` as `data`, not `feel`, and deliberately
 * absent from `src/tuning/index.ts`: turning a seed does not change the game,
 * only which careers the property is checked on. A playtester has no business
 * in this file.
 *
 * ===========================================================================
 * THE PROPERTY, AND THE TWO AXES IT IS MEASURED ON
 * ===========================================================================
 * GDD §12.3 refuses "an injury or setback that punishes a player for showing up
 * daily", and CLAUDE.md turns that into a comparison between two lifters
 * identical except that one did more. For a career calendar the two readings of
 * "more" are different questions and both are measured:
 *
 *   AXIS A — STRENGTH. Two lifters whose best Total differs. The stronger one
 *   must qualify for a superset of the meets, never a smaller set. Exhaustive
 *   over a grid, so it is a proof over the grid rather than a sample.
 *
 *   AXIS B — ATTENDANCE. Two careers identical except that one lifter competed
 *   at one extra meet. The lifter who competed more must qualify for a superset
 *   at the same later day. Sampled from seeds, because the space of careers is
 *   not enumerable.
 *
 * A ZERO WITH NO CONTROL BESIDE IT IS A ZERO ABOUT NOTHING, so each axis ships
 * with a rule that breaks it, and the test pins the control's non-zero count
 * next to the shipped zero. Both controls are designs somebody could plausibly
 * have written, which is what makes them worth keeping:
 *
 *   - `highest-tier-band` — a lifter may only enter the top tier they qualify
 *     for, which is a real anti-sandbagging idea and which makes getting
 *     stronger take meets away.
 *   - `latest-total-wins` — qualification reads the last total instead of the
 *     best, which is how a "current form" system would naturally be written and
 *     which makes a bad meet day cost a lifter meets they had already earned.
 */

import { nextRandom, seedState } from '../game/prng';
import { addDays, type StreakDay } from '../game/streak';
import { type CareerFederationId, type CareerMeetTier } from './careerTuning';
import { entryTier, tiersLowestFirst } from './federation';
import { qualifyingTotalKgFor, scheduledMeets, seasonAnchorDay, type CareerMeet } from './calendar';
import {
  canEnter,
  careerRecordAfterMeet,
  meetsQualifyingTotal,
  newCareerLifter,
  qualifiesFor,
  type CareerLifter,
} from './eligibility';

// ---------------------------------------------------------------------------
// Axis A — strength
// ---------------------------------------------------------------------------

/**
 * The grid of best Totals the strength axis is swept over, and the calendar
 * window the comparison is made in.
 *
 * `null` — a lifter who has never competed — is the bottom of the grid and is
 * included as a value rather than tested separately: it is the state every
 * career starts in and the one place a `>=` comparison has nothing to compare.
 *
 * The step is 2.5 kg because that is the smallest weight a competition bar can
 * move by (`MIN_ATTEMPT_INCREMENT_KG` in `src/game/meet.ts`), so it is the
 * finest grid a real total can land on. The ceiling is comfortably past the
 * heaviest total the sport has seen, so the grid covers every qualifying total
 * this game could reasonably ship and a long way either side.
 */
export const STRENGTH_SWEEP = Object.freeze({
  MIN_TOTAL_KG: 0,
  MAX_TOTAL_KG: 1000,
  STEP_KG: 2.5,
  /** Days after the season anchor the comparison window opens. */
  WINDOW_START_OFFSET_DAYS: 0,
  /** How long that window is. A year, so every tier occurs in it. */
  WINDOW_DAYS: 364,
  /** Whose calendar. Any federation gives the same shape; one is swept. */
  FEDERATION: 'meridian' as CareerFederationId,
});

/**
 * Every best Total on the grid, lowest first, with `null` at the bottom.
 *
 * Ordered so that index order is total order: `i < j` implies the value at `i`
 * is a smaller total than the value at `j`, with `null` — no total at all —
 * below every number.
 */
export function strengthGrid(): readonly (number | null)[] {
  const totals: (number | null)[] = [null];
  const steps = Math.round(
    (STRENGTH_SWEEP.MAX_TOTAL_KG - STRENGTH_SWEEP.MIN_TOTAL_KG) / STRENGTH_SWEEP.STEP_KG,
  );
  for (let index = 0; index <= steps; index += 1) {
    totals.push(STRENGTH_SWEEP.MIN_TOTAL_KG + index * STRENGTH_SWEEP.STEP_KG);
  }
  return totals;
}

// ---------------------------------------------------------------------------
// Axis B — attendance
// ---------------------------------------------------------------------------

/**
 * The careers the attendance axis is sampled from.
 *
 * A career here is a list of meet totals, one per meet the lifter attends, in
 * calendar order. The comparison is a career against the same career with one
 * meet removed, which is the single-superset shape `streakSweep.ts` uses for
 * training days: everything else about the two lifters is identical.
 *
 * The deltas are deliberately two-sided. A distribution that only ever went up
 * would make the latest-total control produce zero violations and the whole
 * comparison would report a clean bill for a rule that is broken — an empty
 * domain reproduced in the one place it would not be noticed. `BAD_DAY_SHARE`
 * is what keeps it non-empty, and the test pins how many bad days the sweep
 * actually produced rather than trusting this comment.
 */
export const ATTENDANCE_SWEEP = Object.freeze({
  SEEDS: Object.freeze([
    20260812, 913377, 4242, 60103, 771, 1, 99991, 314159, 2718281, 17, 555555, 8675309,
    31, 4096, 123456789, 7, 202601, 88, 65537, 1048576, 999, 24601, 5150, 42424242,
  ]),
  /** How many totals are drawn per career. Asserted to outlast the simulation. */
  MEETS_PER_CAREER: 16,
  /** The first meet's total, in kg. Below the regional bar, so it can climb through it. */
  FIRST_TOTAL_KG: 380,
  /** A good day adds up to this much. */
  MAX_GAIN_KG: 70,
  /** A bad day takes off up to this much. */
  MAX_LOSS_KG: 70,
  /** How often a meet is a bad day. */
  BAD_DAY_SHARE: 0.35,
  /** Totals land on the competition grid. */
  ROUNDING_KG: 2.5,
  /** How long the simulated career runs, from the season anchor. */
  SIMULATION_DAYS: 364,
  /** How long a lifter waits between meets before entering another. */
  DAYS_BETWEEN_MEETS: 28,
  /** How long after the simulation both lifters are compared. */
  EVALUATION_LAG_DAYS: 7,
  /** The window the comparison is made over, from the evaluation day. */
  WINDOW_DAYS: 364,
  FEDERATION: 'meridian' as CareerFederationId,
});

/**
 * One career's meet totals, in calendar order.
 *
 * Deterministic in the seed. The first total is fixed so that every career
 * starts below the regional bar and can climb through it; the walk after that
 * is what makes the sequences differ.
 */
export function seededCareerTotals(seed: number, meets: number): readonly number[] {
  const totals: number[] = [];
  let state = seedState(seed);
  let current: number = ATTENDANCE_SWEEP.FIRST_TOTAL_KG;
  for (let index = 0; index < meets; index += 1) {
    const badDraw = nextRandom(state);
    state = badDraw.state;
    const sizeDraw = nextRandom(state);
    state = sizeDraw.state;
    const isBadDay = badDraw.value < ATTENDANCE_SWEEP.BAD_DAY_SHARE;
    const delta = isBadDay
      ? -sizeDraw.value * ATTENDANCE_SWEEP.MAX_LOSS_KG
      : sizeDraw.value * ATTENDANCE_SWEEP.MAX_GAIN_KG;
    current = Math.max(
      0,
      Math.round((current + delta) / ATTENDANCE_SWEEP.ROUNDING_KG) * ATTENDANCE_SWEEP.ROUNDING_KG,
    );
    totals.push(current);
  }
  return totals;
}

/** How many of a total sequence are lower than the one before. */
export function badDayCount(totals: readonly number[]): number {
  let count = 0;
  for (let index = 1; index < totals.length; index += 1) {
    const previous = totals[index - 1];
    const current = totals[index];
    if (previous !== undefined && current !== undefined && current < previous) count += 1;
  }
  return count;
}

// ---------------------------------------------------------------------------
// The controls
// ---------------------------------------------------------------------------

/**
 * Which qualification rule a sweep runs under.
 *
 * `shipped` is `qualifiesFor` itself, imported rather than restated, so a
 * control can never be compared against a copy of the engine that has drifted
 * from the engine.
 */
export type QualificationVariant = 'shipped' | 'highest-tier-band';

/**
 * A control, not a design. Under `highest-tier-band` a lifter qualifies only
 * for the highest tier their total clears — the shape an anti-sandbagging rule
 * takes when somebody writes one — so crossing a qualifying total takes the
 * tiers below it away.
 */
export const QUALIFICATION_VARIANTS: Readonly<
  Record<QualificationVariant, (lifter: CareerLifter, meet: CareerMeet) => boolean>
> = Object.freeze({
  shipped: qualifiesFor,
  'highest-tier-band': (lifter, meet) => {
    if (!qualifiesFor(lifter, meet)) return false;
    return meet.tier === highestQualifiedTier(lifter.bestTotalKg);
  },
});

/** The top tier a total clears, or the entry tier when it clears nothing. */
export function highestQualifiedTier(bestTotalKg: number | null): CareerMeetTier {
  let highest: CareerMeetTier = entryTier();
  for (const tier of tiersLowestFirst()) {
    if (meetsQualifyingTotal(bestTotalKg, qualifyingTotalKgFor(tier))) highest = tier;
  }
  return highest;
}

/** Which rule turns a meet result into a career record. */
export type RecordVariant = 'shipped' | 'latest-total-wins';

/**
 * The second control. Under `latest-total-wins` the career remembers the last
 * total instead of the best, which is how a "current form" gate reads, and a
 * bad meet day then costs a lifter meets they had already qualified for.
 */
export const RECORD_VARIANTS: Readonly<
  Record<RecordVariant, (lifter: CareerLifter, meetId: string, totalKg: number) => CareerLifter>
> = Object.freeze({
  shipped: careerRecordAfterMeet,
  'latest-total-wins': (lifter, meetId, totalKg) => ({
    federationId: lifter.federationId,
    bestTotalKg: totalKg,
    enteredMeetIds: lifter.enteredMeetIds.includes(meetId)
      ? lifter.enteredMeetIds
      : [...lifter.enteredMeetIds, meetId],
  }),
});

// ---------------------------------------------------------------------------
// The simulated career the attendance axis compares
// ---------------------------------------------------------------------------

/** One meet in a simulated season: where it sat, and what was put up at it. */
export interface SeasonMeet {
  readonly day: StreakDay;
  readonly meetId: string;
  readonly totalKg: number;
}

/**
 * One season on the shipped calendar, as a fixture both arms of the attendance
 * axis are measured against.
 *
 * The schedule is greedy and simple: walk the days from the season anchor, and
 * on each day take the first meet the engine says can be entered, provided
 * `DAYS_BETWEEN_MEETS` have passed since the last. Entry is decided by
 * `canEnter` itself rather than by a rule restated here, so the fixture cannot
 * drift from the engine it is a fixture for.
 *
 * A season is a pure function of its seed, so both record variants measure
 * against exactly the same one. That is what isolates the axis: two lifters
 * compared on it differ in which meets of one fixed season they attended and in
 * nothing else — not in the dates, not in the totals, not in the calendar.
 */
export function simulateSeason(seed: number): readonly SeasonMeet[] {
  const totals = seededCareerTotals(seed, ATTENDANCE_SWEEP.MEETS_PER_CAREER);
  const anchor = seasonAnchorDay();
  const lastDay = addDays(anchor, ATTENDANCE_SWEEP.SIMULATION_DAYS);
  let lifter: CareerLifter = newCareerLifter(ATTENDANCE_SWEEP.FEDERATION);
  const season: SeasonMeet[] = [];
  let lastMeetDay: number | null = null;
  for (let day = anchor; day <= lastDay; day = addDays(day, 1)) {
    if (lastMeetDay !== null && day - lastMeetDay < ATTENDANCE_SWEEP.DAYS_BETWEEN_MEETS) continue;
    const meet = scheduledMeets(ATTENDANCE_SWEEP.FEDERATION, day, day).find((candidate) =>
      canEnter(lifter, candidate, day),
    );
    if (meet === undefined) continue;
    const totalKg = totals[season.length];
    if (totalKg === undefined) {
      throw new RangeError(
        `career: a season ran past MEETS_PER_CAREER (${ATTENDANCE_SWEEP.MEETS_PER_CAREER}) meets`,
      );
    }
    lifter = careerRecordAfterMeet(lifter, meet.id, totalKg);
    season.push({ day, meetId: meet.id, totalKg });
    lastMeetDay = day;
  }
  return season;
}

/**
 * The career record of a lifter who competed at the season's meets up to and
 * including `throughIndex`, skipping the one at `skipIndex`.
 *
 * `skipIndex` of `null` is the lifter who went to all of them. The pair
 * (`null`, `i`) is two lifters identical in every respect except that one
 * competed at one more meet, which is the comparison GDD §12.3 asks for.
 *
 * Both arms run this one function; `variant` picks the fold under test, and
 * nothing else about the two lifters can differ.
 */
export function careerAfter(
  season: readonly SeasonMeet[],
  throughIndex: number,
  skipIndex: number | null,
  variant: RecordVariant,
): CareerLifter {
  const fold = RECORD_VARIANTS[variant];
  let lifter: CareerLifter = newCareerLifter(ATTENDANCE_SWEEP.FEDERATION);
  for (let index = 0; index <= throughIndex; index += 1) {
    if (index === skipIndex) continue;
    const meet = season[index];
    if (meet === undefined) break;
    lifter = fold(lifter, meet.meetId, meet.totalKg);
  }
  return lifter;
}
