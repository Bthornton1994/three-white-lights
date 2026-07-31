import { describe, expect, it } from 'vitest';

import {
  E1RM,
  E1RM_FORMULA_NAME,
  brzyckiE1rm,
  epleyE1rm,
  estimateE1rm,
  isHighConfidenceRepRange,
} from './e1rm';

/**
 * Every expected value in this file is a literal, computed by hand from the
 * published formula — never by re-running the formula inside the test. A test
 * that recomputes the implementation proves nothing.
 *
 *   Epley:   e1RM = w * (1 + r / 30)
 *   Brzycki: e1RM = w * 36 / (37 - r)
 *
 * Both are exact rational forms of the published decimals (0.0333 = 1/30;
 * 1.0278 = 37/36 and 0.0278 = 1/36) — asserted directly in
 * "matches the published decimal-rounded forms" below.
 */

/** Float comparison precision: |actual - expected| < 5e-10. */
const PRECISION = 9;

/**
 * How far the exact rational forms may sit from the widely-published
 * 4-significant-figure decimal forms, as a fraction of the estimate. These are
 * tolerances on *the published rounding*, not on our math: 0.0333 is short of
 * 1/30 by 3.3e-5 and 0.0278 is short of 1/36 by 2.2e-6, and that shortfall is
 * multiplied by the rep count, so the two forms drift further apart the higher
 * the reps go. Hence a tighter bound over the range we actually trust.
 */
const DECIMAL_ROUNDING_TOLERANCE_HIGH_CONFIDENCE = 0.0005; // 0.05% over 1-10 reps
const DECIMAL_ROUNDING_TOLERANCE_FULL_RANGE = 0.0015; // 0.15% over 1-20 reps

function relativeDifference(actual: number, expected: number): number {
  return Math.abs(actual - expected) / expected;
}

function toleranceFor(reps: number): number {
  return reps <= E1RM.HIGH_CONFIDENCE_MAX_REPS
    ? DECIMAL_ROUNDING_TOLERANCE_HIGH_CONFIDENCE
    : DECIMAL_ROUNDING_TOLERANCE_FULL_RANGE;
}

describe('published formula constants', () => {
  // Locks the published numbers. If a future edit "tunes" one of these, this
  // fails loudly — these are not game-feel values (CLAUDE.md, Domain Correctness).
  it('holds the Epley divisor of 30', () => {
    expect(E1RM.EPLEY_REP_DIVISOR).toBe(30);
  });

  it('holds the Brzycki 36 / (37 - r) pair', () => {
    expect(E1RM.BRZYCKI_NUMERATOR).toBe(36);
    expect(E1RM.BRZYCKI_REP_OFFSET).toBe(37);
  });

  it('guards reps well below the Brzycki pole at 37 reps', () => {
    expect(E1RM.MAX_SUPPORTED_REPS).toBeLessThan(E1RM.BRZYCKI_REP_OFFSET);
    expect(E1RM.HIGH_CONFIDENCE_MAX_REPS).toBeLessThanOrEqual(E1RM.MAX_SUPPORTED_REPS);
    expect(E1RM.MIN_REPS).toBe(1);
  });
});

describe('epleyE1rm', () => {
  // w = 100, so each expected value is literally 100 * (1 + r / 30).
  const publishedAt100: ReadonlyArray<readonly [reps: number, expected: number]> = [
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
  ];

  it.each(publishedAt100)('100 x %i reps -> %f', (reps, expected) => {
    expect(epleyE1rm(100, reps)).toBeCloseTo(expected, PRECISION);
  });

  it('matches hand-computed values at realistic gym loads', () => {
    // 140 * (1 + 5/30) = 140 * 7/6
    expect(epleyE1rm(140, 5)).toBeCloseTo(163.333333333333333, PRECISION);
    // 102.5 * (1 + 3/30) = 102.5 * 1.1
    expect(epleyE1rm(102.5, 3)).toBeCloseTo(112.75, PRECISION);
    // 225 * (1 + 8/30) = 225 * 19/15
    expect(epleyE1rm(225, 8)).toBeCloseTo(285, PRECISION);
    // 315 * (1 + 3/30)
    expect(epleyE1rm(315, 3)).toBeCloseTo(346.5, PRECISION);
    // 60 * (1 + 2/30) = 60 * 16/15
    expect(epleyE1rm(60, 2)).toBeCloseTo(64, PRECISION);
  });

  it('matches the published decimal-rounded form w * (1 + 0.0333 * r)', () => {
    for (let reps = 2; reps <= E1RM.MAX_SUPPORTED_REPS; reps += 1) {
      const publishedDecimal = 100 * (1 + 0.0333 * reps);
      expect(relativeDifference(epleyE1rm(100, reps), publishedDecimal)).toBeLessThan(
        toleranceFor(reps),
      );
    }
  });
});

describe('brzyckiE1rm', () => {
  // w = 100, so each expected value is literally 3600 / (37 - r).
  const publishedAt100: ReadonlyArray<readonly [reps: number, expected: number]> = [
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
  ];

  it.each(publishedAt100)('100 x %i reps -> %f', (reps, expected) => {
    expect(brzyckiE1rm(100, reps)).toBeCloseTo(expected, PRECISION);
  });

  it('matches hand-computed values at realistic gym loads', () => {
    // 185 * 36 / 32 = 185 * 1.125
    expect(brzyckiE1rm(185, 5)).toBeCloseTo(208.125, PRECISION);
    // 315 * 36 / 34 = 11340 / 34
    expect(brzyckiE1rm(315, 3)).toBeCloseTo(333.529411764705882, PRECISION);
    // 140 * 36 / 27 = 5040 / 27
    expect(brzyckiE1rm(140, 10)).toBeCloseTo(186.666666666666667, PRECISION);
    // 60 * 36 / 30 = 2160 / 30
    expect(brzyckiE1rm(60, 7)).toBeCloseTo(72, PRECISION);
  });

  it('matches the published decimal-rounded form w / (1.0278 - 0.0278 * r)', () => {
    for (let reps = 1; reps <= E1RM.MAX_SUPPORTED_REPS; reps += 1) {
      const publishedDecimal = 100 / (1.0278 - 0.0278 * reps);
      expect(relativeDifference(brzyckiE1rm(100, reps), publishedDecimal)).toBeLessThan(
        toleranceFor(reps),
      );
    }
  });
});

describe('the single-rep boundary', () => {
  const weights = [60, 100, 102.5, 227.5, 400.5];

  it.each(weights)('Brzycki returns the weight itself at 1 rep (%f)', (weight) => {
    // Natural property of the formula: 36 / (37 - 1) = 1.
    expect(brzyckiE1rm(weight, 1)).toBeCloseTo(weight, PRECISION);
  });

  it.each(weights)('Epley is clamped to the weight itself at 1 rep (%f)', (weight) => {
    // NOT natural: the raw curve returns 1.0333... * w here. The module
    // applies an explicit single-rep rule; this is that rule, asserted.
    expect(epleyE1rm(weight, 1)).toBe(weight);
  });

  it('documents exactly what the raw Epley curve would have returned at 1 rep', () => {
    const rawEpleyAtOneRep = 200 * (1 + 1 / 30); // 206.666... - an over-claim
    expect(rawEpleyAtOneRep).toBeCloseTo(206.666666666666667, PRECISION);
    expect(epleyE1rm(200, 1)).toBe(200);
    expect(epleyE1rm(200, 1)).not.toBeCloseTo(rawEpleyAtOneRep, PRECISION);
  });

  it('leaves the published Epley curve untouched from 2 reps up', () => {
    // The single-rep rule must not have leaked into the rest of the domain:
    // every r >= 2 still equals w * (1 + r/30) to the last bit.
    for (let reps = 2; reps <= E1RM.MAX_SUPPORTED_REPS; reps += 1) {
      expect(epleyE1rm(160, reps)).toBe(160 * (1 + reps / 30));
    }
  });

  it('both formulas agree at 1 rep', () => {
    expect(epleyE1rm(227.5, 1)).toBeCloseTo(brzyckiE1rm(227.5, 1), PRECISION);
  });
});

describe('relationships between the two published curves', () => {
  it('returns identical values at exactly 10 reps (both are 4/3 * w)', () => {
    // Documented property of these two formulas: 1 + 10/30 = 4/3 and
    // 36/(37-10) = 36/27 = 4/3.
    expect(epleyE1rm(100, 10)).toBeCloseTo(133.333333333333333, PRECISION);
    expect(brzyckiE1rm(100, 10)).toBeCloseTo(133.333333333333333, PRECISION);
    expect(epleyE1rm(180, 10)).toBeCloseTo(brzyckiE1rm(180, 10), PRECISION);
  });

  it('reads higher on Epley below 10 reps', () => {
    for (let reps = 2; reps <= 9; reps += 1) {
      expect(epleyE1rm(100, reps)).toBeGreaterThan(brzyckiE1rm(100, reps));
    }
  });

  it('reads higher on Brzycki above 10 reps', () => {
    for (let reps = 11; reps <= E1RM.MAX_SUPPORTED_REPS; reps += 1) {
      expect(brzyckiE1rm(100, reps)).toBeGreaterThan(epleyE1rm(100, reps));
    }
  });

  it('stays within ~4% of each other across the high-confidence range', () => {
    for (let reps = 1; reps <= E1RM.HIGH_CONFIDENCE_MAX_REPS; reps += 1) {
      const spread = Math.abs(epleyE1rm(100, reps) - brzyckiE1rm(100, reps));
      expect(spread).toBeLessThan(4.5);
    }
  });
});

describe('shape of both curves', () => {
  const formulas: ReadonlyArray<readonly [name: string, fn: (w: number, r: number) => number]> = [
    ['epley', epleyE1rm],
    ['brzycki', brzyckiE1rm],
  ];

  it.each(formulas)('%s never estimates below the weight actually lifted', (_name, fn) => {
    for (let reps = E1RM.MIN_REPS; reps <= E1RM.MAX_SUPPORTED_REPS; reps += 1) {
      expect(fn(150, reps)).toBeGreaterThanOrEqual(150);
    }
  });

  it.each(formulas)('%s increases strictly with reps at a fixed weight', (_name, fn) => {
    for (let reps = E1RM.MIN_REPS; reps < E1RM.MAX_SUPPORTED_REPS; reps += 1) {
      expect(fn(150, reps + 1)).toBeGreaterThan(fn(150, reps));
    }
  });

  it.each(formulas)('%s increases strictly with weight at fixed reps', (_name, fn) => {
    expect(fn(101, 5)).toBeGreaterThan(fn(100, 5));
    expect(fn(500, 3)).toBeGreaterThan(fn(499.5, 3));
  });

  it.each(formulas)('%s is linear in weight, so it is unit-agnostic', (_name, fn) => {
    // kg -> lb is a scalar multiply; the estimate must scale with it exactly,
    // which is what lets this module stay unit-free (GDD §11 open question).
    const KG_TO_LB = 2.2046226218;
    for (let reps = E1RM.MIN_REPS; reps <= E1RM.MAX_SUPPORTED_REPS; reps += 1) {
      expect(fn(100 * KG_TO_LB, reps)).toBeCloseTo(fn(100, reps) * KG_TO_LB, 7);
      expect(fn(200, reps)).toBeCloseTo(2 * fn(100, reps), PRECISION);
    }
  });
});

describe('estimateE1rm (the codebase-wide entry point)', () => {
  it('is Epley, and says so', () => {
    expect(E1RM_FORMULA_NAME).toBe('Epley');
  });

  it('delegates to Epley across the whole supported range', () => {
    for (let reps = E1RM.MIN_REPS; reps <= E1RM.MAX_SUPPORTED_REPS; reps += 1) {
      expect(estimateE1rm(180, reps)).toBe(epleyE1rm(180, reps));
    }
  });

  it('returns the weight itself for a single', () => {
    expect(estimateE1rm(227.5, 1)).toBe(227.5);
  });

  it('produces the hand-computed value for a top single-lift set', () => {
    // A 3 x 180kg squat: 180 * (1 + 3/30) = 198.
    expect(estimateE1rm(180, 3)).toBeCloseTo(198, PRECISION);
    // A 5 x 100kg bench: 100 * 7/6.
    expect(estimateE1rm(100, 5)).toBeCloseTo(116.666666666666667, PRECISION);
  });

  it('returns full precision and does not round for display', () => {
    expect(estimateE1rm(100, 7)).toBeCloseTo(123.333333333333333, PRECISION);
    expect(Number.isInteger(estimateE1rm(100, 7))).toBe(false);
  });
});

describe('input validation', () => {
  const invalidReps = [0, -1, -10, 0.5, 2.5, 21, 37, 100, NaN, Infinity, -Infinity];

  it.each(invalidReps)('rejects %f reps on every exported formula', (reps) => {
    expect(() => epleyE1rm(100, reps)).toThrow(RangeError);
    expect(() => brzyckiE1rm(100, reps)).toThrow(RangeError);
    expect(() => estimateE1rm(100, reps)).toThrow(RangeError);
  });

  const invalidWeights = [0, -1, -100.5, NaN, Infinity, -Infinity];

  it.each(invalidWeights)('rejects a weight of %f on every exported formula', (weight) => {
    expect(() => epleyE1rm(weight, 5)).toThrow(RangeError);
    expect(() => brzyckiE1rm(weight, 5)).toThrow(RangeError);
    expect(() => estimateE1rm(weight, 5)).toThrow(RangeError);
  });

  it('never lets Brzycki reach or cross its pole at 37 reps', () => {
    expect(() => brzyckiE1rm(100, 37)).toThrow(RangeError);
    expect(() => brzyckiE1rm(100, 40)).toThrow(RangeError);
    // ...which is what stops a sign-flipped negative e1RM from ever existing.
    expect(brzyckiE1rm(100, E1RM.MAX_SUPPORTED_REPS)).toBeGreaterThan(0);
  });

  it('explains the accepted rep bounds in the error message', () => {
    expect(() => estimateE1rm(100, 25)).toThrow(/between 1 and 20/);
    expect(() => estimateE1rm(100, 2.5)).toThrow(/whole number/);
    expect(() => estimateE1rm(-5, 3)).toThrow(/greater than 0/);
  });

  it('accepts the exact boundaries', () => {
    expect(() => estimateE1rm(100, E1RM.MIN_REPS)).not.toThrow();
    expect(() => estimateE1rm(100, E1RM.MAX_SUPPORTED_REPS)).not.toThrow();
    expect(() => estimateE1rm(0.5, 1)).not.toThrow();
  });
});

describe('isHighConfidenceRepRange', () => {
  it('is true for 1 through 10 reps', () => {
    for (let reps = 1; reps <= 10; reps += 1) {
      expect(isHighConfidenceRepRange(reps)).toBe(true);
    }
  });

  it('is false above 10 reps, where endurance rather than strength limits the set', () => {
    for (let reps = 11; reps <= 30; reps += 1) {
      expect(isHighConfidenceRepRange(reps)).toBe(false);
    }
  });

  it('is false for non-sets and non-integers', () => {
    expect(isHighConfidenceRepRange(0)).toBe(false);
    expect(isHighConfidenceRepRange(-3)).toBe(false);
    expect(isHighConfidenceRepRange(5.5)).toBe(false);
    expect(isHighConfidenceRepRange(NaN)).toBe(false);
    expect(isHighConfidenceRepRange(Infinity)).toBe(false);
  });

  it('agrees with the constant it is derived from', () => {
    expect(isHighConfidenceRepRange(E1RM.HIGH_CONFIDENCE_MAX_REPS)).toBe(true);
    expect(isHighConfidenceRepRange(E1RM.HIGH_CONFIDENCE_MAX_REPS + 1)).toBe(false);
  });
});
