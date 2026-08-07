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
 * deformation is a modern-engine tell (GDD §7.1).
 *
 * Measured, at a maximal opener on a six-disc bar: 31 held frames over 2,120 ms,
 * resolving to EIGHTEEN distinct sprite drawings. A third attempt is 33 frames
 * and the same 18 drawings — what its two extra frames carry is the room coming
 * up, not the man. So the renderer rasterises 18 sprites and at most 5 rooms for
 * a whole beat, rather than one of each per display frame.
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
 * AND THE SHEET NOW KNOWS HOW LONG THE BEAT IS, WHICH IS THE DEFECT IT DID NOT
 * ===========================================================================
 * `buildWalkout` used to take (loadRatio, plateCount, urgent) and nothing else,
 * so the longest sheet it could ever produce was `motionMs` — 2,120 ms — while
 * `meetDay.ts`'s `walkoutMs` ran the beat for up to 4,800. It could not have
 * filled the difference, because it was never told there was one.
 *
 * Measured on a third-attempt squat with nothing banked (207.5 kg): the beat is
 * 4,100 ms, the last drawing changed at 1,980 ms, the one sound cue had decayed
 * by 2,520, and `useHallStep` cancelled its frame loop at 2,120. 1,980 ms — 48%
 * of the beat, and every millisecond of `THIRD_ATTEMPT_WALKOUT_EXTRA_MS` and
 * `BOMB_RISK_WALKOUT_EXTRA_MS` — was a static raster over silence. A third
 * attempt at a PR with a bomb on it was 2,680 ms of it, 56%.
 *
 * So `WalkoutRequest.beatMs` is required, and the tail is two named windows:
 *
 *   BRACE  he is set and the bar is WORKING. A loaded bar under a braced lifter
 *          is never perfectly still — it rocks, it whips, and his chest and hips
 *          move under it. One oscillation per `WALKOUT_TAIL.BRACE_CYCLE_MS`,
 *          and the period is the window divided by the nearest whole number of
 *          them, so a longer beat buys MORE WAITING AT THE SAME TEMPO rather
 *          than a man who has started moving differently. It also starts and
 *          ends at rest by construction, which is what keeps the cut into the
 *          rep seamless.
 *   HUSH   the last `WALKOUT_TAIL.HUSH_MS`. Nothing moves and the hall stops
 *          rising. The stillness is now a designed window with a length instead
 *          of whatever was left over, and every beat ends on one.
 *
 * A tail shorter than `WALKOUT_TAIL.MIN_BRACE_WINDOW_MS` + `HUSH_MS` is all
 * hush — which is exactly what an opener is today, 280 ms of it, 12% of its
 * beat. That is the line, and it is deliberate: the escalation extras are what
 * BUY the live channel, which is the thing that was untrue before.
 *
 * THE BRACE IS A FUNCTION OF TIME AND OF NOTHING ELSE (GDD §3.4, §12.3). Not of
 * fatigue, not of load, not of the attempt number, not of the seed. A brace cue
 * that varied with readiness is a fatigue meter with the numerals filed off, and
 * §12.3 refuses one; `walkout.test.ts` measures the deltas identical across load
 * ratios and across urgency rather than promising it here.
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
import { PITCH, QUANTISE, STRAIN } from '../art/spriteTuning';
import { MEET_TUNING } from '../game/meetTuning';
import { hallBraceFrame } from './meetHall';

const M = MEET_TUNING.WALKOUT_MOTION;
const C = MEET_TUNING.CROWD;
const T = MEET_TUNING.WALKOUT_TAIL;

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

/**
 * The stages of GDD §6.2 step 1, in order.
 *
 * `SET` is the BRACE window — he is set and the bar is working — and `HUSH` is
 * the still stretch that ends every beat. Both are new; the sheet used to stop
 * at `SET` and hold one drawing for whatever the beat had left.
 */
export type WalkoutStage = 'LOAD' | 'UNRACK' | 'STEP' | 'SETTLE' | 'SET' | 'HUSH';

export const WALKOUT_STAGES: readonly WalkoutStage[] = Object.freeze([
  'LOAD',
  'UNRACK',
  'STEP',
  'SETTLE',
  'SET',
  'HUSH',
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
  /** LOAD through SETTLE. After this he is set and the tail begins. */
  readonly motionMs: number;
  /**
   * The WHOLE beat — `meetDay.ts`'s `walkoutMs`. The sheet runs to here, which
   * is the thing it did not do: it used to stop at `motionMs` and the beat then
   * held a static raster for up to 2,680 ms.
   */
  readonly beatMs: number;
  /** The tail's two windows and the oscillation inside the first. */
  readonly tail: WalkoutTailPlan;
  readonly urgent: boolean;
}

export interface WalkoutRequest {
  /** Attempt weight over the lifter's best single. Drawn strain, nothing else. */
  readonly loadRatio: number;
  /** Discs per side. The loading has to finish before he unracks. */
  readonly plateCount: number;
  /** A third attempt, a PR attempt, or one with a bomb on it. */
  readonly urgent: boolean;
  /**
   * How long the whole beat runs — `meetDay.ts`'s `walkoutMs` for this attempt.
   *
   * REQUIRED, and it is the field whose absence was the defect. Without it the
   * sheet cannot know that a third attempt with a bomb on it is 4,100 ms long
   * and can only ever choreograph the first 2,120.
   */
  readonly beatMs: number;
}

/**
 * The tail's shape: where he stops walking, how long the bar works for, how many
 * oscillations that is, and where he goes still.
 */
export interface WalkoutTailPlan {
  /** Where the tail begins — `motionMs` on a walk-out, 0 on a hold. */
  readonly startMs: number;
  /** How long the bar works for. 0 when the tail is too short to oscillate. */
  readonly braceMs: number;
  /** Whole oscillations across `braceMs`. 0 when `braceMs` is 0. */
  readonly cycles: number;
  /** `braceMs / cycles` — the period actually drawn. 0 when there are none. */
  readonly cycleMs: number;
  /** Where the brace ends and nothing moves any more. */
  readonly hushStartMs: number;
  /** The end of the beat. */
  readonly endMs: number;
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
 * ...and to a good lift THE MEET TURNED ON — a third attempt, a PR, or one with
 * a bomb on it, made.
 *
 * THE ONE WAY THE VERDICT ESCALATES, and it is loudness rather than length. See
 * `MEET_TUNING.DELIBERATION_STAKES_EXTRA_MS` for the rule: the wait for news may
 * be lengthened, the news itself may only be made louder.
 */
export const URGENT_CHEER_CROWD_RISE: CrowdRiseRamp = Object.freeze({
  delayMs: 0,
  rampMs: C.CHEER_RISE_MS,
  toPx: C.URGENT_CHEER_RISE_PX,
});

/** Which cheer ramp a made attempt gets. */
export function cheerCrowdRise(urgent: boolean): CrowdRiseRamp {
  return urgent ? URGENT_CHEER_CROWD_RISE : CHEER_CROWD_RISE;
}

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

/**
 * How the tail between `startMs` and `beatMs` is spent.
 *
 * THE WHOLE-CYCLE ROUNDING IS THE LOAD-BEARING PART. The oscillation is
 * `sin(2*pi * cycles * u)` over the window, so it is at rest at BOTH ends for any
 * whole `cycles` — which is what lets the beat end on exactly the drawing the
 * rep begins from however long the beat is. The alternative, running a
 * fixed-period cycle and cutting it off, would land the cut on whatever phase
 * happened to be showing and put a jump between the walk-out and the attempt.
 *
 * The price is that the period drifts a little with the beat: at the shipped
 * tuning a third attempt gets 2 cycles of 410 ms, a third with a bomb on it 4 of
 * 405, a third at a PR with a bomb 6 of 387, and a first attempt above a PR — the
 * shortest window that oscillates at all — 1 of 620. The window floor
 * (`MIN_BRACE_WINDOW_MS`) is what bounds that drift, so raising the floor makes
 * the tempo steadier and costs the shortest urgent tails their brace.
 */
export function walkoutTailPlan(startMs: number, beatMs: number): WalkoutTailPlan {
  const tailMs = Math.max(0, beatMs - startMs);
  const offered = tailMs - T.HUSH_MS;
  const braceMs = offered >= T.MIN_BRACE_WINDOW_MS ? offered : 0;
  const cycles = braceMs > 0 ? Math.max(1, Math.round(braceMs / T.BRACE_CYCLE_MS)) : 0;
  const hushStartMs = startMs + braceMs;
  return {
    startMs,
    braceMs,
    cycles,
    cycleMs: cycles > 0 ? braceMs / cycles : 0,
    hushStartMs,
    endMs: Math.max(hushStartMs, startMs + tailMs),
  };
}

/**
 * The four boundaries of the MOTION, which are a function of the bar alone.
 *
 * Split out from `walkoutStageStartMs` because the choreography below is a
 * function of the bar and of nothing else — a longer beat must not move the
 * unrack or the steps, only what happens after them.
 */
function motionStartMs(plateCount: number): {
  LOAD: number;
  UNRACK: number;
  STEP: number;
  SETTLE: number;
  SET: number;
} {
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

/** Where each stage starts, ms from the top of the beat. */
export function walkoutStageStartMs(
  plateCount: number,
  beatMs: number,
): Record<WalkoutStage, number> {
  const motion = motionStartMs(plateCount);
  return { ...motion, HUSH: walkoutTailPlan(motion.SET, beatMs).hushStartMs };
}

/** LOAD through SETTLE. After this he is set and the tail begins. */
export function walkoutMotionMs(plateCount: number): number {
  return motionStartMs(plateCount).SET;
}

export function walkoutStageAt(ms: number, plateCount: number, beatMs: number): WalkoutStage {
  const at = walkoutStageStartMs(plateCount, beatMs);
  let stage: WalkoutStage = 'LOAD';
  for (const candidate of WALKOUT_STAGES) {
    if (ms >= at[candidate]) stage = candidate;
  }
  return stage;
}

/**
 * The bar working under a braced lifter at `ms`, -1..1, and 0 outside the brace
 * window.
 *
 * Every channel the tail draws is this ONE number scaled — the same discipline
 * `swingAt` enforces on the steps, and for the same reason: three channels
 * driven off three phases can drift apart into a shimmer, and one channel with
 * three amplitudes cannot.
 */
export function bracePhaseAt(ms: number, plan: WalkoutTailPlan): number {
  if (plan.braceMs <= 0) return 0;
  if (ms < plan.startMs || ms >= plan.hushStartMs) return 0;
  return Math.sin(Math.PI * 2 * plan.cycles * ((ms - plan.startMs) / plan.braceMs));
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
  const at = motionStartMs(plateCount);
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
  const at = motionStartMs(plateCount);
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
  const at = motionStartMs(plateCount);
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
  readonly pitchLevel: number;
  readonly barLateralPx: number;
  readonly barTiltDeg: number;
  readonly barBendPx: number;
  readonly bodyDxPx: number;
  readonly crowdRisePx: number;
}

/**
 * How far the seating has come up at `ms`, in whole scene rows.
 *
 * TWO RAMPS END TO END, and `Math.max` rather than a branch so the hall can
 * never sit back down between them: the first brings it up while he walks out
 * (`WALKOUT_CROWD_RISE`), the second carries the standing wave deeper into the
 * building across the whole BRACE window and then holds it for the hush. A
 * longer beat is therefore a SLOWER hall rather than one that gets up sooner and
 * then waits, which is the only shape that spends the escalation rather than
 * front-loading it.
 */
function crowdRiseAt(ms: number, plateCount: number, plan: WalkoutTailPlan): number {
  const at = motionStartMs(plateCount);
  const walking = crowdRisePxAt(ms - at.UNRACK, WALKOUT_CROWD_RISE);
  if (plan.braceMs <= 0 || ms < plan.startMs) return walking;
  const u = (ms - plan.startMs) / plan.braceMs;
  const deeper =
    C.WALKOUT_RISE_PX + Math.round((T.HUSH_CROWD_RISE_PX - C.WALKOUT_RISE_PX) * smoothstep(u));
  return Math.max(walking, deeper);
}

function drawKeyAt(
  ms: number,
  base: SquatFrame,
  request: WalkoutRequest,
  plan: WalkoutTailPlan,
): DrawKey {
  const { plateCount, urgent } = request;
  const swing = swingAt(ms, plateCount);
  const whip = whipAt(ms, plateCount);
  const drive = unrackDriveAt(ms, plateCount);
  // THE TAIL'S ONE NUMBER. Every channel below that moves after he is set is
  // this scaled, so they cannot drift into a shimmer against each other.
  const brace = bracePhaseAt(ms, plan);

  // Depth in the sheet's own steps, so a dip that would round away is no dip.
  const baseSteps = Math.round(base.poseDepth * QUANTISE.DEPTH_STEPS);
  const steps = baseSteps + Math.round(dipStepsAt(ms, plateCount));

  return {
    stage: walkoutStageAt(ms, plateCount, plan.endMs),
    depth: clamp01(steps / QUANTISE.DEPTH_STEPS),
    strainLevel: Math.min(
      STRAIN.LEVELS - 1,
      base.strainLevel + Math.round(M.UNRACK_STRAIN_BUMP * drive),
    ),
    // The chest-and-hip half of a brace. Clamped at the base rung on the way
    // down, so the drawing goes UP into the breath and back rather than dipping
    // below a pose that is already the rest pose.
    pitchLevel: Math.min(
      PITCH.LEVELS - 1,
      Math.max(base.pitchLevel, base.pitchLevel + Math.round(T.BRACE_PITCH_STEPS * brace)),
    ),
    // The bar rocks the OPPOSITE way to the body: he steps out from under it
    // and back beneath it, which is what a walk-out looks like head-on.
    barLateralPx: quantize(
      base.barLateralPx - swing * M.STEP_BAR_LATERAL_PX,
      QUANTISE.LATERAL_QUANTUM_PX,
    ),
    barTiltDeg: quantize(
      base.barTiltDeg + swing * M.STEP_BAR_TILT_DEG + brace * T.BRACE_TILT_DEG,
      QUANTISE.TILT_QUANTUM_DEG,
    ),
    barBendPx: quantize(
      base.barBendPx * (1 + M.UNRACK_WHIP * whip) + brace * T.BRACE_BEND_PX,
      QUANTISE.BEND_QUANTUM_PX,
    ),
    bodyDxPx: Math.round(swing * M.STEP_BODY_DX_PX),
    crowdRisePx: urgent ? crowdRiseAt(ms, plateCount, plan) : 0,
  };
}

function sameDrawing(a: DrawKey, b: DrawKey): boolean {
  return (
    a.stage === b.stage &&
    a.depth === b.depth &&
    a.strainLevel === b.strainLevel &&
    a.pitchLevel === b.pitchLevel &&
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
  const plan = walkoutTailPlan(motionMs, request.beatMs);
  return {
    // THE SHEET RUNS TO THE END OF THE BEAT, not to the end of the motion. That
    // one bound was the defect: the loop stopped at `motionMs` and everything
    // after it was a frame the renderer held with its clock cancelled.
    frames: coalesce(base, plan.endMs, (ms) => drawKeyAt(ms, base, request, plan)),
    stageStartMs: Object.freeze(walkoutStageStartMs(request.plateCount, request.beatMs)),
    motionMs,
    beatMs: plan.endMs,
    tail: plan,
    urgent: request.urgent,
  };
}

/**
 * The same tail with NO WALK-OUT IN FRONT OF IT — a man standing under a loaded
 * bar for `beatMs`, doing nothing but holding it.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT IS FOR: THE WAIT FOR THE LIGHTS
 * ---------------------------------------------------------------------------
 * `VerdictView` draws the lifter under the loaded bar for the whole deliberation
 * (see `MEET_TUNING.VERDICT_SILENCE_MS` — the pixels do that, whatever an older
 * comment said about the bar being racked), and that screen had no clock for the
 * figure at all: one memoised still for up to 2,400 ms.
 * `MEET_TUNING.DELIBERATION_STAKES_EXTRA_MS` now makes that beat longer on the
 * attempts the meet turns on, and lengthening a beat with nothing in it is
 * exactly the defect the tail above exists to remove. So the wait for the lights
 * gets the same brace, out of the same pure function, at the same tempo.
 *
 * `plateCount` IS 0 AND IT DOES NOT MEAN AN EMPTY BAR. Nothing loads here — the
 * bar was loaded three beats ago — so the sheet starts at the tail, and the
 * drawing's own `totalKg` is what puts discs on it (`walkoutLifterFrame`).
 *
 * NO CROWD. `crowdRisePx` is 0 on every frame: during the deliberation the hall
 * is seated and identical whichever way the call went, which is `VerdictView`'s
 * standing rule, and the cheer is that screen's own ramp fired strictly after
 * the last lamp.
 */
export function buildHold(loadRatio: number, beatMs: number): WalkoutSequence {
  const base = hallBraceFrame(loadRatio);
  const plan = walkoutTailPlan(0, beatMs);
  return {
    frames: coalesce(base, plan.endMs, (ms) => holdKeyAt(ms, base, plan)),
    stageStartMs: Object.freeze({
      LOAD: 0,
      UNRACK: 0,
      STEP: 0,
      SETTLE: 0,
      SET: 0,
      HUSH: plan.hushStartMs,
    }),
    motionMs: 0,
    beatMs: plan.endMs,
    tail: plan,
    urgent: false,
  };
}

/** The hold's drawn identity: the brace, and nothing the walk-out contributes. */
function holdKeyAt(ms: number, base: SquatFrame, plan: WalkoutTailPlan): DrawKey {
  const brace = bracePhaseAt(ms, plan);
  return {
    stage: ms >= plan.hushStartMs ? 'HUSH' : 'SET',
    depth: base.poseDepth,
    strainLevel: base.strainLevel,
    pitchLevel: Math.min(
      PITCH.LEVELS - 1,
      Math.max(base.pitchLevel, base.pitchLevel + Math.round(T.BRACE_PITCH_STEPS * brace)),
    ),
    barLateralPx: base.barLateralPx,
    barTiltDeg: quantize(base.barTiltDeg + brace * T.BRACE_TILT_DEG, QUANTISE.TILT_QUANTUM_DEG),
    barBendPx: quantize(base.barBendPx + brace * T.BRACE_BEND_PX, QUANTISE.BEND_QUANTUM_PX),
    bodyDxPx: 0,
    crowdRisePx: 0,
  };
}

/**
 * Sample a key function at `TICK_MS` up to `endMs` and collapse runs of the same
 * drawing into one held frame.
 *
 * Shared by the walk-out and the hold so the two cannot coalesce differently —
 * the thing that decides what counts as "the same drawing" is `sameDrawing`, and
 * there is one of it.
 */
function coalesce(
  base: SquatFrame,
  endMs: number,
  keyAt: (ms: number) => DrawKey,
): readonly WalkoutFrame[] {
  const frames: WalkoutFrame[] = [];
  const push = (from: number, to: number, at: DrawKey): void => {
    frames.push({
      index: frames.length,
      startMs: from,
      holdMs: to - from,
      stage: at.stage,
      depth: at.depth,
      direction: base.direction,
      strainLevel: at.strainLevel,
      pitchLevel: at.pitchLevel,
      barLateralPx: at.barLateralPx,
      barTiltDeg: at.barTiltDeg,
      barBendPx: at.barBendPx,
      chalkMotes: base.chalkMotes,
      bodyDxPx: at.bodyDxPx,
      crowdRisePx: at.crowdRisePx,
    });
  };

  let runStart = 0;
  let key = keyAt(0);
  let ms = M.TICK_MS;
  while (ms <= endMs) {
    const next = keyAt(ms);
    if (!sameDrawing(key, next)) {
      push(runStart, ms, key);
      runStart = ms;
      key = next;
    }
    ms += M.TICK_MS;
  }
  push(runStart, Math.max(runStart + M.TICK_MS, endMs), key);
  return frames;
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
