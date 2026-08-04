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
 * imports nothing — not React, not I/O, not a sibling game module. Load-time
 * evaluation is: the published-constant object literals, the arithmetic in
 * `DOTS_SMALLEST_PRINTABLE_SCORE`, and one `Symbol('dots.coefficient')` (see THE
 * COEFFICIENT IS NOT A NUMBER below). All of it allocates and reads inside this
 * file only — no clock, no global, no I/O.
 *
 * DISCLOSED, because the previous wording claimed more than it could: it used to
 * say "no function's output depends on which symbol instance it got". Within one
 * module instance that is true and uninteresting — there is only one instance.
 * Across TWO instances it is false, and `Symbol()` is unregistered precisely so
 * that two instances get two different keys. Load this file twice (two copies in
 * a bundle, a mixed ESM/CJS graph, a test that re-imports with a fresh registry)
 * and a `DotsCoefficient` minted by copy A has no readable value under copy B's
 * key: `applyDotsCoefficient` would multiply `undefined` and yield NaN. That is
 * exotic, it is untested here, and engineering around it — `Symbol.for`, a global
 * registry — would trade a scenario nobody has hit for ambient global state the
 * purity contract forbids. So it is written down rather than defended against.
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
 * The ONLY unit this module scores. Not a preference and not tunable: the
 * published polynomial is a fit over kilogram bodyweights and returns points per
 * kilogram of total. There is no lb coefficient set to switch to.
 *
 * Matched by string equality against `TotalReading.unit`, so it is spelled the
 * way `meet.ts` spells it. `dots.test.ts` pins the two spellings together against
 * the real module.
 */
export const DOTS_TOTAL_UNIT = 'kg';

/**
 * Kilograms in one pound. EXACT BY DEFINITION, not measured and not rounded:
 * the 1959 International Yard and Pound Agreement defines the international
 * avoirdupois pound as exactly 0.45359237 kg. It is a published constant in the
 * same sense the coefficients above are, and for the same reason it is not to be
 * "simplified" to 0.4536 or replaced by a reciprocal of 2.2046.
 *
 * (OpenPowerlifting divides by an f32 `2.2046225` in
 * `crates/opltypes/src/weightkg.rs` and says so in a comment on the type —
 * "Conversion between kilograms and pounds is lossy due to rounding" — because
 * it is round-tripping fixed-point hundredths. We are not round-tripping, so we
 * use the definition rather than its f32 reciprocal.)
 */
export const KILOGRAMS_PER_POUND = 0.45359237;

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
 *
 * Documentation, not the check itself: the helpers ask "does this round to
 * zero?" so there is exactly one rule, and the suite pins this constant against
 * that behaviour at the boundary.
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
//   8. `formatDotsDelta(n - b)` where either end came from
//      `hasDotsScore(o) ? o.score : 0` — the SUBTRACTION side of the same
//      collapse, and the last one that was still open. A delta used to be a
//      plain `number`, so one guarded end and one collapsed end compiled and
//      printed a lifter who did not total as "−445.38". A delta is now a minted
//      `DotsDelta` and a bare subtraction is not one.
//
// WHAT THROWS AT RUNTIME (for the casts and the `as any`s a type cannot see):
//
//   - `officialTotalKg(0)`, and therefore `officialTotalKg(finalMeetTotal(state) ?? 0)`.
//     A total of exactly 0 is refused with an error naming the collapse.
//     `meet.ts` cannot produce a 0 either — UNDER ITS DEFAULT RULES, which is the
//     only form of that sentence this module gets to say. `DEFAULT_MEET_RULES`
//     puts `barAndCollarsWeight` at `MIN_LOADABLE_WEIGHT_KG` (25 kg — bar plus
//     collars) on all three lifts, nothing below the bar can be declared, and so a
//     meet run on those rules finishes with at least ~75 kg or reports `null`.
//     `barAndCollarsWeight` is per-lift caller-configurable and `validateMeetRules`
//     asks only that it be finite and positive, so a federation config with a 1 kg
//     bar can record a 3 kg total, and one with a 0.001 kg bar can record a total
//     whose DOTS score rounds to "0.00" and is refused downstream. That is a
//     nonsense federation, not a reachable game state — but it is the true
//     statement, and dots.test.ts drives a REAL minimum-weight meet through
//     `meet.ts` to pin the ~37 DOTS floor rather than asserting it from a
//     constant, so deleting `meet.ts`'s floor fails a test here.
//     No federation records a 0 kg total. Every 0 arriving here is a bug, and
//     refusing it names the bug where it happens instead of quietly printing
//     "0.00" onto a leaderboard.
//   - `dotsScore` / `evaluateDots` re-check the total they were handed, so a
//     forged brand still fails.
//   - `roundDotsScore` / `formatDotsScore` refuse a score that is not positive,
//     and refuse one that would ROUND to "0.00" (see
//     `DOTS_SMALLEST_PRINTABLE_SCORE`). A *delta* is a different thing and has
//     its own pair of helpers that accept negatives and zero.
//   - `dotsDeltaBetweenScores({ previousScore, currentScore })` checks BOTH ends
//     against that same rule, so the collapsed `0` from
//     `hasDotsScore(o) ? o.score : 0` throws at the mint rather than becoming
//     the far end of a delta. This is the runtime half of item 8: the type stops
//     the bare subtraction, the mint stops the rewrite that routes it through.
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
//   - A cast (`x as OfficialTotalKg`, `x as DotsDelta`) defeats either brand,
//     exactly as a cast defeats the opaque rules in `meet.ts`. A delta is the
//     softer of the two: `dotsDeltaBetweenScores` can be handed two scores that
//     are real but belong to different lifters, and no type can see that. What
//     it does catch is a zero on either end, which is the shape the collapse
//     actually takes. None of this is tamper-resistance;
//     authority over results belongs on the server (CLAUDE.md
//     "Server-authoritative progression"). It closes the accidents that used to
//     typecheck and look innocent in a diff, and claims nothing beyond that.
//   - `applyDotsCoefficient(c, officialTotalKg(1))` compiles, needs no cast, and
//     hands back the coefficient as a bare, multipliable `number` — `x * 1 === x`
//     exactly in IEEE 754, so that call IS the `dotsCoefficientValue` this module
//     declines to export, spelled with two calls instead of one. `bare * 360`
//     then formats as "229.05": defence B above, rebuilt from outside the module
//     for a lifter who did not total. THE OPAQUE COEFFICIENT STOPS THE
//     ARITHMETIC, NOT THE ACCESS: `dotsCoefficient(...) * totalOnTheBoard(state)`
//     is TS2362, and that is the line glue code actually reaches for. Reading the
//     number instead costs an explicit `officialTotalKg(...)` — the same
//     written-down, greppable claim the total path already demands, and
//     `officialTotalKg(1)` is no more innocent in a diff than the
//     `officialTotalKg(totalOnTheBoard(state))` in the first bullet. `dots.test.ts`
//     uses this route on purpose (its reference tables have to compare numbers)
//     and executes it in 'the numeric accessor this module does not export', so
//     the paragraph you are reading cannot go stale without a test failing.
//     Reflection gets there too, with a cast rather than a mint:
//     `Object.getOwnPropertySymbols(c)[0]` names the private key at runtime, so
//     "module-private symbol" is a fact about typechecking, not about the object.
//
// ---------------------------------------------------------------------------
// UNITS — A POUND TOTAL IS NOT A SMALL KILOGRAM TOTAL
// (the same defect as NO TOTAL above, one field over)
// ---------------------------------------------------------------------------
//
// DOTS is defined in kilograms. The published polynomial is a curve fit over
// kilogram bodyweights and returns points per kilogram of total; there is no
// pound coefficient set, and `DOTS_BODYWEIGHT_DOMAIN_KG`'s 40–210 band is a kg
// band. `DOTS_TOTAL_UNIT` names the one unit this module scores.
//
// `meet.ts` runs a meet in EITHER unit. `POUND_MEET_RULES` is exported, passes
// `validateMeetRules`, and `meet.test.ts` drives a full pound meet through it —
// this is a supported configuration, not a hypothetical. And a pound total is not
// self-evidently a pound total: 1267.5 is a perfectly ordinary kg total for a
// superheavyweight, so nothing about the NUMBER gives the unit away.
//
// WHAT USED TO HAPPEN, through the front door this module advertises:
//
//     evaluateMeetDots('male', 93, readTotal(poundMeet))   // 806.45
//     evaluateMeetDots('male', 93, readTotal(sameMeetInKg)) // 365.76
//
// 2.2x wrong, formatted to two decimals, nothing marking it — and past 700 DOTS,
// which this module's own plausibility test says no human result reaches.
// `officialTotalFromMeet` was documented as "the checked mint", and this was the
// check it did not have.
//
// WHAT CLOSES IT:
//
//   - The unit TRAVELS. `MeetLoadingRules.unit` is required (it is not derivable
//     from the numbers), `readTotal` stamps it onto every `TotalReading`, and
//     `MeetTotalReading` here requires it, so a reading without one does not
//     compile at `officialTotalFromMeet` or `evaluateMeetDots`.
//   - A reading that is not in kilograms is REFUSED, on every case including the
//     two that carry no total, so the bug fires on the first poll rather than on
//     the first meet that finishes.
//
// WHY REFUSE RATHER THAN CONVERT, given that lb->kg is exact by definition
// (`KILOGRAMS_PER_POUND`) and this module could obviously do the multiply:
//
//   - A DOTS score needs TWO numbers in kilograms. The total arrives from
//     `meet.ts` with its unit attached; the bodyweight arrives from the CALLER as
//     a bare `number` named `bodyweightKg`, and this module cannot see whether
//     that name is true. Converting the total while trusting the bodyweight turns
//     a 2.2x overstatement into a roughly 2.2x understatement — a different wrong
//     number, produced by a module that now claims to handle units.
//   - The two units are genuinely independent facts, not one fact spelled twice.
//     OpenPowerlifting's checker carries exactly this warning
//     (`checker/src/checklib/entries.rs`): "Either the meet is in pounds, or in
//     kilos. However, note that international meets often do weigh-in in pounds,
//     but lifting in kilos, so keep those separate."
//   - CLAUDE.md's precedent: `e1rm.ts` refuses past the RPE chart's coverage
//     rather than extrapolating. A wrong DOTS score is worse than no DOTS score,
//     and a refusal that names the remedy costs the caller one explicit line.
//
// WHAT IS DELIBERATELY NOT CLOSED HERE:
//
//   - The BODYWEIGHT is still a bare `number` on `dotsScore` / `evaluateDots` /
//     `evaluateMeetDots`. It does not cross a module boundary — no game module
//     produces it — so there is no reading to attach a unit to, and branding it
//     would change every call site in the codebase to close a hazard nobody has
//     hit. A caller who converts a pound meet must convert BOTH numbers; the
//     refusal message says so in as many words, and that is the whole of the
//     defence on that axis. Stated rather than defended, on purpose.
//   - `officialTotalKg(kilogramsFromPounds(reading.total))` compiles and scores
//     correctly. That IS the intended escape: two named calls, both greppable,
//     one of which is the module's existing written-down assertion. What it is not
//     is silent.
//   - A caller can still write `unit: 'kg'` on a hand-built reading that is not in
//     kilograms. Same class as `officialTotalKg(totalOnTheBoard(state))` in the
//     block above: a lie the caller has to type out. Nothing here is
//     tamper-resistance.
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
 * Type-level brand for `DotsDelta`. Declared, never defined, same as above.
 */
declare const DOTS_DELTA_BRAND: unique symbol;

/**
 * The difference between two DOTS scores, in DOTS points — the "+12.40 DOTS"
 * call-out on a recap screen (GDD §6.5). Nominal, for the same reason
 * `OfficialTotalKg` is: the arithmetic that produces a delta is a subtraction,
 * and a subtraction is exactly where a lifter with no score gets one.
 *
 *     const b = hasDotsScore(before) ? before.score : 0;
 *     const n = hasDotsScore(now)    ? now.score    : 0;   // bombed out
 *     formatDotsDelta(n - b);                              // "−445.38", a lie
 *
 * `n - b` is a plain `number`, so that line does not typecheck any more. Mint a
 * delta with `dotsDeltaBetween` (two `ScoredDots`, structural) or
 * `dotsDeltaBetweenScores` (two bare scores, each checked at runtime). Both
 * demand two ends that really scored, which is what makes the docstring on
 * `roundDotsDelta` a property of the code rather than a promise about it.
 *
 * It IS a number at runtime and stays assignable to `number`, so a delta can be
 * compared, stored and summed normally.
 */
export type DotsDelta = number & { readonly [DOTS_DELTA_BRAND]: 'dots' };

/**
 * The shape of `meet.ts`'s `readTotal(state)`, declared structurally here rather
 * than imported, because this module imports nothing (see the purity contract).
 * A real `TotalReading` is assignable to it; a bare `number` is not, which is
 * what stops `totalOnTheBoard(state)` from being routed in as a result.
 *
 * `dots.test.ts` pins the match by feeding an actual `readTotal(state)` through
 * `officialTotalFromMeet` for all three of its cases — if `TotalReading` ever
 * changes shape, that test stops compiling.
 *
 * `unit` is REQUIRED on every case, including the two that carry no total. Two
 * reasons, and both are about failing early rather than plausibly:
 *
 *   - Required, so an object literal without one does not compile here. That is
 *     what makes "the unit travels with the number" a property of the code
 *     rather than a convention; see UNITS below.
 *   - On every case, so a caller wired to a pound meet finds out on the first
 *     reading it polls rather than on the first meet that finishes with a total.
 *
 * Typed `string`, not `'kg' | 'lb'`, on purpose. This module cannot import
 * `meet.ts`'s `MeetWeightUnit`, and if it hard-coded today's union then a unit
 * added over there later would be a COMPILE error here — which a builder in a
 * hurry fixes by widening the union, and the new unit is silently scored as
 * kilograms. `string` means anything this module has not been taught is REFUSED
 * at runtime instead. The permissive type is the fail-safe direction.
 */
export type MeetTotalReading =
  /** Still lifting: there is no total yet, only what is on the board. */
  | { readonly kind: 'in-progress'; readonly total: null; readonly unit: string }
  /** Meet over with a total. The only case that yields an official total. */
  | { readonly kind: 'final'; readonly total: number; readonly unit: string }
  /** Meet over with a bombed lift: NO total, which is not a total of zero. */
  | { readonly kind: 'no-total'; readonly total: null; readonly unit: string };

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
 * line above a compile error — TS2362, "The left-hand side of an arithmetic
 * operation must be of type 'any', 'number', 'bigint' or an enum type" — rather
 * than a plausible number on a leaderboard.
 *
 * Everything anyone legitimately wants from a coefficient is here:
 *
 *   - `applyDotsCoefficient(c, total)` — the score. Demands an `OfficialTotalKg`.
 *   - `formatDotsCoefficient(c)` — the display string, for a "Coeff" column.
 *   - `compareDotsCoefficients(a, b)` — ordering, for a board or a test.
 *   - the readable fields below — which lifter and which domain it belongs to.
 *
 * WHAT THIS BUYS, STATED NARROWLY BECAUSE THE NARROW CLAIM IS THE TRUE ONE: the
 * coefficient cannot be turned into a score by ARITHMETIC ON THE COEFFICIENT. The
 * line above is a compile error; so is `scored.coefficient * anything`. That is
 * the line glue code reaches for, and it is closed.
 *
 * It does NOT put the number out of reach, and this module does not get to claim
 * it does. There is no export named `dotsCoefficientValue`, but
 * `applyDotsCoefficient(c, officialTotalKg(1))` returns the coefficient itself —
 * exactly, because `x * 1 === x` in IEEE 754 — with no cast and no `any`, and
 * reflection over the private symbol reaches the same number with a cast. Both
 * routes are written up under WHAT IS DELIBERATELY NOT CLOSED, and `dots.test.ts`
 * executes them, so this paragraph cannot rot back into a guarantee. What the
 * opacity costs a caller who wants the number is one explicit
 * `officialTotalKg(...)`: the same greppable, written-down claim the total path
 * already demands, in place of an invisible `*`. That is a defence against
 * accidents, not against intent — see the tamper-resistance note in that block.
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
 * THE definition of "a real DOTS score" in this module: finite, strictly
 * positive, and not so small it would render as "0.00".
 *
 * The check is about ROUNDING TO ZERO, not about the sign. `0.004` is positive
 * and still prints "0.00", which is the string this module exists to keep off a
 * result card, so it fails here too.
 *
 * Written once because two guards ask it — the score display helpers, and the
 * per-operand guard on the delta mint (`dotsDeltaBetweenScores`). They throw
 * different messages, because the caller's mistake is a different mistake, but
 * they must never disagree about what a score is.
 */
function isPrintableScore(score: number): boolean {
  return Number.isFinite(score) && score > 0 && roundToDisplayDecimals(score) !== 0;
}

/**
 * A SCORE — not a delta — must be printable. See `isPrintableScore`; this adds
 * the two messages that name which half of the rule the caller broke.
 */
function assertPrintableScore(score: number): void {
  assertUsableNumber(score, 'score');
  if (isPrintableScore(score)) {
    return;
  }
  if (score <= 0) {
    throw new RangeError(
      `dots: a DOTS score is strictly positive, received ${score}. A lifter with no total ` +
        'has no score to print — render DOTS_NO_TOTAL_DISPLAY (via formatDotsOutcome) ' +
        'instead of formatting a 0. If this is a DIFFERENCE between two scores, it is a ' +
        'delta, not a score: mint one with dotsDeltaBetween / dotsDeltaBetweenScores and ' +
        'print it with formatDotsDelta, which accepts negatives.',
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
 * Convert pounds to kilograms.
 *
 * Here rather than in a units module because this module imports nothing (see
 * the purity contract) and the refusal in `officialTotalFromMeet` names this
 * function by name — a refusal that cannot say what to do instead just relocates
 * the problem.
 *
 * IT IS NOT, ON ITS OWN, A BRIDGE FROM A POUND MEET TO A DOTS SCORE. A DOTS
 * score needs BOTH the total and the bodyweight in kilograms, and `meet.ts` hands
 * this module only the first. Converting one and trusting the other swaps a 2.2x
 * overstatement for a different wrong number. See UNITS.
 *
 * @throws RangeError on a non-finite input.
 */
export function kilogramsFromPounds(pounds: number): number {
  assertUsableNumber(pounds, 'pounds');
  return pounds * KILOGRAMS_PER_POUND;
}

/**
 * Refuse a reading whose weights are not in kilograms.
 *
 * Runs on EVERY case, not just `'final'`, so a caller wired to a pound meet
 * finds out on the first reading it polls rather than on the first meet that
 * finishes with a total. A bug that only fires on success is the worst kind to
 * ship: it looks like it works right up until it produces a leaderboard.
 */
function assertKilogramReading(reading: MeetTotalReading): void {
  if (reading.unit === DOTS_TOTAL_UNIT) {
    return;
  }
  const shown = reading.total === null ? reading.kind : String(reading.total);
  throw new RangeError(
    `dots: this meet's weights are in ${JSON.stringify(reading.unit)}, and DOTS is defined only ` +
      `in ${DOTS_TOTAL_UNIT} — its published polynomial is fitted on kilogram bodyweights. ` +
      `Scoring ${shown} as kilograms would print a plausible number that is wrong by the ` +
      'conversion factor (a 1267.5 lb total scored 806.45 where the truth was 365.76), and this ' +
      'module refuses rather than guessing. It does NOT convert for you: a DOTS score needs the ' +
      'BODYWEIGHT in kg as well, and that number is the caller’s, not the meet’s — ' +
      'international meets weigh in in pounds and lift in kilos, so the two units are separate ' +
      'facts and this module can only see one of them. Convert the whole entry at the call site ' +
      '(kilogramsFromPounds for both the total and the bodyweight) and mint the result with ' +
      'officialTotalKg, so the claim is written down where someone can check it.',
  );
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
 *
 * WHAT "CHECKED" MEANS, now that it means something: it checks the KIND, so a
 * provisional or missing total cannot be minted, AND it checks the UNIT, so a
 * total that is not in kilograms is refused instead of scored. It used to check
 * only the first, and a `POUND_MEET_RULES` meet — an exported, tested, first-class
 * configuration — minted straight through it. See UNITS.
 *
 * @throws RangeError if the reading is not in kilograms, or if a `'final'`
 *         reading carries a total that is not a positive finite number.
 */
export function officialTotalFromMeet(reading: MeetTotalReading): OfficialTotalKg | null {
  assertKilogramReading(reading);
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
 * The coefficient as a result sheet would print it, e.g. `"0.6363"`.
 *
 * A string, deliberately: a display helper has no business being the numeric
 * accessor, and a "Coeff" column wants the rounded text anyway. That is a fact
 * about THIS function, not a guarantee about the module — see WHAT IS
 * DELIBERATELY NOT CLOSED for the route that does hand the number back.
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
 *
 * A meet that is not in kilograms THROWS rather than coming back as
 * `'no-total'`, because that lifter may well have totalled — saying they did not
 * would be the same lie in the other direction. It is the caller's integration
 * that is wrong, and the error says how to fix it. See UNITS.
 *
 * @param bodyweightKg Bodyweight in kg. This module cannot check that claim —
 *        the parameter name is the whole of the guarantee. If the meet was run
 *        in pounds, the lifter was probably weighed in pounds too; convert both.
 * @throws RangeError if the reading is not in kilograms, or on a bodyweight that
 *         is not a positive finite number.
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
//     Takes a bare `number`: a score is what this module computes, so there is
//     nothing to mint.
//   - a delta is the difference between two scores — the "+12.40 DOTS" call-out
//     on a recap (GDD §6.5). Legitimately negative, and legitimately zero, which
//     is why it cannot lean on the sign checks a score uses. It takes a minted
//     `DotsDelta` instead, so the two ends have to have scored.
// ---------------------------------------------------------------------------

/**
 * Round a DOTS score for display, to the number of decimals federations use.
 * @throws RangeError unless the score is finite, positive, and large enough to
 *         print as something other than "0.00". For a difference between two
 *         scores, mint a delta (`dotsDeltaBetween`) and use `roundDotsDelta`.
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

// --- Minting a delta --------------------------------------------------------
//
// A delta is a subtraction, and a subtraction is where a lifter with no score
// gets one. So, exactly like a total, a delta cannot be written down as a bare
// number: it is minted, and both mints demand two ends that really scored.
// See `DotsDelta`.

/** The two ends of a delta, named so the direction cannot be got backwards. */
export interface DotsDeltaEndpoints {
  /** Where the lifter was — the earlier meet. */
  readonly previous: ScoredDots;
  /** Where the lifter is now — the meet being recapped. */
  readonly current: ScoredDots;
}

/** The same two ends as bare DOTS scores, for endpoints that arrive as numbers. */
export interface DotsDeltaScoreEndpoints {
  /** The earlier DOTS score. Must be a real score (see `isPrintableScore`). */
  readonly previousScore: number;
  /** The current DOTS score. Must be a real score. */
  readonly currentScore: number;
}

/**
 * The per-operand guard on the raw-score mint. Same rule as the score display
 * helpers (`isPrintableScore`), different message: the caller here is not trying
 * to print a score, they are trying to draw a line between two lifters who
 * placed, and a 0 on either end means one of them did not.
 */
function assertDeltaEndpointScore(score: number, label: string): void {
  assertUsableNumber(score, label);
  if (isPrintableScore(score)) {
    return;
  }
  throw new RangeError(
    `dots: ${label} must be a real DOTS score, received ${score}. A delta is the gap between ` +
      'two results that both placed. A lifter who did not total has no score to be the far ' +
      'end of it — `hasDotsScore(o) ? o.score : 0` is that collapse wearing a zero, and it ' +
      'renders as a large negative delta for someone who was never on the board. There is no ' +
      'delta to show: show DOTS_NO_TOTAL_DISPLAY, or no call-out at all.',
  );
}

/**
 * The structural mint: a delta between two results that both placed. It cannot
 * be handed an outcome with no score, because `ScoredDots` is the narrowed
 * branch and `NoTotalDots` has no `score` field to supply one.
 *
 * It delegates to the raw mint below, so it throws on exactly what that throws
 * on — including on calls that typecheck. `ScoredDots` means "this lifter has a
 * score", not "this score is printable": mint an absurd total with
 * `officialTotalKg(0.004)` and `evaluateDots` hands back a properly-typed
 * `ScoredDots` whose score is ~0.0025, which rounds to "0.00" and is refused at
 * the endpoint guard. So the claim is NOT "a call that typechecks cannot throw",
 * and it is not "only a forced call can". It is that nothing a meet run on
 * `DEFAULT_MEET_RULES` produces gets near the guard — the smallest score
 * reachable from such a meet is ~37 DOTS, because those rules put the bar at
 * `MIN_LOADABLE_WEIGHT_KG` on all three lifts and nothing below the bar can be
 * declared — so a throw here means the mint upstream was handed something that
 * was never a total, which is the thing it exists to say.
 *
 * "DEFAULT" is doing real work in that sentence and is not a hedge:
 * `MeetLoadingRules.barAndCollarsWeight` is per-lift caller-configurable and
 * `validateMeetRules` requires only that it be finite and positive, so a
 * federation config with an absurdly light bar CAN record a total whose score
 * rounds to "0.00". `dots.test.ts` drives the floor through a real `meet.ts` meet
 * rather than multiplying a constant by three, so the sentence is checked rather
 * than asserted.
 *
 * Holding two `DotsOutcome`s rather than two `ScoredDots`? Narrow both first,
 * and mean it — a missing end is not a delta of anything:
 *
 *     const delta =
 *       hasDotsScore(previous) && hasDotsScore(current)
 *         ? dotsDeltaBetween({ previous, current })
 *         : null;              // no call-out, not "−445.38"
 */
export function dotsDeltaBetween(endpoints: DotsDeltaEndpoints): DotsDelta {
  return dotsDeltaBetweenScores({
    previousScore: endpoints.previous.score,
    currentScore: endpoints.current.score,
  });
}

/**
 * The asserted mint: a delta between two DOTS scores that arrive as bare
 * numbers — a stored score on a server row, a seeded NPC's recorded result, a
 * test fixture.
 *
 * THE CALLER IS CLAIMING BOTH ENDS ARE REAL SCORES, and unlike `officialTotalKg`
 * that claim is partly checkable: each end is run through the module's own
 * definition of a score, so the `? outcome.score : 0` collapse throws here
 * instead of printing. What no check can catch is a number that is a plausible
 * score but the wrong lifter's; that is the caller's business.
 *
 * @throws RangeError if either end is not finite, is not positive, or is small
 *         enough to round to "0.00" — i.e. is not a score a result sheet could
 *         print.
 */
export function dotsDeltaBetweenScores(endpoints: DotsDeltaScoreEndpoints): DotsDelta {
  assertDeltaEndpointScore(endpoints.previousScore, 'previousScore');
  assertDeltaEndpointScore(endpoints.currentScore, 'currentScore');
  return (endpoints.currentScore - endpoints.previousScore) as DotsDelta;
}

/**
 * Round a DOTS delta — a difference between two scores — for display.
 *
 * Unlike a score, a delta may be negative (the lifter went backwards) or zero
 * (they scored the same), and neither is an error.
 *
 * WHAT THIS DOES AND DOES NOT GUARANTEE. A `DotsDelta` can only be minted from
 * two ends that scored: `dotsDeltaBetween` takes two `ScoredDots`, and
 * `dotsDeltaBetweenScores` throws on an end that is not a printable score. So
 * the collapse below no longer reaches this function — the subtraction yields a
 * plain `number`, which is not a `DotsDelta`, and routing its `0` through the
 * mint throws:
 *
 *     const b = hasDotsScore(before) ? before.score : 0;
 *     const n = hasDotsScore(now)    ? now.score    : 0;
 *     formatDotsDelta(n - b);        // was "−445.38"; now a type error
 *
 * A cast (`x as DotsDelta`) still defeats this, exactly as a cast defeats
 * `OfficialTotalKg` — see WHAT IS DELIBERATELY NOT CLOSED. The claim is that the
 * accident cannot be written, not that the module is tamper-proof.
 *
 * THE INPUT GUARD IS NOT THE WHOLE GUARD, which the previous wording ("reachable
 * only via a cast") got wrong. Rounding multiplies by `10 ** DOTS_DISPLAY_DECIMALS`
 * first, and that multiply can overflow a finite input to `Infinity`:
 * `dotsDeltaBetweenScores({ previousScore: 1, currentScore: 1.7e308 })` mints a
 * finite delta with no cast at all, and `1.7e308 * 100` is not finite. So the
 * ROUNDED value is checked too, and the message names the overflow rather than
 * blaming a cast that was never made. No real pair of scores comes within 300
 * orders of magnitude of this; it is here so the docstring is true.
 *
 * @throws RangeError if the delta is not finite, or if rounding it overflows.
 */
export function roundDotsDelta(delta: DotsDelta): DotsDelta {
  assertUsableNumber(delta, 'delta');
  const rounded = roundToDisplayDecimals(delta);
  if (!Number.isFinite(rounded)) {
    throw new RangeError(
      `dots: a delta of ${delta} overflows to ${String(rounded)} when rounded to ` +
        `${DOTS_DISPLAY_DECIMALS} decimals, so there is nothing to print. Both ends were real ` +
        'scores by this module\'s own rule, which is why no cast was needed to get here — but a ' +
        'DOTS score that large is not a result, it is a bug upstream in whatever minted the ' +
        'total.',
    );
  }
  return rounded as DotsDelta;
}

/**
 * Format a DOTS delta with an explicit sign, e.g. `"+12.40"`, `"−2.31"`,
 * `"0.00"` — the PR call-out on a recap screen (GDD §6.5).
 *
 * The sign is chosen from the ROUNDED value, so a delta of -0.001 prints
 * `"0.00"` rather than `"−0.00"`.
 *
 * Takes a minted `DotsDelta`; see `roundDotsDelta` for what that buys.
 *
 * @throws RangeError if the delta is not finite, or if rounding it overflows —
 *         see `roundDotsDelta`, which is where both checks live.
 */
export function formatDotsDelta(delta: DotsDelta): string {
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
