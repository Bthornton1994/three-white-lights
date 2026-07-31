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
 * A total of exactly 0 kg is a legal, meaningful result: it is what a lifter who
 * bombs out records (GDD §6.3). It scores 0 DOTS rather than throwing.
 */
export const DOTS_BOMBED_OUT_SCORE = 0;

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

export interface DotsResult {
  /** Unrounded DOTS score. */
  readonly score: number;
  /** The bodyweight coefficient used, i.e. `score / totalKg`. */
  readonly coefficient: number;
  /** Bodyweight exactly as supplied, in kg. */
  readonly bodyweightKg: number;
  /** Bodyweight actually fed to the polynomial after domain clamping, in kg. */
  readonly effectiveBodyweightKg: number;
  /** Whether clamping occurred, and in which direction. */
  readonly domainStatus: DotsDomainStatus;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

function assertUsableNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`dots: ${label} must be a finite number, received ${String(value)}`);
  }
}

function assertValidInputs(bodyweightKg: number, totalKg: number): void {
  assertUsableNumber(bodyweightKg, 'bodyweightKg');
  assertUsableNumber(totalKg, 'totalKg');
  if (bodyweightKg <= 0) {
    throw new RangeError(`dots: bodyweightKg must be greater than 0, received ${bodyweightKg}`);
  }
  if (totalKg < 0) {
    throw new RangeError(`dots: totalKg must not be negative, received ${totalKg}`);
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
 * DOTS score for a total, unrounded.
 *
 * @param sex          Sex whose published coefficients apply. DOTS only defines
 *                     male and female sets; OpenPowerlifting scores lifters
 *                     entered as Mx with the male coefficients, so if the game
 *                     ever adds a third option, map it to `'male'` here rather
 *                     than inventing a coefficient set.
 * @param bodyweightKg Bodyweight in kg (> 0). Clamped to the published domain.
 * @param totalKg      Competition total in kg (>= 0). 0 means bombed out.
 * @throws RangeError on non-finite input, bodyweight <= 0, or negative total.
 */
export function dotsScore(sex: DotsSex, bodyweightKg: number, totalKg: number): number {
  assertValidInputs(bodyweightKg, totalKg);
  if (totalKg === 0) {
    return DOTS_BOMBED_OUT_SCORE;
  }
  return dotsCoefficient(sex, bodyweightKg) * totalKg;
}

/**
 * DOTS score plus the domain information needed to present it honestly
 * (e.g. flagging a score as out-of-range on a result card).
 */
export function evaluateDots(sex: DotsSex, bodyweightKg: number, totalKg: number): DotsResult {
  assertValidInputs(bodyweightKg, totalKg);
  const effectiveBodyweightKg = clampBodyweightToDotsDomain(sex, bodyweightKg);
  const coefficient = DOTS_NUMERATOR / dotsDenominator(sex, effectiveBodyweightKg);
  return {
    score: totalKg === 0 ? DOTS_BOMBED_OUT_SCORE : coefficient * totalKg,
    coefficient,
    bodyweightKg,
    effectiveBodyweightKg,
    domainStatus: dotsDomainStatus(sex, bodyweightKg),
  };
}

/** Round a DOTS score for display, to the number of decimals federations use. */
export function roundDotsScore(score: number): number {
  assertUsableNumber(score, 'score');
  const factor = 10 ** DOTS_DISPLAY_DECIMALS;
  return Math.round(score * factor) / factor;
}

/** Format a DOTS score the way a result sheet prints it, e.g. `"445.38"`. */
export function formatDotsScore(score: number): string {
  assertUsableNumber(score, 'score');
  return score.toFixed(DOTS_DISPLAY_DECIMALS);
}
