/**
 * RPE -> %1RM lookup (Tuchscherer / Reactive Training Systems chart).
 *
 * Pure module. Zero React imports, zero side effects, zero I/O. See CLAUDE.md
 * ("Pure logic is separate from UI") and GDD §9.2.
 *
 * ---------------------------------------------------------------------------
 * SOURCE OF THE NUMBERS  (GDD §3.3 / §12.3 — homebrewed RPE values are a hard
 * refusal condition, so the provenance is documented here in full.)
 * ---------------------------------------------------------------------------
 *
 * Chart: the standard Mike Tuchscherer / Reactive Training Systems RPE chart,
 * reps 1-12 x RPE 6-10 in 0.5 steps. Originally published by RTS; the version
 * most widely circulated in the powerlifting community traces to
 * "Customizing Your RPE Chart", Reactive Training Systems, 2016-01-06
 * (articles.reactivetrainingsystems.com/2016/01/06/customizing-your-rpe-chart/,
 * later mirrored at store.reactivetrainingsystems.com/blogs/advanced-concepts/
 * customizing-your-rpe-chart).
 *
 * The RTS site itself was not reachable from the build sandbox (HTTP 403 via
 * the egress proxy), so the grid below was transcribed by cross-checking two
 * independent third-party implementations that both encode the same published
 * chart, plus spot checks against web-search results:
 *
 *   A. npm `@sculpt-ai/progressive-overload@0.0.2` -> RPE_TABLE (reps 1-12,
 *      RPE 6-10 by 0.5).
 *   B. npm `fit-tools@1.2.0` -> COEFFICIENTS (reps 1-15, RPE 6.5-10 by 0.5).
 *      Its README/JSDoc names the chart "Tuchscherer".
 *   C. GitHub `tnapes96/RPECalc` README names the RTS article above as the
 *      source of the same table.
 *
 * Agreement: over the 96 cells both A and B cover (reps 1-12, RPE 6.5-10),
 * 89 are identical. The 7 disagreements collapse onto only THREE distinct
 * chart cells once the chart's reps-in-reserve structure is applied (see
 * "diagonal identity" below):
 *
 *   effort index 2.5  -> A: 93.9   B: 93.8
 *   effort index 7.5  -> A: 79.9   B: 79.8
 *   effort index 11.5 -> A: 69.4   B: 69.3
 *
 * THESE THREE CELLS ARE THE ONES I COULD NOT FULLY CORROBORATE. This file uses
 * A's values (93.9 / 79.9 / 69.4) because B contradicts *itself* on exactly
 * those three cells — B stores 93.9 at (1 rep, RPE 8.5) but 93.8 at
 * (2 reps, RPE 9.5), 79.9 at (4 reps, RPE 6.5) but 79.8 at (5 reps, RPE 7.5),
 * and 69.4 at (8 reps, RPE 6.5) but 69.3 at (9 reps, RPE 7.5). Those pairs are
 * the same cell of the published chart, so B has transcription drift there
 * while A is structurally consistent everywhere. If a physical copy of the RTS
 * chart says otherwise, fix these three values and nothing else.
 *
 * Additional coverage caveat: source B starts at RPE 6.5, so the RPE 6.0 row
 * is corroborated by source A plus the diagonal identity only, not by two
 * independent transcriptions. Source B also extends to 15 reps; those extra
 * columns are an expansion of the published chart (and are internally
 * inconsistent), so they are deliberately NOT reproduced here.
 *
 * Diagonal identity: the chart encodes reps-in-reserve, so N reps at RPE X and
 * (N + 1) reps at RPE (X + 1) describe the same distance from failure and
 * therefore share a percentage — e.g. 1 @ RPE 9 == 2 @ RPE 10 == 95.5%. The
 * "effort index" used above is `reps + (10 - rpe)`. The grid below satisfies
 * this identity at every cell; `rpe.test.ts` asserts it.
 *
 * NOT TUNABLE: the percentages in RPE_PERCENT_CHART are published domain data,
 * not game feel. Do not adjust them to balance the game. Tunable values in this
 * module are collected in RPE_LOADING_TUNING.
 */

// ---------------------------------------------------------------------------
// Coverage
// ---------------------------------------------------------------------------

/** Reps covered by the published chart. Anything outside this is off-chart. */
export type ChartedReps = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/** RPE values covered by the published chart, in 0.5 steps. */
export type ChartedRpe = 6 | 6.5 | 7 | 7.5 | 8 | 8.5 | 9 | 9.5 | 10;

/**
 * Exact bounds of the published chart. Exported so callers (UI, prescription
 * logic, tests) can clamp or gate on real coverage instead of guessing.
 */
export const RPE_CHART_COVERAGE = {
  MIN_REPS: 1,
  MAX_REPS: 12,
  MIN_RPE: 6,
  MAX_RPE: 10,
  RPE_STEP: 0.5,
} as const;

export const CHARTED_REPS: readonly ChartedReps[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export const CHARTED_RPES: readonly ChartedRpe[] = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

// ---------------------------------------------------------------------------
// Tunable values (the ONLY tunable values in this module)
// ---------------------------------------------------------------------------

/** How a raw prescribed load is snapped onto loadable plate increments. */
export type RoundingMode = 'nearest' | 'down' | 'up';

/** Units the loader understands. GDD §11 has not settled the app default yet. */
export type WeightUnit = 'kg' | 'lb';

/**
 * Hand-tunable knobs. Every literal that is a product decision rather than
 * published domain data lives here (CLAUDE.md "Game Feel Values Must Be
 * Tunable"). If a central `src/tuning/` module lands later, move this object
 * there wholesale rather than scattering the values.
 */
export const RPE_LOADING_TUNING = {
  /**
   * Smallest total bar change we will prescribe, per unit. 2.5 kg = 1.25 kg a
   * side; 5 lb = 2.5 lb a side. Both are the smallest increments a normal gym
   * can actually load without change plates.
   */
  ROUNDING_INCREMENT: { kg: 2.5, lb: 5 } as const satisfies Record<WeightUnit, number>,

  /** Default unit when the caller does not say. Provisional — see GDD §11. */
  DEFAULT_UNIT: 'kg' as WeightUnit,

  /** Default snapping direction for a prescribed load. */
  DEFAULT_ROUNDING_MODE: 'nearest' as RoundingMode,

  /**
   * Decimal places used to scrub IEEE-754 noise out of a rounded load
   * (e.g. 162.50000000000003 -> 162.5). Not a game-feel value, but it is a
   * rounding literal and belongs here rather than inline.
   */
  LOAD_PRECISION_DECIMALS: 6,

  /**
   * How close a caller-supplied RPE must be to a charted RPE to count as that
   * RPE. Deliberately tiny: it absorbs float noise (7.5000000000000001) and
   * nothing else. It must never be widened into silent interpolation — an
   * uncharted RPE like 7.3 has to stay off-chart (GDD §12.3).
   */
  RPE_MATCH_TOLERANCE: 1e-9,
} as const;

// ---------------------------------------------------------------------------
// The chart
// ---------------------------------------------------------------------------

type RpeChart = Readonly<Record<ChartedReps, Readonly<Record<ChartedRpe, number>>>>;

/**
 * %1RM by [reps][RPE]. Values are percentages (92.2 means 92.2% of 1RM).
 *
 * Laid out reps-major so a single rep count reads as one block; the published
 * chart is usually printed RPE-major (RPE down the side, reps across the top).
 * `rpe.test.ts` transcribes it in the published orientation and asserts every
 * one of the 108 cells, so the two layouts check each other.
 */
export const RPE_PERCENT_CHART = {
  1: { 10: 100.0, 9.5: 97.8, 9: 95.5, 8.5: 93.9, 8: 92.2, 7.5: 90.7, 7: 89.2, 6.5: 87.8, 6: 86.3 },
  2: { 10: 95.5, 9.5: 93.9, 9: 92.2, 8.5: 90.7, 8: 89.2, 7.5: 87.8, 7: 86.3, 6.5: 85.0, 6: 83.7 },
  3: { 10: 92.2, 9.5: 90.7, 9: 89.2, 8.5: 87.8, 8: 86.3, 7.5: 85.0, 7: 83.7, 6.5: 82.4, 6: 81.1 },
  4: { 10: 89.2, 9.5: 87.8, 9: 86.3, 8.5: 85.0, 8: 83.7, 7.5: 82.4, 7: 81.1, 6.5: 79.9, 6: 78.6 },
  5: { 10: 86.3, 9.5: 85.0, 9: 83.7, 8.5: 82.4, 8: 81.1, 7.5: 79.9, 7: 78.6, 6.5: 77.4, 6: 76.2 },
  6: { 10: 83.7, 9.5: 82.4, 9: 81.1, 8.5: 79.9, 8: 78.6, 7.5: 77.4, 7: 76.2, 6.5: 75.1, 6: 73.9 },
  7: { 10: 81.1, 9.5: 79.9, 9: 78.6, 8.5: 77.4, 8: 76.2, 7.5: 75.1, 7: 73.9, 6.5: 72.3, 6: 70.7 },
  8: { 10: 78.6, 9.5: 77.4, 9: 76.2, 8.5: 75.1, 8: 73.9, 7.5: 72.3, 7: 70.7, 6.5: 69.4, 6: 68.0 },
  9: { 10: 76.2, 9.5: 75.1, 9: 73.9, 8.5: 72.3, 8: 70.7, 7.5: 69.4, 7: 68.0, 6.5: 66.7, 6: 65.3 },
  10: { 10: 73.9, 9.5: 72.3, 9: 70.7, 8.5: 69.4, 8: 68.0, 7.5: 66.7, 7: 65.3, 6.5: 64.0, 6: 62.6 },
  11: { 10: 70.7, 9.5: 69.4, 9: 68.0, 8.5: 66.7, 8: 65.3, 7.5: 64.0, 7: 62.6, 6.5: 61.3, 6: 59.9 },
  12: { 10: 68.0, 9.5: 66.7, 9: 65.3, 8.5: 64.0, 8: 62.6, 7.5: 61.3, 7: 59.9, 6.5: 58.6, 6: 57.2 },
} as const satisfies RpeChart;

// ---------------------------------------------------------------------------
// Coverage guards
// ---------------------------------------------------------------------------

/** True when `reps` is an integer rep count the published chart covers. */
export function isChartedReps(reps: number): reps is ChartedReps {
  return (
    Number.isInteger(reps) &&
    reps >= RPE_CHART_COVERAGE.MIN_REPS &&
    reps <= RPE_CHART_COVERAGE.MAX_REPS
  );
}

/** True when `rpe` lands exactly on a charted RPE (6-10 in 0.5 steps). */
export function isChartedRpe(rpe: number): rpe is ChartedRpe {
  return toChartedRpe(rpe) !== null;
}

/**
 * Snap a numeric RPE onto a charted RPE, or null if it is off-chart.
 * Only absorbs float noise — 7.3 is off-chart and stays off-chart.
 */
function toChartedRpe(rpe: number): ChartedRpe | null {
  if (!Number.isFinite(rpe)) {
    return null;
  }
  for (const candidate of CHARTED_RPES) {
    if (Math.abs(candidate - rpe) <= RPE_LOADING_TUNING.RPE_MATCH_TOLERANCE) {
      return candidate;
    }
  }
  return null;
}

function toChartedReps(reps: number): ChartedReps | null {
  return isChartedReps(reps) ? reps : null;
}

// ---------------------------------------------------------------------------
// Percentage lookup
// ---------------------------------------------------------------------------

/**
 * %1RM for `reps` at `rpe`, or null when the pair is outside the published
 * chart. Returns a percentage in 0-100 (e.g. 92.2), never a fraction.
 *
 * Off-chart returns null rather than extrapolating. The chart stops at 12 reps
 * and RPE 6 for a reason; inventing cells past that is exactly the homebrewing
 * GDD §12.3 forbids.
 */
export function tryPercentOf1RM(reps: number, rpe: number): number | null {
  const chartedReps = toChartedReps(reps);
  const chartedRpe = toChartedRpe(rpe);
  if (chartedReps === null || chartedRpe === null) {
    return null;
  }
  return RPE_PERCENT_CHART[chartedReps][chartedRpe];
}

/**
 * %1RM for `reps` at `rpe`. Throws RangeError when off-chart.
 * Use `tryPercentOf1RM` where an off-chart request is expected and survivable.
 */
export function percentOf1RM(reps: number, rpe: number): number {
  const percent = tryPercentOf1RM(reps, rpe);
  if (percent === null) {
    throw new RangeError(
      `RPE chart has no cell for ${reps} reps @ RPE ${rpe}. ` +
        `Coverage is ${RPE_CHART_COVERAGE.MIN_REPS}-${RPE_CHART_COVERAGE.MAX_REPS} reps ` +
        `and RPE ${RPE_CHART_COVERAGE.MIN_RPE}-${RPE_CHART_COVERAGE.MAX_RPE} ` +
        `in ${RPE_CHART_COVERAGE.RPE_STEP} steps.`,
    );
  }
  return percent;
}

/** Same lookup expressed as a fraction of 1RM (0.922 rather than 92.2). */
export function fractionOf1RM(reps: number, rpe: number): number {
  return percentOf1RM(reps, rpe) / 100;
}

// ---------------------------------------------------------------------------
// Reps in reserve
// ---------------------------------------------------------------------------

/**
 * Reps in reserve for a charted RPE. This is the definition the chart is built
 * on: RPE 10 = 0 RIR, RPE 9 = 1 RIR, RPE 8 = 2 RIR, halves in between.
 * Throws RangeError for an uncharted RPE.
 */
export function repsInReserve(rpe: number): number {
  const chartedRpe = toChartedRpe(rpe);
  if (chartedRpe === null) {
    throw new RangeError(
      `RPE ${rpe} is not on the chart (RPE ${RPE_CHART_COVERAGE.MIN_RPE}-` +
        `${RPE_CHART_COVERAGE.MAX_RPE} in ${RPE_CHART_COVERAGE.RPE_STEP} steps).`,
    );
  }
  return RPE_CHART_COVERAGE.MAX_RPE - chartedRpe;
}

/** Inverse of `repsInReserve`. Throws RangeError if the result is off-chart. */
export function rpeForRepsInReserve(rir: number): ChartedRpe {
  const chartedRpe = toChartedRpe(RPE_CHART_COVERAGE.MAX_RPE - rir);
  if (chartedRpe === null) {
    throw new RangeError(`${rir} reps in reserve maps to an RPE outside the chart.`);
  }
  return chartedRpe;
}

// ---------------------------------------------------------------------------
// Load prescription
// ---------------------------------------------------------------------------

export interface LoadRoundingOptions {
  /** Explicit increment, in the caller's unit. Overrides `unit`. */
  readonly increment?: number;
  /** Picks the default increment from RPE_LOADING_TUNING.ROUNDING_INCREMENT. */
  readonly unit?: WeightUnit;
  /** Snapping direction. Defaults to RPE_LOADING_TUNING.DEFAULT_ROUNDING_MODE. */
  readonly mode?: RoundingMode;
}

function resolveIncrement(options: LoadRoundingOptions | undefined): number {
  if (options?.increment !== undefined) {
    if (!Number.isFinite(options.increment) || options.increment <= 0) {
      throw new RangeError(`Rounding increment must be a positive finite number.`);
    }
    return options.increment;
  }
  const unit = options?.unit ?? RPE_LOADING_TUNING.DEFAULT_UNIT;
  return RPE_LOADING_TUNING.ROUNDING_INCREMENT[unit];
}

/** Strip IEEE-754 noise introduced by increment arithmetic. */
function scrub(value: number): number {
  return Number(value.toFixed(RPE_LOADING_TUNING.LOAD_PRECISION_DECIMALS));
}

/**
 * Snap a weight onto loadable increments. Increment and direction come from
 * RPE_LOADING_TUNING unless overridden.
 */
export function roundLoad(load: number, options?: LoadRoundingOptions): number {
  if (!Number.isFinite(load)) {
    throw new RangeError(`Load must be a finite number, received ${load}.`);
  }
  const increment = resolveIncrement(options);
  const mode = options?.mode ?? RPE_LOADING_TUNING.DEFAULT_ROUNDING_MODE;
  const steps = load / increment;
  const snappedSteps =
    mode === 'down' ? Math.floor(steps) : mode === 'up' ? Math.ceil(steps) : Math.round(steps);
  return scrub(snappedSteps * increment);
}

function assertUsableE1rm(e1rm: number): void {
  if (!Number.isFinite(e1rm) || e1rm <= 0) {
    throw new RangeError(`e1RM must be a positive finite number, received ${e1rm}.`);
  }
}

/**
 * Unrounded load for `reps` at `rpe` given an e1RM, in whatever unit the e1RM
 * is expressed in. Throws RangeError on a bad e1RM or an off-chart cell.
 */
export function rawLoadForRpeTarget(e1rm: number, reps: number, rpe: number): number {
  assertUsableE1rm(e1rm);
  return scrub(e1rm * fractionOf1RM(reps, rpe));
}

/**
 * Load to put on the bar for `reps` at `rpe` given an e1RM, snapped to loadable
 * increments. This is the GDD §3.3 entry point: the player picks an RPE target,
 * the game picks the weight.
 */
export function loadForRpeTarget(
  e1rm: number,
  reps: number,
  rpe: number,
  options?: LoadRoundingOptions,
): number {
  return roundLoad(rawLoadForRpeTarget(e1rm, reps, rpe), options);
}

/**
 * Chart-based e1RM implied by a completed set: weight lifted for `reps` at
 * `rpe`. This is the algebraic inverse of the same lookup table.
 *
 * NOTE: this is *chart-derived*, not a rep-max formula. Epley/Brzycki e1RM
 * lives in its own module (CLAUDE.md "Domain Correctness"); do not use this
 * function as a substitute for it.
 */
export function e1rmFromChartedSet(weight: number, reps: number, rpe: number): number {
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new RangeError(`Weight must be a positive finite number, received ${weight}.`);
  }
  return scrub(weight / fractionOf1RM(reps, rpe));
}
