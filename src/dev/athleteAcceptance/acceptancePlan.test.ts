import { describe, expect, it } from 'vitest';

import { ATHLETE_TRACE_SCENARIOS, athleteTrace } from '../../art/athleteTraces';
import { priorFromHistory } from '../../session/athleteStagePrior';
import { ACCEPTANCE_PLAYBACK } from '../riveRuntimeSpike/spikeTuning';
import { acceptancePlan, advancePlayback, PLAYBACK_START, playbackFrame } from './acceptancePlan';

describe('acceptancePlan — the corpus, re-driven, as stage props', () => {
  const plan = acceptancePlan();

  it('carries every scenario, each rep the same length as its committed trace, at the same bar', () => {
    expect(plan.map((p) => p.scenario.id)).toEqual(ATHLETE_TRACE_SCENARIOS.map((s) => s.id));
    for (const entry of plan) {
      const trace = athleteTrace(entry.scenario);
      expect(entry.states.length, entry.scenario.id).toBe(trace.ticks.length);
      expect(entry.totalKg, entry.scenario.id).toBe(trace.totalKg);
      expect(entry.states.at(-1)?.phase).toBe('RESOLVED');
      expect(entry.states.at(-1)?.resolution?.outcome).toBe(entry.scenario.expects.outcome);
    }
  });

  it('a frame is what useLiftLoop hands a stage: the state, the history up to it, and priorFromHistory reads the true prior', () => {
    const first = playbackFrame(plan, PLAYBACK_START)!;
    expect(first.history).toEqual([first.state]);
    expect(priorFromHistory(first.history, first.state)).toBeNull();
    const later = playbackFrame(plan, { ...PLAYBACK_START, tick: 40 })!;
    expect(later.history.length).toBe(41);
    expect(later.history.at(-1)).toBe(later.state);
    expect(priorFromHistory(later.history, later.state)).toBe(plan[0]!.states[39]);
    expect(later.ticks).toBe(plan[0]!.states.length);
  });

  it('advances one tick at a time, holds the ending, moves on, and wraps with a loop count', () => {
    let position = PLAYBACK_START;
    const seen: string[] = [];
    let steps = 0;
    // Per scenario: (ticks - 1) advances through the rep, HOLD_TICKS_AT_END held, one to move on.
    const total = plan.reduce((n, p) => n + p.states.length + ACCEPTANCE_PLAYBACK.HOLD_TICKS_AT_END, 0);
    while (position.loops === 0) {
      const frame = playbackFrame(plan, position)!;
      if (seen.at(-1) !== frame.scenario.id) seen.push(frame.scenario.id);
      position = advancePlayback(position, plan);
      steps += 1;
      expect(steps).toBeLessThanOrEqual(total);
    }
    expect(seen).toEqual(plan.map((p) => p.scenario.id));
    expect(steps).toBe(total);
    expect(position).toEqual({ scenario: 0, tick: 0, held: 0, loops: 1 });
    // The hold is real: the last frame repeats HOLD_TICKS_AT_END times.
    const last = plan[0]!.states.length - 1;
    let held = { scenario: 0, tick: last, held: 0, loops: 0 };
    for (let i = 0; i < ACCEPTANCE_PLAYBACK.HOLD_TICKS_AT_END; i += 1) {
      held = advancePlayback(held, plan);
      expect(held.tick).toBe(last);
    }
    expect(advancePlayback(held, plan).scenario).toBe(1);
  });

  it('an out-of-range position resets rather than reading past the plan', () => {
    expect(advancePlayback({ scenario: 99, tick: 0, held: 0, loops: 3 }, plan)).toEqual(PLAYBACK_START);
    expect(playbackFrame(plan, { scenario: 0, tick: 10_000, held: 0, loops: 0 })).toBeNull();
    expect(acceptancePlan([])).toEqual([]);
  });
});
