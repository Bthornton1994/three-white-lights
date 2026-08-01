/**
 * Tests for the scripted-replay capture path.
 *
 * ---------------------------------------------------------------------------
 * WHAT THESE ARE FOR
 * ---------------------------------------------------------------------------
 * The capture path exists to produce EVIDENCE — photographs a critic judges
 * GDD §12.2's sprite bar against ("does a maximal attempt animate heavier than
 * a light one"). Evidence that is silently wrong is worse than no evidence: a
 * previous "maximal sequence" was three copies of one resolved NO LIFT frame,
 * and it passed a byte-hash check because a dev-menu glyph differed between
 * them.
 *
 * So everything below asserts the properties that failure violated:
 *
 *   - the scripted rep actually MAKES the lift, at every load on the screen, so
 *     there is a lockout to photograph
 *   - every named moment exists, and is in the phase it claims to be in
 *   - no two moments in a sequence land on the same tick
 *   - the ascent moments really are ascent moments, and the maximal one really
 *     is losing
 *
 * None of this says the drawing looks right. That is what the photographs are
 * for, and CLAUDE.md forbids claiming it from reasoning.
 */

import { describe, expect, it } from 'vitest';

import {
  CAPTURE_MOMENTS,
  CAPTURE_MOMENT_PHASE,
  CAPTURE_SEED,
  captureFrameFor,
  captureFrames,
  captureScript,
  replayProbe,
  replayProbeJson,
  type CaptureMomentId,
} from './liftReplay';
import { MOMENT_PARAM, REPLAY_PARAM, replayRequestFrom } from './replayRoute';
import { frameKey, liftFrameSpec, totalKgFor } from './liftFrame';
import { runLift } from '../game/lift';
import { LIFT_TUNING, LOAD_PRESETS, LOAD_RANGE, STICK_HEIGHT_FRAC } from '../game/liftTuning';
import { STICK } from '../art/spriteTuning';

const CHOICES = LIFT_TUNING.DEMO.LOAD_CHOICES;
const LIGHT = LOAD_PRESETS.LIGHT;
const MAXIMAL = LOAD_PRESETS.MAXIMAL;
const CAPTURE_TOTAL_KG = totalKgFor(MAXIMAL, CAPTURE_SEED);

function framesAt(load: number): ReturnType<typeof captureFrames> {
  return captureFrames(load);
}

function frameAt(load: number, moment: CaptureMomentId): ReturnType<typeof captureFrames>[number] {
  const found = framesAt(load).find((f) => f.moment === moment);
  if (found === undefined) throw new Error(`load ${load} never reached moment ${moment}`);
  return found;
}

describe('captureScript', () => {
  it('makes the lift at every load the screen offers', () => {
    // Without this the capture cannot photograph a lockout at all, and the
    // sequence quietly degrades into the failure it exists to prevent.
    for (const load of CHOICES) {
      const final = runLift({ loadRatio: load, seed: CAPTURE_SEED }, captureScript(load)).final;
      expect(final.resolution?.outcome, `load ${load}`).not.toBe('miss');
      expect(final.resolution?.depthAchieved, `load ${load}`).toBe(true);
      expect(final.peakHeight, `load ${load}`).toBe(1);
    }
  });

  it('presses, releases and presses again — in that order, and never lets go', () => {
    const script = captureScript(MAXIMAL);
    expect(script.map((s) => s.kind)).toEqual(['press', 'release', 'press']);
    for (let i = 1; i < script.length; i += 1) {
      expect(script[i]?.tick ?? 0).toBeGreaterThan(script[i - 1]?.tick ?? 0);
    }
  });

  it('releases and drives on the ticks the mechanic itself calls ideal', () => {
    // Pinned as a RELATION to the sim's own cues rather than to tick numbers, so
    // a tuning pass that moves the cue moves the capture with it. A capture
    // photographing a moment the game is no longer asking for is evidence of
    // nothing.
    const load = MAXIMAL;
    const script = captureScript(load);
    const replay = runLift({ loadRatio: load, seed: CAPTURE_SEED }, script);
    const depth = replay.final.timings.find((t) => t.cue === 'depth');
    const drive = replay.final.timings.find((t) => t.cue === 'drive');
    expect(depth?.offsetMs).toBe(0);
    expect(drive?.offsetMs).toBe(0);
    expect(depth?.grade).toBe('perfect');
    expect(drive?.grade).toBe('perfect');
  });
});

describe('captureFrames', () => {
  it('reaches every named moment at every load the screen offers', () => {
    for (const load of CHOICES) {
      const moments = framesAt(load).map((f) => f.moment);
      expect(moments, `load ${load}`).toEqual([...CAPTURE_MOMENTS]);
    }
  });

  it('puts every frame in the phase its moment claims', () => {
    // THE CHECK THAT WOULD HAVE CAUGHT THE OLD SEQUENCE. Three shots labelled
    // descent / hole / result all rendered RESOLVED.
    for (const load of CHOICES) {
      for (const frame of framesAt(load)) {
        expect(frame.state.phase, `load ${load} moment ${frame.moment}`).toBe(
          CAPTURE_MOMENT_PHASE[frame.moment],
        );
      }
    }
  });

  it('never lands two moments on the same tick', () => {
    for (const load of CHOICES) {
      const ticks = framesAt(load).map((f) => f.state.tick);
      expect(new Set(ticks).size, `load ${load} ticks ${ticks.join(',')}`).toBe(ticks.length);
    }
  });

  it('hands each frame exactly the history that had happened by then', () => {
    // The bar-path plot draws `history`. A frame carrying the WHOLE rep would
    // photograph a trace from the future.
    for (const load of CHOICES) {
      for (const frame of framesAt(load)) {
        expect(frame.history.length, `load ${load} ${frame.moment}`).toBe(frame.state.tick);
        expect(frame.history[frame.history.length - 1]).toBe(frame.state);
      }
    }
  });

  it('photographs the maximal attempt while it is losing, and the light one never losing', () => {
    // This is the mechanical half of GDD §12.2's sprite bar. The photographs are
    // the other half; this only guarantees there is something to photograph.
    expect(frameAt(MAXIMAL, 'losing').state.netForce).toBeLessThan(0);
    expect(frameAt(LIGHT, 'losing').state.netForce).toBeGreaterThanOrEqual(0);
  });

  it('photographs the maximal attempt at the height the sprite draws a stall at', () => {
    const frame = frameAt(MAXIMAL, 'sticking-point');
    expect(Math.abs(frame.state.height - STICK_HEIGHT_FRAC)).toBeLessThan(STICK.WIDTH);
  });

  it('draws the maximal attempt more strained than the light one at the same beat', () => {
    const strainAt = (load: number, moment: CaptureMomentId): number =>
      Number(replayProbe(frameAt(load, moment)).strainLevel);
    for (const moment of ['hole', 'sticking-point'] as const) {
      expect(strainAt(MAXIMAL, moment), `moment ${moment}`).toBeGreaterThan(
        strainAt(LIGHT, moment),
      );
    }
  });

  it('reports a moment a rep never reached as missing rather than substituting one', () => {
    // A rep that is never released buries itself: no hole, no ascent, no
    // lockout. What must NOT happen is that those moments come back holding the
    // resolved frame.
    const buried = captureFrames(LOAD_RANGE.MAX);
    expect(buried.length).toBeGreaterThan(0);
    for (const frame of buried) {
      expect(frame.state.phase).toBe(CAPTURE_MOMENT_PHASE[frame.moment]);
    }
  });
});

describe('captureFrameFor', () => {
  it('returns the frame a request names', () => {
    const frame = captureFrameFor({ loadRatio: MAXIMAL, moment: 'sticking-point' });
    expect(frame?.moment).toBe('sticking-point');
    expect(frame?.state.phase).toBe('ASCENT');
  });

  it('is deterministic', () => {
    const a = captureFrameFor({ loadRatio: MAXIMAL, moment: 'losing' });
    const b = captureFrameFor({ loadRatio: MAXIMAL, moment: 'losing' });
    expect(JSON.stringify(a?.state)).toBe(JSON.stringify(b?.state));
  });
});

describe('replayProbe', () => {
  it('gives every frame in a sequence a distinct readout', () => {
    // The whole point: two shots that look the same must not probe the same.
    for (const load of CHOICES) {
      const probes = framesAt(load).map((f) => replayProbeJson(f));
      expect(new Set(probes).size, `load ${load}`).toBe(probes.length);
    }
  });

  it('carries the phase, the prompt and the load the shot was taken at', () => {
    const probe = replayProbe(frameAt(MAXIMAL, 'sticking-point'));
    expect(probe.phase).toBe('ASCENT');
    expect(probe.loadRatio).toBe(MAXIMAL);
    expect(typeof probe.prompt).toBe('string');
    expect(String(probe.prompt).length).toBeGreaterThan(0);
  });

  it('carries the renderer cache key, so a stale frame is detectable', () => {
    // `tools/verify-lift-shots.mjs` requires two shots with different keys to be
    // different pixels inside the stage. Without the key here that check has
    // nothing to key off and degrades back into a byte hash — which is exactly
    // what let three identical resolved frames through.
    for (const frame of framesAt(MAXIMAL)) {
      expect(replayProbe(frame).frameKey).toBe(frameKey(liftFrameSpec(frame.state, CAPTURE_TOTAL_KG)));
    }
    const keys = framesAt(MAXIMAL).map((f) => replayProbe(f).frameKey);
    // The sprite must genuinely change across a rep. If this ever collapses to
    // one key the whole sequence draws the same picture nine times.
    expect(new Set(keys).size).toBeGreaterThan(keys.length / 2);
  });

  it('never leaks a fatigue number (GDD §3.4, §12.3)', () => {
    const text = JSON.stringify(
      CHOICES.flatMap((load) => framesAt(load).map((f) => replayProbe(f))),
    ).toLowerCase();
    for (const banned of ['fatigue', 'burden', 'residual', 'readiness', 'meter', 'widthms']) {
      expect(text, `probe leaks ${banned}`).not.toContain(banned);
    }
  });
});

describe('replayRequestFrom', () => {
  const query = (load: string, moment: string): string =>
    `?${REPLAY_PARAM}=${load}&${MOMENT_PARAM}=${moment}`;

  it('parses a well-formed request', () => {
    expect(replayRequestFrom(query('1', 'sticking-point'))).toEqual({
      loadRatio: 1,
      moment: 'sticking-point',
    });
    // Without the leading '?' too, because `location.search` is empty-string
    // when there is no query at all.
    expect(replayRequestFrom(`${REPLAY_PARAM}=0.55&${MOMENT_PARAM}=hole`)).toEqual({
      loadRatio: 0.55,
      moment: 'hole',
    });
  });

  it('refuses anything it does not recognise', () => {
    expect(replayRequestFrom('')).toBeNull();
    expect(replayRequestFrom('?other=1')).toBeNull();
    expect(replayRequestFrom(query('1', ''))).toBeNull();
    expect(replayRequestFrom(query('1', 'not-a-moment'))).toBeNull();
    expect(replayRequestFrom(query('banana', 'hole'))).toBeNull();
    expect(replayRequestFrom(`?${REPLAY_PARAM}=1`)).toBeNull();
    expect(replayRequestFrom(`?${MOMENT_PARAM}=hole`)).toBeNull();
  });

  it('refuses a load the mechanic would silently clamp', () => {
    // Otherwise a shot gets labelled with a load it was not taken at.
    expect(replayRequestFrom(query(String(LOAD_RANGE.MIN / 2), 'hole'))).toBeNull();
    expect(replayRequestFrom(query(String(LOAD_RANGE.MAX * 2), 'hole'))).toBeNull();
    expect(replayRequestFrom(query(String(LOAD_RANGE.MIN), 'hole'))).not.toBeNull();
    expect(replayRequestFrom(query(String(LOAD_RANGE.MAX), 'hole'))).not.toBeNull();
  });

  it('accepts every moment the capture list names', () => {
    for (const moment of CAPTURE_MOMENTS) {
      expect(replayRequestFrom(query('1', moment)), moment).toEqual({
        loadRatio: 1,
        moment,
      });
    }
  });
});
