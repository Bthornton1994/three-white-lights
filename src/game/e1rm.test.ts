import { describe, expect, it } from 'vitest';

import {
  CHART_MAX_REP_MAX,
  E1RM_DOMAIN,
  E1RM_FORMULA,
  E1RM_METHOD_LABEL,
  E1RM_TUNING,
  TO_FAILURE_RPE,
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
  CONTESTED_CHART_CELLS,
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
 *   Epley: e1RM = w * (1 + r / 30). The ONE rep-max formula CLAUDE.md permits.
 *   Tuchscherer / RTS RPE chart: transcribed and sourced in `rpe.ts`.
 *
 * Every figure quoted in `e1rm.ts`'s header is pinned by a test below, under
 * "figures quoted in the module header". The module has shipped a stale number
 * before; prose that no test holds is prose that goes stale.
 */

/** Float comparison precision: |actual - expected| < 5e-10. */
const PRECISION = 9;

/** Looser precision where a value has passed through rpe.ts's 6-dp scrub. */
const SCRUBBED_PRECISION = 5;

/**
 * How far the exact rational form may sit from the widely-published
 * 4-significant-figure decimal form, as a fraction of the estimate. This is a
 * tolerance on *the published rounding*, not on our math: 0.0333 is short of
 * 1/30 by 3.3e-5, and that shortfall is multiplied by the rep count, so the two
 * forms drift further apart the higher the reps go.
 */
const DECIMAL_ROUNDING_TOLERANCE = 0.002; // 0.2% across 1-16 reps

/** Largest reps in reserve the published chart expresses (RPE 6 => 4 RIR). */
const MAX_CHARTED_RIR = RPE_CHART_COVERAGE.MAX_RPE - RPE_CHART_COVERAGE.MIN_RPE;

/** Round to `places` decimals the way a written figure is rounded. */
function toFigure(value: number, places: number): number {
  return Number(value.toFixed(places));
}

/**
 * What the app reports per unit of weight at a given effective rep max: the
 * inverse of the published chart cell. Written from the chart, not from the
 * implementation.
 */
function chartFactor(repMax: number): number {
  return 100 / chartPercentAt(repMax);
}

/** %1RM on the chart's reps-in-reserve diagonal at an effective rep max. */
function chartPercentAt(repMax: number): number {
  const reps = Math.min(RPE_CHART_COVERAGE.MAX_REPS, Math.floor(repMax));
  return percentOf1RM(reps, RPE_CHART_COVERAGE.MAX_RPE - (repMax - reps));
}

/** Epley per unit of weight, written straight from the published formula. */
function epleyFactor(repMax: number): number {
  return 1 + repMax / E1RM_FORMULA.EPLEY_REP_DIVISOR;
}

/**
 * Smallest set that expresses a given effective rep max, used to walk the
 * curve. Mirrors the reps-in-reserve identity, not the implementation's
 * internal cell picker.
 */
function setForRepMax(weight: number, repMax: number): CompletedSet {
  const reps = Math.min(E1RM_DOMAIN.MAX_REPS, Math.floor(repMax));
  return { weight, reps, rpe: TO_FAILURE_RPE - (repMax - reps) };
}

/** Every supported effective rep max, in the chart's half-rep steps. */
function everyRepMax(): number[] {
  const out: number[] = [];
  for (let doubled = E1RM_DOMAIN.MIN_REPS * 2; doubled <= CHART_MAX_REP_MAX * 2; doubled += 1) {
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

  it('carries exactly one rep-max formula constant, because there is one formula', () => {
    // CLAUDE.md: "Epley, and only Epley". A second entry here would be a
    // second formula sneaking back in.
    expect(Object.keys(E1RM_FORMULA)).toEqual(['EPLEY_REP_DIVISOR']);
  });

  it('has one attribution, because there is one curve', () => {
    expect(Object.keys(E1RM_METHOD_LABEL)).toEqual(['rpe-chart']);
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

  it('ends the supported domain exactly where the published chart ends', () => {
    // The whole point of the rework: no curve past the data.
    expect(E1RM_DOMAIN.MAX_REPS).toBe(CHART_MAX_REP_MAX);
    expect(E1RM_DOMAIN.MIN_REPS).toBe(RPE_CHART_COVERAGE.MIN_REPS);
    expect(E1RM_DOMAIN.MIN_REPS).toBe(1);
  });

  it('accepts the longest rep count only when the set was taken to failure', () => {
    // MAX_REPS is necessary, not sufficient: at any lower RPE the same rep
    // count implies an effective rep max past the chart.
    expect(() =>
      estimateE1rm({ weight: 100, reps: E1RM_DOMAIN.MAX_REPS, rpe: TO_FAILURE_RPE }),
    ).not.toThrow();
    expect(() =>
      estimateE1rm({ weight: 100, reps: E1RM_DOMAIN.MAX_REPS, rpe: TO_FAILURE_RPE - 0.5 }),
    ).toThrow(RangeError);
  });

  it('keeps the tunable confidence bound inside the supported domain', () => {
    expect(E1RM_TUNING.HIGH_CONFIDENCE_MAX_REP_MAX).toBeLessThanOrEqual(CHART_MAX_REP_MAX);
    expect(E1RM_TUNING.HIGH_CONFIDENCE_MAX_REP_MAX).toBeGreaterThanOrEqual(E1RM_DOMAIN.MIN_REPS);
  });

  it('keeps the one tunable value out of the derived and published blocks', () => {
    // CLAUDE.md "Game Feel Values Must Be Tunable": one place, clearly marked.
    expect(Object.keys(E1RM_TUNING)).toEqual(['HIGH_CONFIDENCE_MAX_REP_MAX']);
  });
});

// ===========================================================================
// The one published formula
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
    [12, 140],
    [15, 150],
    [16, 153.333333333333333],
  ];

  it.each(publishedAt100)('100 x %f rep max -> %f', (repMax, expected) => {
    expect(epleyE1rm(100, repMax)).toBeCloseTo(expected, PRECISION);
  });

  it('is the raw published curve at 1 rep, with no clamp to the weight lifted', () => {
    // Deliberate: Epley is a rep-max formula and is simply not exact at r = 1;
    // pretending otherwise made a lower bound look like a point estimate.
    // Singles are handled by the chart instead (see "singles" below), so
    // nothing player-facing depends on this value.
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
    expect(epleyE1rm(100, 15.5)).toBeCloseTo(151.666666666666667, PRECISION);
  });

  it('matches the published decimal-rounded form w * (1 + 0.0333 * r)', () => {
    for (const repMax of everyRepMax()) {
      const publishedDecimal = 100 * (1 + 0.0333 * repMax);
      const drift = Math.abs(epleyE1rm(100, repMax) - publishedDecimal) / publishedDecimal;
      expect(drift).toBeLessThan(DECIMAL_ROUNDING_TOLERANCE);
    }
  });

  it('is strictly increasing and never below the weight lifted', () => {
    const steps = everyRepMax();
    for (let i = 1; i < steps.length; i += 1) {
      expect(epleyE1rm(150, steps[i] as number)).toBeGreaterThan(
        epleyE1rm(150, steps[i - 1] as number),
      );
    }
    for (const repMax of everyRepMax()) {
      expect(epleyE1rm(150, repMax)).toBeGreaterThanOrEqual(150);
    }
  });

  it('is linear in weight, so it is unit-agnostic', () => {
    const KG_TO_LB = 2.2046226218;
    for (const repMax of everyRepMax()) {
      expect(epleyE1rm(100 * KG_TO_LB, repMax)).toBeCloseTo(epleyE1rm(100, repMax) * KG_TO_LB, 7);
      expect(epleyE1rm(200, repMax)).toBeCloseTo(2 * epleyE1rm(100, repMax), PRECISION);
    }
  });

  it('refuses the same rep maxes the set entry points refuse — one domain, every route', () => {
    // You cannot reach past the chart by calling the formula instead.
    expect(() => epleyE1rm(100, CHART_MAX_REP_MAX + 0.5)).toThrow(RangeError);
    expect(() => epleyE1rm(100, 20)).toThrow(RangeError);
    expect(() => epleyE1rm(100, 0.5)).toThrow(RangeError);
    expect(() => epleyE1rm(100, NaN)).toThrow(/finite/);
    expect(() => epleyE1rm(100, Infinity)).toThrow(/finite/);
    expect(epleyE1rm(100, CHART_MAX_REP_MAX)).toBeGreaterThan(0);
  });
});

// ===========================================================================
// Why the formula is not the app's e1RM, and why nothing extends past the chart
// ===========================================================================

describe('Epley against the curve the app actually reports', () => {
  it('disagrees with the chart everywhere except one crossover, so only one can be player-facing', () => {
    // Epley reads high at low rep maxes and low at high ones. If both were in
    // use, two parts of the app would report different numbers for one set —
    // the exact thing CLAUDE.md's one-formula rule exists to prevent.
    for (let repMax = 1; repMax <= 7; repMax += 0.5) {
      expect(epleyFactor(repMax)).toBeGreaterThan(chartFactor(repMax));
    }
    for (let repMax = 7.5; repMax <= CHART_MAX_REP_MAX; repMax += 0.5) {
      expect(epleyFactor(repMax)).toBeLessThan(chartFactor(repMax));
    }
  });

  it('would step DOWN if it were continued past the chart — the reason there is no fallback', () => {
    // Derived from the chart rather than restated as a literal. A hardcoded
    // copy of the top-edge cell silently went stale once when that cell was
    // corrected.
    const chartTopEdge = 100 / fractionOf1RM(RPE_CHART_COVERAGE.MAX_REPS, RPE_CHART_COVERAGE.MIN_RPE);
    const epleyJustPast = 100 * epleyFactor(CHART_MAX_REP_MAX + 0.5);

    expect(estimateE1rm(setForRepMax(100, CHART_MAX_REP_MAX))).toBeCloseTo(chartTopEdge, PRECISION);
    expect(epleyJustPast).toBeLessThan(chartTopEdge);
    // i.e. one more half rep at the same weight would LOWER the estimate.
  });

  it('would step down under every reading rpe.ts has on record for the top-edge cell', () => {
    // The conclusion must not depend on which reading of the contested cell
    // (12 reps, RPE 6) rpe.ts adopts. For Epley to continue upward the cell
    // would have to read above 100 / 1.55 = 64.52%; every reading on record is
    // far below that.
    const crossoverPercent = 100 / epleyFactor(CHART_MAX_REP_MAX + 0.5);
    const topEdge = CONTESTED_CHART_CELLS.find(
      (cell) =>
        cell.reps === RPE_CHART_COVERAGE.MAX_REPS && cell.rpe === RPE_CHART_COVERAGE.MIN_RPE,
    );
    expect(topEdge).toBeDefined();
    // The header names these two readings by value. If rpe.ts ever changes the
    // cell or records a third reading, this fails on purpose: the paragraph
    // saying "57.4% and the rival 57.2%" has to be re-read, not silently
    // outlived.
    expect([...(topEdge?.readings ?? [])].map((r) => r.percent).sort((a, b) => a - b)).toEqual([
      57.2, 57.4,
    ]);
    for (const reading of topEdge?.readings ?? []) {
      expect(reading.percent).toBeLessThan(crossoverPercent);
    }
    // ...and the cell actually in use is one of them.
    expect(percentOf1RM(RPE_CHART_COVERAGE.MAX_REPS, RPE_CHART_COVERAGE.MIN_RPE)).toBeLessThan(
      crossoverPercent,
    );
  });
});

describe('figures quoted in the module header', () => {
  it('chart at a 16 rep max is 1.7422 x w', () => {
    expect(toFigure(chartFactor(CHART_MAX_REP_MAX), 4)).toBe(1.7422);
  });

  it('Epley at a 16.5 rep max is 1.5500 x w', () => {
    expect(toFigure(epleyFactor(CHART_MAX_REP_MAX + 0.5), 4)).toBe(1.55);
  });

  it('the cell value Epley would need to continue upward is 64.52%', () => {
    expect(toFigure(100 / epleyFactor(CHART_MAX_REP_MAX + 0.5), 2)).toBe(64.52);
  });

  it('Epley reads 3.33% above the chart at a 1 rep max', () => {
    expect(toFigure((epleyFactor(1) / chartFactor(1) - 1) * 100, 2)).toBe(3.33);
  });

  it('Epley reads 11.99% below the chart at a 16 rep max', () => {
    const shortfall = (1 - epleyFactor(CHART_MAX_REP_MAX) / chartFactor(CHART_MAX_REP_MAX)) * 100;
    expect(toFigure(shortfall, 2)).toBe(11.99);
    // The header states the same gap as "about 12% under" what
    // e1rmFromChartedSet reports for 12 reps @ RPE 6.
    const chartValue = e1rmFromChartedSet(100, 12, 6);
    expect((1 - epleyE1rm(100, CHART_MAX_REP_MAX) / chartValue) * 100).toBeCloseTo(shortfall, 4);
  });

  it('the crossover sits between a 7 and a 7.5 rep max', () => {
    expect(epleyFactor(7)).toBeGreaterThan(chartFactor(7));
    expect(epleyFactor(7.5)).toBeLessThan(chartFactor(7.5));
  });

  it('the widest accepted sets are 16 reps to failure and 12 reps @ RPE 6', () => {
    expect(effectiveRepMax(16, TO_FAILURE_RPE)).toBe(CHART_MAX_REP_MAX);
    expect(effectiveRepMax(12, RPE_CHART_COVERAGE.MIN_RPE)).toBe(CHART_MAX_REP_MAX);
    expect(() => estimateE1rm({ weight: 100, reps: 16, rpe: TO_FAILURE_RPE })).not.toThrow();
    expect(() => estimateE1rm({ weight: 100, reps: 12, rpe: 6 })).not.toThrow();
    // Both are the same chart cell, so both score identically.
    expect(estimateE1rm({ weight: 100, reps: 16, rpe: TO_FAILURE_RPE })).toBeCloseTo(
      estimateE1rm({ weight: 100, reps: 12, rpe: 6 }),
      PRECISION,
    );
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
        if (equivalentReps > E1RM_DOMAIN.MAX_REPS) {
          continue; // no accepted whole-rep set at RPE 10 for this rep max
        }
        expect(estimateE1rm({ weight, reps, rpe })).toBeCloseTo(
          estimateE1rm({ weight, reps: equivalentReps, rpe: TO_FAILURE_RPE }),
          PRECISION,
        );
      }
    }
  });

  it('reads a 5 @ RPE 7 as an 8RM effort, not a 5RM effort', () => {
    // This is the specific under-report the RPE input exists to remove, and the
    // one CLAUDE.md names as a bug: 5 reps with 3 in reserve is the chart's
    // 78.6% cell, the same as an 8 rep max.
    const asFive = estimateE1rm({ weight: 200, reps: 5, rpe: 7 });
    const asEightRepMax = estimateE1rm({ weight: 200, reps: 8, rpe: TO_FAILURE_RPE });
    expect(asFive).toBeCloseTo(asEightRepMax, PRECISION);
    expect(asFive).toBeCloseTo(254.452926208651399, PRECISION); // 200 / 0.786
    // ...and it is meaningfully above what a 5RM would have scored.
    expect(asFive).toBeGreaterThan(estimateE1rm({ weight: 200, reps: 5, rpe: TO_FAILURE_RPE }));
  });

  it('never applies the formula to the raw rep count', () => {
    // The defect CLAUDE.md calls a bug: Epley on `reps` ignoring reps in
    // reserve. A 5 @ RPE 7 must not score as Epley's 5RM.
    expect(estimateE1rm({ weight: 200, reps: 5, rpe: 7 })).not.toBeCloseTo(
      epleyE1rm(200, 5),
      PRECISION,
    );
    expect(estimateE1rm({ weight: 200, reps: 5, rpe: 7 })).toBeGreaterThan(epleyE1rm(200, 5));
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
    // exactly that RPE, and e1RM does not move. Only one curve can do this, and
    // it is the chart's — which is why the formula is not player-facing.
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
// One curve, one attribution — and nothing past the chart
// ===========================================================================

describe('method selection', () => {
  it('uses the published chart for every rep max it covers, and nothing else', () => {
    for (const repMax of everyRepMax()) {
      const estimate = explainE1rm(setForRepMax(150, repMax));
      expect(estimate.method).toBe('rpe-chart');
      expect(estimate.e1rm).toBeCloseTo(150 * chartFactor(repMax), PRECISION);
    }
  });

  it('refuses at the first half step past the chart instead of switching curves', () => {
    expect(() => explainE1rm(setForRepMax(150, CHART_MAX_REP_MAX))).not.toThrow();
    expect(() => explainE1rm(setForRepMax(150, CHART_MAX_REP_MAX + 0.5))).toThrow(RangeError);
    expect(tryExplainE1rm(setForRepMax(150, CHART_MAX_REP_MAX + 0.5))).toBeNull();
  });
});

describe('the curve', () => {
  it('is strictly increasing in effective rep max across the whole domain', () => {
    const steps = everyRepMax();
    for (let i = 1; i < steps.length; i += 1) {
      const higher = estimateE1rm(setForRepMax(150, steps[i] as number));
      const lower = estimateE1rm(setForRepMax(150, steps[i - 1] as number));
      expect(higher).toBeGreaterThan(lower);
    }
  });

  it('is strictly increasing over every set the module accepts, not just the walked ones', () => {
    // Stronger form: any two accepted sets with the same weight order by
    // effective rep max, whichever (reps, RPE) pair expressed them.
    const weight = 150;
    const accepted: Array<{ repMax: number; e1rm: number }> = [];
    for (let reps = E1RM_DOMAIN.MIN_REPS; reps <= E1RM_DOMAIN.MAX_REPS; reps += 1) {
      for (const rpe of CHARTED_RPES) {
        const value = tryEstimateE1rm({ weight, reps, rpe });
        if (value !== null) {
          accepted.push({ repMax: reps + (TO_FAILURE_RPE - rpe), e1rm: value });
        }
      }
    }
    expect(accepted.length).toBeGreaterThan(100);
    for (const a of accepted) {
      for (const b of accepted) {
        if (a.repMax < b.repMax) {
          expect(a.e1rm).toBeLessThan(b.e1rm);
        } else if (a.repMax === b.repMax) {
          expect(a.e1rm).toBeCloseTo(b.e1rm, PRECISION);
        }
      }
    }
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
    expect(tryExplainE1rm({ weight: 100, reps: 13, rpe: 6 })).toBeNull(); // past the chart
  });

  it('agree with the throwing ones about exactly which sets are usable', () => {
    for (let reps = 0; reps <= E1RM_DOMAIN.MAX_REPS + 4; reps += 1) {
      for (const rpe of CHARTED_RPES) {
        const set = { weight: 120, reps, rpe };
        const nonThrowing = tryEstimateE1rm(set);
        if (nonThrowing === null) {
          expect(() => estimateE1rm(set)).toThrow(RangeError);
        } else {
          expect(estimateE1rm(set)).toBe(nonThrowing);
        }
      }
    }
  });
});

// ===========================================================================
// Refusals
// ===========================================================================

describe('input validation', () => {
  const invalidReps = [0, -1, -10, 0.5, 2.5, 17, 21, 37, 100, NaN, Infinity, -Infinity];

  it.each(invalidReps)('rejects %f reps', (reps) => {
    expect(() => estimateE1rm({ weight: 100, reps, rpe: 8 })).toThrow(RangeError);
    expect(() => explainE1rm({ weight: 100, reps, rpe: 8 })).toThrow(RangeError);
  });

  const invalidWeights = [0, -1, -100.5, NaN, Infinity, -Infinity];

  it.each(invalidWeights)('rejects a weight of %f', (weight) => {
    expect(() => estimateE1rm({ weight, reps: 5, rpe: 8 })).toThrow(RangeError);
    expect(() => epleyE1rm(weight, 5)).toThrow(RangeError);
  });

  const offChartRpes = [5, 5.5, 5.9, 6.25, 7.3, 9.75, 10.5, 11, 0, -8, NaN, Infinity, -Infinity];

  it.each(offChartRpes)('rejects RPE %f rather than interpolating it', (rpe) => {
    // GDD §12.3: inventing a chart cell is homebrewing. An uncharted RPE has no
    // published percentage, so there is no honest answer to give.
    expect(() => estimateE1rm({ weight: 100, reps: 3, rpe })).toThrow(RangeError);
  });

  it('explains what it accepts in the error message', () => {
    expect(() => estimateE1rm({ weight: 100, reps: 25, rpe: 10 })).toThrow(/between 1 and 16/);
    expect(() => estimateE1rm({ weight: 100, reps: 2.5, rpe: 10 })).toThrow(/whole number/);
    expect(() => estimateE1rm({ weight: -5, reps: 3, rpe: 10 })).toThrow(/greater than 0/);
    expect(() => estimateE1rm({ weight: 100, reps: 3, rpe: 7.3 })).toThrow(/published chart/);
    expect(() => estimateE1rm({ weight: 100, reps: 3, rpe: 7.3 })).toThrow(/0\.5 steps/);
  });

  it('says what it refuses and why when a set runs past the chart', () => {
    expect(() => estimateE1rm({ weight: 100, reps: 14, rpe: 7 })).toThrow(
      /effective rep max of 17/,
    );
    expect(() => estimateE1rm({ weight: 100, reps: 14, rpe: 7 })).toThrow(/coverage is 1-16/);
    expect(() => estimateE1rm({ weight: 100, reps: 14, rpe: 7 })).toThrow(/no fallback/);
  });

  it('accepts the exact boundaries', () => {
    expect(() => estimateE1rm({ weight: 100, reps: E1RM_DOMAIN.MIN_REPS, rpe: 10 })).not.toThrow();
    expect(() => estimateE1rm({ weight: 100, reps: E1RM_DOMAIN.MAX_REPS, rpe: 10 })).not.toThrow();
    expect(() => estimateE1rm({ weight: 100, reps: 12, rpe: 6 })).not.toThrow();
    expect(() => estimateE1rm({ weight: 0.5, reps: 1, rpe: 10 })).not.toThrow();
  });
});

describe('the domain the module gave up when the fallback formula was removed', () => {
  /**
   * The behaviour change stated at the top of `e1rm.ts`, enumerated. Every one
   * of these used to return a number (via a second formula CLAUDE.md now
   * forbids) and now refuses. Anything at or below a 16 effective rep max is
   * untouched.
   */
  const nowRefused: ReadonlyArray<readonly [reps: number, lowestAcceptedRpe: number]> = [
    [13, 7],
    [14, 8],
    [15, 9],
    [16, 10],
  ];

  it.each(nowRefused)(
    '%d reps: accepted from RPE %f up, refused below it',
    (reps, lowestAcceptedRpe) => {
      for (const rpe of CHARTED_RPES) {
        const set = { weight: 150, reps, rpe };
        if (rpe >= lowestAcceptedRpe) {
          expect(effectiveRepMax(reps, rpe)).toBeLessThanOrEqual(CHART_MAX_REP_MAX);
          expect(tryEstimateE1rm(set)).not.toBeNull();
        } else {
          expect(effectiveRepMax(reps, rpe)).toBeGreaterThan(CHART_MAX_REP_MAX);
          expect(tryEstimateE1rm(set)).toBeNull();
        }
      }
    },
  );

  it('refuses 17 to 20 reps at every RPE', () => {
    for (let reps = 17; reps <= 20; reps += 1) {
      for (const rpe of CHARTED_RPES) {
        expect(tryEstimateE1rm({ weight: 150, reps, rpe })).toBeNull();
      }
    }
  });

  it('refuses every effective rep max above the chart, in half steps up to 24', () => {
    // 24 was the old ceiling: reps 20 at RPE 6. Nothing in this range answers.
    for (let repMax = CHART_MAX_REP_MAX + 0.5; repMax <= 24; repMax += 0.5) {
      const reps = Math.min(20, Math.floor(repMax));
      const rpe = TO_FAILURE_RPE - (repMax - reps);
      // Every point in the old domain really was expressible as a charted set,
      // so this walk covers all of it rather than skipping the awkward end.
      expect(rpe).toBeGreaterThanOrEqual(RPE_CHART_COVERAGE.MIN_RPE);
      expect(tryEstimateE1rm({ weight: 150, reps, rpe })).toBeNull();
    }
  });

  it('leaves every set at or below the chart ceiling answering as before', () => {
    for (let reps = E1RM_DOMAIN.MIN_REPS; reps <= E1RM_DOMAIN.MAX_REPS; reps += 1) {
      for (const rpe of CHARTED_RPES) {
        if (effectiveRepMax(reps, rpe) > CHART_MAX_REP_MAX) {
          continue;
        }
        // The chart inverse, unchanged: weight / (published % / 100).
        expect(estimateE1rm({ weight: 150, reps, rpe })).toBeCloseTo(
          150 * chartFactor(effectiveRepMax(reps, rpe)),
          PRECISION,
        );
      }
    }
  });
});

// ===========================================================================
// Confidence
// ===========================================================================

describe('isHighConfidenceRepMax', () => {
  it('is true from a 1 rep max up to the tunable bound', () => {
    for (const repMax of everyRepMax()) {
      if (repMax > E1RM_TUNING.HIGH_CONFIDENCE_MAX_REP_MAX) {
        continue;
      }
      expect(isHighConfidenceRepMax(repMax)).toBe(true);
    }
  });

  it('is false past the bound, where endurance rather than strength limits the set', () => {
    for (const repMax of everyRepMax()) {
      if (repMax <= E1RM_TUNING.HIGH_CONFIDENCE_MAX_REP_MAX) {
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
    expect(isHighConfidenceRepMax(E1RM_TUNING.HIGH_CONFIDENCE_MAX_REP_MAX)).toBe(true);
    expect(isHighConfidenceRepMax(E1RM_TUNING.HIGH_CONFIDENCE_MAX_REP_MAX + 0.5)).toBe(false);
  });

  it('is what the estimate reports', () => {
    for (const repMax of everyRepMax()) {
      expect(explainE1rm(setForRepMax(150, repMax)).highConfidence).toBe(
        isHighConfidenceRepMax(repMax),
      );
    }
  });
});
