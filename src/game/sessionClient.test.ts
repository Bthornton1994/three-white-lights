import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  SESSION_BRIEF_KEYS,
  SESSION_PAYOFF_KINDS,
  briefFatigueFor,
  closeOutReadings,
  openingCache,
  payoffKindFor,
  receiveSnapshot,
  sessionContextFrom,
  submitCloseOut,
  todayFromCache,
  type SessionBrief,
  type SessionServerPort,
} from './sessionClient';
import {
  asProposalId,
  emptyProgressionCache,
  markCacheStale,
  readBestE1rmKg,
  readStreakDays,
  readingValue,
  type ProgressionCache,
  type ProgressionSnapshotWire,
  type ProposalId,
  type ProposalOfKind,
} from './progression';
import {
  asAccessoryCloseOut,
  createSession,
  liftForDay,
  stepSession,
  type SessionCloseOut,
  type SessionContext,
  type SessionState,
} from './session';
import {
  newServerRecord,
  snapshotWireFor,
  todayForLifter,
  type ServerRecord,
} from './sessionServer';
import { EMPTY_FATIGUE_STATE, type FatigueState, type SessionRecord } from './fatigue';
import { FATIGUE_TUNING } from './fatigue';
import { SESSION_BOUNDARY, SESSION_BOUNDARY_COPY, SESSION_COPY, SESSION_TUNING } from './sessionTuning';
import {
  RECOVERY_DAY_GUARDRAILS,
  asStreakDay,
  createStreakState,
  openDay,
  recordTrainingDay,
  type LocalWallClock,
  type StreakState,
} from './streak';
import type { LiftKind } from './meet';

/**
 * The day these fixtures pretend the account was created on (GDD 4.2 signup
 * day; `streak.ts` 1b). Day 0, because every simulated session below is
 * recorded on day 0 or later and a signup day after a session is refused.
 */
const SIGNUP_DAY = 0;


const MODULE_SOURCE = readFileSync(fileURLToPath(new URL('./sessionClient.ts', import.meta.url)), 'utf8');

function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``');
}

// ---------------------------------------------------------------------------
// A lifter, a day, and a session played for real
// ---------------------------------------------------------------------------

/** A day the rotation puts on squat, so the fixtures below can name one lift. */
const DAY = 20301;
const LIFT: LiftKind = liftForDay(DAY);
const STARTING_BEST_KG = 200;
const STARTING_STREAK = 11;
const PROPOSAL_ID: ProposalId = asProposalId('test-session');
const WALL_CLOCK: LocalWallClock = { year: 2026, month: 8, day: 4, hour: 19 };

function storedRecord(bestKg: number): ServerRecord {
  const fresh = newServerRecord(SIGNUP_DAY);
  return {
    ...fresh,
    bestE1rmKg: { ...fresh.bestE1rmKg, [LIFT]: bestKg },
    streak: {
      ...fresh.streak,
      currentStreak: STARTING_STREAK,
      longestStreak: STARTING_STREAK,
      lastTrainedDay: asStreakDay(DAY - 1),
    },
  };
}

/** Drives the real machine to a close-out, every rep good. */
function playSession(bestKg: number, ledger: FatigueState = EMPTY_FATIGUE_STATE): SessionState {
  return playSessionFrom({
    day: DAY,
    lift: LIFT,
    e1rmKg: bestKg,
    bestE1rmKg: bestKg,
    streakBefore: STARTING_STREAK,
    streakIfTrainedToday: STARTING_STREAK + 1,
    fatigue: ledger,
  });
}

/**
 * The same driver, from a context the caller built.
 *
 * `playSession` delegates here so the covered-gap fixtures below drive the SAME
 * machine by the SAME taps — a second copy of this loop is a second thing to
 * drift, and the point of those fixtures is that the context differs and
 * nothing else does.
 */
function playSessionFrom(context: SessionContext): SessionState {
  let state = createSession(context);
  for (const tap of [
    { question: 'sleep', answer: 'good' },
    { question: 'soreness', answer: 'fresh' },
    { question: 'motivation', answer: 'fired-up' },
  ] as const) {
    state = stepSession(state, { kind: 'check-in-tap', tap });
  }
  state = stepSession(state, { kind: 'choose-rpe', rpe: SESSION_TUNING.RPE_CHOICES[2]! });
  let guard = 0;
  const limit = SESSION_TUNING.WORK_SETS * SESSION_TUNING.REPS_PER_SET * SESSION_TUNING.WORK_SETS;
  while (state.phase !== 'close-out' && guard < limit) {
    guard += 1;
    state =
      state.phase === 'rest'
        ? stepSession(state, { kind: 'begin-set' })
        : stepSession(state, { kind: 'rep-resolved', outcome: 'good-lift', executionQuality: 1 });
  }
  return state;
}

function closeOutOf(state: SessionState): SessionCloseOut {
  if (state.closeOut === null) throw new Error('the scripted session produced no close-out');
  return state.closeOut;
}

// ---------------------------------------------------------------------------
// A server whose arithmetic is NOT the client's
// ---------------------------------------------------------------------------

/**
 * A port that answers with a rule the client has never heard of.
 *
 * THIS IS THE WHOLE POINT OF THE FILE. The shipped stand-in imports the client's
 * own `nextBestE1rm`, so client and server agree by construction and every check
 * against them would pass with the cache disconnected. This one answers
 * `previousBest + SERVER_ONLY_GAIN_KG` — a number no client code can produce — so
 * a screen showing it can only be reading what came back.
 */
const SERVER_ONLY_GAIN_KG = 3.25;

interface ScriptedServer {
  readonly port: SessionServerPort;
  /** What the server will answer with for the trained lift. */
  readonly answerKg: number;
  readonly briefsAsked: number[];
}

function scriptedServer(options?: {
  readonly startingBestKg?: number;
  readonly refuse?: boolean;
  readonly ledger?: FatigueState;
}): ScriptedServer {
  const startingBestKg = options?.startingBestKg ?? STARTING_BEST_KG;
  const stored = storedRecord(startingBestKg);
  const answerKg = startingBestKg + SERVER_ONLY_GAIN_KG;
  const briefsAsked: number[] = [];
  const answered: ServerRecord = {
    ...stored,
    revision: stored.revision + 1,
    bestE1rmKg: { ...stored.bestE1rmKg, [LIFT]: answerKg },
    streak: {
      ...stored.streak,
      currentStreak: STARTING_STREAK + 1,
      longestStreak: STARTING_STREAK + 1,
      lastTrainedDay: asStreakDay(DAY),
    },
  };
  const ledger = options?.ledger ?? stored.fatigue;
  return {
    answerKg,
    briefsAsked,
    port: {
      openingSnapshot: (): ProgressionSnapshotWire => snapshotWireFor(stored, null),
      sessionBrief: (day: number): SessionBrief => {
        briefsAsked.push(day);
        return { fatigue: briefFatigueFor(ledger, day) };
      },
      recordTrainingSession: (
        _day: number,
        _proposal: ProposalOfKind<'record-training-session'>,
        proposalId: ProposalId,
      ) =>
        Promise.resolve(
          options?.refuse === true
            ? ({ kind: 'refused', message: 'scripted refusal' } as const)
            : ({ kind: 'snapshot', wire: snapshotWireFor(answered, proposalId) } as const),
        ),
    },
  };
}

// ---------------------------------------------------------------------------
// Purity
// ---------------------------------------------------------------------------

describe('purity', () => {
  it('reads no clock, no randomness, no network and no React', () => {
    const code = codeOnly(MODULE_SOURCE);
    expect(code).not.toMatch(/\bDate\b/);
    expect(code).not.toMatch(/Math\.random/);
    expect(code).not.toMatch(/performance\.now/);
    expect(code).not.toMatch(/\bfetch\(/);
    expect(code).not.toMatch(/\bawait\b/);
    expect(code).not.toMatch(/setTimeout/);
    expect(MODULE_SOURCE).not.toMatch(/from 'react/);
  });

  it('the scan can see what it is looking for', () => {
    // The positive control. A stripper that ate the whole file would pass above.
    expect(codeOnly("const a = 1; // Date\n")).not.toMatch(/\bDate\b/);
    expect(codeOnly('const b = Date.now();')).toMatch(/\bDate\b/);
    expect(codeOnly(MODULE_SOURCE)).toMatch(/readBestE1rmKg/);
  });

  it('holds no ServerRecord — the row is the port’s, and there is no getter', () => {
    // The shape of the bypass this module was written to remove. `sessionClient`
    // may not name the stored row at all: everything it knows arrives as a wire
    // or a brief.
    expect(codeOnly(MODULE_SOURCE)).not.toMatch(/ServerRecord/);
    expect(codeOnly(MODULE_SOURCE)).not.toMatch(/todayForLifter/);
  });
});

// ---------------------------------------------------------------------------
// The brief: the one thing that is not a progression fact
// ---------------------------------------------------------------------------

describe('the session brief (GDD §3.4, §12.3)', () => {
  it('carries exactly one field, and it is the ledger', () => {
    const brief: SessionBrief = { fatigue: EMPTY_FATIGUE_STATE };
    expect(Object.keys(brief)).toEqual([...SESSION_BRIEF_KEYS]);
    expect([...SESSION_BRIEF_KEYS]).toEqual(['fatigue']);
  });

  it('narrows the ledger to the horizon that can still affect today', () => {
    const ancient: SessionRecord = {
      day: DAY - FATIGUE_TUNING.FATIGUE_MEMORY_DAYS - 1,
      lift: LIFT,
      topRpe: SESSION_TUNING.RPE_CHOICES[SESSION_TUNING.RPE_CHOICES.length - 1]!,
      workSets: SESSION_TUNING.WORK_SETS,
      repsPerSet: SESSION_TUNING.REPS_PER_SET,
    };
    const recent: SessionRecord = { ...ancient, day: DAY - 1 };
    const crossed = briefFatigueFor({ sessions: [ancient, recent], injury: null }, DAY);
    expect(crossed.sessions.map((s) => s.day)).toEqual([recent.day]);
  });

  it('the port the app actually runs is asked for a brief per session', () => {
    const server = scriptedServer();
    const cache = openingCache(server.port);
    sessionContextFrom(cache, server.port.sessionBrief(DAY, LIFT), DAY, LIFT);
    expect(server.briefsAsked).toEqual([DAY]);
  });
});

// ---------------------------------------------------------------------------
// In: the session starts from the cache and from nothing else
// ---------------------------------------------------------------------------

describe('what today is, read out of the cache', () => {
  it('takes the best e1RM and the streak from server truth', () => {
    const cache = openingCache(scriptedServer().port);
    const today = todayFromCache(cache, DAY, LIFT);
    expect(today.bestE1rmKg).toBe(STARTING_BEST_KG);
    expect(today.e1rmKg).toBe(STARTING_BEST_KG);
    expect(today.streakBefore).toBe(STARTING_STREAK);
    expect(today.streakIfTrainedToday).toBe(STARTING_STREAK + 1);
    expect(today.alreadyTrainedToday).toBe(false);
    expect(today.awaitingFirstSnapshot).toBe(false);
  });

  it('an empty cache reports a lifter with no history, not a zero dressed as a fact', () => {
    const today = todayFromCache(emptyProgressionCache(), DAY, LIFT);
    expect(today.awaitingFirstSnapshot).toBe(true);
    expect(today.bestE1rmKg).toBeNull();
    // Loads still have to come from somewhere, and it is the declared onboarding
    // placeholder rather than an invented number.
    expect(today.e1rmKg).toBe(SESSION_TUNING.STARTING_E1RM.kilograms[LIFT]);
    expect(today.streakBefore).toBe(0);
  });

  it('says so when the day is already logged', () => {
    const stored = storedRecord(STARTING_BEST_KG);
    const trained: ServerRecord = {
      ...stored,
      streak: { ...stored.streak, lastTrainedDay: asStreakDay(DAY) },
    };
    const cache = receiveSnapshot(emptyProgressionCache(), snapshotWireFor(trained, null));
    expect(todayFromCache(cache, DAY, LIFT).alreadyTrainedToday).toBe(true);
  });

  it('the context handed to createSession carries the cache’s numbers', () => {
    const server = scriptedServer();
    const cache = openingCache(server.port);
    const context = sessionContextFrom(cache, server.port.sessionBrief(DAY, LIFT), DAY, LIFT);
    expect(context.bestE1rmKg).toBe(STARTING_BEST_KG);
    expect(context.streakBefore).toBe(STARTING_STREAK);
    expect(context.streakIfTrainedToday).toBe(STARTING_STREAK + 1);
    // And it is a session the machine will accept.
    expect(createSession(context).phase).toBe('check-in');
  });
});

// ---------------------------------------------------------------------------
// GDD §4.3's "phew beat", read out of the cache
// ---------------------------------------------------------------------------

/**
 * The run length the covered-gap fixture returns from. Any number above 1 will
 * do; it is >1 so that the defect this file reproduces is VISIBLE — with a
 * one-day run the wrong answer and the right answer are both 1, which is
 * exactly why the existing 103 browser checks never saw it.
 */
const COVERED_GAP_RUN_DAYS = 10;

/**
 * How many days the fixture's lifter is away for.
 *
 * DERIVED FROM THE TUNING rather than written as a literal: one day past the
 * free grace is the shortest absence a Recovery Day has to hold, so this tracks
 * `FREE_GRACE_GAP_DAYS` if it is ever retuned instead of silently becoming a
 * grace-covered gap (which opens as a different kind and would not exercise
 * the defect at all).
 */
const COVERED_GAP_DAYS_MISSED = RECOVERY_DAY_GUARDRAILS.FREE_GRACE_GAP_DAYS + 1;

/** A lifter with a real run behind them, built by TRAINING rather than by hand. */
function runOf(days: number, signupDay: number): { readonly state: StreakState; readonly lastDay: number } {
  let state = createStreakState(asStreakDay(signupDay));
  let lastDay = signupDay;
  for (let i = 0; i < days; i += 1) {
    lastDay = signupDay + i;
    const trained = recordTrainingDay(state, asStreakDay(lastDay));
    if (!trained.ok) throw new Error(`fixture could not train day ${lastDay}: ${trained.error.code}`);
    state = trained.value.state;
  }
  return { state, lastDay };
}

function recordHolding(streak: StreakState): ServerRecord {
  const fresh = newServerRecord(streak.signupDay);
  return { ...fresh, streak };
}

describe('a Recovery Day save, read out of the cache (GDD §4.3)', () => {
  it('the client answers what the server would bank, on the opening a save holds', () => {
    const { state, lastDay } = runOf(COVERED_GAP_RUN_DAYS, SIGNUP_DAY);
    const returnDay = lastDay + COVERED_GAP_DAYS_MISSED + 1;

    // The fixture really is the covered-gap opening, and not some neighbour of
    // it. Without this the test could pass while measuring nothing.
    const opening = openDay(state, asStreakDay(returnDay));
    expect(opening.kind).toBe('gap-covered-by-recovery-days');
    expect(state.currentStreak).toBe(COVERED_GAP_RUN_DAYS);

    // WHAT THE SERVER WILL DO IF THEY TRAIN — the oracle, taken from the real
    // recorder rather than restated.
    const banked = recordTrainingDay(state, asStreakDay(returnDay));
    if (!banked.ok) throw new Error(`the save should be bankable: ${banked.error.code}`);
    expect(banked.value.streakAfter).toBe(COVERED_GAP_RUN_DAYS + 1);
    expect(banked.value.recoveryDaySave).not.toBeNull();

    const cache = receiveSnapshot(emptyProgressionCache(), snapshotWireFor(recordHolding(state), null));
    const lift = liftForDay(returnDay);
    const today = todayFromCache(cache, returnDay, lift);

    expect(today.streakBefore).toBe(COVERED_GAP_RUN_DAYS);
    // THE FIX. This read `1` before `streakIfTrainedToday` became one function:
    // `'gap-covered-by-recovery-days'` fell through the client's ternary chain,
    // so the close-out printed 1 over DAY STREAK — with the celebratory pop,
    // because 1 !== 10 — and snapped to 11 when the response landed.
    expect(today.streakIfTrainedToday).toBe(banked.value.streakAfter);
    expect(today.streakIfTrainedToday).toBe(COVERED_GAP_RUN_DAYS + 1);
    // AND THE TWO SIDES NOW AGREE BECAUSE THERE IS ONLY ONE OF THEM.
    expect(todayForLifter(recordHolding(state), returnDay, lift).streakIfTrainedToday).toBe(
      today.streakIfTrainedToday,
    );
  });

  it('the number the close-out prints under DAY STREAK is the one the server will bank', () => {
    const { state, lastDay } = runOf(COVERED_GAP_RUN_DAYS, SIGNUP_DAY);
    const returnDay = lastDay + COVERED_GAP_DAYS_MISSED + 1;
    const cache = receiveSnapshot(emptyProgressionCache(), snapshotWireFor(recordHolding(state), null));
    const lift = liftForDay(returnDay);

    const banked = recordTrainingDay(state, asStreakDay(returnDay));
    if (!banked.ok) throw new Error(`the save should be bankable: ${banked.error.code}`);

    const context = sessionContextFrom(cache, { fatigue: EMPTY_FATIGUE_STATE }, returnDay, lift);
    const closeOut = closeOutOf(playSessionFrom(context));
    expect(closeOut.canPropose).toBe(true);
    expect(closeOut.streakBefore).toBe(COVERED_GAP_RUN_DAYS);
    expect(closeOut.streakAfter).toBe(banked.value.streakAfter);

    const submitted = submitCloseOut(cache, closeOut, WALL_CLOCK, asProposalId('covered-gap'));
    if (submitted === null) throw new Error('the close-out should be submittable');
    const readings = closeOutReadings(submitted.cache, closeOut);
    // What `CloseOutView` prints under `CLOSE_OUT_STREAK_LABEL`. Was 1.
    expect(readings.streakValue).toBe(COVERED_GAP_RUN_DAYS + 1);
    // The pop still fires — the run really did go up by one — but it now fires
    // over the number GDD §4.3 calls the payoff instead of over a `1`.
    expect(readings.streakValue).toBe(closeOut.streakBefore + 1);
  });
});

// ---------------------------------------------------------------------------
// THE DECISIVE ONE
// ---------------------------------------------------------------------------

describe('the whole round trip, against a server that disagrees', () => {
  it('THE SERVER WINS: the payoff reads back the number the client did not predict', async () => {
    const server = scriptedServer();

    // 1. The app opens. Truth comes in through the one door.
    let cache: ProgressionCache = openingCache(server.port);
    expect(cache.status).toBe('confirmed');

    // 2. The session starts from that truth.
    const context = sessionContextFrom(cache, server.port.sessionBrief(DAY, LIFT), DAY, LIFT);
    expect(context.bestE1rmKg).toBe(STARTING_BEST_KG);

    // 3. It is played for real, on the real machine.
    const closeOut = closeOutOf(playSession(context.e1rmKg));
    expect(closeOut.canPropose).toBe(true);
    const clientPredicted = closeOut.newBestE1rmKg;
    expect(clientPredicted).not.toBeNull();

    // 4. The proposal goes in flight. NOW the screen is showing a guess, and the
    //    reading says so.
    const submission = submitCloseOut(cache, closeOut, WALL_CLOCK, PROPOSAL_ID);
    expect(submission).not.toBeNull();
    cache = submission!.cache;
    expect(cache.status).toBe('pending');
    const inFlight = closeOutReadings(cache, closeOut);
    if (inFlight.payoff.kind !== 'e1rm') throw new Error('unreachable');
    expect(inFlight.payoff.reading.kind).toBe('projected');
    expect(inFlight.payoff.valueKg).toBeCloseTo(clientPredicted!, 6);
    expect(inFlight.streakDays.kind).toBe('projected');

    // 5. The server answers with its own arithmetic.
    const response = await server.port.recordTrainingSession(DAY, submission!.proposal, PROPOSAL_ID);
    expect(response.kind).toBe('snapshot');
    if (response.kind !== 'snapshot') throw new Error('unreachable');
    cache = receiveSnapshot(cache, response.wire);
    expect(cache.status).toBe('confirmed');

    // 6. AND THE SCREEN SHOWS THE SERVER'S NUMBER.
    const settled = closeOutReadings(cache, closeOut);
    if (settled.payoff.kind !== 'e1rm') throw new Error('unreachable');
    expect(settled.payoff.reading.kind).toBe('confirmed');
    expect(settled.payoff.valueKg).toBe(server.answerKg);
    // The two really are different, or this test would pass with the cache cut
    // out of the path entirely.
    expect(Math.abs(server.answerKg - clientPredicted!)).toBeGreaterThan(1);
    expect(settled.payoff.valueKg).not.toBeCloseTo(clientPredicted!, 3);

    // 7. And TOMORROW is prescribed from the server's number, not the client's.
    const tomorrow = todayFromCache(cache, DAY + 1, LIFT);
    expect(tomorrow.bestE1rmKg).toBe(server.answerKg);
    expect(tomorrow.streakBefore).toBe(STARTING_STREAK + 1);
    expect(tomorrow.alreadyTrainedToday).toBe(false);
  });

  it('a refusal keeps the last confirmed truth and flags it', () => {
    const server = scriptedServer({ refuse: true });
    let cache = openingCache(server.port);
    const closeOut = closeOutOf(playSession(STARTING_BEST_KG));
    cache = submitCloseOut(cache, closeOut, WALL_CLOCK, PROPOSAL_ID)!.cache;
    cache = markCacheStale(cache, 'proposal-rejected');

    const readings = closeOutReadings(cache, closeOut);
    if (readings.payoff.kind !== 'e1rm') throw new Error('unreachable');
    expect(readings.payoff.reading.kind).toBe('stale');
    // The projection is gone. What is on screen is what the server last said.
    expect(readings.payoff.valueKg).toBe(STARTING_BEST_KG);
    expect(readings.streakValue).toBe(STARTING_STREAK);
  });

  it('a snapshot behind the one held is refused and changes nothing', () => {
    const server = scriptedServer();
    const cache = openingCache(server.port);
    const behind = snapshotWireFor(
      { ...storedRecord(STARTING_BEST_KG), revision: -1 },
      null,
    );
    expect(receiveSnapshot(cache, behind)).toBe(cache);
  });

  it('nothing can be proposed against a cache that has read nothing', () => {
    const closeOut = closeOutOf(playSession(STARTING_BEST_KG));
    expect(submitCloseOut(emptyProgressionCache(), closeOut, WALL_CLOCK, PROPOSAL_ID)).toBeNull();
  });

  it('a session that banked nothing proposes nothing', () => {
    let state = createSession({
      day: DAY,
      lift: LIFT,
      e1rmKg: STARTING_BEST_KG,
      bestE1rmKg: STARTING_BEST_KG,
      streakBefore: STARTING_STREAK,
      streakIfTrainedToday: STARTING_STREAK + 1,
      fatigue: EMPTY_FATIGUE_STATE,
    });
    for (const tap of [
      { question: 'sleep', answer: 'poor' },
      { question: 'soreness', answer: 'sore' },
      { question: 'motivation', answer: 'flat' },
    ] as const) {
      state = stepSession(state, { kind: 'check-in-tap', tap });
    }
    state = stepSession(state, { kind: 'choose-rpe', rpe: SESSION_TUNING.RPE_CHOICES[0]! });
    let guard = 0;
    const limit = SESSION_TUNING.WORK_SETS * SESSION_TUNING.REPS_PER_SET * SESSION_TUNING.WORK_SETS;
    while (state.phase !== 'close-out' && guard < limit) {
      guard += 1;
      state =
        state.phase === 'rest'
          ? stepSession(state, { kind: 'begin-set' })
          : stepSession(state, { kind: 'rep-resolved', outcome: 'miss', executionQuality: 0 });
    }
    const closeOut = closeOutOf(state);
    expect(closeOut.canPropose).toBe(false);
    const cache = openingCache(scriptedServer().port);
    expect(submitCloseOut(cache, closeOut, WALL_CLOCK, PROPOSAL_ID)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Three payoffs, not two (GDD §3.2, ruled)
// ---------------------------------------------------------------------------

describe('the payoff a close-out has', () => {
  it('names exactly two kinds', () => {
    expect([...SESSION_PAYOFF_KINDS]).toEqual(['e1rm', 'training-iq']);
  });

  it('a competition lift pays an e1RM', () => {
    expect(payoffKindFor(closeOutOf(playSession(STARTING_BEST_KG)))).toBe('e1rm');
  });

  it('an accessory close-out pays Training IQ and NO e1RM', () => {
    const played = closeOutOf(playSession(STARTING_BEST_KG));
    // `session.ts` carries the discriminant now and owns the one door to it.
    // This used to staple `payoff: 'training-iq'` on through a variable, which
    // set the tag the NUMBERS branch on and left the WORDS above them saying
    // "NEW e1RM" — the shape GDD §3.2 rules out.
    const tagged: SessionCloseOut = asAccessoryCloseOut(played);
    expect(payoffKindFor(tagged)).toBe('training-iq');
    expect(tagged.headline).toBe(SESSION_COPY.CLOSE_OUT_ACCESSORY_HEADLINE);
    expect(tagged.headline).not.toBe(SESSION_COPY.CLOSE_OUT_PR_HEADLINE);

    const cache = openingCache(scriptedServer().port);
    const readings = closeOutReadings(cache, tagged);
    expect(readings.payoff.kind).toBe('training-iq');
    if (readings.payoff.kind !== 'training-iq') throw new Error('unreachable');
    // NOT a zero and NOT the previous best. There is no number to show.
    expect(readings.payoff.pointsGained).toBeNull();
    // And the e1RM branch is genuinely gone, rather than present and empty:
    // the same cache under the e1RM payoff does have a number.
    const asLift = closeOutReadings(cache, played);
    if (asLift.payoff.kind !== 'e1rm') throw new Error('unreachable');
    expect(asLift.payoff.valueKg).toBe(STARTING_BEST_KG);
  });

  it('cannot be given a tag that is not one of the two', () => {
    // This used to check that an unknown STRING fell back to the e1RM payoff,
    // because the tag was optional and read structurally. It is a typed field
    // now, so the same mistake is a compile error — and the `@ts-expect-error`
    // is what keeps that claim non-vacuous: if `payoff` ever widens back to
    // `string`, the directive stops being satisfied and this test fails.
    const played = closeOutOf(playSession(STARTING_BEST_KG));
    // @ts-expect-error — 'something-else' is not a SessionPayoff.
    const odd: SessionCloseOut = { ...played, payoff: 'something-else' };
    expect(odd.payoff).toBe('something-else');
    expect(payoffKindFor(closeOutOf(playSession(STARTING_BEST_KG)))).toBe('e1rm');
  });
});

// ---------------------------------------------------------------------------
// PR-ness follows the record, not the client's prediction
// ---------------------------------------------------------------------------

describe('the PR call', () => {
  it('is re-derived against the reading, so a server correction removes it', async () => {
    // A server that answers BELOW the previous best: the client called a PR and
    // the record did not deliver one.
    const stored = storedRecord(STARTING_BEST_KG);
    const meaner: ServerRecord = {
      ...stored,
      revision: stored.revision + 1,
      bestE1rmKg: { ...stored.bestE1rmKg, [LIFT]: STARTING_BEST_KG - 1 },
    };
    const port: SessionServerPort = {
      openingSnapshot: () => snapshotWireFor(stored, null),
      sessionBrief: () => ({ fatigue: EMPTY_FATIGUE_STATE }),
      recordTrainingSession: (_d, _p, id) =>
        Promise.resolve({ kind: 'snapshot', wire: snapshotWireFor(meaner, id) } as const),
    };

    let cache = openingCache(port);
    const closeOut = closeOutOf(playSession(STARTING_BEST_KG));
    expect(closeOut.isPr).toBe(true);

    const submission = submitCloseOut(cache, closeOut, WALL_CLOCK, PROPOSAL_ID)!;
    cache = submission.cache;
    const inFlight = closeOutReadings(cache, closeOut);
    if (inFlight.payoff.kind !== 'e1rm') throw new Error('unreachable');
    expect(inFlight.payoff.isPr).toBe(true);

    const response = await port.recordTrainingSession(DAY, submission.proposal, PROPOSAL_ID);
    if (response.kind !== 'snapshot') throw new Error('unreachable');
    cache = receiveSnapshot(cache, response.wire);
    const settled = closeOutReadings(cache, closeOut);
    if (settled.payoff.kind !== 'e1rm') throw new Error('unreachable');
    expect(settled.payoff.isPr).toBe(false);
    expect(settled.payoff.valueKg).toBe(STARTING_BEST_KG - 1);
  });

  it('a first-ever e1RM is a PR', () => {
    const fresh = newServerRecord(SIGNUP_DAY);
    const blank: ServerRecord = {
      ...fresh,
      bestE1rmKg: { squat: null, bench: null, deadlift: null },
    };
    const cache = receiveSnapshot(emptyProgressionCache(), snapshotWireFor(blank, null));
    const played = closeOutOf(playSession(SESSION_TUNING.STARTING_E1RM.kilograms[LIFT]));
    const withNoHistory: SessionCloseOut = { ...played, previousBestE1rmKg: null };
    const readings = closeOutReadings(cache, withNoHistory);
    if (readings.payoff.kind !== 'e1rm') throw new Error('unreachable');
    // Nothing confirmed yet for this lift, so there is nothing to print.
    expect(readings.payoff.valueKg).toBeNull();
    expect(readings.payoff.isPr).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The copy and the knobs
// ---------------------------------------------------------------------------

describe('SESSION_BOUNDARY', () => {
  it('the latency is a positive number of milliseconds', () => {
    expect(Number.isFinite(SESSION_BOUNDARY.LOCAL_SERVER_LATENCY_MS)).toBe(true);
    expect(SESSION_BOUNDARY.LOCAL_SERVER_LATENCY_MS).toBeGreaterThan(0);
  });

  it('a projected number is dimmer than a confirmed one, and still visible', () => {
    expect(SESSION_BOUNDARY.PROJECTED_OPACITY).toBeGreaterThan(0);
    expect(SESSION_BOUNDARY.PROJECTED_OPACITY).toBeLessThan(1);
  });

  it('the settle and the tag fade are positive durations', () => {
    expect(SESSION_BOUNDARY.CONFIRM_SETTLE_MS).toBeGreaterThan(0);
    expect(SESSION_BOUNDARY.TAG_FADE_MS).toBeGreaterThan(0);
  });

  it('never puts a number in the copy the player reads', () => {
    // The same scan `sessionTuning.test.ts` runs over SESSION_COPY, for the same
    // reason: a percentage or a level in a caption is how a fatigue meter ships
    // by accident (GDD §3.4, §12.3).
    const strings = Object.values(SESSION_BOUNDARY_COPY);
    expect(strings.length).toBeGreaterThan(3);
    for (const value of strings) {
      expect(value, value).not.toMatch(/\d/);
    }
    expect(() => {
      for (const value of [...strings, 'fatigue 42%']) expect(value).not.toMatch(/\d/);
    }).toThrow();
  });

  it('never names a Total — GDD §3.2', () => {
    expect(JSON.stringify(SESSION_BOUNDARY_COPY)).not.toMatch(/total/i);
  });
});

// ---------------------------------------------------------------------------
// The read accessors this module was built to give consumers
// ---------------------------------------------------------------------------

describe('every read goes through progression.ts', () => {
  it('uses the accessors rather than reaching into a snapshot', () => {
    const code = codeOnly(MODULE_SOURCE);
    for (const accessor of ['readBestE1rmKg', 'readStreakDays', 'readStreakState']) {
      expect(code, accessor).toMatch(new RegExp(`\\b${accessor}\\b`));
    }
    // `snapshotFacts` would hand out the whole `ConfirmedFacts` and skip the
    // certainty discrimination entirely. Not used here, deliberately.
    expect(code).not.toMatch(/\bsnapshotFacts\b/);
  });

  it('the accessors agree with what the module reports', () => {
    const cache = openingCache(scriptedServer().port);
    expect(todayFromCache(cache, DAY, LIFT).bestE1rmKg).toBe(
      readingValue(readBestE1rmKg(cache, LIFT)),
    );
    expect(todayFromCache(cache, DAY, LIFT).streakBefore).toBe(
      readingValue(readStreakDays(cache)),
    );
  });
});
