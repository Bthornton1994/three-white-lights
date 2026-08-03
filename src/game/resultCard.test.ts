import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  ATTEMPT_GRID_HEADINGS,
  MONTH_ABBREVIATIONS,
  NO_VALUE_DISPLAY,
  PLACE_NO_TOTAL_DISPLAY,
  RESULT_CARD_CSV_HEADER,
  RESULT_SHEET_COLUMNS,
  SEX_CATEGORY_WORD,
  WEIGHT_CLASSES_KG,
  buildResultCard,
  formatBodyweight,
  formatMeetDate,
  formatMeetLocation,
  formatWeight,
  lifterCategoryText,
  resultCardEntriesCsvRow,
  resultCardStrings,
  resultSheetLine,
  weightClassString,
  type ResultCard,
  type ResultCardInput,
} from './resultCard';
import {
  DEFAULT_MEET_RULES,
  createMeet,
  declareAttempt,
  finalMeetTotal,
  passAttempt,
  resolveAttempt,
  totalOnTheBoard,
  type JudgePanel,
  type MeetLoadingRules,
  type MeetState,
} from './meet';
import { DOTS_NO_TOTAL_DISPLAY, dotsScore, formatDotsScore, officialTotalKg } from './dots';

// ---------------------------------------------------------------------------
// Meet-driving helpers. Every card in this file is built from a meet the real
// engine actually ran — never from a hand-written state object — so a rule the
// engine enforces (non-decreasing attempts, three per lift, squat -> bench ->
// deadlift) is enforced for these fixtures too.
// ---------------------------------------------------------------------------

const GOOD: JudgePanel = ['white', 'white', 'white'];
const SPLIT_GOOD: JudgePanel = ['white', 'red', 'white'];
const NO_LIFT: JudgePanel = ['red', 'red', 'red'];

/**
 * The IPF runs record attempts on a finer grid than 2.5 kg, and the real rows
 * this suite reproduces contain calls like 166 and 104.69 kg. `meet.ts`
 * documents exactly this configuration as the reason `INSUFFICIENT_INCREASE`
 * exists: declare on 0.5, but the bar must still move 2.5 between attempts.
 */
const FINE_GRID_RULES: MeetLoadingRules = {
  ...DEFAULT_MEET_RULES,
  declarationIncrement: 0.5,
};

function take(state: MeetState, weight: number, lights: JudgePanel): MeetState {
  const declared = declareAttempt(state, { weight });
  if (!declared.ok) throw new Error(`declare ${weight} failed: ${declared.error.code} ${declared.error.message}`);
  const judged = resolveAttempt(declared.value, { lights });
  if (!judged.ok) throw new Error(`resolve ${weight} failed: ${judged.error.code}`);
  return judged.value;
}

/** Runs a whole meet from a list of `[weight, lights]` pairs, in order. */
function runMeet(attempts: readonly (readonly [number, JudgePanel])[], rules = FINE_GRID_RULES): MeetState {
  return attempts.reduce<MeetState>((state, [weight, lights]) => take(state, weight, lights), createMeet(rules));
}

const MEET: ResultCardInput['meet'] = {
  federation: 'Iron Union',
  name: 'Winter Open',
  dateIso: '2026-02-14',
  town: 'Sheffield',
  country: 'England',
};

function cardOf(input: ResultCardInput): ResultCard {
  const result = buildResultCard(input);
  if (!result.ok) throw new Error(`buildResultCard failed: ${result.error.code} ${result.error.message}`);
  return result.card;
}

// ---------------------------------------------------------------------------
// Purity contract
//
// `meet.test.ts` and `streak.test.ts` both scan their module's source for the
// things CLAUDE.md forbids a game-math module to reach for; this file had no
// such block, so nothing stopped `resultCard.ts` growing a React import, a
// clock read or a locale-sensitive number format.
// ---------------------------------------------------------------------------

describe('purity contract', () => {
  const source = readFileSync(fileURLToPath(new URL('./resultCard.ts', import.meta.url)), 'utf8');
  // Comments are stripped so the header's own prose — which quotes CSV rows,
  // names `Date`, and discusses `Intl` at length — does not trip the scans.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('strips comments without destroying the code (sanity check for the scans below)', () => {
    expect(code).toContain('export function buildResultCard');
    expect(code).toContain('export function lifterCategoryText');
    // A line that only exists in a comment.
    expect(code).not.toContain('Skeeter Valentine');
  });

  it('imports only its two pure siblings, and nothing else', () => {
    const specifiers = [...code.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1]);
    expect([...new Set(specifiers)].sort()).toEqual(['./dots', './meet']);
    expect(code).not.toMatch(/\brequire\s*\(/);
    expect(code).not.toMatch(/\breact\b/i);
  });

  it('never reads a clock', () => {
    // `formatMeetDate` parses ISO-8601 with a regex precisely so a `Date` can
    // never drag the host timezone in and shift the day on the card.
    expect(code).not.toMatch(/\bDate\b/);
    expect(code).not.toMatch(/\bperformance\s*\./);
  });

  it('never uses randomness', () => {
    expect(code).not.toMatch(/Math\s*\.\s*random/);
    expect(code).not.toMatch(/\bcrypto\b/);
  });

  it('has no ambient side-effect surface', () => {
    expect(code).not.toMatch(/\bprocess\s*\./);
    expect(code).not.toMatch(/\bglobalThis\b/);
    expect(code).not.toMatch(/console\s*\./);
    expect(code).not.toMatch(/\bfetch\s*\(/);
  });

  it('formats no number through a locale', () => {
    // A card built on a device and a card built on a server have to be
    // byte-identical, and locale-sensitive formatting is how that stops being
    // true — a German locale would print "434,5".
    expect(code).not.toMatch(/\bIntl\b/);
    expect(code).not.toMatch(/toLocale/);
  });

  it('never launders a missing total into a number', () => {
    // The refusal the module exists around. `?? 0` on a total, or a reach for
    // the provisional running sum, is the bug that would put a plausible
    // number on a bombed lifter's card.
    expect(code).not.toMatch(/totalOnTheBoard/);
    expect(code).not.toMatch(/\?\?\s*0\b/);
  });

  it('reaches for no rep-max formula at all — that is e1rm.ts’s business', () => {
    // CLAUDE.md: Epley is the one rep-max formula the codebase may reach for,
    // and Brzycki must not appear under any name. A result card computes
    // neither; it sums three bests.
    expect(code).not.toMatch(/brzycki/i);
    expect(code).not.toMatch(/epley/i);
  });
});

// ---------------------------------------------------------------------------
// The sourcing ledger
//
// THIS BLOCK EXISTS BECAUSE THE LEDGER LIED. `resultCard.ts`'s header is the
// entire basis on which anyone believes this card's conventions were retrieved
// rather than invented — and it was the one thing in the file with no
// mechanised check behind it. Every other claim it makes is scanned above:
// `Intl`, `Date`, `Math.random`, `totalOnTheBoard`, `?? 0`, `epley`, `brzycki`.
// The sourcing block was prose, and the prose was wrong: it said
// `RESULT_SHEET_COLUMNS` ran "...then total, then place" and cited [R2]'s CSV
// for it, while the constant twenty lines of code later starts with `place` and
// the CSV puts Place 21st. The code was right and the citation was wrong, which
// is the failure mode a comment cannot be trusted to catch by itself.
//
// So the ledger's load-bearing claims are now READ OUT OF THE COMMENT and
// checked against the constants they describe. A drift in either direction —
// edit the array, or edit the sentence — fails here.
// ---------------------------------------------------------------------------

describe('the sourcing ledger describes the constants it cites', () => {
  const source = readFileSync(fileURLToPath(new URL('./resultCard.ts', import.meta.url)), 'utf8');

  /**
   * The `[R8] ...` entry of the header comment, up to the next one.
   *
   * Anchored on an entry HEAD — ` *   [R8] ` at three spaces of indent — not on
   * the first `[R8]` anywhere in the file, because the block's own preamble
   * names the references in prose and would otherwise be returned instead.
   */
  function ledgerEntry(tag: string): string {
    const head = new RegExp(`^ \\* {3}\\[${tag}\\] `, 'm').exec(source);
    if (head?.index === undefined) throw new Error(`ledger: no [${tag}] entry in resultCard.ts`);
    const rest = source.slice(head.index + head[0].length);
    const end = rest.search(/\n \* {3}\[R\d+\] |\n \* OURS, NOT CITED/);
    return end === -1 ? rest : rest.slice(0, end);
  }

  /**
   * A `LABEL: a | b | c` list written into the comment, continued across as
   * many lines as it needs. Throws when the label is absent, so a check built
   * on one cannot quietly pass against an empty list.
   */
  function ledgerPipeList(text: string, label: string): readonly string[] {
    const at = text.indexOf(label);
    if (at === -1) throw new Error(`ledger: no "${label}" list`);
    const lines = text.slice(at + label.length).split('\n');
    const collected: string[] = [];
    for (const line of lines) {
      const stripped = line.replace(/^\s*\*?\s*/, '');
      if (!stripped.includes('|')) break;
      collected.push(stripped);
    }
    return collected
      .join(' ')
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell) => cell !== '');
  }

  /**
   * A `... at index N` claim, read out of the comment rather than retyped.
   * The comment's line breaks and ` * ` gutters are flattened first, so a claim
   * that happens to wrap is still found.
   */
  function ledgerIndex(text: string, phrase: string): number {
    const flat = text.replace(/\n\s*\*\s*/g, ' ');
    const match = new RegExp(`${phrase} at index (\\d+)`).exec(flat);
    if (match?.[1] === undefined) throw new Error(`ledger: no "${phrase} at index N" claim`);
    return Number(match[1]);
  }

  it('parses the ledger at all (sanity check for every assertion below)', () => {
    // Without this, a parser that silently returned nothing would make the
    // whole block vacuous — which is exactly the failure it was written to fix.
    expect(ledgerEntry('R8')).toContain('meet.html.tera');
    expect(ledgerEntry('R9')).toContain('lifter.html.tera');
    expect(ledgerEntry('R2')).toContain('entries.csv');
    expect(ledgerPipeList(ledgerEntry('R8'), 'MEET PAGE COLUMNS:')).toHaveLength(12);
    expect(() => ledgerPipeList(ledgerEntry('R8'), 'NO SUCH LIST:')).toThrow();
    expect(() => ledgerIndex(ledgerEntry('R8'), 'nothing')).toThrow();
    // The entries really are separate: R8's text must not swallow R9's.
    expect(ledgerEntry('R8')).not.toContain('lifter.html.tera');
  });

  it('hangs the RESULT_SHEET_COLUMNS citation on the rendered page, not the CSV', () => {
    // The defect in one assertion. [R2] is entries.csv, a transcription format;
    // [R8] is the page it is rendered on. The constant follows the page.
    expect(ledgerEntry('R8')).toContain('the source for the order of');
    expect(ledgerEntry('R8')).toContain('`RESULT_SHEET_COLUMNS`');
    // [R2] may point AT the constant, but must not claim to be its order. The
    // exact sentence that used to be there is pinned so it cannot come back.
    expect(ledgerEntry('R2')).toContain(
      'THAT IS THE ORDER OF `RESULT_CARD_CSV_HEADER`, AND OF NOTHING ELSE IN',
    );
    expect(ledgerEntry('R2')).not.toContain('COLUMN ORDER in `RESULT_SHEET_COLUMNS`');
    expect(ledgerEntry('R2')).not.toContain('then total, then place');
    // ...and the CSV citation stays where it does apply.
    expect(ledgerEntry('R2')).toContain('`RESULT_CARD_CSV_HEADER`');
  });

  it('states the indices the constant actually uses', () => {
    // Read out of the comment, checked against the array. Change either one on
    // its own and this fails; the old ledger's "then total, then place" would
    // have failed it on the first line.
    const r8 = ledgerEntry('R8');
    expect(RESULT_SHEET_COLUMNS[ledgerIndex(r8, 'place is')]?.id).toBe('place');
    expect(RESULT_SHEET_COLUMNS[ledgerIndex(r8, 'division')]?.id).toBe('division');
    expect(RESULT_SHEET_COLUMNS[ledgerIndex(r8, 'equipment')]?.id).toBe('equipment');
    // The specific thing the old text got backwards.
    expect(ledgerIndex(r8, 'place is')).toBe(0);
    expect(RESULT_SHEET_COLUMNS[RESULT_SHEET_COLUMNS.length - 1]?.id).not.toBe('place');
  });

  it('collapses back into the meet page’s row, with exactly the departures it lists', () => {
    // The strong form. Undo the two expansions the ledger discloses — the
    // per-lift attempt columns from [R9], and the added Division — rename the
    // points column back, and what is left must be [R8]'s header verbatim,
    // minus the Age it also discloses as dropped.
    const meetPage = ledgerPipeList(ledgerEntry('R8'), 'MEET PAGE COLUMNS:');
    expect(meetPage[0], 'the template puts Place first').toBe('Place');

    const collapsed = RESULT_SHEET_COLUMNS.filter(
      (column) => !/^(squat|bench|deadlift)[123]$/.test(column.id),
    ).map((column) => column.heading);

    // Guard every filter below, so none of them can be quietly doing nothing.
    expect(collapsed, 'Division is ours to drop here').toContain('Division');
    expect(meetPage, 'Age is the template’s to drop here').toContain('Age');
    expect(meetPage, 'Points is the heading we rename').toContain('Points');
    expect(collapsed).toContain('Dots');

    expect(collapsed.filter((heading) => heading !== 'Division')).toEqual(
      meetPage.filter((heading) => heading !== 'Age').map((heading) => (heading === 'Points' ? 'Dots' : heading)),
    );
    // The collapse threw away nine attempt columns and nothing else.
    expect(RESULT_SHEET_COLUMNS).toHaveLength(collapsed.length + 9);
  });

  it('carries no age column, as it says', () => {
    expect(ledgerEntry('R8')).toContain('`Age` is DROPPED');
    const ids = RESULT_SHEET_COLUMNS.map((column) => column.id.toLowerCase());
    const headings = RESULT_SHEET_COLUMNS.map((column) => column.heading.toLowerCase());
    expect([...ids, ...headings].filter((name) => name.includes('age'))).toEqual([]);
  });

  it('reproduces the CSV header as the subsequence of [R2] it claims to be', () => {
    // Transcribed by hand from the first line of
    // https://gitlab.com/openpowerlifting/opl-data/-/raw/main/meet-data/ipf/2503/entries.csv
    // so this is a check against the source and not against the module.
    const IPF_2503_HEADER = [
      'Name', 'Country', 'Sex', 'BirthYear', 'Division', 'WeightClassKg', 'BodyweightKg',
      'Squat1Kg', 'Squat2Kg', 'Squat3Kg', 'Best3SquatKg',
      'Bench1Kg', 'Bench2Kg', 'Bench3Kg', 'Best3BenchKg',
      'Deadlift1Kg', 'Deadlift2Kg', 'Deadlift3Kg', 'Best3DeadliftKg',
      'TotalKg', 'Place', 'Event', 'Equipment', 'BirthDate',
    ];
    // The ledger quotes it; the quote and the transcription must agree.
    expect(ledgerEntry('R2')).toContain('Name,Country,Sex,BirthYear,Division,WeightClassKg,BodyweightKg');
    expect(ledgerEntry('R2')).toContain('TotalKg,Place,Event,Equipment,BirthDate');

    const dropped = IPF_2503_HEADER.filter((field) => !RESULT_CARD_CSV_HEADER.includes(field));
    expect(dropped).toEqual(['Country', 'BirthYear', 'Event', 'BirthDate']);
    expect(RESULT_CARD_CSV_HEADER).toEqual(IPF_2503_HEADER.filter((field) => !dropped.includes(field)));
    expect(ledgerEntry('R2')).toContain('Country, BirthYear, Event, BirthDate');

    // And the two orderings really are different, which is the whole reason
    // they are cited to two different sources.
    expect(IPF_2503_HEADER.indexOf('Place')).toBe(20);
    expect(IPF_2503_HEADER.indexOf('Equipment')).toBe(22);
    expect(RESULT_SHEET_COLUMNS.map((column) => column.id).indexOf('place')).toBe(0);
  });

  it('cites the lifter page for the attempt columns, and admits what differs', () => {
    // [R9]'s colspan-4 group is attempts 1-3 plus a FOURTH ATTEMPT, not a best.
    // The grouping is cited; the best column is not, and the ledger says so.
    const r9 = ledgerEntry('R9');
    expect(r9).toContain('colspan="4"');
    expect(r9).toContain('FOURTH ATTEMPT');
    expect(ATTEMPT_GRID_HEADINGS.attempts).toHaveLength(3);
    expect(ATTEMPT_GRID_HEADINGS.best).toBe('BEST');
    // Four cells under one lift name, exactly as the template groups them.
    expect(ATTEMPT_GRID_HEADINGS.attempts.length + 1).toBe(4);
    for (const lift of ['squat', 'bench', 'deadlift'] as const) {
      const columns = RESULT_SHEET_COLUMNS.filter((column) => column.id.toLowerCase().startsWith(lift));
      const best = RESULT_SHEET_COLUMNS.filter(
        (column) => column.id.toLowerCase() === `best${lift}`,
      );
      expect(columns.length + best.length, lift).toBe(4);
    }
  });
});

// ---------------------------------------------------------------------------
// Real published results, reproduced.
//
// These two rows are lifted verbatim from
//   https://gitlab.com/openpowerlifting/opl-data/-/raw/main/meet-data/ipf/2503/entries.csv
// (IPF World Classic Powerlifting Championships, Chemnitz, 2025-06-08). They are
// the strongest check available on this module: if our card's conventions differ
// from a published federation sheet's in ANY cell — a sign, a rounding, a blank,
// a "DQ" — the diff shows it.
// ---------------------------------------------------------------------------

/** `Tiffany Chapon,France,F,2001,Open,47,46.7,155,162.5,-166,162.5,97.5,102,-105,102,162.5,170,-172.5,170,434.5,2,SBD,Raw,` */
const CHAPON_STATE = runMeet([
  [155, GOOD],
  [162.5, GOOD],
  [166, NO_LIFT],
  [97.5, GOOD],
  [102, GOOD],
  [105, NO_LIFT],
  [162.5, GOOD],
  [170, GOOD],
  [172.5, NO_LIFT],
]);

const CHAPON_INPUT: ResultCardInput = {
  meet: MEET,
  lifter: {
    name: 'Tiffany Chapon',
    sex: 'female',
    bodyweightKg: 46.7,
    division: 'Open',
    equipment: 'Raw',
  },
  state: CHAPON_STATE,
  placing: 2,
};

/** `Corentin Clément,France,M,2000,Open,105,104.69,-300,-320,-335,,,,,,,,,,,DQ,SBD,Raw,` */
const CLEMENT_STATE = runMeet([
  [300, NO_LIFT],
  [320, NO_LIFT],
  [335, NO_LIFT],
]);

const CLEMENT_INPUT: ResultCardInput = {
  meet: MEET,
  lifter: {
    name: 'Corentin Clément',
    sex: 'male',
    bodyweightKg: 104.69,
    division: 'Open',
    equipment: 'Raw',
  },
  state: CLEMENT_STATE,
};

describe('a real published results row, reproduced cell for cell', () => {
  it('matches the IPF Worlds row for a lifter who totalled', () => {
    const card = cardOf(CHAPON_INPUT);
    expect(resultCardEntriesCsvRow(card)).toEqual([
      'Tiffany Chapon',
      'F',
      'Open',
      '47',
      '46.70',
      '155',
      '162.5',
      '-166',
      '162.5',
      '97.5',
      '102',
      '-105',
      '102',
      '162.5',
      '170',
      '-172.5',
      '170',
      '434.5',
      '2',
      'Raw',
    ]);
  });

  it('matches the IPF Worlds row for a lifter who bombed out', () => {
    const card = cardOf(CLEMENT_INPUT);
    expect(resultCardEntriesCsvRow(card)).toEqual([
      'Corentin Clément',
      'M',
      'Open',
      '105',
      '104.69',
      '-300',
      '-320',
      '-335',
      // Best3Squat, then every bench and deadlift cell, then the total: blank.
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      // Place.
      'DQ',
      'Raw',
    ]);
  });

  it('lines the csv row up with the header it claims to follow', () => {
    expect(resultCardEntriesCsvRow(cardOf(CHAPON_INPUT))).toHaveLength(RESULT_CARD_CSV_HEADER.length);
    expect(resultCardEntriesCsvRow(cardOf(CLEMENT_INPUT))).toHaveLength(RESULT_CARD_CSV_HEADER.length);
  });
});

// ---------------------------------------------------------------------------
// The attempt grid
// ---------------------------------------------------------------------------

describe('attempt cells', () => {
  const card = cardOf(CHAPON_INPUT);

  it('keeps the lifts in competition order', () => {
    expect(card.rows.map((row) => row.lift)).toEqual(['squat', 'bench', 'deadlift']);
    expect(card.rows.map((row) => row.label)).toEqual(['SQUAT', 'BENCH', 'DEADLIFT']);
  });

  it('gives every lift exactly three attempts', () => {
    for (const row of card.rows) expect(row.attempts).toHaveLength(3);
  });

  it('marks a made attempt good and leaves it unstruck', () => {
    const first = card.rows[0].attempts[0];
    expect(first.mark).toBe('good');
    expect(first.struckThrough).toBe(false);
    expect(first.text).toBe('155');
    expect(first.signedWeightKg).toBe(155);
  });

  it('strikes a missed attempt through and records it as a negative weight', () => {
    const third = card.rows[0].attempts[2];
    expect(third.mark).toBe('no-lift');
    expect(third.struckThrough).toBe(true);
    // The TEXT is the weight as called; the SIGN is where the miss is recorded,
    // which is the convention published results actually use.
    expect(third.text).toBe('166');
    expect(third.signedWeightKg).toBe(-166);
  });

  it('takes the best from the heaviest GOOD attempt, not the heaviest attempt', () => {
    // 166 was the heaviest bar weight on the squat and it was missed.
    expect(card.rows[0].bestKg).toBe(162.5);
    expect(card.rows[0].bestText).toBe('162.5');
  });

  it('carries the judges’ count so a split decision can be drawn', () => {
    const split = cardOf({
      ...CHAPON_INPUT,
      state: runMeet([
        [100, SPLIT_GOOD],
        [102.5, GOOD],
        [105, NO_LIFT],
        [60, GOOD],
        [62.5, GOOD],
        [65, GOOD],
        [120, GOOD],
        [125, GOOD],
        [130, GOOD],
      ]),
      placing: 1,
    });
    expect(split.rows[0].attempts[0].whiteLights).toBe(2);
    expect(split.rows[0].attempts[0].mark).toBe('good');
    expect(split.rows[0].attempts[2].whiteLights).toBe(0);
  });

  it('leaves an attempt that was never taken blank rather than zero', () => {
    const card2 = cardOf(CLEMENT_INPUT);
    for (const cell of card2.rows[1].attempts) {
      expect(cell.mark).toBe('not-taken');
      expect(cell.text).toBe('');
      expect(cell.weightKg).toBeNull();
      expect(cell.signedWeightKg).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// The bombed lifter — the case the whole module is built around
// ---------------------------------------------------------------------------

describe('a lifter who did not total', () => {
  /**
   * Bombs the BENCH after a good squat, so `totalOnTheBoard` is a large,
   * plausible number while there is still no total. A card that reached for the
   * running sum would print "205" here and look completely normal.
   */
  const BOMBED_BENCH = runMeet([
    [180, GOOD],
    [190, GOOD],
    [200, NO_LIFT],
    [120, NO_LIFT],
    [120, NO_LIFT],
    [122.5, NO_LIFT],
  ]);

  const bombedInput: ResultCardInput = {
    meet: MEET,
    lifter: {
      name: 'Dana Whitmore',
      sex: 'female',
      bodyweightKg: 71.4,
      division: 'Open',
      equipment: 'Raw',
    },
    state: BOMBED_BENCH,
  };

  it('has a large provisional sum on the board and still no total', () => {
    // Pinning the trap itself: if this ever stops being non-zero, the test
    // below stops proving anything.
    expect(totalOnTheBoard(BOMBED_BENCH)).toBe(190);
    expect(finalMeetTotal(BOMBED_BENCH)).toBeNull();
  });

  it('prints no total, and never the running sum', () => {
    const card = cardOf(bombedInput);
    expect(card.totalKg).toBeNull();
    expect(card.summary[0].value).toBe(NO_VALUE_DISPLAY);
    expect(card.summary[0].value).not.toBe('190');
    expect(card.summary[0].value).not.toBe('0');
    expect(card.summary[0].hasValue).toBe(false);
  });

  it('prints no DOTS', () => {
    const card = cardOf(bombedInput);
    expect(card.dots.kind).toBe('no-total');
    expect(card.summary[1].value).toBe(DOTS_NO_TOTAL_DISPLAY);
    expect(card.summary[1].hasValue).toBe(false);
  });

  it('prints DQ in the place column, not a number and not a dash', () => {
    const card = cardOf(bombedInput);
    expect(card.summary[2].value).toBe(PLACE_NO_TOTAL_DISPLAY);
    expect(card.summary[2].value).toBe('DQ');
    expect(card.placed).toBe(false);
  });

  it('still shows the lifts they made, honestly', () => {
    const card = cardOf(bombedInput);
    expect(card.rows[0].bestText).toBe('190');
    expect(card.rows[0].attempts.map((cell) => cell.text)).toEqual(['180', '190', '200']);
    expect(card.rows[0].attempts.map((cell) => cell.mark)).toEqual(['good', 'good', 'no-lift']);
  });

  it('shows the bombed lift with no best, and all three struck', () => {
    const card = cardOf(bombedInput);
    expect(card.bombedLift).toBe('bench');
    expect(card.rows[1].bombed).toBe(true);
    expect(card.rows[1].bestKg).toBeNull();
    expect(card.rows[1].bestText).toBe(NO_VALUE_DISPLAY);
    expect(card.rows[1].bestText).not.toBe('0');
    expect(card.rows[1].attempts.every((cell) => cell.struckThrough)).toBe(true);
    expect(card.rows[1].attempts.map((cell) => cell.signedWeightKg)).toEqual([-120, -120, -122.5]);
  });

  it('shows the lift that was never contested as empty, not as bombed', () => {
    const card = cardOf(bombedInput);
    expect(card.rows[2].status).toBe('not-contested');
    expect(card.rows[2].bombed).toBe(false);
    expect(card.rows[2].bestText).toBe(NO_VALUE_DISPLAY);
    expect(card.rows[2].attempts.every((cell) => cell.mark === 'not-taken')).toBe(true);
  });

  it('refuses to rank them', () => {
    const refused = buildResultCard({ ...bombedInput, placing: 12 });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.error.code).toBe('PLACING_WITHOUT_TOTAL');
  });

  it('refuses to rank them even at first place', () => {
    const refused = buildResultCard({ ...bombedInput, placing: 1 });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.error.code).toBe('PLACING_WITHOUT_TOTAL');
  });
});

describe('a lifter who forfeited every attempt on a lift', () => {
  // A pass is not a miss — the bar was never taken — but it is still no lift on
  // the board, so there is still no total. A passed attempt has no weight at
  // all, so it must not be struck through: there is nothing to strike.
  const PASSED_OUT = (() => {
    let state = runMeet([
      [100, GOOD],
      [105, GOOD],
      [110, GOOD],
    ]);
    for (let i = 0; i < 3; i += 1) {
      const passed = passAttempt(state);
      if (!passed.ok) throw new Error(`pass ${i + 1} failed: ${passed.error.code}`);
      state = passed.value;
    }
    return state;
  })();

  const passedCard = (): ResultCard =>
    cardOf({
      meet: MEET,
      lifter: { name: 'Ada Ferris', sex: 'female', bodyweightKg: 62.1, division: 'Open', equipment: 'Raw' },
      state: PASSED_OUT,
    });

  it('has no total and prints DQ', () => {
    const card = passedCard();
    expect(card.totalKg).toBeNull();
    expect(card.bombedLift).toBe('bench');
    expect(card.summary[0].value).toBe(NO_VALUE_DISPLAY);
    expect(card.summary[2].value).toBe('DQ');
  });

  it('marks the forfeited attempts as passes, blank and unstruck', () => {
    const card = passedCard();
    for (const cell of card.rows[1].attempts) {
      expect(cell.mark).toBe('passed');
      expect(cell.text).toBe('');
      expect(cell.weightKg).toBeNull();
      expect(cell.signedWeightKg).toBe(0);
      expect(cell.struckThrough).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Totals, DOTS and placing for a lifter who did total
// ---------------------------------------------------------------------------

describe('a lifter who totalled', () => {
  const card = cardOf(CHAPON_INPUT);

  it('totals the best good attempt in each lift', () => {
    expect(card.totalKg).toBe(162.5 + 102 + 170);
    expect(card.totalKg).toBe(434.5);
    expect(card.summary[0].value).toBe('434.5');
  });

  it('scores DOTS from the official total and the lifter’s own bodyweight', () => {
    const expected = formatDotsScore(dotsScore('female', 46.7, officialTotalKg(434.5)));
    expect(card.summary[1].value).toBe(expected);
    expect(card.summary[1].value).not.toBe(DOTS_NO_TOTAL_DISPLAY);
    // A card that scored the wrong sex's coefficients, or the wrong
    // bodyweight, would still be a plausible-looking number — so pin it
    // against the alternatives too.
    expect(card.summary[1].value).not.toBe(formatDotsScore(dotsScore('male', 46.7, officialTotalKg(434.5))));
    expect(card.summary[1].value).not.toBe(formatDotsScore(dotsScore('female', 74, officialTotalKg(434.5))));
  });

  it('prints the placing it was given', () => {
    expect(card.summary[2].value).toBe('2');
    expect(card.placed).toBe(true);
  });

  it('prints a dash rather than a guess when the field is unknown', () => {
    const unplaced = cardOf({ ...CHAPON_INPUT, placing: undefined });
    expect(unplaced.summary[2].value).toBe(NO_VALUE_DISPLAY);
    expect(unplaced.summary[2].value).not.toBe('DQ');
    expect(unplaced.placed).toBe(false);
  });

  it('names the summary rows in TOTAL / DOTS / PLACE order', () => {
    expect(card.summary.map((row) => row.id)).toEqual(['total', 'dots', 'place']);
    expect(card.summary.map((row) => row.label)).toEqual(['TOTAL', 'DOTS', 'PLACE']);
  });
});

// ---------------------------------------------------------------------------
// Refusals
// ---------------------------------------------------------------------------

describe('refusals', () => {
  it('will not card a meet that is still running', () => {
    const midMeet = runMeet([
      [150, GOOD],
      [160, GOOD],
    ]);
    const result = buildResultCard({ ...CHAPON_INPUT, state: midMeet, placing: undefined });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('MEET_IN_PROGRESS');
  });

  it('will not accept a placing of zero or a fraction', () => {
    for (const placing of [0, -1, 1.5]) {
      const result = buildResultCard({ ...CHAPON_INPUT, placing });
      expect(result.ok, `placing ${placing}`).toBe(false);
      if (result.ok) continue;
      expect(result.error.code).toBe('INVALID_PLACING');
    }
  });

  it('will not card a lifter with no name or no bodyweight', () => {
    const noName = buildResultCard({
      ...CHAPON_INPUT,
      lifter: { ...CHAPON_INPUT.lifter, name: '   ' },
    });
    expect(noName.ok).toBe(false);
    if (!noName.ok) expect(noName.error.code).toBe('INVALID_LIFTER');

    const noWeight = buildResultCard({
      ...CHAPON_INPUT,
      lifter: { ...CHAPON_INPUT.lifter, bodyweightKg: 0 },
    });
    expect(noWeight.ok).toBe(false);
    if (!noWeight.ok) expect(noWeight.error.code).toBe('INVALID_LIFTER');
  });
});

// ---------------------------------------------------------------------------
// Domain rules a real powerlifter would check
// ---------------------------------------------------------------------------

describe('competition rules the card can never break', () => {
  it('never shows an attempt lighter than the one before it, on any lift', () => {
    for (const input of [CHAPON_INPUT, CLEMENT_INPUT]) {
      const card = cardOf(input);
      for (const row of card.rows) {
        const weights = row.attempts.map((cell) => cell.weightKg).filter((w): w is number => w !== null);
        for (let i = 1; i < weights.length; i += 1) {
          const previous = weights[i - 1];
          const current = weights[i];
          expect(previous).toBeDefined();
          expect(current).toBeDefined();
          if (previous === undefined || current === undefined) continue;
          expect(current, `${row.lift} attempt ${i + 1}`).toBeGreaterThanOrEqual(previous);
        }
      }
    }
  });

  it('cannot be handed a decreasing attempt in the first place', () => {
    // The engine is what enforces it; this pins that the card's fixtures are
    // built through that gate rather than around it.
    const afterMiss = runMeet([[200, NO_LIFT]]);
    const dropped = declareAttempt(afterMiss, { weight: 197.5 });
    expect(dropped.ok).toBe(false);
    if (dropped.ok) return;
    expect(dropped.error.code).toBe('WEIGHT_DECREASED');
  });

  it('sums the three bests and nothing else', () => {
    const card = cardOf(CHAPON_INPUT);
    const bests = card.rows.map((row) => row.bestKg ?? 0);
    expect(card.totalKg).toBe(bests[0]! + bests[1]! + bests[2]!);
  });
});

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

describe('formatWeight', () => {
  it('hides trailing zeros the way a results sheet does', () => {
    expect(formatWeight(200)).toBe('200');
    expect(formatWeight(192.5)).toBe('192.5');
    expect(formatWeight(46.85)).toBe('46.85');
    expect(formatWeight(2.5)).toBe('2.5');
  });

  it('keeps the sign a missed attempt is recorded with', () => {
    expect(formatWeight(-166)).toBe('-166');
    expect(formatWeight(-172.5)).toBe('-172.5');
  });

  it('does not leak binary floating-point noise', () => {
    expect(formatWeight(0.1 + 0.2)).toBe('0.3');
    expect(formatWeight(162.5 + 102 + 170)).toBe('434.5');
  });

  it('refuses a weight it cannot print', () => {
    expect(() => formatWeight(Number.NaN)).toThrow(RangeError);
    expect(() => formatWeight(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('formatBodyweight', () => {
  it('prints two places, even when the lifter weighed in round', () => {
    expect(formatBodyweight(46.7)).toBe('46.70');
    expect(formatBodyweight(104.69)).toBe('104.69');
    expect(formatBodyweight(83)).toBe('83.00');
  });
});

describe('weightClassString', () => {
  it('puts a lifter in the lightest class they make', () => {
    expect(weightClassString(46.7, WEIGHT_CLASSES_KG.female)).toBe('47');
    expect(weightClassString(47, WEIGHT_CLASSES_KG.female)).toBe('47');
    expect(weightClassString(47.01, WEIGHT_CLASSES_KG.female)).toBe('52');
    expect(weightClassString(104.69, WEIGHT_CLASSES_KG.male)).toBe('105');
  });

  it('marks a super-heavyweight with a plus', () => {
    expect(weightClassString(131.9, WEIGHT_CLASSES_KG.male)).toBe('120+');
    expect(weightClassString(90, WEIGHT_CLASSES_KG.female)).toBe('84+');
  });

  it('uses the class list it is given, not a built-in one', () => {
    expect(weightClassString(90, [100])).toBe('100');
    expect(weightClassString(90, [75, 82.5])).toBe('82.5+');
  });
});

describe('formatMeetDate', () => {
  it('prints the day, an uppercase month and the year', () => {
    expect(formatMeetDate('2025-06-08')).toBe('08 JUN 2025');
    expect(formatMeetDate('2026-12-31')).toBe('31 DEC 2026');
    expect(formatMeetDate('2026-01-01')).toBe('01 JAN 2026');
  });

  it('has an abbreviation for every month', () => {
    expect(MONTH_ABBREVIATIONS).toHaveLength(12);
    for (let month = 1; month <= 12; month += 1) {
      const iso = `2026-${String(month).padStart(2, '0')}-15`;
      expect(formatMeetDate(iso).split(' ')[1]).toBe(MONTH_ABBREVIATIONS[month - 1]);
    }
  });

  it('refuses anything that is not an ISO date', () => {
    expect(() => formatMeetDate('14/02/2026')).toThrow(RangeError);
    expect(() => formatMeetDate('2026-2-14')).toThrow(RangeError);
    expect(() => formatMeetDate('2026-13-01')).toThrow(RangeError);
  });
});

describe('formatMeetLocation', () => {
  it('joins the parts it has and drops the ones it does not', () => {
    expect(formatMeetLocation({ town: 'Chemnitz', country: 'Germany' })).toBe('CHEMNITZ, GERMANY');
    expect(formatMeetLocation({ town: 'Austin', state: 'TX', country: 'USA' })).toBe('AUSTIN, TX, USA');
    expect(formatMeetLocation({ country: 'Germany' })).toBe('GERMANY');
    expect(formatMeetLocation({})).toBe('');
    expect(formatMeetLocation({ town: '  ', country: 'Wales' })).toBe('WALES');
  });
});

// ---------------------------------------------------------------------------
// Column order is data. TWO orders live in this module and they come from two
// different sources: `RESULT_SHEET_COLUMNS` from the RENDERED meet page [R8],
// `RESULT_CARD_CSV_HEADER` from the entries.csv TRANSCRIPTION [R2]. The ledger
// block near the top of this file is what keeps each citation on the right one.
// ---------------------------------------------------------------------------

describe('the rendered column order', () => {
  it('runs place, identity, bodyweight, then each lift in competition order', () => {
    // Hand-written, and PLACE IS FIRST — that is [R8]'s order, the one a meet
    // page renders. It is not entries.csv's, which puts Place 21st of 24; the
    // block above is what holds the ledger to citing the right one of the two.
    expect(RESULT_SHEET_COLUMNS.map((column) => column.id)).toEqual([
      'place',
      'lifter',
      'sex',
      'division',
      'equipment',
      'weightClass',
      'bodyweight',
      'squat1',
      'squat2',
      'squat3',
      'bestSquat',
      'bench1',
      'bench2',
      'bench3',
      'bestBench',
      'deadlift1',
      'deadlift2',
      'deadlift3',
      'bestDeadlift',
      'total',
      'dots',
    ]);
  });

  it('renders a card into that order, cell for cell', () => {
    const line = resultSheetLine(cardOf(CHAPON_INPUT));
    expect(line.map((cell) => cell.column.id)).toEqual(RESULT_SHEET_COLUMNS.map((column) => column.id));
    expect(line.map((cell) => cell.text)).toEqual([
      '2',
      'Tiffany Chapon',
      'F',
      'Open',
      'Raw',
      '47',
      '46.70',
      '155',
      '162.5',
      '166',
      '162.5',
      '97.5',
      '102',
      '105',
      '102',
      '162.5',
      '170',
      '172.5',
      '170',
      '434.5',
      formatDotsScore(dotsScore('female', 46.7, officialTotalKg(434.5))),
    ]);
  });

  it('right-aligns every column that holds a number and no others', () => {
    const numeric = RESULT_SHEET_COLUMNS.filter((column) => column.numeric).map((column) => column.id);
    expect(numeric).toContain('total');
    expect(numeric).toContain('dots');
    expect(numeric).toContain('squat1');
    expect(numeric).not.toContain('lifter');
    expect(numeric).not.toContain('place');
  });
});

// ---------------------------------------------------------------------------
// The card always says whose category this is
// ---------------------------------------------------------------------------

describe('the lifter’s category', () => {
  it('names the sex, the kit, the division and the class, in that order', () => {
    // The word order is the committed reference board's — its Division column
    // reads "Women's Raw Open 52". Note this is NOT `RESULT_SHEET_COLUMNS`'
    // order, which puts Division before Equipment as both [R2] and [R9] do; a
    // tabulated row and a spoken category name differ.
    expect(lifterCategoryText(cardOf(CHAPON_INPUT).lifter)).toBe("WOMEN'S RAW OPEN 47");
    expect(lifterCategoryText(cardOf(CLEMENT_INPUT).lifter)).toBe("MEN'S RAW OPEN 105");
  });

  it('can be asked to drop the kit or the division, and never the sex or the class', () => {
    const lifter = cardOf({
      ...CHAPON_INPUT,
      lifter: { ...CHAPON_INPUT.lifter, division: 'Masters 1', equipment: 'Single-ply' },
    }).lifter;
    expect(lifterCategoryText(lifter)).toBe("WOMEN'S SINGLE-PLY MASTERS 1 47");
    expect(lifterCategoryText(lifter, { equipment: true, division: false })).toBe("WOMEN'S SINGLE-PLY 47");
    expect(lifterCategoryText(lifter, { equipment: false, division: true })).toBe("WOMEN'S MASTERS 1 47");
    // Nothing a caller can pass removes either of these two.
    for (const equipment of [true, false]) {
      for (const division of [true, false]) {
        const text = lifterCategoryText(lifter, { equipment, division });
        expect(text, `${String(equipment)}/${String(division)}`).toContain(SEX_CATEGORY_WORD.female);
        expect(text).toContain('47');
      }
    }
  });

  it('puts the category on every card it builds', () => {
    for (const input of [CHAPON_INPUT, CLEMENT_INPUT]) {
      const card = cardOf(input);
      expect(card.lifter.categoryText).toBe(lifterCategoryText(card.lifter));
      expect(card.lifter.categoryText).toContain(SEX_CATEGORY_WORD[card.lifter.sex]);
      expect(resultCardStrings(card)).toContain(card.lifter.categoryText);
    }
  });

  it('distinguishes a man and a woman in the same declared class', () => {
    // The point of the whole field: DOTS takes sex as an input, and the weight
    // class does not stand in for it — 84 is a women's class, 83 a men's, and
    // a declared class string can be identical either way.
    const shared = { ...CHAPON_INPUT.lifter, weightClassKg: '84' };
    const woman = cardOf({ ...CHAPON_INPUT, lifter: { ...shared, sex: 'female' } });
    const man = cardOf({ ...CHAPON_INPUT, lifter: { ...shared, sex: 'male' } });
    expect(woman.lifter.weightClassText).toBe(man.lifter.weightClassText);
    expect(woman.lifter.categoryText).not.toBe(man.lifter.categoryText);
    expect(woman.lifter.categoryText).toBe("WOMEN'S RAW OPEN 84");
    expect(man.lifter.categoryText).toBe("MEN'S RAW OPEN 84");
    // ...and the DOTS score really does differ, which is why it matters.
    expect(woman.summary[1].value).not.toBe(man.summary[1].value);
  });

  it('leaves the CSV row and the sheet line on the published M/F', () => {
    // Two renderings of one fact. The phrase is for a card with no heading row;
    // the letter is for a table that has a "Sex" column over it, which is what
    // [R2] and [R6] actually publish. Adding the phrase must not disturb them.
    const card = cardOf(CHAPON_INPUT);
    expect(card.lifter.sexText).toBe('F');
    expect(resultCardEntriesCsvRow(card)[1]).toBe('F');
    expect(resultSheetLine(card).find((cell) => cell.column.id === 'sex')?.text).toBe('F');
    expect(RESULT_CARD_CSV_HEADER[1]).toBe('Sex');
  });

  it('drops a blank division or kit rather than printing a double space', () => {
    const bare = cardOf({
      ...CHAPON_INPUT,
      lifter: { ...CHAPON_INPUT.lifter, division: '', equipment: '   ' },
    });
    expect(bare.lifter.categoryText).toBe("WOMEN'S 47");
  });
});

describe('resultCardStrings', () => {
  it('lists everything the renderer has to draw, and nothing empty', () => {
    const strings = resultCardStrings(cardOf(CHAPON_INPUT));
    expect(strings).toContain('IRON UNION');
    expect(strings).toContain('Winter Open');
    expect(strings).toContain('14 FEB 2026');
    expect(strings).toContain('SHEFFIELD, ENGLAND');
    expect(strings).toContain('Tiffany Chapon');
    expect(strings).toContain('DEADLIFT');
    expect(strings).toContain(ATTEMPT_GRID_HEADINGS.best);
    expect(strings).toContain('434.5');
    expect(strings.every((text) => text !== '')).toBe(true);
  });

  it('includes the dash and the DQ a bombed card prints', () => {
    const strings = resultCardStrings(cardOf(CLEMENT_INPUT));
    expect(strings).toContain(NO_VALUE_DISPLAY);
    expect(strings).toContain('DQ');
  });
});
