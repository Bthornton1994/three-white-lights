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
 * sandbox. Every fetch listed here returned HTTP 200 on 2026-08-01.
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
 *        That is the COLUMN ORDER in `RESULT_SHEET_COLUMNS`: identity, then
 *        bodyweight, then three attempts and a best for each lift in
 *        squat -> bench -> deadlift order, then total, then place.
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
// The order is [R2]'s, which is the order every federation's published results
// are transcribed into. A renderer walks this list; it does not hard-code a
// sequence of its own.
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
 * The full row of a published results sheet, in [R2]'s order. `Dots` is
 * appended because GDD §6.4 scores by DOTS; [R6] names that column "Dots".
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
 * The attempt grid's own headings, for a card that stacks the three lifts as
 * rows instead of running [R2]'s one long line. Same information, transposed —
 * the per-attempt columns are [R6]/OpenLifter's "1/2/3" and the best column is
 * the lift's name.
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
  if (Math.abs(hundredths) % 10 === 9) {
    hundredths += hundredths < 0 ? -1 : 1;
  }
  const value = hundredths / 100;
  // toFixed then trim: `String(0.1 + 0.2)` would leak binary noise, `toFixed(2)`
  // cannot, and the trim restores "192.5" from "192.50" and "200" from "200.00".
  const fixed = value.toFixed(2);
  return fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
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
  readonly locationText: string;
}

export interface ResultCardLifterHeader {
  readonly name: string;
  readonly sex: DotsSex;
  readonly sexText: string;
  readonly division: string;
  readonly equipment: string;
  readonly weightClassText: string;
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
  const { meet, lifter, state, placing } = input;

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
  const rows = LIFT_ORDER.map((lift) => buildLiftRow(state, lift));
  const [squatRow, benchRow, deadliftRow] = rows;
  if (squatRow === undefined || benchRow === undefined || deadliftRow === undefined) {
    throw new Error('resultCard: a meet must have exactly three lifts');
  }

  const totalKg = reading.kind === 'final' ? reading.total : null;
  const totalText = totalKg === null ? NO_VALUE_DISPLAY : formatWeight(totalKg);
  const dotsText = formatDotsOutcome(dots);
  const placed = totalKg !== null && placing !== undefined;
  const placeText =
    totalKg === null ? PLACE_NO_TOTAL_DISPLAY : placing === undefined ? NO_VALUE_DISPLAY : String(placing);

  const classes = lifter.weightClassesKg ?? WEIGHT_CLASSES_KG[lifter.sex];

  const card: ResultCard = {
    meet: {
      federation: meet.federation.toUpperCase(),
      name: meet.name,
      dateText: formatMeetDate(meet.dateIso),
      locationText: formatMeetLocation(meet),
    },
    lifter: {
      name: lifter.name.trim(),
      sex: lifter.sex,
      sexText: sexText(lifter.sex),
      division: lifter.division,
      equipment: lifter.equipment,
      weightClassText: lifter.weightClassKg ?? weightClassString(lifter.bodyweightKg, classes),
      bodyweightText: formatBodyweight(lifter.bodyweightKg),
    },
    rows: [squatRow, benchRow, deadliftRow],
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
 * The card's cells in [R2]'s column order, as `(column, text)` pairs. This is
 * the one-line form a results sheet actually prints, and the check that our
 * transposed grid holds the same information as the published format.
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

/** Header for `resultCardEntriesCsvRow`, in [R2]'s names and order. */
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
  return out.filter((text) => text !== '');
}
