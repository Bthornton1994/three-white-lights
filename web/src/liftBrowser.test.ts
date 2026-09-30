import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { braceTicks, createLift, pressCommandIsLive, stepLift, type LiftConfig, type LiftInputKind, type LiftPhase, type LiftState } from '../../src/game/lift';
import { LOAD_PRESETS, TICK_MS } from '../../src/game/liftTuning';
import {
  advanceBrowserLift,
  BROWSER_LIFT_TUNING,
  createBrowserLift,
  browserLiftEvidence,
  liftControlCopy,
  liftControlIsReady,
  pauseBrowserLift,
  queueBrowserInput,
  resumeBrowserLift,
  spriteFrameFor,
  type BrowserLiftFrame,
} from './liftBrowser';

import { replayLiftEvidence } from '../../src/production/evidenceReplay';

const CONFIG: LiftConfig = { kind: 'squat', loadRatio: LOAD_PRESETS.LIGHT, seed: 4 };
const PLAYBACK_LIMIT = 900;

describe('browser lift timing and input', () => {
  it('opens on the original engine brace without an input or a simulated tick', () => {
    const frame = createBrowserLift(CONFIG);
    assert.deepEqual(frame.state, createLift(CONFIG));
    assert.deepEqual(frame.inputs, []);
    assert.equal(frame.paused, false);
  });

  it('preserves a quick press and release as two separate engine ticks', () => {
    let frame = createBrowserLift(CONFIG);
    frame = queueBrowserInput(frame, 'press');
    frame = queueBrowserInput(frame, 'release');
    const first = advanceBrowserLift(frame, TICK_MS);
    assert.equal(first.state.tick, 1);
    assert.equal(first.state.held, true);
    assert.deepEqual(first.inputs, ['release']);
    const second = advanceBrowserLift(first, TICK_MS);
    assert.equal(second.state.tick, 2);
    assert.equal(second.state.held, false);
    assert.deepEqual(second.inputs, []);
    assert.deepEqual(second.events, [{ tick: 1, kind: 'press' }, { tick: 2, kind: 'release' }]);
  });

  it('advances the same engine states for 60 Hz and 120 Hz display frames', () => {
    let sixty = queueBrowserInput(createBrowserLift(CONFIG), 'press');
    let oneTwenty = queueBrowserInput(createBrowserLift(CONFIG), 'press');
    for (let frame = 0; frame < 12; frame += 1) sixty = advanceBrowserLift(sixty, TICK_MS);
    for (let frame = 0; frame < 24; frame += 1) oneTwenty = advanceBrowserLift(oneTwenty, TICK_MS / 2);
    assert.equal(sixty.state.tick, 12);
    assert.deepEqual(oneTwenty.state, sixty.state);
  });

  it('deduplicates a repeated edge while preserving the next real tap', () => {
    let frame = createBrowserLift(CONFIG);
    for (const edge of ['press', 'press', 'release', 'release', 'press'] as const) frame = queueBrowserInput(frame, edge);
    assert.deepEqual(frame.inputs, ['press', 'release', 'press']);
  });

  it('clears held input and queued taps when paused without advancing the lift', () => {
    let frame = advanceBrowserLift(queueBrowserInput(createBrowserLift(CONFIG), 'press'), TICK_MS);
    frame = queueBrowserInput(frame, 'release');
    const paused = pauseBrowserLift(frame);
    assert.deepEqual(paused.state, { ...frame.state, held: false });
    assert.deepEqual(paused.inputs, []);
    assert.equal(paused.accumulatorMs, 0);
    assert.equal(paused.paused, true);
    assert.deepEqual(paused.events, [{ tick: 1, kind: 'press' }, { tick: 1, kind: 'clear-grip' }]);
    assert.equal(pauseBrowserLift(paused), paused);
    assert.equal(advanceBrowserLift(paused, TICK_MS * 10), paused);
    assert.equal(queueBrowserInput(paused, 'press'), paused);
    const resumed = resumeBrowserLift(paused);
    assert.equal(resumed.state.tick, frame.state.tick);
    assert.equal(resumed.paused, false);
    assert.equal(advanceBrowserLift(queueBrowserInput(resumed, 'press'), TICK_MS).state.held, true);
  });

  it('pauses a background-tab hitch without resolving or fast-forwarding a rep', () => {
    const frame = advanceBrowserLift(queueBrowserInput(createBrowserLift(CONFIG), 'press'), TICK_MS);
    const hitched = advanceBrowserLift(frame, BROWSER_LIFT_TUNING.HITCH_PAUSE_MS + 1);
    assert.equal(hitched.paused, true);
    assert.equal(hitched.state.tick, frame.state.tick);
    assert.equal(hitched.state.height, frame.state.height);
    assert.equal(hitched.state.phase, frame.state.phase);
    assert.equal(hitched.state.held, false);
  });

  it('caps a short hitch and discards excess catch-up debt', () => {
    const frame = queueBrowserInput(createBrowserLift(CONFIG), 'press');
    const hitched = advanceBrowserLift(frame, TICK_MS * 10);
    assert.equal(hitched.paused, false);
    assert.equal(hitched.state.tick, BROWSER_LIFT_TUNING.MAX_CATCH_UP_TICKS);
    assert.equal(advanceBrowserLift(hitched, 0).state.tick, hitched.state.tick);
  });

  it('ignores a clock moving backward or producing a non-finite value', () => {
    const frame = createBrowserLift(CONFIG);
    for (const elapsed of [-1, Infinity, NaN]) assert.equal(advanceBrowserLift(frame, elapsed), frame);
  });

  it('stops applying queued input after the real engine has resolved', () => {
    let state = stepLift(createLift(CONFIG), { kind: 'press' });
    for (let tick = 0; tick < PLAYBACK_LIMIT && state.phase !== 'RESOLVED'; tick += 1) state = stepLift(state);
    assert.equal(state.phase, 'RESOLVED');
    const frame = { ...createBrowserLift(CONFIG), state };
    assert.equal(queueBrowserInput(frame, 'press'), frame);
    assert.equal(advanceBrowserLift(frame, TICK_MS), frame);
  });
});

describe('sprite poses follow live bar positions', () => {
  const cases: readonly [LiftConfig['kind'], LiftPhase, number, number, number][] = [
    ['squat', 'BRACE', 0, 1, 1],
    ['squat', 'DESCENT', 0.4, 0.6, 2],
    ['squat', 'HOLE', 0.9, 0.1, 3],
    ['squat', 'ASCENT', 0.6, 0.4, 4],
    ['squat', 'ASCENT', 0.3, 0.7, 5],
    ['squat', 'LOCKOUT', 0, 1, 6],
    ['bench', 'BRACE', 0, 1, 1],
    ['bench', 'DESCENT', 0.5, 0.5, 2],
    ['bench', 'HOLE', 1, 0, 3],
    ['bench', 'ASCENT', 0.8, 0.2, 4],
    ['bench', 'ASCENT', 0.4, 0.6, 5],
    ['bench', 'ASCENT', 0.1, 0.9, 6],
    ['deadlift', 'BRACE', 1, 0, 1],
    ['deadlift', 'ASCENT', 0.9, 0.1, 1],
    ['deadlift', 'ASCENT', 0.7, 0.3, 2],
    ['deadlift', 'ASCENT', 0.5, 0.5, 3],
    ['deadlift', 'ASCENT', 0.3, 0.7, 4],
    ['deadlift', 'ASCENT', 0.1, 0.9, 5],
    ['deadlift', 'LOCKOUT', 0, 1, 6],
  ];
  for (const [kind, phase, depth, height, frame] of cases) {
    it(`${kind} ${phase} at bar height ${height} uses its authored frame`, () => {
      const state: LiftState = { ...createLift({ ...CONFIG, kind }), phase, depth, height };
      assert.equal(spriteFrameFor(state), frame);
    });
  }

  it('keeps a buried rep at its actual bottom pose instead of showing a made lift', () => {
    let state = stepLift(createLift(CONFIG), { kind: 'press' });
    for (let tick = 0; tick < PLAYBACK_LIMIT && state.phase !== 'RESOLVED'; tick += 1) state = stepLift(state);
    assert.equal(state.resolution?.missReason, 'buried');
    assert.equal(spriteFrameFor(state), 3);
  });
});

describe('accessible lift instructions', () => {
  it('offers the deadlift pull once the engine brace is settled and keeps hold-to-lower available', () => {
    const deadlift = createLift({ ...CONFIG, kind: 'deadlift' });
    assert.equal(liftControlIsReady(deadlift), false);
    let settled = deadlift;
    for (let tick = 0; tick < braceTicks(deadlift.config.loadRatio, 'deadlift'); tick += 1) settled = stepLift(settled);
    assert.equal(liftControlIsReady(settled), true);
    assert.match(liftControlCopy(settled, false).label, /Tap to pull/);
    assert.equal(stepLift(settled, { kind: 'press' }).phase, 'ASCENT');
    assert.equal(liftControlIsReady(createLift(CONFIG)), true);
    assert.equal(liftControlIsReady(createLift({ ...CONFIG, kind: 'bench' })), true);
    assert.equal(liftControlIsReady({ ...settled, phase: 'RESOLVED' }), false);
  });

  it('explains each lift’s accepted input rather than a common generic tap timer', () => {
    const squat = createLift(CONFIG);
    const bench = createLift({ ...CONFIG, kind: 'bench' });
    const deadlift = createLift({ ...CONFIG, kind: 'deadlift' });
    assert.match(liftControlCopy(squat, false).instruction, /Release/);
    assert.match(liftControlCopy(bench, false).instruction, /entire ascent/);
    assert.match(liftControlCopy(deadlift, false).instruction, /hold the lockout/);
    assert.match(liftControlCopy({ ...deadlift, phase: 'LOCKOUT', downCommandTick: 2, tick: 1 }, false).label, /do not let go/);
    assert.match(liftControlCopy({ ...deadlift, phase: 'LOCKOUT', downCommandTick: 2, tick: 2 }, false).label, /release/);
    assert.match(liftControlCopy(squat, true).instruction, /paused/);
  });

  it('switches the bench control from waiting to sustained tapping on the actual press command', () => {
    const bench: LiftState = { ...createLift({ ...CONFIG, kind: 'bench' }), phase: 'HOLE', tick: 1, pressCommandTick: 2 };
    assert.match(liftControlCopy(bench, false).label, /Wait/);
    assert.match(liftControlCopy({ ...bench, tick: 2 }, false).label, /Tap fast/);
    assert.match(liftControlCopy({ ...bench, tick: 2 }, false).instruction, /until the bar is locked out/);
  });
});

/** Plays through the unchanged public native engine, never an outcome fixture. */
function nextPlaybackInput(state: LiftState): LiftInputKind | null {
  const nextTick = state.tick + 1;
  if (state.phase === 'BRACE') {
    if (state.config.kind === 'deadlift' && !liftControlIsReady(state)) return null;
    return state.held ? null : 'press';
  }
  if (state.phase === 'DESCENT') {
    if (state.config.kind === 'squat' && state.activeCue?.idealTick === nextTick) return 'release';
    return null;
  }
  if (state.phase === 'LOCKOUT') {
    if (state.config.kind !== 'deadlift') return null;
    if (state.downCommandTick !== null && nextTick >= state.downCommandTick) return state.held ? 'release' : null;
    return state.held ? null : 'press';
  }
  if (state.phase === 'HOLE' || state.phase === 'ASCENT') {
    if (state.held) return 'release';
    if (state.config.kind === 'bench') return state.phase === 'ASCENT' || pressCommandIsLive(state) ? 'press' : null;
    return state.activeCue?.idealTick === nextTick ? 'press' : null;
  }
  return null;
}

function playBrowser(config: LiftConfig, interrupt = false): BrowserLiftFrame {
  let frame = createBrowserLift(config);
  let interrupted = false;
  for (let tick = 0; tick < PLAYBACK_LIMIT && frame.state.phase !== 'RESOLVED'; tick += 1) {
    if (interrupt && !interrupted && frame.state.phase === 'DESCENT' && frame.state.held) {
      const paused = pauseBrowserLift(frame);
      assert.equal(paused.state.tick, frame.state.tick);
      frame = queueBrowserInput(resumeBrowserLift(paused), 'press');
      interrupted = true;
    } else {
      const input = nextPlaybackInput(frame.state);
      if (input !== null) frame = queueBrowserInput(frame, input);
    }
    frame = advanceBrowserLift(frame, TICK_MS);
  }
  assert.equal(frame.state.phase, 'RESOLVED');
  if (interrupt) assert.equal(interrupted, true);
  return frame;
}

describe('server-replayable browser evidence', () => {
  it('does not issue evidence for an unfinished lift', () => {
    assert.throws(() => browserLiftEvidence(createBrowserLift(CONFIG)), /unfinished/);
  });

  for (const kind of ['squat', 'bench', 'deadlift'] as const) {
    it(`replays a real successful ${kind} from JSON input history`, () => {
      const config = { ...CONFIG, kind };
      const frame = playBrowser(config);
      assert.notEqual(frame.state.resolution?.outcome, 'miss');
      const evidence = JSON.parse(JSON.stringify(browserLiftEvidence(frame)));
      assert.deepEqual(replayLiftEvidence(evidence, config), frame.state.resolution);
    });
  }

  it('replays a paused bench grip without adding a native tick', () => {
    const config = { ...CONFIG, kind: 'bench' as const };
    const frame = playBrowser(config, true);
    assert.notEqual(frame.state.resolution?.outcome, 'miss');
    const evidence = JSON.parse(JSON.stringify(browserLiftEvidence(frame)));
    assert.equal(evidence.events.some((event: { kind: string }) => event.kind === 'clear-grip'), true);
    assert.deepEqual(replayLiftEvidence(evidence, config), frame.state.resolution);
  });
});
