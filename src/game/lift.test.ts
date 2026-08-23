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
  downCommandDelayTicks,
  driveAttemptsFor,
  eccentricKindOf,
  lockoutHoldIsLive,
  gradeReaction,
  gradeTiming,
  hapticFor,
  holeTicks,
  isGrind,
  lifterCapacity,
  lockoutTicks,
  promptFor,
  pressCommandIsLive,
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
  type EccentricLiftKind,
  type PlayableLiftKind,
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

/**
 * Every "played" rep in this file is squat unless a test says otherwise —
 * this file predates bench and its assertions are about the mechanic's
 * general shape, not squat specifically. A default keeps that unchanged
 * rather than forcing every existing call site to spell out a kind that was
 * always implied.
 */
// SQUAT AND BENCH ONLY. `pressTickFor`/`releaseTickFor`/`play` describe a rep
// that goes DOWN first, which is what `EccentricLiftKind` means — a deadlift
// has no descent to compute a release tick for, and `descentRate` will not
// accept one. Deadlift's harness is `deadliftRep` further down.
const DEFAULT_KIND: EccentricLiftKind = 'squat';

/** Tick the player presses to start the descent. */
function pressTickFor(load: number, kind: EccentricLiftKind = DEFAULT_KIND): number {
  return braceTicks(load, kind) + 1;
}

/** Tick at which a hold started on `pressTick` reaches `depth`. */
function releaseTickFor(load: number, depth: number, kind: EccentricLiftKind = DEFAULT_KIND): number {
  return pressTickFor(load, kind) + Math.round(depth / descentRate(load, kind));
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
  // Eccentric-only helper: it scripts a descent. `eccentricKindOf` refuses a
  // deadlift rather than quietly probing it as a squat.
  const kind = eccentricKindOf(config.kind, 'a scripted descent');
  const probe = runLift(config, [
    { tick: pressTickFor(load, kind), kind: 'press' },
    { tick: releaseTickFor(load, depth, kind), kind: 'release' },
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
  readonly kind?: EccentricLiftKind;
}

function play(loadRatio: number, options: PlayOptions = {}): LiftState {
  const kind = options.kind ?? DEFAULT_KIND;
  const depth = options.depth ?? LIFT_TUNING.DEPTH_IDEAL[kind];
  const config: LiftConfig = {
    kind,
    loadRatio,
    seed: options.seed ?? 20260801,
    ...(options.feel === undefined ? {} : { feel: options.feel }),
  };
  const script: ScriptedInput[] = [
    { tick: pressTickFor(loadRatio, kind), kind: 'press' },
    { tick: releaseTickFor(loadRatio, depth, kind), kind: 'release' },
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
  const release = releaseTickFor(load, LIFT_TUNING.DEPTH_IDEAL[DEFAULT_KIND]);
  return [
    { tick: pressTickFor(load), kind: 'press' },
    { tick: release, kind: 'release' },
    { tick: release + holeTicks(load, DEFAULT_KIND) + 2, kind: 'press' },
  ];
}

function outcomeOf(state: LiftState): LiftOutcome {
  const resolution = state.resolution;
  if (resolution === null) throw new Error('rep did not resolve');
  return resolution.outcome;
}

// ---------------------------------------------------------------------------
// Bench harness (GDD §6.2's press-timing check)
//
// The command tick is READ BACK OUT OF THE SIM, never recomputed from
// `PRESS_COMMAND_DELAY_TICKS`. Same discipline as `driveIdealTick` above and
// for the same reason: a test that derived the command tick from the tuning
// file would agree with a broken sim that fired the command at the wrong
// moment, which is precisely the bug worth catching.
// ---------------------------------------------------------------------------

const BENCH: EccentricLiftKind = 'bench';

/** Press-and-release down to the chest. Everything before the pause. */
function benchToChest(load: number, seed: number): { config: LiftConfig; script: ScriptedInput[] } {
  return {
    config: { kind: BENCH, loadRatio: load, seed },
    script: [
      { tick: pressTickFor(load, BENCH), kind: 'press' },
      { tick: releaseTickFor(load, LIFT_TUNING.DEPTH_IDEAL[BENCH], BENCH), kind: 'release' },
    ],
  };
}

/** The tick the sim itself fired the press command on, or null if it never did. */
function commandTickFor(load: number, seed: number): number | null {
  const { config, script } = benchToChest(load, seed);
  for (const state of runLift(config, script).history) {
    if (state.events.some((e) => e.kind === 'press-command')) return state.tick;
  }
  return null;
}

/**
 * A whole bench rep, pressing `reactionTicks` after the command the sim armed.
 *
 * A negative value is a false start — a press thrown that many ticks BEFORE the
 * command lands. `null` never presses at all, which is what exercises the
 * give-up path.
 */
function benchRep(
  load: number,
  seed: number,
  reactionTicks: number | null,
  driveOffsetTicks: number | null = 0,
): LiftState {
  const { config, script } = benchToChest(load, seed);
  const command = commandTickFor(load, seed);
  const full = [...script];
  if (command !== null && reactionTicks !== null) {
    full.push({ tick: Math.max(1, command + reactionTicks), kind: 'press' });
  }
  if (driveOffsetTicks !== null) {
    // The drive cue's own ideal tick, again read back rather than derived.
    const probe = runLift(config, full);
    const opens = probe.history.filter((s) => s.events.some((e) => e.kind === 'drive-cue-open'));
    const cue = opens[opens.length - 1]?.activeCue ?? null;
    if (cue !== null) full.push({ tick: cue.idealTick + driveOffsetTicks, kind: 'press' });
  }
  return runLift(config, full).final;
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
      expect(
        promptFor({ ...createLift({ kind: DEFAULT_KIND, loadRatio: 1, seed: 1 }), phase }),
        phase,
      ).toBeTruthy();
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
    const a = runLift({ kind: DEFAULT_KIND, loadRatio: LOAD_PRESETS.MAXIMAL, seed: 1 }, [
      { tick: pressTickFor(LOAD_PRESETS.MAXIMAL), kind: 'press' },
      {
        tick: releaseTickFor(LOAD_PRESETS.MAXIMAL, LIFT_TUNING.DEPTH_IDEAL[DEFAULT_KIND]),
        kind: 'release',
      },
    ]);
    const b = runLift({ kind: DEFAULT_KIND, loadRatio: LOAD_PRESETS.MAXIMAL, seed: 2 }, [
      { tick: pressTickFor(LOAD_PRESETS.MAXIMAL), kind: 'press' },
      {
        tick: releaseTickFor(LOAD_PRESETS.MAXIMAL, LIFT_TUNING.DEPTH_IDEAL[DEFAULT_KIND]),
        kind: 'release',
      },
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
      const rep = runLift(
        { kind: DEFAULT_KIND, loadRatio: load, seed: Math.floor(draw() * 1e6) },
        script,
      );
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
      const d = ascentDemand(h, LOAD_PRESETS.MAXIMAL, DEFAULT_KIND);
      if (d > peak) {
        peak = d;
        peakH = h;
      }
    }
    expect(peakH).toBeCloseTo(STICK_HEIGHT_FRAC[DEFAULT_KIND], 2);
    expect(STICK_HEIGHT_FRAC[DEFAULT_KIND]).toBe(STICK.HEIGHT_FRAC);
  });

  it('rises with load everywhere in the range', () => {
    for (let h = 0; h <= 1.0001; h += 0.05) {
      let previous = -Infinity;
      for (let load = 0.4; load <= 1.05; load += 0.05) {
        const d = ascentDemand(h, load, DEFAULT_KIND);
        expect(d).toBeGreaterThan(previous);
        previous = d;
      }
    }
  });

  it('makes being buried strictly harder', () => {
    const flat = ascentDemand(STICK_HEIGHT_FRAC[DEFAULT_KIND], LOAD_PRESETS.MAXIMAL, DEFAULT_KIND, 0);
    const buried = ascentDemand(STICK_HEIGHT_FRAC[DEFAULT_KIND], LOAD_PRESETS.MAXIMAL, DEFAULT_KIND, 0.2);
    expect(buried).toBeGreaterThan(flat);
  });

  it('exceeds what the lifter has at a limit and not at a warm-up', () => {
    // If neither of these held there would be no sticking point to grind
    // through, or no weight a lifter could warm up with.
    expect(
      ascentDemand(STICK_HEIGHT_FRAC[DEFAULT_KIND], LOAD_PRESETS.MAXIMAL, DEFAULT_KIND),
    ).toBeGreaterThan(LIFT_TUNING.LIFTER_CAPACITY);
    expect(
      ascentDemand(STICK_HEIGHT_FRAC[DEFAULT_KIND], LOAD_PRESETS.WARMUP, DEFAULT_KIND),
    ).toBeLessThan(LIFT_TUNING.LIFTER_CAPACITY);
  });
});

describe('load-derived timings', () => {
  it('descends slower, braces longer and holds longer under load', () => {
    expect(descentRate(LOAD_PRESETS.MAXIMAL, DEFAULT_KIND)).toBeLessThan(
      descentRate(LOAD_PRESETS.LIGHT, DEFAULT_KIND),
    );
    expect(braceTicks(LOAD_PRESETS.MAXIMAL, DEFAULT_KIND)).toBeGreaterThan(
      braceTicks(LOAD_PRESETS.LIGHT, DEFAULT_KIND),
    );
    expect(holeTicks(LOAD_PRESETS.MAXIMAL, DEFAULT_KIND)).toBeGreaterThan(
      holeTicks(LOAD_PRESETS.LIGHT, DEFAULT_KIND),
    );
    expect(lockoutTicks(LOAD_PRESETS.MAXIMAL, DEFAULT_KIND)).toBeGreaterThan(
      lockoutTicks(LOAD_PRESETS.LIGHT, DEFAULT_KIND),
    );
  });

  it('never returns a zero-length phase, even at absurd loads', () => {
    for (const load of [0.01, 0.35, 1.05, 50]) {
      expect(braceTicks(load, DEFAULT_KIND)).toBeGreaterThanOrEqual(1);
      expect(holeTicks(load, DEFAULT_KIND)).toBeGreaterThanOrEqual(1);
      expect(lockoutTicks(load, DEFAULT_KIND)).toBeGreaterThanOrEqual(1);
      expect(descentRate(load, DEFAULT_KIND)).toBeGreaterThan(0);
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
      runLift({ kind: DEFAULT_KIND, loadRatio: load, seed: 3 }, [
        { tick: pressTickFor(load), kind: 'press' },
      ]).final.resolution?.missReason ?? '',
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
    // DEADLIFT, for 'dropped'. Squat and bench cannot reach it — their LOCKOUT
    // asks for nothing — so a squat-only sweep would report it unreachable, in
    // exactly the way this guard caught the three press kinds when bench
    // landed. The ASSERTION below is unchanged; what grew is the domain it is
    // asserted over, which is the direction that strengthens a reachability
    // check rather than weakening it.
    reasons.add(
      deadliftRep(0.9, 1, DEADLIFT_SWEEP.LET_GO_AFTER_TICKS).resolution?.missReason ?? '',
    );
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
    const early = runLift({ kind: DEFAULT_KIND, loadRatio: load, seed: 5 }, earlyDriveScript(load))
      .final;
    expect(early.timings.some((t) => t.cue === 'drive' && t.grade === 'missed')).toBe(true);
    // The script presses exactly once, so drivesUsed is 1 whatever the
    // load's own attempts budget is — not `driveAttemptsFor(load)`, which
    // would assert the script exhausted the WHOLE budget when it only ever
    // threw one drive.
    expect(early.drivesUsed).toBe(1);
  });

  it('gives the drive boost regardless of whether the player keeps holding — a landed drive is a committed impulse', () => {
    // THIS TEST USED TO PIN THE OPPOSITE, and that pin was the bug: it
    // asserted a released rep must reach a LOWER peak height than a held one.
    // Fixed after a phone playtest found landing a second or third drive cue
    // (the tap-rate mechanic) is only reachable on a real device by releasing
    // and re-touching — Pressable's onPressIn does not re-fire on a
    // continuous hold — and the old hold-gated boost made every release fatal
    // at MAXIMAL load, the exact load the tap-rate mechanic exists for.
    const load = 0.95;
    const held = play(load, { driveOffsetTicks: 0 });
    const dropped = play(load, { driveOffsetTicks: 0, releaseAfterDriveTicks: 3 });
    expect(outcomeOf(held)).not.toBe('miss');
    // The committed impulse does not care that the finger came up: releasing
    // 3 ticks after a perfectly-timed drive reaches the SAME peak height as
    // never releasing at all.
    expect(dropped.resolution?.peakHeight).toBeCloseTo(held.resolution?.peakHeight ?? Number.NaN, 6);
    expect(outcomeOf(dropped)).not.toBe('miss');
  });

  it('a release that never re-presses reaches the SAME peak as never releasing at all — the boost no longer cares', () => {
    // The direct claim the fix makes: once landed, a drive's boost is
    // independent of hold state. Releasing with no second tap at all — the
    // simplest possible case — must trace an IDENTICAL trajectory to holding
    // straight through, at every load the old coupling could have mattered.
    const load = LOAD_PRESETS.MAXIMAL;
    const config: LiftConfig = { kind: DEFAULT_KIND, loadRatio: load, seed: 424242 };
    const depth = LIFT_TUNING.DEPTH_IDEAL[DEFAULT_KIND];
    const press = pressTickFor(load);
    const release = releaseTickFor(load, depth);
    const base: ScriptedInput[] = [
      { tick: press, kind: 'press' },
      { tick: release, kind: 'release' },
    ];
    const cue0 = latestDriveCue(config, base);
    expect(cue0).not.toBeNull();
    if (cue0 === null) return;
    const held: ScriptedInput[] = [...base, { tick: cue0.idealTick, kind: 'press' }];
    const releasedNoRepress: ScriptedInput[] = [...held, { tick: cue0.idealTick + 1, kind: 'release' }];
    const heldFinal = runLift(config, held).final;
    const releasedFinal = runLift(config, releasedNoRepress).final;
    expect(heldFinal.resolution?.outcome).not.toBe('miss');
    expect(releasedFinal.resolution?.outcome).toBe(heldFinal.resolution?.outcome);
    expect(releasedFinal.resolution?.peakHeight).toBeCloseTo(
      heldFinal.resolution?.peakHeight ?? Number.NaN,
      9,
    );
  });

  it('tolerates a real motor-timing gap — release after cue 0, then land the REAL cue 1 the release exists to reach', () => {
    // The regression this fix exists for, reproduced and closed. Before the
    // fix, THIS exact sequence — release, then accurately land the next real
    // cue — still failed, because the release alone had already doomed the
    // rep by the time the second tap could land: the "natural, never
    // re-press" outcome was ALREADY a miss regardless of when or whether the
    // player re-pressed. That is the bug. A repress landing too EARLY (before
    // the next cue has actually armed) is a separate, correct mechanism —
    // Piece 2's own mistimed-press penalty — and is not what this test is
    // about; it targets cue 1's own real ideal tick, read back from the sim
    // the same way `driveCueSequence` does, not guessed.
    const load = LOAD_PRESETS.MAXIMAL;
    const config: LiftConfig = { kind: DEFAULT_KIND, loadRatio: load, seed: 424242 };
    const depth = LIFT_TUNING.DEPTH_IDEAL[DEFAULT_KIND];
    const press = pressTickFor(load);
    const release = releaseTickFor(load, depth);
    const base: ScriptedInput[] = [
      { tick: press, kind: 'press' },
      { tick: release, kind: 'release' },
    ];
    const cue0 = latestDriveCue(config, base);
    expect(cue0).not.toBeNull();
    if (cue0 === null) return;
    const releasedOnly: ScriptedInput[] = [
      ...base,
      { tick: cue0.idealTick, kind: 'press' },
      { tick: cue0.idealTick + 1, kind: 'release' },
    ];
    const cue1 = latestDriveCue(config, releasedOnly);
    expect(cue1, 'a real cue 1 must arm after the release for this test to mean anything').not.toBeNull();
    if (cue1 === null) return;
    const script: ScriptedInput[] = [...releasedOnly, { tick: cue1.idealTick, kind: 'press' }];
    const final = runLift(config, script).final;
    expect(final.resolution?.outcome, 'release then an accurate second tap must not miss').not.toBe(
      'miss',
    );
    const timings = final.timings.filter((t) => t.cue === 'drive');
    expect(timings.length).toBe(2);
    expect(timings.every((t) => t.grade === 'perfect')).toBe(true);
  });

  it('holds across a real spread of release timing and seeds — not one cherry-picked config', () => {
    // Non-vacuity for the two tests above: a fix proven on one seed could be
    // an artefact of that seed's own arithmetic. Sweeps 12 seeds at MAXIMAL,
    // releasing anywhere from 1 tick after cue 0's press to a full second
    // BEFORE landing the real cue 1 (queried per seed, not assumed) — the
    // full plausible range of "when does a real thumb come off the glass".
    // Every reachable (cue0, cue1) pair must survive at every release point
    // tried on it; a load where no cue1 ever arms is skipped and counted,
    // so the sweep cannot pass by silently finding nothing to test.
    const load = LOAD_PRESETS.MAXIMAL;
    const depth = LIFT_TUNING.DEPTH_IDEAL[DEFAULT_KIND];
    const press = pressTickFor(load);
    const release = releaseTickFor(load, depth);
    let pairsChecked = 0;
    let pairsPassed = 0;
    let skippedNoCue1 = 0;
    for (let seed = 1; seed <= 12; seed += 1) {
      const config: LiftConfig = { kind: DEFAULT_KIND, loadRatio: load, seed };
      const base: ScriptedInput[] = [
        { tick: press, kind: 'press' },
        { tick: release, kind: 'release' },
      ];
      const cue0 = latestDriveCue(config, base);
      if (cue0 === null) continue;
      const heldThrough: ScriptedInput[] = [...base, { tick: cue0.idealTick, kind: 'press' }];
      const cue1 = latestDriveCue(config, heldThrough);
      if (cue1 === null) {
        skippedNoCue1 += 1;
        continue;
      }
      for (const releaseOffsetTicks of [1, 15, 30, 60]) {
        const releaseAt = cue0.idealTick + releaseOffsetTicks;
        if (releaseAt >= cue1.idealTick) continue; // must still precede the tap it's testing
        const script: ScriptedInput[] = [
          ...heldThrough,
          { tick: releaseAt, kind: 'release' },
          { tick: cue1.idealTick, kind: 'press' },
        ];
        const outcome = runLift(config, script).final.resolution?.outcome;
        pairsChecked += 1;
        // Counted from the boolean directly, not from expect() surviving —
        // so this number means "passed", not "was reached before something
        // else threw". The expect() below still fails fast with a
        // per-pair message naming the offending seed/offset/cues; this
        // counter is the thing that lets the final assertion say 48/48
        // rather than merely "we got through the loop".
        if (outcome !== 'miss') pairsPassed += 1;
        expect(
          outcome,
          `seed=${seed} releaseOffset=${releaseOffsetTicks}t (cue0=${cue0.idealTick} cue1=${cue1.idealTick})`,
        ).not.toBe('miss');
      }
    }
    // Non-vacuity: the sweep actually exercised real (cue0, cue1) pairs, and
    // most seeds offered one — if this drops to 0 the sweep is testing
    // nothing and the checks above are passing vacuously.
    // Pinned counts, not bounds — measured at 48 pairs (12 seeds x 4 release
    // offsets, none skipped) so a change that quietly narrows the domain
    // (fewer seeds offering a real cue 1, say) is a red test, not a smaller
    // green one. pairsPassed pinned separately and explicitly at the same
    // 48, so this reads as 48/48 passed rather than merely 48 attempted.
    expect(pairsChecked).toBe(48);
    expect(pairsPassed).toBe(48);
    expect(skippedNoCue1).toBe(0);
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
  const config: LiftConfig = { kind: DEFAULT_KIND, loadRatio: load, seed: 20260801 };
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

/**
 * Discover every drive cue a rep offers, in order, pressing each one
 * `hitOffsetTicks` from its own ideal moment (0 = perfect) — or skipping a
 * cue entirely when its index is in `missIndices`, letting its window close
 * unpressed.
 *
 * Iterative and read back from the sim at every step, same discipline as
 * `driveIdealTick` above: cue N's ideal tick depends on when cue N-1
 * resolved plus the spacing, which is a runtime fact, not something this
 * helper is allowed to precompute from the tuning file.
 */
function driveCueSequence(
  config: LiftConfig,
  depth: number,
  hitOffsetTicks: number,
  missIndices: ReadonlySet<number> = new Set(),
): { readonly cues: readonly CueWindow[]; readonly script: ScriptedInput[]; readonly final: LiftState } {
  const load = config.loadRatio;
  // Eccentric-only, same as `driveIdealTick`: it scripts a descent.
  const kind = eccentricKindOf(config.kind, 'a scripted descent');
  const script: ScriptedInput[] = [
    { tick: pressTickFor(load, kind), kind: 'press' },
    { tick: releaseTickFor(load, depth, kind), kind: 'release' },
  ];
  const cues: CueWindow[] = [];
  const attempts = driveAttemptsFor(load, kind);
  for (let index = 0; index < attempts; index += 1) {
    const opened = latestDriveCue(config, script);
    const lastKnown = cues[cues.length - 1];
    if (opened === null || (lastKnown !== undefined && opened.idealTick === lastKnown.idealTick)) {
      break;
    }
    cues.push(opened);
    if (!missIndices.has(index)) {
      script.push({ tick: opened.idealTick + hitOffsetTicks, kind: 'press' });
    }
  }
  return { cues, script, final: runLift(config, script).final };
}

/**
 * The newest drive cue a script has revealed, or `null` if none has opened.
 *
 * The LAST 'drive-cue-open' event, not the first: replaying a script from
 * tick 0 re-fires cue 0's own opening every time, so the first match in
 * history is always cue 0 regardless of how many later cues the script has
 * gone on to press. `armedCue` above is the wrong tool for a script that
 * already presses an earlier cue — it returns the first 'drive' cue it
 * finds, which is that stale cue 0, not whatever opened after it.
 */
function latestDriveCue(config: LiftConfig, script: readonly ScriptedInput[]): CueWindow | null {
  const probe = runLift(config, script);
  const opens = probe.history.filter((state) =>
    state.events.some((event) => event.kind === 'drive-cue-open'),
  );
  const latest = opens[opens.length - 1];
  return latest?.activeCue ?? null;
}

describe('the drive tap-rate mechanic (Sprint 3 gate)', () => {
  const limit = LOAD_PRESETS.MAXIMAL;
  const config: LiftConfig = { kind: DEFAULT_KIND, loadRatio: limit, seed: 20260819 };

  it('offers more than one drive cue at MAXIMAL, at or under the driveAttemptsFor(load) ceiling', () => {
    // `driveAttemptsFor` is a CEILING, not a promise every rep needs that
    // many cues: two well-timed drives can already put the bar on a
    // trajectory that reaches LOCKOUT before a third cue's arm conditions
    // (drivesUsed>0, spacing elapsed, height past DRIVE_ARM_HEIGHT) are ever
    // met — finishing fast is the reward for good execution, not a bug.
    // Measured at this seed: a perfectly-played rep opens exactly 2 of the
    // 3-attempt ceiling before it resolves. What must hold structurally is
    // that MORE than one cue is reachable at all, and never more than the
    // declared ceiling.
    const attempts = driveAttemptsFor(limit, config.kind);
    expect(attempts).toBeGreaterThan(1);
    const { cues, final } = driveCueSequence(config, LIFT_TUNING.DEPTH_IDEAL[DEFAULT_KIND], 0);
    expect(cues.length).toBeGreaterThanOrEqual(2);
    expect(cues.length).toBeLessThanOrEqual(attempts);
    expect(final.drivesUsed).toBe(cues.length);
  });

  it('each cue is genuinely a NEW window, not the first one read twice', () => {
    const { cues } = driveCueSequence(config, LIFT_TUNING.DEPTH_IDEAL[DEFAULT_KIND], 0);
    // Non-vacuity: with fewer than 2 cues the distinctness/ordering checks
    // below hold on an empty or singleton array without saying anything.
    expect(cues.length).toBeGreaterThanOrEqual(2);
    const idealTicks = cues.map((c) => c.idealTick);
    expect(new Set(idealTicks).size).toBe(idealTicks.length);
    // ...and they arrive in order, later cues later.
    for (let i = 1; i < idealTicks.length; i += 1) {
      const prior = idealTicks[i - 1];
      const current = idealTicks[i];
      expect(prior).toBeDefined();
      expect(current).toBeDefined();
      if (prior !== undefined && current !== undefined) expect(current).toBeGreaterThan(prior);
    }
  });

  it('a mistimed press between cues costs velocity, does not end the rep, and the next cue still arms', () => {
    // "Missing" a cue by never pressing during its window is free — the
    // window just closes (lift.ts:1063-1071), no InputTiming, no penalty.
    // The mechanic's actual notion of a missed tap is a press that lands
    // with NO cue armed at all: `gradeTiming` only ever returns 'missed'
    // when the press is outside the window entirely, which for an
    // in-sequence tap means pressing during the inter-cue spacing gap.
    // Landing cue 0 cleanly, then pressing again one tick later — deep
    // inside `driveSpacingTicks(MAXIMAL)`'s gap, before cue 1 has re-armed —
    // is exactly that case.
    const cue0 = driveIdealTick(config, LIFT_TUNING.DEPTH_IDEAL[DEFAULT_KIND]);
    expect(cue0).not.toBeNull();
    if (cue0 === null) return;
    const cue0Script: ScriptedInput[] = [
      { tick: pressTickFor(limit), kind: 'press' },
      { tick: releaseTickFor(limit, LIFT_TUNING.DEPTH_IDEAL[DEFAULT_KIND]), kind: 'release' },
      { tick: cue0, kind: 'press' },
    ];
    const gapScript: ScriptedInput[] = [...cue0Script, { tick: cue0 + 1, kind: 'press' }];
    const gapReplay = runLift(config, gapScript);
    const gapState = gapReplay.history.find((s) => s.tick === cue0 + 1);
    expect(gapState).toBeDefined();
    expect(gapState?.activeCue).toBeNull();
    // Did NOT instantly end the rep: still mid-ASCENT the tick right after.
    expect(gapState?.phase).toBe('ASCENT');

    const timings = gapReplay.final.timings.filter((t) => t.cue === 'drive');
    expect(timings.length).toBe(2);
    expect(timings[0]?.grade).toBe('perfect');
    expect(timings[1]?.grade).toBe('missed');

    // The sequence was not abandoned: a further drive cue still arms once
    // the spacing elapses.
    const cue1 = latestDriveCue(config, gapScript);
    expect(cue1, 'no further drive cue armed after the mistimed press').not.toBeNull();

    // The cost is real: at the moment of the mistimed press, velocity reads
    // strictly below the same tick in a clean run that never threw the
    // extra press — a mistimed tap can only cost, never help.
    const cleanState = runLift(config, cue0Script).history.find((s) => s.tick === cue0 + 1);
    expect(cleanState).toBeDefined();
    if (cleanState !== undefined && gapState !== undefined) {
      expect(gapState.velocity).toBeLessThan(cleanState.velocity);
    }
  });

  it('a new hit REPLACES the boost rather than stacking it', () => {
    // Land cue 0 with mediocre timing, then cue 1 dead-on — driveQuality
    // after cue 1 must read cue 1's own quality (close to 1), not a sum or
    // an average with cue 0's.
    const { final } = driveCueSequence(config, LIFT_TUNING.DEPTH_IDEAL[DEFAULT_KIND], 0);
    expect(final.driveQuality).toBeGreaterThan(0.9);
    expect(final.driveQuality).toBeLessThanOrEqual(1);
  });

  it('driveAttemptsFor is 1 at the true floor and LIFT_TUNING.DRIVE_ATTEMPTS_PER_REP.MAXIMAL at the true ceiling', () => {
    // LOAD_RANGE.MIN / LOAD_RANGE.MAX, not LOAD_PRESETS.LIGHT / .MAXIMAL —
    // the Finding 2 retune (DRIVE_ATTEMPTS_PER_REP.MAXIMAL 3 -> 6) steepened
    // byLoad's whole curve, and neither LOAD_PRESETS.LIGHT (0.55) nor
    // LOAD_PRESETS.MAXIMAL (1, short of LOAD_RANGE.MAX's 1.05) sits exactly
    // at byLoad's own endpoints. LOAD_PRESETS.MAXIMAL landing on the exact
    // ceiling (3, under the old tuning) was a numeric coincidence of the old
    // numbers, not a guarantee: at the new values it rounds to 5, one short
    // of the true 6. LOAD_PRESETS.LIGHT similarly now rounds to 2, not 1 —
    // measured by this file's own multi-seed sweep below. The floor/ceiling
    // claim this test means to make is true at LOAD_RANGE.MIN/MAX, which no
    // RPE this session's ladder reaches goes anywhere near (RPE6 x3, the
    // ladder's own lightest choice, is 81.1% of e1RM and gives 3; RPE10 x3,
    // the heaviest, is 92.2% and gives 5 — see liftTuning.ts's
    // DRIVE_ATTEMPTS_PER_REP header for the full RPE6-10 measurement).
    expect(driveAttemptsFor(LOAD_RANGE.MIN, DEFAULT_KIND)).toBe(1);
    expect(driveAttemptsFor(LOAD_RANGE.MAX, DEFAULT_KIND)).toBe(
      LIFT_TUNING.DRIVE_ATTEMPTS_PER_REP[DEFAULT_KIND].MAXIMAL,
    );
  });

  it('the drive window is narrower at MAXIMAL than at LIGHT, read back from a played cue', () => {
    const lightConfig: LiftConfig = { kind: DEFAULT_KIND, loadRatio: LOAD_PRESETS.LIGHT, seed: config.seed };
    const lightCue = driveIdealTick(lightConfig, LIFT_TUNING.DEPTH_IDEAL[DEFAULT_KIND]);
    const heavyCue = driveCueSequence(config, LIFT_TUNING.DEPTH_IDEAL[DEFAULT_KIND], 0).cues[0];
    expect(lightCue).not.toBeNull();
    expect(heavyCue).toBeDefined();
    const lightWidthMs = cueWindowMs('drive', lightConfig);
    expect(lightWidthMs).toBeGreaterThan(heavyCue?.widthMs ?? Number.POSITIVE_INFINITY);
  });
});

// ---------------------------------------------------------------------------
// BENCH — the press command (GDD §6.2, "press-timing / bar-speed check off the
// chest")
//
// WHAT THESE ARE FOR. A phone playtest found bench was "still a squat": the
// per-kind numbers made it a retuned squat, not a different lift. The claim
// these tests defend is the structural one — that bench's HOLE asks for
// something squat's does not, that what it asks for is a REACTION rather than
// an anticipation, and that what the reaction buys is bar speed. They say
// nothing about whether it feels good; GDD §12.1 puts that with a human.
// ---------------------------------------------------------------------------

describe('the bench press command', () => {
  const load = LOAD_PRESETS.MAXIMAL;

  it('fires a command on bench and never on squat', () => {
    const benched = benchRep(load, 3, 2);
    expect(benched.timings.some((t) => t.cue === 'press')).toBe(true);

    // The discriminator. Squat's HOLE is a fixed reversal beat that asks for
    // nothing, and no squat rep at any timing may produce a press cue.
    for (let offset = -6; offset <= 6; offset += 1) {
      const squat = play(load, { driveOffsetTicks: offset });
      expect(squat.timings.some((t) => t.cue === 'press'), `squat offset ${offset}`).toBe(false);
      expect(squat.pressCommandTick, `squat offset ${offset}`).toBeNull();
    }
  });

  it('puts the command inside its declared range, and does not put it in the same place twice', () => {
    // FACT 3 OF THE PROGRESSION RULE, applied to a delay: a constant would
    // satisfy "inside the range" perfectly and be exactly the defect — a
    // learnable pause is an anticipation check wearing a reaction's name.
    const { MIN, MAX } = LIFT_TUNING.PRESS_COMMAND_DELAY_TICKS;
    const delays = new Set<number>();
    for (let seed = 1; seed <= 40; seed += 1) {
      const holeEntry = runLift(
        benchToChest(load, seed).config,
        benchToChest(load, seed).script,
      ).history.find((s) => s.phase === 'HOLE');
      const command = commandTickFor(load, seed);
      expect(holeEntry, `seed ${seed}`).toBeDefined();
      expect(command, `seed ${seed}`).not.toBeNull();
      if (holeEntry === undefined || command === null) continue;
      const delay = command - holeEntry.tick;
      expect(delay, `seed ${seed}`).toBeGreaterThanOrEqual(MIN);
      expect(delay, `seed ${seed}`).toBeLessThanOrEqual(MAX);
      delays.add(delay);
    }
    // It MOVES. Pinned as a count rather than a bound so an empty or collapsed
    // domain reports itself instead of passing.
    expect(delays.size, `only ${delays.size} distinct pauses over 40 seeds`).toBeGreaterThan(8);
  });

  it('is deterministic: the same seed pauses for exactly the same length', () => {
    // The other half of unpredictability. Unpredictable to the player, and
    // byte-identical on replay, or the recorded-attempt guarantee dies.
    for (let seed = 1; seed <= 6; seed += 1) {
      expect(commandTickFor(load, seed), `seed ${seed}`).toBe(commandTickFor(load, seed));
      expect(JSON.stringify(benchRep(load, seed, 3))).toBe(JSON.stringify(benchRep(load, seed, 3)));
    }
  });

  it('buys bar speed with the reaction — sharp off the chest beats slow', () => {
    // "bar-speed check off the chest", measured on the bar rather than on the
    // grade. The velocity entering the ascent must fall as the reaction slows.
    const speedAt = (reactionTicks: number): number => {
      const { config, script } = benchToChest(load, 7);
      const command = commandTickFor(load, 7);
      if (command === null) throw new Error('no command');
      const full = [...script, { tick: command + reactionTicks, kind: 'press' as const }];
      const ascent = runLift(config, full).history.find((s) => s.phase === 'ASCENT');
      if (ascent === undefined) throw new Error('never reached the ascent');
      return ascent.velocity;
    };
    const sharp = speedAt(0);
    const middling = speedAt(9);
    const slow = speedAt(20);
    expect(sharp).toBeGreaterThan(middling);
    expect(middling).toBeGreaterThan(slow);
  });

  it('consumes the press on a false start, so mashing the pause is not a strategy', () => {
    // The reason the false start costs the reaction rather than the rep. If a
    // false start were merely ignored, holding the button down through the
    // pause would land on the command by construction and the whole check
    // would be optional.
    const jumped = benchRep(load, 11, -8);
    const pressTiming = jumped.timings.find((t) => t.cue === 'press');
    expect(pressTiming).toBeDefined();
    expect(pressTiming?.grade).toBe('missed');
    expect(jumped.pressQuality).toBe(LIFT_TUNING.PRESS_FALSE_START_QUALITY);
    expect(jumped.pressUsed).toBe(true);

    // And it is strictly worse off the chest than reacting properly.
    const reacted = benchRep(load, 11, 1);
    expect(jumped.pressQuality).toBeLessThan(reacted.pressQuality);
  });

  it('does NOT end the rep on a false start — the bar still leaves the chest', () => {
    // `PRESS_FALSE_START_QUALITY`'s comment says in capitals that a false start
    // "DOES NOT END THE REP", consistent with the drive branch's own rule. That
    // sentence had nothing behind it until this test: the guarantee-tag census
    // flagged the paragraph as newly triggering, and checking what actually
    // backed it turned up nothing. Prose is not a check.
    const { config, script } = benchToChest(load, 11);
    const command = commandTickFor(load, 11);
    expect(command).not.toBeNull();
    if (command === null) return;
    const jumpedScript = [...script, { tick: command - 8, kind: 'press' as const }];
    const replay = runLift(config, jumpedScript);

    // The false start really happened — otherwise everything below is true of
    // a rep that simply never pressed, and the test is about nothing.
    const pressTiming = replay.final.timings.find((t) => t.cue === 'press');
    expect(pressTiming?.grade, 'no false start was actually thrown').toBe('missed');
    expect(pressTiming?.offsetMs ?? 0).toBeLessThan(0);

    // And the rep outlived it: the bar left the chest and the ascent ran.
    expect(replay.history.some((s) => s.phase === 'ASCENT')).toBe(true);
    expect(replay.final.ascentTicks).toBeGreaterThan(0);
    // Resolved on the physics' own terms, never 'buried' — the reason a rep
    // killed at the chest would carry.
    expect(replay.final.resolution?.missReason).not.toBe('buried');
  });

  it('lets go of the bar if the command is ignored, rather than hanging on the chest', () => {
    const ignored = benchRep(load, 5, null, null);
    expect(ignored.phase).toBe('RESOLVED');
    expect(ignored.resolution).not.toBeNull();
    // At quality 0 the bar leaves the chest at PRESS_VELOCITY.MIN, which at a
    // limit load is a stall — called on its own merits by the existing physics
    // rather than by a fifth MissReason invented for it.
    expect(ignored.resolution?.outcome).toBe('miss');
  });

  it('shows the command in the prompt, and only from the tick it fires', () => {
    const { config, script } = benchToChest(load, 3);
    const command = commandTickFor(load, 3);
    expect(command).not.toBeNull();
    if (command === null) return;
    const hole = runLift(config, script).history.filter((s) => s.phase === 'HOLE');
    const waiting = hole.filter((s) => s.tick < command);
    const commanded = hole.filter((s) => s.tick >= command);
    expect(waiting.length, 'no waiting ticks to check').toBeGreaterThan(0);
    expect(commanded.length, 'no commanded ticks to check').toBeGreaterThan(0);
    for (const s of waiting) expect(promptFor(s)).toBe(LIFT_COPY.PROMPT.HOLE.bench);
    for (const s of commanded) expect(promptFor(s)).toBe(LIFT_COPY.PROMPT.HOLE_COMMANDED);
  });

  it('draws no countdown ring before the command — a telegraphed reaction is not one', () => {
    // `cueProgress` is what the ring is sized from. A number HERE would let
    // the player see the command coming and the reaction check would silently
    // become an anticipation check. The GO ring starts at the command tick,
    // which is the next test.
    const { config, script } = benchToChest(load, 3);
    const command = commandTickFor(load, 3);
    expect(command).not.toBeNull();
    if (command === null) return;
    for (const s of runLift(config, script).history) {
      if (s.phase !== 'HOLE') continue;
      if (s.tick >= command) continue;
      expect(cueProgress(s), `tick ${s.tick}`).toBeNull();
      expect(pressCommandIsLive(s), `tick ${s.tick}`).toBe(false);
    }
  });

  it('puts the ring on the target the instant the command fires, then closes', () => {
    // Progress 1 is the target radius — GO, not a countdown. Progress then
    // runs toward 2 as the reaction window closes, so a late press is a
    // shrinking ring the same way a late drive is.
    const { config, script } = benchToChest(load, 3);
    const command = commandTickFor(load, 3);
    expect(command).not.toBeNull();
    if (command === null) return;
    const hole = runLift(config, script).history.filter((s) => s.phase === 'HOLE');
    const atFire = hole.find((s) => s.tick === command);
    expect(atFire, 'command tick was not in HOLE').toBeDefined();
    if (atFire === undefined) return;
    expect(pressCommandIsLive(atFire)).toBe(true);
    expect(cueProgress(atFire)).toBe(1);

    const later = hole.filter((s) => s.tick > command && pressCommandIsLive(s));
    expect(later.length, 'no post-command HOLE ticks').toBeGreaterThan(0);
    for (const s of later) {
      const progress = cueProgress(s);
      expect(progress, `tick ${s.tick}`).not.toBeNull();
      expect(progress ?? 0, `tick ${s.tick}`).toBeGreaterThan(1);
    }
  });
});

/**
 * Parameters of the press sweep, named rather than inline.
 *
 * Same reason `streakSweep.ts` exists: the first version of this measurement
 * would have been unreproducible, and a measurement whose inputs are not
 * written down is an anecdote.
 */
const PRESS_SWEEP = {
  SEEDS: 20,
  LOADS: [0.7, 0.8, 0.85, 0.9, 0.95, 1.0] as const,
  /** Reaction offsets in ticks. `null` never presses at all. */
  PERFECT: 0,
  NEVER: null,
  /** Measured at the shipped tuning. Both arms of the drive question. */
  FLIPS: 160,
  CASES: 240,
} as const;

/** A bench rep that also throws every drive cue the sim arms, perfectly. */
function benchRepDriven(
  load: number,
  seed: number,
  reactionTicks: number | null,
  throwDrives: boolean,
): LiftState {
  const { config, script } = benchToChest(load, seed);
  const command = commandTickFor(load, seed);
  let full =
    command === null || reactionTicks === null
      ? script
      : [...script, { tick: Math.max(1, command + reactionTicks), kind: 'press' as const }];
  if (throwDrives) {
    // Iteratively, reading each cue back from the sim — cue N's tick depends
    // on when cue N-1 resolved, which is a runtime fact.
    for (let i = 0; i < 4; i += 1) {
      const opens = runLift(config, full).history.filter((s) =>
        s.events.some((e) => e.kind === 'drive-cue-open'),
      );
      const cue = opens[opens.length - 1]?.activeCue ?? null;
      if (cue === null || full.some((x) => x.tick === cue.idealTick)) break;
      full = [...full, { tick: cue.idealTick, kind: 'press' as const }];
    }
  }
  return runLift(config, full).final;
}

describe('the press decides the lift', () => {
  // ---------------------------------------------------------------------------
  // THE TEST THE FIRST VERSION OF THIS BEAT DID NOT HAVE, AND THE REASON IT
  // SHIPPED BROKEN.
  //
  // The original block asserted that the reaction set the bar's velocity off
  // the chest. It did — 0.019 against 0.0004 at ascent tick 1 — and it meant
  // nothing, because velocity chases net force and an initial value washes out
  // in about `1/VELOCITY_RESPONSE` ticks. Measured then: the OUTCOME was
  // identical whether the player reacted perfectly or never pressed at all, at
  // every load, with and without drives. Thirty cases, zero differences.
  //
  // Eight mutants passed on that version. Every one tested a mechanism — is
  // the delay seeded, is the press consumed, is the velocity written — and not
  // one asked whether the REP CHANGED. So these assert outcomes.
  // ---------------------------------------------------------------------------

  it('flips outcomes between a perfect reaction and none, across the sweep', () => {
    let flips = 0;
    let cases = 0;
    for (let seed = 1; seed <= PRESS_SWEEP.SEEDS; seed += 1) {
      for (const load of PRESS_SWEEP.LOADS) {
        for (const throwDrives of [true, false]) {
          const good = benchRepDriven(load, seed, PRESS_SWEEP.PERFECT, throwDrives);
          const bad = benchRepDriven(load, seed, PRESS_SWEEP.NEVER, throwDrives);
          cases += 1;
          if (good.resolution?.outcome !== bad.resolution?.outcome) flips += 1;
        }
      }
    }
    // Counts, not bounds — an empty or collapsed domain reports itself.
    expect(cases).toBe(PRESS_SWEEP.CASES);
    expect(
      flips,
      `the reaction changed the outcome in ${flips} of ${cases} cases`,
    ).toBe(PRESS_SWEEP.FLIPS);
  });

  it('turns a make into a miss at a limit when the command is ignored', () => {
    // One named case, so a failure reads as a case rather than a count.
    //
    // IT IS AN ILLUSTRATION, NOT THE DISCRIMINATOR, and that is measured
    // rather than assumed: a mutant passing 0 for the shortfall — removing
    // this whole mechanism — leaves THIS test green, because at 0.9 with no
    // drive the old velocity transient flips the outcome on its own. The
    // sweep above is what catches that mutant (40 of 240 against 160).
    //
    // Kept anyway, because a count says a population moved and this says which
    // rep did. Do not read it as evidence for the penalty on its own.
    const made = benchRepDriven(0.9, 7, PRESS_SWEEP.PERFECT, false);
    const ignored = benchRepDriven(0.9, 7, PRESS_SWEEP.NEVER, false);
    expect(made.resolution?.outcome).toBe('good-lift');
    expect(ignored.resolution?.outcome).toBe('miss');
  });

  it('leaves a warm-up alone — a light bar is not a reaction test', () => {
    // GDD §12.3 and the daily loop: a warm-up must not punish. The penalty
    // scales demand, and at a light load demand is far under capacity, so
    // ignoring the command costs time and not the rep. If this ever fails the
    // penalty has grown into a difficulty setting.
    for (let seed = 1; seed <= 8; seed += 1) {
      for (const rt of [PRESS_SWEEP.PERFECT, PRESS_SWEEP.NEVER]) {
        const rep = benchRepDriven(LOAD_PRESETS.LIGHT, seed, rt, true);
        expect(rep.resolution?.outcome, `seed ${seed} reaction ${rt}`).not.toBe('miss');
      }
    }
  });

  it('charges squat nothing for a press it never had', () => {
    // `pressQuality` is 0 on squat because squat has no press. Read without a
    // kind guard that is the MAXIMUM penalty on every squat rep in the game —
    // the sharpest way this fix could have broken the lift that already works.
    for (const load of [0.7, 0.85, 1.0]) {
      const withPress = ascentDemand(0.34, load, 'squat', 0, 1);
      const without = ascentDemand(0.34, load, 'squat', 0, 0);
      // The parameter still applies if passed — the guard is at the call site,
      // and that is what the played-rep check below actually exercises.
      expect(withPress).toBeGreaterThan(without);
      const rep = play(load, { driveOffsetTicks: 0 });
      expect(rep.resolution).not.toBeNull();
    }
    // The real guard: a played squat's demand is the unpenalised curve.
    const squat = play(0.88, { driveOffsetTicks: 0 });
    const ascent = squat.timings.length;
    expect(ascent).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Deadlift harness (GDD §6.2's "lockout grind")
//
// THE LOCKOUT TICK AND EVERY DRIVE CUE ARE READ BACK OUT OF THE SIM, never
// recomputed from the tuning file. Same discipline as `driveIdealTick` and
// `commandTickFor` above, for the same reason: a test that derived the lockout
// tick from the tuning constants would agree with a broken sim that reached
// lockout at the wrong moment, which is precisely the bug worth catching.
// ---------------------------------------------------------------------------

const DEADLIFT: PlayableLiftKind = 'deadlift';

/** Tick the player presses to break the bar off the floor. */
function pullTickFor(load: number): number {
  return braceTicks(load, DEADLIFT) + 1;
}

/**
 * The ascent, driven: start the pull, then tap every drive cue the sim arms.
 *
 * A TAP IS A RELEASE THEN A PRESS, one tick apart, because that is what a tap
 * is on a real device — `Pressable`'s `onPressIn` does not re-fire under a
 * continuous hold. Scripting it as a bare press would let the test hold the
 * finger down for the whole rep and still land every cue, which is exactly the
 * fiction that hid the drive-boost hold-coupling defect until a phone playtest
 * found it. It also matters here specifically: the state the finger is left in
 * by the LAST tap is the state the lockout hold starts from.
 */
function deadliftAscent(config: LiftConfig): ScriptedInput[] {
  let script: ScriptedInput[] = [{ tick: pullTickFor(config.loadRatio), kind: 'press' }];
  for (let i = 0; i < DEADLIFT_SWEEP.MAX_CUES_PROBED; i += 1) {
    const opens = runLift(config, script).history.filter((s) =>
      s.events.some((e) => e.kind === 'drive-cue-open'),
    );
    const cue = opens[opens.length - 1]?.activeCue ?? null;
    if (cue === null) break;
    if (script.some((x) => x.tick === cue.idealTick)) break;
    // STOP TAPPING ONCE THE BAR IS UP. At lighter loads the sim arms a cue and
    // the bar reaches lockout before that cue's ideal tick — so a harness that
    // blindly scripted every armed cue was throwing taps INTO the lockout hold,
    // which is the beat under test. Measured at load 0.8: lockout on tick 90
    // against a scripted release/press at 102/103, giving a 2-tick slip nobody
    // asked for and a 'good-lift' where the test meant to produce a slip.
    //
    // Not a sim bug — the cue really was armed and the tap really was on time.
    // It is a harness that did not model a player who can see the bar is
    // already locked out.
    const lockout = deadliftLockoutTick(config, script);
    if (lockout !== null && cue.idealTick >= lockout) break;
    script = [
      ...script,
      { tick: cue.idealTick - 1, kind: 'release' as const },
      { tick: cue.idealTick, kind: 'press' as const },
    ];
  }
  return script;
}

/** The tick the sim itself locked out on, or null if the rep never got there. */
function deadliftLockoutTick(config: LiftConfig, script: readonly ScriptedInput[]): number | null {
  for (const state of runLift(config, [...script]).history) {
    if (state.events.some((e) => e.kind === 'lockout')) return state.tick;
  }
  return null;
}

/**
 * A whole deadlift, driven up and then either held or let go of.
 *
 * `letGoAfterTicks` is ticks after the lockout tick at which the player
 * releases and never re-presses. `null` never lets go — the finger stays down
 * from the last drive tap through the down command, which is the correct play.
 *
 * THE TWO ARMS SHARE AN ASCENT EXACTLY. The release is scripted strictly after
 * lockout, so both arms replay a byte-identical rep up to that tick and every
 * difference in the outcome is the hold. Without that the sweep below would be
 * measuring "two different reps disagreed", which is not a claim about the
 * lockout beat at all.
 */
function deadliftRep(load: number, seed: number, letGoAfterTicks: number | null): LiftState {
  const config: LiftConfig = { kind: DEADLIFT, loadRatio: load, seed };
  const ascent = deadliftAscent(config);
  if (letGoAfterTicks === null) return runLift(config, ascent).final;
  const lockout = deadliftLockoutTick(config, ascent);
  if (lockout === null) return runLift(config, ascent).final;
  return runLift(config, [
    ...ascent,
    { tick: lockout + letGoAfterTicks, kind: 'release' },
  ]).final;
}

/**
 * Parameters of the deadlift sweep, named rather than inline.
 *
 * Same reason `PRESS_SWEEP` and `streakSweep.ts` exist: a measurement whose
 * inputs are not written down is an anecdote.
 */
const DEADLIFT_SWEEP = {
  SEEDS: 20,
  LOADS: [0.7, 0.8, 0.85, 0.9, 0.95, 1.0] as const,
  /** The bad arm lets go one tick after lockout and never comes back. */
  LET_GO_AFTER_TICKS: 1,
  /** The good arm never lets go at all. */
  HELD: null,
  /** How many cues the ascent harness will chase before giving up. */
  MAX_CUES_PROBED: 8,
  /** Measured at the shipped tuning. */
  CASES: 120,
  /** Cases where the two arms ended on different outcomes. */
  FLIPS: 114,
  /** Cases where holding made the lift and letting go lost it outright. */
  MAKE_TO_MISS: 82,
  /** Non-vacuity: cases where the rep reached LOCKOUT at all. */
  REACHED_LOCKOUT: 120,
  /** The habitual-tapper arm: loads and seeds, and its measured counts. */
  TAPPER_LOADS: [0.85, 0.9, 0.95, 1.0] as const,
  TAPPER_SEEDS: 10,
  TAPPER_CASES: 40,
  TAPPER_GOOD_LIFTS: 0,
  CLAMPER_GOOD_LIFTS: 10,
} as const;

/** How long the habitual tapper keeps tapping into the lockout, in ticks. */
const TAPPER_TICKS = 120;
/** Ticks between the tapper's taps. */
const TAPPER_PERIOD_TICKS = 7;
/** Ticks the tapper's finger is off the glass per tap. */
const TAPPER_FINGER_UP_TICKS = 2;
/**
 * Step and expected sample count for the floor-break press sweep.
 *
 * The sweep's RANGE is not a constant — it is the whole window a player can
 * press in, derived from `BRACE_TIMEOUT_TICKS` and the load's own brace, so it
 * cannot drift out of date when either moves. Only the step size and the
 * resulting count are pinned here, and the count is what makes an emptied or
 * shortened sweep report itself instead of passing.
 */
const FLOOR_BREAK_PRESS_SWEEP_STEP = 5;
/**
 * Ticks the floor-break sweep gives each rep to resolve. Well above the worst
 * case: the whole brace window, plus an ascent, plus the longest hold, plus the
 * settle. `runLift`'s own default is a rep's budget, not a late-press rep's.
 */
const FLOOR_BREAK_PRESS_SWEEP_MAX_TICKS = 1400;
const FLOOR_BREAK_PRESS_SWEEP_SAMPLES = 114;
/** Ticks past the grace period at which the slip test re-grips. */
const REGRIP_AFTER_TICKS = 8;
/**
 * Measured: caught slips that graded a grind, across the slip sweep — and the
 * whole sweep, so 'dropped' being 0 beside it is a statement about the same
 * population rather than about an empty one.
 */
const CAUGHT_SLIP_GRINDS = 48;

describe('the deadlift has no eccentric', () => {
  // -------------------------------------------------------------------------
  // THE STRUCTURAL HALF. These are what make deadlift a third lift rather than
  // a squat with different numbers — if every test in this block passed on a
  // retuned squat, the piece would have failed.
  // -------------------------------------------------------------------------

  it('never enters DESCENT or HOLE, at any load or seed', () => {
    let reps = 0;
    const phases = new Set<string>();
    for (const load of DEADLIFT_SWEEP.LOADS) {
      for (let seed = 1; seed <= 6; seed += 1) {
        const config: LiftConfig = { kind: DEADLIFT, loadRatio: load, seed };
        for (const state of runLift(config, deadliftAscent(config)).history) {
          phases.add(state.phase);
        }
        reps += 1;
      }
    }
    // Counts, not bounds — an empty sweep would otherwise pass this trivially.
    expect(reps).toBe(DEADLIFT_SWEEP.LOADS.length * 6);
    expect(phases.has('DESCENT'), 'a deadlift descended').toBe(false);
    expect(phases.has('HOLE'), 'a deadlift reached the hole').toBe(false);
    // ...and the phases it DOES visit, so this cannot pass on a rep that never
    // started. All four, every time.
    expect([...phases].sort()).toEqual(['ASCENT', 'BRACE', 'LOCKOUT', 'RESOLVED']);
  });

  it('starts with the bar on the floor, not racked overhead', () => {
    const fresh = createLift({ kind: DEADLIFT, loadRatio: 0.9, seed: 1 });
    expect(fresh.height).toBe(0);
    expect(fresh.depth).toBe(1);
    // The other two start standing, which is the contrast that makes this a
    // fact about deadlift rather than about `createLift`.
    expect(createLift({ kind: 'squat', loadRatio: 0.9, seed: 1 }).height).toBe(1);
    expect(createLift({ kind: 'bench', loadRatio: 0.9, seed: 1 }).height).toBe(1);
  });

  it('refuses to be stepped in a phase it cannot reach, rather than absorbing it', () => {
    // `stepLift`'s guard, driven. A silent fall-through here would leave the
    // rep ticking forever in a phase with no branch — a hang, not a bug report.
    const impossible: LiftState = {
      ...createLift({ kind: DEADLIFT, loadRatio: 0.9, seed: 1 }),
      phase: 'DESCENT',
    };
    expect(() => stepLift(impossible)).toThrow(/no eccentric/);
    expect(() => stepLift({ ...impossible, phase: 'HOLE' })).toThrow(/no eccentric/);
    // ...and the guard does not fire on the lifts that legitimately go there,
    // or it would break squat and bench instead.
    expect(() =>
      stepLift({ ...createLift({ kind: 'squat', loadRatio: 0.9, seed: 1 }), phase: 'DESCENT' }),
    ).not.toThrow();
  });

  it('refuses to answer for an eccentric quantity it does not have', () => {
    // `eccentricKindOf`. A fallback to squat here is what `simKindFor` used to
    // do for the whole lift, and its failure mode was being invisible.
    expect(() => eccentricKindOf(DEADLIFT, 'the depth window')).toThrow(/no eccentric/);
    expect(eccentricKindOf('squat', 'x')).toBe('squat');
    expect(eccentricKindOf('bench', 'x')).toBe('bench');
    expect(() => cueWindowMs('depth', { kind: DEADLIFT, loadRatio: 0.9, seed: 1 })).toThrow();
  });

  it('records no depth timing, because there is no depth to time', () => {
    const rep = deadliftRep(0.9, 3, DEADLIFT_SWEEP.HELD);
    expect(rep.timings.some((t) => t.cue === 'depth')).toBe(false);
    expect(rep.timings.some((t) => t.cue === 'press')).toBe(false);
    // The drive cue IS shared across all three lifts, so it must be there —
    // otherwise this test would also pass on a rep that recorded nothing at all.
    expect(rep.timings.some((t) => t.cue === 'drive')).toBe(true);
    // And a deadlift is never failed for depth: `depthAchieved` starts true, so
    // the LOCKOUT branch cannot reject it with a high-squat reason.
    expect(rep.resolution?.depthAchieved).toBe(true);
    expect(rep.resolution?.missReason).not.toBe('no-depth');
  });

  it('is given its speed off the floor by the load alone, not by an input', () => {
    // The absence that defines the lift. Squat's ascent velocity is bought by
    // the depth release and bench's by the reaction; a deadlift's is bought by
    // nothing, because there was no beat before it to have played well.
    //
    // ---------------------------------------------------------------------
    // WHY THIS SWEEPS RATHER THAN COMPARING TWO PRESS TICKS, and one wrong
    // reason it does not, recorded because the wrong one was believed first.
    //
    // The first version ran a rep pressed as early as the brace allows against
    // one pressed 40 ticks later and asserted the velocities matched. A mutant
    // scaling the floor-break velocity by `state.phaseTick > 20` left all 114
    // tests green, which LOOKED like a hole in the test and was not one: at
    // this load `braceTicks` is already ~34, so every reachable press is above
    // 20 and that mutant multiplies a CONSTANT by two over the whole domain. A
    // uniformly doubled constant is a retune, not an input dependence, and this
    // test is right not to call it one. The mutant was invalid, not survived.
    //
    // The real argument for the sweep is weaker and still sufficient: two
    // samples only discriminate if they happen to straddle wherever a defect
    // puts its threshold. Moving that same mutant to `> 60` — inside the
    // reachable range — is caught by the sweep, and would have been caught by
    // the two-sample version too, by luck of where 40 landed. The sweep removes
    // the luck.
    //
    // WHAT IT COVERS, DECLARED RATHER THAN IMPLIED: press delays from the
    // earliest legal press to `BRACE_TIMEOUT_TICKS`, which is the whole window
    // a player can press in — past it the brace starts the pull by itself. A
    // dependence keyed on something other than the press tick is not covered by
    // this test at all.
    // ---------------------------------------------------------------------
    const load = 0.9;
    const velocities = new Set<number>();
    const outcomes = new Set<string>();
    let samples = 0;
    for (
      let delay = 0;
      delay <= LIFT_TUNING.BRACE_TIMEOUT_TICKS - braceTicks(load, DEADLIFT);
      delay += FLOOR_BREAK_PRESS_SWEEP_STEP
    ) {
      const config: LiftConfig = { kind: DEADLIFT, loadRatio: load, seed: 1 };
      // AN EXPLICIT TICK BUDGET, because `runLift`'s default is not enough
      // here and the shortfall is silent: a rep that runs out of ticks comes
      // back with `resolution` null, which reads as "the outcome differed"
      // rather than as "the harness stopped early". A press near
      // `BRACE_TIMEOUT_TICKS` starts its ascent ~600 ticks in and then needs
      // the ascent, the hold and the settle on top of that.
      const replay = runLift(
        config,
        [{ tick: pullTickFor(load) + delay, kind: 'press' }],
        FLOOR_BREAK_PRESS_SWEEP_MAX_TICKS,
      );
      const first = replay.history.find((s) => s.phase === 'ASCENT');
      expect(first, `delay ${delay} never reached the ascent`).toBeDefined();
      if (first !== undefined) velocities.add(first.velocity);
      outcomes.add(`${replay.final.resolution?.outcome}`);
      samples += 1;
    }
    // Counts, not bounds. A sweep that produced one sample would satisfy
    // `size === 1` trivially.
    expect(samples, 'press ticks swept').toBe(FLOOR_BREAK_PRESS_SWEEP_SAMPLES);
    expect(
      [...velocities],
      'the bar left the floor at more than one speed for the same weight',
    ).toHaveLength(1);
    // AND THE OUTCOME, not only the velocity — the lesson the bench beat paid
    // for. A starting velocity that differed and washed out would be caught by
    // the line above and would not matter; one that differed and DECIDED the
    // rep is what this says cannot happen.
    expect([...outcomes], 'when the player pressed changed the rep').toHaveLength(1);

    // Heavier breaks the floor slower, which is the only thing that moves it.
    // Without this the assertions above are satisfied by a constant.
    const lighter = runLift({ kind: DEADLIFT, loadRatio: load, seed: 1 }, [
      { tick: pullTickFor(load), kind: 'press' },
    ]).history.find((s) => s.phase === 'ASCENT');
    const heavy = runLift({ kind: DEADLIFT, loadRatio: 1.0, seed: 1 }, [
      { tick: pullTickFor(1.0), kind: 'press' },
    ]).history.find((s) => s.phase === 'ASCENT');
    expect(heavy?.velocity ?? 1).toBeLessThan(lighter?.velocity ?? 0);
  });

  it('draws no countdown to the down command — a telegraphed hold is a timed one', () => {
    // THE MIRROR OF BENCH'S "no countdown before the command" TEST, and the
    // reason it matters is the same one wearing the opposite sign. `cueProgress`
    // is what the ring is sized from. A number here would tell the player
    // exactly how much longer they had to hold, which turns "keep holding" into
    // "hold for 1.4 seconds" — an ANTICIPATION check, which is squat's faculty,
    // not deadlift's.
    let lockoutTicksSeen = 0;
    for (const load of DEADLIFT_SWEEP.LOADS) {
      const config: LiftConfig = { kind: DEADLIFT, loadRatio: load, seed: 4 };
      for (const state of runLift(config, deadliftAscent(config)).history) {
        if (state.phase !== 'LOCKOUT') continue;
        lockoutTicksSeen += 1;
        expect(cueProgress(state), `load ${load} tick ${state.tick}`).toBeNull();
        expect(state.activeCue, `load ${load} tick ${state.tick}`).toBeNull();
      }
    }
    // Non-vacuity: if no rep ever reached LOCKOUT this loop would assert
    // nothing and pass, which is the empty-domain trap.
    expect(lockoutTicksSeen, 'no deadlift lockout ticks to check').toBeGreaterThan(0);
  });

  it('says something true on the screen through the whole hold, and flips at the call', () => {
    const config: LiftConfig = { kind: DEADLIFT, loadRatio: 0.9, seed: 4 };
    const history = runLift(config, deadliftAscent(config)).history;
    const lockout = history.filter((s) => s.phase === 'LOCKOUT');
    expect(lockout.length, 'no lockout ticks').toBeGreaterThan(0);
    // SEARCHED AMONG THE LOCKOUT-PHASE STATES ON PURPOSE, not the whole
    // history. `promptFor` can only return the DOWN line from a state that is
    // BOTH in LOCKOUT and past the command tick, so if the command fires on the
    // same tick the rep resolves, that state's phase is 'RESOLVED' and the line
    // is unreachable copy. That is exactly what the first version of this beat
    // did, and this is the assertion that caught it — see
    // `DOWN_COMMAND_SETTLE_TICKS`. Do not relax it to search `history`.
    const command = lockout.find((s) => s.events.some((e) => e.kind === 'down-command'));
    expect(command, 'the down command never fired inside LOCKOUT').toBeDefined();
    if (command === undefined) return;
    const holding = lockout.filter((s) => s.tick < command.tick);
    expect(holding.length, 'no holding ticks').toBeGreaterThan(0);
    for (const s of holding) {
      expect(promptFor(s), `tick ${s.tick}`).toBe(LIFT_COPY.PROMPT.LOCKOUT.deadlift);
      expect(lockoutHoldIsLive(s), `tick ${s.tick}`).toBe(true);
    }
    expect(promptFor(command)).toBe(LIFT_COPY.PROMPT.LOCKOUT_DOWN_COMMANDED);
    expect(lockoutHoldIsLive(command)).toBe(false);
    // The other two lifts keep their own line and never see the deadlift one.
    const squat = play(0.85, { driveOffsetTicks: 0 });
    expect(LIFT_COPY.PROMPT.LOCKOUT.squat).not.toBe(LIFT_COPY.PROMPT.LOCKOUT.deadlift);
    expect(lockoutHoldIsLive(squat)).toBe(false);
  });

  it('has an unguessable hold that is still a pure function of the seed', () => {
    // Both halves at once, because either alone is satisfiable by cheating:
    // a constant delay is perfectly deterministic, and a `Math.random()` delay
    // is perfectly unguessable.
    const delays = new Set<number>();
    for (let seed = 1; seed <= 40; seed += 1) delays.add(downCommandDelayTicks(seed));
    expect(delays.size, 'the hold is effectively a fixed beat').toBeGreaterThan(8);
    for (const d of delays) {
      expect(d).toBeGreaterThanOrEqual(LIFT_TUNING.DOWN_COMMAND_DELAY_TICKS.MIN);
      expect(d).toBeLessThanOrEqual(LIFT_TUNING.DOWN_COMMAND_DELAY_TICKS.MAX);
    }
    // Same seed, same hold — replayable, which `purity` depends on.
    expect(downCommandDelayTicks(17)).toBe(downCommandDelayTicks(17));
  });
});

describe('the lockout hold decides the deadlift', () => {
  // -------------------------------------------------------------------------
  // THE OUTCOME HALF, AND THE ONLY PART OF THIS FILE THAT IS EVIDENCE THE BEAT
  // MATTERS.
  //
  // The bench press command shipped broken through exactly the gap these tests
  // are shaped to close. Its first version set a velocity from the player's
  // reaction; eight mutants were run and all eight passed, because every one of
  // them asked whether a MECHANISM ran — is the delay seeded, is the press
  // consumed, is the velocity written — and not one asked whether the REP
  // CHANGED. The velocity was a transient that washed out in about ten ticks
  // and the outcome was identical whatever the player did.
  //
  // So none of the assertions below reads an intermediate value. Every one of
  // them compares `resolution.outcome` between a good hold and a bad one, and
  // pins the count as a number rather than a bound.
  // -------------------------------------------------------------------------

  it('flips outcomes between holding the lockout and letting go, across the sweep', () => {
    let flips = 0;
    let makeToMiss = 0;
    let cases = 0;
    let reachedLockout = 0;
    for (let seed = 1; seed <= DEADLIFT_SWEEP.SEEDS; seed += 1) {
      for (const load of DEADLIFT_SWEEP.LOADS) {
        const held = deadliftRep(load, seed, DEADLIFT_SWEEP.HELD);
        const letGo = deadliftRep(load, seed, DEADLIFT_SWEEP.LET_GO_AFTER_TICKS);
        cases += 1;
        const config: LiftConfig = { kind: DEADLIFT, loadRatio: load, seed };
        if (deadliftLockoutTick(config, deadliftAscent(config)) !== null) reachedLockout += 1;
        const a = held.resolution?.outcome;
        const b = letGo.resolution?.outcome;
        if (a !== b) flips += 1;
        if (a !== undefined && a !== 'miss' && b === 'miss') makeToMiss += 1;
      }
    }
    // Counts, not bounds — an empty or collapsed domain reports itself.
    expect(cases).toBe(DEADLIFT_SWEEP.CASES);
    // THE NON-VACUITY GUARD THAT MATTERS MOST HERE. If the ascent were too hard
    // the reps would miss before ever locking out, the two arms would agree on
    // 'miss' everywhere, and a flip count of zero would look like "the hold does
    // nothing" rather than "the hold never happened". That is not hypothetical:
    // the first tuning pass of this piece measured 40 of 120 cases never
    // reaching lockout, for exactly that reason.
    expect(
      reachedLockout,
      `only ${reachedLockout} of ${cases} reps reached LOCKOUT`,
    ).toBe(DEADLIFT_SWEEP.REACHED_LOCKOUT);
    expect(
      flips,
      `the lockout hold changed the outcome in ${flips} of ${cases} cases`,
    ).toBe(DEADLIFT_SWEEP.FLIPS);
    expect(
      makeToMiss,
      `holding made the lift and letting go lost it in ${makeToMiss} of ${cases} cases`,
    ).toBe(DEADLIFT_SWEEP.MAKE_TO_MISS);
  });

  it('turns a made pull into a dropped one at a heavy single', () => {
    // One named case, so a failure reads as a case rather than a count. Same
    // caveat the press block records about its own illustration: this is not
    // the discriminator, the sweep above is.
    const held = deadliftRep(0.9, 1, DEADLIFT_SWEEP.HELD);
    const letGo = deadliftRep(0.9, 1, DEADLIFT_SWEEP.LET_GO_AFTER_TICKS);
    expect(held.resolution?.outcome).not.toBe('miss');
    expect(letGo.resolution?.outcome).toBe('miss');
    // ...and it is called what it was, not what it was not. 'stalled' would be
    // a true-sounding sentence about a bar that was locked out a moment ago.
    expect(letGo.resolution?.missReason).toBe('dropped');
    expect(letGo.resolution?.detail).toBe(LIFT_COPY.MISS_REASON.dropped);
  });

  it('costs the good lift to the player who keeps tapping instead of clamping', () => {
    // THE TRANSITION THE BEAT IS ACTUALLY TESTING, and the answer to "why can
    // the player not simply hold the button down the whole rep". The ascent
    // asks for taps, a tap is a release and a re-press, so a heavy pull arrives
    // at lockout with the finger mid-rhythm. What is being asked for is to STOP
    // tapping. A player who does not stop keeps slipping a couple of ticks at a
    // time and never gets a clean lift.
    let tapperGood = 0;
    let clamperGood = 0;
    let cases = 0;
    for (const load of DEADLIFT_SWEEP.TAPPER_LOADS) {
      for (let seed = 1; seed <= DEADLIFT_SWEEP.TAPPER_SEEDS; seed += 1) {
        const config: LiftConfig = { kind: DEADLIFT, loadRatio: load, seed };
        const ascent = deadliftAscent(config);
        const lockout = deadliftLockoutTick(config, ascent);
        expect(lockout, `load ${load} seed ${seed} never locked out`).not.toBeNull();
        if (lockout === null) continue;
        const taps: ScriptedInput[] = [];
        for (let t = lockout + 2; t < lockout + TAPPER_TICKS; t += TAPPER_PERIOD_TICKS) {
          taps.push({ tick: t, kind: 'release' });
          taps.push({ tick: t + TAPPER_FINGER_UP_TICKS, kind: 'press' });
        }
        if (runLift(config, [...ascent, ...taps]).final.resolution?.outcome === 'good-lift') {
          tapperGood += 1;
        }
        if (runLift(config, ascent).final.resolution?.outcome === 'good-lift') clamperGood += 1;
        cases += 1;
      }
    }
    expect(cases).toBe(DEADLIFT_SWEEP.TAPPER_CASES);
    expect(tapperGood, `the tapper got ${tapperGood} clean lifts`).toBe(
      DEADLIFT_SWEEP.TAPPER_GOOD_LIFTS,
    );
    // The comparison is the claim. Without this the test above passes on a
    // build where NOBODY can get a clean lift.
    expect(clamperGood, `the clamper got ${clamperGood} clean lifts`).toBe(
      DEADLIFT_SWEEP.CLAMPER_GOOD_LIFTS,
    );
    expect(clamperGood).toBeGreaterThan(tapperGood);
  });

  it('lets a slip be caught, and charges it a grind rather than the rep', () => {
    // The middle outcome. "A MISSED TAP COSTS VELOCITY. IT NEVER ENDS THE REP
    // ON ITS OWN" is the rule the drive cue already follows, and the lockout
    // follows it too: a slip that is caught costs the clean lift, not the lift.
    let caught = 0;
    let dropped = 0;
    for (const load of DEADLIFT_SWEEP.LOADS) {
      for (let seed = 1; seed <= 8; seed += 1) {
        const config: LiftConfig = { kind: DEADLIFT, loadRatio: load, seed };
        const ascent = deadliftAscent(config);
        const lockout = deadliftLockoutTick(config, ascent);
        if (lockout === null) continue;
        const rep = runLift(config, [
          ...ascent,
          { tick: lockout + 1, kind: 'release' },
          {
            tick: lockout + 1 + LIFT_TUNING.LOCKOUT_GRIP_GRACE_TICKS + REGRIP_AFTER_TICKS,
            kind: 'press',
          },
        ]).final;
        if (rep.resolution?.outcome === 'grind') caught += 1;
        if (rep.resolution?.outcome === 'miss') dropped += 1;
      }
    }
    expect(caught, 'no caught slip produced a grind').toBe(CAUGHT_SLIP_GRINDS);
    expect(dropped, 'a caught slip still lost the bar').toBe(0);
  });

  it('leaves a warm-up alone — a light pull is not a hold test (GDD §12.3)', () => {
    // THE DAILY-ENGAGEMENT RULE, PLAYED RATHER THAN DERIVED. `liftTuning.test.ts`
    // asserts the arithmetic that makes this impossible; this asserts that the
    // arithmetic is actually what the sim does. Both, because the arithmetic
    // half was written wrong once already — it read the LIGHT endpoint instead
    // of `byLoad` at the preset, and the true margin was half a tick.
    //
    // A player who lets go of the screen on a warm-up must not lose the rep. A
    // grind is fine; a grind is a made lift.
    let reps = 0;
    for (const load of [LOAD_PRESETS.WARMUP, LOAD_PRESETS.LIGHT]) {
      for (let seed = 1; seed <= 12; seed += 1) {
        for (const letGo of [DEADLIFT_SWEEP.HELD, DEADLIFT_SWEEP.LET_GO_AFTER_TICKS]) {
          const rep = deadliftRep(load, seed, letGo);
          expect(
            rep.resolution?.outcome,
            `load ${load} seed ${seed} letGo ${String(letGo)}`,
          ).not.toBe('miss');
          reps += 1;
        }
      }
    }
    expect(reps, 'no warm-up reps were played').toBe(48);
  });

  it('still needs the ascent driven at a limit pull, so the hold is not the only beat', () => {
    // The deadlift's ascent is shared machinery and must keep working. If an
    // undriven limit pull made it, the drive cue would be decoration on this
    // lift — and the lockout sweep above would be measuring a rep nobody had to
    // play. Same invariant squat has, applied to the sibling.
    for (let seed = 1; seed <= 8; seed += 1) {
      const load = LOAD_PRESETS.MAXIMAL;
      const bare = runLift({ kind: DEADLIFT, loadRatio: load, seed }, [
        { tick: pullTickFor(load), kind: 'press' },
      ]).final;
      expect(bare.resolution?.outcome, `undriven seed ${seed}`).toBe('miss');
      expect(deadliftRep(load, seed, DEADLIFT_SWEEP.HELD).resolution?.outcome, `driven seed ${seed}`)
        .not.toBe('miss');
    }
  });

  it('hands no fatigue number back on a deadlift either', () => {
    // The sibling guard, applied mechanically rather than assumed to transfer.
    // `lockoutSlipTicks` is a per-rep counter in the same category as
    // `stallTicks`; it is exactly the kind of scalar that becomes a §3.4 meter
    // if a component is allowed to bind to it, so it is named here the way
    // `stallCapacityLoss` is named in squat's version of this test.
    const state = deadliftRep(LOAD_PRESETS.MAXIMAL, 3, DEADLIFT_SWEEP.LET_GO_AFTER_TICKS);
    const { config: _config, ...produced } = state;
    const serialised = JSON.stringify({ produced, resolution: state.resolution }).toLowerCase();
    for (const banned of ['fatigue', 'burden', 'residual', 'readiness', 'primed', 'meter']) {
      expect(serialised, `leaked ${banned}`).not.toContain(banned);
    }
    expect(Object.keys(produced)).toContain('lockoutSlipTicks');
    expect(Object.keys(state.resolution ?? {})).not.toContain('lockoutSlipTicks');
  });
});


describe('gradeReaction', () => {
  const window = LIFT_TUNING.PRESS_REACTION_WINDOW_MS;

  it('is 1 at the stimulus and 0 at the end of the window', () => {
    expect(gradeReaction(0, window).quality).toBe(1);
    expect(gradeReaction(window, window).quality).toBe(0);
    expect(gradeReaction(window + 1, window).grade).toBe('missed');
  });

  it('never rises as the reaction gets slower', () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let ms = 0; ms <= window; ms += 10) {
      const q = gradeReaction(ms, window).quality;
      expect(q).toBeLessThanOrEqual(previous);
      previous = q;
    }
  });

  it('IS ASYMMETRIC — which is the whole difference from gradeTiming', () => {
    // The claim the bench beat rests on. `gradeTiming` scores -100/+100 the
    // same; a reaction cannot, because you cannot react before the stimulus.
    expect(gradeTiming(-100, window).quality).toBe(gradeTiming(100, window).quality);
    expect(gradeReaction(-100, window).quality).not.toBe(gradeReaction(100, window).quality);
    expect(gradeReaction(-100, window).grade).toBe('missed');
  });

  it('cannot ever return "early", and that is checked rather than asserted', () => {
    // A comment claiming a grade is unreachable is exactly the sentence
    // CLAUDE.md has caught being false eight times. Swept instead.
    const seen = new Set<string>();
    for (let ms = -window; ms <= window * 2; ms += 1) seen.add(gradeReaction(ms, window).grade);
    expect(seen.has('early')).toBe(false);
    // ...and the sweep is not vacuous: it reaches the other four.
    for (const grade of ['perfect', 'good', 'late', 'missed']) {
      expect(seen.has(grade), `grade ${grade} unreachable in the sweep`).toBe(true);
    }
  });

  it('refuses nonsense rather than trusting its caller', () => {
    expect(gradeReaction(Number.NaN, window).grade).toBe('missed');
    expect(gradeReaction(0, 0).grade).toBe('missed');
    expect(gradeReaction(0, -1).grade).toBe('missed');
  });
});

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
    const config: LiftConfig = { kind: DEFAULT_KIND, loadRatio: limit, seed: 20260801 };
    const base: ScriptedInput[] = [
      { tick: pressTickFor(limit), kind: 'press' },
      { tick: releaseTickFor(limit, LIFT_TUNING.DEPTH_IDEAL[DEFAULT_KIND]), kind: 'release' },
    ];
    const cue = armedCue(config, base, 'drive');
    expect(cue).not.toBeNull();
    if (cue === null) return;

    const driven = ascentOf(config, [...base, { tick: cue.idealTick, kind: 'press' }]);
    const crossing = driven.find((s) => s.height >= STICK_HEIGHT_FRAC[DEFAULT_KIND]);
    expect(crossing, 'the driven bar never reached the sticking point').toBeDefined();
    expect(
      crossing?.netForce ?? 0,
      'the drive boost had already decayed by the time the bar reached the stick',
    ).toBeGreaterThan(0);

    // And the same rep, UNDRIVEN, must not get there at all — otherwise the
    // assertion above is true of a bar that never needed driving, and the whole
    // section is measuring nothing.
    const undriven = ascentOf(config, base);
    expect(Math.max(...undriven.map((s) => s.height))).toBeLessThan(STICK_HEIGHT_FRAC[DEFAULT_KIND]);
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
      ascentDemand(STICK_HEIGHT_FRAC[DEFAULT_KIND], defaultLoad, DEFAULT_KIND),
      `load ${defaultLoad} never exceeds the lifter's capacity at the stick`,
    ).toBeGreaterThan(LIFT_TUNING.LIFTER_CAPACITY);
  });

  it('shows the grind even to a player who never presses the drive', () => {
    expect(defaultLoad).toBeDefined();
    if (defaultLoad === undefined) return;
    const undrivenAscent = (load: number): LiftState[] =>
      ascentOf({ kind: DEFAULT_KIND, loadRatio: load, seed: 20260801 }, [
        { tick: pressTickFor(load), kind: 'press' },
        { tick: releaseTickFor(load, LIFT_TUNING.DEPTH_IDEAL[DEFAULT_KIND]), kind: 'release' },
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
      depth: LIFT_TUNING.DEPTH_LEGAL[DEFAULT_KIND] + descentRate(LOAD_PRESETS.LIGHT, DEFAULT_KIND) * 2,
      driveOffsetTicks: 0,
    });
    expect(state.resolution?.depthAchieved).toBe(true);
    expect(state.resolution?.outcome).not.toBe('miss');
  });

  it('buries a player who never lets go', () => {
    const load = LOAD_PRESETS.MAXIMAL;
    const state = runLift({ kind: DEFAULT_KIND, loadRatio: load, seed: 11 }, [
      { tick: pressTickFor(load), kind: 'press' },
    ]).final;
    expect(state.resolution?.missReason).toBe('buried');
    expect(state.depth).toBeGreaterThanOrEqual(LIFT_TUNING.DEPTH_COLLAPSE[DEFAULT_KIND]);
  });

  it('never opens the depth cue above legal depth, at any load', () => {
    // Measured from played reps rather than derived from the constants: the
    // window is specified in milliseconds and the descent in depth-per-tick, so
    // whether the cue's front edge is legal depends on a rate that changes with
    // load. It was not, at the light end, before `depthWindowHalfTicks` existed.
    for (let load = LOAD_RANGE.MIN; load <= LOAD_RANGE.MAX; load += 0.02) {
      const rep = runLift({ kind: DEFAULT_KIND, loadRatio: load, seed: 2 }, [
        { tick: pressTickFor(load), kind: 'press' },
      ]);
      const withCue = rep.history.find((s) => s.activeCue?.cue === 'depth');
      const cue = withCue?.activeCue;
      expect(cue, `load ${load}`).toBeTruthy();
      if (cue == null) continue;
      const atOpen = rep.history.find((s) => s.tick === cue.openTick);
      expect(atOpen, `load ${load}`).toBeTruthy();
      expect(atOpen?.depth ?? 0, `load ${load} opens at depth`).toBeGreaterThanOrEqual(
        LIFT_TUNING.DEPTH_LEGAL[DEFAULT_KIND],
      );
    }
  });

  it('reports a depth window narrower than asked for only when it has to', () => {
    const wide = LIFT_TUNING.DEPTH_WINDOW_MS[DEFAULT_KIND];
    // Heavy: the descent is slow, so the millisecond width is what binds.
    expect(depthWindowHalfTicks(LOAD_PRESETS.MAXIMAL, wide, DEFAULT_KIND)).toBe(
      Math.round(wide / TICK_MS / 2),
    );
    // Light: the descent is fast, so the legal-depth clamp binds instead.
    expect(depthWindowHalfTicks(LOAD_PRESETS.WARMUP, wide, DEFAULT_KIND)).toBeLessThan(
      Math.round(wide / TICK_MS / 2),
    );
    // Never zero, whatever it is handed.
    expect(depthWindowHalfTicks(LOAD_PRESETS.WARMUP, 1, DEFAULT_KIND)).toBeGreaterThanOrEqual(1);
  });

  it('makes a deeper reversal a harder ascent', () => {
    const shallow = play(LOAD_PRESETS.HEAVY, {
      depth: LIFT_TUNING.DEPTH_IDEAL[DEFAULT_KIND],
      driveOffsetTicks: 0,
    });
    const deep = play(LOAD_PRESETS.HEAVY, {
      depth: LIFT_TUNING.DEPTH_IDEAL[DEFAULT_KIND] + 0.2,
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
    const rep = runLift({ kind: DEFAULT_KIND, loadRatio: load, seed: 77 }, [
      { tick: pressTickFor(load), kind: 'press' },
      { tick: releaseTickFor(load, LIFT_TUNING.DEPTH_IDEAL[DEFAULT_KIND]), kind: 'release' },
    ]);
    const stalled = rep.history.filter(
      (s) => s.phase === 'ASCENT' && s.velocity < LIFT_TUNING.GRIND_STALL_VELOCITY,
    );
    expect(stalled.length).toBeGreaterThan(LIFT_TUNING.GRIND_STALL_TICKS);
    const meanHeight =
      stalled.reduce((a, s) => a + s.height, 0) / Math.max(1, stalled.length);
    // Inside the notch the sprite system draws, not merely somewhere on the way up.
    expect(Math.abs(meanHeight - STICK_HEIGHT_FRAC[DEFAULT_KIND])).toBeLessThan(STICK.WIDTH * 2);
  });

  it('drifts the bar forward most where it stalls, and more under load', () => {
    const peakForward = (load: number): { px: number; atHeight: number } => {
      const rep = runLift({ kind: DEFAULT_KIND, loadRatio: load, seed: 5 }, [
        { tick: pressTickFor(load), kind: 'press' },
        { tick: releaseTickFor(load, LIFT_TUNING.DEPTH_IDEAL[DEFAULT_KIND]), kind: 'release' },
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
    expect(Math.abs(maximal.atHeight - STICK_HEIGHT_FRAC[DEFAULT_KIND])).toBeLessThan(STICK.WIDTH * 2);
  });

  it('shakes and tilts the bar only when the lifter is losing', () => {
    const peaks = (load: number): { lateral: number; tilt: number } => {
      const rep = runLift({ kind: DEFAULT_KIND, loadRatio: load, seed: 5 }, [
        { tick: pressTickFor(load), kind: 'press' },
        { tick: releaseTickFor(load, LIFT_TUNING.DEPTH_IDEAL[DEFAULT_KIND]), kind: 'release' },
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
      const rep = runLift({ kind: DEFAULT_KIND, loadRatio: load, seed: 5 }, [
        { tick: pressTickFor(load), kind: 'press' },
        { tick: releaseTickFor(load, LIFT_TUNING.DEPTH_IDEAL[DEFAULT_KIND]), kind: 'release' },
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
    const base: LiftConfig = { kind: DEFAULT_KIND, loadRatio: LOAD_PRESETS.MAXIMAL, seed: 1 };
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
    const start = cueWindowMs('drive', { kind: DEFAULT_KIND, loadRatio: 1, seed: 1, feel });
    const late = cueWindowMs('drive', {
      kind: DEFAULT_KIND,
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
    const primed = lifterCapacity({ kind: DEFAULT_KIND, loadRatio: 1, seed: 1, feel: primedFeel() });
    const tired = lifterCapacity({ kind: DEFAULT_KIND, loadRatio: 1, seed: 1, feel: fatiguedFeel() });
    expect(primed).toBeGreaterThan(tired);
    expect(lifterCapacity({ kind: DEFAULT_KIND, loadRatio: 1, seed: 1 })).toBe(LIFT_TUNING.LIFTER_CAPACITY);
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
            tick: releaseTickFor(LOAD_PRESETS.MAXIMAL, LIFT_TUNING.DEPTH_IDEAL[DEFAULT_KIND]),
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
      for (const state of runLift({ kind: DEFAULT_KIND, loadRatio: load, seed: 3 }, script).history) {
        for (const event of state.events) seen.add(event.kind);
      }
    }
    // A well-driven rep, for the drive-hit and lockout kinds.
    const ideal = driveIdealTick({ kind: DEFAULT_KIND, loadRatio: 0.88, seed: 3 }, LIFT_TUNING.DEPTH_IDEAL[DEFAULT_KIND]);
    if (ideal !== null) {
      const driven = runLift({ kind: DEFAULT_KIND, loadRatio: 0.88, seed: 3 }, [
        { tick: pressTickFor(0.88), kind: 'press' },
        { tick: releaseTickFor(0.88, LIFT_TUNING.DEPTH_IDEAL[DEFAULT_KIND]), kind: 'release' },
        { tick: ideal, kind: 'press' },
      ]);
      for (const state of driven.history) for (const e of state.events) seen.add(e.kind);
    }
    // A drive thrown before the cue armed, for drive-mistimed.
    const mistimed = runLift({ kind: DEFAULT_KIND, loadRatio: 0.88, seed: 3 }, earlyDriveScript(0.88));
    for (const state of mistimed.history) for (const e of state.events) seen.add(e.kind);
    // BENCH, for the three press kinds. Squat cannot reach them — its HOLE
    // asks for nothing — so a squat-only sweep would report them unreachable,
    // which is exactly what this guard caught when the press beat landed.
    for (const [seed, reaction] of [
      [3, 2],
      [3, -6],
    ] as const) {
      const { config, script } = benchToChest(LOAD_PRESETS.MAXIMAL, seed);
      const command = commandTickFor(LOAD_PRESETS.MAXIMAL, seed);
      const full =
        command === null
          ? script
          : [...script, { tick: Math.max(1, command + reaction), kind: 'press' as const }];
      for (const state of runLift(config, full).history) {
        for (const e of state.events) seen.add(e.kind);
      }
    }
    // DEADLIFT, for 'down-command' and 'lockout-slip'. Neither of the other two
    // lifts can reach them, same as the press kinds above. Two arms: one that
    // holds through to the command, one that lets go so the bar sags.
    for (const letGo of [DEADLIFT_SWEEP.HELD, DEADLIFT_SWEEP.LET_GO_AFTER_TICKS]) {
      const config: LiftConfig = { kind: DEADLIFT, loadRatio: 0.9, seed: 1 };
      const ascent = deadliftAscent(config);
      const lockout = deadliftLockoutTick(config, ascent);
      const script =
        letGo === null || lockout === null
          ? ascent
          : [...ascent, { tick: lockout + letGo, kind: 'release' as const }];
      for (const state of runLift(config, script).history) {
        for (const e of state.events) seen.add(e.kind);
      }
    }
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
    const ideal = driveIdealTick({ kind: DEFAULT_KIND, loadRatio: load, seed: 3 }, LIFT_TUNING.DEPTH_IDEAL[DEFAULT_KIND]);
    expect(ideal).not.toBeNull();
    const rep = runLift({ kind: DEFAULT_KIND, loadRatio: load, seed: 3 }, [
      { tick: pressTickFor(load), kind: 'press' },
      { tick: releaseTickFor(load, LIFT_TUNING.DEPTH_IDEAL[DEFAULT_KIND]), kind: 'release' },
      { tick: ideal ?? 0, kind: 'press' },
    ]);
    seen.add('BRACE');
    for (const s of rep.history) seen.add(s.phase);
    for (const phase of LIFT_PHASES) {
      expect(seen.has(phase), `phase ${phase} is unreachable`).toBe(true);
    }
  });

  it('shows a different prompt for every phase', () => {
    const base = createLift({ kind: DEFAULT_KIND, loadRatio: 1, seed: 1 });
    const prompts = LIFT_PHASES.map((phase) => promptFor({ ...base, phase }));
    expect(new Set(prompts).size).toBe(LIFT_PHASES.length);
  });

  it('switches the ascent prompt when the cue opens', () => {
    const base = createLift({ kind: DEFAULT_KIND, loadRatio: 1, seed: 1 });
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
        widthMs: LIFT_TUNING.DRIVE_WINDOW_MS[DEFAULT_KIND].MAXIMAL,
      },
    };
    expect(promptFor(armed)).toBe(LIFT_COPY.PROMPT.ASCENT_BEFORE_CUE);
    expect(promptFor({ ...armed, tick: 115 })).toBe(LIFT_COPY.PROMPT.ASCENT_CUE_OPEN);
    expect(promptFor({ ...armed, tick: 140, activeCue: null, drivesUsed: 1 })).toBe(
      LIFT_COPY.PROMPT.ASCENT_AFTER_CUE,
    );
  });

  it('reports cue progress as 0 at the open and 1 at the ideal moment', () => {
    const base = createLift({ kind: DEFAULT_KIND, loadRatio: 1, seed: 1 });
    expect(cueProgress(base)).toBeNull();
    const cue = {
      cue: 'drive' as const,
      wants: 'press' as const,
      openTick: 100,
      idealTick: 120,
      closeTick: 140,
      widthMs: LIFT_TUNING.DRIVE_WINDOW_MS[DEFAULT_KIND].MAXIMAL,
    };
    expect(cueProgress({ ...base, tick: 100, activeCue: cue })).toBe(0);
    expect(cueProgress({ ...base, tick: 120, activeCue: cue })).toBe(1);
    expect(cueProgress({ ...base, tick: 140, activeCue: cue })).toBe(2);
  });

  it('reports a window whose width matches the ticks it spans', () => {
    const load = LOAD_PRESETS.MAXIMAL;
    const rep = runLift({ kind: DEFAULT_KIND, loadRatio: load, seed: 3 }, [
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
    const state = createLift({ kind: DEFAULT_KIND, loadRatio: LOAD_PRESETS.MAXIMAL, seed: 1 });
    expect(state.phase).toBe('BRACE');
    expect(state.depth).toBe(0);
    expect(state.held).toBe(false);
    expect(state.resolution).toBeNull();
    expect(state.timings).toEqual([]);
    expect(state.stallCapacityLoss).toBe(0);
  });

  it('refuses a nonsense config', () => {
    expect(() => createLift({ kind: DEFAULT_KIND, loadRatio: 0, seed: 1 })).toThrow(RangeError);
    expect(() => createLift({ kind: DEFAULT_KIND, loadRatio: Number.NaN, seed: 1 })).toThrow(RangeError);
    expect(() => createLift({ kind: DEFAULT_KIND, loadRatio: 1, seed: Number.POSITIVE_INFINITY })).toThrow(RangeError);
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
    const rep = runLift({ kind: DEFAULT_KIND, loadRatio: LOAD_PRESETS.LIGHT, seed: 1 }, []);
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
