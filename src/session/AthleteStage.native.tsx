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
import React, { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import {
  RiveView,
  useRiveFile,
  useViewModelInstance,
  type ViewModelInstance,
} from '@rive-app/react-native';

import type { LiftStageProps } from '../lift/LiftStage';
import { liftPresentation } from '../game/liftPresentation';
import {
  ATHLETE_PLATES_LIST,
  normalizePlatesListLength,
  parsePlatePath,
  platesListItemAt,
  PLATE_SLOT_ON,
  PLATE_SLOT_SIZE,
  type PlatesListLike,
} from '../art/athletePlatesList';
import { athleteRigInputsFrom, rigInputValues, type AthleteRigInputs } from '../art/athleteRig';
import { ATHLETE_RIG } from '../art/spriteTuning';
import { priorFromHistory } from './athleteStagePrior';
import type { AthleteStageComponent } from './athleteStageTypes';
import { ATHLETE_RIV_ASSET } from './athleteAsset';

type NativePlateSlot = {
  booleanProperty: (name: string) => { set: (value: boolean) => void } | undefined;
  numberProperty: (name: string) => { set: (value: number) => void } | undefined;
};

function writeInputs(instance: ViewModelInstance, inputs: AthleteRigInputs): void {
  const values = [...rigInputValues(inputs)];
  const list = instance.listProperty(ATHLETE_PLATES_LIST) as PlatesListLike | null | undefined;
  normalizePlatesListLength(list, ATHLETE_RIG.PLATE_SLOTS_PER_SIDE, () => null);

  for (const input of values) {
    const plate = parsePlatePath(input.path);
    if (plate !== null) {
      if (list == null || list.length !== ATHLETE_RIG.PLATE_SLOTS_PER_SIDE) continue;
      const item = platesListItemAt(list, plate.index) as NativePlateSlot | undefined;
      if (item == null) continue;
      if (plate.field === 'on' && input.type === 'boolean') {
        item.booleanProperty(PLATE_SLOT_ON)?.set(input.value);
      } else if (plate.field === 'size' && input.type === 'number') {
        item.numberProperty(PLATE_SLOT_SIZE)?.set(input.value);
      }
      continue;
    }
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
  // The contract tick, taken in render — `kind` selects the artboard, the
  // state machine, and (through `artboardName`) which default ViewModel the
  // instance is created from. See the web stage's header for why the state
  // machine must be named.
  const view = useMemo(
    () => liftPresentation(state, totalKg, priorFromHistory(history, state)),
    [state, history, totalKg],
  );
  const { riveFile } = useRiveFile(ATHLETE_RIV_ASSET);
  const { instance } = useViewModelInstance(riveFile, { artboardName: view.kind, async: true });
  const instanceRef = useRef<ViewModelInstance | null>(null);
  instanceRef.current = instance ?? null;

  useEffect(() => {
    const vmi = instanceRef.current;
    if (vmi === null) return;
    writeInputs(vmi, athleteRigInputsFrom(view));
  }, [view, instance]);

  if (!riveFile) return <View style={{ flex: 1, alignSelf: 'stretch' }} />;
  return (
    <RiveView
      file={riveFile}
      artboardName={view.kind}
      stateMachineName={view.kind}
      dataBind={instance ?? undefined}
      autoPlay={true}
      onError={() => undefined}
      style={{ flex: 1, alignSelf: 'stretch' }}
    />
  );
};
