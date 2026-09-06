import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

// On native, Skia is linked in and ready, so the app can be imported eagerly.
//
// On web, Skia's JS API binds to `global.CanvasKit` at module-evaluation time,
// so the app — and every module that transitively imports Skia — must not be
// imported until the WASM has finished loading. We also serve that WASM from
// public/ rather than the default CDN, which this sandbox blocks.
async function bootWeb(): Promise<void> {
  if (typeof document !== 'undefined') {
    const bg = '#1a1410';
    document.documentElement.style.backgroundColor = bg;
    document.documentElement.style.height = '100%';
    document.body.style.backgroundColor = bg;
    document.body.style.height = '100%';
    document.body.style.margin = '0';
    const root = document.getElementById('root');
    if (root !== null) {
      root.style.backgroundColor = bg;
      root.style.minHeight = '100%';
      root.style.height = '100%';
    }
  }
  const { LoadSkiaWeb } = await import('@shopify/react-native-skia/lib/module/web');
  await LoadSkiaWeb({ locateFile: (file: string) => `/${file}` });
  const { default: App } = await import('./App');
  registerRootComponent(App);
}

async function bootNative(): Promise<void> {
  const { default: App } = await import('./App');
  registerRootComponent(App);
}

void (Platform.OS === 'web' ? bootWeb() : bootNative());
