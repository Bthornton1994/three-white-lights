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
 * The asset is real (`riveSpikeTypes.ts`), so the write is to a property
 * that exists — `SPIKE_BOUND_PROPERTY` — and the health bar it drives is
 * the thing the probe photographs moving.
 */
import React, { useEffect, useState } from 'react';
import {
  useRive,
  useViewModel,
  useViewModelInstance,
  useViewModelInstanceNumber,
} from '@rive-app/react-canvas';

import { riveAssetUri, selfHostRiveEngine } from '../../session/riveWebEngine';
import { spikeSignalAt } from './spikeSignal';
import { SPIKE_STAGE } from './spikeTuning';
import { SPIKE_BOUND_PROPERTY, type RiveSpikeStageComponent, type RiveSpikeStageProps } from './riveSpikeTypes';

// A STRING LITERAL, NOT THE CONSTANT `riveSpikeTypes.ts` DOCUMENTS — Metro
// collects dependencies statically and refuses `require(someVariable)`.
// `riveWebEngine.ts` resolves it through `expo-asset` (react-native-web has
// no `Image.resolveAssetSource`) and self-hosts the engine's wasm — both
// measured on earlier probes of this spike.
selfHostRiveEngine();
// eslint-disable-next-line @typescript-eslint/no-require-imports
const SPIKE_ASSET_SRC = riveAssetUri(require('../../../assets/dev/quick_start.riv'));

export function RiveSpikeStage({ onStatus }: RiveSpikeStageProps): React.ReactElement {
  const [loadError, setLoadError] = useState<string | null>(null);
  const { rive, RiveComponent } = useRive({
    src: SPIKE_ASSET_SRC,
    autoplay: true,
    onLoadError: (event) => setLoadError(describeRiveEvent(event)),
  });
  const viewModel = useViewModel(rive, { useDefault: true });
  const instance = useViewModelInstance(viewModel, { useDefault: true, rive });
  const health = useViewModelInstanceNumber(SPIKE_BOUND_PROPERTY, instance);

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
      // A malformed file can resolve `rive` (a valid-enough container)
      // without ever producing a ViewModel instance — the error path the
      // deliberately invalid placeholder used to exercise here.
      onStatus({ phase: 'error', message: 'no ViewModel instance on this file' });
      return;
    }
    onStatus({ phase: 'bound' });
  }, [loadError, rive, instance, onStatus]);

  useEffect(() => {
    const id = setInterval(() => {
      const frame = spikeSignalAt(Date.now());
      health.setValue(frame.barHeight * SPIKE_STAGE.HEALTH_SPAN);
    }, SPIKE_STAGE.FRAME_INTERVAL_MS);
    return () => clearInterval(id);
  }, [health]);

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
