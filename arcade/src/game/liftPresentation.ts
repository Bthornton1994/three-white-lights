/**
 * Session A presentation-state contract.
 *
 * Grok owns gameplay truth. Claude Code owns how it looks.
 * This module is the only Session A lift data Claude should bind a renderer to.
 *
 * It does not draw. It does not name animations. It does not mention bones,
 * stills, or facial expressions. It reads `LiftState` and the prescribed load
 * and returns mechanical facts.
 *
 * Fatigue is already applied inside `stepLift` (window width, capacity). There
 * is no fatigue number here on purpose — GDD §3.4 / §12.3.
 *
 * Do not import this from a renderer into `lift.ts`. The sim does not know
 * this file exists.
 */
import { BAR_AND_COLLARS_KG, visualPlateStack, type PlateHue } from '../art/plates';
import {
  chestApproach,
  cueProgress,
  grindProgress,
  lockoutHoldIsLive,
  pressCommandIsLive,
  type GrindProgress,
  type InputTiming,
  type LiftEvent,
  type LiftOutcome,
  type LiftPhase,
  type LiftResolution,
  type LiftState,
  type MissReason,
} from './lift';
import {
  LIFT_TUNING,
  TICK_MS,
  byLoad,
  clampLoadRatio,
  type PlayableLiftKind,
} from './liftTuning';

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/** Clock the sim and any renderer must share. Milliseconds per tick. */
export const PRESENTATION_TICK_MS = TICK_MS;

export type LiftEffortBand = 'easy' | 'normal' | 'hard' | 'grind' | 'failing';

export interface LiftPlateDisc {
  readonly kg: number;
  readonly hue: PlateHue;
  readonly diameterMm: number;
}

export interface LiftLoadTruth {
  readonly totalKg: number;
  readonly barKg: number;
  readonly loadRatio: number;
  /** Inboard (heaviest) first, one side. Mirror for the other sleeve. */
  readonly discs: readonly LiftPlateDisc[];
  readonly remainderKg: number;
}

export interface LiftCommandTruth {
  readonly held: boolean;
  readonly cueProgress: number | null;
  readonly pressCommandLive: boolean;
  readonly lockoutHoldLive: boolean;
}

export interface LiftPresentationState {
  readonly kind: PlayableLiftKind;
  readonly phase: LiftPhase;
  readonly tick: number;
  readonly phaseTick: number;
  /**
   * 0 = bottom of the hole / floor, 1 = lockout.
   * Squat and bench keep this as `1 - depth` on the way down. Continuous.
   */
  readonly barHeight: number;
  /** 0 = standing / rack, 1 = authored bottom. May exceed 1 (buried). */
  readonly depth: number;
  /**
   * Signed actual vertical bar displacement this tick, in height units.
   * Positive = rising, negative = descending, 0 = stationary.
   *
   * NOT `LiftState.velocity`. That field is the ascent force integrator and
   * stays 0 through squat/bench descent while `height` still falls. See
   * `integratorVelocity`.
   *
   * 0 is only actual motion when `motionSampleValid` is true. If that flag is
   * false, this is 0 because there was no adjacent `prior`, not because the
   * bar sat still.
   */
  readonly barVelocity: number;
  /**
   * True when `prior` exists and `prior.tick + 1 === state.tick`.
   * False means this snapshot has no adjacent motion sample.
   */
  readonly motionSampleValid: boolean;
  /**
   * Ascent force integrator (`LiftState.velocity`). Height units / tick.
   * 0 throughout squat/bench DESCENT by design. Stall/grind read this, not
   * `barVelocity`. Do not use it as “the bar is moving.”
   */
  readonly integratorVelocity: number;
  readonly peakHeight: number;
  readonly netForce: number;
  /** 0..1. Load + phase + current deficit. Not a fatigue meter. */
  readonly strain: number;
  /**
   * 0..1. 1 = stalled or being beaten on the way up.
   * Uses `GRIND_STALL_VELOCITY`, not a renderer constant.
   */
  readonly grindIntensity: number;
  readonly effortBand: LiftEffortBand;
  readonly stallTicks: number;
  readonly ascentTicks: number;
  readonly depthAchieved: boolean;
  readonly extraDepth: number;
  readonly chalkPuff: number;
  readonly barForwardPx: number;
  readonly barLateralPx: number;
  readonly barTiltDeg: number;
  readonly barBendPx: number;
  readonly load: LiftLoadTruth;
  readonly command: LiftCommandTruth;
  readonly lastTiming: InputTiming | null;
  readonly events: readonly LiftEvent[];
  readonly resolution: LiftResolution | null;
  readonly outcome: LiftOutcome | null;
  readonly missReason: MissReason | null;
  readonly lockedOut: boolean;
  readonly complete: boolean;
  readonly chestApproach: number | null;
  readonly benchGrind: GrindProgress | null;
  readonly seed: number;
}

/**
 * Strain read-model. Same formula as `liveStrain` in liftFrame — restated here
 * so `src/game` does not import the Meet Day sprite adapter (A0 freeze).
 *
 * P1 DEBT: two implementations of one truth. Canonicalising into `src/game`
 * would require editing `src/lift/liftFrame.ts`. Do not cross that freeze for
 * cleanup. The equality test in `liftPresentation.test.ts` is the guard.
 */
export function presentationStrain(state: LiftState): number {
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

/**
 * True when `prior` is the immediately previous sim tick.
 * A non-adjacent snapshot is still a valid inspect; it is not a motion sample.
 */
export function motionSampleValid(state: LiftState, prior: LiftState | null): boolean {
  return prior !== null && state.tick === prior.tick + 1;
}

/**
 * Actual bar motion this tick: Δheight when `prior` is the immediately
 * previous state. Height-space: +rise / −descend / 0 stationary.
 *
 * `LiftState.velocity` is the wrong source on the way down. Squat and bench
 * write height from depth (`height = 1 - depth`) and leave the integrator at
 * 0 until reversal or press launch.
 */
export function barMotionPerTick(state: LiftState, prior: LiftState | null): number {
  if (prior === null || state.tick !== prior.tick + 1) return 0;
  return state.height - prior.height;
}

export function presentationGrind(state: LiftState): number {
  if (state.phase === 'LOCKOUT' && state.lockoutSlipTicks > 0) {
    return 1;
  }
  if (state.phase !== 'ASCENT') {
    return 0;
  }
  if (state.velocity < 0) {
    return 1;
  }
  const stall = LIFT_TUNING.GRIND_STALL_VELOCITY;
  if (state.velocity <= stall) {
    return 1;
  }
  const free = stall + stall;
  return clamp01(1 - (state.velocity - stall) / (free - stall));
}

function effortBandFor(
  state: LiftState,
  grind: number,
  strain: number,
): LiftEffortBand {
  if (state.resolution?.outcome === 'miss') return 'failing';
  if (state.phase === 'ASCENT' && state.velocity < 0) return 'failing';
  if (grind === 1 || state.stallTicks > 0) return 'grind';
  if (state.netForce < 0 || state.extraDepth > 0) return 'hard';
  const load = clampLoadRatio(state.config.loadRatio);
  const mid =
    (LIFT_TUNING.STRAIN_FROM_LOAD.LIGHT + LIFT_TUNING.STRAIN_FROM_LOAD.MAXIMAL) /
    2;
  if (load <= mid && strain < mid) return 'easy';
  return 'normal';
}

export function liftPresentation(
  state: LiftState,
  totalKg: number,
  prior: LiftState | null,
): LiftPresentationState {
  const stack = visualPlateStack(totalKg, BAR_AND_COLLARS_KG);
  const strain = presentationStrain(state);
  const grind = presentationGrind(state);
  const last = state.timings[state.timings.length - 1];
  const complete = state.phase === 'RESOLVED';
  const outcome = state.resolution?.outcome ?? null;

  return {
    kind: state.config.kind,
    phase: state.phase,
    tick: state.tick,
    phaseTick: state.phaseTick,
    barHeight: state.height,
    depth: state.depth,
    barVelocity: barMotionPerTick(state, prior),
    motionSampleValid: motionSampleValid(state, prior),
    integratorVelocity: state.velocity,
    peakHeight: state.peakHeight,
    netForce: state.netForce,
    strain,
    grindIntensity: grind,
    effortBand: effortBandFor(state, grind, strain),
    stallTicks: state.stallTicks,
    ascentTicks: state.ascentTicks,
    depthAchieved: state.depthAchieved,
    extraDepth: state.extraDepth,
    chalkPuff: clamp01(state.chalkPuff),
    barForwardPx: state.barForwardPx,
    barLateralPx: state.barLateralPx,
    barTiltDeg: state.barTiltDeg,
    barBendPx: state.barBendPx,
    load: {
      totalKg: stack.totalKg,
      barKg: BAR_AND_COLLARS_KG,
      loadRatio: state.config.loadRatio,
      discs: stack.perSide.map((plate) => ({
        kg: plate.spec.kg,
        hue: plate.spec.hue,
        diameterMm: plate.spec.diameterMm,
      })),
      remainderKg: stack.remainderKg,
    },
    command: {
      held: state.held,
      cueProgress: cueProgress(state),
      pressCommandLive: pressCommandIsLive(state),
      lockoutHoldLive: lockoutHoldIsLive(state),
    },
    lastTiming: last === undefined ? null : last,
    events: state.events,
    resolution: state.resolution,
    outcome,
    missReason: state.resolution?.missReason ?? null,
    lockedOut:
      state.phase === 'LOCKOUT' ||
      (complete && outcome !== 'miss' && (state.peakHeight >= 1 || state.height >= 1)),
    complete,
    chestApproach: chestApproach(state),
    benchGrind: grindProgress(state),
    seed: state.config.seed,
  };
}
