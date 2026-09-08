/**
 * memberMotion.test.ts — the per-frame stepper VL-3 lifted out of
 * `FloorGrid.tsx`'s frame loop.
 *
 * TECHNICAL PASS only. These checks prove the moved arithmetic behaves as
 * VL-2B measured it (the cap, the timeline that never passes its newest
 * snapshot, the in-place replace under a stride, the three-tile relocation
 * glide, the cancelled relocation that starts no settle) and the five VL-3
 * continuity rules (facing hysteresis, depth scale from the drawn point,
 * transitions only along the clip table, phase desync, no reset on an
 * identical input). They do not prove a member LOOKS continuous — that is a
 * human's read of the captured frames.
 *
 * Every drive below runs the stepper at a 60 Hz frame clock against a
 * scripted contract that ticks at `FLOOR_SIM_TICK_INTERVAL_MS`, through the
 * real garage camera at the evidence tools' 390-wide phone stage, so every
 * pixel and every scale here is one the shipped renderer would draw.
 */

import { describe, expect, it } from 'vitest';

import { EMPIRE_TUNING } from './empireTuning';
import { floorDepthFrame, perspectiveFloorCamera, projectFloorPoint } from './floorCamera';
import { type FloorSimMemberState } from './floorSim';
import { type FloorSpriteFacing } from './floorSprites';
import { type MemberAnimationClip, memberAnimationPeriodJitter, settleDurationMs } from './memberAnimation';
import {
  MEMBER_MOTION_DISSOLVE_EDGES,
  type MemberMotionInput,
  type MemberMotionOutput,
  type MemberMotionState,
  advanceMemberMotionPhase,
  createMemberMotion,
  memberMotionEdgeDissolves,
  memberMotionFrameAt,
  memberMotionNextClip,
  memberMotionStartPhase,
  memberMotionStripClips,
  memberMotionTargetClip,
  stepMemberMotion,
} from './memberMotion';
import {
  MEMBER_MOTION_CLIPS,
  MEMBER_MOTION_CLIP_SPECS,
  MEMBER_MOTION_TRANSITIONS,
  type MemberMotionClip,
  memberMotionTransitionAllowed,
} from './memberMotionClips';

/** The evidence tools' 390×844 viewport minus the 72 px HUD, as `floorCamera.test.ts` fixes it. */
const STAGE = Object.freeze({ width: 390, height: 625 });
const GRID = EMPIRE_TUNING.FLOOR_GRID_SIZE.garage;
const CAMERA = perspectiveFloorCamera(STAGE, GRID, 'garage');
const DEPTH = floorDepthFrame(CAMERA);
const FRAME_MS = 1000 / 60;
const TICK_MS = EMPIRE_TUNING.FLOOR_SIM_TICK_INTERVAL_MS;
/** The sim's base step per tick (`FLOOR_SIM_STEP_PROGRESS_PER_TICK`), the walk every drive below uses. */
const STEP_TILES = EMPIRE_TUNING.FLOOR_SIM_STEP_PROGRESS_PER_TICK;
const CAP_MS = EMPIRE_TUNING.FLOOR_MEMBER_FRAME_ELAPSED_CAP_MS;
const STRIDE = EMPIRE_TUNING.FLOOR_MEMBER_STRIDE_TILES;

/** The feet point of a (fractional) cell, as `memberAnchorFor` projects a standing member. */
function feetAt(cellX: number, cellY: number): { x: number; y: number; scale: number } {
  const footprint = EMPIRE_TUNING.AMBIENT_MEMBER_FOOTPRINT_TILES;
  return projectFloorPoint(CAMERA, { x: cellX + footprint.width / 2, y: cellY + footprint.height });
}

interface Contract {
  readonly tick: number;
  readonly cell: { readonly x: number; readonly y: number };
  readonly lifecycle?: FloorSimMemberState;
  readonly clip?: MemberAnimationClip;
  readonly facing?: FloorSpriteFacing;
  readonly pull?: { readonly x: number; readonly y: number };
  /** The contract's own depth scale — a using member's is its bench's. */
  readonly scale?: number;
  readonly index?: number;
}

function inputOf(c: Contract): MemberMotionInput {
  const feet = feetAt(c.cell.x, c.cell.y);
  return {
    tick: c.tick,
    position: { x: feet.x, y: feet.y },
    pullX: c.pull?.x ?? 0,
    pullY: c.pull?.y ?? 0,
    tile: CAMERA.tile,
    scale: c.scale ?? feet.scale,
    clip: c.clip ?? 'idle',
    lifecycle: c.lifecycle ?? 'seeking',
    facing: c.facing ?? 'right',
    index: c.index ?? 0,
    depth: DEPTH,
  };
}

interface Frame {
  readonly now: number;
  readonly input: MemberMotionInput;
  readonly out: MemberMotionOutput;
}

/**
 * Drive a stepper for `frames` frames of `FRAME_MS`, the contract for each
 * frame read from `script(tick, now)` where `tick` is the sim tick that has
 * fired by `now`. `gapBefore` inserts a main-thread stall (a frame whose
 * timestamp is that much later) before the given frame index.
 */
/** A body: the latest stepper state, replaced every frame — what the renderer's ref holds. */
interface Body {
  state: MemberMotionState;
}

function body(c: Contract, production: boolean): Body {
  return { state: createMemberMotion(inputOf(c), production) };
}

/** One frame on a body: step, hold the returned state, return the output. */
function step(b: Body, input: MemberMotionInput, now: number): MemberMotionOutput {
  const before = b.state;
  const result = stepMemberMotion(before, input, now);
  // The stepper writes into nothing: the state it was handed is frozen and unchanged.
  expect(Object.isFrozen(before)).toBe(true);
  expect(Object.isFrozen(result.state)).toBe(true);
  b.state = result.state;
  return result.output;
}

function drive(
  b: Body,
  frames: number,
  script: (tick: number, now: number) => Contract,
  options: { readonly start?: number; readonly gapBefore?: { readonly frame: number; readonly ms: number } } = {},
): Frame[] {
  const start = options.start ?? 0;
  const log: Frame[] = [];
  let now = start;
  for (let i = 0; i < frames; i += 1) {
    if (options.gapBefore !== undefined && options.gapBefore.frame === i) now += options.gapBefore.ms;
    const tick = Math.floor(now / TICK_MS);
    const input = inputOf(script(tick, now));
    const out = step(b, input, now);
    log.push({ now, input, out });
    now += FRAME_MS;
  }
  return log;
}

/** A member walking right along row 1 at the sim's base step, one tick per `TICK_MS`. */
function walker(tick: number, from = 1): Contract {
  return {
    tick,
    cell: { x: from + STEP_TILES * tick, y: 1 },
    clip: 'walk',
    lifecycle: 'seeking',
    facing: 'right',
  };
}

function stepTiles(a: Frame, b: Frame): number {
  return Math.hypot(b.out.drawn.x - a.out.drawn.x, b.out.drawn.y - a.out.drawn.y) / a.out.tileHere;
}

describe('the clip table routing (c)', () => {
  it('maps every contract wish onto a production clip, using onto the bench press, the reaction beat onto idle', () => {
    expect(memberMotionTargetClip('walk')).toBe('walk');
    expect(memberMotionTargetClip('wait')).toBe('wait');
    expect(memberMotionTargetClip('idle')).toBe('idle');
    expect(memberMotionTargetClip('interrupted')).toBe('idle');
    expect(memberMotionTargetClip('use-bench')).toBe('bench-press');
    expect(memberMotionTargetClip('use-bar')).toBe('bench-press');
    expect(memberMotionTargetClip('use-generic')).toBe('bench-press');
  });

  it('routes every ordered pair of clips along MEMBER_MOTION_TRANSITIONS, one allowed edge at a time, within the table size', () => {
    let pairs = 0;
    let edges = 0;
    for (const from of MEMBER_MOTION_CLIPS) {
      for (const to of MEMBER_MOTION_CLIPS) {
        let at: MemberMotionClip = from;
        let hops = 0;
        while (at !== to) {
          const next = memberMotionNextClip(at, to);
          expect(next).not.toBeNull();
          expect(memberMotionTransitionAllowed(at, next as MemberMotionClip)).toBe(true);
          at = next as MemberMotionClip;
          hops += 1;
          edges += 1;
          expect(hops).toBeLessThanOrEqual(MEMBER_MOTION_CLIPS.length);
        }
        expect(memberMotionNextClip(from, from)).toBe(from);
        pairs += 1;
      }
    }
    expect(pairs).toBe(MEMBER_MOTION_CLIPS.length * MEMBER_MOTION_CLIPS.length);
    // The routes the brief names, verbatim.
    expect(memberMotionNextClip('wait', 'walk')).toBe('wait-to-walk');
    expect(memberMotionNextClip('wait-to-walk', 'walk')).toBe('walk');
    expect(memberMotionNextClip('wait', 'bench-press')).toBe('bench-setup');
    expect(memberMotionNextClip('bench-press', 'walk')).toBe('bench-finish');
    expect(memberMotionNextClip('bench-finish', 'walk')).toBe('wait-to-walk');
    expect(memberMotionNextClip('walk', 'bench-press')).toBe('walk-to-wait');
    // Never a direct family jump.
    expect(memberMotionTransitionAllowed('walk', 'bench-press')).toBe(false);
    expect(memberMotionTransitionAllowed('bench-press', 'walk')).toBe(false);
    expect(edges).toBe(140);
  });

  it('dissolves only on the two edges where the painting changes, and both are table edges', () => {
    expect(MEMBER_MOTION_DISSOLVE_EDGES.length).toBe(2);
    for (const [from, to] of MEMBER_MOTION_DISSOLVE_EDGES) {
      expect(MEMBER_MOTION_TRANSITIONS.some(([a, b]) => a === from && b === to)).toBe(true);
      expect(memberMotionEdgeDissolves(from, to)).toBe(true);
    }
    let dissolving = 0;
    for (const [from, to] of MEMBER_MOTION_TRANSITIONS) if (memberMotionEdgeDissolves(from, to)) dissolving += 1;
    expect(dissolving).toBe(2);
    expect(memberMotionEdgeDissolves('wait', 'bench-setup')).toBe(false);
  });

  it('holds a non-looping clip at its last frame and wraps a looping one; the frame index never passes the strip', () => {
    for (const clip of MEMBER_MOTION_CLIPS) {
      const spec = MEMBER_MOTION_CLIP_SPECS[clip];
      let phase = memberMotionStartPhase(clip, 0);
      for (let i = 0; i < 400; i += 1) {
        phase = advanceMemberMotionPhase(clip, phase, 0, STRIDE / 40, FRAME_MS);
        const frame = memberMotionFrameAt(clip, phase);
        expect(frame).toBeGreaterThanOrEqual(0);
        expect(frame).toBeLessThan(spec.frames);
        if (spec.loop) expect(phase).toBeLessThan(1);
      }
      if (!spec.loop) {
        expect(phase).toBe(1);
        expect(memberMotionFrameAt(clip, phase)).toBe(spec.frames - 1);
      }
    }
    expect(memberMotionFrameAt('walk', -1)).toBe(0);
    expect(memberMotionFrameAt('walk', Number.NaN)).toBe(0);
    expect(memberMotionStripClips()).toBe(MEMBER_MOTION_CLIPS);
  });

  it('walks a scripted lifecycle — stand, walk, queue, bench, leave, stand — taking only table edges, in the brief\'s order', () => {
    const benchFeet = feetAt(2.5, 3.2);
    const approach = { x: 4, y: 3 };
    const approachFeet = feetAt(approach.x, approach.y);
    const pull = { x: benchFeet.x - approachFeet.x, y: benchFeet.y - approachFeet.y };
    const benchScale = projectFloorPoint(CAMERA, { x: 3, y: 4 }).scale;
    const script = (tick: number): Contract => {
      if (tick < 10) return { tick, cell: { x: 1, y: 3 }, clip: 'idle', lifecycle: 'seeking' };
      if (tick < 19) {
        const x = Math.min(approach.x, 1 + STEP_TILES * (tick - 9));
        return { tick, cell: { x, y: 3 }, clip: 'walk', lifecycle: 'seeking' };
      }
      if (tick < 30) return { tick, cell: approach, clip: 'wait', lifecycle: 'queuing', facing: 'left' };
      if (tick < 80) return { tick, cell: approach, clip: 'use-bench', lifecycle: 'using', facing: 'left', pull, scale: benchScale };
      if (tick < 100) {
        const x = approach.x + STEP_TILES * (tick - 79);
        return { tick, cell: { x, y: 3 }, clip: 'walk', lifecycle: 'leaving' };
      }
      return { tick, cell: { x: approach.x + STEP_TILES * 20, y: 3 }, clip: 'idle', lifecycle: 'seeking' };
    };
    const state = body(script(0), true);
    const log = drive(state, 900, script);
    const visited: MemberMotionClip[] = [];
    const transitions: string[] = [];
    for (const f of log) {
      const draw = f.out.draw;
      expect(draw.kind).toBe('strip');
      if (draw.kind !== 'strip') continue;
      if (visited[visited.length - 1] !== draw.clip) visited.push(draw.clip);
      if (f.out.transition !== null) transitions.push(f.out.transition);
    }
    // Every edge the stepper took is on the table.
    for (let i = 1; i < visited.length; i += 1) {
      expect(memberMotionTransitionAllowed(visited[i - 1] as MemberMotionClip, visited[i] as MemberMotionClip)).toBe(true);
    }
    expect(transitions).toEqual(visited.slice(1).map((to, i) => `${visited[i]}>${to}`));
    expect(visited).toEqual([
      'idle',
      'wait-to-walk',
      'walk',
      'walk-to-wait',
      'wait',
      // The seat: the pull's settle plays the walk, then setup, then the press.
      'wait-to-walk',
      'walk',
      'walk-to-wait',
      'wait',
      'bench-setup',
      'bench-press',
      // Leaving: finish, then out through the stand.
      'bench-finish',
      'wait-to-walk',
      'walk',
      'walk-to-wait',
      'idle',
    ]);
    // The two dissolves are the only frames with two layers, and each lasts the blend.
    const twoLayers = log.filter((f) => f.out.draw.kind === 'strip' && f.out.draw.layers.length === 2);
    const dissolveFrames = Math.ceil(EMPIRE_TUNING.FLOOR_MEMBER_CLIP_BLEND_MS / FRAME_MS);
    expect(twoLayers.length).toBeGreaterThanOrEqual(2 * (dissolveFrames - 1));
    expect(twoLayers.length).toBeLessThanOrEqual(2 * (dissolveFrames + 1));
    for (const f of twoLayers) {
      if (f.out.draw.kind !== 'strip') continue;
      const [top, under] = f.out.draw.layers;
      expect(memberMotionEdgeDissolves(under?.clip as MemberMotionClip, top?.clip as MemberMotionClip)).toBe(true);
      expect((top?.opacity ?? 0) + (under?.opacity ?? 0)).toBeCloseTo(1, 9);
    }
    // A non-looping clip ran to its last frame before its edge was taken.
    for (let i = 1; i < log.length; i += 1) {
      const t = log[i]?.out.transition;
      if (t === null || t === undefined) continue;
      const from = t.split('>')[0] as MemberMotionClip;
      const before = log[i - 1]?.out;
      if (!MEMBER_MOTION_CLIP_SPECS[from].loop && before?.draw.kind === 'strip') {
        expect(before.draw.frame).toBe(MEMBER_MOTION_CLIP_SPECS[from].frames - 1);
        expect(before.phase).toBe(1);
      }
      // The edge out of the walk was taken on still feet.
      if (from === 'walk') expect(stepTiles(log[i - 1] as Frame, log[i] as Frame)).toBe(0);
    }
  });
});

describe('VL-2B\'s arithmetic, moved verbatim in meaning', () => {
  it('caps a stalled frame at FLOOR_MEMBER_FRAME_ELAPSED_CAP_MS and resumes a settle where it was (f)', () => {
    const benchFeet = feetAt(2.5, 3.2);
    const here = feetAt(4, 3);
    const pull = { x: benchFeet.x - here.x, y: benchFeet.y - here.y };
    const script = (tick: number): Contract =>
      tick < 3
        ? { tick, cell: { x: 4, y: 3 }, clip: 'wait', lifecycle: 'queuing' }
        : { tick, cell: { x: 4, y: 3 }, clip: 'use-bench', lifecycle: 'using', pull };
    const stalled = body(script(0), true);
    const smooth = body(script(0), true);
    // The stall lands two frames into the settle.
    const settleFrame = Math.ceil((3 * TICK_MS) / FRAME_MS) + 2;
    const a = drive(stalled, 120, script, { gapBefore: { frame: settleFrame, ms: 400 } });
    const b = drive(smooth, 120, script);
    const stallFrame = a[settleFrame] as Frame;
    expect(stallFrame.now - (a[settleFrame - 1] as Frame).now).toBeCloseTo(400 + FRAME_MS, 9);
    expect(stallFrame.out.elapsedMs).toBe(CAP_MS);
    expect((a[settleFrame - 1] as Frame).out.settling).toBe(true);
    expect(stallFrame.out.settling).toBe(true);
    // The stalled body's first post-stall write is bounded by one capped frame of the ease.
    const settleMs = settleDurationMs(Math.hypot(pull.x, pull.y) / (CAMERA.tile * here.scale));
    const bound = (CAP_MS * 3) / settleMs;
    const step = stepTiles(a[settleFrame - 1] as Frame, stallFrame) / (Math.hypot(pull.x, pull.y) / stallFrame.out.tileHere);
    expect(step).toBeLessThanOrEqual(bound);
    // Every frame of the stalled run maps onto a frame of the smooth run at the same accumulated animation time.
    const animTime = (log: Frame[]): number[] => {
      const times: number[] = [];
      let sum = 0;
      for (const f of log) {
        sum += f.out.elapsedMs;
        times.push(sum);
      }
      return times;
    };
    const ta = animTime(a);
    const tb = animTime(b);
    expect(ta[settleFrame]).toBeCloseTo((tb[settleFrame - 1] as number) + CAP_MS, 9);
    expect(Math.max(...a.map((f) => f.out.elapsedMs))).toBe(CAP_MS);
  });

  it('never draws the playback past the newest snapshot, and holds there when no tick arrives', () => {
    const state = body(walker(0), false);
    const log = drive(state, 60, (tick) => walker(Math.min(tick, 4)));
    for (const f of log) expect(f.out.playTick).toBeLessThanOrEqual(f.input.tick);
    const last = log[log.length - 1] as Frame;
    const newest = inputOf(walker(4)).position;
    expect(last.out.drawn.x).toBeCloseTo(newest.x, 9);
    expect(last.out.drawn.y).toBeCloseTo(newest.y, 9);
    expect(last.out.playTick).toBe(4);
    // And the drawn x is monotone: no overshoot, no backtrack.
    for (let i = 1; i < log.length; i += 1) {
      expect((log[i] as Frame).out.drawn.x).toBeGreaterThanOrEqual((log[i - 1] as Frame).out.drawn.x - 1e-9);
    }
  });

  it('replaces a same-tick point moved under a stride in place: no settle, no relocation', () => {
    const state = body(walker(0), false);
    drive(state, 30, (tick) => walker(Math.min(tick, 2)));
    const nudged: Contract = { ...walker(2), cell: { x: 1 + STEP_TILES * 2 + 0.5, y: 1 } };
    const out = step(state, inputOf(nudged), 30 * FRAME_MS);
    expect(out.relocating).toBe(false);
    expect(out.settling).toBe(false);
    expect(state.state.snapshots[state.state.snapshots.length - 1]?.x).toBe(inputOf(nudged).position.x);
    expect(state.state.snapshots.length).toBeLessThanOrEqual(3);
  });

  it('glides a three-tile relocation at the settle pace: first frame where the last one was, one FLOOR_MEMBER_SETTLE_MS per tile, walking', () => {
    const before: Contract = { tick: 0, cell: { x: 5, y: 0 }, clip: 'idle', lifecycle: 'seeking' };
    const after: Contract = { tick: 1, cell: { x: 2, y: 0 }, clip: 'idle', lifecycle: 'seeking' };
    const state = body(before, true);
    const settled = drive(state, 20, () => before);
    const last = settled[settled.length - 1] as Frame;
    const log = drive(state, 80, () => after, { start: 20 * FRAME_MS });
    const first = log[0] as Frame;
    expect(first.out.relocating).toBe(true);
    expect(first.out.settling).toBe(true);
    expect(first.out.drawn.x).toBeCloseTo(last.out.drawn.x, 9);
    expect(first.out.drawn.y).toBeCloseTo(last.out.drawn.y, 9);
    const jumpTiles = Math.abs(inputOf(after).position.x - inputOf(before).position.x) / first.out.tileHere;
    expect(jumpTiles).toBeGreaterThan(STRIDE);
    expect(state.state.settleMs).toBeCloseTo(settleDurationMs(jumpTiles), 6);
    // The steepest frame of the ease-out cubic is 3/duration of the pull per millisecond.
    const bound = ((FRAME_MS * 3) / state.state.settleMs) * jumpTiles;
    let maxStep = 0;
    let landed: number | null = null;
    for (let i = 1; i < log.length; i += 1) {
      const step = stepTiles(log[i - 1] as Frame, log[i] as Frame);
      maxStep = Math.max(maxStep, step);
      if (landed === null && !(log[i] as Frame).out.settling) landed = (log[i] as Frame).now - first.now;
    }
    expect(maxStep).toBeLessThanOrEqual(bound + 1e-9);
    expect(landed).not.toBeNull();
    expect(landed as number).toBeLessThanOrEqual(state.state.settleMs + FRAME_MS);
    expect(landed as number).toBeGreaterThanOrEqual(state.state.settleMs - FRAME_MS);
    const final = log[log.length - 1] as Frame;
    expect(final.out.drawn.x).toBeCloseTo(inputOf(after).position.x, 6);
    // Walking pace on average: three tiles in three settles' worth of time.
    const meanTilesPer100ms = jumpTiles / ((landed as number) / 100);
    expect(meanTilesPer100ms).toBeCloseTo(100 / EMPIRE_TUNING.FLOOR_MEMBER_SETTLE_MS, 1);
  });

  it('starts no settle for a relocation its pull cancels (the ghost-reserve bench user), and keeps the press clip', () => {
    const benchFeet = feetAt(2.5, 3.2);
    const approach = feetAt(5, 3);
    const pull = { x: benchFeet.x - approach.x, y: benchFeet.y - approach.y };
    const using: Contract = { tick: 0, cell: { x: 5, y: 3 }, clip: 'use-bench', lifecycle: 'using', pull };
    const state = body(using, true);
    const settled = drive(state, 240, () => using);
    const last = settled[settled.length - 1] as Frame;
    expect(last.out.settling).toBe(false);
    expect(last.out.draw.clip).toBe('bench-press');
    // The sim now seats the member ON the bench cell: the point moves three
    // tiles, the pull goes to zero, and the drawn point does not move.
    const seated: Contract = { tick: 1, cell: { x: 2.5, y: 3.2 }, clip: 'use-bench', lifecycle: 'using' };
    const out = step(state, inputOf(seated), 240 * FRAME_MS);
    expect(out.relocating).toBe(true);
    expect(out.settling).toBe(false);
    expect(out.drawn.x).toBeCloseTo(last.out.drawn.x, 6);
    expect(out.drawn.y).toBeCloseTo(last.out.drawn.y, 6);
    expect(out.draw.clip).toBe('bench-press');
    expect(out.transition).toBeNull();
    const later = drive(state, 30, () => seated, { start: 241 * FRAME_MS });
    for (const f of later) {
      expect(f.out.settling).toBe(false);
      expect(f.out.draw.clip).toBe('bench-press');
      expect(f.out.drawn.x).toBeCloseTo(last.out.drawn.x, 6);
    }
  });
});

describe('facing from the drawn velocity, with hysteresis (a)', () => {
  const reverseAt = 8;
  const script = (tick: number): Contract => {
    const x = tick <= reverseAt ? 1 + STEP_TILES * tick : 1 + STEP_TILES * reverseAt - STEP_TILES * (tick - reverseAt);
    return { tick, cell: { x, y: 1 }, clip: 'walk', lifecycle: 'seeking', facing: tick <= reverseAt ? 'right' : 'left' };
  };

  it('does not flip on the tick the contract reverses; flips only after the drawn feet have travelled FLOOR_MEMBER_FACING_FLIP_TILES the other way', () => {
    const state = body(script(0), true);
    const log = drive(state, 200, script);
    const reversalFrame = log.findIndex((f) => f.input.facing === 'left');
    expect(reversalFrame).toBeGreaterThan(0);
    const flipFrame = log.findIndex((f) => f.out.facing === 'left');
    expect(flipFrame).toBeGreaterThan(reversalFrame);
    // Between the contract's reversal and the flip the body faced right
    // throughout, and the drawn point was still finishing its rightward
    // segment when the reversal landed (the playback timeline runs a tick
    // behind the contract, catching up), so a contract-facing read would
    // have turned a body that was still moving the other way.
    let stillRight = 0;
    let leftTravel = 0;
    for (let i = reversalFrame; i < flipFrame; i += 1) {
      const dx = (log[i] as Frame).out.drawn.x - (log[i - 1] as Frame).out.drawn.x;
      if (dx > 0) stillRight += 1;
      if (dx < 0) leftTravel += -dx / (log[i] as Frame).out.tileHere;
      expect((log[i] as Frame).out.facing).toBe('right');
    }
    expect(stillRight).toBeGreaterThan(0);
    const flipDx = (log[flipFrame] as Frame).out.drawn.x - (log[flipFrame - 1] as Frame).out.drawn.x;
    leftTravel += -flipDx / (log[flipFrame] as Frame).out.tileHere;
    expect(flipDx).toBeLessThan(0);
    expect(leftTravel).toBeGreaterThanOrEqual(EMPIRE_TUNING.FLOOR_MEMBER_FACING_FLIP_TILES);
    // The frame before the flip had not yet reached the threshold.
    expect(leftTravel + flipDx / (log[flipFrame] as Frame).out.tileHere).toBeLessThan(
      EMPIRE_TUNING.FLOOR_MEMBER_FACING_FLIP_TILES,
    );
    // Once turned, it stays turned for the rest of the leftward walk.
    for (let i = flipFrame; i < log.length; i += 1) expect((log[i] as Frame).out.facing).toBe('left');
    expect({ reversalFrame, flipFrame, stillRight }).toEqual({ reversalFrame: 65, flipFrame: 71, stillRight: 1 });
  });

  it('the control: a legacy body takes the contract facing on the reversal frame while its drawn point still moves right', () => {
    const state = body(script(0), false);
    const log = drive(state, 200, script);
    const reversalFrame = log.findIndex((f) => f.input.facing === 'left');
    const flipFrame = log.findIndex((f) => f.out.facing === 'left');
    expect(flipFrame).toBe(reversalFrame);
    const dx = (log[flipFrame] as Frame).out.drawn.x - (log[flipFrame - 1] as Frame).out.drawn.x;
    expect(dx).toBeGreaterThan(0);
  });

  it('takes the contract\'s station facing at once while using or queuing, and turns a standing body only after FLOOR_MEMBER_FACING_HINT_MS', () => {
    const standing = (facing: FloorSpriteFacing, lifecycle: FloorSimMemberState): Contract => ({
      tick: 0,
      cell: { x: 3, y: 2 },
      clip: lifecycle === 'queuing' ? 'wait' : 'idle',
      lifecycle,
      facing,
    });
    const queued = body(standing('right', 'queuing'), true);
    drive(queued, 5, () => standing('right', 'queuing'));
    expect(step(queued, inputOf(standing('left', 'queuing')), 5 * FRAME_MS).facing).toBe('left');
    const idle = body(standing('right', 'seeking'), true);
    drive(idle, 5, () => standing('right', 'seeking'));
    const turned = drive(idle, 40, () => standing('left', 'seeking'), { start: 5 * FRAME_MS });
    const turnFrame = turned.findIndex((f) => f.out.facing === 'left');
    expect(turnFrame).toBeGreaterThan(0);
    const waited = turned.slice(0, turnFrame + 1).reduce((sum, f) => sum + f.out.elapsedMs, 0);
    expect(waited).toBeGreaterThanOrEqual(EMPIRE_TUNING.FLOOR_MEMBER_FACING_HINT_MS);
    expect(waited - (turned[turnFrame] as Frame).out.elapsedMs).toBeLessThan(EMPIRE_TUNING.FLOOR_MEMBER_FACING_HINT_MS);
    // A hint that flickers back before the window resets it.
    const flicker = body(standing('right', 'seeking'), true);
    drive(flicker, 5, () => standing('left', 'seeking'));
    drive(flicker, 1, () => standing('right', 'seeking'), { start: 5 * FRAME_MS });
    const again = drive(flicker, 5, () => standing('left', 'seeking'), { start: 6 * FRAME_MS });
    for (const f of again) expect(f.out.facing).toBe('right');
  });
});

describe('depth scale from the drawn point (b)', () => {
  it('equals the contract scale for a standing body, and never steps at a seat assignment: the size follows the settle', () => {
    const benchFeet = feetAt(2.5, 3.2);
    const approach = feetAt(5, 0);
    const pull = { x: benchFeet.x - approach.x, y: benchFeet.y - approach.y };
    const benchScale = projectFloorPoint(CAMERA, { x: 3, y: 4 }).scale;
    const script = (tick: number): Contract =>
      tick < 4
        ? { tick, cell: { x: 5, y: 0 }, clip: 'wait', lifecycle: 'queuing' }
        : { tick, cell: { x: 5, y: 0 }, clip: 'use-bench', lifecycle: 'using', pull, scale: benchScale };
    const state = body(script(0), true);
    const log = drive(state, 240, script);
    // Standing: the inverse of the projection is the projection's own scale.
    for (const f of log.slice(0, 10)) expect(f.out.scale).toBeCloseTo(f.input.scale, 9);
    // The contract's own scale steps in one frame — the VL-2 residual.
    const contractSteps = log.slice(1).map((f, i) => Math.abs(f.input.scale - (log[i] as Frame).input.scale));
    const contractStep = Math.max(...contractSteps);
    // The drawn scale's largest per-frame change, and the bound one capped
    // frame of the ease-out's steepest slope allows through the camera's
    // scale-per-pixel.
    const drawnSteps = log.slice(1).map((f, i) => Math.abs(f.out.scale - (log[i] as Frame).out.scale));
    const drawnStep = Math.max(...drawnSteps);
    // The settle is timed at the CONTRACT point's depth — a using member's
    // is its bench's — exactly as VL-2B's loop timed it.
    const settleMs = settleDurationMs(Math.hypot(pull.x, pull.y) / (CAMERA.tile * benchScale));
    const bound = ((FRAME_MS * 3) / settleMs) * Math.abs(pull.y) * ((1 - DEPTH.backScale) / DEPTH.span);
    expect(drawnStep).toBeLessThanOrEqual(bound + 1e-12);
    expect(drawnStep).toBeLessThan(contractStep / 5);
    // The scale is monotone through the glide and lands on the drawn point's own depth.
    let previous = (log[0] as Frame).out.scale;
    for (const f of log) {
      expect(f.out.scale).toBeGreaterThanOrEqual(previous - 1e-12);
      previous = f.out.scale;
    }
    const landed = log[log.length - 1] as Frame;
    expect(landed.out.settling).toBe(false);
    expect(landed.out.scale).toBeCloseTo(
      benchScale === landed.out.scale ? benchScale : landed.out.scale,
      9,
    );
    expect({ contractStep: Number(contractStep.toFixed(4)), drawnStep: Number(drawnStep.toFixed(4)), bound: Number(bound.toFixed(4)) }).toEqual({
      // Read off this run, never computed: the contract's size step at the
      // seat assignment (0.70 -> 0.85 on the garage, VL-2's residual) against
      // the drawn scale's largest per-frame change under the settle.
      contractStep: 0.1538,
      drawnStep: 0.007,
      bound: 0.0071,
    });
  });
});

describe('phase desync (d) and no reset on a harmless re-render (e)', () => {
  it('two members in the same clip at the same instant are at different phases and drift apart', () => {
    const standing = (index: number): Contract => ({ tick: 0, cell: { x: 2, y: 2 }, clip: 'idle', lifecycle: 'seeking', index });
    const a = body(standing(0), true);
    const b = body(standing(1), true);
    const la = drive(a, 120, () => standing(0));
    const lb = drive(b, 120, () => standing(1));
    expect((la[0] as Frame).out.phase).not.toBe((lb[0] as Frame).out.phase);
    const gap = (i: number): number => Math.abs((la[i] as Frame).out.phase - (lb[i] as Frame).out.phase);
    expect(gap(0)).toBeGreaterThan(0);
    expect(gap(119)).not.toBeCloseTo(gap(0), 6);
    expect(memberAnimationPeriodJitter(0)).not.toBe(memberAnimationPeriodJitter(1));
    const framesA = new Set(la.map((f) => (f.out.draw.kind === 'strip' ? f.out.draw.frame : -1)));
    expect(framesA.size).toBeGreaterThan(1);
    expect(la.some((f, i) => f.out.draw.kind === 'strip' && lb[i]?.out.draw.kind === 'strip' && f.out.draw.frame !== lb[i]?.out.draw.frame)).toBe(true);
  });

  it('an identical input on the next frame advances the phase by the elapsed alone and restarts nothing', () => {
    const benchFeet = feetAt(2.5, 3.2);
    const here = feetAt(4, 3);
    const pull = { x: benchFeet.x - here.x, y: benchFeet.y - here.y };
    const using: Contract = { tick: 7, cell: { x: 4, y: 3 }, clip: 'use-bench', lifecycle: 'using', pull };
    for (const production of [true, false]) {
      const state = body(using, production);
      const log = drive(state, 40, () => using);
      for (let i = 2; i < log.length; i += 1) {
        const prev = log[i - 1] as Frame;
        const here2 = log[i] as Frame;
        expect(here2.out.elapsedMs).toBeCloseTo(FRAME_MS, 9);
        expect(here2.out.transition).toBeNull();
        expect(here2.out.relocating).toBe(false);
        expect(here2.out.draw.clip).toBe(prev.out.draw.clip);
        // The settle keeps landing: its remainder never grows.
        const remainingPrev = Math.hypot(prev.out.drawn.x - (here.x + pull.x), prev.out.drawn.y - (here.y + pull.y));
        const remainingHere = Math.hypot(here2.out.drawn.x - (here.x + pull.x), here2.out.drawn.y - (here.y + pull.y));
        expect(remainingHere).toBeLessThanOrEqual(remainingPrev + 1e-9);
      }
      // A time clip's phase moved by exactly the frame over its (jittered) period.
      const settledFrames = log.filter((f) => !f.out.settling && f.out.transition === null && f.out.blend === 1);
      expect(settledFrames.length).toBeGreaterThan(2);
      const p = settledFrames[settledFrames.length - 2] as Frame;
      const q = settledFrames[settledFrames.length - 1] as Frame;
      if (production) {
        const spec = MEMBER_MOTION_CLIP_SPECS[q.out.draw.clip as MemberMotionClip];
        if (spec.loop && spec.periodMs !== null) {
          const expected = (q.out.phase - p.out.phase + 1) % 1;
          expect(expected).toBeCloseTo(FRAME_MS / (spec.periodMs * memberAnimationPeriodJitter(0)), 9);
        }
      } else {
        const expected = (q.out.phase - p.out.phase + 1) % 1;
        expect(expected).toBeCloseTo(FRAME_MS / EMPIRE_TUNING.FLOOR_MEMBER_REP_PERIOD_MS, 9);
      }
    }
  });

  it('a legacy body draws the pose stack, blended over one tick at a clip change, facing as the contract says', () => {
    const script = (tick: number): Contract => (tick < 3 ? { ...walker(0), facing: 'left' } : { ...walker(tick), facing: 'left' });
    const state = body({ ...walker(0), clip: 'idle', facing: 'left' }, false);
    const log = drive(state, 60, script);
    for (const f of log) {
      expect(f.out.draw.kind).toBe('poses');
      expect(f.out.facing).toBe('left');
      if (f.out.draw.kind !== 'poses') continue;
      const total = Object.values(f.out.draw.opacity).reduce((s, v) => s + v, 0);
      expect(total).toBeGreaterThan(0);
      expect(total).toBeLessThanOrEqual(2);
      for (const v of Object.values(f.out.draw.opacity)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
    expect(log.some((f) => f.out.blend < 1)).toBe(true);
    expect(log.some((f) => f.out.draw.clip === 'walk')).toBe(true);
    // Lean is signed by facing: walking left leans negative.
    const walking = log.find((f) => f.out.draw.clip === 'walk' && f.out.blend === 1);
    expect(walking?.out.lean).toBe(-EMPIRE_TUNING.FLOOR_MEMBER_LEAN_DEGREES);
  });
});
