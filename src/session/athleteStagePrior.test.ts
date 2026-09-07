import { describe, expect, it } from 'vitest';

import { createLift, stepLift, type LiftState } from '../game/lift';
import { liftPresentation } from '../game/liftPresentation';
import { priorFromHistory } from './athleteStagePrior';

/** The loop's own shape: every stepped state pushed, INCLUDING the current one. */
function loopHistory(ticks: number): { history: LiftState[]; state: LiftState } {
  let state = createLift({ kind: 'squat', loadRatio: 0.8, seed: 1 });
  const history: LiftState[] = [];
  state = stepLift(state, { kind: 'press' });
  history.push(state);
  for (let i = 1; i < ticks; i += 1) {
    state = stepLift(state, null);
    history.push(state);
  }
  return { history, state };
}

describe('priorFromHistory hands the contract the true previous tick', () => {
  it('is the second-from-last entry when history includes the current state', () => {
    const { history, state } = loopHistory(12);
    expect(history[history.length - 1], 'the loop pushes the current state').toBe(state);
    const prior = priorFromHistory(history, state);
    expect(prior).toBe(history[history.length - 2]);
    // The contract agrees it is an adjacent sample — the thing this helper exists for.
    expect(liftPresentation(state, 155, prior).motionSampleValid).toBe(true);
  });

  it('is the last entry when history stops short of the current state', () => {
    const { history, state } = loopHistory(12);
    const trailing = history.slice(0, -1);
    expect(priorFromHistory(trailing, state)).toBe(trailing[trailing.length - 1]);
    expect(liftPresentation(state, 155, priorFromHistory(trailing, state)).motionSampleValid).toBe(true);
  });

  it('is null — an honest unpaired snapshot — with no history or only the current state', () => {
    const { history, state } = loopHistory(1);
    expect(priorFromHistory([], state)).toBeNull();
    expect(priorFromHistory(history, state)).toBeNull();
    expect(liftPresentation(state, 155, null).motionSampleValid).toBe(false);
  });

  it('never fabricates adjacency: a stale history yields a prior the contract rejects as a motion sample', () => {
    const { history, state } = loopHistory(12);
    const stale = history.slice(0, 5);
    const prior = priorFromHistory(stale, state);
    expect(prior).not.toBeNull();
    // The helper hands over what it has; the CONTRACT decides it is not adjacent.
    expect(liftPresentation(state, 155, prior).motionSampleValid).toBe(false);
  });
});
