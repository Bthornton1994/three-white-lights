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

import { previewStateFor } from '../game/meetPreview';
import { isUrgentAttempt, lastAttempt } from '../game/meetDay';
import { cheerCrowdRise } from './walkout';

import { GYM, lumaOfIndex } from '../art/gymPalette';
import { LOAD_PRESETS } from '../art/spriteTuning';
import { buildSquatRep } from '../art/squatAnimation';
import { frameSpecFrom, isBodyIndex, renderLifterFrame } from '../art/lifterSprite';
import { GYM_CONTACT_SHADOW, GYM_CROWD, GYM_LIFT_STAGE } from '../art/gymTuning';
import {
  blitOver,
  contactShadowPatch,
  crowdFrontRow,
  liftContactShadow,
} from '../art/gymScene';
import { BAR_AND_COLLARS_KG } from '../art/plates';
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
    //
    // READ OFF `codeOnly` AND PINNED AS A COUNT, which the first version was
    // not. It scanned the raw file, and `LiftStage.tsx`'s own header now
    // discusses `SCENES[venue]` in prose — so a `toContain` on the raw source
    // would have a second witness in a comment and would survive the mutation
    // outright. This is the shape CLAUDE.md records as "a textual pin whose
    // pattern has more than one witness in the file".
    const source = codeOnly(liftStage);
    expect(
      source.split('SCENES[venue]').length - 1,
      'LiftStage no longer looks the room up by venue, exactly once',
    ).toBe(1);
    expect(source, 'LiftStage draws a fixed room again').not.toContain('SCENES[DEFAULT_VENUE]');
    // ...and the room it looks up is the one it draws.
    expect(source).toMatch(/const seated = SCENES\[venue\];/);
    expect(source).toContain('<GymSceneLayer spec={scene} />');
    // ...and `scene` IS that room, with the crowd's rise composed onto it and
    // nothing else. Without this the prop could be accepted, memoised and
    // dropped, which is the same failure one field in.
    expect(source, 'LiftStage takes a crowd rise and draws a seated hall anyway').toMatch(
      /crowdRisePx <= 0 \? seated : \{ \.\.\.seated, crowdRisePx \}/,
    );
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
  // The 'recap placeholder' row was deleted with the placeholder, as its own
  // `why` instructed (Sprint 1c: the calendar refuses a re-entry before a meet
  // opens, and a refusal that still lands is disclosed as one text line inside
  // MeetScreen's refused arm — no view file, no room, no row).
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
  if (meetHallElementIn(source) === null) return null;
  // `MeetHallView` takes no venue: it IS the meet hall, and the room it draws is
  // `MEET_HALL_SCENE`, built from `MEET_TUNING.VENUE`. A screen cannot ask it
  // for the training gym, which is the point.
  return MEET_HALL_SCENE.venue;
}

/**
 * The whole `<MeetHallView … />` element, or null if the component draws none.
 *
 * A SEPARATE PARSER FROM `resolveBeatVenue`'s `includes`, and it exists because
 * of a check that did not fail. "The walkout hands the hall a plate count" was
 * asserted as `source.toContain('platesLoaded')` — which the `useState` line
 * satisfies on its own, so deleting the PROP left the bar fully loaded from the
 * first frame and the suite stayed green. Reading the element is what makes the
 * difference between the state existing and the state being handed over.
 */
export function meetHallElementIn(source: string): string | null {
  const open = source.indexOf('<MeetHallView');
  if (open === -1) return null;
  const close = source.indexOf('/>', open);
  if (close === -1) {
    throw new Error('<MeetHallView> is not self-closing; this parser cannot read it');
  }
  return source.slice(open, close + 2);
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

    // ...and it HANDS THE HALL a plate count, so the bar loads rather than
    // appearing already loaded.
    //
    // READ OFF THE ELEMENT, NOT THE FILE, and that is a correction rather than a
    // flourish: written as `expect(source).toContain('platesLoaded')` this check
    // could not fail, because the `useState` line contains the word. Deleting
    // the prop was measured and the suite stayed green.
    const element = meetHallElementIn(read('meet/WalkoutView.tsx'));
    expect(element, 'WalkoutView draws no MeetHallView').not.toBeNull();
    expect(element ?? '', 'the walkout hands the hall no plate count').toContain('platesLoaded');
    // ...and it hands over the STATE, not the finished total. `platesLoaded:
    // plateCount` names the prop and defeats the beat: the bar would be fully
    // loaded on the first frame with the word still in the file. The shorthand
    // form is what distinguishes them.
    //
    // COUPLED TO A FORMATTING CHOICE, and stated rather than hidden: a rewrite to
    // `platesLoaded={platesLoaded}` fails this and is not wrong. It earns the
    // coupling because the alternative is a check that cannot fail, which this
    // file has now shipped once.
    expect(element ?? '', 'the walkout hands the hall a fixed count').toMatch(
      /\bplatesLoaded\s*[,}]/,
    );
  });

  it('hands the hall a WALK-OUT, and brings the hall up on the beats that ask', () => {
    // THE HOLE THIS CLOSES, and it is the same hole the plate count sat in. The
    // whole of `walkout.test.ts` measures the SHEET on real pixels, and every
    // one of its assertions stays green if `WalkoutView` stops handing the sheet
    // over and `MeetHallView` goes back to drawing one still. That regression is
    // three deleted words away, and it is the exact shape of the bug this file
    // exists for.
    //
    // READ OFF THE ELEMENTS, not off the files, for the reason the plate-count
    // check records: `expect(source).toContain('pose')` is satisfied by the
    // `const pose =` line on its own.
    const walkout = meetHallElementIn(read('meet/WalkoutView.tsx'));
    expect(walkout, 'WalkoutView draws no MeetHallView').not.toBeNull();
    expect(walkout ?? '', 'the walkout hands the hall no pose').toMatch(/\bpose\s*[,}]/);
    expect(walkout ?? '', 'the walkout never brings the hall up').toContain(
      'crowdRisePx={pose.crowdRisePx}',
    );

    // ...and the verdict brings it up too, which is the crowd's other moment —
    // GATED ON A GOOD LIFT AND ON THE LIGHTS BEING OUT. A hall that reacted
    // either way would be reacting to nothing, and one that reacted during the
    // deliberation would announce the verdict before the referees did, which is
    // the property the top of `VerdictView.tsx` is entirely about.
    const verdictSource = codeOnly(read('meet/VerdictView.tsx'));
    const verdict = meetHallElementIn(read('meet/VerdictView.tsx'));
    expect(verdict ?? '', 'the verdict never brings the hall up').toContain('crowdRisePx=');
    expect(verdictSource, 'the hall reacts whether or not the lift stood').toMatch(
      /const cheering = revealed && good;/,
    );
    expect(verdictSource, 'the reaction is not gated on the call at all').toMatch(
      /cheering\s*\?[\s\S]{0,120}:\s*0/,
    );

    // AND THE HALL ACTUALLY USES BOTH. A `MeetHallView` that accepted `pose` and
    // `crowdRisePx` and then drew `hallLifterFrame` over `MEET_HALL_SCENE`
    // anyway would satisfy everything above — the same failure the
    // `SCENES[venue]` check above exists for.
    const hall = codeOnly(read('meet/MeetHallView.tsx'));
    expect(hall, 'MeetHallView ignores the pose it is handed').toContain('walkoutLifterFrame(pose');
    expect(hall, 'MeetHallView draws a fixed room again').toContain('hallScene(crowdRisePx)');
    expect(hall, 'MeetHallView ignores where the walk-out puts him').toContain('pose?.bodyDxPx');
    expect(hall, 'MeetHallView pins itself to one room').not.toContain(
      'spec={MEET_HALL_SCENE}',
    );

    // AND THE CLOCK IS REAL. `useHallStep` is what turns elapsed time into a
    // frame index; a `WalkoutView` that sampled a constant instead would hold
    // the beat on its first drawing with every test in `walkout.test.ts` still
    // green.
    //
    // A SOURCE CHECK, AND WEAKER THAN THE PIXEL WORK ABOVE. This suite runs in a
    // node environment with no renderer, so it cannot mount the component and
    // watch the clock advance. The instrument that can is
    // `tools/capture-meet.mjs`, which photographs the LIVE walk-out at two
    // instants and fails when the hall is the same picture in both.
    const view = codeOnly(read('meet/WalkoutView.tsx'));
    expect(view, 'WalkoutView runs no clock').toContain('useHallStep(sampleFrame');
    expect(view, 'the walkout sampler ignores elapsed time').toMatch(
      /walkoutFrameIndexAt\(sequence,\s*elapsedMs\)/,
    );
    const clock = codeOnly(read('meet/useHallStep.ts'));
    expect(clock, 'the hall clock never asks for a frame').toContain('requestAnimationFrame');
    expect(clock, 'the hall clock does not measure elapsed time').toContain('now - start');
    expect(clock, 'the hall clock never samples the elapsed time it measured').toContain(
      'sampleAt(elapsed)',
    );
  });

  it('runs the walk-out clock for the whole BEAT, not for the end of the motion', () => {
    // THE ONE ARGUMENT THAT WAS THE DEFECT. `useHallStep` cancels its frame loop
    // once `runForMs` has elapsed, and `WalkoutView` passed `sequence.motionMs`
    // — the end of the CHOREOGRAPHY. On a third attempt with nothing banked that
    // is 2,120 ms of a 4,100 ms beat, so 48% of the beat, and every millisecond
    // of the third-attempt and bomb-risk escalation, was a frozen raster.
    //
    // The pure half of this claim is measured on pixels in `walkout.test.ts`.
    // What is here is the WIRING, which no pure test can see: the sheet can be
    // as alive as it likes if the component stops sampling it.
    const view = codeOnly(read('meet/WalkoutView.tsx'));
    expect(view, 'the walk-out clock stops at the end of the motion again').toMatch(
      /useHallStep\(\s*sampleFrame,\s*sequence\.beatMs\s*,/,
    );
    // THE BEAT LENGTH MOVED BEHIND `walkoutRequestFor`, and the claim followed
    // it rather than being dropped: the screen has to route through the shared
    // constructor, and the constructor has to put the attempt's own beat in it.
    // Split in two because the two halves fail for different reasons — a screen
    // that stops asking, and a constructor that stops carrying.
    expect(view, 'the walk-out builds its sheet from something other than the attempt').toMatch(
      /buildWalkout\(walkoutRequestFor\(attempt,\s*barAndCollarsKg,\s*loadRatio\)\)/,
    );
    const sheetModule = codeOnly(read('meet/walkout.ts'));
    expect(sheetModule, 'the sheet is built without the beat it has to fill').toMatch(
      /beatMs:\s*attempt\.walkoutMs,/,
    );
    // ...and `useHallStep` really does stop at `runForMs`, which is what makes
    // the argument load-bearing rather than decorative.
    const clock = codeOnly(read('meet/useHallStep.ts'));
    expect(clock, 'the hall clock ignores runForMs, so the argument means nothing')
      .toContain('elapsed < runForMs');
  });

  it('carries the hall the walk-out left standing into the rep, rather than reseating it', () => {
    // THE DEFECT THIS CLOSES, AND IT LIVED ENTIRELY IN THE WIRING. Every pure
    // assertion in `walkout.test.ts` about the tail's crowd ramp was green while
    // `AttemptView` handed `LiftStage` no rise at all — `gymScene.ts` reads
    // `spec.crowdRisePx ?? 0`, so the rep drew a seated hall and 1,633 scene
    // pixels of the escalation vanished on the frame the bar started moving.
    // Nothing in a node environment could see it, because the two rooms are
    // built by two components neither of which this suite can mount.
    //
    // READ OFF THE `<LiftStage>` ELEMENT rather than off the file, for the
    // reason the plate-count check records: a `toContain` on the source is
    // satisfied by the `const crowdRisePx =` line on its own.
    const element = liftStageElementIn(read(MEET_ATTEMPT));
    expect(element, 'AttemptView draws no LiftStage').not.toBeNull();
    expect(element ?? '', 'the attempt hands the stage no crowd rise').toContain(
      'crowdRisePx={crowdRisePx}',
    );

    // ...AND THE NUMBER IS THE WALK-OUT'S OWN, not a constant this screen picked.
    // `settledCrowdRisePx` reads the sheet's last drawn frame; a screen that
    // reached for `HUSH_CROWD_RISE_PX` directly would be right at the shipped
    // tuning and wrong the moment a tail falls under `MIN_BRACE_WINDOW_MS`.
    const attempt = codeOnly(read(MEET_ATTEMPT));
    expect(attempt, 'the attempt derives the hall’s height itself').toMatch(
      /settledCrowdRisePx\(walkoutRequestFor\(live,\s*barAndCollarsKg,\s*live\.loadRatio\)\)/,
    );
    expect(attempt, 'the attempt reaches for a tuning constant instead of the sheet').not.toContain(
      'HUSH_CROWD_RISE_PX',
    );

    // ...AND BOTH SCREENS ASK THE SAME CONSTRUCTOR. Two requests assembled
    // separately are two beats that can disagree about which one they are either
    // side of, which is this defect one level in.
    const walkout = codeOnly(read('meet/WalkoutView.tsx'));
    for (const [name, source] of [
      ['AttemptView', attempt],
      ['WalkoutView', walkout],
    ] as const) {
      expect(
        source.split('walkoutRequestFor(').length - 1,
        `${name} does not build its beat through walkoutRequestFor, exactly once`,
      ).toBe(1);
    }
    // ...and neither of them spells out what `urgent` MEANS. `meetDay.ts` owns
    // that word. `WalkoutView` used to carry its own copy of the disjunction —
    // which decides its copy, its haptic, its crowd AND, now, the room the rep
    // after it is drawn in, so a drifting second definition would put the two
    // sides of the cut in two different halls.
    //
    // ASSERTED ON THE `urgent` BINDING SPECIFICALLY, not by banning the words:
    // `WalkoutView` legitimately still tests `attemptNumber === ATTEMPTS_PER_LIFT`
    // one line above, to pick between "LAST ONE" and "WALK IT OUT". A ban on the
    // phrase would fire on that and be deleted.
    expect(walkout, 'WalkoutView keeps its own definition of an urgent attempt').toMatch(
      /const urgent = isUrgentAttempt\(attempt\);/,
    );
    const sheetSource = codeOnly(read('meet/walkout.ts'));
    expect(
      sheetSource.split('urgent: isUrgentAttempt(attempt)').length - 1,
      'walkoutRequestFor decides urgency itself instead of asking meetDay.ts',
    ).toBe(1);

    // AND THE ROUTER SUPPLIES THE BAR WEIGHT, from the same expression the
    // walk-out beside it gets. Without it `AttemptView` would have to call
    // `meetLoadingRules` itself, which is meet-rule arithmetic in a `.tsx`.
    const screen = codeOnly(read('meet/MeetScreen.tsx'));
    expect(
      screen.split('meetLoadingRules(state.meet).barAndCollarsWeight[state.live.lift]').length - 1,
      'the router hands the walk-out and the attempt two different bar weights',
    ).toBe(2);
  });

  it('does not let the crowd’s rise reach the contact shadow, and measures that rather than assuming it', () => {
    // THE SIBLING-MEMO SHAPE, CAUGHT BEFORE IT BIT. `GymSceneView.tsx` holds two
    // `useMemo`s over the same `GymSceneSpec`, twenty lines apart:
    // `GymSceneLayer`'s room lists `spec.crowdRisePx` in its deps and
    // `ContactShadowLayer`'s does not. Until this round nothing ever handed
    // `LiftStage` a spec whose rise varied, so the asymmetry cost nothing; the
    // rep now does.
    //
    // THE OMISSION IS KEPT AND THE FACT THAT MAKES IT SAFE IS MEASURED. Adding
    // the dep would re-raster 22,490 pixels to produce a byte-identical patch.
    // What is asserted instead is the reason: the shadow lands on the floor and
    // the seating stops far above it, so no rise the piece can produce moves a
    // single pixel of the patch. If the crowd ever reaches the floor this goes
    // red and the missing dep becomes a caught bug rather than a latent one.
    const layers = codeOnly(read('art/GymSceneView.tsx'));
    // The two lists name the spec by different local names (`spec` and `scene`),
    // so the prefix is normalised before they are compared — otherwise this
    // would be a diff of two variable names rather than of two dependency sets.
    const depLists = [...layers.matchAll(/\[\s*(?:spec|scene)\.venue[\s\S]*?\]/g)].map((m) =>
      m[0].replace(/\s+/g, ' ').replace(/\bscene\./g, 'spec.'),
    );
    expect(depLists.length, 'GymSceneView no longer has two scene memos to compare').toBe(2);
    const [room, shadow] = depLists;
    expect(room, 'the room memo stopped listing the crowd’s rise').toContain('spec.crowdRisePx');
    expect(shadow, 'the shadow memo started listing it, so this test is stale').not.toContain(
      'spec.crowdRisePx',
    );
    // ...and the ONLY difference between the two lists is that field, so a third
    // spec field that the shadow silently ignores cannot arrive unnoticed.
    expect(
      (room ?? '').replace(', spec.crowdRisePx', ''),
      'the two scene memos differ by more than the crowd’s rise',
    ).toBe(shadow);

    // THE MEASURED FACT. Every frame of a maximal rep, at rise 0 and at the top
    // of the tail's ramp.
    const rep = buildSquatRep(LOAD_PRESETS.MAXIMAL);
    const room0 = renderGymScene({ ...MEET_HALL_SCENE, crowdRisePx: 0 });
    const roomUp = renderGymScene({
      ...MEET_HALL_SCENE,
      crowdRisePx: MEET_TUNING.WALKOUT_TAIL.HUSH_CROWD_RISE_PX,
    });
    let compared = 0;
    let lowestPatchRow = 0;
    for (const frame of rep.frames) {
      const spec = frameSpecFrom(frame, DEMO_TOTAL_KG, BAR_AND_COLLARS_KG);
      const mask = liftContactShadow(spec);
      const a = contactShadowPatch(room0, mask, GYM_LIFT_STAGE.SPRITE_X, GYM_LIFT_STAGE.SPRITE_Y, GYM_CONTACT_SHADOW.STEPS);
      const b = contactShadowPatch(roomUp, mask, GYM_LIFT_STAGE.SPRITE_X, GYM_LIFT_STAGE.SPRITE_Y, GYM_CONTACT_SHADOW.STEPS);
      expect(a, `frame ${compared} casts no shadow at all`).not.toBeNull();
      expect(b).not.toBeNull();
      if (a === null || b === null) continue;
      expect([a.x, a.y], `frame ${compared}: the shadow moved with the crowd`).toEqual([b.x, b.y]);
      expect(
        [...a.grid.data],
        `frame ${compared}: the shadow's pixels moved with the crowd`,
      ).toEqual([...b.grid.data]);
      lowestPatchRow = Math.max(lowestPatchRow, a.y);
      compared += 1;
    }
    expect(compared, 'no frame of the rep was compared').toBe(rep.frames.length);
    // ...and the two bands really are far apart, which is WHY. A crowd whose
    // seating reached the shadow's rows would make everything above a
    // coincidence rather than a consequence.
    expect(
      crowdFrontRow(MEET_HALL_SCENE),
      `the seating reaches row ${crowdFrontRow(MEET_HALL_SCENE)} and the shadow starts at ${lowestPatchRow}`,
    ).toBeLessThan(lowestPatchRow);
  });

  it('runs a clock through the wait for the lights, and stops it when the lamps may come up', () => {
    // The deliberation got `DELIBERATION_STAKES_EXTRA_MS`, and lengthening a beat
    // that draws one memoised still is the defect this whole pass removed, one
    // screen later. `buildHold` is the brace with no walk-out in front of it and
    // `walkout.test.ts` measures it on pixels; what no pure test can see is
    // whether this screen SAMPLES it, which is three deleted words away.
    const view = codeOnly(read('meet/VerdictView.tsx'));
    expect(view, 'VerdictView builds no hold sheet').toMatch(
      /buildHold\(loadRatio,\s*deliberationMs\(attempt\.deliberated,\s*attempt\)\)/,
    );
    expect(view, 'VerdictView runs no clock through the wait').toContain(
      'useHallStep(sampleHold',
    );
    expect(view, 'the hold sampler ignores elapsed time').toMatch(
      /walkoutFrameIndexAt\(hold,\s*elapsedMs\)/,
    );
    // ...and the clock is STOPPED once the lights may come up: a bar still
    // rocking under three lamps would be motion competing with the moment this
    // game is named after.
    expect(view, 'the hold clock keeps running under the lamps').toMatch(
      /useHallStep\(sampleHold,\s*revealed \? 0 : hold\.beatMs/,
    );
    // AND THE HALL IS HANDED THE POSE. Everything above is satisfied by a
    // component that computes a pose and draws the settled still anyway — which
    // is the failure `hands the hall a WALK-OUT` was written for, one screen over.
    const verdict = meetHallElementIn(read('meet/VerdictView.tsx'));
    expect(verdict ?? '', 'the verdict hands the hall no pose').toMatch(/\bpose\s*[,}]/);
  });

  it('draws the wait for the lights with the bar still on his back [bar-stays-on-his-back-for-the-call]', () => {
    // THE CLAIM `MEET_TUNING.VERDICT_SILENCE_MS` MAKES, checked rather than
    // written. That comment used to say the beat was "dead air between the bar
    // being racked and anything appearing", and the pixels have never done that:
    // `VerdictView` hands `MeetHallView` a lifter whose `totalKg` is the
    // ATTEMPT's weight, so the drawing is a man standing under a fully loaded
    // bar for the whole deliberation and the whole verdict.
    //
    // Correcting the sentence rather than the pixels is deliberate and the
    // comment says why: `renderLifterFrame` has one pose family — a figure with
    // a bar across his shoulders — and inventing a racked-bar drawing here is
    // `src/art/lifterSprite.ts`'s job.
    const verdict = meetHallElementIn(read('meet/VerdictView.tsx'));
    expect(verdict, 'VerdictView draws no MeetHallView at all').not.toBeNull();
    expect(verdict ?? '', 'the verdict draws an empty platform').not.toMatch(
      /lifter=\{\s*null\s*\}/,
    );
    expect(
      verdict ?? '',
      'the bar the wait is drawn with is not the attempt’s bar',
    ).toContain('totalKg: attempt.weightKg');
    // ...and nothing is holding discs back: `platesLoaded` is the walk-out's
    // channel, and a verdict that passed one would be drawing a part-loaded bar.
    expect(verdict ?? '', 'the verdict hides part of the stack').not.toMatch(
      /\bplatesLoaded\b/,
    );

    // AND "LOADED" IS A REAL DIFFERENCE IN PIXELS, not just a different number
    // handed over. Without this the assertions above could be satisfied by a
    // drawing whose sleeves look the same either way, and the guarantee would be
    // about a variable name.
    const attemptKg = 240;
    const loaded = renderLifterFrame(
      frameSpecFrom(buildSquatRep(LOAD_PRESETS.MAXIMAL).frames[0]!, attemptKg, BAR_AND_COLLARS_KG),
    ).grid;
    const bare = renderLifterFrame(
      frameSpecFrom(
        buildSquatRep(LOAD_PRESETS.MAXIMAL).frames[0]!,
        BAR_AND_COLLARS_KG,
        BAR_AND_COLLARS_KG,
      ),
    ).grid;
    let differing = 0;
    for (let i = 0; i < loaded.data.length; i += 1) {
      if (loaded.data[i] !== bare.data[i]) differing += 1;
    }
    expect(differing, 'a loaded bar and a bare one are the same drawing').toBeGreaterThan(0);
  });

  it('the element parser can tell a prop from a mention of its name', () => {
    // The positive control for the correction above.
    const withProp = 'const [platesLoaded] = x();\n  <MeetHallView lifter={{ platesLoaded }} />';
    const without = 'const [platesLoaded] = x();\n  <MeetHallView lifter={{ totalKg }} />';
    expect(meetHallElementIn(withProp) ?? '').toContain('platesLoaded');
    expect(meetHallElementIn(without) ?? '').not.toContain('platesLoaded');
    expect(meetHallElementIn('nothing here')).toBeNull();
    // ...and it throws rather than guessing at an element it cannot close, the
    // same way `liftStageElementIn` does.
    expect(() => meetHallElementIn('<MeetHallView lifter={x}>')).toThrow(/not self-closing/);
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

describe("the urgent cheer has a moment that draws it — GDD §6.2's deferred rule", () => {
  // WHY THIS EXISTS. `CROWD.URGENT_CHEER_RISE_PX` had zero test callers, zero
  // photographs, and no preview that could reach it: every judging moment was a
  // FIRST attempt, and `isUrgentAttempt` is false there. So the one visible
  // channel GDD §6.2's deferred rule points at — "what a reaction may escalate
  // is loudness, and it does" — had never been drawn in the graded artifact.
  //
  // THIS RULES ON NOTHING. §6.2 marks that rule PENDING PLAYTEST and it stays
  // pending; these tests only make the claim it rests on observable, so a
  // playtest has something to react to instead of a constant nobody has seen.

  it('verdict-good-urgent is an urgent attempt, and the old verdict moments are not', () => {
    const urgent = previewStateFor({ moment: 'verdict-good-urgent' });
    expect(urgent.live, 'the urgent verdict moment has a live attempt').not.toBeNull();
    expect(
      isUrgentAttempt(urgent.live!),
      'verdict-good-urgent reaches isUrgentAttempt — this is the whole point of the moment',
    ).toBe(true);

    // THE CONTROL, AND IT IS THE HALF THAT MAKES THE LINE ABOVE MEAN ANYTHING.
    // If every verdict moment were urgent, the new one would prove nothing.
    for (const moment of ['verdict-good', 'verdict-split', 'verdict-no-lift', 'verdict-split-red'] as const) {
      const frozen = previewStateFor({ moment });
      expect(frozen.live, `${moment} has a live attempt`).not.toBeNull();
      expect(
        isUrgentAttempt(frozen.live!),
        `${moment} is NOT urgent — it is a first attempt, which is why the urgent cheer had never been drawn`,
      ).toBe(false);
    }
  });

  it('and it is a GOOD lift, because the urgent cheer only rises on a make', () => {
    const urgent = previewStateFor({ moment: 'verdict-good-urgent' });
    // The cheer arm in `VerdictView` is `revealed && good`, so an urgent
    // attempt that MISSED would draw the empty hall and prove nothing about
    // loudness. Read off the judged attempt the beat is holding.
    // `MeetScreen` reads the beat's attempt through `lastAttempt(state)`, so
    // this reads the same thing the screen does rather than a second path.
    const judged = lastAttempt(urgent);
    expect(judged, 'the verdict beat is holding a judged attempt').not.toBeNull();
    expect(judged?.good, 'the attempt was judged good').toBe(true);
  });

  it('the urgent ramp really is higher than the calm one, read off the ramps the view uses', () => {
    const calm = cheerCrowdRise(false);
    const loud = cheerCrowdRise(true);
    // A COUNT AND NOT A BOUND: the two ceilings are pinned to the constants, so
    // a change to either reddens here naming which. `toBeGreaterThan` alone
    // would survive both moving together.
    expect(calm.toPx, 'the calm cheer ceiling').toBe(MEET_TUNING.CROWD.CHEER_RISE_PX);
    expect(loud.toPx, 'the urgent cheer ceiling').toBe(MEET_TUNING.CROWD.URGENT_CHEER_RISE_PX);
    expect(loud.toPx > calm.toPx, 'urgent stands further than calm').toBe(true);
  });
});
