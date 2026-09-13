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
 * PURE. Zero React, zero I/O. Every number is `MEET_LAYOUT` or `IRON_AMBER`.
 */
import { IRON_AMBER } from '../game/sessionTuning';
import { MEET_LAYOUT } from '../game/meetTuning';
import type { LiftKind } from '../game/meet';
import {
  ironAmberCoverRect,
  ironAmberPlateFocus,
  type IronAmberCoverRect,
  type IronAmberFocus,
  type IronAmberPlateId,
} from '../session/ironAmberPlates';
import type { WalkoutStage } from './walkout';

const L = MEET_LAYOUT;

export function ironAmberHallPlateId(
  kind: LiftKind | null,
  stage: WalkoutStage | null,
  empty: boolean,
): IronAmberPlateId {
  if (empty || kind === null) return 'gym-briefing';
  const walking = stage === 'STEP' || stage === 'UNRACK';
  if (kind === 'deadlift') {
    if (stage === 'LOAD') return 'deadlift-floor';
    if (walking) return 'deadlift-knee';
    return 'deadlift-lockout';
  }
  if (kind === 'bench') {
    if (walking) return 'bench-press';
    return 'bench-brace';
  }
  if (walking) return 'squat-drive';
  return 'squat-brace';
}

function kindFromPlate(plateId: Exclude<IronAmberPlateId, 'gym-briefing'>): LiftKind {
  if (plateId.startsWith('bench')) return 'bench';
  if (plateId.startsWith('deadlift')) return 'deadlift';
  return 'squat';
}

function hallFocus(plateId: IronAmberPlateId): IronAmberFocus {
  if (plateId === 'gym-briefing') {
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
  plateId: IronAmberPlateId,
  bodyDxPx: number,
  crowdRisePx: number,
  platesShown: number,
): IronAmberCoverRect {
  const gym = plateId === 'gym-briefing';
  const extraScale =
    (gym ? IRON_AMBER.GYM_SCALE : IRON_AMBER.PLATE_SCALE) +
    crowdRisePx * L.HALL_RISE_ZOOM +
    platesShown * L.HALL_LOAD_ZOOM;
  const focus = hallFocus(plateId);
  const rect = ironAmberCoverRect(
    gym ? IRON_AMBER.GYM_SRC_W : IRON_AMBER.PLATE_SRC_W,
    gym ? IRON_AMBER.GYM_SRC_H : IRON_AMBER.PLATE_SRC_H,
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
