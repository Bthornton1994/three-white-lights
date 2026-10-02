import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { contentionScale } from '../tools/testBudget.mjs';
import { RELEASE_CONFIG } from './releaseConfig.ts';

const repo = fileURLToPath(new URL('..', import.meta.url));
const deps = fileURLToPath(new URL('./node_modules', import.meta.url));

export default defineConfig({
  root: repo,
  // Browser cases and shared pure source must not inherit the native app config.
  tsconfig: fileURLToPath(new URL('./tsconfig.test.json', import.meta.url)),
  resolve: {
    alias: {
      '@': `${repo}/src`,
      vitest: `${deps}/vitest`,
      typescript: `${deps}/typescript`,
    },
  },
  test: {
    environment: 'node',
    include: ['web/src/**/*.test.ts', 'web/tests/**/*.test.ts'],
    exclude: ['node_modules/**', 'web/node_modules/**', '.expo/**', 'dist/**', 'web/dist/**'],
    testTimeout: Math.round(RELEASE_CONFIG.unitTestTimeoutMs * contentionScale()),
  },
});
