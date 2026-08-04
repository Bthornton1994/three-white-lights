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
 * ===========================================================================
 * AND IT NOW COVERS EVERY BEAT, WHICH IS THE SECOND BUG THIS FILE MISSED
 * ===========================================================================
 * Every assertion above was scoped to `AttemptView`. So the room reached exactly
 * one of meet day's screens and this file said so approvingly: the walk-out, the
 * wait for the lights, the lights themselves and the one-way choice after a miss
 * were flat text on near-black, and a suite whose statement of "which building
 * meet day happens in" covers one screen cannot see a roomless reference beat.
 *
 * `STAGED_BEATS` and `UNSTAGED_BEATS` below are the whole router, one test each,
 * and a third test checks the two lists against `MeetScreen`'s own JSX so a view
 * cannot be added to the router and left out of both.
 *
 * The same claim is checked a second way, on real pixels rather than source, by
 * `tools/capture-meet.mjs`: it photographs every beat and reports the crowd's
 * presence in each frame.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { GYM, lumaOfIndex } from '../art/gymPalette';
import { LOAD_PRESETS } from '../art/spriteTuning';
import { buildSquatRep } from '../art/squatAnimation';
import { frameSpecFrom, isBodyIndex, renderLifterFrame } from '../art/lifterSprite';
import { GYM_CROWD, GYM_LIFT_STAGE } from '../art/gymTuning';
import { blitOver, crowdFrontRow } from '../art/gymScene';
import { GYM_VENUE, GYM_VENUE_PROPS, type GymVenue } from '../art/gymTuning';
import { liftStageScene, renderGymScene } from '../art/gymScene';
import type { IndexGrid } from '../art/raster';
import { codeOnly } from '../tuning/audit';
import { LIFT_TUNING } from '../game/liftTuning';
import { MEET_TUNING } from '../game/meetTuning';
import { MEET_HALL_SCENE } from './meetHall';

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
// EVERY BEAT, NOT ONE
//
// The scope of this file used to be `AttemptView` alone. That is exactly why a
// roomless walk-out, a roomless deliberation and a roomless verdict were
// invisible to it: the suite's own statement of "which building meet day happens
// in" covered the one screen where the player is pressing the screen and
// watching a cue ring, and every beat that is ABOUT dread was text on a void.
// ---------------------------------------------------------------------------

/** Every beat of meet day that is staged, and the file that stages it. */
const STAGED_BEATS: readonly { readonly beat: string; readonly file: string }[] = [
  { beat: 'walkout', file: 'meet/WalkoutView.tsx' },
  { beat: 'the rep', file: MEET_ATTEMPT },
  { beat: 'deliberation and verdict', file: 'meet/VerdictView.tsx' },
  { beat: 'attempt-select', file: 'meet/AttemptSelectView.tsx' },
];

/**
 * Beats that are deliberately NOT staged, with the reason, so the list above
 * cannot quietly shrink and call itself complete.
 *
 * These are asserted to draw no room at all. If one of them acquires a hall,
 * this test goes red and somebody has to move it into `STAGED_BEATS` and say
 * why — which is the same discipline the staged list is under.
 */
const UNSTAGED_BEATS: readonly { readonly beat: string; readonly file: string; readonly why: string }[] = [
  {
    beat: 'weigh-in',
    file: 'meet/WeighInView.tsx',
    why: 'GDD §6.1 pre-meet paperwork, in a back room hours before the platform.',
  },
  {
    beat: 'openers',
    file: 'meet/OpenersView.tsx',
    why: 'Also §6.1, and also not on the platform: this is a form handed to the table.',
  },
  {
    beat: 'bomb-out',
    file: 'meet/BombOutView.tsx',
    why: 'GDD §6.3 asks for somber and non-punitive. The hall has emptied; the empty field IS the beat.',
  },
  {
    beat: 'recap',
    file: 'meet/RecapView.tsx',
    why: 'GDD §6.5 is a results sheet, read after the meet, not a moment in it.',
  },
];

/**
 * Which room a screen draws, whether it draws it through `LiftStage` (the rep)
 * or through `MeetHallView` (every other staged beat).
 *
 * @throws when a screen draws a hall this parser cannot resolve, for the same
 * reason `resolveStageVenue` throws: a silently-unreadable room is the failure
 * mode that let a meet be lifted in a training gym.
 */
export function resolveBeatVenue(source: string, liftStageSource: string): GymVenue | null {
  const staged = resolveStageVenue(source, liftStageSource);
  if (staged !== null) return staged;
  if (!source.includes('<MeetHallView')) return null;
  // `MeetHallView` takes no venue: it IS the meet hall, and the room it draws is
  // `MEET_HALL_SCENE`, built from `MEET_TUNING.VENUE`. A screen cannot ask it
  // for the training gym, which is the point.
  return MEET_HALL_SCENE.venue;
}

describe('every beat of meet day happens somewhere (GDD §12.2)', () => {
  const liftStage = read(LIFT_STAGE);

  it('the beat parser reads a MeetHallView, and still reads a LiftStage', () => {
    // The positive control for the resolver below. Without it, a resolver that
    // returned the meet venue for everything would pass every beat.
    expect(resolveBeatVenue('  <MeetHallView lifter={null} scrim={x} />', liftStage)).toBe(
      MEET_HALL_SCENE.venue,
    );
    expect(resolveBeatVenue('<LiftStage state={s} history={h} totalKg={k} />', liftStage)).toBe(
      defaultVenueIn(liftStage),
    );
    expect(resolveBeatVenue('export function Nothing() { return null; }', liftStage)).toBeNull();
  });

  it('the hall MeetHallView draws is the meet platform, not the gym', () => {
    expect(MEET_HALL_SCENE.venue).toBe(MEET_TUNING.VENUE);
    expect(MEET_HALL_SCENE.venue).not.toBe(defaultVenueIn(liftStage));
    // ...and it is the SAME BOX as the rep's, so the player does not walk into a
    // differently-proportioned building between the walkout and the attempt.
    const rep = liftStageScene();
    expect(MEET_HALL_SCENE.w).toBe(rep.w);
    expect(MEET_HALL_SCENE.h).toBe(rep.h);
    expect(MEET_HALL_SCENE.floorRow).toBe(rep.floorRow);
    expect(MEET_HALL_SCENE.focusX).toBe(rep.focusX);
    expect(MEET_HALL_SCENE.cameraX).toBe(rep.cameraX);
  });

  // ONE TEST PER BEAT, deliberately. A single loop inside one `it` would report
  // "meetStage.test.ts failed" for any of them; this way, deleting the hall from
  // `WalkoutView.tsx` reddens a test with the word "walkout" in its name and
  // nothing else.
  for (const { beat, file } of STAGED_BEATS) {
    it(`stages the ${beat} beat in the meet hall`, () => {
      const source = read(file);
      const venue = resolveBeatVenue(source, liftStage);
      expect(venue, `${file} draws no room at all`).not.toBeNull();
      expect(venue, `${file} draws the wrong room`).toBe(MEET_TUNING.VENUE);
      // ...and the room that resolves to really is a hall with people in it,
      // measured on pixels rather than taken from the name.
      if (venue === null) throw new Error('unreachable');
      expect(crowdPixels(roomFor(venue))).toBeGreaterThan(0);
    });
  }

  for (const { beat, file, why } of UNSTAGED_BEATS) {
    it(`deliberately leaves the ${beat} beat unstaged`, () => {
      expect(resolveBeatVenue(read(file), liftStage), why).toBeNull();
    });
  }

  it('covers every screen the router can reach, staged or not', () => {
    // THE HOLE THIS CLOSES, and it is the hole that let the last pass through: a
    // per-beat list is only as good as its coverage. `MeetScreen` routes to a
    // fixed set of views; every one of them is in exactly one list above, and a
    // ninth view added to the router with no entry fails here.
    const router = read('meet/MeetScreen.tsx');
    const rendered = [...router.matchAll(/<([A-Z][A-Za-z]*View)\b/g)].map((m) => m[1]);
    const listed = new Set(
      [...STAGED_BEATS, ...UNSTAGED_BEATS].map((entry) => {
        const name = entry.file.split('/').pop() ?? '';
        return name.replace('.tsx', '');
      }),
    );
    expect(rendered.length, 'MeetScreen renders no views this scan can see').toBeGreaterThan(0);
    for (const name of new Set(rendered)) {
      expect(listed.has(name ?? ''), `${name ?? '?'} is in neither the staged nor the unstaged list`).toBe(true);
    }
    expect(listed.size).toBe(STAGED_BEATS.length + UNSTAGED_BEATS.length);
  });

  it('draws the hall nearest-neighbour at an integer scale (GDD §7.1)', () => {
    // The rule that the old walkout broke: it drew its barbell as anti-aliased
    // vector rectangles two seconds before the player squatted a pixel bar.
    const hall = read('meet/MeetHallView.tsx');
    // Both images — the room and the figure — pin the filter and the mipmap.
    const nearest = hall.split('filter: FilterMode.Nearest, mipmap: MipmapMode.None').length - 1;
    expect(nearest, 'a MeetHallView image samples with something other than Nearest').toBe(2);
    // ...and neither of them is sized by a number of its own: they take the
    // sprite's box, whose scale `gymScene.test.ts` proves is an integer shared
    // with the room's.
    expect(hall).toContain('width={SPRITE_BOX.w}');
    expect(hall).toContain('height={SPRITE_BOX.h}');
    expect(Number.isInteger(LIFT_TUNING.FEEDBACK.SPRITE_SCALE)).toBe(true);
  });

  it('draws the walkout bar through the SPRITE, not out of Views', () => {
    // THE OTHER HALF OF §7.1, and the mutation for it. The old walkout built its
    // barbell from `Animated.View`s with `backgroundColor`, `borderColor` and
    // `borderRadius`. Those are the three properties that make a vector
    // rectangle, and none of them may appear in this file again.
    //
    // COMMENTS ARE STRIPPED FIRST. This file's own header names all three
    // properties while explaining why they are gone, and a scan that matched
    // them there would be unpassable — which is a check nobody could ever
    // satisfy, the mirror image of one nobody could ever fail.
    const walkout = codeOnly(read('meet/WalkoutView.tsx'));
    for (const banned of ['borderRadius', 'borderColor', 'borderWidth']) {
      expect(walkout, `WalkoutView draws a bar with ${banned}`).not.toContain(banned);
    }
    expect(walkout, 'WalkoutView still builds its own plate rectangles').not.toContain('plateStackFor');
    // Non-vacuity for the stripper: it does still see the code around them.
    expect(walkout).toContain('MeetHallView');
    expect(codeOnly('// borderRadius: 3,\nconst a = 1;')).not.toContain('borderRadius');
    // ...and it hands the hall a plate count, so the bar LOADS rather than
    // appearing. Deleting the prop leaves a bar that is loaded from the first
    // frame, and this line goes red.
    expect(walkout).toContain('platesLoaded');
  });
});

// ---------------------------------------------------------------------------
// THE FIGURE AGAINST THE CROWD — measured before, measured after, CLOSED
// ---------------------------------------------------------------------------

/**
 * The lifter composited into a room, at three points in a maximal squat.
 *
 * This is the thing no shipped screen had ever drawn before this piece: the
 * readability suite passed on the meet venue because nothing was standing in
 * front of it.
 */
interface Crossings {
  readonly total: number;
  readonly subPerceptual: number;
  readonly againstCrowd: number;
}

function crossingsAgainst(venue: GymVenue): Crossings {
  return crossingsOnto(renderGymScene({ ...liftStageScene(), venue }));
}

function crossingsOnto(scene: IndexGrid): Crossings {
  const rep = buildSquatRep(LOAD_PRESETS.MAXIMAL);
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

describe('the lifter against the crowd — MEASURED BEFORE AND AFTER', () => {
  /**
   * WHAT THIS RECORDS, PLAINLY, INCLUDING WHAT IT USED TO SAY.
   *
   * The environment builder measured and wrote into `gymPalette.ts` that
   * `CROWD_MID` is the lifter's `HAIR_DARK` to one decimal place and
   * `CROWD_DARK` is 1.0 luma from his `OUTLINE`, that no other pair in the safe
   * rgb5 window improves it, and that "the actual fix is geometric — the crowd's
   * seating sitting below his crown rather than behind it". This test's previous
   * revision measured exactly that and then declined to fix it, on the grounds
   * that `gymScene.ts` belonged to another piece:
   *
   *   training gym    80 / 874 silhouette crossings sub-perceptual
   *   meet platform  176 / 874, of which 114 were against the crowd,
   *                  worst separation 1.03 luma
   *
   * The fix has now been made, in `GYM_CROWD.RISER_ROWS`: the seating band stops
   * twenty rows above the wall/floor junction, on a barrier, so what is behind
   * the lifter's head is `WALL_MID` — the one value in the wall bank chosen to
   * sit inside the safe window in his own ramp, and the value the training gym
   * has always put there. Re-measured on the same instrument:
   *
   *   training gym    80 / 874   (unchanged; nothing about the gym moved)
   *   meet platform   62 / 874, of which 0 are against the crowd
   *
   * The meet room is now BETTER for the silhouette than the training gym, which
   * is what a room with no texture behind the figure should be. `gymScene.test.ts`
   * carries the same result on its own instrument — `rimDeadShare` 0.00% against
   * a known-fail of 1.96% — and plants the old geometry to show the bound bites.
   */
  it('leaves no sub-perceptual crossing against the crowd at all', () => {
    const gym = crossingsAgainst('training-gym');
    const meet = crossingsAgainst('meet-platform');

    // The measurement is real: there are crossings to measure at all.
    expect(gym.total).toBeGreaterThan(500);
    expect(meet.total).toBe(gym.total);

    // The training gym has no crowd, so none of its bad crossings are against
    // one. That is the control for the count below — if `againstCrowd` were
    // broken, both numbers would be 0 and the meet assertion would pass
    // vacuously, so the meet room's own crowd is counted separately.
    expect(gym.againstCrowd).toBe(0);
    expect(crowdPixels(roomFor('meet-platform'))).toBeGreaterThan(0);

    // THE CLAIM. Not "fewer than before" — none.
    expect(meet.againstCrowd, 'the seating is back behind the lifter').toBe(0);

    // ...and the room as a whole is no worse for the figure than the gym is.
    expect(meet.subPerceptual).toBeLessThanOrEqual(gym.subPerceptual);
  });

  it('is a property of the SEATING, shown by putting it back on the floor', () => {
    // THE MUTATION. `RISER_ROWS` is frozen and `GymSceneSpec` has no field for
    // it, so the plant moves the band's pixels back down by exactly that many
    // rows — which is the room `paintCrowd` drew before this pass — and shows
    // the crossings come back. Without this, "0 against the crowd" could be a
    // broken counter rather than a fixed room.
    const scene = renderGymScene({ ...liftStageScene(), venue: 'meet-platform' });
    const bottom = crowdFrontRow({ ...liftStageScene(), venue: 'meet-platform' });
    const top = Math.max(0, bottom - GYM_VENUE['meet-platform'].CROWD_ROWS);
    const lowered = renderGymScene({ ...liftStageScene(), venue: 'meet-platform' });
    for (let y = bottom - 1; y >= top; y -= 1) {
      for (let x = 0; x < lowered.w; x += 1) {
        const from = scene.data[y * scene.w + x] ?? 0;
        lowered.data[(y + GYM_CROWD.RISER_ROWS) * lowered.w + x] = from;
      }
    }
    const before = crossingsOnto(lowered);
    expect(before.againstCrowd, 'lowering the seating changed nothing').toBeGreaterThan(0);
    expect(before.subPerceptual).toBeGreaterThan(crossingsAgainst('meet-platform').subPerceptual);
  });
});
