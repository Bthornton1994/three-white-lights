import { defineConfig } from 'vitest/config';
import path from 'node:path';

import { contentionScale } from './tools/testBudget.mjs';

// Pure game-math modules only. These have zero React imports and zero I/O
// (see CLAUDE.md "Pure logic is separate from UI"), so a plain node
// environment is correct and keeps the suite fast.
/**
 * Raised from vitest's 5000 ms default because several suites here are
 * genuinely compute-heavy rather than slow by accident.
 *
 * THE LIST OF "THE HEAVY ONES" THAT USED TO LIVE HERE IS GONE, AND ITS ABSENCE
 * IS THE POINT. It went stale twice; each time it sent the next reader to the
 * wrong file, and the second time it named six `streakEntitlement` cases while
 * `engagement.test.ts` was taking 435 of the suite's 479 seconds. A transcribed
 * list of durations is a measurement with nobody responsible for re-taking it.
 * It is taken by a command now instead:
 *
 *   npx vitest run --reporter=json --outputFile.json=/tmp/suite.json
 *   node tools/test-budgets.mjs /tmp/suite.json
 *
 * That prints every test's real duration against its declared budget, names any
 * test slow enough to need a declared budget and having none, and exits
 * non-zero on a finding. Run it on an idle box; on a shared one it measures the
 * sharing too.
 *
 * The diagnosis kept from the last round, because it was wrong in an
 * instructive way: a red here was called a contention artefact — "passes idle,
 * fails under load" — on a duration list whose grep matched only the passing
 * rows and silently dropped the failing one, which was the slowest in the file.
 * That particular test was over budget outright. The NEXT three reds really
 * were contention, which is why the sentence above is now a tool rather than a
 * transcription.
 *
 * TWO THINGS CHANGED RATHER THAN THE BUDGET back then, and no sweep shrank.
 * Three hand-rolled 4096-mask enumerations in `engagement.test.ts` rebuilt the
 * same twelve-day runs seven times over because `moreEngagedBy(history(mask),
 * bit)` IS `history(mask | 1 << bit)` and only `windowedSweep` was exploiting
 * it; they now cache by mask like it does. And the sweep helpers are memoised
 * on their arguments. The suite's only red then went from 34557 ms to under
 * 7000 ms on the first of those alone.
 *
 * WHAT THIS GLOBAL IS FOR, and where it deliberately stops. It is the budget for
 * the roughly three thousand tests that finish in milliseconds, and it stays
 * tight so a genuinely hung one is heard about quickly. The three dozen sweeps
 * that legitimately need longer declare their own budget at their own `it(`,
 * derived from that test's measured duration by `budgetFrom` in
 * `tools/testBudget.mjs`, which holds the rule, the factor, the evidence for
 * the factor and a contention scale measured at run time.
 * `SWEEP_BUDGET.GLOBAL_MS` mirrors this constant and
 * `tools/testBudget.test.ts` reads this file's source, so the two cannot drift.
 *
 * That is the "budget that fits the work" this comment used to ask for, made
 * per test rather than per suite. The alternative — raising this number to 90 s
 * — hides a hang behind a minute and a half for every test in the repository,
 * and the alternative to THAT, shrinking a sweep, trades a §12.3 measurement
 * for a clock.
 *
 * WHY RAISING IT WOULD NOT HAVE FIXED THE LAST FAILURE EITHER, which had to be
 * measured before it could be said. Six tests timed out on an integrated tree
 * while three agents' suites shared these four cores, four of them against this
 * number — and the same suite took 427 s and 453 s when it was less crowded and
 * 655 s then. Per test, on an otherwise idle box, one sweep measured 2.33x
 * longer inside a whole-suite run than it did alone, which is more than the
 * entire margin the derived budgets used to carry. A number here big enough to
 * cover that would have to cover an unknown number of concurrent sessions. What
 * covers it instead is per test, and half of it is measured at run time: see
 * `tools/testBudget.mjs`, which states what each half reaches and what it does
 * not.
 */
const TEST_TIMEOUT_MS = 30_000;

/**
 * THE GLOBAL IS MULTIPLIED BY THE SAME MEASURED SCALE THE DECLARED BUDGETS USE,
 * AND THAT IS NOT THE RAISE THE PARAGRAPHS ABOVE REFUSE.
 *
 * The refusal is of a STATIC raise: 90 s handed to three thousand millisecond
 * tests on every run, idle or not, so the next genuine hang sits there for a
 * minute and a half. This multiplies by `contentionScale()`, which is 1.00 on
 * an unshared box — measured, not hoped: the probe reads a share of exactly
 * 1.000 idle. So the idle behaviour of this file is byte-for-byte what it was,
 * and the number only moves when the machine is measurably slower.
 *
 * WHAT FORCED IT, because it was not in the first version of this repair.
 * A full suite run at `a4fd5c0` while another session held these four cores at
 * load average 10-12.6 took 1969 s against 414 s idle — 4.75x — and failed
 * three tests. Every test with a DECLARED budget passed, including one at
 * 275 s. All three failures were here, against this number, and all three are
 * tests whose idle duration is below `DECLARE_ABOVE_MS` and which therefore
 * correctly have no declaration: 4.75x is simply more than the 4x of margin
 * this number represents for them.
 *
 * Sampled once, in the main process, before the workers exist — so a load that
 * arrives after the config is read is not seen here. That is the same hole
 * `tools/testBudget.mjs` declares for the per-test scale, one level up, and it
 * is the reason this is a multiplier on a measurement rather than a promise.
 */
const CONTENTION_SCALE = contentionScale();

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
    /**
     * `tools/` IS HERE BECAUSE ONE TOOL IS NOW GRADED BY THE SUITE.
     * `tools/verifyMarker.test.ts` drives `watchdog.mjs` as a subprocess, so the
     * interrupted-verification marker is checked by the same command that
     * checks everything else instead of by a script somebody remembers to run.
     *
     * IT IS NOT COSMETIC. `progression.test.ts`'s "drops from the sweep exactly
     * the files vitest runs" asserts that the set of files the project compiles
     * but the reflective sweep skips EQUALS the set vitest executes, and it
     * asks vitest for the right-hand side rather than restating these globs. A
     * `.test.ts` outside `src/` without this line is compiled, skipped by every
     * scan, and run by nothing — which is the exact hole that pin exists to
     * close, and it would go red here rather than quietly.
     */
    include: ['src/**/*.test.ts', 'tools/**/*.test.ts'],
    exclude: ['node_modules/**', '.expo/**', 'dist/**'],
    testTimeout: Math.round(TEST_TIMEOUT_MS * CONTENTION_SCALE),
    coverage: {
      provider: 'v8',
      include: ['src/game/**/*.ts', 'src/tuning/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      reporter: ['text-summary', 'json-summary'],
    },
  },
});
