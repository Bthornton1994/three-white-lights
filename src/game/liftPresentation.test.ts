import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { visualPlateStack, BAR_AND_COLLARS_KG } from '../art/plates';
import { liveStrain } from '../lift/liftFrame';
import { createLift, runLift, stepLift, type LiftState } from './lift';
import { LIFT_TUNING } from './liftTuning';
import {
  liftPresentation,
  presentationGrind,
  presentationStrain,
} from './liftPresentation';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIGHT_KG = 70;
const WORK_KG = 155;
const HEAVY_KG = 220;

function squatAt(loadRatio: number, seed = 1): LiftState {
  return createLift({ kind: 'squat', loadRatio, seed });
}

function holdDownTo(targetHeight: number, loadRatio = 0.8): LiftState {
  let state = squatAt(loadRatio);
  state = stepLift(state, { kind: 'press' });
  let guard = 0;
  while (state.height > targetHeight && state.phase !== 'RESOLVED' && guard < 400) {
    state = stepLift(state, state.held ? null : { kind: 'press' });
    guard += 1;
  }
  return state;
}

describe('liftPresentation is renderer-agnostic mechanical truth', () => {
  it('does not import a renderer, JPEG, Skia, or the rejected squat puppet', () => {
    const source = readFileSync(path.join(HERE, 'liftPresentation.ts'), 'utf8');
    expect(source).not.toContain('SquatScene');
    expect(source).not.toContain('squatVisual');
    expect(source).not.toContain('react-native-skia');
    expect(source).not.toContain('.jpg');
    expect(source).not.toContain('@rive-app');
    expect(source).not.toContain('makeSpriteImage');
    expect(source).not.toContain('ironAmberPlateFor');
  });

  it('standing squat brace is lockout height, not a JPEG id', () => {
    const view = liftPresentation(squatAt(0.8), WORK_KG);
    expect(view.kind).toBe('squat');
    expect(view.phase).toBe('BRACE');
    expect(view.barHeight).toBe(1);
    expect(view.depth).toBe(0);
    expect(view.complete).toBe(false);
    expect(view.outcome).toBeNull();
    expect(view.load.totalKg).toBe(WORK_KG);
    expect(view.load.barKg).toBe(BAR_AND_COLLARS_KG);
  });

  it('barHeight falls continuously on squat descent — no phase snap', () => {
    const top = liftPresentation(squatAt(0.8), WORK_KG);
    const mid = liftPresentation(holdDownTo(0.7), WORK_KG);
    const low = liftPresentation(holdDownTo(0.45), WORK_KG);
    expect(mid.barHeight).toBeLessThan(top.barHeight);
    expect(low.barHeight).toBeLessThan(mid.barHeight);
    expect(mid.depth).toBeGreaterThan(top.depth);
    expect(low.depth).toBeGreaterThan(mid.depth);
  });

  it('heavier prescribed load yields more discs, never an invented visual load', () => {
    const light = liftPresentation(squatAt(0.5), LIGHT_KG);
    const heavy = liftPresentation(squatAt(1), HEAVY_KG);
    expect(heavy.load.discs.length).toBeGreaterThan(light.load.discs.length);
    expect(heavy.load.discs).toEqual(
      visualPlateStack(HEAVY_KG, BAR_AND_COLLARS_KG).perSide.map((p) => ({
        kg: p.spec.kg,
        hue: p.spec.hue,
        diameterMm: p.spec.diameterMm,
      })),
    );
  });

  it('strain matches liveStrain so the sprite adapter and this contract cannot drift', () => {
    const state = holdDownTo(0.5, 0.9);
    expect(presentationStrain(state)).toBe(liveStrain(state));
    expect(liftPresentation(state, WORK_KG).strain).toBe(liveStrain(state));
  });

  it('grindIntensity uses GRIND_STALL_VELOCITY, not a camera constant', () => {
    let state = holdDownTo(0.2, 0.95);
    let guard = 0;
    while (state.phase !== 'ASCENT' && state.phase !== 'RESOLVED' && guard < 80) {
      state = stepLift(state, { kind: 'release' });
      guard += 1;
    }
    if (state.phase === 'ASCENT') {
      const grind = presentationGrind(state);
      if (state.velocity <= LIFT_TUNING.GRIND_STALL_VELOCITY) {
        expect(grind).toBe(1);
      } else {
        expect(grind).toBeLessThan(1);
      }
      expect(liftPresentation(state, HEAVY_KG).effortBand).not.toBe('easy');
    }
  });

  it('a buried squat resolves as failing with a miss outcome', () => {
    const buried = runLift(
      { kind: 'squat', loadRatio: 0.9, seed: 3 },
      [{ tick: 1, kind: 'press' }],
      800,
    );
    const view = liftPresentation(buried.final, WORK_KG);
    expect(view.complete).toBe(true);
    expect(view.outcome).toBe('miss');
    expect(view.effortBand).toBe('failing');
    expect(view.missReason).not.toBeNull();
  });

  it('bench and deadlift share the same contract shape', () => {
    const bench = liftPresentation(createLift({ kind: 'bench', loadRatio: 0.7, seed: 2 }), WORK_KG);
    const pull = liftPresentation(
      createLift({ kind: 'deadlift', loadRatio: 0.7, seed: 2 }),
      WORK_KG,
    );
    expect(bench.kind).toBe('bench');
    expect(pull.kind).toBe('deadlift');
    expect(pull.barHeight).toBe(0);
    expect(bench.barHeight).toBe(1);
    expect(bench.load.discs.length).toBe(pull.load.discs.length);
    expect(Object.keys(bench)).toEqual(Object.keys(pull));
  });

  it('acceleration is zero without a prior tick and tracks velocity delta with one', () => {
    const a = squatAt(0.8);
    const b = stepLift(a, { kind: 'press' });
    expect(liftPresentation(b, WORK_KG).barAcceleration).toBe(0);
    expect(liftPresentation(b, WORK_KG, a).barAcceleration).toBe(b.velocity - a.velocity);
  });

  it('is deterministic for a fixed config and load', () => {
    const state = holdDownTo(0.6, 0.8);
    expect(liftPresentation(state, WORK_KG)).toEqual(liftPresentation(state, WORK_KG));
  });
});
