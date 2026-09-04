import { describe, expect, it } from 'vitest';

import { createLift, type LiftConfig } from './lift';
import { meetCommandFor } from './meetDay';
import { MEET_COPY } from './meetTuning';
import { EMPTY_FATIGUE_STATE, NEUTRAL_CHECK_IN, sessionFeel } from './fatigue';

function config(kind: LiftConfig['kind']): LiftConfig {
  return {
    kind,
    loadRatio: 0.85,
    seed: 4,
    feel: sessionFeel(EMPTY_FATIGUE_STATE, 20300, NEUTRAL_CHECK_IN),
    moment: { workSetsCompleted: 0, repsCompletedInSet: 0 },
  };
}

describe('meetCommandFor — overlay only, no new mechanic', () => {
  it('names SQUAT at the brace, which is still tap-and-hold', () => {
    const state = createLift(config('squat'));
    expect(state.phase).toBe('BRACE');
    expect(meetCommandFor(state)).toEqual({ text: MEET_COPY.COMMAND_SQUAT, live: true });
  });

  it('names START on a bench brace, not a new skill check', () => {
    const state = createLift(config('bench'));
    expect(meetCommandFor(state)?.text).toBe(MEET_COPY.COMMAND_START);
    expect(meetCommandFor(state)?.live).toBe(false);
  });

  it('does not invent a deadlift start command', () => {
    const state = createLift(config('deadlift'));
    expect(meetCommandFor(state)).toBeNull();
  });

  it('names RACK at squat and bench lockout, without changing the mechanic', () => {
    const squat = createLift(config('squat'));
    const bench = createLift(config('bench'));
    expect(meetCommandFor({ ...squat, phase: 'LOCKOUT' })).toEqual({
      text: MEET_COPY.COMMAND_RACK,
      live: false,
    });
    expect(meetCommandFor({ ...bench, phase: 'LOCKOUT' })).toEqual({
      text: MEET_COPY.COMMAND_RACK,
      live: false,
    });
  });

  it('names PRESS only when the bench mechanic already requires the press', () => {
    const bench = createLift(config('bench'));
    expect(meetCommandFor({ ...bench, phase: 'HOLE', pressCommandTick: null })).toBeNull();
    expect(
      meetCommandFor({ ...bench, phase: 'HOLE', pressCommandTick: 0, tick: 1 }),
    ).toEqual({ text: MEET_COPY.COMMAND_PRESS, live: true });
    expect(meetCommandFor({ ...bench, phase: 'ASCENT' })).toEqual({
      text: MEET_COPY.COMMAND_PRESS,
      live: true,
    });
  });

  it('names DOWN when the deadlift lockout already has the cue', () => {
    const deadlift = createLift(config('deadlift'));
    expect(meetCommandFor({ ...deadlift, phase: 'LOCKOUT', downCommandTick: null })).toBeNull();
    expect(
      meetCommandFor({ ...deadlift, phase: 'LOCKOUT', downCommandTick: 4, tick: 4 }),
    ).toEqual({ text: MEET_COPY.COMMAND_DOWN, live: true });
  });
});
