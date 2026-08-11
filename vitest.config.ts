import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Pure game-math modules only. These have zero React imports and zero I/O
// (see CLAUDE.md "Pure logic is separate from UI"), so a plain node
// environment is correct and keeps the suite fast.
/**
 * Raised from vitest's 5000 ms default because several suites here are
 * genuinely compute-heavy rather than slow by accident.
 *
 * THIS LIST HAS NOW BEEN STALE TWICE, and the second time it was worse than the
 * first: it named six `streakEntitlement` cases topping out at 16866 ms while
 * `src/empire/engagement.test.ts` alone was taking 435 of the suite's 479
 * seconds, held eight tests above 20 s, and contained the suite's only red — a
 * test at 34557 ms against this 30000 ms budget, failing ALONE IN ITS OWN FILE
 * on an idle machine. A stale list of "the heavy ones" sends the next reader to
 * the wrong file, which is what it did.
 *
 * The first diagnosis of that red was also wrong and is worth keeping: it was
 * called a contention artefact — "passes idle, fails under load" — on a
 * duration list whose grep pattern matched only the passing `✓` rows and
 * silently dropped the failing `×` one, which was the slowest in the file. A
 * measurement that excludes its own subject, with a confident causal claim on
 * top. It was not racy; it was over budget outright.
 *
 * MEASURED, four cores, `engagement.test.ts` run alone, after the caches and
 * the memo below landed. Every test over 8 s, slowest first:
 *
 *   30766 ms  engagement > pins every day anchor on the single-purse control
 *   30211 ms  engagement > measures the rotation phase removed
 *   25683 ms  engagement > measures the day anchor on seeded histories at 100 days
 *   24429 ms  engagement > measures the ordering reversed: costliest first
 *   23039 ms  engagement > measures the per-check-in granularity removed
 *   21317 ms  engagement > explains the save-for-physio zero
 *   18305 ms  engagement > measures the day anchor on seeded histories at 60 days
 *   17221 ms  engagement > takes the whole-day reading under the last three
 *   16303 ms  engagement > pins the four anchors on a seeded domain, 20 and 40
 *   15553 ms  engagement > holds the decision moment
 *   14651 ms  engagement > finds all six policies zero at 40 seeded days
 *   12714 ms  engagement > pins every day anchor on the shipped wiring
 *   12275 ms  engagement > takes the whole-day reading under the first three
 *   12097 ms  engagement > SAMPLED: seeded histories at 60 and 100 days
 *   10857 ms  engagement > measures chain A re-connected
 *    8627 ms  engagement > measures the shipped engine, and BOTH halves are zero
 *    8613 ms  engagement > splits the shipped anchor by WHEN a purse can afford
 *    8368 ms  engagement > measures the SINGLE-PURSE engine on the same domain
 *    8297 ms  engagement > keeps §5.3's promotion path load-bearing: 824
 *
 * `streakEntitlement.test.ts`'s cases are no longer at the top and are not
 * re-listed; re-take them if that file is the one you are working on.
 *
 * TWO THINGS CHANGED RATHER THAN THE BUDGET, and no sweep shrank. Three
 * hand-rolled 4096-mask enumerations in `engagement.test.ts` rebuilt the same
 * twelve-day runs seven times over because `moreEngagedBy(history(mask), bit)`
 * IS `history(mask | 1 << bit)` and only `windowedSweep` was exploiting it;
 * they now cache by mask like it does. And the sweep helpers are memoised on
 * their arguments, because five of the file's windowed sweeps were the same
 * seven arguments written twice. The suite's only red went from 34557 ms to
 * under 7000 ms on the first of those alone.
 *
 * WHAT THIS GLOBAL IS FOR, and where it deliberately stops. It is the budget for
 * the roughly three thousand tests that finish in milliseconds, and it stays
 * tight so a genuinely hung one is heard about quickly. The dozen sweeps that
 * legitimately need longer declare their own budget at their own `it(`, derived
 * from that test's measured duration by `budgetFrom` in
 * `src/empire/engagement.test.ts` — two times measured, rounded up to five
 * seconds, floored at this number. `SWEEP_BUDGET.GLOBAL_MS` mirrors this
 * constant and a test there reads this file's source, so the two cannot drift.
 *
 * That is the "budget that fits the work" this comment used to ask for, made
 * per test rather than per suite. The alternative — raising this number to 90 s
 * — hides a hang behind a minute and a half for every test in the repository,
 * and the alternative to THAT, shrinking a sweep, trades a §12.3 measurement
 * for a clock.
 */
const TEST_TIMEOUT_MS = 30_000;

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/**', '.expo/**', 'dist/**'],
    testTimeout: TEST_TIMEOUT_MS,
    coverage: {
      provider: 'v8',
      include: ['src/game/**/*.ts', 'src/tuning/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      reporter: ['text-summary', 'json-summary'],
    },
  },
});
