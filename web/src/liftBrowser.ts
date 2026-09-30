import {
  braceTicks,
  createLift,
  pressCommandIsLive,
  stepLift,
  type LiftConfig,
  type LiftInputKind,
  type LiftState,
} from '../../src/game/lift';
import { LIFT_TUNING, TICK_MS } from '../../src/game/liftTuning';

import type { LiftEvidence } from '../../src/production/liftEvidence';
import { ATHLETE_ATLAS, BROWSER_LIFT_TUNING } from './gameplayTuning';
export { BROWSER_LIFT_TUNING } from './gameplayTuning';

export interface BrowserLiftFrame {
  readonly state: LiftState;
  readonly accumulatorMs: number;
  readonly inputs: readonly LiftInputKind[];
  readonly paused: boolean;
  readonly events: LiftEvidence['events'];
}

export function createBrowserLift(config: LiftConfig): BrowserLiftFrame {
  return { state: createLift(config), accumulatorMs: 0, inputs: [], paused: false, events: [] };
}

export function queueBrowserInput(frame: BrowserLiftFrame, kind: LiftInputKind): BrowserLiftFrame {
  if (frame.paused || frame.state.phase === 'RESOLVED') return frame;
  if (frame.inputs.at(-1) === kind) return frame;
  return { ...frame, inputs: [...frame.inputs, kind] };
}

export function pauseBrowserLift(frame: BrowserLiftFrame): BrowserLiftFrame {
  if (frame.paused || frame.state.phase === 'RESOLVED') return frame;
  return {
    ...frame,
    state: frame.state.held ? { ...frame.state, held: false } : frame.state,
    inputs: [],
    accumulatorMs: 0,
    paused: true,
    events: [...frame.events, { tick: frame.state.tick, kind: 'clear-grip' }],
  };
}

export function resumeBrowserLift(frame: BrowserLiftFrame): BrowserLiftFrame {
  return { ...frame, accumulatorMs: 0, inputs: [], paused: false };
}

export function advanceBrowserLift(frame: BrowserLiftFrame, elapsedMs: number): BrowserLiftFrame {
  if (frame.paused || frame.state.phase === 'RESOLVED') return frame;
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return frame;
  if (elapsedMs > BROWSER_LIFT_TUNING.HITCH_PAUSE_MS) return pauseBrowserLift(frame);

  const accumulated = frame.accumulatorMs + elapsedMs;
  const available = Math.floor(accumulated / TICK_MS);
  if (available === 0) return { ...frame, accumulatorMs: accumulated };
  const ticks = Math.min(available, BROWSER_LIFT_TUNING.MAX_CATCH_UP_TICKS);
  const inputs = [...frame.inputs];
  const events = [...frame.events];
  let state = frame.state;
  for (let tick = 0; tick < ticks && state.phase !== 'RESOLVED'; tick += 1) {
    const input = inputs.shift();
    if (input !== undefined) events.push({ tick: state.tick + 1, kind: input });
    state = stepLift(state, input === undefined ? null : { kind: input });
  }
  return {
    state,
    inputs: state.phase === 'RESOLVED' ? [] : inputs,
    accumulatorMs: accumulated - available * TICK_MS,
    paused: false,
    events,
  };
}

export function browserLiftEvidence(frame: BrowserLiftFrame): LiftEvidence {
  if (frame.state.phase !== 'RESOLVED' || frame.state.resolution === null) throw new Error('An unfinished lift has no result evidence.');
  return { config: frame.state.config, events: [...frame.events], resolvedTick: frame.state.tick };
}

function ascentFrame(state: LiftState): number {
  const t = BROWSER_LIFT_TUNING;
  const height = state.height;
  if (state.config.kind === 'squat') {
    if (height < t.SQUAT_ASCENT_FIRST) return ATHLETE_ATLAS.poses.bottom;
    if (height < t.SQUAT_ASCENT_SECOND) return ATHLETE_ATLAS.poses.lowDrive;
    if (height < t.SQUAT_ASCENT_THIRD) return ATHLETE_ATLAS.poses.highDrive;
    return ATHLETE_ATLAS.poses.lockout;
  }
  if (state.config.kind === 'bench') {
    if (height < t.BENCH_ASCENT_FIRST) return ATHLETE_ATLAS.poses.lowDrive;
    if (height < t.BENCH_ASCENT_SECOND) return ATHLETE_ATLAS.poses.highDrive;
    return ATHLETE_ATLAS.poses.lockout;
  }
  if (height < t.DEADLIFT_HEIGHT_FIRST) return ATHLETE_ATLAS.poses.brace;
  if (height < t.DEADLIFT_HEIGHT_SECOND) return ATHLETE_ATLAS.poses.halfDescent;
  if (height < t.DEADLIFT_HEIGHT_THIRD) return ATHLETE_ATLAS.poses.bottom;
  if (height < t.DEADLIFT_HEIGHT_FOURTH) return ATHLETE_ATLAS.poses.lowDrive;
  return ATHLETE_ATLAS.poses.highDrive;
}

export function spriteFrameFor(state: LiftState): number {
  const t = BROWSER_LIFT_TUNING;
  if (state.phase === 'BRACE') return ATHLETE_ATLAS.poses.brace;
  if (state.phase === 'DESCENT') {
    if (state.config.kind === 'squat') {
      const legal = LIFT_TUNING.DEPTH_LEGAL.squat;
      if (state.depth < t.SQUAT_DESCENT_FIRST * legal) return ATHLETE_ATLAS.poses.brace;
      if (state.depth < t.SQUAT_DESCENT_SECOND * legal) return ATHLETE_ATLAS.poses.halfDescent;
      return ATHLETE_ATLAS.poses.bottom;
    }
    if (state.depth < t.BENCH_DESCENT_FIRST) return ATHLETE_ATLAS.poses.brace;
    if (state.depth < t.BENCH_DESCENT_SECOND) return ATHLETE_ATLAS.poses.halfDescent;
    return ATHLETE_ATLAS.poses.bottom;
  }
  if (state.phase === 'HOLE') return ATHLETE_ATLAS.poses.bottom;
  if (state.phase === 'LOCKOUT') return ATHLETE_ATLAS.poses.lockout;
  if (state.phase === 'RESOLVED' && state.resolution?.outcome !== 'miss') return ATHLETE_ATLAS.poses.lockout;
  if (state.phase === 'RESOLVED' && state.resolution?.missReason === 'buried') return ATHLETE_ATLAS.poses.bottom;
  return ascentFrame(state);
}

export function liftControlIsReady(state: LiftState): boolean {
  if (state.phase === 'RESOLVED') return false;
  return state.config.kind !== 'deadlift' || state.phase !== 'BRACE' || state.phaseTick >= braceTicks(state.config.loadRatio, state.config.kind);
}

export function liftControlCopy(state: LiftState, paused: boolean): { label: string; instruction: string } {
  if (paused) return {
    label: state.phase === 'BRACE' || state.phase === 'DESCENT' || state.phase === 'LOCKOUT' ? 'Resume · press & hold' : 'Resume · lift control',
    instruction: 'Your lift is paused. Use the lift control to continue from this position.',
  };
  if (state.resolution !== null) return { label: state.resolution.headline, instruction: state.resolution.detail || 'Rep complete. Preparing the next moment.' };
  switch (state.phase) {
    case 'BRACE':
      if (state.config.kind === 'deadlift') return { label: liftControlIsReady(state) ? 'Tap to pull' : 'Setting the grip…', instruction: 'When the control is ready, tap to leave the floor. Release between drive cues, then hold the lockout.' };
      return { label: 'Press & hold', instruction: state.config.kind === 'bench' ? 'Hold while the bar lowers. Wait for PRESS, then tap fast through the entire ascent.' : 'Hold to lower. Release as the moving ring meets the target, then tap each drive cue.' };
    case 'DESCENT':
      return { label: 'Keep holding', instruction: state.config.kind === 'bench' ? 'Stay tight all the way to the chest. Wait for the press command before tapping.' : 'Watch the bottom position. Release as the moving ring meets the target.' };
    case 'HOLE':
      return state.config.kind === 'bench'
        ? pressCommandIsLive(state)
          ? { label: 'Tap fast · keep going', instruction: 'PRESS. Tap fast and keep tapping until the bar is locked out.' }
          : { label: 'Wait · then tap fast', instruction: 'Early taps delay your press. When PRESS appears, tap fast and keep tapping.' }
        : { label: 'Ready for the drive', instruction: 'Tap when each moving ring meets the target.' };
    case 'ASCENT':
      return state.config.kind === 'bench'
        ? { label: 'Tap fast · keep going', instruction: 'Keep a fast rhythm until lockout. Stop tapping and the bar can stall.' }
        : { label: 'Tap each drive cue', instruction: state.config.kind === 'deadlift' ? 'Tap each ring on the beat, then press and hold at lockout until DOWN.' : 'Tap when each moving ring meets the target. Release between taps.' };
    case 'LOCKOUT':
      return state.config.kind === 'deadlift'
        ? state.downCommandTick !== null && state.tick >= state.downCommandTick
          ? { label: 'Down · release', instruction: 'The DOWN call has arrived. Release and put the bar down.' }
          : { label: 'Hold · do not let go', instruction: 'Keep the bar locked out. Wait for the DOWN call, then release.' }
        : { label: 'Locked out', instruction: 'The bar is up. Your rep is being resolved.' };
    case 'RESOLVED':
      return { label: 'Rep complete', instruction: 'Preparing the next moment.' };
  }
}
