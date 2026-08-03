/**
 * pixelFont.ts — a hand-drawn bitmap font for the result card.
 *
 * PURE. No React, no I/O, no Skia. It writes palette indices into an
 * `IndexGrid` from `src/art/raster.ts` and knows nothing about colour beyond
 * the index it is handed.
 *
 * ---------------------------------------------------------------------------
 * WHY A BITMAP FONT AND NOT A SYSTEM FONT
 * ---------------------------------------------------------------------------
 * GDD §7.1 fixes the art direction at 16-bit and demands "a fixed internal
 * resolution early and nearest-neighbour scaling throughout". A vector font
 * drawn into the same frame would be the one anti-aliased object on an
 * otherwise hard-edged card, and at the scales this card is shared at, that is
 * the single loudest "these two layers were made by different programs" tell.
 * So the type is pixels, on the same grid as everything else, upscaled by the
 * same integer factor.
 *
 * ---------------------------------------------------------------------------
 * METRICS, AND WHY THEY ARE WHAT THEY ARE
 * ---------------------------------------------------------------------------
 * A 5x7 cap on a 9-row cell (two rows of descender), which is the smallest cell
 * that fits a legible two-storey `a`, a round `e` with a visible bar, and a `g`
 * that is not a blob. Below that, lowercase collapses and a results sheet is
 * mostly names.
 *
 * Glyphs are drawn in a 5-wide box but SET PROPORTIONALLY: the advance is the
 * glyph's own inked width plus `LETTER_SPACING`, so `I` and `1` do not sit in
 * the middle of a 5px hole. That is what stops the card reading as a terminal
 * dump.
 *
 * EXCEPT in numeric columns. `TextMode.Tabular` gives every digit, the decimal
 * point and the minus the same advance and centres each in it — real tabular
 * figures — because a column of weights that does not line up vertically is the
 * fastest way to make a results sheet look fake. `resultCard.ts` already marks
 * which columns are numeric (`ResultSheetColumn.numeric`); this is the setting
 * that honours it.
 *
 * ---------------------------------------------------------------------------
 * COVERAGE
 * ---------------------------------------------------------------------------
 * A-Z, a-z, 0-9, and the punctuation the card actually prints — including the
 * em dash `dots.ts` uses for a lifter with no score, and the U+2212 minus it
 * uses for a negative delta. Anything else renders as a hollow box, loudly, and
 * `missingGlyphs` exists so a test can assert the card never needs one. Latin
 * accents are folded to their base letter (`é` -> `e`) rather than tofu, because
 * a meet's entry list is full of them and half a name is worse than a plain one.
 */

import { setPx, type IndexGrid } from '../art/raster';

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export const FONT = {
  /** Width of the box every glyph is drawn in. */
  GLYPH_W: 5,
  /** Rows in the box: 7 of cap height plus 2 of descender. */
  GLYPH_H: 9,
  /** Cap height, i.e. rows 0..6. */
  CAP_H: 7,
  /** Row the baseline sits on (the last row of a capital). */
  BASELINE_ROW: 6,
  /** Gap between two proportionally-set glyphs. */
  LETTER_SPACING: 1,
  /** Advance of a space. */
  SPACE_ADVANCE: 3,
  /** Fixed advance for tabular figures. Must exceed the widest digit. */
  TABULAR_ADVANCE: 6,
  /**
   * Advance for a decimal point or comma inside tabular figures.
   *
   * Narrower than a digit on purpose, and this is what real tabular figures do
   * too: giving `.` a full digit width in a five-character weight like "137.5"
   * costs two pixels that the column does not have, and columns of weights in
   * this sport differ by their decimals rather than by their digit count — so
   * "137.5" and "145" still line up on the right edge either way.
   */
  TABULAR_PUNCT_ADVANCE: 4,
  /** Vertical pitch between two lines of body text. */
  LINE_HEIGHT: 11,
} as const;

export type TextMode = 'proportional' | 'tabular';
export type TextAlign = 'left' | 'right' | 'center';

// ---------------------------------------------------------------------------
// Glyph data
//
// '#' is ink, '.' is paper. Nine rows of five columns; rows past the seventh
// are the descender and are blank for everything that does not need them.
// ---------------------------------------------------------------------------

const BLANK_ROW = '.....';

/** Pads a glyph out to the full cell so every entry below can omit blank tails. */
function g(...rows: readonly string[]): readonly string[] {
  const padded = [...rows];
  while (padded.length < FONT.GLYPH_H) padded.push(BLANK_ROW);
  return padded;
}

const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  ' ': g(),

  // --- Capitals -----------------------------------------------------------
  A: g('..#..', '.#.#.', '#...#', '#...#', '#####', '#...#', '#...#'),
  B: g('####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'),
  C: g('.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'),
  D: g('###..', '#..#.', '#...#', '#...#', '#...#', '#..#.', '###..'),
  E: g('#####', '#....', '#....', '####.', '#....', '#....', '#####'),
  F: g('#####', '#....', '#....', '####.', '#....', '#....', '#....'),
  G: g('.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'),
  H: g('#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'),
  I: g('.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'),
  J: g('..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'),
  K: g('#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'),
  L: g('#....', '#....', '#....', '#....', '#....', '#....', '#####'),
  M: g('#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'),
  N: g('#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#'),
  O: g('.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'),
  P: g('####.', '#...#', '#...#', '####.', '#....', '#....', '#....'),
  Q: g('.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'),
  R: g('####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'),
  S: g('.####', '#....', '#....', '.###.', '....#', '....#', '####.'),
  T: g('#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'),
  U: g('#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'),
  V: g('#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'),
  W: g('#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'),
  X: g('#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'),
  Y: g('#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'),
  Z: g('#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'),

  // --- Lowercase ----------------------------------------------------------
  // x-height 5 (rows 2..6). Ascenders start at row 0, descenders reach row 8.
  a: g('.....', '.....', '.###.', '....#', '.####', '#...#', '.####'),
  b: g('#....', '#....', '####.', '#...#', '#...#', '#...#', '####.'),
  c: g('.....', '.....', '.###.', '#...#', '#....', '#...#', '.###.'),
  d: g('....#', '....#', '.####', '#...#', '#...#', '#...#', '.####'),
  e: g('.....', '.....', '.###.', '#...#', '#####', '#....', '.###.'),
  f: g('..##.', '.#...', '####.', '.#...', '.#...', '.#...', '.#...'),
  g: g('.....', '.....', '.####', '#...#', '#...#', '#...#', '.####', '....#', '.###.'),
  h: g('#....', '#....', '####.', '#...#', '#...#', '#...#', '#...#'),
  i: g('..#..', '.....', '.##..', '..#..', '..#..', '..#..', '.###.'),
  j: g('...#.', '.....', '..##.', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'),
  k: g('#....', '#....', '#..#.', '#.#..', '##...', '#.#..', '#..#.'),
  l: g('.##..', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'),
  m: g('.....', '.....', '##.#.', '#.#.#', '#.#.#', '#.#.#', '#.#.#'),
  n: g('.....', '.....', '####.', '#...#', '#...#', '#...#', '#...#'),
  o: g('.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'),
  p: g('.....', '.....', '####.', '#...#', '#...#', '#...#', '####.', '#....', '#....'),
  q: g('.....', '.....', '.####', '#...#', '#...#', '#...#', '.####', '....#', '....#'),
  r: g('.....', '.....', '#.##.', '##..#', '#....', '#....', '#....'),
  s: g('.....', '.....', '.####', '#....', '.###.', '....#', '####.'),
  t: g('.#...', '.#...', '####.', '.#...', '.#...', '.#..#', '..##.'),
  u: g('.....', '.....', '#...#', '#...#', '#...#', '#...#', '.####'),
  v: g('.....', '.....', '#...#', '#...#', '#...#', '.#.#.', '..#..'),
  w: g('.....', '.....', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'),
  x: g('.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'),
  y: g('.....', '.....', '#...#', '#...#', '#...#', '#...#', '.####', '....#', '.###.'),
  z: g('.....', '.....', '#####', '...#.', '..#..', '.#...', '#####'),

  // --- Digits -------------------------------------------------------------
  // Set on the same 5-wide box so `TABULAR_ADVANCE` centres them cleanly, with
  // the diagonal in the zero that distinguishes it from an O at 5px.
  '0': g('.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'),
  '1': g('..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'),
  '2': g('.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'),
  '3': g('####.', '....#', '....#', '.###.', '....#', '....#', '####.'),
  '4': g('...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'),
  '5': g('#####', '#....', '####.', '....#', '....#', '#...#', '.###.'),
  '6': g('..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'),
  '7': g('#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'),
  '8': g('.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'),
  '9': g('.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'),

  // --- Punctuation --------------------------------------------------------
  '.': g('.....', '.....', '.....', '.....', '.....', '.##..', '.##..'),
  ',': g('.....', '.....', '.....', '.....', '.....', '.##..', '.##..', '..#..', '.#...'),
  ':': g('.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'),
  ';': g('.....', '.##..', '.##..', '.....', '.##..', '.##..', '..#..', '.#...'),
  "'": g('..#..', '..#..', '..#..'),
  '"': g('.#.#.', '.#.#.', '.#.#.'),
  '!': g('..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'),
  '?': g('.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'),
  '(': g('..##.', '.#...', '.#...', '.#...', '.#...', '.#...', '..##.'),
  ')': g('.##..', '...#.', '...#.', '...#.', '...#.', '...#.', '.##..'),
  '/': g('....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'),
  '+': g('.....', '.....', '..#..', '..#..', '#####', '..#..', '..#..'),
  '=': g('.....', '.....', '#####', '.....', '#####', '.....', '.....'),
  '%': g('##..#', '##.#.', '...#.', '..#..', '.#...', '#.##.', '..##.'),
  '&': g('.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'),
  '*': g('.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....'),
  '#': g('.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'),
  '°': g('.##..', '#..#.', '.##..'),
  /** Hyphen: short, sits on the x-height axis. */
  '-': g('.....', '.....', '.....', '.....', '.###.', '.....', '.....'),
  /** U+2014 EM DASH — the card's "there is no value here" glyph. Full width. */
  '—': g('.....', '.....', '.....', '.....', '#####', '.....', '.....'),
  /** U+2212 MINUS SIGN — the sign `dots.ts` prints a negative delta with. */
  '−': g('.....', '.....', '.....', '#####', '.....', '.....', '.....'),
  /** U+00D7 MULTIPLICATION SIGN. */
  '×': g('.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'),
  /** U+00B7 MIDDLE DOT — the separator between meta fields. */
  '·': g('.....', '.....', '.....', '..#..', '.....', '.....', '.....'),
};

/**
 * What is drawn for a character with no glyph: a hollow box, which is
 * unmistakable in a screenshot. Never silently blank — a missing glyph that
 * renders as a space is a bug that survives review.
 */
const TOFU: readonly string[] = g('#####', '#...#', '#...#', '#...#', '#...#', '#...#', '#####');

/**
 * Latin letters folded to their unaccented base. A meet entry list is full of
 * these (`Clément`, `Miková`, `Njergeš`) and a box in the middle of someone's
 * name is worse than a plain letter. Combining marks (U+0300..U+036F) are
 * dropped outright, so a decomposed string folds too.
 */
const FOLD: Readonly<Record<string, string>> = {
  á: 'a', à: 'a', â: 'a', ä: 'a', ã: 'a', å: 'a', ā: 'a', ă: 'a', ą: 'a',
  ç: 'c', ć: 'c', č: 'c', ĉ: 'c',
  ď: 'd', đ: 'd',
  é: 'e', è: 'e', ê: 'e', ë: 'e', ē: 'e', ė: 'e', ę: 'e', ě: 'e',
  ğ: 'g', ģ: 'g',
  í: 'i', ì: 'i', î: 'i', ï: 'i', ī: 'i', į: 'i', ı: 'i',
  ķ: 'k',
  ĺ: 'l', ļ: 'l', ł: 'l',
  ń: 'n', ñ: 'n', ň: 'n', ņ: 'n',
  ó: 'o', ò: 'o', ô: 'o', ö: 'o', õ: 'o', ø: 'o', ō: 'o', ő: 'o',
  ŕ: 'r', ř: 'r',
  ś: 's', š: 's', ş: 's', ș: 's', ß: 's',
  ť: 't', ţ: 't', ț: 't',
  ú: 'u', ù: 'u', û: 'u', ü: 'u', ū: 'u', ů: 'u', ű: 'u', ų: 'u',
  ý: 'y', ÿ: 'y',
  ź: 'z', ž: 'z', ż: 'z',
  æ: 'a', œ: 'o', ð: 'd', þ: 'b',
  Á: 'A', À: 'A', Â: 'A', Ä: 'A', Ã: 'A', Å: 'A', Ā: 'A', Ą: 'A',
  Ç: 'C', Ć: 'C', Č: 'C',
  Ď: 'D', Đ: 'D',
  É: 'E', È: 'E', Ê: 'E', Ë: 'E', Ē: 'E', Ė: 'E', Ę: 'E', Ě: 'E',
  Ğ: 'G',
  Í: 'I', Ì: 'I', Î: 'I', Ï: 'I', Ī: 'I', İ: 'I',
  Ł: 'L',
  Ń: 'N', Ñ: 'N', Ň: 'N',
  Ó: 'O', Ò: 'O', Ô: 'O', Ö: 'O', Õ: 'O', Ø: 'O', Ō: 'O', Ő: 'O',
  Ř: 'R',
  Ś: 'S', Š: 'S', Ş: 'S', Ș: 'S',
  Ť: 'T', Ț: 'T',
  Ú: 'U', Ù: 'U', Û: 'U', Ü: 'U', Ū: 'U', Ů: 'U', Ű: 'U',
  Ý: 'Y',
  Ź: 'Z', Ž: 'Z', Ż: 'Z',
  /** A non-breaking space is still a space. */
  ' ': ' ',
  /** En dash folds to the hyphen; nothing on this card distinguishes them. */
  '–': '-',
  /** Curly quotes fold to straight ones. */
  '‘': "'", '’': "'", '“': '"', '”': '"',
};

/** Combining diacritics, which carry no ink of their own once folded. */
function isCombiningMark(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return code >= 0x0300 && code <= 0x036f;
}

/** The characters a string will actually be drawn as, after folding. */
export function foldText(text: string): readonly string[] {
  const out: string[] = [];
  for (const ch of text.normalize('NFC')) {
    if (isCombiningMark(ch)) continue;
    out.push(FOLD[ch] ?? ch);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Measuring
// ---------------------------------------------------------------------------

interface GlyphMetrics {
  readonly rows: readonly string[];
  /** First inked column, or -1 for a blank glyph. */
  readonly inkLeft: number;
  /** Inked width in px, 0 for a blank glyph. */
  readonly inkWidth: number;
}

const METRICS_CACHE = new Map<string, GlyphMetrics>();

function metricsFor(ch: string): GlyphMetrics {
  const cached = METRICS_CACHE.get(ch);
  if (cached !== undefined) return cached;
  const rows = GLYPHS[ch] ?? TOFU;
  let left: number = FONT.GLYPH_W;
  let right = -1;
  for (const row of rows) {
    for (let x = 0; x < FONT.GLYPH_W; x += 1) {
      if (row[x] !== '#') continue;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  const computed: GlyphMetrics =
    right < 0
      ? { rows, inkLeft: -1, inkWidth: 0 }
      : { rows, inkLeft: left, inkWidth: right - left + 1 };
  METRICS_CACHE.set(ch, computed);
  return computed;
}

/** True when the font has a real glyph for this character (after folding). */
export function hasGlyph(ch: string): boolean {
  return GLYPHS[ch] !== undefined;
}

/** Every character in `text` the font would draw as a hollow box. */
export function missingGlyphs(text: string): readonly string[] {
  const missing = new Set<string>();
  for (const ch of foldText(text)) {
    if (!hasGlyph(ch)) missing.add(ch);
  }
  return [...missing];
}

/** Characters that get the narrow advance in tabular figures. */
const TABULAR_NARROW = new Set(['.', ',']);

function tabularAdvanceFor(ch: string): number {
  return TABULAR_NARROW.has(ch) ? FONT.TABULAR_PUNCT_ADVANCE : FONT.TABULAR_ADVANCE;
}

function advanceFor(ch: string, mode: TextMode): number {
  if (mode === 'tabular') return tabularAdvanceFor(ch);
  if (ch === ' ') return FONT.SPACE_ADVANCE;
  const { inkWidth } = metricsFor(ch);
  if (inkWidth === 0) return FONT.SPACE_ADVANCE;
  return inkWidth + FONT.LETTER_SPACING;
}

/**
 * Drawn width of `text` in px, not counting the trailing letter-space. This is
 * the number a layout should measure against, and `drawText` lays out from the
 * same table, so a right-aligned string ends exactly where this says it will.
 */
export function measureText(text: string, mode: TextMode = 'proportional'): number {
  const chars = foldText(text);
  if (chars.length === 0) return 0;
  let width = 0;
  for (const ch of chars) width += advanceFor(ch, mode);
  // The last glyph contributes ink, not ink plus the gap after it.
  const last = chars[chars.length - 1];
  if (last !== undefined && mode === 'proportional' && last !== ' ') {
    const { inkWidth } = metricsFor(last);
    if (inkWidth > 0) width -= FONT.LETTER_SPACING;
  }
  return Math.max(0, width);
}

/** Drawn height of one line at `scale`, descenders included. */
export function textHeight(scale: number = 1): number {
  return FONT.GLYPH_H * Math.max(1, Math.round(scale));
}

/** Cap height at `scale` — what a single line of uppercase actually occupies. */
export function capHeight(scale: number = 1): number {
  return FONT.CAP_H * Math.max(1, Math.round(scale));
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

export interface DrawTextOptions {
  readonly mode?: TextMode;
  readonly align?: TextAlign;
  /** Integer upscale of the glyph itself. Rounded and floored at 1. */
  readonly scale?: number;
}

/**
 * Draw `text` with its top-left (or top-right, or top-centre) at `x, y`.
 *
 * `y` is the TOP of the cell, not the baseline: every row of the card is laid
 * out from a box, and asking a layout to think in baselines when nothing else
 * on the card has one is a reliable source of one-pixel drift. Add
 * `FONT.BASELINE_ROW * scale` to reach the baseline if you need it.
 *
 * Returns the advance width actually used, so a caller can chain runs.
 */
export function drawText(
  grid: IndexGrid,
  text: string,
  x: number,
  y: number,
  index: number,
  options: DrawTextOptions = {},
): number {
  const mode = options.mode ?? 'proportional';
  const scale = Math.max(1, Math.round(options.scale ?? 1));
  const width = measureText(text, mode) * scale;
  const align = options.align ?? 'left';
  const originX =
    align === 'right' ? x - width : align === 'center' ? x - Math.round(width / 2) : x;

  let penX = originX;
  for (const ch of foldText(text)) {
    const advance = advanceFor(ch, mode) * scale;
    const { rows, inkLeft, inkWidth } = metricsFor(ch);
    if (inkWidth > 0) {
      // Proportional: shift the glyph so its own left edge lands on the pen.
      // Tabular: centre the ink in the fixed advance, which is what makes a
      // column of "1"s sit under a column of "8"s.
      const offset =
        mode === 'tabular'
          ? Math.round((tabularAdvanceFor(ch) - inkWidth) / 2) - inkLeft
          : -inkLeft;
      for (let row = 0; row < FONT.GLYPH_H; row += 1) {
        const bits = rows[row];
        if (bits === undefined) continue;
        for (let col = 0; col < FONT.GLYPH_W; col += 1) {
          if (bits[col] !== '#') continue;
          const px = penX + (col + offset) * scale;
          const py = y + row * scale;
          for (let dy = 0; dy < scale; dy += 1) {
            for (let dx = 0; dx < scale; dx += 1) setPx(grid, px + dx, py + dy, index);
          }
        }
      }
    }
    penX += advance;
  }
  return width;
}

/**
 * A line through a run of text, from `x` for `width` px, on the glyph's own
 * mid-height. Used to strike a missed attempt (see `NO_LIFT_STRIKES_THROUGH` in
 * `resultCard.ts` for what that convention is and is not).
 */
export function strikeThrough(
  grid: IndexGrid,
  x: number,
  y: number,
  width: number,
  index: number,
  scale: number = 1,
  thickness: number = 1,
): void {
  const s = Math.max(1, Math.round(scale));
  // Halfway down the cap, rounded up so a 7-row cap strikes on row 3.
  const midRow = Math.ceil((FONT.CAP_H - 1) / 2);
  const top = y + midRow * s;
  for (let dy = 0; dy < Math.max(1, thickness) * s; dy += 1) {
    for (let dx = 0; dx < width; dx += 1) setPx(grid, x + dx, top + dy, index);
  }
}
