/**
 * squatVisual — simulation → continuous squat pose.
 *
 * The mechanic (`lift.ts`) already owns height, velocity, grind and load.
 * This file does not retune it. It maps one LiftState tick onto a persistent
 * rig: joints, bar, plates, tremor, breath, command glow.
 *
 * Ask: "what is the existing bar doing at this height?"
 * Do not ask: "which JPEG is this phase?"
 */
import { SQUAT_VISUAL as V } from '../game/sessionTuning';
import { cueProgress, type LiftPhase, type LiftState } from '../game/lift';
import { liveStrain } from '../lift/liftFrame';
import { BAR_AND_COLLARS_KG, visualPlateStack, type LoadedPlate } from '../art/plates';

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export interface SquatJoint {
  readonly x: number;
  readonly y: number;
}

export interface SquatChalk {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly a: number;
}

export interface SquatPose {
  readonly stand: number;
  readonly sit: number;
  readonly bar: SquatJoint;
  readonly barTiltDeg: number;
  readonly barBend: number;
  readonly hip: SquatJoint;
  readonly leftFoot: SquatJoint;
  readonly rightFoot: SquatJoint;
  readonly leftKnee: SquatJoint;
  readonly rightKnee: SquatJoint;
  readonly leftShoulder: SquatJoint;
  readonly rightShoulder: SquatJoint;
  readonly head: SquatJoint;
  readonly tremor: number;
  readonly breath: number;
  readonly strain: number;
  readonly commandGlow: number;
  readonly chalk: number;
  readonly plates: readonly LoadedPlate[];
  readonly barKg: number;
  readonly totalKg: number;
  readonly phase: LiftPhase;
  readonly height: number;
  readonly velocity: number;
  readonly cameraY: number;
  readonly particles: readonly SquatChalk[];
}

function hash01(seed: number, salt: number): number {
  const x = Math.sin(seed * V.HASH_A + salt * V.HASH_B) * V.HASH_C;
  return x - Math.floor(x);
}

/**
 * 1 at lockout/standing, 0 in the hole. Driven by the mechanic's height,
 * which squat already keeps as `1 - depth` through descent and as the
 * ascent coordinate after reversal.
 */
export function squatStandFrom(state: LiftState): number {
  return clamp01(state.height);
}

export function squatPoseFrom(state: LiftState, totalKg: number): SquatPose {
  const stand = squatStandFrom(state);
  const sit = 1 - stand;
  const strain = liveStrain(state);
  const grind =
    state.phase === 'ASCENT' && state.velocity >= 0 && state.velocity < V.CAMERA_VEL
      ? 1
      : 0;
  const tremor = clamp01(strain * sit + grind) * V.TREMOR_MAX;
  const wobble = Math.sin(state.tick * V.TREMOR_FREQ);
  const wobbleY = Math.cos(state.tick * V.TREMOR_FREQ);
  const dx = wobble * tremor + state.barLateralPx * V.LATERAL_SCALE;
  const dy = wobbleY * tremor;
  const breath =
    state.phase === 'BRACE'
      ? Math.sin(state.tick * V.BREATH_FREQ) * V.BREATH_AMP
      : 0;
  const cue = cueProgress(state);
  const commandGlow =
    state.held || (cue !== null && cue >= 0 && cue <= 1)
      ? V.GLOW_MIN + (1 - V.GLOW_MIN) * (state.held ? 1 : 1 - Math.abs((cue ?? 0) - 1))
      : state.held
        ? 1
        : 0;

  const mid = V.MID_X + dx;
  const floor = V.FLOOR_Y;
  const barY = V.STAND_BAR_Y + (V.HOLE_BAR_Y - V.STAND_BAR_Y) * sit + dy + breath;
  const hipY = barY + V.TORSO_H * (1 - breath * V.BREATH_TORSO) + V.HIP_DROP * sit;
  const leftFoot = { x: mid - V.STANCE, y: floor };
  const rightFoot = { x: mid + V.STANCE, y: floor };
  const leftKnee = {
    x: mid - V.STANCE - V.KNEE_OUT * sit,
    y: hipY + (floor - hipY) * V.KNEE_ALONG + V.KNEE_DROP * sit,
  };
  const rightKnee = {
    x: mid + V.STANCE + V.KNEE_OUT * sit,
    y: hipY + (floor - hipY) * V.KNEE_ALONG + V.KNEE_DROP * sit,
  };
  const hip = { x: mid, y: hipY };
  const leftShoulder = { x: mid - V.TORSO_W / 2, y: barY + V.BAR_THICK };
  const rightShoulder = { x: mid + V.TORSO_W / 2, y: barY + V.BAR_THICK };
  const head = { x: mid, y: barY - V.HEAD_R * 2 + breath };
  const stack = visualPlateStack(totalKg, BAR_AND_COLLARS_KG);
  const particles: SquatChalk[] = [];
  const puff = clamp01(state.chalkPuff);
  if (puff > 0) {
    for (let i = 0; i < V.CHALK_COUNT; i += 1) {
      const t = hash01(state.config.seed, i + state.tick);
      particles.push({
        x: mid + (t - V.HASH_HALF) * V.STANCE * V.CHALK_SPREAD,
        y: barY - t * sit * V.CHALK_RISE - state.tick * V.CHALK_DRIFT * (i + 1),
        r: V.HEAD_R * (V.CHALK_R_MIN + t * V.CHALK_R_SPAN),
        a: puff * (1 - t) * V.DUST_OPACITY * V.CHALK_A,
      });
    }
  }

  return {
    stand,
    sit,
    bar: { x: mid, y: barY },
    barTiltDeg: state.barTiltDeg,
    barBend: state.barBendPx * V.BEND_SCALE,
    hip,
    leftFoot,
    rightFoot,
    leftKnee,
    rightKnee,
    leftShoulder,
    rightShoulder,
    head,
    tremor,
    breath,
    strain,
    commandGlow: clamp01(commandGlow),
    chalk: puff,
    plates: stack.perSide,
    barKg: BAR_AND_COLLARS_KG,
    totalKg,
    phase: state.phase,
    height: state.height,
    velocity: state.velocity,
    cameraY: -state.velocity * V.CAMERA_VEL,
    particles,
  };
}
