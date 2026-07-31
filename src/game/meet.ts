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
 *   - Every transition returns a new state; inputs are never mutated, and every
 *     array or object the caller hands in is COPIED before it is stored, so a
 *     caller mutating its own object afterwards cannot reach into meet state.
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
 *   - The bar must be loadable. Loadable means two things, both enforced:
 *     it is not lighter than the bar and collars alone, and the load above the
 *     bar is a whole number of the federation's smallest plate pair. Both come
 *     from `MeetLoadingRules`, which is fixed for the whole meet at
 *     `createMeet` — there is no per-attempt way to relax either one.
 *
 * ---------------------------------------------------------------------------
 * SOURCING — WHAT IS CITED HERE AND WHAT IS NOT
 * ---------------------------------------------------------------------------
 * No primary federation rulebook was reachable from the environment this module
 * was written in — review reports that the IPF, USAPL and USPA sites all refuse
 * the request as a matter of egress policy, and that was not re-tested here.
 * Nothing below is presented as a quotation of a rulebook, and no number here
 * should be read as "the IPF says so".
 *
 * What WAS actually retrieved (2026-07-31) is OpenLifter, the open-source meet
 * software published by the OpenPowerlifting project and used to run real
 * competitions — https://gitlab.com/openpowerlifting/openlifter :
 *
 *   - `src/reducers/meetReducer.ts`:
 *       `const defaultBarAndCollarsWeightKg = 25; // Assuming metal 2.5kg collars.`
 *       `const defaultBarAndCollarsWeightLbs = 45; // Assuming plastic collars.`
 *       ...with `squatBarAndCollarsWeightKg`, `benchBarAndCollarsWeightKg` and
 *       `deadliftBarAndCollarsWeightKg` all defaulting to it. That is the source
 *       of MIN_LOADABLE_WEIGHT_KG and of the decision to make the bar weight
 *       per-lift and federation-configurable.
 *       Its default kg plate set is commented "allowing for increments of
 *       0.5kg" — the fine discs are normal meet equipment, which is why fine
 *       loading is a meet-level rule here and not a per-attempt exception.
 *   - `src/components/lifting/AttemptInput.tsx` (`validate()`): a weight lower
 *     than a previous attempt is an ERROR; repeating a weight that was already
 *     lifted successfully is an ERROR; and `asNumber % 2.5 !== 0` is a
 *     WARNING, not an error. It carries no "record attempt" flag at all.
 *
 * That is a secondary source — one project's reading of the rules, not the
 * rules. Treat every constant below as a tunable federation setting rather than
 * a verified rulebook value. In particular the 2.5 kg *minimum increase between
 * attempts* is widely-repeated federation lore that could not be verified here
 * at all, which is why it lives in `MeetLoadingRules.minIncrement` and is not
 * claimed to be universal.
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
 * ---------------------------------------------------------------------------
 * REMOVED FEATURE — `recordAttempt`. Read before re-adding it.
 * ---------------------------------------------------------------------------
 * An earlier version of this module took a per-attempt `recordAttempt` boolean
 * that dropped BOTH the loading granularity and the minimum increase to 0.5 kg,
 * measured from the lifter's own previous attempt. Nothing validated the flag,
 * so its only effect was to switch two invariants off on request: `declare 200
 * good` then `declare 201 recordAttempt: true` was accepted, and 201 went into
 * the total.
 *
 * It has been removed rather than repaired, for two reasons:
 *
 *   1. The rule it claimed to implement is anchored to the wrong thing. Review
 *      reports that the fine discs exist so a lifter can call a weight above a
 *      STANDING RECORD, not above whatever they personally just lifted. That
 *      correction could not be confirmed here against a primary rulebook (see
 *      the sourcing note) — so this module does not assert the corrected rule
 *      either. It stops implementing a rule it cannot state truthfully. For
 *      what it is worth, the retrieved meet software (OpenLifter) carries no
 *      per-attempt record flag at all.
 *   2. Even with the anchor corrected, this engine cannot check it. A record
 *      attempt's legality depends on a standing record in a specific
 *      federation, division, weight class and age group. This module holds one
 *      lifter's card and none of that context, and the GDD does not model
 *      records anywhere (§6.4 scores a meet by Total and DOTS; §6.5's "PR
 *      call-outs" are the player's own bests, computed elsewhere). Taking a
 *      caller-supplied `recordToBeat` would move the fabrication up one level,
 *      not remove it.
 *
 * Federation records are therefore an explicit NON-GOAL (below). A federation
 * that really does load to 0.5 kg says so once, for the whole meet, in
 * `MeetLoadingRules.loadableIncrement`. It is never a per-attempt claim, and
 * nothing a caller passes to `declareAttempt` can loosen a loading rule.
 * ---------------------------------------------------------------------------
 *
 * DELIBERATE NON-GOALS (so their absence is not mistaken for an error):
 *   - Federation, national or world RECORDS of any kind: no record table, no
 *     record-attempt validation, no record call-outs. See the note above.
 *   - Multi-lifter flights, attempt (bar-loading) order within a flight, and
 *     live placing — GDD §6.6. This engine is one lifter's card.
 *   - Attempt-card changes at the scoring table (feds allow a limited number of
 *     weight changes on a declared attempt). The UI should collect the final
 *     declaration before calling `declareAttempt`.
 *   - Out-of-competition fourth attempts: they do not affect the total and are
 *     not modelled.
 *   - Exact plate math (which discs go on the bar, in what order). Loadability
 *     is modelled as "bar and collars, plus a whole number of the smallest
 *     plate pair", which is the constraint attempt selection needs; the bar-load
 *     display can compute the actual discs from the weight.
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
// Weights are unit-agnostic numbers. The defaults below are kg values matching
// the metric defaults in the retrieved OpenLifter source (GDD §11 leaves the
// display-unit default open); an lb-based federation swaps in its own
// `MeetLoadingRules` — OpenLifter's lb default for the same field is 45.
// ---------------------------------------------------------------------------

/** Three attempts per lift. Structural rule of the sport, not a tuning knob. */
export const ATTEMPTS_PER_LIFT = 3;

/** Referees on the panel. Structural. */
export const JUDGE_COUNT = 3;

/** White lights needed for a good lift — a majority of three. Structural. */
export const JUDGES_REQUIRED_FOR_GOOD_LIFT = 2;

/**
 * The competition bar itself, with nothing on it.
 * DERIVED, NOT CITED: the retrieved source gives only the bar-and-collars total
 * (25) and says it assumes 2.5 kg metal collars. 20 is what is left over.
 */
export const COMPETITION_BAR_WEIGHT_KG = 20;

/** Both collars together — 2.5 kg each, per that same comment. */
export const COLLAR_PAIR_WEIGHT_KG = 5;

/**
 * The lightest thing that can be on the platform: bar plus collars, no plates.
 * Nothing below this can be declared, and no suggestion may fall under it.
 * Matches OpenLifter's `defaultBarAndCollarsWeightKg = 25` (see sourcing note).
 */
export const MIN_LOADABLE_WEIGHT_KG = COMPETITION_BAR_WEIGHT_KG + COLLAR_PAIR_WEIGHT_KG;

/** Smallest legal increase between two attempts on the same lift. */
export const MIN_ATTEMPT_INCREMENT_KG = 2.5;

/**
 * Granularity the bar can be loaded to ABOVE the bar-and-collars weight — i.e.
 * twice the smallest plate the meet stocks a pair of. 2.5 kg is a pair of
 * 1.25 kg discs; a meet stocking 0.25 kg discs sets this to 0.5.
 */
export const LOADABLE_WEIGHT_INCREMENT_KG = 2.5;

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
}

/** Taken and judged. */
export interface JudgedAttempt extends AttemptIdentity {
  readonly status: AttemptOutcome;
  readonly weight: number;
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

/**
 * Federation-configurable loading rules. Fixed for the whole meet at
 * `createMeet`. Deliberately has no per-attempt escape hatch: if a rule can be
 * relaxed, it is relaxed for every attempt of the meet, visibly, in one place.
 */
export interface MeetLoadingRules {
  /**
   * Weight of the bar and collars with no plates, per lift. Per-lift because
   * some meets run a different bar for one of the three (OpenLifter carries
   * `squat`/`bench`/`deadliftBarAndCollarsWeightKg` separately). This is also
   * the minimum declarable weight.
   */
  readonly barAndCollarsWeight: Readonly<Record<LiftKind, number>>;
  /** Minimum legal increase between attempts on the same lift. */
  readonly minIncrement: number;
  /** Granularity the bar can be loaded to above `barAndCollarsWeight`. */
  readonly loadableIncrement: number;
}

export const DEFAULT_MEET_RULES: MeetLoadingRules = {
  barAndCollarsWeight: {
    squat: MIN_LOADABLE_WEIGHT_KG,
    bench: MIN_LOADABLE_WEIGHT_KG,
    deadlift: MIN_LOADABLE_WEIGHT_KG,
  },
  minIncrement: MIN_ATTEMPT_INCREMENT_KG,
  loadableIncrement: LOADABLE_WEIGHT_INCREMENT_KG,
};

interface MeetOutcomeBase {
  /** Best good lift per lift; null where a lift was bombed or never contested. */
  readonly bestByLift: Readonly<Record<LiftKind, number | null>>;
  /**
   * Sum of the bests actually achieved. On a completed meet this equals
   * `total`; on a bomb-out it is what was on the board when it ended, which is
   * NOT a total (see `TotalReading`).
   */
  readonly totalOnTheBoard: number;
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
 * No total. A lifter who bombs a lift does not place; `totalOnTheBoard` exists
 * only so the recap can show what was up when it happened.
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
  | 'WEIGHT_BELOW_BAR'
  | 'WEIGHT_NOT_LOADABLE'
  | 'WEIGHT_DECREASED'
  | 'REPEAT_AFTER_GOOD_LIFT'
  | 'INSUFFICIENT_INCREASE'
  | 'INVALID_JUDGING_PANEL'
  | 'INVALID_MEET_RULES'
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

/**
 * Snaps a weight to a whole number of `increment`s. This is pure granularity
 * arithmetic and knows nothing about the bar — for anything that has to go on
 * a platform use `roundToLoadableAttemptWeight`, which also honours the bar and
 * collars.
 */
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

/** True when `weight` is a whole number of `increment`s. Granularity only. */
export function isLoadableWeight(weight: number, increment: number = LOADABLE_WEIGHT_INCREMENT_KG): boolean {
  if (!Number.isFinite(weight) || !Number.isFinite(increment) || increment <= 0) return false;
  const steps = weight / increment;
  return Math.abs(steps - Math.round(steps)) * increment < WEIGHT_EPSILON;
}

function isAtLeast(weight: number, minimum: number): boolean {
  return weight >= minimum - WEIGHT_EPSILON;
}

function isSameWeight(a: number, b: number): boolean {
  return Math.abs(a - b) < WEIGHT_EPSILON;
}

/** The bar and collars for this lift: the lightest declarable weight. */
export function minimumAttemptWeight(lift: LiftKind, rules: MeetLoadingRules = DEFAULT_MEET_RULES): number {
  return rules.barAndCollarsWeight[lift];
}

/**
 * Can this weight actually be on the bar? Both halves of the rule at once:
 * at least bar-and-collars, and a whole number of plate pairs above it.
 */
export function isLoadableAttemptWeight(
  weight: number,
  lift: LiftKind,
  rules: MeetLoadingRules = DEFAULT_MEET_RULES,
): boolean {
  const minimum = minimumAttemptWeight(lift, rules);
  if (!Number.isFinite(weight) || !isAtLeast(weight, minimum)) return false;
  return isLoadableWeight(normalizeWeight(weight - minimum), rules.loadableIncrement);
}

/**
 * Snaps a weight to something that can actually go on the platform for this
 * lift. Never returns less than bar-and-collars, whatever the rounding mode.
 */
export function roundToLoadableAttemptWeight(
  weight: number,
  lift: LiftKind,
  rules: MeetLoadingRules = DEFAULT_MEET_RULES,
  mode: RoundingMode = 'nearest',
): number {
  const minimum = minimumAttemptWeight(lift, rules);
  if (!Number.isFinite(weight) || weight <= minimum + WEIGHT_EPSILON) return normalizeWeight(minimum);
  const above = roundToLoadableWeight(weight - minimum, rules.loadableIncrement, mode);
  return normalizeWeight(minimum + Math.max(above, 0));
}

/**
 * Are these rules usable at all? Nonsense configuration must fail loudly at the
 * point of use rather than quietly disabling a loading check.
 */
export function validateMeetRules(rules: MeetLoadingRules): MeetError | null {
  if (!Number.isFinite(rules.loadableIncrement) || rules.loadableIncrement <= 0) {
    return { code: 'INVALID_MEET_RULES', message: 'The loadable increment must be a positive number.' };
  }
  if (!Number.isFinite(rules.minIncrement) || rules.minIncrement <= 0) {
    return { code: 'INVALID_MEET_RULES', message: 'The minimum attempt increase must be a positive number.' };
  }
  for (const lift of LIFT_ORDER) {
    const barWeight = rules.barAndCollarsWeight[lift];
    if (!Number.isFinite(barWeight) || barWeight <= 0) {
      return {
        code: 'INVALID_MEET_RULES',
        message: `The ${lift} bar and collars must weigh a positive number.`,
      };
    }
  }
  return null;
}

/** Defensive copy: meet state must not alias a caller-owned rules object. */
function copyRules(rules: MeetLoadingRules): MeetLoadingRules {
  return {
    barAndCollarsWeight: {
      squat: rules.barAndCollarsWeight.squat,
      bench: rules.barAndCollarsWeight.bench,
      deadlift: rules.barAndCollarsWeight.deadlift,
    },
    minIncrement: rules.minIncrement,
    loadableIncrement: rules.loadableIncrement,
  };
}

// ---------------------------------------------------------------------------
// Judging
// ---------------------------------------------------------------------------

export function isValidJudgePanel(lights: JudgePanel): boolean {
  if (!Array.isArray(lights) || lights.length !== JUDGE_COUNT) return false;
  return lights.every((light) => light === 'white' || light === 'red');
}

/** Defensive copy: a judged attempt must not alias the caller's array. */
function copyJudgePanel(lights: JudgePanel): JudgePanel {
  return [lights[0], lights[1], lights[2]];
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
   * Lowest legal declaration. On the opener that is the bar and collars; after
   * a no-lift it is the repeat weight; after a good lift it is the minimum
   * increase. Never null — there is always a floor.
   */
  readonly minimumWeight: number;
  /**
   * If the lifter goes UP at all, this is the smallest legal weight. Anything
   * between the previous attempt and this is not a legal jump, even after a
   * miss where the previous weight itself may be repeated. Null on the opener,
   * where there is nothing to increase from.
   */
  readonly minimumIncreaseWeight: number | null;
}

export function currentAttemptContext(state: MeetState): AttemptContext | null {
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
      minimumWeight: minimumAttemptWeight(lift, state.rules),
      minimumIncreaseWeight: null,
    };
  }
  const mayRepeatWeight = previous.status === 'no-lift';
  // Rounded up so the number handed to the UI is one the bar can actually take.
  const minimumIncreaseWeight = roundToLoadableAttemptWeight(
    previous.weight + state.rules.minIncrement,
    lift,
    state.rules,
    'up',
  );
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
    rules: copyRules(rules),
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
  // NOTE: there is deliberately no flag here that loosens a loading rule. See
  // the REMOVED FEATURE note at the top of this file before adding one.
}

/**
 * Declare the weight for the attempt on deck. Enforces the non-decreasing
 * invariant (see the DESIGN CONFLICT note at the top of this file) and both
 * halves of loadability. Nothing in `input` can switch either off.
 */
export function declareAttempt(state: MeetState, input: DeclareAttemptInput): Result<MeetState> {
  const targetError = checkTarget(state, input);
  if (targetError !== null) return { ok: false, error: targetError };
  if (state.phase.kind !== 'awaiting-declaration') {
    // Unreachable: checkTarget rejects every other phase. Kept for exhaustiveness.
    return fail('NO_ATTEMPT_DECLARED', 'No attempt is on deck.');
  }
  const rulesError = validateMeetRules(state.rules);
  if (rulesError !== null) return { ok: false, error: rulesError };

  const { lift, attemptNumber } = state.phase;
  const weight = input.weight;

  if (!Number.isFinite(weight) || weight <= 0) {
    return fail('INVALID_WEIGHT', 'An attempt weight must be a positive number.');
  }

  const minimum = minimumAttemptWeight(lift, state.rules);
  if (!isAtLeast(weight, minimum)) {
    return fail(
      'WEIGHT_BELOW_BAR',
      `The ${lift} bar and collars already weigh ${minimum}; ${weight} cannot be loaded.`,
    );
  }
  if (!isLoadableAttemptWeight(weight, lift, state.rules)) {
    return fail(
      'WEIGHT_NOT_LOADABLE',
      `Above the ${minimum} bar the plates only load in ${state.rules.loadableIncrement} increments; ${weight} cannot be loaded.`,
    );
  }

  const context = currentAttemptContext(state);
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
  /** The three lights, as decided outside this module. Copied, never aliased. */
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

  // Copied, not stored by reference: `readonly` is compile-time only, and a
  // caller that keeps and mutates its own array must not be able to rewrite a
  // judged attempt after the fact.
  const lights = copyJudgePanel(input.lights);
  const whiteLights = countWhiteLights(lights);
  const judged: JudgedAttempt = {
    lift: declared.lift,
    attemptNumber: declared.attemptNumber,
    weight: declared.weight,
    status: isGoodLift(lights) ? 'good' : 'no-lift',
    lights,
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
    totalOnTheBoard: total,
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
    totalOnTheBoard: sumBests(bests),
    attempts: allCompletedAttempts(state),
  };
}

// ---------------------------------------------------------------------------
// Scoring
//
// The running sum and the official total are DIFFERENT NUMBERS and are never
// returned by the same accessor. A meet with one good lift on each of the three
// lifts and a deadlift attempt still to come has a sum — it does not have a
// total. `readTotal` forces a caller to say which one it wants: `total` is a
// number only in the 'final' case, so a mid-meet sum cannot be rendered as a
// result by accident.
// ---------------------------------------------------------------------------

export type TotalReading =
  /** Still lifting. There is no total yet, only what is on the board. */
  | { readonly kind: 'in-progress'; readonly total: null; readonly totalOnTheBoard: number }
  /** Meet over with a total. This is the official number. */
  | { readonly kind: 'final'; readonly total: number; readonly totalOnTheBoard: number }
  /** Meet over with a bombed lift: NO total, which is not a total of zero. */
  | {
      readonly kind: 'no-total';
      readonly total: null;
      readonly totalOnTheBoard: number;
      readonly bombedLift: LiftKind;
    };

/** The one accessor that can tell you whether a total is final. */
export function readTotal(state: MeetState): TotalReading {
  const onTheBoard = sumBests(bestByLift(state));
  if (state.phase.kind !== 'complete') {
    return { kind: 'in-progress', total: null, totalOnTheBoard: onTheBoard };
  }
  const outcome = state.phase.outcome;
  if (outcome.kind === 'bombed-out') {
    return {
      kind: 'no-total',
      total: null,
      totalOnTheBoard: outcome.totalOnTheBoard,
      bombedLift: outcome.bombedLift,
    };
  }
  return { kind: 'final', total: outcome.total, totalOnTheBoard: outcome.totalOnTheBoard };
}

/**
 * The meet's official total = sum of the best successful attempt in each lift.
 * Null until the meet is actually over, and null forever if a lift was bombed —
 * a bombed lifter has NO total, which is not the same as a total of zero.
 * There is no way to get a provisional number out of this function.
 */
export function finalMeetTotal(state: MeetState): number | null {
  return readTotal(state).total;
}

/**
 * Sum of the bests on the board so far. PROVISIONAL while the meet is running,
 * and NOT a result: a bombed lifter can have a large number here and no total.
 * Use it for the live scoreboard, never for a placing or a shareable card.
 */
export function totalOnTheBoard(state: MeetState): number {
  return readTotal(state).totalOnTheBoard;
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
  const rulesError = validateMeetRules(state.rules);
  if (rulesError !== null) return { ok: false, error: rulesError };
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

  const minimum =
    context.minimumIncreaseWeight ??
    roundToLoadableAttemptWeight(previousWeight + state.rules.minIncrement, context.lift, state.rules, 'up');
  const jumped = previousWeight * (1 + ATTEMPT_JUMP_FRACTION[context.lift][strategy]);
  const rounded = roundToLoadableAttemptWeight(jumped, context.lift, state.rules, 'up');
  if (isAtLeast(rounded, minimum)) return ok(rounded);
  return ok(minimum);
}

/**
 * Suggested opening attempt from a one-rep-max estimate (GDD §6.1).
 * `oneRepMax` is supplied by the caller — this module does not compute e1RM.
 * Rounds down, because an opener you miss is how meets go wrong, but never
 * below the bar and collars: there is no such thing as a lighter attempt.
 */
export function suggestOpener(
  lift: LiftKind,
  oneRepMax: number,
  rules: MeetLoadingRules = DEFAULT_MEET_RULES,
): Result<number> {
  const rulesError = validateMeetRules(rules);
  if (rulesError !== null) return { ok: false, error: rulesError };
  if (!Number.isFinite(oneRepMax) || oneRepMax <= 0) {
    return fail('INVALID_WEIGHT', 'A one-rep-max estimate must be a positive number.');
  }
  const target = oneRepMax * OPENER_FRACTION_OF_1RM[lift];
  return ok(roundToLoadableAttemptWeight(target, lift, rules, 'down'));
}
