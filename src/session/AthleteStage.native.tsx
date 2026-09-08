/**
 * AthleteStage.native — the production athlete on `@rive-app/react-native`.
 *
 * NOT MOUNTED ANYWHERE YET, and that is deliberate: no production `.riv`
 * exists (`docs/design/ATHLETE-ASSET-PIPELINE.md` §2), and the standing rule
 * is no placeholder athlete. `TrainingLiftStage.tsx` still mounts the rejected
 * schematic for squat. The swap, when the asset lands, is one line there:
 * `return <AthleteStage {...props} />;` in place of `<SquatScene {...props} />`.
 *
 * What this file does is the whole of the stage's job: take the same props
 * every stage takes, call the frozen contract with the TRUE `prior`, hand the
 * result to `athleteRigInputsFrom`, and write each entry of `rigInputValues`
 * into the rig's ViewModel with the synchronous `.set()` — one write per
 * input per tick, no promise per frame. It reads no `LiftState` field itself,
 * and it names no path: the list it writes is the list the `.riv` is checked
 * against (`src/art/rivContract.ts`), so the two cannot drift.
 *
 * Mirrors `src/dev/riveRuntimeSpike/RiveSpikeStage.native.tsx`, which is the
 * measured proof that this shape mounts, loads, binds and fails cleanly.
 */
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import {
  RiveView,
  useRiveFile,
  useViewModelInstance,
  type ViewModelInstance,
} from '@rive-app/react-native';

import type { LiftStageProps } from '../lift/LiftStage';
import { liftPresentation } from '../game/liftPresentation';
import { athleteRigInputsFrom, rigInputValues, type AthleteRigInputs } from '../art/athleteRig';
import { priorFromHistory } from './athleteStagePrior';
import type { AthleteStageComponent } from './athleteStageTypes';
import { ATHLETE_RIV_ASSET } from './athleteAsset';

function writeInputs(instance: ViewModelInstance, inputs: AthleteRigInputs): void {
  for (const input of rigInputValues(inputs)) {
    switch (input.type) {
      case 'number':
        instance.numberProperty(input.path)?.set(input.value);
        break;
      case 'boolean':
        instance.booleanProperty(input.path)?.set(input.value);
        break;
      case 'enum':
        instance.enumProperty(input.path)?.set(input.value);
        break;
    }
  }
}

export const AthleteStage: AthleteStageComponent = ({ state, history, totalKg }: LiftStageProps) => {
  const { riveFile } = useRiveFile(ATHLETE_RIV_ASSET);
  const { instance } = useViewModelInstance(riveFile, { async: true });
  const instanceRef = useRef<ViewModelInstance | null>(null);
  instanceRef.current = instance ?? null;

  useEffect(() => {
    const vmi = instanceRef.current;
    if (vmi === null) return;
    const view = liftPresentation(state, totalKg, priorFromHistory(history, state));
    writeInputs(vmi, athleteRigInputsFrom(view));
  }, [state, history, totalKg]);

  if (!riveFile) return <View style={{ flex: 1, alignSelf: 'stretch' }} />;
  return (
    <RiveView
      file={riveFile}
      dataBind={instance ?? undefined}
      autoPlay={true}
      onError={() => undefined}
      style={{ flex: 1, alignSelf: 'stretch' }}
    />
  );
};
