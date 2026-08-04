import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Pure game-math modules only. These have zero React imports and zero I/O
// (see CLAUDE.md "Pure logic is separate from UI"), so a plain node
// environment is correct and keeps the suite fast.
/**
 * Raised from vitest's 5000 ms default because three suites here are genuinely
 * compute-heavy rather than slow by accident, and they were timing out ONLY
 * when run in parallel with each other under load: `lifterSprite > upscales by
 * exact pixel replication`, `spriteMarks > reports placements that agree with
 * the finished grid`, and `streak > KNOWN GAP, EXHAUSTIVE MAXIMISATION`. Two
 * independent observations, a builder's and mine, both reproduced with
 * unrelated changes stashed.
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
