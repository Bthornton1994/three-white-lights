import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { visualPlateStack, BAR_AND_COLLARS_KG } from '../art/plates';
import { liveStrain } from '../lift/liftFrame';
import {
  braceTicks,
  createLift,
  descentRate,
  runLift,
  stepLift,
  type LiftInput,
  type LiftPhase,
  type LiftState,
} from './lift';
import { LIFT_TUNING } from './liftTuning';
import {
  liftPresentation,
  presentationGrind,
  presentationStrain,
  type LiftPresentationState,
} from './liftPresentation';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIGHT_KG = 70;
const WORK_KG = 155;
const HEAVY_KG = 220;
const MAX_TICKS = 800;

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

function mean(values: readonly number[]): number {
  expect(values.length, 'mean of empty sample').toBeGreaterThan(0);
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

interface WalkSample {
  readonly prior: LiftState;
  readonly state: LiftState;
  readonly view: LiftPresentationState;
}

function walk(
  start: LiftState,
  inputFor: (state: LiftState) => LiftInput | null,
  until: (state: LiftState) => boolean,
): readonly WalkSample[] {
  const out: WalkSample[] = [];
  let state = start;
  let guard = 0;
  while (!until(state) && state.phase !== 'RESOLVED' && guard < MAX_TICKS) {
    const prior = state;
    state = stepLift(state, inputFor(state));
    out.push({ prior, state, view: liftPresentation(state, WORK_KG, prior) });
    guard += 1;
  }
  return out;
}

function phaseOf(samples: readonly WalkSample[], phase: LiftPhase): readonly WalkSample[] {
  return samples.filter((sample) => sample.view.phase === phase);
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
    expect(source).not.toContain('barAcceleration');
  });

  it('standing squat brace is lockout height, not a JPEG id', () => {
    const view = liftPresentation(squatAt(0.8), WORK_KG, null);
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
    const top = liftPresentation(squatAt(0.8), WORK_KG, null);
    const mid = liftPresentation(holdDownTo(0.7), WORK_KG, null);
    const low = liftPresentation(holdDownTo(0.45), WORK_KG, null);
    expect(mid.barHeight).toBeLessThan(top.barHeight);
    expect(low.barHeight).toBeLessThan(mid.barHeight);
    expect(mid.depth).toBeGreaterThan(top.depth);
    expect(low.depth).toBeGreaterThan(mid.depth);
  });

  it('heavier prescribed load yields more discs, never an invented visual load', () => {
    const light = liftPresentation(squatAt(0.5), LIGHT_KG, null);
    const heavy = liftPresentation(squatAt(1), HEAVY_KG, null);
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
    expect(liftPresentation(state, WORK_KG, null).strain).toBe(liveStrain(state));
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
      expect(liftPresentation(state, HEAVY_KG, null).effortBand).not.toBe('easy');
    }
  });

  it('a buried squat resolves as failing with a miss outcome', () => {
    const buried = runLift(
      { kind: 'squat', loadRatio: 0.9, seed: 3 },
      [{ tick: 1, kind: 'press' }],
      800,
    );
    const view = liftPresentation(buried.final, WORK_KG, null);
    expect(view.complete).toBe(true);
    expect(view.outcome).toBe('miss');
    expect(view.effortBand).toBe('failing');
    expect(view.missReason).not.toBeNull();
  });

  it('bench and deadlift share the same contract shape', () => {
    const bench = liftPresentation(
      createLift({ kind: 'bench', loadRatio: 0.7, seed: 2 }),
      WORK_KG,
      null,
    );
    const pull = liftPresentation(
      createLift({ kind: 'deadlift', loadRatio: 0.7, seed: 2 }),
      WORK_KG,
      null,
    );
    expect(bench.kind).toBe('bench');
    expect(pull.kind).toBe('deadlift');
    expect(pull.barHeight).toBe(0);
    expect(bench.barHeight).toBe(1);
    expect(bench.load.discs.length).toBe(pull.load.discs.length);
    expect(Object.keys(bench)).toEqual(Object.keys(pull));
  });

  it('null prior is an explicit unpaired sample, not actual rest', () => {
    const a = squatAt(0.8);
    const b = stepLift(a, { kind: 'press' });
    const unpaired = liftPresentation(b, WORK_KG, null);
    expect(unpaired.motionSampleValid).toBe(false);
    expect(unpaired.barVelocity).toBe(0);
    expect(unpaired.integratorVelocity).toBe(b.velocity);

    const adjacent = liftPresentation(b, WORK_KG, a);
    expect(adjacent.motionSampleValid).toBe(true);

    const stale = holdDownTo(0.5, 0.8);
    const far = liftPresentation(b, WORK_KG, stale);
    expect(far.motionSampleValid).toBe(false);
    expect(far.barVelocity).toBe(0);
  });

  it('a held brace with an adjacent prior is valid and stationary', () => {
    const a = squatAt(0.8);
    const b = stepLift(a, null);
    const view = liftPresentation(b, WORK_KG, a);
    expect(b.phase).toBe('BRACE');
    expect(view.motionSampleValid).toBe(true);
    expect(view.barVelocity).toBe(0);
    expect(view.barHeight).toBe(1);
  });

  it('is deterministic for a fixed config, load, and prior', () => {
    const prior = squatAt(0.8);
    const state = stepLift(prior, { kind: 'press' });
    expect(liftPresentation(state, WORK_KG, prior)).toEqual(
      liftPresentation(state, WORK_KG, prior),
    );
  });
});

describe('barVelocity is signed actual bar motion, not the ascent integrator', () => {
  it('squat DESCENT ticks exist, height falls, and barVelocity is negative', () => {
    const load = 0.55;
    const pressAt = braceTicks(load, 'squat') + 1;
    const samples = walk(
      squatAt(load),
      (state) => (state.tick + 1 === pressAt || state.held ? { kind: 'press' } : { kind: 'press' }),
      (state) => state.phase === 'HOLE' || state.phase === 'ASCENT' || state.phase === 'RESOLVED',
    );
    const descent = phaseOf(samples, 'DESCENT');
    expect(descent.length, 'squat DESCENT produced no ticks').toBeGreaterThan(2);
    const moving = descent.filter((sample) => sample.view.barVelocity !== 0);
    expect(moving.length, 'squat DESCENT had no actual bar motion').toBeGreaterThan(2);
    const heights = moving.map((sample) => sample.view.barHeight);
    expect(heights[heights.length - 1]!).toBeLessThan(heights[0]!);
    const motions = moving.map((sample) => sample.view.barVelocity);
    expect(motions.every((v) => v < 0), `descent barVelocity ${motions.slice(0, 5)}`).toBe(true);
    expect(moving.every((sample) => sample.view.motionSampleValid)).toBe(true);
    expect(
      descent.every((sample) => sample.view.integratorVelocity === 0),
      'integrator must stay 0 on squat descent',
    ).toBe(true);
    const rate = descentRate(load, 'squat');
    expect(Math.abs(mean(motions) + rate)).toBeLessThan(rate);
  });

  it('a light squat descends faster (more negative) than a maximal squat', () => {
    const lightLoad = 0.4;
    const heavyLoad = 1;
    const collect = (loadRatio: number): number[] => {
      const pressAt = braceTicks(loadRatio, 'squat') + 1;
      const samples = walk(
        squatAt(loadRatio, 2),
        (state) => (state.tick + 1 >= pressAt ? { kind: 'press' } : null),
        (state) => state.phase === 'HOLE' || state.phase === 'ASCENT' || state.phase === 'RESOLVED',
      );
      const descent = phaseOf(samples, 'DESCENT');
      expect(descent.length, `empty DESCENT at load ${loadRatio}`).toBeGreaterThan(2);
      const moving = descent.filter((sample) => sample.view.barVelocity !== 0);
      expect(moving.length, `no bar motion at load ${loadRatio}`).toBeGreaterThan(2);
      return moving.map((sample) => sample.view.barVelocity);
    };
    const light = mean(collect(lightLoad));
    const heavy = mean(collect(heavyLoad));
    expect(light).toBeLessThan(heavy);
    expect(light).toBeLessThan(0);
    expect(heavy).toBeLessThan(0);
    expect(descentRate(lightLoad, 'squat')).toBeGreaterThan(descentRate(heavyLoad, 'squat'));
  });

  it('squat ASCENT ticks exist and barVelocity is positive while the bar is winning', () => {
    const load = 0.55;
    const pressAt = braceTicks(load, 'squat') + 1;
    let state = squatAt(load);
    const samples: WalkSample[] = [];
    let released = false;
    let guard = 0;
    while (state.phase !== 'RESOLVED' && guard < MAX_TICKS) {
      let input: LiftInput | null = null;
      if (state.tick + 1 >= pressAt && !released) input = { kind: 'press' };
      if (state.phase === 'DESCENT' && state.depth >= LIFT_TUNING.DEPTH_IDEAL.squat && !released) {
        input = { kind: 'release' };
        released = true;
      }
      const prior = state;
      state = stepLift(state, input);
      samples.push({ prior, state, view: liftPresentation(state, WORK_KG, prior) });
      guard += 1;
    }
    const ascent = phaseOf(samples, 'ASCENT');
    expect(ascent.length, 'squat ASCENT produced no ticks').toBeGreaterThan(2);
    const rising = ascent.filter((sample) => sample.view.barVelocity > 0);
    expect(rising.length, 'ascent had no positive barVelocity').toBeGreaterThan(0);
    expect(ascent[ascent.length - 1]!.view.barHeight).toBeGreaterThan(ascent[0]!.view.barHeight);
    const stalled = ascent.filter(
      (sample) => sample.view.integratorVelocity < LIFT_TUNING.GRIND_STALL_VELOCITY,
    );
    for (const sample of stalled) {
      expect(sample.view.grindIntensity).toBe(1);
    }
  });

  it('bench descent is negative; a released bar is faster than a held bar', () => {
    const load = 0.7;
    const pressAt = braceTicks(load, 'bench') + 1;
    const heldWalk = walk(
      createLift({ kind: 'bench', loadRatio: load, seed: 4 }),
      (state) => (state.tick + 1 >= pressAt ? { kind: 'press' } : null),
      (state) => state.phase === 'HOLE' || state.phase === 'RESOLVED',
    );
    const heldDescent = phaseOf(heldWalk, 'DESCENT').filter(
      (sample) => sample.view.barVelocity !== 0,
    );
    expect(heldDescent.length, 'held bench DESCENT empty').toBeGreaterThan(2);
    expect(heldDescent.every((sample) => sample.view.barVelocity < 0)).toBe(true);

    let state = createLift({ kind: 'bench', loadRatio: load, seed: 4 });
    const dropped: WalkSample[] = [];
    let started = false;
    let guard = 0;
    while (state.phase !== 'HOLE' && state.phase !== 'RESOLVED' && guard < MAX_TICKS) {
      let input: LiftInput | null = null;
      if (state.tick + 1 >= pressAt && !started) {
        input = { kind: 'press' };
        started = true;
      } else if (started && state.phase === 'DESCENT' && state.held) {
        input = { kind: 'release' };
      }
      const prior = state;
      state = stepLift(state, input);
      dropped.push({ prior, state, view: liftPresentation(state, WORK_KG, prior) });
      guard += 1;
    }
    const droppedDescent = phaseOf(dropped, 'DESCENT').filter((sample) => !sample.state.held);
    expect(droppedDescent.length, 'released bench DESCENT empty').toBeGreaterThan(0);
    expect(mean(droppedDescent.map((s) => s.view.barVelocity))).toBeLessThan(
      mean(heldDescent.map((s) => s.view.barVelocity)),
    );
  });

  it('bench press ascent produces positive barVelocity off the chest', () => {
    const load = 0.55;
    const pressAt = braceTicks(load, 'bench') + 1;
    let state = createLift({ kind: 'bench', loadRatio: load, seed: 5 });
    const samples: WalkSample[] = [];
    let guard = 0;
    while (state.phase !== 'RESOLVED' && guard < MAX_TICKS) {
      const live = state.phase === 'HOLE' || state.phase === 'ASCENT';
      const input: LiftInput | null =
        state.tick + 1 >= pressAt ? { kind: 'press' } : live ? { kind: 'press' } : null;
      const prior = state;
      state = stepLift(state, input);
      samples.push({ prior, state, view: liftPresentation(state, WORK_KG, prior) });
      guard += 1;
    }
    const ascent = phaseOf(samples, 'ASCENT');
    expect(ascent.length, 'bench ASCENT empty').toBeGreaterThan(1);
    const rising = ascent.filter((sample) => sample.view.barVelocity > 0);
    expect(rising.length, 'bench ascent had no positive barVelocity').toBeGreaterThan(0);
  });

  it('deadlift floor-to-lockout is positive barVelocity; no sim-owned return', () => {
    const load = 0.55;
    const pressAt = braceTicks(load, 'deadlift') + 1;
    const samples = walk(
      createLift({ kind: 'deadlift', loadRatio: load, seed: 6 }),
      (state) => (state.tick + 1 >= pressAt ? { kind: 'press' } : state.held ? null : { kind: 'press' }),
      (state) => state.phase === 'RESOLVED',
    );
    expect(phaseOf(samples, 'DESCENT').length, 'deadlift must not enter DESCENT').toBe(0);
    const ascent = phaseOf(samples, 'ASCENT');
    expect(ascent.length, 'deadlift ASCENT empty').toBeGreaterThan(2);
    const rising = ascent.filter((sample) => sample.view.barVelocity > 0);
    expect(rising.length, 'deadlift ascent had no positive barVelocity').toBeGreaterThan(0);
    expect(ascent[ascent.length - 1]!.view.barHeight).toBeGreaterThan(ascent[0]!.view.barHeight);
    const done = samples[samples.length - 1];
    expect(done).toBeDefined();
    expect(done!.view.complete).toBe(true);
    if (done!.view.outcome !== 'miss') {
      expect(done!.view.barHeight).toBeGreaterThan(0);
    }
  });
});
