/**
 * memberMotion.ts — VL-3: one member body's per-frame stepper. The frame
 * loop `FloorGrid.tsx`'s `AmbientMemberBody` ran inside a React effect
 * (VL-2 / VL-2B) is here as a pure function of (state, input, now), so
 * every continuity rule it enforces is a node test rather than a browser
 * capture, and the per-frame drawn displacement can be read straight off
 * the output by a trace sink rather than inferred from a `MutationObserver`.
 *
 * Pure module (CLAUDE.md, "Pure logic is separate from UI"): zero React,
 * zero I/O, no clock — `now` is the timestamp `requestAnimationFrame` hands
 * its callback, passed in — no dice, no pixels. It imports the tuning knobs,
 * the VL-2 animation helpers (`./memberAnimation`), the VL-3 clip table
 * (`./memberMotionClips`), the camera's depth inverse (`./floorCamera`), and
 * the sprite pose / facing vocabulary and lifecycle vocabulary as types.
 * Claude Code Session B owns it (CLAUDE.md "VL-3"): it decides how a body is
 * DRAWN from one frame to the next and nothing about what the member does.
 * Every fact it consumes — tick, feet point, pull, lifecycle, contract facing,
 * the clip the contract asks for — arrives in `MemberMotionInput` from the
 * presentation contract via `FloorGrid.tsx`, and is only ever read.
 *
 * WHAT MOVED HERE UNCHANGED IN MEANING (VL-2 / VL-2B, `stepMemberMotion`):
 *
 *   1. THE CAP. One frame advances at most `FLOOR_MEMBER_FRAME_ELAPSED_CAP_MS`
 *      of animation however long the main thread was away; the playback
 *      clock, the settle and the blend all run on accumulated capped elapsed,
 *      so a stall pauses them and they resume where they were.
 *   2. SNAPSHOT INTAKE. A new tick files a snapshot; the same tick re-rendered
 *      with a moved point replaces it in place; and a point that moved more
 *      than a stride (`FLOOR_MEMBER_STRIDE_TILES` at this body's depth) from
 *      the previous snapshot — on either branch — is a RELOCATION: the buffer
 *      is rebased onto the new point and the difference joins the eased pull,
 *      anchored on where the body is DRAWN this instant, so the same body
 *      glides there at the settle's pace instead of the timeline sliding it
 *      in one tick. A relocation whose pull cancels it (under a pixel) starts
 *      no settle.
 *   3. THE PLAYBACK CLOCK (`advancePlaybackTick`) and the walked feet point
 *      (`samplePlayback`): the sim's own rate, never past the newest snapshot,
 *      bounded catch-up.
 *   4. THE EASED PULL onto or off a station (`settleRemainder`,
 *      `settleDurationMs`): a changed pull starts a new settle from wherever
 *      the previous one had got to, timed per tile; under a pixel, no settle.
 *   5. THE CLIP while a settle crosses (`clipWhileSettling`), the phase by
 *      distance drawn or time elapsed, the sample and the one-tick blend —
 *      for the two-keypose pose stack every member type draws today.
 *
 * WHAT IS NEW (VL-3), each a tested property of the stepper:
 *
 *   a. FACING FROM THE DRAWN VELOCITY, WITH HYSTERESIS — production bodies
 *      only. The contract's facing is a hint; the body turns when its drawn
 *      feet have travelled `FLOOR_MEMBER_FACING_FLIP_TILES` against the way it
 *      faces, or — standing — when the hint has disagreed for
 *      `FLOOR_MEMBER_FACING_HINT_MS`. While `using` or `queuing` it takes the
 *      contract's station facing at once. Legacy (two-keypose) bodies keep the
 *      contract facing exactly as VL-2 drew it, because three of their eleven
 *      left-facing paintings are not mirrors of the right (measured: walk-a
 *      78 %, using-bench-a 107 %, athlete 76 % of opaque pixels differ) and a
 *      mirror transform would change what they look like.
 *   b. DEPTH SCALE FROM THE DRAWN POINT (`depthScaleFromStageY`), not the
 *      contract's: a seat assignment or a relocation moves the drawn point
 *      along an eased settle, so the size follows the same ease instead of
 *      stepping in one render — the residual VL-2 named and did not close.
 *      Applies to every body: it is a property of where the feet are drawn.
 *   c. CLIP TRANSITIONS WALKED ONLY ALONG `MEMBER_MOTION_TRANSITIONS` for
 *      production bodies: the contract's wish (walk / wait / idle / using)
 *      becomes a target clip, and the stepper takes one edge per frame along
 *      the shortest path to it; a non-looping clip holds its last frame until
 *      its cycle ends and only then takes the next edge; the edge OUT of the
 *      distance-driven walk waits for the drawn feet to stop, so "the last
 *      step settling into a stand" never plays on moving feet. A crossfade of
 *      `FLOOR_MEMBER_CLIP_BLEND_MS` sits on the two edges where the painting
 *      changes from the side-view body to the three-quarter presser and back
 *      (`MEMBER_MOTION_DISSOLVE_EDGES`); every other edge is a hard cut, which
 *      is what the transition clips are authored for.
 *   d. PHASE DESYNC: a time clip starts at the body's stagger phase
 *      (`memberAnimationStaggerPhase`) and runs at its own jittered period
 *      (`memberAnimationPeriodJitter`), both from the roster ordinal.
 *   e. NO RESET ON A HARMLESS RE-RENDER: the state is created once per mount
 *      and only ever advanced (each frame returns the next state; the one
 *      handed in is never written); an input identical to the last one
 *      advances the phase by the elapsed time and restarts nothing.
 *
 * ITS LIMITS, stated where they sit. The production clip table has no
 * reaction clip, so an `interrupted` production body stands (`idle`) and
 * the cue bubble carries the read; it has bench clips only, so a production
 * body on a bar or generic station is drawn with the bench clips (the
 * garage has one station class and it is the bench — a second class needs
 * its own rows in `memberMotionClips.ts`). The sim does not wait for
 * `bench-finish`: at the contract's `leaving` edge the pull drops and the
 * body glides off the bench while the finish clip plays. The edge out of the
 * walk is a hard cut at whatever stride phase the feet stopped on.
 */

import { EMPIRE_TUNING } from './empireTuning';
import { depthScaleFromStageY, type FloorDepthFrame } from './floorCamera';
import { type FloorSimMemberState } from './floorSim';
import { FLOOR_SPRITE_POSES, type FloorSpriteFacing, type FloorSpritePose } from './floorSprites';
import {
  advanceMemberAnimationPhase,
  advancePlaybackTick,
  clipWhileSettling,
  memberAnimationBlend,
  memberAnimationPeriodJitter,
  memberAnimationStaggerPhase,
  memberAnimationStartPhase,
  sampleMemberAnimation,
  samplePlayback,
  settleDurationMs,
  settleRemainder,
  type MemberAnimationClip,
  type MemberAnimationFrame,
  type MemberPlaybackSnapshot,
} from './memberAnimation';
import {
  MEMBER_MOTION_CLIPS,
  MEMBER_MOTION_CLIP_SPECS,
  MEMBER_MOTION_TRANSITIONS,
  memberMotionStrideTiles,
  type MemberMotionClip,
} from './memberMotionClips';

/** A point in stage pixels. */
export interface MemberMotionPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Everything the stepper reads about one body this frame — the contract-
 * derived props `FloorGrid.tsx` computes per render, read from a ref inside
 * the frame loop. Plain data; nothing here is written back.
 */
export interface MemberMotionInput {
  /** The sim tick this feet point came from — the playback timeline's index. */
  readonly tick: number;
  /** The feet point, in stage pixels, already projected through the camera. */
  readonly position: MemberMotionPoint;
  /** The pull, in stage pixels, from the walked feet point to where a `using` body is drawn; zero otherwise. */
  readonly pullX: number;
  readonly pullY: number;
  /** Front-row tile width in stage pixels. */
  readonly tile: number;
  /** The camera's depth scale at the CONTRACT point — the stride and the settle's tile are measured at it, as VL-2B did. */
  readonly scale: number;
  /** The clip the contract asks for (`memberAnimationClipFor`): the body's wish, not what it draws this frame. */
  readonly clip: MemberAnimationClip;
  readonly lifecycle: FloorSimMemberState;
  /** The contract's facing (`memberFacing`): the station's side while using or queued, the step's direction otherwise. */
  readonly facing: FloorSpriteFacing;
  /** Roster ordinal — the stagger and jitter seed. */
  readonly index: number;
  /** The camera's depth frame, so the drawn y inverts to a depth scale. */
  readonly depth: FloorDepthFrame;
}

/** One strip layer to draw this frame: which clip's strip, at which frame, how opaque. */
export interface MemberMotionStripLayer {
  readonly clip: MemberMotionClip;
  readonly frame: number;
  readonly opacity: number;
}

/** What the renderer draws for the body: a production strip (one or two layers) or the legacy pose stack (one opacity per pose). */
export type MemberMotionDraw =
  | {
      readonly kind: 'strip';
      readonly clip: MemberMotionClip;
      readonly frame: number;
      readonly layers: readonly MemberMotionStripLayer[];
    }
  | {
      readonly kind: 'poses';
      readonly clip: MemberAnimationClip;
      readonly opacity: Readonly<Record<FloorSpritePose, number>>;
    };

/** Everything the renderer writes for one body after one step. */
export interface MemberMotionOutput {
  /** The capped elapsed this frame advanced by, in milliseconds. */
  readonly elapsedMs: number;
  /** The playback clock after this frame, in sim ticks. */
  readonly playTick: number;
  /** The feet point the body is drawn at, in stage pixels. */
  readonly drawn: MemberMotionPoint;
  /** The depth scale to draw the body at — from the drawn point. */
  readonly scale: number;
  /** One tile at the contract point's depth, in pixels — the stride's and the settle's unit. */
  readonly tileHere: number;
  /** The inner view's vertical offset at the FRONT-ROW scale, in pixels, as written (negative is up); the root's depth transform scales it. */
  readonly lift: number;
  /** The inner view's lean, in degrees, as written (signed by facing). */
  readonly lean: number;
  readonly facing: FloorSpriteFacing;
  /** The running clip's phase in [0, 1] (a finished non-looping clip holds at 1). */
  readonly phase: number;
  /** How far a clip change has blended, 0 (all previous) to 1 (all current). */
  readonly blend: number;
  /** A settle (an eased pull or a relocation glide) is crossing this frame. */
  readonly settling: boolean;
  /** This frame's intake rebased the buffer — a relocation was taken. */
  readonly relocating: boolean;
  /** A transition clip is running or a blend is in flight. */
  readonly transitioning: boolean;
  /** The edge taken this frame as `from>to`, or null. */
  readonly transition: string | null;
  readonly draw: MemberMotionDraw;
}

/**
 * The stepper's state — VL-2B's loop locals as one immutable record, created
 * once per mounted body and replaced by `stepMemberMotion` every frame. The
 * renderer holds the latest in a ref; the stepper never writes into the one
 * it was handed (zero side effects, per "Pure logic is separate from UI"),
 * so the cost of a frame is one small record and, on a tick, one short
 * snapshot array — never a mutation of a caller's object.
 */
export interface MemberMotionState {
  /** Drawn through the production strip pipeline (facing hysteresis, the clip table) or the legacy pose stack. */
  readonly production: boolean;
  readonly lastNow: number | null;
  readonly snapshots: readonly MemberPlaybackSnapshot[];
  readonly playTick: number | null;
  readonly pullFrom: MemberMotionPoint;
  readonly pullTo: MemberMotionPoint;
  readonly settleElapsedMs: number | null;
  readonly settleMs: number;
  readonly lastDrawn: MemberMotionPoint | null;
  /** The legacy pose stack's running clip, phase and one-tick blend. */
  readonly runningClip: MemberAnimationClip;
  readonly phase: number;
  readonly outgoingFrames: readonly MemberAnimationFrame[];
  readonly blendElapsedMs: number | null;
  /** The production strip's running clip, its phase (unwrapped for a non-looping clip) and the dissolve. */
  readonly motionClip: MemberMotionClip;
  readonly motionPhase: number;
  readonly motionOutgoing: { readonly clip: MemberMotionClip; readonly frame: number } | null;
  readonly motionBlendElapsedMs: number | null;
  readonly facing: FloorSpriteFacing;
  /** Drawn horizontal travel, in tiles, against the current facing since it last agreed. */
  readonly facingOpposedTiles: number;
  /** How long, in milliseconds, a standing body's contract facing has disagreed with its drawn one. */
  readonly facingHintMs: number;
}

/** One frame's result: the state to hold for the next frame, and what to draw now. */
export interface MemberMotionStep {
  readonly state: MemberMotionState;
  readonly output: MemberMotionOutput;
}

/**
 * The two edges where the painting changes — the side-view body sits and
 * lies back (`bench-setup`), then the three-quarter presser takes over
 * (`bench-press`), and the reverse — get a `FLOOR_MEMBER_CLIP_BLEND_MS`
 * dissolve; the rig authors the frames either side of each to meet at the
 * same canvas position, and the dissolve takes the edge off what remains.
 * Every other edge in `MEMBER_MOTION_TRANSITIONS` is a hard cut. A strip is
 * one image, so a dissolve can only sit on an edge between two clips, never
 * inside one — which is why the cut is placed at the clip boundary.
 */
export const MEMBER_MOTION_DISSOLVE_EDGES: readonly (readonly [MemberMotionClip, MemberMotionClip])[] =
  Object.freeze([
    ['bench-setup', 'bench-press'],
    ['bench-press', 'bench-finish'],
  ] as const);

/** Whether the edge `from → to` is one of the dissolves. */
export function memberMotionEdgeDissolves(from: MemberMotionClip, to: MemberMotionClip): boolean {
  return MEMBER_MOTION_DISSOLVE_EDGES.some(([a, b]) => a === from && b === to);
}

/**
 * The production clip a contract wish maps to: the walk for `walk`, the
 * bench press for every use clip (the table's only station class — see the
 * header's limits), `wait` for a queued body, `idle` for a standing one and
 * for the reaction beat the table has no clip for.
 */
export function memberMotionTargetClip(wanted: MemberAnimationClip): MemberMotionClip {
  if (wanted === 'walk') return 'walk';
  if (wanted === 'use-bench' || wanted === 'use-bar' || wanted === 'use-generic') return 'bench-press';
  if (wanted === 'wait') return 'wait';
  return 'idle';
}

/**
 * The first edge of the shortest path from `from` to `to` along
 * `MEMBER_MOTION_TRANSITIONS` (breadth-first over the table, so a row added
 * there is a route here with no edit), `to` itself when they are equal, or
 * null when the table has no route — which the clip table's own test pins
 * never happens between any two of its clips.
 */
export function memberMotionNextClip(from: MemberMotionClip, to: MemberMotionClip): MemberMotionClip | null {
  if (from === to) return to;
  const parent = new Map<MemberMotionClip, MemberMotionClip>();
  const queue: MemberMotionClip[] = [from];
  parent.set(from, from);
  for (let head = 0; head < queue.length; head += 1) {
    const at = queue[head] as MemberMotionClip;
    for (const [a, b] of MEMBER_MOTION_TRANSITIONS) {
      if (a !== at || parent.has(b)) continue;
      parent.set(b, at);
      if (b === to) {
        let step: MemberMotionClip = to;
        while (parent.get(step) !== from) step = parent.get(step) as MemberMotionClip;
        return step;
      }
      queue.push(b);
    }
  }
  return null;
}

/**
 * The phase a production clip starts at: a looping time clip at the body's
 * stagger share of its own period, everything else — the distance-driven
 * walk, and every non-looping transition, which must play from its first
 * frame — at 0.
 */
export function memberMotionStartPhase(clip: MemberMotionClip, ordinal: number): number {
  const spec = MEMBER_MOTION_CLIP_SPECS[clip];
  if (spec.drive === 'distance' || !spec.loop || spec.periodMs === null) return 0;
  return memberAnimationStaggerPhase(spec.periodMs, ordinal);
}

/**
 * A production clip's phase after this frame: the walk advances by tiles
 * drawn over the stride, a time clip by elapsed over its period times the
 * body's jitter; a looping clip wraps into [0, 1), a non-looping one clamps
 * at 1 and holds. A non-positive or non-finite step advances nothing.
 */
export function advanceMemberMotionPhase(
  clip: MemberMotionClip,
  phase: number,
  ordinal: number,
  movedTiles: number,
  elapsedMs: number,
): number {
  const spec = MEMBER_MOTION_CLIP_SPECS[clip];
  const period =
    spec.drive === 'distance'
      ? memberMotionStrideTiles()
      : (spec.periodMs ?? 0) * memberAnimationPeriodJitter(ordinal);
  const step = spec.drive === 'distance' ? movedTiles : elapsedMs;
  const base = Number.isFinite(phase) && phase > 0 ? phase : 0;
  if (!Number.isFinite(step) || step <= 0 || !(period > 0)) {
    return spec.loop ? wrapUnit(base) : Math.min(base, 1);
  }
  const advanced = base + step / period;
  return spec.loop ? wrapUnit(advanced) : Math.min(advanced, 1);
}

/** The strip frame index a clip shows at `phase`: floor(phase × frames), never past the last frame. */
export function memberMotionFrameAt(clip: MemberMotionClip, phase: number): number {
  const frames = MEMBER_MOTION_CLIP_SPECS[clip].frames;
  const p = Number.isFinite(phase) ? Math.max(0, Math.min(phase, 1)) : 0;
  return Math.min(Math.floor(p * frames), frames - 1);
}

/** `value` wrapped into [0, 1). */
function wrapUnit(value: number): number {
  const wrapped = value - Math.floor(value);
  return wrapped < 0 || wrapped >= 1 ? 0 : wrapped;
}

/** A fresh stepper state for a body drawing its first frame from `input`; `production` picks the strip pipeline. */
export function createMemberMotion(input: MemberMotionInput, production: boolean): MemberMotionState {
  const motionClip = memberMotionTargetClip(input.clip);
  return Object.freeze({
    production,
    lastNow: null,
    snapshots: Object.freeze([]),
    playTick: null,
    pullFrom: { x: input.pullX, y: input.pullY },
    pullTo: { x: input.pullX, y: input.pullY },
    settleElapsedMs: null,
    settleMs: settleDurationMs(0),
    lastDrawn: null,
    runningClip: input.clip,
    phase: memberAnimationStartPhase(input.clip, input.index),
    outgoingFrames: Object.freeze([]),
    blendElapsedMs: null,
    motionClip,
    motionPhase: memberMotionStartPhase(motionClip, input.index),
    motionOutgoing: null,
    motionBlendElapsedMs: null,
    facing: input.facing,
    facingOpposedTiles: 0,
    facingHintMs: 0,
  });
}

/**
 * One frame. Reads `state`, never writes it, and returns the state for the
 * next frame beside what to draw. The order is VL-2B's: cap → intake (with
 * the relocation rebase) → playback clock → eased pull → drawn point → depth
 * scale → facing → clip → phase → sample.
 */
export function stepMemberMotion(state: MemberMotionState, p: MemberMotionInput, now: number): MemberMotionStep {
  // 1. THE CAP.
  const elapsed =
    state.lastNow === null
      ? 0
      : Math.max(0, Math.min(now - state.lastNow, EMPIRE_TUNING.FLOOR_MEMBER_FRAME_ELAPSED_CAP_MS));
  let settleElapsedMs = state.settleElapsedMs === null ? null : state.settleElapsedMs + elapsed;
  let blendElapsedMs = state.blendElapsedMs === null ? null : state.blendElapsedMs + elapsed;
  let motionBlendElapsedMs = state.motionBlendElapsedMs === null ? null : state.motionBlendElapsedMs + elapsed;
  let settleMs = state.settleMs;
  let pullFrom = state.pullFrom;
  let pullTo = state.pullTo;

  // 2. SNAPSHOT INTAKE, with the relocation rebase. Copy-on-write: the
  //    buffer handed in is never touched.
  const tileHere = p.tile * p.scale;
  let snapshots: readonly MemberPlaybackSnapshot[] = state.snapshots;
  const newest = snapshots[snapshots.length - 1];
  let relocating = false;
  const relocate = (): void => {
    relocating = true;
    const drawnFeet =
      (state.playTick === null ? null : samplePlayback(snapshots, state.playTick)) ?? newest ?? p.position;
    const jumpX = p.position.x - drawnFeet.x;
    const jumpY = p.position.y - drawnFeet.y;
    const remainderNow = settleElapsedMs === null ? 0 : settleRemainder(settleElapsedMs, settleMs);
    pullFrom = {
      x: pullTo.x + (pullFrom.x - pullTo.x) * remainderNow - jumpX,
      y: pullTo.y + (pullFrom.y - pullTo.y) * remainderNow - jumpY,
    };
    const glidePixels = Math.hypot(pullTo.x - pullFrom.x, pullTo.y - pullFrom.y);
    if (glidePixels < 1) {
      settleElapsedMs = null;
    } else {
      settleElapsedMs = 0;
      settleMs = settleDurationMs(glidePixels / tileHere);
    }
    snapshots = snapshots.map((held) => ({ tick: held.tick, x: p.position.x, y: p.position.y }));
  };
  const isRelocation = (jumpX: number, jumpY: number): boolean =>
    tileHere > 0 && Math.hypot(jumpX, jumpY) / tileHere > EMPIRE_TUNING.FLOOR_MEMBER_STRIDE_TILES;
  if (newest === undefined || newest.tick !== p.tick) {
    if (newest !== undefined && isRelocation(p.position.x - newest.x, p.position.y - newest.y)) {
      relocate();
    }
    snapshots = [...snapshots, { tick: p.tick, x: p.position.x, y: p.position.y }];
  } else if (newest.x !== p.position.x || newest.y !== p.position.y) {
    if (isRelocation(p.position.x - newest.x, p.position.y - newest.y)) {
      relocate();
    }
    snapshots = [...snapshots.slice(0, -1), { tick: p.tick, x: p.position.x, y: p.position.y }];
  }

  // 3. THE PLAYBACK CLOCK and the walked feet point.
  const latestTick = (snapshots[snapshots.length - 1] as MemberPlaybackSnapshot).tick;
  const playTick = advancePlaybackTick(state.playTick, latestTick, elapsed);
  let drop = 0;
  while (snapshots.length - drop > 2 && (snapshots[drop + 1] as MemberPlaybackSnapshot).tick <= playTick) {
    drop += 1;
  }
  if (drop > 0) snapshots = snapshots.slice(drop);
  const feet = samplePlayback(snapshots, playTick) ?? p.position;

  // 4. THE EASED PULL.
  if (p.pullX !== pullTo.x || p.pullY !== pullTo.y) {
    const remainderNow = settleElapsedMs === null ? 0 : settleRemainder(settleElapsedMs, settleMs);
    pullFrom = {
      x: pullTo.x + (pullFrom.x - pullTo.x) * remainderNow,
      y: pullTo.y + (pullFrom.y - pullTo.y) * remainderNow,
    };
    pullTo = { x: p.pullX, y: p.pullY };
    const pullPixels = Math.hypot(pullTo.x - pullFrom.x, pullTo.y - pullFrom.y);
    if (pullPixels < 1) {
      settleElapsedMs = null;
    } else {
      settleElapsedMs = 0;
      settleMs = settleDurationMs(tileHere <= 0 ? 0 : pullPixels / tileHere);
    }
  }
  const remainder = settleElapsedMs === null ? 0 : settleRemainder(settleElapsedMs, settleMs);
  if (remainder === 0) settleElapsedMs = null;
  const drawn: MemberMotionPoint = {
    x: feet.x + pullTo.x + (pullFrom.x - pullTo.x) * remainder,
    y: feet.y + pullTo.y + (pullFrom.y - pullTo.y) * remainder,
  };
  const movedTiles =
    state.lastDrawn === null || tileHere <= 0
      ? 0
      : Math.hypot(drawn.x - state.lastDrawn.x, drawn.y - state.lastDrawn.y) / tileHere;
  const drawnDx = state.lastDrawn === null ? 0 : drawn.x - state.lastDrawn.x;

  // 5. THE DEPTH SCALE, from the drawn point (b).
  const scale = depthScaleFromStageY(p.depth, drawn.y);

  // 6. FACING (a).
  let facing = state.facing;
  let facingOpposedTiles = state.facingOpposedTiles;
  let facingHintMs = state.facingHintMs;
  if (!state.production) {
    facing = p.facing;
  } else if (p.lifecycle === 'using' || p.lifecycle === 'queuing') {
    facing = p.facing;
    facingOpposedTiles = 0;
    facingHintMs = 0;
  } else if (drawnDx !== 0 && tileHere > 0) {
    const movingLeft = drawnDx < 0;
    if (movingLeft !== (facing === 'left')) {
      facingOpposedTiles += Math.abs(drawnDx) / tileHere;
      if (facingOpposedTiles >= EMPIRE_TUNING.FLOOR_MEMBER_FACING_FLIP_TILES) {
        facing = movingLeft ? 'left' : 'right';
        facingOpposedTiles = 0;
      }
    } else {
      facingOpposedTiles = 0;
    }
    facingHintMs = 0;
  } else {
    facingOpposedTiles = 0;
    if (p.facing !== facing) {
      facingHintMs += elapsed;
      if (facingHintMs >= EMPIRE_TUNING.FLOOR_MEMBER_FACING_HINT_MS) {
        facing = p.facing;
        facingHintMs = 0;
      }
    } else {
      facingHintMs = 0;
    }
  }

  // 7. THE CLIP the body wants this frame.
  const wantedClip = remainder > 0 ? clipWhileSettling(p.clip) : p.clip;

  const carried = {
    production: state.production,
    lastNow: now,
    snapshots,
    playTick,
    pullFrom,
    pullTo,
    settleElapsedMs,
    settleMs,
    lastDrawn: drawn,
    facing,
    facingOpposedTiles,
    facingHintMs,
  };
  const common = {
    elapsedMs: elapsed,
    playTick,
    drawn,
    scale,
    tileHere,
    facing,
    settling: remainder > 0,
    relocating,
  };

  if (!state.production) {
    // The legacy pose stack — VL-2's phase, sample and blend, unchanged.
    let runningClip = state.runningClip;
    let phase = state.phase;
    let outgoingFrames = state.outgoingFrames;
    if (wantedClip !== runningClip) {
      outgoingFrames = sampleMemberAnimation(runningClip, phase).frames;
      runningClip = wantedClip;
      blendElapsedMs = 0;
      phase = memberAnimationStartPhase(runningClip, p.index);
    }
    phase = advanceMemberAnimationPhase(runningClip, phase, movedTiles, elapsed);
    const sample = sampleMemberAnimation(runningClip, phase);
    const blend = blendElapsedMs === null ? 1 : memberAnimationBlend(blendElapsedMs);
    if (blend >= 1) {
      blendElapsedMs = null;
      outgoingFrames = Object.freeze([]);
    }
    const opacity: Partial<Record<FloorSpritePose, number>> = {};
    for (const pose of FLOOR_SPRITE_POSES) {
      let value = 0;
      for (const shown of sample.frames) if (shown.pose === pose) value += shown.opacity * blend;
      for (const fading of outgoingFrames) if (fading.pose === pose) value += fading.opacity * (1 - blend);
      opacity[pose] = value > 1 ? 1 : value;
    }
    return {
      state: Object.freeze({
        ...carried,
        runningClip,
        phase,
        outgoingFrames,
        blendElapsedMs,
        motionClip: state.motionClip,
        motionPhase: state.motionPhase,
        motionOutgoing: state.motionOutgoing,
        motionBlendElapsedMs: state.motionBlendElapsedMs,
      }),
      output: {
        ...common,
        lift: -sample.liftPixels,
        lean: facing === 'left' ? -sample.leanDegrees : sample.leanDegrees,
        phase,
        blend,
        transitioning: blend < 1,
        transition: null,
        draw: { kind: 'poses', clip: runningClip, opacity: opacity as Readonly<Record<FloorSpritePose, number>> },
      },
    };
  }

  // The production strip: one edge per frame along the table (c).
  const target = memberMotionTargetClip(wantedClip);
  let motionClip = state.motionClip;
  let motionPhase = state.motionPhase;
  let motionOutgoing = state.motionOutgoing;
  let transition: string | null = null;
  if (motionClip !== target) {
    const spec = MEMBER_MOTION_CLIP_SPECS[motionClip];
    const finished = spec.loop || motionPhase >= 1;
    // The edge out of the distance-driven walk waits for the feet to stop.
    const feetStill = spec.drive !== 'distance' || movedTiles === 0;
    if (finished && feetStill) {
      const next = memberMotionNextClip(motionClip, target);
      if (next !== null && next !== motionClip) {
        const from = motionClip;
        motionOutgoing = memberMotionEdgeDissolves(from, next)
          ? { clip: from, frame: memberMotionFrameAt(from, motionPhase) }
          : null;
        motionBlendElapsedMs = motionOutgoing === null ? null : 0;
        motionClip = next;
        motionPhase = memberMotionStartPhase(next, p.index);
        transition = `${from}>${next}`;
      }
    }
  }
  motionPhase = advanceMemberMotionPhase(motionClip, motionPhase, p.index, movedTiles, elapsed);
  const frame = memberMotionFrameAt(motionClip, motionPhase);
  const blend = motionBlendElapsedMs === null ? 1 : memberAnimationBlend(motionBlendElapsedMs);
  if (blend >= 1) {
    motionBlendElapsedMs = null;
    motionOutgoing = null;
  }
  const layers: MemberMotionStripLayer[] = [{ clip: motionClip, frame, opacity: blend }];
  if (motionOutgoing !== null) {
    layers.push({ clip: motionOutgoing.clip, frame: motionOutgoing.frame, opacity: 1 - blend });
  }
  return {
    state: Object.freeze({
      ...carried,
      runningClip: state.runningClip,
      phase: state.phase,
      outgoingFrames: state.outgoingFrames,
      blendElapsedMs: state.blendElapsedMs,
      motionClip,
      motionPhase,
      motionOutgoing,
      motionBlendElapsedMs,
    }),
    output: {
      ...common,
      // The baked frames carry their own bounce and lean; nothing procedural
      // is added on top (see the header's limits for the reaction beat).
      lift: 0,
      lean: 0,
      phase: motionPhase,
      blend,
      transitioning: blend < 1 || !MEMBER_MOTION_CLIP_SPECS[motionClip].loop,
      transition,
      draw: { kind: 'strip', clip: motionClip, frame, layers },
    },
  };
}

/** Every production clip, for a renderer that pre-mounts one strip per clip. */
export function memberMotionStripClips(): readonly MemberMotionClip[] {
  return MEMBER_MOTION_CLIPS;
}
