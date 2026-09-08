import { describe, expect, it } from 'vitest';

import { selectTrainingStageArm, type TrainingStageArm, type TrainingStageSelection } from './trainingStageSelect';

const KINDS = ['squat', 'bench', 'deadlift'] as const;
const GATES = ['schematic', 'athlete'] as const;
const OVERRIDES = [null, 'schematic', 'athlete'] as const;
const PLACEHOLDER = [true, false] as const;

describe('selectTrainingStageArm — the whole table', () => {
  it('every combination lands on exactly the arm the rules name', () => {
    const seen = new Set<TrainingStageArm>();
    let cases = 0;
    for (const kind of KINDS) for (const gate of GATES) for (const override of OVERRIDES) for (const athleteAssetIsPlaceholder of PLACEHOLDER) {
      const arm = selectTrainingStageArm({ kind, gate, override, athleteAssetIsPlaceholder } satisfies TrainingStageSelection);
      seen.add(arm);
      cases += 1;
      if (kind !== 'squat') { expect(arm).toBe('still-plate'); continue; }
      const stage = override ?? gate;
      if (stage === 'schematic') { expect(arm).toBe('schematic'); continue; }
      expect(arm).toBe(athleteAssetIsPlaceholder ? 'athlete-asset-missing' : 'athlete');
    }
    // NON-VACUITY: the table was walked and every arm was reached.
    expect(cases).toBe(KINDS.length * GATES.length * OVERRIDES.length * PLACEHOLDER.length);
    expect([...seen].sort()).toEqual(['athlete', 'athlete-asset-missing', 'schematic', 'still-plate']);
  });

  it('production — no override — is the gate, and the shipped gate is closed', () => {
    expect(selectTrainingStageArm({ kind: 'squat', gate: 'schematic', override: null, athleteAssetIsPlaceholder: true })).toBe('schematic');
    expect(selectTrainingStageArm({ kind: 'squat', gate: 'schematic', override: null, athleteAssetIsPlaceholder: false })).toBe('schematic');
  });

  it('the athlete arm with no real asset FAILS CLOSED to the missing-asset panel, never the schematic', () => {
    expect(selectTrainingStageArm({ kind: 'squat', gate: 'athlete', override: null, athleteAssetIsPlaceholder: true })).toBe('athlete-asset-missing');
    expect(selectTrainingStageArm({ kind: 'squat', gate: 'schematic', override: 'athlete', athleteAssetIsPlaceholder: true })).toBe('athlete-asset-missing');
  });

  it('the owner-playtest override opens the athlete arm without the gate moving, and a schematic override closes it', () => {
    expect(selectTrainingStageArm({ kind: 'squat', gate: 'schematic', override: 'athlete', athleteAssetIsPlaceholder: false })).toBe('athlete');
    expect(selectTrainingStageArm({ kind: 'squat', gate: 'athlete', override: 'schematic', athleteAssetIsPlaceholder: false })).toBe('schematic');
  });
});
