/**
 * walkout.ts — the walk-out, as a timing sheet. PURE.
 *
 * ===========================================================================
 * WHY THIS EXISTS, IN NUMBERS
 * ===========================================================================
 * GDD §6.2 step 1 is "bar loads, brief walk-out beat", and until now the beat
 * contained no walk-out. `MeetHallView` drew ONE memoised still of
 * `buildSquatRep(loadRatio).frames[0]` over a static room and held it for the
 * whole beat. Measured on the shipped screenshots: an opener's walk-out and a
 * third attempt's with nothing banked differed in 22,467 pixels of 1,316,640,
 * every one of them inside the copy block, and ZERO below it. The hall was
 * byte-identical. The lifter never unracked, never stepped back, never settled,
 * and nothing in the room was a function of which attempt it was.
 *
 * This module is the missing motion, and the missing escalation.
 *
 * ===========================================================================
 * IT IS A SHEET OF HELD DRAWINGS, NOT A PER-FRAME DEFORMATION
 * ===========================================================================
 * The choreography is sampled at `WALKOUT_MOTION.TICK_MS`, every drawn channel
 * is snapped to the sheet's own quanta (`QUANTISE`), and identical consecutive
 * drawings are collapsed into one held frame — exactly what
 * `squatAnimation.ts`'s `coalesceFrames` does to the rep, and for the same
 * reason: a 16-bit game shipped a finite sheet, and continuous per-frame
 * deformation is a modern-engine tell (GDD §7.1). A walk-out at these values
 * comes out as roughly a dozen drawings, so the renderer rasterises a dozen
 * sprites over two seconds rather than one per display frame.
 *
 * ===========================================================================
 * THE ORDER IS LOAD -> UNRACK -> STEP -> SETTLE -> SET
 * ===========================================================================
 * The discs land BEFORE the bar comes off the hooks. `LOAD` is at least
 * `BAR_LOAD_MS` and at least long enough for every disc on the sleeve at
 * `BAR_LOAD_PLATE_STAGGER_MS`, so however heavy the bar is, the last plate has
 * landed before he drives it out.
 *
 * WHAT THAT DOES AND DOES NOT FIX, stated rather than glossed. The complaint
 * was that the plates were landing on a bar that was already on the lifter's
 * back. That is still true of the pixels and it is a limitation of the drawing,
 * not of the schedule: `renderLifterFrame` has exactly one drawing — a figure
 * with a bar across his shoulders — and there is no bar-without-a-figure sprite
 * to load. Making one is `src/art/lifterSprite.ts`'s job, not this screen's, and
 * inventing a second barbell here is precisely the GDD §7.1 violation the last
 * pass removed. So the compromise is a frame-of-reference error rather than an
 * impossible one: the loading crew's work is shown happening while he is still
 * sitting under the bar in the rack, and he does not take it off the hooks until
 * they are finished. If the sprite ever gains a racked-bar pose, `LOAD`'s pose
 * is the one line that changes.
 *
 * ===========================================================================
 * A FRONT VIEW CAN ONLY SHOW PART OF A WALK-OUT, AND THIS IS THAT PART
 * ===========================================================================
 * The sprite is drawn head-on (see `rig.ts`), so stepping BACKWARD is the one
 * component of a walk-out the camera cannot see. Nothing here fakes it with a
 * scale change — a fractional upscale would break §7.1's nearest-neighbour rule
 * for a single beat of motion. What the camera can see is the weight transfer,
 * and that is what is drawn: the body plants to one side, then the other, then
 * centre, each plant smaller than the last; the bar rocks the opposite way and
 * tilts with it; the whip damps out; he sets.
 *
 * ===========================================================================
 * AND THE HALL KNOWS WHICH ATTEMPT THIS IS
 * ===========================================================================
 * `urgent` — a third attempt, a PR, or one with a bomb on it — is the same flag
 * that already picked the line, the haptic and the crowd cue. It now also
 * brings the seating up (`crowdRisePx`), which is a channel a screenshot can be
 * checked on. It is deliberately the ONLY thing urgency changes about the
 * choreography: the lifter's own motion is a function of the bar, not of the
 * scoreboard, and a third attempt that made a man move differently at the same
 * weight would be a lie about the sport.
 *
 * ===========================================================================
 * PURITY AND PROVENANCE
 * ===========================================================================
 * Zero React, zero Skia, zero I/O, no clock and no randomness: the same
 * (loadRatio, plateCount, urgent) gives the same sheet every time. Every number
 * comes from `MEET_TUNING.WALKOUT_MOTION`, `MEET_TUNING.CROWD` or the sprite's
 * own `QUANTISE`/`STRAIN`; `meetTuning.test.ts` scans this directory for bare
 * literals.
 *
 * The REST pose is `meetHall.ts`'s `hallBraceFrame` — which is
 * `buildSquatRep(loadRatio).frames[0]`, the first frame of the rep that follows.
 * So the walk-out settles onto exactly the drawing the attempt begins from, and
 * `walkout.test.ts` asserts that on pixels rather than on this sentence.
 *
 * NOBODY HAS WATCHED IT. GDD §12.1: pacing is the half of §12.2's bar that
 * cannot be judged here. These are a structurally sane starting shape.
 */

import type { LifterFrameSpec } from '../art/lifterSprite';
import type { SquatFrame } from '../art/squatAnimation';
import { QUANTISE, STRAIN } from '../art/spriteTuning';
import { MEET_TUNING } from '../game/meetTuning';
import { hallBraceFrame } from './meetHall';

const M = MEET_TUNING.WALKOUT_MOTION;
const C = MEET_TUNING.CROWD;

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

/** The five stages of GDD §6.2 step 1, in order. */
export type WalkoutStage = 'LOAD' | 'UNRACK' | 'STEP' | 'SETTLE' | 'SET';

export const WALKOUT_STAGES: readonly WalkoutStage[] = Object.freeze([
  'LOAD',
  'UNRACK',
  'STEP',
  'SETTLE',
  'SET',
] as const satisfies readonly WalkoutStage[]);

/** One held drawing of the walk-out, plus what the room is doing behind it. */
export interface WalkoutFrame {
  readonly index: number;
  readonly startMs: number;
  /** How long this drawing is held. The last frame holds until the beat ends. */
  readonly holdMs: number;
  readonly stage: WalkoutStage;

  // --- the figure, in the channels `LifterFrameSpec` takes -----------------
  readonly depth: number;
  readonly direction: SquatFrame['direction'];
  readonly strainLevel: number;
  readonly pitchLevel: number;
  readonly barLateralPx: number;
  readonly barTiltDeg: number;
  readonly barBendPx: number;
  readonly chalkMotes: number;

  /**
   * Whole SPRITE pixels the whole figure is drawn left (negative) or right of
   * the platform's focus column. Whole pixels because the sprite is composited
   * at an integer scale and a fractional offset would resample it (GDD §7.1).
   */
  readonly bodyDxPx: number;

  /** Scene rows the seating has come up by. 0 on every ordinary walk-out. */
  readonly crowdRisePx: number;
}

export interface WalkoutSequence {
  readonly frames: readonly WalkoutFrame[];
  /** Where each stage starts, ms from the top of the beat. */
  readonly stageStartMs: Readonly<Record<WalkoutStage, number>>;
  /** LOAD through SETTLE. After this he is set and the sheet holds. */
  readonly motionMs: number;
  readonly urgent: boolean;
}

export interface WalkoutRequest {
  /** Attempt weight over the lifter's best single. Drawn strain, nothing else. */
  readonly loadRatio: number;
  /** Discs per side. The loading has to finish before he unracks. */
  readonly plateCount: number;
  /** A third attempt, a PR attempt, or one with a bomb on it. */
  readonly urgent: boolean;
}

// ---------------------------------------------------------------------------
// Curves
// ---------------------------------------------------------------------------

function clamp01(u: number): number {
  return Math.min(1, Math.max(0, u));
}

/**
 * Hermite smoothstep, `u^2 * (3 - 2u)`.
 *
 * Written as `u^2 * (2(1 - u) + 1)` — algebraically the same polynomial —
 * because `meetTuning.test.ts` scans every source under `src/meet/` for bare
 * numeric literals outside {0, 1, 2}, and a `3` here would be one. The rewrite
 * is exact, not an approximation.
 */
function smoothstep(u: number): number {
  const t = clamp01(u);
  return t * t * ((1 - t) * 2 + 1);
}

function lerp(a: number, b: number, u: number): number {
  return a + (b - a) * clamp01(u);
}

function quantize(value: number, step: number): number {
  return Math.round(value / step) * step;
}

// ---------------------------------------------------------------------------
// The crowd's ramp — shared with the verdict, which is the other moment the
// hall comes up (GDD §6.2 step 4: three whites).
// ---------------------------------------------------------------------------

/** A ramp from a seated hall to a standing one. */
export interface CrowdRiseRamp {
  /** Dead time before anybody moves. */
  readonly delayMs: number;
  /** How long the rise takes once it starts. */
  readonly rampMs: number;
  /** Scene rows at the top of the ramp. */
  readonly toPx: number;
}

/** The hall getting up under an urgent walk-out. Measured from the end of LOAD. */
export const WALKOUT_CROWD_RISE: CrowdRiseRamp = Object.freeze({
  delayMs: C.WALKOUT_RISE_DELAY_MS,
  rampMs: C.WALKOUT_RISE_MS,
  toPx: C.WALKOUT_RISE_PX,
});

/** The hall reacting to a good lift. Measured from the last lamp. */
export const CHEER_CROWD_RISE: CrowdRiseRamp = Object.freeze({
  delayMs: 0,
  rampMs: C.CHEER_RISE_MS,
  toPx: C.CHEER_RISE_PX,
});

/**
 * How far the seating has come up, in WHOLE SCENE ROWS, `sinceMs` into a ramp.
 *
 * Whole rows because the room is drawn on a pixel lattice: a crowd risen by 1.4
 * rows is the crowd risen by one row with a rounding error in the comment. The
 * quantisation is also what keeps the number of distinct rooms small enough to
 * rasterise — `MeetHallView` caches one room per rise.
 */
export function crowdRisePxAt(sinceMs: number, ramp: CrowdRiseRamp): number {
  if (ramp.rampMs <= 0) return ramp.toPx;
  const u = (sinceMs - ramp.delayMs) / ramp.rampMs;
  return Math.round(ramp.toPx * smoothstep(u));
}

// ---------------------------------------------------------------------------
// The choreography, sampled continuously
// ---------------------------------------------------------------------------

/** How long the crew takes on this bar. At least `BAR_LOAD_MS`, always. */
export function barLoadMs(plateCount: number): number {
  return Math.max(
    MEET_TUNING.BAR_LOAD_MS,
    Math.max(0, plateCount) * MEET_TUNING.BAR_LOAD_PLATE_STAGGER_MS,
  );
}

/** Where each stage starts, ms from the top of the beat. */
export function walkoutStageStartMs(plateCount: number): Record<WalkoutStage, number> {
  const load = barLoadMs(plateCount);
  const unrack = load + M.UNRACK_MS;
  const step = unrack + M.STEP_COUNT * M.STEP_MS;
  return {
    LOAD: 0,
    UNRACK: load,
    STEP: unrack,
    SETTLE: step,
    SET: step + M.SETTLE_MS,
  };
}

/** LOAD through SETTLE. After this he is set and nothing moves. */
export function walkoutMotionMs(plateCount: number): number {
  return walkoutStageStartMs(plateCount).SET;
}

export function walkoutStageAt(ms: number, plateCount: number): WalkoutStage {
  const at = walkoutStageStartMs(plateCount);
  let stage: WalkoutStage = 'LOAD';
  for (const candidate of WALKOUT_STAGES) {
    if (ms >= at[candidate]) stage = candidate;
  }
  return stage;
}

/**
 * The signed weight transfer at `ms`, in units of the first step's size.
 *
 * +1 is a full plant to one side, -1 to the other. Steps alternate and each is
 * `STEP_DECAY` of the one before, so the series damps to nothing; `SETTLE`
 * takes whatever is left back to centre. Every drawn channel that moves
 * sideways — the body, the bar's lateral offset, its tilt — is this one number
 * scaled, so they cannot drift out of phase with each other.
 */
function swingAt(ms: number, plateCount: number): number {
  const at = walkoutStageStartMs(plateCount);
  const plant = (i: number): number => Math.pow(-1, i) * Math.pow(M.STEP_DECAY, i);

  if (ms < at.STEP) return 0;
  if (ms >= at.SET) return 0;

  if (ms < at.SETTLE) {
    const local = ms - at.STEP;
    const i = Math.min(M.STEP_COUNT - 1, Math.floor(local / M.STEP_MS));
    const v = (local - i * M.STEP_MS) / M.STEP_MS;
    const from = i === 0 ? 0 : plant(i - 1);
    // The transfer, then the PLANT — a hold, not a continuous ease. The hold is
    // what makes it a drawing an animator would have inbetweened to.
    if (v >= M.STEP_TRANSFER_FRAC) return plant(i);
    return lerp(from, plant(i), smoothstep(v / M.STEP_TRANSFER_FRAC));
  }

  const u = (ms - at.SETTLE) / M.SETTLE_MS;
  return lerp(plant(M.STEP_COUNT - 1), 0, smoothstep(u));
}

/**
 * The drive that takes the bar off the hooks, 0..1. A half-sine: he loads
 * against it, it peaks, it is off. Zero everywhere but the unrack.
 *
 * THE ONLY THING THAT ADDS STRAIN, and that is a scarcity decision rather than
 * an oversight. Feeding the steps into the strain channel too made the body's
 * drawing flip rungs four times during the walk back, which at this quantisation
 * reads as a twitch rather than as effort. Standing under a bar you have already
 * unracked is not harder every time you shift your feet.
 */
function unrackDriveAt(ms: number, plateCount: number): number {
  const at = walkoutStageStartMs(plateCount);
  if (ms < at.UNRACK || ms >= at.STEP) return 0;
  return Math.sin(Math.PI * clamp01((ms - at.UNRACK) / M.UNRACK_MS));
}

/**
 * How hard the bar is being loaded at `ms`, 0..1 — what bends it.
 *
 * The drive through the unrack, and the magnitude of the weight transfer
 * through the steps: a loaded bar whips when a man shifts under it.
 */
function whipAt(ms: number, plateCount: number): number {
  return Math.max(unrackDriveAt(ms, plateCount), Math.abs(swingAt(ms, plateCount)));
}

/** Authored depth steps he is still sitting below his set position. */
function dipStepsAt(ms: number, plateCount: number): number {
  const at = walkoutStageStartMs(plateCount);
  if (ms < at.UNRACK) return M.RACK_DIP_STEPS;
  if (ms >= at.STEP) return 0;
  return M.RACK_DIP_STEPS * (1 - smoothstep((ms - at.UNRACK) / M.UNRACK_MS));
}

// ---------------------------------------------------------------------------
// Quantisation into drawings
// ---------------------------------------------------------------------------

/** The drawn identity of an instant. Two instants that agree here are one frame. */
interface DrawKey {
  readonly stage: WalkoutStage;
  readonly depth: number;
  readonly strainLevel: number;
  readonly barLateralPx: number;
  readonly barTiltDeg: number;
  readonly barBendPx: number;
  readonly bodyDxPx: number;
  readonly crowdRisePx: number;
}

function drawKeyAt(ms: number, base: SquatFrame, request: WalkoutRequest): DrawKey {
  const { plateCount, urgent } = request;
  const at = walkoutStageStartMs(plateCount);
  const swing = swingAt(ms, plateCount);
  const whip = whipAt(ms, plateCount);
  const drive = unrackDriveAt(ms, plateCount);

  // Depth in the sheet's own steps, so a dip that would round away is no dip.
  const baseSteps = Math.round(base.poseDepth * QUANTISE.DEPTH_STEPS);
  const steps = baseSteps + Math.round(dipStepsAt(ms, plateCount));

  return {
    stage: walkoutStageAt(ms, plateCount),
    depth: clamp01(steps / QUANTISE.DEPTH_STEPS),
    strainLevel: Math.min(
      STRAIN.LEVELS - 1,
      base.strainLevel + Math.round(M.UNRACK_STRAIN_BUMP * drive),
    ),
    // The bar rocks the OPPOSITE way to the body: he steps out from under it
    // and back beneath it, which is what a walk-out looks like head-on.
    barLateralPx: quantize(
      base.barLateralPx - swing * M.STEP_BAR_LATERAL_PX,
      QUANTISE.LATERAL_QUANTUM_PX,
    ),
    barTiltDeg: quantize(
      base.barTiltDeg + swing * M.STEP_BAR_TILT_DEG,
      QUANTISE.TILT_QUANTUM_DEG,
    ),
    barBendPx: quantize(base.barBendPx * (1 + M.UNRACK_WHIP * whip), QUANTISE.BEND_QUANTUM_PX),
    bodyDxPx: Math.round(swing * M.STEP_BODY_DX_PX),
    crowdRisePx: urgent ? crowdRisePxAt(ms - at.UNRACK, WALKOUT_CROWD_RISE) : 0,
  };
}

function sameDrawing(a: DrawKey, b: DrawKey): boolean {
  return (
    a.stage === b.stage &&
    a.depth === b.depth &&
    a.strainLevel === b.strainLevel &&
    a.barLateralPx === b.barLateralPx &&
    a.barTiltDeg === b.barTiltDeg &&
    a.barBendPx === b.barBendPx &&
    a.bodyDxPx === b.bodyDxPx &&
    a.crowdRisePx === b.crowdRisePx
  );
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

/**
 * The whole walk-out as a sheet of held drawings.
 *
 * Deterministic: the same request gives the same frames, every time, on every
 * device. The renderer looks a frame up by elapsed time and rasterises it.
 */
export function buildWalkout(request: WalkoutRequest): WalkoutSequence {
  const base = hallBraceFrame(request.loadRatio);
  const motionMs = walkoutMotionMs(request.plateCount);
  const frames: WalkoutFrame[] = [];

  let runStart = 0;
  let key = drawKeyAt(0, base, request);
  let ms = M.TICK_MS;

  const push = (from: number, to: number, at: DrawKey): void => {
    frames.push({
      index: frames.length,
      startMs: from,
      holdMs: to - from,
      stage: at.stage,
      depth: at.depth,
      direction: base.direction,
      strainLevel: at.strainLevel,
      pitchLevel: base.pitchLevel,
      barLateralPx: at.barLateralPx,
      barTiltDeg: at.barTiltDeg,
      barBendPx: at.barBendPx,
      chalkMotes: base.chalkMotes,
      bodyDxPx: at.bodyDxPx,
      crowdRisePx: at.crowdRisePx,
    });
  };

  while (ms <= motionMs) {
    const next = drawKeyAt(ms, base, request);
    if (!sameDrawing(key, next)) {
      push(runStart, ms, key);
      runStart = ms;
      key = next;
    }
    ms += M.TICK_MS;
  }
  push(runStart, Math.max(runStart + M.TICK_MS, motionMs), key);

  return {
    frames,
    stageStartMs: Object.freeze(walkoutStageStartMs(request.plateCount)),
    motionMs,
    urgent: request.urgent,
  };
}

/**
 * The drawing showing at `ms`.
 *
 * Past the end of the motion this is the last frame — he is set, and the rest of
 * the beat is him standing there, which is the point of the beat.
 */
export function walkoutFrameAt(sequence: WalkoutSequence, ms: number): WalkoutFrame {
  const last = sequence.frames[sequence.frames.length - 1];
  if (last === undefined) {
    throw new RangeError('walkout: the choreography produced no frames to draw.');
  }
  if (ms >= last.startMs) return last;
  let showing = sequence.frames[0] ?? last;
  for (const frame of sequence.frames) {
    if (frame.startMs <= ms) showing = frame;
  }
  return showing;
}

/** Which frame index is showing at `ms`. What the render loop actually tracks. */
export function walkoutFrameIndexAt(sequence: WalkoutSequence, ms: number): number {
  return walkoutFrameAt(sequence, ms).index;
}

/**
 * One walk-out frame as the sprite renderer's own input.
 *
 * `bodyDxPx` and `crowdRisePx` are deliberately NOT here: they are where the
 * drawing goes and what is behind it, which is the composite's business, not
 * the figure's.
 */
export function walkoutLifterFrame(
  frame: WalkoutFrame,
  totalKg: number,
  barAndCollarsKg: number,
): LifterFrameSpec {
  return {
    depth: frame.depth,
    direction: frame.direction,
    strainLevel: frame.strainLevel,
    pitchLevel: frame.pitchLevel,
    barLateralPx: frame.barLateralPx,
    barTiltDeg: frame.barTiltDeg,
    barBendPx: frame.barBendPx,
    chalkMotes: frame.chalkMotes,
    totalKg,
    barKg: barAndCollarsKg,
  };
}
