import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { RELEASE_CONFIG } from './releaseConfig.ts';

export default defineConfig({
  // Fragment routes require no HTML fallback for missing assets.
  appType: 'mpa',
  plugins: [react()],
  resolve: {
    // Hooks in the shared native source tree use the browser's React instance.
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: '127.0.0.1',
    port: RELEASE_CONFIG.developmentPort,
    strictPort: true,
    fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] },
  },
  preview: { host: '127.0.0.1', port: RELEASE_CONFIG.previewPort, strictPort: true },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
  },
});
