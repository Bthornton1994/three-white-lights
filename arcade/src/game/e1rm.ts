/**
 * Estimated one-rep max (e1RM).
 *
 * PURE MODULE (CLAUDE.md "Pure logic is separate from UI"):
 * zero React imports, zero side effects, zero I/O, explicit return types.
 *
 * ===========================================================================
 * BEHAVIOUR CHANGE — READ THIS FIRST IF YOU CALL THIS MODULE
 * ===========================================================================
 *
 * This module used to answer for effective rep maxes above the published
 * chart's coverage by falling back to a second rep-max formula. IT NO LONGER
 * DOES. CLAUDE.md now names exactly one e1RM formula and forbids a second one
 * anywhere in the codebase, and the one it names cannot be joined onto the top
 * of the chart without the curve stepping DOWN (the arithmetic is below and in
 * the tests). So instead of shipping a broken join or a banned second formula,
 * this module refuses.
 *
 * EXACTLY WHAT CHANGED. A set is refused when
 *
 *     reps + (10 - RPE)  >  16       i.e.  effective rep max past the chart
 *
 * Previously every one of those returned a number. Concretely, now refused:
 *
 *     17-20 reps at any RPE          13 reps at RPE 6-6.5
 *     16 reps at RPE 6-9.5           14 reps at RPE 6-7.5
 *     15 reps at RPE 6-8.5
 *
 * Everything at or below a 16 effective rep max is unaffected: that path is the
 * same chart inverse it always was, and this change touches none of its
 * arithmetic. The widest accepted sets are a 16-rep set taken to failure and a
 * 12-rep set at RPE 6 — both are an effective rep max of exactly 16.
 * (`e1rm.test.ts` enumerates that boundary rather than leaving it as prose.)
 *
 * Callers that must survive an out-of-range record should use the `try*`
 * entry points, which return null; the throwing ones raise RangeError, the same
 * as they already did for an off-chart RPE.
 *
 * ===========================================================================
 * THE PRECONDITION THAT GOVERNS THIS WHOLE MODULE
 * ===========================================================================
 *
 * Epley is a **rep-max formula**. Its rep argument is not "how many reps you
 * did"; it is "the largest number of reps you could have done with that weight"
 * — it is defined on a set taken *to failure*. A 5-rep set that stopped with
 * three reps left in the tank is not a 5RM, and feeding its rep count straight
 * into the formula under-reports the lifter badly. CLAUDE.md says so in as many
 * words and calls it a bug.
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
 * chart — it *is* the chart's internal structure, and it is the conversion
 * CLAUDE.md requires ("converted to its rep-max equivalent first, via the RPE
 * chart above (reps + reps in reserve)"). The published Tuchscherer / RTS chart
 * in `rpe.ts` is a reps-in-reserve chart, so N reps at RPE X and (N + RIR) reps
 * at RPE 10 are the same cell:
 *
 *     1 @ RPE 7  ==  4 @ RPE 10  ==  89.2%
 *     5 @ RPE 8  ==  7 @ RPE 10  ==  81.1%
 *
 * `rpe.test.ts` asserts that identity across the whole grid. Read along that
 * diagonal and the 12 x 9 chart collapses into a single published curve:
 * %1RM as a function of effective rep max, covering 1 to 16 in half steps.
 *
 * So the estimate is the algebraic inverse of the chart:
 *
 *     e1RM = weight / (chartPercent(effectiveRepMax) / 100)
 *
 * That is the ONLY expression in this module that produces a player-facing
 * e1RM. There is no second one.
 *
 * ---------------------------------------------------------------------------
 * WHY THE PUBLISHED CHART RATHER THAN THE PUBLISHED FORMULA
 * ---------------------------------------------------------------------------
 *
 * Not because it is "more accurate" — this codebase has no way to verify such a
 * claim and does not make one. Two reasons, both checkable:
 *
 * 1. IT IS THE CURVE THE GAME PRESCRIBES LOADS FROM. `loadForRpeTarget`
 *    (rpe.ts, the GDD §3.3 entry point) puts weight on the bar as
 *    e1RM x chartPercent. If e1RM came back out through a different curve,
 *    hitting *exactly* the prescribed RPE would still change the stored e1RM,
 *    and the daily loop re-prescribes off the new number, so the error
 *    compounds. Round-tripping through one curve makes "you hit the target"
 *    mean "your e1RM did not move", which is what the player expects and what
 *    makes over- and under-performance legible. `e1rm.test.ts` asserts that
 *    round trip on all 108 cells.
 *
 * 2. IT IS THE ONLY WAY THE APP CAN REPORT ONE NUMBER PER SET. `rpe.ts` already
 *    exports `e1rmFromChartedSet`, the same chart read backwards. CLAUDE.md's
 *    one-formula rule exists so that "two parts of the app can never report
 *    different numbers for the same set". Estimating off anything other than
 *    the chart would guarantee exactly that split — at 12 reps @ RPE 6 an Epley
 *    estimate reads about 12% under what `e1rmFromChartedSet` reports for the
 *    identical set. Agreement with `rpe.ts` is asserted cell by cell.
 *
 * ---------------------------------------------------------------------------
 * THE ONE FORMULA: EPLEY, AND WHERE IT IS AND IS NOT APPLIED
 * ---------------------------------------------------------------------------
 *
 * CLAUDE.md requires exactly one rep-max formula, Epley, and forbids a second
 * anywhere in the codebase under any name. `epleyE1rm` below is that formula,
 * verbatim, and it is the only one here. A previous revision carried a second
 * as a past-the-chart fallback; it is gone from the code, the constants, the
 * types and the prose, not just from the call path. Do not reintroduce it.
 *
 * On where it is applied, CLAUDE.md is explicit, and this module agrees with it
 * rather than departing from it: Epley is "the one rep-max formula the codebase
 * may ever reach for, not a curve the player-facing path currently runs
 * through". Inside the chart's coverage the game does not need a rep-max
 * formula at all — it has the published data, and using the formula there would
 * break both properties above. Past the coverage the module refuses (next
 * section). So `epleyE1rm` is exposed with its published value pinned by tests,
 * and it is deliberately NOT on the player-facing path.
 *
 * (An earlier revision of this passage quoted a phrase — "used everywhere" —
 * that CLAUDE.md carried at the time and no longer does, and then argued
 * against it. The quotation went stale when the rule was edited, so the module
 * read as deviating from a demand the doc had stopped making. Quote the rule as
 * it stands or describe it; do not paraphrase it inside quotation marks.)
 *
 * IF YOU ARE ABOUT TO CALL `epleyE1rm` DIRECTLY: don't, unless you are testing
 * the formula itself. It disagrees with what this module reports for the same
 * set, and the disagreement is not small — it reads 3.33% ABOVE the chart at an
 * effective rep max of 1, crosses over between 7 and 7.5, and is 11.99% BELOW
 * at 16. Those three figures are asserted in `e1rm.test.ts`. `estimateE1rm` is
 * the number the app reports.
 *
 * ---------------------------------------------------------------------------
 * PAST THE CHART: THIS MODULE REFUSES
 * ---------------------------------------------------------------------------
 *
 * The chart stops at an effective rep max of 16 (12 reps @ RPE 6, or 16 reps to
 * failure). There is no fallback curve past it. Why refusing beats extending:
 *
 * The chart's top edge reads 57.4% of 1RM, i.e. 1.7422 x w. Epley one half step
 * further along is 1.5500 x w:
 *
 *     chart at rep max 16.0  ->  100 / 57.4        =  1.7422 * w
 *     Epley at rep max 16.5  ->  1 + 16.5 / 30     =  1.5500 * w   STEPS DOWN
 *
 * An extension through Epley would make e1RM *fall* when a lifter did more reps
 * with the same weight — a strictly worse defect than not answering. That is
 * not a close call that depends on the exact top-edge cell: for Epley to
 * continue upward, that cell would have to read above 64.52% (= 100 / 1.55),
 * and both readings on record for it — 57.4% and the rival 57.2% recorded in
 * `rpe.ts` CONTESTED_CHART_CELLS — are far below. `e1rm.test.ts` checks the
 * step-down against every reading `rpe.ts` has on record, so adopting the other
 * one does not quietly change this conclusion.
 *
 * EVERY FIGURE IN THIS PARAGRAPH IS PINNED BY A TEST ("figures quoted in the
 * module header"), including which readings are on record. Change the contested
 * cell in `rpe.ts`, or add a third reading, and those tests fail — deliberately,
 * so this prose gets re-read instead of going stale. An earlier revision of this
 * passage quoted a figure that had been corrected elsewhere and nothing caught
 * it.
 *
 * The alternative to refusing would be a second formula chosen because it
 * happens to join monotonically. That is what this module used to do, and
 * CLAUDE.md now forbids it: two formulas means two numbers for one set.
 * Rescaling Epley to meet the chart's top edge is worse still — a rescaled
 * Epley is not Epley, and inventing e1RM values is a GDD §12.3 refusal
 * condition, the same one that stops `rpe.ts` interpolating an off-chart RPE.
 *
 * So the module treats "past the chart" exactly like "off-chart RPE": it says
 * so and returns nothing. The cost is real and is stated at the top of this
 * file. It is bounded: an effective rep max above 16 is far outside anything a
 * powerlifting sim programmes, and estimates are already flagged
 * `highConfidence: false` past an effective rep max of 10.
 *
 * PROVENANCE WARNING for the top of the curve. Effective rep maxes 15.5 and
 * 16.0 are read from exactly two chart cells — (12 reps, RPE 6.5) and
 * (12 reps, RPE 6) — and `rpe.ts` marks both as pinned by nothing but community
 * transcription, one of them explicitly contested. Those same two cells set
 * where this module's domain ends. The figures above are stated to four
 * significant figures; their underlying source is the least certain in the
 * module. (Which is why the step-down check above is written against every
 * recorded reading rather than against 57.4 alone.)
 *
 * (An earlier revision of this file justified its formula choice with an
 * uncited claim about which formula validation studies favour at 2-5 vs 6-10
 * reps. No source for that was ever established, so it is gone. This module
 * asserts only things it can demonstrate.)
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
// Constants — published, derived, and tunable, kept apart on purpose
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
 * This object has exactly one member because the codebase has exactly one
 * rep-max formula (CLAUDE.md). If you are adding a second, stop: that is the
 * thing the rule exists to prevent.
 */
export const E1RM_FORMULA = {
  /** Epley: the 30 in (1 + r / 30). Published. Do not tune. */
  EPLEY_REP_DIVISOR: 30,
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
 *
 * THIS IS ALSO THIS MODULE'S HARD DOMAIN CEILING, on every entry point
 * including the raw formula. It is deliberately not in the tuning block below:
 * it is not a knob, it is where the published data stops. Raising it would not
 * widen what the module knows, it would only let it start inventing.
 */
export const CHART_MAX_REP_MAX =
  RPE_CHART_COVERAGE.MAX_REPS + (RPE_CHART_COVERAGE.MAX_RPE - RPE_CHART_COVERAGE.MIN_RPE);

/**
 * The input this module accepts. Every bound here is DERIVED from the chart's
 * coverage — none of it is a product decision, so none of it is tunable. The
 * one tunable value in the module is in `E1RM_TUNING` below.
 */
export const E1RM_DOMAIN = {
  /**
   * Fewest reps a set can have. A set of zero reps is a miss, not an estimate.
   * Same as the chart's own floor.
   */
  MIN_REPS: RPE_CHART_COVERAGE.MIN_REPS,

  /**
   * Most reps performed we can answer for. Equals `CHART_MAX_REP_MAX` because
   * the largest rep count that can land inside the chart is one taken to
   * failure, where reps in reserve is 0 and reps *are* the effective rep max.
   *
   * Passing this guard is necessary, not sufficient: at anything below RPE 10 a
   * set this long already implies an effective rep max past the chart, and the
   * ceiling check is what rejects it.
   */
  MAX_REPS: CHART_MAX_REP_MAX,
} as const;

/**
 * The only hand-tunable value in this module (CLAUDE.md "Game Feel Values Must
 * Be Tunable"). Kept in its own object so it cannot be confused with published
 * data or with a derived bound. If a central `src/tuning/` module lands later,
 * move this wholesale rather than scattering it.
 */
export const E1RM_TUNING = {
  /**
   * Above this effective rep max the estimate is reported as low confidence:
   * the set is measuring endurance more than maximal strength. The number is
   * still returned. Ours — adjust freely. Presentation only; it changes no
   * estimate.
   */
  HIGH_CONFIDENCE_MAX_REP_MAX: 10,
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Which published source produced a given estimate.
 *
 * ONE MEMBER, ON PURPOSE. There is one curve (see the header), so there is one
 * possible attribution. It stays a union rather than being dropped so that the
 * estimate object carries its own provenance for UI and audit, and so that
 * introducing a second source would have to widen this type — a visible edit,
 * not a silent one.
 */
export type E1rmMethod =
  /** Inverse of the Tuchscherer / RTS chart in `rpe.ts`. Covers rep max 1-16. */
  'rpe-chart';

/**
 * Attribution strings for UI ("e1RM 227.5 kg — RPE chart"). Copy, so tunable;
 * kept next to the method so a label can never drift from the math behind it.
 */
export const E1RM_METHOD_LABEL: Readonly<Record<E1rmMethod, string>> = {
  'rpe-chart': 'RPE chart',
};

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
// Resolving a set: one gate, shared by every entry point
// ---------------------------------------------------------------------------

/** A set that passed the gate, with the chart cell it resolved to. */
interface ResolvedSet {
  readonly repsInReserve: number;
  readonly effectiveRepMax: number;
  /** %1RM read off the chart. Non-null by construction. */
  readonly chartPercent: number;
}

/**
 * Either the resolved set or a human-readable reason it cannot be answered.
 *
 * Every entry point goes through this, so "what counts as a usable set" is
 * decided once. The throwing and non-throwing paths cannot drift apart, and —
 * because resolution carries the chart percentage out with it — there is no
 * second lookup that could succeed where the gate failed.
 */
type SetResolution =
  | { readonly ok: true; readonly resolved: ResolvedSet }
  | { readonly ok: false; readonly problem: string };

function resolveSet(set: CompletedSet): SetResolution {
  const { weight, reps, rpe } = set;

  if (!Number.isFinite(weight) || weight <= 0) {
    return {
      ok: false,
      problem: `weight must be a finite number greater than 0, received ${weight}`,
    };
  }
  if (!Number.isInteger(reps)) {
    return { ok: false, problem: `reps must be a whole number, received ${reps}` };
  }
  if (reps < E1RM_DOMAIN.MIN_REPS || reps > E1RM_DOMAIN.MAX_REPS) {
    return {
      ok: false,
      problem:
        `reps must be between ${E1RM_DOMAIN.MIN_REPS} and ${E1RM_DOMAIN.MAX_REPS}, ` +
        `received ${reps}`,
    };
  }
  if (!isChartedRpe(rpe)) {
    return {
      ok: false,
      problem:
        `rpe must be on the published chart — RPE ${RPE_CHART_COVERAGE.MIN_RPE}-` +
        `${RPE_CHART_COVERAGE.MAX_RPE} in ${RPE_CHART_COVERAGE.RPE_STEP} steps — ` +
        `received ${rpe}. An off-chart RPE has no published percentage, and ` +
        `interpolating one would be homebrewing (GDD §12.3).`,
    };
  }

  const rir = repsInReserve(rpe);
  const effective = reps + rir;
  // The chart lookup IS the gate. Worded for the case that actually happens (a
  // rep max past the chart) but correct for the pathological one too: if
  // `rpe.ts`'s own key guards ever drift and an in-range cell comes back null,
  // this refuses instead of handing a NaN — or, as the previous revision did, a
  // second formula's number — to progression.
  const chartPercent = chartPercentForRepMax(effective);
  if (chartPercent === null) {
    return {
      ok: false,
      problem:
        `${reps} reps @ RPE ${rpe} implies an effective rep max of ${effective}, ` +
        `which the published chart has no cell for (its coverage is ` +
        `${E1RM_DOMAIN.MIN_REPS}-${CHART_MAX_REP_MAX}). There is no fallback ` +
        `curve past the chart: the one permitted rep-max formula joins it ` +
        `downward, and extrapolating a published chart is homebrewing ` +
        `(GDD §12.3). See the module header.`,
    };
  }

  return {
    ok: true,
    resolved: { repsInReserve: rir, effectiveRepMax: effective, chartPercent },
  };
}

function assertPositiveWeight(weight: number): void {
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new RangeError(`e1RM: weight must be a finite number greater than 0, received ${weight}`);
  }
}

/**
 * Guards the rep argument of the raw formula, with the SAME ceiling the set
 * entry points use. One domain, every route in: you cannot get a number out of
 * this module for an effective rep max the chart does not cover by reaching for
 * the formula instead.
 *
 * Non-integer values are allowed on purpose: the curve is continuous in r, and
 * the reps-in-reserve substitution produces half-rep maxima at the chart's
 * half-RPE steps (13 reps @ RPE 9.5 is a 13.5 rep max). Evaluating a published
 * continuous curve at a non-integer argument is not inventing a value.
 */
function assertUsableRepMax(repMax: number): void {
  if (!Number.isFinite(repMax)) {
    throw new RangeError(`e1RM: rep max must be a finite number, received ${repMax}`);
  }
  if (repMax < E1RM_DOMAIN.MIN_REPS || repMax > CHART_MAX_REP_MAX) {
    throw new RangeError(
      `e1RM: rep max must be between ${E1RM_DOMAIN.MIN_REPS} and ` +
        `${CHART_MAX_REP_MAX}, received ${repMax}`,
    );
  }
}

// ---------------------------------------------------------------------------
// The one published rep-max formula
// ---------------------------------------------------------------------------

/**
 * Epley, verbatim: e1RM = w * (1 + r / 30). The only rep-max formula in this
 * codebase, per CLAUDE.md.
 *
 * NOT THE APP'S e1RM — see the header. Inside the chart's coverage the app
 * reports the chart (`estimateE1rm`), which disagrees with this by up to 3.33%
 * low down and 11.99% high up; outside it, the module refuses rather than
 * extending this curve. Call this only to check the formula itself.
 *
 * There is deliberately no special case at r = 1 (the raw curve returns
 * 1.0333 * w there, which is the formula being honest about not being defined
 * on a single). Singles are handled by the chart, where 1 rep @ RPE 10 is
 * 100.0% and the estimate is exactly the weight lifted.
 *
 * @param weight Weight lifted, any unit.
 * @param repMax Reps in a set taken to failure. See `assertUsableRepMax` on
 *   why fractional values are accepted and why the ceiling is the chart's.
 */
export function epleyE1rm(weight: number, repMax: number): number {
  assertPositiveWeight(weight);
  assertUsableRepMax(repMax);
  return weight * (1 + repMax / E1RM_FORMULA.EPLEY_REP_DIVISOR);
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
 * reps-in-reserve diagonal. Null once the rep max leaves the chart — which is
 * the module's refusal, not a prompt to fall back to something.
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
    repMax <= E1RM_TUNING.HIGH_CONFIDENCE_MAX_REP_MAX
  );
}

/**
 * The ONLY place an e1RM number is produced: the algebraic inverse of the
 * published chart cell the set resolved to.
 */
function buildEstimate(weight: number, resolved: ResolvedSet): E1rmEstimate {
  return {
    e1rm: weight / (resolved.chartPercent / 100),
    repsInReserve: resolved.repsInReserve,
    effectiveRepMax: resolved.effectiveRepMax,
    method: 'rpe-chart',
    highConfidence: isHighConfidenceRepMax(resolved.effectiveRepMax),
  };
}

/**
 * Full estimate for a completed set, or null when the set is outside what this
 * module can answer for (bad weight, rep count out of range, RPE not on the
 * published chart, effective rep max past the chart's coverage). Use this where
 * an unusable record is expected and survivable; use `explainE1rm` /
 * `estimateE1rm` where it is a bug.
 */
export function tryExplainE1rm(set: CompletedSet): E1rmEstimate | null {
  const resolution = resolveSet(set);
  return resolution.ok ? buildEstimate(set.weight, resolution.resolved) : null;
}

/**
 * Full estimate for a completed set.
 *
 * @throws {RangeError} on an unusable set. Throwing rather than returning NaN
 * or a sentinel is deliberate: a bad set record is a bug upstream, and an e1RM
 * silently becoming NaN would propagate straight into Total and progression.
 */
export function explainE1rm(set: CompletedSet): E1rmEstimate {
  const resolution = resolveSet(set);
  if (!resolution.ok) {
    throw new RangeError(`e1RM: ${resolution.problem}`);
  }
  return buildEstimate(set.weight, resolution.resolved);
}

/**
 * THE e1RM ENTRY POINT FOR THE WHOLE CODEBASE.
 *
 * Every consumer — Total, progression, opener suggestions, meet prefill — must
 * come through here (or `explainE1rm`, which is this plus attribution) so that
 * e1RM can never be computed off two different curves. `epleyE1rm` is exported
 * for formula checks only; it is not the app's e1RM.
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
 * @throws {RangeError} on an unusable set, including one whose effective rep
 * max is past the chart. See the behaviour-change note at the top of the file.
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
