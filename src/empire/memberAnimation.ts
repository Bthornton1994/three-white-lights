/**
 * memberAnimation.ts — the member animation clips: which frame, how high,
 * how leaned, for one body at one phase.
 *
 * Pure module (CLAUDE.md, "Pure logic is separate from UI"): zero React, zero
 * side effects, zero I/O, no clock, no dice, no pixels drawn. It imports the
 * tuning knobs, the sprite pose vocabulary (`./floorSprites`, Claude's) and
 * the lifecycle vocabulary (`./floorSim`, read as a type only). Claude Code
 * Session B owns it (CLAUDE.md "Crossing VL-2"): it decides how a member is
 * DRAWN over time and nothing about what the member does — the lifecycle,
 * the cell, the target and the queue rank all arrive from the presentation
 * contract and are only ever read.
 *
 * WHY THIS FILE EXISTS. VL-1's member was a two-frame flip keyed to the sim
 * tick: every second tick the walk sprite swapped, every tick the rep sprite
 * swapped, and a separate timer bounced the body. Measured, the two walk
 * frames differ on 2.9% of their pixels — the same pose twice — so the walk
 * had no leg alternation at all, and the bounce ran on a clock of its own
 * that had nothing to do with where the feet were. The VL-2 brief asks for a
 * production-capable approach that covers locomotion, idle/wait, station
 * approach, station use and leave/transition, keeps one identity across them,
 * and is not "more bounce on two frames". This module is the data half of
 * that: a clip per thing-a-member-does, a phase per body, and one sampling
 * function that returns the frames to draw and the procedural motion to draw
 * them with.
 *
 * THE THREE IDEAS, each of which is what makes the approach scale rather
 * than what makes it pretty on the frames at hand:
 *
 *   1. LOCOMOTION IS PHASED BY DISTANCE, NOT TIME. The walk clip's phase
 *      advances by tiles the body has actually moved on screen, one cycle
 *      per `FLOOR_MEMBER_STRIDE_TILES`. So the feet stay planted relative to
 *      the ground whatever the frame rate, however the sim's speed is tuned,
 *      and however the renderer smooths a tick: a body that stops mid-tile
 *      stops mid-stride, and a body that walks twice as fast strides twice as
 *      often. There is no cadence knob in milliseconds because a
 *      distance-phased gait has nothing to tune in milliseconds.
 *   2. THE PROCEDURAL MOTION IS LOCKED TO THE SAME PHASE AS THE FRAME. The
 *      walk's bounce is highest at the passing pose and lowest at contact,
 *      because that is the phase the frame is at — one phase, two readings
 *      of it. A rep's crossfade and its holds come off one phase too. That is
 *      the difference between a body and a sprite with a bob on top.
 *   3. THE CLIP TABLE IS DATA. Every clip is a list of poses plus a drive
 *      (distance or time) and a period; a clip with more frames is the same
 *      code. Today the walk has two distinct poses (contact and passing) and
 *      each use class two (lockout and bottom), because that is the art on
 *      disk. When the art pipeline produces a four- or eight-pose stride, the
 *      row changes and nothing else does — which is the honest statement of
 *      what "production-capable" means here: the ARCHITECTURE takes any
 *      frame count; the ASSETS are still the two-keypose set, and this file
 *      does not call that production animation.
 *
 * WHAT A USE CYCLE DOES WITH TWO KEYPOSES. Rather than flipping between
 * lockout and bottom every tick, a rep holds each keypose for
 * `FLOOR_MEMBER_REP_HOLD_FRACTION` of `FLOOR_MEMBER_REP_PERIOD_MS` and
 * crossfades between them for the rest, with an ease-in-out on the travel.
 * That reads as lockout → controlled descent → bottom → drive. The crossfade
 * is pose blending — a standard way to get motion out of keyposes — and its
 * limit is stated plainly: for the travel's duration both paintings are
 * partly visible, so a bar drawn in two places ghosts for a few frames. It
 * is a mitigation for a two-keypose asset, not a substitute for in-between
 * frames.
 *
 * WHAT THIS FILE DOES NOT DO. It does not know a body's position, only how
 * far it moved since the last sample; it does not read a clock, only an
 * elapsed time the renderer hands it from `requestAnimationFrame`'s own
 * timestamp; it does not pick which clip a member is in beyond mapping the
 * contract's lifecycle and use class onto a clip name. Blending between
 * clips (`memberAnimationBlend`), the playback timeline a body is drawn
 * along (`advancePlaybackTick`, `samplePlayback`) and the eased settle onto
 * a bench (`easeOutCubic`, `settleRemainder`) are the renderer-side helpers
 * the same rules apply to: pure functions of numbers in, numbers out.
 *
 * WHY A PLAYBACK TIMELINE AND NOT A TWEEN. VL-1 tweened each new anchor
 * from wherever the body was over one tick; after a main-thread stall the
 * sim's ticks arrive bunched, so a fresh tween had to cover two steps in
 * one tick and the body caught up at nearly twice its walking speed —
 * measured in VL-1's own evidence and again in VL-2's first trial (0.52
 * tiles per 100 ms against a sim rate of 0.28). Playing the snapshots back
 * along a clock in SIM TICKS separates "how fast the sim walks" from "when
 * its ticks happened to fire": the clock advances at the sim's rate, holds
 * when there is nothing newer to walk toward, and catches up by a bounded
 * ten per cent when it has fallen behind. The drawn speed therefore has a
 * ceiling — the sim's rate times (1 + `FLOOR_MEMBER_CATCH_UP_RATE`) — that
 * `tools/capture-living-world.mjs` reads from source and checks, and the
 * lag behind the sim is exposed on the drawn root rather than eased away.
 */

import { EMPIRE_TUNING } from './empireTuning';
import { type FloorSimMemberState } from './floorSim';
import { type FloorSpritePose, type FloorStationUseClass } from './floorSprites';

/** Everything a member can be drawn doing. One clip per row; the renderer never draws outside this list. */
export const MEMBER_ANIMATION_CLIPS = Object.freeze([
  'walk',
  'idle',
  'wait',
  'use-bench',
  'use-bar',
  'use-generic',
  'interrupted',
] as const);
export type MemberAnimationClip = (typeof MEMBER_ANIMATION_CLIPS)[number];

/** What advances a clip's phase: tiles moved on screen, or milliseconds elapsed. */
export type MemberAnimationDrive = 'distance' | 'time';

/** One frame to draw this instant, at this opacity — several when a crossfade is in flight. */
export interface MemberAnimationFrame {
  readonly pose: FloorSpritePose;
  readonly opacity: number;
}

/** Everything the renderer writes for one body at one phase. */
export interface MemberAnimationSample {
  readonly frames: readonly MemberAnimationFrame[];
  /** Vertical lift of the body above its feet, in pixels at the front-row scale; positive is up. */
  readonly liftPixels: number;
  /** Lean toward the facing direction, in degrees; negative leans back. */
  readonly leanDegrees: number;
}

/** A point in stage pixels, for the snapshot interpolation below. */
export interface MemberAnimationPoint {
  readonly x: number;
  readonly y: number;
}

/** The walk cycle's frames in order: contact, passing, contact, passing. Two distinct poses — the art set's limit, stated in the header. */
const WALK_CYCLE: readonly FloorSpritePose[] = Object.freeze(['step-a', 'stand', 'step-b', 'stand']);

/** The two keyposes of each use class: lockout / extended first, bottom / retracted second. */
const USE_KEYPOSES: Readonly<
  Record<'use-bench' | 'use-bar' | 'use-generic', readonly [FloorSpritePose, FloorSpritePose]>
> = Object.freeze({
  'use-bench': Object.freeze(['using-bench-a', 'using-bench-b'] as const),
  'use-bar': Object.freeze(['using-bar-a', 'using-bar-b'] as const),
  'use-generic': Object.freeze(['using-generic-a', 'using-generic-b'] as const),
});

/** The use clip for a station's use class. */
function useClipFor(useClass: FloorStationUseClass): MemberAnimationClip {
  if (useClass === 'bench') return 'use-bench';
  if (useClass === 'bar') return 'use-bar';
  return 'use-generic';
}

/**
 * Which clip a member is drawn in, from the contract's lifecycle, whether a
 * step is in flight (`PresentationMember.next !== null`), and the use class
 * of its station when it is on one. Read-only over the contract: nothing
 * here decides what the member does.
 *
 *   using        → the station's use clip
 *   interrupted  → the reaction beat
 *   queuing      → wait (standing, swaying) unless a step is in flight
 *   anything else, step in flight → walk; standing → idle
 */
export function memberAnimationClipFor(
  lifecycle: FloorSimMemberState,
  stepping: boolean,
  useClass: FloorStationUseClass | null,
): MemberAnimationClip {
  if (lifecycle === 'using') return useClipFor(useClass === null ? 'generic' : useClass);
  if (lifecycle === 'interrupted') return 'interrupted';
  if (stepping) return 'walk';
  if (lifecycle === 'queuing') return 'wait';
  return 'idle';
}

/** Distance drives the walk; everything else runs on elapsed time. */
export function memberAnimationDrive(clip: MemberAnimationClip): MemberAnimationDrive {
  return clip === 'walk' ? 'distance' : 'time';
}

/**
 * One full cycle of the clip: tiles for a distance clip, milliseconds for a
 * time clip. The idle breath is two half-cycles of the Phase 2 bob; the
 * interrupted shake runs two oscillations inside the sim's own beat length.
 */
export function memberAnimationPeriod(clip: MemberAnimationClip): number {
  if (clip === 'walk') return EMPIRE_TUNING.FLOOR_MEMBER_STRIDE_TILES;
  if (clip === 'idle') return EMPIRE_TUNING.AMBIENT_MEMBER_BOB_HALF_CYCLE_MS * 2;
  if (clip === 'wait') return EMPIRE_TUNING.FLOOR_MEMBER_WAIT_SWAY_PERIOD_MS;
  if (clip === 'interrupted') {
    return (
      (EMPIRE_TUNING.FLOOR_SIM_INTERRUPTED_BEAT_TICKS * EMPIRE_TUNING.FLOOR_SIM_TICK_INTERVAL_MS) / 2
    );
  }
  return EMPIRE_TUNING.FLOOR_MEMBER_REP_PERIOD_MS;
}

/** The distinct poses a clip can draw — what the renderer pre-mounts so a frame change is an opacity write, not a mount. */
export function memberAnimationPoses(clip: MemberAnimationClip): readonly FloorSpritePose[] {
  if (clip === 'walk') {
    const distinct: FloorSpritePose[] = [];
    for (const pose of WALK_CYCLE) if (!distinct.includes(pose)) distinct.push(pose);
    return Object.freeze(distinct);
  }
  if (clip === 'use-bench' || clip === 'use-bar' || clip === 'use-generic') {
    return USE_KEYPOSES[clip];
  }
  return Object.freeze(['stand']);
}

/**
 * A member's own offset into every time clip, in milliseconds, from its
 * roster ordinal — the Phase 2 stagger lanes reused, so a crowd does not rep
 * or breathe in lockstep. Deterministic: no clock, no dice.
 */
export function memberAnimationStaggerMs(ordinal: number): number {
  const lane = Math.abs(Math.trunc(ordinal)) % EMPIRE_TUNING.AMBIENT_MEMBER_BOB_STAGGER_LANES;
  return lane * EMPIRE_TUNING.AMBIENT_MEMBER_BOB_STAGGER_STEP_MS;
}

/**
 * The phase a body starts a clip at: a time clip starts at its stagger
 * offset (`memberAnimationStaggerMs` over the clip's period, wrapped), so a
 * crowd changing clips together does not rep or breathe in lockstep; a
 * distance clip starts at 0 — a body that has not moved is at contact.
 */
export function memberAnimationStartPhase(clip: MemberAnimationClip, ordinal: number): number {
  if (memberAnimationDrive(clip) === 'distance') return 0;
  return wrapUnit(memberAnimationStaggerMs(ordinal) / memberAnimationPeriod(clip));
}

/** `value` wrapped into [0, 1). */
function wrapUnit(value: number): number {
  const wrapped = value - Math.floor(value);
  return wrapped < 0 || wrapped >= 1 ? 0 : wrapped;
}

/**
 * The clip's phase after this frame: a distance clip advances by
 * `movedTiles / period`, a time clip by `elapsedMs / period`, both wrapped
 * into [0, 1). A negative or non-finite step advances nothing — a body that
 * did not move does not stride, and a clock that went backwards is ignored
 * rather than rewound.
 */
export function advanceMemberAnimationPhase(
  clip: MemberAnimationClip,
  phase: number,
  movedTiles: number,
  elapsedMs: number,
): number {
  const period = memberAnimationPeriod(clip);
  const step = memberAnimationDrive(clip) === 'distance' ? movedTiles : elapsedMs;
  if (!Number.isFinite(step) || step <= 0 || period <= 0) return wrapUnit(phase);
  return wrapUnit(phase + step / period);
}

/** Ease-in-out over [0, 1]: half a cosine, so a crossfade starts and ends still. */
function easeInOut(u: number): number {
  return (1 - Math.cos(Math.PI * u)) / 2;
}

/** Ease-out cubic over [0, 1]: fast start, gentle arrival — the settle onto a bench. */
export function easeOutCubic(u: number): number {
  const clamped = u < 0 ? 0 : u > 1 ? 1 : u;
  const remaining = 1 - clamped;
  return 1 - remaining * remaining * remaining;
}

/**
 * The frames and procedural motion for `clip` at `phase` in [0, 1).
 *
 *   walk   the four-slot cycle (contact, passing, contact, passing), each
 *          slot a hard cut like frame animation, with the bounce highest at
 *          the passing slots and lowest at contact — two bounces per cycle,
 *          one per step — and a constant forward lean.
 *   idle   standing, breathing: one gentle rise and fall per period.
 *   wait   standing, swaying side to side once per period, breathing too.
 *   use-*  the two keyposes with holds and eased crossfades, no lift, no lean.
 *   interrupted  standing, shaking: the sway at double amplitude.
 */
export function sampleMemberAnimation(clip: MemberAnimationClip, phase: number): MemberAnimationSample {
  const p = wrapUnit(phase);
  const twoPi = Math.PI * 2;
  if (clip === 'walk') {
    const slot = Math.min(Math.floor(p * WALK_CYCLE.length), WALK_CYCLE.length - 1);
    const pose = WALK_CYCLE[slot] as FloorSpritePose;
    // Two bounces per cycle; cos is 1 at contact (slot boundaries 0 and 1/2),
    // so the lift is 0 at contact and peaks at the passing slots.
    const lift = ((1 - Math.cos(twoPi * 2 * p)) / 2) * EMPIRE_TUNING.FLOOR_MEMBER_GAIT_BOUNCE_PIXELS;
    return Object.freeze({
      frames: Object.freeze([Object.freeze({ pose, opacity: 1 })]),
      liftPixels: lift,
      leanDegrees: EMPIRE_TUNING.FLOOR_MEMBER_LEAN_DEGREES,
    });
  }
  if (clip === 'idle' || clip === 'wait' || clip === 'interrupted') {
    const breath = ((1 - Math.cos(twoPi * p)) / 2) * EMPIRE_TUNING.AMBIENT_MEMBER_BOB_AMPLITUDE_PIXELS;
    const sway = Math.sin(twoPi * p) * EMPIRE_TUNING.FLOOR_MEMBER_WAIT_SWAY_DEGREES;
    const lean = clip === 'idle' ? 0 : clip === 'wait' ? sway : sway * 2;
    return Object.freeze({
      frames: Object.freeze([Object.freeze({ pose: 'stand' as const, opacity: 1 })]),
      liftPixels: clip === 'interrupted' ? 0 : breath,
      leanDegrees: lean,
    });
  }
  const [lockout, bottom] = USE_KEYPOSES[clip];
  const hold = EMPIRE_TUNING.FLOOR_MEMBER_REP_HOLD_FRACTION;
  const travel = (1 - hold * 2) / 2;
  let toBottom: number;
  if (p < hold) {
    toBottom = 0;
  } else if (p < hold + travel) {
    toBottom = easeInOut((p - hold) / travel);
  } else if (p < hold * 2 + travel) {
    toBottom = 1;
  } else {
    toBottom = 1 - easeInOut((p - (hold * 2 + travel)) / travel);
  }
  const frames: MemberAnimationFrame[] = [];
  if (toBottom < 1) frames.push(Object.freeze({ pose: lockout, opacity: 1 - toBottom }));
  if (toBottom > 0) frames.push(Object.freeze({ pose: bottom, opacity: toBottom }));
  return Object.freeze({ frames: Object.freeze(frames), liftPixels: 0, leanDegrees: 0 });
}

/**
 * How far a clip change has blended, 0 (all previous clip) to 1 (all new
 * clip), `elapsedMs` after the change, eased in and out over
 * `FLOOR_MEMBER_CLIP_BLEND_MS`. The renderer multiplies the outgoing clip's
 * frame opacities by `1 - blend` and the incoming clip's by `blend`.
 */
export function memberAnimationBlend(elapsedMs: number): number {
  const duration = EMPIRE_TUNING.FLOOR_MEMBER_CLIP_BLEND_MS;
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  if (duration <= 0 || elapsedMs >= duration) return 1;
  return easeInOut(elapsedMs / duration);
}

/** One tick's anchor for a body: the sim tick it came from and the stage-pixel point the feet stand on. */
export interface MemberPlaybackSnapshot {
  readonly tick: number;
  readonly x: number;
  readonly y: number;
}

/**
 * The playback clock after one frame, in sim ticks. It advances one tick per
 * `FLOOR_SIM_TICK_INTERVAL_MS` of `elapsedMs` — the sim's own rate — and
 * never past `latestTick`, so when no newer snapshot exists (a stalled main
 * thread, a late tick) the body HOLDS on the newest one rather than being
 * extrapolated or sent faster. When it has fallen more than
 * `FLOOR_MEMBER_CATCH_UP_BEHIND_TICKS` behind, it runs faster by
 * `FLOOR_MEMBER_CATCH_UP_RATE` until it is back inside that gap — a bounded
 * catch-up whose ceiling is the one number the evidence tool checks against,
 * never a jump. A null clock (no snapshot yet) starts
 * `FLOOR_MEMBER_RENDER_DELAY_TICKS` behind the newest snapshot so there is a
 * segment to walk along from the first frame.
 */
export function advancePlaybackTick(
  playTick: number | null,
  latestTick: number,
  elapsedMs: number,
): number {
  if (playTick === null) return latestTick - EMPIRE_TUNING.FLOOR_MEMBER_RENDER_DELAY_TICKS;
  const step = elapsedMs / EMPIRE_TUNING.FLOOR_SIM_TICK_INTERVAL_MS;
  if (!Number.isFinite(step) || step <= 0) return Math.min(playTick, latestTick);
  const behind = latestTick - playTick;
  if (behind <= 0) return latestTick;
  const rate =
    behind > EMPIRE_TUNING.FLOOR_MEMBER_CATCH_UP_BEHIND_TICKS
      ? 1 + EMPIRE_TUNING.FLOOR_MEMBER_CATCH_UP_RATE
      : 1;
  return Math.min(latestTick, playTick + step * rate);
}

/**
 * Where a body is drawn at playback time `playTick`, from its snapshot
 * buffer (ascending by tick): the linear interpolation between the two
 * snapshots the clock sits between, the newest snapshot at or past the end,
 * the oldest before the start. An empty buffer has nowhere to draw and
 * returns null. Linear on purpose: an ease inside a tick puts a stop and a
 * start in every step and reads as limping.
 */
export function samplePlayback(
  snapshots: readonly MemberPlaybackSnapshot[],
  playTick: number,
): MemberAnimationPoint | null {
  const last = snapshots[snapshots.length - 1];
  if (last === undefined) return null;
  const first = snapshots[0] as MemberPlaybackSnapshot;
  if (playTick >= last.tick) return Object.freeze({ x: last.x, y: last.y });
  if (playTick <= first.tick) return Object.freeze({ x: first.x, y: first.y });
  for (let at = 0; at + 1 < snapshots.length; at += 1) {
    const from = snapshots[at] as MemberPlaybackSnapshot;
    const to = snapshots[at + 1] as MemberPlaybackSnapshot;
    if (playTick >= from.tick && playTick < to.tick) {
      const span = to.tick - from.tick;
      const u = span <= 0 ? 1 : (playTick - from.tick) / span;
      return Object.freeze({ x: from.x + (to.x - from.x) * u, y: from.y + (to.y - from.y) * u });
    }
  }
  return Object.freeze({ x: last.x, y: last.y });
}

/**
 * The eased remainder of a settle: `1 - easeOutCubic(elapsed / duration)`,
 * the fraction of the jump between two anchors that is still to be crossed
 * `elapsedMs` after the jump — 1 at the moment of the jump, 0 once it has
 * settled. The renderer multiplies the jump by it and adds the result to
 * the playback position, so the body eases across the floor-to-bench move
 * while the timeline already says it is on the bench. Zero on and past the
 * duration, so nothing lingers.
 */
export function settleRemainder(elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0 || !Number.isFinite(elapsedMs) || elapsedMs >= durationMs) return 0;
  if (elapsedMs <= 0) return 1;
  return 1 - easeOutCubic(elapsedMs / durationMs);
}
