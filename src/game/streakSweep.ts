/**
 * streakSweep.ts — the calendars the streak monotonicity measurement runs on.
 *
 * PURE MODULE (CLAUDE.md "Pure logic is separate from UI"): zero React, zero
 * side effects, zero I/O, no clock, no `Math.random`. Every schedule this file
 * produces is a pure function of a seed that is written down below.
 *
 * ===========================================================================
 * WHY THIS IS A MODULE AND NOT A HELPER INSIDE `streak.test.ts`
 * ===========================================================================
 *
 * GDD §4.4 records a measurement — "training one more day never lowers your
 * streak" — as a count, and a count is only worth something if somebody else
 * can get the same one. The first version of that measurement was reported with
 * its seeds left unstated, and it could not be reproduced afterwards by anyone,
 * including the person who took it: the same sweep at six plausible
 * parameterisations returned six different numbers, none of them the published
 * one. Nothing was wrong with the code. The INPUTS had not been written down.
 *
 * So the inputs live here, in the repository, as named constants and a
 * deterministic generator, and `streak.test.ts` measures through them. A reader
 * who wants to re-derive any number in GDD §4.4 needs this file and the seeds
 * in it, and needs to ask nobody anything.
 *
 * It is registered in `src/tuning/audit.ts` as `data`, NOT as `feel`. None of
 * these numbers is a knob: turning a seed does not change the game, it changes
 * which calendars the property is checked on. They are deliberately not
 * re-exported from `src/tuning/index.ts` for the same reason.
 *
 * ===========================================================================
 * WHAT THE SWEEP IS
 * ===========================================================================
 *
 * A "schedule" is a calendar of consecutive days with a flag per day: did the
 * lifter train. The property under test compares a schedule against every
 * SINGLE-DAY SUPERSET of it — the same calendar with exactly one idle day
 * turned into a trained one — and asks whether the lifter who trained more ever
 * ends on a lower streak.
 *
 * Two generators, because they answer different questions:
 *
 *   - `exhaustiveCalendar` enumerates ALL 2^L calendars of a short length. It is
 *     a proof over that length rather than a sample, and it is the only kind of
 *     evidence that can say "there is no such pair". It stops being runnable
 *     somewhere around L = 17.
 *   - `seededSchedules` samples longer calendars — forty and sixty days, which
 *     is what a training block actually looks like — from written-down seeds.
 *     It cannot prove absence, and the counts it returns are pinned so that a
 *     change in them is visible.
 *
 * There are TWO parameter blocks below, and they answer different questions.
 * `MONOTONICITY_SWEEP` is the measurement of what the two no-free-absence rules
 * CLOSED; `RESIDUE_SWEEP` is the measurement of what they LEFT. They share the
 * seeds and the attendance distribution and differ only in which calendars and
 * which counterfactuals they run, so the second cannot quietly restate the
 * first on a friendlier population.
 *
 * ===========================================================================
 * THE ATTENDANCE DISTRIBUTION, AND WHY IT IS THIS ONE
 * ===========================================================================
 *
 * Each schedule draws ONE attendance rate, then applies it independently per
 * day (a Bernoulli process at that rate). The rate is uniform on
 *
 *     [MIN_ATTENDANCE, MIN_ATTENDANCE + ATTENDANCE_SPREAD]  =  [0.2, 0.9]
 *
 * PER SCHEDULE, NOT PER DAY, and that is the load-bearing half. Drawing the
 * rate once gives a population of lifters that differ from each other —
 * near-daily ones, weekend-only ones, ones who barely show up — where drawing
 * it per day would give 400 copies of one average lifter and would almost never
 * produce the long absences the property is actually about.
 *
 * The bounds are chosen against the mechanic rather than for realism:
 *
 *   - 0.2 is low enough that absences routinely outrun
 *     `LONGEST_REPAIRABLE_ABSENCE_DAYS`, so runs really die in this sweep. A
 *     sweep in which no run ever dies reports zero violations and proves
 *     nothing, which is why `streak.test.ts` asserts that dead runs were seen.
 *   - 0.9 rather than 1.0 because a schedule with no idle day has no single-day
 *     superset and contributes no comparison at all.
 *
 * IT IS NOT TUNED AND IT IS NOT CLAIMED TO BE OPTIMAL. It is claimed to be
 * WRITTEN DOWN. If a future measurement wants a different population, the
 * honest move is to change these constants and re-derive the counts in GDD
 * §4.4, not to sample differently at a call site.
 *
 * ===========================================================================
 * DETERMINISM
 * ===========================================================================
 *
 * The generator is `prng.ts`'s mulberry32 — the one seeded generator in the
 * codebase, already registered as published data — threaded explicitly, so a
 * seed fixes the whole schedule set. `streakSweep.test.ts` asserts that two
 * calls with the same seed are byte-identical and that different seeds differ.
 */

import { nextRandom, seedState } from './prng';

/**
 * THE VERIFICATION PARAMETERS. Everything the monotonicity measurement in
 * `streak.test.ts` depends on, in one place, so GDD §4.4's counts can be
 * re-derived from the repository alone.
 */
export const MONOTONICITY_SWEEP = Object.freeze({
  /**
   * Calendar lengths swept EXHAUSTIVELY — all 2^L of each, and every single-day
   * superset of every one.
   *
   * The range starts BELOW the length at which the defect used to first appear
   * (11), so the leading zeros are visible and the sweep cannot be read as
   * passing by starting above the interesting length. It stops at 16 because
   * 2^17 calendars times 17 flips is where the suite's time budget goes.
   */
  EXHAUSTIVE_LENGTHS: Object.freeze([8, 9, 10, 11, 12, 13, 14, 15, 16]),

  /**
   * Seeds for the sampled sweep. Arbitrary, fixed, and WRITTEN DOWN — which is
   * the entire point of them. Five rather than one so a clean result is not one
   * lucky draw.
   *
   * Hexadecimal because they are bit patterns fed to a 32-bit generator, not
   * quantities.
   */
  SEEDS: Object.freeze([0x5eed_1eaf, 0x09e2_31f5, 0x0000_0001, 0x00c0_ffee, 0xdead_beef]),

  /** Schedules drawn per seed. */
  SCHEDULES_PER_SEED: 400,

  /**
   * Calendar lengths for the sampled sweep. Forty is a training block; sixty is
   * long enough to reach the second streak milestone, which is where the
   * residue GDD §4.4 records lives.
   */
  SAMPLED_LENGTHS: Object.freeze([40, 60]),

  /** Lowest attendance rate a schedule can be drawn at. See the header. */
  MIN_ATTENDANCE: 0.2,

  /** Width of the attendance range above `MIN_ATTENDANCE`. See the header. */
  ATTENDANCE_SPREAD: 0.7,
});

/**
 * THE SECOND MEASUREMENT'S PARAMETERS: the one that characterises what is LEFT
 * after the two no-free-absence rules, rather than what they closed.
 *
 * SEPARATE FROM `MONOTONICITY_SWEEP` ON PURPOSE. Adding 80 and 100 to
 * `SAMPLED_LENGTHS` would silently change what GDD §4.4's published 40/60 table
 * means, and would make a table that is quoted in three places grow a column
 * every time somebody asks a new question. The seeds, the schedule count and
 * the attendance distribution are shared — this block only says *which further
 * calendars* and *which counterfactuals* the residue was characterised on.
 */
export const RESIDUE_SWEEP = Object.freeze({
  /**
   * Further calendar lengths, swept to answer "does the residue grow without
   * bound, or does it saturate?". A streak game is played for years, so a
   * defect whose rate climbs with the calendar is a different and worse thing
   * than one that plateaus, and the count at any single length cannot tell them
   * apart.
   *
   * 80 and 100 rather than 200 and 400 because these two cost about three
   * seconds in the suite and 400 costs fifteen. The longer lengths were
   * measured by hand off this same generator and are recorded in GDD §4.4 as
   * unpinned observations, which is the honest label for a number no test
   * re-derives.
   */
  LENGTHS: Object.freeze([80, 100]),

  /** The length the counterfactuals below are run at. */
  COUNTERFACTUAL_LENGTH: 60,

  /**
   * Calendar days on which the SCHEDULE-INDEPENDENT INCOME counterfactual drops
   * one Recovery Day.
   *
   * WHAT THIS EXISTS TO SEPARATE. The published counterfactual switched streak
   * milestone income OFF, and with it off there is no income at all in this
   * sweep after the signup grant — so it could only ever show that income is
   * *involved*. It could not tell "income whose ARRIVAL the schedule decides"
   * apart from "income at all". These days are fixed points on the calendar
   * that both members of a pair reach identically, so income exists, is the
   * same size, and arrives at a moment neither lifter's training can move.
   *
   * Two of them, mid and late, because a grant landing early has most of the
   * calendar to wash out in and a grant landing late does not — measured, the
   * two positions behave very differently, and one of them alone would have
   * been a misleading sample.
   */
  FIXED_INCOME_DAYS: Object.freeze([20, 40]),
});

/** One calendar: `true` on the days the lifter trained. */
export type TrainingSchedule = readonly boolean[];

/**
 * The `mask`-th calendar of `length` days: bit *i* set means "trained on day
 * *i*". Enumerating `mask` from 0 to 2^length - 1 is every calendar of that
 * length, each exactly once.
 *
 * @throws {RangeError} if the length is not a positive whole number, or the
 * mask is not a whole number inside it.
 */
export function exhaustiveCalendar(mask: number, length: number): TrainingSchedule {
  if (!Number.isSafeInteger(length) || length < 1) {
    throw new RangeError(`streakSweep: a calendar length must be a whole number of at least 1, received ${length}`);
  }
  if (!Number.isSafeInteger(mask) || mask < 0 || mask >= 2 ** length) {
    throw new RangeError(`streakSweep: mask ${mask} is not a calendar of ${length} days`);
  }
  return Array.from({ length }, (_, day) => (mask & (1 << day)) !== 0);
}

/** How many calendars `exhaustiveCalendar` enumerates at a length. */
export function exhaustiveCalendarCount(length: number): number {
  if (!Number.isSafeInteger(length) || length < 1) {
    throw new RangeError(`streakSweep: a calendar length must be a whole number of at least 1, received ${length}`);
  }
  return 2 ** length;
}

/**
 * The sampled schedules for one seed: `MONOTONICITY_SWEEP.SCHEDULES_PER_SEED`
 * calendars of `length` days, drawn as the header describes — one attendance
 * rate per schedule, then a Bernoulli draw per day.
 *
 * DETERMINISTIC. The same seed and length always return the same schedules, in
 * the same order, on any machine. `streakSweep.test.ts` checks that rather than
 * trusting it.
 *
 * @throws {RangeError} if the length is not a positive whole number.
 */
export function seededSchedules(seed: number, length: number): readonly TrainingSchedule[] {
  if (!Number.isSafeInteger(length) || length < 1) {
    throw new RangeError(`streakSweep: a calendar length must be a whole number of at least 1, received ${length}`);
  }
  const schedules: TrainingSchedule[] = [];
  let state = seedState(seed);
  for (let index = 0; index < MONOTONICITY_SWEEP.SCHEDULES_PER_SEED; index += 1) {
    const rate = nextRandom(state);
    state = rate.state;
    const attendance =
      MONOTONICITY_SWEEP.MIN_ATTENDANCE + rate.value * MONOTONICITY_SWEEP.ATTENDANCE_SPREAD;
    const days: boolean[] = [];
    for (let day = 0; day < length; day += 1) {
      const draw = nextRandom(state);
      state = draw.state;
      days.push(draw.value < attendance);
    }
    schedules.push(days);
  }
  return schedules;
}

/**
 * Every SINGLE-DAY SUPERSET of a schedule: the same calendar with exactly one
 * idle day turned into a trained one, once per idle day.
 *
 * This is the comparator the whole property is defined against. A schedule with
 * no idle day has none, and contributes no comparison.
 */
export function singleDaySupersets(schedule: TrainingSchedule): readonly TrainingSchedule[] {
  const out: TrainingSchedule[] = [];
  for (let day = 0; day < schedule.length; day += 1) {
    if (schedule[day] === true) continue;
    out.push(schedule.map((trained, i) => (i === day ? true : trained)));
  }
  return out;
}

/** `T` trained, `.` idle — so a failing calendar names itself in the error. */
export function renderSchedule(schedule: TrainingSchedule): string {
  return schedule.map((trained) => (trained ? 'T' : '.')).join('');
}

/** Days trained in a schedule. */
export function trainedDayCount(schedule: TrainingSchedule): number {
  return schedule.filter((trained) => trained).length;
}
