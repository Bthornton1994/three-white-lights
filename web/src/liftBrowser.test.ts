import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { braceTicks, createLift, stepLift, type LiftConfig, type LiftPhase, type LiftState } from '../../src/game/lift';
import { LOAD_PRESETS, TICK_MS } from '../../src/game/liftTuning';
import {
  advanceBrowserLift,
  BROWSER_LIFT_TUNING,
  createBrowserLift,
  keySpriteBackdrop,
  liftControlCopy,
  liftControlIsReady,
  pauseBrowserLift,
  queueBrowserInput,
  resumeBrowserLift,
  spriteFrameFor,
  spritePathFor,
} from './liftBrowser';

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

  it('chooses each lift’s owned strain sheet at the accepted heavy load preset', () => {
    for (const kind of ['squat', 'bench', 'deadlift'] as const) {
      assert.equal(spritePathFor(createLift({ ...CONFIG, kind })), `/sprites/${kind}/frame-01.png`);
      assert.equal(spritePathFor(createLift({ ...CONFIG, kind, loadRatio: LOAD_PRESETS.HEAVY })), `/sprites/${kind}-max/frame-01.png`);
    }
  });

  it('keeps a buried rep at its actual bottom pose instead of showing a made lift', () => {
    let state = stepLift(createLift(CONFIG), { kind: 'press' });
    for (let tick = 0; tick < PLAYBACK_LIMIT && state.phase !== 'RESOLVED'; tick += 1) state = stepLift(state);
    assert.equal(state.resolution?.missReason, 'buried');
    assert.equal(spriteFrameFor(state), 3);
  });
});

describe('sprite display treatment', () => {
  it('keys connected backdrop colors and preserves enclosed athlete pixels', () => {
    const width = 5;
    const height = 5;
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let index = 0; index < width * height; index += 1) rgba.set([255, 0, 255, 255], index * 4);
    for (const [x, y] of [[1, 1], [2, 1], [3, 1], [1, 2], [3, 2], [1, 3], [2, 3], [3, 3]]) rgba.set([95, 64, 32, 255], ((y ?? 0) * width + (x ?? 0)) * 4);
    rgba.set([235, 0, 250, 255], 0);
    const original = new Uint8ClampedArray(rgba);
    const result = keySpriteBackdrop(rgba, width, height);
    assert.equal(result[3], 0);
    assert.equal(result[(2 * width + 2) * 4 + 3], 255);
    assert.equal(result[(1 * width + 1) * 4 + 3], 255);
    assert.deepEqual(rgba, original);
  });

  it('does not read beyond a malformed raster', () => {
    const rgba = new Uint8ClampedArray([255, 0, 255, 255]);
    assert.deepEqual(keySpriteBackdrop(rgba, 2, 2), rgba);
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
