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
 * PURITY CONTRACT (CLAUDE.md "Pure logic is separate from UI"): this module
 * imports nothing — not React, not I/O, not a sibling game module. The one thing
 * evaluated at load is `Symbol('dots.coefficient')` (see THE COEFFICIENT IS NOT A
 * NUMBER below); it allocates and touches nothing outside this file, and no
 * function's output depends on which symbol it got.
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
// Presentation policy — everything in this block is OURS, not published, and may
// be changed without making the math wrong. CLAUDE.md "Game Feel Values Must Be
// Tunable": these live here as named constants and are never inlined at a call
// site or in a component.
// ---------------------------------------------------------------------------

/** Decimal places used when displaying a DOTS score (federations show 2). */
export const DOTS_DISPLAY_DECIMALS = 2;

/**
 * Decimal places used when displaying a bodyweight COEFFICIENT (not a score).
 * Federations that print a coefficient column print more places than they do
 * for points, because the coefficient is ~0.5–1.5 and two places would hide
 * most of the spread.
 */
export const DOTS_COEFFICIENT_DISPLAY_DECIMALS = 4;

/**
 * The smallest score that still prints as something other than zero at
 * `DOTS_DISPLAY_DECIMALS`. Derived, not independently tunable: it is half of the
 * last displayed place. Anything below it is refused by the display helpers
 * rather than printed as "0.00" — see NO TOTAL IS NOT A TOTAL OF ZERO.
 */
export const DOTS_SMALLEST_PRINTABLE_SCORE = 0.5 / 10 ** DOTS_DISPLAY_DECIMALS;

/**
 * What goes in the DOTS column of a result sheet for a lifter who did not
 * total. It is deliberately NOT `"0.00"` — see the NO TOTAL note below.
 * Presentation only: changing this glyph cannot make a score wrong.
 */
export const DOTS_NO_TOTAL_DISPLAY = '—';

/**
 * Signs used when printing a DOTS *delta* — the "+12.40 DOTS" call-out on a
 * recap screen (GDD §6.5). A delta is a difference between two scores, so unlike
 * a score it may legitimately be negative or zero.
 *
 * The negative sign is U+2212 MINUS SIGN rather than a hyphen, to match the
 * typographic dash used for `DOTS_NO_TOTAL_DISPLAY`. Presentation only.
 */
export const DOTS_DELTA_POSITIVE_PREFIX = '+';
export const DOTS_DELTA_NEGATIVE_PREFIX = '−';
/** A delta that rounds to zero prints unsigned: "0.00", not "+0.00". */
export const DOTS_DELTA_ZERO_PREFIX = '';

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
// There are two ways to fake a score, and they need different defences:
//
//   A. COLLAPSE A MISSING TOTAL TO ZERO — `finalMeetTotal(state) ?? 0`. Visibly
//      wrong at the bottom of a board, but still a lie.
//   B. SCORE A PROVISIONAL NUMBER — `totalOnTheBoard(state)`. Worse: a bombed
//      lifter with two lifts banked lands mid-board with a plausible score that
//      nothing on the screen marks as fake.
//
// WHAT DOES NOT COMPILE (each line below is pinned by a `@ts-expect-error` test
// in dots.test.ts, which `npm run typecheck` enforces):
//
//   1. `dotsScore(sex, bw, finalMeetTotal(state))` — the total parameter is
//      `OfficialTotalKg`, a branded number, and `number | null` is not one.
//   2. `dotsScore(sex, bw, finalMeetTotal(state) ?? 0)` — defence A. A bare
//      `number` is not an `OfficialTotalKg` either, so the `?? 0` escape from
//      (1) does not typecheck any more; it used to compile and throw.
//   3. `dotsScore(sex, bw, totalOnTheBoard(state))` — defence B, same reason.
//      This one used to compile, throw nothing, and print a real-looking score.
//   4. `evaluateDots(sex, bw, finalMeetTotal(state))` and the same two escapes
//      aimed at it. Route a meet through `evaluateMeetDots`, which takes the
//      whole reading and cannot be handed a provisional number.
//   5. `outcome.score` on an un-narrowed `DotsOutcome` — the `'no-total'` branch
//      has no `score` field, not even an optional one, so `?? 0` has nothing to
//      default and there is nothing to read.
//   6. `outcome.coefficient` on an un-narrowed `DotsOutcome` — same: the
//      coefficient lives on `ScoredDots` only. It used to sit on the shared
//      context, where `outcome.coefficient * (finalMeetTotal(state) ?? 0)`
//      rebuilt the whole collapse in one multiplication.
//   7. `dotsCoefficient(sex, bw) * anythingAtAll`, and `scored.coefficient * x` —
//      a `DotsCoefficient` is an opaque object, not a number, so arithmetic on
//      one is a type error. The only multiplication is `applyDotsCoefficient`,
//      which demands an `OfficialTotalKg`.
//
// WHAT THROWS AT RUNTIME (for the casts and the `as any`s a type cannot see):
//
//   - `officialTotalKg(0)`, and therefore `officialTotalKg(finalMeetTotal(state) ?? 0)`.
//     A total of exactly 0 is refused with an error naming the collapse.
//     `meet.ts` cannot produce a 0 either: nothing below `MIN_LOADABLE_WEIGHT_KG`
//     (25 kg — bar plus collars) can be declared, so a meet that finishes with a
//     total finishes with at least ~75 kg, and one that does not finish with a
//     total reports `null`. No federation records a 0 kg total. Every 0 arriving
//     here is a bug, and refusing it names the bug where it happens instead of
//     quietly printing "0.00" onto a leaderboard.
//   - `dotsScore` / `evaluateDots` re-check the total they were handed, so a
//     forged brand still fails.
//   - `roundDotsScore` / `formatDotsScore` refuse a score that is not positive,
//     and refuse one that would ROUND to "0.00" (see
//     `DOTS_SMALLEST_PRINTABLE_SCORE`). A *delta* is a different thing and has
//     its own pair of helpers that accept negatives and zero.
//
// WHAT IS DELIBERATELY NOT CLOSED — stated plainly, because a comment that
// overstates its guarantees is worse than no comment:
//
//   - `officialTotalKg(totalOnTheBoard(state))` compiles, and scores. The mint
//     has to exist: totals also arrive from a server row, a seeded NPC table or
//     a test fixture, and no type can check that a bare number came from a
//     finished meet. What the mint buys is that the claim is now WRITTEN DOWN —
//     one greppable call whose name is the assertion — instead of being an
//     invisible `?? 0` at a module boundary.
//   - The published constants and `dotsDenominator` are exported so a critic can
//     verify them, which means anyone can evaluate the polynomial by hand and
//     multiply the result by whatever they like. A module that publishes its own
//     coefficients cannot prevent that and does not try to.
//   - A cast (`x as OfficialTotalKg`) defeats the brand, exactly as a cast
//     defeats the opaque rules in `meet.ts`. None of this is tamper-resistance;
//     authority over results belongs on the server (CLAUDE.md
//     "Server-authoritative progression"). It closes the accidents that used to
//     typecheck and look innocent in a diff, and claims nothing beyond that.
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
 * Type-level brand for `OfficialTotalKg`. Declared, never defined: it exists
 * only during typechecking and emits no code.
 */
declare const OFFICIAL_TOTAL_BRAND: unique symbol;

/**
 * A number that has been asserted to be a lifter's FINAL OFFICIAL competition
 * total, in kilograms. Nominal: a plain `number` is not assignable to it, so the
 * two numbers that must never be scored —
 *
 *     finalMeetTotal(state) ?? 0     // the bomb-out, collapsed
 *     totalOnTheBoard(state)         // provisional, not a result
 *
 * — cannot reach a scoring function by accident. Mint one with
 * `officialTotalFromMeet` (from a meet reading, checked) or `officialTotalKg`
 * (from a bare number, asserted).
 *
 * It IS a number at runtime and stays assignable to `number`, so arithmetic on a
 * total still works and the value can be printed, stored and compared normally.
 */
export type OfficialTotalKg = number & { readonly [OFFICIAL_TOTAL_BRAND]: 'kg' };

/**
 * The shape of `meet.ts`'s `readTotal(state)`, declared structurally here rather
 * than imported, because this module imports nothing (see the purity contract).
 * A real `TotalReading` is assignable to it; a bare `number` is not, which is
 * what stops `totalOnTheBoard(state)` from being routed in as a result.
 *
 * `dots.test.ts` pins the match by feeding an actual `readTotal(state)` through
 * `officialTotalFromMeet` for all three of its cases — if `TotalReading` ever
 * changes shape, that test stops compiling.
 */
export type MeetTotalReading =
  /** Still lifting: there is no total yet, only what is on the board. */
  | { readonly kind: 'in-progress'; readonly total: null }
  /** Meet over with a total. The only case that yields an official total. */
  | { readonly kind: 'final'; readonly total: number }
  /** Meet over with a bombed lift: NO total, which is not a total of zero. */
  | { readonly kind: 'no-total'; readonly total: null };

/**
 * The key a coefficient's numeric value lives under. Module-private and a
 * symbol, so `DotsCoefficient` has no property a caller can name.
 */
const COEFFICIENT_VALUE: unique symbol = Symbol('dots.coefficient');

/**
 * ---------------------------------------------------------------------------
 * THE COEFFICIENT IS NOT A NUMBER — why this is an object
 * ---------------------------------------------------------------------------
 * A bodyweight coefficient is one multiplication away from being a score, and
 * that multiplication is exactly how a fake score gets made:
 *
 *     dotsCoefficient('male', 93) * totalOnTheBoard(state)   // 222.69, a lie
 *
 * So the coefficient does not come out of this module as a number. It comes out
 * as an opaque object whose value sits under a private symbol, which makes the
 * line above a compile error ("the right-hand side of an arithmetic operation
 * must be of type 'any', 'number', 'bigint' or an enum type") rather than a
 * plausible number on a leaderboard.
 *
 * Everything anyone legitimately wants from a coefficient is here, and none of it
 * hands back a bare multiplicand:
 *
 *   - `applyDotsCoefficient(c, total)` — the score. Demands an `OfficialTotalKg`.
 *   - `formatDotsCoefficient(c)` — the display string, for a "Coeff" column.
 *   - `compareDotsCoefficients(a, b)` — ordering, for a board or a test.
 *   - the readable fields below — which lifter and which domain it belongs to.
 *
 * There is deliberately no `dotsCoefficientValue(c): number`. It would be a
 * one-call rebuild of the collapse and nothing in the game needs it.
 * ---------------------------------------------------------------------------
 */
export interface DotsCoefficient {
  /** The value itself, unreachable without the module-private symbol. */
  readonly [COEFFICIENT_VALUE]: number;
  /** Which published coefficient set produced it. */
  readonly sex: DotsSex;
  /** Bodyweight exactly as supplied, in kg. */
  readonly bodyweightKg: number;
  /** Bodyweight actually fed to the polynomial after domain clamping, in kg. */
  readonly effectiveBodyweightKg: number;
  /** Whether clamping occurred, and in which direction. */
  readonly domainStatus: DotsDomainStatus;
}

/**
 * The facts that depend only on the lifter, not on whether they totalled.
 * Reported in both outcomes so a result card can render a bombed lifter's row
 * without inventing a score to put in it.
 *
 * The coefficient is NOT here. It is on `ScoredDots` only — see defect 6 in the
 * NO TOTAL note: a coefficient readable off an un-narrowed outcome is a fake
 * score one `*` away.
 */
export interface DotsLifterContext {
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
  readonly totalKg: OfficialTotalKg;
  /** The bodyweight coefficient this score came from. Opaque; see above. */
  readonly coefficient: DotsCoefficient;
}

/**
 * A lifter with no official total. They do not place, so they have no score.
 *
 * There is deliberately no `score` field here — not `score: 0`, and not
 * `score?: number`. An optional score would make `outcome.score ?? 0` compile,
 * which is precisely the collapse this shape exists to prevent. There is no
 * `coefficient` either, for the same reason one multiplication later.
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
 * strictly positive. See NO TOTAL IS NOT A TOTAL OF ZERO for why 0 is refused
 * rather than treated as the bombed-out case.
 */
function assertOfficialTotal(totalKg: number): void {
  assertUsableNumber(totalKg, 'totalKg');
  if (totalKg === 0) {
    throw new RangeError(
      'dots: a total of 0 kg is not a result. A lifter who did not total has NO total ' +
        '(meet.ts records `total: null`) and does not place, so they get no DOTS score at ' +
        'all. Pass the reading through to evaluateMeetDots and handle its `no-total` ' +
        'outcome — do not collapse it with `?? 0`.',
    );
  }
  if (totalKg < 0) {
    throw new RangeError(`dots: totalKg must be greater than 0, received ${totalKg}`);
  }
}

/** Round to the number of decimals a result sheet prints. */
function roundToDisplayDecimals(value: number): number {
  const factor = 10 ** DOTS_DISPLAY_DECIMALS;
  return Math.round(value * factor) / factor;
}

/**
 * A SCORE — not a delta — must be printable: positive, and not so small that it
 * would render as "0.00".
 *
 * The check is about ROUNDING TO ZERO, not about the sign. `0.004` is positive
 * and still prints "0.00", which is the string this module exists to keep off a
 * result card, so it is refused too.
 */
function assertPrintableScore(score: number): void {
  assertUsableNumber(score, 'score');
  if (score <= 0) {
    throw new RangeError(
      `dots: a DOTS score is strictly positive, received ${score}. A lifter with no total ` +
        'has no score to print — render DOTS_NO_TOTAL_DISPLAY (via formatDotsOutcome) ' +
        'instead of formatting a 0. If this is a DIFFERENCE between two scores, it is a ' +
        'delta, not a score: use roundDotsDelta / formatDotsDelta, which accept negatives.',
    );
  }
  if (roundToDisplayDecimals(score) === 0) {
    throw new RangeError(
      `dots: a score of ${score} rounds to "0.00" at ${DOTS_DISPLAY_DECIMALS} decimals, and ` +
        '"0.00" is the one thing a DOTS column must never say about a lifter who did not ' +
        'total. Nothing in the published domain produces a score this small from a real ' +
        'total; treat it as a bug at the caller.',
    );
  }
}

// --- Minting an official total ----------------------------------------------

/**
 * Assert that a bare number is a lifter's final official total.
 *
 * THE CALLER IS MAKING A CLAIM THAT NO TYPE CAN CHECK, so make it only where the
 * claim is true: a result row from the server, a seeded NPC's recorded total, a
 * historical result, a test fixture. It is NOT true of
 * `meet.totalOnTheBoard(state)` (provisional — the meet may still bomb) and not
 * true of `finalMeetTotal(state) ?? 0` (that is a bomb-out wearing a zero, and
 * it throws here).
 *
 * For a meet this module can see the reading of, use `officialTotalFromMeet`,
 * which checks instead of asserting.
 *
 * @throws RangeError on a non-finite total, a negative total, or exactly 0.
 */
export function officialTotalKg(totalKg: number): OfficialTotalKg {
  assertOfficialTotal(totalKg);
  return totalKg as OfficialTotalKg;
}

/**
 * The checked mint: an official total out of a meet's total reading, or `null`
 * when there is not one.
 *
 * Pass `readTotal(state)` from `meet.ts` straight in. Only the `'final'` case
 * yields a total; `'no-total'` (bombed out) and `'in-progress'` (still lifting)
 * both give `null`, and a caller that needs to tell those two apart reads
 * `reading.kind`, which it already has in hand.
 *
 * A bare `number` — including `totalOnTheBoard(state)` — is not a reading and
 * will not compile here. That is the whole point of taking the reading.
 */
export function officialTotalFromMeet(reading: MeetTotalReading): OfficialTotalKg | null {
  if (reading.kind !== 'final') return null;
  return officialTotalKg(reading.total);
}

// --- The polynomial ---------------------------------------------------------

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
 * Exported so the published fit can be checked against a reference table;
 * callers generally want `dotsCoefficient`. Does NOT clamp — pass an
 * already-clamped bodyweight for official scoring.
 */
export function dotsDenominator(sex: DotsSex, bodyweightKg: number): number {
  const k = DOTS_COEFFICIENTS[sex];
  const c3Term = k.c4 * bodyweightKg + k.c3;
  const c2Term = c3Term * bodyweightKg + k.c2;
  const c1Term = c2Term * bodyweightKg + k.c1;
  return c1Term * bodyweightKg + k.c0;
}

/**
 * The DOTS coefficient for a bodyweight. Bodyweight is clamped to the published
 * domain first.
 *
 * Returns an OPAQUE value, not a number: multiplying a coefficient by anything
 * other than an `OfficialTotalKg` is how a bombed lifter gets a plausible fake
 * score, so it is a type error here. Use `applyDotsCoefficient` to score and
 * `formatDotsCoefficient` to display. See THE COEFFICIENT IS NOT A NUMBER.
 *
 * @throws RangeError on a non-finite or non-positive bodyweight.
 */
export function dotsCoefficient(sex: DotsSex, bodyweightKg: number): DotsCoefficient {
  assertUsableBodyweight(bodyweightKg);
  const effectiveBodyweightKg = clampBodyweightToDotsDomain(sex, bodyweightKg);
  return {
    [COEFFICIENT_VALUE]: DOTS_NUMERATOR / dotsDenominator(sex, effectiveBodyweightKg),
    sex,
    bodyweightKg,
    effectiveBodyweightKg,
    domainStatus: dotsDomainStatus(sex, bodyweightKg),
  };
}

/**
 * The one multiplication in this module: coefficient x official total = score.
 *
 * It takes an `OfficialTotalKg` and nothing else, so neither
 * `finalMeetTotal(state) ?? 0` nor `totalOnTheBoard(state)` can be scored
 * through it without a caller first writing down the claim that the number is an
 * official total.
 */
export function applyDotsCoefficient(
  coefficient: DotsCoefficient,
  totalKg: OfficialTotalKg,
): number {
  assertOfficialTotal(totalKg);
  return coefficient[COEFFICIENT_VALUE] * totalKg;
}

/**
 * The coefficient as a result sheet would print it, e.g. `"0.6363"`. A string,
 * deliberately: the module hands out no coefficient a caller can multiply.
 */
export function formatDotsCoefficient(coefficient: DotsCoefficient): string {
  return coefficient[COEFFICIENT_VALUE].toFixed(DOTS_COEFFICIENT_DISPLAY_DECIMALS);
}

/**
 * Order two coefficients the way a board does: heavier lifter, smaller
 * coefficient. Negative when `a` is the smaller (heavier) one, so it can be
 * passed straight to `Array.prototype.sort`.
 *
 * Exists so callers (and the suite) can compare coefficients without a numeric
 * accessor that would double as a fake-score builder.
 */
export function compareDotsCoefficients(a: DotsCoefficient, b: DotsCoefficient): number {
  return a[COEFFICIENT_VALUE] - b[COEFFICIENT_VALUE];
}

/**
 * DOTS score for a lifter who has an official total, unrounded.
 *
 * @param sex          Sex whose published coefficients apply. DOTS only defines
 *                     male and female sets; OpenPowerlifting scores lifters
 *                     entered as Mx with the male coefficients, so if the game
 *                     ever adds a third option, map it to `'male'` here rather
 *                     than inventing a coefficient set.
 * @param bodyweightKg Bodyweight in kg (> 0). Clamped to the published domain.
 * @param totalKg      Official competition total (see `OfficialTotalKg`). A bare
 *                     `number` does not typecheck here — that is what stops both
 *                     `finalMeetTotal(state) ?? 0` and `totalOnTheBoard(state)`
 *                     from being scored by accident.
 * @throws RangeError on non-finite input, bodyweight <= 0, or a total <= 0
 *         (including exactly 0 — see the NO TOTAL note above).
 */
export function dotsScore(
  sex: DotsSex,
  bodyweightKg: number,
  totalKg: OfficialTotalKg,
): number {
  assertUsableBodyweight(bodyweightKg);
  assertOfficialTotal(totalKg);
  return applyDotsCoefficient(dotsCoefficient(sex, bodyweightKg), totalKg);
}

/**
 * Everything needed to present a lifter's DOTS honestly, including the case
 * where there is nothing to present.
 *
 * `null` means the lifter has no official total, and produces a `'no-total'`
 * outcome that carries neither a score nor a coefficient, because a lifter who
 * did not total does not place. Coming from a meet, use `evaluateMeetDots`,
 * which does the null-mapping from the reading for you.
 *
 * @throws RangeError on non-finite input, bodyweight <= 0, or a total <= 0.
 */
export function evaluateDots(
  sex: DotsSex,
  bodyweightKg: number,
  totalKg: OfficialTotalKg | null,
): DotsOutcome {
  assertUsableBodyweight(bodyweightKg);
  const coefficient = dotsCoefficient(sex, bodyweightKg);
  const context: DotsLifterContext = {
    bodyweightKg,
    effectiveBodyweightKg: coefficient.effectiveBodyweightKg,
    domainStatus: coefficient.domainStatus,
  };
  if (totalKg === null) {
    return { kind: 'no-total', ...context };
  }
  assertOfficialTotal(totalKg);
  return {
    kind: 'scored',
    score: applyDotsCoefficient(coefficient, totalKg),
    totalKg,
    coefficient,
    ...context,
  };
}

/**
 * The meet-day entry point: score a lifter straight from `readTotal(state)`.
 *
 * This is the glue between `meet.ts` and a result card, and it is the ONE line a
 * caller should be writing. A meet that bombed and a meet still in progress both
 * come back as `'no-total'` — no score, no coefficient, and
 * `formatDotsOutcome` prints `DOTS_NO_TOTAL_DISPLAY` for them.
 */
export function evaluateMeetDots(
  sex: DotsSex,
  bodyweightKg: number,
  reading: MeetTotalReading,
): DotsOutcome {
  return evaluateDots(sex, bodyweightKg, officialTotalFromMeet(reading));
}

/**
 * Narrow an outcome to the lifter who actually placed. Use it to build a
 * ranking — `outcomes.filter(hasDotsScore)` leaves a bombed lifter OUT of the
 * board rather than sorting them to the bottom of it.
 */
export function hasDotsScore(outcome: DotsOutcome): outcome is ScoredDots {
  return outcome.kind === 'scored';
}

// ---------------------------------------------------------------------------
// Display
//
// Two pairs, because a SCORE and a DELTA are different things:
//   - a score is a lifter's DOTS points. Always positive; "0.00" is a lie.
//   - a delta is the difference between two scores — the "+12.40 DOTS" call-out
//     on a recap (GDD §6.5). Legitimately negative, and legitimately zero.
// ---------------------------------------------------------------------------

/**
 * Round a DOTS score for display, to the number of decimals federations use.
 * @throws RangeError unless the score is finite, positive, and large enough to
 *         print as something other than "0.00". For a difference between two
 *         scores use `roundDotsDelta`.
 */
export function roundDotsScore(score: number): number {
  assertPrintableScore(score);
  return roundToDisplayDecimals(score);
}

/**
 * Format a DOTS score the way a result sheet prints it, e.g. `"445.38"`.
 * @throws RangeError unless the score is finite, positive, and large enough to
 *         print as something other than "0.00". A lifter without a score goes
 *         through `formatDotsOutcome`; a difference between two scores goes
 *         through `formatDotsDelta`.
 */
export function formatDotsScore(score: number): string {
  return roundDotsScore(score).toFixed(DOTS_DISPLAY_DECIMALS);
}

/**
 * Round a DOTS delta — a difference between two scores — for display.
 *
 * Unlike a score, a delta may be negative (the lifter went backwards) or zero
 * (they scored the same), and neither is an error. It is only ever computed from
 * two real scores, so it cannot launder a lifter who has none: there is no
 * `.score` on a `'no-total'` outcome to subtract.
 *
 * @throws RangeError if the delta is not finite.
 */
export function roundDotsDelta(delta: number): number {
  assertUsableNumber(delta, 'delta');
  return roundToDisplayDecimals(delta);
}

/**
 * Format a DOTS delta with an explicit sign, e.g. `"+12.40"`, `"−2.31"`,
 * `"0.00"` — the PR call-out on a recap screen (GDD §6.5).
 *
 * The sign is chosen from the ROUNDED value, so a delta of -0.001 prints
 * `"0.00"` rather than `"−0.00"`.
 *
 * @throws RangeError if the delta is not finite.
 */
export function formatDotsDelta(delta: number): string {
  const rounded = roundDotsDelta(delta);
  const prefix =
    rounded > 0
      ? DOTS_DELTA_POSITIVE_PREFIX
      : rounded < 0
        ? DOTS_DELTA_NEGATIVE_PREFIX
        : DOTS_DELTA_ZERO_PREFIX;
  return `${prefix}${Math.abs(rounded).toFixed(DOTS_DISPLAY_DECIMALS)}`;
}

/**
 * Format whatever an outcome has: the score for a lifter who totalled, and
 * `DOTS_NO_TOTAL_DISPLAY` for one who did not. This is the only function that
 * turns a bombed lifter into text, and it never produces a number.
 */
export function formatDotsOutcome(outcome: DotsOutcome): string {
  return hasDotsScore(outcome) ? formatDotsScore(outcome.score) : DOTS_NO_TOTAL_DISPLAY;
}
