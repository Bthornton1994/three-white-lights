/**
 * flight.test.ts — GDD §6.6's flight structure, held to the published rules it
 * claims to implement.
 *
 * Two kinds of check live here and they are worth separating before reading
 * either.
 *
 * THE FIRST KIND IS DOMAIN CORRECTNESS, and it is the reason this file is long.
 * Bar-loading order and placing tie-breaks are published competition rules, so
 * the risk is not that the code is inconsistent with itself — it is that the
 * code is a plausible invention. Nothing here can check a transcription against
 * a rulebook this environment cannot open; what it can do is make the RULE the
 * subject rather than the implementation, by driving behaviour off
 * `BAR_LOADING_TIE_BREAKS` and `PLACING_TIE_BREAKS` — the two arrays that
 * carry the published order — instead of restating "weight, then lot" in a
 * second place. Reorder either array and these tests go red, which is what a
 * check about an ORDER should do.
 *
 * THE SECOND KIND IS THE ORDINARY ONE: domains derived from the numbers the
 * code branches on. CLAUDE.md's "A domain that samples only extremes is empty
 * where it matters" is the rule being followed, and the composition sweep is
 * exhaustive rather than sampled for that reason — every legal field size from
 * nobody to `FLIGHT_MAX_FIELD_SIZE`, so there is no band to be outside.
 *
 * The opacity of a `Total` is NOT this file's subject. `placeFlight` and
 * `flightPlacingFaults` are driven here with `Total` bound to `number`, which
 * makes a laundered read invisible on purpose: the two instruments that ask
 * that question are `careerOpaqueTotal.test.ts` (which binds a throwing proxy
 * and drives both functions) and `careerOpacity.test.ts` (whose plate-
 * resolution domain and substitution probe both now cover placing). What this
 * file checks is that the placing is RIGHT, which neither of those can ask.
 */

import { describe, expect, it } from 'vitest';

import { CAREER_TUNING } from './careerTuning';
import {
  BAR_LOADING_TIE_BREAK_ORDER,
  PLACING_TIE_BREAK_ORDER,
  barLoadingFaults,
  barLoadingOrder,
  composeFlights,
  flightAttemptSequence,
  flightCompositionFaults,
  flightCount,
  flightPlacingFaults,
  flightsOutsideSizeBudget,
  nextOnTheBar,
  placeFlight,
  type AttemptDeclaration,
  type Flight,
  type FlightMember,
  type FlightPlacing,
  type FlightResultEntry,
  type TotalOrder,
} from './flight';

// ===========================================================================
// The sweep's parameters, in one block
// ===========================================================================

/**
 * Everything the sweeps below are made of, as named constants.
 *
 * `src/game/streakSweep.ts` exists because a measurement was once reported with
 * its seeds unstated and six plausible parameterisations gave six different
 * numbers. These are test parameters rather than game-feel values — the game's
 * numbers are in `careerTuning.ts` — but the rule about a number buried at a
 * call site is the same rule.
 */
const FLIGHT_SWEEP = Object.freeze({
  /**
   * A realistic opening squat, in kilograms, for the bar-loading sweeps.
   *
   * Attempt weights are what the ordering rule branches on, so the domain is
   * built around a weight a bar is actually loaded to rather than around 0 and
   * a million. It sits inside the range `MEET_LOCAL.ghostTotalsKg` implies for
   * a single lift.
   */
  OPENER_KG: 180,

  /**
   * The smallest step between two declared attempts, in kilograms.
   *
   * The same arithmetic `careerOpacity.test.ts`'s grid rests on: a bar is
   * loaded symmetrically from discs and the smallest competition disc is
   * 0.25 kg, so the smallest change to one lift is a pair of them.
   */
  STEP_KG: 0.5,

  /** How many lifters the bar-loading sweeps put in a round. */
  ROUND_SIZE: 8,

  /**
   * Bodyweights for the placing fixtures, with a repeat.
   *
   * The repeat is load-bearing: step 2 of the published chain separates on
   * bodyweight, so a fixture with all-distinct bodyweights never reaches step
   * 3 and the third rule would be untested while looking covered.
   */
  BODYWEIGHTS_KG: Object.freeze([83.25, 92.5, 92.5, 105.75]),

  /**
   * The award categories the placing fixtures are built from.
   *
   * Two of them, and they are strings this file never parses because
   * `placeFlight` never parses one either — see `flight.ts`'s header, section
   * 1a. A single-category fixture cannot tell a per-category placing from the
   * flight-wide one it replaced, so every check about grouping needs both, and
   * the checks that are about the tie-break chain rather than about grouping
   * deliberately use `CATEGORY_A` alone so the chain still reaches step 3.
   *
   * Written the way a caller would compose them — gender, weight class, age
   * group, division — rather than as `'a'` and `'b'`, so a reader can see what
   * the id is supposed to be made of.
   */
  CATEGORY_A: 'mens-93-open-raw',
  CATEGORY_B: 'mens-105-masters1-raw',
});

/** `Total` bound to `number` here. See this file's header on why that is safe. */
type Kg = number;

/** The lawful comparator every placing test is driven under. */
const ASCENDING: TotalOrder<Kg> = (left, right) => left - right;

function member(lifterId: string, lotNumber: number): FlightMember {
  return { lifterId, lotNumber };
}

/**
 * A field of `size` lifters whose lots are a permutation of 1..size.
 *
 * Not the identity, because a field whose lots arrived in entry order would
 * agree with a composition that ignored them. Ends inwards — first, last,
 * second, second-last — which is a permutation at every size, including the
 * sizes where a multiply-and-modulo one collapses. THE FIRST DRAFT WAS
 * `(index * 7) % size`, and at a field of exactly 7 that hands every lifter
 * lot 1; `flightCompositionFaults` reported six duplicate lots and is how this
 * was found, which is the fault reporter earning its place before any shipped
 * caller had one.
 */
function fieldOf(size: number): readonly FlightMember[] {
  return Array.from({ length: size }, (_unused, index) =>
    member(
      `lifter-${index}`,
      index % 2 === 0 ? index / 2 + 1 : size - Math.floor(index / 2),
    ),
  );
}

function attempt(lifterId: string, lotNumber: number, declaredKg: number): AttemptDeclaration {
  return { lifterId, lotNumber, declaredKg };
}

/**
 * One result row. The category defaults HERE and nowhere else.
 *
 * `flight.ts` refuses a default category on purpose (header, section 1a), and a
 * defaulting test helper does not weaken that: the type still requires the
 * field, so a shipped caller that omits it does not compile. What the default
 * buys is that the tie-break tests read as being about the chain rather than
 * about ids, and every check that is ABOUT the category passes one explicitly.
 */
function entry(
  lifterId: string,
  lotNumber: number,
  bodyweightKg: number,
  total: Kg | null,
  totalReachedAtPosition: number | null,
  categoryId: string = FLIGHT_SWEEP.CATEGORY_A,
): FlightResultEntry<Kg> {
  return { lifterId, lotNumber, categoryId, bodyweightKg, total, totalReachedAtPosition };
}

/** A sheet as `lifterId@place`, so a failure message reads like a result sheet. */
function sheetOf(sheet: readonly FlightPlacing[]): string {
  return sheet.map((row) => `${row.lifterId}@${row.place ?? 'none'}`).join(' ');
}

/** The same, with the category each place is a place IN. */
function categorisedSheetOf(sheet: readonly FlightPlacing[]): string {
  return sheet.map((row) => `${row.lifterId}@${row.categoryId}:${row.place ?? 'none'}`).join(' ');
}

// ===========================================================================
// 1. Composition
// ===========================================================================

describe('a field is divided into flights', () => {
  it('never exceeds the published cap, at any field size the module accepts', () => {
    // EXHAUSTIVE, not sampled. The published rule is a cap, so the interesting
    // region is around it — 13, 14, 15, 28, 29 — and every multiple and
    // near-multiple above. Walking every legal size removes the question of
    // whether the band straddles the branch, which is the defect CLAUDE.md's
    // "a domain that samples only extremes" section is about.
    //
    // Reddens on: raising the cap in `composeFlights` without raising
    // `MAX_LIFTERS_PER_FLIGHT`, or on a division that fills flights to the cap
    // and leaves a remainder flight (which would still satisfy the cap, and is
    // caught by the balance check below rather than this one).
    let walked = 0;
    let oversized = 0;
    for (let size = 0; size <= CAREER_TUNING.FLIGHT_MAX_FIELD_SIZE; size += 1) {
      for (const flight of composeFlights(fieldOf(size))) {
        if (flight.members.length > CAREER_TUNING.MAX_LIFTERS_PER_FLIGHT) oversized += 1;
      }
      walked += 1;
    }
    expect(oversized).toBe(0);
    // Counts, not bounds: the sweep really walked every size.
    expect(walked).toBe(CAREER_TUNING.FLIGHT_MAX_FIELD_SIZE + 1);
    expect(walked).toBe(513);
  });

  it('keeps the flights within one lifter of each other and in the caller’s order', () => {
    // The two properties that are this module's CHOICE rather than the
    // rulebook's, checked as hard as the rule is. Balance is why a field of 15
    // runs 8 and 7; order preservation is why a caller that groups its field by
    // weight class gets flights grouped by weight class.
    //
    // Reddens on: filling flights to the cap and leaving a short one (size 15
    // becomes 14 and 1, so the spread goes to 13), or on sorting the field.
    let walked = 0;
    let unbalanced = 0;
    let reordered = 0;
    for (let size = 0; size <= CAREER_TUNING.FLIGHT_MAX_FIELD_SIZE; size += 1) {
      const field = fieldOf(size);
      const flights = composeFlights(field);
      const sizes = flights.map((flight) => flight.members.length);
      if (sizes.length > 0 && Math.max(...sizes) - Math.min(...sizes) > 1) unbalanced += 1;
      const rejoined = flights.flatMap((flight) => [...flight.members]);
      if (rejoined.map((m) => m.lifterId).join(',') !== field.map((m) => m.lifterId).join(',')) {
        reordered += 1;
      }
      walked += 1;
    }
    expect(unbalanced).toBe(0);
    expect(reordered).toBe(0);
    expect(walked).toBe(513);

    // The named case the two properties disagree about, spelled out because it
    // is the one a reader will check by hand.
    expect(composeFlights(fieldOf(15)).map((flight) => flight.members.length)).toEqual([8, 7]);
    expect(composeFlights(fieldOf(14)).map((flight) => flight.members.length)).toEqual([14]);
    expect(composeFlights(fieldOf(28)).map((flight) => flight.members.length)).toEqual([14, 14]);
    expect(composeFlights(fieldOf(29)).map((flight) => flight.members.length)).toEqual([10, 10, 9]);
    expect(composeFlights(fieldOf(0))).toEqual([]);
    expect(composeFlights(fieldOf(1)).map((flight) => flight.members.length)).toEqual([1]);
  });

  it('uses the fewest flights the cap allows', () => {
    // `flightCount` is the arithmetic the division is built on, so it is pinned
    // separately from the division: a `composeFlights` that produced balanced
    // flights of the wrong NUMBER would satisfy both checks above.
    //
    // Reddens on: dividing by the design band's target instead of by the cap,
    // which would make `flightCount(15)` two and `flightCount(20)` two as well
    // — the first is right for the wrong reason and the second is wrong.
    let walked = 0;
    for (let size = 0; size <= CAREER_TUNING.FLIGHT_MAX_FIELD_SIZE; size += 1) {
      expect(flightCount(size), `field of ${size}`).toBe(
        Math.ceil(size / CAREER_TUNING.MAX_LIFTERS_PER_FLIGHT),
      );
      expect(composeFlights(fieldOf(size)).length, `field of ${size}`).toBe(flightCount(size));
      walked += 1;
    }
    expect(walked).toBe(513);
    // The expectation above is arithmetic and could agree with a broken
    // implementation by construction, so three values are named outright.
    expect(flightCount(0)).toBe(0);
    expect(flightCount(14)).toBe(1);
    expect(flightCount(15)).toBe(2);
  });

  it('refuses a field it cannot divide, by name', () => {
    // Reddens on: dropping the guard, which turns a fractional field size into
    // a `RangeError` from `Array.from` at best and a silent empty list at
    // worst, and turns an enormous one into an allocation.
    expect(() => flightCount(-1)).toThrow(RangeError);
    expect(() => flightCount(2.5)).toThrow(RangeError);
    expect(() => flightCount(Number.NaN)).toThrow(RangeError);
    expect(() => flightCount(CAREER_TUNING.FLIGHT_MAX_FIELD_SIZE + 1)).toThrow(
      /FLIGHT_MAX_FIELD_SIZE/,
    );
    // And the boundary itself is accepted, so the guard is not off by one.
    expect(flightCount(CAREER_TUNING.FLIGHT_MAX_FIELD_SIZE)).toBe(
      Math.ceil(CAREER_TUNING.FLIGHT_MAX_FIELD_SIZE / CAREER_TUNING.MAX_LIFTERS_PER_FLIGHT),
    );
  });

  it('finds nothing wrong with a composition it built, and everything wrong with a bad one', () => {
    // Both directions, because a fault reporter that never reports is the
    // commonest way this shape goes vacuous.
    //
    // Reddens on: a check dropped from `flightCompositionFaults`, or on
    // `composeFlights` starting to produce one of them.
    let walked = 0;
    for (let size = 0; size <= CAREER_TUNING.FLIGHT_MAX_FIELD_SIZE; size += 1) {
      expect(flightCompositionFaults(composeFlights(fieldOf(size))), `field of ${size}`).toEqual(
        [],
      );
      walked += 1;
    }
    expect(walked).toBe(513);

    const oversized: readonly Flight[] = [
      {
        flightIndex: 0,
        members: Array.from(
          { length: CAREER_TUNING.MAX_LIFTERS_PER_FLIGHT + 1 },
          (_unused, index) => member(`lifter-${index}`, index + 1),
        ),
      },
    ];
    expect(flightCompositionFaults(oversized).join('\n')).toContain(
      'over the published maximum of 14',
    );

    const sharedLot: readonly Flight[] = [
      { flightIndex: 0, members: [member('a', 1), member('b', 1)] },
    ];
    expect(flightCompositionFaults(sharedLot).join('\n')).toContain(
      'is held by two lifters, so the bar-loading tie-break has nothing left to decide with',
    );

    const misnumbered: readonly Flight[] = [
      { flightIndex: 1, members: [member('a', 1)] },
      { flightIndex: 0, members: [member('b', 2)] },
    ];
    expect(flightCompositionFaults(misnumbered).length).toBe(2);

    expect(
      flightCompositionFaults([{ flightIndex: 0, members: [] }]).join('\n'),
    ).toContain('holds nobody');
    expect(
      flightCompositionFaults([
        { flightIndex: 0, members: [member('a', 0)] },
      ]).join('\n'),
    ).toContain('is not a drawn lot');
    expect(
      flightCompositionFaults([
        { flightIndex: 0, members: [member('a', 1)] },
        { flightIndex: 1, members: [member('a', 2)] },
      ]).join('\n'),
    ).toContain('appears in more than one flight');
  });

  it('reports the sizes GDD §6.6 asks for and the rulebook will not give', () => {
    // The recorded divergence, as a measurement rather than a comment. §6.6
    // says flights of "~10-15"; the published cap is 14; so a field between 15
    // and 19 has no division that satisfies both, and the rule wins.
    //
    // Reddens on: `flightsOutsideSizeBudget` turning into a refusal, on the
    // band moving, or on the cap moving.
    expect(flightsOutsideSizeBudget(composeFlights(fieldOf(15))).length).toBe(2);
    expect(flightsOutsideSizeBudget(composeFlights(fieldOf(15))).join('\n')).toContain(
      "under the design band's 10",
    );
    // Twenty is the first field size that splits into two flights both inside
    // the band, and it is the number a reader should sanity-check by hand.
    expect(composeFlights(fieldOf(20)).map((flight) => flight.members.length)).toEqual([10, 10]);
    expect(flightsOutsideSizeBudget(composeFlights(fieldOf(20)))).toEqual([]);

    // The census over the whole legal range, so "some sizes are outside" is a
    // number rather than an impression. Counted, not bounded, in both
    // directions — an implementation that reported nothing and one that
    // reported everything both move these.
    let inside = 0;
    let outside = 0;
    for (let size = 1; size <= CAREER_TUNING.FLIGHT_MAX_FIELD_SIZE; size += 1) {
      if (flightsOutsideSizeBudget(composeFlights(fieldOf(size))).length === 0) inside += 1;
      else outside += 1;
    }
    expect(inside + outside).toBe(CAREER_TUNING.FLIGHT_MAX_FIELD_SIZE);
    // FIFTEEN FIELD SIZES OUT OF 512, AND THE SET IS DERIVABLE RATHER THAN
    // OBSERVED — which matters, because a count fitted to whatever the run
    // returned measures nothing. A flight is under the band when
    // `floor(n / ceil(n / 14)) < 10`; that needs `14(k-1) < n < 10k` for
    // `k = ceil(n / 14)`, which forces `4k < 14`, so it can only happen at
    // `k` of 1, 2 or 3. Those are `n` of 1-9, 15-19 and 29: nine, five and one.
    //
    // Recorded as a correction rather than tidied: the draft of this test
    // guessed 37 and the run said 15, at `expected 15 to be 37`.
    expect(outside).toBe(9 + 5 + 1);
    expect(outside).toBe(15);
    expect(inside).toBe(497);
    // No flight may exceed the band's top, because the cap is below it.
    expect(
      Array.from({ length: CAREER_TUNING.FLIGHT_MAX_FIELD_SIZE }, (_unused, index) =>
        flightsOutsideSizeBudget(composeFlights(fieldOf(index + 1))),
      )
        .flat()
        .filter((note) => note.includes('over the design band')).length,
    ).toBe(0);
  });
});

// ===========================================================================
// 2. Bar-loading order
// ===========================================================================

describe('the bar goes up and the order follows the published chain', () => {
  it('applies the two published steps in the order the constant names them', () => {
    // THE RULE IS THE SUBJECT HERE, not the sort. `BAR_LOADING_TIE_BREAKS`
    // carries the published order — lightest attempt first, lower lot first
    // when two lifters call the same weight — and this drives the behaviour off
    // that array's positions rather than restating the words.
    //
    // Reddens on: reordering `BAR_LOADING_TIE_BREAKS`, or on `barLoadingOrder`
    // sorting by lot before weight. Both are the same defect seen from the two
    // sides, which is the point of deriving it.
    expect([...BAR_LOADING_TIE_BREAK_ORDER]).toEqual(['declared-weight', 'lot-number']);

    // For each adjacent pair of steps, a round of two where the earlier step
    // prefers `first` and the later step prefers `second`. The earlier step
    // must win. With two steps there is one such pair, and the count is pinned
    // so a third step arriving without a case is red.
    const pairs = BAR_LOADING_TIE_BREAK_ORDER.length - 1;
    expect(pairs).toBe(1);

    // Step 0 (weight) prefers the lighter attempt; step 1 (lot) prefers the
    // lower lot. `light-high-lot` is lighter AND has the higher lot, so the two
    // steps disagree and weight has to win.
    const round = [
      attempt('heavy-low-lot', 1, FLIGHT_SWEEP.OPENER_KG + FLIGHT_SWEEP.STEP_KG),
      attempt('light-high-lot', 9, FLIGHT_SWEEP.OPENER_KG),
    ];
    expect(barLoadingOrder(round).map((a) => a.lifterId)).toEqual([
      'light-high-lot',
      'heavy-low-lot',
    ]);

    // And the later step decides when the earlier one is silent.
    const tied = [
      attempt('high-lot', 9, FLIGHT_SWEEP.OPENER_KG),
      attempt('low-lot', 2, FLIGHT_SWEEP.OPENER_KG),
    ];
    expect(barLoadingOrder(tied).map((a) => a.lifterId)).toEqual(['low-lot', 'high-lot']);
  });

  it('produces an order with no faults, over a domain of weights that collide', () => {
    // The domain is built from the numbers the rule branches on: equality of
    // declared weight, and lot order within an equal weight. So it is a round
    // whose weights are drawn from a half-kilogram lattice around a realistic
    // opener WITH DELIBERATE COLLISIONS — a lattice of distinct weights would
    // leave the lot tie-break unreached at every point.
    //
    // Reddens on: `barLoadingOrder` losing either step, which `barLoadingFaults`
    // reports as a descending bar or an out-of-order lot.
    let rounds = 0;
    let collisions = 0;
    let faulted = 0;
    for (let offset = 0; offset < 24; offset += 1) {
      const round = Array.from({ length: FLIGHT_SWEEP.ROUND_SIZE }, (_unused, index) =>
        attempt(
          `lifter-${index}`,
          ((index * 5 + offset) % FLIGHT_SWEEP.ROUND_SIZE) + 1,
          // Integer division by two, so each weight is called by exactly two
          // lifters and the lot step decides every pair.
          FLIGHT_SWEEP.OPENER_KG + Math.floor(index / 2) * FLIGHT_SWEEP.STEP_KG,
        ),
      );
      const ordered = barLoadingOrder(round);
      if (barLoadingFaults(ordered).length > 0) faulted += 1;
      for (let index = 1; index < ordered.length; index += 1) {
        const here = ordered[index] as AttemptDeclaration;
        const before = ordered[index - 1] as AttemptDeclaration;
        if (here.declaredKg === before.declaredKg) collisions += 1;
      }
      rounds += 1;
    }
    expect(faulted).toBe(0);
    // Counts, not bounds, on the domain AND on the region that matters: a
    // sweep whose weights never collided would report zero here and would have
    // driven only half the rule.
    expect(rounds).toBe(24);
    expect(collisions).toBe(rounds * (FLIGHT_SWEEP.ROUND_SIZE / 2));
    expect(collisions).toBe(96);
  });

  it('does not touch the round it was handed', () => {
    // Reddens on: `barLoadingOrder` sorting in place, which would reorder a
    // caller's array under it. `sort` mutates by default and the copy is one
    // spread away, so this is the shape a refactor removes by accident.
    const round = [
      attempt('c', 3, FLIGHT_SWEEP.OPENER_KG + FLIGHT_SWEEP.STEP_KG),
      attempt('a', 1, FLIGHT_SWEEP.OPENER_KG),
      attempt('b', 2, FLIGHT_SWEEP.OPENER_KG),
    ];
    const before = round.map((a) => a.lifterId).join(',');
    barLoadingOrder(round);
    expect(round.map((a) => a.lifterId).join(',')).toBe(before);
  });

  it('reports every way a proposed order breaks the rule', () => {
    // `barLoadingFaults` is the non-vacuous half: asserting that an order this
    // module sorted never descends is an assertion about a sort. At a
    // synchronous meet the server resolves turn order, so the order this
    // validates is usually not the order this produced.
    //
    // Reddens on: a check dropped from `barLoadingFaults`.
    const clean = barLoadingOrder([
      attempt('a', 2, FLIGHT_SWEEP.OPENER_KG),
      attempt('b', 1, FLIGHT_SWEEP.OPENER_KG),
      attempt('c', 3, FLIGHT_SWEEP.OPENER_KG + FLIGHT_SWEEP.STEP_KG),
    ]);
    expect(barLoadingFaults(clean)).toEqual([]);

    expect(
      barLoadingFaults([
        attempt('a', 1, FLIGHT_SWEEP.OPENER_KG + FLIGHT_SWEEP.STEP_KG),
        attempt('b', 2, FLIGHT_SWEEP.OPENER_KG),
      ]).join('\n'),
    ).toContain('inside a round it is never lowered');

    expect(
      barLoadingFaults([
        attempt('a', 5, FLIGHT_SWEEP.OPENER_KG),
        attempt('b', 2, FLIGHT_SWEEP.OPENER_KG),
      ]).join('\n'),
    ).toContain('the lower lot lifts first');

    expect(
      barLoadingFaults([attempt('a', 1, 0), attempt('b', 2, FLIGHT_SWEEP.OPENER_KG)]).join('\n'),
    ).toContain('is not a bar weight');

    expect(
      barLoadingFaults([
        attempt('a', 1, FLIGHT_SWEEP.OPENER_KG),
        attempt('a', 2, FLIGHT_SWEEP.OPENER_KG),
      ]).join('\n'),
    ).toContain('takes two attempts in one round');

    expect(
      barLoadingFaults([
        attempt('a', 1, FLIGHT_SWEEP.OPENER_KG),
        attempt('b', 1, FLIGHT_SWEEP.OPENER_KG),
      ]).join('\n'),
    ).toContain('is held by two lifters in this round');

    // An empty round has nothing wrong with it, and a one-attempt round has no
    // pair — both are the shapes a walk over `index - 1` gets wrong.
    expect(barLoadingFaults([])).toEqual([]);
    expect(barLoadingFaults([attempt('a', 1, FLIGHT_SWEEP.OPENER_KG)])).toEqual([]);
  });
});

describe('the flight runs round by round and the bar drops between them', () => {
  it('numbers every attempt across the flight and restarts the weight each round', () => {
    // The published description: "The bar will then be unloaded and second
    // attempts will be performed in the same fashion, followed by third
    // attempts." So position counts across the whole flight and weight does
    // not.
    //
    // Reddens on: sorting the whole flight as one round (which would make the
    // weights monotone across the boundary and the round indices wrong), or on
    // restarting `position` at each round.
    const first = [
      attempt('a', 1, FLIGHT_SWEEP.OPENER_KG + FLIGHT_SWEEP.STEP_KG * 4),
      attempt('b', 2, FLIGHT_SWEEP.OPENER_KG),
    ];
    const second = [
      attempt('a', 1, FLIGHT_SWEEP.OPENER_KG + FLIGHT_SWEEP.STEP_KG * 8),
      attempt('b', 2, FLIGHT_SWEEP.OPENER_KG + FLIGHT_SWEEP.STEP_KG * 2),
    ];
    const sequence = flightAttemptSequence([first, second]);

    expect(sequence.map((step) => step.position)).toEqual([0, 1, 2, 3]);
    expect(sequence.map((step) => step.roundIndex)).toEqual([0, 0, 1, 1]);
    expect(sequence.map((step) => step.lifterId)).toEqual(['b', 'a', 'b', 'a']);

    // The bar goes DOWN at the boundary, and that is the sport rather than a
    // fault. Stated as a positive assertion so a change that made the whole
    // flight monotone is red here rather than merely different.
    const weights = sequence.map((step) => step.declaredKg);
    expect((weights[2] as number) < (weights[1] as number)).toBe(true);
    // And each round on its own is clean.
    expect(barLoadingFaults(sequence.filter((step) => step.roundIndex === 0))).toEqual([]);
    expect(barLoadingFaults(sequence.filter((step) => step.roundIndex === 1))).toEqual([]);
    // While the whole flight read as one round is not, which is what makes the
    // round scoping of `barLoadingFaults` a real decision.
    //
    // COUNTS AND THE SENTENCE, NOT A BOUND. `toBeGreaterThan(0)` was the shape
    // here, and it is satisfied by any one fault for any reason — a duplicate
    // lifter, a duplicate lot, a weight that is not a bar weight. Every lifter
    // in this fixture appears in both rounds, so the reading that passed the
    // bound was very nearly the wrong one: it is the two `takes two attempts in
    // one round` sentences that a reader would guess at, and the round-boundary
    // drop is a THIRD sentence that has to be named to be checked.
    //
    // Reddens on: `barLoadingFaults` becoming flight-scoped, which drops the
    // descent sentence and takes the filtered count to zero.
    //
    // FIVE, AND THE DRAFT OF THIS LINE SAID THREE — kept as a correction rather
    // than tidied, because a count fitted to whatever the run returned measures
    // nothing. Both lifters appear in both rounds, so each of them lands a
    // repeat-lifter sentence AND a repeat-lot sentence, which is four; the bar
    // dropping at the boundary is the fifth. Writing "three" was reading the
    // fixture for the fault being demonstrated and forgetting it carries two
    // more per lifter, which is exactly why the sentence is filtered for by name
    // instead of trusted to be the only one.
    const acrossTheBoundary = barLoadingFaults(sequence);
    expect(acrossTheBoundary.join('\n')).toContain(
      'and inside a round it is never lowered',
    );
    expect(acrossTheBoundary.filter((f) => f.includes('never lowered')).length).toBe(1);
    expect(acrossTheBoundary.length).toBe(5);

    // A flight of no rounds, and a round of nobody: both empty, neither a throw.
    expect(flightAttemptSequence([])).toEqual([]);
    expect(flightAttemptSequence([[], []])).toEqual([]);
  });

  it('hands over the next lifter and then nobody', () => {
    // §6.6's "attempts resolve in turn order" as a function.
    //
    // Reddens on: an off-by-one in `nextOnTheBar` — returning the lifter who
    // just went, or running one past the end and returning `undefined` instead
    // of `null`.
    const order = barLoadingOrder([
      attempt('c', 3, FLIGHT_SWEEP.OPENER_KG + FLIGHT_SWEEP.STEP_KG * 2),
      attempt('a', 1, FLIGHT_SWEEP.OPENER_KG),
      attempt('b', 2, FLIGHT_SWEEP.OPENER_KG + FLIGHT_SWEEP.STEP_KG),
    ]);
    expect(nextOnTheBar(order, 0)?.lifterId).toBe('a');
    expect(nextOnTheBar(order, 1)?.lifterId).toBe('b');
    expect(nextOnTheBar(order, 2)?.lifterId).toBe('c');
    expect(nextOnTheBar(order, 3)).toBeNull();
    expect(nextOnTheBar([], 0)).toBeNull();
    expect(() => nextOnTheBar(order, -1)).toThrow(RangeError);
    expect(() => nextOnTheBar(order, 1.5)).toThrow(RangeError);
  });
});

// ===========================================================================
// 3. Placing
// ===========================================================================

describe('a flight is placed by the published chain', () => {
  it('applies each step only when every step above it is silent', () => {
    // THE RULE IS THE SUBJECT, the same way it is for bar loading. The chain is
    // `PLACING_TIE_BREAK_ORDER` followed by the unresolved fallback, and each
    // case below is an ADJACENT PAIR of steps in conflict: the earlier step
    // prefers the first lifter, the later step prefers the second, and the
    // earlier one has to win.
    //
    // Reddens on: reordering `PLACING_TIE_BREAKS`, or on `placeFlight` applying
    // bodyweight before the total, or the moment-reached before bodyweight.
    expect([...PLACING_TIE_BREAK_ORDER]).toEqual(['total', 'bodyweight', 'reached-total-first']);
    const chain = [...PLACING_TIE_BREAK_ORDER, CAREER_TUNING.PLACING_UNRESOLVED_ORDER];
    expect(chain).toEqual(['total', 'bodyweight', 'reached-total-first', 'lot-number']);

    // Step 0 beats step 1: a bigger total on a heavier lifter.
    const totalOverBodyweight = [
      entry('bigger-heavier', 2, 105.75, 600, 3),
      entry('smaller-lighter', 1, 83.25, 590, 1),
    ];
    expect(sheetOf(placeFlight(totalOverBodyweight, ASCENDING))).toBe(
      'bigger-heavier@1 smaller-lighter@2',
    );

    // Step 1 beats step 2: equal totals, the lighter lifter got there later.
    const bodyweightOverMoment = [
      entry('lighter-later', 2, 83.25, 600, 9),
      entry('heavier-earlier', 1, 105.75, 600, 0),
    ];
    expect(sheetOf(placeFlight(bodyweightOverMoment, ASCENDING))).toBe(
      'lighter-later@1 heavier-earlier@2',
    );

    // Step 2 beats the fallback: equal totals and bodyweights, the earlier
    // moment on the higher lot.
    const momentOverLot = [
      entry('earlier-high-lot', 9, 92.5, 600, 2),
      entry('later-low-lot', 1, 92.5, 600, 7),
    ];
    expect(sheetOf(placeFlight(momentOverLot, ASCENDING))).toBe(
      'earlier-high-lot@1 later-low-lot@2',
    );

    // Counts, not bounds: one case per adjacent pair, and the pin moves if a
    // step is added or removed without a case being written for it.
    expect(chain.length - 1).toBe(3);
  });

  it('names the step that decided each row', () => {
    // `decidedBy` is a claim about WHY a row sits where it does, and a
    // leaderboard reads it out. It is pinned by hand here rather than derived,
    // because a second derivation would be the mirror-oracle CLAUDE.md warns
    // about and `careerOpacity.test.ts`'s counted oracle deliberately omits it.
    //
    // Reddens on: `decidedBy` reporting the step that separated a row from the
    // TOP row rather than from the row above it, which is the same value on
    // this fixture for row 2 and a different one for row 3.
    const flight = [
      entry('top', 4, 92.5, 620, 6),
      entry('same-total-lighter', 3, 83.25, 600, 5),
      entry('same-total-heavier', 2, 105.75, 600, 4),
      entry('bombed', 1, 99.5, null, null),
    ];
    const sheet = placeFlight(flight, ASCENDING);
    expect(sheet.map((row) => row.lifterId)).toEqual([
      'top',
      'same-total-lighter',
      'same-total-heavier',
      'bombed',
    ]);
    expect(sheet.map((row) => row.decidedBy)).toEqual([null, 'total', 'bodyweight', null]);
    expect(sheet.map((row) => row.place)).toEqual([1, 2, 3, null]);
  });

  it('shares a place when the published chain runs out, and reports the data that got it there', () => {
    // THE FALLBACK ARM, AND THE FACT THAT IT IS A FALLBACK. The prose in
    // `flight.ts` used to read as though a shared place were a live case of the
    // rule; `separate`'s docstring now bounds it and this is the check that
    // paragraph names as its first half.
    //
    // Both halves are here because either alone is misleading:
    //
    //   1. The arm behaves, on the only input that reaches it: two lifters with
    //      the same total, the same bodyweight and no recorded moment share a
    //      place, the row after them skips to 3, and `decidedBy` reports the
    //      fallback rather than claiming a published step decided it.
    //   2. That input is data `flightPlacingFaults` REJECTS, which is what makes
    //      the arm unreachable on a clean flight. Asserting (1) without (2)
    //      would leave a reader believing the rulebook produces ties it does not
    //      produce here.
    //
    // Reddens on: giving the tied pair different places, on the third lifter
    // getting place 2 instead of 3, on `decidedBy` claiming a published step, or
    // on `flightPlacingFaults` going quiet about the missing moments.
    const tied = [
      entry('tied-high-lot', 8, 92.5, 600, null),
      entry('tied-low-lot', 3, 92.5, 600, null),
      entry('behind', 5, 92.5, 500, 4),
    ];
    const sheet = placeFlight(tied, ASCENDING);
    expect(sheetOf(sheet)).toBe('tied-low-lot@1 tied-high-lot@1 behind@3');
    expect(sheet.map((row) => row.decidedBy)).toEqual([null, 'lot-number', 'total']);
    expect(CAREER_TUNING.PLACING_UNRESOLVED_ORDER).toBe('lot-number');

    // (2). Counts, not bounds — one sentence per lifter that has a total and no
    // moment, and the two of them are exactly the pair that shared a place.
    const reported = flightPlacingFaults(tied, ASCENDING);
    expect(reported).toEqual([
      'career: tied-high-lot has a total and no position it was reached at, so the published ' +
        'tie-break cannot be applied to them',
      'career: tied-low-lot has a total and no position it was reached at, so the published ' +
        'tie-break cannot be applied to them',
    ]);
    expect(reported.length).toBe(2);

    // The other route in, for completeness: moments that collide rather than
    // are missing. Same arm, same shared place, and reported for a different
    // reason — which is why `separate`'s docstring names two fault sentences.
    const collided = [
      entry('same-moment-high-lot', 8, 92.5, 600, 4),
      entry('same-moment-low-lot', 3, 92.5, 600, 4),
    ];
    expect(sheetOf(placeFlight(collided, ASCENDING))).toBe(
      'same-moment-low-lot@1 same-moment-high-lot@1',
    );
    expect(flightPlacingFaults(collided, ASCENDING)).toEqual([
      'career: two lifters reached a total at position 4, and one bar holds one attempt at a time',
    ]);
  });

  it('lists a lifter with no total last and out of the placings', () => {
    // A lifter who missed all three attempts at one of the lifts has no total.
    // They are on the result sheet because they were at the meet, and they are
    // not placed.
    //
    // Reddens on: filtering them out (the sheet gets shorter), on giving them a
    // place, or on sorting them among the placed.
    const flight = [
      entry('bombed-low-lot', 1, 92.5, null, null),
      entry('placed', 2, 105.75, 500, 3),
      entry('bombed-high-lot', 7, 83.25, null, null),
    ];
    const sheet = placeFlight(flight, ASCENDING);
    expect(sheetOf(sheet)).toBe('placed@1 bombed-low-lot@none bombed-high-lot@none');
    expect(sheet.filter((row) => row.place === null).length).toBe(2);

    // A flight where nobody has a total is a sheet of nobodies rather than a
    // throw, and an empty flight is an empty sheet.
    expect(placeFlight([entry('a', 1, 92.5, null, null)], ASCENDING)).toEqual([
      { lifterId: 'a', categoryId: FLIGHT_SWEEP.CATEGORY_A, place: null, decidedBy: null },
    ]);
    expect(placeFlight([], ASCENDING)).toEqual([]);
  });

  it('is the live leaderboard when it is run partway through', () => {
    // §6.6 asks for a "live leaderboard feed". The feed is this function run
    // again with each lifter's total as it stands, so the check is that a
    // partial sheet is a real sheet and that it moves when a total lands.
    //
    // Reddens on: `placeFlight` requiring a finished flight — refusing a null
    // total, or refusing a flight where the moments are not contiguous.
    const beforeThird = [
      entry('leader', 1, 92.5, 600, 4),
      entry('chaser', 2, 92.5, 590, 5),
      entry('yet-to-lift', 3, 83.25, null, null),
    ];
    expect(sheetOf(placeFlight(beforeThird, ASCENDING))).toBe(
      'leader@1 chaser@2 yet-to-lift@none',
    );

    const afterThird = [
      entry('leader', 1, 92.5, 600, 4),
      entry('chaser', 2, 92.5, 590, 5),
      entry('yet-to-lift', 3, 83.25, 610, 8),
    ];
    expect(sheetOf(placeFlight(afterThird, ASCENDING))).toBe(
      'yet-to-lift@1 leader@2 chaser@3',
    );
  });

  it('places the same flight the same way however the entries arrive', () => {
    // A result sheet must not depend on the order the rows were assembled in.
    // The domain is every permutation of a four-lifter flight, which is 24 and
    // exhaustive rather than a handful of shuffles — and it is built to exercise
    // all three published steps at once: two lifters share a total, two share a
    // bodyweight, and one has no total at all.
    //
    // Reddens on: the sort losing stability inside a tie group, or on the
    // fallback reading the entries' position instead of their lot.
    const flight = [
      entry('a', 4, FLIGHT_SWEEP.BODYWEIGHTS_KG[0] as number, 600, 1),
      entry('b', 3, FLIGHT_SWEEP.BODYWEIGHTS_KG[1] as number, 600, 2),
      entry('c', 2, FLIGHT_SWEEP.BODYWEIGHTS_KG[2] as number, 600, 3),
      entry('d', 1, FLIGHT_SWEEP.BODYWEIGHTS_KG[3] as number, null, null),
    ];
    const expected = sheetOf(placeFlight(flight, ASCENDING));
    expect(expected).toBe('a@1 b@2 c@3 d@none');

    const permutations: FlightResultEntry<Kg>[][] = [];
    const walk = (rest: readonly FlightResultEntry<Kg>[], built: FlightResultEntry<Kg>[]): void => {
      if (rest.length === 0) {
        permutations.push([...built]);
        return;
      }
      for (let index = 0; index < rest.length; index += 1) {
        walk(
          [...rest.slice(0, index), ...rest.slice(index + 1)],
          [...built, rest[index] as FlightResultEntry<Kg>],
        );
      }
    };
    walk(flight, []);

    let checked = 0;
    for (const permutation of permutations) {
      expect(sheetOf(placeFlight(permutation, ASCENDING)), permutation.map((e) => e.lifterId).join(',')).toBe(
        expected,
      );
      checked += 1;
    }
    // Counts, not bounds, on the domain: 4! permutations, all distinct.
    expect(checked).toBe(24);
    expect(new Set(permutations.map((p) => p.map((e) => e.lifterId).join(','))).size).toBe(24);
  });

  it('reports a flight whose rows cannot be placed', () => {
    // `flightPlacingFaults`'s result half. The order half is driven in
    // `careerOpacity.test.ts`, where a comparator can be built over a numeric
    // total without this file having to claim anything about opacity.
    //
    // Reddens on: a check dropped from the entry walk.
    const clean = [
      entry('a', 1, 92.5, 600, 0),
      entry('b', 2, 83.25, 590, 1),
      entry('c', 3, 105.75, null, null),
    ];
    expect(flightPlacingFaults(clean, ASCENDING)).toEqual([]);

    expect(
      flightPlacingFaults([entry('a', 1, 92.5, null, 4)], ASCENDING).join('\n'),
    ).toContain('has no total and yet reached one at position 4');
    expect(
      flightPlacingFaults([entry('a', 1, 92.5, 600, null)], ASCENDING).join('\n'),
    ).toContain('has a total and no position it was reached at');
    expect(
      flightPlacingFaults([entry('a', 1, 92.5, 600, -1)], ASCENDING).join('\n'),
    ).toContain('which is not a place in the running order');
    expect(
      flightPlacingFaults(
        [entry('a', 1, 92.5, 600, 2), entry('b', 2, 83.25, 590, 2)],
        ASCENDING,
      ).join('\n'),
    ).toContain('one bar holds one attempt at a time');
    expect(
      flightPlacingFaults(
        [entry('a', 1, 92.5, 600, 0), entry('b', 1, 83.25, 590, 1)],
        ASCENDING,
      ).join('\n'),
    ).toContain('is held by two lifters in this flight');
    expect(
      flightPlacingFaults([entry('a', 0, 92.5, 600, 0)], ASCENDING).join('\n'),
    ).toContain('is not a drawn lot');
    expect(
      flightPlacingFaults([entry('a', 1, 0, 600, 0)], ASCENDING).join('\n'),
    ).toContain('which is not a weigh-in');
    expect(
      flightPlacingFaults([entry('a', 1, 92.5, 600, 0, '   ')], ASCENDING).join('\n'),
    ).toContain('carries no category, so there is nothing to place them in');
    expect(flightPlacingFaults([], ASCENDING)).toEqual([]);
  });
});

// ===========================================================================
// 3a. A place is a place in a CATEGORY, not in a flight
// ===========================================================================

describe('a placing is awarded inside a category and a flight is not one', () => {
  it('names the fields a lifter is placed by', () => {
    // The catcher `FlightMember`'s docstring names. That sentence promised for a
    // round that "bodyweight, division and total arrive later, at the functions
    // that need them" while NO type in the module took a division — the shape
    // CLAUDE.md's guarantee-prose section records eight times, and it was found
    // by reading rather than by anything failing.
    //
    // A structural check rather than a prose one: the sentence is true exactly
    // when the three fields it names are on the entry a placing reads, so that
    // is what is asserted. It is deliberately a key census and not a `toContain`
    // on the comment, because a comment scan checks the comment.
    //
    // Reddens on: `categoryId` leaving `FlightResultEntry`, which is the edit
    // that makes the docstring false again, or on a field being added to the
    // entry without a reader deciding whether the sentence still describes it.
    const shape = entry('a', 1, 92.5, 600, 0);
    expect(Object.keys(shape).sort()).toEqual([
      'bodyweightKg',
      'categoryId',
      'lifterId',
      'lotNumber',
      'total',
      'totalReachedAtPosition',
    ]);
    // And the row that comes back says which category the place is IN, so a
    // leaderboard cannot print "1st" with no answer to "of what".
    const row = placeFlight([shape], ASCENDING)[0] as FlightPlacing;
    expect(Object.keys(row).sort()).toEqual(['categoryId', 'decidedBy', 'lifterId', 'place']);
    expect(row.categoryId).toBe(FLIGHT_SWEEP.CATEGORY_A);
  });

  it('places each category from one and keeps the caller’s category order', () => {
    // The behaviour the ruling in `flight.ts`'s section 1a buys. A flight that
    // mixes two weight classes produces TWO first places, and the partitions
    // come out in the order the caller's entries first mention them.
    //
    // The fixture is built so the flight-wide reading and the per-category
    // reading disagree at every row: interleaved, and the heaviest total in the
    // flight sits in category B. Under the old flight-wide placing this sheet
    // was `b-big@1 a-big@2 b-small@3 a-small@4`.
    //
    // Reddens on: placing flight-wide (every place becomes distinct and the
    // categories interleave), or on sorting the categories by id rather than
    // preserving the caller's order — which would put B first here, since
    // 'mens-105-…' sorts before 'mens-93-…'.
    const mixed = [
      entry('a-small', 1, 92.5, 560, 0, FLIGHT_SWEEP.CATEGORY_A),
      entry('b-big', 2, 105.75, 700, 1, FLIGHT_SWEEP.CATEGORY_B),
      entry('a-big', 3, 92.5, 640, 2, FLIGHT_SWEEP.CATEGORY_A),
      entry('b-small', 4, 105.75, 600, 3, FLIGHT_SWEEP.CATEGORY_B),
    ];
    expect(categorisedSheetOf(placeFlight(mixed, ASCENDING))).toBe(
      `a-big@${FLIGHT_SWEEP.CATEGORY_A}:1 a-small@${FLIGHT_SWEEP.CATEGORY_A}:2 ` +
        `b-big@${FLIGHT_SWEEP.CATEGORY_B}:1 b-small@${FLIGHT_SWEEP.CATEGORY_B}:2`,
    );
    // Two firsts, and the alphabetically-earlier category is second, so neither
    // "one winner" nor "sorted by id" can pass this.
    expect(placeFlight(mixed, ASCENDING).filter((row) => row.place === 1).length).toBe(2);
    expect(FLIGHT_SWEEP.CATEGORY_B < FLIGHT_SWEEP.CATEGORY_A).toBe(true);

    // And the caller's order really is preserved, checked the other way round.
    const reversed = [mixed[1], mixed[3], mixed[0], mixed[2]] as FlightResultEntry<Kg>[];
    expect(placeFlight(reversed, ASCENDING).map((row) => row.categoryId)).toEqual([
      FLIGHT_SWEEP.CATEGORY_B,
      FLIGHT_SWEEP.CATEGORY_B,
      FLIGHT_SWEEP.CATEGORY_A,
      FLIGHT_SWEEP.CATEGORY_A,
    ]);
  });

  it('cannot have a lifter’s place changed by somebody in another category', () => {
    // THE PROPERTY THE RULING IS FOR, and the one a competitive lifter would
    // check first: who else the organiser happened to put in your flight has no
    // effect on what you placed. Under the flight-wide placing this file
    // replaces it was false at every point — which is what made it a defect
    // rather than a naming quibble.
    //
    // Exhaustive over the intruder rather than sampled: for every total in a
    // band that straddles all three of the base flight's totals, and for the
    // bodyweight and moment that would each have decided a tie-break had the
    // intruder been in the same category, the base category's rows must be
    // byte-identical to the sheet it gets alone. The band is derived from the
    // fixture's own numbers — below, just below, at, just above, above, and far
    // away from each — because a band of round numbers would sample nowhere near
    // what the code branches on.
    //
    // Reddens on: `placeFlight` comparing across categories at all. The cheapest
    // mutant is dropping the partition, which makes the intruder's total land
    // among the base rows for most of the band.
    const base = [
      entry('base-top', 1, 92.5, 620, 0, FLIGHT_SWEEP.CATEGORY_A),
      entry('base-middle', 2, 92.5, 600, 1, FLIGHT_SWEEP.CATEGORY_A),
      entry('base-bottom', 3, 83.25, 600, 2, FLIGHT_SWEEP.CATEGORY_A),
    ];
    const alone = categorisedSheetOf(placeFlight(base, ASCENDING));
    expect(alone).toBe(
      `base-top@${FLIGHT_SWEEP.CATEGORY_A}:1 base-bottom@${FLIGHT_SWEEP.CATEGORY_A}:2 ` +
        `base-middle@${FLIGHT_SWEEP.CATEGORY_A}:3`,
    );

    const straddling: number[] = [];
    for (const anchor of [620, 600]) {
      for (const delta of [-40, -FLIGHT_SWEEP.STEP_KG, 0, FLIGHT_SWEEP.STEP_KG, 40, 400]) {
        straddling.push(anchor + delta);
      }
    }

    let checked = 0;
    let overlapped = 0;
    for (const intruderKg of straddling) {
      for (const intruderBw of [83.25, 92.5, 105.75]) {
        for (const intruderAt of [0, 1, 2, 9]) {
          const withIntruder = [
            ...base,
            entry('intruder', 4, intruderBw, intruderKg, intruderAt, FLIGHT_SWEEP.CATEGORY_B),
          ];
          const sheet = placeFlight(withIntruder, ASCENDING);
          const baseRows = sheet.filter((row) => row.categoryId === FLIGHT_SWEEP.CATEGORY_A);
          expect(
            categorisedSheetOf(baseRows),
            `intruder at ${intruderKg}kg / ${intruderBw}kg bw / moment ${intruderAt}`,
          ).toBe(alone);
          // The intruder is placed, and placed first, because they are the only
          // lifter in their own category however big or small their total is.
          const theirs = sheet.filter((row) => row.categoryId === FLIGHT_SWEEP.CATEGORY_B);
          expect(theirs.map((row) => row.place)).toEqual([1]);
          if (base.some((row) => row.total === intruderKg)) overlapped += 1;
          checked += 1;
        }
      }
    }
    // Counts, not bounds, on the domain AND on the region that matters: a band
    // that never coincided with a base total would never have put the intruder
    // where a flight-wide sort would move somebody, which is the empty middle
    // CLAUDE.md's extremes section is about.
    expect(straddling.length).toBe(12);
    expect(checked).toBe(12 * 3 * 4);
    expect(checked).toBe(144);
    // TWENTY-FOUR, AND THE DRAFT SAID THIRTY-SIX. Derived rather than refitted:
    // the base holds two distinct totals (620 and 600) and the band contains
    // each of them exactly once — the `delta: 0` point of its own anchor, and
    // nowhere else, since the two anchors are 20 kg apart and no delta bridges
    // them. So two of the twelve band points coincide, times three bodyweights
    // times four moments. Writing thirty-six was counting three base ROWS rather
    // than two base TOTALS, and two of those rows share 600.
    expect(overlapped).toBe(2 * 3 * 4);
    expect(overlapped).toBe(24);
  });

  it('reports a blank category rather than placing a flight against itself', () => {
    // There is no default category in `flight.ts` and `string` cannot make a
    // blank one a type error, so this is the fault that stands in for the
    // compiler. Counts and the sentence, because a fault reporter that returns
    // one sentence for the wrong reason satisfies a bound.
    //
    // Reddens on: the blank-category check leaving `flightPlacingFaults`, or on
    // it firing for a category that is merely unusual rather than empty.
    const blank = flightPlacingFaults(
      [entry('a', 1, 92.5, 600, 0, ''), entry('b', 2, 83.25, 590, 1, FLIGHT_SWEEP.CATEGORY_A)],
      ASCENDING,
    );
    expect(blank).toEqual([
      'career: a carries no category, so there is nothing to place them in',
    ]);
    // Whitespace is blank too, and a one-character id is not.
    expect(
      flightPlacingFaults([entry('a', 1, 92.5, 600, 0, '\t ')], ASCENDING).length,
    ).toBe(1);
    expect(flightPlacingFaults([entry('a', 1, 92.5, 600, 0, 'x')], ASCENDING)).toEqual([]);
  });
});
