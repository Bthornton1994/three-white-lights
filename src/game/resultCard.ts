/**
 * resultCard.ts — the shareable meet result card, as DATA.
 *
 * GDD §6.5: "Shareable result card formatted like a real federation result
 * sheet. Real lifters already post meet results on social media as a habit — if
 * the card looks legitimate, this is the strongest organic growth lever in the
 * game."
 *
 * This module turns a FINISHED meet into the exact rows, columns, marks and
 * derived numbers a sheet shows. Every layout decision that is really a data
 * decision lives here — which attempts are struck through, how a bombed lift is
 * marked, what goes in the place column, column order, rounding — so the
 * renderer only decides where pixels go.
 *
 * PURITY CONTRACT (CLAUDE.md "Pure logic is separate from UI"):
 *   - Zero React imports, zero I/O, zero side effects, zero clock reads.
 *   - Imports only `meet.ts` and `dots.ts`, both of which are themselves pure.
 *   - No `Intl`, no `toLocaleString`: a card built on one device and a card
 *     built on a server must be byte-identical, and locale-sensitive number
 *     formatting is the classic way that stops being true.
 *
 * ---------------------------------------------------------------------------
 * SOURCING — WHICH CONVENTIONS ARE CITED AND WHICH ARE OURS
 * ---------------------------------------------------------------------------
 * `docs/reference/README.md` is explicit that the committed reference image
 * (`scoresheet-ref-1-live-attempt-board.png`) is a LIVE IN-MEET ATTEMPT BOARD,
 * not a published results sheet, and must not be stretched into one. So the
 * results-sheet conventions below were retrieved from real sources in this
 * sandbox. [R1]-[R7] returned HTTP 200 on 2026-08-01; [R8] and [R9], which
 * corrected the citation on `RESULT_SHEET_COLUMNS`, on 2026-08-03.
 *
 * CITED — the shape of a published results sheet:
 *
 *   [R1] OpenPowerlifting `docs/results-format.md`
 *        https://gitlab.com/openpowerlifting/opl-data/-/raw/main/docs/results-format.md
 *        Documents `entries.csv`, the format every federation's published
 *        results are transcribed into. Its worked example ends with the row
 *          | DQ | Skeeter Valentine | M | 63.2 | 67.5 | Juniors | Single-ply |
 *          | 140 | (blank) | 130 | (blank) | SBD |
 *        i.e. a lifter who bombed the bench has a BLANK best-bench, a BLANK
 *        total, and the string "DQ" in the Place column. That single row is the
 *        source for PLACE_NO_TOTAL_DISPLAY and for a bombed lift showing no
 *        best rather than a zero.
 *
 *   [R2] Real published results: IPF World Classic Powerlifting Championships,
 *        Chemnitz, 2025-06-08 —
 *        https://gitlab.com/openpowerlifting/opl-data/-/raw/main/meet-data/ipf/2503/entries.csv
 *        393 lifters. Header:
 *          Name,Country,Sex,BirthYear,Division,WeightClassKg,BodyweightKg,
 *          Squat1Kg,Squat2Kg,Squat3Kg,Best3SquatKg,
 *          Bench1Kg,Bench2Kg,Bench3Kg,Best3BenchKg,
 *          Deadlift1Kg,Deadlift2Kg,Deadlift3Kg,Best3DeadliftKg,
 *          TotalKg,Place,Event,Equipment,BirthDate
 *        THAT IS THE ORDER OF `RESULT_CARD_CSV_HEADER`, AND OF NOTHING ELSE IN
 *        THIS FILE. entries.csv is a TRANSCRIPTION format, not a rendering:
 *        Place is the 21st of its 24 fields and Equipment the 23rd, which is
 *        not where either of them lands on a page a lifter reads. For the
 *        RENDERED order — `RESULT_SHEET_COLUMNS` — see [R8].
 *        `RESULT_CARD_CSV_HEADER` is this header with the four fields the card
 *        does not carry struck out (Country, BirthYear, Event, BirthDate) and
 *        the remaining twenty left in this order, under these names.
 *        Sample rows (verbatim):
 *          Tiffany Chapon,France,F,2001,Open,47,46.7,155,162.5,-166,162.5,...
 *          Matheus dos Santos,Brazil,M,2001,Open,83,82.12,-262.5,-262.5,-262.5,,
 *            135,140,145,145,285,292.5,-297.5,292.5,,DQ,SBD,Raw,
 *        Nine of its rows carry Place=DQ, every one of them with a blank total.
 *
 *   [R3] `WeightKg` in the OpenPowerlifting checker —
 *        https://raw.githubusercontent.com/sstangl/openpowerlifting/main/crates/opltypes/src/weightkg.rs
 *          /// Whether the weight is negative, representing a failed lift.
 *          pub fn is_failed(self) -> bool { self < WeightKg::from_i32(0) }
 *          /// Whether the weight is zero, representing a lift not taken.
 *          pub fn is_zero(self) -> bool { ... }
 *        This is the source for `AttemptCell.signedWeightKg`: a made attempt is
 *        recorded positive, a MISSED attempt is recorded as the NEGATIVE of the
 *        weight, and an attempt never taken is zero.
 *
 *   [R4] OpenLifter (the open-source software that runs real meets) writes
 *        exactly that when exporting official results —
 *        https://gitlab.com/openpowerlifting/openlifter/-/raw/main/src/logic/export/oplcsv.ts
 *          row[csv.index(field)] = csvString(weight(entry.squatKg[i] * entry.squatStatus[i]));
 *          row[csv.index("Place")] = finalEventTotalKg === 0 ? "DQ" : csvString(index + 1);
 *        with `LiftStatus = -1 | 0 | 1` (failure / not taken / success) in
 *        https://gitlab.com/openpowerlifting/openlifter/-/raw/main/src/types/dataTypes.ts
 *        Its USAPL export (`src/logic/export/usapl.ts`) writes the same product
 *        into the columns "Squat 1".."Deadlift 3".
 *
 *   [R5] Weight-class string — OpenLifter `src/reducers/meetReducer.ts`:
 *          export const getWeightClassStr = (classes, bodyweightKg) => {
 *            for (...) if (bodyweightKg <= classes[i]) return displayWeight(classes[i]);
 *            return displayWeight(classes[classes.length - 1]) + "+";
 *          };
 *        i.e. the lightest class the lifter makes, and `N+` above the top class.
 *        `formatWeight` below is a transcription of the same file's
 *        `displayWeight` (round to 2dp, nudge a trailing 9, hide trailing
 *        zeros), minus its `Intl` call.
 *
 *   [R6] Column HEADINGS as a results table renders them — OpenPowerlifting's
 *        language pack,
 *        https://raw.githubusercontent.com/sstangl/openpowerlifting/main/crates/langpack/translations/en.json
 *          "columns": { "place": "Place", "liftername": "Lifter",
 *            "division": "Division", "sex": "Sex", "age": "Age",
 *            "equipment": "Equip", "weightclass": "Class",
 *            "bodyweight": "Weight", "squat": "Squat", "bench": "Bench",
 *            "deadlift": "Deadlift", "total": "Total", "dots": "Dots", ... }
 *        and OpenLifter's own `src/translations/en.json`, which names the
 *        per-attempt columns "S1".."S3", "B1".."B3", "D1".."D3".
 *
 *   [R7] Weight classes. The class lists in `WEIGHT_CLASSES_KG` are the
 *        distinct `WeightClassKg` values actually present in [R2]: women
 *        47/52/57/63/69/76/84/84+, men 59/66/74/83/93/105/120/120+.
 *
 *   [R8] THE SAME RESULTS, RENDERED — and the source for the order of
 *        `RESULT_SHEET_COLUMNS`. OpenPowerlifting's own meet-page template,
 *        https://gitlab.com/openpowerlifting/opl-data/-/raw/main/server/templates/openpowerlifting/desktop/meet.html.tera
 *        Its `<thead>`, in order, with each `strings.columns.*` resolved
 *        through [R6]'s language pack:
 *          MEET PAGE COLUMNS: Place | Lifter | Sex | Age | Equip | Class |
 *            Weight | Squat | Bench | Deadlift | Total | Points
 *        Place is the FIRST cell, and it prints "DQ" literally — the template
 *        branches on `this.place == "DQ"` before it will print a rank. Equip
 *        sits mid-row, between the lifter's sex and their class, nowhere near
 *        the tail [R2] transcribes it at. The division is not a column at all
 *        on this page: it is a section heading over a group of rows,
 *        `<td colspan="12" class="divheader">{{table.title}}</td>`.
 *
 *        WHERE `RESULT_SHEET_COLUMNS` DEPARTS FROM THAT LINE, in full — these
 *        four and nothing else:
 *          - `Division` is a COLUMN for us. One card is one lifter's row, so
 *            there is no group of rows for a section heading to sit over. It
 *            goes ahead of the equipment, which is where [R2] and [R9] both
 *            put it.
 *          - `Age` is DROPPED. `ResultCardLifterInput` carries no birth year to
 *            compute one from, and a column we would have to invent a datum for
 *            is worse than no column. [R8] itself only prints it
 *            `{% if has_age_data %}`.
 *          - Each lift is FOUR columns — three attempts and a best — where a
 *            meet page prints the best alone. That expansion is cited to [R9].
 *          - `Points` becomes `Dots`. The template's heading is whichever
 *            formula the federation ranks on (`points_column_title`); GDD §6.4
 *            picks DOTS, and [R6] names that column `Dots`.
 *        AND SO, IN `RESULT_SHEET_COLUMNS`: place is at index 0, division at
 *        index 3, equipment at index 4, and there is no age column at all.
 *        This block used to say the opposite — that the order was [R2]'s,
 *        "then total, then place" — which was false of the constant printed
 *        200 lines below it, and was the one claim in this file with no
 *        mechanised check behind it. `resultCard.test.ts` now collapses the
 *        constant back into a meet-page row and diffs it against the line
 *        above, and reads these indices out of this comment to check them.
 *
 *   [R9] PER-LIFT ATTEMPT COLUMNS, RENDERED. OpenPowerlifting's lifter page,
 *        https://gitlab.com/openpowerlifting/opl-data/-/raw/main/server/templates/openpowerlifting/desktop/lifter.html.tera
 *          {% if show_attempts %}
 *            <th colspan="4">{{strings.columns.squat}}</th>
 *            <th colspan="4">{{strings.columns.bench}}</th>
 *            <th colspan="4">{{strings.columns.deadlift}}</th>
 *        Four cells grouped under the lift's own name, three lifts in
 *        squat -> bench -> deadlift order, sitting between the bodyweight and
 *        the total. That is the structure `ATTEMPT_GRID_HEADINGS` transposes
 *        into `LIFT | 1 | 2 | 3 | BEST` rows.
 *        ONE DIFFERENCE, and it is not cosmetic: the fourth cell there is the
 *        FOURTH ATTEMPT (`{{this.squat4}}` — a record attempt, outside the
 *        total), not the best. Ours is the best. Nothing in this codebase
 *        models a fourth attempt (GDD §6.2: three per lift), and a card that
 *        dropped the best column would be missing the number the total is made
 *        of. So the GROUPING is cited; the BEST column is [R2]'s
 *        `Best3SquatKg` given a column of its own; the headings `1`/`2`/`3`
 *        and `BEST` are ours ([R6]/OpenLifter call them "S1".."D3").
 *        This page also sets Division ahead of Equipment, as [R2] does.
 *
 * OURS, NOT CITED — say so rather than dressing it up:
 *
 *   - THE STRIKE-THROUGH. [R3]/[R4] establish that a missed attempt is recorded
 *     as a negative number; they say nothing about how a *rendered* sheet marks
 *     one. `AttemptCell.struckThrough` and `NO_LIFT_STRIKES_THROUGH` are our
 *     presentation choice. The committed reference image shows a live board
 *     using red/green cell fill, which the reference README does license for
 *     "good/no-lift colour coding" — but in a LIVE context. The renderer uses
 *     both (colour and a strike) because redundancy is cheap; neither is a
 *     claim about what a federation prints.
 *   - `NO_VALUE_DISPLAY` = "—". [R1]/[R2] leave a missing total BLANK. A blank
 *     cell on a shareable card reads as a rendering failure, so we print the
 *     same em dash `dots.ts` already uses for a scoreless lifter
 *     (`DOTS_NO_TOTAL_DISPLAY`). The underlying fact — there is no value — is
 *     the cited one; the glyph is ours.
 *   - THE POSSESSIVE CATEGORY PHRASE, e.g. "MEN'S RAW OPEN 93". The FACTS in it
 *     are [R2]'s columns (Sex, Equipment, Division, WeightClassKg) and the WORD
 *     ORDER is the one real board we can actually look at — the committed
 *     `docs/reference/scoresheet-ref-1-live-attempt-board.png`, whose Division
 *     column reads "Women's Raw Open 52": sex, equipment, division, then the
 *     class number. The specific English words "MEN'S"/"WOMEN'S" and the caps
 *     are ours. [R6]'s language pack renders sex as the bare letters M/F, and
 *     that is what `sexText` and the CSV row use — but a bare letter only works
 *     UNDER A "Sex" COLUMN HEADING, and a one-lifter shareable card has no
 *     heading row for it to sit under. See `lifterCategoryText`.
 *   - The DATE and LOCATION formats ("08 JUN 2025", "CHEMNITZ, GERMANY").
 *     [R1] fixes the meet.csv FIELDS (Federation, Date ISO-8601, MeetCountry,
 *     MeetState, MeetTown, MeetName); how they are laid out on a card is ours.
 *   - Lift row labels "SQUAT"/"BENCH"/"DEADLIFT" in caps.
 *   - Which of the many published coefficients to print. GDD §6.4 picks DOTS;
 *     `dots.ts` owns the number and this module only asks it for the string.
 *   - THE FEDERATION IS INVENTED ON PURPOSE. GDD §11 has "invented feds, or is
 *     there licensing value in real ones (USAPL, USPA, NPL)?" still open, so
 *     `ResultCardMeet.federation` is caller-supplied and this module ships no
 *     real federation's name or marks.
 *
 * ---------------------------------------------------------------------------
 * A BOMBED LIFTER IS RENDERED, NOT HIDDEN — AND NEVER RANKED
 * ---------------------------------------------------------------------------
 * OpenLifter's on-screen results view drops a DQ'd lifter's row entirely
 * ("Meet directors have reported that it's embarrassing to the DQ'd lifter to
 * have that projected" — ByDivision.tsx). That is right for a projector at a
 * meet and wrong here: this is ONE lifter's own card, and the player who bombed
 * is the player looking at it. The card shows their attempts honestly, marks
 * the bombed lift with no best, prints no total and no DOTS, and puts "DQ" in
 * the place column.
 *
 * What it will not do is give them a number. `meet.ts` says a bombed lifter has
 * `finalMeetTotal(state) === null`; `dots.ts` returns an outcome with no
 * `score` field at all. This module never reaches for `?? 0`, never touches
 * `totalOnTheBoard` (which is a provisional running sum and NOT a result), and
 * REFUSES to build a card that pairs a numeric placing with a missing total —
 * see `PLACING_WITHOUT_TOTAL`. A lifter who did not total does not place.
 *
 * ---------------------------------------------------------------------------
 * THE CARD ALWAYS SAYS WHOSE CATEGORY THIS IS
 * ---------------------------------------------------------------------------
 * The card prints a DOTS score, and DOTS takes the lifter's SEX as an input
 * (`dots.ts` keeps a separate coefficient set per sex, and scoring a woman's
 * total on the men's polynomial silently changes the answer). A card that
 * publishes the coefficient while withholding one of its inputs cannot be
 * checked by the people GDD §6.5 says have to believe it. The weight class does
 * not stand in for it either: 84 is a women's class and 83 a men's, and `120+`
 * and `84+` are both just "the top one".
 *
 * So sex is not an optional field on this card. `lifterCategoryText` welds it
 * to the front of the category phrase — "MEN'S RAW OPEN 93" — where the layout
 * can shorten the phrase but has no way to reach in and remove it. The layout's
 * degradation ladder (`src/card/cardTuning.ts`) can SPEND only `equipment` and
 * `division`; sex and weight class are not in its vocabulary at all. It can
 * also move the division or the bodyweight onto a second line of the strip —
 * `divisionCategoryWord` exists for that — but moving is not dropping: no
 * combination of a rung's flags produces a strip without the bodyweight, and a
 * card that prints a PLACING is not offered the rungs that spend the division,
 * because a placing is a placing in a division.
 *
 * `sexText` (M/F) is untouched and still what `resultSheetLine` and
 * `resultCardEntriesCsvRow` carry, because those reproduce [R2]'s columns under
 * [R2]'s headings. Two renderings of one fact, each correct in its own context.
 */

import {
  ATTEMPT_NUMBERS,
  LIFT_ORDER,
  readTotal,
  type AttemptNumber,
  type CompletedAttempt,
  type JudgedAttempt,
  type LiftKind,
  type LiftProgress,
  type LiftStatus,
  type MeetState,
} from './meet';
import {
  DOTS_NO_TOTAL_DISPLAY,
  DOTS_TOTAL_UNIT,
  evaluateMeetDots,
  formatDotsOutcome,
  hasDotsScore,
  type DotsOutcome,
  type DotsSex,
} from './dots';

// ---------------------------------------------------------------------------
// Display policy — one place, per CLAUDE.md "Game Feel Values Must Be Tunable".
//
// None of these change a number; they change how a number is printed. Layout
// geometry lives in `src/card/cardTuning.ts`, not here: this file decides what
// the sheet SAYS, that one decides where it sits.
// ---------------------------------------------------------------------------

/**
 * What goes in a cell that has no value: a lift that was bombed, a total that
 * does not exist, a placing that was never supplied.
 *
 * OURS, not cited. [R1]/[R2] leave the cell blank. Matches
 * `DOTS_NO_TOTAL_DISPLAY` so one glyph means "there is nothing here" everywhere
 * on the card.
 */
export const NO_VALUE_DISPLAY = DOTS_NO_TOTAL_DISPLAY;

/**
 * What goes in the Place column for a lifter with no total.
 *
 * CITED [R1][R4]: OpenPowerlifting's own results format documents "DQ" in the
 * Place column of a lifter whose total is blank, and OpenLifter writes exactly
 * `finalEventTotalKg === 0 ? "DQ" : (index + 1)`.
 */
export const PLACE_NO_TOTAL_DISPLAY = 'DQ';

/**
 * Whether a missed attempt is drawn with a line through it.
 *
 * OURS. The cited convention is a negative number in the data
 * (`AttemptCell.signedWeightKg`); the strike is presentation. Turn it off and
 * the cell still reads as a miss from its colour and its sign.
 */
export const NO_LIFT_STRIKES_THROUGH = true;

/** Decimal places a bodyweight is printed to. Real sheets print two ([R2]). */
export const BODYWEIGHT_DECIMALS = 2;

/**
 * OpenLifter's correction for a hundredths digit of 9, transcribed from
 * `displayWeight` [R5]: a lb<->kg conversion lands on 192.49999999999997, which
 * rounds to 19249 hundredths and would print "192.49" rather than "192.5".
 *
 * NOT A TUNABLE. `DIGIT` is 9 because 9 is the digit a downward float artefact
 * produces, and `RADIX` is 10 because the printed form is decimal.
 */
const HUNDREDTHS_ARTEFACT = Object.freeze({ RADIX: 10, DIGIT: 9 });

/** Month abbreviations for the meet date. Uppercase; ours, see the note above. */
export const MONTH_ABBREVIATIONS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
] as const;

/**
 * How the card names a lifter's sex in prose, as opposed to in a CSV cell.
 *
 * OURS in its wording; the CONSTRUCTION is cited to the committed reference
 * board (`docs/reference/scoresheet-ref-1-live-attempt-board.png`), whose
 * Division column reads "Women's Raw Open 52" — the possessive qualifying the
 * whole category, class number last.
 *
 * NOT a replacement for `sexText`. [R6]'s language pack renders sex as "M"/"F"
 * and that is right for a table with a "Sex" column heading, which is what
 * `resultSheetLine` and `resultCardEntriesCsvRow` reproduce. A single-lifter
 * shareable card has no heading row, so a bare "M" on it has nothing to be read
 * against — it could as easily be read as Masters or Multi-ply.
 */
export const SEX_CATEGORY_WORD: Readonly<Record<DotsSex, string>> = {
  male: "MEN'S",
  female: "WOMEN'S",
};

/** The word that joins the parts of the category phrase. */
export const CATEGORY_WORD_SEPARATOR = ' ';

/** Row labels down the left of the attempt grid. Ours. */
export const LIFT_ROW_LABELS: Readonly<Record<LiftKind, string>> = {
  squat: 'SQUAT',
  bench: 'BENCH',
  deadlift: 'DEADLIFT',
};

/**
 * Weight classes, in kilograms, as they appear in [R2] — the classes real
 * lifters were entered in at the 2025 IPF World Classic Championships. A meet
 * that runs different classes passes its own list to `weightClassString`.
 */
export const WEIGHT_CLASSES_KG: Readonly<Record<DotsSex, readonly number[]>> = {
  female: [47, 52, 57, 63, 69, 76, 84],
  male: [59, 66, 74, 83, 93, 105, 120],
};

// ---------------------------------------------------------------------------
// Column order — DATA, not layout.
//
// The order is [R8]'s: the order a results table is RENDERED in, headings and
// all, on the page a lifter actually reads. It is NOT [R2]'s — entries.csv is a
// transcription format that puts Place 21st and Equipment 23rd, and the one
// thing in this file that follows it is `RESULT_CARD_CSV_HEADER`. Two orderings
// live in this module and they are cited to two different sources on purpose.
// A renderer walks this list; it does not hard-code a sequence of its own.
// ---------------------------------------------------------------------------

export type ResultSheetColumnId =
  | 'place'
  | 'lifter'
  | 'sex'
  | 'division'
  | 'equipment'
  | 'weightClass'
  | 'bodyweight'
  | 'squat1'
  | 'squat2'
  | 'squat3'
  | 'bestSquat'
  | 'bench1'
  | 'bench2'
  | 'bench3'
  | 'bestBench'
  | 'deadlift1'
  | 'deadlift2'
  | 'deadlift3'
  | 'bestDeadlift'
  | 'total'
  | 'dots';

export interface ResultSheetColumn {
  readonly id: ResultSheetColumnId;
  /** Heading as a results table prints it ([R6]). */
  readonly heading: string;
  /** Numeric columns are right-aligned and set in tabular figures. */
  readonly numeric: boolean;
}

/**
 * The full row of a RENDERED results table, in [R8]'s order:
 * `Place | Lifter | Sex | Equip | Class | Weight | ...lifts... | Total`,
 * with each lift expanded to three attempts and a best per [R9], `Division`
 * added at index 3 (a one-lifter card has no section headings to carry it),
 * `Age` dropped (no birth year reaches this module), and `Points` printed as
 * `Dots` because GDD §6.4 scores by DOTS and [R6] names that column "Dots".
 *
 * Those four are the complete list of departures and [R8] states them; if this
 * array and that comment ever stop agreeing, `resultCard.test.ts` fails rather
 * than a reader having to notice. `RESULT_CARD_CSV_HEADER` is the OTHER
 * ordering — [R2]'s transcription order — and is cited separately.
 */
export const RESULT_SHEET_COLUMNS: readonly ResultSheetColumn[] = [
  { id: 'place', heading: 'Place', numeric: false },
  { id: 'lifter', heading: 'Lifter', numeric: false },
  { id: 'sex', heading: 'Sex', numeric: false },
  { id: 'division', heading: 'Division', numeric: false },
  { id: 'equipment', heading: 'Equip', numeric: false },
  { id: 'weightClass', heading: 'Class', numeric: true },
  { id: 'bodyweight', heading: 'Weight', numeric: true },
  { id: 'squat1', heading: 'S1', numeric: true },
  { id: 'squat2', heading: 'S2', numeric: true },
  { id: 'squat3', heading: 'S3', numeric: true },
  { id: 'bestSquat', heading: 'Squat', numeric: true },
  { id: 'bench1', heading: 'B1', numeric: true },
  { id: 'bench2', heading: 'B2', numeric: true },
  { id: 'bench3', heading: 'B3', numeric: true },
  { id: 'bestBench', heading: 'Bench', numeric: true },
  { id: 'deadlift1', heading: 'D1', numeric: true },
  { id: 'deadlift2', heading: 'D2', numeric: true },
  { id: 'deadlift3', heading: 'D3', numeric: true },
  { id: 'bestDeadlift', heading: 'Deadlift', numeric: true },
  { id: 'total', heading: 'Total', numeric: true },
  { id: 'dots', heading: 'Dots', numeric: true },
] as const;

/**
 * One published-table row on a portrait shareable sheet.
 *
 * [R8] meet-page order, compressed so a 390-wide phone can hold a field:
 * Place, Lifter, Weight, best squat, best bench, best deadlift, Total, points.
 * Sex, division, equipment and class sit on the section heading over the table
 * — the same job [R8] gives `divheader`. The lift columns are BESTS. Per-attempt
 * cells are data on the card (`signedAttemptText`); they are not twelve extra
 * columns and they are not a history stacked under the best.
 *
 * No squat+bench subtotal. The committed live-board reference prints one; [R8]
 * published meet pages do not. This list follows [R8].
 */
export const RESULT_FLIGHT_TABLE_COLUMNS: readonly ResultSheetColumnId[] = [
  'place',
  'lifter',
  'bodyweight',
  'bestSquat',
  'bestBench',
  'bestDeadlift',
  'total',
  'dots',
];

export function sheetColumnHeading(id: ResultSheetColumnId): string {
  for (const column of RESULT_SHEET_COLUMNS) {
    if (column.id === id) return column.heading;
  }
  throw new RangeError(`resultCard: no heading for column "${id}"`);
}

/**
 * Headings on the shareable flight table.
 *
 * Same words as `sheetColumnHeading` except the points column, which the
 * summary block already prints as `DOTS` (GDD §6.4). [R6] still names the
 * long-row heading `Dots`; that citation stays on `RESULT_SHEET_COLUMNS`.
 */
export function flightColumnHeading(id: ResultSheetColumnId): string {
  if (id === 'dots') return 'DOTS';
  return sheetColumnHeading(id);
}

/**
 * Surname first, the way a published meet table sets a name ("ASHFORD, M.").
 *
 * The fixture and the identity scan keep "M. ASHFORD" — an initial and a
 * surname, not a realistic given name (GDD §12.3). The sheet rearranges that
 * same string. Names that are not "X. SURNAME" print unchanged.
 */
export function flightLifterName(name: string): string {
  const trimmed = name.trim();
  const match = /^([A-Za-z])\.\s+(.+)$/.exec(trimmed);
  if (match === null || match[1] === undefined || match[2] === undefined) {
    return trimmed.toUpperCase();
  }
  return `${match[2]}, ${match[1]}.`.toUpperCase();
}

/**
 * The attempt grid's own headings, for a card that stacks the three lifts as
 * rows instead of running [R8]'s one long line. Same information, transposed:
 * [R9] groups four cells under each lift's name and we turn that group into a
 * row. The headings themselves are ours — [R6]/OpenLifter call the per-attempt
 * columns "S1".."D3" — and so is `BEST`, since [R9]'s fourth cell is a fourth
 * attempt rather than a best. See [R9] for why we keep a best there anyway.
 */
export const ATTEMPT_GRID_HEADINGS = {
  lift: 'LIFT',
  attempts: ['1', '2', '3'] as const,
  best: 'BEST',
} as const;

// ---------------------------------------------------------------------------
// Number and string formatting
// ---------------------------------------------------------------------------

/**
 * A weight as a results sheet prints it: at most two decimals, trailing zeros
 * hidden. Transcribed from OpenLifter's `displayWeight` [R5], including its
 * correction for a hundredths digit of 9 (a float artefact of lb<->kg
 * conversion), with the `Intl` call replaced so the output cannot vary by
 * locale.
 */
export function formatWeight(weight: number): string {
  if (!Number.isFinite(weight)) {
    throw new RangeError(`resultCard: cannot format a non-finite weight (${String(weight)})`);
  }
  let hundredths = Math.round(weight * 100);
  if (Math.abs(hundredths) % HUNDREDTHS_ARTEFACT.RADIX === HUNDREDTHS_ARTEFACT.DIGIT) {
    hundredths += hundredths < 0 ? -1 : 1;
  }
  const value = hundredths / 100;
  // toFixed then trim: `String(0.1 + 0.2)` would leak binary noise, `toFixed(2)`
  // cannot, and the trim restores "192.5" from "192.50" and "200" from "200.00".
  const fixed = value.toFixed(2);
  return fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
}

/**
 * One attempt as a published results sheet records it [R3]: made positive,
 * missed NEGATIVE, blank when not taken. `AttemptCell.text` stays the weight
 * as called; the sign lives here so a renderer cannot invent a second miss
 * grammar inside a `.tsx` file.
 */
export function signedAttemptText(cell: AttemptCell): string {
  if (cell.signedWeightKg === 0) return '';
  return formatWeight(cell.signedWeightKg);
}

/** A bodyweight, which real sheets print to two places even when round ([R2]). */
export function formatBodyweight(bodyweightKg: number): string {
  if (!Number.isFinite(bodyweightKg) || bodyweightKg <= 0) {
    throw new RangeError(`resultCard: bodyweight must be a positive number, received ${String(bodyweightKg)}`);
  }
  return bodyweightKg.toFixed(BODYWEIGHT_DECIMALS);
}

/**
 * The lifter's weight class as a string: the lightest class they make, or
 * `N+` above the top class. Transcribed from OpenLifter's `getWeightClassStr`
 * [R5].
 */
export function weightClassString(bodyweightKg: number, classesKg: readonly number[]): string {
  if (!Number.isFinite(bodyweightKg) || bodyweightKg <= 0) {
    throw new RangeError(`resultCard: bodyweight must be a positive number, received ${String(bodyweightKg)}`);
  }
  if (classesKg.length === 0) return '';
  for (const limit of classesKg) {
    if (bodyweightKg <= limit) return formatWeight(limit);
  }
  const top = classesKg[classesKg.length - 1];
  return top === undefined ? '' : `${formatWeight(top)}+`;
}

/**
 * An ISO-8601 date (`YYYY-MM-DD`, the field format [R1] specifies for
 * `meet.csv`) as the card prints it. No `Date` parsing: a `Date` would drag in
 * the host timezone and could shift the day.
 */
export function formatMeetDate(dateIso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso);
  if (match === null) {
    throw new RangeError(`resultCard: meet date must be ISO-8601 YYYY-MM-DD, received "${dateIso}"`);
  }
  const [, year, month, day] = match;
  if (year === undefined || month === undefined || day === undefined) {
    throw new RangeError(`resultCard: meet date must be ISO-8601 YYYY-MM-DD, received "${dateIso}"`);
  }
  const monthIndex = Number(month) - 1;
  const abbreviation = MONTH_ABBREVIATIONS[monthIndex];
  if (abbreviation === undefined) {
    throw new RangeError(`resultCard: meet date has no month ${month} ("${dateIso}")`);
  }
  return `${day} ${abbreviation} ${year}`;
}

/** Town, state and country joined for the header. Blank parts are dropped. */
export function formatMeetLocation(parts: {
  readonly town?: string;
  readonly state?: string;
  readonly country?: string;
}): string {
  return [parts.town, parts.state, parts.country]
    .map((part) => (part ?? '').trim())
    .filter((part) => part !== '')
    .join(', ')
    .toUpperCase();
}

// ---------------------------------------------------------------------------
// The card model
// ---------------------------------------------------------------------------

export type AttemptMark =
  /** Judged good. Counts toward the best. */
  | 'good'
  /** Judged a no-lift. Struck through; recorded as a negative weight [R3]. */
  | 'no-lift'
  /** Forfeited without taking the bar. Carries no weight. */
  | 'passed'
  /** Never reached — the meet ended first, or the lift was not contested. */
  | 'not-taken';

export interface AttemptCell {
  readonly attemptNumber: AttemptNumber;
  readonly mark: AttemptMark;
  /** What the cell prints. Empty string when there is no weight to print. */
  readonly text: string;
  /** The bar weight, or null when the attempt was never taken. */
  readonly weightKg: number | null;
  /**
   * The same attempt in the convention published results are recorded in [R3]:
   * positive when made, NEGATIVE when missed, 0 when not taken. This is the
   * cited fact; `struckThrough` is our rendering of it.
   */
  readonly signedWeightKg: number;
  readonly struckThrough: boolean;
  /** White lights, or null when there was no judging decision. */
  readonly whiteLights: number | null;
}

export interface LiftRow {
  readonly lift: LiftKind;
  readonly label: string;
  readonly status: LiftStatus;
  readonly attempts: readonly [AttemptCell, AttemptCell, AttemptCell];
  /** Best good lift, or null when the lift was bombed or never contested. */
  readonly bestKg: number | null;
  /** `NO_VALUE_DISPLAY` when there is no best — never "0" ([R1]/[R2]). */
  readonly bestText: string;
  /** True when all three attempts were used and none was good. */
  readonly bombed: boolean;
}

export interface ResultCardMeetHeader {
  readonly federation: string;
  readonly name: string;
  readonly dateText: string;
  /** Town, state and country. */
  readonly locationText: string;
  /**
   * Town only. A masthead has one line for the date and the place, and
   * "NEWCASTLE UPON TYNE, ENGLAND" does not fit next to a date — so the
   * renderer needs a shorter true statement to fall back to rather than a
   * truncated one. Empty when the meet has no town.
   */
  readonly locationShortText: string;
}

/**
 * The four facts `lifterCategoryText` needs. `ResultCardLifterHeader` satisfies
 * it structurally, so a caller holding a built card just passes `card.lifter`.
 */
export interface LifterCategory {
  readonly sex: DotsSex;
  readonly division: string;
  readonly equipment: string;
  readonly weightClassText: string;
}

/**
 * Which of the phrase's OPTIONAL words to keep. Sex and weight class are absent
 * from this type on purpose: there is no way to ask for a phrase without them.
 */
export interface LifterCategoryParts {
  readonly equipment: boolean;
  readonly division: boolean;
}

/** Everything in the phrase, which is what a card prints when it has the room. */
export const FULL_LIFTER_CATEGORY: LifterCategoryParts = { equipment: true, division: true };

/**
 * The division as the category phrase sets it: trimmed, in caps.
 *
 * Exported because the division does not always sit inside the phrase. On a
 * real meet page it is not a column at all — it is the section heading over a
 * group of rows ([R8]) — and on a one-lifter card, when the phrase will not fit
 * beside the bodyweight, the layout puts it on a line of its own rather than
 * spending it (`src/card/cardTuning.ts`). A renderer that upper-cased it a
 * second time on its own is how two parts of one card start disagreeing about
 * what a lifter's division is called, so there is one transformation here and
 * `lifterCategoryText` uses it too.
 */
export function divisionCategoryWord(lifter: LifterCategory): string {
  return lifter.division.trim().toUpperCase();
}

/**
 * The lifter's category as a board prints it: "MEN'S RAW OPEN 93",
 * "WOMEN'S SINGLE-PLY MASTERS 1 84+".
 *
 * Word order is the committed reference board's ("Women's Raw Open 52"): sex,
 * equipment, division, class. Note this is NOT `RESULT_SHEET_COLUMNS`' order,
 * which puts Division before Equipment as both [R2] and [R9] do. A tabulated
 * row and a spoken category name are two different renderings and neither is
 * wrong.
 *
 * `include` may drop the equipment or the division. It cannot drop the sex or
 * the class, because there is no argument for doing so — see the header comment
 * on why the sex in particular is load-bearing next to a DOTS score.
 */
export function lifterCategoryText(
  lifter: LifterCategory,
  include: LifterCategoryParts = FULL_LIFTER_CATEGORY,
): string {
  const words: string[] = [SEX_CATEGORY_WORD[lifter.sex]];
  if (include.equipment) words.push(lifter.equipment.trim().toUpperCase());
  if (include.division) words.push(divisionCategoryWord(lifter));
  words.push(lifter.weightClassText.trim());
  return words.filter((word) => word !== '').join(CATEGORY_WORD_SEPARATOR);
}

export interface ResultCardLifterHeader extends LifterCategory {
  readonly name: string;
  /** "M" / "F", as [R6]'s language pack and [R2]'s `Sex` column render it. */
  readonly sexText: string;
  /**
   * The same fact in the form the CARD prints, welded to the category so no
   * layout can drop it: `lifterCategoryText(this)`.
   */
  readonly categoryText: string;
  readonly bodyweightText: string;
}

export interface ResultCardSummaryRow {
  readonly id: 'total' | 'dots' | 'place';
  readonly label: string;
  readonly value: string;
  /** False when the row is printing `NO_VALUE_DISPLAY` or `DQ`. */
  readonly hasValue: boolean;
}

export interface ResultCard {
  readonly meet: ResultCardMeetHeader;
  readonly lifter: ResultCardLifterHeader;
  readonly rows: readonly [LiftRow, LiftRow, LiftRow];
  /**
   * The flight this placing is a rank in. Always includes the player. Extra
   * rows are caller-supplied competitors already ranked outside this module —
   * this file prints `placing`, it does not compute one. Empty of NPCs when
   * the caller has no field; the paper sheet still draws the player's row.
   */
  readonly field: readonly ResultCardFlightRow[];
  /** Ordered summary block: TOTAL, DOTS, PLACE. */
  readonly summary: readonly [ResultCardSummaryRow, ResultCardSummaryRow, ResultCardSummaryRow];
  /** The official total, or null. Never a provisional running sum. */
  readonly totalKg: number | null;
  /** True only when the lifter totalled AND a placing was supplied. */
  readonly placed: boolean;
  /** The lift that ended the meet, or null when the lifter totalled. */
  readonly bombedLift: LiftKind | null;
  /** The DOTS outcome the summary was built from — no score when no total. */
  readonly dots: DotsOutcome;
}

/**
 * One competitor on the shareable sheet. Ranked by the caller (`meetBoard`).
 * Sex is the category the sheet is headed with: a local flight is one
 * division, and NPC fixtures do not carry a sex of their own.
 */
export interface ResultCardFlightEntry {
  readonly id: string;
  readonly name: string;
  readonly sex: DotsSex;
  readonly bodyweightKg: number;
  readonly isPlayer: boolean;
  readonly state: MeetState;
  readonly placing: number | null;
}

export interface ResultCardFlightRow {
  readonly id: string;
  readonly isPlayer: boolean;
  readonly place: number | null;
  readonly placeText: string;
  readonly name: string;
  readonly bodyweightText: string;
  readonly rows: readonly [LiftRow, LiftRow, LiftRow];
  readonly totalKg: number | null;
  readonly totalText: string;
  readonly dotsText: string;
  readonly bombed: boolean;
}

export interface ResultCardMeetInput {
  readonly federation: string;
  readonly name: string;
  /** ISO-8601 `YYYY-MM-DD`, the field format in [R1]'s `meet.csv`. */
  readonly dateIso: string;
  readonly town?: string;
  readonly state?: string;
  readonly country?: string;
}

export interface ResultCardLifterInput {
  readonly name: string;
  readonly sex: DotsSex;
  readonly bodyweightKg: number;
  readonly division: string;
  readonly equipment: string;
  /** Overrides the class derived from bodyweight, for a lifter who moved up. */
  readonly weightClassKg?: string;
  /** Class list this meet ran. Defaults to [R7]'s. */
  readonly weightClassesKg?: readonly number[];
}

export interface ResultCardInput {
  readonly meet: ResultCardMeetInput;
  readonly lifter: ResultCardLifterInput;
  readonly state: MeetState;
  /**
   * Where the lifter finished in their category. Comes from OUTSIDE the meet
   * engine — `meet.ts` holds one lifter's card and has no field to place them
   * in (GDD §6.6 async ghosts / a server row). Omit it when the field is not
   * known; supplying one for a lifter with no total is refused.
   */
  readonly placing?: number;
  /**
   * The rest of the flight. Ranked already — this module will not invent a
   * third placing algorithm. Omit when the field is not known; the sheet then
   * still carries the player's own row so Place is never a rank in an empty
   * room that the renderer has to special-case.
   */
  readonly field?: readonly ResultCardFlightEntry[];
}

export type ResultCardErrorCode =
  /** The meet is not over, so there is no result to card. */
  | 'MEET_IN_PROGRESS'
  /**
   * A numeric placing was supplied for a lifter with no total. This is the
   * refusal the whole module exists around: a bombed lifter is absent from a
   * board, never ranked at the bottom of it.
   */
  | 'PLACING_WITHOUT_TOTAL'
  /**
   * The meet was not run in kilograms. Every number on this sheet is a kilogram
   * number — `WEIGHT_CLASSES_KG`, `formatBodyweight`, and the DOTS column, whose
   * published polynomial is fitted on kilogram bodyweights — so a pound meet is
   * refused here rather than printed with kg semantics on lb weights. Convert the
   * whole entry (total AND bodyweight) at the call site with
   * `kilogramsFromPounds` and card the converted meet.
   */
  | 'UNSUPPORTED_MEET_UNIT'
  | 'INVALID_PLACING'
  | 'INVALID_LIFTER';

export interface ResultCardError {
  readonly code: ResultCardErrorCode;
  readonly message: string;
}

export type ResultCardResult =
  | { readonly ok: true; readonly card: ResultCard }
  | { readonly ok: false; readonly error: ResultCardError };

// ---------------------------------------------------------------------------
// Building the card
// ---------------------------------------------------------------------------

function judgedAttemptAt(progress: LiftProgress, attemptNumber: AttemptNumber): CompletedAttempt | undefined {
  return progress.attempts.find((attempt) => attempt.attemptNumber === attemptNumber);
}

function isJudged(attempt: CompletedAttempt): attempt is JudgedAttempt {
  return attempt.status === 'good' || attempt.status === 'no-lift';
}

function buildAttemptCell(progress: LiftProgress, attemptNumber: AttemptNumber): AttemptCell {
  const attempt = judgedAttemptAt(progress, attemptNumber);
  if (attempt === undefined) {
    return {
      attemptNumber,
      mark: 'not-taken',
      text: '',
      weightKg: null,
      signedWeightKg: 0,
      struckThrough: false,
      whiteLights: null,
    };
  }
  if (!isJudged(attempt)) {
    // Passed: forfeited without taking the bar, so there is no weight at all.
    // [R3] records a lift not taken as zero, and that is what a pass is.
    return {
      attemptNumber,
      mark: 'passed',
      text: '',
      weightKg: null,
      signedWeightKg: 0,
      struckThrough: false,
      whiteLights: null,
    };
  }
  const good = attempt.status === 'good';
  return {
    attemptNumber,
    mark: good ? 'good' : 'no-lift',
    text: formatWeight(attempt.weight),
    weightKg: attempt.weight,
    // [R3]/[R4]: made positive, missed negative.
    signedWeightKg: good ? attempt.weight : -attempt.weight,
    struckThrough: !good && NO_LIFT_STRIKES_THROUGH,
    whiteLights: attempt.whiteLights,
  };
}

function buildLiftRow(state: MeetState, lift: LiftKind): LiftRow {
  const progress = state.lifts[lift];
  const cells = ATTEMPT_NUMBERS.map((attemptNumber) => buildAttemptCell(progress, attemptNumber));
  const [first, second, third] = cells;
  if (first === undefined || second === undefined || third === undefined) {
    // Unreachable: ATTEMPT_NUMBERS has exactly three entries. Present so the
    // tuple type is honest rather than asserted.
    throw new Error('resultCard: a lift must have exactly three attempt cells');
  }
  const best = progress.best;
  return {
    lift,
    label: LIFT_ROW_LABELS[lift],
    status: progress.status,
    attempts: [first, second, third],
    bestKg: best,
    // A bombed lift prints no best. [R1]/[R2]: blank, never zero.
    bestText: best === null ? NO_VALUE_DISPLAY : formatWeight(best),
    bombed: progress.status === 'bombed',
  };
}

function liftTuple(state: MeetState): readonly [LiftRow, LiftRow, LiftRow] {
  const rows = LIFT_ORDER.map((lift) => buildLiftRow(state, lift));
  const [squatRow, benchRow, deadliftRow] = rows;
  if (squatRow === undefined || benchRow === undefined || deadliftRow === undefined) {
    throw new Error('resultCard: a meet must have exactly three lifts');
  }
  return [squatRow, benchRow, deadliftRow];
}

function flightPlaceText(totalKg: number | null, placing: number | null): {
  readonly place: number | null;
  readonly placeText: string;
} {
  if (totalKg === null) {
    return { place: null, placeText: PLACE_NO_TOTAL_DISPLAY };
  }
  if (placing === null) {
    return { place: null, placeText: NO_VALUE_DISPLAY };
  }
  return { place: placing, placeText: String(placing) };
}

function buildFlightRow(entry: ResultCardFlightEntry): ResultCardFlightRow {
  const reading = readTotal(entry.state);
  const rows = liftTuple(entry.state);
  if (reading.kind === 'in-progress' || reading.unit !== DOTS_TOTAL_UNIT) {
    return {
      id: entry.id,
      isPlayer: entry.isPlayer,
      place: null,
      placeText: NO_VALUE_DISPLAY,
      name: entry.name.trim(),
      bodyweightText: formatBodyweight(entry.bodyweightKg),
      rows,
      totalKg: null,
      totalText: NO_VALUE_DISPLAY,
      dotsText: DOTS_NO_TOTAL_DISPLAY,
      bombed: false,
    };
  }
  const dots = evaluateMeetDots(entry.sex, entry.bodyweightKg, reading);
  const totalKg = reading.kind === 'final' ? reading.total : null;
  const placed = flightPlaceText(totalKg, entry.placing);
  return {
    id: entry.id,
    isPlayer: entry.isPlayer,
    place: placed.place,
    placeText: placed.placeText,
    name: entry.name.trim(),
    bodyweightText: formatBodyweight(entry.bodyweightKg),
    rows,
    totalKg,
    totalText: totalKg === null ? NO_VALUE_DISPLAY : formatWeight(totalKg),
    dotsText: formatDotsOutcome(dots),
    bombed: reading.kind === 'no-total',
  };
}

function compareFlightName(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function sortFlightRows(rows: readonly ResultCardFlightRow[]): readonly ResultCardFlightRow[] {
  return [...rows].sort((a, b) => {
    if (a.place === null && b.place === null) return compareFlightName(a.name, b.name);
    if (a.place === null) return 1;
    if (b.place === null) return -1;
    if (a.place !== b.place) return a.place - b.place;
    return compareFlightName(a.name, b.name);
  });
}

function sexText(sex: DotsSex): string {
  // [R6]'s language pack renders sex as the single letters M / F.
  return sex === 'male' ? 'M' : 'F';
}

/**
 * Turn a finished meet into a result card.
 *
 * Reads the total through `readTotal(state)` and hands the READING — not a
 * number — to `dots.ts`, so a bombed lifter cannot be scored even by accident:
 * `evaluateMeetDots` has no way to see `totalOnTheBoard`, and its `'no-total'`
 * outcome carries no `score` field to default.
 */
export function buildResultCard(input: ResultCardInput): ResultCardResult {
  const { meet, lifter, state, placing, field: fieldInput } = input;

  if (lifter.name.trim() === '') {
    return { ok: false, error: { code: 'INVALID_LIFTER', message: 'A result card needs the lifter’s name.' } };
  }
  if (!Number.isFinite(lifter.bodyweightKg) || lifter.bodyweightKg <= 0) {
    return {
      ok: false,
      error: { code: 'INVALID_LIFTER', message: 'A result card needs a positive bodyweight.' },
    };
  }

  const reading = readTotal(state);
  // Checked before anything is read off the reading. `evaluateMeetDots` would
  // throw on a non-kg meet, and a `Result`-returning builder must not throw:
  // this turns that refusal into the module's own error shape. It also covers
  // the columns DOTS has nothing to do with — a lb bodyweight would otherwise be
  // sorted into a kg weight class.
  if (reading.unit !== DOTS_TOTAL_UNIT) {
    return {
      ok: false,
      error: {
        code: 'UNSUPPORTED_MEET_UNIT',
        message:
          `This meet was run in ${reading.unit}, and a result sheet here is a kilogram sheet — ` +
          'weight class, bodyweight and DOTS all read the numbers as kg. Convert the entry ' +
          '(total and bodyweight both) with kilogramsFromPounds and card the converted meet.',
      },
    };
  }
  if (reading.kind === 'in-progress') {
    return {
      ok: false,
      error: {
        code: 'MEET_IN_PROGRESS',
        message: 'The meet is still running; there is no result to put on a card yet.',
      },
    };
  }

  if (placing !== undefined) {
    if (!Number.isInteger(placing) || placing < 1) {
      return {
        ok: false,
        error: { code: 'INVALID_PLACING', message: `A placing must be a whole number of 1 or more, not ${placing}.` },
      };
    }
    if (reading.kind !== 'final') {
      return {
        ok: false,
        error: {
          code: 'PLACING_WITHOUT_TOTAL',
          message:
            'A lifter who did not total does not place. Leave the placing off; the card prints ' +
            `"${PLACE_NO_TOTAL_DISPLAY}".`,
        },
      };
    }
  }

  const dots = evaluateMeetDots(lifter.sex, lifter.bodyweightKg, reading);
  const [squatRow, benchRow, deadliftRow] = liftTuple(state);

  const totalKg = reading.kind === 'final' ? reading.total : null;
  const totalText = totalKg === null ? NO_VALUE_DISPLAY : formatWeight(totalKg);
  const dotsText = formatDotsOutcome(dots);
  const placed = totalKg !== null && placing !== undefined;
  const placeText =
    totalKg === null ? PLACE_NO_TOTAL_DISPLAY : placing === undefined ? NO_VALUE_DISPLAY : String(placing);

  const classes = lifter.weightClassesKg ?? WEIGHT_CLASSES_KG[lifter.sex];

  const category: LifterCategory = {
    sex: lifter.sex,
    division: lifter.division,
    equipment: lifter.equipment,
    weightClassText: lifter.weightClassKg ?? weightClassString(lifter.bodyweightKg, classes),
  };

  const playerId =
    (fieldInput ?? []).find((entry) => entry.isPlayer)?.id ?? 'player';
  const playerFlight: ResultCardFlightRow = {
    id: playerId,
    isPlayer: true,
    place: placed && placing !== undefined ? placing : null,
    placeText,
    name: lifter.name.trim(),
    bodyweightText: formatBodyweight(lifter.bodyweightKg),
    rows: [squatRow, benchRow, deadliftRow],
    totalKg,
    totalText,
    dotsText,
    bombed: reading.kind === 'no-total',
  };
  const field = sortFlightRows([
    playerFlight,
    ...(fieldInput ?? [])
      .filter((entry) => !entry.isPlayer)
      .map((entry) => buildFlightRow(entry)),
  ]);

  const card: ResultCard = {
    meet: {
      federation: meet.federation.toUpperCase(),
      name: meet.name,
      dateText: formatMeetDate(meet.dateIso),
      locationText: formatMeetLocation(meet),
      locationShortText: formatMeetLocation({ town: meet.town }),
    },
    lifter: {
      ...category,
      name: lifter.name.trim(),
      sexText: sexText(lifter.sex),
      categoryText: lifterCategoryText(category),
      bodyweightText: formatBodyweight(lifter.bodyweightKg),
    },
    rows: [squatRow, benchRow, deadliftRow],
    field,
    summary: [
      { id: 'total', label: 'TOTAL', value: totalText, hasValue: totalKg !== null },
      { id: 'dots', label: 'DOTS', value: dotsText, hasValue: hasDotsScore(dots) },
      { id: 'place', label: 'PLACE', value: placeText, hasValue: placed },
    ],
    totalKg,
    placed,
    bombedLift: reading.kind === 'no-total' ? reading.bombedLift : null,
    dots,
  };

  return { ok: true, card };
}

// ---------------------------------------------------------------------------
// Reading a built card
// ---------------------------------------------------------------------------

/**
 * The card's cells in `RESULT_SHEET_COLUMNS`' order — [R8]'s, the rendered one
 * — as `(column, text)` pairs. This is the one-line form a results table
 * actually prints, and the check that our transposed grid holds the same
 * information as the published format.
 */
export function resultSheetLine(card: ResultCard): readonly { readonly column: ResultSheetColumn; readonly text: string }[] {
  const byLift: Readonly<Record<LiftKind, LiftRow>> = {
    squat: card.rows[0],
    bench: card.rows[1],
    deadlift: card.rows[2],
  };
  const attemptText = (lift: LiftKind, index: 0 | 1 | 2): string => byLift[lift].attempts[index].text;
  const value = (id: ResultSheetColumnId): string => {
    switch (id) {
      case 'place':
        return card.summary[2].value;
      case 'lifter':
        return card.lifter.name;
      case 'sex':
        return card.lifter.sexText;
      case 'division':
        return card.lifter.division;
      case 'equipment':
        return card.lifter.equipment;
      case 'weightClass':
        return card.lifter.weightClassText;
      case 'bodyweight':
        return card.lifter.bodyweightText;
      case 'squat1':
        return attemptText('squat', 0);
      case 'squat2':
        return attemptText('squat', 1);
      case 'squat3':
        return attemptText('squat', 2);
      case 'bestSquat':
        return byLift.squat.bestText;
      case 'bench1':
        return attemptText('bench', 0);
      case 'bench2':
        return attemptText('bench', 1);
      case 'bench3':
        return attemptText('bench', 2);
      case 'bestBench':
        return byLift.bench.bestText;
      case 'deadlift1':
        return attemptText('deadlift', 0);
      case 'deadlift2':
        return attemptText('deadlift', 1);
      case 'deadlift3':
        return attemptText('deadlift', 2);
      case 'bestDeadlift':
        return byLift.deadlift.bestText;
      case 'total':
        return card.summary[0].value;
      case 'dots':
        return card.summary[1].value;
    }
  };
  return RESULT_SHEET_COLUMNS.map((column) => ({ column, text: value(column.id) }));
}

/**
 * The card as one row of [R2]'s `entries.csv`, in the convention published
 * results are recorded in: made attempts positive, missed attempts NEGATIVE,
 * attempts not taken and bombed lifts BLANK, no total BLANK, place "DQ".
 *
 * Not a file writer and not an export feature — it is the machine-checkable
 * statement that this card carries the same facts a federation's sheet does,
 * and `resultCard.test.ts` diffs it against rows lifted verbatim from [R2].
 */
export function resultCardEntriesCsvRow(card: ResultCard): readonly string[] {
  const blankIfZero = (cell: AttemptCell): string =>
    cell.signedWeightKg === 0 ? '' : formatWeight(cell.signedWeightKg);
  const best = (row: LiftRow): string => (row.bestKg === null ? '' : formatWeight(row.bestKg));
  const lifts = card.rows.flatMap((row) => [...row.attempts.map(blankIfZero), best(row)]);
  return [
    card.lifter.name,
    card.lifter.sexText,
    card.lifter.division,
    card.lifter.weightClassText,
    card.lifter.bodyweightText,
    ...lifts,
    card.totalKg === null ? '' : formatWeight(card.totalKg),
    card.summary[2].value,
    card.lifter.equipment,
  ];
}

/**
 * Header for `resultCardEntriesCsvRow`, in [R2]'s names and order — the file
 * format, not the page. It is [R2]'s 24-field header with the four fields this
 * card does not carry removed (Country, BirthYear, Event, BirthDate); the
 * remaining twenty keep [R2]'s spelling and [R2]'s relative order, which is why
 * Place sits near the end here and first in `RESULT_SHEET_COLUMNS`.
 */
export const RESULT_CARD_CSV_HEADER: readonly string[] = [
  'Name',
  'Sex',
  'Division',
  'WeightClassKg',
  'BodyweightKg',
  'Squat1Kg',
  'Squat2Kg',
  'Squat3Kg',
  'Best3SquatKg',
  'Bench1Kg',
  'Bench2Kg',
  'Bench3Kg',
  'Best3BenchKg',
  'Deadlift1Kg',
  'Deadlift2Kg',
  'Deadlift3Kg',
  'Best3DeadliftKg',
  'TotalKg',
  'Place',
  'Equipment',
] as const;

/** Every distinct string the card will ask a renderer to draw. */
export function resultCardStrings(card: ResultCard): readonly string[] {
  const out: string[] = [
    card.meet.federation,
    card.meet.name,
    card.meet.dateText,
    card.meet.locationText,
    card.lifter.name,
    card.lifter.sexText,
    card.lifter.categoryText,
    card.lifter.division,
    card.lifter.equipment,
    card.lifter.weightClassText,
    card.lifter.bodyweightText,
    ATTEMPT_GRID_HEADINGS.lift,
    ATTEMPT_GRID_HEADINGS.best,
    ...ATTEMPT_GRID_HEADINGS.attempts,
  ];
  for (const row of card.rows) {
    out.push(row.label, row.bestText);
    for (const cell of row.attempts) out.push(cell.text);
  }
  for (const summaryRow of card.summary) out.push(summaryRow.label, summaryRow.value);
  for (const row of card.field) {
    out.push(row.placeText, row.name, row.bodyweightText, row.totalText, row.dotsText);
    for (const lift of row.rows) {
      out.push(lift.label, lift.bestText);
      for (const cell of lift.attempts) out.push(cell.text);
    }
  }
  return out.filter((text) => text !== '');
}
