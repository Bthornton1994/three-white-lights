/**
 * licensingEntry.tsx — web entry for the Tier 3 screenshot harness ONLY.
 *
 * `App.tsx` is contended by other pieces of this run, so this piece does not
 * change it. Metro serves this file as its own bundle to `public/licensing.html`
 * and `tools/shoot.mjs` points at that page — the same route `src/card/
 * cardEntry.tsx` takes, for the same reason:
 *
 *   bash tools/dev-web.sh
 *   node tools/shoot.mjs out.png \
 *     --url 'http://localhost:8081/licensing.html?panel=shop' --sel licensing-panel
 *
 * Which surface is shown comes from the query string, so a run of screenshots is
 * a run of URLs rather than a sequence of clicks — and two captures that were
 * meant to differ cannot silently be the same screen twice.
 *
 * EVERY SKIA-TOUCHING IMPORT IS DYNAMIC AND HAPPENS AFTER `LoadSkiaWeb`. Skia's
 * web build binds to `global.CanvasKit` at module-evaluation time, so a static
 * `import { LicensingScreen }` at the top of this file would evaluate the whole
 * Skia chain before the WASM landed and `Skia.Image` would be undefined at first
 * render. `index.ts` and `cardEntry.tsx` carry the same warning.
 *
 * Nothing in `src/licensing/` outside this file reads a URL, a clock or a global.
 */

import React from 'react';
import { AppRegistry, Dimensions } from 'react-native';

const DEFAULT_PANEL = 'shop';

async function boot(): Promise<void> {
  const { LoadSkiaWeb } = await import('@shopify/react-native-skia/lib/module/web');
  await LoadSkiaWeb({ locateFile: (file: string) => `/${file}` });

  const { LicensingScreen } = await import('./LicensedPanelView');
  const panels = await import('./renderPanels');
  const { LICENSING_PANELS } = panels;
  type PanelId = (typeof LICENSING_PANELS)[number];
  const { LICENSING_CATALOGUE } = await import('./partners');

  const requested = new URLSearchParams(window.location.search).get('panel') ?? DEFAULT_PANEL;
  const panel: PanelId = (LICENSING_PANELS as readonly string[]).includes(requested)
    ? (requested as PanelId)
    : DEFAULT_PANEL;

  const rootTag = document.getElementById('root');
  if (rootTag === null) throw new Error('licensingEntry: no #root element on the page');

  const Root = (): React.ReactElement => (
    <LicensingScreen
      catalogue={LICENSING_CATALOGUE}
      panel={panel}
      viewportWidth={Dimensions.get('window').width}
    />
  );
  AppRegistry.registerComponent('LicensingHarness', () => Root);
  AppRegistry.runApplication('LicensingHarness', { rootTag });
}

void boot();
