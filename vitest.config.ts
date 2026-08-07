import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Pure game-math modules only. These have zero React imports and zero I/O
// (see CLAUDE.md "Pure logic is separate from UI"), so a plain node
// environment is correct and keeps the suite fast.
/**
 * Raised from vitest's 5000 ms default because several suites here are
 * genuinely compute-heavy rather than slow by accident, and they time out ONLY
 * when run in parallel under load.
 *
 * THE THREE TESTS THIS COMMENT USED TO NAME ARE NOT THE SLOW ONES ANY MORE, and
 * that mattered: a builder hit a red run, reproduced it under CPU load, and
 * found the timeouts were in a file BYTE-IDENTICAL to its base — then confirmed
 * the base commit's own source reproduces it under the same load. Different
 * tests time out per run, and none of the three named here were among them. A
 * stale list of "the heavy ones" is worse than none, because it sends the next
 * reader to the wrong file.
 *
 * MEASURED on an unloaded machine, every test over 4 s, slowest first:
 *
 *   16866 ms  streakEntitlement > EXHAUSTIVE, ACROSS A WINDOW BOUNDARY
 *   16254 ms  streakEntitlement > MAGNITUDE AT LONG HORIZONS: 200 and 400 days
 *    9930 ms  streakEntitlement > THE FREE GRANT PATH cannot create a violation
 *    6906 ms  streakEntitlement > EXHAUSTIVE: every calendar of 8 to 16 days
 *    6132 ms  streakEntitlement > SAMPLED: 40, 60, 80 and 100 days
 *    4014 ms  streakEntitlement > NEGATIVE CONTROLS
 *    3954 ms  tuning/audit > A REAL PARSER AGREES ABOUT WHERE THE COMMENTS ARE
 *
 * Every one of the top six is in `streakEntitlement.test.ts`, which is why that
 * one file sets the whole suite's wall time.
 *
 * THE MARGIN IS THIN AND THAT IS THE POINT OF WRITING THE NUMBERS DOWN. The two
 * slowest sit at 56% of this budget with nothing else competing for a core.
 * Raising the timeout would hide that rather than fix it; the real fix is
 * splitting that file or shrinking a sweep, and whoever does it should re-take
 * these measurements rather than trusting this list — which is exactly the
 * mistake the list above replaced.
 *
 * Worth fixing rather than tolerating: a suite that fails on machine load and
 * passes on a retry teaches everyone to re-run instead of reading the failure,
 * which is exactly how a real red gets waved through. Those tests earn their
 * time — they rasterise real frames and enumerate whole calendars — so the
 * honest fix is a budget that fits the work, not a smaller sweep.
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
