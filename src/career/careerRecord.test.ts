/**
 * careerRecord.test.ts — the history, and the standing derived from it.
 *
 * Every check names, in place, the edit to a SUBJECT module that reddens it.
 * Where a check cannot be reddened by any edit to its subject it has been
 * deleted rather than kept as decoration.
 *
 * Two of the blocks below are about facts other files are explicitly waiting
 * for, and they are written as those files describe them rather than as this
 * one would: "which meets a lifter has already competed at"
 * (`src/meet/useMeetDay.ts`) and "a fact about a lifter's standing across
 * meets" (`src/cutin/cutInGate.ts`). Neither is wired here; wiring is another
 * session's and a later piece.
 */

import { describe, expect, it } from 'vitest';

import { CAREER_TUNING } from './careerTuning';
import {
  CAREER_FEDERATIONS,
  buildCareerCalendar,
  careerTierRank,
  createCareerLifter,
  enterMeet,
  meetEligibility,
  qualifyingTotalKgFor,
  type CareerFederation,
  type CareerLifter,
  type CareerMeetSlot,
  type CareerQualifyingGate,
  type CareerTier,
} from './careerCore';
import {
  CAREER_RESULT_REFUSAL_KINDS,
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
  standingRank,
  tierUnlockBetween,
  type CareerMeetResult,
  type CareerRecord,
  type CareerResultRefusal,
} from './careerRecord';

// ---------------------------------------------------------------------------
// The opaque total, and a gate that can look inside it
// ---------------------------------------------------------------------------

/**
 * The stand-in for `progression.ts`'s `ConfirmedTotalKg`, as
 * `careerCore.test.ts` builds it: a wrapper rather than a bare number, so an
 * accidental `total >= requiredKg` inside a shipped module is a type error
 * rather than a line nobody happened to write.
 */
interface TestTotal {
  readonly kg: number;
}

const kg = (value: number): TestTotal => ({ kg: value });
const GATE: CareerQualifyingGate<TestTotal> = (total, requiredKg) => total.kg >= requiredKg;

const FED = CAREER_FEDERATIONS[0] as CareerFederation;
const OTHER_FED = CAREER_FEDERATIONS[1] as CareerFederation;
const HORIZON = 400;
const CALENDAR = buildCareerCalendar({ federationId: FED.id, throughDayIndex: HORIZON });

function slotOf(tier: CareerTier, dayIndex: number): CareerMeetSlot {
  const found = CALENDAR.find((slot) => slot.tier === tier && slot.dayIndex === dayIndex);
  if (found === undefined) throw new Error(`no ${tier} slot on day ${dayIndex}`);
  return found;
}

const BODYWEIGHT_KG = 92.5;

/** A lifter who has entered every slot named, without going near the gate. */
function entrant(slots: readonly CareerMeetSlot[]): CareerLifter<TestTotal> {
  const base = createCareerLifter<TestTotal>(FED.id, 'mens');
  if (slots.length === 0) return base;
  return {
    ...base,
    enteredSlotIds: slots.map((slot) => slot.slotId),
    lastEntryDayIndex: Math.max(...slots.map((slot) => slot.dayIndex)),
  };
}

/** Record a contest at each slot in order, asserting each one is accepted. */
function historyOf(
  entries: readonly (readonly [CareerMeetSlot, number | null])[],
): CareerRecord<TestTotal> {
  const lifter = entrant(entries.map(([slot]) => slot));
  let record = createCareerRecord<TestTotal>();
  for (const [slot, total] of entries) {
    const outcome = recordMeetResult(record, lifter, slot, {
      total: total === null ? null : kg(total),
      bodyweightKg: BODYWEIGHT_KG,
    });
    if (outcome.kind !== 'recorded') throw new Error(`refused: ${outcome.reason.kind}`);
    record = outcome.record;
  }
  return record;
}

const REGIONAL_KG = qualifyingTotalKgFor('regional', 'mens') as number;
const NATIONALS_KG = qualifyingTotalKgFor('nationals', 'mens') as number;
const WORLDS_KG = qualifyingTotalKgFor('worlds', 'mens') as number;

// ===========================================================================
// The record
// ===========================================================================

describe('the record of meets a lifter has competed at', () => {
  it('starts empty and answers the already-competed question', () => {
    // The exact fact `src/meet/useMeetDay.ts` names as its fix: "a calendar
    // knows which meets a lifter has already competed at".
    //
    // Reddens on: `hasCompetedAt` matching on anything but the slot id — on
    // the day, say, which would make two meets on one day indistinguishable.
    const empty = createCareerRecord<TestTotal>();
    expect(empty.results).toEqual([]);
    expect(hasCompetedAt(empty, slotOf('local', 7).slotId)).toBe(false);

    const record = historyOf([[slotOf('local', 7), 500]]);
    expect(hasCompetedAt(record, slotOf('local', 7).slotId)).toBe(true);
    expect(hasCompetedAt(record, slotOf('local', 14).slotId)).toBe(false);
    expect(competedSlotIds(record)).toEqual([slotOf('local', 7).slotId]);
    expect(lastResultDay(record)).toBe(7);
    expect(lastResultDay(empty)).toBeNull();
  });

  it('carries the day and the total back for a meet already competed at', () => {
    const record = historyOf([[slotOf('local', 7), 500]]);
    const result = resultFor(record, slotOf('local', 7).slotId) as CareerMeetResult<TestTotal>;
    expect(result.dayIndex).toBe(7);
    expect(result.tier).toBe('local');
    expect(result.federationId).toBe(FED.id);
    expect(result.total).toEqual(kg(500));
    expect(result.bodyweightKg).toBe(BODYWEIGHT_KG);
    expect(resultFor(record, 'no-such-slot')).toBeNull();
  });

  it('takes the four calendar fields off the slot, so they cannot disagree', () => {
    // Reddens on: `recordMeetResult` accepting a tier, a day or a federation
    // from the caller. It cannot today — there is no parameter for one — and
    // this is the check that would notice `CareerContest` growing one.
    const slot = slotOf('nationals', 49);
    const record = historyOf([[slot, 600]]);
    const result = record.results[0] as CareerMeetResult<TestTotal>;
    expect({
      slotId: result.slotId,
      tier: result.tier,
      federationId: result.federationId,
      dayIndex: result.dayIndex,
    }).toEqual({
      slotId: slot.slotId,
      tier: slot.tier,
      federationId: slot.federationId,
      dayIndex: slot.dayIndex,
    });
  });

  it('leaves the record it was given alone', () => {
    const lifter = entrant([slotOf('local', 7)]);
    const before = createCareerRecord<TestTotal>();
    const outcome = recordMeetResult(before, lifter, slotOf('local', 7), {
      total: kg(500),
      bodyweightKg: BODYWEIGHT_KG,
    });
    expect(outcome.kind).toBe('recorded');
    expect(before.results).toEqual([]);
  });

  it('counts a bomb-out as a meet competed at, with no total', () => {
    // GDD §6.3's bomb-out. A model that dropped it would answer "no" to the
    // already-competed question about a meet the lifter definitely contested.
    //
    // Reddens on: `recordMeetResult` refusing a `null` total, or
    // `standingOver` counting a bombed meet in `totalsPosted`.
    const record = historyOf([[slotOf('local', 7), null]]);
    expect(hasCompetedAt(record, slotOf('local', 7).slotId)).toBe(true);
    const standing = careerStanding(record, 'mens', GATE);
    expect(standing.meetsCompleted).toBe(1);
    expect(standing.bombOuts).toBe(1);
    expect(standing.totalsPosted).toBe(0);
    expect(standing.highestTierCompeted).toBe('local');
    expect(standing.qualifiedTier).toBeNull();
  });

  it('reaches every refusal it declares', () => {
    // A tagged union with an unreachable arm is a union with dead code in it.
    const lifter = entrant([slotOf('local', 7), slotOf('local', 21)]);
    const contest = { total: kg(500), bodyweightKg: BODYWEIGHT_KG };
    const one = recordMeetResult(createCareerRecord<TestTotal>(), lifter, slotOf('local', 21), contest);
    if (one.kind !== 'recorded') throw new Error('unreachable');

    const observed: CareerResultRefusal['kind'][] = [];
    const refusals = [
      recordMeetResult(createCareerRecord<TestTotal>(), lifter, slotOf('local', 14), contest),
      recordMeetResult(one.record, lifter, slotOf('local', 21), contest),
      recordMeetResult(one.record, lifter, slotOf('local', 7), contest),
      recordMeetResult(createCareerRecord<TestTotal>(), lifter, slotOf('local', 7), {
        total: kg(500),
        bodyweightKg: 0,
      }),
    ];
    for (const outcome of refusals) {
      if (outcome.kind !== 'refused') throw new Error('expected a refusal');
      observed.push(outcome.reason.kind);
    }
    expect([...observed].sort()).toEqual([...CAREER_RESULT_REFUSAL_KINDS].sort());
    expect(new Set(observed).size).toBe(CAREER_RESULT_REFUSAL_KINDS.length);
    expect(CAREER_RESULT_REFUSAL_KINDS.length).toBe(4);
  });

  it('carries the number a screen would need with each refusal', () => {
    const lifter = entrant([slotOf('local', 7), slotOf('local', 21)]);
    const contest = { total: kg(500), bodyweightKg: BODYWEIGHT_KG };
    const first = recordMeetResult(createCareerRecord<TestTotal>(), lifter, slotOf('local', 21), contest);
    if (first.kind !== 'recorded') throw new Error('unreachable');

    expect(recordMeetResult(first.record, lifter, slotOf('local', 21), contest)).toEqual({
      kind: 'refused',
      reason: { kind: 'already-competed', slotId: slotOf('local', 21).slotId, onDayIndex: 21 },
    });
    expect(recordMeetResult(first.record, lifter, slotOf('local', 7), contest)).toEqual({
      kind: 'refused',
      reason: { kind: 'before-last-result', dayIndex: 7, lastResultDayIndex: 21 },
    });
  });

  it('holds the refusal precedence it documents', () => {
    // Which sentence a caller gets when two refusals are true at once. Every
    // pair below has BOTH conditions true, so each assertion discriminates.
    //
    // Reddens on: reordering the `if`s in `recordMeetResult`.
    const lifter = entrant([slotOf('local', 21)]);
    const contest = { total: kg(500), bodyweightKg: BODYWEIGHT_KG };
    const first = recordMeetResult(createCareerRecord<TestTotal>(), lifter, slotOf('local', 21), contest);
    if (first.kind !== 'recorded') throw new Error('unreachable');

    // not-entered over already-competed: the lifter is not in the meet at all,
    // even though a result for it is on the record.
    const stranger = createCareerLifter<TestTotal>(FED.id, 'mens');
    const strangerOutcome = recordMeetResult(first.record, stranger, slotOf('local', 21), contest);
    expect(strangerOutcome.kind === 'refused' && strangerOutcome.reason.kind).toBe('not-entered');

    // already-competed over before-last-result and over unweighed: the same
    // slot, an earlier day and no weigh-in are all true of this call.
    const again = recordMeetResult(first.record, lifter, slotOf('local', 21), {
      total: kg(500),
      bodyweightKg: -1,
    });
    expect(again.kind === 'refused' && again.reason.kind).toBe('already-competed');

    // before-last-result over unweighed: an earlier day AND no weigh-in.
    const backwardsEntered = recordMeetResult(
      first.record,
      entrant([slotOf('local', 21), slotOf('local', 7)]),
      slotOf('local', 7),
      { total: kg(500), bodyweightKg: 0 },
    );
    expect(backwardsEntered.kind === 'refused' && backwardsEntered.reason.kind).toBe(
      'before-last-result',
    );
  });

  it('refuses a result for a meet the lifter never entered', () => {
    // The record is a subset of the intentions, and this is what makes it one.
    //
    // Reddens on: dropping the `enteredSlotIds` check, which would let a result
    // be banked for a meet nobody signed up for.
    const stranger = createCareerLifter<TestTotal>(FED.id, 'mens');
    const outcome = recordMeetResult(createCareerRecord<TestTotal>(), stranger, slotOf('local', 7), {
      total: kg(500),
      bodyweightKg: BODYWEIGHT_KG,
    });
    expect(outcome).toEqual({
      kind: 'refused',
      reason: { kind: 'not-entered', slotId: slotOf('local', 7).slotId },
    });
  });

  it('composes with enterMeet: enter, compete, and the record follows', () => {
    // The loop a wiring piece runs, with nothing hand-assembled: the lifter is
    // produced by `enterMeet` and the record by `recordMeetResult`.
    //
    // Reddens on: `enterMeet` not adding the slot id, or `recordMeetResult`
    // reading a different field for its already-entered check.
    const slot = slotOf('local', 7);
    const entered = enterMeet(createCareerLifter<TestTotal>(FED.id, 'mens'), slot, 0, GATE);
    if (entered.kind !== 'entered') throw new Error('unreachable');
    const outcome = recordMeetResult(createCareerRecord<TestTotal>(), entered.lifter, slot, {
      total: kg(500),
      bodyweightKg: BODYWEIGHT_KG,
    });
    expect(outcome.kind).toBe('recorded');
    if (outcome.kind !== 'recorded') throw new Error('unreachable');
    expect(careerHistoryFaults(outcome.record, entered.lifter)).toEqual([]);
  });
});

// ===========================================================================
// Standing
// ===========================================================================

describe('standing across meets', () => {
  it('reads the highest tier a posted total qualifies for', () => {
    // Reddens on: `qualifiedTierFor` walking the ladder upwards and returning
    // the FIRST tier admitted rather than the highest, which would report
    // `local` for every lifter who has ever posted a total.
    expect(qualifiedTierFor(kg(WORLDS_KG), 'mens', GATE)).toBe('worlds');
    expect(qualifiedTierFor(kg(NATIONALS_KG), 'mens', GATE)).toBe('nationals');
    expect(qualifiedTierFor(kg(REGIONAL_KG), 'mens', GATE)).toBe('regional');
    expect(qualifiedTierFor(kg(1), 'mens', GATE)).toBe('local');
    // A kilogram under each requirement is the tier below, so the boundary is
    // reached rather than merely straddled.
    expect(qualifiedTierFor(kg(WORLDS_KG - 1), 'mens', GATE)).toBe('nationals');
    expect(qualifiedTierFor(kg(NATIONALS_KG - 1), 'mens', GATE)).toBe('regional');
    expect(qualifiedTierFor(kg(REGIONAL_KG - 1), 'mens', GATE)).toBe('local');
  });

  it('asks the injected gate and never compares a total itself', () => {
    // The seam. A gate that refuses everything leaves the lifter on the open
    // tier; one that admits everything takes them to the top; the total is the
    // same in both.
    //
    // Reddens on: `careerRecord.ts` comparing `total` itself. It could not
    // today — `Total` is opaque — so this is the check that would notice the
    // type being widened to `number` and a `>=` appearing.
    expect(qualifiedTierFor(kg(1), 'mens', () => true)).toBe('worlds');
    expect(qualifiedTierFor(kg(10000), 'mens', () => false)).toBe('local');

    const asked: number[] = [];
    const counting: CareerQualifyingGate<TestTotal> = (total, requiredKg) => {
      asked.push(requiredKg);
      return GATE(total, requiredKg);
    };
    expect(qualifiedTierFor(kg(REGIONAL_KG), 'mens', counting)).toBe('regional');
    // The walk stops at the first tier it is admitted to, and the open tier is
    // never asked about at all.
    expect(asked).toEqual([WORLDS_KG, NATIONALS_KG, REGIONAL_KG]);
  });

  it('reports null for a lifter who has posted nothing', () => {
    const empty = careerStanding(createCareerRecord<TestTotal>(), 'mens', GATE);
    expect(empty.qualifiedTier).toBeNull();
    expect(empty.qualifyingTotal).toBeNull();
    expect(empty.qualifyingBodyweightKg).toBeNull();
    expect(empty.qualifiedOnDayIndex).toBeNull();
    expect(empty.highestTierCompeted).toBeNull();
    expect(empty.lastResultDayIndex).toBeNull();
    expect(empty.qualifiedAboveCompeted).toBe(false);
    expect(empty.meetsCompleted).toBe(0);
  });

  it('keeps the best tier ever reached, not the most recent', () => {
    // The property the whole engagement measurement below is about, in one
    // case: a good meet followed by a bad one leaves the standing where the
    // good one put it.
    //
    // Reddens on: `standingOver` overwriting the qualified tier on every
    // result instead of only on a higher one — which is the
    // `latest-result-only` control in `careerEngagement.ts`.
    const record = historyOf([
      [slotOf('local', 7), NATIONALS_KG],
      [slotOf('local', 21), 1],
    ]);
    const standing = careerStanding(record, 'mens', GATE);
    expect(standing.qualifiedTier).toBe('nationals');
    expect(standing.qualifyingTotal).toEqual(kg(NATIONALS_KG));
    expect(standing.qualifiedOnDayIndex).toBe(7);
    expect(standing.meetsCompleted).toBe(2);
    expect(standing.totalsPosted).toBe(2);
  });

  it('keeps the earliest total that reached the top tier', () => {
    // Two totals qualifying for the same tier are interchangeable to this
    // module — see the header, section 3 — and the earlier one is kept, so
    // `qualifiedOnDayIndex` is the day the standing was reached.
    //
    // Reddens on: `standingOver` using `>=` where it uses `>`, which would
    // report the LATEST day the tier was matched as the day it was reached.
    const record = historyOf([
      [slotOf('local', 7), NATIONALS_KG],
      [slotOf('local', 21), NATIONALS_KG + 1],
    ]);
    const standing = careerStanding(record, 'mens', GATE);
    expect(standing.qualifiedOnDayIndex).toBe(7);
    expect(standing.qualifyingTotal).toEqual(kg(NATIONALS_KG));
  });

  it('carries the inputs a DOTS score needs and computes none', () => {
    // CLAUDE.md's domain-correctness rule: DOTS uses published coefficients and
    // they live in `src/game/dots.ts`. This directory does not import it, so
    // standing carries the inputs and stops.
    //
    // Reddens on: `careerRecord.ts` growing a score field, which would have to
    // homebrew one.
    const record = historyOf([[slotOf('local', 7), NATIONALS_KG]]);
    const standing = careerStanding(record, 'mens', GATE);
    expect(standing.qualifyingTotal).toEqual(kg(NATIONALS_KG));
    expect(standing.qualifyingBodyweightKg).toBe(BODYWEIGHT_KG);
    expect(Object.keys(standing).sort()).toEqual([
      'bombOuts',
      'highestTierCompeted',
      'lastResultDayIndex',
      'meetsCompleted',
      'qualifiedAboveCompeted',
      'qualifiedOnDayIndex',
      'qualifiedTier',
      'qualifyingBodyweightKg',
      'qualifyingTotal',
      'totalsPosted',
    ]);
  });

  it('separates the tier competed at from the tier qualified for', () => {
    // §7.2's third PR sub-moment is "qualifying for a higher tier", and this is
    // the pair of facts that makes it sayable: a lifter who totals a nationals
    // qualifying total at a local meet has competed at `local` and stands at
    // `nationals`.
    //
    // Reddens on: `qualifiedAboveCompeted` comparing the wrong pair, or
    // `highestTierCompeted` reading the qualified tier.
    const record = historyOf([[slotOf('local', 7), NATIONALS_KG]]);
    const standing = careerStanding(record, 'mens', GATE);
    expect(standing.highestTierCompeted).toBe('local');
    expect(standing.qualifiedTier).toBe('nationals');
    expect(standing.qualifiedAboveCompeted).toBe(true);

    // And it is false when the lifter has already competed there.
    const caughtUp = historyOf([
      [slotOf('local', 7), NATIONALS_KG],
      [slotOf('nationals', 49), NATIONALS_KG],
    ]);
    expect(careerStanding(caughtUp, 'mens', GATE).qualifiedAboveCompeted).toBe(false);
    expect(careerStanding(caughtUp, 'mens', GATE).highestTierCompeted).toBe('nationals');
  });

  it('reads the same history differently for a different category', () => {
    // The qualifying table is per category, so standing is too. A total that
    // is a regional qualifier in one category is a nationals one in the other.
    //
    // Reddens on: `qualifiedTierFor` ignoring its `category` argument.
    const record = historyOf([[slotOf('local', 7), NATIONALS_KG]]);
    expect(careerStanding(record, 'mens', GATE).qualifiedTier).toBe('nationals');
    expect(careerStanding(record, 'womens', GATE).qualifiedTier).toBe('worlds');
  });

  it('reads standing as of a day, not only at the end', () => {
    // The element-wise reading the engagement sweep compares.
    //
    // Reddens on: `standingAsOf` ignoring `throughDayIndex`, which would make
    // every day of the sweep report the final standing and the whole
    // measurement vacuous.
    const record = historyOf([
      [slotOf('local', 7), REGIONAL_KG],
      [slotOf('local', 21), WORLDS_KG],
    ]);
    expect(standingAsOf(record, 6, 'mens', GATE).qualifiedTier).toBeNull();
    expect(standingAsOf(record, 7, 'mens', GATE).qualifiedTier).toBe('regional');
    expect(standingAsOf(record, 20, 'mens', GATE).qualifiedTier).toBe('regional');
    expect(standingAsOf(record, 21, 'mens', GATE).qualifiedTier).toBe('worlds');
    expect(standingAsOf(record, 21, 'mens', GATE).meetsCompleted).toBe(2);
    expect(standingAsOf(record, 6, 'mens', GATE).meetsCompleted).toBe(0);
  });

  it('ranks a missing tier below the bottom of the ladder', () => {
    expect(standingRank(null)).toBe(-1);
    expect(standingRank('local')).toBe(careerTierRank('local'));
    expect(standingRank('worlds')).toBe(careerTierRank('worlds'));
    expect(standingRank('local')).toBeGreaterThan(standingRank(null));
  });
});

// ===========================================================================
// The cut-in fact
// ===========================================================================

describe('tierUnlockBetween — GDD §7.2’s third PR sub-moment', () => {
  it('fires when standing crosses onto a higher tier, and not otherwise', () => {
    // `src/cutin/cutInGate.ts` §5: "tier qualification is a fact about a
    // lifter's standing across meets". This is that fact as a transition,
    // which is the form a recap needs — a cut-in fires at a moment.
    //
    // Reddens on: `tierUnlockBetween` using `>=` rather than `>`, which would
    // fire the cut-in again at every meet that merely matched the standing.
    const nothing = careerStanding(createCareerRecord<TestTotal>(), 'mens', GATE);
    const local = careerStanding(historyOf([[slotOf('local', 7), 1]]), 'mens', GATE);
    const regional = careerStanding(
      historyOf([[slotOf('local', 7), REGIONAL_KG]]),
      'mens',
      GATE,
    );

    expect(tierUnlockBetween(nothing, local)).toEqual({
      kind: 'tier-unlocked',
      from: null,
      to: 'local',
      onDayIndex: 7,
    });
    expect(tierUnlockBetween(local, regional)).toEqual({
      kind: 'tier-unlocked',
      from: 'local',
      to: 'regional',
      onDayIndex: 7,
    });
    expect(tierUnlockBetween(local, local)).toEqual({ kind: 'none' });
    expect(tierUnlockBetween(regional, local)).toEqual({ kind: 'none' });
    expect(tierUnlockBetween(nothing, nothing)).toEqual({ kind: 'none' });
  });

  it('fires once per crossing across a whole career, not once per meet', () => {
    // A cut-in that fired on every recap would be §7.2's cap problem rather
    // than §7.2's moment. Walked meet by meet, the number of unlocks is the
    // number of rungs climbed.
    //
    // Reddens on: the `>` above becoming `>=` — the count goes to 5.
    const entries: readonly (readonly [CareerMeetSlot, number])[] = [
      [slotOf('local', 7), 1],
      [slotOf('local', 21), REGIONAL_KG],
      [slotOf('local', 35), REGIONAL_KG],
      [slotOf('local', 49), 1],
      [slotOf('local', 63), WORLDS_KG],
    ];
    const lifter = entrant(entries.map(([slot]) => slot));
    let record = createCareerRecord<TestTotal>();
    const unlocked: string[] = [];
    for (const [slot, total] of entries) {
      const before = careerStanding(record, 'mens', GATE);
      const outcome = recordMeetResult(record, lifter, slot, {
        total: kg(total),
        bodyweightKg: BODYWEIGHT_KG,
      });
      if (outcome.kind !== 'recorded') throw new Error('unreachable');
      record = outcome.record;
      const unlock = tierUnlockBetween(before, careerStanding(record, 'mens', GATE));
      if (unlock.kind === 'tier-unlocked') unlocked.push(unlock.to);
    }
    // Counts, not bounds: five meets, three crossings, and the two that
    // matched or dropped fired nothing.
    expect(unlocked).toEqual(['local', 'regional', 'worlds']);
    expect(entries.length).toBe(5);
  });
});

// ===========================================================================
// The gate's own shape
// ===========================================================================

describe('careerGateFaults', () => {
  it('says nothing about a gate that reads a total as a threshold', () => {
    const totals = [kg(1), kg(REGIONAL_KG), kg(NATIONALS_KG), kg(WORLDS_KG)];
    expect(careerGateFaults(GATE, totals, 'mens')).toEqual([]);
    expect(totals.length).toBe(4);
  });

  it('catches a gate whose pass-set is not a ladder', () => {
    // The property the standing math leans on and no type can carry. A band
    // gate — admits between the requirement and the next one up — passes
    // nationals while refusing regional, and the qualified tier stops meaning
    // "and everything below it".
    //
    // Reddens on: deleting the downward-closure walk in `careerGateFaults`.
    const band: CareerQualifyingGate<TestTotal> = (total, requiredKg) =>
      total.kg >= requiredKg && total.kg < requiredKg * 2;
    // 900 kg is inside the band above nationals and above worlds, and past the
    // top of the band above regional — so it is admitted at two tiers and
    // refused at one below them, which is exactly the shape the walk reports.
    const faults = careerGateFaults(band, [kg(900)], 'mens');
    expect(faults.length).toBe(2);
    expect(faults[0]).toMatch(/admits total #0 at nationals but refuses it at regional/);
    expect(faults[1]).toMatch(/admits total #0 at worlds but refuses it at regional/);
  });

  it('is not asking about the open tier', () => {
    // An open tier is met by any posted total, so it can never be the refused
    // half of a pair. The check would be vacuous on a table with no gated tier
    // at all, and this is what says the shipped table has one.
    expect(qualifyingTotalKgFor('local', 'mens')).toBeNull();
    expect(qualifyingTotalKgFor('regional', 'mens')).not.toBeNull();
  });
});

// ===========================================================================
// Faults — the JSON path
// ===========================================================================

describe('careerRecordFaults', () => {
  it('says nothing about a record this module built', () => {
    const record = historyOf([
      [slotOf('local', 7), 500],
      [slotOf('local', 21), null],
    ]);
    expect(careerRecordFaults(record)).toEqual([]);
    expect(record.results.length).toBe(2);
  });

  it('catches every way a record can arrive wrong', () => {
    // Reddens on: deleting any branch of `careerRecordFaults`. Each payload is
    // one no constructor here can produce and JSON can.
    const good = (historyOf([[slotOf('local', 7), 500]]).results[0]) as CareerMeetResult<TestTotal>;
    const later = (historyOf([[slotOf('local', 21), 500]]).results[0]) as CareerMeetResult<TestTotal>;
    const cases: readonly (readonly [string, CareerRecord<TestTotal>, RegExp])[] = [
      ['duplicate slot', { results: [good, good] }, /two results for/],
      [
        'unknown tier',
        { results: [{ ...good, tier: 'masters' as CareerTier }] },
        /not on the ladder/,
      ],
      [
        'unknown federation',
        { results: [{ ...good, federationId: 'nope' as CareerMeetResult<TestTotal>['federationId'] }] },
        /does not exist/,
      ],
      ['fractional day', { results: [{ ...good, dayIndex: 7.5 }] }, /whole number of days/],
      ['negative day', { results: [{ ...good, dayIndex: -1 }] }, /whole number of days/],
      ['out of order', { results: [later, good] }, /before the result ahead of it/],
      ['no weigh-in', { results: [{ ...good, bodyweightKg: 0 }] }, /which is not a weigh-in/],
    ];
    let covered = 0;
    for (const [label, record, pattern] of cases) {
      expect(careerRecordFaults(record).join('\n'), label).toMatch(pattern);
      covered += 1;
    }
    expect(covered).toBe(7);
  });
});

describe('careerHistoryFaults', () => {
  it('says nothing about a record and a lifter this module built', () => {
    const slots = [slotOf('local', 7), slotOf('local', 21)];
    const record = historyOf([
      [slots[0] as CareerMeetSlot, 500],
      [slots[1] as CareerMeetSlot, 500],
    ]);
    expect(careerHistoryFaults(record, entrant(slots))).toEqual([]);
  });

  it('catches a record assembled from somebody else’s meets', () => {
    // Reddens on: deleting any branch. Each is a shape two rows joined wrongly
    // would produce, and none of them is a type error.
    const record = historyOf([[slotOf('local', 7), 500]]);
    const good = record.results[0] as CareerMeetResult<TestTotal>;
    const lifter = entrant([slotOf('local', 7)]);
    const cases: readonly (readonly [string, CareerRecord<TestTotal>, CareerLifter<TestTotal>, RegExp])[] = [
      [
        'never entered',
        record,
        createCareerLifter<TestTotal>(FED.id, 'mens'),
        /which the lifter never entered/,
      ],
      [
        'other federation',
        { results: [{ ...good, federationId: OTHER_FED.id }] },
        lifter,
        /and the lifter is in/,
      ],
      [
        'after the last entry',
        { results: [{ ...good, dayIndex: 400 }] },
        lifter,
        /after the lifter's last entry/,
      ],
    ];
    let covered = 0;
    for (const [label, held, who, pattern] of cases) {
      expect(careerHistoryFaults(held, who).join('\n'), label).toMatch(pattern);
      covered += 1;
    }
    expect(covered).toBe(3);
  });
});

// ===========================================================================
// The loop the wiring piece runs
// ===========================================================================

describe('lifterWithStanding feeds the next meet’s gate', () => {
  it('writes the qualifying total and nothing else', () => {
    // Reddens on: `lifterWithStanding` touching `enteredSlotIds` or
    // `lastEntryDayIndex`, which are `enterMeet`'s and not this function's.
    const slots = [slotOf('local', 7)];
    const lifter = entrant(slots);
    const standing = careerStanding(historyOf([[slots[0] as CareerMeetSlot, NATIONALS_KG]]), 'mens', GATE);
    const after = lifterWithStanding(lifter, standing);
    expect(after.bestTotal).toEqual(kg(NATIONALS_KG));
    expect({ ...after, bestTotal: null }).toEqual({ ...lifter, bestTotal: null });
  });

  it('turns a total posted at a local meet into entry to a gated one', () => {
    // The composed loop, end to end: a lifter with no total may enter `local`
    // and not `regional`; after a big enough total there, `regional` opens.
    //
    // Reddens on: `lifterWithStanding` writing `null`, or `careerStanding`
    // reporting a qualifying total the gate would refuse.
    const local = slotOf('local', 7);
    const regional = slotOf('regional', 21);
    const fresh = createCareerLifter<TestTotal>(FED.id, 'mens');
    expect(meetEligibility(regional, fresh, 0, GATE).kind).toBe('no-recorded-total');

    const entered = enterMeet(fresh, local, 0, GATE);
    if (entered.kind !== 'entered') throw new Error('unreachable');
    const outcome = recordMeetResult(createCareerRecord<TestTotal>(), entered.lifter, local, {
      total: kg(REGIONAL_KG),
      bodyweightKg: BODYWEIGHT_KG,
    });
    if (outcome.kind !== 'recorded') throw new Error('unreachable');
    const standing = careerStanding(outcome.record, 'mens', GATE);
    const ready = lifterWithStanding(entered.lifter, standing);

    expect(meetEligibility(regional, ready, 21, GATE)).toEqual({ kind: 'eligible' });
    // And the gap rule still applies to them, so this is not a bypass: the
    // local meet a week later is inside their window.
    expect(CAREER_TUNING.MIN_DAYS_BETWEEN_ENTERED_MEETS).toBeGreaterThan(
      CAREER_TUNING.MEET_INTERVAL_DAYS_BY_TIER.local,
    );
    expect(meetEligibility(slotOf('local', 14), ready, 14, GATE).kind).toBe(
      'too-soon-after-last-meet',
    );
  });
});
