/**
 * Estimated one-rep max (e1RM).
 *
 * PURE MODULE (CLAUDE.md "Pure logic is separate from UI"):
 * zero React imports, zero side effects, zero I/O, explicit return types.
 *
 * ---------------------------------------------------------------------------
 * PUBLISHED FORMULAS — implemented verbatim, nothing blended or homebrewed
 * ---------------------------------------------------------------------------
 *
 * Epley (Boyd Epley, Univ. of Nebraska strength program, 1985):
 *
 *     e1RM = w * (1 + r / 30)
 *
 *   Commonly published in decimal form as `w * (1 + 0.0333 * r)`; 0.0333 is
 *   just a rounding of 1/30, so the exact rational form is used here.
 *
 * Brzycki (Matt Brzycki, 1993):
 *
 *     e1RM = w * 36 / (37 - r)
 *
 *   Commonly published in decimal form as `w / (1.0278 - 0.0278 * r)`;
 *   1.0278 = 37/36 and 0.0278 = 1/36, so again the exact rational form is
 *   used here rather than the rounded decimals.
 *
 * Known relationships between the two (useful sanity checks, see tests):
 *   - They return exactly the same value at r = 10 (both are 4/3 * w).
 *   - Below 10 reps Epley reads higher; above 10 reps Brzycki reads higher.
 *
 * ---------------------------------------------------------------------------
 * THE SINGLE-REP CASE — the one place these two formulas disagree by design
 * ---------------------------------------------------------------------------
 *
 * A set of 1 rep at weight w *is* a demonstrated 1RM of at least w, so any
 * honest estimator must return exactly w at r = 1.
 *
 *   - Brzycki does this naturally: 36 / (37 - 1) = 36/36 = 1, so e1RM = w.
 *   - Epley does NOT: 1 + 1/30 = 1.0333..., so the raw curve would claim a
 *     lifter who hit a single at 200kg has a 206.67kg max. That is not a
 *     conservative estimate, it is a wrong one — the observation is exact.
 *
 * So `epleyE1rm` applies one explicit, narrow rule: at r = 1 it returns w.
 * For r >= 2 the published Epley curve is used unmodified. This is a domain
 * convention about where the formula's domain starts (Epley describes
 * *sub-maximal* multi-rep sets), not a tweak to the curve's shape. It is
 * asserted in the tests, including an assertion that r >= 2 still matches the
 * raw published formula to the last bit.
 *
 * ---------------------------------------------------------------------------
 * WHERE THESE FORMULAS STOP BEING TRUE
 * ---------------------------------------------------------------------------
 *
 * Both are linear-ish fits to sub-maximal sets and are only trustworthy in low
 * rep ranges. Validation work puts error in the low single-digit percent for
 * roughly 2-10 reps and degrading past that, because past ~10 reps the set is
 * limited by local muscular endurance rather than by maximal strength — and
 * endurance varies enormously between lifters, lifts, and training histories.
 * Two lifters with the same true 1RM can differ by many reps at 70%.
 *
 * Practical consequences encoded below:
 *   - `isHighConfidenceRepRange` marks the 1-10 window; UI should caveat or
 *     de-emphasise an e1RM computed outside it rather than presenting it as a
 *     hard number.
 *   - `E1RM.MAX_SUPPORTED_REPS` is a hard input guard. It is a game-side
 *     decision, NOT part of either published formula. Brzycki additionally has
 *     a pole at r = 37 (denominator 37 - r hits zero, then goes negative), so
 *     an unguarded high-rep input is not merely inaccurate, it is nonsense.
 *
 * ---------------------------------------------------------------------------
 * UNITS
 * ---------------------------------------------------------------------------
 *
 * Both formulas are linear in weight, so they are unit-agnostic: kg in -> kg
 * out, lb in -> lb out. Do not convert inside this module. (GDD §11 leaves the
 * default display unit open; that is a presentation decision, not a math one.)
 *
 * Results are returned at full float precision. Rounding to a displayable or
 * loadable number (plate math, 2.5kg increments, etc.) belongs to the caller.
 */

/**
 * Every numeric constant this module depends on, in one place, so the published
 * values can be checked at a glance against source material.
 *
 * These are *formula* constants, not game-feel constants — EPLEY_REP_DIVISOR
 * and the Brzycki pair are published values and must not be "tuned". The two
 * rep-range bounds are ours and may be adjusted.
 */
export const E1RM = {
  /** Epley: e1RM = w * (1 + r / 30). Published. Do not tune. */
  EPLEY_REP_DIVISOR: 30,
  /** Brzycki: e1RM = w * 36 / (37 - r). Published. Do not tune. */
  BRZYCKI_NUMERATOR: 36,
  /** Brzycki: the 37 in (37 - r). Published. Do not tune. */
  BRZYCKI_REP_OFFSET: 37,
  /** Fewest reps a set can have. A set of zero reps is a miss, not an estimate. */
  MIN_REPS: 1,
  /**
   * Upper bound of the range where these formulas are considered trustworthy.
   * Ours, not published — derived from the validation literature putting error
   * in the low single-digit percent up to about ten reps.
   */
  HIGH_CONFIDENCE_MAX_REPS: 10,
  /**
   * Hard input guard. Ours, not published. Well below Brzycki's pole at 37
   * reps, and past the point where either formula means anything for a
   * strength athlete. Inputs above this are rejected rather than silently
   * producing a fantasy number.
   */
  MAX_SUPPORTED_REPS: 20,
} as const;

/**
 * The formula the rest of the codebase uses, for display attribution
 * ("e1RM 227.5kg (Epley)"). Kept next to the implementation so a label can
 * never drift from the math behind it.
 */
export const E1RM_FORMULA_NAME = 'Epley' as const;

/**
 * Validates a (weight, reps) observation. Throws rather than returning NaN or
 * a sentinel: a bad set record is a bug upstream, and an e1RM silently
 * becoming NaN would propagate straight into Total and progression.
 *
 * @throws {RangeError} on non-finite/non-positive weight, or on reps outside
 * [E1RM.MIN_REPS, E1RM.MAX_SUPPORTED_REPS], or on fractional reps.
 */
function assertValidSet(weight: number, reps: number): void {
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new RangeError(`e1RM: weight must be a finite number greater than 0, received ${weight}`);
  }
  if (!Number.isInteger(reps)) {
    throw new RangeError(`e1RM: reps must be a whole number, received ${reps}`);
  }
  if (reps < E1RM.MIN_REPS || reps > E1RM.MAX_SUPPORTED_REPS) {
    throw new RangeError(
      `e1RM: reps must be between ${E1RM.MIN_REPS} and ${E1RM.MAX_SUPPORTED_REPS}, received ${reps}`,
    );
  }
}

/**
 * Epley: e1RM = w * (1 + r / 30), with the single-rep case returning w exactly
 * (see the module header for why the raw curve's 1.0333 * w is wrong there).
 *
 * @param weight Weight lifted, any unit.
 * @param reps Whole reps completed, 1..E1RM.MAX_SUPPORTED_REPS.
 */
export function epleyE1rm(weight: number, reps: number): number {
  assertValidSet(weight, reps);
  if (reps === E1RM.MIN_REPS) {
    return weight;
  }
  return weight * (1 + reps / E1RM.EPLEY_REP_DIVISOR);
}

/**
 * Brzycki: e1RM = w * 36 / (37 - r). Needs no special case at 1 rep — the
 * formula already returns w there — but the guard is kept for symmetry of
 * behaviour with `epleyE1rm` and to make that property explicit at the call
 * site rather than an accident of arithmetic.
 *
 * @param weight Weight lifted, any unit.
 * @param reps Whole reps completed, 1..E1RM.MAX_SUPPORTED_REPS.
 */
export function brzyckiE1rm(weight: number, reps: number): number {
  assertValidSet(weight, reps);
  return (weight * E1RM.BRZYCKI_NUMERATOR) / (E1RM.BRZYCKI_REP_OFFSET - reps);
}

/**
 * THE e1RM ENTRY POINT FOR THE WHOLE CODEBASE. Use this, not the two formulas
 * directly — those are exported for comparison, tests, and any future
 * "show me both" tooling.
 *
 * It is Epley. Reasons, in order:
 *
 *  1. This game lives in low reps. A powerlifting sim's sets are singles,
 *     doubles, and triples with the occasional five; validation work on
 *     powerlifting-style lifters finds Epley closest to tested 1RM in that
 *     2-5 rep window (Brzycki's edge shows up at 6-10, which we will rarely
 *     touch for the competition lifts).
 *  2. Epley is well-behaved across the whole input domain. Brzycki has a pole
 *     at 37 reps and returns negative numbers beyond it. Epley just keeps
 *     climbing, so an out-of-range input degrades into an over-estimate rather
 *     than a sign flip.
 *  3. Its single quirk — the 1-rep case — is handled once, here, explicitly,
 *     and tested. Brzycki's quirk is a discontinuity we would have to guard
 *     against forever.
 *
 * If this choice is ever revisited, change it here and only here. Every
 * consumer of e1RM in the app must go through this function so that Total,
 * progression, and opener suggestions can never be computed off two different
 * curves.
 *
 * @param weight Weight lifted, any unit; the return value is in that same unit.
 * @param reps Whole reps completed, 1..E1RM.MAX_SUPPORTED_REPS.
 * @returns Estimated 1RM at full precision; caller rounds for display.
 */
export function estimateE1rm(weight: number, reps: number): number {
  return epleyE1rm(weight, reps);
}

/**
 * True when `reps` falls in the range where an e1RM estimate is trustworthy
 * (1..10). Outside it the number is still returned, but UI should present it
 * as an estimate with a caveat rather than as a fact — see the module header
 * on why high-rep sets stop measuring maximal strength.
 */
export function isHighConfidenceRepRange(reps: number): boolean {
  return (
    Number.isInteger(reps) && reps >= E1RM.MIN_REPS && reps <= E1RM.HIGH_CONFIDENCE_MAX_REPS
  );
}
