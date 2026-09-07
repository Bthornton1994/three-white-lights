/**
 * RiveSpikeStage.web — the web half of the runtime spike.
 *
 * `@rive-app/react-canvas` (wrapping `@rive-app/canvas`) is the WEB-side of
 * the same ViewModel/data-binding concept the native Nitro runtime exposes —
 * but a DIFFERENT API shape, measured directly from both packages' type
 * definitions rather than assumed: native is
 * `instance.numberProperty(path).set(value)`, synchronous, off a Nitro
 * HybridObject; web is `useViewModelInstanceNumber(path, instance)` returning
 * a `{value, setValue}` pair, `setValue` itself synchronous. The hook NAMES
 * differ (`useRiveNumber` vs `useViewModelInstanceNumber`) but the call
 * shape — path plus instance in, a setter out — is close enough that a
 * shared caller only needs a five-line per-platform hook alias, not a
 * translation layer. That is the ADR §4a "how much adapter code" answer,
 * measured rather than guessed.
 *
 * `SPIKE_SIGNAL_FIELDS` has five entries, fixed at compile time, so five
 * fixed hook calls below — not a loop — satisfies the rules of hooks exactly.
 */
import React, { useEffect, useState } from 'react';
import { Asset } from 'expo-asset';
import {
  RuntimeLoader,
  useRive,
  useViewModel,
  useViewModelInstance,
  useViewModelInstanceNumber,
} from '@rive-app/react-canvas';

import { spikeSignalAt } from './spikeSignal';
import { SPIKE_STAGE } from './spikeTuning';
import type { RiveSpikeStageComponent, RiveSpikeStageProps } from './riveSpikeTypes';

// A STRING LITERAL, NOT THE CONSTANT `riveSpikeTypes.ts` DOCUMENTS — Metro
// collects dependencies statically and refuses `require(someVariable)`.
//
// `expo-asset`, NOT `Image.resolveAssetSource`. The native hook resolves a
// `require()`d asset id through `Image.resolveAssetSource` internally, but
// `react-native-web`'s `Image` has no such static — measured: the first
// bundle that built threw `Image.default.resolveAssetSource is not a
// function` at runtime. `Asset.fromModule(id).uri` is the cross-platform
// answer and is already a dependency of this app.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const SPIKE_ASSET_SRC = Asset.fromModule(require('../../../assets/dev/rive-spike.riv')).uri;

// THE ENGINE IS SELF-HOSTED, NOT FETCHED FROM A CDN. `@rive-app/canvas`'s
// default is to pull `rive.wasm` from unpkg (fallback: jsdelivr) at runtime.
// Two reasons that is wrong here, one local and one permanent: this
// environment's egress policy blocks both hosts (the first probe of this spike
// measured the runtime never initialising), and GDD §10.0's beta is a PWA,
// which must not depend on a third-party CDN being reachable to draw its
// athlete. Skia already has the same rule (`tools/dev-web.sh` self-hosts
// `canvaskit.wasm`). `metro.config.js` registers `wasm` as an asset extension
// so the package's own binary is served by the bundler; the fallback is
// disabled so a failure to load is reported as one, not retried against a
// second blocked host.
// eslint-disable-next-line @typescript-eslint/no-require-imports
RuntimeLoader.setWasmUrl(Asset.fromModule(require('@rive-app/canvas/rive.wasm')).uri);
RuntimeLoader.setWasmFallbackUrl(null);


export function RiveSpikeStage({ onStatus }: RiveSpikeStageProps): React.ReactElement {
  const [loadError, setLoadError] = useState<string | null>(null);
  const { rive, RiveComponent } = useRive({
    src: SPIKE_ASSET_SRC,
    autoplay: true,
    onLoadError: (event) => setLoadError(describeRiveEvent(event)),
  });
  const viewModel = useViewModel(rive, { useDefault: true });
  const instance = useViewModelInstance(viewModel, { useDefault: true, rive });

  const repProgress = useViewModelInstanceNumber('repProgress', instance);
  const barHeight = useViewModelInstanceNumber('barHeight', instance);
  const barVelocity = useViewModelInstanceNumber('barVelocity', instance);
  const strain = useViewModelInstanceNumber('strain', instance);
  const grindIntensity = useViewModelInstanceNumber('grindIntensity', instance);

  useEffect(() => {
    if (loadError) {
      onStatus({ phase: 'error', message: `load: ${loadError}` });
      return;
    }
    if (!rive) {
      onStatus({ phase: 'loading' });
      return;
    }
    if (!instance) {
      // A malformed/placeholder file can resolve `rive` (a valid-enough
      // container) without ever producing a ViewModel instance — this IS the
      // error path this spike's placeholder asset exercises.
      onStatus({ phase: 'error', message: 'no ViewModel instance on this file' });
      return;
    }
    onStatus({ phase: 'bound' });
  }, [loadError, rive, instance, onStatus]);

  useEffect(() => {
    const id = setInterval(() => {
      const frame = spikeSignalAt(Date.now());
      repProgress.setValue(frame.repProgress);
      barHeight.setValue(frame.barHeight);
      barVelocity.setValue(frame.barVelocity);
      strain.setValue(frame.strain);
      grindIntensity.setValue(frame.grindIntensity);
    }, SPIKE_STAGE.FRAME_INTERVAL_MS);
    return () => clearInterval(id);
  }, [repProgress, barHeight, barVelocity, strain, grindIntensity]);

  return <RiveComponent style={{ width: '100%', height: SPIKE_STAGE.HEIGHT }} />;
}

// Pins this implementation to the signature `RiveSpikeStage.d.ts` declares.
const _satisfiesSharedSignature: RiveSpikeStageComponent = RiveSpikeStage;
void _satisfiesSharedSignature;

/**
 * `@rive-app/canvas` emits `onLoadError` with an `Event`-shaped object
 * (`{ type, data }`), not an `Error`. The first probe of this spike showed
 * `[object Object]` on the status line while the console carried the real
 * messages (`Bad header`, `The file failed to load`), so this reads the
 * event's fields rather than stringifying the object.
 */
function describeRiveEvent(event: unknown): string {
  if (event instanceof Error) return event.message;
  if (typeof event === 'object' && event !== null) {
    const e = event as { type?: unknown; data?: unknown; message?: unknown };
    const parts = [e.type, e.message, e.data]
      .filter((v) => v !== undefined && v !== null)
      .map((v) => (typeof v === 'string' ? v : JSON.stringify(v)));
    if (parts.length > 0) return parts.join(' — ');
  }
  return String(event);
}
