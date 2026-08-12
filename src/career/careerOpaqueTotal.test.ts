/**
 * careerOpaqueTotal.test.ts — the opacity instrument that has no domain.
 *
 * ===========================================================================
 * Why a third instrument exists at all
 * ===========================================================================
 *
 * `careerOpacity.test.ts` holds the history in full and it is worth reading
 * first. The short version is that the claim "this directory never reads a
 * number out of a `Total`" has been bypassed four times, and each bypass
 * walked through the same hole one level further out. The fourth walked past
 * THIS file, so read item 2 of the limits list below before trusting anything
 * here:
 *
 *   1. A laundered `Number(lifter.bestTotal) >= requiredKg`, against a claim
 *      backed by the type system alone.
 *   2. `[candidate].join()` behind a digit-width regex, against a probe whose
 *      domain was two totals — a million kilograms and zero.
 *   3. `[lifter.bestTotal, k].sort()[0] === lifter.bestTotal`, a string sort
 *      with no comparator, against a probe whose domain was a 50-point band
 *      crossed with 5 substitute totals. The bypass picks a window between two
 *      band points; at 632.5 kg — the top of `MEET_LOCAL.ghostTotalsKg` in
 *      `src/game/meetTuning.ts`, which is the only distribution of totals this
 *      game currently produces — the gate is asked zero times and the verdict
 *      is `eligible` against a requirement of 680.
 *   4. `new Set([...range]).has(lifter.bestTotal)`, against THIS file. A
 *      membership test is not a property access, so no trap fires and the log
 *      stays empty — and under a `number` binding it is value equality, so a
 *      set built from a range ranks the total against an interval. 585 kg and
 *      610 kg, both values of `ghostTotalsKg`, went to worlds with the gate
 *      asked zero times, `tsc --noEmit` at exit 0 and 154 of 154 tests green.
 *
 * The root cause of the first three is one sentence: a sampled domain loses
 * this game, because whoever writes the next bypass picks the gap after seeing
 * the samples. Fifty points is more than two and it is still a set of points,
 * and a predicate that is constant on those points is invisible however much of
 * the total it reads.
 *
 * So this file does not sample. It binds `Total` to a value that has no
 * readable state at all: a `Proxy` whose every trap records the read and then
 * throws. There is one value, it stands for every total, and the question it
 * answers is not "does the module behave the same at these totals" but "does
 * the module touch the total at all".
 *
 * THE ROOT CAUSE OF THE FOURTH IS A DIFFERENT ONE, and it is the reason this
 * file's own sales pitch is now shorter. A `Proxy` removes the domain from
 * reads that go THROUGH the proxy, which is the class of read this file's
 * premise names. A membership test, an `includes`, a `Map` lookup, a `switch`
 * and a `===` against a table are all reads of the total that are outside that
 * premise, and adding traps does not reach them because there is no trap to
 * add. What answers the fourth bypass is the plate-resolution domain in
 * `careerOpacity.test.ts`, which is a domain again — a better-argued one, not
 * an absent one.
 *
 * ===========================================================================
 * The three instruments and the property each one carries
 * ===========================================================================
 *
 * Three, on three axes, and none subsumes another:
 *
 *   - THE BAND SWEEP and THE SUBSTITUTION PROBE (`careerOpacity.test.ts`).
 *     Property: the verdict equals what the injected gate alone decided, at
 *     every total in a band that crosses every threshold. That is a claim about
 *     agreement with the gate, which this file does not make — a blind gate
 *     cannot disagree with anything. It has a domain and the domain is its
 *     weakness.
 *   - THE SOURCE BAN (`careerOpacity.test.ts`). Property: no shipped module
 *     contains a coercion token, whether or not any fixture reaches it. It is
 *     the one instrument that sees dead code and unreachable branches, and it is
 *     a list of the routes somebody thought of.
 *   - THIS FILE. Property: no shipped function reads any property of a total,
 *     at any value, because there is no value to read. It sees a route nobody
 *     listed and it sees it at every total rather than at fifty of them. It says
 *     nothing about whether the answers are right — a module that ignores the
 *     total and returns nonsense passes here and fails the band sweep.
 *
 * ===========================================================================
 * Why a `Proxy` and not an object with throwing hooks
 * ===========================================================================
 *
 * The alternative considered was a plain object carrying throwing
 * `Symbol.toPrimitive`, `valueOf`, `toString` and `toJSON`. It is weaker, and it
 * is weaker in precisely the way the source ban is weaker: those four hooks are
 * a list somebody wrote down. `Object.keys(total)`, `'kg' in total`,
 * `total.kg`, `Reflect.get(total, key)` and a spread all walk past all four of
 * them, and `{ ...total }` is how the second-largest class of read is spelled.
 *
 * A `Proxy` has no list. Its `get` trap fires for every key, named or symbol,
 * known or not — and `Symbol.toPrimitive`, `valueOf`, `toString` and `toJSON`
 * are themselves property reads, so the four hooks are a subset of what one
 * trap already covers. `has`, `ownKeys`, `getOwnPropertyDescriptor`, `set`,
 * `deleteProperty`, `defineProperty`, `getPrototypeOf` and `setPrototypeOf` are
 * trapped as well, which is the rest of the reflective surface an object has.
 *
 * ===========================================================================
 * The counter, and the try/catch hole it closes
 * ===========================================================================
 *
 * Every trap does two things in this order: it appends a line to a log, and
 * then it throws. The order is the whole point. A module that wraps its read in
 * `try { … } catch { … }` swallows the throw and returns normally — and the log
 * entry is already written, so the read is recorded anyway. The assertion this
 * file makes is on the LOG being empty, not on nothing having been thrown, and
 * a swallowed read reddens it exactly like an escaping one. `swallows the
 * throw and is recorded anyway` drives that directly.
 *
 * That was listed as an open limit when this file was commissioned. It is
 * closed for reads that go through the proxy. It is not closed for reads that
 * never touch it, which is the next section.
 *
 * ===========================================================================
 * What this instrument cannot see — stated as a list, not as a caveat
 * ===========================================================================
 *
 * This is the third round of a claim that promised more than it delivered. The
 * list below is the honest shape of the fourth bypass if there is one, and each
 * item is a real hole rather than a theoretical one.
 *
 *   1. `typeof total`. No trap fires. A module keyed on the typeof string would
 *      behave one way under this probe and another under a numeric binding, and
 *      only the numeric run comparison below would separate them — which is a
 *      sampled comparison again.
 *   2. Identity, and value equality wearing identity's clothes. `total === x`,
 *      `Object.is(total, x)`, `new Set([...]).has(total)`,
 *      `list.includes(total)`, a `WeakSet` membership test, a `Map` lookup, a
 *      `switch` — none of these calls a trap, because none of them is a
 *      PROPERTY read, and the premise of this whole file is that a read is a
 *      property access.
 *
 *      THE SENTENCE THAT USED TO END THIS ITEM WAS FALSE AND IT COST A ROUND.
 *      It read: "Identity carries no ordering, so a read of it cannot rank two
 *      totals; it can still branch on whether two references are the same
 *      object." That was validated at ONE sampled value — the mutant below,
 *      planted at `QUALIFYING_TOTAL_KG_BY_TIER.regional.mens`, 450 kg, which is
 *      a band point — and then written as a general property of identity.
 *
 *      It is not one. `Set.prototype.has` compares by SameValueZero, and under
 *      the `number` binding the wiring piece uses that is VALUE equality, so a
 *      set built from a RANGE ranks the total against an interval. The fourth
 *      bypass is exactly that: one physical line, no numeric literal, no cast,
 *      `tsc` exit 0, the whole directory green, and 585 kg and 610 kg — two
 *      values of `MEET_LOCAL.ghostTotalsKg` — admitted to a meet requiring 680
 *      with the gate asked zero times. Move the measured value 134 kg to the
 *      right and the conclusion evaporates.
 *
 *      So the item stands and the reasoning under it does not: these reads are
 *      invisible here, one of them ranks, and no number of extra traps changes
 *      that because the class sits outside the premise. What stands against it
 *      is the plate-resolution domain in `careerOpacity.test.ts`, and
 *      `is invisible to the reads a proxy has no trap for, one of which ranks`
 *      below now drives the ranking half rather than asserting the total equals
 *      itself.
 *
 *      MEASURED, so this item is a finding rather than a worry. The mutant
 *      `careerOpacity.test.ts` records against its own substitution probe —
 *      `const rung = CAREER_TUNING.QUALIFYING_TOTAL_KG_BY_TIER.regional.mens;
 *      if (new Set([result.total]).has(rung as never)) { continue; }`, planted
 *      in `standingOver` — leaves this file at 9 of 9 passing while reddening
 *      three tests one file over. The two instruments are complementary in both
 *      directions and this is the direction that runs the other way.
 *   3. THE GATE ITSELF, which is the largest one. The gate is the one thing
 *      permitted to look inside a total, so a module may extract magnitude by
 *      asking it repeatedly — `gate(total, 500)`, then `gate(total, 400)` — and
 *      binary-search a total without touching the proxy once. Nothing in this
 *      file sees that. `asks the gate once per gated verdict, with the lifter's
 *      own total` in `careerOpacity.test.ts` is what stands against it, and that
 *      check covers `meetEligibility` and no other function.
 *
 *      MEASURED AFTER THAT PARAGRAPH WAS WRITTEN, and it is less open than it
 *      says — but the correction is a measurement of two attempts, not a proof
 *      of closure, and it is written that way on purpose.
 *
 *      Attempt 1, the binary search this bullet describes, planted in
 *      `qualifiedTierFor` (a function the named check does NOT cover): 90
 *      probes narrowing `lo`/`hi` through the gate, then a decision off `lo`
 *      alone, never touching the proxy. `tsc` exit 0 and FIVE tests red,
 *      including `asks the injected gate and never compares a total itself` and
 *      `walks the ladder by the gate's answers alone, across the domain`. So the
 *      per-function checks are broader than "meetEligibility and no other".
 *
 *      Attempt 2, subtler, because attempt 1 is loud in its call COUNT: the
 *      honest three probes kept exactly, with the gate asked the WRONG QUESTION
 *      — `requiredKg - MIN_DAYS_BETWEEN_ENTERED_MEETS` instead of `requiredKg`.
 *      Same channel, same count, a 14 kg shift in every threshold. `tsc` exit 0
 *      and EIGHT tests red, reaching the engagement sweeps.
 *
 *      What that does and does not license. It kills the specific worry that
 *      one function carried the whole defence. It does not close the channel:
 *      an attack that spends its probes at the honest values and extracts
 *      information from the ORDER or the timing of them would be a third shape
 *      neither attempt tried. Two failed attacks are evidence about the
 *      attacker, and the three bypasses this directory has already shipped were
 *      each invisible until somebody wrote the right one.
 *   4. A read in a function this file does not drive. Closed by construction
 *      rather than by promise: `drives every exported function that is generic
 *      over Total` reads the export list out of the shipped sources and asserts
 *      set equality against the driven list, so a new exported function reddens
 *      that test until somebody drives it here.
 *   5. Anything about correctness. The gates this file injects are blind — they
 *      answer off a stand-in kilogram value and ignore the total they are
 *      handed. A module that never consults the gate at all still passes here.
 *   6. The compiler's half. Shipped code sees `Total` as an unconstrained type
 *      parameter, so `total.kg` does not compile whatever this file binds. What
 *      is left for a proxy to catch is the LAUNDERED read, the kind that
 *      typechecks — which is every bypass this directory has actually had.
 *   7. A read that happens outside `src/career/`. Out of scope by design: this
 *      directory hands the total to an injected gate and the wiring piece
 *      supplies it.
 *
 * ===========================================================================
 * What the numeric comparison adds, and why it is the weaker half
 * ===========================================================================
 *
 * Each subject is run twice: once with the proxy, once with a real number, both
 * under the same blind gate. The two readouts must agree with the total masked
 * by IDENTITY on each side — the proxy on one, the stand-in number on the other.
 * That catches the two holes above that the log cannot: a `typeof` branch and an
 * identity branch both make the numeric run take a path the opaque run does not.
 *
 * It is the weaker half and it is weaker for the reason this whole file exists:
 * it is keyed to four stand-in values, so it is a sampled comparison. It is kept
 * because it is nearly free, not because it closes anything.
 *
 * The stand-ins are all non-integral and none of them equals a threshold or the
 * probe's bodyweights, which is asserted rather than assumed. That matters
 * because the mask is by identity: a stand-in that happened to equal a
 * requirement, a day index, a rank or a count would be masked where it appears
 * as that other quantity, and the two runs would disagree for a reason that is
 * not a read.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { CAREER_TUNING } from './careerTuning';
import {
  CAREER_FEDERATIONS,
  buildCareerCalendar,
  careerLifterFaults,
  createCareerLifter,
  earliestNextEntryDay,
  enterMeet,
  meetEligibility,
  qualifyingTotalKgFor,
  selectableMeets,
  type CareerFederation,
  type CareerLifter,
  type CareerMeetSlot,
  type CareerQualifyingCategory,
  type CareerQualifyingGate,
} from './careerCore';
import {
  careerGateFaults,
  careerHistoryFaults,
  careerRecordFaults,
  careerStanding,
  competedSlotIds,
  createCareerRecord,
  hasCompetedAt,
  lastResultDay,
  lifterWithStanding,
  qualifiedTierFor,
  recordMeetResult,
  resultFor,
  standingAsOf,
  tierUnlockBetween,
  type CareerRecord,
} from './careerRecord';
import {
  admitsOffer,
  compareCareerEngagement,
  resultsUnder,
  runEntryPlan,
  runRecordHistory,
  shippedCareerStandingWiring,
  standingUnder,
  type CareerEngagementInputs,
  type CareerMeetOffer,
} from './careerEngagement';
import {
  flightPlacingFaults,
  placeFlight,
  type FlightResultEntry,
  type TotalOrder,
} from './flight';

// ===========================================================================
// 1. The probe's parameters, in one block
// ===========================================================================

/**
 * Everything this file is made of, as named constants.
 *
 * The same reason `OPACITY_SWEEP` exists one file over: a measurement whose
 * inputs are not written down is an anecdote. Nothing here is a game-feel value
 * — this is a test harness and `careerTuning.ts` holds what the game is made of
 * — but the rule about a number buried at a call site is the same rule.
 */
const OPAQUE_PROBE = Object.freeze({
  /** How far the probe's calendar runs. Long enough for every tier to appear. */
  HORIZON_DAYS: 400,

  /** How many gated slots the lifter enters and the subjects walk. */
  PROBE_SLOTS: 5,

  /** How many of those carry a recorded result. */
  RESULT_SLOTS: 3,

  /** The category every subject is read in. */
  CATEGORY: 'mens' as CareerQualifyingCategory,

  /**
   * A distinct bodyweight per recorded result.
   *
   * Distinct on purpose. `CareerStanding.qualifyingBodyweightKg` is carried off
   * the same result as `qualifyingTotal`, so an unmasked field reports WHICH
   * result the selection loop chose. With one bodyweight repeated, the loop in
   * `standingOver` ran with a constant and its choice was unobservable.
   */
  BODYWEIGHTS_KG: Object.freeze([92.5, 83.25, 105.75]),

  /**
   * The kilogram values the blind gates answer off.
   *
   * None of them is a number the readout already prints — not a threshold, not
   * a day index, not an opening day, not an earliest-next-entry day, not a rank
   * and not a count — because the mask is by identity and a stand-in that
   * collided with one of those would be blanked where it appeared as that other
   * quantity, making the two runs disagree for a reason that is not a read.
   * `stands for totals that collide with nothing` builds that set from the
   * shipped calendar and checks it, rather than approximating it with
   * "non-integral".
   *
   * 632.5 is the third bypass's own witness — the top of `ghostTotalsKg` — kept
   * because a value that broke the last instrument belongs in the next one.
   *
   * 701 IS THE INTEGRAL ONE, AND IT IS HERE BECAUSE THE OLD RULE MADE A WHOLE
   * BRANCH SHAPE INVISIBLE. Every stand-in used to be non-integral by
   * construction, so `Number.isInteger(total)` — which fires no proxy trap and
   * is legal under the source ban — answered `false` on the opaque run and
   * `false` on every numeric run too. The two runs agreed, and a module keyed
   * on integrality was outside this instrument by arithmetic rather than by
   * anything anybody decided. 701 is above every day index the probe can print
   * and above every threshold on the table, so it is integral without being any
   * of the quantities the old rule was protecting against.
   *
   * MUTATION WITNESS, AND ITS ISOLATION, because a bare pass is not evidence.
   * Mutant, at `meetEligibility`'s qualifying check:
   * `if (!Number.isInteger(lifter.bestTotal) && !gate(lifter.bestTotal,
   * requiredKg)) {`. It needs no cast — `Number.isInteger` takes `unknown` —
   * and `tsc --noEmit` is exit 0 under it. Reddened here:
   * `expect(disagreements.length).toBe(0)` inside `records no read from any
   * subject, under any gate, at any total`.
   *
   * ISOLATION, which is the half that says 701 did it rather than the file. The
   * same mutant with 701 replaced by 701.5 — one character, the stand-in count
   * unchanged at five so no census pin moves — leaves this whole file GREEN, 10
   * of 10. So the integral stand-in is what sees this shape, and nothing else
   * here does.
   */
  STAND_IN_KG: Object.freeze([12.5, 472.25, 632.5, 701, 1000.5]),

  /**
   * A SECOND total, handed to a function in a position it must discard.
   *
   * `lifterWithStanding` writes the standing's qualifying total onto a lifter
   * who already carries one, so there are two totals in the room and exactly one
   * of them is supposed to come out. With one value they are indistinguishable,
   * which is how a mask keyed on the FIELD NAME reads as coverage while the
   * question of which total landed there goes unasked.
   */
  OTHER_STAND_IN_KG: 271.75,

  /**
   * Two attendance patterns for the engagement subjects, one a subset.
   *
   * The extra meet is the FOURTH probe slot on purpose: the first three are
   * regional and the fourth is the ladder's first nationals, so the extra meet
   * moves `competedRank` as well as `meetsCompleted`. With the extra meet at a
   * slot of the same tier, `compareCareerEngagement` returned one readout under
   * all twenty-four gate and stand-in combinations — present in the sweep and
   * discriminating nothing.
   */
  ATTENDANCE_LESS: Object.freeze([true, false, true, false, false]),
  ATTENDANCE_MORE: Object.freeze([true, false, true, true, false]),

  /** The plan `runEntryPlan` is driven with. */
  ENTRY_PLAN: Object.freeze([true, true, true, true, true]),

  /**
   * The lots the GDD §6.6 flight subjects are driven over.
   *
   * Out of ascending order on purpose. Lot number is the last step of the
   * bar-loading chain and the listing order for a pair the placing chain leaves
   * tied, so a flight whose lots happened to arrive sorted would agree with a
   * module that ignored them entirely.
   */
  FLIGHT_LOTS: Object.freeze([3, 1, 4, 2]),

  /**
   * Which entrant in that flight has no total.
   *
   * One, and not zero: `placeFlight`'s unplaced branch reads `total === null`,
   * which is the one thing this directory is allowed to ask about a total, and
   * a flight where nobody bombed leaves that branch undriven under the opaque
   * binding. Not the first entrant either, so the branch is reached from inside
   * the walk rather than on its first step.
   */
  FLIGHT_BOMB_INDEX: 2,

  /**
   * The two award categories the flight entrants are split across.
   *
   * `flight.ts`'s section 1a makes a place a place within a category, so a
   * single-category fixture here would leave `placeFlight`'s partitioning
   * undriven under the opaque binding entirely — and the partition reads a
   * STRING off the entry, right next to the total, which is exactly the
   * neighbourhood a stray read would appear in.
   *
   * Alternating, so the two entrants that share a category are indices 0 and 2
   * — and index 2 is `FLIGHT_BOMB_INDEX`, so one category holds a placed lifter
   * and a bombed one while the other holds two placed lifters. Both branches of
   * the placed/unplaced split are therefore driven inside a partition rather
   * than across the whole flight.
   */
  FLIGHT_CATEGORIES: Object.freeze(['mens-93-open-raw', 'mens-105-open-raw']),
});

const FED = CAREER_FEDERATIONS[0] as CareerFederation;

const CALENDAR = buildCareerCalendar({
  federationId: FED.id,
  throughDayIndex: OPAQUE_PROBE.HORIZON_DAYS,
});

const GATED_SLOTS: readonly CareerMeetSlot[] = CALENDAR.filter(
  (slot) => qualifyingTotalKgFor(slot.tier, OPAQUE_PROBE.CATEGORY) !== null,
);

const PROBE_SLOTS: readonly CareerMeetSlot[] = GATED_SLOTS.slice(0, OPAQUE_PROBE.PROBE_SLOTS);
const RESULT_SLOTS: readonly CareerMeetSlot[] = PROBE_SLOTS.slice(0, OPAQUE_PROBE.RESULT_SLOTS);

/** The last day any reading is taken on: the last slot the lifter entered. */
const THROUGH_DAY = (PROBE_SLOTS[PROBE_SLOTS.length - 1] as CareerMeetSlot).dayIndex;

/** Every distinct qualifying threshold on the shipped table, ascending. */
const THRESHOLDS_KG: readonly number[] = Object.freeze(
  [
    ...new Set(
      CAREER_TUNING.MEET_TIERS.flatMap((tier) =>
        CAREER_TUNING.QUALIFYING_CATEGORIES.map((category) => qualifyingTotalKgFor(tier, category)),
      ).filter((kg): kg is number => kg !== null),
    ),
  ].sort((left, right) => left - right),
);

/**
 * The window the fourth bypass ranked against, as a list of kilogram values.
 *
 * The integers from the nationals requirement plus the entry gap up to, but not
 * including, the worlds requirement minus the first nationals day — which is
 * how the shipped line spelled it, out of tuned constants and no literal. It is
 * rebuilt here from the same constants rather than transcribed, so a playtester
 * moving a threshold moves this window with it and the check below still
 * describes a real interval.
 */
const RANKING_WINDOW_KG: readonly number[] = Object.freeze(
  [...Array(CAREER_TUNING.QUALIFYING_TOTAL_KG_BY_TIER.worlds.mens).keys()].slice(
    CAREER_TUNING.QUALIFYING_TOTAL_KG_BY_TIER.nationals.mens +
      CAREER_TUNING.MIN_DAYS_BETWEEN_ENTERED_MEETS,
    CAREER_TUNING.QUALIFYING_TOTAL_KG_BY_TIER.worlds.mens -
      CAREER_TUNING.FIRST_MEET_DAY_BY_TIER.nationals,
  ),
);

/** Both stand-in roles in one list, so the collision guard walks all of them. */
const ALL_STAND_INS_KG: readonly number[] = Object.freeze([
  ...OPAQUE_PROBE.STAND_IN_KG,
  OPAQUE_PROBE.OTHER_STAND_IN_KG,
]);

/**
 * Every number the readout can print that is not a total.
 *
 * Built from the shipped calendar rather than described in prose, because the
 * rule it replaces — "a stand-in must not be an integer" — was a proxy for this
 * set and a lossy one in both directions. It excluded 701, which collides with
 * nothing, and it would have admitted a non-integral collision if the tuning
 * table ever grew one.
 *
 * The four sources are the four numeric fields a verdict, a lifter, a standing
 * or an engagement census can carry: a qualifying requirement, a day index (of
 * a slot, of the day it opens, or of the earliest next entry), a bodyweight,
 * and a count or a rank.
 */
const PRINTED_NON_TOTALS: ReadonlySet<number> = new Set<number>([
  ...THRESHOLDS_KG,
  ...OPAQUE_PROBE.BODYWEIGHTS_KG,
  ...CALENDAR.map((slot) => slot.dayIndex),
  ...CALENDAR.map((slot) => slot.dayIndex - CAREER_TUNING.CALENDAR_VISIBLE_DAYS_AHEAD),
  ...CALENDAR.map((slot) => slot.dayIndex + CAREER_TUNING.MIN_DAYS_BETWEEN_ENTERED_MEETS),
  ...Array.from({ length: CALENDAR.length + 1 }, (_unused, index) => index),
]);

// ===========================================================================
// 2. The opaque total
// ===========================================================================

declare const OPAQUE_TOTAL_BRAND: unique symbol;

/**
 * The type `Total` is bound to here.
 *
 * A phantom brand and nothing else. The binding barely matters to what shipped
 * code can compile — the modules are generic over an unconstrained `Total`, so
 * a direct member read is a type error whatever this is — but it keeps the
 * value out of every other type in the file.
 */
interface OpaqueTotal {
  readonly [OPAQUE_TOTAL_BRAND]: 'career-opacity-probe';
}

/** Thrown by every trap, after the read is recorded. */
class OpacityViolation extends Error {}

interface OpaqueProbeValue {
  /** The value to bind `Total` to. */
  readonly total: OpaqueTotal;
  /** Every read since the last `clear()`, in order, as `trap(key)`. */
  reads(): readonly string[];
  clear(): void;
}

/**
 * The traps installed, as data, so the list is readable and pinned.
 *
 * `apply` and `construct` are deliberately absent: the target is a plain
 * object, so neither is reachable, and a trap that cannot fire is a row that
 * reads as coverage. `preventExtensions` and `isExtensible` are absent for the
 * same reason — nothing in this directory calls either on a total, and a trap
 * whose only witness is the harness proving it exists measures the harness.
 */
const TRAPPED = [
  'get',
  'set',
  'has',
  'deleteProperty',
  'ownKeys',
  'getOwnPropertyDescriptor',
  'defineProperty',
  'getPrototypeOf',
  'setPrototypeOf',
] as const;

function opaqueTotal(): OpaqueProbeValue {
  const log: string[] = [];
  const trip = (trap: string, key?: PropertyKey): never => {
    // RECORD FIRST, THROW SECOND. A `catch` can swallow the throw; it cannot
    // unwrite this line, which is what makes a swallowed read visible.
    log.push(key === undefined ? `${trap}()` : `${trap}(${String(key)})`);
    throw new OpacityViolation(
      `career: a shipped module read ${trap}(${key === undefined ? '' : String(key)}) off an opaque total`,
    );
  };

  const handler: ProxyHandler<OpaqueTotal> = {
    get: (_target, key) => trip('get', key),
    set: (_target, key) => trip('set', key),
    has: (_target, key) => trip('has', key),
    deleteProperty: (_target, key) => trip('deleteProperty', key),
    ownKeys: () => trip('ownKeys'),
    getOwnPropertyDescriptor: (_target, key) => trip('getOwnPropertyDescriptor', key),
    defineProperty: (_target, key) => trip('defineProperty', key),
    getPrototypeOf: () => trip('getPrototypeOf'),
    setPrototypeOf: () => trip('setPrototypeOf'),
  };

  return {
    total: new Proxy({} as OpaqueTotal, handler),
    reads: () => [...log],
    clear: () => {
      log.length = 0;
    },
  };
}

// ===========================================================================
// 3. The blind gate — the one channel a module is allowed to read through
// ===========================================================================

/**
 * A gate that answers about `standsForKg` and ignores the total it is handed.
 *
 * The design tension the brief for this file names: the gate is the one thing
 * permitted to look inside a total, so a probe that makes every read throw has
 * to say what the gate is allowed to do. The answer here is that it reads
 * NOTHING — its first parameter is unused, and the kilogram value it answers
 * off is closed over from the harness rather than taken from the value.
 *
 * That is not an exemption carved out of the check. The gate is called inside
 * the sweep like any other code, so if it read its first argument the log would
 * record it and the sweep would redden. The gate is held to the same standard
 * as the module, by the same instrument.
 */
function blindGate<Total>(
  shape: (standsForKg: number, requiredKg: number) => boolean,
  standsForKg: number,
): CareerQualifyingGate<Total> {
  return (_total, requiredKg) => shape(standsForKg, requiredKg);
}

/**
 * A blind ORDER over totals, the comparator half of the same idea.
 *
 * `blindGate` answers a yes/no about a kilogram value closed over from the
 * harness. A comparator has two operands and no requirement outside them, so a
 * blind one is easier still: it reads neither, and answers from a shape.
 *
 * The shape is allowed to be STATEFUL, and that is the useful part rather than
 * a shortcut. A comparator that answers off its own call count still reads
 * nothing about a total, and it makes the SEQUENCE of calls observable: if
 * `placeFlight` asked its order a different number of questions, or in a
 * different arrangement, under the numeric binding than under the opaque one,
 * the two readouts stop matching. That is the property a constant comparator
 * cannot express, because a constant answers the same however many times it is
 * asked.
 */
interface OrderShape {
  readonly id: string;
  /** A FRESH comparator per call, since two of the three carry a counter. */
  readonly make: <Total>() => TotalOrder<Total>;
}

const ORDER_SHAPES: readonly OrderShape[] = [
  // Every pair equal, so the whole published tie-break chain below the total is
  // the thing being driven.
  { id: 'all-equal', make: () => () => 0 },
  // Left always wins, and right always wins. Neither is a lawful comparator —
  // `flightPlacingFaults` is supposed to say so — and a result sheet built from
  // either must still be the same sheet under both bindings. Both are here
  // rather than one because they produce MIRRORED sheets, which is what makes
  // the sheet census below able to reach three.
  { id: 'left-first', make: () => () => -1 },
  { id: 'right-first', make: () => () => 1 },
  {
    id: 'cycling',
    make: () => {
      const answers = [-1, 0, 1];
      let asked = 0;
      return () => {
        const given = answers[asked % answers.length] ?? 0;
        asked += 1;
        return given;
      };
    },
  },
];

/**
 * The flight the §6.6 subjects are driven over.
 *
 * Both fixture totals appear, which is legal here and is not legal in the
 * readout: `placeFlight` returns rows that carry no total at all, so
 * `<other-total>` cannot reach a readout by any route and the leak check keeps
 * its meaning. One entrant carries `null` — see `FLIGHT_BOMB_INDEX`.
 */
function flightEntriesFor<Total>(fixtures: Fixtures<Total>): readonly FlightResultEntry<Total>[] {
  return OPAQUE_PROBE.FLIGHT_LOTS.map((lotNumber, index) => {
    const bombed = index === OPAQUE_PROBE.FLIGHT_BOMB_INDEX;
    return {
      lifterId: `lifter-${index}`,
      lotNumber,
      categoryId: OPAQUE_PROBE.FLIGHT_CATEGORIES[
        index % OPAQUE_PROBE.FLIGHT_CATEGORIES.length
      ] as string,
      bodyweightKg: OPAQUE_PROBE.BODYWEIGHTS_KG[
        index % OPAQUE_PROBE.BODYWEIGHTS_KG.length
      ] as number,
      total: bombed ? null : index % 2 === 0 ? fixtures.total : fixtures.otherTotal,
      totalReachedAtPosition: bombed ? null : index,
    };
  });
}

interface GateShape {
  readonly id: string;
  readonly answer: (standsForKg: number, requiredKg: number) => boolean;
}

/**
 * The answer patterns every subject is driven under.
 *
 * The same six shapes `careerOpacity.test.ts` uses, restated rather than
 * imported: importing a test file would re-run its suite. They are here to drive
 * every BRANCH of every subject — a module whose refusal path is never taken has
 * a coercion nobody looked at — and not to check any answer.
 */
const GATE_SHAPES: readonly GateShape[] = [
  { id: 'refuses-everything', answer: () => false },
  { id: 'admits-everything', answer: () => true },
  { id: 'at-or-above', answer: (kg, requiredKg) => kg >= requiredKg },
  { id: 'strictly-above', answer: (kg, requiredKg) => kg > requiredKg },
  { id: 'band', answer: (kg, requiredKg) => kg >= requiredKg && kg < requiredKg * 2 },
  { id: 'ignores-the-total', answer: (_kg, requiredKg) => requiredKg < 500 },
];

// ===========================================================================
// 4. Fixtures, built once per binding
// ===========================================================================

interface Fixtures<Total> {
  readonly total: Total;
  /**
   * A second total, in a position the function under test must discard. See
   * `OTHER_STAND_IN_KG`; `carrier` is the only fixture that holds it.
   */
  readonly otherTotal: Total;
  /** No entries, carrying the total. */
  readonly fresh: CareerLifter<Total>;
  /** No entries, carrying the OTHER total. The lifter a standing is written onto. */
  readonly carrier: CareerLifter<Total>;
  /** Entered at every probe slot, carrying the total. */
  readonly entered: CareerLifter<Total>;
  /** Results at the first `RESULT_SLOTS` probe slots, distinct bodyweights. */
  readonly record: CareerRecord<Total>;
}

function buildFixtures<Total>(total: Total, otherTotal: Total): Fixtures<Total> {
  const fresh: CareerLifter<Total> = Object.freeze({
    ...createCareerLifter<Total>(FED.id, OPAQUE_PROBE.CATEGORY),
    bestTotal: total,
  });
  const carrier: CareerLifter<Total> = Object.freeze({ ...fresh, bestTotal: otherTotal });
  const entered: CareerLifter<Total> = Object.freeze({
    ...fresh,
    enteredSlotIds: Object.freeze(PROBE_SLOTS.map((slot) => slot.slotId)),
    lastEntryDayIndex: (PROBE_SLOTS[PROBE_SLOTS.length - 1] as CareerMeetSlot).dayIndex,
  });

  let record = createCareerRecord<Total>();
  for (let index = 0; index < RESULT_SLOTS.length; index += 1) {
    const slot = RESULT_SLOTS[index] as CareerMeetSlot;
    const outcome = recordMeetResult(record, entered, slot, {
      total,
      bodyweightKg: OPAQUE_PROBE.BODYWEIGHTS_KG[index] as number,
    });
    if (outcome.kind !== 'recorded') {
      throw new Error(`career: the probe could not build its record: ${outcome.reason.kind}`);
    }
    record = outcome.record;
  }

  return { total, otherTotal, fresh, carrier, entered, record };
}

function inputsFor<Total>(
  fixtures: Fixtures<Total>,
  gate: CareerQualifyingGate<Total>,
): CareerEngagementInputs<Total> {
  const offers: readonly CareerMeetOffer<Total>[] = PROBE_SLOTS.map((slot, index) => ({
    slot,
    total: fixtures.total,
    bodyweightKg: OPAQUE_PROBE.BODYWEIGHTS_KG[index % OPAQUE_PROBE.BODYWEIGHTS_KG.length] as number,
  }));
  return {
    offers,
    lifter: fixtures.fresh,
    category: OPAQUE_PROBE.CATEGORY,
    gate,
    throughDayIndex: THROUGH_DAY,
  };
}

// ===========================================================================
// 5. The subjects — every exported function generic over `Total`
// ===========================================================================

interface OpaqueSubject {
  readonly id: string;
  readonly module: string;
  /**
   * True if a `Total` VALUE reaches this function. Two exported constructors
   * are generic over `Total` and take none; they are driven anyway so the
   * census below can be a set equality rather than a set equality with
   * exceptions, and this flag is what stops that reading as more than it is.
   */
  readonly takesATotal: boolean;
  readonly run: <Total>(fixtures: Fixtures<Total>, gate: CareerQualifyingGate<Total>) => unknown;
}

const SUBJECTS: readonly OpaqueSubject[] = [
  // ---- careerCore.ts ----
  {
    id: 'earliestNextEntryDay',
    module: 'careerCore.ts',
    takesATotal: true,
    run: (fixtures) => earliestNextEntryDay(fixtures.entered),
  },
  {
    id: 'meetEligibility',
    module: 'careerCore.ts',
    takesATotal: true,
    run: (fixtures, gate) =>
      GATED_SLOTS.map((slot) => meetEligibility(slot, fixtures.fresh, slot.dayIndex, gate)),
  },
  {
    id: 'selectableMeets',
    module: 'careerCore.ts',
    takesATotal: true,
    run: (fixtures, gate) =>
      selectableMeets(CALENDAR, fixtures.fresh, 0, gate).map((slot) => slot.slotId),
  },
  {
    id: 'createCareerLifter',
    module: 'careerCore.ts',
    takesATotal: false,
    run: () => createCareerLifter(FED.id, OPAQUE_PROBE.CATEGORY),
  },
  {
    id: 'enterMeet',
    module: 'careerCore.ts',
    takesATotal: true,
    run: (fixtures, gate) =>
      PROBE_SLOTS.map((slot) => enterMeet(fixtures.fresh, slot, slot.dayIndex, gate)),
  },
  {
    id: 'careerLifterFaults',
    module: 'careerCore.ts',
    takesATotal: true,
    run: (fixtures) => careerLifterFaults(fixtures.entered),
  },

  // ---- careerRecord.ts ----
  {
    id: 'createCareerRecord',
    module: 'careerRecord.ts',
    takesATotal: false,
    run: () => createCareerRecord(),
  },
  {
    id: 'hasCompetedAt',
    module: 'careerRecord.ts',
    takesATotal: true,
    run: (fixtures) => PROBE_SLOTS.map((slot) => hasCompetedAt(fixtures.record, slot.slotId)),
  },
  {
    id: 'resultFor',
    module: 'careerRecord.ts',
    takesATotal: true,
    run: (fixtures) => PROBE_SLOTS.map((slot) => resultFor(fixtures.record, slot.slotId)),
  },
  {
    id: 'competedSlotIds',
    module: 'careerRecord.ts',
    takesATotal: true,
    run: (fixtures) => competedSlotIds(fixtures.record),
  },
  {
    id: 'lastResultDay',
    module: 'careerRecord.ts',
    takesATotal: true,
    run: (fixtures) => lastResultDay(fixtures.record),
  },
  {
    id: 'recordMeetResult',
    module: 'careerRecord.ts',
    takesATotal: true,
    run: (fixtures) =>
      recordMeetResult(
        fixtures.record,
        fixtures.entered,
        PROBE_SLOTS[PROBE_SLOTS.length - 1] as CareerMeetSlot,
        { total: fixtures.total, bodyweightKg: OPAQUE_PROBE.BODYWEIGHTS_KG[0] as number },
      ),
  },
  {
    id: 'qualifiedTierFor',
    module: 'careerRecord.ts',
    takesATotal: true,
    run: (fixtures, gate) =>
      CAREER_TUNING.QUALIFYING_CATEGORIES.map((category) =>
        qualifiedTierFor(fixtures.total, category, gate),
      ),
  },
  {
    id: 'careerStanding',
    module: 'careerRecord.ts',
    takesATotal: true,
    run: (fixtures, gate) => careerStanding(fixtures.record, OPAQUE_PROBE.CATEGORY, gate),
  },
  {
    id: 'standingAsOf',
    module: 'careerRecord.ts',
    takesATotal: true,
    run: (fixtures, gate) =>
      RESULT_SLOTS.map((slot) =>
        standingAsOf(fixtures.record, slot.dayIndex, OPAQUE_PROBE.CATEGORY, gate),
      ),
  },
  {
    id: 'tierUnlockBetween',
    module: 'careerRecord.ts',
    takesATotal: true,
    run: (fixtures, gate) =>
      tierUnlockBetween(
        careerStanding({ results: [] }, OPAQUE_PROBE.CATEGORY, gate),
        careerStanding(fixtures.record, OPAQUE_PROBE.CATEGORY, gate),
      ),
  },
  {
    id: 'lifterWithStanding',
    module: 'careerRecord.ts',
    takesATotal: true,
    // The lifter handed in is the CARRIER — it already holds a different total
    // — so the readout says which of the two came out. Handing it `fresh`, whose
    // total is the standing's total, is what makes this subject unable to tell
    // `{ ...lifter, bestTotal: standing.qualifyingTotal }` from
    // `{ ...lifter, bestTotal: lifter.bestTotal }`.
    run: (fixtures, gate) =>
      lifterWithStanding(
        fixtures.carrier,
        careerStanding(fixtures.record, OPAQUE_PROBE.CATEGORY, gate),
      ),
  },
  {
    id: 'careerGateFaults',
    module: 'careerRecord.ts',
    takesATotal: true,
    run: (fixtures, gate) => careerGateFaults(gate, [fixtures.total], OPAQUE_PROBE.CATEGORY),
  },
  {
    id: 'careerRecordFaults',
    module: 'careerRecord.ts',
    takesATotal: true,
    run: (fixtures) => careerRecordFaults(fixtures.record),
  },
  {
    id: 'careerHistoryFaults',
    module: 'careerRecord.ts',
    takesATotal: true,
    run: (fixtures) => careerHistoryFaults(fixtures.record, fixtures.entered),
  },

  // ---- careerEngagement.ts ----
  {
    id: 'resultsUnder',
    module: 'careerEngagement.ts',
    takesATotal: true,
    run: (fixtures) => resultsUnder(shippedCareerStandingWiring(), fixtures.record.results),
  },
  {
    id: 'standingUnder',
    module: 'careerEngagement.ts',
    takesATotal: true,
    run: (fixtures, gate) =>
      standingUnder(
        shippedCareerStandingWiring(),
        fixtures.record,
        THROUGH_DAY,
        OPAQUE_PROBE.CATEGORY,
        gate,
      ),
  },
  {
    id: 'runRecordHistory',
    module: 'careerEngagement.ts',
    takesATotal: true,
    run: (fixtures, gate) =>
      runRecordHistory(inputsFor(fixtures, gate), OPAQUE_PROBE.ATTENDANCE_MORE),
  },
  {
    id: 'runEntryPlan',
    module: 'careerEngagement.ts',
    takesATotal: true,
    run: (fixtures, gate) => runEntryPlan(inputsFor(fixtures, gate), OPAQUE_PROBE.ENTRY_PLAN),
  },
  {
    id: 'admitsOffer',
    module: 'careerEngagement.ts',
    takesATotal: true,
    run: (fixtures, gate) => {
      const inputs = inputsFor(fixtures, gate);
      return inputs.offers.map((offer) => admitsOffer(inputs, fixtures.fresh, offer));
    },
  },
  {
    id: 'compareCareerEngagement',
    module: 'careerEngagement.ts',
    takesATotal: true,
    run: (fixtures, gate) => {
      const inputs = inputsFor(fixtures, gate);
      return compareCareerEngagement(
        runRecordHistory(inputs, OPAQUE_PROBE.ATTENDANCE_LESS),
        runRecordHistory(inputs, OPAQUE_PROBE.ATTENDANCE_MORE),
      );
    },
  },

  // ---- flight.ts ----
  // These two take an ORDER rather than a gate, which is why they build their
  // own rather than using the `gate` parameter. A comparator is strictly more
  // power over a total than a gate is — it ranks two of them against each other
  // — so they are the two subjects in this file with the most to hide.
  {
    id: 'placeFlight',
    module: 'flight.ts',
    takesATotal: true,
    run: (fixtures) =>
      ORDER_SHAPES.map((shape) => ({
        shape: shape.id,
        sheet: placeFlight(flightEntriesFor(fixtures), shape.make()),
      })),
  },
  {
    id: 'flightPlacingFaults',
    module: 'flight.ts',
    takesATotal: true,
    run: (fixtures) =>
      ORDER_SHAPES.map((shape) => ({
        shape: shape.id,
        faults: flightPlacingFaults(flightEntriesFor(fixtures), shape.make()),
      })),
  },
];

// ===========================================================================
// 5b. The census that decides which functions are subjects
// ===========================================================================

/**
 * An exported function whose type parameters mention `Total`.
 *
 * THE PATTERN THIS REPLACES WAS `/export function (\w+)<Total[,>]/g` OVER
 * SOURCE WITH BLOCK COMMENTS STRIPPED, and it missed four shapes a critic
 * listed. `<Total extends object>` failed on the character after the name;
 * `<Category, Total>` failed because `Total` was not first; an arrow assigned
 * to an exported `const` was not a `function` at all; and a signature sitting
 * inside a `//` comment counted as a real export, because only block comments
 * were removed.
 *
 * Every one of those is a way to add a driveable function that this file would
 * then not drive while its own set equality read as complete — which is the
 * fourth limit in the header claiming to be closed by construction while a
 * construction it does not cover walks past.
 *
 * The nesting allowance is one level deep (`<Total, R extends Record<string,
 * number>>`), which is what this directory actually writes. Two levels is not
 * covered and is stated rather than left: a signature that needs it would be
 * missed, and the tripwire corpus below is where a reader adds it.
 */
const GENERIC_OVER_TOTAL =
  /export\s+(?:function\s+(\w+)|const\s+(\w+)\s*(?::[^=<>]*)?=\s*)<((?:[^<>]|<[^<>]*>)*)>/g;

/** Source as the census reads it: block comments gone, line comments gone. */
function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function exportsGenericOverTotal(text: string): readonly string[] {
  const found: string[] = [];
  const code = withoutComments(text);
  for (const match of code.matchAll(GENERIC_OVER_TOTAL)) {
    if (!/\bTotal\b/.test(match[3] ?? '')) continue;
    found.push((match[1] ?? match[2]) as string);
  }
  return found;
}

// ===========================================================================
// 6. The readout — a structural walk that masks the total by identity
// ===========================================================================

/** A value the readout names rather than prints, and the name it gives it. */
interface Labelled {
  readonly value: unknown;
  readonly label: string;
}

function labelsOf<Total>(fixtures: Fixtures<Total>): readonly Labelled[] {
  return [
    { value: fixtures.total, label: '<total>' },
    { value: fixtures.otherTotal, label: '<other-total>' },
  ];
}

/**
 * A value as a string, with each total replaced by ITS OWN marker.
 *
 * BY IDENTITY, NOT BY FIELD NAME, and the difference is the point.
 * `careerOpacity.test.ts`'s observation masks every key called `total`,
 * `bestTotal` or `qualifyingTotal`, so whatever lands in one of those fields
 * reads as the same blank — which makes a function that put the WRONG total
 * there indistinguishable from one that put the right total there. Two labelled
 * values plus an identity test is what separates them, and `carries out only the
 * total it was told to` is the assertion that uses it.
 *
 * The label scan is a `for` loop over `===` rather than a `Map` lookup. Both are
 * reference comparisons and neither trips a proxy trap; the loop is here because
 * it can be read and checked by eye, which a claim about `Map`'s internal
 * hashing cannot.
 *
 * The identity test happens before any property access, so walking a structure
 * that carries the proxy does not itself trip a trap. If that ordering were
 * wrong the harness would throw rather than pass, which is the failure direction
 * to prefer.
 */
function readout(value: unknown, labels: readonly Labelled[]): string {
  for (const labelled of labels) {
    if (value === labelled.value) return labelled.label;
  }
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) {
    return `[${value.map((item) => readout(item, labels)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const held = value as Record<string, unknown>;
    const keys = Object.keys(held).sort();
    return `{${keys.map((key) => `${key}:${readout(held[key], labels)}`).join(',')}}`;
  }
  if (typeof value === 'function') return 'function';
  return JSON.stringify(value) ?? String(value);
}

// ===========================================================================
// 7. The sweep
// ===========================================================================

describe('the opaque total the probe binds', () => {
  it('throws and records on every route the three known bypasses used', () => {
    // NON-VACUITY, and the first thing to read in this file. An instrument that
    // cannot catch the routes we already know about is worthless, so each of the
    // first three confirmed bypasses is driven at the value itself, plus the
    // routes the source ban lists and two the ban has no row for.
    //
    // THE FOURTH BYPASS IS DELIBERATELY ABSENT FROM THIS CORPUS. It is a
    // membership test rather than a property access, so nothing here catches it
    // and putting it in this list would turn a green row into a false one. It is
    // driven in `is invisible to the reads a proxy has no trap for, one of which
    // ranks` instead, which is the honest place for it.
    //
    // Reddens on: a trap removed from the handler, or a trap that returns
    // instead of throwing.
    const probe = opaqueTotal();
    const total = probe.total;

    const routes: readonly { readonly id: string; readonly read: () => unknown }[] = [
      // The three confirmed bypasses, in the order they were found.
      { id: 'number-call', read: () => Number(total) },
      { id: 'array-join', read: () => [total].join() },
      { id: 'sort-no-comparator', read: () => [total, 500].sort()[0] === total },
      // The rest of the coercion surface.
      { id: 'string-call', read: () => String(total) },
      { id: 'template-hole', read: () => `${total}` },
      { id: 'json-stringify', read: () => JSON.stringify(total) },
      { id: 'value-of', read: () => total.valueOf() },
      { id: 'to-string', read: () => total.toString() },
      { id: 'spread', read: () => ({ ...total }) },
      { id: 'object-keys', read: () => Object.keys(total) },
      { id: 'object-entries', read: () => Object.entries(total) },
      { id: 'reflect-get', read: () => Reflect.get(total, 'kg') },
      { id: 'in-operator', read: () => 'kg' in total },
      { id: 'property-descriptor', read: () => Object.getOwnPropertyDescriptor(total, 'kg') },
      { id: 'array-concat', read: () => ([] as unknown[]).concat(total) },
      { id: 'array-from', read: () => Array.from([total], Number) },
      { id: 'locale-string', read: () => new Intl.NumberFormat().format(total as never) },
    ];

    const survived: string[] = [];
    let caught = 0;
    for (const route of routes) {
      probe.clear();
      let threw = false;
      try {
        route.read();
      } catch (error) {
        threw = error instanceof OpacityViolation;
      }
      if (!threw || probe.reads().length === 0) survived.push(route.id);
      else caught += 1;
    }

    expect(survived.join(', ')).toBe('');
    // Counts, not bounds, on the corpus itself.
    expect(caught).toBe(17);
    expect(routes.length).toBe(17);
    expect(new Set(routes.map((route) => route.id)).size).toBe(17);
  });

  it('is refused rather than trapped by structuredClone, which is a different thing', () => {
    // FOUND BY RUNNING IT, not by reasoning: `structuredClone` was written into
    // the corpus above as an eighteenth caught route and it is not one. On this
    // runtime it refuses a `Proxy` outright with a `DataCloneError` and calls no
    // trap at all, so the log stays empty.
    //
    // It is recorded here rather than deleted because "no trap fired" and "the
    // value did not escape" are different claims and this route satisfies the
    // second by accident of the host rather than by anything this file does. A
    // runtime that cloned proxies by walking them would fire `ownKeys` and land
    // in the corpus above; one that cloned them some other way would be a hole.
    //
    // Reddens on: a runtime where `structuredClone` starts reading the proxy —
    // at which point this row moves back into the corpus above.
    const probe = opaqueTotal();
    let refusal = 'nothing thrown';
    try {
      structuredClone(probe.total);
    } catch (error) {
      refusal = error instanceof Error ? error.name : String(error);
    }
    expect(refusal).toBe('DataCloneError');
    expect(probe.reads()).toEqual([]);
  });

  it('swallows the throw and is recorded anyway', () => {
    // THE try/catch HOLE, closed and measured. The read is recorded before the
    // throw, so a module that catches its own violation returns normally and
    // still leaves a line in the log. This is the assertion the sweep below
    // rests on: it asserts an empty LOG, not an absence of exceptions.
    //
    // Reddens on: moving the `log.push` after the `throw` in `trip`.
    const probe = opaqueTotal();
    const swallow = (): number => {
      try {
        return Number(probe.total);
      } catch {
        return 0;
      }
    };
    expect(swallow()).toBe(0);
    expect(probe.reads().length).toBe(1);
    expect(probe.reads()[0]).toBe('get(Symbol(Symbol.toPrimitive))');
  });

  it('is invisible to the reads a proxy has no trap for, one of which ranks', () => {
    // THE HONESTY CHECK for the limits listed in the header, driven rather than
    // asserted in prose. Each of these reads something about the total and none
    // of them records anything, which is what the header says and what a reader
    // would otherwise have to take on trust.
    //
    // THE VERSION THIS REPLACES COULD NOT FAIL FOR THE CLAIM IT SUPPORTED, and
    // that is the whole reason it was rewritten. It drove
    // `new Set([total]).has(total)` — the total against ITSELF — and asserted
    // the answers were `['object','true']`. A set containing a value contains
    // it, so no state of anything makes that red, and meanwhile the limits list
    // beside it said "identity carries no ordering, so a read of it cannot rank
    // two totals". That sentence was measured at one sampled value, it was
    // false in general, and the fourth bypass is what it cost: under a `number`
    // binding `Set.prototype.has` compares by SameValueZero, which is VALUE
    // equality, so a set built from a RANGE ranks the total against an interval
    // without firing a trap.
    //
    // Reddens on: a trap being added that catches one of these — which would be
    // good news and should be read as a prompt to move the item out of the
    // limits list; or on `Set.prototype.has` ceasing to separate a total inside
    // the window from one outside it, which is the ranking half.
    const probe = opaqueTotal();
    const total = probe.total;
    const kinds = new Set<string>();

    kinds.add(typeof total);
    kinds.add(String(total === probe.total));
    kinds.add(String(Object.is(total, probe.total)));
    kinds.add(String([total].includes(total)));
    kinds.add(String(new WeakSet([total]).has(total)));

    // The ranking read, at the opaque value: no trap fires, and the window
    // answers `false` because a proxy is not a number.
    const window = new Set<unknown>(RANKING_WINDOW_KG);
    kinds.add(String(window.has(total)));

    expect(probe.reads()).toEqual([]);
    expect([...kinds].sort()).toEqual(['false', 'object', 'true']);

    // And the same read, at NUMBERS, separates a total inside the window from
    // one outside it. This is the half the old version left unasserted, and it
    // is the property the fourth bypass was built out of: two ghost totals from
    // `MEET_LOCAL.ghostTotalsKg` land inside a window a band sweep stepped over.
    expect(RANKING_WINDOW_KG.length).toBe(47);
    expect(window.has(585)).toBe(true);
    expect(window.has(610)).toBe(true);
    expect(window.has(632.5)).toBe(false);
    expect(window.has(583)).toBe(false);
    expect(window.has(631)).toBe(false);
  });

  it('stands for totals that collide with nothing else the readout prints', () => {
    // The domain guard for the identity mask. A stand-in equal to a threshold, a
    // bodyweight, a day index, a rank or a count would be masked where it
    // appears as THAT quantity, and the numeric run would disagree with the
    // opaque run for a reason that is not a read.
    //
    // TWO THINGS CHANGED HERE AND BOTH WERE HOLES A CRITIC FOUND. The guard used
    // to walk `STAND_IN_KG` alone and pin `checked` at 4, so
    // `OTHER_STAND_IN_KG` — the second total, the one `lifterWithStanding` has
    // to discard — went through no check at all; it is in the walk now and the
    // pin is 6. And the predicate used to be `Number.isInteger(kg) === false`,
    // which is a proxy for "collides with a day index" and was wrong in both
    // directions: see `STAND_IN_KG`'s own docstring for what banning integers
    // made invisible.
    //
    // Reddens on: a stand-in equal to any number the readout can already print,
    // a duplicate stand-in, or the census of printed numbers going empty.
    expect(THRESHOLDS_KG).toEqual([260, 340, 415, 450, 570, 680]);
    // Counts on the census itself, so a collision set that had gone empty
    // reports itself instead of clearing every stand-in.
    expect(PRINTED_NON_TOTALS.size).toBe(191);
    expect(PRINTED_NON_TOTALS.has(CAREER_TUNING.QUALIFYING_TOTAL_KG_BY_TIER.worlds.mens)).toBe(true);
    expect(PRINTED_NON_TOTALS.has(THROUGH_DAY)).toBe(true);

    let checked = 0;
    for (const kg of ALL_STAND_INS_KG) {
      expect(
        PRINTED_NON_TOTALS.has(kg),
        `${kg} is a number the readout already prints as something other than a total`,
      ).toBe(false);
      checked += 1;
    }
    expect(checked).toBe(6);
    expect(new Set(ALL_STAND_INS_KG).size).toBe(6);
    expect(new Set(OPAQUE_PROBE.BODYWEIGHTS_KG).size).toBe(3);

    // Exactly one stand-in is integral, and it is there so an integrality
    // branch in shipped code takes a different path under the numeric run than
    // under the opaque one. With none, the two runs agreed by construction.
    expect(OPAQUE_PROBE.STAND_IN_KG.filter((kg) => Number.isInteger(kg))).toEqual([701]);
  });
});

describe('no shipped function reads anything out of a total', () => {
  it('reads every shape an exported generic over Total can be written in', () => {
    // The tripwire corpus for the census below. A set equality is only as wide
    // as the scan that builds one of its sides, and this scan's previous
    // version silently excluded four spellings — so the sides agreed and the
    // subject list was short by however many of those the directory grew.
    //
    // Each line here is a shape that must be FOUND, followed by two that must
    // not be: a generic over something that is not a total, and a signature
    // inside a line comment.
    //
    // Reddens on: narrowing the pattern back to `<Total[,>]`, dropping the
    // `const` arm, or dropping the line-comment strip. MEASURED with the old
    // implementation restored, verbatim:
    //   expected [ 'plain', 'nested', 'commentedOut' ] to deeply equal
    //   [ 'plain', 'bounded', 'second', …(3) ]
    // — four missed and one phantom, from one scanner.
    //
    // AND THE ISOLATION, which is what says this matters to the directory
    // rather than to a corpus. With
    // `export const totalIsListed = <Total,>(total: Total, seen: readonly
    // Total[]): boolean => seen.includes(total);` planted in `careerRecord.ts`
    // — an exported function generic over `Total` that nothing here drives —
    // `tsc --noEmit` is exit 0 and the census below reddens on
    // `expected [ 'admitsOffer', …(25) ] to deeply equal [ 'admitsOffer',
    // …(26) ]`. Under the OLD scanner, with the same declaration in place, that
    // census is GREEN and this test is the one and only thing that goes red.
    const corpus = [
      'export function plain<Total>(x: Total): Total { return x; }',
      'export function bounded<Total extends object>(x: Total): Total { return x; }',
      'export function second<Category, Total>(a: Category, b: Total): Total { return b; }',
      'export function nested<Total, Rules extends Record<string, number>>(a: Total): Total { return a; }',
      'export const arrow = <Total,>(x: Total): Total => x;',
      'export const annotated: Shape = <Total>(x: Total): Total => x;',
      'export function noTotalHere<Rules>(r: Rules): Rules { return r; }',
      '// export function commentedOut<Total>(x: Total): Total { return x; }',
      '/* export function blockCommented<Total>(x: Total): Total { return x; } */',
    ].join('\n');

    expect(exportsGenericOverTotal(corpus)).toEqual([
      'plain',
      'bounded',
      'second',
      'nested',
      'arrow',
      'annotated',
    ]);
    // Counts on both the corpus and the finding, so a corpus that lost a line
    // reports itself rather than agreeing with a shorter expectation.
    expect(corpus.split('\n').length).toBe(9);
    expect(exportsGenericOverTotal(corpus).length).toBe(6);
    // And the two shapes the old pattern got wrong in the OTHER direction: a
    // commented-out export is a phantom, and this is where that is pinned.
    expect(exportsGenericOverTotal(corpus)).not.toContain('commentedOut');
    expect(exportsGenericOverTotal(corpus)).not.toContain('blockCommented');
    expect(exportsGenericOverTotal(corpus)).not.toContain('noTotalHere');
  });

  it('drives every exported function that is generic over Total', () => {
    // THE FOURTH LIMIT IN THE HEADER, closed by construction. The subject list
    // is a sampled domain of its own kind — a function nobody drove is a
    // function nobody checked — so the list is compared against the export list
    // read out of the shipped sources, as a set equality in both directions.
    //
    // Reddens on: a new exported function generic over `Total` (as a missing
    // driver), or a subject whose function was renamed or deleted (as a stale
    // one).
    const here = path.dirname(new URL(import.meta.url).pathname);
    const shipped = readdirSync(here)
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
      .sort();
    expect(shipped).toEqual([
      'careerCore.ts',
      'careerEngagement.ts',
      'careerRecord.ts',
      'careerTuning.ts',
      'flight.ts',
    ]);

    const exported = new Map<string, string>();
    for (const name of shipped) {
      for (const found of exportsGenericOverTotal(readFileSync(path.join(here, name), 'utf8'))) {
        exported.set(found, name);
      }
    }

    const driven = new Set(SUBJECTS.map((subject) => subject.id));
    expect([...driven].sort()).toEqual([...exported.keys()].sort());
    // Counts, not bounds, on both sides, so an empty scan reports itself.
    expect(exported.size).toBe(28);
    expect(driven.size).toBe(28);
    // Every subject names the module it actually came from.
    const misfiled = SUBJECTS.filter((subject) => exported.get(subject.id) !== subject.module);
    expect(misfiled.map((subject) => subject.id).join(', ')).toBe('');
    // Two of the twenty-six are constructors that take no total at all, and the
    // flag that says so is pinned rather than left to be read off the list.
    expect(SUBJECTS.filter((subject) => !subject.takesATotal).map((subject) => subject.id)).toEqual([
      'createCareerLifter',
      'createCareerRecord',
    ]);
  });

  it('records no read from any subject, under any gate, at any total', () => {
    // THE INSTRUMENT. There is no domain here to be empty: one value stands for
    // every total, and a module that touches it is caught whatever it would have
    // done with the number. The three confirmed bypasses are all property reads
    // on the total — `Number()` through `Symbol.toPrimitive`, `join()` and
    // `sort()` through `toString` — so each of them reddens this at every gate
    // and every stand-in rather than at the one value a band happened to hold.
    //
    // Reddens on: any coercion of a total in any driven function. MEASURED with
    // the third bypass planted, verbatim from the run:
    //   career: a shipped module read get(Symbol(Symbol.toPrimitive)) off an
    //   opaque total
    const violations: string[] = [];
    const disagreements: string[] = [];
    const leaked: string[] = [];
    let runs = 0;
    let fixtureReads = 0;

    for (const subject of SUBJECTS) {
      for (const shape of GATE_SHAPES) {
        for (const standsForKg of OPAQUE_PROBE.STAND_IN_KG) {
          const probe = opaqueTotal();
          const spare = opaqueTotal();
          const opaque = buildFixtures<OpaqueTotal>(probe.total, spare.total);
          // Building the fixtures runs `createCareerLifter`, `recordMeetResult`
          // and the spreads around them, so a read there is a real finding and
          // is counted separately rather than folded into the subject's.
          fixtureReads += probe.reads().length + spare.reads().length;
          probe.clear();
          spare.clear();

          let opaqueOut: string;
          try {
            opaqueOut = readout(
              subject.run(opaque, blindGate<OpaqueTotal>(shape.answer, standsForKg)),
              labelsOf(opaque),
            );
          } catch (error) {
            opaqueOut = `<threw ${error instanceof Error ? error.message : String(error)}>`;
          }
          const reads = [...probe.reads(), ...spare.reads()];
          if (reads.length > 0) {
            violations.push(`[${subject.id}/${shape.id}@${standsForKg}] ${reads.join(' ')}`);
          }
          // The total handed in to be discarded must not come out. Only
          // `lifterWithStanding` is given one, and it is given one because that
          // is the function whose whole job is choosing between two totals.
          if (opaqueOut.includes('<other-total>')) {
            leaked.push(`[${subject.id}/${shape.id}@${standsForKg}] ${opaqueOut}`);
          }

          const numeric = buildFixtures<number>(standsForKg, OPAQUE_PROBE.OTHER_STAND_IN_KG);
          const numericOut = readout(
            subject.run(numeric, blindGate<number>(shape.answer, standsForKg)),
            labelsOf(numeric),
          );
          if (numericOut !== opaqueOut) {
            disagreements.push(
              `[${subject.id}/${shape.id}@${standsForKg}]\n  opaque:  ${opaqueOut}\n  numeric: ${numericOut}`,
            );
          }
          runs += 1;
        }
      }
    }

    // The claim, with the offending reads in the message rather than a count.
    expect(violations.slice(0, 5).join('\n')).toBe('');
    expect(violations.length).toBe(0);
    expect(fixtureReads).toBe(0);
    // The weaker half, kept because it is nearly free: see the header.
    expect(disagreements.slice(0, 3).join('\n')).toBe('');
    expect(disagreements.length).toBe(0);
    // The discarded total, which the field-name mask one file over cannot see.
    // MEASURED with `return Object.freeze({ ...lifter, bestTotal:
    // lifter.bestTotal });` planted in `lifterWithStanding`, verbatim:
    //   [lifterWithStanding/refuses-everything@12.5] {bestTotal:<other-total>,…
    expect(leaked.slice(0, 3).join('\n')).toBe('');
    expect(leaked.length).toBe(0);
    // The domain, pinned as counts.
    expect(runs).toBe(SUBJECTS.length * GATE_SHAPES.length * OPAQUE_PROBE.STAND_IN_KG.length);
    expect(runs).toBe(840);
  });

  it('catches a lifter that keeps its own total instead of the standing’s', () => {
    // THE NON-VACUITY GUARD for `leaked` above, driven against the mutant it
    // exists for rather than argued. Without a tripwire, an empty `leaked` list
    // is satisfied by a probe that never hands a second total to anything.
    //
    // The mutant is the one `careerOpacity.test.ts`'s substitution probe could
    // not see: `lifterWithStanding` returning `{ ...lifter, bestTotal:
    // lifter.bestTotal }` — writing no standing at all. Its field-name mask
    // blanks `bestTotal` whatever is in it, so both implementations observe
    // identically there. Here they do not.
    //
    // Reddens on: the label pair collapsing to one, or `carrier` losing the
    // other total.
    const probe = opaqueTotal();
    const spare = opaqueTotal();
    const fixtures = buildFixtures<OpaqueTotal>(probe.total, spare.total);
    const labels = labelsOf(fixtures);
    const standing = careerStanding(
      fixtures.record,
      OPAQUE_PROBE.CATEGORY,
      blindGate<OpaqueTotal>(GATE_SHAPES[2]?.answer as GateShape['answer'], 632.5),
    );

    const shipped = readout(lifterWithStanding(fixtures.carrier, standing), labels);
    const mutant = readout({ ...fixtures.carrier, bestTotal: fixtures.carrier.bestTotal }, labels);

    expect(shipped).toContain('<total>');
    expect(shipped).not.toContain('<other-total>');
    expect(mutant).toContain('<other-total>');
    expect(mutant).not.toContain('bestTotal:<total>');
    // Neither reading touched either total.
    expect(probe.reads()).toEqual([]);
    expect(spare.reads()).toEqual([]);
  });

  it('reaches more than one answer in every subject that has more than one', () => {
    // The non-vacuity guard for the sweep above. A subject whose readout is the
    // same string under every gate and every stand-in has been called and has
    // checked almost nothing — the sweep would be green for a function that
    // returned a constant. So the number of distinct readouts per subject is
    // pinned, and the flat ones are named rather than hidden in an aggregate.
    //
    // Reddens on: a subject wired to a fixture that flattens it, which is the
    // defect `careerOpacity.test.ts` found in its own `runEntryPlan` subject.
    const spread: Record<string, number> = {};
    for (const subject of SUBJECTS) {
      const seen = new Set<string>();
      for (const shape of GATE_SHAPES) {
        for (const standsForKg of OPAQUE_PROBE.STAND_IN_KG) {
          const probe = opaqueTotal();
          const spare = opaqueTotal();
          const fixtures = buildFixtures<OpaqueTotal>(probe.total, spare.total);
          seen.add(
            readout(
              subject.run(fixtures, blindGate<OpaqueTotal>(shape.answer, standsForKg)),
              labelsOf(fixtures),
            ),
          );
        }
      }
      spread[subject.id] = seen.size;
    }
    expect(spread).toEqual({
      earliestNextEntryDay: 1,
      meetEligibility: 5,
      selectableMeets: 4,
      createCareerLifter: 1,
      enterMeet: 4,
      careerLifterFaults: 1,
      createCareerRecord: 1,
      hasCompetedAt: 1,
      resultFor: 1,
      competedSlotIds: 1,
      lastResultDay: 1,
      recordMeetResult: 1,
      qualifiedTierFor: 5,
      careerStanding: 4,
      standingAsOf: 4,
      tierUnlockBetween: 4,
      lifterWithStanding: 1,
      careerGateFaults: 2,
      careerRecordFaults: 1,
      careerHistoryFaults: 1,
      resultsUnder: 1,
      standingUnder: 4,
      runRecordHistory: 4,
      runEntryPlan: 5,
      admitsOffer: 4,
      compareCareerEngagement: 1,
      placeFlight: 1,
      flightPlacingFaults: 1,
    });
    // THE FLAT ONES, NAMED, because an aggregate would hide them and because
    // fourteen of twenty-six is not a footnote. For each of these the sweep above
    // carries the no-read property and nothing else, and the reason differs:
    //
    //   - Eleven take no gate at all, so there is nothing for a gate shape to
    //     vary: the two constructors, the three fault reporters, and the six
    //     record accessors.
    //   - `lifterWithStanding` takes a standing and writes one field, and on the
    //     shipped table `qualifiedTierFor` never returns `null` for a posted
    //     total — local asks for nothing — so the field it writes is the total
    //     under every gate. Its discriminating check is the tripwire above, not
    //     this census.
    //   - `compareCareerEngagement` compares two runs of the SAME total, so the
    //     gate's effect on `qualifiedRank` is identical on both sides and cancels.
    //     What is left moving is `competedRank` and `meetsCompleted`, and neither
    //     consults the gate. This one was 1 before the attendance patterns were
    //     changed to add a meet at a HIGHER tier and it is 1 after; the change was
    //     kept because it makes the two runs differ in rank as well as in count,
    //     which the earlier pair did not.
    //   - THE TWO FLIGHT SUBJECTS TAKE NO GATE AND THIS CENSUS IS THE WRONG
    //     INSTRUMENT FOR THEM, which is said here rather than left to be read
    //     off a 1. `placeFlight` and `flightPlacingFaults` take an ORDER, and
    //     this sweep varies gate shape and stand-in kilograms, neither of which
    //     reaches one. Their answers do vary — across `ORDER_SHAPES`, inside a
    //     single run — and that is pinned in the assertion below rather than
    //     folded in here, because folding it in would make their 1 read as the
    //     same kind of flatness as `createCareerRecord`'s and it is not.
    const flat = Object.keys(spread)
      .filter((id) => spread[id] === 1)
      .sort();
    expect(flat).toEqual([
      'careerHistoryFaults',
      'careerLifterFaults',
      'careerRecordFaults',
      'compareCareerEngagement',
      'competedSlotIds',
      'createCareerLifter',
      'createCareerRecord',
      'earliestNextEntryDay',
      'flightPlacingFaults',
      'hasCompetedAt',
      'lastResultDay',
      'lifterWithStanding',
      'placeFlight',
      'recordMeetResult',
      'resultFor',
      'resultsUnder',
    ]);
    expect(flat.length).toBe(16);
  });

  it('reaches more than one answer across the order shapes, in both flight subjects', () => {
    // The non-vacuity guard the census above cannot be. Those two subjects sit
    // at 1 there because the sweep varies a gate and they do not take one; what
    // varies them is `ORDER_SHAPES`, and without a check on that a comparator
    // subject that ignored its order entirely would look exactly like a
    // well-behaved one.
    //
    // Reddens on: `placeFlight` returning a sheet that does not depend on the
    // injected order, or `flightPlacingFaults` never consulting it — either of
    // which collapses one of these counts to 1.
    const probe = opaqueTotal();
    const spare = opaqueTotal();
    const fixtures = buildFixtures<OpaqueTotal>(probe.total, spare.total);
    const entries = flightEntriesFor(fixtures);

    const sheets = new Set(
      ORDER_SHAPES.map((shape) =>
        readout(placeFlight(entries, shape.make()), labelsOf(fixtures)),
      ),
    );
    const faults = new Set(
      ORDER_SHAPES.map((shape) =>
        readout(flightPlacingFaults(entries, shape.make()), labelsOf(fixtures)),
      ),
    );
    // COUNTS, NOT BOUNDS, ON BOTH SIDES — AND THEY ARE 3 OUT OF 4, WITH BOTH
    // COLLISIONS NAMED. Four shapes produce three distinct sheets and three
    // distinct fault lists, and rounding either up to 4 would be a false
    // number:
    //
    //   - `left-first` and `cycling` produce the SAME sheet. Both leave this
    //     engine's sort with the same arrangement of three placed entries; the
    //     shapes still differ, which is what the fault census shows.
    //   - `left-first` and `right-first` produce the same FAULT LIST. Their
    //     sheets are mirror images, and an antisymmetry fault names an
    //     unordered pair, so the sentences come out identical.
    //
    // Reddens on: a shape dropped from `ORDER_SHAPES`, or a subject that stops
    // consulting its order — which collapses one of these to 1.
    expect(ORDER_SHAPES.length).toBe(4);
    expect(sheets.size).toBe(3);
    expect(faults.size).toBe(3);
    // And the whole exercise ran without a single read, which is what makes
    // "the order changed the answer" a statement about the order rather than
    // about the total.
    expect([...probe.reads(), ...spare.reads()]).toEqual([]);
  });
});
