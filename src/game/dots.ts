/**
 * DOTS scoring — pure game math.
 *
 * DOTS is the bodyweight-normalising coefficient used to compare powerlifting
 * totals across weight classes and between sexes. It was written by
 * Tim Konertz for the BVDK (the German IPF affiliate) in 2019 as a replacement
 * for Wilks that also works for mixed-sex team scoring.
 *
 * Formula (bodyweight `bw` in kilograms, total in kilograms):
 *
 *     score = total * 500 / (c0 + c1*bw + c2*bw^2 + c3*bw^3 + c4*bw^4)
 *
 * with sex-specific coefficients. See DOTS_COEFFICIENTS below.
 *
 * ---------------------------------------------------------------------------
 * PROVENANCE OF THE COEFFICIENTS  (read this before touching any number here)
 * ---------------------------------------------------------------------------
 * These are PUBLISHED constants, not tuning values. They are not game feel and
 * they are not adjustable: changing one does not make the game feel different,
 * it makes the score wrong, and competitive lifters check DOTS against
 * OpenPowerlifting and their federation's software. Do not move them into a
 * tuning file and do not "balance" them.
 *
 * Corroborated against two implementations whose source was fetched and read
 * directly (not summarised by a search engine):
 *
 *   1. OpenPowerlifting, `crates/coefficients/src/dots.rs` (canonical; this is
 *      the implementation that produces the DOTS numbers on
 *      openpowerlifting.org):
 *      https://raw.githubusercontent.com/sstangl/openpowerlifting/main/crates/coefficients/src/dots.rs
 *      It names the coefficients A..E in DESCENDING power order —
 *      `poly4(A,B,C,D,E,x) = A*x^4 + B*x^3 + C*x^2 + D*x + E` — so OPL's `A` is
 *      our `c4` and OPL's `E` is our `c0`. Both orderings appear in the wild;
 *      the mapping is spelled out per-coefficient below so it can be checked
 *      line by line.
 *
 *   2. `powerlifting-formulas`, `src/dots.ts` (independent TypeScript
 *      transcription, ascending power order):
 *      https://raw.githubusercontent.com/Marantesss/powerlifting-formulas/master/src/dots.ts
 *      `male: [-307.75076, 24.0900756, -0.1918759221, 7.391293e-4, -1.093e-6]`
 *      `female: [-57.96288, 13.6175032, -0.1126655495, 5.158568e-4, -1.0706e-6]`
 *
 * Both sets were additionally echoed back verbatim by independent web searches
 * over public DOTS calculators. WARNING for anyone re-verifying by search:
 * search results about DOTS are heavily contaminated. During this work a search
 * summary confidently produced a 5th-degree "female DOTS formula" with entirely
 * invented coefficients, and several sources invent an acronym expansion.
 * (Per OpenPowerlifting, Konertz says DOTS stands for "Dynamic Objective Team
 * Scoring" but the acronym was chosen before the expansion — treat any other
 * expansion as fabricated.) Verify against fetched source code, never against a
 * search summary.
 *
 * NOT independently verifiable from here: the original BVDK/Konertz
 * publication and the IPF's 2020 formula-evaluation report are both blocked by
 * this environment's egress policy, so the coefficients are corroborated
 * against implementations of the original rather than against the original
 * itself.
 */

// ---------------------------------------------------------------------------
// Published constants — DO NOT TUNE (see provenance note above)
// ---------------------------------------------------------------------------

/** Sexes for which DOTS coefficients are published. */
export type DotsSex = 'male' | 'female';

/**
 * Numerator of the DOTS coefficient. Scales the formula so that the coefficient
 * is ~1.0 for a lifter near the low end of the bodyweight range.
 */
export const DOTS_NUMERATOR = 500;

/**
 * Polynomial coefficients in ASCENDING power order:
 * `c0 + c1*bw + c2*bw^2 + c3*bw^3 + c4*bw^4`.
 */
export interface DotsPolynomial {
  /** Constant term. OpenPowerlifting calls this `E`. */
  readonly c0: number;
  /** Coefficient of bw^1. OpenPowerlifting calls this `D`. */
  readonly c1: number;
  /** Coefficient of bw^2. OpenPowerlifting calls this `C`. */
  readonly c2: number;
  /** Coefficient of bw^3. OpenPowerlifting calls this `B`. */
  readonly c3: number;
  /** Coefficient of bw^4. OpenPowerlifting calls this `A`. */
  readonly c4: number;
}

export const DOTS_COEFFICIENTS: Readonly<Record<DotsSex, DotsPolynomial>> = {
  male: {
    c0: -307.75076,
    c1: 24.0900756,
    c2: -0.1918759221,
    c3: 0.0007391293,
    c4: -0.0000010930,
  },
  female: {
    c0: -57.96288,
    c1: 13.6175032,
    c2: -0.1126655495,
    c3: 0.0005158568,
    c4: -0.0000010706,
  },
} as const;

/**
 * Valid bodyweight domain of the published formula, in kilograms.
 *
 * The polynomial is a curve fit over competition data and is only meaningful
 * inside these bounds; outside them it eventually turns around and produces
 * nonsense (the leading term is negative, so at large enough bodyweight the
 * denominator collapses and the coefficient explodes). OpenPowerlifting clamps
 * bodyweight to exactly these bounds, so a 220 kg male scores as a 210 kg male.
 * We match that behaviour and additionally report it (see `DotsDomainStatus`)
 * so callers can label an out-of-domain score instead of presenting it as an
 * ordinary one.
 *
 * Source: `bodyweightkg.clamp(40.0, 210.0)` / `clamp(40.0, 150.0)` in
 * openpowerlifting `crates/coefficients/src/dots.rs`.
 */
export const DOTS_BODYWEIGHT_DOMAIN_KG: Readonly<
  Record<DotsSex, { readonly min: number; readonly max: number }>
> = {
  male: { min: 40, max: 210 },
  female: { min: 40, max: 150 },
} as const;

// ---------------------------------------------------------------------------
// Presentation policy — these two ARE ours, not published, and may be changed
// without making the math wrong.
// ---------------------------------------------------------------------------

/** Decimal places used when displaying a DOTS score (federations show 2). */
export const DOTS_DISPLAY_DECIMALS = 2;

/**
 * What goes in the DOTS column of a result sheet for a lifter who did not
 * total. It is deliberately NOT `"0.00"` — see the NO TOTAL note below.
 * Presentation only: changing this glyph cannot make a score wrong.
 */
export const DOTS_NO_TOTAL_DISPLAY = '—';

// ---------------------------------------------------------------------------
// NO TOTAL IS NOT A TOTAL OF ZERO
// (read this before widening any signature in this file)
// ---------------------------------------------------------------------------
//
// `meet.ts` is the module that decides what a bombed-out meet produced, and it
// says: nothing. Its `TotalReading` has a `'no-total'` case carrying
// `total: null`, and `finalMeetTotal(state)` returns `number | null` — null
// forever once a lift is bombed. A bombed lifter can have a large
// `totalOnTheBoard` (two good lifts already banked, say) and still have no
// total at all.
//
// That is the sport, not a modelling flourish. A lifter who misses all three
// attempts on a lift is not ranked last with 0 kg; they are unranked, with a
// dash where the placing would be. So this module never hands them a number.
// "Does not place" is the outcome — not 0.00 DOTS.
//
// Three things enforce that, in order of how early they catch a mistake:
//
//   1. `dotsScore(sex, bw, totalKg: number)` takes a real total. The tempting
//      glue `dotsScore(sex, bw, finalMeetTotal(state))` does not compile,
//      because `number | null` is not `number`.
//   2. `evaluateDots(sex, bw, totalKg: number | null)` is the null-aware entry
//      point, and it returns a union whose `'no-total'` branch has NO `score`
//      field — not even an optional one. Reading `outcome.score` without
//      narrowing is a compile error, so a missing score cannot be `?? 0`-ed
//      into existence one level up either.
//   3. A total of exactly 0 is REJECTED at runtime, which is what catches the
//      one collapse the type system cannot see: `finalMeetTotal(state) ?? 0`.
//
// Why 0 is rejected rather than documented as "the bombed-out total":
//
//   - `meet.ts` cannot produce it. Nothing below `MIN_LOADABLE_WEIGHT_KG`
//     (25 kg — bar plus collars) can be declared, so a meet that finishes with
//     a total finishes with at least ~75 kg, and a meet that does not finish
//     with a total reports `null`. There is no path to 0.
//   - No federation records a 0 kg total either. The result sheet says the
//     lifter did not total; it does not say they totalled zero.
//
//   So every 0 arriving here is a bug — overwhelmingly likely a `?? 0` at a
//   module boundary. Refusing it names the bug at the moment it happens instead
//   of quietly printing a real-looking "0.00" onto a leaderboard.
//
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Whether the supplied bodyweight sat inside the formula's fitted range. */
export type DotsDomainStatus =
  /** Bodyweight was inside the published domain; the score is a normal DOTS score. */
  | 'in-domain'
  /** Bodyweight was below the published minimum; it was clamped to the minimum. */
  | 'clamped-below-min'
  /** Bodyweight was above the published maximum; it was clamped to the maximum. */
  | 'clamped-above-max';

/**
 * The facts that depend only on the lifter, not on whether they totalled.
 * Reported in both outcomes so a result card can render a bombed lifter's row
 * without inventing a score to put in it.
 */
export interface DotsLifterContext {
  /** The bodyweight coefficient for this lifter, i.e. `score / totalKg`. */
  readonly coefficient: number;
  /** Bodyweight exactly as supplied, in kg. */
  readonly bodyweightKg: number;
  /** Bodyweight actually fed to the polynomial after domain clamping, in kg. */
  readonly effectiveBodyweightKg: number;
  /** Whether clamping occurred, and in which direction. */
  readonly domainStatus: DotsDomainStatus;
}

/** A lifter with an official total, and therefore a DOTS score. */
export interface ScoredDots extends DotsLifterContext {
  readonly kind: 'scored';
  /** Unrounded DOTS score. Always > 0. */
  readonly score: number;
  /** The official total this score was computed from, in kg. Always > 0. */
  readonly totalKg: number;
}

/**
 * A lifter with no official total. They do not place, so they have no score.
 *
 * There is deliberately no `score` field here — not `score: 0`, and not
 * `score?: number`. An optional score would make `outcome.score ?? 0` compile,
 * which is precisely the collapse this shape exists to prevent.
 */
export interface NoTotalDots extends DotsLifterContext {
  readonly kind: 'no-total';
}

export type DotsOutcome = ScoredDots | NoTotalDots;

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

function assertUsableNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`dots: ${label} must be a finite number, received ${String(value)}`);
  }
}

function assertUsableBodyweight(bodyweightKg: number): void {
  assertUsableNumber(bodyweightKg, 'bodyweightKg');
  if (bodyweightKg <= 0) {
    throw new RangeError(`dots: bodyweightKg must be greater than 0, received ${bodyweightKg}`);
  }
}

/**
 * A total that reaches this module must be an official total: finite and
 * strictly positive. See the NO TOTAL note above for why 0 is refused rather
 * than treated as the bombed-out case.
 */
function assertOfficialTotal(totalKg: number): void {
  assertUsableNumber(totalKg, 'totalKg');
  if (totalKg === 0) {
    throw new RangeError(
      'dots: a total of 0 kg is not a result. A lifter who did not total has NO total ' +
        '(meet.ts records `total: null`) and does not place, so they get no DOTS score at ' +
        'all. Pass the null through to evaluateDots and handle its `no-total` outcome — ' +
        'do not collapse it with `?? 0`.',
    );
  }
  if (totalKg < 0) {
    throw new RangeError(`dots: totalKg must be greater than 0, received ${totalKg}`);
  }
}

/**
 * A DOTS score is strictly positive: the total is > 0 and the coefficient is
 * > 0 everywhere in the published domain, so 0 is not reachable from any real
 * result. Refusing it keeps "0.00" off a result card by construction.
 */
function assertUsableScore(score: number): void {
  assertUsableNumber(score, 'score');
  if (score <= 0) {
    throw new RangeError(
      `dots: a DOTS score is strictly positive, received ${score}. A lifter with no total ` +
        'has no score to print — render DOTS_NO_TOTAL_DISPLAY (via formatDotsOutcome) ' +
        'instead of formatting a 0.',
    );
  }
}

/**
 * Classify a bodyweight against the published domain for that sex.
 * Pure; does no clamping itself.
 */
export function dotsDomainStatus(sex: DotsSex, bodyweightKg: number): DotsDomainStatus {
  assertUsableNumber(bodyweightKg, 'bodyweightKg');
  const domain = DOTS_BODYWEIGHT_DOMAIN_KG[sex];
  if (bodyweightKg < domain.min) {
    return 'clamped-below-min';
  }
  if (bodyweightKg > domain.max) {
    return 'clamped-above-max';
  }
  return 'in-domain';
}

/** True when the bodyweight lies inside the formula's published fitted range. */
export function isBodyweightInDotsDomain(sex: DotsSex, bodyweightKg: number): boolean {
  return dotsDomainStatus(sex, bodyweightKg) === 'in-domain';
}

/** Clamp a bodyweight into the published domain for that sex. */
export function clampBodyweightToDotsDomain(sex: DotsSex, bodyweightKg: number): number {
  assertUsableNumber(bodyweightKg, 'bodyweightKg');
  const domain = DOTS_BODYWEIGHT_DOMAIN_KG[sex];
  return Math.min(Math.max(bodyweightKg, domain.min), domain.max);
}

/**
 * The 4th-degree polynomial denominator, evaluated by Horner's method.
 * Exported for testability; callers generally want `dotsCoefficient`.
 * Does NOT clamp — pass an already-clamped bodyweight for official scoring.
 */
export function dotsDenominator(sex: DotsSex, bodyweightKg: number): number {
  const k = DOTS_COEFFICIENTS[sex];
  const c3Term = k.c4 * bodyweightKg + k.c3;
  const c2Term = c3Term * bodyweightKg + k.c2;
  const c1Term = c2Term * bodyweightKg + k.c1;
  return c1Term * bodyweightKg + k.c0;
}

/**
 * The DOTS coefficient for a bodyweight: multiply a total in kg by this to get
 * a DOTS score. Bodyweight is clamped to the published domain first.
 */
export function dotsCoefficient(sex: DotsSex, bodyweightKg: number): number {
  assertUsableNumber(bodyweightKg, 'bodyweightKg');
  if (bodyweightKg <= 0) {
    throw new RangeError(`dots: bodyweightKg must be greater than 0, received ${bodyweightKg}`);
  }
  const clamped = clampBodyweightToDotsDomain(sex, bodyweightKg);
  return DOTS_NUMERATOR / dotsDenominator(sex, clamped);
}

/**
 * DOTS score for a lifter who has an official total, unrounded.
 *
 * This entry point is only for a lifter who totalled. It takes a plain
 * `number`, which is what makes `dotsScore(sex, bw, finalMeetTotal(state))` a
 * compile error: route a `number | null` through `evaluateDots` instead. Do
 * not reach for `?? 0` to get past that error — it throws.
 *
 * @param sex          Sex whose published coefficients apply. DOTS only defines
 *                     male and female sets; OpenPowerlifting scores lifters
 *                     entered as Mx with the male coefficients, so if the game
 *                     ever adds a third option, map it to `'male'` here rather
 *                     than inventing a coefficient set.
 * @param bodyweightKg Bodyweight in kg (> 0). Clamped to the published domain.
 * @param totalKg      Official competition total in kg, strictly > 0.
 * @throws RangeError on non-finite input, bodyweight <= 0, or a total <= 0
 *         (including exactly 0 — see the NO TOTAL note above).
 */
export function dotsScore(sex: DotsSex, bodyweightKg: number, totalKg: number): number {
  assertUsableBodyweight(bodyweightKg);
  assertOfficialTotal(totalKg);
  return dotsCoefficient(sex, bodyweightKg) * totalKg;
}

/**
 * The null-aware entry point: everything needed to present a lifter's DOTS
 * honestly, including the case where there is nothing to present.
 *
 * Pass `finalMeetTotal(state)` straight in. `null` means the lifter did not
 * total, and produces a `'no-total'` outcome that carries no score, because a
 * lifter who did not total does not place. Anything else must be a real total
 * (> 0); a literal 0 is rejected rather than scored.
 *
 * @throws RangeError on non-finite input, bodyweight <= 0, or a total <= 0.
 */
export function evaluateDots(
  sex: DotsSex,
  bodyweightKg: number,
  totalKg: number | null,
): DotsOutcome {
  assertUsableBodyweight(bodyweightKg);
  const effectiveBodyweightKg = clampBodyweightToDotsDomain(sex, bodyweightKg);
  const context: DotsLifterContext = {
    coefficient: DOTS_NUMERATOR / dotsDenominator(sex, effectiveBodyweightKg),
    bodyweightKg,
    effectiveBodyweightKg,
    domainStatus: dotsDomainStatus(sex, bodyweightKg),
  };
  if (totalKg === null) {
    return { kind: 'no-total', ...context };
  }
  assertOfficialTotal(totalKg);
  return { kind: 'scored', score: context.coefficient * totalKg, totalKg, ...context };
}

/**
 * Narrow an outcome to the lifter who actually placed. Use it to build a
 * ranking — `outcomes.filter(hasDotsScore)` leaves a bombed lifter OUT of the
 * board rather than sorting them to the bottom of it.
 */
export function hasDotsScore(outcome: DotsOutcome): outcome is ScoredDots {
  return outcome.kind === 'scored';
}

/**
 * Round a DOTS score for display, to the number of decimals federations use.
 * @throws RangeError unless the score is finite and > 0.
 */
export function roundDotsScore(score: number): number {
  assertUsableScore(score);
  const factor = 10 ** DOTS_DISPLAY_DECIMALS;
  return Math.round(score * factor) / factor;
}

/**
 * Format a DOTS score the way a result sheet prints it, e.g. `"445.38"`.
 * @throws RangeError unless the score is finite and > 0. A lifter without a
 *         score goes through `formatDotsOutcome`.
 */
export function formatDotsScore(score: number): string {
  assertUsableScore(score);
  return score.toFixed(DOTS_DISPLAY_DECIMALS);
}

/**
 * Format whatever an outcome has: the score for a lifter who totalled, and
 * `DOTS_NO_TOTAL_DISPLAY` for one who did not. This is the only function that
 * turns a bombed lifter into text, and it never produces a number.
 */
export function formatDotsOutcome(outcome: DotsOutcome): string {
  return hasDotsScore(outcome) ? formatDotsScore(outcome.score) : DOTS_NO_TOTAL_DISPLAY;
}
