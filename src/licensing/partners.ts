/**
 * partners.ts — THE TABLE. Adding a partner is adding a row here.
 *
 * ===========================================================================
 * EVERY NAME IN THIS FILE IS INVENTED (GDD §7.3, §12.3; CLAUDE.md)
 * ===========================================================================
 *
 * "No real, named athlete, brand, or company identity — name, logo, likeness, or
 * wordmark — may be hardcoded into any asset, string, config, or code path. The
 * licensing system stays populated with fictional placeholders only until a
 * human explicitly unlocks a specific real partner by name."
 *
 * So: `Ninebar Athletic`, `Halberd Grip Co.`, `Ilse Vondrak` and `Teodor
 * Kessling` are placeholders. Every one was searched for before it was typed,
 * because §12.3 says the way a real mark gets in is as "a 'realistic'
 * placeholder name a builder reached for because a real one was the first thing
 * that came to mind" — and that is not hypothetical here: the first candidate
 * for the chalk brand was rejected at exactly that step after the search turned
 * up a real incorporated company using the name.
 *
 * They are also checked by machine, not only by hand: `realIp.ts` pulls every
 * renderable string out of this file — names, alt text, captions, blurbs — and
 * default-denies them against a watchlist of real brands, athletes, federations
 * and meet series. A name added here that collides with a real one turns
 * `npx vitest run` red.
 *
 * ===========================================================================
 * WHAT EACH ROW HAS TO CARRY, AND WHY ALL THREE TIERS ARE MANDATORY
 * ===========================================================================
 *
 * `IdentityEntry` requires Tier 1, Tier 2 and a TOTAL Tier 3 record. An entry
 * cannot be half-populated, which is deliberate: a partner integrated at Tier 2
 * only would look finished on a name tag and render an empty rectangle the first
 * time a cut-in fired, and an empty rectangle on a licensed surface is exactly
 * what nobody notices until it ships.
 *
 * ===========================================================================
 * THE ART IS PLACEHOLDER TIER, ON PURPOSE (GDD §7.2)
 * ===========================================================================
 *
 * "Cut art entirely from the early prototypes... Placeholder rectangles until
 * meet day is proven to land." These drawings are one step above that: real
 * authored pixels, so the whole path from a table row to a rendered Tier 3
 * surface is exercised, at a fidelity nobody should mistake for finished art.
 * The pipeline is the deliverable; the drawings are the proof it runs.
 *
 * DATA, NOT A GENERATOR — the same authoring idiom as `src/art/spriteMarks.ts`
 * and `src/art/gymProps.ts`. If a portrait is wrong the fix is to move a
 * character in a string.
 *
 * ===========================================================================
 * COLORWAYS POINT AT `palette.ts`, THEY DO NOT CARRY COLOUR
 * ===========================================================================
 *
 * A colorway is three palette INDICES. The hues live in `src/art/palette.ts`,
 * which is a registered palette module and not this piece's to edit, and a
 * `#rrggbb` string here would be a colour literal outside a palette module —
 * which `src/tuning/audit.ts` would report, correctly.
 *
 * ===========================================================================
 * AND THE INDICES HAVE TO BE BANK 0. THREE OF THESE FOUR WERE NOT.
 * ===========================================================================
 *
 * A colorway's whole purpose is the singlet ramp on the BASE SPRITE, and
 * `lifterSprite.ts` decides what is on that sprite with `isBodyIndex`: bank 0 is
 * the lifter, bank 1 is the equipment. `ninebar-blue`, `halberd-green` and
 * `vondrak-crimson` were written out of the PLATE ramps and `CHROME_HI` — bank 1
 * — so worn on a real frame they would have made the athlete's torso barbell as
 * far as `bodyPixelDiff`, the silhouette measure and the phone-scale readability
 * bounds are concerned. `CHROME_HI` is additionally reserved by `palette.ts` for
 * a single specular pixel, and two of the four made it the entire highlight step
 * of a singlet.
 *
 * Nothing caught it because the only Tier 1 colour check asked
 * `sheetColorAt(index) !== undefined`, and that resolves any index in any of the
 * four banks — the Tier 1 payload was being validated in the palette of a Tier 3
 * surface. `spriteKit.ts`'s `colorwayProblems` is the replacement and it asks
 * the sprite's own question.
 *
 * ===========================================================================
 * WHAT THAT COSTS, STATED RATHER THAN GLOSSED: BANK 0 HAS FOUR KIT HUES
 * ===========================================================================
 *
 * Bank 0 is sixteen slots and most of them are spoken for — five of skin, two of
 * hair, one outline, one transparent. What is left to dress a lifter in is the
 * SINGLET ramp (navy), the GEAR ramp (slate), HAIR (a warm plum, borrowed) and
 * CHALK (near-white). That is the entire Tier 1 palette, so the four colorways
 * below are navy, slate, plum and grey-to-white — and `halberd-green` cannot be
 * green on the sprite at all.
 *
 * SO §7.3'S "THE BASE SPRITE NEEDS NO CHANGE AT ALL" IS TRUE ONLY FOR A PARTNER
 * WHOSE COLOURS BANK 0 ALREADY HOLDS. A real partner arriving with an exact
 * brand hue needs a slot added to bank 0, which is a `palette.ts` edit, which is
 * the one art change licensing can force — the header used to say this as a
 * hypothetical and it is now the live constraint on three of four rows. The
 * brand hue that does not fit lives at TIER 3 instead, where the sheet palette
 * has the full plate ramps: Halberd's green halberd head and Vondrak's crimson
 * singlet are drawn below, on surfaces large enough to carry them.
 */

import { PAL } from '../art/palette';
import { SHEET } from '../card/sheetPalette';
import type { BaseItem, LicensingCatalogue, SponsoredReskin } from './catalogue';
import type { Colorway, IconMark, IdentityEntry, Tier3Art } from './tiers';
import { tier3Asset } from './tiers';

// ---------------------------------------------------------------------------
// Legends. One character per palette index, the same convention the sprite
// inspection dump and `spriteMarks.ts` use. A `.` paints nothing.
// ---------------------------------------------------------------------------

/**
 * The shared legend every drawing in this file reads.
 *
 * One table rather than one per drawing, because twelve legends is twelve
 * chances for the same character to mean two things — and a character that means
 * two things is a drawing nobody can proofread.
 */
export const ART_LEGEND: Readonly<Record<string, number>> = Object.freeze({
  K: PAL.OUTLINE,
  s: PAL.SKIN_SHADOW,
  m: PAL.SKIN_MID,
  l: PAL.SKIN_LIGHT,
  h: PAL.HAIR_DARK,
  H: PAL.HAIR_LIGHT,
  d: PAL.SINGLET_DARK,
  n: PAL.SINGLET_MID,
  g: PAL.SINGLET_LIGHT,
  G: PAL.GEAR_DARK,
  E: PAL.GEAR_MID,
  F: PAL.GEAR_LIGHT,
  C: PAL.CHALK,
  r: PAL.PLATE_RED_SHADE,
  R: PAL.PLATE_RED_LIGHT,
  b: PAL.PLATE_BLUE_SHADE,
  B: PAL.PLATE_BLUE_LIGHT,
  v: PAL.PLATE_GREEN_SHADE,
  V: PAL.PLATE_GREEN_LIGHT,
  T: PAL.STEEL_DARK,
  S: PAL.STEEL_MID,
  W: PAL.CHROME_HI,
  I: SHEET.INK,
  P: SHEET.PAPER,
  A: SHEET.ACCENT,
  Z: SHEET.ACCENT_HI,
  N: SHEET.BAND_DARK,
  M: SHEET.BAND_MID,
  J: SHEET.BAND_INK,
});

function art(rows: readonly string[]): Tier3Art {
  return { rows, legend: ART_LEGEND };
}

// ---------------------------------------------------------------------------
// TIER 1 — colorways and icon-marks
// ---------------------------------------------------------------------------

/**
 * The house colorway: what a lifter wears with no partner attached.
 *
 * Present so that "remove the sponsor" has somewhere to fall back to, which is
 * §7.3's practical claim made concrete — losing a deal is passing this instead
 * of the partner's, and no frame is re-rendered.
 */
export const HOUSE_COLORWAY: Colorway = Object.freeze({
  id: 'house',
  dark: PAL.SINGLET_DARK,
  mid: PAL.SINGLET_MID,
  light: PAL.SINGLET_LIGHT,
});

/**
 * Ninebar's team kit: the house navy, opened out and taken to a chalk highlight.
 *
 * SAME BASE AS THE HOUSE RAMP, DIFFERENT TOP. It keeps `SINGLET_DARK` so the
 * figure still has a dark anchor under the bar, skips the mid step and finishes
 * on `CHALK` — a navy singlet with a white chest panel, which is what the Tier 3
 * product drawing shows and what a kit brand's team singlet looks like. The
 * house ramp is the compact one (54 -> 92 -> 148 luma); this is the loud one
 * (54 -> 148 -> 246), and at sprite scale that difference is the whole read.
 */
export const NINEBAR_COLORWAY: Colorway = Object.freeze({
  id: 'ninebar-blue',
  dark: PAL.SINGLET_DARK,
  mid: PAL.SINGLET_LIGHT,
  light: PAL.CHALK,
});

/**
 * Halberd's kit: pressed-chalk white over slate.
 *
 * NOT GREEN, AND THE NAME SAYS SO NOW. Bank 0 holds no green — see the header —
 * so the brand's green cannot reach a 30-pixel figure without a palette slot
 * that is not this piece's to add. The kit that CAN reach it is the one the
 * brand actually sells: a block of pressed chalk. Slate base, slate highlight,
 * chalk top. The green halberd head stays at Tier 3, where the sheet palette has
 * it and the surface is big enough to read it.
 */
export const HALBERD_COLORWAY: Colorway = Object.freeze({
  id: 'halberd-chalk',
  dark: PAL.GEAR_DARK,
  mid: PAL.GEAR_LIGHT,
  light: PAL.CHALK,
});

/**
 * Vondrak's signature kit: the warm dark ramp, as close to crimson as bank 0
 * gets.
 *
 * `HAIR_DARK` and `HAIR_LIGHT` are the bank's only warm non-flesh steps —
 * (49,41,58) and (90,66,82), a near-black plum and a mauve — and borrowing them
 * for a kit is the same move `kessling-slate` makes with the GEAR ramp, which is
 * belt-and-shoe leather worn as a singlet. `GEAR_LIGHT` tops it off, because a
 * warm ramp with no light step is a silhouette.
 *
 * THE HONEST VERSION OF THIS ROW: her Tier 3 portrait and signature singlet are
 * CRIMSON, drawn in the plate-red ramp the sheet palette has. Tier 1 cannot
 * match them and does not pretend to. That divergence is the concrete price of
 * bank 0 having no red that is not flesh, and it is the argument for the palette
 * slot rather than an argument for putting a plate colour on a lifter.
 */
export const VONDRAK_COLORWAY: Colorway = Object.freeze({
  id: 'vondrak-plum',
  dark: PAL.HAIR_DARK,
  mid: PAL.HAIR_LIGHT,
  light: PAL.GEAR_LIGHT,
});

/** Kessling's slate: the GEAR ramp, worn as a kit. Already bank 0, unchanged. */
export const KESSLING_COLORWAY: Colorway = Object.freeze({
  id: 'kessling-slate',
  dark: PAL.GEAR_DARK,
  mid: PAL.GEAR_MID,
  light: PAL.GEAR_LIGHT,
});

/**
 * Icon-marks. ABSTRACT SHAPE ONLY — no letterform, no word.
 *
 * GDD §7.3: Tier 1 carries an icon-mark and never a wordmark, because at
 * 16-bit sprite scale a word is unreadable and a licensed word rendered
 * illegibly is a guideline violation as well as bad art. `partners.test.ts`
 * checks the drawings honour that rather than trusting the field's name: no mark
 * may be wider than the sprite's kit panel, and every mark must survive being
 * drawn at 1x without losing its silhouette.
 */
export const NINEBAR_MARK: IconMark = Object.freeze({
  id: 'ninebar-grid',
  rows: Object.freeze(['K.K.K', '.....', 'K.K.K', '.....', 'K.K.K']),
});

export const HALBERD_MARK: IconMark = Object.freeze({
  id: 'halberd-head',
  rows: Object.freeze(['..K..', '.KKK.', 'KKKKK', '..K..', '..K..']),
});

export const VONDRAK_MARK: IconMark = Object.freeze({
  id: 'vondrak-chevron',
  rows: Object.freeze(['K...K', '.K.K.', '..K..', '.K.K.', 'K...K']),
});

export const KESSLING_MARK: IconMark = Object.freeze({
  id: 'kessling-bar',
  rows: Object.freeze(['.....', 'KKKKK', '.....', 'KKKKK', '.....']),
});

// ---------------------------------------------------------------------------
// TIER 3 — authored drawings
// ---------------------------------------------------------------------------

/**
 * A brand's "portrait" slot: a storefront banner, not a face.
 *
 * A company has no likeness, and inventing one would be inventing the very thing
 * §12.3 exists to keep out of the tree. The slot is total across the catalogue
 * so that a surface asking for a portrait always gets something drawn; what a
 * brand puts in it is its shopfront.
 */
const NINEBAR_BANNER = art([
  'NNNNNNNNNNNNNNNNNNNN',
  'NMMMMMMMMMMMMMMMMMMN',
  'NM................MN',
  'NM.B.B.B..BBBB....MN',
  'NM................MN',
  'NM.B.B.B..B..B....MN',
  'NM................MN',
  'NM.B.B.B..BBBB....MN',
  'NM................MN',
  'NMMMMMMMMMMMMMMMMMMN',
  'NNNNNNNNNNNNNNNNNNNN',
  'NAAAAAAAAAAAAAAAAAAN',
  'NNNNNNNNNNNNNNNNNNNN',
]);

const NINEBAR_LOCKUP = art([
  'NNNNNNNNNNNNNNNNNNNNNNNN',
  'N......................N',
  'N.B.B.B....AAAAAAAA....N',
  'N......................N',
  'N.B.B.B................N',
  'N..........AAAAAAAA....N',
  'N.B.B.B................N',
  'N......................N',
  'NAAAAAAAAAAAAAAAAAAAAAAN',
  'NNNNNNNNNNNNNNNNNNNNNNNN',
]);

const NINEBAR_PRODUCT = art([
  '..KKKKKKKKKKKKKK..',
  '.KbbbbbbbbbbbbbbK.',
  'KbBBBBBBBBBBBBBBbK',
  'KbBWWBWWBWWBWWBBbK',
  'KbBBBBBBBBBBBBBBbK',
  'KbBWWBWWBWWBWWBBbK',
  'KbBBBBBBBBBBBBBBbK',
  'KbBWWBWWBWWBWWBBbK',
  'KbBBBBBBBBBBBBBBbK',
  'KbbbbbbbbbbbbbbbbK',
  'KTTTTTTTTTTTTTTTTK',
  'KTSSSSSSSSSSSSSSTK',
  'KTSWWWWWWWWWWWWSTK',
  'KTSSSSSSSSSSSSSSTK',
  'KTTTTTTTTTTTTTTTTK',
  '.KKKKKKKKKKKKKKKK.',
]);

const HALBERD_BANNER = art([
  'NNNNNNNNNNNNNNNNNNNN',
  'NMMMMMMMMMMMMMMMMMMN',
  'NM................MN',
  'NM.....V..........MN',
  'NM....VVV.........MN',
  'NM...VVVVV........MN',
  'NM.....V......AAA.MN',
  'NM.....V......AAA.MN',
  'NM................MN',
  'NMMMMMMMMMMMMMMMMMMN',
  'NNNNNNNNNNNNNNNNNNNN',
  'NAAAAAAAAAAAAAAAAAAN',
  'NNNNNNNNNNNNNNNNNNNN',
]);

const HALBERD_LOCKUP = art([
  'NNNNNNNNNNNNNNNNNNNNNNNN',
  'N......................N',
  'N....V.....AAAAAAAA....N',
  'N...VVV................N',
  'N..VVVVV...............N',
  'N....V.....AAAAAAAA....N',
  'N....V.................N',
  'N......................N',
  'NAAAAAAAAAAAAAAAAAAAAAAN',
  'NNNNNNNNNNNNNNNNNNNNNNNN',
]);

const HALBERD_PRODUCT = art([
  '....KKKKKKKKKK....',
  '...KCCCCCCCCCCK...',
  '..KCCCCCCCCCCCCK..',
  '.KCCCCCCCCCCCCCCK.',
  'KCCCCCCCCCCCCCCCCK',
  'KCCCCvvvvvvvvCCCCK',
  'KCCCvVVVVVVVVvCCCK',
  'KCCCvVVVVVVVVvCCCK',
  'KCCCCvvvvvvvvCCCCK',
  'KCCCCCCCCCCCCCCCCK',
  'KCCCCCCCCCCCCCCCCK',
  '.KCCCCCCCCCCCCCCK.',
  '..KCCCCCCCCCCCCK..',
  '...KCCCCCCCCCCK...',
  '....KKKKKKKKKK....',
  '..................',
]);

/**
 * An athlete portrait, head and shoulders.
 *
 * Blocky on purpose — see the header on placeholder tier. What matters
 * architecturally is that it is HERE and not on the sprite: §7.3's "Tier 3 never
 * appears on the base sprite" is why a face may be drawn at all. At 30 pixels a
 * face is a smear; at this size it is a face.
 */
const VONDRAK_PORTRAIT = art([
  '......KKKKKKKK......',
  '...KhhhhhhhhhhhhK...',
  '...KhhhhhhhhhhhhK...',
  '...KhHhhhhhhhhHhK...',
  '...KhmmmmmmmmmmhK...',
  '...KhmllllllllmhK...',
  '...KhmlKllllKlmhK...',
  '...KhmllllllllmhK...',
  '...KhmlllsllllmhK...',
  '...KhmllllllllmhK...',
  '...KhmllKKKKllmhK...',
  '...KhmmllllllmmhK...',
  '...KhhmmmmmmmmhhK...',
  '.......KsmmmsK......',
  '.......KsmmmsK......',
  '....KKKKsmmmsKKKK...',
  '...KrrrKsmmmsKrrrK..',
  '..KrrrrrKmmmKrrrrrK.',
  '..KrrrrrKmmmKrrrrrK.',
  '..KrRRrrKmmmKrrRRrK.',
  '..KrRRrrKsmsKrrRRrK.',
  '..KKKKKKKKKKKKKKKKK.',
]);

const VONDRAK_LOCKUP = art([
  'NNNNNNNNNNNNNNNNNNNNNNNN',
  'N......................N',
  'N..R...R...AAAAAAAA....N',
  'N...R.R................N',
  'N....R.................N',
  'N...R.R....AAAAAAAA....N',
  'N..R...R...............N',
  'N......................N',
  'NAAAAAAAAAAAAAAAAAAAAAAN',
  'NNNNNNNNNNNNNNNNNNNNNNNN',
]);

const VONDRAK_PRODUCT = art([
  '...KKKKKKKKKKKK...',
  '..KrrrrKKKKrrrrK..',
  '.KrrrrrKKKKrrrrrK.',
  'KrrrrrrKKKKrrrrrrK',
  'KrRRrrrrrrrrrrRRrK',
  'KrRRrrrrrrrrrrRRrK',
  'KrrrrrrrrrrrrrrrrK',
  'KrrrrrrWWWWrrrrrrK',
  'KrrrrrrWWWWrrrrrrK',
  'KrrrrrrrrrrrrrrrrK',
  'KrRRrrrrrrrrrrRRrK',
  'KrRRrrrrrrrrrrRRrK',
  'KrrrrrrrrrrrrrrrrK',
  '.KrrrrK....KrrrrK.',
  '.KKKKKK....KKKKKK.',
  '..................',
]);

const KESSLING_PORTRAIT = art([
  '......KKKKKKKK......',
  '...KGGGGGGGGGGGGK...',
  '...KGEEEEEEEEEEGK...',
  '...KGGGGGGGGGGGGK...',
  '...KhmmmmmmmmmmhK...',
  '...KhmllllllllmhK...',
  '...KhmlKllllKlmhK...',
  '...KhmllllllllmhK...',
  '...KhmlllsllllmhK...',
  '...KhmllllllllmhK...',
  '...KhmllKKKKllmhK...',
  '...KhmmllllllmmhK...',
  '...KhhmmmmmmmmhhK...',
  '.......KsmmmsK......',
  '.......KsmmmsK......',
  '....KKKKsmmmsKKKK...',
  '...KGGGKsmmmsKGGGK..',
  '..KGGGGGKmmmKGGGGGK.',
  '..KGGGGGKmmmKGGGGGK.',
  '..KGEEGGKmmmKGGEEGK.',
  '..KGEEGGKsmsKGGEEGK.',
  '..KKKKKKKKKKKKKKKKK.',
]);

const KESSLING_LOCKUP = art([
  'NNNNNNNNNNNNNNNNNNNNNNNN',
  'N......................N',
  'N..FFFFF...AAAAAAAA....N',
  'N......................N',
  'N..FFFFF...............N',
  'N..........AAAAAAAA....N',
  'N..FFFFF...............N',
  'N......................N',
  'NAAAAAAAAAAAAAAAAAAAAAAN',
  'NNNNNNNNNNNNNNNNNNNNNNNN',
]);

const KESSLING_PRODUCT = art([
  '..KKKKKKKKKKKKKKKK',
  '..KGGGGGGGGGGGGGGK',
  '..KGEEEEEEEEEEEEGK',
  '..KGEFFFFFFFFFFEGK',
  '..KGEEEEEEEEEEEEGK',
  '..KGGGGGGGGGGGGGGK',
  'KKKGGGGGGGGGGGGGGK',
  'KTSKGGGGGGGGGGGGGK',
  'KTSKGGGGGGGGGGGGGK',
  'KKKGGGGGGGGGGGGGGK',
  '..KGGGGGGGGGGGGGGK',
  '..KGEEEEEEEEEEEEGK',
  '..KGEFFFFFFFFFFEGK',
  '..KGEEEEEEEEEEEEGK',
  '..KGGGGGGGGGGGGGGK',
  '..KKKKKKKKKKKKKKKK',
]);

// ---------------------------------------------------------------------------
// THE ENTRIES
// ---------------------------------------------------------------------------

/**
 * A kit and chalk brand. INVENTED.
 *
 * `build: 'not-a-lifter'` — a brand has no body. Its Tier 1 presence is a
 * colorway and an icon-mark worn on somebody else's sprite, which
 * `spriteIdentityWithKit` composes and `partners.test.ts` exercises.
 */
export const NINEBAR_ATHLETIC: IdentityEntry = Object.freeze<IdentityEntry>({
  id: 'ninebar-athletic',
  kind: 'brand',
  licence: 'fictional-placeholder',
  tier1: {
    build: 'not-a-lifter',
    colorway: NINEBAR_COLORWAY,
    iconMark: NINEBAR_MARK,
  },
  tier2: {
    displayName: 'Ninebar Athletic',
    shortName: 'Ninebar',
  },
  tier3: Object.freeze({
    portrait: tier3Asset({
      slot: 'portrait',
      alt: 'Ninebar Athletic shopfront banner: the nine-bar grid on a navy field',
      caption: 'Ninebar Athletic',
      art: NINEBAR_BANNER,
    }),
    wordmark: tier3Asset({
      slot: 'wordmark',
      alt: 'Ninebar Athletic wordmark lockup: the nine-bar grid beside two rules',
      caption: 'NINEBAR ATHLETIC',
      art: NINEBAR_LOCKUP,
    }),
    product: tier3Asset({
      slot: 'product',
      alt: 'A Ninebar Athletic lifting belt, blue leather with a steel lever',
      caption: 'Ninebar Lever Belt',
      art: NINEBAR_PRODUCT,
    }),
  }),
});

/** A chalk and grip brand. INVENTED. */
export const HALBERD_GRIP: IdentityEntry = Object.freeze<IdentityEntry>({
  id: 'halberd-grip',
  kind: 'brand',
  licence: 'fictional-placeholder',
  tier1: {
    build: 'not-a-lifter',
    colorway: HALBERD_COLORWAY,
    iconMark: HALBERD_MARK,
  },
  tier2: {
    displayName: 'Halberd Grip Co.',
    shortName: 'Halberd',
  },
  tier3: Object.freeze({
    portrait: tier3Asset({
      slot: 'portrait',
      alt: 'Halberd Grip Co. shopfront banner: the halberd head on a navy field',
      caption: 'Halberd Grip Co.',
      art: HALBERD_BANNER,
    }),
    wordmark: tier3Asset({
      slot: 'wordmark',
      alt: 'Halberd Grip Co. wordmark lockup: the halberd head beside two rules',
      caption: 'HALBERD GRIP CO.',
      art: HALBERD_LOCKUP,
    }),
    product: tier3Asset({
      slot: 'product',
      alt: 'A block of Halberd chalk, pressed white with the halberd head stamped into it',
      caption: 'Halberd Pressed Block',
      art: HALBERD_PRODUCT,
    }),
  }),
});

/** A licensed-athlete placeholder. INVENTED. */
export const ILSE_VONDRAK: IdentityEntry = Object.freeze<IdentityEntry>({
  id: 'ilse-vondrak',
  kind: 'athlete',
  licence: 'fictional-placeholder',
  tier1: {
    build: 'compact',
    colorway: VONDRAK_COLORWAY,
    iconMark: VONDRAK_MARK,
  },
  tier2: {
    displayName: 'Ilse Vondrak',
    shortName: 'Vondrak',
  },
  tier3: Object.freeze({
    portrait: tier3Asset({
      slot: 'portrait',
      alt: 'Ilse Vondrak, head and shoulders, in a crimson singlet',
      caption: 'Ilse Vondrak',
      art: VONDRAK_PORTRAIT,
    }),
    wordmark: tier3Asset({
      slot: 'wordmark',
      alt: 'Ilse Vondrak signature lockup: the crossed chevron beside two rules',
      caption: 'ILSE VONDRAK',
      art: VONDRAK_LOCKUP,
    }),
    product: tier3Asset({
      slot: 'product',
      alt: 'The Vondrak signature singlet, crimson with a white chest panel',
      caption: 'Vondrak Signature Singlet',
      art: VONDRAK_PRODUCT,
    }),
  }),
});

/** A second licensed-athlete placeholder, a different build. INVENTED. */
export const TEODOR_KESSLING: IdentityEntry = Object.freeze<IdentityEntry>({
  id: 'teodor-kessling',
  kind: 'athlete',
  licence: 'fictional-placeholder',
  tier1: {
    build: 'heavyweight',
    colorway: KESSLING_COLORWAY,
    iconMark: KESSLING_MARK,
  },
  tier2: {
    displayName: 'Teodor Kessling',
    shortName: 'Kessling',
  },
  tier3: Object.freeze({
    portrait: tier3Asset({
      slot: 'portrait',
      alt: 'Teodor Kessling, head and shoulders, in a slate singlet and a cap',
      caption: 'Teodor Kessling',
      art: KESSLING_PORTRAIT,
    }),
    wordmark: tier3Asset({
      slot: 'wordmark',
      alt: 'Teodor Kessling signature lockup: three stacked bars beside two rules',
      caption: 'TEODOR KESSLING',
      art: KESSLING_LOCKUP,
    }),
    product: tier3Asset({
      slot: 'product',
      alt: 'The Kessling knee sleeve pair, slate neoprene with a steel buckle tag',
      caption: 'Kessling Knee Sleeves',
      art: KESSLING_PRODUCT,
    }),
  }),
});

export const IDENTITY_ENTRIES: readonly IdentityEntry[] = Object.freeze([
  NINEBAR_ATHLETIC,
  HALBERD_GRIP,
  ILSE_VONDRAK,
  TEODOR_KESSLING,
]);

// ---------------------------------------------------------------------------
// The items. Base first, then the reskins that carry nothing but presentation.
// ---------------------------------------------------------------------------

/**
 * THE FICTIONAL ITEMS THAT EXIST WITH NO PARTNER ATTACHED.
 *
 * Every sponsored offer below reskins one of these, and `effectOf` reads the
 * effect from HERE — so the branded version is the same item, by construction
 * rather than by promise (GDD §8.1, and `catalogue.ts` §2(c)).
 *
 * `house-recovery-day` is deliberately on the list even though it is functional
 * (GDD §4.2, §8.2). "A sponsored recovery product does not shorten a setback by
 * an hour" is §8.1's own example, and the guarantee is only interesting on an
 * item that does something.
 */
export const BASE_ITEMS: readonly BaseItem[] = Object.freeze([
  Object.freeze({
    sku: 'house-chalk-vfx',
    displayName: 'Gym Chalk',
    blurb: 'A puff of chalk on the bar at lockout.',
    effect: Object.freeze({ kind: 'cosmetic', slot: 'chalk-vfx' }),
  }),
  Object.freeze({
    sku: 'house-singlet',
    displayName: 'Club Singlet',
    blurb: 'A plain singlet in the house colours.',
    effect: Object.freeze({ kind: 'cosmetic', slot: 'singlet' }),
  }),
  Object.freeze({
    sku: 'house-recovery-day',
    displayName: 'Recovery Day',
    blurb: 'Protects one day of the streak (GDD §4.2).',
    effect: Object.freeze({ kind: 'recovery-day', count: 1 }),
  }),
]);

/**
 * THE SPONSORED OFFERS. Presentation and shelf position, and nothing else.
 *
 * READ THE FIELDS THAT ARE NOT HERE. There is no effect, no multiplier, no
 * duration, no discount. `A_RESKIN_DECLARES_NO_MECHANICAL_FIELD` in
 * `catalogue.ts` makes adding one a compile error, and
 * `catalogue.test.ts` proves the branded and unbranded versions hand back the
 * SAME effect object rather than an equal one.
 *
 * `halberd-recovery` is the §8.1 sentence in the catalogue: a sponsored recovery
 * product whose count is the house item's count, because it IS the house item.
 */
export const SPONSORED_RESKINS: readonly SponsoredReskin[] = Object.freeze([
  Object.freeze({
    sku: 'halberd-chalk-vfx',
    reskins: 'house-chalk-vfx',
    partner: 'halberd-grip',
    displayName: 'Halberd Pressed Block',
    blurb: 'The same puff of chalk, stamped with the halberd head.',
    leadSlot: 'product',
    shelfOrder: 0,
  }),
  Object.freeze({
    sku: 'ninebar-singlet',
    reskins: 'house-singlet',
    partner: 'ninebar-athletic',
    displayName: 'Ninebar Team Singlet',
    blurb: 'The club singlet in Ninebar blue.',
    leadSlot: 'wordmark',
    shelfOrder: 1,
  }),
  Object.freeze({
    sku: 'vondrak-singlet',
    reskins: 'house-singlet',
    partner: 'ilse-vondrak',
    displayName: 'Vondrak Signature Singlet',
    blurb: 'The club singlet, cut and coloured the way Vondrak wears it.',
    leadSlot: 'portrait',
    shelfOrder: 1,
  }),
  Object.freeze({
    sku: 'halberd-recovery',
    reskins: 'house-recovery-day',
    partner: 'halberd-grip',
    displayName: 'Halberd Recovery Day',
    blurb: 'A Recovery Day in Halberd livery. Protects exactly one day, like every other one.',
    leadSlot: 'wordmark',
    shelfOrder: 1,
  }),
]);

/** The whole licensing catalogue, as one value the tests and screens read. */
export const LICENSING_CATALOGUE: LicensingCatalogue = Object.freeze({
  entries: IDENTITY_ENTRIES,
  baseItems: BASE_ITEMS,
  reskins: SPONSORED_RESKINS,
});
