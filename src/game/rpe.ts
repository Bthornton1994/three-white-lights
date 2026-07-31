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
 * PRIMARY SOURCE STATUS: NOT VERIFIED, for any cell. That article, its
 * store.reactivetrainingsystems.com mirror, web.archive.org, and every
 * non-GitHub RPE chart page are unreachable from this sandbox — the egress
 * proxy answers 403 to CONNECT. Nothing in this grid has been checked against
 * the publication itself. Everything below is corroboration of community
 * *transcriptions*. That is a weaker claim than "verified published data" and
 * is deliberately not dressed up as one.
 *
 * WHAT WAS ACTUALLY RETRIEVED AS BYTES, and when each artifact first existed.
 * Dates below were read on 2026-07-31 from `git log --reverse` on a bare clone
 * of each repository (api.github.com is 403 from here; the git transport is
 * not) and from the npm packument's `time` object. They are first-commit /
 * first-publish dates, not claims about when the chart was transcribed.
 *
 *   S3  github.com/BlindLemonLipschitz/RPE  scripts/rpeChart.js
 *       first commit 2020-02-29. `var rpe_chart = {`, reps-major, RPE
 *       descending 10 -> 6, one nested object per rep count.
 *   S2  github.com/AlexArmstrong126/reactRPE  src/rpe_chart.js
 *       first commit 2023-04-11 (UTC; 2023-04-12 +0100 local). `const
 *       rpe_chart = {` — same variable name, same reps-major layout, same
 *       descending RPE order, same file shape.
 *   S1  github.com/karolczyz/metriclift
 *       app/src/main/java/com/example/metriclift/util/RpeTable.kt
 *       first commit 2026-01-25. Kotlin transliteration of the same layout and
 *       ordering. No attribution.
 *   S4  github.com/Sculpt-AI/progressive-overload  src/rpe_progression.ts
 *       `export const RPE_TABLE = new Map<number, Map<number, number>>([...])`
 *       — a Map-of-Maps of `[key, value]` tuple pairs, not object literals,
 *       one entry per line. Published to npm as
 *       @sculpt-ai/progressive-overload (0.0.1 on 2026-06-30, 0.0.2 on
 *       2026-07-01), whose packument names this repository and whose
 *       dist/index.mjs holds the same 108 numbers as the source file.
 *
 * S1 and S4 have their bytes COMMITTED IN THIS REPO, verbatim, as the two
 * fixtures in `rpe.test.ts` — each in its own foreign syntax, each carrying the
 * URL it came from. S2 and S3 were read but are not committed; nothing in this
 * module or its tests depends on them, and they are named here only because
 * they establish the copy chain below. See `CHART_SOURCES`.
 *
 * THESE ARE NOT FOUR INDEPENDENT WITNESSES. S3 -> S2 -> S1 is a copy chain in
 * date order: identical layout, identical ordering, and S2 keeps S3's variable
 * name `rpe_chart` while silently repairing S3's one self-contradicting typo
 * (S3 holds 92.9 at 1 rep @ RPE 8 but 92.2 at 2 reps @ RPE 9, which is the same
 * cell under the reps-in-reserve identity). Repairing a predecessor's typo is
 * evidence of copying, not of independent reading.
 *
 * A previous revision of this header argued that the contested cell below is
 * settled "three retrieved transcriptions to one … three different apps in two
 * languages". THAT ARGUMENT WAS FALSE and has been removed. Counting links in
 * one copy chain is not corroboration. Nothing replaced it: the cell is not
 * settled here in either direction.
 *
 * Machine diff of the four, for what it is worth:
 *   - S1 and S2 agree on all 108 cells.
 *   - S3 differs from S1/S2 only at 1 rep @ RPE 8 (the typo above).
 *   - S4 differs from S1/S2 only at 12 reps @ RPE 6. See below.
 *
 * The S1-vs-S4 half of that diff is not a claim you have to take on trust: both
 * fixtures are committed, `rpe.test.ts` recomputes the diff from their bytes on
 * every run, and asserts it is exactly one cell.
 *
 * ---------------------------------------------------------------------------
 * WHAT "TRANSCRIPTION" MEANS HERE, AND WHY IT IS NOT A SELF-DECLARATION
 * ---------------------------------------------------------------------------
 * `UNVERIFIED_CHART_CELLS` below records competing readings for the cells this
 * module cannot settle. A reading tagged `evidence: 'transcription'` MUST name
 * the sources it was transcribed from (`ChartCellReading.sources`, drawn from
 * `CHART_SOURCE_IDS`) — the type is a non-empty tuple, so an uncited
 * transcription does not compile. `rpe.test.ts` then resolves each id to a
 * committed verbatim fixture, parses that fixture in its own foreign syntax,
 * and fails unless the bytes hold that number at that cell.
 *
 * The point is that typing a number into this file cannot manufacture its own
 * corroboration. An earlier revision let it: the guard read the readings array
 * and checked the chart value appeared in it, which was this file certifying
 * this file. Adding `{ percent: 58.7, evidence: 'transcription' }` was enough to
 * legitimise 58.7, a number no source holds, and the suite stayed green.
 *
 * That is fixed at four points, verified by re-running the exploit:
 *   - the uncited form no longer compiles;
 *   - `percentInUse` is checked against fixture bytes without consulting
 *     `readings` at all, so no edit confined to this file can satisfy it;
 *   - a cited source must actually hold the cited number at that cell, and the
 *     citation must list every source that holds it;
 *   - the fixture-agreement check now skips only cells where the fixtures
 *     genuinely differ, not cells this file declares unverified — so declaring
 *     a cell unverified no longer exempts it from anything.
 *
 * WHAT THIS STILL DOES NOT PROVE. The fixtures are bytes we hold, not bytes the
 * test re-fetches — the suite is offline and stays offline. Someone determined
 * to fake a reading could hand-write a whole 108-cell fixture in foreign syntax
 * under a plausible URL. Nothing in-repo can stop that. What the fixtures do buy
 * is that a reviewer can re-fetch each URL and diff, that the falsification has
 * to be large and visible rather than a one-token edit, and that the S1-vs-S4
 * disagreement set is recomputed rather than asserted from memory.
 *
 * ---------------------------------------------------------------------------
 * THE TWO CELLS THIS MODULE DECLARES 'unverified': (12, 6) and (12, 6.5)
 * ---------------------------------------------------------------------------
 * They are here for different reasons and are NOT equally weak — an earlier
 * revision insisted they were, and it was that insistence that stripped the
 * external check off the better-supported of the two. Read both entries.
 *
 * Both are declared `'unverified'` IN CODE, not only in this comment — see
 * `UNVERIFIED_CHART_CELLS`, `chartCellStatus` and `tryChartCell` below. A
 * caller that needs to know whether a number is settled can ask; the ordinary
 * `percentOf1RM` path is unchanged and stays a plain number.
 *
 * 12 reps @ RPE 6. The copy chain S3/S2/S1 holds 57.4; S4 holds 57.2. The
 * chart currently returns 57.4 — the reading of the older lineage and the value
 * this repo already shipped — but that is a default, not a finding. This is the
 * one cell in the grid where the committed fixtures disagree, so it is the one
 * cell no external check can pin.
 *
 * 12 reps @ RPE 6.5. Both committed fixtures hold 58.6 and `rpe.test.ts`
 * enforces that against their bytes, same as any other cell. It is still
 * declared 'unverified' — which here means "not checked against the
 * publication, and structurally odd", not "unchecked" — because of the grid's
 * own half-cell behaviour: each half-RPE cell is the round-half-up midpoint of
 * the two whole-RPE cells either side of it along the effort-index diagonal
 * (`reps + (10 - rpe)`). That relation holds at 14 of the 15 checkable half
 * positions and breaks at exactly one — index 15.5, which is (12, 6.5). It
 * constrains the TRIPLE (index 15, 15.5, 16) = (59.9, ?, ?), and there are
 * exactly two minimal repairs:
 *
 *     keep 58.6 at (12, 6.5)  ->  (12, 6) must be 57.2 or 57.3   [S4's grid]
 *     keep 57.4 at (12, 6)    ->  (12, 6.5) must be 58.7         [no source]
 *
 * IF that midpoint relation is a real property of the published chart, then at
 * most one of the two cells this module currently returns can be right, and the
 * grid does not say which. That "if" is load-bearing and is not established:
 * the relation is an observation fitted to this grid, not a published
 * construction rule, and a printed chart is free to break its own pattern in a
 * corner. If it does not hold at index 15.5, both current values can be correct
 * and there is nothing to repair. An earlier revision stated the exclusion as
 * fact; it was never more than a conditional and is written as one now.
 *
 * Either way the module does not resolve it. Picking a repair and writing a
 * test that forbids the alternative would be inventing a finding, and adopting
 * 58.7 — a number derived from the grid's own fitted pattern and held by no
 * source — is precisely the homebrewing GDD §12.3 forbids.
 *
 * WHAT WOULD SETTLE IT: the RTS original, or a scan/photo of the printed chart.
 * Nothing reachable from this sandbox can. To adopt S4's reading of (12, 6),
 * change the cell in `RPE_PERCENT_CHART` from 57.4 to 57.2 — that is the whole
 * edit. No test changes, no fixture changes, nothing is deleted; the S4 fixture
 * already backs 57.2 and the suite stays green. (Verified by making the edit and
 * running the suite.) The reverse also holds: a value neither fixture contains
 * fails, whatever this file claims about it.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE STRUCTURAL INVARIANTS CAN AND CANNOT CATCH
 * ---------------------------------------------------------------------------
 * Diagonal identity: the chart encodes reps in reserve, so N reps at RPE X and
 * (N + 1) reps at RPE (X + 1) describe the same distance from failure and
 * therefore share a percentage — e.g. 1 @ RPE 9 == 2 @ RPE 10 == 95.5%. The
 * grid satisfies this identity at every cell; `rpe.test.ts` asserts it. This is
 * what makes a single-source slip like S3's 92.9 detectable.
 *
 * It has exactly FOUR blind spots. Four cells have no diagonal partner inside
 * a 12 x 9 grid, so the diagonal cannot constrain them at all:
 *
 *     (1 rep, RPE 10)   (1 rep, RPE 9.5)   (12 reps, RPE 6.5)   (12 reps, RPE 6)
 *
 * `rpe.test.ts` asserts that the orphan set is exactly these four, so the blind
 * spot is visible rather than implicit. Their individual status:
 *
 *   (1, 10)   = 100.0  'definitional'      a true single at RPE 10 is the 1RM.
 *   (1, 9.5)  =  97.8  'invariant-pinned'  by the half-cell midpoint relation,
 *                                          given the RPE-10 and RPE-9 cells.
 *   (12, 6.5) =  58.6  'unverified'        see above. Both committed fixtures
 *                                          hold it and the suite checks it, so
 *                                          it is externally corroborated even
 *                                          though no invariant reaches it.
 *   (12, 6)   =  57.4  'unverified'        see above. The committed fixtures
 *                                          disagree here; this is the only cell
 *                                          in the grid with no external check
 *                                          stronger than "one of two readings".
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
 * Freeze the grid and each of its rows so the published data cannot be edited
 * at runtime by anything holding a reference. `Readonly<...>` is a compile-time
 * claim only; this makes it true of the running object as well. Pure: it
 * touches nothing but the literal it is handed.
 */
function deepFreezeChart<T extends RpeChart>(chart: T): T {
  for (const reps of CHARTED_REPS) {
    Object.freeze(chart[reps]);
  }
  Object.freeze(chart);
  return chart;
}

/**
 * %1RM by [reps][RPE]. Values are percentages (92.2 means 92.2% of 1RM).
 *
 * Laid out reps-major so a single rep count reads as one block; the published
 * chart is usually printed RPE-major (RPE down the side, reps across the top).
 *
 * `rpe.test.ts` checks this grid three ways:
 *
 *   1. Against TWO verbatim third-party fixtures, S1 and S4 — each in its own
 *      foreign syntax and layout, each carrying its URL so a reviewer can
 *      re-fetch and diff. Where the two fixtures agree (107 of 108 cells,
 *      including (12, 6.5)) the grid must match them exactly. Where they
 *      disagree (only (12, 6)) the grid must hold one of the two readings, and
 *      the cell must be declared in `UNVERIFIED_CHART_CELLS`.
 *   2. Against a hand transposition into the printed RPE-major orientation.
 *      This catches in-repo transposition typos and is NOT independent evidence
 *      about the source values — same hand, same fixture.
 *   3. Against the structural invariants (the reps-in-reserve diagonal, the
 *      half-cell midpoint relation), which relate our cells to our own cells
 *      and cannot catch an error the whole grid shares.
 *
 * THIS IS THE ONLY PLACE A CELL VALUE IS WRITTEN DOWN in this module. Nothing
 * else restates one, so changing a cell here is a complete change.
 */
export const RPE_PERCENT_CHART = deepFreezeChart({
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
  // The last two cells of this row, 6.5: 58.6 and 6: 57.4, are declared
  // 'unverified' in UNVERIFIED_CHART_CELLS below. Only 6: 57.4 is contested
  // between the committed fixtures (S4 reads 57.2); 6.5: 58.6 is in both and is
  // checked against both. If the grid's half-cell midpoint relation really
  // holds here then at most one of these two values is right — but that
  // relation is fitted to this grid, not published, so it may not hold and both
  // may be right. Changing 6: 57.4 to 57.2 is a one-line edit here and needs no
  // test change; the S4 fixture already backs it.
  12: { 10: 68.0, 9.5: 66.7, 9: 65.3, 8.5: 64.0, 8: 62.6, 7.5: 61.3, 7: 59.9, 6.5: 58.6, 6: 57.4 },
} as const satisfies RpeChart);

// ---------------------------------------------------------------------------
// Cell status — how far this module can defend each cell
// ---------------------------------------------------------------------------

/**
 * How well this module can defend a given cell.
 *
 * READ THIS BEFORE USING IT: none of these statuses means "checked against the
 * publication". No cell in this grid is primary-source verified (see the header
 * — the RTS article is unreachable from here). What the status describes is
 * what the code and its tests can actually catch.
 */
export type ChartCellStatus =
  /**
   * True by definition rather than by transcription. Only (1 rep, RPE 10):
   * a true single at RPE 10 is the 1RM, so the cell is 100.0 whatever any
   * source says.
   */
  | 'definitional'
  /**
   * Held in place by a structural invariant of the grid — the reps-in-reserve
   * diagonal, or the half-cell midpoint relation — so a slip in one source's
   * transcription of this cell surfaces as a test failure instead of a silently
   * wrong load. It does NOT mean the whole grid is right; an error shared by
   * every cell would still pass.
   */
  | 'invariant-pinned'
  /**
   * No structural invariant reaches it, and this module cannot claim the
   * published chart says what it says. The percentage returned for such a cell
   * may be wrong, and the code says so rather than leaving the caveat in a
   * comment. It does NOT imply the cell is unchecked — (12, 6.5) is matched
   * against both committed fixtures like every settled cell. See
   * `UNVERIFIED_CHART_CELLS` for the competing readings and why each cell is
   * here.
   */
  | 'unverified';

// ---------------------------------------------------------------------------
// Sources — the transcriptions whose bytes are committed in this repo
// ---------------------------------------------------------------------------

/**
 * A third-party transcription whose bytes are committed verbatim as a fixture
 * in `rpe.test.ts`.
 *
 * This union is deliberately small and closed. It is the anchor that makes
 * `evidence: 'transcription'` mean something: a reading must name at least one
 * of these, and the suite fails unless every named source's committed fixture
 * literally holds the reading's number at the reading's cell. Adding an id here
 * without adding the matching fixture fails too — verified by doing it.
 *
 * S2 and S3 were read while establishing the copy chain (see the header) but
 * their bytes are not committed, so they are not source ids — nothing may cite
 * them as backing for a number.
 */
export type ChartSourceId = 'S1' | 'S4';

/** Where a committed fixture came from, so a reviewer can re-fetch and diff. */
export interface ChartSource {
  readonly id: ChartSourceId;
  /** Raw URL the bytes were fetched from. */
  readonly url: string;
  /** ISO date the fetch happened, as recorded by the person who ran it. */
  readonly retrieved: string;
  /** The syntax the fixture is committed in, unedited. */
  readonly syntax: string;
}

/**
 * Every source id this module may cite, enumerable at runtime. `rpe.test.ts`
 * asserts this list, the keys of `CHART_SOURCES`, and the set of committed
 * fixtures are the same three things.
 */
export const CHART_SOURCE_IDS: readonly ChartSourceId[] = Object.freeze(['S1', 'S4']);

/**
 * The committed transcriptions. Two lineages, two syntaxes, two layouts.
 *
 * These are NOT the publication. Both are community transcriptions of the RTS
 * chart with no attribution chain back to it; the header says what that is and
 * is not worth. What they buy is that every number in `RPE_PERCENT_CHART` is
 * tied to bytes someone else wrote, at a URL anyone can re-fetch.
 */
export const CHART_SOURCES: Readonly<Record<ChartSourceId, ChartSource>> = Object.freeze({
  S1: Object.freeze({
    id: 'S1',
    url: 'https://raw.githubusercontent.com/karolczyz/metriclift/master/app/src/main/java/com/example/metriclift/util/RpeTable.kt',
    retrieved: '2026-07-31',
    syntax: 'Kotlin mapOf(...) literals, one line per rep count',
  }),
  S4: Object.freeze({
    id: 'S4',
    url: 'https://raw.githubusercontent.com/Sculpt-AI/progressive-overload/main/src/rpe_progression.ts',
    retrieved: '2026-07-31',
    syntax: 'TypeScript new Map([[key, value], ...]) tuple pairs, one per line',
  }),
});

/** What kind of evidence stands behind one candidate value for a cell. */
export type CellReadingEvidence =
  /** A committed source fixture literally holds this number at this cell. */
  | 'transcription'
  /**
   * No retrieved source holds this number; it is what the grid's own half-cell
   * midpoint relation would require. Recorded as context ONLY. This module must
   * never adopt a 'grid-rule' reading: reconstructing a published number from a
   * pattern fitted to the rest of the grid is the homebrewing GDD §12.3 forbids.
   * `rpe.test.ts` enforces that.
   */
  | 'grid-rule';

/**
 * One candidate value for a cell, with where it comes from.
 *
 * A discriminated union, not a flat record with an optional field, so that
 * `evidence: 'transcription'` cannot be written without naming a source. The
 * type makes the citation mandatory; `rpe.test.ts` makes the citation true.
 */
export type ChartCellReading =
  | {
      readonly percent: number;
      readonly evidence: 'transcription';
      /**
       * Which committed fixtures hold `percent` at this cell. A non-empty tuple
       * type, so "transcription with no source" does not compile. Every id
       * listed is checked against that fixture's bytes by `rpe.test.ts` — a
       * wrong id, or a right id whose fixture holds a different number here,
       * fails the suite.
       */
      readonly sources: readonly [ChartSourceId, ...ChartSourceId[]];
      /** Provenance in one line. */
      readonly note: string;
    }
  | {
      readonly percent: number;
      readonly evidence: 'grid-rule';
      /**
       * Absent by construction: a 'grid-rule' reading is derived from this
       * grid, so there is no source to cite and none may be claimed.
       */
      readonly sources?: undefined;
      /** Provenance in one line. */
      readonly note: string;
    };

/**
 * A cell this module returns a number for without being able to defend it as
 * published data. `reason` says what specifically is missing — a fixture
 * disagreement, an invariant blind spot, or both.
 */
export interface UnverifiedChartCell {
  readonly reps: ChartedReps;
  readonly rpe: ChartedRpe;
  /**
   * Whatever `RPE_PERCENT_CHART` currently holds. Read from the chart at module
   * load, never restated — so this record cannot drift out of sync with the
   * data, and changing the cell needs no edit here.
   */
  readonly percentInUse: number;
  /** Every reading documented for this cell, including the one in use. */
  readonly readings: readonly ChartCellReading[];
  /** Why the cell cannot be settled from here. */
  readonly reason: string;
}

/** The one cell that is true by definition rather than by transcription. */
const DEFINITIONAL_CELL: { readonly reps: ChartedReps; readonly rpe: ChartedRpe } = Object.freeze({
  reps: 1,
  rpe: 10,
});

/**
 * Freeze one reading, including its `sources` tuple. Same reasoning as
 * `deepFreezeChart`: `readonly` is a compile-time claim, and provenance a JS
 * caller can rewrite at runtime is not provenance.
 */
function freezeReading(reading: ChartCellReading): ChartCellReading {
  if (reading.evidence === 'transcription') {
    Object.freeze(reading.sources);
  }
  return Object.freeze(reading);
}

function describeUnverifiedCell(
  reps: ChartedReps,
  rpe: ChartedRpe,
  readings: readonly ChartCellReading[],
  reason: string,
): UnverifiedChartCell {
  return Object.freeze({
    reps,
    rpe,
    percentInUse: RPE_PERCENT_CHART[reps][rpe],
    readings: Object.freeze(readings.map(freezeReading)),
    reason,
  });
}

/**
 * The cells whose values this module cannot stand behind, and the competing
 * readings for each.
 *
 * This is the machine-readable form of the header's provenance section. It
 * exists so the uncertainty is reachable by callers and by tests instead of
 * living only in prose: a UI that wants to footnote a disputed number, or a
 * future contributor diffing against a primary source, can enumerate it.
 *
 * The two entries are here for DIFFERENT reasons, and conflating them was an
 * earlier mistake:
 *
 *   (12, 6)   the committed fixtures disagree — S1 reads 57.4, S4 reads 57.2 —
 *             and nothing available here breaks the tie.
 *   (12, 6.5) the fixtures agree on 58.6 and the suite enforces that against
 *             their bytes. What is unsettled is only that the cell sits at the
 *             one position where the grid's half-cell midpoint relation fails.
 *
 * IF that midpoint relation is a real property of the published chart, it
 * constrains the triple (effort index 15, 15.5, 16) = (59.9, ?, ?) and admits
 * exactly two repairs, one per cell — in which case at most one of these two
 * cells is currently right, and the evidence available here does not say which.
 * That conditional is not established: the relation is fitted to this grid
 * rather than published (see the 'grid-rule' note below), and if it simply does
 * not hold at this corner then both current values can be correct and nothing
 * needs repairing. Neither entry is a claim that its cell IS wrong.
 */
export const UNVERIFIED_CHART_CELLS: readonly UnverifiedChartCell[] = Object.freeze([
  describeUnverifiedCell(
    12,
    6,
    [
      {
        percent: 57.4,
        evidence: 'transcription',
        sources: ['S1'],
        note: 'S1, and behind it the S3 (2020) -> S2 (2023) -> S1 (2026) copy chain: three links of one chain, not three witnesses. Only S1 is committed as a fixture.',
      },
      {
        percent: 57.2,
        evidence: 'transcription',
        sources: ['S4'],
        note: 'S4, github.com/Sculpt-AI/progressive-overload, also published as npm @sculpt-ai/progressive-overload 0.0.1 (2026-06-30). Disagrees with the S3 chain at exactly this cell; whether that is a second reading or a slip in a copy is not established.',
      },
    ],
    'The committed fixtures disagree here, and this is the only cell in the ' +
      'grid where they do. It also has no partner on the reps-in-reserve ' +
      'diagonal and no half-cell neighbour above it, so no invariant in this ' +
      'module touches it either. Note that 57.2 also happens to be the linear ' +
      "continuation of the tail's constant -2.7 per index; that coincidence is " +
      'not evidence either way, since a published number is free to fall on a ' +
      'run.',
  ),
  describeUnverifiedCell(
    12,
    6.5,
    [
      {
        percent: 58.6,
        evidence: 'transcription',
        sources: ['S1', 'S4'],
        note: 'Both committed fixtures, i.e. both candidate lineages, and behind S1 the rest of the S3 copy chain. The suite checks this cell against both fixtures like any settled cell.',
      },
      {
        percent: 58.7,
        evidence: 'grid-rule',
        note: 'What the half-cell midpoint relation requires if (12, 6) really is 57.4. No source holds it; not adoptable, and the suite rejects it.',
      },
    ],
    'Both committed fixtures hold 58.6 and the suite enforces it against ' +
      'their bytes, so this cell is externally corroborated — better than its ' +
      "neighbour, not worse. What keeps it here is that the grid's own " +
      'half-cell midpoint relation breaks at exactly this position. IF that ' +
      'relation reflects the real chart, then either this cell is 58.7 or ' +
      '(12, 6) is not 57.4. But the relation is an observation fitted to this ' +
      'grid, not a published construction rule, so it may simply not hold ' +
      'here, in which case there is nothing wrong with either cell. All three ' +
      'possibilities are open. Separately, and unlike a settled cell, nothing ' +
      'in this module checks 58.6 against the publication itself, and no ' +
      'invariant reaches it — which is what this status means.',
  ),
]);

const NO_READINGS: readonly ChartCellReading[] = Object.freeze([]);

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
// Status lookup — for callers that need to know how solid a cell is
// ---------------------------------------------------------------------------

function findUnverifiedCell(reps: ChartedReps, rpe: ChartedRpe): UnverifiedChartCell | null {
  for (const cell of UNVERIFIED_CHART_CELLS) {
    if (cell.reps === reps && cell.rpe === rpe) {
      return cell;
    }
  }
  return null;
}

/**
 * How well this module can defend the cell at `reps`/`rpe`, or null when the
 * pair is off-chart (same contract as `tryPercentOf1RM`).
 *
 * The daily loop does not need this — `percentOf1RM` is unchanged and still
 * returns a bare number. This is for the caller that wants to know, e.g. a
 * screen that footnotes a disputed figure, or a script auditing the grid.
 */
export function chartCellStatus(reps: number, rpe: number): ChartCellStatus | null {
  const chartedReps = toChartedReps(reps);
  const chartedRpe = toChartedRpe(rpe);
  if (chartedReps === null || chartedRpe === null) {
    return null;
  }
  if (findUnverifiedCell(chartedReps, chartedRpe) !== null) {
    return 'unverified';
  }
  if (chartedReps === DEFINITIONAL_CELL.reps && chartedRpe === DEFINITIONAL_CELL.rpe) {
    return 'definitional';
  }
  return 'invariant-pinned';
}

/** True when this module returns a number for the cell that it cannot defend. */
export function isUnverifiedChartCell(reps: number, rpe: number): boolean {
  return chartCellStatus(reps, rpe) === 'unverified';
}

/** A chart cell together with everything known about how solid it is. */
export interface ChartCell {
  readonly reps: ChartedReps;
  readonly rpe: ChartedRpe;
  readonly percent: number;
  readonly status: ChartCellStatus;
  /**
   * Competing readings. Non-empty only when `status` is 'unverified'; for every
   * other cell there is nothing on record to compete with.
   */
  readonly readings: readonly ChartCellReading[];
}

/**
 * The full record for one cell, or null when the pair is off-chart. Everything
 * `percentOf1RM` returns, plus the provenance a caller may want to surface.
 */
export function tryChartCell(reps: number, rpe: number): ChartCell | null {
  const chartedReps = toChartedReps(reps);
  const chartedRpe = toChartedRpe(rpe);
  if (chartedReps === null || chartedRpe === null) {
    return null;
  }
  const status = chartCellStatus(chartedReps, chartedRpe);
  if (status === null) {
    return null;
  }
  const unverified = findUnverifiedCell(chartedReps, chartedRpe);
  return {
    reps: chartedReps,
    rpe: chartedRpe,
    percent: RPE_PERCENT_CHART[chartedReps][chartedRpe],
    status,
    readings: unverified === null ? NO_READINGS : unverified.readings,
  };
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
