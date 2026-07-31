/**
 * meet.ts — Meet-day engine.
 *
 * A pure, deterministic state machine for one lifter's meet (GDD §6).
 *
 * PURITY CONTRACT (CLAUDE.md "Pure logic is separate from UI"):
 *   - Zero React imports, zero I/O, zero side effects.
 *   - No clock reads and no randomness. Judging is an *input*: the caller hands
 *     the engine the three lights that came up. Whatever decides those lights
 *     (the Arcade bar-path mechanic, a seeded NPC sim, a replay) lives outside
 *     this module so the engine stays replayable and testable.
 *   - Every transition returns a new state; inputs are never mutated.
 *
 * SPORT RULES MODELLED (CLAUDE.md "Domain Correctness", GDD §6.2/§6.4):
 *   - Lift order is squat -> bench -> deadlift, three attempts each.
 *   - A lift is judged by three referees; a majority (2 of 3 white) is a good
 *     lift.
 *   - Total = sum of the best *successful* attempt in each of the three lifts.
 *   - Bombing out (no successful attempt on a lift) means NO TOTAL, and per
 *     GDD §6.3 it ends the meet.
 *   - Within a lift the bar weight never decreases (see the conflict note
 *     below). After a good lift it must go UP by at least the federation's
 *     minimum increase; after a no-lift it may be repeated exactly.
 *   - The bar must be loadable: attempt weights are multiples of the loadable
 *     increment. Record attempts are the conventional exception (finer
 *     increment, and they may sit only that increment above the previous
 *     attempt).
 *
 * ---------------------------------------------------------------------------
 * DESIGN CONFLICT — NEEDS A HUMAN DECISION. NOT RESOLVED HERE.
 * ---------------------------------------------------------------------------
 * CLAUDE.md ("Domain Correctness") says: "attempts may not go down in weight
 * within a lift."
 *
 * GDD §6.3 ("Attempt Selection — The Real Tension") says: after a miss the
 * player chooses between "repeat the weight (use the last attempt)" vs "drop
 * down (guaranteed banked total, no PR)."
 *
 * These contradict each other. Real-sport rules side with CLAUDE.md: within a
 * lift a lifter's bar weight may be repeated after a miss but never lowered.
 * This engine therefore enforces the NON-DECREASING rule as a hard invariant
 * (`WEIGHT_DECREASED`), which is why `AttemptStrategy` has no "drop down"
 * option.
 *
 * The GDD is the authoritative document, so this is flagged rather than
 * silently reworded. A human must pick one of:
 *   (a) Reword GDD §6.3's post-miss choice to the real-sport pair —
 *       "repeat the weight" vs "take a smaller jump on the next attempt" —
 *       which preserves the intended tension (bank the total vs chase the PR)
 *       without breaking the rules of the sport; or
 *   (b) Keep a literal "drop down" as a deliberate arcade divergence, in which
 *       case this invariant must be relaxed here and real lifters will notice.
 * Do not resolve this by editing code alone; docs/GDD.md and the engine must
 * end up agreeing.
 * ---------------------------------------------------------------------------
 *
 * DELIBERATE NON-GOALS (so their absence is not mistaken for an error):
 *   - Multi-lifter flights, attempt (bar-loading) order within a flight, and
 *     live placing — GDD §6.6. This engine is one lifter's card.
 *   - Attempt-card changes at the scoring table (feds allow a limited number of
 *     weight changes on a declared attempt). The UI should collect the final
 *     declaration before calling `declareAttempt`.
 *   - Out-of-competition fourth attempts for records: they do not affect the
 *     total and are not modelled.
 *   - Timing of the one-minute clock: this module holds no clock (see purity).
 *   - DOTS/Wilks scoring and e1RM live in their own modules and are not
 *     imported here.
 */

// ---------------------------------------------------------------------------
// Tunable constants
//
// CLAUDE.md "Game Feel Values Must Be Tunable": every number that gets tuned by
// hand lives here as a named export, never inline at a call site.
//
// Weights are unit-agnostic numbers. The defaults below are the kg values used
// by IPF-style federations (GDD §11 leaves the display-unit default open); an
// lb-based federation swaps in its own `MeetLoadingRules`.
// ---------------------------------------------------------------------------

/** Three attempts per lift. Structural rule of the sport, not a tuning knob. */
export const ATTEMPTS_PER_LIFT = 3;

/** Referees on the panel. Structural. */
export const JUDGE_COUNT = 3;

/** White lights needed for a good lift — a majority of three. Structural. */
export const JUDGES_REQUIRED_FOR_GOOD_LIFT = 2;

/** Smallest legal increase between two attempts on the same lift. */
export const MIN_ATTEMPT_INCREMENT_KG = 2.5;

/** Granularity the bar can actually be loaded to. */
export const LOADABLE_WEIGHT_INCREMENT_KG = 2.5;

/**
 * Finer granularity permitted for a declared record attempt — it may be loaded
 * to, and sit only, this far above the previous attempt.
 */
export const RECORD_ATTEMPT_INCREMENT_KG = 0.5;

/** Float slop tolerated when comparing weights. */
export const WEIGHT_EPSILON = 1e-6;

/** Decimal places weights are normalised to, to keep float math tidy. */
export const WEIGHT_DECIMAL_PLACES = 3;

/**
 * Suggested jump for the next attempt, as a fraction of the previous attempt's
 * weight (GDD §6.3: conservative "lock in the total" vs aggressive "chase it").
 *
 * Per-lift because bench jumps are conventionally smaller than squat/deadlift
 * jumps. UNTUNED: these are plausible meet-day progressions, not playtested
 * values. Expect them to move.
 */
export const ATTEMPT_JUMP_FRACTION: Readonly<
  Record<LiftKind, Readonly<Record<ProgressiveAttemptStrategy, number>>>
> = {
  squat: { conservative: 0.02, standard: 0.035, aggressive: 0.055 },
  bench: { conservative: 0.015, standard: 0.025, aggressive: 0.04 },
  deadlift: { conservative: 0.02, standard: 0.04, aggressive: 0.06 },
};

/**
 * Suggested opener as a fraction of the lifter's current one-rep max estimate
 * (GDD §6.1: "opening attempts pre-filled from current Sim-mode e1RM data as a
 * suggested safe opener").
 *
 * The e1RM number is passed IN as a plain number — this module does not import
 * the e1RM module. UNTUNED.
 */
export const OPENER_FRACTION_OF_1RM: Readonly<Record<LiftKind, number>> = {
  squat: 0.9,
  bench: 0.9,
  deadlift: 0.9,
};

// ---------------------------------------------------------------------------
// Core domain types
// ---------------------------------------------------------------------------

export type LiftKind = 'squat' | 'bench' | 'deadlift';

/** Squat -> bench -> deadlift. Structural rule of the sport. */
export const LIFT_ORDER = ['squat', 'bench', 'deadlift'] as const satisfies readonly LiftKind[];

export type AttemptNumber = 1 | 2 | 3;

export const ATTEMPT_NUMBERS = [1, 2, 3] as const satisfies readonly AttemptNumber[];

export type JudgeLight = 'white' | 'red';

/** The three-light panel, head referee first. */
export type JudgePanel = readonly [JudgeLight, JudgeLight, JudgeLight];

export type AttemptOutcome = 'good' | 'no-lift';

interface AttemptIdentity {
  readonly lift: LiftKind;
  readonly attemptNumber: AttemptNumber;
}

/** Declared and on the platform, not yet judged. */
export interface DeclaredAttempt extends AttemptIdentity {
  readonly status: 'declared';
  readonly weight: number;
  readonly recordAttempt: boolean;
}

/** Taken and judged. */
export interface JudgedAttempt extends AttemptIdentity {
  readonly status: AttemptOutcome;
  readonly weight: number;
  readonly recordAttempt: boolean;
  readonly lights: JudgePanel;
  readonly whiteLights: number;
  /** True when all three referees agreed (3 white or 3 red). */
  readonly unanimous: boolean;
}

/** Forfeited without taking the bar. Carries no weight. */
export interface PassedAttempt extends AttemptIdentity {
  readonly status: 'passed';
}

/** An attempt that is finished with, one way or another. */
export type CompletedAttempt = JudgedAttempt | PassedAttempt;

export type Attempt = DeclaredAttempt | CompletedAttempt;

export type LiftStatus =
  /** Not reached yet. */
  | 'upcoming'
  /** Currently being contested. */
  | 'in-progress'
  /** Finished with at least one good lift. */
  | 'complete'
  /** Finished with no good lift — no total, meet over (GDD §6.3). */
  | 'bombed'
  /** Never contested because the meet ended on an earlier lift. */
  | 'not-contested';

export interface LiftProgress {
  readonly lift: LiftKind;
  /** Finished attempts in order. The in-flight declaration lives on the phase. */
  readonly attempts: readonly CompletedAttempt[];
  readonly status: LiftStatus;
  /** Best successful weight on this lift, or null if none yet. */
  readonly best: number | null;
}

/** Federation-configurable loading rules. */
export interface MeetLoadingRules {
  /** Minimum legal increase between attempts on the same lift. */
  readonly minIncrement: number;
  /** Granularity the bar can be loaded to. */
  readonly loadableIncrement: number;
  /** Granularity and minimum increase allowed for a declared record attempt. */
  readonly recordIncrement: number;
  /** When false, any positive weight may be declared (useful for lb meets/tests). */
  readonly enforceLoadableIncrement: boolean;
}

export const DEFAULT_MEET_RULES: MeetLoadingRules = {
  minIncrement: MIN_ATTEMPT_INCREMENT_KG,
  loadableIncrement: LOADABLE_WEIGHT_INCREMENT_KG,
  recordIncrement: RECORD_ATTEMPT_INCREMENT_KG,
  enforceLoadableIncrement: true,
};

interface MeetOutcomeBase {
  /** Best good lift per lift; null where a lift was bombed or never contested. */
  readonly bestByLift: Readonly<Record<LiftKind, number | null>>;
  /** Sum of the bests actually achieved. Equals `total` on a completed meet. */
  readonly bankedTotal: number;
  /** Every finished attempt, in the order they happened. */
  readonly attempts: readonly CompletedAttempt[];
}

export interface CompletedMeetOutcome extends MeetOutcomeBase {
  readonly kind: 'total';
  /** Sum of the best successful attempt in each of the three lifts. */
  readonly total: number;
  readonly bombedLift: null;
}

/**
 * No total. A lifter who bombs a lift does not place; `bankedTotal` exists only
 * so the recap can show what was on the board when it happened.
 */
export interface BombedMeetOutcome extends MeetOutcomeBase {
  readonly kind: 'bombed-out';
  readonly total: null;
  readonly bombedLift: LiftKind;
}

export type MeetOutcome = CompletedMeetOutcome | BombedMeetOutcome;

export type MeetPhase =
  /** Waiting for the lifter to declare the weight for this attempt. */
  | { readonly kind: 'awaiting-declaration'; readonly lift: LiftKind; readonly attemptNumber: AttemptNumber }
  /** Weight declared, bar loaded, waiting on the lights. */
  | { readonly kind: 'attempt-declared'; readonly attempt: DeclaredAttempt }
  /** Meet over — either a total or a bomb-out. */
  | { readonly kind: 'complete'; readonly outcome: MeetOutcome };

export interface MeetState {
  readonly rules: MeetLoadingRules;
  readonly phase: MeetPhase;
  readonly lifts: Readonly<Record<LiftKind, LiftProgress>>;
}

// ---------------------------------------------------------------------------
// Errors and results
// ---------------------------------------------------------------------------

export type MeetErrorCode =
  | 'MEET_COMPLETE'
  | 'ATTEMPT_ALREADY_DECLARED'
  | 'NO_ATTEMPT_DECLARED'
  | 'ATTEMPT_ALREADY_RESOLVED'
  | 'WRONG_LIFT'
  | 'WRONG_ATTEMPT_NUMBER'
  | 'TOO_MANY_ATTEMPTS'
  | 'INVALID_WEIGHT'
  | 'WEIGHT_NOT_LOADABLE'
  | 'WEIGHT_DECREASED'
  | 'REPEAT_AFTER_GOOD_LIFT'
  | 'INSUFFICIENT_INCREASE'
  | 'INVALID_JUDGING_PANEL'
  | 'NO_PREVIOUS_ATTEMPT';

export interface MeetError {
  readonly code: MeetErrorCode;
  /** Plain-language reason, safe to surface to the player. */
  readonly message: string;
}

export type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: MeetError };

function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

function fail<T>(code: MeetErrorCode, message: string): Result<T> {
  return { ok: false, error: { code, message } };
}

// ---------------------------------------------------------------------------
// Weight helpers
// ---------------------------------------------------------------------------

/** Trims float noise so 2.5-increment arithmetic compares cleanly. */
function normalizeWeight(weight: number): number {
  const factor = 10 ** WEIGHT_DECIMAL_PLACES;
  return Math.round(weight * factor) / factor;
}

export type RoundingMode = 'nearest' | 'up' | 'down';

/** Snaps a weight to something that can actually be loaded on the bar. */
export function roundToLoadableWeight(
  weight: number,
  increment: number = LOADABLE_WEIGHT_INCREMENT_KG,
  mode: RoundingMode = 'nearest',
): number {
  const steps = weight / increment;
  const rounded =
    mode === 'up'
      ? Math.ceil(steps - WEIGHT_EPSILON)
      : mode === 'down'
        ? Math.floor(steps + WEIGHT_EPSILON)
        : Math.round(steps);
  return normalizeWeight(rounded * increment);
}

/** True when `weight` is a whole number of `increment`s. */
export function isLoadableWeight(weight: number, increment: number = LOADABLE_WEIGHT_INCREMENT_KG): boolean {
  const steps = weight / increment;
  return Math.abs(steps - Math.round(steps)) * increment < WEIGHT_EPSILON;
}

function isAtLeast(weight: number, minimum: number): boolean {
  return weight >= minimum - WEIGHT_EPSILON;
}

function isSameWeight(a: number, b: number): boolean {
  return Math.abs(a - b) < WEIGHT_EPSILON;
}

// ---------------------------------------------------------------------------
// Judging
// ---------------------------------------------------------------------------

export function isValidJudgePanel(lights: JudgePanel): boolean {
  if (!Array.isArray(lights) || lights.length !== JUDGE_COUNT) return false;
  return lights.every((light) => light === 'white' || light === 'red');
}

export function countWhiteLights(lights: JudgePanel): number {
  return lights.reduce<number>((count, light) => (light === 'white' ? count + 1 : count), 0);
}

/** Majority of three carries: two white lights is a good lift. */
export function isGoodLift(lights: JudgePanel): boolean {
  return countWhiteLights(lights) >= JUDGES_REQUIRED_FOR_GOOD_LIFT;
}

/**
 * A split panel — the "judges deliberating" beat in GDD §6.2 is for these.
 * Structural (any non-unanimous panel), so there is no threshold to tune.
 */
export function isSplitDecision(lights: JudgePanel): boolean {
  const white = countWhiteLights(lights);
  return white !== 0 && white !== JUDGE_COUNT;
}

// ---------------------------------------------------------------------------
// Reading a meet
// ---------------------------------------------------------------------------

/** Best successful attempt on a lift, or null if there is none. */
export function bestSuccessfulAttempt(progress: LiftProgress): number | null {
  let best: number | null = null;
  for (const attempt of progress.attempts) {
    if (attempt.status !== 'good') continue;
    if (best === null || attempt.weight > best) best = attempt.weight;
  }
  return best;
}

/** The last attempt on this lift that actually had a bar weight. */
function lastWeighedAttempt(progress: LiftProgress): JudgedAttempt | null {
  for (let i = progress.attempts.length - 1; i >= 0; i -= 1) {
    const attempt = progress.attempts[i];
    if (attempt !== undefined && attempt.status !== 'passed') return attempt;
  }
  return null;
}

function findCompletedAttempt(
  state: MeetState,
  lift: LiftKind,
  attemptNumber: AttemptNumber,
): CompletedAttempt | undefined {
  return state.lifts[lift].attempts.find((attempt) => attempt.attemptNumber === attemptNumber);
}

/** Every finished attempt across the meet, in the order they happened. */
export function allCompletedAttempts(state: MeetState): readonly CompletedAttempt[] {
  return LIFT_ORDER.flatMap((lift) => state.lifts[lift].attempts);
}

/**
 * What the lifter is allowed to declare right now, and why.
 * Returns null when no declaration is pending.
 */
export interface AttemptContext {
  readonly lift: LiftKind;
  readonly attemptNumber: AttemptNumber;
  /** Weight of the last attempt taken on this lift, or null for the opener. */
  readonly previousWeight: number | null;
  readonly previousOutcome: AttemptOutcome | null;
  /** Repeating the exact weight is legal only after a no-lift. */
  readonly mayRepeatWeight: boolean;
  /**
   * Lowest legal declaration: the repeat weight after a no-lift, otherwise the
   * minimum increase. Null on the opener, where any loadable weight goes.
   */
  readonly minimumWeight: number | null;
  /**
   * If the lifter goes UP at all, this is the smallest legal weight. Anything
   * between the previous attempt and this is not a legal jump, even after a
   * miss where the previous weight itself may be repeated.
   */
  readonly minimumIncreaseWeight: number | null;
}

export function currentAttemptContext(
  state: MeetState,
  options: { readonly recordAttempt?: boolean } = {},
): AttemptContext | null {
  if (state.phase.kind !== 'awaiting-declaration') return null;
  const { lift, attemptNumber } = state.phase;
  const previous = lastWeighedAttempt(state.lifts[lift]);
  if (previous === null) {
    return {
      lift,
      attemptNumber,
      previousWeight: null,
      previousOutcome: null,
      mayRepeatWeight: false,
      minimumWeight: null,
      minimumIncreaseWeight: null,
    };
  }
  const increment = options.recordAttempt === true ? state.rules.recordIncrement : state.rules.minIncrement;
  const mayRepeatWeight = previous.status === 'no-lift';
  const minimumIncreaseWeight = normalizeWeight(previous.weight + increment);
  return {
    lift,
    attemptNumber,
    previousWeight: previous.weight,
    previousOutcome: previous.status,
    mayRepeatWeight,
    minimumWeight: mayRepeatWeight ? previous.weight : minimumIncreaseWeight,
    minimumIncreaseWeight,
  };
}

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

function initialLiftProgress(lift: LiftKind): LiftProgress {
  return {
    lift,
    attempts: [],
    status: lift === LIFT_ORDER[0] ? 'in-progress' : 'upcoming',
    best: null,
  };
}

export function createMeet(rules: MeetLoadingRules = DEFAULT_MEET_RULES): MeetState {
  return {
    rules,
    phase: { kind: 'awaiting-declaration', lift: LIFT_ORDER[0], attemptNumber: 1 },
    lifts: {
      squat: initialLiftProgress('squat'),
      bench: initialLiftProgress('bench'),
      deadlift: initialLiftProgress('deadlift'),
    },
  };
}

function nextLiftAfter(lift: LiftKind): LiftKind | null {
  const index = LIFT_ORDER.indexOf(lift);
  return LIFT_ORDER[index + 1] ?? null;
}

function nextAttemptNumber(attemptNumber: AttemptNumber): AttemptNumber | null {
  if (attemptNumber === 1) return 2;
  if (attemptNumber === 2) return 3;
  return null;
}

function withLift(state: MeetState, lift: LiftKind, progress: LiftProgress): MeetState {
  return { ...state, lifts: { ...state.lifts, [lift]: progress } };
}

/**
 * Shared guard for declaring or passing: is this lift/attempt the one on deck?
 */
function checkTarget(
  state: MeetState,
  target: { readonly lift?: LiftKind; readonly attemptNumber?: AttemptNumber },
): MeetError | null {
  if (state.phase.kind === 'complete') {
    return { code: 'MEET_COMPLETE', message: 'The meet is over; no further attempts can be taken.' };
  }
  if (state.phase.kind === 'attempt-declared') {
    return {
      code: 'ATTEMPT_ALREADY_DECLARED',
      message: `Attempt ${state.phase.attempt.attemptNumber} on the ${state.phase.attempt.lift} is already declared and must be judged first.`,
    };
  }
  const { lift, attemptNumber } = state.phase;
  if (target.lift !== undefined && target.lift !== lift) {
    if (state.lifts[target.lift].attempts.length >= ATTEMPTS_PER_LIFT) {
      return {
        code: 'TOO_MANY_ATTEMPTS',
        message: `The ${target.lift} is finished; only ${ATTEMPTS_PER_LIFT} attempts are allowed per lift.`,
      };
    }
    return {
      code: 'WRONG_LIFT',
      message: `Lifts are contested in order (${LIFT_ORDER.join(' → ')}). The ${lift} is up, not the ${target.lift}.`,
    };
  }
  if (state.lifts[lift].attempts.length >= ATTEMPTS_PER_LIFT) {
    return {
      code: 'TOO_MANY_ATTEMPTS',
      message: `Only ${ATTEMPTS_PER_LIFT} attempts are allowed per lift.`,
    };
  }
  if (target.attemptNumber !== undefined && target.attemptNumber !== attemptNumber) {
    return {
      code: 'WRONG_ATTEMPT_NUMBER',
      message: `Attempt ${attemptNumber} on the ${lift} is up, not attempt ${target.attemptNumber}.`,
    };
  }
  return null;
}

export interface DeclareAttemptInput {
  /** Optional guard: rejected unless it matches the lift on deck. */
  readonly lift?: LiftKind;
  /** Optional guard: rejected unless it matches the attempt on deck. */
  readonly attemptNumber?: AttemptNumber;
  readonly weight: number;
  /** Declared record attempt: finer loading granularity and minimum increase. */
  readonly recordAttempt?: boolean;
}

/**
 * Declare the weight for the attempt on deck. Enforces the non-decreasing
 * invariant (see the DESIGN CONFLICT note at the top of this file).
 */
export function declareAttempt(state: MeetState, input: DeclareAttemptInput): Result<MeetState> {
  const targetError = checkTarget(state, input);
  if (targetError !== null) return { ok: false, error: targetError };
  if (state.phase.kind !== 'awaiting-declaration') {
    // Unreachable: checkTarget rejects every other phase. Kept for exhaustiveness.
    return fail('NO_ATTEMPT_DECLARED', 'No attempt is on deck.');
  }

  const { lift, attemptNumber } = state.phase;
  const recordAttempt = input.recordAttempt === true;
  const weight = input.weight;

  if (!Number.isFinite(weight) || weight <= 0) {
    return fail('INVALID_WEIGHT', 'An attempt weight must be a positive number.');
  }

  const loadableIncrement = recordAttempt ? state.rules.recordIncrement : state.rules.loadableIncrement;
  if (state.rules.enforceLoadableIncrement && !isLoadableWeight(weight, loadableIncrement)) {
    return fail(
      'WEIGHT_NOT_LOADABLE',
      `The bar can only be loaded in ${loadableIncrement} increments; ${weight} cannot be loaded.`,
    );
  }

  const context = currentAttemptContext(state, { recordAttempt });
  if (context !== null && context.previousWeight !== null) {
    const previousWeight = context.previousWeight;
    if (weight < previousWeight - WEIGHT_EPSILON) {
      return fail(
        'WEIGHT_DECREASED',
        `Attempts may not go down within a lift: ${weight} is below the previous attempt of ${previousWeight}.`,
      );
    }
    if (isSameWeight(weight, previousWeight)) {
      if (!context.mayRepeatWeight) {
        return fail(
          'REPEAT_AFTER_GOOD_LIFT',
          `A good lift at ${previousWeight} must be followed by a heavier attempt.`,
        );
      }
    } else if (context.minimumIncreaseWeight !== null && !isAtLeast(weight, context.minimumIncreaseWeight)) {
      return fail(
        'INSUFFICIENT_INCREASE',
        `The next attempt must be at least ${context.minimumIncreaseWeight}${
          context.mayRepeatWeight ? ` (or a repeat of ${previousWeight})` : ''
        }.`,
      );
    }
  }

  const attempt: DeclaredAttempt = {
    lift,
    attemptNumber,
    weight: normalizeWeight(weight),
    recordAttempt,
    status: 'declared',
  };
  return ok({ ...state, phase: { kind: 'attempt-declared', attempt } });
}

export interface PassAttemptInput {
  readonly lift?: LiftKind;
  readonly attemptNumber?: AttemptNumber;
}

/**
 * Forfeit the attempt on deck without taking the bar. A passed attempt is used
 * up: it never counts toward the total, and passing all three on a lift leaves
 * the lifter with no total exactly as three misses would.
 */
export function passAttempt(state: MeetState, input: PassAttemptInput = {}): Result<MeetState> {
  const targetError = checkTarget(state, input);
  if (targetError !== null) return { ok: false, error: targetError };
  if (state.phase.kind !== 'awaiting-declaration') {
    return fail('NO_ATTEMPT_DECLARED', 'No attempt is on deck.');
  }
  const { lift, attemptNumber } = state.phase;
  const passed: PassedAttempt = { lift, attemptNumber, status: 'passed' };
  return ok(advanceAfterAttempt(state, lift, passed));
}

export interface ResolveAttemptInput {
  /** Optional guard: rejected unless it matches the declared attempt. */
  readonly lift?: LiftKind;
  /** Optional guard: rejected unless it matches the declared attempt. */
  readonly attemptNumber?: AttemptNumber;
  /** The three lights, as decided outside this module. */
  readonly lights: JudgePanel;
}

/**
 * Apply the referees' decision to the declared attempt and move the meet on.
 * The judging outcome is an input, never rolled here — see the purity contract.
 */
export function resolveAttempt(state: MeetState, input: ResolveAttemptInput): Result<MeetState> {
  if (input.lift !== undefined && input.attemptNumber !== undefined) {
    const already = findCompletedAttempt(state, input.lift, input.attemptNumber);
    if (already !== undefined) {
      return fail(
        'ATTEMPT_ALREADY_RESOLVED',
        `Attempt ${input.attemptNumber} on the ${input.lift} has already been judged.`,
      );
    }
  }
  if (state.phase.kind === 'complete') {
    return fail('MEET_COMPLETE', 'The meet is over; no further attempts can be judged.');
  }
  if (state.phase.kind === 'awaiting-declaration') {
    return fail('NO_ATTEMPT_DECLARED', 'No attempt has been declared, so there is nothing to judge.');
  }

  const declared = state.phase.attempt;
  if (input.lift !== undefined && input.lift !== declared.lift) {
    return fail('WRONG_LIFT', `The declared attempt is on the ${declared.lift}, not the ${input.lift}.`);
  }
  if (input.attemptNumber !== undefined && input.attemptNumber !== declared.attemptNumber) {
    return fail(
      'WRONG_ATTEMPT_NUMBER',
      `The declared attempt is number ${declared.attemptNumber}, not ${input.attemptNumber}.`,
    );
  }
  if (!isValidJudgePanel(input.lights)) {
    return fail('INVALID_JUDGING_PANEL', `Judging requires exactly ${JUDGE_COUNT} red/white lights.`);
  }

  const whiteLights = countWhiteLights(input.lights);
  const judged: JudgedAttempt = {
    lift: declared.lift,
    attemptNumber: declared.attemptNumber,
    weight: declared.weight,
    recordAttempt: declared.recordAttempt,
    status: isGoodLift(input.lights) ? 'good' : 'no-lift',
    lights: input.lights,
    whiteLights,
    unanimous: whiteLights === 0 || whiteLights === JUDGE_COUNT,
  };
  return ok(advanceAfterAttempt(state, declared.lift, judged));
}

/** Records a finished attempt and works out what happens next. */
function advanceAfterAttempt(state: MeetState, lift: LiftKind, attempt: CompletedAttempt): MeetState {
  const previous = state.lifts[lift];
  const attempts = [...previous.attempts, attempt];
  const withAttempt: LiftProgress = { ...previous, attempts, best: null };
  const best = bestSuccessfulAttempt(withAttempt);

  const following = nextAttemptNumber(attempt.attemptNumber);
  if (attempts.length < ATTEMPTS_PER_LIFT && following !== null) {
    const progress: LiftProgress = { ...withAttempt, status: 'in-progress', best };
    return {
      ...withLift(state, lift, progress),
      phase: { kind: 'awaiting-declaration', lift, attemptNumber: following },
    };
  }

  // The lift is finished.
  if (best === null) {
    // Bombed out: no total, and per GDD §6.3 the meet ends here.
    const progress: LiftProgress = { ...withAttempt, status: 'bombed', best: null };
    const bombed = withLift(state, lift, progress);
    const remaining = LIFT_ORDER.slice(LIFT_ORDER.indexOf(lift) + 1);
    const finalState = remaining.reduce<MeetState>(
      (acc, upcoming) => withLift(acc, upcoming, { ...acc.lifts[upcoming], status: 'not-contested' }),
      bombed,
    );
    return { ...finalState, phase: { kind: 'complete', outcome: buildBombedOutcome(finalState, lift) } };
  }

  const progress: LiftProgress = { ...withAttempt, status: 'complete', best };
  const advanced = withLift(state, lift, progress);
  const next = nextLiftAfter(lift);
  if (next === null) {
    return { ...advanced, phase: { kind: 'complete', outcome: buildCompletedOutcome(advanced) } };
  }
  const started = withLift(advanced, next, { ...advanced.lifts[next], status: 'in-progress' });
  return { ...started, phase: { kind: 'awaiting-declaration', lift: next, attemptNumber: 1 } };
}

function bestByLift(state: MeetState): Readonly<Record<LiftKind, number | null>> {
  return {
    squat: state.lifts.squat.best,
    bench: state.lifts.bench.best,
    deadlift: state.lifts.deadlift.best,
  };
}

function sumBests(bests: Readonly<Record<LiftKind, number | null>>): number {
  return normalizeWeight(LIFT_ORDER.reduce<number>((sum, lift) => sum + (bests[lift] ?? 0), 0));
}

function buildCompletedOutcome(state: MeetState): CompletedMeetOutcome {
  const bests = bestByLift(state);
  const total = sumBests(bests);
  return {
    kind: 'total',
    total,
    bombedLift: null,
    bestByLift: bests,
    bankedTotal: total,
    attempts: allCompletedAttempts(state),
  };
}

function buildBombedOutcome(state: MeetState, bombedLift: LiftKind): BombedMeetOutcome {
  const bests = bestByLift(state);
  return {
    kind: 'bombed-out',
    total: null,
    bombedLift,
    bestByLift: bests,
    bankedTotal: sumBests(bests),
    attempts: allCompletedAttempts(state),
  };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Total = sum of the best successful attempt in each lift.
 * Returns null when any contested lift was bombed — a bombed lifter has NO
 * total, which is not the same as a total of zero.
 */
export function meetTotal(state: MeetState): number | null {
  const bests = bestByLift(state);
  const bombed = LIFT_ORDER.some((lift) => state.lifts[lift].status === 'bombed');
  if (bombed) return null;
  if (LIFT_ORDER.some((lift) => bests[lift] === null)) return null;
  return sumBests(bests);
}

/** Sum of the bests on the board so far, whether or not the meet finished. */
export function bankedTotal(state: MeetState): number {
  return sumBests(bestByLift(state));
}

/** The finished meet's outcome, or null while it is still running. */
export function meetOutcome(state: MeetState): MeetOutcome | null {
  return state.phase.kind === 'complete' ? state.phase.outcome : null;
}

export function isMeetComplete(state: MeetState): boolean {
  return state.phase.kind === 'complete';
}

export function isBombedOut(state: MeetState): boolean {
  return state.phase.kind === 'complete' && state.phase.outcome.kind === 'bombed-out';
}

// ---------------------------------------------------------------------------
// Attempt selection (GDD §6.3)
// ---------------------------------------------------------------------------

export type ProgressiveAttemptStrategy = 'conservative' | 'standard' | 'aggressive';

/**
 * There is deliberately no "drop down" strategy — within a lift the bar never
 * goes down. See the DESIGN CONFLICT note at the top of this file.
 */
export type AttemptStrategy = ProgressiveAttemptStrategy | 'repeat';

/**
 * Suggest a legal weight for the attempt on deck. Never returns a weight the
 * engine would reject.
 */
export function suggestNextAttempt(state: MeetState, strategy: AttemptStrategy): Result<number> {
  const context = currentAttemptContext(state);
  if (context === null) {
    return fail('NO_ATTEMPT_DECLARED', 'No attempt is on deck to suggest a weight for.');
  }
  if (context.previousWeight === null) {
    return fail('NO_PREVIOUS_ATTEMPT', 'This is an opening attempt; use suggestOpener instead.');
  }
  const previousWeight = context.previousWeight;

  if (strategy === 'repeat') {
    if (!context.mayRepeatWeight) {
      return fail('REPEAT_AFTER_GOOD_LIFT', `A good lift at ${previousWeight} must be followed by a heavier attempt.`);
    }
    return ok(previousWeight);
  }

  const minimum = context.minimumIncreaseWeight ?? normalizeWeight(previousWeight + state.rules.minIncrement);
  const jumped = previousWeight * (1 + ATTEMPT_JUMP_FRACTION[context.lift][strategy]);
  const rounded = roundToLoadableWeight(jumped, state.rules.loadableIncrement, 'up');
  if (isAtLeast(rounded, minimum)) return ok(rounded);
  return ok(roundToLoadableWeight(minimum, state.rules.loadableIncrement, 'up'));
}

/**
 * Suggested opening attempt from a one-rep-max estimate (GDD §6.1).
 * `oneRepMax` is supplied by the caller — this module does not compute e1RM.
 * Rounds down, because an opener you miss is how meets go wrong.
 */
export function suggestOpener(
  lift: LiftKind,
  oneRepMax: number,
  rules: MeetLoadingRules = DEFAULT_MEET_RULES,
): Result<number> {
  if (!Number.isFinite(oneRepMax) || oneRepMax <= 0) {
    return fail('INVALID_WEIGHT', 'A one-rep-max estimate must be a positive number.');
  }
  const target = oneRepMax * OPENER_FRACTION_OF_1RM[lift];
  const rounded = roundToLoadableWeight(target, rules.loadableIncrement, 'down');
  if (rounded <= 0) return ok(roundToLoadableWeight(rules.loadableIncrement, rules.loadableIncrement, 'up'));
  return ok(rounded);
}
