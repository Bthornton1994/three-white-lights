/**
 * cutInArt.ts — what a fired cut-in actually shows, and where it comes from.
 *
 * PURE: zero React, zero I/O. It returns an `IndexGrid` of palette indices, the
 * same currency `renderResultCard.ts`, `renderPanels.ts` and `renderLifterFrame`
 * all trade in, and `CutInView.tsx` is the only thing that turns one into
 * pixels. That split is the house rule and this file does not invent a second.
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
 * So this file authors NOTHING. It has no drawing, no legend and no pixels of
 * its own — `cutInWiring.test.ts` checks that by reading it. What it shows is
 * the Tier 3 panel the licensing system already renders, which §7.3 calls
 * placeholder tier in its own words.
 *
 * ===========================================================================
 * IT REACHES THAT PANEL THROUGH §7.3'S WITNESS, LIKE EVERY OTHER READER
 * ===========================================================================
 *
 * `renderPanel(input, 'cut-in')` — and `'cut-in'` is a member of
 * `TIER_3_SURFACES`, which GDD §7.3 defines as "cut-ins (§7.2), character
 * select, the shop screen, and the result card". Everything downstream of that
 * call goes through `tier3Of` -> `revealTier3`, so:
 *
 *   - The content cannot be read without naming a Tier 3 surface, and this file
 *     names one. `'base-sprite'` would not compile here.
 *   - The art, the caption and the name tag all come out of `partners.ts`, the
 *     identity table. A licensed portrait later is a row in that table and this
 *     file does not change — which is the entire claim §7.3 makes and the
 *     reason the cut-in surface had to read from the table before any art
 *     existed rather than after.
 *
 * NO PARALLEL PATH. There is no second renderer, no cached content, no copy of
 * a drawing. If `renderPanels.ts` changes what a panel looks like, the cut-in
 * changes with it.
 */

import type { IndexGrid } from '../art/raster';
import type { LicensingCatalogue } from '../licensing/catalogue';
import { renderPanel } from '../licensing/renderPanels';
import type { IdentityEntry, Tier3Surface } from '../licensing/tiers';
import { isTier3Surface } from '../licensing/tiers';
import type { LiveCutIn } from './cutInGate';
import { CUT_IN_LAYOUT } from './cutInTuning';

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
 * The cut-in's picture, as palette indices.
 *
 * @throws {RangeError} through `cutInIdentity`, and through `revealTier3` if
 *   the surface constant above is ever tampered with at runtime.
 */
export function renderCutIn(catalogue: LicensingCatalogue, live: LiveCutIn): IndexGrid {
  if (!isTier3Surface(CUT_IN_SURFACE)) {
    throw new RangeError(`cutIn: ${CUT_IN_SURFACE} is not a Tier 3 surface (GDD §7.3)`);
  }
  const entry = cutInIdentity(catalogue, live.identityId);
  return renderPanel({ entry, slot: live.slot }, CUT_IN_SURFACE);
}

/**
 * The largest WHOLE-NUMBER upscale at which the panel fits the screen.
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
