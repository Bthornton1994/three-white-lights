/**
 * Tests for the side-on conventional deadlift drawing.
 *
 * NOTHING BELOW ASSERTS THAT THE DRAWING LOOKS GOOD. It cannot. What it
 * asserts is the much weaker set of properties a retune could break without
 * breaking anything that looks related:
 *
 *   - the cell is the committed 96×72
 *   - the figure is a pull, not a squat and not a bench
 *   - the bar leaves the floor (lockout y is above floor y)
 *   - the hands are on the bar that is actually drawn
 *   - arm and leg bones keep their authored lengths
 *   - setup hips are high (a hinge, not a squat hole)
 */

import { describe, expect, it } from 'vitest';

import { DEADLIFT_PULL, RESOLUTION, STRAIN } from './spriteTuning';
import { BANK_SIZE, isTransparentIndex, PAL, RAMPS } from './palette';
import { getPx, type IndexGrid } from './raster';
import { findUnallocatedIndices, usedIndices } from './rgba';
import { renderLifterFrame, type LifterFrameSpec } from './lifterSprite';
import { DEADLIFT_GEOMETRY, deadliftBarY, renderDeadliftFrame } from './deadliftPull';

const BASE: LifterFrameSpec = {
  kind: 'deadlift',
  depth: 1,
  height: 0,
  direction: 'ASCENT',
  strainLevel: 0,
  pitchLevel: 0,
  barLateralPx: 0,
  barTiltDeg: 0,
  barBendPx: 0,
  chalkMotes: 0,
  totalKg: 220,
};

const spec = (over: Partial<LifterFrameSpec> = {}): LifterFrameSpec => ({ ...BASE, ...over });

function coverage(grid: IndexGrid): number {
  let lit = 0;
  for (let i = 0; i < grid.data.length; i += 1) {
    if (!isTransparentIndex(grid.data[i] ?? 0)) lit += 1;
  }
  return lit / grid.data.length;
}

function gridsEqual(a: IndexGrid, b: IndexGrid): boolean {
  if (a.w !== b.w || a.h !== b.h) return false;
  for (let i = 0; i < a.data.length; i += 1) if (a.data[i] !== b.data[i]) return false;
  return true;
}

const { ARM, BAR, FIGURE, LEG } = DEADLIFT_GEOMETRY;

const SKIN_INDICES: ReadonlySet<number> = new Set<number>([
  ...RAMPS.SKIN,
  ...RAMPS.SKIN_FLUSHED,
  PAL.SKIN_SHADOW,
]);

function skinInHandDisc(
  grid: IndexGrid,
  cx: number,
  cy: number,
): { readonly lit: number; readonly total: number } {
  const r = FIGURE.HAND_R;
  let lit = 0;
  let total = 0;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y += 1) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
      total += 1;
      if (SKIN_INDICES.has(getPx(grid, x, y))) lit += 1;
    }
  }
  return { lit, total };
}

describe('deadlift pull drawing', () => {
  it('renders at the committed internal resolution', () => {
    const { grid } = renderDeadliftFrame(spec());
    expect(grid.w).toBe(RESOLUTION.CELL_W);
    expect(grid.h).toBe(RESOLUTION.CELL_H);
    expect(grid.w % 8).toBe(0);
    expect(grid.h % 8).toBe(0);
  });

  it('never references an unallocated palette index', () => {
    for (const height of [0, 0.5, 1]) {
      for (const kg of [25, 180, 260]) {
        const { grid } = renderDeadliftFrame(spec({ height, depth: 1 - height, totalKg: kg }));
        expect(findUnallocatedIndices(grid), `height ${height} kg ${kg}`).toEqual([]);
      }
    }
  });

  it('keeps the character out of the STAGE bank entirely', () => {
    const { grid } = renderDeadliftFrame(spec({ strainLevel: STRAIN.LEVELS - 1, height: 1, depth: 0 }));
    for (const index of usedIndices(grid)) {
      expect(Math.floor(index / BANK_SIZE), `index ${index}`).toBeLessThan(2);
    }
  });

  it('draws something substantial but does not fill the cell', () => {
    const { grid } = renderDeadliftFrame(spec());
    expect(coverage(grid)).toBeGreaterThan(0.08);
    expect(coverage(grid)).toBeLessThan(0.7);
  });

  it('puts the lockout bar above the floor bar', () => {
    const floor = deadliftBarY(0, 0, 220, 25);
    const lock = deadliftBarY(1, 0, 220, 25);
    expect(lock).toBeLessThan(floor);
    expect(floor - lock).toBeGreaterThan(10);
  });

  it('draws floor and lockout as different images', () => {
    const floor = renderDeadliftFrame(spec({ height: 0, depth: 1 })).grid;
    const lock = renderDeadliftFrame(spec({ height: 1, depth: 0 })).grid;
    expect(gridsEqual(floor, lock)).toBe(false);
  });

  it('is not the squat drawing and not the bench drawing', () => {
    const pull = renderLifterFrame(spec({ kind: 'deadlift', height: 0, depth: 1 }));
    const squat = renderLifterFrame({ ...spec(), kind: 'squat', depth: 1 });
    const bench = renderLifterFrame({ ...spec(), kind: 'bench', height: 0, depth: 1 });
    expect(gridsEqual(pull.grid, squat.grid)).toBe(false);
    expect(gridsEqual(pull.grid, bench.grid)).toBe(false);
  });

  it('gives a distinct bar height at every sheet step', () => {
    const ys = new Set<number>();
    for (let step = 0; step <= DEADLIFT_PULL.HEIGHT_STEPS; step += 1) {
      ys.add(deadliftBarY(step / DEADLIFT_PULL.HEIGHT_STEPS, 0, 220, 25));
    }
    expect(DEADLIFT_PULL.HEIGHT_STEPS).toBeGreaterThan(1);
    expect(ys.size).toBe(DEADLIFT_PULL.HEIGHT_STEPS + 1);
  });
});

describe('deadlift skeleton', () => {
  it('keeps arm and leg bones the same length from floor to lockout', () => {
    for (let step = 0; step <= DEADLIFT_PULL.HEIGHT_STEPS; step += 1) {
      const height = step / DEADLIFT_PULL.HEIGHT_STEPS;
      const rendered = renderDeadliftFrame(spec({ height, depth: 1 - height }));
      const m = rendered.landmarks;
      expect(Math.hypot(m.elbowX - m.shoulderX, m.elbowY - m.shoulderY)).toBeCloseTo(ARM.UPPER_PX, 6);
      expect(Math.hypot(m.handX - m.elbowX, m.handY - m.elbowY)).toBeCloseTo(ARM.FORE_PX, 6);
      expect(Math.hypot(m.kneeX - m.hipX, m.kneeY - m.hipY)).toBeCloseTo(LEG.THIGH_PX, 6);
      expect(Math.hypot(m.ankleX - m.kneeX, m.ankleY - m.kneeY)).toBeCloseTo(LEG.SHIN_PX, 6);
    }
  });

  it('holds the hand on the bar that is actually drawn', () => {
    for (const height of [0, 0.5, 1]) {
      const rendered = renderDeadliftFrame(spec({ height, depth: 1 - height, barLateralPx: 1 }));
      expect(rendered.landmarks.handX).toBe(rendered.landmarks.barX);
      expect(rendered.landmarks.handY).toBe(rendered.landmarks.barY);
      const grip = skinInHandDisc(rendered.grid, rendered.landmarks.handX, rendered.landmarks.handY);
      expect(grip.lit, `height ${height}`).toBeGreaterThan(0);
    }
  });

  it('starts with hips high — a hinge, not a squat hole', () => {
    const floor = renderDeadliftFrame(spec({ height: 0, depth: 1 })).landmarks;
    // Hips sit near the shoulders, not near the ankles. That is the tell.
    const hipToShoulder = Math.abs(floor.hipY - floor.shoulderY);
    const hipToAnkle = Math.abs(floor.ankleY - floor.hipY);
    expect(hipToShoulder).toBeLessThan(hipToAnkle / 2);
    // Bar is on the floor, not on the back.
    expect(floor.barY).toBeGreaterThan(floor.shoulderY + 8);
    expect(floor.barY).toBeGreaterThan(RESOLUTION.FLOOR_Y - 12);
  });

  it('finishes standing with the bar in the hands at the hip', () => {
    const lock = renderDeadliftFrame(spec({ height: 1, depth: 0 })).landmarks;
    expect(lock.hipY).toBeLessThan(lock.kneeY);
    expect(lock.kneeY).toBeLessThan(lock.ankleY);
    expect(lock.barY).toBeLessThan(lock.hipY + 8);
    expect(lock.barY).toBeGreaterThan(lock.hipY - 12);
    expect(lock.headY).toBeLessThan(lock.shoulderY);
  });

  it('runs the bar up one vertical column', () => {
    const xs = new Set<number>();
    for (let step = 0; step <= DEADLIFT_PULL.HEIGHT_STEPS; step += 1) {
      const height = step / DEADLIFT_PULL.HEIGHT_STEPS;
      xs.add(renderDeadliftFrame(spec({ height, depth: 1 - height })).landmarks.barX);
    }
    expect(xs.size).toBe(1);
    expect([...xs][0]).toBe(BAR.X);
  });
});
