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
  type RiveFile,
  type ViewModelInstance,
} from '@rive-app/react-native';

import type { LiftStageProps } from '../lift/LiftStage';
import { liftPresentation } from '../game/liftPresentation';
import {
  ATHLETE_PLATE_SLOT,
  ATHLETE_PLATES_LIST,
  applyAthletePlatesList,
  PLATE_SLOT_ON,
  PLATE_SLOT_SIZE,
  type PlatesListLike,
} from '../art/athletePlatesList';
import { athleteRigInputsFrom, rigInputValues, type AthleteRigInputs } from '../art/athleteRig';
import { priorFromHistory } from './athleteStagePrior';
import type { AthleteStageComponent } from './athleteStageTypes';
import { ATHLETE_RIV_ASSET } from './athleteAsset';

type NativePlateSlot = {
  booleanProperty: (name: string) => { set: (value: boolean) => void } | undefined;
  numberProperty: (name: string) => { set: (value: number) => void } | undefined;
};

/**
 * Mint a blank PlateSlot for List.addInstance.
 *
 * Pinned `@rive-app/react-native@0.4.20` declares BOTH:
 * - `ViewModel.createInstance()` — sync blank instance (deprecated in typings)
 * - `ViewModel.createBlankInstanceAsync()` — preferred in current RN docs
 *
 * Official docs (`runtimes/react-native/data-binding` Lists) show the async
 * path. This stage writes once per tick synchronously, so the sync blank
 * factory is the API that matches the write surface. Fail closed when the
 * ViewModel is missing or `modelName` is not PlateSlot.
 */
function createPlateSlot(file: RiveFile | null): unknown | null {
  const model = file?.viewModelByName(ATHLETE_PLATE_SLOT);
  if (model === undefined) return null;
  if (model.modelName !== ATHLETE_PLATE_SLOT) return null;
  return model.createInstance() ?? null;
}

function writeInputs(file: RiveFile | null, instance: ViewModelInstance, inputs: AthleteRigInputs): void {
  const list = instance.listProperty(ATHLETE_PLATES_LIST) as PlatesListLike | null | undefined;
  const plates = applyAthletePlatesList(list, () => createPlateSlot(file), inputs.plates, {
    viewModelName: (item) => {
      const slot = item as NativePlateSlot;
      // Native ViewModelInstance exposes `instanceName`, not the ViewModel
      // type. Fail closed unless both PlateSlot fields are present and
      // writable — a missing property is not a PlateSlot.
      if (typeof slot.booleanProperty !== 'function' || typeof slot.numberProperty !== 'function') {
        return null;
      }
      if (!slot.booleanProperty(PLATE_SLOT_ON) || !slot.numberProperty(PLATE_SLOT_SIZE)) {
        return null;
      }
      return ATHLETE_PLATE_SLOT;
    },
    writeOn: (item, value) => {
      const prop = (item as NativePlateSlot).booleanProperty(PLATE_SLOT_ON);
      if (!prop) return false;
      prop.set(value);
      return true;
    },
    writeSize: (item, value) => {
      const prop = (item as NativePlateSlot).numberProperty(PLATE_SLOT_SIZE);
      if (!prop) return false;
      prop.set(value);
      return true;
    },
  });
  if (!plates.ok) {
    throw new Error(`athlete plates List write failed: ${plates.reason ?? 'unknown'}`);
  }

  for (const input of rigInputValues(inputs)) {
    if (input.path.startsWith('plates/')) continue;
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
  const fileRef = useRef<RiveFile | null>(null);
  fileRef.current = riveFile ?? null;

  useEffect(() => {
    const vmi = instanceRef.current;
    if (vmi === null) return;
    writeInputs(fileRef.current, vmi, athleteRigInputsFrom(view));
  }, [view, instance, riveFile]);

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
