/**
 * RPE -> %1RM lookup (Tuchscherer / Reactive Training Systems chart).
 *
 * Pure module. Zero React imports, zero side effects, zero I/O. See CLAUDE.md
 * ("Pure logic is separate from UI") and GDD §9.2.
 *
 * ---------------------------------------------------------------------------
 * SOURCE OF THE NUMBERS  (GDD §3.3 / §12.3 — homebrewed RPE values are a hard
 * refusal condition, so the provenance is documented here, including what could
 * NOT be established.)
 * ---------------------------------------------------------------------------
 *
 * Chart: the standard Mike Tuchscherer / Reactive Training Systems RPE chart,
 * reps 1-12 x RPE 6-10 in 0.5 steps.
 *
 * PRIMARY SOURCE STATUS: NOT VERIFIED, FOR ANY CELL. The RTS article, its
 * mirrors, web.archive.org and every non-GitHub RPE chart page answer 403 at
 * this sandbox's egress proxy. No cell in this grid has been checked against a
 * publication. Everything below is corroboration between community
 * *transcriptions*, which is a weaker thing and is not dressed up as more.
 *
 * WHAT IS COMMITTED. Two transcriptions are committed verbatim as fixtures in
 * `rpe.test.ts`, each in its own foreign syntax, each pinned to an immutable
 * commit SHA so a reviewer can re-fetch exactly these bytes:
 *
 *   S1  karolczyz/metriclift @ 4d22d119cb8fffb9e032f09c01c77d9fada5217b
 *       app/.../util/RpeTable.kt — Kotlin `mapOf(...)`, one line per rep count.
 *       That commit (2026-01-25) is the only one that has ever touched the file.
 *   S4  Sculpt-AI/progressive-overload @ acff80ec646b7b01b5a5528baff17f3b2ec17b8b
 *       src/rpe_progression.ts — TypeScript `new Map([[key, value], ...])`, one
 *       pair per line. That commit (2026-06-30) is the only one that has ever
 *       touched the file; npm @sculpt-ai/progressive-overload 0.0.1 was
 *       published the same day, and 0.0.2 (2026-07-01) did not change it.
 *
 * `CHART_SOURCES` carries the full pinned URLs. S1 and S4 agree on 107 of the
 * 108 cells and differ at exactly one, (12, 6). That diff is recomputed from
 * the fixture bytes on every test run, not asserted here from memory.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS NOT ESTABLISHED: THAT THE TWO FIXTURES ARE TWO WITNESSES
 * ---------------------------------------------------------------------------
 * Nothing available here shows S1 and S4 are independent readings of the chart.
 * Checked on 2026-07-31, by clone and by fetch:
 *
 *   - Neither repository attributes its table to anything. S4's
 *     `rpe_progression.ts` carries no comments at all; its README and
 *     package.json describe the package only as "the math behind Sculpt AI's
 *     workout generation". S1's `RpeTable.kt` has one comment, about rounding,
 *     in Polish; its README lists app features and names no source.
 *   - Both lay the grid out reps-major with RPE descending 10 -> 6, i.e. both
 *     transpose the usual printed orientation the same way. So do S2 and S3
 *     below. That is consistent with common descent and equally with "the
 *     obvious way to key a lookup table"; it decides nothing.
 *   - Their number formatting differs (S2/S3 drop trailing zeros — 68, 64, 100;
 *     S1 declares Map<Double, Double> and so cannot — 68.0, 100.0; S4 writes one
 *     decimal everywhere except a bare 100). Formatting does not survive
 *     retyping or regeneration, so this rules nothing in or out either.
 *
 * SO THE 107-CELL AGREEMENT MAY BE ONE WITNESS AGREEING WITH ITSELF. If the two
 * fixtures descend from a single text, the suite's strongest check — "matches
 * every cell the committed transcriptions agree on" — degrades to "matches the
 * text everybody copies", and a slip that entered circulation before 2020 would
 * pass every test in `rpe.test.ts` silently. GDD §3.3 makes this grid the
 * loading source for every session, so such a slip would move every prescribed
 * load in the game. Nothing in this repo can close that gap. Only a
 * structurally different source — a scan of the printed chart, a federation or
 * coaching spreadsheet, something outside the JS/Kotlin app ecosystem — would,
 * and none is reachable from here. A third app-ecosystem transcription would
 * add a fixture and no evidence.
 *
 * A previous revision of this header stated "Two lineages, two syntaxes, two
 * layouts" as fact, and `rpe.test.ts` cited this header as the authority for
 * it. It was never established. It is withdrawn.
 *
 * ALSO READ, NOT COMMITTED, and not citable as backing for any number:
 *   S3  BlindLemonLipschitz/RPE scripts/rpeChart.js — present in the repo's
 *       first commit, 2020-02-29 (then in scripts/main.js; moved by a
 *       2020-03-08 refactor). `var rpe_chart = {`, reps-major, RPE descending.
 *   S2  AlexArmstrong126/reactRPE src/rpe_chart.js — first commit 2023-04-11
 *       (UTC). `const rpe_chart = {` — same variable name, same layout, same
 *       ordering.
 *
 * S3 holds 92.9 at 1 rep @ RPE 8 while holding 92.2 at 2 reps @ RPE 9, which is
 * the same cell under the reps-in-reserve identity; S2 holds 92.2 in both
 * places. A shared variable name, a shared layout and a repaired
 * self-contradiction, in date order, are why this module treats S3, S2 and S1
 * as ONE line of copying rather than three witnesses. That is an inference from
 * those observations, not something anyone has attested — but it is used only
 * to REFUSE corroboration, never to grant it, so being wrong about it can only
 * make this module more cautious than it needs to be. An earlier revision used
 * the opposite move, counting those three as "three retrieved transcriptions"
 * to settle a cell. That was false and is gone.
 *
 * ---------------------------------------------------------------------------
 * THE ONE CELL THE FIXTURES DISAGREE ON: (12 reps, RPE 6)
 * ---------------------------------------------------------------------------
 * S1 reads 57.4, S4 reads 57.2. The chart returns 57.4 — the older reading and
 * the value this repo already shipped — as a DEFAULT, not a finding.
 *
 * 57.2 is also exactly where the tail's constant -2.7 per effort index lands
 * (68.0, 65.3, 62.6, 59.9, ...). An earlier revision called that "not evidence
 * either way, since a published number is free to fall on a run". That covered
 * only half of it. A number RECONSTRUCTED from the grid always falls on the
 * run; a number faithfully read falls on it only if the published chart happens
 * to continue. So the observation leans — weakly — toward S4's cell being
 * derived rather than read, and that is the only direction it can lean. It is
 * weak because S4's repo cites nothing and comments nothing, so nothing here
 * distinguishes a reconstruction from a reading; and it convicts nobody,
 * because 57.4's deviation from the run is equally what one transcription slip
 * looks like. Neither reading is safe. What the observation forbids is counting
 * the pattern fit as corroboration of 57.2.
 *
 * TO ADOPT 57.2: change that one cell in `RPE_PERCENT_CHART`. That is the whole
 * edit — no test change, no fixture change; the S4 fixture already backs it and
 * the suite stays green. (Verified by making the edit and running the suite.) A
 * value NEITHER fixture holds fails, whatever this file claims about it.
 *
 * WHAT WOULD SETTLE IT: the RTS original, or a scan of the printed chart.
 * Nothing reachable from this sandbox.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE STRUCTURAL INVARIANTS CAN AND CANNOT CATCH
 * ---------------------------------------------------------------------------
 * Diagonal identity: the chart encodes reps in reserve, so N reps at RPE X and
 * (N + 1) reps at RPE (X + 1) are the same distance from failure and share a
 * percentage — 1 @ RPE 9 == 2 @ RPE 10 == 95.5%. The grid satisfies it at every
 * cell and `rpe.test.ts` asserts it. This is what makes a single-source slip
 * like S3's 92.9 detectable. It is INTERNAL: it relates our cells to our own
 * cells, so it cannot catch an error the whole grid shares — which is exactly
 * the error a single lineage would hand us.
 *
 * Four cells have no diagonal partner inside a 12 x 9 grid, so the diagonal
 * cannot constrain them at all:
 *
 *   (1, 10)   = 100.0  true by definition — a single at RPE 10 is the 1RM.
 *   (1, 9.5)  =  97.8  pinned by the half-cell midpoint relation below.
 *   (12, 6.5) =  58.6  held by both committed fixtures, checked against both.
 *   (12, 6)            the disagreed cell above; one of two readings, and the
 *                      one cell with no external check stronger than that.
 *
 * Half-cell midpoint relation: each half-RPE cell is the round-half-up midpoint
 * of the two whole-RPE cells either side of it along the effort-index diagonal
 * (`reps + (10 - rpe)`). It holds at 14 of the 15 checkable half positions and
 * breaks at exactly one — index 15.5, which is (12, 6.5). IF the relation is a
 * real property of the published chart, then either (12, 6.5) is 58.7 or
 * (12, 6) is not 57.4. But the relation is an observation fitted to this grid,
 * not a published construction rule, and a printed chart may break its own
 * pattern in a corner. All three possibilities stay open; this module resolves
 * none of them, and never adopts 58.7 — a number no source holds, reconstructed
 * from the grid's own pattern, which is precisely the homebrewing GDD §12.3
 * forbids.
 *
 * NOT TUNABLE: the percentages in RPE_PERCENT_CHART are published domain data,
 * not game feel. Do not adjust them to balance the game. RPE_MATCH_TOLERANCE is
 * not tunable either — it is a correctness guard and lives outside the tuning
 * block on purpose. The only tunable values in this module are in
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
 *
 * FROZEN, for the reason `deepFreezeChart` gives and with more at stake: this
 * object and the two lists below are the gate that decides on-chart from
 * off-chart, and `MAX_RPE - rpe` is the reps-in-reserve definition the chart
 * encodes. A caller who could write `MAX_RPE = 9.5` would shift every RIR by
 * half a rep — every prescribed load and chart-derived e1RM wrong, no NaN, no
 * throw. `as const` is a compile-time claim and did not stop it.
 */
export const RPE_CHART_COVERAGE = Object.freeze({
  MIN_REPS: 1,
  MAX_REPS: 12,
  MIN_RPE: 6,
  MAX_RPE: 10,
  RPE_STEP: 0.5,
} as const);

/**
 * The chart's key sets, enumerable at runtime. Frozen for the reason above:
 * `CHARTED_RPES.push(7.3)` used to succeed, after which `isChartedRpe(7.3)`
 * answered true and the lookup returned `undefined` from a function declared
 * `number | null`.
 *
 * They must stay exactly the keys of `RPE_PERCENT_CHART`, since `toChartedRpe`
 * hands an element of `CHARTED_RPES` to the chart as if the compiler had proved
 * it is a key. `rpe.test.ts` ("enumerates exactly the chart's own keys, in both
 * directions") holds them to that; the UNTRUSTED KEY guards below catch a
 * mismatch at runtime if it ever stops holding.
 */
export const CHARTED_REPS: readonly ChartedReps[] = Object.freeze([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
]);

export const CHARTED_RPES: readonly ChartedRpe[] = Object.freeze([
  6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10,
]);

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
 *
 * Frozen, like everything else this module exports. Tuning happens by editing
 * these literals and rebuilding, never by writing to the object at runtime: a
 * caller that could set `ROUNDING_INCREMENT.kg = 100` would change every load
 * the game prescribes.
 */
export const RPE_LOADING_TUNING = Object.freeze({
  /**
   * Smallest total bar change we will prescribe, per unit. 2.5 kg = 1.25 kg a
   * side; 5 lb = 2.5 lb a side. Both are the smallest increments a normal gym
   * can actually load without change plates.
   */
  ROUNDING_INCREMENT: Object.freeze(
    { kg: 2.5, lb: 5 } as const satisfies Record<WeightUnit, number>,
  ),

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
} as const);

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
 * `rpe.test.ts` checks this grid three ways, in descending order of force:
 *
 *   1. Against the TWO verbatim third-party fixtures, S1 and S4 — each in its
 *      own foreign syntax and layout, each pinned to a commit SHA so a reviewer
 *      can re-fetch and diff. Where the two agree (107 of 108 cells) the grid
 *      must match them exactly. Where they disagree (only (12, 6)) the grid
 *      must hold one of the two readings. This is the only external check the
 *      module has, and its force depends on the fixtures not sharing one
 *      lineage — which is NOT established. See the header.
 *   2. Against a hand transposition into the printed RPE-major orientation.
 *      This catches in-repo transposition typos and is NOT independent evidence
 *      about the source values — same hand, same fixtures.
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
  // The last two cells of this row carry competing readings on record in
  // CONTESTED_CHART_CELLS below. Only 6: 57.4 is contested BETWEEN the fixtures
  // (S4 reads 57.2); 6.5: 58.6 is in both and is checked against both, and is
  // listed only because the grid's fitted midpoint relation breaks there.
  // Changing 6: 57.4 to 57.2 is a one-line edit here and needs no test change.
  12: { 10: 68.0, 9.5: 66.7, 9: 65.3, 8.5: 64.0, 8: 62.6, 7.5: 61.3, 7: 59.9, 6.5: 58.6, 6: 57.4 },
} as const satisfies RpeChart);

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
 * S2 and S3 (see the header) were read but their bytes are not committed, so
 * they are not source ids — nothing may cite them as backing for a number.
 */
export type ChartSourceId = 'S1' | 'S4';

/** Where a committed fixture came from, so a reviewer can re-fetch and diff. */
export interface ChartSource {
  readonly id: ChartSourceId;
  /**
   * Raw URL the bytes were fetched from, PINNED TO A COMMIT SHA rather than to
   * `master`/`main`. Re-fetching and diffing is the one verification step this
   * module admits it cannot perform in-suite (the tests are offline by design),
   * so the ref it names has to be immutable or the instruction is empty.
   * `rpe.test.ts` asserts the URL embeds `commit` and that `commit` is a full
   * 40-hex SHA.
   */
  readonly url: string;
  /** The commit the URL is pinned to. */
  readonly commit: string;
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
 * The committed transcriptions: two syntaxes, two layouts, two repositories.
 * NOT two established lineages — see the header. Neither repository says where
 * its numbers came from, so these may be one text copied twice.
 *
 * They are also not the publication. What they buy is that every number in
 * `RPE_PERCENT_CHART` is tied to bytes someone else wrote, at a pinned URL
 * anyone can re-fetch, and that faking one would take a whole hand-written
 * 108-cell file in a foreign syntax rather than a one-token edit.
 */
export const CHART_SOURCES: Readonly<Record<ChartSourceId, ChartSource>> = Object.freeze({
  S1: Object.freeze({
    id: 'S1',
    url: 'https://raw.githubusercontent.com/karolczyz/metriclift/4d22d119cb8fffb9e032f09c01c77d9fada5217b/app/src/main/java/com/example/metriclift/util/RpeTable.kt',
    commit: '4d22d119cb8fffb9e032f09c01c77d9fada5217b',
    retrieved: '2026-07-31',
    syntax: 'Kotlin mapOf(...) literals, one line per rep count',
  }),
  S4: Object.freeze({
    id: 'S4',
    url: 'https://raw.githubusercontent.com/Sculpt-AI/progressive-overload/acff80ec646b7b01b5a5528baff17f3b2ec17b8b/src/rpe_progression.ts',
    commit: 'acff80ec646b7b01b5a5528baff17f3b2ec17b8b',
    retrieved: '2026-07-31',
    syntax: 'TypeScript new Map([[key, value], ...]) tuple pairs, one per line',
  }),
});

// ---------------------------------------------------------------------------
// Cells with competing readings on record
// ---------------------------------------------------------------------------

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
      /** A committed source fixture literally holds this number at this cell. */
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
      /**
       * No retrieved source holds this number; it is what the grid's own
       * half-cell midpoint relation would require. Recorded as context ONLY.
       * This module must never adopt a 'grid-rule' reading: reconstructing a
       * published number from a pattern fitted to the rest of the grid is the
       * homebrewing GDD §12.3 forbids, and `rpe.test.ts` enforces that.
       */
      readonly evidence: 'grid-rule';
      /**
       * Absent by construction: a 'grid-rule' reading is derived from this
       * grid, so there is no source to cite and none may be claimed.
       */
      readonly sources?: undefined;
      /** Provenance in one line. */
      readonly note: string;
    };

/** A cell this module returns a number for while a rival reading is on record. */
export interface ContestedChartCell {
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
  /** Why the cell is listed. */
  readonly reason: string;
}

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

function describeContestedCell(
  reps: ChartedReps,
  rpe: ChartedRpe,
  readings: readonly ChartCellReading[],
  reason: string,
): ContestedChartCell {
  return Object.freeze({
    reps,
    rpe,
    percentInUse: RPE_PERCENT_CHART[reps][rpe],
    readings: Object.freeze(readings.map(freezeReading)),
    reason,
  });
}

/**
 * The cells with a rival reading on record, and what backs each reading.
 *
 * THIS IS NOT A LIST OF THE ONLY DOUBTFUL CELLS. No cell in this grid is
 * verified against the publication, and if the two fixtures share a lineage
 * then none of the 108 is corroborated at all (see the header). What is listed
 * here is narrower and checkable: cells where a SECOND candidate value is on
 * record, so that the number in use is visibly a choice rather than a fact.
 *
 * `rpe.test.ts` turns this from prose into a guard. Every 'transcription'
 * reading must be held, byte for byte, by each fixture it cites; the citation
 * must name every fixture that holds it; a 'grid-rule' reading must be held by
 * no fixture; and the value the chart actually uses must be one some fixture
 * holds. None of that can be satisfied by editing this file alone.
 */
export const CONTESTED_CHART_CELLS: readonly ContestedChartCell[] = Object.freeze([
  describeContestedCell(
    12,
    6,
    [
      {
        percent: 57.4,
        evidence: 'transcription',
        sources: ['S1'],
        note: 'S1, and behind it the S3 (2020) -> S2 (2023) -> S1 (2026) copy chain: three links of one inferred chain, not three witnesses. Only S1 is committed as a fixture.',
      },
      {
        percent: 57.2,
        evidence: 'transcription',
        sources: ['S4'],
        note: 'S4 (Sculpt-AI/progressive-overload, npm @sculpt-ai/progressive-overload 0.0.1, 2026-06-30). Whether this is a second reading or a repair of a copy is not established; the repo cites nothing and its table file carries no comments.',
      },
    ],
    'The committed fixtures disagree here, and this is the only cell where ' +
      'they do. It also has no partner on the reps-in-reserve diagonal and no ' +
      'half-cell neighbour above it, so no invariant in this module touches ' +
      'it. 57.2 additionally continues the tail\'s constant -2.7 per effort ' +
      'index exactly; that fit is what a value reconstructed from the grid ' +
      'would ALWAYS show and what a faithful reading shows only if the ' +
      'published chart happens to run on, so it cannot corroborate 57.2 — ' +
      'and 57.4 breaking the run is equally what one slip looks like.',
  ),
  describeContestedCell(
    12,
    6.5,
    [
      {
        percent: 58.6,
        evidence: 'transcription',
        sources: ['S1', 'S4'],
        note: 'Both committed fixtures. The suite checks this cell against both, like any settled cell.',
      },
      {
        percent: 58.7,
        evidence: 'grid-rule',
        note: "What the half-cell midpoint relation would require if (12, 6) really is 57.4. No source holds it; not adoptable, and the suite rejects it.",
      },
    ],
    'Both committed fixtures hold 58.6 and the suite enforces that against ' +
      'their bytes, so this cell is as well corroborated as any other. It is ' +
      "listed only because it is the one position where the grid's own fitted " +
      'half-cell midpoint relation breaks, which puts 58.7 on record as a ' +
      'tempting "fix". The relation is not a published construction rule, so ' +
      'it may simply not hold in this corner and nothing may need repairing — ' +
      'but 58.7 is reconstructed from the grid and must never be adopted.',
  ),
]);

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
 *
 * Indexed loop rather than `for...of` on purpose: V8 iterates a FROZEN array
 * through a slower path, and this runs on every lookup. Measured over 400k
 * `percentOf1RM` calls on one sandbox machine (so: a ratio worth trusting, an
 * absolute worth nothing): ~44 ns/call unfrozen with `for...of`, ~95 ns frozen
 * with `for...of`, ~63 ns frozen with the loop below. Freezing the list is not
 * negotiable — it is the lookup gate — so the iterator protocol is what goes.
 */
function toChartedRpe(rpe: number): ChartedRpe | null {
  if (!Number.isFinite(rpe)) {
    return null;
  }
  for (let i = 0; i < CHARTED_RPES.length; i += 1) {
    // UNTRUSTED KEY: an array index really is an index signature, so
    // `noUncheckedIndexedAccess` does widen this one and the check is the
    // compiler's idea rather than ours.
    const candidate = CHARTED_RPES[i];
    if (candidate !== undefined && Math.abs(candidate - rpe) <= RPE_MATCH_TOLERANCE) {
      return candidate;
    }
  }
  return null;
}

function toChartedReps(reps: number): ChartedReps | null {
  return isChartedReps(reps) ? reps : null;
}

/* ---------------------------------------------------------------------------
 * UNTRUSTED KEYS — why some reads in this module look over-careful
 * ---------------------------------------------------------------------------
 * `Record<K, V>` over a finite union is a mapped type with concrete
 * properties, not an index signature, so `noUncheckedIndexedAccess` does NOT
 * widen `RPE_PERCENT_CHART[reps][rpe]` to `number | undefined`. The compiler
 * proves the cell exists, from the key's type plus the `satisfies RpeChart` on
 * the chart literal.
 *
 * That proof is sound for a key the compiler itself produced — the literals in
 * `describeContestedCell`, which is why that read needs no guard.
 *
 * It is NOT sound for a key that came out of a type predicate. `isChartedReps`
 * and `toChartedRpe` are ordinary runtime code wearing `reps is ChartedReps`;
 * if either is ever wrong (a widened bound, a list that has drifted from the
 * chart's keys) the compiler's proof is wrong with it, and a function declared
 * `number | null` returns `undefined` — which sails through a `=== null` check
 * in a caller (`chartPercentForRepMax` in e1rm.ts) and lands in arithmetic as
 * NaN, wearing `method: 'rpe-chart'`.
 *
 * So every read in this module keyed by a predicate's output, by an array
 * index, or by a caller's unverified string re-opens the case the compiler
 * closed: annotate the read `| undefined` and handle it. Each one is marked
 * UNTRUSTED KEY. Do not "simplify" those annotations away — they are what makes
 * the declared return types true of the running code rather than of the
 * signature.
 *
 * Written inline rather than behind a shared generic helper so the annotation
 * sits on the read it protects, where deleting it looks like what it is. A
 * helper version was benchmarked and came out indistinguishable, so this is a
 * readability call and not a performance one.
 * ---------------------------------------------------------------------------
 */

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
 *
 * `null` here means null and only null. The two guards below are what makes
 * that true of the running code rather than of the signature — see UNTRUSTED
 * KEYS above. They are unreachable while `CHARTED_REPS` and `CHARTED_RPES` are
 * exactly the chart's keys, which `rpe.test.ts` enforces; they exist so that if
 * that ever stops holding, the caller gets the `null` it already handles
 * instead of an `undefined` typed as `number`.
 */
export function tryPercentOf1RM(reps: number, rpe: number): number | null {
  const chartedReps = toChartedReps(reps);
  const chartedRpe = toChartedRpe(rpe);
  if (chartedReps === null || chartedRpe === null) {
    return null;
  }
  // UNTRUSTED KEY: chartedReps came from a predicate, not from the compiler.
  const row: Readonly<Record<ChartedRpe, number>> | undefined =
    RPE_PERCENT_CHART[chartedReps];
  if (row === undefined) {
    return null;
  }
  // UNTRUSTED KEY: likewise chartedRpe, which is an element of CHARTED_RPES.
  const percent: number | undefined = row[chartedRpe];
  return percent === undefined ? null : percent;
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
  // UNTRUSTED KEY: `WeightUnit` is a compile-time claim about the caller, and a
  // JS caller can pass 'stone'. Without this guard the increment read
  // `undefined` and every load function returned NaN — silently, for
  // `roundLoad`, which has no other guard on this path.
  const increment: number | undefined = RPE_LOADING_TUNING.ROUNDING_INCREMENT[unit];
  if (increment === undefined) {
    throw new RangeError(
      `No rounding increment for unit ${String(unit)}. Known units: ` +
        `${Object.keys(RPE_LOADING_TUNING.ROUNDING_INCREMENT).join(', ')}.`,
    );
  }
  return increment;
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
