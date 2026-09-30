import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { contentionScale } from '../tools/testBudget.mjs';

const repo = fileURLToPath(new URL('..', import.meta.url));
const deps = fileURLToPath(new URL('./node_modules', import.meta.url));

export default defineConfig({
  root: repo,
  resolve: {
    alias: {
      '@': `${repo}/src`,
      vitest: `${deps}/vitest`,
      typescript: `${deps}/typescript`,
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tools/**/*.test.ts', 'web/src/**/*.test.ts', 'web/tests/**/*.test.ts'],
    exclude: ['node_modules/**', 'web/node_modules/**', '.expo/**', 'dist/**', 'web/dist/**'],
    testTimeout: Math.round(30_000 * contentionScale()),
  },
});
