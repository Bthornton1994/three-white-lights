/**
 * devModeQuery — which dev surface the spike route shows. Pure; imports
 * nothing from `react-native`, so vitest drives it directly.
 *
 * The spike route — `?dev-rive-spike=1`, gated on `__DEV__` in `App.tsx`,
 * with no `resolveEntry` arm — is the ONE way into `src/dev/`. A second key
 * on the same URL picks a surface inside it:
 *
 *   ?dev-rive-spike=1                           the runtime spike (default)
 *   ?dev-rive-spike=1&dev-mode=athlete-accept   the athlete acceptance harness
 *   ?dev-rive-spike=1&dev-mode=spike-cycle      the spike, unmounting and remounting
 *                                               its stage on a timer (the host soak)
 *
 * No new `App.tsx` branch, no new query the shell could ever see, the same
 * gate: `dev-mode` alone opens nothing, because nothing reads it until the
 * spike route has already been decided by `devRouteQuery.ts`.
 */
export const DEV_MODE_QUERY_KEY = 'dev-mode';

export const DEV_MODES = Object.freeze(['athlete-accept', 'spike-cycle'] as const);
export type DevMode = (typeof DEV_MODES)[number];

/** The mode a search string or full URL asks for, or null. Exact values only. */
export function devModeRequestedBy(url: string | null | undefined): DevMode | null {
  if (url === null || url === undefined) return null;
  const q = url.indexOf('?');
  if (q < 0) return null;
  const search = url.slice(q + 1).split('#')[0] ?? '';
  const value = new URLSearchParams(search).get(DEV_MODE_QUERY_KEY);
  if (value === null) return null;
  return (DEV_MODES as readonly string[]).includes(value) ? (value as DevMode) : null;
}
