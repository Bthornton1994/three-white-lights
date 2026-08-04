/**
 * THE IDENTITY TIER SYSTEM (GDD §7.3), checked by execution.
 *
 * ---------------------------------------------------------------------------
 * WHY THE COMPILE-TIME ASSERTIONS ARE NOT ENOUGH ON THEIR OWN
 * ---------------------------------------------------------------------------
 * `tiers.ts` holds five type-level assertions. Every one of them is a `const`
 * somebody could delete, and `npm test` would not notice — `progression.ts` says
 * the same thing about its own and pairs each with a runtime twin for the same
 * reason. So this file does three things the type system cannot:
 *
 *   1. It runs the reveal path and proves the witness is actually required.
 *   2. It carries `@ts-expect-error` twins for the assignments the types are
 *      supposed to refuse, so if the refusal stops holding the COMPILE fails
 *      (an unused `@ts-expect-error` is itself an error) — the assertions'
 *      polarity, checked from the other side.
 *   3. It reads the real files under `src/art/` and fails if any of them
 *      imports the licensing system. That is §7.3's practical claim — "the
 *      sprite pipeline never has to know a partner exists" — and it is a
 *      property of the dependency graph, which no type can see.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BUILDS,
  IDENTITY_ENTRY_FIELDS,
  IDENTITY_KINDS,
  IDENTITY_TIERS,
  LICENCE_STATUSES,
  SPRITE_SURFACES,
  TIER_1_FIELDS,
  TIER_2_FIELDS,
  TIER_3_SLOTS,
  TIER_3_SURFACES,
  UNLOCKED_REAL_PARTNERS,
  isTier3Surface,
  nameTagOf,
  revealTier3,
  spriteIdentityOf,
  spriteIdentityWithKit,
  tier3Asset,
  tier3Of,
  type SpriteIdentity,
  type Tier3Asset,
  type Tier3Surface,
} from './tiers';
import { HALBERD_GRIP, ILSE_VONDRAK, NINEBAR_ATHLETIC, TEODOR_KESSLING } from './partners';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...filesUnder(full));
    else out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------------------
// The tiers exist and say what §7.3 says
// ---------------------------------------------------------------------------

describe('the three tiers', () => {
  it('is exactly three', () => {
    expect(IDENTITY_TIERS).toHaveLength(3);
    expect([...IDENTITY_TIERS]).toEqual([
      'tier-1-sprite',
      'tier-2-name-tag',
      'tier-3-high-fidelity',
    ]);
  });

  it('puts build, colorway and icon-mark on the sprite, and nothing else', () => {
    // GDD §7.3's Tier 1 row, verbatim: "Build, colorway, icon-mark", never
    // "Wordmark text, face".
    expect([...TIER_1_FIELDS]).toEqual(['build', 'colorway', 'iconMark']);
    expect(TIER_1_FIELDS).not.toContain('wordmark');
    expect(TIER_1_FIELDS).not.toContain('portrait');
    expect(TIER_1_FIELDS).not.toContain('face');
  });

  it('makes the name tag a string, which is why Tier 1 can stay generic', () => {
    expect([...TIER_2_FIELDS]).toEqual(['displayName', 'shortName']);
    const tag = nameTagOf(ILSE_VONDRAK);
    expect(typeof tag.displayName).toBe('string');
    expect(typeof tag.shortName).toBe('string');
  });

  it('carries portrait, wordmark and product at Tier 3', () => {
    expect([...TIER_3_SLOTS]).toEqual(['portrait', 'wordmark', 'product']);
  });

  it('lists exactly GDD §7.3s four Tier 3 surfaces', () => {
    // "It lives on cut-ins (§7.2), character select, the shop screen, and the
    // result card (§6.5)". Pinned, so widening it is an edit somebody argues
    // for rather than a default.
    expect([...TIER_3_SURFACES]).toEqual(['cut-in', 'character-select', 'shop', 'result-card']);
  });

  it('names the sprite surfaces separately, so the prohibition has an operand', () => {
    // `progression.ts` §5(d) records what happens otherwise: an assertion whose
    // other side is a spelling that belongs to nothing cannot fail.
    expect(SPRITE_SURFACES.length).toBeGreaterThan(0);
    for (const surface of SPRITE_SURFACES) {
      expect(TIER_3_SURFACES as readonly string[], `${surface} is a Tier 3 surface`).not.toContain(
        surface,
      );
      expect(isTier3Surface(surface)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// TIER 3 NEVER TOUCHES THE SPRITE — the load-bearing separation
// ---------------------------------------------------------------------------

describe('Tier 3 never appears on the base sprite', () => {
  it('refuses to reveal Tier 3 content to a sprite surface, at runtime', () => {
    const asset = ILSE_VONDRAK.tier3.portrait;
    for (const surface of SPRITE_SURFACES) {
      expect(() => revealTier3(asset, surface as unknown as Tier3Surface)).toThrow(RangeError);
    }
    // ...and hands it over to each of the four §7.3 surfaces.
    for (const surface of TIER_3_SURFACES) {
      expect(revealTier3(asset, surface).slot).toBe('portrait');
    }
  });

  it('refuses a surface nobody named at all', () => {
    expect(() => revealTier3(ILSE_VONDRAK.tier3.wordmark, 'lift-screen' as Tier3Surface)).toThrow(
      /not a Tier 3 surface/,
    );
  });

  it('will not let a Tier 3 asset be assigned into a sprite identity', () => {
    // THE COMPILE-TIME CLAIM, CHECKED FROM THE OTHER SIDE. An unused
    // `@ts-expect-error` is itself a compile error, so if `SpriteIdentity` ever
    // widened to accept an asset, `npx tsc --noEmit` fails HERE as well as at
    // `NO_TIER_3_ASSET_FITS_ANY_SPRITE_FIELD`.
    const asset: Tier3Asset = ILSE_VONDRAK.tier3.wordmark;
    const sprite = spriteIdentityOf(ILSE_VONDRAK);
    const forged: SpriteIdentity = {
      ...sprite,
      // @ts-expect-error a Tier 3 asset is not a colorway
      colorway: asset,
    };
    // The runtime half: the forged object exists (TypeScript is not a
    // sandbox), and what it demonstrates is that the ONLY route to it was an
    // error the compiler reported. Read as "this is what does not compile",
    // not as "this cannot happen".
    expect(forged.build).toBe(sprite.build);
  });

  it('will not let Tier 3 content be read without a surface argument', () => {
    // @ts-expect-error the surface witness is not optional
    expect(() => revealTier3(ILSE_VONDRAK.tier3.product)).toThrow();
  });

  it('exposes no way to read an asset outside this module', () => {
    // The content lives under a module-private symbol, so an ordinary walk of
    // the object finds nothing — which is exactly why `realIp.ts` has a
    // dedicated collector rather than a generic one.
    const asset = ILSE_VONDRAK.tier3.portrait;
    expect(Object.keys(asset)).toEqual([]);
    expect(JSON.stringify(asset)).toBe('{}');
    expect(Object.getOwnPropertySymbols(asset)).toHaveLength(1);
  });

  it('has no string-keyed field for a spread to overwrite', () => {
    // `progression.ts` §6 records a live forgery that got through a partly
    // transparent object wearing a symbol, because object spread copies
    // symbols. A spread here copies the symbol and adds a field no reader
    // looks at.
    const asset = ILSE_VONDRAK.tier3.portrait;
    const spread = { ...asset, caption: 'forged' } as Tier3Asset;
    expect(revealTier3(spread, 'shop').caption).toBe(revealTier3(asset, 'shop').caption);
    expect(revealTier3(spread, 'shop').caption).not.toBe('forged');
  });
});

// ---------------------------------------------------------------------------
// ...AND THE SPRITE PIPELINE DOES NOT KNOW PARTNERS EXIST
// ---------------------------------------------------------------------------

describe('the sprite pipeline never has to know a partner exists', () => {
  const ART_FILES = filesUnder(path.join(ROOT, 'src', 'art'))
    .map((f) => path.relative(ROOT, f).split(path.sep).join('/'))
    .filter((f) => /\.tsx?$/.test(f));

  it('found the art modules at all', () => {
    // Without this the assertion below passes over an empty list.
    expect(ART_FILES.length).toBeGreaterThan(10);
    expect(ART_FILES).toContain('src/art/lifterSprite.ts');
    expect(ART_FILES).toContain('src/art/palette.ts');
  });

  it('has no file under src/art/ importing src/licensing/', () => {
    // §7.3's practical claim: "losing a licensing deal removes rows from a
    // table and swaps some Tier 3 art, rather than forcing a re-render of every
    // animation frame". That is a property of the DEPENDENCY GRAPH, which no
    // type can see, so it is checked by reading the real files.
    //
    // The dependency runs the other way and must: `partners.ts` imports
    // `palette.ts` for its colorway indices. One-way is the whole point.
    const offenders = ART_FILES.filter((f) => /from ['"][^'"]*licensing/.test(readFileSync(path.join(ROOT, f), 'utf8')));
    expect(offenders, `art modules importing licensing: ${offenders.join(', ')}`).toEqual([]);
  });

  it('composes a sponsored sprite as a struct literal, and drops it the same way', () => {
    // The concrete demonstration. Adding a kit sponsor to a lifter's sprite is
    // three fields; removing it is passing the athlete's own Tier 1 instead.
    const unsponsored = spriteIdentityOf(ILSE_VONDRAK);
    const sponsored = spriteIdentityWithKit(ILSE_VONDRAK, NINEBAR_ATHLETIC);
    expect(sponsored.build).toBe(unsponsored.build);
    expect(sponsored.colorway).toBe(NINEBAR_ATHLETIC.tier1.colorway);
    expect(sponsored.iconMark).toBe(NINEBAR_ATHLETIC.tier1.iconMark);
    expect(sponsored.colorway).not.toBe(unsponsored.colorway);
    // Both are the same shape, so nothing downstream branches on sponsorship.
    expect(Object.keys(sponsored).sort()).toEqual(Object.keys(unsponsored).sort());
  });

  it('refuses to put kit on a brand or take a build from one', () => {
    expect(() => spriteIdentityWithKit(NINEBAR_ATHLETIC, HALBERD_GRIP)).toThrow(/no build/);
    expect(() => spriteIdentityWithKit(ILSE_VONDRAK, TEODOR_KESSLING)).toThrow(/must not carry a build/);
  });

  it('projects Tier 1 field by field rather than by spreading the entry', () => {
    // A spread would carry a Tier 3 field along if `SpriteIdentity` were ever
    // widened to accept one. Three named lines cost nothing and remove the
    // class of accident.
    const sprite = spriteIdentityOf(TEODOR_KESSLING);
    expect(Object.keys(sprite).sort()).toEqual([...TIER_1_FIELDS].sort());
  });
});

// ---------------------------------------------------------------------------
// The entry, and the human unlock gate
// ---------------------------------------------------------------------------

describe('an identity entry', () => {
  it('has a field for each tier and nothing outside them', () => {
    expect([...IDENTITY_ENTRY_FIELDS]).toEqual(['id', 'kind', 'licence', 'tier1', 'tier2', 'tier3']);
  });

  it('is either an athlete or a brand', () => {
    expect([...IDENTITY_KINDS]).toEqual(['athlete', 'brand']);
  });

  it('lets a brand have no body', () => {
    expect(BUILDS).toContain('not-a-lifter');
    expect(NINEBAR_ATHLETIC.tier1.build).toBe('not-a-lifter');
    expect(HALBERD_GRIP.tier1.build).toBe('not-a-lifter');
  });

  it('carries all three Tier 3 slots, never a partial one', () => {
    // A partner integrated at Tier 2 only looks finished on a name tag and
    // renders an empty rectangle the first time a cut-in fires.
    for (const entry of [NINEBAR_ATHLETIC, HALBERD_GRIP, ILSE_VONDRAK, TEODOR_KESSLING]) {
      for (const slot of TIER_3_SLOTS) {
        const content = tier3Of(entry, slot, 'character-select');
        expect(content.slot, `${entry.id} ${slot}`).toBe(slot);
        expect(content.alt.length).toBeGreaterThan(0);
        expect(content.caption.length).toBeGreaterThan(0);
        expect(content.art.rows.length).toBeGreaterThan(0);
      }
    }
  });

  it('refuses a Tier 3 asset with nothing on it', () => {
    // A blank licensed surface is what nobody notices until it ships.
    const art = { rows: ['K'], legend: { K: 1 } };
    expect(() => tier3Asset({ slot: 'portrait', alt: '  ', caption: 'x', art })).toThrow(/alt text/);
    expect(() => tier3Asset({ slot: 'portrait', alt: 'x', caption: '', art })).toThrow(/caption/);
    expect(() =>
      tier3Asset({ slot: 'portrait', alt: 'x', caption: 'y', art: { rows: [], legend: {} } }),
    ).toThrow(/drawing/);
  });
});

describe('the human unlock gate', () => {
  it('has two statuses and no third', () => {
    expect([...LICENCE_STATUSES]).toEqual(['fictional-placeholder', 'human-unlocked']);
  });

  it('is empty, and stays empty until a human types a name into it', () => {
    // CLAUDE.md: "The licensing system stays populated with fictional
    // placeholders only until a human explicitly unlocks a specific real
    // partner by name, once an actual licensing agreement exists."
    //
    // This assertion failing is not a bug. It means somebody unlocked a
    // partner, which is exactly the deliberate act the rule describes — and it
    // should be a visible line in a diff with a name attached.
    expect(UNLOCKED_REAL_PARTNERS).toEqual([]);
  });

  it('marks every shipped entry a fictional placeholder', () => {
    for (const entry of [NINEBAR_ATHLETIC, HALBERD_GRIP, ILSE_VONDRAK, TEODOR_KESSLING]) {
      expect(entry.licence, entry.id).toBe('fictional-placeholder');
    }
  });
});
