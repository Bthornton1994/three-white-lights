# `rive-spike.riv` is not a real Rive asset

This file exists only so `require('./rive-spike.riv')` resolves at Metro
bundle time — a static `require()` of a file that does not exist fails the
whole bundle, not just the component that references it. Its bytes are
deliberately invalid (not the real Rive `RIVE` magic-byte format), which
means both the native (`@rive-app/react-native`) and web (`@rive-app/canvas`)
runtimes correctly reject it at load time — measured on web as the runtime's
own `Bad header` / `The file failed to load`. The bytes also carry a NUL on
purpose: `src/licensing/realIp.ts` classifies any file with a NUL byte as
binary and keeps it out of its text-extension census, which is exactly how a
real `.riv` (a binary) reads — so swapping in a real asset later changes
nothing in that census either way.

**Why a real one isn't here instead.** This environment's outbound network is
allowlisted to package registries and the source host only under
organization policy. `cdn.rive.app` — the source of Rive's own
published demo assets, including the one their README uses as an example —
is not reachable (measured: `CONNECT tunnel failed, response 403`). No
npm-published Rive package (`@rive-app/react-native`, `@rive-app/canvas`,
`@rive-app/react-canvas`, the legacy `rive-react-native`, `rive-canvas`,
`@remotion/rive`) bundles a redistributable `.riv` in its published tarball
(checked directly: zero `.riv` files across all of them). Nothing in this
sandbox can author a real one — that needs the Rive editor, per
`docs/design/ATHLETE-ASSET-PIPELINE.md`.

**What this placeholder DOES let the spike prove, honestly:** the package
installs and resolves against this repo's exact dependency versions; the
`.riv` Metro asset extension and `require()` path work end to end; the
native/web hook wiring for a ViewModel binding compiles and mounts; the
error-handling path — one of the ruling's explicit verification targets — is
real, caught, and displayed rather than crashing the app.

**What it does NOT prove:** that anything actually renders, that a real
ViewModel's numeric properties actually update on screen, frame pacing, or
memory behavior under sustained real animation. Those need a real `.riv` —
drop one at this same path (`assets/dev/rive-spike.riv`) with a ViewModel
exposing `repProgress` / `barHeight` / `barVelocity` / `strain` /
`grindIntensity` number properties, and nothing else in the spike changes.
