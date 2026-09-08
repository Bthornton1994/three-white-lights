/**
 * AthleteStage.web — the production athlete on `@rive-app/react-canvas`.
 *
 * Same job and same non-mount status as `AthleteStage.native.tsx`; see that
 * file's header. The web runtime's binding API differs in shape (a
 * `ViewModelInstanceNumber` with a `.value` setter rather than a Nitro
 * `numberProperty(...).set(...)`), which is the whole reason there are two
 * files — measured in ADR-001 §4a, mirrored from the spike's web stage. Like
 * the native stage it names no path: it loops `rigInputValues`, the one list
 * the `.riv` is also checked against.
 *
 * The engine is self-hosted and the asset URI is resolved through
 * `expo-asset`, both via `riveWebEngine.ts` — the two web-only facts the
 * runtime spike measured (a blocked CDN, and `react-native-web` having no
 * `Image.resolveAssetSource`).
 */
import React, { useEffect, useRef } from 'react';
import {
  useRive,
  useViewModel,
  useViewModelInstance,
  type ViewModelInstance,
} from '@rive-app/react-canvas';

import type { LiftStageProps } from '../lift/LiftStage';
import { liftPresentation } from '../game/liftPresentation';
import { athleteRigInputsFrom, rigInputValues, type AthleteRigInputs } from '../art/athleteRig';
import { priorFromHistory } from './athleteStagePrior';
import type { AthleteStageComponent } from './athleteStageTypes';
import { ATHLETE_RIV_ASSET } from './athleteAsset';
import { riveAssetUri, selfHostRiveEngine } from './riveWebEngine';

selfHostRiveEngine();
const ATHLETE_SRC = riveAssetUri(ATHLETE_RIV_ASSET);

function writeInputs(vmi: ViewModelInstance, inputs: AthleteRigInputs): void {
  for (const input of rigInputValues(inputs)) {
    switch (input.type) {
      case 'number': {
        const prop = vmi.number(input.path);
        if (prop) prop.value = input.value;
        break;
      }
      case 'boolean': {
        const prop = vmi.boolean(input.path);
        if (prop) prop.value = input.value;
        break;
      }
      case 'enum': {
        const prop = vmi.enum(input.path);
        if (prop) prop.value = input.value;
        break;
      }
    }
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
