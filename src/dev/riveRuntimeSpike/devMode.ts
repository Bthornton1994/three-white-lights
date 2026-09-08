/**
 * devMode — the hook half of `devModeQuery.ts`, same shape as `devRoute.ts`:
 * web reads `window.location.search` synchronously; native reads the launch
 * URL through `Linking` and listens for a later `url` event; both only under
 * `__DEV__`. A production build returns null without touching `Linking`.
 *
 * Only `RiveRuntimeSpikeScreen` calls this, and that screen only mounts on
 * the spike route — so the mode is read strictly inside the existing gate.
 */
import { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';

import { devModeRequestedBy, type DevMode } from './devModeQuery';

export function useDevMode(webSearch: string | null): DevMode | null {
  const [mode, setMode] = useState<DevMode | null>(() => initialMode(webSearch));

  useEffect(() => {
    if (!__DEV__) return undefined;
    if (Platform.OS === 'web') return undefined;
    let live = true;
    void Linking.getInitialURL().then((url) => {
      if (!live) return;
      const requested = devModeRequestedBy(url);
      if (requested !== null) setMode(requested);
    });
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const requested = devModeRequestedBy(url);
      if (requested !== null) setMode(requested);
    });
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);

  return mode;
}

function initialMode(webSearch: string | null): DevMode | null {
  if (!__DEV__) return null;
  if (Platform.OS === 'web') return devModeRequestedBy(webSearch);
  return null;
}
