/**
 * empireCore.ts — the shared vocabulary for GDD §5, and the seam that keeps the
 * idle layer out of Sim progression.
 *
 * Pure module (CLAUDE.md, "Pure logic is separate from UI"): zero React, zero
 * side effects, zero I/O, no clock and no randomness. Time is a parameter. Its
 * one import is `./empireTuning`, so every number it uses is named and in one
 * place; `empireCore.test.ts` runs the repository's own magic-number audit over
 * this directory to keep that true rather than asked for.
 *
 * ===========================================================================
 * 1. The two hazards this file exists to make unrepresentable
 * ===========================================================================
 *
 * GDD §8.1 and §12.3 refuse anything purchasable that affects Total, e1RM,
 * training pace or meet performance. §5 composes two paths straight through
 * that line, and both are purchasable in the document as written:
 *
 *   Hazard 1.  §8.3B sells "Gym Empire build and recruit timer skips", and
 *              `progression.ts` already ships the grant id
 *              `'gym-empire-timer-skip'`. §5.2 has the empire paying a Training
 *              IQ trickle, and §2 makes Training IQ the stat that decides
 *              growth rate and long-term ceiling. A purchase that makes a
 *              recruit land sooner therefore moves training pace in two hops.
 *
 *   Hazard 2.  §5.4 wants "Physio reduces Sim injury duration" as a cross-mode
 *              hook. A purchased skip on a staff build makes physio arrive
 *              sooner, and a shorter setback is training pace by another name.
 *
 * GDD §4.4 records what "structurally unable" has to mean, and that it has two
 * readings and the rule means both: the accelerated path is not constructible
 * (a type error, not a runtime branch), and the output does not move with the
 * purchase (an assertion on the output itself, at every horizon). This file is
 * the first reading. Piece E6 owns the second; §6 below says what it has to
 * assert and what this file gives it to assert it with.
 *
 * ===========================================================================
 * 2. Why the gating hangs off arrival and sink rather than off names
 * ===========================================================================
 *
 * `src/game/currencyProvenance.ts` is the precedent and this file copies its
 * shape deliberately. There, a tender declares how its units ARRIVED and the
 * verdict is looked up from the arrival, so `'chalk-achievement'` and
 * `'chalk-season-pass-tier'` are one row and closing one closes both by
 * construction. The alternative — one verdict per tender — is how the
 * achievement path got closed while the season-pass path stayed open, two
 * parallel judgements about the same shape.
 *
 * Here there are two such axes and they meet in the middle:
 *
 *   - An OUTPUT declares the SINK it feeds, and the reach is looked up from
 *     the sink. `'training-iq'` and `'physio-days-saved'` both feed
 *     `'training-pace'`, so hazard 1 and hazard 2 are one row. A third output
 *     that touched e1RM, Total or meet performance would be the same row
 *     again, because `'training-pace'` is GDD §8.1's whole phrase and not just
 *     one of its four nouns.
 *   - An ACCELERANT declares the ARRIVAL it came by, and its licence is looked
 *     up from the arrival. A bought skip and a rewarded-ad skip both arrive by
 *     `'store-purchase'`, so they are one row too. That is the conservative
 *     reading of §8.3D on purpose: an opt-in ad is monetisation, and a rule
 *     that treats it as free money is a rule with a spare seat in it.
 *
 * Adding an output costs a sink. Adding a sink costs a reach verdict. Adding
 * an accelerant costs an arrival, and adding an arrival costs a licence. There
 * is no path that adds a purchasable accelerant on a progression-reaching
 * output without a human writing a verdict next to it.
 *
 * ===========================================================================
 * 3. The type is the enforcement
 * ===========================================================================
 *
 * `AccelerableOutput<A>` is DERIVED from the two tables by a mapped filter, the
 * way `NonTrainingGatedTender` is derived, so it is not a second hand-written
 * list that can drift from the first. `AppliedAccelerant` — the thing an
 * `EmpireState` actually holds — is a mapped union over accelerants whose
 * `output` field is that filter, so:
 *
 *     { accelerant: 'gym-empire-timer-skip', output: 'training-iq', ... }
 *
 * does not typecheck. Making it compile requires editing a verdict in a table
 * that has this header printed above it. `mayAccelerate` is the runtime
 * shadow, for the callers TypeScript never sees: a settled order arrives from
 * an Edge Function as JSON, and JSON has no types.
 *
 * ===========================================================================
 * 4. The clock split, which is what makes the ban survivable
 * ===========================================================================
 *
 * A ban on accelerating Training IQ is not enough on its own, and the reason is
 * worth stating because it is the whole design decision in this piece.
 *
 * §5.2 pays IQ per roster lifter, and §8.3B sells a RECRUIT skip. Nothing about
 * that sale touches an IQ rate — it lands a lifter sooner, and the lifter pays
 * IQ. So a rule phrased as "no accelerant multiplies the trickle" is satisfied
 * by an engine that plainly sells training pace.
 *
 * The resolution here is two clocks, and it narrows neither §5.2 nor §8.3B:
 *
 *   - `EmpireClock.accelerated` is wall time plus every skip ever applied.
 *     The Gym Bucks economy, the roster, cosmetics and the expansion axes run
 *     on it, so a bought skip does what §8.3B sells — the lifter is on the
 *     roster now, customisable now, earning now.
 *   - `EmpireClock.unaccelerated` is wall time, and nothing writes to it.
 *     Training IQ and the physio hook run on it, so the IQ a lifter has
 *     contributed at any wall-clock moment is what it would have been with no
 *     purchase at all.
 *
 * The two are different branded types, so a rate that takes
 * `UnacceleratedSeconds` refuses `AcceleratedSeconds` at compile time and
 * `elapsedFor` hands each output the clock its reach entitles it to. §5.2 still
 * pays IQ "based on tier and tenure"; what the split changes is that the tenure
 * the IQ half reads is measured from `NpcLifter.settledAt`, the moment the
 * recruit would have completed unaided.
 *
 * This is a design decision rather than a transcription, and it is reported as
 * one. A human may prefer a different resolution — a flat calendar-keyed
 * trickle with no roster term, or narrowing §8.3B so recruit timers are not
 * for sale. Both close the hazard and both cost more of §5 than this does.
 *
 * ===========================================================================
 * 5. What the empire may not pay at all
 * ===========================================================================
 *
 * `EMPIRE_FORBIDDEN_OUTPUTS` names the things the idle layer must not be able
 * to produce, and it names them rather than leaving them out. GDD §8.3E's
 * condition 3 rules out "true by the current absence of a code path", and
 * §8.2's own history is the argument: the old tender list kept achievement
 * Chalk out by having no word for it, and the hazard shipped because `'chalk'`
 * was a legal tender and nothing could tell the difference.
 *
 * So a covered day is a word here, and it is a word `EmpireOutput` does not
 * contain. The disjointness is proved at the type level below and walked at
 * runtime in the tests. The reason coverage in particular is out: empire income
 * is keyed to the check-in, which is training-gated in GDD §4.4's sense, and a
 * training-gated route into coverage is the laundered path that section traces
 * — an achievement pays Chalk, Chalk buys a covered day, and the covered day's
 * arrival is back under the player's own training with a currency in between.
 *
 * ===========================================================================
 * 6. What piece E6 has to assert, and what this file hands it
 * ===========================================================================
 *
 * The second reading of "structurally unable" is that the output does not move,
 * and GDD §4.4 records a builder who believed a check covered it when mutation
 * testing found a legal input that moved 2362 of 34338 purchase-day lists,
 * produced zero violations and left every aggregate identical. So E6's
 * assertion is on the list itself, element by element:
 *
 *   For every purchasable accelerant, at every horizon, applied on every
 *   schedule, `progressionLedger(state.ledger)` is byte-identical to the same
 *   ledger with no accelerant applied — compared element-wise, not by a sum,
 *   not by a bound.
 *
 * And it needs a negative control beside it: the same sweep against a variant
 * wired so the skip does move the un-accelerated clock, with its non-zero count
 * pinned. A zero with nothing beside it is the empty-domain vacuity this
 * codebase has been bitten by repeatedly.
 *
 * What this file provides for that: `progressionLedger` and `idleLedger` as the
 * two halves of one partition, `EmpireLedgerEntry.at` stamped on the
 * un-accelerated clock so a skip cannot move a timestamp either, and
 * `PURCHASABLE_ACCELERANTS` as the derived list the sweep iterates so it cannot
 * miss one that was added later.
 */

import { EMPIRE_TUNING } from './empireTuning';

// ---------------------------------------------------------------------------
// Vocabulary taken from the tuning ladders
// ---------------------------------------------------------------------------

export type NpcTier = (typeof EMPIRE_TUNING.NPC_TIERS)[number];
export type EquipmentTier = (typeof EMPIRE_TUNING.EQUIPMENT_TIERS)[number];
export type StaffRole = (typeof EMPIRE_TUNING.STAFF_ROLES)[number];
export type LeaderboardScope = (typeof EMPIRE_TUNING.LEADERBOARD_SCOPES)[number];

// ---------------------------------------------------------------------------
// Branded scalars
// ---------------------------------------------------------------------------

declare const EMPIRE_BRAND: unique symbol;

/**
 * A number or string that is not interchangeable with a bare one.
 *
 * Type-only: the symbol is `declare`d and erased, so nothing here exists at
 * runtime and a branded value is its underlying primitive on the wire.
 */
type Branded<T, B extends string> = T & { readonly [EMPIRE_BRAND]: B };

/** Soft currency. GDD §8.2 lists it as earned from idle, check-ins, achievements. */
export type GymBucks = Branded<number, 'gym-bucks'>;

/** The §5.4 reputation axis, on the scale `EMPIRE_TUNING.REPUTATION_MAX` tops out. */
export type ReputationPoints = Branded<number, 'reputation'>;

/** GDD §2's Training IQ. Progression-reaching; see §4 of the header. */
export type TrainingIqPoints = Branded<number, 'training-iq'>;

/**
 * Days of Sim setback a physio removes — the argument `recordSession` takes as
 * `physioDaysSaved`. A whole number, bounded by `PHYSIO_MAX_DAYS_SAVED`, and
 * `asInjuryDaysSaved` is the one way to make one.
 */
export type InjuryDaysSaved = Branded<number, 'injury-days-saved'>;

/**
 * Seconds of wall time since the gym opened. No accelerant writes this, which
 * is what makes it the right input to a progression-reaching rate.
 */
export type UnacceleratedSeconds = Branded<number, 'unaccelerated-seconds'>;

/**
 * Wall time plus every applied skip. The Gym Bucks economy, the roster and the
 * cosmetic layer run on this, and nothing that reaches Sim progression does.
 */
export type AcceleratedSeconds = Branded<number, 'accelerated-seconds'>;

/** Tenure in whole and fractional days, on whichever clock produced it. */
export type TenureDays = Branded<number, 'tenure-days'>;

/** A roster lifter's identity. Opaque so it is not confused with a display name. */
export type NpcId = Branded<string, 'npc-id'>;

/**
 * A level counted on the un-accelerated clock.
 *
 * The physio hook takes one of these rather than a bare number, so a caller
 * holding a level derived from the accelerated clock has nothing to pass. That
 * is hazard 2 closed the same way hazard 1 is: by what the function will
 * accept, not by what it does with it.
 */
export type SettledLevel = Branded<number, 'settled-level'>;

// ---------------------------------------------------------------------------
// Outputs, sinks and reach
// ---------------------------------------------------------------------------

/**
 * Everything GDD §5 pays out.
 *
 * A new entry costs a sink in `OUTPUT_SINK`, which is exhaustive by
 * `satisfies`, so an output with no declared destination does not compile.
 */
export const EMPIRE_OUTPUTS = [
  /** §5.2's base passive income. */
  'gym-bucks',
  /** §5.4's reputation axis. */
  'reputation',
  /** §5.3/§5.4's roster capacity. */
  'roster-slot',
  /** §8.3A cosmetics, decor, singlets — the collection hook. */
  'cosmetic-unlock',
  /** §5.2's Training IQ trickle. Reaches Sim progression. */
  'training-iq',
  /** §5.4's physio hook. Reaches Sim progression. */
  'physio-days-saved',
] as const;

export type EmpireOutput = (typeof EMPIRE_OUTPUTS)[number];

/**
 * Where an output ends up.
 *
 * `'training-pace'` is GDD §8.1's whole phrase — Total, e1RM, training pace and
 * meet performance — rather than one of its four nouns, so two outputs that
 * touch different nouns of it are still one row and one verdict.
 */
export const OUTPUT_SINKS = ['gym-economy', 'cosmetics', 'training-pace'] as const;

export type OutputSink = (typeof OUTPUT_SINKS)[number];

/** The two verdicts. There is no third and no "probably fine". */
export const OUTPUT_REACHES = ['idle-only', 'progression-reaching'] as const;

export type OutputReach = (typeof OUTPUT_REACHES)[number];

/**
 * The one place reach is decided, and it is decided per SINK.
 *
 * Re-tagging `'training-pace'` as `'idle-only'` is the single edit that would
 * let a purchased skip move Training IQ and the physio hook at once. It is one
 * word, it sits under the header above, and `empireCore.test.ts` fails on it in
 * four places.
 */
export const SINK_REACH = {
  'gym-economy': 'idle-only',
  cosmetics: 'idle-only',
  'training-pace': 'progression-reaching',
} as const satisfies Readonly<Record<OutputSink, OutputReach>>;

/** Which sink each output feeds. Exhaustive by `satisfies`. */
export const OUTPUT_SINK = {
  'gym-bucks': 'gym-economy',
  reputation: 'gym-economy',
  'roster-slot': 'gym-economy',
  'cosmetic-unlock': 'cosmetics',
  'training-iq': 'training-pace',
  'physio-days-saved': 'training-pace',
} as const satisfies Readonly<Record<EmpireOutput, OutputSink>>;

/** An output's reach at the type level, looked up through the two tables. */
export type ReachOfOutput<O extends EmpireOutput> =
  (typeof SINK_REACH)[(typeof OUTPUT_SINK)[O]];

/** The outputs a purchase may touch. A mapped filter, not a second list. */
export type IdleOnlyOutput = {
  [O in EmpireOutput]: ReachOfOutput<O> extends 'idle-only' ? O : never;
}[EmpireOutput];

/** The complement, derived rather than written, so the two cannot overlap. */
export type ProgressionReachingOutput = Exclude<EmpireOutput, IdleOnlyOutput>;

/**
 * Compile-time proof that the two halves partition the whole.
 *
 * As written it is a tautology, because the second half is an `Exclude`. That
 * is the point of writing it down: if a later edit replaces either type with a
 * hand-maintained list, this stops being a tautology and starts being a test.
 */
export type OutputsArePartitioned = [
  Exclude<EmpireOutput, IdleOnlyOutput | ProgressionReachingOutput>,
] extends [never]
  ? [Extract<IdleOnlyOutput, ProgressionReachingOutput>] extends [never]
    ? true
    : never
  : never;

export const EMPIRE_OUTPUT_REACH_IS_A_PARTITION: OutputsArePartitioned = true;

// ---------------------------------------------------------------------------
// What the empire may not pay at all
// ---------------------------------------------------------------------------

/**
 * Named so they are refusable. See §5 of the header for why absence is not
 * enough on its own.
 */
export const EMPIRE_FORBIDDEN_OUTPUTS = [
  /** GDD §8.3E's Extra Covered Day. Empire income is check-in-keyed. */
  'covered-day',
  /** GDD §8.2's premium currency, because Chalk buys the line above. */
  'chalk',
  /** GDD §2: moved by Sim training, session by session. */
  'e1rm',
  /** GDD §6.4: set at a meet, by the sum of best successful attempts. */
  'competition-total',
] as const;

export type EmpireForbiddenOutput = (typeof EMPIRE_FORBIDDEN_OUTPUTS)[number];

/** Compile-time proof that no forbidden output is also a payable one. */
export type ForbiddenOutputsAreDisjoint = [
  Extract<EmpireOutput, EmpireForbiddenOutput>,
] extends [never]
  ? true
  : never;

export const EMPIRE_PAYS_NO_FORBIDDEN_OUTPUT: ForbiddenOutputsAreDisjoint = true;

// ---------------------------------------------------------------------------
// Accelerants
// ---------------------------------------------------------------------------

/**
 * How an accelerant reached the player's hands.
 *
 *   - `'store-purchase'` — money, or a monetisation surface standing in for it.
 *     GDD §8.3B's timer skips and §8.3D's rewarded ad are the same row here on
 *     purpose: both are levers the business pulls, and §8.1's rule is about
 *     what the business may sell.
 *   - `'gym-progress'` — built or earned inside §5 with Gym Bucks or
 *     reputation. Not purchasable, so §8.1 has no opinion about it, and §5.2
 *     wants exactly this to move the trickle.
 */
export const ACCELERANT_ARRIVALS = ['store-purchase', 'gym-progress'] as const;

export type AccelerantArrival = (typeof ACCELERANT_ARRIVALS)[number];

/**
 * Everything that makes the empire produce sooner or faster.
 *
 * A new entry costs an arrival in `ACCELERANT_ARRIVAL`, which is exhaustive by
 * `satisfies`.
 */
export const EMPIRE_ACCELERANTS = [
  /** GDD §8.3B, sold. `progression.ts` ships this exact grant id. */
  'gym-empire-timer-skip',
  /** GDD §8.3D, opt-in. Same row as the line above, deliberately. */
  'rewarded-ad-timer-skip',
  /** §5.4 staff: a coach, built with Gym Bucks. */
  'coach-staff-level',
  /** §5.4 space: more racks and platforms, built with Gym Bucks. */
  'space-level',
  /** §5.4 reputation: earned, and the gate on the §5.3 legendary tier. */
  'reputation-tier',
] as const;

export type EmpireAccelerant = (typeof EMPIRE_ACCELERANTS)[number];

/** How each accelerant arrives. The declaration a new one cannot ship without. */
export const ACCELERANT_ARRIVAL = {
  'gym-empire-timer-skip': 'store-purchase',
  'rewarded-ad-timer-skip': 'store-purchase',
  'coach-staff-level': 'gym-progress',
  'space-level': 'gym-progress',
  'reputation-tier': 'gym-progress',
} as const satisfies Readonly<Record<EmpireAccelerant, AccelerantArrival>>;

/**
 * The one place an arrival's licence is decided: which reaches it may touch.
 *
 * Adding `'progression-reaching'` to the `'store-purchase'` row is the single
 * edit that ships GDD §12.3's first refusal condition. It is one word, and it
 * is the word this whole file is arranged around.
 */
export const ARRIVAL_LICENCE = {
  'store-purchase': ['idle-only'],
  'gym-progress': ['idle-only', 'progression-reaching'],
} as const satisfies Readonly<Record<AccelerantArrival, readonly OutputReach[]>>;

/** What an accelerant is licensed to touch, at the type level. */
export type LicenceOfAccelerant<A extends EmpireAccelerant> =
  (typeof ARRIVAL_LICENCE)[(typeof ACCELERANT_ARRIVAL)[A]][number];

/**
 * The outputs one accelerant may be applied to.
 *
 * A mapped filter over `EMPIRE_OUTPUTS` through `ReachOfOutput` and the licence
 * above, so it is derived from the same four tables the runtime reads. For a
 * `'store-purchase'` accelerant it excludes every progression-reaching output;
 * for a `'gym-progress'` one it is everything.
 */
export type AccelerableOutput<A extends EmpireAccelerant> = {
  [O in EmpireOutput]: ReachOfOutput<O> extends LicenceOfAccelerant<A> ? O : never;
}[EmpireOutput];

/**
 * A legal accelerant/output pairing, as a union over accelerants.
 *
 * `{ accelerant: 'gym-empire-timer-skip', output: 'training-iq' }` matches no
 * member: the skip's member types `output` as the idle-only subset, and every
 * other member requires its own accelerant literal. So hazard 1 is a compile
 * error rather than a runtime branch.
 */
export type AcceleratedOutput = {
  [A in EmpireAccelerant]: {
    readonly accelerant: A;
    readonly output: AccelerableOutput<A>;
  };
}[EmpireAccelerant];

/** The purchasable half, derived from the arrival table. */
export type PurchasableAccelerant = {
  [A in EmpireAccelerant]: (typeof ACCELERANT_ARRIVAL)[A] extends 'store-purchase' ? A : never;
}[EmpireAccelerant];

/** The complement, derived, so the two cannot overlap. */
export type EarnedAccelerant = Exclude<EmpireAccelerant, PurchasableAccelerant>;

/** Compile-time proof that the accelerants partition too. See `OutputsArePartitioned`. */
export type AccelerantsArePartitioned = [
  Exclude<EmpireAccelerant, PurchasableAccelerant | EarnedAccelerant>,
] extends [never]
  ? [Extract<PurchasableAccelerant, EarnedAccelerant>] extends [never]
    ? true
    : never
  : never;

export const EMPIRE_ACCELERANT_ARRIVAL_IS_A_PARTITION: AccelerantsArePartitioned = true;

// ---------------------------------------------------------------------------
// The runtime shadow of the four tables
// ---------------------------------------------------------------------------

/** An output's reach, by the same two-hop lookup as the type. */
export function outputReach(output: EmpireOutput): OutputReach {
  return SINK_REACH[OUTPUT_SINK[output]];
}

/** An accelerant's licence, by the same two-hop lookup as the type. */
export function accelerantLicence(accelerant: EmpireAccelerant): readonly OutputReach[] {
  return ARRIVAL_LICENCE[ACCELERANT_ARRIVAL[accelerant]];
}

/**
 * Whether this accelerant may touch this output.
 *
 * The compiler already refuses the illegal pairing at every call site written
 * in TypeScript. This is for the call sites that are not: a settled order
 * decoded from an Edge Function response is JSON, and JSON has no types.
 */
export function mayAccelerate(accelerant: EmpireAccelerant, output: EmpireOutput): boolean {
  return accelerantLicence(accelerant).includes(outputReach(output));
}

/** Narrows an unknown wire value to an output. */
export function isEmpireOutput(value: unknown): value is EmpireOutput {
  return (EMPIRE_OUTPUTS as readonly unknown[]).includes(value);
}

/** Narrows an unknown wire value to an accelerant. */
export function isEmpireAccelerant(value: unknown): value is EmpireAccelerant {
  return (EMPIRE_ACCELERANTS as readonly unknown[]).includes(value);
}

/** True for an accelerant the business sells or gates behind an ad surface. */
export function isPurchasableAccelerant(value: unknown): value is PurchasableAccelerant {
  return isEmpireAccelerant(value) && ACCELERANT_ARRIVAL[value] === 'store-purchase';
}

/** True for an output that reaches Sim progression. */
export function isProgressionReachingOutput(value: unknown): value is ProgressionReachingOutput {
  return isEmpireOutput(value) && outputReach(value) === 'progression-reaching';
}

/**
 * The accelerants a §8.1 sweep has to cover, filtered from the one list through
 * the one predicate so it can never name one the type would allow and miss one
 * the type would not.
 */
export const PURCHASABLE_ACCELERANTS: readonly PurchasableAccelerant[] =
  EMPIRE_ACCELERANTS.filter(isPurchasableAccelerant);

/** The complement. Derived the same way. */
export const EARNED_ACCELERANTS: readonly EarnedAccelerant[] = EMPIRE_ACCELERANTS.filter(
  (accelerant): accelerant is EarnedAccelerant => !isPurchasableAccelerant(accelerant),
);

/** The outputs a purchase may touch. Derived. */
export const IDLE_ONLY_OUTPUTS: readonly IdleOnlyOutput[] = EMPIRE_OUTPUTS.filter(
  (output): output is IdleOnlyOutput => outputReach(output) === 'idle-only',
);

/** The outputs a purchase may not touch. Derived. */
export const PROGRESSION_REACHING_OUTPUTS: readonly ProgressionReachingOutput[] =
  EMPIRE_OUTPUTS.filter(isProgressionReachingOutput);

// ---------------------------------------------------------------------------
// Constructors for the branded scalars
// ---------------------------------------------------------------------------

function requireFiniteAtLeastZero(value: number, what: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${what} must be a finite number at or above zero, received ${value}.`);
  }
}

/** Gym Bucks. Refuses a negative or non-finite balance. */
export function asGymBucks(value: number): GymBucks {
  requireFiniteAtLeastZero(value, 'gymBucks');
  return value as GymBucks;
}

/** Reputation, bounded by `EMPIRE_TUNING.REPUTATION_MAX`. */
export function asReputation(value: number): ReputationPoints {
  requireFiniteAtLeastZero(value, 'reputation');
  if (value > EMPIRE_TUNING.REPUTATION_MAX) {
    throw new RangeError(
      `reputation must be at or below REPUTATION_MAX (${EMPIRE_TUNING.REPUTATION_MAX}), received ${value}.`,
    );
  }
  return value as ReputationPoints;
}

/** Training IQ points. */
export function asTrainingIq(value: number): TrainingIqPoints {
  requireFiniteAtLeastZero(value, 'trainingIq');
  return value as TrainingIqPoints;
}

/**
 * Days of setback a physio removes.
 *
 * Two refusals rather than one, and both are at this seam rather than at the
 * far end of it. `src/game/fatigue.ts` throws on a `physioDaysSaved` that is
 * not a whole number at or above zero, so a fraction is refused here where the
 * message can say which table produced it; and the value is bounded by
 * `PHYSIO_MAX_DAYS_SAVED`, which `empireTuning.test.ts` in turn bounds against
 * the real `FATIGUE_TUNING` so a setback keeps at least its floor.
 */
export function asInjuryDaysSaved(value: number): InjuryDaysSaved {
  requireFiniteAtLeastZero(value, 'injuryDaysSaved');
  if (!Number.isInteger(value)) {
    throw new RangeError(`injuryDaysSaved must be a whole number, received ${value}.`);
  }
  if (value > EMPIRE_TUNING.PHYSIO_MAX_DAYS_SAVED) {
    throw new RangeError(
      `injuryDaysSaved must be at or below PHYSIO_MAX_DAYS_SAVED (${EMPIRE_TUNING.PHYSIO_MAX_DAYS_SAVED}), received ${value}.`,
    );
  }
  return value as InjuryDaysSaved;
}

/** Wall-clock seconds since the gym opened. Nothing purchasable writes one. */
export function asUnacceleratedSeconds(value: number): UnacceleratedSeconds {
  requireFiniteAtLeastZero(value, 'unacceleratedSeconds');
  return value as UnacceleratedSeconds;
}

/** Wall-clock seconds plus every applied skip. */
export function asAcceleratedSeconds(value: number): AcceleratedSeconds {
  requireFiniteAtLeastZero(value, 'acceleratedSeconds');
  return value as AcceleratedSeconds;
}

/** Tenure in days. */
export function asTenureDays(value: number): TenureDays {
  requireFiniteAtLeastZero(value, 'tenureDays');
  return value as TenureDays;
}

/** A roster lifter's id. Refuses the empty string so a missing id is loud. */
export function asNpcId(value: string): NpcId {
  if (value.length === 0) {
    throw new RangeError('npcId must not be empty.');
  }
  return value as NpcId;
}

/**
 * A level counted on the un-accelerated clock.
 *
 * `completionTimes` is when each level of that axis would have finished with no
 * accelerant applied; `now` is the un-accelerated moment being asked about. The
 * level is how many of those have passed. Because both arguments are
 * `UnacceleratedSeconds`, a caller holding an accelerated clock has nothing to
 * pass, which is hazard 2 closed at the argument list.
 */
export function settledLevel(
  completionTimes: readonly UnacceleratedSeconds[],
  now: UnacceleratedSeconds,
): SettledLevel {
  let level = 0;
  for (const completion of completionTimes) {
    if (completion <= now) level += 1;
  }
  return level as SettledLevel;
}

/**
 * GDD §5.4's physio hook, as the argument `recordSession` takes.
 *
 * Takes a `SettledLevel` rather than a number, so the days saved cannot be
 * computed from a clock a purchase moved. Clamped by `PHYSIO_MAX_DAYS_SAVED`,
 * which is bounded against the fatigue model's own floor.
 */
export function physioDaysSavedFor(level: SettledLevel): InjuryDaysSaved {
  const raw = level * EMPIRE_TUNING.PHYSIO_DAYS_SAVED_PER_STAFF_LEVEL;
  return asInjuryDaysSaved(Math.min(EMPIRE_TUNING.PHYSIO_MAX_DAYS_SAVED, raw));
}

// ---------------------------------------------------------------------------
// The clock
// ---------------------------------------------------------------------------

/**
 * The two elapsed times an empire runs on. See §4 of the header.
 *
 * `accelerated` is at or after `unaccelerated` by construction — an accelerant
 * pushes the idle clock forward and there is no operation that pushes it back.
 */
export interface EmpireClock {
  readonly unaccelerated: UnacceleratedSeconds;
  readonly accelerated: AcceleratedSeconds;
}

/**
 * Build a clock from wall time and the total seconds skipped so far.
 *
 * `elapsedSeconds` becomes `unaccelerated` untouched, whatever `skippedSeconds`
 * is. That is the property `empireCore.test.ts` sweeps: the un-accelerated
 * reading is a function of wall time alone.
 */
export function createEmpireClock(elapsedSeconds: number, skippedSeconds: number): EmpireClock {
  requireFiniteAtLeastZero(elapsedSeconds, 'elapsedSeconds');
  requireFiniteAtLeastZero(skippedSeconds, 'skippedSeconds');
  return Object.freeze({
    unaccelerated: asUnacceleratedSeconds(elapsedSeconds),
    accelerated: asAcceleratedSeconds(elapsedSeconds + skippedSeconds),
  });
}

/** The clock an output's reach entitles it to, at the type level. */
export type ElapsedFor<O extends EmpireOutput> = ReachOfOutput<O> extends 'progression-reaching'
  ? UnacceleratedSeconds
  : AcceleratedSeconds;

/**
 * Hand an output the clock its reach entitles it to.
 *
 * The return type is conditional, so `elapsedFor(clock, 'training-iq')` is an
 * `UnacceleratedSeconds` and `elapsedFor(clock, 'gym-bucks')` is an
 * `AcceleratedSeconds`, and a rate function typed for one refuses the other.
 * The cast is the one place the two brands meet; the branch it casts is
 * the same `outputReach` lookup the type performs, and both arms are driven in
 * `empireCore.test.ts` against a clock whose two readings differ.
 */
export function elapsedFor<O extends EmpireOutput>(clock: EmpireClock, output: O): ElapsedFor<O> {
  const seconds =
    outputReach(output) === 'progression-reaching' ? clock.unaccelerated : clock.accelerated;
  return seconds as ElapsedFor<O>;
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

/**
 * One §5.3 NPC lifter.
 *
 * Two times rather than one, and that is §4 of the header made concrete.
 * `joinedAt` is when the lifter appeared on the roster — moved forward by a
 * purchased skip, which is what GDD §8.3B sells. `settledAt` is when the
 * recruitment would have completed unaided, and it is what the Training IQ
 * half reads.
 *
 * `displayName` is player-authored (§5.3's customisation hook). No name table
 * ships in this piece: GDD §12.3 refuses a real, named athlete in any string or
 * code path, so whatever piece supplies default names supplies fictional
 * placeholders and gets checked name by name.
 */
export interface NpcLifter {
  readonly id: NpcId;
  readonly tier: NpcTier;
  readonly displayName: string;
  readonly joinedAt: AcceleratedSeconds;
  readonly settledAt: UnacceleratedSeconds;
}

/** Build a roster lifter. Every argument is validated by its own constructor. */
export function createNpcLifter(
  id: string,
  tier: NpcTier,
  displayName: string,
  joinedAt: number,
  settledAt: number,
): NpcLifter {
  if (displayName.length === 0) {
    throw new RangeError('displayName must not be empty.');
  }
  return Object.freeze({
    id: asNpcId(id),
    tier,
    displayName,
    joinedAt: asAcceleratedSeconds(joinedAt),
    settledAt: asUnacceleratedSeconds(settledAt),
  });
}

/** Tenure on the idle clock — what the Gym Bucks half reads. */
export function idleTenureDays(lifter: NpcLifter, now: AcceleratedSeconds): TenureDays {
  const seconds = Math.max(0, now - lifter.joinedAt);
  return asTenureDays(seconds / EMPIRE_TUNING.SECONDS_PER_DAY);
}

/**
 * Tenure on the wall clock — what the Training IQ half reads.
 *
 * Takes `UnacceleratedSeconds`, so a caller holding an accelerated clock has
 * nothing to pass. Measured from `settledAt`, so a purchased skip moves neither
 * the argument nor the origin.
 */
export function settledTenureDays(lifter: NpcLifter, now: UnacceleratedSeconds): TenureDays {
  const seconds = Math.max(0, now - lifter.settledAt);
  return asTenureDays(seconds / EMPIRE_TUNING.SECONDS_PER_DAY);
}

// ---------------------------------------------------------------------------
// The gym and its axes
// ---------------------------------------------------------------------------

/** GDD §5.4's four axes, as state. Reputation lives on `EmpireState`. */
export interface GymAxes {
  readonly equipment: EquipmentTier;
  readonly spaceLevel: number;
  readonly staffLevel: Readonly<Record<StaffRole, number>>;
}

/** Roster capacity from the space and spotter axes, capped by `ROSTER_SLOTS_MAX`. */
export function rosterCapacity(axes: GymAxes): number {
  const fromSpace = EMPIRE_TUNING.ROSTER_SLOTS_PER_SPACE_LEVEL * axes.spaceLevel;
  const fromSpotters =
    EMPIRE_TUNING.ROSTER_SLOTS_PER_SPOTTER_LEVEL * axes.staffLevel.spotter;
  return Math.min(
    EMPIRE_TUNING.ROSTER_SLOTS_MAX,
    EMPIRE_TUNING.ROSTER_SLOTS_BASE + fromSpace + fromSpotters,
  );
}

/** Flat Gym Bucks price of a §5.3 recruit. Deterministic, published, per tier. */
export function recruitCost(tier: NpcTier): GymBucks {
  return asGymBucks(EMPIRE_TUNING.NPC_RECRUIT_COST_GYM_BUCKS[tier]);
}

/** Reputation a tier is gated behind. §5.3's alternative to a price. */
export function recruitReputationThreshold(tier: NpcTier): ReputationPoints {
  return asReputation(EMPIRE_TUNING.NPC_RECRUIT_REPUTATION_THRESHOLD[tier]);
}

/** How long a recruit takes, in seconds. One of §8.3B's two skippable timers. */
export function recruitSeconds(tier: NpcTier): number {
  return EMPIRE_TUNING.NPC_RECRUIT_SECONDS[tier];
}

/** Price of an equipment tier. The first tier is free: a gym opens with it. */
export function equipmentTierCost(tier: EquipmentTier): GymBucks {
  return asGymBucks(EMPIRE_TUNING.EQUIPMENT_TIER_COST_GYM_BUCKS[tier]);
}

/** Price of a space level, or `null` if the level is off the ladder. */
export function spaceLevelCost(level: number): GymBucks | null {
  const price = EMPIRE_TUNING.SPACE_LEVEL_COST_GYM_BUCKS[level - 1];
  return price === undefined ? null : asGymBucks(price);
}

/** Price of a staff level for a role, or `null` if the level is off that ladder. */
export function staffLevelCost(role: StaffRole, level: number): GymBucks | null {
  const price = EMPIRE_TUNING.STAFF_LEVEL_COST_GYM_BUCKS[role][level - 1];
  return price === undefined ? null : asGymBucks(price);
}

/** Seconds one build of the given level takes, capped by `BUILD_SECONDS_MAX`. */
export function buildSeconds(level: number): number {
  const raw =
    EMPIRE_TUNING.BUILD_SECONDS_BASE *
    EMPIRE_TUNING.BUILD_SECONDS_GROWTH_PER_LEVEL ** (level - 1);
  return Math.min(EMPIRE_TUNING.BUILD_SECONDS_MAX, raw);
}

/** Which §5.4 reputation tier a gym sits in, as an index into the threshold list. */
export function reputationTierIndex(reputation: ReputationPoints): number {
  let index = 0;
  EMPIRE_TUNING.REPUTATION_TIER_THRESHOLDS.forEach((threshold, at) => {
    if (reputation >= threshold) index = at;
  });
  return index;
}

// ---------------------------------------------------------------------------
// Ledgers
// ---------------------------------------------------------------------------

/**
 * One payout, stamped on the un-accelerated clock.
 *
 * The stamp is deliberately the wall clock even for an idle-only payout, so a
 * purchased skip moves what a ledger contains and never when a ledger says it
 * happened. That is what lets piece E6 compare two ledgers element-wise
 * without first having to agree on a time base.
 */
export interface EmpireLedgerEntry {
  readonly at: UnacceleratedSeconds;
  readonly output: EmpireOutput;
  readonly amount: number;
}

/**
 * The half of a ledger that reaches Sim progression — the list piece E6
 * compares byte-for-byte across every purchasable accelerant.
 */
export function progressionLedger(
  ledger: readonly EmpireLedgerEntry[],
): readonly EmpireLedgerEntry[] {
  return ledger.filter((entry) => outputReach(entry.output) === 'progression-reaching');
}

/** The other half. Derived through the same predicate, so the two partition. */
export function idleLedger(ledger: readonly EmpireLedgerEntry[]): readonly EmpireLedgerEntry[] {
  return ledger.filter((entry) => outputReach(entry.output) === 'idle-only');
}

/** One applied accelerant, with the pairing checked by the type system. */
export type AppliedAccelerant = AcceleratedOutput & {
  readonly at: UnacceleratedSeconds;
  readonly seconds: number;
};

/**
 * Build an accelerant/output pairing.
 *
 * The generic argument is what puts the refusal on the OUTPUT rather than on
 * the whole object: `AccelerableOutput<A>` is resolved from the accelerant
 * passed in, so a purchased skip aimed at Training IQ fails on the second
 * argument and says so by name. A call site that gets the accelerant wrong
 * fails separately instead of being swallowed by one broad suppression, which
 * matters where the refusal is asserted with `@ts-expect-error`.
 *
 * The cast is the one place the union is re-formed; the two fields it is built
 * from are the same two the union's member declares.
 */
export function acceleratedOutput<A extends EmpireAccelerant>(
  accelerant: A,
  output: AccelerableOutput<A>,
): AcceleratedOutput {
  return Object.freeze({ accelerant, output }) as AcceleratedOutput;
}

/** The same pairing, stamped and sized. See `acceleratedOutput` for the fence. */
export function applyAccelerant<A extends EmpireAccelerant>(
  accelerant: A,
  output: AccelerableOutput<A>,
  at: UnacceleratedSeconds,
  seconds: number,
): AppliedAccelerant {
  requireFiniteAtLeastZero(seconds, 'accelerant seconds');
  return Object.freeze({
    ...acceleratedOutput(accelerant, output),
    at,
    seconds,
  }) as AppliedAccelerant;
}

// ---------------------------------------------------------------------------
// The state, its constructor and its invariants
// ---------------------------------------------------------------------------

/** Everything GDD §5 holds about one gym. */
export interface EmpireState {
  readonly clock: EmpireClock;
  readonly axes: GymAxes;
  readonly roster: readonly NpcLifter[];
  readonly reputation: ReputationPoints;
  readonly gymBucks: GymBucks;
  readonly ledger: readonly EmpireLedgerEntry[];
  readonly accelerants: readonly AppliedAccelerant[];
}

/** A gym on the day it opens: first equipment tier, no space, no staff, no roster. */
export function createEmpireState(): EmpireState {
  const staffLevel: Record<StaffRole, number> = { coach: 0, spotter: 0, physio: 0 };
  return Object.freeze({
    clock: createEmpireClock(0, 0),
    axes: Object.freeze({
      equipment: EMPIRE_TUNING.EQUIPMENT_TIERS[0],
      spaceLevel: 0,
      staffLevel: Object.freeze(staffLevel),
    }),
    roster: Object.freeze([]),
    reputation: asReputation(0),
    gymBucks: asGymBucks(0),
    ledger: Object.freeze([]),
    accelerants: Object.freeze([]),
  });
}

/**
 * Every invariant an `EmpireState` has to satisfy, as a list of messages.
 *
 * A list rather than a throw, because a caller validating a decoded wire
 * payload wants all of them and a caller asserting in a test wants one message
 * with all of them in it. `assertEmpireState` is that second caller.
 */
export function empireStateFaults(state: EmpireState): readonly string[] {
  const faults: string[] = [];

  if (state.clock.accelerated < state.clock.unaccelerated) {
    faults.push('clock: the accelerated reading is behind the un-accelerated one');
  }

  if (!(EMPIRE_TUNING.EQUIPMENT_TIERS as readonly string[]).includes(state.axes.equipment)) {
    faults.push(`axes: ${state.axes.equipment} is not an equipment tier`);
  }

  if (
    !Number.isInteger(state.axes.spaceLevel) ||
    state.axes.spaceLevel < 0 ||
    state.axes.spaceLevel > EMPIRE_TUNING.SPACE_LEVEL_MAX
  ) {
    faults.push(`axes: space level ${state.axes.spaceLevel} is off the ladder`);
  }

  for (const role of EMPIRE_TUNING.STAFF_ROLES) {
    const level = state.axes.staffLevel[role];
    if (!Number.isInteger(level) || level < 0 || level > EMPIRE_TUNING.STAFF_LEVEL_MAX[role]) {
      faults.push(`axes: ${role} level ${level} is off the ladder`);
    }
  }

  if (!Number.isFinite(state.reputation) || state.reputation < 0) {
    faults.push(`reputation: ${state.reputation} is not a reputation`);
  }
  if (state.reputation > EMPIRE_TUNING.REPUTATION_MAX) {
    faults.push(`reputation: ${state.reputation} is above REPUTATION_MAX`);
  }

  if (!Number.isFinite(state.gymBucks) || state.gymBucks < 0) {
    faults.push(`gymBucks: ${state.gymBucks} is not a balance`);
  }

  const capacity = rosterCapacity(state.axes);
  if (state.roster.length > capacity) {
    faults.push(`roster: ${state.roster.length} lifters in ${capacity} slots`);
  }

  const seen = new Set<string>();
  for (const lifter of state.roster) {
    if (seen.has(lifter.id)) faults.push(`roster: duplicate lifter id ${lifter.id}`);
    seen.add(lifter.id);
    if (!(EMPIRE_TUNING.NPC_TIERS as readonly string[]).includes(lifter.tier)) {
      faults.push(`roster: ${lifter.id} is on tier ${lifter.tier}, which is not a tier`);
    }
  }

  for (const entry of state.ledger) {
    if (!Number.isFinite(entry.amount)) {
      faults.push(`ledger: ${entry.output} paid a non-finite amount`);
    }
    if (!isEmpireOutput(entry.output)) {
      faults.push(`ledger: ${String(entry.output)} is not an empire output`);
    }
  }

  for (const applied of state.accelerants) {
    if (!Number.isFinite(applied.seconds) || applied.seconds < 0) {
      faults.push(`accelerants: ${applied.accelerant} applied for ${applied.seconds} seconds`);
    }
    // The second line, for payloads the compiler never saw. GDD §8.1: a
    // purchased accelerant on a progression-reaching output is the refusal
    // condition itself, so it is named as one rather than reported as a
    // type mismatch.
    if (!mayAccelerate(applied.accelerant, applied.output)) {
      faults.push(
        `accelerants: ${applied.accelerant} arrives by ${ACCELERANT_ARRIVAL[applied.accelerant]} ` +
          `and may not accelerate ${applied.output}, which reaches ${outputReach(applied.output)}`,
      );
    }
  }

  return faults;
}

/** `empireStateFaults`, as a throw. Useful at a decode boundary and in a test. */
export function assertEmpireState(state: EmpireState): void {
  const faults = empireStateFaults(state);
  if (faults.length > 0) {
    throw new RangeError(`invalid EmpireState:\n  ${faults.join('\n  ')}`);
  }
}
