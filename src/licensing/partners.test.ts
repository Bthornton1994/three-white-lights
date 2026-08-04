/**
 * THE TABLE (GDD §7.3): the fictional entries, checked as data.
 *
 * This file's job is the second clause of this piece's bar — "the fictional
 * entries fully exercise all three tiers end to end". It checks that every entry
 * is complete at all three tiers, that the drawings are well formed and use
 * colours the palette actually has, and that the icon-marks honour §7.3's "no
 * wordmark on the sprite" rather than merely being in a field called `iconMark`.
 *
 * The real-IP half is in `realIp.test.ts`, where the watchlist lives.
 */

import { describe, expect, it } from 'vitest';

import {
  ART_LEGEND,
  BASE_ITEMS,
  HALBERD_COLORWAY,
  HALBERD_GRIP,
  HOUSE_COLORWAY,
  IDENTITY_ENTRIES,
  ILSE_VONDRAK,
  KESSLING_COLORWAY,
  LICENSING_CATALOGUE,
  NINEBAR_ATHLETIC,
  NINEBAR_COLORWAY,
  SPONSORED_RESKINS,
  TEODOR_KESSLING,
  VONDRAK_COLORWAY,
} from './partners';
import {
  TIER_3_SLOTS,
  UNLOCKED_REAL_PARTNERS,
  iconMarkProblems,
  spriteIdentityWithKit,
  tier3ArtProblems,
  tier3Of,
  type Colorway,
  type IconMark,
} from './tiers';
import { validateCatalogue } from './catalogue';
import { sheetColorAt } from '../card/sheetPalette';
import { FONT } from '../card/pixelFont';

const COLORWAYS: readonly Colorway[] = [
  HOUSE_COLORWAY,
  NINEBAR_COLORWAY,
  HALBERD_COLORWAY,
  VONDRAK_COLORWAY,
  KESSLING_COLORWAY,
];

// ---------------------------------------------------------------------------
// The catalogue is complete and consistent
// ---------------------------------------------------------------------------

describe('the licensing catalogue', () => {
  it('has both kinds of entry, so both paths are exercised', () => {
    // "at least one sponsor brand and one athlete". A table with only brands
    // would leave `spriteIdentityWithKit` and the portrait slot unexercised.
    expect(IDENTITY_ENTRIES.filter((e) => e.kind === 'brand').length).toBeGreaterThan(0);
    expect(IDENTITY_ENTRIES.filter((e) => e.kind === 'athlete').length).toBeGreaterThan(0);
    expect(IDENTITY_ENTRIES.length).toBeGreaterThan(1);
  });

  it('validates', () => {
    expect(validateCatalogue(LICENSING_CATALOGUE, UNLOCKED_REAL_PARTNERS)).toEqual([]);
  });

  it('gives every entry a unique id, colorway and mark', () => {
    const ids = IDENTITY_ENTRIES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const colorways = IDENTITY_ENTRIES.map((e) => e.tier1.colorway.id);
    expect(new Set(colorways).size).toBe(colorways.length);
    const marks = IDENTITY_ENTRIES.map((e) => e.tier1.iconMark.id);
    expect(new Set(marks).size).toBe(marks.length);
  });

  it('keeps a house colorway to fall back to when a deal ends', () => {
    // §7.3's practical claim: losing a licensing deal is passing this instead
    // of the partner's. If there were nothing to fall back to, the claim would
    // be untested and the fallback would be written under pressure.
    expect(HOUSE_COLORWAY.id).toBe('house');
    expect(IDENTITY_ENTRIES.every((e) => e.tier1.colorway !== HOUSE_COLORWAY)).toBe(true);
  });

  it('sells only reskins of items that exist on their own', () => {
    // The residual `catalogue.ts` names: a sponsor-only base item would be
    // sponsor-shaped without being a sponsor stat effect. This is the weaker,
    // checkable half — every base item is in the catalogue in its own right.
    for (const reskin of SPONSORED_RESKINS) {
      expect(BASE_ITEMS.map((i) => i.sku), reskin.sku).toContain(reskin.reskins);
    }
  });

  it('reskins the functional item as well as the cosmetic ones', () => {
    // GDD §8.1's own example is a sponsored RECOVERY product. A table with only
    // cosmetics would leave the interesting guarantee unexercised.
    const kinds = new Set(
      SPONSORED_RESKINS.map(
        (r) => BASE_ITEMS.find((i) => i.sku === r.reskins)?.effect.kind ?? 'missing',
      ),
    );
    expect(kinds.has('cosmetic')).toBe(true);
    expect(kinds.has('recovery-day')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TIER 1 — the sprite half
// ---------------------------------------------------------------------------

describe('Tier 1', () => {
  it('points every colorway at a colour the palette actually has', () => {
    // A colorway is three palette INDICES; a hue that is not allocated renders
    // as nothing, which on a shop screen is an empty swatch nobody notices.
    for (const colorway of COLORWAYS) {
      for (const [name, index] of [
        ['dark', colorway.dark],
        ['mid', colorway.mid],
        ['light', colorway.light],
      ] as const) {
        expect(sheetColorAt(index), `${colorway.id}.${name}`).toBeDefined();
      }
    }
  });

  it('gives every colorway three distinct steps', () => {
    for (const colorway of COLORWAYS) {
      const steps = new Set([colorway.dark, colorway.mid, colorway.light]);
      expect(steps.size, `${colorway.id} is not a three-step ramp`).toBe(3);
    }
  });

  it('carries an icon-mark and never a wordmark', () => {
    // The check §7.3 actually asks for, rather than trusting the field's name.
    // See `iconMarkProblems` for what it can and cannot prove.
    for (const entry of IDENTITY_ENTRIES) {
      expect(iconMarkProblems(entry.tier1.iconMark), entry.id).toEqual([]);
    }
  });

  it('rejects a mark tall enough to set type in, so the bound can fire', () => {
    // NON-VACUITY on the check above. A bound nothing can fail is not a bound,
    // and the shape it would fail on is exactly "somebody used the logotype
    // asset because it was the one they had".
    const logotype: IconMark = {
      id: 'a-logotype-in-the-sprite-slot',
      rows: Array.from({ length: FONT.CAP_H + 1 }, () => 'KKKKK'),
    };
    const problems = iconMarkProblems(logotype);
    expect(problems.join(' ')).toMatch(/capital letter/);
  });

  it('rejects a two-colour mark, and an empty one', () => {
    expect(iconMarkProblems({ id: 'two-tone', rows: ['KG', 'GK'] }).join(' ')).toMatch(
      /ink colours/,
    );
    expect(iconMarkProblems({ id: 'blank', rows: ['..', '..'] }).join(' ')).toMatch(/no ink/);
    expect(iconMarkProblems({ id: 'ragged', rows: ['K', 'KK'] }).join(' ')).toMatch(/ragged/);
  });

  it('composes a brand kit onto an athlete build', () => {
    const sponsored = spriteIdentityWithKit(TEODOR_KESSLING, HALBERD_GRIP);
    expect(sponsored.build).toBe('heavyweight');
    expect(sponsored.colorway.id).toBe(HALBERD_COLORWAY.id);
    expect(sponsored.iconMark.id).toBe(HALBERD_GRIP.tier1.iconMark.id);
  });

  it('gives the two athletes different builds, so the field is not a constant', () => {
    expect(ILSE_VONDRAK.tier1.build).not.toBe(TEODOR_KESSLING.tier1.build);
  });
});

// ---------------------------------------------------------------------------
// TIER 2 — the name tag
// ---------------------------------------------------------------------------

describe('Tier 2', () => {
  it('gives every entry a display name and a shorter one', () => {
    for (const entry of IDENTITY_ENTRIES) {
      expect(entry.tier2.displayName.trim().length, entry.id).toBeGreaterThan(0);
      expect(entry.tier2.shortName.trim().length, entry.id).toBeGreaterThan(0);
      expect(entry.tier2.shortName.length, `${entry.id} short name is not shorter`).toBeLessThanOrEqual(
        entry.tier2.displayName.length,
      );
    }
  });

  it('uses only characters the card font can set', () => {
    // A name tag that renders as a row of hollow boxes is a licensing bug that
    // only shows up in a screenshot. The font folds accents, so this is about
    // scripts it has no glyph for at all.
    const settable = /^[ -~À-ɏ.]+$/;
    for (const entry of IDENTITY_ENTRIES) {
      expect(settable.test(entry.tier2.displayName), entry.tier2.displayName).toBe(true);
      expect(settable.test(entry.tier2.shortName), entry.tier2.shortName).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// TIER 3 — the high-fidelity half
// ---------------------------------------------------------------------------

describe('Tier 3', () => {
  it('fills all three slots for every entry', () => {
    for (const entry of IDENTITY_ENTRIES) {
      for (const slot of TIER_3_SLOTS) {
        expect(tier3Of(entry, slot, 'shop').slot, `${entry.id} ${slot}`).toBe(slot);
      }
    }
  });

  it('draws well-formed art in every slot', () => {
    for (const entry of IDENTITY_ENTRIES) {
      for (const slot of TIER_3_SLOTS) {
        const content = tier3Of(entry, slot, 'shop');
        expect(tier3ArtProblems(content.art), `${entry.id} ${slot}`).toEqual([]);
      }
    }
  });

  it('rejects ragged art and an unlegended character, so the check can fire', () => {
    expect(tier3ArtProblems({ rows: ['KK', 'K'], legend: { K: 1 } }).join(' ')).toMatch(/wide/);
    expect(tier3ArtProblems({ rows: ['KX'], legend: { K: 1 } }).join(' ')).toMatch(/no legend/);
    expect(tier3ArtProblems({ rows: [], legend: {} }).join(' ')).toMatch(/must have rows/);
  });

  it('uses only palette indices that resolve to a colour', () => {
    // Every legend entry, not only the ones a drawing happens to use: an
    // unallocated index is a hole waiting for the next drawing to fall into.
    for (const [ch, index] of Object.entries(ART_LEGEND)) {
      expect(sheetColorAt(index), `legend "${ch}" -> ${index}`).toBeDefined();
    }
  });

  it('draws something in every slot, not an empty rectangle', () => {
    // A blank licensed surface is exactly what nobody notices until it ships.
    for (const entry of IDENTITY_ENTRIES) {
      for (const slot of TIER_3_SLOTS) {
        const { art } = tier3Of(entry, slot, 'shop');
        const inked = art.rows.join('').split('').filter((ch) => ch !== '.').length;
        expect(inked, `${entry.id} ${slot} is blank`).toBeGreaterThan(0);
        // ...and more than a token pixel or two.
        expect(inked, `${entry.id} ${slot} is nearly blank`).toBeGreaterThan(art.rows.length);
      }
    }
  });

  it('gives an athlete a face and a brand a shopfront', () => {
    // The reason Tier 3 exists: at 30 pixels a face is a smear, so it lives
    // here instead. A brand has no likeness and must not be given an invented
    // one, so its portrait slot holds a banner.
    for (const entry of [ILSE_VONDRAK, TEODOR_KESSLING]) {
      expect(tier3Of(entry, 'portrait', 'cut-in').alt).toMatch(/head and shoulders/);
    }
    for (const entry of [NINEBAR_ATHLETIC, HALBERD_GRIP]) {
      expect(tier3Of(entry, 'portrait', 'cut-in').alt).toMatch(/banner/);
    }
  });

  it('gives every asset alt text that describes it, not its slot name', () => {
    for (const entry of IDENTITY_ENTRIES) {
      for (const slot of TIER_3_SLOTS) {
        const content = tier3Of(entry, slot, 'result-card');
        expect(content.alt.length, `${entry.id} ${slot}`).toBeGreaterThan(slot.length * 2);
        expect(content.alt).not.toBe(slot);
      }
    }
  });
});
