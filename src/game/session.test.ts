import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  EMPTY_CHECK_IN,
  checkInOrNeutral,
  checkInProgress,
  completeCheckIn,
  createSession,
  currentSetNumber,
  defaultRpeChoice,
  isMadeRep,
  liftForDay,
  liftMomentFor,
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
  type SessionContext,
  type SessionEvent,
  type SessionState,
} from './session';
import { SESSION_COPY, SESSION_TUNING } from './sessionTuning';
import {
  EMPTY_FATIGUE_STATE,
  UNLUCKIEST_ROLLS,
  readinessCheckIn,
  recordSession,
  type FatigueState,
  type ReadinessCheckIn,
} from './fatigue';
import {
  createLift,
  stepLift,
  type LiftConfig,
  type LiftInput,
  type LiftOutcome,
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
} from './progression';
import type { LiftKind } from './meet';
import { newServerRecord, snapshotWireFor } from './sessionServer';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NEUTRAL: ReadinessCheckIn = { sleep: 'ok', soreness: 'normal', motivation: 'steady' };
const PRIMED: ReadinessCheckIn = { sleep: 'good', soreness: 'fresh', motivation: 'fired-up' };
const READY: ReadinessCheckIn = { sleep: 'good', soreness: 'normal', motivation: 'steady' };
const WRECKED: ReadinessCheckIn = { sleep: 'poor', soreness: 'sore', motivation: 'flat' };

function context(overrides: Partial<SessionContext> = {}): SessionContext {
  return {
    day: 0,
    lift: 'squat',
    e1rmKg: 200,
    bestE1rmKg: 200,
    streakBefore: 4,
    streakIfTrainedToday: 5,
    fatigue: EMPTY_FATIGUE_STATE,
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
}

/**
 * Plays a rep by obeying the two on-screen cues: hold to descend, release when
 * the depth window's ideal tick arrives, press again at the drive's ideal tick
 * and keep holding. `offsetTicks` shifts both inputs, so an imperfect player is
 * the same function with a number.
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
  return { outcome: state.resolution?.outcome ?? 'miss', ticks };
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
    state = stepSession(state, { kind: 'rep-resolved', outcome: played.outcome });
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

describe('liftForDay — GDD §3.2 one lift per day on rotation', () => {
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

  it('stays on the check-in until the third tap, then surfaces the modifier', () => {
    let state = createSession(context());
    expect(state.phase).toBe('check-in');
    state = stepSession(state, { kind: 'check-in-tap', tap: { question: 'sleep', answer: 'good' } });
    expect(state.phase).toBe('check-in');
    expect(state.readiness).toBeNull();
    state = stepSession(state, {
      kind: 'check-in-tap',
      tap: { question: 'soreness', answer: 'fresh' },
    });
    expect(state.phase).toBe('check-in');
    state = stepSession(state, {
      kind: 'check-in-tap',
      tap: { question: 'motivation', answer: 'fired-up' },
    });
    expect(state.phase).toBe('briefing');
    expect(state.readiness?.headline).toBe('Feeling primed');
    expect(state.readiness?.label).toBe('Feeling primed +5%');
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

  it('rounding DOWN means a target hit exactly can never ratchet e1RM upward', () => {
    // The property the rounding mode exists for. Over a wide sweep of e1RMs and
    // every offered RPE, a full set completed on target reports an e1RM at or
    // below the one it was prescribed from — so no PR is ever bought with
    // rounding, and the next day's prescription cannot climb off it.
    let checked = 0;
    for (let e1rm = 60; e1rm <= 400; e1rm += 2.5) {
      for (const rpe of SESSION_TUNING.RPE_CHOICES) {
        const plan = prescribeSession(e1rm, 'squat', rpe, steady, 1);
        const played = playedSetFrom(plan, 1, Array<LiftOutcome>(plan.repsPerSet).fill('good-lift'));
        const report = played.report;
        expect(report).not.toBeNull();
        if (report === null) continue;
        const implied = sessionE1rmFrom([report]);
        expect(implied).not.toBeNull();
        expect(implied ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(e1rm);
        checked += 1;
      }
    }
    expect(checked).toBe(685);
  });

  it('offers RPE 8 by default', () => {
    expect(defaultRpeChoice()).toBe(8);
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

describe('playing a set', () => {
  const steady = readinessCheckIn(NEUTRAL);
  const plan = prescribeSession(200, 'squat', 8, steady, 4);

  it('reports every completed rep at the target RPE when the set is finished', () => {
    const played = playedSetFrom(plan, 1, ['good-lift', 'grind', 'good-lift']);
    expect(played.goodReps).toBe(3);
    expect(played.wentToFailure).toBe(false);
    expect(played.report).toEqual({ lift: 'squat', weightKg: 172.5, reps: 3, rpe: 8 });
  });

  it('reports a set that met failure at RPE 10 for the reps that were made', () => {
    const played = playedSetFrom(plan, 2, ['good-lift', 'miss']);
    expect(played.goodReps).toBe(1);
    expect(played.wentToFailure).toBe(true);
    // RPE 10 is not an estimate of how hard it was — on a reps-in-reserve chart
    // it is what "the next rep failed" MEANS.
    expect(played.report).toEqual({ lift: 'squat', weightKg: 172.5, reps: 1, rpe: 10 });
  });

  it('reports nothing at all for a set with no completed rep', () => {
    const played = playedSetFrom(plan, 3, ['miss']);
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
    state = stepSession(state, { kind: 'rep-resolved', outcome: 'good-lift' });
    expect(state.phase).toBe('set');
    expect(state.repIndex).toBe(1);
    state = stepSession(state, { kind: 'rep-resolved', outcome: 'miss' });
    expect(state.phase).toBe('rest');
    expect(state.setIndex).toBe(1);
    expect(state.completedSets).toHaveLength(1);
    expect(state.completedSets[0]?.goodReps).toBe(1);
  });

  it('counts the set number for copy from one', () => {
    let state = stepSession(tapThrough(createSession(context()), NEUTRAL), {
      kind: 'choose-rpe',
      rpe: 8,
    });
    expect(currentSetNumber(state)).toBe(1);
    for (let i = 0; i < SESSION_TUNING.REPS_PER_SET; i += 1) {
      state = stepSession(state, { kind: 'rep-resolved', outcome: 'good-lift' });
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

    state = stepSession(state, { kind: 'rep-resolved', outcome: 'good-lift' });
    expect(liftMomentFor(state)).toEqual({ workSetsCompleted: 0, repsCompletedInSet: 1 });
    for (let i = 1; i < SESSION_TUNING.REPS_PER_SET; i += 1) {
      state = stepSession(state, { kind: 'rep-resolved', outcome: 'good-lift' });
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
      state = stepSession(state, { kind: 'rep-resolved', outcome: 'good-lift' });
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

  it('calls a PR when the primed bar went up', () => {
    const state = runSession(context(), PRIMED, 8, ALL_GOOD);
    const closeOut = state.closeOut;
    expect(closeOut).not.toBeNull();
    if (closeOut === null) return;
    // 180 kg x 3 @ RPE 8 -> 180 / 0.863 = 208.5747...
    expect(closeOut.weightKg).toBe(180);
    expect(closeOut.sessionE1rmKg).toBeCloseTo(208.5747, 4);
    expect(closeOut.isPr).toBe(true);
    expect(closeOut.prGainKg).toBeCloseTo(8.5747, 4);
    expect(closeOut.headline).toBe(SESSION_COPY.CLOSE_OUT_PR_HEADLINE);
  });

  it('does not call a PR when the session came up short', () => {
    // Every set fails on the third rep: 2 reps @ RPE 10 on a 180 kg bar.
    const state = runSession(context(), PRIMED, 8, (_set, rep) => (rep === 2 ? 'miss' : 'good-lift'));
    const closeOut = state.closeOut;
    expect(closeOut).not.toBeNull();
    if (closeOut === null) return;
    expect(closeOut.goodReps).toBe(SESSION_TUNING.WORK_SETS * 2);
    // 180 / 0.955 = 188.4816...
    expect(closeOut.sessionE1rmKg).toBeCloseTo(188.4817, 4);
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
    expect(stepSession(fresh, { kind: 'choose-rpe', rpe: 8 })).toBe(fresh);
    expect(stepSession(fresh, { kind: 'rep-resolved', outcome: 'good-lift' })).toBe(fresh);
    expect(stepSession(fresh, { kind: 'begin-set' })).toBe(fresh);
    expect(stepSession(fresh, { kind: 'retry' })).toBe(fresh);

    const briefing = tapThrough(fresh, NEUTRAL);
    expect(stepSession(briefing, { kind: 'rep-resolved', outcome: 'good-lift' })).toBe(briefing);
    expect(
      stepSession(briefing, { kind: 'check-in-tap', tap: { question: 'sleep', answer: 'poor' } }),
    ).toBe(briefing);
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
    expect(proposal?.report.sets).toHaveLength(SESSION_TUNING.WORK_SETS);
    expect(proposal?.report.sets[0]).toEqual({
      lift: 'squat',
      weightKg: 172.5,
      reps: 3,
      rpe: 8,
    });
    // No derived answer on the wire, in any set.
    expect(JSON.stringify(proposal)).not.toMatch(/e1rm|total/i);
  });

  it('proposes nothing when nothing was banked', () => {
    const dead = runSession(context(), NEUTRAL, 8, () => 'miss');
    expect(dead.closeOut).not.toBeNull();
    expect(sessionProposal(dead.closeOut!, wallClock)).toBeNull();
  });

  it('claims an e1RM and a streak, and a null Total', () => {
    const state = runSession(context(), PRIMED, 8, ALL_GOOD);
    const projection = sessionProjection(state.closeOut!);
    expect(projection.totalKg).toBeNull();
    expect(projection.bestE1rmKg.squat).toBeCloseTo(208.5747, 4);
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
    const received = receiveProgressionSnapshot(snapshotWireFor(newServerRecord(), null));
    expect(received.ok).toBe(true);
    if (!received.ok) return;
    const seeded = applyServerSnapshot(emptyProgressionCache(), received.value);
    expect(seeded.ok).toBe(true);
    if (!seeded.ok) return;

    const state = runSession(context({ e1rmKg: 180, bestE1rmKg: 180 }), PRIMED, 8, ALL_GOOD);
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
  it('a played session lands inside the window', () => {
    const played = playWholeSession(context(), NEUTRAL, 8);
    expect(played.state.closeOut?.canPropose).toBe(true);
    const machineMs = playedSessionMs(
      played.repMs,
      played.reps,
      played.state.closeOut?.sets.length ?? 0,
    );
    const total = machineMs + SESSION_TUNING.HUMAN_INPUT_BUDGET_MS;
    expect(total).toBeGreaterThanOrEqual(60_000);
    expect(total).toBeLessThanOrEqual(90_000);
  });

  it('stays inside it at both ends of the RPE ladder', () => {
    for (const rpe of [6, 10]) {
      const played = playWholeSession(context(), NEUTRAL, rpe);
      const total =
        playedSessionMs(played.repMs, played.reps, SESSION_TUNING.WORK_SETS) +
        SESSION_TUNING.HUMAN_INPUT_BUDGET_MS;
      expect(total).toBeGreaterThanOrEqual(60_000);
      expect(total).toBeLessThanOrEqual(90_000);
    }
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
