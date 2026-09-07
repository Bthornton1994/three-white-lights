/**
 * AthleteStage.web — the production athlete on `@rive-app/react-canvas`.
 *
 * Same job and same non-mount status as `AthleteStage.native.tsx`; see that
 * file's header. The web runtime's binding API differs in shape (a
 * `ViewModelInstanceNumber` with a `.value` setter rather than a Nitro
 * `numberProperty(...).set(...)`), which is the whole reason there are two
 * files — measured in ADR-001 §4a, mirrored from the spike's web stage.
 */
import React, { useEffect, useRef } from 'react';
import { Image } from 'react-native';
import {
  useRive,
  useViewModel,
  useViewModelInstance,
  type ViewModelInstance,
} from '@rive-app/react-canvas';

import type { LiftStageProps } from '../lift/LiftStage';
import { liftPresentation } from '../game/liftPresentation';
import { athleteRigInputsFrom, type AthleteRigInputs } from '../art/athleteRig';
import { ATHLETE_RIG } from '../art/spriteTuning';
import { priorFromHistory } from './athleteStagePrior';
import type { AthleteStageComponent } from './athleteStageTypes';
import { ATHLETE_RIV_ASSET } from './athleteAsset';

const ATHLETE_SRC = Image.resolveAssetSource(ATHLETE_RIV_ASSET).uri;

function setNumber(vmi: ViewModelInstance, path: string, value: number): void {
  const prop = vmi.number(path);
  if (prop) prop.value = value;
}
function setBoolean(vmi: ViewModelInstance, path: string, value: boolean): void {
  const prop = vmi.boolean(path);
  if (prop) prop.value = value;
}
function setEnum(vmi: ViewModelInstance, path: string, value: string): void {
  const prop = vmi.enum(path);
  if (prop) prop.value = value;
}

function writeInputs(vmi: ViewModelInstance, inputs: AthleteRigInputs): void {
  setEnum(vmi, 'lift', inputs.lift);
  setEnum(vmi, 'phase', inputs.phase);
  setNumber(vmi, 'barHeight', inputs.barHeight);
  setNumber(vmi, 'barVelocity', inputs.barVelocity);
  setBoolean(vmi, 'motionSampleValid', inputs.motionSampleValid);
  setNumber(vmi, 'integratorVelocity', inputs.integratorVelocity);
  setNumber(vmi, 'strain', inputs.strain);
  setNumber(vmi, 'grindIntensity', inputs.grindIntensity);
  setEnum(vmi, 'effortBand', inputs.effortBand);
  setNumber(vmi, 'barTiltDeg', inputs.barTiltDeg);
  setNumber(vmi, 'barForwardPx', inputs.barForwardPx);
  setNumber(vmi, 'barLateralPx', inputs.barLateralPx);
  setNumber(vmi, 'barBendPx', inputs.barBendPx);
  setNumber(vmi, 'commandGlow', inputs.commandGlow);
  setBoolean(vmi, 'held', inputs.held);
  setBoolean(vmi, 'pressCommandLive', inputs.pressCommandLive);
  setBoolean(vmi, 'lockoutHoldLive', inputs.lockoutHoldLive);
  setNumber(vmi, 'chalk', inputs.chalk);
  setBoolean(vmi, 'depthAchieved', inputs.depthAchieved);
  setBoolean(vmi, 'lockedOut', inputs.lockedOut);
  setBoolean(vmi, 'complete', inputs.complete);
  setEnum(vmi, 'outcome', inputs.outcome);
  setEnum(vmi, 'missReason', inputs.missReason);
  setNumber(vmi, 'totalKg', inputs.totalKg);
  setNumber(vmi, 'platesOverflow', inputs.platesOverflow);
  setNumber(vmi, 'seed', inputs.seed);
  for (let i = 0; i < ATHLETE_RIG.PLATE_SLOTS_PER_SIDE; i += 1) {
    const slot = inputs.plates[i];
    if (slot === undefined) break;
    setBoolean(vmi, `plates/${i}/on`, slot.on);
    setNumber(vmi, `plates/${i}/size`, slot.size);
  }
}

export const AthleteStage: AthleteStageComponent = ({ state, history, totalKg }: LiftStageProps) => {
  const { rive, RiveComponent } = useRive({ src: ATHLETE_SRC, autoplay: true });
  const viewModel = useViewModel(rive, { useDefault: true });
  const instance = useViewModelInstance(viewModel, { useDefault: true, rive });
  const instanceRef = useRef<ViewModelInstance | null>(null);
  instanceRef.current = instance;

  useEffect(() => {
    const vmi = instanceRef.current;
    if (vmi === null) return;
    const view = liftPresentation(state, totalKg, priorFromHistory(history, state));
    writeInputs(vmi, athleteRigInputsFrom(view));
  }, [state, history, totalKg]);

  return <RiveComponent style={{ flex: 1, alignSelf: 'stretch' }} />;
};
