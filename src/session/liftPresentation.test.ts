import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { createLift, stepLift, type LiftInput, type LiftState } from '../game/lift';
import { LIFT_TUNING } from '../game/liftTuning';
import { BAR_AND_COLLARS_KG } from '../art/plates';
import { liftPresentationFrom, type LiftPresentation } from './liftPresentation';

const LOAD = 155;

const SOURCE = readFileSync(new URL('./liftPresentation.ts', import.meta.url), 'utf8');

function squat(loadRatio = 0.8): LiftState {
  return createLift({ kind: 'squat', loadRatio, seed: 1 });
}

/**
 * Drive the real engine THE WAY A PLAYER DRIVES IT, and read every input
 * decision off the simulation's own signals rather than off tuning arithmetic.
 *
 * THE FIRST VERSION OF THIS HELPER PRESSED EVERY TICK AND NEVER RELEASED, so
 * every rep it produced was a `miss` with **zero** `ASCENT` ticks. Three of the
 * checks below are about the ascent, and all three passed over an empty domain
 * — the exact vacuity shape CLAUDE.md names ("a sweep whose generator never
 * produces the failing case"). `ascentFrames` is pinned non-empty for that
 * reason: the domain has to report itself.
 */
function repFrames(loadRatio = 0.8): LiftState[] {
  let state = squat(loadRatio);
  const frames: LiftState[] = [state];
  let guard = 0;
  while (state.phase !== 'RESOLVED' && guard < 900) {
    const next = state.tick + 1;
    let input: LiftInput | null = null;
    if (state.phase === 'BRACE' && !state.held) {
      input = { kind: 'press' };
    } else if (
      state.phase === 'DESCENT' &&
      state.held &&
      state.depth >= LIFT_TUNING.DEPTH_IDEAL.squat
    ) {
      input = { kind: 'release' };
    } else if (
      state.activeCue !== null &&
      next >= state.activeCue.idealTick &&
      next <= state.activeCue.closeTick
    ) {
      if (state.activeCue.wants === 'press' && !state.held) input = { kind: 'press' };
      else if (state.activeCue.wants === 'release' && state.held) input = { kind: 'release' };
    } else if (state.held && state.phase === 'ASCENT') {
      input = { kind: 'release' };
    }
    state = stepLift(state, input);
    frames.push(state);
    guard += 1;
  }
  return frames;
}

function ascentFrames(loadRatio: number): LiftState[] {
  const asc = repFrames(loadRatio).filter((s) => s.phase === 'ASCENT');
  // NON-VACUITY, and it is load-bearing — see `repFrames`'s header.
  expect(asc.length, `ascent ticks at loadRatio ${loadRatio}`).toBeGreaterThan(20);
  return asc;
}

describe('the presentation contract carries no coordinates', () => {
  // THE GUARANTEE, AND IT IS A SOURCE SCAN ON PURPOSE. The failure this
  // module exists to prevent is a joint solver coming back — `leftKnee.x`,
  // `hip.y`, a `SquatJoint`. A behavioural test cannot see that, because a
  // puppet's joints are perfectly well-behaved numbers. Only the shape of the
  // contract itself tells you whether the skeleton is back.
  it('declares no joint, point or pixel field [the-presentation-contract-carries-no-coordinates]', () => {
    const start = SOURCE.indexOf('export interface LiftPresentation');
    expect(start, 'the contract interface is declared').toBeGreaterThan(-1);
    // Close on a brace in COLUMN ZERO, not on the first `}` anywhere. A nested
    // `{ x: number; y: number }` — the very smuggling this test bans — closes
    // early, so `indexOf('}')` would shorten the slice to just before the thing
    // being looked for and hand the ban an empty haystack.
    const end = SOURCE.indexOf('\n}', start);
    expect(end, 'the interface body closes at column zero').toBeGreaterThan(start);
    const body = SOURCE.slice(start, end);

    const fields = [...body.matchAll(/readonly\s+(\w+)\s*:/g)].map((m) => m[1] ?? '');

    // THE BANS RUN FIRST, AND THE ORDER IS DELIBERATE. With the field-count pin
    // above them, adding a joint failed the COUNT and aborted the test before
    // either ban was reached — so the mutation was caught by the guard on the
    // guard, and the checks that name the actual defect never spoke. Measured
    // that way, then reordered.
    const banned = fields.filter((f) => /^(x|y|cx|cy)$|Px$|Joint|joint|Point$/.test(f));
    expect(banned, 'coordinate-shaped fields in the contract').toEqual([]);

    // A joint is usually smuggled in as a nested `{ x: number; y: number }`
    // rather than as a field literally called `x`, so ban the shape too.
    expect(
      /\{\s*(readonly\s+)?x\s*:/.test(body),
      'a nested {x,y} point type in the contract',
    ).toBe(false);

    // NON-VACUITY, last: a renamed or emptied interface makes both bans above
    // pass trivially, so pin that the body really is the contract and really
    // has fields in it. An empty domain reports itself instead of going green.
    expect(fields.length, 'fields the scan actually read').toBe(15);
    expect(fields, 'the rep-position field is present').toContain('stand');
  });
});

describe('liftPresentationFrom reports gameplay in renderer units', () => {
  it('holds every normalized field inside its promised range, all rep long', () => {
    const frames = repFrames();
    // NON-VACUITY: a rep that never ran would satisfy every range below.
    expect(frames.length, 'ticks driven through the real engine').toBeGreaterThan(30);

    for (const state of frames) {
      const p: LiftPresentation = liftPresentationFrom(state, LOAD);
      expect(p.stand, `stand at tick ${state.tick}`).toBeGreaterThanOrEqual(0);
      expect(p.stand, `stand at tick ${state.tick}`).toBeLessThanOrEqual(1);
      expect(p.strain).toBeGreaterThanOrEqual(0);
      expect(p.strain).toBeLessThanOrEqual(1);
      expect(p.grind).toBeGreaterThanOrEqual(0);
      expect(p.grind).toBeLessThanOrEqual(1);
      expect(p.commandGlow).toBeGreaterThanOrEqual(0);
      expect(p.commandGlow).toBeLessThanOrEqual(1);
      expect(p.chalk).toBeGreaterThanOrEqual(0);
      expect(p.chalk).toBeLessThanOrEqual(1);
      expect(p.barSpeed).toBeGreaterThanOrEqual(-1);
      expect(p.barSpeed).toBeLessThanOrEqual(1);
      expect(p.barFlex).toBeGreaterThanOrEqual(-1);
      expect(p.barFlex).toBeLessThanOrEqual(1);
    }
  });

  it('resolves the rep — the driver plays it, it does not merely start it', () => {
    const final = repFrames().at(-1)!;
    expect(final.phase, 'the driven rep resolved').toBe('RESOLVED');
    expect(final.resolution?.outcome, 'and it was played well enough to make it')
      .toBe('good-lift');
  });

  it('stand is driven by the mechanic and really moves — the continuity claim', () => {
    const frames = repFrames();
    const stands = frames.map((s) => liftPresentationFrom(s, LOAD).stand);
    // MOVES, not merely valid: a constant satisfies every range check above.
    // This is the fact that separates continuous motion from a phase swap.
    expect(Math.min(...stands), 'the bar actually descended').toBeLessThan(0.6);
    expect(Math.max(...stands), 'the rep started standing').toBeGreaterThan(0.9);
    expect(new Set(stands.map((n) => n.toFixed(3))).size, 'distinct rep positions')
      .toBeGreaterThan(20);
  });

  it('draws the weight that is actually loaded', () => {
    const p = liftPresentationFrom(squat(), LOAD);
    const onBar = p.platesPerSideKg.reduce((a, b) => a + b, 0) * 2 + p.barKg;
    expect(p.barKg).toBe(BAR_AND_COLLARS_KG);
    expect(onBar, '155 kg must not be drawn as some other bar').toBe(LOAD);

    const light = liftPresentationFrom(squat(), 70);
    const heavy = liftPresentationFrom(squat(), 220);
    expect(heavy.platesPerSideKg.length).toBeGreaterThan(light.platesPerSideKg.length);
  });

  // THE ORACLE IS THE SIMULATION'S, NOT THIS MODULE'S. `stallTicks` is
  // accumulated inside `stepLift` from `GRIND_STALL_VELOCITY` and is never read
  // by `liftPresentationFrom`, so this equality is two independent counts of
  // the same fact. Redefining the grind on the renderer side — for instance by
  // gating on a visual constant, which is what this module originally did —
  // breaks it.
  it('counts exactly the ticks the mechanic itself calls stalled', () => {
    for (const loadRatio of [0.6, 0.8, 0.95, 1.0]) {
      const frames = repFrames(loadRatio);
      const grinding = frames.filter((s) => liftPresentationFrom(s, LOAD).grind > 0);
      const stallTicks = frames.at(-1)!.resolution?.stallTicks;
      expect(stallTicks, `the rep at ${loadRatio} resolved`).toBeTypeOf('number');
      expect(grinding.length, `grind ticks at loadRatio ${loadRatio}`).toBe(stallTicks);
    }
  });

  it('grind is the sticking point, not just strain', () => {
    // The discriminator, and it needs BOTH loads to be one. A light rep is
    // strained end to end and never grinds; a limit rep grinds. One load alone
    // cannot tell "grind tracks the sticking point" from "grind is strain".
    const easy = ascentFrames(0.6).map((s) => liftPresentationFrom(s, LOAD));
    expect(easy.some((p) => p.strain > 0), 'the easy rep was strained at all').toBe(true);
    expect(easy.every((p) => p.grind === 0), 'and never reached a sticking point').toBe(true);

    const limit = ascentFrames(1.0).map((s) => liftPresentationFrom(s, LOAD));
    expect(limit.some((p) => p.grind > 0), 'the limit rep did grind').toBe(true);

    // Non-ascent ticks can be strained but are never grinding.
    for (const p of repFrames(1.0).map((s) => liftPresentationFrom(s, LOAD))) {
      if (p.phase !== 'ASCENT') expect(p.grind, `grind in ${p.phase}`).toBe(0);
    }
  });

  // barSpeed is normalized by the mechanic's own clamps, so the ends of its
  // promised range have to be REACHED, not merely respected. A normalizer that
  // is too large passes every range check above while making the field dead.
  it('barSpeed spans its promised range in both directions', () => {
    const easy = repFrames(0.6).map((s) => liftPresentationFrom(s, LOAD).barSpeed);
    expect(Math.max(...easy), 'the drive reaches the mechanic’s rise clamp').toBe(1);

    const limit = repFrames(1.0).map((s) => liftPresentationFrom(s, LOAD).barSpeed);
    expect(Math.min(...limit), 'and a limit rep loses ground').toBeLessThan(0);
  });

  it('is pure — the same tick maps to the same frame', () => {
    const state = repFrames()[20]!;
    expect(liftPresentationFrom(state, LOAD)).toEqual(liftPresentationFrom(state, LOAD));
  });
});
