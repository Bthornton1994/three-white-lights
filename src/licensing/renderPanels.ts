/**
 * renderPanels.ts — the Tier 3 surfaces, as palette indices.
 *
 * PURE: zero React, zero I/O. It returns an `IndexGrid` exactly as
 * `renderResultCard.ts` and `renderLifterFrame` do, and a thin Skia layer
 * (`LicensedPanelView.tsx`) is the only thing that turns one into pixels. That
 * split is the house rule and this file does not invent a second one.
 *
 * ===========================================================================
 * WHAT A PANEL IS, AND WHY ALL THREE TIERS ARE ON IT AT ONCE
 * ===========================================================================
 *
 * One panel is one partner on one surface. It draws, from the top:
 *
 *   TIER 3 — the authored high-fidelity drawing, in the art well.
 *   TIER 3 — the caption under it: the wordmark, set in the card font.
 *   TIER 2 — the name tag.
 *   TIER 1 — the colorway ramp and the icon-mark, in a strip along the bottom.
 *
 * Tier 1 is on a Tier 3 surface deliberately, and it is worth saying why,
 * because it looks at first like the separation leaking. §7.3's rule is
 * one-directional: TIER 3 NEVER APPEARS ON THE BASE SPRITE. It says nothing
 * against Tier 1 appearing somewhere large — and it must, because character
 * select is where a player picks a colorway. Drawing them together also makes
 * the split legible to a human: the bottom strip is everything a 30-pixel figure
 * carries, and the top two thirds is everything it never will.
 *
 * ===========================================================================
 * IT REACHES TIER 3 THROUGH THE WITNESS, LIKE EVERY OTHER READER
 * ===========================================================================
 *
 * Every function here takes a `Tier3Surface` and passes it to `tier3Of`. There
 * is no back door and no cached content — which means this module could not draw
 * a partner onto the base sprite even if somebody asked it to, because
 * `'base-sprite'` is not a `Tier3Surface` and the call would not compile.
 */

import { createGrid, fillRect, setPx, type IndexGrid } from '../art/raster';
import { SHEET } from '../card/sheetPalette';
import { FONT, drawText, measureText } from '../card/pixelFont';
import { fitScale } from '../card/renderResultCard';
import {
  LICENSING_COPY,
  LICENSING_SCREEN,
  PANEL,
  PANEL_TEXT,
  RAMP_STEPS,
  SHELF,
  TIER_1_STRIP,
} from './licensingTuning';
import type { BaseItem, SponsoredReskin } from './catalogue';
import { baseItemOf, partnerOf, shelf, type LicensingCatalogue } from './catalogue';
import type { IconMark, IdentityEntry, Tier3Art, Tier3Slot, Tier3Surface } from './tiers';
import { tier3Of } from './tiers';

/** The character in an authored drawing that paints nothing. */
const BLANK = '.';

// ---------------------------------------------------------------------------
// Drawing primitives
// ---------------------------------------------------------------------------

/**
 * Stamp an authored drawing with its top-left at `x, y`, at a whole-number
 * upscale.
 *
 * NEAREST NEIGHBOUR BY CONSTRUCTION. GDD §7.1 requires it and there is no
 * interpolation to get wrong here: each source pixel becomes a `scale x scale`
 * block. `scale` is rounded and floored at 1 for the same reason
 * `ResultCardView` rounds its own — a fractional scale makes some source pixels
 * two device pixels wide and some three, and that shimmer is the fastest way to
 * make pixel art look like a photograph of pixel art.
 */
export function drawArt(
  grid: IndexGrid,
  art: Tier3Art,
  x: number,
  y: number,
  scale: number = 1,
): void {
  const step = Math.max(1, Math.round(scale));
  art.rows.forEach((row, dy) => {
    [...row].forEach((ch, dx) => {
      if (ch === BLANK) return;
      const index = art.legend[ch];
      if (index === undefined) return;
      if (step === 1) {
        setPx(grid, x + dx, y + dy, index);
        return;
      }
      fillRect(grid, x + dx * step, y + dy * step, step, step, index);
    });
  });
}

/**
 * The largest whole-number upscale at which a drawing fits a well.
 *
 * Floors at 1: a drawing too big for its well sits at 1x and overflows visibly
 * rather than being silently cropped to something that looks deliberate.
 *
 * `maxScale` DEFAULTS TO THE PANEL'S OWN CEILING AND THE PANEL NEVER PASSES IT,
 * so every call in this file behaves exactly as it did before the parameter
 * existed — the same argument `wrapToWidth` below makes for `maxLines`, and the
 * same caller. `cutInArt.ts` needs this rule with its own ceiling
 * (`CUT_IN_PANEL.ART_MAX_SCALE`), because a full-screen interrupt and a shelf
 * thumbnail should not have to move together. An argument was preferred to a
 * second copy of the arithmetic: two sizing rules is two chances for a licensed
 * portrait to be sized differently on two surfaces, which is the failure
 * `partners.ts` calls "exactly what nobody notices".
 */
export function artScaleFor(
  art: Tier3Art,
  wellW: number,
  wellH: number,
  maxScale: number = PANEL.ART_MAX_SCALE,
): number {
  const { w, h } = artSize(art);
  if (w === 0 || h === 0) return 1;
  return Math.max(1, Math.min(maxScale, Math.floor(wellW / w), Math.floor(wellH / h)));
}

/**
 * Break a line at spaces so it fits `maxWidth`, up to `PANEL.TEXT_LINES` lines.
 *
 * A PANEL IS NARROW AND A PARTNER'S NAME IS NOT NEGOTIABLE. `fitScale` cannot
 * help — whole-number scaling floors at 1 — and truncating a licensed wordmark
 * is worse than wrapping it. Anything that still does not fit after the last
 * line is appended to it and overflows, visibly, rather than disappearing:
 * `renderPanels.test.ts` asserts no line is dropped.
 *
 * `maxLines` DEFAULTS TO THE PANEL'S OWN CAP AND THE PANEL NEVER PASSES IT, so
 * every call in this file behaves exactly as it did before the parameter
 * existed. It is here because `cutInArt.ts` needs the same wrapping rule with
 * its own line budget (`CUT_IN_PANEL.CAPTION_LINES`) — a cut-in is not a shelf
 * thumbnail and should not have to move when `PANEL.TEXT_LINES` does. Adding an
 * argument was preferred to a second copy of the loop: two wrappers is two
 * chances for a licensed name to break differently on two surfaces.
 */
export function wrapToWidth(
  text: string,
  maxWidth: number,
  maxLines: number = PANEL.TEXT_LINES,
): readonly string[] {
  const words = text.split(' ').filter((w) => w.length > 0);
  const lines: string[] = [];
  for (const word of words) {
    const last = lines[lines.length - 1];
    const joined = last === undefined ? word : `${last} ${word}`;
    if (last !== undefined && measureText(joined) <= maxWidth) {
      lines[lines.length - 1] = joined;
      continue;
    }
    if (lines.length >= maxLines && last !== undefined) {
      lines[lines.length - 1] = joined;
      continue;
    }
    lines.push(word);
  }
  return lines.length === 0 ? [text] : lines;
}

/** Draw wrapped, centred text. Returns the y just past the last line. */
function drawWrapped(
  grid: IndexGrid,
  text: string,
  centreX: number,
  y: number,
  maxWidth: number,
  index: number,
  scale: number,
): number {
  const lines = wrapToWidth(text, maxWidth);
  lines.forEach((line, i) => {
    drawText(grid, line, centreX, y + i * PANEL.LINE_PITCH, index, {
      align: 'center',
      scale: fitScale(line, maxWidth, scale),
    });
  });
  return y + lines.length * PANEL.LINE_PITCH;
}

/** Stamp an icon-mark in one colour, at a whole-number upscale. */
export function drawIconMark(
  grid: IndexGrid,
  mark: IconMark,
  x: number,
  y: number,
  index: number,
  scale: number,
): void {
  const step = Math.max(1, Math.round(scale));
  mark.rows.forEach((row, dy) => {
    [...row].forEach((ch, dx) => {
      if (ch === BLANK) return;
      fillRect(grid, x + dx * step, y + dy * step, step, step, index);
    });
  });
}

/** A one-pixel rectangle outline. */
function strokeRect(grid: IndexGrid, x: number, y: number, w: number, h: number, index: number): void {
  fillRect(grid, x, y, w, PANEL.BORDER, index);
  fillRect(grid, x, y + h - PANEL.BORDER, w, PANEL.BORDER, index);
  fillRect(grid, x, y, PANEL.BORDER, h, index);
  fillRect(grid, x + w - PANEL.BORDER, y, PANEL.BORDER, h, index);
}

/**
 * The widest drawing dimension, so the art well can centre it.
 *
 * EXPORTED FOR THE SAME REASON `artScaleFor` TAKES A CEILING. `cutInArt.ts` has
 * to centre the same drawing in its own well and had its own copy of this line;
 * one measurement of a drawing is one answer on both surfaces.
 */
export function artSize(art: Tier3Art): { readonly w: number; readonly h: number } {
  return { w: art.rows[0]?.length ?? 0, h: art.rows.length };
}

// ---------------------------------------------------------------------------
// One panel
// ---------------------------------------------------------------------------

export interface PanelInput {
  readonly entry: IdentityEntry;
  /** Which Tier 3 slot leads. `leadSlot` on a sponsored offer picks this. */
  readonly slot: Tier3Slot;
  /**
   * The sponsored offer this panel is selling, if any, and the house item it
   * reskins. BOTH, because the panel prints the promise: a branded item names
   * the item it is mechanically identical to, right under its own name.
   */
  readonly offer?: { readonly reskin: SponsoredReskin; readonly base: BaseItem };
}

/**
 * Draw one Tier 3 panel.
 *
 * `surface` is not optional and is not defaulted. Every Tier 3 read in this file
 * goes through it, so the caller has to name which of GDD §7.3's four surfaces
 * it is drawing — and there is no way to name the base sprite.
 */
export function renderPanel(input: PanelInput, surface: Tier3Surface): IndexGrid {
  const grid = createGrid(PANEL.W, PANEL.H, SHEET.PAPER);
  const { entry, slot, offer } = input;
  const content = tier3Of(entry, slot, surface);

  strokeRect(grid, 0, 0, PANEL.W, PANEL.H, SHEET.RULE);

  const inner = PANEL.W - PANEL.PAD * 2;

  // --- Tier 3: the drawing -------------------------------------------------
  const well = { x: PANEL.PAD, y: PANEL.ART_TOP, w: inner, h: PANEL.ART_H };
  fillRect(grid, well.x, well.y, well.w, well.h, SHEET.PAPER_SHADE);
  const size = artSize(content.art);
  const scale = artScaleFor(content.art, well.w, well.h);
  drawArt(
    grid,
    content.art,
    well.x + Math.round((well.w - size.w * scale) / 2),
    well.y + Math.round((well.h - size.h * scale) / 2),
    scale,
  );

  // --- Tier 3: the caption, i.e. the wordmark set --------------------------
  const ruleY = well.y + well.h + PANEL.RULE_GAP;
  fillRect(grid, PANEL.PAD, ruleY, inner, PANEL.BORDER, SHEET.RULE);

  const centre = PANEL.W / 2;
  const afterCaption = drawWrapped(
    grid,
    content.caption,
    centre,
    ruleY + PANEL.CAPTION_GAP,
    inner,
    SHEET.INK,
    PANEL_TEXT.CAPTION_SCALE,
  );

  // --- Tier 2: the name tag ------------------------------------------------
  const tag = entry.tier2.displayName;
  const tagText = measureText(tag) > inner ? entry.tier2.shortName : tag;
  const tagY = afterCaption + PANEL.NAME_TAG_GAP;
  drawText(grid, tagText, centre, tagY, SHEET.INK_SOFT, {
    align: 'center',
    scale: fitScale(tagText, inner, PANEL_TEXT.NAME_TAG_SCALE),
  });

  // --- the §8.1 promise, printed -------------------------------------------
  // THE §8.1 LINE, OR THE TIER 1 BUILD. A shop panel names the house item it is
  // mechanically identical to; a character-select panel has nothing to sell, so
  // it names the build instead — the one thing on the panel that reaches the
  // sprite.
  const mechanics =
    offer === undefined
      ? LICENSING_COPY.BUILD_LABELS[entry.tier1.build]
      : `${LICENSING_COPY.SAME_AS} ${offer.base.displayName.toUpperCase()}`;
  drawWrapped(
    grid,
    mechanics,
    centre,
    tagY + FONT.CAP_H * PANEL_TEXT.NAME_TAG_SCALE + PANEL.MECHANICS_GAP,
    inner,
    SHEET.INK_SOFT,
    PANEL_TEXT.MECHANICS_SCALE,
  );

  // --- Tier 1: what the sprite actually carries ----------------------------
  const mark = entry.tier1.iconMark;
  const markW = (mark.rows[0]?.length ?? 0) * TIER_1_STRIP.MARK_SCALE;
  const markH = mark.rows.length * TIER_1_STRIP.MARK_SCALE;
  // The strip is as tall as its tallest element, so raising MARK_SCALE cannot
  // silently push the mark off the bottom of the panel.
  const stripH = Math.max(TIER_1_STRIP.SWATCH, markH);
  const stripTop = PANEL.H - PANEL.PAD - stripH;
  const swatchY = stripTop + Math.round((stripH - TIER_1_STRIP.SWATCH) / 2);
  const rampW = TIER_1_STRIP.SWATCH * RAMP_STEPS + TIER_1_STRIP.SWATCH_GAP * (RAMP_STEPS - 1);
  const stripW = rampW + TIER_1_STRIP.MARK_GAP + markW;
  let stripX = Math.round((PANEL.W - stripW) / 2);

  for (const index of [
    entry.tier1.colorway.dark,
    entry.tier1.colorway.mid,
    entry.tier1.colorway.light,
  ]) {
    fillRect(grid, stripX, swatchY, TIER_1_STRIP.SWATCH, TIER_1_STRIP.SWATCH, index);
    strokeRect(grid, stripX, swatchY, TIER_1_STRIP.SWATCH, TIER_1_STRIP.SWATCH, SHEET.RULE);
    stripX += TIER_1_STRIP.SWATCH + TIER_1_STRIP.SWATCH_GAP;
  }
  stripX += TIER_1_STRIP.MARK_GAP - TIER_1_STRIP.SWATCH_GAP;
  drawIconMark(
    grid,
    mark,
    stripX,
    stripTop + Math.round((stripH - markH) / 2),
    SHEET.INK,
    TIER_1_STRIP.MARK_SCALE,
  );

  return grid;
}

// ---------------------------------------------------------------------------
// The shelf, and character select
// ---------------------------------------------------------------------------

function sheetFor(panels: readonly IndexGrid[], heading: string): IndexGrid {
  const columns = Math.min(SHELF.COLUMNS, Math.max(1, panels.length));
  const rows = Math.ceil(panels.length / columns);
  const w = SHELF.MARGIN * 2 + columns * PANEL.W + (columns - 1) * SHELF.GAP;
  const h = SHELF.MARGIN * 2 + SHELF.HEADING_H + rows * PANEL.H + (rows - 1) * SHELF.GAP;
  const grid = createGrid(w, h, SHEET.PAPER_ALT);

  // The band is two lines. The second one is the standing reminder that
  // nothing in the table is a real partner — printed on the surface itself
  // rather than only in a comment, because this sheet is the artefact somebody
  // screenshots and shows to a person who has not read `partners.ts`.
  fillRect(grid, 0, 0, w, SHELF.HEADING_H, SHEET.BAND_DARK);
  drawText(grid, heading, SHELF.MARGIN, SHELF.HEADING_TOP, SHEET.BAND_INK, {
    scale: PANEL_TEXT.HEADING_SCALE,
  });
  drawText(
    grid,
    LICENSING_COPY.PLACEHOLDER_NOTE,
    SHELF.MARGIN,
    SHELF.HEADING_TOP + SHELF.HEADING_PITCH,
    SHEET.ACCENT_HI,
    { scale: PANEL_TEXT.HEADING_SCALE },
  );

  panels.forEach((panel, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = SHELF.MARGIN + col * (PANEL.W + SHELF.GAP);
    const y = SHELF.MARGIN + SHELF.HEADING_H + row * (PANEL.H + SHELF.GAP);
    for (let py = 0; py < panel.h; py += 1) {
      for (let px = 0; px < panel.w; px += 1) {
        setPx(grid, x + px, y + py, panel.data[py * panel.w + px] ?? SHEET.PAPER);
      }
    }
  });

  return grid;
}

/**
 * THE SHOP SCREEN (GDD §7.3, a Tier 3 surface; §8.3A, the cosmetics pillar).
 *
 * One panel per sponsored offer, in shelf order, each leading with the Tier 3
 * slot its row declares. Every panel prints the house item it is mechanically
 * identical to, because §8.1's promise is a thing a player should be able to
 * read rather than a thing only a test knows.
 */
export function renderShopShelf(catalogue: LicensingCatalogue): IndexGrid {
  const panels = shelf(catalogue).flatMap((reskin) => {
    const entry = partnerOf(catalogue, reskin);
    const base = baseItemOf(catalogue, reskin);
    if (entry === undefined || base === undefined) return [];
    return [renderPanel({ entry, slot: reskin.leadSlot, offer: { reskin, base } }, 'shop')];
  });
  return sheetFor(panels, LICENSING_COPY.SHOP_TITLE);
}

/**
 * CHARACTER SELECT (GDD §7.3, a Tier 3 surface).
 *
 * One panel per identity entry, leading with the portrait — which is what the
 * slot is for, and the reason a face may be drawn at all: it is not on the
 * sprite.
 */
export function renderCharacterSelect(catalogue: LicensingCatalogue): IndexGrid {
  const panels = catalogue.entries.map((entry) =>
    renderPanel({ entry, slot: 'portrait' }, 'character-select'),
  );
  return sheetFor(panels, LICENSING_COPY.SELECT_TITLE);
}

/**
 * The largest whole-number upscale at which a sheet fits `available` points.
 *
 * PURE, AND HERE RATHER THAN IN THE VIEW, for a reason worth writing down: it
 * lives in the file the tests can import. `LicensedPanelView.tsx` pulls in
 * react-native, which the vitest node environment cannot parse at all — so a
 * scaling rule defined there is a rule nothing can check, and "does the sheet
 * still double on a phone?" is exactly the assertion that has to survive
 * somebody widening a panel by two pixels.
 *
 * Floors at 1 rather than going fractional: a layout that needs a size between
 * two integer scales letterboxes the smaller one, which is the rule
 * `ResultCardView` and `LifterSpriteView` already follow (GDD §7.1).
 */
export function scaleToFit(sheetW: number, available: number): number {
  return Math.max(1, Math.min(LICENSING_SCREEN.MAX_SCALE, Math.floor(available / sheetW)));
}

/** The two surfaces this module can draw, for the harness and the tests. */
export const LICENSING_PANELS = ['shop', 'character-select'] as const;

export type LicensingPanelId = (typeof LICENSING_PANELS)[number];

export function renderLicensingPanel(
  catalogue: LicensingCatalogue,
  panel: LicensingPanelId,
): IndexGrid {
  return panel === 'shop' ? renderShopShelf(catalogue) : renderCharacterSelect(catalogue);
}
