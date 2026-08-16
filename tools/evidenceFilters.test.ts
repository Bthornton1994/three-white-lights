/**
 * evidenceFilters.test.ts — drives the check that a bundle's targeted run
 * actually selected something.
 *
 * ===========================================================================
 * WHY THE FIXTURES ARE REAL CAPTURES AND NOT HAND-WRITTEN LINES
 * ===========================================================================
 * The thing being parsed is vitest's own output, and the defect this closes was
 * a tool reading its own arguments differently from the process it spawned. A
 * hand-written fixture would encode what the author BELIEVES vitest prints,
 * which is the same mistake one level out. The two fixtures below are pasted
 * from real runs at 2b6612e:
 *
 *   - `EMPTY_RUN` is the first captured command of the committed
 *     `.gauntlet/evidence/equipment-provenance.txt`, verbatim.
 *   - `VERBOSE_RUN` is an abridged `--reporter=verbose` run of two real files,
 *     keeping the shapes a path can appear in: a result line, a summary, and a
 *     failure's source footer.
 *
 * ===========================================================================
 * WHAT THESE TESTS DO NOT SAY
 * ===========================================================================
 * They grade the parser and the finding rule, not the refusal. Whether
 * `evidence.mjs` reaches `process.exit` on a finding is asserted structurally
 * in `treeIdentity.test.ts`, which reads that file's source for the same reason
 * that file's own header gives: driving the whole script means spawning two
 * full suites.
 */
import { describe, expect, it } from 'vitest';

import {
  FILTER_FINDING_KINDS,
  filterFindings,
  filtersFrom,
  testFilesIn,
} from './evidenceFilters.mjs';

/**
 * Verbatim from a real empty run, which is the defect in its own words.
 *
 * THE `filter:` LINE IS THE POINT OF THIS FIXTURE and it is not decoration. The
 * first version of `testFilesIn` scanned the whole text and read that echo as a
 * file that had run, so the check reported nothing on the exact case it exists
 * for. It was found by driving the real tool, not by reading the parser.
 */
const EMPTY_RUN = [
  '(!) Your Vite config uses features that are unsupported by `configLoader: \'native\'`, which is planned to become the default in a future major version of Vite:',
  '  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json',
  'Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.',
  'No test files found, exiting with code 1',
  '',
  'filter:  src/nope/does-not-exist.test.ts',
  'include: src/**/*.test.ts, tools/**/*.test.ts',
  'exclude:  node_modules/**, .expo/**, dist/**',
].join('\n');

/** Abridged from a real verbose run, keeping every shape a path appears in. */
const VERBOSE_RUN = [
  ' RUN  v4.1.10 /home/user/three-white-lights',
  '',
  ' ✓ src/shell/shellWiring.test.ts > the shell is the join, and it is the only one > renders the session, meet, and Empire surfaces — the join is in one file 3ms',
  ' ✓ src/shell/empireFloor.test.ts > the floor advances, and these are the numbers > draws the gym at 0s, 10s, 60s and 600s 2ms',
  ' ❯ src/shell/shellWiring.test.ts:1622:27',
  '',
  ' Test Files  2 passed (2)',
  '      Tests  72 passed (72)',
].join('\n');

describe('the filter reader takes a pattern the way vitest does', () => {
  it('splits one quoted argument into the paths it names, and takes several arguments too', () => {
    // THE DEFECT, AS THE TWO SPELLINGS THAT HAVE TO MEAN THE SAME THING. Every
    // committed bundle used the first and none of them ran what it printed.
    expect(filtersFrom(['src/shell src/game/guaranteeTags.test.ts'])).toEqual([
      'src/shell',
      'src/game/guaranteeTags.test.ts',
    ]);
    expect(filtersFrom(['src/shell', 'src/game/guaranteeTags.test.ts'])).toEqual([
      'src/shell',
      'src/game/guaranteeTags.test.ts',
    ]);
    // ...and the flag is not a filter, whichever position it is in.
    expect(filtersFrom(['--verify'])).toEqual([]);
    expect(filtersFrom(['src/shell', '--verify'])).toEqual(['src/shell']);
    // ...and no argument is no filter, which is the whole-suite bundle.
    expect(filtersFrom([])).toEqual([]);
  });

  it('does NOT read a pipe as alternation, because vitest does not either', () => {
    // Three committed bundles passed this spelling and matched nothing. The
    // decision recorded here is that the tool reports it rather than inventing
    // the syntax — so the filter survives whole and `filterFindings` names it.
    expect(filtersFrom(['AttemptSelectView|meetDay|guaranteeTags'])).toEqual([
      'AttemptSelectView|meetDay|guaranteeTags',
    ]);
  });
});

describe('the run reader sees which files a capture actually ran', () => {
  it('reads the paths out of a verbose run, once each, and finds none in an empty one', () => {
    expect(testFilesIn(VERBOSE_RUN)).toEqual([
      'src/shell/empireFloor.test.ts',
      'src/shell/shellWiring.test.ts',
    ]);
    // The source footer names `shellWiring.test.ts` a second time with a line
    // and column glued to it; the set is two, so the reader is not counting
    // mentions.
    //
    // AND THE EMPTY RUN NAMES A PATH TOO — its own `filter:` echo. Reading that
    // as a file that ran is the defect this fixture carries, and it is the one
    // state where the whole rule silently agrees with itself.
    expect(testFilesIn(EMPTY_RUN)).toEqual([]);
    expect(EMPTY_RUN).toContain('filter:  src/nope/does-not-exist.test.ts');
  });

  it('CONTROL: the line anchor is what excludes the echo, not the path shape', () => {
    // The echo and a result line hold the SAME path text. If the reader ever
    // stops being line-anchored, the first of these keeps passing and the
    // second starts returning the path — so the pair is what says the anchor is
    // doing the work rather than some property of the string.
    const path = 'src/nope/does-not-exist.test.ts';
    expect(testFilesIn(`filter:  ${path}`)).toEqual([]);
    expect(testFilesIn(` ✓ ${path} > a suite > a test 1ms`)).toEqual([path]);
  });
});

describe('a targeted run that selected nothing is a finding', () => {
  it('names the filter that matched nothing, and stays silent on the one that did', () => {
    const findings = filterFindings(
      ['src/shell', 'src/game/guaranteeTags.test.ts'],
      VERBOSE_RUN,
    );
    expect(findings.map((f) => f.filter)).toEqual(['src/game/guaranteeTags.test.ts']);
    expect(findings.map((f) => f.kind)).toEqual(['filter-matched-nothing']);
    // THE HALF THAT MATTERS: `src/shell` matched, so this is the PARTIAL case —
    // the one vitest exits 0 on and the one a "did anything run" check cannot
    // see. Without it the rule would catch the empty run and leave the quiet
    // one exactly as quiet.
    expect(filterFindings(['src/shell'], VERBOSE_RUN)).toEqual([]);
  });

  it('reports the pipe spelling, which is what three committed bundles used', () => {
    const findings = filterFindings(['src/shell|src/session'], VERBOSE_RUN);
    expect(findings.map((f) => f.filter)).toEqual(['src/shell|src/session']);
  });

  it('reports an empty whole-suite run, and that arm has no filter to name', () => {
    // SCOPED TO THE NO-FILTER RUN, and that is the standing domination check
    // answered rather than assumed: with a filter present, an empty run makes
    // every filter a finding, so `no-test-files` would fire only in states
    // where `filter-matched-nothing` already fires and could never speak alone.
    // Its exclusive domain is the whole-suite capture. Both directions driven:
    expect(filterFindings([], EMPTY_RUN).map((f) => f.kind)).toEqual(['no-test-files']);
    expect(filterFindings([], VERBOSE_RUN)).toEqual([]);
    expect(filterFindings(['src/shell'], EMPTY_RUN).map((f) => f.kind)).toEqual([
      'filter-matched-nothing',
    ]);
  });

  it('drives every finding kind the module declares — an arm added without one is red', () => {
    // The anti-vacuity guard this codebase asks of any list of fault kinds: the
    // list and the cases below are compared as sets, so a kind nothing produces
    // is a finding about this test rather than a silent gap.
    const produced = new Set(
      [
        ...filterFindings([], EMPTY_RUN),
        ...filterFindings(['src/game'], VERBOSE_RUN),
      ].map((f) => f.kind),
    );
    expect([...produced].sort()).toEqual([...FILTER_FINDING_KINDS].sort());
  });
});
