/**
 * Estimated one-rep max (e1RM).
 *
 * PURE MODULE (CLAUDE.md "Pure logic is separate from UI"):
 * zero React imports, zero side effects, zero I/O, explicit return types.
 *
 * ===========================================================================
 * THE PRECONDITION THAT GOVERNS THIS WHOLE MODULE
 * ===========================================================================
 *
 * Epley and Brzycki are **rep-max formulas**. Their rep argument is not "how
 * many reps you did"; it is "the largest number of reps you could have done
 * with that weight" — i.e. they are defined on a set taken *to failure*. A
 * 5-rep set that stopped with three reps left in the tank is not a 5RM, and
 * feeding its rep count straight into either formula under-reports the lifter
 * badly.
 *
 * This matters more here than in a general fitness app. GDD §3.3: the player
 * picks an **RPE target (6-10)**, not a weight. So almost every set this game
 * records is deliberately submaximal — 0 to 4 reps in reserve. An estimator
 * that ignores proximity to failure is structurally wrong for this game's core
 * loop, not merely imprecise. Worst case is the game's most common set: without
 * an RPE input, a 200 kg single at RPE 7 and a 200 kg single at RPE 10 both
 * score 200, so the one dimension the mode exists to express cannot move e1RM
 * at all.
 *
 * Therefore `CompletedSet` makes `rpe` a **required** field. There is no
 * overload that lets a caller omit it. If a data source genuinely has no RPE,
 * the caller must decide and record what it was — a set with unknown proximity
 * to failure has no defensible e1RM, and this module will not invent one. A
 * true rep max (a maximal single, a meet attempt, an AMRAP to failure) is
 * `rpe: TO_FAILURE_RPE`.
 *
 * ===========================================================================
 * THE CURVE
 * ===========================================================================
 *
 * Everything below is a function of one quantity:
 *
 *     effective rep max  =  reps performed  +  reps in reserve
 *                        =  reps           +  (10 - RPE)
 *
 * This substitution is not ours and is not an approximation bolted onto the
 * chart — it *is* the chart's internal structure. The published Tuchscherer /
 * RTS chart in `rpe.ts` is a reps-in-reserve chart, so N reps at RPE X and
 * (N + RIR) reps at RPE 10 are the same cell:
 *
 *     1 @ RPE 7  ==  4 @ RPE 10  ==  89.2%
 *     5 @ RPE 8  ==  7 @ RPE 10  ==  81.1%
 *
 * `rpe.test.ts` asserts that identity across the whole grid. Read along that
 * diagonal and the 12 x 9 chart collapses into a single published curve:
 * %1RM as a function of effective rep max, covering 1 to 16 in half steps.
 *
 * So the canonical estimate is the algebraic inverse of the chart:
 *
 *     e1RM = weight / (chartPercent(effectiveRepMax) / 100)
 *
 * ---------------------------------------------------------------------------
 * WHY THE CHART IS THE PRIMARY CURVE RATHER THAN A REP-MAX FORMULA
 * ---------------------------------------------------------------------------
 *
 * Not because it is "more accurate" — this codebase has no way to verify such
 * a claim and does not make one. Because it is the *same* curve the game
 * already prescribes loads from, and using a different one would break the
 * loop:
 *
 *   `loadForRpeTarget` (rpe.ts, the GDD §3.3 entry point) puts weight on the
 *   bar as e1RM x chartPercent. If e1RM came back out through a rep-max
 *   formula instead, hitting *exactly* the prescribed RPE would still change
 *   the stored e1RM. Epley on effective reps, for example, reads ~0.7% above
 *   the chart at 3 @ RPE 8 — small once, but the daily loop re-prescribes off
 *   the new number, so it compounds into runaway progression from doing
 *   precisely what the game asked. Round-tripping through one curve makes
 *   "you hit the target" mean "your e1RM did not move", which is what the
 *   player expects and what makes over- and under-performance legible.
 *   `e1rm.test.ts` asserts that round trip.
 *
 * ---------------------------------------------------------------------------
 * PAST THE CHART: BRZYCKI
 * ---------------------------------------------------------------------------
 *
 * The chart stops at an effective rep max of 16 (12 reps @ RPE 6). Beyond that
 * the estimate falls back to a published rep-max formula, applied to the
 * effective rep max. CLAUDE.md requires that formula to be Epley or Brzycki,
 * named and used consistently. It is **Brzycki**:
 *
 *     e1RM = w * 36 / (37 - r)
 *
 * The reason is arithmetic and checkable, not an empirical accuracy claim.
 * At the chart's top edge the chart reads 57.2% of 1RM, i.e. 1.7483 x w:
 *
 *     chart   at rep max 16.0  ->  1.7483 * w
 *     Brzycki at rep max 16.5  ->  36 / 20.5  =  1.7561 * w   (continues up)
 *     Epley   at rep max 16.5  ->  1 + 16.5/30 =  1.5500 * w   (steps DOWN)
 *
 * Epley would make e1RM *fall* when a lifter did more reps with the same
 * weight. Brzycki joins the published curve monotonically, so the composite
 * curve is strictly increasing in effective rep max across the whole supported
 * domain. `e1rm.test.ts` asserts both the monotonic join and that Epley fails
 * it — that is the entire justification, and it is reproducible from the
 * numbers above.
 *
 * (An earlier revision of this file justified Epley with an uncited claim
 * about which formula validation studies favour at 2-5 vs 6-10 reps. No
 * source for that was ever established, so it is gone. This module asserts
 * only things it can demonstrate.)
 *
 * Brzycki's pole at r = 37 is guarded: `E1RM_DOMAIN.MAX_REP_MAX` keeps every
 * input well below it, so the denominator can never reach zero or flip sign.
 *
 * `epleyE1rm` is still exported, verbatim and unmodified, so both published
 * formulas can be checked against source material and compared side by side.
 * It is NOT used to produce a player-facing e1RM.
 *
 * ---------------------------------------------------------------------------
 * CONFIDENCE
 * ---------------------------------------------------------------------------
 *
 * Every estimate carries `highConfidence`. Past roughly ten effective reps a
 * set is limited by local muscular endurance rather than maximal strength, and
 * endurance varies enormously between lifters — two people with the same true
 * 1RM can differ by many reps at 70%. The number is still returned; UI should
 * caveat it rather than present it as a fact.
 *
 * ---------------------------------------------------------------------------
 * UNITS AND PRECISION
 * ---------------------------------------------------------------------------
 *
 * Every path here is linear in weight, so the module is unit-agnostic: kg in
 * -> kg out, lb in -> lb out. Do not convert inside this module. (GDD §11
 * leaves the default display unit open; that is presentation, not math.)
 *
 * Results are full float precision. Rounding to a displayable or loadable
 * number (plate math, 2.5 kg increments) belongs to the caller — `roundLoad`
 * in rpe.ts does it.
 */

import {
  RPE_CHART_COVERAGE,
  isChartedRpe,
  repsInReserve,
  tryPercentOf1RM,
} from './rpe';

// ---------------------------------------------------------------------------
// Constants — published values and our own bounds, kept apart on purpose
// ---------------------------------------------------------------------------

/**
 * Published rep-max formula constants. NOT TUNABLE. These are transcriptions of
 * source material; changing one to balance the game is the homebrewing GDD
 * §12.3 forbids.
 *
 * Epley (Boyd Epley, Univ. of Nebraska strength program, 1985):
 *     e1RM = w * (1 + r / 30)
 *   Commonly printed as w * (1 + 0.0333 * r); 0.0333 is a rounding of 1/30, so
 *   the exact rational form is used.
 *
 * Brzycki (Matt Brzycki, 1993):
 *     e1RM = w * 36 / (37 - r)
 *   Commonly printed as w / (1.0278 - 0.0278 * r); 1.0278 = 37/36 and
 *   0.0278 = 1/36, so again the exact rational form is used.
 *
 * Known relationship (asserted in tests): the two agree exactly at r = 10,
 * where both are 4/3 * w.
 */
export const E1RM_FORMULA = {
  /** Epley: the 30 in (1 + r / 30). Published. Do not tune. */
  EPLEY_REP_DIVISOR: 30,
  /** Brzycki: the 36 in 36 / (37 - r). Published. Do not tune. */
  BRZYCKI_NUMERATOR: 36,
  /** Brzycki: the 37 in 36 / (37 - r). Also the location of its pole. */
  BRZYCKI_REP_OFFSET: 37,
} as const;

/**
 * The RPE that means "taken to failure", i.e. zero reps in reserve. A set at
 * this RPE is a true rep max and is the only case where a rep-max formula's
 * precondition holds on the raw rep count.
 *
 * Derived from the chart's own coverage rather than restated, so there is one
 * source of truth for it.
 */
export const TO_FAILURE_RPE = RPE_CHART_COVERAGE.MAX_RPE;

/**
 * Largest effective rep max the published chart covers: 12 reps at RPE 6, the
 * bottom-right corner. Derived, not hardcoded — if `rpe.ts` ever widens its
 * coverage this follows automatically.
 */
export const CHART_MAX_REP_MAX =
  RPE_CHART_COVERAGE.MAX_REPS + (RPE_CHART_COVERAGE.MAX_RPE - RPE_CHART_COVERAGE.MIN_RPE);

/**
 * OUR bounds, not published. This is the one place they live; tune here, never
 * inline at a call site (CLAUDE.md "Game Feel Values Must Be Tunable").
 *
 * None of these change the shape of any curve — they decide where this module
 * refuses to answer and where it flags an answer as soft.
 */
export const E1RM_DOMAIN = {
  /** Fewest reps a set can have. A set of zero reps is a miss, not an estimate. */
  MIN_REPS: 1,

  /**
   * Most reps performed we will accept. Well past anything a powerlifting sim
   * needs; the guard exists so a corrupt record cannot produce a fantasy number.
   */
  MAX_REPS: 20,

  /**
   * Hard ceiling on effective rep max (reps + RIR). Equals MAX_REPS plus the
   * largest reps-in-reserve the chart expresses (4, at RPE 6). Must stay well
   * below E1RM_FORMULA.BRZYCKI_REP_OFFSET or the fallback formula's denominator
   * reaches zero and then flips sign. Asserted in tests.
   */
  MAX_REP_MAX: 24,

  /**
   * Above this effective rep max the estimate is reported as low confidence:
   * the set is measuring endurance more than maximal strength. The number is
   * still returned. Ours — adjust freely.
   */
  HIGH_CONFIDENCE_MAX_REP_MAX: 10,
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Which published source produced a given estimate. */
export type E1rmMethod =
  /** Inverse of the Tuchscherer / RTS chart in `rpe.ts`. Covers rep max 1-16. */
  | 'rpe-chart'
  /** Brzycki rep-max formula, applied past the chart's coverage. */
  | 'brzycki';

/**
 * Attribution strings for UI ("e1RM 227.5 kg — RPE chart"). Copy, so tunable;
 * kept next to the methods so a label can never drift from the math behind it.
 */
export const E1RM_METHOD_LABEL: Readonly<Record<E1rmMethod, string>> = {
  'rpe-chart': 'RPE chart',
  brzycki: 'Brzycki',
};

/**
 * The name of the rep-max formula this module uses, for the CLAUDE.md
 * "state which one is used and be consistent" requirement. Exactly one rep-max
 * formula is ever used to produce a player-facing e1RM, and this is it.
 */
export const E1RM_REP_MAX_FORMULA_NAME = 'Brzycki' as const;

/**
 * A set the lifter actually completed.
 *
 * `rpe` is required. See the module header: without proximity to failure there
 * is no defensible estimate, and making it optional is precisely the bug this
 * type exists to prevent.
 */
export interface CompletedSet {
  /** Weight on the bar, any unit. The estimate comes back in the same unit. */
  readonly weight: number;
  /** Whole reps completed, E1RM_DOMAIN.MIN_REPS..E1RM_DOMAIN.MAX_REPS. */
  readonly reps: number;
  /**
   * How hard it was: RPE 6-10 in 0.5 steps, matching the published chart.
   * RPE 10 (`TO_FAILURE_RPE`) means zero reps in reserve — a true rep max.
   */
  readonly rpe: number;
}

/** An estimate plus everything needed to present or audit it. */
export interface E1rmEstimate {
  /** Estimated 1RM, same unit as the input weight, full float precision. */
  readonly e1rm: number;
  /** Reps in reserve implied by the RPE (10 - rpe). */
  readonly repsInReserve: number;
  /** reps + repsInReserve. The single quantity the whole curve depends on. */
  readonly effectiveRepMax: number;
  /** Which published source produced `e1rm`. */
  readonly method: E1rmMethod;
  /** False once the set is far enough into endurance territory to be soft. */
  readonly highConfidence: boolean;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Returns a human-readable problem with the set, or null if it is usable.
 * Shared by the throwing and non-throwing entry points so their notions of
 * "valid" can never drift apart.
 */
function describeSetProblem(set: CompletedSet): string | null {
  const { weight, reps, rpe } = set;

  if (!Number.isFinite(weight) || weight <= 0) {
    return `weight must be a finite number greater than 0, received ${weight}`;
  }
  if (!Number.isInteger(reps)) {
    return `reps must be a whole number, received ${reps}`;
  }
  if (reps < E1RM_DOMAIN.MIN_REPS || reps > E1RM_DOMAIN.MAX_REPS) {
    return (
      `reps must be between ${E1RM_DOMAIN.MIN_REPS} and ${E1RM_DOMAIN.MAX_REPS}, ` +
      `received ${reps}`
    );
  }
  if (!isChartedRpe(rpe)) {
    return (
      `rpe must be on the published chart — RPE ${RPE_CHART_COVERAGE.MIN_RPE}-` +
      `${RPE_CHART_COVERAGE.MAX_RPE} in ${RPE_CHART_COVERAGE.RPE_STEP} steps — ` +
      `received ${rpe}. An off-chart RPE has no published percentage, and ` +
      `interpolating one would be homebrewing (GDD §12.3).`
    );
  }

  // Defensive against retuning: while MAX_REP_MAX >= MAX_REPS + 4 (the largest
  // reps in reserve the chart expresses) the reps guard above is the binding
  // one and this cannot fire. Lower MAX_REP_MAX or raise MAX_REPS and it does.
  // `e1rm.test.ts` asserts that invariant so the relationship stays visible.
  const effective = reps + repsInReserve(rpe);
  if (effective > E1RM_DOMAIN.MAX_REP_MAX) {
    return (
      `${reps} reps @ RPE ${rpe} implies an effective rep max of ${effective}, ` +
      `above the supported ceiling of ${E1RM_DOMAIN.MAX_REP_MAX}`
    );
  }
  return null;
}

function assertPositiveWeight(weight: number): void {
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new RangeError(`e1RM: weight must be a finite number greater than 0, received ${weight}`);
  }
}

/**
 * Guards the rep argument of the two raw formulas.
 *
 * Non-integer values are allowed on purpose: both curves are continuous in r,
 * and the reps-in-reserve substitution produces half-rep maxima at the chart's
 * half-RPE steps (13 reps @ RPE 9.5 is a 13.5 rep max). Evaluating a published
 * continuous curve at a non-integer argument is not inventing a value.
 */
function assertUsableRepMax(repMax: number): void {
  if (!Number.isFinite(repMax)) {
    throw new RangeError(`e1RM: rep max must be a finite number, received ${repMax}`);
  }
  if (repMax < E1RM_DOMAIN.MIN_REPS || repMax > E1RM_DOMAIN.MAX_REP_MAX) {
    throw new RangeError(
      `e1RM: rep max must be between ${E1RM_DOMAIN.MIN_REPS} and ` +
        `${E1RM_DOMAIN.MAX_REP_MAX}, received ${repMax}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Raw published rep-max formulas
// ---------------------------------------------------------------------------

/**
 * Epley, verbatim: e1RM = w * (1 + r / 30).
 *
 * REFERENCE IMPLEMENTATION ONLY — nothing player-facing goes through this.
 * There is deliberately no special case at r = 1 (the raw curve returns
 * 1.0333 * w there, which is the formula being honest about not being defined
 * on a single). Singles are handled by the chart, where 1 rep @ RPE 10 is
 * 100.0% and the estimate is exactly the weight lifted.
 *
 * @param weight Weight lifted, any unit.
 * @param repMax Reps in a set taken to failure. See `assertUsableRepMax` on
 *   why fractional values are accepted.
 */
export function epleyE1rm(weight: number, repMax: number): number {
  assertPositiveWeight(weight);
  assertUsableRepMax(repMax);
  return weight * (1 + repMax / E1RM_FORMULA.EPLEY_REP_DIVISOR);
}

/**
 * Brzycki, verbatim: e1RM = w * 36 / (37 - r). The formula this module uses
 * past the chart's coverage.
 *
 * Returns exactly `weight` at repMax = 1 as a natural property of the formula
 * (36 / 36 = 1), not as a clamp.
 *
 * @param weight Weight lifted, any unit.
 * @param repMax Reps in a set taken to failure.
 */
export function brzyckiE1rm(weight: number, repMax: number): number {
  assertPositiveWeight(weight);
  assertUsableRepMax(repMax);
  return (weight * E1RM_FORMULA.BRZYCKI_NUMERATOR) / (E1RM_FORMULA.BRZYCKI_REP_OFFSET - repMax);
}

// ---------------------------------------------------------------------------
// The reps-in-reserve substitution
// ---------------------------------------------------------------------------

/**
 * Effective rep max of a set: reps + reps in reserve.
 *
 * This is the chart's own reps-in-reserve structure, not an outside
 * correction — 1 @ RPE 7 and 4 @ RPE 10 are the same chart cell (89.2%).
 *
 * @throws {RangeError} if `rpe` is not on the published chart.
 */
export function effectiveRepMax(reps: number, rpe: number): number {
  return reps + repsInReserve(rpe);
}

/**
 * %1RM for an effective rep max, read off the published chart's
 * reps-in-reserve diagonal. Null once the rep max leaves the chart.
 *
 * Picks the chart cell with the largest rep count that still expresses this
 * rep max, then reads the RPE that supplies the remainder as reps in reserve.
 * Any other cell on the same diagonal returns the same percentage (asserted in
 * both `rpe.test.ts` and `e1rm.test.ts`), so the choice of representative cell
 * is arbitrary and does not affect the result.
 */
function chartPercentForRepMax(repMax: number): number | null {
  if (repMax < RPE_CHART_COVERAGE.MIN_REPS || repMax > CHART_MAX_REP_MAX) {
    return null;
  }
  const reps = Math.min(RPE_CHART_COVERAGE.MAX_REPS, Math.floor(repMax));
  const rir = repMax - reps;
  return tryPercentOf1RM(reps, RPE_CHART_COVERAGE.MAX_RPE - rir);
}

/**
 * The canonical curve, and the ONLY place an e1RM number is produced. Both
 * public entry points funnel through here, so consumers cannot end up on two
 * different curves.
 */
function estimateFromRepMax(
  weight: number,
  repMax: number,
): { readonly e1rm: number; readonly method: E1rmMethod } {
  const chartPercent = chartPercentForRepMax(repMax);
  if (chartPercent !== null) {
    return { e1rm: weight / (chartPercent / 100), method: 'rpe-chart' };
  }
  return { e1rm: brzyckiE1rm(weight, repMax), method: 'brzycki' };
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

/**
 * True when an effective rep max is inside the range where an e1RM estimate is
 * trustworthy. See the module header on why high-rep sets stop measuring
 * maximal strength.
 */
export function isHighConfidenceRepMax(repMax: number): boolean {
  return (
    Number.isFinite(repMax) &&
    repMax >= E1RM_DOMAIN.MIN_REPS &&
    repMax <= E1RM_DOMAIN.HIGH_CONFIDENCE_MAX_REP_MAX
  );
}

/** Assumes `set` has already passed `describeSetProblem`. */
function buildEstimate(set: CompletedSet): E1rmEstimate {
  const rir = repsInReserve(set.rpe);
  const repMax = set.reps + rir;
  const { e1rm, method } = estimateFromRepMax(set.weight, repMax);
  return {
    e1rm,
    repsInReserve: rir,
    effectiveRepMax: repMax,
    method,
    highConfidence: isHighConfidenceRepMax(repMax),
  };
}

/**
 * Full estimate for a completed set, or null when the set is outside what this
 * module can answer for (bad weight, rep count out of range, RPE not on the
 * published chart). Use this where an unusable record is expected and
 * survivable; use `explainE1rm` / `estimateE1rm` where it is a bug.
 */
export function tryExplainE1rm(set: CompletedSet): E1rmEstimate | null {
  return describeSetProblem(set) === null ? buildEstimate(set) : null;
}

/**
 * Full estimate for a completed set.
 *
 * @throws {RangeError} on an unusable set. Throwing rather than returning NaN
 * or a sentinel is deliberate: a bad set record is a bug upstream, and an e1RM
 * silently becoming NaN would propagate straight into Total and progression.
 */
export function explainE1rm(set: CompletedSet): E1rmEstimate {
  const problem = describeSetProblem(set);
  if (problem !== null) {
    throw new RangeError(`e1RM: ${problem}`);
  }
  return buildEstimate(set);
}

/**
 * THE e1RM ENTRY POINT FOR THE WHOLE CODEBASE.
 *
 * Every consumer — Total, progression, opener suggestions, meet prefill — must
 * come through here (or `explainE1rm`, which is this plus attribution) so that
 * e1RM can never be computed off two different curves. `epleyE1rm` and
 * `brzyckiE1rm` are exported for comparison and test purposes; they are not the
 * app's e1RM.
 *
 * How RPE moves the number, at a fixed weight:
 *   200 x 1 @ RPE 10 -> 200.0  (100.0% — the set was a true single)
 *   200 x 1 @ RPE  9 -> 209.4  ( 95.5%)
 *   200 x 1 @ RPE  7 -> 224.2  ( 89.2% — three reps still in the tank)
 *   200 x 5 @ RPE 10 -> 231.8  ( 86.3%)
 *   200 x 5 @ RPE  7 -> 254.5  ( 78.6% — same cell as an 8RM)
 * Higher RPE at the same weight and reps means a *lower* e1RM: the set cost
 * more, so less was in reserve.
 *
 * @throws {RangeError} on an unusable set.
 * @returns Estimated 1RM at full precision, in the input's unit.
 */
export function estimateE1rm(set: CompletedSet): number {
  return explainE1rm(set).e1rm;
}

/**
 * Non-throwing `estimateE1rm`. Null when the set is outside supported input.
 */
export function tryEstimateE1rm(set: CompletedSet): number | null {
  return tryExplainE1rm(set)?.e1rm ?? null;
}
