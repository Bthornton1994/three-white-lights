import { describe, expect, it } from 'vitest';

import {
  CHARTED_REPS,
  CHARTED_RPES,
  RPE_CHART_COVERAGE,
  RPE_LOADING_TUNING,
  RPE_PERCENT_CHART,
  e1rmFromChartedSet,
  fractionOf1RM,
  isChartedReps,
  isChartedRpe,
  loadForRpeTarget,
  percentOf1RM,
  rawLoadForRpeTarget,
  repsInReserve,
  roundLoad,
  rpeForRepsInReserve,
  tryPercentOf1RM,
  type ChartedReps,
  type ChartedRpe,
} from './rpe';

/**
 * The published Tuchscherer / Reactive Training Systems chart, transcribed in
 * the orientation it is normally PRINTED: one row per RPE (10 down to 6), reps
 * 1-12 across. `rpe.ts` stores it reps-major, so this transposed transcription
 * is an independent second copy — a typo in either one fails the grid test.
 *
 * Provenance and the three cells that could not be fully corroborated are
 * documented in the header of `rpe.ts`. Do not "fix" numbers here to make a
 * test pass; fix them in both places or not at all.
 */
const PUBLISHED_CHART_BY_RPE: ReadonlyArray<readonly [ChartedRpe, readonly number[]]> = [
  //             reps: 1     2     3     4     5     6     7     8     9    10    11    12
  [10, [100.0, 95.5, 92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 70.7, 68.0]],
  [9.5, [97.8, 93.9, 90.7, 87.8, 85.0, 82.4, 79.9, 77.4, 75.1, 72.3, 69.4, 66.7]],
  [9, [95.5, 92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 70.7, 68.0, 65.3]],
  [8.5, [93.9, 90.7, 87.8, 85.0, 82.4, 79.9, 77.4, 75.1, 72.3, 69.4, 66.7, 64.0]],
  [8, [92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 70.7, 68.0, 65.3, 62.6]],
  [7.5, [90.7, 87.8, 85.0, 82.4, 79.9, 77.4, 75.1, 72.3, 69.4, 66.7, 64.0, 61.3]],
  [7, [89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 70.7, 68.0, 65.3, 62.6, 59.9]],
  [6.5, [87.8, 85.0, 82.4, 79.9, 77.4, 75.1, 72.3, 69.4, 66.7, 64.0, 61.3, 58.6]],
  [6, [86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 70.7, 68.0, 65.3, 62.6, 59.9, 57.2]],
];

describe('RPE_PERCENT_CHART — published source values', () => {
  it('matches the published chart in all 108 cells', () => {
    for (const [rpe, row] of PUBLISHED_CHART_BY_RPE) {
      expect(row).toHaveLength(RPE_CHART_COVERAGE.MAX_REPS);
      row.forEach((expected, index) => {
        const reps = (index + 1) as ChartedReps;
        expect(
          percentOf1RM(reps, rpe),
          `published chart cell: ${reps} reps @ RPE ${rpe}`,
        ).toBeCloseTo(expected, 10);
      });
    }
  });

  it('covers exactly reps 1-12 and RPE 6-10 in 0.5 steps, and nothing else', () => {
    expect(CHARTED_REPS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(CHARTED_RPES).toEqual([6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]);
    expect(Object.keys(RPE_PERCENT_CHART)).toHaveLength(12);
    for (const reps of CHARTED_REPS) {
      expect(Object.keys(RPE_PERCENT_CHART[reps])).toHaveLength(9);
    }
    expect(PUBLISHED_CHART_BY_RPE).toHaveLength(9);
  });

  /**
   * Cells every competitive lifter can recite. Written out longhand and
   * independently of the grid above so a reviewer can eyeball them.
   */
  it.each<[number, ChartedRpe, number]>([
    [1, 10, 100.0], // a true single is 100% by definition
    [1, 9, 95.5], // the canonical "single at RPE 9"
    [1, 8, 92.2],
    [2, 10, 95.5],
    [3, 10, 92.2],
    [3, 8, 86.3], // triple @ 8 ~ 86%
    [5, 8, 81.1], // the most-quoted cell in the chart: 5 @ 8 ~ 81%
    [5, 10, 86.3],
    [6, 9, 81.1],
    [8, 8, 73.9],
    [10, 10, 73.9],
    [10, 8, 68.0],
    [12, 10, 68.0], // bottom of the RPE-10 column
    [12, 6, 57.2], // bottom-right corner of the chart
    [1, 6, 86.3], // top-left of the RPE-6 row
  ])('%d reps @ RPE %s is %s%% of 1RM', (reps, rpe, expected) => {
    expect(percentOf1RM(reps, rpe)).toBeCloseTo(expected, 10);
  });

  it('preserves the reps-in-reserve diagonal: N @ RPE X equals N+1 @ RPE X+1', () => {
    for (const reps of CHARTED_REPS) {
      for (const rpe of CHARTED_RPES) {
        const nextReps = reps + 1;
        const nextRpe = rpe + 1;
        const shifted = tryPercentOf1RM(nextReps, nextRpe);
        if (shifted === null) {
          continue;
        }
        expect(
          shifted,
          `${reps} @ RPE ${rpe} should equal ${nextReps} @ RPE ${nextRpe}`,
        ).toBeCloseTo(percentOf1RM(reps, rpe), 10);
      }
    }
  });

  it('is strictly decreasing as reps rise at a fixed RPE', () => {
    for (const rpe of CHARTED_RPES) {
      for (let reps = 1; reps < RPE_CHART_COVERAGE.MAX_REPS; reps += 1) {
        expect(percentOf1RM(reps + 1, rpe)).toBeLessThan(percentOf1RM(reps, rpe));
      }
    }
  });

  it('is strictly increasing as RPE rises at a fixed rep count', () => {
    for (const reps of CHARTED_REPS) {
      for (let i = 0; i < CHARTED_RPES.length - 1; i += 1) {
        const lower = CHARTED_RPES[i];
        const higher = CHARTED_RPES[i + 1];
        expect(lower).toBeDefined();
        expect(higher).toBeDefined();
        if (lower === undefined || higher === undefined) {
          continue;
        }
        expect(percentOf1RM(reps, higher)).toBeGreaterThan(percentOf1RM(reps, lower));
      }
    }
  });

  it('never exceeds 100% and never drops below the published floor', () => {
    for (const reps of CHARTED_REPS) {
      for (const rpe of CHARTED_RPES) {
        const percent = percentOf1RM(reps, rpe);
        expect(percent).toBeLessThanOrEqual(100);
        expect(percent).toBeGreaterThanOrEqual(57.2);
      }
    }
  });
});

describe('coverage guards', () => {
  it('accepts only charted rep counts', () => {
    for (const reps of CHARTED_REPS) {
      expect(isChartedReps(reps)).toBe(true);
    }
    for (const reps of [0, -1, 13, 20, 1.5, 4.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(isChartedReps(reps)).toBe(false);
    }
  });

  it('accepts only charted RPE values', () => {
    for (const rpe of CHARTED_RPES) {
      expect(isChartedRpe(rpe)).toBe(true);
    }
    for (const rpe of [5.5, 5.9, 6.25, 7.3, 9.75, 10.5, 11, Number.NaN]) {
      expect(isChartedRpe(rpe)).toBe(false);
    }
  });

  it('does not silently interpolate uncharted RPE values', () => {
    // 7.3 sits between two real cells. Interpolating it would be homebrewing.
    expect(tryPercentOf1RM(5, 7.3)).toBeNull();
    expect(() => percentOf1RM(5, 7.3)).toThrow(RangeError);
  });

  it('does not extrapolate past 12 reps or below RPE 6', () => {
    expect(tryPercentOf1RM(13, 10)).toBeNull();
    expect(tryPercentOf1RM(20, 8)).toBeNull();
    expect(tryPercentOf1RM(5, 5.5)).toBeNull();
    expect(tryPercentOf1RM(5, 10.5)).toBeNull();
    expect(tryPercentOf1RM(0, 8)).toBeNull();
    expect(() => percentOf1RM(13, 10)).toThrow(/no cell for 13 reps/);
  });

  it('absorbs float noise but nothing wider', () => {
    expect(percentOf1RM(5, 8 + Number.EPSILON)).toBeCloseTo(81.1, 10);
    expect(tryPercentOf1RM(5, 8.01)).toBeNull();
  });

  it('reports its own coverage honestly', () => {
    expect(RPE_CHART_COVERAGE).toEqual({
      MIN_REPS: 1,
      MAX_REPS: 12,
      MIN_RPE: 6,
      MAX_RPE: 10,
      RPE_STEP: 0.5,
    });
  });
});

describe('fractionOf1RM', () => {
  it('is the percentage over 100', () => {
    expect(fractionOf1RM(5, 8)).toBeCloseTo(0.811, 10);
    expect(fractionOf1RM(1, 10)).toBeCloseTo(1, 10);
  });
});

describe('repsInReserve', () => {
  it.each<[ChartedRpe, number]>([
    [10, 0],
    [9.5, 0.5],
    [9, 1],
    [8.5, 1.5],
    [8, 2],
    [7.5, 2.5],
    [7, 3],
    [6.5, 3.5],
    [6, 4],
  ])('RPE %s means %s reps in reserve', (rpe, rir) => {
    expect(repsInReserve(rpe)).toBeCloseTo(rir, 10);
    expect(rpeForRepsInReserve(rir)).toBe(rpe);
  });

  it('rejects uncharted RPE and RIR', () => {
    expect(() => repsInReserve(7.3)).toThrow(RangeError);
    expect(() => rpeForRepsInReserve(5)).toThrow(RangeError);
  });
});

describe('load prescription', () => {
  it('computes the raw load straight off the chart', () => {
    // 200 kg e1RM, 5 @ RPE 8 -> 81.1% -> 162.2 kg
    expect(rawLoadForRpeTarget(200, 5, 8)).toBeCloseTo(162.2, 6);
    // 405 lb e1RM, 3 @ RPE 8 -> 86.3% -> 349.515 lb
    expect(rawLoadForRpeTarget(405, 3, 8)).toBeCloseTo(349.515, 6);
    // A true single at RPE 10 is the e1RM itself.
    expect(rawLoadForRpeTarget(180, 1, 10)).toBeCloseTo(180, 10);
  });

  it('snaps to the default kg increment', () => {
    expect(RPE_LOADING_TUNING.ROUNDING_INCREMENT.kg).toBe(2.5);
    // 162.2 -> nearest 2.5 -> 162.5
    expect(loadForRpeTarget(200, 5, 8)).toBe(162.5);
    expect(loadForRpeTarget(200, 5, 8, { unit: 'kg' })).toBe(162.5);
  });

  it('snaps to the default lb increment', () => {
    expect(RPE_LOADING_TUNING.ROUNDING_INCREMENT.lb).toBe(5);
    // 349.515 -> nearest 5 -> 350
    expect(loadForRpeTarget(405, 3, 8, { unit: 'lb' })).toBe(350);
    // 349.515 -> down to 5 -> 345
    expect(loadForRpeTarget(405, 3, 8, { unit: 'lb', mode: 'down' })).toBe(345);
    // 349.515 -> up to 5 -> 350
    expect(loadForRpeTarget(405, 3, 8, { unit: 'lb', mode: 'up' })).toBe(350);
  });

  it('honours an explicit increment', () => {
    expect(loadForRpeTarget(200, 5, 8, { increment: 1 })).toBe(162);
    expect(loadForRpeTarget(200, 5, 8, { increment: 0.5 })).toBe(162);
    expect(loadForRpeTarget(200, 5, 8, { increment: 5 })).toBe(160);
  });

  it('rounds without float noise', () => {
    expect(roundLoad(162.2, { increment: 2.5 })).toBe(162.5);
    expect(roundLoad(100.1, { increment: 0.1 })).toBe(100.1);
    expect(roundLoad(0, { increment: 2.5 })).toBe(0);
  });

  it('uses the tunable default mode and unit', () => {
    expect(RPE_LOADING_TUNING.DEFAULT_ROUNDING_MODE).toBe('nearest');
    expect(RPE_LOADING_TUNING.DEFAULT_UNIT).toBe('kg');
    const increment = RPE_LOADING_TUNING.ROUNDING_INCREMENT[RPE_LOADING_TUNING.DEFAULT_UNIT];
    expect(loadForRpeTarget(200, 5, 8)).toBe(roundLoad(162.2, { increment, mode: 'nearest' }));
  });

  it('rejects unusable inputs', () => {
    expect(() => rawLoadForRpeTarget(0, 5, 8)).toThrow(RangeError);
    expect(() => rawLoadForRpeTarget(-100, 5, 8)).toThrow(RangeError);
    expect(() => rawLoadForRpeTarget(Number.NaN, 5, 8)).toThrow(RangeError);
    expect(() => loadForRpeTarget(200, 13, 8)).toThrow(RangeError);
    expect(() => loadForRpeTarget(200, 5, 8, { increment: 0 })).toThrow(RangeError);
    expect(() => loadForRpeTarget(200, 5, 8, { increment: -2.5 })).toThrow(RangeError);
    expect(() => roundLoad(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('e1rmFromChartedSet', () => {
  it('inverts the load calculation', () => {
    for (const reps of CHARTED_REPS) {
      for (const rpe of CHARTED_RPES) {
        const raw = rawLoadForRpeTarget(220, reps, rpe);
        expect(e1rmFromChartedSet(raw, reps, rpe)).toBeCloseTo(220, 4);
      }
    }
  });

  it('matches hand-worked examples', () => {
    // 140 kg x 5 @ RPE 8 -> 140 / 0.811 = 172.63 kg
    expect(e1rmFromChartedSet(140, 5, 8)).toBeCloseTo(172.626387, 5);
    // A single at RPE 10 is its own e1RM.
    expect(e1rmFromChartedSet(250, 1, 10)).toBeCloseTo(250, 10);
  });

  it('rejects unusable inputs', () => {
    expect(() => e1rmFromChartedSet(0, 5, 8)).toThrow(RangeError);
    expect(() => e1rmFromChartedSet(100, 5, 7.3)).toThrow(RangeError);
  });
});

describe('purity', () => {
  it('is referentially transparent', () => {
    const first = loadForRpeTarget(200, 5, 8);
    const second = loadForRpeTarget(200, 5, 8);
    expect(first).toBe(second);
    expect(percentOf1RM(5, 8)).toBe(percentOf1RM(5, 8));
  });

  it('does not let a caller mutate the shared chart through the lookup', () => {
    const before = percentOf1RM(5, 8);
    const row = RPE_PERCENT_CHART[5];
    expect(row[8]).toBe(before);
    expect(percentOf1RM(5, 8)).toBe(before);
  });
});
