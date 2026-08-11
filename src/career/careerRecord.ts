/**
 * careerRecord.ts — what a lifter has already competed at, and where that
 * leaves them on GDD §6.1's ladder.
 *
 * `careerCore.ts` decides which meets a lifter MAY enter. This file is the
 * other half of §6.1's sentence: the history of the ones they actually
 * contested, and the standing derived from it. Two named sites in the tree are
 * blocked on exactly these two facts and each names a different one:
 *
 *   - `src/meet/useMeetDay.ts` and `src/session/localSessionServer.test.ts`:
 *     "a calendar knows which meets a lifter has already competed at". That is
 *     `hasCompetedAt`.
 *   - `src/cutin/cutInGate.ts` §5 and `src/meet/RecapView.tsx`: §7.2's third
 *     PR sub-moment, `record: 'tier'`, is "a fact about a lifter's standing
 *     across meets". That is `CareerStanding.qualifiedTier` and the transition
 *     `tierUnlockBetween` reports.
 *
 * Nothing here is wired to any of them. Those four files are another session's
 * and this piece produces the fact rather than the wiring; the shape a wiring
 * piece consumes is section 4 below.
 *
 * Pure module (CLAUDE.md, "Pure logic is separate from UI"): zero React, zero
 * side effects, zero I/O, no clock, no randomness. Its imports are its two
 * siblings, so every number it uses is `careerTuning.ts`'s.
 *
 * ===========================================================================
 * 1. Entered is not competed, and the two live in different places
 * ===========================================================================
 *
 * `CareerLifter.enteredSlotIds` is a list of intentions: meets a lifter has
 * signed up for, some of them in the future. A `CareerRecord` is a list of
 * things that happened. They are separate values rather than one because the
 * questions differ — eligibility asks the first ("you are already in this
 * meet"), a recap and a result-server ask the second ("this competition is
 * already banked") — and because `CareerLifter`'s field list is pinned in
 * `careerCore.test.ts` to keep anything a player does daily off it.
 *
 * A result may only be recorded for a slot the lifter entered, so the record is
 * a subset of the intentions rather than a second, independent history.
 *
 * ===========================================================================
 * 2. A bombed meet is a competed meet
 * ===========================================================================
 *
 * GDD §6.3's bomb-out is three misses on one lift and no total. `total` is
 * therefore `Total | null` and a `null` is not a missing field — it is the
 * lifter having competed and posted nothing. `meetsCompleted` counts it,
 * `highestTierCompeted` counts it, and `totalsPosted` does not. A model that
 * dropped bombed meets from the record would make `hasCompetedAt` answer "no"
 * about a competition the lifter definitely contested, which is the exact
 * question `useMeetDay.ts` is blocked on.
 *
 * ===========================================================================
 * 3. Standing is computed with the injected gate, and never by comparing
 * ===========================================================================
 *
 * `Total` is opaque here for the reason `careerCore.ts`'s header gives: the
 * wiring piece binds it to `progression.ts`'s `ConfirmedTotalKg` and passes
 * `meetsQualifyingTotal` itself, so the confirmed-total fence is enforced by
 * the real function rather than re-implemented by a weaker one. This file adds
 * a "best" to that arrangement without adding an ordering, which is worth
 * spelling out because "best total" sounds like it needs one:
 *
 *   the tier a total qualifies for is the highest tier whose requirement the
 *   INJECTED GATE admits it at, and the standing's qualifying total is the
 *   first total on the record that reached the highest such tier.
 *
 * No `>` on a `Total` appears here and none would compile — and that sentence
 * used to be the whole of the claim, which was not enough. The direct form is
 * refused by `tsc --noEmit`, WHICH IS A SEPARATE COMMAND FROM THE SUITE; a
 * laundered one such as `Number(total) >= requiredKg` compiles, and was measured
 * to turn nothing red. `careerOpacity.test.ts` is what closes it, on both a
 * behavioural axis and a syntactic one; see `careerCore.ts`'s header, section 3,
 * for the measurement and for what is still not enforced.
 *
 * The first version of that file was bypassed too, by a four-line mutant keyed
 * on the total's printed digit width, because its probe used two totals and
 * both sat outside the band real totals live in. What replaced it sweeps a band
 * across every threshold and adds a substitution probe, and the functions in
 * THIS file are in it by name: `qualifiedTierFor`, `careerStanding`,
 * `standingAsOf`, `tierUnlockBetween`, `lifterWithStanding` and
 * `careerGateFaults` each have to give the same answer when the total is
 * swapped and the gate's answers are held fixed.
 *
 * MUTATION WITNESS. Mutant, planted above the gate call in `qualifiedTierFor`:
 * `if (Number(total) >= requiredKg) return tier;`. Reddened:
 * `expect(qualifiedTierFor(HUGE_TOTAL_KG, 'mens', REFUSING_GATE)).toBe('local')`
 * inside `reads no number out of a numeric total when it walks the ladder`, and
 * `expect(findings.join('\n')).toBe('')` inside `finds nothing in any shipped
 * module`.
 *
 * What that costs is
 * stated rather than hidden: two totals that qualify for the same tier are
 * interchangeable to this file, and it picks the earlier. That is not an
 * approximation for the use this fact is put to — `meetEligibility` only ever
 * asks the gate about a TIER'S requirement, so two totals qualifying for the
 * same tier admit the same set of meets — but it is an approximation if
 * something later wants "their biggest total" to print on a card. Something
 * that wants a number to print should read the result, not the standing.
 *
 * That argument leans on one property of the injected gate: a total that
 * passes a higher tier's requirement also passes every lower one. It is true of
 * `total >= requiredKg` and it is not enforceable by a type, so it is checkable
 * instead — `careerGateFaults` takes a gate and some totals and reports every
 * total whose pass-set is not downward closed on the ladder. A wiring piece
 * that injects something exotic can run it.
 *
 * ===========================================================================
 * 4. What a wiring piece consumes
 * ===========================================================================
 *
 *   - the already-competed question: `hasCompetedAt(record, slotId)`, and
 *     `resultFor` when the answer needs to carry the day and the total.
 *   - the write: `recordMeetResult(record, lifter, slot, contest)`, which
 *     returns a new record or a refusal carrying the reason. It does not write
 *     progression: whether a recorded result becomes server truth is a
 *     progression intent and belongs on the far side of the seam.
 *   - the cut-in fact: `careerStanding(record, category, gate)` before and
 *     after the write, then `tierUnlockBetween(before, after)`. A
 *     `'tier-unlocked'` verdict is §7.2's third PR sub-moment with the tier it
 *     was unlocked to; `{ kind: 'none' }` is a recap with no tier PR on it.
 *   - the next meet's gate input: `lifterWithStanding(lifter, standing)`,
 *     which carries the qualifying total onto the value `meetEligibility`
 *     reads. It writes `bestTotal` and nothing else.
 *
 * ===========================================================================
 * 5. What this module does not do
 * ===========================================================================
 *
 *   - It does not score. No DOTS, no Wilks, no e1RM, no coefficient. Those are
 *     published domain data in `src/game/dots.ts` and `src/game/e1rm.ts` and
 *     this directory does not import them. What standing carries instead is the
 *     INPUTS a score needs — the qualifying total and the bodyweight it was
 *     made at — so a wiring piece can hand them to the real function.
 *   - It does not decide what happened at a meet. Squat, bench, deadlift, three
 *     attempts each, the total as the sum of the best successful attempt per
 *     lift, and attempts that may not go down within a lift are `src/game/`'s
 *     and are not restated here. A `CareerContest` is the outcome of all that,
 *     arriving already decided.
 *   - It does not rank a lifter against a field. Placings need the other
 *     entrants, and a calendar does not have them.
 */

import {
  careerFederation,
  careerTierRank,
  isCareerTier,
  qualifyingTotalKgFor,
  type CareerFederationId,
  type CareerLifter,
  type CareerMeetSlot,
  type CareerQualifyingCategory,
  type CareerQualifyingGate,
  type CareerTier,
} from './careerCore';
import { CAREER_TUNING } from './careerTuning';

// ---------------------------------------------------------------------------
// The record
// ---------------------------------------------------------------------------

/**
 * One meet a lifter has contested.
 *
 * The four calendar fields are copied off the slot by `recordMeetResult` rather
 * than supplied, so a result cannot claim a tier, a federation or a day its
 * slot disagrees with.
 *
 * MUTATION WITNESS. Mutant, in `recordMeetResult`:
 * `tier: 'local' as typeof slot.tier,`. Reddened, inside `takes the four
 * calendar fields off the slot, so they cannot disagree`, the four-field
 * equality whose expected side reads `tier: slot.tier,` — plus nine other tests.
 */
export interface CareerMeetResult<Total> {
  readonly slotId: string;
  readonly tier: CareerTier;
  readonly federationId: CareerFederationId;
  /** The day the meet was contested. Whole days from the career's day zero. */
  readonly dayIndex: number;
  /** The total posted, or `null` for a bomb-out. See the header, section 2. */
  readonly total: Total | null;
  /** Weigh-in bodyweight. Carried for a score this module does not compute. */
  readonly bodyweightKg: number;
}

/**
 * Every meet a lifter has competed at, oldest first.
 *
 * A record rather than a bare array so a later field — a season, a division
 * change — is an addition rather than a shape change at every call site.
 */
export interface CareerRecord<Total> {
  readonly results: readonly CareerMeetResult<Total>[];
}

/** What happened on the platform, arriving already decided. */
export interface CareerContest<Total> {
  readonly total: Total | null;
  readonly bodyweightKg: number;
}

/** Why a result was not recorded. Carries the numbers a screen would need. */
export type CareerResultRefusal =
  | { readonly kind: 'not-entered'; readonly slotId: string }
  | { readonly kind: 'already-competed'; readonly slotId: string; readonly onDayIndex: number }
  | { readonly kind: 'before-last-result'; readonly dayIndex: number; readonly lastResultDayIndex: number }
  | { readonly kind: 'unweighed'; readonly bodyweightKg: number };

/** Every `CareerResultRefusal` tag, for exhaustiveness checks. */
export const CAREER_RESULT_REFUSAL_KINDS = Object.freeze([
  'not-entered',
  'already-competed',
  'before-last-result',
  'unweighed',
] as const);

/** What recording a result did. */
export type CareerResultOutcome<Total> =
  | {
      readonly kind: 'recorded';
      readonly record: CareerRecord<Total>;
      readonly result: CareerMeetResult<Total>;
    }
  | { readonly kind: 'refused'; readonly reason: CareerResultRefusal };

/** A lifter who has competed at nothing yet. */
export function createCareerRecord<Total>(): CareerRecord<Total> {
  return Object.freeze({ results: Object.freeze([]) });
}

/**
 * Has this lifter already competed at this meet?
 *
 * The question `src/meet/useMeetDay.ts` names as the fix for its second-meet
 * refusal, in its own words. A bombed meet answers `true`; see the header.
 */
export function hasCompetedAt<Total>(record: CareerRecord<Total>, slotId: string): boolean {
  return record.results.some((result) => result.slotId === slotId);
}

/** The result for a slot, or `null` if this lifter has not competed there. */
export function resultFor<Total>(
  record: CareerRecord<Total>,
  slotId: string,
): CareerMeetResult<Total> | null {
  return record.results.find((result) => result.slotId === slotId) ?? null;
}

/** Every slot this lifter has competed at, in the order they were recorded. */
export function competedSlotIds<Total>(record: CareerRecord<Total>): readonly string[] {
  return Object.freeze(record.results.map((result) => result.slotId));
}

/** The day of the latest result on the record, or `null` if there are none. */
export function lastResultDay<Total>(record: CareerRecord<Total>): number | null {
  let latest: number | null = null;
  for (const result of record.results) {
    if (latest === null || result.dayIndex > latest) latest = result.dayIndex;
  }
  return latest;
}

/**
 * Record what happened at a meet, or refuse with the reason.
 *
 * The refusal precedence is fixed and tested on cases where two of them are
 * true together, for the reason `meetEligibility` gives about its own: an order
 * nobody chose is an order that changes when the `if`s are reordered.
 *
 *   1. `not-entered`        — a fact about whether this lifter was in the meet
 *                             at all, before anything about the result.
 *   2. `already-competed`   — the competition is banked; say that before
 *                             quibbling with the day or the scale.
 *   3. `before-last-result` — a history that goes backwards is not a history.
 *   4. `unweighed`          — the narrowest, and the only one about the contest
 *                             rather than about the calendar.
 *
 * The four calendar fields come off the slot. A caller cannot pass a day, a
 * tier or a federation, so a result that disagrees with its own meet is not a
 * thing this function can produce.
 */
export function recordMeetResult<Total>(
  record: CareerRecord<Total>,
  lifter: CareerLifter<Total>,
  slot: CareerMeetSlot,
  contest: CareerContest<Total>,
): CareerResultOutcome<Total> {
  if (!lifter.enteredSlotIds.includes(slot.slotId)) {
    return { kind: 'refused', reason: { kind: 'not-entered', slotId: slot.slotId } };
  }
  const existing = resultFor(record, slot.slotId);
  if (existing !== null) {
    return {
      kind: 'refused',
      reason: { kind: 'already-competed', slotId: slot.slotId, onDayIndex: existing.dayIndex },
    };
  }
  const latest = lastResultDay(record);
  if (latest !== null && slot.dayIndex < latest) {
    return {
      kind: 'refused',
      reason: {
        kind: 'before-last-result',
        dayIndex: slot.dayIndex,
        lastResultDayIndex: latest,
      },
    };
  }
  if (!Number.isFinite(contest.bodyweightKg) || contest.bodyweightKg <= 0) {
    return { kind: 'refused', reason: { kind: 'unweighed', bodyweightKg: contest.bodyweightKg } };
  }

  const result: CareerMeetResult<Total> = Object.freeze({
    slotId: slot.slotId,
    tier: slot.tier,
    federationId: slot.federationId,
    dayIndex: slot.dayIndex,
    total: contest.total,
    bodyweightKg: contest.bodyweightKg,
  });
  return Object.freeze({
    kind: 'recorded',
    result,
    record: Object.freeze({ results: Object.freeze([...record.results, result]) }),
  });
}

// ---------------------------------------------------------------------------
// Standing across meets
// ---------------------------------------------------------------------------

/**
 * Where a lifter's history leaves them on the ladder.
 *
 * `qualifiedTier` is the fact `src/cutin/cutInGate.ts` §5 and
 * `src/meet/RecapView.tsx` are blocked on, and `qualifiedAboveCompeted` is that
 * fact in the form §7.2's "qualifying for a higher tier" asks for.
 *
 * `qualifyingTotal` and `qualifyingBodyweightKg` are the inputs a DOTS score
 * needs, carried rather than scored — see the header, section 5.
 */
export interface CareerStanding<Total> {
  /** Meets contested, bombed ones included. */
  readonly meetsCompleted: number;
  readonly totalsPosted: number;
  readonly bombOuts: number;
  /** The highest tier this lifter has stood on a platform at, or `null`. */
  readonly highestTierCompeted: CareerTier | null;
  readonly lastResultDayIndex: number | null;
  /** The highest tier a posted total qualifies for, or `null` before the first. */
  readonly qualifiedTier: CareerTier | null;
  /** The total that reached `qualifiedTier`, earliest first. Never compared here. */
  readonly qualifyingTotal: Total | null;
  readonly qualifyingBodyweightKg: number | null;
  /** The day `qualifiedTier` was first reached, or `null`. */
  readonly qualifiedOnDayIndex: number | null;
  /** §7.2's "qualifying for a higher tier": standing is above what was competed. */
  readonly qualifiedAboveCompeted: boolean;
}

/**
 * The highest tier this total qualifies for, or `null` for none.
 *
 * Walks the ladder from the top down and returns the first tier the injected
 * gate admits. An open tier — one whose requirement is `null` — is met by any
 * posted total, so on the shipped table this returns at worst `local`; on a
 * table where every tier is gated it can return `null`, and the callers treat
 * that as "no standing" rather than as an error.
 */
export function qualifiedTierFor<Total>(
  total: Total,
  category: CareerQualifyingCategory,
  gate: CareerQualifyingGate<Total>,
): CareerTier | null {
  const tiers = CAREER_TUNING.MEET_TIERS;
  for (let i = tiers.length - 1; i >= 0; i -= 1) {
    const tier = tiers[i] as CareerTier;
    const requiredKg = qualifyingTotalKgFor(tier, category);
    if (requiredKg === null) return tier;
    if (gate(total, requiredKg)) return tier;
  }
  return null;
}

/** The rank of a tier, with `null` — no tier at all — below `local`. */
export function standingRank(tier: CareerTier | null): number {
  return tier === null ? -1 : careerTierRank(tier);
}

/** Standing over an already-filtered list of results, read in list order. */
function standingOver<Total>(
  results: readonly CareerMeetResult<Total>[],
  category: CareerQualifyingCategory,
  gate: CareerQualifyingGate<Total>,
): CareerStanding<Total> {
  let meetsCompleted = 0;
  let totalsPosted = 0;
  let bombOuts = 0;
  let highestTierCompeted: CareerTier | null = null;
  let lastResultDayIndex: number | null = null;
  let qualifiedTier: CareerTier | null = null;
  let qualifyingTotal: Total | null = null;
  let qualifyingBodyweightKg: number | null = null;
  let qualifiedOnDayIndex: number | null = null;

  for (const result of results) {
    meetsCompleted += 1;
    if (lastResultDayIndex === null || result.dayIndex > lastResultDayIndex) {
      lastResultDayIndex = result.dayIndex;
    }
    if (standingRank(result.tier) > standingRank(highestTierCompeted)) {
      highestTierCompeted = result.tier;
    }
    if (result.total === null) {
      bombOuts += 1;
      continue;
    }
    totalsPosted += 1;
    const tier = qualifiedTierFor(result.total, category, gate);
    if (standingRank(tier) > standingRank(qualifiedTier)) {
      qualifiedTier = tier;
      qualifyingTotal = result.total;
      qualifyingBodyweightKg = result.bodyweightKg;
      qualifiedOnDayIndex = result.dayIndex;
    }
  }

  return Object.freeze({
    meetsCompleted,
    totalsPosted,
    bombOuts,
    highestTierCompeted,
    lastResultDayIndex,
    qualifiedTier,
    qualifyingTotal,
    qualifyingBodyweightKg,
    qualifiedOnDayIndex,
    qualifiedAboveCompeted: standingRank(qualifiedTier) > standingRank(highestTierCompeted),
  });
}

/**
 * Where this record leaves the lifter, over the whole of it.
 *
 * Reads the results in list order, so `qualifiedOnDayIndex` is the earliest day
 * the top tier was reached exactly when the list is day-ascending.
 * `recordMeetResult` cannot build one that is not; `careerRecordFaults` reports
 * one that arrived as JSON and is.
 */
export function careerStanding<Total>(
  record: CareerRecord<Total>,
  category: CareerQualifyingCategory,
  gate: CareerQualifyingGate<Total>,
): CareerStanding<Total> {
  return standingOver(record.results, category, gate);
}

/**
 * Standing as it was on a given day: the same reading over the results on or
 * before `throughDayIndex`.
 *
 * The element-wise reading the engagement measurement compares. A standing read
 * only at the end of a history cannot see an ordering that made a lifter worse
 * off in the middle and recovered by the horizon.
 */
export function standingAsOf<Total>(
  record: CareerRecord<Total>,
  throughDayIndex: number,
  category: CareerQualifyingCategory,
  gate: CareerQualifyingGate<Total>,
): CareerStanding<Total> {
  return standingOver(
    record.results.filter((result) => result.dayIndex <= throughDayIndex),
    category,
    gate,
  );
}

/**
 * §7.2's third PR sub-moment: the standing crossed onto a higher tier.
 *
 * `from` is the tier the lifter was qualified for before, `null` if this is
 * their first. A screen offers a `'tier-unlocked'` verdict to the cut-in gate
 * as `record: 'tier'` and offers nothing on `'none'`.
 */
export type CareerTierUnlock =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'tier-unlocked';
      readonly from: CareerTier | null;
      readonly to: CareerTier;
      readonly onDayIndex: number | null;
    };

/** Whether standing rose onto a higher tier between two readings. */
export function tierUnlockBetween<Total>(
  before: CareerStanding<Total>,
  after: CareerStanding<Total>,
): CareerTierUnlock {
  if (after.qualifiedTier === null) return { kind: 'none' };
  if (standingRank(after.qualifiedTier) <= standingRank(before.qualifiedTier)) {
    return { kind: 'none' };
  }
  return Object.freeze({
    kind: 'tier-unlocked',
    from: before.qualifiedTier,
    to: after.qualifiedTier,
    onDayIndex: after.qualifiedOnDayIndex,
  });
}

/**
 * The lifter with their standing's qualifying total on them, for the gate.
 *
 * Writes `bestTotal` and nothing else — the entered list and the entry day are
 * `enterMeet`'s and are not this function's to move. See the header, section 3,
 * for why the qualifying total is the right value to carry and what it is not
 * (it is not "their biggest total to print on a card").
 *
 * MUTATION WITNESS. Mutant: `return Object.freeze({ ...lifter, bestTotal:
 * standing.qualifyingTotal, lastEntryDayIndex: standing.lastResultDayIndex });`.
 * Reddened: `expect({ ...after, bestTotal: null }).toEqual({ ...lifter,
 * bestTotal: null })` inside `writes the qualifying total and nothing else`.
 *
 * That mutant survived the FIRST time it was run, and the reason is recorded in
 * that test: its fixture gave the lifter one entered meet and one result on the
 * same day, so `lastEntryDayIndex` and `lastResultDayIndex` were the same number
 * and writing one over the other changed nothing. The claim was accurate, the
 * assertion was real, and the domain could not reach the failing case.
 */
export function lifterWithStanding<Total>(
  lifter: CareerLifter<Total>,
  standing: CareerStanding<Total>,
): CareerLifter<Total> {
  return Object.freeze({ ...lifter, bestTotal: standing.qualifyingTotal });
}

// ---------------------------------------------------------------------------
// Checks on things the types do not check
// ---------------------------------------------------------------------------

/**
 * Every total whose pass-set on the ladder is not downward closed.
 *
 * The property the standing math leans on and no type can carry: a total that
 * passes a higher tier's requirement passes every lower one. True of
 * `total >= requiredKg`; not true of, say, a band. A total is named by its
 * index rather than by its value, because a `Total` is opaque here and
 * stringifying one would be this module looking inside it.
 *
 * MUTATION WITNESS for that last sentence, which used to be enforced by nothing.
 * Mutant, on the fault message below: `career: the injected gate admits total
 * ${total} at ${tiers[high]} but refuses it at `. Reddened, in
 * `careerOpacity.test.ts`: `expect(faults.join('\n')).not.toMatch(new
 * RegExp(String(HUGE_TOTAL_KG)))` inside `asks the gate about a numeric total
 * rather than ordering totals itself`, and `expect(findings.join('\n')).toBe('')`
 * inside `finds nothing in any shipped module`.
 */
export function careerGateFaults<Total>(
  gate: CareerQualifyingGate<Total>,
  totals: readonly Total[],
  category: CareerQualifyingCategory,
): readonly string[] {
  const faults: string[] = [];
  const tiers = CAREER_TUNING.MEET_TIERS;
  for (let index = 0; index < totals.length; index += 1) {
    const total = totals[index] as Total;
    const admits = tiers.map((tier) => {
      const requiredKg = qualifyingTotalKgFor(tier, category);
      return requiredKg === null || gate(total, requiredKg);
    });
    for (let high = 0; high < tiers.length; high += 1) {
      if (!admits[high]) continue;
      for (let low = 0; low < high; low += 1) {
        if (admits[low]) continue;
        faults.push(
          `career: the injected gate admits total #${index} at ${tiers[high]} but refuses it at ` +
            `${tiers[low]}, so this lifter's qualifying tier is not a rung on a ladder`,
        );
      }
    }
  }
  return faults;
}

/**
 * Everything wrong with a record, as sentences, or an empty list.
 *
 * `recordMeetResult` cannot produce any of these. This is for the other path:
 * a record that arrived as JSON from an Edge Function, where the types above
 * are not a check.
 */
export function careerRecordFaults<Total>(record: CareerRecord<Total>): readonly string[] {
  const faults: string[] = [];
  const seen = new Set<string>();
  let previousDay: number | null = null;

  for (const result of record.results) {
    if (seen.has(result.slotId)) {
      faults.push(`career: the record holds two results for ${result.slotId}`);
    }
    seen.add(result.slotId);

    if (!isCareerTier(result.tier)) {
      faults.push(
        `career: result ${result.slotId} has tier ${result.tier}, which is not on the ladder`,
      );
    }
    if (careerFederation(result.federationId) === null) {
      faults.push(
        `career: result ${result.slotId} names federation ${result.federationId}, which does not exist`,
      );
    }
    if (!Number.isInteger(result.dayIndex) || result.dayIndex < 0) {
      faults.push(
        `career: result ${result.slotId} sits on day ${result.dayIndex}, which is not a whole number of days from day zero`,
      );
    } else {
      if (previousDay !== null && result.dayIndex < previousDay) {
        faults.push(
          `career: result ${result.slotId} sits on day ${result.dayIndex}, before the result ahead of it on day ${previousDay}`,
        );
      }
      previousDay = result.dayIndex;
    }
    if (!Number.isFinite(result.bodyweightKg) || result.bodyweightKg <= 0) {
      faults.push(
        `career: result ${result.slotId} was made at a bodyweight of ${result.bodyweightKg} kg, which is not a weigh-in`,
      );
    }
  }
  return faults;
}

/**
 * Everything the record and the lifter disagree about.
 *
 * Separate from `careerRecordFaults` because it needs both values and because
 * a caller holding only a record can still run that one. A result for a slot
 * the lifter never entered is the fault this exists for: it is what a record
 * assembled from two different lifters' rows looks like.
 */
export function careerHistoryFaults<Total>(
  record: CareerRecord<Total>,
  lifter: CareerLifter<Total>,
): readonly string[] {
  const faults: string[] = [];
  for (const result of record.results) {
    if (!lifter.enteredSlotIds.includes(result.slotId)) {
      faults.push(`career: the record holds a result for ${result.slotId}, which the lifter never entered`);
    }
    if (result.federationId !== lifter.federationId) {
      faults.push(
        `career: the record holds a result under federation ${result.federationId}, and the lifter is in ${lifter.federationId}`,
      );
    }
    if (lifter.lastEntryDayIndex !== null && result.dayIndex > lifter.lastEntryDayIndex) {
      faults.push(
        `career: the record holds a result on day ${result.dayIndex}, after the lifter's last entry on day ${lifter.lastEntryDayIndex}`,
      );
    }
  }
  return faults;
}
