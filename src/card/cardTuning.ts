/**
 * cardTuning.ts — every layout number the result card uses, in one place.
 *
 * UNTUNED. CLAUDE.md: "Keep every such value as a named constant in one place.
 * Never scatter them as magic numbers across components." Nothing here has been
 * looked at by a human on a phone yet. The renderer reads this file and holds
 * no geometry of its own, so a tuning pass is edits to this file alone.
 *
 * THE INTERNAL RESOLUTION IS FIXED AND THE SCALE IS AN INTEGER. GDD §7.1:
 * "pick a fixed internal resolution early and use nearest-neighbor scaling
 * throughout. Retrofitting this later is painful." The *grid* below is authored
 * at `CARD.W x CARD.H` and only ever upscaled by a whole number. The shareable
 * surface a player sees is `PAPER` in `ResultCardView` — see that block. Do
 * not treat this header as a silent rewrite of §7.1; the conflict with §6.5 /
 * §7.3 / §12.2's Result card bar is unresolved in the GDD.
 *
 * WHY 192 x 240: 4:5, the portrait aspect every social feed crops to without
 * letterboxing, and both axes are multiples of 8 (the SNES tile). At the
 * default upscale of 2 that is 384 x 480 logical px, which fits inside a
 * 390 px-wide phone viewport with a margin — the scale GDD §12.2 says to judge
 * readability at.
 *
 * Vertical layout, top to bottom, all in card px:
 *
 *     0                     frame
 *     1  .. 44   MASTHEAD   federation, meet name, date and place
 *    45  .. 72   LIFTER     name, then sex / kit / division / class / weight,
 *                           on one line or two — see `LIFTER_META_LADDER`. The
 *                           band is 28 px either way: a second line is paid for
 *                           out of the name's type size, not out of the card.
 *    74  ..124   GRID       header row, then squat / bench / deadlift
 *   128  ..157   TOTAL      the hero number
 *   159  ..184   SCORE      DOTS and PLACE, side by side
 *   186  ..224   BARBELL    the heaviest good lift, drawn as a loaded bar
 *   226  ..238   FOOTER     wordmark
 *   239                     frame
 */

/** The card's own pixel grid, and how it reaches the screen. */
export const CARD = {
  W: 192,
  H: 240,
  /** Left and right text margin. */
  MARGIN: 6,
  /** Default integer upscale. 2 -> 384x480 logical px. */
  DEFAULT_UPSCALE: 2,
} as const;

/** Left edge of the content column, and the width available to it. */
export const CONTENT = {
  X: CARD.MARGIN,
  W: CARD.W - 2 * CARD.MARGIN,
  /** One past the right edge — where a right-aligned run ends. */
  RIGHT: CARD.W - CARD.MARGIN,
} as const;

/** The card's vertical centre line, where every centred run is anchored. */
export const CARD_CENTER_X = Math.floor(CARD.W / 2);

/**
 * The masthead. Federation set large because that is the one line a lifter
 * scans first on a real sheet; meet name and date beneath it at body size.
 */
export const MASTHEAD = {
  Y: 1,
  H: 44,
  /**
   * The federation sits on a fixed BASELINE rather than a fixed top, so that a
   * name too long for double height drops to single height and stays put
   * instead of floating in the middle of the band.
   */
  FEDERATION_BASELINE: 20,
  FEDERATION_SCALE: 2,
  RULE_Y: 23,
  RULE_INSET: 22,
  MEET_NAME_Y: 27,
  PLACE_DATE_Y: 36,
  /**
   * Minimum gap between the date and the place, which are set to opposite
   * margins like the head of a real letterheaded results sheet. Under this,
   * the place falls back to the town alone and then off the card entirely —
   * see `firstThatFits` for why nothing is ever truncated instead.
   */
  DATE_PLACE_MIN_GAP: 8,
} as const;

/** The lifter identity strip under the masthead. */
export const LIFTER_STRIP = {
  Y: 45,
  H: 28,
  NAME_Y: 48,
  NAME_SCALE: 2,
  /**
   * Cap on the name's scale when the strip has to print TWO meta lines.
   *
   * THE SECOND LINE IS BOUGHT OUT OF THE NAME'S OWN HEIGHT, NOT OUT OF THE
   * CARD. At scale 1 the name set at `NAME_Y_COMPACT` ends above
   * `META_Y_TWO_LINE[0]`, so the strip is the same 28 px either way and the
   * grid, the total and the barbell do not move. A long name already sets at
   * this scale today; what is new is that a SHORT name in a long category steps
   * down too — which is the trade this whole mechanism makes. The name gets
   * smaller. No fact leaves the card.
   *
   * "THE GRID, THE TOTAL AND THE BARBELL DO NOT MOVE" IS CHECKED, NOT REASONED.
   * `renderResultCard.test.ts` renders this card against a one-line twin
   * carrying the same nine attempts, the same total, the same DOTS and the same
   * placing, and compares every pixel from row 73 to the bottom frame — and
   * then pins the rows those three blocks are actually inked on, by hand,
   * because a diff of two cards is blind to anything that moves both of them.
   */
  NAME_SCALE_COMPACT: 1,
  /**
   * Y of the name when the strip prints two meta lines.
   *
   * Two pixels above `NAME_Y`, which is what makes the leading even: three
   * lines of type at `FONT.GLYPH_H` need 25 of the 27 rows between here and the
   * strip's closing rule, and starting two rows higher is what turns the one
   * spare row into three — one blank row between the name and the first line,
   * one between the two lines, and one above the rule.
   */
  NAME_Y_COMPACT: 46,
  /** Y of the meta line when the strip prints ONE. */
  META_Y: 63,
  /**
   * Y of each meta line when the strip prints TWO.
   *
   * `FONT.GLYPH_H` is 9 — seven rows of capital and two of descender — so a
   * scale-1 name set at `NAME_Y_COMPACT` ends on row 54 and the first meta line
   * clears it at 56. The meta lines are set in caps and digits, which have no
   * descenders, so the second line's capitals end on row 70 and the strip's
   * closing rule at 72 has a row of air above it.
   *
   * UNTUNED, and the whole band is tight: 28 px is a comfortable two lines and
   * a dense three. If a tuning pass wants air here it comes out of the
   * masthead, which is the one block on the card with slack in it.
   */
  META_Y_TWO_LINE: [56, 64] as const,
  /** Separator between the fields on a meta line. */
  META_SEPARATOR: ' · ',
} as const;

/** Y of meta line `index` when the strip is printing `lineCount` of them. */
export function lifterMetaLineY(lineCount: number, index: number): number {
  if (lineCount < 2) return LIFTER_STRIP.META_Y;
  return LIFTER_STRIP.META_Y_TWO_LINE[index] ?? LIFTER_STRIP.META_Y;
}

/** Y of the lifter's name when the strip is printing `lineCount` meta lines. */
export function lifterNameY(lineCount: number): number {
  return lineCount < 2 ? LIFTER_STRIP.NAME_Y : LIFTER_STRIP.NAME_Y_COMPACT;
}

/**
 * The optional words inside the category phrase, in the order they are printed.
 *
 * The phrase itself is `lifterCategoryText` in `src/game/resultCard.ts` and
 * reads "MEN'S RAW OPEN 93" — sex, equipment, division, class, which is the
 * order the committed reference board prints ("Women's Raw Open 52").
 *
 * NOTE WHAT IS NOT IN THIS UNION. There is no `'sex'`, no `'class'` and no
 * `'bodyweight'` member, so no rung of the ladder below is able to name them
 * and no future rung can be written that drops them. That is deliberate and it
 * is the whole point: the card prints a DOTS score, DOTS takes sex and
 * bodyweight as inputs, and a card that publishes a coefficient while
 * withholding an input cannot be checked by the people it is meant to convince.
 * Making the omission unrepresentable is stronger than a comment asking for it
 * not to happen — which is what was here before, and it happened.
 *
 * `LifterMetaRung` does have a `bodyweightOnOwnLine` flag, and it is not a hole
 * in the above: it chooses which LINE the bodyweight sits on, and both of its
 * values print one. The union here is the drop-list, and the bodyweight is not
 * in it.
 */
export type LifterCategoryPart = 'equipment' | 'division';

export interface LifterMetaRung {
  /**
   * Which optional words of the category phrase survive on the FIRST line.
   * A part missing here has either moved to the second line or been SPENT; the
   * two flags below are what say which.
   */
  readonly category: readonly LifterCategoryPart[];
  /**
   * True when the bodyweight goes on a second line instead of sharing the
   * first. NOT a switch for printing it: there is no combination of these
   * fields that produces a strip without a bodyweight on it — it is on one
   * line or the other, and `lifterMetaLinesAtRung` emits it either way.
   */
  readonly bodyweightOnOwnLine: boolean;
  /**
   * True when the division that `category` left off the first line goes onto
   * the SECOND line rather than being dropped. This is the difference between
   * moving a fact and spending one, and it is the whole of the fix: a division
   * shares a line with the bodyweight instead of leaving the card.
   */
  readonly divisionOnSecondLine: boolean;
  /** Whether the bodyweight keeps its " KG". */
  readonly bodyweightUnit: boolean;
}

/**
 * WHAT THE STRIP DOES WHEN ITS ONE LINE WILL NOT HOLD EVERYTHING, IN ORDER.
 *
 * The renderer walks this ladder and prints the first rung whose every line
 * fits. Every rung is a TRUE statement — never a truncation. A results sheet
 * that ends in "SINGLE-PL" has stopped being believable, and an ellipsis on a
 * shareable card reads as a bug.
 *
 * THE ORDER OF PREFERENCE IS: shorten the wording, then take a second line,
 * then move a fact down to it, and only then spend one. A second line is
 * cheaper than a fact because it costs nothing but the NAME's type size — see
 * `LIFTER_STRIP.NAME_SCALE_COMPACT`; the strip's height does not change and
 * nothing below it moves.
 *
 * Measured, for the `stress` sample (a 120+ Masters 1 single-ply lifter,
 * `CONTENT.W` is 180 px):
 *
 *     rung 0  215 px          MEN'S SINGLE-PLY MASTERS 1 120+ · 139.40 KG
 *     rung 1  200 px          MEN'S SINGLE-PLY MASTERS 1 120+ · 139.40
 *     rung 2  161 / 45 px     MEN'S SINGLE-PLY MASTERS 1 120+   <- what prints
 *                             139.40 KG
 *     rung 3  109 / 102 px    MEN'S SINGLE-PLY 120+
 *                             MASTERS 1 · 139.40 KG
 *     rung 4  109 /  45 px    MEN'S SINGLE-PLY 120+          (division SPENT)
 *     rung 5   50 /  45 px    MEN'S 120+                     (equipment too)
 *
 * WHAT CHANGED AND WHY. This ladder had four rungs and no second line anywhere
 * in it: its third rung was one line with the division spent, so the stress
 * card printed "MEN'S SINGLE-PLY 120+ · 139.40" — while the same card printed
 * `PLACE 3`. A placing is a placing IN A DIVISION; third in what is the first
 * question a lifter asks of that card, and a real sheet never has a rank
 * without a division near it (on a meet page the division is the section
 * heading over the rows the ranks are in, [R8] in `src/game/resultCard.ts`).
 * The two alternatives measured last round were to spend the EQUIPMENT instead
 * — which makes a single-ply total read as raw, and is worse on a results card
 * — or to give the strip a second line. The second line is what rungs 2 and 3
 * are, and the fact that it costs no height is what makes it the cheap answer.
 *
 * RUNGS 4 AND 5 ARE STILL HERE AND ARE STILL REACHABLE — but only by a card
 * with no placing on it, and, at the card's own width, only when even a line
 * shared with the bodyweight cannot hold the division (about 25 characters of
 * it). See `lifterMetaRungs`: a card that prints a placing is not offered them
 * at any width.
 *
 * The widest realistic phrase measured is 182 px — "WOMEN'S SINGLE-PLY
 * SUB-JUNIORS 84+", two pixels past `CONTENT.W`, which is exactly what rung 3
 * is for (it sets 117 px over 111 px).
 *
 * UNTUNED. The rung ORDER is a real design call rather than a spacing tweak: if
 * playtesting says a second line reads worse than a lost word, rungs 2 and 3
 * come out, and this file is where that is done.
 */
export const LIFTER_META_LADDER: readonly LifterMetaRung[] = [
  { category: ['equipment', 'division'], bodyweightOnOwnLine: false, divisionOnSecondLine: false, bodyweightUnit: true },
  { category: ['equipment', 'division'], bodyweightOnOwnLine: false, divisionOnSecondLine: false, bodyweightUnit: false },
  { category: ['equipment', 'division'], bodyweightOnOwnLine: true, divisionOnSecondLine: false, bodyweightUnit: true },
  { category: ['equipment'], bodyweightOnOwnLine: true, divisionOnSecondLine: true, bodyweightUnit: true },
  { category: ['equipment'], bodyweightOnOwnLine: true, divisionOnSecondLine: false, bodyweightUnit: true },
  { category: [], bodyweightOnOwnLine: true, divisionOnSecondLine: false, bodyweightUnit: true },
];

/** True when a rung's strip still names the division, wherever it puts it. */
export function rungNamesDivision(rung: LifterMetaRung): boolean {
  return rung.category.includes('division') || rung.divisionOnSecondLine;
}

/**
 * The rungs a card is allowed to use.
 *
 * A CARD THAT PRINTS A PLACING KEEPS ITS DIVISION. Not "usually", not "at the
 * widths we measured" — the rungs that spend it are filtered out of the ladder
 * before the width is even looked at, so there is no input, however long its
 * division string, that produces a ranked card with no division on it. If the
 * remaining rungs all overrun, `lifterStrip` falls back to the last of them and
 * the line runs long, which is `firstThatFits`' documented rule and the right
 * one: a line that overruns is recoverable by tuning, a fact that vanished is
 * a card telling a lifter they came third in nothing.
 *
 * A card with NO placing still walks the whole ladder, and can still end up
 * without its division. That is the residual this piece has carried and
 * documented all along; what makes it a defect rather than a trade-off is the
 * rank printed next to it.
 */
export function lifterMetaRungs(placed: boolean): readonly LifterMetaRung[] {
  return placed ? LIFTER_META_LADDER.filter(rungNamesDivision) : LIFTER_META_LADDER;
}

/**
 * The attempt grid. One row per lift, one column per attempt, plus a best
 * column — the same information as the long single-line form in
 * `RESULT_SHEET_COLUMNS`, transposed so it fits a portrait card.
 */
export const GRID = {
  HEADER_Y: 74,
  HEADER_H: 10,
  HEADER_TEXT_Y: 76,
  /** 1px rule between the header row and the first lift. */
  RULE_Y: 84,
  /** Top of the squat row; each lift row is `ROW_H` below the last. */
  FIRST_ROW_Y: 85,
  ROW_H: 13,
  /** Baseline-ish offset of a cell's type inside its row. */
  ROW_TEXT_DY: 3,
  /**
   * The grid runs wider than the text margin. A table on a printed sheet
   * bleeds closer to the trim than body copy does, and the two extra pixels per
   * column are what stop a five-character weight like "312.5" touching its own
   * cell rule.
   */
  X: 4,
  /** Left column, holding SQUAT / BENCH / DEADLIFT. */
  LABEL_X: 6,
  LABEL_W: 48,
  /** Four equal columns: attempt 1, 2, 3, best. */
  CELL_W: 34,
  CELL_COUNT: 4,
  /** Inset of an attempt cell's coloured fill inside its column. */
  CELL_INSET_X: 1,
  CELL_INSET_Y: 1,
  /** Right padding for the tabular figure inside a cell. */
  CELL_TEXT_PAD: 3,
  /** Extra px the strike-through overhangs the number on each side. */
  STRIKE_OVERHANG: 1,
  STRIKE_THICKNESS: 1,
} as const;

/** X of the left edge of attempt column `i` (0..3, the last being BEST). */
export function gridCellX(index: number): number {
  return GRID.X + GRID.LABEL_W + index * GRID.CELL_W;
}

/** X of the centre of attempt column `i` — where its heading is anchored. */
export function gridCellCenterX(index: number): number {
  return gridCellX(index) + Math.floor(GRID.CELL_W / 2);
}

/** One past the right edge of the last column. */
export const GRID_RIGHT_X = GRID.X + GRID.LABEL_W + GRID.CELL_COUNT * GRID.CELL_W;

/** Y of the top of lift row `i` (0 squat, 1 bench, 2 deadlift). */
export function gridRowY(index: number): number {
  return GRID.FIRST_ROW_Y + index * GRID.ROW_H;
}

/** One past the bottom of the last lift row — where the closing rule goes. */
export const GRID_BOTTOM_Y = GRID.FIRST_ROW_Y + 3 * GRID.ROW_H;

/**
 * The total. Set on the dark band and in brass, because it is the number the
 * card exists to show and the only one a lifter screenshots for.
 */
export const TOTAL_BLOCK = {
  Y: 128,
  H: 30,
  LABEL_X: CONTENT.X + 4,
  LABEL_Y: 138,
  VALUE_RIGHT: CONTENT.RIGHT - 4,
  VALUE_Y: 133,
  VALUE_SCALE: 3,
  /** Dropped a step at a time until the value fits the block. */
  VALUE_MIN_SCALE: 1,
  /**
   * Clearance the total's value must keep from the word "TOTAL" and its unit.
   * The value is set at `VALUE_SCALE` and steps down whole scales until it fits
   * what is left, so this is the number that decides when a four-digit total
   * loses a step of size — the most visible single tuning lever on the card.
   */
  LABEL_VALUE_MIN_GAP: 6,
  /** Gap between the word "TOTAL" and the "KG" that follows it. */
  UNIT_GAP: 4,
} as const;

/** DOTS and PLACE, side by side under the total. */
export const SCORE_BLOCKS = {
  Y: 159,
  H: 26,
  /** Gap between the two blocks. */
  GAP: 4,
  LABEL_DX: 4,
  LABEL_DY: 3,
  VALUE_DY: 11,
  VALUE_SCALE: 2,
  VALUE_PAD_RIGHT: 4,
} as const;

/** Width of one of the two score blocks. */
export const SCORE_BLOCK_W = Math.floor((CONTENT.W - SCORE_BLOCKS.GAP) / 2);

/**
 * The barbell motif: the lifter's heaviest GOOD attempt, loaded from real
 * competition denominations via `src/art/plates.ts`. Plate colours are weight
 * information in this sport (GDD §7.1), so this is a second, wordless reading
 * of the card's best number — and it is drawn from the same module the lift
 * screen loads its bar from, not from a lookalike table.
 *
 * A lifter who made nothing gets a bare bar. That is honest and it is the
 * point: an empty sleeve is what bombing out looks like.
 */
export const BARBELL = {
  CAPTION_Y: 187,
  CENTER_Y: 209,
  /**
   * Minimum clearance between the caption ("TOP SINGLE") on the left of the
   * line and the lift-and-weight detail on the right.
   *
   * THIS ONE DELETES A LABEL WHEN IT IS WRONG. The two runs share one line; if
   * they would come closer than this, the CAPTION is dropped and only the
   * detail prints, because overlapping type on a card meant to be screenshotted
   * is the most obvious kind of broken there is. Raise it too far and a
   * perfectly legible card silently loses its caption.
   *
   * AT TODAY'S GEOMETRY THE DROP NEVER FIRES: the widest detail the card can
   * produce is "DEADLIFT  9999.5 KG" at 99 px, which with the 54 px caption and
   * this gap comes to 161 px against `CONTENT.W` of 180. It is a guard, not a
   * behaviour anyone will see — and `renderResultCard.test.ts` pins both facts
   * so a tuning pass that narrows the card finds out here rather than in a
   * screenshot.
   */
  CAPTION_MIN_GAP: 8,
  /**
   * Multiplier on the true-scale disc diameter from `plateDiameterPx`. At 1.0 a
   * 450 mm disc is ~15 px, which is too small to read a colour off; this lifts
   * the motif to a legible size without changing the sprite system's own scale.
   */
  DIAMETER_SCALE: 1.75,
  /**
   * Floor on a disc's drawn diameter. The smallest competition denomination is
   * a 0.25 kg change plate, which at true scale is a couple of pixels and would
   * disappear into the shaft; below this it stops reading as a disc at all.
   */
  MIN_DISC_DIAMETER: 4,
  /** Half the shaft's drawn length, from the card's centre line. */
  HALF_SPAN: 46,
  /** Half-length of the bare knurled shaft before the first disc. */
  SHAFT_HALF: 10,
  SHAFT_THICKNESS: 3,
  /** Drawn thickness of one disc, and the pitch between two. */
  PLATE_FACE: 3,
  PLATE_PITCH: 4,
  /**
   * Floor on a disc's drawn thickness once the sleeve compresses. Always at
   * least one less than the pitch, so there is always a gap — the gap is the
   * only thing that makes a stack countable, and a lifter WILL count them.
   */
  MIN_PLATE_FACE: 1,
  /**
   * How tight the pitch may get before a disc is dropped instead. 2 px is one
   * disc and one gap, and the gap is the only thing that makes a stack
   * countable.
   */
  MIN_PLATE_PITCH: 2,
  COLLAR_W: 4,
  COLLAR_H: 9,
  /**
   * A hard ceiling on discs per side, on top of whatever the compressed sleeve
   * can hold. A bar heavier than this still prints its true weight in the
   * caption; only the picture is short, and a real platform runs out of sleeve
   * too.
   */
  MAX_PLATES_PER_SIDE: 12,
} as const;

/** The wordmark strip along the bottom. */
export const FOOTER = {
  Y: 226,
  H: 13,
  TEXT_Y: 229,
  /**
   * The card is the organic-growth lever (GDD §6.5), so it carries the app's
   * name. Not a federation's — GDD §11 leaves real-federation licensing open,
   * and this card ships no real federation's marks.
   */
  WORDMARK: 'THREE WHITE LIGHTS',
} as const;

/** Fixed strings the card prints that are not lifter or meet data. */
export const CARD_LABELS = {
  BODYWEIGHT_SUFFIX: ' KG',
  /**
   * Document kind on the letterhead, the way a published results PDF titles
   * itself. Ours. Not a real federation's "Official Results" mark — GDD §11
   * leaves that licensing open, and this card ships none of those marks.
   */
  DOCUMENT_KIND: 'RESULTS',
  /**
   * There is no CLASS_PREFIX any more. The class number now ends the category
   * phrase ("MEN'S RAW OPEN 93") the way the reference board sets it, which
   * both says whose class it is and costs four pixels LESS than the bare word
   * "CLASS" did.
   */
  /** Lifters' own word for a one-rep best; short enough to share the line. */
  BARBELL_CAPTION: 'TOP SINGLE',
  BARBELL_CAPTION_NONE: 'NO LIFTS MADE',
  UNIT: 'KG',
  /**
   * Between the lift's name and its weight in the barbell caption's detail run
   * — "DEADLIFT  312.5 KG". Two spaces rather than one because at this font's
   * 3px space advance a single one reads as a kerning accident rather than as
   * two fields on one line.
   */
  BARBELL_DETAIL_SEPARATOR: '  ',
} as const;

/**
 * The SCREEN the card is shown on — chrome, not card.
 *
 * Everything above this line is the card's own 192x240 pixel grid, measured in
 * card pixels. Everything here is React Native layout in logical points around
 * it, and the two must not be confused: `CARD.MARGIN` is 6 sprite pixels, which
 * at `DEFAULT_UPSCALE` is 12 logical points.
 *
 * These were bare numbers inside `ResultCardScreen.tsx`'s StyleSheet until the
 * audit found them. UNTUNED, like everything else here.
 */
export const CARD_SCREEN = {
  /** Breathing room above and below the whole stack. */
  PAD_Y: 16,
  /** "MEET COMPLETE" / "MEET OVER". */
  EYEBROW_FONT: 12,
  EYEBROW_TRACKING: 2,
  /** Gap between the eyebrow and the card frame. */
  EYEBROW_GAP: 12,
  /** Hairline around the card, so it reads as a printed object on a surface. */
  FRAME_BORDER: 1,
  /** "Share your result". */
  HINT_FONT: 12,
  HINT_GAP: 14,
} as const;

/**
 * The shareable sheet as a printed object, in logical points.
 *
 * GDD §6.5 and §12.2's Result card bar A/B this against a real federation
 * scoresheet. GDD §7.3 names the result card a Tier 3 high-fidelity surface —
 * large, static, where type has to read. The 192×240 nearest-neighbour grid
 * above remains the §7.1 sprite-era artifact (`renderResultCard`); this block is
 * what `ResultCardView` draws. The GDD does not resolve §7.1 "throughout"
 * against those three sections for this surface. This file does not rewrite
 * that conflict. Presentation follows the Result card bar.
 *
 * Authored against a 390-wide phone. UNTUNED (GDD §12.1).
 */
export const PAPER = {
  W: 358,
  PAD_X: 16,
  PAD_Y: 16,
  FED_SIZE: 11,
  FED_TRACKING: 2.2,
  DOCUMENT_SIZE: 11,
  DOCUMENT_TRACKING: 2.2,
  MEET_SIZE: 17,
  META_SIZE: 11,
  META_TRACKING: 0.4,
  NAME_SIZE: 20,
  CATEGORY_SIZE: 11,
  CATEGORY_TRACKING: 0.3,
  GRID_HEAD_SIZE: 10,
  GRID_HEAD_TRACKING: 0.8,
  LIFT_COL_W: 72,
  CELL_H: 36,
  CELL_FONT: 13,
  LIFT_LABEL_SIZE: 11,
  CELL_PAD: 4,
  /** Inset of a good/miss fill inside its column, so the table rule stays visible. */
  CELL_INSET: 1,
  TOTAL_LABEL_SIZE: 11,
  TOTAL_VALUE_SIZE: 28,
  SCORE_LABEL_SIZE: 10,
  SCORE_VALUE_SIZE: 16,
  SCORE_H: 40,
  FOOTER_SIZE: 10,
  FOOTER_TRACKING: 1.8,
  RULE: 1,
  DOUBLE_RULE_GAP: 2,
  SECTION_GAP: 12,
  MASTHEAD_GAP: 4,
  NAME_GAP: 4,
  /**
   * Compact flight table. Authored against a 390-wide phone. UNTUNED.
   *
   * Two lines per lifter: identity + Weight/Total/Dots on the first, the nine
   * attempts grouped squat → bench → deadlift on the second. That is [R9]
   * grouping without twelve extra columns, and without a squat+bench
   * subtotal ([R8] published pages do not print one; the live-board reference
   * does).
   *
   * Column widths have to hold the [R8] headings on one line (`Place`,
   * `Weight`). A 28pt Place column wrapped to "Pla / ce" on a 390-wide
   * capture; HEAD_H 16 then painted that wrap into the lift-group labels.
   */
  FLIGHT: {
    HEAD_H: 20,
    ATTEMPT_HEAD_H: 28,
    NAME_H: 20,
    ATTEMPT_H: 22,
    PLACE_W: 44,
    WEIGHT_W: 58,
    TOTAL_W: 50,
    DOTS_W: 48,
    NAME_SIZE: 11,
    META_SIZE: 10,
    ATTEMPT_FONT: 10,
    HEAD_SIZE: 9,
    HEAD_TRACKING: 0,
    LIFT_HEAD_SIZE: 8,
    ATTEMPT_PAD: 2,
    SECTION_SIZE: 10,
    SECTION_TRACKING: 0.6,
  },
} as const;
