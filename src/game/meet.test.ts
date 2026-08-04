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
  MIN_ATTEMPT_INCREMENT_KG,
  MIN_LOADABLE_WEIGHT_KG,
  NEAREST_CALL_PROBE_STEPS,
  OPENER_FRACTION_OF_1RM,
  POUND_BAR_AND_COLLARS_LB,
  POUND_DECLARATION_INCREMENT_LB,
  POUND_MEET_RULES,
  POUND_MIN_ATTEMPT_INCREMENT_LB,
  allCompletedAttempts,
  barAndCollarsWeight,
  bestSuccessfulAttempt,
  countWhiteLights,
  createMeet,
  currentAttemptContext,
  declareAttempt,
  finalMeetTotal,
  isBombedOut,
  isCallableWeightIgnoringTheCard,
  isCallableWeightNow,
  isDeclarableWeight,
  isGoodLift,
  isMeetComplete,
  isOnIncrementGrid,
  isSplitDecision,
  isValidJudgePanel,
  lightestCallableWeightIgnoringTheCard,
  meetLoadingRules,
  meetOutcome,
  nearestCallableWeightsNow,
  passAttempt,
  readTotal,
  resolveAttempt,
  roundToCallableWeightIgnoringTheCard,
  roundToIncrement,
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
  MeetRules,
  MeetState,
  NearestCallableWeights,
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
 * A federation that calls attempts in 5s and requires 5 between attempts. Its
 * declaration grid does not divide the default one, which is the point: it is
 * here so the rule-set loops below are not all multiples of one another.
 */
const COARSE_DECLARATION_RULES: MeetLoadingRules = {
  ...DEFAULT_MEET_RULES,
  minIncrement: 5,
  declarationIncrement: 5,
};

/** The four shapes of rule set the suite sweeps over. */
const ALL_RULE_SETS: readonly MeetLoadingRules[] = [
  DEFAULT_MEET_RULES,
  HALF_KILO_DECLARATION_RULES,
  COARSE_DECLARATION_RULES,
  POUND_MEET_RULES,
];

// ---------------------------------------------------------------------------
// A REAL plate ladder, as an oracle. The engine does not model plate inventory
// (see WHY THERE IS NO PLATE GATE in meet.ts) — these tests do, so that they can
// check the engine never contradicts one.
//
// Transcribed from `defaultPlatesLbs` in the file meet.ts cites,
// gitlab.com/openpowerlifting/openlifter `src/reducers/meetReducer.ts`, fetched
// HTTP 200 and read directly. Entries are [disc weight in lb, pairCount], in
// source order. The array is introduced by the comment
// `// Default lbs plates, allowing for increments of 1lb.`
// ---------------------------------------------------------------------------

const OPENLIFTER_LB_PLATES: readonly (readonly [number, number])[] = [
  [100, 0],
  [55, 0],
  [45, 8],
  [35, 0],
  [25, 1],
  [10, 2],
  [5, 1],
  [2.5, 1],
  [1.25, 1],
  [0.5, 2],
];

/** The same for kg, from `defaultPlatesKg` in that file. */
const OPENLIFTER_KG_PLATES: readonly (readonly [number, number])[] = [
  [50, 0],
  [25, 8],
  [20, 1],
  [15, 1],
  [10, 1],
  [5, 1],
  [2.5, 1],
  [2, 0],
  [1.5, 0],
  [1.25, 1],
  [1, 1],
  [0.75, 1],
  [0.5, 1],
  [0.25, 1],
];

/** Scale to hundredths so the subset sums are exact integer arithmetic. */
const PLATE_SCALE = 100;

/**
 * Every load the kit can actually put on the bar, above the bar, by brute-force
 * subset sum over the available PAIRS. This is the truth the engine is measured
 * against; it is deliberately dumb and deliberately not in the module.
 */
function loadsAboveBar(kit: readonly (readonly [number, number])[]): ReadonlySet<number> {
  const pairSteps: number[] = [];
  for (const [disc, pairCount] of kit) {
    for (let i = 0; i < pairCount; i += 1) pairSteps.push(Math.round(disc * 2 * PLATE_SCALE));
  }
  let reachable = new Set<number>([0]);
  for (const step of pairSteps) {
    const next = new Set<number>(reachable);
    for (const value of reachable) next.add(value + step);
    reachable = next;
  }
  return reachable;
}

const LB_LOADS = loadsAboveBar(OPENLIFTER_LB_PLATES);
const KG_LOADS = loadsAboveBar(OPENLIFTER_KG_PLATES);

function isLoadableInReality(loads: ReadonlySet<number>, bar: number, weight: number): boolean {
  return loads.has(Math.round((weight - bar) * PLATE_SCALE));
}

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
    // The retrieved plate arrays are what killed the plate gate, and the module
    // must quote them rather than paraphrase.
    expect(source).toMatch(/defaultPlatesKg/);
    expect(source).toMatch(/defaultPlatesLbs/);
    expect(source).toMatch(/allowing for increments of 0\.5kg/);
    expect(source).toMatch(/allowing for increments of 1lb/);
    expect(source).toMatch(/asNumber % 2\.5 !== 0/);
    // ...and the things it cannot source must be marked UNCITED, including the
    // minimum increase, which was adjudicated rather than retrieved.
    expect(source).toMatch(/UNCITED/);
    expect(source).toMatch(/adjudicat/i);
  });

  it('says out loud that it does not model plate inventory, rather than implying it does', () => {
    expect(source).toMatch(/WHY THERE IS NO PLATE GATE/);
    // The disclosure has to run in BOTH directions: a limit stated only one way
    // reads as an oversight in the other.
    expect(source).toMatch(/OVER-PERMISSIVE/);
    expect(source).toMatch(/UNDER-PERMISSIVE/);
  });

  it('builds every sentence that names a legal call in exactly one function', () => {
    // The fourth send-back was a second place that named legal calls, computed
    // from the two weight gates instead of from the meet. One builder means one
    // thing to keep true, and `nearestCallHint` verifies what it names through
    // the same gate chain `declareAttempt` decides with.
    const codeLines = source.split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line));
    const naming = codeLines.filter((line) => line.includes('legal call'));
    expect(naming.length).toBeGreaterThan(0);

    const start = source.indexOf('function nearestCallHint(');
    expect(start).toBeGreaterThan(0);
    const end = source.indexOf('\n}', start);
    const body = source.slice(start, end);
    for (const line of naming) {
      expect(body).toContain(line.trim());
    }
  });

  it('interpolates no message claiming a weight cannot be loaded', () => {
    // The module has no plate inventory, so any sentence of this shape is a
    // fabrication. Prose ABOUT the removed claim is fine and is why this looks
    // for the interpolation rather than the words: a real message would have to
    // name the weight. (The steering sentence is checked behaviourally in
    // "a hint never names a weight the engine then refuses".)
    expect(source).not.toMatch(/no way to load \$\{/);
    expect(source).not.toMatch(/cannot be loaded[^\n]*\$\{/);
    expect(source).not.toMatch(/\$\{[^}]*\} cannot be loaded/);
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
    expect(readTotal(createMeet())).toEqual({
      kind: 'in-progress',
      total: null,
      totalOnTheBoard: 0,
      unit: 'kg',
    });
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
    expect(readTotal(finished)).toEqual({
      kind: 'final',
      total: 610,
      totalOnTheBoard: 610,
      unit: 'kg',
    });
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
    // illegal under DEFAULT_MEET_RULES, and the reason is that 201 is not a
    // legal call — not anything about the bar, which really does take it.
    const madeIt = takeAttempt(createMeet(), 200, THREE_WHITE);
    const error = expectError(declareAttempt(madeIt, { weight: 201 }));
    expect(error.code).toBe('WEIGHT_NOT_DECLARABLE');
    expect(isLoadableInReality(KG_LOADS, MIN_LOADABLE_WEIGHT_KG, 201)).toBe(true);
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
// Real plate ladders are not lattices, and the engine must not pretend they are
// ---------------------------------------------------------------------------

describe('the plate ladder the engine refuses to model', () => {
  it('confirms the retrieved lb kit is not generated by its smallest pair', () => {
    // This is the fact that removed the plate gate. The kit stocks 0.5, 1.25 and
    // 2.5 lb discs at once, so:
    //   - its smallest PAIR step is 1 lb (two 0.5s), and
    //   - 2.5 lb is loadable anyway, with one 1.25 per side, though 2.5 is not a
    //     multiple of 1; while
    //   - 3 lb, which IS a multiple of 1, is not loadable at all, because the
    //     kit holds only two 0.5 lb pairs.
    // No single increment generates this set — not 1, not 2.5, not 0.5.
    expect(isLoadableInReality(LB_LOADS, 0, 1)).toBe(true);
    expect(isLoadableInReality(LB_LOADS, 0, 2.5)).toBe(true);
    expect(isOnIncrementGrid(2.5, 1)).toBe(false);
    expect(isLoadableInReality(LB_LOADS, 0, 3)).toBe(false);
    expect(isOnIncrementGrid(3, 1)).toBe(true);
    expect(isLoadableInReality(LB_LOADS, 0, 4)).toBe(false);
    // The source comment "allowing for increments of 1lb" is therefore loose in
    // its own terms; the kit is 1 lb granular only for the first 2 lb.
  });

  it('loads 47.5 lb on a 45 lb bar, and the engine does not contradict that', () => {
    // The concrete regression. One 1.25 lb disc per side. The previous version
    // computed 47.5 - 45 = 2.5, found it off the 1 lb grid, and answered
    // WEIGHT_NOT_LOADABLE — "there is no way to load 47.5" — which is false.
    expect(isLoadableInReality(LB_LOADS, POUND_BAR_AND_COLLARS_LB, 47.5)).toBe(true);
    expect(isCallableWeightIgnoringTheCard(47.5, 'squat', POUND_MEET_RULES)).toBe(true);
    expect(unwrap(declareAttempt(createMeet(POUND_MEET_RULES), { weight: 47.5 })).phase.kind).toBe(
      'attempt-declared',
    );
  });

  it('runs the pound meet its own source describes, which the previous version rejected', () => {
    // bar and collars 45, declarations on 2.5. The old validator refused this
    // configuration outright because 2.5 is not a whole number of the kit's 1 lb
    // smallest pair step, so a pound meet could not be run at all.
    expect(POUND_BAR_AND_COLLARS_LB).toBe(45);
    expect(POUND_DECLARATION_INCREMENT_LB).toBe(2.5);
    expect(POUND_MIN_ATTEMPT_INCREMENT_LB).toBe(2.5);
    expect(validateMeetRules(POUND_MEET_RULES)).toBeNull();

    const state = takeLift(createMeet(POUND_MEET_RULES), [
      [405, THREE_WHITE],
      [425, THREE_WHITE],
      [442.5, THREE_WHITE],
    ]);
    expect(state.lifts.squat.best).toBe(442.5);
    expect(state.phase).toEqual({ kind: 'awaiting-declaration', lift: 'bench', attemptNumber: 1 });
  });

  it('never refuses a weight the retrieved lb kit really loads, for an equipment reason', () => {
    // Sweep every load the kit can actually make. The engine may refuse a weight
    // as a RULE (off the declaration grid), but no refusal may be, or read as, a
    // claim that the plates cannot make it.
    const state = createMeet(POUND_MEET_RULES);
    let refusedAsRule = 0;
    let accepted = 0;
    for (const scaledLoad of LB_LOADS) {
      const weight = POUND_BAR_AND_COLLARS_LB + scaledLoad / PLATE_SCALE;
      const result = declareAttempt(state, { weight });
      if (result.ok) {
        accepted += 1;
        continue;
      }
      expect(result.error.code).toBe('WEIGHT_NOT_DECLARABLE');
      expect(result.error.message).not.toMatch(/load/i);
      expect(result.error.message).not.toMatch(/plate/i);
      refusedAsRule += 1;
    }
    // Both branches are genuinely exercised: the kit makes weights off the 2.5
    // grid (e.g. 46, a pair of 0.5s) as well as on it.
    expect(accepted).toBeGreaterThan(0);
    expect(refusedAsRule).toBeGreaterThan(0);
    expect(accepted + refusedAsRule).toBe(LB_LOADS.size);
  });

  it('never refuses a weight the retrieved kg kit really loads, for an equipment reason', () => {
    const state = createMeet();
    for (const scaledLoad of KG_LOADS) {
      const weight = MIN_LOADABLE_WEIGHT_KG + scaledLoad / PLATE_SCALE;
      const result = declareAttempt(state, { weight });
      if (result.ok) continue;
      expect(result.error.code).toBe('WEIGHT_NOT_DECLARABLE');
      expect(result.error.message).not.toMatch(/load/i);
    }
  });

  it('accepts every declaration-grid weight both retrieved kits can load', () => {
    // The other half: within each kit's capacity the declaration grid is fully
    // loadable, so declaration-only validation costs nothing real here. This is
    // the measurement behind the density claim in the module header.
    for (const [loads, bar, step, rules] of [
      [KG_LOADS, MIN_LOADABLE_WEIGHT_KG, DECLARATION_INCREMENT_KG, DEFAULT_MEET_RULES],
      [LB_LOADS, POUND_BAR_AND_COLLARS_LB, POUND_DECLARATION_INCREMENT_LB, POUND_MEET_RULES],
    ] as const) {
      const capacity = bar + Math.max(...loads) / PLATE_SCALE;
      for (let weight = bar; weight <= capacity; weight += step) {
        if (!isLoadableInReality(loads, bar, weight)) {
          throw new Error(`${weight} is on the declaration grid but the kit cannot load it`);
        }
        expect(isCallableWeightIgnoringTheCard(weight, 'squat', rules)).toBe(true);
      }
    }
  });

  it('is over-permissive past the kit, and that is the disclosed cost', () => {
    // The honest other side of dropping the gate. With only 45 lb discs on hand
    // there is no way to make 47.5, and the engine accepts it regardless: it has
    // no inventory and does not pretend to. Documented under OVER-PERMISSIVE in
    // the module header.
    const fortyFivesOnly: readonly (readonly [number, number])[] = [[45, 8]];
    expect(isLoadableInReality(loadsAboveBar(fortyFivesOnly), POUND_BAR_AND_COLLARS_LB, 47.5)).toBe(false);
    expect(declareAttempt(createMeet(POUND_MEET_RULES), { weight: 47.5 }).ok).toBe(true);

    // Same story past the real kit's capacity: 875 lb is on the grid and beyond
    // what the eight pairs of 45s can reach.
    expect(isLoadableInReality(LB_LOADS, POUND_BAR_AND_COLLARS_LB, 875)).toBe(false);
    expect(declareAttempt(createMeet(POUND_MEET_RULES), { weight: 875 }).ok).toBe(true);
  });
});

describe('legal declaration, with no opinion on plates', () => {
  it('keeps a declaration grid that is a rule about numbers, not about discs', () => {
    expect(DECLARATION_INCREMENT_KG).toBe(2.5);
    expect(DEFAULT_MEET_RULES.declarationIncrement).toBe(2.5);
    // The rules object carries no plate field at all. If one comes back, this
    // file stops type-checking, which is the point.
    const noPlateField: 'loadableIncrement' extends keyof MeetLoadingRules ? false : true = true;
    expect(noPlateField).toBe(true);
  });

  it('refuses 201 and 200.5 as calls, making no claim about the bar either way', () => {
    for (const weight of [200.5, 201, 201.5, 202]) {
      expect(isDeclarableWeight(weight)).toBe(false);
      expect(isCallableWeightIgnoringTheCard(weight, 'squat')).toBe(false);
    }
    for (const weight of [200, 202.5, 205]) {
      expect(isDeclarableWeight(weight)).toBe(true);
      expect(isCallableWeightIgnoringTheCard(weight, 'squat')).toBe(true);
    }
  });

  it('names the rule that refused, and points at legal calls instead of at the plates', () => {
    // The failure this line of reworks exists to kill, in both its forms: the
    // engine emitted "there is no way to load 201" (false — a competition kit
    // loads it), and then "there is no way to load 47.5" (false for the same
    // reason). It now says only what it knows.
    const opener = createMeet();
    const error = expectError(declareAttempt(opener, { weight: 201 }));
    expect(error.code).toBe('WEIGHT_NOT_DECLARABLE');
    expect(error.message).toContain('declared in steps of 2.5');
    expect(error.message).toContain('The nearest legal calls right now are 200 and 202.5.');
    expect(error.message).not.toMatch(/load/i);
    expect(error.message).not.toMatch(/plate/i);
    // On an opener both named weights really are declarable. That is the case
    // the old state-blind hint got right by accident — see the send-back suite
    // "a hint never names a weight the engine then refuses" for the eight
    // attempts of a meet where it did not.
    expect(declareAttempt(opener, { weight: 200 }).ok).toBe(true);
    expect(declareAttempt(opener, { weight: 202.5 }).ok).toBe(true);

    // Weights off every grid are refused the same way, because there is only one
    // grid left to be off.
    const finer = expectError(declareAttempt(createMeet(), { weight: 200.25 }));
    expect(finer.code).toBe('WEIGHT_NOT_DECLARABLE');
    expect(finer.message).not.toMatch(/load/i);
  });

  it('lets a federation that calls attempts on the half-kilo declare that once, for the whole meet', () => {
    expect(expectError(declareAttempt(createMeet(), { weight: 200.5 })).code).toBe('WEIGHT_NOT_DECLARABLE');

    const state = createMeet(HALF_KILO_DECLARATION_RULES);
    expect(unwrap(declareAttempt(state, { weight: 200.5 })).phase.kind).toBe('attempt-declared');
    // ...and it is still not a way around the floor or the minimum increase.
    expect(expectError(declareAttempt(state, { weight: 24.5 })).code).toBe('WEIGHT_BELOW_BAR');
    const made = takeAttempt(state, 200.5, THREE_WHITE);
    expect(expectError(declareAttempt(made, { weight: 201 })).code).toBe('INSUFFICIENT_INCREASE');
  });

  it('floors at the bar and grids from zero, so the lightest call can be heavier than the bar', () => {
    // A 26 kg bar is off the 2.5 declaration grid, which pulls the two
    // anchorings apart: the lightest legal call is 27.5, not the empty bar.
    const oddBar: MeetLoadingRules = {
      ...DEFAULT_MEET_RULES,
      barAndCollarsWeight: { squat: 26, bench: 26, deadlift: 26 },
    };
    expect(validateMeetRules(oddBar)).toBeNull();
    expect(barAndCollarsWeight('squat', oddBar)).toBe(26);
    expect(lightestCallableWeightIgnoringTheCard('squat', oddBar)).toBe(27.5);
    expect(isCallableWeightIgnoringTheCard(26, 'squat', oddBar)).toBe(false);
    expect(isCallableWeightIgnoringTheCard(25.5, 'squat', oddBar)).toBe(false); // under the bar
    expect(isCallableWeightIgnoringTheCard(27.5, 'squat', oddBar)).toBe(true);

    const state = createMeet(oddBar);
    expect(expectError(declareAttempt(state, { weight: 25 })).code).toBe('WEIGHT_BELOW_BAR');
    const uncallable = expectError(declareAttempt(state, { weight: 26 }));
    expect(uncallable.code).toBe('WEIGHT_NOT_DECLARABLE');
    // The hint collapses to one number when the weight sits under the floor:
    // 25 is on the grid but under this bar, so there is nothing legal below 26.
    expect(uncallable.message).toContain('The lightest legal call right now is 27.5.');
    expect(nearestCallableWeightsNow(state, 26)).toEqual({ below: null, above: 27.5 });
    expect(unwrap(declareAttempt(state, { weight: 27.5 })).phase.kind).toBe('attempt-declared');
  });
});

// ---------------------------------------------------------------------------
// A hint never names a weight the engine then refuses
//
// The fourth send-back. `nearestLegalCallsHint` was computed from the two weight
// gates alone, so for the eight non-opener attempts of a meet it steered players
// to weights `declareAttempt` refused on the very next call:
//
//   after a good 200:  "declare 201" -> "the nearest legal calls are 200 and
//                      202.5", while 200 is REPEAT_AFTER_GOOD_LIFT;
//                      "declare 199" -> "197.5 and 200", both illegal.
//
// The old suite could not catch it: every hint assertion ran on a fresh
// createMeet(), where no progression constraint exists and the hint is true by
// accident. Everything below starts from a NON-OPENER state.
// ---------------------------------------------------------------------------

/**
 * Every sentence shape the engine may use to name a weight as a legal call.
 * A message that says "legal call" and matches none of these is an unaudited
 * claim, and `namedLegalCalls` fails rather than passing it over.
 */
const HINT_BOTH_SIDES = /The nearest legal calls right now are ([\d.]+) and ([\d.]+)\./;
const HINT_LIGHTEST = /The lightest legal call right now is ([\d.]+)\./;
const HINT_SINGLE = /(?:^| )([\d.]+) is a legal call right now\./;
const CALL_HINT_PATTERNS: readonly RegExp[] = [HINT_BOTH_SIDES, HINT_LIGHTEST, HINT_SINGLE];

/** The weights a message offers as legal calls, or [] if it offers none. */
function namedLegalCalls(message: string): readonly number[] {
  const found: number[] = [];
  for (const pattern of CALL_HINT_PATTERNS) {
    const match = pattern.exec(message);
    if (match === null) continue;
    for (const group of match.slice(1)) found.push(Number(group));
  }
  if (found.length === 0 && /legal calls?/.test(message)) {
    throw new Error(`message names legal calls in a shape this suite does not audit: ${message}`);
  }
  return found;
}

/**
 * Ceiling on the brute-force scan below. Only a test-harness guard: a hint that
 * names a wild weight must fail this suite in seconds rather than appear to hang
 * it, which is how the state-blind hint behaved when it was mutated back in to
 * check that these tests catch it.
 */
const GRID_SCAN_MAX_STEPS = 4000;

/**
 * Every weight on this meet's declaration grid in [low, high] the engine will
 * accept right now. Deliberately brute force: it is the oracle the hint is
 * measured against, so it must not share the hint's reasoning.
 */
function callableGridWeights(state: MeetState, low: number, high: number): readonly number[] {
  const increment = meetLoadingRules(state).declarationIncrement;
  const first = Math.ceil(low / increment - 1e-9);
  const found: number[] = [];
  for (let step = first; step * increment <= high + 1e-9; step += 1) {
    if (step - first > GRID_SCAN_MAX_STEPS) {
      throw new Error(`refusing to scan more than ${GRID_SCAN_MAX_STEPS} grid steps from ${low} to ${high}`);
    }
    const weight = Number((step * increment).toFixed(3));
    if (isCallableWeightNow(state, weight)) found.push(weight);
  }
  return found;
}

/**
 * The assertion this whole rework exists for: every weight the message offers as
 * a legal call is one `declareAttempt` accepts FROM THIS EXACT STATE, and the
 * "nearest"/"lightest" claims are true against a brute-force scan of the grid.
 */
function expectHintTellsTheTruth(state: MeetState, typed: number, message: string): void {
  const named = namedLegalCalls(message);
  for (const weight of named) {
    expect(declareAttempt(state, { weight })).toMatchObject({ ok: true });
    expect(isCallableWeightNow(state, weight)).toBe(true);
  }
  if (named.length === 0) return;
  for (const weight of named) {
    if (!Number.isFinite(weight)) throw new Error(`named a non-finite weight: ${message}`);
  }
  if (!Number.isFinite(typed)) {
    throw new Error(`named a legal call for a weight that is not a number: ${message}`);
  }

  const lift = state.phase.kind === 'awaiting-declaration' ? state.phase.lift : 'squat';
  const rules = meetLoadingRules(state);
  const bar = barAndCollarsWeight(lift, rules);
  const ceiling = Math.max(typed, ...named) + 4 * rules.declarationIncrement;
  const callable = callableGridWeights(state, bar, ceiling);

  const pair = HINT_BOTH_SIDES.exec(message);
  if (pair !== null) {
    const below = Number(pair[1]);
    const above = Number(pair[2]);
    expect(below).toBeLessThanOrEqual(typed);
    expect(above).toBeGreaterThanOrEqual(typed);
    // "nearest": nothing callable sits between either named weight and the
    // number the lifter actually typed.
    expect(callable.filter((weight) => weight > below && weight <= typed)).toEqual([]);
    expect(callable.filter((weight) => weight >= typed && weight < above)).toEqual([]);
    return;
  }
  const lightest = HINT_LIGHTEST.exec(message);
  if (lightest !== null) {
    // "lightest" is a claim about the whole meet state, not just about weights
    // above the typed one: nothing callable may be lighter.
    expect(callable.filter((weight) => weight < Number(lightest[1]))).toEqual([]);
  }
}

describe('a hint never names a weight the engine then refuses', () => {
  it('after a good lift, offers only the minimum increase — not the repeat, not a decrease', () => {
    // The exact reproduction from the send-back.
    const state = takeAttempt(createMeet(), 200, THREE_WHITE);

    const at201 = expectError(declareAttempt(state, { weight: 201 }));
    expect(at201.code).toBe('WEIGHT_NOT_DECLARABLE');
    expect(at201.message).toBe(
      'Attempts are declared in steps of 2.5, and 201 is not one of them. ' +
        'The lightest legal call right now is 202.5.',
    );
    expect(at201.message).not.toContain('200 and 202.5');
    expectHintTellsTheTruth(state, 201, at201.message);

    const at199 = expectError(declareAttempt(state, { weight: 199 }));
    expect(at199.code).toBe('WEIGHT_NOT_DECLARABLE');
    expect(at199.message).toContain('The lightest legal call right now is 202.5.');
    expect(at199.message).not.toContain('197.5');
    expectHintTellsTheTruth(state, 199, at199.message);

    // ...and the weights the old hint named are still refused, which is what
    // made naming them a lie.
    expect(declareAttempt(state, { weight: 202.5 }).ok).toBe(true);
    expect(expectError(declareAttempt(state, { weight: 200 })).code).toBe('REPEAT_AFTER_GOOD_LIFT');
    expect(expectError(declareAttempt(state, { weight: 197.5 })).code).toBe('WEIGHT_DECREASED');
  });

  it('after a miss, offers the repeat as the call below', () => {
    const state = takeAttempt(createMeet(), 200, ONE_WHITE);

    const at201 = expectError(declareAttempt(state, { weight: 201 }));
    expect(at201.message).toContain('The nearest legal calls right now are 200 and 202.5.');
    expectHintTellsTheTruth(state, 201, at201.message);

    // 197.5 is on the grid and refused as a decrease, so the repeat at 200 is
    // the lightest thing left — even though it is HEAVIER than what was typed.
    const at199 = expectError(declareAttempt(state, { weight: 199 }));
    expect(at199.message).toContain('The lightest legal call right now is 200.');
    expect(at199.message).not.toContain('197.5');
    expectHintTellsTheTruth(state, 199, at199.message);

    expect(nearestCallableWeightsNow(state, 201)).toEqual({ below: 200, above: 202.5 });
    expect(nearestCallableWeightsNow(state, 199)).toEqual({ below: null, above: 200 });
  });

  it('steers a decrease to a weight that is still legal instead of just refusing it', () => {
    const state = takeAttempt(createMeet(), 200, THREE_WHITE);
    const error = expectError(declareAttempt(state, { weight: 197.5 }));
    expect(error.code).toBe('WEIGHT_DECREASED');
    expect(error.message).toContain('The lightest legal call right now is 202.5.');
    expectHintTellsTheTruth(state, 197.5, error.message);
  });

  it('steers a repeat-after-a-good-lift to the next legal call', () => {
    const state = takeAttempt(createMeet(), 200, TWO_WHITE);
    const error = expectError(declareAttempt(state, { weight: 200 }));
    expect(error.code).toBe('REPEAT_AFTER_GOOD_LIFT');
    expect(error.message).toContain('The lightest legal call right now is 202.5.');
    expectHintTellsTheTruth(state, 200, error.message);
  });

  it('steers a sub-minimum jump, and names the repeat only when a repeat is legal', () => {
    // Half-kilo calls with a 2.5 minimum increase: this is the rule set where
    // INSUFFICIENT_INCREASE is reachable, and where the callable set has a hole
    // between the repeat weight and the minimum jump.
    const made = takeAttempt(createMeet(HALF_KILO_DECLARATION_RULES), 200, THREE_WHITE);
    const afterGood = expectError(declareAttempt(made, { weight: 201 }));
    expect(afterGood.code).toBe('INSUFFICIENT_INCREASE');
    expect(afterGood.message).toContain('The lightest legal call right now is 202.5.');
    expectHintTellsTheTruth(made, 201, afterGood.message);

    const missed = takeAttempt(createMeet(HALF_KILO_DECLARATION_RULES), 200, THREE_RED);
    const afterMiss = expectError(declareAttempt(missed, { weight: 201 }));
    expect(afterMiss.code).toBe('INSUFFICIENT_INCREASE');
    expect(afterMiss.message).toContain('The nearest legal calls right now are 200 and 202.5.');
    expectHintTellsTheTruth(missed, 201, afterMiss.message);
    // The hole is real: 200.5, 201 and 202 are legal CALLS at this meet and none
    // of them is legal right now.
    for (const weight of [200.5, 201, 201.5, 202]) {
      expect(isCallableWeightIgnoringTheCard(weight, 'squat', HALF_KILO_DECLARATION_RULES)).toBe(true);
      expect(isCallableWeightNow(missed, weight)).toBe(false);
    }
  });

  it('steers a below-the-bar weight to what is legal now, not to the bar', () => {
    const opener = createMeet();
    const atOpener = expectError(declareAttempt(opener, { weight: 10 }));
    expect(atOpener.code).toBe('WEIGHT_BELOW_BAR');
    expect(atOpener.message).toContain('The lightest legal call right now is 25.');
    expectHintTellsTheTruth(opener, 10, atOpener.message);

    // Mid-lift the same typo cannot be answered with the bar weight: 25 is a
    // legal call at this meet and an illegal one on this attempt.
    const state = takeAttempt(opener, 200, THREE_WHITE);
    const midLift = expectError(declareAttempt(state, { weight: 10 }));
    expect(midLift.code).toBe('WEIGHT_BELOW_BAR');
    expect(midLift.message).toContain('The lightest legal call right now is 202.5.');
    expect(midLift.message).not.toContain('legal call right now is 25');
    expectHintTellsTheTruth(state, 10, midLift.message);
  });

  it('uses the bar of the lift on deck, not the one just finished', () => {
    const perLiftBars: MeetLoadingRules = {
      ...DEFAULT_MEET_RULES,
      barAndCollarsWeight: { squat: 30, bench: 25, deadlift: 25 },
    };
    const state = takeLift(createMeet(perLiftBars), [
      [200, THREE_WHITE],
      [210, THREE_WHITE],
      [220, THREE_WHITE],
    ]);
    expect(state.phase).toEqual({ kind: 'awaiting-declaration', lift: 'bench', attemptNumber: 1 });
    const error = expectError(declareAttempt(state, { weight: 24 }));
    expect(error.code).toBe('WEIGHT_BELOW_BAR');
    expect(error.message).toContain('bench bar and collars already weigh 25');
    expect(error.message).toContain('The lightest legal call right now is 25.');
    expectHintTellsTheTruth(state, 24, error.message);
  });

  it('names nothing at all when it cannot verify a weight', () => {
    // A refusal that is not about the weight gets no steering sentence, because
    // there is no number the engine can offer that would fix it.
    const finished = runNineForNine();
    expect(expectError(declareAttempt(finished, { weight: 300 })).message).not.toMatch(/legal call/);

    const declared = unwrap(declareAttempt(createMeet(), { weight: 200 }));
    expect(expectError(declareAttempt(declared, { weight: 205 })).message).not.toMatch(/legal call/);

    // NaN cannot be placed on the grid, so there is no "nearest" to compute and
    // the engine says less rather than guessing.
    const nonsense = expectError(declareAttempt(createMeet(), { weight: Number.NaN }));
    expect(nonsense.code).toBe('INVALID_WEIGHT');
    expect(nonsense.message).not.toMatch(/legal call/);
    expect(nearestCallableWeightsNow(createMeet(), Number.NaN)).toEqual({ below: null, above: null });
  });

  it('sweeps every refusal a meet can produce and checks each named weight against the engine', () => {
    // The general version of all of the above: nine card states across four rule
    // sets, and for each of them every typed weight that might tempt a hint out.
    // A named weight that this state would refuse fails here.
    const typed: readonly number[] = [
      -5, 0, 1, 10, 24, 24.9, 25, 26, 27.5, 99.9, 100, 100.5, 190, 197.5, 199, 199.5, 200, 200.25, 200.5, 201,
      201.5, 202, 202.5, 203, 205, 207.5, 210, 211, 300, 402.5, 405, 875, Number.NaN, Number.POSITIVE_INFINITY,
    ];
    let refusals = 0;
    let hinted = 0;
    const codesSeen = new Set<string>();
    for (const rules of ALL_RULE_SETS) {
      const opener = createMeet(rules);
      const states: readonly MeetState[] = [
        opener,
        takeAttempt(opener, 200, THREE_WHITE),
        takeAttempt(opener, 200, TWO_WHITE),
        takeAttempt(opener, 200, ONE_WHITE),
        takeAttempt(opener, 200, THREE_RED),
        takeAttempt(takeAttempt(opener, 200, THREE_WHITE), 210, THREE_WHITE),
        takeAttempt(takeAttempt(opener, 200, THREE_WHITE), 210, THREE_RED),
        takeAttempt(takeAttempt(opener, 200, THREE_RED), 200, THREE_WHITE),
        unwrap(passAttempt(takeAttempt(opener, 200, THREE_WHITE))),
      ];
      for (const state of states) {
        for (const weight of typed) {
          const result = declareAttempt(state, { weight });
          if (result.ok) continue;
          refusals += 1;
          codesSeen.add(result.error.code);
          if (/legal call/.test(result.error.message)) hinted += 1;
          expectHintTellsTheTruth(state, weight, result.error.message);
        }
      }
    }
    // Both branches have to be genuinely exercised, or the sweep proves nothing.
    expect(refusals).toBeGreaterThan(100);
    expect(hinted).toBeGreaterThan(100);
    // ...and every refusal that can carry a hint has to be among them, or the
    // sweep could pass while only ever seeing one of them.
    expect([...codesSeen].sort()).toEqual([
      'INSUFFICIENT_INCREASE',
      'INVALID_WEIGHT',
      'REPEAT_AFTER_GOOD_LIFT',
      'WEIGHT_BELOW_BAR',
      'WEIGHT_DECREASED',
      'WEIGHT_NOT_DECLARABLE',
    ]);
  });

  it('offers the same weights `AttemptContext` does, so the UI and the message agree', () => {
    for (const rules of ALL_RULE_SETS) {
      const opener = createMeet(rules);
      for (const state of [opener, takeAttempt(opener, 200, THREE_WHITE), takeAttempt(opener, 200, THREE_RED)]) {
        const context = currentAttemptContext(state);
        if (context === null) throw new Error('expected a declaration to be pending');
        // The floor the read-model reports is callable right now...
        expect(isCallableWeightNow(state, context.minimumWeight)).toBe(true);
        expect(declareAttempt(state, { weight: context.minimumWeight }).ok).toBe(true);
        if (context.minimumIncreaseWeight !== null) {
          expect(isCallableWeightNow(state, context.minimumIncreaseWeight)).toBe(true);
        }
        // ...and it is exactly what the hint offers below that floor.
        const under = context.minimumWeight - rules.declarationIncrement;
        expect(nearestCallableWeightsNow(state, under).above).toBe(context.minimumWeight);
      }
    }
  });

  it('reports no floor the engine refuses, even when the minimum increase is finer than float noise', () => {
    // The read-model tells a UI what the lightest legal call is, which is the
    // same promise a hint makes and is held to the same standard. With a minimum
    // increase below WEIGHT_EPSILON, 200 + minIncrement rounds back onto 200:
    // the floor has to step up to the next grid point or it names a weight
    // `declareAttempt` refuses as REPEAT_AFTER_GOOD_LIFT.
    const hairline: MeetLoadingRules = { ...DEFAULT_MEET_RULES, minIncrement: 1e-9 };
    const state = takeAttempt(createMeet(hairline), 200, THREE_WHITE);
    const context = currentAttemptContext(state);
    expect(context?.minimumIncreaseWeight).toBe(202.5);
    expect(context?.minimumWeight).toBe(202.5);
    expect(isCallableWeightNow(state, 202.5)).toBe(true);
    expect(isCallableWeightNow(state, 200)).toBe(false);

    // ...and that floor changes only which weight is REPORTED. The accepted set
    // is still every on-grid weight above the previous attempt and nothing else,
    // because nothing on the grid sits between 200 and 202.5 to be refused.
    for (const weight of [199, 200, 200.5, 201, 202]) {
      expect(declareAttempt(state, { weight }).ok).toBe(false);
    }
    for (const weight of [202.5, 205, 207.5]) {
      expect(declareAttempt(state, { weight }).ok).toBe(true);
    }
    expect(unwrap(suggestNextAttempt(state, 'conservative'))).toBeGreaterThanOrEqual(202.5);
    expect(nearestCallableWeightsNow(state, 201)).toEqual({ below: null, above: 202.5 });
  });

  it('agrees with a brute-force scan of the grid, on both sides, from every card state', () => {
    // `nearestCallableWeightsNow` computes its candidates in closed form. This
    // checks that closed form against an exhaustive scan, which is the only way
    // to know "nearest" means nearest rather than "the first thing we thought of".
    for (const rules of ALL_RULE_SETS) {
      const opener = createMeet(rules);
      const states: readonly MeetState[] = [
        opener,
        takeAttempt(opener, 200, THREE_WHITE),
        takeAttempt(opener, 200, THREE_RED),
        takeAttempt(takeAttempt(opener, 200, THREE_WHITE), 210, THREE_RED),
      ];
      for (const state of states) {
        // One scan per state, well past anything typed below, so that "nothing
        // callable is lighter" and "nothing callable sits in between" are both
        // decided against the same exhaustive list.
        const window = callableGridWeights(state, 0, 400);
        for (let weight = 20; weight <= 230; weight += 0.25) {
          const typed = Number(weight.toFixed(3));
          const nearest: NearestCallableWeights = nearestCallableWeightsNow(state, typed);
          const below = window.filter((candidate) => candidate <= typed + 1e-9);
          const above = window.filter((candidate) => candidate >= typed - 1e-9);
          expect(nearest.below).toBe(below.length === 0 ? null : below[below.length - 1]);
          expect(nearest.above).toBe(above.length === 0 ? null : above[0]);
        }
      }
    }
  });

  it('answers "no" rather than "yes" for every state where there is nothing to declare', () => {
    // `isCallableWeightNow` is what a keypad greys out with, so a state it cannot
    // reason about has to read as not-callable rather than as callable.
    const opener = createMeet();
    expect(isCallableWeightNow(opener, 200)).toBe(true);

    const declared = unwrap(declareAttempt(opener, { weight: 200 }));
    expect(isCallableWeightNow(declared, 205)).toBe(false); // an attempt is on the platform
    expect(isCallableWeightNow(runNineForNine(), 300)).toBe(false); // the meet is over

    const broken: MeetLoadingRules = { ...DEFAULT_MEET_RULES, declarationIncrement: 0 };
    expect(isCallableWeightNow(createMeet(broken), 200)).toBe(false);

    for (const weight of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1, 24, 201]) {
      expect(isCallableWeightNow(opener, weight)).toBe(false);
    }
  });

  it('agrees with declareAttempt on every weight, from every card state', () => {
    // The two must never disagree: one is the other, as a boolean.
    for (const rules of ALL_RULE_SETS) {
      const opener = createMeet(rules);
      const states: readonly MeetState[] = [
        opener,
        takeAttempt(opener, 200, THREE_WHITE),
        takeAttempt(opener, 200, THREE_RED),
        unwrap(passAttempt(takeAttempt(opener, 200, THREE_RED))),
      ];
      for (const state of states) {
        for (let weight = 20; weight <= 220; weight += 0.5) {
          const typed = Number(weight.toFixed(3));
          expect(isCallableWeightNow(state, typed)).toBe(declareAttempt(state, { weight: typed }).ok);
        }
      }
    }
  });

  it('keeps the probe bound a named constant rather than a magic number', () => {
    expect(NEAREST_CALL_PROBE_STEPS).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(NEAREST_CALL_PROBE_STEPS)).toBe(true);
  });
});

describe('loadable weights', () => {
  it('builds the minimum from a named bar weight and a named collar weight', () => {
    expect(MIN_LOADABLE_WEIGHT_KG).toBe(COMPETITION_BAR_WEIGHT_KG + COLLAR_PAIR_WEIGHT_KG);
    for (const lift of LIFT_ORDER) {
      expect(barAndCollarsWeight(lift)).toBe(MIN_LOADABLE_WEIGHT_KG);
      // 25 is itself a multiple of 2.5, so the empty bar is a legal call.
      expect(lightestCallableWeightIgnoringTheCard(lift)).toBe(MIN_LOADABLE_WEIGHT_KG);
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
    expect(lightestCallableWeightIgnoringTheCard('squat', heavySquatBar)).toBe(30);
    expect(lightestCallableWeightIgnoringTheCard('bench', heavySquatBar)).toBe(25);
    const state = createMeet(heavySquatBar);
    expect(expectError(declareAttempt(state, { weight: 27.5 })).code).toBe('WEIGHT_BELOW_BAR');
    expect(unwrap(declareAttempt(state, { weight: 30 })).phase.kind).toBe('attempt-declared');
  });

  it('rounds onto the declaration grid, never below the bar', () => {
    // There is one grid to round onto, and it is a rule, not a plate rack.
    // Declaration grid: 2.5, so these land where an attempt card would.
    expect(roundToCallableWeightIgnoringTheCard(0, 'squat')).toBe(MIN_LOADABLE_WEIGHT_KG);
    expect(roundToCallableWeightIgnoringTheCard(10, 'squat')).toBe(MIN_LOADABLE_WEIGHT_KG);
    expect(roundToCallableWeightIgnoringTheCard(26, 'squat', DEFAULT_MEET_RULES, 'down')).toBe(MIN_LOADABLE_WEIGHT_KG);
    expect(roundToCallableWeightIgnoringTheCard(26, 'squat', DEFAULT_MEET_RULES, 'up')).toBe(27.5);
    expect(roundToCallableWeightIgnoringTheCard(201, 'squat')).toBe(200);
    expect(roundToCallableWeightIgnoringTheCard(201, 'squat', DEFAULT_MEET_RULES, 'up')).toBe(202.5);
  });

  it('always rounds to something the engine will actually accept', () => {
    for (const rules of ALL_RULE_SETS) {
      for (const target of [0, 24.9, 25, 26, 44, 47.5, 100.3, 200.25, 201, 337.6]) {
        for (const mode of ['nearest', 'up', 'down'] as const) {
          const rounded = roundToCallableWeightIgnoringTheCard(target, 'squat', rules, mode);
          expect(isCallableWeightIgnoringTheCard(rounded, 'squat', rules)).toBe(true);
          expect(declareAttempt(createMeet(rules), { weight: rounded }).ok).toBe(true);
        }
      }
    }
  });

  it('rejects nonsense meet rules loudly instead of skipping the check', () => {
    const broken: MeetLoadingRules = { ...DEFAULT_MEET_RULES, declarationIncrement: 0 };
    expect(validateMeetRules(broken)?.code).toBe('INVALID_MEET_RULES');
    for (const rules of ALL_RULE_SETS) {
      expect(validateMeetRules(rules)).toBeNull();
    }

    const state = createMeet(broken);
    expect(expectError(declareAttempt(state, { weight: 200 })).code).toBe('INVALID_MEET_RULES');
    expect(expectError(suggestOpener('squat', 200, broken)).code).toBe('INVALID_MEET_RULES');

    const noMinIncrement: MeetLoadingRules = { ...DEFAULT_MEET_RULES, minIncrement: 0 };
    expect(validateMeetRules(noMinIncrement)?.code).toBe('INVALID_MEET_RULES');

    const negativeBar: MeetLoadingRules = {
      ...DEFAULT_MEET_RULES,
      barAndCollarsWeight: { squat: 25, bench: -1, deadlift: 25 },
    };
    expect(validateMeetRules(negativeBar)?.code).toBe('INVALID_MEET_RULES');

    const infiniteGrid: MeetLoadingRules = {
      ...DEFAULT_MEET_RULES,
      declarationIncrement: Number.POSITIVE_INFINITY,
    };
    expect(validateMeetRules(infiniteGrid)?.code).toBe('INVALID_MEET_RULES');
    // ...and a meet started on them is refused at the point of use rather than
    // quietly running with a check disabled.
    expect(expectError(declareAttempt(createMeet(infiniteGrid), { weight: 200 })).code).toBe('INVALID_MEET_RULES');
    expect(expectError(suggestNextAttempt(createMeet(infiniteGrid), 'standard')).code).toBe('INVALID_MEET_RULES');
  });

  it('no longer rejects a configuration for disagreeing with a plate grid it does not have', () => {
    // Every one of these was INVALID_MEET_RULES in the previous version, which
    // cross-checked the declaration grid and the bar against a single plate
    // step. All of them describe runnable meets.

    // The pound meet from this module's own source: bar 45, calls on 2.5, while
    // the pound kit's smallest pair is 1 lb. 2.5 is not a multiple of 1.
    expect(validateMeetRules(POUND_MEET_RULES)).toBeNull();
    expect(declareAttempt(createMeet(POUND_MEET_RULES), { weight: 402.5 }).ok).toBe(true);

    // Calls on the half-kilo at a meet whose finest disc pair is 2.5.
    const fineCallsCoarsePlates: MeetLoadingRules = { ...DEFAULT_MEET_RULES, declarationIncrement: 0.5 };
    expect(validateMeetRules(fineCallsCoarsePlates)).toBeNull();

    // A bar that is not a whole number of anything. A 25.1 kg bar is a strange
    // bar, not an invalid meet: the lightest legal call is simply 27.5.
    const offGridBar: MeetLoadingRules = {
      ...DEFAULT_MEET_RULES,
      barAndCollarsWeight: { squat: 25.1, bench: 25, deadlift: 25 },
    };
    expect(validateMeetRules(offGridBar)).toBeNull();
    expect(lightestCallableWeightIgnoringTheCard('squat', offGridBar)).toBe(27.5);
    expect(expectError(declareAttempt(createMeet(offGridBar), { weight: 25 })).code).toBe('WEIGHT_BELOW_BAR');
    expect(declareAttempt(createMeet(offGridBar), { weight: 27.5 }).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The rules are fixed for the whole meet — enforced by the type, not by a check
//
// `MeetState.rules` is a `MeetRules`: one property, under a symbol meet.ts does
// not export. There is no runtime tamper check to test. What is tested is
// (a) that the values still come back out correctly, (b) that the spread which
// used to relax a rule no longer COMPILES, and (c) that the ways round the
// compiler buy nothing, because the values are not where a caller can reach.
//
// (b) is graded by `tsc --noEmit`, not by vitest — vitest strips types without
// checking them. Each `@ts-expect-error` below FAILS THE BUILD if the line under
// it starts compiling, so these are not claims about types written in prose;
// they are the compiler's own verdict.
//
// TO CHECK THAT THEY STILL BITE (a type-level test that has gone vacuous looks
// exactly like one that passes): in meet.ts replace `MeetRules` with
// `= MeetLoadingRules`, `stateRules` with `return state.rules`, and createMeet's
// wrapper with `copyLoadingRules(rules)`. `tsc --noEmit` must then report TS2578
// "Unused '@ts-expect-error' directive" on six of the seven directives here, and
// `vitest run` must fail four of this block's tests on the runtime half. The
// seventh directive is the `seal` one: it needs a `seal: number` field added
// back to the same structural type before it reports TS2578. Both variants were
// run against this suite.
// ---------------------------------------------------------------------------

describe('meet rules are opaque', () => {
  it('hands the values back through meetLoadingRules, as a copy', () => {
    for (const rules of ALL_RULE_SETS) {
      expect(meetLoadingRules(createMeet(rules))).toEqual(rules);
    }
    const state = createMeet();
    // A copy all the way down: two reads share no object.
    expect(meetLoadingRules(state)).not.toBe(meetLoadingRules(state));
    expect(meetLoadingRules(state).barAndCollarsWeight).not.toBe(meetLoadingRules(state).barAndCollarsWeight);
  });

  it('cannot be edited through the object meetLoadingRules returns', () => {
    // `readonly` is compile-time only, so the copy is what makes this hold at
    // runtime. Handing back the live object would reopen the hatch in the one
    // direction opacity does not close by itself.
    const state = createMeet();
    const escaped: {
      barAndCollarsWeight: Record<LiftKind, number>;
      minIncrement: number;
      declarationIncrement: number;
    } = meetLoadingRules(state);
    escaped.declarationIncrement = 0.5;
    escaped.minIncrement = 0.5;
    escaped.barAndCollarsWeight.squat = 5;

    expect(meetLoadingRules(state)).toEqual(DEFAULT_MEET_RULES);
    expect(expectError(declareAttempt(state, { weight: 200.5 })).code).toBe('WEIGHT_NOT_DECLARABLE');
    expect(expectError(declareAttempt(state, { weight: 10 })).code).toBe('WEIGHT_BELOW_BAR');
  });

  it('does not compile the spread that used to reopen the escape hatch', () => {
    const state = createMeet();

    // POSITIVE CONTROL, and it is load-bearing: an untouched re-spread must
    // still compile and still run. Without it, a `MeetRules` that had become
    // uninhabitable would satisfy every directive below for the wrong reason.
    const untouched: MeetState = { ...state, rules: { ...state.rules } };
    expect(declareAttempt(untouched, { weight: 200 }).ok).toBe(true);
    expect(meetLoadingRules(untouched)).toEqual(DEFAULT_MEET_RULES);

    // THE ACCIDENT. This exact expression used to type-check in strict mode
    // with no cast, and the meet then honoured the relaxed rule.
    const relaxed: MeetState = {
      ...state,
      // @ts-expect-error — `declarationIncrement` is not a property of MeetRules.
      rules: { ...state.rules, declarationIncrement: 0.5, minIncrement: 0.5 },
    };
    // ...and even having written it, nothing was relaxed.
    expect(expectError(declareAttempt(relaxed, { weight: 200.5 })).code).toBe('WEIGHT_NOT_DECLARABLE');
    expect(meetLoadingRules(relaxed)).toEqual(DEFAULT_MEET_RULES);

    // One field at a time, so no directive can be passing on a single unlucky
    // property name.
    const bar: MeetState = {
      ...state,
      // @ts-expect-error — nor is `barAndCollarsWeight`.
      rules: { ...state.rules, barAndCollarsWeight: { squat: 5, bench: 5, deadlift: 5 } },
    };
    expect(expectError(declareAttempt(bar, { weight: 10 })).code).toBe('WEIGHT_BELOW_BAR');
    const jump: MeetState = {
      ...state,
      // @ts-expect-error — nor is `minIncrement`.
      rules: { ...state.rules, minIncrement: 0.5 },
    };
    expect(meetLoadingRules(jump)).toEqual(DEFAULT_MEET_RULES);
  });

  it('exposes no rule field to read off the wrapper, and takes no plain rules in its place', () => {
    const state = createMeet();

    // @ts-expect-error — MeetRules has no `declarationIncrement` to read.
    const peeked: unknown = state.rules.declarationIncrement;
    expect(peeked).toBeUndefined();

    // @ts-expect-error — MeetRules has no `seal` either; the fold is gone.
    const seal: unknown = state.rules.seal;
    expect(seal).toBeUndefined();

    // A hand-built rules object has no symbol key, so it is not a MeetRules at
    // all — this fails on the MISSING property rather than on an excess one,
    // which is the stronger of the two checks. Deliberately not run through the
    // engine: at runtime such a state has no rules for it to read.
    // @ts-expect-error — MeetLoadingRules is not assignable to MeetRules.
    const substituted: MeetRules = HALF_KILO_DECLARATION_RULES;
    expect(substituted).toBe(HALF_KILO_DECLARATION_RULES);

    // ...and it does not work in the other direction either: the wrapper is not
    // a MeetLoadingRules, so the old rules-shaped call sites do not compile.
    // @ts-expect-error — MeetRules is not assignable to MeetLoadingRules.
    expect(() => barAndCollarsWeight('squat', state.rules)).toThrow();
  });

  it('ignores a rule field bolted on past the compiler, because that is not where it reads', () => {
    // The excess-property check is what stops the one-line spread; routing the
    // same object through an unannotated variable first gets past it. That is
    // exactly why the values sit behind a key a caller cannot name — the added
    // property is inert, and the engine still reads what createMeet was given.
    const state = createMeet();
    const bolted = { ...state.rules, declarationIncrement: 0.5, minIncrement: 0.5 };
    const dodged: MeetState = { ...state, rules: bolted };

    expect(meetLoadingRules(dodged)).toEqual(DEFAULT_MEET_RULES);
    expect(expectError(declareAttempt(dodged, { weight: 200.5 })).code).toBe('WEIGHT_NOT_DECLARABLE');
    expect(isCallableWeightNow(dodged, 200.5)).toBe(false);
    expect(declareAttempt(dodged, { weight: 200 }).ok).toBe(true);
  });

  it('ignores one bolted on mid-meet too, on both the declaring and the suggesting path', () => {
    const state = takeAttempt(createMeet(), 200, THREE_WHITE);
    const bolted = { ...state.rules, minIncrement: 0.5, declarationIncrement: 0.5 };
    const dodged: MeetState = { ...state, rules: bolted };

    expect(expectError(declareAttempt(dodged, { weight: 200.5 })).code).toBe('WEIGHT_NOT_DECLARABLE');
    expect(expectError(declareAttempt(dodged, { weight: 201 })).code).toBe('WEIGHT_NOT_DECLARABLE');
    expect(declareAttempt(dodged, { weight: 202.5 }).ok).toBe(true);
    // 202.5 either side, not 200.5: the bolted-on half-kilo grid is not read.
    expect(nearestCallableWeightsNow(dodged, 201)).toEqual({ below: null, above: 202.5 });
    // The suggestion path agrees with the declaration path, as it must: both
    // read the same rules, and neither can be handed different ones.
    expect(unwrap(suggestNextAttempt(dodged, 'conservative'))).toBe(205);
    expect(unwrap(suggestNextAttempt(dodged, 'conservative'))).toBe(unwrap(suggestNextAttempt(state, 'conservative')));
    expect(currentAttemptContext(dodged)).toEqual(currentAttemptContext(state));
  });

  it('carries the same rule values through every transition of a whole meet', () => {
    // createMeet is the only place a MeetRules is built, so every later state
    // must be running on the values it was handed — including after a bomb-out,
    // where the phase changes shape entirely.
    const script: readonly (readonly [number, JudgePanel])[] = [
      [200, THREE_WHITE],
      [210, THREE_RED],
      [210, TWO_WHITE],
    ];
    for (const rules of ALL_RULE_SETS) {
      let state = createMeet(rules);
      expect(meetLoadingRules(state)).toEqual(rules);
      for (const [weight, lights] of script) {
        state = unwrap(declareAttempt(state, { weight }));
        expect(meetLoadingRules(state)).toEqual(rules);
        state = unwrap(resolveAttempt(state, { lights }));
        expect(meetLoadingRules(state)).toEqual(rules);
      }
      state = unwrap(passAttempt(state));
      expect(meetLoadingRules(state)).toEqual(rules);

      const bombed = takeLift(createMeet(rules), [
        [200, THREE_RED],
        [200, THREE_RED],
        [200, THREE_RED],
      ]);
      expect(isBombedOut(bombed)).toBe(true);
      expect(meetLoadingRules(bombed)).toEqual(rules);
    }
    expect(meetLoadingRules(runNineForNine())).toEqual(DEFAULT_MEET_RULES);
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
    for (const weight of [201, 200.5, 200.25]) {
      expect(expectError(declareAttempt(state, { weight })).code).toBe('WEIGHT_NOT_DECLARABLE');
    }
    // Below the bar is the one refusal that is about equipment.
    expect(expectError(declareAttempt(state, { weight: 24 })).code).toBe('WEIGHT_BELOW_BAR');
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

  it('only ever offers a minimum the engine will accept', () => {
    for (const rules of ALL_RULE_SETS) {
      const state = takeAttempt(createMeet(rules), 200, THREE_WHITE);
      const minimum = currentAttemptContext(state)?.minimumIncreaseWeight ?? 0;
      expect(isDeclarableWeight(minimum, rules)).toBe(true);
      expect(isCallableWeightIgnoringTheCard(minimum, 'squat', rules)).toBe(true);
      expect(declareAttempt(state, { weight: minimum }).ok).toBe(true);
    }
  });

  it('rounds the minimum up onto the declaration grid when the jump lands off it', () => {
    // minIncrement 1 with a 2.5 declaration grid: 200 + 1 is 201, which is not a
    // legal call, so the floor must be 202.5 rather than 201.
    const fineJumps: MeetLoadingRules = { ...DEFAULT_MEET_RULES, minIncrement: 1 };
    const state = takeAttempt(createMeet(fineJumps), 200, THREE_WHITE);
    const context = currentAttemptContext(state);
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

  it('suggests weights that are declarable and accepted by the engine', () => {
    for (const rules of ALL_RULE_SETS) {
      const afterGood = takeAttempt(createMeet(rules), 200, THREE_WHITE);
      const afterMiss = takeAttempt(createMeet(rules), 200, THREE_RED);
      for (const state of [afterGood, afterMiss]) {
        for (const strategy of STRATEGIES) {
          const suggestion = suggestNextAttempt(state, strategy);
          if (!suggestion.ok) {
            expect(suggestion.error.code).toBe('REPEAT_AFTER_GOOD_LIFT');
            continue;
          }
          expect(isCallableWeightIgnoringTheCard(suggestion.value, 'squat', rules)).toBe(true);
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
      expect(isCallableWeightIgnoringTheCard(opener, lift)).toBe(true);
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
    // Deliberately has no default increment: it is pure grid arithmetic and the
    // caller says which grid. The old single-default version is how one grid
    // came to stand in for a rule it had no business describing.
    expect(roundToIncrement(201, DECLARATION_INCREMENT_KG)).toBe(200);
    expect(roundToIncrement(201.5, DECLARATION_INCREMENT_KG)).toBe(202.5);
    expect(roundToIncrement(202.5, DECLARATION_INCREMENT_KG)).toBe(202.5);
    expect(roundToIncrement(201, 0.5)).toBe(201);
    expect(roundToIncrement(200.3, 0.5)).toBe(200.5);
  });

  it('rounds up and down on request without float drift', () => {
    expect(roundToIncrement(201, DECLARATION_INCREMENT_KG, 'up')).toBe(202.5);
    expect(roundToIncrement(201, DECLARATION_INCREMENT_KG, 'down')).toBe(200);
    expect(roundToIncrement(202.5, DECLARATION_INCREMENT_KG, 'up')).toBe(202.5);
    expect(roundToIncrement(202.5, DECLARATION_INCREMENT_KG, 'down')).toBe(202.5);
    expect(roundToIncrement(107.5, DECLARATION_INCREMENT_KG, 'up')).toBe(107.5);
    expect(roundToIncrement(200.5, 0.5, 'up')).toBe(200.5);
    expect(roundToIncrement(200.4, 0.5, 'down')).toBe(200);
    // Pound grid, where the arithmetic is not a multiple of the kg one.
    expect(roundToIncrement(403, POUND_DECLARATION_INCREMENT_LB, 'up')).toBe(405);
    expect(roundToIncrement(403, POUND_DECLARATION_INCREMENT_LB, 'down')).toBe(402.5);
  });

  it('recognises which grid a weight sits on', () => {
    expect(isOnIncrementGrid(202.5, DECLARATION_INCREMENT_KG)).toBe(true);
    expect(isOnIncrementGrid(200.5, DECLARATION_INCREMENT_KG)).toBe(false);
    expect(isOnIncrementGrid(200.5, 0.5)).toBe(true);
    expect(isOnIncrementGrid(200.25, 0.5)).toBe(false);
    expect(isOnIncrementGrid(200.25, 0.25)).toBe(true);
    expect(isOnIncrementGrid(202.5, 0)).toBe(false);
    expect(isOnIncrementGrid(Number.NaN, DECLARATION_INCREMENT_KG)).toBe(false);
    // The relationship the removed plate gate got wrong: 2.5 is not a whole
    // number of 1s, which is why it rejected the pound configuration.
    expect(isOnIncrementGrid(POUND_DECLARATION_INCREMENT_LB, 1)).toBe(false);
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
    // The rules live under a symbol key, which JSON.stringify drops — so the
    // snapshots above say nothing about them and they are checked separately.
    for (const state of [start, declared, resolved]) {
      expect(meetLoadingRules(state)).toEqual(DEFAULT_MEET_RULES);
    }
  });

  it('copies the rules it is given instead of aliasing them', () => {
    const callerRules = {
      unit: 'kg' as const,
      barAndCollarsWeight: { squat: 25, bench: 25, deadlift: 25 },
      minIncrement: 2.5,
      declarationIncrement: 2.5,
    };
    const state = createMeet(callerRules);

    callerRules.minIncrement = 0.5;
    callerRules.declarationIncrement = 0.5;
    callerRules.barAndCollarsWeight.squat = 5;

    expect(meetLoadingRules(state)).toEqual(DEFAULT_MEET_RULES);
    // The meet still runs on the rules it was started with, not the caller's
    // edited ones: 200.5 is not a legal call here and 10 is under the bar.
    expect(expectError(declareAttempt(state, { weight: 200.5 })).code).toBe('WEIGHT_NOT_DECLARABLE');
    expect(expectError(declareAttempt(state, { weight: 10 })).code).toBe('WEIGHT_BELOW_BAR');
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
    // ...including the half JSON.stringify cannot see (see above).
    expect(meetLoadingRules(first)).toEqual(meetLoadingRules(second));
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
