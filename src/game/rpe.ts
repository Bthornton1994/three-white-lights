/**
 * RPE -> %1RM lookup (Tuchscherer / Reactive Training Systems chart).
 *
 * Pure module. Zero React imports, zero side effects, zero I/O. See CLAUDE.md
 * ("Pure logic is separate from UI") and GDD §9.2.
 *
 * ---------------------------------------------------------------------------
 * SOURCE OF THE NUMBERS  (GDD §3.3 / §12.3 — homebrewed RPE values are a hard
 * refusal condition, so the provenance is documented here in full, including
 * what could NOT be established.)
 * ---------------------------------------------------------------------------
 *
 * Chart: the standard Mike Tuchscherer / Reactive Training Systems RPE chart,
 * reps 1-12 x RPE 6-10 in 0.5 steps, as published in "Customizing Your RPE
 * Chart", Reactive Training Systems, 2016-01-06:
 *   articles.reactivetrainingsystems.com/2016/01/06/customizing-your-rpe-chart/
 *
 * PRIMARY SOURCE STATUS: NOT VERIFIED. That article, its store.reactive-
 * trainingsystems.com mirror, web.archive.org, and every non-GitHub RPE chart
 * page are all unreachable from this sandbox — the egress proxy answers 403 to
 * CONNECT. Nothing in this grid has been checked against the publication
 * itself. Everything below is corroboration of community *transcriptions* of
 * that chart. That is a weaker claim than "verified published data" and is
 * deliberately not dressed up as one.
 *
 * WHAT WAS ACTUALLY RETRIEVED AS BYTES (2026-07-31), and what each said:
 *
 *   S1  raw.githubusercontent.com/karolczyz/metriclift/master/app/src/main/
 *         java/com/example/metriclift/util/RpeTable.kt        Kotlin, 108 cells
 *   S2  raw.githubusercontent.com/AlexArmstrong126/reactRPE/main/src/
 *         rpe_chart.js                                        JS, 108 cells
 *   S3  raw.githubusercontent.com/BlindLemonLipschitz/RPE/master/scripts/
 *         rpeChart.js                                         JS, 108 cells
 *   S4  npm @sculpt-ai/progressive-overload@0.0.2, dist/index.mjs RPE_TABLE
 *                                                             JS, 108 cells
 *
 * Machine diff of those four against each other:
 *   - S1 and S2 agree on all 108 cells.
 *   - S3 differs from S1/S2 in exactly one cell: 92.9 at 1 rep @ RPE 8 where
 *     the others hold 92.2. S3 contradicts itself there — it holds 92.2 at
 *     2 reps @ RPE 9, which is the same cell under the reps-in-reserve
 *     identity below — so that is a typo in S3, not a variant reading.
 *   - S4 differs from S1/S2 in exactly one cell: 12 reps @ RPE 6. See below.
 *
 * RPE_PERCENT_CHART below is S1/S2 exactly, all 108 cells.
 *
 * ---------------------------------------------------------------------------
 * THE ONE CONTESTED CELL: 12 reps @ RPE 6 = 57.4
 * ---------------------------------------------------------------------------
 * S1, S2 and S3 hold 57.4. S4 holds 57.2. This file uses 57.4 because:
 *
 *   1. Three retrieved transcriptions to one, and the three are application
 *      source files for three different apps in two languages, while S4 is a
 *      version 0.0.2 package first published 2026-06-30 (date read from the
 *      npm packument) by an AI-product vendor.
 *   2. 57.2 is exactly what you get by DERIVING the cell rather than
 *      transcribing it. Down the effort-index diagonal the chart's tail runs
 *      68.0, 65.3, 62.6, 59.9 — a constant -2.7 per whole index — so a linear
 *      continuation lands on 57.2. The transcribed 57.4 breaks that run
 *      (-2.5), which is precisely why no formula generates it. GDD §12.3
 *      forbids derived RPE values, and this repo previously shipped 57.2.
 *
 * THE STRONGEST ARGUMENT AGAINST 57.4, stated because leaving it out would be
 * dishonest: the grid's half-RPE cells behave as round-half-up midpoints of
 * their whole-RPE neighbours. Fifteen positions can be checked (effort index
 * 1.5 through 15.5); the pattern holds at fourteen of them and fails at exactly
 * one — 15.5, which is 12 reps @ RPE 6.5 = 58.6, the position that depends on
 * the contested cell. For it to hold there, 12 reps @ RPE 6 would have to lie
 * in [57.2, 57.3]. 57.4 does not. So the chosen value is the sole break in a
 * pattern the rest of the grid obeys, and 57.2 would close it.
 *
 * That was weighed and rejected as grounds for changing the cell, because the
 * midpoint pattern is an observation ABOUT this grid, not a published
 * construction rule, and using it to overwrite three retrieved transcriptions
 * would be reconstructing a published value from a fitted rule — which is the
 * exact move GDD §12.3 calls homebrewing. Transcription beats extrapolation
 * even when the extrapolation is prettier. Note also that the pattern fails at
 * 13 of the 14 checkable WHOLE-index positions, so it is not a general law of
 * the grid.
 *
 * HONEST STATUS OF THIS CELL: community-transcription-corroborated, NOT
 * primary-source-verified, and in tension with the grid's own half-cell
 * pattern. S1/S2/S3 may share a single ancestor — S2 and S3 both name the
 * object `rpe_chart`, which points at a common web calculator — so "three
 * sources" is not "three independent readings of the printed chart". This is
 * the least certain number in the module. If someone obtains the RTS original
 * and it disagrees, change this cell and the fixture in rpe.test.ts together,
 * in one commit.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE STRUCTURAL INVARIANTS CAN AND CANNOT CATCH
 * ---------------------------------------------------------------------------
 * Diagonal identity: the chart encodes reps in reserve, so N reps at RPE X and
 * (N + 1) reps at RPE (X + 1) describe the same distance from failure and
 * therefore share a percentage — e.g. 1 @ RPE 9 == 2 @ RPE 10 == 95.5%. The
 * "effort index" is `reps + (10 - rpe)`. The grid satisfies this identity at
 * every cell; `rpe.test.ts` asserts it.
 *
 * It has exactly FOUR blind spots. Four cells have no diagonal partner inside
 * a 12 x 9 grid, so the diagonal cannot constrain them at all:
 *
 *     (1 rep, RPE 10)   (1 rep, RPE 9.5)   (12 reps, RPE 6.5)   (12 reps, RPE 6)
 *
 * `rpe.test.ts` asserts that the orphan set is exactly these four, so the blind
 * spot is visible rather than implicit. Their individual status:
 *
 *   (1, 10)   = 100.0  true by definition; a true single at RPE 10 is the 1RM.
 *   (1, 9.5)  =  97.8  pinned internally by the half-cell midpoint test, given
 *                      the RPE-10 and RPE-9 cells around it.
 *   (12, 6.5) =  58.6  NOT pinned by anything. Transcription only.
 *   (12, 6)   =  57.4  NOT pinned by anything, and contested. See above.
 *
 * Those last two are the cells no test in this repo can defend. If this module
 * is ever wrong about the published chart, that is where it will be wrong.
 *
 * NOT TUNABLE: the percentages in RPE_PERCENT_CHART are published domain data,
 * not game feel. Do not adjust them to balance the game. RPE_MATCH_TOLERANCE
 * is not tunable either — it is a correctness guard and lives outside the
 * tuning block on purpose. The only tunable values in this module are in
 * RPE_LOADING_TUNING.
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
} as const;

// ---------------------------------------------------------------------------
// Correctness guard — deliberately NOT in the tunable block above
// ---------------------------------------------------------------------------

/**
 * Float-noise slack for matching a caller-supplied RPE onto a charted RPE,
 * counted in ULPs (units in the last place) of double precision.
 *
 * THIS IS NOT A GAME-FEEL KNOB, which is why it is not inside
 * RPE_LOADING_TUNING. It is the only thing standing between the lookup and
 * silent interpolation: an uncharted RPE such as 7.3 must stay uncharted
 * (GDD §12.3), and widening a tolerance would quietly snap it to 7.5.
 *
 * Expressing it in ULPs and capping it makes that misuse structurally
 * impossible rather than merely discouraged:
 *
 *   - The widest tolerance this module can ever produce is
 *     RPE_MATCH_ULP_CEILING * Number.EPSILON, about 9.1e-13. Snapping 7.3 onto
 *     7.5 needs 0.2 — eleven orders of magnitude away — so no value of
 *     RPE_MATCH_ULPS, however large, can turn this into a balance knob.
 *   - A tuner who types a plausible-looking "0.25" here makes matching
 *     STRICTER, not looser: 0.25 ULP is a quarter of a machine epsilon.
 *
 * The failure mode of careless tuning is therefore "too strict", never
 * "silently interpolating".
 */
const RPE_MATCH_ULPS = 64;

/** Hard ceiling on RPE_MATCH_ULPS. Not configurable, not tunable. */
const RPE_MATCH_ULP_CEILING = 4096;

/**
 * Resolved absolute RPE-matching tolerance. Exported read-only so tests can
 * assert the ceiling actually binds; application code should never need it.
 */
export const RPE_MATCH_TOLERANCE: number =
  Math.min(RPE_MATCH_ULPS, RPE_MATCH_ULP_CEILING) * Number.EPSILON;

/** The ceiling itself, exported for the same reason. */
export const RPE_MATCH_TOLERANCE_CEILING: number = RPE_MATCH_ULP_CEILING * Number.EPSILON;

// ---------------------------------------------------------------------------
// The chart
// ---------------------------------------------------------------------------

type RpeChart = Readonly<Record<ChartedReps, Readonly<Record<ChartedRpe, number>>>>;

/**
 * %1RM by [reps][RPE]. Values are percentages (92.2 means 92.2% of 1RM).
 *
 * Laid out reps-major so a single rep count reads as one block; the published
 * chart is usually printed RPE-major (RPE down the side, reps across the top).
 *
 * `rpe.test.ts` checks this grid two ways: against a verbatim copy of source S1
 * (foreign syntax, foreign layout, its URL in the fixture so a reviewer can
 * re-fetch and diff), and against a hand transposition into the printed
 * RPE-major orientation, which catches in-repo transposition typos but is NOT
 * independent evidence about the source values.
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
  // 6: 57.4 is the contested cell. It is transcription-corroborated only (S1,
  // S2, S3 in the header), it has no diagonal partner, and 57.2 — the value
  // this repo used to hold — is the linear-derivation answer. Do not "correct"
  // it back without a primary source.
  12: { 10: 68.0, 9.5: 66.7, 9: 65.3, 8.5: 64.0, 8: 62.6, 7.5: 61.3, 7: 59.9, 6.5: 58.6, 6: 57.4 },
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
    if (Math.abs(candidate - rpe) <= RPE_MATCH_TOLERANCE) {
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
