/**
 * RiveSpikeStage.native — the native half of the runtime spike.
 *
 * Wires `@rive-app/react-native` (the modern, Nitro-based runtime — see
 * ADR-001 §4a) to `spikeSignal.ts`'s synthetic values via
 * `ViewModelNumberProperty.set()`, the Nitro package's SYNCHRONOUS write
 * (fire-and-forget through JSI, no promise per frame) — the shape a 60fps
 * write loop actually wants. `setValueAsync` exists and is NOT used here for
 * that reason.
 *
 * `file` is a REQUIRED, non-nullable prop on `RiveView` — this component does
 * not mount it at all until `useRiveFile` has actually resolved one. The
 * asset is real (`riveSpikeTypes.ts`); a load failure is still reported
 * through `onStatus` rather than crashing the screen. Not executed here —
 * no native toolchain — see ADR-001 §7.
 */
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';

import {
  RiveView,
  useRiveFile,
  useViewModelInstance,
  type ViewModelNumberProperty,
} from '@rive-app/react-native';

import { spikeSignalAt } from './spikeSignal';
import { SPIKE_STAGE } from './spikeTuning';
import {
  SPIKE_BOUND_PROPERTY,
  SPIKE_STATE_MACHINE,
  type RiveSpikeStageComponent,
  type RiveSpikeStageProps,
} from './riveSpikeTypes';

// A STRING LITERAL, NOT THE CONSTANT `riveSpikeTypes.ts` DOCUMENTS. Metro
// collects dependencies statically and refuses `require(someVariable)` at
// bundle time, so the path is spelled out here and the constant is kept as
// the documented home of "where a real .riv goes".
// eslint-disable-next-line @typescript-eslint/no-require-imports
const SPIKE_ASSET = require('../../../assets/dev/quick_start.riv');


export function RiveSpikeStage({ onStatus }: RiveSpikeStageProps): React.ReactElement {
  const { riveFile, error: fileError } = useRiveFile(SPIKE_ASSET);
  const { instance, isLoading, error: instanceError } = useViewModelInstance(
    riveFile,
    { async: true },
  );
  const healthRef = useRef<ViewModelNumberProperty | null>(null);

  useEffect(() => {
    if (fileError) {
      onStatus({ phase: 'error', message: `file: ${fileError.message}` });
      return;
    }
    if (instanceError) {
      onStatus({ phase: 'error', message: `instance: ${instanceError.message}` });
      return;
    }
    if (isLoading || !instance) {
      onStatus({ phase: 'loading' });
      return;
    }
    healthRef.current = instance.numberProperty(SPIKE_BOUND_PROPERTY) ?? null;
    onStatus({ phase: 'bound' });
  }, [fileError, instanceError, isLoading, instance, onStatus]);

  useEffect(() => {
    const id = setInterval(() => {
      const frame = spikeSignalAt(Date.now());
      healthRef.current?.set(frame.barHeight * SPIKE_STAGE.HEALTH_SPAN);
    }, SPIKE_STAGE.FRAME_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  if (!riveFile) {
    // Loading, or `fileError` set — either way there is no `RiveFile` to
    // hand `RiveView`, whose `file` prop is required and non-nullable.
    return <View style={{ width: '100%', height: SPIKE_STAGE.HEIGHT }} />;
  }

  return (
    <RiveView
      file={riveFile}
      stateMachineName={SPIKE_STATE_MACHINE}
      dataBind={instance ?? undefined}
      autoPlay={true}
      onError={(e) => onStatus({ phase: 'error', message: `view: ${e.message}` })}
      style={{ width: '100%', height: SPIKE_STAGE.HEIGHT }}
    />
  );
}

// Pins this implementation to the signature `RiveSpikeStage.d.ts` declares.
const _satisfiesSharedSignature: RiveSpikeStageComponent = RiveSpikeStage;
void _satisfiesSharedSignature;
