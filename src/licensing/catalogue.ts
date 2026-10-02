/**
 * catalogue.ts — A SPONSOR DOES NOT BUY A STAT (GDD §8.1, §12.3), as types.
 *
 * PURE MODULE: zero React imports, zero side effects, zero I/O, explicit return
 * types, and no numeric literal, so it needs no `SOURCE_RULES` registration.
 *
 * ===========================================================================
 * 1. THE ONE SENTENCE
 * ===========================================================================
 *
 * **A sponsored item is a presentation swap on a base item, and the mechanics
 * are read from the base — so a reskin is mechanically identical by
 * construction, not by promise.**
 *
 * GDD §8.1: "Any branded or sponsored consumable is cosmetic and flavor-only,
 * mechanically identical to the fictional item it reskins. A branded chalk is
 * the existing chalk with different art. A sponsored recovery product does not
 * shorten a setback by an hour. Placement buys visibility and nothing else."
 * CLAUDE.md adds: "If a partner asks for one, that is a refusal, not a
 * negotiation."
 *
 * A paying partner has leverage a player does not, so this is the line that will
 * actually get tested — which is the argument for making it a compile error
 * rather than a review comment.
 *
 * ===========================================================================
 * 2. HOW, IN FOUR MECHANISMS, ALL COMPILE-TIME
 * ===========================================================================
 *
 *  (a) THE FIELD-ROLE MAP. `ITEM_FIELD_ROLE` answers, for every field of
 *      `BaseItem`, whether it is `'mechanical'`, `'presentation'` or
 *      `'identity'`. Exhaustive by `satisfies`, so a new field on `BaseItem`
 *      cannot be added without answering the §8.1 question out loud. Same shape
 *      as `progression.ts`'s `FACT_PROTECTION`, and for the same reason: a
 *      hand-written list of mechanical fields has a DEFAULT, and the default was
 *      "not mechanical".
 *
 *  (b) A RESKIN DECLARES NO MECHANICAL FIELD.
 *      `A_RESKIN_DECLARES_NO_MECHANICAL_FIELD` asserts `keyof SponsoredReskin`
 *      is disjoint from the mechanical fields DERIVED from (a). Adding
 *      `readonly effect: EntitlementEffect` to a reskin — the shape a partner
 *      asking for a stat would arrive as — fails there. Both operands carry
 *      non-vacuity guards, because a disjointness assertion is worth exactly
 *      what its operands are worth (`progression.ts` §5(b)).
 *
 *  (c) NOTHING TO OVERRIDE WITH. `effectOf` looks the effect up from the base
 *      SKU. There is no merge, no spread and no `?? reskin.effect`, so the
 *      returned effect is the SAME OBJECT the base item exposes — checked by
 *      REFERENCE IDENTITY in `catalogue.test.ts`, not by deep equality, because
 *      deep equality would also pass for a hand-copied clone that could then
 *      drift.
 *
 *  (d) WHATEVER IT REACHES, ITS BASE ALREADY REACHED.
 *      `A_SPONSORED_ITEM_REACHES_NO_PROTECTED_CONCERN` binds this module to
 *      `progression.ts`: a sponsored item's reach is `AnyEntitlementReach` by
 *      construction, and that is asserted disjoint from `ProtectedConcern`.
 *      Widening `EntitlementReach` to touch `totalKg` fails there AND here, so
 *      the sponsor path cannot be the one place somebody forgets.
 *
 * ===========================================================================
 * 3. WHY A SPONSOR MAY RESKIN A FUNCTIONAL ITEM AT ALL
 * ===========================================================================
 *
 * Recovery Days are purchasable and functional (GDD §4.2, §8.2), so "a sponsored
 * recovery product" is a real category and §8.1 addresses it directly — it does
 * not say a sponsor may not touch one, it says the sponsored one "does not
 * shorten a setback by an hour". That is exactly what (c) delivers: the branded
 * recovery product IS the Recovery Day, with different art. Forbidding the
 * category outright would have been the easier check and the wrong product, and
 * it would have made this module's guarantee weaker rather than stronger — the
 * interesting case is the one where the base item does something.
 *
 * ===========================================================================
 * 4. WHAT THIS DOES NOT CLOSE
 * ===========================================================================
 *
 *  - A CAST DEFEATS IT, as everywhere else in this codebase.
 *  - IT CANNOT PRICE PLACEMENT. Nothing here knows what a partner paid or where
 *    their item sits on a shelf. Shelf order is a presentation decision and
 *    `shelfOrder` is a presentation field; if a sponsor buying the top slot ever
 *    becomes a design question, it is a §8.1 question about VISIBILITY, which
 *    §8.1 explicitly permits.
 *  - IT CANNOT STOP A SPONSOR-ONLY BASE ITEM. Somebody could add a base item
 *    with a strong effect and give exactly one partner a reskin of it. That is
 *    not a sponsor stat effect — the base item is available on its own terms —
 *    but it would be sponsor-shaped, and no type here can see the intent.
 *    `catalogue.test.ts` checks the weaker, checkable thing: every reskin's base
 *    exists in the catalogue on its own.
 *  - THE EFFECTS THEMSELVES ARE `progression.ts`'s PROBLEM. This module does not
 *    re-litigate what a purchase may do; it imports the answer.
 */

import type { EntitlementEffect } from '../game/progression';
import { ENTITLEMENT_EFFECT_KINDS } from '../game/progression';
import type { AnyEntitlementReach, ProtectedConcern } from '../game/progression';
import type { IdentityEntry } from './tiers';

// ---------------------------------------------------------------------------
// Type-level helpers. Same shapes as `progression.ts`'s; see `tiers.ts` for why
// they are duplicated rather than imported.
// ---------------------------------------------------------------------------

type KeysAreExactly<T, Keys extends string> = [Exclude<keyof T, Keys>] extends [never]
  ? [Exclude<Keys, keyof T>] extends [never]
    ? true
    : never
  : never;

type AreDisjoint<A, B> = [Extract<A, B>] extends [never] ? true : never;

type IsSubsetOf<A, B> = [Exclude<A, B>] extends [never] ? true : never;

type IsNonEmptyUnion<A> = [A] extends [never] ? never : true;

// ---------------------------------------------------------------------------
// The base item: the fictional thing that exists whether or not anyone sponsors
// ---------------------------------------------------------------------------

/**
 * A catalogue item as the game ships it, with no partner attached.
 *
 * `effect` is `progression.ts`'s `EntitlementEffect`, which is already fenced
 * against the §8.1 protected concerns by four separate compile-time assertions
 * in that file. This module does not add a fifth; it inherits them, and (d)
 * above binds the inheritance so it cannot quietly stop holding.
 */
export interface BaseItem {
  readonly sku: string;
  readonly displayName: string;
  readonly blurb: string;
  readonly effect: EntitlementEffect;
}

export const BASE_ITEM_FIELDS = ['sku', 'displayName', 'blurb', 'effect'] as const;

export type BaseItemField = (typeof BASE_ITEM_FIELDS)[number];

export const BASE_ITEM_IS_EXACTLY_ITS_ALLOWLIST: KeysAreExactly<BaseItem, BaseItemField> = true;

/** What a field of an item is FOR. Three answers, none of them a default. */
export const ITEM_FIELD_ROLES = ['identity', 'presentation', 'mechanical'] as const;

export type ItemFieldRole = (typeof ITEM_FIELD_ROLES)[number];

/**
 * THE §8.1 ANSWER FOR EVERY FIELD OF AN ITEM. The one place "does this field
 * decide what the item DOES?" is written down.
 *
 * Exhaustive by construction: `satisfies Readonly<Record<BaseItemField,
 * ItemFieldRole>>` rejects a missing field and an unknown one, and
 * `ITEM_FIELD_ROLE_COVERS_EVERY_FIELD` pins it again in case a future edit drops
 * the `satisfies`. `progression.ts` §5(b) records what a hand-written list costs
 * instead: a silent default, and a purchasable training-pace fact that passed a
 * clean `tsc` and 1104 tests.
 *
 * ANSWER FOR A NEW FIELD HERE. `'mechanical'` is not a forbidden answer — it is
 * the answer for anything that decides behaviour — but it is the answer that
 * puts the field out of a sponsor's reach, via (b).
 */
export const ITEM_FIELD_ROLE = {
  sku: 'identity',
  displayName: 'presentation',
  blurb: 'presentation',
  effect: 'mechanical',
} as const satisfies Readonly<Record<BaseItemField, ItemFieldRole>>;

export const ITEM_FIELD_ROLE_COVERS_EVERY_FIELD: KeysAreExactly<
  typeof ITEM_FIELD_ROLE,
  BaseItemField
> = true;

/** The fields that decide what an item does. Derived, never listed. */
export type MechanicalItemField = {
  [F in BaseItemField]: (typeof ITEM_FIELD_ROLE)[F] extends 'mechanical' ? F : never;
}[BaseItemField];

/**
 * NON-VACUITY ON THE OPERAND `progression.ts` §5(b) SAYS GETS FORGOTTEN.
 *
 * (b)'s disjointness passes for free if the mechanical set is empty — which is
 * one edit away: mark `effect` `'presentation'` and every guard here would go on
 * passing over nothing. This fails instead.
 */
export const MECHANICAL_ITEM_FIELDS_ARE_NOT_VACUOUS: IsNonEmptyUnion<MechanicalItemField> = true;

/**
 * ...AND THE STALENESS HALF. Non-vacuity catches a set emptied to `never`; it
 * cannot catch a set whose members no longer name anything. This binds them to
 * the real fields.
 */
export const MECHANICAL_ITEM_FIELDS_NAME_REAL_FIELDS: IsSubsetOf<
  MechanicalItemField,
  BaseItemField
> = true;

// ---------------------------------------------------------------------------
// The reskin: what a sponsorship is allowed to be
// ---------------------------------------------------------------------------

/**
 * A SPONSORED RESKIN. Presentation and nothing else.
 *
 * Note what is NOT here and cannot be added without failing (b): an `effect`, a
 * multiplier, a duration, a discount on a cooldown, a "premium" variant of the
 * base's behaviour. A partner asking for any of those is asking for an edit that
 * turns the build red with this file's name on it.
 *
 * `reskins` is the base SKU. It is `'identity'`-shaped rather than mechanical —
 * it points AT the mechanics rather than carrying them — which is exactly why
 * `effectOf` has somewhere to look and nothing to override.
 */
export interface SponsoredReskin {
  /** This offer's own SKU. */
  readonly sku: string;
  /** The base item's SKU. The mechanics come from there and only from there. */
  readonly reskins: string;
  /** The partner, as an `IdentityEntry` id. */
  readonly partner: string;
  /** The name shown instead of the base item's. Tier 2, on a shelf. */
  readonly displayName: string;
  /** The line shown instead of the base item's blurb. */
  readonly blurb: string;
  /** Which Tier 3 slot this offer leads with on the shop screen. */
  readonly leadSlot: 'portrait' | 'wordmark' | 'product';
  /** Where it sits on the shelf. Visibility is what placement buys (§8.1). */
  readonly shelfOrder: number;
}

export const SPONSORED_RESKIN_FIELDS = [
  'sku',
  'reskins',
  'partner',
  'displayName',
  'blurb',
  'leadSlot',
  'shelfOrder',
] as const;

export type SponsoredReskinField = (typeof SPONSORED_RESKIN_FIELDS)[number];

export const SPONSORED_RESKIN_IS_EXACTLY_ITS_ALLOWLIST: KeysAreExactly<
  SponsoredReskin,
  SponsoredReskinField
> = true;

/**
 * COMPILE-TIME ASSERTION (GDD §8.1, §12.3): A SPONSOR DOES NOT BUY A STAT.
 *
 * A reskin may not declare any field that decides what an item does. Adding
 * `readonly effect: EntitlementEffect` to `SponsoredReskin` fails here — the
 * exact shape "a partner asked for a stat effect" arrives as.
 *
 * IT IS NOT VACUOUS IN EITHER DIRECTION.
 * `MECHANICAL_ITEM_FIELDS_ARE_NOT_VACUOUS` holds the right operand up;
 * `SPONSORED_RESKIN_FIELDS_ARE_NOT_VACUOUS` holds the left. Emptying either
 * would otherwise make this pass over nothing, which is the failure mode
 * `progression.ts` documents at length and the one worth copying the guard for.
 */
export const A_RESKIN_DECLARES_NO_MECHANICAL_FIELD: AreDisjoint<
  SponsoredReskinField,
  MechanicalItemField
> = true;

export const SPONSORED_RESKIN_FIELDS_ARE_NOT_VACUOUS: IsNonEmptyUnion<SponsoredReskinField> = true;

/**
 * WHAT A SPONSORED ITEM CAN REACH IS WHAT ITS BASE CAN REACH.
 *
 * Not a new claim — a BINDING. `effectOf` returns the base's effect, so the
 * reach of a sponsored purchase is `progression.ts`'s `AnyEntitlementReach` by
 * construction. Stating it here means widening `EntitlementReach` to include a
 * protected fact fails in two files rather than one, and the second one is the
 * file a licensing conversation would be looking at.
 */
export type SponsoredItemReach = AnyEntitlementReach;

export const A_SPONSORED_ITEM_REACHES_NO_PROTECTED_CONCERN: AreDisjoint<
  SponsoredItemReach,
  ProtectedConcern
> = true;

/** Non-vacuity, both operands, for the same reason as everywhere else. */
export const SPONSORED_ITEM_REACH_IS_NOT_VACUOUS: IsNonEmptyUnion<SponsoredItemReach> = true;
export const PROTECTED_CONCERNS_ARE_STILL_NOT_VACUOUS: IsNonEmptyUnion<ProtectedConcern> = true;

// ---------------------------------------------------------------------------
// The catalogue, and the lookup that has nothing to override with
// ---------------------------------------------------------------------------

export interface LicensingCatalogue {
  readonly entries: readonly IdentityEntry[];
  readonly baseItems: readonly BaseItem[];
  readonly reskins: readonly SponsoredReskin[];
}

export type CatalogueProblemCode =
  | 'UNKNOWN_BASE_ITEM'
  | 'UNKNOWN_PARTNER'
  | 'DUPLICATE_SKU'
  | 'DUPLICATE_ENTRY_ID'
  | 'UNAPPROVED_REAL_PARTNER'
  | 'RESKIN_RENAMES_NOTHING';

export interface CatalogueProblem {
  readonly code: CatalogueProblemCode;
  readonly subject: string;
  readonly message: string;
}

/**
 * THE EFFECT OF A SPONSORED OFFER: the base item's, by lookup.
 *
 * The returned object is the base item's own `effect`, not a copy of it. That is
 * the mechanism (c) in the header describes, and `catalogue.test.ts` checks it
 * with `toBe` rather than `toEqual` precisely because a clone would satisfy
 * deep equality today and drift tomorrow.
 *
 * Returns `undefined` for a reskin whose base is not in the catalogue, which
 * `validateCatalogue` reports as `UNKNOWN_BASE_ITEM`. A sponsored offer with no
 * base is not a cosmetic — it is an item whose mechanics nobody declared.
 */
export function effectOf(
  catalogue: LicensingCatalogue,
  reskin: SponsoredReskin,
): EntitlementEffect | undefined {
  return catalogue.baseItems.find((item) => item.sku === reskin.reskins)?.effect;
}

/** The base item a sponsored offer reskins, if it exists. */
export function baseItemOf(
  catalogue: LicensingCatalogue,
  reskin: SponsoredReskin,
): BaseItem | undefined {
  return catalogue.baseItems.find((item) => item.sku === reskin.reskins);
}

/** The partner entry behind a sponsored offer, if it exists. */
export function partnerOf(
  catalogue: LicensingCatalogue,
  reskin: SponsoredReskin,
): IdentityEntry | undefined {
  return catalogue.entries.find((entry) => entry.id === reskin.partner);
}

/**
 * Everything wrong with a catalogue, as data rather than as a throw.
 *
 * Returns an empty array for a valid one. `partners.test.ts` runs it over the
 * real catalogue and fails on anything, so these are enforced rather than
 * available.
 *
 * `UNAPPROVED_REAL_PARTNER` is CLAUDE.md's unlock gate: an entry may only be
 * `'human-unlocked'` if its display name is in `UNLOCKED_REAL_PARTNERS`, which
 * is empty. This is the runtime twin of that constant — without it the status
 * would be a label anybody could type.
 */
export function validateCatalogue(
  catalogue: LicensingCatalogue,
  unlockedPartners: readonly string[],
): readonly CatalogueProblem[] {
  const problems: CatalogueProblem[] = [];
  const seenEntryIds = new Set<string>();
  const seenSkus = new Set<string>();

  for (const entry of catalogue.entries) {
    if (seenEntryIds.has(entry.id)) {
      problems.push({
        code: 'DUPLICATE_ENTRY_ID',
        subject: entry.id,
        message: `two identity entries share the id ${entry.id}`,
      });
    }
    seenEntryIds.add(entry.id);
    if (entry.licence === 'human-unlocked' && !unlockedPartners.includes(entry.tier2.displayName)) {
      problems.push({
        code: 'UNAPPROVED_REAL_PARTNER',
        subject: entry.id,
        message: `${entry.tier2.displayName} is marked human-unlocked but is not in UNLOCKED_REAL_PARTNERS`,
      });
    }
  }

  for (const item of catalogue.baseItems) {
    if (seenSkus.has(item.sku)) {
      problems.push({
        code: 'DUPLICATE_SKU',
        subject: item.sku,
        message: `two catalogue rows share the sku ${item.sku}`,
      });
    }
    seenSkus.add(item.sku);
  }

  for (const reskin of catalogue.reskins) {
    if (seenSkus.has(reskin.sku)) {
      problems.push({
        code: 'DUPLICATE_SKU',
        subject: reskin.sku,
        message: `two catalogue rows share the sku ${reskin.sku}`,
      });
    }
    seenSkus.add(reskin.sku);

    const base = baseItemOf(catalogue, reskin);
    if (base === undefined) {
      problems.push({
        code: 'UNKNOWN_BASE_ITEM',
        subject: reskin.sku,
        message: `${reskin.sku} reskins ${reskin.reskins}, which is not a base item — a sponsored offer with no base is an item whose mechanics nobody declared`,
      });
    } else if (base.displayName === reskin.displayName && base.blurb === reskin.blurb) {
      // Not a correctness bug, a POINTLESSNESS bug: a reskin that changes
      // nothing presentational is an extra SKU for the same item, which is the
      // shape somebody would reach for if they wanted a second copy of an item
      // to attach something to later.
      problems.push({
        code: 'RESKIN_RENAMES_NOTHING',
        subject: reskin.sku,
        message: `${reskin.sku} presents exactly as its base item — a reskin that changes no presentation is a duplicate SKU`,
      });
    }

    if (partnerOf(catalogue, reskin) === undefined) {
      problems.push({
        code: 'UNKNOWN_PARTNER',
        subject: reskin.sku,
        message: `${reskin.sku} names partner ${reskin.partner}, which is not an identity entry`,
      });
    }
  }

  return problems;
}

/**
 * The shelf, in shelf order. Presentation only — GDD §8.1 says placement buys
 * visibility, and this is the entire mechanism by which it does.
 */
export function shelf(catalogue: LicensingCatalogue): readonly SponsoredReskin[] {
  return [...catalogue.reskins].sort((a, b) => a.shelfOrder - b.shelfOrder);
}

/**
 * The kinds of effect anything in this catalogue may carry, re-exported from
 * `progression.ts` so a reader of the licensing code does not have to go looking
 * for the answer. Re-exported, NOT redeclared: a second list would be a second
 * truth.
 */
export const SPONSORABLE_EFFECT_KINDS = ENTITLEMENT_EFFECT_KINDS;
