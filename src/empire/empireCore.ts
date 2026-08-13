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
 * 6. What the composition asserts, and what this file hands it
 * ===========================================================================
 *
 * The second reading of "structurally unable" is that the output does not move,
 * and GDD §4.4 records a builder who believed a check covered it when mutation
 * testing found a legal input that moved 2362 of 34338 purchase-day lists,
 * produced zero violations and left every aggregate identical. So the
 * assertion is on the list itself, element by element:
 *
 *   For every purchasable accelerant, at every horizon, applied on every
 *   schedule, the progression-reaching half of a composed run's ledger is
 *   byte-identical to the same half with no accelerant applied — compared
 *   element-wise, not by a sum, not by a bound.
 *
 * And it needs a negative control beside it: the same sweep against a variant
 * wired so the purchase does reach the wall-clock side, with its non-zero count
 * pinned. A zero with nothing beside it is the empty-domain vacuity this
 * codebase has been bitten by repeatedly.
 *
 * What this file provides for that: `PURCHASABLE_ACCELERANTS` as the derived
 * list the sweep iterates so it cannot miss one that was added later, and
 * `WALL_CLOCK_FUNDED_OUTPUTS` as the derived list that decides which purse a
 * rung is bought from.
 *
 * `progressionLedger`, `idleLedger` and `EmpireLedgerEntry` are NOT that list,
 * and this note said they were for several waves. They partition an ACCRUAL's
 * own ledger — the flow one call to `accrueProduction`, `accrueReputation` or
 * `accrueSponsorship` paid — and `production.test.ts` is where they are asserted
 * on. The composition asserts on a different quantity: a day-stamped STOCK
 * series, `EmpireDayEntry`, partitioned by `progressionDayLedger` /
 * `idleDayLedger` and compared by `compareLedgers`, all four of them in
 * `empireInvariant.ts`. Two shapes because they answer two questions, and
 * `EmpireState.ledger` below says which of the two it is.
 *
 * The third chain is measured now, and by a file this note did not name:
 * `engagement.ts` and `engagement.test.ts`. It is an earned chain, not a §8.1
 * breach, but §4.4's shape one hop out:
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
 * for measuring it, and the measurement it asked for is `engagement.ts`: the
 * physio arrival day and the `physioDaysSavedAt` series against a gym that
 * CHECKS IN more and a lifter who TRAINS more, at every horizon, with the
 * counts pinned. The composed sweep in `empireInvariant.ts` varies the purchase
 * and holds the check-in schedule fixed, so it is a sweep over a different
 * variable and is no evidence at all about this one; `engagement.ts` moves that
 * variable and holds the purchase at none. Its numbers are in §6's measured
 * list below. What has changed in the chain itself is its width rather than its
 * existence: the physio rung is no longer bought out of the book the sponsor
 * line is paid into, so the last hop now runs through the reputation GATE on a
 * recruit rather than through the price of the rung.
 *
 * The fourth chain IS purchasable, and it is the one this header did not name
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
 * `settledLevel`'s docstring says `completionTimes` is "when each level of that
 * axis would have finished with no accelerant applied", and that is a contract
 * on the CALLER: nothing here checks where a `readonly UnacceleratedSeconds[]`
 * came from.
 *
 * `WALL_CLOCK_FUNDED_OUTPUTS` below is what makes the contract keepable rather
 * than hoped for: the purse a rung is bought from is derived from the reach of
 * the output it feeds, the same way `elapsedFor` derives a clock, so the physio
 * rung is bought out of the physio entry of `EmpireState.settledBooks` — money
 * the baseline line delivers on the wall clock and no purchase moves. `WallClockBooks`
 * is the second half of that ruling: one purse per funded output, so the
 * schedule cannot decide which spender reaches a shared balance first either.
 *
 * WHAT IS ACTUALLY MEASURED, because this note asked for a measurement for
 * several waves before one existed, and a header that names a check nobody ran
 * is worse than one that names a gap:
 *
 *   - THE PURCHASE AS THE VARIABLE. `empireInvariant.test.ts` composes §5 over
 *     a calendar and compares, for every purchasable accelerant, on every
 *     application schedule, at every horizon and at both cadences, the
 *     `physioDaysSavedAt` series AND the Training IQ series element by element
 *     and by wall-clock arrival day — on the gym the accelerant landed on, not
 *     on a second gym stepped without one. Zero of 2616 elements and zero of
 *     144 physio arrival days move; the same grid funded from the accelerated
 *     book moves 84 of 2616 elements and 32 of 128 arrival days, every one of
 *     the 32 EARLIER.
 *   - `empireInvariant.ts`'s own header — §4a, not the test file's — lists the
 *     mutants that sweep kills, this function's gate revert among them, and the
 *     two it does not, which are killed in `expansion.test.ts` and
 *     `recruitment.test.ts` instead.
 *   - THE PLAYER'S ENGAGEMENT AS THE VARIABLE, which is the third chain above
 *     and which nothing measured for several waves while this note said so.
 *     `engagement.ts` and `engagement.test.ts` hold the check-in schedule as
 *     the independent variable and apply no accelerant at all — the opposite
 *     assignment to every other sweep in this directory — over 33 checks.
 *     Exhaustively over every calendar of a window of check-in slots: 0
 *     violating pairs of 24576, 0 physio arrivals later, against a comparator
 *     that moved 19778 of those pairs. Its physio zero is a zero against chain
 *     A RE-CONNECTED — the `'accelerated-purse'` wiring, which is this
 *     directory as it stood before GDD §5.4's two-books ruling and in which the
 *     sponsor line is money the physio rung is bought with — pinned at 263 of
 *     24576 pairs where checking in MORE moved the physio arrival a day later.
 *
 * An aggregate would not have done: §4.4 records a legal input that moved 2362
 * of 34338 purchase-day lists and left every aggregate identical.
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
export type Unbranded<T> = T extends { readonly [EMPIRE_BRAND]: string }
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
 * ===========================================================================
 * THE THREE STRING BRANDS BELOW EXIST FOR ONE REASON, AND IT IS A MEASUREMENT
 * ===========================================================================
 *
 * Every bypass this directory's forbidden-output guard has been shown had the
 * same shape: a forbidden name read out of `EMPIRE_FORBIDDEN_OUTPUTS` and
 * assigned into a field declared as a bare `string`, behind a numeric branch
 * point the sampling instrument's domain did not reach. Eight rounds each
 * closed one branch point and declared the next; a ninth was declared open,
 * above `OVERFLOW_ALLOCATION_CEILINGS.ROSTER_SHAPE`, because a domain is a
 * sample and the author picks the branch point after seeing the sample.
 *
 * A TENTH CAME OUT OF THAT SAME REGION AND DID NOT HAVE THAT SHAPE, WHICH IS
 * THE BOUND ON EVERYTHING BELOW. `completeRecruitment` throwing
 * `EMPIRE_FORBIDDEN_OUTPUTS[0]` on an over-capacity roster is `tsc` exit 0 and
 * always will be: a thrown `Error`'s message is not a field, so there is no
 * position for a brand to sit on. The brands close ASSIGNMENT INTO A DECLARED
 * POSITION. They do not close the throw channel, and nothing here should be
 * read as claiming they do — what covered that at E18 was the drive, and
 * specifically `empireForbiddenOutput.test.ts`'s overflow pass reaching the
 * region the roster-size ceiling used to drop. It is M25 in `PLANTED_ROUTES`.
 *
 * THE THROW CHANNEL HAS ITS OWN PAIR SINCE E19, and the sentence above is left
 * exactly as it was because it is still true of the BRANDS. What closes the
 * channel is not a brand: it is `refuseWith`, the wrap every throw in this
 * directory is written as a call to, plus `THROW_GATE_SITES` — the same
 * containment-and-enumeration pair this note describes for the constructors,
 * one channel over. See `refuseWith` below for what each half does and does not
 * cover.
 *
 * The probe that made this file's answer possible, run at `dcc65bb` and again
 * before this change:
 *
 *     export const direct: NpcId = EMPIRE_FORBIDDEN_OUTPUTS[0];
 *     export const laundered: NpcId = asNpcId(EMPIRE_FORBIDDEN_OUTPUTS[0]);
 *
 *     src/empire/__probe.ts(3,14): error TS2322: Type 'string' is not
 *       assignable to type 'NpcId'.
 *       Type 'string' is not assignable to type
 *       '{ readonly [EMPIRE_BRAND]: "npc-id"; }'.
 *
 * Exit 2, one error, on line 3 and not on line 5. So the assignment route into
 * a BRANDED field is refused by the compiler at every branch point at once —
 * no domain, no drive, no budget — and the constructor route is not.
 *
 * WHAT THESE BRANDS GUARANTEE, IN THE MECHANISM'S OWN TERMS: a value of type
 * `string` cannot be assigned into a field of one of these types. That is the
 * whole claim, and it is the compiler's claim rather than a sentence here.
 *
 * THE ROUTE THAT GETS PAST IT, NAMED CONCRETELY ENOUGH TO PLANT: line 5 of the
 * probe. A brand is a constructor discipline, not an enumeration, so
 * `asGymId(EMPIRE_FORBIDDEN_OUTPUTS[0])` compiles and always will.
 *
 * THE CHECKS THAT COVER THAT ROUTE, NAMED SPECIFICALLY ENOUGH TO RUN: two, and
 * neither is complete alone.
 *   - `refuseForbiddenName`, called by all four string constructors below. It
 *     is CONTAINMENT, NOT DETECTION: it fires when the path runs, so it makes
 *     the value unshippable rather than the guard complete. A constructor call
 *     on a branch nothing ever executes throws nothing.
 *   - `the brand constructor call sites are exactly the declared ones` in
 *     `empireForbiddenOutput.test.ts`, which resolves every call to these four
 *     functions through the checker and set-equals the sites against
 *     `DECLARED_BRAND_CONSTRUCTOR_CALLS` in both directions. A new call site is
 *     red whether or not anything drives it. That is detection, and its own
 *     limit is that it detects a SITE and not what the site does.
 * ===========================================================================
 */

/**
 * Another gym's identity — a board row, a friend, or the rival.
 *
 * It arrives from outside this directory entirely and there is no closed set of
 * them to narrow to. `DECLARED_BARE_STRING_FIELDS` used to give that as the
 * reason the field stayed a bare `string`, and it is a true sentence about an
 * ENUMERATION and a false one about a BRAND: `asGymId` narrows nothing about
 * which gyms exist, and that is not what it is for. What it does is make the
 * assignment route above a compile error and route every value that reaches the
 * field through one named function, so the call sites are enumerable even
 * though the values are not.
 */
export type GymId = Branded<string, 'gym-id'>;

/**
 * A shown name — a roster lifter's (§5.3's customisation hook) or a gym's.
 *
 * Free text the player or the server chose, and deliberately still free text:
 * one brand for both because they are the same kind of thing and two would
 * drift. `NpcLifter.displayName` and `GymSnapshot.displayName` are the two
 * fields.
 */
export type DisplayName = Branded<string, 'display-name'>;

/**
 * One sentence of diagnostic prose from a `*Faults` function.
 *
 * The diagnostic channel is the one place a forbidden name is legitimately
 * SPOKEN — `covered-day is named as forbidden and is also payable` is the
 * module reporting a fault rather than paying one — so this brand's refusal is
 * by equality and never by containment, and `empireForbiddenOutput.test.ts`
 * treats these positions the same way for the same reason.
 */
export type FaultMessage = Branded<string, 'fault-message'>;

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

/**
 * An accelerant's licence, by the same two-hop lookup as the type.
 *
 * NOT TOTAL, and said so rather than left for a caller to find: for a value
 * that is not an accelerant this indexes twice and returns undefined, which its
 * signature denies. It is a lookup for callers the compiler has checked.
 * `mayAccelerate` below is the one that takes untyped input, and it narrows
 * before it reaches this.
 */
export function accelerantLicence(accelerant: EmpireAccelerant): readonly OutputReach[] {
  return ARRIVAL_LICENCE[ACCELERANT_ARRIVAL[accelerant]];
}

/**
 * Whether this accelerant may touch this output.
 *
 * The compiler already refuses the illegal pairing at every call site written
 * in TypeScript. This is for the call sites that are not: a settled order
 * decoded from an Edge Function response is JSON, and JSON has no types.
 *
 * That sentence was the whole point of the function and was false for a round.
 * It went straight to `accelerantLicence(...).includes(...)`, so a decoded
 * accelerant the tables have never heard of threw a `TypeError` out of it —
 * out of `empireStateFaults`, whose contract is to COLLECT faults, and
 * therefore out of `assertEmpireState` as the wrong error. Unknown vocabulary
 * is refused here, which is the answer a licence question has for a word it
 * does not know.
 */
export function mayAccelerate(accelerant: EmpireAccelerant, output: EmpireOutput): boolean {
  if (!isEmpireAccelerant(accelerant) || !isEmpireOutput(output)) return false;
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
export function empireVocabularyFaults(): readonly FaultMessage[] {
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

  // The gate table, walked the same way. Read through a widened alias for the
  // reason the licence rows above are: the literal tuple type makes
  // `.length === 0` a comparison TypeScript rejects as impossible, which would
  // leave the empty case unchecked for the state where it stops being one.
  const gating: readonly string[] = GATING_OUTPUTS;
  if (gating.length === 0) {
    faults.push('nothing gates a progression-reaching output, so the gate clock guards nothing');
  }
  for (const output of GATING_OUTPUTS) {
    if (!(EMPIRE_OUTPUTS as readonly string[]).includes(output)) {
      faults.push(`${output} is named as a gate and is not an empire output`);
      continue;
    }
    const target = gateTarget(output);
    if (!(EMPIRE_OUTPUTS as readonly string[]).includes(target)) {
      faults.push(`${output} gates ${target}, which is not an empire output`);
      continue;
    }
    if (outputReach(target) !== 'progression-reaching') {
      faults.push(`${output} gates ${target}, which does not reach progression`);
    }
  }

  return faults.map((message) => asFaultMessage(message));
}

// ---------------------------------------------------------------------------
// Constructors for the branded scalars
// ---------------------------------------------------------------------------

function requireFiniteAtLeastZero(value: number, what: string): void {
  if (!Number.isFinite(value) || value < 0) {
    refuseWith(`${what} must be a finite number at or above zero, received ${value}.`);
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
    refuseWith(
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
    refuseWith(`injuryDaysSaved must be a whole number, received ${value}.`);
  }
  if (value > EMPIRE_TUNING.PHYSIO_MAX_DAYS_SAVED) {
    refuseWith(
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

/**
 * The runtime half of the string brands, and the half that is CONTAINMENT
 * RATHER THAN DETECTION.
 *
 * Every string brand constructor in this directory calls this. It refuses a
 * value that IS a member of `EMPIRE_FORBIDDEN_OUTPUTS`, so the constructor
 * route the brands cannot type away — `asGymId(EMPIRE_FORBIDDEN_OUTPUTS[0])` —
 * throws instead of returning a branded forbidden name.
 *
 * WHAT THAT IS AND IS NOT. It fires only when the call runs. A constructor call
 * sitting behind a branch no domain reaches produces no value and therefore
 * throws nothing, which is exactly the sampling limit this round exists to stop
 * relying on. So this makes such a value UNSHIPPABLE — it cannot be handed to a
 * caller — and it does not make the guard complete. The detection half is the
 * call-site census named in the brands' own note above, which is red on a new
 * site whether or not anything drives it. Those are two different properties
 * and this comment does not blur them.
 *
 * ITS TWO LIMITS, EACH WITH THE CHECK THAT COVERS IT.
 *   - EQUALITY, NOT CONTAINMENT. `asDisplayName('Chalk Dust Barbell')` is
 *     allowed, deliberately: a display name is text a player chose, and a
 *     containment refusal here would reject a legitimate name to catch a
 *     laundering that instrument B already reads. `observeEverything` in
 *     `empireForbiddenOutput.test.ts` compares every value it reaches against
 *     `BANNED_VOCABULARY` by CONTAINMENT as well as by equality, for every
 *     position outside the diagnostic channel.
 *   - ONE BAN LIST, NOT BOTH. `FORBIDDEN_UNLOCK_KEYS` lives in `reputation.ts`,
 *     which imports this module, so reading it here would be an import cycle.
 *     `BANNED_VOCABULARY` is the union of the two lists and instrument B sweeps
 *     it, so the second list is covered behaviourally and not here.
 */
function refuseForbiddenName(value: string, brand: string): void {
  if ((EMPIRE_FORBIDDEN_OUTPUTS as readonly string[]).includes(value)) {
    throw new RangeError(
      `${brand} must not be a forbidden empire output; the idle layer may not produce ${value}.`,
    );
  }
}

/**
 * The one way a value leaves this directory by ABRUPT completion.
 *
 * Every `throw` in every shipped module of `src/empire/` is written as a call to
 * this. It refuses a message that IS a member of `EMPIRE_FORBIDDEN_OUTPUTS` and
 * throws a `RangeError` carrying the caller's message otherwise, so the tenth
 * bypass's shape — `throw new RangeError(EMPIRE_FORBIDDEN_OUTPUTS[0])` — hands
 * its caller the refusal rather than the name.
 *
 * WHAT IT GUARANTEES, IN THE MECHANISM'S OWN TERMS: of the values that leave by
 * a `throw` routed through here, none equals a forbidden output. That is a
 * property of the calls that RUN, in the same containment-not-detection sense
 * `refuseForbiddenName` states above it: a `refuseWith` sitting on a branch
 * nothing executes refuses nothing. So this makes a forbidden thrown message
 * UNSHIPPABLE — it cannot reach a caller — and it does not make the guard
 * complete. Those are two properties and this note does not run them together.
 *
 * THE ROUTE PAST IT, NAMED CONCRETELY ENOUGH TO PLANT: a raw
 * `throw new RangeError(EMPIRE_FORBIDDEN_OUTPUTS[0])` written anywhere in this
 * directory reaches this function not at all. A wrap contains what goes through
 * it and nothing else, which is why the wrap alone would be a convention.
 *
 * THE CHECK THAT COVERS THAT ROUTE, NAMED SPECIFICALLY ENOUGH TO RUN: `every
 * throw in this directory is written as a call to the wrap` in
 * `empireForbiddenOutput.test.ts`. It walks the shipped modules with the
 * checker, and set-equals the `throw` channel's site list against
 * `THROW_GATE_SITES` — the two gates named below — so a raw `throw` anywhere
 * else is red by file and by enclosing function, whether or not anything drives
 * it. That is the detection half, and its own limit is that it counts a SITE and
 * says nothing about the payload an existing site carries.
 *
 * THE SECOND LIMIT, WHICH IS THE ONE A READER WILL ASSUME WRONG: this compares
 * by EQUALITY, exactly as `refuseForbiddenName` does, so
 * `refuseWith(`covered-day is not payable`)` is allowed and is meant to be —
 * every legitimate message in this directory is a sentence and 41 of the 54
 * sites are template literals. A message that CONTAINS a banned name is covered
 * behaviourally instead, by `CONTAINS no banned name either, outside the
 * diagnostic channel, and the exemption is measured` in the same file, which
 * scans every thrown payload the drive produces by containment.
 *
 * THE TWO GATES, AND WHY THERE ARE TWO RATHER THAN ONE. `refuseForbiddenName`
 * keeps a raw `throw` and so does this function's own last line. Routing either
 * of them through this wrap was considered and refused: `refuseForbiddenName`'s
 * message quotes the offending value, so sending it back in would make the two
 * refusals mutually recursive for the sake of a message that is a sentence
 * rather than a name. It would terminate — the refusal text is not EQUAL to a
 * ban-list member, so the second pass would fall through and throw — and
 * "terminates" is a poor reason to build a cycle. Both gates are therefore
 * named data in `THROW_GATE_SITES`, and a third one arriving is red there.
 *
 * NO BRAND ON `message`, AND THAT WAS MEASURED RATHER THAN OMITTED. E18 graded
 * `refuseWith(message: FaultMessage)` in five configurations and recorded it as
 * M28: unminted, `tsc` gives the identical `TS2345` on the bare ban-list read
 * and on a legitimate template literal, so the configuration where the brand
 * bites refuses 41 real sites; minted, the bypass compiles. The brand buys
 * nothing in any configuration this directory can ship, and the containment
 * above needs none.
 */
export function refuseWith(message: string): never {
  refuseForbiddenName(message, 'thrownMessage');
  throw new RangeError(message);
}

/** A roster lifter's id. Refuses the empty string so a missing id is loud. */
export function asNpcId<S extends string>(value: S & Unbranded<S>): NpcId {
  if (value.length === 0) {
    refuseWith('npcId must not be empty.');
  }
  refuseForbiddenName(value, 'npcId');
  return mintString(value);
}

/**
 * Another gym's id.
 *
 * WHAT IT ACCEPTS, AND WHY, since a brand's constructor is the whole design
 * once the type has been chosen: any non-empty string that is not a forbidden
 * output. Not a narrower rule, and the narrower rules were considered rather
 * than skipped.
 *
 * A character-set or length rule would be this directory inventing a wire
 * format for a value that arrives from a server nobody has written yet, and the
 * first real id that failed it would be a shipped defect caused by a guard
 * guessing. A closed set is impossible for the same reason
 * `DECLARED_BARE_STRING_FIELDS` gave — there is no closed set of other people's
 * gyms.
 *
 * So the constructor is deliberately permissive about SHAPE and the brand does
 * its work on ROUTE: the value has exactly one way in, and that way is counted.
 * `socialContextFaults` is where a malformed id is reported, and it stays the
 * place that judges content.
 */
export function asGymId<S extends string>(value: S & Unbranded<S>): GymId {
  if (value.length === 0) {
    refuseWith('gymId must not be empty.');
  }
  refuseForbiddenName(value, 'gymId');
  return mintString(value);
}

/**
 * A shown name, for a lifter or a gym.
 *
 * Accepts any non-empty string that is not a forbidden output, for the reason
 * `asGymId` gives at length: this is player- or server-authored free text and a
 * shape rule here would be a guess about somebody else's data. The non-emptiness
 * check is the one `createNpcLifter` already made inline, moved here so both
 * fields get it.
 */
export function asDisplayName<S extends string>(value: S & Unbranded<S>): DisplayName {
  if (value.length === 0) {
    refuseWith('displayName must not be empty.');
  }
  refuseForbiddenName(value, 'displayName');
  return mintString(value);
}

/**
 * One sentence of diagnostic prose.
 *
 * WHERE THE MINT SITS, AND WHY IT IS AT THE BOUNDARY RATHER THAN AT EVERY PUSH.
 * The eight `*Faults` functions build their lists with 125 `faults.push(...)`
 * calls, and wrapping each of them would put a constructor call at every one of
 * those sites.
 *
 * THE ARGUMENT THIS NOTE USED TO MAKE FOR THAT CHOICE WAS HALF RIGHT, AND THE
 * HALF IT GOT WRONG IS THE ONE THAT MATTERS. It read: "every one of them a
 * template literal. A template literal is a plain `string`, so wrapping each
 * push would … buy NOTHING at compile time over minting once at the return:
 * either way the literal reaches a constructor, which is route 2 and not route
 * 1." That is exactly true OF A TEMPLATE LITERAL, and it is false of the shape
 * every bypass this directory has been shown actually used — a bare `string`
 * read out of the ban list, which is not a template literal and does not need a
 * constructor to get into a `string[]`.
 *
 * MEASURED, in `socialContextFaults`, three configurations, recorded as M26 in
 * `PLANTED_ROUTES`:
 *
 *   - shipped `const faults: string[]`, `faults.push(EMPIRE_FORBIDDEN_OUTPUTS[0])`
 *     — `tsc --noEmit` exit 0.
 *   - `const faults: FaultMessage[]`, same push — exit 2, `TS2345: Argument of
 *     type 'string' is not assignable to parameter of type 'FaultMessage'`, and
 *     the same error on every template push beside it.
 *   - `FaultMessage[]` with every push minted — exit 0, and contained at
 *     runtime by the refusal below. Route 2, as predicted.
 *
 * So the wrap converts the bypass shape from CONTAINMENT to DETECTION. It is
 * not taken here, and the reason is stated as a trade rather than as a proof:
 * the shipped channel is contained, not open — this constructor runs on every
 * message at all eight `*Faults` returns, so such a value can never be handed
 * to a caller — and the price of the wrap is 125 sites and the census rows that
 * come with them. A reader who would rather have detection than containment
 * should read M26 and take it; the measurement is there so that is a decision
 * rather than an inheritance.
 *
 * SO STATE THE COST PLAINLY RATHER THAN IMPLYING THE FENCE IS UNIFORM: inside a
 * `*Faults` body, `faults.push(EMPIRE_FORBIDDEN_OUTPUTS[0])` still type-checks.
 * It is caught by this constructor throwing when the function is driven —
 * containment, and measured rather than asserted: that mutant was planted and
 * is recorded as M15 in `PLANTED_ROUTES`.
 *
 * AND THE SAME LIMIT ONE STEP OUT, NAMED BECAUSE IT IS WHERE THE TENTH BYPASS
 * WENT: a `throw new RangeError(<a bare string>)` reaches no constructor at
 * all, so it was neither typed nor contained. `completeRecruitment` is where
 * that was planted and the overflow pass is what caught it; see the brand
 * note at the top of this file.
 *
 * THAT PARAGRAPH IS WRITTEN IN THE PAST TENSE SINCE E19, AND THE REPAIR IT
 * PREDICTED IS THE ONE THAT WAS TAKEN. `refuseWith` is that wrap and it sits
 * fifty lines above this comment; every `throw` in every shipped module of this
 * directory is a call to it, and `THROW_GATE_SITES` in
 * `empireForbiddenOutput.test.ts` is the enumeration that keeps it that way.
 *
 * ITS BRAND IS STILL REFUSED, and that is the half of M28 that stands. Recorded
 * in `empireForbiddenOutput.test.ts`, five configurations: a
 * `refuseWith(message: FaultMessage)` refuses the bare ban-list read and the
 * legitimate template literal with the SAME `TS2345`, and there were 54 throw
 * sites of which 41 are template literals, so the configuration where the brand
 * bites is one this directory cannot ship; the one it can ship mints, and a
 * mint compiles the bypass. What the wrap buys is runtime containment, and that
 * half needs no brand at all — which is why the shipped `refuseWith` takes a
 * plain `string`.
 */
export function asFaultMessage<S extends string>(value: S & Unbranded<S>): FaultMessage {
  refuseForbiddenName(value, 'faultMessage');
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
// Gates — a reach as a PAYOUT and a reach as a GATE are two different questions
// ---------------------------------------------------------------------------

/**
 * Outputs whose READING decides when something progression-reaching arrives.
 *
 * `elapsedFor` hands an output the clock its own reach entitles it to, and that
 * is the right answer for a PAYOUT. It is the wrong answer for a GATE, and the
 * difference is what piece E4 measured and left open. Reputation is paid into
 * the gym economy — `OUTPUT_SINK` sends it to `'gym-economy'` and `SINK_REACH`
 * calls that `'idle-only'` — so `elapsedFor(clock, 'reputation')` is the
 * accelerated reading, which is correct for a number a screen shows and for a
 * sponsor line denominated in Gym Bucks. It is also the number
 * `NPC_RECRUIT_REPUTATION_THRESHOLD` gates a recruit on, and a recruited lifter
 * pays Training IQ. So a purchased skip lengthened the idle gap, reputation
 * accrued against the longer gap, a higher tier's milestone was met on an
 * earlier WALL-CLOCK day, and `NpcLifter.settledAt` landed earlier with a larger
 * `NPC_TIER_OUTPUT_MULTIPLIER` behind it.
 *
 * Every type on that chain was correct, which is the point: reach was being
 * asked about the payout when the question was about the gate.
 *
 * A new entry costs a row in `GATE_TARGET`, which is exhaustive by `satisfies`
 * and typed against `ProgressionReachingOutput` — so a gate declared on
 * something that does not reach progression does not compile, and
 * `gateElapsedFor` cannot be re-pointed at the accelerated clock without that
 * row changing first.
 *
 * `'roster-slot'` is the second row and it arrived by the same argument one
 * subsystem over. A slot is paid into the gym economy — §5.4's "more racks,
 * platforms, NPC slots" — so `elapsedFor(clock, 'roster-slot')` is the
 * accelerated reading and that is right for a number a screen shows. It is also
 * what `recruitmentRefusals` compares the roster against, and the lifter who
 * fills the slot pays Training IQ. So a purchased skip that finished a space
 * build early opened a slot on an earlier WALL-CLOCK day, a recruit started on
 * that day, and `NpcLifter.settledAt` — the origin the trickle measures tenure
 * from — moved with the purchase. Same shape as the reputation row: reach was
 * being asked about the payout when the question was about the gate.
 */
export const GATING_OUTPUTS = [
  'reputation',
  'roster-slot',
] as const satisfies readonly EmpireOutput[];

export type GatingOutput = (typeof GATING_OUTPUTS)[number];

/** What each gating output gates. Exhaustive by `satisfies`. */
export const GATE_TARGET = {
  reputation: 'training-iq',
  'roster-slot': 'training-iq',
} as const satisfies Readonly<Record<GatingOutput, ProgressionReachingOutput>>;

/** The progression-reaching output a gating reading decides the arrival of. */
export function gateTarget(output: GatingOutput): ProgressionReachingOutput {
  return GATE_TARGET[output];
}

/**
 * The clock a gating reading runs on.
 *
 * Derived rather than chosen: it is `elapsedFor` asked about the thing the gate
 * OPENS rather than about the thing the gate is paid into, and `GATE_TARGET` is
 * typed so the thing it opens always reaches progression. The wall-clock brand
 * on the return type is therefore a consequence of the table rather than a cast
 * — there is no state of `GATE_TARGET` that compiles and makes this return an
 * accelerated reading.
 */
export function gateElapsedFor(clock: EmpireClock, output: GatingOutput): UnacceleratedSeconds {
  return elapsedFor(clock, gateTarget(output));
}

// ---------------------------------------------------------------------------
// Which money buys a thing — the same question as which clock reads it
// ---------------------------------------------------------------------------

/**
 * The outputs whose next level may only be bought with wall-clock-earned money.
 *
 * Derived from the two tables above rather than written: an output is on this
 * list when it reaches Sim progression, or when it GATES something that does.
 * Re-tagging `'training-pace'` in `SINK_REACH`, or deleting a row from
 * `GATING_OUTPUTS`, empties rows out of this list; nothing else can.
 *
 * Why a list of outputs decides which purse pays. `elapsedFor` answers "which
 * clock may READ this", and the clock split alone was measured insufficient:
 * an accelerated purse buys the physio level on an earlier WALL-CLOCK day, and
 * `startExpansion` then stamps a perfectly brand-correct `settledCompletion`
 * from that earlier day. Every type on the chain is right and the VALUE moved,
 * which GDD §4.4 says no type gives you. So the purse is chosen the same way
 * the clock is — from the reach of the thing being bought — and
 * `EmpireState.settledBooks` is the money on that side of the split. (A single
 * `settledGymBucks` field is what this sentence used to name, and it is the
 * engine GDD §5.4's third-book ruling replaced; the next paragraph is the one
 * that was already right.)
 *
 * The cost of this is a design decision rather than a transcription, and it is
 * stated where a reader meets it: the gym keeps an accelerated book and a
 * wall-clock book PER FUNDED OUTPUT. `gymBucks` is the accelerated book, and it
 * buys everything §8.3A and §8.3B sell — decor, cosmetics, the equipment
 * ladder, the coach ladder. `settledBooks` holds the rest, and it is the only
 * money §5.4's capability rungs and §5.3's recruits may be bought with. A
 * player who buys skips still gets what §8.3B sells — the build finishes now,
 * the lifter is on the floor now — and does not get to buy the NEXT rung of a
 * progression-reaching ladder any sooner.
 */
export type WallClockFundedOutput = ProgressionReachingOutput | GatingOutput;

export const WALL_CLOCK_FUNDED_OUTPUTS: readonly WallClockFundedOutput[] = EMPIRE_OUTPUTS.filter(
  (output): output is WallClockFundedOutput =>
    outputReach(output) === 'progression-reaching' ||
    (GATING_OUTPUTS as readonly EmpireOutput[]).includes(output),
);

/**
 * The gym's wall-clock BOOKS: one purse per wall-clock-funded output, and the
 * money in one may not be spent on another.
 *
 * GDD §5.4's third-book ruling, and the shape of it is a consequence of the
 * list above rather than a list of its own. One purse was measurably not
 * enough: the outputs on that list have four distinct spenders between them —
 * §5.4's space and spotter ladders, §5.4's physio ladder and §5.3's recruits —
 * and while they drew on one balance, the CHECK-IN SCHEDULE decided which of
 * them the money reached first. A player who opened the app more often bought a
 * different rung at a different moment and could end on a LOWER §5.2 Training
 * IQ series than a player who opened it less, which is CLAUDE.md's "never
 * punish daily engagement" broken by the composition rather than by any one
 * table.
 *
 * Non-fungible is the whole mechanism. A purse with one spender is spent in
 * ladder order at the first moment it can afford the next rung, so the day that
 * rung lands is a function of wall time and the cost table — monotone in the
 * player's own attendance, because attending more can only move accrual earlier
 * and never later. A purse with two spenders has an ORDER, and an order is
 * something a schedule can move.
 *
 * `'reputation'` keeps a purse here and nothing spends it: reputation is earned
 * per check-in rather than bought, so no axis feeds it and no recruit is priced
 * in it. It is derived rather than special-cased: `WALL_CLOCK_FUNDED_OUTPUTS`
 * is computed from reach, `'reputation'` is a `GATING_OUTPUTS` member, and a
 * purse falls out. That is the whole reason, and it is a better one than any
 * forecast about future mechanics.
 *
 * Do not read the empty purse as §5.4's Reputation row being unbuilt — it is
 * not. `reputation.ts` implements that row in full: the tier thresholds, the
 * sponsor payouts and the NPC unlocks §5.4 lists under "attracts higher-tier
 * NPCs, sponsorships". What §5.4 does NOT describe is buying levels of
 * reputation, so no axis feeds this purse and none is expected to. An earlier
 * draft of this paragraph said the axis was "unbuilt", which was true of
 * `ExpansionAxis` and false of the mechanic.
 *
 * "No spender" is a measured fact rather than a sentence, and this paragraph
 * used to say so while the check did not exist. It does now:
 * `empireInvariant.test.ts`'s `spends every wall-clock purse that has a spender,
 * and never the one that has none` sums `EmpireRunCensus.bookDebits` over every
 * run in the grid and pins `reputation` at 0. Both halves were mutation-tested
 * when the check was written: pricing recruits in this purse
 * (`RECRUIT_BOOK = 'reputation'`) reddens it with `expected 1795040 to be +0`,
 * and neutering the counter reddens the non-vacuity half with
 * `expected [] to deeply equal [ 'physio-days-saved', …(2) ]` — so a zero here
 * cannot be the zero of an instrument that stopped counting.
 *
 * THE WORD FOR THIS THING, ruled once here because five were in use and a
 * coherence pass found them competing inside one spending loop:
 *
 *   - in CODE it is a BOOK. `settledBooks`, `WallClockBooks`, `EmpireBook`,
 *     `EMPIRE_BOOKS`, `axisBook`, `bookBalance`, `bookDebits`, `RECRUIT_BOOK`.
 *     One identifier stem, and it is the one the shipped types already carry.
 *   - in PROSE it is a PURSE, because "book" reads as a ledger to anyone who
 *     has not met the type and this directory has a real ledger in it.
 *   - BALANCE is the NUMBER a book holds, never the book. "one balance" is the
 *     pooled control, "one purse" is the shipped split, and those are different
 *     claims.
 *   - FUND and LANE are not used. "Lane" in particular is the deleted two-gym
 *     model's word and is gone from the shipped modules.
 *
 * The rule binds prose, so no scan enforces it; what a scan does cover is the
 * identifier stem, which `expansion.test.ts` pins as an exported-name list.
 */
export type WallClockBooks = Readonly<Record<WallClockFundedOutput, GymBucks>>;

/**
 * Every wall-clock book at one balance.
 *
 * Deliberately NOT exported, and that is a census decision rather than a taste
 * one: this returns a record of `GymBucks` and takes a bare number, which is
 * exactly the producer shape `empireCore.test.ts`'s brand census refuses
 * without an `Unbranded` guard — and the guard would refuse the accrual, which
 * arrives already branded. Consumers assemble a book record from the one they
 * were handed instead, so nothing outside this file mints a balance from a
 * primitive.
 */
function wallClockBooksAt(balance: number): WallClockBooks {
  const books: Partial<Record<WallClockFundedOutput, GymBucks>> = {};
  for (const output of WALL_CLOCK_FUNDED_OUTPUTS) books[output] = asGymBucks(balance);
  return Object.freeze(books as Record<WallClockFundedOutput, GymBucks>);
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
  readonly displayName: DisplayName;
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
  return Object.freeze({
    id: asNpcId(rawId),
    tier,
    displayName: asDisplayName(rawDisplayName),
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
 * One payout an ACCRUAL made, stamped on the un-accelerated clock.
 *
 * The stamp is deliberately the wall clock even for an idle-only payout, so a
 * purchased skip moves what a ledger contains and never when a ledger says it
 * happened — two of these lists can therefore be compared element-wise without
 * first agreeing on a time base.
 *
 * Which list is compared that way, said exactly, because this docstring named
 * the wrong one for several waves. `accrueProduction`, `accrueReputation` and
 * `accrueSponsorship` each return a ledger of these, and `production.test.ts`
 * and `reputation.test.ts` are where they are asserted on, per accrual. The
 * COMPOSITION does not build one: `empireInvariant.ts` reads a day-stamped
 * stock series of its own, `EmpireDayEntry`, and compares that through
 * `progressionDayLedger` and `compareLedgers`. A flow and a stock answer
 * different questions and both are kept.
 */
export interface EmpireLedgerEntry {
  readonly at: UnacceleratedSeconds;
  readonly output: EmpireOutput;
  readonly amount: number;
}

/**
 * The half of an accrual's ledger that reaches Sim progression.
 *
 * Its consumer is `production.test.ts`, which pins that a skip moves the idle
 * half of a `ProductionAccrual`'s ledger and leaves this half byte-identical.
 * The composed sweep uses `progressionDayLedger` on its own entry type; see
 * `EmpireLedgerEntry` for why there are two.
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
    refuseWith(
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
  /** The axes as the player's gym reads them, on the accelerated clock. */
  readonly axes: GymAxes;
  /**
   * The same axes as the wall clock reads them — every level whose build would
   * have finished with no accelerant applied.
   *
   * Never above `axes` on any rung, because an accelerant moves an idle
   * completion forward and nothing moves a settled one at all;
   * `empireStateFaults` reports the reverse rather than leaving it to a reader.
   * This is what `rosterCapacity` is asked about when the question is whether a
   * Training IQ payer may start arriving — see `WALL_CLOCK_FUNDED_OUTPUTS`.
   */
  readonly settledAxes: GymAxes;
  readonly roster: readonly NpcLifter[];
  readonly reputation: ReputationPoints;
  /** The accelerated book. Decor, cosmetics, and the two idle-only ladders. */
  readonly gymBucks: GymBucks;
  /**
   * The wall-clock books: one purse per wall-clock-funded output, each holding
   * money the gym's baseline takings have delivered by the un-accelerated
   * reading, less what has been spent out of that purse.
   *
   * The only money a `WALL_CLOCK_FUNDED_OUTPUTS` rung may be bought with, and a
   * rung may only be bought from the purse its own output names. See
   * `WallClockBooks` for why one purse was not enough, and `accrueProduction`
   * for why the line each accrues on carries no roster term and no axis
   * multiplier.
   */
  readonly settledBooks: WallClockBooks;
  /**
   * The accrual ledger as it would arrive on the wire, and nothing in
   * `src/empire/` populates it — stated here rather than left to be discovered,
   * because a header advertising a handoff nobody takes is what this field was
   * for a while. `stepGym` calls the three accrual functions and keeps their
   * balances rather than their ledgers; the composed sweep asserts on
   * `EmpireDayEntry`, a stock series it builds itself. What reads this field is
   * `empireStateFaults`, on a payload an Edge Function decoded.
   */
  readonly ledger: readonly EmpireLedgerEntry[];
  /**
   * Every accelerant this gym has actually had applied to it, in the order they
   * landed.
   *
   * Written by `stepGym` on the build-skip mechanism, which is the one of GDD
   * §8.3B's two that has an output to name; a grant spent by advancing the
   * clock names no output and is counted in `EmpireRunCensus.clockSkips`
   * instead. `empireRunFaults` re-asks `mayAccelerate` about every entry here
   * and ties the count to `EmpireRunCensus.buildSkips`, so this list going
   * empty is a fault rather than a quiet pass.
   */
  readonly accelerants: readonly AppliedAccelerant[];
}

/** A gym on the day it opens: first equipment tier, no space, no staff, no roster. */
export function createEmpireState(): EmpireState {
  const staffLevel: Record<StaffRole, number> = { coach: 0, spotter: 0, physio: 0 };
  const opening: GymAxes = Object.freeze({
    equipment: EMPIRE_TUNING.EQUIPMENT_TIERS[0],
    spaceLevel: 0,
    staffLevel: Object.freeze(staffLevel),
  });
  return Object.freeze({
    clock: createEmpireClock(0, 0),
    axes: opening,
    settledAxes: opening,
    roster: Object.freeze([]),
    reputation: asReputation(0),
    gymBucks: asGymBucks(0),
    settledBooks: wallClockBooksAt(0),
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
export function empireStateFaults(state: EmpireState): readonly FaultMessage[] {
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

  // Both views of the ladders, checked by the same three rules. The idle view
  // keeps its own message prefix so a caller reading a fault list still reads
  // the sentence it read before the wall-clock view existed.
  const views: readonly (readonly [string, GymAxes])[] = [
    ['axes', state.axes],
    ['settledAxes', state.settledAxes],
  ];
  for (const [label, axes] of views) {
    if (!(EMPIRE_TUNING.EQUIPMENT_TIERS as readonly string[]).includes(axes.equipment)) {
      faults.push(`${label}: ${axes.equipment} is not an equipment tier`);
    }

    if (
      !Number.isInteger(axes.spaceLevel) ||
      axes.spaceLevel < 0 ||
      axes.spaceLevel > EMPIRE_TUNING.SPACE_LEVEL_MAX
    ) {
      faults.push(`${label}: space level ${axes.spaceLevel} is off the ladder`);
    }

    for (const role of EMPIRE_TUNING.STAFF_ROLES) {
      const level = axes.staffLevel[role];
      if (!Number.isInteger(level) || level < 0 || level > EMPIRE_TUNING.STAFF_LEVEL_MAX[role]) {
        faults.push(`${label}: ${role} level ${level} is off the ladder`);
      }
    }
  }

  // A wall-clock view ahead of the idle one is an accelerant that reached the
  // settled side. `skipExpansion` moves `idleCompletion` and copies
  // `settledCompletion` across, so the idle view is at or above the settled one
  // on every rung; a payload that says otherwise is the hazard arriving through
  // the decode boundary.
  const tiers = EMPIRE_TUNING.EQUIPMENT_TIERS as readonly string[];
  if (tiers.indexOf(state.settledAxes.equipment) > tiers.indexOf(state.axes.equipment)) {
    faults.push(
      `settledAxes: equipment ${state.settledAxes.equipment} is ahead of the idle view's ${state.axes.equipment}`,
    );
  }
  if (state.settledAxes.spaceLevel > state.axes.spaceLevel) {
    faults.push(
      `settledAxes: space level ${state.settledAxes.spaceLevel} is ahead of the idle view's ${state.axes.spaceLevel}`,
    );
  }
  for (const role of EMPIRE_TUNING.STAFF_ROLES) {
    if (state.settledAxes.staffLevel[role] > state.axes.staffLevel[role]) {
      faults.push(
        `settledAxes: ${role} level ${state.settledAxes.staffLevel[role]} is ahead of the idle view's ${state.axes.staffLevel[role]}`,
      );
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

  // The branch immediately below the one above, written the same way on
  // purpose: a wall-clock book is the money a progression-reaching rung is
  // bought with, so a decoded payload that carries a negative or non-finite one
  // is the more load-bearing of the two. Every book is walked rather than one,
  // because a record with a missing key reads as `undefined` and
  // `undefined < 0` is false — the shape that let a malformed clock through
  // twelve lines above.
  for (const book of WALL_CLOCK_FUNDED_OUTPUTS) {
    const balance: number | undefined = state.settledBooks[book];
    if (balance === undefined || !Number.isFinite(balance) || balance < 0) {
      faults.push(`the ${book} book: ${balance} is not a balance`);
    }
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
    // next gap. Note what this loop's domain is: `EmpireState.ledger` is the
    // wire field, and the composition in `empireInvariant.ts` never writes it,
    // so on a composed gym this loop walks zero entries. Its subject is a
    // decoded payload, and `empireCore.test.ts` drives it from hand-built
    // states for exactly that reason.
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

  return faults.map((message) => asFaultMessage(message));
}

/** `empireStateFaults`, as a throw. Useful at a decode boundary and in a test. */
export function assertEmpireState(state: EmpireState): void {
  const faults = empireStateFaults(state);
  if (faults.length > 0) {
    refuseWith(`invalid EmpireState:\n  ${faults.join('\n  ')}`);
  }
}
