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

import { GYM } from '../art/gymPalette';
import { GYM_VENUE, GYM_VENUE_PROPS, type GymVenue } from '../art/gymTuning';
import { renderGymScene, stageSceneFor } from '../art/gymScene';
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

function roomFor(venue: GymVenue): IndexGrid {
  return renderGymScene(stageSceneFor(venue));
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
