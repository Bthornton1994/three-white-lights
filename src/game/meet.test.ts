import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  ATTEMPTS_PER_LIFT,
  ATTEMPT_JUMP_FRACTION,
  COLLAR_PAIR_WEIGHT_KG,
  COMPETITION_BAR_WEIGHT_KG,
  DECLARATION_INCREMENT_KG,
  DEFAULT_MEET_RULES,
  JUDGES_REQUIRED_FOR_GOOD_LIFT,
  JUDGE_COUNT,
  LIFT_ORDER,
  LOADABLE_WEIGHT_INCREMENT_KG,
  MIN_ATTEMPT_INCREMENT_KG,
  MIN_LOADABLE_WEIGHT_KG,
  OPENER_FRACTION_OF_1RM,
  SMALLEST_CHANGE_PLATE_KG,
  allCompletedAttempts,
  barAndCollarsWeight,
  bestSuccessfulAttempt,
  checkMeetRulesSeal,
  countWhiteLights,
  createMeet,
  currentAttemptContext,
  declareAttempt,
  finalMeetTotal,
  isBombedOut,
  isDeclarableWeight,
  isGoodLift,
  isLegalAttemptWeight,
  isLoadableAttemptWeight,
  isMeetComplete,
  isOnIncrementGrid,
  isSplitDecision,
  isValidJudgePanel,
  meetOutcome,
  minimumAttemptWeight,
  passAttempt,
  readTotal,
  resolveAttempt,
  roundToIncrement,
  roundToLegalAttemptWeight,
  roundToLoadableAttemptWeight,
  suggestNextAttempt,
  suggestOpener,
  totalOnTheBoard,
  validateMeetRules,
} from './meet';
import type {
  AttemptNumber,
  AttemptStrategy,
  DeclareAttemptInput,
  JudgeLight,
  JudgePanel,
  JudgedAttempt,
  LiftKind,
  LiftProgress,
  MeetError,
  MeetLoadingRules,
  MeetRulesSeal,
  MeetState,
  Result,
} from './meet';

// ---------------------------------------------------------------------------
// Fixtures and helpers
// ---------------------------------------------------------------------------

const THREE_WHITE: JudgePanel = ['white', 'white', 'white'];
const TWO_WHITE: JudgePanel = ['white', 'red', 'white'];
const ONE_WHITE: JudgePanel = ['red', 'white', 'red'];
const THREE_RED: JudgePanel = ['red', 'red', 'red'];

/**
 * A federation that lets attempts be CALLED on the half-kilo. This is the only
 * way to declare 200.5, and it is declared once, for the whole meet, at
 * `createMeet`. Note what it does NOT change: `minIncrement` stays at 2.5, so
 * the bar still has to move 2.5 between attempts. This is the rules set that
 * makes `INSUFFICIENT_INCREASE` reachable.
 */
const HALF_KILO_DECLARATION_RULES: MeetLoadingRules = {
  ...DEFAULT_MEET_RULES,
  declarationIncrement: 0.5,
};

/**
 * A federation whose kit stops at 1.25 kg discs, so the bar itself cannot be
 * made lighter-grained than 2.5. Physically coarse, unlike the default meet,
 * which stocks 0.25 kg discs.
 */
const COARSE_PLATE_RULES: MeetLoadingRules = {
  ...DEFAULT_MEET_RULES,
  loadableIncrement: 2.5,
};

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(`Expected ok, got ${result.error.code}: ${result.error.message}`);
  }
  return result.value;
}

function expectError<T>(result: Result<T>): MeetError {
  if (result.ok) {
    throw new Error('Expected a rejection, got ok');
  }
  return result.error;
}

/** Declare and judge one attempt. Throws if the engine rejects either step. */
function takeAttempt(state: MeetState, weight: number, lights: JudgePanel): MeetState {
  const declared = unwrap(declareAttempt(state, { weight }));
  return unwrap(resolveAttempt(declared, { lights }));
}

/** Run a whole lift's worth of attempts. */
function takeLift(state: MeetState, attempts: readonly (readonly [number, JudgePanel])[]): MeetState {
  return attempts.reduce<MeetState>((acc, [weight, lights]) => takeAttempt(acc, weight, lights), state);
}

function judgedAttempt(state: MeetState, lift: LiftKind, index: number): JudgedAttempt {
  const attempt = state.lifts[lift].attempts[index];
  if (attempt === undefined || attempt.status === 'passed') {
    throw new Error(`expected a judged ${lift} attempt at index ${index}`);
  }
  return attempt;
}

const NINE_FOR_NINE: Readonly<Record<LiftKind, readonly (readonly [number, JudgePanel])[]>> = {
  squat: [
    [200, THREE_WHITE],
    [217.5, TWO_WHITE],
    [230, THREE_WHITE],
  ],
  bench: [
    [130, THREE_WHITE],
    [140, THREE_WHITE],
    [147.5, TWO_WHITE],
  ],
  deadlift: [
    [240, THREE_WHITE],
    [260, THREE_WHITE],
    [272.5, THREE_WHITE],
  ],
};

function runNineForNine(): MeetState {
  return LIFT_ORDER.reduce<MeetState>((acc, lift) => takeLift(acc, NINE_FOR_NINE[lift]), createMeet());
}

// ---------------------------------------------------------------------------
// Purity
// ---------------------------------------------------------------------------

describe('module purity', () => {
  const source = readFileSync(new URL('./meet.ts', import.meta.url), 'utf8');

  it('has no imports at all, so it cannot reach React, I/O or sibling modules', () => {
    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source).not.toMatch(/require\(/);
  });

  it('reads no clock and rolls no dice', () => {
    expect(source).not.toMatch(/Date\.now/);
    expect(source).not.toMatch(/new Date/);
    expect(source).not.toMatch(/Math\.random/);
    expect(source).not.toMatch(/performance\.now/);
  });

  it('names the CLAUDE.md / GDD §6.3 conflict rather than silently resolving it', () => {
    expect(source).toMatch(/DESIGN CONFLICT/);
    expect(source).toMatch(/§6\.3/);
  });

  it('says what it can and cannot cite for its loading numbers', () => {
    // CLAUDE.md forbids asserting a rule that could not be verified. The module
    // must keep saying which source it actually retrieved and that no primary
    // rulebook was reachable.
    expect(source).toMatch(/No primary federation rulebook was reachable/);
    expect(source).toMatch(/gitlab\.com\/openpowerlifting\/openlifter/);
    expect(source).toMatch(/secondary source/);
  });

  it('labels each loading number as cited or uncited rather than asserting it flatly', () => {
    // The retrieved plate array is what fixes the loadable increment, and the
    // module must quote it rather than paraphrase.
    expect(source).toMatch(/defaultPlatesKg/);
    expect(source).toMatch(/allowing for increments of 0\.5kg/);
    expect(source).toMatch(/asNumber % 2\.5 !== 0/);
    // ...and the two things it cannot source must be marked UNCITED, including
    // the minimum increase, which was adjudicated rather than retrieved.
    expect(source).toMatch(/UNCITED/);
    expect(source).toMatch(/adjudicat/i);
  });
});

// ---------------------------------------------------------------------------
// Structural constants
// ---------------------------------------------------------------------------

describe('meet structure', () => {
  it('runs squat then bench then deadlift', () => {
    expect(LIFT_ORDER).toEqual(['squat', 'bench', 'deadlift']);
  });

  it('allows three attempts per lift, judged by three referees, majority carrying', () => {
    expect(ATTEMPTS_PER_LIFT).toBe(3);
    expect(JUDGE_COUNT).toBe(3);
    expect(JUDGES_REQUIRED_FOR_GOOD_LIFT).toBe(2);
  });

  it('opens on the first squat attempt', () => {
    const state = createMeet();
    expect(state.phase).toEqual({ kind: 'awaiting-declaration', lift: 'squat', attemptNumber: 1 });
    expect(state.lifts.squat.status).toBe('in-progress');
    expect(state.lifts.bench.status).toBe('upcoming');
    expect(state.lifts.deadlift.status).toBe('upcoming');
    expect(totalOnTheBoard(state)).toBe(0);
    expect(finalMeetTotal(state)).toBeNull();
    expect(meetOutcome(state)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Judging
// ---------------------------------------------------------------------------

describe('three-light judging', () => {
  it('counts white lights', () => {
    expect(countWhiteLights(THREE_WHITE)).toBe(3);
    expect(countWhiteLights(TWO_WHITE)).toBe(2);
    expect(countWhiteLights(ONE_WHITE)).toBe(1);
    expect(countWhiteLights(THREE_RED)).toBe(0);
  });

  it('passes a lift on a majority of white lights', () => {
    expect(isGoodLift(THREE_WHITE)).toBe(true);
    expect(isGoodLift(TWO_WHITE)).toBe(true);
    expect(isGoodLift(ONE_WHITE)).toBe(false);
    expect(isGoodLift(THREE_RED)).toBe(false);
  });

  it('flags split decisions and not unanimous ones', () => {
    expect(isSplitDecision(TWO_WHITE)).toBe(true);
    expect(isSplitDecision(ONE_WHITE)).toBe(true);
    expect(isSplitDecision(THREE_WHITE)).toBe(false);
    expect(isSplitDecision(THREE_RED)).toBe(false);
  });

  it('rejects panels that are not three red/white lights', () => {
    expect(isValidJudgePanel(THREE_WHITE)).toBe(true);
    expect(isValidJudgePanel(['white', 'white'] as unknown as JudgePanel)).toBe(false);
    expect(isValidJudgePanel(['white', 'white', 'white', 'white'] as unknown as JudgePanel)).toBe(false);
    expect(isValidJudgePanel(['white', 'blue', 'white'] as unknown as JudgePanel)).toBe(false);
  });

  it('records the panel on the judged attempt', () => {
    const state = takeAttempt(createMeet(), 200, TWO_WHITE);
    const attempt = judgedAttempt(state, 'squat', 0);
    expect(attempt.status).toBe('good');
    expect(attempt.lights).toEqual(TWO_WHITE);
    expect(attempt.whiteLights).toBe(2);
    expect(attempt.unanimous).toBe(false);
    expect(attempt.weight).toBe(200);
    expect(attempt.attemptNumber).toBe(1);
    expect(attempt.lift).toBe('squat');
  });

  it('copies the panel instead of aliasing the caller’s array', () => {
    // `readonly` is compile-time only. A caller that keeps its own array must
    // not be able to rewrite a judged attempt after the lights are in.
    const callerLights: JudgeLight[] = ['white', 'white', 'white'];
    const declared = unwrap(declareAttempt(createMeet(), { weight: 200 }));
    const state = unwrap(resolveAttempt(declared, { lights: callerLights as unknown as JudgePanel }));

    callerLights[0] = 'red';
    callerLights[1] = 'red';
    callerLights[2] = 'red';

    const attempt = judgedAttempt(state, 'squat', 0);
    expect(attempt.lights).toEqual(['white', 'white', 'white']);
    expect(attempt.lights).not.toBe(callerLights);
    expect(attempt.whiteLights).toBe(3);
    expect(attempt.status).toBe('good');
    expect(state.lifts.squat.best).toBe(200);
  });

  it('rejects a malformed panel at resolve time', () => {
    const declared = unwrap(declareAttempt(createMeet(), { weight: 200 }));
    const error = expectError(resolveAttempt(declared, { lights: ['white', 'red'] as unknown as JudgePanel }));
    expect(error.code).toBe('INVALID_JUDGING_PANEL');
  });
});

// ---------------------------------------------------------------------------
// A clean meet
// ---------------------------------------------------------------------------

describe('a 9-for-9 meet', () => {
  const state = runNineForNine();

  it('finishes with a total', () => {
    expect(isMeetComplete(state)).toBe(true);
    expect(isBombedOut(state)).toBe(false);
    const outcome = meetOutcome(state);
    expect(outcome?.kind).toBe('total');
  });

  it('totals the best successful attempt on each lift', () => {
    // 230 squat + 147.5 bench + 272.5 deadlift
    expect(finalMeetTotal(state)).toBe(650);
    expect(totalOnTheBoard(state)).toBe(650);
    const outcome = meetOutcome(state);
    expect(outcome?.total).toBe(650);
    expect(outcome?.bestByLift).toEqual({ squat: 230, bench: 147.5, deadlift: 272.5 });
    expect(outcome?.bombedLift).toBeNull();
  });

  it('records all nine attempts in order', () => {
    const attempts = allCompletedAttempts(state);
    expect(attempts).toHaveLength(9);
    expect(attempts.map((attempt) => attempt.lift)).toEqual([
      'squat',
      'squat',
      'squat',
      'bench',
      'bench',
      'bench',
      'deadlift',
      'deadlift',
      'deadlift',
    ]);
    expect(attempts.map((attempt) => attempt.attemptNumber)).toEqual([1, 2, 3, 1, 2, 3, 1, 2, 3]);
    expect(attempts.every((attempt) => attempt.status === 'good')).toBe(true);
    expect(meetOutcome(state)?.attempts).toHaveLength(9);
  });

  it('marks every lift complete', () => {
    for (const lift of LIFT_ORDER) {
      expect(state.lifts[lift].status).toBe('complete');
    }
  });

  it('refuses any further action', () => {
    expect(expectError(declareAttempt(state, { weight: 300 })).code).toBe('MEET_COMPLETE');
    expect(expectError(resolveAttempt(state, { lights: THREE_WHITE })).code).toBe('MEET_COMPLETE');
    expect(expectError(passAttempt(state)).code).toBe('MEET_COMPLETE');
  });
});

// ---------------------------------------------------------------------------
// Totals with mixed makes and misses
// ---------------------------------------------------------------------------

describe('total calculation with mixed makes and misses', () => {
  it('uses the best successful attempt per lift and ignores misses', () => {
    let state = createMeet();
    state = takeLift(state, [
      [180, THREE_WHITE], // good
      [190, ONE_WHITE], // missed
      [190, TWO_WHITE], // repeat, good
    ]);
    state = takeLift(state, [
      [100, THREE_WHITE], // good
      [105, THREE_RED], // missed
      [105, ONE_WHITE], // missed again
    ]);
    state = takeLift(state, [
      [220, ONE_WHITE], // missed opener
      [220, THREE_WHITE], // repeat, good
      [230, THREE_RED], // missed
    ]);

    expect(finalMeetTotal(state)).toBe(510);
    expect(meetOutcome(state)?.bestByLift).toEqual({ squat: 190, bench: 100, deadlift: 220 });
    expect(isBombedOut(state)).toBe(false);
  });

  it('keeps the heaviest good lift, not the last one taken', () => {
    // Third attempt missed: best stays at the second attempt's weight.
    const state = takeLift(createMeet(), [
      [200, THREE_WHITE],
      [210, THREE_WHITE],
      [220, THREE_RED],
    ]);
    expect(state.lifts.squat.best).toBe(210);
    expect(bestSuccessfulAttempt(state.lifts.squat)).toBe(210);
    expect(totalOnTheBoard(state)).toBe(210);
  });

  it('takes the heaviest good lift even if the attempts arrive out of order', () => {
    // Hand-built progress: the state machine cannot produce this (weights never
    // go down), but `bestSuccessfulAttempt` must be max-of-successes, not last.
    const progress: LiftProgress = {
      lift: 'squat',
      attempts: [
        { lift: 'squat', attemptNumber: 1, weight: 200, status: 'good', lights: THREE_WHITE, whiteLights: 3, unanimous: true },
        { lift: 'squat', attemptNumber: 2, weight: 190, status: 'good', lights: TWO_WHITE, whiteLights: 2, unanimous: false },
        { lift: 'squat', attemptNumber: 3, weight: 210, status: 'no-lift', lights: THREE_RED, whiteLights: 0, unanimous: true },
      ],
      status: 'complete',
      best: null,
    };
    expect(bestSuccessfulAttempt(progress)).toBe(200);
  });

  it('adds fractional attempts without float drift', () => {
    let state = createMeet();
    state = takeLift(state, [
      [102.5, THREE_WHITE],
      [107.5, THREE_WHITE],
      [112.5, THREE_WHITE],
    ]);
    state = takeLift(state, [
      [62.5, THREE_WHITE],
      [67.5, THREE_WHITE],
      [70, THREE_WHITE],
    ]);
    state = takeLift(state, [
      [132.5, THREE_WHITE],
      [142.5, THREE_WHITE],
      [147.5, THREE_WHITE],
    ]);
    expect(finalMeetTotal(state)).toBe(330);
  });
});

// ---------------------------------------------------------------------------
// Running sum vs official total
// ---------------------------------------------------------------------------

describe('a running sum is never mistaken for a total', () => {
  it('reports in-progress with no total before the meet starts', () => {
    expect(readTotal(createMeet())).toEqual({ kind: 'in-progress', total: null, totalOnTheBoard: 0 });
  });

  it('still has NO total once every lift has a good attempt but the meet is live', () => {
    // The trap: squat and bench are done, the deadlift opener is good, and two
    // deadlift attempts remain. Every lift has a best, so a naive sum looks
    // final. It is not — the lifter can still add 40 kg or bomb the platform.
    let state = takeLift(createMeet(), [
      [200, THREE_WHITE],
      [210, THREE_WHITE],
      [220, THREE_WHITE],
    ]);
    state = takeLift(state, [
      [120, THREE_WHITE],
      [125, THREE_WHITE],
      [130, THREE_WHITE],
    ]);
    state = takeAttempt(state, 250, THREE_WHITE);

    expect(isMeetComplete(state)).toBe(false);
    expect(state.lifts.deadlift.best).toBe(250);

    const reading = readTotal(state);
    expect(reading.kind).toBe('in-progress');
    expect(reading.total).toBeNull();
    expect(reading.totalOnTheBoard).toBe(600);

    expect(finalMeetTotal(state)).toBeNull();
    expect(totalOnTheBoard(state)).toBe(600);

    // ...and the number only becomes a total when the meet is actually over.
    let finished = takeAttempt(state, 260, THREE_WHITE);
    finished = takeAttempt(finished, 270, THREE_RED);
    expect(readTotal(finished)).toEqual({ kind: 'final', total: 610, totalOnTheBoard: 610 });
    expect(finalMeetTotal(finished)).toBe(610);
  });

  it('reports no-total, not a number, for a bomb-out that had lifts on the board', () => {
    let state = takeLift(createMeet(), [
      [200, THREE_WHITE],
      [215, THREE_WHITE],
      [225, THREE_WHITE],
    ]);
    state = takeLift(state, [
      [140, THREE_RED],
      [140, THREE_RED],
      [140, ONE_WHITE],
    ]);

    const reading = readTotal(state);
    expect(reading.kind).toBe('no-total');
    expect(reading.total).toBeNull();
    expect(reading.totalOnTheBoard).toBe(225);
    expect(reading.kind === 'no-total' && reading.bombedLift).toBe('bench');
    expect(finalMeetTotal(state)).toBeNull();
  });

  it('mid-lift, before the deadlift opener, there is no total either', () => {
    let state = takeLift(createMeet(), [
      [200, THREE_WHITE],
      [210, THREE_WHITE],
      [220, THREE_WHITE],
    ]);
    state = takeLift(state, [
      [120, THREE_WHITE],
      [125, THREE_WHITE],
      [130, THREE_WHITE],
    ]);
    expect(readTotal(state).kind).toBe('in-progress');
    expect(finalMeetTotal(state)).toBeNull();
    expect(totalOnTheBoard(state)).toBe(350);
  });
});

// ---------------------------------------------------------------------------
// Bombing out
// ---------------------------------------------------------------------------

describe('bombing out', () => {
  it('ends the meet on three missed squats with no total', () => {
    const state = takeLift(createMeet(), [
      [200, THREE_RED],
      [200, ONE_WHITE],
      [200, THREE_RED],
    ]);

    expect(isMeetComplete(state)).toBe(true);
    expect(isBombedOut(state)).toBe(true);
    expect(finalMeetTotal(state)).toBeNull();
    expect(totalOnTheBoard(state)).toBe(0);

    const outcome = meetOutcome(state);
    expect(outcome?.kind).toBe('bombed-out');
    expect(outcome?.total).toBeNull();
    expect(outcome?.bombedLift).toBe('squat');
    expect(outcome?.bestByLift).toEqual({ squat: null, bench: null, deadlift: null });
    expect(outcome?.attempts).toHaveLength(3);

    expect(state.lifts.squat.status).toBe('bombed');
    expect(state.lifts.bench.status).toBe('not-contested');
    expect(state.lifts.deadlift.status).toBe('not-contested');
    expect(expectError(declareAttempt(state, { weight: 100 })).code).toBe('MEET_COMPLETE');
  });

  it('ends the meet on the bench and banks nothing toward a total', () => {
    let state = takeLift(createMeet(), [
      [200, THREE_WHITE],
      [215, THREE_WHITE],
      [225, THREE_WHITE],
    ]);
    state = takeLift(state, [
      [140, THREE_RED],
      [140, THREE_RED],
      [140, ONE_WHITE],
    ]);

    expect(isBombedOut(state)).toBe(true);
    expect(finalMeetTotal(state)).toBeNull();
    // The squat is on the board for the recap, but there is no total.
    expect(totalOnTheBoard(state)).toBe(225);
    const outcome = meetOutcome(state);
    expect(outcome?.bombedLift).toBe('bench');
    expect(outcome?.totalOnTheBoard).toBe(225);
    expect(outcome?.bestByLift).toEqual({ squat: 225, bench: null, deadlift: null });
    expect(outcome?.attempts).toHaveLength(6);
    expect(state.lifts.squat.status).toBe('complete');
    expect(state.lifts.bench.status).toBe('bombed');
    expect(state.lifts.deadlift.status).toBe('not-contested');
  });

  it('ends the meet on the deadlift with no total despite squat and bench', () => {
    let state = takeLift(createMeet(), [
      [200, THREE_WHITE],
      [215, THREE_WHITE],
      [225, THREE_RED],
    ]);
    state = takeLift(state, [
      [130, THREE_WHITE],
      [140, THREE_RED],
      [140, THREE_RED],
    ]);
    state = takeLift(state, [
      [250, THREE_RED],
      [250, ONE_WHITE],
      [250, THREE_RED],
    ]);

    expect(isBombedOut(state)).toBe(true);
    expect(finalMeetTotal(state)).toBeNull();
    expect(totalOnTheBoard(state)).toBe(345);
    const outcome = meetOutcome(state);
    expect(outcome?.bombedLift).toBe('deadlift');
    expect(outcome?.bestByLift).toEqual({ squat: 215, bench: 130, deadlift: null });
    expect(outcome?.attempts).toHaveLength(9);
    expect(state.lifts.deadlift.status).toBe('bombed');
  });

  it('is distinct from a completed meet, not a total of zero', () => {
    const bombed = takeLift(createMeet(), [
      [200, THREE_RED],
      [200, THREE_RED],
      [200, THREE_RED],
    ]);
    const outcome = meetOutcome(bombed);
    expect(outcome?.kind).toBe('bombed-out');
    expect(outcome?.total).not.toBe(0);
    expect(outcome?.total).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Invariant: attempts never go down within a lift
// ---------------------------------------------------------------------------

describe('the non-decreasing weight invariant', () => {
  it('rejects a lighter attempt after a miss', () => {
    const state = takeAttempt(createMeet(), 200, THREE_RED);
    const error = expectError(declareAttempt(state, { weight: 197.5 }));
    expect(error.code).toBe('WEIGHT_DECREASED');
  });

  it('rejects a lighter attempt after a good lift', () => {
    const state = takeAttempt(createMeet(), 200, THREE_WHITE);
    expect(expectError(declareAttempt(state, { weight: 190 })).code).toBe('WEIGHT_DECREASED');
  });

  it('rejects a drop-down on the third attempt too', () => {
    let state = takeAttempt(createMeet(), 200, THREE_WHITE);
    state = takeAttempt(state, 215, THREE_RED);
    expect(expectError(declareAttempt(state, { weight: 205 })).code).toBe('WEIGHT_DECREASED');
  });

  it('allows repeating the weight after a miss', () => {
    const state = takeAttempt(createMeet(), 200, ONE_WHITE);
    const repeated = unwrap(declareAttempt(state, { weight: 200 }));
    expect(repeated.phase.kind).toBe('attempt-declared');
  });

  it('refuses to repeat a weight after a good lift', () => {
    const state = takeAttempt(createMeet(), 200, THREE_WHITE);
    expect(expectError(declareAttempt(state, { weight: 200 })).code).toBe('REPEAT_AFTER_GOOD_LIFT');
  });

  it('requires at least the minimum increase when going up', () => {
    // Exercised under HALF_KILO rules on purpose. Under DEFAULT_MEET_RULES the
    // declaration grid (2.5) and the minimum increase (2.5) coincide, so 201 is
    // stopped one gate earlier as WEIGHT_NOT_DECLARABLE and this rule can never
    // fire on its own. It becomes reachable exactly when a federation lets a
    // lifter CALL a number smaller than the bar is allowed to MOVE.
    const madeIt = takeAttempt(createMeet(HALF_KILO_DECLARATION_RULES), 200, THREE_WHITE);
    expect(expectError(declareAttempt(madeIt, { weight: 201 })).code).toBe('INSUFFICIENT_INCREASE');
    expect(unwrap(declareAttempt(madeIt, { weight: 202.5 })).phase.kind).toBe('attempt-declared');

    // After a miss the weight may be repeated, but a partial jump is still illegal.
    const missed = takeAttempt(createMeet(HALF_KILO_DECLARATION_RULES), 200, THREE_RED);
    expect(expectError(declareAttempt(missed, { weight: 201 })).code).toBe('INSUFFICIENT_INCREASE');
    expect(unwrap(declareAttempt(missed, { weight: 200 })).phase.kind).toBe('attempt-declared');
    expect(unwrap(declareAttempt(missed, { weight: 202.5 })).phase.kind).toBe('attempt-declared');
  });

  it('under the default rules a sub-minimum jump is refused as a declaration, not as a jump', () => {
    // The distinction the engine must not blur. 201 kg after a good 200 is
    // illegal under DEFAULT_MEET_RULES, but the reason is that 201 is not a
    // legal call — the bar takes it fine.
    const madeIt = takeAttempt(createMeet(), 200, THREE_WHITE);
    expect(expectError(declareAttempt(madeIt, { weight: 201 })).code).toBe('WEIGHT_NOT_DECLARABLE');
    expect(isLoadableAttemptWeight(201, 'squat')).toBe(true);
  });

  it('resets the constraint at the start of each lift', () => {
    const state = takeLift(createMeet(), [
      [250, THREE_WHITE],
      [265, THREE_WHITE],
      [275, THREE_WHITE],
    ]);
    // The bench opener is far lighter than the last squat, which is fine.
    const opener = unwrap(declareAttempt(state, { weight: 100 }));
    expect(opener.phase.kind).toBe('attempt-declared');
  });

  it('is not fooled by a passed attempt in between', () => {
    let state = takeAttempt(createMeet(), 200, THREE_WHITE);
    state = unwrap(passAttempt(state));
    expect(expectError(declareAttempt(state, { weight: 195 })).code).toBe('WEIGHT_DECREASED');
    expect(expectError(declareAttempt(state, { weight: 200 })).code).toBe('REPEAT_AFTER_GOOD_LIFT');
    expect(unwrap(declareAttempt(state, { weight: 202.5 })).phase.kind).toBe('attempt-declared');
  });
});

// ---------------------------------------------------------------------------
// Loadability: the bar has a floor as well as a granularity
// ---------------------------------------------------------------------------

describe('physical loadability vs legal declaration', () => {
  it('takes the loadable increment from the plate pair the retrieved source stocks', () => {
    // OpenLifter's defaultPlatesKg carries `{ weightKg: 0.25, pairCount: 1 }`.
    // One disc per side is 0.5 on the bar, which is what its own comment
    // ("allowing for increments of 0.5kg") says. The default meet stocks change
    // plates; 2.5 would be a claim about equipment that source contradicts.
    expect(SMALLEST_CHANGE_PLATE_KG).toBe(0.25);
    expect(LOADABLE_WEIGHT_INCREMENT_KG).toBe(SMALLEST_CHANGE_PLATE_KG * 2);
    expect(LOADABLE_WEIGHT_INCREMENT_KG).toBe(0.5);
    expect(DEFAULT_MEET_RULES.loadableIncrement).toBe(0.5);
  });

  it('keeps the declaration grid coarser than, and separate from, the plate grid', () => {
    expect(DECLARATION_INCREMENT_KG).toBe(2.5);
    expect(DEFAULT_MEET_RULES.declarationIncrement).toBe(2.5);
    expect(DEFAULT_MEET_RULES.declarationIncrement).toBeGreaterThan(DEFAULT_MEET_RULES.loadableIncrement);
  });

  it('agrees that a competition bar loads to 201 and 200.5 — and still refuses to let them be called', () => {
    // The whole point of the split. These weights are physically fine.
    for (const weight of [200.5, 201, 201.5, 202]) {
      expect(isLoadableAttemptWeight(weight, 'squat')).toBe(true);
      expect(isDeclarableWeight(weight)).toBe(false);
      expect(isLegalAttemptWeight(weight, 'squat')).toBe(false);
    }
    // ...and these are legal on both counts.
    for (const weight of [200, 202.5, 205]) {
      expect(isLoadableAttemptWeight(weight, 'squat')).toBe(true);
      expect(isDeclarableWeight(weight)).toBe(true);
      expect(isLegalAttemptWeight(weight, 'squat')).toBe(true);
    }
  });

  it('refuses a genuinely unloadable weight for a different, true reason', () => {
    // 200.25 is off the 0.5 plate grid: the plates really cannot make it.
    expect(isLoadableAttemptWeight(200.25, 'squat')).toBe(false);
    expect(expectError(declareAttempt(createMeet(), { weight: 200.25 })).code).toBe('WEIGHT_NOT_LOADABLE');
    // 201 is on the plate grid and off the declaration grid.
    expect(expectError(declareAttempt(createMeet(), { weight: 201 })).code).toBe('WEIGHT_NOT_DECLARABLE');
  });

  it('never tells a player that a loadable weight cannot be loaded', () => {
    // The failure this rework exists to kill: the old engine emitted
    // "the plates only load in 2.5 increments; 201 cannot be loaded", which is
    // false at any meet with the retrieved default kit.
    const declarable = expectError(declareAttempt(createMeet(), { weight: 201 }));
    expect(declarable.code).toBe('WEIGHT_NOT_DECLARABLE');
    expect(declarable.message).toContain('declared in steps of 2.5');
    expect(declarable.message).toContain('loads to 201');
    expect(declarable.message).not.toMatch(/cannot be loaded/);

    const unloadable = expectError(declareAttempt(createMeet(), { weight: 200.25 }));
    expect(unloadable.code).toBe('WEIGHT_NOT_LOADABLE');
    expect(unloadable.message).toContain('steps of 0.5');
    expect(unloadable.message).toContain('no way to load');
  });

  it('lets a coarse-plate meet say so, and then the message really is about plates', () => {
    const state = createMeet(COARSE_PLATE_RULES);
    expect(isLoadableAttemptWeight(201, 'squat', COARSE_PLATE_RULES)).toBe(false);
    const error = expectError(declareAttempt(state, { weight: 201 }));
    expect(error.code).toBe('WEIGHT_NOT_LOADABLE');
    expect(error.message).toContain('steps of 2.5');
    expect(unwrap(declareAttempt(state, { weight: 202.5 })).phase.kind).toBe('attempt-declared');
  });

  it('lets a federation that calls attempts on the half-kilo declare that once, for the whole meet', () => {
    // Loading finer discs is NOT what legalises 200.5 — the default meet
    // already stocks them. Declaring on a finer grid is.
    expect(expectError(declareAttempt(createMeet(), { weight: 200.5 })).code).toBe('WEIGHT_NOT_DECLARABLE');

    const state = createMeet(HALF_KILO_DECLARATION_RULES);
    expect(unwrap(declareAttempt(state, { weight: 200.5 })).phase.kind).toBe('attempt-declared');
    // ...and it is still not a way around the floor or the minimum increase.
    expect(expectError(declareAttempt(state, { weight: 24.5 })).code).toBe('WEIGHT_BELOW_BAR');
    const made = takeAttempt(state, 200.5, THREE_WHITE);
    expect(expectError(declareAttempt(made, { weight: 201 })).code).toBe('INSUFFICIENT_INCREASE');
  });

  it('measures loading from the bar and declaration from zero', () => {
    // A 26 kg bar sits on the 0.5 plate grid but not on the 2.5 declaration
    // grid, which pulls the two anchorings apart: 26 is loadable and not
    // callable, so the lightest legal attempt is heavier than the empty bar.
    const oddBar: MeetLoadingRules = {
      ...DEFAULT_MEET_RULES,
      barAndCollarsWeight: { squat: 26, bench: 26, deadlift: 26 },
    };
    expect(validateMeetRules(oddBar)).toBeNull();
    expect(barAndCollarsWeight('squat', oddBar)).toBe(26);
    expect(minimumAttemptWeight('squat', oddBar)).toBe(27.5);

    expect(isLoadableAttemptWeight(26, 'squat', oddBar)).toBe(true);
    expect(isLoadableAttemptWeight(26.5, 'squat', oddBar)).toBe(true);
    expect(isLoadableAttemptWeight(26.25, 'squat', oddBar)).toBe(false);
    expect(isLoadableAttemptWeight(25.5, 'squat', oddBar)).toBe(false); // under the bar
    expect(isLegalAttemptWeight(26, 'squat', oddBar)).toBe(false);
    expect(isLegalAttemptWeight(27.5, 'squat', oddBar)).toBe(true);

    const state = createMeet(oddBar);
    expect(expectError(declareAttempt(state, { weight: 25 })).code).toBe('WEIGHT_BELOW_BAR');
    expect(expectError(declareAttempt(state, { weight: 26.25 })).code).toBe('WEIGHT_NOT_LOADABLE');
    expect(expectError(declareAttempt(state, { weight: 26 })).code).toBe('WEIGHT_NOT_DECLARABLE');
    expect(unwrap(declareAttempt(state, { weight: 27.5 })).phase.kind).toBe('attempt-declared');
  });
});

describe('loadable weights', () => {
  it('builds the minimum from a named bar weight and a named collar weight', () => {
    expect(MIN_LOADABLE_WEIGHT_KG).toBe(COMPETITION_BAR_WEIGHT_KG + COLLAR_PAIR_WEIGHT_KG);
    for (const lift of LIFT_ORDER) {
      expect(barAndCollarsWeight(lift)).toBe(MIN_LOADABLE_WEIGHT_KG);
      // 25 is itself a multiple of 2.5, so the empty bar is a legal call.
      expect(minimumAttemptWeight(lift)).toBe(MIN_LOADABLE_WEIGHT_KG);
    }
  });

  it('rejects an attempt lighter than the bar and collars', () => {
    const state = createMeet();
    for (const weight of [2.5, 5, 20, 22.5]) {
      expect(expectError(declareAttempt(state, { weight })).code).toBe('WEIGHT_BELOW_BAR');
    }
    // The empty loaded bar itself is legal, if absurd.
    expect(unwrap(declareAttempt(state, { weight: MIN_LOADABLE_WEIGHT_KG })).phase.kind).toBe('attempt-declared');
  });

  it('honours a per-lift bar weight', () => {
    const heavySquatBar: MeetLoadingRules = {
      ...DEFAULT_MEET_RULES,
      barAndCollarsWeight: { squat: 30, bench: 25, deadlift: 25 },
    };
    expect(minimumAttemptWeight('squat', heavySquatBar)).toBe(30);
    expect(minimumAttemptWeight('bench', heavySquatBar)).toBe(25);
    const state = createMeet(heavySquatBar);
    expect(expectError(declareAttempt(state, { weight: 27.5 })).code).toBe('WEIGHT_BELOW_BAR');
    expect(unwrap(declareAttempt(state, { weight: 30 })).phase.kind).toBe('attempt-declared');
  });

  it('rounds onto the plate grid or the declaration grid, on request, never below the bar', () => {
    // Plate grid: 0.5 by default, so 201 and 26 are already on it.
    expect(roundToLoadableAttemptWeight(0, 'squat')).toBe(MIN_LOADABLE_WEIGHT_KG);
    expect(roundToLoadableAttemptWeight(10, 'squat')).toBe(MIN_LOADABLE_WEIGHT_KG);
    expect(roundToLoadableAttemptWeight(201, 'squat')).toBe(201);
    expect(roundToLoadableAttemptWeight(200.25, 'squat')).toBe(200.5);
    expect(roundToLoadableAttemptWeight(200.24, 'squat', DEFAULT_MEET_RULES, 'down')).toBe(200);

    // Declaration grid: 2.5, so these land where an attempt card would.
    expect(roundToLegalAttemptWeight(0, 'squat')).toBe(MIN_LOADABLE_WEIGHT_KG);
    expect(roundToLegalAttemptWeight(10, 'squat')).toBe(MIN_LOADABLE_WEIGHT_KG);
    expect(roundToLegalAttemptWeight(26, 'squat', DEFAULT_MEET_RULES, 'down')).toBe(MIN_LOADABLE_WEIGHT_KG);
    expect(roundToLegalAttemptWeight(26, 'squat', DEFAULT_MEET_RULES, 'up')).toBe(27.5);
    expect(roundToLegalAttemptWeight(201, 'squat')).toBe(200);
    expect(roundToLegalAttemptWeight(201, 'squat', DEFAULT_MEET_RULES, 'up')).toBe(202.5);
  });

  it('always rounds to something the engine will actually accept', () => {
    for (const rules of [DEFAULT_MEET_RULES, HALF_KILO_DECLARATION_RULES, COARSE_PLATE_RULES]) {
      for (const target of [0, 24.9, 25, 26, 100.3, 200.25, 201, 337.6]) {
        for (const mode of ['nearest', 'up', 'down'] as const) {
          const rounded = roundToLegalAttemptWeight(target, 'squat', rules, mode);
          expect(isLegalAttemptWeight(rounded, 'squat', rules)).toBe(true);
          expect(declareAttempt(createMeet(rules), { weight: rounded }).ok).toBe(true);
        }
      }
    }
  });

  it('rejects nonsense meet rules loudly instead of skipping the check', () => {
    const broken: MeetLoadingRules = { ...DEFAULT_MEET_RULES, loadableIncrement: 0 };
    expect(validateMeetRules(broken)?.code).toBe('INVALID_MEET_RULES');
    expect(validateMeetRules(DEFAULT_MEET_RULES)).toBeNull();
    expect(validateMeetRules(HALF_KILO_DECLARATION_RULES)).toBeNull();
    expect(validateMeetRules(COARSE_PLATE_RULES)).toBeNull();

    const state = createMeet(broken);
    expect(expectError(declareAttempt(state, { weight: 200 })).code).toBe('INVALID_MEET_RULES');
    expect(expectError(suggestOpener('squat', 200, broken)).code).toBe('INVALID_MEET_RULES');

    const noDeclarationGrid: MeetLoadingRules = { ...DEFAULT_MEET_RULES, declarationIncrement: 0 };
    expect(validateMeetRules(noDeclarationGrid)?.code).toBe('INVALID_MEET_RULES');

    const negativeBar: MeetLoadingRules = {
      ...DEFAULT_MEET_RULES,
      barAndCollarsWeight: { squat: 25, bench: -1, deadlift: 25 },
    };
    expect(validateMeetRules(negativeBar)?.code).toBe('INVALID_MEET_RULES');
  });

  it('refuses rules whose declaration grid the plates cannot reach', () => {
    // Declare on the half-kilo, but stock nothing finer than 1.25 kg discs:
    // every legal call would be unloadable. Fail loudly rather than suggest
    // weights that would then be refused.
    const unreachable: MeetLoadingRules = {
      ...DEFAULT_MEET_RULES,
      declarationIncrement: 0.5,
      loadableIncrement: 2.5,
    };
    const error = validateMeetRules(unreachable);
    expect(error?.code).toBe('INVALID_MEET_RULES');
    expect(error?.message).toContain('would not be loadable');
    expect(expectError(declareAttempt(createMeet(unreachable), { weight: 200 })).code).toBe('INVALID_MEET_RULES');

    // Same failure from the other side: a bar off the plate grid entirely.
    const offGridBar: MeetLoadingRules = {
      ...DEFAULT_MEET_RULES,
      barAndCollarsWeight: { squat: 25.1, bench: 25, deadlift: 25 },
    };
    expect(validateMeetRules(offGridBar)?.code).toBe('INVALID_MEET_RULES');
  });
});

// ---------------------------------------------------------------------------
// The rules are fixed for the whole meet — enforced, not merely asserted
// ---------------------------------------------------------------------------

describe('meet rules are sealed at createMeet', () => {
  it('accepts the rules it sealed itself', () => {
    for (const rules of [DEFAULT_MEET_RULES, HALF_KILO_DECLARATION_RULES, COARSE_PLATE_RULES]) {
      expect(checkMeetRulesSeal(createMeet(rules).rules)).toBeNull();
    }
  });

  it('refuses the spread that used to reopen the escape hatch', () => {
    // This exact expression type-checks in strict mode with no cast. It used to
    // be accepted, which meant "no per-attempt way to relax a rule" was prose
    // rather than an invariant: the hatch had moved up one level, not closed.
    const state = createMeet();
    const relaxed: MeetState = {
      ...state,
      rules: { ...state.rules, declarationIncrement: 0.5, minIncrement: 0.5 },
    };
    const error = expectError(declareAttempt(relaxed, { weight: 200.5 }));
    expect(error.code).toBe('MEET_RULES_TAMPERED');
    expect(checkMeetRulesSeal(relaxed.rules)?.code).toBe('MEET_RULES_TAMPERED');
  });

  it('catches a tampered rule mid-meet, not just at the opener', () => {
    const state = takeAttempt(createMeet(), 200, THREE_WHITE);
    const relaxed: MeetState = { ...state, rules: { ...state.rules, minIncrement: 0.5 } };
    expect(expectError(declareAttempt(relaxed, { weight: 200.5 })).code).toBe('MEET_RULES_TAMPERED');
    // ...and the suggestion path refuses too, so nothing recommends a weight
    // the declaration path would reject.
    expect(expectError(suggestNextAttempt(relaxed, 'conservative')).code).toBe('MEET_RULES_TAMPERED');
  });

  it('notices every rule field, including a swapped bar weight', () => {
    const state = createMeet();
    const fields: readonly MeetState[] = [
      { ...state, rules: { ...state.rules, loadableIncrement: 2.5 } },
      { ...state, rules: { ...state.rules, declarationIncrement: 1 } },
      { ...state, rules: { ...state.rules, minIncrement: 5 } },
      {
        ...state,
        rules: { ...state.rules, barAndCollarsWeight: { squat: 20, bench: 25, deadlift: 25 } },
      },
      {
        ...state,
        rules: { ...state.rules, barAndCollarsWeight: { squat: 25, bench: 20, deadlift: 25 } },
      },
      {
        ...state,
        rules: { ...state.rules, barAndCollarsWeight: { squat: 25, bench: 25, deadlift: 20 } },
      },
    ];
    for (const tampered of fields) {
      expect(checkMeetRulesSeal(tampered.rules)?.code).toBe('MEET_RULES_TAMPERED');
    }
  });

  it('is not satisfied by an arbitrary number in the seal field', () => {
    const state = createMeet();
    const forged: MeetState = {
      ...state,
      rules: { ...state.rules, declarationIncrement: 0.5, seal: 0 as MeetRulesSeal },
    };
    expect(checkMeetRulesSeal(forged.rules)?.code).toBe('MEET_RULES_TAMPERED');
  });

  it('seals deterministically, so an identical meet replays identically', () => {
    expect(createMeet().rules.seal).toBe(createMeet().rules.seal);
    expect(createMeet(HALF_KILO_DECLARATION_RULES).rules.seal).not.toBe(createMeet().rules.seal);
    expect(Number.isFinite(createMeet().rules.seal)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Other rejected transitions
// ---------------------------------------------------------------------------

describe('rejected transitions', () => {
  it('rejects lifting out of order', () => {
    const state = createMeet();
    expect(expectError(declareAttempt(state, { lift: 'bench', weight: 100 })).code).toBe('WRONG_LIFT');
    expect(expectError(declareAttempt(state, { lift: 'deadlift', weight: 200 })).code).toBe('WRONG_LIFT');
    expect(expectError(passAttempt(state, { lift: 'bench' })).code).toBe('WRONG_LIFT');
  });

  it('rejects going back to a finished lift, and calls it what it is', () => {
    const state = takeLift(createMeet(), [
      [200, THREE_WHITE],
      [210, THREE_WHITE],
      [220, THREE_WHITE],
    ]);
    expect(state.phase).toEqual({ kind: 'awaiting-declaration', lift: 'bench', attemptNumber: 1 });
    const error = expectError(declareAttempt(state, { lift: 'squat', weight: 230 }));
    expect(error.code).toBe('TOO_MANY_ATTEMPTS');
  });

  it('never offers a fourth attempt on a lift', () => {
    const state = takeLift(createMeet(), [
      [200, THREE_WHITE],
      [210, THREE_WHITE],
      [220, THREE_WHITE],
    ]);
    expect(state.lifts.squat.attempts).toHaveLength(ATTEMPTS_PER_LIFT);
    expect(state.phase.kind === 'awaiting-declaration' && state.phase.lift).toBe('bench');
  });

  it('rejects a mismatched attempt number', () => {
    const state = createMeet();
    const error = expectError(declareAttempt(state, { attemptNumber: 2, weight: 200 }));
    expect(error.code).toBe('WRONG_ATTEMPT_NUMBER');
  });

  it('rejects declaring twice before the lights come up', () => {
    const declared = unwrap(declareAttempt(createMeet(), { weight: 200 }));
    expect(expectError(declareAttempt(declared, { weight: 205 })).code).toBe('ATTEMPT_ALREADY_DECLARED');
    expect(expectError(passAttempt(declared)).code).toBe('ATTEMPT_ALREADY_DECLARED');
  });

  it('rejects resolving the same attempt twice', () => {
    const declared = unwrap(declareAttempt(createMeet(), { weight: 200 }));
    const resolved = unwrap(resolveAttempt(declared, { lift: 'squat', attemptNumber: 1, lights: THREE_WHITE }));
    const error = expectError(
      resolveAttempt(resolved, { lift: 'squat', attemptNumber: 1, lights: THREE_RED }),
    );
    expect(error.code).toBe('ATTEMPT_ALREADY_RESOLVED');
    // The first decision stands.
    expect(resolved.lifts.squat.best).toBe(200);
  });

  it('rejects resolving when nothing has been declared', () => {
    expect(expectError(resolveAttempt(createMeet(), { lights: THREE_WHITE })).code).toBe('NO_ATTEMPT_DECLARED');
    const resolved = takeAttempt(createMeet(), 200, THREE_WHITE);
    expect(expectError(resolveAttempt(resolved, { lights: THREE_WHITE })).code).toBe('NO_ATTEMPT_DECLARED');
  });

  it('rejects resolving an attempt that is not the one on the platform', () => {
    const declared = unwrap(declareAttempt(createMeet(), { weight: 200 }));
    expect(expectError(resolveAttempt(declared, { lift: 'bench', lights: THREE_WHITE })).code).toBe('WRONG_LIFT');
    expect(expectError(resolveAttempt(declared, { attemptNumber: 3, lights: THREE_WHITE })).code).toBe(
      'WRONG_ATTEMPT_NUMBER',
    );
  });

  it('rejects nonsense weights', () => {
    const state = createMeet();
    for (const weight of [0, -100, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(expectError(declareAttempt(state, { weight })).code).toBe('INVALID_WEIGHT');
    }
  });

  it('rejects weights a lifter may not call, and says which rule refused them', () => {
    const state = createMeet();
    expect(expectError(declareAttempt(state, { weight: 201 })).code).toBe('WEIGHT_NOT_DECLARABLE');
    expect(expectError(declareAttempt(state, { weight: 200.5 })).code).toBe('WEIGHT_NOT_DECLARABLE');
    // Off the plate grid as well as the declaration grid: physics wins, because
    // it is the more concrete truth about the refusal.
    expect(expectError(declareAttempt(state, { weight: 200.25 })).code).toBe('WEIGHT_NOT_LOADABLE');
    expect(unwrap(declareAttempt(state, { weight: 202.5 })).phase.kind).toBe('attempt-declared');
  });
});

// ---------------------------------------------------------------------------
// Record attempts are NOT modelled (see the REMOVED FEATURE note in meet.ts)
// ---------------------------------------------------------------------------

describe('record attempts are a declared non-goal', () => {
  it('has no per-attempt flag that loosens a loading or declaration rule', () => {
    // Compile-time assertions: if either key comes back, this file stops
    // type-checking, which is the point.
    const noFlagOnInput: 'recordAttempt' extends keyof DeclareAttemptInput ? false : true = true;
    const noFlagOnAttempt: 'recordAttempt' extends keyof JudgedAttempt ? false : true = true;
    expect(noFlagOnInput).toBe(true);
    expect(noFlagOnAttempt).toBe(true);
  });

  it('ignores a legacy record flag instead of honouring it', () => {
    // The exact sequence that used to be accepted: 200 good, then 200.5 or 201
    // "because it is a record attempt". Both are illegal for this lifter and
    // both are now refused, flag or no flag — as declarations, since the bar
    // takes either weight without complaint.
    const state = takeAttempt(createMeet(), 200, THREE_WHITE);
    const halfKilo = { weight: 200.5, recordAttempt: true } as unknown as DeclareAttemptInput;
    const oneKilo = { weight: 201, recordAttempt: true } as unknown as DeclareAttemptInput;
    expect(expectError(declareAttempt(state, halfKilo)).code).toBe('WEIGHT_NOT_DECLARABLE');
    expect(expectError(declareAttempt(state, oneKilo)).code).toBe('WEIGHT_NOT_DECLARABLE');
  });

  it('will not let a record flag smuggle an illegal opener onto the platform', () => {
    const opener = { weight: 100.5, recordAttempt: true } as unknown as DeclareAttemptInput;
    expect(expectError(declareAttempt(createMeet(), opener)).code).toBe('WEIGHT_NOT_DECLARABLE');
  });

  it('does not let a record flag shrink the minimum increase either', () => {
    const state = takeAttempt(createMeet(HALF_KILO_DECLARATION_RULES), 200, THREE_WHITE);
    const smallJump = { weight: 200.5, recordAttempt: true } as unknown as DeclareAttemptInput;
    expect(expectError(declareAttempt(state, smallJump)).code).toBe('INSUFFICIENT_INCREASE');
  });

  it('reports the same minimum whatever the caller thinks it is attempting', () => {
    const context = currentAttemptContext(takeAttempt(createMeet(), 200, THREE_WHITE));
    expect(context?.minimumWeight).toBe(200 + MIN_ATTEMPT_INCREMENT_KG);
  });
});

// ---------------------------------------------------------------------------
// Passing attempts
// ---------------------------------------------------------------------------

describe('passing an attempt', () => {
  it('uses up the attempt and moves on', () => {
    let state = takeAttempt(createMeet(), 200, THREE_WHITE);
    state = unwrap(passAttempt(state));
    expect(state.lifts.squat.attempts).toHaveLength(2);
    expect(state.phase).toEqual({ kind: 'awaiting-declaration', lift: 'squat', attemptNumber: 3 });
    const passed = state.lifts.squat.attempts[1];
    expect(passed?.status).toBe('passed');
  });

  it('closes the lift when the last attempt is passed', () => {
    let state = takeAttempt(createMeet(), 200, THREE_WHITE);
    state = takeAttempt(state, 210, THREE_WHITE);
    state = unwrap(passAttempt(state));
    expect(state.lifts.squat.status).toBe('complete');
    expect(state.lifts.squat.best).toBe(210);
    expect(state.phase).toEqual({ kind: 'awaiting-declaration', lift: 'bench', attemptNumber: 1 });
  });

  it('leaves a lifter with no total if every attempt on a lift is passed', () => {
    let state = createMeet();
    for (let i = 0; i < ATTEMPTS_PER_LIFT; i += 1) {
      state = unwrap(passAttempt(state));
    }
    expect(isBombedOut(state)).toBe(true);
    expect(finalMeetTotal(state)).toBeNull();
    expect(meetOutcome(state)?.bombedLift).toBe('squat');
  });

  it('does not count a passed attempt toward the best lift', () => {
    let state = takeAttempt(createMeet(), 200, THREE_WHITE);
    state = unwrap(passAttempt(state));
    expect(bestSuccessfulAttempt(state.lifts.squat)).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Attempt context and selection (GDD §6.3)
// ---------------------------------------------------------------------------

describe('attempt context', () => {
  it('floors the opener at the bar and collars and nothing else', () => {
    const context = currentAttemptContext(createMeet());
    expect(context).toEqual({
      lift: 'squat',
      attemptNumber: 1,
      previousWeight: null,
      previousOutcome: null,
      mayRepeatWeight: false,
      minimumWeight: MIN_LOADABLE_WEIGHT_KG,
      minimumIncreaseWeight: null,
    });
  });

  it('after a good lift, requires a heavier attempt', () => {
    const context = currentAttemptContext(takeAttempt(createMeet(), 200, TWO_WHITE));
    expect(context?.previousOutcome).toBe('good');
    expect(context?.mayRepeatWeight).toBe(false);
    expect(context?.minimumWeight).toBe(200 + MIN_ATTEMPT_INCREMENT_KG);
  });

  it('after a miss, allows the same weight again', () => {
    const context = currentAttemptContext(takeAttempt(createMeet(), 200, ONE_WHITE));
    expect(context?.previousOutcome).toBe('no-lift');
    expect(context?.mayRepeatWeight).toBe(true);
    expect(context?.minimumWeight).toBe(200);
    expect(context?.minimumIncreaseWeight).toBe(200 + MIN_ATTEMPT_INCREMENT_KG);
  });

  it('only ever offers a minimum that is both loadable and declarable', () => {
    // +2.5 off 200 is 202.5: on the plate grid and on the declaration grid.
    for (const rules of [DEFAULT_MEET_RULES, HALF_KILO_DECLARATION_RULES, COARSE_PLATE_RULES]) {
      const state = takeAttempt(createMeet(rules), 200, THREE_WHITE);
      const minimum = currentAttemptContext(state)?.minimumIncreaseWeight ?? 0;
      expect(isLoadableAttemptWeight(minimum, 'squat', rules)).toBe(true);
      expect(isDeclarableWeight(minimum, rules)).toBe(true);
      expect(declareAttempt(state, { weight: minimum }).ok).toBe(true);
    }
  });

  it('rounds the minimum onto the declaration grid, not merely onto the plate grid', () => {
    // minIncrement 1 with a 2.5 declaration grid: 200 + 1 is 201, which the bar
    // can take and a lifter still may not call. The floor must be 202.5.
    const fineJumps: MeetLoadingRules = { ...DEFAULT_MEET_RULES, minIncrement: 1 };
    const state = takeAttempt(createMeet(fineJumps), 200, THREE_WHITE);
    const context = currentAttemptContext(state);
    expect(isLoadableAttemptWeight(201, 'squat', fineJumps)).toBe(true);
    expect(context?.minimumIncreaseWeight).toBe(202.5);
    expect(context?.minimumWeight).toBe(202.5);
    expect(declareAttempt(state, { weight: 202.5 }).ok).toBe(true);
  });

  it('is null while an attempt is on the platform or the meet is over', () => {
    const declared = unwrap(declareAttempt(createMeet(), { weight: 200 }));
    expect(currentAttemptContext(declared)).toBeNull();
    expect(currentAttemptContext(runNineForNine())).toBeNull();
  });
});

describe('attempt selection', () => {
  const STRATEGIES: readonly AttemptStrategy[] = ['repeat', 'conservative', 'standard', 'aggressive'];

  it('has no drop-down strategy, because the bar never goes down within a lift', () => {
    expect(STRATEGIES).not.toContain('drop');
  });

  it('repeats the weight after a miss', () => {
    const state = takeAttempt(createMeet(), 200, THREE_RED);
    expect(unwrap(suggestNextAttempt(state, 'repeat'))).toBe(200);
  });

  it('refuses to repeat after a good lift', () => {
    const state = takeAttempt(createMeet(), 200, THREE_WHITE);
    expect(expectError(suggestNextAttempt(state, 'repeat')).code).toBe('REPEAT_AFTER_GOOD_LIFT');
  });

  it('orders the jumps conservative < standard < aggressive', () => {
    for (const lift of LIFT_ORDER) {
      const fractions = ATTEMPT_JUMP_FRACTION[lift];
      expect(fractions.conservative).toBeLessThan(fractions.standard);
      expect(fractions.standard).toBeLessThan(fractions.aggressive);
      expect(fractions.conservative).toBeGreaterThan(0);
    }
  });

  it('suggests weights that are loadable, declarable, and accepted by the engine', () => {
    for (const rules of [DEFAULT_MEET_RULES, HALF_KILO_DECLARATION_RULES, COARSE_PLATE_RULES]) {
      const afterGood = takeAttempt(createMeet(rules), 200, THREE_WHITE);
      const afterMiss = takeAttempt(createMeet(rules), 200, THREE_RED);
      for (const state of [afterGood, afterMiss]) {
        for (const strategy of STRATEGIES) {
          const suggestion = suggestNextAttempt(state, strategy);
          if (!suggestion.ok) {
            expect(suggestion.error.code).toBe('REPEAT_AFTER_GOOD_LIFT');
            continue;
          }
          expect(isLoadableAttemptWeight(suggestion.value, 'squat', rules)).toBe(true);
          expect(isDeclarableWeight(suggestion.value, rules)).toBe(true);
          expect(declareAttempt(state, { weight: suggestion.value }).ok).toBe(true);
        }
      }
    }
  });

  it('never suggests less than the minimum legal increase', () => {
    const state = takeAttempt(createMeet(), 200, THREE_WHITE);
    const conservative = unwrap(suggestNextAttempt(state, 'conservative'));
    expect(conservative).toBeGreaterThanOrEqual(200 + MIN_ATTEMPT_INCREMENT_KG);
  });

  it('suggests strictly increasing weights across strategies for a heavy squat', () => {
    const state = takeAttempt(createMeet(), 300, THREE_WHITE);
    const conservative = unwrap(suggestNextAttempt(state, 'conservative'));
    const standard = unwrap(suggestNextAttempt(state, 'standard'));
    const aggressive = unwrap(suggestNextAttempt(state, 'aggressive'));
    expect(conservative).toBeLessThan(standard);
    expect(standard).toBeLessThan(aggressive);
  });

  it('clamps a too-small jump up to the minimum legal increase', () => {
    // With half-kilo declarations, a 1.5% conservative bench jump off 100 lands
    // on 101.5 — a legal call at this meet, but not a legal increase. It must
    // be pushed to 102.5.
    let state = takeLift(createMeet(HALF_KILO_DECLARATION_RULES), [
      [200, THREE_WHITE],
      [210, THREE_WHITE],
      [220, THREE_WHITE],
    ]);
    state = takeAttempt(state, 100, THREE_WHITE);
    const conservative = unwrap(suggestNextAttempt(state, 'conservative'));
    expect(100 * (1 + ATTEMPT_JUMP_FRACTION.bench.conservative)).toBeLessThan(100 + MIN_ATTEMPT_INCREMENT_KG);
    expect(conservative).toBe(102.5);
    expect(declareAttempt(state, { weight: conservative }).ok).toBe(true);
  });

  it('will not suggest a next attempt for an opener', () => {
    expect(expectError(suggestNextAttempt(createMeet(), 'standard')).code).toBe('NO_PREVIOUS_ATTEMPT');
  });

  it('will not suggest anything while an attempt is on the platform', () => {
    const declared = unwrap(declareAttempt(createMeet(), { weight: 200 }));
    expect(expectError(suggestNextAttempt(declared, 'standard')).code).toBe('NO_ATTEMPT_DECLARED');
  });
});

describe('opener suggestion', () => {
  it('rounds the configured fraction of a 1RM down to a loadable weight', () => {
    // 250 * 0.9 = 225 exactly.
    expect(unwrap(suggestOpener('squat', 250))).toBe(250 * OPENER_FRACTION_OF_1RM.squat);
    // 247.5 * 0.9 = 222.75 -> 222.5
    expect(unwrap(suggestOpener('squat', 247.5))).toBe(222.5);
  });

  it('produces a weight the engine accepts as an opener', () => {
    for (const lift of LIFT_ORDER) {
      const opener = unwrap(suggestOpener(lift, 180));
      expect(isLoadableAttemptWeight(opener, lift)).toBe(true);
      expect(opener).toBeGreaterThanOrEqual(MIN_LOADABLE_WEIGHT_KG);
    }
    const state = createMeet();
    expect(declareAttempt(state, { weight: unwrap(suggestOpener('squat', 180)) }).ok).toBe(true);
  });

  it('never suggests an unloadable empty bar for a tiny 1RM', () => {
    // 90% of a 25 kg bench is 22.5, which is less than the bar and collars and
    // therefore cannot be put on a platform. The opener is the bar itself.
    for (const oneRepMax of [1, 10, 25]) {
      const opener = unwrap(suggestOpener('bench', oneRepMax));
      expect(opener).toBe(MIN_LOADABLE_WEIGHT_KG);
      expect(declareAttempt(createMeet(), { lift: 'squat', weight: opener }).ok).toBe(true);
    }
  });

  it('rejects a nonsense 1RM', () => {
    expect(expectError(suggestOpener('squat', 0)).code).toBe('INVALID_WEIGHT');
    expect(expectError(suggestOpener('squat', Number.NaN)).code).toBe('INVALID_WEIGHT');
  });
});

// ---------------------------------------------------------------------------
// Rounding helpers
// ---------------------------------------------------------------------------

describe('weight rounding', () => {
  it('snaps to whichever grid the caller names — it has no default of its own', () => {
    // Deliberately has no default increment. The old single-default version is
    // how one grid came to stand in for two.
    expect(roundToIncrement(201, DECLARATION_INCREMENT_KG)).toBe(200);
    expect(roundToIncrement(201.5, DECLARATION_INCREMENT_KG)).toBe(202.5);
    expect(roundToIncrement(202.5, DECLARATION_INCREMENT_KG)).toBe(202.5);
    expect(roundToIncrement(201, LOADABLE_WEIGHT_INCREMENT_KG)).toBe(201);
    expect(roundToIncrement(200.3, LOADABLE_WEIGHT_INCREMENT_KG)).toBe(200.5);
  });

  it('rounds up and down on request without float drift', () => {
    expect(roundToIncrement(201, DECLARATION_INCREMENT_KG, 'up')).toBe(202.5);
    expect(roundToIncrement(201, DECLARATION_INCREMENT_KG, 'down')).toBe(200);
    expect(roundToIncrement(202.5, DECLARATION_INCREMENT_KG, 'up')).toBe(202.5);
    expect(roundToIncrement(202.5, DECLARATION_INCREMENT_KG, 'down')).toBe(202.5);
    expect(roundToIncrement(107.5, DECLARATION_INCREMENT_KG, 'up')).toBe(107.5);
    expect(roundToIncrement(200.5, LOADABLE_WEIGHT_INCREMENT_KG, 'up')).toBe(200.5);
    expect(roundToIncrement(200.4, LOADABLE_WEIGHT_INCREMENT_KG, 'down')).toBe(200);
  });

  it('recognises which grid a weight sits on', () => {
    expect(isOnIncrementGrid(202.5, DECLARATION_INCREMENT_KG)).toBe(true);
    expect(isOnIncrementGrid(200.5, DECLARATION_INCREMENT_KG)).toBe(false);
    expect(isOnIncrementGrid(200.5, LOADABLE_WEIGHT_INCREMENT_KG)).toBe(true);
    expect(isOnIncrementGrid(200.25, LOADABLE_WEIGHT_INCREMENT_KG)).toBe(false);
    expect(isOnIncrementGrid(200.25, SMALLEST_CHANGE_PLATE_KG)).toBe(true);
    expect(isOnIncrementGrid(202.5, 0)).toBe(false);
    expect(isOnIncrementGrid(Number.NaN, DECLARATION_INCREMENT_KG)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Immutability
// ---------------------------------------------------------------------------

describe('immutability', () => {
  it('never mutates the state it is given', () => {
    const start = createMeet();
    const snapshot = JSON.stringify(start);
    const declared = unwrap(declareAttempt(start, { weight: 200 }));
    expect(JSON.stringify(start)).toBe(snapshot);

    const declaredSnapshot = JSON.stringify(declared);
    const resolved = unwrap(resolveAttempt(declared, { lights: THREE_WHITE }));
    expect(JSON.stringify(declared)).toBe(declaredSnapshot);
    expect(resolved).not.toBe(declared);
    expect(start.lifts.squat.attempts).toHaveLength(0);
  });

  it('copies the rules it is given instead of aliasing them', () => {
    const callerRules = {
      barAndCollarsWeight: { squat: 25, bench: 25, deadlift: 25 },
      minIncrement: 2.5,
      loadableIncrement: 2.5,
      declarationIncrement: 2.5,
    };
    const state = createMeet(callerRules);

    callerRules.loadableIncrement = 0.5;
    callerRules.declarationIncrement = 0.5;
    callerRules.barAndCollarsWeight.squat = 5;

    expect(state.rules.loadableIncrement).toBe(2.5);
    expect(state.rules.declarationIncrement).toBe(2.5);
    expect(state.rules.barAndCollarsWeight.squat).toBe(25);
    // This meet stocks nothing finer than 1.25 kg discs, so 200.5 really is
    // unloadable here — unlike at a default meet, where it is merely uncallable.
    expect(expectError(declareAttempt(state, { weight: 200.5 })).code).toBe('WEIGHT_NOT_LOADABLE');
    expect(expectError(declareAttempt(state, { weight: 10 })).code).toBe('WEIGHT_BELOW_BAR');
    // Mutating the caller's object must not invalidate the seal either.
    expect(checkMeetRulesSeal(state.rules)).toBeNull();
  });

  it('replays deterministically — same inputs, same meet', () => {
    const script: readonly (readonly [number, JudgePanel])[] = [
      [200, THREE_WHITE],
      [215, ONE_WHITE],
      [215, TWO_WHITE],
    ];
    const first = takeLift(createMeet(), script);
    const second = takeLift(createMeet(), script);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});

// ---------------------------------------------------------------------------
// Full-card walkthrough — the shape a recap screen consumes
// ---------------------------------------------------------------------------

describe('meet card', () => {
  it('exposes an attempt-by-attempt breakdown for the recap', () => {
    const state = runNineForNine();
    const card = allCompletedAttempts(state).map((attempt) => ({
      lift: attempt.lift,
      attemptNumber: attempt.attemptNumber satisfies AttemptNumber,
      weight: attempt.status === 'passed' ? null : attempt.weight,
      result: attempt.status,
    }));
    expect(card[0]).toEqual({ lift: 'squat', attemptNumber: 1, weight: 200, result: 'good' });
    expect(card[8]).toEqual({ lift: 'deadlift', attemptNumber: 3, weight: 272.5, result: 'good' });
    expect(card).toHaveLength(9);
  });
});
