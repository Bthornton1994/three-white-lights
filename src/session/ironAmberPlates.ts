/**
 * Iron & Amber training plates — which owned still a live training rep shows.
 *
 * Session A training path only. Meet Day keeps the sprite stage in `src/lift`.
 * Heights come from `IRON_AMBER` in sessionTuning; this file does not retune
 * the lift mechanic.
 */
import { IRON_AMBER } from '../game/sessionTuning';
import type { LiftKind } from '../game/meet';
import type { LiftPhase } from '../game/lift';

export type IronAmberPlateId =
  | 'gym-briefing'
  | 'squat-brace'
  | 'squat-hole'
  | 'squat-drive'
  | 'bench-brace'
  | 'bench-chest'
  | 'bench-press'
  | 'deadlift-floor'
  | 'deadlift-knee'
  | 'deadlift-lockout';

export const IRON_AMBER_PLATE_IDS = Object.freeze([
  'gym-briefing',
  'squat-brace',
  'squat-hole',
  'squat-drive',
  'bench-brace',
  'bench-chest',
  'bench-press',
  'deadlift-floor',
  'deadlift-knee',
  'deadlift-lockout',
] as const satisfies readonly IronAmberPlateId[]);

export const IRON_AMBER_PLATE_FILES = Object.freeze({
  'gym-briefing': 'gym-briefing.jpg',
  'squat-brace': 'squat-brace.jpg',
  'squat-hole': 'squat-hole.jpg',
  'squat-drive': 'squat-drive.jpg',
  'bench-brace': 'bench-brace.jpg',
  'bench-chest': 'bench-chest.jpg',
  'bench-press': 'bench-press.jpg',
  'deadlift-floor': 'deadlift-floor.jpg',
  'deadlift-knee': 'deadlift-knee.jpg',
  'deadlift-lockout': 'deadlift-lockout.jpg',
} as const satisfies Record<IronAmberPlateId, string>);

export function ironAmberPlateFor(
  kind: LiftKind,
  phase: LiftPhase,
  height: number,
): Exclude<IronAmberPlateId, 'gym-briefing'> {
  if (kind === 'deadlift') {
    if (phase === 'BRACE' || height <= IRON_AMBER.DEADLIFT_FLOOR_MAX) {
      return 'deadlift-floor';
    }
    if (phase === 'LOCKOUT' || phase === 'RESOLVED' || height >= IRON_AMBER.DEADLIFT_LOCKOUT_MIN) {
      return 'deadlift-lockout';
    }
    return 'deadlift-knee';
  }
  if (kind === 'bench') {
    if (phase === 'HOLE' || height <= IRON_AMBER.BENCH_CHEST_MAX) {
      return 'bench-chest';
    }
    if (phase === 'ASCENT' || phase === 'LOCKOUT') {
      return 'bench-press';
    }
    return 'bench-brace';
  }
  if (phase === 'HOLE' || height <= IRON_AMBER.SQUAT_HOLE_MAX) {
    return 'squat-hole';
  }
  if (phase === 'ASCENT') {
    return 'squat-drive';
  }
  return 'squat-brace';
}
