/**
 * flight.ts — GDD §6.6's flight structure, as pure logic.
 *
 * §6.6's sentence is the whole of this piece: "Real flight structure: lifters
 * grouped into flights of ~10-15, attempts resolve in turn order, live
 * leaderboard feed". So three things and the ordering that joins them:
 *
 *   1. COMPOSITION — dividing a field into flights.
 *   2. BAR-LOADING ORDER — who takes the bar next, inside a round, inside a
 *      flight, and what the bar is allowed to do between two attempts.
 *   3. PLACING — the ordering of a flight by result, with the tie-breaks.
 *
 * Pure module (CLAUDE.md, "Pure logic is separate from UI"): zero React, zero
 * side effects, zero I/O, no clock and no randomness. Its one import is
 * `./careerTuning`, which `careerCore.test.ts` pins for the whole directory.
 * Lot numbers are an INPUT here and are never generated — drawing lots is a
 * random act and this module rolls no dice.
 *
 * ===========================================================================
 * 1. Where these rules come from, and the citation this file cannot spell
 * ===========================================================================
 *
 * Bar-loading order and placing tie-breaks are not design decisions. They are
 * published competition rules and a lifter reads them off a scoreboard every
 * time they compete, so an invented-but-plausible version is the failure mode
 * here. Every rule below was searched before it was written and the wording it
 * came from is quoted beside the constant or the function that implements it.
 *
 * THE SOURCE, now named. The rules below are transcribed from the IPF
 * *Technical Rules Book*, 2026 edition, effective 1 March 2026:
 *
 *     https://www.powerlifting.sport/fileadmin/ipf/data/rules/technical-rules/english/2026_IPF_Technical_Rulebook__effective_01_March_2026__v3.pdf
 *
 * cross-read against the 2023 edition on the same rules page and against two
 * national affiliates' reprints of the same passages, and — for the claim that
 * a flight may hold more than one weight class — against general meet-practice
 * guides, which are a different source class and could have disagreed.
 *
 * THIS PARAGRAPH USED TO DESCRIBE THE BODY RATHER THAN NAME IT, and the reason
 * is worth keeping because it is the machinery working. `realIp.ts` watches
 * this federation's acronym and `REVIEWABLE_CITATIONS` pins an exact per-file
 * mention count for the whole tree, so writing the name here reddened
 * `realIp.test.ts` until a row existed — and `src/licensing/` belongs to the
 * other session. The file therefore shipped with a paraphrase and said plainly
 * that a paraphrase is weaker than a URL a reader can click.
 *
 * That is exactly the case `realIp.ts`'s own ruling covers: a body whose
 * published rule is being implemented is a STRUCTURAL CITATION and belongs on
 * that list rather than being deleted, as against a federation name a PLAYER
 * SEES, which is category (A) and default-denied. A rulebook citation in a
 * module header is the first kind. The row was approved and taken as crossing 5
 * in CLAUDE.md's coordination section, and the guard did the thing it exists to
 * do: it made naming a real body a decision somebody signed rather than a thing
 * that happened.
 *
 * What could NOT be confirmed, said plainly rather than papered over:
 *
 *   - HOW A FIELD IS ASSIGNED TO FLIGHTS. The published rule fixes the size cap
 *     and nothing else that could be found. Sessions and weight classes decide
 *     the rest at a real meet, and that is the caller's business here — see
 *     `composeFlights`, which preserves the order it is handed.
 *   - A MINIMUM FLIGHT SIZE. No published floor was found. GDD §6.6's "~10-15"
 *     is a design expectation and is carried as `FLIGHT_SIZE_BUDGET`, not as a
 *     rule; `flightsOutsideSizeBudget` reports rather than refuses.
 *   - WHAT SEPARATES TWO LIFTERS THE PUBLISHED CHAIN LEAVES TIED. The chain
 *     ends after three steps. See `PLACING_UNRESOLVED_ORDER`.
 *   - The rule numbers. The rulebook PDF could not be retrieved from this
 *     environment (the publisher's host is blocked here), so the wording below
 *     is quoted from search results that reproduce it, cross-read across
 *     editions and affiliates, and no section number is claimed. A quoted rule
 *     with no number is worth less than one with a number and is worth much
 *     more than a number nobody checked.
 *
 * ===========================================================================
 * 1a. A FLIGHT IS NOT AN AWARD CATEGORY, and this file used to place as if it
 *     were
 * ===========================================================================
 *
 * The ruling this section records was a real fork with two defensible answers,
 * and it is written down because picking one silently is the failure mode a
 * competitive lifter would catch on sight.
 *
 * THE DEFECT. `placeFlight` used to rank every entry in a flight against every
 * other and hand out `place: 1, 2, 3`, with no notion of who was competing
 * against whom. That reads as a result sheet and it is not one. Nobody is
 * awarded "1st in Flight B": a flight is a LOGISTICAL grouping — it exists so
 * one bar can be run through a manageable number of lifters — while a placing is
 * awarded inside a category made of gender, weight class, age group and
 * equipment/tested division. The two are different partitions of the same
 * session and they cut across each other.
 *
 * That is not an aesthetic objection, and it is what makes the tie-break chain
 * below coherent or incoherent. Step 2 says the lighter lifter ranks above the
 * heavier one on an equal total. Applied inside a weight class that is a real
 * rule about who did more. Applied across a flight that mixes a 59 kg lifter and
 * a 120 kg lifter it is arithmetic about two people who are not competing, and
 * it would have decided a place.
 *
 * WHAT WAS SEARCHED, and it is the flight side that settles it rather than the
 * placing side. The published wording found, quoted, is that flights "shall be
 * determined logically by any or all of the following; gender, bodyweight
 * categories, age group categories, drug-tested/untested, and/or first attempts
 * listed during the weigh-ins", that a flight may be formed by grouping
 * categories together "or as decided by the organizer of the event", and that
 * mixed-gender flights exist. So a flight may hold more than one category BY
 * RULE, not merely by accident. On the other side, placings "for every age
 * grouping are decided by total", with medals awarded "in each weight class
 * across all age divisions" — the award scope is the category, never the flight.
 * As elsewhere in this file the publisher is described rather than named; see
 * the section above for why, and the build report for the names.
 *
 * CORROBORATED FROM A SECOND, INDEPENDENT SOURCE CLASS, because the builder
 * flagged its own citation here as weaker than this paragraph's tone. The
 * wording above came from a national affiliate's rulebook; the claim was then
 * re-searched against general meet-practice guides, which are a different kind
 * of source and could have disagreed. They do not. The sentence found there is
 * flatter and stronger than the one quoted above: **"A flight can be composed
 * of a single weight class or any combination of weight classes."** The same
 * material has flights "split up into Weight Classes, Gender, and/or Division",
 * and has directors forming them from opening attempts so the loaders change
 * plates as little as possible — which is the same fact `barLoadingOrder`
 * implements from the other end.
 *
 * Two source classes that could have disagreed and did not is what this claim
 * rests on. It is still not the international body's own PDF, which is
 * egress-blocked here, and that remains the honest limit of it.
 *
 * THE TWO ANSWERS, and why the second one was taken:
 *
 *   1. CALL IT A FLIGHT ORDERING. §6.6 does ask for a "live leaderboard feed",
 *      and a feed showing the flight in total order is a real artefact. Under
 *      this reading the fix is a rename: nothing may be called a `place`.
 *      REJECTED, because it makes the module unable to answer the question the
 *      game actually needs — who won — and because it would leave the
 *      bodyweight tie-break in place while removing the only scope in which
 *      that tie-break means anything. A rename that keeps incoherent arithmetic
 *      and stops advertising it is the worse half of both options.
 *
 *   2. CARRY THE CATEGORY AND PLACE WITHIN IT. TAKEN. `FlightResultEntry` now
 *      carries `categoryId` and `placeFlight` places inside each category. The
 *      live-feed reading survives whole — run it partway through and each
 *      category's rows are that category's leaderboard as it stands, which is
 *      what a real scoreboard shows.
 *
 * `categoryId` IS OPAQUE TO THIS MODULE, deliberately, and that is the same
 * decision the `Total` seam makes for the same reason. What composes a category
 * — the weight-class table, the age bands, the equipment and testing divisions —
 * is federation policy, it differs between the four fictional federations in
 * `careerTuning.ts`, and a module that sorts has no business deciding it. So the
 * caller composes an id and this module only ever asks whether two are the same
 * string. It never parses one, never orders by one, and never invents one.
 *
 * THERE IS NO DEFAULT CATEGORY, for the reason there is no default order: a
 * caller that has not decided what a lifter is competing in should fail to
 * compile rather than silently get a flight-wide placing back, which is exactly
 * the defect being fixed. `flightPlacingFaults` reports a blank id, because a
 * `string` cannot make that a type error.
 *
 * WHAT THIS DOES NOT DO, said so it is not read as more: it does not place a
 * category that spans more than one flight. `placeFlight` places the entries it
 * is handed, so a category split across flights A and B is placed correctly only
 * if the caller hands over both flights' entries at once — and then
 * `totalReachedAtPosition` has to be a coordinate comparable across both, which
 * `flightAttemptSequence`'s flight-local `position` is not. That seam is the
 * caller's and is named in `FlightResultEntry`.
 *
 * ===========================================================================
 * 2. Placing needs an ORDER over totals, and that is more power than the gate
 * ===========================================================================
 *
 * `careerCore.ts` takes qualification as an injected predicate over an opaque
 * `Total` for reasons its header sets out at length: `meetsQualifyingTotal`
 * lives in `src/game/progression.ts`, this directory must not import it, and a
 * locally-summed comparison is the thing that seam exists to refuse.
 *
 * Placing asks for strictly more. A gate answers one bit about one total
 * against a number the calendar already holds; a placing sorts a flight, which
 * means comparing totals to EACH OTHER. So the comparator is injected the same
 * way and over the same opaque `Total`:
 *
 *     type TotalOrder<Total> = (left: Total, right: Total) => number;
 *
 * and this module never constructs a total, never inspects one, and never
 * compares one to anything itself. Two totals are equal here exactly when the
 * injected order returns zero about them — not when `===` says so, which would
 * be identity wearing equality's clothes and is one of the channels
 * `careerOpaqueTotal.test.ts`'s header lists as outside its own reach.
 *
 * THERE IS DELIBERATELY NO DEFAULT ORDER, and the argument is `careerCore.ts`'s
 * one about the gate, restated for ordering because ordering is where it bites
 * harder. A defaulted `(a, b) => a - b` reads harmless: it is the comparator
 * everyone writes. It would also silently accept a projected total, a locally
 * summed board total, or a number a phone made up, and it would do so on the
 * screen where a player's placing is decided. A caller that forgets to inject
 * should fail to compile, not sort. The `default-gate` row in
 * `careerOpacity.test.ts` is keyed to `CareerQualifyingGate`; the sibling row
 * for `TotalOrder` is what stops that sentence from being prose alone.
 *
 * The four bypasses recorded in `careerOpacity.test.ts`'s header are the
 * reading list for anything added here. Three of them read magnitude out of a
 * total through a channel nobody had listed — `join()`, a comparator-less
 * `sort()`, `Set.prototype.has` over a range — and a sort is where all three
 * would look most at home. What this module does about it, concretely:
 *
 *   - No total is ever an argument to `Array.prototype.sort`. The sort runs
 *     over placing rows and its comparator calls the injected order.
 *   - No arithmetic, no relational operator and no member read touches a total.
 *     `careerOpacity.test.ts`'s ban scans this file for all three.
 *   - The placings this module returns carry no total. A leaderboard row that
 *     prints one gets it from the caller, which is the side that already has
 *     one.
 *
 * ===========================================================================
 * 3. What this module does not do
 * ===========================================================================
 *
 *   - IT DOES NOT SCORE, and it does not sum. Squat/bench/deadlift, three
 *     attempts each, the total as the sum of the best successful attempt per
 *     lift, and attempts not going down within a lift are `src/game/meet.ts`'s
 *     rules; `careerCore.ts`'s header already says this directory does not
 *     restate them, and a flight engine that summed a card would be the
 *     locally-summed total the seam above refuses. A `Total` arrives here
 *     finished and opaque.
 *   - It does not decide whether a declared weight is loadable. Bar loading
 *     rules — the plate ladder, the smallest increment, the collar — are
 *     `MeetLoadingRules` in `src/game/meet.ts`. This module orders declared
 *     attempts; it does not weigh them.
 *   - It does not name a flight. Real meets call them A, B, C; that is copy and
 *     copy is the screen's, as it is everywhere else in this directory.
 *   - It does not run a clock, hold a turn window, or broadcast anything.
 *     §6.6's "turn-based with a live feed" is an architecture note naming a
 *     specific realtime service, and the transport is the wiring piece's. The
 *     service is not named here for the reason section 1 gives about the
 *     federation: `src/licensing/realIp.ts` watches it, and a mention in this
 *     file moves a pin in a file outside this piece. The guard found this one
 *     rather than a reviewer, which is the cheapest possible demonstration that
 *     it is live.
 *   - It does not write progression. Nothing here is purchasable and nothing
 *     here is a currency; GDD §12.3's pay-to-win condition has no surface in a
 *     module that sorts.
 */

import { CAREER_TUNING } from './careerTuning';

// ---------------------------------------------------------------------------
// Vocabulary, derived from the tuning block rather than restated beside it
// ---------------------------------------------------------------------------

/**
 * The two things that decide who takes the bar next inside a round, in the
 * order the published rule applies them.
 */
export type BarLoadingTieBreak = (typeof CAREER_TUNING.BAR_LOADING_TIE_BREAKS)[number];

/** The published bar-loading chain, typed. The data is `careerTuning.ts`'s. */
export const BAR_LOADING_TIE_BREAK_ORDER: readonly BarLoadingTieBreak[] =
  CAREER_TUNING.BAR_LOADING_TIE_BREAKS;

/** The three published steps that separate two lifters on the result sheet. */
export type PlacingTieBreak = (typeof CAREER_TUNING.PLACING_TIE_BREAKS)[number];

/** The published placing chain, typed. */
export const PLACING_TIE_BREAK_ORDER: readonly PlacingTieBreak[] =
  CAREER_TUNING.PLACING_TIE_BREAKS;

/** The label for a pair the published chain does not separate. */
export type PlacingUnresolved = typeof CAREER_TUNING.PLACING_UNRESOLVED_ORDER;

/** What separated a placing from the one above it, or `null` for the top row. */
export type PlacingDecidedBy = PlacingTieBreak | PlacingUnresolved | null;

// ---------------------------------------------------------------------------
// 1. Composition
// ---------------------------------------------------------------------------

/**
 * One lifter in the field, as composition sees them.
 *
 * A lot number and nothing else, because that is all the published ordering
 * rules read. Bodyweight, category and total arrive later, at
 * `FlightResultEntry` — the one function that needs them is `placeFlight`.
 *
 * THAT SENTENCE USED TO SAY "division" AND NO TYPE IN THIS FILE TOOK ONE. It
 * was written while carrying a division was the plan, kept after the code went
 * another way, and it survived a round — the pattern CLAUDE.md's guarantee-prose
 * section records eight times. It is true now because section 1a made it true,
 * not because the wording was softened: `FlightResultEntry.categoryId` is the
 * thing it was promising. `names the fields a lifter is placed by` is what goes
 * red if that field leaves again.
 *
 * `lotNumber` is drawn at weigh-in and is an input to this whole module. The
 * quoted rule: "lots will be drawn to establish the order of weigh in, and the
 * lots drawn also establish the order of lifting throughout the competition
 * when lifters require the same weights for their attempts."
 */
export interface FlightMember {
  readonly lifterId: string;
  readonly lotNumber: number;
}

/**
 * One flight: a contiguous slice of the field that shares a bar.
 *
 * `flightIndex` is zero-based and is a position, not a name. A screen that
 * wants "Flight B" derives it; see this file's header on copy.
 */
export interface Flight {
  readonly flightIndex: number;
  readonly members: readonly FlightMember[];
}

/**
 * How many flights a field of this size is divided into.
 *
 * The published cap is the only constraint found: "Lifters will be divided into
 * flights of no more than 14 lifters in each flight." So the answer is the
 * fewest flights that respects it, and `composeFlights` then balances them.
 *
 * Throws a `RangeError` on a field size that is not a whole number of lifters,
 * is negative, or exceeds `FLIGHT_MAX_FIELD_SIZE`. The guard is the same shape
 * `buildCareerCalendar` uses on `CALENDAR_MAX_SLOTS`: a caller asking for a
 * hundred-thousand-lifter session gets a named refusal rather than an array
 * nothing can draw.
 */
export function flightCount(fieldSize: number): number {
  if (!Number.isInteger(fieldSize) || fieldSize < 0) {
    throw new RangeError(
      `career: a field of ${fieldSize} is not a whole number of lifters`,
    );
  }
  if (fieldSize > CAREER_TUNING.FLIGHT_MAX_FIELD_SIZE) {
    throw new RangeError(
      `career: a field of ${fieldSize} exceeds FLIGHT_MAX_FIELD_SIZE ` +
        `(${CAREER_TUNING.FLIGHT_MAX_FIELD_SIZE})`,
    );
  }
  if (fieldSize === 0) return 0;
  return Math.ceil(fieldSize / CAREER_TUNING.MAX_LIFTERS_PER_FLIGHT);
}

/**
 * The field, divided into flights.
 *
 * Two properties, and only the first is a published rule:
 *
 *   1. No flight holds more than `MAX_LIFTERS_PER_FLIGHT`. That is the rule.
 *   2. The flights are as equal in size as an integer division allows, and each
 *      is a CONTIGUOUS slice of the field in the order the caller handed it
 *      over. That is this module's choice, made because the published text
 *      fixes only the cap, and it is the choice a real meet makes: a field of
 *      15 runs 8 and 7 rather than 14 and 1.
 *
 * The caller decides what the field's order MEANS — session, weight class,
 * declared opener. Nothing here reorders it, so a caller that hands over a list
 * grouped by weight class gets flights grouped by weight class.
 *
 * A field of 15 to 19 lifters produces flights below GDD §6.6's "~10-15", and
 * that is a real divergence rather than an oversight: the published cap of 14
 * forces the split, and every way of splitting 15 lands at least one flight
 * under 10. `flightsOutsideSizeBudget` is where that surfaces, as a report.
 */
export function composeFlights(field: readonly FlightMember[]): readonly Flight[] {
  const count = flightCount(field.length);
  if (count === 0) return Object.freeze([]);

  const base = Math.floor(field.length / count);
  const remainder = field.length % count;

  const flights: Flight[] = [];
  let cursor = 0;
  for (let flightIndex = 0; flightIndex < count; flightIndex += 1) {
    const size = flightIndex < remainder ? base + 1 : base;
    flights.push(
      Object.freeze({
        flightIndex,
        members: Object.freeze(field.slice(cursor, cursor + size)),
      }),
    );
    cursor += size;
  }
  return Object.freeze(flights);
}

/**
 * Everything wrong with a composition, as sentences, or an empty list.
 *
 * `composeFlights` cannot produce any of these. This is for the other path: a
 * composition that arrived as JSON from an Edge Function, or one a human
 * arranged by hand at a meet, where the types above are not a check.
 *
 * A duplicate lot number is the fault worth naming. It is not cosmetic: the lot
 * is the last tie-break in the bar-loading chain, so two lifters sharing one
 * leave the published rule with nothing left to say about which of them lifts
 * first.
 */
export function flightCompositionFaults(flights: readonly Flight[]): readonly string[] {
  const faults: string[] = [];
  const seenLifters = new Set<string>();
  const seenLots = new Set<number>();

  for (let index = 0; index < flights.length; index += 1) {
    const flight = flights[index] as Flight;
    if (flight.flightIndex !== index) {
      faults.push(
        `career: the flight at position ${index} is numbered ${flight.flightIndex}`,
      );
    }
    if (flight.members.length > CAREER_TUNING.MAX_LIFTERS_PER_FLIGHT) {
      faults.push(
        `career: flight ${flight.flightIndex} holds ${flight.members.length} lifters, over the ` +
          `published maximum of ${CAREER_TUNING.MAX_LIFTERS_PER_FLIGHT}`,
      );
    }
    if (flight.members.length === 0) {
      faults.push(`career: flight ${flight.flightIndex} holds nobody`);
    }
    for (const member of flight.members) {
      if (seenLifters.has(member.lifterId)) {
        faults.push(`career: ${member.lifterId} appears in more than one flight`);
      }
      seenLifters.add(member.lifterId);

      if (!Number.isInteger(member.lotNumber) || member.lotNumber < 1) {
        faults.push(
          `career: ${member.lifterId} carries lot ${member.lotNumber}, which is not a drawn lot`,
        );
      } else if (seenLots.has(member.lotNumber)) {
        faults.push(
          `career: lot ${member.lotNumber} is held by two lifters, so the bar-loading tie-break ` +
            `has nothing left to decide with`,
        );
      }
      seenLots.add(member.lotNumber);
    }
  }
  return faults;
}

/**
 * The flights whose size sits outside GDD §6.6's stated band, as sentences.
 *
 * A REPORT AND NOT A REFUSAL, which is the whole reason it is a separate
 * function from `flightCompositionFaults`. §6.6's "~10-15" is a design
 * expectation about how a synchronous meet should feel to be in; the cap of 14
 * is a rule. Mixing the two would make a legal composition look illegal, and
 * would put a design budget behind a sentence that reads like a rulebook.
 *
 * The band's top is 15 and the published cap is 14, so §6.6's upper figure is
 * one lifter above what any flight may legally hold. That is recorded in
 * `FLIGHT_SIZE_BUDGET`'s docstring and pinned in `flight.test.ts` rather than
 * quietly rounded away.
 */
export function flightsOutsideSizeBudget(flights: readonly Flight[]): readonly string[] {
  const notes: string[] = [];
  const budget = CAREER_TUNING.FLIGHT_SIZE_BUDGET;
  for (const flight of flights) {
    const size = flight.members.length;
    if (size < budget.min) {
      notes.push(
        `career: flight ${flight.flightIndex} holds ${size} lifters, under the design band's ${budget.min}`,
      );
    } else if (size > budget.max) {
      notes.push(
        `career: flight ${flight.flightIndex} holds ${size} lifters, over the design band's ${budget.max}`,
      );
    }
  }
  return notes;
}

// ---------------------------------------------------------------------------
// 2. Bar-loading order
// ---------------------------------------------------------------------------

/**
 * One lifter's declared attempt in one round.
 *
 * `declaredKg` is a bar weight and is an ordinary number — the opacity
 * discipline in this directory is about a TOTAL, which is a server-confirmed
 * sum, and an attempt declaration is neither. Whether the weight is loadable is
 * `src/game/meet.ts`'s question; see this file's header.
 */
export interface AttemptDeclaration {
  readonly lifterId: string;
  readonly lotNumber: number;
  readonly declaredKg: number;
}

/**
 * One attempt, placed in the flight's running order.
 *
 * `position` counts attempts across the whole flight rather than inside a
 * round, so it is the coordinate `FlightResultEntry.totalReachedAtPosition`
 * speaks in. See `flightAttemptSequence`.
 */
export interface SequencedAttempt extends AttemptDeclaration {
  readonly roundIndex: number;
  readonly position: number;
}

/**
 * The order a round's attempts are taken in.
 *
 * The published rule, quoted: "In each flight, the lifter with the lightest
 * attempt will lift first, and the weight loaded onto the bar will
 * progressively be increased until everyone in the flight has lifted." And the
 * tie-break: the number drawn at weigh-in "sets the lifting order when two
 * lifters choose the same weight", with the lower lot lifting first.
 *
 * So: ascending declared weight, then ascending lot number. Both steps are in
 * `BAR_LOADING_TIE_BREAKS` in that order, and `flight.test.ts` derives this
 * function's behaviour from that constant rather than restating it.
 *
 * The input is not mutated; the returned array is a frozen copy.
 */
export function barLoadingOrder(
  round: readonly AttemptDeclaration[],
): readonly AttemptDeclaration[] {
  const ordered = [...round].sort((left, right) => {
    if (left.declaredKg !== right.declaredKg) return left.declaredKg - right.declaredKg;
    return left.lotNumber - right.lotNumber;
  });
  return Object.freeze(ordered);
}

/**
 * The whole flight's running order, round by round.
 *
 * Each round is ordered by `barLoadingOrder` and the rounds are laid end to
 * end, which is what the published description says happens: "The bar will then
 * be unloaded and second attempts will be performed in the same fashion,
 * followed by third attempts."
 *
 * That unloading is the reason `position` is a flight-wide counter while the
 * WEIGHT restarts. Inside a round the bar only goes up; at a round boundary it
 * drops back to whatever the lightest second attempt is, and a check that
 * asserted a monotone bar across the whole flight would be asserting something
 * the sport does not do.
 *
 * How many rounds there are is not this module's rule — three attempts per lift
 * is meet structure and belongs to `src/game/meet.ts`. A caller hands over as
 * many rounds as it is running.
 */
export function flightAttemptSequence(
  rounds: readonly (readonly AttemptDeclaration[])[],
): readonly SequencedAttempt[] {
  const sequence: SequencedAttempt[] = [];
  let position = 0;
  for (let roundIndex = 0; roundIndex < rounds.length; roundIndex += 1) {
    for (const attempt of barLoadingOrder(rounds[roundIndex] ?? [])) {
      sequence.push(Object.freeze({ ...attempt, roundIndex, position }));
      position += 1;
    }
  }
  return Object.freeze(sequence);
}

/**
 * Who is on the bar next, given how many attempts of this round have resolved.
 *
 * §6.6's "attempts resolve in turn order" as a function. `null` once the round
 * is done. `resolvedCount` is a count and not an index so that "none resolved
 * yet" is zero rather than minus one.
 */
export function nextOnTheBar(
  order: readonly AttemptDeclaration[],
  resolvedCount: number,
): AttemptDeclaration | null {
  if (!Number.isInteger(resolvedCount) || resolvedCount < 0) {
    throw new RangeError(`career: ${resolvedCount} is not a count of resolved attempts`);
  }
  return order[resolvedCount] ?? null;
}

/**
 * Everything wrong with a proposed running order for ONE round, as sentences.
 *
 * This is the non-vacuous half of the ordering rule and it is a separate
 * function from `barLoadingOrder` on purpose. Asserting that the bar never
 * descends through an order this module sorted would be an assertion about a
 * sort, which cannot fail; asserting it about an order that arrived from
 * somewhere else is a real question. The server resolves turn order at a
 * synchronous meet (§6.6), so the order this validates is usually not the one
 * this produced.
 *
 * The rule being checked, quoted: "Within a round the weight on the bar is
 * never lowered, except to correct a loading error at the end of a round. In no
 * case can the weight be reduced after the lifter has attempted to perform a
 * lift with the announced weight." The loading-error exception is a referee's
 * act rather than a schedule, so it is not modelled — an order carrying one
 * would be reported here, which is the safer direction to be wrong in.
 *
 * Round-scoped deliberately: hand it a whole flight's sequence and the round
 * boundary reads as the bar going down, because it is.
 */
export function barLoadingFaults(order: readonly AttemptDeclaration[]): readonly string[] {
  const faults: string[] = [];
  const seenLifters = new Set<string>();
  const seenLots = new Set<number>();

  for (let index = 0; index < order.length; index += 1) {
    const attempt = order[index] as AttemptDeclaration;

    if (!Number.isFinite(attempt.declaredKg) || attempt.declaredKg <= 0) {
      faults.push(
        `career: ${attempt.lifterId} declared ${attempt.declaredKg} kg, which is not a bar weight`,
      );
    }
    if (seenLifters.has(attempt.lifterId)) {
      faults.push(`career: ${attempt.lifterId} takes two attempts in one round`);
    }
    seenLifters.add(attempt.lifterId);

    if (seenLots.has(attempt.lotNumber)) {
      faults.push(`career: lot ${attempt.lotNumber} is held by two lifters in this round`);
    }
    seenLots.add(attempt.lotNumber);

    if (index === 0) continue;
    const previous = order[index - 1] as AttemptDeclaration;

    if (attempt.declaredKg < previous.declaredKg) {
      faults.push(
        `career: the bar goes from ${previous.declaredKg} kg down to ${attempt.declaredKg} kg at ` +
          `position ${index}, and inside a round it is never lowered`,
      );
    } else if (
      attempt.declaredKg === previous.declaredKg &&
      attempt.lotNumber < previous.lotNumber
    ) {
      faults.push(
        `career: ${attempt.lifterId} (lot ${attempt.lotNumber}) follows lot ${previous.lotNumber} ` +
          `at the same ${attempt.declaredKg} kg, and the lower lot lifts first`,
      );
    }
  }
  return faults;
}

// ---------------------------------------------------------------------------
// 3. Placing
// ---------------------------------------------------------------------------

/**
 * The ordering over totals, injected.
 *
 * The contract is `Array.prototype.sort`'s: negative when `left` is the smaller
 * total, positive when it is the larger, zero when the two are equal. Placing
 * then reads that answer BACKWARDS, because the bigger total places higher.
 *
 * The wiring piece supplies this the way it supplies `CareerQualifyingGate`:
 * over `src/game/progression.ts`'s `ConfirmedTotalKg`, so the confirmed-total
 * fence is enforced at the wiring site by a real function rather than
 * re-implemented here by a weaker one. There is no default; see this file's
 * header, section 2.
 */
export type TotalOrder<Total> = (left: Total, right: Total) => number;

/**
 * One lifter's finished (or, for a live feed, so-far) result in a flight.
 *
 * `total` is `null` for a lifter with no total — the lifter who missed all
 * three attempts at one of the lifts. They are listed and they are not placed.
 *
 * `totalReachedAtPosition` is the flight-wide `position` (see
 * `flightAttemptSequence`) of the attempt that completed this lifter's total.
 * It is the input the third published tie-break needs, and it is derivable
 * without looking inside a total: attempts do not go down within a lift, so a
 * lifter's best successful attempt at a lift is their last successful one, and
 * the deadlift is the last lift — so the attempt that completes a total is
 * simply that lifter's last successful attempt of the meet. Computing it is the
 * caller's job because it needs the attempt results, which this module does not
 * hold.
 */
export interface FlightResultEntry<Total> {
  readonly lifterId: string;
  readonly lotNumber: number;
  /**
   * What this lifter is competing IN, as a string this module never parses.
   *
   * Gender, weight class, age group and the equipment/tested division, composed
   * by the caller into one id. Two entries are in the same award category
   * exactly when this string is `===`. See this file's header, section 1a, for
   * why a flight is not this and why there is no default.
   *
   * The coordinate `totalReachedAtPosition` speaks in must be comparable across
   * every entry handed to one call. For a single flight that is
   * `flightAttemptSequence`'s `position`; for a category pooled across flights
   * the caller supplies a session-wide moment, and `one bar holds one attempt at
   * a time` is the fault that fires if two of them collide.
   */
  readonly categoryId: string;
  readonly bodyweightKg: number;
  readonly total: Total | null;
  readonly totalReachedAtPosition: number | null;
}

/**
 * One row of a result sheet.
 *
 * `place` is a place WITHIN `categoryId` and is `null` for a lifter with no
 * total. `decidedBy` names the step that separated this row from the row above
 * it IN THE SAME CATEGORY, and is `null` on each category's top row and on every
 * unplaced row. It carries no total: see this file's header, section 2.
 *
 * `categoryId` is repeated back from the entry so a row is readable on its own.
 * A leaderboard that prints `place` without it is printing "1st" with no answer
 * to "of what", which is the defect section 1a is about.
 *
 * Two rows in the SAME category can share a `place` — but only on entries
 * `flightPlacingFaults` reports, which is the whole of the paragraph on
 * `separate` and is not repeated here.
 */
export interface FlightPlacing {
  readonly lifterId: string;
  readonly categoryId: string;
  readonly place: number | null;
  readonly decidedBy: PlacingDecidedBy;
}

/** An entry that has a total, with the total narrowed out of `Total | null`. */
interface PlacedEntry<Total> {
  readonly entry: FlightResultEntry<Total>;
  readonly total: Total;
}

/** How one pair of placed entries compares, and which step decided it. */
interface Separation {
  readonly by: PlacingTieBreak | PlacingUnresolved;
  readonly ranking: number;
}

/**
 * The published tie-break chain, applied to one pair, in order.
 *
 * Step 1, total: the bigger total places higher. Read through the injected
 * order and nothing else.
 *
 * Step 2, bodyweight. Quoted: "If two or more lifters achieve the same total,
 * the lighter lifter ranks above the heavier lifter."
 *
 * Step 3, who got there first. Quoted: "If two lifters register the same
 * bodyweight at the weigh in and eventually achieve the same total at the end
 * of the competition, the lifter making the total first will take precedence
 * over the other lifter." The earlier flight-wide position is the earlier
 * moment, which is what `totalReachedAtPosition` is for.
 *
 * Past step 3 the published chain stops. See `PLACING_UNRESOLVED_ORDER`.
 *
 * ===========================================================================
 * THE FOURTH ARM IS UNREACHABLE ON DATA THIS MODULE CALLS CLEAN, and the prose
 * here used to read as though it were a live case
 * ===========================================================================
 *
 * Resolved rather than left ambiguous, because a reader cannot tell a fallback
 * from a rule by looking and the docstring on `FlightPlacing` was inviting the
 * wrong reading.
 *
 * The bounded claim, in the mechanism's own terms: control reaches the fourth
 * arm only when `totalReachedAtPosition` is `null` on one side, or equal on
 * both. `flightPlacingFaults` reports the first as "has a total and no position
 * it was reached at" and the second as "one bar holds one attempt at a time".
 * So on any entry list that function returns `[]` for, the arm is dead, no row
 * can carry `decidedBy: 'lot-number'`, and no two rows in one category can share
 * a `place`.
 *
 * The limit, named concretely enough to plant: `placeFlight` does not call
 * `flightPlacingFaults` and must not — a result sheet is not the place to
 * refuse — so a caller that skips the report reaches the arm at runtime. That is
 * why it is a defined fallback (list them in lot order, say `lot-number`, share
 * the place) rather than a throw, and it is the only reason it exists.
 *
 * The catcher, named specifically enough to run: `no clean flight can reach the
 * unresolved arm, across the whole domain` in `careerOpacity.test.ts` drives
 * both halves — every point of the plate-resolution grid under every comparator
 * with the arm counted at zero, and the faulted twin counted above zero, so an
 * empty domain reports itself instead of passing.
 *
 * WHAT WOULD MAKE IT LIVE, so nobody has to rediscover it. Two lifters in
 * DIFFERENT flights can genuinely share a position index, because
 * `flightAttemptSequence` counts from zero per flight. A caller pooling two
 * flights of one category (section 1a's named seam) either supplies a
 * session-wide moment — in which case the arm stays dead — or hands over
 * colliding indices, in which case `flightPlacingFaults` reports them and it is
 * doing its job rather than being over-strict.
 */
function separate<Total>(
  left: PlacedEntry<Total>,
  right: PlacedEntry<Total>,
  order: TotalOrder<Total>,
): Separation {
  const ranked = order(left.total, right.total);
  if (ranked !== 0) return { by: 'total', ranking: -ranked };

  const byBodyweight = left.entry.bodyweightKg - right.entry.bodyweightKg;
  if (byBodyweight !== 0) return { by: 'bodyweight', ranking: byBodyweight };

  const leftAt = left.entry.totalReachedAtPosition;
  const rightAt = right.entry.totalReachedAtPosition;
  if (leftAt !== null && rightAt !== null && leftAt !== rightAt) {
    return { by: 'reached-total-first', ranking: leftAt - rightAt };
  }

  return {
    by: CAREER_TUNING.PLACING_UNRESOLVED_ORDER,
    ranking: left.entry.lotNumber - right.entry.lotNumber,
  };
}

/**
 * A flight's result sheet: every lifter, placed inside their own category.
 *
 * THE LIVE LEADERBOARD IS THIS FUNCTION, run again. §6.6 asks for a "live
 * leaderboard feed"; a leaderboard partway through a flight is the placing over
 * the results so far, with each lifter's total as it stands. Nothing here
 * requires a flight to be finished, and a lifter whose total is not yet defined
 * is carried as `total: null` exactly like one who never gets one. What
 * distinguishes "not yet" from "never" is the caller's, because it is a fact
 * about attempts remaining and this module does not hold attempts.
 *
 * THE SHEET IS GROUPED BY CATEGORY, and both halves of that are decisions:
 *
 *   - Rows are partitioned by `categoryId` and a place is a place within one
 *     partition. Section 1a of this file's header is the whole argument and the
 *     search behind it.
 *   - The partitions come out in the order their categories FIRST APPEAR in
 *     `entries`, which is `composeFlights`'s discipline applied again: this
 *     module does not know what order categories should be printed in — lightest
 *     class first is a convention, not a rule found in the published text — so
 *     it preserves the caller's and reorders nothing. A caller that hands over a
 *     flight sorted by class gets a sheet sorted by class.
 *
 * Within a category, unplaced lifters — no total — come after the placed ones,
 * in lot order, with `place: null`. They are in the list rather than filtered
 * out because a result sheet shows them: a lifter who bombed out was at the
 * meet, and they bombed out of a weight class rather than out of a flight.
 *
 * The injected order is asked about pairs of totals and about nothing else, and
 * it is never asked about a pair from two different categories — which is not a
 * saving but a correctness property, since two categories are not in a race.
 */
export function placeFlight<Total>(
  entries: readonly FlightResultEntry<Total>[],
  order: TotalOrder<Total>,
): readonly FlightPlacing[] {
  const categoryOrder: string[] = [];
  const byCategory = new Map<string, FlightResultEntry<Total>[]>();
  for (const entry of entries) {
    const held = byCategory.get(entry.categoryId);
    if (held === undefined) {
      categoryOrder.push(entry.categoryId);
      byCategory.set(entry.categoryId, [entry]);
    } else {
      held.push(entry);
    }
  }

  const sheet: FlightPlacing[] = [];
  for (const categoryId of categoryOrder) {
    const inCategory = byCategory.get(categoryId) ?? [];
    const placed: PlacedEntry<Total>[] = [];
    const unplaced: FlightResultEntry<Total>[] = [];

    for (const entry of inCategory) {
      const total = entry.total;
      if (total === null) unplaced.push(entry);
      else placed.push({ entry, total });
    }

    placed.sort((left, right) => separate(left, right, order).ranking);
    unplaced.sort((left, right) => left.lotNumber - right.lotNumber);

    let place = 0;
    for (let index = 0; index < placed.length; index += 1) {
      const row = placed[index] as PlacedEntry<Total>;
      if (index === 0) {
        place = 1;
        sheet.push(
          Object.freeze({ lifterId: row.entry.lifterId, categoryId, place, decidedBy: null }),
        );
        continue;
      }
      const above = placed[index - 1] as PlacedEntry<Total>;
      const separation = separate(above, row, order);
      const shares = separation.by === CAREER_TUNING.PLACING_UNRESOLVED_ORDER;
      if (!shares) place = index + 1;
      sheet.push(
        Object.freeze({
          lifterId: row.entry.lifterId,
          categoryId,
          place,
          decidedBy: separation.by,
        }),
      );
    }

    for (const entry of unplaced) {
      sheet.push(
        Object.freeze({ lifterId: entry.lifterId, categoryId, place: null, decidedBy: null }),
      );
    }
  }
  return Object.freeze(sheet);
}

/**
 * Everything wrong with a set of flight results, or with the order that will
 * sort them, as sentences.
 *
 * The result half is the same shape as `careerRecordFaults`: for entries that
 * arrived as JSON, where the types are not a check.
 *
 * The order half is the same shape as `careerGateFaults`, and it exists for the
 * same reason. An injected dependency is trusted by construction, so the only
 * way to say anything about it is to interrogate it — and a comparator has a
 * contract a gate does not. `Array.prototype.sort` is entitled to produce ANY
 * arrangement when handed an inconsistent one, so a comparator that answers
 * "left is bigger" both ways round turns a result sheet into an arbitrary list
 * with no error anywhere. That is checked here rather than assumed:
 *
 *   - antisymmetry, on every ordered pair of the entries' own totals;
 *   - a finite answer, since `NaN` makes every comparison false;
 *   - transitivity, on every ordered triple.
 *
 * Those three run across CATEGORY BOUNDARIES even though `placeFlight` never
 * compares two totals from different categories. That is deliberate and it is
 * the stronger reading: the contract being checked belongs to the comparator,
 * not to the sheet, and a comparator that is intransitive only on a triple this
 * particular flight happens to split across two classes is still an unlawful
 * comparator and will decide a place at the next meet.
 *
 * The totals are the entries' own rather than values this function invents,
 * because inventing one would mean constructing a `Total`, which this module
 * cannot do and should not be able to.
 *
 * No fault sentence prints a total. They are named by the lifter that holds
 * them, which is `careerGateFaults`'s convention (it names by index) and is
 * what `careerOpacity.test.ts`'s `interpolate-total` row enforces.
 */
export function flightPlacingFaults<Total>(
  entries: readonly FlightResultEntry<Total>[],
  order: TotalOrder<Total>,
): readonly string[] {
  const faults: string[] = [];
  const seenLifters = new Set<string>();
  const seenLots = new Set<number>();
  const seenPositions = new Set<number>();

  for (const entry of entries) {
    if (seenLifters.has(entry.lifterId)) {
      faults.push(`career: ${entry.lifterId} holds two results in one flight`);
    }
    seenLifters.add(entry.lifterId);

    if (!Number.isInteger(entry.lotNumber) || entry.lotNumber < 1) {
      faults.push(
        `career: ${entry.lifterId} carries lot ${entry.lotNumber}, which is not a drawn lot`,
      );
    } else if (seenLots.has(entry.lotNumber)) {
      faults.push(`career: lot ${entry.lotNumber} is held by two lifters in this flight`);
    }
    seenLots.add(entry.lotNumber);

    if (!Number.isFinite(entry.bodyweightKg) || entry.bodyweightKg <= 0) {
      faults.push(
        `career: ${entry.lifterId} weighed in at ${entry.bodyweightKg} kg, which is not a weigh-in`,
      );
    }

    // A blank category is the type error `string` cannot be. There is no
    // default category (header, section 1a), so an empty id is a caller that
    // has not decided what this lifter is competing in — and the sheet it
    // produces would be a flight-wide placing wearing a category's clothes,
    // which is the exact defect that section is about.
    if (entry.categoryId.trim() === '') {
      faults.push(
        `career: ${entry.lifterId} carries no category, so there is nothing to place them in`,
      );
    }

    const reachedAt = entry.totalReachedAtPosition;
    if (entry.total === null) {
      if (reachedAt !== null) {
        faults.push(
          `career: ${entry.lifterId} has no total and yet reached one at position ${reachedAt}`,
        );
      }
      continue;
    }
    if (reachedAt === null) {
      faults.push(
        `career: ${entry.lifterId} has a total and no position it was reached at, so the ` +
          `published tie-break cannot be applied to them`,
      );
      continue;
    }
    if (!Number.isInteger(reachedAt) || reachedAt < 0) {
      faults.push(
        `career: ${entry.lifterId} reached a total at position ${reachedAt}, which is not a place ` +
          `in the running order`,
      );
    } else if (seenPositions.has(reachedAt)) {
      faults.push(
        `career: two lifters reached a total at position ${reachedAt}, and one bar holds one ` +
          `attempt at a time`,
      );
    }
    seenPositions.add(reachedAt);
  }

  const withTotals: PlacedEntry<Total>[] = [];
  for (const entry of entries) {
    const total = entry.total;
    if (total !== null) withTotals.push({ entry, total });
  }

  // The comparator's answer about every ordered pair, taken once and reused, so
  // the checks below ask it the same questions the sort will ask and no more.
  // Hoisted into a matrix rather than called inline for a second reason: an
  // `order(...)` call nested inside `Math.sign(...)` puts the word `total`
  // inside a `Math.` call, which `careerOpacity.test.ts`'s `math-on-total` row
  // reads — correctly, since it cannot tell a comparator's argument from an
  // operand.
  const answers: number[][] = [];
  for (let left = 0; left < withTotals.length; left += 1) {
    const first = withTotals[left] as PlacedEntry<Total>;
    const row: number[] = [];
    for (let right = 0; right < withTotals.length; right += 1) {
      const second = withTotals[right] as PlacedEntry<Total>;
      row.push(order(first.total, second.total));
    }
    answers.push(row);
  }

  // Both readers are total by construction — every index below comes from a
  // loop over `withTotals.length`, and `answers` was built square at that same
  // length. The defaults exist because an index expression is `T | undefined`
  // under `noUncheckedIndexedAccess` and a cast to `number` is a banned pattern
  // in this directory: `careerOpacity.test.ts`'s `as-number` row reads it, and
  // it read the first draft of these two lines.
  const answer = (left: number, right: number): number => answers[left]?.[right] ?? 0;
  const named = (index: number): string => withTotals[index]?.entry.lifterId ?? '';

  for (let left = 0; left < withTotals.length; left += 1) {
    for (let right = left; right < withTotals.length; right += 1) {
      const forward = answer(left, right);
      const backward = answer(right, left);
      if (!Number.isFinite(forward) || !Number.isFinite(backward)) {
        faults.push(
          `career: the injected order answers ${forward} about ${named(left)} against ` +
            `${named(right)}, which is not a comparison`,
        );
        continue;
      }
      if (Math.sign(forward) !== -Math.sign(backward)) {
        faults.push(
          `career: the injected order puts ${named(left)} and ${named(right)} the same way ` +
            `round both ways, so a result sheet built from it is an arbitrary list`,
        );
      }
    }
  }

  for (let left = 0; left < withTotals.length; left += 1) {
    for (let middle = 0; middle < withTotals.length; middle += 1) {
      const ab = Math.sign(answer(left, middle));
      if (ab === 0) continue;
      for (let right = 0; right < withTotals.length; right += 1) {
        const bc = Math.sign(answer(middle, right));
        const ac = Math.sign(answer(left, right));
        if (ab === bc && ac !== ab) {
          faults.push(
            `career: the injected order ranks ${named(left)} against ${named(middle)} against ` +
              `${named(right)} and then contradicts itself on the ends`,
          );
        }
      }
    }
  }
  return faults;
}
