/**
 * evidenceFilters.mjs — what a bundle's TARGETED run was actually pointed at.
 *
 * ===========================================================================
 * THE DEFECT THIS EXISTS TO CLOSE, MEASURED IN THE COMMITTED BUNDLES
 * ===========================================================================
 * `tools/evidence.mjs` took its test-path pattern from ONE argv element and
 * handed it to vitest as ONE argument, while its own transcript header printed
 * `$ npx vitest run <args joined by spaces>`. So a two-path pattern DISPLAYED
 * as a targeted run and EXECUTED as a single filter matching nothing:
 *
 *     $ npx vitest run src/shell src/game/guaranteeTags.test.ts --reporter=verbose
 *     [tests] exit code: 1
 *     No test files found, exiting with code 1
 *
 * That is the first captured command of `.gauntlet/evidence/equipment-provenance.txt`
 * as committed. The whole-suite capture below it is green, so the bundle reads
 * green and the hole is silent — a critic sees a targeted section that ran
 * nothing and a suite section that passed, and the two together look like
 * coverage. Four committed bundles carry it: `equipment-provenance`,
 * `meet-pr-word-6-5`, `meet-tension-6-3` and `press-fix`; the last three used a
 * `|`-separated pattern, which vitest does not read as alternation either.
 *
 * ===========================================================================
 * AND THE SILENT HALF, WHICH IS WHY THE CHECK IS PER FILTER
 * ===========================================================================
 * `npx vitest run a.test.ts b.test.ts` where one path does not exist PASSES,
 * reporting only the files it found — CLAUDE.md records that already. So
 * refusing only on "no test files at all" would leave the partial case exactly
 * as quiet as before: a standing command that names a renamed file keeps
 * printing `passed` while covering less than it says.
 *
 * The predicate is vitest's own: a positional filter selects a test file whose
 * path CONTAINS it. So a filter that appears in none of the paths the run
 * reported is a filter that selected nothing, and that is decidable from the
 * captured output without a second run.
 *
 * ===========================================================================
 * WHAT THIS CANNOT SEE, so nobody reads the refusal as more than it is
 * ===========================================================================
 *   - A filter that matched FEWER files than its author meant. `src/game` and
 *     `src/game/streak` both match something; only a human knows which was
 *     intended.
 *   - A file that a filter matched but that reported no tests inside it. That
 *     is a vitest result, not a filter fault, and the transcript shows it.
 *
 * ===========================================================================
 * WHY THE READER IS LINE-ANCHORED, WHICH IS A DEFECT THIS FOUND IN ITSELF
 * ===========================================================================
 * The first version scanned the whole captured text for anything shaped like a
 * test path, on the reasoning that over-collecting could only make a filter
 * look matched when it was not, and that erring toward silence was the safer
 * direction. Driven against the real tool, it reported nothing on the case it
 * was written for:
 *
 *     $ npx vitest run src/planted/absent.test.ts --reporter=verbose
 *     No test files found, exiting with code 1
 *
 *     filter: src/planted/absent.test.ts
 *     include: src/**\/*.test.ts, tools/**\/*.test.ts
 *
 * vitest ECHOES THE FILTER in the report it prints when nothing matched, so the
 * free scan read the filter's own text as a file that had run and the check
 * agreed with itself. "Erring toward silence" turned out to mean "silent on the
 * primary case", which is what this repository keeps recording about a check
 * whose domain nobody drove.
 *
 * So a path counts as having run only when it appears on a line that begins
 * with a vitest RESULT MARKER — a status glyph, `FAIL`, or `PASS`. The echo
 * lines begin with a word and a colon and are therefore not read. A file that
 * genuinely ran always has such a line, and one that is additionally named in a
 * stack trace or a diff loses nothing by being counted once.
 */

/**
 * One thing wrong with a targeted run.
 *
 * `filter` is null on the `no-test-files` arm, which is the arm that has no
 * filter to name — the two are one type because a caller reports them in one
 * block, and `=== null` rather than truthiness tells them apart.
 *
 * @typedef {{
 *   kind: 'no-test-files' | 'filter-matched-nothing',
 *   filter: string | null,
 *   ran: readonly string[],
 * }} FilterFinding
 */

/** `*.test.ts`, `.tsx`, `.mts`, `.js` … as vitest prints them. */
const TEST_FILE_PATH = /[\w@.\-/]+\.test\.[cm]?[jt]sx?/g;

/**
 * A line vitest prints ABOUT A FILE IT RAN, as opposed to about its own
 * configuration. The glyph set is what the verbose reporter uses for passed,
 * failed, skipped and todo, plus the source-footer arrow and the two words the
 * summary block leads with.
 */
const RESULT_LINE = /^\s*(?:[✓×✗✔❯↓·‼]|FAIL|PASS)\s/;

/**
 * The vitest filters a command line asked for.
 *
 * Splits on whitespace so `evidence.mjs piece "src/shell src/game/streak.test.ts"`
 * and `evidence.mjs piece src/shell src/game/streak.test.ts` mean the same thing —
 * the first spelling is the one every committed bundle used, and the one that
 * silently ran nothing.
 *
 * It deliberately does NOT split on `|`. Three bundles passed a pipe-separated
 * pattern and vitest matched nothing; teaching this function to accept that
 * spelling would invent a syntax the tool it drives does not have, and the
 * honest treatment is to let `filterFindings` report it.
 */
/**
 * @param {readonly string[]} args
 * @returns {string[]}
 */
export function filtersFrom(args) {
  return args
    .filter((arg) => arg !== '--verify')
    .flatMap((arg) => arg.split(/\s+/))
    .filter((arg) => arg.length > 0);
}

/**
 * Every test file a captured vitest run reported a RESULT for.
 *
 * @param {string} output
 * @returns {string[]}
 */
export function testFilesIn(output) {
  /** @type {Set<string>} */
  const found = new Set();
  for (const line of output.split('\n')) {
    if (!RESULT_LINE.test(line)) continue;
    for (const match of line.match(TEST_FILE_PATH) ?? []) found.add(match.replace(/\\/g, '/'));
  }
  return [...found].sort();
}

/**
 * What is wrong with a targeted run, as findings rather than a boolean.
 *
 * The two kinds are DISJOINT BY CONSTRUCTION rather than merely different, and
 * that is the standing "a new rule can make an old one vacuous" check answered
 * out loud: with at least one filter, `no-test-files` would fire in exactly the
 * states where every filter is already reported, so it would be a check that
 * could never speak alone. It is therefore scoped to the run that passed NO
 * filters — the whole-suite capture — where it is the only thing that can
 * report an empty run and where no per-filter finding exists.
 *
 * @param {readonly string[]} filters
 * @param {string} output
 * @returns {FilterFinding[]}
 */
export function filterFindings(filters, output) {
  const ran = testFilesIn(output);
  if (filters.length === 0) {
    return ran.length === 0 ? [{ kind: 'no-test-files', filter: null, ran }] : [];
  }
  return filters
    .filter((filter) => !ran.some((file) => file.includes(filter)))
    .map((filter) => ({ kind: 'filter-matched-nothing', filter, ran }));
}

/** The finding kinds, so a caller can assert every arm was driven. */
export const FILTER_FINDING_KINDS = Object.freeze(['no-test-files', 'filter-matched-nothing']);
