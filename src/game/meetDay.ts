/**
 * meetDay.ts — meet day as a played loop (GDD §6.1, §6.2, §6.3, §6.5).
 *
 * ```
 * Weigh-in (§6.1)
 *   -> Openers, pre-filled from e1RM, overridable (§6.1)
 *   -> per attempt: bar loads + walk-out (§6.2.1)
 *                -> the rep, on the existing mechanic (§6.2.2, §6.2.3)
 *                -> judges deliberate (§6.2.4)
 *                -> three lights + feedback cue (§6.2.4, §6.2.5)
 *                -> the next attempt is chosen (§6.3)
 *   -> recap, or the bomb-out beat (§6.5, §6.3)
 * ```
 *
 * ---------------------------------------------------------------------------
 * THE RULES OF THE MEET ARE NOT IN THIS FILE
 * ---------------------------------------------------------------------------
 * `meet.ts` is the engine and is authoritative for every rule of the sport:
 * lift order, three attempts each, the non-decreasing invariant, what a good
 * lift is, what the total is, and when a lifter has bombed. THIS MODULE ASKS IT
 * AND RENDERS THE ANSWER. It holds no copy of any of those rules, and in
 * particular:
 *
 *   - The lightest weight a lifter may call next is
 *     `currentAttemptContext(meet).minimumWeight`, read out of the engine. It
 *     is not recomputed here, not clamped here, and not compared against the
 *     previous attempt here. That is what makes GDD §6.3's bite — "a miss does
 *     not lower the floor — it RAISES it" — a property of the engine that this
 *     screen displays, rather than a second implementation that could disagree
 *     with the one that actually refuses a declaration.
 *   - Every weight this module offers a player goes through `declareAttempt`
 *     before it becomes an attempt, and a refusal is surfaced rather than
 *     swallowed.
 *   - Bombing out is `meet.ts`'s `MeetOutcome.kind === 'bombed-out'`. Nothing
 *     here counts misses.
 *
 * ---------------------------------------------------------------------------
 * PURITY CONTRACT (CLAUDE.md "Pure logic is separate from UI", GDD §9.2)
 * ---------------------------------------------------------------------------
 *   - Zero React imports, zero I/O, zero side effects.
 *   - NO CLOCK. The beat durations in `MEET_TUNING` are read by the UI's clock,
 *     not by this module; `walkoutMs`/`deliberationMs`/`verdictMs` return
 *     numbers and start nothing.
 *   - NO RANDOMNESS. The judging model's dissent draw and the mechanic's wobble
 *     jitter both run off seeds derived from (meet seed, lift, attempt number),
 *     so a meet replays byte for byte and a screenshot of a split panel is
 *     reproducible.
 *   - Every transition returns a new state; inputs are never mutated.
 *
 * ---------------------------------------------------------------------------
 * TOTAL MOVES HERE AND NOWHERE ELSE — AND NOT UNTIL THE SERVER SAYS SO
 * ---------------------------------------------------------------------------
 * GDD §2 and §3.2: Total is the sum of best successful COMPETITION attempts, it
 * moves on meet day and on no other day, and "that is also the point rather than
 * an inconvenience: Total only updating on meet day is what makes meet day carry
 * weight."
 *
 * This module produces the ATTEMPTS. It does not produce a Total: the number on
 * the recap comes from `meet.ts`'s `finalMeetTotal`, which is null until the
 * meet is actually over and null forever if a lift was bombed, and the number
 * that gets STORED comes back from `meetServer.ts` after it has replayed the
 * attempts itself. Nothing in this file writes a fact.
 *
 * The mirror-image rule also holds: NO e1RM MOVES HERE. GDD §2's table gives
 * e1RM to Sim mode, "session by session", and §6.4 gives a meet a Total, a DOTS
 * score, Career progression and Gym Empire reputation — not an e1RM. So a meet
 * reads e1RM (to suggest an opener, and as the mechanic's load ratio) and never
 * writes one. See `meetServer.ts` for the enforcement and for the note on what
 * the progression reach map would have permitted.
 *
 * ---------------------------------------------------------------------------
 * THE JUDGING MODEL — WHAT IT CLAIMS AND WHAT IT REFUSES TO DO
 * ---------------------------------------------------------------------------
 * GDD §6.2 step 4: "Three-light judging call (red/white), with a brief 'judges
 * deliberating' beat on close calls."
 *
 * Three referees, majority carries — that part is `meet.ts`'s and is the rule of
 * the sport. What this module decides is HOW MANY of the three dissent, and it
 * decides it from the rep the player actually played:
 *
 *   THE MAJORITY ALWAYS AGREES WITH THE MECHANIC. A rep `lift.ts` resolved as a
 *   make gets at least two white lights; a miss gets at least two red. The
 *   panel dramatises the player's input; it never overturns it.
 *
 *   That is a deliberate refusal, not an oversight. Turning a made lift red on
 *   a die roll is the "punishes you for showing up" failure of GDD §12.3
 *   arriving through the judges instead of through the streak, and it would
 *   make the one input the whole game is built on stop deciding the outcome
 *   (GDD design pillar 1). Real meets do overturn lifts; a game where the
 *   player cannot see the referee's eyeline should not.
 *
 *   WHAT VARIES IS THE MARGIN — how obvious the call was — and it is measured,
 *   not rolled:
 *     · A MADE lift is doubted in proportion to how marginal the depth input
 *       was (`InputTiming.quality` on the depth cue: 1 at the ideal moment,
 *       falling to 0 at the window edge) and to how much of the ascent was
 *       spent stalled (`stallTicks / ascentTicks`). A squat hit right at
 *       parallel and ground out gets a red from one referee. One that was deep
 *       and fast does not.
 *     · A MISSED lift is doubted only when the lifter genuinely called depth
 *       and missed the window narrowly. The mechanic records a signed
 *       `offsetMs` for the depth cue even when the input landed outside it, so
 *       "40 ms high" and "never went near it" are different numbers and only
 *       the first is arguable.
 *     · A bar that stalled, buried the lifter, or never got the command is
 *       unanimous. Nobody in the building disagrees about a bar that came back
 *       down.
 *
 *   THE DELIBERATION BEAT IS NOT A TELL. `DELIBERATION_MARGIN` sits strictly
 *   above `UNANIMOUS_MARGIN`, so the band that deliberates is wider than the
 *   band that can split and a deliberation ending 3-0 is common. A beat that
 *   fired only before a split would announce the verdict before the lights did,
 *   which is the opposite of what §6.2 asks it for. `meetTuning.test.ts` fails
 *   if that ordering is ever broken.
 *
 * ---------------------------------------------------------------------------
 * READINESS REACHES THE ATTEMPT AND LEAVES NO TRACE (GDD §6.2 step 3, §12.3)
 * ---------------------------------------------------------------------------
 * "Sim-mode readiness/fatigue silently adjusts the timing window width." A
 * `SessionFeel` from `fatigue.ts` is put on the `LiftConfig` and that is the
 * whole of it: `lift.ts` uses it for window width and a capacity nudge, and
 * nothing in `MeetDayState` holds a fatigue number, so there is no field a
 * component could bind a meter to. `MeetDayAttempt` has none either, and
 * `meetDay.test.ts` serialises the state and fails on the word.
 *
 * The `LiftMoment` handed to the mechanic counts ATTEMPTS TAKEN SO FAR IN THE
 * MEET where a training session counts work sets. That is a game-feel
 * abstraction and is signposted as one: a third deadlift after eight attempts
 * is a tighter window than an opening squat, which is the direction real meets
 * run in even though the model behind it is not physiology (GDD §3.1).
 */

import {
  ATTEMPTS_PER_LIFT,
  ATTEMPT_NUMBERS,
  JUDGE_COUNT,
  LIFT_ORDER,
  bestSuccessfulAttempt,
  currentAttemptContext,
  declareAttempt,
  isCallableWeightNow,
  isGoodLift,
  isSplitDecision,
  meetLoadingRules,
  resolveAttempt,
  suggestNextAttempt,
  suggestOpener,
  createMeet,
  type AttemptContext,
  type AttemptNumber,
  type AttemptOutcome,
  type CompletedAttempt,
  type JudgeLight,
  type JudgePanel,
  type LiftKind,
  type MeetError,
  type MeetState,
  type ProgressiveAttemptStrategy,
} from './meet';
import { nextRandom, seedState } from './prng';
import { sessionFeel, type FatigueState, type LiftMoment, type SessionFeel } from './fatigue';
import type { LiftConfig, LiftResolution, MissReason } from './lift';
import type { HapticPattern } from './liftTuning';
import type { MeetAttemptReport, MeetResultReport, MeetId } from './progression';
import { asMeetId } from './progression';
import {
  NO_VALUE_DISPLAY,
  buildResultCard,
  type ResultCard,
  type ResultCardError,
} from './resultCard';
import { MEET_COPY, MEET_TUNING, type MeetDefinition, type MeetEntry } from './meetTuning';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function scrub(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Number(value.toFixed(MEET_TUNING.PRECISION_DECIMALS));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function liftIndex(lift: LiftKind): number {
  return LIFT_ORDER.indexOf(lift);
}

// ---------------------------------------------------------------------------
// What the loop knows before it starts
// ---------------------------------------------------------------------------

/**
 * Everything meet day is handed. All of it comes from server truth (through
 * `meetServer.ts`) or from the app edge (the day).
 *
 * `bestE1rmKg` is READ ONLY and is used for exactly two things: suggesting an
 * opener (GDD §6.1) and setting the mechanic's load ratio. Nothing in this
 * module writes one back.
 */
export interface MeetDayContext {
  /** Integer streak day. Resolved outside — this module never reads a clock. */
  readonly day: number;
  readonly meet: MeetDefinition;
  readonly entry: MeetEntry;
  /** Best e1RM on record per lift, kg. The opener is suggested from it. */
  readonly bestE1rmKg: Readonly<Record<LiftKind, number>>;
  /** Best competition total on record before today, kg, or null. */
  readonly previousBestTotalKg: number | null;
  /** Best competition lift on record per lift, kg, or null. For PR call-outs. */
  readonly previousBestByLiftKg: Readonly<Record<LiftKind, number | null>>;
  /** The hidden ledger. Read only, and only by `fatigue.ts`. */
  readonly fatigue: FatigueState;
}

// ---------------------------------------------------------------------------
// The judging model (GDD §6.2 step 4)
// ---------------------------------------------------------------------------

/**
 * How obvious the call was, 0..1. 1 is "nobody in the building disagrees".
 *
 * Measured off the rep, never rolled. See the header for what each branch means
 * and why a miss is usually unanimous.
 */
export function judgingMargin(resolution: LiftResolution): number {
  const depth = resolution.timings.find((timing) => timing.cue === 'depth');
  if (resolution.outcome === 'miss') {
    const reason: MissReason | null = resolution.missReason;
    // Only a high squat is arguable. A bar that stalled, buried the lifter or
    // never got the command is one everybody in the room saw the same way.
    if (reason !== 'no-depth' || depth === undefined) return 1;
    return clamp01(Math.abs(depth.offsetMs) / MEET_TUNING.HIGH_SQUAT_UNANIMOUS_OFFSET_MS);
  }
  // A made lift. How convincing was the depth, and how much of the ascent was
  // spent going nowhere?
  const depthConfidence = depth === undefined ? 1 : clamp01(depth.quality);
  const ascentTicks = Math.max(1, resolution.ascentTicks);
  const stallFraction = clamp01(resolution.stallTicks / ascentTicks);
  return clamp01(depthConfidence - MEET_TUNING.GRIND_DOUBT_WEIGHT * stallFraction);
}

/** The seed the dissent draw for one attempt runs off. Never a clock. */
export function judgeSeedFor(meetSeed: number, lift: LiftKind, attemptNumber: AttemptNumber): number {
  return (
    MEET_TUNING.JUDGE_SEED_BASE +
    meetSeed +
    liftIndex(lift) * MEET_TUNING.JUDGE_SEED_LIFT_STRIDE +
    attemptNumber * MEET_TUNING.JUDGE_SEED_ATTEMPT_STRIDE
  );
}

/** The seed the bar's wobble jitter for one attempt runs off. Never a clock. */
export function attemptSeedFor(meetSeed: number, lift: LiftKind, attemptNumber: AttemptNumber): number {
  return (
    MEET_TUNING.ATTEMPT_SEED_BASE +
    meetSeed +
    liftIndex(lift) * MEET_TUNING.ATTEMPT_SEED_LIFT_STRIDE +
    attemptNumber * MEET_TUNING.ATTEMPT_SEED_ATTEMPT_STRIDE
  );
}

/**
 * How likely a panel is to split, given the call margin.
 *
 * Flat 1 at or below `SPLIT_MARGIN`, flat 0 at or above `UNANIMOUS_MARGIN`,
 * linear between. Separate from `judgePanelFor` so the curve can be checked
 * without a seed.
 */
export function dissentChance(margin: number): number {
  const low = MEET_TUNING.SPLIT_MARGIN;
  const high = MEET_TUNING.UNANIMOUS_MARGIN;
  if (!Number.isFinite(margin)) return 0;
  if (margin <= low) return 1;
  if (margin >= high) return 0;
  return scrub((high - margin) / (high - low));
}

/** Do the judges take a beat over this one? Strictly wider than a split. */
export function deliberates(margin: number): boolean {
  return margin < MEET_TUNING.DELIBERATION_MARGIN;
}

/**
 * The three lights.
 *
 * `good` is the mechanic's verdict and the MAJORITY ALWAYS MATCHES IT — see the
 * header. The only question this answers is whether one referee dissents, and
 * which one.
 */
export function judgePanelFor(good: boolean, margin: number, seed: number): JudgePanel {
  const agree = good ? 'white' : 'red';
  const dissent = good ? 'red' : 'white';
  const draw = nextRandom(seedState(seed));
  const splits = draw.value < dissentChance(margin);
  const lights: ('white' | 'red')[] = [agree, agree, agree];
  if (splits) {
    // Which referee dissents. A second draw, so the two decisions do not share
    // a bit and every referee can be the odd one out.
    const which = nextRandom(draw.state);
    const seat = Math.min(JUDGE_COUNT - 1, Math.floor(which.value * JUDGE_COUNT));
    lights[seat] = dissent;
  }
  const [head, left, right] = lights;
  if (head === undefined || left === undefined || right === undefined) {
    // Unreachable: the array is built with exactly `JUDGE_COUNT` entries.
    throw new Error('meetDay: a judging panel must have exactly three lights');
  }
  return [head, left, right];
}

/** The judges' whole answer for one attempt. */
export interface JudgingCall {
  readonly lights: JudgePanel;
  /** How obvious the call was, 0..1. Never rendered as a number. */
  readonly margin: number;
  /** True when the panel takes a beat before the lights. */
  readonly deliberated: boolean;
  readonly good: boolean;
  readonly split: boolean;
}

export function judgeAttempt(resolution: LiftResolution, seed: number): JudgingCall {
  const margin = judgingMargin(resolution);
  const good = resolution.outcome !== 'miss';
  const lights = judgePanelFor(good, margin, seed);
  return {
    lights,
    margin: scrub(margin),
    deliberated: deliberates(margin),
    good: isGoodLift(lights),
    split: isSplitDecision(lights),
  };
}

/**
 * GDD §6.2 step 5: "Depth cue or bar-speed replay clip as feedback." One line,
 * qualitative, no number and no meter (§3.4, §12.3).
 */
export function feedbackTextFor(resolution: LiftResolution, margin: number): string {
  if (resolution.outcome === 'miss') {
    switch (resolution.missReason) {
      case 'no-depth':
        return MEET_COPY.FEEDBACK_DEPTH_HIGH;
      case 'buried':
        return MEET_COPY.FEEDBACK_BURIED;
      case 'timeout':
        return MEET_COPY.FEEDBACK_TIMEOUT;
      default:
        return MEET_COPY.FEEDBACK_STALLED;
    }
  }
  if (resolution.outcome === 'grind') return MEET_COPY.FEEDBACK_GRIND;
  if (margin < MEET_TUNING.DELIBERATION_MARGIN) return MEET_COPY.FEEDBACK_DEPTH_MARGINAL;
  if (margin >= MEET_TUNING.UNANIMOUS_MARGIN) return MEET_COPY.FEEDBACK_DEPTH_CLEAR;
  return MEET_COPY.FEEDBACK_FAST;
}

/** The one line under the lights that says what the panel did. */
export function lightsTextFor(call: JudgingCall): string {
  if (!call.split) return call.good ? MEET_COPY.LIGHTS_UNANIMOUS : MEET_COPY.LIGHTS_ALL_RED;
  return call.good ? MEET_COPY.LIGHTS_SPLIT_GOOD : MEET_COPY.LIGHTS_SPLIT_BAD;
}

// ---------------------------------------------------------------------------
// One attempt, as the recap and the board remember it
// ---------------------------------------------------------------------------

/**
 * NO FATIGUE FIELD, AND NONE MAY BE ADDED (GDD §3.4, §12.3). `margin` is a
 * judging measurement, not a readiness one, and it is never rendered as a
 * number — `lightsTextFor` and `feedbackTextFor` turn it into a phrase.
 */
export interface MeetDayAttempt {
  readonly lift: LiftKind;
  readonly attemptNumber: AttemptNumber;
  readonly weightKg: number;
  readonly good: boolean;
  readonly lights: JudgePanel;
  readonly split: boolean;
  readonly deliberated: boolean;
  readonly margin: number;
  readonly feedbackText: string;
  readonly lightsText: string;
}

// ---------------------------------------------------------------------------
// Attempt selection (GDD §6.3) — the read model the tension is built on
// ---------------------------------------------------------------------------

export type AttemptOptionId = 'repeat' | 'small' | 'big';

export interface AttemptOption {
  readonly id: AttemptOptionId;
  readonly weightKg: number;
  /** Kilos above the previous attempt. Exactly 0 on a repeat. */
  readonly deltaKg: number;
  readonly label: string;
  readonly why: string;
  /**
   * True when taking this option would put the lifter above their best
   * competition lift on this lift — GDD §6.3's "a PR on the line".
   */
  readonly isPrAttempt: boolean;
}

/**
 * The whole of the decision GDD §6.3 describes, as data.
 *
 * `floorKg` IS `meet.ts`'s `AttemptContext.minimumWeight`, unmodified. It is
 * the lightest weight the engine will accept right now, and it is the number
 * §6.3's bite is about.
 */
export interface AttemptDecision {
  readonly lift: LiftKind;
  readonly attemptNumber: AttemptNumber;
  readonly previousWeightKg: number | null;
  readonly previousOutcome: AttemptOutcome | null;
  /** Best good lift banked on this lift so far, kg, or null. */
  readonly bankedKg: number | null;
  /** Lightest legal call right now. Straight off the engine. */
  readonly floorKg: number;
  /**
   * TRUE WHEN THE FLOOR IS THE WEIGHT THAT JUST BEAT THE LIFTER.
   *
   * GDD §6.3: "The bite is that a miss does not lower the floor — it RAISES it.
   * A lifter who misses their opener cannot retreat to something safe; the
   * lightest thing they can still take is the weight that just beat them."
   *
   * Derived from the engine's own answer rather than from "did they miss": it
   * is true exactly when the floor equals the previous attempt AND that attempt
   * was a no-lift, which is the only way the engine produces that floor.
   */
  readonly floorRaisedByMiss: boolean;
  readonly floorText: string;
  /** Two options, always. §6.3 is a choice between two things. */
  readonly options: readonly AttemptOption[];
  readonly isLastAttempt: boolean;
  /**
   * True when missing this attempt bombs the lift (GDD §6.3) — the last attempt
   * with nothing banked. What makes the walkout longest and the screen loudest.
   */
  readonly bombRisk: boolean;
  readonly bombWarningText: string | null;
}

function optionFor(
  state: MeetState,
  id: AttemptOptionId,
  weightKg: number,
  previousWeightKg: number,
  previousBestKg: number | null,
  label: string,
  why: string,
): AttemptOption | null {
  // Every weight offered is re-checked against the engine that will be asked to
  // accept it. An option the engine would refuse is dropped rather than shown.
  if (!isCallableWeightNow(state, weightKg)) return null;
  return {
    id,
    weightKg,
    deltaKg: scrub(weightKg - previousWeightKg),
    label,
    why,
    isPrAttempt: previousBestKg !== null && weightKg > previousBestKg,
  };
}

function suggestedWeight(state: MeetState, strategy: ProgressiveAttemptStrategy): number | null {
  const suggested = suggestNextAttempt(state, strategy);
  return suggested.ok ? suggested.value : null;
}

/**
 * What the lifter chooses between for the attempt on deck, or null when no
 * declaration is pending or this is an opener (openers are declared at
 * weigh-in, GDD §6.1).
 */
export function attemptDecisionFor(
  state: MeetState,
  previousBestByLiftKg: Readonly<Record<LiftKind, number | null>>,
): AttemptDecision | null {
  const context: AttemptContext | null = currentAttemptContext(state);
  if (context === null) return null;
  const previousWeightKg = context.previousWeight;
  if (previousWeightKg === null) return null;

  const lift = context.lift;
  const progress = state.lifts[lift];
  const bankedKg = bestSuccessfulAttempt(progress);
  const previousBestKg = previousBestByLiftKg[lift];
  const isLastAttempt = context.attemptNumber === ATTEMPTS_PER_LIFT;
  const bombRisk = isLastAttempt && bankedKg === null;

  // THE FLOOR IS THE ENGINE'S. Not recomputed, not clamped, not compared.
  const floorKg = context.minimumWeight;
  const floorRaisedByMiss = context.mayRepeatWeight && context.previousOutcome === 'no-lift';

  const options: AttemptOption[] = [];
  if (context.mayRepeatWeight) {
    // GDD §6.3 after a miss: repeat vs increase.
    const repeat = optionFor(
      state,
      'repeat',
      previousWeightKg,
      previousWeightKg,
      previousBestKg,
      MEET_COPY.OPTION_REPEAT,
      MEET_COPY.OPTION_REPEAT_WHY,
    );
    if (repeat !== null) options.push(repeat);
    const past = suggestedWeight(state, MEET_TUNING.AFTER_MISS_INCREASE_STRATEGY);
    if (past !== null) {
      const option = optionFor(
        state,
        'big',
        past,
        previousWeightKg,
        previousBestKg,
        MEET_COPY.OPTION_PUSH_PAST,
        MEET_COPY.OPTION_PUSH_PAST_WHY,
      );
      if (option !== null) options.push(option);
    }
  } else {
    // GDD §6.3 after a make: a small increase vs a big one.
    const small = suggestedWeight(state, MEET_TUNING.SMALL_INCREASE_STRATEGY);
    if (small !== null) {
      const option = optionFor(
        state,
        'small',
        small,
        previousWeightKg,
        previousBestKg,
        MEET_COPY.OPTION_SMALL,
        MEET_COPY.OPTION_SMALL_WHY,
      );
      if (option !== null) options.push(option);
    }
    const big = suggestedWeight(state, MEET_TUNING.BIG_INCREASE_STRATEGY);
    if (big !== null && (small === null || big > small)) {
      const option = optionFor(
        state,
        'big',
        big,
        previousWeightKg,
        previousBestKg,
        MEET_COPY.OPTION_BIG,
        MEET_COPY.OPTION_BIG_WHY,
      );
      if (option !== null) options.push(option);
    }
  }

  return {
    lift,
    attemptNumber: context.attemptNumber,
    previousWeightKg,
    previousOutcome: context.previousOutcome,
    bankedKg,
    floorKg,
    floorRaisedByMiss,
    floorText: floorRaisedByMiss
      ? MEET_COPY.SELECT_FLOOR_RAISED
      : MEET_COPY.SELECT_FLOOR_AFTER_MAKE,
    options,
    isLastAttempt,
    bombRisk,
    bombWarningText: bombRisk ? MEET_COPY.OPTION_BOMB_WARNING : null,
  };
}

// ---------------------------------------------------------------------------
// Openers (GDD §6.1)
// ---------------------------------------------------------------------------

/**
 * The suggested safe opener per lift, from the lifter's current e1RM.
 *
 * GDD §6.1: "Opening attempts pre-filled from current Sim-mode e1RM data as a
 * suggested safe opener. Player can override."
 *
 * The fraction and the rounding are `meet.ts`'s `suggestOpener` — this module
 * does not choose a percentage of anything. A lift whose e1RM the engine cannot
 * answer for falls back to the lightest callable weight, which is the bar.
 */
export function suggestedOpeners(
  bestE1rmKg: Readonly<Record<LiftKind, number>>,
  meet: MeetDefinition,
): Readonly<Record<LiftKind, number>> {
  const out: Partial<Record<LiftKind, number>> = {};
  for (const lift of LIFT_ORDER) {
    const suggested = suggestOpener(lift, bestE1rmKg[lift], meet.rules);
    out[lift] = suggested.ok ? suggested.value : meet.rules.barAndCollarsWeight[lift];
  }
  return out as Record<LiftKind, number>;
}

/** Weigh-in flavour (GDD §6.1). Flavour ONLY — it moves nothing. */
export interface WeighIn {
  readonly bodyweightKg: number;
  readonly weightClassText: string;
  readonly classLimitKg: number | null;
  readonly cuttingClose: boolean;
  readonly flavourText: string;
}

/**
 * @param classesKg the meet's weight classes, ascending. The caller supplies
 * them; `resultCard.ts` owns the published list and this module does not
 * restate it.
 */
export function weighInFor(entry: MeetEntry, classesKg: readonly number[]): WeighIn {
  let limit: number | null = null;
  for (const candidate of classesKg) {
    if (entry.bodyweightKg <= candidate) {
      limit = candidate;
      break;
    }
  }
  const cuttingClose =
    limit !== null && limit - entry.bodyweightKg <= MEET_TUNING.WATER_CUT_MARGIN_KG;
  const top = classesKg[classesKg.length - 1];
  return {
    bodyweightKg: entry.bodyweightKg,
    weightClassText: limit === null ? `${top ?? ''}+` : String(limit),
    classLimitKg: limit,
    cuttingClose,
    flavourText: cuttingClose ? MEET_COPY.WEIGH_IN_CUTTING_CLOSE : MEET_COPY.WEIGH_IN_COMFORTABLE,
  };
}

// ---------------------------------------------------------------------------
// The beats (GDD §6.2). Durations only — this module starts no timer.
// ---------------------------------------------------------------------------

/**
 * How long the bar load and walk-out beat runs for this attempt.
 *
 * Longer on a third attempt (GDD §7.2 / §12.2 make the third-attempt walkout
 * the reference beat), longer again above the lifter's best competition lift,
 * longest when a miss bombs the lift. The extras stack on purpose: a third
 * attempt, at a PR, with nothing banked, is the moment the whole mode exists
 * for.
 */
export function walkoutMs(
  attemptNumber: AttemptNumber,
  weightKg: number,
  previousBestKg: number | null,
  bombRisk: boolean,
): number {
  let total = MEET_TUNING.BAR_LOAD_MS + MEET_TUNING.WALKOUT_MS;
  if (attemptNumber === ATTEMPTS_PER_LIFT) total += MEET_TUNING.THIRD_ATTEMPT_WALKOUT_EXTRA_MS;
  if (previousBestKg !== null && weightKg > previousBestKg) {
    total += MEET_TUNING.PR_ATTEMPT_WALKOUT_EXTRA_MS;
  }
  if (bombRisk) total += MEET_TUNING.BOMB_RISK_WALKOUT_EXTRA_MS;
  return total;
}

/** The "judges deliberating" beat. Longer when the call is close. */
export function deliberationMs(deliberated: boolean): number {
  return MEET_TUNING.VERDICT_SILENCE_MS +
    (deliberated ? MEET_TUNING.DELIBERATION_MS : MEET_TUNING.CLEAR_CALL_DELIBERATION_MS);
}

/** Lights come up one at a time, then the feedback cue, then a hold. */
export function verdictMs(): number {
  return (
    MEET_TUNING.LIGHT_REVEAL_FIRST_DELAY_MS +
    (JUDGE_COUNT - 1) * MEET_TUNING.LIGHT_REVEAL_STAGGER_MS +
    MEET_TUNING.LIGHT_FADE_MS +
    MEET_TUNING.FEEDBACK_REVEAL_DELAY_MS +
    MEET_TUNING.VERDICT_HOLD_MS
  );
}

/** When the nth referee's light comes up, in ms from the start of the verdict. */
export function lightRevealDelayMs(seat: number): number {
  return MEET_TUNING.LIGHT_REVEAL_FIRST_DELAY_MS + seat * MEET_TUNING.LIGHT_REVEAL_STAGGER_MS;
}

// ---------------------------------------------------------------------------
// What meet day FEELS like (GDD §12.2 — "judge pacing and sound")
// ---------------------------------------------------------------------------

/**
 * A moment on meet day that the phone should register in the hand.
 *
 * Deliberately the SAME SHAPE as `lift.ts`'s `LiftEvent` -> `hapticFor` pair,
 * and here for the same reason that one is in `lift.ts`: which pattern a moment
 * gets is a decision about the game, not about React, and CLAUDE.md forbids it
 * living in a component. The screens' only job is to say WHEN a beat happened.
 *
 * These are the beats the meet-day screens own. The rep inside the attempt is
 * `lift.ts`'s and is not restated here.
 */
export type MeetBeat =
  /** One plate landing on the sleeve as the bar is loaded. */
  | { readonly kind: 'bar-plate' }
  /** The walk-out line arriving. `urgent` on a third, a PR or a bomb risk. */
  | { readonly kind: 'walkout-call'; readonly urgent: boolean }
  /** The panel goes dark and the judges take their beat. */
  | { readonly kind: 'deliberation' }
  /** One referee's lamp coming up. */
  | { readonly kind: 'light'; readonly light: JudgeLight }
  /** GOOD LIFT / NO LIFT, after the last lamp. */
  | { readonly kind: 'verdict'; readonly good: boolean }
  /** The bomb-out's first line, after its silence (GDD §6.3). */
  | { readonly kind: 'bomb-out' }
  /** The floor landing on the attempt-select screen. */
  | { readonly kind: 'floor'; readonly raisedByMiss: boolean }
  /** An attempt declared. A one-way ratchet — §6.3's whole point. */
  | { readonly kind: 'attempt-declared' };

/** Every beat kind, for the exhaustiveness check in `meetDay.test.ts`. */
export const MEET_BEAT_KINDS = Object.freeze([
  'bar-plate',
  'walkout-call',
  'deliberation',
  'light',
  'verdict',
  'bomb-out',
  'floor',
  'attempt-declared',
] as const satisfies readonly MeetBeat['kind'][]);

/**
 * The haptic pattern for a meet-day beat, or null if that beat is felt as
 * nothing.
 *
 * Null is a REAL ANSWER here and not a missing case. A floor that was not
 * raised by a miss is silent precisely so the one that was is not — the
 * difference between "the weight you just made" and "the weight that just beat
 * you" is GDD §6.3's entire argument, and a beat that fired on both would
 * flatten it.
 *
 * NONE OF THESE HAVE BEEN FELT. See `MEET_TUNING.HAPTICS`.
 */
export function hapticForBeat(beat: MeetBeat): HapticPattern | null {
  const h = MEET_TUNING.HAPTICS;
  switch (beat.kind) {
    case 'bar-plate':
      return h.BAR_PLATE;
    case 'walkout-call':
      return beat.urgent ? h.WALKOUT_CALL_URGENT : h.WALKOUT_CALL;
    case 'deliberation':
      return h.DELIBERATION;
    case 'light':
      return beat.light === 'white' ? h.LIGHT_WHITE : h.LIGHT_RED;
    case 'verdict':
      return beat.good ? h.VERDICT_GOOD : h.VERDICT_NO_LIFT;
    case 'bomb-out':
      return h.BOMB_OUT;
    case 'floor':
      return beat.raisedByMiss ? h.FLOOR_RAISED : null;
    case 'attempt-declared':
      return h.ATTEMPT_DECLARED;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// The loop's phases
// ---------------------------------------------------------------------------

export type MeetDayPhaseId =
  /** GDD §6.1's weigh-in beat. */
  | 'weigh-in'
  /** GDD §6.1's openers, pre-filled and overridable. */
  | 'openers'
  /** GDD §6.3's choice. Never shown for an opener. */
  | 'attempt-select'
  /** GDD §6.2 step 1: the bar loads and the lifter walks it out. */
  | 'walkout'
  /** GDD §6.2 steps 2-3: the rep, on the existing mechanic. */
  | 'lift'
  /** GDD §6.2 step 4, first half: the judges take a beat. */
  | 'deliberation'
  /** GDD §6.2 step 4-5: three lights, then the feedback cue. */
  | 'verdict'
  /** GDD §6.3's somber moment. Terminal. */
  | 'bombed'
  /** GDD §6.5's recap. Terminal. */
  | 'recap';

export const MEET_DAY_PHASES = Object.freeze([
  'weigh-in',
  'openers',
  'attempt-select',
  'walkout',
  'lift',
  'deliberation',
  'verdict',
  'bombed',
  'recap',
] as const satisfies readonly MeetDayPhaseId[]);

/** The attempt currently on the platform, once its weight is declared. */
export interface LiveAttempt {
  readonly lift: LiftKind;
  readonly attemptNumber: AttemptNumber;
  readonly weightKg: number;
  /** `weightKg / e1rmKg` — what the lift mechanic means by `loadRatio`. */
  readonly loadRatio: number;
  readonly seed: number;
  /** True when a miss here bombs the lift (GDD §6.3). */
  readonly bombRisk: boolean;
  /** True when the bar is above the lifter's best competition lift. */
  readonly isPrAttempt: boolean;
  /** How long GDD §6.2 step 1 runs for this attempt. */
  readonly walkoutMs: number;
}

export interface MeetDayState {
  readonly context: MeetDayContext;
  readonly phase: MeetDayPhaseId;
  /** The engine. Authoritative for every rule of the sport. */
  readonly meet: MeetState;
  readonly openersKg: Readonly<Record<LiftKind, number>>;
  /** True per lift once the player has moved an opener off the suggestion. */
  readonly openerOverridden: Readonly<Record<LiftKind, boolean>>;
  readonly live: LiveAttempt | null;
  /** The judges' answer to the attempt just taken, while it is on screen. */
  readonly call: JudgingCall | null;
  readonly attempts: readonly MeetDayAttempt[];
  /** The last refusal the engine returned, for the UI to surface. */
  readonly lastError: MeetError | null;
}

// ---------------------------------------------------------------------------
// Building an attempt
// ---------------------------------------------------------------------------

/** A stable per-meet seed, so a meet replays identically. Never a clock. */
export function meetSeedFor(context: MeetDayContext): number {
  return context.day;
}

function liveAttemptFor(
  context: MeetDayContext,
  state: MeetState,
  lift: LiftKind,
  attemptNumber: AttemptNumber,
  weightKg: number,
): LiveAttempt {
  const banked = bestSuccessfulAttempt(state.lifts[lift]);
  const bombRisk = attemptNumber === ATTEMPTS_PER_LIFT && banked === null;
  const previousBestKg = context.previousBestByLiftKg[lift];
  const e1rmKg = context.bestE1rmKg[lift];
  return {
    lift,
    attemptNumber,
    weightKg,
    loadRatio: scrub(weightKg / e1rmKg),
    seed: attemptSeedFor(meetSeedFor(context), lift, attemptNumber),
    bombRisk,
    isPrAttempt: previousBestKg !== null && weightKg > previousBestKg,
    walkoutMs: walkoutMs(attemptNumber, weightKg, previousBestKg, bombRisk),
  };
}

/**
 * The config for the attempt about to be taken.
 *
 * `feel` is what carries GDD §6.2 step 3 into the mechanic: `lift.ts` uses it
 * for the timing-window width and the bar-speed capacity nudge, and for nothing
 * else. No fatigue number crosses this boundary in either direction.
 *
 * @throws {RangeError} when there is no attempt on the platform.
 */
export function attemptConfigFor(state: MeetDayState): LiftConfig {
  const live = state.live;
  if (live === null) {
    throw new RangeError('meetDay: there is no attempt on the platform to configure.');
  }
  const feel: SessionFeel = sessionFeel(state.context.fatigue, state.context.day);
  const moment: LiftMoment = {
    // Attempts already taken in this meet. The meet's own accumulation, which
    // is the "same-day" horizon GDD §3.4 gives fatigue.
    workSetsCompleted: state.attempts.length,
    repsCompletedInSet: 0,
  };
  return { loadRatio: live.loadRatio, seed: live.seed, feel, moment };
}

// ---------------------------------------------------------------------------
// The machine
// ---------------------------------------------------------------------------

export type MeetDayEvent =
  | { readonly kind: 'confirm-weigh-in' }
  | { readonly kind: 'set-opener'; readonly lift: LiftKind; readonly weightKg: number }
  | { readonly kind: 'confirm-openers' }
  /** GDD §6.3's choice, or an opener being declared as its lift comes up. */
  | { readonly kind: 'declare'; readonly weightKg: number }
  /** The bar-load and walk-out beat elapsed. */
  | { readonly kind: 'walkout-done' }
  /** A rep of the lift mechanic resolved. `lift.ts` decided the outcome. */
  | { readonly kind: 'lift-resolved'; readonly resolution: LiftResolution }
  /** The deliberation beat elapsed. */
  | { readonly kind: 'deliberation-done' }
  /** The verdict beat elapsed (or was tapped through). */
  | { readonly kind: 'verdict-done' };

/** A meet at its first frame: the weigh-in, with the openers pre-filled. */
export function createMeetDay(context: MeetDayContext): MeetDayState {
  if (!Number.isSafeInteger(context.day)) {
    throw new RangeError(`meetDay: day must be a safe integer day index, received ${context.day}.`);
  }
  for (const lift of LIFT_ORDER) {
    const e1rm = context.bestE1rmKg[lift];
    if (!Number.isFinite(e1rm) || e1rm <= 0) {
      throw new RangeError(`meetDay: bestE1rmKg.${lift} must be a positive finite number, received ${e1rm}.`);
    }
  }
  return {
    context,
    phase: 'weigh-in',
    meet: createMeet(context.meet.rules),
    openersKg: suggestedOpeners(context.bestE1rmKg, context.meet),
    openerOverridden: { squat: false, bench: false, deadlift: false },
    live: null,
    call: null,
    attempts: [],
    lastError: null,
  };
}

/**
 * Where the meet goes once an attempt has been judged.
 *
 * Every branch reads `meet.ts` rather than counting anything: `phase.kind ===
 * 'complete'` and `outcome.kind === 'bombed-out'` are the engine's answers, and
 * a lift that is finished with no good attempt is the engine's definition of a
 * bomb-out (GDD §6.3), not this module's.
 */
function afterVerdict(state: MeetDayState): MeetDayState {
  const meet = state.meet;
  if (meet.phase.kind === 'complete') {
    const bombed = meet.phase.outcome.kind === 'bombed-out';
    return { ...state, phase: bombed ? 'bombed' : 'recap', live: null, call: null };
  }
  const context = currentAttemptContext(meet);
  if (context === null) return { ...state, phase: 'recap', live: null, call: null };
  if (context.previousWeight === null) {
    // A new lift has started, so its opener — declared at weigh-in — goes
    // straight onto the bar. GDD §6.3's choice is between attempts, not before
    // the first one.
    return declareLive(
      { ...state, live: null, call: null },
      state.openersKg[context.lift],
    );
  }
  return { ...state, phase: 'attempt-select', live: null, call: null };
}

/** Puts a weight on the bar through the engine, or surfaces the refusal. */
function declareLive(state: MeetDayState, weightKg: number): MeetDayState {
  const declared = declareAttempt(state.meet, { weight: weightKg });
  if (!declared.ok) {
    return { ...state, lastError: declared.error };
  }
  const phase = declared.value.phase;
  if (phase.kind !== 'attempt-declared') {
    // Unreachable: a successful declaration always lands in that phase.
    return { ...state, lastError: null };
  }
  const attempt = phase.attempt;
  return {
    ...state,
    phase: 'walkout',
    meet: declared.value,
    live: liveAttemptFor(state.context, state.meet, attempt.lift, attempt.attemptNumber, attempt.weight),
    call: null,
    lastError: null,
  };
}

/**
 * Advance the loop by one event.
 *
 * TOTAL: an event that does not apply to the current phase returns the state
 * unchanged rather than throwing. A double-tap on a button that has already
 * advanced the screen is a thing fingers do, and it must not be a crash.
 */
export function stepMeetDay(state: MeetDayState, event: MeetDayEvent): MeetDayState {
  switch (event.kind) {
    case 'confirm-weigh-in': {
      if (state.phase !== 'weigh-in') return state;
      return { ...state, phase: 'openers' };
    }

    case 'set-opener': {
      if (state.phase !== 'openers') return state;
      // The engine decides whether the number is callable at all. A weight it
      // would refuse never becomes an opener.
      if (!isCallableWeightNow(state.meet, event.weightKg) && state.meet.phase.kind === 'awaiting-declaration'
        && state.meet.phase.lift === event.lift) {
        return state;
      }
      const floor = state.context.meet.rules.barAndCollarsWeight[event.lift];
      if (!Number.isFinite(event.weightKg) || event.weightKg < floor) return state;
      return {
        ...state,
        openersKg: { ...state.openersKg, [event.lift]: event.weightKg },
        openerOverridden: { ...state.openerOverridden, [event.lift]: true },
      };
    }

    case 'confirm-openers': {
      if (state.phase !== 'openers') return state;
      const context = currentAttemptContext(state.meet);
      if (context === null) return state;
      return declareLive(state, state.openersKg[context.lift]);
    }

    case 'declare': {
      if (state.phase !== 'attempt-select') return state;
      return declareLive(state, event.weightKg);
    }

    case 'walkout-done': {
      if (state.phase !== 'walkout') return state;
      return { ...state, phase: 'lift' };
    }

    case 'lift-resolved': {
      if (state.phase !== 'lift') return state;
      const live = state.live;
      if (live === null) return state;
      const call = judgeAttempt(
        event.resolution,
        judgeSeedFor(meetSeedFor(state.context), live.lift, live.attemptNumber),
      );
      // The lights are an INPUT to the engine — it does not roll them and this
      // module does not decide whether they carry.
      const resolved = resolveAttempt(state.meet, { lights: call.lights });
      if (!resolved.ok) return { ...state, lastError: resolved.error };
      const attempt: MeetDayAttempt = {
        lift: live.lift,
        attemptNumber: live.attemptNumber,
        weightKg: live.weightKg,
        good: call.good,
        lights: call.lights,
        split: call.split,
        deliberated: call.deliberated,
        margin: call.margin,
        feedbackText: feedbackTextFor(event.resolution, call.margin),
        lightsText: lightsTextFor(call),
      };
      return {
        ...state,
        phase: 'deliberation',
        meet: resolved.value,
        call,
        attempts: [...state.attempts, attempt],
        lastError: null,
      };
    }

    case 'deliberation-done': {
      if (state.phase !== 'deliberation') return state;
      return { ...state, phase: 'verdict' };
    }

    case 'verdict-done': {
      if (state.phase !== 'verdict') return state;
      return afterVerdict(state);
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Read models for the screens
// ---------------------------------------------------------------------------

/** The attempt just judged, for the verdict screen. */
export function lastAttempt(state: MeetDayState): MeetDayAttempt | null {
  return state.attempts[state.attempts.length - 1] ?? null;
}

/** Every finished attempt on this lift, for the board. */
export function attemptsOnLift(state: MeetDayState, lift: LiftKind): readonly MeetDayAttempt[] {
  return state.attempts.filter((attempt) => attempt.lift === lift);
}

/**
 * The attempts as the SERVER is told about them.
 *
 * INPUTS ONLY: which lift, which attempt, what was on the bar and whether it
 * stood. There is no total in it and `progression.ts`'s allowlist forbids one —
 * GDD §6.4's "total = sum of best successful attempt per lift" is a server
 * computation, and `meetServer.ts` recomputes it by replaying these through the
 * same engine rather than taking the client's word for the arithmetic.
 */
export function meetAttemptReports(state: MeetDayState): readonly MeetAttemptReport[] {
  return state.attempts.map((attempt) => ({
    lift: attempt.lift,
    attemptNumber: attempt.attemptNumber,
    weightKg: attempt.weightKg,
    good: attempt.good,
  }));
}

/** The id this meet reports under. */
export function meetIdFor(meet: MeetDefinition): MeetId {
  return asMeetId(meet.id);
}

/**
 * What the client asks the server to record.
 *
 * `null` while the meet is still running: a meet that has not finished has no
 * result, and `meet.ts`'s `readTotal` will not produce a provisional one.
 */
export function meetResultProposal(
  state: MeetDayState,
): { readonly kind: 'record-meet-result'; readonly report: MeetResultReport } | null {
  if (state.meet.phase.kind !== 'complete') return null;
  if (state.attempts.length === 0) return null;
  return {
    kind: 'record-meet-result',
    report: {
      meetId: meetIdFor(state.context.meet),
      bodyweightKg: state.context.entry.bodyweightKg,
      attempts: meetAttemptReports(state),
    },
  };
}

/** Attempts across the whole meet in the order they happened, from the engine. */
export function completedAttempts(state: MeetDayState): readonly CompletedAttempt[] {
  return LIFT_ORDER.flatMap((lift) => state.meet.lifts[lift].attempts);
}

// ---------------------------------------------------------------------------
// Post-meet recap (GDD §6.5)
//
// "Recap screen: attempt-by-attempt breakdown, PR call-outs, DOTS score,
// placing in field. Shareable result card formatted like a real federation
// result sheet."
//
// THE CARD IS NOT REBUILT HERE. `resultCard.ts` already turns a finished meet
// into rows, marks, a DOTS outcome and a place cell, and `src/card/` already
// renders it. The recap BUILDS THAT CARD and reads its own numbers back off it,
// so the screen a player sees before they share and the card they share cannot
// print two different totals. Everything this section adds is what the card
// deliberately does not carry: the judging lights on each attempt (a federation
// sheet records a made or missed weight, not a 2-1) and the PR call-outs, which
// are a fact about this lifter's history rather than about this meet.
// ---------------------------------------------------------------------------

/** One lift's row on the recap board. */
export interface RecapLiftRow {
  readonly lift: LiftKind;
  readonly label: string;
  /** The three attempts, or null where one was never taken. */
  readonly attempts: readonly (MeetDayAttempt | null)[];
  readonly bestKg: number | null;
  readonly bestText: string;
  /** True when this meet beat the lifter's best competition lift on record. */
  readonly isPr: boolean;
  readonly bombed: boolean;
}

/**
 * The facts the recap needs from the SERVER. `AppliedMeetResult` satisfies this
 * structurally, which is how this module stays free of `meetServer.ts`: the
 * recap consumes an answer, it does not compute one.
 */
export interface ConfirmedMeetFacts {
  readonly totalKg: number | null;
  readonly previousBestTotalKg: number | null;
  readonly isTotalPr: boolean;
  readonly liftPrs: Readonly<Record<LiftKind, boolean>>;
  readonly placing: { readonly place: number | null; readonly fieldSize: number };
}

export interface MeetRecap {
  /** The shareable card (GDD §6.5), built by `resultCard.ts`. */
  readonly card: ResultCard;
  /** This meet's total, kg, or null on a bomb-out. Never a running sum. */
  readonly totalKg: number | null;
  readonly totalText: string;
  readonly previousBestTotalKg: number | null;
  readonly isTotalPr: boolean;
  /** True when this is the lifter's first competition total at all. */
  readonly isFirstTotal: boolean;
  readonly prText: string | null;
  /** From the card, so the recap and the card cannot disagree. */
  readonly dotsText: string;
  readonly placeText: string;
  readonly fieldSize: number;
  readonly rows: readonly RecapLiftRow[];
  readonly bombedLift: LiftKind | null;
}

/**
 * `resultCard.ts`'s refusals, plus one of this module's own.
 *
 * `TOTAL_DISAGREES_WITH_CARD` is the client-is-a-renderer check (CLAUDE.md:
 * "Local state is a cache of server truth, not the truth itself"). The card is
 * built from the meet the CLIENT played; the total comes back from the server,
 * which replayed the same attempts through the same engine. Those two numbers
 * must be the same number, and if they ever are not, the honest thing is to
 * refuse rather than to put the server's total next to a card printing a
 * different one — which is what would happen if this module simply preferred
 * one of them.
 */
export type MeetRecapError =
  | ResultCardError
  | { readonly code: 'TOTAL_DISAGREES_WITH_CARD'; readonly message: string };

export type MeetRecapResult =
  | { readonly ok: true; readonly recap: MeetRecap }
  | { readonly ok: false; readonly error: MeetRecapError };

function recapRowsFor(
  state: MeetDayState,
  card: ResultCard,
  liftPrs: Readonly<Record<LiftKind, boolean>>,
): readonly RecapLiftRow[] {
  return LIFT_ORDER.map((lift, index) => {
    const cardRow = card.rows[index];
    const taken = attemptsOnLift(state, lift);
    return {
      lift,
      label: MEET_COPY.LIFT_LABEL[lift],
      attempts: ATTEMPT_NUMBERS.map(
        (attemptNumber) => taken.find((attempt) => attempt.attemptNumber === attemptNumber) ?? null,
      ),
      bestKg: cardRow?.bestKg ?? null,
      bestText: cardRow?.bestText ?? NO_VALUE_DISPLAY,
      isPr: liftPrs[lift],
      bombed: cardRow?.bombed ?? false,
    };
  });
}

/**
 * What the recap's TOTAL reads at one point in its count-up.
 *
 * Here rather than in the component because it is a formatting rule about a
 * competition total, and getting it wrong is a domain error rather than a
 * layout one: a total is a half-kilo number (`612.5`), and a count-up that
 * rounded its final frame would print `613` on the one screen in the game whose
 * whole job is that number. So the counter shows whole kilos while it is
 * MOVING — a ticking `612.5` is unreadable — and lands on the card's own text,
 * which is `resultCard.ts`'s `formatWeight` and therefore exactly what the
 * shareable card prints.
 */
export function countedTotalText(recap: MeetRecap, counted: number): string {
  if (recap.totalKg === null) return recap.totalText;
  if (!Number.isFinite(counted) || counted >= recap.totalKg) return recap.totalText;
  return String(Math.round(counted));
}

/**
 * Build the recap for a finished meet.
 *
 * WORKS FOR A BOMB-OUT TOO, and does not hide one: `resultCard.ts` prints no
 * best on the bombed lift, no total, no DOTS and "DQ" in the place column, and
 * this passes no `placing` at all in that case — supplying one for a lifter
 * with no total is a refusal there (`PLACING_WITHOUT_TOTAL`) rather than a
 * rounding-down to last. GDD §6.3's bomb-out screen shows the subset it needs.
 */
export function buildMeetRecap(state: MeetDayState, confirmed: ConfirmedMeetFacts): MeetRecapResult {
  const entry = state.context.entry;
  const definition = state.context.meet;
  const place = confirmed.totalKg === null ? undefined : confirmed.placing.place ?? undefined;
  const built = buildResultCard({
    meet: {
      federation: definition.federation,
      name: definition.name,
      dateIso: definition.dateIso,
      town: definition.town,
      state: definition.state,
      country: definition.country,
    },
    lifter: {
      name: entry.name,
      sex: entry.sex,
      bodyweightKg: entry.bodyweightKg,
      division: entry.division,
      equipment: entry.equipment,
    },
    state: state.meet,
    ...(place === undefined ? {} : { placing: place }),
  });
  if (!built.ok) return { ok: false, error: built.error };
  const card = built.card;
  if (card.totalKg !== confirmed.totalKg) {
    return {
      ok: false,
      error: {
        code: 'TOTAL_DISAGREES_WITH_CARD',
        message:
          `meetDay: the server recorded a total of ${String(confirmed.totalKg)} but this meet's card ` +
          `reads ${String(card.totalKg)}. The recap will not print two totals for one meet.`,
      },
    };
  }
  const isFirstTotal = confirmed.totalKg !== null && confirmed.previousBestTotalKg === null;
  return {
    ok: true,
    recap: {
      card,
      totalKg: confirmed.totalKg,
      // From the card's own summary block, so the two cannot print different
      // numbers for the same meet.
      totalText: card.summary[0].value,
      previousBestTotalKg: confirmed.previousBestTotalKg,
      isTotalPr: confirmed.isTotalPr,
      isFirstTotal,
      prText: isFirstTotal
        ? MEET_COPY.RECAP_FIRST_TOTAL
        : confirmed.isTotalPr
          ? MEET_COPY.RECAP_PR_TOTAL
          : confirmed.totalKg === null
            ? null
            : MEET_COPY.RECAP_NO_PR,
      dotsText: card.summary[1].value,
      placeText: card.summary[2].value,
      fieldSize: confirmed.placing.fieldSize,
      rows: recapRowsFor(state, card, confirmed.liftPrs),
      bombedLift: card.bombedLift,
    },
  };
}
