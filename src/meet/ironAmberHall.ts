/**
 * Iron & Amber Meet Day stills — which owned plate the hall shows, and how
 * it is framed.
 *
 * Meet Day used to raster `MeetHallView` through `renderLifterFrame` and
 * `GymSceneLayer`. Closed-beta presentation retires that as the primary
 * picture. The walk-out sheet (`walkout.ts`) still owns timing, pose, and
 * crowd rows; this module maps those channels onto cover-focus stills so
 * urgency and choreography still reach pixels.
 *
 * THE HALL IS A MEET VENUE, NOT THE TRAINING GARAGE. Training plates stay
 * on the daily set. These ids are the packed-platform stills.
 *
 * PURE. Zero React, zero I/O. Every number is `MEET_LAYOUT` or `IRON_AMBER`.
 * Which still is a third-attempt packed bar is `ATTEMPTS_PER_LIFT`, a sport
 * constant, not a feel knob.
 */
import { IRON_AMBER } from '../game/sessionTuning';
import { MEET_LAYOUT } from '../game/meetTuning';
import { ATTEMPTS_PER_LIFT, type AttemptNumber, type LiftKind } from '../game/meet';
import type { LiftPhase } from '../game/lift';
import {
  ironAmberCoverRect,
  ironAmberPlateFocus,
  type IronAmberCoverRect,
  type IronAmberFocus,
} from '../session/ironAmberPlates';
import type { WalkoutStage } from './walkout';

const L = MEET_LAYOUT;

export type MeetHallPlateId =
  | 'meet-empty'
  | 'meet-squat-unrack'
  | 'meet-squat-unrack-third'
  | 'meet-squat-walk'
  | 'meet-squat-walk-third'
  | 'meet-squat-brace'
  | 'meet-squat-brace-third'
  | 'meet-bench'
  | 'meet-deadlift';

/** Press-surface stills. The last squat uses the packed-third brace/walk. */
export type MeetAttemptPlateId =
  | 'meet-squat-walk'
  | 'meet-squat-walk-third'
  | 'meet-squat-brace'
  | 'meet-squat-brace-third'
  | 'meet-bench'
  | 'meet-deadlift';

export const MEET_HALL_PLATE_IDS = Object.freeze([
  'meet-empty',
  'meet-squat-unrack',
  'meet-squat-unrack-third',
  'meet-squat-walk',
  'meet-squat-walk-third',
  'meet-squat-brace',
  'meet-squat-brace-third',
  'meet-bench',
  'meet-deadlift',
] as const satisfies readonly MeetHallPlateId[]);

export const MEET_HALL_PLATE_FILES = Object.freeze({
  'meet-empty': 'meet-empty.jpg',
  'meet-squat-unrack': 'meet-squat-unrack.jpg',
  'meet-squat-unrack-third': 'meet-squat-unrack-third.jpg',
  'meet-squat-walk': 'meet-squat-walk.jpg',
  'meet-squat-walk-third': 'meet-squat-walk-third.jpg',
  'meet-squat-brace': 'meet-squat-brace.jpg',
  'meet-squat-brace-third': 'meet-squat-brace-third.jpg',
  'meet-bench': 'meet-bench.jpg',
  'meet-deadlift': 'meet-deadlift.jpg',
} as const satisfies Record<MeetHallPlateId, string>);

export function ironAmberHallPlateId(
  kind: LiftKind | null,
  stage: WalkoutStage | null,
  empty: boolean,
  attemptNumber: AttemptNumber | null,
): MeetHallPlateId {
  if (empty || kind === null) return 'meet-empty';
  const third = attemptNumber === ATTEMPTS_PER_LIFT;
  if (kind === 'deadlift') {
    if (stage === 'LOAD') return 'meet-empty';
    return 'meet-deadlift';
  }
  if (kind === 'bench') {
    return 'meet-bench';
  }
  if (stage === 'UNRACK') return third ? 'meet-squat-unrack-third' : 'meet-squat-unrack';
  if (stage === 'STEP') return third ? 'meet-squat-walk-third' : 'meet-squat-walk';
  return third ? 'meet-squat-brace-third' : 'meet-squat-brace';
}

/**
 * The still behind a meet *attempt* (the press surface), as opposed to the
 * walk-out hall. One plate per lift: the hall is the venue, not a garage
 * pose ladder. The last squat uses the packed-third still so the press
 * surface matches the walk-out that just ran.
 */
export function meetAttemptPlateId(
  kind: LiftKind,
  phase: LiftPhase,
  attemptNumber: AttemptNumber | null,
): MeetAttemptPlateId {
  if (kind === 'deadlift') return 'meet-deadlift';
  if (kind === 'bench') return 'meet-bench';
  const third = attemptNumber === ATTEMPTS_PER_LIFT;
  if (phase === 'ASCENT' || phase === 'LOCKOUT') {
    return third ? 'meet-squat-walk-third' : 'meet-squat-walk';
  }
  return third ? 'meet-squat-brace-third' : 'meet-squat-brace';
}

function kindFromPlate(plateId: Exclude<MeetHallPlateId, 'meet-empty'>): LiftKind {
  if (plateId === 'meet-bench') return 'bench';
  if (plateId === 'meet-deadlift') return 'deadlift';
  return 'squat';
}

function hallFocus(plateId: MeetHallPlateId): IronAmberFocus {
  if (plateId === 'meet-empty') {
    return { x: IRON_AMBER.GYM_FOCUS_X, y: IRON_AMBER.GYM_FOCUS_Y };
  }
  return ironAmberPlateFocus(kindFromPlate(plateId));
}

/**
 * Cover-focus for the hall plate, panned by the walk-out's bodyDxPx and
 * zoomed by crowd rise and plates landed. Clamped so a pan cannot open a gap.
 */
export function ironAmberHallLayout(
  boxW: number,
  boxH: number,
  plateId: MeetHallPlateId,
  bodyDxPx: number,
  crowdRisePx: number,
  platesShown: number,
): IronAmberCoverRect {
  const emptyHall = plateId === 'meet-empty';
  const extraScale =
    (emptyHall ? IRON_AMBER.GYM_SCALE : IRON_AMBER.PLATE_SCALE) +
    crowdRisePx * L.HALL_RISE_ZOOM +
    platesShown * L.HALL_LOAD_ZOOM;
  const focus = hallFocus(plateId);
  const rect = ironAmberCoverRect(
    emptyHall ? IRON_AMBER.GYM_SRC_W : IRON_AMBER.PLATE_SRC_W,
    emptyHall ? IRON_AMBER.GYM_SRC_H : IRON_AMBER.PLATE_SRC_H,
    boxW,
    boxH,
    focus.x,
    focus.y,
    extraScale,
  );
  const pan = bodyDxPx * L.HALL_WALK_SHIFT;
  const minLeft = boxW - rect.width;
  const left = Math.min(0, Math.max(minLeft, rect.left + pan));
  return { width: rect.width, height: rect.height, left, top: rect.top };
}
