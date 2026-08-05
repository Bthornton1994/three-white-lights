import { describe, expect, it } from 'vitest';

import { localSessionServer } from './localSessionServer';
import {
  closeOutReadings,
  openingCache,
  receiveSnapshot,
  sessionContextFrom,
  submitCloseOut,
  todayFromCache,
} from '../game/sessionClient';
import { asProposalId, type ProposalId } from '../game/progression';
import {
  createSession,
  liftForDay,
  stepSession,
  type SessionCloseOut,
  type SessionState,
} from '../game/session';
import { newServerRecord, type ServerRecord } from '../game/sessionServer';
import { FATIGUE_TUNING, type SessionRecord } from '../game/fatigue';
import { SESSION_BOUNDARY, SESSION_TUNING } from '../game/sessionTuning';
import { asStreakDay, type LocalWallClock } from '../game/streak';

/**
 * The day these fixtures pretend the account was created on (GDD 4.2 signup
 * day; `streak.ts` 1b). Day 0, because every simulated session below is
 * recorded on day 0 or later and a signup day after a session is refused.
 */
const SIGNUP_DAY = 0;


const DAY = 20301;
const LIFT = liftForDay(DAY);
const BEST_KG = 200;
const STREAK = 11;
const PROPOSAL_ID: ProposalId = asProposalId('local-test');
const WALL_CLOCK: LocalWallClock = { year: 2026, month: 8, day: 4, hour: 19 };

function storedRecord(): ServerRecord {
  const fresh = newServerRecord(SIGNUP_DAY);
  return {
    ...fresh,
    bestE1rmKg: { ...fresh.bestE1rmKg, [LIFT]: BEST_KG },
    streak: {
      ...fresh.streak,
      currentStreak: STREAK,
      longestStreak: STREAK,
      lastTrainedDay: asStreakDay(DAY - 1),
    },
  };
}

/** No waiting in a unit test: the latency is the browser's problem. */
const instantly = (): Promise<void> => Promise.resolve();

function playSession(state: SessionState): SessionState {
  let next = state;
  for (const tap of [
    { question: 'sleep', answer: 'good' },
    { question: 'soreness', answer: 'fresh' },
    { question: 'motivation', answer: 'fired-up' },
  ] as const) {
    next = stepSession(next, { kind: 'check-in-tap', tap });
  }
  next = stepSession(next, { kind: 'choose-rpe', rpe: SESSION_TUNING.RPE_CHOICES[2]! });
  let guard = 0;
  const limit = SESSION_TUNING.WORK_SETS * SESSION_TUNING.REPS_PER_SET * SESSION_TUNING.WORK_SETS;
  while (next.phase !== 'close-out' && guard < limit) {
    guard += 1;
    next =
      next.phase === 'rest'
        ? stepSession(next, { kind: 'begin-set' })
        : stepSession(next, { kind: 'rep-resolved', outcome: 'good-lift' });
  }
  return next;
}

function closeOutOf(state: SessionState): SessionCloseOut {
  if (state.closeOut === null) throw new Error('no close-out');
  return state.closeOut;
}

describe('the stand-in server port', () => {
  it('exposes three methods and no way at the row', () => {
    // The whole reason the row moved behind a port. A getter here would put the
    // bypass back within reach of the hook.
    const port = localSessionServer({ record: storedRecord(), sleep: instantly });
    expect(Object.keys(port).sort()).toEqual([
      'openingSnapshot',
      'recordTrainingSession',
      'sessionBrief',
    ]);
  });

  it('opens on the stored row, read through the boundary', () => {
    const port = localSessionServer({ record: storedRecord(), sleep: instantly });
    const today = todayFromCache(openingCache(port), DAY, LIFT);
    expect(today.bestE1rmKg).toBe(BEST_KG);
    expect(today.streakBefore).toBe(STREAK);
  });

  it('the brief carries the ledger and nothing else (GDD §3.4, §12.3)', () => {
    const port = localSessionServer({ record: storedRecord(), sleep: instantly });
    expect(Object.keys(port.sessionBrief(DAY, LIFT))).toEqual(['fatigue']);
  });

  it('the brief is narrowed to the horizon that can affect today', () => {
    const ancient: SessionRecord = {
      day: DAY - FATIGUE_TUNING.FATIGUE_MEMORY_DAYS - 1,
      lift: LIFT,
      topRpe: SESSION_TUNING.RPE_CHOICES[SESSION_TUNING.RPE_CHOICES.length - 1]!,
      workSets: SESSION_TUNING.WORK_SETS,
      repsPerSet: SESSION_TUNING.REPS_PER_SET,
    };
    const recent: SessionRecord = { ...ancient, day: DAY - 1 };
    const port = localSessionServer({
      record: { ...storedRecord(), fatigue: { sessions: [ancient, recent], injury: null } },
      sleep: instantly,
    });
    // The lifter's history is longer than what crosses.
    expect(port.sessionBrief(DAY, LIFT).fatigue.sessions.map((s) => s.day)).toEqual([recent.day]);
  });

  it('waits before answering, for the latency it was given', async () => {
    const waits: number[] = [];
    const port = localSessionServer({
      record: storedRecord(),
      latencyMs: SESSION_BOUNDARY.LOCAL_SERVER_LATENCY_MS,
      sleep: (ms) => {
        waits.push(ms);
        return Promise.resolve();
      },
    });
    let cache = openingCache(port);
    const closeOut = closeOutOf(
      playSession(createSession(sessionContextFrom(cache, port.sessionBrief(DAY, LIFT), DAY, LIFT))),
    );
    const submission = submitCloseOut(cache, closeOut, WALL_CLOCK, PROPOSAL_ID)!;
    cache = submission.cache;
    // The in-flight beat is a state the app is IN, not one it computes and
    // discards. Without the wait there is no frame in which this is true.
    expect(cache.status).toBe('pending');
    await port.recordTrainingSession(DAY, submission.proposal, PROPOSAL_ID);
    expect(waits).toEqual([SESSION_BOUNDARY.LOCAL_SERVER_LATENCY_MS]);
  });

  it('runs the real Edge Function body and advances the stored row', async () => {
    const port = localSessionServer({ record: storedRecord(), sleep: instantly });
    let cache = openingCache(port);
    const closeOut = closeOutOf(
      playSession(createSession(sessionContextFrom(cache, port.sessionBrief(DAY, LIFT), DAY, LIFT))),
    );
    const submission = submitCloseOut(cache, closeOut, WALL_CLOCK, PROPOSAL_ID)!;
    cache = submission.cache;

    const response = await port.recordTrainingSession(DAY, submission.proposal, PROPOSAL_ID);
    expect(response.kind).toBe('snapshot');
    if (response.kind !== 'snapshot') throw new Error('unreachable');
    cache = receiveSnapshot(cache, response.wire);
    expect(cache.status).toBe('confirmed');

    const readings = closeOutReadings(cache, closeOut);
    if (readings.payoff.kind !== 'e1rm') throw new Error('unreachable');
    expect(readings.payoff.reading.kind).toBe('confirmed');
    expect(readings.payoff.valueKg).toBeGreaterThan(BEST_KG);
    expect(readings.streakValue).toBe(STREAK + 1);
    // And the row really moved: the day is now logged.
    expect(todayFromCache(cache, DAY, LIFT).alreadyTrainedToday).toBe(true);
  });

  it('refuses a second session on the same day (GDD §3.2)', async () => {
    const port = localSessionServer({ record: storedRecord(), sleep: instantly });
    let cache = openingCache(port);
    const closeOut = closeOutOf(
      playSession(createSession(sessionContextFrom(cache, port.sessionBrief(DAY, LIFT), DAY, LIFT))),
    );
    const first = submitCloseOut(cache, closeOut, WALL_CLOCK, PROPOSAL_ID)!;
    const ok = await port.recordTrainingSession(DAY, first.proposal, PROPOSAL_ID);
    if (ok.kind !== 'snapshot') throw new Error('unreachable');
    cache = receiveSnapshot(first.cache, ok.wire);

    const again = submitCloseOut(cache, closeOut, WALL_CLOCK, asProposalId('local-test-2'))!;
    const refused = await port.recordTrainingSession(DAY, again.proposal, asProposalId('local-test-2'));
    expect(refused.kind).toBe('refused');
  });
});
