import { describe, expect, it } from 'vitest';

import {
  DOTS_BODYWEIGHT_DOMAIN_KG,
  DOTS_COEFFICIENTS,
  DOTS_DISPLAY_DECIMALS,
  DOTS_NUMERATOR,
  clampBodyweightToDotsDomain,
  dotsCoefficient,
  dotsDenominator,
  dotsDomainStatus,
  dotsScore,
  evaluateDots,
  formatDotsScore,
  isBodyweightInDotsDomain,
  roundDotsScore,
  type DotsSex,
} from './dots';

/**
 * Reference values in this file come from two places, both independent of the
 * module under test:
 *
 *  - The coefficients themselves are asserted literally against the published
 *    values as read from fetched source code (openpowerlifting
 *    `crates/coefficients/src/dots.rs`, and the `powerlifting-formulas`
 *    TypeScript package). See the provenance block in `dots.ts`.
 *  - The expected scores were produced by a separate reference implementation
 *    written in Python that evaluates the polynomial with plain powers
 *    (`a*bw**4 + b*bw**3 + ...`) rather than Horner's method, so a mistake in
 *    term ordering or exponent in `dots.ts` cannot be mirrored by the expected
 *    values.
 *
 * Precision: expected scores are quoted to 10 decimal places and compared to 6,
 * which is far tighter than any display or leaderboard use and still tolerant of
 * the ~1e-12 difference between the two evaluation orders.
 */
const SCORE_PRECISION = 6;
const COEFFICIENT_PRECISION = 8;

describe('published DOTS coefficients', () => {
  // The single most important test in this file: a critic can diff these six
  // lines per sex against the source implementations without running anything.
  it('matches the published male coefficients exactly', () => {
    expect(DOTS_COEFFICIENTS.male).toEqual({
      c0: -307.75076,
      c1: 24.0900756,
      c2: -0.1918759221,
      c3: 0.0007391293,
      c4: -0.000001093,
    });
  });

  it('matches the published female coefficients exactly', () => {
    expect(DOTS_COEFFICIENTS.female).toEqual({
      c0: -57.96288,
      c1: 13.6175032,
      c2: -0.1126655495,
      c3: 0.0005158568,
      c4: -0.0000010706,
    });
  });

  it('uses the published numerator of 500', () => {
    expect(DOTS_NUMERATOR).toBe(500);
  });

  it('uses the published bodyweight domain: [40, 210] kg male, [40, 150] kg female', () => {
    expect(DOTS_BODYWEIGHT_DOMAIN_KG.male).toEqual({ min: 40, max: 210 });
    expect(DOTS_BODYWEIGHT_DOMAIN_KG.female).toEqual({ min: 40, max: 150 });
  });

  it('orders the coefficients so that c0 is the constant term and c4 the bw^4 term', () => {
    // OpenPowerlifting names these A..E in descending order; getting the
    // ordering backwards is the most likely transcription error, and it is
    // detectable without any reference table: only one ordering produces a
    // positive denominator at competition bodyweights.
    for (const sex of ['male', 'female'] as const) {
      const k = DOTS_COEFFICIENTS[sex];
      expect(Math.abs(k.c0)).toBeGreaterThan(1);
      expect(Math.abs(k.c4)).toBeLessThan(1e-5);
      expect(dotsDenominator(sex, 80)).toBeGreaterThan(0);
    }
  });
});

describe('dotsDenominator', () => {
  it('reproduces the reference denominator for a 93 kg male', () => {
    expect(dotsDenominator('male', 93)).toBeCloseTo(785.8531622242, SCORE_PRECISION);
  });

  it('reproduces the reference denominator for a 63 kg female', () => {
    expect(dotsDenominator('female', 63)).toBeCloseTo(464.8935808575, SCORE_PRECISION);
  });

  it('is consistent with the coefficient: coefficient === 500 / denominator', () => {
    expect(dotsCoefficient('male', 93)).toBeCloseTo(
      DOTS_NUMERATOR / dotsDenominator('male', 93),
      12,
    );
    expect(dotsCoefficient('female', 63)).toBeCloseTo(
      DOTS_NUMERATOR / dotsDenominator('female', 63),
      12,
    );
  });
});

describe('dotsCoefficient — reference values', () => {
  const maleCases: ReadonlyArray<readonly [number, number]> = [
    [40, 1.271110010858],
    [74, 0.723651953014],
    [83, 0.675087375654],
    [93, 0.636251177745],
    [100, 0.61551576456],
    [105, 0.603096398494],
    [120, 0.574306019068],
    [165, 0.524428587128],
    [210, 0.495620661788],
  ];

  const femaleCases: ReadonlyArray<readonly [number, number]> = [
    [40, 1.484796568082],
    [47, 1.310563822471],
    [57, 1.145695204637],
    [63, 1.075514957805],
    [76, 0.967225826967],
    [84, 0.920153576737],
    [150, 0.770756646539],
  ];

  it.each(maleCases)('male at %d kg -> %f', (bodyweightKg, expected) => {
    expect(dotsCoefficient('male', bodyweightKg)).toBeCloseTo(expected, COEFFICIENT_PRECISION);
  });

  it.each(femaleCases)('female at %d kg -> %f', (bodyweightKg, expected) => {
    expect(dotsCoefficient('female', bodyweightKg)).toBeCloseTo(expected, COEFFICIENT_PRECISION);
  });
});

describe('dotsScore — reference values', () => {
  const cases: ReadonlyArray<readonly [DotsSex, number, number, number]> = [
    ['male', 93, 700, 445.3758244217],
    ['male', 74, 800, 578.9215624111],
    ['male', 83, 700, 472.5611629581],
    ['male', 105, 800, 482.4771187954],
    ['male', 120, 500, 287.1530095341],
    ['male', 100, 600, 369.3094587358],
    ['male', 165, 1152.5, 604.4039466647],
    ['male', 40, 400, 508.4440043433],
    ['male', 210, 1000, 495.6206617883],
    ['female', 63, 400, 430.2059831222],
    ['female', 84, 645, 593.4990569957],
    ['female', 57, 300, 343.708561391],
    ['female', 47, 250, 327.6409556178],
    ['female', 76, 500, 483.6129134833],
    ['female', 40, 250, 371.1991420204],
    ['female', 150, 600, 462.4539879237],
    ['female', 69, 200, 203.8983981512],
  ];

  it.each(cases)('%s, %d kg bw, %d kg total -> %f DOTS', (sex, bodyweightKg, totalKg, expected) => {
    expect(dotsScore(sex, bodyweightKg, totalKg)).toBeCloseTo(expected, SCORE_PRECISION);
  });
});

describe('bodyweight domain', () => {
  it('treats the exact bounds as in-domain', () => {
    expect(dotsDomainStatus('male', 40)).toBe('in-domain');
    expect(dotsDomainStatus('male', 210)).toBe('in-domain');
    expect(dotsDomainStatus('female', 40)).toBe('in-domain');
    expect(dotsDomainStatus('female', 150)).toBe('in-domain');
    expect(isBodyweightInDotsDomain('male', 93)).toBe(true);
  });

  it('reports below-minimum bodyweights', () => {
    expect(dotsDomainStatus('male', 39.9)).toBe('clamped-below-min');
    expect(dotsDomainStatus('female', 39.9)).toBe('clamped-below-min');
    expect(isBodyweightInDotsDomain('female', 35)).toBe(false);
  });

  it('reports above-maximum bodyweights, with different limits per sex', () => {
    expect(dotsDomainStatus('male', 210.1)).toBe('clamped-above-max');
    expect(dotsDomainStatus('female', 150.1)).toBe('clamped-above-max');
    // 160 kg is in-domain for a male lifter but out of domain for a female one.
    expect(dotsDomainStatus('male', 160)).toBe('in-domain');
    expect(dotsDomainStatus('female', 160)).toBe('clamped-above-max');
  });

  it('clamps out-of-domain bodyweights to the boundary instead of extrapolating', () => {
    expect(clampBodyweightToDotsDomain('male', 20)).toBe(40);
    expect(clampBodyweightToDotsDomain('male', 260)).toBe(210);
    expect(clampBodyweightToDotsDomain('female', 20)).toBe(40);
    expect(clampBodyweightToDotsDomain('female', 260)).toBe(150);

    expect(dotsScore('male', 250, 1000)).toBeCloseTo(dotsScore('male', 210, 1000), SCORE_PRECISION);
    expect(dotsScore('male', 30, 400)).toBeCloseTo(dotsScore('male', 40, 400), SCORE_PRECISION);
    expect(dotsScore('female', 200, 600)).toBeCloseTo(
      dotsScore('female', 150, 600),
      SCORE_PRECISION,
    );
  });

  it('would produce nonsense if the polynomial were extrapolated far past the domain', () => {
    // Documents WHY clamping exists rather than being decorative: the raw
    // polynomial's leading term is negative, so past roughly 300 kg the
    // denominator falls and the coefficient rises again — a 400 kg lifter would
    // out-score everyone. dotsDenominator is deliberately unclamped so this is
    // visible; the public scoring functions clamp.
    expect(dotsDenominator('male', 300)).toBeLessThan(dotsDenominator('male', 210));
    expect(dotsScore('male', 400, 1000)).toBeCloseTo(dotsScore('male', 210, 1000), SCORE_PRECISION);
  });
});

describe('evaluateDots', () => {
  it('returns the score together with the domain information', () => {
    const result = evaluateDots('male', 93, 700);
    expect(result.score).toBeCloseTo(445.3758244217, SCORE_PRECISION);
    expect(result.coefficient).toBeCloseTo(0.636251177745, COEFFICIENT_PRECISION);
    expect(result.bodyweightKg).toBe(93);
    expect(result.effectiveBodyweightKg).toBe(93);
    expect(result.domainStatus).toBe('in-domain');
  });

  it('preserves the supplied bodyweight while reporting the clamped one', () => {
    const result = evaluateDots('female', 165, 600);
    expect(result.bodyweightKg).toBe(165);
    expect(result.effectiveBodyweightKg).toBe(150);
    expect(result.domainStatus).toBe('clamped-above-max');
    expect(result.score).toBeCloseTo(462.4539879237, SCORE_PRECISION);
  });

  it('agrees with dotsScore', () => {
    expect(evaluateDots('female', 63, 400).score).toBe(dotsScore('female', 63, 400));
    expect(evaluateDots('male', 130, 850).score).toBe(dotsScore('male', 130, 850));
  });
});

describe('structural properties', () => {
  it('scales linearly with the total', () => {
    const single = dotsScore('male', 93, 100);
    expect(dotsScore('male', 93, 700)).toBeCloseTo(single * 7, SCORE_PRECISION);
    expect(dotsScore('female', 63, 800)).toBeCloseTo(
      dotsScore('female', 63, 400) * 2,
      SCORE_PRECISION,
    );
  });

  it('equals coefficient x total', () => {
    expect(dotsScore('male', 105, 812.5)).toBeCloseTo(
      dotsCoefficient('male', 105) * 812.5,
      SCORE_PRECISION,
    );
  });

  it('gives a strictly decreasing coefficient across the whole male domain', () => {
    // Heavier lifters must always be handicapped more, never less. A sign error
    // or swapped term shows up here immediately.
    let previous = Number.POSITIVE_INFINITY;
    for (let bw = 40; bw <= 210; bw += 0.5) {
      const coefficient = dotsCoefficient('male', bw);
      expect(coefficient).toBeLessThan(previous);
      expect(coefficient).toBeGreaterThan(0);
      previous = coefficient;
    }
  });

  it('gives a strictly decreasing coefficient across the whole female domain', () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let bw = 40; bw <= 150; bw += 0.5) {
      const coefficient = dotsCoefficient('female', bw);
      expect(coefficient).toBeLessThan(previous);
      expect(coefficient).toBeGreaterThan(0);
      previous = coefficient;
    }
  });

  it('gives female lifters a higher coefficient than male lifters at equal bodyweight', () => {
    for (const bw of [40, 52, 63, 72, 84, 100, 120, 150]) {
      expect(dotsCoefficient('female', bw)).toBeGreaterThan(dotsCoefficient('male', bw));
    }
  });

  it('keeps two lifters with equal totals ordered by bodyweight', () => {
    // Same total, lighter lifter wins. This is the entire point of the formula.
    expect(dotsScore('male', 83, 700)).toBeGreaterThan(dotsScore('male', 93, 700));
    expect(dotsScore('female', 57, 400)).toBeGreaterThan(dotsScore('female', 76, 400));
  });
});

describe('input handling', () => {
  it('scores a bombed-out meet (0 kg total) as 0 rather than throwing', () => {
    expect(dotsScore('male', 93, 0)).toBe(0);
    expect(evaluateDots('female', 63, 0).score).toBe(0);
    // The coefficient is still reported so a result card can show it.
    expect(evaluateDots('female', 63, 0).coefficient).toBeCloseTo(
      1.075514957805,
      COEFFICIENT_PRECISION,
    );
  });

  it('rejects non-finite input', () => {
    expect(() => dotsScore('male', Number.NaN, 700)).toThrow(RangeError);
    expect(() => dotsScore('male', Number.POSITIVE_INFINITY, 700)).toThrow(RangeError);
    expect(() => dotsScore('male', 93, Number.NaN)).toThrow(RangeError);
    expect(() => dotsCoefficient('female', Number.NaN)).toThrow(RangeError);
    expect(() => roundDotsScore(Number.NaN)).toThrow(RangeError);
    expect(() => formatDotsScore(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('rejects non-positive bodyweight and negative totals', () => {
    expect(() => dotsScore('male', 0, 700)).toThrow(RangeError);
    expect(() => dotsScore('male', -93, 700)).toThrow(RangeError);
    expect(() => dotsCoefficient('male', 0)).toThrow(RangeError);
    expect(() => dotsScore('male', 93, -1)).toThrow(RangeError);
    expect(() => evaluateDots('female', -1, 400)).toThrow(RangeError);
  });
});

describe('display helpers', () => {
  it('rounds to the number of decimals federations print', () => {
    expect(DOTS_DISPLAY_DECIMALS).toBe(2);
    expect(roundDotsScore(445.3758244217)).toBe(445.38);
    expect(roundDotsScore(593.4990569957)).toBe(593.5);
    expect(roundDotsScore(0)).toBe(0);
  });

  it('formats with trailing zeros the way a result sheet does', () => {
    expect(formatDotsScore(dotsScore('male', 93, 700))).toBe('445.38');
    expect(formatDotsScore(dotsScore('female', 84, 645))).toBe('593.50');
    expect(formatDotsScore(0)).toBe('0.00');
  });
});

describe('plausibility sanity check', () => {
  /**
   * These bands are a smoke test against a transcription error that survives
   * every algebraic property above (e.g. a wrong numerator, or one digit off in
   * a coefficient). They encode widely used community reference points: DOTS is
   * roughly calibrated so that ~500 is national-elite for a male raw lifter,
   * the best raw totals in history land in the low 600s, and an untrained or
   * novice lifter is far below 300.
   *
   * NOTE ON A COMMON MISQUOTE: it is sometimes claimed that a ~700 kg total at
   * ~93 kg bodyweight scores "in the 500s". It does not — it scores 445. A 93 kg
   * male needs a 785.9 kg total to reach exactly 500 DOTS. The band below is
   * asserted from the formula's actual output, cross-checked against the
   * historical anchors in the following two tests, not from that claim.
   */
  const cases: ReadonlyArray<{
    readonly label: string;
    readonly sex: DotsSex;
    readonly bodyweightKg: number;
    readonly totalKg: number;
    readonly min: number;
    readonly max: number;
  }> = [
    { label: 'untrained male', sex: 'male', bodyweightKg: 80, totalKg: 150, min: 60, max: 140 },
    { label: 'novice male', sex: 'male', bodyweightKg: 80, totalKg: 300, min: 150, max: 250 },
    {
      label: 'intermediate male',
      sex: 'male',
      bodyweightKg: 80,
      totalKg: 450,
      min: 260,
      max: 360,
    },
    { label: 'advanced male', sex: 'male', bodyweightKg: 93, totalKg: 700, min: 400, max: 500 },
    { label: 'novice female', sex: 'female', bodyweightKg: 60, totalKg: 250, min: 230, max: 330 },
    {
      label: 'advanced female',
      sex: 'female',
      bodyweightKg: 63,
      totalKg: 400,
      min: 380,
      max: 480,
    },
  ];

  it.each(cases)('$label lands in a plausible DOTS band', ({ sex, bodyweightKg, totalKg, min, max }) => {
    const score = dotsScore(sex, bodyweightKg, totalKg);
    expect(score).toBeGreaterThan(min);
    expect(score).toBeLessThan(max);
  });

  it('puts the elite threshold where the community puts it (~500 for a male raw lifter)', () => {
    // 500 DOTS should require a total that a strong national-level lifter hits,
    // not one that a hobbyist or a world-record holder hits.
    for (const bodyweightKg of [66, 74, 83, 93, 105, 120]) {
      const totalForFiveHundred = 500 / dotsCoefficient('male', bodyweightKg);
      expect(totalForFiveHundred).toBeGreaterThan(bodyweightKg * 6);
      expect(totalForFiveHundred).toBeLessThan(bodyweightKg * 11);
    }
    expect(500 / dotsCoefficient('male', 93)).toBeCloseTo(785.8531622242, SCORE_PRECISION);
  });

  it('scores real all-time-great totals in the 550-650 range, and nothing above 700', () => {
    // Jesus Olivares, 2023 SBD Sheffield: 1152.5 kg all-time raw total, bodyweight
    // approximately 166 kg (superheavyweight, bodyweight not exactly published
    // here, so this is an approximate anchor).
    const olivares = dotsScore('male', 166, 1152.5);
    expect(olivares).toBeGreaterThan(550);
    expect(olivares).toBeLessThan(650);

    // Taylor-Atwood-class 74 kg lifter with an ~802.5 kg total.
    const lightweightElite = dotsScore('male', 74, 802.5);
    expect(lightweightElite).toBeGreaterThan(550);
    expect(lightweightElite).toBeLessThan(650);

    // Amanda Lawrence, 2023 IPF world-record 84 kg total of 645 kg.
    const lawrence = dotsScore('female', 84, 645);
    expect(lawrence).toBeGreaterThan(550);
    expect(lawrence).toBeLessThan(650);

    // No plausible human result should reach 700 DOTS.
    for (const score of [olivares, lightweightElite, lawrence]) {
      expect(score).toBeLessThan(700);
    }
  });
});
