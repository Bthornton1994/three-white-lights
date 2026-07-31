import { describe, expect, it } from 'vitest';

import {
  CHARTED_REPS,
  CHARTED_RPES,
  RPE_CHART_COVERAGE,
  RPE_LOADING_TUNING,
  RPE_MATCH_TOLERANCE,
  RPE_MATCH_TOLERANCE_CEILING,
  RPE_PERCENT_CHART,
  UNVERIFIED_CHART_CELLS,
  chartCellStatus,
  e1rmFromChartedSet,
  fractionOf1RM,
  isChartedReps,
  isChartedRpe,
  isUnverifiedChartCell,
  loadForRpeTarget,
  percentOf1RM,
  rawLoadForRpeTarget,
  repsInReserve,
  roundLoad,
  rpeForRepsInReserve,
  tryChartCell,
  tryPercentOf1RM,
  type ChartedReps,
  type ChartedRpe,
} from './rpe';

/* ---------------------------------------------------------------------------
 * WHAT THESE TESTS CAN AND CANNOT PROVE
 * ---------------------------------------------------------------------------
 * The RTS/Tuchscherer primary source is unreachable from this sandbox (403 at
 * the egress proxy), so no test here verifies the grid against the publication.
 * The strongest available check is EXTERNAL_FIXTURE_S1 below: a verbatim copy
 * of a third-party transcription, in that source's own syntax, with its URL
 * attached so a reviewer can re-fetch the bytes and diff. Everything else in
 * this file is structural (monotonicity, the reps-in-reserve diagonal, the
 * half-cell midpoint relation) or a spot check of cells that competitive
 * lifters quote from memory. Structural tests relate our cells to our own other
 * cells; none of them can catch an error the whole grid shares.
 *
 * TWO RULES THIS FILE FOLLOWS, both learned the hard way:
 *
 * 1. Nothing here may assert a chart value by restating the module's own
 *    literal. If a test would fail only because rpe.ts changed, and would pass
 *    for any value rpe.ts happened to hold, it is worthless — delete it.
 *
 * 2. NOTHING HERE MAY ASSERT A NEGATIVE ABOUT A PUBLISHED VALUE. Two earlier
 *    assertions did: one forbade (12, 6) from equalling the linear
 *    continuation of the chart's tail, and one required the grid's own midpoint
 *    relation to keep FAILING at (12, 6.5). Both were written on the strength
 *    of a single copy chain (S3 -> S2 -> S1; see the rpe.ts header for the
 *    dates), and between them they made 57.2 — a value another retrieved
 *    source actually holds — a test failure. That turned an unsettled reading
 *    into an invariant, which is exactly backwards. Both are gone. A test may
 *    say "the module holds a value some source documents"; it may not say "the
 *    published chart does not say X".
 *
 * Four cells have no partner on the reps-in-reserve diagonal inside a 12 x 9
 * grid, so that invariant says nothing about them:
 *
 *     (1 rep, RPE 10)   (1 rep, RPE 9.5)   (12 reps, RPE 6.5)   (12 reps, RPE 6)
 *
 *   - (1, 10) = 100.0 is true by definition.
 *   - (1, 9.5) = 97.8 is pinned by the half-cell midpoint test below.
 *   - (12, 6.5) and (12, 6) are pinned by nothing, and rpe.ts declares both
 *     'unverified' in code (UNVERIFIED_CHART_CELLS). The tests below treat them
 *     as unsettled throughout: the fixture checks skip them, the midpoint check
 *     skips them, and the only thing asserted about their values is that each
 *     is one of the readings a retrieved source actually holds. Either
 *     documented reading of (12, 6) passes this suite; an invented one does
 *     not.
 * ------------------------------------------------------------------------- */

/**
 * Source S1, verbatim: lines 8-19 of
 *   https://raw.githubusercontent.com/karolczyz/metriclift/master/app/src/main/java/com/example/metriclift/util/RpeTable.kt
 * retrieved 2026-07-31. Kept in Kotlin syntax, unedited, so it cannot be
 * quietly "fixed" to match rpe.ts: to change a number here you have to change
 * text that visibly is not ours. Re-fetch that URL and diff if in doubt.
 */
const EXTERNAL_FIXTURE_S1 = `
1 to mapOf(10.0 to 100.0, 9.5 to 97.8, 9.0 to 95.5, 8.5 to 93.9, 8.0 to 92.2, 7.5 to 90.7, 7.0 to 89.2, 6.5 to 87.8, 6.0 to 86.3),
2 to mapOf(10.0 to 95.5, 9.5 to 93.9, 9.0 to 92.2, 8.5 to 90.7, 8.0 to 89.2, 7.5 to 87.8, 7.0 to 86.3, 6.5 to 85.0, 6.0 to 83.7),
3 to mapOf(10.0 to 92.2, 9.5 to 90.7, 9.0 to 89.2, 8.5 to 87.8, 8.0 to 86.3, 7.5 to 85.0, 7.0 to 83.7, 6.5 to 82.4, 6.0 to 81.1),
4 to mapOf(10.0 to 89.2, 9.5 to 87.8, 9.0 to 86.3, 8.5 to 85.0, 8.0 to 83.7, 7.5 to 82.4, 7.0 to 81.1, 6.5 to 79.9, 6.0 to 78.6),
5 to mapOf(10.0 to 86.3, 9.5 to 85.0, 9.0 to 83.7, 8.5 to 82.4, 8.0 to 81.1, 7.5 to 79.9, 7.0 to 78.6, 6.5 to 77.4, 6.0 to 76.2),
6 to mapOf(10.0 to 83.7, 9.5 to 82.4, 9.0 to 81.1, 8.5 to 79.9, 8.0 to 78.6, 7.5 to 77.4, 7.0 to 76.2, 6.5 to 75.1, 6.0 to 73.9),
7 to mapOf(10.0 to 81.1, 9.5 to 79.9, 9.0 to 78.6, 8.5 to 77.4, 8.0 to 76.2, 7.5 to 75.1, 7.0 to 73.9, 6.5 to 72.3, 6.0 to 70.7),
8 to mapOf(10.0 to 78.6, 9.5 to 77.4, 9.0 to 76.2, 8.5 to 75.1, 8.0 to 73.9, 7.5 to 72.3, 7.0 to 70.7, 6.5 to 69.4, 6.0 to 68.0),
9 to mapOf(10.0 to 76.2, 9.5 to 75.1, 9.0 to 73.9, 8.5 to 72.3, 8.0 to 70.7, 7.5 to 69.4, 7.0 to 68.0, 6.5 to 66.7, 6.0 to 65.3),
10 to mapOf(10.0 to 73.9, 9.5 to 72.3, 9.0 to 70.7, 8.5 to 69.4, 8.0 to 68.0, 7.5 to 66.7, 7.0 to 65.3, 6.5 to 64.0, 6.0 to 62.6),
11 to mapOf(10.0 to 70.7, 9.5 to 69.4, 9.0 to 68.0, 8.5 to 66.7, 8.0 to 65.3, 7.5 to 64.0, 7.0 to 62.6, 6.5 to 61.3, 6.0 to 59.9),
12 to mapOf(10.0 to 68.0, 9.5 to 66.7, 9.0 to 65.3, 8.5 to 64.0, 8.0 to 62.6, 7.5 to 61.3, 7.0 to 59.9, 6.5 to 58.6, 6.0 to 57.4)
`;

interface FixtureCell {
  readonly reps: number;
  readonly rpe: number;
  readonly percent: number;
}

/** Parse the Kotlin fixture into cells. Deliberately dumb and total. */
function parseKotlinFixture(text: string): readonly FixtureCell[] {
  const cells: FixtureCell[] = [];
  for (const line of text.split('\n')) {
    const head = /^(\d+) to mapOf\((.*)\),?$/.exec(line.trim());
    if (head === null) {
      continue;
    }
    const repsText = head[1];
    const body = head[2];
    if (repsText === undefined || body === undefined) {
      continue;
    }
    const reps = Number(repsText);
    for (const pair of body.split(',')) {
      const kv = /^\s*([\d.]+) to ([\d.]+)\s*$/.exec(pair);
      if (kv === null) {
        continue;
      }
      const rpeText = kv[1];
      const percentText = kv[2];
      if (rpeText === undefined || percentText === undefined) {
        continue;
      }
      cells.push({ reps, rpe: Number(rpeText), percent: Number(percentText) });
    }
  }
  return cells;
}

/**
 * Sentinel for a cell rpe.ts declares unverified. The transposition below parks
 * no number at those positions: a second copy of a value that is not settled
 * would only go stale, and comparing against it would re-lock the choice the
 * module deliberately leaves open. A test asserts the blanks are exactly the
 * declared-unverified cells.
 */
const UNSETTLED = null;

/**
 * The same chart transposed by hand into the orientation it is normally
 * PRINTED: one row per RPE (10 down to 6), reps 1-12 across.
 *
 * This is NOT independent evidence about what the published chart says — it was
 * transposed from the same fixture above by the same hand. It only catches
 * transposition typos between the two layouts inside this repo. Treat any
 * disagreement with EXTERNAL_FIXTURE_S1 as this array being wrong.
 */
const PUBLISHED_CHART_BY_RPE: ReadonlyArray<readonly [ChartedRpe, readonly (number | null)[]]> = [
  //             reps: 1     2     3     4     5     6     7     8     9    10    11    12
  [10, [100.0, 95.5, 92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 70.7, 68.0]],
  [9.5, [97.8, 93.9, 90.7, 87.8, 85.0, 82.4, 79.9, 77.4, 75.1, 72.3, 69.4, 66.7]],
  [9, [95.5, 92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 70.7, 68.0, 65.3]],
  [8.5, [93.9, 90.7, 87.8, 85.0, 82.4, 79.9, 77.4, 75.1, 72.3, 69.4, 66.7, 64.0]],
  [8, [92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 70.7, 68.0, 65.3, 62.6]],
  [7.5, [90.7, 87.8, 85.0, 82.4, 79.9, 77.4, 75.1, 72.3, 69.4, 66.7, 64.0, 61.3]],
  [7, [89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 70.7, 68.0, 65.3, 62.6, 59.9]],
  [6.5, [87.8, 85.0, 82.4, 79.9, 77.4, 75.1, 72.3, 69.4, 66.7, 64.0, 61.3, UNSETTLED]],
  [6, [86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 70.7, 68.0, 65.3, 62.6, 59.9, UNSETTLED]],
];

/** Stable key for a cell, used to compare sets of cells. */
function cellKey(reps: number, rpe: number): string {
  return `${reps}@${rpe}`;
}

/** The cells rpe.ts itself declares unsettled, as keys. */
const UNVERIFIED_KEYS: ReadonlySet<string> = new Set(
  UNVERIFIED_CHART_CELLS.map((cell) => cellKey(cell.reps, cell.rpe)),
);

/** Distance from failure. Cells sharing an effort index share a percentage. */
function effortIndex(reps: number, rpe: number): number {
  return reps + (RPE_CHART_COVERAGE.MAX_RPE - rpe);
}

/** Every cell's percentage in tenths, keyed by effort index. */
function effortIndexTenths(): Map<number, number> {
  const tenths = new Map<number, number>();
  for (const reps of CHARTED_REPS) {
    for (const rpe of CHARTED_RPES) {
      tenths.set(effortIndex(reps, rpe), Math.round(percentOf1RM(reps, rpe) * 10));
    }
  }
  return tenths;
}

/** True when the half-cell midpoint relation is checkable at `index` and holds. */
function midpointPins(tenths: ReadonlyMap<number, number>, index: number): boolean {
  const value = tenths.get(index);
  const low = tenths.get(index - 0.5);
  const high = tenths.get(index + 0.5);
  if (value === undefined || low === undefined || high === undefined) {
    return false;
  }
  return Math.floor((low + high) / 2 + 0.5) === value;
}

/** True when the cell has a partner on the reps-in-reserve diagonal. */
function hasDiagonalPartner(reps: number, rpe: number): boolean {
  return tryPercentOf1RM(reps + 1, rpe + 1) !== null || tryPercentOf1RM(reps - 1, rpe - 1) !== null;
}

/** Cells with no partner on the reps-in-reserve diagonal inside the grid. */
function orphanCells(): readonly string[] {
  const orphans: string[] = [];
  for (const reps of CHARTED_REPS) {
    for (const rpe of CHARTED_RPES) {
      if (!hasDiagonalPartner(reps, rpe)) {
        orphans.push(cellKey(reps, rpe));
      }
    }
  }
  return orphans;
}

describe('RPE_PERCENT_CHART — published source values', () => {
  it('matches the verbatim third-party transcription (source S1) in every settled cell', () => {
    const cells = parseKotlinFixture(EXTERNAL_FIXTURE_S1);
    expect(cells).toHaveLength(108);
    let compared = 0;
    for (const cell of cells) {
      if (UNVERIFIED_KEYS.has(cellKey(cell.reps, cell.rpe))) {
        continue;
      }
      expect(
        percentOf1RM(cell.reps, cell.rpe),
        `S1 fixture cell: ${cell.reps} reps @ RPE ${cell.rpe}`,
      ).toBeCloseTo(cell.percent, 10);
      compared += 1;
    }
    expect(compared).toBe(108 - UNVERIFIED_CHART_CELLS.length);
  });

  /**
   * S1 is one link in the S3 -> S2 -> S1 copy chain, so at the two cells that
   * chain is contested on it is evidence, not a verdict. Its reading has to be
   * ON RECORD in rpe.ts's provenance data — otherwise the fixture and the note
   * have drifted apart — but it is not required to be the value in use. That is
   * the difference between recording a source and obeying one.
   */
  it("keeps S1's reading of each unverified cell on record without enforcing it", () => {
    const cells = parseKotlinFixture(EXTERNAL_FIXTURE_S1);
    expect(UNVERIFIED_CHART_CELLS.length).toBeGreaterThan(0);
    for (const unverified of UNVERIFIED_CHART_CELLS) {
      const label = `${unverified.reps} reps @ RPE ${unverified.rpe}`;
      const fixtureCell = cells.find(
        (cell) => cell.reps === unverified.reps && cell.rpe === unverified.rpe,
      );
      expect(fixtureCell, `S1 fixture is missing ${label}`).toBeDefined();
      if (fixtureCell === undefined) {
        continue;
      }
      expect(
        unverified.readings.map((reading) => reading.percent),
        `${label}: S1 reads ${fixtureCell.percent}, which rpe.ts does not document as a reading`,
      ).toContain(fixtureCell.percent);
    }
  });

  it('agrees with its own printed-orientation transposition in every settled cell', () => {
    const blanks: string[] = [];
    for (const [rpe, row] of PUBLISHED_CHART_BY_RPE) {
      expect(row).toHaveLength(RPE_CHART_COVERAGE.MAX_REPS);
      row.forEach((expected, index) => {
        const reps = (index + 1) as ChartedReps;
        if (expected === null) {
          blanks.push(cellKey(reps, rpe));
          return;
        }
        expect(
          percentOf1RM(reps, rpe),
          `printed-orientation cell: ${reps} reps @ RPE ${rpe}`,
        ).toBeCloseTo(expected, 10);
      });
    }
    // The blanks are exactly the declared-unverified cells: no stale second
    // copy of an unsettled number is parked in this array.
    expect([...blanks].sort()).toEqual([...UNVERIFIED_KEYS].sort());
  });

  it('covers exactly reps 1-12 and RPE 6-10 in 0.5 steps, and nothing else', () => {
    expect(CHARTED_REPS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(CHARTED_RPES).toEqual([6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]);
    expect(Object.keys(RPE_PERCENT_CHART)).toHaveLength(12);
    for (const reps of CHARTED_REPS) {
      expect(Object.keys(RPE_PERCENT_CHART[reps])).toHaveLength(9);
    }
    expect(PUBLISHED_CHART_BY_RPE).toHaveLength(9);
  });

  /**
   * Cells a competitive lifter can recite without looking anything up. These
   * are worth writing longhand precisely because a reviewer can check them from
   * their own knowledge rather than from this repo.
   *
   * The chart's corners are deliberately ABSENT except 1 @ 10, which is 100% by
   * definition. Nobody recites 12 @ RPE 6 from memory, so listing it here would
   * be restating rpe.ts's literal in a second place and calling it a check. The
   * two unverified corners are covered by the documented-readings test below —
   * the only thing this suite is entitled to say about them.
   */
  it.each<[number, ChartedRpe, number]>([
    [1, 10, 100.0], // a true single is 100% by definition
    [1, 9, 95.5], // the canonical "single at RPE 9"
    [1, 8, 92.2],
    [2, 10, 95.5],
    [3, 10, 92.2],
    [3, 8, 86.3], // triple @ 8 ~ 86%
    [5, 8, 81.1], // the most-quoted cell in the chart: 5 @ 8 ~ 81%
    [5, 10, 86.3],
    [6, 9, 81.1],
    [8, 8, 73.9],
    [10, 10, 73.9],
    [10, 8, 68.0],
    [12, 10, 68.0], // bottom of the RPE-10 column
    [1, 6, 86.3], // top-left of the RPE-6 row
  ])('%d reps @ RPE %s is %s%% of 1RM', (reps, rpe, expected) => {
    expect(percentOf1RM(reps, rpe)).toBeCloseTo(expected, 10);
  });

  it('preserves the reps-in-reserve diagonal: N @ RPE X equals N+1 @ RPE X+1', () => {
    for (const reps of CHARTED_REPS) {
      for (const rpe of CHARTED_RPES) {
        const nextReps = reps + 1;
        const nextRpe = rpe + 1;
        const shifted = tryPercentOf1RM(nextReps, nextRpe);
        if (shifted === null) {
          continue;
        }
        expect(
          shifted,
          `${reps} @ RPE ${rpe} should equal ${nextReps} @ RPE ${nextRpe}`,
        ).toBeCloseTo(percentOf1RM(reps, rpe), 10);
      }
    }
  });

  it('is strictly decreasing as reps rise at a fixed RPE', () => {
    for (const rpe of CHARTED_RPES) {
      for (let reps = 1; reps < RPE_CHART_COVERAGE.MAX_REPS; reps += 1) {
        expect(percentOf1RM(reps + 1, rpe)).toBeLessThan(percentOf1RM(reps, rpe));
      }
    }
  });

  it('is strictly increasing as RPE rises at a fixed rep count', () => {
    for (const reps of CHARTED_REPS) {
      for (let i = 0; i < CHARTED_RPES.length - 1; i += 1) {
        const lower = CHARTED_RPES[i];
        const higher = CHARTED_RPES[i + 1];
        expect(lower).toBeDefined();
        expect(higher).toBeDefined();
        if (lower === undefined || higher === undefined) {
          continue;
        }
        expect(percentOf1RM(reps, higher)).toBeGreaterThan(percentOf1RM(reps, lower));
      }
    }
  });

  /**
   * The old version of this test asserted `>= 57.2` and called 57.2 "the
   * published floor". 57.2 was rpe.ts's own literal for the bottom-right cell,
   * so the assertion could never fail for any value rpe.ts held — it proved
   * nothing and it hid the very cell that was wrong. What is left here is the
   * part that is externally true: a percentage of 1RM, and the corner that must
   * hold the minimum given the chart's monotonicity.
   */
  it('stays a percentage, with the minimum at the bottom-right corner', () => {
    let min = Number.POSITIVE_INFINITY;
    for (const reps of CHARTED_REPS) {
      for (const rpe of CHARTED_RPES) {
        const percent = percentOf1RM(reps, rpe);
        expect(percent).toBeGreaterThan(0);
        expect(percent).toBeLessThanOrEqual(100);
        min = Math.min(min, percent);
      }
    }
    expect(percentOf1RM(1, 10)).toBe(100);
    expect(min).toBe(percentOf1RM(RPE_CHART_COVERAGE.MAX_REPS, RPE_CHART_COVERAGE.MIN_RPE));
  });

  /**
   * The four cells with no diagonal partner. Asserting the set makes the blind
   * spot visible instead of implicit: if the chart's shape ever changes, this
   * fails and whoever changed it has to re-read the provenance note in rpe.ts.
   */
  it('has exactly four cells with no partner on the diagonal', () => {
    expect([...orphanCells()].sort()).toEqual(['1@10', '1@9.5', '12@6', '12@6.5'].sort());
  });

  /**
   * Second structural relation, weaker than the diagonal but real: each half-RPE
   * cell is the round-half-up midpoint of the two whole-RPE cells on either side
   * of it along the effort-index diagonal. This is an observation about the
   * published grid, not a construction rule — it fails at 13 of the 14 checkable
   * WHOLE-index positions — but it holds at every checkable half position that
   * does not involve an unverified cell, so it catches typos in the half-RPE
   * cells and it pins (1 rep, RPE 9.5), which the diagonal alone cannot.
   *
   * It is INTERNAL, not external: it relates our own cells to our own cells and
   * so cannot detect an error shared by the whole grid.
   *
   * SKIPPED: any position whose own cell or whose neighbours rpe.ts declares
   * unverified — in practice effort index 15.5, (12 reps, RPE 6.5). The suite
   * asserts NOTHING about whether the relation holds or fails there. Whether it
   * holds is precisely the open question: the relation constrains the triple
   * (15, 15.5, 16) and admits two repairs, one changing (12, 6) and one
   * changing (12, 6.5). An earlier revision asserted the relation must keep
   * FAILING at this position, which made one of the two documented readings of
   * (12, 6) permanently untestable. That assertion is gone.
   */
  it('makes every half-RPE cell the midpoint of its whole-RPE neighbours, where settled', () => {
    const tenths = effortIndexTenths();
    const unsettledIndices = new Set(
      UNVERIFIED_CHART_CELLS.map((cell) => effortIndex(cell.reps, cell.rpe)),
    );
    const skipped: number[] = [];
    let checked = 0;
    for (const [index, value] of tenths) {
      const isHalfIndex = Math.abs(index - Math.round(index)) > 0.25;
      const low = tenths.get(index - 0.5);
      const high = tenths.get(index + 0.5);
      if (!isHalfIndex || low === undefined || high === undefined) {
        continue;
      }
      if (
        unsettledIndices.has(index) ||
        unsettledIndices.has(index - 0.5) ||
        unsettledIndices.has(index + 0.5)
      ) {
        skipped.push(index);
        continue;
      }
      const midpoint = (low + high) / 2;
      expect(Math.floor(midpoint + 0.5), `effort index ${index}`).toBe(value);
      checked += 1;
    }
    expect(checked).toBe(14);
    // Every skip is attributable to a cell rpe.ts declares unverified, not to a
    // position quietly excused because the rule was inconvenient there.
    expect(skipped).toHaveLength(1);
    for (const index of skipped) {
      expect(
        unsettledIndices.has(index) ||
          unsettledIndices.has(index - 0.5) ||
          unsettledIndices.has(index + 0.5),
        `effort index ${index} was skipped without a declared-unverified cell to justify it`,
      ).toBe(true);
    }
  });

  /**
   * The replacement for a deleted anti-derivation guard.
   *
   * The old test asserted that (12, 6) must NOT equal the linear continuation of
   * the chart's tail, reasoning that a cell landing on the run must have been
   * derived. The premise is a non-sequitur — a published number is free to fall
   * on a run — and the effect was to make 57.2, a value source S4 actually
   * holds, a test failure. This suite no longer forbids any documented reading
   * of any cell.
   *
   * What it does forbid is a value NO retrieved source holds. That is where
   * GDD §12.3 actually bites: the module may transcribe, and may choose between
   * transcriptions, but may not invent — including from the grid's own fitted
   * patterns, which is why 'grid-rule' readings are recorded and are explicitly
   * not adoptable. 58.7 at (12, 6.5) is on record for exactly that reason and
   * this test rejects it.
   */
  it('holds a documented transcription at every unverified cell, and nothing else', () => {
    expect(UNVERIFIED_CHART_CELLS.length).toBeGreaterThan(0);
    for (const cell of UNVERIFIED_CHART_CELLS) {
      const label = `${cell.reps} reps @ RPE ${cell.rpe}`;
      const transcribed = cell.readings
        .filter((reading) => reading.evidence === 'transcription')
        .map((reading) => reading.percent);
      expect(transcribed.length, `${label} has no transcribed reading on record`).toBeGreaterThan(0);
      expect(
        transcribed,
        `${label} holds ${cell.percentInUse}, which no retrieved source is recorded as holding`,
      ).toContain(cell.percentInUse);
      for (const reading of cell.readings) {
        expect(reading.note.length, `${label} has a reading with no provenance note`).toBeGreaterThan(
          0,
        );
      }
    }
  });

  it('reads percentInUse straight off the chart, so the record cannot drift', () => {
    for (const cell of UNVERIFIED_CHART_CELLS) {
      expect(cell.percentInUse).toBe(percentOf1RM(cell.reps, cell.rpe));
    }
  });
});

describe('chart cell status', () => {
  it('declares exactly the two cells the header names as unsettled', () => {
    expect([...UNVERIFIED_KEYS].sort()).toEqual(['12@6', '12@6.5'].sort());
  });

  it('declares unverified only cells the reps-in-reserve diagonal cannot reach', () => {
    const orphans = new Set(orphanCells());
    for (const cell of UNVERIFIED_CHART_CELLS) {
      expect(
        orphans.has(cellKey(cell.reps, cell.rpe)),
        `${cell.reps} @ RPE ${cell.rpe} is declared unverified but the diagonal does constrain it`,
      ).toBe(true);
    }
  });

  /**
   * `chartCellStatus` returns 'invariant-pinned' by default, so that default has
   * to be earned: every cell claiming it must genuinely be held by the diagonal
   * or by the half-cell midpoint relation. Without this, a future cell could
   * quietly inherit a status the module cannot back.
   */
  it("earns the 'invariant-pinned' status it hands out by default", () => {
    const tenths = effortIndexTenths();
    let pinned = 0;
    for (const reps of CHARTED_REPS) {
      for (const rpe of CHARTED_RPES) {
        if (chartCellStatus(reps, rpe) !== 'invariant-pinned') {
          continue;
        }
        pinned += 1;
        expect(
          hasDiagonalPartner(reps, rpe) || midpointPins(tenths, effortIndex(reps, rpe)),
          `${reps} @ RPE ${rpe} claims 'invariant-pinned' but no invariant reaches it`,
        ).toBe(true);
      }
    }
    // 108 cells, minus the one definitional cell, minus the unverified ones.
    expect(pinned).toBe(108 - 1 - UNVERIFIED_CHART_CELLS.length);
  });

  it('reports definitional, pinned and unverified cells distinguishably', () => {
    expect(chartCellStatus(1, 10)).toBe('definitional');
    expect(chartCellStatus(5, 8)).toBe('invariant-pinned');
    expect(chartCellStatus(1, 9.5)).toBe('invariant-pinned');
    expect(chartCellStatus(12, 6)).toBe('unverified');
    expect(chartCellStatus(12, 6.5)).toBe('unverified');
    expect(isUnverifiedChartCell(12, 6)).toBe(true);
    expect(isUnverifiedChartCell(12, 7)).toBe(false);
    expect(isUnverifiedChartCell(11, 6)).toBe(false);
  });

  it('returns null off-chart, matching tryPercentOf1RM', () => {
    expect(chartCellStatus(13, 10)).toBeNull();
    expect(chartCellStatus(5, 7.3)).toBeNull();
    expect(chartCellStatus(5, 5.5)).toBeNull();
    expect(isUnverifiedChartCell(13, 10)).toBe(false);
    expect(tryChartCell(13, 10)).toBeNull();
    expect(tryChartCell(5, 7.3)).toBeNull();
  });

  it('carries the competing readings on the cells that have them', () => {
    const disputed = tryChartCell(12, 6);
    expect(disputed).not.toBeNull();
    if (disputed === null) {
      return;
    }
    expect(disputed.reps).toBe(12);
    expect(disputed.rpe).toBe(6);
    expect(disputed.percent).toBe(percentOf1RM(12, 6));
    expect(disputed.status).toBe('unverified');
    // Both readings stay on record whichever one the chart currently holds.
    expect([...disputed.readings.map((reading) => reading.percent)].sort()).toEqual([57.2, 57.4]);

    const coupled = tryChartCell(12, 6.5);
    expect(coupled).not.toBeNull();
    if (coupled === null) {
      return;
    }
    expect(coupled.status).toBe('unverified');
    expect(coupled.readings.map((reading) => reading.evidence)).toContain('grid-rule');
  });

  it('leaves settled cells with no competing readings', () => {
    const settled = tryChartCell(5, 8);
    expect(settled).not.toBeNull();
    if (settled === null) {
      return;
    }
    expect(settled.status).toBe('invariant-pinned');
    expect(settled.readings).toHaveLength(0);
  });

  /**
   * The uncertainty must be reachable, not imposed. The daily loop calls
   * `percentOf1RM` thousands of times and must keep getting a bare number.
   */
  it('does not complicate the ordinary lookup', () => {
    const percent: number = percentOf1RM(12, 6);
    expect(typeof percent).toBe('number');
    expect(percent).toBe(tryChartCell(12, 6)?.percent);
    expect(tryPercentOf1RM(12, 6)).toBe(percent);
    expect(fractionOf1RM(12, 6)).toBeCloseTo(percent / 100, 10);
    // An unverified cell still prescribes a load like any other.
    expect(loadForRpeTarget(200, 12, 6)).toBe(roundLoad(200 * (percent / 100)));
  });
});

describe('coverage guards', () => {
  it('accepts only charted rep counts', () => {
    for (const reps of CHARTED_REPS) {
      expect(isChartedReps(reps)).toBe(true);
    }
    for (const reps of [0, -1, 13, 20, 1.5, 4.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(isChartedReps(reps)).toBe(false);
    }
  });

  it('accepts only charted RPE values', () => {
    for (const rpe of CHARTED_RPES) {
      expect(isChartedRpe(rpe)).toBe(true);
    }
    for (const rpe of [5.5, 5.9, 6.25, 7.3, 9.75, 10.5, 11, Number.NaN]) {
      expect(isChartedRpe(rpe)).toBe(false);
    }
  });

  it('does not silently interpolate uncharted RPE values', () => {
    // 7.3 sits between two real cells. Interpolating it would be homebrewing.
    expect(tryPercentOf1RM(5, 7.3)).toBeNull();
    expect(() => percentOf1RM(5, 7.3)).toThrow(RangeError);
  });

  it('does not extrapolate past 12 reps or below RPE 6', () => {
    expect(tryPercentOf1RM(13, 10)).toBeNull();
    expect(tryPercentOf1RM(20, 8)).toBeNull();
    expect(tryPercentOf1RM(5, 5.5)).toBeNull();
    expect(tryPercentOf1RM(5, 10.5)).toBeNull();
    expect(tryPercentOf1RM(0, 8)).toBeNull();
    expect(() => percentOf1RM(13, 10)).toThrow(/no cell for 13 reps/);
  });

  it('absorbs float noise but nothing wider', () => {
    expect(percentOf1RM(5, 8 + Number.EPSILON)).toBeCloseTo(81.1, 10);

    // Genuinely off-by-ULPs inputs, the only thing the tolerance exists for.
    const oneUlpHigh = 0.5 * 15.000000000000002;
    const twoUlpHigh = 7.5 * (1 + 2 * Number.EPSILON);
    expect(oneUlpHigh).not.toBe(7.5);
    expect(twoUlpHigh).not.toBe(7.5);
    expect(percentOf1RM(5, oneUlpHigh)).toBeCloseTo(79.9, 10);
    expect(percentOf1RM(5, twoUlpHigh)).toBeCloseTo(79.9, 10);

    expect(tryPercentOf1RM(5, 8.01)).toBeNull();
  });

  /**
   * The RPE-matching tolerance is a correctness guard, not a balance knob. If
   * it were widened to something like 0.25 during a feel-tuning pass, RPE 7.3
   * would silently snap to 7.5 and the module would be inventing chart values.
   * These tests assert the structural properties that make that impossible.
   */
  it('keeps the RPE-matching tolerance out of interpolation range, by construction', () => {
    const halfStep = RPE_CHART_COVERAGE.RPE_STEP / 2;
    // The resolved tolerance is bounded by a ceiling the module cannot exceed,
    // whatever the ULP count is set to.
    expect(RPE_MATCH_TOLERANCE).toBeGreaterThan(0);
    expect(RPE_MATCH_TOLERANCE).toBeLessThanOrEqual(RPE_MATCH_TOLERANCE_CEILING);
    // And the ceiling itself is nowhere near a distance that could snap an
    // off-chart RPE onto a charted one.
    expect(RPE_MATCH_TOLERANCE_CEILING).toBeLessThan(halfStep / 1e6);
    // Every off-chart RPE nearer than half a step stays off-chart.
    for (const rpe of [7.3, 7.4, 7.49, 7.51, 7.6, 7.7, 6.26, 9.74]) {
      expect(tryPercentOf1RM(5, rpe), `RPE ${rpe} must stay off-chart`).toBeNull();
    }
  });

  it('does not keep any correctness guard inside the tunable block', () => {
    // Widening a tuning value must never be able to change what the chart
    // returns. Adding a guard to RPE_LOADING_TUNING fails this deliberately.
    expect(Object.keys(RPE_LOADING_TUNING).sort()).toEqual(
      ['DEFAULT_ROUNDING_MODE', 'DEFAULT_UNIT', 'LOAD_PRECISION_DECIMALS', 'ROUNDING_INCREMENT'].sort(),
    );
    for (const key of Object.keys(RPE_LOADING_TUNING)) {
      expect(key).not.toMatch(/TOLERANCE|EPSILON|ULP/);
    }
  });

  it('reports its own coverage honestly', () => {
    expect(RPE_CHART_COVERAGE).toEqual({
      MIN_REPS: 1,
      MAX_REPS: 12,
      MIN_RPE: 6,
      MAX_RPE: 10,
      RPE_STEP: 0.5,
    });
  });
});

describe('fractionOf1RM', () => {
  it('is the percentage over 100', () => {
    expect(fractionOf1RM(5, 8)).toBeCloseTo(0.811, 10);
    expect(fractionOf1RM(1, 10)).toBeCloseTo(1, 10);
  });
});

describe('repsInReserve', () => {
  it.each<[ChartedRpe, number]>([
    [10, 0],
    [9.5, 0.5],
    [9, 1],
    [8.5, 1.5],
    [8, 2],
    [7.5, 2.5],
    [7, 3],
    [6.5, 3.5],
    [6, 4],
  ])('RPE %s means %s reps in reserve', (rpe, rir) => {
    expect(repsInReserve(rpe)).toBeCloseTo(rir, 10);
    expect(rpeForRepsInReserve(rir)).toBe(rpe);
  });

  it('rejects uncharted RPE and RIR', () => {
    expect(() => repsInReserve(7.3)).toThrow(RangeError);
    expect(() => rpeForRepsInReserve(5)).toThrow(RangeError);
  });
});

describe('load prescription', () => {
  it('computes the raw load straight off the chart', () => {
    // 200 kg e1RM, 5 @ RPE 8 -> 81.1% -> 162.2 kg
    expect(rawLoadForRpeTarget(200, 5, 8)).toBeCloseTo(162.2, 6);
    // 405 lb e1RM, 3 @ RPE 8 -> 86.3% -> 349.515 lb
    expect(rawLoadForRpeTarget(405, 3, 8)).toBeCloseTo(349.515, 6);
    // A true single at RPE 10 is the e1RM itself.
    expect(rawLoadForRpeTarget(180, 1, 10)).toBeCloseTo(180, 10);
  });

  it('snaps to the default kg increment', () => {
    expect(RPE_LOADING_TUNING.ROUNDING_INCREMENT.kg).toBe(2.5);
    // 162.2 -> nearest 2.5 -> 162.5
    expect(loadForRpeTarget(200, 5, 8)).toBe(162.5);
    expect(loadForRpeTarget(200, 5, 8, { unit: 'kg' })).toBe(162.5);
  });

  it('snaps to the default lb increment', () => {
    expect(RPE_LOADING_TUNING.ROUNDING_INCREMENT.lb).toBe(5);
    // 349.515 -> nearest 5 -> 350
    expect(loadForRpeTarget(405, 3, 8, { unit: 'lb' })).toBe(350);
    // 349.515 -> down to 5 -> 345
    expect(loadForRpeTarget(405, 3, 8, { unit: 'lb', mode: 'down' })).toBe(345);
    // 349.515 -> up to 5 -> 350
    expect(loadForRpeTarget(405, 3, 8, { unit: 'lb', mode: 'up' })).toBe(350);
  });

  it('honours an explicit increment', () => {
    expect(loadForRpeTarget(200, 5, 8, { increment: 1 })).toBe(162);
    expect(loadForRpeTarget(200, 5, 8, { increment: 0.5 })).toBe(162);
    expect(loadForRpeTarget(200, 5, 8, { increment: 5 })).toBe(160);
  });

  it('rounds without float noise', () => {
    expect(roundLoad(162.2, { increment: 2.5 })).toBe(162.5);
    expect(roundLoad(100.1, { increment: 0.1 })).toBe(100.1);
    expect(roundLoad(0, { increment: 2.5 })).toBe(0);
  });

  it('uses the tunable default mode and unit', () => {
    expect(RPE_LOADING_TUNING.DEFAULT_ROUNDING_MODE).toBe('nearest');
    expect(RPE_LOADING_TUNING.DEFAULT_UNIT).toBe('kg');
    const increment = RPE_LOADING_TUNING.ROUNDING_INCREMENT[RPE_LOADING_TUNING.DEFAULT_UNIT];
    expect(loadForRpeTarget(200, 5, 8)).toBe(roundLoad(162.2, { increment, mode: 'nearest' }));
  });

  it('rejects unusable inputs', () => {
    expect(() => rawLoadForRpeTarget(0, 5, 8)).toThrow(RangeError);
    expect(() => rawLoadForRpeTarget(-100, 5, 8)).toThrow(RangeError);
    expect(() => rawLoadForRpeTarget(Number.NaN, 5, 8)).toThrow(RangeError);
    expect(() => loadForRpeTarget(200, 13, 8)).toThrow(RangeError);
    expect(() => loadForRpeTarget(200, 5, 8, { increment: 0 })).toThrow(RangeError);
    expect(() => loadForRpeTarget(200, 5, 8, { increment: -2.5 })).toThrow(RangeError);
    expect(() => roundLoad(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('e1rmFromChartedSet', () => {
  it('inverts the load calculation', () => {
    for (const reps of CHARTED_REPS) {
      for (const rpe of CHARTED_RPES) {
        const raw = rawLoadForRpeTarget(220, reps, rpe);
        expect(e1rmFromChartedSet(raw, reps, rpe)).toBeCloseTo(220, 4);
      }
    }
  });

  it('matches hand-worked examples', () => {
    // 140 kg x 5 @ RPE 8 -> 140 / 0.811 = 172.63 kg
    expect(e1rmFromChartedSet(140, 5, 8)).toBeCloseTo(172.626387, 5);
    // A single at RPE 10 is its own e1RM.
    expect(e1rmFromChartedSet(250, 1, 10)).toBeCloseTo(250, 10);
  });

  it('rejects unusable inputs', () => {
    expect(() => e1rmFromChartedSet(0, 5, 8)).toThrow(RangeError);
    expect(() => e1rmFromChartedSet(100, 5, 7.3)).toThrow(RangeError);
  });
});

describe('purity', () => {
  it('is referentially transparent', () => {
    const first = loadForRpeTarget(200, 5, 8);
    const second = loadForRpeTarget(200, 5, 8);
    expect(first).toBe(second);
    expect(percentOf1RM(5, 8)).toBe(percentOf1RM(5, 8));
  });

  /**
   * This test used to have this name and attempt no mutation at all — it read
   * the chart twice and asserted the two reads agreed. The chart was not frozen,
   * so any consumer could have rewritten a published percentage at runtime and
   * silently changed every load in the game. `Readonly<...>` is a compile-time
   * claim; this checks the running object.
   */
  it('does not let a caller mutate the shared chart', () => {
    const before = percentOf1RM(5, 8);
    expect(Object.isFrozen(RPE_PERCENT_CHART)).toBe(true);
    expect(Object.isFrozen(RPE_PERCENT_CHART[5])).toBe(true);

    // TypeScript rejects both of these; the casts are how a JS caller, or a
    // caller reaching through `any` at a module boundary, would get here.
    const row = RPE_PERCENT_CHART[5] as unknown as Record<number, number>;
    expect(() => {
      row[8] = 1;
    }).toThrow(TypeError);

    const grid = RPE_PERCENT_CHART as unknown as Record<number, Record<number, number>>;
    expect(() => {
      grid[5] = { 8: 1 };
    }).toThrow(TypeError);

    expect(percentOf1RM(5, 8)).toBe(before);
    expect(RPE_PERCENT_CHART[5][8]).toBe(before);
  });

  it('does not let a caller mutate the provenance record either', () => {
    expect(Object.isFrozen(UNVERIFIED_CHART_CELLS)).toBe(true);
    for (const cell of UNVERIFIED_CHART_CELLS) {
      expect(Object.isFrozen(cell)).toBe(true);
      expect(Object.isFrozen(cell.readings)).toBe(true);
    }
  });
});
