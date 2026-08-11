/**
 * GDD §6.3's screen: what it SAYS, and what it PAINTS, held to one decision.
 *
 * ===========================================================================
 * WHY THIS FILE EXISTS
 * ===========================================================================
 * `MEET_COPY.OPTION_BIG_WHY` read 'A PR on the line. Higher risk.' and was
 * printed unconditionally, while the gold border beside it is painted off
 * `AttemptOption.isPrAttempt`, which is
 * `previousBestKg !== null && weightKg > previousBestKg`.
 *
 * `meetServer.ts`'s `previousBestByLift` answers all-null while `record.meets`
 * is empty, which is exactly a lifter's first meet — the meet a player actually
 * reaches, and the one `.gauntlet/shots/shell/04a-live-recap-with-way-back.png`
 * shows ending on FIRST TOTAL. So on that meet the flag was false on every card
 * and the sentence printed on every big one: `FIRST_MEET_BEFORE_THE_FIX` below
 * is the measured count, taken on the shipped engine with the driver's own
 * option preference. In the same sitting `meetServer.ts` marks all three lifts
 * a competition PR on the recap, because a first-ever lift beats a null best —
 * so the app said a lift both was and was not a PR, forty seconds apart.
 *
 * ===========================================================================
 * WHAT THIS FILE CAN AND CANNOT SAY
 * ===========================================================================
 * `vitest.config.ts` is `environment: node`. Nothing here renders a border, so
 * this file cannot see a colour, and it does not claim to. It says two things:
 *
 *   1. THE DATA. Every card the engine can produce carries its PR sentence
 *      exactly when it carries the PR flag, swept over whole meets on both
 *      arms with the counts pinned — including the zero that used to be six.
 *   2. THE WIRING, by reading `AttemptSelectView.tsx` as text, the way
 *      `meetStage.test.ts` and `meetFeel.test.ts` already read their screens.
 *      Each source predicate is shown to FIRE on a planted mutant of the same
 *      source, so it is a pin with a demonstrated failing case rather than a
 *      string that happens to be in the file.
 *
 * WHAT IS OUT OF REACH HERE, said rather than papered over: that the border is
 * DRAWN, in the colour the palette names, on a screen a player reached. That
 * lives in `tools/verify-shell-route.mjs`, which reads the pair off both played
 * meets in a browser with the address bar asserted to carry no query string.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { ATTEMPTS_PER_LIFT, LIFT_ORDER, type LiftKind } from '../game/meet';
import {
  attemptConfigFor,
  attemptDecisionFor,
  createMeetDay,
  stepMeetDay,
  type AttemptDecision,
  type AttemptOption,
  type AttemptOptionId,
  type MeetDayContext,
  type MeetDayState,
} from '../game/meetDay';
import { previewContext, playRep, type RepStyle } from '../game/meetPreview';
import { MEET_COPY, MEET_PREVIEW } from '../game/meetTuning';
import { formatWeight } from '../game/resultCard';

const VIEW_FILE = 'AttemptSelectView.tsx';
const VIEW_SOURCE = readFileSync(path.join(__dirname, VIEW_FILE), 'utf8');

/**
 * The lifter a player IS on the meet they can actually open: no meets on
 * record, so `previousBestByLift` answers null for all three lifts.
 *
 * `appServer.ts` builds the app's one row from `newServerRecord`, `MeetScreen`
 * reads meet day off that row, and nothing in the shipped app puts a meet in it
 * before the first one is played. This context is that state.
 */
function firstMeetContext(): MeetDayContext {
  return {
    ...previewContext(),
    previousBestTotalKg: null,
    previousBestByLiftKg: { squat: null, bench: null, deadlift: null },
  };
}

/** The lifter the debug preview scripts: three competition bests on record. */
function laterMeetContext(): MeetDayContext {
  return previewContext();
}

/**
 * How many times GDD §6.3's screen comes up in a meet that reaches its end.
 *
 * Derived from the sport's own shape rather than typed: openers are declared at
 * weigh-in (§6.1), so every lift produces one selection per attempt after the
 * first. Three lifts x two = six.
 */
const SELECTIONS_IN_A_WHOLE_MEET = LIFT_ORDER.length * (ATTEMPTS_PER_LIFT - 1);

/** Two cards, never three — `AttemptSelectView`'s own header, and §6.3's shape. */
const CARDS_PER_SELECTION = 2;

const CARDS_IN_A_WHOLE_MEET = SELECTIONS_IN_A_WHOLE_MEET * CARDS_PER_SELECTION;

/** Plain-string entries in `MEET_COPY`. Pinned so the scan below cannot empty. */
const MEET_COPY_STRINGS = 68;

/**
 * WHAT THE ZEROES BELOW ARE ZERO AGAINST.
 *
 * The count of cards on a played first meet that printed 'A PR on the line.'
 * while `isPrAttempt` was false, measured on the shipped engine before the fix
 * with `MEET_DRIVE.SAFEST_OPTIONS`' preference — one big card on each of the
 * six selections. Kept here for the reason `streak.test.ts` keeps the stock's
 * violating-pair counts: a zero with nothing behind it is a number nobody can
 * check.
 */
const FIRST_MEET_BEFORE_THE_FIX = Object.freeze({
  SELECTIONS: 6,
  CARDS: 12,
  PR_FLAGGED_CARDS: 0,
  CARDS_CLAIMING_A_PR: 6,
});

// ---------------------------------------------------------------------------
// Driving whole meets through the real machine. Nothing reaches into state.
// ---------------------------------------------------------------------------

function openedMeet(context: MeetDayContext): MeetDayState {
  return stepMeetDay(stepMeetDay(createMeetDay(context), { kind: 'confirm-weigh-in' }), {
    kind: 'confirm-openers',
  });
}

function take(state: MeetDayState, style: RepStyle): MeetDayState {
  const lifting = stepMeetDay(state, { kind: 'walkout-done' });
  const resolution = playRep(attemptConfigFor(lifting), style);
  const deliberating = stepMeetDay(lifting, { kind: 'lift-resolved', resolution });
  const verdict = stepMeetDay(deliberating, { kind: 'deliberation-done' });
  return stepMeetDay(verdict, { kind: 'verdict-done' });
}

/** How the scripted lifter performs an attempt, and which card it then takes. */
interface MeetScript {
  readonly name: string;
  readonly context: () => MeetDayContext;
  readonly styleFor: (lift: LiftKind, attemptNumber: number) => RepStyle;
  readonly prefer: readonly AttemptOptionId[];
}

function everySelectionIn(script: MeetScript): AttemptDecision[] {
  const seen: AttemptDecision[] = [];
  let state = openedMeet(script.context());
  // GDD §6.2 is nine attempts; the guard is well past any legal meet, so a
  // machine that stopped advancing shows up as a short list rather than a hang.
  for (let guard = 0; guard < 64; guard += 1) {
    if (state.phase === 'recap' || state.phase === 'bombed') break;
    if (state.phase === 'attempt-select') {
      const decision = attemptDecisionFor(state.meet, state.context.previousBestByLiftKg);
      expect(decision, `${script.name}: the select beat produced no decision`).not.toBeNull();
      if (decision === null) break;
      seen.push(decision);
      const wanted =
        script.prefer.find((id) => decision.options.some((option) => option.id === id)) ??
        decision.options[0]?.id;
      const option = decision.options.find((candidate) => candidate.id === wanted);
      expect(option, `${script.name}: none of ${script.prefer.join('/')} was on offer`).toBeDefined();
      if (option === undefined) break;
      state = stepMeetDay(state, { kind: 'declare', weightKg: option.weightKg });
      continue;
    }
    if (state.phase === 'walkout') {
      const live = state.live;
      expect(live, `${script.name}: a walkout with no attempt on it`).not.toBeNull();
      state = take(state, script.styleFor(live?.lift ?? 'squat', live?.attemptNumber ?? 1));
      continue;
    }
    break;
  }
  return seen;
}

const ALL_GOOD = (): RepStyle => 'perfect';
/** `dumped` is the miss that is a miss at any load — see `meetPreview.ts`. */
const MISS_THE_OPENER = (_lift: LiftKind, attemptNumber: number): RepStyle =>
  attemptNumber === 1 ? 'dumped' : 'perfect';

/**
 * Every way this suite drives §6.3, both arms and both branches of the choice.
 *
 * `THE PLAYED ARM` is the one the app hands a player today; the `preview`
 * scripts are the debug lifter, and are here because they are the only place a
 * PR attempt is reachable in a single meet — which is what makes the
 * flag-is-true half of the sweep non-empty.
 */
const SCRIPTS: readonly MeetScript[] = [
  {
    name: 'first meet, safest cards (the played arm)',
    context: firstMeetContext,
    styleFor: ALL_GOOD,
    prefer: ['repeat', 'small', 'big'],
  },
  {
    name: 'first meet, biggest cards',
    context: firstMeetContext,
    styleFor: ALL_GOOD,
    prefer: ['big', 'repeat', 'small'],
  },
  {
    name: 'first meet, opener missed',
    context: firstMeetContext,
    styleFor: MISS_THE_OPENER,
    prefer: ['repeat', 'small', 'big'],
  },
  {
    name: 'a lifter with bests on record, safest cards',
    context: laterMeetContext,
    styleFor: ALL_GOOD,
    prefer: ['repeat', 'small', 'big'],
  },
  {
    name: 'a lifter with bests on record, biggest cards',
    context: laterMeetContext,
    styleFor: ALL_GOOD,
    prefer: ['big', 'repeat', 'small'],
  },
  {
    name: 'a lifter with bests on record, opener missed',
    context: laterMeetContext,
    styleFor: MISS_THE_OPENER,
    prefer: ['repeat', 'small', 'big'],
  },
];

/**
 * Everything the card puts in front of the player, as one string.
 *
 * Assembled in `AttemptSelectView`'s own order from the option's own fields, so
 * a sentence that reaches the screen by any of the five Texts is inside it. It
 * is not a render — see the header for what that costs.
 */
function whatTheCardSays(option: AttemptOption): string {
  return [
    option.label,
    formatWeight(option.weightKg),
    option.deltaKg === 0 ? MEET_COPY.OPTION_SAME_WEIGHT : `+${formatWeight(option.deltaKg)}`,
    option.prNote ?? '',
    option.why,
  ].join(' ');
}

// ---------------------------------------------------------------------------
// 1. The data: the sentence and the flag are one decision
// ---------------------------------------------------------------------------

describe('GDD §6.3 — the PR call-out is true of the card it is on', () => {
  it('prints the PR sentence on exactly the cards the PR flag is set on [pr-sentence-and-pr-border-are-one-decision]', () => {
    let cards = 0;
    let flagged = 0;
    let saidPr = 0;
    let bothWays = 0;
    for (const script of SCRIPTS) {
      const selections = everySelectionIn(script);
      expect(selections.length, `${script.name} produced no §6.3 screens`).toBe(
        SELECTIONS_IN_A_WHOLE_MEET,
      );
      for (const decision of selections) {
        for (const option of decision.options) {
          cards += 1;
          const says = whatTheCardSays(option).includes(MEET_COPY.OPTION_PR_NOTE);
          if (option.isPrAttempt) flagged += 1;
          if (says) saidPr += 1;
          if (option.isPrAttempt === says) bothWays += 1;
          expect(
            says,
            `${script.name}: ${decision.lift} #${decision.attemptNumber} ${option.id} @${option.weightKg} says ` +
              `${JSON.stringify(MEET_COPY.OPTION_PR_NOTE)}=${says} with isPrAttempt=${option.isPrAttempt}`,
          ).toBe(option.isPrAttempt);
        }
      }
    }
    // NON-VACUITY, AS COUNTS RATHER THAN BOUNDS. The sweep is worth nothing if
    // the flag is constant across it, so both sides are pinned: this many cards
    // were examined, this many carried the flag, and the two counts above agree
    // on every one of them.
    expect(cards, 'cards examined').toBe(SCRIPTS.length * CARDS_IN_A_WHOLE_MEET);
    expect(flagged, 'cards the engine flagged as a PR attempt').toBe(19);
    expect(cards - flagged, 'cards the engine did NOT flag').toBe(53);
    expect(saidPr, 'cards that printed the PR sentence').toBe(flagged);
    expect(bothWays, 'cards where the sentence and the flag agree').toBe(cards);
  });

  it('never puts the PR claim in a card’s reason, which is where it used to live', () => {
    // The claim is about `why` SPECIFICALLY, not about the card as a whole:
    // `prNote` is allowed to say it and is the only field that may. A mutant
    // that puts the sentence back into `OPTION_BIG_WHY` reddens here even on a
    // meet where the big card genuinely is a PR.
    let reasons = 0;
    for (const script of SCRIPTS) {
      for (const decision of everySelectionIn(script)) {
        for (const option of decision.options) {
          reasons += 1;
          expect(
            option.why.includes(MEET_COPY.OPTION_PR_NOTE),
            `${script.name}: ${option.id}'s reason ${JSON.stringify(option.why)}`,
          ).toBe(false);
        }
      }
    }
    expect(reasons, 'reasons examined').toBe(SCRIPTS.length * CARDS_IN_A_WHOLE_MEET);
  });

  it('says nothing about a record on the meet a player can actually open', () => {
    // THE DEFECT, AS A NUMBER. On the first meet of an app run every previous
    // best is null, so no card is a PR attempt — and before the fix six of the
    // twelve said one was.
    const selections = everySelectionIn(SCRIPTS[0]!);
    const options = selections.flatMap((decision) => decision.options);
    expect(selections.length, 'selections on a played first meet').toBe(
      FIRST_MEET_BEFORE_THE_FIX.SELECTIONS,
    );
    expect(options.length, 'cards on a played first meet').toBe(FIRST_MEET_BEFORE_THE_FIX.CARDS);
    expect(
      options.filter((option) => option.isPrAttempt).length,
      'PR-flagged cards on a played first meet',
    ).toBe(FIRST_MEET_BEFORE_THE_FIX.PR_FLAGGED_CARDS);
    expect(
      options.filter((option) => whatTheCardSays(option).includes(MEET_COPY.OPTION_PR_NOTE)).length,
      `cards claiming a PR on a played first meet — was ${FIRST_MEET_BEFORE_THE_FIX.CARDS_CLAIMING_A_PR}`,
    ).toBe(0);
    expect(
      options.filter((option) => option.prNote !== null).length,
      'cards carrying a PR note on a played first meet',
    ).toBe(0);
    // And the sweep it is drawn from is not empty in the other direction:
    // `MEET_PREVIEW.PREVIOUS_BEST_BY_LIFT_KG` is the record that makes a PR
    // reachable at all, so if it ever became null this test's twin above would
    // be measuring one arm twice.
    for (const lift of LIFT_ORDER) {
      expect(MEET_PREVIEW.PREVIOUS_BEST_BY_LIFT_KG[lift], `preview best ${lift}`).toBeGreaterThan(0);
    }
  });

  it('keeps the PR sentence to one entry in MEET_COPY, counted', () => {
    // A textual pin whose pattern has more than one witness in the file is the
    // vacuity CLAUDE.md names, so this counts rather than tests presence: the
    // sentence may appear in exactly one MEET_COPY value, and putting it back
    // into OPTION_BIG_WHY takes the count to two.
    // `unknown[]` on purpose: `MEET_COPY` is `Object.freeze`d with two nested
    // label maps in it, so the values are not all strings and TypeScript
    // narrows the rest to a literal union that a `string` predicate cannot be
    // written against.
    const values: readonly unknown[] = Object.values(MEET_COPY);
    const strings = values.filter((value): value is string => typeof value === 'string');
    const carrying = strings.filter((value) => value.includes(MEET_COPY.OPTION_PR_NOTE));
    // Counted, not bounded — an entry disappearing is as interesting as one
    // arriving, and a shrinking domain is how this sweep would go quiet.
    expect(strings.length, 'MEET_COPY string entries scanned').toBe(MEET_COPY_STRINGS);
    expect(carrying, 'MEET_COPY entries containing the PR sentence').toEqual([
      MEET_COPY.OPTION_PR_NOTE,
    ]);
  });
});

// ---------------------------------------------------------------------------
// 2. The wiring: the screen reads that one decision, twice
// ---------------------------------------------------------------------------

/** How many times `source` paints the gold edge off the PR flag. */
function prBorderPaints(source: string): number {
  return [...source.matchAll(/option\.isPrAttempt\s*\?\s*styles\.cardPr\s*:\s*null/g)].length;
}

/** How many times `source` draws the PR sentence off the PR note. */
function prSentenceDraws(source: string): number {
  return [...source.matchAll(/\{option\.prNote\}/g)].length;
}

/**
 * How many times the CODE of `source` reaches for the palette's gold.
 *
 * Comments are stripped first, and finding that out is what the first run of
 * this file was for: the header above `styles` names the constant in prose, so
 * a raw count answered 3 for two uses. A scan that counts its own
 * documentation is measuring the wrong thing in the reassuring direction.
 */
function goldMentions(source: string): number {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  return [...code.matchAll(/MEET_PALETTE\.CARD_PR_EDGE/g)].length;
}

describe('GDD §6.3 — the screen wires both renderings to the flag', () => {
  it('paints the gold edge off isPrAttempt, exactly once', () => {
    expect(prBorderPaints(VIEW_SOURCE), `${VIEW_FILE} paints the PR border`).toBe(1);
  });

  it('draws the PR sentence off prNote, exactly once', () => {
    expect(prSentenceDraws(VIEW_SOURCE), `${VIEW_FILE} draws the PR sentence`).toBe(1);
    expect(
      VIEW_SOURCE.includes('attempt-option-pr-note-'),
      `${VIEW_FILE} gives the PR sentence a testID the browser check reads`,
    ).toBe(true);
  });

  it('spends the palette’s gold on the border and the sentence and nothing else', () => {
    expect(goldMentions(VIEW_SOURCE), `${VIEW_FILE} mentions CARD_PR_EDGE`).toBe(2);
    expect(VIEW_SOURCE).toContain('cardPr: {\n    borderColor: MEET_PALETTE.CARD_PR_EDGE,');
    expect(VIEW_SOURCE).toContain('cardPrNote: {\n    color: MEET_PALETTE.CARD_PR_EDGE,');
  });

  it('FIRES on a planted mutant of its own subject, so the three pins above are not decoration', () => {
    // The positive control this whole section stands on. Each predicate is run
    // against the real source mutated the way the defect would arrive, and each
    // must come back with a different count — a scan that has stopped matching
    // agrees with every file it is pointed at.
    const borderRemoved = VIEW_SOURCE.replace(
      'option.isPrAttempt ? styles.cardPr : null,',
      'null,',
    );
    expect(borderRemoved, 'the border mutant changed the source').not.toBe(VIEW_SOURCE);
    expect(prBorderPaints(borderRemoved), 'a screen that stopped painting the border').toBe(0);
    // NOTE WHAT THIS MUTANT DOES NOT MOVE: `goldMentions` stays at 2, because
    // the `cardPr` style survives with nothing reading it. That is the shape of
    // the defect the critic named — a registered colour no pixel paints — and
    // it is why the count above is the pin and the palette count is not.
    expect(goldMentions(borderRemoved), 'the orphaned style is still declared').toBe(2);

    const sentenceRemoved = VIEW_SOURCE.replace('{option.prNote}', '{null}');
    expect(sentenceRemoved, 'the sentence mutant changed the source').not.toBe(VIEW_SOURCE);
    expect(prSentenceDraws(sentenceRemoved), 'a screen that stopped drawing the sentence').toBe(0);

    // And a duplicate does not slip past a presence check: two paints is as
    // wrong as none, because the second could be on a card the first is not.
    const doubled = VIEW_SOURCE.replace(
      'option.isPrAttempt ? styles.cardPr : null,',
      'option.isPrAttempt ? styles.cardPr : null,\n          option.isPrAttempt ? styles.cardPr : null,',
    );
    expect(prBorderPaints(doubled), 'a screen that paints the border twice').toBe(2);
  });
});
