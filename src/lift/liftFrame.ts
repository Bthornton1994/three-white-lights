/**
 * liftFrame.ts — the adapter between a live rep and the sprite system.
 *
 * PURE. Zero React, zero Skia, zero I/O. It turns a `LiftState` into the two
 * things a renderer needs: a `LifterFrameSpec` for `renderLifterFrame`, and the
 * screen geometry of the bar-path plot. Both are plain data, so both are
 * testable without a canvas — which is the only reason the renderer has any
 * tests at all.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS NOT `squatAnimation.ts`
 * ---------------------------------------------------------------------------
 * `src/art/squatAnimation.ts` already builds a squat rep: phases, bar path,
 * strain, and a coalesced frame list. It is a CANNED rep. Given a load it
 * returns the same frames every time, because it exists to prove the sprite
 * work and to feed a contact sheet.
 *
 * A played rep cannot come from there. Its timing is decided by the player, it
 * can stall and go backwards, and it can end in the middle. So the drawing has
 * to be derived per tick from the live state instead.
 *
 * WHAT IS REUSED RATHER THAN REBUILT, which is the whole point of this file
 * being an adapter and not a second animation system:
 *
 *   - `strainLevel()` and `pitchLevelForDriftPx()` from `rig.ts` do the
 *     quantising, so a played rep lands on exactly the authored drawings the
 *     canned one does. There is one sprite sheet, not two.
 *   - `QUANTISE` from `spriteTuning.ts` gives the same depth / tilt / bend /
 *     lateral steps, so a played rep is no smoother than the sheet allows.
 *     GDD §7.1: continuous per-frame deformation is a modern-engine tell.
 *   - `renderLifterFrame()` and `makeSpriteImage()` are untouched.
 *
 * WHAT THIS ADDS THAT THE CANNED VERSION CANNOT HAVE: strain responds to
 * whether the bar is CURRENTLY LOSING, not only to load and phase. Two frames
 * at the same height under the same weight draw differently depending on
 * whether the lifter is winning. That is the thing a played rep gets to say.
 *
 * ---------------------------------------------------------------------------
 * NO NUMBERS LIVE HERE
 * ---------------------------------------------------------------------------
 * Every value is read from `LIFT_TUNING` or from `spriteTuning.ts`.
 * `liftTuning.test.ts` scans this file and fails on any numeric literal that is
 * not 0, 1 or 2.
 */

import {
  QUANTISE,
  RESOLUTION,
  STRAIN,
  byLoad,
  clampLoadRatio,
} from '../art/spriteTuning';
import { pitchLevelForDriftPx, strainLevel } from '../art/rig';
import { BAR_AND_COLLARS_KG } from '../art/plates';
import type { LifterFrameSpec } from '../art/lifterSprite';
import { LIFT_TUNING } from '../game/liftTuning';
import type { LiftPhase, LiftState } from '../game/lift';

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function quantise(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/**
 * How much of the load's strain shows at this point in a LIVE rep.
 *
 * Same shape as the canned animation's phase weighting, plus one term it does
 * not have: `struggle`, which is how far the bar is currently losing. It is
 * added rather than multiplied so a stalling lifter is drawn uglier at a given
 * height than a moving one, without changing the ladder a clean rep walks.
 */
export function liveStrain(state: LiftState): number {
  const w = LIFT_TUNING.STRAIN_PHASE_WEIGHT;
  const load = clampLoadRatio(state.config.loadRatio);
  const base = byLoad(LIFT_TUNING.STRAIN_FROM_LOAD, load);
  const depth = clamp01(state.depth);
  const h = clamp01(state.height);

  let weight: number;
  switch (state.phase) {
    case 'BRACE':
      weight = w.BRACE;
      break;
    case 'DESCENT':
      weight = w.DESCENT_TOP + (w.DESCENT_BOTTOM - w.DESCENT_TOP) * depth;
      break;
    case 'HOLE':
      weight = w.HOLE;
      break;
    case 'ASCENT':
      weight = w.ASCENT_BASE - w.ASCENT_FALLOFF * h;
      break;
    default:
      weight = w.LOCKOUT;
      break;
  }

  const struggle =
    state.netForce >= 0
      ? 0
      : clamp01(-state.netForce / LIFT_TUNING.STRUGGLE_FULL_DEFICIT);
  return clamp01(base * weight + LIFT_TUNING.STRAIN_STRUGGLE_BONUS * struggle);
}

/** Which way the lifter is drawn as travelling. */
export function directionFor(phase: LiftPhase): 'DESCENT' | 'ASCENT' {
  return phase === 'BRACE' || phase === 'DESCENT' || phase === 'HOLE'
    ? 'DESCENT'
    : 'ASCENT';
}

/** Total on the bar for a load ratio, rounded to something loadable-looking. */
export function totalKgFor(loadRatio: number, bestSingleKg: number): number {
  const step = LIFT_TUNING.DEMO.ROUND_TO_KG;
  const raw = Math.max(BAR_AND_COLLARS_KG, loadRatio * bestSingleKg);
  return Math.round(raw / step) * step;
}

/**
 * The drawing for this tick.
 *
 * QUANTISED THROUGH THE SAME STEPS THE CANNED ANIMATION USES. Without that a
 * played rep would deform continuously and read as a modern engine pretending
 * to be a sprite, which GDD §7.1 rules out — and it would also make the sprite
 * image cache useless, because every tick would be a new drawing.
 */
export function liftFrameSpec(state: LiftState, totalKg: number): LifterFrameSpec {
  const depthSteps = QUANTISE.DEPTH_STEPS;
  return {
    depth: Math.round(clamp01(state.depth) * depthSteps) / depthSteps,
    direction: directionFor(state.phase),
    strainLevel: strainLevel(liveStrain(state)),
    pitchLevel: pitchLevelForDriftPx(state.barForwardPx),
    barLateralPx: quantise(state.barLateralPx, QUANTISE.LATERAL_QUANTUM_PX),
    barTiltDeg: quantise(state.barTiltDeg, QUANTISE.TILT_QUANTUM_DEG),
    barBendPx: quantise(state.barBendPx, QUANTISE.BEND_QUANTUM_PX),
    chalkMotes: Math.round(state.chalkPuff * STRAIN.LEVELS),
    totalKg,
    barKg: BAR_AND_COLLARS_KG,
  };
}

/**
 * A cache key for the drawing.
 *
 * `renderLifterFrame` rasterises a 96x72 grid with per-pixel shading, which is
 * far too much to redo sixty times a second for a drawing that has not changed.
 * Two ticks with the same key are the same image. This is the runtime half of
 * the same idea `coalesceFrames` implements offline.
 */
export function frameKey(spec: LifterFrameSpec): string {
  return [
    spec.depth,
    spec.direction,
    spec.strainLevel,
    spec.pitchLevel,
    spec.barLateralPx,
    spec.barTiltDeg,
    spec.barBendPx,
    spec.chalkMotes,
    spec.totalKg,
  ].join('|');
}

// ---------------------------------------------------------------------------
// Bar-path plot geometry
// ---------------------------------------------------------------------------

export interface TracePoint {
  readonly x: number;
  readonly y: number;
}

const L = LIFT_TUNING.LAYOUT;

/** Screen y for a normalised bar height. h = 1 is the top of the plot. */
export function traceY(height: number): number {
  const span = L.TRACE_H_MAX - L.TRACE_H_MIN;
  const t = clamp01((height - L.TRACE_H_MIN) / span);
  return L.TRACE_BOTTOM - t * (L.TRACE_BOTTOM - L.TRACE_TOP);
}

/**
 * Screen x for a sagittal drift, in the bar-path plot.
 *
 * THE PLOT IS THE SIDE VIEW THE SPRITE CANNOT BE. `barForwardPx` is toward the
 * toes, and the sprite is drawn head-on, so the drift reaches the sprite only
 * through the pitch channel — the body folding. Here it is drawn literally,
 * which is what a bar-path trace IS in the sport and what makes the two views
 * complementary rather than redundant.
 */
export function traceX(forwardPx: number): number {
  return L.TRACE_X + L.TRACE_W / 2 + forwardPx * L.TRACE_PX_PER_DRIFT;
}

/** The whole path so far, oldest first, capped at the trace length. */
export function tracePoints(history: readonly LiftState[]): TracePoint[] {
  const max = LIFT_TUNING.FEEDBACK.TRACE_MAX_POINTS;
  const from = Math.max(0, history.length - max);
  const points: TracePoint[] = [];
  for (let i = from; i < history.length; i += 1) {
    const state = history[i];
    if (state === undefined) continue;
    points.push({ x: traceX(state.barForwardPx), y: traceY(state.height) });
  }
  return points;
}

/** Alpha for a point, oldest faintest. */
export function traceAlpha(index: number, count: number): number {
  if (count <= 1) return 1;
  const min = LIFT_TUNING.FEEDBACK.TRACE_MIN_ALPHA;
  return min + (1 - min) * (index / (count - 1));
}

/** Where the drawn sprite ends, so the stage can be laid out around it. */
export const SPRITE_BOX = Object.freeze({
  x: L.SPRITE_X,
  y: L.SPRITE_Y,
  w: RESOLUTION.CELL_W * LIFT_TUNING.FEEDBACK.SPRITE_SCALE,
  h: RESOLUTION.CELL_H * LIFT_TUNING.FEEDBACK.SPRITE_SCALE,
});

// ---------------------------------------------------------------------------
// Cue ring geometry
// ---------------------------------------------------------------------------

export interface CueRing {
  /** Current radius, shrinking from outer to inner as the window runs. */
  readonly radius: number;
  /** Radius the ring passes through at the ideal moment. */
  readonly targetRadius: number;
  /** True while the input would grade 'perfect'. */
  readonly inPerfectBand: boolean;
  /** True once the window has opened. */
  readonly open: boolean;
}

/**
 * The shrinking ring the player times against.
 *
 * `progress` is 0 when the window opens, 1 at the ideal moment, and above 1 as
 * it closes — `cueProgress()` in `lift.ts`. The ring passes through the target
 * radius exactly at 1, so "ring meets target" and "input grades perfect" are
 * the same instant rather than two things that agree approximately.
 */
export function cueRing(progress: number | null): CueRing | null {
  if (progress === null) return null;
  const f = LIFT_TUNING.FEEDBACK;
  const outer = f.CUE_RING_OUTER_R;
  const inner = f.CUE_RING_INNER_R;
  const span = outer - inner;
  // Progress runs 0 -> 1 -> 2 across open -> ideal -> close, so halving it maps
  // the whole window onto the ring's travel.
  const t = clamp01(progress / 2);
  return {
    radius: outer - span * t,
    targetRadius: outer - span / 2,
    inPerfectBand: Math.abs(progress - 1) <= LIFT_TUNING.PERFECT_BAND_FRACTION,
    open: progress >= 0,
  };
}
