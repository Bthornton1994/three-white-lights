/**
 * memberAnimation.test.ts — the member animation clips.
 *
 * TECHNICAL PASS only. These checks prove the clip table's shape, the
 * distance/time drive, the phase-locked bounce, the rep holds and crossfade,
 * and the snapshot interpolation's no-overshoot property. They do not prove
 * a member LOOKS alive — that is a human's read of captured frames.
 */

import { describe, expect, it } from 'vitest';

import { EMPIRE_TUNING } from './empireTuning';
import { FLOOR_SIM_MEMBER_STATES } from './floorSim';
import { FLOOR_SPRITE_POSES, FLOOR_STATION_USE_CLASSES } from './floorSprites';
import {
  MEMBER_ANIMATION_CLIPS,
  type MemberAnimationClip,
  advanceMemberAnimationPhase,
  easeOutCubic,
  advancePlaybackTick,
  memberAnimationBlend,
  memberAnimationClipFor,
  memberAnimationDrive,
  memberAnimationPeriod,
  memberAnimationPoses,
  memberAnimationStaggerMs,
  memberAnimationStartPhase,
  sampleMemberAnimation,
  samplePlayback,
  settleRemainder,
} from './memberAnimation';

const SAMPLE_STEPS = 64;

describe('the clip table', () => {
  it('maps every lifecycle × stepping × use class onto a clip, and reaches every clip', () => {
    const reached = new Set<MemberAnimationClip>();
    let checked = 0;
    for (const lifecycle of FLOOR_SIM_MEMBER_STATES) {
      for (const stepping of [false, true]) {
        for (const useClass of [...FLOOR_STATION_USE_CLASSES, null]) {
          const clip = memberAnimationClipFor(lifecycle, stepping, useClass);
          expect(MEMBER_ANIMATION_CLIPS).toContain(clip);
          reached.add(clip);
          checked += 1;
        }
      }
    }
    expect(checked).toBe(FLOOR_SIM_MEMBER_STATES.length * 2 * (FLOOR_STATION_USE_CLASSES.length + 1));
    expect([...reached].sort()).toEqual([...MEMBER_ANIMATION_CLIPS].sort());
  });

  it('draws using by the station class, interrupted as its own beat, queuing as wait, and a step in flight as walk', () => {
    expect(memberAnimationClipFor('using', false, 'bench')).toBe('use-bench');
    expect(memberAnimationClipFor('using', true, 'bar')).toBe('use-bar');
    expect(memberAnimationClipFor('using', false, 'generic')).toBe('use-generic');
    expect(memberAnimationClipFor('using', false, null)).toBe('use-generic');
    expect(memberAnimationClipFor('interrupted', true, 'bench')).toBe('interrupted');
    expect(memberAnimationClipFor('queuing', false, 'bench')).toBe('wait');
    expect(memberAnimationClipFor('queuing', true, 'bench')).toBe('walk');
    expect(memberAnimationClipFor('seeking', true, null)).toBe('walk');
    expect(memberAnimationClipFor('seeking', false, null)).toBe('idle');
    expect(memberAnimationClipFor('leaving', true, null)).toBe('walk');
    expect(memberAnimationClipFor('leaving', false, null)).toBe('idle');
  });

  it('drives only the walk by distance, gives every clip a positive period, and pre-mounts only registered poses', () => {
    let distanceClips = 0;
    for (const clip of MEMBER_ANIMATION_CLIPS) {
      if (memberAnimationDrive(clip) === 'distance') distanceClips += 1;
      expect(memberAnimationPeriod(clip)).toBeGreaterThan(0);
      const poses = memberAnimationPoses(clip);
      expect(poses.length).toBeGreaterThan(0);
      for (const pose of poses) expect(FLOOR_SPRITE_POSES).toContain(pose);
      expect(new Set(poses).size).toBe(poses.length);
    }
    expect(distanceClips).toBe(1);
    expect(memberAnimationDrive('walk')).toBe('distance');
    expect(memberAnimationPeriod('walk')).toBe(EMPIRE_TUNING.FLOOR_MEMBER_STRIDE_TILES);
    expect(memberAnimationPeriod('use-bench')).toBe(EMPIRE_TUNING.FLOOR_MEMBER_REP_PERIOD_MS);
    expect(memberAnimationPeriod('wait')).toBe(EMPIRE_TUNING.FLOOR_MEMBER_WAIT_SWAY_PERIOD_MS);
    expect(memberAnimationPeriod('idle')).toBe(EMPIRE_TUNING.AMBIENT_MEMBER_BOB_HALF_CYCLE_MS * 2);
    // The walk's distinct poses: contact and passing — the art set's two,
    // named as such in the module header rather than counted as more.
    expect([...memberAnimationPoses('walk')].sort()).toEqual(['stand', 'step-a', 'step-b']);
    expect(memberAnimationPoses('use-bench')).toEqual(['using-bench-a', 'using-bench-b']);
    expect(memberAnimationPoses('idle')).toEqual(['stand']);
  });

  it('staggers by roster ordinal deterministically and never past the lane count', () => {
    const lanes = EMPIRE_TUNING.AMBIENT_MEMBER_BOB_STAGGER_LANES;
    const step = EMPIRE_TUNING.AMBIENT_MEMBER_BOB_STAGGER_STEP_MS;
    const seen = new Set<number>();
    for (let ordinal = 0; ordinal < lanes * 3; ordinal += 1) {
      const stagger = memberAnimationStaggerMs(ordinal);
      expect(stagger).toBe((ordinal % lanes) * step);
      expect(stagger).toBe(memberAnimationStaggerMs(ordinal));
      seen.add(stagger);
    }
    expect(seen.size).toBe(lanes);
    expect(memberAnimationStaggerMs(-1)).toBe(step);
    // A time clip starts at the stagger's share of its period; the walk at contact.
    for (let ordinal = 0; ordinal < lanes; ordinal += 1) {
      expect(memberAnimationStartPhase('walk', ordinal)).toBe(0);
      const expected = (memberAnimationStaggerMs(ordinal) / EMPIRE_TUNING.FLOOR_MEMBER_REP_PERIOD_MS) % 1;
      expect(memberAnimationStartPhase('use-bench', ordinal)).toBeCloseTo(expected, 9);
      expect(memberAnimationStartPhase('idle', ordinal)).toBeGreaterThanOrEqual(0);
      expect(memberAnimationStartPhase('idle', ordinal)).toBeLessThan(1);
    }
  });
});

describe('the phase', () => {
  it('advances the walk by tiles moved and not by time, and every other clip by time and not by tiles', () => {
    const stride = EMPIRE_TUNING.FLOOR_MEMBER_STRIDE_TILES;
    expect(advanceMemberAnimationPhase('walk', 0, stride / 4, 1_000_000)).toBeCloseTo(1 / 4, 9);
    expect(advanceMemberAnimationPhase('walk', 0, 0, 1_000_000)).toBe(0);
    const rep = EMPIRE_TUNING.FLOOR_MEMBER_REP_PERIOD_MS;
    expect(advanceMemberAnimationPhase('use-bar', 0, 1_000, rep / 4)).toBeCloseTo(1 / 4, 9);
    expect(advanceMemberAnimationPhase('use-bar', 0, 1_000, 0)).toBe(0);
  });

  it('wraps into [0, 1) and ignores a negative or non-finite step', () => {
    const stride = EMPIRE_TUNING.FLOOR_MEMBER_STRIDE_TILES;
    expect(advanceMemberAnimationPhase('walk', 0.9, stride * 0.3, 0)).toBeCloseTo(0.2, 9);
    expect(advanceMemberAnimationPhase('walk', 0.5, stride * 2, 0)).toBeCloseTo(0.5, 9);
    expect(advanceMemberAnimationPhase('walk', 0.5, -stride, 0)).toBe(0.5);
    expect(advanceMemberAnimationPhase('idle', 0.25, 0, Number.NaN)).toBe(0.25);
    expect(advanceMemberAnimationPhase('idle', 0.25, 0, Number.POSITIVE_INFINITY)).toBe(0.25);
    let phase = 0;
    for (let frame = 0; frame < 10_000; frame += 1) {
      phase = advanceMemberAnimationPhase('wait', phase, 0, 16);
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(1);
    }
  });
});

describe('sampling', () => {
  it('walks: four slots in contact/passing order, hard cuts, the bounce lowest at contact and highest at passing', () => {
    const slots: string[] = [];
    let previousPose = '';
    for (let step = 0; step < SAMPLE_STEPS; step += 1) {
      const sample = sampleMemberAnimation('walk', step / SAMPLE_STEPS);
      expect(sample.frames.length).toBe(1);
      expect(sample.frames[0]?.opacity).toBe(1);
      expect(sample.leanDegrees).toBe(EMPIRE_TUNING.FLOOR_MEMBER_LEAN_DEGREES);
      const pose = sample.frames[0]?.pose as string;
      if (pose !== previousPose) slots.push(pose);
      previousPose = pose;
    }
    expect(slots).toEqual(['step-a', 'stand', 'step-b', 'stand']);
    const bounce = EMPIRE_TUNING.FLOOR_MEMBER_GAIT_BOUNCE_PIXELS;
    expect(sampleMemberAnimation('walk', 0).liftPixels).toBeCloseTo(0, 9);
    expect(sampleMemberAnimation('walk', 1 / 4).liftPixels).toBeCloseTo(bounce, 9);
    expect(sampleMemberAnimation('walk', 1 / 2).liftPixels).toBeCloseTo(0, 9);
    expect(sampleMemberAnimation('walk', 3 / 4).liftPixels).toBeCloseTo(bounce, 9);
    // Never below the feet, never above the knob.
    for (let step = 0; step < SAMPLE_STEPS; step += 1) {
      const lift = sampleMemberAnimation('walk', step / SAMPLE_STEPS).liftPixels;
      expect(lift).toBeGreaterThanOrEqual(0);
      expect(lift).toBeLessThanOrEqual(bounce + 1e-9);
    }
  });

  it('idles and waits standing: the breath rises and falls once per period, and only the wait and the beat lean', () => {
    const amplitude = EMPIRE_TUNING.AMBIENT_MEMBER_BOB_AMPLITUDE_PIXELS;
    const sway = EMPIRE_TUNING.FLOOR_MEMBER_WAIT_SWAY_DEGREES;
    for (const clip of ['idle', 'wait', 'interrupted'] as const) {
      let maxLift = 0;
      let maxLean = 0;
      let minLean = 0;
      for (let step = 0; step < SAMPLE_STEPS; step += 1) {
        const sample = sampleMemberAnimation(clip, step / SAMPLE_STEPS);
        expect(sample.frames).toEqual([{ pose: 'stand', opacity: 1 }]);
        maxLift = Math.max(maxLift, sample.liftPixels);
        maxLean = Math.max(maxLean, sample.leanDegrees);
        minLean = Math.min(minLean, sample.leanDegrees);
      }
      if (clip === 'interrupted') {
        expect(maxLift).toBe(0);
        expect(maxLean).toBeCloseTo(sway * 2, 6);
        expect(minLean).toBeCloseTo(-sway * 2, 6);
      } else {
        expect(maxLift).toBeCloseTo(amplitude, 6);
        expect(maxLean).toBeCloseTo(clip === 'wait' ? sway : 0, 6);
        expect(minLean).toBeCloseTo(clip === 'wait' ? -sway : 0, 6);
      }
    }
    expect(sampleMemberAnimation('idle', 0).liftPixels).toBeCloseTo(0, 9);
    expect(sampleMemberAnimation('idle', 1 / 2).liftPixels).toBeCloseTo(amplitude, 9);
  });

  it('reps: holds the lockout, crossfades to the bottom, holds it, crossfades back — opacities summing to one, no lift, no lean', () => {
    const hold = EMPIRE_TUNING.FLOOR_MEMBER_REP_HOLD_FRACTION;
    const travel = (1 - hold * 2) / 2;
    for (const clip of ['use-bench', 'use-bar', 'use-generic'] as const) {
      const [lockout, bottom] = memberAnimationPoses(clip);
      let holdsSeen = 0;
      let blendsSeen = 0;
      for (let step = 0; step < SAMPLE_STEPS; step += 1) {
        const p = step / SAMPLE_STEPS;
        const sample = sampleMemberAnimation(clip, p);
        expect(sample.liftPixels).toBe(0);
        expect(sample.leanDegrees).toBe(0);
        const total = sample.frames.reduce((sum, frame) => sum + frame.opacity, 0);
        expect(total).toBeCloseTo(1, 9);
        for (const frame of sample.frames) {
          expect(frame.opacity).toBeGreaterThan(0);
          expect(frame.opacity).toBeLessThanOrEqual(1);
        }
        if (p < hold) {
          expect(sample.frames).toEqual([{ pose: lockout, opacity: 1 }]);
          holdsSeen += 1;
        } else if (p >= hold + travel && p < hold * 2 + travel) {
          expect(sample.frames).toEqual([{ pose: bottom, opacity: 1 }]);
          holdsSeen += 1;
        } else {
          blendsSeen += 1;
        }
      }
      expect(holdsSeen).toBeGreaterThan(0);
      expect(blendsSeen).toBeGreaterThan(0);
      // The travel is monotone: descending, the bottom's opacity only rises.
      let previous = 0;
      for (let step = 0; step < SAMPLE_STEPS; step += 1) {
        const p = hold + (travel * step) / SAMPLE_STEPS;
        const bottomOpacity =
          sampleMemberAnimation(clip, p).frames.find((frame) => frame.pose === bottom)?.opacity ?? 0;
        expect(bottomOpacity).toBeGreaterThanOrEqual(previous);
        previous = bottomOpacity;
      }
      expect(previous).toBeGreaterThan(0.9);
    }
  });
});

describe('blend and snapshot helpers', () => {
  it('blends a clip change from 0 to 1 over FLOOR_MEMBER_CLIP_BLEND_MS, eased, monotone, clamped', () => {
    const duration = EMPIRE_TUNING.FLOOR_MEMBER_CLIP_BLEND_MS;
    expect(memberAnimationBlend(0)).toBe(0);
    expect(memberAnimationBlend(-5)).toBe(0);
    expect(memberAnimationBlend(duration)).toBe(1);
    expect(memberAnimationBlend(duration * 10)).toBe(1);
    expect(memberAnimationBlend(duration / 2)).toBeCloseTo(1 / 2, 9);
    let previous = 0;
    for (let ms = 0; ms <= duration; ms += 1) {
      const blend = memberAnimationBlend(ms);
      expect(blend).toBeGreaterThanOrEqual(previous);
      previous = blend;
    }
  });

  it('eases out: starts fast, arrives gently, clamps outside [0, 1]', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
    expect(easeOutCubic(1 / 2)).toBeGreaterThan(1 / 2);
    // The first quarter covers more than the last quarter: fast start, gentle arrival.
    expect(easeOutCubic(1 / 4)).toBeGreaterThan(1 - easeOutCubic(3 / 4));
  });

  it('plays back along a tick clock at the sim rate, holds with nothing newer, and catches up by a bounded rate', () => {
    const tick = EMPIRE_TUNING.FLOOR_SIM_TICK_INTERVAL_MS;
    const delay = EMPIRE_TUNING.FLOOR_MEMBER_RENDER_DELAY_TICKS;
    const gap = EMPIRE_TUNING.FLOOR_MEMBER_CATCH_UP_BEHIND_TICKS;
    const rate = EMPIRE_TUNING.FLOOR_MEMBER_CATCH_UP_RATE;
    // A fresh clock starts the render delay behind the newest snapshot.
    expect(advancePlaybackTick(null, 10, 16)).toBe(10 - delay);
    // One tick of real time advances one tick of playback, at any frame rate.
    expect(advancePlaybackTick(9, 10, tick)).toBeCloseTo(10, 9);
    expect(advancePlaybackTick(9, 10, tick / 4)).toBeCloseTo(9 + 1 / 4, 9);
    // Nothing newer: hold at the newest snapshot, never past it.
    expect(advancePlaybackTick(10, 10, tick * 5)).toBe(10);
    expect(advancePlaybackTick(9.9, 10, tick * 5)).toBe(10);
    // Behind by no more than the gap: the sim's own rate, not faster.
    expect(advancePlaybackTick(10, 10 + gap, tick)).toBeCloseTo(11, 9);
    // Behind by more than the gap: faster by exactly the catch-up rate.
    expect(advancePlaybackTick(10, 10 + gap + 3, tick)).toBeCloseTo(10 + (1 + rate), 9);
    // A stalled frame then bunched ticks: the clock never jumps, it slews.
    let clock: number | null = null;
    let largestStep = 0;
    let latest = 0;
    for (let frame = 0; frame < 400; frame += 1) {
      const elapsed = frame === 100 ? 600 : 16;
      // The sim ticks every 120 ms of wall time; after the 600 ms stall only
      // ONE tick fires (a coalesced interval), then they resume on schedule.
      if (frame % 8 === 0 || frame === 101) latest += 1;
      const next = advancePlaybackTick(clock, latest, elapsed);
      if (clock !== null) largestStep = Math.max(largestStep, (next - clock) / (elapsed / tick));
      clock = next;
    }
    expect(largestStep).toBeLessThanOrEqual(1 + rate + 1e-9);
    // Non-finite or negative elapsed advances nothing.
    expect(advancePlaybackTick(5, 9, Number.NaN)).toBe(5);
    expect(advancePlaybackTick(5, 9, -16)).toBe(5);
    expect(advancePlaybackTick(12, 9, 16)).toBe(9);
  });

  it('samples the buffer linearly between the two snapshots the clock sits between, clamped at both ends', () => {
    const buffer = [
      { tick: 3, x: 0, y: 0 },
      { tick: 4, x: 10, y: 20 },
      { tick: 6, x: 30, y: 60 },
    ];
    expect(samplePlayback([], 4)).toBeNull();
    expect(samplePlayback(buffer, 2)).toEqual({ x: 0, y: 0 });
    expect(samplePlayback(buffer, 3)).toEqual({ x: 0, y: 0 });
    expect(samplePlayback(buffer, 3.5)).toEqual({ x: 5, y: 10 });
    expect(samplePlayback(buffer, 4)).toEqual({ x: 10, y: 20 });
    // A two-tick span (a tick the buffer never saw) is still linear across it.
    expect(samplePlayback(buffer, 5)).toEqual({ x: 20, y: 40 });
    expect(samplePlayback(buffer, 6)).toEqual({ x: 30, y: 60 });
    expect(samplePlayback(buffer, 9)).toEqual({ x: 30, y: 60 });
    // Per-frame displacement never exceeds the segment over the frames in a
    // tick: sampled at a frame cadence, the largest single-frame move is
    // the step divided by the frames per tick.
    const frames = 8;
    let largest = 0;
    let last = samplePlayback(buffer, 3) as { x: number; y: number };
    for (let frame = 1; frame <= frames; frame += 1) {
      const at = samplePlayback(buffer, 3 + frame / frames) as { x: number; y: number };
      largest = Math.max(largest, Math.hypot(at.x - last.x, at.y - last.y));
      last = at;
    }
    expect(largest).toBeCloseTo(Math.hypot(10, 20) / frames, 9);
  });

  it('eases a settle out: the whole jump at the moment of it, nothing on or past the duration, monotone between', () => {
    const settle = EMPIRE_TUNING.FLOOR_MEMBER_SETTLE_MS;
    expect(settleRemainder(0, settle)).toBe(1);
    expect(settleRemainder(-5, settle)).toBe(1);
    expect(settleRemainder(settle, settle)).toBe(0);
    expect(settleRemainder(settle * 3, settle)).toBe(0);
    expect(settleRemainder(settle / 2, settle)).toBeLessThan(1 / 2);
    expect(settleRemainder(settle / 2, settle)).toBeGreaterThan(0);
    expect(settleRemainder(10, 0)).toBe(0);
    expect(settleRemainder(Number.NaN, settle)).toBe(0);
    let previous = 1;
    for (let ms = 0; ms <= settle; ms += 1) {
      const remainder = settleRemainder(ms, settle);
      expect(remainder).toBeLessThanOrEqual(previous);
      previous = remainder;
    }
  });
});
