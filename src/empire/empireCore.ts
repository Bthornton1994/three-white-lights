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
 * 3. The type is the enforcement, and a mapped type alone was not enough
 * ===========================================================================
 *
 * `AccelerableOutput<A>` is DERIVED from the two tables by a mapped filter, the
 * way `NonTrainingGatedTender` is derived, so it is not a second hand-written
 * list that can drift from the first. `AppliedAccelerant` — the thing an
 * `EmpireState` actually holds — is a mapped union over accelerants whose
 * `output` field is that filter.
 *
 * That much shipped, and it did not hold. The reason is invisible from the
 * mapped type and is worth writing down: `LicenceOfAccelerant<A>` is an indexed
 * access, and an indexed access over a union key DISTRIBUTES. So when `A` was
 * inferred as the whole `EmpireAccelerant` union rather than as one member of
 * it, the licence resolved to every licence there is and `AccelerableOutput<A>`
 * to every output there is. Two ordinary spellings did that, with no cast and
 * only exported API:
 *
 *     for (const accelerant of EMPIRE_ACCELERANTS) {   // element type: the union
 *       applyAccelerant(accelerant, 'physio-days-saved', at, seconds);
 *     }
 *
 *     if (isEmpireAccelerant(wire)) {                  // narrows to the union
 *       applyAccelerant(wire, 'training-iq', at, seconds);
 *     }
 *
 * Both compiled. Neither does now: the accelerant parameter is
 * `A & OneAccelerant<A>`, which is `never` for a union `A`, so an accelerant
 * that is not one literal is refused at the first argument before the output
 * filter is consulted. Both spellings are asserted with `@ts-expect-error` in
 * `empireCore.test.ts`, so reopening either is an unused directive — a build
 * failure — rather than a silent pass.
 *
 * There are therefore three fences here and they fail differently, which is why
 * all three are kept:
 *
 *   - the union `AcceleratedOutput`, which an object literal is checked
 *     against. This one does not depend on inference at all, because the
 *     accelerant is a property of the value rather than a parameter the call
 *     site chooses. It was the strongest fence in the file and it was the one
 *     with no test.
 *   - the two constructors, whose accelerant argument refuses a union and whose
 *     output argument is filtered from it.
 *   - `mayAccelerate`, the runtime shadow, which both constructors now CALL and
 *     throw on. That is for the callers TypeScript never sees: a settled order
 *     arrives from an Edge Function as JSON, and JSON has no types. It is also
 *     the only one of the three that survives a caller writing `as`.
 *
 * `empireStateFaults` is the fourth line, for a payload assembled without going
 * through a constructor at all, and piece E6's element-wise ledger comparison
 * is the fifth. None of the five stops arithmetic laundering of a clock
 * reading; §4 says what does.
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
 * THE SPLIT HAS TO SURVIVE THE DERIVED QUANTITY, not only the clock reading,
 * and that is where it first failed. Tenure is what §5.2 actually names as the
 * IQ input, and it shipped as one brand for both clocks — so
 * `idleTenureDays(lifter, clock.accelerated)` produced a value assignable
 * wherever the IQ rate wanted tenure, with no cast, using only exported API,
 * carrying the purchased skip through the argument AND through
 * `NpcLifter.joinedAt`. Hazard 2's derived quantity had the fence: `SettledLevel`
 * is its own brand and `physioDaysSavedFor` takes nothing else. Hazard 1's did
 * not, in the adjacent function.
 *
 * So there are two tenure brands, `IdleTenureDays` and `SettledTenureDays`, and
 * the second has no exported constructor — `settledTenureDays` is the only
 * exported route to one, exactly as `settledLevel` is the only exported route to
 * a `SettledLevel`. Both spellings are asserted with `@ts-expect-error` in
 * `empireCore.test.ts`, in both directions, beside the signature scan that gives
 * each directive a line vitest can also redden.
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
 *
 * There are two further paths E6 has to sweep and this file does not close,
 * named here so they are obligations handed forward rather than omissions.
 *
 * The third sweep — an earned chain, not a §8.1 breach, but §4.4's shape one
 * hop out:
 *
 *   `REPUTATION_PER_CHECK_IN` -> reputation ->
 *   `SPONSOR_GYM_BUCKS_PER_DAY_BY_REPUTATION_TIER` -> Gym Bucks ->
 *   `STAFF_LEVEL_COST_GYM_BUCKS.physio` -> the day the physio arrives.
 *
 * So the physio's ARRIVAL DAY moves with the player's check-in schedule, and
 * `physioDaysSaved` is a Sim quantity. §4.4's rule about a covered day does not
 * bind here, because coverage is a windowed entitlement a lifter can be made
 * rich in at the wrong moment while physio only ever shortens a setback — an
 * earned path that only helps the diligent lifter has no monotonicity inversion
 * available. That argument is a reason to measure it rather than a substitute
 * for measuring it, and E0 does not measure it: the sweep it needs is the
 * `physioDaysSavedFor` series against a lifter who trains more, at every
 * horizon, with the counts pinned.
 *
 * The fourth sweep IS purchasable, and it is the one this header did not name
 * while §4 above put "the expansion axes" on the accelerated clock and "the
 * physio hook" on the un-accelerated one. Physio is an expansion axis whose only
 * effect is the hook, so the two sentences meet on this chain:
 *
 *   `'gym-empire-timer-skip'` -> the accelerated clock -> Gym Bucks sooner
 *   (a legal pairing, and asserted legal) -> `STAFF_LEVEL_COST_GYM_BUCKS.physio`
 *   affordable sooner -> the WALL-CLOCK DAY the physio level is bought.
 *
 * Every type on that chain is correct. The purchase day is a perfectly
 * brand-correct `UnacceleratedSeconds`; what moved with the purchase is its
 * VALUE, and §4.4 is explicit that no type gives you that — "a perfectly legal
 * tender could acquire a training sensitivity without a single type changing".
 * The only thing standing between the two sentences in §4 today is a phrase in
 * `settledLevel`'s docstring: that `completionTimes` is "when each level of that
 * axis would have finished with no accelerant applied". That is a contract E1-E5
 * have to keep when they compute the list, not a property E0 enforces — nothing
 * checks where a `readonly UnacceleratedSeconds[]` came from.
 *
 * E6's assertion, in the same element-wise shape as the ledger one: for every
 * purchasable accelerant, on every application schedule, at every horizon, the
 * list of `physioDaysSavedFor` readings by wall-clock day is byte-identical to
 * the list with no accelerant applied — with the negative control beside it,
 * wired so the skip does move the purchase day, and its non-zero count pinned.
 * An aggregate will not do: §4.4 records a legal input that moved 2362 of 34338
 * purchase-day lists and left every aggregate identical.
 *
 * The same chain acquires a §8.1 edge the day a named partner is attached to a
 * reputation tier — sponsor money then buys a shorter Sim setback, which is
 * CLAUDE.md's "a sponsor does not buy a stat" one hop out. The sponsor payout
 * is anonymous and denominated in Gym Bucks today, and `empireTuning.ts` says
 * why it may not be denominated in Chalk; attaching a partner to it is a
 * decision that has to come back through this note.
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

/**
 * `unknown` for a primitive carrying no brand, `never` for one that already
 * carries one — so `value: N & Unbranded<N>` accepts a raw number and refuses a
 * re-brand.
 *
 * This exists because every brand here IS its primitive at the type level, so
 * `asUnacceleratedSeconds(clock.accelerated)` type-checked: `AcceleratedSeconds`
 * is a `number`, and the constructor took a `number`. That is hazard 2's fence
 * walked around by the plainest spelling there is, and it is closed on every
 * `as*` constructor at once rather than on the one that was noticed.
 *
 * How many that is, is not written here. A sentence that counts them was wrong
 * by one for a round and nothing could redden it, so the count is taken by a
 * scan instead — and the scan is no longer a scan for the NAME `as*`, which is
 * how the two producers below it were missed. `brandCensus` in
 * `empireCore.test.ts` asks the compiler which exported functions produce a
 * brand and which of their parameters would accept one, so dropping this guard
 * from any of them is red rather than left to a reader's arithmetic.
 *
 * Its limit, stated because no type reaches past it: `accelerated + 0` is a
 * plain `number` and this cannot see where it came from. Arithmetic laundering
 * is deliberate in a way a re-brand is not, and E6's element-wise ledger
 * comparison is what catches it.
 */
type Unbranded<T> = T extends { readonly [EMPIRE_BRAND]: string }
  ? {
      /** Named so the compiler's message says what is wrong. See `OneAccelerant`. */
      readonly PASS_A_VALUE_THAT_CARRIES_NO_BRAND: 'this value is already branded; re-branding it is how an accelerated clock reached a wall-clock argument';
    }
  : unknown;

/** The one place a raw number acquires a brand. */
function mintNumber<B extends Branded<number, string>>(value: number): B {
  return value as B;
}

/** The one place a raw string acquires a brand. Sibling of `mintNumber`. */
function mintString<B extends Branded<string, string>>(value: string): B {
  return value as B;
}

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
 * Seconds of wall time since the gym opened — the right input to a
 * progression-reaching rate.
 *
 * Two things hold it that way and neither is the sentence you are reading.
 * `createEmpireClock` derives it from elapsed seconds alone whatever it is told
 * was skipped, which `empireCore.test.ts` sweeps; and `asUnacceleratedSeconds`
 * refuses a value already branded `AcceleratedSeconds`, which the same file
 * asserts with `@ts-expect-error`. Nothing in E0 produces one any other way,
 * and E0 is also the whole domain — the rates that will read this arrive in
 * E1-E6, so treat this as a contract those pieces have to keep rather than as
 * a property already measured across them.
 */
export type UnacceleratedSeconds = Branded<number, 'unaccelerated-seconds'>;

/**
 * Wall time plus every applied skip. The Gym Bucks economy, the roster and the
 * cosmetic layer run on this, and nothing that reaches Sim progression does.
 */
export type AcceleratedSeconds = Branded<number, 'accelerated-seconds'>;

/**
 * Tenure on the idle clock, in whole and fractional days: time since the lifter
 * appeared on the roster, which a purchased skip moves forward.
 *
 * The Gym Bucks half reads this. `asIdleTenureDays` mints one.
 */
export type IdleTenureDays = Branded<number, 'idle-tenure-days'>;

/**
 * Tenure on the wall clock, in whole and fractional days: time since the
 * recruitment would have completed unaided.
 *
 * This is hazard 1's derived quantity and it is branded apart from its sibling
 * for the same reason `SettledLevel` is branded apart from a bare number. §5.2
 * pays Training IQ "based on tier and tenure", so the rate piece E1 writes takes
 * a `SettledTenureDays`, and `settledTenureDays` — whose `now` is an
 * `UnacceleratedSeconds` and whose origin is `NpcLifter.settledAt` — is the only
 * exported route to one. (`mintSettledTenureDays` is its private callee and is
 * not exported; the constructor pin in `empireCore.test.ts` reads the export
 * list out of this file, so an `as*` sibling appearing here is red.) A caller
 * holding a tenure measured on the accelerated clock therefore has nothing to
 * pass.
 *
 * One brand for both clocks was the state this shipped in, and it left hazard 1
 * with no fence while hazard 2's `SettledLevel` had one twelve lines away —
 * CLAUDE.md's "the next thing to look at is the branch immediately below it" in
 * its literal form, since `idleTenureDays` and `settledTenureDays` are two arms
 * of one decision in adjacent functions.
 *
 * There is no exported constructor, deliberately, and that is the difference
 * between this and `IdleTenureDays`. An `asSettledTenureDays` would hand a
 * caller holding an accelerated reading a one-call route to the wall-clock
 * brand, which is the walk-around `Unbranded` exists to close on the raw clocks.
 */
export type SettledTenureDays = Branded<number, 'settled-tenure-days'>;

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

/** `true` when two types are mutually assignable, `false` otherwise. */
type Same<X, Y> = [X] extends [Y] ? ([Y] extends [X] ? true : false) : false;

/**
 * Compile-time assertion that the two halves partition the whole AND that the
 * progression-reaching half is the two outputs §12.3 is about.
 *
 * The partition half is a tautology and was shipped as one: with
 * `ProgressionReachingOutput` defined as an `Exclude`, no state of `SINK_REACH`
 * makes either `extends [never]` branch fail, so re-tagging `'training-pace'`
 * as `'idle-only'` — the single edit that opens both hazards — left this
 * resolving to `true`. The membership line is what bites: that edit empties
 * `ProgressionReachingOutput`, `Same<never, 'training-iq' | ...>` is `false`,
 * and this type becomes `never` so the declaration below no longer compiles.
 *
 * The named union is a PIN, not a second source of truth: `IdleOnlyOutput` is
 * still the mapped filter and nothing reads this. It is "counts, not bounds"
 * at the type level — the derivation's result written down so a change to it
 * is a decision somebody signs rather than a silent widening.
 *
 * `tsc --noEmit` grades this and vitest cannot: the value is the literal
 * `true`, so no state of the tables changes what a runtime assertion would read
 * from it. `empireVocabularyFaults` and the membership pins in
 * `empireCore.test.ts` are the runtime twin.
 */
export type OutputsArePartitioned =
  Same<Exclude<EmpireOutput, IdleOnlyOutput | ProgressionReachingOutput>, never> extends true
    ? Same<Extract<IdleOnlyOutput, ProgressionReachingOutput>, never> extends true
      ? Same<ProgressionReachingOutput, 'training-iq' | 'physio-days-saved'> extends true
        ? Same<
            IdleOnlyOutput,
            'gym-bucks' | 'reputation' | 'roster-slot' | 'cosmetic-unlock'
          > extends true
          ? true
          : never
        : never
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

/**
 * Compile-time assertion that no forbidden output is also a payable one.
 *
 * Adding `'chalk'` to `EMPIRE_OUTPUTS` — with the sink `satisfies` forces you
 * to write — makes this `never` and the declaration below stops compiling.
 *
 * Graded by `tsc --noEmit` and by nothing else: the value is a literal, so
 * `expect(EMPIRE_PAYS_NO_FORBIDDEN_OUTPUT).toBe(true)` is a line no state of
 * the tables can redden. That assertion was in the suite and is gone;
 * `empireVocabularyFaults` is the runtime statement of the same claim.
 */
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

/**
 * What an accelerant is licensed to touch, at the type level.
 *
 * Note what this does when `A` is not one literal: an indexed access over a
 * union key distributes, so `LicenceOfAccelerant<EmpireAccelerant>` is
 * `'idle-only' | 'progression-reaching'` — every licence there is. That is the
 * hole `OneAccelerant` below exists to close, and it is why the licence filter
 * on its own was not enforcement.
 */
export type LicenceOfAccelerant<A extends EmpireAccelerant> =
  (typeof ARRIVAL_LICENCE)[(typeof ACCELERANT_ARRIVAL)[A]][number];

/** `true` for a union of two or more members, `false` for a single one. */
type IsUnion<T, U = T> = T extends unknown ? ([U] extends [T] ? false : true) : never;

/**
 * `unknown` for a single accelerant, `never` for a union of them — so
 * `accelerant: A & OneAccelerant<A>` refuses anything but one literal.
 *
 * Every fence built out of `AccelerableOutput<A>` is only as narrow as `A` is,
 * and `A` is inferred at the CALL SITE. Two ordinary spellings widened it to
 * the declared union and dissolved the ban with no cast and only exported API:
 * a `for...of` over `EMPIRE_ACCELERANTS`, whose element type is the union, and
 * an `isEmpireAccelerant` narrowing of a decoded wire value, which narrows to
 * the union and no further. Both are asserted with `@ts-expect-error` in
 * `empireCore.test.ts`.
 *
 * The cost is real and is the right trade: a caller iterating accelerants has
 * to route through `mayAccelerate` or through the runtime constructor, which
 * throws. A caller that knows which accelerant it holds writes the literal.
 */
type OneAccelerant<A extends EmpireAccelerant> = IsUnion<A> extends true
  ? {
      /**
       * Carried only so the compiler's message names the problem. A bare
       * `never` here reads as "not assignable to parameter of type 'never'",
       * which is true and tells a reader nothing about what to do.
       */
      readonly PASS_ONE_ACCELERANT_LITERAL: 'a union widens the licence to every output';
    }
  : unknown;

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
 *
 * This is the fence that does not depend on inference — the accelerant is a
 * property of the value being checked rather than a parameter a call site
 * chooses — and it holds even when the accelerant field is typed as the whole
 * union, because TypeScript checks a union-discriminated source against every
 * member. It had no test; `empireCore.test.ts` now checks four object literals
 * against it directly, two legal and two not, one of each with a union-typed
 * accelerant.
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

/**
 * The same assertion for the accelerants, written the same way — including the
 * membership pin, because the branch immediately below a fixed check is where
 * this codebase keeps finding the next one.
 *
 * The partition half is the same tautology. The pin is what catches the edit
 * that matters here: re-tagging `'gym-empire-timer-skip'` as `'gym-progress'`
 * moves the sold skip out of `PurchasableAccelerant`, which is exactly how
 * §12.3's first refusal condition would ship, and which the partition alone was
 * indifferent to. Graded by `tsc --noEmit`; the runtime twin is the pinned
 * `PURCHASABLE_ACCELERANTS` membership in `empireCore.test.ts`.
 */
export type AccelerantsArePartitioned =
  Same<Exclude<EmpireAccelerant, PurchasableAccelerant | EarnedAccelerant>, never> extends true
    ? Same<Extract<PurchasableAccelerant, EarnedAccelerant>, never> extends true
      ? Same<
          PurchasableAccelerant,
          'gym-empire-timer-skip' | 'rewarded-ad-timer-skip'
        > extends true
        ? Same<
            EarnedAccelerant,
            'coach-staff-level' | 'space-level' | 'reputation-tier'
          > extends true
          ? true
          : never
        : never
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

/**
 * The runtime statement of what `OutputsArePartitioned`,
 * `AccelerantsArePartitioned` and `ForbiddenOutputsAreDisjoint` say at the type
 * level — walked from the tables rather than read off a literal.
 *
 * It exists because those three are `const x: T = true`, and a value that is a
 * literal cannot be reddened by any edit to the code it is about. Three
 * assertions on them were in the suite reading as independent checks and were
 * decoration. This is the half vitest can grade; `tsc --noEmit` grades the
 * other half, and the two catch different edits — see the note on each type.
 *
 * What it does NOT do is re-derive `mayAccelerate`. An oracle that recomputes
 * its subject's own lookup cannot disagree with it, which is how the cross
 * product in `empireCore.test.ts` was passing without checking anything.
 */
export function empireVocabularyFaults(): readonly string[] {
  const faults: string[] = [];

  for (const output of EMPIRE_OUTPUTS) {
    if (!(OUTPUT_SINKS as readonly string[]).includes(OUTPUT_SINK[output])) {
      faults.push(`${output} declares a sink that is not a sink`);
    }
  }
  for (const sink of OUTPUT_SINKS) {
    if (!(OUTPUT_REACHES as readonly string[]).includes(SINK_REACH[sink])) {
      faults.push(`${sink} declares a reach that is not a reach`);
    }
  }
  for (const accelerant of EMPIRE_ACCELERANTS) {
    if (!(ACCELERANT_ARRIVALS as readonly string[]).includes(ACCELERANT_ARRIVAL[accelerant])) {
      faults.push(`${accelerant} declares an arrival that is not an arrival`);
    }
  }
  for (const arrival of ACCELERANT_ARRIVALS) {
    // Read through the widened alias rather than off `ARRIVAL_LICENCE`
    // directly: the table's literal tuple types make `.length === 0` a
    // comparison TypeScript rejects as impossible, which would leave the row
    // unchecked at runtime for the state where it stops being impossible.
    const licence: readonly OutputReach[] = ARRIVAL_LICENCE[arrival];
    if (licence.length === 0) faults.push(`${arrival} licenses nothing`);
    for (const reach of licence) {
      if (!(OUTPUT_REACHES as readonly string[]).includes(reach)) {
        faults.push(`${arrival} licenses ${reach}, which is not a reach`);
      }
    }
  }

  if (PROGRESSION_REACHING_OUTPUTS.length === 0) {
    faults.push('no output reaches progression, so the ban protects nothing');
  }
  if (IDLE_ONLY_OUTPUTS.length === 0) {
    faults.push('no output is idle-only, so a purchase may touch nothing at all');
  }
  if (PURCHASABLE_ACCELERANTS.length === 0) {
    faults.push('nothing is purchasable, so the ban gates nothing');
  }
  if (EARNED_ACCELERANTS.length === 0) {
    faults.push('nothing is earned, so §5.2 pays no trickle at all');
  }

  for (const output of EMPIRE_OUTPUTS) {
    const idle = (IDLE_ONLY_OUTPUTS as readonly string[]).includes(output);
    const reaching = (PROGRESSION_REACHING_OUTPUTS as readonly string[]).includes(output);
    if (idle === reaching) faults.push(`${output} is in both halves or in neither`);
  }
  for (const accelerant of EMPIRE_ACCELERANTS) {
    const purchasable = (PURCHASABLE_ACCELERANTS as readonly string[]).includes(accelerant);
    const earned = (EARNED_ACCELERANTS as readonly string[]).includes(accelerant);
    if (purchasable === earned) faults.push(`${accelerant} is in both halves or in neither`);
  }

  for (const forbidden of EMPIRE_FORBIDDEN_OUTPUTS) {
    if ((EMPIRE_OUTPUTS as readonly string[]).includes(forbidden)) {
      faults.push(`${forbidden} is named as forbidden and is also payable`);
    }
  }

  return faults;
}

// ---------------------------------------------------------------------------
// Constructors for the branded scalars
// ---------------------------------------------------------------------------

function requireFiniteAtLeastZero(value: number, what: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${what} must be a finite number at or above zero, received ${value}.`);
  }
}

/**
 * Every constructor below takes `N & Unbranded<N>` rather than a bare
 * primitive, so a value that already carries one of this file's brands is
 * refused at the argument list. See `Unbranded` for the spelling that made this
 * necessary and for what it still cannot see.
 */

/** Gym Bucks. Refuses a negative or non-finite balance. */
export function asGymBucks<N extends number>(value: N & Unbranded<N>): GymBucks {
  requireFiniteAtLeastZero(value, 'gymBucks');
  return mintNumber(value);
}

/** Reputation, bounded by `EMPIRE_TUNING.REPUTATION_MAX`. */
export function asReputation<N extends number>(value: N & Unbranded<N>): ReputationPoints {
  requireFiniteAtLeastZero(value, 'reputation');
  if (value > EMPIRE_TUNING.REPUTATION_MAX) {
    throw new RangeError(
      `reputation must be at or below REPUTATION_MAX (${EMPIRE_TUNING.REPUTATION_MAX}), received ${value}.`,
    );
  }
  return mintNumber(value);
}

/** Training IQ points. */
export function asTrainingIq<N extends number>(value: N & Unbranded<N>): TrainingIqPoints {
  requireFiniteAtLeastZero(value, 'trainingIq');
  return mintNumber(value);
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
export function asInjuryDaysSaved<N extends number>(value: N & Unbranded<N>): InjuryDaysSaved {
  requireFiniteAtLeastZero(value, 'injuryDaysSaved');
  if (!Number.isInteger(value)) {
    throw new RangeError(`injuryDaysSaved must be a whole number, received ${value}.`);
  }
  if (value > EMPIRE_TUNING.PHYSIO_MAX_DAYS_SAVED) {
    throw new RangeError(
      `injuryDaysSaved must be at or below PHYSIO_MAX_DAYS_SAVED (${EMPIRE_TUNING.PHYSIO_MAX_DAYS_SAVED}), received ${value}.`,
    );
  }
  return mintNumber(value);
}

/**
 * Wall-clock seconds since the gym opened.
 *
 * The `Unbranded` guard is load-bearing here rather than tidy: this is the
 * constructor `asUnacceleratedSeconds(clock.accelerated)` went through, which is
 * hazard 2 in one expression. `empireCore.test.ts` asserts that spelling with
 * `@ts-expect-error`, in both directions.
 */
export function asUnacceleratedSeconds<N extends number>(
  value: N & Unbranded<N>,
): UnacceleratedSeconds {
  requireFiniteAtLeastZero(value, 'unacceleratedSeconds');
  return mintNumber(value);
}

/** Wall-clock seconds plus every applied skip. Guarded like its sibling above. */
export function asAcceleratedSeconds<N extends number>(
  value: N & Unbranded<N>,
): AcceleratedSeconds {
  requireFiniteAtLeastZero(value, 'acceleratedSeconds');
  return mintNumber(value);
}

/** Tenure on the idle clock, in days. */
export function asIdleTenureDays<N extends number>(value: N & Unbranded<N>): IdleTenureDays {
  requireFiniteAtLeastZero(value, 'idleTenureDays');
  return mintNumber(value);
}

/**
 * The one producer of `SettledTenureDays`, and it is not exported.
 *
 * Same shape as `SettledLevel`, which only `settledLevel` mints: the brand is
 * reachable through a function that takes the wall clock, and through nothing
 * else. See the type's own note for why an exported sibling of
 * `asIdleTenureDays` would be the hole rather than the symmetry.
 */
function mintSettledTenureDays(value: number): SettledTenureDays {
  requireFiniteAtLeastZero(value, 'settledTenureDays');
  return mintNumber(value);
}

/** A roster lifter's id. Refuses the empty string so a missing id is loud. */
export function asNpcId<S extends string>(value: S & Unbranded<S>): NpcId {
  if (value.length === 0) {
    throw new RangeError('npcId must not be empty.');
  }
  return mintString(value);
}

/**
 * A level counted on the un-accelerated clock.
 *
 * `completionTimes` is when each level of that axis would have finished with no
 * accelerant applied; `now` is the un-accelerated moment being asked about. The
 * level is how many of those have passed.
 *
 * Both arguments are `UnacceleratedSeconds`, and — since the fence in
 * `Unbranded` landed — the only constructor that mints one refuses a value that
 * already carries the accelerated brand. So `asUnacceleratedSeconds(
 * clock.accelerated)`, which compiled and was hazard 2 in one expression, is a
 * type error. What that does not close is arithmetic: by the time an accelerated
 * reading has had anything done to it, it is a plain number and no signature can
 * tell. E6's element-wise comparison is what covers that, not this argument
 * list.
 *
 * Read the phrase "with no accelerant applied" as a contract on the CALLER,
 * because that is all it is. Nothing here checks where a
 * `readonly UnacceleratedSeconds[]` came from, and the chain that makes the
 * distinction load-bearing — a bought skip paying Gym Bucks sooner, which buys
 * the physio level on an earlier wall-clock day — is §6's fourth sweep in the
 * header above. It is a measurement E6 owns; this argument list does not make it
 * true.
 */
export function settledLevel(
  completionTimes: readonly UnacceleratedSeconds[],
  now: UnacceleratedSeconds,
): SettledLevel {
  let level = 0;
  for (const completion of completionTimes) {
    if (completion <= now) level += 1;
  }
  return mintNumber(level);
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
 * reading is the elapsed argument it was handed.
 *
 * Both arguments are `Unbranded`, and that is the fix for the hole this
 * function WAS. It took two bare `number`s while returning two brands, so
 *
 *     createEmpireClock(clock.accelerated, 0).unaccelerated
 *
 * type-checked and handed back a purchase-moved reading wearing the wall-clock
 * brand — hazard 1 and hazard 2 both reopened, with no cast and only exported
 * API. `asUnacceleratedSeconds` had the guard; this function and
 * `createNpcLifter`, the module's other two producers of an
 * `UnacceleratedSeconds`, sat a hundred lines below the guarded set and were
 * missed because the guard was applied to everything spelled `as*`.
 *
 * The census in `empireCore.test.ts` that was supposed to catch that was scoped
 * by NAME — `/export function (as[A-Z]\w*)<[^{]*\{/g` — so it did not, and for a
 * round this comment described a re-scoping that had not happened, which is the
 * failure CLAUDE.md's "a comment that asserts a guarantee" section is about.
 *
 * It is scoped by RETURN TYPE now, and resolved through the TypeScript checker
 * rather than matched as text: `brandCensus` in `empireCore.test.ts` builds a
 * `ts.Program` over this file, finds every exported function whose return type
 * carries the `EMPIRE_BRAND` symbol anywhere inside it — nested in an
 * `EmpireClock`, an `NpcLifter` or an `EmpireState` included — and then probes
 * every parameter slot of every one of them by compiling real call
 * expressions. A slot that admits both a bare primitive and an already-branded
 * value is a fault. Neither of the two functions this note is about is spelled
 * `as*`, and both are in that census; so is anything a future piece adds,
 * whatever it is called and whether or not it is generic.
 */
export function createEmpireClock<E extends number, S extends number>(
  elapsedSeconds: E & Unbranded<E>,
  skippedSeconds: S & Unbranded<S>,
): EmpireClock {
  // Widened to the primitive before use: `E & Unbranded<E>` is a deferred
  // conditional inside this body, and the guarded constructors below cannot
  // infer through one.
  const elapsed: number = elapsedSeconds;
  const skipped: number = skippedSeconds;
  requireFiniteAtLeastZero(elapsed, 'elapsedSeconds');
  requireFiniteAtLeastZero(skipped, 'skippedSeconds');
  return Object.freeze({
    unaccelerated: asUnacceleratedSeconds(elapsed),
    accelerated: asAcceleratedSeconds(elapsed + skipped),
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

/**
 * Build a roster lifter. Every argument is validated by its own constructor.
 *
 * Four `Unbranded` arguments, for the same reason `createEmpireClock` has two:
 * this function returns three brands and took four bare primitives, so
 * `createNpcLifter('b', 'novice', 'Y', clock.unaccelerated, clock.accelerated)`
 * compiled — the settled time, which is what the Training IQ half measures
 * tenure from, taking the purchase-moved reading straight off the clock. The
 * string arguments are guarded on the same rule rather than because a laundered
 * `NpcId` is dangerous: the rule the census enforces is that a parameter which
 * accepts a raw primitive accepts no branded one, and applying it to the
 * numbers only is how the last two producers got missed.
 */
export function createNpcLifter<
  I extends string,
  D extends string,
  J extends number,
  S extends number,
>(
  id: I & Unbranded<I>,
  tier: NpcTier,
  displayName: D & Unbranded<D>,
  joinedAt: J & Unbranded<J>,
  settledAt: S & Unbranded<S>,
): NpcLifter {
  const rawId: string = id;
  const rawDisplayName: string = displayName;
  const rawJoinedAt: number = joinedAt;
  const rawSettledAt: number = settledAt;
  if (rawDisplayName.length === 0) {
    throw new RangeError('displayName must not be empty.');
  }
  return Object.freeze({
    id: asNpcId(rawId),
    tier,
    displayName: rawDisplayName,
    joinedAt: asAcceleratedSeconds(rawJoinedAt),
    settledAt: asUnacceleratedSeconds(rawSettledAt),
  });
}

/**
 * Tenure on the idle clock — what the Gym Bucks half reads.
 *
 * Both the argument and the origin carry the purchased skip: `now` is an
 * `AcceleratedSeconds` and `NpcLifter.joinedAt` is one too. The return brand
 * says so, which is the point — a quantity that moved twice with a purchase is
 * not interchangeable with one that moved not at all.
 */
export function idleTenureDays(lifter: NpcLifter, now: AcceleratedSeconds): IdleTenureDays {
  const seconds = Math.max(0, now - lifter.joinedAt);
  return asIdleTenureDays(seconds / EMPIRE_TUNING.SECONDS_PER_DAY);
}

/**
 * Tenure on the wall clock — what the Training IQ half reads.
 *
 * Takes `UnacceleratedSeconds`, so a caller holding an accelerated clock has
 * nothing to pass. Measured from `settledAt`, so a purchased skip moves neither
 * the argument nor the origin. And it returns its own brand, so the result of
 * the sibling above is not assignable where this one is required — the fence
 * that was missing while the two returned one type.
 */
export function settledTenureDays(
  lifter: NpcLifter,
  now: UnacceleratedSeconds,
): SettledTenureDays {
  const seconds = Math.max(0, now - lifter.settledAt);
  return mintSettledTenureDays(seconds / EMPIRE_TUNING.SECONDS_PER_DAY);
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

/**
 * Price of a space level, or `null` if the level is off the ladder.
 *
 * `Unbranded` because this returns a `GymBucks` and took a bare `number`: a
 * clock reading is not a level, and the census refuses a raw-accepting
 * parameter that also accepts a brand whatever the function is called.
 */
export function spaceLevelCost<L extends number>(level: L & Unbranded<L>): GymBucks | null {
  const rawLevel: number = level;
  const price = EMPIRE_TUNING.SPACE_LEVEL_COST_GYM_BUCKS[rawLevel - 1];
  return price === undefined ? null : asGymBucks(price);
}

/** Price of a staff level for a role, or `null` if the level is off that ladder. */
export function staffLevelCost<L extends number>(
  role: StaffRole,
  level: L & Unbranded<L>,
): GymBucks | null {
  const rawLevel: number = level;
  const price = EMPIRE_TUNING.STAFF_LEVEL_COST_GYM_BUCKS[role][rawLevel - 1];
  return price === undefined ? null : asGymBucks(price);
}

/**
 * Seconds one build of the given level takes, capped by `BUILD_SECONDS_MAX`.
 *
 * Guarded although it returns a bare `number` and is therefore not a producer.
 * The census's rule is about the ARGUMENT rather than the return, so stopping
 * at the producers would be the same "applied by naming convention" mistake one
 * axis over.
 */
export function buildSeconds<L extends number>(level: L & Unbranded<L>): number {
  const rawLevel: number = level;
  const raw =
    EMPIRE_TUNING.BUILD_SECONDS_BASE *
    EMPIRE_TUNING.BUILD_SECONDS_GROWTH_PER_LEVEL ** (rawLevel - 1);
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
 * The one place a pairing is built and the one place the union is re-formed.
 *
 * Not exported, and non-generic on purpose: both public constructors funnel
 * through it, so the runtime refusal cannot be present on one and absent on the
 * other. It asks `mayAccelerate` and throws, which is what makes the cast below
 * sound rather than asserted — by the time it runs, the pairing has been
 * checked against the same two tables the type reads.
 *
 * This is the third fence and it is the one that survives `as`. The first two
 * are types and a caller can always write a cast past a type; §12.3's first
 * refusal condition is worth a throw.
 */
function checkedPairing(accelerant: EmpireAccelerant, output: EmpireOutput): AcceleratedOutput {
  if (!mayAccelerate(accelerant, output)) {
    throw new RangeError(
      `${accelerant} arrives by ${ACCELERANT_ARRIVAL[accelerant]} and may not accelerate ` +
        `${output}, which reaches ${outputReach(output)}`,
    );
  }
  return Object.freeze({ accelerant, output }) as AcceleratedOutput;
}

/**
 * Build an accelerant/output pairing.
 *
 * Two arguments rather than one object, because that puts the refusal on the
 * OUTPUT: `AccelerableOutput<A>` is resolved from the accelerant passed in, so
 * a purchased skip aimed at Training IQ fails on the second argument and says
 * so by name, and a call site that gets the accelerant wrong fails separately
 * instead of being swallowed by one broad suppression — which matters where the
 * refusal is asserted with `@ts-expect-error`.
 *
 * `A & OneAccelerant<A>` is the fence that closes the widening: `A` is inferred
 * here, and a union `A` made `AccelerableOutput<A>` every output there is.
 */
export function acceleratedOutput<A extends EmpireAccelerant>(
  accelerant: A & OneAccelerant<A>,
  output: AccelerableOutput<A>,
): AcceleratedOutput {
  return checkedPairing(accelerant, output);
}

/**
 * The same pairing, stamped and sized. Guarded identically, through one callee.
 *
 * `seconds` carries `Unbranded` for the census's reason rather than for a
 * hazard of its own: this returns an `AppliedAccelerant`, whose `at` is a
 * brand, and a raw-accepting parameter on a producer may not also accept one.
 */
export function applyAccelerant<A extends EmpireAccelerant, S extends number>(
  accelerant: A & OneAccelerant<A>,
  output: AccelerableOutput<A>,
  at: UnacceleratedSeconds,
  seconds: S & Unbranded<S>,
): AppliedAccelerant {
  const rawSeconds: number = seconds;
  requireFiniteAtLeastZero(rawSeconds, 'accelerant seconds');
  return Object.freeze({
    ...checkedPairing(accelerant, output),
    at,
    seconds: rawSeconds,
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

  // Each reading is validated before the two are compared, which is the order
  // this shipped in the wrong way round. An ordering test alone accepts
  // `{ unaccelerated: -1, accelerated: -1 }` — a payload `createEmpireClock`
  // refuses on both arguments — so the runtime shadow was weaker than the
  // constructor whose absent callers it exists for. Same for a missing reading:
  // `undefined < undefined` is false, so the ordering test passed on a clock
  // with no numbers in it at all.
  if (!Number.isFinite(state.clock.unaccelerated) || state.clock.unaccelerated < 0) {
    faults.push(
      `clock: the un-accelerated reading ${state.clock.unaccelerated} is not a wall-clock time`,
    );
  }
  if (!Number.isFinite(state.clock.accelerated) || state.clock.accelerated < 0) {
    faults.push(
      `clock: the accelerated reading ${state.clock.accelerated} is not an idle-clock time`,
    );
  }
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

  // The capacity itself is checked before it is compared against, for the
  // reason the clock readings are: an axis that decoded as something other than
  // a number makes `rosterCapacity` return NaN, and `length > NaN` is false, so
  // the comparison below silently allowed any roster at all.
  const capacity = rosterCapacity(state.axes);
  if (!Number.isFinite(capacity)) {
    faults.push(`roster: ${capacity} is not a capacity`);
  } else if (state.roster.length > capacity) {
    faults.push(`roster: ${state.roster.length} lifters in ${capacity} slots`);
  }

  // Every field a constructor validates is validated again here. The loop
  // checked ids for duplication and tiers for membership and nothing else, so a
  // decoded lifter with an empty id, no display name, or a negative
  // `settledAt` was accepted — and `settledAt` is the origin `settledTenureDays`
  // measures from, so a negative one inflates the tenure GDD §5.2 pays Training
  // IQ on. That is the hazard reached through the decode boundary rather than
  // through an argument list.
  const seen = new Set<string>();
  for (const lifter of state.roster) {
    if (seen.has(lifter.id)) faults.push(`roster: duplicate lifter id ${lifter.id}`);
    seen.add(lifter.id);
    if (typeof lifter.id !== 'string' || lifter.id.length === 0) {
      faults.push('roster: a lifter arrived with no id');
    }
    if (typeof lifter.displayName !== 'string' || lifter.displayName.length === 0) {
      faults.push(`roster: ${String(lifter.id)} arrived with no display name`);
    }
    if (!(EMPIRE_TUNING.NPC_TIERS as readonly string[]).includes(lifter.tier)) {
      faults.push(`roster: ${lifter.id} is on tier ${lifter.tier}, which is not a tier`);
    }
    if (!Number.isFinite(lifter.joinedAt) || lifter.joinedAt < 0) {
      faults.push(
        `roster: ${String(lifter.id)} joined at ${lifter.joinedAt}, which is not an idle-clock time`,
      );
    }
    if (!Number.isFinite(lifter.settledAt) || lifter.settledAt < 0) {
      faults.push(
        `roster: ${String(lifter.id)} settled at ${lifter.settledAt}, which is not a wall-clock time`,
      );
    }
  }

  for (const entry of state.ledger) {
    // The stamp, checked because the amount beside it was — the branch
    // immediately below a fixed one is where this codebase keeps finding the
    // next gap, and `EmpireLedgerEntry.at` is what piece E6 aligns two ledgers
    // on before comparing them element-wise.
    if (!Number.isFinite(entry.at) || entry.at < 0) {
      faults.push(
        `ledger: ${String(entry.output)} was stamped at ${entry.at}, which is not a wall-clock time`,
      );
    }
    if (!Number.isFinite(entry.amount)) {
      faults.push(`ledger: ${entry.output} paid a non-finite amount`);
    }
    if (!isEmpireOutput(entry.output)) {
      faults.push(`ledger: ${String(entry.output)} is not an empire output`);
    }
  }

  for (const applied of state.accelerants) {
    if (!Number.isFinite(applied.at) || applied.at < 0) {
      faults.push(
        `accelerants: ${String(applied.accelerant)} was stamped at ${applied.at}, which is not a wall-clock time`,
      );
    }
    if (!Number.isFinite(applied.seconds) || applied.seconds < 0) {
      faults.push(`accelerants: ${applied.accelerant} applied for ${applied.seconds} seconds`);
    }
    // The vocabulary is checked before it is looked up. `mayAccelerate` indexes
    // two tables, so an unknown accelerant made `accelerantLicence` return
    // undefined and the `.includes` beneath it throw a TypeError — which turns
    // a function whose whole contract is to COLLECT faults into one that throws
    // the wrong error out of `assertEmpireState`. A pairing this module has no
    // verdict for is a fault, not an exception.
    if (!isEmpireAccelerant(applied.accelerant) || !isEmpireOutput(applied.output)) {
      faults.push(
        `accelerants: ${String(applied.accelerant)} on ${String(applied.output)} is not a pairing this module has a verdict for`,
      );
      continue;
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
