/**
 * devRouteQuery — the pure half of the spike's dev route: the query key,
 * the exact value, and the parser. No React, no `react-native`, so vitest
 * can drive it in node; the hook that reads the launch URL lives beside it
 * in `devRoute.ts` and is pinned as source.
 */

/** The query key `App.tsx` gates on. `resolveEntry` has no arm for it, ever. */
export const DEV_RIVE_SPIKE_QUERY_KEY = 'dev-rive-spike';
/** The exact value; `0`, `true`, `yes` and a bare key are all refused. */
export const DEV_RIVE_SPIKE_QUERY_VALUE = '1';

/**
 * Does this URL — a full `scheme://host/path?query`, or a bare `?query` as
 * `window.location.search` gives it — request the spike? Deliberately says
 * nothing about `__DEV__`; the hook and `App.tsx` do.
 */
export function devRiveSpikeRequestedBy(url: string | null | undefined): boolean {
  if (url === null || url === undefined) return false;
  const q = url.indexOf('?');
  if (q < 0) return false;
  const search = url.slice(q + 1).split('#')[0] ?? '';
  return new URLSearchParams(search).get(DEV_RIVE_SPIKE_QUERY_KEY) === DEV_RIVE_SPIKE_QUERY_VALUE;
}
