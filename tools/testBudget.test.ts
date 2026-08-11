/**
 * The rule that turns a measured duration into a declared timeout, graded.
 *
 * This file sits beside `verifyMarker.test.ts` in `tools/` for the reason
 * `vitest.config.ts` gives about that one: the thing being checked is an
 * instrument the suite depends on, so it is checked by the same command that
 * checks everything else rather than by a script somebody remembers to run.
 *
 * What each check would go red on is written beside it. That is the bar this
 * repository sets for an assertion — not "does it pass" but "name the edit to
 * the subject that reddens it" — and a budget check is unusually easy to write
 * vacuously, since every budget is larger than every duration by construction.
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  SWEEP_BUDGET,
  budgetFrom,
  contentionScale,
  cpuShareSample,
  resetContentionScale,
  scaleFromShare,
  unscaledBudgetFrom,
} from './testBudget.mjs';
import { declarationsIn, grade } from './test-budgets.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const read = (relative: string): string => readFileSync(path.join(REPO_ROOT, relative), 'utf8');

/**
 * Every file that declares a budget. Read from the tree rather than listed, so
 * a sixth file adopting the rule is covered without editing this one — and so
 * an import deleted from all of them empties the list and reddens the count
 * below instead of quietly checking nothing.
 */
function filesDeclaringBudgets(): readonly string[] {
  const found: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        walk(path.join(directory, entry.name));
      } else if (entry.name.endsWith('.test.ts')) {
        const relative = path.relative(REPO_ROOT, path.join(directory, entry.name));
        if (read(relative).includes('tools/testBudget.mjs')) found.push(relative);
      }
    }
  };
  walk(path.join(REPO_ROOT, 'src'));
  return found.sort();
}

describe('the rule that derives a per-test budget', () => {
  it('mirrors the global budget in vitest.config.ts, read from its source', () => {
    // Red if either number moves without the other. That matters because
    // `budgetFrom` floors at the global: raise the global there alone and every
    // derived budget here silently becomes a floor it no longer is.
    const config = read('vitest.config.ts');
    const declared = /const TEST_TIMEOUT_MS = ([0-9_]+);/.exec(config);
    expect(declared, 'vitest.config.ts declares TEST_TIMEOUT_MS').not.toBeNull();
    expect(Number((declared?.[1] ?? '').replace(/_/g, ''))).toBe(SWEEP_BUDGET.GLOBAL_MS);
  });

  it('multiplies, rounds up, and never returns a budget tighter than the global', () => {
    // The three places the arithmetic can go wrong, each pinned to a number
    // that changes if HEADROOM_FACTOR, ROUND_UP_TO_MS or the floor moves.
    expect(unscaledBudgetFrom(38_823)).toBe(160_000);
    expect(unscaledBudgetFrom(26_719)).toBe(110_000);
    expect(unscaledBudgetFrom(7_500)).toBe(30_000);
    expect(unscaledBudgetFrom(1_000)).toBe(SWEEP_BUDGET.GLOBAL_MS);
    // A basis that is not a measurement is refused rather than turned into a
    // budget of zero, which would make a test fail instantly and look hung.
    expect(() => budgetFrom(0)).toThrow(/real measurement/);
    expect(() => budgetFrom(Number.NaN)).toThrow(/real measurement/);
    expect(() => budgetFrom(1_000, 0.5)).toThrow(/tighten/);
  });

  it('puts the declaration threshold exactly where the rule reaches the global', () => {
    // DECLARE_ABOVE_MS is derived, not chosen, and this is what says so: one
    // millisecond below it the rule still returns the global, and above it the
    // rule returns something larger. Red if the threshold is edited to a
    // round-looking number that no longer matches the factor.
    expect(unscaledBudgetFrom(SWEEP_BUDGET.DECLARE_ABOVE_MS)).toBe(SWEEP_BUDGET.GLOBAL_MS);
    expect(unscaledBudgetFrom(SWEEP_BUDGET.DECLARE_ABOVE_MS + 1)).toBeGreaterThan(
      SWEEP_BUDGET.GLOBAL_MS,
    );
  });

  it('scales with the share of a core this process is getting', () => {
    // The scale is a measurement of the machine, so what is pinned is its
    // arithmetic and its clamps rather than a value. Red if the multiply is
    // dropped from `budgetFrom`, if either clamp is removed, or if the sample
    // stops being a sample.
    expect(budgetFrom(10_000, 1)).toBe(40_000);
    expect(budgetFrom(10_000, 2)).toBe(80_000);
    expect(budgetFrom(10_000, 2.5)).toBe(100_000);

    // The clamps, against literals rather than against the constants they are
    // made of. An earlier version of this asserted `scale <= MAX_SCALE`, which
    // survived MAX_SCALE going 3 -> 300: it read its own subject on both sides
    // and could not fail upward. These four reddened when that mutation was
    // re-run.
    expect(scaleFromShare(1)).toBe(1);
    expect(scaleFromShare(0.5)).toBe(2);
    expect(scaleFromShare(0.01)).toBe(3);
    expect(scaleFromShare(4)).toBe(1);

    const share = cpuShareSample(20);
    expect(share, 'a CPU share is a fraction of one core').toBeGreaterThan(0);
    expect(share).toBeLessThanOrEqual(1);

    resetContentionScale();
    const scale = contentionScale();
    expect(scale).toBeGreaterThanOrEqual(1);
    expect(scale).toBeLessThanOrEqual(3);
    // And it is cached: a second read is the same number rather than a second
    // 180ms of spinning. Red if the cache is dropped, which would put a fresh
    // sample in front of every budget in the file.
    expect(contentionScale()).toBe(scale);
  });
});

describe('the grader that re-takes the measurements', () => {
  it('finds a declared budget, its basis, and a template-titled one', () => {
    const declarations = declarationsIn(
      [
        "it('plain', () => {});",
        "it('declared', { timeout: budgetFrom(12_000) }, () => {});",
        'it(`generated ${row.name}`, { timeout: budgetFrom(9_000) }, () => {});',
      ].join('\n'),
    );
    expect(declarations.map((entry) => entry.declared)).toEqual([false, true, true]);
    expect(declarations.map((entry) => entry.basisMs)).toEqual([null, 12_000, 9_000]);
    // The template title matches whatever the placeholder stood for, and does
    // not match a different test. Red if the placeholder becomes a literal.
    expect(declarations[2]?.title.test('generated the 24576-pair window')).toBe(true);
    expect(declarations[2]?.title.test('something else')).toBe(false);
  });

  it('reports a slow undeclared test, a thin declared one, and an empty report', () => {
    // A fixture report rather than a real one, so the three findings are
    // produced by the grader's own arithmetic. Red if any of the three
    // branches stops firing — which is what a "no findings" default would do.
    const fixture = {
      testResults: [
        {
          name: path.join(REPO_ROOT, 'src/game/streak.test.ts'),
          assertionResults: [
            { title: 'DOES IT TERMINATE: the residue at 80 and 100 days, with its denominator', status: 'passed', duration: 90_000 },
            { title: 'a fast one', status: 'passed', duration: 12 },
          ],
        },
      ],
    };
    const thin = grade(fixture);
    expect(thin.findings.map((finding) => finding.kind)).toEqual(['THIN']);

    const undeclared = grade({
      testResults: [
        {
          name: path.join(REPO_ROOT, 'src/game/streak.test.ts'),
          assertionResults: [
            { title: 'EVERY CONSUMPTION IS REPORTED — exhaustively, both events, no silent debit anywhere', status: 'passed', duration: 9_000 },
            { title: 'a title no it( in that file has', status: 'passed', duration: 20_000 },
          ],
        },
      ],
    });
    // The real declaration is found, so the only finding is the unmatched one.
    expect(undeclared.findings.map((finding) => finding.kind)).toEqual(['UNMATCHED']);

    // And the third branch, on a title that really is in the tree with no
    // budget on it. Without this the UNDECLARED arm is written and never
    // driven, which is how a branch ships inverted.
    const noBudget = grade({
      testResults: [
        {
          name: path.join(REPO_ROOT, 'src/art/lifterSprite.test.ts'),
          assertionResults: [
            { title: 'renders at the committed internal resolution', status: 'passed', duration: 20_000 },
          ],
        },
      ],
    });
    // EMPTY rides along because this one-row fixture declares no budget at
    // all, which is the non-vacuity guard reporting itself rather than noise.
    expect(noBudget.findings.map((finding) => finding.kind)).toEqual(['UNDECLARED', 'EMPTY']);
    // ...and the same test just under the threshold is not a finding, so the
    // threshold is doing the deciding rather than the title.
    expect(
      grade({
        testResults: [
          {
            name: path.join(REPO_ROOT, 'src/art/lifterSprite.test.ts'),
            assertionResults: [
              {
                title: 'renders at the committed internal resolution',
                status: 'passed',
                duration: SWEEP_BUDGET.DECLARE_ABOVE_MS - 1,
              },
            ],
          },
        ],
      }).findings.map((finding) => finding.kind),
    ).toEqual(['EMPTY']);

    // An empty domain reports itself rather than passing, which is the failure
    // mode a report-grading tool is most likely to have.
    expect(grade({ testResults: [] }).findings.map((finding) => finding.kind)).toEqual([
      'EMPTY',
      'EMPTY',
    ]);
  });

  it('names every file that declares a budget, exactly, and counts the declarations', () => {
    // The non-vacuity guard for the whole mechanism, pinned as a set rather
    // than a bound because a bound lets a file drop out quietly. The list is
    // read from the tree, so it reddens both ways: remove the import from one
    // of these and its heavy sweeps are back on the 30s global with nothing
    // saying so, and add a sixth file without listing it here and this says
    // that too.
    expect(filesDeclaringBudgets()).toEqual([
      'src/art/lifterSprite.test.ts',
      'src/cutin/cutInWiring.test.ts',
      'src/empire/engagement.test.ts',
      'src/game/progression.test.ts',
      'src/game/streak.test.ts',
      'src/game/streakEntitlement.test.ts',
    ]);
    // And every one of them really declares at least one, counted rather than
    // asserted — a file could import the rule and never call it.
    const declarations = filesDeclaringBudgets().map(
      (file) => [file, declarationsIn(read(file)).filter((entry) => entry.declared).length] as const,
    );
    for (const [file, count] of declarations) expect(count, file).toBeGreaterThan(0);
    // 36 -> 43 when a suite run with another session's work on the box put
    // seven more tests over DECLARE_ABOVE_MS and `tools/test-budgets.mjs`
    // named them. That is the tool and this pin doing the same job from two
    // directions, and the number moving is the mechanism working rather than
    // drift.
    expect(declarations.reduce((total, [, count]) => total + count, 0)).toBe(43);
  });
});
