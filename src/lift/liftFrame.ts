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
  DEADLIFT_PULL,
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
  grindIsLive,
  grindProgress,
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
 * Which of the three authored figures this rep is drawn with.
 *
 * A deadlift used to borrow the squat sheet, bar on the back. That fallback
 * is gone: `renderLifterFrame` has a side-on conventional pull, and this
 * function returns the lift's own kind so a deadlift can never silently
 * render as a squat again.
 */
export function drawnKindFor(state: LiftState): 'squat' | 'bench' | 'deadlift' {
  return state.config.kind;
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
  const kind = drawnKindFor(state);
  const depthSteps = QUANTISE.DEPTH_STEPS;
  const heightSteps = kind === 'deadlift' ? DEADLIFT_PULL.HEIGHT_STEPS : BENCH_PRESS.HEIGHT_STEPS;
  return {
    kind,
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
  const pose = kind === 'bench' || kind === 'deadlift' ? (spec.height ?? 0) : spec.depth;
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
 * launch beat ends a few ticks later, taking the rep into ASCENT while the wash
 * is still decaying; a hit scoped to HOLE would be cut off mid-decay at exactly
 * the moment the bar leaves the chest. Ticks only go forward, so the decay
 * reaches zero and stays there.
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

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface GrindPip extends Box {
  readonly lit: boolean;
}

export interface GrindReadout {
  /** The dark plate the pips are drawn on. See `GRIND_TRAY_PAD`. */
  readonly tray: Box;
  readonly pips: readonly GrindPip[];
  /** How many are lit. Carried so a caller does not have to count the array. */
  readonly lit: number;
  /**
   * 1 on the tick a tap was COUNTED, falling to 0 over `GRIND_KICK_MS`.
   *
   * The rate channel the pip row cannot carry: a row that fills to the right
   * reads as a counter whatever number is behind it, and what a counter cannot
   * show is that a tap just landed. Reads `grindLastTapTick`, which only
   * `advanceGrind` writes and only for taps that cleared the refractory — so
   * this flashes at the COUNTED rate rather than at the dispatched one.
   */
  readonly kick: number;
  /** Where that flash is drawn. Outside `tray` — see `GRIND_KICK_GAP`. */
  readonly rail: Box;
}

/**
 * The grind readout for the tick, or null when the grind is not live.
 *
 * ---------------------------------------------------------------------------
 * THE SELECTOR CONTRACT FORCED THIS FILE TO CHANGE, AND THE NAMES FOLLOWED IT
 * ---------------------------------------------------------------------------
 * The row used to be one pip per counted tap out of a per-rep tap cap, lit up
 * to `progress.taps`. The 2026-08-25 replay steer deleted both ends of that:
 * there is no cap to be a row length, and a running tap total on a continuous
 * grind rises forever, so a row keyed to it would fill up and then stay full
 * while the player quietly stopped tapping — on screen, and reading nothing.
 *
 * So the row reads `progress.lit`, which is what the player's CURRENT tap rate
 * is worth scaled onto `progress.units`. It fills as they speed up and empties
 * as they slow down. The mechanic-side selector is `grindProgress` in
 * `lift.ts`; this is the geometry of it and nothing more.
 *
 * THE `burst` NAMES THIS FILE'S HEADER DECLARED AS DEBT ARE GONE, and the
 * whole surface moved in one commit: `burstReadout`/`BurstReadout`/`BurstPip`,
 * the `BURST_PIP_*` and `BURST_TRAY_*` tuning keys, the `BURST_*` palette
 * entries, `LiftStage.tsx` and `tools/verify-lift-press.mjs`'s readers. The
 * reason the debt was declared rather than paid at the time was scope, and the
 * reason it could not be left is CLAUDE.md's: nobody re-verifies a name.
 *
 * ---------------------------------------------------------------------------
 * AND A ROW THAT ONLY FILLS STILL READS AS A COUNTER, WHICH IS WHY `kick` EXISTS
 * ---------------------------------------------------------------------------
 * `lit` is honest — it rises and falls with the rate — and it is not, on its
 * own, legible AS a rate. A horizontal row filling to the right is the shape of
 * a progress bar, and a player reading one asks "how far along am I" rather
 * than "how hard am I going". What separates the two is evidence that
 * individual taps are LANDING, which a level cannot show and a flash can. So
 * every counted tap flashes the rail under the tray for `GRIND_KICK_MS`.
 *
 * IT READS THE COUNTED TAP AND NOT THE DISPATCHED ONE. `grindLastTapTick` is
 * written by `advanceGrind` only when the press cleared
 * `GRIND_TAP_REFRACTORY_TICKS`, so a player mashing past the mechanic's floor
 * sees the rail flash at the rate the mechanic BELIEVES rather than at the rate
 * their thumb is moving. That is the honest one: it is the rate the charge is
 * actually being fed at.
 *
 * @guarantee the-grind-readout-moves-with-the-rate
 * `lit` equals the grind's live lit-unit count, so the row is a function of
 * what the player is doing NOW rather than a decoration that happens to be on
 * screen while they do it. `liftFrame.test.ts`'s "the grind readout follows the
 * tap rate up and back down" drives a real rep, asserts the row rises while
 * taps land and FALLS once they stop, and asserts it never exceeds the row's
 * length.
 */
export function grindReadout(state: LiftState): GrindReadout | null {
  const progress = grindProgress(state);
  if (progress === null) return null;
  const c = LIFT_TUNING.FEEDBACK.STAGE_COMMAND;
  const total = progress.units;
  const pitch = c.GRIND_PIP_W + c.GRIND_PIP_GAP;
  const rowW = total * pitch - c.GRIND_PIP_GAP;
  const left = L.CUE_X - rowW / 2;
  const pips: GrindPip[] = [];
  for (let i = 0; i < total; i += 1) {
    pips.push({
      x: left + i * pitch,
      y: c.GRIND_PIPS_Y,
      w: c.GRIND_PIP_W,
      h: c.GRIND_PIP_H,
      lit: i < progress.lit,
    });
  }
  const trayX = left - c.GRIND_TRAY_PAD;
  const trayY = c.GRIND_PIPS_Y - c.GRIND_TRAY_PAD;
  const trayW = rowW + c.GRIND_TRAY_PAD * 2;
  const trayH = c.GRIND_PIP_H + c.GRIND_TRAY_PAD * 2;
  const lastTap = state.grindLastTapTick;
  const sinceTapMs = lastTap === null ? Infinity : (state.tick - lastTap) * TICK_MS;
  return {
    tray: { x: trayX, y: trayY, w: trayW, h: trayH },
    pips,
    lit: progress.lit,
    kick: sinceTapMs < 0 ? 0 : clamp01(1 - sinceTapMs / c.GRIND_KICK_MS),
    rail: {
      x: trayX,
      y: trayY + trayH + c.GRIND_KICK_GAP,
      w: trayW,
      h: c.GRIND_KICK_H,
    },
  };
}

/**
 * The stall band for the tick, or null when the bar is not stalled.
 *
 * ---------------------------------------------------------------------------
 * WHY BENCH NEEDS ITS OWN URGENT BEAT WHEN `stageShake` ALREADY EXISTS
 * ---------------------------------------------------------------------------
 * `stageShake` fires on every lift whenever `netForce` is negative, and it says
 * "the lifter is losing". It does not say the thing bench's mechanic turns on,
 * which is that TAPPING NOW WOULD FIX IT. GDD §6.2's headline property is
 * "stop tapping and the bar stalls; start again and it comes back", and a
 * rescue the player cannot see the need for is a rescue they will not attempt.
 *
 * WHAT IT KEYS ON, AND WHY THAT EXACT PREDICATE. `grindIsLive` is the
 * mechanic's own answer to "do taps do anything right now"; `phase === 'ASCENT'`
 * excludes the launch beat, where the bar is motionless BY DESIGN and a stall
 * cue would be a lie; and `velocity < GRIND_STALL_VELOCITY` is character for
 * character the test `stepLift` increments `stallTicks` on. So the band is on
 * exactly while the mechanic is counting a stalled tick, and it goes off the
 * tick the bar starts moving again — which is what makes the rescue readable as
 * a rescue.
 *
 * IT DELIBERATELY DOES NOT READ `stallTicks` OR `stallCapacityLoss`. Both are
 * per-rep accumulators that only ever rise, so a band keyed to either would
 * come on at the first stalled tick and stay on through the rescue and the
 * lockout — a cue that has stopped reading, and (for `stallCapacityLoss`) GDD
 * §3.4's meter with the numerals filed off. `depth` below is `netForce`, the
 * same instantaneous quantity `stageShake` and `liveStrain` normalise, and it
 * is scaled rather than thresholded so a bar that is barely losing draws a
 * quieter band than one that is being buried.
 *
 * @guarantee the-stall-band-is-live-and-not-an-accumulator
 * Two states differing only in `velocity` — one under `GRIND_STALL_VELOCITY`
 * and one over it — return a band and null respectively, at identical
 * `stallTicks` and identical `stallCapacityLoss`. `liftFrame.test.ts`'s "the
 * stall band goes out the tick the bar moves again" builds that pair from a
 * real rep and asserts both directions.
 */
export interface StallBand {
  /** 0..1 how far the bar is losing this tick. `stageShake`'s normalisation. */
  readonly depth: number;
  /** Alpha of the band this tick. Never 0 while the bar is stalled. */
  readonly alpha: number;
  /** The band, as a stroked rectangle inset by half its own width. */
  readonly band: Box & { readonly strokeWidth: number };
}

export function stallBand(state: LiftState): StallBand | null {
  if (!grindIsLive(state)) return null;
  if (state.phase !== 'ASCENT') return null;
  if (state.velocity >= LIFT_TUNING.GRIND_STALL_VELOCITY) return null;
  const c = LIFT_TUNING.FEEDBACK.STAGE_COMMAND;
  const depth =
    state.netForce >= 0 ? 0 : clamp01(-state.netForce / LIFT_TUNING.STRUGGLE_FULL_DEFICIT);
  const base = c.STALL_MIN_ALPHA + (c.STALL_MAX_ALPHA - c.STALL_MIN_ALPHA) * depth;
  const pulse = pulseAt(state.tick, c.STALL_PULSE_MS);
  const half = c.STALL_BAND_PX / 2;
  return {
    depth,
    // FLOORED RATHER THAN MULTIPLIED STRAIGHT BY THE PULSE, so the band cannot
    // blink fully off while the bar is losing. See `STALL_PULSE_FLOOR`.
    alpha: base * (c.STALL_PULSE_FLOOR + (1 - c.STALL_PULSE_FLOOR) * pulse),
    band: {
      x: half,
      y: half,
      w: L.STAGE_W - c.STALL_BAND_PX,
      h: L.STAGE_H - c.STALL_BAND_PX,
      strokeWidth: c.STALL_BAND_PX,
    },
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
 * THE BANDS SAY CONTROL, NOT PROXIMITY, AND THE NAMES NOW SAY SO. Under the
 * beat the 2026-08-25 replay steer replaced, the player steered the bar's rate
 * the whole way down, so calling the ramp an "approach" was fair. Under
 * hold-to-lower there is nothing to steer: holding is correct at every load and
 * arrives at quality 1, so `chestApproach`'s number can only ever be non-zero
 * for a bar the player LET GO OF. Approach itself is drawn — it is the glyph's
 * HEIGHT on this plot, which is the literal thing a bar-path trace is — so the
 * colour is free to carry the other fact and is named for it.
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
  if (heat >= c.BAR_CRASH_AT) return LIFT_PALETTE.BAR_CRASHING;
  if (heat >= c.BAR_RUNAWAY_AT) return LIFT_PALETTE.BAR_RUNNING_AWAY;
  return LIFT_PALETTE.BAR_UNDER_CONTROL;
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
