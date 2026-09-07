/**
 * athleteStageTypes — the outer contract the two platform stages share.
 *
 * The production athlete stage takes the same `LiftStageProps` every other
 * stage takes (`state`, `history`, `totalKg`), so `TrainingLiftStage.tsx` can
 * swap to it with one line once a `.riv` exists. It calls
 * `liftPresentation(state, totalKg, prior)` with `prior` taken from `history`
 * — the previous tick, or `null` on the first — and hands the result to
 * `athleteRigInputsFrom`. That is all the stage does; the rig does the rest.
 */
import type React from 'react';

import type { LiftStageProps } from '../lift/LiftStage';

export type AthleteStageComponent = (props: LiftStageProps) => React.ReactElement;
