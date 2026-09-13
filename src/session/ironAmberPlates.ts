/**
 * Iron & Amber training plates — which owned still a live training rep shows.
 *
 * Session A presentation — training and Meet Day stills. Heights come from
 * `IRON_AMBER` in sessionTuning; this file does not retune the lift mechanic.
 * `src/lift/LiftStage.tsx` stays the A0 sprite harness.
 */
import { IRON_AMBER } from '../game/sessionTuning';
import { MEET_LAYOUT } from '../game/meetTuning';
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

export type IronAmberCoverRect = {
  readonly width: number;
  readonly height: number;
  readonly left: number;
  readonly top: number;
};

export type IronAmberFocus = {
  readonly x: number;
  readonly y: number;
};

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

export function ironAmberPlateFocus(kind: LiftKind): IronAmberFocus {
  if (kind === 'deadlift') {
    return { x: IRON_AMBER.DEADLIFT_FOCUS_X, y: IRON_AMBER.DEADLIFT_FOCUS_Y };
  }
  if (kind === 'bench') {
    return { x: IRON_AMBER.BENCH_FOCUS_X, y: IRON_AMBER.BENCH_FOCUS_Y };
  }
  return { x: IRON_AMBER.SQUAT_FOCUS_X, y: IRON_AMBER.SQUAT_FOCUS_Y };
}

/**
 * object-fit: cover with object-position, in layout pixels.
 *
 * A pan is clamped so the still always covers the box. Without the clamp,
 * FOCUS_Y on a height-fitted plate opens a gap at the opposite edge.
 */
export function ironAmberCoverRect(
  srcW: number,
  srcH: number,
  boxW: number,
  boxH: number,
  focusX: number,
  focusY: number,
  scale: number,
): IronAmberCoverRect {
  if (boxW <= 0 || boxH <= 0 || srcW <= 0 || srcH <= 0 || scale <= 0) {
    return { width: 0, height: 0, left: 0, top: 0 };
  }
  const cover = Math.max(boxW / srcW, boxH / srcH) * scale;
  const width = srcW * cover;
  const height = srcH * cover;
  const minLeft = boxW - width;
  const minTop = boxH - height;
  const left = Math.min(0, Math.max(minLeft, boxW / 2 - width * focusX));
  const top = Math.min(0, Math.max(minTop, boxH / 2 - height * focusY));
  return { width, height, left, top };
}

export function ironAmberPlateLayout(
  kind: LiftKind,
  boxW: number,
  boxH: number,
  crowdRisePx = 0,
): IronAmberCoverRect {
  const focus = ironAmberPlateFocus(kind);
  return ironAmberCoverRect(
    IRON_AMBER.PLATE_SRC_W,
    IRON_AMBER.PLATE_SRC_H,
    boxW,
    boxH,
    focus.x,
    focus.y,
    IRON_AMBER.PLATE_SCALE + crowdRisePx * MEET_LAYOUT.HALL_RISE_ZOOM,
  );
}

export function ironAmberGymLayout(boxW: number, boxH: number): IronAmberCoverRect {
  return ironAmberCoverRect(
    IRON_AMBER.GYM_SRC_W,
    IRON_AMBER.GYM_SRC_H,
    boxW,
    boxH,
    IRON_AMBER.GYM_FOCUS_X,
    IRON_AMBER.GYM_FOCUS_Y,
    IRON_AMBER.GYM_SCALE,
  );
}
