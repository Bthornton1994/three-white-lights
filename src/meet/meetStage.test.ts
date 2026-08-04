/**
 * WHICH ROOM THE MEET IS LIFTED IN.
 *
 * ===========================================================================
 * WHY THIS FILE EXISTS
 * ===========================================================================
 * `gymTuning.ts` has shipped a `'meet-platform'` venue — no block wall, thirty
 * rows of seated crowd, a sponsor banner, a judges' table instead of the
 * dumbbell rack — since the environment layer was built, and `gymScene.test.ts`
 * exercises it. For a while nothing rendered it: `LiftStage` named
 * `'training-gym'` itself, `AttemptView` drew `LiftStage`, and so every
 * competition attempt in the game happened in the training gym while the crowd
 * built for it went unused.
 *
 * That is not the kind of bug a unit test of `gymScene.ts` can catch, because
 * `gymScene.ts` was right. The wiring was wrong, and the wiring lives in two
 * `.tsx` files that the node-environment suite cannot render.
 *
 * ===========================================================================
 * SO THIS TEST READS THE COMPONENTS' SOURCE, AND SAYS SO
 * ===========================================================================
 * `resolveStageVenue` below parses the `<LiftStage …/>` element out of a
 * component's source and resolves the venue it hands over — either an explicit
 * `venue={…}` prop or, if the prop is absent, `LiftStage`'s own `DEFAULT_VENUE`
 * read from ITS source. Then the two resolved venues are rendered through the
 * real `renderGymScene` and compared as pixels.
 *
 * Source-reading is a weaker instrument than rendering and this file does not
 * pretend otherwise. What it buys is the property that actually failed before:
 * DELETE THE `venue` PROP FROM `AttemptView.tsx` AND THIS FILE GOES RED. A test
 * that only asserted `MEET_TUNING.VENUE === 'meet-platform'`, or only that the
 * two scene specs differ, would stay green through exactly that regression —
 * which is how the bug survived the last pass. The parser is deliberately
 * strict: an unrecognised expression throws rather than being skipped, so a
 * refactor that moves the prop somewhere this cannot see fails loudly instead
 * of quietly passing.
 *
 * The same claim is checked a second way, on real pixels rather than source, by
 * `tools/capture-meet.mjs`: it photographs the meet attempt and the session set
 * and reports the crowd's presence in each frame.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { GYM, lumaOfIndex } from '../art/gymPalette';
import { LOAD_PRESETS } from '../art/spriteTuning';
import { buildSquatRep } from '../art/squatAnimation';
import { frameSpecFrom, isBodyIndex, renderLifterFrame } from '../art/lifterSprite';
import { GYM_LIFT_STAGE } from '../art/gymTuning';
import { blitOver } from '../art/gymScene';
import { GYM_VENUE, GYM_VENUE_PROPS, type GymVenue } from '../art/gymTuning';
import { liftStageScene, renderGymScene } from '../art/gymScene';
import type { IndexGrid } from '../art/raster';
import { MEET_TUNING } from '../game/meetTuning';

const SRC = path.join(__dirname, '..');

const LIFT_STAGE = 'lift/LiftStage.tsx';
const MEET_ATTEMPT = 'meet/AttemptView.tsx';
const SESSION_SET = 'session/SetView.tsx';
const LIFT_HARNESS = 'lift/LiftScreen.tsx';

function read(relPath: string): string {
  return readFileSync(path.join(SRC, relPath), 'utf8');
}

// ---------------------------------------------------------------------------
// Reading the wiring out of the components
// ---------------------------------------------------------------------------

/** `LiftStage`'s own fallback, read from its source rather than assumed. */
export function defaultVenueIn(liftStageSource: string): GymVenue {
  const match = /const DEFAULT_VENUE: GymVenue = '([a-z-]+)'/.exec(liftStageSource);
  if (match === null || match[1] === undefined) {
    throw new Error('LiftStage.tsx no longer declares a DEFAULT_VENUE this test can read');
  }
  return match[1] as GymVenue;
}

/** The whole `<LiftStage … />` element, or null if the component draws none. */
export function liftStageElementIn(source: string): string | null {
  const open = source.indexOf('<LiftStage');
  if (open === -1) return null;
  const close = source.indexOf('/>', open);
  if (close === -1) throw new Error('<LiftStage> is not self-closing; this parser cannot read it');
  return source.slice(open, close + 2);
}

/**
 * The venue a component hands `LiftStage`.
 *
 * @throws when the component draws a `LiftStage` whose venue expression is not
 * one this parser understands. Throwing rather than returning the default is
 * the point: a silently-unreadable prop is the failure mode that let a meet be
 * lifted in a training gym.
 */
export function resolveStageVenue(source: string, liftStageSource: string): GymVenue | null {
  const element = liftStageElementIn(source);
  if (element === null) return null;
  const prop = /venue=\{([^}]+)\}/.exec(element);
  if (prop === null) return defaultVenueIn(liftStageSource);
  const expression = (prop[1] ?? '').trim();
  if (expression === 'MEET_TUNING.VENUE') return MEET_TUNING.VENUE;
  const literal = /^'([a-z-]+)'$/.exec(expression);
  if (literal !== null && literal[1] !== undefined) return literal[1] as GymVenue;
  throw new Error(`unreadable venue expression: ${expression}`);
}

// ---------------------------------------------------------------------------
// Pixels
// ---------------------------------------------------------------------------

/**
 * The room a screen draws for a venue.
 *
 * Built the way `LiftStage` builds it — `liftStageScene()` with the venue
 * overridden — rather than through a helper added to `gymScene.ts`, which
 * belongs to another piece. One box, two rooms.
 */
function roomFor(venue: GymVenue): IndexGrid {
  return renderGymScene({ ...liftStageScene(), venue });
}

function countOf(grid: IndexGrid, index: number): number {
  let n = 0;
  for (let i = 0; i < grid.data.length; i += 1) if (grid.data[i] === index) n += 1;
  return n;
}

function differingPixels(a: IndexGrid, b: IndexGrid): number {
  expect(a.data.length, 'the two rooms are not the same box').toBe(b.data.length);
  let n = 0;
  for (let i = 0; i < a.data.length; i += 1) if (a.data[i] !== b.data[i]) n += 1;
  return n;
}

/** Crowd pixels, both values of the seating ramp. */
function crowdPixels(grid: IndexGrid): number {
  return countOf(grid, GYM.CROWD_DARK) + countOf(grid, GYM.CROWD_MID);
}

// ---------------------------------------------------------------------------
// The parser can be wrong, and these say how
// ---------------------------------------------------------------------------

describe('the source parser this file depends on', () => {
  const liftStage = read(LIFT_STAGE);

  it('reads a venue prop, and reads the default when there is none', () => {
    const withProp = "  <LiftStage state={s} history={h} totalKg={k} venue={MEET_TUNING.VENUE} />\n";
    const without = '  <LiftStage state={s} history={h} totalKg={k} />\n';
    expect(resolveStageVenue(withProp, liftStage)).toBe(MEET_TUNING.VENUE);
    expect(resolveStageVenue(without, liftStage)).toBe(defaultVenueIn(liftStage));
  });

  it('reads a bare string literal too', () => {
    expect(resolveStageVenue("<LiftStage venue={'meet-platform'} />", liftStage)).toBe(
      'meet-platform',
    );
  });

  it('returns null for a component that draws no stage at all', () => {
    expect(resolveStageVenue('export function Nothing() { return null; }', liftStage)).toBeNull();
  });

  it('throws rather than guessing at an expression it cannot read', () => {
    expect(() => resolveStageVenue('<LiftStage venue={somethingElse} />', liftStage)).toThrow(
      /unreadable venue expression/,
    );
  });

  it('throws if LiftStage stops declaring a default it can find', () => {
    expect(() => defaultVenueIn('const DEFAULT_VENUE = whatever;')).toThrow(/DEFAULT_VENUE/);
  });

  it('finds a real <LiftStage> in every screen that draws one', () => {
    // Without this, every assertion below could pass vacuously on a file that
    // had been renamed out from under it.
    for (const relPath of [MEET_ATTEMPT, SESSION_SET, LIFT_HARNESS]) {
      expect(liftStageElementIn(read(relPath)), relPath).not.toBeNull();
    }
  });

  it('checks that LiftStage DRAWS the venue it is handed, not just takes it', () => {
    // THE HOLE THIS CLOSES. Everything else in this file reads the venue a
    // screen PASSES. A `LiftStage` that accepted the prop and then drew
    // `SCENES[DEFAULT_VENUE]` anyway would satisfy every one of those
    // assertions and put the meet back in the training gym — which is a
    // one-word edit away from the code as written.
    const source = liftStage;
    expect(source, 'LiftStage no longer looks the room up by venue').toContain('SCENES[venue]');
    expect(source, 'LiftStage draws a fixed room again').not.toContain('SCENES[DEFAULT_VENUE]');
    // ...and the room it looks up is the one it draws.
    expect(source).toMatch(/const scene = SCENES\[venue\];/);
    expect(source).toContain('<GymSceneLayer spec={scene} />');
  });
});

// ---------------------------------------------------------------------------
// THE CLAIM
// ---------------------------------------------------------------------------

describe('a meet attempt is not lifted in the training gym (GDD §6, §12.2)', () => {
  const liftStage = read(LIFT_STAGE);
  const meetVenue = resolveStageVenue(read(MEET_ATTEMPT), liftStage);
  const setVenue = resolveStageVenue(read(SESSION_SET), liftStage);

  it('hands the meet screen and the Sim set two different venues', () => {
    expect(meetVenue, 'AttemptView draws no LiftStage').not.toBeNull();
    expect(setVenue, 'SetView draws no LiftStage').not.toBeNull();
    expect(meetVenue).not.toBe(setVenue);
  });

  it('renders a materially different room for each, in pixels', () => {
    // THE ASSERTION THIS FILE IS FOR. Not "a venue constant exists" and not
    // "the two specs differ" — the two grids the screens actually draw.
    if (meetVenue === null || setVenue === null) throw new Error('no stage to compare');
    const meetRoom = roomFor(meetVenue);
    const gymRoom = roomFor(setVenue);
    const differing = differingPixels(meetRoom, gymRoom);

    // A room that differed in a handful of pixels would satisfy `not.toEqual`
    // and be the same room. A third of the background is the bound; the two
    // venues currently differ in about 44% of it.
    const THIRD = meetRoom.data.length / 3;
    expect(differing).toBeGreaterThan(THIRD);
  });

  it('puts a crowd behind the meet and none behind the Sim set', () => {
    if (meetVenue === null || setVenue === null) throw new Error('no stage to compare');
    const meetRoom = roomFor(meetVenue);
    const gymRoom = roomFor(setVenue);
    // The crowd is the thing GDD §6 is about: a competition is watched.
    expect(crowdPixels(meetRoom)).toBeGreaterThan(0);
    expect(crowdPixels(gymRoom)).toBe(0);
    // ...and the training gym's high windows are not in a meet hall.
    expect(countOf(gymRoom, GYM.GLASS_DIM)).toBeGreaterThan(0);
    expect(countOf(meetRoom, GYM.GLASS_DIM)).toBe(0);
  });

  it('furnishes the two rooms differently — no training kit on a platform', () => {
    if (meetVenue === null || setVenue === null) throw new Error('no stage to compare');
    const onPlatform = new Set(GYM_VENUE_PROPS[meetVenue].map((p) => p.ART));
    const inGym = new Set(GYM_VENUE_PROPS[setVenue].map((p) => p.ART));
    expect(onPlatform.has('JUDGE_TABLE')).toBe(true);
    expect(inGym.has('JUDGE_TABLE')).toBe(false);
    // The venue table's own switches agree with what was rendered above.
    expect(GYM_VENUE[meetVenue].CROWD).toBe(true);
    expect(GYM_VENUE[setVenue].CROWD).toBe(false);
    expect(GYM_VENUE[meetVenue].BLOCK_WALL).toBe(false);
    expect(GYM_VENUE[setVenue].BLOCK_WALL).toBe(true);
  });

  it('leaves every other screen in the training gym', () => {
    // The other direction, and the reason `venue` is opt-in rather than
    // required: a daily session must not acquire a crowd. `LiftScreen` is the
    // standalone mechanic harness and belongs in the gym too.
    expect(resolveStageVenue(read(SESSION_SET), liftStage)).toBe(defaultVenueIn(liftStage));
    expect(resolveStageVenue(read(LIFT_HARNESS), liftStage)).toBe(defaultVenueIn(liftStage));
    expect(defaultVenueIn(liftStage)).toBe('training-gym');
  });
});

// ---------------------------------------------------------------------------
// THE FIGURE AGAINST THE CROWD — a known, measured, UNCLOSED gap
// ---------------------------------------------------------------------------

/**
 * The lifter composited into a room, at three points in a maximal squat.
 *
 * This is the thing no shipped screen had ever drawn before this piece: the
 * readability suite passes on the meet venue because nothing was standing in
 * front of it.
 */
function crossingsAgainst(venue: GymVenue): {
  readonly total: number;
  readonly subPerceptual: number;
  readonly againstCrowd: number;
} {
  const rep = buildSquatRep(LOAD_PRESETS.MAXIMAL);
  const scene = renderGymScene({ ...liftStageScene(), venue });
  let total = 0;
  let subPerceptual = 0;
  let againstCrowd = 0;
  for (const frac of FRAMES_SAMPLED) {
    const at = Math.min(rep.frames.length - 1, Math.round((rep.frames.length - 1) * frac));
    const frame = rep.frames[at];
    if (frame === undefined) continue;
    const { grid } = renderLifterFrame(frameSpecFrom(frame, DEMO_TOTAL_KG));
    const comp = blitOver(scene, grid, GYM_LIFT_STAGE.SPRITE_X, GYM_LIFT_STAGE.SPRITE_Y);
    for (let y = 1; y < comp.h - 1; y += 1) {
      for (let x = 1; x < comp.w - 1; x += 1) {
        const inside = comp.data[y * comp.w + x] ?? 0;
        if (!isBodyIndex(inside)) continue;
        for (const { dx, dy } of NEIGHBOURS) {
          const outside = comp.data[(y + dy) * comp.w + (x + dx)] ?? 0;
          if (isBodyIndex(outside)) continue;
          total += 1;
          // `lumaOfIndex` is undefined for an index outside the scene banks.
          // Skipping rather than defaulting: a pixel whose colour cannot be
          // resolved is not evidence either way, and defaulting it to 0 would
          // silently count it as a maximal-contrast edge.
          const insideLuma = lumaOfIndex(inside);
          const outsideLuma = lumaOfIndex(outside);
          if (insideLuma === undefined || outsideLuma === undefined) continue;
          if (Math.abs(insideLuma - outsideLuma) > PERCEPTUAL_LUMA) continue;
          subPerceptual += 1;
          if (outside === GYM.CROWD_DARK || outside === GYM.CROWD_MID) againstCrowd += 1;
        }
      }
    }
  }
  return { total, subPerceptual, againstCrowd };
}

const FRAMES_SAMPLED: readonly number[] = [0, 0.5, 0.75];
const NEIGHBOURS: readonly { readonly dx: number; readonly dy: number }[] = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
];
/** Luma difference below which two adjacent pixels do not read as an edge. */
const PERCEPTUAL_LUMA = 12;
const DEMO_TOTAL_KG = 250;

describe('the lifter against the crowd — MEASURED, AND NOT FIXED IN THIS PIECE', () => {
  /**
   * WHAT THIS RECORDS, PLAINLY.
   *
   * The environment builder measured and wrote into `gymPalette.ts` that
   * `CROWD_MID` is the lifter's `HAIR_DARK` to one decimal place and
   * `CROWD_DARK` is 1.0 luma from his `OUTLINE`, that no other pair in the
   * safe rgb5 window improves it, and that "the actual fix is geometric".
   * Nothing had ever composited the two, because no shipped screen drew the
   * meet venue. This piece is what made it shipped, so this is the first
   * measurement of the pair, and it agrees with the warning:
   *
   *   training gym    62 / 874 silhouette crossings sub-perceptual (7.1%)
   *   meet platform  176 / 874 (20.1%), of which 114 are against the crowd,
   *                  worst separation 1.0 luma
   *
   * WHY IT IS NOT FIXED HERE. The crowd is anchored to the wall/floor junction
   * and painted upward, and the junction row (119) sits INSIDE the figure's
   * vertical span (103-165) — so his head and neck are always in front of the
   * band's top rows. Shrinking `CROWD_ROWS` was swept from 30 down to 0: it
   * moves the count (30 -> 176, 24 -> 113, 12 -> 92, 4 -> 62) but not the worst
   * case, it is non-monotonic because it depends on where a head row lands, and
   * at 0 there is no crowd, which is the whole reason the venue exists. The
   * real fix needs `paintCrowd` to take a bottom offset so the seating clears
   * the figure's span — and `gymScene.ts` belongs to another piece of this run.
   *
   * So this test does not assert the gap away. It PINS THE CEILING, so the
   * composite cannot quietly get worse while somebody else fixes it.
   */
  it('records how much worse the meet room is for the silhouette', () => {
    const gym = crossingsAgainst('training-gym');
    const meet = crossingsAgainst('meet-platform');

    // The measurement is real: there are crossings to measure at all.
    expect(gym.total).toBeGreaterThan(500);
    expect(meet.total).toBe(gym.total);

    // The training gym has no crowd, so none of its bad crossings are against
    // one. That is the control for the count below.
    expect(gym.againstCrowd).toBe(0);

    // THE GAP, stated as a fact rather than asserted away.
    expect(meet.subPerceptual).toBeGreaterThan(gym.subPerceptual);
    expect(meet.againstCrowd).toBeGreaterThan(0);

    // THE CEILING. A regression that made the crowd worse — a wider band, a
    // lighter figure, a new pose — fails here. Set just above the measured
    // value rather than at a round number, so it has to be re-read to be moved.
    const share = meet.subPerceptual / meet.total;
    expect(share, `meet room sub-perceptual share ${(share * 100).toFixed(1)}%`).toBeLessThan(0.22);
  });
});
