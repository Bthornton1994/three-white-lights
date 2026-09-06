/**
 * History-derived readiness — SF-TWL-SESSION-A-TRAINING-FIT-01.
 *
 * Single source of truth: `FatigueState.sessions` via `recordSession`.
 * No second ledger. No fabricated rows. Load percent is always 0.
 */

import { describe, expect, it } from 'vitest';

import {
  EMPTY_FATIGUE_STATE,
  FATIGUE_COPY,
  FATIGUE_TUNING,
  LUCKIEST_ROLLS,
  adjustedTimingWindowMs,
  historyReadiness,
  recordSession,
  sessionFeel,
  type FatigueState,
  type SessionRecord,
} from './fatigue';
import { createSession, stepSession, type SessionContext } from './session';
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
