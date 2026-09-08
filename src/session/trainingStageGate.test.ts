/**
 * The player-path gate for the athlete stage — intake step 8 of
 * `docs/design/ATHLETE-ASSET-PIPELINE.md` §12a.
 *
 * The gate is one tuning value. This file pins it CLOSED until a human has
 * graded the athlete asset, and pins that the closed gate still carries a
 * real, lazily loaded athlete arm — so the flip is a value change in the
 * commit that records the grade, not a rewrite of the stage.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { ATHLETE_RIG } from '../art/spriteTuning';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const stage = readFileSync(path.join(HERE, 'TrainingLiftStage.tsx'), 'utf8');

describe('the training-stage gate', () => {
  it('is closed — no athlete asset has passed intake, no human has graded one', () => {
    expect(ATHLETE_RIG.TRAINING_STAGE).toBe('schematic');
  });

  it('still has the athlete arm, keyed on the one value, so the flip is a value not a rewrite', () => {
    expect(stage).toContain("ATHLETE_RIG.TRAINING_STAGE === 'athlete'");
    expect(stage).toContain('<AthleteStageLazy');
    expect(stage).toContain('<SquatScene');
  });

  it('loads the athlete stage dynamically, so the Rive runtime is not on the player bundle while closed', () => {
    expect(stage).toMatch(/import\('\.\/AthleteStage'\)/);
    expect(stage, 'a static import would bundle the runtime for nothing').not.toMatch(
      /^import .*AthleteStage/m,
    );
  });
});
