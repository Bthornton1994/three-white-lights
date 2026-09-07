// metro.config.js — adds `.riv` (Rive) as a Metro asset extension.
//
// Expo's default `assetExts` covers images, fonts, audio and video, but not
// Rive's binary format. Without this, `require('./athlete.riv')` fails at
// bundle time with "Unable to resolve module" rather than resolving to an
// asset id the way `require('./plate.jpg')` already does.
//
// See `docs/design/ADR-001-athlete-animation-architecture.md` §7 and
// `src/art/riv.d.ts`. This file did not exist before the Rive runtime spike —
// there was previously no reason for one, since every other asset type this
// project uses is already in Expo's default list.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// `.riv` is the athlete asset. `.wasm` is the WEB RUNTIME ENGINE: by default
// `@rive-app/canvas` fetches `rive.wasm` from unpkg / jsdelivr at runtime,
// which is blocked in this environment and is the wrong dependency for an
// offline-capable PWA (GDD §10.0) in any environment — the same reason
// `tools/dev-web.sh` self-hosts Skia's `canvaskit.wasm`. With `wasm` as an
// asset extension, `require('@rive-app/canvas/rive.wasm')` resolves to a
// Metro-served asset and `RuntimeLoader.setWasmUrl` points the engine at it.
// Measured: Expo's default `assetExts` does not include `wasm`.
config.resolver.assetExts = [...config.resolver.assetExts, 'riv', 'wasm'];

module.exports = config;
