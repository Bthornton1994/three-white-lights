/**
 * federation.ts — GDD §2.1's federation choice, and what it does and does not
 * imply.
 *
 * §2.1 in full, on this subject: "Create a lifter, pick a federation (raw /
 * equipped / tested / untested), run training blocks, enter meets."
 *
 * ---------------------------------------------------------------------------
 * 1. ONE SENTENCE, TWO READINGS, AND THE ONE THIS MODULE TOOK
 * ---------------------------------------------------------------------------
 * The parenthetical can be read two ways and the document does not say which.
 *
 *   (a) FOUR FEDERATION KINDS. A slash-separated list of four things you pick
 *       between, the way you pick a class in an RPG.
 *   (b) TWO AXES, DESCRIBING WHAT A FEDERATION IS. Raw versus equipped is what
 *       a lifter is allowed to wear; tested versus untested is what the
 *       federation tests for. They are independent: all four combinations are
 *       real organisations in the real sport.
 *
 * This module takes (b), and it is a decision rather than a reading of the
 * document. Two reasons, one of them checkable:
 *
 *   - Reading (a) makes "raw" and "tested" alternatives, which they are not.
 *     A lifter is raw and tested, or raw and untested; the four words are not
 *     four points on one axis and a domain-literate player would notice.
 *   - Reading (b) costs nothing if (a) is what was meant. Four federations,
 *     one per combination, IS a four-way pick at the point of choosing — the
 *     structure underneath it is what changes, and only for whoever adds a
 *     fifth.
 *
 * The federations themselves are in `careerTuning.ts`, fictional, one per
 * combination.
 *
 * ---------------------------------------------------------------------------
 * 2. WHAT THE CHOICE IMPLIES, WHICH IS LESS THAN A READER WILL EXPECT
 * ---------------------------------------------------------------------------
 * The task this module was built for said: read the document before deciding
 * what the federation choice implies, and if the document does not say, report
 * it rather than filling it in. The document does not say, so what ships is the
 * smallest thing that makes the choice mean anything at all:
 *
 *   - it selects which meets are on your calendar (`calendar.ts`), and
 *   - it is the reason a meet can refuse an entry (`eligibility.ts`).
 *
 * It implies nothing about loading, judging, attempt selection, scoring or
 * progression. In particular EQUIPPED LIFTING IS NOT A MODE HERE. GDD §11 lists
 * "Equipped lifting: a mode, a cosmetic layer, or out of scope for v1?" as an
 * open question, so an equipped federation today is a label on a calendar and a
 * word on a card. Building the multi-ply carry-over that a real equipped meet
 * implies would be answering §11 by writing code, which is not this piece's to
 * answer.
 *
 * The same goes for testing policy. A tested federation tests for nothing,
 * because there is nothing in the game to test for, and inventing one would be
 * inventing a mechanic with a doping metaphor in it — a design decision with
 * more than a mechanical dimension to it, and squarely a human's.
 *
 * ---------------------------------------------------------------------------
 * 3. WHAT IT MAY NEVER IMPLY
 * ---------------------------------------------------------------------------
 * GDD §12.3 refuses anything purchasable that affects Total, e1RM, training
 * pace or meet performance. A federation is picked, not bought, and nothing
 * here prices one. The place that rule actually bites is `eligibility.ts`,
 * which is where a wallet would have to be read for a federation to become
 * purchasable power, and the type there is pinned closed against exactly that.
 */

import {
  CAREER_COPY,
  CAREER_FEDERATIONS,
  MEET_TIER_ORDER,
  type CareerFederation,
  type CareerFederationId,
  type CareerMeetTier,
  type CareerRuleset,
} from './careerTuning';

/** Every federation id, in the order the picker would show them. */
export const CAREER_FEDERATION_IDS: readonly CareerFederationId[] = Object.freeze(
  CAREER_FEDERATIONS.map((federation) => federation.id),
);

/**
 * The federation with this id.
 *
 * @throws {RangeError} if no federation has it. A career whose federation does
 * not resolve has no calendar and no eligibility, so failing loudly at the
 * lookup beats returning a default nobody chose.
 */
export function federationById(id: CareerFederationId): CareerFederation {
  const found = CAREER_FEDERATIONS.find((federation) => federation.id === id);
  if (found === undefined) {
    throw new RangeError(`career: no federation with id ${id}`);
  }
  return found;
}

/** The ruleset a federation runs under. */
export function rulesetOf(id: CareerFederationId): CareerRuleset {
  return federationById(id).ruleset;
}

/** Do two rulesets agree on both axes? */
export function isSameRuleset(a: CareerRuleset, b: CareerRuleset): boolean {
  return a.equipment === b.equipment && a.testing === b.testing;
}

/** Every federation running this ruleset. One each, at the shipped tuning. */
export function federationsWithRuleset(ruleset: CareerRuleset): readonly CareerFederation[] {
  return CAREER_FEDERATIONS.filter((federation) => isSameRuleset(federation.ruleset, ruleset));
}

/**
 * How a ruleset reads on a screen: "RAW / TESTED".
 *
 * Two labels rather than one word, which is the two-axis reading showing up in
 * the copy. If a human rules for reading (a) in §1, this is the function that
 * changes and the picker is the only caller.
 */
export function rulesetLabel(ruleset: CareerRuleset): string {
  const equipment = CAREER_COPY.EQUIPMENT_LABEL[ruleset.equipment];
  const testing = CAREER_COPY.TESTING_LABEL[ruleset.testing];
  return `${equipment} / ${testing}`;
}

/**
 * Where a tier sits on GDD §6.1's ladder, lowest first.
 *
 * @throws {RangeError} on a tier that is not on the ladder, which the type
 * already prevents from a TypeScript caller and does not prevent from a wire.
 */
export function tierIndex(tier: CareerMeetTier): number {
  const index = MEET_TIER_ORDER.indexOf(tier);
  if (index < 0) {
    throw new RangeError(`career: ${tier} is not a meet tier`);
  }
  return index;
}

/**
 * GDD §6.1's ladder, lowest first, widened from the frozen tuple so a caller
 * can walk it without pinning itself to the tuple's literal types.
 */
export function tiersLowestFirst(): readonly CareerMeetTier[] {
  return MEET_TIER_ORDER;
}

/** The tier a lifter with no qualifying total starts at: GDD §6.1's `local`. */
export function entryTier(): CareerMeetTier {
  const first = MEET_TIER_ORDER[0];
  if (first === undefined) {
    throw new RangeError('career: the tier ladder is empty');
  }
  return first;
}
