import { describe, expect, it } from 'vitest';

import { createLift, stepLift, type LiftState } from '../game/lift';
import { visualPlateStack, BAR_AND_COLLARS_KG } from '../art/plates';
import { squatPoseFrom, squatStandFrom } from './squatVisual';

const LOAD = 155;

function squat(): LiftState {
  return createLift({ kind: 'squat', loadRatio: 0.8, seed: 1 });
}

function driveToHeight(target: number): LiftState {
  let state = squat();
  state = stepLift(state, { kind: 'press' });
  let guard = 0;
  while (state.height > target && state.phase !== 'RESOLVED' && guard < 400) {
    state = stepLift(state, state.held ? null : { kind: 'press' });
    guard += 1;
  }
  return state;
}

describe('squatPoseFrom follows the mechanic, not a JPEG id', () => {
  it('standing brace is near lockout height', () => {
    const pose = squatPoseFrom(squat(), LOAD);
    expect(squatStandFrom(squat())).toBe(1);
    expect(pose.bar.y).toBeLessThan(0.4);
    expect(pose.plates.length).toBe(visualPlateStack(LOAD, BAR_AND_COLLARS_KG).perSide.length);
    expect(pose.totalKg).toBe(LOAD);
  });

  it('bar Y rises as height falls — continuous, not a phase snap', () => {
    const top = squatPoseFrom(squat(), LOAD);
    const mid = squatPoseFrom(driveToHeight(0.7), LOAD);
    const low = squatPoseFrom(driveToHeight(0.45), LOAD);
    expect(mid.height).toBeLessThan(top.height);
    expect(low.height).toBeLessThan(mid.height);
    expect(mid.bar.y).toBeGreaterThan(top.bar.y);
    expect(low.bar.y).toBeGreaterThan(mid.bar.y);
  });

  it('heavier bars carry more discs', () => {
    const light = squatPoseFrom(squat(), 70);
    const heavy = squatPoseFrom(squat(), 220);
    expect(heavy.plates.length).toBeGreaterThan(light.plates.length);
  });
});
