/**
 * cardEntry.tsx — web entry for the result-card screenshot harness ONLY.
 *
 * `App.tsx` belongs to Prototype 1's lift mechanic and to another piece of this
 * run, so this piece does not change it. Instead, Metro serves this file as its
 * own bundle to `public/card.html`, and `tools/shoot.mjs` points at that page:
 *
 *   npx expo start --web --port 8091 --offline
 *   node tools/shoot.mjs out.png --url 'http://localhost:8091/card.html?card=bombed'
 *
 * Which sample card is shown comes from the query string, so a run of
 * screenshots is a run of URLs rather than a sequence of clicks — and two
 * captures that were meant to differ cannot silently be the same screen twice.
 *
 * EVERY SKIA-TOUCHING IMPORT IS DYNAMIC AND HAPPENS AFTER `LoadSkiaWeb`.
 * Skia's web build binds to `global.CanvasKit` at module-evaluation time, so a
 * static `import { ResultCardScreen }` at the top of this file would evaluate
 * the whole Skia chain before the WASM landed and `Skia.Image` would be
 * undefined at first render. `index.ts` carries the same warning; this is the
 * same trap, reached by a different door.
 *
 * Nothing in `src/card/` outside this file reads a URL, a clock or a global.
 */

import React from 'react';
import { AppRegistry } from 'react-native';

const DEFAULT_CARD_ID = 'strong';

async function boot(): Promise<void> {
  const { LoadSkiaWeb } = await import('@shopify/react-native-skia/lib/module/web');
  await LoadSkiaWeb({ locateFile: (file: string) => `/${file}` });

  const { ResultCardScreen } = await import('./ResultCardScreen');
  const { SAMPLE_CARDS } = await import('./sampleCards');

  const requested = new URLSearchParams(window.location.search).get('card') ?? DEFAULT_CARD_ID;
  const selected = SAMPLE_CARDS.find((entry) => entry.id === requested) ?? SAMPLE_CARDS[0];
  if (selected === undefined) throw new Error('cardEntry: no sample cards to show');

  const rootTag = document.getElementById('root');
  if (rootTag === null) throw new Error('cardEntry: no #root element on the page');

  const Root = (): React.ReactElement => <ResultCardScreen card={selected.card} />;
  AppRegistry.registerComponent('ResultCardHarness', () => Root);
  AppRegistry.runApplication('ResultCardHarness', { rootTag });
}

void boot();
