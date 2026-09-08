/**
 * vite.owner.config.ts — the Vite config for the owner playtest route
 * (`owner-playtest.html` / `owner-playtest.tsx`), VL-3.
 *
 *     npx vite --config vite.owner.config.ts --open /owner-playtest.html?scenario=capacity
 *
 * `ladder-dev.html` runs zero-config because `GymView` renders DOM host tags.
 * `GymScreen` is the real React Native screen, so this route needs the one
 * thing Expo's web build does for the app and Vite does not do by itself:
 * resolve `react-native` to `react-native-web`. Everything else here is what
 * that library expects of its host page (a `global` binding and a `__DEV__`
 * flag, which Metro defines and Vite does not).
 *
 * Deliberately NOT `vitest.config.ts` — that file is Session A's and is the
 * test runner's. This one is read only by the command above. Kept
 * literal-free on purpose: the tuning audit walks the repository root.
 */
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      'react-native': 'react-native-web',
    },
    extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
  },
  define: {
    global: 'window',
    __DEV__: 'true',
  },
  optimizeDeps: {
    include: ['react-native-web'],
  },
});
