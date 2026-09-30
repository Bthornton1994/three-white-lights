/**
 * cutInArt.ts — what a fired cut-in actually shows, and where it comes from.
 *
 * PURE: zero React, zero I/O. It returns an `IndexGrid` of palette indices, the
 * same currency `renderResultCard.ts`, `renderPanels.ts` and `renderLifterFrame`
 * all trade in. The player-facing interrupt (`CutInView.tsx`) shows an Iron &
 * Amber still; this module remains the §7.3 table witness and the grid tests.
 * That split is the house rule and this file does not invent a second.
 *
 * ===========================================================================
 * THERE IS NO CUT-IN ART IN THIS REPOSITORY AND THIS FILE DOES NOT DRAW ANY
 * ===========================================================================
 *
 * GDD §7.2: "Cut art entirely from the early prototypes. Cut-in art is the most
 * expensive asset class in this plan and is completely orthogonal to whether
 * the game is fun. Placeholder rectangles until meet day is proven to land."
 * GDD §11 records the working assumption this run applies, which keeps cut-in
 * ART unbuilt while the GATE is built.
 *
 * So this file AUTHORS NOTHING. It has no drawing, no legend and no pixels of
 * its own — `cutInArt.test.ts` checks that by reading it. The picture it shows
 * is the Tier 3 drawing `partners.ts` already holds, which §7.3 calls
 * placeholder tier in its own words.
 *
 * IT DOES COMPOSE, and the difference is worth being exact about. Everything
 * drawn below that is not the table's drawing is a rectangle: a ground, a rule
 * along each cut edge, and the well the drawing sits in. Four `fillRect` calls
 * and one line of type. That is layout, not art, and the art bar in §12.2 stays
 * unmet on purpose (§7.2, §11) — nothing here should be read as a claim on it.
 *
 * ===========================================================================
 * IT READS THE TABLE THROUGH §7.3'S WITNESS, LIKE EVERY OTHER READER
 * ===========================================================================
 *
 * `tier3Of(entry, slot, 'cut-in')` — and `'cut-in'` is a member of
 * `TIER_3_SURFACES`, which GDD §7.3 defines as "cut-ins (§7.2), character
 * select, the shop screen, and the result card". That call is `revealTier3`
 * with a named surface, which is the same door `renderPanels.ts` goes through
 * and the only one there is:
 *
 *   - The content cannot be read without naming a Tier 3 surface, and this file
 *     names one. `'base-sprite'` would not compile here.
 *   - THE DRAWING AND THE ONE LINE UNDER IT COME OUT OF THE SAME `Tier3Content`
 *     — `content.art` and `content.caption`, one read of one row of
 *     `partners.ts`. A licensed portrait later is a row in that table and this
 *     file does not change, which is the entire claim §7.3 makes and the reason
 *     the cut-in surface had to read from the table before any art existed
 *     rather than after.
 *
 * ===========================================================================
 * WHY NOT `renderPanel`, WHICH IS WHAT THIS USED TO MOUNT
 * ===========================================================================
 *
 * `renderPanel` is the CHARACTER-SELECT / SHOP composition, one layer above the
 * identity read. It draws all three tiers at once by design (see its header):
 * the Tier 3 art, the Tier 3 caption, the Tier 2 name tag, the Tier 1 colorway
 * swatches and icon-mark, and — with no `offer` to name — the Tier 1 BUILD
 * LABEL. On a shelf that is right. On §7.2's interrupt beat it printed
 *
 *     <name>            the Tier 3 caption
 *     <name>            the Tier 2 name tag, byte-identical for every identity
 *                       the gate can reach
 *     COMPACT BUILD     the Tier 1 build label
 *
 * over three colour swatches, under "LAST ONE".
 *
 * THAT WAS A §7.3 DEFECT AND NOT MERELY AN UGLY ONE. `tier1.build` is required
 * on every `IdentityEntry` and every `LICENSING_COPY.BUILD_LABELS` value is
 * non-empty, so no row of `partners.ts` could remove that third line: only
 * editing a render path could. GDD §7.2's "the art pass, when it happens, is a
 * row in the identity table and not a rewiring" was therefore false while the
 * cut-in consumed the panel — which is exactly the property §7.3 exists to
 * guarantee, and it fails worse on a licensed surface than on a placeholder one.
 *
 * NO PARALLEL PATH ALL THE SAME. This composes from the licensing module's own
 * primitives — `tier3Of` for the content, `drawArt` for the stamp — so there is
 * still one identity read, one drawing routine and no cached copy of anything.
 * What it does not carry is the shelf's furniture.
 *
 * ===========================================================================
 * ONE LINE OF IDENTITY TEXT, AND IT IS THE TIER 3 CAPTION
 * ===========================================================================
 *
 * A real call, because §7.3 says "Tier 2 — the name tag ... does the
 * identifying" while a cut-in is a TIER 3 surface. The caption wins for three
 * reasons, and the cost is stated after them:
 *
 *   1. IT IS BOUND TO THE PICTURE. The caption is a field of the same
 *      `Tier3Content` as the art, per SLOT. `CUT_IN_ART.SLOT` is a per-moment
 *      table precisely so a later pass can lead a beat with `wordmark` or
 *      `product` instead of `portrait`; the caption follows that change and the
 *      name tag would not. A product shot with the athlete's display name under
 *      it is the mismatch this avoids by construction.
 *   2. IT IS ONE READ. Taking Tier 2 here would put two identity sources on the
 *      one surface §7.3 designates for the licensed one, with nothing making
 *      them agree — which is how the doubled name got on screen in the first
 *      place.
 *   3. A BRAND GUIDELINE GOVERNS THE CAPTION. Tier 3 is where "a real wordmark"
 *      lives and where "a mark can be reproduced faithfully"; the caption is
 *      that mark, set. Printing the game's own `displayName` over a licensed
 *      lockup is the thing a partner objects to.
 *
 * THE COST IS TWO THINGS, AND THE SECOND IS EASY TO MISS.
 *
 *   - IDENTIFICATION. A cut-in carries no Tier 2 at all, so if a caption is ever
 *     left looser than a name — a product line rather than a person — the
 *     interrupt identifies by picture and product rather than by name.
 *   - THE SHORT NAME. `tier2.shortName` is the panel's overflow remedy: when a
 *     `displayName` is wider than the panel's inner width, `renderPanel` prints
 *     the short form instead (see its name-tag block). A cut-in has no Tier 2,
 *     so it has no short form to fall back on, and its substitute is
 *     `CUT_IN_PANEL.CAPTION_LINES` of wrapping and then visible overflow — plus
 *     a grid that widens to hold what still does not fit, which lowers the
 *     on-screen upscale `cutInScaleFor` can pick. So a very long licensed
 *     caption costs the interrupt SIZE where it would only have cost the shelf a
 *     shorter string. Neither surface truncates; that part is deliberate on both.
 *
 * Both are judgements about a surface nobody has seen with real art on it, and
 * the first is one line to change here if a human disagrees. The second is a
 * missing field, not a line: a `shortCaption` on `Tier3Content` is what it would
 * take, and nothing needs one yet.
 */

import { createGrid, fillRect, type IndexGrid } from '../art/raster';
import { FONT, drawText, measureText } from '../card/pixelFont';
import { SHEET } from '../card/sheetPalette';
import type { LicensingCatalogue } from '../licensing/catalogue';
import { artScaleFor, artSize, drawArt, wrapToWidth } from '../licensing/renderPanels';
import type { IdentityEntry, Tier3Art, Tier3Surface } from '../licensing/tiers';
import { isTier3Surface, tier3Of } from '../licensing/tiers';
import type { LiveCutIn } from './cutInGate';
import { CUT_IN_LAYOUT, CUT_IN_PANEL } from './cutInTuning';

/**
 * THE SURFACE THIS PIECE DRAWS ON (GDD §7.3).
 *
 * Typed as `Tier3Surface`, so removing `'cut-in'` from `TIER_3_SURFACES` — the
 * edit that would quietly take the cut-in off the licensed path — is a compile
 * error here rather than a silent downgrade to some other surface.
 */
export const CUT_IN_SURFACE: Tier3Surface = 'cut-in';

/**
 * The identity row a live cut-in names, out of the catalogue.
 *
 * @throws {RangeError} when the id is not in the table. A cut-in that fired and
 *   then rendered a blank rectangle is the failure `partners.ts` warns about in
 *   its own header — "an empty rectangle on a licensed surface is exactly what
 *   nobody notices" — so this refuses loudly instead of falling back to
 *   whichever row happens to be first.
 */
export function cutInIdentity(catalogue: LicensingCatalogue, identityId: string): IdentityEntry {
  const entry = catalogue.entries.find((candidate) => candidate.id === identityId);
  if (entry === undefined) {
    throw new RangeError(`cutIn: no identity "${identityId}" in the catalogue`);
  }
  return entry;
}

/**
 * The largest WHOLE-NUMBER upscale at which a drawing fits the cut-in's well.
 *
 * `artScaleFor` IS THE LICENSING MODULE'S OWN, called with this surface's
 * ceiling. It used to be a copy of that function differing only in which
 * `ART_MAX_SCALE` it capped at, which is two chances for a licensed portrait to
 * be sized differently on two surfaces; `artScaleFor` took a defaulted
 * `maxScale` for the same reason `wrapToWidth` took a defaulted `maxLines`, and
 * the panel's own calls are unchanged.
 *
 * Floors at 1 and never interpolates (GDD §7.1). A drawing too big for the well
 * sits at 1x and the WELL GROWS to hold it — see `renderCutIn` — rather than the
 * drawing being cropped, because a licensed portrait quietly missing its left
 * and right thirds is the failure `partners.ts` calls "exactly what nobody
 * notices".
 */
function cutInArtScale(art: Tier3Art, wellW: number, wellH: number): number {
  return artScaleFor(art, wellW, wellH, CUT_IN_PANEL.ART_MAX_SCALE);
}

/**
 * The cut-in's picture, as palette indices.
 *
 * The whole composition, top to bottom: a bright rule, the Tier 3 drawing in a
 * well, ONE line of Tier 3 caption, a bright rule. Nothing else — see the header
 * for why the Tier 2 name tag and the Tier 1 build label are not here.
 *
 * @throws {RangeError} through `cutInIdentity`, and through `revealTier3` if
 *   the surface constant above is ever tampered with at runtime.
 */
export function renderCutIn(catalogue: LicensingCatalogue, live: LiveCutIn): IndexGrid {
  if (!isTier3Surface(CUT_IN_SURFACE)) {
    throw new RangeError(`cutIn: ${CUT_IN_SURFACE} is not a Tier 3 surface (GDD §7.3)`);
  }
  const entry = cutInIdentity(catalogue, live.identityId);
  const content = tier3Of(entry, live.slot, CUT_IN_SURFACE);

  // --- the well, which is a floor and not a cage ----------------------------
  const nominalWellW = CUT_IN_PANEL.W - CUT_IN_PANEL.PAD * 2;
  const scale = cutInArtScale(content.art, nominalWellW, CUT_IN_PANEL.ART_H);
  const size = artSize(content.art);
  const drawnW = size.w * scale;
  const drawnH = size.h * scale;
  const wellW = Math.max(nominalWellW, drawnW);
  const wellH = Math.max(CUT_IN_PANEL.ART_H, drawnH);

  // --- the one identity line, wrapped rather than truncated -----------------
  const captionScale = Math.max(1, Math.round(CUT_IN_PANEL.CAPTION_SCALE));
  const lines = wrapToWidth(
    content.caption,
    Math.floor(wellW / captionScale),
    CUT_IN_PANEL.CAPTION_LINES,
  );
  const pitch = CUT_IN_PANEL.CAPTION_PITCH * captionScale;
  const captionW = lines.reduce((widest, line) => Math.max(widest, measureText(line)), 0) * captionScale;
  const captionH = (lines.length - 1) * pitch + FONT.GLYPH_H * captionScale;

  const w = Math.max(wellW, captionW) + CUT_IN_PANEL.PAD * 2;
  const h = CUT_IN_PANEL.PAD * 2 + wellH + CUT_IN_PANEL.CAPTION_GAP + captionH;
  const grid = createGrid(w, h, SHEET.BAND_DARK);

  // --- the cut edges -------------------------------------------------------
  fillRect(grid, 0, 0, w, CUT_IN_PANEL.EDGE_RULE, SHEET.ACCENT_HI);
  fillRect(grid, 0, h - CUT_IN_PANEL.EDGE_RULE, w, CUT_IN_PANEL.EDGE_RULE, SHEET.ACCENT_HI);

  // --- Tier 3: the drawing -------------------------------------------------
  // The well is filled light because the drawings in `partners.ts` are authored
  // against a light ground — their outline is `PAL.OUTLINE`, near-black, which
  // would disappear into the band's navy if it were stamped straight onto it.
  const wellX = Math.round((w - wellW) / 2);
  const wellY = CUT_IN_PANEL.PAD;
  fillRect(grid, wellX, wellY, wellW, wellH, SHEET.PAPER_SHADE);
  drawArt(
    grid,
    content.art,
    wellX + Math.round((wellW - drawnW) / 2),
    wellY + Math.round((wellH - drawnH) / 2),
    scale,
  );

  // --- Tier 3: the caption, and nothing else -------------------------------
  const centre = Math.round(w / 2);
  const captionY = wellY + wellH + CUT_IN_PANEL.CAPTION_GAP;
  lines.forEach((line, i) => {
    drawText(grid, line, centre, captionY + i * pitch, SHEET.BAND_INK, {
      align: 'center',
      scale: captionScale,
    });
  });

  return grid;
}

/**
 * The largest WHOLE-NUMBER upscale at which the cut-in grid fits the screen.
 *
 * PURE, AND HERE RATHER THAN IN THE VIEW, for the reason `renderPanels.ts`
 * gives about its own `scaleToFit`: a scaling rule defined in a `.tsx` is a
 * rule nothing in this suite can import, because the vitest node environment
 * cannot parse react-native at all.
 *
 * Whole numbers only and floored at 1 (GDD §7.1, nearest-neighbour throughout).
 * A fractional scale makes some source pixels two device pixels wide and some
 * three, and that shimmer is the fastest way to make pixel art look like a
 * photograph of pixel art.
 */
export function cutInScaleFor(sheetW: number, availableWidth: number): number {
  const usable = availableWidth - CUT_IN_LAYOUT.SCREEN_PAD * 2;
  if (sheetW <= 0) return 1;
  return Math.max(1, Math.min(CUT_IN_LAYOUT.MAX_SCALE, Math.floor(usable / sheetW)));
}
