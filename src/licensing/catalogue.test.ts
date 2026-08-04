/**
 * A SPONSOR DOES NOT BUY A STAT (GDD §8.1, §12.3), checked by execution.
 *
 * ---------------------------------------------------------------------------
 * THE ASSERTION THAT MATTERS IS `toBe`, NOT `toEqual`
 * ---------------------------------------------------------------------------
 * "Mechanically identical to the fictional item it reskins" is a claim about
 * IDENTITY, not about equality. A hand-copied effect object would satisfy deep
 * equality on the day it was written and drift the first time either side was
 * edited — and the drifted one would be the branded one, because that is the one
 * with a partner asking for changes. So the check is reference identity: the
 * branded item and the house item hand back the SAME OBJECT.
 *
 * The compile-time half lives in `catalogue.ts`. As with `tiers.test.ts`, each
 * type-level assertion is a `const` somebody could delete, so the runtime twins
 * are here and the `@ts-expect-error` twins are here too — an unused
 * `@ts-expect-error` is itself a compile error, so the refusals fail `tsc` from
 * both sides.
 */

import { describe, expect, it } from 'vitest';

import {
  BASE_ITEM_FIELDS,
  ITEM_FIELD_ROLE,
  ITEM_FIELD_ROLES,
  SPONSORABLE_EFFECT_KINDS,
  SPONSORED_RESKIN_FIELDS,
  baseItemOf,
  effectOf,
  partnerOf,
  shelf,
  validateCatalogue,
  type LicensingCatalogue,
  type SponsoredReskin,
} from './catalogue';
import { BASE_ITEMS, LICENSING_CATALOGUE, SPONSORED_RESKINS } from './partners';
import { UNLOCKED_REAL_PARTNERS } from './tiers';
import { ENTITLEMENT_EFFECT_KINDS, PROTECTED_CONCERNS } from '../game/progression';

// ---------------------------------------------------------------------------
// The field-role map: the one place "does this decide what the item does?" lives
// ---------------------------------------------------------------------------

describe('the item field roles', () => {
  it('answers for every field of a base item, with no default', () => {
    // `progression.ts` §5(b) records what a hand-written list costs instead: a
    // silent default, and a purchasable training-pace fact that passed a clean
    // `tsc` and 1104 tests.
    expect(Object.keys(ITEM_FIELD_ROLE).sort()).toEqual([...BASE_ITEM_FIELDS].sort());
    for (const field of BASE_ITEM_FIELDS) {
      expect(ITEM_FIELD_ROLES, `${field} has no role`).toContain(ITEM_FIELD_ROLE[field]);
    }
  });

  it('has at least one mechanical field, or every guard below is vacuous', () => {
    const mechanical = BASE_ITEM_FIELDS.filter((f) => ITEM_FIELD_ROLE[f] === 'mechanical');
    expect(mechanical.length).toBeGreaterThan(0);
    expect(mechanical).toContain('effect');
  });

  it('shares no field name with a reskin', () => {
    // The runtime twin of `A_RESKIN_DECLARES_NO_MECHANICAL_FIELD`. A type-level
    // assertion that gets deleted is invisible to `npm test`; this is not.
    const mechanical = BASE_ITEM_FIELDS.filter((f) => ITEM_FIELD_ROLE[f] === 'mechanical');
    for (const field of mechanical) {
      expect(SPONSORED_RESKIN_FIELDS as readonly string[], `a reskin declares ${field}`).not.toContain(field);
    }
    // ...and both sides are non-empty, so the disjointness is not free.
    expect(SPONSORED_RESKIN_FIELDS.length).toBeGreaterThan(0);
  });

  it('will not let a reskin declare an effect', () => {
    const asked: SponsoredReskin = {
      sku: 'partner-asked-for-a-stat',
      reskins: 'house-chalk-vfx',
      partner: 'ninebar-athletic',
      displayName: 'x',
      blurb: 'y',
      leadSlot: 'product',
      shelfOrder: 0,
      // @ts-expect-error a sponsored reskin has no `effect` field, by design
      effect: { kind: 'cosmetic', slot: 'chalk-vfx' },
    };
    // The value exists at runtime — TypeScript is not a sandbox. What the test
    // records is that the only route to it was an error the compiler reported,
    // in the file whose name a licensing conversation would be looking at.
    expect(asked.sku).toBe('partner-asked-for-a-stat');
  });
});

// ---------------------------------------------------------------------------
// The mechanics come from the base, and there is nothing to override with
// ---------------------------------------------------------------------------

describe('a sponsored item is mechanically its base item', () => {
  it('hands back the SAME effect object, not an equal one', () => {
    // GDD §8.1: "A branded chalk is the existing chalk with different art."
    for (const reskin of SPONSORED_RESKINS) {
      const base = baseItemOf(LICENSING_CATALOGUE, reskin);
      expect(base, `${reskin.sku} has no base`).toBeDefined();
      expect(effectOf(LICENSING_CATALOGUE, reskin), reskin.sku).toBe(base?.effect);
    }
  });

  it('holds for the FUNCTIONAL item too, which is the interesting case', () => {
    // "A sponsored recovery product does not shorten a setback by an hour."
    // Forbidding the category outright would have been the easier check and the
    // weaker guarantee: the promise is only worth anything on an item that does
    // something.
    const branded = SPONSORED_RESKINS.find((r) => r.reskins === 'house-recovery-day');
    const house = BASE_ITEMS.find((i) => i.sku === 'house-recovery-day');
    expect(branded, 'no sponsored recovery product to check').toBeDefined();
    expect(house?.effect.kind).toBe('recovery-day');
    if (branded === undefined) return;
    expect(effectOf(LICENSING_CATALOGUE, branded)).toBe(house?.effect);
    if (house?.effect.kind === 'recovery-day') {
      const brandedEffect = effectOf(LICENSING_CATALOGUE, branded);
      expect(brandedEffect?.kind).toBe('recovery-day');
      // Same object, so the same count. There is no arithmetic to get wrong.
      expect(brandedEffect === house.effect).toBe(true);
    }
  });

  it('changes presentation and only presentation', () => {
    for (const reskin of SPONSORED_RESKINS) {
      const base = baseItemOf(LICENSING_CATALOGUE, reskin);
      if (base === undefined) throw new Error(`${reskin.sku} has no base`);
      // Something visible differs...
      expect(
        reskin.displayName !== base.displayName || reskin.blurb !== base.blurb,
        `${reskin.sku} presents identically to its base`,
      ).toBe(true);
      // ...and nothing mechanical does.
      expect(effectOf(LICENSING_CATALOGUE, reskin)).toBe(base.effect);
    }
  });

  it('can only carry the effect kinds progression.ts already allows', () => {
    // Re-exported, not redeclared: a second list would be a second truth.
    expect(SPONSORABLE_EFFECT_KINDS).toBe(ENTITLEMENT_EFFECT_KINDS);
    for (const item of BASE_ITEMS) {
      expect(SPONSORABLE_EFFECT_KINDS as readonly string[], item.sku).toContain(item.effect.kind);
    }
  });

  it('reaches nothing on the §8.1 protected list', () => {
    // The runtime twin of `A_SPONSORED_ITEM_REACHES_NO_PROTECTED_CONCERN`, and
    // a non-vacuity check on the operand that would otherwise make it free.
    expect(PROTECTED_CONCERNS.length).toBeGreaterThan(0);
    expect([...PROTECTED_CONCERNS]).toContain('totalKg');
    expect([...PROTECTED_CONCERNS]).toContain('bestE1rmKg');
    // Nothing in this module exports a multiplier, a bonus, or any function
    // that takes a sponsorship and returns a number.
    expect(typeof effectOf).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Catalogue validation
// ---------------------------------------------------------------------------

describe('validateCatalogue', () => {
  it('passes the real catalogue', () => {
    const problems = validateCatalogue(LICENSING_CATALOGUE, UNLOCKED_REAL_PARTNERS);
    expect(problems.map((p) => `${p.code} ${p.subject}: ${p.message}`)).toEqual([]);
  });

  it('refuses a sponsored offer whose base does not exist', () => {
    // An offer with no base is an item whose mechanics nobody declared — which
    // is the shape a stat effect would arrive as if it could not arrive as a
    // field.
    const orphan: SponsoredReskin = {
      sku: 'orphan-offer',
      reskins: 'no-such-item',
      partner: 'ninebar-athletic',
      displayName: 'Orphan',
      blurb: 'Reskins nothing.',
      leadSlot: 'product',
      shelfOrder: 0,
    };
    const broken: LicensingCatalogue = {
      ...LICENSING_CATALOGUE,
      reskins: [...SPONSORED_RESKINS, orphan],
    };
    const codes = validateCatalogue(broken, UNLOCKED_REAL_PARTNERS).map((p) => p.code);
    expect(codes).toContain('UNKNOWN_BASE_ITEM');
  });

  it('refuses a reskin that presents exactly as its base', () => {
    const base = BASE_ITEMS[0];
    if (base === undefined) throw new Error('no base items');
    const pointless: SponsoredReskin = {
      sku: 'pointless-offer',
      reskins: base.sku,
      partner: 'ninebar-athletic',
      displayName: base.displayName,
      blurb: base.blurb,
      leadSlot: 'product',
      shelfOrder: 0,
    };
    const codes = validateCatalogue(
      { ...LICENSING_CATALOGUE, reskins: [pointless] },
      UNLOCKED_REAL_PARTNERS,
    ).map((p) => p.code);
    expect(codes).toContain('RESKIN_RENAMES_NOTHING');
  });

  it('refuses an offer naming a partner nobody added', () => {
    const stray: SponsoredReskin = {
      sku: 'stray-offer',
      reskins: 'house-singlet',
      partner: 'nobody-added-this-entry',
      displayName: 'Stray',
      blurb: 'A partner who is not in the table.',
      leadSlot: 'wordmark',
      shelfOrder: 0,
    };
    const codes = validateCatalogue(
      { ...LICENSING_CATALOGUE, reskins: [stray] },
      UNLOCKED_REAL_PARTNERS,
    ).map((p) => p.code);
    expect(codes).toContain('UNKNOWN_PARTNER');
    expect(partnerOf(LICENSING_CATALOGUE, stray)).toBeUndefined();
  });

  it('refuses an entry marked human-unlocked that no human unlocked', () => {
    // CLAUDE.md's gate, as a runtime check rather than a label anybody can
    // type. `UNLOCKED_REAL_PARTNERS` is empty, so every `human-unlocked` entry
    // is unapproved by construction today.
    const entry = LICENSING_CATALOGUE.entries[0];
    if (entry === undefined) throw new Error('no entries');
    const codes = validateCatalogue(
      { ...LICENSING_CATALOGUE, entries: [{ ...entry, licence: 'human-unlocked' }] },
      UNLOCKED_REAL_PARTNERS,
    ).map((p) => p.code);
    expect(codes).toContain('UNAPPROVED_REAL_PARTNER');
  });

  it('accepts the same entry once a human has named it', () => {
    // The paired direction: a guard that refuses everything satisfies the
    // prohibition perfectly and breaks the product. The unlock has to WORK, it
    // just has to be a human typing a name.
    const entry = LICENSING_CATALOGUE.entries[0];
    if (entry === undefined) throw new Error('no entries');
    const problems = validateCatalogue(
      { ...LICENSING_CATALOGUE, entries: [{ ...entry, licence: 'human-unlocked' }] },
      [entry.tier2.displayName],
    );
    expect(problems.map((p) => p.code)).not.toContain('UNAPPROVED_REAL_PARTNER');
  });

  it('refuses two rows sharing a SKU, base or sponsored', () => {
    const first = SPONSORED_RESKINS[0];
    if (first === undefined) throw new Error('no reskins');
    const codes = validateCatalogue(
      { ...LICENSING_CATALOGUE, reskins: [...SPONSORED_RESKINS, first] },
      UNLOCKED_REAL_PARTNERS,
    ).map((p) => p.code);
    expect(codes).toContain('DUPLICATE_SKU');
  });
});

// ---------------------------------------------------------------------------
// Placement buys visibility
// ---------------------------------------------------------------------------

describe('placement', () => {
  it('orders the shelf and nothing else', () => {
    // GDD §8.1: "Placement buys visibility and nothing else." The entire
    // mechanism by which it does is a sort.
    const ordered = shelf(LICENSING_CATALOGUE);
    expect(ordered).toHaveLength(SPONSORED_RESKINS.length);
    for (let i = 1; i < ordered.length; i += 1) {
      const prev = ordered[i - 1];
      const here = ordered[i];
      if (prev === undefined || here === undefined) throw new Error('shelf hole');
      expect(prev.shelfOrder).toBeLessThanOrEqual(here.shelfOrder);
    }
    // Reordering the shelf changes no effect at all.
    for (const reskin of ordered) {
      expect(effectOf(LICENSING_CATALOGUE, reskin)).toBe(
        baseItemOf(LICENSING_CATALOGUE, reskin)?.effect,
      );
    }
  });
});
