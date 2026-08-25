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
  BENCH_PRESS,
  CHALK,
  QUANTISE,
  RESOLUTION,
  byLoad,
  clampLoadRatio,
} from '../art/spriteTuning';
import { pitchLevelForDriftPx, strainLevel } from '../art/rig';
import { BAR_AND_COLLARS_KG } from '../art/plates';
import type { LifterFrameSpec } from '../art/lifterSprite';
import { LIFT_TUNING, TICK_MS } from '../game/liftTuning';
import {
  burstProgress,
  chestApproach,
  lockoutHoldIsLive,
  pressCommandIsLive,
  type LiftPhase,
  type LiftState,
} from '../game/lift';
import { LIFT_PALETTE } from './liftPalette';

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

/**
 * Which of the two authored figures this rep is drawn with.
 *
 * ---------------------------------------------------------------------------
 * A DEADLIFT IS DRAWN AS A SQUAT, AND THIS FUNCTION EXISTS SO THAT IS A
 * DECISION RATHER THAN A COINCIDENCE
 * ---------------------------------------------------------------------------
 * `renderLifterFrame` draws two figures: a front-on back squat and a side-on
 * bench press. There is no deadlift figure, and building one was out of scope
 * for the piece that made deadlift playable — so a deadlift borrows the squat
 * drawing.
 *
 * WHAT IS AND IS NOT RIGHT ABOUT THE BORROWED DRAWING, stated here rather than
 * left for somebody to find on a phone:
 *
 *   RIGHT   The silhouette tracks the bar. `lift.ts` derives `depth` as
 *           `1 - height` through a deadlift's ascent and lockout, so the figure
 *           is folded over when the bar is on the floor and stands up as it
 *           rises. Strain, chalk, bar bend and the plate stack are all real.
 *   WRONG   The bar is on the lifter's BACK, not in their hands. A deadlift
 *           drawn this way reads as a squat that started at the bottom.
 *
 * That is tracked debt for an art piece, not a claim that a deadlift is drawn.
 * The fallback target is `LIFT_TUNING.DEADLIFT_ART_FALLBACK_KIND` rather than a
 * literal `'squat'` here, so the day a third figure exists there is one
 * constant to change and a test that names it — and so that a reader grepping
 * for what deadlift borrows finds a declaration instead of an anonymous string.
 */
export function drawnKindFor(state: LiftState): 'squat' | 'bench' {
  const kind = state.config.kind;
  return kind === 'deadlift' ? LIFT_TUNING.DEADLIFT_ART_FALLBACK_KIND : kind;
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
  const heightSteps = BENCH_PRESS.HEIGHT_STEPS;
  return {
    kind: drawnKindFor(state),
    depth: Math.round(clamp01(state.depth) * depthSteps) / depthSteps,
    height: Math.round(clamp01(state.height) * heightSteps) / heightSteps,
    direction: directionFor(state.phase),
    strainLevel: strainLevel(liveStrain(state)),
    pitchLevel: pitchLevelForDriftPx(state.barForwardPx),
    barLateralPx: quantise(state.barLateralPx, QUANTISE.LATERAL_QUANTUM_PX),
    barTiltDeg: quantise(state.barTiltDeg, QUANTISE.TILT_QUANTUM_DEG),
    barBendPx: quantise(state.barBendPx, QUANTISE.BEND_QUANTUM_PX),
    // Against CHALK.MAX_MOTES, which is what the renderer can actually draw.
    // This read STRAIN.LEVELS at one point, which capped the puff at 4 of the
    // 7 authored motes for no reason anyone would have found by looking.
    chalkMotes: Math.round(state.chalkPuff * CHALK.MAX_MOTES),
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
  const kind = spec.kind ?? 'squat';
  const pose = kind === 'bench' ? (spec.height ?? 0) : spec.depth;
  return [
    kind,
    pose,
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

// ---------------------------------------------------------------------------
// Motion that is a pure function of the rep
//
// These are the animation curves GDD §12.1 expects to be hand-tuned. They are
// functions of `LiftState` rather than of wall-clock time on purpose: the sim
// is the clock, so a shake or a flash cannot drift out of step with the rep it
// belongs to, and a replayed rep shakes identically.
// ---------------------------------------------------------------------------

export interface Shake {
  readonly dx: number;
  readonly dy: number;
}

/**
 * Screen shake while the bar is being beaten.
 *
 * Amplitude is the live force deficit, so the platform shakes hardest exactly
 * when the lifter is losing hardest, and not at all on a rep that never
 * struggles. `SHAKE_MAX_PX` to zero disables it.
 */
export function stageShake(state: LiftState): Shake {
  if (state.phase !== 'ASCENT' || state.netForce >= 0) return { dx: 0, dy: 0 };
  const f = LIFT_TUNING.FEEDBACK;
  const amount = clamp01(-state.netForce / LIFT_TUNING.STRUGGLE_FULL_DEFICIT) * f.SHAKE_MAX_PX;
  const periodTicks = f.SHAKE_PERIOD_MS / TICK_MS;
  const angle = (Math.PI * 2 * state.tick) / periodTicks;
  return { dx: amount * Math.sin(angle), dy: amount * Math.cos(angle) / 2 };
}

/**
 * 1 on the tick an input landed, falling to 0 over `HIT_FLASH_MS`.
 *
 * Reads the last recorded timing rather than an event, because events live for
 * one tick and a flash has to outlive the tick that caused it.
 */
export function hitFlash(state: LiftState): number {
  const last = state.timings[state.timings.length - 1];
  if (last === undefined) return 0;
  const elapsedMs = (state.tick - last.tick) * TICK_MS;
  if (elapsedMs < 0) return 0;
  return clamp01(1 - elapsedMs / LIFT_TUNING.FEEDBACK.HIT_FLASH_MS);
}

/**
 * A 0..1 breathing pulse at a given period.
 *
 * Extracted from `cuePulse` when the armed wait needed the same shape at its
 * own period, rather than written twice — CLAUDE.md's "a guard written for one
 * hook must be applied to its sibling" applied to a curve: two sine
 * calculations a few lines apart are two places for a phase convention to
 * drift, and the two are drawn on the same canvas at the same time.
 */
function pulseAt(tick: number, periodMs: number): number {
  const periodTicks = periodMs / TICK_MS;
  if (periodTicks <= 0) return 1;
  return (Math.sin((Math.PI * 2 * tick) / periodTicks) + 1) / 2;
}

/** A 0..1 breathing pulse for the cue ring, so an open window reads as live. */
export function cuePulse(tick: number): number {
  return pulseAt(tick, LIFT_TUNING.FEEDBACK.CUE_PULSE_MS);
}

// ---------------------------------------------------------------------------
// THE COMMAND BEAT ON STAGE (GDD §6.2, ruled 2026-08-25)
//
// Phone playtest 4 measured the press command's whole stimulus inventory on the
// platform GDD §10.0 ships the beta to and found ONE live channel: a header
// text colour. The haptic the spec designates as the real stimulus is a web
// no-op; the stage was pixel-static across the command; there is no audio in
// the rep loop. Everything in this section is the stage half of the replacement
// and every number behind it is in `LIFT_TUNING.FEEDBACK.STAGE_COMMAND`.
//
// PURE FUNCTIONS OF `LiftState`, like `stageShake` and `hitFlash` above, and
// for the reason that block's header gives: the sim is the clock, so a hit
// cannot drift out of step with the command that caused it, and a replayed rep
// flashes identically.
// ---------------------------------------------------------------------------

/** Which command a stage hit belongs to. Bench presses; deadlift is told to stop. */
export type StageCommandKind = 'press' | 'down';

export interface CommandHit {
  /** Which command fired. Squat has neither and never produces a hit. */
  readonly command: StageCommandKind;
  /** 1 on the tick it fired, falling to 0 over that command's `FLASH_MS`. */
  readonly amount: number;
  /** Alpha of the full-stage wash this tick. */
  readonly washAlpha: number;
  /** The shock ring's radius this tick — it EXPANDS as the wash decays. */
  readonly ringRadius: number;
}

/**
 * ONE PREDICATE FOR BOTH COMMANDS, WHICH IS WHY DEADLIFT'S DOWN CALL IS COVERED
 * WITHOUT A SECOND FUNCTION.
 *
 * Bench's `pressCommandTick` and deadlift's `downCommandTick` are both a tick
 * scheduled in the FUTURE at the first tick of their beat, and both mean "the
 * command has fired" once `state.tick` reaches them. Writing this as two
 * functions is the sibling-drift shape CLAUDE.md has recorded four times in
 * this repository, twice at a distance of one branch — and the second one is
 * the one nobody re-reads. So a lift with a command tick gets the hit, and a
 * lift without one (squat) gets null, by construction rather than by a case
 * somebody remembered to add.
 *
 * IT OUTLIVES ITS PHASE ON PURPOSE. The bench command fires in HOLE and the
 * burst can end on the physics cap a few ticks later, taking the rep into
 * ASCENT while the wash is still decaying; a hit scoped to HOLE would be cut
 * off mid-decay at exactly the moment the bar leaves the chest. Ticks only go
 * forward, so the decay reaches zero and stays there.
 */
function commandTickOf(state: LiftState): { command: StageCommandKind; tick: number } | null {
  const kind = state.config.kind;
  if (kind === 'bench') {
    const at = state.pressCommandTick;
    return at === null || state.tick < at ? null : { command: 'press', tick: at };
  }
  if (kind === 'deadlift') {
    const at = state.downCommandTick;
    return at === null || state.tick < at ? null : { command: 'down', tick: at };
  }
  return null;
}

/**
 * The stage hit for a command that has just fired, or null.
 *
 * @guarantee the-command-is-not-a-dead-channel-on-stage
 * A command that has fired within its own `FLASH_MS` returns a NON-ZERO
 * `washAlpha`, so the stage cannot be pixel-static across the tick a command
 * lands on. `liftFrame.test.ts`'s "the press command paints" drives a real
 * bench rep and asserts a non-zero wash on the command tick and a zero one on
 * the tick before it.
 */
export function commandHit(state: LiftState): CommandHit | null {
  const fired = commandTickOf(state);
  if (fired === null) return null;
  const c = LIFT_TUNING.FEEDBACK.STAGE_COMMAND;
  const elapsedMs = (state.tick - fired.tick) * TICK_MS;
  const holdMs = c.FLASH_MS[fired.command];
  if (holdMs <= 0 || elapsedMs >= holdMs) return null;
  const amount = clamp01(1 - elapsedMs / holdMs);
  return {
    command: fired.command,
    amount,
    washAlpha: amount * c.FLASH_PEAK_ALPHA[fired.command],
    // Expanding: 1 - amount runs 0 -> 1 as the wash fades out.
    ringRadius: c.RING_MIN_R + (c.RING_MAX_R - c.RING_MIN_R) * (1 - amount),
  };
}

/**
 * The armed treatment for a beat that is WAITING on a command, 0..1 alpha, or
 * null when nothing is waiting.
 *
 * @guarantee the-armed-wait-tells-nobody-when-the-command-is-due
 * The returned alpha is a function of `state.tick` and of WHETHER the command
 * has fired — never of WHEN it is scheduled. Two states differing only in a
 * still-future `pressCommandTick` (or `downCommandTick`) return the identical
 * number, so a player who studies this ring learns nothing a countdown would
 * tell them. `liftFrame.test.ts`'s "the armed wait carries no information about
 * the command's tick" builds exactly that pair.
 *
 * WHY THE WAIT NEEDED ANYTHING AT ALL. GDD §6.2 keeps the seeded delay, so
 * bench keeps its reaction identity — but phone playtest 4 measured that wait
 * as 400-1600 ms of motionless silence with a false-start trap behind it, and
 * rejected the chain. "Nothing telegraphs the command" and "nothing is on
 * screen" are different requirements and only the first is the design.
 *
 * BOTH LIFTS THAT WAIT, THROUGH THEIR OWN SHIPPED PREDICATES rather than a
 * third copy of the phase test: bench's HOLE before the command is
 * `!pressCommandIsLive` inside HOLE, and deadlift's lockout hold IS
 * `lockoutHoldIsLive`, which `lift.ts` wrote as bench's deliberate mirror.
 */
export function stageArmed(state: LiftState): number | null {
  const kind = state.config.kind;
  const waiting =
    kind === 'bench'
      ? state.phase === 'HOLE' && !pressCommandIsLive(state)
      : kind === 'deadlift'
        ? lockoutHoldIsLive(state)
        : false;
  if (!waiting) return null;
  const c = LIFT_TUNING.FEEDBACK.STAGE_COMMAND;
  return c.ARMED_MIN_ALPHA + (c.ARMED_MAX_ALPHA - c.ARMED_MIN_ALPHA) * pulseAt(state.tick, c.ARMED_PULSE_MS);
}

export interface BurstPip {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly lit: boolean;
}

export interface BurstReadout {
  /** The dark plate the pips are drawn on. See `BURST_TRAY_PAD`. */
  readonly tray: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly pips: readonly BurstPip[];
  /** How many are lit. Carried so a caller does not have to count the array. */
  readonly lit: number;
}

/**
 * The burst readout for the tick, or null when no burst is open.
 *
 * ONE PIP PER COUNTED TAP THE PHYSICS CAP ALLOWS, lit up to `taps`. The total
 * is `PRESS_BURST_FORCE.MAX_COUNTED_TAPS` read from tuning rather than from the
 * length of anything here, so a tuner who raises the cap gets a longer row
 * without touching this file.
 *
 * @guarantee the-burst-readout-moves-with-the-taps
 * `lit` equals the burst's counted tap total, so the row is a function of what
 * the player did rather than a decoration that happens to be on screen while
 * they do it. `liftFrame.test.ts`'s "the burst readout counts the taps that
 * landed" drives a real burst and asserts `lit` rises with each counted tap and
 * never past the row's length.
 */
export function burstReadout(state: LiftState): BurstReadout | null {
  const progress = burstProgress(state);
  if (progress === null) return null;
  const c = LIFT_TUNING.FEEDBACK.STAGE_COMMAND;
  const total = LIFT_TUNING.PRESS_BURST_FORCE.MAX_COUNTED_TAPS;
  const pitch = c.BURST_PIP_W + c.BURST_PIP_GAP;
  const rowW = total * pitch - c.BURST_PIP_GAP;
  const left = L.CUE_X - rowW / 2;
  const pips: BurstPip[] = [];
  for (let i = 0; i < total; i += 1) {
    pips.push({
      x: left + i * pitch,
      y: c.BURST_PIPS_Y,
      w: c.BURST_PIP_W,
      h: c.BURST_PIP_H,
      lit: i < progress.taps,
    });
  }
  return {
    tray: {
      x: left - c.BURST_TRAY_PAD,
      y: c.BURST_PIPS_Y - c.BURST_TRAY_PAD,
      w: rowW + c.BURST_TRAY_PAD * 2,
      h: c.BURST_PIP_H + c.BURST_TRAY_PAD * 2,
    },
    pips,
    lit: progress.taps,
  };
}

/**
 * What colour the bar glyph is drawn in on the bar-path plot.
 *
 * Steel unless a bench bar is coming down, in which case it is one of three
 * bands of `chestApproach` — GDD §6.2: "What the player watches is the BAR: it
 * is visibly speeding up or slowing down." The read model is `lift.ts`'s and
 * this is the drawing of it.
 *
 * A COLOUR CHOICE LIVES HERE RATHER THAN IN THE COMPONENT because a chain of
 * comparisons inside a `.tsx` file is the "computing a modifier inside a
 * component" CLAUDE.md forbids, one category over — and because it is testable
 * here and is not testable there (`vitest.config.ts` is `environment: node`).
 */
export function barGlyphColour(state: LiftState): string {
  const heat = chestApproach(state);
  if (heat === null) return LIFT_PALETTE.BAR_STEEL;
  const c = LIFT_TUNING.FEEDBACK.STAGE_COMMAND;
  if (heat >= c.BAR_HOT_AT) return LIFT_PALETTE.BAR_APPROACH_HOT;
  if (heat >= c.BAR_WARM_AT) return LIFT_PALETTE.BAR_APPROACH_WARM;
  return LIFT_PALETTE.BAR_APPROACH_CALM;
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
