import { describe, expect, it } from 'vitest';

import {
  CHARTED_REPS,
  CHARTED_RPES,
  CHART_SOURCES,
  CHART_SOURCE_IDS,
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
  type ChartSourceId,
  type ChartedReps,
  type ChartedRpe,
} from './rpe';

/* ---------------------------------------------------------------------------
 * WHAT THESE TESTS CAN AND CANNOT PROVE
 * ---------------------------------------------------------------------------
 * The RTS/Tuchscherer primary source is unreachable from this sandbox (403 at
 * the egress proxy), so no test here verifies the grid against the publication.
 *
 * The strongest available check is the two committed fixtures below,
 * EXTERNAL_FIXTURE_S1 and EXTERNAL_FIXTURE_S4: verbatim copies of two
 * third-party transcriptions, each in its own syntax and layout, each with its
 * URL attached so a reviewer can re-fetch the bytes and diff. They come from
 * different lineages (see the rpe.ts header) and they disagree at exactly one
 * cell, which the suite recomputes from their bytes rather than asserting from
 * memory.
 *
 * Everything else in this file is structural (monotonicity, the reps-in-reserve
 * diagonal, the half-cell midpoint relation) or a spot check of cells that
 * competitive lifters quote from memory. Structural tests relate our cells to
 * our own other cells; none of them can catch an error the whole grid shares.
 *
 * THREE RULES THIS FILE FOLLOWS, all learned the hard way:
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
 *    say "the module holds a value some committed fixture holds"; it may not
 *    say "the published chart does not say X".
 *
 * 3. NO CHECK MAY BE SATISFIED BY rpe.ts ALONE. An earlier revision's only
 *    guard at the two unsettled cells read rpe.ts's own `readings` array and
 *    asserted the chart value appeared in it — rpe.ts certifying rpe.ts. Adding
 *    `{ percent: 58.7, evidence: 'transcription' }` to that array was enough to
 *    legitimise a number no source holds, and the suite stayed green. Every
 *    assertion about a cell value in this file now terminates in fixture bytes:
 *    a 'transcription' reading names the fixtures it came from and is checked
 *    against them, and `percentInUse` is checked against the fixtures directly,
 *    without consulting `readings` at all.
 *
 * Four cells have no partner on the reps-in-reserve diagonal inside a 12 x 9
 * grid, so that invariant says nothing about them:
 *
 *     (1 rep, RPE 10)   (1 rep, RPE 9.5)   (12 reps, RPE 6.5)   (12 reps, RPE 6)
 *
 *   - (1, 10) = 100.0 is true by definition.
 *   - (1, 9.5) = 97.8 is pinned by the half-cell midpoint test below.
 *   - (12, 6.5) is pinned by no invariant, but BOTH committed fixtures hold it
 *     and the suite enforces that like any other cell. rpe.ts still declares it
 *     'unverified' because of the midpoint anomaly at that position; that is a
 *     statement about invariants and the publication, not about whether the
 *     cell is externally checked.
 *   - (12, 6) is the one cell the fixtures disagree on. It is the only cell in
 *     the grid where the suite cannot demand a specific value; what it demands
 *     is that the value be one a committed fixture literally holds. Either
 *     fixture's reading passes; an invented one does not, whatever rpe.ts
 *     claims about it.
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

/**
 * Source S4, verbatim: the `RPE_TABLE` literal (lines 1-170) of
 *   https://raw.githubusercontent.com/Sculpt-AI/progressive-overload/main/src/rpe_progression.ts
 * retrieved 2026-07-31 (HTTP 200, 3933 bytes). Also published to npm as
 * @sculpt-ai/progressive-overload; version 0.0.2's dist/index.mjs holds the
 * same 108 numbers, and the packument names this repository.
 *
 * A DIFFERENT LINEAGE from S1 (rpe.ts header has the dates and the copy-chain
 * argument) in a DIFFERENT SYNTAX: a Map of `[key, value]` tuple pairs, one per
 * line, versus S1's one-line-per-rep-count Kotlin `mapOf(...)`. The two parsers
 * below are mutually exclusive — a test asserts neither fixture parses under
 * the other's parser — so this is not S1's text reformatted.
 *
 * Unedited, including the source's own `100` / `85.0` inconsistency in how it
 * writes whole numbers. Re-fetch that URL and diff if in doubt.
 */
const EXTERNAL_FIXTURE_S4 = `
export const RPE_TABLE = new Map<number, Map<number, number>>([
  [
    1,
    new Map([
      [10, 100],
      [9.5, 97.8],
      [9, 95.5],
      [8.5, 93.9],
      [8, 92.2],
      [7.5, 90.7],
      [7, 89.2],
      [6.5, 87.8],
      [6, 86.3],
    ]),
  ],
  [
    2,
    new Map([
      [10, 95.5],
      [9.5, 93.9],
      [9, 92.2],
      [8.5, 90.7],
      [8, 89.2],
      [7.5, 87.8],
      [7, 86.3],
      [6.5, 85.0],
      [6, 83.7],
    ]),
  ],
  [
    3,
    new Map([
      [10, 92.2],
      [9.5, 90.7],
      [9, 89.2],
      [8.5, 87.8],
      [8, 86.3],
      [7.5, 85.0],
      [7, 83.7],
      [6.5, 82.4],
      [6, 81.1],
    ]),
  ],
  [
    4,
    new Map([
      [10, 89.2],
      [9.5, 87.8],
      [9, 86.3],
      [8.5, 85.0],
      [8, 83.7],
      [7.5, 82.4],
      [7, 81.1],
      [6.5, 79.9],
      [6, 78.6],
    ]),
  ],
  [
    5,
    new Map([
      [10, 86.3],
      [9.5, 85.0],
      [9, 83.7],
      [8.5, 82.4],
      [8, 81.1],
      [7.5, 79.9],
      [7, 78.6],
      [6.5, 77.4],
      [6, 76.2],
    ]),
  ],
  [
    6,
    new Map([
      [10, 83.7],
      [9.5, 82.4],
      [9, 81.1],
      [8.5, 79.9],
      [8, 78.6],
      [7.5, 77.4],
      [7, 76.2],
      [6.5, 75.1],
      [6, 73.9],
    ]),
  ],
  [
    7,
    new Map([
      [10, 81.1],
      [9.5, 79.9],
      [9, 78.6],
      [8.5, 77.4],
      [8, 76.2],
      [7.5, 75.1],
      [7, 73.9],
      [6.5, 72.3],
      [6, 70.7],
    ]),
  ],
  [
    8,
    new Map([
      [10, 78.6],
      [9.5, 77.4],
      [9, 76.2],
      [8.5, 75.1],
      [8, 73.9],
      [7.5, 72.3],
      [7, 70.7],
      [6.5, 69.4],
      [6, 68.0],
    ]),
  ],
  [
    9,
    new Map([
      [10, 76.2],
      [9.5, 75.1],
      [9, 73.9],
      [8.5, 72.3],
      [8, 70.7],
      [7.5, 69.4],
      [7, 68.0],
      [6.5, 66.7],
      [6, 65.3],
    ]),
  ],
  [
    10,
    new Map([
      [10, 73.9],
      [9.5, 72.3],
      [9, 70.7],
      [8.5, 69.4],
      [8, 68.0],
      [7.5, 66.7],
      [7, 65.3],
      [6.5, 64.0],
      [6, 62.6],
    ]),
  ],
  [
    11,
    new Map([
      [10, 70.7],
      [9.5, 69.4],
      [9, 68.0],
      [8.5, 66.7],
      [8, 65.3],
      [7.5, 64.0],
      [7, 62.6],
      [6.5, 61.3],
      [6, 59.9],
    ]),
  ],
  [
    12,
    new Map([
      [10, 68.0],
      [9.5, 66.7],
      [9, 65.3],
      [8.5, 64.0],
      [8, 62.6],
      [7.5, 61.3],
      [7, 59.9],
      [6.5, 58.6],
      [6, 57.2],
    ]),
  ],
]);
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
 * Parse the TypeScript Map-of-Maps fixture into cells. Also deliberately dumb
 * and total: a bare `<digits>,` line opens a rep count, a `[<num>, <num>],`
 * line is an RPE/percent pair, anything else is ignored. Nothing in the S1
 * fixture matches either shape, which is what makes the mutual-exclusion test
 * below meaningful.
 */
function parseTsMapFixture(text: string): readonly FixtureCell[] {
  const cells: FixtureCell[] = [];
  let reps: number | null = null;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    const outerKey = /^(\d+),$/.exec(trimmed);
    if (outerKey !== null) {
      const repsText = outerKey[1];
      reps = repsText === undefined ? null : Number(repsText);
      continue;
    }
    const pair = /^\[([\d.]+), ([\d.]+)\],$/.exec(trimmed);
    if (pair === null || reps === null) {
      continue;
    }
    const rpeText = pair[1];
    const percentText = pair[2];
    if (rpeText === undefined || percentText === undefined) {
      continue;
    }
    cells.push({ reps, rpe: Number(rpeText), percent: Number(percentText) });
  }
  return cells;
}

/**
 * Sentinel for a cell the committed fixtures DISAGREE on. The transposition
 * below parks no number at such a position: a second copy of a value that is
 * not settled would only go stale, and comparing against it would re-lock the
 * choice the module deliberately leaves open. A test asserts the blanks are
 * exactly the cells the fixtures disagree on — not the cells rpe.ts declares
 * unverified, which is a broader and partly self-declared set.
 */
const UNSETTLED = null;

/**
 * The same chart transposed by hand into the orientation it is normally
 * PRINTED: one row per RPE (10 down to 6), reps 1-12 across.
 *
 * This is NOT independent evidence about what the published chart says — it was
 * transposed from the fixtures above by the same hand. It only catches
 * transposition typos between the two layouts inside this repo. Treat any
 * disagreement with the committed fixtures as this array being wrong.
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
  // Both fixtures hold 58.6 at (12, 6.5), so it is transposed here like any
  // other settled cell. Only (12, 6) is left blank.
  [6.5, [87.8, 85.0, 82.4, 79.9, 77.4, 75.1, 72.3, 69.4, 66.7, 64.0, 61.3, 58.6]],
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

/** Total cells in a 12 x 9 grid. Written once so no test hardcodes it twice. */
const TOTAL_CELLS = 108;

/* ---------------------------------------------------------------------------
 * THE COMMITTED FIXTURE REGISTRY
 * ---------------------------------------------------------------------------
 * This is the anchor the whole provenance story hangs from. rpe.ts may declare
 * a reading is a 'transcription' and name its sources; what makes that a fact
 * rather than a claim is that the named source resolves HERE, to bytes, and
 * that those bytes hold that number at that cell.
 *
 * Deliberately keyed by plain `string`, not `ChartSourceId`: a source id added
 * to rpe.ts's union without a fixture added here must fail at RUN time with a
 * readable message, not be silently accepted because the types line up.
 * ------------------------------------------------------------------------- */

interface CommittedFixture {
  readonly id: ChartSourceId;
  /** Must equal CHART_SOURCES[id].url; a test asserts it. */
  readonly url: string;
  readonly text: string;
  readonly parse: (text: string) => readonly FixtureCell[];
}

const COMMITTED_FIXTURES: readonly CommittedFixture[] = [
  {
    id: 'S1',
    url: 'https://raw.githubusercontent.com/karolczyz/metriclift/master/app/src/main/java/com/example/metriclift/util/RpeTable.kt',
    text: EXTERNAL_FIXTURE_S1,
    parse: parseKotlinFixture,
  },
  {
    id: 'S4',
    url: 'https://raw.githubusercontent.com/Sculpt-AI/progressive-overload/main/src/rpe_progression.ts',
    text: EXTERNAL_FIXTURE_S4,
    parse: parseTsMapFixture,
  },
];

/** Each fixture's parsed cells, keyed by source id then by cell key. */
const FIXTURE_CELLS: ReadonlyMap<string, ReadonlyMap<string, number>> = new Map(
  COMMITTED_FIXTURES.map((fixture) => [
    fixture.id,
    new Map(fixture.parse(fixture.text).map((cell) => [cellKey(cell.reps, cell.rpe), cell.percent])),
  ]),
);

/**
 * What the named source's committed bytes hold at this cell, or undefined if
 * the source has no committed fixture or the fixture has no such cell.
 */
function fixtureValueAt(sourceId: string, reps: number, rpe: number): number | undefined {
  return FIXTURE_CELLS.get(sourceId)?.get(cellKey(reps, rpe));
}

/** Every distinct value the committed fixtures hold at this cell, sorted. */
function fixtureValuesAt(reps: number, rpe: number): readonly number[] {
  const values = new Set<number>();
  for (const fixture of COMMITTED_FIXTURES) {
    const value = fixtureValueAt(fixture.id, reps, rpe);
    if (value !== undefined) {
      values.add(value);
    }
  }
  return [...values].sort((a, b) => a - b);
}

/** Which committed sources hold exactly `percent` at this cell, sorted by id. */
function sourcesHolding(percent: number, reps: number, rpe: number): readonly string[] {
  return COMMITTED_FIXTURES.filter((fixture) => fixtureValueAt(fixture.id, reps, rpe) === percent)
    .map((fixture) => fixture.id)
    .sort();
}

/**
 * Cells where every committed fixture holds the same number, keyed by cell.
 * Computed from bytes on every run — nothing here is asserted from memory.
 */
const FIXTURE_AGREED: ReadonlyMap<string, number> = (() => {
  const agreed = new Map<string, number>();
  for (const reps of CHARTED_REPS) {
    for (const rpe of CHARTED_RPES) {
      const values = fixtureValuesAt(reps, rpe);
      const only = values[0];
      if (values.length === 1 && only !== undefined) {
        agreed.set(cellKey(reps, rpe), only);
      }
    }
  }
  return agreed;
})();

/** Cells where the committed fixtures hold different numbers. */
const FIXTURE_DISAGREED: ReadonlyMap<string, readonly number[]> = (() => {
  const disagreed = new Map<string, readonly number[]>();
  for (const reps of CHARTED_REPS) {
    for (const rpe of CHARTED_RPES) {
      const values = fixtureValuesAt(reps, rpe);
      if (values.length > 1) {
        disagreed.set(cellKey(reps, rpe), values);
      }
    }
  }
  return disagreed;
})();

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

describe('committed source fixtures', () => {
  it('holds a full 108-cell grid per fixture, over the same cells', () => {
    expect(COMMITTED_FIXTURES.length).toBeGreaterThanOrEqual(2);
    const allKeys = CHARTED_REPS.flatMap((reps) => CHARTED_RPES.map((rpe) => cellKey(reps, rpe)));
    expect(allKeys).toHaveLength(TOTAL_CELLS);
    for (const fixture of COMMITTED_FIXTURES) {
      const cells = fixture.parse(fixture.text);
      expect(cells, `${fixture.id} did not parse to a full grid`).toHaveLength(TOTAL_CELLS);
      const keys = FIXTURE_CELLS.get(fixture.id);
      expect(keys, `${fixture.id} has no parsed cell map`).toBeDefined();
      expect([...(keys ?? new Map()).keys()].sort()).toEqual([...allKeys].sort());
    }
  });

  /**
   * The two fixtures are meant to be two lineages in two syntaxes, not one text
   * reformatted. Mutual parser exclusion is a crude but real check on that: if
   * someone replaced the S4 fixture with S1's text (or with a transposition of
   * our own grid in S1's shape), its own parser would stop finding cells.
   */
  it('keeps the fixtures in genuinely different syntaxes', () => {
    expect(parseKotlinFixture(EXTERNAL_FIXTURE_S4)).toHaveLength(0);
    expect(parseTsMapFixture(EXTERNAL_FIXTURE_S1)).toHaveLength(0);
    expect(EXTERNAL_FIXTURE_S4).not.toContain('mapOf');
    expect(EXTERNAL_FIXTURE_S1).not.toContain('new Map');
  });

  /**
   * Every source id rpe.ts is willing to cite must resolve to bytes in this
   * file, and the URL rpe.ts advertises must be the URL those bytes came from.
   * Without this, adding an id to `ChartSourceId` would create a citation that
   * points at nothing.
   */
  it('resolves every declared source id to a committed fixture at the advertised URL', () => {
    const fixtureIds = COMMITTED_FIXTURES.map((fixture) => fixture.id).sort();
    expect([...CHART_SOURCE_IDS].sort()).toEqual(fixtureIds);
    expect(Object.keys(CHART_SOURCES).sort()).toEqual(fixtureIds);
    expect(new Set(CHART_SOURCE_IDS).size).toBe(CHART_SOURCE_IDS.length);
    for (const fixture of COMMITTED_FIXTURES) {
      const declared = CHART_SOURCES[fixture.id];
      expect(declared.id).toBe(fixture.id);
      expect(declared.url).toBe(fixture.url);
      expect(declared.retrieved).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(declared.syntax.length).toBeGreaterThan(0);
    }
  });

  /**
   * Fixture versus fixture — the chart is not consulted at all. This is the
   * machine diff the rpe.ts header describes, recomputed from bytes so the
   * header cannot quietly go stale. If a third fixture lands, or either
   * fixture is edited, this fires.
   */
  it('disagrees at exactly one cell, (12, 6)', () => {
    expect([...FIXTURE_DISAGREED.keys()].sort()).toEqual(['12@6']);
    expect(FIXTURE_DISAGREED.get('12@6')).toEqual([57.2, 57.4]);
    expect(sourcesHolding(57.4, 12, 6)).toEqual(['S1']);
    expect(sourcesHolding(57.2, 12, 6)).toEqual(['S4']);
    expect(FIXTURE_AGREED.size).toBe(TOTAL_CELLS - FIXTURE_DISAGREED.size);
  });

  /**
   * Every cell the fixtures disagree on must be declared unverified in rpe.ts.
   * The converse does NOT hold: rpe.ts may declare a cell unverified for other
   * reasons — (12, 6.5) is declared unverified because of the midpoint anomaly
   * even though both fixtures agree on it.
   */
  it('has every disagreement declared in rpe.ts', () => {
    for (const key of FIXTURE_DISAGREED.keys()) {
      expect(
        UNVERIFIED_KEYS.has(key),
        `the committed fixtures disagree at ${key} but rpe.ts does not declare it unverified`,
      ).toBe(true);
    }
  });
});

describe('RPE_PERCENT_CHART — published source values', () => {
  /**
   * The primary external check, and the one the exploit had to defeat.
   *
   * It skips ONLY cells where the committed fixtures actually disagree — a fact
   * recomputed from their bytes above — not the cells rpe.ts declares
   * unverified. That distinction is the whole point: an earlier revision
   * skipped by declaration, so writing a cell into `UNVERIFIED_CHART_CELLS`
   * exempted it from every external check. Now the only way to be exempt is for
   * two independently retrieved files to genuinely differ.
   */
  it('matches every cell the committed transcriptions agree on', () => {
    let compared = 0;
    for (const reps of CHARTED_REPS) {
      for (const rpe of CHARTED_RPES) {
        const expected = FIXTURE_AGREED.get(cellKey(reps, rpe));
        if (expected === undefined) {
          continue;
        }
        expect(
          percentOf1RM(reps, rpe),
          `all committed fixtures read ${expected} at ${reps} reps @ RPE ${rpe}`,
        ).toBeCloseTo(expected, 10);
        compared += 1;
      }
    }
    expect(compared).toBe(FIXTURE_AGREED.size);
    expect(compared).toBe(TOTAL_CELLS - FIXTURE_DISAGREED.size);
  });

  /**
   * At the cell the fixtures disagree on, the suite cannot demand a value — but
   * it can demand that the value be one a committed fixture literally holds.
   * This consults the fixtures directly and never looks at rpe.ts's `readings`,
   * so no edit inside rpe.ts can satisfy it.
   */
  it('holds a value some committed fixture contains at every disagreed cell', () => {
    for (const [key, values] of FIXTURE_DISAGREED) {
      const cell = UNVERIFIED_CHART_CELLS.find(
        (candidate) => cellKey(candidate.reps, candidate.rpe) === key,
      );
      expect(cell, `${key} is disagreed but not declared`).toBeDefined();
      if (cell === undefined) {
        continue;
      }
      expect(
        values,
        `${key} holds ${percentOf1RM(cell.reps, cell.rpe)}, which no committed fixture contains`,
      ).toContain(percentOf1RM(cell.reps, cell.rpe));
    }
  });

  /**
   * Every reading of every unverified cell that a committed fixture holds has
   * to be ON RECORD in rpe.ts's provenance data — otherwise the fixtures and
   * the notes have drifted apart. It is not required to be the value in use.
   * That is the difference between recording a source and obeying one.
   */
  it('keeps every committed fixture reading of each unverified cell on record', () => {
    expect(UNVERIFIED_CHART_CELLS.length).toBeGreaterThan(0);
    for (const unverified of UNVERIFIED_CHART_CELLS) {
      const label = `${unverified.reps} reps @ RPE ${unverified.rpe}`;
      for (const fixture of COMMITTED_FIXTURES) {
        const value = fixtureValueAt(fixture.id, unverified.reps, unverified.rpe);
        expect(value, `${fixture.id} fixture is missing ${label}`).toBeDefined();
        if (value === undefined) {
          continue;
        }
        expect(
          unverified.readings.map((reading) => reading.percent),
          `${label}: ${fixture.id} reads ${value}, which rpe.ts does not document as a reading`,
        ).toContain(value);
      }
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
    // The blanks are exactly the cells the committed fixtures disagree on: no
    // stale second copy of an unsettled number is parked in this array, and no
    // cell is excused from the transposition merely because rpe.ts says so.
    expect([...blanks].sort()).toEqual([...FIXTURE_DISAGREED.keys()].sort());
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
    // Title avoids a literal `%` sign: vitest's printf formatter treats `%%`
    // as another specifier and renders "is 100% undefined of 1RM".
  ])('%d reps @ RPE %s is %s percent of 1RM', (reps, rpe, expected) => {
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
   * SKIPPED: any position whose own cell or whose neighbours the COMMITTED
   * FIXTURES DISAGREE ON — in practice effort index 15.5, (12 reps, RPE 6.5),
   * because its neighbour at index 16 is (12, 6). Note the criterion: skipping
   * is earned by two retrieved files differing, not by rpe.ts declaring a cell
   * unverified. (12, 6.5) is itself declared unverified and is NOT excused on
   * that basis; if the fixtures agreed at (12, 6) too, this position would be
   * checked like any other.
   *
   * The suite asserts NOTHING about whether the relation holds or fails at
   * 15.5. Whether it holds is precisely the open question: the relation
   * constrains the triple (15, 15.5, 16) and admits two repairs, one changing
   * (12, 6) and one changing (12, 6.5). An earlier revision asserted the
   * relation must keep FAILING at this position, which made one of the two
   * fixture-backed readings of (12, 6) permanently untestable. That assertion
   * is gone.
   */
  it('makes every half-RPE cell the midpoint of its whole-RPE neighbours, where settled', () => {
    const tenths = effortIndexTenths();
    const unsettledIndices = new Set<number>();
    for (const reps of CHARTED_REPS) {
      for (const rpe of CHARTED_RPES) {
        if (FIXTURE_DISAGREED.has(cellKey(reps, rpe))) {
          unsettledIndices.add(effortIndex(reps, rpe));
        }
      }
    }
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
    // Every skip is attributable to a cell the committed fixtures disagree on,
    // not to a position quietly excused because the rule was inconvenient.
    expect(skipped).toHaveLength(1);
    for (const index of skipped) {
      expect(
        unsettledIndices.has(index) ||
          unsettledIndices.has(index - 0.5) ||
          unsettledIndices.has(index + 0.5),
        `effort index ${index} was skipped without a fixture disagreement to justify it`,
      ).toBe(true);
    }
  });

  /**
   * THE ANTI-HOMEBREW GUARD (GDD §12.3), rebuilt so it cannot certify itself.
   *
   * The version this replaces read rpe.ts's own `readings` array and asserted
   * the chart value appeared in it. That was rpe.ts vouching for rpe.ts: adding
   * one self-declared `{ percent: 58.7, evidence: 'transcription' }` entry made
   * a fabricated cell legal and the suite stayed green. The value in use is now
   * checked against FIXTURE BYTES, with `readings` not consulted at all — so no
   * edit confined to rpe.ts can satisfy it.
   *
   * What this forbids is a value NO committed fixture holds at that cell. That
   * is where §12.3 bites: the module may transcribe, and may choose between
   * transcriptions, but may not invent — including from the grid's own fitted
   * patterns, which is why 'grid-rule' readings are recorded and are explicitly
   * not adoptable. 58.7 at (12, 6.5) is on record for exactly that reason, and
   * adopting it now fails here AND in the fixture-agreement test above.
   *
   * NOT PROVEN by this: that the fixtures themselves are honest. They are bytes
   * committed to this repo, not bytes re-fetched at test time. A reviewer has to
   * re-fetch the two URLs to close that gap; the suite is offline by design.
   */
  it('holds a value the committed fixtures contain at every unverified cell', () => {
    expect(UNVERIFIED_CHART_CELLS.length).toBeGreaterThan(0);
    for (const cell of UNVERIFIED_CHART_CELLS) {
      const label = `${cell.reps} reps @ RPE ${cell.rpe}`;
      const held = fixtureValuesAt(cell.reps, cell.rpe);
      expect(held.length, `${label} appears in no committed fixture`).toBeGreaterThan(0);
      expect(
        held,
        `${label} holds ${cell.percentInUse}, which no committed fixture contains`,
      ).toContain(cell.percentInUse);
    }
  });

  /**
   * The other half of the same guard: `evidence: 'transcription'` has to be
   * true, not merely typed. Every source a reading cites must resolve to a
   * committed fixture, and that fixture's bytes must hold exactly that number
   * at exactly that cell.
   *
   * The citation must also be COMPLETE — the cited set must be every source
   * that holds the number — so a reading cannot quietly under-report which
   * lineages back it, which is how "unanimous in the sources" claims go stale.
   *
   * And a 'grid-rule' reading must be held by no fixture at all. If some source
   * did hold it, it would be a transcription and would have to say so.
   */
  it('backs every transcription reading with the bytes of the fixture it cites', () => {
    expect(UNVERIFIED_CHART_CELLS.length).toBeGreaterThan(0);
    let transcriptionReadings = 0;
    for (const cell of UNVERIFIED_CHART_CELLS) {
      const label = `${cell.reps} reps @ RPE ${cell.rpe}`;
      const transcribed = cell.readings.filter((reading) => reading.evidence === 'transcription');
      expect(transcribed.length, `${label} has no transcribed reading on record`).toBeGreaterThan(0);

      for (const reading of cell.readings) {
        expect(
          reading.note.length,
          `${label} has a reading with no provenance note`,
        ).toBeGreaterThan(0);

        const backing = sourcesHolding(reading.percent, cell.reps, cell.rpe);

        if (reading.evidence !== 'transcription') {
          expect(
            backing,
            `${label}: ${reading.percent} is filed as '${reading.evidence}' but committed fixtures ${backing.join(', ')} hold it`,
          ).toEqual([]);
          continue;
        }

        transcriptionReadings += 1;
        for (const sourceId of reading.sources) {
          expect(
            FIXTURE_CELLS.has(sourceId),
            `${label}: reading cites ${sourceId}, which has no committed fixture`,
          ).toBe(true);
          expect(
            fixtureValueAt(sourceId, cell.reps, cell.rpe),
            `${label}: reading claims ${sourceId} reads ${reading.percent}`,
          ).toBe(reading.percent);
        }
        expect(
          [...reading.sources].sort(),
          `${label}: ${reading.percent} cites ${[...reading.sources].sort().join(', ')} but is held by ${backing.join(', ')}`,
        ).toEqual(backing);
      }
    }
    expect(transcriptionReadings).toBeGreaterThan(0);
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

    // Each reading names the fixtures behind it; those citations are checked
    // against the fixtures' bytes elsewhere in this file.
    expect(
      disputed.readings
        .filter((reading) => reading.evidence === 'transcription')
        .map((reading) => [reading.percent, [...(reading.sources ?? [])].sort().join('+')]),
    ).toEqual([
      [57.4, 'S1'],
      [57.2, 'S4'],
    ]);

    const coupled = tryChartCell(12, 6.5);
    expect(coupled).not.toBeNull();
    if (coupled === null) {
      return;
    }
    expect(coupled.status).toBe('unverified');
    expect(coupled.readings.map((reading) => reading.evidence)).toContain('grid-rule');
    // The grid-rule reading names no source, by construction.
    for (const reading of coupled.readings) {
      if (reading.evidence === 'grid-rule') {
        expect(reading.sources).toBeUndefined();
      }
    }
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
    expect(Object.isFrozen(CHART_SOURCE_IDS)).toBe(true);
    expect(Object.isFrozen(CHART_SOURCES)).toBe(true);
    for (const id of CHART_SOURCE_IDS) {
      expect(Object.isFrozen(CHART_SOURCES[id])).toBe(true);
    }
    for (const cell of UNVERIFIED_CHART_CELLS) {
      expect(Object.isFrozen(cell)).toBe(true);
      expect(Object.isFrozen(cell.readings)).toBe(true);
      for (const reading of cell.readings) {
        expect(Object.isFrozen(reading)).toBe(true);
        // A citation a JS caller can rewrite at runtime is not a citation.
        if (reading.evidence === 'transcription') {
          expect(Object.isFrozen(reading.sources)).toBe(true);
        }
      }
    }
  });
});
