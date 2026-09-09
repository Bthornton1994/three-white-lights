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
 *      than `FLOOR_MEMBER_RELOCATION_MIN_TILES` (runtime round two; pinned
 *      above the sim's largest ordinary tick — `FLOOR_SIM_STEP_PROGRESS_PER_
 *      TICK` × its jitter — and below a stride, so a re-plan the sim performs
 *      WITHIN one stride is caught even though it is smaller than the
 *      relocation check used to require) at this body's depth from the
 *      previous snapshot — on either branch — is a RELOCATION: the buffer is
 *      rebased onto the new point and the difference joins the eased pull,
 *      anchored on where the body is DRAWN this instant, so the same body
 *      glides there instead of the timeline sliding it in one tick — at the
 *      settle's ease-out pace for a seat pull, or `FLOOR_MEMBER_RELOCATION_
 *      GLIDE`'s curve for a relocation (`memberMotionSettleRemainder`;
 *      default linear, so a sub-stride re-plan does not front-load most of
 *      its travel into the glide's first frames). A relocation whose pull
 *      cancels it (under a pixel) starts no settle.
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
 *      the shortest path to it (a BFS over the table, so `bench-setup →
 *      bench-mount → bench-press` and `bench-press → bench-dismount →
 *      bench-finish` are walked with no special casing here — the table
 *      alone decides there is no direct family jump); a non-looping clip
 *      holds its last frame until its cycle ends and only then takes the
 *      next edge. A crossfade of `FLOOR_MEMBER_CLIP_BLEND_MS` sits on the two
 *      edges where the painting changes (`memberMotionDissolveEdge`, read
 *      from `./memberMotionClips` — the rig, the bake and the runtime now
 *      share the one list rather than three that can drift apart, which is
 *      what runtime round two found had already happened to this file's own
 *      copy); every other edge is a hard cut.
 *   d. PHASE DESYNC: a time clip starts at the body's stagger phase
 *      (`memberAnimationStaggerPhase`) and runs at its own jittered period
 *      (`memberAnimationPeriodJitter`), both from the roster ordinal.
 *   e. NO RESET ON A HARMLESS RE-RENDER: the state is created once per mount
 *      and only ever advanced (each frame returns the next state; the one
 *      handed in is never written); an input identical to the last one
 *      advances the phase by the elapsed time and restarts nothing.
 *   f. RUNTIME ROUND TWO — THE GAIT TRANSITIONS ARE DISTANCE-DRIVEN, LIKE THE
 *      WALK. `walk-to-wait` and `wait-to-walk` advance by drawn feet travel
 *      over the rig's own solved root advance for those clips
 *      (`memberMotionClipAdvanceTiles`), not the frame clock, so the planted
 *      foot's retreat and the runtime's phase agree by construction. Leaving
 *      the walk is PRE-EMPTIVE: once the contract's wish has already left
 *      'walk' (the sim's own, earlier signal that no more steps are coming —
 *      waiting for the newest snapshot to repeat instead was measured to
 *      arrive only after the feet had already stopped, leaving the
 *      transition nothing to spend and playing effectively zero of its
 *      frames) and what remains to walk is at most one cycle of
 *      `walk-to-wait`'s own advance, the edge is taken with a FITTED start
 *      phase so the clip's last frame lands exactly when the feet do,
 *      however early inside that cycle it fires. Leaving a stand keys on
 *      REAL DRAWN MOTION (`FLOOR_MEMBER_GAIT_TRANSITION_TRIGGER_PX`) rather
 *      than the wish, because a queue shuffle can move the drawn feet a
 *      whole tile while the wish never leaves 'wait' (queue repositioning is
 *      not a `stepping` edge the way a real walk is) — without this a
 *      one-cell shuffle played entirely in the standing pose (measured, then
 *      fixed). Every other edge out of a non-looping clip waits only for it
 *      to finish (phase 1), never for the feet to be still, which would
 *      strand `wait-to-walk` forever once the walk it hands off to keeps
 *      them moving.
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
  MEMBER_MOTION_CANVAS_PX,
  MEMBER_MOTION_CLIPS,
  MEMBER_MOTION_CLIP_SPECS,
  MEMBER_MOTION_TRANSITIONS,
  memberMotionDissolveEdge,
  memberMotionStrideTiles,
  type MemberMotionClip,
} from './memberMotionClips';
import { memberRigMetadata } from './memberRig';

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
/** A transition edge as `from>to`, over the clip vocabulary and nothing else. */
export type MemberMotionTransitionLabel = `${MemberMotionClip}>${MemberMotionClip}`;

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
  /**
   * The edge taken this frame as `from>to`, or null. Typed as a template
   * literal over the clip vocabulary, not `string`, so the evidence-only
   * trace sink that copies this record onto a `globalThis` key carries no
   * bare-string field a laundered name could ride out on — the shared
   * forbidden-output census verifies that through the checker.
   */
  readonly transition: MemberMotionTransitionLabel | null;
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
  /** Which curve the CURRENT settle eases along — set when a new one starts, read every frame it crosses. */
  readonly settleCurve: MemberMotionSettleCurve;
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
 * lies back (`bench-setup`), then the three-quarter presser takes the racked
 * bar (`bench-mount`), and the reverse (`bench-dismount` → `bench-finish`) —
 * get a `FLOOR_MEMBER_CLIP_BLEND_MS` dissolve; every other edge in
 * `MEMBER_MOTION_TRANSITIONS` is a hard cut. This used to be a second,
 * independent list here, and runtime round two found it had drifted from the
 * clip table's own `MEMBER_MOTION_DISSOLVE_EDGES` (still naming
 * `bench-setup → bench-press`, from before the bench was split into five
 * clips) — a pair that is no longer even a table edge, so no dissolve could
 * ever fire. `memberMotionDissolveEdge`, imported from `./memberMotionClips`,
 * is now the only copy of this fact; the table, the bake and the runtime
 * read the same list rather than three that can drift apart again.
 */

/**
 * A distance-driven clip's root advance over one full cycle, in tiles at the
 * body's draw scale — the unit `advanceMemberMotionPhase` divides drawn feet
 * travel by, and the frame `memberMotionFrameAt` shows depends on landing at
 * the same fraction. The walk's is the registered stride knob
 * (`FLOOR_MEMBER_STRIDE_TILES`, tuned independently of the rig, kept as a
 * playtester's single dial on the gait's length). `walk-to-wait` and
 * `wait-to-walk` read the rig's own solved root advance for their retimed
 * frames (`memberRigMetadata().clips[clip].cycleAdvancePx`), converted to
 * tiles the same way the rig's own `strideTiles` is — so the runtime spends
 * exactly the drawn travel the rig authored the planted foot to retreat by,
 * and the two agree without either side hardcoding the other's number.
 *
 * The rig's FK is pure but not free, so `memberRigMetadata()` is read once
 * at module load and memoized (`RIG_CYCLE_ADVANCE_PX`) rather than per frame
 * or per call — measured under 54 ms for the whole clip table in node.
 */
const RIG_CYCLE_ADVANCE_PX: Readonly<Record<MemberMotionClip, number>> = (() => {
  const metadata = memberRigMetadata();
  const out: Partial<Record<MemberMotionClip, number>> = {};
  for (const clip of MEMBER_MOTION_CLIPS) out[clip] = metadata.clips[clip].cycleAdvancePx;
  return Object.freeze(out as Record<MemberMotionClip, number>);
})();

/** See `RIG_CYCLE_ADVANCE_PX`'s header. */
export function memberMotionClipAdvanceTiles(clip: MemberMotionClip): number {
  if (clip === 'walk') return memberMotionStrideTiles();
  return (RIG_CYCLE_ADVANCE_PX[clip] * EMPIRE_TUNING.FLOOR_MEMBER_DRAW_SCALE_TILES) / MEMBER_MOTION_CANVAS_PX;
}

/** The curve a settle eases along: VL-2B's ease-out cubic for a seat pull, or a relocation's own knob. */
export type MemberMotionSettleCurve = 'linear' | 'ease-out';

/**
 * `FLOOR_MEMBER_RELOCATION_GLIDE`, parsed totally — anything other than the
 * literal `'linear'` is `'ease-out'`, so a bad or future value never throws
 * and never silently disables the glide.
 */
export function memberMotionRelocationGlide(): MemberMotionSettleCurve {
  return EMPIRE_TUNING.FLOOR_MEMBER_RELOCATION_GLIDE === 'linear' ? 'linear' : 'ease-out';
}

/**
 * The eased remainder of a settle under `curve`: `settleRemainder`'s ease-out
 * cubic (`memberAnimation.ts`, VL-2B, unchanged) for a seat pull, or linear —
 * `1 − clamp(elapsed / duration, 0, 1)` — for a relocation when
 * `FLOOR_MEMBER_RELOCATION_GLIDE` asks for it. `settleRemainder` itself takes
 * no curve argument (a VL-2B module this piece does not own), so the choice
 * is made here rather than there.
 */
export function memberMotionSettleRemainder(
  elapsedMs: number,
  durationMs: number,
  curve: MemberMotionSettleCurve,
): number {
  if (curve === 'linear') {
    if (!(durationMs > 0)) return 0;
    return Math.max(0, Math.min(1, 1 - elapsedMs / durationMs));
  }
  return settleRemainder(elapsedMs, durationMs);
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
      ? memberMotionClipAdvanceTiles(clip)
      : (spec.periodMs ?? 0) * memberAnimationPeriodJitter(ordinal);
  const step = spec.drive === 'distance' ? movedTiles : elapsedMs;
  const base = Number.isFinite(phase) && phase > 0 ? phase : 0;
  if (!Number.isFinite(step) || step <= 0 || !(period > 0)) {
    return spec.loop ? wrapUnit(base) : Math.min(base, 1);
  }
  const advanced = base + step / period;
  return spec.loop ? wrapUnit(advanced) : Math.min(advanced, 1);
}

/**
 * The strip frame index a clip shows at `phase`. A LOOPING clip divides its
 * cycle into `frames` equal buckets — floor(phase × frames) — because there
 * is no first-or-last frame to land phase 0 or 1 on exactly. A NON-LOOPING
 * clip's frames are authored (or, for `walk-to-wait` / `wait-to-walk`,
 * retimed) at k / (frames − 1) of the clip's own advance, so the runtime
 * shows the frame NEAREST that fraction — round(phase × (frames − 1)) — which
 * is what puts the rig's frame k exactly at drawn-distance k / (frames − 1)
 * of the clip's total, agreeing with the phase `advanceMemberMotionPhase`
 * produces frame-for-frame rather than only at the two endpoints (both
 * formulas already agree there: phase 0 → frame 0, phase 1 → frame
 * frames − 1).
 */
export function memberMotionFrameAt(clip: MemberMotionClip, phase: number): number {
  const spec = MEMBER_MOTION_CLIP_SPECS[clip];
  const frames = spec.frames;
  const p = Number.isFinite(phase) ? Math.max(0, Math.min(phase, 1)) : 0;
  if (!spec.loop && frames > 1) {
    return Math.min(Math.max(Math.round(p * (frames - 1)), 0), frames - 1);
  }
  return Math.min(Math.floor(p * frames), frames - 1);
}

/**
 * The frames of each clip a left-right mirror may land on WITHOUT moving a
 * foot the rig had planted — read from the rig's own solved frames once at
 * module load, beside `RIG_CYCLE_ADVANCE_PX` and for the same reason (the
 * FK is pure but not free).
 *
 * Two facts about a frame make a mirror harmless, and both are the rig's to
 * state rather than this file's to guess:
 *
 *   1. NOTHING IS PLANTED (`plantedFoot === null`). A mirror reflects the
 *      body about its root; if no foot is in contact, there is no contact
 *      point for it to move. Measured on the shipped rig: every frame of
 *      `bench-mount` (3), `bench-press` (12) and `bench-dismount` (3) is
 *      plantless — the member is on the bar, feet off the design's ground
 *      line — and no frame of any other clip is.
 *
 *   2. THE PLANT HANDS OVER ON THIS FRAME — the planted foot differs from
 *      the one the PREVIOUS FRAME OF THE SAME CLIP planted. At such a frame
 *      the authored sole already jumps across the body (measured on
 *      `bench-finish` f3: 186.19 px to 140.34 px in a 256 px canvas), so a
 *      mirror introduces no discontinuity that the art does not already
 *      have there. The clip's FIRST frame is deliberately NOT counted: its
 *      run may have begun in the clip before it, which this table cannot
 *      see, and `walk-to-wait` f0 is exactly that case — it continues the
 *      walk's own nearFoot plant (both at sole x 181.29).
 *
 * Neither rule can be stated by reading this file. Both were wrong to
 * hardcode and are now derived, so a re-authored rig moves them without an
 * edit here.
 */
const RIG_MIRRORABLE_FRAMES: Readonly<Record<MemberMotionClip, ReadonlySet<number>>> = (() => {
  const metadata = memberRigMetadata();
  const out: Partial<Record<MemberMotionClip, ReadonlySet<number>>> = {};
  for (const clip of MEMBER_MOTION_CLIPS) {
    const frames = metadata.clips[clip].frames;
    const allowed = new Set<number>();
    frames.forEach((frame, index) => {
      if (frame.plantedFoot === null) {
        allowed.add(index);
        return;
      }
      if (index > 0 && frames[index - 1]?.plantedFoot !== frame.plantedFoot) allowed.add(index);
    });
    out[clip] = allowed;
  }
  return Object.freeze(out as Record<MemberMotionClip, ReadonlySet<number>>);
})();

/**
 * Whether a facing flip may take effect while a production strip is showing
 * `clip` at `frame` (e). A flip mirrors the whole body left-right about its
 * root, so mid-stride it swaps which foot is forward WITHOUT moving either
 * foot — the planted one jumps across the body.
 *
 * TWO SOURCES, UNIONED, AND THE SECOND IS WHY THIS FUNCTION CHANGED.
 *
 * The first is the authored list this function has always carried, kept
 * verbatim: `idle` / `wait` on every frame (their sway is symmetric enough
 * that a mirror reads as the same pose, and a standing body must be able to
 * turn the instant its contract says so); the walk's two ground-contact
 * frames (0, the leading foot's, and `frames / 2`, the trailing foot's —
 * not `frames - 1`, since the walk LOOPS and its last frame is one step
 * short of the next contact); the standing end of each gait transition
 * (`walk-to-wait`'s last, already at rest; `wait-to-walk`'s first, not yet
 * moved); and the bench walker's frames away from the bar (`bench-setup`'s
 * first, still standing; `bench-finish`'s last, back on its feet).
 *
 * The second is `RIG_MIRRORABLE_FRAMES` — the frames the RIG says carry no
 * plant to break. It is a union, never a filter: every frame the authored
 * list allowed is still allowed, and no frame is taken away.
 *
 * WHAT THAT UNION FIXES, MEASURED RATHER THAN ARGUED. The authored list
 * refused a flip on all 3 frames of `bench-dismount` and on 4 of the 5
 * frames of `bench-finish`, on the stated ground that "there is no frame of
 * a member on the bar that a mirror does not visibly wrong". That sentence
 * is true of `bench-mount` and `bench-press` and FALSE of the exit: driven
 * at 60 Hz through the shipped camera, a member leaving a bench to the left
 * is DRAWN travelling left at 1.755 px per frame from the sixth frame of
 * the exit, while `facing` stays `right` for 62 consecutive moving frames —
 * the whole of the dismount and all but the last frame of the finish. The
 * hysteresis is satisfied within about six of those frames; the other ~56
 * are this gate withholding a flip it has already earned. A body walking
 * backwards for a second is a worse artefact than a mirrored pose, and the
 * rig says the mirror was never the artefact here anyway: all three
 * `bench-dismount` frames plant nothing, and `bench-finish` f3 is where the
 * plant hands over and the sole jumps regardless.
 *
 * The rig adds exactly five frames to the authored list — `bench-mount`
 * 0-2, `bench-press` 0-11, `bench-dismount` 0-2 (plantless), plus
 * `bench-setup` f2 and `bench-finish` f3 (handovers) — and adds nothing to
 * `walk`, `walk-to-wait`, `wait-to-walk`, `idle` or `wait`, whose authored
 * frames it already agrees with or leaves alone. `bench-mount` and
 * `bench-press` gaining frames is inert in practice: a body on the bar is
 * `using`, and the `using` arm takes the station's facing, which does not
 * change while it is held there.
 *
 * NO ART MOVED FOR THIS. The strips, the puppet and the rig are byte-
 * identical; what changed is which of the frames they already contain this
 * function is willing to mirror.
 */
export function memberMotionFlipAllowedAt(clip: MemberMotionClip, frame: number): boolean {
  if (RIG_MIRRORABLE_FRAMES[clip].has(frame)) return true;
  if (clip === 'idle' || clip === 'wait') return true;
  if (clip === 'walk') {
    const frames = MEMBER_MOTION_CLIP_SPECS.walk.frames;
    return frame === 0 || frame === Math.floor(frames / 2);
  }
  if (clip === 'walk-to-wait') return frame === MEMBER_MOTION_CLIP_SPECS['walk-to-wait'].frames - 1;
  if (clip === 'wait-to-walk') return frame === 0;
  if (clip === 'bench-setup') return frame === 0;
  if (clip === 'bench-finish') return frame === MEMBER_MOTION_CLIP_SPECS['bench-finish'].frames - 1;
  return false;
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
    // No settle is running at creation, so the curve is inert; 'ease-out'
    // matches VL-2B's only settle kind so a body's very first pull (before
    // any relocation) behaves exactly as it always did.
    settleCurve: 'ease-out',
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
  let settleCurve = state.settleCurve;
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
    const remainderNow = settleElapsedMs === null ? 0 : memberMotionSettleRemainder(settleElapsedMs, settleMs, settleCurve);
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
      // (3) A relocation glides on its own knob, never the seat pull's ease-out.
      settleCurve = memberMotionRelocationGlide();
    }
    snapshots = snapshots.map((held) => ({ tick: held.tick, x: p.position.x, y: p.position.y }));
  };
  const isRelocation = (jumpX: number, jumpY: number): boolean =>
    tileHere > 0 && Math.hypot(jumpX, jumpY) / tileHere > EMPIRE_TUNING.FLOOR_MEMBER_RELOCATION_MIN_TILES;
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
    const remainderNow = settleElapsedMs === null ? 0 : memberMotionSettleRemainder(settleElapsedMs, settleMs, settleCurve);
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
      // The seat settle always eases out, whatever curve a relocation just left behind.
      settleCurve = 'ease-out';
    }
  }
  const remainder = settleElapsedMs === null ? 0 : memberMotionSettleRemainder(settleElapsedMs, settleMs, settleCurve);
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

  // 6. THE CLIP the body wants this frame.
  const wantedClip = remainder > 0 ? clipWhileSettling(p.clip) : p.clip;

  // 7. THE PRODUCTION STRIP'S CLIP AND FRAME (c), resolved BEFORE facing (a)
  // so the flip gate below reads the frame this step actually draws, not
  // the one it is about to leave. A legacy body's motionClip/motionPhase are
  // simply carried unchanged — its own branch further down never touches
  // them, exactly as before this reordering.
  let motionClip = state.motionClip;
  let motionPhase = state.motionPhase;
  let motionOutgoing = state.motionOutgoing;
  let transition: MemberMotionTransitionLabel | null = null;
  let frame = 0;
  let motionBlend = 1;
  if (state.production) {
    let justEnteredFromWalk = false;
    const wish = memberMotionTargetClip(wantedClip);
    // (e, f) A queue shuffle can move the drawn feet a whole tile while the
    // CONTRACT's own wish never leaves 'wait' — queue repositioning is not a
    // `stepping` edge the way a real walk is, so `wish` alone stays 'wait'
    // the entire time — and a stand that only ever watches `wish` for the
    // walk edge would draw the sway pose sliding across the floor. So
    // leaving a stand keys on there being REAL drawn motion this frame
    // instead: once the played feet have actually moved (`movedTiles`,
    // already net of the playback clock's own catch-up) by at least
    // `FLOOR_MEMBER_GAIT_TRANSITION_TRIGGER_PX`, the body is walking
    // whatever the wish says. `wish` still governs every other edge,
    // including the ones OUT of the transition clips this override starts.
    const target =
      (motionClip === 'wait' || motionClip === 'idle') &&
      wish === motionClip &&
      movedTiles * tileHere >= EMPIRE_TUNING.FLOOR_MEMBER_GAIT_TRANSITION_TRIGGER_PX
        ? 'walk'
        : wish;
    if (motionClip !== target) {
      let ready: boolean;
      let fittedStartPhase = 0;
      if (motionClip === 'walk') {
        // (a, b) Leave the walk once the SIM has committed to a stop —
        // `wish` itself leaving 'walk' — rather than once the newest
        // snapshot repeats the previous one: that reading only becomes true
        // after the drawn feet have already arrived, so it leaves nothing
        // for the transition clip to spend and plays it for effectively
        // zero frames (measured). `wish`'s edge is the earlier, playable
        // signal, because the render delay buffers the drawn feet a tick
        // behind the sim's own decision. Once the stop is known, leave as
        // soon as what remains to walk is at most one cycle of
        // `walk-to-wait`'s own advance, with the START PHASE fitted so the
        // clip's last frame lands exactly when the feet do, however early
        // inside that last cycle the edge actually fires.
        //
        // "Remaining" is the distance from the DRAWN point to where the
        // body will finally rest once both the playback timeline has caught
        // up to its newest tick AND any eased pull has finished —
        // `newest + pullTo`, not `newest` alone. A body approaching a
        // station is walking under an eased PULL (`clipWhileSettling` shows
        // 'walk' while it settles), not a tick-by-tick step, so its
        // remaining distance is almost entirely pull, and `newest` (the
        // tick point, pinned at the queue cell for the whole approach)
        // alone would read as permanently far from `drawn` — measured to
        // strand the walk clip forever the first time this was tried, since
        // the tick point never moves once a member is using.
        const stopKnown = wish !== 'walk';
        const newest = snapshots[snapshots.length - 1] as MemberPlaybackSnapshot;
        const restingX = newest.x + pullTo.x;
        const restingY = newest.y + pullTo.y;
        const remainingTiles = tileHere > 0 ? Math.hypot(restingX - drawn.x, restingY - drawn.y) / tileHere : 0;
        const advanceTiles = memberMotionClipAdvanceTiles('walk-to-wait');
        ready = stopKnown && remainingTiles <= advanceTiles;
        fittedStartPhase = advanceTiles > 0 ? Math.max(0, Math.min(1, 1 - remainingTiles / advanceTiles)) : 1;
      } else {
        // Every other edge, including the transition clips' own exits,
        // waits only for the outgoing clip to finish (c) — a non-looping
        // distance clip's phase reaches 1 exactly when its fitted start's
        // remaining distance has been walked (`wait-to-walk`), or the feet
        // have stopped moving (`walk-to-wait`, by the same construction in
        // reverse) — never for the feet to be still, which would strand
        // `wait-to-walk` forever once the walk it hands off to keeps them
        // moving.
        const spec = MEMBER_MOTION_CLIP_SPECS[motionClip];
        ready = spec.loop || motionPhase >= 1;
      }
      if (ready) {
        const next = memberMotionNextClip(motionClip, target);
        if (next !== null && next !== motionClip) {
          const from = motionClip;
          motionOutgoing = memberMotionDissolveEdge(from, next)
            ? { clip: from, frame: memberMotionFrameAt(from, motionPhase) }
            : null;
          motionBlendElapsedMs = motionOutgoing === null ? null : 0;
          motionClip = next;
          motionPhase = from === 'walk' ? fittedStartPhase : memberMotionStartPhase(next, p.index);
          transition = `${from}>${next}`;
          // `fittedStartPhase` already measured "remaining" against THIS
          // frame's drawn point — the frame's own `movedTiles` is already
          // baked into it. Advancing again below with the same `movedTiles`
          // would spend it twice, which is what produced the ~0.24-phase
          // (roughly one contract tick's worth of travel) discontinuity
          // measured at the cut before this guard existed. Skip this one
          // frame's advance for a walk-originated edge only; every other
          // edge starts at a motion-independent phase (0) and is meant to
          // take this same frame's travel as its first real step.
          justEnteredFromWalk = from === 'walk';
        }
      }
    }
    if (!justEnteredFromWalk) {
      motionPhase = advanceMemberMotionPhase(motionClip, motionPhase, p.index, movedTiles, elapsed);
    }
    frame = memberMotionFrameAt(motionClip, motionPhase);
    motionBlend = motionBlendElapsedMs === null ? 1 : memberAnimationBlend(motionBlendElapsedMs);
    if (motionBlend >= 1) {
      motionBlendElapsedMs = null;
      motionOutgoing = null;
    }
  }

  // 8. FACING (a), gated to the frame just resolved above — production
  // bodies only (`memberMotionFlipAllowedAt`): a flip mid-stride mirrors the
  // planted foot across the body, so a threshold crossing this frame is
  // held (the accumulator is NOT reset) until a frame the gate allows.
  let facing = state.facing;
  let facingOpposedTiles = state.facingOpposedTiles;
  let facingHintMs = state.facingHintMs;
  if (!state.production) {
    facing = p.facing;
  } else if (p.lifecycle === 'using' || p.lifecycle === 'queuing') {
    if (p.facing !== facing && memberMotionFlipAllowedAt(motionClip, frame)) {
      facing = p.facing;
    }
    facingOpposedTiles = 0;
    facingHintMs = 0;
  } else if (drawnDx !== 0 && tileHere > 0) {
    const movingLeft = drawnDx < 0;
    if (movingLeft !== (facing === 'left')) {
      facingOpposedTiles += Math.abs(drawnDx) / tileHere;
      if (facingOpposedTiles >= EMPIRE_TUNING.FLOOR_MEMBER_FACING_FLIP_TILES && memberMotionFlipAllowedAt(motionClip, frame)) {
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
      if (facingHintMs >= EMPIRE_TUNING.FLOOR_MEMBER_FACING_HINT_MS && memberMotionFlipAllowedAt(motionClip, frame)) {
        facing = p.facing;
        facingHintMs = 0;
      }
    } else {
      facingHintMs = 0;
    }
  }

  const carried = {
    production: state.production,
    lastNow: now,
    snapshots,
    playTick,
    pullFrom,
    pullTo,
    settleElapsedMs,
    settleMs,
    settleCurve,
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

  // The production strip: `motionClip`/`motionPhase`/`frame`/`motionOutgoing`/
  // `motionBlend`/`transition` were all resolved in step 7, above the facing
  // gate — nothing left to decide here but the layers to draw.
  const layers: MemberMotionStripLayer[] = [{ clip: motionClip, frame, opacity: motionBlend }];
  if (motionOutgoing !== null) {
    layers.push({ clip: motionOutgoing.clip, frame: motionOutgoing.frame, opacity: 1 - motionBlend });
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
      blend: motionBlend,
      transitioning: motionBlend < 1 || !MEMBER_MOTION_CLIP_SPECS[motionClip].loop,
      transition,
      draw: { kind: 'strip', clip: motionClip, frame, layers },
    },
  };
}

/** Every production clip, for a renderer that pre-mounts one strip per clip. */
export function memberMotionStripClips(): readonly MemberMotionClip[] {
  return MEMBER_MOTION_CLIPS;
}
