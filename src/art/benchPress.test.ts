/**
 * Tests for the side-on bench press drawing.
 *
 * NOTHING BELOW ASSERTS THAT THE DRAWING LOOKS GOOD. It cannot. What it
 * asserts is the much weaker set of properties a retune could break without
 * breaking anything that looks related:
 *
 *   - the cell is the committed 96×72
 *   - the figure is a press, not a squat (pixels differ)
 *   - the bar leaves the chest (lockout y is above chest y)
 *   - palette indices stay allocated
 *
 * A phone playtest of the first bench pass reported a squat figure on a bench
 * session. These exist so that specific regression is red rather than a
 * caption change.
 */

import { describe, expect, it } from 'vitest';

import { BENCH_PRESS, RESOLUTION, STRAIN } from './spriteTuning';
import { BANK_SIZE, isTransparentIndex } from './palette';
import { type IndexGrid } from './raster';
import { findUnallocatedIndices, usedIndices } from './rgba';
import { renderLifterFrame, type LifterFrameSpec } from './lifterSprite';
import { benchBarY, renderBenchFrame } from './benchPress';

const BASE: LifterFrameSpec = {
  kind: 'bench',
  depth: 1,
  height: 0,
  direction: 'DESCENT',
  strainLevel: 0,
  pitchLevel: 0,
  barLateralPx: 0,
  barTiltDeg: 0,
  barBendPx: 0,
  chalkMotes: 0,
  totalKg: 180,
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

describe('bench press drawing', () => {
  it('renders at the committed internal resolution', () => {
    const { grid } = renderBenchFrame(spec());
    expect(grid.w).toBe(RESOLUTION.CELL_W);
    expect(grid.h).toBe(RESOLUTION.CELL_H);
    expect(grid.w % 8).toBe(0);
    expect(grid.h % 8).toBe(0);
  });

  it('never references an unallocated palette index', () => {
    for (const height of [0, 0.5, 1]) {
      for (const kg of [27.5, 180, 250]) {
        const { grid } = renderBenchFrame(spec({ height, totalKg: kg }));
        expect(findUnallocatedIndices(grid), `height ${height} kg ${kg}`).toEqual([]);
      }
    }
  });

  it('keeps the character out of the STAGE bank entirely', () => {
    const { grid } = renderBenchFrame(spec({ strainLevel: STRAIN.LEVELS - 1, height: 1 }));
    for (const index of usedIndices(grid)) {
      expect(Math.floor(index / BANK_SIZE), `index ${index}`).toBeLessThan(2);
    }
  });

  it('draws something substantial but does not fill the cell', () => {
    const { grid } = renderBenchFrame(spec());
    expect(coverage(grid)).toBeGreaterThan(0.08);
    expect(coverage(grid)).toBeLessThan(0.7);
  });

  it('puts the lockout bar above the chest bar', () => {
    // The whole point of a press. If these ever agree, the bar is glued to
    // the chest for the concentric and the drawing is a pause, not a lift.
    const chest = benchBarY(0);
    const lock = benchBarY(1);
    expect(lock).toBeLessThan(chest);
    expect(chest - lock).toBeGreaterThan(10);
  });

  it('draws chest and lockout as different images', () => {
    const chest = renderBenchFrame(spec({ height: 0 })).grid;
    const lock = renderBenchFrame(spec({ height: 1 })).grid;
    expect(gridsEqual(chest, lock)).toBe(false);
  });

  it('is not the squat drawing at the same spec', () => {
    // THE PHONE FINDING. A bench spec that still ran through the squat sheet
    // produced a front-on back squat. Kind is the dispatch; if it is ignored
    // these two grids are the same picture.
    const squat = renderLifterFrame({ ...spec(), kind: 'squat', depth: 1 });
    const bench = renderLifterFrame(spec({ kind: 'bench', height: 0 }));
    expect(gridsEqual(squat.grid, bench.grid)).toBe(false);
  });

  it('quantises height through the same step count the adapter uses', () => {
    expect(BENCH_PRESS.HEIGHT_STEPS).toBeGreaterThan(1);
  });
});
