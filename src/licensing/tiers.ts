/**
 * tiers.ts — THE IDENTITY TIER SYSTEM (GDD §7.3), as types.
 *
 * PURE MODULE (CLAUDE.md "Pure logic is separate from UI"): zero React imports,
 * zero side effects, zero I/O, no clock, no randomness, explicit return types on
 * every export. It also holds no numeric literal at all, deliberately, so it
 * never needs a `SOURCE_RULES` registration in `src/tuning/audit.ts` — the
 * drawings and the layout live elsewhere.
 *
 * NO REAL IDENTITY IS POPULATED BY THIS FILE OR ANY FILE THAT IMPORTS IT. GDD
 * §7.3 and §12.3, and CLAUDE.md's "No real identity, until a human unlocks one":
 * every entry in the licensing system is a fictional placeholder until a human
 * writes a specific partner into `UNLOCKED_REAL_PARTNERS` below against an
 * actual agreement. That list is empty, is asserted empty, and is scanned by
 * `realIp.ts` like everything else.
 *
 * ===========================================================================
 * 1. WHAT THIS MODULE CLAIMS, AND THE ONE SENTENCE IT REDUCES TO
 * ===========================================================================
 *
 * **Tier 3 content cannot be read without naming a Tier 3 surface, and the base
 * sprite is not one.**
 *
 * That is the load-bearing half of §7.3 — "Tier 3 never appears on the base
 * sprite" — expressed as a type rather than as a comment saying it shouldn't.
 * Everything else here is the mechanism that makes that sentence true.
 *
 * ===========================================================================
 * 2. THE THREE TIERS
 * ===========================================================================
 *
 *   Tier 1 — THE BASE SPRITE. Build, colorway, icon-mark. `SpriteIdentity`.
 *            No wordmark text, no face. A 30-pixel figure cannot legibly carry
 *            either and a licensed wordmark rendered into one is a brand
 *            guideline violation, so neither was ever load-bearing.
 *   Tier 2 — THE NAME TAG. `NameTag`. Identification is a STRING, so it works
 *            for a real name the moment one is licensed with no art dependency
 *            at all. Tier 2 is the whole reason Tier 1 can stay generic.
 *   Tier 3 — HIGH FIDELITY. `Tier3Asset`. Portrait, wordmark, product. Lives on
 *            cut-ins (§7.2), character select, the shop screen and the result
 *            card (§6.5) — large, static, deliberate surfaces.
 *
 * ===========================================================================
 * 3. WHY `Tier3Asset` IS OPAQUE AND NOT A BRANDED STRING
 * ===========================================================================
 *
 * The obvious construction — `type Wordmark = string & { [W]: 'wordmark' }` —
 * DOES NOT WORK, for the same family of reason `progression.ts` §2 records about
 * object brands, and it is worth writing down so nobody "simplifies" this file
 * back into it.
 *
 * A branded string IS a string. So:
 *
 *     const sprite: SpriteIdentity = { ...base, iconMark: partner.wordmark };
 *
 * typechecks the moment any Tier 1 field is string-shaped, which is exactly the
 * accident §7.3 exists to prevent — a licensed wordmark arriving on the sprite
 * because both ends of the assignment were "a string". A brand narrows what can
 * be assigned INTO the branded type; it does nothing about assigning the branded
 * value OUT into the unbranded world, and "out" is the direction that matters
 * here.
 *
 * So a Tier 3 asset is an OBJECT WITH EXACTLY ONE PROPERTY, KEYED BY A
 * MODULE-PRIVATE `unique symbol` — the idiom `meet.ts` uses for its loading
 * rules and `progression.ts` uses for `ProgressionSnapshot`. Outside this module
 * the key cannot be named, so the content cannot be read; and the object is not
 * assignable to a string, a number or any Tier 1 field, so it cannot be carried
 * into a sprite path by an ordinary assignment at all.
 *
 * ONE PROPERTY, NOT ONE PROPERTY PLUS SOME. `progression.ts` §6 documents a live
 * forgery that got through a partly transparent object wearing a symbol, because
 * object spread copies symbols. `Tier3Asset` has no string-keyed field for a
 * spread to overwrite, and `A_TIER_3_ASSET_HAS_NO_STRING_KEY` pins that.
 *
 * ===========================================================================
 * 4. THE SURFACE WITNESS
 * ===========================================================================
 *
 * `revealTier3(asset, surface)` is the only reader, and `surface` is a
 * `Tier3Surface` — one of §7.3's four. `'base-sprite'` is a `SpriteSurface`, a
 * disjoint union, so the sprite path cannot supply a witness even if it somehow
 * came to hold an asset. `THE_BASE_SPRITE_IS_NOT_A_TIER_3_SURFACE` asserts the
 * disjointness and two non-vacuity guards stop it passing over an empty set,
 * because a disjointness assertion is worth exactly what its operands are worth
 * (`progression.ts` §5(b)).
 *
 * The witness is checked at RUNTIME as well, because a type-level guard that
 * gets deleted is invisible to `npm test`.
 *
 * ===========================================================================
 * 5. WHAT THIS DOES NOT CLOSE — stated plainly
 * ===========================================================================
 *
 *  - A CAST DEFEATS ALL OF IT. `x as unknown as SpriteIdentity` compiles,
 *    exactly as a cast defeats `dots.ts`'s brands and `progression.ts`'s. None
 *    of this is tamper resistance. It closes the assignments that used to
 *    typecheck and look innocent in a diff.
 *  - IT CANNOT STOP A RENDERER DRAWING A REVEALED ASSET IN THE WRONG PLACE.
 *    Once `revealTier3` has handed back content, what a component does with it
 *    is the component's business. What the witness buys is that the wrong place
 *    has to NAME ITSELF as a Tier 3 surface to get the content at all, which is
 *    a deliberate line in a diff rather than a silent one.
 *  - THE SPRITE PIPELINE'S IGNORANCE IS A TEST, NOT A TYPE. Nothing in the
 *    language stops `src/art/lifterSprite.ts` importing this module. What stops
 *    it is `tiers.test.ts`, which reads the real files under `src/art/` and
 *    fails if any of them imports `src/licensing/`. That is the practical half
 *    of §7.3 — "losing a licensing deal removes rows from a table rather than
 *    forcing a re-render of every animation frame" — and it is checked by
 *    execution rather than asserted here.
 *  - `alt` AND `caption` ARE STRINGS AND STRINGS RENDER. A Tier 3 asset's text
 *    is not fenced from the sprite by the type system, because text has to be
 *    printable to be useful. It is fenced by `realIp.ts`, which scans every one
 *    of them as renderable content.
 */

// The ONLY runtime import this module has, and it is here so the "an icon-mark
// is too short to set type in" bound is the card font's own cap height rather
// than a number somebody picked. See `iconMarkProblems`.
import { FONT } from '../card/pixelFont';

// ---------------------------------------------------------------------------
// Type-level helpers. These carry the boundary; they emit no code.
//
// Same shapes as `progression.ts`'s, deliberately: a fourth spelling of
// "these two unions are disjoint" in the same codebase is a fourth thing to
// get subtly wrong. Duplicated rather than imported because `progression.ts`
// does not export them and this module has no other reason to depend on it.
// ---------------------------------------------------------------------------

/** `true` when `keyof T` is EXACTLY `Keys`. Tuple-wrapped so unions do not distribute. */
type KeysAreExactly<T, Keys extends string> = [Exclude<keyof T, Keys>] extends [never]
  ? [Exclude<Keys, keyof T>] extends [never]
    ? true
    : never
  : never;

/** `true` when the two unions are the same set. */
type UnionIsExactly<A, B> = [Exclude<A, B>] extends [never]
  ? [Exclude<B, A>] extends [never]
    ? true
    : never
  : never;

/** `true` when the two unions share no member. Vacuously true for `never`. */
type AreDisjoint<A, B> = [Extract<A, B>] extends [never] ? true : never;

/**
 * `true` when the union has at least one member. Pairs with `AreDisjoint` so a
 * disjointness assertion cannot pass by having nothing left to compare.
 */
type IsNonEmptyUnion<A> = [A] extends [never] ? never : true;

/**
 * `true` when `A` is NOT assignable to `B`.
 *
 * The opposite polarity to the usual subtype check, and the polarity is the
 * point: this file's claims are about what must NOT fit, so the assertion has to
 * fail by something starting to fit rather than by something stopping.
 */
type IsNotAssignableTo<A, B> = [A] extends [B] ? never : true;

// ---------------------------------------------------------------------------
// The tiers, named
// ---------------------------------------------------------------------------

/**
 * The three tiers of GDD §7.3, as ids rather than as the numbers 1/2/3.
 *
 * Ids on purpose: a tier is a name for a surface class, nothing here does
 * arithmetic on it, and a bare `3` in this file would be a magic number the
 * `src/tuning/audit.ts` scan would rightly report.
 */
export const IDENTITY_TIERS = ['tier-1-sprite', 'tier-2-name-tag', 'tier-3-high-fidelity'] as const;

export type IdentityTier = (typeof IDENTITY_TIERS)[number];

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

/**
 * WHERE TIER 3 IS ALLOWED TO APPEAR. GDD §7.3, verbatim: "cut-ins (§7.2),
 * character select, the shop screen, and the result card (§6.5)".
 *
 * Large, static and deliberate surfaces, where detail reads and a mark can be
 * reproduced faithfully enough to satisfy a brand guideline. `tiers.test.ts`
 * pins this list against that sentence, so widening it is an edit somebody has
 * to argue for rather than a default.
 */
export const TIER_3_SURFACES = ['cut-in', 'character-select', 'shop', 'result-card'] as const;

export type Tier3Surface = (typeof TIER_3_SURFACES)[number];

/**
 * WHERE TIER 3 IS NOT ALLOWED TO APPEAR, named so the prohibition has an operand
 * instead of being a gap.
 *
 * `progression.ts` §5(d) records what happens otherwise: an assertion whose
 * other side is a hard-coded spelling that is deliberately not a member of
 * anything cannot fail, and sits in the file looking like enforcement.
 */
export const SPRITE_SURFACES = ['base-sprite', 'sprite-inspection-sheet'] as const;

export type SpriteSurface = (typeof SPRITE_SURFACES)[number];

/**
 * COMPILE-TIME ASSERTION (GDD §7.3): THE BASE SPRITE IS NOT A TIER 3 SURFACE.
 *
 * The load-bearing separation. Adding `'base-sprite'` to `TIER_3_SURFACES` — the
 * one edit that would let a licensed wordmark be revealed into a 30-pixel figure
 * — fails here.
 */
export const THE_BASE_SPRITE_IS_NOT_A_TIER_3_SURFACE: AreDisjoint<Tier3Surface, SpriteSurface> =
  true;

/** Non-vacuity, both operands. Disjointness over `never` is free. */
export const TIER_3_SURFACES_ARE_NOT_VACUOUS: IsNonEmptyUnion<Tier3Surface> = true;
export const SPRITE_SURFACES_ARE_NOT_VACUOUS: IsNonEmptyUnion<SpriteSurface> = true;

/** Runtime membership, for the reveal check and for anything that renders the list. */
export function isTier3Surface(value: string): value is Tier3Surface {
  return (TIER_3_SURFACES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Tier 1 — the base sprite
// ---------------------------------------------------------------------------

/**
 * Body builds the sprite pipeline can draw.
 *
 * `'not-a-lifter'` is what a BRAND carries. A brand has no body; its Tier 1
 * presence is a colorway and an icon-mark on somebody else's kit, which is what
 * `spriteIdentityWithKit` composes. Modelled explicitly rather than as an
 * optional field so the exhaustiveness checks below stay total.
 */
export const BUILDS = ['compact', 'long-limbed', 'heavyweight', 'not-a-lifter'] as const;

export type BuildKey = (typeof BUILDS)[number];

/**
 * A colorway: which palette indices the kit's three singlet ramp steps use.
 *
 * INDICES, NOT COLOURS. The actual hues stay in `src/art/palette.ts`, which is a
 * registered palette module and not this piece's to edit. A colorway that
 * carried `#rrggbb` strings would be a colour literal outside a palette module
 * and `src/tuning/audit.ts` would report it — correctly.
 */
export interface Colorway {
  readonly id: string;
  readonly dark: number;
  readonly mid: number;
  readonly light: number;
}

/**
 * An abstract icon-mark: a few pixels of shape, no text.
 *
 * §7.3: Tier 1 carries an ICON-MARK, never a wordmark. The distinction is not
 * decorative — a chevron reads at sprite scale and a word does not, and a
 * licensed word rendered into 30 pixels violates the guideline it was licensed
 * under. `ICON_MARKS_CARRY_NO_TEXT` in `partners.test.ts` checks the drawings
 * actually honour that rather than trusting the name of the field.
 */
export interface IconMark {
  readonly id: string;
  /** Rows of the mark, one character per pixel. `.` paints nothing. */
  readonly rows: readonly string[];
}

/** The character that paints nothing in an authored drawing. */
const BLANK = '.';

/**
 * WHAT IS WRONG WITH AN ICON-MARK, IF ANYTHING. Empty array for a good one.
 *
 * §7.3 says Tier 1 carries an icon-mark and NEVER a wordmark, and a field named
 * `iconMark` does not make its contents one. This is the check that does, and
 * it has two parts:
 *
 *   - TOO SHORT TO SET TYPE IN. The bound is `FONT.CAP_H`, the card font's own
 *     cap height, rather than a number somebody picked: a mark shorter than a
 *     capital letter cannot contain one, whatever is drawn in it. Read against
 *     the real font so it moves if the font does.
 *   - ONE INK COLOUR. A mark is a silhouette. Two colours is the beginning of
 *     artwork, and artwork at sprite scale is the smear §7.3 is about.
 *
 * NEITHER IS A PROOF. A four-row mark could still be a crude two-letter
 * monogram, and nothing here can read a shape. It is a floor under the honest
 * mistake — somebody putting a logotype in the sprite slot because it was the
 * asset they had — in the same spirit as `progression.ts`'s
 * `PERFORMANCE_FACT_VOCABULARY`, and it is stated as a floor rather than
 * glossed as a guarantee.
 */
export function iconMarkProblems(mark: IconMark): readonly string[] {
  const problems: string[] = [];
  if (mark.rows.length === 0) problems.push(`${mark.id}: an icon-mark must have rows`);
  if (mark.rows.length >= FONT.CAP_H) {
    problems.push(
      `${mark.id}: ${mark.rows.length} rows is tall enough to set a capital letter in (cap height ${FONT.CAP_H}) — Tier 1 carries no wordmark`,
    );
  }
  const width = mark.rows[0]?.length ?? 0;
  const ink = new Set<string>();
  for (const row of mark.rows) {
    if (row.length !== width) problems.push(`${mark.id}: ragged row "${row}"`);
    for (const ch of row) if (ch !== BLANK) ink.add(ch);
  }
  if (ink.size === 0) problems.push(`${mark.id}: an icon-mark with no ink is an empty slot`);
  if (ink.size > 1) {
    problems.push(`${mark.id}: ${ink.size} ink colours — an icon-mark is a silhouette, not artwork`);
  }
  return problems;
}

/**
 * WHAT IS WRONG WITH A TIER 3 DRAWING, IF ANYTHING.
 *
 * Shape only: rectangular, non-empty, and every inked character has a legend
 * entry. Whether the legend's indices name allocated palette slots is checked in
 * `partners.test.ts`, where the palette is in scope — this module deliberately
 * does not depend on `src/art/palette.ts`, so that the licensing types stay
 * importable without pulling the renderer in.
 */
export function tier3ArtProblems(art: Tier3Art): readonly string[] {
  const problems: string[] = [];
  if (art.rows.length === 0) return ['a drawing must have rows'];
  const width = art.rows[0]?.length ?? 0;
  if (width === 0) problems.push('a drawing must have columns');
  art.rows.forEach((row, y) => {
    if (row.length !== width) {
      problems.push(`row ${y} is ${row.length} wide, expected ${width}`);
    }
    for (const ch of row) {
      if (ch === BLANK) continue;
      if (art.legend[ch] === undefined) problems.push(`row ${y} uses "${ch}", which has no legend`);
    }
  });
  return problems;
}

/**
 * TIER 1 — EVERYTHING THE SPRITE PIPELINE IS ALLOWED TO SEE.
 *
 * Three fields, and `SPRITE_IDENTITY_IS_EXACTLY_TIER_1` below makes adding a
 * fourth a compile error until it is written into `TIER_1_FIELDS`.
 */
export interface SpriteIdentity {
  readonly build: BuildKey;
  readonly colorway: Colorway;
  readonly iconMark: IconMark;
}

/** The §7.3 Tier 1 column, as an allowlist. */
export const TIER_1_FIELDS = ['build', 'colorway', 'iconMark'] as const;

export type Tier1Field = (typeof TIER_1_FIELDS)[number];

/**
 * COMPILE-TIME ASSERTION (GDD §7.3): the sprite's identity is exactly build,
 * colorway and icon-mark.
 *
 * Adding `readonly wordmark: Tier3Asset` to `SpriteIdentity` — the exact shape
 * §7.3 forbids — fails here, and fails again at
 * `NO_TIER_3_ASSET_FITS_ANY_SPRITE_FIELD` below. Twice on purpose: this one
 * catches the field, that one catches the type, and an author who deletes one
 * still meets the other.
 */
export const SPRITE_IDENTITY_IS_EXACTLY_TIER_1: KeysAreExactly<SpriteIdentity, Tier1Field> = true;

// ---------------------------------------------------------------------------
// Tier 2 — the name tag
// ---------------------------------------------------------------------------

/**
 * TIER 2 — THE ACTUAL IDENTIFICATION, and it is a string.
 *
 * §7.3: "Because identification is a string, it works for a real name the moment
 * one is licensed, with no art dependency at all." So there is nothing clever
 * here and there must not be: the whole value of Tier 2 is that swapping
 * `displayName` is the entire integration.
 *
 * `shortName` exists because the surfaces are small — a result card's identity
 * strip steps a long name down to single height (`lifterStrip` in
 * `renderResultCard.ts`) and a shop shelf has less room than that.
 */
export interface NameTag {
  readonly displayName: string;
  readonly shortName: string;
}

export const TIER_2_FIELDS = ['displayName', 'shortName'] as const;

export type Tier2Field = (typeof TIER_2_FIELDS)[number];

export const NAME_TAG_IS_EXACTLY_TIER_2: KeysAreExactly<NameTag, Tier2Field> = true;

// ---------------------------------------------------------------------------
// Tier 3 — high fidelity, behind a symbol
// ---------------------------------------------------------------------------

/** The three things §7.3 says Tier 3 carries. */
export const TIER_3_SLOTS = ['portrait', 'wordmark', 'product'] as const;

export type Tier3Slot = (typeof TIER_3_SLOTS)[number];

/**
 * Authored high-fidelity pixel art.
 *
 * A table of characters and a legend mapping each to a palette index, the same
 * authoring idiom as `src/art/spriteMarks.ts` and `src/art/gymProps.ts`. DATA,
 * not a generator: if a portrait is wrong the fix is to move a character in a
 * string, not to tune a model.
 *
 * GDD §7.2 says to cut cut-in art from the early prototypes and use placeholder
 * rectangles until meet day is proven to land. These drawings are that
 * placeholder tier: real authored pixels so the pipeline is exercised
 * end-to-end, at a fidelity nobody should mistake for finished art.
 */
export interface Tier3Art {
  readonly rows: readonly string[];
  readonly legend: Readonly<Record<string, number>>;
}

/** What a Tier 3 asset actually contains, once a surface has been named. */
export interface Tier3Content {
  readonly slot: Tier3Slot;
  /** What a screen reader would read. Scanned by `realIp.ts` as renderable text. */
  readonly alt: string;
  /** The line set under the art — the wordmark itself, or a product caption. */
  readonly caption: string;
  readonly art: Tier3Art;
}

export const TIER_3_CONTENT_FIELDS = ['slot', 'alt', 'caption', 'art'] as const;

export type Tier3ContentField = (typeof TIER_3_CONTENT_FIELDS)[number];

export const TIER_3_CONTENT_IS_EXACTLY_ITS_ALLOWLIST: KeysAreExactly<
  Tier3Content,
  Tier3ContentField
> = true;

/**
 * MODULE-PRIVATE, AND A REAL SYMBOL RATHER THAN A `declare const`.
 *
 * The `declare const X: unique symbol` idiom this file first reached for is the
 * one `progression.ts` uses for its `Confirmed`/`Projected` BRANDS, and it is
 * wrong here: a declared symbol emits no code, so `{ [TIER_3_CONTENT]: content }`
 * throws `ReferenceError` at the first call. A brand is never written at
 * runtime; an opaque container's key is written on every construction.
 * `SNAPSHOT_CONTENTS` in `progression.ts` is the idiom this actually copies.
 *
 * Not exported, so no caller outside this module can name the key.
 */
const TIER_3_CONTENT: unique symbol = Symbol('licensing.tier3');

/**
 * A TIER 3 ASSET. Opaque: one property, under a symbol this module does not
 * export.
 *
 * A caller outside this module cannot name the key, so cannot read the content
 * and cannot construct one. More importantly for §7.3, the value is an object
 * with no string-keyed field, so it is not assignable to `string`, to `number`,
 * or to any Tier 1 field — a licensed wordmark cannot arrive on the sprite by
 * an ordinary assignment. See §3 of the header for why a branded string does not
 * achieve this and would look like it did.
 */
export interface Tier3Asset {
  readonly [TIER_3_CONTENT]: Tier3Content;
}

/**
 * COMPILE-TIME ASSERTION: a Tier 3 asset has no string-keyed property.
 *
 * `progression.ts` §6 records the live forgery that got through a partly
 * transparent object wearing a symbol — object spread copies symbols, so
 * `{ ...asset, caption: 'x' }` would have produced a value of the type with a
 * field a reader might look at. There is nothing string-keyed here to overwrite.
 */
export const A_TIER_3_ASSET_HAS_NO_STRING_KEY: [keyof Tier3Asset & string] extends [never]
  ? true
  : never = true;

/**
 * COMPILE-TIME ASSERTION (GDD §7.3): NO TIER 3 ASSET FITS ANY TIER 1 FIELD.
 *
 * The sentence "Tier 3 never appears on the base sprite", as a type. It fails by
 * something STARTING to fit, which is the polarity a prohibition needs: adding
 * `readonly wordmark: Tier3Asset` to `SpriteIdentity` widens
 * `SpriteIdentity[keyof SpriteIdentity]` to include `Tier3Asset`, the
 * assignability check flips to `true`, `IsNotAssignableTo` yields `never`, and
 * `= true` stops compiling.
 *
 * IT IS NOT VACUOUS AND THAT IS CHECKABLE: `SPRITE_IDENTITY_IS_EXACTLY_TIER_1`
 * above proves the right operand still names real fields, and
 * `tiers.test.ts` carries the `@ts-expect-error` twin — an attempted assignment
 * of a real asset into a real sprite identity — so the assertion cannot be the
 * only thing standing between the two.
 */
export const NO_TIER_3_ASSET_FITS_ANY_SPRITE_FIELD: IsNotAssignableTo<
  Tier3Asset,
  SpriteIdentity[keyof SpriteIdentity]
> = true;

/**
 * THE SINGLE MINT. Module-private construction is not available to callers, so
 * every Tier 3 asset in the app traces back through this one function — which
 * makes "what Tier 3 content exists" a greppable question with one answer.
 *
 * @throws {RangeError} on empty alt text, an empty caption or an empty drawing.
 *   A Tier 3 surface with nothing on it is a licensing bug that renders as a
 *   blank rectangle, and a blank rectangle is exactly what nobody notices.
 */
export function tier3Asset(content: Tier3Content): Tier3Asset {
  if (content.alt.trim().length === 0) {
    throw new RangeError('tiers: a Tier 3 asset must carry alt text');
  }
  if (content.caption.trim().length === 0) {
    throw new RangeError('tiers: a Tier 3 asset must carry a caption');
  }
  if (content.art.rows.length === 0) {
    throw new RangeError('tiers: a Tier 3 asset must carry a drawing');
  }
  return { [TIER_3_CONTENT]: content };
}

/**
 * THE SINGLE READER, and it requires a Tier 3 surface to name itself.
 *
 * The runtime half of `THE_BASE_SPRITE_IS_NOT_A_TIER_3_SURFACE`. The type half
 * is the real fence; this exists because a type-level assertion that gets
 * deleted is invisible to `npm test`, and because a `.tsx` file reaching for
 * `revealTier3(asset, 'base-sprite' as Tier3Surface)` should not be quietly
 * rewarded for the cast.
 *
 * @throws {RangeError} if `surface` is not one of GDD §7.3's four.
 */
export function revealTier3(asset: Tier3Asset, surface: Tier3Surface): Tier3Content {
  if (!isTier3Surface(surface)) {
    throw new RangeError(
      `tiers: ${String(surface)} is not a Tier 3 surface — GDD §7.3 allows ${TIER_3_SURFACES.join(', ')}`,
    );
  }
  return asset[TIER_3_CONTENT];
}

// ---------------------------------------------------------------------------
// The entry: one partner, all three tiers
// ---------------------------------------------------------------------------

/** What kind of identity an entry carries. */
export const IDENTITY_KINDS = ['athlete', 'brand'] as const;

export type IdentityKind = (typeof IDENTITY_KINDS)[number];

/**
 * WHETHER A HUMAN HAS UNLOCKED THIS ENTRY.
 *
 * CLAUDE.md: "The licensing system stays populated with fictional placeholders
 * only until a human explicitly unlocks a specific real partner by name, once an
 * actual licensing agreement exists."
 *
 * Modelled rather than documented, so the unlock is a visible edit in a diff
 * with a name attached to it.
 */
export const LICENCE_STATUSES = ['fictional-placeholder', 'human-unlocked'] as const;

export type LicenceStatus = (typeof LICENCE_STATUSES)[number];

/**
 * THE HUMAN UNLOCK LIST. EMPTY, AND IT STAYS EMPTY UNTIL A HUMAN EDITS IT.
 *
 * A real partner may only be added to the catalogue when their display name
 * appears here, and putting a name here is the deliberate act CLAUDE.md
 * describes. `partners.test.ts` pins it empty and `catalogue.ts` refuses a
 * `'human-unlocked'` entry whose name is not on it, so the two halves cannot
 * drift.
 *
 * NOTHING IN THE RUN MAY WRITE TO THIS. It is not a feature flag and there is no
 * code path that appends to it; it is a constant somebody types.
 */
export const UNLOCKED_REAL_PARTNERS: readonly string[] = Object.freeze([]);

/**
 * One partner or athlete, carried through all three tiers.
 *
 * ADDING A PARTNER IS ADDING ONE OF THESE. That is the whole point of §7.3 and
 * the thing this piece exists to make true: no art pipeline changes, no engine
 * changes, no animation frames re-rendered — a row in `partners.ts`.
 */
export interface IdentityEntry {
  readonly id: string;
  readonly kind: IdentityKind;
  readonly licence: LicenceStatus;
  /** Tier 1 — what the sprite may see. */
  readonly tier1: SpriteIdentity;
  /** Tier 2 — the name tag. */
  readonly tier2: NameTag;
  /** Tier 3 — opaque, total over the three slots. */
  readonly tier3: Readonly<Record<Tier3Slot, Tier3Asset>>;
}

export const IDENTITY_ENTRY_FIELDS = ['id', 'kind', 'licence', 'tier1', 'tier2', 'tier3'] as const;

export type IdentityEntryField = (typeof IDENTITY_ENTRY_FIELDS)[number];

export const IDENTITY_ENTRY_IS_EXACTLY_ITS_ALLOWLIST: KeysAreExactly<
  IdentityEntry,
  IdentityEntryField
> = true;

/**
 * COMPILE-TIME ASSERTION: the tier fields cover exactly the three tiers.
 *
 * Not decoration. It is what stops a fourth tier appearing as an untyped bag on
 * the side, and what makes "which tier does this field belong to" a question
 * with an answer for every field of an entry.
 */
export const ENTRY_TIER_FIELDS_ARE_EXACTLY_THE_TIERS: UnionIsExactly<
  Extract<IdentityEntryField, `tier${string}`>,
  'tier1' | 'tier2' | 'tier3'
> = true;

// ---------------------------------------------------------------------------
// The one door from an entry to the sprite path
// ---------------------------------------------------------------------------

/**
 * TIER 1 OUT OF AN ENTRY. The only route from the licensing system to anything
 * the sprite pipeline consumes.
 *
 * Built field by field rather than by spreading `entry.tier1`, so that a Tier 3
 * field added to the entry could not ride along even if `SpriteIdentity` were
 * widened to accept it. Costs three lines; removes a whole class of "it was a
 * spread" accident.
 */
export function spriteIdentityOf(entry: IdentityEntry): SpriteIdentity {
  return {
    build: entry.tier1.build,
    colorway: entry.tier1.colorway,
    iconMark: entry.tier1.iconMark,
  };
}

/**
 * KIT SPONSORSHIP AT TIER 1: the athlete's body, the brand's colours and mark.
 *
 * This is what a sponsored lifter's sprite actually is, and it is worth having
 * as a function because it is the concrete demonstration of §7.3's practical
 * claim: composing a partner into a sprite is a struct literal, and dropping the
 * partner is passing the athlete's own `tier1` instead. No frame is re-rendered
 * either way.
 *
 * @throws {RangeError} if the athlete has no body or the brand claims one.
 */
export function spriteIdentityWithKit(
  athlete: IdentityEntry,
  brand: IdentityEntry,
): SpriteIdentity {
  if (athlete.tier1.build === 'not-a-lifter') {
    throw new RangeError(`tiers: ${athlete.id} has no build to wear kit on`);
  }
  if (brand.tier1.build !== 'not-a-lifter') {
    throw new RangeError(`tiers: ${brand.id} is a brand and must not carry a build`);
  }
  return {
    build: athlete.tier1.build,
    colorway: brand.tier1.colorway,
    iconMark: brand.tier1.iconMark,
  };
}

/** Tier 2 out of an entry. Trivial, and named so the tier is greppable. */
export function nameTagOf(entry: IdentityEntry): NameTag {
  return entry.tier2;
}

/**
 * Tier 3 out of an entry, for a named surface. There is no accessor that skips
 * the surface argument.
 */
export function tier3Of(
  entry: IdentityEntry,
  slot: Tier3Slot,
  surface: Tier3Surface,
): Tier3Content {
  return revealTier3(entry.tier3[slot], surface);
}
