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
 * THREE LIFTS, THREE PHASE PATHS, THREE FACULTIES
 * ---------------------------------------------------------------------------
 * GDD §6.2 gives each lift its own check. They are deliberately different
 * FACULTIES rather than different numbers, because three timing windows of
 * different widths is one lift with three difficulty settings:
 *
 *   SQUAT     BRACE -> DESCENT -> HOLE -> ASCENT -> LOCKOUT -> RESOLVED
 *             ANTICIPATION. The bar is moving down at a known rate and the
 *             player predicts the instant it reaches depth.
 *
 *   BENCH     BRACE -> DESCENT -> HOLE -> ASCENT -> LOCKOUT -> RESOLVED
 *             CONTROL, THEN EXERTION. Two beats, ruled 2026-08-25. DESCENT is
 *             a controlled lowering — the bar accelerates while the finger is
 *             down and slows while it is up, and what is graded is the speed
 *             it carries into the chest, not the tick the finger came up on.
 *             HOLE is the pause and the command, answered by a BURST of taps
 *             whose count buys force off the chest with diminishing returns.
 *
 *   DEADLIFT  BRACE ->                    ASCENT -> LOCKOUT -> RESOLVED
 *             PERSISTENCE. There is NO ECCENTRIC — the bar starts on the floor,
 *             so there is nothing to lower, no depth to judge and no reversal
 *             to time. LOCKOUT carries the check: hold the bar locked out until
 *             the down command, which arrives at a moment the player cannot
 *             predict, and letting go early loses it.
 *
 * The deadlift's missing phases are a TYPE, not a convention:
 * `EccentricLiftKind` in `liftTuning.ts` keys every descent-shaped tuning table,
 * so `DEPTH_LEGAL.deadlift` does not compile. `stepLift` refuses an impossible
 * (deadlift, DESCENT|HOLE) state outright rather than falling through it — see
 * `refuseImpossiblePhase`.
 *
 * ---------------------------------------------------------------------------
 * THE REP, BEAT BY BEAT
 * ---------------------------------------------------------------------------
 *   BRACE     The bar is racked, or on the floor. Nothing is asked for. The
 *             player's first press starts the descent — or, on a deadlift, the
 *             pull itself, straight into ASCENT (or BRACE_TIMEOUT_TICKS does it
 *             for them).
 *
 *   DESCENT   ON SQUAT: depth grows while the player HOLDS, at a load-dependent
 *             rate — heavier is slower, because a limit squat is controlled
 *             down.
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
 *             ON BENCH: none of the above. The bar is fed down by the finger
 *             and resisted by lifting it — `BENCH_DESCENT_GRAVITY` while held,
 *             `BENCH_DESCENT_BRAKE` while not — and contact happens when depth
 *             reaches the chest, whatever the player is doing at that instant.
 *             What is graded is the RATE at contact, between
 *             BENCH_TOUCH_SOFT_RATE and BENCH_TOUCH_CRASH_RATE, and a crashed
 *             touch makes the whole ascent harder. Stop feeding the bar and
 *             never feed it again and it never arrives: CHEST_TOUCH_TIMEOUT_TICKS
 *             ends the rep as a miss, reason 'no-touch', which is what a press
 *             that never touched the chest is in the real sport.
 *
 *   HOLE      ON SQUAT: a fixed reversal beat. The bar leaves it at a velocity
 *             set by the depth timing quality. A good release is not points,
 *             it is speed.
 *
 *             ON BENCH THIS IS THE PAUSE AND THE COMMAND. The bar sits on the
 *             chest; a command fires at a tick drawn from the rep's seed; from
 *             that tick a burst window is open for PRESS_BURST_WINDOW_MS, and
 *             every tap inside it that clears the refractory gap counts. The
 *             count buys force through `burstForce` — a saturating curve, so
 *             mashing caps rather than scaling — and the force sets both the
 *             velocity off the chest and a demand multiplier for the whole
 *             ascent. Taps thrown BEFORE the command count for nothing and
 *             each one takes a tap off the burst's ceiling, down to
 *             PRESS_BURST_FORCE.FALSE_START_FLOOR_TAPS.
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
 *   LOCKOUT   h reached 1. On squat and bench, a short fixed beat and then
 *             resolution — nothing is asked for, the rep is already decided.
 *             ON DEADLIFT THIS IS THE CHECK. The player must keep holding
 *             until the down command (a tick drawn from the rep's seed).
 *             Letting go past LOCKOUT_GRIP_GRACE_TICKS sags the bar; sagging
 *             LOCKOUT_DROP_HEIGHT_LOSS is a miss, reason 'dropped'. Re-gripping
 *             recovers, and a slip that was caught grades the make a grind.
 *
 *             THE INPUT IS THE ABSENCE OF ONE, which is what makes it a third
 *             faculty rather than a third window. On squat the player acts at a
 *             moment; on bench they act fast; here the correct play is to do
 *             nothing at all and keep doing it.
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
  type DepthTimedLiftKind,
  type EccentricLiftKind,
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

/**
 * The moments a rep asks the player for.
 *
 * 'drive' is on every lift. 'depth' is SQUAT ONLY — bench's descent stopped
 * being a release-at-a-moment check on 2026-08-25 and arms no cue at all, and
 * a deadlift has no descent. 'press' is BENCH ONLY — GDD §6.2's "press-timing
 * / bar-speed check off the chest" — and it is the one cue in this module that
 * is not graded on WHEN a single input landed: it is a BURST, graded on how
 * many taps arrived inside its window. See `burstForce`.
 */
export type LiftCueId = 'depth' | 'drive' | 'press';

export const LIFT_CUES = Object.freeze([
  'depth',
  'drive',
  'press',
] as const satisfies readonly LiftCueId[]);

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

/**
 * Why a rep failed.
 *
 * 'dropped' IS DEADLIFT'S AND EARNS ITS OWN MEMBER rather than reusing
 * 'stalled'. A bar that beat you at the sticking point and a bar you put down
 * before the down command are different failures with different fixes — one
 * says drive harder, the other says hold on — and `LIFT_COPY.MISS_REASON` hands
 * the player a sentence per member. Reusing 'stalled' would print a true-
 * sounding explanation of something that did not happen.
 */
export type MissReason =
  | 'no-depth'
  | 'no-touch'
  | 'buried'
  | 'stalled'
  | 'timeout'
  | 'dropped';

export const MISS_REASONS = Object.freeze([
  'no-depth',
  'no-touch',
  'buried',
  'stalled',
  'timeout',
  'dropped',
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
  /** BENCH ONLY: the bar reached the chest. Carries the control grade. */
  | 'chest-touch'
  /** BENCH ONLY: the press command fired. The burst window is open. */
  | 'press-command'
  /** BENCH ONLY: one counted tap of the burst. Carries the force so far. */
  | 'press-burst-tap'
  /** BENCH ONLY: the burst closed. Carries the force it produced. */
  | 'press-hit'
  /** BENCH ONLY: tapped before the command. */
  | 'press-false-start'
  | 'drive-cue-open'
  | 'drive-hit'
  | 'drive-mistimed'
  | 'stall-pulse'
  | 'lockout'
  /** DEADLIFT ONLY: the grip is going. Fired per tick while the bar sags. */
  | 'lockout-slip'
  /** DEADLIFT ONLY: the down command fired. The hold is over. */
  | 'down-command'
  | 'resolved';

export const LIFT_EVENT_KINDS = Object.freeze([
  'descent-start',
  'depth-cue-open',
  'depth-hit',
  'depth-high',
  'reversal',
  'chest-touch',
  'press-command',
  'press-burst-tap',
  'press-hit',
  'press-false-start',
  'drive-cue-open',
  'drive-hit',
  'drive-mistimed',
  'stall-pulse',
  'lockout',
  'lockout-slip',
  'down-command',
  'resolved',
] as const satisfies readonly LiftEventKind[]);

export interface LiftEvent {
  readonly kind: LiftEventKind;
  readonly tick: number;
  /** Present on 'depth-hit', 'drive-hit', 'chest-touch' and 'press-hit'. */
  readonly grade?: TimingGrade;
  /**
   * 0..1. Present on 'depth-hit' and 'drive-hit' (timing quality), on
   * 'chest-touch' (control at contact) and on 'press-burst-tap'/'press-hit'
   * (the burst's force so far, and its final force).
   */
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
   * Which lift this rep is. Required, not defaulted — GDD §6.2 gives all three
   * lifts different mechanical checks (depth timing / press timing / lockout
   * hold), and a config with no kind would silently run one lift under
   * another's numbers rather than fail to compile.
   *
   * ALL THREE ARE PLAYABLE NOW. There is no `simKindFor` to map a deadlift day
   * onto squat's beat any more; that stopgap is deleted, and callers pass the
   * real `LiftKind` straight through.
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

  /**
   * BENCH ONLY. The bar's current descent speed, depth units per tick. Null on
   * squat and deadlift, and null on bench outside DESCENT.
   *
   * THE QUANTITY THE WHOLE DESCENT BEAT IS ABOUT, exposed because the stage
   * has to draw it: a bar coming in hot and a bar being caught look different,
   * and the renderer cannot tell them apart from `depth` alone. `chestApproach`
   * is the normalised read model built on it.
   *
   * NOT A FATIGUE SCALAR. It is the bar's speed this tick, it resets every
   * rep, it is never persisted, and nothing in `fatigue.ts` reaches it — the
   * descent's constants are load-keyed and fatigue-free. GDD §3.4 / §12.3
   * forbid a visible fatigue meter; this is in the same category as
   * `velocity` directly above it.
   */
  readonly chestRate: number | null;
  /**
   * BENCH ONLY. How controlled the touch was, 0..1 — 1 at or under
   * `BENCH_TOUCH_SOFT_RATE`, 0 at or over `BENCH_TOUCH_CRASH_RATE`. 0 until
   * the bar reaches the chest.
   *
   * WHAT IT BUYS IS THE WHOLE ASCENT, not a moment of it: `1 - touchQuality`
   * scales the demand curve through `BENCH_TOUCH_DEMAND_PENALTY` for every
   * tick the bar is going up. See that constant's header for why a transient
   * would have been decorative.
   */
  readonly touchQuality: number;
  /**
   * BENCH ONLY (GDD §6.2). Tick the press command fires on, set when the bar
   * settles on the chest. Null on squat, and null on bench until HOLE begins.
   *
   * NOT SECRET FROM THE RENDERER. `promptFor` switches the line, and
   * `cueProgress` draws the GO ring from the tick the command fires — progress
   * 1 at the stimulus, rising toward 2 as the burst window closes. What keeps
   * the command honest is that nothing draws a COUNTDOWN to it: before the
   * command tick `cueProgress` is still null, so the shrinking ring that
   * telegraphs depth and drive cannot show the player the command coming.
   * A ring that opened before the command would defeat the mechanic; a ring
   * that appears AT the command is the command, the same way the haptic is.
   */
  readonly pressCommandTick: number | null;
  /**
   * BENCH ONLY. While the burst is open, the tick it is SCHEDULED to close on.
   * Once it has closed, the tick it ACTUALLY closed on. Null on squat and
   * deadlift, and null on bench before the command.
   *
   * THE TWO MEANINGS ARE THE SAME QUANTITY SEEN FROM EITHER SIDE OF THE EVENT,
   * and the rewrite at close is deliberate rather than a reuse: a burst that
   * hits the physics cap early leaves the chest before its scheduled end, and
   * the ascent's boost decays from THE LAUNCH. Left as the schedule, a mashed
   * burst's boost would sit at full strength until a tick in the future
   * arrived. `cueProgress` and `burstProgress` only ever read it while the
   * burst is open, which is the half where it is the schedule.
   */
  readonly burstEndTick: number | null;
  /** BENCH ONLY. Counted taps of the burst so far. */
  readonly burstTaps: number;
  /**
   * BENCH ONLY. Taps thrown at the pause, before the command.
   *
   * They buy nothing and each one costs a tap off the burst's ceiling. That is
   * the whole false-start rule and it is stated to the player in
   * `LIFT_COPY.SUBTITLE.bench`.
   */
  readonly burstEarlyTaps: number;
  /** BENCH ONLY. Tick of the last counted tap, for the refractory gap. Null before the first. */
  readonly burstLastTapTick: number | null;
  /** BENCH ONLY. Tick of the FIRST counted tap — the reaction, recorded. Null before it. */
  readonly burstFirstTapTick: number | null;
  /**
   * BENCH ONLY. What the burst produced, 0..1. This is what buys bar speed
   * (`PRESS_VELOCITY`) and what the ascent's demand multiplier is read from
   * (`PRESS_WEAK_DEMAND_PENALTY`). 0 until the burst closes.
   */
  readonly burstForce: number;

  /**
   * DEADLIFT ONLY (GDD §6.2, "lockout grind"). Tick the down command fires on,
   * set when the bar reaches lockout. Null on squat and bench, and null on
   * deadlift until LOCKOUT begins.
   *
   * NOT SECRET FROM THE RENDERER — `promptFor` flips its line at this tick, the
   * same way bench's does. What keeps the hold honest is the mirror image of
   * what keeps bench's reaction honest: `cueProgress` returns null for the
   * WHOLE of a deadlift lockout, so nothing draws a ring counting the player
   * down to the command. A countdown here would tell them exactly how much
   * longer they had to hold, which turns "keep holding" into "hold for 1.4
   * seconds" — an anticipation check wearing persistence's name.
   */
  readonly downCommandTick: number | null;
  /**
   * DEADLIFT ONLY. Ticks spent NOT holding during LOCKOUT, past the grace
   * period. What decides whether a made deadlift is a grind.
   *
   * NOT A FATIGUE SCALAR, and it must not be rendered as one. It is a per-rep
   * count in exactly the same category as `stallTicks` beside it: it resets
   * every rep, is never persisted, has no relationship to `fatigue.ts`, and
   * what the player sees is a bar drifting down. GDD §3.4 / §12.3 forbid a
   * visible fatigue meter, and `lift.test.ts` pins that no exported shape here
   * carries one.
   */
  readonly lockoutSlipTicks: number;

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
 * Narrow a lift kind to one that HAS a way down, or refuse.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS THROWS INSTEAD OF FALLING BACK TO SQUAT
 * ---------------------------------------------------------------------------
 * Falling back to squat is exactly what `simKindFor` used to do, for every
 * deadlift in the game, and its failure mode was that it was CORRECT and
 * INVISIBLE: the wrong beat played, nothing said so, and the stopgap survived
 * because nothing could ever go red. A silent default here would rebuild that
 * one layer down and be harder to find, because it would be inside the
 * mechanic rather than at its door.
 *
 * The throw is UNREACHABLE THROUGH `stepLift`, which is the point of pairing it
 * with `refuseImpossiblePhase`: a deadlift never enters DESCENT or HOLE, so
 * nothing ever asks for its descent rate or its depth window. It is a guard on
 * a direct call — a caller reaching for a deadlift's depth window has a bug,
 * and being told is better than being answered.
 *
 * `moment` names what was being asked for so the message says which of the
 * eccentric-only quantities was reached for, not merely that one was.
 */
export function eccentricKindOf(kind: PlayableLiftKind, moment: string): EccentricLiftKind {
  if (kind === 'deadlift') {
    throw new RangeError(
      `lift: a deadlift has no eccentric, so it has no ${moment}. The bar starts on the floor.`,
    );
  }
  return kind;
}

/**
 * Narrow a lift kind to one whose DESCENT IS GRADED ON A RELEASE TICK, or
 * refuse.
 *
 * THE SIBLING OF `eccentricKindOf`, WRITTEN FROM IT DELIBERATELY, because
 * CLAUDE.md's "a guard written for one hook must be applied to its sibling"
 * has been paid for four times in this repository. Same shape, same throw,
 * same reason for throwing rather than defaulting: a silent fallback to squat
 * is what `simKindFor` did for every deadlift in the game, and its failure
 * mode was that it was CORRECT and INVISIBLE.
 *
 * WHAT IT REFUSES THAT `eccentricKindOf` DOES NOT: bench. A bench rep lowers
 * the bar, so it passes the eccentric narrowing, and since 2026-08-25 it has
 * no release window — the descent is graded on the speed the bar arrives at
 * the chest with. Reaching for `DEPTH_WINDOW_MS.bench` or `DEPTH_LEGAL.bench`
 * is a compile error now, and this is the runtime half for a caller that gets
 * there through a `PlayableLiftKind` variable.
 */
export function depthTimedKindOf(kind: PlayableLiftKind, moment: string): DepthTimedLiftKind {
  if (kind !== 'squat') {
    throw new RangeError(
      `lift: a ${kind} is not graded on a release tick, so it has no ${moment}.`,
    );
  }
  return kind;
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
      // `depthTimedKindOf` rather than a bare index: the depth window is a
      // squat table now, and neither a bench nor a deadlift has a depth cue to
      // ask about. It refuses rather than defaulting — see that function.
      ? LIFT_TUNING.DEPTH_WINDOW_MS[depthTimedKindOf(config.kind, 'the depth window')]
      : cue === 'press'
        // The burst window. Load-independent on purpose: how many taps a human
        // can throw is not a function of what is on the bar, and scaling it
        // would be modelling the player rather than the lift. Fatigue still
        // narrows it below, which is GDD §3.4's channel and is about the
        // lifter, not the bar — and it is the ONLY channel fatigue reaches
        // bench's decisive beat through.
        ? LIFT_TUNING.PRESS_BURST_WINDOW_MS
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

/**
 * BENCH ONLY: what a burst of `taps` is worth, 0..1.
 *
 * ---------------------------------------------------------------------------
 * WHY A SATURATING CURVE AND NOT A LINE WITH A CAP ON IT
 * ---------------------------------------------------------------------------
 * The ruling asks for "rapid tapping to exert as much force as possible", and
 * the honest reading of that is a curve that pays a lot for the first taps and
 * progressively less for the ones after. A line with a cap has the same
 * endpoints and is a different game: every tap up to the cap is worth exactly
 * as much as the first, so the only strategy is to reach the cap, and a player
 * who cannot mash gets a proportional share of nothing. Here the first tap is
 * worth about a quarter of the whole burst.
 *
 *     sat(x) = x / (x + HALF_SATURATION_TAPS)
 *     force  = sat(min(taps, MAX_COUNTED_TAPS)) / sat(MAX_COUNTED_TAPS)
 *
 * The normalisation by `sat(MAX_COUNTED_TAPS)` is what makes the top of the
 * curve exactly 1 rather than an asymptote nobody reaches, so `PRESS_VELOCITY`
 * and `PRESS_WEAK_DEMAND_PENALTY` both have a real endpoint to interpolate
 * against. Past the cap the curve is flat — that is the physics cap, and it is
 * asserted rather than described in `lift.test.ts`.
 *
 * PURE IN THE TAP COUNT ALONE. Not the load, not the seed, not fatigue: how
 * fast a thumb moves is a fact about the player, and scaling this by load
 * would be modelling the player rather than the lift. Fatigue reaches the
 * burst through the WINDOW's width (`cueWindowMs('press', config)`), which is
 * GDD §3.4's own channel, and through nothing else.
 */
export function burstForce(taps: number): number {
  const { HALF_SATURATION_TAPS, MAX_COUNTED_TAPS } = LIFT_TUNING.PRESS_BURST_FORCE;
  if (!Number.isFinite(taps) || taps <= 0) return 0;
  const counted = Math.min(Math.floor(taps), MAX_COUNTED_TAPS);
  const sat = (x: number): number => x / (x + HALF_SATURATION_TAPS);
  const ceiling = sat(MAX_COUNTED_TAPS);
  if (ceiling <= 0) return 0;
  return scrub(clamp01(sat(counted) / ceiling));
}

/**
 * BENCH ONLY: how many of `taps` actually count, after `earlyTaps` false
 * starts have been charged against them.
 *
 * THE WHOLE FALSE-START RULE, AND IT IS ONE LINE BECAUSE THE SENTENCE THE
 * PLAYER IS GIVEN IS ONE LINE. `LIFT_COPY.SUBTITLE.bench` says "Taps before
 * the call count for nothing, and each one costs a tap off your burst — down
 * to a floor of three", and this is that, with `FALSE_START_FLOOR_TAPS` as the
 * three. `lift.test.ts` drives the sim against each clause of the sentence
 * separately rather than against this function, so the copy and the mechanic
 * cannot drift apart quietly.
 *
 * ---------------------------------------------------------------------------
 * IT CHARGES THE TAPS AND NOT THE CEILING, AND THE DIFFERENCE WAS MEASURED
 * ---------------------------------------------------------------------------
 * The first version lowered the burst's CEILING by one per early tap. That
 * makes the sentence false for most players: a ceiling of 12 against a player
 * who was only ever going to land 7 taps costs them nothing, so two false
 * starts were free at every tap rate below a mash. Measured — a moderate
 * burst landed 7 taps with and without two early ones, and the test asserting
 * the jumped rep was weaker read `expected 7 to be less than 7`.
 *
 * A rule whose stated cost only applies to the fastest players is the kind of
 * copy CLAUDE.md keeps catching: true of the code somebody had in mind, false
 * of the code that shipped. Charging the taps themselves makes it true of
 * everybody.
 *
 * IT COSTS THE BURST AND NEVER THE REP. The floor is what makes that true at
 * every number of early taps rather than at the ones somebody swept: a player
 * who mashes the entire pause and then taps three times still launches at
 * `burstForce(FALSE_START_FLOOR_TAPS)`, which is well clear of the unanswered
 * command's 0. Mashing is strictly worse than waiting and it is never fatal,
 * which is the shape the drive branch already states in capitals — "A MISSED
 * TAP COSTS VELOCITY. IT NEVER ENDS THE REP ON ITS OWN."
 *
 * THE FLOOR IS A FLOOR ON THE CHARGE, NOT A GIFT. `min(taps, FLOOR)` is what
 * keeps a player who never answered the command at zero: a burst of no taps
 * stays a burst of no taps however much they mashed the pause, because the
 * floor cannot hand out taps nobody threw.
 * `@guarantee a-false-start-can-never-pay`
 */
export function burstCountedTaps(taps: number, earlyTaps: number): number {
  const { FALSE_START_FLOOR_TAPS } = LIFT_TUNING.PRESS_BURST_FORCE;
  const landed = Number.isFinite(taps) ? Math.max(0, Math.floor(taps)) : 0;
  const early = Number.isFinite(earlyTaps) ? Math.max(0, Math.floor(earlyTaps)) : 0;
  return Math.max(Math.min(landed, FALSE_START_FLOOR_TAPS), landed - early);
}

/**
 * BENCH ONLY: the `TimingGrade` a burst force reads as.
 *
 * 'early' AND 'late' ARE UNREACHABLE HERE BY CONSTRUCTION, and that is the
 * design rather than an oversight. A burst has no direction to be wrong in —
 * it is an amount, not a moment — and a grade reading 'late' for a weak burst
 * would be a name asserting something the code never measured. 'missed' is
 * reserved for a command that went unanswered, which is the only case where
 * the player did not act at all. `lift.test.ts` pins the two unreachable
 * members unreachable.
 */
export function burstGrade(force: number): TimingGrade {
  if (!Number.isFinite(force) || force <= 0) return 'missed';
  const { PERFECT, GOOD } = LIFT_TUNING.PRESS_BURST_GRADE;
  if (force >= PERFECT) return 'perfect';
  if (force >= GOOD) return 'good';
  return 'missed';
}

/**
 * BENCH ONLY: how softly a touch arriving at `rate` landed, 0..1.
 *
 * Linear between `BENCH_TOUCH_SOFT_RATE` (1 — the bar was caught) and
 * `BENCH_TOUCH_CRASH_RATE` (0 — it was dropped). Nothing about the player's
 * timing enters it, which is the point of the 2026-08-25 ruling: squat grades
 * WHEN you release and bench grades HOW THE BAR ARRIVES, and those are two
 * faculties rather than two window widths.
 *
 * HALF THE GRADE, NOT THE GRADE. `descentPatience` is the other half, and on
 * its own this one has a free perfect answer — see that function.
 */
export function touchSpeedQuality(rate: number): number {
  const soft = LIFT_TUNING.BENCH_TOUCH_SOFT_RATE;
  const crash = LIFT_TUNING.BENCH_TOUCH_CRASH_RATE;
  if (!Number.isFinite(rate)) return 0;
  if (crash <= soft) return rate <= soft ? 1 : 0;
  return scrub(clamp01((crash - rate) / (crash - soft)));
}

/**
 * BENCH ONLY: what a descent that took `descentTicks` keeps of its control
 * grade, 0..1.
 *
 * 1 up to `BENCH_DESCENT_PATIENCE_TICKS`, then falling linearly to 0 over
 * `BENCH_DESCENT_DAWDLE_SPAN_TICKS`.
 *
 * ---------------------------------------------------------------------------
 * IT EXISTS BECAUSE THE SPEED GRADE ALONE HAD A DOMINANT STRATEGY
 * ---------------------------------------------------------------------------
 * Arriving slowly is quality 1 by definition, and the cheapest way to arrive
 * slowly is to stop feeding the bar almost immediately, let it stall short of
 * the chest, and nudge it the rest of the way. Measured on the first tuning of
 * this beat: releases at 4, 8 and 12 ticks stalled the bar at every load, and
 * a re-press from a stall lands at a rate near zero. So the beat had a free
 * perfect answer and no reason to ever commit to the descent.
 *
 * Time under a loaded bar is what charges for it, which is also what charges
 * for it in the sport. `lift.test.ts` measures the feathered strategy against
 * the committed one rather than asserting which wins.
 */
export function descentPatience(descentTicks: number): number {
  const free = LIFT_TUNING.BENCH_DESCENT_PATIENCE_TICKS;
  const span = LIFT_TUNING.BENCH_DESCENT_DAWDLE_SPAN_TICKS;
  if (!Number.isFinite(descentTicks) || descentTicks <= free) return 1;
  if (span <= 0) return 0;
  return scrub(clamp01(1 - (descentTicks - free) / span));
}

/**
 * BENCH ONLY: the whole control grade for a touch — how softly it landed,
 * times what a slow descent left of it.
 *
 * ONE PLAYER-FACING QUANTITY BUILT FROM TWO, and the product rather than a
 * minimum or a sum because both halves are already 0..1 fractions of the same
 * thing: a crashed bar at the end of a patient descent and a soft bar at the
 * end of an interminable one are both bad reps, and a rep that is bad on both
 * counts should be worse than either.
 */
export function touchQualityFor(rate: number, descentTicks: number): number {
  return scrub(touchSpeedQuality(rate) * descentPatience(descentTicks));
}

/**
 * BENCH ONLY: the descent rate one tick on, given whether the finger is down.
 *
 * Held feeds the bar (`BENCH_DESCENT_GRAVITY`, capped at
 * `BENCH_DESCENT_MAX_RATE`); released resists it (`BENCH_DESCENT_BRAKE`,
 * floored at 0 — a bar the lifter has stopped is stopped, not rising). Both
 * are load curves, and MAXIMAL is the bigger gravity and the smaller brake,
 * which is where the beat's difficulty under load comes from.
 */
export function benchDescentRate(rate: number, held: boolean, loadRatio: number): number {
  const load = clampLoadRatio(loadRatio);
  if (held) {
    return scrub(
      Math.min(
        LIFT_TUNING.BENCH_DESCENT_MAX_RATE,
        rate + byLoad(LIFT_TUNING.BENCH_DESCENT_GRAVITY, load),
      ),
    );
  }
  return scrub(Math.max(0, rate - byLoad(LIFT_TUNING.BENCH_DESCENT_BRAKE, load)));
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
 *
 * THE TWO BENCH SHORTFALLS ARE SEPARATE TERMS BECAUSE THEY ARE SEPARATE
 * BEATS. `launchShortfall` is `1 - burstForce` — what the taps did not buy —
 * and `touchShortfall` is `1 - touchQuality` — how badly the bar arrived. A
 * player can crash the bar and still tap hard, or catch it perfectly and then
 * fail to answer the command, and the ascent has to be able to tell those two
 * reps apart. Both default to 0, which is what squat and deadlift pass.
 */
export function ascentDemand(
  h: number,
  loadRatio: number,
  kind: PlayableLiftKind,
  extraDepth: number = 0,
  launchShortfall: number = 0,
  touchShortfall: number = 0,
): number {
  const load = clampLoadRatio(loadRatio);
  const base = byLoad(LIFT_TUNING.DEMAND_BASE[kind], load);
  const stick =
    byLoad(LIFT_TUNING.DEMAND_STICK_GAIN[kind], load) *
    gauss(h, STICK_HEIGHT_FRAC[kind], STICK_WIDTH[kind]);
  const buried = 1 + LIFT_TUNING.BURIED_DEMAND_PER_DEPTH * Math.max(0, extraDepth);
  // BENCH: what a limp burst off the chest actually COSTS. See
  // `PRESS_WEAK_DEMAND_PENALTY` — this scales the whole curve for the whole
  // ascent, exactly as `buried` does, because a transient does not survive
  // long enough to decide anything.
  const weak = 1 + LIFT_TUNING.PRESS_WEAK_DEMAND_PENALTY * clamp01(launchShortfall);
  // BENCH: what a bar dropped onto the chest costs, on the same terms and for
  // the same reason. See `BENCH_TOUCH_DEMAND_PENALTY`.
  const crashed = 1 + LIFT_TUNING.BENCH_TOUCH_DEMAND_PENALTY * clamp01(touchShortfall);
  return scrub((base + stick) * buried * weak * crashed);
}

/**
 * Ticks the reversal beat lasts at this load. ECCENTRIC LIFTS ONLY — a deadlift
 * has no bottom to spend a beat at, so its kind does not type-check here.
 */
export function holeTicks(loadRatio: number, kind: EccentricLiftKind): number {
  return Math.max(1, Math.round(byLoad(LIFT_TUNING.HOLE_TICKS[kind], clampLoadRatio(loadRatio))));
}

/**
 * BENCH ONLY: how long the bar waits on the chest before the press command.
 *
 *
 * A PURE FUNCTION OF THE REP'S SEED, computed once when the bar settles rather
 * than drawn from the per-tick generator. Two properties have to hold at once
 * and this is what gets both:
 *
 *   UNPREDICTABLE TO THE PLAYER. A fixed pause is learnable in about three reps,
 *   and once learned the reaction check has silently become an anticipation
 *   check — squat's mechanic under bench's name, which is the exact failure
 *   this beat exists to avoid.
 *
 *   DETERMINISTIC TO EVERYTHING ELSE. `lift.test.ts` pins that a rep is a pure
 *   function of (config, seed, inputs), and a replayed rep has to produce a
 *   byte-identical history. Taking the delay from the per-tick generator would
 *   have broken that in a subtler way than it looks: the tick HOLE begins on
 *   depends on when the player released, so the same seed would give different
 *   pauses to different players, and the replay guarantee would hold only for
 *   the exact script that produced it.
 *
 * It deliberately shares its seed lineage with the bar-path jitter — the first
 * draw off `seedState(seed)` is the same value tick 1 uses. That is stated
 * rather than engineered around because the two are never compared and never
 * rendered together, and an extra decorrelating step would be a magic constant
 * bought with nothing.
 */
export function pressCommandDelayTicks(seed: number): number {
  const { MIN, MAX } = LIFT_TUNING.PRESS_COMMAND_DELAY_TICKS;
  const roll = nextRandom(seedState(seed)).value;
  return MIN + Math.round((MAX - MIN) * clamp01(roll));
}

/**
 * Ticks the lockout beat lasts at this load.
 *
 * ECCENTRIC LIFTS ONLY, and the type is the design. On squat and bench LOCKOUT
 * is a fixed beat that asks for nothing. On deadlift its length is not a tuning
 * lookup at all — it is `downCommandDelayTicks`, drawn from the rep's seed, and
 * the beat is the check. Two different questions, so two different functions.
 */
export function lockoutTicks(loadRatio: number, kind: EccentricLiftKind): number {
  return Math.max(1, Math.round(byLoad(LIFT_TUNING.LOCKOUT_TICKS[kind], clampLoadRatio(loadRatio))));
}

/**
 * DEADLIFT ONLY: how long the bar must be held locked out before the down
 * command, at this rep's seed.
 *
 * A PURE FUNCTION OF THE SEED, for the same two reasons
 * `pressCommandDelayTicks` is one, which its header sets out in full:
 * unpredictable to the PLAYER (a fixed hold is learnable in about three reps,
 * and a learned hold is an anticipation check, not a persistence one) and
 * deterministic to everything else (`lift.test.ts` replays a rep and asserts a
 * byte-identical history).
 *
 * IT SHARES ITS SEED LINEAGE WITH THE BAR JITTER AND WITH BENCH'S COMMAND, and
 * that is stated rather than engineered around. The three are never compared,
 * never rendered together, and no rep is ever both a bench and a deadlift, so a
 * decorrelating step would be a magic constant bought with nothing.
 *
 * NOT GDD §8.1'S FORBIDDEN DICE. What is drawn is WHEN THE HOLD ENDS, never
 * whether it was passed. Two claims, and they are not the same claim:
 *
 *   1. AT EVERY DELAY IN THE RANGE, HOLDING MAKES THE LIFT. Measured 1098 of
 *      1098 — all 61 reachable delays, three seeds each, six loads — with 0
 *      misses. Nothing the draw can do takes the rep off a player who holds.
 *   2. AT EVERY DELAY, LETTING GO AND STAYING OFF COSTS AT LEAST THE CLEAN
 *      LIFT. Measured 0 good-lifts of 1098. Never a reward, ever.
 *
 * WHETHER IT ALSO COSTS THE REP IS ARITHMETIC, NOT THE DRAW, and an earlier
 * version of this docstring got that wrong — it claimed the releaser "loses it"
 * at every delay, which is false at 351 of those 1098 and false BY DESIGN. The
 * bar has to physically fall `LOCKOUT_DROP_HEIGHT_LOSS`, at
 * `lockoutSagPerTick(load)` a tick, after `LOCKOUT_GRIP_GRACE_TICKS` of grace.
 * So the rep is lost exactly when
 *
 *     delay > LOCKOUT_GRIP_GRACE_TICKS + LOCKOUT_DROP_HEIGHT_LOSS / sag(load)
 *
 * and a hold that ends before the bar is gone grades a grind instead. That
 * closed form agrees with the played sim on all 1098 cases.
 *
 * THE FALSE HALF WAS THE §12.3 GUARANTEE SEEN FROM THE OTHER END. The same
 * inequality is what `lockoutSagPerTick` uses to promise that a warm-up pull
 * CANNOT be dropped: at the light end the right-hand side is far past
 * `DOWN_COMMAND_DELAY_TICKS.MAX`, so no delay in the range clears it. A
 * sentence saying every delay loses the bar for a releaser therefore
 * contradicted a refusal condition two functions down, and both were shipped.
 * `lift.test.ts`'s "never rewards letting go, and loses the bar exactly when
 * the sag arithmetic says so" is where every count in this docstring comes
 * from, and it pins them in `DELAY_SWEEP` rather than sampling at a call site:
 * 1098 cases over 61 delays at 3 seeds each, 1098 makes, 0 good-lifts for the
 * releaser, 351 grinds, and 0 disagreements with the closed form. The load
 * list is `DEADLIFT_SWEEP.LOADS`, so "six loads" is that list's length rather
 * than a number written down twice.
 */
export function downCommandDelayTicks(seed: number): number {
  const { MIN, MAX } = LIFT_TUNING.DOWN_COMMAND_DELAY_TICKS;
  const roll = nextRandom(seedState(seed)).value;
  return MIN + Math.round((MAX - MIN) * clamp01(roll));
}

/**
 * DEADLIFT ONLY: height lost per tick of not holding at lockout, at this load.
 *
 * LOAD-SCALED IS HOW GDD §12.3'S "never punish daily engagement" IS MET
 * STRUCTURALLY HERE. At the light end the sag over the longest possible hold is
 * smaller than `LOCKOUT_DROP_HEIGHT_LOSS`, so a warm-up deadlift cannot be
 * dropped no matter what the player does — an arithmetic property of two
 * constants, asserted in `liftTuning.test.ts` and played in `lift.test.ts`,
 * rather than a horizon somebody happened to sweep.
 */
export function lockoutSagPerTick(loadRatio: number): number {
  return byLoad(LIFT_TUNING.LOCKOUT_SAG_PER_TICK, clampLoadRatio(loadRatio));
}

/**
 * DEADLIFT ONLY: the velocity the bar leaves the FLOOR with, at this load.
 *
 * Takes no quality argument, and that absence is the design rather than an
 * omission — see `FLOOR_BREAK_VELOCITY`. Squat's ascent velocity is bought by
 * the depth release and bench's by the reaction; a deadlift's is bought by
 * nothing, because there is no beat before it to have played well.
 */
export function floorBreakVelocity(loadRatio: number): number {
  return byLoad(LIFT_TUNING.FLOOR_BREAK_VELOCITY, clampLoadRatio(loadRatio));
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

/**
 * Depth gained per tick of hold at this load. ECCENTRIC LIFTS ONLY — there is
 * no rate at which a deadlift lowers, because a deadlift does not lower.
 */
export function descentRate(loadRatio: number, kind: EccentricLiftKind): number {
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
  kind: DepthTimedLiftKind,
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

/**
 * A rep, at tick 0, before anything has happened.
 *
 * WHERE THE BAR STARTS IS PER LIFT, and it is the first place the deadlift's
 * missing eccentric shows up in the state rather than in a type. Squat and
 * bench begin standing/racked — `height` 1, `depth` 0 — and travel DOWN before
 * they travel up. A deadlift begins with the bar on the floor, which in this
 * module's units is `height` 0, and the lifter already folded over it, which is
 * `depth` 1.
 *
 * `depthAchieved` STARTS TRUE ON A DEADLIFT, and this is the one field where
 * that needs saying out loud. On the other two it is decided at the reversal
 * and read at LOCKOUT to reject a high squat. A deadlift has no depth to judge
 * — the floor is the bottom and there is no way to cheat it — so leaving the
 * field false would fail every deadlift ever pulled with the copy for a high
 * squat. Legality on a deadlift is decided at the top, by the hold.
 */
export function createLift(config: LiftConfig): LiftState {
  assertConfig(config);
  const onTheFloor = config.kind === 'deadlift';
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
    depth: onTheFloor ? 1 : 0,
    height: onTheFloor ? 0 : 1,
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
    depthAchieved: onTheFloor,
    extraDepth: 0,
    chestRate: null,
    touchQuality: 0,
    pressCommandTick: null,
    burstEndTick: null,
    burstTaps: 0,
    burstEarlyTaps: 0,
    burstLastTapTick: null,
    burstFirstTapTick: null,
    burstForce: 0,
    downCommandTick: null,
    lockoutSlipTicks: 0,
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
  chestRate: number | null;
  touchQuality: number;
  pressCommandTick: number | null;
  burstEndTick: number | null;
  burstTaps: number;
  burstEarlyTaps: number;
  burstLastTapTick: number | null;
  burstFirstTapTick: number | null;
  burstForce: number;
  downCommandTick: number | null;
  lockoutSlipTicks: number;
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
    chestRate: state.chestRate,
    touchQuality: state.touchQuality,
    pressCommandTick: state.pressCommandTick,
    burstEndTick: state.burstEndTick,
    burstTaps: state.burstTaps,
    burstEarlyTaps: state.burstEarlyTaps,
    burstLastTapTick: state.burstLastTapTick,
    burstFirstTapTick: state.burstFirstTapTick,
    burstForce: state.burstForce,
    downCommandTick: state.downCommandTick,
    lockoutSlipTicks: state.lockoutSlipTicks,
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
  // A DEADLIFT IN A PHASE IT CANNOT BE IN IS REFUSED, NOT ABSORBED.
  //
  // `BRACE` routes a deadlift straight to `ASCENT`, so DESCENT and HOLE are
  // unreachable for it — but "unreachable" is a claim about today's control
  // flow, and CLAUDE.md has caught eight of those being false. So it is
  // checked, loudly, once, at the top.
  //
  // It also does a second job that is easy to miss: the branch conditions below
  // read `kind !== 'deadlift'`, which is what lets TypeScript narrow
  // `state.config.kind` to `EccentricLiftKind` inside them. Without this throw
  // that narrowing would be silent — a deadlift somehow in DESCENT would simply
  // skip every branch and tick forever, resolving nothing, which is the worst
  // of the available failures because it looks like a hang rather than a bug.
  // `lift.test.ts` builds the impossible state by hand and pins the throw.
  // -------------------------------------------------------------------------
  const kind = state.config.kind;
  if (kind === 'deadlift' && (m.phase === 'DESCENT' || m.phase === 'HOLE')) {
    throw new RangeError(
      `lift: a deadlift cannot be in ${m.phase} — it has no eccentric. The bar starts on the floor.`,
    );
  }

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
      if (kind === 'deadlift') {
        // ---------------------------------------------------------------
        // THE DEADLIFT'S WHOLE STRUCTURAL DIFFERENCE, IN ONE BRANCH.
        //
        // There is nothing to lower, so the brace ends with the bar leaving
        // the ground: BRACE -> ASCENT, skipping DESCENT and HOLE entirely.
        // No depth cue is armed, because there is no depth to judge.
        //
        // THE BAR IS GIVEN A VELOCITY BY NOBODY. Squat reaches ASCENT with
        // whatever `REVERSAL_VELOCITY` its depth timing bought and bench with
        // whatever `PRESS_VELOCITY` its reaction bought. A deadlift gets
        // `floorBreakVelocity(load)` — a function of the weight and nothing
        // else, because there was no beat before this one to have played
        // well. That absence is the design: a deadlift's input budget is
        // spent at the top of the rep.
        //
        // `m.held` IS NOT FORCED TRUE here, unlike the descent branches
        // below. On squat and bench the hold IS the descent, so the rep
        // cannot proceed without it. On a deadlift the finger's job from
        // here is to TAP the drive cues, and the hold that matters comes
        // later, at lockout. Forcing it down would misreport the player's
        // actual grip state into the ascent.
        //
        // AND THAT SENTENCE NOW HAS A TEST UNDER IT, BECAUSE FOR A ROUND IT
        // DID NOT. An independent critic added the one line this paragraph
        // names — `m.held = true;` immediately below — and the whole suite
        // stayed green while a player who never touched the screen got a
        // CLEAN DEADLIFT at every load, 100 of 100. One assignment collapses
        // both of deadlift's checks at once: the forced grip is never
        // released, so the ascent needs no drive taps and the lockout sag
        // branch can never fire. This repository has shipped this exact
        // defect once already, on bench, where the drive boost silently
        // re-coupled to `m.held` and turned a tap mechanic into a hold — and
        // it was caught by a human on a phone, not by the suite.
        //
        // Two tests in `lift.test.ts` redden on it, and they are deliberately
        // at different levels so neither is the only thing standing here:
        //   - "leaves the grip where the player left it" reads `held` on the
        //     first ASCENT state, against squat and bench on the same input;
        //   - "never hands a clean lift to a player who never touches the
        //     screen" reads `resolution.outcome` over `NEVER_PRESS_SWEEP`,
        //     which is the one that would have caught the bench defect.
        // ---------------------------------------------------------------
        enter('ASCENT');
        m.velocity = scrub(floorBreakVelocity(load));
        m.peakHeight = m.height;
      } else if (kind === 'bench') {
        // ---------------------------------------------------------------
        // BENCH ARMS NO CUE HERE, AND THE ABSENCE IS THE MECHANIC.
        //
        // A ring counting the player down to the chest would tell them the
        // exact tick to lift their finger on, which converts a control check
        // into squat's anticipation check wearing bench's name — the same
        // failure `cueProgress` refuses for deadlift's lockout hold, one beat
        // earlier. What the player watches is the BAR: it is visibly speeding
        // up or slowing down, and `chestApproach` is the read model the stage
        // draws that from.
        //
        // The bar starts down at `DESCENT_DEPTH_PER_TICK.bench` and is fed or
        // resisted from there, one tick at a time, in the DESCENT branch.
        // ---------------------------------------------------------------
        enter('DESCENT');
        m.held = true;
        m.chestRate = scrub(descentRate(load, kind));
        m.events.push({ kind: 'descent-start', tick });
      } else {
        enter('DESCENT');
        m.held = true;
        m.events.push({ kind: 'descent-start', tick });
        // The depth window is known analytically: depth grows at a fixed rate
        // while held, so the tick it reaches DEPTH_IDEAL is arithmetic, not a
        // prediction. Fatigue narrows the window about that tick, never off it.
        const rate = descentRate(load, kind);
        const idealTick = tick + Math.round(LIFT_TUNING.DEPTH_IDEAL[kind] / rate);
        const halfTicks = depthWindowHalfTicks(load, cueWindowMs('depth', state.config), kind);
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
  }

  // -------------------------------------------------------------------------
  // DESCENT — depth grows while held. Release decides the rep's legality.
  // -------------------------------------------------------------------------
  // `kind !== 'deadlift'` is what narrows `kind` to `EccentricLiftKind` for the
  // whole branch. It is never false here — the throw at the top of `stepLift`
  // has already refused that state — so it costs nothing and buys the narrowing
  // without a cast.
  else if (m.phase === 'DESCENT' && kind !== 'deadlift') {
    if (kind === 'bench') {
      // ---------------------------------------------------------------------
      // BENCH: THE CONTROLLED LOWERING (GDD §6.2; ruled 2026-08-25).
      //
      // The finger feeds the bar and lifting it resists. Contact happens when
      // the bar reaches the chest, whatever the player is doing at that
      // instant, and the graded quantity is the RATE it is carrying there.
      //
      // NOTHING HERE READS A CUE, A WINDOW OR A RELEASE TICK. That is the
      // difference between this beat and squat's, and it is why the two are
      // separate branches rather than one branch with a per-kind table: a
      // shared branch with a `kind === 'bench'` inside it would have made
      // "bench is not a squat" a runtime condition instead of a structure.
      // ---------------------------------------------------------------------
      const rate = benchDescentRate(m.chestRate ?? descentRate(load, kind), m.held, load);
      m.chestRate = rate;
      m.depth = scrub(m.depth + rate);
      m.height = scrub(clamp01(1 - m.depth));

      if (m.depth >= LIFT_TUNING.DEPTH_IDEAL[kind]) {
        // THE TOUCH. Legality on a bench is the touch itself — a press that
        // never reaches the chest is three red lights, and one that does is
        // legal however ugly it looked.
        m.depthAchieved = true;
        // `m.phaseTick` is how long this DESCENT has run — the quantity
        // `descentPatience` charges for, read at the instant of contact.
        m.touchQuality = touchQualityFor(rate, m.phaseTick);
        // The bar sinks into the chest by what it was carrying. DRAWING AND
        // FLAVOUR ONLY: `extraDepth` stays 0 on bench on purpose, so the sink
        // is not charged a second time through `BURIED_DEMAND_PER_DEPTH` on
        // top of `BENCH_TOUCH_DEMAND_PENALTY`. `lift.test.ts` pins that.
        m.depth = scrub(
          Math.min(
            LIFT_TUNING.DEPTH_COLLAPSE[kind],
            LIFT_TUNING.DEPTH_IDEAL[kind] + LIFT_TUNING.BENCH_TOUCH_SINK_GAIN * rate,
          ),
        );
        m.height = scrub(clamp01(1 - m.depth));
        m.extraDepth = 0;
        m.chestRate = 0;
        const grade: TimingGrade =
          m.touchQuality >= LIFT_TUNING.PRESS_BURST_GRADE.PERFECT
            ? 'perfect'
            : m.touchQuality >= LIFT_TUNING.PRESS_BURST_GRADE.GOOD
              ? 'good'
              : 'missed';
        m.events.push({ kind: 'chest-touch', tick, grade, quality: m.touchQuality });
        enter('HOLE');
      } else if (m.phaseTick >= LIFT_TUNING.CHEST_TOUCH_TIMEOUT_TICKS) {
        // THE BAR NEVER ARRIVED. Only reachable by stopping the feed and never
        // restarting it — see `CHEST_TOUCH_TIMEOUT_TICKS`. `peakHeight` is 0
        // because nothing was pressed: the rep never left the chest, because
        // it never got there.
        m.resolution = resolutionFor(
          { ...state, ...m, timings: m.timings, peakHeight: 0 },
          'miss',
          'no-touch',
        );
        m.events.push({ kind: 'resolved', tick });
        enter('RESOLVED');
      }
    } else {
      // ---------------------------------------------------------------------
      // SQUAT: depth grows while held. Release decides the rep's legality.
      //
      // `kind !== 'deadlift'` above and `kind === 'bench'` on the branch above
      // this one leave `kind` narrowed to `'squat'`, which is what lets the
      // depth tables — squat-only since the ruling — be indexed without a
      // cast. UNCHANGED FROM THE PRE-RULING MECHANIC, byte for byte, and
      // `lift.test.ts` pins squat's played histories against digests measured
      // before the bench work landed.
      // `@guarantee the-bench-redesign-left-the-other-two-lifts-alone`
      // ---------------------------------------------------------------------
      const cue = m.activeCue;
      if (cue !== null && tick === cue.openTick) {
        m.events.push({ kind: 'depth-cue-open', tick });
      }
      if (m.held) {
        m.depth = scrub(m.depth + descentRate(load, kind));
        m.height = scrub(clamp01(1 - m.depth));
      }

      const reverseNow = released || m.depth >= LIFT_TUNING.DEPTH_COLLAPSE[kind];
      if (reverseNow) {
        const buried = !released && m.depth >= LIFT_TUNING.DEPTH_COLLAPSE[kind];
        m.depthAchieved = m.depth >= LIFT_TUNING.DEPTH_LEGAL[kind];
        m.extraDepth = scrub(Math.max(0, m.depth - LIFT_TUNING.DEPTH_IDEAL[kind]));

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
  }

  // -------------------------------------------------------------------------
  // HOLE — the beat whose JOB DEPENDS ON THE LIFT, and the one place the two
  // mechanics genuinely diverge rather than differing by tuning.
  //
  //   SQUAT   The reversal beat. Nothing is asked for, deliberately: the
  //           reversal is the consequence of the depth input, not a third thing
  //           to hit. Velocity was set on release; the bar has not started
  //           moving yet.
  //
  //   BENCH   The pause on the chest, and where the whole lift is decided
  //           (GDD §6.2, "press-timing / bar-speed check off the chest"). The
  //           bar sits motionless, a command fires at a tick drawn from the
  //           rep's seed, and the player REACTS. What the reaction buys is bar
  //           speed off the chest — see `PRESS_VELOCITY`.
  //
  // The phase names are shared and the beat is not. That is the difference
  // between building a second lift and retuning the first one.
  // -------------------------------------------------------------------------
  // Same narrowing trick, same reason. See the DESCENT branch above.
  else if (m.phase === 'HOLE' && kind !== 'deadlift') {
    const benched = kind === 'bench';

    if (benched) {
      // ---------------------------------------------------------------------
      // BENCH: THE PAUSE, THE COMMAND, AND THE BURST (ruled 2026-08-25).
      //
      // Set the command on the first tick of the beat, not at `createLift`:
      // the tick HOLE begins on is a function of how the player brought the
      // bar down, so the delay is anchored to the pause they actually see.
      // ---------------------------------------------------------------------
      if (m.pressCommandTick === null) {
        m.pressCommandTick = tick + pressCommandDelayTicks(state.config.seed);
      }
      const commandTick = m.pressCommandTick;
      const commanded = tick >= commandTick;
      if (tick === commandTick) {
        m.events.push({ kind: 'press-command', tick });
        // THE WINDOW'S LENGTH IS DECIDED HERE, ONCE, and it is the same for
        // everybody. What a false start costs is the CEILING (see
        // `burstTapCeiling`), never the clock — a shortened window and a
        // lowered ceiling look similar and are not: shortening the window
        // would punish a slow tapper twice for one mistake, because they were
        // already going to run out of taps before they ran out of window.
        m.burstEndTick =
          tick + Math.max(1, Math.round(msToTicks(cueWindowMs('press', state.config))));
      }

      if (pressed) {
        if (!commanded) {
          // A FALSE START BUYS NOTHING AND COSTS A TAP OFF THE CEILING. It
          // does NOT end the rep, consistently with the rule the drive branch
          // already states in capitals — "A MISSED TAP COSTS VELOCITY. IT
          // NEVER ENDS THE REP ON ITS OWN." A competition bench would red
          // light a press before the call outright, and that is left on the
          // table rather than taken: a hard fail on a stimulus the player
          // cannot see coming reads as the game cheating, and it is exactly
          // the judgement GDD §12.1 puts with a human on a phone.
          m.burstEarlyTaps += 1;
          m.events.push({ kind: 'press-false-start', tick, grade: 'missed', quality: 0 });
        } else if (
          m.burstTaps < LIFT_TUNING.PRESS_BURST_FORCE.MAX_COUNTED_TAPS &&
          (m.burstLastTapTick === null ||
            tick - m.burstLastTapTick >= LIFT_TUNING.PRESS_BURST_TAP_REFRACTORY_TICKS)
        ) {
          m.burstTaps += 1;
          m.burstLastTapTick = tick;
          if (m.burstFirstTapTick === null) m.burstFirstTapTick = tick;
          m.events.push({
            kind: 'press-burst-tap',
            tick,
            quality: burstForce(burstCountedTaps(m.burstTaps, m.burstEarlyTaps)),
          });
        }
      }

      // The bar leaves the chest when the window closes, or the instant the
      // physics cap is reached.
      //
      // WHERE THE "RATE" IN THE RULING ACTUALLY LIVES, said plainly because
      // the second arm looks like it and is not. The window is a FIXED length,
      // so the only way to land more taps is to land them faster — rate
      // becomes count, and count becomes force. The cap arm is not a second
      // reward for speed; it is the bar leaving the chest once there is
      // nothing left to add, so a player who has maxed out is not held there
      // watching a window run down.
      const endTick = m.burstEndTick;
      const burstOver =
        commanded &&
        endTick !== null &&
        (tick >= endTick || m.burstTaps >= LIFT_TUNING.PRESS_BURST_FORCE.MAX_COUNTED_TAPS);
      if (burstOver) {
        m.burstForce = burstForce(burstCountedTaps(m.burstTaps, m.burstEarlyTaps));
        // THE FIELD BECOMES THE LAUNCH TICK HERE, which is what its name says
        // and what the ascent's boost decays from. Until this tick it is the
        // SCHEDULED end — what the ring is sized against — and a burst that
        // closed early on the cap would otherwise leave the boost reading a
        // future tick and holding at full strength until it arrived.
        m.burstEndTick = tick;
        const grade = burstGrade(m.burstForce);
        // The reaction, RECORDED BUT NOT SEPARATELY GRADED — see the section
        // header in `liftTuning.ts`. `offsetMs` is ms from the command to the
        // first counted tap, or the whole window if none ever came, so a
        // replay can show how long the player took without the mechanic
        // scoring it twice.
        const firstTap = m.burstFirstTapTick;
        const offsetMs =
          firstTap === null ? (tick - commandTick) * TICK_MS : (firstTap - commandTick) * TICK_MS;
        m.timings.push({
          cue: 'press',
          tick,
          offsetMs: scrub(offsetMs),
          quality: m.burstForce,
          grade,
        });
        m.events.push({ kind: 'press-hit', tick, grade, quality: m.burstForce });
        // THE BAR-SPEED HALF OF §6.2's LINE. On bench the chest touch decides
        // how hard the ascent is and the burst decides how fast it starts.
        const { MIN, MAX } = LIFT_TUNING.PRESS_VELOCITY;
        m.velocity = scrub(MIN + (MAX - MIN) * clamp01(m.burstForce));
        enter('ASCENT');
        m.peakHeight = m.height;
      }
    } else if (m.phaseTick >= holeTicks(load, kind)) {
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
    const attempts = driveAttemptsFor(load, kind);
    const canArmNext =
      m.drivesUsed === 0 ||
      (m.driveArmReadyTick !== null && tick >= m.driveArmReadyTick);
    if (
      m.activeCue === null &&
      m.drivesUsed < attempts &&
      m.height >= LIFT_TUNING.DRIVE_ARM_HEIGHT[kind] &&
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
          ? -byLoad(LIFT_TUNING.DRIVE_WINDOW_MS[kind], load)
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
      m.driveArmReadyTick = tick + driveSpacingTicks(load, kind);
    }

    // The window closed with nothing thrown at it. The cue goes away; the bar
    // does not care, which is the point. Still starts the spacing clock, so a
    // player who lets one cue expire unpressed is not permanently locked out
    // of the ones after it.
    const openCue = m.activeCue;
    if (openCue !== null && tick > openCue.closeTick) {
      m.activeCue = null;
      m.driveArmReadyTick = tick + driveSpacingTicks(load, kind);
    }

    // --- physics ---------------------------------------------------------
    // BENCH'S TWO SHORTFALLS, CARRIED FOR THE WHOLE ASCENT. Squat and deadlift
    // pass 0 for both — their `burstForce` and `touchQuality` are 0 because
    // they have neither beat, and reading either without this guard would
    // charge every squat and every deadlift the maximum penalty on both.
    const launchShortfall = kind === 'bench' ? 1 - clamp01(m.burstForce) : 0;
    const touchShortfall = kind === 'bench' ? 1 - clamp01(m.touchQuality) : 0;
    const demand = ascentDemand(
      m.height,
      load,
      kind,
      m.extraDepth,
      launchShortfall,
      touchShortfall,
    );
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
    // BENCH: THE BURST'S OWN BOOST, on exactly the shape above and for exactly
    // the same reason — a committed impulse that pays out and decays, not a
    // state the player maintains. This is what "exert as much force as
    // possible" produces: `PRESS_VELOCITY` is speed and
    // `PRESS_WEAK_DEMAND_PENALTY` is a handicap; neither of them is the lifter
    // pushing. `burstEndTick` is when the burst closed, which is the tick the
    // bar left the chest, so the decay is measured from the launch.
    if (kind === 'bench' && m.burstEndTick !== null && m.burstForce > 0) {
      const elapsed = tick - m.burstEndTick;
      const decay = clamp01(1 - elapsed / LIFT_TUNING.PRESS_BURST_BOOST_TICKS);
      drive += LIFT_TUNING.PRESS_BURST_BOOST_FORCE_MAX * m.burstForce * decay;
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
    // DEADLIFT'S DERIVED DEPTH IS WHAT THE ART FALLBACK READS, so it is
    // clamped to 0..1 rather than to an eccentric lift's collapse point (which
    // deadlift has no row for, and which describes being buried under a bar
    // that is on the floor here anyway). `1 - height` folds the drawn figure
    // over at the floor and stands it up at lockout — see
    // `DEADLIFT_ART_FALLBACK_KIND` for what that drawing does and does not get
    // right.
    m.depth =
      kind === 'deadlift'
        ? scrub(clamp01(1 - m.height))
        : scrub(clamp(1 - m.height, 0, LIFT_TUNING.DEPTH_COLLAPSE[kind]));

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
      // A DRIVE CUE THAT WAS STILL OPEN WHEN THE BAR LOCKED OUT IS DEAD, AND
      // HAS TO BE CLEARED HERE. Nothing else clears it: the ASCENT branch drops
      // `activeCue` when the cue is pressed or when its window closes, and once
      // the phase changes that branch never runs again — so a bar that locked
      // out mid-window carried a stale cue into LOCKOUT and out the other side.
      //
      // A LEAK IN THE READ MODEL, NOT IN THE PHYSICS, which is why it survived:
      // no outcome reads `activeCue`, so nothing about the rep was decided
      // wrongly. What it did was draw. `cueProgress` returns a number whenever a
      // cue is set, so the renderer put a shrinking DRIVE ring on screen through
      // a beat that is asking for nothing — on all three lifts, and on deadlift
      // specifically that ring sits over the lockout hold and reads as a
      // countdown to the down command, which is the one thing that beat must
      // never show (see `cueProgress`).
      //
      // Found by deadlift's no-countdown test, and it was already there on squat
      // and bench. Fixed for all three rather than special-cased, because the
      // cue is equally dead on all three.
      m.activeCue = null;
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
  // LOCKOUT — the beat whose JOB DEPENDS ON THE LIFT, the same way HOLE's does.
  //
  //   SQUAT / BENCH   Standing, then judged. A fixed beat that asks for
  //                   nothing: the rep was decided below, and this is the pause
  //                   before the verdict.
  //
  //   DEADLIFT        THE CHECK (GDD §6.2, "Deadlift — lockout grind"). The bar
  //                   is locked and the player must not stop holding it until
  //                   the down command, which fires at a tick drawn from the
  //                   rep's seed. Letting go past the grace period sags the
  //                   bar; sagging far enough loses it; re-gripping brings it
  //                   back, and having slipped at all makes the make a grind.
  //
  // The phase name is shared and the beat is not — the same sentence HOLE's own
  // header makes about squat and bench, one lift further out. That is what
  // building a third lift means here rather than retuning the first two.
  // -------------------------------------------------------------------------
  else if (m.phase === 'LOCKOUT') {
    if (m.chalkPuff > 0) {
      m.chalkPuff = scrub(Math.max(0, m.chalkPuff - 1 / LIFT_TUNING.CHALK_PUFF_TICKS));
    }

    if (kind === 'deadlift') {
      // Set the command on the first tick of the beat, not at `createLift`:
      // the tick LOCKOUT begins on is a function of how the player drove the
      // ascent, so the hold is anchored to the lockout they actually reached.
      if (m.downCommandTick === null) {
        m.downCommandTick = tick + downCommandDelayTicks(state.config.seed);
      }
      const commandTick = m.downCommandTick;
      const commanded = tick >= commandTick;
      const grace = m.phaseTick <= LIFT_TUNING.LOCKOUT_GRIP_GRACE_TICKS;

      if (tick === commandTick) m.events.push({ kind: 'down-command', tick });

      if (commanded) {
        // THE HOLD IS OVER. The command is an announcement, not a demand: the
        // player does not have to answer it, and letting go now costs nothing,
        // because that is what the command means. Punishing a player for
        // putting the bar down after being told to would be punishing them for
        // obeying — and it would quietly turn this into a second reaction check.
        //
        // The settle beat exists so the command is a moment the player can
        // actually see and feel before the verdict replaces the screen. See
        // `DOWN_COMMAND_SETTLE_TICKS`.
        m.velocity = 0;
        if (tick - commandTick >= LIFT_TUNING.DOWN_COMMAND_SETTLE_TICKS) {
          const outcome: LiftOutcome =
            isGrind(m.stallTicks, m.ascentTicks) ||
            m.lockoutSlipTicks >= LIFT_TUNING.LOCKOUT_SLIP_GRIND_TICKS
              ? 'grind'
              : 'good-lift';
          m.resolution = resolutionFor({ ...state, ...m }, outcome, null);
          m.events.push({ kind: 'resolved', tick });
          enter('RESOLVED');
        }
      } else if (!m.held && !grace) {
        // THE BAR COMES DOWN. Not "a timer runs" — the failure is positional,
        // so a player who lets go, sees it move, and re-grips is judged on
        // where the bar actually got to.
        m.lockoutSlipTicks += 1;
        m.height = scrub(Math.max(0, m.height - lockoutSagPerTick(load)));
        m.velocity = scrub(-lockoutSagPerTick(load));
        m.events.push({ kind: 'lockout-slip', tick });
      } else if (m.height < 1) {
        // Re-gripped (or still inside the grace period) with the bar down.
        // It comes back, faster than it fell — see
        // `LOCKOUT_REGRIP_RECOVERY_PER_TICK`. A slip is meant to be
        // recoverable; what it costs is the 'good-lift', not the rep.
        m.height = scrub(Math.min(1, m.height + LIFT_TUNING.LOCKOUT_REGRIP_RECOVERY_PER_TICK));
        m.velocity = scrub(LIFT_TUNING.LOCKOUT_REGRIP_RECOVERY_PER_TICK);
      } else {
        m.velocity = 0;
      }
      m.depth = scrub(clamp01(1 - m.height));

      // PUT DOWN BEFORE THE CALL. Checked only while the hold is live — after
      // the command the bar is allowed to go down, which is the whole point of
      // the command. Its own `MissReason`, because "the bar beat you at the
      // sticking point" would be a false sentence about a bar that was locked
      // out a moment ago.
      if (!commanded && 1 - m.height >= LIFT_TUNING.LOCKOUT_DROP_HEIGHT_LOSS) {
        m.resolution = resolutionFor({ ...state, ...m }, 'miss', 'dropped');
        m.events.push({ kind: 'resolved', tick });
        enter('RESOLVED');
      }
    } else {
      m.height = 1;
      m.depth = 0;
      m.velocity = 0;
      if (m.phaseTick >= lockoutTicks(load, kind)) {
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
    chestRate: m.chestRate,
    touchQuality: m.touchQuality,
    pressCommandTick: m.pressCommandTick,
    burstEndTick: m.burstEndTick,
    burstTaps: m.burstTaps,
    burstEarlyTaps: m.burstEarlyTaps,
    burstLastTapTick: m.burstLastTapTick,
    burstFirstTapTick: m.burstFirstTapTick,
    burstForce: m.burstForce,
    downCommandTick: m.downCommandTick,
    lockoutSlipTicks: m.lockoutSlipTicks,
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
  const kind = state.config.kind;
  switch (state.phase) {
    case 'BRACE':
      return p.BRACE[kind];
    case 'DESCENT':
    case 'HOLE': {
      // DEADLIFT CANNOT BE HERE, AND THIS IS THE ONE PLACE THAT IS ANSWERED
      // WITH A FALLBACK RATHER THAN A THROW. `stepLift` refuses the state
      // outright; `promptFor` is a read model a renderer calls on every single
      // frame, and a read model that can crash the screen is a worse failure
      // than one that repeats a line. It returns the brace line — the last
      // thing a deadlifter was legitimately told — rather than an empty string,
      // because a blank caption reads as the game having stopped.
      //
      // Documented rather than silent, and pinned: `lift.test.ts` builds the
      // impossible state by hand and asserts this exact string, so if a future
      // deadlift ever does reach these phases the fallback is a decision
      // somebody can find rather than a blank frame nobody can explain.
      if (kind === 'deadlift') return p.BRACE[kind];
      if (state.phase === 'DESCENT') return p.DESCENT[kind];
      // BENCH: the line flips the instant the command fires. The ring appears
      // at the same tick (`pressCommandIsLive` / `cueProgress`); the caption
      // is what the eye confirms the haptic against. `pressCommandTick` is
      // null until the bar settles, so the waiting line covers that tick too.
      const commandTick = state.pressCommandTick;
      if (kind === 'bench' && commandTick !== null && state.tick >= commandTick) {
        return p.HOLE_COMMANDED;
      }
      // BENCH, BEFORE THE COMMAND, HAVING ALREADY JUMPED IT. The rule the
      // player just broke is invisible otherwise — the cost lands on a burst
      // that has not started yet — so it is said here, at the moment it is
      // broken, as well as up front in `SUBTITLE.bench`.
      if (kind === 'bench' && state.burstEarlyTaps > 0) return p.HOLE_FALSE_START;
      return p.HOLE[kind];
    }
    case 'ASCENT': {
      const cue = state.activeCue;
      if (cue !== null && state.tick >= cue.openTick) return p.ASCENT_CUE_OPEN;
      if (state.drivesUsed > 0) return p.ASCENT_AFTER_CUE;
      return p.ASCENT_BEFORE_CUE;
    }
    case 'LOCKOUT': {
      // DEADLIFT: the line flips at the down command, exactly as bench's does
      // at the press command — and for the opposite reason. Bench's flip is a
      // stimulus the player must answer; this one is a release telling them the
      // hold is over. Before it, the line is a live instruction not to let go.
      const downTick = state.downCommandTick;
      if (kind === 'deadlift' && downTick !== null && state.tick >= downTick) {
        return p.LOCKOUT_DOWN_COMMANDED;
      }
      return p.LOCKOUT[kind];
    }
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
    // BENCH. The command's haptic is the STIMULUS, not feedback on an input
    // the player already made — the only entry in this table that leads the
    // player rather than answering them.
    case 'press-command':
      return h.PRESS_COMMAND;
    case 'press-burst-tap':
      return h.PRESS_BURST_TAP;
    case 'press-hit':
      return event.grade === 'perfect' ? h.PRESS_SHARP : h.PRESS_SLOW;
    case 'press-false-start':
      return h.PRESS_FALSE_START;
    // BENCH. The touch is the descent's payoff and the hand has to be able to
    // tell a catch from a drop without reading anything — a crashed bar is the
    // one the ascent is about to charge for.
    case 'chest-touch':
      return event.grade === 'missed' ? h.CHEST_TOUCH_CRASH : h.CHEST_TOUCH_SOFT;
    case 'drive-hit':
      return event.grade === 'perfect' ? h.DRIVE_PERFECT : h.DRIVE_LOOSE;
    case 'drive-mistimed':
      return h.DRIVE_MISTIMED;
    case 'stall-pulse':
      return h.STALL_PULSE;
    case 'lockout':
      return h.LOCKOUT;
    // DEADLIFT. The slip pulse is the sibling of `STALL_PULSE` one beat later:
    // a rep being lost has to be felt being lost rather than discovered at the
    // verdict. The down command is the only entry in this table that announces
    // the END of something the player was doing.
    case 'lockout-slip':
      return h.LOCKOUT_SLIP;
    case 'down-command':
      return h.DOWN_COMMAND;
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
 * True while the bench burst is live — HOLE, and the command has fired. The
 * ring and the headline both key off this so they cannot disagree about
 * whether the player is being asked to tap.
 *
 * NO `pressUsed` ARM ANY MORE, AND ITS ABSENCE IS NOT A LOOSENING. Under the
 * single-reaction beat one press ended the answer, so "the press has been
 * spent" was a real state the command could still be showing through. A burst
 * is not spent by a tap — it is spent when the window closes or the ceiling is
 * reached, and `stepLift` leaves HOLE on that same tick. So every HOLE state
 * with the command fired is a state the player should be tapping in, and there
 * is no case left for the old arm to exclude. `lift.test.ts` pins the last
 * live tick and the first dead one rather than leaving that as an argument.
 */
export function pressCommandIsLive(state: LiftState): boolean {
  if (state.config.kind !== 'bench') return false;
  if (state.phase !== 'HOLE') return false;
  const commandTick = state.pressCommandTick;
  if (commandTick === null) return false;
  return state.tick >= commandTick;
}

/**
 * BENCH: how the bar is coming in, 0..1 — 0 fully controlled, 1 crashing.
 *
 * Null on squat, on deadlift, and on any bench state outside DESCENT.
 *
 * THE READ MODEL THE STAGE NEEDS AND CANNOT DERIVE. `depth` says where the bar
 * is; it does not say whether it is being caught or dropped, and those are the
 * two reps this beat exists to tell apart. Deliberately the INVERSE of
 * `touchQualityFor` — hot is 1 — because what a renderer wants to scale is the
 * alarm, not the calm.
 *
 * NOT A FATIGUE METER, and the distinction is the same one `stallCapacityLoss`
 * and `lockoutSlipTicks` already make: it is the bar's speed this tick, it
 * resets every rep, it is never persisted, and no constant behind it comes
 * from `fatigue.ts`. Fatigue does not reach bench's descent at all — it
 * reaches the burst, through the window's width, which is GDD §3.4's own
 * channel.
 */
export function chestApproach(state: LiftState): number | null {
  if (state.config.kind !== 'bench') return null;
  if (state.phase !== 'DESCENT') return null;
  const rate = state.chestRate;
  if (rate === null) return null;
  // THE SPEED HALF ONLY. `descentPatience` is about how long the descent has
  // taken, which the stage has no business drawing as heat on the bar — a bar
  // creeping down slowly is not coming in hot, it is just slow, and colouring
  // it as a crash would be a cue that lies.
  return scrub(1 - touchSpeedQuality(rate));
}

/** What the burst has bought so far, for the stage to draw. */
export interface BurstProgress {
  /** Taps landed. Not what they are worth — a false start is charged below. */
  readonly taps: number;
  /** Taps still available before the physics cap closes the burst. Never below 0. */
  readonly tapsLeft: number;
  /** What those taps are worth right now, 0..1. */
  readonly force: number;
  /** Ticks left before the window closes. Never below 0. */
  readonly ticksLeft: number;
}

/**
 * BENCH: the live burst, or null when one is not open.
 *
 * PIECE 2 DRAWS THIS; PIECE 1 ONLY HAS TO MAKE IT TRUE. It is here rather than
 * in a component because "how much force have my taps bought" is a fact about
 * the mechanic, and CLAUDE.md forbids deriving mechanic state inside a `.tsx`
 * file.
 *
 * WHAT IT DELIBERATELY DOES NOT CARRY IS THE WINDOW'S FULL WIDTH. `ticksLeft`
 * over the base `PRESS_BURST_WINDOW_MS` would be a 0..1 fatigue ratio, and a
 * 0..1 ratio is one `<View style={{width}}>` away from the meter §12.3
 * refuses — the same back door `CueWindow.widthMs` already documents. So the
 * denominator stays out of `src/lift/`, and `liftTuning.test.ts` enforces
 * that by name for this constant as well as for the other two.
 */
export function burstProgress(state: LiftState): BurstProgress | null {
  if (!pressCommandIsLive(state)) return null;
  const endTick = state.burstEndTick;
  const cap = LIFT_TUNING.PRESS_BURST_FORCE.MAX_COUNTED_TAPS;
  return {
    taps: state.burstTaps,
    tapsLeft: Math.max(0, cap - state.burstTaps),
    force: burstForce(burstCountedTaps(state.burstTaps, state.burstEarlyTaps)),
    ticksLeft: endTick === null ? 0 : Math.max(0, endTick - state.tick),
  };
}

/**
 * DEADLIFT: true while the lockout hold is the live demand — LOCKOUT, and the
 * down command has not yet fired.
 *
 * The sibling of `pressCommandIsLive` above, and written from it deliberately
 * rather than in parallel, because CLAUDE.md's "a guard written for one hook
 * must be applied to its sibling" has been paid for four times in this
 * repository and twice at a distance of one branch.
 *
 * NOTE THE INVERSION, which is the whole design in one predicate: bench's goes
 * true when the player must ACT, this one goes true while the player must NOT
 * STOP. The renderer uses it for the same purpose either way — to keep the
 * headline and any stage treatment from disagreeing about what is being asked.
 */
export function lockoutHoldIsLive(state: LiftState): boolean {
  if (state.config.kind !== 'deadlift') return false;
  if (state.phase !== 'LOCKOUT') return false;
  const downTick = state.downCommandTick;
  // NULL MEANS THE HOLD HAS JUST STARTED, NOT THAT IT IS OVER. `downCommandTick`
  // is set on the first tick the LOCKOUT branch runs, which is one tick after
  // the ASCENT branch entered the phase — so on the lockout tick itself it is
  // still null while the player is very much required to be holding. Returning
  // false there would blank the "don't let go" line for exactly the frame the
  // bar arrives at lockout, which is the frame it matters most.
  //
  // `pressCommandIsLive` gets to return false in its null case because bench's
  // question is "has the command fired yet", and before it fires the answer is
  // genuinely no. Deadlift's question is the inverse — "is the player still on
  // the hook" — and before the command fires the answer is yes. The two
  // predicates look like mirror images and the null case is where they are not.
  if (downTick === null) return true;
  return state.tick < downTick;
}

/**
 * Cue progress for the renderer: 0 when the window opens, 1 at the ideal
 * moment, above 1 as it closes. Null when no cue is up.
 *
 * A number the UI draws a shrinking ring from. It says nothing about fatigue —
 * the window it describes has already been adjusted, and there is no base to
 * compare it against here.
 *
 * BENCH'S PRESS COMMAND IS NOT A COUNTDOWN. Before the command fires this
 * returns null, same as squat HOLE. From the command tick it starts at 1
 * (the ring sits on the target — GO) and runs toward 2 as the reaction
 * window closes. That is a stimulus, not a telegraph.
 *
 * AND DEADLIFT'S LOCKOUT HOLD GETS NO RING AT ALL — NOT EVEN THE "GO" ONE.
 * There is no cue to arm in a deadlift LOCKOUT (`activeCue` is null through the
 * whole beat) so this already returns null there; it is stated because the
 * absence is load-bearing rather than incidental. A ring that filled toward the
 * down command would tell the player exactly how much longer they had to hold,
 * which converts "keep holding" into "hold for 1.4 seconds" — squat's
 * anticipation faculty wearing deadlift's name, and the exact failure the
 * seeded delay exists to prevent. `lift.test.ts` pins it null for every tick of
 * every deadlift lockout, the same way it pins bench's pre-command null.
 */
export function cueProgress(state: LiftState): number | null {
  if (pressCommandIsLive(state)) {
    const commandTick = state.pressCommandTick;
    const endTick = state.burstEndTick;
    if (commandTick === null || endTick === null) return null;
    const span = endTick - commandTick;
    if (span <= 0) return null;
    return scrub(1 + (state.tick - commandTick) / span);
  }
  const cue = state.activeCue;
  if (cue === null) return null;
  const span = cue.idealTick - cue.openTick;
  if (span <= 0) return null;
  return scrub((state.tick - cue.openTick) / span);
}
