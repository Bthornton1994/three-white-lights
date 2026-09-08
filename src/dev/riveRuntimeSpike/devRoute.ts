/**
 * devRoute — the ONE dev-only route to the Rive runtime spike, on both
 * platforms, read from the same query string.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * `App.tsx` mounts `RiveRuntimeSpikeScreen` only when `__DEV__` is true AND
 * the URL carries `?dev-rive-spike=1`. On web that URL is
 * `window.location.search`. On native there is no `window` and no address
 * bar — the ADR's first native instruction was "temporarily return true from
 * `isDevRiveSpikeRequested()`", which is an edit to the platform edge that
 * would ship the spike to anyone who forgot to revert it. This module gives
 * native the same explicit route instead: the app's LAUNCH URL, delivered
 * through the app scheme (`app.json` `scheme`), carrying the same key and
 * the same exact value. A tester opens it with
 *
 *     adb shell am start -W -a android.intent.action.VIEW \
 *       -d "threewhitelights://?dev-rive-spike=1"
 *
 * — a thing nobody reaches by tapping through the app, exactly like typing
 * the query string into a browser.
 *
 * ---------------------------------------------------------------------------
 * BOTH CONDITIONS, STILL
 * ---------------------------------------------------------------------------
 * `useDevRiveSpikeRoute` returns `'app'` unconditionally when `__DEV__` is
 * false: no `Linking` call is made, no listener is installed, and the
 * production path is byte-for-byte the shell. Under `__DEV__` it reads the
 * initial URL once and listens for a later `url` event (Android delivers a
 * deep link to a running app as an event, not a relaunch), so the route
 * works whether the link arrives before or after the bundle loads. The
 * query is parsed by `devRiveSpikeRequestedBy`, which is pure and tested:
 * the value must be exactly `1`, and `expo-dev-client`'s own launcher URL
 * (`exp+…://expo-development-client/?url=…`) is NOT a request.
 *
 * `'pending'` exists only on native under `__DEV__`, for the one tick before
 * `Linking.getInitialURL()` resolves; `App.tsx` draws its backdrop and
 * nothing else in that state so the shell never flashes under the spike.
 *
 * The key, the value and the parser are in `devRouteQuery.ts`, which imports
 * nothing from `react-native` — vitest runs in node and cannot parse that
 * package's Flow source, so the pure half is what the test drives and this
 * file is what it pins.
 */
import { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';

import { devRiveSpikeRequestedBy } from './devRouteQuery';

export type DevRiveSpikeRoute = 'pending' | 'spike' | 'app';

/**
 * The route decision for `App.tsx`. `webSearch` is `window.location.search`
 * on web and `null` on native (the platform edge already computes it).
 */
export function useDevRiveSpikeRoute(webSearch: string | null): DevRiveSpikeRoute {
  const [route, setRoute] = useState<DevRiveSpikeRoute>(() => initialRoute(webSearch));

  useEffect(() => {
    if (!__DEV__) return undefined;
    if (Platform.OS === 'web') return undefined;
    let live = true;
    void Linking.getInitialURL().then((url) => {
      if (!live) return;
      setRoute((current) => (current === 'spike' ? current : devRiveSpikeRequestedBy(url) ? 'spike' : 'app'));
    });
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (devRiveSpikeRequestedBy(url)) setRoute('spike');
    });
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);

  return route;
}

function initialRoute(webSearch: string | null): DevRiveSpikeRoute {
  if (!__DEV__) return 'app';
  if (Platform.OS === 'web') return devRiveSpikeRequestedBy(webSearch) ? 'spike' : 'app';
  return 'pending';
}
