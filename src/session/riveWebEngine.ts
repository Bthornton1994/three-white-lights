/**
 * riveWebEngine — the web engine is SELF-HOSTED, and this is the one place
 * that says so.
 *
 * `@rive-app/canvas`'s default is to fetch `rive.wasm` from a public CDN at
 * runtime, with a second CDN as fallback. Two reasons that is wrong here, one
 * local and one permanent: this environment's egress policy blocks both hosts
 * (the runtime spike's first probe measured the engine never initialising),
 * and GDD §10.0's beta is a PWA, which must not depend on a third-party CDN
 * being reachable to draw its athlete. Skia already follows the same rule
 * (`tools/dev-web.sh` self-hosts `canvaskit.wasm`). `metro.config.js`
 * registers `wasm` as an asset extension, so the package's own binary is
 * served by the bundler; the fallback is disabled so a failure to load is
 * reported as one rather than retried against a second blocked host.
 *
 * Imported only by `.web.tsx` files. It imports the web runtime, so a native
 * bundle never reaches it — Metro resolves the `.native.tsx` sibling instead.
 * `tools/rivSchema.mjs` applies the same rule in Node with a `data:` URL.
 */
import { Asset } from 'expo-asset';
import { RuntimeLoader } from '@rive-app/react-canvas';

let hosted = false;

/** Point the engine at the Metro-served wasm. Idempotent; safe at module load. */
export function selfHostRiveEngine(): void {
  if (hosted) return;
  hosted = true;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  RuntimeLoader.setWasmUrl(Asset.fromModule(require('@rive-app/canvas/rive.wasm')).uri);
  RuntimeLoader.setWasmFallbackUrl(null);
}

/**
 * The fetchable URL of a `require()`d `.riv`. `expo-asset`, NOT
 * `Image.resolveAssetSource`: `react-native-web`'s `Image` has no such
 * static — measured on the runtime spike, where the first bundle that built
 * threw `Image.default.resolveAssetSource is not a function` at runtime.
 */
export function riveAssetUri(assetId: number): string {
  return Asset.fromModule(assetId).uri;
}
