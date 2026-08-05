import { describe, expect, it } from 'vitest';

import {
  MONOTONICITY_SWEEP,
  exhaustiveCalendar,
  exhaustiveCalendarCount,
  renderSchedule,
  seededSchedules,
  singleDaySupersets,
  trainedDayCount,
  type TrainingSchedule,
} from './streakSweep';

// ---------------------------------------------------------------------------
// The fixture exists so a number in GDD §4.4 can be re-derived from the
// repository. These tests are what makes that claim true rather than stated.
// ---------------------------------------------------------------------------

describe('the sweep is deterministic, which is the whole reason it is a fixture', () => {
  it('returns byte-identical schedules for the same seed, every time', () => {
    for (const seed of MONOTONICITY_SWEEP.SEEDS) {
      const first = seededSchedules(seed, MONOTONICITY_SWEEP.SAMPLED_LENGTHS[0] as number);
      const second = seededSchedules(seed, MONOTONICITY_SWEEP.SAMPLED_LENGTHS[0] as number);
      expect(second).toEqual(first);
    }
  });

  it('returns DIFFERENT schedules for different seeds', () => {
    // Without this the determinism check above would pass on a generator that
    // ignored its seed entirely, which is the one bug that would make every
    // count in GDD §4.4 a measurement of one calendar set repeated five times.
    const rendered = MONOTONICITY_SWEEP.SEEDS.map((seed) =>
      seededSchedules(seed, MONOTONICITY_SWEEP.SAMPLED_LENGTHS[0] as number)
        .map(renderSchedule)
        .join('|'),
    );
    expect(new Set(rendered).size).toBe(MONOTONICITY_SWEEP.SEEDS.length);
  });

  it('draws the promised number of schedules, at the promised length', () => {
    for (const length of MONOTONICITY_SWEEP.SAMPLED_LENGTHS) {
      const schedules = seededSchedules(MONOTONICITY_SWEEP.SEEDS[0] as number, length);
      expect(schedules.length).toBe(MONOTONICITY_SWEEP.SCHEDULES_PER_SEED);
      for (const schedule of schedules) expect(schedule.length).toBe(length);
    }
  });

  it('refuses a length that is not a whole number of days', () => {
    expect(() => seededSchedules(1, 0)).toThrow(RangeError);
    expect(() => seededSchedules(1, 2.5)).toThrow(RangeError);
    expect(() => exhaustiveCalendar(0, -1)).toThrow(RangeError);
    expect(() => exhaustiveCalendarCount(0)).toThrow(RangeError);
  });
});

describe('the attendance distribution reaches the population the property is about', () => {
  // THE ANTI-VACUITY CHECKS FOR THE FIXTURE ITSELF. A sweep of near-daily
  // lifters cannot contain a broken streak, so it cannot contain a violation of
  // "training one more day never costs you", so it would report zero and prove
  // nothing. These assert the generator actually produces the shapes the
  // measurement needs — separately from whether the engine passes on them.
  const LONG_ENOUGH_TO_KILL_A_RUN = 5;

  /** Trained-day density below which a schedule is a barely-there lifter. */
  const SPARSE_LIFTER = 0.3;
  /** ...and above which it is a near-daily one. */
  const DILIGENT_LIFTER = 0.8;
  /**
   * How much of the population has to sit in each tail. Measured at 14% and 12%
   * for the shipped generator; 8% is well under that and far above the 0.0% /
   * 0.1% a per-day draw produces, so it separates the two designs with room on
   * both sides rather than sitting on the boundary.
   */
  const MIN_TAIL_FRACTION = 0.08;
  /**
   * Standard deviation of the density population. Measured at 0.212 for the
   * shipped generator against 0.077 for a per-day draw; 0.15 is between them
   * and near neither.
   */
  const MIN_DENSITY_SPREAD = 0.15;

  const allSchedules = (): readonly TrainingSchedule[] =>
    MONOTONICITY_SWEEP.SEEDS.flatMap((seed) =>
      seededSchedules(seed, MONOTONICITY_SWEEP.SAMPLED_LENGTHS[0] as number),
    );

  it('draws the rate ONCE PER SCHEDULE, so the population has tails and not just a mean', () => {
    // THE ONE PROPERTY OF THE DISTRIBUTION THAT MATTERS, and it needs a
    // statistic that can tell the two designs apart. Drawing the rate once per
    // schedule gives densities spread roughly uniformly over [0.2, 0.9];
    // drawing it per day instead collapses to a Bernoulli at the range's mean
    // and gives a narrow binomial around 0.55.
    //
    // MIN AND MAX CANNOT TELL THEM APART — measured, which is why this test
    // does not use them. Over 2000 schedules the per-day version still spans
    // 0.33 to 0.83, which passes any "is the spread wide" check. What separates
    // them is the TAILS: per-schedule puts 14% of lifters below 0.3 and 12%
    // above 0.8; per-day puts 0.0% and 0.1% there.
    const length = MONOTONICITY_SWEEP.SAMPLED_LENGTHS[0] as number;
    const densities = allSchedules().map((s) => trainedDayCount(s) / length);
    const fractionBelow = densities.filter((d) => d < SPARSE_LIFTER).length / densities.length;
    const fractionAbove = densities.filter((d) => d > DILIGENT_LIFTER).length / densities.length;
    expect(fractionBelow).toBeGreaterThan(MIN_TAIL_FRACTION);
    expect(fractionAbove).toBeGreaterThan(MIN_TAIL_FRACTION);

    // ...and the spread is the uniform's, not a binomial's. Standard deviation
    // of a uniform on a width-0.7 range is ~0.202; of the per-day collapse,
    // ~0.077.
    const mean = densities.reduce((sum, d) => sum + d, 0) / densities.length;
    const sd = Math.sqrt(
      densities.reduce((sum, d) => sum + (d - mean) ** 2, 0) / densities.length,
    );
    expect(sd).toBeGreaterThan(MIN_DENSITY_SPREAD);
  });

  it('contains absences long enough to end a run', () => {
    const longest = (schedule: TrainingSchedule): number => {
      let run = 0;
      let best = 0;
      for (const trained of schedule) {
        run = trained ? 0 : run + 1;
        best = Math.max(best, run);
      }
      return best;
    };
    const withLongAbsence = allSchedules().filter((s) => longest(s) >= LONG_ENOUGH_TO_KILL_A_RUN);
    expect(withLongAbsence.length).toBeGreaterThan(0);
  });

  it('leaves every schedule with at least one idle day to flip', () => {
    // A schedule trained on every day has no single-day superset and would be
    // swept for nothing. The 0.9 ceiling on the attendance range exists to make
    // that vanishingly unlikely; this checks it actually did.
    const length = MONOTONICITY_SWEEP.SAMPLED_LENGTHS[0] as number;
    for (const schedule of allSchedules()) {
      expect(singleDaySupersets(schedule).length).toBe(length - trainedDayCount(schedule));
      expect(singleDaySupersets(schedule).length).toBeGreaterThan(0);
    }
  });
});

describe('the comparator is exactly "one more trained day, nothing else"', () => {
  it('produces one superset per idle day, each differing in exactly that day', () => {
    const schedule = [true, false, false, true, false];
    const supersets = singleDaySupersets(schedule);
    expect(supersets.length).toBe(3);
    for (const superset of supersets) {
      expect(trainedDayCount(superset)).toBe(trainedDayCount(schedule) + 1);
      const differing = superset.filter((trained, i) => trained !== schedule[i]);
      expect(differing).toEqual([true]);
    }
    // Spelled out, in order, so the comparator is readable rather than inferred.
    expect(renderSchedule(schedule)).toBe('T..T.');
    expect(supersets.map(renderSchedule)).toEqual(['TT.T.', 'T.TT.', 'T..TT']);
  });

  it('produces nothing for a schedule with no idle day', () => {
    expect(singleDaySupersets([true, true, true])).toEqual([]);
  });
});

describe('the exhaustive enumeration is every calendar of a length, once', () => {
  it('enumerates 2^L distinct calendars', () => {
    const LENGTH = 10;
    expect(exhaustiveCalendarCount(LENGTH)).toBe(1024);
    const seen = new Set<string>();
    for (let mask = 0; mask < exhaustiveCalendarCount(LENGTH); mask += 1) {
      seen.add(renderSchedule(exhaustiveCalendar(mask, LENGTH)));
    }
    expect(seen.size).toBe(exhaustiveCalendarCount(LENGTH));
  });

  it('puts bit i on day i, so a failing mask can be read back', () => {
    expect(renderSchedule(exhaustiveCalendar(0b0000_0101, 8))).toBe('T.T.....');
    expect(renderSchedule(exhaustiveCalendar(0, 4))).toBe('....');
    expect(renderSchedule(exhaustiveCalendar(0b1111, 4))).toBe('TTTT');
  });

  it('refuses a mask that is not a calendar of that length', () => {
    expect(() => exhaustiveCalendar(16, 4)).toThrow(RangeError);
    expect(() => exhaustiveCalendar(-1, 4)).toThrow(RangeError);
    expect(() => exhaustiveCalendar(1.5, 4)).toThrow(RangeError);
  });
});

describe('the parameters themselves', () => {
  it('sweeps below the length the defect used to first appear at', () => {
    // If the exhaustive range started at 12 the zeros would be a statement
    // about lengths nothing was ever wrong at.
    expect(Math.min(...MONOTONICITY_SWEEP.EXHAUSTIVE_LENGTHS)).toBeLessThan(11);
    expect(Math.max(...MONOTONICITY_SWEEP.EXHAUSTIVE_LENGTHS)).toBeGreaterThan(14);
  });

  it('keeps the attendance range inside (0, 1) with room at both ends', () => {
    expect(MONOTONICITY_SWEEP.MIN_ATTENDANCE).toBeGreaterThan(0);
    expect(MONOTONICITY_SWEEP.MIN_ATTENDANCE + MONOTONICITY_SWEEP.ATTENDANCE_SPREAD).toBeLessThan(1);
  });

  it('uses five distinct seeds, so a clean result is not one lucky draw', () => {
    expect(new Set(MONOTONICITY_SWEEP.SEEDS).size).toBe(MONOTONICITY_SWEEP.SEEDS.length);
    expect(MONOTONICITY_SWEEP.SEEDS.length).toBeGreaterThan(1);
  });

  it('is frozen, so a test cannot quietly re-parameterise the measurement', () => {
    expect(Object.isFrozen(MONOTONICITY_SWEEP)).toBe(true);
    expect(Object.isFrozen(MONOTONICITY_SWEEP.SEEDS)).toBe(true);
    expect(Object.isFrozen(MONOTONICITY_SWEEP.EXHAUSTIVE_LENGTHS)).toBe(true);
  });
});
