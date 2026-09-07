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
 * result to `athleteRigInputsFrom`, and write each named input into the rig's
 * ViewModel with the synchronous `.set()` — one write per input per tick, no
 * promise per frame. It reads no `LiftState` field itself.
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
import { athleteRigInputsFrom, type AthleteRigInputs } from '../art/athleteRig';
import { ATHLETE_RIG } from '../art/spriteTuning';
import { priorFromHistory } from './athleteStagePrior';
import type { AthleteStageComponent } from './athleteStageTypes';
import { ATHLETE_RIV_ASSET } from './athleteAsset';

function writeInputs(instance: ViewModelInstance, inputs: AthleteRigInputs): void {
  instance.enumProperty('lift')?.set(inputs.lift);
  instance.enumProperty('phase')?.set(inputs.phase);
  instance.numberProperty('barHeight')?.set(inputs.barHeight);
  instance.numberProperty('barVelocity')?.set(inputs.barVelocity);
  instance.booleanProperty('motionSampleValid')?.set(inputs.motionSampleValid);
  instance.numberProperty('integratorVelocity')?.set(inputs.integratorVelocity);
  instance.numberProperty('strain')?.set(inputs.strain);
  instance.numberProperty('grindIntensity')?.set(inputs.grindIntensity);
  instance.enumProperty('effortBand')?.set(inputs.effortBand);
  instance.numberProperty('barTiltDeg')?.set(inputs.barTiltDeg);
  instance.numberProperty('barForwardPx')?.set(inputs.barForwardPx);
  instance.numberProperty('barLateralPx')?.set(inputs.barLateralPx);
  instance.numberProperty('barBendPx')?.set(inputs.barBendPx);
  instance.numberProperty('commandGlow')?.set(inputs.commandGlow);
  instance.booleanProperty('held')?.set(inputs.held);
  instance.booleanProperty('pressCommandLive')?.set(inputs.pressCommandLive);
  instance.booleanProperty('lockoutHoldLive')?.set(inputs.lockoutHoldLive);
  instance.numberProperty('chalk')?.set(inputs.chalk);
  instance.booleanProperty('depthAchieved')?.set(inputs.depthAchieved);
  instance.booleanProperty('lockedOut')?.set(inputs.lockedOut);
  instance.booleanProperty('complete')?.set(inputs.complete);
  instance.enumProperty('outcome')?.set(inputs.outcome);
  instance.enumProperty('missReason')?.set(inputs.missReason);
  instance.numberProperty('totalKg')?.set(inputs.totalKg);
  instance.numberProperty('platesOverflow')?.set(inputs.platesOverflow);
  instance.numberProperty('seed')?.set(inputs.seed);
  for (let i = 0; i < ATHLETE_RIG.PLATE_SLOTS_PER_SIDE; i += 1) {
    const slot = inputs.plates[i];
    if (slot === undefined) break;
    instance.booleanProperty(`plates/${i}/on`)?.set(slot.on);
    instance.numberProperty(`plates/${i}/size`)?.set(slot.size);
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
