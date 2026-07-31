import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Pure game-math modules only. These have zero React imports and zero I/O
// (see CLAUDE.md "Pure logic is separate from UI"), so a plain node
// environment is correct and keeps the suite fast.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/**', '.expo/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      include: ['src/game/**/*.ts', 'src/tuning/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      reporter: ['text-summary', 'json-summary'],
    },
  },
});
