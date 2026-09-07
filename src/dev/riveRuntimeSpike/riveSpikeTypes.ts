/**
 * riveSpikeTypes — the one thing the native and web spike stages share.
 *
 * Deliberately tiny. The native and web Rive runtimes have DIFFERENT APIs for
 * binding a ViewModel number property (see the ADR §4a "API divergence"
 * measurement) — a Nitro HybridObject with `.set()`/`.getValueAsync()` on
 * native, a `{value, setValue}` getter/setter pair on web. This module does
 * NOT paper over that with a shared binding abstraction; each stage talks to
 * its own runtime directly, in the shape that runtime actually wants. What's
 * shared is only the OUTER contract: a component that takes the spike's
 * status callback and reports back.
 */
import type React from 'react';

export type RiveSpikeStatus =
  | { readonly phase: 'loading' }
  | { readonly phase: 'error'; readonly message: string }
  | { readonly phase: 'bound' };

export interface RiveSpikeStageProps {
  /** Reports the stage's own lifecycle — load, bind, or fail. Never gameplay. */
  readonly onStatus: (status: RiveSpikeStatus) => void;
}

/**
 * The one signature both platform stages must satisfy. `RiveSpikeStage.d.ts`
 * declares it for `tsc`, and each of `RiveSpikeStage.native.tsx` /
 * `RiveSpikeStage.web.tsx` pins its own export against it — so the three
 * cannot drift apart silently.
 */
export type RiveSpikeStageComponent = (props: RiveSpikeStageProps) => React.ReactElement;

/**
 * `assets/dev/rive-spike.riv` is a DELIBERATELY INVALID placeholder, not a
 * real Rive asset — see `assets/dev/rive-spike.riv.README.md` for exactly
 * why (network-blocked in this environment, and no npm package ships a
 * redistributable one to fall back on). A developer with Rive editor access
 * who wants to actually SEE something render replaces those bytes with a
 * real `.riv` at this same path and NEITHER stage's code changes: native
 * resolves it through `require()` (an asset id, per `src/art/riv.d.ts`), web
 * resolves the same `require()` through `Image.resolveAssetSource` to a
 * fetchable URL.
 *
 * DOCUMENTATION, NOT THE `require()` ARGUMENT. Both stages spell the path out
 * as a string literal, because Metro collects dependencies statically and
 * refuses `require(someVariable)` at bundle time — the first probe of this
 * spike timed out on exactly that. This constant exists so the location is
 * written down once; `riveSpikeTypes.test.ts` pins that both stages still
 * require this same path.
 */
export const SPIKE_RIV_ASSET_RELATIVE_PATH = '../../../assets/dev/rive-spike.riv';
