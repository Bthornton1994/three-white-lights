import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  ATTEMPTS_PER_LIFT,
  ATTEMPT_JUMP_FRACTION,
  DEFAULT_MEET_RULES,
  JUDGES_REQUIRED_FOR_GOOD_LIFT,
  JUDGE_COUNT,
  LIFT_ORDER,
  LOADABLE_WEIGHT_INCREMENT_KG,
  MIN_ATTEMPT_INCREMENT_KG,
  OPENER_FRACTION_OF_1RM,
  RECORD_ATTEMPT_INCREMENT_KG,
  allCompletedAttempts,
  bankedTotal,
  bestSuccessfulAttempt,
  countWhiteLights,
  createMeet,
  currentAttemptContext,
  declareAttempt,
  isBombedOut,
  isGoodLift,
  isLoadableWeight,
  isMeetComplete,
  isSplitDecision,
  isValidJudgePanel,
  meetOutcome,
  meetTotal,
  passAttempt,
  resolveAttempt,
  roundToLoadableWeight,
  suggestNextAttempt,
  suggestOpener,
} from './meet';
import type {
  AttemptNumber,
  AttemptStrategy,
  JudgePanel,
  LiftKind,
  LiftProgress,
  MeetError,
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
    expect(bankedTotal(state)).toBe(0);
    expect(meetTotal(state)).toBeNull();
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
    const attempt = state.lifts.squat.attempts[0];
    expect(attempt).toBeDefined();
    if (attempt === undefined || attempt.status === 'passed') throw new Error('expected a judged attempt');
    expect(attempt.status).toBe('good');
    expect(attempt.lights).toEqual(TWO_WHITE);
    expect(attempt.whiteLights).toBe(2);
    expect(attempt.unanimous).toBe(false);
    expect(attempt.weight).toBe(200);
    expect(attempt.attemptNumber).toBe(1);
    expect(attempt.lift).toBe('squat');
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
    expect(meetTotal(state)).toBe(650);
    expect(bankedTotal(state)).toBe(650);
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

    expect(meetTotal(state)).toBe(510);
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
    expect(bankedTotal(state)).toBe(210);
  });

  it('takes the heaviest good lift even if the attempts arrive out of order', () => {
    // Hand-built progress: the state machine cannot produce this (weights never
    // go down), but `bestSuccessfulAttempt` must be max-of-successes, not last.
    const progress: LiftProgress = {
      lift: 'squat',
      attempts: [
        { lift: 'squat', attemptNumber: 1, weight: 200, recordAttempt: false, status: 'good', lights: THREE_WHITE, whiteLights: 3, unanimous: true },
        { lift: 'squat', attemptNumber: 2, weight: 190, recordAttempt: false, status: 'good', lights: TWO_WHITE, whiteLights: 2, unanimous: false },
        { lift: 'squat', attemptNumber: 3, weight: 210, recordAttempt: false, status: 'no-lift', lights: THREE_RED, whiteLights: 0, unanimous: true },
      ],
      status: 'complete',
      best: null,
    };
    expect(bestSuccessfulAttempt(progress)).toBe(200);
  });

  it('reports no total until the meet is finished', () => {
    const state = takeLift(createMeet(), [
      [200, THREE_WHITE],
      [210, THREE_WHITE],
      [220, THREE_WHITE],
    ]);
    expect(meetTotal(state)).toBeNull();
    expect(bankedTotal(state)).toBe(220);
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
    expect(meetTotal(state)).toBe(330);
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
    expect(meetTotal(state)).toBeNull();
    expect(bankedTotal(state)).toBe(0);

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
    expect(meetTotal(state)).toBeNull();
    // The squat is on the board for the recap, but there is no total.
    expect(bankedTotal(state)).toBe(225);
    const outcome = meetOutcome(state);
    expect(outcome?.bombedLift).toBe('bench');
    expect(outcome?.bankedTotal).toBe(225);
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
    expect(meetTotal(state)).toBeNull();
    expect(bankedTotal(state)).toBe(345);
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
    const rules = { ...DEFAULT_MEET_RULES, loadableIncrement: 0.5 };
    // After a good lift: anything under +2.5 is not a legal jump.
    const madeIt = takeAttempt(createMeet(rules), 200, THREE_WHITE);
    expect(expectError(declareAttempt(madeIt, { weight: 201 })).code).toBe('INSUFFICIENT_INCREASE');
    expect(unwrap(declareAttempt(madeIt, { weight: 202.5 })).phase.kind).toBe('attempt-declared');

    // After a miss the weight may be repeated, but a partial jump is still illegal.
    const missed = takeAttempt(createMeet(rules), 200, THREE_RED);
    expect(expectError(declareAttempt(missed, { weight: 201 })).code).toBe('INSUFFICIENT_INCREASE');
    expect(unwrap(declareAttempt(missed, { weight: 200 })).phase.kind).toBe('attempt-declared');
    expect(unwrap(declareAttempt(missed, { weight: 202.5 })).phase.kind).toBe('attempt-declared');
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

  it('rejects weights the bar cannot be loaded to', () => {
    const state = createMeet();
    expect(expectError(declareAttempt(state, { weight: 201 })).code).toBe('WEIGHT_NOT_LOADABLE');
    expect(expectError(declareAttempt(state, { weight: 200.5 })).code).toBe('WEIGHT_NOT_LOADABLE');
    expect(unwrap(declareAttempt(state, { weight: 202.5 })).phase.kind).toBe('attempt-declared');
  });

  it('can have loadable-weight enforcement turned off for other federations', () => {
    const state = createMeet({ ...DEFAULT_MEET_RULES, enforceLoadableIncrement: false });
    expect(unwrap(declareAttempt(state, { weight: 201 })).phase.kind).toBe('attempt-declared');
  });
});

// ---------------------------------------------------------------------------
// Record attempts
// ---------------------------------------------------------------------------

describe('record attempts', () => {
  it('allows the finer record increment above a good lift', () => {
    const state = takeAttempt(createMeet(), 200, THREE_WHITE);
    expect(expectError(declareAttempt(state, { weight: 200.5 })).code).toBe('WEIGHT_NOT_LOADABLE');
    const record = unwrap(declareAttempt(state, { weight: 200.5, recordAttempt: true }));
    expect(record.phase.kind).toBe('attempt-declared');
    const judged = unwrap(resolveAttempt(record, { lights: TWO_WHITE }));
    expect(judged.lifts.squat.best).toBe(200.5);
    const attempt = judged.lifts.squat.attempts[1];
    if (attempt === undefined || attempt.status === 'passed') throw new Error('expected a judged attempt');
    expect(attempt.recordAttempt).toBe(true);
  });

  it('still refuses to go down on a record attempt', () => {
    const state = takeAttempt(createMeet(), 200, THREE_WHITE);
    expect(expectError(declareAttempt(state, { weight: 199.5, recordAttempt: true })).code).toBe('WEIGHT_DECREASED');
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
    expect(meetTotal(state)).toBeNull();
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
  it('leaves the opener unconstrained', () => {
    const context = currentAttemptContext(createMeet());
    expect(context).toEqual({
      lift: 'squat',
      attemptNumber: 1,
      previousWeight: null,
      previousOutcome: null,
      mayRepeatWeight: false,
      minimumWeight: null,
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

  it('uses the record increment when a record attempt is planned', () => {
    const context = currentAttemptContext(takeAttempt(createMeet(), 200, THREE_WHITE), { recordAttempt: true });
    expect(context?.minimumWeight).toBe(200 + RECORD_ATTEMPT_INCREMENT_KG);
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

  it('suggests legal, loadable weights the engine will accept', () => {
    const afterGood = takeAttempt(createMeet(), 200, THREE_WHITE);
    const afterMiss = takeAttempt(createMeet(), 200, THREE_RED);
    for (const state of [afterGood, afterMiss]) {
      for (const strategy of STRATEGIES) {
        const suggestion = suggestNextAttempt(state, strategy);
        if (!suggestion.ok) {
          expect(suggestion.error.code).toBe('REPEAT_AFTER_GOOD_LIFT');
          continue;
        }
        expect(isLoadableWeight(suggestion.value, LOADABLE_WEIGHT_INCREMENT_KG)).toBe(true);
        expect(declareAttempt(state, { weight: suggestion.value }).ok).toBe(true);
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
    // With half-kilo loading, a 1.5% conservative bench jump off 100 lands on
    // 101.5, which is not a legal increase. It must be pushed to 102.5.
    const rules = { ...DEFAULT_MEET_RULES, loadableIncrement: 0.5 };
    let state = takeLift(createMeet(rules), [
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
      expect(isLoadableWeight(opener)).toBe(true);
      expect(opener).toBeGreaterThan(0);
    }
    const state = createMeet();
    expect(declareAttempt(state, { weight: unwrap(suggestOpener('squat', 180)) }).ok).toBe(true);
  });

  it('never suggests an unloadable empty bar for a tiny 1RM', () => {
    const opener = unwrap(suggestOpener('bench', 1));
    expect(opener).toBe(LOADABLE_WEIGHT_INCREMENT_KG);
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
  it('snaps to the nearest loadable increment by default', () => {
    expect(roundToLoadableWeight(201)).toBe(200);
    expect(roundToLoadableWeight(201.5)).toBe(202.5);
    expect(roundToLoadableWeight(202.5)).toBe(202.5);
  });

  it('rounds up and down on request without float drift', () => {
    expect(roundToLoadableWeight(201, LOADABLE_WEIGHT_INCREMENT_KG, 'up')).toBe(202.5);
    expect(roundToLoadableWeight(201, LOADABLE_WEIGHT_INCREMENT_KG, 'down')).toBe(200);
    expect(roundToLoadableWeight(202.5, LOADABLE_WEIGHT_INCREMENT_KG, 'up')).toBe(202.5);
    expect(roundToLoadableWeight(202.5, LOADABLE_WEIGHT_INCREMENT_KG, 'down')).toBe(202.5);
    expect(roundToLoadableWeight(107.5, LOADABLE_WEIGHT_INCREMENT_KG, 'up')).toBe(107.5);
  });

  it('recognises loadable weights', () => {
    expect(isLoadableWeight(202.5)).toBe(true);
    expect(isLoadableWeight(200.5)).toBe(false);
    expect(isLoadableWeight(200.5, RECORD_ATTEMPT_INCREMENT_KG)).toBe(true);
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
