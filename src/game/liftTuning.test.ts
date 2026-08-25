/**
 * Guards on the lift mechanic's tuning file.
 *
 * `liftTuning.ts` is the one place a playtester edits, and GDD §12.1 budgets
 * roughly 30 hand passes over it. Everything below is a rule a hand pass could
 * plausibly break without breaking anything that looks related:
 *
 *   - a threshold ordering that silently makes a state unreachable
 *   - a force balance where nothing can ever stall, or nothing can ever be
 *     driven through, so the mechanic has no sticking point at all
 *   - copy that no longer covers its table
 *   - a feel value that has been written into a component instead of here
 *
 * NONE OF THESE SAY THE VALUES ARE RIGHT. No test can. They say the values are
 * still self-consistent, and that the mechanic still has the shape the file
 * claims it has.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  LIFT_COPY,
  LIFT_TUNING,
  LOAD_PRESETS,
  LOAD_RANGE,
  DEPTH_TIMED_LIFT_KINDS,
  ECCENTRIC_LIFT_KINDS,
  PLAYABLE_LIFT_KINDS,
  STICK_HEIGHT_FRAC,
  STICK_WIDTH,
  TICK_HZ,
  TICK_MS,
  byLoad,
  clampLoadRatio,
  loadT,
  type HapticStyle,
  type PlayableLiftKind,
} from './liftTuning';
import { LIFT_ORDER } from './meet';
import {
  STICK,
  STRAIN,
  TICK_MS as ART_TICK_MS,
  TICK_HZ as ART_TICK_HZ,
} from '../art/spriteTuning';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// The coupling to the sprite system, made visible
// ---------------------------------------------------------------------------

describe('shared facts', () => {
  it('runs on the same clock as the sprite animation', () => {
    expect(TICK_MS).toBe(ART_TICK_MS);
    expect(TICK_HZ).toBe(ART_TICK_HZ);
    expect(TICK_MS).toBeCloseTo(1000 / TICK_HZ, 9);
  });

  it('puts the mechanical sticking point where the sprite draws one, for squat', () => {
    // If these ever disagree the bar stalls at one height and the lifter is
    // drawn fighting at another, which is the kind of incoherence that is
    // invisible in either file on its own. SQUAT ONLY: `spriteTuning.ts`'s
    // `STICK` constants are the canned squat animation's, and bench has no
    // sprite of its own yet to agree or disagree with.
    expect(STICK_HEIGHT_FRAC.squat).toBe(STICK.HEIGHT_FRAC);
    expect(STICK_WIDTH.squat).toBe(STICK.WIDTH);
    for (const kind of PLAYABLE_LIFT_KINDS) {
      expect(STICK_HEIGHT_FRAC[kind], kind).toBeGreaterThan(0);
      expect(STICK_HEIGHT_FRAC[kind], kind).toBeLessThan(1);
    }
  });

  it('draws a played rep from the same strain model as the canned one', () => {
    // These numbers are written down twice — here and in `spriteTuning.ts` —
    // following this file's convention for the art values it restates. The
    // convention is only safe while they agree: the canned animation is the
    // inspection harness the sprite sheet is JUDGED from (see
    // `tools/sprites.mjs`), so a value that drifts on one side makes the
    // contact sheet stop describing the app, and neither file looks wrong on
    // its own. Exactly the failure `BRACE_SETTLE_DEPTH` was pulled out for.
    expect(LIFT_TUNING.STRAIN_FROM_LOAD).toEqual(STRAIN.FROM_LOAD);
    for (const [key, value] of Object.entries(LIFT_TUNING.STRAIN_PHASE_WEIGHT)) {
      expect(STRAIN.PHASE_WEIGHT, `phase weight ${key}`).toHaveProperty(key, value);
    }
    // ...and the scan is not vacuous: the live table has to have entries.
    expect(Object.keys(LIFT_TUNING.STRAIN_PHASE_WEIGHT).length).toBeGreaterThan(0);
  });

  it('never draws the brace heavier than the top of the descent it leads into', () => {
    // The brace is the top of the descent, held still. Weighted above
    // DESCENT_TOP it makes the lifter strain standing and then loosen on the
    // first moving tick. `liftFrame.test.ts` measures the drawn consequence on
    // played reps; this is the ordering that guarantees it at every load.
    const w = LIFT_TUNING.STRAIN_PHASE_WEIGHT;
    expect(w.BRACE).toBeLessThanOrEqual(w.DESCENT_TOP);
    expect(w.DESCENT_TOP).toBeLessThan(w.DESCENT_BOTTOM);
  });

  it('shares the load curve rather than restating it', () => {
    expect(loadT(LOAD_RANGE.MIN)).toBe(0);
    expect(loadT(LOAD_RANGE.MAX)).toBe(1);
    expect(clampLoadRatio(0)).toBe(LOAD_RANGE.MIN);
    expect(clampLoadRatio(99)).toBe(LOAD_RANGE.MAX);
    let previous = -Infinity;
    for (let r = LOAD_RANGE.MIN; r <= LOAD_RANGE.MAX; r += 0.01) {
      const t = loadT(r);
      expect(t).toBeGreaterThanOrEqual(previous);
      previous = t;
    }
  });
});

// ---------------------------------------------------------------------------
// Immutability
// ---------------------------------------------------------------------------

describe('immutability', () => {
  it('freezes the tuning block and its nested tables', () => {
    expect(Object.isFrozen(LIFT_TUNING)).toBe(true);
    expect(Object.isFrozen(LIFT_TUNING.HAPTICS)).toBe(true);
    expect(Object.isFrozen(LIFT_TUNING.FEEDBACK)).toBe(true);
    expect(Object.isFrozen(LIFT_TUNING.STRAIN_PHASE_WEIGHT)).toBe(true);
    expect(Object.isFrozen(LIFT_COPY)).toBe(true);
    for (const p of Object.values(LIFT_TUNING.HAPTICS)) {
      expect(Object.isFrozen(p)).toBe(true);
      expect(Object.isFrozen(p.beats)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Orderings that keep states reachable
// ---------------------------------------------------------------------------

// EVERY LOOP IN THIS BLOCK WALKS `ECCENTRIC_LIFT_KINDS`, NOT
// `PLAYABLE_LIFT_KINDS`, AND THE DOMAIN IS THE SAME TWO KINDS IT ALWAYS WAS.
// THESE THREE ASSERTIONS WERE NARROWED FROM TWO KINDS TO ONE BY THE 2026-08-25
// RULING, AND THAT IS A DELETION OF A DOMAIN RATHER THAN A WEAKENING OF A
// CHECK — which CLAUDE.md says to record rather than perform quietly.
//
// All three are about a RELEASE WINDOW: where its late edge lands, how many
// ticks lie between legal depth and ideal depth, whether the three thresholds
// are ordered. Bench has no release window since the ruling — the bar is fed
// to the chest and graded on the speed it arrives at — so `DEPTH_LEGAL` and
// `DEPTH_WINDOW_MS` lost their bench rows entirely and indexing either with
// `'bench'` does not compile. Running these loops over bench would not be a
// stronger check, it would be a check about numbers no code reads.
//
// What replaced the coverage is `describe('the bench descent')` below, which
// asserts the arithmetic of the beat bench actually has. The domain census
// moved with them: `DEPTH_TIMED_LIFT_KINDS` is pinned set-equal to ['squat']
// in both directions further down, the way `ECCENTRIC_LIFT_KINDS` already is.
describe('depth thresholds', () => {
  it('leaves room between illegal, ideal and buried, for the lift that is depth-timed', () => {
    for (const kind of DEPTH_TIMED_LIFT_KINDS) {
      expect(LIFT_TUNING.DEPTH_LEGAL[kind], kind).toBeGreaterThan(0);
      expect(LIFT_TUNING.DEPTH_LEGAL[kind], kind).toBeLessThan(LIFT_TUNING.DEPTH_IDEAL[kind]);
      expect(LIFT_TUNING.DEPTH_IDEAL[kind], kind).toBeLessThan(LIFT_TUNING.DEPTH_COLLAPSE[kind]);
    }
    // Bench keeps two of the three, and they still have to be ordered: the
    // chest is where the bar lands and the collapse point is how far it may
    // sink into it.
    expect(LIFT_TUNING.DEPTH_IDEAL.bench).toBeLessThan(LIFT_TUNING.DEPTH_COLLAPSE.bench);
  });

  it('never lets the late edge of the depth window be an instant bury', () => {
    // The early edge is handled in `lift.ts` by clamping the window to the
    // legal range — see `depthWindowHalfTicks`, and the played-rep test in
    // `lift.test.ts` that measures it. The LATE edge has no such clamp, so it
    // is checked here: releasing at the far end of the window must still leave
    // the lifter above the point of collapse.
    for (const kind of DEPTH_TIMED_LIFT_KINDS) {
      for (const load of Object.values(LOAD_PRESETS)) {
        const rate = byLoad(LIFT_TUNING.DESCENT_DEPTH_PER_TICK[kind], clampLoadRatio(load));
        const halfWindowDepth = (LIFT_TUNING.DEPTH_WINDOW_MS[kind] / 2 / TICK_MS) * rate;
        expect(LIFT_TUNING.DEPTH_IDEAL[kind] + halfWindowDepth, `${kind} load ${load}`).toBeLessThan(
          LIFT_TUNING.DEPTH_COLLAPSE[kind],
        );
      }
    }
  });

  it('leaves at least a couple of ticks between legal depth and the ideal one', () => {
    // If these were the same depth the window would collapse to nothing at
    // every load and the depth beat would become a single-frame check.
    for (const kind of DEPTH_TIMED_LIFT_KINDS) {
      for (const load of Object.values(LOAD_PRESETS)) {
        const rate = byLoad(LIFT_TUNING.DESCENT_DEPTH_PER_TICK[kind], clampLoadRatio(load));
        const ticks = (LIFT_TUNING.DEPTH_IDEAL[kind] - LIFT_TUNING.DEPTH_LEGAL[kind]) / rate;
        expect(ticks, `${kind} load ${load}`).toBeGreaterThan(2);
      }
    }
  });
});

describe('the bench descent (GDD §6.2; ruled 2026-08-25)', () => {
  const loads = Object.values(LOAD_PRESETS);

  it('makes a heavier bar gather speed faster and stop harder', () => {
    // THE WHOLE DIFFICULTY CURVE OF THE BEAT, as two constants pulling in
    // opposite directions — and it is the one place in the descent where
    // heavier means faster. `DESCENT_DEPTH_PER_TICK` stays SLOWER at MAXIMAL
    // on purpose (a limit attempt is controlled down), so if these two ever
    // flipped, a heavy bench would be the EASY one to catch and nothing else
    // in the file would notice.
    expect(LIFT_TUNING.BENCH_DESCENT_GRAVITY.MAXIMAL).toBeGreaterThan(
      LIFT_TUNING.BENCH_DESCENT_GRAVITY.LIGHT,
    );
    expect(LIFT_TUNING.BENCH_DESCENT_BRAKE.MAXIMAL).toBeLessThan(
      LIFT_TUNING.BENCH_DESCENT_BRAKE.LIGHT,
    );
    expect(LIFT_TUNING.DESCENT_DEPTH_PER_TICK.bench.MAXIMAL).toBeLessThan(
      LIFT_TUNING.DESCENT_DEPTH_PER_TICK.bench.LIGHT,
    );
  });

  it('leaves the crash threshold reachable and not the default', () => {
    // THE TWO-SIDED REQUIREMENT `DEPTH_WINDOW_MS`'s bench row failed on its
    // first pass, applied to its replacement. A crash nobody can reach is a
    // penalty that never fires; a crash the bar reaches by starting to move is
    // a beat that always punishes.
    for (const load of loads) {
      const start = byLoad(LIFT_TUNING.DESCENT_DEPTH_PER_TICK.bench, clampLoadRatio(load));
      // The bar never STARTS in a crash — that would make the descent lost
      // before the player has done anything.
      expect(start, `load ${load}`).toBeLessThan(LIFT_TUNING.BENCH_TOUCH_CRASH_RATE);
      // ...and the soft threshold is under the start rate, so arriving soft
      // always means the player braked rather than merely not accelerating.
      expect(LIFT_TUNING.BENCH_TOUCH_SOFT_RATE, `load ${load}`).toBeLessThan(start);
    }
    expect(loads.length, 'no loads were checked').toBeGreaterThan(2);

    // A bar fed all the way down passes the crash rate before it reaches the
    // chest, from LIGHT upward. Closed form: the rate after `n` held ticks is
    // `start + n * gravity`, so the depth it has covered by the time the rate
    // hits the crash threshold is the integral of that.
    const depthWhenCrashing = (load: number): number => {
      const start = byLoad(LIFT_TUNING.DESCENT_DEPTH_PER_TICK.bench, clampLoadRatio(load));
      const gravity = byLoad(LIFT_TUNING.BENCH_DESCENT_GRAVITY, clampLoadRatio(load));
      const ticks = (LIFT_TUNING.BENCH_TOUCH_CRASH_RATE - start) / gravity;
      return start * ticks + (gravity * ticks * ticks) / 2;
    };
    for (const load of [LOAD_PRESETS.LIGHT, LOAD_PRESETS.MODERATE, LOAD_PRESETS.HEAVY, LOAD_PRESETS.MAXIMAL]) {
      expect(depthWhenCrashing(load), `load ${load}`).toBeLessThan(LIFT_TUNING.DEPTH_IDEAL.bench);
    }

    // AND THE LIGHTEST BAR IN THE GAME CANNOT BE CRASHED AT ALL, WHICH IS A
    // §12.3 PROPERTY RATHER THAN A GAP. `LOAD_PRESETS.WARMUP` runs out of
    // descent before it runs out of control: fed the whole way it still
    // arrives under the crash rate, so a warm-up bench cannot be lost to the
    // descent however carelessly it is brought down. Same structural shape
    // `LOCKOUT_SAG_PER_TICK` uses to promise a warm-up deadlift cannot be
    // dropped — an arithmetic consequence of two constants rather than a
    // horizon somebody happened to sweep. It is measured here rather than
    // asserted in prose, and it goes red if the gravity curve grows.
    expect(depthWhenCrashing(LOAD_PRESETS.WARMUP)).toBeGreaterThan(LIFT_TUNING.DEPTH_IDEAL.bench);
  });

  it('keeps the worst sink inside what a chest can compress', () => {
    // `BENCH_TOUCH_SINK_GAIN` is chosen against `DEPTH_COLLAPSE.bench`: the
    // clamp is a backstop for a bar arriving hotter than the crash rate, not
    // the usual case, so a touch AT the crash rate must land strictly under
    // it. Without this the sink would be pinned at the clamp for every crash
    // and the drawing would stop distinguishing them.
    const worst =
      LIFT_TUNING.DEPTH_IDEAL.bench +
      LIFT_TUNING.BENCH_TOUCH_SINK_GAIN * LIFT_TUNING.BENCH_TOUCH_CRASH_RATE;
    expect(worst).toBeLessThan(LIFT_TUNING.DEPTH_COLLAPSE.bench);
    expect(worst).toBeGreaterThan(LIFT_TUNING.DEPTH_IDEAL.bench);
  });

  it('gives a committed descent all its patience and a dawdled one none', () => {
    // The free window has to be longer than any descent a player who commits
    // can produce, or committing is charged for nothing. Closed form again:
    // fed the whole way, `depth = start*n + gravity*n^2/2` reaches the chest.
    for (const load of loads) {
      const start = byLoad(LIFT_TUNING.DESCENT_DEPTH_PER_TICK.bench, clampLoadRatio(load));
      const gravity = byLoad(LIFT_TUNING.BENCH_DESCENT_GRAVITY, clampLoadRatio(load));
      const ticks =
        (-start + Math.sqrt(start * start + 2 * gravity * LIFT_TUNING.DEPTH_IDEAL.bench)) / gravity;
      expect(ticks, `load ${load}`).toBeLessThan(LIFT_TUNING.BENCH_DESCENT_PATIENCE_TICKS);
    }
    // ...and the timeout is far past the point patience has run out, so a
    // no-touch is a decision the player made rather than a clock they raced.
    expect(LIFT_TUNING.CHEST_TOUCH_TIMEOUT_TICKS).toBeGreaterThan(
      LIFT_TUNING.BENCH_DESCENT_PATIENCE_TICKS + LIFT_TUNING.BENCH_DESCENT_DAWDLE_SPAN_TICKS,
    );
  });
});

describe('the press burst (GDD §6.2; ruled 2026-08-25)', () => {
  it('leaves room in the window for more taps than the curve will count', () => {
    // "MASHING PHYSICS-CAPS RATHER THAN GROWING LINEARLY" made arithmetic. If
    // the window were the binding constraint instead of the curve, the beat
    // would be measuring the clock and a faster thumb would keep paying.
    const windowTicks = LIFT_TUNING.PRESS_BURST_WINDOW_MS / TICK_MS;
    const roomForTaps = Math.floor(windowTicks / LIFT_TUNING.PRESS_BURST_TAP_REFRACTORY_TICKS);
    expect(roomForTaps).toBeGreaterThan(LIFT_TUNING.PRESS_BURST_FORCE.MAX_COUNTED_TAPS);
  });

  it('keeps the refractory gap above anything a thumb does', () => {
    // A floor on the rate the sim will believe, not a punishment. If it grew
    // past a real tapping rate it would start capping human players, and the
    // beat would silently become "tap at exactly this speed".
    const tapsPerSecond = 1000 / (LIFT_TUNING.PRESS_BURST_TAP_REFRACTORY_TICKS * TICK_MS);
    expect(tapsPerSecond).toBeGreaterThan(12);
  });

  it('leaves the false-start floor a real burst rather than a formality', () => {
    const { MAX_COUNTED_TAPS, FALSE_START_FLOOR_TAPS, HALF_SATURATION_TAPS } =
      LIFT_TUNING.PRESS_BURST_FORCE;
    expect(FALSE_START_FLOOR_TAPS).toBeGreaterThan(0);
    expect(FALSE_START_FLOOR_TAPS).toBeLessThan(MAX_COUNTED_TAPS);
    expect(HALF_SATURATION_TAPS).toBeGreaterThan(0);
    expect(HALF_SATURATION_TAPS).toBeLessThan(MAX_COUNTED_TAPS);
  });

  it('grades a burst on bands that are ordered and inside the curve', () => {
    const { PERFECT, GOOD } = LIFT_TUNING.PRESS_BURST_GRADE;
    expect(GOOD).toBeGreaterThan(0);
    expect(PERFECT).toBeGreaterThan(GOOD);
    expect(PERFECT).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// The lift vocabulary itself — what replaced `simKindFor`
// ---------------------------------------------------------------------------

describe('every lift the sport has is a lift the mechanic can play', () => {
  it('pins PLAYABLE_LIFT_KINDS set-equal to LIFT_ORDER, in both directions', () => {
    // THIS IS THE GUARD THAT REPLACED THE `simKindFor` STOPGAP, and the reason
    // it is set equality in BOTH directions rather than a length check.
    //
    // `simKindFor` mapped a deadlift day onto squat's numbers. It was correct
    // TypeScript, it was documented, and it was invisible: every deadlift in
    // the game played squat's beat and no test could go red about it, because
    // "deadlift is simulated as squat" was the intended behaviour. A stopgap
    // that cannot fail is a stopgap nobody removes.
    //
    // What bites now: a fourth `LiftKind` added to `meet.ts` reddens HERE until
    // somebody gives it a mechanic, and a kind listed as playable that the
    // sport does not have reddens the other way.
    expect([...PLAYABLE_LIFT_KINDS].sort()).toEqual([...LIFT_ORDER].sort());
  });

  it('makes the eccentric kinds exactly the lifts that have a way down', () => {
    // NON-VACUITY FOR EVERY `ECCENTRIC_LIFT_KINDS` LOOP IN THIS FILE. Several
    // invariants above narrowed their domain from `PLAYABLE_LIFT_KINDS` to this
    // list when deadlift arrived. If it ever emptied — or quietly lost bench —
    // those loops would pass over nothing and report a clean bill of health on
    // an empty domain, which is precisely the vacuity CLAUDE.md names.
    expect([...ECCENTRIC_LIFT_KINDS].sort()).toEqual(['bench', 'squat']);
    // AND THE SAME CENSUS ONE NARROWING FURTHER IN. `DEPTH_TIMED_LIFT_KINDS`
    // is what the three depth-window assertions above now loop over, and a
    // list that quietly emptied would leave all three passing over nothing.
    expect([...DEPTH_TIMED_LIFT_KINDS].sort()).toEqual(['squat']);
    expect(DEPTH_TIMED_LIFT_KINDS).not.toContain('bench');
    expect(DEPTH_TIMED_LIFT_KINDS).not.toContain('deadlift');
    // ...and deadlift is deliberately absent, which is the design statement:
    // the bar starts on the floor, so there is nothing to lower.
    expect(ECCENTRIC_LIFT_KINDS).not.toContain('deadlift');
    // The eccentric tables are keyed to match. A `deadlift` row appearing on
    // one of them would not type-check, but a row could be REMOVED from one
    // and only this notices.
    for (const table of [
      LIFT_TUNING.DEPTH_IDEAL,
      LIFT_TUNING.DEPTH_COLLAPSE,
      LIFT_TUNING.DESCENT_DEPTH_PER_TICK,
      LIFT_TUNING.HOLE_TICKS,
      LIFT_TUNING.LOCKOUT_TICKS,
    ] as readonly Readonly<Record<string, unknown>>[]) {
      expect(Object.keys(table).sort()).toEqual(['bench', 'squat']);
    }
    // The two that narrowed further, keyed to match `DEPTH_TIMED_LIFT_KINDS`.
    // A `bench` row re-appearing on either would not type-check, but a row
    // could be removed and only this notices.
    for (const table of [
      LIFT_TUNING.DEPTH_LEGAL,
      LIFT_TUNING.DEPTH_WINDOW_MS,
    ] as readonly Readonly<Record<string, unknown>>[]) {
      expect(Object.keys(table).sort()).toEqual(['squat']);
    }
  });
});

// ---------------------------------------------------------------------------
// The deadlift lockout hold (GDD §6.2, "Deadlift — lockout grind")
// ---------------------------------------------------------------------------

describe('the lockout hold', () => {
  /** The most sag the sim can produce in one lockout, in ticks of not holding. */
  const worstSagTicks =
    LIFT_TUNING.DOWN_COMMAND_DELAY_TICKS.MAX - LIFT_TUNING.LOCKOUT_GRIP_GRACE_TICKS;

  /** Ticks of not holding needed to lose the bar at this load. */
  const ticksToDrop = (load: number): number =>
    LIFT_TUNING.LOCKOUT_DROP_HEIGHT_LOSS /
    byLoad(LIFT_TUNING.LOCKOUT_SAG_PER_TICK, clampLoadRatio(load));

  it('cannot drop a warm-up or a light bar, however long the player lets go (GDD §12.3)', () => {
    // "NEVER PUNISH DAILY ENGAGEMENT" AS ARITHMETIC RATHER THAN AS A SWEEP.
    // A daily session opens with warm-ups; if those could be lost by letting go
    // of the screen, showing up every day would be a tax. The guarantee is that
    // the MOST sag the sim can produce at these loads — the longest possible
    // beat, spent entirely not holding — is still short of the drop threshold.
    //
    // EVALUATED THROUGH `byLoad` AT THE PRESET, WHICH IS THE WHOLE POINT. The
    // first draft of `LOCKOUT_SAG_PER_TICK`'s comment reasoned from the LIGHT
    // ENDPOINT instead, claimed a comfortable margin, and the real margin at
    // `LOAD_PRESETS.LIGHT` was half a tick. This file's header warns that
    // endpoints are not presets; that warning is what this test enforces.
    for (const preset of ['WARMUP', 'LIGHT'] as const) {
      const load = LOAD_PRESETS[preset];
      expect(
        ticksToDrop(load),
        `${preset} (${load}) drops after ${ticksToDrop(load).toFixed(1)} ticks, worst case ${worstSagTicks}`,
      ).toBeGreaterThan(worstSagTicks);
    }
  });

  it('does let a heavy bar be dropped, or the beat asks nothing', () => {
    // THE OTHER HALF, AND WITHOUT IT THE TEST ABOVE IS SATISFIED BY SETTING THE
    // SAG RATE TO ZERO. A mechanic that can never fire is decoration; a §12.3
    // guarantee bought by deleting the mechanic is not a guarantee, it is a
    // removal. So the same arithmetic has to come out the other way at the top
    // of the load range.
    for (const preset of ['MODERATE', 'HEAVY', 'MAXIMAL'] as const) {
      const load = LOAD_PRESETS[preset];
      expect(ticksToDrop(load), `${preset} (${load})`).toBeLessThan(worstSagTicks);
    }
  });

  it('leaves a window in which letting go is actually charged', () => {
    // If the grace period ever reached the shortest possible hold, a player
    // could release the instant they locked out and the down command would
    // always rescue them before any sag was counted. The beat would be a pause
    // with a haptic on it.
    expect(LIFT_TUNING.LOCKOUT_GRIP_GRACE_TICKS).toBeLessThan(
      LIFT_TUNING.DOWN_COMMAND_DELAY_TICKS.MIN,
    );
    expect(LIFT_TUNING.LOCKOUT_GRIP_GRACE_TICKS).toBeGreaterThan(0);
  });

  it('keeps the hold unguessable rather than a fixed beat with noise on it', () => {
    // A fixed hold is learnable in about three reps, and a learned hold is an
    // ANTICIPATION check — squat's faculty under deadlift's name, which is the
    // failure the whole beat exists to avoid. The spread has to be a real
    // fraction of the beat, not a jitter.
    const { MIN, MAX } = LIFT_TUNING.DOWN_COMMAND_DELAY_TICKS;
    expect(MIN).toBeGreaterThan(0);
    expect(MAX).toBeGreaterThan(MIN);
    expect(MAX - MIN).toBeGreaterThan(MIN);
  });

  it('makes a slip recoverable faster than it is lost, at every load', () => {
    // A slip that cannot be caught is a delayed miss the player watches happen.
    // Recovery has to outrun the worst sag or re-gripping is theatre.
    for (const load of Object.values(LOAD_PRESETS)) {
      expect(
        LIFT_TUNING.LOCKOUT_REGRIP_RECOVERY_PER_TICK,
        `load ${load}`,
      ).toBeGreaterThan(byLoad(LIFT_TUNING.LOCKOUT_SAG_PER_TICK, clampLoadRatio(load)));
    }
  });

  it('leaves room for a grind between a clean hold and a dropped one', () => {
    // Three outcomes, not two. A slip long enough to be called a grind must be
    // reachable BEFORE the bar is lost, or the middle outcome is unreachable
    // and every deadlift is pass/fail.
    for (const load of Object.values(LOAD_PRESETS)) {
      const toDrop = ticksToDrop(load);
      if (toDrop > worstSagTicks) continue; // undroppable loads have no upper edge
      expect(LIFT_TUNING.LOCKOUT_SLIP_GRIND_TICKS, `load ${load}`).toBeLessThan(toDrop);
    }
    expect(LIFT_TUNING.LOCKOUT_SLIP_GRIND_TICKS).toBeGreaterThan(0);
  });

  it('starts the deadlift slower off the floor than either lift starts out of the bottom', () => {
    // THE ABSENCE THAT DEFINES THE LIFT. Squat's ascent velocity is bought by
    // the depth release and bench's by the reaction; a deadlift's is a function
    // of the weight alone, because there was no beat before it to play well.
    // Pinned as an ordering rather than a value so a retune of any of the three
    // keeps the relationship a reader was told about.
    expect(LIFT_TUNING.FLOOR_BREAK_VELOCITY.MAXIMAL).toBeLessThan(
      LIFT_TUNING.REVERSAL_VELOCITY.MAX,
    );
    expect(LIFT_TUNING.FLOOR_BREAK_VELOCITY.MAXIMAL).toBeLessThan(
      LIFT_TUNING.PRESS_VELOCITY.MAX,
    );
    // ...and not zero, or a maximal pull spends its first ticks under
    // GRIND_STALL_VELOCITY purely accelerating and is called a grind for a
    // reason that has nothing to do with how it was played.
    expect(LIFT_TUNING.FLOOR_BREAK_VELOCITY.MAXIMAL).toBeGreaterThan(0);
    expect(LIFT_TUNING.FLOOR_BREAK_VELOCITY.LIGHT).toBeGreaterThan(
      LIFT_TUNING.FLOOR_BREAK_VELOCITY.MAXIMAL,
    );
  });

  it('puts the deadlift stick above both other lifts, and not by widening it', () => {
    // GDD §6.2 says "lockout grind", so the stall belongs high in the range.
    // The WIDTH is squat's, deliberately — a first pass widened it too and made
    // a perfectly-driven maximal pull unwinnable (see `STICK_WIDTH`'s header).
    // This pins both halves so the refuted guess cannot come back quietly.
    expect(STICK_HEIGHT_FRAC.deadlift).toBeGreaterThan(STICK_HEIGHT_FRAC.squat);
    expect(STICK_HEIGHT_FRAC.deadlift).toBeGreaterThan(STICK_HEIGHT_FRAC.bench);
    expect(STICK_WIDTH.deadlift).toBeLessThanOrEqual(STICK_WIDTH.squat);
  });
});

describe('the force balance', () => {
  const demandPeak = (kind: PlayableLiftKind, load: number): number =>
    byLoad(LIFT_TUNING.DEMAND_BASE[kind], clampLoadRatio(load)) +
    byLoad(LIFT_TUNING.DEMAND_STICK_GAIN[kind], clampLoadRatio(load));

  it('gives a limit attempt a sticking point the lifter cannot hold, for every playable kind', () => {
    // Without this there is no grind, the drive input does nothing, and the
    // mechanic is a cutscene with a button on it.
    for (const kind of PLAYABLE_LIFT_KINDS) {
      expect(demandPeak(kind, LOAD_PRESETS.MAXIMAL), kind).toBeGreaterThan(
        LIFT_TUNING.LIFTER_CAPACITY,
      );
    }
  });

  it('leaves a warm-up with no sticking point at all, for every playable kind', () => {
    for (const kind of PLAYABLE_LIFT_KINDS) {
      expect(demandPeak(kind, LOAD_PRESETS.WARMUP), kind).toBeLessThan(
        LIFT_TUNING.LIFTER_CAPACITY,
      );
    }
  });

  it('makes a full-quality drive enough to clear the worst deficit, for every playable kind', () => {
    // The other half of the same coin: if the boost cannot cover the deficit at
    // the top of the load range, a maximal attempt is unwinnable however it is
    // played, and the timing input is decoration.
    for (const kind of PLAYABLE_LIFT_KINDS) {
      const worstDeficit = demandPeak(kind, LOAD_RANGE.MAX) - LIFT_TUNING.LIFTER_CAPACITY;
      expect(LIFT_TUNING.DRIVE_BOOST_FORCE_MAX, kind).toBeGreaterThan(worstDeficit);
    }
  });

  it('arms the drive cue below the sticking point, not after it, for every playable kind', () => {
    for (const kind of PLAYABLE_LIFT_KINDS) {
      expect(LIFT_TUNING.DRIVE_ARM_HEIGHT[kind], kind).toBeLessThan(STICK_HEIGHT_FRAC[kind]);
      expect(LIFT_TUNING.DRIVE_ARM_HEIGHT[kind], kind).toBeGreaterThan(0);
    }
  });

  it('keeps the stall-decay trigger below the grind threshold', () => {
    // Merging these two produced a death spiral: a bar driven well enough to
    // creep was charged decay for the ticks the velocity lag took to catch up,
    // which lowered its target, which charged more decay.
    expect(LIFT_TUNING.STALL_DECAY_VELOCITY).toBeLessThan(LIFT_TUNING.GRIND_STALL_VELOCITY);
    expect(LIFT_TUNING.STALL_DECAY_VELOCITY).toBeGreaterThan(0);
  });

  it('cannot decay the lifter to a standstill', () => {
    expect(LIFT_TUNING.STALL_CAPACITY_DECAY_MAX).toBeLessThan(LIFT_TUNING.LIFTER_CAPACITY);
    expect(LIFT_TUNING.STALL_CAPACITY_DECAY_PER_TICK).toBeGreaterThan(0);
  });

  it('keeps the velocity model inside sane bounds', () => {
    expect(LIFT_TUNING.VELOCITY_RESPONSE).toBeGreaterThan(0);
    expect(LIFT_TUNING.VELOCITY_RESPONSE).toBeLessThanOrEqual(1);
    expect(LIFT_TUNING.VELOCITY_PER_NET_FORCE).toBeGreaterThan(0);
    expect(LIFT_TUNING.MAX_RISE_VELOCITY).toBeGreaterThan(0);
    expect(LIFT_TUNING.MAX_SINK_VELOCITY).toBeGreaterThan(0);
    // A full ascent must not be possible in fewer ticks than the eye can read.
    expect(1 / LIFT_TUNING.MAX_RISE_VELOCITY).toBeGreaterThan(TICK_HZ / 4);
  });

  it('gives the collapse rule room to fire before the timeout does', () => {
    const ticksToCollapse =
      LIFT_TUNING.ASCENT_COLLAPSE_DROP / LIFT_TUNING.MAX_SINK_VELOCITY;
    expect(ticksToCollapse).toBeLessThan(LIFT_TUNING.ASCENT_TIMEOUT_TICKS);
    expect(LIFT_TUNING.ASCENT_COLLAPSE_DROP).toBeGreaterThan(0);
  });
});

describe('windows', () => {
  it('are positive and at least a few ticks wide, at both ends of the load range, for every playable kind', () => {
    // The drive window is on all three lifts; the depth window is only on the
    // one that is graded on a release tick, and bench's BURST window replaces
    // the depth window it used to have. All three are gathered per kind rather
    // than listed in one array so the domain is the type's rather than a
    // list somebody maintains.
    for (const kind of PLAYABLE_LIFT_KINDS) {
      const ms = [
        LIFT_TUNING.DRIVE_WINDOW_MS[kind].LIGHT,
        LIFT_TUNING.DRIVE_WINDOW_MS[kind].MAXIMAL,
        ...(kind === 'squat' ? [LIFT_TUNING.DEPTH_WINDOW_MS[kind]] : []),
        ...(kind === 'bench' ? [LIFT_TUNING.PRESS_BURST_WINDOW_MS] : []),
      ];
      for (const width of ms) {
        expect(width, kind).toBeGreaterThan(0);
        // Narrower than about four ticks and the window cannot be hit reliably at
        // 60 Hz even before fatigue tightens it.
        expect(width / TICK_MS, kind).toBeGreaterThan(4);
      }
    }
  });

  it('keep a perfect band that is neither the whole window nor nothing', () => {
    expect(LIFT_TUNING.PERFECT_BAND_FRACTION).toBeGreaterThan(0);
    expect(LIFT_TUNING.PERFECT_BAND_FRACTION).toBeLessThan(1);
  });

  it('open the drive cue after arming, not before it, at every load, for every playable kind', () => {
    // Checked at both endpoints, not the middle: DRIVE_WINDOW_MS is now
    // load-scaled, and `byLoad`'s interpolation never overshoots its own
    // endpoints, so an invariant true at LIGHT and at MAXIMAL is true
    // everywhere `byLoad` can return.
    for (const kind of PLAYABLE_LIFT_KINDS) {
      expect(LIFT_TUNING.DRIVE_IDEAL_LEAD_MS, kind).toBeGreaterThan(
        LIFT_TUNING.DRIVE_WINDOW_MS[kind].LIGHT / 2,
      );
      expect(LIFT_TUNING.DRIVE_IDEAL_LEAD_MS, kind).toBeGreaterThan(
        LIFT_TUNING.DRIVE_WINDOW_MS[kind].MAXIMAL / 2,
      );
    }
  });

  it('the drive window tightens toward MAXIMAL, and DEPTH stays a single number, for every playable kind', () => {
    // Sprint 3's gate: a heavier attempt asks for more PRECISION on the
    // drive specifically, not on the release — see DRIVE_WINDOW_MS's own
    // comment for why the two halves are not tightened together.
    for (const kind of PLAYABLE_LIFT_KINDS) {
      expect(LIFT_TUNING.DRIVE_WINDOW_MS[kind].MAXIMAL, kind).toBeLessThan(
        LIFT_TUNING.DRIVE_WINDOW_MS[kind].LIGHT,
      );
    }
    // The depth half, on the one kind that has one.
    for (const kind of DEPTH_TIMED_LIFT_KINDS) {
      expect(typeof LIFT_TUNING.DEPTH_WINDOW_MS[kind], kind).toBe('number');
    }
    // ...and bench's replacement for it, which is a single number for the same
    // reason: how many taps a thumb throws is not a function of the load.
    expect(typeof LIFT_TUNING.PRESS_BURST_WINDOW_MS).toBe('number');
  });

  it('offers at least one drive cue everywhere, and more only toward MAXIMAL, for every playable kind', () => {
    // Sprint 3's gate, the tap-RATE half: a heavier attempt asks for MORE
    // cues, closer together — the title this test replaces asserted the
    // opposite design ("a decision, not a rate"), which is exactly what
    // that playtest finding overturned.
    for (const kind of PLAYABLE_LIFT_KINDS) {
      const attempts = LIFT_TUNING.DRIVE_ATTEMPTS_PER_REP[kind];
      expect(attempts.LIGHT, kind).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(attempts.LIGHT), kind).toBe(true);
      expect(Number.isInteger(attempts.MAXIMAL), kind).toBe(true);
      expect(attempts.MAXIMAL, kind).toBeGreaterThan(attempts.LIGHT);
    }
  });

  it('a maximal attempt fits its full cue sequence inside the ascent timeout, with room to spare, for every playable kind', () => {
    // Not a game-feel claim — a structural one, and deliberately scoped to
    // what a tuning-only test can derive: the SPAN of the cue sequence
    // itself, from the first cue arming to the last cue's window closing at
    // the worst legal instant (every gap the full spacing, every window
    // ridden to its close). It says nothing about how long the ascent takes
    // to REACH `DRIVE_ARM_HEIGHT` in the first place — that depends on the
    // ascent's own physics (velocity, demand), which is `lift.test.ts`'s
    // played-rep territory, not this file's. What this checks is that the
    // sequence this file's numbers describe does not itself exceed the
    // timeout budget before a player has done anything wrong.
    for (const kind of PLAYABLE_LIFT_KINDS) {
      const attempts = LIFT_TUNING.DRIVE_ATTEMPTS_PER_REP[kind].MAXIMAL;
      const windowMs = LIFT_TUNING.DRIVE_WINDOW_MS[kind].MAXIMAL;
      const spacingMs = LIFT_TUNING.DRIVE_ATTEMPTS_SPACING_MS[kind].MAXIMAL;
      const worstCaseMs =
        LIFT_TUNING.DRIVE_IDEAL_LEAD_MS +
        windowMs / 2 +
        (attempts - 1) * (spacingMs + LIFT_TUNING.DRIVE_IDEAL_LEAD_MS + windowMs / 2);
      const budgetMs = LIFT_TUNING.ASCENT_TIMEOUT_TICKS * TICK_MS;
      expect(worstCaseMs, kind).toBeLessThan(budgetMs);
    }
  });
});

// ---------------------------------------------------------------------------
// Haptics and copy
// ---------------------------------------------------------------------------

const KNOWN_STYLES: readonly HapticStyle[] = [
  'selection',
  'light',
  'medium',
  'heavy',
  'rigid',
  'soft',
  'success',
  'warning',
  'error',
];

describe('haptics', () => {
  it('has at least one beat per pattern, with a known style', () => {
    for (const [name, p] of Object.entries(LIFT_TUNING.HAPTICS)) {
      expect(p.beats.length, name).toBeGreaterThan(0);
      for (const beat of p.beats) {
        expect(KNOWN_STYLES, `${name} style`).toContain(beat.style);
        expect(beat.delayMs, `${name} delay`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('orders the beats of each pattern forward in time', () => {
    for (const [name, p] of Object.entries(LIFT_TUNING.HAPTICS)) {
      let previous = -Infinity;
      for (const beat of p.beats) {
        expect(beat.delayMs, name).toBeGreaterThanOrEqual(previous);
        previous = beat.delayMs;
      }
    }
  });

  it('gives a perfect drive a bigger pattern than a scruffy one', () => {
    // Not a claim that it feels better. A claim that the two are distinguishable
    // at all, which a table that had drifted into using one pattern for both
    // would not be.
    expect(LIFT_TUNING.HAPTICS.DRIVE_PERFECT.beats.length).toBeGreaterThan(
      LIFT_TUNING.HAPTICS.DRIVE_LOOSE.beats.length,
    );
  });

  it('pulses the stall on a period the ear and hand can separate', () => {
    expect(LIFT_TUNING.STALL_PULSE_PERIOD_TICKS).toBeGreaterThan(1);
    expect(LIFT_TUNING.STALL_PULSE_PERIOD_TICKS * TICK_MS).toBeGreaterThan(50);
  });
});

describe('presentation feel', () => {
  it('has positive durations and a legible cue ring', () => {
    const f = LIFT_TUNING.FEEDBACK;
    expect(f.CUE_RING_OUTER_R).toBeGreaterThan(f.CUE_RING_INNER_R);
    expect(f.CUE_RING_INNER_R).toBeGreaterThan(0);
    expect(f.CUE_RING_STROKE).toBeGreaterThan(0);
    for (const ms of [
      f.CUE_PULSE_MS,
      f.HIT_FLASH_MS,
      f.SHAKE_PERIOD_MS,
      f.OUTCOME_FADE_MS,
      f.LIGHT_REVEAL_STAGGER_MS,
    ]) {
      expect(ms).toBeGreaterThan(0);
    }
    expect(f.TRACE_MAX_POINTS).toBeGreaterThan(1);
    expect(f.TRACE_MIN_ALPHA).toBeGreaterThanOrEqual(0);
    expect(f.TRACE_MIN_ALPHA).toBeLessThan(1);
  });

  it('keeps the sprite on an integer nearest-neighbour scale (GDD §7.1)', () => {
    // A fractional upscale produces uneven pixel sizes and is the single most
    // common way pixel art gets ruined in a mobile app.
    expect(Number.isInteger(LIFT_TUNING.FEEDBACK.SPRITE_SCALE)).toBe(true);
    expect(LIFT_TUNING.FEEDBACK.SPRITE_SCALE).toBeGreaterThanOrEqual(1);
  });
});

/**
 * Number words, so a copy line can name a tuned count without putting a digit
 * in front of the player.
 *
 * IT EXISTS BECAUSE THE COPY MAY NOT CARRY DIGITS — the test directly above
 * this block bans `/\\d/` anywhere in `LIFT_COPY`, since a percentage or a
 * level in that table is how a fatigue meter ships by accident (GDD §3.4,
 * §12.3). The false-start rule has to name its floor to be a rule the player
 * can act on, so the number is spelled and this is what ties the spelling back
 * to the constant.
 */
const NUMBER_WORDS: Readonly<Record<number, string>> = {
  1: 'one',
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
};

describe('copy', () => {
  it('says something for every prompt, for every playable kind where one applies', () => {
    // "WHERE ONE APPLIES" IS NOW LOAD-BEARING RATHER THAN HEDGING, and it is
    // read off the table itself instead of from a list somebody maintains: a
    // per-kind prompt table is walked over exactly the keys it actually has, so
    // DESCENT/HOLE (eccentric-only) are checked for two kinds and BRACE/LOCKOUT
    // for three. A missing entry in either shape is still a failure, because
    // the count is pinned below.
    let checked = 0;
    for (const [key, value] of Object.entries(LIFT_COPY.PROMPT)) {
      if (typeof value === 'string') {
        expect(value.length, key).toBeGreaterThan(0);
        checked += 1;
        continue;
      }
      const kinds = Object.keys(value);
      expect(kinds.length, `${key} has no kinds`).toBeGreaterThan(0);
      const byKind = value as Readonly<Record<string, string>>;
      for (const kind of kinds) {
        expect(byKind[kind]?.length, `${key}.${kind}`).toBeGreaterThan(0);
        checked += 1;
      }
    }
    // A COUNT, NOT A BOUND — an emptied table would otherwise pass this loop
    // silently, which is the "empty domain" vacuity CLAUDE.md names. Two
    // eccentric-only tables at 2 kinds (DESCENT, HOLE) + two all-kind tables at
    // 3 (BRACE, LOCKOUT) + FIVE plain strings (HOLE_FALSE_START,
    // HOLE_COMMANDED, ASCENT_BEFORE_CUE, ASCENT_CUE_OPEN, ASCENT_AFTER_CUE) +
    // two more (LOCKOUT_DOWN_COMMANDED, RESOLVED) = 4 + 6 + 7 = 17.
    //
    // 16 -> 17 when the 2026-08-25 ruling added `HOLE_FALSE_START`, the line a
    // bench player is shown at the moment they jump the call.
    expect(checked, 'prompt strings checked').toBe(17);
  });

  it('never puts a number in the copy the player reads', () => {
    // A percentage or a level in this table is how a fatigue meter gets shipped
    // by accident (GDD §3.4, §12.3).
    const all = JSON.stringify(LIFT_COPY);
    expect(all).not.toMatch(/\d/);
  });

  it('tells the player to tap the drive cue, not to hold', () => {
    // Finding 1 (2026-08-20) decoupled the boost from `held`. A revert of the
    // copy to "HOLD IT" / "HOLD" would pass every promptFor test — they read
    // the constant, not its text — and lie on the phone again, which is
    // exactly what a real playtest caught.
    //
    // Both pinned to their exact strings, not merely "not hold" — a
    // not.toMatch(/hold/i) alone would pass ASCENT_AFTER_CUE unchanged if it
    // were edited to any other non-hold word, silently losing the "same as
    // before a cue" unification the phone fix intentionally made.
    expect(LIFT_COPY.PROMPT.ASCENT_CUE_OPEN).toBe('DRIVE — TAP');
    expect(LIFT_COPY.PROMPT.ASCENT_AFTER_CUE).toBe('RIDE IT');
    expect(LIFT_COPY.PROMPT.ASCENT_CUE_OPEN).not.toMatch(/hold/i);
    expect(LIFT_COPY.PROMPT.ASCENT_AFTER_CUE).not.toMatch(/hold/i);
  });

  it('does not tell the player the drive is a single tap', () => {
    // DRIVE_ATTEMPTS_PER_REP is { LIGHT: 1, MAXIMAL: 3 } — heavy sets arm
    // more than one drive cue. "one timed tap" described LIGHT correctly and
    // lied about MAXIMAL, which is what the phone playtest actually caught.
    //
    // Pinned to the exact string, not just the pattern checks below it — the
    // pattern checks alone would pass any rewrite that happens to contain
    // "tap" and avoid "one tap", which is not the same as this being the
    // sentence a human actually approved.
    expect(LIFT_COPY.SUBTITLE.squat).toBe(
      'Two moments, not two motions: release at the bottom, tap every drive cue. Catch the beat.',
    );
    for (const kind of PLAYABLE_LIFT_KINDS) {
      expect(LIFT_COPY.SUBTITLE[kind], kind).not.toMatch(/one timed tap/i);
      expect(LIFT_COPY.SUBTITLE[kind], kind).not.toMatch(/\bone tap\b/i);
      expect(LIFT_COPY.SUBTITLE[kind].toLowerCase(), kind).toMatch(/tap/);
    }
  });

  it('gives bench instructions that describe bench, not squat', () => {
    // The copy half of the same phone finding that produced the press command,
    // rewritten for the 2026-08-25 ruling. A player told to "release at the
    // bottom" has been handed squat's instructions on a lift whose beats are a
    // controlled descent and a burst — so this pins that bench's line names all
    // three beats, and that the two lifts do not ship the same sentence.
    const bench = LIFT_COPY.SUBTITLE.bench;
    expect(bench).not.toBe(LIFT_COPY.SUBTITLE.squat);
    expect(bench.toLowerCase()).toMatch(/wait/);
    expect(bench.toLowerCase()).toMatch(/press/);
    expect(bench.toLowerCase()).toMatch(/chest/);
    // The descent is a control beat now, and the burst is taps, so both words
    // have to be in the instructions or the line describes the beat it
    // replaced. "Wait for the call, then press the instant it comes" was the
    // old sentence and it is false of this mechanic in both halves.
    expect(bench.toLowerCase()).toMatch(/control/);
    expect(bench.toLowerCase()).toMatch(/tap/);
    expect(bench.toLowerCase()).not.toMatch(/the instant it comes/);
    // ...and it must not tell a bench player to look for a squat's bottom.
    expect(bench.toLowerCase()).not.toMatch(/\bat the bottom\b/);
  });

  it('states the false-start rule, floor included, in the words the sim enforces', () => {
    // THE COPY AND THE MECHANIC ARE ONE CLAIM HERE, and this is the half that
    // keeps the sentence honest. `lift.test.ts` drives each clause through the
    // sim; this pins that the sentence still SAYS each clause, including the
    // floor — which is the part a rewrite would drop first, because it reads
    // like a detail and is the whole of "must not silently kill the rep".
    const bench = LIFT_COPY.SUBTITLE.bench.toLowerCase();
    expect(bench).toMatch(/before the call/);
    expect(bench).toMatch(/count for nothing/);
    expect(bench).toMatch(/costs a tap/);
    // The floor, spelled out — the copy carries no digits (the test above pins
    // that), so the number is a word and the word has to match the constant.
    expect(NUMBER_WORDS[LIFT_TUNING.PRESS_BURST_FORCE.FALSE_START_FLOOR_TAPS]).toBeDefined();
    expect(bench).toMatch(
      new RegExp(`floor of ${NUMBER_WORDS[LIFT_TUNING.PRESS_BURST_FORCE.FALSE_START_FLOOR_TAPS]}`),
    );
    // ...and the prompt that says it happened is a real line, distinct from
    // the waiting line it replaces.
    expect(LIFT_COPY.PROMPT.HOLE_FALSE_START).not.toBe(LIFT_COPY.PROMPT.HOLE.bench);
    expect(LIFT_COPY.PROMPT.HOLE_FALSE_START.toLowerCase()).toMatch(/call/);
  });

  it('tells the bench player to tap the command, not to press it once', () => {
    // The same defect the drive cue shipped once — "DRIVE — HOLD IT" over a
    // mechanic that wanted taps — one beat earlier. `HOLE_COMMANDED` read
    // 'PRESS!' while one press was the answer; one press is not the answer any
    // more. Exact-pinned, not merely pattern-matched, for the reason the drive
    // copy above is: a pattern check passes any rewrite that happens to
    // contain the word.
    expect(LIFT_COPY.PROMPT.HOLE_COMMANDED).toBe('PRESS — TAP FAST');
    expect(LIFT_COPY.PROMPT.HOLE_COMMANDED.toLowerCase()).toMatch(/tap/);
    expect(LIFT_COPY.PROMPT.HOLE_COMMANDED).not.toBe('PRESS!');
  });

  it('does not tell a bench player to descend to depth', () => {
    // Same phone finding as the subtitle pin above: BRACE and DESCENT were
    // still squat sentences on a bench rep ("TAP AND HOLD TO DESCEND" /
    // "RELEASE AT DEPTH"), so the controls read as a squat even after the
    // press command existed. Squat's wording is unchanged and exact-pinned.
    expect(LIFT_COPY.PROMPT.BRACE.squat).toBe('TAP AND HOLD TO DESCEND');
    expect(LIFT_COPY.PROMPT.DESCENT.squat).toBe('RELEASE AT DEPTH');
    expect(LIFT_COPY.PROMPT.BRACE.bench).not.toBe(LIFT_COPY.PROMPT.BRACE.squat);
    expect(LIFT_COPY.PROMPT.DESCENT.bench).not.toBe(LIFT_COPY.PROMPT.DESCENT.squat);
    expect(LIFT_COPY.PROMPT.BRACE.bench).not.toMatch(/descend/i);
    expect(LIFT_COPY.PROMPT.DESCENT.bench).not.toMatch(/depth/i);
    // AND IT NAMES A CONTROL INPUT RATHER THAN A DESTINATION. 'TOUCH THE
    // CHEST' described the beat this replaced — hold, then release at a depth
    // — and the bar arrives at the chest by itself now, so a line telling the
    // player to touch it is an instruction to do nothing. What they can act on
    // is how it gets there.
    expect(LIFT_COPY.PROMPT.DESCENT.bench).toBe('EASE IT DOWN');
    expect(LIFT_COPY.PROMPT.DESCENT.bench).not.toBe('TOUCH THE CHEST');
  });
});

// ---------------------------------------------------------------------------
// THE MAGIC-NUMBER SCAN — THIS ONE IS LOCAL AND IS NOT THE AUTHORITY
//
// CLAUDE.md: "Never scatter them as magic numbers across components."
//
// `src/tuning/audit.ts` is the tree-wide enforcement of that rule and it is
// STRICTER than what follows: it understands regex literals and template
// interpolations, and it does not treat a bare `2` in a property-value
// position as structural. What is kept here is what it does NOT do — the
// dead-knob sweep over `LIFT_TUNING`'s own keys, and the structural fence that
// keeps a base window width out of the renderer. Those are about this file's
// contents, not about the tree, so they belong beside this file.
//
// The numeric scan below is therefore redundant but not wrong. It is left in
// place because a second, independently written scan over the same directory
// is cheap insurance against a bug in the first one.
// ---------------------------------------------------------------------------

/** Strip comments and string literals so only real code is scanned. */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``');
}

/**
 * Numeric literals that are structure rather than feel.
 *
 * 0, 1 and 2 are indices, halves, and the identity of a multiplier. Anything
 * else in these files is a value somebody would want to turn by hand, and it
 * belongs in `LIFT_TUNING`.
 */
const STRUCTURAL = new Set(['0', '1', '2']);

/**
 * THE LEADING-DOT HOLE, and why the pattern is two alternatives.
 *
 * This used to be `(?<![\w.$])\d+(?:\.\d+)?`, which requires a literal to start
 * with a DIGIT. JavaScript does not: `x * .5` and `{ gain: .35 }` are perfectly
 * ordinary, and the lookbehind then rejected the `5` outright because the
 * character before it is a `.`. So the single most natural way to write a
 * fractional feel value walked straight through the scan.
 *
 * The `\.\d+` alternative closes it. Order matters and it is second: at a
 * position inside `1.5` the first alternative matches the whole literal and
 * consumes the fraction, so a normal decimal is still reported once, as
 * `1.5`, rather than twice. Member access cannot be caught by the new branch —
 * an identifier may not start with a digit, so `pose.hipY` has nothing for
 * `\.\d+` to match, and `arr[0].x` is covered by the lookbehind.
 */
const NUMERIC_LITERAL = /(?<![\w.$])(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?/gi;

function magicNumbersIn(source: string): string[] {
  const code = codeOnly(source);
  const found: string[] = [];
  for (const match of code.matchAll(NUMERIC_LITERAL)) {
    const literal = match[0];
    if (STRUCTURAL.has(literal)) continue;
    found.push(literal);
  }
  return found;
}

function sourcesUnder(dir: string, extensions: readonly string[]): { file: string; source: string }[] {
  const out: { file: string; source: string }[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry);
    if (entry.endsWith('.test.ts') || entry.endsWith('.test.tsx')) continue;
    if (extensions.some((e) => entry.endsWith(e))) {
      out.push({ file: full, source: readFileSync(full, 'utf8') });
    }
  }
  return out;
}

/**
 * Tuning keys that nothing in `sources` READS.
 *
 * Through `codeOnly`, which is the whole point and which it did not used to do.
 * The scan used to substring-match the raw file text, so a key MENTIONED IN A
 * COMMENT counted as read — and a comment naming a tuning value is exactly
 * where one ends up after the code that read it is deleted, which is the shape
 * of dead knob this test exists to catch. These files are dense with comments
 * naming their own constants, so the hole was not theoretical.
 */
function deadKeys(keys: readonly string[], sources: readonly string[]): string[] {
  const code = sources.map(codeOnly).join('\n');
  return keys.filter((key) => !code.includes(key));
}

describe('no feel value lives outside this file', () => {
  it('keeps the mechanic itself free of bare numbers', () => {
    const source = readFileSync(path.join(HERE, 'lift.ts'), 'utf8');
    expect(magicNumbersIn(source)).toEqual([]);
  });

  it('keeps every lift component and adapter free of bare numbers', () => {
    const liftDir = path.join(HERE, '..', 'lift');
    const files = sourcesUnder(liftDir, ['.ts', '.tsx']);
    // If this ever finds nothing, the rule is being enforced against an empty
    // set and the test is worthless. The renderer must exist.
    expect(files.length).toBeGreaterThan(0);
    for (const { file, source } of files) {
      expect(magicNumbersIn(source), path.basename(file)).toEqual([]);
    }
  });

  it('has no dead knob: every tuning value is read by something', () => {
    // A constant nobody reads is worse than a magic number. A playtester turns
    // it, nothing happens, and they lose trust in the whole file. This caught
    // five: SHAKE_MAX_PX, SHAKE_PERIOD_MS, HIT_FLASH_MS, CUE_PULSE_MS and
    // LIGHT_REVEAL_STAGGER_MS were all declared and none was wired up.
    //
    // See `deadKeys` for why the scan goes through `codeOnly`.
    const sources = [
      ...sourcesUnder(HERE, ['.ts']),
      ...sourcesUnder(path.join(HERE, '..', 'lift'), ['.ts', '.tsx']),
    ]
      .filter((f) => !f.file.endsWith('liftTuning.ts'))
      .map((f) => f.source);
    expect(sources.length).toBeGreaterThan(0);

    const keys: string[] = [
      ...Object.keys(LIFT_TUNING),
      ...Object.keys(LIFT_TUNING.FEEDBACK),
      ...Object.keys(LIFT_TUNING.LAYOUT),
      ...Object.keys(LIFT_TUNING.DEMO),
      // Nested one level down, and previously unchecked entirely — which is how
      // a phase weighting nothing reads could have been added without anything
      // noticing. `codeOnly` strips the `'BRACE'`/`'HOLE'` phase-name strings,
      // so what remains is the `w.BRACE` style access in `liveStrain`.
      ...Object.keys(LIFT_TUNING.STRAIN_PHASE_WEIGHT),
    ];
    const dead = deadKeys(keys, sources);
    expect(dead, `unused tuning values: ${dead.join(', ')}`).toEqual([]);
  });

  it('would call a knob dead if its only mention were a comment', () => {
    // The dead-knob scan, run against sources built to defeat it. Without
    // `codeOnly` the first two cases come back clean and the guard is a
    // rubber stamp on any constant whose reader has been deleted.
    expect(deadKeys(['GHOST_KNOB'], ['// GHOST_KNOB used to scale the shake'])).toEqual([
      'GHOST_KNOB',
    ]);
    expect(deadKeys(['GHOST_KNOB'], ['/* see GHOST_KNOB */ const x = 1;'])).toEqual(['GHOST_KNOB']);
    expect(deadKeys(['GHOST_KNOB'], ["const label = 'GHOST_KNOB';"])).toEqual(['GHOST_KNOB']);
    // ...and a real read still counts as read, or the guard would fail on
    // everything and say nothing.
    expect(deadKeys(['GHOST_KNOB'], ['const a = LIFT_TUNING.GHOST_KNOB;'])).toEqual([]);
  });

  it('keeps the base window widths out of the renderer (GDD §3.4, §12.3)', () => {
    // A FATIGUE METER BY THE BACK DOOR, closed structurally.
    //
    // `CueWindow.widthMs` is the window AFTER fatigue has narrowed it. A
    // component that divided it by `LIFT_TUNING.DRIVE_WINDOW_MS` would have a
    // 0..1 fatigue ratio, and a 0..1 ratio one `<View style={{width}}>` away
    // from being the meter §12.3 refuses. The adjusted width cannot be hidden —
    // `(closeTick - idealTick) * TICK_MS * 2` reconstructs it, and the tick
    // bounds are what the cue ring is drawn from — so the DENOMINATOR is what
    // gets kept away instead.
    //
    // Nothing under `src/lift/` has any use for a base width: the ring is sized
    // from `cueProgress`, which is already normalised. So mentioning one at all
    // is the tell.
    const files = sourcesUnder(path.join(HERE, '..', 'lift'), ['.ts', '.tsx']);
    expect(files.length).toBeGreaterThan(0);
    for (const { file, source } of files) {
      const code = codeOnly(source);
      for (const base of ['DEPTH_WINDOW_MS', 'DRIVE_WINDOW_MS']) {
        expect(code, `${path.basename(file)} reads ${base}`).not.toContain(base);
      }
    }
    // ...and the scan is not vacuous: it does find them where they belong.
    expect(codeOnly(readFileSync(path.join(HERE, 'lift.ts'), 'utf8'))).toContain(
      'DRIVE_WINDOW_MS',
    );
  });

  it('actually detects a bare number, so the scan is not vacuous', () => {
    expect(magicNumbersIn('const windowMs = 240;')).toEqual(['240']);
    expect(magicNumbersIn('const scale = 0.85;')).toEqual(['0.85']);
    // THE LEADING-DOT HOLE, pinned. Every one of these walked through the old
    // pattern untouched, which made `x * .5` the safe way to smuggle a feel
    // value into a component.
    expect(magicNumbersIn('const scale = .85;')).toEqual(['.85']);
    expect(magicNumbersIn('const half = x * .5;')).toEqual(['.5']);
    expect(magicNumbersIn('const o = { gain: .35, drop: .1 };')).toEqual(['.35', '.1']);
    // ...and a normal decimal is still reported once, whole, not split in two.
    expect(magicNumbersIn('const a = 1.5;')).toEqual(['1.5']);
    expect(magicNumbersIn('const a = 10.25e-3;')).toEqual(['10.25e-3']);
    // ...and does not trip over the things it is meant to allow.
    expect(magicNumbersIn('const half = x / 2; const first = list[0];')).toEqual([]);
    expect(magicNumbersIn('// tuned to 240ms by hand')).toEqual([]);
    expect(magicNumbersIn('// half the window: .5 of it')).toEqual([]);
    expect(magicNumbersIn("const label = 'DRIVE 240';")).toEqual([]);
    expect(magicNumbersIn('const a = LIFT_TUNING.DEPTH_WINDOW_MS;')).toEqual([]);
    expect(magicNumbersIn('const y = pose.hipY - state.barForwardPx;')).toEqual([]);
  });

});
