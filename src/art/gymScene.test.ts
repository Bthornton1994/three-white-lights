import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { codeOnly } from '../tuning/audit';
import { LIFT_TUNING } from '../game/liftTuning';
import { CENTER_X, RESOLUTION } from './spriteTuning';
import { BANK_SIZE, PAL, isTransparentIndex } from './palette';
import { GYM, lumaOfIndex, sceneColorAt } from './gymPalette';
import { GYM_PROP_KINDS, PROP_ART } from './gymProps';
import {
  GYM_CLEAR_BAND,
  GYM_LIFT_FOCUS_X,
  GYM_LIFT_STAGE,
  GYM_LIGHTING,
  GYM_PARALLAX,
  GYM_PROPS_MEET,
  GYM_PROPS_TRAINING,
  GYM_READABILITY,
  GYM_ROOM,
  GYM_VENUE_PROPS,
  GYM_WINDOWS,
  type GymPropPlacement,
  type GymVenue,
} from './gymTuning';
import {
  blitOver,
  clearBand,
  floorDepth,
  junctionRow,
  layerOffset,
  liftStageScene,
  platformBackRow,
  propBox,
  rectsOverlap,
  renderGymScene,
  type GymSceneSpec,
  type SceneRect,
} from './gymScene';
import { formatReadability, measureSceneReadability, roleOf } from './gymReadability';
import { createGrid, getPx, setPx, type IndexGrid } from './raster';
import { LOAD_PRESETS } from './spriteTuning';
import { buildSquatRep } from './squatAnimation';
import { frameSpecFrom, isBodyIndex, renderLifterFrame } from './lifterSprite';

/**
 * ===========================================================================
 * WHAT THIS FILE IS FOR
 * ===========================================================================
 * GDD §12.2 grades the gym on two clauses. One of them — "blind A/B, same era"
 * — is not decidable here: `docs/reference/README.md` records that no 16-bit
 * gym-interior reference is committed, and CLAUDE.md says a bar that cannot be
 * compared against its reference is reported unverifiable rather than passed.
 * Nothing in this file claims it.
 *
 * The other clause — "readability at phone scale" — is measurable, and this is
 * where it is measured, on the composited pixels the screen actually shows.
 *
 * ===========================================================================
 * EVERY BOUND IS BRACKETED AT BOTH ENDS
 * ===========================================================================
 * The failure this run has found nineteen times is a check that a WORSE
 * artifact satisfies more easily. Every readability quantity here has that
 * shape available, and every one is therefore bounded on both sides:
 *
 *   - a blank black rectangle has PERFECT rim contrast and zero busyness. It
 *     fails `MEAN_LUMA`, `INDEX_COUNT`, `EDGE_SHARE` and `BRIGHT_SHARE` floors.
 *   - a lit, cluttered room has plenty of content. It fails the `EDGE_SHARE`,
 *     `BEHIND_EDGE_SHARE`, `MEAN_LUMA` and `BRIGHT_SHARE` ceilings.
 *   - a room drawn in the figure's own value band passes both of those and
 *     fails the `RIM_*` floors.
 *
 * `describe('the bounds bite')` plants each of those three and asserts the
 * SPECIFIC bound that catches it. If a bound were ever loosened until it could
 * not fail, those tests go red rather than green.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// THE BOUNDS
// ---------------------------------------------------------------------------

/**
 * The pass/fail bar for a composited frame.
 *
 * Deliberately here and not in `gymTuning.ts`. The measurement's terms — what
 * counts as an edge, how far out the rim is probed — are tuning, because they
 * define the instrument. A BAR is not tuning; it belongs where it can be read
 * next to the numbers it is judging, and where moving it is an edit to a test
 * rather than a knob in a file whose whole invitation is "turn these".
 *
 * Measured values on the shipped training gym across four squat depths, for
 * the record and so the headroom is visible rather than implied:
 *
 *   indices            26-27          mean luma        33.9-34.4
 *   luma p90           58-71.8        edge share       10.1-10.5%
 *   behind edge share  16.6-20.7%     bright share     0.10%
 *   over figure median 7.6-7.8%       rim p05/p10      8.0 / 8.0-16.1
 *   rim p25/p50        19.4-29.1 / 40.1-48.2
 *
 * And the three planted rooms, for the same quantities, so the headroom is on
 * the record in both directions:
 *
 *   deleted layer      1 index, mean 10.9, edge 0%,    rim p25/p50 26.4 / 62.1
 *   busy-but-dark      27,      mean 32.2, edge 17.5%, rim p25/p50 26.8 / 49.1
 *   figure-band room   14,      mean ~55,  edge ~8%,   rim p05/p10 ~1 / ~4
 *
 * Read the middle row twice. A busier wall made the room DARKER on average and
 * IMPROVED every rim percentile. Nothing but the edge-share ceiling catches it.
 */
const BOUNDS = {
  /** A flat fill has one. A room has furniture. */
  INDEX_COUNT_MIN: 14,
  /** The whole scene index space is 36; a cap much above that says nothing. */
  INDEX_COUNT_MAX: 34,
  /** Black screen 17.9 fails this. */
  MEAN_LUMA_MIN: 25,
  /** A room bright enough to compete with the figure fails this. */
  MEAN_LUMA_MAX: 70,
  P90_LUMA_MIN: 40,
  P90_LUMA_MAX: 90,
  /** Zero on an empty room. */
  EDGE_SHARE_MIN: 0.03,
  /** A checker, or a room full of high-contrast clutter, exceeds this. */
  EDGE_SHARE_MAX: 0.14,
  BEHIND_EDGE_SHARE_MIN: 0.02,
  BEHIND_EDGE_SHARE_MAX: 0.28,
  /** There is a light source in the room... */
  BRIGHT_SHARE_MIN: 0.0002,
  /** ...and it is a filament, not a wall. */
  BRIGHT_SHARE_MAX: 0.01,
  /** Something in the room is brighter than the figure's median pixel — the
   *  platform. Nothing is, on a black screen. */
  OVER_FIGURE_SHARE_MIN: 0.01,
  OVER_FIGURE_SHARE_MAX: 0.2,
  /**
   * Rim separation percentiles, figure fill against room fill, with the
   * sprite's own keyline stepped over at both ends.
   *
   * HIGHER IS BETTER, so these are floors only — which makes them the most
   * directional numbers in the file and the reason the four bounds above exist.
   * A black rectangle scores BETTER on every one of them than the shipped room
   * does. They are worth something only in combination.
   */
  RIM_P05_MIN: 4,
  RIM_P10_MIN: 6,
  RIM_P25_MIN: 14,
  RIM_P50_MIN: 32,
  /** The figure keeps the top of the range outright. */
  FIGURE_OVER_ROOM_P90_MIN: 60,
} as const;

type Violation = string;

/** Every bound the frame fails, by name. Empty is a pass. */
function violations(grid: IndexGrid): Violation[] {
  const r = measureSceneReadability(grid);
  const out: Violation[] = [];
  const check = (name: string, value: number, min: number, max: number): void => {
    if (value < min) out.push(`${name}_LOW(${value.toFixed(4)}<${min})`);
    if (value > max) out.push(`${name}_HIGH(${value.toFixed(4)}>${max})`);
  };
  check('INDEX_COUNT', r.backgroundIndexCount, BOUNDS.INDEX_COUNT_MIN, BOUNDS.INDEX_COUNT_MAX);
  check('MEAN_LUMA', r.backgroundMeanLuma, BOUNDS.MEAN_LUMA_MIN, BOUNDS.MEAN_LUMA_MAX);
  check('P90_LUMA', r.backgroundLuma.p90, BOUNDS.P90_LUMA_MIN, BOUNDS.P90_LUMA_MAX);
  check('EDGE_SHARE', r.backgroundEdgeShare, BOUNDS.EDGE_SHARE_MIN, BOUNDS.EDGE_SHARE_MAX);
  check(
    'BEHIND_EDGE_SHARE',
    r.behindEdgeShare,
    BOUNDS.BEHIND_EDGE_SHARE_MIN,
    BOUNDS.BEHIND_EDGE_SHARE_MAX,
  );
  check('BRIGHT_SHARE', r.backgroundBrightShare, BOUNDS.BRIGHT_SHARE_MIN, BOUNDS.BRIGHT_SHARE_MAX);
  check(
    'OVER_FIGURE_SHARE',
    r.backgroundOverFigureShare,
    BOUNDS.OVER_FIGURE_SHARE_MIN,
    BOUNDS.OVER_FIGURE_SHARE_MAX,
  );
  const rimMax = Number.POSITIVE_INFINITY;
  check('RIM_P05', r.rimContrast.p05, BOUNDS.RIM_P05_MIN, rimMax);
  check('RIM_P10', r.rimContrast.p10, BOUNDS.RIM_P10_MIN, rimMax);
  check('RIM_P25', r.rimContrast.p25, BOUNDS.RIM_P25_MIN, rimMax);
  check('RIM_P50', r.rimContrast.p50, BOUNDS.RIM_P50_MIN, rimMax);
  check(
    'FIGURE_OVER_ROOM',
    r.figureLuma.p90 - r.backgroundLuma.p90,
    BOUNDS.FIGURE_OVER_ROOM_P90_MIN,
    rimMax,
  );
  return out;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SPEC = liftStageScene();
const MEET_SPEC: GymSceneSpec = { ...SPEC, venue: 'meet-platform' };
const DEMO_TOTAL_KG = 250;

const REP = buildSquatRep(LOAD_PRESETS.MAXIMAL);
const LIGHT_REP = buildSquatRep(LOAD_PRESETS.LIGHT);

function frameAt(frac: number): (typeof REP.frames)[number] {
  const i = Math.min(REP.frames.length - 1, Math.round((REP.frames.length - 1) * frac));
  const frame = REP.frames[i];
  if (frame === undefined) throw new Error('no frame');
  return frame;
}

/** The room with the lifter standing in it, exactly as the stage composites. */
function composite(frac: number, spec: GymSceneSpec = SPEC): IndexGrid {
  const scene = renderGymScene(spec);
  const { grid } = renderLifterFrame(frameSpecFrom(frameAt(frac), DEMO_TOTAL_KG));
  return blitOver(scene, grid, GYM_LIFT_STAGE.SPRITE_X, GYM_LIFT_STAGE.SPRITE_Y);
}

/** The same figure over a background made by `paint`, for the adversarial set. */
function compositeOverPainted(paint: (g: IndexGrid) => void, frac: number = 0.5): IndexGrid {
  const bg = createGrid(SPEC.w, SPEC.h, GYM.WALL_DEEP);
  paint(bg);
  const { grid } = renderLifterFrame(frameSpecFrom(frameAt(frac), DEMO_TOTAL_KG));
  return blitOver(bg, grid, GYM_LIFT_STAGE.SPRITE_X, GYM_LIFT_STAGE.SPRITE_Y);
}

const MOMENTS: readonly (readonly [string, number])[] = [
  ['standing', 0],
  ['descent', 0.25],
  ['hole', 0.5],
  ['drive', 0.7],
];

// ---------------------------------------------------------------------------
// The layer exists at all
// ---------------------------------------------------------------------------

describe('the room is a room', () => {
  it('covers every pixel of its grid — no holes for a screen colour to show', () => {
    const g = renderGymScene(SPEC);
    expect(g.w).toBe(GYM_LIFT_STAGE.W);
    expect(g.h).toBe(GYM_LIFT_STAGE.H);
    for (let i = 0; i < g.data.length; i += 1) {
      expect(isTransparentIndex(g.data[i] ?? 0), `hole at ${i}`).toBe(false);
    }
  });

  it('draws a wall, a floor, a platform, lamps and props', () => {
    // The check that goes red the moment the layer is deleted. Each of these is
    // a named piece of the room, found by its own palette index.
    const g = renderGymScene(SPEC);
    const present = new Set<number>(g.data);
    for (const [name, index] of [
      ['wall', GYM.WALL_MID],
      ['kickplate', GYM.WALL_SKIRT],
      ['painted stripe', GYM.STRIPE_MID],
      ['window glass', GYM.GLASS_DIM],
      ['rubber floor', GYM.FLOOR_MID],
      ['platform boards', GYM.WOOD_LIGHT],
      ['platform edge', GYM.STEEL_FRAME],
      ['lamp filament', GYM.LAMP_CORE],
      ['coloured plates on a tree', GYM.ACCENT_RED],
      ['chalk', GYM.CHALK_DUST],
    ] as const) {
      expect(present.has(index), `the room has no ${name}`).toBe(true);
    }
  });

  it('renders the same bytes twice — nothing in here is random', () => {
    const a = renderGymScene(SPEC);
    const b = renderGymScene(SPEC);
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
  });

  it('resolves every index it draws to a real colour', () => {
    for (const spec of [SPEC, MEET_SPEC]) {
      const g = renderGymScene(spec);
      for (const index of new Set<number>(g.data)) {
        expect(sceneColorAt(index), `index ${index} is unallocated`).toBeDefined();
      }
    }
  });

  it('draws only background banks — the room never borrows a figure colour', () => {
    // The banks are what make "is this the room or the lifter?" have an exact
    // answer, and the readability measure depends on that answer.
    for (const spec of [SPEC, MEET_SPEC]) {
      for (const index of new Set<number>(renderGymScene(spec).data)) {
        expect(roleOf(index), `index ${index}`).toBe('background');
        expect(isBodyIndex(index)).toBe(false);
      }
    }
  });

  it('gives the two venues different rooms, from one renderer', () => {
    const gym = renderGymScene(SPEC);
    const meet = renderGymScene(MEET_SPEC);
    expect(Array.from(gym.data)).not.toEqual(Array.from(meet.data));
    const inGym = new Set<number>(gym.data);
    const inMeet = new Set<number>(meet.data);
    // A meet hall has a crowd and a banner; a training gym has block courses
    // and a plate tree.
    expect(inMeet.has(GYM.CROWD_MID)).toBe(true);
    expect(inGym.has(GYM.CROWD_MID)).toBe(false);
    expect(inGym.has(GYM.GLASS_DIM)).toBe(true);
    expect(inMeet.has(GYM.GLASS_DIM)).toBe(false);
    // ...and both stand on the same platform.
    expect(inGym.has(GYM.WOOD_LIGHT)).toBe(true);
    expect(inMeet.has(GYM.WOOD_LIGHT)).toBe(true);
  });

  it('composes at a size that is not the lift stage', () => {
    // The layer is reusable or it is welded to one screen. Meet day is being
    // built in parallel and does not share this box.
    const other: GymSceneSpec = {
      venue: 'meet-platform',
      w: SPEC.w * 2,
      h: Math.round(SPEC.h / 2),
      floorRow: Math.round(SPEC.h / 2) - GYM_ROOM.APRON_ROWS - 1,
      focusX: SPEC.w,
      cameraX: 0,
    };
    const g = renderGymScene(other);
    expect(g.w).toBe(other.w);
    expect(g.h).toBe(other.h);
    for (let i = 0; i < g.data.length; i += 1) {
      expect(isTransparentIndex(g.data[i] ?? 0)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// The scene box agrees with the screen it is drawn on
// ---------------------------------------------------------------------------

describe('the scene box is derived, not guessed', () => {
  const L = LIFT_TUNING.LAYOUT;
  const S = GYM_LIFT_STAGE;

  it('uses the sprite own integer upscale', () => {
    expect(S.SCALE).toBe(LIFT_TUNING.FEEDBACK.SPRITE_SCALE);
    expect(Number.isInteger(S.SCALE)).toBe(true);
  });

  it('puts the two pixel grids on ONE lattice', () => {
    // The reason ORIGIN_Y is 1 and not 0. The sprite is drawn at y 292 and 292
    // is not a multiple of 3, so a scene at y 0 has its pixel grid a third of a
    // scene-pixel out of phase with the figure standing on it — which at
    // nearest-neighbour is a visible shimmer along every edge where they meet.
    expect((L.SPRITE_X - S.ORIGIN_X) % S.SCALE).toBe(0);
    expect((L.SPRITE_Y - S.ORIGIN_Y) % S.SCALE).toBe(0);
    expect(S.SPRITE_X).toBe((L.SPRITE_X - S.ORIGIN_X) / S.SCALE);
    expect(S.SPRITE_Y).toBe((L.SPRITE_Y - S.ORIGIN_Y) / S.SCALE);
  });

  it('lands the drawn floor on the drawn soles', () => {
    const soleOnScreen = L.SPRITE_Y + RESOLUTION.FLOOR_Y * S.SCALE;
    const floorOnScreen = S.ORIGIN_Y + S.FLOOR_ROW * S.SCALE;
    expect(floorOnScreen).toBe(soleOnScreen);
  });

  it('covers the stage and does not overshoot it by a whole scene pixel', () => {
    expect(S.ORIGIN_X + S.W * S.SCALE).toBeGreaterThanOrEqual(L.STAGE_W);
    expect(S.ORIGIN_Y + S.H * S.SCALE).toBeGreaterThanOrEqual(L.STAGE_H);
    expect(S.ORIGIN_X + (S.W - 1) * S.SCALE).toBeLessThan(L.STAGE_W);
    expect(S.ORIGIN_Y + (S.H - 1) * S.SCALE).toBeLessThan(L.STAGE_H);
  });

  it('composes the room around the lifter centre line, not the grid centre', () => {
    expect(GYM_LIFT_FOCUS_X).toBe(S.SPRITE_X + CENTER_X);
    // ...and they really are different, which is the whole point of `focusX`.
    expect(Math.abs(GYM_LIFT_FOCUS_X - S.W / 2)).toBeGreaterThan(BANK_SIZE / 2);
  });

  it('keeps the junction above the floor and the platform below it', () => {
    expect(junctionRow(SPEC)).toBeGreaterThan(0);
    expect(junctionRow(SPEC)).toBeLessThan(SPEC.floorRow);
    expect(floorDepth(SPEC)).toBeGreaterThan(GYM_ROOM.APRON_ROWS);
    expect(platformBackRow(SPEC)).toBeGreaterThan(junctionRow(SPEC));
    expect(platformBackRow(SPEC)).toBeLessThan(SPEC.floorRow);
  });
});

// ---------------------------------------------------------------------------
// The hole the figure stands in
// ---------------------------------------------------------------------------

/** Union bounding box of the lifter body across the whole pose space. */
function bodyBox(): SceneRect {
  let x0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  for (const rep of [REP, LIGHT_REP]) {
    for (const frame of rep.frames) {
      const { grid } = renderLifterFrame(frameSpecFrom(frame, DEMO_TOTAL_KG));
      for (let y = 0; y < grid.h; y += 1) {
        for (let x = 0; x < grid.w; x += 1) {
          if (!isBodyIndex(getPx(grid, x, y))) continue;
          x0 = Math.min(x0, x + GYM_LIFT_STAGE.SPRITE_X);
          x1 = Math.max(x1, x + GYM_LIFT_STAGE.SPRITE_X);
          y0 = Math.min(y0, y + GYM_LIFT_STAGE.SPRITE_Y);
          y1 = Math.max(y1, y + GYM_LIFT_STAGE.SPRITE_Y);
        }
      }
    }
  }
  return { x0, y0, x1, y1 };
}

const BODY_BOX = bodyBox();

describe('nothing stands where the figure stands', () => {
  const band = clearBand(SPEC, RESOLUTION.LIFTER_HEIGHT_PX);

  it('reserves a band that really does contain the drawn figure', () => {
    // The authored band checked against the RENDERED silhouette, over the whole
    // pose space at two loads, rather than against itself. Without this the
    // reservation could drift away from the thing it protects and every
    // placement below would still "pass".
    expect(BODY_BOX.x1).toBeGreaterThan(BODY_BOX.x0);
    expect(band.x0).toBeLessThan(BODY_BOX.x0);
    expect(band.x1).toBeGreaterThan(BODY_BOX.x1);
    expect(band.y0).toBeLessThan(BODY_BOX.y0);
    expect(band.y1).toBeGreaterThanOrEqual(BODY_BOX.y1);
    // ...and it is not so wide that reserving it is vacuous: a band covering
    // the whole scene would trivially exclude every prop and mean nothing.
    expect(band.x1 - band.x0).toBeLessThan(SPEC.w / 2);
  });

  it('places no training prop inside it', () => {
    for (const placement of GYM_PROPS_TRAINING) {
      const box = propBox(SPEC, placement);
      expect(rectsOverlap(box, band), `${placement.ART} overlaps the clear band`).toBe(false);
    }
  });

  it('places no meet prop inside it', () => {
    for (const placement of GYM_PROPS_MEET) {
      const box = propBox(MEET_SPEC, placement);
      expect(rectsOverlap(box, band), `${placement.ART} overlaps the clear band`).toBe(false);
    }
  });

  it('keeps the bright wall colours out of it, on the rendered pixels', () => {
    // The exemption `gymPalette.test.ts` takes for the lamp wash, the painted
    // stripe and the window glass, checked rather than trusted. Each of them is
    // within a few luma of a step the lifter is drawn in, and each is legal
    // only because it never appears behind him.
    for (const spec of [SPEC, MEET_SPEC]) {
      const g = renderGymScene(spec);
      for (let y = Math.max(0, band.y0); y <= Math.min(spec.h - 1, band.y1); y += 1) {
        for (let x = Math.max(0, band.x0); x <= Math.min(spec.w - 1, band.x1); x += 1) {
          const index = getPx(g, x, y);
          for (const [name, banned] of [
            ['lamp wash', GYM.WALL_LIGHT],
            ['painted stripe', GYM.STRIPE_MID],
            ['window glass', GYM.GLASS_DIM],
            ['lamp filament', GYM.LAMP_CORE],
            ['lamp glow', GYM.LAMP_GLOW],
          ] as const) {
            expect(index, `${name} at (${x},${y}) in ${spec.venue}`).not.toBe(banned);
          }
        }
      }
    }
  });

  it('is a rule a bad placement breaks — checked by planting one', () => {
    const planted: GymPropPlacement = { ART: 'FLAT_BENCH', XF: 0.35, DEPTH: 0.1, DIM: false };
    expect(rectsOverlap(propBox(SPEC, planted), band)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Compositing
// ---------------------------------------------------------------------------

describe('the room goes behind the figure and stays there', () => {
  it('does not overwrite one pixel of the lifter or the bar', () => {
    for (const [name, frac] of MOMENTS) {
      const { grid: sprite } = renderLifterFrame(frameSpecFrom(frameAt(frac), DEMO_TOTAL_KG));
      const before = Array.from(sprite.data).filter((v) => !isTransparentIndex(v)).length;
      const merged = composite(frac);
      let after = 0;
      for (let y = 0; y < sprite.h; y += 1) {
        for (let x = 0; x < sprite.w; x += 1) {
          const v = getPx(sprite, x, y);
          if (isTransparentIndex(v)) continue;
          after += 1;
          expect(
            getPx(merged, x + GYM_LIFT_STAGE.SPRITE_X, y + GYM_LIFT_STAGE.SPRITE_Y),
            `${name} lost a sprite pixel at (${x},${y})`,
          ).toBe(v);
        }
      }
      expect(after).toBe(before);
      expect(before).toBeGreaterThan(0);
    }
  });

  it('leaves the sprite grid itself untouched', () => {
    const { grid: sprite } = renderLifterFrame(frameSpecFrom(frameAt(0), DEMO_TOTAL_KG));
    const copy = Array.from(sprite.data);
    blitOver(renderGymScene(SPEC), sprite, GYM_LIFT_STAGE.SPRITE_X, GYM_LIFT_STAGE.SPRITE_Y);
    expect(Array.from(sprite.data)).toEqual(copy);
  });
});

// ---------------------------------------------------------------------------
// READABILITY
// ---------------------------------------------------------------------------

describe('readability at phone scale', () => {
  it('passes every bound at every moment of the rep', () => {
    for (const [name, frac] of MOMENTS) {
      const grid = composite(frac);
      const bad = violations(grid);
      expect(bad, `${name}:\n${formatReadability(measureSceneReadability(grid))}`).toEqual([]);
    }
  });

  it('passes them in the meet venue too', () => {
    const grid = composite(0, MEET_SPEC);
    expect(violations(grid), formatReadability(measureSceneReadability(grid))).toEqual([]);
  });

  it('measures a real figure and a real room, not two empty sets', () => {
    // The vacuity guard. Every share above is a ratio, and a ratio over zero
    // pixels reports whatever the denominator guard says.
    const r = measureSceneReadability(composite(0.5));
    expect(r.figurePx).toBeGreaterThan(500);
    expect(r.barbellPx).toBeGreaterThan(200);
    expect(r.backgroundPx).toBeGreaterThan(SPEC.w * SPEC.h * 0.5);
    expect(r.behindPx).toBeGreaterThan(1000);
    expect(r.rimSamples).toBeGreaterThan(200);
    expect(r.figurePx + r.barbellPx + r.backgroundPx).toBe(SPEC.w * SPEC.h);
  });

  it('keeps the figure at the top of the range, by a distance', () => {
    const r = measureSceneReadability(composite(0));
    expect(r.figureLuma.p90 - r.backgroundLuma.p90).toBeGreaterThan(
      BOUNDS.FIGURE_OVER_ROOM_P90_MIN,
    );
    expect(r.figureMeanLuma).toBeGreaterThan(r.backgroundMeanLuma * 2);
  });
});

// ---------------------------------------------------------------------------
// ...AND THE BOUNDS BITE
// ---------------------------------------------------------------------------

describe('the bounds bite', () => {
  /** Assert the planted background really is different from the shipped one. */
  function planted(paint: (g: IndexGrid) => void): IndexGrid {
    const shipped = renderGymScene(SPEC);
    const bg = createGrid(SPEC.w, SPEC.h, GYM.WALL_DEEP);
    paint(bg);
    expect(Array.from(bg.data), 'the plant did not change anything').not.toEqual(
      Array.from(shipped.data),
    );
    return compositeOverPainted(paint);
  }

  it('DELETING THE ROOM fails the floors — and passes every rim bound', () => {
    // The single most important assertion in this file. A blank rectangle is
    // the BEST possible background by rim contrast and by busyness, so the rim
    // percentiles on their own would grade the deleted layer as an improvement.
    // This is what stops them being a directional bound nobody could fail.
    const grid = planted(() => {
      /* leave the flat WALL_DEEP fill */
    });
    const r = measureSceneReadability(grid);
    expect(r.rimContrast.p50).toBeGreaterThan(BOUNDS.RIM_P50_MIN);
    expect(r.backgroundEdgeShare).toBe(0);

    const bad = violations(grid);
    expect(bad.some((v) => v.startsWith('INDEX_COUNT_LOW'))).toBe(true);
    expect(bad.some((v) => v.startsWith('MEAN_LUMA_LOW'))).toBe(true);
    expect(bad.some((v) => v.startsWith('P90_LUMA_LOW'))).toBe(true);
    expect(bad.some((v) => v.startsWith('EDGE_SHARE_LOW'))).toBe(true);
    expect(bad.some((v) => v.startsWith('BRIGHT_SHARE_LOW'))).toBe(true);
    expect(bad.some((v) => v.startsWith('OVER_FIGURE_SHARE_LOW'))).toBe(true);
  });

  it('A BUSY ROOM fails the edge-share ceiling', () => {
    // THE ONE THAT MATTERS. A readability bound that only fails on a blank
    // screen is measuring nothing, so this is a room with plenty in it, at
    // plenty of contrast, drawn with the real palette.
    const grid = planted((g) => {
      for (let y = 0; y < g.h; y += 1) {
        for (let x = 0; x < g.w; x += 1) {
          const cell = (Math.floor(x / 3) + Math.floor(y / 3)) % 2 === 0;
          setPx(g, x, y, cell ? GYM.WALL_DEEP : GYM.WOOD_MID);
        }
      }
    });
    const bad = violations(grid);
    expect(bad.some((v) => v.startsWith('EDGE_SHARE_HIGH')), bad.join(' ')).toBe(true);
    expect(bad.some((v) => v.startsWith('BEHIND_EDGE_SHARE_HIGH'))).toBe(true);
  });

  it('A BUSY ROOM ONLY BEHIND THE FIGURE fails the behind-the-figure ceiling', () => {
    // Sharper than the last one: the room is exactly as shipped everywhere
    // except the band the lifter occupies, where it is cluttered. The
    // whole-scene edge share barely moves; the behind-the-figure one does.
    const band = clearBand(SPEC, RESOLUTION.LIFTER_HEIGHT_PX);
    const grid = planted((g) => {
      const room = renderGymScene(SPEC);
      g.data.set(room.data);
      for (let y = band.y0; y <= band.y1; y += 1) {
        for (let x = band.x0; x <= band.x1; x += 1) {
          const cell = (Math.floor(x / 2) + Math.floor(y / 2)) % 2 === 0;
          setPx(g, x, y, cell ? GYM.WALL_DEEP : GYM.STEEL_LIT);
        }
      }
    });
    const bad = violations(grid);
    expect(bad.some((v) => v.startsWith('BEHIND_EDGE_SHARE_HIGH')), bad.join(' ')).toBe(true);
  });

  it('A BRIGHT ROOM fails the brightness ceilings', () => {
    const grid = planted((g) => {
      const room = renderGymScene(SPEC);
      g.data.set(room.data);
      for (let y = 0; y < junctionRow(SPEC); y += 1) {
        for (let x = 0; x < g.w; x += 1) setPx(g, x, y, GYM.LAMP_GLOW);
      }
    });
    const bad = violations(grid);
    expect(bad.some((v) => v.startsWith('MEAN_LUMA_HIGH')), bad.join(' ')).toBe(true);
    expect(bad.some((v) => v.startsWith('P90_LUMA_HIGH'))).toBe(true);
    expect(bad.some((v) => v.startsWith('OVER_FIGURE_SHARE_HIGH'))).toBe(true);
  });

  it('A ROOM PAINTED IN THE FIGURE OWN VALUES fails ONLY the rim floors', () => {
    // The case neither "too dark" nor "too bright" catches, and the whole
    // reason the rim percentiles exist.
    //
    // This room is BUILT TO PASS EVERYTHING ELSE. It is banded, so it has real
    // content and a legal edge share; it has a filament, so it has a light
    // source; its mean and p90 sit inside the brightness window; part of it is
    // brighter than the figure's median. It is a perfectly reasonable-looking
    // background by every aggregate. It just happens to be painted in the
    // 49-59 band where the lifter's plate shades, singlet and knee sleeves
    // live, so his silhouette dissolves into it — and the rim floors are the
    // only thing that says so.
    // Twelve surfaces, every one of them between luma 41 and 73, banded in
    // ascending order so no band boundary is a hard edge, plus a chalk seam for
    // content and a filament for a light source. Fourteen indices — as many as
    // a real room — and an average value inside the window.
    const BANDS = [
      GYM.WOOD_DARK,
      GYM.LAMP_HOUSING,
      GYM.ACCENT_RED,
      GYM.WALL_MID,
      GYM.CROWD_MID,
      GYM.FLOOR_LIGHT,
      GYM.STRIPE_MID,
      GYM.ACCENT_BLUE,
      GYM.STEEL_FRAME,
      GYM.WALL_LIGHT,
      GYM.GLASS_DIM,
      GYM.ACCENT_YELLOW,
    ];
    const BAND_ROWS = 14;
    const SEAM_ROWS = 25;
    const grid = planted((g) => {
      for (let y = 0; y < g.h; y += 1) {
        const band = BANDS[Math.min(BANDS.length - 1, Math.floor(y / BAND_ROWS))] ?? BANDS[0] ?? 0;
        const seam = y % SEAM_ROWS === 0;
        for (let x = 0; x < g.w; x += 1) setPx(g, x, y, seam ? GYM.CHALK_DUST : band);
      }
      // A light source, so BRIGHT_SHARE has something to find.
      for (let y = 0; y < 2; y += 1) {
        for (let x = 0; x < 8; x += 1) setPx(g, x + 4, y + 1, GYM.LAMP_CORE);
      }
    });
    const bad = violations(grid);
    expect(bad.some((v) => v.startsWith('RIM_P05_LOW')), bad.join(' ')).toBe(true);
    expect(bad.some((v) => v.startsWith('RIM_P10_LOW')), bad.join(' ')).toBe(true);
    // ...and it passes the four aggregate floors and ceilings that catch the
    // blank screen and the blown-out one, which is what makes the rim bounds
    // load-bearing rather than redundant.
    for (const passed of [
      'INDEX_COUNT',
      'MEAN_LUMA',
      'P90_LUMA',
      'EDGE_SHARE',
      'BRIGHT_SHARE',
      'OVER_FIGURE_SHARE',
    ]) {
      expect(bad.some((v) => v.startsWith(passed)), `${passed} also fired: ${bad.join(' ')}`).toBe(
        false,
      );
    }
  });

  it('reports nothing at all for the shipped room, so a finding is the plant', () => {
    expect(violations(composite(0.5))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Parallax
// ---------------------------------------------------------------------------

describe('the layers are separate layers', () => {
  it('slides each at its own rate, and the wall slowest', () => {
    const cam = SPEC.w / 4;
    expect(layerOffset(cam, GYM_PARALLAX.WALL)).toBe(Math.round(-cam * GYM_PARALLAX.WALL));
    expect(Math.abs(layerOffset(cam, GYM_PARALLAX.WALL))).toBeLessThan(
      Math.abs(layerOffset(cam, GYM_PARALLAX.PROPS_FAR)),
    );
    expect(Math.abs(layerOffset(cam, GYM_PARALLAX.PROPS_FAR))).toBeLessThan(
      Math.abs(layerOffset(cam, GYM_PARALLAX.FLOOR)),
    );
    expect(Math.abs(layerOffset(cam, GYM_PARALLAX.FLOOR))).toBeLessThan(
      Math.abs(layerOffset(cam, GYM_PARALLAX.PROPS_NEAR)),
    );
  });

  it('moves a near prop further than a far one for the same camera', () => {
    const near: GymPropPlacement = { ART: 'CHALK_STAND', XF: 0.5, DEPTH: 0.9, DIM: false };
    const far: GymPropPlacement = { ...near, DEPTH: 0 };
    const cam = SPEC.w / 2;
    const moved: GymSceneSpec = { ...SPEC, cameraX: cam };
    const nearShift = propBox(moved, near).x0 - propBox(SPEC, near).x0;
    const farShift = propBox(moved, far).x0 - propBox(SPEC, far).x0;
    expect(Math.abs(nearShift)).toBeGreaterThan(Math.abs(farShift));
    expect(Math.sign(nearShift)).toBe(Math.sign(farShift));
  });

  it('still covers the grid when the camera has moved a long way', () => {
    for (const cameraX of [-SPEC.w * 2, -SPEC.w / 3, SPEC.w / 3, SPEC.w * 2]) {
      const g = renderGymScene({ ...SPEC, cameraX });
      for (let i = 0; i < g.data.length; i += 1) {
        expect(isTransparentIndex(g.data[i] ?? 0), `hole at camera ${cameraX}`).toBe(false);
      }
    }
  });

  it('is unexercised by the shipped stage, and says so', () => {
    // GDD §12.1: build the tunable version and say plainly what has not been
    // played. The daily session's stage is at camera 0 and always will be until
    // something pans it.
    expect(liftStageScene().cameraX).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Refusal conditions and purity
// ---------------------------------------------------------------------------

describe('what the room is not allowed to contain', () => {
  it('has a closed prop catalogue with no meter, gauge, dial or scoreboard', () => {
    // GDD §3.4 and §12.3 forbid a visible fatigue meter, and §12.3 is a refusal
    // condition. Pinned exactly, so scenery that displays a level cannot arrive
    // without an edit here.
    expect([...GYM_PROP_KINDS].sort()).toEqual(
      [
        'BUMPER_STACK',
        'CEILING_LAMP',
        'CHALK_STAND',
        'DUMBBELL_RACK',
        'EQUIPMENT_CASE',
        'FLAT_BENCH',
        'JUDGE_TABLE',
        'KETTLEBELL_ROW',
        'LOADED_BAR',
        'PLATE_TREE',
        'POWER_RACK',
      ].sort(),
    );
    for (const kind of GYM_PROP_KINDS) {
      expect(/METER|GAUGE|DIAL|BAR_GRAPH|SCOREBOARD|READINESS|FATIGUE/.test(kind)).toBe(false);
    }
  });

  it('takes no input from which a fatigue level could be drawn', () => {
    // Structural, not a promise. `GymSceneSpec` is a room, a size, a floor, a
    // focus column and a camera. Pinned so a sixth field is a visible edit.
    expect(Object.keys(SPEC).sort()).toEqual(
      ['cameraX', 'floorRow', 'focusX', 'h', 'venue', 'w'].sort(),
    );
  });

  it('is a pure renderer — no React, no randomness, no clock, no currency', () => {
    // Scanned through `codeOnly`, the audit's own stripper, so it reads CODE
    // and not prose. Without it this test fails on the sentence in
    // `gymScene.ts` that says there is no currency in it, which is the kind of
    // false positive that gets a check deleted rather than fixed.
    const files = [
      'gymScene.ts',
      'gymTuning.ts',
      'gymProps.ts',
      'gymPalette.ts',
      'gymReadability.ts',
    ];
    expect(files.length).toBeGreaterThan(4);
    for (const file of files) {
      const code = codeOnly(readFileSync(path.join(HERE, file), 'utf8'));
      expect(code.length, `${file} is empty`).toBeGreaterThan(500);
      for (const banned of [
        'react',
        'Math.random',
        'Date.now',
        'new Date',
        'localStorage',
        'fetch(',
        'require(',
        'currency',
        'gymBucks',
        'purchase',
        'advert',
        'fatigue',
        'readiness',
      ]) {
        expect(code.toLowerCase().includes(banned.toLowerCase()), `${file} uses ${banned}`).toBe(
          false,
        );
      }
    }
    // ...and the scan is not vacuous: the same stripper keeps real code.
    expect(codeOnly(readFileSync(path.join(HERE, 'gymScene.ts'), 'utf8'))).toContain(
      'renderGymScene',
    );
    expect(codeOnly('const a = 1; // Math.random()')).not.toContain('Math.random');
    expect(codeOnly('const a = Math.random();')).toContain('Math.random');
  });

  it('never lets the room out-value the lifter, at any moment of any rep', () => {
    // Cheap enough to run over the whole pose space rather than four samples.
    const room = renderGymScene(SPEC);
    const roomTop = Math.max(
      ...[...new Set<number>(room.data)].map((index) => lumaOfIndex(index) ?? 0),
    );
    expect(roomTop).toBeLessThan(lumaOfIndex(PAL.SKIN_HI) ?? 0);
    expect(roomTop).toBeGreaterThan(lumaOfIndex(GYM.WOOD_LIGHT) ?? 0);
  });
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

describe('the props are drawings that fit their own boxes', () => {
  it('keeps every rect inside the art box it declares', () => {
    for (const kind of GYM_PROP_KINDS) {
      const art = PROP_ART[kind];
      expect(art.W).toBeGreaterThan(0);
      expect(art.H).toBeGreaterThan(0);
      expect(art.RECTS.length).toBeGreaterThan(0);
      for (const [x, y, w, h] of art.RECTS) {
        expect(x, `${kind}`).toBeGreaterThanOrEqual(0);
        expect(y, `${kind}`).toBeGreaterThanOrEqual(0);
        expect(x + w, `${kind} overruns W`).toBeLessThanOrEqual(art.W);
        expect(y + h, `${kind} overruns H`).toBeLessThanOrEqual(art.H);
      }
    }
  });

  it('draws every prop in an allocated background colour', () => {
    for (const kind of GYM_PROP_KINDS) {
      for (const rect of PROP_ART[kind].RECTS) {
        const index = rect[4];
        expect(sceneColorAt(index), `${kind} uses index ${index}`).toBeDefined();
        expect(roleOf(index)).toBe('background');
      }
    }
  });

  it('lights every prop from the same side as the figure', () => {
    // SHADING.LIGHT_DIR.x is negative: the key is upper-LEFT. A prop whose lit
    // column is on its right flank is lit by a second, imaginary lamp.
    for (const kind of ['POWER_RACK', 'PLATE_TREE', 'DUMBBELL_RACK', 'CHALK_STAND'] as const) {
      const art = PROP_ART[kind];
      const lit = art.RECTS.filter((r) => r[4] === GYM.STEEL_LIT && r[2] === 1);
      expect(lit.length, `${kind} has no lit column`).toBeGreaterThan(0);
      for (const [x, y, , h] of lit) {
        const body = art.RECTS.find(
          (r) => r[4] === GYM.STEEL_FRAME && r[0] === x && r[1] === y && r[3] === h,
        );
        expect(body, `${kind} lit column at ${x} has no tube under it`).toBeDefined();
      }
    }
  });

  it('places every venue prop somewhere the scene can actually draw it', () => {
    for (const venue of ['training-gym', 'meet-platform'] as const satisfies readonly GymVenue[]) {
      const spec: GymSceneSpec = { ...SPEC, venue };
      for (const placement of GYM_VENUE_PROPS[venue]) {
        const box = propBox(spec, placement);
        expect(box.x1, `${placement.ART} is entirely off the left`).toBeGreaterThan(0);
        expect(box.x0, `${placement.ART} is entirely off the right`).toBeLessThan(spec.w);
        expect(box.y1, `${placement.ART} is above the frame`).toBeGreaterThan(0);
        expect(box.y0, `${placement.ART} is below the frame`).toBeLessThan(spec.h);
        expect(placement.DEPTH).toBeGreaterThanOrEqual(0);
        expect(placement.DEPTH).toBeLessThanOrEqual(1);
      }
    }
  });

  it('hangs the lamps evenly and inside the frame', () => {
    const g = renderGymScene(SPEC);
    let filament = 0;
    for (let i = 0; i < g.data.length; i += 1) if (g.data[i] === GYM.LAMP_CORE) filament += 1;
    expect(filament).toBeGreaterThanOrEqual(GYM_LIGHTING.LAMP_COUNT);
    // The filament is allowed to be bright because it is small. This is the
    // "small" half, as an area bound rather than a value one.
    expect(filament / (g.w * g.h)).toBeLessThan(0.005);
  });

  it('puts the windows above the figure, where their glass cannot hurt', () => {
    const band = clearBand(SPEC, RESOLUTION.LIFTER_HEIGHT_PX);
    const glassBottom = Math.round(junctionRow(SPEC) * GYM_WINDOWS.TOP_FRAC) + GYM_WINDOWS.H;
    expect(glassBottom).toBeLessThan(band.y0);
  });
});
