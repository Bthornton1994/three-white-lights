/**
 * floorCamera.ts — one ground-plane projection for the Play world.
 *
 * Pure module (CLAUDE.md, "Pure logic is separate from UI"): zero React, zero
 * side effects, zero I/O, no clock, no dice, no pixels drawn. Its one import
 * is `./empireTuning`, for the scene and camera knobs. Claude Code Session B
 * owns it (CLAUDE.md "Crossing VL-2"): its whole subject is how the sim's
 * tile grid is DRAWN onto the painted facility scene. It holds no economic,
 * queue, placement or member-decision truth — a tile point goes in, a screen
 * point and a depth scale come out, and nothing about which tile a member is
 * on is decided here.
 *
 * WHY THIS FILE EXISTS. VL-1 drew an orthographic 8×6 grid — every tile the
 * same size, every member the same size — centred vertically on a stage whose
 * background is a three-quarter-view painting of a room. The grid landed
 * halfway up the back wall; a member walking "up" the room did not shrink; the
 * bench was a painting stretched into a footprint box. That was the "coherent
 * scene problem" the VL-2 brief names, and it is one problem, not several
 * style patches: the world needs ONE mapping from tile space to screen space
 * that agrees with the painting's floor, and every drawn thing — members,
 * stations, shadows, queue cells, tap targets — has to go through it.
 *
 * THE MODEL. A pinhole camera looking at a ground plane scales a thing by
 * 1/depth, and the sim's rows are equally spaced in depth. So with the back
 * row at scale `FLOOR_CAMERA_BACK_SCALE` and the front row at scale 1, the
 * scale at row fraction t is
 *
 *     scale(t) = 1 / ((1 - t) / backScale + t)
 *
 * (1/scale linear in t), and the screen y of a row is linear in its SCALE,
 * because a pinhole's vertical image coordinate is proportional to 1/depth
 * too. Screen x is the tile's horizontal offset from the grid's centre line
 * scaled by the same factor. That is the entire projection; there is no
 * hand-placed trapezoid and no per-row table.
 *
 * WHERE THE FLOOR IS. `GymScreen.tsx` draws the scene painting with `cover`
 * fit — scaled to fill the stage, centre-cropped — and the painted floor
 * meets the back wall at `FLOOR_SCENE_FLOOR_SEAM_FRACTION[rung]` of the
 * painting's height. `sceneCoverFit` reproduces that fit from the stage size
 * and `FLOOR_SCENE_ART_ASPECT`, so the wall seam's screen y is derived, not
 * eyeballed per viewport. The back row's feet stand `FLOOR_CAMERA_BACK_INSET_
 * PIXELS` in front of that seam; the front row's height is
 * `FLOOR_CAMERA_ROW_DEPTH_FRACTION` of the front tile's width and the band the
 * grid occupies follows from that and the back scale. If the band would run
 * past the stage's bottom inset, the TILE shrinks to fit rather than the grid
 * spilling under the caption.
 *
 * BUILD IS THE ORTHOGRAPHIC PLAN, THROUGH THE SAME FUNCTION. Build draws the
 * top-down floor plane and placement grid; `orthographicFloorCamera` is the
 * identity projection at one tile size, and `projectFloorPoint` handles both
 * kinds, so `FloorGrid.tsx` positions everything through one call whichever
 * surface it is on.
 *
 * WHAT IT DOES NOT DO. It does not decide a member's cell, a station's
 * position, a queue cell or a placement's legality — those are read from
 * Grok-owned modules and projected here. It does not read a clock, so the
 * smoothing of a member between two sim positions is `memberAnimation.ts`'s
 * and `FloorGrid.tsx`'s business, not this file's.
 */

import { EMPIRE_TUNING } from './empireTuning';

/** A point in tile space — structurally the same shape as `floor.ts`'s `GridPosition`, kept local so this module imports one thing. */
export interface FloorCameraPoint {
  readonly x: number;
  readonly y: number;
}

/** A width and height in tiles or pixels — structurally `floor.ts`'s `GridSize`. */
export interface FloorCameraSize {
  readonly width: number;
  readonly height: number;
}

/** A rung the scene table knows; the seam fraction is keyed by exactly this. */
export type FloorSceneRung = keyof typeof EMPIRE_TUNING.FLOOR_SCENE_FLOOR_SEAM_FRACTION;

/**
 * How the scene painting lands on a stage under `cover` fit: the uniform
 * scale, the drawn size, and the (non-positive) offsets of the painting's
 * top-left corner relative to the stage's.
 */
export interface SceneCoverFit {
  readonly scale: number;
  readonly drawnWidth: number;
  readonly drawnHeight: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

/** The identity projection Build draws through: tile space times one tile size. */
export interface OrthographicFloorCamera {
  readonly kind: 'orthographic';
  readonly grid: FloorCameraSize;
  readonly tile: number;
}

/** The Play projection: a pinhole ground plane fitted to the painted floor band. */
export interface PerspectiveFloorCamera {
  readonly kind: 'perspective';
  readonly grid: FloorCameraSize;
  /** Front-row tile width in stage pixels. */
  readonly tile: number;
  /** Screen y of the back edge of row 0, in stage pixels. */
  readonly backY: number;
  /** Screen distance from the back edge of row 0 to the front edge of the last row. */
  readonly depth: number;
  /** Depth scale at the back edge; the front edge is 1. */
  readonly backScale: number;
  /** Screen x of the grid's centre line. */
  readonly centerX: number;
  /** Screen y of the painted wall seam this camera was fitted against. */
  readonly seamY: number;
  /** Whether the tile had to shrink so the front row cleared the bottom inset. */
  readonly fitted: boolean;
}

export type FloorCamera = OrthographicFloorCamera | PerspectiveFloorCamera;

/** A projected tile point: stage pixels and the depth scale at that point. */
export interface FloorProjection {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

/**
 * The `cover` fit of a painting of `art` aspect into `stage`: scaled by the
 * larger of the two ratios so it fills both axes, then centred, so the
 * overflow on the longer axis is cropped equally at both ends. This is the
 * fit react-native's `resizeMode: 'cover'` performs; reproducing it here is
 * what lets a fraction of the painting be turned into a stage pixel.
 */
export function sceneCoverFit(stage: FloorCameraSize, art: FloorCameraSize): SceneCoverFit {
  const byWidth = stage.width / art.width;
  const byHeight = stage.height / art.height;
  const scale = Math.max(byWidth, byHeight);
  const drawnWidth = art.width * scale;
  const drawnHeight = art.height * scale;
  return Object.freeze({
    scale,
    drawnWidth,
    drawnHeight,
    offsetX: (stage.width - drawnWidth) / 2,
    offsetY: (stage.height - drawnHeight) / 2,
  });
}

/** Stage y, in pixels, of the painted wall-to-floor seam for `rung` on a stage of this size. */
export function sceneFloorSeamY(stage: FloorCameraSize, rung: FloorSceneRung): number {
  const fit = sceneCoverFit(stage, EMPIRE_TUNING.FLOOR_SCENE_ART_ASPECT);
  return fit.offsetY + fit.drawnHeight * EMPIRE_TUNING.FLOOR_SCENE_FLOOR_SEAM_FRACTION[rung];
}

/** Build's plan view: every tile `tile` pixels square, row 0 at the top. */
export function orthographicFloorCamera(grid: FloorCameraSize, tile: number): OrthographicFloorCamera {
  return Object.freeze({ kind: 'orthographic', grid, tile });
}

/**
 * The 1/depth scale at row fraction `t` (0 at the back edge of row 0, 1 at
 * the front edge of the last row) for a plane whose back edge is at
 * `backScale` and whose front edge is at 1. Linear in 1/scale, which is what
 * equal world spacing under a pinhole camera gives.
 */
function depthScaleAt(backScale: number, t: number): number {
  return 1 / ((1 - t) / backScale + t);
}

/**
 * Fit the Play camera to a stage: the grid's front row spans the stage width
 * inside `FLOOR_STAGE_PADDING_PIXELS`, the back row stands just in front of
 * the painted wall seam, and the depth of the band follows from the front
 * row's height fraction and the back scale. When that band would run past
 * the bottom inset, the tile is scaled down so it fits exactly — `fitted`
 * says so, and the evidence tools read it.
 */
export function perspectiveFloorCamera(
  stage: FloorCameraSize,
  grid: FloorCameraSize,
  rung: FloorSceneRung,
): PerspectiveFloorCamera {
  const backScale = EMPIRE_TUNING.FLOOR_CAMERA_BACK_SCALE;
  const pad = EMPIRE_TUNING.FLOOR_STAGE_PADDING_PIXELS;
  const seamY = sceneFloorSeamY(stage, rung);
  const backY = seamY + EMPIRE_TUNING.FLOOR_CAMERA_BACK_INSET_PIXELS;
  const rows = Math.max(grid.height, 1);
  const columns = Math.max(grid.width, 1);
  // The front row's share of the (scale - backScale) span: scale(1) is 1 and
  // scale(1 - 1/rows) is the row above it.
  const frontRowShare = (1 - depthScaleAt(backScale, 1 - 1 / rows)) / (1 - backScale);
  let tile = Math.max((stage.width - pad * 2) / columns, 1);
  let depth = (EMPIRE_TUNING.FLOOR_CAMERA_ROW_DEPTH_FRACTION * tile) / frontRowShare;
  const available = stage.height - EMPIRE_TUNING.FLOOR_CAMERA_FRONT_INSET_PIXELS - backY;
  let fitted = false;
  if (depth > available && available > 0) {
    tile = Math.max((tile * available) / depth, 1);
    depth = available;
    fitted = true;
  }
  return Object.freeze({
    kind: 'perspective',
    grid,
    tile,
    backY,
    depth,
    backScale,
    centerX: stage.width / 2,
    seamY,
    fitted,
  });
}

/** The depth scale at tile row `y` (fractional rows allowed): 1 on the front edge, `backScale` on the back edge, 1 everywhere under the plan view. */
export function floorDepthScale(camera: FloorCamera, y: number): number {
  if (camera.kind === 'orthographic') return 1;
  const t = y / Math.max(camera.grid.height, 1);
  return depthScaleAt(camera.backScale, t);
}

/**
 * Tile space to stage pixels. Under the plan view this is the tile size
 * times the coordinate. Under the Play camera the point's row fixes its
 * depth scale, its screen y is linear in that scale across the band, and its
 * screen x is its offset from the grid's centre line scaled by the same
 * factor — so a tile on the back row is narrower and higher than the same
 * tile on the front row, by the one law above.
 */
export function projectFloorPoint(camera: FloorCamera, point: FloorCameraPoint): FloorProjection {
  if (camera.kind === 'orthographic') {
    return Object.freeze({ x: point.x * camera.tile, y: point.y * camera.tile, scale: 1 });
  }
  const scale = floorDepthScale(camera, point.y);
  const y = camera.backY + (camera.depth * (scale - camera.backScale)) / (1 - camera.backScale);
  const x = camera.centerX + (point.x - camera.grid.width / 2) * camera.tile * scale;
  return Object.freeze({ x, y, scale });
}

/**
 * VL-3: the three numbers that turn a DRAWN stage y back into a depth scale
 * — the Play camera's band read the other way round. `projectFloorPoint`
 * makes screen y linear in scale across the band (`backY` at `backScale`,
 * `backY + span` at 1), so the inverse is one linear map and needs nothing
 * else of the camera. Plain numbers on purpose: `AmbientMemberBody`'s prop
 * surface is pinned to hold no callable, so the body takes these three and
 * inverts them itself rather than taking a function or the camera object.
 * Under the plan view `span` is 0, which `depthScaleFromStageY` reads as
 * "scale 1 everywhere".
 */
export interface FloorDepthFrame {
  readonly backY: number;
  readonly span: number;
  readonly backScale: number;
}

/** The depth frame of a camera: the band's back edge, its screen depth and its back scale; `{0, 0, 1}` under the plan view. */
export function floorDepthFrame(camera: FloorCamera): FloorDepthFrame {
  if (camera.kind === 'orthographic') return Object.freeze({ backY: 0, span: 0, backScale: 1 });
  return Object.freeze({ backY: camera.backY, span: camera.depth, backScale: camera.backScale });
}

/**
 * The depth scale at stage y `y`: the exact inverse of `projectFloorPoint`'s
 * y for a point inside the band (pinned by test to round-trip every row),
 * clamped to [`backScale`, 1] outside it — a body drawn over a bench's art
 * can sit a little above the band's back edge and must not grow past the
 * back row's size, nor shrink under the front row's below the front edge.
 * A degenerate frame (no span, a non-finite y) is scale 1.
 */
export function depthScaleFromStageY(frame: FloorDepthFrame, y: number): number {
  if (!(frame.span > 0) || !Number.isFinite(y)) return 1;
  const low = Math.min(frame.backScale, 1);
  const scale = frame.backScale + ((y - frame.backY) * (1 - frame.backScale)) / frame.span;
  if (!Number.isFinite(scale)) return 1;
  return scale < low ? low : scale > 1 ? 1 : scale;
}

/** The screen width, in pixels, of one tile at row `y`. */
export function floorTileWidthAt(camera: FloorCamera, y: number): number {
  return camera.tile * floorDepthScale(camera, y);
}

/**
 * Stage y of the front edge of the last row — where the front row's feet
 * stand. Under the plan view that is the grid's bottom edge.
 */
export function floorFrontY(camera: FloorCamera): number {
  return projectFloorPoint(camera, { x: 0, y: camera.grid.height }).y;
}
