import { describe, expect, it } from 'vitest';
import {
  SPRITE_CELL,
  barOffsetAt,
  frameSpecFrom,
  renderContactShadow,
  renderLifterFrame,
  renderStage,
  type LifterFrameSpec,
} from './lifterSprite';
import { buildSquatRep } from './squatAnimation';
import { BANK_SIZE, PAL, colorAt, isTransparentIndex, rgb5ToRgb8 } from './palette';
import { findUnallocatedIndices, gridToRgba, usedIndices } from './rgba';
import { getPx, upscaleGrid, type IndexGrid } from './raster';
import { BAR, BEND, LOAD_PRESETS, RESOLUTION, STRAIN } from './spriteTuning';
import { POSES, poseAtDepth } from './rig';

const BASE: LifterFrameSpec = {
  depth: 0,
  direction: 'DESCENT',
  strainLevel: 0,
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

describe('rendered frame integrity', () => {
  it('renders at the committed internal resolution', () => {
    const { grid } = renderLifterFrame(spec());
    expect(grid.w).toBe(RESOLUTION.CELL_W);
    expect(grid.h).toBe(RESOLUTION.CELL_H);
    expect(SPRITE_CELL).toEqual({ W: RESOLUTION.CELL_W, H: RESOLUTION.CELL_H });
    // 96x72 is 12x9 tiles of 8x8, which is how sprite RAM was budgeted.
    expect(grid.w % 8).toBe(0);
    expect(grid.h % 8).toBe(0);
  });

  it('never references an unallocated palette index', () => {
    for (const rep of [buildSquatRep(LOAD_PRESETS.LIGHT), buildSquatRep(LOAD_PRESETS.MAXIMAL)]) {
      for (const frame of rep.frames) {
        const { grid } = renderLifterFrame(frameSpecFrom(frame, 250));
        expect(findUnallocatedIndices(grid), `frame ${frame.index}`).toEqual([]);
      }
    }
  });

  it('keeps the character out of the STAGE bank entirely', () => {
    // STAGE exists so a frame has a floor when inspected alone. A sprite that
    // painted itself with backdrop colours would fall apart over real scenery.
    const { grid } = renderLifterFrame(spec({ strainLevel: STRAIN.LEVELS - 1, depth: 1 }));
    for (const index of usedIndices(grid)) {
      expect(Math.floor(index / BANK_SIZE), `index ${index}`).toBeLessThan(2);
    }
  });

  it('draws something substantial but does not fill the cell', () => {
    const { grid } = renderLifterFrame(spec());
    expect(coverage(grid)).toBeGreaterThan(0.12);
    expect(coverage(grid)).toBeLessThan(0.6);
  });

  it('leaves a transparent margin, so nothing is clipped by the cell', () => {
    for (const depth of [0, 0.5, 1]) {
      for (const kg of [27.5, 250, 400]) {
        const { grid } = renderLifterFrame(
          spec({ depth, totalKg: kg, barBendPx: BEND.MAX_PX, barLateralPx: 1, barTiltDeg: 4 }),
        );
        for (let x = 0; x < grid.w; x += 1) {
          expect(getPx(grid, x, 0), `top row, ${kg}kg d${depth}`).toBe(0);
          expect(getPx(grid, x, grid.h - 1), `bottom row, ${kg}kg d${depth}`).toBe(0);
        }
        for (let y = 0; y < grid.h; y += 1) {
          expect(getPx(grid, 0, y), `left col, ${kg}kg d${depth}`).toBe(0);
          expect(getPx(grid, grid.w - 1, y), `right col, ${kg}kg d${depth}`).toBe(0);
        }
      }
    }
  });

  it('outlines the whole silhouette: no fill pixel touches open space', () => {
    const { grid } = renderLifterFrame(spec({ depth: 1, strainLevel: 2, totalKg: 250 }));
    const outlines = new Set<number>([PAL.OUTLINE, PAL.EQ_OUTLINE]);
    for (let y = 1; y < grid.h - 1; y += 1) {
      for (let x = 1; x < grid.w - 1; x += 1) {
        const v = getPx(grid, x, y);
        if (isTransparentIndex(v) || outlines.has(v)) continue;
        const neighbours = [
          getPx(grid, x - 1, y),
          getPx(grid, x + 1, y),
          getPx(grid, x, y - 1),
          getPx(grid, x, y + 1),
        ];
        for (const n of neighbours) {
          expect(isTransparentIndex(n), `bare fill pixel at ${x},${y}`).toBe(false);
        }
      }
    }
  });

  it('is deterministic', () => {
    const a = renderLifterFrame(spec({ depth: 0.5, strainLevel: 2 })).grid;
    const b = renderLifterFrame(spec({ depth: 0.5, strainLevel: 2 })).grid;
    expect(gridsEqual(a, b)).toBe(true);
  });
});

describe('the drawing responds to load, not only the clock', () => {
  it('changes pixels when strain changes at the same depth and same bar', () => {
    const relaxed = renderLifterFrame(spec({ depth: 0.66, direction: 'ASCENT', strainLevel: 0 }));
    const strained = renderLifterFrame(
      spec({ depth: 0.66, direction: 'ASCENT', strainLevel: STRAIN.LEVELS - 1 }),
    );
    expect(gridsEqual(relaxed.grid, strained.grid)).toBe(false);
    // And it changes them the way the strain model says: hips up, knees in.
    expect(strained.pose.hipY).toBeLessThan(relaxed.pose.hipY);
    expect(strained.pose.kneeHalfW).toBeLessThan(relaxed.pose.kneeHalfW);
    expect(strained.pose.headY).toBeLessThan(relaxed.pose.headY);
    // The bar must not move: depth has to stay honest under strain.
    expect(strained.barCenterY).toBe(relaxed.barCenterY);
  });

  it('changes pixels when the bar gets heavier at the same pose', () => {
    const lightBar = renderLifterFrame(spec({ totalKg: 100 }));
    const heavyBar = renderLifterFrame(spec({ totalKg: 250 }));
    expect(gridsEqual(lightBar.grid, heavyBar.grid)).toBe(false);
    expect(heavyBar.sleeve.slots.length).toBeGreaterThan(lightBar.sleeve.slots.length);
  });

  it('changes pixels when the sleeves bend', () => {
    const straight = renderLifterFrame(spec({ totalKg: 250, barBendPx: 0 }));
    const bowed = renderLifterFrame(spec({ totalKg: 250, barBendPx: 3.5 }));
    expect(gridsEqual(straight.grid, bowed.grid)).toBe(false);
  });

  it('changes pixels when the bar tilts', () => {
    const levelBar = renderLifterFrame(spec({ totalKg: 250, barTiltDeg: 0 }));
    const tilted = renderLifterFrame(spec({ totalKg: 250, barTiltDeg: 3 }));
    expect(gridsEqual(levelBar.grid, tilted.grid)).toBe(false);
  });

  it('does not render a mirror image of itself', () => {
    // Geometry is symmetric about CENTER_X by construction; the key light,
    // the head offset and the grip asymmetry are what stop the pixels from
    // being symmetric too. If this ever passes as symmetric, the shading model
    // has been flattened.
    const { grid } = renderLifterFrame(spec({ totalKg: 250 }));
    let mirrored = 0;
    let total = 0;
    for (let y = 0; y < grid.h; y += 1) {
      for (let x = 0; x < grid.w; x += 1) {
        const a = getPx(grid, x, y);
        const b = getPx(grid, grid.w - 1 - x, y);
        if (isTransparentIndex(a) && isTransparentIndex(b)) continue;
        total += 1;
        if (a === b) mirrored += 1;
      }
    }
    expect(mirrored / total).toBeLessThan(0.9);
  });
});

describe('bar geometry', () => {
  it('bends nothing at the centre and exactly the bend amount at the tip', () => {
    expect(barOffsetAt(0, 0, 3)).toBe(0);
    expect(barOffsetAt(BAR.HALF_SPAN_PX, 0, 3)).toBeCloseTo(3, 9);
    expect(barOffsetAt(-BAR.HALF_SPAN_PX, 0, 3)).toBeCloseTo(3, 9);
  });

  it('keeps the shaft between the sleeves nearly flat', () => {
    // Exponent 2 means a loaded bar bows at the sleeves, not uniformly. At the
    // sleeve boundary the droop must still be a small fraction of the tip's.
    const atShaft = barOffsetAt(BAR.SHAFT_HALF_PX, 0, 3);
    const atTip = barOffsetAt(BAR.HALF_SPAN_PX, 0, 3);
    expect(atShaft / atTip).toBeLessThan(0.25);
    expect(BEND.EXPONENT).toBeGreaterThan(1);
  });

  it('tilts linearly and antisymmetrically', () => {
    expect(barOffsetAt(10, 2, 0)).toBeCloseTo(-barOffsetAt(-10, 2, 0), 9);
    expect(barOffsetAt(20, 2, 0)).toBeCloseTo(2 * barOffsetAt(10, 2, 0), 9);
  });

  it('spans a real competition bar', () => {
    // 2 * 38 px at 34.29 px/m is 2.216 m against a 2.2 m bar.
    const metres = (2 * BAR.HALF_SPAN_PX) / (RESOLUTION.LIFTER_HEIGHT_PX / 1.75);
    expect(metres).toBeGreaterThan(2.15);
    expect(metres).toBeLessThan(2.3);
  });

  it('keeps the bar glued to the shoulders at every depth', () => {
    for (const depth of [0, 0.25, 0.5, 0.75, 1]) {
      const rendered = renderLifterFrame(spec({ depth }));
      const pose = poseAtDepth(depth, 'DESCENT');
      expect(rendered.barCenterY).toBeCloseTo(pose.shoulderY - BAR.SHOULDER_OFFSET_PX, 9);
    }
  });

  it('drops the bar the distance a real squat drops it', () => {
    const stand = renderLifterFrame(spec({ depth: 0 })).barCenterY;
    const hole = renderLifterFrame(spec({ depth: 1 })).barCenterY;
    const metres = (hole - stand) / (RESOLUTION.LIFTER_HEIGHT_PX / 1.75);
    expect(metres).toBeGreaterThan(0.35);
    expect(metres).toBeLessThan(0.55);
  });
});

describe('depth is honest', () => {
  it('puts the hip below the knee at the bottom, and above it standing', () => {
    // Screen y grows downward, so "hip crease below the top of the knee" — the
    // actual judging criterion — is hipY > kneeY here.
    expect(POSES.HOLE.hipY).toBeGreaterThan(POSES.HOLE.kneeY);
    expect(POSES.STAND.hipY).toBeLessThan(POSES.STAND.kneeY);
  });

  it('descends monotonically along both pose ladders', () => {
    for (const direction of ['DESCENT', 'ASCENT'] as const) {
      let prev = -Infinity;
      for (let d = 0; d <= 1.0001; d += 0.05) {
        const y = poseAtDepth(Math.min(1, d), direction).shoulderY;
        expect(y, `${direction} at depth ${d.toFixed(2)}`).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = y;
      }
    }
  });

  it('draws the way up differently from the way down at the same depth', () => {
    const down = renderLifterFrame(spec({ depth: 0.66, direction: 'DESCENT' }));
    const up = renderLifterFrame(spec({ depth: 0.66, direction: 'ASCENT' }));
    expect(gridsEqual(down.grid, up.grid)).toBe(false);
  });
});

describe('scaling and colour conversion', () => {
  it('upscales by exact pixel replication', () => {
    const { grid } = renderLifterFrame(spec());
    const up = upscaleGrid(grid, 6);
    expect(up.w).toBe(grid.w * 6);
    expect(up.h).toBe(grid.h * 6);
    for (let y = 0; y < up.h; y += 1) {
      for (let x = 0; x < up.w; x += 1) {
        expect(getPx(up, x, y)).toBe(getPx(grid, Math.floor(x / 6), Math.floor(y / 6)));
      }
    }
  });

  it('introduces no colour that is not in the palette', () => {
    const { grid } = renderLifterFrame(spec({ totalKg: 250, strainLevel: 3, depth: 0.66 }));
    const rgba = gridToRgba(grid);
    const allowed = new Set<string>();
    for (const index of usedIndices(grid)) {
      const c = colorAt(index);
      if (c === undefined) continue;
      allowed.add(rgb5ToRgb8(c).join(','));
    }
    for (let i = 0; i < grid.data.length; i += 1) {
      const alpha = rgba[i * 4 + 3] ?? 0;
      if (isTransparentIndex(grid.data[i] ?? 0)) {
        expect(alpha).toBe(0);
        continue;
      }
      expect(alpha).toBe(255);
      const key = [rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]].join(',');
      expect(allowed.has(key), `stray colour ${key}`).toBe(true);
    }
  });

  it('produces no partial alpha anywhere — there is no anti-aliasing', () => {
    const { grid } = renderLifterFrame(spec({ totalKg: 250 }));
    const rgba = gridToRgba(grid);
    for (let i = 3; i < rgba.length; i += 4) {
      expect([0, 255]).toContain(rgba[i]);
    }
  });
});

describe('inspection layers', () => {
  it('fills the stage completely so a sprite always has a floor', () => {
    const stage = renderStage();
    expect(coverage(stage)).toBe(1);
  });

  it('grounds the lifter with a shadow that narrows as he descends', () => {
    const stand = coverage(renderContactShadow(poseAtDepth(0, 'DESCENT'), 0));
    const bottom = coverage(renderContactShadow(poseAtDepth(1, 'DESCENT'), 1));
    expect(stand).toBeGreaterThan(0);
    expect(bottom).toBeLessThan(stand);
  });
});
