/**
 * floorCamera.test.ts — the Play world's ground-plane projection.
 *
 * TECHNICAL PASS only. These checks prove the projection's law (1/depth
 * scaling, monotone rows, the cover fit, the fit-to-stage fallback) and that
 * the plan view is the identity. They do not prove the scene LOOKS coherent —
 * that is a human's read of the captured evidence, never this file's.
 */

import { describe, expect, it } from 'vitest';

import { EMPIRE_TUNING } from './empireTuning';
import {
  type FloorCamera,
  floorDepthScale,
  floorFrontY,
  floorTileWidthAt,
  orthographicFloorCamera,
  perspectiveFloorCamera,
  projectFloorPoint,
  sceneCoverFit,
  sceneFloorSeamY,
} from './floorCamera';

const PHONE_STAGES = Object.freeze([
  // The two viewports the evidence tools run at, minus the 72 px HUD the
  // gym screen draws above the stage (measured in the browser at both).
  Object.freeze({ width: 390, height: 625 }),
  Object.freeze({ width: 375, height: 593 }),
]);
const GARAGE = EMPIRE_TUNING.FLOOR_GRID_SIZE.garage;
const RUNGS = Object.keys(EMPIRE_TUNING.FLOOR_SCENE_FLOOR_SEAM_FRACTION) as (keyof typeof EMPIRE_TUNING.FLOOR_SCENE_FLOOR_SEAM_FRACTION)[];

describe('sceneCoverFit', () => {
  it('scales the painting to fill both axes and centre-crops the overflow', () => {
    let checked = 0;
    for (const stage of PHONE_STAGES) {
      const fit = sceneCoverFit(stage, EMPIRE_TUNING.FLOOR_SCENE_ART_ASPECT);
      // A portrait phone stage is squarer than the 1008×1792 painting, so the
      // painting fills the width and overflows the height.
      expect(fit.drawnWidth).toBeCloseTo(stage.width, 6);
      expect(fit.drawnHeight).toBeGreaterThan(stage.height);
      expect(fit.offsetX).toBeCloseTo(0, 6);
      expect(fit.offsetY).toBeLessThan(0);
      expect(fit.offsetY * 2 + fit.drawnHeight).toBeCloseTo(stage.height, 6);
      checked += 1;
    }
    expect(checked).toBe(PHONE_STAGES.length);
  });

  it('fills the height instead when the stage is taller than the painting', () => {
    const tall = { width: 200, height: 1000 };
    const fit = sceneCoverFit(tall, EMPIRE_TUNING.FLOOR_SCENE_ART_ASPECT);
    expect(fit.drawnHeight).toBeCloseTo(tall.height, 6);
    expect(fit.drawnWidth).toBeGreaterThan(tall.width);
    expect(fit.offsetY).toBeCloseTo(0, 6);
    expect(fit.offsetX).toBeLessThan(0);
  });

  it('places the wall seam inside the stage for every rung at every phone stage', () => {
    let checked = 0;
    for (const stage of PHONE_STAGES) {
      for (const rung of RUNGS) {
        const seamY = sceneFloorSeamY(stage, rung);
        expect(seamY).toBeGreaterThan(0);
        expect(seamY).toBeLessThan(stage.height);
        // The seam is in the lower half of every painting, and the cover
        // crop is symmetric, so it lands in the lower half of the stage too.
        expect(seamY).toBeGreaterThan(stage.height / 2);
        checked += 1;
      }
    }
    expect(checked).toBe(PHONE_STAGES.length * RUNGS.length);
  });
});

describe('perspectiveFloorCamera', () => {
  it('scales the back row by FLOOR_CAMERA_BACK_SCALE and the front row by 1, monotonically between', () => {
    const camera = perspectiveFloorCamera(PHONE_STAGES[0] as { width: number; height: number }, GARAGE, 'garage');
    expect(floorDepthScale(camera, 0)).toBeCloseTo(EMPIRE_TUNING.FLOOR_CAMERA_BACK_SCALE, 9);
    expect(floorDepthScale(camera, GARAGE.height)).toBeCloseTo(1, 9);
    let previous = floorDepthScale(camera, 0);
    let steps = 0;
    for (let row = 1; row <= GARAGE.height * 4; row += 1) {
      const next = floorDepthScale(camera, row / 4);
      expect(next).toBeGreaterThan(previous);
      previous = next;
      steps += 1;
    }
    expect(steps).toBe(GARAGE.height * 4);
  });

  it('follows the 1/depth law: the reciprocal of the scale is linear in the row', () => {
    const camera = perspectiveFloorCamera(PHONE_STAGES[0] as { width: number; height: number }, GARAGE, 'garage');
    const atBack = 1 / floorDepthScale(camera, 0);
    const atFront = 1 / floorDepthScale(camera, GARAGE.height);
    let checked = 0;
    for (let row = 0; row <= GARAGE.height; row += 1) {
      const t = row / GARAGE.height;
      expect(1 / floorDepthScale(camera, row)).toBeCloseTo(atBack + (atFront - atBack) * t, 9);
      checked += 1;
    }
    expect(checked).toBe(GARAGE.height + 1);
  });

  it('stands the back row just in front of the painted seam and gives the front row its depth fraction', () => {
    for (const stage of PHONE_STAGES) {
      const camera = perspectiveFloorCamera(stage, GARAGE, 'garage');
      expect(camera.backY).toBeCloseTo(
        sceneFloorSeamY(stage, 'garage') + EMPIRE_TUNING.FLOOR_CAMERA_BACK_INSET_PIXELS,
        9,
      );
      expect(projectFloorPoint(camera, { x: 0, y: 0 }).y).toBeCloseTo(camera.backY, 9);
      const frontRowTop = projectFloorPoint(camera, { x: 0, y: GARAGE.height - 1 }).y;
      const frontRowBottom = projectFloorPoint(camera, { x: 0, y: GARAGE.height }).y;
      if (!camera.fitted) {
        expect(frontRowBottom - frontRowTop).toBeCloseTo(
          EMPIRE_TUNING.FLOOR_CAMERA_ROW_DEPTH_FRACTION * camera.tile,
          6,
        );
      }
      // Rows get taller toward the front — the same law as the widths.
      let previousHeight = 0;
      for (let row = 0; row < GARAGE.height; row += 1) {
        const height =
          projectFloorPoint(camera, { x: 0, y: row + 1 }).y - projectFloorPoint(camera, { x: 0, y: row }).y;
        expect(height).toBeGreaterThan(previousHeight);
        previousHeight = height;
      }
      expect(floorFrontY(camera)).toBeCloseTo(camera.backY + camera.depth, 9);
    }
  });

  it('spans the stage width on the front row and narrows toward the back, centred', () => {
    for (const stage of PHONE_STAGES) {
      const camera = perspectiveFloorCamera(stage, GARAGE, 'garage');
      const frontLeft = projectFloorPoint(camera, { x: 0, y: GARAGE.height });
      const frontRight = projectFloorPoint(camera, { x: GARAGE.width, y: GARAGE.height });
      const backLeft = projectFloorPoint(camera, { x: 0, y: 0 });
      const backRight = projectFloorPoint(camera, { x: GARAGE.width, y: 0 });
      expect(frontRight.x - frontLeft.x).toBeCloseTo(camera.tile * GARAGE.width, 6);
      expect(backRight.x - backLeft.x).toBeCloseTo(
        camera.tile * GARAGE.width * EMPIRE_TUNING.FLOOR_CAMERA_BACK_SCALE,
        6,
      );
      expect((frontLeft.x + frontRight.x) / 2).toBeCloseTo(stage.width / 2, 6);
      expect((backLeft.x + backRight.x) / 2).toBeCloseTo(stage.width / 2, 6);
      if (!camera.fitted) {
        expect(frontLeft.x).toBeCloseTo(EMPIRE_TUNING.FLOOR_STAGE_PADDING_PIXELS, 6);
      }
      expect(floorTileWidthAt(camera, GARAGE.height)).toBeCloseTo(camera.tile, 9);
      expect(floorTileWidthAt(camera, 0)).toBeCloseTo(camera.tile * EMPIRE_TUNING.FLOOR_CAMERA_BACK_SCALE, 9);
    }
  });

  it('keeps the whole band above the bottom inset at both phone stages, shrinking the tile only when it must', () => {
    for (const stage of PHONE_STAGES) {
      const camera = perspectiveFloorCamera(stage, GARAGE, 'garage');
      expect(floorFrontY(camera)).toBeLessThanOrEqual(
        stage.height - EMPIRE_TUNING.FLOOR_CAMERA_FRONT_INSET_PIXELS + 1e-6,
      );
      expect(camera.tile).toBeGreaterThan(1);
    }
    // A stage too short for the band: the tile shrinks so the front row still
    // clears the inset, and the camera says it did.
    const short = { width: 390, height: 420 };
    const fitted = perspectiveFloorCamera(short, GARAGE, 'garage');
    expect(fitted.fitted).toBe(true);
    expect(floorFrontY(fitted)).toBeCloseTo(short.height - EMPIRE_TUNING.FLOOR_CAMERA_FRONT_INSET_PIXELS, 6);
    const roomy = perspectiveFloorCamera({ width: 390, height: 900 }, GARAGE, 'garage');
    expect(roomy.fitted).toBe(false);
    expect(fitted.tile).toBeLessThan(roomy.tile);
  });

  it('projects a fractional row between its neighbours, so a walking member never jumps rows', () => {
    const camera = perspectiveFloorCamera(PHONE_STAGES[0] as { width: number; height: number }, GARAGE, 'garage');
    let checked = 0;
    for (let row = 0; row < GARAGE.height; row += 1) {
      const above = projectFloorPoint(camera, { x: 3, y: row });
      const mid = projectFloorPoint(camera, { x: 3, y: row + 1 / 2 });
      const below = projectFloorPoint(camera, { x: 3, y: row + 1 });
      expect(mid.y).toBeGreaterThan(above.y);
      expect(mid.y).toBeLessThan(below.y);
      expect(mid.scale).toBeGreaterThan(above.scale);
      expect(mid.scale).toBeLessThan(below.scale);
      checked += 1;
    }
    expect(checked).toBe(GARAGE.height);
  });
});

describe('orthographicFloorCamera', () => {
  it('is the identity at one tile size, scale 1 everywhere', () => {
    const tile = EMPIRE_TUNING.FLOOR_TILE_PIXELS;
    const camera: FloorCamera = orthographicFloorCamera(GARAGE, tile);
    let checked = 0;
    for (let y = 0; y <= GARAGE.height; y += 1) {
      for (let x = 0; x <= GARAGE.width; x += 1) {
        const projected = projectFloorPoint(camera, { x, y });
        expect(projected).toEqual({ x: x * tile, y: y * tile, scale: 1 });
        checked += 1;
      }
    }
    expect(checked).toBe((GARAGE.width + 1) * (GARAGE.height + 1));
    expect(floorDepthScale(camera, GARAGE.height / 2)).toBe(1);
    expect(floorTileWidthAt(camera, 0)).toBe(tile);
    expect(floorFrontY(camera)).toBe(GARAGE.height * tile);
  });
});
