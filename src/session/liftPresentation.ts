/**
 * liftPresentation — the renderer-agnostic presentation contract.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS IS, AND WHY IT IS NOT `squatVisual.ts`
 * ---------------------------------------------------------------------------
 * `squatVisual.ts` mixes two things that have different lifespans. One half is
 * presentation TRUTH — how far through the rep the bar is, how hard it is
 * grinding, what is actually loaded on the sleeves. The other half is a
 * SKIA PUPPET — `leftKnee.x = mid - STANCE - KNEE_OUT * sit`, and seven more
 * joints like it, in canvas pixels.
 *
 * The truth half survives an architecture change. The puppet half IS the
 * architecture, and it is the architecture that was rejected: an engineer
 * solving human anatomy in TypeScript produces a mannequin whether it is
 * painted with primitives or with drawn textures. See
 * `docs/design/ADR-001-athlete-animation-architecture.md`.
 *
 * So this module is the truth half, extracted and kept honest by one rule:
 *
 *     @guarantee the-presentation-contract-carries-no-coordinates
 *
 * Nothing here is a pixel, an x, a y, or a joint. Every field is either a
 * normalized scalar, a real-world unit (kg, degrees), or an enum. That is what
 * lets the same contract drive a Rive ViewModel, a skinned 2.5D rig or a 3D
 * rig without being rewritten — and it is what stops the next renderer from
 * inheriting this one's skeleton.
 *
 * ---------------------------------------------------------------------------
 * OWNERSHIP
 * ---------------------------------------------------------------------------
 * Gameplay is authoritative and is NOT duplicated here. Every field is read or
 * derived from `LiftState`; none is re-simulated. This module computes no
 * demand, no outcome and no fatigue — it asks the mechanic what the bar is
 * doing and reports it in units a renderer can consume.
 *
 * Grok Session A is expected to own the authoritative mechanics-to-presentation
 * contract. Until it does, this is the visual side's REQUEST, expressed as a
 * working adapter so the renderer is not blocked waiting for it. When the
 * authoritative contract lands, this collapses to a pass-through rather than
 * being thrown away. `docs/design/PRESENTATION-CONTRACT-REQUEST.md` states
 * exactly which fields are wanted and why.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS DELIBERATELY ABSENT
 * ---------------------------------------------------------------------------
 * `tremor` and `breath` were in the puppet and are NOT here. Both are
 * expressions rather than facts: given `strain`, `grind` and `phase`, a shake
 * amplitude and a breathing loop are things an ARTIST authors in the rig, not
 * things an engineer computes in pixels. Carrying them would re-import the
 * failure this contract exists to prevent. Same reasoning retires the chalk
 * particle cloud — the contract carries `chalk` intensity and a `seed`, and
 * the renderer decides where the dust goes.
 */
import { SQUAT_VISUAL as V } from '../game/sessionTuning';
import {
  cueProgress,
  type LiftOutcome,
  type LiftPhase,
  type LiftState,
} from '../game/lift';
import { LIFT_TUNING, type PlayableLiftKind } from '../game/liftTuning';
import { liveStrain } from '../lift/liftFrame';
import { BAR_AND_COLLARS_KG, visualPlateStack } from '../art/plates';

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function clampSigned(n: number): number {
  if (n < -1) return -1;
  if (n > 1) return 1;
  return n;
}

/**
 * One tick of a lift, in units a renderer can consume on any platform.
 *
 * Read the field comments as a contract: the RANGE is part of the promise, and
 * `liftPresentation.test.ts` holds every normalized field to it.
 */
export interface LiftPresentation {
  /** Which lift is being drawn. The rig picks its own skeleton from this. */
  readonly lift: PlayableLiftKind;
  /** The mechanic's own phase. Authored rig states map onto this. */
  readonly phase: LiftPhase;
  /**
   * Normalized rep position. `1` standing / locked out, `0` at the bottom.
   *
   * This is the single most important number in the contract: it is what makes
   * the motion CONTINUOUS rather than phase-swapped. The mechanic already keeps
   * `height` as `1 - depth` through the descent and as the ascent coordinate
   * after reversal, so a rig driven by this is driven by gameplay, not a clock.
   */
  readonly stand: number;
  /**
   * Signed, normalized bar speed. `+1` is the fastest the bar may rise, `-1`
   * the fastest it may sink once it has been beaten, `0` still.
   *
   * Normalized by the MECHANIC'S OWN clamps (`MAX_RISE_VELOCITY`,
   * `MAX_SINK_VELOCITY`), so the range is structural rather than a clamp
   * hiding a miscalibration. Measured at `20a1aa55`: a played squat reaches
   * exactly `1.0000` at the top of the drive, and goes negative at
   * `loadRatio` 1.0 where the bar is losing.
   *
   * IT IS ZERO THROUGH THE WHOLE DESCENT, and that is the mechanic, not a
   * bug here: `LiftState.velocity` is the ASCENT's velocity. The controlled
   * descent moves `depth` without ever writing `velocity`. Bench exposes
   * `chestRate` for exactly this reason; squat and deadlift have no
   * equivalent, which is the open request in
   * `docs/design/PRESENTATION-CONTRACT-REQUEST.md`. A renderer that wants a
   * descent speed today must differentiate `depth` itself — and that is a
   * renderer reconstructing a gameplay quantity, which is why it is a
   * request rather than something computed here.
   */
  readonly barSpeed: number;
  /** How hard the lift is, `0..1`. Drives effort expression in the rig. */
  readonly strain: number;
  /**
   * Sticking point, `0..1`. Non-zero exactly on the ticks the MECHANIC itself
   * counts as stalled — the grind the player is fighting through, which is the
   * beat this game is named for. Distinct from `strain`: a heavy hold has
   * strain and no grind.
   *
   * THE GATE IS `GRIND_STALL_VELOCITY`, THE SIMULATION'S OWN, and that is the
   * point of this field. An earlier version gated on the visual constant
   * `SQUAT_VISUAL.CAMERA_VEL` (0.05), which sits ABOVE the mechanic's own
   * `MAX_RISE_VELOCITY` (0.03) — so the gate was true on every ascent tick at
   * every load and `grind` was just `strain` with a phase check in front of
   * it. Measured at `20a1aa55` across 7 loads x 3 seeds: 38/38, 44/44 and
   * 57/57 ascent ticks passed the old gate.
   *
   * The oracle is not this module's own arithmetic: the count of ticks with
   * `grind > 0` must equal `LiftResolution.stallTicks`, which the simulation
   * accumulates independently. `liftPresentation.test.ts` asserts that
   * equality, so a renderer-side redefinition of the grind reddens.
   */
  readonly grind: number;
  /** Bar tilt in DEGREES — a real unit, not a pixel offset. */
  readonly barTiltDeg: number;
  /** Bar whip, `-1..1` normalized. Sign follows the mechanic's bend. */
  readonly barFlex: number;
  /** Command / cue prominence, `0..1`. The lift's own stimulus, not a HUD ring. */
  readonly commandGlow: number;
  /** Chalk intensity, `0..1`. The renderer owns where the dust actually goes. */
  readonly chalk: number;
  /** Deterministic seed, so particle placement is stable across replays. */
  readonly seed: number;
  /** Total on the bar, kg. The bar drawn must plausibly be this weight. */
  readonly totalKg: number;
  /** Bar + collars, kg. */
  readonly barKg: number;
  /**
   * Plate kg per side, inboard (largest) first — real loading order.
   *
   * Kg rather than sprite pixels on purpose: the contract says WHAT is loaded,
   * the renderer decides how a 25 is drawn. 80 kg must not be a 220 kg picture.
   */
  readonly platesPerSideKg: readonly number[];
  /** Resolved outcome, or `null` while the rep is still live. */
  readonly outcome: LiftOutcome | null;
}

/**
 * Map one authoritative `LiftState` tick onto the presentation contract.
 *
 * Pure. Reads gameplay; re-simulates nothing.
 */
export function liftPresentationFrom(
  state: LiftState,
  totalKg: number,
): LiftPresentation {
  const stand = clamp01(state.height);
  const ascending = state.phase === 'ASCENT';
  const stalled = state.velocity < LIFT_TUNING.GRIND_STALL_VELOCITY;
  const grind = ascending && stalled ? clamp01(liveStrain(state)) : 0;
  const cue = cueProgress(state);
  const cued = cue !== null && cue >= 0 && cue <= 1;
  const commandGlow = state.held
    ? 1
    : cued
      ? clamp01(V.GLOW_MIN + (1 - V.GLOW_MIN) * (1 - Math.abs(cue - 1)))
      : 0;
  const stack = visualPlateStack(totalKg, BAR_AND_COLLARS_KG);

  return {
    lift: state.config.kind,
    phase: state.phase,
    stand,
    barSpeed: clampSigned(
      state.velocity /
        (state.velocity >= 0
          ? LIFT_TUNING.MAX_RISE_VELOCITY
          : LIFT_TUNING.MAX_SINK_VELOCITY),
    ),
    strain: clamp01(liveStrain(state)),
    grind,
    barTiltDeg: state.barTiltDeg,
    barFlex: clampSigned(state.barBendPx * V.BEND_SCALE),
    commandGlow,
    chalk: clamp01(state.chalkPuff),
    seed: state.config.seed,
    totalKg,
    barKg: BAR_AND_COLLARS_KG,
    platesPerSideKg: stack.perSide.map((p) => p.spec.kg),
    outcome: state.resolution?.outcome ?? null,
  };
}
