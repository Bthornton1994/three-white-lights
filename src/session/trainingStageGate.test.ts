/**
 * The player-path gate for the athlete stage — intake step 8 of
 * `docs/design/ATHLETE-ASSET-PIPELINE.md` §12a.
 *
 * The gate is one tuning value. This file pins it CLOSED until a human has
 * graded the athlete asset, pins that the closed gate still carries a real,
 * lazily loaded athlete arm — so the flip is a value change in the commit
 * that records the grade, not a rewrite of the stage — and pins the two
 * things added for the owner's play route: the decision is the pure
 * selector (`trainingStageSelect.ts`, tested exhaustively beside it), and
 * the only override is a React context that nothing outside `src/dev/`
 * provides, so a player can never reach the athlete arm through it.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { ATHLETE_RIG } from '../art/spriteTuning';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const stage = readFileSync(path.join(HERE, 'TrainingLiftStage.tsx'), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe('the training-stage gate', () => {
  it('is closed — no athlete asset has passed intake, no human has graded one', () => {
    expect(ATHLETE_RIG.TRAINING_STAGE).toBe('schematic');
  });

  it('decides through the pure selector, fed the gate, the override context and the asset flag — no other input', () => {
    expect(stage).toContain('selectTrainingStageArm({');
    expect(stage).toContain('gate: ATHLETE_RIG.TRAINING_STAGE,');
    expect(stage).toContain('override,');
    expect(stage).toContain('const override = useContext(AthleteStageOverrideContext);');
    expect(stage).toContain('athleteAssetIsPlaceholder: ATHLETE_RIV_IS_PLACEHOLDER,');
    // The flag comes from the require-free module, so the dev .riv never rides the player bundle.
    expect(stage).toMatch(/import \{ ATHLETE_RIV_IS_PLACEHOLDER \} from '\.\/athleteAssetStatus';/);
    expect(stage).not.toMatch(/from '\.\/athleteAsset'/);
  });

  it('still has all four arms, keyed on the selector, so the flip is a value not a rewrite', () => {
    expect(stage).toContain("case 'athlete':");
    expect(stage).toContain('<AthleteStageLazy');
    expect(stage).toContain("case 'athlete-asset-missing':");
    expect(stage).toContain('<AthleteAssetMissingPanel />');
    expect(stage).toContain("case 'schematic':");
    expect(stage).toContain('<SquatScene');
    expect(stage).toContain("case 'still-plate':");
    expect(stage).toContain('<StillPlateStage');
  });

  it('fails closed: the missing-asset arm draws a panel that names the missing file and mounts neither the schematic nor a stage', () => {
    const panel = stage.slice(stage.indexOf('function AthleteAssetMissingPanel'), stage.indexOf('export function TrainingLiftStage'));
    expect(panel).toContain('testID="athlete-asset-missing"');
    expect(panel).toContain('ATHLETE_RIG.ASSET_MISSING_PANEL.LINE_ONE');
    expect(ATHLETE_RIG.ASSET_MISSING_PANEL.LINE_ONE).toContain('assets/athlete/athlete-01.riv');
    expect(panel).not.toMatch(/SquatScene|AthleteStageLazy|StillPlateStage|require\(/);
  });

  it('loads the athlete stage dynamically, so the Rive runtime is not on the player bundle while closed', () => {
    // The composed stage (room + rig in one frame) is what the gate opens onto;
    // it imports AthleteStage itself, so the runtime is still behind this one
    // dynamic import.
    expect(stage).toMatch(/import\('\.\/AthleteComposedStage'\)/);
    expect(stage).toContain('mod.AthleteComposedStage');
    // No static import of the stage modules themselves — `./AthleteStage`, a
    // platform suffix, or `./AthleteComposedStage`. The override CONTEXT is
    // not a stage and is imported statically on purpose.
    expect(stage, 'a static import would bundle the runtime for nothing').not.toMatch(
      /^import .*from '\.\/Athlete(Composed)?Stage(\.\w+)?';/m,
    );
  });

  it('the override is provided by exactly one module, and it lives under src/dev — a player path never provides it', () => {
    const providers = walk(path.join(REPO, 'src'))
      .filter((f) => !/\.test\.tsx?$/.test(f))
      .filter((f) => /AthleteStageOverrideContext\.Provider/.test(readFileSync(f, 'utf8')))
      .map((f) => path.relative(REPO, f))
      .sort();
    expect(providers).toEqual(['src/dev/athleteAcceptance/OwnerPlaytestScreen.tsx']);
    // And the stage itself imports nothing from src/dev.
    expect(stage).not.toMatch(/from '\.\.\/dev\//);
  });
});
