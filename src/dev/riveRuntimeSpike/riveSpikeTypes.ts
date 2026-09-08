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
 * `assets/dev/quick_start.riv` is a REAL Rive asset — the vendor's own
 * quick-start health bar, MIT, provenance and licence text in
 * `assets/dev/THIRD-PARTY-RIVE-ASSETS.md`. It is not an athlete and is never
 * presented as one; it is what turns this spike from "compiles, mounts, fails
 * cleanly" into "draws, and moves under a 60 Hz ViewModel write". The
 * deliberately invalid `rive-spike.riv` stays beside it as the error-path
 * fixture `tools/rivSchema.mjs` and `src/art/rivContract.test.ts` refuse.
 *
 * DOCUMENTATION, NOT THE `require()` ARGUMENT. Both stages spell the path out
 * as a string literal, because Metro collects dependencies statically and
 * refuses `require(someVariable)` at bundle time — the first probe of this
 * spike timed out on exactly that. This constant exists so the location is
 * written down once; `riveSpikeTypes.test.ts` pins that both stages still
 * require this same path, and that the bytes there are a real `.riv` whose
 * hash the provenance file names.
 */
export const SPIKE_RIV_ASSET_RELATIVE_PATH = '../../../assets/dev/quick_start.riv';

/**
 * The one ViewModel number the asset exposes (`tools/rivSchema.mjs` reads it:
 * `health_bar_01.health`). The synthetic feed's `barHeight` is written here,
 * scaled by `SPIKE_STAGE.HEALTH_SPAN`; the feed's other four fields have no
 * home on this file and are computed, not written — the shape of a real
 * multi-field tick is still exercised, the count of writes per frame is not.
 */
export const SPIKE_BOUND_PROPERTY = 'health';
