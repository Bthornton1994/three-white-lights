/**
 * Tests for the lift input mechanic.
 *
 * ---------------------------------------------------------------------------
 * WHAT THESE CAN AND CANNOT SAY
 * ---------------------------------------------------------------------------
 * NOTHING BELOW ASSERTS THAT THE MECHANIC FEELS GOOD. It cannot; GDD §12.1 is
 * explicit that no automated check can judge whether pressing the screen to
 * grind out a squat is satisfying, and CLAUDE.md forbids claiming otherwise.
 *
 * What they do assert is the much weaker set of properties that a tuning pass
 * could plausibly break without breaking anything that looks related:
 *
 *   - the outcome space is not degenerate (all three outcomes are reachable,
 *     and which one you get depends on the input)
 *   - the drive input is load-bearing (delete it and reps still resolve, so a
 *     test that only checked "a rep resolves" would not notice)
 *   - the rep is a pure, deterministic function of (config, seed, inputs)
 *   - fatigue reaches the mechanic through the two channels GDD §3.4 allows,
 *     and no fatigue number reaches the caller
 *   - the mechanical sticking point is where the sprite system draws one
 *
 * ---------------------------------------------------------------------------
 * A NOTE ON MEASUREMENT VS PINNING
 * ---------------------------------------------------------------------------
 * Where a property is about the SHAPE of the mechanic (which outcomes exist,
 * whether timing moves them, where the bar stalls) the test MEASURES it from
 * played reps and asserts a relation. It does not pin a tick count. A pinned
 * tick count would fail on every legitimate tuning pass and pass on a mechanic
 * that had been gutted as long as the number happened to survive, which is the
 * wrong way round.
 */

import { describe, expect, it } from 'vitest';

import {
  LIFT_CUES,
  LIFT_EVENT_KINDS,
  LIFT_OUTCOMES,
  LIFT_PHASES,
  MISS_REASONS,
  TIMING_GRADES,
  ascentDemand,
  braceTicks,
  capacityScaleForBarSpeed,
  createLift,
  cueProgress,
  cueWindowMs,
  depthWindowHalfTicks,
  descentRate,
  gradeTiming,
  hapticFor,
  holeTicks,
  isGrind,
  lifterCapacity,
  lockoutTicks,
  promptFor,
  runLift,
  stepLift,
  type CueWindow,
  type LiftConfig,
  type LiftEventKind,
  type LiftOutcome,
  type LiftPhase,
  type LiftState,
  type ScriptedInput,
} from './lift';
import { nextRandom } from './prng';
import {
  LIFT_COPY,
  LIFT_TUNING,
  LOAD_PRESETS,
  LOAD_RANGE,
  STICK_HEIGHT_FRAC,
  TICK_MS,
} from './liftTuning';
import {
  BAR_SPEED_CUE_ORDER,
  EMPTY_FATIGUE_STATE,
  LUCKIEST_ROLLS,
  recordSession,
  sessionFeel,
  type SessionFeel,
} from './fatigue';
import { STICK } from '../art/spriteTuning';

// ---------------------------------------------------------------------------
// Harness. Every "played" rep in this file goes through here, so a rep in a
// test is the same object a rep in the app is.
// ---------------------------------------------------------------------------

/** Tick the player presses to start the descent. */
function pressTickFor(load: number): number {
  return braceTicks(load) + 1;
}

/** Tick at which a hold started on `pressTick` reaches `depth`. */
function releaseTickFor(load: number, depth: number): number {
  return pressTickFor(load) + Math.round(depth / descentRate(load));
}

/**
 * Find the tick the drive cue considers ideal, by playing the rep once with no
 * drive and reading the cue the sim itself armed.
 *
 * Deliberately NOT recomputed from the tuning constants: if the test derived
 * the ideal tick from `DRIVE_IDEAL_LEAD_MS` it would agree with a broken sim
 * that armed the cue at the wrong moment, which is precisely the bug worth
 * catching.
 */
function driveIdealTick(config: LiftConfig, depth: number): number | null {
  const load = config.loadRatio;
  const probe = runLift(config, [
    { tick: pressTickFor(load), kind: 'press' },
    { tick: releaseTickFor(load, depth), kind: 'release' },
  ]);
  for (const state of probe.history) {
    if (state.events.some((e) => e.kind === 'drive-cue-open')) {
      return state.activeCue?.idealTick ?? null;
    }
  }
  return null;
}

interface PlayOptions {
  readonly depth?: number;
  /** Ticks from the drive cue's ideal moment. `null` means never drive. */
  readonly driveOffsetTicks?: number | null;
  /** Ticks after the drive at which the player lets go. Defaults to never. */
  readonly releaseAfterDriveTicks?: number;
  readonly seed?: number;
  readonly feel?: SessionFeel;
}

function play(loadRatio: number, options: PlayOptions = {}): LiftState {
  const depth = options.depth ?? LIFT_TUNING.DEPTH_IDEAL;
  const config: LiftConfig = {
    loadRatio,
    seed: options.seed ?? 20260801,
    ...(options.feel === undefined ? {} : { feel: options.feel }),
  };
  const script: ScriptedInput[] = [
    { tick: pressTickFor(loadRatio), kind: 'press' },
    { tick: releaseTickFor(loadRatio, depth), kind: 'release' },
  ];
  const offset = options.driveOffsetTicks;
  if (offset !== undefined && offset !== null) {
    const ideal = driveIdealTick(config, depth);
    if (ideal !== null) {
      script.push({ tick: ideal + offset, kind: 'press' });
      if (options.releaseAfterDriveTicks !== undefined) {
        script.push({ tick: ideal + offset + options.releaseAfterDriveTicks, kind: 'release' });
      }
    }
  }
  return runLift(config, script).final;
}

/**
 * A script whose drive press lands two ticks into the ascent — after the hole,
 * long before the cue arms. The hole's tick count has to be read from the
 * mechanic rather than assumed, or the press lands inside the reversal beat,
 * where there is no cue to be early for and the press is swallowed.
 */
function earlyDriveScript(load: number): ScriptedInput[] {
  const release = releaseTickFor(load, LIFT_TUNING.DEPTH_IDEAL);
  return [
    { tick: pressTickFor(load), kind: 'press' },
    { tick: release, kind: 'release' },
    { tick: release + holeTicks(load) + 2, kind: 'press' },
  ];
}

function outcomeOf(state: LiftState): LiftOutcome {
  const resolution = state.resolution;
  if (resolution === null) throw new Error('rep did not resolve');
  return resolution.outcome;
}

/** Every outcome produced across a fine offset sweep at one load. */
function sweepOutcomes(load: number, feel?: SessionFeel): LiftOutcome[] {
  const out: LiftOutcome[] = [];
  for (let offset = -18; offset <= 18; offset += 1) {
    out.push(
      outcomeOf(
        play(load, { driveOffsetTicks: offset, ...(feel === undefined ? {} : { feel }) }),
      ),
    );
  }
  return out;
}

function primedFeel(): SessionFeel {
  return sessionFeel(EMPTY_FATIGUE_STATE, 5, {
    sleep: 'good',
    soreness: 'fresh',
    motivation: 'fired-up',
  });
}

function fatiguedFeel(): SessionFeel {
  let state = EMPTY_FATIGUE_STATE;
  for (let day = 1; day <= 4; day += 1) {
    state = recordSession(
      state,
      { day, lift: 'squat', topRpe: 9.5, workSets: 5, repsPerSet: 5 },
      LUCKIEST_ROLLS,
    ).state;
  }
  return sessionFeel(state, 5, { sleep: 'poor', soreness: 'sore', motivation: 'flat' });
}

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

describe('vocabulary', () => {
  it('lists every member of each enum exactly once', () => {
    for (const list of [
      LIFT_PHASES,
      LIFT_CUES,
      TIMING_GRADES,
      LIFT_OUTCOMES,
      MISS_REASONS,
      LIFT_EVENT_KINDS,
    ] as readonly (readonly string[])[]) {
      expect(new Set(list).size).toBe(list.length);
      expect(list.length).toBeGreaterThan(0);
    }
  });

  it('has copy for every outcome, miss reason, grade and phase', () => {
    for (const outcome of LIFT_OUTCOMES) {
      expect(LIFT_COPY.OUTCOME[outcome], outcome).toBeTruthy();
    }
    for (const reason of MISS_REASONS) {
      expect(LIFT_COPY.MISS_REASON[reason], reason).toBeTruthy();
    }
    for (const grade of TIMING_GRADES) {
      expect(LIFT_COPY.GRADE[grade], grade).toBeTruthy();
    }
    for (const phase of LIFT_PHASES) {
      expect(promptFor({ ...createLift({ loadRatio: 1, seed: 1 }), phase }), phase).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// Purity and determinism
// ---------------------------------------------------------------------------

describe('purity', () => {
  it('has no clock and no global randomness in its source', async () => {
    const source = await import('node:fs').then((fs) =>
      fs.readFileSync(new URL('./lift.ts', import.meta.url), 'utf8'),
    );
    // Stripped of comments first: the header talks ABOUT Math.random on purpose.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(/Math\s*\.\s*random/);
    expect(code).not.toMatch(/Date\s*\.\s*now/);
    expect(code).not.toMatch(/new\s+Date/);
    expect(code).not.toMatch(/from\s+['"]react/);
  });

  it('does not mutate the state it is given', () => {
    const before = play(LOAD_PRESETS.HEAVY, { driveOffsetTicks: 0 });
    const snapshot = JSON.stringify(before);
    stepLift(before, { kind: 'press' });
    stepLift(before, null);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('replays a rep identically from the same seed and script', () => {
    const a = play(LOAD_PRESETS.MAXIMAL, { driveOffsetTicks: 2, seed: 99 });
    const b = play(LOAD_PRESETS.MAXIMAL, { driveOffsetTicks: 2, seed: 99 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('actually uses the seed, so the determinism test above is not vacuous', () => {
    // The jitter only reaches the bar while the lifter is losing, so this has
    // to be a rep that struggles. A test that used a light rep would compare
    // two identical zero-jitter reps and pass on a module with no randomness.
    const a = runLift({ loadRatio: LOAD_PRESETS.MAXIMAL, seed: 1 }, [
      { tick: pressTickFor(LOAD_PRESETS.MAXIMAL), kind: 'press' },
      { tick: releaseTickFor(LOAD_PRESETS.MAXIMAL, LIFT_TUNING.DEPTH_IDEAL), kind: 'release' },
    ]);
    const b = runLift({ loadRatio: LOAD_PRESETS.MAXIMAL, seed: 2 }, [
      { tick: pressTickFor(LOAD_PRESETS.MAXIMAL), kind: 'press' },
      { tick: releaseTickFor(LOAD_PRESETS.MAXIMAL, LIFT_TUNING.DEPTH_IDEAL), kind: 'release' },
    ]);
    const lateralOf = (r: typeof a): number[] => r.history.map((s) => s.barLateralPx);
    expect(lateralOf(a).some((v) => v !== 0)).toBe(true);
    expect(lateralOf(a)).not.toEqual(lateralOf(b));
  });

  it('always terminates, over randomised input scripts', () => {
    let rng = 4242;
    const draw = (): number => {
      const next = nextRandom(rng);
      rng = next.state;
      return next.value;
    };
    for (let trial = 0; trial < 400; trial += 1) {
      const load = 0.35 + draw() * 0.75;
      const script: ScriptedInput[] = [];
      let kind: 'press' | 'release' = 'press';
      let tick = 1 + Math.floor(draw() * 40);
      const actions = 1 + Math.floor(draw() * 8);
      for (let i = 0; i < actions; i += 1) {
        script.push({ tick, kind });
        kind = kind === 'press' ? 'release' : 'press';
        tick += 1 + Math.floor(draw() * 90);
      }
      const rep = runLift({ loadRatio: load, seed: Math.floor(draw() * 1e6) }, script);
      expect(rep.final.phase, JSON.stringify(script)).toBe('RESOLVED');
      expect(rep.final.resolution).not.toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

describe('gradeTiming', () => {
  it('is 1 at the ideal moment and 0 at the edge', () => {
    expect(gradeTiming(0, 100).quality).toBe(1);
    expect(gradeTiming(100, 100).quality).toBe(0);
    expect(gradeTiming(-100, 100).quality).toBe(0);
  });

  it('never rises as the input gets further from the ideal moment', () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let offset = 0; offset <= 200; offset += 5) {
      const q = gradeTiming(offset, 100).quality;
      expect(q).toBeLessThanOrEqual(previous);
      previous = q;
      expect(gradeTiming(-offset, 100).quality).toBe(q);
    }
  });

  it('grades everything outside the window as missed', () => {
    expect(gradeTiming(101, 100).grade).toBe('missed');
    expect(gradeTiming(-101, 100).grade).toBe('missed');
    expect(gradeTiming(0, 0).grade).toBe('missed');
    expect(gradeTiming(Number.NaN, 100).grade).toBe('missed');
  });

  it('reaches every grade, and each one only on its own side', () => {
    const seen = new Map<string, number[]>();
    for (let offset = -140; offset <= 140; offset += 1) {
      const { grade } = gradeTiming(offset, 100);
      const list = seen.get(grade) ?? [];
      list.push(offset);
      seen.set(grade, list);
    }
    for (const grade of TIMING_GRADES) {
      expect(seen.has(grade), `grade ${grade} is unreachable`).toBe(true);
    }
    expect((seen.get('early') ?? []).every((o) => o < 0)).toBe(true);
    expect((seen.get('late') ?? []).every((o) => o > 0)).toBe(true);
    expect((seen.get('perfect') ?? []).every((o) => Math.abs(o) <= 100)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The ascent model
// ---------------------------------------------------------------------------

describe('ascentDemand', () => {
  it('peaks where the sprite system puts the sticking point', () => {
    // Measured by scanning, not read off the formula: the point of the test is
    // that the mechanic's hard part is drawn in the right place.
    let peakH = 0;
    let peak = -Infinity;
    for (let h = 0; h <= 1.0001; h += 0.001) {
      const d = ascentDemand(h, LOAD_PRESETS.MAXIMAL);
      if (d > peak) {
        peak = d;
        peakH = h;
      }
    }
    expect(peakH).toBeCloseTo(STICK_HEIGHT_FRAC, 2);
    expect(STICK_HEIGHT_FRAC).toBe(STICK.HEIGHT_FRAC);
  });

  it('rises with load everywhere in the range', () => {
    for (let h = 0; h <= 1.0001; h += 0.05) {
      let previous = -Infinity;
      for (let load = 0.4; load <= 1.05; load += 0.05) {
        const d = ascentDemand(h, load);
        expect(d).toBeGreaterThan(previous);
        previous = d;
      }
    }
  });

  it('makes being buried strictly harder', () => {
    const flat = ascentDemand(STICK_HEIGHT_FRAC, LOAD_PRESETS.MAXIMAL, 0);
    const buried = ascentDemand(STICK_HEIGHT_FRAC, LOAD_PRESETS.MAXIMAL, 0.2);
    expect(buried).toBeGreaterThan(flat);
  });

  it('exceeds what the lifter has at a limit and not at a warm-up', () => {
    // If neither of these held there would be no sticking point to grind
    // through, or no weight a lifter could warm up with.
    expect(ascentDemand(STICK_HEIGHT_FRAC, LOAD_PRESETS.MAXIMAL)).toBeGreaterThan(
      LIFT_TUNING.LIFTER_CAPACITY,
    );
    expect(ascentDemand(STICK_HEIGHT_FRAC, LOAD_PRESETS.WARMUP)).toBeLessThan(
      LIFT_TUNING.LIFTER_CAPACITY,
    );
  });
});

describe('load-derived timings', () => {
  it('descends slower, braces longer and holds longer under load', () => {
    expect(descentRate(LOAD_PRESETS.MAXIMAL)).toBeLessThan(descentRate(LOAD_PRESETS.LIGHT));
    expect(braceTicks(LOAD_PRESETS.MAXIMAL)).toBeGreaterThan(braceTicks(LOAD_PRESETS.LIGHT));
    expect(holeTicks(LOAD_PRESETS.MAXIMAL)).toBeGreaterThan(holeTicks(LOAD_PRESETS.LIGHT));
    expect(lockoutTicks(LOAD_PRESETS.MAXIMAL)).toBeGreaterThan(lockoutTicks(LOAD_PRESETS.LIGHT));
  });

  it('never returns a zero-length phase, even at absurd loads', () => {
    for (const load of [0.01, 0.35, 1.05, 50]) {
      expect(braceTicks(load)).toBeGreaterThanOrEqual(1);
      expect(holeTicks(load)).toBeGreaterThanOrEqual(1);
      expect(lockoutTicks(load)).toBeGreaterThanOrEqual(1);
      expect(descentRate(load)).toBeGreaterThan(0);
    }
  });
});

describe('isGrind', () => {
  it('is true past either threshold and false below both', () => {
    expect(isGrind(0, 0)).toBe(false);
    expect(isGrind(LIFT_TUNING.GRIND_STALL_TICKS, 0)).toBe(true);
    expect(isGrind(0, LIFT_TUNING.GRIND_ASCENT_TICKS)).toBe(true);
    expect(isGrind(LIFT_TUNING.GRIND_STALL_TICKS - 1, LIFT_TUNING.GRIND_ASCENT_TICKS - 1)).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// THE CENTRAL CLAIM: the outcome space is not degenerate
// ---------------------------------------------------------------------------

describe('outcome space', () => {
  it('produces all three outcomes across the load and timing space', () => {
    const seen = new Set<LiftOutcome>();
    for (const load of [0.55, 0.7, 0.8, 0.88, 0.95, 1.0, 1.05]) {
      for (const outcome of sweepOutcomes(load)) seen.add(outcome);
    }
    for (const outcome of LIFT_OUTCOMES) {
      expect(seen.has(outcome), `outcome ${outcome} is unreachable`).toBe(true);
    }
  });

  it('reaches every miss reason', () => {
    const load = LOAD_PRESETS.MAXIMAL;
    const reasons = new Set<string>();
    // Never release: buried.
    reasons.add(
      runLift({ loadRatio: load, seed: 3 }, [{ tick: pressTickFor(load), kind: 'press' }]).final
        .resolution?.missReason ?? '',
    );
    // Release far above depth, then drive perfectly: a high squat that locks out.
    reasons.add(play(load, { depth: 0.5, driveOffsetTicks: 0 }).resolution?.missReason ?? '');
    // Depth, but no drive at all: the bar wins.
    reasons.add(play(load, { driveOffsetTicks: null }).resolution?.missReason ?? '');
    // A rep that creeps for so long the lifter runs out of air. Rare by design
    // — a measured sweep found three such cases in about ten thousand — so the
    // search has to cover buried reversals as well as loads near the limit.
    // A narrower search would report the reason unreachable and be wrong.
    outer: for (let load2 = 0.9; load2 <= 1.0; load2 += 0.01) {
      for (const deep of [1.15, 1.28]) {
        for (let offset = -4; offset <= 4; offset += 1) {
          const r = play(load2, { depth: deep, driveOffsetTicks: offset }).resolution;
          if (r?.missReason === 'timeout') {
            reasons.add('timeout');
            break outer;
          }
        }
      }
    }
    for (const reason of MISS_REASONS) {
      expect(reasons.has(reason), `miss reason ${reason} is unreachable`).toBe(true);
    }
  });

  it('is decided by the drive input at a limit attempt', () => {
    // The whole mechanic in one assertion: same load, same depth, the only
    // difference is whether the sticking point was driven through.
    expect(outcomeOf(play(LOAD_PRESETS.MAXIMAL, { driveOffsetTicks: null }))).toBe('miss');
    expect(outcomeOf(play(LOAD_PRESETS.MAXIMAL, { driveOffsetTicks: 0 }))).not.toBe('miss');
  });

  it('lets a light rep through however it is driven', () => {
    // A warm-up must not be a timing test, or the daily loop is exhausting.
    for (const outcome of sweepOutcomes(LOAD_PRESETS.LIGHT)) {
      expect(outcome).not.toBe('miss');
    }
    expect(outcomeOf(play(LOAD_PRESETS.LIGHT, { driveOffsetTicks: null }))).not.toBe('miss');
  });

  it('gets harder as the bar gets heavier, measured as makes per sweep', () => {
    const makes = (load: number): number =>
      sweepOutcomes(load).filter((o) => o !== 'miss').length;
    const loads = [0.55, 0.8, 0.95, 1.05];
    const ladder = loads.map(makes);
    // Never easier as the bar gets heavier...
    for (let i = 1; i < ladder.length; i += 1) {
      expect(ladder[i] ?? 0, `load step ${loads[i]}`).toBeLessThanOrEqual(ladder[i - 1] ?? 0);
    }
    // ...and strictly harder somewhere, or the load ratio does nothing. The
    // light end is deliberately allowed to tie at "everything makes it".
    expect(ladder[ladder.length - 1] ?? 0).toBeLessThan(ladder[0] ?? 0);
    expect(ladder[0]).toBe(sweepOutcomes(0.55).length);
  });

  it('rewards better drive timing with a faster ascent', () => {
    // Monotone in |offset| over the makes, which is what "timing matters"
    // means when it is not just make-or-miss.
    const load = 0.88;
    const at = (offset: number): number | null => {
      const state = play(load, { driveOffsetTicks: offset });
      return state.resolution?.outcome === 'miss' ? null : state.resolution?.ascentTicks ?? null;
    };
    const perfect = at(0);
    const off4 = at(4);
    const off8 = at(8);
    expect(perfect).not.toBeNull();
    expect(off4).not.toBeNull();
    expect(off8).not.toBeNull();
    expect(perfect ?? 0).toBeLessThan(off4 ?? 0);
    expect(off4 ?? 0).toBeLessThan(off8 ?? 0);
  });

  it('punishes a drive thrown before the bar is anywhere near the stick', () => {
    const load = 0.88;
    // Two ticks into the ascent, long before the cue arms. A press during the
    // HOLE would not do: the reversal beat has no cue and swallows presses,
    // which a test written against the tick count alone would miss.
    const early = runLift({ loadRatio: load, seed: 5 }, earlyDriveScript(load)).final;
    expect(early.timings.some((t) => t.cue === 'drive' && t.grade === 'missed')).toBe(true);
    expect(early.drivesUsed).toBe(LIFT_TUNING.DRIVE_ATTEMPTS_PER_REP);
  });

  it('gives the drive boost only while the player keeps holding', () => {
    const load = 0.95;
    const held = play(load, { driveOffsetTicks: 0 });
    const dropped = play(load, { driveOffsetTicks: 0, releaseAfterDriveTicks: 3 });
    expect(outcomeOf(held)).not.toBe('miss');
    expect(dropped.resolution?.peakHeight ?? 1).toBeLessThan(held.resolution?.peakHeight ?? 0);
  });
});

// ---------------------------------------------------------------------------
// THE WINNING BAND — the thing a hand pass may not silently destroy
//
// WHY THIS SECTION EXISTS. GDD §12.1 budgets roughly 30 hand passes over
// `liftTuning.ts`. Before this section, the only things standing between those
// passes and an unwinnable limit attempt were:
//
//   - a STATIC inequality (`DRIVE_BOOST_FORCE_MAX > demandPeak - capacity`),
//     which says the boost is big enough at the instant it is applied and says
//     NOTHING about whether it is still alive when the bar reaches the stick.
//     Shorten DRIVE_BOOST_TICKS to a handful and that check still passes while
//     every limit attempt in the game dies.
//   - ONE winning script, which proves the band is non-empty and nothing about
//     its width. A band one tick wide passes it.
//   - a makes-ladder that only requires the heaviest load to be harder than the
//     lightest, which a band of width zero satisfies.
//
// So everything below MEASURES the band from played reps.
//
// WHAT IT DOES NOT SAY. Not that the band is the right width — no test can say
// that, GDD §12.1, and the numbers below are floors, not targets. What it says
// is that the band is still wide enough to be a test of the player's timing
// rather than of their hardware.
// ---------------------------------------------------------------------------

/**
 * Floor on the width of the contiguous winning drive band at a limit attempt,
 * in ticks.
 *
 * WHY FIVE. A press reaches the sim quantised to a tick (TICK_HZ = 60), and the
 * path from a rendered cue to an applied input costs at least one more — the
 * frame the player saw is already one frame old when their finger lands. Five
 * ticks means the player has +/- 2 ticks of slop around a centre tick, about
 * 83 ms, which is roughly two standard deviations of a practised tapper's
 * asynchrony against a visual cue. Below that the outcome starts being decided
 * by device latency instead of by the player, and GDD §8.1's "100% skill- and
 * consistency-driven" stops being true of the mechanic.
 *
 * Measured at the time of writing: 8 ticks. The floor is deliberately well
 * under that so a legitimate tuning pass is not fighting this test — it is here
 * to catch a collapse, not to pin a value.
 */
const MIN_LIMIT_WIN_BAND_TICKS = 5;

/**
 * Floor on the share of CUE-OBEDIENT reps that make a limit attempt.
 *
 * "Cue-obedient" means the player did what the screen told them: released
 * inside the depth window the sim armed, and pressed inside the drive window
 * the sim armed. That is the only search space a win rate means anything over.
 * A sweep that includes quarter squats and presses at arbitrary ticks measures
 * the size of the sweep, not the difficulty of the rep.
 *
 * Measured at the time of writing: 0.28. A limit single SHOULD miss more often
 * than it makes; what must not happen is that it becomes unwinnable in practice
 * while every other test stays green.
 */
const MIN_LIMIT_CUE_OBEDIENT_WIN_RATE = 0.12;

/**
 * Floor on the same measure at the load the screen OPENS on.
 *
 * A first rep has to be makeable or GDD §10 Prototype 1 never gets asked its
 * question. Measured at the time of writing: 0.89.
 */
const MIN_DEFAULT_CUE_OBEDIENT_WIN_RATE = 0.5;

/**
 * How much longer an undriven ascent at the default load must run than an
 * undriven ascent at the lightest one, as a multiple.
 *
 * This is the "the player can SEE the grind" floor. Measured: 2.4x.
 */
const MIN_DEFAULT_ASCENT_STRETCH = 1.5;

/**
 * The cue the sim itself armed, read out of a played rep.
 *
 * Deliberately not reconstructed from the tuning constants. A test that derived
 * the window from `DRIVE_IDEAL_LEAD_MS` would agree with a sim that armed the
 * cue in the wrong place, which is the bug most worth catching.
 */
function armedCue(
  config: LiftConfig,
  script: readonly ScriptedInput[],
  cue: 'depth' | 'drive',
): CueWindow | null {
  for (const state of runLift(config, script).history) {
    const active = state.activeCue;
    if (active !== null && active.cue === cue) return active;
  }
  return null;
}

interface CueObedientSweep {
  /** Scripts that made the lift (good-lift or grind). */
  readonly wins: number;
  /** Scripts played. */
  readonly total: number;
  /** Release ticks inside the depth window that have at least one winning drive. */
  readonly releasesWithAWin: number;
  readonly releases: number;
  /** Winning drive ticks at the release the depth cue actually asks for. */
  readonly winsAtIdealDepth: number;
  readonly driveWindowTicks: number;
  /** Longest run of consecutive winning drive ticks at that same release. */
  readonly longestBandTicks: number;
  /** Did every release inside the depth window reach the ASCENT phase? */
  readonly everyReleaseReachedAscent: boolean;
}

/**
 * Play every rep a player who obeys BOTH on-screen cues could produce.
 *
 * Release tick runs across the depth window the sim armed; drive tick runs
 * across the drive window the sim armed for that release. Both windows are read
 * back out of the mechanic, so this sweep follows the cue wherever tuning moves
 * it.
 */
function cueObedientSweep(load: number): CueObedientSweep {
  const config: LiftConfig = { loadRatio: load, seed: 20260801 };
  const press = pressTickFor(load);
  const start: ScriptedInput[] = [{ tick: press, kind: 'press' }];
  const depthCue = armedCue(config, start, 'depth');
  if (depthCue === null) throw new Error(`no depth cue armed at load ${load}`);

  let wins = 0;
  let total = 0;
  let releasesWithAWin = 0;
  let releases = 0;
  let winsAtIdealDepth = 0;
  let driveWindowTicks = 0;
  let longestBandTicks = 0;
  let everyReleaseReachedAscent = true;

  for (let release = depthCue.openTick; release <= depthCue.closeTick; release += 1) {
    releases += 1;
    const base: ScriptedInput[] = [...start, { tick: release, kind: 'release' }];
    const undriven = runLift(config, base).final;
    if (undriven.resolution?.ascentTicks === 0) everyReleaseReachedAscent = false;

    const driveCue = armedCue(config, base, 'drive');
    if (driveCue === null) {
      everyReleaseReachedAscent = false;
      continue;
    }
    let winsHere = 0;
    let run = 0;
    let bestRun = 0;
    for (let drive = driveCue.openTick; drive <= driveCue.closeTick; drive += 1) {
      total += 1;
      const made =
        runLift(config, [...base, { tick: drive, kind: 'press' }]).final.resolution?.outcome !==
        'miss';
      if (made) {
        wins += 1;
        winsHere += 1;
        run += 1;
        if (run > bestRun) bestRun = run;
      } else {
        run = 0;
      }
    }
    if (winsHere > 0) releasesWithAWin += 1;
    if (release === depthCue.idealTick) {
      winsAtIdealDepth = winsHere;
      driveWindowTicks = driveCue.closeTick - driveCue.openTick + 1;
      longestBandTicks = bestRun;
    }
  }

  return {
    wins,
    total,
    releasesWithAWin,
    releases,
    winsAtIdealDepth,
    driveWindowTicks,
    longestBandTicks,
    everyReleaseReachedAscent,
  };
}

/** Every ASCENT state of one played rep. */
function ascentOf(config: LiftConfig, script: readonly ScriptedInput[]): LiftState[] {
  return runLift(config, script).history.filter((s) => s.phase === 'ASCENT');
}

describe('the winning band at a limit attempt', () => {
  const limit = LOAD_PRESETS.MAXIMAL;

  it('is wider than the input path is imprecise', () => {
    const sweep = cueObedientSweep(limit);
    expect(
      sweep.longestBandTicks,
      `winning drive band at ${limit} is ${sweep.longestBandTicks} ticks ` +
        `(${(sweep.longestBandTicks * TICK_MS).toFixed(0)} ms) of a ` +
        `${sweep.driveWindowTicks}-tick cue window`,
    ).toBeGreaterThanOrEqual(MIN_LIMIT_WIN_BAND_TICKS);
  });

  it('is one contiguous band, not scattered ticks', () => {
    // A split band is a dead spot inside a window the game is telling the player
    // to press in, which reads as the input being ignored rather than as a
    // difficulty. Every winning tick at the moment the depth cue asks for must
    // belong to the same run.
    const sweep = cueObedientSweep(limit);
    expect(sweep.winsAtIdealDepth).toBeGreaterThan(0);
    expect(sweep.longestBandTicks).toBe(sweep.winsAtIdealDepth);
  });

  it('is reachable from every release the depth cue asks for', () => {
    // The depth cue must never lie: if it lights up and the player obeys it,
    // SOME drive has to be able to finish the rep. Otherwise the rep was over
    // before the drive beat began and the second cue is decoration.
    const sweep = cueObedientSweep(limit);
    expect(sweep.releases).toBeGreaterThan(0);
    expect(sweep.everyReleaseReachedAscent).toBe(true);
    expect(
      sweep.releasesWithAWin,
      `${sweep.releasesWithAWin} of ${sweep.releases} depth-window releases are winnable`,
    ).toBe(sweep.releases);
  });

  it('is won often enough to be a skill test rather than a lottery', () => {
    const sweep = cueObedientSweep(limit);
    const rate = sweep.wins / sweep.total;
    expect(
      rate,
      `cue-obedient win rate at ${limit} is ${(rate * 100).toFixed(1)}% over ${sweep.total} reps`,
    ).toBeGreaterThanOrEqual(MIN_LIMIT_CUE_OBEDIENT_WIN_RATE);
    // ...and a limit single still has to be a limit single.
    expect(rate).toBeLessThan(1);
  });

  it('keeps the drive boost alive long enough to reach the sticking point', () => {
    // THE HOLE IN THE STATIC CHECK, closed. `liftTuning.test.ts` proves the
    // boost is larger than the deficit; it cannot prove the boost has not
    // already decayed to nothing by the time the bar arrives. Measured here on
    // the bar itself: with a perfectly timed drive, the net force must come back
    // to positive WHILE THE BAR IS INSIDE the sticking band the sprite system
    // draws — not before it, and not after it is already past.
    const config: LiftConfig = { loadRatio: limit, seed: 20260801 };
    const base: ScriptedInput[] = [
      { tick: pressTickFor(limit), kind: 'press' },
      { tick: releaseTickFor(limit, LIFT_TUNING.DEPTH_IDEAL), kind: 'release' },
    ];
    const cue = armedCue(config, base, 'drive');
    expect(cue).not.toBeNull();
    if (cue === null) return;

    const driven = ascentOf(config, [...base, { tick: cue.idealTick, kind: 'press' }]);
    const crossing = driven.find((s) => s.height >= STICK_HEIGHT_FRAC);
    expect(crossing, 'the driven bar never reached the sticking point').toBeDefined();
    expect(
      crossing?.netForce ?? 0,
      'the drive boost had already decayed by the time the bar reached the stick',
    ).toBeGreaterThan(0);

    // And the same rep, UNDRIVEN, must not get there at all — otherwise the
    // assertion above is true of a bar that never needed driving, and the whole
    // section is measuring nothing.
    const undriven = ascentOf(config, base);
    expect(Math.max(...undriven.map((s) => s.height))).toBeLessThan(STICK_HEIGHT_FRAC);
  });
});

// ---------------------------------------------------------------------------
// The load the screen opens on (GDD §10 Prototype 1)
// ---------------------------------------------------------------------------

describe('the load the screen opens on', () => {
  const choices = LIFT_TUNING.DEMO.LOAD_CHOICES;
  const defaultLoad = choices[LIFT_TUNING.DEMO.DEFAULT_LOAD_INDEX];

  it('is one of the loads the screen offers', () => {
    expect(defaultLoad, 'DEFAULT_LOAD_INDEX is out of range').toBeDefined();
  });

  it('has a sticking point at all', () => {
    // Below this the drive input does nothing, an undriven rep locks out clean,
    // and the screen opens on a rep that cannot answer GDD §10's question
    // because there is no grind in it to judge.
    expect(defaultLoad).toBeDefined();
    if (defaultLoad === undefined) return;
    expect(
      ascentDemand(STICK_HEIGHT_FRAC, defaultLoad),
      `load ${defaultLoad} never exceeds the lifter's capacity at the stick`,
    ).toBeGreaterThan(LIFT_TUNING.LIFTER_CAPACITY);
  });

  it('shows the grind even to a player who never presses the drive', () => {
    expect(defaultLoad).toBeDefined();
    if (defaultLoad === undefined) return;
    const undrivenAscent = (load: number): LiftState[] =>
      ascentOf({ loadRatio: load, seed: 20260801 }, [
        { tick: pressTickFor(load), kind: 'press' },
        { tick: releaseTickFor(load, LIFT_TUNING.DEPTH_IDEAL), kind: 'release' },
      ]);

    const here = undrivenAscent(defaultLoad);
    const light = undrivenAscent(LOAD_PRESETS.LIGHT);
    expect(here.length, 'the default rep never reached the ascent').toBeGreaterThan(0);
    // The bar fights: net force goes negative somewhere on the way up.
    expect(Math.min(...here.map((s) => s.netForce))).toBeLessThan(0);
    expect(Math.min(...light.map((s) => s.netForce))).toBeGreaterThanOrEqual(0);
    // And it takes materially longer than the light one, which is what the
    // player actually sees.
    expect(here.length).toBeGreaterThan(light.length * MIN_DEFAULT_ASCENT_STRETCH);
  });

  it('is made by a player who obeys both cues, most of the time', () => {
    expect(defaultLoad).toBeDefined();
    if (defaultLoad === undefined) return;
    const sweep = cueObedientSweep(defaultLoad);
    const rate = sweep.wins / sweep.total;
    expect(
      rate,
      `cue-obedient win rate at the default load ${defaultLoad} is ${(rate * 100).toFixed(1)}%`,
    ).toBeGreaterThanOrEqual(MIN_DEFAULT_CUE_OBEDIENT_WIN_RATE);
  });

  it('leaves the limit attempt on the screen, and harder than the default', () => {
    expect(defaultLoad).toBeDefined();
    if (defaultLoad === undefined) return;
    expect([...choices]).toContain(LOAD_PRESETS.MAXIMAL);
    const here = cueObedientSweep(defaultLoad);
    const limit = cueObedientSweep(LOAD_PRESETS.MAXIMAL);
    expect(limit.wins / limit.total).toBeLessThan(here.wins / here.total);
  });
});

// ---------------------------------------------------------------------------
// Depth
// ---------------------------------------------------------------------------

describe('depth', () => {
  it('calls a high squat, however well the bar was driven', () => {
    const state = play(LOAD_PRESETS.MAXIMAL, { depth: 0.5, driveOffsetTicks: 0 });
    expect(state.resolution?.depthAchieved).toBe(false);
    expect(state.resolution?.outcome).toBe('miss');
    expect(state.resolution?.peakHeight).toBe(1);
  });

  it('passes a squat that reaches legal depth', () => {
    const state = play(LOAD_PRESETS.LIGHT, {
      depth: LIFT_TUNING.DEPTH_LEGAL + descentRate(LOAD_PRESETS.LIGHT) * 2,
      driveOffsetTicks: 0,
    });
    expect(state.resolution?.depthAchieved).toBe(true);
    expect(state.resolution?.outcome).not.toBe('miss');
  });

  it('buries a player who never lets go', () => {
    const load = LOAD_PRESETS.MAXIMAL;
    const state = runLift({ loadRatio: load, seed: 11 }, [
      { tick: pressTickFor(load), kind: 'press' },
    ]).final;
    expect(state.resolution?.missReason).toBe('buried');
    expect(state.depth).toBeGreaterThanOrEqual(LIFT_TUNING.DEPTH_COLLAPSE);
  });

  it('never opens the depth cue above legal depth, at any load', () => {
    // Measured from played reps rather than derived from the constants: the
    // window is specified in milliseconds and the descent in depth-per-tick, so
    // whether the cue's front edge is legal depends on a rate that changes with
    // load. It was not, at the light end, before `depthWindowHalfTicks` existed.
    for (let load = LOAD_RANGE.MIN; load <= LOAD_RANGE.MAX; load += 0.02) {
      const rep = runLift({ loadRatio: load, seed: 2 }, [
        { tick: pressTickFor(load), kind: 'press' },
      ]);
      const withCue = rep.history.find((s) => s.activeCue?.cue === 'depth');
      const cue = withCue?.activeCue;
      expect(cue, `load ${load}`).toBeTruthy();
      if (cue == null) continue;
      const atOpen = rep.history.find((s) => s.tick === cue.openTick);
      expect(atOpen, `load ${load}`).toBeTruthy();
      expect(atOpen?.depth ?? 0, `load ${load} opens at depth`).toBeGreaterThanOrEqual(
        LIFT_TUNING.DEPTH_LEGAL,
      );
    }
  });

  it('reports a depth window narrower than asked for only when it has to', () => {
    const wide = LIFT_TUNING.DEPTH_WINDOW_MS;
    // Heavy: the descent is slow, so the millisecond width is what binds.
    expect(depthWindowHalfTicks(LOAD_PRESETS.MAXIMAL, wide)).toBe(
      Math.round(wide / TICK_MS / 2),
    );
    // Light: the descent is fast, so the legal-depth clamp binds instead.
    expect(depthWindowHalfTicks(LOAD_PRESETS.WARMUP, wide)).toBeLessThan(
      Math.round(wide / TICK_MS / 2),
    );
    // Never zero, whatever it is handed.
    expect(depthWindowHalfTicks(LOAD_PRESETS.WARMUP, 1)).toBeGreaterThanOrEqual(1);
  });

  it('makes a deeper reversal a harder ascent', () => {
    const shallow = play(LOAD_PRESETS.HEAVY, {
      depth: LIFT_TUNING.DEPTH_IDEAL,
      driveOffsetTicks: 0,
    });
    const deep = play(LOAD_PRESETS.HEAVY, {
      depth: LIFT_TUNING.DEPTH_IDEAL + 0.2,
      driveOffsetTicks: 0,
    });
    expect(deep.extraDepth).toBeGreaterThan(shallow.extraDepth);
    expect(deep.resolution?.ascentTicks ?? 0).toBeGreaterThan(
      shallow.resolution?.ascentTicks ?? 0,
    );
  });

  it('does not make a high squat cheaper than a legal one', () => {
    // A quarter squat starts near lockout, so it is easy — and it is called.
    // What must not happen is that it becomes a viable strategy.
    const cheat = play(LOAD_PRESETS.MAXIMAL, { depth: 0.4, driveOffsetTicks: 0 });
    expect(cheat.resolution?.outcome).toBe('miss');
  });
});

// ---------------------------------------------------------------------------
// The grind is drawn where it happens
// ---------------------------------------------------------------------------

describe('the sticking point', () => {
  it('is where a real rep actually stalls', () => {
    const load = LOAD_PRESETS.MAXIMAL;
    const rep = runLift({ loadRatio: load, seed: 77 }, [
      { tick: pressTickFor(load), kind: 'press' },
      { tick: releaseTickFor(load, LIFT_TUNING.DEPTH_IDEAL), kind: 'release' },
    ]);
    const stalled = rep.history.filter(
      (s) => s.phase === 'ASCENT' && s.velocity < LIFT_TUNING.GRIND_STALL_VELOCITY,
    );
    expect(stalled.length).toBeGreaterThan(LIFT_TUNING.GRIND_STALL_TICKS);
    const meanHeight =
      stalled.reduce((a, s) => a + s.height, 0) / Math.max(1, stalled.length);
    // Inside the notch the sprite system draws, not merely somewhere on the way up.
    expect(Math.abs(meanHeight - STICK_HEIGHT_FRAC)).toBeLessThan(STICK.WIDTH * 2);
  });

  it('drifts the bar forward most where it stalls, and more under load', () => {
    const peakForward = (load: number): { px: number; atHeight: number } => {
      const rep = runLift({ loadRatio: load, seed: 5 }, [
        { tick: pressTickFor(load), kind: 'press' },
        { tick: releaseTickFor(load, LIFT_TUNING.DEPTH_IDEAL), kind: 'release' },
      ]);
      let px = 0;
      let atHeight = 0;
      for (const s of rep.history) {
        if (s.phase !== 'ASCENT') continue;
        if (s.barForwardPx > px) {
          px = s.barForwardPx;
          atHeight = s.height;
        }
      }
      return { px, atHeight };
    };
    const light = peakForward(LOAD_PRESETS.LIGHT);
    const maximal = peakForward(LOAD_PRESETS.MAXIMAL);
    expect(maximal.px).toBeGreaterThan(light.px * 2);
    expect(Math.abs(maximal.atHeight - STICK_HEIGHT_FRAC)).toBeLessThan(STICK.WIDTH * 2);
  });

  it('shakes and tilts the bar only when the lifter is losing', () => {
    const peaks = (load: number): { lateral: number; tilt: number } => {
      const rep = runLift({ loadRatio: load, seed: 5 }, [
        { tick: pressTickFor(load), kind: 'press' },
        { tick: releaseTickFor(load, LIFT_TUNING.DEPTH_IDEAL), kind: 'release' },
      ]);
      return {
        lateral: rep.history.reduce((m, s) => Math.max(m, Math.abs(s.barLateralPx)), 0),
        tilt: rep.history.reduce((m, s) => Math.max(m, Math.abs(s.barTiltDeg)), 0),
      };
    };
    const light = peaks(LOAD_PRESETS.LIGHT);
    const maximal = peaks(LOAD_PRESETS.MAXIMAL);
    expect(light.lateral).toBe(0);
    expect(light.tilt).toBe(0);
    expect(maximal.lateral).toBeGreaterThan(0);
    expect(maximal.tilt).toBeGreaterThan(0);
  });

  it('bows the bar harder under load', () => {
    const peakBend = (load: number): number => {
      const rep = runLift({ loadRatio: load, seed: 5 }, [
        { tick: pressTickFor(load), kind: 'press' },
        { tick: releaseTickFor(load, LIFT_TUNING.DEPTH_IDEAL), kind: 'release' },
      ]);
      return rep.history.reduce((m, s) => Math.max(m, s.barBendPx), 0);
    };
    expect(peakBend(LOAD_PRESETS.MAXIMAL)).toBeGreaterThan(peakBend(LOAD_PRESETS.LIGHT));
    expect(peakBend(LOAD_PRESETS.MAXIMAL)).toBeLessThanOrEqual(LIFT_TUNING.BAR_BEND_MAX_PX);
  });
});

// ---------------------------------------------------------------------------
// Fatigue, read-only (GDD §3.4)
// ---------------------------------------------------------------------------

describe('fatigue integration', () => {
  it('tightens both windows when fatigued and widens them when primed', () => {
    const base: LiftConfig = { loadRatio: LOAD_PRESETS.MAXIMAL, seed: 1 };
    for (const cue of LIFT_CUES) {
      const neutral = cueWindowMs(cue, base);
      const primed = cueWindowMs(cue, { ...base, feel: primedFeel() });
      const tired = cueWindowMs(cue, { ...base, feel: fatiguedFeel() });
      expect(primed, `${cue} primed`).toBeGreaterThan(neutral);
      expect(tired, `${cue} fatigued`).toBeLessThan(neutral);
    }
  });

  it('tightens the window further deeper into a session', () => {
    const feel = fatiguedFeel();
    const start = cueWindowMs('drive', { loadRatio: 1, seed: 1, feel });
    const late = cueWindowMs('drive', {
      loadRatio: 1,
      seed: 1,
      feel,
      moment: { workSetsCompleted: 4, repsCompletedInSet: 4 },
    });
    expect(late).toBeLessThanOrEqual(start);
  });

  it('maps every bar-speed cue band to a capacity, worst band slowest', () => {
    const scales = BAR_SPEED_CUE_ORDER.map(capacityScaleForBarSpeed);
    for (let i = 1; i < scales.length; i += 1) {
      expect(scales[i] ?? 0, `band ${BAR_SPEED_CUE_ORDER[i]}`).toBeLessThan(scales[i - 1] ?? 0);
    }
    expect(scales[0] ?? 0).toBeGreaterThan(1);
    expect(scales[scales.length - 1] ?? 0).toBeLessThan(1);
  });

  it('gives a primed lifter more output than a fatigued one', () => {
    const primed = lifterCapacity({ loadRatio: 1, seed: 1, feel: primedFeel() });
    const tired = lifterCapacity({ loadRatio: 1, seed: 1, feel: fatiguedFeel() });
    expect(primed).toBeGreaterThan(tired);
    expect(lifterCapacity({ loadRatio: 1, seed: 1 })).toBe(LIFT_TUNING.LIFTER_CAPACITY);
  });

  it('leaves a fatigued lifter a strictly narrower band of makes', () => {
    // The end-to-end statement of GDD §3.4: a tired player misses more, and
    // does so because the rep is harder rather than because a roll went badly.
    const load = 0.95;
    const makes = (feel?: SessionFeel): number =>
      sweepOutcomes(load, feel).filter((o) => o !== 'miss').length;
    const primed = makes(primedFeel());
    const tired = makes(fatiguedFeel());
    expect(primed).toBeGreaterThan(tired);
    expect(tired).toBeGreaterThanOrEqual(0);
  });

  it('never hands a fatigue number back to the caller', () => {
    const state = play(LOAD_PRESETS.MAXIMAL, { driveOffsetTicks: 0, feel: fatiguedFeel() });
    // `config` is excluded because it is the caller's own input handed straight
    // back — it contains the `SessionFeel` they passed in, whose no-meter
    // guarantees are `fatigue.ts`'s and are tested there. What is checked here
    // is everything THIS module produced.
    const { config: _config, ...produced } = state;
    const serialised = JSON.stringify({ produced, resolution: state.resolution }).toLowerCase();
    for (const banned of ['fatigue', 'burden', 'residual', 'readiness', 'primed', 'meter']) {
      expect(serialised, `leaked ${banned}`).not.toContain(banned);
    }
    // The within-rep effort scalar is on the state and must never be dressed up
    // as a fatigue level. It is named so that a component binding to it reads
    // as obviously wrong in a diff.
    expect(Object.keys(produced)).toContain('stallCapacityLoss');
    expect(Object.keys(state.resolution ?? {})).not.toContain('stallCapacityLoss');
  });

  it('exports nothing whose name suggests a fatigue readout', async () => {
    const module = await import('./lift');
    for (const name of Object.keys(module)) {
      expect(name.toLowerCase()).not.toMatch(/fatigue|burden|readiness|residual/);
    }
  });

  it('does not resolve the rep against a random roll', async () => {
    // GDD §8.1: performance is skill-driven. `fatigue.ts` offers a miss roll
    // and this module must not take it, or a correctly driven rep could fail
    // for reasons the player cannot see.
    const source = await import('node:fs').then((fs) =>
      fs.readFileSync(new URL('./lift.ts', import.meta.url), 'utf8'),
    );
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(/adjustedMissChance/);
    expect(code).not.toMatch(/resolveRepAttempt/);
  });
});

// ---------------------------------------------------------------------------
// Events, prompts, cue progress — the read models the renderer runs on
// ---------------------------------------------------------------------------

describe('read models', () => {
  function allEventKinds(): Set<LiftEventKind> {
    const seen = new Set<LiftEventKind>();
    // Events are emitted per tick, so they have to be collected from histories.
    const scripts: readonly { load: number; script: ScriptedInput[] }[] = [
      {
        load: LOAD_PRESETS.MAXIMAL,
        script: [
          { tick: pressTickFor(LOAD_PRESETS.MAXIMAL), kind: 'press' },
          {
            tick: releaseTickFor(LOAD_PRESETS.MAXIMAL, LIFT_TUNING.DEPTH_IDEAL),
            kind: 'release',
          },
        ],
      },
      {
        load: LOAD_PRESETS.MAXIMAL,
        script: [{ tick: pressTickFor(LOAD_PRESETS.MAXIMAL), kind: 'press' }],
      },
      {
        load: LOAD_PRESETS.MAXIMAL,
        script: [
          { tick: pressTickFor(LOAD_PRESETS.MAXIMAL), kind: 'press' },
          { tick: releaseTickFor(LOAD_PRESETS.MAXIMAL, 0.5), kind: 'release' },
        ],
      },
    ];
    for (const { load, script } of scripts) {
      for (const state of runLift({ loadRatio: load, seed: 3 }, script).history) {
        for (const event of state.events) seen.add(event.kind);
      }
    }
    // A well-driven rep, for the drive-hit and lockout kinds.
    const ideal = driveIdealTick({ loadRatio: 0.88, seed: 3 }, LIFT_TUNING.DEPTH_IDEAL);
    if (ideal !== null) {
      const driven = runLift({ loadRatio: 0.88, seed: 3 }, [
        { tick: pressTickFor(0.88), kind: 'press' },
        { tick: releaseTickFor(0.88, LIFT_TUNING.DEPTH_IDEAL), kind: 'release' },
        { tick: ideal, kind: 'press' },
      ]);
      for (const state of driven.history) for (const e of state.events) seen.add(e.kind);
    }
    // A drive thrown before the cue armed, for drive-mistimed.
    const mistimed = runLift({ loadRatio: 0.88, seed: 3 }, earlyDriveScript(0.88));
    for (const state of mistimed.history) for (const e of state.events) seen.add(e.kind);
    return seen;
  }

  it('emits every event kind it declares', () => {
    const seen = allEventKinds();
    for (const kind of LIFT_EVENT_KINDS) {
      expect(seen.has(kind), `event ${kind} is never emitted`).toBe(true);
    }
  });

  it('has a haptic pattern for every event that should be felt', () => {
    const silent: readonly LiftEventKind[] = ['depth-cue-open', 'drive-cue-open', 'resolved'];
    for (const kind of LIFT_EVENT_KINDS) {
      const p = hapticFor({ kind, tick: 0, grade: 'perfect' });
      if (silent.includes(kind)) {
        expect(p, kind).toBeNull();
      } else {
        expect(p, kind).not.toBeNull();
        expect((p?.beats.length ?? 0) > 0, kind).toBe(true);
      }
    }
  });

  it('feels a perfect drive differently from a scruffy one', () => {
    const perfect = hapticFor({ kind: 'drive-hit', tick: 0, grade: 'perfect' });
    const loose = hapticFor({ kind: 'drive-hit', tick: 0, grade: 'late' });
    expect(perfect).not.toEqual(loose);
  });

  it('reaches every phase across the reps a player can produce', () => {
    const seen = new Set<LiftPhase>();
    const load = LOAD_PRESETS.LIGHT;
    const ideal = driveIdealTick({ loadRatio: load, seed: 3 }, LIFT_TUNING.DEPTH_IDEAL);
    expect(ideal).not.toBeNull();
    const rep = runLift({ loadRatio: load, seed: 3 }, [
      { tick: pressTickFor(load), kind: 'press' },
      { tick: releaseTickFor(load, LIFT_TUNING.DEPTH_IDEAL), kind: 'release' },
      { tick: ideal ?? 0, kind: 'press' },
    ]);
    seen.add('BRACE');
    for (const s of rep.history) seen.add(s.phase);
    for (const phase of LIFT_PHASES) {
      expect(seen.has(phase), `phase ${phase} is unreachable`).toBe(true);
    }
  });

  it('shows a different prompt for every phase', () => {
    const base = createLift({ loadRatio: 1, seed: 1 });
    const prompts = LIFT_PHASES.map((phase) => promptFor({ ...base, phase }));
    expect(new Set(prompts).size).toBe(LIFT_PHASES.length);
  });

  it('switches the ascent prompt when the cue opens', () => {
    const base = createLift({ loadRatio: 1, seed: 1 });
    const armed: LiftState = {
      ...base,
      phase: 'ASCENT',
      tick: 100,
      activeCue: {
        cue: 'drive',
        wants: 'press',
        openTick: 110,
        idealTick: 120,
        closeTick: 130,
        widthMs: LIFT_TUNING.DRIVE_WINDOW_MS,
      },
    };
    expect(promptFor(armed)).toBe(LIFT_COPY.PROMPT.ASCENT_BEFORE_CUE);
    expect(promptFor({ ...armed, tick: 115 })).toBe(LIFT_COPY.PROMPT.ASCENT_CUE_OPEN);
    expect(promptFor({ ...armed, tick: 140, activeCue: null, drivesUsed: 1 })).toBe(
      LIFT_COPY.PROMPT.ASCENT_AFTER_CUE,
    );
  });

  it('reports cue progress as 0 at the open and 1 at the ideal moment', () => {
    const base = createLift({ loadRatio: 1, seed: 1 });
    expect(cueProgress(base)).toBeNull();
    const cue = {
      cue: 'drive' as const,
      wants: 'press' as const,
      openTick: 100,
      idealTick: 120,
      closeTick: 140,
      widthMs: LIFT_TUNING.DRIVE_WINDOW_MS,
    };
    expect(cueProgress({ ...base, tick: 100, activeCue: cue })).toBe(0);
    expect(cueProgress({ ...base, tick: 120, activeCue: cue })).toBe(1);
    expect(cueProgress({ ...base, tick: 140, activeCue: cue })).toBe(2);
  });

  it('reports a window whose width matches the ticks it spans', () => {
    const load = LOAD_PRESETS.MAXIMAL;
    const rep = runLift({ loadRatio: load, seed: 3 }, [
      { tick: pressTickFor(load), kind: 'press' },
    ]);
    const withCue = rep.history.find((s) => s.activeCue !== null);
    const cue = withCue?.activeCue;
    expect(cue).toBeDefined();
    if (cue === undefined || cue === null) return;
    const spannedMs = (cue.closeTick - cue.openTick) * TICK_MS;
    // Rounded to whole ticks on both sides, so within one tick either way.
    expect(Math.abs(spannedMs - cue.widthMs)).toBeLessThanOrEqual(TICK_MS);
  });
});

// ---------------------------------------------------------------------------
// Construction and guards
// ---------------------------------------------------------------------------

describe('createLift and stepLift', () => {
  it('starts standing, braced and untouched', () => {
    const state = createLift({ loadRatio: LOAD_PRESETS.MAXIMAL, seed: 1 });
    expect(state.phase).toBe('BRACE');
    expect(state.depth).toBe(0);
    expect(state.held).toBe(false);
    expect(state.resolution).toBeNull();
    expect(state.timings).toEqual([]);
    expect(state.stallCapacityLoss).toBe(0);
  });

  it('refuses a nonsense config', () => {
    expect(() => createLift({ loadRatio: 0, seed: 1 })).toThrow(RangeError);
    expect(() => createLift({ loadRatio: Number.NaN, seed: 1 })).toThrow(RangeError);
    expect(() => createLift({ loadRatio: 1, seed: Number.POSITIVE_INFINITY })).toThrow(RangeError);
  });

  it('stops advancing once resolved, and stops re-emitting events', () => {
    const done = play(LOAD_PRESETS.LIGHT, { driveOffsetTicks: 0 });
    expect(done.phase).toBe('RESOLVED');
    const after = stepLift(done, { kind: 'press' });
    expect(after.tick).toBe(done.tick);
    expect(after.events).toEqual([]);
    expect(stepLift(after, null).events).toEqual([]);
  });

  it('starts the descent on its own if the player never presses', () => {
    const rep = runLift({ loadRatio: LOAD_PRESETS.LIGHT, seed: 1 }, []);
    expect(rep.final.phase).toBe('RESOLVED');
    expect(rep.final.timings.length).toBeGreaterThan(0);
  });

  it('carries the resolution through to the final state', () => {
    const state = play(LOAD_PRESETS.LIGHT, { driveOffsetTicks: 0 });
    expect(state.resolution).not.toBeNull();
    expect(state.resolution?.headline).toBe(LIFT_COPY.OUTCOME[outcomeOf(state)]);
    expect(state.resolution?.detail).toBe('');
    const missed = play(LOAD_PRESETS.MAXIMAL, { driveOffsetTicks: null });
    expect(missed.resolution?.detail.length ?? 0).toBeGreaterThan(0);
  });

  it('records one timing per cue the player answered', () => {
    const state = play(LOAD_PRESETS.MAXIMAL, { driveOffsetTicks: 0 });
    expect(state.resolution?.timings.map((t) => t.cue)).toEqual(['depth', 'drive']);
  });

  it('keeps every reported number finite and serialisable', () => {
    for (const load of [0.4, 0.88, 1.05]) {
      for (const offset of [null, -20, 0, 20] as (number | null)[]) {
        const state = play(load, { driveOffsetTicks: offset });
        const round = JSON.parse(JSON.stringify(state)) as LiftState;
        expect(round.resolution).not.toBeNull();
        for (const t of round.resolution?.timings ?? []) {
          expect(Number.isFinite(t.offsetMs)).toBe(true);
          expect(Number.isFinite(t.quality)).toBe(true);
        }
        expect(Number.isFinite(round.height)).toBe(true);
        expect(Number.isFinite(round.velocity)).toBe(true);
      }
    }
  });
});
