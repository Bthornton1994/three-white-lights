/**
 * eligibility.ts — which meets a lifter may enter, given their best Total.
 *
 * GDD §6.1: meets are "gated by qualifying totals". GDD §6.6: "Entry gated by
 * qualifying total earned in async meets". GDD §2's currency table: Total moves
 * on MEET RESULTS ONLY and is `null` until the first meet, which is why the
 * entry tier asks for nothing.
 *
 * ---------------------------------------------------------------------------
 * 1. TWO QUESTIONS, KEPT APART
 * ---------------------------------------------------------------------------
 *   - `qualifiesFor` — has this lifter earned the right to enter this meet?
 *     Reads the federation and the best Total. Nothing else.
 *   - `entryVerdict` — can they enter it right now? Adds the two facts that
 *     have nothing to do with how strong they are: the meet has been held, or
 *     they already competed at it.
 *
 * The split is the load-bearing part of this module rather than tidiness. GDD
 * §12.3 refuses a setback that punishes a player for showing up, and the
 * property that discharges it is about QUALIFICATION: getting stronger, or
 * competing more, must not shrink the set of meets you qualify for. Entering a
 * dated event does consume it, which is not a punishment and would look like
 * one if the two questions were one function.
 *
 * A HIGHER BEST TOTAL NEVER QUALIFIES FOR FEWER MEETS. Measured rather than
 * argued: every ordered pair on a grid of 402 best totals, compared over the 84
 * meets a season holds. 80601 pairs, 0 of them violating, and 55301 of them
 * pairs where the stronger lifter qualified for something the weaker did not —
 * which is what says the comparison had a domain to run on. The control beside
 * it is a rule letting a lifter enter only the highest tier they have reached,
 * which is a real anti-sandbagging idea somebody could have written: on the same
 * grid it violates on 55301 pairs and costs a stronger lifter as many as 53
 * meets. `@guarantee strength-never-removes-a-meet`
 *
 * COMPETING AT ONE MORE MEET NEVER QUALIFIES FOR FEWER EITHER, and it is the
 * same measurement on the other axis: 24 seeded seasons of 14 meets, every
 * skipped meet against every later moment, 2520 pairs, 0 violating, 78 of them
 * pairs where the lifter who competed more qualified for strictly more. The
 * control is qualification reading the latest total instead of the best, which
 * is how a current-form gate reads: 24 violating pairs, and a lifter who
 * competed one extra time loses as many as 26 meets. The sweep's own totals go
 * down 126 times, which is what keeps that control's domain from being empty.
 * `@guarantee attending-a-meet-never-removes-one`
 *
 * ---------------------------------------------------------------------------
 * 2. THE PAY-TO-WIN BOUNDARY, AS A TYPE
 * ---------------------------------------------------------------------------
 * GDD §12.3's first refusal condition is anything purchasable that affects meet
 * performance. Which meets you may enter is upstream of every meet result you
 * will ever have, so a wallet reaching this module would be that condition with
 * an extra hop.
 *
 * `CAREER_LIFTER_KEYS` is the complete set of facts eligibility may read, and
 * `CAREER_ELIGIBILITY_READS_NO_WALLET` is a compile-time proof that
 * `CareerLifter` has exactly those keys and no others. Adding a balance, a
 * token, an entitlement or a pass tier to the input type stops the build in
 * this file, under this comment. The same idiom as `streak.ts`'s
 * `RECOVERY_DAY_REACH_IS_STREAK_ONLY`, one subsystem over.
 *
 * WHAT THE TYPE CANNOT DO: it fences the INPUT, not the world. A caller may
 * still compute `bestTotalKg` from something bought, and no type in this file
 * would see it. What makes that unreachable today is that a Total is written by
 * meet results only (GDD §2, §6.4) and nothing in the game sells one.
 *
 * ---------------------------------------------------------------------------
 * 3. WHAT A CAREER RECORD IS NOT
 * ---------------------------------------------------------------------------
 * `CareerLifter` is a local read model, not progression state. It mirrors two
 * numbers the server owns — the competition Total and which meets are on the
 * lifter's record — and it invents neither: `careerRecordAfterMeet` takes the
 * total it is given. Wiring this to `src/game/progression.ts` is a separate,
 * deliberately serialised piece, and until it lands nothing here may be treated
 * as a source of truth for a Total.
 */

import type { StreakDay } from '../game/streak';
import { CAREER_COPY, MEET_TIER_ORDER, type CareerFederationId, type CareerMeetTier } from './careerTuning';
import {
  qualifyingTotalKgFor,
  scheduledMeets,
  upcomingMeets,
  type CareerMeet,
} from './calendar';

// ---------------------------------------------------------------------------
// The lifter, and the fence around what eligibility may read
// ---------------------------------------------------------------------------

/**
 * `true` only when `T` has exactly `Keys` and nothing else. The same type-level
 * idiom `streak.ts` and `progression.ts` each declare for their own allowlists.
 */
type KeysAreExactly<T, Keys extends string> = [Exclude<keyof T, Keys>] extends [never]
  ? [Exclude<Keys, keyof T>] extends [never]
    ? true
    : never
  : never;

/** Every fact eligibility is allowed to read about a lifter. */
export const CAREER_LIFTER_KEYS = ['federationId', 'bestTotalKg', 'enteredMeetIds'] as const;

export type CareerLifterKey = (typeof CAREER_LIFTER_KEYS)[number];

export interface CareerLifter {
  /** GDD §2.1's choice. Selects the calendar and can refuse an entry. */
  readonly federationId: CareerFederationId;
  /**
   * The best competition Total on record, in kilograms, or `null` before the
   * first meet. GDD §2: it moves on meet results only.
   */
  readonly bestTotalKg: number | null;
  /** `CareerMeet.id` for every meet already competed at. */
  readonly enteredMeetIds: readonly string[];
}

/** See §2 of the header. Adding a purchasable field to `CareerLifter` fails here. */
export const CAREER_ELIGIBILITY_READS_NO_WALLET: KeysAreExactly<CareerLifter, CareerLifterKey> = true;

// ---------------------------------------------------------------------------
// Qualification
// ---------------------------------------------------------------------------

/**
 * Does this total clear this bar?
 *
 * `null` bar: an open tier, cleared by everyone including a lifter with no
 * total. `null` total: no meet result yet, so only an open tier is cleared.
 * The comparison is `>=`, because a qualifying total is a total you have to
 * make rather than beat.
 *
 * @throws {RangeError} on a total that is not a finite number.
 */
export function meetsQualifyingTotal(
  bestTotalKg: number | null,
  qualifyingTotalKg: number | null,
): boolean {
  if (bestTotalKg !== null && !Number.isFinite(bestTotalKg)) {
    throw new RangeError(`career: a best total must be a finite number of kg, received ${bestTotalKg}`);
  }
  if (qualifyingTotalKg === null) return true;
  if (bestTotalKg === null) return false;
  return bestTotalKg >= qualifyingTotalKg;
}

/** Every tier this total qualifies for, lowest first. */
export function qualifiedTiers(bestTotalKg: number | null): readonly CareerMeetTier[] {
  return MEET_TIER_ORDER.filter((tier) => meetsQualifyingTotal(bestTotalKg, qualifyingTotalKgFor(tier)));
}

/**
 * Has this lifter earned the right to enter this meet?
 *
 * Reads the federation and the total, and nothing about the day or about what
 * they have already done. See §1 of the header for why.
 */
export function qualifiesFor(lifter: CareerLifter, meet: CareerMeet): boolean {
  if (lifter.federationId !== meet.federationId) return false;
  return meetsQualifyingTotal(lifter.bestTotalKg, meet.qualifyingTotalKg);
}

/** Every meet in `[fromDay, toDay]` this lifter qualifies for, soonest first. */
export function qualifiedMeets(
  lifter: CareerLifter,
  fromDay: StreakDay,
  toDay: StreakDay,
): readonly CareerMeet[] {
  return scheduledMeets(lifter.federationId, fromDay, toDay).filter((meet) => qualifiesFor(lifter, meet));
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

export const ENTRY_REFUSAL_REASONS = [
  'WRONG_FEDERATION',
  'ALREADY_ENTERED',
  'MEET_HAS_PASSED',
  'BELOW_QUALIFYING_TOTAL',
] as const;

export type EntryRefusalReason = (typeof ENTRY_REFUSAL_REASONS)[number];

/**
 * Every refusal has a sentence, checked at compile time rather than by
 * remembering. A fifth reason without copy stops the build here.
 */
export const EVERY_REFUSAL_HAS_COPY: KeysAreExactly<
  typeof CAREER_COPY.ENTRY_REFUSAL,
  EntryRefusalReason
> = true;

export type EntryVerdict =
  | { readonly kind: 'open' }
  | {
      readonly kind: 'refused';
      readonly reason: EntryRefusalReason;
      /** The sentence a screen shows, keyed to the reason it was refused for. */
      readonly sentence: string;
    };

function refused(reason: EntryRefusalReason): EntryVerdict {
  return { kind: 'refused', reason, sentence: CAREER_COPY.ENTRY_REFUSAL[reason] };
}

/**
 * Can this lifter enter this meet today?
 *
 * THE ORDER OF THE FOUR CHECKS IS A COPY DECISION AND NOT A LOGICAL ONE. Any of
 * them can be true at once — a passed meet in another federation you were never
 * strong enough for — and the order picks which sentence a player reads. It runs
 * from the fact furthest from the player's control to the one nearest it: whose
 * meet it is, whether they have already been, whether the day has gone, and
 * only then how strong they are. Nobody has watched a player read these.
 *
 * `today` is compared against the meet's own day: a meet is enterable ON its
 * day and refused from the day after. A meet with no time left is a different
 * refusal from a meet you are too weak for, and neither is a bug.
 */
export function entryVerdict(lifter: CareerLifter, meet: CareerMeet, today: StreakDay): EntryVerdict {
  if (lifter.federationId !== meet.federationId) return refused('WRONG_FEDERATION');
  if (lifter.enteredMeetIds.includes(meet.id)) return refused('ALREADY_ENTERED');
  if (today > meet.day) return refused('MEET_HAS_PASSED');
  if (!meetsQualifyingTotal(lifter.bestTotalKg, meet.qualifyingTotalKg)) {
    return refused('BELOW_QUALIFYING_TOTAL');
  }
  return { kind: 'open' };
}

/** Can they enter it, as a boolean, for a caller that does not want the reason. */
export function canEnter(lifter: CareerLifter, meet: CareerMeet, today: StreakDay): boolean {
  return entryVerdict(lifter, meet, today).kind === 'open';
}

/**
 * Every meet the lifter can enter from today to the end of the horizon,
 * soonest first. This is the list GDD §6.1's calendar screen draws.
 */
export function enterableMeets(
  lifter: CareerLifter,
  today: StreakDay,
  horizonDays?: number,
): readonly CareerMeet[] {
  return upcomingMeets(lifter.federationId, today, horizonDays).filter((meet) =>
    canEnter(lifter, meet, today),
  );
}

// ---------------------------------------------------------------------------
// Recording a meet
// ---------------------------------------------------------------------------

/**
 * The career read model after a meet the server has recorded.
 *
 * Two facts change and neither is invented here: the meet id joins the list,
 * and the best total takes the higher of what it was and what was lifted. BEST
 * rather than LATEST is the whole of this module's compliance with GDD §12.3's
 * "never punish daily engagement" — a bad day at a meet cannot cost a lifter a
 * meet they had already qualified for, because it cannot lower the number
 * qualification reads. `careerSweep.ts` keeps the latest-total reading as a
 * measured control rather than as an argument.
 *
 * Applying the same meet twice with the same total is the same as applying it
 * once: the id list stays a set and `Math.max` is idempotent. That is a
 * safeguard against a double-record, not a licence to rely on one.
 *
 * @throws {RangeError} on a total that is not a finite number.
 */
export function careerRecordAfterMeet(
  lifter: CareerLifter,
  meetId: string,
  totalKg: number,
): CareerLifter {
  if (!Number.isFinite(totalKg)) {
    throw new RangeError(`career: a meet total must be a finite number of kg, received ${totalKg}`);
  }
  const entered = lifter.enteredMeetIds.includes(meetId)
    ? lifter.enteredMeetIds
    : [...lifter.enteredMeetIds, meetId];
  return {
    federationId: lifter.federationId,
    bestTotalKg: lifter.bestTotalKg === null ? totalKg : Math.max(lifter.bestTotalKg, totalKg),
    enteredMeetIds: entered,
  };
}

/** A lifter who has just picked a federation: no total, no meets. */
export function newCareerLifter(federationId: CareerFederationId): CareerLifter {
  return { federationId, bestTotalKg: null, enteredMeetIds: [] };
}
