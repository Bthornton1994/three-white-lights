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
  benchClearsTheClock,
  benchWorkingExcess,
  benchWorkingRungDemand,
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
  grindForce,
  qualityGrade,
  grindProgress,
  grindChargeNext,
  grindIsLive,
  grindStartTick,
  chestApproach,
  depthTimedKindOf,
  touchSpeedQuality,
  gradeTiming,
  hapticFor,
  holeTicks,
  isGrind,
  lifterCapacity,
  lockoutSagPerTick,
  lockoutTicks,
  promptFor,
  pressCommandIsLive,
  runLift,
  stepLift,
  type CueWindow,
  type LiftConfig,
  type LiftEventKind,
  type LiftInput,
  type LiftOutcome,
  type GrindProgress,
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
  byLoad,
  clampLoadRatio,
  type DepthTimedLiftKind,
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
// THE TWO PRODUCERS OF `loadRatio`, IMPORTED SO THE SWEEP'S DOMAIN IS DERIVED
// RATHER THAN LISTED. See `REACHABLE`: a preset is not a domain, and a sweep
// over `LOAD_PRESETS` reported a property this mechanic did not have.
import { prescribeSession } from './session';
import { SESSION_TUNING } from './sessionTuning';
import { ATTEMPT_JUMP_FRACTION, OPENER_FRACTION_OF_1RM } from './meet';
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
const DEFAULT_KIND: DepthTimedLiftKind = 'squat';

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
 * Every tick of a driven squat, for checks that have to read a PHASE rather
 * than an outcome. `play` returns the resolved state and throws the history
 * away, which is right for outcome assertions and useless for phase ones.
 */
function squatHistory(loadRatio: number): readonly LiftState[] {
  const depth = LIFT_TUNING.DEPTH_IDEAL[DEFAULT_KIND];
  const config: LiftConfig = { kind: DEFAULT_KIND, loadRatio, seed: 20260801 };
  const script: ScriptedInput[] = [
    { tick: pressTickFor(loadRatio), kind: 'press' },
    { tick: releaseTickFor(loadRatio, depth), kind: 'release' },
  ];
  const ideal = driveIdealTick(config, depth);
  if (ideal !== null) script.push({ tick: ideal, kind: 'press' });
  return runLift(config, script).history;
}

/**
 * A squat or bench GENUINELY STANDING IN `LOCKOUT` — the phase states, not the
 * resolved one `play` hands back.
 *
 * -------------------------------------------------------------------------
 * WHY THIS EXISTS AT ALL, AND IT IS A VACUITY FIX RATHER THAN A CONVENIENCE.
 * -------------------------------------------------------------------------
 * `lockoutHoldIsLive` refuses on two counts in sequence: the KIND is not a
 * deadlift, and the PHASE is not `LOCKOUT`. A check handed `play(...)`'s return
 * value — which is always `RESOLVED` — trips the phase guard and returns before
 * the kind guard has said anything, so it reads as covering both and covers
 * one. Measured: deleting `if (state.config.kind !== 'deadlift') return false;`
 * left the whole file green.
 *
 * A squat in `LOCKOUT` is exactly the state that separates them, and it is the
 * state the null arm is dangerous in: `downCommandTick` is null for a squat
 * forever, and the null arm returns TRUE, so the kind guard is the only thing
 * standing between an eccentric lockout and deadlift's "don't let go" line.
 */
function eccentricLockoutStates(kind: EccentricLiftKind, loadRatio: number): LiftState[] {
  const config: LiftConfig = { kind, loadRatio, seed: ECCENTRIC_LOCKOUT_SEED };
  if (kind === 'bench') {
    // BENCH NEEDS ITS GRIND TO GET HERE AT ALL SINCE THE RULING. A bench rep
    // that ignores the command launches at `PRESS_VELOCITY.MIN` with no live
    // force behind it, which at a heavy load is a stall and never reaches
    // LOCKOUT — so a script without taps would hand this fixture an empty
    // list, which is the exact failure it was written to repair.
    return runLift(
      config,
      buildBenchScript(loadRatio, ECCENTRIC_LOCKOUT_SEED, {
        gapTicks: GRIND_SWEEP.MASH_GAP_TICKS,
      }),
      1200,
    ).history.filter((s) => s.phase === 'LOCKOUT');
  }
  const depth = LIFT_TUNING.DEPTH_IDEAL[kind];
  const script: ScriptedInput[] = [
    { tick: pressTickFor(loadRatio, kind), kind: 'press' },
    { tick: releaseTickFor(loadRatio, depth, kind), kind: 'release' },
  ];
  const ideal = driveIdealTick(config, depth);
  if (ideal !== null) script.push({ tick: ideal, kind: 'press' });
  return runLift(config, script).history.filter((s) => s.phase === 'LOCKOUT');
}

/** Seed for `eccentricLockoutStates`. Any rep that locks out will do; this one does. */
const ECCENTRIC_LOCKOUT_SEED = 20260801;
/**
 * Measured: LOCKOUT ticks the eccentric fixture produces, squat and bench
 * together, at `LOAD_PRESETS.HEAVY`. Pinned so a fixture that stopped reaching
 * the phase reports itself instead of passing on an empty loop — which is the
 * exact failure this fixture was written to repair.
 */
const ECCENTRIC_LOCKOUT_TICKS = 26;

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

/**
 * ---------------------------------------------------------------------------
 * `bestHoldTicks` WAS HERE AND IS DELETED, AND THE DELETION IS THE STEER
 * ---------------------------------------------------------------------------
 * It searched every hold from 1 to `HOLD_SCAN_MAX`, played the descent at each
 * one, and kept the hold whose `touchQuality` came back highest — because
 * under the beat this replaces the best arrival was bought by letting go at
 * the right moment, and which moment that was moved with the load.
 *
 * The 2026-08-25 replay steer deleted the question it answered. Holding all
 * the way down arrives at quality 1 at every load, by arithmetic
 * (`benchDescentRate`'s floor is at or below `BENCH_TOUCH_SOFT_RATE` at both
 * ends), so the search's answer is "never let go" at every load and every
 * seed. A search whose answer is a constant is the empty-domain shape this
 * file's own vacuity notes warn about, and keeping it would have made every
 * fixture below look like it was consulting the mechanic when it was reading
 * back a fixed number.
 *
 * SO THE DEFAULT INVERTED. `hold: null` used to be the CRASH arm — "never let
 * go, the bar is fed all the way in hot" — and it is now the CONTROLLED arm.
 * A NUMBER is now the slip arm: let go after that many ticks and never come
 * back, which is the one mistake the descent still charges for. Every call
 * site below reads in the opposite direction from the version before this
 * steer, which is worth saying out loud because the argument lists look
 * identical.
 */

/**
 * Press and lower toward the chest, letting go after `holdTicks`. Everything
 * before the pause.
 *
 * `holdTicks` null NEVER LETS GO, which since the 2026-08-25 replay steer is
 * the CONTROLLED arm: the bar comes down at the controlled rate the whole way
 * and arrives at quality 1. A NUMBER is the slip arm — the finger comes off
 * after that many ticks and never comes back, so the bar runs away and arrives
 * hot. See the deletion note above `benchToChest` for why these two swapped.
 */
function benchToChest(
  load: number,
  seed: number,
  holdTicks: number | null = null,
): { config: LiftConfig; script: ScriptedInput[] } {
  const press = pressTickFor(load, BENCH);
  const script: ScriptedInput[] = [{ tick: press, kind: 'press' }];
  if (holdTicks !== null) script.push({ tick: press + holdTicks, kind: 'release' });
  return { config: { kind: BENCH, loadRatio: load, seed }, script };
}

/** The state on the tick the sim itself recorded the chest touch, or null. */
function benchTouchState(load: number, seed: number, holdTicks: number | null): LiftState | null {
  const { config, script } = benchToChest(load, seed, holdTicks);
  const replay = runLift(config, script, TOUCH_SWEEP.MAX_TICKS);
  return replay.history.find((s) => s.events.some((e) => e.kind === 'chest-touch')) ?? null;
}

/**
 * The tick the sim itself fired the press command on, or null if it never did.
 *
 * READ BACK OUT OF THE SIM, never recomputed from `PRESS_COMMAND_DELAY_TICKS`.
 * Same discipline as `driveIdealTick` above and for the same reason: a test
 * that derived the command tick from the tuning file would agree with a broken
 * sim that fired the command at the wrong moment.
 */
function commandTickFor(load: number, seed: number, holdTicks: number | null = null): number | null {
  const { config, script } = benchToChest(load, seed, holdTicks);
  for (const state of runLift(config, script, TOUCH_SWEEP.MAX_TICKS).history) {
    if (state.events.some((e) => e.kind === 'press-command')) return state.tick;
  }
  return null;
}

/**
 * One rung of the tap ladder, as a script of presses — optionally with a hole
 * in it.
 *
 * `idleFrom`/`idleUntil` are ticks measured from `fromTick`, and taps landing
 * inside that half-open window are simply not written. That is what the rescue
 * sweep drives: the SAME rung, with and without a stretch of idle hands in the
 * middle, so the only difference between the two reps is that one stopped
 * tapping and the other did not.
 *
 * A RELEASE FOLLOWS EVERY PRESS ONE TICK LATER, which matters more than it
 * looks. `stepLift` takes one input per tick and `m.held` latches, so a script
 * of bare presses leaves the finger down forever after the first — which on
 * bench is now indistinguishable from a hold and would make every tap rung
 * read the same. The drive branch has shipped this exact defect once
 * (`m.held` re-coupled to the boost, caught by a human on a phone), so the
 * harness spells the release out rather than relying on the mechanic not
 * caring.
 */
function tapsAt(
  fromTick: number,
  gapTicks: number | null,
  count: number,
  idle: { from: number; until: number } | null = null,
): ScriptedInput[] {
  if (gapTicks === null) return [];
  const out: ScriptedInput[] = [];
  for (let i = 0; i < count; i += 1) {
    const offset = i * gapTicks;
    if (idle !== null && offset >= idle.from && offset < idle.until) continue;
    out.push({ tick: fromTick + offset, kind: 'press' });
    out.push({ tick: fromTick + offset + 1, kind: 'release' });
  }
  return out;
}

/**
 * A whole bench rep: lower with `holdTicks`, tap the grind every `gapTicks`
 * from the command, optionally going idle for a stretch in the middle.
 *
 * `gapTicks` null never taps at all, which is what exercises an unanswered
 * command. `earlyTaps` throws that many taps at the pause BEFORE the command,
 * which is the false-start arm. `idle` is the rescue sweep's axis.
 *
 * NO `throwDrives` ANY MORE. It used to chase the ascent's drive cues, and
 * bench arms none since the 2026-08-25 replay steer — so the option would have
 * been a parameter that changed nothing, which is worse than an absent one
 * because every sweep taking it as an axis would have been doubling its case
 * count over a distinction the mechanic no longer draws.
 */
function benchGrindRep(
  load: number,
  seed: number,
  options: {
    hold?: number | null;
    gapTicks?: number | null;
    earlyTaps?: number;
    idle?: { from: number; until: number } | null;
  } = {},
): LiftState {
  return runLift(
    { kind: BENCH, loadRatio: load, seed },
    buildBenchScript(load, seed, options),
    TOUCH_SWEEP.MAX_TICKS,
  ).final;
}

/** The script `benchGrindRep` plays, so a fixture can reuse it without the run. */
function buildBenchScript(
  load: number,
  seed: number,
  options: {
    hold?: number | null;
    gapTicks?: number | null;
    earlyTaps?: number;
    idle?: { from: number; until: number } | null;
  } = {},
): ScriptedInput[] {
  const hold = options.hold === undefined ? null : options.hold;
  const { script } = benchToChest(load, seed, hold);
  const command = commandTickFor(load, seed, hold);
  let full = [...script];
  if (command !== null && (options.earlyTaps ?? 0) > 0) {
    // BACKWARDS FROM THE COMMAND, ONE TICK APART. Spacing them wider walked
    // the earliest ones out of the pause and into the DESCENT, where a press
    // is not a false start at all — measured, asking for 16 landed 15. The
    // pause is only `PRESS_COMMAND_DELAY_TICKS.MIN` ticks long at its
    // shortest, so one tick apart is what fits a long false-start arm inside
    // the shortest pause the seed can draw. `stepLift` takes one input per
    // tick, so consecutive ticks are the densest a script can be.
    const early = options.earlyTaps ?? 0;
    for (let i = 0; i < early; i += 1) {
      const tick = command - 1 - i * GRIND_SWEEP.EARLY_TAP_GAP_TICKS;
      if (tick > 0) full.push({ tick, kind: 'press' });
    }
  }
  if (command !== null) {
    full = [
      ...full,
      ...tapsAt(
        command,
        options.gapTicks ?? null,
        GRIND_SWEEP.MAX_SCRIPTED_TAPS,
        options.idle ?? null,
      ),
    ];
  }
  // SORTED FOR READABILITY, NOT FOR CORRECTNESS, and the difference is worth
  // stating so nobody later "fixes" a bug this line does not have. `runLift`
  // folds the script into a `Map` keyed on tick, so for a DUPLICATED tick the
  // LAST entry wins regardless of order, and for distinct ticks order is
  // irrelevant. What the harness actually relies on is that no press and its
  // own release share a tick — true because every gap in `GRIND_SWEEP` is at
  // least `GRIND_TAP_REFRACTORY_TICKS`, which is 3.
  return [...full].sort((a, b) => a.tick - b.tick);
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
    // BENCH, for 'stalled'. It used to be here for 'no-touch', which the
    // 2026-08-25 replay steer deleted along with the beat that produced it —
    // so the arm is kept and re-aimed rather than dropped, because a bench rep
    // that abandons the descent AND ignores the command is still the sharpest
    // failure this lift can produce and a reachability census that stopped
    // walking bench would be narrower without saying so.
    reasons.add(
      benchGrindRep(1.0, 3, { hold: 1, gapTicks: null }).resolution?.missReason ?? '',
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

/**
 * Parameters of the descent sweep, named rather than inline.
 *
 * Same reason `streakSweep.ts` exists: a measurement whose inputs are not
 * written down is an anecdote. Every count in the `describe` below is taken
 * over exactly this domain.
 *
 * RE-SCOPED BY THE 2026-08-25 REPLAY STEER. `HOLDS` used to be a ladder of
 * release ticks, walked to find the moment that arrived best; the steer made
 * the answer "never let go" at every load, so the ladder is now a ladder of
 * SLIPS — how long the finger came off for — and what it measures is how much
 * a slip costs rather than which one is right.
 */
const TOUCH_SWEEP = {
  SEEDS: 6,
  /**
   * WHAT THIS ONE KEEPS ITS PRESETS FOR, deliberately, where `GRIND_SWEEP`
   * gave its up. The descent's claims are about the LOAD CURVE's shape —
   * "a held bar arrives under control at every load", "the two lightest
   * presets cannot be crashed" — and those are claims about the tuning tables
   * across their whole declared range, including the warm-up end no session
   * prescribes and the maximal end no meet calls. A curve checked only where
   * play lands is a curve nobody notices going wrong at its ends.
   *
   * The RESCUE and the tap ladder are the opposite case: they are claims about
   * what happens to a PLAYER, so they are swept over what a player can reach.
   * The two sweeps disagree on purpose and this note is why.
   */
  LOADS: [0.55, 0.7, 0.8, 0.85, 0.95, 1.0] as const,
  /**
   * Slips, in ticks from the descent's first press, walked in order. Each one
   * is the tick the finger comes OFF and never comes back — so a later entry
   * is a slip nearer the chest, with less descent left to recover in.
   */
  SLIPS: [4, 8, 12, 16, 20, 24, 28, 32, 36, 40] as const,
  /** Ticks a swept rep is allowed. Past any descent plus a pause and an ascent. */
  MAX_TICKS: 1200,
  /** Measured at the shipped tuning: (load, seed) pairs walked. */
  PAIRS: 36,
  /** Measured: arrivals compared down the slip ladder, all loads together. */
  LADDER_COMPARISONS: 60,
  /**
   * Measured: of those, how many were STRICTLY softer than the slip before.
   *
   * SOFTER, NOT HOTTER, and the direction is the opposite of the beat this
   * replaces. A slip is a stretch of runaway, so an EARLIER one has more of
   * the descent left to accelerate through — the later the finger comes off,
   * the less time the bar has to get away.
   */
  LADDER_STRICT_RISES: 29,
  /**
   * Measured: (slip, adjacent-load) pairs where both loads reached the chest.
   * Every one does now — the bar always arrives — so this is the full grid.
   */
  LOAD_COMPARISONS: 50,
  /** Measured: of those, how many were strictly hotter under the heavier load. */
  LOAD_HOTTER_UNDER_LOAD: 31,
  /**
   * Measured: abandoned descents that arrived at quality 0, over all pairs.
   *
   * 24 OF 36, WHICH IS 4 OF THIS SWEEP'S 6 LOADS AT 6 SEEDS EACH. `0.8`,
   * `0.85`, `0.95` and `1.0` can be crashed outright by letting go and never
   * coming back; `0.55` and `0.7` cannot — they run out of descent before they
   * run out of control.
   *
   * IT AGREES WITH THE CLOSED FORM IN `liftTuning.test.ts` — "leaves the crash
   * threshold reachable and not the default" derives the same boundary from
   * the constants without playing anything, and lands on the same two loads.
   * Two instruments, one answer, neither reading the other.
   *
   * -------------------------------------------------------------------------
   * AND THE CONCLUSION THAT USED TO SIT ON THE END OF THAT FIRST PARAGRAPH WAS
   * FALSE, WHICH IS WORTH MORE THAN THE MEASUREMENT ABOVE IT
   * -------------------------------------------------------------------------
   * It read: "so the worst a careless warm-up gets is a degraded touch rather
   * than a lost rep." Every number in front of it is correct and the inference
   * off the end of it is not, because the two loads it rests on are `0.55` and
   * `0.7` and `prescribeSession` emits neither. The lightest load any warm-up
   * is ever prescribed at is `0.75`, which sits on the far side of this
   * sweep's own boundary — so the sentence generalised from the two rungs of
   * the ladder that no session can reach.
   *
   * `REACHABLE_WARMUP.CELLS_A_SLIP_FULLY_CRASHES` is the same question asked
   * over the loads the ladder actually prescribes, and the answer is every one
   * of them. `LOST_WITH_THE_FINGER_OFF` is what it costs. This sweep's LOADS
   * are a fixture and were never a domain, which is the finding this file has
   * now recorded against three separate claims.
   */
  ABANDONED_CRASHES: 24,
  /**
   * Measured: outcome flips between a controlled touch and an abandoned one.
   *
   * 120 BEFORE THE 2026-08-27 WORKING-RUNG LEVER AND 160 AFTER, RE-DERIVED
   * RATHER THAN CARRIED. `LOADS` starts at 0.8, so every load in this sweep is
   * a working bar and every one of them now carries
   * `BENCH_WORKING_RUNG_DEMAND_ONSET` on top of the base curve. A crash
   * multiplies the WHOLE curve through `BENCH_TOUCH_DEMAND_PENALTY`, so a
   * bigger curve means a bigger crash penalty in absolute terms, and forty more
   * of the 240 cases change outcome because of it. Nothing here reaches a
   * warm-up: this sweep contains none.
   */
  SOFT_VS_CRASH_FLIPS: 160,
  /** Cases the flip count above is taken over. */
  OUTCOME_CASES: 240,
  /**
   * Measured: the longest a bench descent runs at any load in `LOADS`, in
   * ticks from the descent's first press to the chest touch.
   *
   * THE SUBJECT OF THE ARITHMETIC BOUND THAT DELETED 'no-touch'. Every descent
   * is bounded by `ceil(DEPTH_IDEAL.bench / DESCENT_DEPTH_PER_TICK.bench)` at
   * its own load, because the rate is floored there — so this is a played
   * number that has to sit under the closed form, and the test asserts both.
   */
  LONGEST_DESCENT_TICKS: 79,
} as const;

/**
 * ---------------------------------------------------------------------------
 * `OPEN_LOOP_SEARCH` WAS HERE AND IS RETIRED. THE DOMAIN IS GONE, NOT THE BAR.
 * ---------------------------------------------------------------------------
 * WHAT IT WAS. Every fixed duty-cycle pattern in a square hold-by-release
 * space — hold `on` ticks, release `off`, repeat, forever, with no perception
 * of the bar, the load or the seed — played across the load ladder. The count
 * of patterns that graded PERFECT at EVERY load
 * was pinned at zero, with per-load counts beside it as the non-zero controls.
 * It existed because a critic found two dozen of those patterns winning
 * everywhere on the beat's first tuning, and the fix — making the touch
 * thresholds and the patience budget load curves — was measured by that search
 * rather than argued. The exact figures are in this file's history at
 * `98e78bc`; they are written as words here because a retirement note is not a
 * live measurement and this file's own number rule would resolve them against
 * a test that no longer exists.
 *
 * WHY IT IS RETIRED RATHER THAN RE-PINNED, AND THE HONEST VERSION IS THAT ITS
 * PREMISE IS NOW FALSE BY DESIGN. The search asked "can one memorised rhythm
 * win at every load", and the answer under the 2026-08-25 replay steer is YES,
 * deliberately: hold from the first press and never let go grades PERFECT at
 * every load, because `DESCENT_DEPTH_PER_TICK.bench <= BENCH_TOUCH_SOFT_RATE`
 * at both ends of the curve. That is the steer — "the descent should be less
 * of a question on how far to go down, that should be automated almost in a
 * sense" — and a search whose zero is the thing the design now forbids would
 * have to be re-pinned at some non-zero number nobody could interpret.
 *
 * RE-AIMING IT WAS CONSIDERED AND REFUSED, WITH THE REASON. The remaining
 * input freedom on a bench descent is one bit per tick (finger down or not),
 * so a duty-cycle search still has a domain. What it no longer has is a
 * QUESTION: every pattern with `off > 0` is strictly worse than holding, by
 * construction, so the search's output would be "the constant strategy wins",
 * restated 900 times. A sweep that can only confirm an arithmetic identity is
 * the empty-domain vacuity this file already records twice.
 *
 * WHAT COVERS THE PROPERTY NOW, one claim at a time rather than one search:
 *
 *   "holding wins at every load"       `liftTuning.test.ts`'s controlled-rate
 *                                      inequality, in closed form, plus
 *                                      "arrives under control at every load
 *                                      when the bar is never let go" below.
 *   "letting go costs something"       the slip ladder below, pinned as a
 *                                      count of strict drops.
 *   "it costs MORE under load"         the load ladder below, same shape.
 *   "and it costs REPS"                `SOFT_VS_CRASH_FLIPS`.
 *
 * WHAT ITS DELETION DOMINATES OR ORPHANS, checked rather than assumed:
 *
 *   `dutyCycleScript` / `dutyCycleTouchQuality`  Its two helpers. Deleted with
 *       it; nothing else called either.
 *   "reads no random draw, so the search above is reproducible"  Its seed-axis
 *       control. NOT deleted — it carries a §8.1 claim (a descent that graded
 *       differently on different seeds would be a dice roll on the rep) that
 *       is independent of the search. Rewritten below against the slip ladder,
 *       so it keeps a live subject instead of pointing at a deleted one.
 *   `OPEN_LOOP_SEARCH.MAX_TICKS` / `SCRIPT_TICKS`  Read only by those helpers.
 *   Its `@guarantee` tag (id `the-descent-cannot-be-played-open-loop`), on
 *       `touchSpeedQuality` in `lift.ts`. Deleted with the claim, and its
 *       `MUTATION_WITNESSES` row with it — a witness naming a test that no
 *       longer exists is worse than an absent one. Written as an id in prose
 *       rather than as a live tag, because `guaranteeTags.test.ts` scans for
 *       the tag sequence and would resolve this sentence as a declaration.
 *   GDD §6.2's "non trivial" paragraph and the pattern-space measurement in
 *       it. Rewritten in the same commit, per CLAUDE.md.
 *
 * NOTHING ELSE READ ITS VALUES. `grep -rn OPEN_LOOP src/` returns only PROSE
 * after this deletion — this note, `touchSpeedQuality`'s header in `lift.ts`,
 * and the one test below that kept its seed control — and no expression. The
 * distinction matters because the grep is not empty and a reader who ran it
 * expecting silence would reasonably think the retirement was incomplete.
 */

describe('the descent to the chest (GDD §6.2; ruled 2026-08-25, steered 2026-08-25)', () => {
  it('arrives under control at every load when the bar is never let go', () => {
    // THE STEER, AS A PLAYED FACT. "Automated almost in a sense" means the
    // player who does the obvious thing — hold — gets the good arrival, at
    // every load, without timing anything. `liftTuning.test.ts` derives the
    // same result from the constants in closed form; this plays it.
    let checked = 0;
    for (const load of TOUCH_SWEEP.LOADS) {
      for (let seed = 1; seed <= TOUCH_SWEEP.SEEDS; seed += 1) {
        const touch = benchTouchState(load, seed, null);
        expect(touch, `load ${load} seed ${seed} never reached the chest`).not.toBeNull();
        if (touch === null) continue;
        expect(touch.touchQuality, `load ${load} seed ${seed}`).toBe(1);
        expect(qualityGrade(touch.touchQuality), `load ${load} seed ${seed}`).toBe('perfect');
        checked += 1;
      }
    }
    expect(checked, 'no held descents were played').toBe(TOUCH_SWEEP.PAIRS);
  });

  it('always reaches the chest, and inside the bound the constants give [a-bench-descent-always-reaches-the-chest]', () => {
    // THE ARITHMETIC THAT DELETED 'no-touch' AND `CHEST_TOUCH_TIMEOUT_TICKS`,
    // played rather than asserted. `benchDescentRate` floors the rate at the
    // controlled rate, so depth rises by at least that much every tick — which
    // makes the descent's length bounded above by `ceil(1 / controlled)` at
    // every load and for EVERY input pattern, not only for the held one.
    //
    // THE WORST CASE IS THE HELD DESCENT, WHICH IS THE COUNTER-INTUITIVE HALF.
    // Letting go makes the bar arrive SOONER, not later, so the abandoned arm
    // cannot be the longest. It is swept anyway, because "the slowest input is
    // the one that holds" is a property of this tuning rather than of the
    // floor, and only the sweep says which arm bound.
    let longest = 0;
    let checked = 0;
    for (const load of TOUCH_SWEEP.LOADS) {
      const bound = Math.ceil(
        LIFT_TUNING.DEPTH_IDEAL.bench / byLoad(LIFT_TUNING.DESCENT_DEPTH_PER_TICK.bench, load),
      );
      for (const slip of [null, ...TOUCH_SWEEP.SLIPS]) {
        const touch = benchTouchState(load, 3, slip);
        expect(touch, `load ${load} slip ${slip} never reached the chest`).not.toBeNull();
        if (touch === null) continue;
        const ticks = touch.tick - pressTickFor(load, BENCH);
        expect(ticks, `load ${load} slip ${slip} took ${ticks} against a bound of ${bound}`)
          .toBeLessThanOrEqual(bound);
        longest = Math.max(longest, ticks);
        checked += 1;
      }
    }
    // THE DOMAIN, AS A LITERAL, so a slip ladder quietly trimmed to three
    // entries reddens here rather than re-pinning itself.
    expect(TOUCH_SWEEP.SLIPS.length, 'the slip ladder this bound is walked over').toBe(10);
    expect(checked, 'no descents were timed').toBe(
      TOUCH_SWEEP.LOADS.length * (TOUCH_SWEEP.SLIPS.length + 1),
    );
    // Pinned as the measured value rather than as a bound: a descent that got
    // quietly quicker at every load would satisfy the bound above forever.
    expect(longest, `the longest descent ran ${longest} ticks`).toBe(
      TOUCH_SWEEP.LONGEST_DESCENT_TICKS,
    );
  });

  it('grades HOW the bar arrives, and arms no cue to time it against', () => {
    // THE DISCRIMINATOR AGAINST BOTH BEATS THIS REPLACED. Under the original
    // model the release tick was scored against a window and the bar reversed
    // on it. Under the second the release steered a rate. Now the release is
    // a mistake with a cost, there is no window anywhere in the descent, and
    // the only thing graded is the speed at contact.
    const load = LOAD_PRESETS.MAXIMAL;
    const arrived = [null, ...TOUCH_SWEEP.SLIPS]
      .map((slip) => benchTouchState(load, 3, slip))
      .filter((state): state is LiftState => state !== null);
    expect(arrived.length, 'no descent in the ladder reached the chest').toBe(
      TOUCH_SWEEP.SLIPS.length + 1,
    );

    // No depth timing was recorded, at any slip. There is no depth cue on a
    // bench any more and nothing may quietly re-arm one.
    for (const state of arrived) {
      expect(state.timings.some((t) => t.cue === 'depth'), `slip reached ${state.tick}`).toBe(false);
      expect(state.activeCue).toBeNull();
    }
    // ...and squat still records one, so the assertion above is about bench
    // rather than about the depth cue having been deleted outright.
    expect(play(load, { driveOffsetTicks: 0 }).timings.some((t) => t.cue === 'depth')).toBe(true);
  });

  it('never falls as the slip comes later — an EARLIER slip arrives hotter', () => {
    // MONOTONE, AND THE DIRECTION IS THE OPPOSITE OF THE BEAT THIS REPLACED,
    // WHICH IS WORTH SAYING BECAUSE THE FIRST VERSION OF THIS TEST GOT IT
    // BACKWARDS. Under the old model a LATER release meant a longer fed
    // descent and a hotter arrival. Here a slip is a stretch of runaway, and
    // an earlier one leaves MORE of the descent to run away in — so the later
    // the finger comes off, the softer the bar lands. Measured, not reasoned:
    // at load 0.55 a slip at tick 4 grades 0.42 and one at tick 8 grades 0.50.
    //
    // PINNED AS A COUNT RATHER THAN A BOUND. A constant would satisfy "never
    // falls" perfectly and be exactly the defect the three-fact progression
    // rule names, so the number of STRICT rises is pinned too.
    let strictRises = 0;
    let compared = 0;
    for (const load of TOUCH_SWEEP.LOADS) {
      let previous = Number.NEGATIVE_INFINITY;
      for (const slip of TOUCH_SWEEP.SLIPS) {
        const touch = benchTouchState(load, 3, slip);
        if (touch === null) continue;
        const quality = touch.touchQuality;
        expect(quality, `load ${load} slip ${slip}`).toBeGreaterThanOrEqual(previous);
        expect(quality, `load ${load} slip ${slip}`).toBeGreaterThanOrEqual(0);
        expect(quality, `load ${load} slip ${slip}`).toBeLessThanOrEqual(1);
        if (Number.isFinite(previous) && quality > previous) strictRises += 1;
        compared += 1;
        previous = quality;
      }
    }
    expect(compared, 'no arrivals were compared').toBe(TOUCH_SWEEP.LADDER_COMPARISONS);
    expect(strictRises, `only ${strictRises} strict rises over the ladder`).toBe(
      TOUCH_SWEEP.LADDER_STRICT_RISES,
    );
  });

  it('is harder to control under load, measured rather than asserted', () => {
    // THE LOAD-DEPENDENCE VERIFIED RATHER THAN CLAIMED, and the direction is
    // not the one the shipped descent-rate curve suggests:
    // `DESCENT_DEPTH_PER_TICK` is SLOWER at MAXIMAL, deliberately, because a
    // limit attempt is controlled down. What makes a heavy bar harder here is
    // the pair below it — more runaway, less recovery — so at the SAME slip a
    // heavier bar arrives hotter.
    let hotterUnderLoad = 0;
    let comparisons = 0;
    for (const slip of TOUCH_SWEEP.SLIPS) {
      for (let i = 1; i < TOUCH_SWEEP.LOADS.length; i += 1) {
        const lighter = benchTouchState(TOUCH_SWEEP.LOADS[i - 1] ?? 0, 3, slip);
        const heavier = benchTouchState(TOUCH_SWEEP.LOADS[i] ?? 0, 3, slip);
        if (lighter === null || heavier === null) continue;
        comparisons += 1;
        if (heavier.touchQuality < lighter.touchQuality) hotterUnderLoad += 1;
        // Never the wrong way round: a heavier bar at the same slip may tie,
        // and may not arrive SOFTER.
        expect(
          heavier.touchQuality,
          `slip ${slip}: ${TOUCH_SWEEP.LOADS[i]} arrived softer than ${TOUCH_SWEEP.LOADS[i - 1]}`,
        ).toBeLessThanOrEqual(lighter.touchQuality);
      }
    }
    expect(comparisons, 'no adjacent loads were compared').toBe(TOUCH_SWEEP.LOAD_COMPARISONS);
    expect(
      hotterUnderLoad,
      `${hotterUnderLoad} of ${comparisons} comparisons were strictly hotter under load`,
    ).toBe(TOUCH_SWEEP.LOAD_HOTTER_UNDER_LOAD);
  });

  it('forgives a slip the player catches, and charges one they do not', () => {
    // THE ONE DECISION THE DESCENT STILL ASKS FOR, AND ITS TWO SIDES. A finger
    // that comes back before the chest pulls the bar back onto the controlled
    // rate (`BENCH_DESCENT_RECOVER_PER_TICK`, floored there), so the arrival
    // is clean again; a finger that does not comes in hot. Without the first
    // half the beat would be a trap — one twitch and the rep is graded — which
    // is the opposite of "automated almost in a sense".
    const load = LOAD_PRESETS.MAXIMAL;
    const press = pressTickFor(load, BENCH);
    const caught = runLift(
      { kind: BENCH, loadRatio: load, seed: 3 },
      [
        { tick: press, kind: 'press' },
        { tick: press + 8, kind: 'release' },
        { tick: press + 14, kind: 'press' },
      ],
      TOUCH_SWEEP.MAX_TICKS,
    ).history.find((s) => s.events.some((e) => e.kind === 'chest-touch'));
    const abandoned = benchTouchState(load, 3, 8);
    expect(caught, 'the caught descent never reached the chest').toBeDefined();
    expect(abandoned, 'the abandoned descent never reached the chest').not.toBeNull();
    if (caught === undefined || abandoned === null) return;
    expect(caught.touchQuality).toBe(1);
    expect(abandoned.touchQuality).toBeLessThan(caught.touchQuality);
  });

  it('makes the crash cost the ascent rather than the rep', () => {
    // GDD §12.3's requirement: a crash degrades the press, it does not kill
    // the rep at the chest. Bench is never resolved 'buried', and every bench
    // rep reaches the chest, so 'no-depth' is unreachable too.
    let crashed = 0;
    for (const load of TOUCH_SWEEP.LOADS) {
      for (let seed = 1; seed <= TOUCH_SWEEP.SEEDS; seed += 1) {
        const rep = benchGrindRep(load, seed, { hold: 1, gapTicks: null });
        expect(rep.resolution?.missReason, `load ${load} seed ${seed}`).not.toBe('buried');
        expect(rep.resolution?.depthAchieved, `load ${load} seed ${seed}`).toBe(true);
        const touch = benchTouchState(load, seed, 1);
        expect(touch, `load ${load} seed ${seed}`).not.toBeNull();
        if (touch !== null && touch.touchQuality === 0) crashed += 1;
      }
    }
    expect(crashed, `${crashed} of ${TOUCH_SWEEP.PAIRS} abandoned descents crashed`).toBe(
      TOUCH_SWEEP.ABANDONED_CRASHES,
    );
  });

  it('flips outcomes between a controlled touch and a crashed one, across the sweep [bench-touch-decides-the-rep]', () => {
    // THE DESCENT MOVES `resolution.outcome`, which is the bar this repository
    // holds a mechanic to and the one the press beat failed on its first pass.
    // A crash that only changed the bar's opening velocity would wash out in
    // about `1/VELOCITY_RESPONSE` ticks and decide nothing; this is charged to
    // the demand curve for the whole ascent, and the count is what says so.
    //
    // THE SECOND AXIS IS THE TAP RATE, NOT THE DRIVE CUE. It used to be
    // `throwDrives`, and bench arms no drive cue since the replay steer — so
    // the axis would have doubled the case count over a distinction the
    // mechanic no longer draws. A mash and a jog is a real axis: it says the
    // touch decides reps at more than one level of effort.
    let cases = 0;
    let flips = 0;
    for (let seed = 1; seed <= GRIND_SWEEP.SEEDS; seed += 1) {
      for (const load of GRIND_SWEEP.LOADS) {
        for (const gapTicks of [GRIND_SWEEP.MASH_GAP_TICKS, GRIND_SWEEP.MODERATE_GAP_TICKS]) {
          const soft = benchGrindRep(load, seed, { gapTicks });
          const crashed = benchGrindRep(load, seed, { hold: 1, gapTicks });
          cases += 1;
          if (soft.resolution?.outcome !== crashed.resolution?.outcome) flips += 1;
        }
      }
    }
    // THE DOMAIN, AS A LITERAL. The line above pins the count against the
    // named constant, which moves when the sweep does; this pins the constant
    // itself, so a sweep quietly narrowed to a third of its loads reddens here
    // rather than re-pinning itself silently.
    expect(TOUCH_SWEEP.OUTCOME_CASES, 'the domain this count is taken over').toBe(240);
    expect(cases).toBe(TOUCH_SWEEP.OUTCOME_CASES);
    expect(
      flips,
      `the touch changed the outcome in ${flips} of ${cases} cases`,
    ).toBe(TOUCH_SWEEP.SOFT_VS_CRASH_FLIPS);
  });

  it('does not charge the sink twice — extraDepth stays 0 on a bench', () => {
    // The sink past the chest is drawing and flavour. If it were written into
    // `extraDepth` the crash would be paid for once through
    // `BENCH_TOUCH_DEMAND_PENALTY` and again through `BURIED_DEMAND_PER_DEPTH`,
    // which is a double-count no assertion in the file above would notice.
    const load = LOAD_PRESETS.MAXIMAL;
    const crash = benchTouchState(load, 3, 1);
    expect(crash, 'the abandoned rep never reached the chest').not.toBeNull();
    if (crash === null) return;
    expect(crash.extraDepth).toBe(0);
    // ...and the sink really happened, or the assertion above is about a rep
    // that never overshot and says nothing.
    expect(crash.depth).toBeGreaterThan(LIFT_TUNING.DEPTH_IDEAL.bench);
    expect(crash.depth).toBeLessThanOrEqual(LIFT_TUNING.DEPTH_COLLAPSE.bench);
  });

  it('reads no random draw, so the descent is not a dice roll on the rep', () => {
    // GDD §8.1: meet-day performance is skill-driven, and a descent that
    // graded differently on different seeds would be a dice roll on the rep.
    //
    // THIS IS `OPEN_LOOP_SEARCH`'s SEED CONTROL, KEPT AND RE-AIMED. Its claim
    // never depended on the duty-cycle search — it is about the descent
    // reading no PRNG at all — so it survives its parent's retirement pointed
    // at the slip ladder instead of at the deleted pattern space.
    let compared = 0;
    for (const load of TOUCH_SWEEP.LOADS) {
      for (const slip of TOUCH_SWEEP.SLIPS) {
        const reference = benchTouchState(load, 1, slip)?.touchQuality ?? -1;
        for (let seed = 2; seed <= TOUCH_SWEEP.SEEDS; seed += 1) {
          expect(benchTouchState(load, seed, slip)?.touchQuality ?? -1, `load ${load} slip ${slip} seed ${seed}`)
            .toBe(reference);
          compared += 1;
        }
      }
    }
    expect(compared, 'no cells were compared').toBe(
      TOUCH_SWEEP.LOADS.length * TOUCH_SWEEP.SLIPS.length * (TOUCH_SWEEP.SEEDS - 1),
    );
    // ...and the sweep is not vacuous: the same slip really does grade
    // DIFFERENTLY across loads, or every cell above is the same number and the
    // equality is about nothing.
    const graded = new Set(
      TOUCH_SWEEP.LOADS.map((load) => benchTouchState(load, 1, 20)?.touchQuality ?? -1),
    );
    expect(graded.size, 'the probe slip grades identically at every load').toBeGreaterThan(3);
  });

  it('reports how the bar is coming in, and only while it is coming in', () => {
    // `chestApproach` is what piece 2 draws. It is the SPEED half only, and
    // since the replay steer that is the WHOLE grade — `descentPatience` is
    // deleted, so there is no second half for it to be missing.
    const load = LOAD_PRESETS.MAXIMAL;
    const { config, script } = benchToChest(load, 3, 4);
    const history = runLift(config, script, TOUCH_SWEEP.MAX_TICKS).history;
    const descending = history.filter((state) => state.phase === 'DESCENT');
    expect(descending.length, 'no descent ticks').toBeGreaterThan(4);
    let previous = -1;
    for (const state of descending) {
      const heat = chestApproach(state);
      expect(heat, `tick ${state.tick}`).not.toBeNull();
      expect(heat ?? -1).toBeGreaterThanOrEqual(previous);
      previous = heat ?? -1;
    }
    // It MOVES — fact 3 of the progression rule. A constant would pass every
    // bound above.
    expect(previous).toBeGreaterThan(0);
    for (const state of history) {
      if (state.phase === 'DESCENT') continue;
      expect(chestApproach(state), `phase ${state.phase}`).toBeNull();
    }
    // ...and never on the other two lifts.
    for (const state of runLift(
      { kind: DEFAULT_KIND, loadRatio: load, seed: 3 },
      [{ tick: pressTickFor(load), kind: 'press' }],
    ).history) {
      expect(chestApproach(state)).toBeNull();
    }
  });
});

describe('the bench press command', () => {
  const load = LOAD_PRESETS.MAXIMAL;

  it('fires a command on bench and never on squat', () => {
    const benched = benchGrindRep(load, 3, { gapTicks: GRIND_SWEEP.MODERATE_GAP_TICKS });
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
    // learnable pause is an anticipation check wearing a grind's name.
    const { MIN, MAX } = LIFT_TUNING.PRESS_COMMAND_DELAY_TICKS;
    const delays = new Set<number>();
    for (let seed = 1; seed <= 40; seed += 1) {
      const { config, script } = benchToChest(load, seed, null);
      const holeEntry = runLift(config, script, TOUCH_SWEEP.MAX_TICKS).history.find(
        (state) => state.phase === 'HOLE',
      );
      const command = commandTickFor(load, seed, null);
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
      expect(commandTickFor(load, seed, null), `seed ${seed}`).toBe(commandTickFor(load, seed, null));
      const once = benchGrindRep(load, seed, { gapTicks: GRIND_SWEEP.MODERATE_GAP_TICKS });
      const twice = benchGrindRep(load, seed, { gapTicks: GRIND_SWEEP.MODERATE_GAP_TICKS });
      expect(JSON.stringify(once)).toBe(JSON.stringify(twice));
    }
  });

  it('shows the command in the prompt, and only from the tick it fires', () => {
    const { config, script } = benchToChest(load, 3, null);
    const command = commandTickFor(load, 3, null);
    expect(command).not.toBeNull();
    if (command === null) return;
    const hole = runLift(config, script, TOUCH_SWEEP.MAX_TICKS).history.filter(
      (state) => state.phase === 'HOLE',
    );
    const waiting = hole.filter((state) => state.tick < command);
    const commanded = hole.filter((state) => state.tick >= command);
    expect(waiting.length, 'no waiting ticks to check').toBeGreaterThan(0);
    expect(commanded.length, 'no commanded ticks to check').toBeGreaterThan(0);
    for (const state of waiting) expect(promptFor(state)).toBe(LIFT_COPY.PROMPT.HOLE.bench);
    for (const state of commanded) expect(promptFor(state)).toBe(LIFT_COPY.PROMPT.HOLE_COMMANDED);
  });

  it('draws no countdown ring before the command — a telegraphed grind is a timed one', () => {
    // `cueProgress` is what the ring is sized from. A number HERE would let
    // the player see the command coming and the beat would silently become an
    // anticipation check. The GO ring starts at the command tick.
    const { config, script } = benchToChest(load, 3, null);
    const command = commandTickFor(load, 3, null);
    expect(command).not.toBeNull();
    if (command === null) return;
    for (const state of runLift(config, script, TOUCH_SWEEP.MAX_TICKS).history) {
      if (state.phase !== 'HOLE') continue;
      if (state.tick >= command) continue;
      expect(cueProgress(state), `tick ${state.tick}`).toBeNull();
      expect(pressCommandIsLive(state), `tick ${state.tick}`).toBe(false);
      expect(grindIsLive(state), `tick ${state.tick}`).toBe(false);
      expect(grindProgress(state), `tick ${state.tick}`).toBeNull();
    }
  });

  it('puts the ring on the target the instant the command fires, then closes it at the launch', () => {
    // Progress 1 is the target radius — GO, not a countdown. Progress then
    // runs toward 2 as the launch beat runs out and the bar leaves the chest.
    const { config, script } = benchToChest(load, 3, null);
    const command = commandTickFor(load, 3, null);
    expect(command).not.toBeNull();
    if (command === null) return;
    const hole = runLift(config, script, TOUCH_SWEEP.MAX_TICKS).history.filter(
      (state) => state.phase === 'HOLE',
    );
    const atFire = hole.find((state) => state.tick === command);
    expect(atFire, 'command tick was not in HOLE').toBeDefined();
    if (atFire === undefined) return;
    expect(pressCommandIsLive(atFire)).toBe(true);
    expect(cueProgress(atFire)).toBe(1);

    const later = hole.filter((state) => state.tick > command && pressCommandIsLive(state));
    expect(later.length, 'no post-command HOLE ticks').toBeGreaterThan(0);
    for (const state of later) {
      const progress = cueProgress(state);
      expect(progress, `tick ${state.tick}`).not.toBeNull();
      expect(progress ?? 0, `tick ${state.tick}`).toBeGreaterThan(1);
    }
  });

  it('leaves the chest on the launch beat, whatever the player did', () => {
    // ONE ARM, NOT TWO. The burst this replaces also ended early on a tap cap,
    // so the launch tick moved with how fast the player mashed. There is no
    // cap now, so the bar leaves when the beat says and the taps decide how
    // fast it is going rather than when it goes.
    const command = commandTickFor(load, 3, null);
    expect(command).not.toBeNull();
    if (command === null) return;
    const beat = Math.max(
      1,
      Math.round(cueWindowMs('press', { kind: BENCH, loadRatio: load, seed: 3 }) / TICK_MS),
    );
    const launches: number[] = [];
    for (const gapTicks of [GRIND_SWEEP.NONE, GRIND_SWEEP.SPARSE_GAP_TICKS, GRIND_SWEEP.MASH_GAP_TICKS]) {
      const history = runLift(
        { kind: BENCH, loadRatio: load, seed: 3 },
        buildBenchScript(load, 3, { gapTicks }),
        TOUCH_SWEEP.MAX_TICKS,
      ).history;
      const launch = history.find((s) => s.events.some((e) => e.kind === 'press-launch'));
      expect(launch, `gap ${gapTicks} never launched`).toBeDefined();
      if (launch !== undefined) launches.push(launch.tick - command);
    }
    expect(launches, 'the launch moved with the tap rate').toEqual([beat, beat, beat]);
  });

  it('is live for every commanded HOLE tick and dead the instant the bar leaves', () => {
    // `pressCommandIsLive` is the LAUNCH BEAT's predicate and stops at the
    // chest. `grindIsLive` is the grind's and does not — the test below this
    // one is the half that says so, and the two are separated deliberately
    // because before the replay steer they were one fact.
    const { config } = benchToChest(load, 3, null);
    const command = commandTickFor(load, 3, null);
    expect(command).not.toBeNull();
    if (command === null) return;
    const history = runLift(
      config,
      buildBenchScript(load, 3, { gapTicks: GRIND_SWEEP.MASH_GAP_TICKS }),
      TOUCH_SWEEP.MAX_TICKS,
    ).history;
    const commandedHole = history.filter(
      (state) => state.phase === 'HOLE' && state.tick >= command,
    );
    expect(commandedHole.length, 'no commanded HOLE ticks').toBeGreaterThan(0);
    for (const state of commandedHole) expect(pressCommandIsLive(state), `tick ${state.tick}`).toBe(true);
    for (const state of history) {
      if (state.phase === 'HOLE') continue;
      expect(pressCommandIsLive(state), `phase ${state.phase}`).toBe(false);
    }
  });

  it('keeps the grind live from the command until the rep resolves', () => {
    // THE STEER AS A PREDICATE: "continuously tap to grind through". Under the
    // burst, taps stopped mattering when the bar left the chest; the whole
    // point of the redesign is that they do not.
    const history = runLift(
      { kind: BENCH, loadRatio: load, seed: 3 },
      buildBenchScript(load, 3, { gapTicks: GRIND_SWEEP.MASH_GAP_TICKS }),
      TOUCH_SWEEP.MAX_TICKS,
    ).history;
    const command = commandTickFor(load, 3, null);
    expect(command).not.toBeNull();
    if (command === null) return;
    let liveAscentTicks = 0;
    let liveHoleTicks = 0;
    for (const state of history) {
      const live = grindIsLive(state);
      if (state.phase === 'ASCENT') {
        expect(live, `ascent tick ${state.tick}`).toBe(true);
        liveAscentTicks += 1;
      }
      if (state.phase === 'HOLE') {
        expect(live, `hole tick ${state.tick}`).toBe(state.tick >= command);
        if (live) liveHoleTicks += 1;
      }
      if (state.phase === 'BRACE' || state.phase === 'DESCENT' || state.phase === 'RESOLVED') {
        expect(live, `phase ${state.phase} tick ${state.tick}`).toBe(false);
      }
    }
    // Counts, not bounds: an empty ascent or an empty commanded pause would
    // make every loop above pass on nothing.
    expect(liveAscentTicks, 'no live ascent ticks').toBeGreaterThan(20);
    expect(liveHoleTicks, 'no live commanded hole ticks').toBeGreaterThan(4);
    // ...and never on the other two lifts, at any phase.
    let squatTicks = 0;
    for (const state of squatHistory(load)) {
      expect(grindIsLive(state), `squat phase ${state.phase}`).toBe(false);
      squatTicks += 1;
    }
    let pullTicks = 0;
    const pullConfig: LiftConfig = { kind: DEADLIFT, loadRatio: 0.9, seed: 3 };
    for (const state of runLift(pullConfig, deadliftAscent(pullConfig), TOUCH_SWEEP.MAX_TICKS).history) {
      expect(grindIsLive(state), `deadlift phase ${state.phase}`).toBe(false);
      pullTicks += 1;
    }
    // Counts, so a fixture that stopped producing states reports itself rather
    // than passing on an empty loop — which is how a `false` sweep goes vacuous.
    expect(squatTicks, 'no squat ticks were walked').toBeGreaterThan(60);
    expect(pullTicks, 'no deadlift ticks were walked').toBeGreaterThan(60);
  });

  it('shows one ascent line on bench and never a drive cue prompt', () => {
    // The copy half of "there is no second tap layer". `ASCENT_CUE_OPEN` reads
    // as a window that will close, and a player who reads it that way stops
    // tapping — which on a continuous grind is the losing play.
    const history = runLift(
      { kind: BENCH, loadRatio: load, seed: 3 },
      buildBenchScript(load, 3, { gapTicks: GRIND_SWEEP.MASH_GAP_TICKS }),
      TOUCH_SWEEP.MAX_TICKS,
    ).history;
    const ascent = history.filter((s) => s.phase === 'ASCENT');
    expect(ascent.length, 'no ascent ticks').toBeGreaterThan(20);
    for (const state of ascent) {
      expect(promptFor(state), `tick ${state.tick}`).toBe(LIFT_COPY.PROMPT.ASCENT_GRINDING);
      expect(state.activeCue, `tick ${state.tick}`).toBeNull();
    }
    // ...and squat still flips through its three, so the assertion above is
    // about bench rather than about the ascent copy having been deleted.
    const squat = squatHistory(load).filter((s) => s.phase === 'ASCENT');
    expect(new Set(squat.map((s) => promptFor(s))).size, 'squat ascent copy collapsed').toBeGreaterThan(1);
  });

  it('arms no drive cue on a bench rep, at any load or tap rate', () => {
    // THE DELETED LAYER, PINNED ABSENT. `DRIVE_*` still carries bench rows —
    // `cueWindowMs('drive', config)` is total over `PlayableLiftKind` because
    // `session.ts` queries it per kind — so "bench has no cues" is a fact
    // about `stepLift`, not about the tuning tables, and only a played sweep
    // can say it.
    let checked = 0;
    for (const load of GRIND_SWEEP.LOADS) {
      for (const gapTicks of [GRIND_SWEEP.NONE, GRIND_SWEEP.MODERATE_GAP_TICKS, GRIND_SWEEP.MASH_GAP_TICKS]) {
        const history = runLift(
          { kind: BENCH, loadRatio: load, seed: 3 },
          buildBenchScript(load, 3, { gapTicks }),
          TOUCH_SWEEP.MAX_TICKS,
        ).history;
        for (const state of history) {
          expect(state.events.some((e) => e.kind === 'drive-cue-open'), `load ${load}`).toBe(false);
          expect(state.timings.some((t) => t.cue === 'drive'), `load ${load}`).toBe(false);
          expect(state.drivesUsed, `load ${load}`).toBe(0);
        }
        checked += 1;
      }
    }
    expect(checked, 'no bench reps were walked').toBe(GRIND_SWEEP.LOADS.length * 3);
    // ...and squat and deadlift still arm theirs, so this is about bench.
    expect(play(load, { driveOffsetTicks: 0 }).drivesUsed).toBeGreaterThan(0);
  });
});

/**
 * Parameters of the grind sweep, named rather than inline.
 *
 * Same reason `streakSweep.ts` exists: the first version of the press
 * measurement would have been unreproducible, and a measurement whose inputs
 * are not written down is an anecdote.
 *
 * RENAMED FROM `BURST_SWEEP` WITH THE MECHANIC. `MAX_DRIVE_CUES_PROBED` went
 * with it: bench arms no drive cue, so a constant naming how many to chase
 * would have been a knob a tuner could turn with nothing behind it.
 */
const GRIND_SWEEP = {
  SEEDS: 20,
  /**
   * THE LOADS A PLAYER CAN ACTUALLY BE HANDED, not `LOAD_PRESETS`.
   *
   * RE-SCOPED AFTER A CRITIC MEASURED THE PRESET VERSION AND FOUND IT
   * REPORTING A PROPERTY THE MECHANIC DID NOT HAVE. It read
   * `[0.7, 0.8, 0.85, 0.9, 0.95, 1.0]`, and `1.0` — the row carrying most of
   * what the flip counts were made of — is `LOAD_PRESETS.MAXIMAL`, a point for
   * reading tuning curves at that no producer emits. See `REACHABLE`'s header
   * for the full account.
   *
   * These six are the distinct session rungs the RPE ladder reaches at its top
   * four choices, plus the two meet ceilings (standard and aggressive attempt
   * three). `REACHABLE`'s own test derives them from the producers; they are
   * written out here because this sweep is a LADDER over load and needs them
   * in order, and `lift.test.ts` asserts the top of this list against
   * `REACHABLE.MEET_LOAD_CEILING` so the two cannot drift apart.
   */
  LOADS: [0.8, 0.85, 0.875, 0.9, 0.9456, 0.97344] as const,
  /** The tap ladder, in ticks between taps. `null` never taps at all. */
  NONE: null,
  SPARSE_GAP_TICKS: 20,
  MODERATE_GAP_TICKS: 8,
  MASH_GAP_TICKS: 3,
  /** Ticks between the early taps a false-start arm throws at the pause. */
  EARLY_TAP_GAP_TICKS: 1,
  /**
   * How many taps a script writes.
   *
   * FAR LARGER THAN THE BURST'S 40, AND THAT IS THE STEER SHOWING UP IN THE
   * HARNESS. A burst script only had to outlast an 850ms window; a grind
   * script has to outlast the whole rep, and the slowest rung
   * (`SPARSE_GAP_TICKS`) has to still be tapping when a maximal bench times
   * out at `ASCENT_TIMEOUT_TICKS`. 300 taps at a 20-tick gap is 6000 ticks,
   * which is past any rep this module can produce.
   */
  MAX_SCRIPTED_TAPS: 300,
  /** Measured at the shipped tuning. One case per (seed, load). */
  CASES: 120,
  /**
   * The load `LOADS` ends on, which must be the meet's own ceiling.
   *
   * Pinned so a sweep that quietly stopped short of what a meet can call — the
   * exact failure the preset version shipped, one direction over — reddens
   * rather than re-pinning itself.
   */
  TOP_LOAD: 0.97344,
  /** Outcome flips between a mashed grind and an unanswered command. */
  /**
   * Outcome flips between a mashed grind and an unanswered command.
   *
   * SATURATED AT THE DOMAIN SIZE, AND THAT IS STATED RATHER THAN LEFT TO BE
   * NOTICED: 120 of 120 means answering the command changes the outcome at
   * EVERY load a player can be handed, so this pin can only ever move DOWN. It
   * is a one-sided guard for that reason, and the two counts under it —
   * `MASH_VS_SPARSE_FLIPS` and `MASH_MAKE_TO_NONE_MISS` — are the ones that
   * can move in both directions.
   */
  MASH_VS_NONE_FLIPS: 120,
  /**
   * Outcome flips between a mashed grind and a sparse one (a tap every 20
   * ticks, 3 a second).
   *
   * 80, AND IT DID NOT MOVE IN THE 2026-08-26 DIFFICULTY RETUNE — WHICH IS
   * WORTH SAYING BECAUSE A FIRST PASS AT THAT RETUNE TOOK IT TO 100 AND HAD TO
   * BE WALKED BACK. That pass raised the demand curve far enough to break GDD
   * §12.3's warm-up protection (see `REACHABLE_WARMUP`), and the retune that
   * survived is about a third of its size. On THIS sweep the two are
   * indistinguishable: `LOADS` starts at 0.8 and steps to the meet ceiling, and
   * across that band a 3-a-second grind and a 20-a-second one reach the same
   * outcome in the same 40 of 120 cases either way.
   *
   * SO THIS BLOCK WAS NOT WHERE THE 2026-08-26 RETUNE SHOWED UP, and a reader
   * comparing those commits here will conclude nothing changed. What moved then
   * was on the reachable domain — `REACHABLE_RESCUE`'s RPE 8 rows and the tap
   * rate each rung demands — and this sweep's own header explains why it could
   * not see that: its loads are a hand-written ladder over the top of the
   * range, not the cells `prescribeSession` emits.
   *
   * IT IS WHERE THE 2026-08-27 WORKING-RUNG LEVER SHOWS UP, 80 -> 100, AND THE
   * REASON IS THE SAME FACT READ THE OTHER WAY. Every load in `LOADS` is a
   * working bar, so every one of them takes the lever, and a sparse grind — one
   * tap every 20 ticks, 3 a second — is now below the make floor at twenty more
   * of the 120 cases than it was. The rungs this sweep separates did not move;
   * the bar they are separating did.
   */
  MASH_VS_SPARSE_FLIPS: 100,
  /** Outcome flips between a moderate grind and an unanswered command. */
  MODERATE_VS_NONE_FLIPS: 120,
  /**
   * Of the `MASH_VS_NONE_FLIPS`, how many are a MAKE becoming a MISS.
   *
   * PINNED SEPARATELY BECAUSE A FLIP COUNT DOES NOT SAY WHAT MOVED. A beat
   * that only ever separated 'good-lift' from 'grind' would satisfy every flip
   * pin above while never deciding whether the bar went up, which is the
   * weaker claim a reader would take from those counts.
   *
   * 100, AND LIKE `MASH_VS_SPARSE_FLIPS` IT DID NOT MOVE IN THE 2026-08-26
   * RETUNE. The walked-back first pass took it to 120 — saturated, an
   * unanswered command a miss at every load in `LOADS` — and the retune that
   * shipped leaves 20 of the 120 cases making the lift unanswered. `LOADS`
   * starts at 0.8 and the reachable ladder starts at 0.75, so warm-up loads are
   * not in this sweep either way; `REACHABLE_RESCUE` and `REACHABLE_WARMUP` are
   * where that boundary is measured.
   */
  MASH_MAKE_TO_NONE_MISS: 100,
} as const;

/**
 * ---------------------------------------------------------------------------
 * THE REACHABLE DOMAIN — EVERY `loadRatio` THE GAME CAN ACTUALLY HAND A PLAYER
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS, AND IT IS A BAR FAILURE THAT PUT IT HERE. The first version
 * of the rescue sweep was taken over `LOAD_PRESETS` — 0.85, 0.9, 0.95, 1.0 —
 * and pinned `RESCUED_FROM_A_MISS: 40` and `IDLE_REPS_THAT_STALLED: 40` as
 * TOTALS. An independent critic re-derived the same sweep over the loads the
 * PRODUCERS emit and measured **0 stalls and 0 miss-rescues in every training
 * rep the game can prescribe**: both totals were 100% concentrated at
 * `LOAD_PRESETS.MAXIMAL = 1`, which is a test preset no play state produces.
 * The headline claim — "stop tapping and the bar stalls; start again and it
 * comes back" — was true of one meet attempt under one jump strategy and of
 * nothing a session can reach.
 *
 * A PRESET IS NOT A DOMAIN, and that is the transferable half. `LOAD_PRESETS`
 * is a set of named points for reading tuning curves at; it is not a claim
 * about what a player meets. Sweeping it and reporting a total reads exactly
 * like sweeping the game, which is why the failure survived a round.
 *
 * SO THE CELLS ARE DERIVED FROM THE TWO PRODUCERS RATHER THAN LISTED.
 * `loadRatio` has exactly two of them in this tree:
 *
 *   `session.ts`'s `prescribeSession`  weight/e1RM from the RPE the player
 *                                      taps and the check-in they answered.
 *   `meetDay.ts`'s attempt builder     weight/e1RM from `OPENER_FRACTION_OF_1RM`
 *                                      and `ATTEMPT_JUMP_FRACTION`.
 *
 * Both are walked exhaustively below. If a third producer appears, or either
 * of these changes what it emits, the cell list moves and `REACHABLE_RESCUE`
 * goes red as a set — which is the point of pinning it in both directions
 * rather than pinning the counts alone.
 *
 * THE FEEL IS PART OF THE CELL, NOT A NUISANCE PARAMETER. The check-in moves
 * BOTH the prescribed load (`readiness.loadAdjustmentPercent`) and the
 * lifter's capacity (`capacityScaleForBarSpeed`), and the second is the larger
 * effect — so a cell is `(loadRatio, barSpeed)` and the two axes are not
 * independent. See `REACHABLE_COUPLING` for what that does, measured and
 * pinned deliberately rather than left to be discovered.
 */
const REACHABLE = {
  /**
   * e1RM the session cells are derived at, kg.
   *
   * ANY VALUE WOULD DO AND THAT IS WORTH SAYING: `loadRatio` is
   * `weightKg / e1rmKg`, so the ratio is scale-free — except through
   * `roundLoad`, which snaps to the shipped plate grid and therefore quantises
   * the ratio differently at different e1RMs. 100 kg is chosen so the snapped
   * ratios are readable (0.8250, 0.8750) rather than to make them come out
   * well. `session.test.ts` owns the rounding rule; this only reads it.
   */
  E1RM_KG: 100,
  /** Work sets asked of `prescribeSession`. It does not reach `loadRatio`. */
  WORK_SETS: 3,
  /** Reps per set, which DOES reach it — it is half the RPE chart's key. */
  REPS_PER_SET: 3,
  /** Seeds per cell. The seed decides the command delay and nothing else. */
  SEEDS: 20,
  /**
   * Ticks after the command at which both reps of a pair stop tapping.
   *
   * ---------------------------------------------------------------------------
   * WIDENED 2026-08-26 FROM `[18, 22, 26, 30]`, AND ONE CONSTANT WAS THE WHOLE
   * DIFFERENCE BETWEEN A GREEN CONTROL BLOCK AND FIVE BROKEN WARM-UPS
   * ---------------------------------------------------------------------------
   * The old list began at 18 ticks after the command. `PRESS_LAUNCH_MS` is 300
   * ms — 18 ticks — so the EARLIEST sample this table ever took was the instant
   * the bar left the chest, by which point a player tapping at the sweep's own
   * `GAP_TICKS` has already thrown three taps. Every rep a difficulty retune
   * newly cost a warm-up lived at offsets 1-12, in front of the first sample,
   * and the whole RPE 6/7 block reported `[x, 0, 0]` while a player who tapped
   * twice and stopped was losing the rep.
   *
   * THAT IS THE SAME DEFECT THIS TABLE WAS BUILT TO REPAIR, ON A DIFFERENT AXIS.
   * `REACHABLE`'s header records the first one: the sweep ran over `LOAD_PRESETS`
   * and reported a property of loads no producer emits. This one ran over
   * offsets no quitting player produces. A preset is not a domain, and neither
   * is a sampling grid that starts after the interesting part.
   *
   * 2 IS THE FLOOR AND IT IS DELIBERATE: one tap lands at the command and the
   * next does not, so the pair is "answered once, then stopped" — the cheapest
   * answer a player can give. `REACHABLE_WARMUP` sweeps offsets 1..140 whole
   * and is what actually guards the warm-up rungs; this list is what makes the
   * PINNED TABLE honest about them.
   */
  IDLE_FROM_TICKS: [2, 6, 10, 14, 18, 22, 26, 30] as const,
  /** How long the rescued rep stays quiet before it starts again. */
  IDLE_SPAN_TICKS: 18,
  /** The rung both reps tap at, before and after the silence. */
  GAP_TICKS: 6,
  /** Pairs per cell: `IDLE_FROM_TICKS.length * SEEDS`. 80 before the widening. */
  PAIRS_PER_CELL: 160,
  /** Measured: distinct (loadRatio, barSpeed) cells the session can produce. */
  SESSION_CELLS: 22,
  /** Meet cells: 3 strategies x 3 attempts x 2 check-ins. Not deduped — see below. */
  MEET_CELLS: 18,
  /** Measured: the highest `loadRatio` a session set can prescribe. */
  SESSION_LOAD_CEILING: 0.95,
  /** Measured: the highest `loadRatio` a meet attempt can call. */
  MEET_LOAD_CEILING: 0.97344,
} as const;

/** One cell of the reachable domain: a load a producer emits, and the feel it comes with. */
interface ReachableCell {
  readonly label: string;
  readonly loadRatio: number;
  readonly feel: SessionFeel;
}

/**
 * Every distinct (loadRatio, barSpeed) a SESSION can hand the mechanic.
 *
 * Walks all five RPE choices against all 27 check-ins and dedupes, because the
 * check-in's effect on both axes is coarse: 135 combinations collapse to 22
 * distinct cells. Deduping is what makes the pinned table readable; the count
 * is pinned so a collapse to fewer cells reports itself.
 */
function reachableSessionCells(): ReachableCell[] {
  const sleeps = ['poor', 'ok', 'good'] as const;
  const sorenesses = ['sore', 'normal', 'fresh'] as const;
  const motivations = ['flat', 'steady', 'fired-up'] as const;
  const seen = new Set<string>();
  const cells: ReachableCell[] = [];
  for (const targetRpe of SESSION_TUNING.RPE_CHOICES) {
    for (const sleep of sleeps) {
      for (const soreness of sorenesses) {
        for (const motivation of motivations) {
          const feel = sessionFeel(EMPTY_FATIGUE_STATE, REACHABLE.WORK_SETS + 2, {
            sleep,
            soreness,
            motivation,
          });
          const plan = prescribeSession(
            REACHABLE.E1RM_KG,
            BENCH,
            targetRpe,
            feel.readiness,
            REACHABLE.WORK_SETS,
            REACHABLE.REPS_PER_SET,
          );
          const key = `${plan.loadRatio}|${feel.barSpeed}`;
          if (seen.has(key)) continue;
          seen.add(key);
          // THE LOAD IS IN THE LABEL AND IT HAS TO BE. A first version keyed
          // on `rpe/barSpeed` alone and TWO CELLS COLLIDED — RPE 6 reaches
          // `as-expected` at both 0.7500 and 0.8000, because several check-ins
          // share a bar-speed cue while carrying different load nudges. The
          // record silently kept the second and the table read 38 rows for 40
          // cells, which is the "an input that is silently absent" vacuity
          // this file's own notes name. The count assertion below is what
          // catches it now.
          cells.push({
            label: `session/rpe${targetRpe}/${plan.loadRatio.toFixed(4)}/${feel.barSpeed}`,
            loadRatio: plan.loadRatio,
            feel,
          });
        }
      }
    }
  }
  return cells;
}

/**
 * Every (loadRatio, barSpeed) a MEET attempt can call, walking the jump ladder
 * the way `meetDay.ts` does: an opener at `OPENER_FRACTION_OF_1RM`, then two
 * jumps at the chosen strategy's fraction.
 *
 * NOT DEDUPED, DELIBERATELY, though attempt 1 is the same load under all three
 * strategies. The three identical rows are a control the table carries for
 * free: same load, same feel, same answer three times over, so a table where
 * they disagreed would be reporting something other than the load.
 *
 * TWO CHECK-INS RATHER THAN 27. Meet day does not ask the readiness questions
 * — `meetDay.ts` builds its own feel — so the axis here is the two ends of the
 * bar-speed range a meet can arrive in, which is what actually reaches the
 * mechanic.
 */
function reachableMeetCells(): ReachableCell[] {
  const rested = sessionFeel(EMPTY_FATIGUE_STATE, REACHABLE.WORK_SETS + 2);
  const wrecked = sessionFeel(EMPTY_FATIGUE_STATE, REACHABLE.WORK_SETS + 2, {
    sleep: 'poor',
    soreness: 'sore',
    motivation: 'flat',
  });
  const cells: ReachableCell[] = [];
  for (const [feelLabel, feel] of [['rested', rested], ['wrecked', wrecked]] as const) {
    for (const strategy of ['conservative', 'standard', 'aggressive'] as const) {
      const jump = ATTEMPT_JUMP_FRACTION[BENCH][strategy];
      let loadRatio = OPENER_FRACTION_OF_1RM[BENCH];
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        if (attempt > 1) loadRatio = scrubProbe(loadRatio * (1 + jump));
        cells.push({ label: `meet/${strategy}/att${attempt}/${feelLabel}`, loadRatio, feel });
      }
    }
  }
  return cells;
}

/** Six decimals, matching `lift.ts`'s own `scrub`, so a label is stable. */
function scrubProbe(value: number): number {
  return Number(value.toFixed(6));
}

/**
 * A bench rep driven REACTIVELY rather than from a pre-written script.
 *
 * WHY THIS AND NOT `buildBenchScript`. That helper reads the command tick back
 * out of a probe run and writes an absolute script, which is right when the
 * config is fixed. Here the config carries a `SessionFeel`, and fatigue moves
 * the launch beat's length — so a schedule computed from one probe and applied
 * to another cell would be tapping at the wrong offsets. This one watches the
 * state and taps against the command tick the run itself produces, which is
 * also what a player does.
 */
function driveGrind(
  config: LiftConfig,
  gapTicks: number,
  idleFromTicks: number,
  idleSpanTicks: number,
  slipTicks: number | null = null,
): LiftState {
  let state = createLift(config);
  let commandTick: number | null = null;
  let descentTick: number | null = null;
  let nextTapTick: number | null = null;
  let releaseNext = false;
  for (let i = 0; i < TOUCH_SWEEP.MAX_TICKS; i += 1) {
    const tick = state.tick + 1;
    let input: LiftInput | null = null;
    if (commandTick === null) {
      // Hold the bar down through the whole descent — the correct play since
      // the 2026-08-25 replay steer, and the one this sweep is not about.
      if (tick === 1) input = { kind: 'press' };
      // ...UNLESS `slipTicks` asks for the OTHER descent, which is a second
      // axis and not a variation of this one. Counted from the tick DESCENT
      // opens rather than from the press, because the press lands in BRACE and
      // a release before the descent starts is swallowed by the phase — a
      // probe that measured this from tick 1 read `touchQuality` 1 everywhere
      // and reported no finding at all.
      else if (slipTicks !== null && descentTick !== null && tick === descentTick + slipTicks) {
        input = { kind: 'release' };
      }
    } else if (releaseNext) {
      input = { kind: 'release' };
      releaseNext = false;
    } else if (nextTapTick !== null && tick >= nextTapTick) {
      const offset = tick - commandTick;
      const idle = offset >= idleFromTicks && offset < idleFromTicks + idleSpanTicks;
      if (!idle) {
        input = { kind: 'press' };
        releaseNext = true;
      }
      nextTapTick = tick + gapTicks;
    }
    state = stepLift(state, input);
    if (descentTick === null && state.phase === 'DESCENT') descentTick = state.tick;
    if (commandTick === null && state.pressCommandTick !== null) {
      commandTick = state.pressCommandTick;
      nextTapTick = commandTick;
    }
    if (state.phase === 'RESOLVED') break;
  }
  return state;
}

/** What one cell of the reachable sweep measured: `[rescued, fromMiss, stalled]`. */
type RescueRow = readonly [number, number, number];

/**
 * ---------------------------------------------------------------------------
 * THE REACHABLE-DOMAIN RESCUE TABLE, PER CELL, PINNED IN BOTH DIRECTIONS
 * ---------------------------------------------------------------------------
 * Each row is `[rescued, fromMiss, stalled]` out of `PAIRS_PER_CELL` pairs.
 * `rescued` counts pairs whose OUTCOME changed when the player started tapping
 * again; `fromMiss` counts the subset where a MISS became a make; `stalled`
 * counts pairs where the idle rep measurably stopped (`stallTicks > 0`).
 *
 * THE ZEROS ARE THE FINDING AND THEY ARE PINNED PER ROW, which is the whole
 * repair. A total says a population moved; only a row says WHERE, and the
 * previous version's totals hid the fact that every one of them came from a
 * load no player reaches. Read down the `session/` rows and the ladder is
 * legible without running anything: nothing lost at RPE 6 and 7, stopping
 * costing the rep from RPE 8, and more of every column at 9, 10 and the meet.
 *
 * ---------------------------------------------------------------------------
 * RE-DERIVED 2026-08-26 AFTER THE DIFFICULTY RETUNE — AND THE RPE 8 ROWS ARE
 * THE REASON THE RETUNE HAPPENED
 * ---------------------------------------------------------------------------
 * A phone replay said "rpe 8 is just too easy, theres no difficulty there".
 * The four RPE 8 rows below used to read `[20,0,0] [40,0,0] [20,0,0] [20,0,0]`
 * — the outcome flipped between a clean lift and a grinder, and stopping
 * tapping cost NOTHING: zero lost reps and zero stalls, at every cell the rung
 * can reach. `DEMAND_BASE.bench` moved and `STICK_WIDTH.bench` did not, and RPE
 * 8 now loses a rep in all four cells and stalls in all four of them.
 *
 * BOTH HALVES OF THAT SENTENCE WERE STALE AND BOTH WERE STALE THE SAME WAY —
 * WRITTEN WHEN THEY WERE TRUE AND LEFT ALONE WHEN THE CODE MOVED. It read
 * "`DEMAND_BASE.bench` and `STICK_WIDTH.bench` moved together", which described
 * the first pass; the width was reverted to `0.22` in the walk-back and the
 * retune is one constant. And it read "stalls in three of them", which the four
 * rows directly below it contradict — the third column is non-zero in every
 * one. A summary sentence sitting on top of the table it summarises is the
 * cheapest possible thing to check and was checked by nobody, including the
 * pass that rewrote the rows underneath it.
 *
 * WHERE THE GRIND BEGINS, IN THE TERMS A PLAYER WOULD USE:
 *
 *   RPE 6, 7            a rep that was ANSWERED — one tap is enough — can
 *                       never be lost by stopping. Tapping decides its SPEED
 *                       and its grade. `REACHABLE_WARMUP` sweeps every quit
 *                       instant whole and pins that at zero; the one residue,
 *                       a single cell that misses on literally NO input, is
 *                       measured under `DEMAND_BASE.bench`.
 *   RPE 8               STOPPING COSTS THE REP. All four cells lose reps and
 *                       all four stall on the way. A slow grind still makes it —
 *                       as a GRINDER rather than a GOOD LIFT.
 *   RPE 9               more of both: every cell stalls and loses reps, two of
 *                       the four on all 80 pairs.
 *   RPE 10              80 of 80 on all three counts, at every check-in.
 *   meet, attempt 1     already 80 of 80: an opener is 90% of e1RM.
 *   meet, attempts 2-3  the same under EVERY jump strategy, including
 *                       conservative, and the top attempt is unrescuable.
 *
 * A CELL WITH `fromMiss > 0` AND `stalled === 0` IS NOT A CONTRADICTION. A rep
 * can be lost by running out of `ASCENT_TIMEOUT_TICKS` while still creeping
 * upward — never slow enough to trip `GRIND_STALL_VELOCITY`, never fast enough
 * to finish. That is a bar the player did not press hard enough rather than a
 * bar that beat them, and the two counts being separate is what shows it.
 * `session/rpe8/0.8000/slower-than-expected` is exactly that case.
 */
const REACHABLE_RESCUE: Readonly<Record<string, RescueRow>> = {
  // THE RPE 6 AND 7 BLOCK IS THE CONTROL, AND THE 2026-08-26 REGRESSION LIVED
  // HERE BEHIND A SAMPLING GRID. Every row is `[flips, 0, 0]`: over the offsets
  // below, the outcome can change between a clean lift and a grinder when the
  // player stops, and the rep is never lost and the bar never stalls.
  //
  // THAT IS ALSO WHAT THE OLD TABLE SAID WHILE IT WAS FALSE, which is why this
  // comment names its own limits. These zeros are true of eight sampled quit
  // instants, the earliest of which is two ticks after the command. They are
  // NOT the guarantee — `REACHABLE_WARMUP` is, because it sweeps every instant
  // from 1 to 180 at three cadences and pins the losses at zero. Read this
  // block as the shape and that sweep as the check.
  'session/rpe6/0.7500/slower-than-expected': [60, 0, 0],
  'session/rpe6/0.7500/as-expected': [0, 0, 0],
  'session/rpe6/0.8000/as-expected': [100, 0, 0],
  'session/rpe6/0.8250/crisp': [60, 0, 0],
  'session/rpe6/0.8500/popping': [60, 0, 0],
  'session/rpe7/0.7750/slower-than-expected': [100, 0, 0],
  'session/rpe7/0.7750/as-expected': [60, 0, 0],
  'session/rpe7/0.8250/as-expected': [100, 0, 0],
  'session/rpe7/0.8500/crisp': [100, 0, 0],
  'session/rpe7/0.8750/popping': [100, 0, 0],
  // THE GRIND BEGINS HERE. The hardest RPE 7 cell above sits at a
  // demand-minus-capacity margin of -0.0483 and the lightest RPE 8 cell here at
  // -0.0025; the boundary at which a quiet rep starts losing the rep is between
  // them. `DEMAND_BASE.bench`'s header holds what that window costs and why it
  // cannot be widened.
  'session/rpe8/0.8000/slower-than-expected': [160, 100, 60],
  'session/rpe8/0.8500/as-expected': [160, 120, 100],
  'session/rpe8/0.8750/crisp': [160, 100, 100],
  'session/rpe8/0.9000/popping': [160, 100, 100],
  'session/rpe9/0.8250/slower-than-expected': [160, 160, 120],
  'session/rpe9/0.8750/as-expected': [160, 160, 160],
  'session/rpe9/0.9000/crisp': [160, 160, 160],
  'session/rpe9/0.9250/popping': [160, 160, 120],
  'session/rpe10/0.8750/slower-than-expected': [160, 160, 160],
  'session/rpe10/0.9000/as-expected': [160, 160, 160],
  'session/rpe10/0.9250/crisp': [160, 160, 160],
  'session/rpe10/0.9500/popping': [160, 160, 160],
  // --- MEET: the opener fraction and the three jump ladders, at both ends of
  //     the bar-speed range. Attempt 1 is the same load under all three
  //     strategies and answers the same three times, which is the control. ---
  'meet/conservative/att1/rested': [160, 160, 160],
  'meet/conservative/att2/rested': [160, 160, 160],
  'meet/conservative/att3/rested': [160, 160, 160],
  'meet/standard/att1/rested': [160, 160, 160],
  'meet/standard/att2/rested': [160, 160, 160],
  'meet/standard/att3/rested': [160, 160, 160],
  'meet/aggressive/att1/rested': [160, 160, 160],
  'meet/aggressive/att2/rested': [160, 160, 160],
  'meet/aggressive/att3/rested': [40, 40, 160],
  'meet/conservative/att1/wrecked': [160, 160, 160],
  'meet/conservative/att2/wrecked': [160, 160, 160],
  'meet/conservative/att3/wrecked': [0, 0, 160],
  'meet/standard/att1/wrecked': [160, 160, 160],
  'meet/standard/att2/wrecked': [60, 60, 160],
  'meet/standard/att3/wrecked': [0, 0, 160],
  'meet/aggressive/att1/wrecked': [160, 160, 160],
  'meet/aggressive/att2/wrecked': [0, 0, 160],
  // THE CEILING CELL, AND THE ONE ROW WHERE COMING BACK DOES NOT HELP AT ALL.
  // 160 of 160 idle reps stall and NONE is rescued: at that load 18 ticks of
  // silence is past recovering from. Pinned rather than tuned away — a mechanic
  // where every mistake is recoverable at every load has no top end.
  'meet/aggressive/att3/wrecked': [0, 0, 160],
};

/**
 * WHAT THE CHECK-IN ACTUALLY DOES TO THE REP, PINNED DELIBERATELY BECAUSE IT
 * IS NOT WHAT A READER EXPECTS.
 *
 * A better check-in raises the prescribed load (`loadAdjustmentPercent`) AND
 * the lifter's capacity (`capacityScaleForBarSpeed`), and the second is the
 * larger effect at every rung — so **a primed player's set is EASIER than a
 * steady player's at the same RPE**, not harder. `popping` carries +12% of
 * capacity against roughly +5% of load.
 *
 * IT IS NOT THIS PIECE'S TO FIX AND IT IS NOT AN ACCIDENT OF THE RETUNE. Both
 * halves live in `fatigue.ts` and `session.ts`, the coupling predates the
 * bench work entirely, and it is arguably the right design — a player who
 * shows up primed should have a better day, and GDD §12.3 refuses anything
 * that punishes showing up. What would be wrong is leaving it as a thing a
 * future tuner discovers by accident, so the ORDERING is measured and pinned
 * here: at every RPE choice, the margin by which peak demand exceeds capacity
 * falls monotonically as the check-in improves.
 */
/**
 * WHERE STALL-ABILITY BEGINS, AS COUNTS AND AS NAMES.
 *
 * Derived from `REACHABLE_RESCUE` rather than measured separately, so the two
 * cannot disagree — but pinned, because a table read for a shape is a table
 * nobody checks the shape of. The NAMES are the part that matters: a count
 * alone is satisfied by the same number of stalling cells at the wrong end of
 * the ladder, which is exactly the failure this whole block repairs.
 */
const REACHABLE_LADDER = {
  /**
   * Measured: session cells where an idle rep measurably stops. 12 of 22.
   *
   * WAS 5 BEFORE THE 2026-08-26 DIFFICULTY RETUNE, and the seven that arrived
   * are all four RPE 8 cells and the three RPE 9 and RPE 10 cells that used to
   * creep through their sticking point without ever dipping below
   * `GRIND_STALL_VELOCITY`. `RUNGS_THAT_STALL` below is what says the seven
   * landed at the right end of the ladder; this count on its own would be
   * satisfied by seven new stalling warm-ups, which is not a hypothetical —
   * a first pass at this retune produced exactly that and the table reported
   * `[x, 0, 0]` anyway, because `IDLE_FROM_TICKS` never sampled early enough
   * to see it.
   */
  SESSION_CELLS_THAT_STALL: 12,
  /** Measured: meet cells where an idle rep measurably stops. 18 of 18. */
  MEET_CELLS_THAT_STALL: 18,
  /**
   * Measured: the RPE rungs those session cells sit at, sorted.
   *
   * RPE 8 JOINED THIS LIST IN THE 2026-08-26 RETUNE AND THAT IS THE HEADLINE OF
   * THE WHOLE ROUND. The phone replay's complaint was that RPE 8 had no
   * difficulty in it; the rung is now the one where stopping the grind first
   * stops the bar. RPE 6 and 7 are still absent and the loop below is what
   * keeps them absent.
   */
  RUNGS_THAT_STALL: ['rpe10', 'rpe8', 'rpe9'] as readonly string[],
  /**
   * Session cells the warm-up control loop actually asserts on: RPE 6's five
   * and RPE 7's five.
   *
   * PINNED BECAUSE THE LOOP SKIPS EVERY RUNG ON `RUNGS_THAT_STALL`, so adding a
   * light rung to that list is a one-word edit that silently deletes the only
   * check standing between GDD §12.3's warm-up protection and a tuning pass
   * gone wrong. This count is what refuses that edit.
   */
  CELLS_THE_WARMUP_CONTROL_COVERS: 10,
  /**
   * The three cell counts GDD §6.2 quotes, of 40.
   *
   * PINNED HERE BECAUSE THE GDD QUOTES THEM. A number in the design document
   * with nothing behind it is the defect this whole round was sent back for,
   * one level out — and the first draft of that §6.2 paragraph got two of
   * these three wrong by reading them off the table by eye. They are counted
   * from `REACHABLE_RESCUE` so the document and the measurement cannot drift.
   *
   * All four moved in the 2026-08-26 retune: 31 -> 38, 23 -> 29, 23 -> 30, and
   * the control 8 -> 1. Part of that movement is the WIDENED sampling grid
   * rather than the tuning — `IDLE_FROM_TICKS` went from four offsets to eight
   * and `PAIRS_PER_CELL` from 80 to 160 — so these are not comparable to the
   * old numbers cell for cell, and that is said here rather than left for a
   * reader to assume otherwise.
   *
   * -------------------------------------------------------------------------
   * TWO OF THEM WENT DOWN IN THE 2026-08-27 WORKING-RUNG LEVER, 38 -> 35 AND
   * 29 -> 26, AND A FALLING COUNT HERE IS THE HARD DIRECTION SHOWING UP
   * -------------------------------------------------------------------------
   * These count cells where STOPPING AND STARTING AGAIN changes the outcome.
   * A cell drops out of them when the pause stops being survivable at all —
   * the idle rep still stalls, and coming back no longer saves it. Four meet
   * cells crossed that line, and they are the top of the ladder:
   * `meet/conservative/att3/wrecked`, `meet/standard/att3/wrecked`,
   * `meet/aggressive/att2/wrecked` and (already there before this lever)
   * `meet/aggressive/att3/wrecked`. `meet/aggressive/att3/rested` and
   * `meet/standard/att2/wrecked` are the two that only partly crossed it, at
   * 40 and 60 of 160.
   *
   * SO THE NUMBER TO READ BESIDE THESE IS `CELLS_WHERE_THE_IDLE_REP_STALLS`,
   * WHICH DID NOT MOVE: 30, exactly the 30 non-warm-up cells. A reader who saw
   * 38 -> 35 alone would conclude the grind had stopped deciding three cells;
   * what actually happened is that it decides them harder — the bar stops, and
   * at the very top of a meet it no longer comes back. That is what the
   * 2026-08-27 replay asked for and it is a real cost, so it is written down
   * rather than being left as a number that got smaller.
   */
  CELLS_WHERE_COMING_BACK_HELPS: 35,
  CELLS_WHERE_A_REP_IS_SAVED: 26,
  CELLS_WHERE_THE_IDLE_REP_STALLS: 30,
  /**
   * ...and the cells where none of the three happens.
   *
   * DOWN FROM 8 TO 1, AND WHAT THE ONE IS IS THE PART WORTH READING:
   * `session/rpe6/0.7500/as-expected`, the lightest load the lightest rung can
   * prescribe. It is the only place left where tapping decides literally
   * nothing. The seven that used to be here have NOT started stalling or losing
   * reps — every RPE 6 and 7 row is still `[flips, 0, 0]`, now measured on a
   * grid that reaches one tap after the command — they have started flipping
   * between a GOOD LIFT and a GRINDER, which is a grade changing and not a rep
   * being taken away.
   */
  CELLS_WHERE_NOTHING_MOVES: 1,
} as const;

/**
 * ---------------------------------------------------------------------------
 * THE WARM-UP SWEEP'S OWN PARAMETERS, IN ONE PLACE
 * ---------------------------------------------------------------------------
 * `streakSweep.ts`'s shape, for `streakSweep.ts`'s reason: the first version of
 * a measurement like this was reported with its seeds unstated and could not
 * afterwards be reproduced. Every number the warm-up guard sweeps over lives
 * here so a re-take is a re-run rather than a reconstruction.
 *
 * THE CLAIM WAS NARROWED ON 2026-08-26, AND SAYING SO IS THE POINT OF THIS
 * PARAGRAPH so nobody reads the sentence below as the one it replaces. It used
 * to end "at any instant they stop and at any cadence they were tapping" — two
 * axes quantified over, while a third was held at a single value and never
 * named. Every rep in the sweep carried the bar down with the finger held. A
 * player who lets go on the way down is playing a case the guarantee sounded
 * like it covered and the sweep had never generated.
 *
 * HOW BLIND, AS A NUMBER RATHER THAN AS A CHARACTERISATION: raising
 * `BENCH_TOUCH_DEMAND_PENALTY` tenfold — the only constant a bad descent is
 * charged through — did not move the held sweep off its zero at all. A knob
 * with no effect on a sweep is a knob the sweep does not cover, and that is a
 * mechanical test anyone can re-run rather than a judgement about wording.
 *
 * WHAT THE GUARD THESE PARAMETERS FEED ACTUALLY CLAIMS: a warm-up rep the
 * player answered at all cannot be lost BY STOPPING — at any instant they stop
 * and at any cadence they were tapping — provided the bar was carried down
 * under control. Letting go on the way down is a different mistake with its own
 * price, and at every warm-up load but the lightest that price includes the
 * rep. That is GDD §12.3's warm-up protection as a swept property rather than
 * as a row of zeros in a sampled table, and the sampled table is what let it
 * break once already.
 * `@guarantee a-warm-up-survives-being-abandoned`
 */
const REACHABLE_WARMUP = {
  /** RPE 6 and 7 cells `prescribeSession` can emit, deduped. */
  CELLS: 10,
  /** Cadences the quitting player taps at before they stop: 15, 10 and 6 a second. */
  GAP_TICKS: [4, 6, 10] as const,
  /**
   * The last tick after the command at which the player may quit.
   *
   * PAST `ASCENT_TIMEOUT_TICKS` (170) ON PURPOSE — a quit instant beyond the
   * longest possible ascent is a rep that was never abandoned at all, so the
   * sweep runs off the end of the domain rather than stopping inside it and
   * leaving a reader to wonder what is past the edge.
   */
  MAX_QUIT_TICK: 180,
  /** Seeds per (cell, cadence, quit instant). The seed moves only the command tick. */
  SEEDS: 3,
  /**
   * The instant the non-vacuity arm abandons at, and it is the EARLIEST one —
   * the cheapest possible answer, one tap and stop.
   */
  NON_VACUITY_QUIT_TICK: 2,
  /**
   * Measured: RPE 8 reps lost to that same abandonment, out of `SEEDS` per cell
   * across four cells. NON-ZERO IS THE POINT — it is what says the zero above
   * is a fact about the warm-up rungs and not about a schedule too gentle to
   * lose anything anywhere.
   */
  RPE8_LOST_AT_THE_SAME_INSTANT: 12,
  /**
   * -------------------------------------------------------------------------
   * THE SECOND AXIS, AND IT IS HERE BECAUSE ITS ABSENCE MADE THE ZERO ABOVE
   * READ AS A GUARANTEE IT NEVER WAS
   * -------------------------------------------------------------------------
   * Every rep in the sweep above holds the finger down through the descent.
   * That is the correct play, and for a whole round it was also the ONLY play
   * the sweep contained — so `lost === 0` was a fact about one column of a
   * two-column domain while the prose beside it said "at any instant they stop
   * and at any cadence they were tapping", which names two axes and quantifies
   * over a third that was pinned to a single value.
   *
   * HOW BLIND IT WAS, MEASURED RATHER THAN CHARACTERISED: raising
   * `BENCH_TOUCH_DEMAND_PENALTY` from 0.15 to 1.5 — a tenfold rise in the only
   * constant the descent's cost is charged through — leaves this sweep reading
   * 0 of 16200. A knob with no effect on a sweep is a knob the sweep does not
   * cover.
   *
   * These are ticks after DESCENT opens, not after the press: the press lands
   * in BRACE and a release before the descent starts is swallowed by the
   * phase. The first probe written for this counted from tick 1, read
   * `touchQuality` 1.000 at every load, and reported no finding.
   */
  SLIP_TICKS: [4, 16, 28, 40] as const,
  /**
   * Measured: warm-up reps lost with the finger off, per cell, in the order
   * `reachableSessionCells()` emits them. The domain is the same whole quit
   * sweep as the held arm, once per entry in `SLIP_TICKS`.
   *
   * NINE OF TEN CELLS LOSE REPS AND THAT IS THE HONEST STATEMENT OF THE
   * MECHANIC, not a defect this pass left standing. There is no value of
   * `BENCH_TOUCH_DEMAND_PENALTY` that empties this list and leaves the descent
   * deciding anything, against `bench-touch-decides-the-rep`'s 240 cases — on
   * a coarser six-slip ladder of 4860 reps, RE-TAKEN after the warm-up floor
   * landed rather than carried across it:
   *
   *     0.15 shipped  1785 lost / 120 flips      0.10  1164 / 100
   *     0.05           423 / 40                  0.02     0 / **0**
   *     0.00             0 / **0**
   *
   * THE 0.02 ROW CHANGED CHARACTER WHEN THE FLOOR LANDED, WHICH IS WHY THESE
   * WERE RE-RUN RATHER THAN COPIED. Before the floor it read "270 lost", and
   * the sentence above leaned on exactly that: no penalty emptied the column.
   * Now 0.02 DOES empty it — and the claim survives anyway, because the descent
   * decides nothing there either. Carried across instead of re-taken, this
   * docstring would have shipped a row that was false of its own tree, which is
   * the defect the two rounds before this one spent their length removing from
   * three other places.
   *
   * HOW MANY OF THESE ARE ZERO IS A LITERAL IN THE BODY AND HAS NO CONSTANT
   * HERE, ON PURPOSE. It had one, and that version was DOMINATED by the equality
   * against this array: given the array matches, the number of zeros in it is
   * already decided, so no state of the lift engine could redden the count while
   * leaving the array green. A literal survives a wholesale RE-PIN of the array
   * — a future round pasting in a new vector with three zeros passes the
   * equality and fails the literal — which is the one failure an equality cannot
   * notice about itself. Same idiom as `TOUCH_SWEEP.OUTCOME_CASES`, same reason.
   */
  LOST_WITH_THE_FINGER_OFF: [180, 0, 492, 420, 432, 510, 150, 1026, 1008, 906] as const,
  /**
   * Measured: warm-up cells where SOME entry in `SLIP_TICKS` lands the bar at
   * touch quality exactly 0 — fully crashed, not merely degraded.
   *
   * THE ARITHMETIC HALF, AND IT IS THE ONE THAT DOES NOT DEPEND ON THE GRID.
   * The per-cell losses above are taken over a slip ladder and a quit ladder;
   * this is a property of `touchSpeedQuality` at the loads `prescribeSession`
   * actually emits, so a finer grid cannot move it. It is the number that
   * refutes the shipped claim that a warm-up bar "cannot be crashed at all" —
   * that was derived at `LOAD_PRESETS.LIGHT`, 0.55, twenty points below the
   * lightest load any session prescribes.
   */
  CELLS_A_SLIP_FULLY_CRASHES: 10,
  /**
   * Measured: warm-up cells where EVERY entry in `SLIP_TICKS` fully crashes.
   *
   * ZERO, AND IT IS PINNED BECAUSE IT IS THE HALF THAT SOUNDS WRONG. A slip is
   * not punished uniformly: the later the finger comes off, the less descent
   * the bar has left to accelerate through, so the worst rung of the ladder is
   * the earliest one and the last rung is survivable at every warm-up load.
   * `LADDER_STRICT_RISES` says the same thing from the other end.
   *
   * Pinning it beside the count above is what stops that count being read as
   * "a slip always crashes a warm-up" — the same over-reading the sentence it
   * replaces committed in the opposite direction.
   */
  CELLS_EVERY_SLIP_CRASHES: 0,
  /** Seeds per cell in the never-answered arm. The seed moves the command tick. */
  NO_ANSWER_SEEDS: 8,
  /**
   * The deepest point in a session a rep can be taken at, as `LiftMoment`.
   *
   * THE FOURTH AXIS, AND IT WAS UNSWEPT WHILE A COMMENT NEARBY CLAIMED THERE
   * WAS NOWHERE LEFT TO HIDE. `moment` narrows `PRESS_LAUNCH_MS` by roughly a
   * tenth — the launch beat tightens as the session wears on — and every other
   * bench sweep in this file leaves it undefined, so they all measure the
   * WIDEST launch window the game ever gives. A guarantee about warm-ups that
   * only holds on the first rep of the first set is not the guarantee anyone
   * means.
   *
   * A full moment sweep is not run here: the axis is monotone in the direction
   * that matters (later is tighter), so the deepest reachable point is the
   * worst case, and driving the worst case is what a floor claim needs. The
   * session prescribes three work sets of three reps, so the last rep of the
   * last set has two of each behind it.
   */
  DEEPEST_MOMENT: { workSetsCompleted: 2, repsCompletedInSet: 2 } as const,
  /**
   * -------------------------------------------------------------------------
   * THE HOLE THIS BLOCK USED TO RECORD, AND THE RULING THAT CLOSED IT
   * -------------------------------------------------------------------------
   * Two constants stood here — `NO_ANSWER_KEPT_ON_A_HELD_DESCENT: 72` and
   * `CELLS_LOSING_THE_UNANSWERED_REP: 1` — measuring a player who carried a
   * warm-up bar down properly, never answered the command, and lost the rep at
   * `session/rpe7/0.8250/as-expected` on every seed. They were pinned rather
   * than fixed, with both readings of GDD §12.3 written out and the trade left
   * to a human, because closing it looked like it needed the difficulty pass
   * reverted.
   *
   * RULED 2026-08-26, AND BOTH CHEAP ESCAPES WERE REFUSED. Verbatim: "Never
   * answering PRESS! on a held descent must still make every RPE 6 and RPE 7
   * cell, including rpe7/0.8250. That is §12.3 warm-up protection, not a
   * nicety. +0.02 stays on RPE 8 / 9 / 10 and meet." Not a smaller step — that
   * restores the curve the phone replay rejected. And not "that cell costs the
   * rep" — that is calling a warm-up a working set so a global step size can
   * stay dumb.
   *
   * SO THE COUNT IS A ZERO IN THE BODY NOW, not a constant here, and it is
   * asserted against `CELLS * NO_ANSWER_SEEDS` with the offending cells named
   * in the message. `BENCH_WARMUP_FLOOR_MARGIN` is what closed it and
   * `WORKING_CELLS` below is what stops the closure from being a global clock
   * bump. The two deleted constants are described rather than kept because a
   * pin at 72 would now be a pin on a defect that no longer exists.
   */
  /**
   * Working-rung cells the ladder can prescribe, and why they are counted here
   * rather than left to the rescue table.
   *
   * A WARM-UP LOWERED UNDER CONTROL GOES UP EVEN IF THE PLAYER NEVER ANSWERS
   * THE COMMAND, AND A WORKING RUNG DOES NOT. Both halves are the guarantee.
   * The clock may not be what decides a bar the lifter is comfortably stronger
   * than; and the floor that arranges this may not reach a rung the phone
   * replay asked to stay hard. If the count taken over these cells ever goes
   * quiet, the floor has spread into the grind rather than protecting the
   * warm-up, and the zero beside it stops meaning anything.
   * `@guarantee a-warm-up-makes-it-unanswered`
   */
  WORKING_CELLS: 12,
  /**
   * Measured: unanswered warm-up reps kept after the finger ALSO came off, out
   * of `CELLS * NO_ANSWER_SEEDS * SLIP_TICKS.length`.
   *
   * THE PRICE OF DOING BOTH THINGS WRONG, AND THE FLOOR ONLY PAYS PART OF IT.
   * Carrying the bar down is worth the whole rung now — that is the zero in the
   * body — and letting it go as well is covered by nothing.
   *
   * IT READS 88, WHICH IS ALSO WHAT THE PRE-RETUNE CURVE READ, and the equality
   * is recorded as a COINCIDENCE OF COUNTS rather than as a claim: the floor
   * hands back clock headroom on the same axis the +0.02 took it from, so
   * landing on the old number is plausible — but nobody has checked it is the
   * same 88 REPS, and this file does not get to imply that it is. It read 40
   * between the two, and that reading is what says the floor moved this at all.
   */
  NO_ANSWER_KEPT_AFTER_A_SLIP: 88,
} as const;

/**
 * ---------------------------------------------------------------------------
 * THE CRASH-PENALTY COMPARISON'S OWN PARAMETERS, BECAUSE PROSE IS NOT A DOMAIN
 * ---------------------------------------------------------------------------
 * `DEMAND_BASE.bench`'s header and GDD §6.2 both carry a five-row table
 * comparing warm-up losses across `BENCH_TOUCH_DEMAND_PENALTY`, and its domain
 * was described in prose as "a coarser slip ladder, six release instants
 * against four". THAT IS NOT A PARAMETERISATION. A reader can reach exactly
 * 4860 reps by many different routes and get a different answer down each one,
 * which is the failure `streakSweep.ts` exists for: a measurement whose inputs
 * are not written down is an anecdote, however carefully it was taken.
 *
 * The numbers were right — every row re-derived unchanged when these constants
 * were written — and they were unreproducible by anyone but their author, which
 * is a defect on its own and is the one being fixed here.
 *
 * ONLY THE SHIPPED ROW IS DRIVEN IN-TREE. The other four need a different value
 * of a frozen constant, so they stay in the header as counterfactuals; what
 * this domain makes reproducible is the row the argument rests on and the grid
 * every row was taken over.
 */
const PENALTY_DOMAIN = {
  /** Ticks after DESCENT opens at which the finger comes off. `null` holds it. */
  SLIPS: [null, 1, 4, 10, 20, 34] as const,
  /** Cadences the quitting player taps at: 15, 10 and 6 a second. */
  GAP_TICKS: [4, 6, 10] as const,
  /** Quit instants, in ticks after the command. Coarse on purpose — this is a
   * comparison ACROSS TUNINGS, not the shipped measurement, which is
   * `REACHABLE_WARMUP`'s whole-quit sweep. */
  QUIT_TICKS: [1, 2, 4, 8, 16, 32, 64, 128, 180] as const,
  /** Seeds per (cell, slip, cadence, quit). The seed moves the command tick. */
  SEEDS: 3,
  /** Measured: the product of the parameters above and `REACHABLE_WARMUP.CELLS`. */
  CASES: 4860,
  /**
   * Measured at the shipped `BENCH_TOUCH_DEMAND_PENALTY` on the shipped tree,
   * warm-up reps lost. The other rows of the header's table, for reference and
   * NOT driven here: 0.10 -> 1164, 0.05 -> 423, 0.02 -> 0, 0.00 -> 0, against
   * `bench-touch-decides-the-rep`'s 120 / 100 / 40 / 0 / 0 outcome flips.
   */
  SHIPPED_LOST: 1785,
} as const;

/**
 * ---------------------------------------------------------------------------
 * THE WORKING-RUNG LEVER'S OWN SWEEP PARAMETERS, IN ONE PLACE
 * ---------------------------------------------------------------------------
 * `streakSweep.ts`'s shape and `REACHABLE_WARMUP`'s reason: the tap floors this
 * round exists to move were reported once before at a grain too coarse to see
 * them — GDD §6.2 records that correction — and a measurement whose inputs are
 * not written down is an anecdote.
 *
 * WHAT A "FLOOR" IS HERE, EXACTLY. The largest tap GAP (slowest cadence) at
 * which every seed still makes the rep, walking gaps upward from
 * `FASTEST_GAP_TICKS` and stopping at the first gap where any seed misses. So
 * it is the slowest sustained rate that never misses, and the ladder is every
 * whole tick rather than a hand-picked list: at the slow end that is a
 * resolution of about 0.004 taps a second, and at the fast end it is the
 * finest the input can express at all, because `GRIND_TAP_REFRACTORY_TICKS`
 * quantises a cadence to whole ticks.
 *
 * `FASTEST_GAP_TICKS` IS THE REFRACTORY PERIOD AND NOT A ROUND NUMBER: a gap
 * below it is a cadence the engine cannot count, so the ladder would be
 * measuring the harness. `SLOWEST_GAP_TICKS` is past the longest ascent any
 * bench rep can have, so a cell that never misses runs off the end of the
 * domain rather than stopping inside it.
 */
const WORKING_FLOOR = {
  /** Seeds per (cell, cadence). The seed moves the command tick and nothing else. */
  SEEDS: 20,
  /** The fastest cadence the input can express: `GRIND_TAP_REFRACTORY_TICKS`. */
  FASTEST_GAP_TICKS: 3,
  /** Past any reachable ascent, so "never misses" runs off the end. */
  SLOWEST_GAP_TICKS: 240,
  /**
   * Measured: the floor at each of the 22 session cells, in TICKS BETWEEN TAPS,
   * in `reachableSessionCells()` order. `SLOWEST_GAP_TICKS` means the cell
   * never missed at any cadence the ladder reached — which is every RPE 6 and
   * RPE 7 cell, before this lever and after it.
   *
   * -------------------------------------------------------------------------
   * THE ROW THIS ROUND IS ABOUT IS THE RPE 8 ONE, AND IT IS PINNED BESIDE WHAT
   * IT REPLACED
   * -------------------------------------------------------------------------
   * As taps a second (`60 / gap`), before the 2026-08-27 working-rung lever
   * against after:
   *
   *     rpe8/0.8000/slower-than-expected   0.48  ->  1.02
   *     rpe8/0.8500/as-expected            0.86  ->  1.62
   *     rpe8/0.8750/crisp                  0.67  ->  1.36
   *     rpe8/0.9000/popping                0.53  ->  1.03
   *     rpe9,  the four cells              1.05 0.. ->  1.82 2.40 2.14 2.00
   *     rpe10, the four cells              2.61 ..  ->  3.53 3.33 3.16 3.00
   *
   * A phone replay called RPE 8 "way too easy" twice; a tap every 1.2 to 2.1
   * seconds still made the rep, which is why. It is now a tap every 0.6 to 1.0
   * seconds, sustained, and the rungs above moved with it.
   *
   * PINNED AS THE WHOLE VECTOR RATHER THAN AS A MINIMUM. A bound is satisfied
   * by a ladder that collapsed at one end, and this table's whole job is to say
   * the rungs are still ordered — which the test asserts separately, from this
   * vector, so the ordering cannot be true of a table nobody drove.
   */
  SESSION_FLOOR_GAP_TICKS: [
    240, 240, 240, 240, 240,
    240, 240, 240, 240, 240,
    59, 37, 44, 58,
    33, 25, 28, 30,
    17, 18, 19, 20,
  ] as const,
  /**
   * Measured: the same, for the 18 meet cells in `reachableMeetCells()` order.
   *
   * THE CEILING CELL IS THE LAST ONE AND IT DID NOT MOVE, WHICH IS THE POINT OF
   * `BENCH_WORKING_RUNG_DEMAND_MARGIN_CEILING`. `meet/aggressive/att3/wrecked`
   * reads 6 ticks — 10.00 taps a second — with this lever and without it,
   * because its base margin is already past the ceiling and the lever adds it
   * exactly nothing. An earlier pass without that ceiling took it to 3 ticks,
   * which is `GRIND_TAP_REFRACTORY_TICKS` itself: the hardest attempt in the
   * game winnable only by a perfect mash with no headroom at all.
   */
  MEET_FLOOR_GAP_TICKS: [
    18, 16, 13, 18, 14, 10, 18, 11, 8,
    12, 10, 8, 12, 9, 8, 12, 8, 6,
  ] as const,
  /**
   * Measured: session cells whose floor is `SLOWEST_GAP_TICKS` — no cadence the
   * ladder reaches ever costs them the rep. Exactly the ten warm-up cells.
   *
   * THE NON-VACUITY GUARD FOR THE VECTOR ABOVE, and it is a set equality in
   * disguise: 10 of 22, and the test names WHICH ten. A count alone is
   * satisfied by ten working cells going quiet, which is the failure the
   * whole round is scoped against.
   */
  CELLS_NO_CADENCE_COSTS: 10,
} as const;

/**
 * ---------------------------------------------------------------------------
 * THE TWO EDGES THE BENCH WARM-UP FLOOR RESTS ON, WHICH WERE CLAIMED AS PINNED
 * AND WERE NOT
 * ---------------------------------------------------------------------------
 * `BENCH_WARMUP_FLOOR_MARGIN` and `BENCH_WARMUP_FLOOR_ASCENT_TICKS` both say in
 * their own docstrings that "`lift.test.ts` pins BOTH EDGES" and that "a retune
 * that closes the gap reddens there". IT DID NOT. Before this round no test in
 * this file — or anywhere in `src/` — mentioned -0.0483, -0.0323, 193 or 247,
 * and the only margin either constant was compared against was the other one.
 * That is CLAUDE.md's most-recorded failure class landing on the pair of
 * constants whose whole justification is "a gap somebody measured", and the
 * 2026-08-27 ruling asked for both edges to be re-pinned against the new curve,
 * which is only possible if they are pinned at all.
 *
 * THE SECOND EDGE CHANGED CHARACTER AND IS NOT A DURATION ANY MORE. Measured
 * with both clocks lifted out of the way — the method
 * `BENCH_WARMUP_FLOOR_ASCENT_TICKS` names — an unaided bench rep at the shipped
 * tuning used to reach lockout at two of the twelve working cells, at 247 and
 * 256 ticks, against 87..193 for the warm-ups. With the working-rung lever the
 * working side reaches lockout at NONE of the twelve: those reps are beaten on
 * force rather than on the clock, so they go backwards instead of creeping.
 * The gap did not close; it stopped being finite on one side. That is a wider
 * separation than the one the constant was chosen from, and it is written down
 * as a change of kind rather than a bigger number, because the docstring's
 * "fastest working-rung completion 247 ticks" is now a sentence about a rep
 * that does not exist.
 */
const FLOOR_EDGES = {
  /**
   * Measured: the LEAST negative `peakDemand - capacity` any RPE 6 or RPE 7
   * cell reaches, on the BASE curve. `session/rpe7/0.8250/as-expected`.
   */
  WARMUP_HARDEST_MARGIN: -0.0483,
  /**
   * Measured: the MOST negative that any working-rung or meet cell reaches, on
   * the same curve. `session/rpe8/0.8000/slower-than-expected`.
   */
  WORKING_EASIEST_MARGIN: -0.0323,
  /**
   * Measured: the longest unaided ascent, in ticks to lockout, at any warm-up
   * cell with the clock lifted. `session/rpe7/0.8250/as-expected` again, which
   * is the cell the whole 2026-08-26 ruling was about.
   *
   * DRIVEN UNDER THE SHIPPED FLOOR CLOCK RATHER THAN A LIFTED ONE, because 193
   * is under 220 and the two runs are therefore the same rep — the floor's own
   * docstring says a rep that reaches lockout on its own is byte-identical with
   * the floor and without it. Lifting the clock is only needed on the side that
   * no longer completes, and that side is asserted as a category below.
   */
  WARMUP_SLOWEST_UNAIDED_ASCENT_TICKS: 193,
  /** Measured: working-rung cells whose unaided rep reaches lockout. None. */
  WORKING_CELLS_THAT_COMPLETE_UNAIDED: 0,
  /**
   * Measured: reachable cells the BASE demand curve already puts at or past
   * `BENCH_WORKING_RUNG_DEMAND_MARGIN_CEILING`, so the working-rung lever adds
   * them nothing and they are byte-identical with it and without it.
   *
   * ONE, AND WHICH ONE IS THE WHOLE VALUE OF THIS ENTRY. `meet/aggressive/
   * att3/wrecked` is the ceiling of the game — GDD §6.2 calls it "the one row
   * where coming back does not help at all" — and it is the cell where the
   * false-start rule ALREADY fails on the shipped tree, before this lever
   * existed. Pinning the list rather than a count is what stops a future
   * retune quietly pushing a second cell past the ceiling and reading the
   * unchanged count as evidence that nothing moved.
   */
  CELLS_ALREADY_PAST_THE_CEILING: ['meet/aggressive/att3/wrecked'] as readonly string[],
} as const;

const REACHABLE_COUPLING = {
  /** The three cues that share a rung's upper half, in improving order. */
  IMPROVING_CUES: ['as-expected', 'crisp', 'popping'] as const,
  /**
   * Measured: RPE rungs where the margin FALLS strictly from the hardest
   * `as-expected` cell through `crisp` to `popping`. All five.
   */
  RUNGS_WHERE_A_BETTER_CHECK_IN_IS_EASIER: 5,
  /**
   * Measured: RPE rungs where `popping` — the best check-in there is — is the
   * HARDEST cell of the rung. None.
   */
  RUNGS_WHERE_PRIMED_IS_HARDEST: 0,
  /**
   * Measured: RPE rungs where `slower-than-expected` is the hardest cell.
   *
   * ONE, AND IT IS THE TOP ONE, which is the half of the coupling that is not
   * a straight line. A poor check-in cuts the prescribed load AND the lifter's
   * capacity; below RPE 10 the load cut is the bigger of the two, so a poor
   * day is an EASIER rep than a neutral one, and the hardest cell on the rung
   * is `as-expected`. At RPE 10 the ladder's own rounding puts the poor cell
   * at 0.8750 against a capacity of 0.940 and it becomes the hardest.
   */
  RUNGS_WHERE_A_POOR_CHECK_IN_IS_HARDEST: 1,
} as const;

describe('the grind curve', () => {
  // ---------------------------------------------------------------------------
  // THE TESTS THE FIRST VERSION OF THE PRESS BEAT DID NOT HAVE, AND THE REASON
  // IT SHIPPED BROKEN.
  //
  // The original block asserted that the reaction set the bar's velocity off
  // the chest. It did — 0.019 against 0.0004 at ascent tick 1 — and it meant
  // nothing, because velocity chases net force and an initial value washes out
  // in about `1/VELOCITY_RESPONSE` ticks. Eight mutants passed on that version.
  // Every one tested a mechanism and not one asked whether the REP CHANGED.
  // So the sweeps below assert outcomes.
  // ---------------------------------------------------------------------------

  it('never falls as charge is added, stays inside 0..1, and MOVES', () => {
    // ALL THREE FACTS OF THE PROGRESSION RULE, named. A constant satisfies the
    // first two trivially and is exactly the defect: more samples of a
    // constant is still a constant.
    const { CEILING } = LIFT_TUNING.GRIND_CHARGE;
    let previous = -1;
    const distinct = new Set<number>();
    for (let step = 0; step <= (CEILING + 2) * 10; step += 1) {
      const force = grindForce(step / 10);
      expect(force, `charge ${step / 10}`).toBeGreaterThanOrEqual(previous);
      expect(force, `charge ${step / 10}`).toBeGreaterThanOrEqual(0);
      expect(force, `charge ${step / 10}`).toBeLessThanOrEqual(1);
      previous = force;
      distinct.add(force);
    }
    // Fact 3. One value per rung up to the ceiling, plus 0, and the flat top
    // collapses every over-ceiling rung onto one.
    expect(distinct.size, `${distinct.size} distinct forces`).toBe(CEILING * 10 + 1);
    expect(grindForce(0)).toBe(0);
    expect(grindForce(CEILING)).toBe(1);
  });

  it('has a knee: the marginal unit of charge is worth strictly less every rung', () => {
    // DIMINISHING RETURNS AS A PROPERTY OF EVERY RUNG, not of two endpoints.
    // A line with a cap has the same endpoints and no knee, and it is the
    // shape neither the ruling's "as much force as possible" nor the steer's
    // "continuously tap" is asking for.
    const { CEILING } = LIFT_TUNING.GRIND_CHARGE;
    const gains: number[] = [];
    for (let step = 1; step <= CEILING * 10; step += 1) {
      gains.push(grindForce(step / 10) - grindForce((step - 1) / 10));
    }
    for (let i = 1; i < gains.length; i += 1) {
      expect(gains[i] ?? 0, `gain at charge ${(i + 1) / 10}`).toBeLessThan(gains[i - 1] ?? 0);
    }
    // ...and the knee is steep enough to be a knee rather than a slope. Pinned
    // as a ratio so a retune that flattens the curve into a line reddens here
    // rather than passing the monotonicity check above.
    const first = gains[0] ?? 0;
    const last = gains[gains.length - 1] ?? 1;
    expect(first / last, `first gain / last gain = ${first / last}`).toBeGreaterThan(8);
  });

  it('caps: charge past the ceiling buys nothing at all', () => {
    const { CEILING } = LIFT_TUNING.GRIND_CHARGE;
    for (let extra = 1; extra <= 40; extra += 1) {
      expect(grindForce(CEILING + extra), `+${extra}`).toBe(1);
    }
    // ...and it refuses nonsense rather than trusting its caller.
    expect(grindForce(Number.NaN)).toBe(0);
    expect(grindForce(-4)).toBe(0);
  });

  it('decays toward nothing when no tap lands, and rises when one does', () => {
    // THE PROPERTY THAT MAKES THE CHARGE A RATE. A total would satisfy "rises
    // when a tap lands" and never fall, and the whole steer rests on the fall:
    // it is what turns idle hands into a stall.
    let charge = 0;
    for (let i = 0; i < 10; i += 1) charge = grindChargeNext(charge, true);
    expect(charge, 'the charge never rose').toBeGreaterThan(1);
    const peak = charge;
    let ticks = 0;
    while (charge > peak / 8 && ticks < 200) {
      charge = grindChargeNext(charge, false);
      ticks += 1;
    }
    // Three half-lives, so this is arithmetic about the declared constant
    // rather than a second copy of it — and it is pinned as a count so a decay
    // that stopped decaying reports itself.
    expect(ticks, `${ticks} ticks to fall to an eighth`).toBe(21);
    expect(grindChargeNext(0, false)).toBe(0);
  });

  it('cannot grade a quality "early" or "late", and that is checked rather than asserted', () => {
    // A comment claiming a grade is unreachable is exactly the sentence
    // CLAUDE.md has caught being false eight times. Swept instead, over BOTH
    // readings' graders — which are the same function, and that is the point:
    // when the touch was graded by an inline ternary against the burst's
    // table, this sweep covered one of the two and read as covering both.
    const seen = new Set<string>();
    for (let step = -10; step <= 110; step += 1) seen.add(qualityGrade(step / 100));
    expect(seen.has('early')).toBe(false);
    expect(seen.has('late')).toBe(false);
    // ...and the sweep is not vacuous: it reaches the other three.
    for (const grade of ['perfect', 'good', 'missed']) {
      expect(seen.has(grade), `grade ${grade} unreachable in the sweep`).toBe(true);
    }
  });
});

describe('the grind decides the lift', () => {
  it('flips outcomes across the tap ladder, across the sweep [bench-grind-decides-the-rep]', () => {
    let cases = 0;
    let mashVsNone = 0;
    let mashVsSparse = 0;
    let moderateVsNone = 0;
    let makeToMiss = 0;
    for (let seed = 1; seed <= GRIND_SWEEP.SEEDS; seed += 1) {
      for (const load of GRIND_SWEEP.LOADS) {
        const mash = benchGrindRep(load, seed, { gapTicks: GRIND_SWEEP.MASH_GAP_TICKS });
        const moderate = benchGrindRep(load, seed, { gapTicks: GRIND_SWEEP.MODERATE_GAP_TICKS });
        const sparse = benchGrindRep(load, seed, { gapTicks: GRIND_SWEEP.SPARSE_GAP_TICKS });
        const none = benchGrindRep(load, seed, { gapTicks: GRIND_SWEEP.NONE });
        cases += 1;
        if (mash.resolution?.outcome !== none.resolution?.outcome) mashVsNone += 1;
        if (mash.resolution?.outcome !== sparse.resolution?.outcome) mashVsSparse += 1;
        if (moderate.resolution?.outcome !== none.resolution?.outcome) moderateVsNone += 1;
        if (mash.resolution?.outcome !== 'miss' && none.resolution?.outcome === 'miss') {
          makeToMiss += 1;
        }
      }
    }
    // Counts, not bounds — an empty or collapsed domain reports itself. The
    // literal pins the domain the counts below are taken OVER, so a sweep
    // narrowed to fewer loads or seeds reddens rather than re-pinning itself.
    expect(GRIND_SWEEP.CASES, 'the domain these counts are taken over').toBe(120);
    expect(cases).toBe(GRIND_SWEEP.CASES);
    // ...and the ladder really does run to what a meet can call, rather than
    // stopping inside the band or running past it into a preset.
    expect(GRIND_SWEEP.LOADS[GRIND_SWEEP.LOADS.length - 1]).toBe(GRIND_SWEEP.TOP_LOAD);
    expect(GRIND_SWEEP.TOP_LOAD).toBe(REACHABLE.MEET_LOAD_CEILING);
    expect(
      mashVsNone,
      `mashing changed the outcome in ${mashVsNone} of ${cases} cases`,
    ).toBe(GRIND_SWEEP.MASH_VS_NONE_FLIPS);
    expect(
      mashVsSparse,
      `mashing beat a sparse grind in ${mashVsSparse} of ${cases} cases`,
    ).toBe(GRIND_SWEEP.MASH_VS_SPARSE_FLIPS);
    expect(
      moderateVsNone,
      `a moderate grind changed the outcome in ${moderateVsNone} of ${cases} cases`,
    ).toBe(GRIND_SWEEP.MODERATE_VS_NONE_FLIPS);
    expect(
      makeToMiss,
      `${makeToMiss} of ${cases} flips are a make becoming a miss`,
    ).toBe(GRIND_SWEEP.MASH_MAKE_TO_NONE_MISS);
  });

  it('rescues a stalled bar across every load the game can prescribe [a-stalled-bench-can-be-ground-through]', () => {
    // ---------------------------------------------------------------------
    // THE STEER'S OWN SENTENCE, AS A PAIRED COUNT PER REACHABLE CELL.
    // "Grind through" means a stall that continued tapping can rescue, and
    // idle hands losing a rep that taps would have saved.
    //
    // WHAT MAKES THIS DIFFERENT FROM THE TAP LADDER ABOVE. The ladder measures
    // whether tapping HARDER is better, and a burst mechanic passes that
    // easily. This measures whether tapping LATER — after the launch beat is
    // long over, and in the heavy rows after the bar has already stopped — is
    // worth anything, which on a burst is worth exactly nothing.
    //
    // AND WHAT MAKES IT DIFFERENT FROM ITS OWN FIRST VERSION: the cells come
    // from `prescribeSession` and the meet's jump ladder rather than from
    // `LOAD_PRESETS`. See `REACHABLE`'s header for the measurement that put
    // them there.
    // ---------------------------------------------------------------------
    const cells = [...reachableSessionCells(), ...reachableMeetCells()];
    expect(
      cells.filter((c) => c.label.startsWith('session/')).length,
      'distinct session cells',
    ).toBe(REACHABLE.SESSION_CELLS);
    expect(
      cells.filter((c) => c.label.startsWith('meet/')).length,
      'meet cells',
    ).toBe(REACHABLE.MEET_CELLS);

    const measured: Record<string, RescueRow> = {};
    let unanimousCells = 0;
    for (const cell of cells) {
      let rescued = 0;
      let fromMiss = 0;
      let stalled = 0;
      const answers = new Set<string>();
      for (const from of REACHABLE.IDLE_FROM_TICKS) {
        const perFrom: string[] = [];
        for (let seed = 1; seed <= REACHABLE.SEEDS; seed += 1) {
          const config: LiftConfig = {
            kind: BENCH,
            loadRatio: cell.loadRatio,
            seed,
            feel: cell.feel,
          };
          const quiet = driveGrind(
            config,
            REACHABLE.GAP_TICKS,
            from,
            Number.POSITIVE_INFINITY,
          );
          const resumed = driveGrind(
            config,
            REACHABLE.GAP_TICKS,
            from,
            REACHABLE.IDLE_SPAN_TICKS,
          );
          const flipped = quiet.resolution?.outcome !== resumed.resolution?.outcome;
          const savedARep =
            quiet.resolution?.outcome === 'miss' && resumed.resolution?.outcome !== 'miss';
          // THE NON-VACUITY GUARD WITH TEETH: `stallTicks` counts ascent ticks
          // under `GRIND_STALL_VELOCITY`, so this is the mechanic's own
          // definition of a bar that stopped rather than a proxy for one.
          const reallyStalled = quiet.resolution !== null && quiet.resolution.stallTicks > 0;
          if (flipped) rescued += 1;
          if (savedARep) fromMiss += 1;
          if (reallyStalled) stalled += 1;
          perFrom.push(`${flipped}|${savedARep}|${reallyStalled}`);
        }
        answers.add(perFrom.join(','));
      }
      // THE SEED AXIS IS A CONTROL, NOT A DOMAIN. The seed decides WHEN the
      // command fires and nothing else; both reps of a pair are driven against
      // that tick, so a pair's answer cannot depend on it. GDD §8.1 — a rescue
      // that worked on some seeds and not others would be a dice roll on the
      // rep. Counted per cell, so a cell that started depending on the seed
      // says which one.
      if (new Set([...answers].map((a) => new Set(a.split(',')).size)).size === 1) {
        unanimousCells += 1;
      }
      measured[cell.label] = [rescued, fromMiss, stalled];
    }

    // THE DOMAIN, AS A LITERAL, so a producer that stopped producing cells
    // reddens here rather than re-pinning itself silently.
    expect(cells.length, 'the domain these counts are taken over').toBe(40);
    expect(REACHABLE.PAIRS_PER_CELL).toBe(
      REACHABLE.IDLE_FROM_TICKS.length * REACHABLE.SEEDS,
    );
    // ...and the table is set-equal to the cells in BOTH directions, so a cell
    // that appeared or disappeared is a red test rather than a silent gap.
    // A COLLISION GUARD BEFORE THE SET EQUALITY, because a record keyed on a
    // label that is not unique loses rows quietly and the set equality below
    // would then compare two equally-wrong lists.
    expect(Object.keys(measured).length, 'cells that reached the table').toBe(cells.length);
    expect(Object.keys(measured).sort()).toEqual(Object.keys(REACHABLE_RESCUE).sort());
    expect(measured, 'per-cell [rescued, fromMiss, stalled] over the reachable domain')
      .toEqual(REACHABLE_RESCUE);
    expect(unanimousCells, 'cells where the seed changed nothing').toBe(cells.length);
  }, 240_000);

  it('puts the load ceilings where the producers put them, and stalls inside them', () => {
    // THE OTHER HALF OF "A PRESET IS NOT A DOMAIN": what the producers can
    // actually emit. Pinned as values rather than bounds, because the finding
    // this repairs was a claim that held only ABOVE the ceiling — and a bound
    // would have been satisfied by that world too.
    const session = reachableSessionCells();
    const meet = reachableMeetCells();
    const sessionCeiling = Math.max(...session.map((c) => c.loadRatio));
    const meetCeiling = Math.max(...meet.map((c) => c.loadRatio));
    expect(sessionCeiling, 'the heaviest set a session can prescribe').toBe(
      REACHABLE.SESSION_LOAD_CEILING,
    );
    expect(meetCeiling, 'the heaviest attempt a meet can call').toBe(
      REACHABLE.MEET_LOAD_CEILING,
    );
    // BOTH CEILINGS ARE BELOW `LOAD_PRESETS.MAXIMAL`, which is the sentence the
    // first version of this sweep needed and did not have. The preset is a
    // point for reading tuning curves at; no play state produces it.
    expect(sessionCeiling).toBeLessThan(LOAD_PRESETS.MAXIMAL);
    expect(meetCeiling).toBeLessThan(LOAD_PRESETS.MAXIMAL);

    // ...and stall-ability arrives INSIDE the band rather than past its far
    // side.
    //
    // THIS HALF READS THE PINNED TABLE AND THEREFORE CANNOT REDDEN ON A TUNING
    // CHANGE, WHICH IS SAID HERE BECAUSE IT WAS ALMOST SHIPPED AS A TAG. A
    // `@guarantee` was declared on `DEMAND_BASE.bench` naming this test, and
    // the mutant for it — flattening that constant back to its pre-retune
    // value — left this test GREEN: the loop below compares two constants,
    // and `REACHABLE_RESCUE` is a constant. The tag was deleted rather than
    // kept, because a tag pointing at a check that cannot fail is the exact
    // defect CLAUDE.md records the tag mechanism itself failing on.
    //
    // What it IS worth: the ceilings above are live (they run the producers),
    // and this loop is a shape check on the table — a reader can see that the
    // rows the table calls stalling are the top of the ladder rather than
    // scattered. The MECHANIC-side guard is the rescue test above, which
    // measures every cell and does redden when the retune is flattened.
    const rows = Object.entries(REACHABLE_RESCUE);
    const stallingSessionCells = rows.filter(
      ([label, row]) => label.startsWith('session/') && row[2] > 0,
    );
    const stallingMeetCells = rows.filter(
      ([label, row]) => label.startsWith('meet/') && row[2] > 0,
    );
    expect(stallingSessionCells.length, 'session cells where an idle rep stalls')
      .toBe(REACHABLE_LADDER.SESSION_CELLS_THAT_STALL);
    // THE THREE NUMBERS GDD §6.2 QUOTES, counted here so the document has
    // something behind it. Plus the cells where nothing moves at all, which is
    // the control the other three are non-zero against.
    expect(rows.filter(([, row]) => row[0] > 0).length, 'cells where coming back helps')
      .toBe(REACHABLE_LADDER.CELLS_WHERE_COMING_BACK_HELPS);
    expect(rows.filter(([, row]) => row[1] > 0).length, 'cells where a rep is saved')
      .toBe(REACHABLE_LADDER.CELLS_WHERE_A_REP_IS_SAVED);
    expect(rows.filter(([, row]) => row[2] > 0).length, 'cells where the idle rep stalls')
      .toBe(REACHABLE_LADDER.CELLS_WHERE_THE_IDLE_REP_STALLS);
    expect(
      rows.filter(([, row]) => row[0] === 0 && row[1] === 0 && row[2] === 0).length,
      'cells where nothing moves at all',
    ).toBe(REACHABLE_LADDER.CELLS_WHERE_NOTHING_MOVES);
    expect(stallingMeetCells.length, 'meet cells where an idle rep stalls')
      .toBe(REACHABLE_LADDER.MEET_CELLS_THAT_STALL);
    // The rung it begins at, by name rather than by count — the count alone
    // would be satisfied by the same number of cells at the wrong end.
    // -----------------------------------------------------------------------
    // THE FLOOR UNDER THE LOOP BELOW, AND WITHOUT IT THAT LOOP CAN BE SATISFIED
    // BY DELETING THE THING IT PROTECTS
    // -----------------------------------------------------------------------
    // The loop `continue`s past any rung in `RUNGS_THAT_STALL`, and until
    // 2026-08-26 NOTHING asserted which rungs may be on that list. So the
    // cheapest repair for "a warm-up started stalling" was to add `'rpe7'` to
    // `RUNGS_THAT_STALL` — one word, whole file green, and the only check
    // standing between GDD §12.3's warm-up protection and a tuning pass gone
    // wrong is skipped rather than failed. That is the shape CLAUDE.md calls a
    // guard broken by the change that was meant to fix it.
    //
    // WHAT IS ASSERTED IS WHAT THE LOOP COVERED, NOT WHAT THE LIST SAYS. An
    // exclusion written as `RUNGS_THAT_STALL` must not contain 'rpe7' was tried
    // first and is DOMINATED: on this tree the equality directly above already
    // reddens on that edit, so the exclusion could never be the check that
    // speaks. It would also miss the case it was written for — a tuning where
    // RPE 7 really does stall, whose table has been re-pinned to match, where
    // the equality AGREES with the widened list and only the missing coverage
    // is wrong. Counting the cells the loop actually asserted on catches both,
    // and cannot be satisfied by editing a list.
    const covered: string[] = [];
    for (const [label, row] of rows) {
      if (!label.startsWith('session/')) continue;
      const rung = label.split('/')[1] ?? '';
      if ((REACHABLE_LADDER.RUNGS_THAT_STALL as readonly string[]).includes(rung)) continue;
      covered.push(label);
      expect(row[1], `${label} lost a rep`).toBe(0);
      expect(row[2], `${label} stalled`).toBe(0);
    }
    // Every rung below the stalling ones is clean on all three counts, and the
    // COUNT of them is pinned: a rung quietly added to `RUNGS_THAT_STALL` stops
    // being covered here, and this is what says so.
    expect(covered.length, `cells the warm-up control actually covered: ${covered.join(', ')}`)
      .toBe(REACHABLE_LADDER.CELLS_THE_WARMUP_CONTROL_COVERS);
    // ...and they are the light rungs by NAME, because a count alone is
    // satisfied by ten cells at the wrong end of the ladder.
    expect(
      [...new Set(covered.map((label) => label.split('/')[1]))].sort(),
      'the rungs the warm-up control covers',
    ).toEqual(['rpe6', 'rpe7']);
    // The rung it begins at, by name rather than by count — the count alone
    // would be satisfied by the same number of cells at the wrong end.
    //
    // ORDERED AFTER THE COVERAGE PIN DELIBERATELY. Both reject adding a light
    // rung to `RUNGS_THAT_STALL` on THIS tree, and whichever runs first is the
    // one a transcript names. They are not the same check: this one compares
    // the measured stalling set against the declared list, so it AGREES the
    // moment a tuning really does make RPE 7 stall and somebody re-pins the
    // table to match — which is exactly the repair-by-allowlist that would
    // delete the warm-up control. The coverage pin above reads the loop's own
    // iteration count and falls whenever the list grows, whatever the tuning
    // did. Only the list edit was driven as a mutant; the re-pinned variant is
    // argued from what each assertion reads, and is stated as an argument
    // rather than as a measurement.
    expect(
      [...new Set(stallingSessionCells.map(([label]) => label.split('/')[1]))].sort(),
      'the RPE rungs a session set can stall at',
    ).toEqual([...REACHABLE_LADDER.RUNGS_THAT_STALL]);
    // ...and the meet stalls under STANDARD jumps and not only aggressive ones.
    expect(REACHABLE_RESCUE['meet/standard/att3/rested']?.[2] ?? 0, 'standard att3 stalls')
      .toBeGreaterThan(0);
    expect(REACHABLE_RESCUE['meet/standard/att3/rested']?.[1] ?? 0, 'standard att3 loses reps')
      .toBeGreaterThan(0);
  });

  it('never loses a warm-up rep to a player who answered and then stopped [a-warm-up-survives-being-abandoned]', () => {
    // -----------------------------------------------------------------------
    // THE CHECK THE PINNED TABLE ABOVE COULD NOT BE, AND THE REASON IT EXISTS
    // IS A REGRESSION THAT GOT PAST THE TABLE
    // -----------------------------------------------------------------------
    // GDD §12.3's warm-up protection is stated as "a grind on every warm-up is
    // its own failure", and the RPE 6/7 rows above are the control it is read
    // off. A 2026-08-26 difficulty retune broke it — a player who tapped twice
    // at RPE 7 and stopped lost the rep — and the table stayed `[x, 0, 0]`
    // because `IDLE_FROM_TICKS` began at 18 ticks and every newly-lost rep was
    // at offsets 1-12.
    //
    // A WIDER GRID FIXES THAT TABLE AND IS STILL A GRID. This sweeps the quit
    // instant WHOLE — every tick from the command to past the ascent timeout —
    // at three cadences, so there is no QUIT INSTANT for the next regression to
    // hide between. The count is pinned at ZERO and the domain is pinned beside
    // it, because a sweep that stopped generating cases would report the same
    // zero.
    //
    // "NO OFFSET" IS WHAT THIS USED TO SAY AND IT CLAIMED AN AXIS IT DOES NOT
    // SWEEP. `LiftConfig.moment` narrows `PRESS_LAUNCH_MS` by about a tenth on
    // every rep after the first — deeper into the session, tighter launch beat —
    // and every rep here leaves it undefined, so all of this is measured at the
    // WIDEST launch window the game ever gives. The claim is true of the quit
    // tick and was false of the launch-beat width. `leaves a warm-up alone`
    // drives the deepest moment a session can reach; see `DEEPEST_MOMENT`.
    const cells = reachableSessionCells().filter((c) => /^session\/rpe[67]\//.test(c.label));
    expect(cells.length, 'warm-up cells the ladder can prescribe').toBe(
      REACHABLE_WARMUP.CELLS,
    );
    let lost = 0;
    let driven = 0;
    const offenders: string[] = [];
    for (const cell of cells) {
      let cellLost = 0;
      for (const gap of REACHABLE_WARMUP.GAP_TICKS) {
        for (let quitAt = 1; quitAt <= REACHABLE_WARMUP.MAX_QUIT_TICK; quitAt += 1) {
          for (let seed = 1; seed <= REACHABLE_WARMUP.SEEDS; seed += 1) {
            const rep = driveGrind(
              { kind: BENCH, loadRatio: cell.loadRatio, seed, feel: cell.feel },
              gap,
              quitAt,
              Number.POSITIVE_INFINITY,
            );
            driven += 1;
            if (rep.resolution?.outcome === 'miss') cellLost += 1;
          }
        }
      }
      lost += cellLost;
      if (cellLost > 0) offenders.push(`${cell.label} lost ${cellLost}`);
    }
    // THE DOMAIN FIRST, as a literal, so an emptied sweep reports itself rather
    // than passing on zero comparisons.
    expect(driven, 'warm-up reps driven').toBe(16200);
    // ...and the literal is the parameters' own product, so a parameter changed
    // without the literal is red rather than silently re-scoped.
    expect(
      REACHABLE_WARMUP.CELLS
        * REACHABLE_WARMUP.GAP_TICKS.length
        * REACHABLE_WARMUP.MAX_QUIT_TICK
        * REACHABLE_WARMUP.SEEDS,
      'the warm-up domain literal and its parameters disagree',
    ).toBe(16200);
    expect(lost, `warm-up reps lost by quitting: ${offenders.join(' | ')}`).toBe(0);
    // ...AND THE SWEEP IS NOT VACUOUS, which is the half a zero cannot carry on
    // its own. The same drive at the rung above must lose reps — so this
    // measures a property of the WARM-UP rungs rather than of a schedule that
    // could never lose anything anywhere.
    const rpe8 = reachableSessionCells().filter((c) => c.label.startsWith('session/rpe8/'));
    let rpe8Lost = 0;
    for (const cell of rpe8) {
      for (let seed = 1; seed <= REACHABLE_WARMUP.SEEDS; seed += 1) {
        const rep = driveGrind(
          { kind: BENCH, loadRatio: cell.loadRatio, seed, feel: cell.feel },
          REACHABLE_WARMUP.GAP_TICKS[0] ?? 6,
          REACHABLE_WARMUP.NON_VACUITY_QUIT_TICK,
          Number.POSITIVE_INFINITY,
        );
        if (rep.resolution?.outcome === 'miss') rpe8Lost += 1;
      }
    }
    expect(rpe8Lost, 'the same abandonment at RPE 8 cost nothing either').toBe(
      REACHABLE_WARMUP.RPE8_LOST_AT_THE_SAME_INSTANT,
    );

    // -----------------------------------------------------------------------
    // THE SECOND COLUMN. Everything above holds the finger down through the
    // descent; everything below takes it off. See `SLIP_TICKS`.
    //
    // ORDERED AFTER THE ZERO ON PURPOSE. `guaranteeTags.test.ts` records a
    // mutation witness whose `observed` field is this test's HELD failure
    // message verbatim, and vitest reports the first assertion to throw — so a
    // released-arm pin placed above it would silently retarget the witness at
    // a different assertion while leaving it resolving.
    // -----------------------------------------------------------------------
    const slipLost: number[] = [];
    let slipDriven = 0;
    for (const cell of cells) {
      let cellLost = 0;
      for (const slip of REACHABLE_WARMUP.SLIP_TICKS) {
        for (const gap of REACHABLE_WARMUP.GAP_TICKS) {
          for (let quitAt = 1; quitAt <= REACHABLE_WARMUP.MAX_QUIT_TICK; quitAt += 1) {
            for (let seed = 1; seed <= REACHABLE_WARMUP.SEEDS; seed += 1) {
              const rep = driveGrind(
                { kind: BENCH, loadRatio: cell.loadRatio, seed, feel: cell.feel },
                gap,
                quitAt,
                Number.POSITIVE_INFINITY,
                slip,
              );
              slipDriven += 1;
              if (rep.resolution?.outcome === 'miss') cellLost += 1;
            }
          }
        }
      }
      slipLost.push(cellLost);
    }
    expect(slipDriven, 'warm-up reps driven with the finger off').toBe(
      16200 * REACHABLE_WARMUP.SLIP_TICKS.length,
    );
    expect(
      slipLost,
      `warm-up reps lost per cell with the finger off: ${cells
        .map((c, i) => `${c.label}=${slipLost[i]}`)
        .join(' | ')}`,
    ).toEqual([...REACHABLE_WARMUP.LOST_WITH_THE_FINGER_OFF]);
    // THE ZERO COUNT AS A LITERAL, AND THE LITERAL IS THE WHOLE POINT — an
    // earlier draft of this line read `.toBe(REACHABLE_WARMUP.
    // CELLS_CLEAN_WITH_THE_FINGER_OFF)` and that version was DOMINATED by the
    // equality directly above it. Given the array matches, the number of zeros
    // in it is decided, so no change to the lift engine could redden the
    // constant form while leaving the array green. Against a wholesale re-pin
    // the literal still bites: a future round that pastes in a new vector with
    // three zeros passes the equality and fails here, which is the one thing
    // the equality cannot check about itself. Same idiom as
    // `TOUCH_SWEEP.OUTCOME_CASES` two hundred lines up, for the same reason.
    expect(
      slipLost.filter((n) => n === 0).length,
      'warm-up cells that survive a slip as well as a stop',
    ).toBe(1);
    // ...and WHICH cell, which the equality genuinely does not pin: it fixes
    // counts to positions and says nothing about the labels at those positions.
    // It is the same cell `CELLS_WHERE_NOTHING_MOVES` names.
    expect(
      cells[slipLost.findIndex((n) => n === 0)]?.label,
      'the cell that survives both mistakes',
    ).toBe('session/rpe6/0.7500/as-expected');

    // ...AND THE ARITHMETIC HALF, which no grid resolution can move: at what
    // fraction of the reachable warm-up loads does letting go crash the bar
    // OUTRIGHT rather than merely degrading it. `ABANDONED_CRASHES` asks this
    // over `TOUCH_SWEEP.LOADS`, two of which no session can prescribe.
    let fullyCrashed = 0;
    let alwaysCrashed = 0;
    for (const cell of cells) {
      const graded = REACHABLE_WARMUP.SLIP_TICKS.map(
        (slip) =>
          driveGrind(
            { kind: BENCH, loadRatio: cell.loadRatio, seed: 1, feel: cell.feel },
            REACHABLE_WARMUP.GAP_TICKS[0] ?? 6,
            Number.POSITIVE_INFINITY,
            0,
            slip,
          ).touchQuality,
      );
      if (graded.some((q) => q === 0)) fullyCrashed += 1;
      if (graded.every((q) => q === 0)) alwaysCrashed += 1;
    }
    expect(
      fullyCrashed,
      'warm-up cells some rung of the slip ladder crashes outright',
    ).toBe(REACHABLE_WARMUP.CELLS_A_SLIP_FULLY_CRASHES);
    expect(
      alwaysCrashed,
      'warm-up cells EVERY rung of the slip ladder crashes outright',
    ).toBe(REACHABLE_WARMUP.CELLS_EVERY_SLIP_CRASHES);
  }, 900_000);

  it('makes a better check-in an EASIER rep, which is deliberate and is not this piece to fix', () => {
    // See `REACHABLE_COUPLING`. The check-in moves the prescribed load and the
    // lifter's capacity together and capacity moves further, so the ordering
    // runs the way a reader does not expect. Pinned rather than left to be
    // discovered: it is the reason the `crisp` and `popping` rows of the table
    // above are not the hardest ones at their rung, and a future tuner who
    // changes either half needs to see this go red rather than find it by
    // playing.
    //
    // BOTH HALVES LIVE OUTSIDE THIS PIECE — `fatigue.ts`'s
    // `capacityScaleForBarSpeed` and `session.ts`'s `loadAdjustmentPercent` —
    // and the coupling predates the bench work entirely. What is asserted here
    // is what it DOES to a bench rep, measured, not a judgement about whether
    // it should.
    const cells = reachableSessionCells();
    const marginOf = (cell: ReachableCell): number =>
      ascentDemand(STICK_HEIGHT_FRAC.bench, cell.loadRatio, BENCH) -
      lifterCapacity({ kind: BENCH, loadRatio: cell.loadRatio, seed: 1, feel: cell.feel });

    let fallingRungs = 0;
    let primedHardestRungs = 0;
    let poorHardestRungs = 0;
    for (const targetRpe of SESSION_TUNING.RPE_CHOICES) {
      const rung = cells.filter((c) => c.label.startsWith(`session/rpe${targetRpe}/`));
      expect(rung.length, `rpe ${targetRpe} cells`).toBeGreaterThan(3);
      const hardest = [...rung].sort((a, b) => marginOf(b) - marginOf(a))[0];
      if (hardest !== undefined && hardest.label.endsWith('/popping')) primedHardestRungs += 1;
      if (hardest !== undefined && hardest.label.endsWith('/slower-than-expected')) {
        poorHardestRungs += 1;
      }
      // THE HARDEST `as-expected` CELL, NOT THE FIRST ONE. A rung can reach the
      // same bar-speed cue at two loads — RPE 6 reaches `as-expected` at both
      // 0.7500 and 0.8000 — and picking whichever came first would compare a
      // different cell at different rungs. This is the same collision the
      // table's own labels had to be widened for.
      const ladder = REACHABLE_COUPLING.IMPROVING_CUES.map((cue) => {
        const matching = rung.filter((c) => c.label.endsWith(`/${cue}`));
        return matching.length === 0
          ? null
          : Math.max(...matching.map((c) => marginOf(c)));
      });
      const present = ladder.filter((m): m is number => m !== null);
      expect(present.length, `rpe ${targetRpe} improving cues`).toBe(
        REACHABLE_COUPLING.IMPROVING_CUES.length,
      );
      let falling = true;
      for (let i = 1; i < present.length; i += 1) {
        if ((present[i] ?? 0) >= (present[i - 1] ?? 0)) falling = false;
      }
      if (falling) fallingRungs += 1;
    }
    expect(fallingRungs, 'rungs where a better check-in is a smaller margin').toBe(
      REACHABLE_COUPLING.RUNGS_WHERE_A_BETTER_CHECK_IN_IS_EASIER,
    );
    expect(primedHardestRungs, 'rungs where the best check-in is the hardest cell').toBe(
      REACHABLE_COUPLING.RUNGS_WHERE_PRIMED_IS_HARDEST,
    );
    expect(poorHardestRungs, 'rungs where the worst check-in is the hardest cell').toBe(
      REACHABLE_COUPLING.RUNGS_WHERE_A_POOR_CHECK_IN_IS_HARDEST,
    );
  });

  it('never rewards tapping slower, across the sweep', () => {
    // THE DIRECTION THE FLIP COUNTS DO NOT CARRY. A count says a population
    // moved; it does not say which way. A rung that tapped faster and landed
    // LESS force would satisfy every flip pin above.
    let compared = 0;
    for (let seed = 1; seed <= GRIND_SWEEP.SEEDS; seed += 1) {
      for (const load of GRIND_SWEEP.LOADS) {
        const ladder = [
          GRIND_SWEEP.NONE,
          GRIND_SWEEP.SPARSE_GAP_TICKS,
          GRIND_SWEEP.MODERATE_GAP_TICKS,
          GRIND_SWEEP.MASH_GAP_TICKS,
        ];
        let previous = -1;
        for (const gap of ladder) {
          const rep = benchGrindRep(load, seed, { gapTicks: gap });
          expect(rep.launchForce, `load ${load} seed ${seed} gap ${gap}`).toBeGreaterThanOrEqual(
            previous,
          );
          previous = rep.launchForce;
          compared += 1;
        }
        // ...and the ladder really spans the curve at this pair, or the
        // monotonicity above is a claim about four identical numbers.
        expect(previous, `load ${load} seed ${seed}`).toBeGreaterThan(0.5);
      }
    }
    expect(compared, 'no ladder rungs were compared').toBe(480);
  });

  it('turns a make into a miss at a limit when the command is ignored', () => {
    // One named case, so a failure reads as a case rather than a count. IT IS
    // AN ILLUSTRATION, NOT THE DISCRIMINATOR — the sweeps above are what catch
    // a mutant that removes the live boost and leaves the launch transient
    // behind.
    const made = benchGrindRep(0.9, 7, { gapTicks: GRIND_SWEEP.MASH_GAP_TICKS });
    const ignored = benchGrindRep(0.9, 7, { gapTicks: GRIND_SWEEP.NONE });
    expect(made.resolution?.outcome).toBe('good-lift');
    expect(ignored.resolution?.outcome).toBe('miss');
    // AND THE TOP OF THE LADDER STILL PUNISHES A SLOW GRIND, which is what
    // keeps the beat a grind rather than a formality: at MAXIMAL a sparse
    // tapper misses however patiently the bar was lowered.
    expect(
      benchGrindRep(LOAD_PRESETS.MAXIMAL, 7, { gapTicks: GRIND_SWEEP.SPARSE_GAP_TICKS })
        .resolution?.outcome,
    ).toBe('miss');
  });

  it('re-derives the crash-penalty comparison\u2019s shipped row on its own named domain', () => {
    // WHY THIS TEST EXISTS AT ALL: the row it drives is quoted in two shipped
    // documents as the evidence for "no retune closes the descent axis", and
    // for three rounds its domain lived in prose. A critic drove sixteen
    // plausible readings that all land on exactly 4860 reps and got sixteen
    // different answers; the quoted one was not among them. The number was
    // right and nobody but its author could reach it, which is its own defect.
    //
    // It is the SAME `driveGrind` the rest of this file uses, so the domain is
    // the constants and nothing else.
    const cells = reachableSessionCells().filter((c) => /^session\/rpe[67]\//.test(c.label));
    expect(cells.length, 'warm-up cells the comparison covers').toBe(REACHABLE_WARMUP.CELLS);
    let lost = 0;
    let driven = 0;
    for (const cell of cells) {
      for (const slip of PENALTY_DOMAIN.SLIPS) {
        for (const gap of PENALTY_DOMAIN.GAP_TICKS) {
          for (const quitAt of PENALTY_DOMAIN.QUIT_TICKS) {
            for (let seed = 1; seed <= PENALTY_DOMAIN.SEEDS; seed += 1) {
              const rep = driveGrind(
                { kind: BENCH, loadRatio: cell.loadRatio, seed, feel: cell.feel },
                gap,
                quitAt,
                Number.POSITIVE_INFINITY,
                slip,
              );
              driven += 1;
              if (rep.resolution?.outcome === 'miss') lost += 1;
            }
          }
        }
      }
    }
    // THE DOMAIN AS A LITERAL, so an emptied sweep reports itself...
    expect(driven, 'crash-penalty comparison reps driven').toBe(4860);
    // ...and as the parameters' own product, so a ladder quietly shortened is
    // red here rather than silently re-scoped.
    expect(
      REACHABLE_WARMUP.CELLS
        * PENALTY_DOMAIN.SLIPS.length
        * PENALTY_DOMAIN.GAP_TICKS.length
        * PENALTY_DOMAIN.QUIT_TICKS.length
        * PENALTY_DOMAIN.SEEDS,
      'the comparison domain and its parameters disagree',
    ).toBe(PENALTY_DOMAIN.CASES);
    expect(lost, 'the row two documents quote as evidence').toBe(PENALTY_DOMAIN.SHIPPED_LOST);
  }, 600_000);

  it('leaves a warm-up alone — nobody answers at all [a-warm-up-makes-it-unanswered]', () => {
    // -----------------------------------------------------------------------
    // RETARGETED 2026-08-26 FROM `LOAD_PRESETS.LIGHT` ONTO THE LOADS THE
    // LADDER ACTUALLY PRESCRIBES, AND THE OLD VERSION IS WHY
    // -----------------------------------------------------------------------
    // It read: "at a light load demand is far under capacity, so ignoring the
    // command AND letting the bar go costs time and not the rep. If this ever
    // fails the descent and the grind have grown into a difficulty setting."
    // It never failed, and the descent HAD grown into a difficulty setting —
    // because `LOAD_PRESETS.LIGHT` is 0.55 and the lightest load
    // `prescribeSession` emits is 0.75. Walked up by hundredths, the old
    // assertion turns over between 0.74 and 0.75: the boundary it was pinned
    // twenty points below sits exactly ON the reachable floor.
    //
    // A PRESET IS NOT A DOMAIN — the same finding as the rescue table's, in a
    // test written to guard the thing the rescue table missed.
    //
    // WHAT IT CHECKS NOW is the case the big sweep above does NOT contain:
    // `REACHABLE_WARMUP`'s quit ladder starts at one tap, so a player who
    // answers NOTHING is outside it. Both descents are driven, and both counts
    // are pinned, because which of them survives is the whole finding.
    const cells = reachableSessionCells().filter((c) => /^session\/rpe[67]\//.test(c.label));
    expect(cells.length, 'warm-up cells the ladder can prescribe').toBe(REACHABLE_WARMUP.CELLS);
    let carriedDown = 0;
    let letGo = 0;
    let driven = 0;
    const offenders: string[] = [];
    for (const cell of cells) {
      for (let seed = 1; seed <= REACHABLE_WARMUP.NO_ANSWER_SEEDS; seed += 1) {
        // `idleFromTicks` 0 means every tap instant is idle: the command is
        // never answered at all, which is what this test is about.
        const held = driveGrind(
          { kind: BENCH, loadRatio: cell.loadRatio, seed, feel: cell.feel },
          REACHABLE_WARMUP.GAP_TICKS[0] ?? 6,
          0,
          Number.POSITIVE_INFINITY,
        );
        driven += 1;
        if (held.resolution?.outcome !== 'miss') carriedDown += 1;
        else offenders.push(`${cell.label} seed ${seed} lost the rep on a HELD descent`);
        for (const slip of REACHABLE_WARMUP.SLIP_TICKS) {
          const slipped = driveGrind(
            { kind: BENCH, loadRatio: cell.loadRatio, seed, feel: cell.feel },
            REACHABLE_WARMUP.GAP_TICKS[0] ?? 6,
            0,
            Number.POSITIVE_INFINITY,
            slip,
          );
          driven += 1;
          if (slipped.resolution?.outcome !== 'miss') letGo += 1;
        }
      }
    }
    // THE DOMAIN FIRST, as a literal, so an emptied sweep reports itself.
    expect(driven, 'unanswered warm-up reps driven').toBe(400);
    // ...and the literal is the parameters' own product, so a parameter moved
    // without the literal is red rather than silently re-scoped.
    const arms = 1 + REACHABLE_WARMUP.SLIP_TICKS.length;
    const seeds = REACHABLE_WARMUP.NO_ANSWER_SEEDS;
    expect(REACHABLE_WARMUP.CELLS * seeds * arms, 'the domain and its parameters').toBe(400);
    // ------------------------------------------------------------------
    // THE RULING'S OWN SENTENCE, AS A ZERO: "Never answering PRESS! on a held
    // descent must still make every RPE 6 and RPE 7 cell, including
    // rpe7/0.8250." Ruled 2026-08-26 after this test — retargeted off
    // `LOAD_PRESETS.LIGHT` onto the reachable cells the round before — first
    // measured 72 of 80, with the eight being that one cell at every seed.
    // ------------------------------------------------------------------
    const unanswered = REACHABLE_WARMUP.CELLS * REACHABLE_WARMUP.NO_ANSWER_SEEDS - carriedDown;
    expect(unanswered, `warm-up reps lost unanswered: ${offenders.join(' | ')}`).toBe(0);
    // ...AND THE ZERO IS NOT A SCHEDULE TOO GENTLE TO LOSE ANYTHING. The same
    // drive one rung up must still cost the rep — that is the grind the phone
    // replay asked for and the ruling explicitly kept. Without this the floor
    // could be a global clock bump and nothing here would notice; a global bump
    // is exactly what was tried first and it took this number from
    // `WORKING_RUNGS` down as well, which is how it was refused.
    const working = reachableSessionCells().filter((c) => /^session\/rpe(8|9|10)\//.test(c.label));
    expect(working.length, 'working-rung cells the ladder can prescribe').toBe(
      REACHABLE_WARMUP.WORKING_CELLS,
    );
    let workingLost = 0;
    for (const cell of working) {
      for (let seed = 1; seed <= REACHABLE_WARMUP.NO_ANSWER_SEEDS; seed += 1) {
        const rep = driveGrind(
          { kind: BENCH, loadRatio: cell.loadRatio, seed, feel: cell.feel },
          REACHABLE_WARMUP.GAP_TICKS[0] ?? 6,
          0,
          Number.POSITIVE_INFINITY,
        );
        if (rep.resolution?.outcome === 'miss') workingLost += 1;
      }
    }
    expect(workingLost, 'the same unanswered rep one rung up still costs the rep').toBe(
      REACHABLE_WARMUP.WORKING_CELLS * REACHABLE_WARMUP.NO_ANSWER_SEEDS,
    );
    // ...AND THE SAME ZERO AT THE DEEPEST POINT OF THE SESSION, which is the
    // axis every other bench sweep in this file leaves at its widest. See
    // `DEEPEST_MOMENT`: `moment` tightens the launch beat as the session wears
    // on, so a warm-up guarantee measured only on a fresh rep is measured where
    // the game is most forgiving.
    let deepLost = 0;
    let deepDriven = 0;
    const deepOffenders: string[] = [];
    for (const cell of cells) {
      for (let seed = 1; seed <= REACHABLE_WARMUP.NO_ANSWER_SEEDS; seed += 1) {
        const rep = driveGrind(
          {
            kind: BENCH,
            loadRatio: cell.loadRatio,
            seed,
            feel: cell.feel,
            moment: REACHABLE_WARMUP.DEEPEST_MOMENT,
          },
          REACHABLE_WARMUP.GAP_TICKS[0] ?? 6,
          0,
          Number.POSITIVE_INFINITY,
        );
        deepDriven += 1;
        if (rep.resolution?.outcome === 'miss') deepOffenders.push(`${cell.label} seed ${seed}`);
      }
    }
    deepLost = deepOffenders.length;
    expect(deepDriven, 'deepest-moment warm-up reps driven').toBe(80);
    expect(deepLost, `warm-up reps lost unanswered at the session's end: ${deepOffenders.join(' | ')}`).toBe(0);
    // ...and the price of ALSO letting the bar go, which the floor does not pay
    // off in full. Pinned as a count rather than asserted away, because it is
    // what the descent still charges and a tuner needs to see it move.
    expect(letGo, 'warm-ups kept after letting the bar go and never answering').toBe(
      REACHABLE_WARMUP.NO_ANSWER_KEPT_AFTER_A_SLIP,
    );
  });

  it('charges squat and deadlift nothing for a beat they never had', () => {
    // `touchQuality` is 0 on squat and deadlift because neither lift has a
    // chest touch. Read without a kind guard that is the MAXIMUM crash penalty
    // on every squat and every deadlift rep in the game — the sharpest way
    // this redesign could have broken the two lifts that already work.
    for (const load of [0.7, 0.85, 1.0]) {
      const crashed = ascentDemand(0.34, load, 'squat', 0, 1);
      const clean = ascentDemand(0.34, load, 'squat', 0, 0);
      // The parameter still applies if passed — the guard is at the call site.
      expect(crashed).toBeGreaterThan(clean);
    }
    // The real guard: a played squat and a played deadlift carry none of it.
    const squat = play(0.88, { driveOffsetTicks: 0 });
    expect(squat.launchForce).toBe(0);
    expect(squat.grindForce).toBe(0);
    expect(squat.grindCharge).toBe(0);
    expect(squat.touchQuality).toBe(0);
    expect(squat.chestRate).toBeNull();
    const pull = deadliftRep(0.9, 3, DEADLIFT_SWEEP.HELD);
    expect(pull.launchForce).toBe(0);
    expect(pull.grindForce).toBe(0);
    expect(pull.grindCharge).toBe(0);
    expect(pull.touchQuality).toBe(0);
    expect(pull.chestRate).toBeNull();
  });

  it('reports the grind for the stage, and the row moves both ways', () => {
    // `grindProgress` is what piece 2 draws. FACT 3 OF THE PROGRESSION RULE IS
    // THE WHOLE POINT HERE: a running tap total would rise forever and a row
    // keyed to it would fill and stay full while the player stopped tapping.
    // So the assertion is not "it rises" — it is "it rises AND it falls".
    const load = LOAD_PRESETS.MAXIMAL;
    const command = commandTickFor(load, 3, null);
    expect(command).not.toBeNull();
    if (command === null) return;
    const history = runLift(
      { kind: BENCH, loadRatio: load, seed: 3 },
      buildBenchScript(load, 3, {
        gapTicks: GRIND_SWEEP.MASH_GAP_TICKS,
        idle: { from: 40, until: Number.POSITIVE_INFINITY },
      }),
      TOUCH_SWEEP.MAX_TICKS,
    ).history;
    const live = history
      .map((state) => ({ tick: state.tick, p: grindProgress(state) }))
      .filter((row): row is { tick: number; p: GrindProgress } => row.p !== null);
    expect(live.length, 'the grind never went live').toBeGreaterThan(30);
    const peak = Math.max(...live.map((row) => row.p.lit));
    const last = live[live.length - 1]?.p.lit ?? -1;
    expect(peak, 'the row never lit').toBeGreaterThan(1);
    expect(last, `the row ended at ${last} of a peak of ${peak}`).toBeLessThan(peak);
    for (const row of live) {
      expect(row.p.lit, `tick ${row.tick}`).toBeGreaterThanOrEqual(0);
      expect(row.p.lit, `tick ${row.tick}`).toBeLessThanOrEqual(row.p.units);
      expect(row.p.units).toBe(LIFT_TUNING.FEEDBACK.STAGE_COMMAND.GRIND_READOUT_UNITS);
    }
    // The tap TOTAL still only rises, which is the other half of the contract
    // and the thing `lit` is deliberately not.
    let previousTaps = -1;
    for (const row of live) {
      expect(row.p.taps, `tick ${row.tick}`).toBeGreaterThanOrEqual(previousTaps);
      previousTaps = row.p.taps;
    }
    expect(previousTaps, 'no taps were counted').toBeGreaterThan(4);
    // ...and it is null on the other two lifts at every tick.
    let squatTicks = 0;
    for (const state of squatHistory(load)) {
      expect(grindProgress(state)).toBeNull();
      squatTicks += 1;
    }
    expect(squatTicks, 'no squat ticks were walked').toBeGreaterThan(60);
  });

  it('adds nothing at all to a warm-up, at every reachable cell [the-working-lever-cannot-reach-a-warm-up]', () => {
    // ------------------------------------------------------------------
    // THE STRUCTURAL HALF OF GDD §12.3's WARM-UP PROTECTION FOR THIS LEVER.
    // The sweeps below measure what the lever DOES; this measures what it
    // cannot reach, which is the claim the 2026-08-27 ruling made binding:
    // "Do not buy RPE 8's difficulty out of RPE 7's floor."
    // ------------------------------------------------------------------
    const session = reachableSessionCells();
    const meet = reachableMeetCells();
    const warmups = session.filter((c) => /^session\/rpe[67]\//.test(c.label));
    const working = session.filter((c) => /^session\/rpe(8|9|10)\//.test(c.label));
    expect(warmups.length, 'warm-up cells').toBe(REACHABLE_WARMUP.CELLS);
    expect(working.length, 'working-rung cells').toBe(REACHABLE_WARMUP.WORKING_CELLS);
    expect(meet.length, 'meet cells').toBe(REACHABLE.MEET_CELLS);

    const configOf = (cell: ReachableCell): LiftConfig => ({
      kind: BENCH,
      loadRatio: cell.loadRatio,
      seed: 1,
      feel: cell.feel,
    });
    const leverOn = (cell: ReachableCell): number =>
      benchWorkingRungDemand(BENCH, benchWorkingExcess(configOf(cell)));

    // ZERO, NOT "SMALL". A warm-up's demand curve is the same object it was.
    const touched = warmups.filter((c) => leverOn(c) !== 0).map((c) => c.label);
    expect(touched, `the lever reached a warm-up: ${touched.join(', ')}`).toEqual([]);
    // ...and it reaches every cell above the line, or the zero above is a fact
    // about a lever that is switched off rather than one that is scoped.
    //
    // WITH ONE NAMED EXCEPTION, PINNED AS A SET IN BOTH DIRECTIONS RATHER THAN
    // ALLOWED FOR BY A LOOSER ASSERTION. `BENCH_WORKING_RUNG_DEMAND_MARGIN_
    // CEILING` adds nothing to a bar the BASE curve already puts past the
    // ceiling, which is the property that keeps the false-start rule true and
    // keeps the meet's own ceiling cell byte-identical. The exception is
    // therefore a consequence of a constant, and the equality below is what
    // says the two agree — a cell that fell out of the lever's reach for any
    // OTHER reason reddens here.
    const missed = [...working, ...meet].filter((c) => leverOn(c) <= 0).map((c) => c.label);
    const pastTheCeiling = [...working, ...meet]
      .filter(
        (c) =>
          benchWorkingExcess(configOf(c)) + LIFT_TUNING.BENCH_WARMUP_FLOOR_MARGIN >=
          LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_MARGIN_CEILING,
      )
      .map((c) => c.label);
    expect(missed.sort(), `the lever failed to reach: ${missed.join(', ')}`).toEqual(
      pastTheCeiling.sort(),
    );
    expect(missed, 'cells the base curve already puts past the ceiling').toEqual([
      ...FLOOR_EDGES.CELLS_ALREADY_PAST_THE_CEILING,
    ]);

    // THE COMPLEMENTARITY, DRIVEN. `benchWorkingExcess` and
    // `benchClearsTheClock` read one shared margin, so a rep is a warm-up for
    // BOTH the clock and the demand curve or for neither. Written as an
    // exclusive-or count so a cell that classified two ways names itself.
    const disagreements = [...session, ...meet].filter(
      (c) => benchClearsTheClock(configOf(c)) === benchWorkingExcess(configOf(c)) > 0,
    ).map((c) => c.label);
    expect(
      disagreements,
      `clock and lever classified differently: ${disagreements.join(', ')}`,
    ).toEqual([]);

    // ------------------------------------------------------------------
    // WHY THE GATE IS A MARGIN AND NOT A LOAD, AS AN ASSERTION RATHER THAN AS
    // A SENTENCE. The obvious mechanism — "extra demand above some loadRatio"
    // — cannot exist, because the rungs overlap in load. RPE 7 reaches 0.8750
    // and RPE 8 spans 0.8000 to 0.9000, so 0.8750 is a cell on both rungs and
    // no cut in load separates them. If a future producer change ever DID
    // separate them, this goes red and the simpler mechanism becomes
    // available — which is the opposite of a comment nobody re-checks.
    // ------------------------------------------------------------------
    const warmupLoads = warmups.map((c) => c.loadRatio);
    const workingLoads = working.map((c) => c.loadRatio);
    expect(Math.max(...warmupLoads), 'the heaviest warm-up load').toBe(0.8750);
    expect(Math.min(...workingLoads), 'the lightest working load').toBe(0.8000);
    expect(Math.max(...workingLoads), 'the heaviest RPE 8-to-10 load').toBe(0.9500);
    expect(
      workingLoads.filter((l) => l === 0.8750).length,
      'RPE 8 also reaches 0.8750, which is why no load threshold works',
    ).toBeGreaterThan(0);
    expect(
      working.filter((c) => c.label.startsWith('session/rpe8/')).map((c) => c.loadRatio),
      'the four loads RPE 8 can prescribe',
    ).toEqual([0.8000, 0.8500, 0.8750, 0.9000]);

    // ...AND THE CURVE PARAMETER CANNOT REACH SQUAT OR DEADLIFT EVEN WHEN IT IS
    // HANDED ONE. `ascentDemand`'s sixth parameter defaults to 0, and CLAUDE.md
    // records `launchShortfall` going stale behind exactly that default, so the
    // guard is inside the function and this is what says so.
    // The excess used here is one the CEILING does not clip — see
    // `FLOOR_EDGES.CELLS_ALREADY_PAST_THE_CEILING`. A big one would be clipped
    // to zero on bench too, and the contrast below would then be an equality
    // that held for the wrong reason on all three kinds at once.
    const liveExcess = 0.02;
    for (const kind of ['squat', 'deadlift'] as const) {
      expect(benchWorkingRungDemand(kind, liveExcess), kind).toBe(0);
      for (const h of [0, 0.2, 0.34, 0.62, 1]) {
        for (const l of [0.75, 0.88, 1]) {
          expect(ascentDemand(h, l, kind, 0, 0, liveExcess), `${kind} ${h} ${l}`).toBe(
            ascentDemand(h, l, kind, 0, 0),
          );
        }
      }
    }
    // ...and it DOES move a bench curve, or the equality above is about a
    // parameter nothing reads.
    expect(benchWorkingRungDemand(BENCH, liveExcess), 'the lever at a live excess')
      .toBeGreaterThan(0);
    expect(ascentDemand(STICK_HEIGHT_FRAC.bench, 0.9, BENCH, 0, 0, liveExcess)).toBeGreaterThan(
      ascentDemand(STICK_HEIGHT_FRAC.bench, 0.9, BENCH, 0, 0),
    );
  });

  it('re-pins the two edges the bench warm-up floor rests on', () => {
    // See `FLOOR_EDGES`: both constants CLAIMED to be pinned here and neither
    // was. The 2026-08-27 ruling made re-pinning them a condition of the
    // working-rung lever — "if the change closes either gap, that means the
    // floor can no longer separate warm-up from working rung, and the answer is
    // to rethink the lever, not renumber the floor."
    const session = reachableSessionCells();
    const warmups = session.filter((c) => /^session\/rpe[67]\//.test(c.label));
    const working = session.filter((c) => /^session\/rpe(8|9|10)\//.test(c.label));
    const marginOf = (cell: ReachableCell): number =>
      ascentDemand(STICK_HEIGHT_FRAC.bench, cell.loadRatio, BENCH) -
      lifterCapacity({ kind: BENCH, loadRatio: cell.loadRatio, seed: 1, feel: cell.feel });

    // EDGE 1 — THE FORCE BALANCE, ON THE BASE CURVE. The lever reads this
    // quantity and does not write it, which is why it cannot close this gap:
    // `benchBaseMargin` calls `ascentDemand` with the working term at zero.
    const warmupHardest = Math.max(...warmups.map(marginOf));
    const workingEasiest = Math.min(...[...working, ...reachableMeetCells()].map(marginOf));
    expect(Number(warmupHardest.toFixed(4)), 'the hardest warm-up cell').toBe(
      FLOOR_EDGES.WARMUP_HARDEST_MARGIN,
    );
    expect(Number(workingEasiest.toFixed(4)), 'the easiest working cell').toBe(
      FLOOR_EDGES.WORKING_EASIEST_MARGIN,
    );
    // ...and the floor sits STRICTLY INSIDE the gap, from both sides. This is
    // the assertion the two docstrings promise: it reddens when the gap
    // narrows onto the floor from either end, and it cannot be satisfied by a
    // floor that has drifted past one of them.
    expect(FLOOR_EDGES.WARMUP_HARDEST_MARGIN).toBeLessThan(
      LIFT_TUNING.BENCH_WARMUP_FLOOR_MARGIN,
    );
    expect(FLOOR_EDGES.WORKING_EASIEST_MARGIN).toBeGreaterThan(
      LIFT_TUNING.BENCH_WARMUP_FLOOR_MARGIN,
    );

    // EDGE 2 — THE DURATION, WHICH IS NOW CATEGORICAL. Every warm-up cell
    // reaches lockout unaided, inside the floor's own clock; no working cell
    // reaches it at all. See `FLOOR_EDGES` for what this used to read and why
    // it stopped being two numbers.
    const unaided = (cell: ReachableCell): { lockout: boolean; ticks: number } => {
      const state = driveGrind(
        { kind: BENCH, loadRatio: cell.loadRatio, seed: 1, feel: cell.feel },
        REACHABLE.GAP_TICKS,
        0,
        Number.POSITIVE_INFINITY,
      );
      return {
        lockout: state.resolution?.outcome !== 'miss',
        ticks: state.ascentTicks,
      };
    };
    const warmupAscents = warmups.map(unaided);
    expect(
      warmupAscents.filter((a) => !a.lockout).length,
      'warm-up cells that failed to lock out unaided',
    ).toBe(0);
    expect(
      Math.max(...warmupAscents.map((a) => a.ticks)),
      'the slowest unaided warm-up ascent',
    ).toBe(FLOOR_EDGES.WARMUP_SLOWEST_UNAIDED_ASCENT_TICKS);
    expect(FLOOR_EDGES.WARMUP_SLOWEST_UNAIDED_ASCENT_TICKS).toBeLessThan(
      LIFT_TUNING.BENCH_WARMUP_FLOOR_ASCENT_TICKS,
    );
    const completing = working.filter((c) => unaided(c).lockout).map((c) => c.label);
    expect(
      completing.length,
      `working cells that still lock out unaided: ${completing.join(', ')}`,
    ).toBe(FLOOR_EDGES.WORKING_CELLS_THAT_COMPLETE_UNAIDED);
    // ...AND THEY ARE BEATEN ON FORCE, NOT ON THE CLOCK, which is the half a
    // tick count cannot say. The bar reaches a high point and then goes
    // backwards, so no clock however long would change the answer — that is
    // what makes the separation wider than the 54 ticks the floor was chosen
    // from rather than merely different.
    for (const cell of working) {
      const state = driveGrind(
        { kind: BENCH, loadRatio: cell.loadRatio, seed: 1, feel: cell.feel },
        REACHABLE.GAP_TICKS,
        0,
        Number.POSITIVE_INFINITY,
      );
      expect(state.resolution?.stallTicks ?? 0, `${cell.label} never stalled`).toBeGreaterThan(0);
      expect(state.height, `${cell.label} did not sink back`).toBeLessThan(state.peakHeight);
    }
  });

  it('moves the working rungs\' tap floors and leaves the warm-ups without one', () => {
    // ------------------------------------------------------------------
    // THE MEASUREMENT THE 2026-08-27 RULING ASKED FOR: "At least one RPE 8
    // make floor moves UP in taps/second." All four do. See `WORKING_FLOOR`
    // for what a floor is here, why the ladder is every whole tick, and the
    // before-against-after row.
    // ------------------------------------------------------------------
    const floorOf = (cell: ReachableCell): number => {
      let floor: number = WORKING_FLOOR.SLOWEST_GAP_TICKS;
      for (
        let gap = WORKING_FLOOR.FASTEST_GAP_TICKS;
        gap <= WORKING_FLOOR.SLOWEST_GAP_TICKS;
        gap += 1
      ) {
        let made = 0;
        for (let seed = 1; seed <= WORKING_FLOOR.SEEDS; seed += 1) {
          const rep = driveGrind(
            { kind: BENCH, loadRatio: cell.loadRatio, seed, feel: cell.feel },
            gap,
            Number.POSITIVE_INFINITY,
            0,
          );
          if (rep.resolution?.outcome !== 'miss') made += 1;
        }
        if (made < WORKING_FLOOR.SEEDS) return gap - 1;
        floor = gap;
      }
      return floor;
    };
    const session = reachableSessionCells();
    const meet = reachableMeetCells();
    const sessionFloors = session.map(floorOf);
    const meetFloors = meet.map(floorOf);
    expect(sessionFloors, 'the session tap floors, in ticks between taps').toEqual([
      ...WORKING_FLOOR.SESSION_FLOOR_GAP_TICKS,
    ]);
    expect(meetFloors, 'the meet tap floors, in ticks between taps').toEqual([
      ...WORKING_FLOOR.MEET_FLOOR_GAP_TICKS,
    ]);

    // THE WARM-UP HALF, AS A NAMED SET AND NOT A COUNT. A count of ten is
    // satisfied by ten working cells going quiet, which is precisely the
    // failure this round is scoped against.
    const noCadenceCosts = session
      .filter((cell, i) => sessionFloors[i] === WORKING_FLOOR.SLOWEST_GAP_TICKS)
      .map((cell) => cell.label);
    expect(noCadenceCosts.length, 'cells no cadence ever costs').toBe(
      WORKING_FLOOR.CELLS_NO_CADENCE_COSTS,
    );
    expect(noCadenceCosts.sort()).toEqual(
      session
        .filter((c) => /^session\/rpe[67]\//.test(c.label))
        .map((c) => c.label)
        .sort(),
    );

    // THE LADDER IS STILL ORDERED, read off the vector above rather than
    // asserted separately, so it cannot be true of a table nobody drove. Every
    // RPE 8 cell asks a slower cadence than every RPE 9 cell, and every RPE 9
    // than every RPE 10 — 8 < 9 < 10, as the ruling requires.
    const rungFloors = (rpe: string): number[] =>
      session.filter((c) => c.label.startsWith(`session/${rpe}/`)).map((c, i, arr) => {
        void i;
        void arr;
        return sessionFloors[session.indexOf(c)] ?? 0;
      });
    const eight = rungFloors('rpe8');
    const nine = rungFloors('rpe9');
    const ten = rungFloors('rpe10');
    expect(eight.length, 'RPE 8 cells').toBe(4);
    expect(Math.min(...eight), 'RPE 8 fastest floor').toBeGreaterThan(Math.max(...nine));
    expect(Math.min(...nine), 'RPE 9 fastest floor').toBeGreaterThan(Math.max(...ten));
    // ...and the meet rides the top: its hardest cell asks more than anything a
    // session can prescribe.
    expect(Math.min(...meetFloors), 'the meet ceiling').toBeLessThan(Math.min(...ten));
  }, 300_000);

});

describe('the false-start rule, exactly as the copy states it', () => {
  // The sentence, verbatim, from `LIFT_COPY.SUBTITLE.bench`:
  //
  //   "Taps before the call count for nothing, and each one holds your press
  //    back, up to half a second."
  //
  // EACH CLAUSE IS DRIVEN SEPARATELY THROUGH THE SIM. A test that only checked
  // `grindStartTick`'s arithmetic would be checking the same expression the
  // copy was written from, and the copy and the mechanic could drift apart
  // without anything going red.
  //
  // REWRITTEN WHOLE FOR THE 2026-08-25 REPLAY STEER, and the previous sentence
  // is worth keeping in view because its arithmetic is what died: "each one
  // costs a tap off your burst — down to a floor of three" was about a tap
  // COUNT read once when a window closed, and a rolling charge has no such
  // count. The rule was re-derived rather than reworded.
  const load = LOAD_PRESETS.MAXIMAL;

  it('counts an early tap for nothing, AT EVERY TAP RATE', () => {
    // "AT EVERY TAP RATE" IS THE WHOLE POINT AND IT IS WHERE THE FIRST VERSION
    // OF THIS RULE WAS FALSE. The original lowered the burst's CEILING per
    // early tap, which cost nothing to anybody who was not going to reach the
    // ceiling — so two false starts were free at every rate below a mash. A
    // delay on the START of counting is charged to everybody, because
    // everybody's grind starts somewhere.
    let charged = 0;
    for (const gap of [
      GRIND_SWEEP.SPARSE_GAP_TICKS,
      GRIND_SWEEP.MODERATE_GAP_TICKS,
      GRIND_SWEEP.MASH_GAP_TICKS,
    ]) {
      const clean = benchGrindRep(load, 5, { gapTicks: gap });
      const jumped = benchGrindRep(load, 5, { gapTicks: gap, earlyTaps: 2 });
      expect(jumped.grindEarlyTaps, `gap ${gap}`).toBe(2);
      // Never stronger for jumping — the thing that would make mashing the
      // pause a strategy — at any rate.
      expect(jumped.launchForce, `gap ${gap}`).toBeLessThan(clean.launchForce);
      charged += 1;
    }
    expect(charged, `${charged} rungs were charged`).toBe(3);
  });

  it('holds the press back per early tap, up to the half second the copy names', () => {
    const { PER_EARLY_TAP_TICKS, MAX_LOCKOUT_TICKS } = LIFT_TUNING.GRIND_FALSE_START;
    // THE COPY'S OWN NUMBER, DERIVED RATHER THAN RESTATED. "Half a second" is
    // only true if the cap is exactly 500ms at this tick rate, so the sentence
    // is checked against the clock rather than against a second literal.
    expect(MAX_LOCKOUT_TICKS * TICK_MS).toBeCloseTo(500, 9);
    expect(LIFT_COPY.SUBTITLE.bench).toContain('up to half a second');

    // Driven through the SIM and compared against the rule, so a mechanic that
    // stopped charging would redden even though `grindStartTick` still
    // returned the right number.
    const forces: number[] = [];
    const capRung = Math.ceil(MAX_LOCKOUT_TICKS / PER_EARLY_TAP_TICKS);
    for (let early = 0; early <= capRung + 4; early += 1) {
      const rep = benchGrindRep(load, 5, {
        gapTicks: GRIND_SWEEP.MASH_GAP_TICKS,
        earlyTaps: early,
      });
      expect(rep.grindEarlyTaps, `early ${early}`).toBe(early);
      forces.push(rep.launchForce);
    }
    let strictDrops = 0;
    let previous = forces[0] ?? 0;
    for (let i = 1; i < forces.length; i += 1) {
      const force = forces[i] ?? 0;
      expect(force, `early ${i}`).toBeLessThanOrEqual(previous);
      if (force < previous) strictDrops += 1;
      previous = force;
    }
    // The clause bites for as many rungs as there is room between the command
    // and the LAUNCH, and then it has taken everything the launch had. Pinned
    // as a count so a charge that stopped charging, or a cap that stopped
    // capping, reports itself instead of passing.
    //
    // FOUR, AND NOT `MAX_LOCKOUT_TICKS / PER_EARLY_TAP_TICKS`. The binding
    // constraint is the launch beat (18 ticks) rather than the cap (30 ticks),
    // and the two are different numbers for a reason: the cap is what stops
    // the rule ever reaching into the ASCENT grind, which is what makes it
    // "costs the launch and never the rep", while the launch beat is what the
    // delay has to eat through before the launch reads zero. It is FOUR rather
    // than the launch beat's own 18/4 = 5 because the charge decays while the
    // delay runs (`GRIND_CHARGE_DECAY_PER_TICK`), so the last rung before the
    // beat is exhausted has already been pushed to zero. A tuner who lengthens
    // `PRESS_LAUNCH_MS` or slows the decay moves this count and not the cap.
    expect(strictDrops, `${strictDrops} rungs actually delayed the grind`).toBe(4);
    // The cap really is a cap: past it, more mashing changes nothing at all.
    expect(forces[capRung] ?? -1).toBe(forces[capRung + 4] ?? -2);
    expect(grindStartTick(100, capRung)).toBe(grindStartTick(100, capRung + 40));
  });

  it('cannot hand a player who mashed the pause an earlier start [a-false-start-can-never-pay]', () => {
    // THE DIRECTION THE OLD `Math.min` GUARDED, GUARDED HERE BY THE ARITHMETIC
    // HAVING NO NEGATIVE BRANCH. The delay is a non-negative product clamped
    // above, so zero early taps is the best case at every number and no false
    // start can move the grind's start EARLIER than the command.
    const command = 100;
    for (let early = 0; early <= 60; early += 1) {
      expect(grindStartTick(command, early), `early ${early}`).toBeGreaterThanOrEqual(command);
    }
    expect(grindStartTick(command, 0)).toBe(command);
    // ...and a player who mashed the pause and then never answered the command
    // still launches at nothing, because the floor is on the DELAY and there
    // is no floor on the force.
    const ignored = benchGrindRep(load, 5, { gapTicks: GRIND_SWEEP.NONE, earlyTaps: 12 });
    expect(ignored.grindEarlyTaps, 'no false start was thrown').toBe(12);
    expect(ignored.grindTaps).toBe(0);
    expect(ignored.launchForce).toBe(0);
  });

  it('never kills the rep, however long the pause is mashed', () => {
    // "HOLDS YOUR PRESS BACK" AND NOT "ENDS THE REP", consistent with the rule
    // the drive branch already states in capitals. A competition bench would
    // red light a press before the call outright; that is left on the table
    // deliberately, because a hard fail on a stimulus the player cannot see
    // coming reads as the game cheating.
    //
    // AND THE CONTINUOUS GRIND IS WHAT MAKES IT TRUE AT THE TOP OF THE LADDER.
    // Under the burst a maximally false-started player had a weaker burst and
    // nothing after it; here the grind is available for the whole ascent, so a
    // lost launch is a slower rep rather than a lost one.
    for (const sweepLoad of GRIND_SWEEP.LOADS) {
      const mashed = benchGrindRep(sweepLoad, 5, {
        gapTicks: GRIND_SWEEP.MASH_GAP_TICKS,
        earlyTaps: 30,
      });
      expect(mashed.resolution, `load ${sweepLoad}`).not.toBeNull();
      // The bar left the chest and the ascent ran: the false start did not
      // resolve the rep where it was thrown.
      expect(mashed.ascentTicks, `load ${sweepLoad}`).toBeGreaterThan(0);
      expect(mashed.resolution?.missReason, `load ${sweepLoad}`).not.toBe('buried');
      expect(mashed.resolution?.outcome, `load ${sweepLoad}`).not.toBe('miss');
      // It really did cost the launch, or the assertion above is about a rep
      // that was never charged.
      expect(mashed.launchForce, `load ${sweepLoad}`).toBe(0);
      // ...and the grind still ran, which is the thing that saved it.
      expect(mashed.grindTaps, `load ${sweepLoad}`).toBeGreaterThan(4);
    }
  });

  it('says so on the screen, at the moment it happens', () => {
    // The rule is otherwise invisible: the cost lands on a grind that has not
    // started yet. `promptFor` flips the waiting line the tick the first early
    // tap is thrown, and flips to the command when it fires.
    const { config, script } = benchToChest(load, 5, null);
    const command = commandTickFor(load, 5, null);
    expect(command).not.toBeNull();
    if (command === null) return;
    const jumpTick = command - 6;
    const history = runLift(
      config,
      [...script, { tick: jumpTick, kind: 'press' }],
      TOUCH_SWEEP.MAX_TICKS,
    ).history;
    const before = history.filter((s) => s.phase === 'HOLE' && s.tick < jumpTick);
    const after = history.filter(
      (s) => s.phase === 'HOLE' && s.tick >= jumpTick && s.tick < command,
    );
    const commanded = history.filter((s) => s.phase === 'HOLE' && s.tick >= command);
    expect(before.length, 'no pre-jump HOLE ticks').toBeGreaterThan(0);
    expect(after.length, 'no post-jump HOLE ticks').toBeGreaterThan(0);
    expect(commanded.length, 'no commanded HOLE ticks').toBeGreaterThan(0);
    for (const state of before) expect(promptFor(state)).toBe(LIFT_COPY.PROMPT.HOLE.bench);
    for (const state of after) expect(promptFor(state)).toBe(LIFT_COPY.PROMPT.HOLE_FALSE_START);
    for (const state of commanded) expect(promptFor(state)).toBe(LIFT_COPY.PROMPT.HOLE_COMMANDED);
  });
});

/**
 * ---------------------------------------------------------------------------
 * SQUAT AND DEADLIFT DID NOT MOVE — MEASURED AGAINST THE TREE BEFORE THE BENCH
 * REDESIGN, NOT ARGUED FROM THE DIFF
 * ---------------------------------------------------------------------------
 *
 * The 2026-08-25 ruling rewrote bench's DESCENT and HOLE branches, added six
 * state fields, added a `MissReason`, added two event kinds and gave
 * `ascentDemand` a sixth parameter. Every one of those is a place squat or
 * deadlift could have moved by accident, and none of them would fail to
 * compile. `tsc` is clean either way; the whole suite is green either way,
 * because a physics change shifts every number together and the assertions
 * about squat are about SHAPES.
 *
 * So this pins the shape a diff cannot see: play a representative set of squat
 * and deadlift reps and hash the whole history, field by field, tick by tick.
 *
 * WHAT IS HASHED, AND WHY IT IS A LIST AND NOT `JSON.stringify(state)`. The
 * list is exactly the `LiftState` fields that existed at the baseline commit,
 * MINUS the two the redesign deleted (`pressQuality`, `pressUsed`). It cannot
 * include the new fields — they did not exist to be measured — and it must not
 * be `Object.keys`, because that would silently start including them and the
 * digest would be about a different thing than the one it was taken from.
 *
 * THE TWO DELETED FIELDS ARE COVERED BY A STRUCTURAL ARGUMENT RATHER THAN BY
 * THE DIGEST, and it is written down rather than assumed: at the baseline they
 * were written in exactly one place, the bench arm of the HOLE branch, which
 * squat cannot enter (its HOLE takes the `else`) and deadlift cannot reach at
 * all (`stepLift` throws on a deadlift in HOLE). So on these two kinds they
 * were `0` and `false` on every tick of every rep, and a hash over them would
 * have been a hash over two constants.
 *
 * MEASURED AT `2d4ba0c` — the last commit before any bench work. Re-taking
 * these numbers means checking out that commit and running the same
 * projection; a stamp is checkable in a way a sentence is not (CLAUDE.md, "a
 * measurement that leaves this session carries the commit it was taken at").
 *
 * AND RE-AFFIRMED AT `98e78bc`, WHICH IS A SECOND MEASUREMENT RATHER THAN A
 * SECOND SENTENCE. That commit is the base of the 2026-08-25 REPLAY steer —
 * the tip after the first bench redesign landed and before the second one
 * started. This block was checked out there and run: `Tests 1 passed | 140
 * skipped (141)`, every digest holding. So the chain is closed by measurement
 * at both ends rather than by transitivity: squat and deadlift are byte-
 * identical from `2d4ba0c` through `98e78bc` to here, across two whole
 * redesigns of the third lift.
 *
 * WHY THE DIGESTS ARE NOT RE-TAKEN AT `98e78bc` AND RE-PINNED THERE. They
 * would be the same numbers — that is what the run above says — and moving the
 * stamp forward would quietly shorten the window the check covers. The value
 * of a digest is the distance between the commit it was taken at and the tree
 * it is compared against, so the older stamp is the stronger one.
 *
 * A DIGEST FAILS USELESSLY ON ITS OWN, so the test reports the case name and
 * the tick count beside it — the count is the first half of every digest for
 * exactly that reason, and a rep that resolved at a different tick says so in
 * the message rather than only in the hash.
 */
const BASELINE_COMMIT = '2d4ba0c';

/**
 * The `LiftState` fields that existed at `BASELINE_COMMIT`, minus the two the
 * bench redesign deleted. Written out rather than derived — see the block
 * above for why `Object.keys` would defeat the whole check.
 */
const BASELINE_FIELDS = [
  'tick', 'phase', 'phaseTick', 'held', 'depth', 'height', 'velocity', 'peakHeight', 'netForce',
  'barForwardPx', 'barLateralPx', 'barTiltDeg', 'barBendPx', 'chalkPuff', 'activeCue', 'timings',
  'depthAchieved', 'extraDepth', 'pressCommandTick', 'downCommandTick', 'lockoutSlipTicks',
  'drivesUsed', 'driveTick', 'driveQuality', 'driveArmReadyTick', 'ascentTicks', 'stallTicks',
  'stallCapacityLoss', 'lastStallPulseTick', 'resolution', 'events', 'rngState',
] as const;

/** Parameters of the baseline sweep. Named, so the digests can be re-taken. */
const BASELINE_SWEEP = {
  LOADS: [0.55, 0.7, 0.85, 1.0] as const,
  SEEDS: [1, 7, 20260801] as const,
  SQUAT_STYLES: ['ideal', 'nodrive', 'high', 'buried', 'early'] as const,
  DEADLIFT_STYLES: ['held', 'letgo'] as const,
  /** Depth a 'high' squat releases at. Above `DEPTH_LEGAL.squat`. */
  HIGH_DEPTH: 0.6,
  /** Ticks before a scripted 'early' drive. Well outside any window. */
  EARLY_DRIVE_TICKS: 9,
  /** Ticks a baseline rep is allowed. */
  MAX_TICKS: 1200,
  /** How many drive cues the deadlift script probes for. */
  MAX_DEADLIFT_CUES: 8,
  /** The hand-stepped control's load, seed, tick count and press tick. */
  STEPPED: { LOAD: 0.9, SEED: 3, TICKS: 40, PRESS_AT: 20 },
  /** Digests measured. Both kinds, all styles, plus the stepped control. */
  CASES: 85,
} as const;

function baselineDigest(history: readonly LiftState[]): string {
  const text = history
    .map((state) => {
      const row = state as unknown as Record<string, unknown>;
      return BASELINE_FIELDS.map((field) => JSON.stringify(row[field] ?? null)).join('|');
    })
    .join('\n');
  // FNV-1a, written out rather than imported: this file may not reach for a
  // hash the tree could change underneath it, or the pins below would expire
  // for a reason that has nothing to do with the lift.
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${history.length}:${hash.toString(16).padStart(8, '0')}`;
}

function baselineSquatScript(config: LiftConfig, style: string): ScriptedInput[] {
  const load = config.loadRatio;
  const press = braceTicks(load, 'squat') + 1;
  if (style === 'buried') return [{ tick: press, kind: 'press' }];
  const depth = style === 'high' ? BASELINE_SWEEP.HIGH_DEPTH : LIFT_TUNING.DEPTH_IDEAL.squat;
  const release = press + Math.round(depth / descentRate(load, 'squat'));
  const base: ScriptedInput[] = [
    { tick: press, kind: 'press' },
    { tick: release, kind: 'release' },
  ];
  if (style === 'nodrive') return base;
  const probe = runLift(config, base);
  const open = probe.history.find((state) => state.events.some((e) => e.kind === 'drive-cue-open'));
  const ideal = open?.activeCue?.idealTick ?? null;
  if (ideal === null) return base;
  return [
    ...base,
    { tick: ideal + (style === 'early' ? -BASELINE_SWEEP.EARLY_DRIVE_TICKS : 0), kind: 'press' },
  ];
}

function baselineDeadliftScript(config: LiftConfig, style: string): ScriptedInput[] {
  const load = config.loadRatio;
  let script: ScriptedInput[] = [{ tick: braceTicks(load, 'deadlift') + 1, kind: 'press' }];
  for (let i = 0; i < BASELINE_SWEEP.MAX_DEADLIFT_CUES; i += 1) {
    const probe = runLift(config, script, BASELINE_SWEEP.MAX_TICKS);
    const opens = probe.history.filter((state) =>
      state.events.some((e) => e.kind === 'drive-cue-open'),
    );
    const cue = opens[opens.length - 1]?.activeCue ?? null;
    if (cue === null || script.some((x) => x.tick === cue.idealTick)) break;
    script = [
      ...script,
      { tick: cue.idealTick - 1, kind: 'release' },
      { tick: cue.idealTick, kind: 'press' },
    ];
  }
  if (style === 'letgo') {
    const probe = runLift(config, script, BASELINE_SWEEP.MAX_TICKS);
    const lock = probe.history.find((state) => state.events.some((e) => e.kind === 'lockout'));
    if (lock !== undefined) script = [...script, { tick: lock.tick + 1, kind: 'release' }];
  }
  return script;
}

/**
 * Every digest, measured at `BASELINE_COMMIT` by running this file's own
 * projection against that tree.
 */
const BASELINE_DIGESTS: Readonly<Record<string, string>> = {
  'squat|0.55|1|ideal': '106:45dea612',
  'squat|0.55|1|nodrive': '107:cf89a101',
  'squat|0.55|1|high': '82:0579d09f',
  'squat|0.55|1|buried': '67:8c5fe3d6',
  'squat|0.55|1|early': '106:28e05d88',
  'deadlift|0.55|1|held': '158:bbf61dbf',
  'deadlift|0.55|1|letgo': '158:f00bdf10',
  'squat|0.55|7|ideal': '106:ecd8317b',
  'squat|0.55|7|nodrive': '107:629764d8',
  'squat|0.55|7|high': '82:a27412ef',
  'squat|0.55|7|buried': '67:a2604512',
  'squat|0.55|7|early': '106:407b708d',
  'deadlift|0.55|7|held': '121:1e15c8ea',
  'deadlift|0.55|7|letgo': '121:a0498175',
  'squat|0.55|20260801|ideal': '106:3c1d022b',
  'squat|0.55|20260801|nodrive': '107:80cdb8b9',
  'squat|0.55|20260801|high': '82:45dc4991',
  'squat|0.55|20260801|buried': '67:733504fa',
  'squat|0.55|20260801|early': '106:618ec87b',
  'deadlift|0.55|20260801|held': '135:e585a16a',
  'deadlift|0.55|20260801|letgo': '135:9972273f',
  'squat|0.7|1|ideal': '120:4b9a0c37',
  'squat|0.7|1|nodrive': '125:4592bf93',
  'squat|0.7|1|high': '92:4ce1cff3',
  'squat|0.7|1|buried': '76:78737435',
  'squat|0.7|1|early': '122:2db39c3f',
  'deadlift|0.7|1|held': '168:482a1162',
  'deadlift|0.7|1|letgo': '168:ff32ec8f',
  'squat|0.7|7|ideal': '120:82ffc6b1',
  'squat|0.7|7|nodrive': '125:3ce0032c',
  'squat|0.7|7|high': '92:faede64b',
  'squat|0.7|7|buried': '76:320974c5',
  'squat|0.7|7|early': '122:125bc3f2',
  'deadlift|0.7|7|held': '131:8d9f7cc3',
  'deadlift|0.7|7|letgo': '131:d339f0c1',
  'squat|0.7|20260801|ideal': '120:21cbd9cc',
  'squat|0.7|20260801|nodrive': '125:a78d895b',
  'squat|0.7|20260801|high': '92:8b90ca4a',
  'squat|0.7|20260801|buried': '76:aeced104',
  'squat|0.7|20260801|early': '122:597e6dbf',
  'deadlift|0.7|20260801|held': '145:5c21411e',
  'deadlift|0.7|20260801|letgo': '145:b42df87f',
  'squat|0.85|1|ideal': '143:c30acdc3',
  'squat|0.85|1|nodrive': '167:59fcbb36',
  'squat|0.85|1|high': '112:89031a76',
  'squat|0.85|1|buried': '89:e6809daa',
  'squat|0.85|1|early': '163:e8de0ee5',
  'deadlift|0.85|1|held': '200:42bdaf3d',
  'deadlift|0.85|1|letgo': '200:42bdaf3d',
  'squat|0.85|7|ideal': '143:a47bacfc',
  'squat|0.85|7|nodrive': '167:1461107d',
  'squat|0.85|7|high': '112:64ff2108',
  'squat|0.85|7|buried': '89:9f0dd6d9',
  'squat|0.85|7|early': '163:bb5ada9c',
  'deadlift|0.85|7|held': '163:20656d0b',
  'deadlift|0.85|7|letgo': '163:20656d0b',
  'squat|0.85|20260801|ideal': '143:589373a0',
  'squat|0.85|20260801|nodrive': '167:e06af169',
  'squat|0.85|20260801|high': '112:a4fc7e8b',
  'squat|0.85|20260801|buried': '89:275ed5b5',
  'squat|0.85|20260801|early': '163:af2015bb',
  'deadlift|0.85|20260801|held': '177:161d3510',
  'deadlift|0.85|20260801|letgo': '177:161d3510',
  'squat|1|1|ideal': '186:e35d9544',
  'squat|1|1|nodrive': '181:dc9b4243',
  'squat|1|1|high': '158:af4e4aab',
  'squat|1|1|buried': '110:ad3b82e8',
  'squat|1|1|early': '187:f7b0b9a6',
  'deadlift|1|1|held': '257:23e29e61',
  'deadlift|1|1|letgo': '201:4716804a',
  'squat|1|7|ideal': '186:69807d9f',
  'squat|1|7|nodrive': '181:6cdc91af',
  'squat|1|7|high': '158:4687dc50',
  'squat|1|7|buried': '110:c79dd89b',
  'squat|1|7|early': '187:e8fde677',
  'deadlift|1|7|held': '220:e88c2f4a',
  'deadlift|1|7|letgo': '220:9fb5763f',
  'squat|1|20260801|ideal': '186:676909a5',
  'squat|1|20260801|nodrive': '181:82d54048',
  'squat|1|20260801|high': '158:e349efac',
  'squat|1|20260801|buried': '110:e0b02940',
  'squat|1|20260801|early': '187:37b989f0',
  'deadlift|1|20260801|held': '234:8836faf3',
  'deadlift|1|20260801|letgo': '201:dcbe8893',
  'stepped|0.9|3|manual': '40:0b49d921',
};

describe('squat and deadlift are untouched by the bench redesign', () => {
  it('replays every baseline rep to the same history it had before the ruling [the-bench-redesign-left-the-other-two-lifts-alone]', () => {
    let checked = 0;
    const differences: string[] = [];
    for (const load of BASELINE_SWEEP.LOADS) {
      for (const seed of BASELINE_SWEEP.SEEDS) {
        for (const style of BASELINE_SWEEP.SQUAT_STYLES) {
          const config: LiftConfig = { kind: 'squat', loadRatio: load, seed };
          const key = `squat|${load}|${seed}|${style}`;
          const played = baselineDigest(
            runLift(config, baselineSquatScript(config, style), BASELINE_SWEEP.MAX_TICKS).history,
          );
          checked += 1;
          if (played !== BASELINE_DIGESTS[key]) {
            differences.push(`${key}: ${BASELINE_DIGESTS[key] ?? 'MISSING'} -> ${played}`);
          }
        }
        for (const style of BASELINE_SWEEP.DEADLIFT_STYLES) {
          const config: LiftConfig = { kind: 'deadlift', loadRatio: load, seed };
          const key = `deadlift|${load}|${seed}|${style}`;
          const played = baselineDigest(
            runLift(config, baselineDeadliftScript(config, style), BASELINE_SWEEP.MAX_TICKS)
              .history,
          );
          checked += 1;
          if (played !== BASELINE_DIGESTS[key]) {
            differences.push(`${key}: ${BASELINE_DIGESTS[key] ?? 'MISSING'} -> ${played}`);
          }
        }
      }
    }
    // The hand-stepped control, for `stepLift`'s own return shape rather than
    // `runLift`'s: a rep that never presses at all and is stepped past the
    // brace by hand.
    const { LOAD, SEED, TICKS, PRESS_AT } = BASELINE_SWEEP.STEPPED;
    let stepped = createLift({ kind: 'squat', loadRatio: LOAD, seed: SEED });
    const steppedHistory: LiftState[] = [];
    for (let i = 0; i < TICKS; i += 1) {
      stepped = stepLift(stepped, i === PRESS_AT ? { kind: 'press' } : null);
      steppedHistory.push(stepped);
    }
    const steppedKey = `stepped|${LOAD}|${SEED}|manual`;
    const steppedDigest = baselineDigest(steppedHistory);
    checked += 1;
    if (steppedDigest !== BASELINE_DIGESTS[steppedKey]) {
      differences.push(`${steppedKey}: ${BASELINE_DIGESTS[steppedKey] ?? 'MISSING'} -> ${steppedDigest}`);
    }

    // A COUNT FIRST, so an emptied sweep reports itself rather than passing on
    // zero comparisons — and the table has to be exactly as big as the sweep,
    // in both directions, so a stale row cannot sit there unread.
    expect(BASELINE_SWEEP.CASES, 'the domain this count is taken over').toBe(85);
    expect(checked, 'no baseline reps were played').toBe(BASELINE_SWEEP.CASES);
    expect(Object.keys(BASELINE_DIGESTS).length).toBe(BASELINE_SWEEP.CASES);
    // Every digest carries its tick count, so a rep that resolved at a
    // different tick says so in this message rather than only in the hash.
    expect(
      differences,
      `${differences.length} of ${checked} baseline reps moved since ${BASELINE_COMMIT}`,
    ).toEqual([]);
  });

  it('would notice a change, so the digests are not decoration', () => {
    // NON-VACUITY FOR THE WHOLE BLOCK ABOVE. A hash over a projection is
    // exactly the kind of check that can be pointing at nothing — a projection
    // that read no fields, or a hash that ignored its input, would produce
    // stable digests forever and match every pin. So: two reps that differ by
    // one input must hash differently, and the same rep must hash the same.
    const config: LiftConfig = { kind: 'squat', loadRatio: 0.85, seed: 7 };
    const ideal = baselineDigest(
      runLift(config, baselineSquatScript(config, 'ideal'), BASELINE_SWEEP.MAX_TICKS).history,
    );
    const nodrive = baselineDigest(
      runLift(config, baselineSquatScript(config, 'nodrive'), BASELINE_SWEEP.MAX_TICKS).history,
    );
    expect(ideal).not.toBe(nodrive);
    expect(ideal).toBe(
      baselineDigest(
        runLift(config, baselineSquatScript(config, 'ideal'), BASELINE_SWEEP.MAX_TICKS).history,
      ),
    );
    // ...and the projection really reads the fields it lists, rather than
    // hashing a row of `null`s: a state with one field changed must hash
    // differently from the untouched one.
    const played = runLift(config, baselineSquatScript(config, 'ideal'), BASELINE_SWEEP.MAX_TICKS)
      .history;
    const first = played[0];
    expect(first, 'no history to perturb').toBeDefined();
    if (first === undefined) return;
    for (const field of BASELINE_FIELDS) {
      const perturbed = [{ ...first, [field]: 'PERTURBED' } as unknown as LiftState, ...played.slice(1)];
      expect(baselineDigest(perturbed), `field ${field} is not read by the projection`).not.toBe(
        baselineDigest(played),
      );
    }
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

/**
 * Parameters of the NEVER-PRESS sweep: a deadlift played by a player whose
 * finger never touches the glass at all.
 *
 * -------------------------------------------------------------------------
 * WHY THIS SWEEP EXISTS, WHICH IS NOT THE SAME AS WHAT IT MEASURES.
 * -------------------------------------------------------------------------
 * `stepLift`'s deadlift BRACE branch carries a paragraph saying `m.held` is
 * deliberately NOT forced true there, unlike the descent branch four lines
 * below it. For a round that was prose with nothing behind it: an independent
 * critic inserted the one line the paragraph names and the whole suite stayed
 * green, while a player who never touched the screen took a clean deadlift at
 * every load, 100 of 100. The forced grip is never released, so the ascent
 * needs no drive taps AND the lockout sag branch can never fire — one
 * assignment, both of deadlift's checks gone.
 *
 * THE LOADS ARE THE CRITIC'S, KEPT VERBATIM so the reproduction is exact, and
 * they stop at 0.85 for a reason worth declaring rather than leaving implied:
 * above it an undriven pull misses on the ASCENT and never reaches the hold at
 * all, so a heavier arm would report 'miss' for a reason this sweep is not
 * about. That the ascent must be driven at a limit pull is pinned separately,
 * by "still needs the ascent driven at a limit pull".
 *
 * The two lightest are `LOAD_PRESETS.WARMUP` and `LOAD_PRESETS.LIGHT`, and
 * what they produce is a GRIND rather than a miss — GDD §12.3's warm-up
 * guarantee holding at exactly the load a distracted player is most likely to
 * meet it at.
 */
const NEVER_PRESS_SWEEP = {
  SEEDS: 25,
  LOADS: [LOAD_PRESETS.WARMUP, LOAD_PRESETS.LIGHT, 0.7, 0.85] as const,
  /** Ticks each rep is given: the whole brace timeout, an ascent, and a hold. */
  MAX_TICKS: 2000,
  /** Measured at the shipped tuning. */
  CASES: 100,
  /** The claim. A rep nobody played is never a clean lift. */
  GOOD_LIFTS: 0,
  /** Non-vacuity: the two outcomes the untouched rep actually reaches. */
  GRINDS: 81,
  DROPPED: 19,
  /**
   * THE COMPARISON THAT MAKES `GOOD_LIFTS: 0` A CLAIM. Without it the pin above
   * is equally satisfied by a build where nobody can EVER get a clean lift at
   * these loads. Same 100 configs, driven up and held.
   */
  DRIVEN_GOOD_LIFTS: 100,
} as const;

/**
 * Parameters of the DOWN-COMMAND DELAY sweep, which grades `downCommandDelayTicks`'s
 * own docstring rather than a played rep's outcome in isolation.
 *
 * Every reachable delay, sampled at `SEEDS_PER_DELAY` distinct seeds, against
 * every load in `DEADLIFT_SWEEP.LOADS`. The seed is what draws the delay, so
 * "every delay" has to be reached by searching seeds rather than by setting a
 * number — and the seed also drives the bar jitter, so more than one seed per
 * delay is what stops the sweep being a statement about 61 particular reps.
 */
const DELAY_SWEEP = {
  SEEDS_PER_DELAY: 3,
  /** Seeds searched to find them. Every delay in the range is reachable well inside this. */
  SEED_SEARCH_LIMIT: 20000,
  MAX_TICKS: 2000,
  /** Measured: distinct delays `downCommandDelayTicks` can draw. */
  DELAYS: 61,
  CASES: 1098,
  /** Claim 1: holding makes the lift at every delay. No misses anywhere. */
  HELD_MAKES: 1098,
  HELD_GOOD_LIFTS: 549,
  HELD_GRINDS: 549,
  /** Claim 2: letting go and staying off is never rewarded. */
  LET_GO_GOOD_LIFTS: 0,
  /** And what it costs instead — the split the old docstring got wrong. */
  LET_GO_GRINDS: 351,
  LET_GO_DROPPED: 747,
  /** Cases where the closed-form sag threshold disagreed with the played rep. */
  CLOSED_FORM_MISMATCHES: 0,
} as const;

/** How many disagreeing cases the delay sweep names in its failure message. */
const DELAY_SWEEP_DISAGREEMENTS_REPORTED = 12;

/**
 * Parameters of the derived-depth track sweep — deadlift's one output that
 * exists only for the drawing.
 */
const DEPTH_TRACK_SWEEP = {
  SEEDS: 4,
  MAX_TICKS: 2000,
  REPS: 24,
  /**
   * Ascent ticks the ASCENT BRANCH ITSELF WROTE A DEPTH ON, across the sweep.
   *
   * `phaseTick > 0` is what selects them, and it is load-bearing rather than
   * tidiness. The tick that ENTERS the ascent is written by the BRACE branch,
   * which does not touch `m.depth` — so that state still carries `createLift`'s
   * opening 1, which no mutant to the derivation can move. A max taken over the
   * unfiltered phase is therefore a claim about `createLift` wearing the
   * grammar of a claim about the drawing, and a halve-the-track mutant walks
   * straight past it. Measured: unfiltered the sweep is 2204 ticks and its max
   * is exactly 1 whatever the branch does.
   */
  BRANCH_WRITTEN_TICKS: 2180,
  /** Distinct derived depths across the whole sweep. THE FACT THAT IT MOVES. */
  DISTINCT_DEPTHS: 2180,
  /**
   * The track's halfway mark, and the ticks either side of it.
   *
   * A distinct count alone survives a SCALE error — a track running 0..0.5 has
   * exactly as many distinct values and draws a lifter who never bends to the
   * bar. These two counts are what separate the two, and they are counts rather
   * than a pinned float so a legitimate retune moves them legibly instead of
   * failing on a seventh decimal place.
   */
  HALFWAY_DEPTH: 0.5,
  DEEP_TICKS: 1012,
  SHALLOW_TICKS: 1168,
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

  it('leaves the grip where the player left it when the brace ends — the descent branch does not', () => {
    // ---------------------------------------------------------------------
    // THE DEADLIFT BRACE BRANCH'S OWN GUARANTEE, READ DIRECTLY.
    //
    // `stepLift` says, in prose, that `m.held` is NOT forced true on the
    // deadlift arm "unlike the descent branches below". It was prose with
    // nothing behind it: adding `m.held = true;` there left the whole suite
    // green. This is the assertion at the level the sentence is written at —
    // the outcome sweep in the lockout block is the one that says why it
    // matters.
    //
    // THE DISCRIMINATOR IS THE SIBLING BRANCH, WHICH IS THE POINT. Squat and
    // bench take the `else` arm four lines down and it DOES set `m.held =
    // true`. Same input (none at all), same brace timeout, opposite grip
    // state, and the only thing that differs is the lift. An assertion that
    // only read deadlift's `false` would be satisfied by a `held` field
    // nothing ever writes.
    // ---------------------------------------------------------------------
    let checked = 0;
    for (const load of DEADLIFT_SWEEP.LOADS) {
      const exit = (kind: PlayableLiftKind): LiftState | undefined =>
        runLift({ kind, loadRatio: load, seed: 1 }, [], NEVER_PRESS_SWEEP.MAX_TICKS).history.find(
          (s) => s.phase !== 'BRACE',
        );

      const deadlift = exit(DEADLIFT);
      expect(deadlift, `deadlift at ${load} never left BRACE`).toBeDefined();
      expect(deadlift?.phase, `load ${load}`).toBe('ASCENT');
      expect(deadlift?.held, `the deadlift brace forced the finger down at ${load}`).toBe(false);

      for (const kind of ['squat', 'bench'] as const) {
        const eccentric = exit(kind);
        expect(eccentric, `${kind} at ${load} never left BRACE`).toBeDefined();
        expect(eccentric?.phase, `${kind} at ${load}`).toBe('DESCENT');
        expect(eccentric?.held, `the ${kind} brace did not take the grip at ${load}`).toBe(true);
      }
      checked += 1;
    }
    // Counts, not bounds — a loop over an empty load list asserts nothing.
    expect(checked, 'no loads were checked').toBe(DEADLIFT_SWEEP.LOADS.length);
  });

  it('derives a depth track for the drawing that actually moves down the ascent', () => {
    // ---------------------------------------------------------------------
    // `m.depth` ON A DEADLIFT IS NOT A JUDGEMENT, IT IS A DRAWING. No outcome
    // reads it — `depthAchieved` starts true and the LOCKOUT branch never
    // consults depth — so it is exactly the shape of value that can be
    // silently nulled with every outcome test still green. Measured: replacing
    // `scrub(clamp01(1 - m.height))` with `0` survives the whole suite.
    //
    // ASSERTED AS THE THIRD OF THE THREE PROGRESSION FACTS. "Never invalid"
    // and "never regresses" are both true of a constant; only a count of
    // DISTINCT values says the track moves. The deep/shallow split is beside
    // it because a distinct count alone survives a SCALE error, which is a
    // different mutant and not a weaker one.
    //
    // ONE ASSERTION WAS DELETED FROM THIS TEST FOR BEING DOMINATED, and the
    // domination is recorded rather than the check quietly dropped. A
    // `collapsedReps === 0` pin cannot fail while the two lines below hold:
    // `distinct === BRANCH_WRITTEN_TICKS` with `distinct_i <= ticks_i` forces
    // `distinct_i === ticks_i` for every rep, and the shortest rep in this
    // sweep is 47 ticks, so no rep can be down to one value. Two checks where
    // one can never speak.
    //
    // WHAT THIS DOES AND DOES NOT COVER. It is the raw derived value, which is
    // strictly finer than what reaches the sprite: `liftFrameSpec` quantises
    // to `QUANTISE.DEPTH_STEPS` before anything is drawn, so a collapse here
    // is visible there and not every wobble here is. Whether the resulting
    // figure looks like a deadlift is not a question this file can ask.
    // ---------------------------------------------------------------------
    let reps = 0;
    let branchWritten = 0;
    let distinct = 0;
    let deep = 0;
    let shallow = 0;
    for (const load of DEADLIFT_SWEEP.LOADS) {
      for (let seed = 1; seed <= DEPTH_TRACK_SWEEP.SEEDS; seed += 1) {
        const config: LiftConfig = { kind: DEADLIFT, loadRatio: load, seed };
        // `phaseTick > 0` drops the entering tick, which the BRACE branch wrote
        // and the derivation never touched. See `BRANCH_WRITTEN_TICKS`.
        const written = runLift(
          config,
          deadliftAscent(config),
          DEPTH_TRACK_SWEEP.MAX_TICKS,
        ).history.filter((s) => s.phase === 'ASCENT' && s.phaseTick > 0);
        for (const state of written) {
          expect(
            state.depth,
            `load ${load} seed ${seed} tick ${state.tick} drew an undrawable depth`,
          ).toBeGreaterThanOrEqual(0);
          expect(
            state.depth,
            `load ${load} seed ${seed} tick ${state.tick} drew an undrawable depth`,
          ).toBeLessThanOrEqual(1);
          if (state.depth >= DEPTH_TRACK_SWEEP.HALFWAY_DEPTH) deep += 1;
          else shallow += 1;
        }
        distinct += new Set(written.map((s) => s.depth)).size;
        branchWritten += written.length;
        reps += 1;
      }
    }
    // Counts, not bounds — and the domain first, so a sweep that never left the
    // brace reports itself rather than passing on an empty set.
    expect(reps, 'no reps were played').toBe(DEPTH_TRACK_SWEEP.REPS);
    expect(branchWritten, 'the ascent branch wrote no depths to read').toBe(
      DEPTH_TRACK_SWEEP.BRANCH_WRITTEN_TICKS,
    );
    // FACT 3: IT MOVES.
    expect(distinct, `the drawn depth took ${distinct} distinct values across the sweep`).toBe(
      DEPTH_TRACK_SWEEP.DISTINCT_DEPTHS,
    );
    // ...and it moves across the whole range rather than inside a squashed one.
    expect(deep, `${deep} ticks drew the lifter still down at the bar`).toBe(
      DEPTH_TRACK_SWEEP.DEEP_TICKS,
    );
    expect(shallow, `${shallow} ticks drew the lifter near lockout`).toBe(
      DEPTH_TRACK_SWEEP.SHALLOW_TICKS,
    );
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
    expect(LIFT_COPY.PROMPT.LOCKOUT.squat).not.toBe(LIFT_COPY.PROMPT.LOCKOUT.deadlift);
    expect(LIFT_COPY.PROMPT.LOCKOUT.bench).not.toBe(LIFT_COPY.PROMPT.LOCKOUT.deadlift);
  });

  it('is not live on a squat or a bench that is genuinely standing in LOCKOUT', () => {
    // ---------------------------------------------------------------------
    // THE KIND GUARD, WHICH WAS UNTESTED WHILE LOOKING TESTED — the exact
    // shape CLAUDE.md calls an empty domain. The assertion that appeared to
    // cover it was `expect(lockoutHoldIsLive(squat)).toBe(false)` handed
    // `play(...)`, whose return value is always RESOLVED, so it exercised the
    // PHASE guard and stopped there. Measured: deleting
    // `if (state.config.kind !== 'deadlift') return false;` left every test in
    // this file green.
    //
    // AND THE STATE BELOW IS THE ONE THE GUARD IS LOAD-BEARING IN, not merely
    // one that reaches it. `downCommandTick` is null for a squat for the whole
    // rep, and the null arm of this predicate returns TRUE — deliberately, so
    // that deadlift's "don't let go" line is up on the frame the bar arrives.
    // So on an eccentric lockout every other line in the function votes
    // "live", and the kind guard is the only thing between a squat and
    // deadlift's copy.
    // ---------------------------------------------------------------------
    let checked = 0;
    for (const kind of ['squat', 'bench'] as const) {
      const lockout = eccentricLockoutStates(kind, LOAD_PRESETS.HEAVY);
      expect(lockout.length, `a ${kind} at HEAVY never reached LOCKOUT`).toBeGreaterThan(0);
      for (const state of lockout) {
        // Both facts spelled out, because the second is why the first bites:
        // the state really is in the phase, and the phase guard really does
        // pass it through to the kind guard.
        expect(state.phase, `${kind} tick ${state.tick}`).toBe('LOCKOUT');
        expect(state.downCommandTick, `${kind} tick ${state.tick}`).toBeNull();
        expect(lockoutHoldIsLive(state), `${kind} tick ${state.tick}`).toBe(false);
        expect(promptFor(state), `${kind} tick ${state.tick}`).toBe(LIFT_COPY.PROMPT.LOCKOUT[kind]);
        checked += 1;
      }
    }
    // Counts, not bounds. An empty history would satisfy the loop trivially.
    expect(checked, 'no eccentric lockout ticks were checked').toBe(ECCENTRIC_LOCKOUT_TICKS);
    // ...and the PHASE guard keeps its own case rather than being folded into
    // this one, since a state that fails both guards proves neither.
    const resolvedDeadlift = deadliftRep(LOAD_PRESETS.HEAVY, 4, DEADLIFT_SWEEP.HELD);
    expect(resolvedDeadlift.phase).toBe('RESOLVED');
    expect(lockoutHoldIsLive(resolvedDeadlift)).toBe(false);
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

  it('never hands a clean lift to a player who never touches the screen', () => {
    // ---------------------------------------------------------------------
    // THE TEST THE BRACE BRANCH'S PROSE DID NOT HAVE, AND THE ONE THE BENCH
    // DEFECT WOULD HAVE NEEDED.
    //
    // `stepLift`'s deadlift BRACE arm says `m.held` is deliberately not forced
    // true. Adding `m.held = true;` there is a one-line edit that leaves
    // `tsc` clean and — before this test — the whole suite green, while
    // handing a player who never touched the glass a CLEAN DEADLIFT at every
    // load. The grip is never released, so the ascent needs no drive taps and
    // the lockout sag branch can never fire.
    //
    // ASSERTED ON `resolution.outcome` AND NOTHING ELSE, for the reason this
    // block's header records: eight mutants once passed against the bench
    // command because every one of them asked whether a mechanism RAN. A
    // forced grip is a mechanism running perfectly.
    //
    // NO INPUT AT ALL, not "a bad input". The brace starts the pull by itself
    // at `BRACE_TIMEOUT_TICKS`, so a rep with an empty script is a real rep
    // that a real distracted player produces — it is not a synthetic state.
    // ---------------------------------------------------------------------
    const outcomes: Record<string, number> = {};
    let cases = 0;
    let goodLifts = 0;
    let grinds = 0;
    let dropped = 0;
    let drivenGoodLifts = 0;
    for (const load of NEVER_PRESS_SWEEP.LOADS) {
      for (let seed = 1; seed <= NEVER_PRESS_SWEEP.SEEDS; seed += 1) {
        const config: LiftConfig = { kind: DEADLIFT, loadRatio: load, seed };
        const untouched = runLift(config, [], NEVER_PRESS_SWEEP.MAX_TICKS).final.resolution;
        expect(untouched, `load ${load} seed ${seed} never resolved`).not.toBeNull();
        const outcome = untouched?.outcome;
        outcomes[`${load}:${outcome}`] = (outcomes[`${load}:${outcome}`] ?? 0) + 1;
        if (outcome === 'good-lift') goodLifts += 1;
        if (outcome === 'grind') grinds += 1;
        if (outcome === 'miss' && untouched?.missReason === 'dropped') dropped += 1;
        // THE SAME CONFIG, PLAYED. Without this arm the zero below is equally
        // true of a build where a clean lift is unreachable at these loads.
        if (
          runLift(config, deadliftAscent(config), NEVER_PRESS_SWEEP.MAX_TICKS).final.resolution
            ?.outcome === 'good-lift'
        ) {
          drivenGoodLifts += 1;
        }
        cases += 1;
      }
    }
    // Counts, not bounds, and the domain first.
    expect(cases, 'no reps were played').toBe(NEVER_PRESS_SWEEP.CASES);
    expect(
      goodLifts,
      `an untouched screen produced ${goodLifts} clean lifts: ${JSON.stringify(outcomes)}`,
    ).toBe(NEVER_PRESS_SWEEP.GOOD_LIFTS);
    expect(drivenGoodLifts, 'nobody can get a clean lift at these loads at all').toBe(
      NEVER_PRESS_SWEEP.DRIVEN_GOOD_LIFTS,
    );
    // What the untouched rep DOES get, split, so a sweep that collapsed onto
    // one outcome for a new reason reports itself rather than staying green on
    // the zero above.
    expect(grinds, `untouched grinds: ${JSON.stringify(outcomes)}`).toBe(
      NEVER_PRESS_SWEEP.GRINDS,
    );
    expect(dropped, `untouched drops: ${JSON.stringify(outcomes)}`).toBe(
      NEVER_PRESS_SWEEP.DROPPED,
    );
    // GDD §12.3, at the two loads a player meets it at: a warm-up left alone
    // is a grind, never a lost rep. This is the same guarantee the warm-up
    // test below plays with a scripted release, reached by doing nothing.
    for (const load of [LOAD_PRESETS.WARMUP, LOAD_PRESETS.LIGHT]) {
      expect(outcomes[`${load}:grind`], `warm-up load ${load} was not left alone`).toBe(
        NEVER_PRESS_SWEEP.SEEDS,
      );
    }
  });

  it('never rewards letting go, and loses the bar exactly when the sag arithmetic says so', () => {
    // ---------------------------------------------------------------------
    // `downCommandDelayTicks`'s DOCSTRING, GRADED. It claimed two things, and
    // the second was false as written: "at every delay one who lets go and
    // stays off loses it". At the shortest delays the releaser gets a GRIND,
    // because the bar has not had time to fall `LOCKOUT_DROP_HEIGHT_LOSS`.
    //
    // IT WAS FALSE BY DESIGN, WHICH IS WHY REWORDING IT WAS THE FIX RATHER
    // THAN RETUNING. The same inequality is `lockoutSagPerTick`'s §12.3
    // promise seen from the other end: at the light end the threshold is far
    // past `DOWN_COMMAND_DELAY_TICKS.MAX`, so a warm-up CANNOT be dropped
    // whatever the player does. Making the old sentence true would have meant
    // breaking a refusal condition.
    //
    // THE CLOSED FORM IS NOT AN ORACLE MIRRORING ITS SUBJECT. `stepLift` sags
    // the bar a tick at a time and compares a height; this compares a delay to
    // a threshold in ticks. Different derivations, and their agreeing on every
    // case is the claim.
    // ---------------------------------------------------------------------
    const seedsFor = new Map<number, number[]>();
    for (let seed = 1; seed <= DELAY_SWEEP.SEED_SEARCH_LIMIT; seed += 1) {
      const delay = downCommandDelayTicks(seed);
      const found = seedsFor.get(delay) ?? [];
      if (found.length < DELAY_SWEEP.SEEDS_PER_DELAY) {
        found.push(seed);
        seedsFor.set(delay, found);
      }
    }
    const delays = [...seedsFor.keys()].sort((a, b) => a - b);

    /**
     * Ticks past the grace the bar needs to have fallen far enough to be lost,
     * read off the two tuning constants rather than off the sim.
     */
    const dropsAt = (load: number, delay: number): boolean =>
      delay >
      LIFT_TUNING.LOCKOUT_GRIP_GRACE_TICKS +
        LIFT_TUNING.LOCKOUT_DROP_HEIGHT_LOSS / lockoutSagPerTick(load);

    let cases = 0;
    let heldMakes = 0;
    let heldGoodLifts = 0;
    let heldGrinds = 0;
    let letGoGoodLifts = 0;
    let letGoGrinds = 0;
    let letGoDropped = 0;
    let mismatches = 0;
    const disagreements: string[] = [];
    for (const delay of delays) {
      for (const seed of seedsFor.get(delay) ?? []) {
        for (const load of DEADLIFT_SWEEP.LOADS) {
          const config: LiftConfig = { kind: DEADLIFT, loadRatio: load, seed };
          const ascent = deadliftAscent(config);
          const lockout = deadliftLockoutTick(config, ascent);
          expect(lockout, `delay ${delay} seed ${seed} load ${load} never locked out`).not.toBeNull();
          if (lockout === null) continue;
          // BOTH ARMS SHARE AN ASCENT EXACTLY, same as `deadliftRep`: the
          // release is strictly after lockout, so every difference is the hold.
          const held = runLift(config, ascent, DELAY_SWEEP.MAX_TICKS).final.resolution;
          const letGo = runLift(
            config,
            [...ascent, { tick: lockout + DEADLIFT_SWEEP.LET_GO_AFTER_TICKS, kind: 'release' }],
            DELAY_SWEEP.MAX_TICKS,
          ).final.resolution;
          if (held?.outcome !== 'miss') heldMakes += 1;
          if (held?.outcome === 'good-lift') heldGoodLifts += 1;
          if (held?.outcome === 'grind') heldGrinds += 1;
          if (letGo?.outcome === 'good-lift') letGoGoodLifts += 1;
          if (letGo?.outcome === 'grind') letGoGrinds += 1;
          if (letGo?.outcome === 'miss' && letGo.missReason === 'dropped') letGoDropped += 1;
          if ((letGo?.outcome === 'miss') !== dropsAt(load, delay)) {
            mismatches += 1;
            if (disagreements.length < DELAY_SWEEP_DISAGREEMENTS_REPORTED) {
              disagreements.push(`load ${load} delay ${delay} seed ${seed} -> ${letGo?.outcome}`);
            }
          }
          cases += 1;
        }
      }
    }
    // Counts, not bounds. The domain first — a search that found no seeds for
    // a delay would quietly shrink this sweep.
    expect(delays.length, 'delays reachable from a seed').toBe(DELAY_SWEEP.DELAYS);
    expect(cases, 'no reps were played').toBe(DELAY_SWEEP.CASES);
    // CLAIM 1: the draw never takes the rep off a player who holds.
    expect(heldMakes, `holding made the lift in ${heldMakes} of ${cases}`).toBe(
      DELAY_SWEEP.HELD_MAKES,
    );
    expect(heldGoodLifts).toBe(DELAY_SWEEP.HELD_GOOD_LIFTS);
    expect(heldGrinds).toBe(DELAY_SWEEP.HELD_GRINDS);
    // CLAIM 2: letting go is never rewarded, at any delay or load.
    expect(
      letGoGoodLifts,
      `letting go still got a clean lift in ${letGoGoodLifts} of ${cases}`,
    ).toBe(DELAY_SWEEP.LET_GO_GOOD_LIFTS);
    // WHICH ONE IT COSTS IS THE CLOSED FORM'S CLAIM, AND IT IS ASSERTED BEFORE
    // THE AGGREGATES ON PURPOSE. A tuning pass moves the aggregates and somebody
    // re-pins them from a fresh run; this line is the one that still has
    // something to say afterwards, because it compares the sim against
    // arithmetic rather than against a number copied out of the sim. Putting it
    // last would mean every threshold defect reported itself as "201 expected
    // 351" instead of naming the load and the delay it happened at.
    expect(
      mismatches,
      `the sag arithmetic disagreed with the sim: ${disagreements.join('; ')}`,
    ).toBe(DELAY_SWEEP.CLOSED_FORM_MISMATCHES);
    // AND THE SPLIT THE OLD SENTENCE GOT WRONG, pinned rather than described.
    expect(letGoGrinds, `letting go cost only the clean lift in ${letGoGrinds} of ${cases}`).toBe(
      DELAY_SWEEP.LET_GO_GRINDS,
    );
    expect(letGoDropped).toBe(DELAY_SWEEP.LET_GO_DROPPED);
    expect(letGoGrinds + letGoDropped, 'an outcome escaped both arms').toBe(cases);
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


/**
 * `descentPatience` AND `touchQualityFor` WERE GRADED HERE AND ARE DELETED.
 *
 * The dawdle charge existed because braking early and feathering the bar in
 * was a free perfect touch. Under the 2026-08-25 replay steer the bar cannot
 * be slowed below the controlled rate at all, so a descent's LENGTH is a
 * constant per load and the charge had an empty domain — a check on it could
 * not have been reddened by any input the player can produce, which is the
 * vacuity definition this file works to.
 *
 * `touchQualityFor` was the product of the two halves. With one half gone it
 * would have been a one-argument alias of `touchSpeedQuality`, so it went too
 * rather than staying as a name that implied a composition it no longer made.
 *
 * WHAT THEIR DELETION DOMINATED, checked rather than assumed: the four
 * `describe` bodies below them ("leaves a committed descent alone…", "gives a
 * heavier bar a longer budget…", "multiplies into one grade…") had no subject
 * left and are deleted with them. `BENCH_DESCENT_PATIENCE_TICKS` and
 * `BENCH_DESCENT_DAWDLE_SPAN_TICKS` were read by those bodies and by
 * `liftTuning.test.ts`'s budget checks and by nothing else.
 */
describe('touchSpeedQuality', () => {
  const softAt = (load: number): number =>
    byLoad(LIFT_TUNING.BENCH_TOUCH_SOFT_RATE, clampLoadRatio(load));
  const crashAt = (load: number): number =>
    byLoad(LIFT_TUNING.BENCH_TOUCH_CRASH_RATE, clampLoadRatio(load));

  it('is 1 at a caught bar, 0 at a dropped one, and never rises with speed', () => {
    for (const load of TOUCH_SWEEP.LOADS) {
      const soft = softAt(load);
      const crash = crashAt(load);
      expect(touchSpeedQuality(soft, load), `load ${load}`).toBe(1);
      expect(touchSpeedQuality(soft / 2, load), `load ${load}`).toBe(1);
      expect(touchSpeedQuality(crash, load), `load ${load}`).toBe(0);
      expect(touchSpeedQuality(crash * 2, load), `load ${load}`).toBe(0);
      let previous = Number.POSITIVE_INFINITY;
      const distinct = new Set<number>();
      for (let rate = 0; rate <= crash * 1.5; rate += crash / 60) {
        const quality = touchSpeedQuality(rate, load);
        expect(quality, `load ${load} rate ${rate}`).toBeLessThanOrEqual(previous);
        previous = quality;
        distinct.add(quality);
      }
      // It MOVES, not merely stays in range — fact 3 of the progression rule.
      expect(distinct.size, `load ${load}: ${distinct.size} distinct qualities`).toBeGreaterThan(20);
    }
  });

  it('grades the same arrival speed differently under a heavier bar', () => {
    // THE LOAD-SCALING THAT SURVIVED THE REPLAY STEER, AND ITS NARROWER
    // REASON. It used to carry the open-loop property — one speed is not one
    // grade, so no memorised rhythm wins everywhere. The steer retired that
    // search (see `OPEN_LOOP_SEARCH`'s note above), and what is left is
    // simpler and still real: the same SLIP has to cost more under a heavier
    // bar, and a single threshold cannot do that.
    const probe = softAt(LOAD_PRESETS.LIGHT);
    expect(touchSpeedQuality(probe, LOAD_PRESETS.LIGHT)).toBe(1);
    // The speed a warm-up is CAUGHT at is most of the way to a crash on a
    // limit bar.
    //
    // NOT 0, AND THE WEAKER CLAIM IS THE HONEST ONE. It used to be 0 — full
    // band separation, `crash(MAXIMAL) < soft(LIGHT)` — because the open-loop
    // property needed the whole graded band to MOVE rather than merely slope.
    // That property is retired with the search (see `OPEN_LOOP_SEARCH`'s note),
    // and the constants that would restore separation are knife-edge against
    // the steer's own inequality (`controlled <= soft` at every load): three
    // margins under 0.0013 in a file GDD §10 expects a playtester to turn
    // thirty times. So the assertion is what the tuning actually supports —
    // strictly and substantially worse under load — and `liftTuning.test.ts`
    // records the same retirement beside the two ordered comparisons that
    // replaced it.
    expect(touchSpeedQuality(probe, LOAD_PRESETS.MAXIMAL)).toBeLessThan(0.5);
    // ...and it falls monotonically in between, so the curve is a ramp rather
    // than a step somebody could sit on either side of.
    let previous = Number.POSITIVE_INFINITY;
    for (const load of TOUCH_SWEEP.LOADS) {
      const graded = touchSpeedQuality(probe, load);
      expect(graded, `load ${load}`).toBeLessThanOrEqual(previous);
      previous = graded;
    }
  });

  it('grades a bar nobody let go of as caught, at every load', () => {
    // THE INEQUALITY THE WHOLE STEER RESTS ON, ASSERTED AGAINST THE FUNCTION
    // RATHER THAN AGAINST THE TABLE. `liftTuning.test.ts` compares the two
    // constants directly; this asks `touchSpeedQuality` what it does with the
    // rate the mechanic actually delivers, so a grading function that stopped
    // reading its load argument reddens here and a table comparison would sail
    // past it.
    for (const load of [...TOUCH_SWEEP.LOADS, LOAD_PRESETS.WARMUP, LOAD_PRESETS.MODERATE]) {
      const controlled = byLoad(LIFT_TUNING.DESCENT_DEPTH_PER_TICK.bench, clampLoadRatio(load));
      expect(touchSpeedQuality(controlled, load), `load ${load}`).toBe(1);
    }
  });

  it('refuses a lift that is not graded on a release tick, rather than defaulting', () => {
    // `depthTimedKindOf`'s sibling guard. `eccentricKindOf` accepts bench —
    // a bench lowers the bar — and this one must not, because a bench has no
    // release window since the ruling.
    expect(depthTimedKindOf('squat', 'the depth window')).toBe('squat');
    expect(() => depthTimedKindOf('bench', 'the depth window')).toThrow(/bench/);
    expect(() => depthTimedKindOf('deadlift', 'the depth window')).toThrow(/deadlift/);
    // ...and its sibling still accepts what it always did, or the pair has
    // silently collapsed into one guard.
    expect(eccentricKindOf('bench', 'a scripted descent')).toBe('bench');
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
    // BENCH, for the five bench-only kinds. Squat cannot reach them — its
    // HOLE asks for nothing and its descent reverses on the release — so a
    // squat-only sweep would report them unreachable, which is exactly what
    // this guard caught when the press beat landed. Three arms: a controlled
    // descent, an abandoned one, and a mashed pause for the false start. The
    // first two swapped meaning on the 2026-08-25 replay steer — `null` is now
    // the held descent and a number is the slip — so the ARMS are the same two
    // reps and the arguments read backwards from the version before it.
    for (const [hold, early] of [
      [null, 0],
      [1, 0],
      [null, 3],
    ] as const) {
      const seed = 3;
      const load = LOAD_PRESETS.MAXIMAL;
      const { config, script } = benchToChest(load, seed, hold);
      const command = commandTickFor(load, seed, hold);
      let full = [...script];
      if (command !== null) {
        for (let i = 0; i < early; i += 1) {
          const tick = command - 1 - i * GRIND_SWEEP.EARLY_TAP_GAP_TICKS;
          if (tick > 0) full.push({ tick, kind: 'press' as const });
        }
        full = [
          ...full,
          ...tapsAt(command, GRIND_SWEEP.MODERATE_GAP_TICKS, GRIND_SWEEP.MAX_SCRIPTED_TAPS),
        ];
      }
      for (const state of runLift(config, full, TOUCH_SWEEP.MAX_TICKS).history) {
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
