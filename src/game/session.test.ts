import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  EMPTY_CHECK_IN,
  SESSION_PAYOFFS,
  asAccessoryCloseOut,
  checkInOrNeutral,
  checkInProgress,
  completeCheckIn,
  closeOutCopyFor,
  createSession,
  currentSetNumber,
  defaultRpeChoice,
  executionQualityFrom,
  isMadeRep,
  liftForDay,
  liftMomentFor,
  nextBestE1rm,
  nextCheckInQuestion,
  playedSessionMs,
  playedSetFrom,
  prescribeSession,
  repConfigFor,
  repSeed,
  sessionE1rmFrom,
  sessionProjection,
  sessionProposal,
  stepSession,
  workSetsForToday,
  type CloseOutCopy,
  type CloseOutCopyInput,
  type SessionContext,
  type SessionEvent,
  type SessionState,
} from './session';
import { SESSION_COPY, SESSION_PROGRESSION_GUARD, SESSION_TUNING } from './sessionTuning';
import {
  EMPTY_FATIGUE_STATE,
  FATIGUE_TUNING,
  UNLUCKIEST_ROLLS,
  readinessCheckIn,
  recordSession,
  sessionStimulusCredit,
  type FatigueState,
  type ReadinessCheckIn,
} from './fatigue';
import {
  EMPTY_TRAINING_PROGRESS_CREDIT,
  TRAINING_PROGRESS_TUNING,
  creditForLift,
  progressionOffer,
} from './trainingProgress';
import {
  applyTrainingSession,
  newServerRecord,
  snapshotWireFor,
  fatigueRecordFor,
  type ServerRecord,
} from './sessionServer';
import {
  createLift,
  stepLift,
  type InputTiming,
  type LiftConfig,
  type LiftInput,
  type LiftOutcome,
  type LiftResolution,
  type LiftState,
} from './lift';
import { TICK_MS } from './liftTuning';
import { cueWindowMs } from './lift';
import {
  applyServerSnapshot,
  emptyProgressionCache,
  asProposalId,
  proposeChange,
  readBestE1rmKg,
  readStreakDays,
  readTotalKg,
  receiveProgressionSnapshot,
  type TrainingSetReport,
} from './progression';
import type { LiftKind } from './meet';

/**
 * The day these fixtures pretend the account was created on (GDD 4.2 signup
 * day; `streak.ts` 1b). Day 0, because every simulated session below is
 * recorded on day 0 or later and a signup day after a session is refused.
 */
const SIGNUP_DAY = 0;


// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NEUTRAL: ReadinessCheckIn = { sleep: 'ok', soreness: 'normal', motivation: 'steady' };
const PRIMED: ReadinessCheckIn = { sleep: 'good', soreness: 'fresh', motivation: 'fired-up' };
const READY: ReadinessCheckIn = { sleep: 'good', soreness: 'normal', motivation: 'steady' };
const WRECKED: ReadinessCheckIn = { sleep: 'poor', soreness: 'sore', motivation: 'flat' };

const CREDIT_FOR_A_PLATE = TRAINING_PROGRESS_TUNING.CREDIT_PER_PROGRESSION_OPPORTUNITY;

function context(overrides: Partial<SessionContext> = {}): SessionContext {
  return {
    day: 0,
    lift: 'squat',
    e1rmKg: 200,
    bestE1rmKg: 200,
    streakBefore: 4,
    streakIfTrainedToday: 5,
    fatigue: EMPTY_FATIGUE_STATE,
    trainingProgressCredit: 0,
    ...overrides,
  };
}

function tapThrough(state: SessionState, answers: ReadinessCheckIn): SessionState {
  let next = stepSession(state, {
    kind: 'check-in-tap',
    tap: { question: 'sleep', answer: answers.sleep },
  });
  next = stepSession(next, {
    kind: 'check-in-tap',
    tap: { question: 'soreness', answer: answers.soreness },
  });
  return stepSession(next, {
    kind: 'check-in-tap',
    tap: { question: 'motivation', answer: answers.motivation },
  });
}

/** A whole session, driven by a caller who says what each rep did. */
function runSession(
  ctx: SessionContext,
  answers: ReadinessCheckIn,
  rpe: number,
  outcomeFor: (setIndex: number, repIndex: number) => LiftOutcome,
): SessionState {
  let state = stepSession(tapThrough(createSession(ctx), answers), { kind: 'choose-rpe', rpe });
  let guard = 0;
  while (state.phase !== 'close-out' && guard < 200) {
    guard += 1;
    if (state.phase === 'rest') {
      state = stepSession(state, { kind: 'begin-set' });
      continue;
    }
    const event: SessionEvent = {
      kind: 'rep-resolved',
      outcome: outcomeFor(state.setIndex, state.repIndex),
      // Canned outcome, not a played rep — full credit, so a session driven
      // this way is unaffected by Sprint 3's quality-scaled gain and every
      // number pinned against it stays exactly what it was.
      executionQuality: 1,
    };
    state = stepSession(state, event);
  }
  return state;
}

const ALL_GOOD = (): LiftOutcome => 'good-lift';

// ---------------------------------------------------------------------------
// A closed-loop player, so "a played session" means one that was actually
// played rather than one whose length was assumed.
// ---------------------------------------------------------------------------

interface PlayedRep {
  readonly outcome: LiftOutcome;
  readonly ticks: number;
  /** `executionQualityFrom` read off this same rep's own resolution. */
  readonly executionQuality: number;
}

/**
 * Plays a rep by obeying the two on-screen cues: hold to descend, release when
 * the depth window's ideal tick arrives, press again at the drive's ideal tick
 * and keep holding. `offsetTicks` shifts both inputs, so an imperfect player is
 * the same function with a number.
 *
 * Re-reads `state.activeCue` every tick rather than pressing once, so a
 * MAXIMAL-load rep's later drive cues (Sprint 3's tap-rate mechanic) are
 * pressed too, each at ITS OWN ideal tick plus the same offset — this
 * function did not need to change for that to be true.
 */
function playRep(config: LiftConfig, offsetTicks = 0): PlayedRep {
  let state: LiftState = createLift(config);
  let ticks = 0;
  const limit = 1000;
  while (state.phase !== 'RESOLVED' && ticks < limit) {
    let input: LiftInput | null = null;
    const cue = state.activeCue;
    const nextTick = state.tick + 1;
    if (state.phase === 'BRACE' && !state.held) {
      input = { kind: 'press' };
    } else if (cue !== null && nextTick === cue.idealTick + offsetTicks) {
      input = { kind: cue.wants };
    }
    state = stepLift(state, input);
    ticks += 1;
  }
  const resolution = state.resolution;
  return {
    outcome: resolution?.outcome ?? 'miss',
    ticks,
    executionQuality: resolution === null ? 1 : executionQualityFrom(resolution),
  };
}

/** Plays every rep of a session with the real mechanic and returns the totals. */
function playWholeSession(
  ctx: SessionContext,
  answers: ReadinessCheckIn,
  rpe: number,
  offsetTicks = 0,
): { readonly state: SessionState; readonly repMs: number; readonly reps: number } {
  let state = stepSession(tapThrough(createSession(ctx), answers), { kind: 'choose-rpe', rpe });
  let ticks = 0;
  let reps = 0;
  let guard = 0;
  while (state.phase !== 'close-out' && guard < 200) {
    guard += 1;
    if (state.phase === 'rest') {
      state = stepSession(state, { kind: 'begin-set' });
      continue;
    }
    const played = playRep(repConfigFor(state), offsetTicks);
    ticks += played.ticks;
    reps += 1;
    state = stepSession(state, {
      kind: 'rep-resolved',
      outcome: played.outcome,
      executionQuality: played.executionQuality,
    });
  }
  return { state, repMs: ticks * TICK_MS, reps };
}

// ---------------------------------------------------------------------------

describe('purity contract — CLAUDE.md, GDD §9.2', () => {
  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const sources: readonly [string, string][] = [
    ['session.ts', readFileSync(path.join(HERE, 'session.ts'), 'utf8')],
    ['sessionServer.ts', readFileSync(path.join(HERE, 'sessionServer.ts'), 'utf8')],
    ['sessionTuning.ts', readFileSync(path.join(HERE, 'sessionTuning.ts'), 'utf8')],
  ];

  /** Strip comments and strings so only real code is scanned. */
  function codeOnly(source: string): string {
    return source
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
      .replace(/'(?:\\.|[^'\\])*'/g, "''")
      .replace(/"(?:\\.|[^"\\])*"/g, '""')
      .replace(/`(?:\\.|[^`\\])*`/g, '``');
  }

  it('strips comments without destroying the code (sanity check for the scans below)', () => {
    // Without this the three scans below would pass on an empty string, which
    // is the shape of blind check this suite is meant not to have.
    expect(codeOnly('const a = 1; // Date.now()')).toContain('const a = 1;');
    expect(codeOnly('/* Math.random() */ const b = 2;')).not.toContain('Math.random');
    expect(codeOnly('const c = "Date.now()";')).not.toContain('Date.now');
    for (const [name, source] of sources) {
      expect(codeOnly(source).length, name).toBeGreaterThan(200);
    }
  });

  it('imports nothing from React, and nothing that could reach it', () => {
    for (const [name, source] of sources) {
      const code = codeOnly(source);
      expect(code, name).not.toMatch(/from\s*''react/);
      expect(code, name).not.toMatch(/react-native/);
      expect(code, name).not.toMatch(/\.tsx/);
    }
  });

  it('never reads a clock — the day is a parameter', () => {
    for (const [name, source] of sources) {
      const code = codeOnly(source);
      expect(code, name).not.toContain('Date.now');
      expect(code, name).not.toContain('new Date');
      expect(code, name).not.toContain('performance.now');
    }
  });

  it('never reaches for randomness — the injury roll is handed in', () => {
    for (const [name, source] of sources) {
      expect(codeOnly(source), name).not.toContain('Math.random');
    }
  });

  it('has no ambient side-effect surface', () => {
    for (const [name, source] of sources) {
      const code = codeOnly(source);
      expect(code, name).not.toContain('process.');
      expect(code, name).not.toContain('globalThis');
      expect(code, name).not.toContain('console.');
      expect(code, name).not.toContain('localStorage');
      expect(code, name).not.toContain('fetch(');
    }
  });

  it('names no second rep-max formula — CLAUDE.md bans one anywhere', () => {
    for (const [name, source] of sources) {
      expect(source.toLowerCase(), name).not.toContain('brzycki');
      expect(source.toLowerCase(), name).not.toContain('lombardi');
      expect(source.toLowerCase(), name).not.toContain('oconner');
    }
  });

  it('never computes a Total — every mention is null or a carry-through', () => {
    // GDD §3.2, §6.4. The only things these modules may put in a `totalKg` are
    // `null` and whatever they were already holding; an expression there is a
    // training session moving a competition Total.
    const assigned: string[] = [];
    for (const [name, source] of sources) {
      const code = codeOnly(source);
      expect(code, name).not.toContain('estimatedTotal');
      expect(code, name).not.toContain('projectedTotal');
      for (const line of code.split('\n')) {
        // A field DECLARATION (`readonly totalKg: number | null`) is a type,
        // not a value, and is skipped. Everything else is an assignment.
        if (line.includes('readonly')) continue;
        for (const match of line.matchAll(/totalKg\s*[:=]\s*([A-Za-z0-9_.]+)/g)) {
          const value = match[1] ?? '';
          assigned.push(`${name}: ${value}`);
          expect(
            value === 'null' || value.endsWith('.totalKg'),
            `${name} assigns totalKg = ${value}`,
          ).toBe(true);
        }
      }
    }
    // The positive control: the scan finds the assignments it is judging. An
    // empty list would satisfy the loop above without checking anything.
    expect(assigned).toEqual([
      // `newServerRecord` — a lifter with no meet has no Total.
      'sessionServer.ts: null',
      // `applyTrainingSession` and `snapshotWireFor` — carried through.
      'sessionServer.ts: record.totalKg',
      'sessionServer.ts: record.totalKg',
    ]);
  });
});

describe('liftForDay — GDD §3.2 programmed lift on rotation', () => {
  it('walks squat -> bench -> deadlift and wraps', () => {
    // Hand-written, not derived from LIFT_ROTATION: deriving the expectation
    // from the table being checked would pass on any table.
    expect(liftForDay(0)).toBe('squat');
    expect(liftForDay(1)).toBe('bench');
    expect(liftForDay(2)).toBe('deadlift');
    expect(liftForDay(3)).toBe('squat');
    expect(liftForDay(4)).toBe('bench');
    expect(liftForDay(20342)).toBe('deadlift');
  });

  it('does not index off the front of the rotation before the epoch', () => {
    expect(liftForDay(-1)).toBe('deadlift');
    expect(liftForDay(-2)).toBe('bench');
    expect(liftForDay(-3)).toBe('squat');
  });

  it('refuses a day index that is not an integer', () => {
    expect(() => liftForDay(1.5)).toThrow(RangeError);
    expect(() => liftForDay(Number.NaN)).toThrow(RangeError);
  });
});

describe('the check-in — GDD §3.2, three taps', () => {
  it('needs all three answers before it is a check-in', () => {
    expect(completeCheckIn(EMPTY_CHECK_IN)).toBeNull();
    expect(completeCheckIn({ sleep: 'good', soreness: null, motivation: 'flat' })).toBeNull();
    expect(completeCheckIn({ sleep: 'good', soreness: 'sore', motivation: 'flat' })).toEqual({
      sleep: 'good',
      soreness: 'sore',
      motivation: 'flat',
    });
  });

  it('counts progress and names the question still owed', () => {
    expect(checkInProgress(EMPTY_CHECK_IN)).toBe(0);
    expect(nextCheckInQuestion(EMPTY_CHECK_IN)).toBe('sleep');
    const one = { ...EMPTY_CHECK_IN, sleep: 'good' as const };
    expect(checkInProgress(one)).toBe(1);
    expect(nextCheckInQuestion(one)).toBe('soreness');
    const two = { ...one, soreness: 'fresh' as const };
    expect(checkInProgress(two)).toBe(2);
    expect(nextCheckInQuestion(two)).toBe('motivation');
    const three = { ...two, motivation: 'flat' as const };
    expect(checkInProgress(three)).toBe(3);
    expect(nextCheckInQuestion(three)).toBeNull();
  });

  it('opens on the lift+RPE briefing with history readiness, not a subjective check-in', () => {
    const state = createSession(context());
    expect(state.phase).toBe('briefing');
    expect(state.readiness).not.toBeNull();
    const ignored = stepSession(state, {
      kind: 'check-in-tap',
      tap: { question: 'sleep', answer: 'good' },
    });
    expect(ignored.phase).toBe('briefing');
    expect(ignored.answers.sleep).toBe('good');
  });

  it('a briefing choose-lift retargets the session, including the e1RM the bar will be prescribed from', () => {
    const started = createSession(context({ lift: 'squat', e1rmKg: 200, bestE1rmKg: 200 }));
    const retargeted = stepSession(started, {
      kind: 'choose-lift',
      context: context({ lift: 'bench', e1rmKg: 140, bestE1rmKg: 140 }),
    });
    expect(retargeted).not.toBe(started);
    expect(retargeted.phase).toBe('briefing');
    expect(retargeted.context.lift).toBe('bench');
    expect(retargeted.context.e1rmKg).toBe(140);
    expect(retargeted.answers).toEqual(EMPTY_CHECK_IN);
  });

  it('ignores a choose-lift once an RPE has been chosen', () => {
    const lifting = stepSession(createSession(context({ lift: 'squat', e1rmKg: 200 })), {
      kind: 'choose-rpe',
      rpe: 8,
    });
    const retargeted = stepSession(lifting, {
      kind: 'choose-lift',
      context: context({ lift: 'bench', e1rmKg: 140, bestE1rmKg: 140 }),
    });
    expect(retargeted).toBe(lifting);
  });

  it('ignores a choose-lift that would change the day, or that names the lift already selected', () => {
    const started = createSession(context({ day: 4, lift: 'squat', e1rmKg: 200 }));
    expect(
      stepSession(started, {
        kind: 'choose-lift',
        context: context({ day: 5, lift: 'bench', e1rmKg: 140 }),
      }),
    ).toBe(started);
    expect(
      stepSession(started, {
        kind: 'choose-lift',
        context: context({ day: 4, lift: 'squat', e1rmKg: 999 }),
      }),
    ).toBe(started);
  });

  it('locks the lift once an RPE has been chosen', () => {
    const lifting = stepSession(createSession(context({ lift: 'squat', e1rmKg: 200 })), {
      kind: 'choose-rpe',
      rpe: 8,
    });
    expect(
      stepSession(lifting, {
        kind: 'choose-lift',
        context: context({ lift: 'bench', e1rmKg: 140, bestE1rmKg: 140 }),
      }),
    ).toBe(lifting);
  });

  it('a bench chosen on the check-in is the lift the mechanic is configured with', () => {
    const started = createSession(context({ lift: 'squat', e1rmKg: 200 }));
    const retargeted = stepSession(started, {
      kind: 'choose-lift',
      context: context({ lift: 'bench', e1rmKg: 140, bestE1rmKg: 140 }),
    });
    const lifting = stepSession(tapThrough(retargeted, NEUTRAL), { kind: 'choose-rpe', rpe: 8 });
    expect(repConfigFor(lifting).kind).toBe('bench');
  });

  it('surfaces "Grinding today" at the other end, GDD §3.2 verbatim', () => {
    const state = tapThrough(createSession(context()), WRECKED);
    expect(state.readiness?.headline).toBe('Grinding today');
    expect(state.readiness?.label).toBe('Grinding today -5%');
  });

  it('reports the surfaced modifier as a readout of the three taps and nothing else', () => {
    // Two lifters with wildly different hidden ledgers, identical taps.
    const heavy: FatigueState = recordSession(
      recordSession(EMPTY_FATIGUE_STATE, { day: -2, lift: 'squat', topRpe: 10, workSets: 8, repsPerSet: 5 }, UNLUCKIEST_ROLLS).state,
      { day: -1, lift: 'squat', topRpe: 10, workSets: 8, repsPerSet: 5 },
      UNLUCKIEST_ROLLS,
    ).state;
    const fresh = tapThrough(createSession(context()), PRIMED).readiness;
    const tired = tapThrough(createSession(context({ fatigue: heavy })), PRIMED).readiness;
    expect(tired).toEqual(fresh);
  });

  it('falls back to fatigue.ts’s own neutral before the taps land', () => {
    expect(checkInOrNeutral(createSession(context()))).toEqual({
      sleep: 'ok',
      soreness: 'normal',
      motivation: 'steady',
    });
  });
});

describe('prescription — GDD §3.3, RPE target in, weight out', () => {
  const steady = readinessCheckIn(NEUTRAL);

  it('reads the published chart at 3 reps and rounds down to a loadable bar', () => {
    // Hand-written from the published chart at 3 reps (rpe.ts RPE_PERCENT_CHART
    // row 3): RPE 6 81.1%, 7 83.7%, 8 86.3%, 9 89.2%, 10 92.2% of a 200 kg
    // e1RM, snapped DOWN to 2.5 kg.
    expect(prescribeSession(200, 'squat', 6, steady, 4).weightKg).toBe(160);
    expect(prescribeSession(200, 'squat', 7, steady, 4).weightKg).toBe(165);
    expect(prescribeSession(200, 'squat', 8, steady, 4).weightKg).toBe(172.5);
    expect(prescribeSession(200, 'squat', 9, steady, 4).weightKg).toBe(177.5);
    expect(prescribeSession(200, 'squat', 10, steady, 4).weightKg).toBe(182.5);
  });

  it('applies the readiness percentage to the bar — GDD §3.2’s "+5%"', () => {
    // 200 x 86.3% = 172.6. Primed +5% -> 181.23 -> 180. Ready +2% -> 176.05 ->
    // 175. Grinding -5% -> 163.97 -> 162.5.
    expect(prescribeSession(200, 'squat', 8, readinessCheckIn(PRIMED), 4).weightKg).toBe(180);
    expect(prescribeSession(200, 'squat', 8, readinessCheckIn(READY), 4).weightKg).toBe(175);
    expect(prescribeSession(200, 'squat', 8, readinessCheckIn(WRECKED), 4).weightKg).toBe(162.5);
  });

  it('reports the chart percentage it used, unrounded', () => {
    const plan = prescribeSession(200, 'bench', 9, steady, 4);
    expect(plan.percentOf1rm).toBe(89.2);
    expect(plan.loadAdjustmentPercent).toBe(0);
    expect(plan.loadRatio).toBeCloseTo(177.5 / 200, 10);
  });

  it('lets the chart’s own refusal through instead of clamping onto a cell', () => {
    // 13 reps @ RPE 6 is an effective rep max of 17, past the chart's coverage.
    expect(() => prescribeSession(200, 'squat', 6, steady, 4, 13)).toThrow(RangeError);
    // An RPE the chart has no column for.
    expect(() => prescribeSession(200, 'squat', 7.3, steady, 4)).toThrow(RangeError);
  });

  it('refuses a nonsense e1RM or set count rather than producing a bar', () => {
    expect(() => prescribeSession(0, 'squat', 8, steady, 4)).toThrow(RangeError);
    expect(() => prescribeSession(200, 'squat', 8, steady, 0)).toThrow(RangeError);
  });

  /**
   * One cell of the sweep below: a full set hit exactly on target, at one e1RM
   * and one rung, on one check-in.
   */
  function impliedFromTargetHit(
    e1rm: number,
    rpe: number,
    readiness: ReturnType<typeof readinessCheckIn>,
  ): number {
    const plan = prescribeSession(e1rm, 'squat', rpe, readiness, 1);
    const played = playedSetFrom(
      plan,
      1,
      Array.from({ length: plan.repsPerSet }, () => ({
        outcome: 'good-lift' as LiftOutcome,
        executionQuality: 1,
      })),
    );
    const report = played.report;
    expect(report, `${e1rm} kg @ RPE ${rpe}`).not.toBeNull();
    if (report === null) return Number.NaN;
    const implied = sessionE1rmFrom([report]);
    expect(implied, `${e1rm} kg @ RPE ${rpe}`).not.toBeNull();
    return implied?.e1rmKg ?? Number.NaN;
  }

  it('a target hit exactly reports below the base on a flat or negative check-in, and ABOVE it on a positive one', () => {
    // ---------------------------------------------------------------------
    // THIS PINS WHAT THE LOOP DOES, NOT WHAT IT SHOULD DO. READ BEFORE EDITING.
    // ---------------------------------------------------------------------
    // The previous version of this sweep ran 685 real iterations — and ran
    // every one of them on `steady`, the ONE check-in where the nudge is 0 and
    // a ratchet is arithmetically impossible. Its name claimed a property of
    // the loop; its fixture only ever exercised the case that was never at
    // risk. This runs the same ladder on every band the check-in can produce.
    //
    // WHAT IT FINDS, and it is a KNOWN GAP being recorded rather than endorsed:
    // on a positive check-in the prescribed bar is `chart% x (1 + nudge)`, the
    // estimate comes back through the same chart cell, and so a set hit exactly
    // on target reports an e1RM ABOVE the one it was prescribed from.
    // `nextBestE1rm` is monotone, so that becomes the best on record, and
    // tomorrow's bar is computed from it — see the compounding test below for
    // what that does over 30 sessions.
    //
    // That is not a defect in `e1rm.ts`, whose chart cancellation is correct
    // and deliberate. It is that the readiness nudge is a FLAT CONSTANT
    // (`FATIGUE_TUNING.READINESS_LOAD_ADJUSTMENT_PERCENT`) that is not yet
    // coupled to training stimulus. That coupling is a recorded dependency on
    // the fatigue/progression work (GDD §3.4): the nudge should scale with
    // RPE/effort history rather than being paid flat for three taps. When it
    // lands, THESE COUNTS ARE WHAT CHANGES, and they are written down here so
    // the change is loud instead of silent.
    const sweep = [
      { name: 'grinding', answers: WRECKED, band: 'grinding', nudge: -5, above: 0, below: 685 },
      { name: 'steady', answers: NEUTRAL, band: 'steady', nudge: 0, above: 0, below: 685 },
      { name: 'ready', answers: READY, band: 'ready', nudge: 2, above: 634, below: 51 },
      { name: 'primed', answers: PRIMED, band: 'primed', nudge: 5, above: 685, below: 0 },
    ] as const;

    let cells = 0;
    for (const row of sweep) {
      const readiness = readinessCheckIn(row.answers);
      // The fixture really is the band it claims to be. Without this the counts
      // below could all be measuring the same check-in four times.
      expect(readiness.band, row.name).toBe(row.band);
      expect(readiness.loadAdjustmentPercent, row.name).toBe(row.nudge);

      let above = 0;
      let below = 0;
      let equal = 0;
      for (let e1rm = 60; e1rm <= 400; e1rm += 2.5) {
        for (const rpe of SESSION_TUNING.RPE_CHOICES) {
          const implied = impliedFromTargetHit(e1rm, rpe, readiness);
          if (implied > e1rm) above += 1;
          else if (implied < e1rm) below += 1;
          else equal += 1;
          cells += 1;
        }
      }
      expect(above + below + equal, `${row.name} covered every cell`).toBe(685);
      // Rounding DOWN never lands exactly on the base: the bar is snapped to a
      // loadable increment, so something is always lost or gained.
      expect(equal, `${row.name} exact`).toBe(0);
      expect(above, `${row.name} ratcheted`).toBe(row.above);
      expect(below, `${row.name} held or lost`).toBe(row.below);
    }
    expect(cells).toBe(685 * sweep.length);

    // Named cells, hand-computed against the table above, so the counts cannot
    // all drift together without one of these moving too.
    //   grinding, 200 kg @ RPE 8: 200 x 86.3% x 0.95 = 163.97 -> 162.5 -> /0.863
    expect(impliedFromTargetHit(200, 8, readinessCheckIn(WRECKED))).toBeCloseTo(188.2966, 4);
    //   steady,   200 kg @ RPE 8: 172.6 -> 172.5 -> /0.863
    expect(impliedFromTargetHit(200, 8, readinessCheckIn(NEUTRAL))).toBeCloseTo(199.8841, 4);
    //   primed,   200 kg @ RPE 8: 181.23 -> 180 -> /0.863. ABOVE the 200 it came from.
    expect(impliedFromTargetHit(200, 8, readinessCheckIn(PRIMED))).toBeCloseTo(208.5747, 4);
    //   ready is the one band where rounding can still swallow the nudge: at
    //   145 kg @ RPE 6 the bar is 117.595, +2% takes it to 119.947, and
    //   snapping DOWN to 117.5 gives back less than it added. All 51 of the
    //   `below` cells counted above are this shape.
    expect(impliedFromTargetHit(145, 6, readinessCheckIn(READY))).toBeCloseTo(144.8829, 4);
  });

  it('and that ratchet COMPOUNDS: 30 on-target primed sessions take a 200 kg squat past 770 kg', () => {
    // The measured arithmetic of a HANDED-IN percent — the same four calls
    // `prescribeSession` makes — with the next day's prescription computed
    // from the number the last one minted. This is still what the function
    // does. It is no longer the player path; see the test below.
    function thirtySessions(
      answers: ReadinessCheckIn,
      rpe: number,
    ): { readonly best: number; readonly prs: number } {
      let best: number | null = 200;
      let prs = 0;
      for (let session = 0; session < 30; session += 1) {
        const plan = prescribeSession(
          best ?? 200,
          'squat',
          rpe,
          readinessCheckIn(answers),
          SESSION_TUNING.WORK_SETS,
        );
        const reports = [];
        for (let s = 0; s < plan.workSets; s += 1) {
          const played = playedSetFrom(
            plan,
            s + 1,
            Array.from({ length: plan.repsPerSet }, () => ({
              outcome: 'good-lift' as LiftOutcome,
              executionQuality: 1,
            })),
          );
          if (played.report !== null) reports.push(played.report);
        }
        const before = best;
        best = nextBestE1rm(best, sessionE1rmFrom(reports));
        if (best !== null && (before === null || best > before)) prs += 1;
      }
      return { best: best ?? Number.NaN, prs };
    }

    // The one case the old sweep covered, and the only one that holds still.
    for (const rpe of SESSION_TUNING.RPE_CHOICES) {
      const flat = thirtySessions(NEUTRAL, rpe);
      expect(flat.best, `steady RPE ${rpe}`).toBe(200);
      expect(flat.prs, `steady RPE ${rpe}`).toBe(0);
    }

    // And what the nudged path really does. Every rung, every session a PR.
    const measured: readonly (readonly [number, number])[] = [
      [6, 770.65],
      [7, 767.62],
      [8, 770.57],
      [9, 770.74],
      [10, 780.91],
    ];
    for (const [rpe, expected] of measured) {
      const run = thirtySessions(PRIMED, rpe);
      expect(run.best, `primed RPE ${rpe}`).toBeCloseTo(expected, 2);
      // A PR every single session. GDD §7.2 hangs the cut-in beat off PR
      // moments and says scarcity "is the entire mechanic"; at today's tuning
      // there is none, and this is the number that says so.
      expect(run.prs, `primed RPE ${rpe}`).toBe(30);
    }

    // `MAX_E1RM_GAIN_FRACTION_PER_SESSION` is 6% against a 5% nudge, so the
    // one guard in the path never binds. Stated as an assertion rather than as
    // a comment, because it is why the climb above is unchecked.
    expect(SESSION_PROGRESSION_GUARD.MAX_E1RM_GAIN_FRACTION_PER_SESSION).toBeGreaterThan(
      FATIGUE_TUNING.READINESS_LOAD_ADJUSTMENT_PERCENT.primed / 100,
    );
  });

  it('the player path never mints that ratchet from check-in taps — GDD §3.4', () => {
    const primed = runSession(context(), PRIMED, 8, ALL_GOOD);
    const neutral = runSession(context(), NEUTRAL, 8, ALL_GOOD);
    expect(primed.plan?.loadAdjustmentPercent).toBe(0);
    expect(primed.plan?.weightKg).toBe(neutral.plan?.weightKg);
    expect(primed.closeOut?.isPr).toBe(false);
    expect(neutral.closeOut?.isPr).toBe(false);
  });

  it('player-path growth is thresholded credit, not taps or a harder menu pick', () => {
    const missOnce = runSession(context(), NEUTRAL, 8, (set, rep) =>
      set === SESSION_TUNING.WORK_SETS - 1 && rep === 0 ? 'miss' : 'good-lift',
    );
    const fullOnce = runSession(context(), NEUTRAL, 8, ALL_GOOD);
    const missRecord = fatigueRecordFor(0, 'squat', missOnce.closeOut!.sets);
    const fullRecord = fatigueRecordFor(0, 'squat', fullOnce.closeOut!.sets);
    expect(missRecord?.workSets).toBe(SESSION_TUNING.WORK_SETS - 1);
    expect(fullRecord?.workSets).toBe(SESSION_TUNING.WORK_SETS);
    expect(sessionStimulusCredit(missRecord!)).toBeLessThan(sessionStimulusCredit(fullRecord!));

    const failHigh = runSession(
      context({ trainingProgressCredit: CREDIT_FOR_A_PLATE }),
      NEUTRAL,
      10,
      (_set, rep) => (rep === SESSION_TUNING.REPS_PER_SET - 1 ? 'miss' : 'good-lift'),
    );
    expect(failHigh.closeOut?.isPr).toBe(false);
    const eight = runSession(context({ trainingProgressCredit: CREDIT_FOR_A_PLATE }), NEUTRAL, 8, ALL_GOOD);
    expect(eight.closeOut?.isPr).toBe(true);
    expect(eight.plan?.loadAdjustmentPercent).toBe(0);
    const ordinary = progressionOffer({ credit: 0, e1rmKg: 200, targetRpe: 8 });
    const paid = progressionOffer({ credit: CREDIT_FOR_A_PLATE, e1rmKg: 200, targetRpe: 8 });
    expect(eight.plan?.weightKg).toBe(paid.nudgedWeightKg);
    expect(paid.nudgedWeightKg).toBeGreaterThan(ordinary.unNudgedWeightKg);

    const primed = runSession(context({ trainingProgressCredit: CREDIT_FOR_A_PLATE }), PRIMED, 8, ALL_GOOD);
    const wrecked = runSession(context({ trainingProgressCredit: CREDIT_FOR_A_PLATE }), WRECKED, 8, ALL_GOOD);
    expect(wrecked.plan?.weightKg).toBe(primed.plan?.weightKg);
    expect(wrecked.closeOut?.isPr).toBe(primed.closeOut?.isPr);
  });

  it('offers RPE 8 by default', () => {
    expect(defaultRpeChoice()).toBe(8);
  });
});

const MATRIX_CLOCK = { year: 2026, month: 8, day: 3, hour: 19 };

describe('credit pacing matrix — GDD §3.4 red-team', () => {
  interface PathStats {
    readonly name: string;
    readonly sessions: number;
    readonly start: number;
    readonly end: number;
    readonly gain: number;
    readonly pct: number;
    readonly prs: number;
    readonly longestPrStreak: number;
    readonly meanSessionsBetweenPrs: number | null;
    readonly missedSets: number;
    readonly rpeCounts: Readonly<Record<number, number>>;
    readonly creditEarned: number;
    readonly creditConsumed: number;
    readonly pending: number;
    readonly snappedWeights: readonly number[];
  }

  function seededRecord(): ServerRecord {
    const fresh = newServerRecord(SIGNUP_DAY);
    return {
      ...fresh,
      bestE1rmKg: { squat: 200, bench: 200, deadlift: 200 },
    };
  }

  function playPath(args: {
    readonly name: string;
    readonly sessions: number;
    readonly rpeFor: (sessionIndex: number, lift: LiftKind) => number;
    readonly answersFor?: (sessionIndex: number) => ReadinessCheckIn;
    readonly outcomeFor?: (setIndex: number, repIndex: number) => LiftOutcome;
    readonly rotate?: boolean;
    readonly trackLift?: LiftKind;
  }): PathStats {
    const start = 200;
    let record = seededRecord();
    const track = args.trackLift ?? 'squat';
    let prs = 0;
    let streak = 0;
    let longest = 0;
    const prDays: number[] = [];
    let missedSets = 0;
    const rpeCounts: Record<number, number> = { 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 };
    let creditEarned = 0;
    let creditConsumed = 0;
    const snappedWeights: number[] = [];
    const answersFor = args.answersFor ?? ((): ReadinessCheckIn => NEUTRAL);
    const outcomeFor = args.outcomeFor ?? ALL_GOOD;
    for (let i = 0; i < args.sessions; i += 1) {
      const day = i;
      const lift = args.rotate === true ? liftForDay(day) : track;
      const best = record.bestE1rmKg[lift] ?? start;
      const credit = creditForLift(record.trainingProgressCredit ?? EMPTY_TRAINING_PROGRESS_CREDIT, lift);
      const rpe = args.rpeFor(i, lift);
      if (lift === track) rpeCounts[rpe] = (rpeCounts[rpe] ?? 0) + 1;
      const state = runSession(
        context({
          day,
          e1rmKg: best,
          bestE1rmKg: best,
          fatigue: record.fatigue,
          trainingProgressCredit: credit,
          lift,
        }),
        answersFor(i),
        rpe,
        outcomeFor,
      );
      const closeOut = state.closeOut;
      if (closeOut === null) throw new Error(`${args.name} day ${day} produced no close-out`);
      if (lift === track) {
        missedSets += closeOut.sets.filter((row) => row.rpe >= 10 && row.reps < SESSION_TUNING.REPS_PER_SET).length;
        missedSets += SESSION_TUNING.WORK_SETS - closeOut.sets.length;
        if (state.plan !== null) snappedWeights.push(state.plan.weightKg);
      }
      const proposal = sessionProposal(closeOut, MATRIX_CLOCK);
      if (proposal === null) continue;
      const applied = applyTrainingSession(record, day, proposal, `${args.name}-${i}`);
      if (!applied.ok) throw new Error(`${args.name} day ${day}: ${applied.error.message}`);
      record = applied.value.record;
      if (lift === track) {
        creditEarned += applied.value.trainingProgress.earned;
        creditConsumed += applied.value.trainingProgress.consumed;
        if (applied.value.isPr) {
          prs += 1;
          streak += 1;
          if (streak > longest) longest = streak;
          prDays.push(i);
        } else {
          streak = 0;
        }
      }
    }
    const end = record.bestE1rmKg[track] ?? start;
    let meanGap: number | null = null;
    if (prDays.length >= 2) {
      let gaps = 0;
      for (let i = 1; i < prDays.length; i += 1) gaps += prDays[i]! - prDays[i - 1]!;
      meanGap = gaps / (prDays.length - 1);
    }
    return {
      name: args.name,
      sessions: args.sessions,
      start,
      end,
      gain: end - start,
      pct: ((end - start) / start) * 100,
      prs,
      longestPrStreak: longest,
      meanSessionsBetweenPrs: meanGap,
      missedSets,
      rpeCounts,
      creditEarned,
      creditConsumed,
      pending: creditForLift(record.trainingProgressCredit ?? EMPTY_TRAINING_PROGRESS_CREDIT, track),
      snappedWeights,
    };
  }

  it('30 / 90 / 180 sessions: credit is scarce; always-10 does not dominate; failing does not pay', { timeout: 60_000 }, () => {
    const lastRepMiss: (set: number, rep: number) => LiftOutcome = (_set, rep) =>
      rep === SESSION_TUNING.REPS_PER_SET - 1 ? 'miss' : 'good-lift';
    const lastSetMiss: (set: number, rep: number) => LiftOutcome = (set, rep) =>
      set === SESSION_TUNING.WORK_SETS - 1 && rep === 0 ? 'miss' : 'good-lift';

    const at = (
      sessions: number,
      name: string,
      rpe: number,
      outcome: (set: number, rep: number) => LiftOutcome = ALL_GOOD,
    ): PathStats =>
      playPath({
        name: `${sessions} ${name}`,
        sessions,
        rpeFor: () => rpe,
        outcomeFor: outcome,
      });

    const rpe6_30 = at(30, 'always-6', 6);
    const rpe7_30 = at(30, 'always-7', 7);
    const rpe8_30 = at(30, 'always-8', 8);
    const rpe9_30 = at(30, 'always-9', 9);
    const rpe10_30 = at(30, 'always-10', 10);
    const lastMiss_30 = playPath({
      name: '30 last-set-miss-8',
      sessions: 30,
      rpeFor: () => 8,
      outcomeFor: lastSetMiss,
    });
    const fail10_30 = playPath({
      name: '30 fail-high-10',
      sessions: 30,
      rpeFor: () => 10,
      outcomeFor: lastRepMiss,
    });
    const alt_30 = playPath({
      name: '30 alt-6-9',
      sessions: 30,
      rpeFor: (i) => (i % 2 === 0 ? 6 : 9),
    });
    const mix_30 = playPath({
      name: '30 mixed-7-8-9',
      sessions: 30,
      rpeFor: (i) => ([7, 8, 9] as const)[i % 3]!,
    });
    const primed_30 = playPath({
      name: '30 rpe8-primed',
      sessions: 30,
      rpeFor: () => 8,
      answersFor: () => PRIMED,
    });
    const wrecked_30 = playPath({
      name: '30 rpe8-wrecked',
      sessions: 30,
      rpeFor: () => 8,
      answersFor: () => WRECKED,
    });

    // First session cannot mint: 30 always-6 holds; always-8 is scarce.
    expect(rpe6_30.end).toBe(200);
    expect(rpe6_30.prs).toBe(0);
    expect(rpe6_30.creditEarned).toBe(0);
    expect(rpe8_30.end).toBeGreaterThan(200);
    expect(rpe8_30.end).toBeLessThan(500);
    expect(rpe8_30.pct).toBeGreaterThanOrEqual(2);
    expect(rpe8_30.pct).toBeLessThanOrEqual(6);
    expect(rpe8_30.prs).toBeGreaterThan(0);
    expect(rpe8_30.prs).toBeLessThanOrEqual(10);
    expect(rpe8_30.longestPrStreak).toBeLessThanOrEqual(2);

    expect(rpe7_30.end).toBeGreaterThan(200);
    expect(rpe7_30.end).toBeLessThan(rpe8_30.end);

    const productive30 = [rpe8_30.end, rpe9_30.end, rpe10_30.end];
    expect(Math.min(...productive30) / Math.max(...productive30)).toBeGreaterThan(0.95);
    expect(rpe10_30.end).toBeLessThanOrEqual(Math.max(rpe8_30.end, rpe9_30.end) + 5);
    expect(fail10_30.end).toBe(200);
    expect(fail10_30.creditEarned).toBe(0);
    expect(fail10_30.end).toBeLessThan(rpe8_30.end);
    expect(lastMiss_30.end).toBeGreaterThan(200);
    expect(lastMiss_30.end).toBeLessThanOrEqual(rpe8_30.end);
    expect(lastMiss_30.creditEarned).toBeLessThan(rpe8_30.creditEarned);
    expect(alt_30.end).toBeGreaterThan(rpe6_30.end);
    expect(alt_30.end).toBeLessThanOrEqual(rpe8_30.end);
    expect(mix_30.end).toBeGreaterThan(200);
    expect(primed_30.end).toBe(wrecked_30.end);
    expect(primed_30.pending).toBe(wrecked_30.pending);

    const rpe8_90 = at(90, 'always-8', 8);
    const rpe10_90 = at(90, 'always-10', 10);
    const fail10_90 = at(90, 'fail-high-10', 10, lastRepMiss);
    const lastMiss_90 = playPath({
      name: '90 last-set-miss-8',
      sessions: 90,
      rpeFor: () => 8,
      outcomeFor: lastSetMiss,
    });
    const rpe8_180 = at(180, 'always-8', 8);
    const rpe10_180 = at(180, 'always-10', 10);
    const fail10_180 = at(180, 'fail-high-10', 10, lastRepMiss);
    const lastMiss_180 = playPath({
      name: '180 last-set-miss-8',
      sessions: 180,
      rpeFor: () => 8,
      outcomeFor: lastSetMiss,
    });

    expect(rpe8_90.pct).toBeGreaterThanOrEqual(7);
    expect(rpe8_90.pct).toBeLessThanOrEqual(15);
    expect(rpe8_90.end).toBeGreaterThan(rpe8_30.end);
    expect(rpe10_90.end / rpe8_90.end).toBeLessThan(1.05);
    expect(fail10_90.end).toBe(200);
    expect(lastMiss_90.end).toBeLessThan(rpe8_90.end);

    expect(rpe8_180.pct).toBeLessThan(30);
    expect(rpe8_180.end).toBeGreaterThan(rpe8_90.end);
    expect(rpe10_180.end / rpe8_180.end).toBeLessThan(1.05);
    expect(fail10_180.end).toBe(200);
    expect(lastMiss_180.end).toBeLessThan(rpe8_180.end);

    const rotate90 = playPath({
      name: '90 rotate-8',
      sessions: 90,
      rpeFor: () => 8,
      rotate: true,
      trackLift: 'squat',
    });
    const rotate180 = playPath({
      name: '180 rotate-8',
      sessions: 180,
      rpeFor: () => 8,
      rotate: true,
      trackLift: 'squat',
    });
    // 90 calendar days of a 3-lift rotation is 30 squat sessions.
    expect(rotate90.end / rpe8_30.end).toBeGreaterThan(0.95);
    expect(rotate90.end / rpe8_30.end).toBeLessThan(1.05);
    expect(rotate180.end).toBeGreaterThan(rotate90.end);
    expect(rotate180.end).toBeLessThan(rpe8_90.end);

    expect(rpe8_30.rpeCounts[8]).toBe(30);
    expect(fail10_30.missedSets).toBeGreaterThan(0);
    expect(lastMiss_30.missedSets).toBeGreaterThan(0);
    expect(rpe8_30.creditConsumed).toBeGreaterThan(0);
    expect(rpe8_30.pending).toBeGreaterThanOrEqual(0);
  });

  it('architecture: first session cannot mint; failed opportunity does not burn the bank', () => {
    const first = playPath({ name: '1 always-8', sessions: 1, rpeFor: () => 8 });
    expect(first.end).toBe(200);
    expect(first.prs).toBe(0);
    expect(first.creditEarned).toBe(1);
    expect(first.creditConsumed).toBe(0);
    expect(first.pending).toBe(1);

    // Bank 12, miss the session: consume 0, keep the bank, earn 0 for failure-only.
    let record = seededRecord();
    record = {
      ...record,
      trainingProgressCredit: { squat: CREDIT_FOR_A_PLATE, bench: 0, deadlift: 0 },
    };
    const miss = runSession(
      context({
        trainingProgressCredit: CREDIT_FOR_A_PLATE,
        e1rmKg: 200,
        bestE1rmKg: 200,
        fatigue: record.fatigue,
      }),
      NEUTRAL,
      8,
      (_set, rep) => (rep === SESSION_TUNING.REPS_PER_SET - 1 ? 'miss' : 'good-lift'),
    );
    const proposal = sessionProposal(miss.closeOut!, MATRIX_CLOCK)!;
    const applied = applyTrainingSession(record, 0, proposal, 'miss-bank');
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.value.trainingProgress.consumed).toBe(0);
    expect(applied.value.isPr).toBe(false);
    expect(applied.value.record.trainingProgressCredit.squat).toBeGreaterThanOrEqual(CREDIT_FOR_A_PLATE);
  });
});

describe('an injury shortens a session and can never cost a day — GDD §3.5', () => {
  it('caps work sets on the injured lift and leaves other lifts alone', () => {
    const injured = recordSession(
      EMPTY_FATIGUE_STATE,
      { day: 0, lift: 'squat', topRpe: 10, workSets: 8, repsPerSet: 5 },
      UNLUCKIEST_ROLLS,
    );
    expect(injured.injuryOnset).not.toBeNull();
    const state = injured.state;
    const uninjured = workSetsForToday(context({ day: 1, fatigue: EMPTY_FATIGUE_STATE }), 8);
    const capped = workSetsForToday(context({ day: 1, lift: 'squat', fatigue: state }), 8);
    const otherLift = workSetsForToday(context({ day: 1, lift: 'bench', fatigue: state }), 8);
    expect(uninjured).toBe(SESSION_TUNING.WORK_SETS);
    expect(capped).toBeLessThan(uninjured);
    expect(capped).toBeGreaterThanOrEqual(1);
    expect(otherLift).toBe(uninjured);
  });

  it('still produces a session that can be logged, so the streak survives', () => {
    const injured = recordSession(
      EMPTY_FATIGUE_STATE,
      { day: 0, lift: 'squat', topRpe: 10, workSets: 8, repsPerSet: 5 },
      UNLUCKIEST_ROLLS,
    ).state;
    const state = runSession(
      context({ day: 1, lift: 'squat', fatigue: injured }),
      NEUTRAL,
      8,
      ALL_GOOD,
    );
    expect(state.phase).toBe('close-out');
    expect(state.closeOut?.canPropose).toBe(true);
    expect(state.closeOut?.streakAfter).toBe(5);
  });
});

/** A minimal `LiftResolution`, for testing `executionQualityFrom` in isolation. */
function resolutionWith(timings: readonly InputTiming[]): LiftResolution {
  return {
    outcome: 'good-lift',
    missReason: null,
    peakHeight: 1,
    depthAchieved: true,
    ascentTicks: 40,
    stallTicks: 0,
    timings,
    headline: 'GOOD LIFT',
    detail: '',
  };
}

/** One `InputTiming`, filling in the fields this file's tests never vary. */
function timing(cue: 'depth' | 'drive', quality: number): InputTiming {
  return { cue, tick: 0, offsetMs: 0, quality, grade: 'perfect' };
}

describe('executionQualityFrom', () => {
  it('averages the DRIVE cues only — a depth-cue timing never moves it', () => {
    // Depth quality 0.1, drive quality 0.9: if depth leaked into the
    // average this would read well below 0.9, not equal to it.
    const quality = executionQualityFrom(
      resolutionWith([timing('depth', 0.1), timing('drive', 0.9)]),
    );
    expect(quality).toBeCloseTo(0.9, 10);
  });

  it('averages every drive cue in a multi-cue rep, not just the first or the last', () => {
    const quality = executionQualityFrom(
      resolutionWith([timing('drive', 1), timing('drive', 0.5), timing('drive', 0)]),
    );
    expect(quality).toBeCloseTo(0.5, 10);
  });

  it('reads as full quality when the rep never needed a drive cue at all', () => {
    // Reachable at light loads, where `ascentDemand` never goes negative and
    // the bar rises without a boost — nothing was asked of the lifter, so
    // nothing was botched.
    expect(executionQualityFrom(resolutionWith([timing('depth', 1)]))).toBe(1);
    expect(executionQualityFrom(resolutionWith([]))).toBe(1);
  });
});

describe('a worse-executed rep banks a smaller gain — driven end to end from a REAL simulated rep, not a hand-built quality literal', () => {
  // Measured, not assumed: at loadRatio 0.75, pressing the drive 6 ticks off
  // its ideal tick still makes the rep (outcome stays 'good-lift') but reads
  // quality 0.4006 rather than 1 — the exact "imperfect but still a make"
  // case this claim needs. Found by sweeping offsets at three loads before
  // writing this test; 0/2/4 ticks off were all too close to 1 to be a
  // useful control, and 8+ ticks missed outright at this load.
  const IMPERFECT_OFFSET_TICKS = 6;
  const LOAD_RATIO = 0.75;
  const SEED = 20260820;

  function playedReport(offsetTicks: number): { readonly quality: number; readonly report: TrainingSetReport } {
    const config: LiftConfig = { kind: 'squat', loadRatio: LOAD_RATIO, seed: SEED };
    let state: LiftState = createLift(config);
    let ticks = 0;
    while (state.phase !== 'RESOLVED' && ticks < 1000) {
      let input: LiftInput | null = null;
      const cue = state.activeCue;
      const nextTick = state.tick + 1;
      if (state.phase === 'BRACE' && !state.held) {
        input = { kind: 'press' };
      } else if (cue !== null && nextTick === cue.idealTick + offsetTicks) {
        input = { kind: cue.wants };
      }
      state = stepLift(state, input);
      ticks += 1;
    }
    const resolution = state.resolution;
    if (resolution === null) throw new Error('fixture rep never resolved');
    expect(resolution.outcome, 'fixture must be a MADE rep, not a miss').not.toBe('miss');
    const quality = executionQualityFrom(resolution);
    const plan = prescribeSession(200, 'squat', 8, readinessCheckIn(NEUTRAL), 1);
    const played = playedSetFrom(plan, 1, [{ outcome: resolution.outcome, executionQuality: quality }]);
    if (played.report === null) throw new Error('fixture rep produced no report');
    return { quality, report: played.report };
  }

  it('the imperfect rep really is imperfect, measured off the real sim, not asserted', () => {
    const perfect = playedReport(0);
    const imperfect = playedReport(IMPERFECT_OFFSET_TICKS);
    expect(perfect.quality).toBe(1);
    expect(imperfect.quality).toBeCloseTo(0.4006, 3);
    expect(imperfect.quality).toBeLessThan(perfect.quality);
  });

  it('carries a smaller e1RM gain all the way to nextBestE1rm, both estimates run through sessionE1rmFrom for real', () => {
    const perfect = playedReport(0);
    const imperfect = playedReport(IMPERFECT_OFFSET_TICKS);
    // Both reports imply the SAME raw e1RM (same weight/reps/rpe — only
    // executionQuality differs), and it is set up to exceed the cap, so any
    // difference in the banked number is entirely the quality scaling, not a
    // difference in what was lifted.
    expect(perfect.report.weight).toBe(imperfect.report.weight);
    expect(perfect.report.reps).toBe(imperfect.report.reps);
    expect(perfect.report.rpe).toBe(imperfect.report.rpe);

    const held = 100; // low enough that the implied estimate is well past the cap
    const perfectEstimate = sessionE1rmFrom([perfect.report]);
    const imperfectEstimate = sessionE1rmFrom([imperfect.report]);
    expect(perfectEstimate).not.toBeNull();
    expect(imperfectEstimate).not.toBeNull();
    expect(perfectEstimate?.e1rmKg).toBeCloseTo(imperfectEstimate?.e1rmKg ?? Number.NaN, 6);
    expect(perfectEstimate?.executionQuality).toBe(1);
    expect(imperfectEstimate?.executionQuality).toBeCloseTo(0.4006, 3);

    const perfectBanked = nextBestE1rm(held, perfectEstimate);
    const imperfectBanked = nextBestE1rm(held, imperfectEstimate);
    expect(perfectBanked).not.toBeNull();
    expect(imperfectBanked).not.toBeNull();
    expect(imperfectBanked ?? Number.NaN).toBeLessThan(perfectBanked ?? Number.NaN);
    expect(perfectBanked).toBeCloseTo(
      held * (1 + SESSION_PROGRESSION_GUARD.MAX_E1RM_GAIN_FRACTION_PER_SESSION),
      9,
    );
    const { MIN_E1RM_GAIN_FRACTION_PER_SESSION, MAX_E1RM_GAIN_FRACTION_PER_SESSION } =
      SESSION_PROGRESSION_GUARD;
    expect(imperfectBanked).toBeCloseTo(
      held *
        (1 +
          MIN_E1RM_GAIN_FRACTION_PER_SESSION +
          (MAX_E1RM_GAIN_FRACTION_PER_SESSION - MIN_E1RM_GAIN_FRACTION_PER_SESSION) * 0.4006),
      3,
    );
  });
});

describe('playing a set', () => {
  const steady = readinessCheckIn(NEUTRAL);
  const plan = prescribeSession(200, 'squat', 8, steady, 4);

  it('reports every completed rep at the target RPE when the set is finished', () => {
    const played = playedSetFrom(plan, 1, [
      { outcome: 'good-lift', executionQuality: 1 },
      { outcome: 'grind', executionQuality: 1 },
      { outcome: 'good-lift', executionQuality: 1 },
    ]);
    expect(played.goodReps).toBe(3);
    expect(played.wentToFailure).toBe(false);
    expect(played.report).toEqual({
      lift: 'squat',
      weight: 172.5,
      reps: 3,
      rpe: 8,
      executionQuality: 1,
    });
  });

  it('averages execution quality over the GOOD reps only, and rounds to the module precision', () => {
    // A missed rep contributes nothing to the average — there was no
    // successful drive to grade — so this is (0.9 + 0.6) / 2, not / 3. The
    // missed rep's OWN quality is a non-zero 0.8 deliberately: a miss can
    // still carry a decent raw reading (a well-timed drive on a rep that
    // failed for depth, say), so a nonzero value here is what actually tells
    // a mutant that folds it into the sum apart from one that doesn't.
    const played = playedSetFrom(plan, 1, [
      { outcome: 'good-lift', executionQuality: 0.9 },
      { outcome: 'miss', executionQuality: 0.8 },
      { outcome: 'good-lift', executionQuality: 0.6 },
    ]);
    expect(played.report?.executionQuality).toBeCloseTo(0.75, 10);
  });

  it('reports a set that met failure at RPE 10 for the reps that were made', () => {
    const played = playedSetFrom(plan, 2, [
      { outcome: 'good-lift', executionQuality: 1 },
      { outcome: 'miss', executionQuality: 0 },
    ]);
    expect(played.goodReps).toBe(1);
    expect(played.wentToFailure).toBe(true);
    // RPE 10 is not an estimate of how hard it was — on a reps-in-reserve chart
    // it is what "the next rep failed" MEANS.
    expect(played.report).toEqual({
      lift: 'squat',
      weight: 172.5,
      reps: 1,
      rpe: 10,
      executionQuality: 1,
    });
  });

  it('reports nothing at all for a set with no completed rep', () => {
    const played = playedSetFrom(plan, 3, [{ outcome: 'miss', executionQuality: 0 }]);
    expect(played.goodReps).toBe(0);
    expect(played.report).toBeNull();
  });

  it('a high squat is a red light, not a rep', () => {
    expect(isMadeRep('good-lift')).toBe(true);
    expect(isMadeRep('grind')).toBe(true);
    expect(isMadeRep('miss')).toBe(false);
  });

  it('ends the set on the first miss and moves to the next one', () => {
    let state = stepSession(tapThrough(createSession(context()), NEUTRAL), {
      kind: 'choose-rpe',
      rpe: 8,
    });
    expect(state.phase).toBe('set');
    state = stepSession(state, { kind: 'rep-resolved', outcome: 'good-lift', executionQuality: 1 });
    expect(state.phase).toBe('set');
    expect(state.repIndex).toBe(1);
    state = stepSession(state, { kind: 'rep-resolved', outcome: 'miss', executionQuality: 0 });
    expect(state.phase).toBe('rest');
    expect(state.setIndex).toBe(1);
    expect(state.completedSets).toHaveLength(1);
    expect(state.completedSets[0]?.goodReps).toBe(1);
  });

  it('a miss on the last set still closes out, at the same load', () => {
    let state = stepSession(createSession(context()), { kind: 'choose-rpe', rpe: 8 });
    const load = state.plan?.weightKg;
    expect(load).toBeGreaterThan(0);
    const lastSet = SESSION_TUNING.WORK_SETS - 1;
    while (state.setIndex < lastSet) {
      if (state.phase === 'rest') {
        state = stepSession(state, { kind: 'begin-set' });
        continue;
      }
      state = stepSession(state, { kind: 'rep-resolved', outcome: 'good-lift', executionQuality: 1 });
    }
    if (state.phase === 'rest') state = stepSession(state, { kind: 'begin-set' });
    expect(state.phase).toBe('set');
    expect(state.setIndex).toBe(lastSet);
    state = stepSession(state, { kind: 'rep-resolved', outcome: 'miss', executionQuality: 0 });
    expect(state.phase).toBe('close-out');
    expect(state.plan?.weightKg).toBe(load);
    expect(state.closeOut?.canPropose).toBe(true);
    expect(state.closeOut?.sets).toHaveLength(lastSet);
  });

  it('counts the set number for copy from one', () => {
    let state = stepSession(tapThrough(createSession(context()), NEUTRAL), {
      kind: 'choose-rpe',
      rpe: 8,
    });
    expect(currentSetNumber(state)).toBe(1);
    for (let i = 0; i < SESSION_TUNING.REPS_PER_SET; i += 1) {
      state = stepSession(state, { kind: 'rep-resolved', outcome: 'good-lift', executionQuality: 1 });
    }
    expect(currentSetNumber(state)).toBe(2);
  });
});

describe('the rep the mechanic is handed', () => {
  it('carries the prescribed load ratio, the session feel and where in the session it is', () => {
    let state = stepSession(tapThrough(createSession(context()), NEUTRAL), {
      kind: 'choose-rpe',
      rpe: 8,
    });
    const first = repConfigFor(state);
    expect(first.loadRatio).toBeCloseTo(172.5 / 200, 10);
    expect(first.feel).toBe(state.feel);
    expect(first.moment).toEqual({ workSetsCompleted: 0, repsCompletedInSet: 0 });

    state = stepSession(state, { kind: 'rep-resolved', outcome: 'good-lift', executionQuality: 1 });
    expect(liftMomentFor(state)).toEqual({ workSetsCompleted: 0, repsCompletedInSet: 1 });
    for (let i = 1; i < SESSION_TUNING.REPS_PER_SET; i += 1) {
      state = stepSession(state, { kind: 'rep-resolved', outcome: 'good-lift', executionQuality: 1 });
    }
    state = stepSession(state, { kind: 'begin-set' });
    expect(liftMomentFor(state)).toEqual({ workSetsCompleted: 1, repsCompletedInSet: 0 });
  });

  it('gives every rep of a session a different seed, deterministically', () => {
    const seeds = new Set<number>();
    for (let set = 0; set < SESSION_TUNING.WORK_SETS; set += 1) {
      for (let rep = 0; rep < SESSION_TUNING.REPS_PER_SET; rep += 1) {
        seeds.add(repSeed(19000, set, rep));
      }
    }
    expect(seeds.size).toBe(SESSION_TUNING.WORK_SETS * SESSION_TUNING.REPS_PER_SET);
    expect(repSeed(19000, 0, 0)).toBe(repSeed(19000, 0, 0));
    expect(repSeed(19000, 0, 0)).not.toBe(repSeed(19001, 0, 0));
  });

  it('narrows the input window as the session goes on — GDD §3.4, no meter', () => {
    // The window is the channel §3.4 permits fatigue to surface through. The
    // measurement is in milliseconds off `lift.ts`, which is a mechanic
    // parameter; nothing exposes the burden behind it.
    let state = stepSession(tapThrough(createSession(context()), NEUTRAL), {
      kind: 'choose-rpe',
      rpe: 8,
    });
    const firstRep = cueWindowMs('drive', repConfigFor(state));
    let guard = 0;
    while (state.setIndex < SESSION_TUNING.WORK_SETS - 1 && guard < 100) {
      guard += 1;
      if (state.phase === 'rest') {
        state = stepSession(state, { kind: 'begin-set' });
        continue;
      }
      state = stepSession(state, { kind: 'rep-resolved', outcome: 'good-lift', executionQuality: 1 });
    }
    const lastSet = cueWindowMs('drive', repConfigFor(state));
    expect(lastSet).toBeLessThan(firstRep);
  });

  it('is a wider window on a primed day than on a wrecked one', () => {
    const primed = stepSession(tapThrough(createSession(context()), PRIMED), {
      kind: 'choose-rpe',
      rpe: 8,
    });
    const wrecked = stepSession(tapThrough(createSession(context()), WRECKED), {
      kind: 'choose-rpe',
      rpe: 8,
    });
    expect(cueWindowMs('drive', repConfigFor(primed))).toBeGreaterThan(
      cueWindowMs('drive', repConfigFor(wrecked)),
    );
  });

  it('refuses to configure a rep before a plan exists', () => {
    expect(() => repConfigFor(createSession(context()))).toThrow(RangeError);
  });
});

describe('the close-out — GDD §3.2', () => {
  it('holds the estimate when the session was hit exactly on target', () => {
    const state = runSession(context(), NEUTRAL, 8, ALL_GOOD);
    const closeOut = state.closeOut;
    expect(closeOut).not.toBeNull();
    if (closeOut === null) return;
    expect(closeOut.canPropose).toBe(true);
    expect(closeOut.goodReps).toBe(SESSION_TUNING.WORK_SETS * SESSION_TUNING.REPS_PER_SET);
    // 172.5 kg x 3 @ RPE 8 -> 172.5 / 0.863.
    expect(closeOut.sessionE1rmKg).toBeCloseTo(199.8841, 4);
    expect(closeOut.isPr).toBe(false);
    expect(closeOut.prGainKg).toBeNull();
    expect(closeOut.headline).toBe(SESSION_COPY.CLOSE_OUT_HELD_HEADLINE);
    expect(closeOut.subhead).toBe(SESSION_COPY.CLOSE_OUT_HELD_SUBHEAD);
    expect(closeOut.streakBefore).toBe(4);
    expect(closeOut.streakAfter).toBe(5);
  });

  it('calls a PR when earned stimulus made the bar heavier — GDD §3.4', () => {
    const state = runSession(context({ trainingProgressCredit: CREDIT_FOR_A_PLATE }), NEUTRAL, 8, ALL_GOOD);
    const closeOut = state.closeOut;
    expect(closeOut).not.toBeNull();
    if (closeOut === null) return;
    expect(state.plan?.loadAdjustmentPercent).toBe(0);
    expect(closeOut.isPr).toBe(true);
    expect(closeOut.prGainKg).toBeGreaterThan(0);
    expect(closeOut.headline).toBe(SESSION_COPY.CLOSE_OUT_PR_HEADLINE);
  });

  it('does not call a PR when the session came up short, even with stimulus in the ledger', () => {
    // Every set fails on the third rep: 2 reps @ RPE 10 on the stimulus-nudged bar.
    const state = runSession(
      context({ trainingProgressCredit: CREDIT_FOR_A_PLATE }),
      NEUTRAL,
      8,
      (_set, rep) => (rep === 2 ? 'miss' : 'good-lift'),
    );
    const closeOut = state.closeOut;
    expect(closeOut).not.toBeNull();
    if (closeOut === null) return;
    expect(closeOut.goodReps).toBe(SESSION_TUNING.WORK_SETS * 2);
    expect(closeOut.isPr).toBe(false);
    expect(closeOut.subhead).toBe(SESSION_COPY.CLOSE_OUT_SHORT_SUBHEAD);
  });

  it('shows no e1RM at all, rather than a substitute, when nothing was banked', () => {
    const state = runSession(context(), NEUTRAL, 8, () => 'miss');
    const closeOut = state.closeOut;
    expect(closeOut).not.toBeNull();
    if (closeOut === null) return;
    expect(closeOut.goodReps).toBe(0);
    expect(closeOut.sets).toEqual([]);
    expect(closeOut.sessionE1rmKg).toBeNull();
    expect(closeOut.canPropose).toBe(false);
    expect(closeOut.headline).toBe(SESSION_COPY.CLOSE_OUT_EMPTY_HEADLINE);
    // The streak has not moved, because there is nothing the server would take.
    expect(closeOut.streakAfter).toBe(closeOut.streakBefore);
  });

  it('carries the bar-speed cue as copy, with no number in it — GDD §3.4', () => {
    const state = runSession(context(), WRECKED, 8, ALL_GOOD);
    const text = state.closeOut?.barSpeedText ?? '';
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toMatch(/[0-9]/);
  });

  it('NEVER MENTIONS A TOTAL — GDD §3.2, §6.4', () => {
    // Serialised, so this fails on a field added later as well as on one added
    // now. The client-side type system already refuses a projected Total; this
    // is the same rule at the value level, for the object a screen binds to.
    for (const answers of [NEUTRAL, PRIMED, WRECKED]) {
      for (const rpe of SESSION_TUNING.RPE_CHOICES) {
        const state = runSession(context(), answers, rpe, ALL_GOOD);
        const json = JSON.stringify(state.closeOut);
        expect(json).not.toMatch(/total/i);
      }
    }
  });

  it('exposes no fatigue level for a component to bind to — GDD §3.4, §12.3', () => {
    const state = runSession(context(), WRECKED, 10, ALL_GOOD);
    const json = JSON.stringify(state.closeOut ?? {});
    expect(json).not.toMatch(/fatigue|burden|readiness|strain|risk/i);
    // The feel object's one number lives behind a private symbol, so nothing a
    // component can name or serialise carries a level.
    const feelJson = JSON.stringify(state.feel);
    expect(feelJson).not.toMatch(/fatigue|burden|strain|risk/i);
    // Its interpreted half is qualitative: five words and their copy, no digit.
    expect(
      JSON.stringify({ barSpeed: state.feel?.barSpeed, text: state.feel?.barSpeedText }),
    ).not.toMatch(/[0-9]/);
    // The only numbers on it are the player's own tap readout, which the suite
    // above shows is identical across wildly different hidden ledgers.
    expect(feelJson).toMatch(/loadAdjustmentPercent/);
  });
});

// ---------------------------------------------------------------------------
// The words on the payoff beat — GDD §3.2's accessory ruling, in the copy
// ---------------------------------------------------------------------------

describe('what the close-out is HEADED, not only what it counts', () => {
  const copy = (over: Partial<CloseOutCopyInput> = {}): CloseOutCopy =>
    closeOutCopyFor({
      payoff: 'e1rm',
      canPropose: true,
      isPr: false,
      goodReps: SESSION_TUNING.WORK_SETS * SESSION_TUNING.REPS_PER_SET,
      prescribedReps: SESSION_TUNING.WORK_SETS * SESSION_TUNING.REPS_PER_SET,
      ...over,
    });

  it('names exactly the two payoffs GDD §3.2 has', () => {
    expect([...SESSION_PAYOFFS]).toEqual(['e1rm', 'training-iq']);
  });

  it('AN ACCESSORY DAY IS NOT HEADED "NEW e1RM", however primed the lifter was', () => {
    // THE DEFECT, AS A TEST. There were three headlines — none of them accessory
    // — and the choice between them was the client's PR prediction and nothing
    // else. So an accessory day on a readiness that produced a PR rendered a
    // screen headed "NEW e1RM", subheaded "You beat your best estimate on this
    // lift", over a Training IQ row with no number in it. §3.2 says an accessory
    // session does not get an e1RM close-out, and that screen is one whatever
    // the digits do.
    //
    // `isPr: true` is the operative argument. It is the state the old selector
    // read, and the only state in which it produced the forbidden screen.
    const primed = copy({ payoff: 'training-iq', isPr: true });
    expect(primed.headline).toBe(SESSION_COPY.CLOSE_OUT_ACCESSORY_HEADLINE);
    expect(primed.headline).not.toBe(SESSION_COPY.CLOSE_OUT_PR_HEADLINE);
    expect(primed.subhead).not.toBe(SESSION_COPY.CLOSE_OUT_PR_SUBHEAD);
    expect(primed.headline).not.toMatch(/e1RM/i);
    expect(primed.subhead).not.toMatch(/e1RM|estimate/i);
    // ...and it is the same words whether or not the PR flag is set, because on
    // this payoff the flag is a statement about a number that does not exist.
    expect(copy({ payoff: 'training-iq', isPr: false })).toEqual(primed);
  });

  it('still says so when the accessory work came up short, without scolding', () => {
    const short = copy({ payoff: 'training-iq', isPr: true, goodReps: 1 });
    expect(short.headline).toBe(SESSION_COPY.CLOSE_OUT_ACCESSORY_HEADLINE);
    expect(short.subhead).toBe(SESSION_COPY.CLOSE_OUT_ACCESSORY_SHORT_SUBHEAD);
    expect(short.subhead).not.toBe(SESSION_COPY.CLOSE_OUT_SHORT_SUBHEAD);
  });

  it('lets NOTHING BANKED outrank the payoff kind, on both payoffs', () => {
    // A day with no completed rep has nothing to say about either currency, and
    // the empty copy is already lift-agnostic — it offers the retry.
    for (const payoff of SESSION_PAYOFFS) {
      const empty = copy({ payoff, canPropose: false, isPr: true });
      expect(empty.headline, payoff).toBe(SESSION_COPY.CLOSE_OUT_EMPTY_HEADLINE);
      expect(empty.subhead, payoff).toBe(SESSION_COPY.CLOSE_OUT_EMPTY_SUBHEAD);
    }
  });

  it('leaves the three e1RM outcomes exactly as they were', () => {
    // NON-REGRESSION. The accessory branch is added in front of these, so the
    // cheapest way to break the loop would be to change what a competition lift
    // says on the way past.
    expect(copy({ isPr: true }).headline).toBe(SESSION_COPY.CLOSE_OUT_PR_HEADLINE);
    expect(copy({ isPr: true }).subhead).toBe(SESSION_COPY.CLOSE_OUT_PR_SUBHEAD);
    expect(copy({ isPr: false }).headline).toBe(SESSION_COPY.CLOSE_OUT_HELD_HEADLINE);
    expect(copy({ isPr: false }).subhead).toBe(SESSION_COPY.CLOSE_OUT_HELD_SUBHEAD);
    expect(copy({ isPr: false, goodReps: 1 }).subhead).toBe(SESSION_COPY.CLOSE_OUT_SHORT_SUBHEAD);
  });

  it('gives the accessory day its own words, shared with nothing', () => {
    // A fourth headline that turned out to be one of the other three would pass
    // every check above by accident.
    const heads = [
      SESSION_COPY.CLOSE_OUT_PR_HEADLINE,
      SESSION_COPY.CLOSE_OUT_HELD_HEADLINE,
      SESSION_COPY.CLOSE_OUT_EMPTY_HEADLINE,
      SESSION_COPY.CLOSE_OUT_ACCESSORY_HEADLINE,
    ];
    expect(new Set(heads).size).toBe(heads.length);
    const subs = [
      SESSION_COPY.CLOSE_OUT_PR_SUBHEAD,
      SESSION_COPY.CLOSE_OUT_HELD_SUBHEAD,
      SESSION_COPY.CLOSE_OUT_SHORT_SUBHEAD,
      SESSION_COPY.CLOSE_OUT_EMPTY_SUBHEAD,
      SESSION_COPY.CLOSE_OUT_ACCESSORY_SUBHEAD,
      SESSION_COPY.CLOSE_OUT_ACCESSORY_SHORT_SUBHEAD,
    ];
    expect(new Set(subs).size).toBe(subs.length);
  });

  it('tags a played session as an e1RM day, because the rotation has no other', () => {
    const state = runSession(context(), PRIMED, 8, ALL_GOOD);
    expect(state.closeOut?.payoff).toBe('e1rm');
    expect([...SESSION_TUNING.LIFT_ROTATION]).not.toContain('accessory');
  });

  it('re-tags a close-out as an accessory day, words and numbers together', () => {
    // The one door. It exists because accessory day is RULED and the rotation
    // that would produce one is not built — `liftForDay` hands back a
    // `LiftKind`, which is the meet's three lifts for ever.
    const played = runSession(context({ trainingProgressCredit: CREDIT_FOR_A_PLATE }), NEUTRAL, 8, ALL_GOOD).closeOut;
    expect(played).not.toBeNull();
    if (played === null) return;
    expect(played.isPr).toBe(true);
    expect(played.headline).toBe(SESSION_COPY.CLOSE_OUT_PR_HEADLINE);

    const accessory = asAccessoryCloseOut(played);
    expect(accessory.payoff).toBe('training-iq');
    expect(accessory.headline).toBe(SESSION_COPY.CLOSE_OUT_ACCESSORY_HEADLINE);
    // Every e1RM claim is cleared, not merely unrendered.
    expect(accessory.isPr).toBe(false);
    expect(accessory.sessionE1rmKg).toBeNull();
    expect(accessory.newBestE1rmKg).toBeNull();
    expect(accessory.prGainKg).toBeNull();
    // The session still happened: reps, streak and bar-speed cue are untouched.
    expect(accessory.goodReps).toBe(played.goodReps);
    expect(accessory.streakAfter).toBe(played.streakAfter);
    expect(accessory.barSpeedText).toBe(played.barSpeedText);
    expect(accessory.canPropose).toBe(played.canPropose);
    // And still no Total, on the branch that did not exist when that was checked.
    expect(JSON.stringify(accessory)).not.toMatch(/total/i);
  });
});

describe('a session that banked nothing is retried, not lost — GDD §12.3', () => {
  it('offers the day again from the RPE choice, keeping the check-in', () => {
    const dead = runSession(context(), NEUTRAL, 10, () => 'miss');
    expect(dead.closeOut?.canPropose).toBe(false);
    const again = stepSession(dead, { kind: 'retry' });
    expect(again.phase).toBe('briefing');
    expect(again.readiness).toEqual(dead.readiness);
    expect(again.completedSets).toEqual([]);
    expect(again.closeOut).toBeNull();
    // And the lighter choice completes.
    const second = runSession(context(), NEUTRAL, 6, ALL_GOOD);
    expect(second.closeOut?.canPropose).toBe(true);
  });

  it('refuses to retry a session that WAS logged — one session a day', () => {
    const done = runSession(context(), NEUTRAL, 8, ALL_GOOD);
    expect(done.closeOut?.canPropose).toBe(true);
    expect(stepSession(done, { kind: 'retry' })).toBe(done);
  });

  it('the lightest RPE on the ladder is a bar a cue-obedient player completes', () => {
    // What makes the retry a real route back rather than a loop. Played with
    // the real mechanic, not assumed.
    const played = playWholeSession(context(), NEUTRAL, 6);
    expect(played.state.closeOut?.canPropose).toBe(true);
    expect(played.state.closeOut?.goodReps).toBe(
      SESSION_TUNING.WORK_SETS * SESSION_TUNING.REPS_PER_SET,
    );
  });
});

describe('the machine ignores what does not apply', () => {
  it('does not advance on an event for another phase', () => {
    const fresh = createSession(context());
    expect(fresh.phase).toBe('briefing');
    expect(stepSession(fresh, { kind: 'rep-resolved', outcome: 'good-lift', executionQuality: 1 })).toBe(fresh);
    expect(stepSession(fresh, { kind: 'begin-set' })).toBe(fresh);
    expect(stepSession(fresh, { kind: 'retry' })).toBe(fresh);

    const lifting = stepSession(fresh, { kind: 'choose-rpe', rpe: 8 });
    expect(lifting.phase).toBe('set');
    expect(
      stepSession(lifting, { kind: 'check-in-tap', tap: { question: 'sleep', answer: 'poor' } }),
    ).toBe(lifting);
  });

  it('never mutates the state it is given', () => {
    const before = tapThrough(createSession(context()), NEUTRAL);
    const snapshot = JSON.stringify({ ...before, feel: null });
    stepSession(before, { kind: 'choose-rpe', rpe: 9 });
    expect(JSON.stringify({ ...before, feel: null })).toBe(snapshot);
  });

  it('refuses a session context it cannot prescribe from', () => {
    expect(() => createSession(context({ day: 0.5 }))).toThrow(RangeError);
    expect(() => createSession(context({ e1rmKg: 0 }))).toThrow(RangeError);
  });
});

describe('the proposal and the projection — the client proposes, the server publishes', () => {
  const wallClock = { year: 2026, month: 8, day: 3, hour: 19 };

  it('sends the sets and no answer', () => {
    const state = runSession(context(), NEUTRAL, 8, ALL_GOOD);
    const closeOut = state.closeOut;
    expect(closeOut).not.toBeNull();
    if (closeOut === null) return;
    const proposal = sessionProposal(closeOut, wallClock);
    expect(proposal).not.toBeNull();
    expect(proposal?.kind).toBe('record-training-session');
    // THE CARD DECLARES THE UNIT, AND IT DECLARES THE ONE THE LOOP LOADED IN
    // rather than a literal somebody typed. There is no `report.sets` to read:
    // the arm has to be named first, which is the property the shape exists for.
    const card = proposal?.report.card;
    expect(card?.unit).toBe(SESSION_TUNING.LOAD_UNIT);
    if (card === undefined || card.unit !== 'kg') throw new Error('the shipped loop loads in kg');
    expect(card.kilogramSets).toHaveLength(SESSION_TUNING.WORK_SETS);
    expect(card.kilogramSets[0]).toEqual({
      lift: 'squat',
      weight: 172.5,
      reps: 3,
      rpe: 8,
      executionQuality: 1,
    });
    // No derived answer on the wire, in any set.
    expect(JSON.stringify(proposal)).not.toMatch(/e1rm|total/i);
  });

  it('reads the unit off the constant that chose it, with no literal to drift', () => {
    // THIS IS A SOURCE SCAN AND IT IS ONE ON PURPOSE, because the executable
    // assertion above CANNOT discriminate. `expect(card.unit).toBe(
    // SESSION_TUNING.LOAD_UNIT)` passes just as happily against a hard-coded
    // `{ unit: 'kg' }`, since the constant IS `'kg'` — mutation-tested, and it
    // survives. The two differ only on the day the constant moves, which is
    // exactly the day a typed literal becomes a lie about permanent progression.
    //
    // A stronger version of this check would put the unit on `SessionPlan` and
    // forward it, the way `MeetEntry.bodyweight` is forwarded rather than
    // stamped. That is not done here because `SessionPlan.weightKg` and
    // `SessionCloseOut.weightKg` are read by screens outside this piece's scope,
    // and a plan carrying `unit: 'lb'` beside a field named `weightKg` would be a
    // worse contradiction than the one being fixed. Named rather than glossed.
    const source = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'session.ts'), 'utf8');
    const start = source.indexOf('export function sessionProposal(');
    expect(start).toBeGreaterThan(0);
    const body = source.slice(start, source.indexOf('\n}', start));
    // The control: the slice really is the function, not an empty string.
    expect(body).toContain("kind: 'record-training-session'");
    expect(body).toContain('SESSION_TUNING.LOAD_UNIT');
    // And no unit literal anywhere in it, in either arm.
    expect(body).not.toMatch(/unit:\s*['"](kg|lb)['"]/);
  });

  it('proposes nothing when nothing was banked', () => {
    const dead = runSession(context(), NEUTRAL, 8, () => 'miss');
    expect(dead.closeOut).not.toBeNull();
    expect(sessionProposal(dead.closeOut!, wallClock)).toBeNull();
  });

  it('claims an e1RM and a streak, and a null Total', () => {
    const state = runSession(context({ trainingProgressCredit: CREDIT_FOR_A_PLATE }), NEUTRAL, 8, ALL_GOOD);
    const projection = sessionProjection(state.closeOut!);
    expect(projection.totalKg).toBeNull();
    expect(projection.bestE1rmKg.squat).toBeGreaterThan(200);
    expect(projection.bestE1rmKg.bench).toBeNull();
    expect(projection.bestE1rmKg.deadlift).toBeNull();
    expect(projection.streak?.currentStreak).toBe(5);
  });

  it('keeps the previous best when the session was worse than it', () => {
    const state = runSession(context({ bestE1rmKg: 260 }), NEUTRAL, 8, ALL_GOOD);
    const projection = sessionProjection(state.closeOut!);
    expect(projection.bestE1rmKg.squat).toBe(260);
  });

  it('is accepted by progression.ts, and the cache then reads a projected e1RM', () => {
    const received = receiveProgressionSnapshot(snapshotWireFor(newServerRecord(SIGNUP_DAY), null));
    expect(received.ok).toBe(true);
    if (!received.ok) return;
    const seeded = applyServerSnapshot(emptyProgressionCache(), received.value);
    expect(seeded.ok).toBe(true);
    if (!seeded.ok) return;

    const state = runSession(context({ e1rmKg: 180, bestE1rmKg: 180, trainingProgressCredit: CREDIT_FOR_A_PLATE }), NEUTRAL, 8, ALL_GOOD);
    const closeOut = state.closeOut!;
    const proposed = proposeChange(
      seeded.value,
      asProposalId('p-1'),
      sessionProposal(closeOut, wallClock)!,
      sessionProjection(closeOut),
    );
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;

    const e1rm = readBestE1rmKg(proposed.value, 'squat' satisfies LiftKind);
    expect(e1rm.kind).toBe('projected');
    expect(readStreakDays(proposed.value).kind).toBe('projected');
    // AND THE TOTAL IS STILL NOT PROJECTED. This is the positive control for
    // the assertion above: a projection that claimed nothing at all would also
    // leave the Total unprojected.
    expect(readTotalKg(proposed.value).kind).toBe('confirmed');
  });
});

describe('session length — GDD §3.2’s 60-90 seconds', () => {
  // ---------------------------------------------------------------------------
  // THERE IS NO LOWER-BOUND ASSERTION HERE, AND ITS ABSENCE IS DELIBERATE.
  // ---------------------------------------------------------------------------
  // GDD §3.2 budgets 60-90 s and §12.2 judges this piece against a best-in-class
  // daily-habit app on "time-to-first-input, session length, and whether the
  // close-out moment lands", with the bar being that ours "must not be slower or
  // flabbier". A session that finishes UNDER the budget wins that bar; it does
  // not fail it.
  //
  // The measured machine time is 54.3 s at RPE 6 and 60.3 s at RPE 10 — below
  // §3.2's floor at four of the five rungs. A `>= 60_000` assertion here only
  // ever passed because `HUMAN_INPUT_BUDGET_MS`, which is a guess and which no
  // shipping code reads, was added to the measurement first. Asserting a floor
  // that a guessed constant is holding up is not a check, so the floor is gone
  // and the divergence from §3.2 is recorded in GDD §11 instead.
  //
  // The CEILING is the direction that matters and it is kept, padded with the
  // human budget, which makes it the stricter of the two readings.

  /**
   * The whole session on the clock: the reps as they were actually played, plus
   * the beats `SESSION_TUNING` holds, plus the guessed allowance for the player
   * reading and deciding.
   *
   * The set count is THE SETS ACTUALLY PLAYED, not the template and not the
   * sets that banked a report. A session cut short by an injury cap or by a
   * miss on the first rep of a set plays fewer sets than `WORK_SETS`, and rests
   * between sets that did not happen are not time anybody spent.
   */
  function wholeSessionMs(played: ReturnType<typeof playWholeSession>): number {
    return (
      playedSessionMs(played.repMs, played.reps, played.state.completedSets.length) +
      SESSION_TUNING.HUMAN_INPUT_BUDGET_MS
    );
  }

  it('a played session fits inside the budget', () => {
    const played = playWholeSession(context(), NEUTRAL, 8);
    expect(played.state.closeOut?.canPropose).toBe(true);
    expect(wholeSessionMs(played)).toBeLessThanOrEqual(90_000);
  });

  it('fits at every rung of the RPE ladder', () => {
    for (const rpe of SESSION_TUNING.RPE_CHOICES) {
      const played = playWholeSession(context(), NEUTRAL, rpe);
      expect(wholeSessionMs(played), `RPE ${rpe}`).toBeLessThanOrEqual(90_000);
    }
  });

  it('counts the sets that were played, not the sets that were planned', () => {
    // The bug this closes: passing `SESSION_TUNING.WORK_SETS` charges a rest
    // beat for every set in the template, including ones a shortened session
    // never reached. `cappedSession` (GDD §3.5) produces exactly that session.
    const injured = recordSession(
      EMPTY_FATIGUE_STATE,
      { day: 0, lift: 'squat', topRpe: 10, workSets: 8, repsPerSet: 5 },
      UNLUCKIEST_ROLLS,
    ).state;
    const played = playWholeSession(
      context({ day: 1, lift: 'squat', fatigue: injured }),
      NEUTRAL,
      8,
    );
    const setsPlayed = played.state.completedSets.length;
    expect(setsPlayed).toBeGreaterThanOrEqual(1);
    expect(setsPlayed).toBeLessThan(SESSION_TUNING.WORK_SETS);
    // The positive control: reading the template instead would have added rest
    // beats for sets that were never taken, so the two readings must differ.
    expect(playedSessionMs(played.repMs, played.reps, SESSION_TUNING.WORK_SETS)).toBeGreaterThan(
      playedSessionMs(played.repMs, played.reps, setsPlayed),
    );
    expect(wholeSessionMs(played)).toBeLessThanOrEqual(90_000);
  });

  it('is measured well under the floor GDD §3.2 names, and that is recorded as a divergence', () => {
    // GDD §11 carries this. Pinned here so the recorded numbers stay true: if a
    // template or beat change pushes the machine time back over 60 s, this
    // fails and the §11 entry gets revisited rather than quietly going stale.
    const ladder = SESSION_TUNING.RPE_CHOICES.map((rpe) => {
      const played = playWholeSession(context(), NEUTRAL, rpe);
      return playedSessionMs(played.repMs, played.reps, played.state.completedSets.length);
    });
    expect(ladder).toHaveLength(5);
    expect(Math.min(...ladder)).toBeCloseTo(54_300, -2);
    expect(Math.max(...ladder)).toBeCloseTo(60_300, -2);
    // Four of the five rungs are under §3.2's floor on machine time alone.
    expect(ladder.filter((ms) => ms < 60_000)).toHaveLength(4);
  });

  it('adds the beats it says it adds', () => {
    // Hand-written: 10 s of reps, 12 rep holds, 4 sets.
    const expected =
      10_000 +
      12 * SESSION_TUNING.REP_RESULT_HOLD_MS +
      3 * SESSION_TUNING.SET_REST_MS +
      SESSION_TUNING.BRIEFING_REVEAL_MS;
    expect(playedSessionMs(10_000, 12, 4)).toBe(expected);
    expect(playedSessionMs(10_000, 0, 1)).toBe(10_000 + SESSION_TUNING.BRIEFING_REVEAL_MS);
  });
});

describe('the RPE choice is a real choice — GDD §3.3', () => {
  it('five choices put five different bars on the platform', () => {
    const steady = readinessCheckIn(NEUTRAL);
    const weights = SESSION_TUNING.RPE_CHOICES.map(
      (rpe) => prescribeSession(200, 'squat', rpe, steady, 4).weightKg,
    );
    expect(new Set(weights).size).toBe(SESSION_TUNING.RPE_CHOICES.length);
    for (let i = 1; i < weights.length; i += 1) {
      expect(weights[i]!).toBeGreaterThan(weights[i - 1]!);
    }
  });

  it('and the ladder is felt in the mechanic, not only in the number', () => {
    // Played, with the same cue-obedient input at every rung. The heaviest rung
    // must cost more ticks than the lightest — if the mechanic ran identically
    // at 81% and 92% of e1RM, the one choice GDD §3.3 hangs the mode on would
    // be a label.
    const light = playWholeSession(context(), NEUTRAL, 6);
    const heavy = playWholeSession(context(), NEUTRAL, 10);
    expect(heavy.repMs).toBeGreaterThan(light.repMs);
  });
});
