import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  DOTS_BODYWEIGHT_DOMAIN_KG,
  DOTS_COEFFICIENTS,
  DOTS_COEFFICIENT_DISPLAY_DECIMALS,
  DOTS_DELTA_NEGATIVE_PREFIX,
  DOTS_DELTA_POSITIVE_PREFIX,
  DOTS_DELTA_ZERO_PREFIX,
  DOTS_DISPLAY_DECIMALS,
  DOTS_NO_TOTAL_DISPLAY,
  DOTS_NUMERATOR,
  DOTS_SMALLEST_PRINTABLE_SCORE,
  applyDotsCoefficient,
  clampBodyweightToDotsDomain,
  compareDotsCoefficients,
  dotsCoefficient,
  dotsDeltaBetween,
  dotsDeltaBetweenScores,
  dotsDenominator,
  dotsDomainStatus,
  dotsScore,
  evaluateDots,
  evaluateMeetDots,
  formatDotsCoefficient,
  formatDotsDelta,
  formatDotsOutcome,
  formatDotsScore,
  hasDotsScore,
  isBodyweightInDotsDomain,
  officialTotalFromMeet,
  officialTotalKg,
  roundDotsDelta,
  roundDotsScore,
  type DotsCoefficient,
  type DotsDelta,
  type DotsOutcome,
  type DotsSex,
  type OfficialTotalKg,
  type ScoredDots,
} from './dots';
import {
  MIN_LOADABLE_WEIGHT_KG,
  createMeet,
  declareAttempt,
  finalMeetTotal,
  readTotal,
  resolveAttempt,
  totalOnTheBoard,
  type JudgePanel,
  type MeetState,
} from './meet';

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

/** A total the caller is asserting is official, as production code would mint one. */
function total(kg: number): OfficialTotalKg {
  return officialTotalKg(kg);
}

/**
 * A one-kilogram official total, used to read a coefficient back as a bare
 * number: a DOTS score at a 1 kg total IS the coefficient, exactly, because
 * `x * 1 === x` in IEEE 754.
 *
 * NAME IT FOR WHAT IT IS. This is not a clever way around the opaque
 * coefficient and it is not "the one honest way" — it is the documented leak.
 * `dots.ts` exports no function NAMED like a numeric accessor, but this
 * three-call route reaches the same number with no cast, which is why it is
 * listed under WHAT IS DELIBERATELY NOT CLOSED there rather than described as
 * impossible. The suite uses it because a reference table has to compare
 * numbers; 'the numeric accessor this module does not export' below executes it
 * deliberately, so this file cannot both depend on the route and let the module
 * claim it does not exist.
 */
const ONE_KG: OfficialTotalKg = officialTotalKg(1);

function coefficientValue(sex: DotsSex, bodyweightKg: number): number {
  return applyDotsCoefficient(dotsCoefficient(sex, bodyweightKg), ONE_KG);
}

/**
 * Shaped exactly like `meet.ts`'s `finalMeetTotal(state): number | null`, which
 * is the function that will feed this module. Written as a function rather than
 * a `const` so TypeScript does not narrow the union away and quietly make the
 * boundary tests below weaker than they look.
 */
function bombedOutMeetTotal(): number | null {
  return null;
}

function finishedMeetTotal(): number | null {
  return 700;
}

/** The same, already minted: what `officialTotalFromMeet` hands back. */
function noOfficialTotal(): OfficialTotalKg | null {
  return null;
}

/**
 * A delta, minted the way a recap mints one from two stored scores. Exists so
 * the tests below read as values rather than as ceremony; the mint's own guards
 * are exercised directly in the exploit block.
 */
function delta(previousScore: number, currentScore: number): DotsDelta {
  return dotsDeltaBetweenScores({ previousScore, currentScore });
}

/** Assert an outcome is the scored branch and narrow to it. Throws if it is not. */
function expectScored(outcome: DotsOutcome): ScoredDots {
  if (!hasDotsScore(outcome)) {
    throw new Error(`expected a scored outcome, got kind="${outcome.kind}"`);
  }
  return outcome;
}

// ---------------------------------------------------------------------------
// Real meets, built with the real engine. The boundary tests below are only
// worth anything if the thing on the other side of the boundary is genuine, so
// these drive `meet.ts` rather than hand-rolling a `TotalReading`.
// ---------------------------------------------------------------------------

const ALL_WHITE: JudgePanel = ['white', 'white', 'white'];
const ALL_RED: JudgePanel = ['red', 'red', 'red'];

function take(state: MeetState, weight: number, lights: JudgePanel): MeetState {
  const declared = declareAttempt(state, { weight });
  if (!declared.ok) throw new Error(`declare ${weight}: ${declared.error.message}`);
  const resolved = resolveAttempt(declared.value, { lights });
  if (!resolved.ok) throw new Error(`resolve ${weight}: ${resolved.error.message}`);
  return resolved.value;
}

/**
 * Squat 200 made, bench 150 made, then all three deadlifts missed: NO TOTAL,
 * with 350 kg sitting on the board. This is the lifter the whole X1 boundary
 * exists for — the fake score is plausible, mid-board, and unmarked.
 */
function bombedMeet(): MeetState {
  let state = createMeet();
  state = take(state, 200, ALL_WHITE);
  state = take(state, 210, ALL_RED);
  state = take(state, 210, ALL_RED);
  state = take(state, 150, ALL_WHITE);
  state = take(state, 160, ALL_RED);
  state = take(state, 160, ALL_RED);
  state = take(state, 200, ALL_RED);
  state = take(state, 200, ALL_RED);
  state = take(state, 200, ALL_RED);
  return state;
}

/** Nine good lifts: 210 + 160 + 260 = 630 kg. */
function completedMeet(): MeetState {
  let state = createMeet();
  for (const weight of [200, 205, 210, 150, 155, 160, 250, 255, 260]) {
    state = take(state, weight, ALL_WHITE);
  }
  return state;
}

/** One good squat in, eight attempts to go. */
function inProgressMeet(): MeetState {
  return take(createMeet(), 200, ALL_WHITE);
}

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
    expect(coefficientValue('male', 93)).toBeCloseTo(DOTS_NUMERATOR / dotsDenominator('male', 93), 12);
    expect(coefficientValue('female', 63)).toBeCloseTo(
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
    expect(coefficientValue('male', bodyweightKg)).toBeCloseTo(expected, COEFFICIENT_PRECISION);
  });

  it.each(femaleCases)('female at %d kg -> %f', (bodyweightKg, expected) => {
    expect(coefficientValue('female', bodyweightKg)).toBeCloseTo(expected, COEFFICIENT_PRECISION);
  });

  it('reports which lifter and which domain it belongs to', () => {
    const coefficient = dotsCoefficient('female', 165);
    expect(coefficient.sex).toBe('female');
    expect(coefficient.bodyweightKg).toBe(165);
    expect(coefficient.effectiveBodyweightKg).toBe(150);
    expect(coefficient.domainStatus).toBe('clamped-above-max');
  });

  it('formats for a result-sheet coefficient column', () => {
    expect(DOTS_COEFFICIENT_DISPLAY_DECIMALS).toBe(4);
    expect(formatDotsCoefficient(dotsCoefficient('male', 93))).toBe('0.6363');
    expect(formatDotsCoefficient(dotsCoefficient('female', 63))).toBe('1.0755');
  });

  it('orders coefficients heaviest-lightest without handing out a number', () => {
    const light = dotsCoefficient('male', 74);
    const heavy = dotsCoefficient('male', 120);
    expect(compareDotsCoefficients(heavy, light)).toBeLessThan(0);
    expect(compareDotsCoefficients(light, heavy)).toBeGreaterThan(0);
    expect(compareDotsCoefficients(light, dotsCoefficient('male', 74))).toBe(0);
  });

  it('rejects a non-finite or non-positive bodyweight', () => {
    expect(() => dotsCoefficient('female', Number.NaN)).toThrow(RangeError);
    expect(() => dotsCoefficient('male', 0)).toThrow(RangeError);
    expect(() => dotsCoefficient('male', -93)).toThrow(RangeError);
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
    expect(dotsScore(sex, bodyweightKg, total(totalKg))).toBeCloseTo(expected, SCORE_PRECISION);
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

    expect(dotsScore('male', 250, total(1000))).toBeCloseTo(
      dotsScore('male', 210, total(1000)),
      SCORE_PRECISION,
    );
    expect(dotsScore('male', 30, total(400))).toBeCloseTo(
      dotsScore('male', 40, total(400)),
      SCORE_PRECISION,
    );
    expect(dotsScore('female', 200, total(600))).toBeCloseTo(
      dotsScore('female', 150, total(600)),
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
    expect(dotsScore('male', 400, total(1000))).toBeCloseTo(
      dotsScore('male', 210, total(1000)),
      SCORE_PRECISION,
    );
  });
});

describe('evaluateDots', () => {
  it('returns the score together with the domain information', () => {
    const result = expectScored(evaluateDots('male', 93, total(700)));
    expect(result.kind).toBe('scored');
    expect(result.score).toBeCloseTo(445.3758244217, SCORE_PRECISION);
    expect(result.bodyweightKg).toBe(93);
    expect(result.effectiveBodyweightKg).toBe(93);
    expect(result.totalKg as number).toBe(700);
    expect(result.domainStatus).toBe('in-domain');
    expect(formatDotsCoefficient(result.coefficient)).toBe('0.6363');
  });

  it('preserves the supplied bodyweight while reporting the clamped one', () => {
    const result = expectScored(evaluateDots('female', 165, total(600)));
    expect(result.bodyweightKg).toBe(165);
    expect(result.effectiveBodyweightKg).toBe(150);
    expect(result.domainStatus).toBe('clamped-above-max');
    expect(result.score).toBeCloseTo(462.4539879237, SCORE_PRECISION);
  });

  it('agrees with dotsScore', () => {
    expect(expectScored(evaluateDots('female', 63, total(400))).score).toBe(
      dotsScore('female', 63, total(400)),
    );
    expect(expectScored(evaluateDots('male', 130, total(850))).score).toBe(
      dotsScore('male', 130, total(850)),
    );
  });

  it('carries the coefficient the score was actually built from', () => {
    const result = expectScored(evaluateDots('male', 93, total(700)));
    expect(applyDotsCoefficient(result.coefficient, total(700))).toBe(result.score);
    expect(compareDotsCoefficients(result.coefficient, dotsCoefficient('male', 93))).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// THE X1 BOUNDARY.
//
// `meet.ts` records a bombed lifter as `total: null` while still reporting a
// large `totalOnTheBoard`, and this module must not turn either of those into a
// score. There are two different fakes to stop:
//
//   A. `finalMeetTotal(state) ?? 0` — a bomb-out collapsed to zero.
//   B. `totalOnTheBoard(state)`     — a provisional sum scored as a result. This
//      one is worse: it lands mid-board at a plausible number.
//
// Every test in this block is one line a caller would plausibly write.
// ---------------------------------------------------------------------------

describe('no total is not a total of zero', () => {
  it('gives a null total a no-total outcome carrying no score at all', () => {
    const outcome = evaluateDots('male', 93, noOfficialTotal());
    expect(outcome.kind).toBe('no-total');
    expect(hasDotsScore(outcome)).toBe(false);
    // Not `score: 0`, not `score: undefined` — the key is simply not there, so
    // nothing downstream can read a score off it or default one into place. Same
    // for the coefficient, which is a score one multiplication away.
    expect('score' in outcome).toBe(false);
    expect('coefficient' in outcome).toBe(false);
    expect(Object.keys(outcome)).not.toContain('score');
    expect(Object.keys(outcome)).not.toContain('coefficient');
    expect(Object.keys(outcome)).not.toContain('totalKg');
  });

  it('still reports the lifter facts that do not depend on having a total', () => {
    const outcome = evaluateDots('female', 165, noOfficialTotal());
    expect(outcome.bodyweightKg).toBe(165);
    expect(outcome.effectiveBodyweightKg).toBe(150);
    expect(outcome.domainStatus).toBe('clamped-above-max');
  });

  it('scores a real total through the same entry point', () => {
    const outcome = expectScored(evaluateDots('male', 93, total(700)));
    expect(outcome.score).toBeCloseTo(445.3758244217, SCORE_PRECISION);
  });

  it('rejects a total of exactly 0 instead of scoring it 0', () => {
    expect(() => officialTotalKg(0)).toThrow(RangeError);
    expect(() => dotsScore('male', 93, total(0))).toThrow(RangeError);
    expect(() => evaluateDots('female', 63, total(0))).toThrow(RangeError);
    // -0 === 0 in JavaScript, so it must take the same path.
    expect(() => officialTotalKg(-0)).toThrow(RangeError);
    expect(() => dotsScore('male', 93, total(-0))).toThrow(RangeError);
  });

  it('names the `?? 0` collapse in the error it throws for a 0 total', () => {
    expect(() => officialTotalKg(0)).toThrow(/\?\? 0/);
    expect(() => officialTotalKg(0)).toThrow(/does not place/);
  });

  it('THE REGRESSION: `finalMeetTotal(state) ?? 0` throws instead of scoring 0.00', () => {
    // This is the exact line a caller joining meet.ts to dots.ts would write.
    const collapsed: number = bombedOutMeetTotal() ?? 0;
    expect(collapsed).toBe(0);

    let produced: number | 'threw' = Number.NaN;
    try {
      produced = dotsScore('male', 93, officialTotalKg(collapsed));
    } catch {
      produced = 'threw';
    }
    expect(produced).toBe('threw');
    expect(typeof produced).not.toBe('number');
  });

  it('rejects an undefined total that sneaks past the type system', () => {
    const sneaked = undefined as unknown as OfficialTotalKg;
    expect(() => dotsScore('male', 93, sneaked)).toThrow(RangeError);
    expect(() => evaluateDots('male', 93, sneaked)).toThrow(RangeError);
    expect(() => applyDotsCoefficient(dotsCoefficient('male', 93), sneaked)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// The four lines a critic found still open. Each one is pinned twice: by a
// `@ts-expect-error` (enforced by `npm run typecheck`, which fails on an UNUSED
// directive, so these tests bite the moment the line starts compiling again) and
// by an assertion about what the line does at runtime.
// ---------------------------------------------------------------------------

describe('the four exploit lines', () => {
  it('EXPLOIT 1a: `coefficient` cannot be read off an un-narrowed outcome', () => {
    const outcome = evaluateDots('male', 93, noOfficialTotal());
    // @ts-expect-error - `coefficient` is on ScoredDots only; NoTotalDots has none.
    const leaked: unknown = outcome.coefficient;
    expect(leaked).toBeUndefined();
  });

  it('EXPLOIT 1b: even a scored lifter`s coefficient cannot be multiplied by a number', () => {
    const scored = expectScored(evaluateDots('male', 93, total(700)));
    const collapsed: number = bombedOutMeetTotal() ?? 0;
    // @ts-expect-error - a DotsCoefficient is an opaque object, not a number.
    const fake: number = scored.coefficient * collapsed;
    // It does not merely fail to compile: there is no number in it to multiply.
    expect(Number.isNaN(fake)).toBe(true);
  });

  it('EXPLOIT 1c: the whole original line does not typecheck at its first term', () => {
    const state = bombedMeet();
    // The line as written by the critic:
    //   evaluateDots('male', 93, finalMeetTotal(state)).coefficient * (finalMeetTotal(state) ?? 0)
    // @ts-expect-error - `number | null` is not `OfficialTotalKg | null`.
    const outcome = evaluateDots('male', 93, finalMeetTotal(state));
    expect(outcome.kind).toBe('no-total');
  });

  it('EXPLOIT 2: `dotsCoefficient(...) * (finalMeetTotal(state) ?? 0)` does not compile', () => {
    const state = bombedMeet();
    expect(finalMeetTotal(state)).toBeNull();
    // @ts-expect-error - a DotsCoefficient is an opaque object, not a number.
    const fake: number = dotsCoefficient('male', 93) * (finalMeetTotal(state) ?? 0);
    expect(Number.isNaN(fake)).toBe(true);
    expect(fake).not.toBe(0);
  });

  it('EXPLOIT 3: `dotsCoefficient(...) * totalOnTheBoard(state)` does not compile', () => {
    const state = bombedMeet();
    // The hazard is live: this lifter really does have a big number on the board
    // and no total at all.
    expect(totalOnTheBoard(state)).toBe(350);
    expect(finalMeetTotal(state)).toBeNull();

    // @ts-expect-error - a DotsCoefficient is an opaque object, not a number.
    const fake: number = dotsCoefficient('male', 93) * totalOnTheBoard(state);
    // Before this fix the same line returned ~222.69 — a plausible mid-board
    // DOTS score for a lifter who did not place.
    expect(Number.isNaN(fake)).toBe(true);
    expect(fake).not.toBeCloseTo(222.687912, SCORE_PRECISION);
  });

  it('EXPLOIT 3b: a provisional board sum is not an official total anywhere', () => {
    const state = bombedMeet();
    // @ts-expect-error - `number` is not `OfficialTotalKg`: the board sum is provisional.
    const viaScore = dotsScore('male', 93, totalOnTheBoard(state));
    // @ts-expect-error - `number` is not `OfficialTotalKg`.
    const viaEvaluate = evaluateDots('male', 93, totalOnTheBoard(state));
    // @ts-expect-error - the checked mint takes a reading, not a number.
    const viaMint = officialTotalFromMeet(totalOnTheBoard(state));

    // A brand is erased at runtime, so these still COMPUTE if you force them
    // past the compiler. What changed is that nobody can write them by accident:
    // the typecheck fails, which is why `npm run typecheck` is part of the gate.
    expect(viaScore).toBeGreaterThan(0);
    expect(viaEvaluate.kind).toBe('scored');
    expect(viaMint).toBeNull();
  });

  it('EXPLOIT 4: a negative DOTS delta renders instead of throwing', () => {
    // GDD §6.5 recap PR call-outs are deltas, and a delta may be negative.
    // `roundDotsScore(-2.31)` still refuses — a SCORE is not a delta — but the
    // refusal now names the helpers that do the job.
    expect(roundDotsDelta(delta(400, 397.69)) as number).toBe(-2.31);
    expect(formatDotsDelta(delta(400, 397.69))).toBe('−2.31');
    expect(() => roundDotsScore(-2.31)).toThrow(/delta/);
  });

  it('EXPLOIT 5: a lifter who did not total cannot be rendered as a negative delta', () => {
    // The delta path was the last place the collapse still compiled. The guard
    // covered ONE operand: `hasDotsScore(o) ? o.score : 0` is honest on the end
    // that scored and quietly zero on the end that did not, and the subtraction
    // used to hand `formatDotsDelta` a plain number.
    const before = evaluateDots('male', 93, total(700));
    const now = evaluateDots('male', 93, noOfficialTotal()); // bombed out
    expect(now.kind).toBe('no-total');

    const b: number = hasDotsScore(before) ? before.score : 0;
    const n: number = hasDotsScore(now) ? now.score : 0;
    expect(b).toBeCloseTo(445.3758244217, SCORE_PRECISION);
    expect(n).toBe(0);

    // @ts-expect-error - a bare subtraction is a `number`, not a minted DotsDelta.
    const laundered: string = formatDotsDelta(n - b);
    // A brand is erased at runtime, so forcing it past the compiler still
    // prints — and what it prints is this, which is why the compile error IS
    // the fix. Before the brand, this line compiled clean.
    expect(laundered).toBe('−445.38');

    // The obvious rewrite — route the same two numbers through the mint —
    // throws instead of printing, because 0 is not a DOTS score.
    expect(() => dotsDeltaBetweenScores({ previousScore: b, currentScore: n })).toThrow(RangeError);
    expect(() => dotsDeltaBetweenScores({ previousScore: b, currentScore: n })).toThrow(
      /did not total/,
    );
  });

  it('EXPLOIT 5b: an un-narrowed outcome is not an end of a delta', () => {
    const previous = evaluateDots('male', 93, total(700));
    const current = evaluateDots('male', 93, noOfficialTotal());

    // @ts-expect-error - a DotsOutcome is not a ScoredDots; NoTotalDots has no score.
    expect(() => dotsDeltaBetween({ previous, current })).toThrow(RangeError);

    // The honest rewrite: no delta at all for a lifter who was never on the
    // board — not a zero one, and not a −445.38 one.
    const recapCallOut =
      hasDotsScore(previous) && hasDotsScore(current)
        ? formatDotsDelta(dotsDeltaBetween({ previous, current }))
        : null;
    expect(recapCallOut).toBeNull();
  });

  it('EXPLOIT 4b: `formatDotsScore(0.004)` no longer launders a zero', () => {
    // The old guard was about the SIGN, so 0.004 sailed through it and printed
    // the one string a DOTS column must never show for a lifter who did not
    // total. The check is now about what the number ROUNDS to.
    expect(() => formatDotsScore(0.004)).toThrow(RangeError);
    expect(() => formatDotsScore(0.004)).toThrow(/0\.00/);
    expect(() => roundDotsScore(0.004)).toThrow(RangeError);
  });
});

describe('COMPILE-TIME assertions on the module boundary', () => {
  // `@ts-expect-error` is a real assertion here, not a comment: `tsc --noEmit`
  // fails with "Unused '@ts-expect-error' directive" if any of these lines ever
  // starts compiling.

  it('a `number | null` total will not typecheck as a dotsScore total', () => {
    // @ts-expect-error - a possibly-missing total must go through the mints.
    expect(() => dotsScore('male', 93, bombedOutMeetTotal())).toThrow(RangeError);
  });

  it('a bare `number` will not typecheck as a dotsScore total either', () => {
    // This is the escape the old signature left open: the `?? 0` that got past
    // the null check used to compile and throw. Now it does not compile.
    // @ts-expect-error - `number` is not `OfficialTotalKg`.
    expect(() => dotsScore('male', 93, finishedMeetTotal() ?? 0)).not.toThrow();
  });

  it('a `number | null` total will not typecheck at the null-aware entry point', () => {
    // @ts-expect-error - route a meet reading through evaluateMeetDots instead.
    expect(evaluateDots('male', 93, finishedMeetTotal()).kind).toBe('scored');
  });

  it('`.score` cannot be read off an outcome that was not narrowed', () => {
    const outcome = evaluateDots('male', 93, noOfficialTotal());
    // @ts-expect-error - `score` does not exist on the no-total branch.
    const leaked: unknown = outcome.score;
    expect(leaked).toBeUndefined();
  });

  it('a coefficient cannot be multiplied by a plain number, in either direction', () => {
    const coefficient = dotsCoefficient('male', 93);
    // @ts-expect-error - opaque object on the left.
    const left: number = coefficient * 700;
    // @ts-expect-error - opaque object on the right.
    const right: number = 700 * coefficient;
    expect(Number.isNaN(left)).toBe(true);
    expect(Number.isNaN(right)).toBe(true);
  });

  it('a coefficient has no numeric property to reach for instead', () => {
    const coefficient = dotsCoefficient('male', 93);
    // @ts-expect-error - the value lives under a module-private symbol.
    const reached: unknown = coefficient.value;
    // @ts-expect-error - and it is not called `coefficient` either.
    const alsoReached: unknown = coefficient.coefficient;
    expect(reached).toBeUndefined();
    expect(alsoReached).toBeUndefined();
    // The only enumerable-by-name numbers on it are bodyweights, which cannot
    // be mistaken for a score.
    expect(Object.keys(coefficient).sort()).toEqual([
      'bodyweightKg',
      'domainStatus',
      'effectiveBodyweightKg',
      'sex',
    ]);
  });

  it('applyDotsCoefficient refuses a raw number as the total', () => {
    // @ts-expect-error - the one multiplication demands a minted total.
    expect(() => applyDotsCoefficient(dotsCoefficient('male', 93), 700)).not.toThrow();
  });

  it('a bare number is not a delta, at either delta helper', () => {
    // These two lines also pin the GDD §6.5 call-outs on the exact literals the
    // spec names: a brand is erased at runtime, so the values still format the
    // documented way — they just cannot be written without minting first.
    // @ts-expect-error - a delta must be minted from two ends that scored.
    expect(formatDotsDelta(12.4)).toBe('+12.40');
    // @ts-expect-error - same at the rounder.
    expect(roundDotsDelta(-0.001)).toBe(-0);
  });

  it('a delta cannot be minted from one end that scored and one that did not', () => {
    const scored = expectScored(evaluateDots('male', 93, total(700)));
    const bombed = evaluateDots('male', 93, noOfficialTotal());
    // @ts-expect-error - NoTotalDots is not a ScoredDots, in the `current` slot.
    expect(() => dotsDeltaBetween({ previous: scored, current: bombed })).toThrow(RangeError);
    // @ts-expect-error - nor in the `previous` slot.
    expect(() => dotsDeltaBetween({ previous: bombed, current: scored })).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// THE DISCLOSED LEAK, EXECUTED.
//
// `dots.ts` lists under WHAT IS DELIBERATELY NOT CLOSED that a coefficient's
// number IS reachable, and names the route. These tests run that route, so the
// disclosure is a pinned behaviour rather than a claim about one. Two ways it
// can now break, both loud:
//
//   - someone closes the route: these fail, and the header has to be rewritten
//     to say so (as does `ONE_KG` at the top of this file, which uses it).
//   - someone re-adds a "hands out no bare multiplicand" sentence: the source
//     scan in 'module purity' fails.
//
// What replaced a name-grep. The old check grepped the source for two function
// names and called that "hands out no numeric coefficient accessor" — a claim it
// had no way to test, and one this file's own `ONE_KG` helper contradicted at
// the top of the same file.
// ---------------------------------------------------------------------------

describe('the numeric accessor this module does not export', () => {
  it('DISCLOSED, NOT CLOSED: a 1 kg official total hands the coefficient back as a bare number', () => {
    const coefficient = dotsCoefficient('male', 93);

    // Two lines. No cast, no `any`, no `?? 0` — and it typechecks.
    const bare: number = applyDotsCoefficient(coefficient, officialTotalKg(1));

    // Exactly the coefficient, not approximately: `x * 1 === x` in IEEE 754.
    // The right-hand side is rebuilt from the exported published constants, so
    // this is not the module agreeing with itself through a single function.
    expect(bare).toBe(DOTS_NUMERATOR / dotsDenominator('male', 93));
    // ...and it is the same number the display helper merely rounds.
    expect(bare.toFixed(DOTS_COEFFICIENT_DISPLAY_DECIMALS)).toBe(
      formatDotsCoefficient(coefficient),
    );

    // Once it is a `number` it multiplies, which is the entire hazard. This is
    // the fake mid-board score for a bombed lifter with 360 kg on the board,
    // rebuilt from outside the module in one more line.
    const boardSumOfABombedLifter = 360;
    expect(formatDotsScore(bare * boardSumOfABombedLifter)).toBe('229.05');
  });

  it('costs an explicit officialTotalKg(...), which is the whole of what the opaque object buys', () => {
    const coefficient = dotsCoefficient('male', 93);
    // @ts-expect-error - the leak is not free: a bare 1 is not an OfficialTotalKg.
    const withoutTheMint: number = applyDotsCoefficient(coefficient, 1);
    // A brand is erased at runtime, so forced past the compiler it computes the
    // same number. What cannot be WRITTEN is the version with no claim in it —
    // the mint call is the assertion, and it is greppable.
    expect(withoutTheMint).toBe(applyDotsCoefficient(coefficient, ONE_KG));

    // The arithmetic route — the one glue code actually reaches for — stays shut
    // at RUNTIME as well as in the type checker: the object defines no `valueOf`,
    // so a coefficient coerces to NaN rather than to its own value. Adding one
    // would make `coefficient * total` compute the collapse behind the compile
    // error. (The compile error itself is pinned in 'a coefficient cannot be
    // multiplied by a plain number, in either direction'.)
    expect(Number(coefficient)).toBeNaN();
  });

  it('DISCLOSED: the private symbol is private to typechecking, not to reflection', () => {
    const coefficient = dotsCoefficient('male', 93);
    const symbols = Object.getOwnPropertySymbols(coefficient);
    expect(symbols.map((s) => s.description)).toEqual(['dots.coefficient']);

    const key = symbols[0];
    if (key === undefined) {
      throw new Error('the coefficient carries no symbol-keyed value');
    }
    // This route needs a cast, so it belongs with the cast bullet in the header
    // — but the cast is to a plain index signature rather than to a brand, and
    // it does not require knowing the symbol's identity in advance.
    const reflected = (coefficient as unknown as Record<symbol, number>)[key];
    expect(reflected).toBe(applyDotsCoefficient(coefficient, ONE_KG));
  });
});

// ---------------------------------------------------------------------------
// The other side of the boundary, driven for real.
// ---------------------------------------------------------------------------

describe('scoring an actual meet through meet.ts', () => {
  it('scores a finished meet from its reading', () => {
    const state = completedMeet();
    const reading = readTotal(state);
    expect(reading.kind).toBe('final');
    expect(reading.total).toBe(630);

    const outcome = expectScored(evaluateMeetDots('male', 93, reading));
    expect(outcome.totalKg as number).toBe(630);
    expect(outcome.score).toBeCloseTo(dotsScore('male', 93, total(630)), SCORE_PRECISION);
    expect(formatDotsOutcome(outcome)).toBe('400.84');
  });

  it('gives a bombed-out meet no score, with the board sum still sitting there', () => {
    const state = bombedMeet();
    const reading = readTotal(state);
    expect(reading.kind).toBe('no-total');
    expect(reading.total).toBeNull();
    expect(reading.totalOnTheBoard).toBe(350);

    const outcome = evaluateMeetDots('male', 93, reading);
    expect(outcome.kind).toBe('no-total');
    expect(hasDotsScore(outcome)).toBe(false);
    expect(formatDotsOutcome(outcome)).toBe(DOTS_NO_TOTAL_DISPLAY);
    // ...and the row still renders: this is why DotsLifterContext exists.
    expect(outcome.bodyweightKg).toBe(93);
    expect(outcome.domainStatus).toBe('in-domain');
  });

  it('gives a meet still in progress no score either', () => {
    const state = inProgressMeet();
    const reading = readTotal(state);
    expect(reading.kind).toBe('in-progress');
    expect(reading.totalOnTheBoard).toBe(200);

    expect(officialTotalFromMeet(reading)).toBeNull();
    expect(evaluateMeetDots('male', 93, reading).kind).toBe('no-total');
  });

  it('pins the structural match with meet.ts`s TotalReading', () => {
    // If `TotalReading` ever changes shape — a renamed discriminant, a fourth
    // case, a widened `total` — this stops compiling, which is the point: dots.ts
    // mirrors that type structurally rather than importing it.
    for (const state of [completedMeet(), bombedMeet(), inProgressMeet()]) {
      const minted = officialTotalFromMeet(readTotal(state));
      expect(minted === null || minted > 0).toBe(true);
    }
  });

  it('keeps a bombed lifter off the board a real meet produced', () => {
    const field: readonly DotsOutcome[] = [
      evaluateMeetDots('male', 93, readTotal(completedMeet())),
      evaluateMeetDots('male', 74, readTotal(bombedMeet())),
    ];
    const board = field.filter(hasDotsScore);
    expect(board).toHaveLength(1);
    expect(board.map((entry) => entry.bodyweightKg)).toEqual([93]);
  });
});

describe('a lifter with no total is absent from the ranking, not last in it', () => {
  it('drops out of a DOTS board rather than sorting to the bottom of it', () => {
    const field: readonly DotsOutcome[] = [
      evaluateDots('male', 93, total(700)),
      evaluateDots('male', 83, total(500)),
      evaluateDots('male', 74, noOfficialTotal()),
    ];

    const board = field.filter(hasDotsScore).sort((a, b) => b.score - a.score);

    expect(board).toHaveLength(2);
    expect(board.map((entry) => entry.totalKg as number)).toEqual([700, 500]);
    // The bombed lifter is not on the board at all — not in last place on it.
    expect(board.map((entry) => entry.bodyweightKg)).not.toContain(74);
  });

  it('prints a no-total lifter as the placeholder, never as 0.00', () => {
    const bombed = evaluateDots('male', 93, noOfficialTotal());
    expect(formatDotsOutcome(bombed)).toBe(DOTS_NO_TOTAL_DISPLAY);
    expect(formatDotsOutcome(bombed)).not.toBe('0.00');
    expect(formatDotsOutcome(bombed)).not.toMatch(/\d/);
    expect(formatDotsOutcome(evaluateDots('male', 93, total(700)))).toBe('445.38');
  });
});

describe('structural properties', () => {
  it('scales linearly with the total', () => {
    const single = dotsScore('male', 93, total(100));
    expect(dotsScore('male', 93, total(700))).toBeCloseTo(single * 7, SCORE_PRECISION);
    expect(dotsScore('female', 63, total(800))).toBeCloseTo(
      dotsScore('female', 63, total(400)) * 2,
      SCORE_PRECISION,
    );
  });

  it('equals coefficient x total', () => {
    expect(dotsScore('male', 105, total(812.5))).toBeCloseTo(
      applyDotsCoefficient(dotsCoefficient('male', 105), total(812.5)),
      SCORE_PRECISION,
    );
  });

  it('gives a strictly decreasing coefficient across the whole male domain', () => {
    // Heavier lifters must always be handicapped more, never less. A sign error
    // or swapped term shows up here immediately.
    let previous: DotsCoefficient | null = null;
    for (let bw = 40; bw <= 210; bw += 0.5) {
      const coefficient = dotsCoefficient('male', bw);
      if (previous !== null) {
        expect(compareDotsCoefficients(coefficient, previous)).toBeLessThan(0);
      }
      expect(coefficientValue('male', bw)).toBeGreaterThan(0);
      previous = coefficient;
    }
    expect(previous).not.toBeNull();
  });

  it('gives a strictly decreasing coefficient across the whole female domain', () => {
    let previous: DotsCoefficient | null = null;
    for (let bw = 40; bw <= 150; bw += 0.5) {
      const coefficient = dotsCoefficient('female', bw);
      if (previous !== null) {
        expect(compareDotsCoefficients(coefficient, previous)).toBeLessThan(0);
      }
      expect(coefficientValue('female', bw)).toBeGreaterThan(0);
      previous = coefficient;
    }
    expect(previous).not.toBeNull();
  });

  it('gives female lifters a higher coefficient than male lifters at equal bodyweight', () => {
    for (const bw of [40, 52, 63, 72, 84, 100, 120, 150]) {
      expect(
        compareDotsCoefficients(dotsCoefficient('female', bw), dotsCoefficient('male', bw)),
      ).toBeGreaterThan(0);
    }
  });

  it('keeps two lifters with equal totals ordered by bodyweight', () => {
    // Same total, lighter lifter wins. This is the entire point of the formula.
    expect(dotsScore('male', 83, total(700))).toBeGreaterThan(dotsScore('male', 93, total(700)));
    expect(dotsScore('female', 57, total(400))).toBeGreaterThan(
      dotsScore('female', 76, total(400)),
    );
  });
});

describe('input handling', () => {
  it('rejects non-finite input', () => {
    expect(() => dotsScore('male', Number.NaN, total(700))).toThrow(RangeError);
    expect(() => dotsScore('male', Number.POSITIVE_INFINITY, total(700))).toThrow(RangeError);
    expect(() => officialTotalKg(Number.NaN)).toThrow(RangeError);
    expect(() => officialTotalKg(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => dotsCoefficient('female', Number.NaN)).toThrow(RangeError);
    expect(() => roundDotsScore(Number.NaN)).toThrow(RangeError);
    // A non-finite delta is only reachable through a cast now, which is exactly
    // what the docstring says. The guard is kept, and pinned, for that case.
    expect(() => roundDotsDelta(Number.NaN as DotsDelta)).toThrow(RangeError);
    expect(() => formatDotsDelta(Number.NEGATIVE_INFINITY as DotsDelta)).toThrow(RangeError);
    expect(() => formatDotsScore(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('rejects non-positive bodyweight and non-positive totals', () => {
    expect(() => dotsScore('male', 0, total(700))).toThrow(RangeError);
    expect(() => dotsScore('male', -93, total(700))).toThrow(RangeError);
    expect(() => dotsCoefficient('male', 0)).toThrow(RangeError);
    expect(() => officialTotalKg(-1)).toThrow(RangeError);
    expect(() => evaluateDots('female', -1, total(400))).toThrow(RangeError);
    // A bad bodyweight is caught even when the lifter has no total to score.
    expect(() => evaluateDots('female', 0, noOfficialTotal())).toThrow(RangeError);
    expect(() => evaluateMeetDots('female', 0, readTotal(bombedMeet()))).toThrow(RangeError);
  });
});

describe('display helpers', () => {
  it('rounds to the number of decimals federations print', () => {
    expect(DOTS_DISPLAY_DECIMALS).toBe(2);
    expect(roundDotsScore(445.3758244217)).toBe(445.38);
    expect(roundDotsScore(593.4990569957)).toBe(593.5);
  });

  it('formats with trailing zeros the way a result sheet does', () => {
    expect(formatDotsScore(dotsScore('male', 93, total(700)))).toBe('445.38');
    expect(formatDotsScore(dotsScore('female', 84, total(645)))).toBe('593.50');
  });

  it('refuses to render a score of 0, which no real result can produce', () => {
    // The last place a bomb-out could be laundered into a number is the display
    // layer: `formatDotsScore(outcome.kind === 'scored' ? outcome.score : 0)`.
    expect(() => roundDotsScore(0)).toThrow(RangeError);
    expect(() => formatDotsScore(0)).toThrow(RangeError);
    expect(() => formatDotsScore(-0)).toThrow(RangeError);
    expect(() => roundDotsScore(-1)).toThrow(RangeError);
    expect(() => formatDotsScore(-1)).toThrow(RangeError);
  });

  it('refuses anything that would ROUND to 0.00, not just anything negative', () => {
    expect(DOTS_SMALLEST_PRINTABLE_SCORE).toBe(0.005);
    expect(() => formatDotsScore(DOTS_SMALLEST_PRINTABLE_SCORE / 2)).toThrow(RangeError);
    expect(() => formatDotsScore(0.0049)).toThrow(RangeError);
    expect(() => roundDotsScore(0.0001)).toThrow(RangeError);
    // At the threshold it prints, and what it prints is not zero.
    expect(formatDotsScore(DOTS_SMALLEST_PRINTABLE_SCORE)).toBe('0.01');
    expect(formatDotsScore(0.006)).toBe('0.01');
  });

  it('never lets formatDotsScore return the string "0.00"', () => {
    // Property-style sweep over the whole neighbourhood of zero: every value
    // either throws or prints something that is not "0.00".
    for (let i = -50; i <= 50; i += 1) {
      const candidate = i / 1000;
      let printed: string | 'threw';
      try {
        printed = formatDotsScore(candidate);
      } catch {
        printed = 'threw';
      }
      expect(printed).not.toBe('0.00');
    }
  });
});

describe('DOTS deltas (GDD §6.5 recap call-outs)', () => {
  it('signs a delta explicitly, from the rounded value', () => {
    expect(DOTS_DELTA_POSITIVE_PREFIX).toBe('+');
    expect(DOTS_DELTA_NEGATIVE_PREFIX).toBe('−');
    expect(DOTS_DELTA_ZERO_PREFIX).toBe('');
    expect(formatDotsDelta(delta(400, 412.4))).toBe('+12.40');
    expect(formatDotsDelta(delta(400, 412.437))).toBe('+12.44');
    expect(formatDotsDelta(delta(400, 397.69))).toBe('−2.31');
    expect(formatDotsDelta(delta(400, 397.6851))).toBe('−2.31');
  });

  it('prints a delta that rounds to zero unsigned, never as "−0.00"', () => {
    expect(formatDotsDelta(delta(400, 400))).toBe('0.00');

    // The GDD call-out names the literal -0.001, and a minted delta can be
    // exactly that: 0.006 - 0.007 is exactly -0.001 in IEEE 754, where
    // 399.999 - 400 is only approximately it. Both ends are legal operands —
    // tiny, but they round to "0.01", not "0.00", which is the module's own
    // definition of a printable score.
    const exactlyMinusOneThousandth = delta(0.007, 0.006);
    expect(exactlyMinusOneThousandth as number).toBe(-0.001);
    expect(formatDotsDelta(exactlyMinusOneThousandth)).toBe('0.00');
    expect(formatDotsDelta(delta(0.006, 0.007))).toBe('0.00');

    expect(formatDotsDelta(delta(400, 399.999))).toBe('0.00');
    expect(formatDotsDelta(delta(400, 399.996))).not.toContain(DOTS_DELTA_NEGATIVE_PREFIX);
  });

  it('never prints "−0.00" anywhere in the neighbourhood of zero', () => {
    // Property-style sweep, mirroring the one over formatDotsScore: every
    // minted delta within ±0.05 of zero prints with the right sign, and the
    // ones that round away print unsigned rather than as a negative zero.
    for (let i = -50; i <= 50; i += 1) {
      const printed = formatDotsDelta(delta(400, 400 + i / 1000));
      expect(printed).not.toBe('−0.00');
      expect(printed).not.toBe('-0.00');
      if (Math.abs(i) < 5) {
        expect(printed).toBe('0.00');
      }
    }
  });

  it('rounds a delta without judging its sign', () => {
    expect(roundDotsDelta(delta(400, 412.4)) as number).toBe(12.4);
    expect(roundDotsDelta(delta(400, 397.686)) as number).toBe(-2.31);
    expect(roundDotsDelta(delta(400, 400)) as number).toBe(0);
  });

  it('is what a recap actually computes: two meets, both scored', () => {
    const previous = expectScored(evaluateDots('male', 93, total(700)));
    const current = expectScored(evaluateDots('male', 93, total(720)));
    expect(formatDotsDelta(dotsDeltaBetween({ previous, current }))).toBe('+12.73');
    expect(formatDotsDelta(dotsDeltaBetween({ previous: current, current: previous }))).toBe(
      '−12.73',
    );
  });

  it('agrees with the raw-score mint, so neither route is the odd one out', () => {
    const previous = expectScored(evaluateDots('male', 93, total(700)));
    const current = expectScored(evaluateDots('male', 93, total(720)));
    expect(dotsDeltaBetween({ previous, current }) as number).toBe(
      delta(previous.score, current.score) as number,
    );
  });

  it('refuses an end that is not a real score, in either position', () => {
    expect(() => delta(445.38, 0)).toThrow(RangeError);
    expect(() => delta(0, 445.38)).toThrow(RangeError);
    expect(() => delta(445.38, -12)).toThrow(RangeError);
    expect(() => delta(Number.NaN, 445.38)).toThrow(RangeError);
    expect(() => delta(445.38, Number.POSITIVE_INFINITY)).toThrow(RangeError);
    // Same rule as a printable score: 0.004 rounds to "0.00", so it is not one.
    expect(() => delta(445.38, 0.004)).toThrow(RangeError);
    // ...and the message names the position, so the caller knows which end.
    expect(() => delta(445.38, 0)).toThrow(/currentScore/);
    expect(() => delta(0, 445.38)).toThrow(/previousScore/);
  });

  it('THE STRUCTURAL MINT CAN THROW ON A CALL THAT TYPECHECKS, so its docstring may not say otherwise', () => {
    // `dotsDeltaBetween` used to claim "on a call that typechecks it cannot
    // throw". `ScoredDots` means "this lifter has a score", not "this score is
    // printable", and the two come apart the moment a caller mints an absurd
    // total. Nothing in this test is a cast and nothing is `@ts-expect-error`-ed:
    // it compiles clean, and it still throws.
    const absurd = expectScored(evaluateDots('male', 93, total(0.004)));
    const other = expectScored(evaluateDots('male', 93, total(0.005)));
    expect(absurd.score).toBeLessThan(DOTS_SMALLEST_PRINTABLE_SCORE);

    expect(() => dotsDeltaBetween({ previous: absurd, current: other })).toThrow(RangeError);
    expect(() => dotsDeltaBetween({ previous: absurd, current: other })).toThrow(/previousScore/);

    // Refusing it is correct — a score that rounds to "0.00" is the shape the
    // collapse takes — so this is a docstring defect, not a behaviour defect.
    // The reason it never fires in practice is a fact about `meet.ts`, not about
    // the type: the smallest total a finished meet can record is three attempts
    // at MIN_LOADABLE_WEIGHT_KG (25 kg), and even the smallest coefficient in
    // the published domain turns 75 kg into a score far above the guard.
    const smallestMeetScore = dotsScore(
      'male',
      DOTS_BODYWEIGHT_DOMAIN_KG.male.max,
      total(3 * MIN_LOADABLE_WEIGHT_KG),
    );
    expect(smallestMeetScore).toBeGreaterThan(37);
    expect(smallestMeetScore).toBeLessThan(38);
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
    const score = dotsScore(sex, bodyweightKg, total(totalKg));
    expect(score).toBeGreaterThan(min);
    expect(score).toBeLessThan(max);
  });

  it('puts the elite threshold where the community puts it (~500 for a male raw lifter)', () => {
    // 500 DOTS should require a total that a strong national-level lifter hits,
    // not one that a hobbyist or a world-record holder hits.
    for (const bodyweightKg of [66, 74, 83, 93, 105, 120]) {
      const totalForFiveHundred = 500 / coefficientValue('male', bodyweightKg);
      expect(totalForFiveHundred).toBeGreaterThan(bodyweightKg * 6);
      expect(totalForFiveHundred).toBeLessThan(bodyweightKg * 11);
    }
    expect(500 / coefficientValue('male', 93)).toBeCloseTo(785.8531622242, SCORE_PRECISION);
  });

  it('scores real all-time-great totals in the 550-650 range, and nothing above 700', () => {
    // Jesus Olivares, 2023 SBD Sheffield: 1152.5 kg all-time raw total, bodyweight
    // approximately 166 kg (superheavyweight, bodyweight not exactly published
    // here, so this is an approximate anchor).
    const olivares = dotsScore('male', 166, total(1152.5));
    expect(olivares).toBeGreaterThan(550);
    expect(olivares).toBeLessThan(650);

    // Taylor-Atwood-class 74 kg lifter with an ~802.5 kg total.
    const lightweightElite = dotsScore('male', 74, total(802.5));
    expect(lightweightElite).toBeGreaterThan(550);
    expect(lightweightElite).toBeLessThan(650);

    // Amanda Lawrence, 2023 IPF world-record 84 kg total of 645 kg.
    const lawrence = dotsScore('female', 84, total(645));
    expect(lawrence).toBeGreaterThan(550);
    expect(lawrence).toBeLessThan(650);

    // No plausible human result should reach 700 DOTS.
    for (const score of [olivares, lightweightElite, lawrence]) {
      expect(score).toBeLessThan(700);
    }
  });
});

// ---------------------------------------------------------------------------
// Purity — the module's own source is the artifact under test here, matching the
// scans in meet.test.ts and streak.test.ts.
// ---------------------------------------------------------------------------

describe('module purity', () => {
  const source = readFileSync(fileURLToPath(new URL('./dots.ts', import.meta.url)), 'utf8');
  // Comments are stripped so the header's own prose does not satisfy the code
  // scans. The sanity assertion below proves the strip left real code.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('strips comments without destroying the code (sanity check for the scans below)', () => {
    expect(code).toContain('export function dotsScore');
    expect(code).toContain('export function evaluateMeetDots');
    expect(code).not.toContain('Tim Konertz');
  });

  it('has no imports at all, so it cannot reach React, I/O or sibling modules', () => {
    // It mirrors meet.ts's `TotalReading` structurally rather than importing it;
    // `officialTotalFromMeet` is tested against the real thing above.
    expect(code).not.toMatch(/^\s*import\s/m);
    expect(code).not.toMatch(/\brequire\s*\(/);
  });

  it('reads no clock, rolls no dice, and touches no ambient global', () => {
    expect(code).not.toMatch(/\bDate\b/);
    expect(code).not.toMatch(/Math\s*\.\s*random/);
    expect(code).not.toMatch(/performance\s*\./);
    expect(code).not.toMatch(/\bprocess\s*\./);
    expect(code).not.toMatch(/\bglobalThis\b/);
    expect(code).not.toMatch(/console\s*\./);
  });

  it('exports no function NAMED like a numeric coefficient accessor — a name scan, nothing more', () => {
    // WHAT THIS CHECK IS WORTH, SAID OUT LOUD: it greps for two identifiers. It
    // cannot see behaviour, and it does NOT establish that a coefficient's value
    // is unreachable — it is reachable, via
    // `applyDotsCoefficient(c, officialTotalKg(1))`, which needs no cast. Under
    // its old name ('hands out no numeric coefficient accessor') this test read
    // as a guarantee it had no way to make, while the counterexample sat at the
    // top of this very file (see `ONE_KG`).
    //
    // The route is asserted for real, by executing it, in 'the numeric accessor
    // this module does not export'. All this one defends is the published API
    // surface: nobody gets to add a one-call accessor with a name that advertises
    // itself.
    expect(code).not.toMatch(/export\s+function\s+dotsCoefficientValue/);
    expect(code).not.toMatch(/export\s+function\s+\w*[Cc]oefficientNumber/);
  });

  it('describes its own load-time evaluation without understating it', () => {
    // The header used to say the ONE thing evaluated at load was a `Symbol(...)`,
    // which overlooked two object literals and the arithmetic in
    // `DOTS_SMALLEST_PRINTABLE_SCORE`. A purity contract that miscounts its own
    // load-time work is the same defect class as an overstated guarantee.
    expect(source).not.toMatch(/The one thing\s+\*?\s*evaluated at load/);
    expect(source).toMatch(/Load-time\n?\s*\*?\s*evaluation is/);
    expect(code).toMatch(/DOTS_SMALLEST_PRINTABLE_SCORE = 0\.5 \/ 10 \*\* DOTS_DISPLAY_DECIMALS/);
  });

  it('keeps the coefficient provenance block rather than asserting the numbers flatly', () => {
    expect(source).toMatch(/PROVENANCE OF THE COEFFICIENTS/);
    expect(source).toMatch(/crates\/coefficients\/src\/dots\.rs/);
    expect(source).toMatch(/DO NOT TUNE/);
    // The retrieval limit has to keep being disclosed, not quietly dropped.
    expect(source).toMatch(/NOT independently verifiable from here/);
  });

  it('states what the boundary does NOT close, not only what it does', () => {
    // The previous version of this comment claimed three layers made the
    // collapse impossible while `outcome.coefficient` sat on both branches. A
    // comment that overstates its guarantees is worse than no comment, so the
    // "not closed" half is pinned here.
    expect(source).toMatch(/WHAT DOES NOT COMPILE/);
    expect(source).toMatch(/WHAT THROWS AT RUNTIME/);
    expect(source).toMatch(/WHAT IS DELIBERATELY NOT CLOSED/);
    expect(source).toMatch(/officialTotalKg\(totalOnTheBoard\(state\)\)`? compiles/);
    expect(source).toMatch(/tamper-resistance/);
    // The coefficient leak is disclosed in the same list, by name, rather than
    // being denied two blocks further down.
    expect(source).toMatch(/applyDotsCoefficient\(c, officialTotalKg\(1\)\)`? compiles/);
    expect(source).toMatch(/Object\.getOwnPropertySymbols/);
  });

  it('never re-asserts that the coefficient cannot be got out as a number', () => {
    // Three rounds running, this module shipped a comment that promised more
    // than the code delivered ("three layers enforce that"; the delta
    // docstring's "cannot"; and these two). The behaviour they were wrong about
    // is executed in 'the numeric accessor this module does not export'; the
    // sentences are pinned dead here so a future edit cannot quietly restore
    // one.
    expect(source).not.toMatch(/none of it\s+\*?\s*hands back a bare multiplicand/);
    expect(source).not.toMatch(/hands out no coefficient a caller can multiply/);
    expect(source).not.toMatch(/There is deliberately no `dotsCoefficientValue\(c\): number`/);
    expect(source).not.toMatch(/On a call that typechecks it cannot throw/);
  });

  it('claims about the delta path only what the mint enforces', () => {
    // The old docstring said a delta "is only ever computed from two real
    // scores, so it cannot launder a lifter who has none: there is no `.score`
    // on a `'no-total'` outcome to subtract." That was false while the helper
    // took a plain `number`: one end narrowed, the other `?? 0`, and a bombed
    // lifter printed as "−445.38". The sentence is gone; the guarantee it
    // described is now the signature.
    //
    // Scanned against the compiled-away half of the file on purpose: a
    // `@ts-expect-error` is invisible to `npm test` (esbuild strips it), so
    // without this scan a revert of the signature would only show up under
    // `npm run typecheck`.
    expect(code).toMatch(/export function roundDotsDelta\(delta: DotsDelta\)/);
    expect(code).toMatch(/export function formatDotsDelta\(delta: DotsDelta\)/);
    expect(code).toMatch(/export function dotsDeltaBetween\(/);
    expect(code).toMatch(/export function dotsDeltaBetweenScores\(/);
    expect(source).toMatch(/WHAT THIS DOES AND DOES NOT GUARANTEE/);
    expect(source).toMatch(/A cast \(`x as DotsDelta`\) still defeats this/);
    expect(source).not.toMatch(/no `\.score` on a `'no-total'` outcome to subtract/);
  });
});
