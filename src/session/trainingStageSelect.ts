/**
 * trainingStageSelect — which arm the training stage draws, as a pure
 * decision, so the production gate, the dev-only owner-playtest override
 * and the fail-closed rule are tested exhaustively without React.
 *
 *   still-plate            every lift but squat (the Iron & Amber stills)
 *   schematic              squat, gate closed — the rejected debug drawing
 *   athlete                squat, athlete arm selected, a REAL asset present
 *   athlete-asset-missing  squat, athlete arm selected, no real asset —
 *                          an explicit panel; NEVER the schematic (the
 *                          rejected drawing is not a fallback), never a
 *                          diagnostic file promoted to the athlete
 *
 * `override` is the dev-only context (`athleteStageOverride.ts`), `null` in
 * production, so `override ?? gate` is the gate on every player path.
 */
import type { TrainingStageKind } from '../art/spriteTuning';
import type { LiftStageProps } from '../lift/LiftStage';

export type TrainingStageArm = 'still-plate' | 'schematic' | 'athlete' | 'athlete-asset-missing';

export interface TrainingStageSelection {
  readonly kind: LiftStageProps['state']['config']['kind'];
  /** `ATHLETE_RIG.TRAINING_STAGE` — the production gate. */
  readonly gate: TrainingStageKind;
  /** The dev-only override; `null` everywhere a player can reach. */
  readonly override: TrainingStageKind | null;
  /** `ATHLETE_RIV_IS_PLACEHOLDER` — true until `assets/athlete/athlete-01.riv` has passed intake. */
  readonly athleteAssetIsPlaceholder: boolean;
}

export function selectTrainingStageArm(selection: TrainingStageSelection): TrainingStageArm {
  if (selection.kind !== 'squat') return 'still-plate';
  const stage = selection.override ?? selection.gate;
  if (stage === 'schematic') return 'schematic';
  return selection.athleteAssetIsPlaceholder ? 'athlete-asset-missing' : 'athlete';
}
