/**
 * lift.ts — the lift input mechanic (GDD §2.3, §6.2, §10 Prototype 1).
 *
 * ONE REP. The player takes a loaded bar down, reverses it at depth, and drives
 * it through its sticking point by input timing. It ends as a good lift, a
 * grind, or a miss.
 *
 * GDD §10 on why this module is the one that matters: "Does grinding a heavy
 * squat out of the hole feel satisfying in complete isolation? If this fails,
 * the project stops." GDD §2.3 on why it pays off twice: the same mechanic
 * resolves every attempt on meet day.
 *
 * ---------------------------------------------------------------------------
 * PURITY CONTRACT (CLAUDE.md "Pure logic is separate from UI", GDD §9.2)
 * ---------------------------------------------------------------------------
 *   - Zero React imports, zero I/O, zero side effects.
 *   - No `Date.now()`. Time is an integer tick count the caller advances.
 *   - No `Math.random()`. The bar's wobble jitter runs off a seeded generator
 *     whose state lives IN the lift state and is advanced by `stepLift`, so a
 *     rep is a pure function of (config, seed, input script). `lift.test.ts`
 *     replays a rep twice and asserts the two histories are identical, and
 *     replays it with a different seed and asserts they are not — otherwise the
 *     determinism test would pass on a module that had no randomness at all
 *     and would keep passing if someone added `Math.random()` in a branch the
 *     first test never took.
 *   - Every transition returns a new state; inputs are never mutated.
 *
 * NOT DOMAIN-CORRECTNESS TERRITORY. Nothing here is a published formula and
 * nothing here claims to be. The demand curve, the reversal velocity, the
 * window widths — all of it is game feel, in the same category CLAUDE.md puts
 * fatigue and injury in. Every number lives in `liftTuning.ts` and every one of
 * them is an untuned placeholder.
 *
 * ---------------------------------------------------------------------------
 * THE REP, BEAT BY BEAT
 * ---------------------------------------------------------------------------
 *   BRACE     The bar is racked. Nothing is asked for. The player's first press
 *             starts the descent (or BRACE_TIMEOUT_TICKS does it for them).
 *
 *   DESCENT   Depth grows while the player HOLDS, at a load-dependent rate —
 *             heavier is slower, because a limit squat is controlled down.
 *             The DEPTH cue window is centred on the tick depth reaches
 *             DEPTH_IDEAL. Releasing:
 *               above DEPTH_LEGAL     -> a high squat. The rep continues and
 *                                        resolves as a miss, reason 'no-depth'.
 *                                        Judged at the end, not interrupted,
 *                                        because that is what a judge does.
 *               inside the window     -> quality 0..1, which buys reversal speed
 *               legal but outside it  -> grades 'missed', costs reversal speed,
 *                                        and every unit of depth past
 *                                        DEPTH_IDEAL adds demand for the whole
 *                                        ascent
 *               never                 -> depth passes DEPTH_COLLAPSE and the
 *                                        rep ends buried
 *
 *   HOLE      A fixed reversal beat. The bar leaves it at a velocity set by the
 *             depth timing quality. A good release is not points, it is speed.
 *
 *   ASCENT    The bar rises against a demand curve peaked at the sticking point
 *             (STICK_HEIGHT_FRAC, shared with the sprite system so the stall is
 *             drawn where it happens). At the maximal preset the peak demand is
 *             above the lifter's capacity, so an undriven bar decelerates,
 *             stops, and goes backwards.
 *
 *             The DRIVE cue arms at DRIVE_ARM_HEIGHT and its ideal moment is
 *             DRIVE_IDEAL_LEAD_MS later. A press inside the window commits a
 *             decaying force boost, independent of whether the player keeps
 *             holding afterward — landing a second or third cue (the tap-rate
 *             mechanic) requires releasing and re-pressing on a real device,
 *             so the boost cannot depend on a continuous hold without making
 *             that mechanic self-defeating (measured: it did, until this was
 *             fixed). A press outside the window costs velocity and burns the
 *             attempt.
 *
 *   LOCKOUT   h reached 1. A short beat, then resolution.
 *
 * ---------------------------------------------------------------------------
 * WHY THE OUTCOME IS NOT ROLLED
 * ---------------------------------------------------------------------------
 * `fatigue.ts` exports `adjustedMissChance` and `resolveRepAttempt`, and this
 * module deliberately calls NEITHER. GDD §8.1: meet-day performance is "100%
 * skill- and consistency-driven". A rep that the player drove correctly and
 * that then failed to a dice roll is the single fastest way to make a timing
 * mechanic feel cheap, and Prototype 1 exists to answer whether the mechanic
 * feels good.
 *
 * GDD §3.4's "missed reps becoming more likely as fatigue accumulates" is still
 * honoured, through the channel that does not lie: fatigue tightens the input
 * windows (`adjustedTimingWindowMs`) and slows the bar, so a tired lifter
 * misses more often BECAUSE THE REP IS HARDER, not because a number came up.
 * Said here rather than left to be discovered, because "we ignored two exports
 * of the fatigue module" is a decision, not an oversight.
 *
 * ---------------------------------------------------------------------------
 * HOW FATIGUE REACHES THIS MODULE — READ ONLY
 * ---------------------------------------------------------------------------
 * A `SessionFeel` from `fatigue.sessionFeel()` may be attached to the config.
 * It is used for exactly two things:
 *
 *   1. WINDOW WIDTH. `adjustedTimingWindowMs(base, feel, moment)` scales both
 *      cue windows. GDD §3.4: "Tighter input timing windows when fatigued; more
 *      forgiving when primed."
 *   2. BAR SPEED. `SessionFeel.barSpeed` is one of five qualitative cue bands
 *      and is mapped, through a named table, to a small multiplier on the
 *      lifter's capacity. GDD §3.4 lists bar-speed cues first among the ways
 *      fatigue is allowed to surface.
 *
 * NO FATIGUE NUMBER IS READ AND NONE IS PRODUCED. `LiftState` has no fatigue
 * field, `LiftResolution` has no fatigue field, and this module exports nothing
 * that returns a fatigue level. GDD §3.4 and §12.3: never a visible meter.
 * `lift.test.ts` pins that no exported shape carries one.
 *
 * The `SessionFeel` is optional. With none attached the mechanic runs on its own
 * base windows, which is what GDD §10 Prototype 1 asks for — the lift in
 * complete isolation.
 *
 * ---------------------------------------------------------------------------
 * DELIBERATE NON-GOALS
 * ---------------------------------------------------------------------------
 *   - Multi-rep sets. One rep. The caller sequences them and tells `fatigue.ts`
 *     how deep into the session it is via `LiftMoment`.
 *   - Judging. Three-light calls, depth cameras and deliberation beats are meet
 *     day (GDD §6.2). What this module reports is whether the bar went up and
 *     whether it was legal.
 *   - Load prescription. `loadRatio` is attempt weight over current best single
 *     and arrives from the caller. This module does no RPE or e1RM math.
 *   - Any mutation of Total, e1RM or currency. Server-authoritative (CLAUDE.md).
 */

import {
  LIFT_COPY,
  LIFT_TUNING,
  STICK_HEIGHT_FRAC,
  STICK_WIDTH,
  TICK_MS,
  byLoad,
  clampLoadRatio,
  type HapticPattern,
  type PlayableLiftKind,
} from './liftTuning';
import {
  BAR_SPEED_CUE_ORDER,
  adjustedTimingWindowMs,
  type BarSpeedCue,
  type LiftMoment,
  type SessionFeel,
} from './fatigue';
import { nextRandom, seedState } from './prng';

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/**
 * Phase names match `squatAnimation.ts`'s `RepPhase` for the five that overlap,
 * so the sim and the sprite sheet speak one language. RESOLVED is this module's
 * own — the canned animation has nothing to resolve.
 */
export type LiftPhase = 'BRACE' | 'DESCENT' | 'HOLE' | 'ASCENT' | 'LOCKOUT' | 'RESOLVED';

export const LIFT_PHASES = Object.freeze([
  'BRACE',
  'DESCENT',
  'HOLE',
  'ASCENT',
  'LOCKOUT',
  'RESOLVED',
] as const satisfies readonly LiftPhase[]);

/** The two moments the rep asks the player for. */
export type LiftCueId = 'depth' | 'drive';

export const LIFT_CUES = Object.freeze(['depth', 'drive'] as const satisfies readonly LiftCueId[]);

/** What the cue wants: the depth cue wants a release, the drive wants a press. */
export type LiftInputKind = 'press' | 'release';

/**
 * How well an input landed.
 *
 * Non-overlapping by construction: 'missed' means outside the window entirely,
 * 'perfect' means inside the central band, and 'early'/'late' mean inside the
 * window but off-centre. A grade never has to be read together with a sign to
 * be understood.
 */
export type TimingGrade = 'perfect' | 'good' | 'early' | 'late' | 'missed';

export const TIMING_GRADES = Object.freeze([
  'perfect',
  'good',
  'early',
  'late',
  'missed',
] as const satisfies readonly TimingGrade[]);

export type LiftOutcome = 'good-lift' | 'grind' | 'miss';

export const LIFT_OUTCOMES = Object.freeze([
  'good-lift',
  'grind',
  'miss',
] as const satisfies readonly LiftOutcome[]);

export type MissReason = 'no-depth' | 'buried' | 'stalled' | 'timeout';

export const MISS_REASONS = Object.freeze([
  'no-depth',
  'buried',
  'stalled',
  'timeout',
] as const satisfies readonly MissReason[]);

/**
 * Something the rep just did, emitted on the tick it happened.
 *
 * The renderer plays haptics and flashes off these rather than diffing state,
 * so "when does the thud fire" has one answer in one place.
 */
export type LiftEventKind =
  | 'descent-start'
  | 'depth-cue-open'
  | 'depth-hit'
  | 'depth-high'
  | 'reversal'
  | 'drive-cue-open'
  | 'drive-hit'
  | 'drive-mistimed'
  | 'stall-pulse'
  | 'lockout'
  | 'resolved';

export const LIFT_EVENT_KINDS = Object.freeze([
  'descent-start',
  'depth-cue-open',
  'depth-hit',
  'depth-high',
  'reversal',
  'drive-cue-open',
  'drive-hit',
  'drive-mistimed',
  'stall-pulse',
  'lockout',
  'resolved',
] as const satisfies readonly LiftEventKind[]);

export interface LiftEvent {
  readonly kind: LiftEventKind;
  readonly tick: number;
  /** Present on 'depth-hit' and 'drive-hit'. */
  readonly grade?: TimingGrade;
  /** Present on 'depth-hit' and 'drive-hit'. 0..1. */
  readonly quality?: number;
}

/** One player action, applied on the tick it is passed to `stepLift`. */
export interface LiftInput {
  readonly kind: LiftInputKind;
}

/** A cue's window, in ticks, resolved once the cue arms. */
export interface CueWindow {
  readonly cue: LiftCueId;
  readonly wants: LiftInputKind;
  /** Tick the window opens on, inclusive. */
  readonly openTick: number;
  /** The moment being asked for. Fatigue narrows the window about this, not off it. */
  readonly idealTick: number;
  /** Tick the window closes on, inclusive. */
  readonly closeTick: number;
  /**
   * Full width in ms, after fatigue. Used by `stepLift` to grade an input.
   *
   * A KNOWN EDGE, DOCUMENTED RATHER THAN CLOSED, because it cannot be closed
   * where it appears to be. A component that divided this by
   * `LIFT_TUNING.DRIVE_WINDOW_MS` would reconstruct a 0..1 fatigue ratio and
   * could render it as a bar — a §3.4 / §12.3 fatigue meter by the back door.
   *
   * Deleting this field does not help: `(closeTick - idealTick) * TICK_MS * 2`
   * is the same number, and the tick bounds cannot go because the cue ring is
   * drawn from them. GDD §3.4 also *permits* fatigue to surface as timing
   * window width — that is one of the three channels it names. What §12.3
   * forbids is rendering it as a meter, and rendering is where the rule has to
   * be enforced.
   *
   * So it is enforced there: `liftTuning.test.ts` fails if any source under
   * `src/lift/` so much as mentions `DEPTH_WINDOW_MS` or `DRIVE_WINDOW_MS`.
   * Those are the only denominators that turn an adjusted window into a ratio,
   * and the renderer has no legitimate use for either — the cue ring is sized
   * from `cueProgress`, which is already normalised.
   */
  readonly widthMs: number;
}

/** How one input landed. */
export interface InputTiming {
  readonly cue: LiftCueId;
  readonly tick: number;
  /** Signed ms from the ideal moment. Negative is early. */
  readonly offsetMs: number;
  /** 1 at the ideal moment, 0 at the window edge, 0 outside it. */
  readonly quality: number;
  readonly grade: TimingGrade;
}

export interface LiftResolution {
  readonly outcome: LiftOutcome;
  /** Null unless `outcome` is 'miss'. */
  readonly missReason: MissReason | null;
  /** Best successful bar height reached, 0..1. 1 means it locked out. */
  readonly peakHeight: number;
  /** Was the squat deep enough to be legal? */
  readonly depthAchieved: boolean;
  /** Ticks from the start of the ascent to resolution. */
  readonly ascentTicks: number;
  /** Ascent ticks spent below GRIND_STALL_VELOCITY. The grind, measured. */
  readonly stallTicks: number;
  readonly timings: readonly InputTiming[];
  /** Headline copy. 'GOOD LIFT' / 'GRINDER' / 'NO LIFT'. */
  readonly headline: string;
  /** One line of why, for a miss. Empty on a make. */
  readonly detail: string;
}

/**
 * Everything a rep needs to run, fixed at `createLift`.
 *
 * `feel` is a `SessionFeel` from `fatigue.sessionFeel()`. It cannot be built as
 * an object literal — the fatigue module keeps its numeric half under a private
 * symbol — which is the point: the only way to get one is to ask the fatigue
 * module, and there is no fatigue number in this file to invent.
 */
export interface LiftConfig {
  /**
   * Which lift this rep is. Required, not defaulted — GDD §6.2 gives squat and
   * bench different mechanical checks (depth timing vs. press timing), and a
   * config with no kind would silently run bench under squat's numbers rather
   * than fail to compile.
   */
  readonly kind: PlayableLiftKind;
  /** Attempt weight over current best single. 0.55 is a working set, 1.0 a limit. */
  readonly loadRatio: number;
  /** Seed for the bar's wobble jitter. Same seed, same rep. */
  readonly seed: number;
  readonly feel?: SessionFeel;
  readonly moment?: LiftMoment;
}

/**
 * The whole rep, on one tick.
 *
 * NO FATIGUE FIELD, AND NONE MAY BE ADDED. GDD §3.4 / §12.3 forbid a visible
 * fatigue meter, and a `LiftState.fatigue` number is a meter that has not been
 * rendered yet. Fatigue reaches this module as a window width and a capacity
 * multiplier and leaves no trace a component could bind to.
 */
export interface LiftState {
  readonly config: LiftConfig;
  readonly tick: number;
  readonly phase: LiftPhase;
  /** Ticks spent in the current phase, before this one. */
  readonly phaseTick: number;
  /** Is the player's finger down right now? */
  readonly held: boolean;

  /** 0 = standing, 1 = the authored bottom pose. May exceed 1 (buried). */
  readonly depth: number;
  /** 0 = bottom of the hole, 1 = lockout. */
  readonly height: number;
  /** Height units per tick. Negative means the bar is being beaten. */
  readonly velocity: number;
  /** Highest height reached this rep. */
  readonly peakHeight: number;
  /** Net force this tick, capacity units. Negative means demand exceeded output. */
  readonly netForce: number;

  /** Sagittal drift toward the toes, px. NOT drawn as a horizontal offset. */
  readonly barForwardPx: number;
  /** Frontal-plane offset of the bar centre, px. Drawn. */
  readonly barLateralPx: number;
  /** Bar tilt, degrees, positive = lifter's right side high. Drawn. */
  readonly barTiltDeg: number;
  /** Sleeve droop, px. Drawn. */
  readonly barBendPx: number;
  /** 0..1 chalk puff intensity. */
  readonly chalkPuff: number;

  readonly activeCue: CueWindow | null;
  readonly timings: readonly InputTiming[];

  /** Depth released above DEPTH_LEGAL? Decided once, judged at the end. */
  readonly depthAchieved: boolean;
  /** Depth past DEPTH_IDEAL at the reversal. Adds demand for the whole ascent. */
  readonly extraDepth: number;

  readonly drivesUsed: number;
  /** Tick the last accepted drive landed on. Null if none has. */
  readonly driveTick: number | null;
  /** Quality of the last accepted drive, 0..1. */
  readonly driveQuality: number;
  /**
   * Tick the NEXT drive cue may arm, once `drivesUsed > 0`. Null before the
   * first cue has resolved — the first arms purely on `DRIVE_ARM_HEIGHT`, no
   * spacing gate needed. Set on every resolution (hit, mistimed, or a window
   * left unpressed as it closes) to `tick + driveSpacingTicks(load)`, which
   * is the tap-RATE half of the mechanic: a maximal attempt asks for cues
   * roughly this close together, not only well-timed individually.
   */
  readonly driveArmReadyTick: number | null;

  readonly ascentTicks: number;
  readonly stallTicks: number;
  /**
   * Capacity given up to stalled ticks THIS REP. Rises while the bar is stalled
   * and never recovers before the rep ends.
   *
   * NOT THE FATIGUE STAT, and it must never be rendered as a number. It resets
   * every rep, is never persisted, and has no relationship to `fatigue.ts` —
   * what the player sees is a bar that starts coming down. GDD §3.4 / §12.3
   * forbid a visible fatigue meter, and this is exactly the kind of scalar that
   * turns into one if a component is allowed to bind to it.
   */
  readonly stallCapacityLoss: number;
  /** Tick of the last stall pulse, so the pulse has a period rather than a rate. */
  readonly lastStallPulseTick: number;

  readonly resolution: LiftResolution | null;
  /** What happened on THIS tick. Cleared every step. */
  readonly events: readonly LiftEvent[];

  /** Seeded PRNG state, advanced by `stepLift`. */
  readonly rngState: number;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

/**
 * Strip IEEE-754 noise from a returned number (0.30000000000000004 -> 0.3).
 *
 * Via `toFixed` rather than a power of ten, because the tuning file is the only
 * place in this module a numeric literal is allowed to live and a base is not
 * a feel value worth putting there. `liftTuning.test.ts` enforces that.
 */
function scrub(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Number(value.toFixed(LIFT_TUNING.PRECISION_DECIMALS));
}

function gauss(x: number, center: number, width: number): number {
  const z = (x - center) / width;
  return Math.exp(-z * z);
}

// ---------------------------------------------------------------------------
// Fatigue, read-only
// ---------------------------------------------------------------------------

/**
 * How each bar-speed cue band scales the lifter's output.
 *
 * Derived from `BAR_SPEED_CUE_ORDER` (best to worst) rather than written out as
 * a literal map, so a band added to `fatigue.ts` cannot silently fall through to
 * a default here. The span is `BAR_SPEED_CAPACITY_SPAN` and is deliberately
 * small — this is a cue, not a difficulty setting, and the player's timing must
 * stay the dominant term.
 *
 * IT IS ALSO NOT A METER. The band is one of five words, it never leaves this
 * module as a number, and nothing exported here reports which band was used.
 */
export function capacityScaleForBarSpeed(cue: BarSpeedCue): number {
  const index = BAR_SPEED_CUE_ORDER.indexOf(cue);
  if (index < 0) return 1;
  const last = BAR_SPEED_CUE_ORDER.length - 1;
  // 0 -> best band -> fastest bar; last -> worst band -> slowest. `1 - 2t` runs
  // from +1 at the best band to -1 at the worst.
  const t = last <= 0 ? 1 / 2 : index / last;
  return scrub(1 + LIFT_TUNING.BAR_SPEED_CAPACITY_SPAN * (1 - 2 * t));
}

/** The lifter's output for this rep, after the bar-speed cue. */
export function lifterCapacity(config: LiftConfig): number {
  const feel = config.feel;
  if (feel === undefined) return LIFT_TUNING.LIFTER_CAPACITY;
  return scrub(LIFT_TUNING.LIFTER_CAPACITY * capacityScaleForBarSpeed(feel.barSpeed));
}

/**
 * A cue's window width in ms, after fatigue.
 *
 * GDD §3.4: tighter when fatigued, more forgiving when primed. The adjustment
 * is `fatigue.ts`'s, not this module's — nothing here knows how burdened the
 * lifter is, only how wide the window came back.
 */
export function cueWindowMs(cue: LiftCueId, config: LiftConfig): number {
  const base =
    cue === 'depth'
      ? LIFT_TUNING.DEPTH_WINDOW_MS[config.kind]
      : byLoad(LIFT_TUNING.DRIVE_WINDOW_MS[config.kind], clampLoadRatio(config.loadRatio));
  const feel = config.feel;
  if (feel === undefined) return base;
  return adjustedTimingWindowMs(base, feel, config.moment);
}

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

/**
 * Grade an input against a window.
 *
 * `offsetMs` is signed and `halfWindowMs` is half the FULL width, so the window
 * is `ideal ± halfWindowMs`. Quality falls linearly from 1 at the ideal moment
 * to 0 at the edge, and is exactly 0 outside.
 */
export function gradeTiming(offsetMs: number, halfWindowMs: number): {
  readonly quality: number;
  readonly grade: TimingGrade;
} {
  if (!Number.isFinite(offsetMs) || !Number.isFinite(halfWindowMs) || halfWindowMs <= 0) {
    return { quality: 0, grade: 'missed' };
  }
  const magnitude = Math.abs(offsetMs);
  if (magnitude > halfWindowMs) return { quality: 0, grade: 'missed' };
  const quality = scrub(1 - magnitude / halfWindowMs);
  const perfectBand = halfWindowMs * LIFT_TUNING.PERFECT_BAND_FRACTION;
  if (magnitude <= perfectBand) return { quality, grade: 'perfect' };
  // Inside the window, off-centre. 'good' is reserved for the band immediately
  // outside perfect on either side, so a grade reads as one word.
  const goodBand = perfectBand + (halfWindowMs - perfectBand) / 2;
  if (magnitude <= goodBand) return { quality, grade: 'good' };
  return { quality, grade: offsetMs < 0 ? 'early' : 'late' };
}

// ---------------------------------------------------------------------------
// The ascent model
// ---------------------------------------------------------------------------

/**
 * Resistance at bar height `h`, in capacity units.
 *
 * A base term plus a gaussian bump centred on the sticking point. At the
 * maximal preset the peak is above 1.0 — above everything the lifter has — so
 * an undriven bar stops and goes backwards. That is the mechanic.
 *
 * `extraDepth` is how far past DEPTH_IDEAL the lifter was buried; it scales the
 * whole curve, so being buried is harder rather than merely longer.
 */
export function ascentDemand(
  h: number,
  loadRatio: number,
  kind: PlayableLiftKind,
  extraDepth: number = 0,
): number {
  const load = clampLoadRatio(loadRatio);
  const base = byLoad(LIFT_TUNING.DEMAND_BASE[kind], load);
  const stick =
    byLoad(LIFT_TUNING.DEMAND_STICK_GAIN[kind], load) *
    gauss(h, STICK_HEIGHT_FRAC[kind], STICK_WIDTH[kind]);
  const buried = 1 + LIFT_TUNING.BURIED_DEMAND_PER_DEPTH * Math.max(0, extraDepth);
  return scrub((base + stick) * buried);
}

/** Ticks the reversal beat lasts at this load. */
export function holeTicks(loadRatio: number, kind: PlayableLiftKind): number {
  return Math.max(1, Math.round(byLoad(LIFT_TUNING.HOLE_TICKS[kind], clampLoadRatio(loadRatio))));
}

/** Ticks the lockout beat lasts at this load. */
export function lockoutTicks(loadRatio: number, kind: PlayableLiftKind): number {
  return Math.max(1, Math.round(byLoad(LIFT_TUNING.LOCKOUT_TICKS[kind], clampLoadRatio(loadRatio))));
}

/**
 * How many drive cues the ascent offers at this load — the tap-RATE half of
 * the ascent's difficulty, `DRIVE_WINDOW_MS` (via `cueWindowMs`) being the
 * per-cue PRECISION half. Never below 1: every rep offers at least the one
 * cue the mechanic has always had.
 */
export function driveAttemptsFor(loadRatio: number, kind: PlayableLiftKind): number {
  return Math.max(
    1,
    Math.round(byLoad(LIFT_TUNING.DRIVE_ATTEMPTS_PER_REP[kind], clampLoadRatio(loadRatio))),
  );
}

/**
 * Ticks between one drive cue resolving and the next being allowed to arm, at
 * this load. Only consulted once `drivesUsed > 0` — the first cue arms on
 * `DRIVE_ARM_HEIGHT` alone, never on this.
 */
export function driveSpacingTicks(loadRatio: number, kind: PlayableLiftKind): number {
  return Math.max(
    1,
    Math.round(
      msToTicks(byLoad(LIFT_TUNING.DRIVE_ATTEMPTS_SPACING_MS[kind], clampLoadRatio(loadRatio))),
    ),
  );
}

/** Depth gained per tick of hold at this load. */
export function descentRate(loadRatio: number, kind: PlayableLiftKind): number {
  return byLoad(LIFT_TUNING.DESCENT_DEPTH_PER_TICK[kind], clampLoadRatio(loadRatio));
}

/** Ticks of brace before input is accepted at this load. */
export function braceTicks(loadRatio: number, kind: PlayableLiftKind): number {
  return Math.max(1, Math.round(byLoad(LIFT_TUNING.BRACE_TICKS[kind], clampLoadRatio(loadRatio))));
}

/**
 * Half-width of the depth window in ticks, given the width fatigue asked for.
 *
 * THE CLAMP IS THE POINT, and it fixes a real bug rather than tidying one. The
 * window is a fixed number of MILLISECONDS but the descent is a fixed number of
 * DEPTH UNITS per tick, and that rate is load-dependent — a light bar comes
 * down nearly twice as fast as a maximal one. At the light end a 300 ms window
 * spans 0.25 of depth on each side of the ideal, so its early half sat ABOVE
 * `DEPTH_LEGAL`: the cue lit up, the player released inside it as instructed,
 * and got a red light for a high squat. A cue that is wrong about its own
 * window is worse than no cue.
 *
 * So the half-width is never longer than the descent takes to travel from legal
 * depth to the ideal depth. At heavy loads the ms width binds and the clamp does
 * nothing; at light loads the clamp binds and the window is narrower in ticks —
 * which is honest, because a fast-descending bar genuinely gives less room.
 *
 * `lift.test.ts` measures the depth at the window's opening tick from played
 * reps across the load range and asserts it is legal, rather than trusting this.
 */
export function depthWindowHalfTicks(
  loadRatio: number,
  windowMs: number,
  kind: PlayableLiftKind,
): number {
  const rate = descentRate(loadRatio, kind);
  const fromMs = Math.round(windowMs / TICK_MS / 2);
  // In TICKS, not in depth: the ideal tick is a rounded quantity, so the depth
  // it actually lands on is a little under DEPTH_IDEAL. Measuring the gap in
  // depth and dividing lost that rounding and let the window open three
  // thousandths of a unit above legal at some loads — small, and still a red
  // light. `firstLegalTick` is the first tick whose depth is at or above legal,
  // so the arithmetic below is exact.
  const idealTick = Math.round(LIFT_TUNING.DEPTH_IDEAL[kind] / rate);
  const firstLegalTick = Math.ceil(LIFT_TUNING.DEPTH_LEGAL[kind] / rate);
  return Math.max(1, Math.min(fromMs, idealTick - firstLegalTick));
}

// ---------------------------------------------------------------------------
// Bar path
// ---------------------------------------------------------------------------

/**
 * How badly the bar is losing right now, 0..1.
 *
 * The term the canned sprite animation cannot have: it is a function of the
 * live net force, so a rep that is currently being beaten drifts further
 * forward and draws uglier than one at the same height and load that is not.
 */
function struggle(netForce: number): number {
  if (netForce >= 0) return 0;
  return clamp01(-netForce / LIFT_TUNING.STRUGGLE_FULL_DEFICIT);
}

interface BarPath {
  readonly forwardPx: number;
  readonly lateralPx: number;
  readonly tiltDeg: number;
}

function barPathFor(
  phase: LiftPhase,
  depth: number,
  h: number,
  loadRatio: number,
  kind: PlayableLiftKind,
  netForce: number,
  tick: number,
  jitter: number,
): BarPath {
  const load = clampLoadRatio(loadRatio);
  const atHole = byLoad(LIFT_TUNING.BAR_FORWARD_AT_HOLE_PX, load);

  if (phase === 'BRACE' || phase === 'DESCENT') {
    return { forwardPx: scrub(atHole * clamp01(depth)), lateralPx: 0, tiltDeg: 0 };
  }
  if (phase === 'RESOLVED' || phase === 'LOCKOUT') {
    return { forwardPx: 0, lateralPx: 0, tiltDeg: 0 };
  }

  const s = struggle(netForce);
  const peak = byLoad(LIFT_TUNING.BAR_FORWARD_PEAK_PX, load);
  const carried = atHole * (1 - h);
  const fight =
    (peak + LIFT_TUNING.BAR_FORWARD_STRUGGLE_PX * s) *
    gauss(h, STICK_HEIGHT_FRAC[kind], STICK_WIDTH[kind]) *
    (1 - h);

  // The shake is gated on the struggle, so a rep that never stalls never shakes
  // and a bar that is winning quietly stops shaking as it wins.
  const phaseAngle = (2 * Math.PI * tick) / LIFT_TUNING.WOBBLE_PERIOD_TICKS;
  const lean = byLoad(LIFT_TUNING.BAR_LATERAL_PX, load);
  const tilt = byLoad(LIFT_TUNING.BAR_TILT_DEG, load);
  const shake = lean * (1 - LIFT_TUNING.BAR_LATERAL_LEAN_SHARE) * Math.sin(phaseAngle);
  const jitterPx = LIFT_TUNING.WOBBLE_JITTER_PX * (jitter * 2 - 1);

  return {
    forwardPx: scrub(carried + fight),
    lateralPx: scrub(s * (lean * LIFT_TUNING.BAR_LATERAL_LEAN_SHARE + shake + jitterPx)),
    tiltDeg: scrub(s * tilt * Math.cos(phaseAngle)),
  };
}

function barBendPx(loadRatio: number, accel: number): number {
  const staticBend = byLoad(LIFT_TUNING.BAR_BEND_PX, clampLoadRatio(loadRatio));
  const whip = Math.max(0, accel) * LIFT_TUNING.BAR_BEND_WHIP_GAIN;
  return scrub(Math.min(LIFT_TUNING.BAR_BEND_MAX_PX, staticBend * (1 + whip)));
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

function assertConfig(config: LiftConfig): void {
  if (!Number.isFinite(config.loadRatio) || config.loadRatio <= 0) {
    throw new RangeError(
      `loadRatio must be a positive finite number, received ${config.loadRatio}.`,
    );
  }
  if (!Number.isFinite(config.seed)) {
    throw new RangeError(`seed must be a finite number, received ${config.seed}.`);
  }
}

/** A rep, at tick 0, before anything has happened. */
export function createLift(config: LiftConfig): LiftState {
  assertConfig(config);
  return {
    config: {
      kind: config.kind,
      loadRatio: config.loadRatio,
      seed: config.seed,
      ...(config.feel === undefined ? {} : { feel: config.feel }),
      ...(config.moment === undefined ? {} : { moment: config.moment }),
    },
    tick: 0,
    phase: 'BRACE',
    phaseTick: 0,
    held: false,
    depth: 0,
    height: 1,
    velocity: 0,
    peakHeight: 0,
    netForce: 0,
    barForwardPx: 0,
    barLateralPx: 0,
    barTiltDeg: 0,
    barBendPx: byLoad(LIFT_TUNING.BAR_BEND_PX, clampLoadRatio(config.loadRatio)),
    chalkPuff: 0,
    activeCue: null,
    timings: [],
    depthAchieved: false,
    extraDepth: 0,
    drivesUsed: 0,
    driveTick: null,
    driveQuality: 0,
    driveArmReadyTick: null,
    ascentTicks: 0,
    stallTicks: 0,
    stallCapacityLoss: 0,
    lastStallPulseTick: Number.NEGATIVE_INFINITY,
    resolution: null,
    events: [],
    rngState: seedState(config.seed),
  };
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

function resolutionFor(
  state: LiftState,
  outcome: LiftOutcome,
  missReason: MissReason | null,
): LiftResolution {
  const headline: string = LIFT_COPY.OUTCOME[outcome];
  const detail: string = missReason === null ? '' : LIFT_COPY.MISS_REASON[missReason];
  return {
    outcome,
    missReason,
    peakHeight: scrub(state.peakHeight),
    depthAchieved: state.depthAchieved,
    ascentTicks: state.ascentTicks,
    stallTicks: state.stallTicks,
    timings: state.timings.map((t) => ({ ...t })),
    headline,
    detail,
  };
}

/**
 * Was this make a grind?
 *
 * Measured off the bar, not off the inputs: a rep that stalled and was fought
 * through is a grind however it was driven, and a rep that never slowed is not
 * a grind however scruffy the timing was.
 */
export function isGrind(stallTicks: number, ascentTicks: number): boolean {
  return (
    stallTicks >= LIFT_TUNING.GRIND_STALL_TICKS ||
    ascentTicks >= LIFT_TUNING.GRIND_ASCENT_TICKS
  );
}

// ---------------------------------------------------------------------------
// The step function
// ---------------------------------------------------------------------------

interface Mutable {
  tick: number;
  phase: LiftPhase;
  phaseTick: number;
  held: boolean;
  depth: number;
  height: number;
  velocity: number;
  peakHeight: number;
  netForce: number;
  chalkPuff: number;
  activeCue: CueWindow | null;
  timings: InputTiming[];
  depthAchieved: boolean;
  extraDepth: number;
  drivesUsed: number;
  driveTick: number | null;
  driveQuality: number;
  driveArmReadyTick: number | null;
  ascentTicks: number;
  stallTicks: number;
  stallCapacityLoss: number;
  lastStallPulseTick: number;
  resolution: LiftResolution | null;
  events: LiftEvent[];
  rngState: number;
}

function msToTicks(ms: number): number {
  return ms / TICK_MS;
}

/**
 * Advance the rep one tick, applying at most one player action.
 *
 * `input` is what the player did on THIS tick — `{ kind: 'press' }` on the tick
 * their finger went down, `{ kind: 'release' }` on the tick it came up, `null`
 * otherwise. The renderer queues at most one per tick; a press and a release on
 * the same tick is not a thing a finger can do, and pretending otherwise would
 * let a 1-tick tap satisfy a hold.
 */
export function stepLift(state: LiftState, input: LiftInput | null = null): LiftState {
  if (state.phase === 'RESOLVED') {
    return state.events.length === 0 ? state : { ...state, events: [] };
  }

  const load = clampLoadRatio(state.config.loadRatio);
  const capacity = lifterCapacity(state.config);
  const tick = state.tick + 1;

  const m: Mutable = {
    tick,
    phase: state.phase,
    phaseTick: state.phaseTick + 1,
    held: state.held,
    depth: state.depth,
    height: state.height,
    velocity: state.velocity,
    peakHeight: state.peakHeight,
    netForce: state.netForce,
    chalkPuff: state.chalkPuff,
    activeCue: state.activeCue,
    timings: state.timings.map((t) => ({ ...t })),
    depthAchieved: state.depthAchieved,
    extraDepth: state.extraDepth,
    drivesUsed: state.drivesUsed,
    driveTick: state.driveTick,
    driveQuality: state.driveQuality,
    driveArmReadyTick: state.driveArmReadyTick,
    ascentTicks: state.ascentTicks,
    stallTicks: state.stallTicks,
    stallCapacityLoss: state.stallCapacityLoss,
    lastStallPulseTick: state.lastStallPulseTick,
    resolution: null,
    events: [],
    rngState: state.rngState,
  };

  const enter = (phase: LiftPhase): void => {
    m.phase = phase;
    m.phaseTick = 0;
  };

  const pressed = input !== null && input.kind === 'press';
  const released = input !== null && input.kind === 'release';
  if (pressed) m.held = true;
  if (released) m.held = false;

  // -------------------------------------------------------------------------
  // BRACE — nothing is asked for. The first press starts the descent.
  // -------------------------------------------------------------------------
  if (m.phase === 'BRACE') {
    const ready = m.phaseTick >= braceTicks(load, state.config.kind);
    const timedOut = m.phaseTick >= LIFT_TUNING.BRACE_TIMEOUT_TICKS;
    // A FINGER ALREADY DOWN COUNTS, not only a press edge on this exact tick.
    // Players tap the instant the screen appears — before the brace is over —
    // and when only the edge counted, that press was swallowed and the rep sat
    // there until BRACE_TIMEOUT_TICKS, which is ten seconds of nothing
    // happening. Holding through the brace now simply starts the descent the
    // moment the lifter is set, which is also what a lifter does.
    if ((ready && (pressed || m.held)) || timedOut) {
      enter('DESCENT');
      m.held = true;
      m.events.push({ kind: 'descent-start', tick });
      // The depth window is known analytically: depth grows at a fixed rate
      // while held, so the tick it reaches DEPTH_IDEAL is arithmetic, not a
      // prediction. Fatigue narrows the window about that tick, never off it.
      const rate = descentRate(load, state.config.kind);
      const idealTick = tick + Math.round(LIFT_TUNING.DEPTH_IDEAL[state.config.kind] / rate);
      const halfTicks = depthWindowHalfTicks(
        load,
        cueWindowMs('depth', state.config),
        state.config.kind,
      );
      m.activeCue = {
        cue: 'depth',
        wants: 'release',
        openTick: idealTick - halfTicks,
        idealTick,
        closeTick: idealTick + halfTicks,
        // Reported from the ticks it actually spans, not from the ms it was
        // asked for, so a UI sizing a cue off `widthMs` draws the real window.
        widthMs: scrub(halfTicks * 2 * TICK_MS),
      };
    }
  }

  // -------------------------------------------------------------------------
  // DESCENT — depth grows while held. Release decides the rep's legality.
  // -------------------------------------------------------------------------
  else if (m.phase === 'DESCENT') {
    const cue = m.activeCue;
    if (cue !== null && tick === cue.openTick) {
      m.events.push({ kind: 'depth-cue-open', tick });
    }
    if (m.held) {
      m.depth = scrub(m.depth + descentRate(load, state.config.kind));
      m.height = scrub(clamp01(1 - m.depth));
    }

    const reverseNow = released || m.depth >= LIFT_TUNING.DEPTH_COLLAPSE[state.config.kind];
    if (reverseNow) {
      const buried = !released && m.depth >= LIFT_TUNING.DEPTH_COLLAPSE[state.config.kind];
      m.depthAchieved = m.depth >= LIFT_TUNING.DEPTH_LEGAL[state.config.kind];
      m.extraDepth = scrub(Math.max(0, m.depth - LIFT_TUNING.DEPTH_IDEAL[state.config.kind]));

      if (cue !== null) {
        const offsetMs = (tick - cue.idealTick) * TICK_MS;
        const { quality, grade } = gradeTiming(offsetMs, (cue.widthMs / 2));
        m.timings.push({ cue: 'depth', tick, offsetMs: scrub(offsetMs), quality, grade });
        m.events.push({
          kind: m.depthAchieved ? 'depth-hit' : 'depth-high',
          tick,
          grade,
          quality,
        });
        m.velocity = scrub(
          LIFT_TUNING.REVERSAL_VELOCITY.MIN +
            (LIFT_TUNING.REVERSAL_VELOCITY.MAX - LIFT_TUNING.REVERSAL_VELOCITY.MIN) * quality,
        );
      }

      if (buried) {
        m.resolution = resolutionFor(
          { ...state, ...m, timings: m.timings, peakHeight: 0 },
          'miss',
          'buried',
        );
        m.events.push({ kind: 'resolved', tick });
        enter('RESOLVED');
      } else {
        m.height = clamp01(1 - m.depth);
        enter('HOLE');
        m.events.push({ kind: 'reversal', tick });
      }
      m.activeCue = null;
    }
  }

  // -------------------------------------------------------------------------
  // HOLE — the reversal beat. Velocity was set on release; the bar has not
  // started moving yet. Nothing is asked for, deliberately: the reversal is the
  // consequence of the depth input, not a third thing to hit.
  // -------------------------------------------------------------------------
  else if (m.phase === 'HOLE') {
    if (m.phaseTick >= holeTicks(load, state.config.kind)) {
      enter('ASCENT');
      // The ascent starts from where the bar ACTUALLY is. A high squat starts
      // near lockout and finishes in a few ticks — trivially easy, and then
      // called for what it is. Making it start at 0 like a legal rep would
      // charge the player the full sticking point for a quarter squat.
      m.peakHeight = m.height;
    }
  }

  // -------------------------------------------------------------------------
  // ASCENT — the grind.
  // -------------------------------------------------------------------------
  else if (m.phase === 'ASCENT') {
    m.ascentTicks += 1;

    // Arm a drive cue: the first purely on bar height, every one after it
    // only once BOTH the previous one has resolved (drivesUsed > 0) AND its
    // spacing has elapsed. `driveAttemptsFor`/`driveSpacingTicks` are the
    // tap-RATE half of the ascent's difficulty — how many cues, how close
    // together — `cueWindowMs`'s per-cue width is the PRECISION half.
    const attempts = driveAttemptsFor(load, state.config.kind);
    const canArmNext =
      m.drivesUsed === 0 ||
      (m.driveArmReadyTick !== null && tick >= m.driveArmReadyTick);
    if (
      m.activeCue === null &&
      m.drivesUsed < attempts &&
      m.height >= LIFT_TUNING.DRIVE_ARM_HEIGHT[state.config.kind] &&
      canArmNext
    ) {
      const widthMs = cueWindowMs('drive', state.config);
      const idealTick = tick + Math.round(msToTicks(LIFT_TUNING.DRIVE_IDEAL_LEAD_MS));
      const halfTicks = Math.round(msToTicks(widthMs) / 2);
      m.activeCue = {
        cue: 'drive',
        wants: 'press',
        openTick: idealTick - halfTicks,
        idealTick,
        closeTick: idealTick + halfTicks,
        widthMs: scrub(widthMs),
      };
      m.events.push({ kind: 'drive-cue-open', tick });
    }

    if (pressed && m.drivesUsed < attempts) {
      const cue = m.activeCue;
      // No armed cue means the press is unambiguously early: the bar has not
      // reached the hard part yet, or the next cue has not re-armed. Recorded
      // as a full window early rather than as -Infinity, so an `InputTiming`
      // always survives JSON.
      const offsetMs =
        cue === null
          ? -byLoad(LIFT_TUNING.DRIVE_WINDOW_MS[state.config.kind], load)
          : (tick - cue.idealTick) * TICK_MS;
      const halfMs = cue === null ? 0 : cue.widthMs / 2;
      const { quality, grade } = gradeTiming(offsetMs, halfMs);
      m.drivesUsed += 1;
      m.timings.push({ cue: 'drive', tick, offsetMs: scrub(offsetMs), quality, grade });
      if (grade === 'missed') {
        // A MISSED TAP COSTS VELOCITY. IT NEVER ENDS THE REP ON ITS OWN.
        // Deliberately unchanged from the single-cue mechanic this replaces,
        // for a mid-sequence miss same as a lone one: the rep still resolves
        // through the existing height/stall/timeout logic below, so losing
        // one cue in a rhythm of several is a setback, not a bomb-out.
        m.velocity = scrub(m.velocity - LIFT_TUNING.MISTIMED_DRIVE_VELOCITY_PENALTY);
        m.driveQuality = 0;
        m.driveTick = tick;
        m.events.push({ kind: 'drive-mistimed', tick, grade, quality });
      } else {
        // A NEW HIT REPLACES THE BOOST, NOT ADDS TO IT. `driveTick`/
        // `driveQuality` are single scalars — the physics below reads only
        // the MOST RECENT accepted press — so landing the next cue in a
        // sequence refreshes the decaying boost from THIS tick rather than
        // stacking a second one on top. That is the rate requirement made
        // physical: falling behind the cadence lets the previous boost decay
        // to nothing before a new one arrives.
        m.driveQuality = quality;
        m.driveTick = tick;
        m.velocity = scrub(m.velocity + LIFT_TUNING.DRIVE_IMPULSE_MAX * quality);
        m.events.push({ kind: 'drive-hit', tick, grade, quality });
        if (load >= LIFT_TUNING.CHALK_MIN_LOAD_RATIO) m.chalkPuff = 1;
      }
      m.activeCue = null;
      m.driveArmReadyTick = tick + driveSpacingTicks(load, state.config.kind);
    }

    // The window closed with nothing thrown at it. The cue goes away; the bar
    // does not care, which is the point. Still starts the spacing clock, so a
    // player who lets one cue expire unpressed is not permanently locked out
    // of the ones after it.
    const openCue = m.activeCue;
    if (openCue !== null && tick > openCue.closeTick) {
      m.activeCue = null;
      m.driveArmReadyTick = tick + driveSpacingTicks(load, state.config.kind);
    }

    // --- physics ---------------------------------------------------------
    const demand = ascentDemand(m.height, load, state.config.kind, m.extraDepth);
    let drive = capacity - m.stallCapacityLoss;
    // A LANDED DRIVE IS A COMMITTED IMPULSE, NOT A STATE THE PLAYER MAINTAINS.
    // Deliberately NOT gated on `m.held`. It used to be, and that coupling was
    // a defect discovered by a phone playtest, not a design choice: landing a
    // SECOND or THIRD drive cue (Sprint 3's tap-rate mechanic) is only
    // reachable on a real device by releasing and re-touching — `Pressable`'s
    // `onPressIn` does not re-fire on a continuous hold — and at MAXIMAL load
    // `ascentDemand` exceeds capacity when undriven, so the instant the old
    // gate saw `held` go false the boost vanished and the bar started falling.
    // Measured before this fix: EVERY release duration tested, 1 to 64 ticks,
    // produced a miss, including the fastest physically possible re-tap. The
    // only winning strategy was to never release at all — exactly backwards
    // from what the tap-rate mechanic asks for. A real press is a discrete
    // effort that pays out once thrown, not a button that has to stay down to
    // keep paying — this is that property, made physical. `m.held` keeps its
    // three other jobs (BRACE's finger-already-down start, DESCENT's
    // depth-while-held growth) untouched; this is the only site it is removed
    // from.
    if (m.driveTick !== null && m.driveQuality > 0) {
      const elapsed = tick - m.driveTick;
      const decay = clamp01(1 - elapsed / LIFT_TUNING.DRIVE_BOOST_TICKS);
      drive += LIFT_TUNING.DRIVE_BOOST_FORCE_MAX * m.driveQuality * decay;
    }
    m.netForce = scrub(drive - demand);
    const targetVelocity = m.netForce * LIFT_TUNING.VELOCITY_PER_NET_FORCE;
    m.velocity = scrub(
      clamp(
        m.velocity + (targetVelocity - m.velocity) * LIFT_TUNING.VELOCITY_RESPONSE,
        -LIFT_TUNING.MAX_SINK_VELOCITY,
        LIFT_TUNING.MAX_RISE_VELOCITY,
      ),
    );
    // Height is allowed BELOW zero. A beaten squat sinks back past the point it
    // reversed at, and clamping at zero would leave a dead bar sitting on the
    // floor of the model until the timeout instead of being called.
    m.height = scrub(
      clamp(m.height + m.velocity, -LIFT_TUNING.ASCENT_COLLAPSE_DROP, 1),
    );
    if (m.height > m.peakHeight) m.peakHeight = m.height;
    m.depth = scrub(clamp(1 - m.height, 0, LIFT_TUNING.DEPTH_COLLAPSE[state.config.kind]));

    if (m.chalkPuff > 0) {
      m.chalkPuff = scrub(Math.max(0, m.chalkPuff - 1 / LIFT_TUNING.CHALK_PUFF_TICKS));
    }

    // --- the grind, measured ---------------------------------------------
    if (m.velocity <= LIFT_TUNING.STALL_DECAY_VELOCITY) {
      m.stallCapacityLoss = scrub(
        Math.min(
          LIFT_TUNING.STALL_CAPACITY_DECAY_MAX,
          m.stallCapacityLoss + LIFT_TUNING.STALL_CAPACITY_DECAY_PER_TICK,
        ),
      );
    }
    if (m.velocity < LIFT_TUNING.GRIND_STALL_VELOCITY) {
      m.stallTicks += 1;
      if (tick - m.lastStallPulseTick >= LIFT_TUNING.STALL_PULSE_PERIOD_TICKS) {
        m.lastStallPulseTick = tick;
        m.events.push({ kind: 'stall-pulse', tick });
      }
    }

    // --- ending ----------------------------------------------------------
    if (m.height >= 1) {
      enter('LOCKOUT');
      m.velocity = 0;
      m.events.push({ kind: 'lockout', tick });
    } else if (m.peakHeight - m.height >= LIFT_TUNING.ASCENT_COLLAPSE_DROP) {
      m.resolution = resolutionFor({ ...state, ...m }, 'miss', 'stalled');
      m.events.push({ kind: 'resolved', tick });
      enter('RESOLVED');
    } else if (m.ascentTicks >= LIFT_TUNING.ASCENT_TIMEOUT_TICKS) {
      m.resolution = resolutionFor({ ...state, ...m }, 'miss', 'timeout');
      m.events.push({ kind: 'resolved', tick });
      enter('RESOLVED');
    }
  }

  // -------------------------------------------------------------------------
  // LOCKOUT — standing. Then judged.
  // -------------------------------------------------------------------------
  else if (m.phase === 'LOCKOUT') {
    m.height = 1;
    m.depth = 0;
    m.velocity = 0;
    if (m.chalkPuff > 0) {
      m.chalkPuff = scrub(Math.max(0, m.chalkPuff - 1 / LIFT_TUNING.CHALK_PUFF_TICKS));
    }
    if (m.phaseTick >= lockoutTicks(load, state.config.kind)) {
      const outcome: LiftOutcome = !m.depthAchieved
        ? 'miss'
        : isGrind(m.stallTicks, m.ascentTicks)
          ? 'grind'
          : 'good-lift';
      m.resolution = resolutionFor(
        { ...state, ...m },
        outcome,
        outcome === 'miss' ? 'no-depth' : null,
      );
      m.events.push({ kind: 'resolved', tick });
      enter('RESOLVED');
    }
  }

  // -------------------------------------------------------------------------
  // Bar path. One draw of the RNG per tick, unconditionally, so the generator
  // advances at the same rate whatever the player does — a rep's jitter is a
  // function of its seed and its tick count and nothing else.
  // -------------------------------------------------------------------------
  const roll = nextRandom(m.rngState);
  m.rngState = roll.state;
  const path = barPathFor(
    m.phase,
    m.depth,
    m.height,
    load,
    state.config.kind,
    m.netForce,
    tick,
    roll.value,
  );
  const bend = barBendPx(load, Math.max(0, m.velocity - state.velocity));

  return {
    config: state.config,
    tick: m.tick,
    phase: m.phase,
    phaseTick: m.phaseTick,
    held: m.held,
    depth: m.depth,
    height: m.height,
    velocity: m.velocity,
    peakHeight: m.peakHeight,
    netForce: m.netForce,
    barForwardPx: path.forwardPx,
    barLateralPx: path.lateralPx,
    barTiltDeg: path.tiltDeg,
    barBendPx: bend,
    chalkPuff: m.chalkPuff,
    activeCue: m.activeCue,
    timings: m.timings,
    depthAchieved: m.depthAchieved,
    extraDepth: m.extraDepth,
    drivesUsed: m.drivesUsed,
    driveTick: m.driveTick,
    driveQuality: m.driveQuality,
    driveArmReadyTick: m.driveArmReadyTick,
    ascentTicks: m.ascentTicks,
    stallTicks: m.stallTicks,
    stallCapacityLoss: m.stallCapacityLoss,
    lastStallPulseTick: m.lastStallPulseTick,
    resolution: m.resolution ?? state.resolution,
    events: m.events,
    rngState: m.rngState,
  };
}

// ---------------------------------------------------------------------------
// Replay — the shape the tests and any recorded-attempt feature both need
// ---------------------------------------------------------------------------

/** One scripted action: what the player did, and on which tick. */
export interface ScriptedInput {
  readonly tick: number;
  readonly kind: LiftInputKind;
}

export interface LiftReplay {
  readonly final: LiftState;
  /** Every state from tick 1 to resolution, inclusive. */
  readonly history: readonly LiftState[];
}

/**
 * Run a whole rep from a script.
 *
 * Exists so a test can state a rep as "held from tick 5, released at tick 70,
 * pressed again at 96" and get back the entire history to measure. It is also
 * what a replay clip (GDD §6.2, "bar-speed replay clip as feedback") would be
 * built on: the inputs are the recording, the states are regenerated.
 */
export function runLift(
  config: LiftConfig,
  script: readonly ScriptedInput[],
  maxTicks: number = LIFT_TUNING.ASCENT_TIMEOUT_TICKS + LIFT_TUNING.BRACE_TIMEOUT_TICKS,
): LiftReplay {
  let state = createLift(config);
  const history: LiftState[] = [];
  const byTick = new Map<number, LiftInputKind>();
  for (const action of script) byTick.set(action.tick, action.kind);

  for (let i = 0; i < maxTicks; i += 1) {
    const kind = byTick.get(state.tick + 1);
    state = stepLift(state, kind === undefined ? null : { kind });
    history.push(state);
    if (state.phase === 'RESOLVED') break;
  }
  return { final: state, history };
}

// ---------------------------------------------------------------------------
// Read models for the UI
// ---------------------------------------------------------------------------

/**
 * The line of copy the screen shows right now.
 *
 * Here rather than in a component because "which prompt is up" is a function of
 * the mechanic's state, and CLAUDE.md forbids deriving mechanic state inside a
 * `.tsx` file.
 */
export function promptFor(state: LiftState): string {
  const p = LIFT_COPY.PROMPT;
  switch (state.phase) {
    case 'BRACE':
      return p.BRACE;
    case 'DESCENT':
      return p.DESCENT;
    case 'HOLE':
      return p.HOLE;
    case 'ASCENT': {
      const cue = state.activeCue;
      if (cue !== null && state.tick >= cue.openTick) return p.ASCENT_CUE_OPEN;
      if (state.drivesUsed > 0) return p.ASCENT_AFTER_CUE;
      return p.ASCENT_BEFORE_CUE;
    }
    case 'LOCKOUT':
      return p.LOCKOUT;
    case 'RESOLVED':
      return p.RESOLVED;
    default:
      return '';
  }
}

/**
 * The haptic pattern for an event, or null if that event is silent.
 *
 * The mapping lives here rather than in the UI so a playtester turning haptics
 * finds every decision in one file pair. The UI's only job is to play a
 * `HapticPattern`.
 */
export function hapticFor(event: LiftEvent): HapticPattern | null {
  const h = LIFT_TUNING.HAPTICS;
  switch (event.kind) {
    case 'descent-start':
      return h.DESCENT_START;
    case 'depth-hit':
      return event.grade === 'perfect' ? h.DEPTH_PERFECT : h.DEPTH_LOOSE;
    case 'depth-high':
      return h.DEPTH_HIGH;
    case 'reversal':
      return h.REVERSAL;
    case 'drive-hit':
      return event.grade === 'perfect' ? h.DRIVE_PERFECT : h.DRIVE_LOOSE;
    case 'drive-mistimed':
      return h.DRIVE_MISTIMED;
    case 'stall-pulse':
      return h.STALL_PULSE;
    case 'lockout':
      return h.LOCKOUT;
    case 'resolved':
      return null;
    case 'depth-cue-open':
    case 'drive-cue-open':
      return null;
    default:
      return null;
  }
}

/**
 * Cue progress for the renderer: 0 when the window opens, 1 at the ideal
 * moment, above 1 as it closes. Null when no cue is up.
 *
 * A number the UI draws a shrinking ring from. It says nothing about fatigue —
 * the window it describes has already been adjusted, and there is no base to
 * compare it against here.
 */
export function cueProgress(state: LiftState): number | null {
  const cue = state.activeCue;
  if (cue === null) return null;
  const span = cue.idealTick - cue.openTick;
  if (span <= 0) return null;
  return scrub((state.tick - cue.openTick) / span);
}
