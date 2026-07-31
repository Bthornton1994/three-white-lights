import { describe, expect, it } from 'vitest';

import {
  CHART_MAX_REP_MAX,
  E1RM_DOMAIN,
  E1RM_FORMULA,
  E1RM_METHOD_LABEL,
  E1RM_REP_MAX_FORMULA_NAME,
  TO_FAILURE_RPE,
  brzyckiE1rm,
  effectiveRepMax,
  epleyE1rm,
  estimateE1rm,
  explainE1rm,
  isHighConfidenceRepMax,
  tryEstimateE1rm,
  tryExplainE1rm,
  type CompletedSet,
} from './e1rm';
import {
  CHARTED_REPS,
  CHARTED_RPES,
  RPE_CHART_COVERAGE,
  e1rmFromChartedSet,
  fractionOf1RM,
  loadForRpeTarget,
  percentOf1RM,
  rawLoadForRpeTarget,
} from './rpe';

/**
 * Expectations here are written from published source values, never by
 * re-running the implementation. Two forms are used:
 *
 *   1. Hand-computed decimal literals, for the headline cases.
 *   2. Arithmetic written directly from a published number — e.g.
 *      `200 / 0.892` for the chart cell "1 rep @ RPE 7 = 89.2%", or
 *      `100 * (1 + 5 / 30)` for Epley. The published literal is visible in the
 *      expectation, so the test still fails if the implementation drifts.
 *
 * Published sources in play:
 *   Epley:   e1RM = w * (1 + r / 30)
 *   Brzycki: e1RM = w * 36 / (37 - r)
 *   Tuchscherer / RTS RPE chart: transcribed and sourced in `rpe.ts`.
 */

/** Float comparison precision: |actual - expected| < 5e-10. */
const PRECISION = 9;

/** Looser precision where a value has passed through rpe.ts's 6-dp scrub. */
const SCRUBBED_PRECISION = 5;

/**
 * How far the exact rational forms may sit from the widely-published
 * 4-significant-figure decimal forms, as a fraction of the estimate. These are
 * tolerances on *the published rounding*, not on our math: 0.0333 is short of
 * 1/30 by 3.3e-5 and 0.0278 is short of 1/36 by 2.2e-6, and that shortfall is
 * multiplied by the rep count, so the two forms drift further apart the higher
 * the reps go.
 */
const DECIMAL_ROUNDING_TOLERANCE = 0.002; // 0.2% across 1-24 reps

/** Largest reps in reserve the published chart expresses (RPE 6 => 4 RIR). */
const MAX_CHARTED_RIR = RPE_CHART_COVERAGE.MAX_RPE - RPE_CHART_COVERAGE.MIN_RPE;

function relativeDifference(actual: number, expected: number): number {
  return Math.abs(actual - expected) / expected;
}

/**
 * Smallest set that expresses a given effective rep max, used to walk the
 * canonical curve. Mirrors the reps-in-reserve identity, not the
 * implementation's internal cell picker.
 */
function setForRepMax(weight: number, repMax: number): CompletedSet {
  const reps = Math.min(E1RM_DOMAIN.MAX_REPS, Math.floor(repMax));
  return { weight, reps, rpe: TO_FAILURE_RPE - (repMax - reps) };
}

/** Every supported effective rep max, in the chart's half-rep steps. */
function everyRepMax(): number[] {
  const out: number[] = [];
  for (let doubled = E1RM_DOMAIN.MIN_REPS * 2; doubled <= E1RM_DOMAIN.MAX_REP_MAX * 2; doubled += 1) {
    out.push(doubled / 2);
  }
  return out;
}

// ===========================================================================
// Constants
// ===========================================================================

describe('published formula constants', () => {
  it('holds the Epley divisor of 30', () => {
    expect(E1RM_FORMULA.EPLEY_REP_DIVISOR).toBe(30);
  });

  it('holds the Brzycki 36 / (37 - r) pair', () => {
    expect(E1RM_FORMULA.BRZYCKI_NUMERATOR).toBe(36);
    expect(E1RM_FORMULA.BRZYCKI_REP_OFFSET).toBe(37);
  });

  it('names Brzycki as the one rep-max formula in player-facing use', () => {
    expect(E1RM_REP_MAX_FORMULA_NAME).toBe('Brzycki');
    expect(E1RM_METHOD_LABEL.brzycki).toBe('Brzycki');
    expect(E1RM_METHOD_LABEL['rpe-chart']).toBe('RPE chart');
  });
});

describe('domain constants', () => {
  it('takes "to failure" from the chart rather than restating it', () => {
    expect(TO_FAILURE_RPE).toBe(RPE_CHART_COVERAGE.MAX_RPE);
    expect(TO_FAILURE_RPE).toBe(10);
  });

  it('derives the chart ceiling as 12 reps @ RPE 6 = a 16 rep max', () => {
    expect(CHART_MAX_REP_MAX).toBe(16);
    expect(CHART_MAX_REP_MAX).toBe(RPE_CHART_COVERAGE.MAX_REPS + MAX_CHARTED_RIR);
  });

  it('keeps every supported rep max well below the Brzycki pole at 37', () => {
    expect(E1RM_DOMAIN.MAX_REP_MAX).toBeLessThan(E1RM_FORMULA.BRZYCKI_REP_OFFSET);
    expect(E1RM_DOMAIN.MIN_REPS).toBe(1);
  });

  it('sets the rep-max ceiling high enough that the reps guard is the binding one', () => {
    // While this holds, any set with reps <= MAX_REPS is accepted whatever its
    // RPE, and the rep-max ceiling in describeSetProblem is a guard against a
    // future retune rather than a live rejection path.
    expect(E1RM_DOMAIN.MAX_REP_MAX).toBeGreaterThanOrEqual(
      E1RM_DOMAIN.MAX_REPS + MAX_CHARTED_RIR,
    );
  });

  it('keeps the high-confidence bound inside the supported domain', () => {
    expect(E1RM_DOMAIN.HIGH_CONFIDENCE_MAX_REP_MAX).toBeLessThanOrEqual(E1RM_DOMAIN.MAX_REP_MAX);
    expect(E1RM_DOMAIN.HIGH_CONFIDENCE_MAX_REP_MAX).toBeGreaterThanOrEqual(E1RM_DOMAIN.MIN_REPS);
  });
});

// ===========================================================================
// The raw published formulas
// ===========================================================================

describe('epleyE1rm', () => {
  // w = 100, so each expected value is literally 100 * (1 + r / 30).
  const publishedAt100: ReadonlyArray<readonly [repMax: number, expected: number]> = [
    [1, 103.333333333333333],
    [2, 106.666666666666667],
    [3, 110],
    [4, 113.333333333333333],
    [5, 116.666666666666667],
    [6, 120],
    [7, 123.333333333333333],
    [8, 126.666666666666667],
    [9, 130],
    [10, 133.333333333333333],
    [15, 150],
    [20, 166.666666666666667],
    [24, 180],
  ];

  it.each(publishedAt100)('100 x %f rep max -> %f', (repMax, expected) => {
    expect(epleyE1rm(100, repMax)).toBeCloseTo(expected, PRECISION);
  });

  it('is the raw published curve at 1 rep, with no clamp to the weight lifted', () => {
    // Deliberate change from an earlier revision, which clamped this to `w`.
    // Epley is a rep-max formula and is simply not exact at r = 1; pretending
    // otherwise made a lower bound look like a point estimate. Singles are
    // handled by the chart instead (see "singles" below), so nothing
    // player-facing depends on this value.
    expect(epleyE1rm(200, 1)).toBeCloseTo(200 * (1 + 1 / 30), PRECISION);
    expect(epleyE1rm(200, 1)).toBeCloseTo(206.666666666666667, PRECISION);
    expect(epleyE1rm(200, 1)).not.toBe(200);
  });

  it('matches hand-computed values at realistic gym loads', () => {
    expect(epleyE1rm(140, 5)).toBeCloseTo(163.333333333333333, PRECISION); // 140 * 7/6
    expect(epleyE1rm(102.5, 3)).toBeCloseTo(112.75, PRECISION); // 102.5 * 1.1
    expect(epleyE1rm(225, 8)).toBeCloseTo(285, PRECISION); // 225 * 19/15
    expect(epleyE1rm(60, 2)).toBeCloseTo(64, PRECISION); // 60 * 16/15
  });

  it('accepts the half-rep maxima the chart’s half-RPE steps produce', () => {
    expect(epleyE1rm(100, 4.5)).toBeCloseTo(115, PRECISION); // 100 * (1 + 4.5/30)
    expect(epleyE1rm(100, 16.5)).toBeCloseTo(155, PRECISION);
  });

  it('matches the published decimal-rounded form w * (1 + 0.0333 * r)', () => {
    for (const repMax of everyRepMax()) {
      const publishedDecimal = 100 * (1 + 0.0333 * repMax);
      expect(relativeDifference(epleyE1rm(100, repMax), publishedDecimal)).toBeLessThan(
        DECIMAL_ROUNDING_TOLERANCE,
      );
    }
  });
});

describe('brzyckiE1rm', () => {
  // w = 100, so each expected value is literally 3600 / (37 - r).
  const publishedAt100: ReadonlyArray<readonly [repMax: number, expected: number]> = [
    [1, 100],
    [2, 102.857142857142857],
    [3, 105.882352941176471],
    [4, 109.090909090909091],
    [5, 112.5],
    [6, 116.129032258064516],
    [7, 120],
    [8, 124.137931034482759],
    [9, 128.571428571428571],
    [10, 133.333333333333333],
    [15, 163.636363636363636],
    [20, 211.764705882352941],
    [24, 276.923076923076923],
  ];

  it.each(publishedAt100)('100 x %f rep max -> %f', (repMax, expected) => {
    expect(brzyckiE1rm(100, repMax)).toBeCloseTo(expected, PRECISION);
  });

  it('returns the weight itself at a 1 rep max as a natural property', () => {
    // 36 / (37 - 1) = 1. No special case in the implementation.
    for (const weight of [60, 100, 102.5, 227.5, 400.5]) {
      expect(brzyckiE1rm(weight, 1)).toBeCloseTo(weight, PRECISION);
    }
  });

  it('matches hand-computed values at realistic gym loads', () => {
    expect(brzyckiE1rm(185, 5)).toBeCloseTo(208.125, PRECISION); // 185 * 36/32
    expect(brzyckiE1rm(315, 3)).toBeCloseTo(333.529411764705882, PRECISION); // 11340/34
    expect(brzyckiE1rm(140, 10)).toBeCloseTo(186.666666666666667, PRECISION); // 5040/27
    expect(brzyckiE1rm(60, 7)).toBeCloseTo(72, PRECISION); // 2160/30
  });

  it('accepts half-rep maxima', () => {
    expect(brzyckiE1rm(100, 16.5)).toBeCloseTo(175.609756097560976, PRECISION); // 3600/20.5
  });

  it('matches the published decimal-rounded form w / (1.0278 - 0.0278 * r)', () => {
    for (const repMax of everyRepMax()) {
      const publishedDecimal = 100 / (1.0278 - 0.0278 * repMax);
      expect(relativeDifference(brzyckiE1rm(100, repMax), publishedDecimal)).toBeLessThan(
        DECIMAL_ROUNDING_TOLERANCE,
      );
    }
  });
});

describe('relationships between the two published curves', () => {
  it('returns identical values at exactly a 10 rep max (both are 4/3 * w)', () => {
    expect(epleyE1rm(100, 10)).toBeCloseTo(133.333333333333333, PRECISION);
    expect(brzyckiE1rm(100, 10)).toBeCloseTo(133.333333333333333, PRECISION);
    expect(epleyE1rm(180, 10)).toBeCloseTo(brzyckiE1rm(180, 10), PRECISION);
  });

  it('reads higher on Epley below a 10 rep max', () => {
    for (let repMax = 1; repMax <= 9; repMax += 1) {
      expect(epleyE1rm(100, repMax)).toBeGreaterThan(brzyckiE1rm(100, repMax));
    }
  });

  it('reads higher on Brzycki above a 10 rep max', () => {
    for (let repMax = 11; repMax <= E1RM_DOMAIN.MAX_REP_MAX; repMax += 1) {
      expect(brzyckiE1rm(100, repMax)).toBeGreaterThan(epleyE1rm(100, repMax));
    }
  });
});

describe('shape of both raw curves', () => {
  const formulas: ReadonlyArray<readonly [name: string, fn: (w: number, r: number) => number]> = [
    ['epley', epleyE1rm],
    ['brzycki', brzyckiE1rm],
  ];

  it.each(formulas)('%s never estimates below the weight actually lifted', (_name, fn) => {
    for (const repMax of everyRepMax()) {
      expect(fn(150, repMax)).toBeGreaterThanOrEqual(150);
    }
  });

  it.each(formulas)('%s increases strictly with the rep max', (_name, fn) => {
    const steps = everyRepMax();
    for (let i = 1; i < steps.length; i += 1) {
      expect(fn(150, steps[i] as number)).toBeGreaterThan(fn(150, steps[i - 1] as number));
    }
  });

  it.each(formulas)('%s is linear in weight, so it is unit-agnostic', (_name, fn) => {
    const KG_TO_LB = 2.2046226218;
    for (const repMax of everyRepMax()) {
      expect(fn(100 * KG_TO_LB, repMax)).toBeCloseTo(fn(100, repMax) * KG_TO_LB, 7);
      expect(fn(200, repMax)).toBeCloseTo(2 * fn(100, repMax), PRECISION);
    }
  });
});

// ===========================================================================
// The reps-in-reserve substitution
// ===========================================================================

describe('effectiveRepMax', () => {
  it('is reps + reps in reserve', () => {
    expect(effectiveRepMax(1, 10)).toBe(1);
    expect(effectiveRepMax(1, 7)).toBe(4);
    expect(effectiveRepMax(5, 8)).toBe(7);
    expect(effectiveRepMax(3, 6)).toBe(7);
    expect(effectiveRepMax(12, 6)).toBe(16);
  });

  it('produces half-rep maxima at the chart’s half-RPE steps', () => {
    expect(effectiveRepMax(1, 9.5)).toBe(1.5);
    expect(effectiveRepMax(8, 7.5)).toBe(10.5);
  });

  it('rejects an RPE the published chart does not cover', () => {
    expect(() => effectiveRepMax(3, 7.3)).toThrow(RangeError);
    expect(() => effectiveRepMax(3, 5)).toThrow(RangeError);
  });
});

describe('the reps-in-reserve identity the estimate is built on', () => {
  // The chart is a reps-in-reserve chart, so N reps at RPE X and (N + RIR)
  // reps at RPE 10 are the same cell. If the estimator honours that, a
  // submaximal set scores exactly like the rep max it is equivalent to.
  it('scores N reps @ RPE X as an (N + RIR) rep max', () => {
    const weight = 180;
    for (const reps of CHARTED_REPS) {
      for (const rpe of CHARTED_RPES) {
        const rir = TO_FAILURE_RPE - rpe;
        if (!Number.isInteger(rir)) {
          continue; // an equivalent whole-rep set only exists at integer RIR
        }
        const equivalentReps = reps + rir;
        if (equivalentReps > RPE_CHART_COVERAGE.MAX_REPS) {
          continue; // no charted whole-rep set at RPE 10 for this rep max
        }
        expect(estimateE1rm({ weight, reps, rpe })).toBeCloseTo(
          estimateE1rm({ weight, reps: equivalentReps, rpe: TO_FAILURE_RPE }),
          PRECISION,
        );
      }
    }
  });

  it('reads a 5 @ RPE 7 as an 8RM effort, not a 5RM effort', () => {
    // This is the specific under-report the RPE input exists to remove: 5 reps
    // with 3 in reserve is the chart's 78.6% cell, the same as an 8 rep max.
    const asFive = estimateE1rm({ weight: 200, reps: 5, rpe: 7 });
    const asEightRepMax = estimateE1rm({ weight: 200, reps: 8, rpe: TO_FAILURE_RPE });
    expect(asFive).toBeCloseTo(asEightRepMax, PRECISION);
    expect(asFive).toBeCloseTo(254.452926208651399, PRECISION); // 200 / 0.786
    // ...and it is meaningfully above what a 5RM would have scored.
    expect(asFive).toBeGreaterThan(estimateE1rm({ weight: 200, reps: 5, rpe: TO_FAILURE_RPE }));
  });
});

// ===========================================================================
// RPE actually moves the number
// ===========================================================================

describe('singles — the game’s most common set', () => {
  it('returns exactly the weight lifted for a single taken to failure', () => {
    // Chart cell 1 @ RPE 10 = 100.0%. Not a clamp: it is the published cell.
    expect(estimateE1rm({ weight: 200, reps: 1, rpe: TO_FAILURE_RPE })).toBeCloseTo(200, PRECISION);
    expect(estimateE1rm({ weight: 227.5, reps: 1, rpe: 10 })).toBeCloseTo(227.5, PRECISION);
  });

  it('reads a submaximal single as more than the weight lifted', () => {
    // The gap this module was reworked to close: a 200 kg single at RPE 7 and
    // one at RPE 10 must not produce the same e1RM.
    const atTen = estimateE1rm({ weight: 200, reps: 1, rpe: 10 });
    const atNine = estimateE1rm({ weight: 200, reps: 1, rpe: 9 });
    const atSeven = estimateE1rm({ weight: 200, reps: 1, rpe: 7 });

    expect(atTen).toBeCloseTo(200, PRECISION); // 100.0%
    expect(atNine).toBeCloseTo(209.424083769633508, PRECISION); // 200 / 0.955
    expect(atSeven).toBeCloseTo(224.215246636771300, PRECISION); // 200 / 0.892

    expect(atSeven).toBeGreaterThan(atNine);
    expect(atNine).toBeGreaterThan(atTen);
  });

  it('walks the whole RPE column at 1 rep, strictly', () => {
    const weight = 200;
    let previous = Number.POSITIVE_INFINITY;
    for (const rpe of [...CHARTED_RPES].sort((a, b) => a - b)) {
      const value = estimateE1rm({ weight, reps: 1, rpe });
      expect(value).toBeCloseTo(weight / (percentOf1RM(1, rpe) / 100), PRECISION);
      expect(value).toBeLessThan(previous);
      previous = value;
    }
  });
});

describe('RPE moves the estimate at multi-rep sets too', () => {
  it('is strictly decreasing in RPE at every charted rep count', () => {
    const weight = 150;
    for (const reps of CHARTED_REPS) {
      const ascendingRpe = [...CHARTED_RPES].sort((a, b) => a - b);
      for (let i = 1; i < ascendingRpe.length; i += 1) {
        const harder = estimateE1rm({ weight, reps, rpe: ascendingRpe[i] as number });
        const easier = estimateE1rm({ weight, reps, rpe: ascendingRpe[i - 1] as number });
        expect(harder).toBeLessThan(easier);
      }
    }
  });

  it('spans more than 10% across RPE 6-10 at a fixed weight and reps', () => {
    // Sanity on magnitude: this is the dimension GDD §3.3 says the mode exists
    // for, so it has to be worth more than rounding noise.
    const atSix = estimateE1rm({ weight: 200, reps: 3, rpe: 6 });
    const atTen = estimateE1rm({ weight: 200, reps: 3, rpe: 10 });
    expect(atSix / atTen).toBeGreaterThan(1.1);
  });

  it('produces hand-computed values for representative training sets', () => {
    // 3 @ RPE 8 = 86.3%
    expect(estimateE1rm({ weight: 200, reps: 3, rpe: 8 })).toBeCloseTo(
      231.749710312862109,
      PRECISION,
    );
    // 5 @ RPE 8 = 81.1%
    expect(estimateE1rm({ weight: 100, reps: 5, rpe: 8 })).toBeCloseTo(
      123.304562268803946,
      PRECISION,
    );
    // 1 @ RPE 8 = 92.2%
    expect(estimateE1rm({ weight: 100, reps: 1, rpe: 8 })).toBeCloseTo(
      108.459869848156182,
      PRECISION,
    );
  });
});

// ===========================================================================
// One curve, shared with load prescription
// ===========================================================================

describe('agreement with rpe.ts', () => {
  it('matches e1rmFromChartedSet on every one of the 108 published cells', () => {
    for (const reps of CHARTED_REPS) {
      for (const rpe of CHARTED_RPES) {
        expect(estimateE1rm({ weight: 172.5, reps, rpe })).toBeCloseTo(
          e1rmFromChartedSet(172.5, reps, rpe),
          SCRUBBED_PRECISION,
        );
      }
    }
  });

  it('is the exact algebraic inverse of the published percentage', () => {
    for (const reps of CHARTED_REPS) {
      for (const rpe of CHARTED_RPES) {
        const percent = percentOf1RM(reps, rpe);
        expect(estimateE1rm({ weight: 200, reps, rpe })).toBeCloseTo(200 / (percent / 100), PRECISION);
      }
    }
  });

  it('round-trips an unrounded prescribed load back to the same e1RM', () => {
    // The property that keeps the daily loop stable: prescribe at an RPE, hit
    // exactly that RPE, and e1RM does not move.
    for (const startingE1rm of [200, 137.5, 322.5]) {
      for (const reps of CHARTED_REPS) {
        for (const rpe of CHARTED_RPES) {
          const load = rawLoadForRpeTarget(startingE1rm, reps, rpe);
          expect(estimateE1rm({ weight: load, reps, rpe })).toBeCloseTo(
            startingE1rm,
            SCRUBBED_PRECISION - 1,
          );
        }
      }
    }
  });

  it('round-trips a plate-rounded prescribed load to within one rounding step', () => {
    const startingE1rm = 200;
    // 2.5 kg increment => at most 1.25 kg of rounding, magnified by the
    // reciprocal of the chart's smallest percentage (its top-edge cell).
    // Read from the chart, not restated, so it cannot go stale.
    const worstCaseDrift = 1.25 / (percentOf1RM(12, 6) / 100);
    for (const reps of CHARTED_REPS) {
      for (const rpe of CHARTED_RPES) {
        const load = loadForRpeTarget(startingE1rm, reps, rpe, { unit: 'kg' });
        expect(Math.abs(estimateE1rm({ weight: load, reps, rpe }) - startingE1rm)).toBeLessThan(
          worstCaseDrift + 1e-9,
        );
      }
    }
  });

  it('moves e1RM up when the lifter beats the prescribed RPE and down when they miss it', () => {
    const startingE1rm = 200;
    const load = rawLoadForRpeTarget(startingE1rm, 3, 8);
    const onTarget = estimateE1rm({ weight: load, reps: 3, rpe: 8 });
    const easierThanTarget = estimateE1rm({ weight: load, reps: 3, rpe: 7 });
    const harderThanTarget = estimateE1rm({ weight: load, reps: 3, rpe: 9 });

    expect(onTarget).toBeCloseTo(startingE1rm, SCRUBBED_PRECISION - 1);
    expect(easierThanTarget).toBeGreaterThan(startingE1rm);
    expect(harderThanTarget).toBeLessThan(startingE1rm);
  });
});

// ===========================================================================
// The join onto Brzycki past the chart
// ===========================================================================

describe('method selection', () => {
  it('uses the published chart for every rep max it covers', () => {
    for (const repMax of everyRepMax()) {
      if (repMax > CHART_MAX_REP_MAX) {
        continue;
      }
      expect(explainE1rm(setForRepMax(150, repMax)).method).toBe('rpe-chart');
    }
  });

  it('falls back to Brzycki past the chart', () => {
    for (const repMax of everyRepMax()) {
      if (repMax <= CHART_MAX_REP_MAX) {
        continue;
      }
      const estimate = explainE1rm(setForRepMax(150, repMax));
      expect(estimate.method).toBe('brzycki');
      expect(estimate.e1rm).toBeCloseTo(brzyckiE1rm(150, repMax), PRECISION);
    }
  });

  it('switches exactly at the chart boundary', () => {
    expect(explainE1rm(setForRepMax(150, CHART_MAX_REP_MAX)).method).toBe('rpe-chart');
    expect(explainE1rm(setForRepMax(150, CHART_MAX_REP_MAX + 0.5)).method).toBe('brzycki');
  });
});

describe('the composite curve', () => {
  it('is strictly increasing in effective rep max across the whole domain', () => {
    const steps = everyRepMax();
    for (let i = 1; i < steps.length; i += 1) {
      const higher = estimateE1rm(setForRepMax(150, steps[i] as number));
      const lower = estimateE1rm(setForRepMax(150, steps[i - 1] as number));
      expect(higher).toBeGreaterThan(lower);
    }
  });

  it('joins Brzycki onto the chart without a step down — the reason Brzycki is the fallback', () => {
    // Derived from the chart rather than restated as a literal. A hardcoded
    // copy of the top-edge cell silently went stale once when that cell was
    // corrected, and a duplicated constant is the same circularity the chart's
    // own tests were sent back for.
    const chartTopEdge = 100 / fractionOf1RM(RPE_CHART_COVERAGE.MAX_REPS, RPE_CHART_COVERAGE.MIN_RPE);
    const brzyckiJustPast = 3600 / 20.5; // 175.6098 - Brzycki at a 16.5 rep max
    const epleyJustPast = 100 * (1 + 16.5 / 30); // 155.0000 - Epley at the same point

    expect(estimateE1rm(setForRepMax(100, CHART_MAX_REP_MAX))).toBeCloseTo(chartTopEdge, PRECISION);
    expect(brzyckiE1rm(100, CHART_MAX_REP_MAX + 0.5)).toBeCloseTo(brzyckiJustPast, PRECISION);
    expect(epleyE1rm(100, CHART_MAX_REP_MAX + 0.5)).toBeCloseTo(epleyJustPast, PRECISION);

    // Brzycki continues upward from the chart...
    expect(brzyckiJustPast).toBeGreaterThan(chartTopEdge);
    // ...Epley would step down, i.e. more reps at the same weight would lower
    // e1RM. That, and not any accuracy claim, is why the fallback is Brzycki.
    expect(epleyJustPast).toBeLessThan(chartTopEdge);
  });

  it('never estimates below the weight actually lifted', () => {
    for (const repMax of everyRepMax()) {
      expect(estimateE1rm(setForRepMax(150, repMax))).toBeGreaterThanOrEqual(150);
    }
  });

  it('equals the weight lifted only for a single taken to failure', () => {
    expect(estimateE1rm({ weight: 150, reps: 1, rpe: 10 })).toBeCloseTo(150, PRECISION);
    for (const repMax of everyRepMax()) {
      if (repMax === 1) {
        continue;
      }
      expect(estimateE1rm(setForRepMax(150, repMax))).toBeGreaterThan(150);
    }
  });

  it('is linear in weight, so the module stays unit-agnostic', () => {
    const KG_TO_LB = 2.2046226218;
    for (const repMax of everyRepMax()) {
      const inKg = estimateE1rm(setForRepMax(100, repMax));
      expect(estimateE1rm(setForRepMax(100 * KG_TO_LB, repMax))).toBeCloseTo(inKg * KG_TO_LB, 7);
      expect(estimateE1rm(setForRepMax(200, repMax))).toBeCloseTo(2 * inKg, PRECISION);
    }
  });
});

// ===========================================================================
// The estimate object
// ===========================================================================

describe('explainE1rm', () => {
  it('reports reps in reserve and effective rep max', () => {
    const estimate = explainE1rm({ weight: 200, reps: 5, rpe: 8 });
    expect(estimate.repsInReserve).toBe(2);
    expect(estimate.effectiveRepMax).toBe(7);
    expect(estimate.method).toBe('rpe-chart');
    expect(estimate.highConfidence).toBe(true);
    expect(estimate.e1rm).toBeCloseTo(200 / 0.811, PRECISION);
  });

  it('reports half a rep in reserve at half-RPE steps', () => {
    const estimate = explainE1rm({ weight: 200, reps: 3, rpe: 8.5 });
    expect(estimate.repsInReserve).toBe(1.5);
    expect(estimate.effectiveRepMax).toBe(4.5);
  });

  it('flags a set that has drifted into endurance territory', () => {
    expect(explainE1rm({ weight: 100, reps: 10, rpe: 10 }).highConfidence).toBe(true);
    expect(explainE1rm({ weight: 100, reps: 10, rpe: 9 }).highConfidence).toBe(false);
    expect(explainE1rm({ weight: 100, reps: 12, rpe: 6 }).highConfidence).toBe(false);
  });

  it('agrees with estimateE1rm', () => {
    for (const reps of CHARTED_REPS) {
      for (const rpe of CHARTED_RPES) {
        const set = { weight: 142.5, reps, rpe };
        expect(explainE1rm(set).e1rm).toBe(estimateE1rm(set));
      }
    }
  });
});

describe('non-throwing variants', () => {
  it('return the same numbers as the throwing ones for a usable set', () => {
    const set = { weight: 180, reps: 3, rpe: 9 };
    expect(tryEstimateE1rm(set)).toBe(estimateE1rm(set));
    expect(tryExplainE1rm(set)).toEqual(explainE1rm(set));
  });

  it('return null instead of throwing for an unusable set', () => {
    expect(tryEstimateE1rm({ weight: 0, reps: 3, rpe: 8 })).toBeNull();
    expect(tryEstimateE1rm({ weight: 100, reps: 0, rpe: 8 })).toBeNull();
    expect(tryEstimateE1rm({ weight: 100, reps: 3, rpe: 7.3 })).toBeNull();
    expect(tryExplainE1rm({ weight: 100, reps: 3, rpe: 5 })).toBeNull();
    expect(tryExplainE1rm({ weight: 100, reps: 25, rpe: 10 })).toBeNull();
  });
});

// ===========================================================================
// Refusals
// ===========================================================================

describe('input validation', () => {
  const invalidReps = [0, -1, -10, 0.5, 2.5, 21, 37, 100, NaN, Infinity, -Infinity];

  it.each(invalidReps)('rejects %f reps', (reps) => {
    expect(() => estimateE1rm({ weight: 100, reps, rpe: 8 })).toThrow(RangeError);
    expect(() => explainE1rm({ weight: 100, reps, rpe: 8 })).toThrow(RangeError);
  });

  const invalidWeights = [0, -1, -100.5, NaN, Infinity, -Infinity];

  it.each(invalidWeights)('rejects a weight of %f', (weight) => {
    expect(() => estimateE1rm({ weight, reps: 5, rpe: 8 })).toThrow(RangeError);
    expect(() => epleyE1rm(weight, 5)).toThrow(RangeError);
    expect(() => brzyckiE1rm(weight, 5)).toThrow(RangeError);
  });

  const offChartRpes = [5, 5.5, 5.9, 6.25, 7.3, 9.75, 10.5, 11, 0, -8, NaN, Infinity, -Infinity];

  it.each(offChartRpes)('rejects RPE %f rather than interpolating it', (rpe) => {
    // GDD §12.3: inventing a chart cell is homebrewing. An uncharted RPE has no
    // published percentage, so there is no honest answer to give.
    expect(() => estimateE1rm({ weight: 100, reps: 3, rpe })).toThrow(RangeError);
  });

  it('explains what it accepts in the error message', () => {
    expect(() => estimateE1rm({ weight: 100, reps: 25, rpe: 10 })).toThrow(/between 1 and 20/);
    expect(() => estimateE1rm({ weight: 100, reps: 2.5, rpe: 10 })).toThrow(/whole number/);
    expect(() => estimateE1rm({ weight: -5, reps: 3, rpe: 10 })).toThrow(/greater than 0/);
    expect(() => estimateE1rm({ weight: 100, reps: 3, rpe: 7.3 })).toThrow(/published chart/);
    expect(() => estimateE1rm({ weight: 100, reps: 3, rpe: 7.3 })).toThrow(/0\.5 steps/);
  });

  it('accepts the exact boundaries', () => {
    expect(() => estimateE1rm({ weight: 100, reps: E1RM_DOMAIN.MIN_REPS, rpe: 10 })).not.toThrow();
    expect(() => estimateE1rm({ weight: 100, reps: E1RM_DOMAIN.MAX_REPS, rpe: 10 })).not.toThrow();
    expect(() => estimateE1rm({ weight: 100, reps: E1RM_DOMAIN.MAX_REPS, rpe: 6 })).not.toThrow();
    expect(() => estimateE1rm({ weight: 0.5, reps: 1, rpe: 10 })).not.toThrow();
  });

  it('never lets Brzycki reach or cross its pole at 37 reps', () => {
    expect(() => brzyckiE1rm(100, E1RM_FORMULA.BRZYCKI_REP_OFFSET)).toThrow(RangeError);
    expect(() => brzyckiE1rm(100, 40)).toThrow(RangeError);
    expect(() => brzyckiE1rm(100, E1RM_DOMAIN.MAX_REP_MAX + 0.5)).toThrow(RangeError);
    expect(brzyckiE1rm(100, E1RM_DOMAIN.MAX_REP_MAX)).toBeGreaterThan(0);
    // The highest rep max any valid set can imply stays inside that guard.
    expect(effectiveRepMax(E1RM_DOMAIN.MAX_REPS, RPE_CHART_COVERAGE.MIN_RPE)).toBeLessThanOrEqual(
      E1RM_DOMAIN.MAX_REP_MAX,
    );
  });

  it('rejects a rep max below 1 or above the ceiling on the raw formulas', () => {
    expect(() => epleyE1rm(100, 0.5)).toThrow(RangeError);
    expect(() => epleyE1rm(100, E1RM_DOMAIN.MAX_REP_MAX + 0.5)).toThrow(RangeError);
    expect(() => epleyE1rm(100, NaN)).toThrow(/finite/);
    expect(() => brzyckiE1rm(100, Infinity)).toThrow(/finite/);
  });
});

// ===========================================================================
// Confidence
// ===========================================================================

describe('isHighConfidenceRepMax', () => {
  it('is true from a 1 rep max up to the tunable bound', () => {
    for (const repMax of everyRepMax()) {
      if (repMax > E1RM_DOMAIN.HIGH_CONFIDENCE_MAX_REP_MAX) {
        continue;
      }
      expect(isHighConfidenceRepMax(repMax)).toBe(true);
    }
  });

  it('is false past the bound, where endurance rather than strength limits the set', () => {
    for (const repMax of everyRepMax()) {
      if (repMax <= E1RM_DOMAIN.HIGH_CONFIDENCE_MAX_REP_MAX) {
        continue;
      }
      expect(isHighConfidenceRepMax(repMax)).toBe(false);
    }
  });

  it('is false for non-sets and non-numbers', () => {
    expect(isHighConfidenceRepMax(0)).toBe(false);
    expect(isHighConfidenceRepMax(-3)).toBe(false);
    expect(isHighConfidenceRepMax(NaN)).toBe(false);
    expect(isHighConfidenceRepMax(Infinity)).toBe(false);
  });

  it('agrees with the constant it is derived from', () => {
    expect(isHighConfidenceRepMax(E1RM_DOMAIN.HIGH_CONFIDENCE_MAX_REP_MAX)).toBe(true);
    expect(isHighConfidenceRepMax(E1RM_DOMAIN.HIGH_CONFIDENCE_MAX_REP_MAX + 0.5)).toBe(false);
  });

  it('is what the estimate reports', () => {
    for (const repMax of everyRepMax()) {
      expect(explainE1rm(setForRepMax(150, repMax)).highConfidence).toBe(
        isHighConfidenceRepMax(repMax),
      );
    }
  });
});
