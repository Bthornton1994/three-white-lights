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
 *             SUSTAINED EXERTION. Ruled 2026-08-25, steered the same day by
 *             the phone replay. DESCENT is near-automatic: the bar comes down
 *             on its own at a load-paced rate and the finger's only job is to
 *             stay down, because letting go lets the bar run away and it
 *             arrives hot. HOLE is the pause and the command. From the command
 *             the player's TAP RATE is the lifter's force, continuously, until
 *             the rep resolves — one grind layer, not a burst handing off to
 *             cues.
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
 *             ON BENCH: none of the above, and since the 2026-08-25 replay
 *             steer, nearly nothing at all. The bar comes down on its own at
 *             `DESCENT_DEPTH_PER_TICK.bench` while the finger is DOWN, runs
 *             away above that rate while the finger is UP
 *             (`BENCH_DESCENT_RUNAWAY_PER_TICK`) and is floored back onto it
 *             when the finger returns (`BENCH_DESCENT_RECOVER_PER_TICK`).
 *             Contact happens when depth reaches the chest. What is graded is
 *             the RATE at contact, between BENCH_TOUCH_SOFT_RATE and
 *             BENCH_TOUCH_CRASH_RATE, and a crashed touch makes the whole
 *             ascent harder. The rate is floored above zero, so the bar always
 *             arrives — there is no 'no-touch' any more, and no timeout.
 *
 *   HOLE      ON SQUAT: a fixed reversal beat. The bar leaves it at a velocity
 *             set by the depth timing quality. A good release is not points,
 *             it is speed.
 *
 *             ON BENCH THIS IS THE PAUSE AND THE COMMAND. The bar sits on the
 *             chest; a command fires at a tick drawn from the rep's seed; the
 *             bar leaves the chest PRESS_LAUNCH_MS later at a velocity set by
 *             whatever grind charge the player has built by then. Taps thrown
 *             BEFORE the command count for nothing and each one delays the
 *             tick taps start counting, capped by GRIND_FALSE_START.
 *
 *   ASCENT    The bar rises against a demand curve peaked at the sticking point
 *             (STICK_HEIGHT_FRAC, shared with the sprite system so the stall is
 *             drawn where it happens). At the maximal preset the peak demand is
 *             above the lifter's capacity, so an undriven bar decelerates,
 *             stops, and goes backwards.
 *
 *             ON SQUAT AND DEADLIFT the DRIVE cue arms at DRIVE_ARM_HEIGHT and
 *             its ideal moment is DRIVE_IDEAL_LEAD_MS later. A press inside the
 *             window commits a decaying force boost, independent of whether the
 *             player keeps holding afterward — landing a second or third cue
 *             (the tap-rate mechanic) requires releasing and re-pressing on a
 *             real device, so the boost cannot depend on a continuous hold
 *             without making that mechanic self-defeating (measured: it did,
 *             until this was fixed). A press outside the window costs velocity
 *             and burns the attempt.
 *
 *             ON BENCH THERE IS NO CUE AND THE GRIND JUST CONTINUES. Every tap
 *             that clears the refractory gap adds to a rolling charge that
 *             decays every tick, and `GRIND_BOOST_FORCE_MAX * grindForce` is
 *             added to what the lifter has ON EVERY TICK. Stop tapping and the
 *             charge falls away and the bar stalls; start again and it comes
 *             back and the bar can be rescued. That is the whole of the
 *             2026-08-25 replay steer, and it is arithmetic rather than a
 *             special case.
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
 * 'drive' is SQUAT AND DEADLIFT — bench's ascent stopped arming discrete cues
 * on the 2026-08-25 replay steer, which merged them into the grind. 'depth' is
 * SQUAT ONLY — bench's descent stopped being a release-at-a-moment check the
 * same day, and a deadlift has no descent. 'press' is BENCH ONLY, and it is
 * the one cue here that is not graded on WHEN an input landed: it records the
 * LAUNCH — how much grind charge was behind the bar when it left the chest —
 * and the ms from the command to the first counted tap beside it, so a replay
 * can show the reaction without the mechanic scoring it twice. See
 * `grindForce`.
 *
 * THE 'drive' MEMBER IS NOT DELETED AND BENCH KEEPS ITS `DRIVE_*` ROWS. Two
 * lifts still arm the cue, and `cueWindowMs('drive', config)` is a total
 * function over `PlayableLiftKind` because `session.ts` queries the window per
 * kind for GDD §3.4's fatigue channel. Bench's rows are therefore read by that
 * query and by nothing in a bench rep's physics — said plainly because a value
 * read by nothing is worse than a magic number, and `lift.test.ts` pins that
 * no bench rep arms a drive cue at any load.
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
 *
 * 'no-touch' WAS BENCH'S AND IS DELETED, 2026-08-25 replay steer. It was
 * reachable only by braking the bench descent to a stop and never restarting
 * it, and the steer made the descent automatic — `benchDescentRate` floors the
 * rate at `DESCENT_DEPTH_PER_TICK.bench`, so depth strictly increases every
 * tick and the chest is reached in at most `ceil(1 / that rate)` ticks
 * whatever the player does. The member is deleted rather than kept for a case
 * that cannot happen: a `MissReason` nothing produces is a sentence in
 * `LIFT_COPY.MISS_REASON` no player can ever be shown, and `meetPreview.ts`'s
 * bench script had a whole style mapped onto it. `lift.test.ts` pins the
 * arithmetic bound rather than sweeping for the absence.
 */
export type MissReason =
  | 'no-depth'
  | 'buried'
  | 'stalled'
  | 'timeout'
  | 'dropped';

export const MISS_REASONS = Object.freeze([
  'no-depth',
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
  /** BENCH ONLY: the press command fired. The grind is live from this tick. */
  | 'press-command'
  /** BENCH ONLY: one counted tap of the grind. Carries the live force. */
  | 'grind-tap'
  /** BENCH ONLY: the bar left the chest. Carries the force behind the launch. */
  | 'press-launch'
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
  'grind-tap',
  'press-launch',
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
  /** Present on 'depth-hit', 'drive-hit', 'chest-touch' and 'press-launch'. */
  readonly grade?: TimingGrade;
  /**
   * 0..1. Present on 'depth-hit' and 'drive-hit' (timing quality), on
   * 'chest-touch' (control at contact) and on 'grind-tap'/'press-launch' (the
   * grind's live force, and the force behind the launch).
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
   * would have been decorative, and for why it is the ONLY thing a bench
   * descent can cost since the 2026-08-25 replay steer.
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
   * BENCH ONLY. The tick the bar leaves the chest, set when the command fires.
   * Null on squat and deadlift, and null on bench before the command.
   *
   * ONE MEANING, WHICH IS A SIMPLIFICATION THE STEER BOUGHT. Its predecessor
   * `burstEndTick` meant two things — the scheduled close of the burst window
   * before the event and the actual close after it — because a burst could end
   * early on the tap cap and the ascent's boost decayed from the launch. There
   * is no cap to end early on and no impulse to decay, so this is the schedule
   * and stays the schedule. `PRESS_LAUNCH_MS` is how far ahead of the command
   * it is set, through `cueWindowMs('press', config)` so fatigue narrows it.
   */
  readonly pressLaunchTick: number | null;
  /**
   * BENCH ONLY. Counted taps this rep, from the command onward. Never capped.
   *
   * NOT WHAT THE GRIND IS WORTH — that is `grindForce`, and the difference is
   * the whole 2026-08-25 replay steer. A total that only rises cannot say
   * whether the player is tapping NOW. This is here for the readout's "how
   * many taps did that rep take" and for the tests, not for the physics.
   */
  readonly grindTaps: number;
  /**
   * BENCH ONLY. Taps thrown at the pause, before the command.
   *
   * They buy nothing and each one delays the tick taps start counting, capped
   * by `GRIND_FALSE_START`. That is the whole false-start rule and it is
   * stated to the player in `LIFT_COPY.SUBTITLE.bench`.
   */
  readonly grindEarlyTaps: number;
  /** BENCH ONLY. Tick of the last counted tap, for the refractory gap. Null before the first. */
  readonly grindLastTapTick: number | null;
  /** BENCH ONLY. Tick of the FIRST counted tap — the reaction, recorded. Null before it. */
  readonly grindFirstTapTick: number | null;
  /**
   * BENCH ONLY. The rolling tap charge: `+1` per counted tap, multiplied by
   * `GRIND_CHARGE_DECAY_PER_TICK` every tick. 0 before the command.
   *
   * NOT A FATIGUE SCALAR, and the distinction is the same one `chestRate`,
   * `stallCapacityLoss` and `lockoutSlipTicks` already make: it is a fact
   * about what the PLAYER'S THUMB is doing this tick, it resets every rep, it
   * is never persisted, and no constant behind it comes from `fatigue.ts`.
   */
  readonly grindCharge: number;
  /**
   * BENCH ONLY. What the charge is worth right now, 0..1. `grindForce(charge)`.
   *
   * READ EVERY ASCENT TICK, which is what makes the grind continuous:
   * `GRIND_BOOST_FORCE_MAX * this` is added to the lifter's capacity on every
   * tick the bar is going up.
   */
  readonly grindForce: number;
  /**
   * BENCH ONLY. The grind force at the tick the bar left the chest, 0..1.
   * What bought the launch velocity (`PRESS_VELOCITY`). 0 until the launch.
   *
   * A SNAPSHOT AND NOT A MULTIPLIER. Its predecessor `burstForce` scaled the
   * whole ascent's demand through `PRESS_WEAK_DEMAND_PENALTY`; that penalty is
   * deleted, because a number sampled in the first 300ms deciding the rest of
   * a continuous grind is the beat the steer replaced. This is recorded, drawn
   * and graded, and it does not reach the ascent's physics.
   */
  readonly launchForce: number;

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
 * ---------------------------------------------------------------------------
 * BENCH ONLY: is this bar far enough under the lifter that the ASCENT CLOCK
 * has no business deciding it?
 * ---------------------------------------------------------------------------
 * `peakDemand - capacity` at the sticking point against
 * `BENCH_WARMUP_FLOOR_MARGIN`. Both terms are fixed before the rep starts, so
 * this is a property of the BAR AND THE LIFTER and not of anything the player
 * does with either — it cannot be played into or out of, and it reads the same
 * on the first tick as on the last.
 *
 * WHY IT IS NOT KEYED ON THE RUNG. `LiftConfig` has no RPE in it, and giving it
 * one to make this decision would put the prescription inside the physics: the
 * engine would be asking "what was I told this was" instead of "what is this".
 * The margin is the mechanical statement of the same thing, and the reachable
 * rungs are separated by a 0.0160-wide gap in it, which the tuning header
 * records and `lift.test.ts` pins from both sides.
 *
 * WHAT IT DOES NOT DO, WHICH IS MOST OF THE POINT: it does not add force, does
 * not change velocity, does not touch the grade, and does not shorten or
 * lengthen a rep that reaches lockout on its own. The ONLY thing downstream of
 * it is which constant the timeout compares against, so a rep that never
 * reaches the timeout is byte-identical with the floor and without it.
 */
export function benchClearsTheClock(config: LiftConfig): boolean {
  const margin = benchBaseMargin(config);
  return margin !== null && margin <= LIFT_TUNING.BENCH_WARMUP_FLOOR_MARGIN;
}

/**
 * BENCH ONLY: `peakDemand - capacity` on the BASE curve, or null for a lift
 * that has no such line drawn through it.
 *
 * ONE MARGIN, TWO CONSUMERS, AND THAT IS THE POINT RATHER THAN TIDINESS.
 * `benchClearsTheClock` reads it to decide which clock the ascent runs on;
 * `benchWorkingExcess` reads it to decide what the bar costs on top of the base
 * curve. Writing the subtraction twice is how the two would drift into
 * classifying the same rep differently — a bar that is a warm-up for the clock
 * and a working set for the demand curve, which is exactly the hole GDD §12.3's
 * warm-up protection lives in. Sharing the expression makes
 * `benchWorkingExcess(c) > 0` and `benchClearsTheClock(c)` exact complements by
 * construction, and `lift.test.ts` drives that over every reachable cell rather
 * than trusting this paragraph.
 *
 * ON THE BASE CURVE, DELIBERATELY. `ascentDemand`'s working-rung term is left
 * at its zero here, so the quantity this returns is a fact about the bar and
 * the lifter and NOT about the lever it feeds. Reading the levered peak instead
 * would make the classification depend on its own output, and the two edges the
 * floor rests on (-0.0483 against -0.0323) would move every time the lever was
 * retuned — so the gap that separates the rungs could be closed by a knob that
 * is supposed to be scoped by it.
 */
function benchBaseMargin(config: LiftConfig): number | null {
  if (config.kind !== 'bench') return null;
  const peak = ascentDemand(STICK_HEIGHT_FRAC.bench, config.loadRatio, 'bench', 0, 0);
  return peak - lifterCapacity(config);
}

/**
 * ---------------------------------------------------------------------------
 * BENCH ONLY: how far past the warm-up line this bar sits, in capacity units.
 * Zero at and below it, for every rep, on every other lift.
 * ---------------------------------------------------------------------------
 * The input to `benchWorkingRungDemand`. Like `benchClearsTheClock` it is fixed
 * before the rep starts and cannot be played into or out of: no tap, no
 * descent, no depth and no crash moves it.
 *
 * WHY THE LEVER IS KEYED HERE AND NOT ON `loadRatio`, WHICH WAS THE OBVIOUS
 * GUESS AND IS IMPOSSIBLE. The rungs OVERLAP in load — RPE 7 reaches 0.8750 at
 * a `popping` check-in and RPE 8's cells are 0.8000 to 0.9000, so 0.8750 is a
 * cell on both rungs — and no cut in `loadRatio` separates a warm-up from a
 * working set. They are cleanly separated in this quantity, because the
 * check-in that raises the prescribed load raises the lifter's capacity by
 * more (see `REACHABLE_COUPLING` in `lift.test.ts`). That is the same fact
 * `BENCH_WARMUP_FLOOR_MARGIN` was chosen from, used a second time.
 * `@guarantee the-working-lever-cannot-reach-a-warm-up`
 */
export function benchWorkingExcess(config: LiftConfig): number {
  const margin = benchBaseMargin(config);
  if (margin === null) return 0;
  return scrub(Math.max(0, margin - LIFT_TUNING.BENCH_WARMUP_FLOOR_MARGIN));
}

/**
 * ---------------------------------------------------------------------------
 * BENCH ONLY: what a WORKING bar costs on top of the base demand curve.
 * ---------------------------------------------------------------------------
 *
 *     band(baseMargin) = baseMargin <  CUT_MARGIN       ? 'onset'
 *                       : baseMargin <  WALL_CUT_MARGIN  ? 'middle'
 *                       :                                  'wall'
 *     addend(band)      = onset -> ONSET, middle -> MIDDLE_ADDEND, wall -> WALL_ADDEND
 *     working(excess)    = min(addend(band), max(0, MARGIN_CEILING - baseMargin))
 *
 * for `excess > 0`, and exactly 0 otherwise. THREE ADDENDS, NOT TWO, SINCE THE
 * 2026-08-31 RULING ("THE TWO-KNOB SEARCH HAS PROVEN A STRUCTURAL WALL"). The
 * two-addend split (2026-08-28 FOURTH) gave RPE 9 and RPE 10 exactly one shared
 * knob (`WALL_ADDEND`), and six rounds of phone replay against that shape found
 * a genuine structural wall rather than a tuning miss: RPE 10's own `>= 7`
 * floor requirement pins `WALL_ADDEND`'s usable range so tightly that RPE 9
 * cannot be pushed into a visibly harder band without RPE 10 falling below it.
 * A THIRD band — `WALL_CUT_MARGIN` to `CUT_MARGIN` at the low end and
 * `WALL_CUT_MARGIN` itself at the high end — gives RPE 9 its own addend,
 * `MIDDLE_ADDEND`, so it can move without RPE 10 or meet moving at all. See
 * `BENCH_WORKING_RUNG_DEMAND_WALL_CUT_MARGIN` for the measured RPE 9/RPE 10
 * base-margin gap this second cut sits inside — the same class of fact
 * `BENCH_WORKING_RUNG_DEMAND_CUT_MARGIN` already is, one gap further up the
 * ladder, found by the same method.
 *
 * NOT `DEMAND_BASE` WITH AN `if` IN FRONT OF IT, AND THE DIFFERENCE IS THE STEP
 * AT THE LINE RATHER THAN ANY SLOPE. A uniform rise adds the same number at
 * every load INCLUDING the warm-up rungs, and the warm-up rungs are where it is
 * spent. This adds an addend above the warm-up line and exactly nothing below
 * it, so the demand curve stops being a continuous function of load — and the
 * place it breaks is one `loadRatio` cannot locate, because the rungs overlap
 * in load. THERE ARE NOW TWO SUCH STEPS, for the same reason each time:
 * `loadRatio` cannot locate either boundary, because RPE 8/RPE 9 overlap in
 * load and RPE 9/RPE 10 overlap in load too (see `WALL_CUT_MARGIN`'s header).
 * Both are placed by base margin exactly as the first step is. Inside each
 * band the addition is uniform on purpose — still no ramp, for the reason the
 * next paragraph records.
 *
 * A RAMP STOOD HERE FOR ONE ROUND (2026-08-27 through 2026-08-28) AND WAS
 * DELETED. `ONSET + SPAN * excess / (excess + HALF)` was justified as being
 * what compressed the ladder, and a magnitude-matched control measured the
 * opposite: the flat step compresses the twelve working cells' tap floors to a
 * spread of 3.294 against the ramped version's 3.471, from 5.391 with no lever
 * at all. Two constants and a confounded mutation test, in service of a
 * property they did not have. The full reading is in
 * `BENCH_WORKING_RUNG_DEMAND_ONSET`'s header. Every split since (2026-08-28
 * FOURTH's two bands, this round's three) keeps that lesson: within each band
 * the addend is still a flat step, not a ramp — `workingExcess` is not a
 * variable this function scales anything by, only the input the base margin is
 * reconstructed from.
 *
 * THE KIND GUARD IS NOT DEFENSIVE, IT IS THE `launchShortfall` LESSON. That
 * parameter was deleted from `ascentDemand` partly because its default made it
 * invisible at every squat and deadlift call site — which is how a channel goes
 * stale without anything going red. This one is a defaulted parameter too, so
 * the guard is inside the function rather than at the call sites, and
 * `lift.test.ts` drives a non-zero excess into a squat and a deadlift curve and
 * asserts both are byte-identical to the undriven ones.
 *
 * `LiftConfig` STILL CARRIES NO RPE FIELD, AND THAT IS BY DESIGN RATHER THAN AN
 * OMISSION THIS FUNCTION WORKS AROUND. All three bands, including the new one,
 * are selected by the same physical quantity `benchClearsTheClock` already
 * reads (`peakDemand - capacity` on the base curve, fixed before the rep
 * starts) — never by a rung label, a prescription, or anything a session
 * "called" the set.
 *
 * THE SELECTIVITY THIS ROUND'S RULING ASKS FOR — THE MIDDLE BAND CANNOT MOVE
 * RPE 8, RPE 10 OR MEET — IS A STRUCTURAL CONSEQUENCE OF THE PARTITION ABOVE,
 * NOT A SEPARATE CHECK BOLTED ON. Every reachable cell falls into exactly one
 * of the three bands by its own base margin (this function does not consult
 * anything else), so a cell outside the `[CUT_MARGIN, WALL_CUT_MARGIN)` band
 * can be reached by changing `MIDDLE_ADDEND` only if its base margin sits
 * inside that band, which `lift.test.ts` measures directly against the real
 * reachable domain rather than trusting this paragraph — see the test naming
 * "the middle band" for the two-probe-value drive.
 *
 * THE PIECEWISE SHAPE MAKES THE EFFECTIVE DEMAND MARGIN FALL AT A BAND
 * BOUNDARY, AND THAT IS ALLOWED WHILE THE REP GETTING EASIER IS NOT. Each band
 * adds a flat addend, so a bar crossing upward into a band whose addend is
 * smaller loses that difference at the same instant its own base margin rises.
 * The margin is an intermediate scalar and no player experiences it; what a
 * player experiences is whether the rep can still be ground out at the cadence
 * they can hold. Adding weight must never make that easier, whatever the
 * scalar does in between. `lift.test.ts` measured the two apart on purpose
 * once a scalar assertion here had blocked a retune the game itself did not
 * object to — see `LOAD_LADDER` there for the finding, the rule and the
 * mutants — and this is now the claim that is checked, over every cadence at
 * every load on that ladder, rather than the scalar that used to stand in for
 * it. A tuning change that steps this function's addends far enough apart to
 * cost a rep at a boundary reddens there.
 * `@guarantee a-heavier-bench-is-never-easier`
 */
export function benchWorkingRungDemand(kind: PlayableLiftKind, workingExcess: number): number {
  if (kind !== 'bench') return 0;
  if (!Number.isFinite(workingExcess) || workingExcess <= 0) return 0;
  // IT IS ALSO THE ONLY PLACE THE ADDITION DEPENDS ON THE LOAD AT ALL, since
  // the ramp was deleted. That is the whole use `workingExcess` has left here:
  // `workingExcess + BENCH_WARMUP_FLOOR_MARGIN` reconstructs the base margin
  // rather than taking it as a second parameter, because for a positive excess
  // the two are the same number by `benchWorkingExcess`'s own definition and a
  // second parameter is a second thing that can be passed wrong. The same
  // reconstructed margin now decides which of THREE addends applies, against
  // `BENCH_WORKING_RUNG_DEMAND_CUT_MARGIN` (RPE 8 / RPE 9 boundary) and
  // `BENCH_WORKING_RUNG_DEMAND_WALL_CUT_MARGIN` (RPE 9 / RPE 10 boundary) — see
  // each constant's own header for the measured gap it sits inside.
  const baseMargin = workingExcess + LIFT_TUNING.BENCH_WARMUP_FLOOR_MARGIN;
  const addend =
    baseMargin >= LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_WALL_CUT_MARGIN
      ? LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_WALL_ADDEND
      : baseMargin >= LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_CUT_MARGIN
        ? LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_MIDDLE_ADDEND
        : LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_ONSET;
  // THE CEILING, AND IT IS NOT A SAFETY CLAMP — IT IS THE PLACE ANOTHER RULE
  // IN THIS FILE STOPS HOLDING. See `BENCH_WORKING_RUNG_DEMAND_MARGIN_CEILING`
  // for the two walls (max-effort, false-start) it is sized between. The lever
  // raises a bar TOWARD that line and never past it, and adds exactly nothing
  // to a bar already beyond it — so a cell the shipped tree already puts past
  // the line is byte-identical with this lever and without it, whichever
  // addend it would otherwise have taken. UNCHANGED BY THE THIRD BAND: the
  // clip applies to whichever addend was selected, the same way it always has.
  const headroom = LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_MARGIN_CEILING - baseMargin;
  return scrub(Math.min(addend, Math.max(0, headroom)));
}

/** The ascent clock this rep runs on. See `benchClearsTheClock`. */
export function ascentTimeoutTicksFor(config: LiftConfig): number {
  return benchClearsTheClock(config)
    ? LIFT_TUNING.BENCH_WARMUP_FLOOR_ASCENT_TICKS
    : LIFT_TUNING.ASCENT_TIMEOUT_TICKS;
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
        // The LAUNCH BEAT — how long the bar stays on the chest after the
        // command. Load-independent on purpose: how fast a human can answer a
        // call is not a function of what is on the bar, and scaling it would
        // be modelling the player rather than the lift. Fatigue still narrows
        // it below, which is GDD §3.4's channel and is about the lifter, not
        // the bar — a tired lifter gets less time on the chest to build the
        // launch. It is not a scoring window: taps land after it too, on the
        // same rolling charge. See `PRESS_LAUNCH_MS`.
        ? LIFT_TUNING.PRESS_LAUNCH_MS
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
 * BENCH ONLY: what a rolling tap charge of `charge` is worth right now, 0..1.
 *
 * ---------------------------------------------------------------------------
 * WHY A SATURATING CURVE AND NOT A LINE WITH A CAP ON IT
 * ---------------------------------------------------------------------------
 * The ruling asks for "rapid tapping to exert as much force as possible" and
 * the replay steer asks for "continuously tap to grind through". The honest
 * reading of both is a curve that pays a lot for the first taps of a rate and
 * progressively less for the ones after. A line with a cap has the same
 * endpoints and is a different game: every unit up to the cap is worth exactly
 * as much as the first, so the only strategy is to reach the cap, and a player
 * who cannot mash gets a proportional share of nothing.
 *
 *     sat(x) = x / (x + HALF_SATURATION)
 *     force  = sat(min(charge, CEILING)) / sat(CEILING)
 *
 * The normalisation by `sat(CEILING)` is what makes the top of the curve
 * exactly 1 rather than an asymptote nobody reaches, so `PRESS_VELOCITY` and
 * `GRIND_BOOST_FORCE_MAX` both have a real endpoint to interpolate against.
 * Past the ceiling the curve is flat — that is the physics cap, and it is
 * asserted rather than described in `lift.test.ts`.
 *
 * PURE IN THE CHARGE ALONE. Not the load, not the seed, not fatigue: how fast
 * a thumb moves is a fact about the player, and scaling this by load would be
 * modelling the player rather than the lift. Fatigue reaches the grind through
 * the LAUNCH BEAT's length (`cueWindowMs('press', config)`), which is GDD
 * §3.4's own channel, and through `lifterCapacity`, and through nothing else.
 *
 * IT REPLACES `burstForce(taps)`, WHICH TOOK AN INTEGER COUNT. The count could
 * only rise, so it could not express "the player has stopped tapping" — which
 * is the state the whole steer is about. Same curve shape, a continuous
 * quantity under it.
 */
export function grindForce(charge: number): number {
  const { HALF_SATURATION, CEILING } = LIFT_TUNING.GRIND_CHARGE;
  if (!Number.isFinite(charge) || charge <= 0) return 0;
  const held = Math.min(charge, CEILING);
  const sat = (x: number): number => x / (x + HALF_SATURATION);
  const ceiling = sat(CEILING);
  if (ceiling <= 0) return 0;
  return scrub(clamp01(sat(held) / ceiling));
}

/**
 * BENCH ONLY: the first tick after the command on which a tap may count, given
 * `commandTick` and how many taps were thrown before the call.
 *
 * THE WHOLE FALSE-START RULE, AND IT IS ONE LINE BECAUSE THE SENTENCE THE
 * PLAYER IS GIVEN IS ONE LINE. `LIFT_COPY.SUBTITLE.bench` says "Taps before
 * the call count for nothing, and each one holds your press back, up to a
 * fifth of a second", and this is that: `PER_EARLY_TAP_TICKS` per early tap,
 * capped at `MAX_LOCKOUT_TICKS`, which is 12 ticks and therefore exactly a
 * fifth of a second at 60Hz — dropped from 30 on the 2026-08-27 ruling; see
 * `LIFT_TUNING.GRIND_FALSE_START`'s header for why the cap itself had to
 * shrink rather than merely be reworded. `lift.test.ts` drives the sim
 * against each clause of the sentence separately rather than against this
 * function, so the copy and the mechanic cannot drift apart quietly.
 *
 * ---------------------------------------------------------------------------
 * WHY THE RULE HAD TO BE REWRITTEN RATHER THAN REWORDED
 * ---------------------------------------------------------------------------
 * Its predecessor `burstCountedTaps(taps, earlyTaps)` subtracted early taps
 * from the burst's tap COUNT with a floor of three under it. Both halves of
 * that were arithmetic over a per-rep integer read once when a window closed.
 * The continuous grind has no such integer — it has a charge that rises and
 * decays and is read every tick — so there was nothing left to subtract from,
 * and a rule reworded to fit a mechanic it was not derived from is precisely
 * the stale-claim shape this repository keeps paying for.
 *
 * IT COSTS THE LAUNCH AND NEVER THE REP, which is what the old floor bought
 * and what the CAP buys now. The floor guaranteed a minimum force at the
 * launch; the cap guarantees a maximum delay, after which the grind is
 * available for the whole rest of the rep — and on a continuous grind the rest
 * of the rep is where the lift is decided. So a player who mashes the entire
 * pause leaves the chest slowly and can still grind the bar up. Mashing is
 * strictly worse than waiting and it is never fatal, which is the shape the
 * drive branch already states in capitals — "A MISSED TAP COSTS VELOCITY. IT
 * NEVER ENDS THE REP ON ITS OWN."
 *
 * IT CANNOT PAY. The delay is `max(0, …)` of a non-negative product, so zero
 * early taps is the best case and no number of them can move the start of the
 * grind EARLIER than the command. That is the direction the old floor's
 * `Math.min` was guarding and it is guarded here by the arithmetic having no
 * negative branch at all.
 * `@guarantee a-false-start-can-never-pay`
 */
export function grindStartTick(commandTick: number, earlyTaps: number): number {
  const { PER_EARLY_TAP_TICKS, MAX_LOCKOUT_TICKS } = LIFT_TUNING.GRIND_FALSE_START;
  const command = Number.isFinite(commandTick) ? commandTick : 0;
  const early = Number.isFinite(earlyTaps) ? Math.max(0, Math.floor(earlyTaps)) : 0;
  return command + Math.min(MAX_LOCKOUT_TICKS, early * PER_EARLY_TAP_TICKS);
}

/**
 * BENCH ONLY: the rolling tap charge one tick on, given whether a tap counted.
 *
 * `charge * GRIND_CHARGE_DECAY_PER_TICK + (tapped ? 1 : 0)`. The decay is what
 * makes it a RATE rather than a total — see `GRIND_CHARGE_DECAY_PER_TICK`.
 */
export function grindChargeNext(charge: number, tapped: boolean): number {
  const held = Number.isFinite(charge) && charge > 0 ? charge : 0;
  return scrub(held * LIFT_TUNING.GRIND_CHARGE_DECAY_PER_TICK + (tapped ? 1 : 0));
}

/**
 * BENCH ONLY: the `TimingGrade` a 0..1 quality reads as. Both of bench's
 * readings go through it — the launch's force and the touch's control.
 *
 * NOT `burstGrade`, WHICH IS WHAT IT WAS CALLED WHILE THE CHEST TOUCH WAS
 * ALREADY BEING GRADED AGAINST THE SAME TABLE INLINE. A name saying "burst"
 * over a call site deciding what an ARRIVAL reads as is the stale-claim hazard
 * living in the symbol table, where no scan for capitalised absolutes will
 * ever find it and where nobody re-verifies it the way they second-guess a
 * docstring. One function, one table, one word per band across the whole rep.
 *
 * 'early' AND 'late' ARE UNREACHABLE HERE BY CONSTRUCTION, and that is the
 * design rather than an oversight. Neither a grind nor an arrival has a
 * direction to be wrong in — both are amounts, not moments — and a grade
 * reading 'late' for a weak grind would be a name asserting something the code
 * never measured. 'missed' is the player not acting at all, or the bar being
 * dropped. `lift.test.ts` pins the two unreachable members unreachable.
 */
export function qualityGrade(quality: number): TimingGrade {
  if (!Number.isFinite(quality) || quality <= 0) return 'missed';
  const { PERFECT, GOOD } = LIFT_TUNING.QUALITY_GRADE_BANDS;
  if (quality >= PERFECT) return 'perfect';
  if (quality >= GOOD) return 'good';
  return 'missed';
}

/**
 * BENCH ONLY: how softly a touch arriving at `rate` landed, 0..1.
 *
 * Linear between `BENCH_TOUCH_SOFT_RATE` (1 — the bar was caught) and
 * `BENCH_TOUCH_CRASH_RATE` (0 — it was dropped). Nothing about the player's
 * timing enters it, which is the point of the 2026-08-25 ruling: squat grades
 * WHEN you release and bench grades HOW THE BAR ARRIVES.
 *
 * THE WHOLE GRADE SINCE THE 2026-08-25 REPLAY STEER, not half of it.
 * `descentPatience` was the other half and is deleted with the dawdling it
 * charged for: an automatic descent cannot be slowed below the controlled
 * rate, so its domain was empty. `touchQualityFor`, the product of the two,
 * went with it rather than being left as a one-argument alias of this.
 *
 * A HELD DESCENT ARRIVES AT QUALITY 1 AT EVERY LOAD, BY ARITHMETIC. The bar's
 * rate never leaves `DESCENT_DEPTH_PER_TICK.bench` unless the player lets go,
 * and that rate is at or below `BENCH_TOUCH_SOFT_RATE` at both ends of the
 * load curve — `liftTuning.test.ts` asserts the inequality. That is what
 * "automated almost in a sense" means here, and the only way to score less is
 * to take the finger off.
 *
 * STILL LOAD-SCALED. Both thresholds come off a load curve, so the same slip
 * puts a limit bar further outside control than a warm-up. What it is no
 * longer carrying is an open-loop property — see `OPEN_LOOP_SEARCH`'s
 * retirement note in `lift.test.ts`.
 */
export function touchSpeedQuality(rate: number, loadRatio: number): number {
  const load = clampLoadRatio(loadRatio);
  const soft = byLoad(LIFT_TUNING.BENCH_TOUCH_SOFT_RATE, load);
  const crash = byLoad(LIFT_TUNING.BENCH_TOUCH_CRASH_RATE, load);
  if (!Number.isFinite(rate)) return 0;
  if (crash <= soft) return rate <= soft ? 1 : 0;
  return scrub(clamp01((crash - rate) / (crash - soft)));
}

/**
 * BENCH ONLY: the descent rate one tick on, given whether the finger is down.
 *
 * ---------------------------------------------------------------------------
 * THE SIGN OF THE FINGER IS INVERTED FROM THE BEAT THIS REPLACES, 2026-08-25
 * REPLAY STEER, AND THAT INVERSION IS THE WHOLE OF STEER 2
 * ---------------------------------------------------------------------------
 * It used to be: held FEEDS the bar down, released RESISTS it, floored at 0 —
 * so the player steered a rate, and stopping the bar entirely was a thing they
 * could do. The steer's words are "the descent should be less of a question on
 * how far to go down, that should be automated almost in a sense".
 *
 * So now: held RECOVERS toward the controlled rate
 * (`BENCH_DESCENT_RECOVER_PER_TICK`, floored at
 * `DESCENT_DEPTH_PER_TICK.bench`), released RUNS AWAY
 * (`BENCH_DESCENT_RUNAWAY_PER_TICK`, capped at `BENCH_DESCENT_MAX_RATE`).
 *
 * THE FLOOR IS THE AUTOMATION AND IT IS A GUARANTEE, NOT A DEFAULT. The rate
 * can never be less than the controlled rate, so depth strictly increases by
 * at least that much every tick and the chest is reached within
 * `ceil(DEPTH_IDEAL.bench / controlled rate)` ticks whatever the player does.
 * That is what deleted `CHEST_TOUCH_TIMEOUT_TICKS` and the 'no-touch' miss:
 * not a horizon somebody swept, an arithmetic bound. `lift.test.ts` pins it at
 * every load and `liftTuning.test.ts` derives the bound from the constants.
 *
 * Both curves are load curves, and MAXIMAL is the bigger runaway and the
 * smaller recovery, which is where what is left of the beat's difficulty under
 * load comes from.
 * `@guarantee a-bench-descent-always-reaches-the-chest`
 */
export function benchDescentRate(rate: number, held: boolean, loadRatio: number): number {
  const load = clampLoadRatio(loadRatio);
  const controlled = byLoad(LIFT_TUNING.DESCENT_DEPTH_PER_TICK.bench, load);
  if (held) {
    return scrub(
      Math.max(controlled, rate - byLoad(LIFT_TUNING.BENCH_DESCENT_RECOVER_PER_TICK, load)),
    );
  }
  return scrub(
    Math.min(
      LIFT_TUNING.BENCH_DESCENT_MAX_RATE,
      Math.max(controlled, rate) + byLoad(LIFT_TUNING.BENCH_DESCENT_RUNAWAY_PER_TICK, load),
    ),
  );
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
 * ONE BENCH SHORTFALL, NOT TWO, SINCE THE 2026-08-25 REPLAY STEER.
 * `touchShortfall` is `1 - touchQuality` — how badly the bar arrived — and it
 * is a whole-ascent multiplier because the descent has no per-tick channel
 * into the ascent, so without one a crash would decide nothing.
 *
 * `launchShortfall` WAS THE SECOND AND IS DELETED WITH
 * `PRESS_WEAK_DEMAND_PENALTY`. It scaled the whole ascent by how weak the
 * BURST was, which was necessary when the press was one reading taken at one
 * moment. The grind is read every tick through `GRIND_BOOST_FORCE_MAX`, so a
 * player who stops tapping is already losing force now; a second multiplier
 * keyed to the first 300ms would have let the launch quietly decide a rep the
 * grind is supposed to decide. Its default made it invisible at every squat
 * and deadlift call site, which is exactly how a stale channel survives.
 */
export function ascentDemand(
  h: number,
  loadRatio: number,
  kind: PlayableLiftKind,
  extraDepth: number = 0,
  touchShortfall: number = 0,
  workingExcess: number = 0,
): number {
  const load = clampLoadRatio(loadRatio);
  const base = byLoad(LIFT_TUNING.DEMAND_BASE[kind], load);
  const stick =
    byLoad(LIFT_TUNING.DEMAND_STICK_GAIN[kind], load) *
    gauss(h, STICK_HEIGHT_FRAC[kind], STICK_WIDTH[kind]);
  // BENCH: what the bar costs for being a WORKING bar rather than a warm-up.
  // Zero at and below `BENCH_WARMUP_FLOOR_MARGIN` and on every other kind, so
  // a default of 0 here is the base curve and not a silent half-measure. Added
  // FLAT IN HEIGHT, alongside `base`, rather than into the sticking bump: the
  // 2026-08-26 retune's own header records why difficulty went into
  // `DEMAND_BASE` rather than `DEMAND_STICK_GAIN`, and putting this one in the
  // notch instead would change the curve's shape in TWO dimensions at once —
  // load and height — when only the load one is what the ruling asked for.
  const working = benchWorkingRungDemand(kind, workingExcess);
  const buried = 1 + LIFT_TUNING.BURIED_DEMAND_PER_DEPTH * Math.max(0, extraDepth);
  // BENCH: what a bar dropped onto the chest costs. See
  // `BENCH_TOUCH_DEMAND_PENALTY` — this scales the whole curve for the whole
  // ascent, exactly as `buried` does, because a transient does not survive
  // long enough to decide anything.
  const crashed = 1 + LIFT_TUNING.BENCH_TOUCH_DEMAND_PENALTY * clamp01(touchShortfall);
  return scrub((base + stick + working) * buried * crashed);
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
    pressLaunchTick: null,
    grindTaps: 0,
    grindEarlyTaps: 0,
    grindLastTapTick: null,
    grindFirstTapTick: null,
    grindCharge: 0,
    grindForce: 0,
    launchForce: 0,
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
  pressLaunchTick: number | null;
  grindTaps: number;
  grindEarlyTaps: number;
  grindLastTapTick: number | null;
  grindFirstTapTick: number | null;
  grindCharge: number;
  grindForce: number;
  launchForce: number;
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
    pressLaunchTick: state.pressLaunchTick,
    grindTaps: state.grindTaps,
    grindEarlyTaps: state.grindEarlyTaps,
    grindLastTapTick: state.grindLastTapTick,
    grindFirstTapTick: state.grindFirstTapTick,
    grindCharge: state.grindCharge,
    grindForce: state.grindForce,
    launchForce: state.launchForce,
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
  // THE GRIND, DECLARED ONCE AND CALLED FROM TWO BEATS — BENCH ONLY.
  //
  // The 2026-08-25 replay steer's whole shape is that the same tap rule runs
  // on the chest and on the way up: "the press command should allow you to
  // continuously tap to grind through". So it is ONE closure called from the
  // bench arm of HOLE and from the bench arm of ASCENT, rather than the same
  // eight lines written twice. CLAUDE.md has paid four times for a guard
  // written for one hook and copied to its sibling — twice at a distance of
  // one branch — and two beats of one mechanic is exactly that shape.
  //
  // `grindOpen` is the false-start lockout: after the command, and after
  // whatever delay the player's early taps bought (`grindStartTick`). Early
  // taps are frozen once the command fires, so recomputing it every tick from
  // `pressCommandTick` and `grindEarlyTaps` is the same answer as caching it
  // and is one fewer field that can go stale.
  // -------------------------------------------------------------------------
  const grindOpen = (): boolean => {
    const command = m.pressCommandTick;
    if (command === null || tick < command) return false;
    return tick >= grindStartTick(command, m.grindEarlyTaps);
  };

  const advanceGrind = (): void => {
    const counts =
      pressed &&
      grindOpen() &&
      (m.grindLastTapTick === null ||
        tick - m.grindLastTapTick >= LIFT_TUNING.GRIND_TAP_REFRACTORY_TICKS);
    if (counts) {
      m.grindTaps += 1;
      m.grindLastTapTick = tick;
      if (m.grindFirstTapTick === null) m.grindFirstTapTick = tick;
    }
    // THE DECAY RUNS WHETHER OR NOT A TAP LANDED, which is the difference
    // between a rate and a total and is why idle hands lose force.
    m.grindCharge = grindChargeNext(m.grindCharge, counts);
    m.grindForce = grindForce(m.grindCharge);
    if (counts) m.events.push({ kind: 'grind-tap', tick, quality: m.grindForce });
  };

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
      // BENCH: THE NEAR-AUTOMATIC LOWERING (GDD §6.2; ruled 2026-08-25,
      // steered the same day by the phone replay).
      //
      // The bar comes down on its own at the controlled rate. The finger's
      // only job is to stay down: letting go lets the bar run away, and the
      // graded quantity is the RATE it is carrying when it reaches the chest.
      // See `benchDescentRate` for why the sign of the finger is the opposite
      // of what this branch used to do, and for the floor that guarantees the
      // bar always arrives.
      //
      // NOTHING HERE READS A CUE, A WINDOW OR A RELEASE TICK. That is the
      // difference between this beat and squat's, and it is why the two are
      // separate branches rather than one branch with a per-kind table: a
      // shared branch with a `kind === 'bench'` inside it would have made
      // "bench is not a squat" a runtime condition instead of a structure.
      //
      // AND THERE IS NO TIMEOUT ARM ANY MORE. There used to be one here, for
      // a bar the player stopped and abandoned. `benchDescentRate` floors the
      // rate at `DESCENT_DEPTH_PER_TICK.bench`, so `m.depth` strictly
      // increases every tick by at least that much and the branch below fires
      // within a bounded number of ticks whatever the player does. A timeout
      // beside that would be an arm nothing can reach.
      // ---------------------------------------------------------------------
      const rate = benchDescentRate(m.chestRate ?? descentRate(load, kind), m.held, load);
      m.chestRate = rate;
      m.depth = scrub(m.depth + rate);
      m.height = scrub(clamp01(1 - m.depth));

      if (m.depth >= LIFT_TUNING.DEPTH_IDEAL[kind]) {
        // THE TOUCH. Legality on a bench is the touch itself, and since the
        // replay steer every bench rep gets it — what a bad descent costs is
        // the ascent, never the rep.
        m.depthAchieved = true;
        m.touchQuality = touchSpeedQuality(rate, load);
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
        m.events.push({
          kind: 'chest-touch',
          tick,
          grade: qualityGrade(m.touchQuality),
          quality: m.touchQuality,
        });
        enter('HOLE');
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
  //   BENCH   The pause on the chest, and where the lift STARTS being decided
  //           (GDD §6.2, "press-timing / bar-speed check off the chest"). The
  //           bar sits motionless, a command fires at a tick drawn from the
  //           rep's seed, and the player starts tapping. What the taps have
  //           built when the launch beat ends buys bar speed off the chest —
  //           see `PRESS_VELOCITY` — and the same charge carries straight into
  //           ASCENT, where the rest of the rep is decided.
  //
  // The phase names are shared and the beat is not. That is the difference
  // between building a second lift and retuning the first one.
  // -------------------------------------------------------------------------
  // Same narrowing trick, same reason. See the DESCENT branch above.
  else if (m.phase === 'HOLE' && kind !== 'deadlift') {
    const benched = kind === 'bench';

    if (benched) {
      // ---------------------------------------------------------------------
      // BENCH: THE PAUSE, THE COMMAND, AND THE START OF THE GRIND (ruled
      // 2026-08-25, steered the same day by the phone replay).
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
        // THE LAUNCH BEAT'S LENGTH IS DECIDED HERE, ONCE. It is how long the
        // bar stays on the chest, NOT how long taps count for — taps count
        // from `grindStartTick` until the rep resolves, which is the steer.
        // What a false start costs is the START of that (see
        // `grindStartTick`), never this: shortening the beat as well would
        // punish one mistake twice, and a bar that left the chest EARLIER for
        // a mistake would be a reward pointing the wrong way.
        m.pressLaunchTick =
          tick + Math.max(1, Math.round(msToTicks(cueWindowMs('press', state.config))));
      }

      if (pressed && !commanded) {
        // A FALSE START BUYS NOTHING AND HOLDS THE GRIND BACK. It does NOT end
        // the rep, consistently with the rule the drive branch already states
        // in capitals — "A MISSED TAP COSTS VELOCITY. IT NEVER ENDS THE REP ON
        // ITS OWN." A competition bench would red light a press before the
        // call outright, and that is left on the table rather than taken: a
        // hard fail on a stimulus the player cannot see coming reads as the
        // game cheating, and it is exactly the judgement GDD §12.1 puts with a
        // human on a phone.
        m.grindEarlyTaps += 1;
        m.events.push({ kind: 'press-false-start', tick, grade: 'missed', quality: 0 });
      }

      // The grind runs on the chest and keeps running after the launch. Same
      // closure, both beats — see its declaration at the top of `stepLift`.
      if (commanded) advanceGrind();

      // THE BAR LEAVES THE CHEST WHEN THE LAUNCH BEAT ENDS. One arm, not two:
      // the burst this replaces also left early on a tap cap, and there is no
      // cap on taps any more because there is no per-rep tap budget to fill.
      const launchTick = m.pressLaunchTick;
      if (commanded && launchTick !== null && tick >= launchTick) {
        // A SNAPSHOT OF A LIVE QUANTITY, AND ONLY THE VELOCITY READS IT. The
        // ascent reads `grindForce` fresh on every tick, so what the player
        // had banked here decides how the bar STARTS and nothing after that.
        m.launchForce = m.grindForce;
        const grade = qualityGrade(m.launchForce);
        // The reaction, RECORDED BUT NOT SEPARATELY GRADED — see the section
        // header in `liftTuning.ts`. `offsetMs` is ms from the command to the
        // first counted tap, or the whole launch beat if none ever came, so a
        // replay can show how long the player took without the mechanic
        // scoring it twice.
        const firstTap = m.grindFirstTapTick;
        const offsetMs =
          firstTap === null ? (tick - commandTick) * TICK_MS : (firstTap - commandTick) * TICK_MS;
        m.timings.push({
          cue: 'press',
          tick,
          offsetMs: scrub(offsetMs),
          quality: m.launchForce,
          grade,
        });
        m.events.push({ kind: 'press-launch', tick, grade, quality: m.launchForce });
        // THE BAR-SPEED HALF OF §6.2's LINE. On bench the chest touch decides
        // how hard the ascent is and the launch decides how fast it starts.
        const { MIN, MAX } = LIFT_TUNING.PRESS_VELOCITY;
        m.velocity = scrub(MIN + (MAX - MIN) * clamp01(m.launchForce));
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

    // -----------------------------------------------------------------------
    // BENCH: THE GRIND CONTINUES, AND IT IS THE ONLY TAP LAYER (2026-08-25
    // replay steer). Every tap that clears the refractory gap feeds the same
    // rolling charge that was running on the chest; the charge decays every
    // tick whether or not one landed. `GRIND_BOOST_FORCE_MAX * grindForce` is
    // added to the lifter's capacity in the physics below, LIVE.
    //
    // This runs BEFORE the drive block so that on bench there is exactly one
    // thing a press can mean. `cueDriven` then shuts the drive machinery off
    // for bench entirely rather than relying on `driveAttemptsFor` happening
    // to return something small: the steer deletes a layer, and a deleted
    // layer that is still reachable by arithmetic is not deleted.
    // -----------------------------------------------------------------------
    const cueDriven = kind !== 'bench';
    if (!cueDriven) advanceGrind();

    // Arm a drive cue: the first purely on bar height, every one after it
    // only once BOTH the previous one has resolved (drivesUsed > 0) AND its
    // spacing has elapsed. `driveAttemptsFor`/`driveSpacingTicks` are the
    // tap-RATE half of the ascent's difficulty — how many cues, how close
    // together — `cueWindowMs`'s per-cue width is the PRECISION half.
    const attempts = cueDriven ? driveAttemptsFor(load, kind) : 0;
    const canArmNext =
      m.drivesUsed === 0 ||
      (m.driveArmReadyTick !== null && tick >= m.driveArmReadyTick);
    if (
      cueDriven &&
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

    if (cueDriven && pressed && m.drivesUsed < attempts) {
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
    // BENCH'S ONE SHORTFALL, CARRIED FOR THE WHOLE ASCENT. Squat and deadlift
    // pass 0 — their `touchQuality` is 0 because they have no chest touch, and
    // reading it without this guard would charge every squat and every
    // deadlift the maximum crash penalty on every rep.
    //
    // THERE WERE TWO UNTIL THE 2026-08-25 REPLAY STEER. `launchShortfall` is
    // deleted with `PRESS_WEAK_DEMAND_PENALTY` — see `ascentDemand`.
    const touchShortfall = kind === 'bench' ? 1 - clamp01(m.touchQuality) : 0;
    // THE WORKING-RUNG TERM'S ONE CALL SITE. Read from the config rather than
    // carried in `Mutable`, because it is fixed before the rep starts by the
    // same two quantities `benchClearsTheClock` reads and nothing the player
    // does can move it — a field would be a copy that could go stale.
    const demand = ascentDemand(
      m.height,
      load,
      kind,
      m.extraDepth,
      touchShortfall,
      benchWorkingExcess(state.config),
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
    // BENCH: THE GRIND'S BOOST, AND IT IS THE OPPOSITE SHAPE TO THE ONE ABOVE.
    // The drive's boost is a committed impulse that decays from the tick it
    // was thrown — a discrete effort that pays once. This is a state the
    // player MAINTAINS: `grindForce` is what their tap rate is worth right
    // now, recomputed every tick from a charge that decays on its own, so
    // stopping costs force immediately and starting again buys it back.
    //
    // THAT ASYMMETRY IS THE 2026-08-25 REPLAY STEER IN ONE EXPRESSION. The
    // burst this replaces used the impulse shape — `PRESS_BURST_BOOST_TICKS`
    // decaying from the launch — and an impulse cannot be sustained through a
    // sticking point by definition, which is why the beat needed a second
    // discrete tap layer behind it and why the steer asked for one grind
    // instead of two.
    if (kind === 'bench' && m.grindForce > 0) {
      drive += LIFT_TUNING.GRIND_BOOST_FORCE_MAX * m.grindForce;
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
    } else if (m.ascentTicks >= ascentTimeoutTicksFor(state.config)) {
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
    pressLaunchTick: m.pressLaunchTick,
    grindTaps: m.grindTaps,
    grindEarlyTaps: m.grindEarlyTaps,
    grindLastTapTick: m.grindLastTapTick,
    grindFirstTapTick: m.grindFirstTapTick,
    grindCharge: m.grindCharge,
    grindForce: m.grindForce,
    launchForce: m.launchForce,
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
      if (kind === 'bench' && state.grindEarlyTaps > 0) return p.HOLE_FALSE_START;
      return p.HOLE[kind];
    }
    case 'ASCENT': {
      // BENCH HAS ONE ASCENT LINE AND IT NEVER CHANGES, because bench's
      // ascent has no cue to announce. A line that flipped would be telling
      // the player something had happened when nothing had — and the specific
      // wrong reading, "DRIVE — TAP", says a window is open and will close,
      // which is what makes a player stop tapping. See `ASCENT_GRINDING`.
      if (kind === 'bench') return p.ASCENT_GRINDING;
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
    case 'grind-tap':
      return h.GRIND_TAP;
    case 'press-launch':
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
 * True while the bar is still ON THE CHEST with the command fired — HOLE,
 * after the command tick. The GO ring and the `PRESS — TAP FAST` headline both
 * key off this so they cannot disagree about whether the launch beat is open.
 *
 * DELIBERATELY NOT THE WHOLE GRIND, WHICH IS `grindIsLive` BESIDE IT. Under
 * the burst the two questions were the same question, because the burst
 * ENDED when the bar left the chest. Since the 2026-08-25 replay steer taps
 * keep counting for the whole ascent, so "is the launch beat open" and "do
 * taps do anything" are different facts about different beats, and one
 * predicate answering both would have to be wrong about one of them.
 *
 * The name is kept because it is still exactly true — the press command's own
 * beat is live — and because renaming it would reach three `.tsx` files this
 * piece is scoped out of. `grindIsLive` is the new fact and it is new rather
 * than a redefinition of this one.
 */
export function pressCommandIsLive(state: LiftState): boolean {
  if (state.config.kind !== 'bench') return false;
  if (state.phase !== 'HOLE') return false;
  const commandTick = state.pressCommandTick;
  if (commandTick === null) return false;
  return state.tick >= commandTick;
}

/**
 * BENCH: true while taps are doing something — from the press command until
 * the bar locks out or the rep is lost. The continuous grind, as a predicate.
 *
 * THE 2026-08-25 REPLAY STEER IN ONE FUNCTION. "The press command should allow
 * you to continuously tap to grind through": that is HOLE-after-the-command
 * plus the whole of ASCENT — the bar's entire journey — rather than one 850ms
 * window on the chest.
 *
 * LOCKOUT IS EXCLUDED, AND THE FIRST VERSION OF THIS FUNCTION INCLUDED IT.
 * That version argued the readout should not blink off while a player was
 * still tapping. It was wrong on a fact rather than on taste: `advanceGrind`
 * is called from the HOLE and ASCENT branches only, so in LOCKOUT no tap is
 * counted AND the charge does not decay — the row would have frozen at
 * whatever it read when the bar locked out and sat there, which is a readout
 * that has stopped reading. Caught by the test written to pin the claim (a
 * tap in LOCKOUT changed nothing, so the "it draws but does not decide"
 * assertion had no subject); recorded here rather than quietly corrected,
 * because the reasoning sounded right and the mechanism said otherwise.
 *
 * FALSE ON SQUAT AND DEADLIFT, both of which keep the discrete drive cue. The
 * sibling predicate for deadlift's opposite demand is `lockoutHoldIsLive`.
 */
export function grindIsLive(state: LiftState): boolean {
  if (state.config.kind !== 'bench') return false;
  if (state.pressCommandTick === null) return false;
  if (state.phase === 'HOLE') return state.tick >= state.pressCommandTick;
  return state.phase === 'ASCENT';
}

/**
 * BENCH: how the bar is coming in, 0..1 — 0 fully controlled, 1 crashing.
 *
 * Null on squat, on deadlift, and on any bench state outside DESCENT.
 *
 * THE READ MODEL THE STAGE NEEDS AND CANNOT DERIVE. `depth` says where the bar
 * is; it does not say whether it is being caught or dropped, and those are the
 * two reps this beat exists to tell apart. Deliberately the INVERSE of
 * `touchSpeedQuality` — hot is 1 — because what a renderer wants to scale is
 * the alarm, not the calm.
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
  // THE WHOLE GRADE, WHICH IT WAS NOT BEFORE THE 2026-08-25 REPLAY STEER. It
  // used to be the speed half only, with `descentPatience` beside it holding
  // the time half — deliberately not drawn, because a bar creeping down slowly
  // is not coming in hot and colouring it as a crash would be a cue that lies.
  // That half is deleted with the dawdling it charged for, so this now shows
  // exactly what the mechanic grades and there is nothing left to omit.
  //
  // IT READS THE REP'S OWN LOAD, so the same speed draws hotter under a heavier
  // bar — which is the whole of the fix that moved the answer with load. A
  // renderer that scaled this against a fixed pair would draw a limit bar as
  // controlled while the mechanic was calling it a crash.
  return scrub(1 - touchSpeedQuality(rate, state.config.loadRatio));
}

/** What the grind is doing right now, for the stage to draw. */
export interface GrindProgress {
  /** Counted taps this rep so far. A running total; it only rises. */
  readonly taps: number;
  /** What the player's CURRENT tap rate is worth, 0..1. Falls when they slow. */
  readonly force: number;
  /**
   * How many of `units` to light, by `force`. Recent-rate semantics: the row
   * fills as the player speeds up and empties as they slow down.
   */
  readonly lit: number;
  /** How many units the readout holds. `GRIND_READOUT_UNITS`. */
  readonly units: number;
}

/**
 * BENCH: the live grind, or null when taps are doing nothing.
 *
 * PIECE 2 DRAWS THIS; PIECE 1 ONLY HAS TO MAKE IT TRUE. It is here rather than
 * in a component because "how hard am I grinding" is a fact about the
 * mechanic, and CLAUDE.md forbids deriving mechanic state inside a `.tsx` file.
 *
 * ---------------------------------------------------------------------------
 * WHAT REPLACED `BurstProgress`, AND WHY IT COULD NOT SURVIVE THE STEER
 * ---------------------------------------------------------------------------
 * `BurstProgress` carried `tapsLeft` and `ticksLeft`. Both described a burst
 * with a tap cap and a closing window, and the 2026-08-25 replay steer deleted
 * both of those things — there is no cap to have taps left against and no
 * window to have ticks left in. Carrying them would have been two fields
 * reporting a mechanic that no longer exists, which is the defect class this
 * repository has recorded eight times in prose and which is worse in a read
 * model because a renderer will draw it.
 *
 * `lit` IS WHAT MAKES THE ROW MOVE BOTH WAYS. A running tap total on a
 * continuous grind rises forever, so a readout keyed to it would fill up and
 * stay full while the player quietly stopped tapping — on screen and reading
 * nothing, which is exactly the third fact of CLAUDE.md's progression rule.
 * `lit` is `force` scaled onto the row, so it falls back when the rate does.
 *
 * IT STILL CARRIES NO FATIGUE-TOUCHED DENOMINATOR, which is the §12.3 argument
 * `BurstProgress` made and this one keeps. `force` comes off `grindForce`,
 * whose curve is load- and fatigue-independent; the only fatigue-adjusted
 * quantity in this beat is the LAUNCH BEAT's length, and that is not here.
 */
export function grindProgress(state: LiftState): GrindProgress | null {
  if (!grindIsLive(state)) return null;
  const units = LIFT_TUNING.FEEDBACK.STAGE_COMMAND.GRIND_READOUT_UNITS;
  const force = clamp01(state.grindForce);
  return {
    taps: state.grindTaps,
    force: scrub(force),
    lit: Math.min(units, Math.round(force * units)),
    units,
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
    const launchTick = state.pressLaunchTick;
    if (commandTick === null || launchTick === null) return null;
    const span = launchTick - commandTick;
    if (span <= 0) return null;
    return scrub(1 + (state.tick - commandTick) / span);
  }
  const cue = state.activeCue;
  if (cue === null) return null;
  const span = cue.idealTick - cue.openTick;
  if (span <= 0) return null;
  return scrub((state.tick - cue.openTick) / span);
}
