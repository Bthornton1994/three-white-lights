/**
 * members.ts — GDD §5 (v2) stage 3: members, with types and satisfaction.
 *
 * §5.11's third stage, unpaused as a NAMED EXCEPTION recorded in CLAUDE.md
 * ("STAGE 3 IS UNPAUSED") and `docs/GDD.md` §5.13, scoped to exactly what the
 * presentation layer's Phase 2 needs: member types with their attraction/pay/
 * quirk (§5.6's table), a satisfaction function driven by crowding, equipment
 * condition and equipment fit, and a reputation-from-members contribution.
 *
 * Stage G.2A: living-floor recent-service meaning lives in
 * `livingMemberExperience.ts` and reads `recentVisits` only. This file's
 * `memberSatisfaction()` remains the aggregate crowding × fit × condition
 * proxy for later attraction / offline / consequence work. G.2A does not call
 * it, and does not call `memberDuesGymBucks` or `reputationFromMembers`.
 *
 * Pure module (CLAUDE.md, "Pure logic is separate from UI"): zero React, zero
 * side effects, zero I/O, no clock reading, no randomness. Its imports are
 * `./empireCore` (`refuseWith`, `ReputationPoints`, `asReputation`), `./sessions`
 * (`SessionEquipmentItem`, `SessionActivityGroup` — read-only, for the equipment
 * vocabulary), `./production` (`scrubPrecision`) and `./empireTuning`.
 *
 * NOT BUILT HERE, ON PURPOSE — §5.11 stage 4, staffing/maintenance/failure:
 *
 *   - No roster STATE and no `tick`/`accrue` transition. Every function below
 *     is a pure read of a roster or an equipment set handed in; nothing here
 *     holds a gym's members over time or decides who arrives or leaves.
 *   - No manager, no maintenance, no repair decision, no failure state.
 *   - No condition DECAY. See header §2.
 *
 * ===========================================================================
 * 1. Member types are §5.6's table, at whatever resolution this stage needs
 * ===========================================================================
 *
 * §5.6: "They have types, and the mix is a consequence of what you built" —
 * Casual, Bodybuilder, Powerlifter, Athlete, Serious Lifter. `MemberType` is
 * derived from `EMPIRE_TUNING.MEMBER_TYPES` the way every other closed
 * vocabulary in this directory is (`LadderRung`, `SessionEquipmentItem`), so a
 * sixth type is a tuning-file edit and a type-level ripple, not a string
 * anybody can drift.
 *
 * Two of the table's five quirks are load-bearing here because they are
 * genuinely inputs to satisfaction: Casual's crowding sensitivity and
 * Bodybuilder's crowding load weight (header §5). Reputation weight (header
 * §4) is Powerlifter and Serious Lifter's quirk, made mechanical. Athlete's
 * "seasonal — leaves and returns" and Serious Lifter's "slow to arrive, very
 * slow to leave" describe RATE DYNAMICS OVER TIME — arrival and departure —
 * and this stage has no roster-over-time state for a rate to apply to (that is
 * §5.11 stage 4's active-management territory, not stage 3's satisfaction
 * layer). Building an arrival/departure formula with nothing to consume it
 * would be exactly the dead-knob-with-no-consumer this file's tuning module
 * refuses to park (`empireTuning.ts`'s stage-1 scope note). So those two
 * quirks are recorded here, in prose, as the next stage's inputs rather than
 * implemented — and NOT modelled as tuning knobs, because an unread knob is
 * worse than an undocumented one in this codebase's own terms.
 *
 * ===========================================================================
 * 2. Equipment condition is an INPUT PARAMETER, not computed here
 * ===========================================================================
 *
 * §5.6: satisfaction is driven by "equipment-to-member ratio (crowding),
 * equipment condition ... and whether the gym has what they came for." No
 * `condition` field exists on any equipment item anywhere in this codebase —
 * `grep -rn "condition" src/empire/empireTuning.ts` before this piece finds
 * nothing — because condition decay is §5.7 / stage 4, explicitly out of
 * scope for this piece (CLAUDE.md's task brief and `docs/GDD.md` §5.13's own
 * grounding check both name this gap before any of stage 3 was built).
 *
 * `MemberSatisfactionInput.conditionMultiplier` is therefore a bare `number`
 * in `[0, 1]` that every call site in this module and its test supplies
 * directly — `1` (no degradation: "perfect condition") is the only value any
 * caller in this codebase passes today, because nothing produces any other
 * value yet. Stage 4 is expected to replace that literal `1` with a real read
 * of decayed equipment condition; nothing in this module's TYPE forces that
 * migration, which is the honest limit of an input parameter versus a real
 * dependency injection — there is no compiler error waiting for stage 4, only
 * a comment at every call site. `memberSatisfaction`'s own doc comment repeats
 * this rather than assuming a reader reaches this section.
 *
 * ===========================================================================
 * 3. The Barbell-group gap: a real, load-bearing limitation, not a detail
 * ===========================================================================
 *
 * §5.4 lists five equipment groups; `EMPIRE_TUNING.SESSION_ACTIVITY_GROUPS` —
 * the vocabulary `sessions.ts` actually gates activities on — has four
 * (conditioning, accessory, recovery, support). The fifth, Barbell (bar,
 * plates, rack, platform, monolift), lives on the LADDER instead
 * (`LadderEquipmentItem` in `ladder.ts`) and has no per-item "member appeal"
 * or fit data anywhere: the fixed four powerlifting sessions never gate on
 * owned Barbell equipment, treating a working barbell setup as always
 * present (`sessions.ts` header §1, `ladder.ts`'s own stage-1 scope note).
 *
 * §5.6's Powerlifter row leads with Barbell items — "Racks, platforms,
 * specialty bars" — and is therefore only PARTIALLY measurable here:
 * `specialty-bars` is real (`SessionEquipmentItem`, Support group); racks and
 * platforms are not ownable state at all. Rather than invent a rack/platform
 * fit signal this codebase has nowhere to read from, `equipmentFitScore`
 * treats "the gym has a working barbell setup" as an ALWAYS-TRUE baseline
 * input, matching how `sessions.ts` already treats it, via
 * `MEMBER_TYPE_BARBELL_AFFINITY` — a constant per-type contribution applied
 * unconditionally, regardless of what is actually owned. It cannot currently
 * distinguish one gym's Barbell holdings from another's, because nothing in
 * this codebase varies. The rest of every type's fit score
 * (`MEMBER_TYPE_ITEM_AFFINITY`) is derived only from items that actually
 * exist in `EMPIRE_TUNING.SESSION_EQUIPMENT_ITEMS`. When stage 1's ladder
 * equipment grows a real per-item fit signal, the honest fix is a second
 * summand here reading `LadderEquipmentItem`s actually owned — not a change
 * to the baseline, which should then presumably shrink to reflect what the
 * per-item signal now covers instead. That is future work, named rather than
 * done.
 *
 * ===========================================================================
 * 4. Reputation contribution: members only, as a per-day rate
 * ===========================================================================
 *
 * §5.6: "Reputation is earned mostly by powerlifter and serious-lifter
 * members, and by your own competition results." The members half is this
 * file: `reputationFromMembers` sums a per-day rate from a roster.
 *
 * The competition-results half is `sportingReputation.ts`, a per-result
 * event delta. That is a different grain. Stage E.1 removed the old
 * optional competition-result bonus argument: folding a meet into a daily
 * member rate hid the mismatch inside this function. This function returns
 * member reputation only. A later accounting boundary may compose grains
 * once both operands share one; that boundary is not this file.
 *
 * ===========================================================================
 * 5. Crowding: a real ratio, from real state, with two type-keyed shape terms
 * ===========================================================================
 *
 * §5.6: satisfaction is driven by "equipment-to-member ratio (crowding)".
 * `crowdingLoad` computes it for real, from two real quantities a caller
 * supplies — a roster (counts by type) and a count of owned session-equipment
 * items — with two of §5.6's quirks folded in as type-keyed weights rather
 * than left as prose:
 *
 *   - `MEMBER_TYPE_CROWDING_LOAD_WEIGHT` — "Bodybuilder: occupies equipment
 *     for a long time" — how much one member of a type counts toward the
 *     load the REST of the roster feels. A roster with more bodybuilders is
 *     more crowded than the same headcount of any other type, at the same
 *     equipment count.
 *   - `MEMBER_TYPE_CROWDING_SENSITIVITY` — "Casual: leaves fastest when
 *     crowded" — how steeply a given load turns into a satisfaction penalty
 *     for THAT type, in `crowdingSatisfactionMultiplier`.
 *
 * The curve is a bounded hyperbolic decay,
 * `floor + (1 - floor) / (1 + sensitivity * load)`: 1 at zero load, falling
 * toward `MEMBER_CROWDING_SATISFACTION_FLOOR` as load grows, well-defined
 * (including at `load = Infinity`, the zero-equipment-nonzero-roster case)
 * because JavaScript's IEEE-754 division makes `x / Infinity === 0` for any
 * finite `x`. The one input state that WOULD produce `0 / 0` — no roster and
 * no equipment — is special-cased to a load of `0` (no members, no crowding
 * pressure) before any division happens.
 */

import { asReputation, refuseWith, type ReputationPoints } from './empireCore';
import { scrubPrecision } from './production';
import type { SessionEquipmentItem } from './sessions';
import { EMPIRE_TUNING } from './empireTuning';

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/** §5.6's five member types. */
export type MemberType = (typeof EMPIRE_TUNING.MEMBER_TYPES)[number];

/** One roster row: how many members of one type a gym currently has. */
export interface MemberRosterEntry {
  readonly type: MemberType;
  readonly count: number;
}

/** A gym's whole member roster — one row per type present, zero implied for the rest. */
export type MemberRoster = readonly MemberRosterEntry[];

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Refuse an unrecognised member type. Loud on a cast-in value. */
function requireMemberType(type: MemberType): MemberType {
  if (!EMPIRE_TUNING.MEMBER_TYPES.includes(type)) {
    refuseWith(`${String(type)} is not a §5.6 member type`);
  }
  return type;
}

/** Refuse a roster with a negative, non-finite or non-integer count, or a duplicate type. */
function requireMemberRoster(roster: MemberRoster): MemberRoster {
  const seen = new Set<string>();
  for (const row of roster) {
    requireMemberType(row.type);
    if (seen.has(row.type)) refuseWith(`${row.type} appears twice in one roster`);
    seen.add(row.type);
    if (!Number.isFinite(row.count) || !Number.isInteger(row.count) || row.count < 0) {
      refuseWith(`${row.type}'s member count must be a non-negative whole number, received ${row.count}`);
    }
  }
  return roster;
}

// ---------------------------------------------------------------------------
// Dues — §5.6's "Pays" column
// ---------------------------------------------------------------------------

/** `type`'s published dues at full (1.0) satisfaction, in Gym Bucks per day. */
export function memberBaseDuesGymBucks(type: MemberType): number {
  requireMemberType(type);
  const dues = EMPIRE_TUNING.MEMBER_DUES_GYM_BUCKS_PER_DAY[type];
  if (!Number.isFinite(dues) || dues < 0) {
    refuseWith(`${type} has no published dues`);
  }
  return dues;
}

/**
 * What one member of `type` actually pays today, at `satisfaction` (0..1).
 * Linear between `MEMBER_DUES_SATISFACTION_FLOOR` (satisfaction 0) and the
 * full rate (satisfaction 1) — a present member always pays SOMETHING; see
 * `MEMBER_DUES_SATISFACTION_FLOOR`'s own comment for why that floor exists.
 */
export function memberDuesGymBucks(type: MemberType, satisfaction: number): number {
  if (!Number.isFinite(satisfaction) || satisfaction < 0 || satisfaction > 1) {
    refuseWith(`satisfaction must be finite and within [0, 1], received ${satisfaction}`);
  }
  const base = memberBaseDuesGymBucks(type);
  const floor = EMPIRE_TUNING.MEMBER_DUES_SATISFACTION_FLOOR;
  return scrubPrecision(base * (floor + (1 - floor) * satisfaction));
}

// ---------------------------------------------------------------------------
// Equipment fit — §5.6's "Attracted by" column, and the readable-consequence
// bias function GDD asks for: "a player looking at their roster can tell what
// kind of gym they've accidentally built."
// ---------------------------------------------------------------------------

/** One type's per-item affinity table — a sparse lookup, missing keys read as zero. */
function itemAffinityFor(type: MemberType): Readonly<Partial<Record<SessionEquipmentItem, number>>> {
  return EMPIRE_TUNING.MEMBER_TYPE_ITEM_AFFINITY[type];
}

/**
 * The highest fit score `type` could reach: the Barbell baseline plus every
 * affinity the item table lists for it, whether or not the items are owned.
 * `equipmentFitScore` divides by this so the result is comparable across
 * types (each type's own scale is normalised to the same [0, 1] range) even
 * though the raw affinity numbers are not chosen to compare across types.
 */
function maxFitFor(type: MemberType): number {
  const items = itemAffinityFor(type);
  const itemTotal = Object.values(items).reduce(
    (sum: number, affinity) => sum + (affinity ?? 0),
    0,
  );
  return EMPIRE_TUNING.MEMBER_TYPE_BARBELL_AFFINITY[type] + itemTotal;
}

/**
 * How well `ownedItems` matches what `type` came for — §5.6's "Attracted by"
 * column, at real-item resolution over the four §5.4 groups this codebase
 * models (see header §3 for the Barbell-group gap this deliberately does not
 * paper over). Bounded to [0, 1]: 0 with nothing owned but the always-true
 * Barbell baseline contributes its share, 1 at every listed item owned.
 */
export function equipmentFitScore(
  type: MemberType,
  ownedItems: readonly SessionEquipmentItem[],
): number {
  requireMemberType(type);
  const items = itemAffinityFor(type);
  let raw = EMPIRE_TUNING.MEMBER_TYPE_BARBELL_AFFINITY[type];
  for (const item of ownedItems) {
    raw += items[item] ?? 0;
  }
  const max = maxFitFor(type);
  const score = max > 0 ? raw / max : 0;
  return scrubPrecision(Math.min(1, Math.max(0, score)));
}

/**
 * GDD §5.6's design intent, made checkable: "the member mix should be a
 * readable consequence of your equipment choices, so a player looking at
 * their roster can tell what kind of gym they've accidentally built." Given
 * an owned equipment set, the type(s) it is biased toward — every type whose
 * fit score is within `MEMBER_EQUIPMENT_BIAS_TIE_TOLERANCE` of the highest
 * score reached by ANY type, in `EMPIRE_TUNING.MEMBER_TYPES` order. Never
 * empty: even with nothing owned, the Barbell baseline alone orders every
 * type (Powerlifter highest), so a fresh garage already reads as biased.
 */
export function equipmentBiasedMemberTypes(
  ownedItems: readonly SessionEquipmentItem[],
): readonly MemberType[] {
  const scores = EMPIRE_TUNING.MEMBER_TYPES.map(
    (type) => [type, equipmentFitScore(type, ownedItems)] as const,
  );
  const best = Math.max(...scores.map(([, score]) => score));
  const tolerance = EMPIRE_TUNING.MEMBER_EQUIPMENT_BIAS_TIE_TOLERANCE;
  return Object.freeze(
    scores.filter(([, score]) => best - score <= tolerance).map(([type]) => type),
  );
}

// ---------------------------------------------------------------------------
// Crowding — see header §5
// ---------------------------------------------------------------------------

/**
 * The crowding load a roster places on `equipmentUnitCount` owned session
 * items: a weighted headcount (header §5's `MEMBER_TYPE_CROWDING_LOAD_WEIGHT`)
 * divided by the equipment count. `0` when the roster is empty, even with no
 * equipment — the one input where the naive division would be `0 / 0`.
 * Otherwise unbounded above: zero equipment with any members at all is
 * `Infinity`, which `crowdingSatisfactionMultiplier` handles by construction
 * (see its own comment) rather than by a special case here.
 */
export function crowdingLoad(roster: MemberRoster, equipmentUnitCount: number): number {
  requireMemberRoster(roster);
  if (!Number.isFinite(equipmentUnitCount) || equipmentUnitCount < 0) {
    refuseWith(`equipment unit count must be finite and at or above zero, received ${equipmentUnitCount}`);
  }
  const scaledHeadcount = roster.reduce(
    (sum, row) => sum + row.count * EMPIRE_TUNING.MEMBER_TYPE_CROWDING_LOAD_WEIGHT[row.type],
    0,
  );
  if (scaledHeadcount === 0) return 0;
  return scaledHeadcount / equipmentUnitCount;
}

/**
 * `type`'s satisfaction multiplier at crowding `load` — header §5's bounded
 * hyperbolic decay. `1` at `load = 0`; falls toward
 * `MEMBER_CROWDING_SATISFACTION_FLOOR` as `load` grows; well-defined at
 * `load = Infinity` (returns the floor exactly, no `NaN`) because dividing a
 * finite number by `Infinity` is `0` under IEEE-754.
 */
export function crowdingSatisfactionMultiplier(type: MemberType, load: number): number {
  requireMemberType(type);
  if (!Number.isFinite(load) && load !== Infinity) {
    refuseWith(`crowding load must be finite or +Infinity, received ${load}`);
  }
  if (load < 0) refuseWith(`crowding load must be at or above zero, received ${load}`);
  const sensitivity = EMPIRE_TUNING.MEMBER_TYPE_CROWDING_SENSITIVITY[type];
  const floor = EMPIRE_TUNING.MEMBER_CROWDING_SATISFACTION_FLOOR;
  const multiplier = floor + (1 - floor) / (1 + sensitivity * load);
  return scrubPrecision(multiplier);
}

// ---------------------------------------------------------------------------
// Satisfaction — the composed §5.6 function
// ---------------------------------------------------------------------------

/**
 * The three §5.6 drivers, as real inputs. `conditionMultiplier` is an INPUT
 * PARAMETER, not computed by this module — header §2 says why, and every
 * call site in this codebase passes `1` (no degradation) today because
 * nothing produces any other value yet. Stage 4 is expected to supply a real
 * read here once condition decay exists.
 */
export interface MemberSatisfactionInput {
  readonly type: MemberType;
  readonly roster: MemberRoster;
  readonly ownedItems: readonly SessionEquipmentItem[];
  /** [0, 1]. `1` is "no degradation yet" — see this file's header §2. */
  readonly conditionMultiplier: number;
}

/** The composed score plus its three factors, for a screen to explain itself with. */
export interface MemberSatisfactionScore {
  readonly crowding: number;
  readonly fit: number;
  readonly condition: number;
  readonly composite: number;
}

/**
 * §5.6: satisfaction driven by crowding, equipment condition and equipment
 * fit. Composed multiplicatively — each factor is independently in [0, 1]
 * (crowding's floor is `MEMBER_CROWDING_SATISFACTION_FLOOR`, not zero; fit is
 * genuinely [0, 1]; condition is the caller's [0, 1] input), so the product
 * is in [0, 1] too, with any one factor at its worst able to drag the whole
 * score down — which matches §5.6's "Unhappy members leave" being triggerable
 * by any one of the three going bad, not only all three at once.
 */
export function memberSatisfaction(input: MemberSatisfactionInput): MemberSatisfactionScore {
  requireMemberType(input.type);
  requireMemberRoster(input.roster);
  if (
    !Number.isFinite(input.conditionMultiplier) ||
    input.conditionMultiplier < 0 ||
    input.conditionMultiplier > 1
  ) {
    refuseWith(
      `condition multiplier must be finite and within [0, 1], received ${input.conditionMultiplier}`,
    );
  }
  const crowding = crowdingSatisfactionMultiplier(
    input.type,
    crowdingLoad(input.roster, input.ownedItems.length),
  );
  const fit = equipmentFitScore(input.type, input.ownedItems);
  const condition = input.conditionMultiplier;
  return Object.freeze({
    crowding,
    fit,
    condition,
    composite: scrubPrecision(crowding * fit * condition),
  });
}

// ---------------------------------------------------------------------------
// Reputation — see header §4
// ---------------------------------------------------------------------------

/**
 * §5.6: "Reputation is earned mostly by powerlifter and serious-lifter
 * members, and by your own competition results." This is the members' half:
 * one day's reputation contribution from `roster`. The competition-results
 * half is `sportingReputationFromResult` and is not an argument here.
 */
export function reputationFromMembers(roster: MemberRoster): ReputationPoints {
  requireMemberRoster(roster);
  const fromMembers = roster.reduce(
    (sum, row) => sum + row.count * EMPIRE_TUNING.MEMBER_TYPE_REPUTATION_PER_MEMBER_PER_DAY[row.type],
    0,
  );
  return asReputation(scrubPrecision(fromMembers));
}
