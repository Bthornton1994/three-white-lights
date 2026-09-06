/**
 * History-derived readiness — SF-TWL-SESSION-A-TRAINING-FIT-01.
 *
 * Owner constraints (Session A only; do not retune lift/RPE difficulty):
 *   - deterministic, bounded, named constants
 *   - strain is sets × reps × rpeStrainWeight, not fatigue += RPE
 *   - declared/target RPE is not labelled achieved
 *   - one ledger: FatigueState.sessions
 *   - no subjective questionnaire on the player path
 *   - empty history → forming, not fabricated fresh/fatigue
 *   - RPE 9/10 >> RPE 8; hard recent ≠ recovered; rest recovers; accumulation bounded
 *   - may train while fatigued; tighter window / slower bar, not a lock
 *   - coaching copy only; no residual/strain/% on the play surface
 */

import { describe, expect, it } from 'vitest';

import {
  EMPTY_FATIGUE_STATE,
  FATIGUE_COPY,
  FATIGUE_TUNING,
  LUCKIEST_ROLLS,
  adjustedTimingWindowMs,
  historyReadiness,
  nextTrainingAction,
  nextTrainingActionAfterSession,
  recordSession,
  sessionFeel,
  type FatigueState,
  type ReadinessCheckIn,
  type SessionRecord,
} from './fatigue';
import { TO_FAILURE_RPE } from './e1rm';
import {
  createSession,
  playedSetFrom,
  prescribeSession,
  stepSession,
  type SessionContext,
} from './session';
import { fatigueRecordFor } from './sessionServer';
import { SESSION_TUNING } from './sessionTuning';

const BASE_WINDOW_MS = 240;

function template(day: number, topRpe: number): SessionRecord {
  return {
    day,
    lift: 'squat',
    topRpe,
    workSets: SESSION_TUNING.WORK_SETS,
    repsPerSet: SESSION_TUNING.REPS_PER_SET,
  };
}

function after(state: FatigueState, session: SessionRecord): FatigueState {
  return recordSession(state, session, LUCKIEST_ROLLS).state;
}

describe('history readiness', () => {
  it('no history is forming, not fabricated fatigue', () => {
    const report = historyReadiness(EMPTY_FATIGUE_STATE, 10);
    expect(report.headline).toBe(FATIGUE_COPY.HISTORY_READINESS_HEADLINE.forming);
    expect(report.loadAdjustmentPercent).toBe(0);
    expect(report.label).not.toMatch(/fresh|primed/i);
    expect(sessionFeel(EMPTY_FATIGUE_STATE, 10).barSpeed).toBe('as-expected');
  });

  it('RPE 9 and 10 produce more fatigue than RPE 8 under equivalent work', () => {
    const rpe8 = after(EMPTY_FATIGUE_STATE, template(1, 8));
    const rpe9 = after(EMPTY_FATIGUE_STATE, template(1, 9));
    const rpe10 = after(EMPTY_FATIGUE_STATE, template(1, 10));
    const window8 = adjustedTimingWindowMs(BASE_WINDOW_MS, sessionFeel(rpe8, 2));
    const window9 = adjustedTimingWindowMs(BASE_WINDOW_MS, sessionFeel(rpe9, 2));
    const window10 = adjustedTimingWindowMs(BASE_WINDOW_MS, sessionFeel(rpe10, 2));
    expect(window9).toBeLessThan(window8);
    expect(window10).toBeLessThan(window9);
    expect(historyReadiness(rpe8, 2).headline).not.toBe(
      historyReadiness(rpe9, 2).headline,
    );
    expect(historyReadiness(rpe8, 2).headline).toBe(
      FATIGUE_COPY.HISTORY_READINESS_HEADLINE.heavy,
    );
    expect(historyReadiness(rpe9, 2).headline).toBe(
      FATIGUE_COPY.HISTORY_READINESS_HEADLINE.grinding,
    );
    expect(historyReadiness(rpe10, 2).headline).toBe(
      FATIGUE_COPY.HISTORY_READINESS_HEADLINE.grinding,
    );
  });

  it('hard recent training does not report recovered', () => {
    const hard = after(EMPTY_FATIGUE_STATE, template(1, 10));
    const report = historyReadiness(hard, 2);
    expect(report.headline).not.toBe(FATIGUE_COPY.HISTORY_READINESS_HEADLINE.recovered);
    expect(report.headline).not.toBe(FATIGUE_COPY.HISTORY_READINESS_HEADLINE.forming);
    expect(report.headline).toBe(FATIGUE_COPY.HISTORY_READINESS_HEADLINE.grinding);
  });

  it('fatigue recovers with elapsed days', () => {
    const hard = after(EMPTY_FATIGUE_STATE, template(1, 10));
    const nextMorning = adjustedTimingWindowMs(BASE_WINDOW_MS, sessionFeel(hard, 2));
    const later = adjustedTimingWindowMs(BASE_WINDOW_MS, sessionFeel(hard, 6));
    expect(later).toBeGreaterThan(nextMorning);
    expect(historyReadiness(hard, 6).headline).toBe(
      FATIGUE_COPY.HISTORY_READINESS_HEADLINE.recovered,
    );
  });

  it('repeated high-effort sessions stay bounded', () => {
    let state = EMPTY_FATIGUE_STATE;
    for (let day = 1; day <= 12; day += 1) {
      state = after(state, template(day, 10));
    }
    const window = adjustedTimingWindowMs(BASE_WINDOW_MS, sessionFeel(state, 13));
    const floor = BASE_WINDOW_MS * FATIGUE_TUNING.TIMING_WINDOW_SCALE_MIN;
    expect(window).toBeGreaterThanOrEqual(floor);
    expect(Number.isFinite(window)).toBe(true);
    expect(historyReadiness(state, 13).loadAdjustmentPercent).toBe(0);
    expect(historyReadiness(state, 13).headline).toBe(
      FATIGUE_COPY.HISTORY_READINESS_HEADLINE.grinding,
    );
    expect(
      historyReadiness(state, 12 + FATIGUE_TUNING.FATIGUE_MEMORY_DAYS).headline,
    ).toBe(FATIGUE_COPY.HISTORY_READINESS_HEADLINE.recovered);
    expect(
      historyReadiness(state, 13 + FATIGUE_TUNING.FATIGUE_MEMORY_DAYS).headline,
    ).toBe(FATIGUE_COPY.HISTORY_READINESS_HEADLINE.forming);
  });

  it('same inputs produce the same outputs', () => {
    const a = after(after(EMPTY_FATIGUE_STATE, template(1, 9)), template(2, 10));
    const b = after(after(EMPTY_FATIGUE_STATE, template(1, 9)), template(2, 10));
    expect(historyReadiness(a, 3)).toEqual(historyReadiness(b, 3));
    expect(sessionFeel(a, 3)).toEqual(sessionFeel(b, 3));
    expect(adjustedTimingWindowMs(BASE_WINDOW_MS, sessionFeel(a, 3))).toBe(
      adjustedTimingWindowMs(BASE_WINDOW_MS, sessionFeel(b, 3)),
    );
  });

  it('fatigue is not a simple RPE sum — volume still matters at the same RPE', () => {
    const light = after(EMPTY_FATIGUE_STATE, { ...template(1, 8), workSets: 1, repsPerSet: 1 });
    const heavy = after(EMPTY_FATIGUE_STATE, template(1, 8));
    const lightWindow = adjustedTimingWindowMs(BASE_WINDOW_MS, sessionFeel(light, 2));
    const heavyWindow = adjustedTimingWindowMs(BASE_WINDOW_MS, sessionFeel(heavy, 2));
    expect(heavyWindow).toBeLessThan(lightWindow);
  });

  it('history never nudges load — RPE still owns the bar', () => {
    expect(FATIGUE_TUNING.HISTORY_READINESS_LOAD_ADJUSTMENT_PERCENT).toBe(0);
    const hard = after(EMPTY_FATIGUE_STATE, template(1, 10));
    expect(historyReadiness(hard, 2).loadAdjustmentPercent).toBe(0);
    expect(historyReadiness(EMPTY_FATIGUE_STATE, 1).loadAdjustmentPercent).toBe(0);
  });

  it('the player may train while fatigued — no lock in the session machine', () => {
    const hard = after(EMPTY_FATIGUE_STATE, template(0, 10));
    const context: SessionContext = {
      day: 1,
      lift: 'squat',
      e1rmKg: 200,
      bestE1rmKg: 200,
      streakBefore: 1,
      streakIfTrainedToday: 2,
      fatigue: hard,
    };
    const opened = createSession(context);
    expect(opened.phase).toBe('briefing');
    expect(opened.readiness?.headline).toBe(FATIGUE_COPY.HISTORY_READINESS_HEADLINE.grinding);
    const lifting = stepSession(opened, { kind: 'choose-rpe', rpe: 8 });
    expect(lifting.phase).toBe('set');
    expect(lifting.plan).not.toBeNull();
    const freshWindow = adjustedTimingWindowMs(
      BASE_WINDOW_MS,
      sessionFeel(EMPTY_FATIGUE_STATE, 1),
    );
    const tiredWindow = adjustedTimingWindowMs(BASE_WINDOW_MS, sessionFeel(hard, 1));
    expect(tiredWindow).toBeLessThan(freshWindow);
  });

  it('player-facing copy has no residual, strain, or percent diagnostics', () => {
    for (const kind of ['forming', 'recovered', 'ready', 'heavy', 'grinding'] as const) {
      const headline = FATIGUE_COPY.HISTORY_READINESS_HEADLINE[kind];
      const detail = FATIGUE_COPY.HISTORY_READINESS_DETAIL[kind];
      expect(headline).not.toMatch(/%|residual|strain|meter/i);
      expect(detail).not.toMatch(/%|residual|strain|meter/i);
    }
  });

  it('the ledger has one history field — sessions — and no competing store', () => {
    expect(Object.keys(EMPTY_FATIGUE_STATE).sort()).toEqual(['injury', 'sessions']);
  });

  it('readiness copy ignores leftover check-in taps; history owns the report', () => {
    const hard = after(EMPTY_FATIGUE_STATE, template(1, 10));
    const primed: ReadinessCheckIn = {
      sleep: 'good',
      soreness: 'fresh',
      motivation: 'fired-up',
    };
    const wrecked: ReadinessCheckIn = {
      sleep: 'poor',
      soreness: 'sore',
      motivation: 'flat',
    };
    expect(sessionFeel(hard, 2, primed).readiness).toEqual(sessionFeel(hard, 2, wrecked).readiness);
    expect(sessionFeel(hard, 2, primed).readiness.headline).toBe(
      FATIGUE_COPY.HISTORY_READINESS_HEADLINE.grinding,
    );
  });

  it('made reps keep declared RPE; failure is achieved RPE 10 — not relabelled', () => {
    const plan = prescribeSession(
      200,
      'squat',
      8,
      historyReadiness(EMPTY_FATIGUE_STATE, 1),
      1,
    );
    expect(plan.targetRpe).toBe(8);
    const made = playedSetFrom(plan, 1, [
      { outcome: 'good-lift', executionQuality: 1 },
      { outcome: 'good-lift', executionQuality: 1 },
      { outcome: 'good-lift', executionQuality: 1 },
    ]);
    expect(made.wentToFailure).toBe(false);
    expect(made.report?.rpe).toBe(plan.targetRpe);
    expect(made.report?.rpe).not.toBe(TO_FAILURE_RPE);
    const madeRecord = fatigueRecordFor(1, 'squat', made.report === null ? [] : [made.report]);
    expect(madeRecord?.topRpe).toBe(8);

    const failed = playedSetFrom(plan, 1, [
      { outcome: 'good-lift', executionQuality: 1 },
      { outcome: 'miss', executionQuality: 0 },
    ]);
    expect(failed.wentToFailure).toBe(true);
    expect(failed.report?.rpe).toBe(TO_FAILURE_RPE);
    const failedRecord = fatigueRecordFor(
      1,
      'squat',
      failed.report === null ? [] : [failed.report],
    );
    expect(failedRecord?.topRpe).toBe(10);
  });
});

describe('the normal path has no subjective check-in', () => {
  it('createSession opens on the lift+RPE briefing', () => {
    const state = createSession({
      day: 3,
      lift: 'bench',
      e1rmKg: 120,
      bestE1rmKg: 120,
      streakBefore: 0,
      streakIfTrainedToday: 1,
      fatigue: EMPTY_FATIGUE_STATE,
    });
    expect(state.phase).toBe('briefing');
    expect(state.readiness?.headline).toBe(FATIGUE_COPY.HISTORY_READINESS_HEADLINE.forming);
    const ignored = stepSession(state, {
      kind: 'check-in-tap',
      tap: { question: 'sleep', answer: 'good' },
    });
    expect(ignored).toBe(state);
  });

  it('the ledger round-trips as JSON and readiness is unchanged', () => {
    const hard = after(EMPTY_FATIGUE_STATE, template(1, 10));
    const restored = JSON.parse(JSON.stringify(hard)) as FatigueState;
    expect(historyReadiness(restored, 2)).toEqual(historyReadiness(hard, 2));
    expect(sessionFeel(restored, 2)).toEqual(sessionFeel(hard, 2));
  });
});

describe('adaptive next training action — TRAINING-FIT-02 C/E', () => {
  it('empty history is form-history, not a fabricated push', () => {
    const action = nextTrainingAction(EMPTY_FATIGUE_STATE, 10);
    expect(action.kind).toBe('form-history');
    expect(action.headline).toBe(FATIGUE_COPY.NEXT_ACTION_HEADLINE['form-history']);
    expect(action.detail).toBe(FATIGUE_COPY.NEXT_ACTION_DETAIL['form-history']);
    expect(action.detail).not.toMatch(/\d|residual|strain|meter/i);
  });

  it('RPE 9 and 10 are heavier than RPE 8 — next action is not push', () => {
    const rpe8 = after(EMPTY_FATIGUE_STATE, template(1, 8));
    const rpe9 = after(EMPTY_FATIGUE_STATE, template(1, 9));
    const rpe10 = after(EMPTY_FATIGUE_STATE, template(1, 10));
    expect(nextTrainingAction(rpe8, 2).kind).toBe('hold');
    expect(nextTrainingAction(rpe9, 2).kind).toBe('recover');
    expect(nextTrainingAction(rpe10, 2).kind).toBe('recover');
    expect(nextTrainingAction(rpe8, 2).kind).not.toBe(nextTrainingAction(rpe9, 2).kind);
    expect(nextTrainingAction(rpe10, 2).detail).toBe(FATIGUE_COPY.NEXT_ACTION_LIMIT_DETAIL);
    expect(nextTrainingAction(rpe9, 2).detail).toBe(FATIGUE_COPY.NEXT_ACTION_DETAIL.recover);
  });

  it('hard recent training is not immediately recovered', () => {
    const hard = after(EMPTY_FATIGUE_STATE, template(1, 10));
    expect(nextTrainingAction(hard, 2).kind).toBe('recover');
    expect(nextTrainingAction(hard, 2).kind).not.toBe('push');
  });

  it('recovery decay opens a push after enough days', () => {
    const hard = after(EMPTY_FATIGUE_STATE, template(1, 10));
    expect(nextTrainingAction(hard, 6).kind).toBe('push');
    expect(nextTrainingAction(hard, 6).headline).toBe(FATIGUE_COPY.NEXT_ACTION_HEADLINE.push);
  });

  it('a failed lift folds as RPE 10 and is not a push the next morning', () => {
    const plan = prescribeSession(200, 'squat', 8, historyReadiness(EMPTY_FATIGUE_STATE, 1), 1);
    const failed = playedSetFrom(plan, 1, [
      { outcome: 'good-lift', executionQuality: 1 },
      { outcome: 'miss', executionQuality: 0 },
    ]);
    expect(failed.report?.rpe).toBe(TO_FAILURE_RPE);
    const oneSet = fatigueRecordFor(1, 'squat', failed.report === null ? [] : [failed.report]);
    expect(oneSet?.topRpe).toBe(TO_FAILURE_RPE);
    const fullFail: SessionRecord = {
      ...template(1, TO_FAILURE_RPE),
    };
    const action = nextTrainingActionAfterSession(EMPTY_FATIGUE_STATE, fullFail, 2);
    expect(action.kind).toBe('recover');
    expect(action.detail).toBe(FATIGUE_COPY.NEXT_ACTION_LIMIT_DETAIL);
    expect(oneSet).not.toBeNull();
  });

  it('same inputs produce the same next action', () => {
    const a = after(after(EMPTY_FATIGUE_STATE, template(1, 9)), template(2, 10));
    const b = after(after(EMPTY_FATIGUE_STATE, template(1, 9)), template(2, 10));
    expect(nextTrainingAction(a, 3)).toEqual(nextTrainingAction(b, 3));
  });

  it('history readiness names the last session without a meter', () => {
    expect(historyReadiness(EMPTY_FATIGUE_STATE, 2).detail).not.toMatch(/Last session/);
    const hard = after(EMPTY_FATIGUE_STATE, template(1, 10));
    expect(historyReadiness(hard, 2).detail).toMatch(/Last session • squat • RPE 10\./);
    expect(historyReadiness(hard, 2).detail).not.toMatch(/residual|strain|meter/i);
  });
});
